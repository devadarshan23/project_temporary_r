/**
 * Make `infra/node_modules` match `infra/package-lock.json`, and do nothing at
 * all when it already does.
 *
 * 🛑 WHY THIS FILE EXISTS, AND WHY THE OBVIOUS FIX WAS REFUSED.
 *
 * G259 gives `infra/` its own manifest so that `aws-cdk-lib` and `constructs`
 * never enter the root one — the property the `Dockerfile` states in its own
 * header, that `npm ci --omit=dev` yields a container with the driver and no
 * compiler, and the same property G212 refused `@aws-sdk/client-s3` to protect.
 * The cost of that separation is exact: a root `npm ci` installs nothing for
 * `infra/`, so `typecheck:infra` and `synth:infra` would be RED on a clean
 * checkout — and G108 requires `npm ci && npm run check` to be green on one.
 *
 * ⚠️ A ROOT `postinstall` WOULD FIX IT AND WOULD BREAK THE THING G259 IS FOR.
 * npm runs lifecycle scripts on `npm ci --omit=dev` too, so a root
 * `postinstall` that installed `infra/` would FIRE INSIDE THE DOCKER BUILD —
 * where the `Dockerfile` copies `package.json` and `package-lock.json` and
 * nothing else, so `infra/package.json` is not even present. The image build
 * would fail, and the repair somebody reached for would be to copy `infra/`
 * into the image, which is exactly the outcome the separate manifest exists to
 * prevent. Refused, and recorded here so it is not rediscovered as a good idea.
 *
 * So the install hangs off the two `infra/` scripts instead. It runs ONCE per
 * lockfile change and is a no-op afterwards, which is what keeps `npm run check`
 * deterministic and fast under G108: the sentinel below is the lockfile's hash,
 * so a changed lockfile reinstalls and an unchanged one costs a single file
 * read. With the tree already installed this file touches no network, which is
 * also what lets `cdk synth` be offline.
 */

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const INFRA_DIR = dirname(fileURLToPath(import.meta.url))
const LOCKFILE = join(INFRA_DIR, 'package-lock.json')
const NODE_MODULES = join(INFRA_DIR, 'node_modules')
const SENTINEL = join(NODE_MODULES, '.reconcile-infra-deps')

function lockfileHash() {
  return createHash('sha256').update(readFileSync(LOCKFILE)).digest('hex')
}

/**
 * @returns {'up-to-date' | 'installed'}
 * @throws if the install fails. A silent failure here would hand `tsc` a
 *         missing `aws-cdk-lib` and the error a reader would see is a hundred
 *         `TS2307`s rather than "the install failed".
 */
export function ensureInfraDeps() {
  const want = lockfileHash()

  if (existsSync(SENTINEL) && existsSync(join(NODE_MODULES, 'aws-cdk-lib'))) {
    const have = readFileSync(SENTINEL, 'utf8').trim()
    if (have === want) return 'up-to-date'
  }

  process.stderr.write('infra: installing from infra/package-lock.json (once per lockfile change)\n')
  const result = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: INFRA_DIR,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(
      `infra: 'npm ci' in ${INFRA_DIR} exited ${result.status}. ` +
        'infra/ has its own manifest under G259; run it by hand and read the error.',
    )
  }

  mkdirSync(NODE_MODULES, { recursive: true })
  writeFileSync(SENTINEL, `${want}\n`)
  return 'installed'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    ensureInfraDeps()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
}

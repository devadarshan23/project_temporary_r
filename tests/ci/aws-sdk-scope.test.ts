/**
 * **R-C's OTHER HALF: THE SDK IS SERVER-ONLY, AND ITS ARRIVAL SWEPT TWO CITED
 * PROPERTIES RATHER THAN LEAVING THEM TO ROT.** 20 Sep 2026.
 *
 * ┌─ 🛑 WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────┐
 * │ R-C reads, in the owner's own words: *"Pinned exact under G191, and        │
 * │ **server-only**."* `tests/infra/manifest.test.mjs` holds the PINNED and    │
 * │ the NARROW halves — one `@aws-sdk/*` package, exact. This file holds the   │
 * │ SERVER-ONLY half, which no manifest can express: a package in the root     │
 * │ manifest is resolvable from `model/`, `tools/`, `frontend/` and `tests/`   │
 * │ alike, and the day somebody imports it from `frontend/` the bundle grows   │
 * │ an AWS client that `vite build` will happily ship to a browser.            │
 * │                                                                            │
 * │ ⚠️ IT IS NOT A CIRCLE: `model/`, `tools/` and `frontend/` are the projects │
 * │ whose whole point is that they hold no I/O, and `model/tsconfig.json` is   │
 * │ verified to compile *"with no `package.json`, no `node_modules` and no     │
 * │ root tsconfig present"* — a `@aws-sdk/*` import there would end that       │
 * │ property silently, because `tsc` would simply fail to resolve it in a way  │
 * │ that looks like a setup problem.                                           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 AND THE TWO SWEPT PROPERTIES ARE ASSERTED HERE, NOT NARRATED ──────────┐
 * │ A discharged ruling usually leaves a trail of citations that were true     │
 * │ when written and are now false. R-C names both and this file makes the     │
 * │ sweep a red gate:                                                          │
 * │                                                                            │
 * │   · `grep -c 'aws-sdk' package.json` → 0 was a cited control from          │
 * │     22 Aug 2026 and returns 1. Every site that quoted it is corrected in   │
 * │     place; §3 requires each of the two `CLAUDE.md` sites to carry a        │
 * │     correction rather than the bare claim.                                  │
 * │   · The `Dockerfile` header's *"`npm ci --omit=dev` installs fastify, pg   │
 * │     AND yaml … and no compiler"* is now three packages short. §4 requires  │
 * │     the header to name the client.                                         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Directories in which an `@aws-sdk/*` import is a red gate. */
const SDK_FREE_ROOTS = ['model', 'tools', 'frontend', 'db'] as const

/**
 * The one directory permitted to name it, and the files inside it — ONE PER
 * SERVICE. ⚠️ THIS WAS A SINGLE `SDK_HOME` UNTIL 1 Oct 2026 AND IS WIDENED BY
 * G2404, deliberately and by name: G2401 (the owner's) puts source
 * credentials in Secrets Manager, and the second client gets the first one's
 * shape exactly — its own file, reached by a DYNAMIC import from a seam
 * (`credential-store.ts`), so a plane with no store configured never loads it.
 * The property that survives is *one file per client, each named here*; a
 * third file — or a second file naming either client — is still a red.
 */
const SDK_HOMES = [
  path.join('server', 'data-plane', 'secrets-manager-store.ts'),
  path.join('server', 'data-plane', 'sqs-run-queue.ts'),
]

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.css'])

function walk(dir: string): readonly string[] {
  const out: string[] = []
  let entries: readonly string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'dist-ssr') continue
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...walk(full))
    else if (SOURCE_EXTENSIONS.has(path.extname(entry))) out.push(full)
  }
  return out
}

/**
 * An IMPORT or a REQUIRE of an `@aws-sdk/*` package — never a mention in prose.
 *
 * 🛑 **THIS PATTERN WAS BLIND TO A MULTI-LINE IMPORT UNTIL 1 Oct 2026 — G2409,
 * MEASURED, NOT FEARED.** Its first arm is `import\b[^\n]*?from`, which stops
 * at the first newline, so
 *
 *     import {
 *       CreateSecretCommand,
 *     } from '@aws-sdk/client-secrets-manager'
 *
 * — the shape any formatter produces past three names — matched NOTHING, and
 * `server/data-plane/secrets-manager-store.ts` was invisible to BOTH tests in
 * this file: the fence that says *exactly these files may name the SDK* would
 * have passed with a SDK import in `model/`, provided it was wrapped. Caught
 * because the per-client test went red reporting ONE home where two exist.
 * **The import was not reflowed onto one line to satisfy the pattern**; the
 * pattern gained the brace arm below, which spans lines and stops at the
 * closing brace.
 */
const SDK_IMPORT =
  /(?:^|\n)\s*(?:import\b[^\n]*?from\s*['"]@aws-sdk\/|import\s+(?:type\s+)?\{[^}]*\}\s*from\s*['"]@aws-sdk\/|import\s*\(\s*['"]@aws-sdk\/|(?:const|let|var)\b[^\n]*?require\s*\(\s*['"]@aws-sdk\/)/

test('test_no_aws_sdk_import_outside_server', () => {
  const offenders: string[] = []
  for (const root of SDK_FREE_ROOTS) {
    for (const file of walk(path.join(REPO_ROOT, root))) {
      if (SDK_IMPORT.test(readFileSync(file, 'utf8'))) {
        offenders.push(path.relative(REPO_ROOT, file))
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'R-C is "pinned exact under G191, and SERVER-ONLY". These files import an AWS SDK ' +
      `package outside \`server/\`: ${offenders.join(', ')}. \`model/\` is verified to ` +
      'compile with no `node_modules` at all; `frontend/` is bundled by `vite build` INSIDE ' +
      'the gate, so an import there ships an AWS client to a browser.',
  )
})

test('test_exactly_one_file_per_client_under_server_names_the_sdk', () => {
  const naming = walk(path.join(REPO_ROOT, 'server'))
    .filter((file) => SDK_IMPORT.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(REPO_ROOT, file))
    .sort()

  assert.deepEqual(
    naming,
    SDK_HOMES,
    'The SDK has ONE home PER CLIENT: `server/data-plane/sqs-run-queue.ts` (R-C) and ' +
      '`server/data-plane/secrets-manager-store.ts` (G2404), each reached by a DYNAMIC ' +
      'import from its seam so a plane with nothing configured never ' +
      'loads it. A second file naming it would be a second place a client can be ' +
      `constructed — and constructing one with no credentials is a boot-time surprise. Found: ${naming.join(', ')}`,
  )
})

test('test_the_frontend_bundle_cannot_reach_the_sdk_even_transitively', () => {
  /*
   * ⚠️ THE SHARPER FORM OF THE FIRST TEST, AND IT IS ABOUT A DIFFERENT RISK.
   * `frontend/` importing the SDK is caught above. What this catches is
   * `frontend/` importing anything under `server/`, which would pull the whole
   * data plane — and the SDK with it — into a browser bundle by transitivity.
   */
  const offenders = walk(path.join(REPO_ROOT, 'frontend'))
    .filter((file) => /from\s*['"][^'"]*\.\.\/(?:\.\.\/)*server\//.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(REPO_ROOT, file))

  assert.deepEqual(
    offenders,
    [],
    `these frontend files import from \`server/\`: ${offenders.join(', ')}. The bundle would ` +
      'then carry the data plane, its database driver and its SQS client.',
  )
})

test('test_both_claude_md_sites_that_cited_the_ended_control_carry_a_correction', () => {
  /*
   * 🛑 THE SWEEP, AS AN ASSERTION. `grep -c 'aws-sdk' package.json` → 0 was
   * cited in two places on `CLAUDE.md` and both were TRUE when written. This
   * requires each surviving citation to sit beside a correction rather than
   * standing as a bare claim — which is what this record does with every other
   * sentence that went false because work landed.
   */
  const page = readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')
  const lines = page.split('\n')

  const citing = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes("grep -c 'aws-sdk' package.json"))

  assert.ok(
    citing.length > 0,
    'neither citation survives on `CLAUDE.md`. R-C requires them CORRECTED IN PLACE and ' +
      'quoted, not deleted: they are the sentences a reader would have quoted onward, and ' +
      'deleting a control that fired is how a record stops recording.',
  )

  for (const { index } of citing) {
    const neighbourhood = lines.slice(Math.max(0, index - 14), index + 14).join('\n')
    assert.match(
      neighbourhood,
      /R-C|20 Sep 2026|client-sqs/,
      `\`CLAUDE.md\` line ${index + 1} still cites \`grep -c 'aws-sdk' package.json\` with no ` +
        'correction anywhere near it. That command returned 0 from 22 Aug 2026 and returns 1 ' +
        'from 20 Sep 2026 — R-C discharges G212 by its own condition — and a citation left ' +
        'bare is the resolving-but-wrong class this page catalogues twenty times over.',
    )
  }
})

test('test_the_dockerfile_header_names_what_omit_dev_now_installs', () => {
  const dockerfile = readFileSync(path.join(REPO_ROOT, 'Dockerfile'), 'utf8')
  assert.match(
    dockerfile,
    /client-sqs/,
    "The `Dockerfile` header states the property `npm ci --omit=dev` holds — G212's row " +
      'cites it by name — and it named THREE runtime packages. R-C makes it four and adds ' +
      'the SQS client`s transitive closure. The header must say so: it is the one place a ' +
      'reader looks to learn what is in the image, and a header that is one package short is ' +
      'a header that is wrong about the attack surface.',
  )
  assert.match(
    dockerfile,
    /no compiler|NOT typescript|not typescript/i,
    'the `no compiler` half of the property is unchanged and must still be stated: ' +
      '`aws-cdk-lib` in the root manifest would end it, which is what ' +
      '`tests/infra/manifest.test.mjs` fences.',
  )
})

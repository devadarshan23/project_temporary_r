/**
 * Shared spawning for the `infra/` suites. Not a test file — `npm test` globs
 * `*.test.ts` and `*.test.mjs`, and this is neither.
 *
 * 🛑 EXIT CODES ARE READ FROM `spawnSync`, NEVER FROM A PIPE. A piped exit
 * status is the pipe's, which is 0, and reads exactly like success —
 * `tests/ci/gate.test.ts` says the same thing at its head and for the same
 * reason.
 *
 * ⚠️ WHY THESE SUITES ARE `.mjs` AND NOT `.ts`. `tests/tsconfig.json` is
 * `include: ["**\/*.ts"]` and the gate type-checks it from the ROOT, where
 * `aws-cdk-lib` is deliberately absent (G259, G212): a `.ts` suite here would
 * make `npm run typecheck:tests` demand a package the root manifest must never
 * carry. JavaScript sidesteps that without weakening anything, because nothing
 * below is type-level — every assertion is against a spawned process's exit
 * code or its stdout.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const INFRA_DIR = join(REPO_ROOT, 'infra')

/**
 * `infra/` has its own manifest under G259, so a root `npm ci` installs nothing
 * for it. `infra/ensure-deps.mjs` explains at length why a root `postinstall`
 * was refused; here it is enough that the gate runs `typecheck:infra` before
 * `npm test`, so by the time these suites run the tree is already present and
 * this call is a single file read.
 */
export async function ensureDeps() {
  const mod = await import(join(INFRA_DIR, 'ensure-deps.mjs'))
  return mod.ensureInfraDeps()
}

export function infraDepsPresent() {
  return existsSync(join(INFRA_DIR, 'node_modules', 'aws-cdk-lib'))
}

/**
 * Run a fixture or entry point under `infra/` with a THROWAWAY `cdk.out`.
 *
 * The temporary output directory is not tidiness: `cdk synth` and every
 * fixture here write a cloud assembly, and writing it into the repository would
 * dirty a tracked tree on every test run — the failure `CLAUDE.md` records the
 * model extractor causing, where contributors learned to ignore a modified file
 * and the committed copy then stayed stale for days.
 */
export function runInfraScript(relativePath, extraEnv = {}) {
  const outdir = mkdtempSync(join(tmpdir(), 'reconcile-infra-'))
  const result = spawnSync(process.execPath, [join(INFRA_DIR, relativePath)], {
    cwd: INFRA_DIR,
    encoding: 'utf8',
    env: {
      ...process.env,
      CDK_OUTDIR: outdir,
      /**
       * 🛑 THE SYNTH-ONLY IMAGE TAG, AND IT IS HERE BECAUSE `PlanesStack` NOW
       * REFUSES TO SYNTH WITHOUT ONE — G1012.
       *
       * These fixtures are run as bare `node` processes, so the CDK CLI is not
       * there to read `cdk.json`'s `context`; `App` reads `CDK_CONTEXT_JSON`
       * from the environment, which is what this is. **It is the same sentinel
       * `npm --prefix infra run synth` passes**, spelled out rather than
       * imported for the reason every suite here states at its head: a test
       * that reads the constant under test proves a variable equals itself.
       *
       * ⚠️ A FIXTURE THAT NEEDS THE TAG ABSENT OVERRIDES IT — `extraEnv` is
       * spread last, and `planes-no-image-tag.ts` passes `CDK_CONTEXT_JSON:
       * '{}'` to witness the refusal RED.
       */
      CDK_CONTEXT_JSON: JSON.stringify({ planeImageTag: 'synth-only-not-a-deployable-tag' }),
      ...extraEnv,
    },
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    // `status` is null when a signal killed the process. Coercing that to 0
    // would report a crash as a pass, so it becomes a distinct number.
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/**
 * The real app's templates, keyed by stack name, from `buildApp()` itself.
 *
 * ⚠️ **`context` IS THE APP AS A DEPLOY WOULD GIVE IT, NOT A TEST HOOK** —
 * G1094, 20 Sep 2026. `-c pullRequestGate=on` is a real `cdk deploy` argument
 * and an opt-in resource is only assertable from both sides if a suite can
 * synthesise both; the DEFAULT call (no argument) is the tree a deploy gets when
 * nobody says anything, and that is the one most assertions should read.
 * Whatever is passed here is MERGED over the synth-only image tag, so a caller
 * asking for one context value does not lose the other.
 */
export function synthesisedTemplates(context = {}) {
  const run = runInfraScript('test-fixtures/templates.ts', {
    CDK_CONTEXT_JSON: JSON.stringify({
      planeImageTag: 'synth-only-not-a-deployable-tag',
      ...context,
    }),
  })
  if (run.status !== 0) {
    throw new Error(
      `infra/test-fixtures/templates.ts exited ${run.status}: ${run.stderr || run.stdout}`,
    )
  }
  return JSON.parse(run.stdout)
}

/** Every resource of one CloudFormation type, as [logicalId, resource] pairs. */
export function resourcesOfType(template, type) {
  return Object.entries(template.Resources ?? {}).filter(([, r]) => r.Type === type)
}

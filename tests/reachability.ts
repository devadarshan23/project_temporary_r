/**
 * A SKIP IS A CLAIM ABOUT THE MACHINE, NOT A PERMISSION TO REPORT SUCCESS.
 *
 * 🛑 WHAT THIS FILE EXISTS TO STOP, WITH THE INSTANCE THAT HAPPENED.
 *
 * `.github/workflows/check.yml` runs on `[self-hosted, reconcile]` and declares
 * no `services: postgres`. Whether a database exists on that runner is unstated
 * and unenforced, and on 16 Aug 2026 it did not: PR #257 merged a RED trunk
 * because its CI check reported SUCCESS while
 * `describe('the engine over HTTP', { skip })` stood down entirely. The header
 * of `tests/http/engine-on-served-path.test.ts` narrates it in full — run
 * 31933756888, `tests 1023 · pass 1019 · fail 0 · skipped 4`, with the suite
 * carrying invariants 1 and 3 across a live listener among the four. `main` was
 * red from the moment it was merged and only a machine WITH a database could
 * see it. A later run, 31961439743, was reported `success` with SEVEN test
 * databases unreachable and no browser binary at all.
 *
 * Each suite already prints a loud banner on stderr when it stands down. A
 * human reads a banner; a green tick is what a merge button reads. So the
 * absence has to cost an EXIT CODE, and this is where that is spelled.
 *
 * ⚠️ CONDITIONED ON `CI`, DELIBERATELY, AND THAT IS NOT A LOOPHOLE. A
 * contributor on a laptop with no PostgreSQL must still get a runnable suite —
 * the property `db/env.ts`'s probe exists to preserve, and the reason
 * `db/pg.ts` reaches its driver through a dynamic import in the first place.
 * What is being defended is the claim CI makes, and CI is the only place the
 * claim is read as evidence.
 *
 * 🛑 THE GUARD SITS OUTSIDE THE SKIPPED BLOCK. That is the whole mechanism: a
 * test inside `describe(…, { skip })` is never registered, so it can neither
 * pass nor fail nor be counted. Salvaged from PR #255 (`c0b7fd29`), which was
 * closed unmerged with this idea inside it, and generalised here so it is
 * stated ONCE for every database-dependent suite rather than once in one file.
 *
 * ⚠️ IT COSTS NO WORKFLOW STEP. G108 rules there is exactly one gate and CI
 * runs `npm run check` and nothing else; a guard that is an ordinary assertion
 * inside the suite joins that gate by already being in it.
 */

import { it } from 'node:test'
import assert from 'node:assert/strict'

import { describeTarget, type Probe } from '../db/env.ts'

/**
 * The failing half of the message, kept in one place so the two guards below
 * make the same argument in the same words.
 */
function underCiPreamble(what: string): string {
  return (
    `${what} DID NOT RUN, UNDER CI. Assertions were removed from the run by ` +
    '`describe(…, { skip })` — node never registered them, so they were not ' +
    'counted as skipped either, and the summary line is a statement about the ' +
    'assertions that remained. A green gate is then evidence about a smaller ' +
    'suite than the one in the tree. '
  )
}

/**
 * Under CI, a PostgreSQL must be reachable, or the run is a failure rather than
 * a smaller success.
 *
 * Call this ONCE per database-dependent test file, at the top level and
 * OUTSIDE every `describe`, passing the same `probe` the file's `skip` is
 * derived from. Passing a different probe would guard a condition the file's
 * suites do not actually depend on — the "rule keyed on a convenient landmark
 * instead of the property it protects" shape that `docs/HANDOFF.md` §5
 * catalogues.
 *
 * @param what  The suites that stand down, named so the failure says which
 *              evidence is missing rather than only that some is.
 */
export function databaseRequiredUnderCi(what: string, probe: Probe): void {
  it(`under CI, a database is reachable — ${what} must not silently sit out`, () => {
    if (process.env['CI'] === undefined) return
    assert.ok(
      probe.ok,
      underCiPreamble(what) +
        'Give the runner a PostgreSQL, or point `RECONCILE_DB_HOST` / ' +
        `\`RECONCILE_DB_PORT\` at one. Target: ${describeTarget()}. ` +
        `Reason: ${probe.ok ? '(reachable)' : probe.reason}`,
    )
  })
}

/**
 * Under CI, a browser must be reachable, for exactly the same reason.
 *
 * ⚠️ TAKES THE RESULT OF `browserSkip()` RATHER THAN ASKING ITS OWN QUESTION.
 * There is ONE statement in this repository of *is a browser present* — the
 * probe in `tests/design/render.ts`, which launches a page and reads a computed
 * style rather than stat-ing a path. A guard that re-derived the answer could
 * disagree with the suites it guards, and the disagreement would look like a
 * flake instead of like the two answers it is.
 *
 * @param skip  `browserSkip()`'s verdict: `false` when a page renders, and the
 *              sentence explaining why not when it does not.
 */
export function browserRequiredUnderCi(what: string, skip: false | string): void {
  it(`under CI, a browser is reachable — ${what} must not silently sit out`, () => {
    if (process.env['CI'] === undefined) return
    assert.equal(
      skip,
      false,
      underCiPreamble(what) +
        'These assertions are about COMPUTED STYLE — cascade layer order, ' +
        'pseudo-elements, var() resolution at the use site, and ' +
        'prefers-reduced-motion as a media state — and no DOM shim computes ' +
        'any of them. Run `npx playwright install chromium --only-shell` on ' +
        `the runner. Reason: ${skip === false ? '(reachable)' : skip}`,
    )
  })
}

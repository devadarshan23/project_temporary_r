/**
 * THE SPLIT-FLEET SUITE — W0-c, and the half of the image probe that can be
 * put in the gate.
 *
 * ┌─ 🛑 WHY A `*.test.mjs` SITS IN A DIRECTORY OF THINGS DELIBERATELY NOT ─────┐
 * │ `tests/e2e/probe-deployed-image.mjs` and `probe-staging.mjs` are both      │
 * │ named so that `npm test` does NOT glob them, because both reach the public │
 * │ internet and G108 attaches **deterministic and fast** to every checker in  │
 * │ the gate. **That condition is a fact about the FETCHING, not about the     │
 * │ JUDGEMENT** — and the judgement is a pure function of four strings.        │
 * │ Separating them is the whole of this slice: the probe keeps its four       │
 * │ `describe-*` verbs and gains no fifth, and the rule it applies to what     │
 * │ they return becomes assertable with no credential, no network and no       │
 * │ account. **This suite touches AWS in no way.**                             │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT NEEDS NO GUARD FROM `tests/reachability.ts` AND MUST NOT GROW ONE.
 * Those guards exist for suites that need a database or a browser; a suite that
 * needs neither and carried one would skip for a reason that does not apply to
 * it — and G1287 is what a suite that skips for the wrong reason costs.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { FLEET_VERDICT, FLEET_EXIT_CODE, fleetVerdict } from './fleet-image-verdict.mjs'

const REPO = '000000000000.dkr.ecr.us-west-2.amazonaws.com/reconcile/planes-staging'

/** Three builds. A 40-hex commit sha is the tag the pipeline pushes. */
const SHA = { first: 'a'.repeat(40), second: 'b'.repeat(40), third: 'c'.repeat(40) }

/**
 * ⚠️ THE TWO SIDES ARE SPELLED DIFFERENTLY ON PURPOSE AND THE FIXTURE MUST KEEP
 * IT THAT WAY: the pipeline registers a task definition BY DIGEST and the stack
 * names a TAG, so a fixture that spelled both as tags would prove the
 * comparison works in the one form the deployed fleet never takes.
 */
const runs = (sha) => ({ uri: `${REPO}@sha256:${sha}`, tags: [sha], pushedAt: '2026-09-20T09:00:00Z', gone: false })
const ownsTag = (sha) => ({ uri: `${REPO}:${sha}`, tags: [sha], pushedAt: '2026-09-20T09:00:00Z', gone: false })

const fleet = (dataSha, controlSha, stackSha) => [
  { name: 'reconcile-staging-data-plane', running: runs(dataSha), owned: ownsTag(stackSha) },
  { name: 'reconcile-staging-control-plane', running: runs(controlSha), owned: ownsTag(stackSha) },
]

// §1 — both services on the stack's image.
test('§1 a fleet that agrees with the stack is AGREE and exits 0', () => {
  const v = fleetVerdict(fleet(SHA.first, SHA.first, SHA.first))
  assert.equal(v.verdict, FLEET_VERDICT.agree)
  assert.equal(v.exitCode, 0)
  assert.equal(v.split, null)
})

// §2 — both services on the SAME non-stack image: one fact, uniformly.
test('§2 a healthy post-pipeline fleet is DRIFT and is NOT a split', () => {
  const v = fleetVerdict(fleet(SHA.second, SHA.second, SHA.first))
  assert.equal(v.verdict, FLEET_VERDICT.drift)
  assert.equal(v.exitCode, 1)
  assert.equal(v.split, null, 'two services on one image are not split, however far from the stack they are')
})

// §3 — the two services on DIFFERENT images, the stack on a third.
test('§3 a split fleet the stack agrees with neither is SPLIT', () => {
  const v = fleetVerdict(fleet(SHA.first, SHA.second, SHA.third))
  assert.equal(v.verdict, FLEET_VERDICT.split)
  assert.ok(v.split, 'a split verdict must carry the disagreeing pair it found')
})

/**
 * §4 — THE SHAPE `docs/build/completion-plan.md` §8 NAMES. The Deploy stage
 * deploys the CONTROL plane first, so an abort between the two leaves the DATA
 * plane on the previous image — and the data plane is the one that publishes to
 * the run queue and reads the control roster. The stack owns one of the two, so
 * this produces exactly ONE drift line.
 */
test('§4 an abort between the two planes is SPLIT even with one drift line', () => {
  const v = fleetVerdict(fleet(SHA.first, SHA.second, SHA.second))
  assert.equal(v.verdict, FLEET_VERDICT.split)
  assert.equal(v.perService.filter((s) => !s.agreesWithStack).length, 1)
})

/**
 * §5 — THE DEFECT ITSELF, STATED AS AN ASSERTION RATHER THAN AS PROSE.
 * `docs/build/completion-plan.md` §5 W0-c: *"A split where the stack owns a
 * third image produces two DRIFT lines and exit 1 — identical in shape to a
 * healthy post-pipeline fleet."* If §2 and §3 ever agree again on both the
 * verdict and the exit code, the probe's exit code has stopped answering the
 * question it is run to answer.
 */
test('§5 a split fleet and a uniformly-behind fleet are not the same answer', () => {
  const uniform = fleetVerdict(fleet(SHA.second, SHA.second, SHA.first))
  const split = fleetVerdict(fleet(SHA.first, SHA.second, SHA.third))

  assert.equal(uniform.perService.filter((s) => !s.agreesWithStack).length, 2)
  assert.equal(split.perService.filter((s) => !s.agreesWithStack).length, 2)

  assert.notEqual(split.verdict, uniform.verdict, 'same number of drift lines, and it must not be the same verdict')
  assert.notEqual(split.exitCode, uniform.exitCode, 'a reader holding only an exit code must be able to tell them apart')
})

// §6 — three verdicts, three exit codes, none of them colliding.
test('§6 the three exit codes are distinct and none is the probe-error 2', () => {
  const codes = Object.values(FLEET_EXIT_CODE)
  assert.equal(codes.length, 3)
  assert.equal(new Set(codes).size, 3)
  assert.ok(!codes.includes(2), '2 is reserved for a probe that could not answer at all')
})

/**
 * §7 — GONE MUST NOT MANUFACTURE A SPLIT. An image expired out of ECR has an
 * EMPTY tag set, so a rule comparing tags alone would call two services on one
 * expired image split. They are not split; they are both unpullable, which
 * `stackAgrees` already reports as drift for its own stated reason.
 */
test('§7 two services on one EXPIRED image are drifted and not split', () => {
  const expired = { uri: `${REPO}@sha256:${SHA.first}`, tags: [], pushedAt: 'EXPIRED - no longer in ECR', gone: true }
  const v = fleetVerdict([
    { name: 'reconcile-staging-data-plane', running: expired, owned: ownsTag(SHA.second) },
    { name: 'reconcile-staging-control-plane', running: expired, owned: ownsTag(SHA.second) },
  ])
  assert.equal(v.verdict, FLEET_VERDICT.drift)
  assert.equal(v.split, null)
})

/**
 * §8 — THE SILENT-AGREE CLASS, CAPTURED. The first draft of this slice built
 * the probe's facts without carrying `uri` across from `tagsFor()`, so every
 * comparison became `undefined === undefined` and a split fleet was reported
 * **AGREE**. Reported by `probe-deployed-image-render.test.mjs` §3 as
 * `0 !== 3`. A verdict over an unreadable fact must be an exception and never
 * a verdict, because agreement is the answer nobody investigates.
 */
test('§8 a fact with no uri throws rather than agreeing with another that has none', () => {
  const blind = (name) => ({
    name,
    running: { tags: [], pushedAt: 'unknown', gone: false },
    owned: { tags: [], pushedAt: 'unknown', gone: false },
  })
  assert.throws(() => fleetVerdict([blind('data'), blind('control')]), /carries no uri/)

  const untagged = {
    name: 'data',
    running: { uri: `${REPO}@sha256:${SHA.first}`, pushedAt: 'unknown', gone: false },
    owned: ownsTag(SHA.first),
  }
  assert.throws(() => fleetVerdict([untagged]), /carries no tag list/)
})

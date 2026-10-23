/**
 * THE GATE VERDICT IS PER OPERATION — G911, G912, G913, 20 Sep 2026 — AND THIS
 * FILE IS THE MEASUREMENT THAT THE MIGRATION LOST NOTHING.
 *
 * ┌─ THE RULING ───────────────────────────────────────────────────────────────┐
 * │ *"Take it — the file boundary should not carry an authorisation decision.   │
 * │  An operation's gate verdict comes from the OPERATION, not from which file  │
 * │  it sits in."* (owner, 20 Sep 2026)                                         │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 **AND THE OWNER'S SURVIVING OBJECTION IS CARRIED RATHER THAN DISCHARGED,
 * HERE AS WELL AS ON `server/contract/capability.ts`:** *"It touches every
 * mounted tier's boot path, and the split just landed on the opposite premise
 * — so this would make `platform-console.openapi.yaml`'s existence a contract
 * change nobody needs, argued one way today and the other way tomorrow."*
 * **THE SECOND CLAUSE IS NOT ACTED ON. `platform-console.openapi.yaml` IS
 * UNTOUCHED BY THIS SLICE** — reversing G781 is a separate ruling nobody has
 * taken. What this slice does is make the NEXT such split unnecessary.
 *
 * ┌─ WHAT THIS FILE IS FOR, AND WHY IT IS NOT REDUNDANT WITH ITS NEIGHBOURS ───┐
 * │ `tests/contracts/capability-annotation.test.mjs` asserts the corpus is      │
 * │ clean. `tests/contracts/administration-evaluators.test.mjs` §1b and §1c     │
 * │ assert that a MIXED document is legal. Neither of them has ever seen        │
 * │ check D, E or F FIRE on its own terms, because no operation in the corpus   │
 * │ violates any of them — **a per-operation check over a corpus with no        │
 * │ violations is §5.6 unless something drives it**, and this drives each one.  │
 * │                                                                            │
 * │ AND §4 answers the question the ruling turns on, by derivation rather than  │
 * │ by argument: **is there any operation that would now BOOT which could not   │
 * │ before?**                                                                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT IS `.mjs` FOR ITS NEIGHBOURS' REASON, QUOTED: a `.ts` file naming an
 * export that does not exist is a TS2339 under `typecheck:tests`, *"which is
 * the WEAKEST possible red and would take the whole suite down rather than
 * reporting one assertion."*
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  EXEMPT_WITH_A_PERSON_TO_ASK,
  SECURITY_SCHEME_CALLER,
  callerMayBeAPerson,
  callerOf,
  classifyAnnotation,
  declaredOperations,
  gateVerdictOf,
  runChecks,
} from '../../tools/check-capability-annotations.mjs'

const OPS = declaredOperations()

/**
 * ⛔ **THE RETIRED TABLE, TRANSCRIBED — AND IT IS TRANSCRIBED ON PURPOSE.**
 * `TIER_REQUIRES_CAPABILITY` no longer exists, so §4's differential cannot
 * import it; a historical constant is the only way to ask *"what did the old
 * fence refuse?"* about today's corpus. **This is the one place in the tree
 * where these eight values may be written down**, it is dead as a verdict, and
 * §4a asserts it still describes the tree so that the differential below it
 * is about a real partition rather than a remembered one.
 */
const RETIRED_TIER_VERDICT = Object.freeze({
  capability: true,
  foundation: false,
  controlPlane: false,
  dataPlaneLocal: false,
  session: false,
  administration: false,
  platformConsole: true,
  errors: false,
})

/* ==================================================================== *
 * 0 · THE §5.6 GUARD. Every section below walks `OPS`; a bad loader
 *     would make all of them pass.
 * ==================================================================== */

test('guard · the corpus loaded and every operation carries a classified caller', () => {
  assert.ok(OPS.length >= 70, `only ${OPS.length} operation(s) loaded; every section below is free`)
  const unclassified = OPS.filter((o) => o.caller === 'unclassified')
  assert.deepEqual(
    unclassified.map((o) => `${o.tier}:${o.operationId}`),
    [],
    'a security scheme in the corpus is not in SECURITY_SCHEME_CALLER, so §1 and §2 would be ' +
      'measuring a fail-closed default rather than a classification.',
  )
})

/* ==================================================================== *
 * 1 · THE THREE CHECKS, EACH WITNESSED FIRING.
 *
 * 🛑 EACH IS DRIVEN THROUGH THE REAL `runChecks()` OVER A MUTATED COPY OF
 *    THE REAL CORPUS, so the thing under test is the checker rather than a
 *    restatement of its rules. The anti-vacuous floor is NOT bypassed:
 *    every fixture is the full 136 with one operation changed.
 * ==================================================================== */

function mutate(predicate, change) {
  const hit = OPS.filter(predicate)
  assert.ok(hit.length > 0, 'the mutation matched no operation, so the fixture proves nothing')
  return OPS.map((o) => (predicate(o) ? { ...o, ...change } : o))
}

test('1 · check D fires on the exemption reason that earned assertion 1e', () => {
  /**
   * 🛑 THIS IS THE NEGATIVE CONTROL `tests/contracts/capability-annotation.test.mjs`
   * ASSERTION 1e WAS BUILT FROM, RE-RUN AGAINST THE NEW MECHANISM. That
   * assertion is retired (it became a tautology once `GATED` was derived from
   * the annotation); its control is not. Its own words: a capability-tier
   * operation carrying `x-capability: 'exempt: <twenty characters of plausible
   * reasoning>'` passed every other assertion in that file *"while being
   * exactly as ungated as an operation with no key at all."*
   *
   * ⚠️ IT IS A DIFFERENT KIND OF RED NOW AND THE DIFFERENCE IS THE POINT: it
   * used to be a CATEGORY refusal (*"there is no reason that can be written
   * here"*) and is now a COUNT that moved. The population of person-facing
   * exemptions on the capability tier is pinned at zero, so the first one is
   * a red stage naming the operation.
   */
  const fixture = mutate(
    (o) => o.tier === 'capability' && o.operationId === 'getRun',
    { annotation: 'exempt: the run this returns is addressed by an id the caller already holds' },
  )
  const { findings } = runChecks(fixture)
  const d = findings.find((f) => f.code.startsWith('D ·'))
  assert.ok(d, 'check D did not fire on an exemption arriving on a tier pinned at zero')
  assert.match(d.detail, /capability: recorded 0, tree says 1/)
  assert.match(d.detail, /capability → getRun/)
})

test('1a · check E fires on a capability whose caller is a MACHINE', () => {
  /**
   * 🛑 CHECK E's WHOLE CONTENT, RE-FOUNDED. It used to key on
   * `!TIER_REQUIRES_CAPABILITY[o.tier]` while its own message argued about a
   * `PrincipalContext` and about `decide()` refusing *"at the subject-status
   * branch"* — §5.1, in the checker written to catch §5.1. It now keys on the
   * caller, and `listEntitledPacks` is the case that separates the two: it is
   * sigV4, a machine, and a capability on it would be a gate with nobody to
   * ask about.
   */
  const fixture = mutate(
    (o) => o.tier === 'controlPlane' && o.operationId === 'listEntitledPacks',
    { annotation: 'view_substrate' },
  )
  const { findings } = runChecks(fixture)
  const e = findings.find((f) => f.code.startsWith('E ·'))
  assert.ok(e, 'check E did not fire on a capability named by a machine-facing operation')
  assert.match(e.detail, /listEntitledPacks \(caller: machine\) → view_substrate/)
})

test('1b · check E ALSO fires where a caller is `none`, and that is the fifth fence\'s claim in the checker', () => {
  const fixture = mutate(
    (o) => o.tier === 'dataPlaneLocal' && o.operationId === 'checkLocalHealth',
    { annotation: 'view_dashboard' },
  )
  const { findings } = runChecks(fixture)
  const e = findings.find((f) => f.code.startsWith('E ·'))
  assert.ok(e, 'check E did not fire on a capability named by an operation with no security at all')
  assert.match(e.detail, /checkLocalHealth \(caller: none\)/)
})

test('1c · check F fires on a security scheme nobody has classified', () => {
  /**
   * G912's fail-closed half. `callerOf()` answers `unclassified` for an
   * unlisted scheme rather than sorting it into `machine`, which makes check
   * E fire and makes the fourth fence demand a mark — both fail-closed — but
   * neither of those SAYS what happened. This is the finding that names it,
   * and without it a reader would go looking for a capability problem.
   */
  const fixture = mutate(
    (o) => o.tier === 'capability' && o.operationId === 'getRun',
    { caller: callerOf([{ mutualTls: [] }]) },
  )
  assert.equal(callerOf([{ mutualTls: [] }]), 'unclassified', 'callerOf() sorted an unknown scheme somewhere')
  const { findings } = runChecks(fixture)
  const f = findings.find((x) => x.code.startsWith('F ·'))
  assert.ok(f, 'check F did not fire on an unclassified scheme')
  assert.match(f.detail, /capability:getRun/)
  for (const known of Object.keys(SECURITY_SCHEME_CALLER)) assert.match(f.detail, new RegExp(known))
})

test('1d · and the unmutated corpus produces no finding at all — the differential', () => {
  /**
   * ⚠️ WITHOUT THIS, §1–§1c ARE NOT EVIDENCE. Four fixtures that all go red
   * could mean the checks work or could mean `runChecks()` reds on anything
   * handed to it, and those are opposite conclusions.
   */
  const { findings } = runChecks(OPS)
  assert.deepEqual(findings, [], `the real corpus produced ${findings.length} finding(s)`)
})

/* ==================================================================== *
 * 2 · THE CALLER IS DERIVED PER OPERATION, NOT PER DOCUMENT.
 * ==================================================================== */

test('2 · four operations override their document\'s `security` and the derivation follows them', () => {
  /**
   * 🛑 IF THIS WERE READ AT DOCUMENT LEVEL THE CENSUS WOULD BE WRONG BY TWO.
   * `session.openapi.yaml` declares `security: []` at document level — no
   * caller — and `getSession` and `signOut` each override it with
   * `sessionContext`. A document-level read would count the session tier's
   * person-facing exemptions as 0; the truth is 2, and
   * `EXEMPT_WITH_A_PERSON_TO_ASK.session` says 2.
   */
  const session = OPS.filter((o) => o.tier === 'session')
  /* FIVE since G2541 (1 Oct 2026): `beginFederatedSignIn`, a caller-less op.
   * SIX since G2549 (2 Oct 2026): `relayBrokerReturn`, caller-less too.
   * SEVEN since G3354 (3 Oct 2026): `getSessionPrincipal`, a PERSON — the
   * chrome's who-am-I, overriding `security: []` exactly as `signOut` does. */
  assert.equal(session.length, 7)
  const people = session.filter((o) => o.caller === 'person').map((o) => o.operationId).sort()
  assert.deepEqual(people, ['getSession', 'getSessionPrincipal', 'signOut'])
  assert.deepEqual(
    session.filter((o) => o.caller === 'none').map((o) => o.operationId).sort(),
    ['beginFederatedSignIn', 'completeFederatedSignIn', 'relayBrokerReturn', 'resolveHomeRealm'],
    'the two operations that run BEFORE authentication must have no caller; #230: "a ' +
      'capability here is a verb with no noun."',
  )
  assert.equal(EXEMPT_WITH_A_PERSON_TO_ASK.session, 3)
})

test('2a · a requirement object naming two schemes is a CONJUNCTION, and one person in it is a person', () => {
  // `submitUsageAttestation` declares `[{ sigV4: [], contentSignature: [] }]` —
  // both machine, so the answer is machine. The two combinators are asserted
  // directly here because the corpus contains no OR alternative at all and a
  // reader must not infer that `mixed` is unreachable by construction.
  const attestation = OPS.find((o) => o.operationId === 'submitUsageAttestation')
  assert.ok(attestation, 'submitUsageAttestation is gone; pick another multi-scheme operation')
  assert.equal(attestation.caller, 'machine')

  assert.equal(callerOf([{ sigV4: [], sessionContext: [] }]), 'person', 'AND with a person in it is a person')
  assert.equal(callerOf([{ sigV4: [] }, { sessionContext: [] }]), 'mixed', 'OR across kinds is mixed')
  assert.equal(callerOf([{ sessionContext: [] }, { sessionContext: [] }]), 'person')
  assert.equal(callerOf(undefined), 'none')
  assert.equal(callerOf([]), 'none')
  assert.ok(callerMayBeAPerson('mixed'), 'mixed must count as a person for the fourth fence — fail closed')
  assert.ok(callerMayBeAPerson('unclassified'), 'unclassified must count as a person — fail closed')
  assert.equal(callerMayBeAPerson('machine'), false)
  assert.equal(callerMayBeAPerson('none'), false)
})

/* ==================================================================== *
 * 3 · THE VERDICT IS TOTAL OVER THE ANNOTATION AND LOSES NOTHING.
 * ==================================================================== */

test('3 · `gateVerdictOf` is exactly the three predicates the fences used to spell inline', () => {
  /**
   * The third, fifth and sixth fences read `spec.capability.kind` directly
   * before this slice and read `gateVerdictOf(spec.capability)` after it. That
   * is a restatement, not a change — and a restatement is exactly the kind of
   * thing that is claimed and not checked, so it is checked here over the
   * whole corpus rather than argued in a commit message.
   */
  for (const o of OPS) {
    const a = classifyAnnotation(o.annotation)
    const v = gateVerdictOf(a)
    assert.equal(v === 'gated', a.kind === 'capability', `${o.operationId}: gated arm drifted`)
    assert.equal(v === 'exempt', a.kind === 'exempt', `${o.operationId}: exempt arm drifted`)
    assert.equal(
      v === 'ungoverned',
      a.kind === 'absent' || a.kind === 'malformed',
      `${o.operationId}: the third state collapsed — absent and malformed must NOT read as exempt, ` +
        'which is the fail-open the third fence exists to refuse.',
    )
  }
})

/* ==================================================================== *
 * 4 · THE QUESTION THE RULING TURNS ON: DOES ANYTHING NOW BOOT THAT
 *     COULD NOT BEFORE?
 * ==================================================================== */

/* ==================================================================== *
 * ⛔ §4a AND §4b ARE DELETED — 21 Sep 2026, AND THEY DELETED THEMSELVES.
 * ==================================================================== *
 *
 * 🛑 **§4a CARRIED ITS OWN TERMINATION CONDITION AND THIS COMMIT MET IT.** Its
 * header read, verbatim:
 *
 *     "🛑 **IT IS EXPECTED TO GO RED, AND THE COMMIT THAT REDS IT SHOULD
 *      DELETE IT.** The first operation to name a capability inside
 *      `administration.openapi.yaml`, or to state an exemption inside
 *      `platform-console.openapi.yaml`, is the ruling being USED — at which
 *      point the differential below has served its purpose and this constant
 *      is history with nothing to compare against. Do not "fix" it by editing
 *      `RETIRED_TIER_VERDICT`: that would make a dead table live again."
 *
 * **R8 (21 Sep 2026, THE OWNER'S) is that first operation, three times over**:
 * `listOnboardingSteps`, `completeOnboardingStep` and `forceOnboardingStep`
 * name `view_substrate` inside `administration.openapi.yaml`.
 *
 * ⚠️ **WHAT THE TWO ASSERTIONS WERE FOR, SO THAT DELETING THEM IS NOT READ AS
 * LOSING A CONTROL.** They were a MIGRATION differential: G911 replaced the
 * fourth fence's predicate, and these two proved *"the migration changed
 * nothing while nothing had changed"* — that no operation the old per-FILE
 * fence refused was admitted by the new per-CALLER one. **That question is
 * answered and cannot be asked again**, because the corpus it was asked about
 * no longer exists: an operation now disagrees with the file it sits in, which
 * is exactly what G911 made legal and what R8 used.
 *
 * 🟢 **AND NOTHING THEY ASSERTED IS NOW UNCHECKED.** §3 of this file drives the
 * real `mountTier()` fences; `tests/contracts/capability-annotation.test.mjs`
 * walks the grammar and the caller per operation;
 * `EXEMPT_WITH_A_PERSON_TO_ASK` is recomputed by the gate on every run and
 * `tests/http/administration-tier-unmounted.test.ts` §1a pins this tier's
 * entry. **What is gone is a comparison against a table that no longer
 * decides anything** — which is the thing the deleted header said would be
 * history.
 *
 * ⚠️ `RETIRED_TIER_VERDICT` ITSELF IS KEPT above, unedited, because §3 and
 * this file's own header quote it as the best available description of who
 * calls each tier. **It describes and it decides nothing.**
 */


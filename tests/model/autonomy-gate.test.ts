/**
 * G129 — the autonomy gate.
 *
 * `Disposition.reversibility` carried the sentence *"An irreversible disposition
 * is never a candidate for autonomous execution however well it has behaved"*
 * and `grep -rn 'reversibility' model/*.ts` returned the declaration, fixture
 * literals, and NO READER. `AutonomyConfig`'s four dials were equally unread.
 * That is the shape `model/reconciliation.ts` names by its own precedent —
 * *"MAX_GRANT_HOURS's failure again — a comment claiming enforcement over zero
 * call sites"* — and this file is the first call site the sentence has ever had.
 *
 * ⚠️ WHAT THE RED HERE PROVED, AND WHAT IT DID NOT. `mayAutoResolve` did not
 * exist when this file was written, so the only red available was ABSENCE:
 * `TS2305: Module '"../../model/policy.ts"' has no exported member
 * 'mayAutoResolve'`. An import error proves nothing about behaviour. Every
 * assertion below was therefore additionally proved to BITE by mutation —
 * the implementation was changed to the plausible wrong thing, exactly one test
 * was watched to go red, and the change was reverted. The five mutations and
 * the test each caught are recorded in the block at the foot of this file.
 *
 * Every expected value below is a string LITERAL typed into this file, for the
 * reason `tests/model/access-decide.test.ts` gives: comparing a constant to
 * itself passes forever and witnesses nothing.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mayAutoResolve } from '../../model/policy.ts'
import type { AutonomyConfig } from '../../model/policy.ts'
import { autonomyGateDispositions, narrowLiveAutonomy } from '../../model/examples.ts'
import type { Disposition, Money } from '../../model/domain.ts'

/* ------------------------------------------------------------------ *
 * Fixtures — one axis per test
 *
 * `narrowLiveAutonomy` is the fixture under examination and lives in
 * `model/examples.ts` because `AutonomyConfig` HAS NO OTHER CONSTRUCTION SITE
 * (§5.10: a total record only bites where something constructs one, and a
 * config nothing constructs is a config no compiler has ever checked a field
 * of). Everything below derives from it by changing exactly one dial, so a
 * difference in the reason can only have come from the dial under examination.
 * ------------------------------------------------------------------ */

/** Every dial open. Used ONLY to prove irreversibility is not outvoted. */
const everyDialPermits: AutonomyConfig = {
  ...narrowLiveAutonomy,
  maxAutoResolveSeverity: 'critical',
  autonomousIn: { kind: 'all' },
  autoResolveValueCeiling: null,
  permittedActions: [
    'classify',
    'extract',
    'explain',
    'admit',
    'propose_resolution',
    'execute_resolution',
    'notify',
    'close_exception',
  ],
}

/** The candidate act `narrowLiveAutonomy` is written to permit. */
const permittedCandidate = {
  severity: 'low',
  domain: 'finance',
  action: 'execute_resolution',
  valueAtRisk: null,
} as const

const reversible: Disposition = autonomyGateDispositions.reversible
const reversibleWithCost: Disposition = autonomyGateDispositions.reversible_with_cost
const irreversible: Disposition = autonomyGateDispositions.irreversible

/* ------------------------------------------------------------------ *
 * 1. The fixtures themselves
 * ------------------------------------------------------------------ */

test('the disposition fixture is total over Reversibility and each member carries the reversibility it is keyed by', () => {
  assert.deepEqual(Object.keys(autonomyGateDispositions).sort(), [
    'irreversible',
    'reversible',
    'reversible_with_cost',
  ])
  assert.equal(autonomyGateDispositions.reversible.reversibility, 'reversible')
  assert.equal(
    autonomyGateDispositions.reversible_with_cost.reversibility,
    'reversible_with_cost',
  )
  assert.equal(autonomyGateDispositions.irreversible.reversibility, 'irreversible')
})

test('narrowLiveAutonomy is a genuinely narrow envelope, so a pass through it is not a pass through an open door', () => {
  assert.equal(narrowLiveAutonomy.maxAutoResolveSeverity, 'low')
  assert.deepEqual(narrowLiveAutonomy.autonomousIn, { kind: 'these', values: ['finance'] })
  assert.equal(narrowLiveAutonomy.autoResolveValueCeiling, null)
  assert.deepEqual(narrowLiveAutonomy.permittedActions, [
    'propose_resolution',
    'execute_resolution',
  ])
})

/* ------------------------------------------------------------------ *
 * 2. The permitted case
 *
 * Without this the gate could be refusing everything and every negative
 * control below would still be green.
 * ------------------------------------------------------------------ */

test('a reversible disposition inside every dial is permitted, and the gate is not refusing everything', () => {
  assert.deepEqual(mayAutoResolve(narrowLiveAutonomy, reversible, permittedCandidate), {
    allowed: true,
    reason: 'permitted',
  })
})

/* ------------------------------------------------------------------ *
 * 3. THE RULING — irreversible is refused UNCONDITIONALLY
 *
 * The ordering IS the ruling: dials cannot buy their way past it. Asserted
 * against `everyDialPermits`, where every other check would return allowed,
 * so a refusal here can only have come from the reversibility arm and can
 * only have come from it running FIRST.
 * ------------------------------------------------------------------ */

test('an irreversible disposition is refused even when every dial would permit', () => {
  assert.deepEqual(mayAutoResolve(everyDialPermits, irreversible, permittedCandidate), {
    allowed: false,
    reason: 'autonomy_disposition_irreversible',
  })
})

test('irreversible outranks each dial individually, so no single dial can be the one carrying the refusal', () => {
  const severityWouldRefuse: AutonomyConfig = {
    ...everyDialPermits,
    maxAutoResolveSeverity: 'none',
  }
  const domainWouldRefuse: AutonomyConfig = {
    ...everyDialPermits,
    autonomousIn: { kind: 'these', values: [] },
  }
  const actionWouldRefuse: AutonomyConfig = { ...everyDialPermits, permittedActions: [] }
  const ceilingWouldRefuse: AutonomyConfig = {
    ...everyDialPermits,
    autoResolveValueCeiling: { currency: 'SGD', amountMinor: 500_000n },
  }

  for (const cfg of [
    severityWouldRefuse,
    domainWouldRefuse,
    actionWouldRefuse,
    ceilingWouldRefuse,
  ]) {
    assert.equal(
      mayAutoResolve(cfg, irreversible, permittedCandidate).reason,
      'autonomy_disposition_irreversible',
    )
  }
})

test('reversible_with_cost is NOT unconditionally refused, so the arm is keyed on irreversible and not on not-reversible', () => {
  assert.deepEqual(
    mayAutoResolve(narrowLiveAutonomy, reversibleWithCost, permittedCandidate),
    { allowed: true, reason: 'permitted' },
  )
})

/* ------------------------------------------------------------------ *
 * 4. Each dial refuses INDEPENDENTLY, and names itself
 *
 * Each case changes exactly one dial away from `narrowLiveAutonomy` — or one
 * field of the candidate — so no dial can be doing another dial's work.
 * ------------------------------------------------------------------ */

test('severity above the ceiling refuses and names the severity dial', () => {
  const r = mayAutoResolve(narrowLiveAutonomy, reversible, {
    ...permittedCandidate,
    severity: 'medium',
  })
  assert.deepEqual(r, { allowed: false, reason: 'autonomy_severity_exceeded' })
})

test('severity AT the ceiling is permitted — the comparison is at-or-below, not below', () => {
  assert.equal(
    mayAutoResolve(narrowLiveAutonomy, reversible, {
      ...permittedCandidate,
      severity: 'low',
    }).allowed,
    true,
  )
})

test("maxAutoResolveSeverity 'none' refuses every severity, including the lowest", () => {
  const r = mayAutoResolve(
    { ...narrowLiveAutonomy, maxAutoResolveSeverity: 'none' },
    reversible,
    permittedCandidate,
  )
  assert.deepEqual(r, { allowed: false, reason: 'autonomy_severity_exceeded' })
})

test('a domain absent from autonomousIn refuses and names the domain dial', () => {
  const r = mayAutoResolve(narrowLiveAutonomy, reversible, {
    ...permittedCandidate,
    domain: 'kyc',
  })
  assert.deepEqual(r, { allowed: false, reason: 'autonomy_domain_not_permitted' })
})

test('the safe empty { kind: these, values: [] } authorises autonomy NOWHERE — §8.6, asserted rather than assumed', () => {
  const r = mayAutoResolve(
    { ...narrowLiveAutonomy, autonomousIn: { kind: 'these', values: [] } },
    reversible,
    permittedCandidate,
  )
  assert.deepEqual(r, { allowed: false, reason: 'autonomy_domain_not_permitted' })
})

test('{ kind: all } permits a domain that is not named anywhere', () => {
  assert.equal(
    mayAutoResolve(
      { ...narrowLiveAutonomy, autonomousIn: { kind: 'all' } },
      reversible,
      { ...permittedCandidate, domain: 'medical_records' },
    ).allowed,
    true,
  )
})

test('an action absent from permittedActions refuses and names the action dial', () => {
  const r = mayAutoResolve(narrowLiveAutonomy, reversible, {
    ...permittedCandidate,
    action: 'close_exception',
  })
  assert.deepEqual(r, { allowed: false, reason: 'action_not_permitted' })
})

test('an empty permittedActions refuses every action', () => {
  const r = mayAutoResolve(
    { ...narrowLiveAutonomy, permittedActions: [] },
    reversible,
    permittedCandidate,
  )
  assert.deepEqual(r, { allowed: false, reason: 'action_not_permitted' })
})

/* ------------------------------------------------------------------ *
 * 5. The money dial — REFUSES rather than approximates
 *
 * §5.3 is live: `AutonomyConfig.autoResolveValueCeiling` is `MoneyAmount`
 * (currency + amountMinor) and `Exception.valueAtRisk` is `Money`
 * (currency + amountMinor + exponent). No converting function exists and G66 /
 * G112 have ruled the collapse and NOT applied it. `model/reconciliation.ts`
 * already refuses across a differing exponent with matching currencies —
 * `sameUnit()` — so the model's own posture is that a currency code does not
 * license a unit assumption. A ceiling that cannot be evaluated must therefore
 * refuse, not read as satisfied: a control that reads as asserting more than it
 * does is §5.6, and inventing the exponent is §5.7.
 *
 * These tests pin the FAIL-CLOSED behaviour so that applying G66 has to change
 * a test rather than quietly change a decision.
 * ------------------------------------------------------------------ */

test('a stated value ceiling refuses and names the value dial, because MoneyAmount and Money cannot be compared today', () => {
  const r = mayAutoResolve(
    {
      ...narrowLiveAutonomy,
      autoResolveValueCeiling: { currency: 'SGD', amountMinor: 500_000n },
    },
    reversible,
    permittedCandidate,
  )
  assert.deepEqual(r, { allowed: false, reason: 'autonomy_value_ceiling_unevaluable' })
})

test('a stated ceiling refuses even when the value at risk is obviously far below it — approximating money is the thing refused, not the arithmetic', () => {
  const oneCent: Money = { currency: 'SGD', amountMinor: 1n, exponent: 2 }
  const r = mayAutoResolve(
    {
      ...narrowLiveAutonomy,
      autoResolveValueCeiling: { currency: 'SGD', amountMinor: 500_000n },
    },
    reversible,
    { ...permittedCandidate, valueAtRisk: oneCent },
  )
  assert.deepEqual(r, { allowed: false, reason: 'autonomy_value_ceiling_unevaluable' })
})

test('a ceiling in a different currency from the value at risk names the currency, not the unevaluable arm', () => {
  const inUsd: Money = { currency: 'USD', amountMinor: 100n, exponent: 2 }
  const r = mayAutoResolve(
    {
      ...narrowLiveAutonomy,
      autoResolveValueCeiling: { currency: 'SGD', amountMinor: 500_000n },
    },
    reversible,
    { ...permittedCandidate, valueAtRisk: inUsd },
  )
  assert.deepEqual(r, { allowed: false, reason: 'autonomy_value_currency_mismatch' })
})

test('a null ceiling is no monetary gate, and a stated value at risk passes straight through it', () => {
  const large: Money = { currency: 'SGD', amountMinor: 99_999_999n, exponent: 2 }
  assert.deepEqual(
    mayAutoResolve(narrowLiveAutonomy, reversible, {
      ...permittedCandidate,
      valueAtRisk: large,
    }),
    { allowed: true, reason: 'permitted' },
  )
})

/* ------------------------------------------------------------------ *
 * 6. The gate is a predicate, not an actor
 * ------------------------------------------------------------------ */

test('the gate mutates neither the config nor the disposition it was given', () => {
  const cfg: AutonomyConfig = {
    ...narrowLiveAutonomy,
    permittedActions: [...narrowLiveAutonomy.permittedActions],
  }
  const before = JSON.stringify({ cfg, d: irreversible })
  mayAutoResolve(cfg, irreversible, permittedCandidate)
  mayAutoResolve(cfg, reversible, permittedCandidate)
  assert.equal(JSON.stringify({ cfg, d: irreversible }), before)
})

/* ==================================================================== *
 * MUTATION LOG — how each assertion above was proved to bite
 *
 * `mayAutoResolve` is a NEW declaration, so no pre-existing red was available.
 * Each mutation below was applied to `model/policy.ts`, `npm test` was run, the
 * named test was observed red, and the mutation was reverted. Recorded here
 * rather than in a commit message because the next person to edit this gate
 * needs to know which assertion guards which line.
 *
 *   M1  Move the `irreversible` check from FIRST to LAST — below all four dials,
 *       immediately above the final `permitted`.
 *       → EXACTLY ONE test goes red: "irreversible outranks each dial
 *          individually", reporting `actual: 'autonomy_severity_exceeded'`
 *          against `expected: 'autonomy_disposition_irreversible'`.
 *          "an irreversible disposition is refused even when every dial would
 *          permit" stays GREEN, because with every dial open the mutant falls
 *          through to the reversibility arm and answers correctly by accident.
 *       🛑 THAT IS WHY BOTH TESTS EXIST. The first one does not test the
 *          ORDERING at all — only the second does, and the ordering IS G129.
 *
 *   M2  `askedRank > ceilingRank` → `askedRank >= ceilingRank`.
 *       → "severity AT the ceiling is permitted — the comparison is at-or-below,
 *          not below" goes RED, which is the assertion this mutation targets.
 *          ⚠️ TWELVE OTHER TESTS GO RED WITH IT, and that is a property of the
 *          fixture rather than of the mutation: `permittedCandidate` carries
 *          `severity: 'low'` against `narrowLiveAutonomy`'s `'low'` ceiling, so
 *          every case built from it now refuses at check 2 and never reaches the
 *          dial it was written to examine. Recorded rather than tidied away — a
 *          mutation log that claimed one red here would be overstating what the
 *          suite localises.
 *
 *   M3  Value ceiling arm returns `{ allowed: true, reason: 'permitted' }`.
 *       → both money-dial refusal tests go RED. Nothing else moves.
 *
 *   M4  `{ kind: 'these' }` treated as permissive when `values` is empty.
 *       → "the safe empty … authorises autonomy NOWHERE" goes RED, alone.
 *
 *   M5  Delete the `permittedActions` check entirely.
 *       → both action tests go RED, alone.
 *
 *   M6  Drop the currency comparison, so every stated ceiling reports
 *       `autonomy_value_ceiling_unevaluable`.
 *       → "a ceiling in a different currency … names the currency" goes RED,
 *          alone.
 * ==================================================================== */

/**
 * The first behavioural assertion in this repository.
 *
 * WHY `decide()` AND NOT SOMETHING SIMPLER. This file exists to prove the
 * runner runs, and the runner is only worth landing if it can be pointed at
 * `model/`. `model/access.ts` is importable under `node --test` today with
 * nothing changed in `model/`, because its four inter-module imports are all
 * `import type` and `verbatimModuleSyntax` erases every one before the loader
 * sees it. Three other modules are not — that is a separate issue, and this
 * file deliberately does not depend on it.
 *
 * ⚠️ WHAT A GREEN RUN HERE DOES NOT PROVE. `node --test` alone passes while
 * `tsc` fails: writing `CAPABILITIES.view_summary` — there is no such key, it
 * is `viewSummary` — produced TS2551 from the compiler and `pass 1` from the
 * runner, because the undefined capability never reached a comparison and
 * `decide()` had already short-circuited on the disabled subject. That is why
 * `npm test` is `typecheck:tests && node --test`, and why a runner that only
 * runs `node --test` is not a control.
 *
 * Every expected value below is a string LITERAL typed into this file.
 * `assert.equal(DECISION_REASONS.subject_not_active,
 * DECISION_REASONS.subject_not_active)` passes forever and witnesses nothing.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  decide,
  DECISION_REASONS,
  DENY_ALL,
  ORG_CLASSES,
  CAPABILITIES,
} from '../../model/access.ts'
import type { PrincipalContext } from '../../model/access.ts'

type UserId = PrincipalContext['subject']['userId']
type TenantId = PrincipalContext['tenantId']

/**
 * One fixture, one axis. Everything except `status` is held constant across
 * tests 1 and 2, so a difference in the reason can only have come from the
 * field under examination.
 *
 * `orgClass: customer` on purpose: `platform` short-circuits at check 2 with
 * `platform_org_holds_no_assignment`, which would mask the axis being tested.
 */
function principal(status: 'active' | 'disabled'): PrincipalContext {
  return {
    subject: { userId: 'user-fixture-1' as UserId, status },
    tenantId: 'tenant-fixture-1' as TenantId,
    orgClass: ORG_CLASSES.customer,
    partnerId: null,
    partnerGrant: null,
    held: [],
    now: '2026-08-08T00:00:00.000Z',
  }
}

test('test_a_disabled_subject_is_denied_with_the_reason_subject_not_active', () => {
  const decision = decide(principal('disabled'), CAPABILITIES.approveResolution)

  assert.equal(decision.allowed, false)
  /* The literal, not the constant. §8.6 is the clause this enforces: before
   * `decide()` existed, `User.status: 'disabled'` was consulted by nothing. */
  assert.equal(decision.reason, 'subject_not_active')
  /* One pin, stated once: the constant carries the literal this file asserts
   * against, so renaming the key is a failure rather than a silent agreement.
   * This is a pin, NOT the assertion — the line above is the assertion. */
  assert.equal(DECISION_REASONS.subject_not_active, 'subject_not_active')
})

test('test_flipping_only_the_subject_status_to_active_changes_the_reason_so_decide_is_not_denying_unconditionally', () => {
  const disabled = decide(principal('disabled'), CAPABILITIES.approveResolution)
  const active = decide(principal('active'), CAPABILITIES.approveResolution)

  /* THE SENSITIVITY CONTROL. Both are denials — an active customer holding no
   * assignments is still denied — so `allowed` alone cannot tell the two apart
   * and a test keyed on it would pass against a `decide()` that returned the
   * same denial for every input. The REASON is what moves. */
  assert.equal(disabled.allowed, false)
  assert.equal(active.allowed, false)
  assert.notEqual(disabled.reason, active.reason)
  assert.equal(active.reason, 'no_live_assignment')

  /* CLOSED SET. `canGrant()` used to return an interpolated
   * `granter_lacks_${capability}` — a free-text reason on a customer-visible
   * surface. Both reasons must be members of the enumeration, not strings that
   * merely look like members. */
  const closed: readonly string[] = Object.values(DECISION_REASONS)
  assert.ok(closed.includes(disabled.reason))
  assert.ok(closed.includes(active.reason))
})

test('test_a_denied_decision_carries_deny_all_scope_and_an_empty_via_chain', () => {
  const decision = decide(principal('disabled'), CAPABILITIES.approveResolution)

  /* Scope travels with the answer: a caller that ignores `allowed` and applies
   * `scope` must still deny. Pinned to literals here so that widening
   * `DENY_ALL` itself cannot make this test agree with the new value. */
  assert.deepEqual(DENY_ALL, {
    domains: { kind: 'these', values: [] },
    definitionIds: { kind: 'these', values: [] },
    solutionIds: { kind: 'these', values: [] },
    costCentres: { kind: 'these', values: [] },
    legalEntities: { kind: 'these', values: [] },
    valueCeiling: { currency: 'XXX', amountMinor: 0n, exponent: 0 },
  })
  assert.deepEqual(decision.scope, DENY_ALL)
  assert.deepEqual(decision.via, [])
})

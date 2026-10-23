/**
 * The endpoint class needs a read verb that is distinct from its write verb.
 *
 * These assertions intentionally use literals: before this suite's production
 * change, the endpoint class has only `configure_endpoint` and the vocabulary
 * has 37 members. The three remaining tests are negative controls for the
 * properties the new capability must not widen.
 *
 * 🛑 ONE OF THOSE THREE NEGATIVE CONTROLS WAS INVERTED ON 16 Aug 2026 BY G209,
 * AND THE PARAGRAPH ABOVE IS LEFT AS WRITTEN BECAUSE IT IS THE FRAMING THE
 * INVERSION HAPPENED AGAINST. The partner-mask control now asserts the widening
 * positively and carries its own previous text; the delegability and write-verb
 * controls are unchanged and still hold. See the block above
 * `test_view_endpoint_is_in_both_partner_operating_scopes_and_in_neither_by_accident`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  PARTNER_CAPABILITY_MASK,
  PARTNER_MASK_MEMBERSHIP,
} from '../../model/access.ts'
import type { PartnerAccessScopeKey } from '../../model/access.ts'
import { DELEGABLE_TO_AGENT } from '../../model/agents.ts'

test('test_the_endpoint_resource_class_carries_a_read_verb_and_a_write_verb_and_they_are_distinct_members', () => {
  const onEndpoint = Object.entries(CAPABILITY_RESOURCE_CLASS)
    .filter(([, resourceClass]) => resourceClass === 'endpoint')
    .map(([capability]) => capability)
    .sort()

  assert.deepEqual(onEndpoint, ['configure_endpoint', 'view_endpoint'])
  assert.equal(onEndpoint.length, 2)
  assert.notEqual(onEndpoint.length, 0)
})

test('test_view_endpoint_is_classed_endpoint_so_authorize_does_not_refuse_it_on_resource_class_mismatch', () => {
  assert.equal(CAPABILITY_RESOURCE_CLASS[CAPABILITIES.viewEndpoint], 'endpoint')
  assert.equal(CAPABILITIES.viewEndpoint, 'view_endpoint')
})

/**
 * ⚠️ THIRTY-EIGHT UNTIL THE MERGE OF `feat/authorisation-pass` ON 16 Aug 2026.
 * This suite minted `view_endpoint` as the thirty-eighth against a roster of 37;
 * G173 minted `admit_source` as the thirty-eighth against the same 37, on a
 * branch cut before #194. Neither knew about the other, both were right, and the
 * merged roster is 39. The literal is swept in the merge commit that moved it.
 *
 * ⚠️ AND IT IS FORTY-FOUR SINCE 19 Sep 2026 — G601's five platform-only
 * capabilities. The NAME of this test is left at *thirty_nine* deliberately:
 * renaming it would break the `test_`-prefixed identity every other assertion
 * in this file is addressed by, and the literal below is the claim. The lesson
 * this suite already records — a count is a fact about a tree — is why the
 * DISTINCTNESS assertion matters more than the total.
 */
test('test_the_capability_vocabulary_holds_thirty_nine_distinct_members', () => {
  const capabilities = Object.values(CAPABILITIES)

  /* ⚠️ 44 UNTIL 1 Oct 2026 — R10's six partner-only verbs, answered on
   * `decide()`'s fifth arm alone. Swept in the commit that moved it (§5.11). */
  /* ⚠️ 50 UNTIL 4 Oct 2026 — G3881's `view_run`, carried by `view_exception`. */
  assert.equal(capabilities.length, 51)
  assert.equal(new Set(capabilities).size, 51)
  assert.equal(
    Object.prototype.hasOwnProperty.call(CAPABILITY_RESOURCE_CLASS, CAPABILITIES.viewEndpoint),
    true,
  )
})

test('test_configure_endpoint_remains_the_endpoint_write_verb', () => {
  assert.equal(CAPABILITIES.configureEndpoint, 'configure_endpoint')
  assert.equal(CAPABILITY_RESOURCE_CLASS.configure_endpoint, 'endpoint')
  assert.notEqual(CAPABILITIES.configureEndpoint, CAPABILITIES.viewEndpoint)
})

/**
 * 🛑 INVERTED 16 Aug 2026 BY G209 RULING 1, AND THE INVERSION IS THE POINT OF
 * THIS BLOCK. A deleted assertion looks like an oversight; an inverted one
 * carrying its own history is a decision.
 *
 * WHAT THIS TEST ASSERTED BEFORE, IN ITS ENTIRETY. It was named
 * `test_view_endpoint_appears_in_no_partner_capability_mask_scope` and read:
 *
 *     const masked = Object.values(PARTNER_CAPABILITY_MASK).flat()
 *     assert.equal(masked.includes(CAPABILITIES.viewEndpoint), false)
 *     assert.equal(masked.includes('view_exception'), true)
 *
 * It arrived with PR #194 on the morning of 16 Aug 2026 — hours before this
 * edit — it was NAMED for the property, and it sat beside two siblings asserting
 * the same posture (`test_view_endpoint_is_not_delegable_to_an_agent` and
 * `test_configure_endpoint_remains_the_endpoint_write_verb`, both of which are
 * UNCHANGED and still hold).
 *
 * 🛑 THE OWNER REVERSED IT DELIBERATELY, WAS SHOWN THIS CONFLICT — this file,
 * this test, its age and its name — AND REAFFIRMED THE WIDENING. `G209` in
 * `docs/HANDOFF.md` §3 carries the reasoning, the two rejected alternatives (out
 * of every partner scope; `exceptions_operate` alone) and the cost accepted.
 * DO NOT RELITIGATE IT AND DO NOT QUIETLY RESTORE THE OLD WORDING.
 *
 * ⚠️ THE CONSEQUENCE, WRITTEN WHERE THE ASSERTION IS RATHER THAN ONLY IN THE G
 * ROW: a partner under EITHER operating scope can now enumerate the customer's
 * integration topology and its export destinations, and invariant 2's single
 * cross-tenant read path is what carries it.
 * `docs/access-and-agency.md` §11.9a made the mirror-image argument to keep the
 * meter out of `view_dashboard` — *"a partner supporting a customer's queue
 * would read that customer's volume in the clear through the mask"*. That
 * argument was OVERRIDDEN here, not distinguished.
 *
 * The membership is asserted POSITIVELY AND EXACTLY — both scopes named, and
 * `commercial_only` named as still absent — rather than as a non-emptiness,
 * because "in the mask somewhere" is the flat form group E of
 * `tests/contracts/capability-annotation.test.mjs` proved blind to the only
 * distinction that matters here.
 */
test('test_view_endpoint_is_in_both_partner_operating_scopes_and_in_neither_by_accident', () => {
  const scopesHolding = (Object.keys(PARTNER_CAPABILITY_MASK) as PartnerAccessScopeKey[])
    .filter((scope) => PARTNER_CAPABILITY_MASK[scope].includes(CAPABILITIES.viewEndpoint))
    .sort()

  assert.deepEqual(scopesHolding, ['exceptions_operate', 'exceptions_read'])
  assert.equal(
    PARTNER_CAPABILITY_MASK.commercial_only.includes(CAPABILITIES.viewEndpoint),
    false,
  )
  assert.equal(
    PARTNER_MASK_MEMBERSHIP.view_endpoint.length,
    2,
    'The mask is DERIVED from PARTNER_MASK_MEMBERSHIP; asserting on the derived value alone ' +
      'would leave the record and the mask able to disagree.',
  )
  // The unchanged half of the old assertion, kept so this test still fails on a
  // mask that has quietly emptied rather than widened.
  assert.equal(
    Object.values(PARTNER_CAPABILITY_MASK).flat().includes('view_exception'),
    true,
  )
})

/**
 * 🛑 WHAT THE WIDENING DOES **NOT** REACH, ASSERTED RATHER THAN PROMISED. G209
 * ruling 1 gives a partner the endpoint READ and nothing adjacent to it: the
 * write verb, the arming verb and the credential verb all stay out of every
 * scope. Without this, "a partner may see endpoints" is one careless edit away
 * from "a partner may configure one".
 */
test('test_the_partner_endpoint_read_reaches_no_write_no_arming_and_no_credential', () => {
  for (const capability of [
    'configure_endpoint',
    'enable_endpoint_writeback',
    'bind_secret',
  ] as const) {
    assert.deepEqual(
      PARTNER_MASK_MEMBERSHIP[capability],
      [],
      `${capability} is in a partner scope. G209 widened the READ of an endpoint and nothing ` +
        'else; the write, the write-back arming and the credential reference are each a ' +
        'separate decision that has not been taken.',
    )
  }
})

test('test_view_endpoint_is_not_delegable_to_an_agent', () => {
  assert.equal((DELEGABLE_TO_AGENT as readonly string[]).includes(CAPABILITIES.viewEndpoint), false)
  // ⚠️ 8 UNTIL THE MERGE OF `feat/authorisation-pass` ON 16 Aug 2026. The
  // ninth is `admit_source`, which G173 rules delegable; `view_endpoint` is
  // still `false` in `CAPABILITY_DELEGABLE`, so the assertion above — the one
  // this test is named for — is unmoved. Only the length literal moved.
  assert.equal(DELEGABLE_TO_AGENT.length, 9)
})

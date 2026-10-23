/**
 * G128 and G131, asserted.
 *
 * WHAT THE RED IN THIS FILE IS, AND WHAT IT IS NOT. Every declaration these
 * tests reach — `CAPABILITIES.promoteLearning`, the `promote_learning` key in
 * `CAPABILITY_RESOURCE_CLASS`, `mayPromoteLearning`'s capability parameter,
 * `LearningScope.normalisedDescriptions`, `ObservedScopeValue` — did not exist
 * when this file was written. The first run's red is therefore ABSENCE, and
 * absence proves nothing about behaviour. Each assertion below is paired with
 * either a sensitivity control in the same test (the same call with one field
 * flipped, yielding a DIFFERENT answer) or a recorded mutation of the
 * implementation. That is the standard the conservation suite set.
 *
 * THE TWO NEGATIVE CONTROLS THAT CARRY THE MOST WEIGHT are both absences, and
 * an absence is the hardest thing to test honestly:
 *
 *   1. `promote_learning` IS IN NO `PARTNER_CAPABILITY_MASK` SCOPE. Asserted BY
 *      NAME against each of the three scopes, never by comparing a length —
 *      a length assertion agrees with any substitution that keeps the count.
 *      Paired with a positive `includes()` on the same array so the assertion
 *      cannot be passing because `includes` was handed something it never
 *      matches.
 *   2. AN ENUMERATED VALUE WITH NO PROVENANCE IS REFUSED. Paired with the same
 *      nomination carrying provenance, which must be `valid: true` — otherwise
 *      the refusal could be unconditional and the test would still be green.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  PARTNER_CAPABILITY_MASK,
} from '../../model/access.ts'
import {
  IDENTIFYING_SCOPE_DIMENSIONS,
  LEARNING_PROMOTION_REQUIREMENT,
  MAX_ENUMERATED_PER_DIMENSION,
  PROMOTE_LEARNING_CAPABILITY,
  mayPromoteLearning,
  validateNomination,
} from '../../model/learning.ts'
import type {
  LearningScope,
  NominationEvidence,
  NormalisedDescriptionValue,
  ObservedScopeValue,
} from '../../model/learning.ts'

type ExceptionId = Parameters<NominationEvidence['counterExampleInScope']>[1]
type UserId = Parameters<typeof mayPromoteLearning>[0]['approver']

/* ------------------------------------------------------------------ *
 * G128 — capability 37
 * ------------------------------------------------------------------ */

test('test_promote_learning_is_a_member_of_CAPABILITIES_and_not_a_bare_string', () => {
  /* The literal, not the constant — renaming the key must fail here. */
  assert.equal(CAPABILITIES.promoteLearning, 'promote_learning')

  /* The load-bearing half: the module-local constant IS the member, so
   * `learning.ts` can no longer name a verb `access.ts` has never heard of.
   * Before G128 this was `export const PROMOTE_LEARNING_CAPABILITY =
   * 'promote_learning'` and `grep -n 'promote_learning' model/access.ts`
   * returned nothing. */
  assert.equal(PROMOTE_LEARNING_CAPABILITY, CAPABILITIES.promoteLearning)
  const closed: readonly string[] = Object.values(CAPABILITIES)
  assert.ok(closed.includes(PROMOTE_LEARNING_CAPABILITY))
  /* SENSITIVITY: the same membership question, asked of a verb that is not one.
   * Without this line `includes` could be returning true for anything. */
  assert.equal(closed.includes('promote_the_learning'), false)
})

test('test_promote_learning_is_classed_authority_and_not_configuration', () => {
  assert.equal(CAPABILITY_RESOURCE_CLASS[PROMOTE_LEARNING_CAPABILITY], 'authority')

  /* SENSITIVITY, and it is the whole argument of `learning.ts:720-778`:
   * `author_procedure` was the obvious reuse and is classed `configuration`,
   * which a delivery grant reaches on the strength of the purpose alone. If
   * this line and the one above ever return the same class, the reason the
   * capability was minted has evaporated. */
  assert.equal(CAPABILITY_RESOURCE_CLASS.author_procedure, 'configuration')
  assert.notEqual(
    CAPABILITY_RESOURCE_CLASS[PROMOTE_LEARNING_CAPABILITY],
    CAPABILITY_RESOURCE_CLASS.author_procedure,
  )
})

test('test_promote_learning_appears_in_no_partner_capability_mask_scope_by_name', () => {
  /* BY NAME, against each scope separately. A test that asserted a LENGTH
   * would agree with any substitution that kept the count. */
  assert.equal(PARTNER_CAPABILITY_MASK.commercial_only.includes(PROMOTE_LEARNING_CAPABILITY), false)
  assert.equal(PARTNER_CAPABILITY_MASK.exceptions_read.includes(PROMOTE_LEARNING_CAPABILITY), false)
  assert.equal(
    PARTNER_CAPABILITY_MASK.exceptions_operate.includes(PROMOTE_LEARNING_CAPABILITY),
    false,
  )

  /* THE CONTROL ON THE CONTROL. Three `false`s are also what you get from an
   * array that matches nothing at all. This proves the widest mask really does
   * answer `true` for a capability it holds, so the three lines above are
   * absences rather than a broken `includes`. */
  assert.equal(PARTNER_CAPABILITY_MASK.exceptions_operate.includes('propose_resolution'), true)

  /* And the absence is total, not scope by scope: no mask anywhere holds it. */
  const everyMasked: readonly string[] = Object.values(PARTNER_CAPABILITY_MASK).flat()
  assert.equal(everyMasked.includes(PROMOTE_LEARNING_CAPABILITY), false)
  assert.equal(everyMasked.includes('view_exception'), true)
})

test('test_LEARNING_PROMOTION_REQUIREMENT_names_the_real_capability_and_still_asks_for_two_holders', () => {
  assert.equal(LEARNING_PROMOTION_REQUIREMENT.capability, CAPABILITIES.promoteLearning)
  /* The retype is only worth anything if the value is a key the join knows.
   * `hasOwnProperty` against the total `Record` is the runtime form of the
   * compile-time claim — and it is the check that would have failed every day
   * the constant carried a bare string. */
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      CAPABILITY_RESOURCE_CLASS,
      LEARNING_PROMOTION_REQUIREMENT.capability,
    ),
    true,
  )
  /* Unchanged by G128, and pinned so the retype cannot quietly relax it:
   * nomination and promotion are two acts, by two named people. */
  assert.equal(LEARNING_PROMOTION_REQUIREMENT.distinctHolders, 2)
  assert.equal(LEARNING_PROMOTION_REQUIREMENT.appliesAtOrAboveValue, null)
})

/* ------------------------------------------------------------------ *
 * G128 — the gate itself
 * ------------------------------------------------------------------ */

const APPROVER = 'usr_approver' as UserId
const NOMINATOR = 'usr_nominator' as UserId
const CORRECTOR = 'usr_corrector' as UserId

function promotion(overrides: Partial<Parameters<typeof mayPromoteLearning>[0]> = {}) {
  return mayPromoteLearning({
    approver: APPROVER,
    approverOrgClass: 'customer',
    nominatedBy: NOMINATOR,
    correctedBy: CORRECTOR,
    holdsPromoteLearning: true,
    ...overrides,
  })
}

test('test_mayPromoteLearning_refuses_an_approver_who_does_not_hold_promote_learning', () => {
  const without = promotion({ holdsPromoteLearning: false })

  assert.equal(without.permitted, false)
  assert.equal(without.permitted === false && without.refusal, 'promoter_lacks_capability')
})

test('test_mayPromoteLearning_permits_the_same_approver_once_the_capability_is_held_so_the_check_is_not_unconditional', () => {
  /* THE PAIRED CONTROL. Everything except `holdsPromoteLearning` is identical
   * to the test above. A gate that refused unconditionally would pass that one
   * and fail this one. */
  const without = promotion({ holdsPromoteLearning: false })
  const with_ = promotion({ holdsPromoteLearning: true })

  assert.equal(without.permitted, false)
  assert.equal(with_.permitted, true)
})

test('test_mayPromoteLearning_still_refuses_a_platform_principal_holding_the_capability', () => {
  /* G128 ADDS an arm; it must not have replaced one. Holding the verb is not
   * the same question as belonging to the org that answers for the risk. */
  const platform = promotion({ approverOrgClass: 'platform', holdsPromoteLearning: true })

  assert.equal(platform.permitted, false)
  assert.equal(platform.permitted === false && platform.refusal, 'approver_not_customer_org')
})

test('test_mayPromoteLearning_still_refuses_self_approval_by_a_capable_customer_principal', () => {
  const asNominator = promotion({ approver: NOMINATOR })
  const asCorrector = promotion({ approver: CORRECTOR })

  assert.equal(asNominator.permitted === false && asNominator.refusal, 'self_approval')
  assert.equal(asCorrector.permitted === false && asCorrector.refusal, 'self_approval')
})

/* ------------------------------------------------------------------ *
 * G131 — the sixth dimension, and provenance
 * ------------------------------------------------------------------ */

const OBSERVED_ON = 'exc_residue_row_1' as ExceptionId

function described(
  value: string,
  observedOn: ExceptionId | null,
): ObservedScopeValue<NormalisedDescriptionValue> {
  return { value: value as NormalisedDescriptionValue, observedOn }
}

const UNCONSTRAINED = { kind: 'unconstrained' } as const

/**
 * THE PRODUCT OWNER'S OWN WORKED EXAMPLE, as a fixture.
 *
 * The residue population is BY DEFINITION the one with no counterparty
 * attributed — `ResidueCause` carries a dedicated `counterparty_unattributed`
 * arm (`model/reconciliation.ts:2048`) — so `counterpartyIds` cannot be
 * enumerated, and neither can the other three original identifying dimensions
 * for a row nobody could attribute. Before G131 this scope was refused
 * `scope_lacks_identifying_dimension`.
 */
function scope(overrides: Partial<LearningScope> = {}): LearningScope {
  return {
    counterpartyIds: UNCONSTRAINED,
    documentTypeIds: UNCONSTRAINED,
    definitionIds: UNCONSTRAINED,
    solutionIds: UNCONSTRAINED,
    dispositionFamilies: { kind: 'these', values: ['unidentified'] },
    normalisedDescriptions: {
      kind: 'these',
      values: [described('acme freight surcharge', OBSERVED_ON)],
    },
    ...overrides,
  }
}

/** Permissive on every axis this file is not examining. */
const EVIDENCE: NominationEvidence = {
  counterExampleInScope: () => true,
  counterExampleContradicts: () => true,
  countContradictingInScope: () => 0,
  searchWindowIsAdequate: () => true,
  hasLiveEntryCovering: () => false,
}

function nominate(s: LearningScope) {
  return validateNomination({
    correctionKind: 'divergent_disposition',
    hasAgentProposal: true,
    reversalIndicts: false,
    scope: s,
    reason: 'counterparty_pattern',
    destination: 'memory',
    counterExample: { kind: 'named', exceptionId: 'exc_counter_1' as ExceptionId },
    preferredDispositionKey: 'write_off',
    evidence: EVIDENCE,
  })
}

test('test_normalisedDescriptions_is_an_identifying_dimension_and_dispositionFamilies_is_still_not', () => {
  const dims: readonly string[] = IDENTIFYING_SCOPE_DIMENSIONS
  assert.equal(dims.includes('normalisedDescriptions'), true)
  /* The classifier stayed on the other side. `learning.ts:876-891` demands a
   * sixth dimension be placed DELIBERATELY, and placing this one identifying
   * only means something while the classifier remains excluded. */
  assert.equal(dims.includes('dispositionFamilies'), false)
})

test('test_a_residue_scope_with_no_counterparty_attributed_is_valid_once_descriptions_are_enumerated', () => {
  assert.deepEqual(nominate(scope()), { valid: true })
})

test('test_the_same_scope_without_the_sixth_dimension_is_still_refused_scope_lacks_identifying_dimension', () => {
  /* THE PAIRED CONTROL for the test above: one field flipped to
   * `unconstrained`, and the answer must move. If it does not, the previous
   * test is passing for some reason other than the new dimension. */
  const answer = nominate(scope({ normalisedDescriptions: UNCONSTRAINED }))

  assert.equal(answer.valid, false)
  assert.equal(answer.valid === false && answer.refusal, 'scope_lacks_identifying_dimension')
})

test('test_an_enumerated_description_with_no_provenance_is_refused', () => {
  const answer = nominate(
    scope({
      normalisedDescriptions: {
        kind: 'these',
        values: [described('acme freight surcharge', null)],
      },
    }),
  )

  assert.equal(answer.valid, false)
  assert.equal(answer.valid === false && answer.refusal, 'scope_value_lacks_provenance')
})

test('test_provenance_that_is_absent_from_the_payload_or_empty_is_refused_the_same_way', () => {
  /* THE WIRE CASE. `observedOn` is required-and-nullable, so the COMPILER
   * cannot be the control — a JSON body that omits the key yields `undefined`,
   * and one that carries `""` yields a branded string that is no row at all.
   * Both are cast in deliberately: this is the runtime the validator exists
   * for, and `HANDOFF` §5.10 is the reason a green `tsc` is not evidence here. */
  const missing = nominate(
    scope({
      normalisedDescriptions: {
        kind: 'these',
        values: [{ value: 'acme freight surcharge' } as ObservedScopeValue<NormalisedDescriptionValue>],
      },
    }),
  )
  const empty = nominate(
    scope({
      normalisedDescriptions: {
        kind: 'these',
        values: [described('acme freight surcharge', '' as ExceptionId)],
      },
    }),
  )

  assert.equal(missing.valid === false && missing.refusal, 'scope_value_lacks_provenance')
  assert.equal(empty.valid === false && empty.refusal, 'scope_value_lacks_provenance')
})

test('test_one_unprovenanced_value_among_provenanced_ones_refuses_the_whole_nomination', () => {
  /* Every value, not the first. A check that returned after inspecting
   * `values[0]` would pass a nomination whose second description was typed
   * from memory — which is the exact act G125 says must be checkable. */
  const answer = nominate(
    scope({
      normalisedDescriptions: {
        kind: 'these',
        values: [
          described('acme freight surcharge', OBSERVED_ON),
          described('acme fuel levy', null),
        ],
      },
    }),
  )

  assert.equal(answer.valid === false && answer.refusal, 'scope_value_lacks_provenance')
})

test('test_the_sixth_dimension_joined_the_existing_cardinality_and_emptiness_checks', () => {
  const empty = nominate(scope({ normalisedDescriptions: { kind: 'these', values: [] } }))
  assert.equal(empty.valid === false && empty.refusal, 'scope_dimension_empty')

  const over = nominate(
    scope({
      normalisedDescriptions: {
        kind: 'these',
        values: Array.from({ length: MAX_ENUMERATED_PER_DIMENSION + 1 }, (_, i) =>
          described(`description ${i}`, OBSERVED_ON),
        ),
      },
    }),
  )
  assert.equal(over.valid === false && over.refusal, 'scope_cardinality_exceeded')

  /* SENSITIVITY: exactly at the ceiling is permitted, so the refusal above is
   * the ceiling biting rather than the dimension being rejected outright. */
  const at = nominate(
    scope({
      normalisedDescriptions: {
        kind: 'these',
        values: Array.from({ length: MAX_ENUMERATED_PER_DIMENSION }, (_, i) =>
          described(`description ${i}`, OBSERVED_ON),
        ),
      },
    }),
  )
  assert.deepEqual(at, { valid: true })
})

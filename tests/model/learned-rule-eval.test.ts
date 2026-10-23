/**
 * G124, G125 and G131 made executable: does a promoted `LearningEntry` apply to
 * a given residue row?
 *
 * ------------------------------------------------------------------------
 * WHAT THE FIRST RED IN THIS FILE IS, AND WHAT IT IS NOT
 * ------------------------------------------------------------------------
 *
 * `entryAppliesToRow`, `ResidueRowFacts`, `SCOPE_DIMENSION_ORDER`,
 * `ROW_FACT_FOR_DIMENSION` and `SCOPE_MISS_CODES` did not exist when this file
 * was written. The first run's red is therefore ABSENCE — `TS2305`, "has no
 * exported member" — and absence proves nothing whatever about behaviour.
 *
 * So every assertion below is paired with a SENSITIVITY CONTROL in the same
 * test: the same call, one field changed, yielding a DIFFERENT answer. And the
 * four negative controls are additionally proved by MUTATION of the
 * implementation — each recorded in the task output — because they are all
 * absences, and an absence is the easiest thing to test dishonestly.
 *
 * ------------------------------------------------------------------------
 * THE RULING THIS FILE EXISTS TO PIN
 * ------------------------------------------------------------------------
 *
 * G125: a rule matches WHAT THE HUMAN WAS SHOWN — the enumerated values, and
 * nothing wider. There is no prefix match, no "starts with", no similarity, no
 * widening of any kind. G131 gives each enumerated description a provenance
 * reference so "was shown" is checkable rather than asserted.
 *
 * The test that carries the most weight is therefore
 * `..._a_one_character_variant_does_not`: one character is precisely the
 * generalisation the ruling forbids, and precisely the one a future reader will
 * be tempted to add on the day a bank changes a separator.
 *
 * G124/G130: no pattern is ever compiled. Asserted against the SOURCE of
 * `model/learning.ts` and of this file, not against the design.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  ROW_FACT_FOR_DIMENSION,
  SCOPE_DIMENSION_ORDER,
  SCOPE_MISS_CODES,
  entryAppliesToRow,
} from '../../model/learning.ts'
import type {
  LearningEntry,
  LearningScope,
  NormalisedDescriptionValue,
  ObservedScopeValue,
  ResidueRowFacts,
  ScopeMissCode,
} from '../../model/learning.ts'

/* ⚠️ RENAMED 9 Aug 2026, AND THE RENAME IS THE POINT, NOT COSMETIC.
 * `NormalisedDescriptionId` / `ResidueRowFacts.normalisedDescriptionId` are now
 * `NormalisedDescriptionValue` / `…normalisedDescriptionValue`. The old alias
 * was `Id<'NormalisedDescription'>`, a brand naming an interface that has never
 * existed — the model graph's ONE dangling edge, invisible to `tsc` because a
 * brand is a phantom type. It was retyped as a branded VALUE rather than
 * accompanied by a new entity: a normalised description is a derived, untimed
 * string, not a row. `tests/model/normalised-description.test.ts` holds the
 * proof and the negative controls; every G125 assertion in THIS file is
 * unchanged in substance and must stay green through the retype, which is what
 * makes it a regression test rather than a rename. */

/* Branded ids, derived from the declarations themselves rather than imported
 * separately — the same move `learning-promotion.test.ts` makes, and it keeps a
 * rename of the brand red here rather than silently green. */
type TenantId = LearningEntry['tenantId']
type EntryId = LearningEntry['id']
type NominationId = LearningEntry['nominationId']
type ExceptionId = Extract<LearningEntry['counterExample'], { kind: 'named' }>['exceptionId']
type CounterpartyId = NonNullable<ResidueRowFacts['counterpartyId']>
type DefinitionId = NonNullable<ResidueRowFacts['definitionId']>

/* ------------------------------------------------------------------ *
 * Fixtures. Everything cast at ONE seam, so no test body carries a cast.
 * ------------------------------------------------------------------ */

const SEEN_ON = 'exc_00001' as ExceptionId

/** The exact string the engine produced from a real row, as the human saw it. */
const SHOWN = 'acme freight surcharge' as NormalisedDescriptionValue
/** One character different. Nothing else. */
const ONE_CHARACTER_OFF = 'acme freight surcharg' as NormalisedDescriptionValue

function observed(
  value: NormalisedDescriptionValue,
  observedOn: ExceptionId | null = SEEN_ON,
): ObservedScopeValue<NormalisedDescriptionValue> {
  return { value, observedOn }
}

const UNCONSTRAINED = { kind: 'unconstrained' } as const

const BASE_SCOPE: LearningScope = {
  counterpartyIds: UNCONSTRAINED,
  documentTypeIds: UNCONSTRAINED,
  definitionIds: UNCONSTRAINED,
  solutionIds: UNCONSTRAINED,
  dispositionFamilies: UNCONSTRAINED,
  normalisedDescriptions: { kind: 'these', values: [observed(SHOWN)] },
}

function scope(over: Partial<LearningScope> = {}): LearningScope {
  return { ...BASE_SCOPE, ...over }
}

function entry(over: Partial<LearningEntry> = {}): LearningEntry {
  return {
    tenantId: 'ten_acme' as TenantId,
    id: 'lrn_0001' as EntryId,
    nominationId: 'lnm_0001' as NominationId,
    destination: 'memory',
    scope: BASE_SCOPE,
    reason: 'counterparty_pattern',
    preferredDispositionKey: 'timing_difference',
    counterExample: { kind: 'named', exceptionId: SEEN_ON },
    dataClass: 'internal',
    status: 'active',
    effectiveUntil: '2026-12-31T00:00:00Z' as LearningEntry['effectiveUntil'],
    promotedAt: '2026-08-09T00:00:00Z' as LearningEntry['promotedAt'],
    ...over,
  }
}

const EMPTY_ROW: ResidueRowFacts = {
  counterpartyId: null,
  documentTypeId: null,
  definitionId: null,
  solutionId: null,
  dispositionFamily: null,
  normalisedDescriptionValue: null,
}

function row(over: Partial<ResidueRowFacts> = {}): ResidueRowFacts {
  return { ...EMPTY_ROW, ...over }
}

/* ================================================================== *
 * 1. G125 — the enumerated value, and nothing wider
 * ================================================================== */

test('test_an_exactly_enumerated_normalised_description_applies_and_a_one_character_variant_does_not', () => {
  const e = entry()

  /* POSITIVE. The value the human was shown, verbatim. */
  const hit = entryAppliesToRow(e, row({ normalisedDescriptionValue: SHOWN }))
  assert.equal(hit.applies, true)
  assert.deepEqual(hit.applies === true ? hit.boundDimensions : null, ['normalisedDescriptions'])

  /* THE RULING. One character shorter. Not a prefix match, not a near match,
   * not a match. If `entryAppliesToRow` ever grows `startsWith`, similarity, or
   * a compiled pattern, THIS is the line that goes red. */
  const miss = entryAppliesToRow(e, row({ normalisedDescriptionValue: ONE_CHARACTER_OFF }))
  assert.equal(miss.applies, false)
  assert.equal(miss.applies === false ? miss.code : null, 'value_not_enumerated')
  assert.equal(miss.applies === false ? miss.dimension : null, 'normalisedDescriptions')

  /* AND THE VARIANT IS A GENUINE ONE-CHARACTER DELTA, asserted rather than
   * eyeballed — otherwise the test above could be passing because the two
   * fixtures are wildly different strings. */
  assert.equal(String(SHOWN).length - String(ONE_CHARACTER_OFF).length, 1)
  assert.equal(String(SHOWN).startsWith(String(ONE_CHARACTER_OFF)), true)

  /* SENSITIVITY, the other way: a variant one character LONGER, of which the
   * enumerated value is the prefix. Both directions of "starts with" are
   * refused, because only one of them would be caught by the test above. */
  const longer = entryAppliesToRow(
    e,
    row({ normalisedDescriptionValue: 'acme freight surcharges' as NormalisedDescriptionValue }),
  )
  assert.equal(longer.applies, false)
  assert.equal(longer.applies === false ? longer.code : null, 'value_not_enumerated')

  /* And case is not folded here either. Normalisation happened upstream, in the
   * engine, under a declared `IdentifierNormalisation`; this evaluator compares
   * the RESULT and performs no transform of its own. */
  const cased = entryAppliesToRow(
    e,
    row({ normalisedDescriptionValue: 'ACME FREIGHT SURCHARGE' as NormalisedDescriptionValue }),
  )
  assert.equal(cased.applies, false)
})

/* ================================================================== *
 * 2. The row lacks the dimension the scope names
 * ================================================================== */

test('test_a_scope_that_names_a_dimension_the_row_lacks_does_not_apply_and_names_that_dimension', () => {
  /* The residue population is BY DEFINITION the one nothing could be attributed
   * to — `ResidueCause` carries `counterparty_unattributed`. So a row with no
   * counterparty is the COMMON case, not the exotic one, and a scope naming
   * counterparties must miss it rather than fall through to a default. */
  const e = entry({
    scope: scope({
      counterpartyIds: { kind: 'these', values: ['ctp_acme' as CounterpartyId] },
    }),
  })

  const miss = entryAppliesToRow(e, row({ normalisedDescriptionValue: SHOWN, counterpartyId: null }))
  assert.equal(miss.applies, false)
  assert.equal(miss.applies === false ? miss.code : null, 'row_lacks_dimension')
  /* IT NAMES WHICH ONE. A bare `false` here would be `HANDOFF` §5.2 — a
   * reasoned result reduced to a boolean nobody can queue on. */
  assert.equal(miss.applies === false ? miss.dimension : null, 'counterpartyIds')

  /* SENSITIVITY: supply the counterparty and the SAME entry applies. Without
   * this the refusal above could be unconditional. */
  const hit = entryAppliesToRow(
    e,
    row({ normalisedDescriptionValue: SHOWN, counterpartyId: 'ctp_acme' as CounterpartyId }),
  )
  assert.equal(hit.applies, true)
  assert.deepEqual(hit.applies === true ? hit.boundDimensions : null, [
    'counterpartyIds',
    'normalisedDescriptions',
  ])

  /* SENSITIVITY, second: present but a DIFFERENT counterparty is a
   * `value_not_enumerated`, never a `row_lacks_dimension`. Two distinct facts
   * about the row, and collapsing them would misreport why a rule did not fire. */
  const other = entryAppliesToRow(
    e,
    row({ normalisedDescriptionValue: SHOWN, counterpartyId: 'ctp_other' as CounterpartyId }),
  )
  assert.equal(other.applies, false)
  assert.equal(other.applies === false ? other.code : null, 'value_not_enumerated')
  assert.equal(other.applies === false ? other.dimension : null, 'counterpartyIds')
})

/* ================================================================== *
 * 3. G131 — a value with no provenance cannot participate
 * ================================================================== */

test('test_an_enumerated_value_without_provenance_cannot_participate', () => {
  /* `validateNomination()` refuses this at promotion time. This is the SECOND
   * gate, and it exists because a promoted entry reaches the evaluator as a row
   * out of a database, not as a value the compiler ever saw — the same reason
   * `validateNomination()` widens its own check past the declared type. */
  const noProvenance = entry({
    scope: scope({
      normalisedDescriptions: { kind: 'these', values: [observed(SHOWN, null)] },
    }),
  })

  /* THE ROW MATCHES THE VALUE EXACTLY. It still does not apply — the value was
   * never shown to anybody, so it is not a value the rule may match on. */
  const miss = entryAppliesToRow(noProvenance, row({ normalisedDescriptionValue: SHOWN }))
  assert.equal(miss.applies, false)
  assert.equal(miss.applies === false ? miss.code : null, 'value_lacks_provenance')
  assert.equal(miss.applies === false ? miss.dimension : null, 'normalisedDescriptions')

  /* SENSITIVITY: the identical entry WITH provenance applies. This is what
   * proves the refusal above is conditional on `observedOn` and not on
   * something else about the fixture. */
  const withProvenance = entryAppliesToRow(entry(), row({ normalisedDescriptionValue: SHOWN }))
  assert.equal(withProvenance.applies, true)

  /* THE TWO WIRE SHAPES THE TYPE DOES NOT CONTAIN, cast in deliberately.
   * `observedOn` is declared `ExceptionId | null`, so `undefined` is outside
   * the type — but a JSON body that omits the key produces exactly that, and an
   * empty string is a branded id pointing at no row. Both are the same refusal,
   * and `tsc` cannot be the thing that catches either. */
  for (const absent of [undefined, ''] as readonly unknown[]) {
    const wire = entry({
      scope: scope({
        normalisedDescriptions: {
          kind: 'these',
          values: [{ value: SHOWN, observedOn: absent } as ObservedScopeValue<NormalisedDescriptionValue>],
        },
      }),
    })
    const r = entryAppliesToRow(wire, row({ normalisedDescriptionValue: SHOWN }))
    assert.equal(r.applies, false)
    assert.equal(r.applies === false ? r.code : null, 'value_lacks_provenance')
  }

  /* AND ONE BAD VALUE POISONS THE DIMENSION, it does not merely drop out of the
   * set. A scope carrying a value nobody can show a human was shown is not a
   * scope whose remaining values can be trusted, and refusing the whole
   * dimension NARROWS behaviour — the direction this module's own note calls
   * the only safe one. */
  const mixed = entry({
    scope: scope({
      normalisedDescriptions: {
        kind: 'these',
        values: [observed(SHOWN), observed(ONE_CHARACTER_OFF, null)],
      },
    }),
  })
  const poisoned = entryAppliesToRow(mixed, row({ normalisedDescriptionValue: SHOWN }))
  assert.equal(poisoned.applies, false)
  assert.equal(poisoned.applies === false ? poisoned.code : null, 'value_lacks_provenance')
})

/* ================================================================== *
 * 4. §5.5 polarity — emptiness matches NOTHING
 * ================================================================== */

test('test_an_empty_enumerated_set_matches_nothing_rather_than_everything', () => {
  /* `[].some(...)` is `false` and `[].every(...)` is `true`. The second is the
   * polarity error, and it would apply the rule to EVERY residue row in the
   * tenant while every type in sight stayed green. */
  const empty = entry({
    scope: scope({ normalisedDescriptions: { kind: 'these', values: [] } }),
  })

  const miss = entryAppliesToRow(empty, row({ normalisedDescriptionValue: SHOWN }))
  assert.equal(miss.applies, false)
  assert.equal(miss.applies === false ? miss.code : null, 'dimension_enumerates_nothing')
  assert.equal(miss.applies === false ? miss.dimension : null, 'normalisedDescriptions')

  /* And it is refused for a row that carries NOTHING too. An empty enumeration
   * is not "unconstrained" under another name. */
  const alsoMiss = entryAppliesToRow(empty, row())
  assert.equal(alsoMiss.applies, false)
  assert.equal(alsoMiss.applies === false ? alsoMiss.code : null, 'dimension_enumerates_nothing')

  /* SENSITIVITY: one value in the list and the same row applies. */
  assert.equal(entryAppliesToRow(entry(), row({ normalisedDescriptionValue: SHOWN })).applies, true)
})

test('test_a_scope_unconstrained_on_every_dimension_matches_nothing_rather_than_everything', () => {
  /* `validateNomination()` refuses `scope_unbounded` at promotion. This is the
   * same polarity asserted at the OTHER end, because the evaluator reads a
   * stored row and not a validated payload: a conjunction over zero clauses is
   * vacuously TRUE, which here means "apply this learning to every row in the
   * tenant". Fail closed. */
  const unbounded = entry({
    scope: {
      counterpartyIds: UNCONSTRAINED,
      documentTypeIds: UNCONSTRAINED,
      definitionIds: UNCONSTRAINED,
      solutionIds: UNCONSTRAINED,
      dispositionFamilies: UNCONSTRAINED,
      normalisedDescriptions: UNCONSTRAINED,
    },
  })

  const miss = entryAppliesToRow(unbounded, row({ normalisedDescriptionValue: SHOWN }))
  assert.equal(miss.applies, false)
  assert.equal(miss.applies === false ? miss.code : null, 'scope_binds_nothing')
  /* No dimension is at fault; the SCOPE is. Null, not a convenient landmark. */
  assert.equal(miss.applies === false ? miss.dimension : null, null)

  /* SENSITIVITY: bind exactly one dimension and it applies. */
  assert.equal(entryAppliesToRow(entry(), row({ normalisedDescriptionValue: SHOWN })).applies, true)
})

/* ================================================================== *
 * 5. Conjunction, and the reasoned true arm
 * ================================================================== */

test('test_every_bound_dimension_must_hold_and_the_true_arm_names_which_bound_it', () => {
  const e = entry({
    scope: scope({
      counterpartyIds: { kind: 'these', values: ['ctp_acme' as CounterpartyId] },
      definitionIds: { kind: 'these', values: ['def_ap' as DefinitionId] },
      dispositionFamilies: { kind: 'these', values: ['timing_difference'] },
    }),
  })

  const all = row({
    normalisedDescriptionValue: SHOWN,
    counterpartyId: 'ctp_acme' as CounterpartyId,
    definitionId: 'def_ap' as DefinitionId,
    dispositionFamily: 'timing_difference',
  })

  const hit = entryAppliesToRow(e, all)
  assert.equal(hit.applies, true)
  /* CONJOINED, and the true arm says which four clauses carried it — in the
   * declared dimension order, so the answer is stable enough to assert. */
  assert.deepEqual(hit.applies === true ? hit.boundDimensions : null, [
    'counterpartyIds',
    'definitionIds',
    'dispositionFamilies',
    'normalisedDescriptions',
  ])

  /* CONJOINED, NEVER DISJOINED: break exactly one clause at a time and every
   * one of them must refuse on its own. A disjunction would pass three of these
   * four. */
  const breaks: readonly (readonly [Partial<ResidueRowFacts>, string])[] = [
    [{ counterpartyId: 'ctp_other' as CounterpartyId }, 'counterpartyIds'],
    [{ definitionId: 'def_other' as DefinitionId }, 'definitionIds'],
    [{ dispositionFamily: 'in_transit' }, 'dispositionFamilies'],
    [{ normalisedDescriptionValue: ONE_CHARACTER_OFF }, 'normalisedDescriptions'],
  ]
  for (const [override, dimension] of breaks) {
    const r = entryAppliesToRow(e, { ...all, ...override })
    assert.equal(r.applies, false, `expected a refusal when ${dimension} was broken`)
    assert.equal(r.applies === false ? r.dimension : null, dimension)
    assert.equal(r.applies === false ? r.code : null, 'value_not_enumerated')
  }
})

test('test_a_non_active_entry_never_applies_whatever_the_row_says', () => {
  const matching = row({ normalisedDescriptionValue: SHOWN })
  /* Positive control first: the entry differs from the three below in ONE
   * field. */
  assert.equal(entryAppliesToRow(entry({ status: 'active' }), matching).applies, true)

  for (const status of ['suspended', 'expired', 'purged'] as const) {
    const r = entryAppliesToRow(entry({ status }), matching)
    assert.equal(r.applies, false, `a ${status} entry must not apply`)
    assert.equal(r.applies === false ? r.code : null, 'entry_not_active')
    assert.equal(r.applies === false ? r.dimension : null, null)
  }
})

/* ================================================================== *
 * 6. G124/G130 — no pattern is ever compiled
 * ================================================================== */

const LEARNING_SRC = readFileSync(
  fileURLToPath(new URL('../../model/learning.ts', import.meta.url)),
  'utf8',
)
const THIS_SRC = readFileSync(fileURLToPath(import.meta.url), 'utf8')

/**
 * ⚠️ THE NEEDLE IS BUILT AT RUNTIME AND THAT IS NOT A FLOURISH — IT IS A BUG
 * THIS TEST ALREADY HAD.
 *
 * The first version wrote the token as a literal and then asked whether THIS
 * file contained it. It always did: the literal was the occurrence. The test
 * went red on its first run for that reason and the red was the test's fault,
 * not the implementation's. A scanner that cannot be run over its own source is
 * a scanner nobody will run over the next file either.
 */
const COMPILED_PATTERN_TOKEN = 'Reg' + 'Exp'

test('test_no_pattern_is_compiled_and_no_widening_operator_appears_in_model_learning_ts', () => {
  /* THE ASSERTION IS AGAINST THE SOURCE, not against the design. G124/G130 say
   * the rule is a composition of declarative ops and no pattern is ever
   * compiled; a docblock saying so is `HANDOFF` §5.6 — a control that passes
   * while asserting nothing. */
  assert.equal(
    LEARNING_SRC.includes(COMPILED_PATTERN_TOKEN),
    false,
    'model/learning.ts must compile no pattern',
  )
  /* The three widening operators, by name. `===` is the whole semantics; each
   * of these is a way of matching a value the human was never shown. */
  assert.equal(LEARNING_SRC.includes('.startsWith('), false)
  assert.equal(LEARNING_SRC.includes('.endsWith('), false)
  assert.equal(LEARNING_SRC.includes('.localeCompare('), false)

  /* THE CONTROL ON THE CONTROL. Four `false`s are also what an empty string
   * returns, and a mis-resolved path yields exactly that. Prove the same reader
   * finds text it must find, in the section under test. */
  assert.equal(LEARNING_SRC.includes('entryAppliesToRow'), true)
  assert.equal(LEARNING_SRC.includes('SCOPE_DIMENSION_ORDER'), true)
  assert.ok(LEARNING_SRC.length > 10_000)

  /* And this file compiles none either. `.startsWith(` DOES appear above — in
   * the assertions proving the two fixtures are one character apart — so it is
   * deliberately not asserted absent here; it never participates in a matching
   * decision, and the tests below would go red if it did. */
  assert.equal(THIS_SRC.includes(COMPILED_PATTERN_TOKEN), false)
  /* SENSITIVITY on the self-scan: the same reader over the same string finds a
   * token that IS present. Without this line the assertion above would agree
   * with an unread file. */
  assert.equal(THIS_SRC.includes(COMPILED_PATTERN_TOKEN.slice(0, 3)), true)
})

/* ================================================================== *
 * 7. The dimension-to-row-fact join is total
 * ================================================================== */

test('test_the_dimension_to_row_fact_join_is_total_over_every_declared_scope_dimension', () => {
  /* `ROW_FACT_FOR_DIMENSION` is a total `Record` and the module CONSTRUCTS one
   * at its declaration site, so a seventh dimension is a compile error there.
   * That is a real bite and not the `HANDOFF` §5.10 shape — but the compiler
   * cannot check that each key maps to a field that EXISTS on a row, so this
   * test does. */
  assert.equal(SCOPE_DIMENSION_ORDER.length, Object.keys(ROW_FACT_FOR_DIMENSION).length)
  for (const dimension of SCOPE_DIMENSION_ORDER) {
    const fact = ROW_FACT_FOR_DIMENSION[dimension]
    assert.equal(
      Object.prototype.hasOwnProperty.call(EMPTY_ROW, fact),
      true,
      `${dimension} maps to ${String(fact)}, which is not a field on a residue row`,
    )
    /* And the scope carries the dimension it claims to. */
    assert.equal(Object.prototype.hasOwnProperty.call(BASE_SCOPE, dimension), true)
  }

  /* Every code this evaluator can return is a member of the closed set, so a
   * refusal is reportable rather than a sentence. */
  const codes: readonly string[] = Object.values(SCOPE_MISS_CODES)
  const observedCodes: readonly ScopeMissCode[] = [
    'entry_not_active',
    'scope_binds_nothing',
    'dimension_enumerates_nothing',
    'row_lacks_dimension',
    'value_not_enumerated',
    'value_lacks_provenance',
  ]
  for (const c of observedCodes) assert.equal(codes.includes(c), true, `${c} is not in the closed set`)
  assert.equal(codes.length, observedCodes.length)
  /* SENSITIVITY on the membership test itself. */
  assert.equal(codes.includes('probably_applies'), false)
})

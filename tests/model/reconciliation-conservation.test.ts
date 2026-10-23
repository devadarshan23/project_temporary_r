/**
 * THE FIRST CONSTRUCTION SITE FOR `SetReconciliationInput`.
 *
 * `model/reconciliation.ts` landed with 2,779 lines and nothing anywhere
 * constructing its input, which is `docs/HANDOFF.md` §5.10 at the largest scale
 * in this repository: a total record with no construction site witnesses its
 * SHAPE and nothing about its CONTENT. This file constructs one and asserts what
 * the engine does with it.
 *
 * WHAT IS UNDER TEST, AND WHY THESE TWO THINGS.
 *
 *   1. RESIDUE COMPLETENESS. The red team killed the module's first
 *      post-condition as `gross = gross` — a §5.6 rule that cannot fail on any
 *      input, because residual is DERIVED by folding allocations. The
 *      replacements are `open_item_missing_from_residue` and
 *      `gross_not_partitioned` (`model/reconciliation.ts:2490,2494`). This file
 *      shows each of them FIRING, and shows each firing WITHOUT the other, which
 *      is what distinguishes two checks from one check written twice.
 *
 *   2. A9(b), the money-loss bug the engine exists to prevent. The draft
 *      consumed every payment in an N:M group even when cash was left over,
 *      recorded the leftover as a `variance` field and marked the payments
 *      spent. Money disappeared. The claim under test is that leftover cash
 *      stays OPEN and lands in the residue as a residual.
 *
 * NEGATIVE CONTROLS, because a green assertion is not automatically evidence.
 *
 *   · EVERY EXPECTED TOTAL BELOW IS A LITERAL TYPED INTO THIS FILE. Not one is
 *     re-derived from `allocatedOf`, `residualOf`, `settlementOf` or `sumGross`
 *     — the same folds the engine uses. A total compared against the fold that
 *     produced it is a constant compared to itself.
 *   · The leftover is asserted BY AMOUNT AND BY `ItemRef`, never by a count of
 *     residue rows. A count passes while the wrong row is present.
 *   · The residue entry's FULL KEY SET is asserted, so a re-introduced
 *     `variance` field is a failure rather than something an assertion happens
 *     not to look at.
 *   · The post-conditions are shown failing on a damaged residue and passing on
 *     the intact one, in the same test, so the pass is attributable.
 *
 * ⚠️ WHAT THIS FILE DOES NOT DO. It does not price anything. Invariant 5 —
 * `UsageRecord` is immutable and unpriced — so `meterFacts` are asserted for
 * nothing here beyond existing, and no rate, price or cost is read.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  checkPostconditions,
  itemKey,
  runSetReconciliation,
} from '../../model/reconciliation.ts'
import type {
  AdmittedItem,
  ItemSettlement,
  MatchingState,
  PopulationBinding,
  PopulationSide,
  ResidueEntry,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import { DISPOSITION_FAMILIES } from '../../model/domain.ts'
import type {
  DataClass,
  ExtractedScalar,
  ExtractedValue,
  Money,
  PairingStrategy,
  SourceDocument,
} from '../../model/domain.ts'
import type {
  DocumentTypeId,
  FieldPath,
  FieldPathKey,
  RunId,
  SourceDocumentId,
  TenantId,
} from '../../model/kernel.ts'
import { parseFieldPath, fieldPathKey } from '../../model/field-path.ts'

/* ------------------------------------------------------------------ *
 * G214 — a `FieldPath` is a structured token list, minted only by the seam.
 *
 * ⚠️ EVERY PATH IN THIS FILE WAS A BARE STRING UNTIL 22 Aug 2026 and addressed
 * nothing: `FieldPath` was `= string`. `p()` is the fixture-only unwrap — the
 * seam refuses rather than throwing because a path from a document is a runtime
 * condition, while a path written HERE is a literal and a refusal is a defect in
 * this file. `k()` is the identity token a path takes when it keys a collection,
 * because a path is an ARRAY and an array keys a `Map` by reference.
 * ------------------------------------------------------------------ */
function p(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`fixture declares an unparseable FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}
const k = (path: FieldPath): FieldPathKey => fieldPathKey(path)

/* -------------------------------------------------------------------- *
 * The fixture. One tenant, one currency, header-grain documents.
 * -------------------------------------------------------------------- */

const TENANT = 'tenant-recon-fixture' as TenantId
const DOC_TYPE = 'doctype-recon-fixture' as DocumentTypeId

const AMOUNT_PATH: FieldPath = p('amount')
const DATE_PATH: FieldPath = p('date')
const REF_PATH: FieldPath = p('reference')
const PARTY_PATH: FieldPath = p('counterparty')

/** Every path the engine reads must be classified, or G106 refuses it. */
const CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<FieldPathKey, DataClass>([
  [k(AMOUNT_PATH), 'internal'],
  [k(DATE_PATH), 'internal'],
  [k(REF_PATH), 'internal'],
  [k(PARTY_PATH), 'internal'],
])

interface Row {
  readonly docId: string
  /** Minor units. SGD, exponent 2 — so 10000 is one hundred dollars. */
  readonly minor: bigint
  readonly date: string
  readonly reference: string
  readonly party: string
}

/** Obligations. 100.00 then 50.00 — 15000 minor units between them. */
const OBLIGATION_ONE: Row = {
  docId: 'doc-obligation-1',
  minor: 10000n,
  date: '2026-01-10',
  reference: 'OBL-1',
  party: 'PARTY-A',
}
const OBLIGATION_TWO: Row = {
  docId: 'doc-obligation-2',
  minor: 5000n,
  date: '2026-01-20',
  reference: 'OBL-2',
  party: 'PARTY-A',
}
/** One cash item of 200.00 against 150.00 of obligations. 5000 is left over. */
const CASH: Row = {
  docId: 'doc-cash-1',
  minor: 20000n,
  date: '2026-02-01',
  reference: 'CASH-1',
  party: 'PARTY-A',
}
/** A zero-amount obligation. Open, unpairable, and worth no money at all. */
const ZERO_OBLIGATION: Row = {
  docId: 'doc-obligation-zero',
  minor: 0n,
  date: '2026-01-05',
  reference: 'OBL-0',
  party: 'PARTY-A',
}

function value(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

function documentOf(row: Row): SourceDocument {
  return {
    tenantId: TENANT,
    id: row.docId as SourceDocumentId,
    documentTypeId: DOC_TYPE,
    filename: `${row.docId}.csv`,
    storageRef: `fixture://${row.docId}`,
    extracted: {
      [k(AMOUNT_PATH)]: value({
        kind: 'money',
        value: { currency: 'SGD', amountMinor: row.minor, exponent: 2 },
      }),
      [k(DATE_PATH)]: value({ kind: 'date', value: row.date }),
      [k(REF_PATH)]: value({ kind: 'identifier', value: row.reference }),
      [k(PARTY_PATH)]: value({ kind: 'identifier', value: row.party }),
    },
    lines: [],
    /* C18. These fixtures are hand-built rows, not files: there is no trailer to
     * find and none is expected. The OFF arm, stated rather than defaulted. */
    controlTotal: { kind: 'not_declared_by_format' },
    ingestedAt: '2026-02-02T00:00:00.000Z',
    synthetic: true,
    purgeAfter: '2027-02-02T00:00:00.000Z',
    purgedAt: null,
  }
}

/**
 * Both sides name the same paths. `counterparty` is non-null on both, which is
 * what lets `amount_sum` run at all — `counterparty: null` means the definition
 * has not asked for N:M and pass 4 does not run.
 */
function population(): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE,
      amount: AMOUNT_PATH,
      date: DATE_PATH,
      identifiers: [REF_PATH],
    },
    /* C16 — the denomination is DECLARED, never seeded from row one. Every row
     * in this fixture is SGD at exponent 2, so nothing here moves; the field is
     * required and non-null, which is the ruling. */
    /* C18. These fixtures build rows by hand; the format they stand in for
     * carries no trailer, so the TYPE says so too and the parser's arm agrees. */
    carriesControlTotal: 'never',
    /* O-15. Every fixture in this file hands the engine rows, so `'refuses'` is
     * the truthful declaration and the posture at the same time. */
    emptyExpectation: 'refuses',
    declaredUnit: { currency: 'SGD', exponent: 2 },
    normalisation: { ops: [], then: 'exact', maxInputChars: 64 },
    counterparty: PARTY_PATH,
    description: null,
  }
}

/**
 * One strategy — `amount_sum` — so the behaviour under test is the N:M waterfall
 * and nothing else. The `PairingStrategy` object is shared between
 * `pairing.strategies` and `strategyBindings` because `bindingsAgree()` refuses
 * a binding list whose kinds do not match the spec, position for position.
 */
function inputOf(left: readonly Row[], right: readonly Row[]): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'amount_sum', maxMembers: 4 }
  return {
    runId: 'run-recon-fixture' as RunId,
    tenantId: TENANT,
    left: population(),
    right: population(),
    leftDocuments: left.map(documentOf),
    rightDocuments: right.map(documentOf),
    pairing: {
      cardinality: 'many_to_many',
      amountTolerance: { kind: 'rounding', minorUnits: 0 },
      dateTolerance: { kind: 'days', value: 0 },
      strategies: [strategy],
    },
    strategyBindings: [{ strategy, amountTolerance: null, amountAnchor: 'exact' }],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    fieldClassification: CLASSIFICATION,
    modelPromptEligible: new Set<FieldPathKey>(),
    /* G227. No floor stated. */
    confidenceFloors: new Map<FieldPathKey, number>(),
    subsetSumBound: { maxMembers: 4, stepBudget: 1000, maxBucketSize: 50 },
    readerCandidateCap: 4,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    /* C13. Stated rather than defaulted, like the three bounds above it. These
     * fixtures admit every row they present, so no rate is anywhere near it —
     * the value is here because the engine refuses a run that does not state
     * one, and 2500 is a fixture choice with nothing behind it. */
    admissionRefusalCeilingBasisPoints: 2500,
  }
}

function runOrFail(left: readonly Row[], right: readonly Row[]): SetReconciliationResult {
  const outcome = runSetReconciliation(inputOf(left, right))
  assert.ok(
    outcome.ok,
    `the engine refused the fixture: ${outcome.ok ? '' : outcome.refusal.kind}`,
  )
  return outcome.result
}

function residueFor(
  residue: readonly ResidueEntry[],
  side: PopulationSide,
  docId: string,
): readonly ResidueEntry[] {
  return residue.filter((e) => e.side === side && e.ref.sourceDocumentId === docId)
}

/** Narrows, and reports the settlement it actually found when it does not. */
function partOf(settlement: ItemSettlement | null): {
  readonly allocated: Money
  readonly residual: Money
} {
  assert.ok(
    settlement !== null && settlement.kind === 'partially_allocated',
    `expected partially_allocated, found ${settlement === null ? 'null' : settlement.kind}`,
  )
  return { allocated: settlement.allocated, residual: settlement.residual }
}

/* ==================================================================== *
 * 1. The construction site itself
 * ==================================================================== */

test('test_the_engine_admits_the_fixture_and_reports_no_postcondition_failure', () => {
  const result = runOrFail([OBLIGATION_ONE, OBLIGATION_TWO], [CASH])

  /* If admission had refused anything, the item would never reach the ledger
   * and every later assertion about the residue would be about the wrong row. */
  assert.deepEqual(result.refusedAtAdmission, [])
  assert.equal(result.state.items.size, 3)
  assert.deepEqual(result.postconditions, [])
  assert.deepEqual(result.ambiguities, [])
  assert.deepEqual(result.toleranceRefusals, [])
  /* G217 — the boundary channel replaced two arrays of counterparty-authored
   * bucket keys. Empty on this fixture, on all three grains. */
  assert.deepEqual(result.searchBoundary, {
    oversizedBuckets: [],
    exhaustedSearches: [],
    oversizedAmountBuckets: [],
  })
})

/* ==================================================================== *
 * 2. A9(b) — the leftover is RESIDUE, not a variance field
 * ==================================================================== */

test('test_leftover_cash_appears_in_the_residue_exactly_once_addressed_by_its_own_ref', () => {
  const result = runOrFail([OBLIGATION_ONE, OBLIGATION_TWO], [CASH])

  const forCash = residueFor(result.residue, 'right', CASH.docId)
  assert.equal(forCash.length, 1)
  const entry = forCash[0]
  assert.ok(entry !== undefined)
  assert.equal(entry.ref.sourceDocumentId, CASH.docId)
  assert.equal(entry.ref.lineIndex, null)

  /* And the obligations, which were fully settled, are NOT in the residue. A
   * residue containing a closed item is `fully_allocated_item_in_residue`. */
  assert.equal(residueFor(result.residue, 'left', OBLIGATION_ONE.docId).length, 0)
  assert.equal(residueFor(result.residue, 'left', OBLIGATION_TWO.docId).length, 0)
})

test('test_the_leftover_is_carried_as_a_residual_of_five_thousand_minor_units', () => {
  const result = runOrFail([OBLIGATION_ONE, OBLIGATION_TWO], [CASH])
  const entry = residueFor(result.residue, 'right', CASH.docId)[0]
  assert.ok(entry !== undefined)

  const { allocated, residual } = partOf(entry.settlement)

  /* 20000 of cash met 15000 of obligations. Every figure here is a literal:
   * 15000 spent, 5000 left, in SGD at exponent 2. None is read back out of the
   * fold that produced it. */
  assert.equal(allocated.amountMinor, 15000n)
  assert.equal(allocated.currency, 'SGD')
  assert.equal(allocated.exponent, 2)
  assert.equal(residual.amountMinor, 5000n)
  assert.equal(residual.currency, 'SGD')
  assert.equal(residual.exponent, 2)
})

test('test_the_leftover_carries_a_declared_set_reconciliation_disposition_and_no_variance_field', () => {
  const result = runOrFail([OBLIGATION_ONE, OBLIGATION_TWO], [CASH])
  const entry = residueFor(result.residue, 'right', CASH.docId)[0]
  assert.ok(entry !== undefined)

  assert.equal(entry.disposition, 'unidentified')
  assert.equal(entry.cause.kind, 'cash_exceeded_obligations')

  /* Cross-checked against the model's own family list rather than against the
   * literal alone: the engine may only ever assign a member of
   * `DISPOSITION_FAMILIES.set_reconciliation`. */
  const declared: readonly string[] = DISPOSITION_FAMILIES.set_reconciliation
  assert.ok(
    declared.includes(entry.disposition),
    `${entry.disposition} is not a declared set_reconciliation disposition`,
  )

  /* THE A9(b) CONTROL. The draft recorded the leftover as a `variance` field on
   * the match and marked the payment spent. Asserting the whole key set — not
   * just the absence of one name — means any future field carrying the leftover
   * outside the settlement is a failure here. */
  /* ⚠️ `heldReads` JOINED THIS SET ON 23 Aug 2026 — G227 — AND IT DOES NOT
   * WEAKEN THE CONTROL. It is empty here: no field on this run declares a
   * confidence floor, so no read was held. What matters for A9(b) is that it
   * carries a REFERENCE and two numbers and never an amount — the leftover
   * still lives in `settlement` and nowhere else. */
  assert.deepEqual(Object.keys(entry).sort(), [
    'cause',
    'disposition',
    'heldReads',
    'ref',
    'settlement',
    'side',
  ])
  assert.deepEqual(entry.heldReads, [])
})

test('test_the_cash_item_is_not_marked_spent_and_stays_open_in_the_ledger', () => {
  const result = runOrFail([OBLIGATION_ONE, OBLIGATION_TWO], [CASH])

  const key = itemKey('right', {
    sourceDocumentId: CASH.docId as SourceDocumentId,
    lineIndex: null,
  })
  const item = result.state.items.get(key)
  assert.ok(item !== undefined)
  assert.equal(item.gross.amountMinor, 20000n)

  /* Two allocations left this item, 10000 and 5000, oldest obligation first —
   * both figures literals, and their sum is 5000 short of the 20000 that came
   * in. That shortfall is the residue row asserted above. */
  const out = result.state.allocations.filter((a) => a.fromKey === key)
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((a) => a.amount.amountMinor), [10000n, 5000n])
  assert.deepEqual(
    out.map((a) => a.evidence.kind),
    ['amount_sum_waterfall', 'amount_sum_waterfall'],
  )
})

/* ==================================================================== *
 * 3. The post-conditions are not tautologies — each one FIRES
 * ==================================================================== */

test('test_dropping_the_open_cash_item_from_the_residue_fires_open_item_missing_from_residue', () => {
  const result = runOrFail([OBLIGATION_ONE, OBLIGATION_TWO], [CASH])

  /* The control half: over the residue the engine actually produced, nothing
   * fires. So the failure below is attributable to the drop and to nothing
   * else about the fixture. */
  assert.deepEqual(checkPostconditions(result.state, result.residue, result.admissionRates), [])

  /* THE DROP. This is A9(b) simulated exactly: the item is gone from the
   * residue and the ledger is untouched, so `gross = residual + Σ allocations`
   * — the post-condition the red team killed — still holds. */
  const damaged = result.residue.filter((e) => e.ref.sourceDocumentId !== CASH.docId)
  assert.equal(damaged.length, result.residue.length - 1)

  const failures = checkPostconditions(result.state, damaged, result.admissionRates)
  const missing = failures.filter((f) => f.kind === 'open_item_missing_from_residue')
  assert.deepEqual(missing, [{ kind: 'open_item_missing_from_residue', count: 1 }])
})

test('test_the_same_drop_fires_gross_not_partitioned_with_the_five_thousand_that_vanished', () => {
  const result = runOrFail([OBLIGATION_ONE, OBLIGATION_TWO], [CASH])
  const damaged = result.residue.filter((e) => e.ref.sourceDocumentId !== CASH.docId)

  const failures = checkPostconditions(result.state, damaged, result.admissionRates)
  const gross = failures.filter((f) => f.kind === 'gross_not_partitioned')

  /* 10000 + 5000 + 20000 admitted. With the cash row dropped only its 15000 of
   * allocations are accounted for and its 5000 residual is not — which is the
   * money the draft lost. Both figures are literals. */
  assert.deepEqual(gross, [
    { kind: 'gross_not_partitioned', admittedMinor: 35000n, accountedMinor: 30000n },
  ])
})

test('test_a_dropped_zero_amount_item_fires_the_count_check_while_the_money_check_stays_silent', () => {
  const result = runOrFail([ZERO_OBLIGATION, OBLIGATION_ONE, OBLIGATION_TWO], [CASH])
  assert.deepEqual(result.postconditions, [])

  /* The zero-amount obligation is open — nothing pairs a zero — so it must be
   * in the residue. Dropping it removes an ITEM and no MONEY. */
  assert.equal(residueFor(result.residue, 'left', ZERO_OBLIGATION.docId).length, 1)
  const damaged = result.residue.filter(
    (e) => e.ref.sourceDocumentId !== ZERO_OBLIGATION.docId,
  )

  const failures = checkPostconditions(result.state, damaged, result.admissionRates)

  /* THIS IS THE INDEPENDENCE PROOF IN ONE DIRECTION. If
   * `open_item_missing_from_residue` were `gross_not_partitioned` restated as a
   * count, this drop would fire both or neither. It fires exactly one. */
  assert.deepEqual(failures, [{ kind: 'open_item_missing_from_residue', count: 1 }])
})

test('test_gross_not_partitioned_fires_alone_when_an_item_settlement_refuses', () => {
  /* THE INDEPENDENCE PROOF IN THE OTHER DIRECTION, and it needs a state the
   * engine would not build: one whose allocation names a currency the item does
   * not. `allocatedOf()` then refuses, `settlementOf()` refuses with it, and
   * `checkPostconditions` skips the item — after it has already counted its
   * gross. The count check sees nothing and the money check sees 10000.
   *
   * Hand-built deliberately. `checkPostconditions` is exported and takes a
   * `MatchingState`; this is a unit test of that function, not of a run. */
  const key = itemKey('left', {
    sourceDocumentId: 'doc-hand-built' as SourceDocumentId,
    lineIndex: null,
  })
  const item: AdmittedItem = {
    side: 'left',
    ref: { sourceDocumentId: 'doc-hand-built' as SourceDocumentId, lineIndex: null },
    key,
    gross: { currency: 'SGD', amountMinor: 10000n, exponent: 2 },
    date: '2026-01-10',
    dayNumber: 20463,
    identifiers: new Map<FieldPathKey, string>(),
    counterparty: null,
    untrustedDescription: null,
    untrustedDescriptionClass: null,
    ordinal: 0,
    /* G227. No floor was declared for any path this fixture reads, so nothing is
     * held and the item stays PAIRABLE — which is what these conservation checks
     * are about. A non-empty array here would take the item out of every pass. */
    heldReads: [],
  }
  const state: MatchingState = {
    items: new Map([[key, item]]),
    allocations: [
      {
        ordinal: 0,
        fromKey: key,
        toKey: 'right:0::h',
        amount: { currency: 'USD', amountMinor: 1n, exponent: 2 },
        evidence: { kind: 'amount_and_date', dayGap: 0 },
      },
    ],
  }

  /* C13's third parameter, stated to match the hand-built state rather than
   * left empty: this ledger holds one admitted item out of one row presented,
   * so `population_wholly_refused` correctly does not fire and the arm under
   * test fires alone. An empty array here would have disabled that check
   * silently, which is the shape C13 exists to end. */
  assert.deepEqual(checkPostconditions(state, [], [{ side: 'left', presented: 1, admitted: 1, refused: 0 }]), [
    { kind: 'gross_not_partitioned', admittedMinor: 10000n, accountedMinor: 0n },
  ])
})

/* ==================================================================== *
 * 4. The mixed address — a REFUSED residue entry is not the ledger's row
 *
 * 🛑 WHY THIS IS A DIRECT `checkPostconditions()` CALL AND NOT A SCENARIO, AND
 * IT IS NOT LAZINESS. C17 (`population_integrity_refused`) refuses any
 * population that delivers one address twice with at least one copy admitted,
 * so `runSetReconciliation()` can NO LONGER PRODUCE the state below: the path to
 * this defect through the public entry point is CLOSED. C17 masks the defect; it
 * does not fix it. `checkPostconditions` is exported, is called directly by
 * five other sites in this file, and is what a caller runs to find out whether
 * the ledger in its hand is sound. A post-condition that is only correct when
 * its caller is well-behaved is not a post-condition, so the guard is witnessed
 * here — below the entry point — because that is the only place left to witness
 * it from.
 * ==================================================================== */

test('test_an_admission_refused_residue_entry_does_not_stand_in_for_its_admitted_twin_at_the_same_address', () => {
  /* ONE ADDRESS, TWO ROWS. The left population delivered `doc-mixed-address`
   * twice at header grain. Copy A was admitted and is in the ledger, wholly
   * unallocated and therefore OPEN. Copy B could not be read — its amount field
   * was absent — so it was refused at admission and carries `settlement: null`.
   * It is NOT in the ledger; it has no amount to be in the ledger with.
   *
   * A's own residue row is ABSENT. That is the damage under test: an open item
   * that never reached the residue, which is precisely what
   * `open_item_missing_from_residue` exists to catch. */
  const ref = {
    sourceDocumentId: 'doc-mixed-address' as SourceDocumentId,
    lineIndex: null,
  }
  const key = itemKey('left', ref)

  const admitted: AdmittedItem = {
    side: 'left',
    ref,
    key,
    gross: { currency: 'SGD', amountMinor: 10000n, exponent: 2 },
    date: '2026-01-10',
    dayNumber: 20463,
    identifiers: new Map<FieldPathKey, string>(),
    counterparty: null,
    untrustedDescription: null,
    untrustedDescriptionClass: null,
    ordinal: 0,
    /* G227. No floor was declared for any path this fixture reads, so nothing is
     * held and the item stays PAIRABLE — which is what these conservation checks
     * are about. A non-empty array here would take the item out of every pass. */
    heldReads: [],
  }
  const state: MatchingState = {
    items: new Map([[key, admitted]]),
    allocations: [],
  }

  /* Copy B. `settlement: null` is the field's whole point — a refused row has no
   * amount, and the model forbids fabricating a zero to fill the hole. */
  const refusedTwin: ResidueEntry = {
    side: 'left',
    ref,
    settlement: null,
    disposition: 'error_left',
    cause: { kind: 'admission_refused', refusal: { kind: 'field_absent' } },
    /* G227. A refused row has no admitted item, so no read of it was held. */
    heldReads: [],
  }

  /* Two rows at one address: copy A admitted, copy B refused. So the side
   * presented two and admitted one — not a wholly-refused population, and C13's
   * arm correctly stays silent while the two arms under test fire. */
  const failures = checkPostconditions(state, [refusedTwin], [
    { side: 'left', presented: 2, admitted: 1, refused: 1 },
  ])

  /* BEFORE THE FIX THIS LIST WAS EMPTY. `itemKey` is an ADDRESS, so B's residue
   * entry produced the same key as A's ledger row; `inResidue` read TRUE for A,
   * A's residual was credited as residue-carried, and both halves of the
   * partition agreed — over a ledger missing a transaction. Every figure below
   * is a literal: 10000 admitted, 0 accounted, because nothing allocates and
   * nothing legitimately carries A in the residue. */
  assert.deepEqual(failures, [
    { kind: 'open_item_missing_from_residue', count: 1 },
    { kind: 'gross_not_partitioned', admittedMinor: 10000n, accountedMinor: 0n },
  ])
})

test('test_two_refused_copies_of_one_address_are_still_counted_as_a_duplicated_residue_key', () => {
  /* THE NARROWING GUARD. `item_in_residue_twice` is taken over the UNFILTERED
   * residue and must stay that way: two admission-refused copies of one address
   * are the named outcome C17 deliberately declines to replace with a refusal,
   * with both rows and both reasons visible. If a later edit "simplifies" the
   * fix above by filtering the duplicate count as well, this goes red.
   *
   * The ledger is EMPTY here — neither copy was admitted — so no conservation
   * arm has an operand.
   *
   * ⚠️ AND SINCE C13 THE DUPLICATE ARM NO LONGER FIRES ALONE, which is the
   * finding rather than an inconvenience. This sentence read *"the duplicate arm
   * fires alone"* and it was describing a run in which every row presented was
   * refused and nothing said so. `population_wholly_refused` now says it, ahead
   * of the duplicate count, because on a wholly-refused side there is nothing
   * for the ledger checks to be true OF. Both arms are asserted below; neither
   * is a substitute for the other. */
  const ref = {
    sourceDocumentId: 'doc-both-refused' as SourceDocumentId,
    lineIndex: null,
  }
  const refused: ResidueEntry = {
    side: 'left',
    ref,
    settlement: null,
    disposition: 'error_left',
    cause: { kind: 'admission_refused', refusal: { kind: 'field_absent' } },
    /* G227. A refused row has no admitted item, so no read of it was held. */
    heldReads: [],
  }
  const state: MatchingState = { items: new Map(), allocations: [] }

  /* One duplicated KEY, not two duplicated rows — the count is per key. */
  assert.deepEqual(
    checkPostconditions(state, [refused, refused], [
      { side: 'left', presented: 2, admitted: 0, refused: 2 },
    ]),
    [
      { kind: 'population_wholly_refused', side: 'left', sideRowCount: 2 },
      { kind: 'item_in_residue_twice', count: 1 },
    ],
  )
})

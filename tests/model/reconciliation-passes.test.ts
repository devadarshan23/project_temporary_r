/**
 * MULTI-PASS BEHAVIOUR OF `runSetReconciliation()` — the first construction site
 * `SetReconciliationInput` has ever had.
 *
 * `model/reconciliation.ts` landed with 100 exports and nothing anywhere
 * constructing its input, which is `docs/HANDOFF.md` §5.10 exactly: the total
 * records and the conditional assertions in §0 hold the SHAPE and witness
 * nothing about the CONTENT. Every claim asserted below is a BEHAVIOURAL claim
 * the compiler cannot make and did not make.
 *
 * WHAT IS ASSERTED, AND WHY EACH IS A NEGATIVE CONTROL RATHER THAN A PULSE:
 *
 *   A9(a) — the draft indexed with `new Map(items.map(b => [b.normalizedId, b]))`,
 *           so a duplicate normalised key dropped a record last-wins and the
 *           dropped record was never matched. Asserting "a refusal happened" would
 *           pass under the collapse too, so the test asserts that BOTH left rows
 *           were admitted, that BOTH are named in the finding's `leftRefs`, and
 *           that the allocation count is ZERO.
 *
 *   G105  — an exact combination of obligations summing to the payment is what
 *           the counterparty INTENDED to pay and is a MATCH; the waterfall is a
 *           JUDGEMENT about cash that cannot be attributed. Both produce
 *           allocations of identical shape and amount, so asserting "something
 *           paired" cannot tell them apart. Every G105 test below asserts the
 *           `PairingEvidence.kind` BY NAME, and the fall-through tests assert the
 *           recorded `fellThroughFrom` reason — the thing G105 says must never be
 *           inferred from silence.
 *
 *   Determinism — the engine takes no clock and no randomness, so two runs over
 *           one input are byte-identical, and FIFO order is `dayNumber` then
 *           admission `ordinal` rather than map-insertion order. The tie-break
 *           test supplies an item dated EARLIER but inserted LATER, so insertion
 *           order and FIFO order disagree and the assertion can distinguish them.
 *
 * NOTHING HERE PRICES ANYTHING. Invariant 5 — `UsageRecord` is immutable and
 * unpriced — and the engine emits `MeterFact`s carrying a quantity and no money,
 * so no assertion below reads a rate, a price or a cost.
 *
 * All money is minor units on `Money { currency, amountMinor, exponent }`;
 * `money(5000)` is SGD 50.00 and the fixtures never construct a bare literal.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  itemKey,
  runSetReconciliation,
  SIMILARITY_MAX_CHARS_CEILING,
} from '../../model/reconciliation.ts'
import type {
  IdentifierNormalisation,
  PopulationBinding,
  SetReconciliationInput,
  SetReconciliationOutcome,
  SetReconciliationResult,
  StrategyBinding,
  SubsetSumBound,
} from '../../model/reconciliation.ts'
import type {
  DataClass,
  ExtractedScalar,
  ExtractedValue,
  Money,
  PairingCardinality,
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
 * Fixtures. One tenant, one document type, one currency, header-grain.
 * -------------------------------------------------------------------- */

const TENANT = 'tenant-reconciliation-fixture' as TenantId
const DOCUMENT_TYPE = 'documenttype-reconciliation-fixture' as DocumentTypeId
const RUN = 'reconciliationrun-fixture' as RunId

const AMOUNT_PATH: FieldPath = p('amount')
const DATE_PATH: FieldPath = p('date')
const REF_PATH: FieldPath = p('ref')
const PARTY_PATH: FieldPath = p('party')

/** G106 is fail-closed: a path absent from this map is UNREADABLE. */
const CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<FieldPathKey, DataClass>([
  [k(AMOUNT_PATH), 'internal'],
  [k(DATE_PATH), 'internal'],
  [k(REF_PATH), 'internal'],
  [k(PARTY_PATH), 'internal'],
])

const NORMALISATION: IdentifierNormalisation = {
  ops: [{ kind: 'trim' }],
  then: 'exact',
  maxInputChars: 64,
}

function money(amountMinor: bigint): Money {
  return { currency: 'SGD', amountMinor, exponent: 2 }
}

function value(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

interface DocSpec {
  readonly id: string
  readonly amountMinor: bigint
  readonly date: string
  readonly ref: string | null
  readonly party: string | null
}

function doc(spec: DocSpec): SourceDocument {
  const extracted: Record<FieldPathKey, ExtractedValue> = {
    [k(AMOUNT_PATH)]: value({ kind: 'money', value: money(spec.amountMinor) }),
    [k(DATE_PATH)]: value({ kind: 'date', value: spec.date }),
  }
  if (spec.ref !== null) extracted[k(REF_PATH)] = value({ kind: 'identifier', value: spec.ref })
  if (spec.party !== null) extracted[k(PARTY_PATH)] = value({ kind: 'identifier', value: spec.party })
  return {
    id: spec.id as SourceDocumentId,
    tenantId: TENANT,
    documentTypeId: DOCUMENT_TYPE,
    filename: `${spec.id}.csv`,
    storageRef: `fixture://${spec.id}`,
    extracted,
    lines: [],
    /* C18. These fixtures are hand-built rows, not files: there is no trailer to
     * find and none is expected. The OFF arm, stated rather than defaulted. */
    controlTotal: { kind: 'not_declared_by_format' },
    ingestedAt: '2026-03-01T00:00:00.000Z',
    synthetic: true,
    purgeAfter: '2027-03-01T00:00:00.000Z',
    purgedAt: null,
  }
}

/** Header-grain items carry `lineIndex: null`; the key is length-prefixed. */
function keyOf(side: 'left' | 'right', id: string): string {
  return itemKey(side, { sourceDocumentId: id as SourceDocumentId, lineIndex: null })
}

function population(counterparty: FieldPath | null): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOCUMENT_TYPE,
      amount: AMOUNT_PATH,
      date: DATE_PATH,
      identifiers: [REF_PATH],
    },
    /* C16 — declared, not inferred. Every amount in this file is SGD exponent 2
     * (`money()` above), so no probe's arithmetic changes. */
    /* C18. These fixtures build rows by hand; the format they stand in for
     * carries no trailer, so the TYPE says so too and the parser's arm agrees. */
    carriesControlTotal: 'never',
    /* O-15. Every probe here hands a pass real rows, so `'refuses'` is truthful
     * and is the posture. */
    emptyExpectation: 'refuses',
    declaredUnit: { currency: 'SGD', exponent: 2 },
    normalisation: NORMALISATION,
    counterparty,
    description: null,
  }
}

const GENEROUS_BOUND: SubsetSumBound = {
  maxMembers: 4,
  stepBudget: 1000,
  maxBucketSize: 50,
}

interface InputSpec {
  readonly left: readonly SourceDocument[]
  readonly right: readonly SourceDocument[]
  readonly strategies: readonly PairingStrategy[]
  readonly bindings: readonly StrategyBinding[]
  readonly cardinality: PairingCardinality
  readonly counterparty: FieldPath | null
  readonly bound: SubsetSumBound
}

function makeInput(spec: InputSpec): SetReconciliationInput {
  return {
    runId: RUN,
    tenantId: TENANT,
    left: population(spec.counterparty),
    right: population(spec.counterparty),
    leftDocuments: spec.left,
    rightDocuments: spec.right,
    pairing: {
      cardinality: spec.cardinality,
      /* `rounding: 0` is the only EXACT amount tolerance the engine admits —
       * `absolute` and `percentage` are refused outright as float money. */
      amountTolerance: { kind: 'rounding', minorUnits: 0 },
      dateTolerance: { kind: 'days', value: 0 },
      strategies: [...spec.strategies],
    },
    strategyBindings: spec.bindings,
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    fieldClassification: CLASSIFICATION,
    modelPromptEligible: new Set<FieldPathKey>(),
    /* G227. No floor stated, so every admitted item stays PAIRABLE and the six
     * passes are exercised over the population this suite intends. */
    confidenceFloors: new Map<FieldPathKey, number>(),
    subsetSumBound: spec.bound,
    readerCandidateCap: 5,
    similarityMaxChars: 64,
    similarityMetric: 'levenshtein_ratio',
    /* C13. Required by the engine; every row of every fixture in this file is
     * admitted, so the refusal rate is 0 on both sides and nothing here is
     * testing the ceiling. A fixture choice with nothing behind it. */
    admissionRefusalCeilingBasisPoints: 2500,
  }
}

/* -------------------------------------------------------------------- *
 * Assertion helpers. `noUncheckedIndexedAccess` makes every index a
 * `T | undefined`, and an undefined that silently satisfies an assertion is
 * the failure mode this whole file exists to avoid.
 * -------------------------------------------------------------------- */

function resultOf(outcome: SetReconciliationOutcome): SetReconciliationResult {
  if (!outcome.ok) {
    assert.fail(`expected ok:true, got refusal ${JSON.stringify(outcome.refusal)}`)
  }
  return outcome.result
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) assert.fail(`no element at index ${index} (length ${items.length})`)
  return item
}

/** Byte-comparable rendering. `MatchingState.items` is a `Map`, which
 *  `JSON.stringify` renders as `{}` unless it is unfolded explicitly. */
function canonical(input: unknown): string {
  return JSON.stringify(input, (_key: string, held: unknown): unknown => {
    if (held instanceof Map) return { __map: [...held.entries()] }
    if (held instanceof Set) return { __set: [...held.values()] }
    /* ⚠️ G286, 19 Sep 2026 — A `bigint` MUST BE SPELLED OR `JSON.stringify`
     * THROWS, and a serialiser that throws on money is a serialiser that
     * cannot see money. Rendered as its DECIMAL STRING, which is exactly the
     * wire form G65 specifies, so what this reads is what a consumer reads. */
    if (typeof held === 'bigint') return held.toString(10)
    return held
  })
}

/**
 * A LINE-GRAIN document — one row on line `index`, `extracted` empty.
 *
 * 🛑 IT EXISTS BECAUSE `doc()` ABOVE IS HEADER GRAIN AND A HEADER-GRAIN FIXTURE
 * CANNOT WITNESS A LOST LINE INDEX. `ItemRef.lineIndex` is null for every row
 * `doc()` builds, so an assertion over one passes identically whether the engine
 * carried the index or replaced it with null — which is the exact mutation
 * `openLineFinding`'s own tests are written to catch one file over. A fixture
 * that cannot fail the thing it is quoted for is §5.6.
 */
function lineDoc(spec: DocSpec, index: number): SourceDocument {
  const fields: Record<FieldPathKey, ExtractedValue> = {
    [k(AMOUNT_PATH)]: value({ kind: 'money', value: money(spec.amountMinor) }),
    [k(DATE_PATH)]: value({ kind: 'date', value: spec.date }),
  }
  if (spec.ref !== null) fields[k(REF_PATH)] = value({ kind: 'identifier', value: spec.ref })
  if (spec.party !== null) fields[k(PARTY_PATH)] = value({ kind: 'identifier', value: spec.party })
  return { ...doc(spec), extracted: {}, lines: [{ index, fields }] }
}

const IDENTIFIER_ONLY: readonly PairingStrategy[] = [{ kind: 'exact_identifier', on: REF_PATH }]
const IDENTIFIER_BINDING: readonly StrategyBinding[] = [
  { strategy: { kind: 'exact_identifier', on: REF_PATH }, amountTolerance: null, amountAnchor: 'exact' },
]

const AMOUNT_SUM_ONLY: readonly PairingStrategy[] = [{ kind: 'amount_sum', maxMembers: 4 }]
const AMOUNT_SUM_BINDING: readonly StrategyBinding[] = [
  { strategy: { kind: 'amount_sum', maxMembers: 4 }, amountTolerance: null, amountAnchor: 'exact' },
]

/* ==================================================================== *
 * A9(a) — duplicate normalised ids must NOT collapse
 * ==================================================================== */

test('test_a9a_duplicate_normalised_ids_do_not_collapse_and_name_both_refs', () => {
  const outcome = runSetReconciliation(
    makeInput({
      left: [
        doc({ id: 'inv-1', amountMinor: 5000n, date: '2026-03-01', ref: 'INV-1', party: null }),
        doc({ id: 'inv-1-duplicate', amountMinor: 5000n, date: '2026-03-02', ref: 'INV-1', party: null }),
      ],
      right: [doc({ id: 'pay-1', amountMinor: 10000n, date: '2026-03-03', ref: 'INV-1', party: null })],
      strategies: IDENTIFIER_ONLY,
      bindings: IDENTIFIER_BINDING,
      cardinality: 'one_to_one',
      counterparty: null,
      bound: GENEROUS_BOUND,
    }),
  )
  const result = resultOf(outcome)

  /* The collapse itself: last-wins would have admitted one left row, not two. */
  assert.equal(result.state.items.size, 3, 'both left rows and the payment must be admitted')
  assert.equal(result.refusedAtAdmission.length, 0)

  /* ZERO allocations. An identifier repeating on one side names no unique pair,
   * and a strategy that guessed here would be moving money on a name collision. */
  assert.equal(result.state.allocations.length, 0, 'a duplicated identifier must allocate nothing')

  assert.equal(result.ambiguities.length, 1)
  const finding = at(result.ambiguities, 0)
  assert.equal(finding.strategyKind, 'exact_identifier')
  assert.equal(finding.on, REF_PATH)
  assert.equal(finding.leftCandidates, 2)
  assert.equal(finding.rightCandidates, 1)

  /* BOTH refs named, not merely "a refusal exists". */
  assert.deepEqual(
    finding.leftRefs.map((ref) => ref.sourceDocumentId),
    ['inv-1', 'inv-1-duplicate'],
  )
  assert.deepEqual(finding.rightRefs.map((ref) => ref.sourceDocumentId), ['pay-1'])

  /* And the dropped record is reachable as a product row, not lost. */
  assert.equal(result.residue.length, 3)
  for (const entry of result.residue) {
    assert.equal(entry.cause.kind, 'identifier_ambiguous')
    assert.equal(entry.disposition, 'unidentified')
  }
  assert.deepEqual(
    result.residue.filter((entry) => entry.side === 'left').map((entry) => entry.ref.sourceDocumentId),
    ['inv-1', 'inv-1-duplicate'],
  )
  assert.deepEqual(result.postconditions, [])
})

/* ==================================================================== *
 * G105 — bounded subset sum FIRST, FIFO waterfall as a RECORDED fallback
 * ==================================================================== */

const OBLIGATIONS_50_AND_70: readonly SourceDocument[] = [
  doc({ id: 'inv-50', amountMinor: 5000n, date: '2026-03-01', ref: null, party: 'ACME' }),
  doc({ id: 'inv-70', amountMinor: 7000n, date: '2026-03-02', ref: null, party: 'ACME' }),
]

function amountSumInput(paymentMinor: bigint, bound: SubsetSumBound): SetReconciliationInput {
  return makeInput({
    left: OBLIGATIONS_50_AND_70,
    right: [doc({ id: 'pay', amountMinor: paymentMinor, date: '2026-03-05', ref: null, party: 'ACME' })],
    strategies: AMOUNT_SUM_ONLY,
    bindings: AMOUNT_SUM_BINDING,
    cardinality: 'many_to_many',
    counterparty: PARTY_PATH,
    bound,
  })
}

test('test_g105_exact_combination_pairs_by_amount_sum_exact_and_not_by_the_waterfall', () => {
  /* 50 + 70 = 120. What the payer intended to pay. */
  const result = resultOf(runSetReconciliation(amountSumInput(12000n, GENEROUS_BOUND)))

  assert.equal(result.state.allocations.length, 2)
  for (const allocation of result.state.allocations) {
    /* WHICH STRATEGY FIRED, BY NAME. The waterfall would produce two allocations
     * of exactly these amounts, so a count is not evidence. */
    assert.equal(allocation.evidence.kind, 'amount_sum_exact')
    assert.notEqual(allocation.evidence.kind, 'amount_sum_waterfall')
    if (allocation.evidence.kind !== 'amount_sum_exact') return
    assert.equal(allocation.evidence.memberCount, 2)
  }

  const first = at(result.state.allocations, 0)
  const second = at(result.state.allocations, 1)
  assert.equal(first.fromKey, keyOf('right', 'pay'))
  assert.equal(first.toKey, keyOf('left', 'inv-50'))
  assert.deepEqual(first.amount, money(5000n))
  assert.equal(second.toKey, keyOf('left', 'inv-70'))
  assert.deepEqual(second.amount, money(7000n))

  /* Everything settled, so the residue — the product — is empty. */
  assert.deepEqual(result.residue, [])
  assert.deepEqual(result.postconditions, [])
})

test('test_g115_a_similarity_max_chars_above_the_ceiling_is_refused_not_clamped', () => {
  /**
   * G115's second half. `similarityMaxChars` was validated `>= 1` and nothing
   * more, so the per-comparison cost of `levenshteinBasisPoints` — which is
   * O(n×m) — was unbounded. With the fuzzy bucket also uncapped, the two
   * together made the pass an unbounded quadratic over reference strings a
   * COUNTERPARTY controls.
   *
   * 🛑 IT REFUSES RATHER THAN CLAMPING, and that is the point. A silent clamp
   * would change WHICH RECORDS PAIR without telling anyone — the ceiling is a
   * matching-policy decision with money on it, so exceeding it is an error the
   * caller must see, not a preference the engine quietly overrides.
   */
  const over = {
    ...amountSumInput(12000n, GENEROUS_BOUND),
    similarityMaxChars: SIMILARITY_MAX_CHARS_CEILING + 1,
  }
  const outcome = runSetReconciliation(over)
  assert.equal(outcome.ok, false)
  if (outcome.ok) return
  assert.equal(outcome.refusal.kind, 'similarity_max_chars_not_stated')

  /* The ceiling itself is admitted — the boundary is inclusive, and a test that
   * only asserted the refusal could not tell an off-by-one from a policy. */
  const atCeiling = {
    ...amountSumInput(12000n, GENEROUS_BOUND),
    similarityMaxChars: SIMILARITY_MAX_CHARS_CEILING,
  }
  assert.equal(runSetReconciliation(atCeiling).ok, true)
})

test('test_g114_step_budget_exhaustion_leaves_the_bucket_open_and_reaches_the_residue', () => {
  /**
   * ⚠️ THIS TEST ASSERTED THE OPPOSITE UNTIL 9 Aug 2026, AND THE CHANGE IS A
   * RULING, NOT A BENT TEST.
   *
   * It was `test_g105_step_budget_exhaustion_falls_through_to_the_waterfall_visibly`
   * and it asserted two waterfall allocations carrying
   * `fellThroughFrom: 'budget_exhausted'`. That was a faithful test of G105 as
   * written. **G114 amends G105's exhaustion arm** — the owner ruled that a
   * search which was CUT SHORT has not established the inattributability that
   * licenses a waterfall, so the bucket stays open and its items reach the
   * residue.
   *
   * The distinction the old test drew is preserved and sharpened: the ledger of
   * an exhausted run is no longer *indistinguishable* from a match — it is
   * EMPTY, and the items are on the queue with a cause that says the search did
   * not finish.
   *
   * 🛑 A test may be rewritten when the SPECIFICATION moves under a recorded
   * ruling. It may not be rewritten to accommodate a defect. The corpus caught
   * this change within seconds of the edit, which is the system working.
   */
  const starved: SubsetSumBound = { maxMembers: 4, stepBudget: 1, maxBucketSize: 50 }
  const result = resultOf(runSetReconciliation(amountSumInput(12000n, starved)))

  /* G114: NOTHING is poured. The engine does not know whether an exact
   * combination exists, and it does not guess. */
  assert.equal(result.state.allocations.length, 0)

  /* Every item stays open and lands in the residue — the product. */
  assert.equal(result.residue.length, 3)
  for (const entry of result.residue) {
    assert.equal(
      entry.cause.kind,
      'search_budget_exhausted',
      'the cause names the actual reason: the search was cut short, NOT that ' +
        'nothing matched. `no_strategy_paired` here would be a false statement ' +
        'about a search that never completed.',
    )
  }

  /* The conservation post-condition still holds: nothing admitted was lost. */
  assert.deepEqual(result.postconditions, [])
})

test('test_g217_an_exhausted_search_is_reported_as_a_count_and_a_line_grain_address_and_never_as_a_bucket_key', () => {
  /**
   * 🛑 THE CHANNEL THIS ASSERTS WAS ASSERTED BY NOTHING WHEN IT LANDED, AND
   * MUTATION TESTING IS WHAT SAID SO. Three mutations survived the whole suite:
   * setting `itemCount` to zero, dropping the `exampleRef`'s line index, and an
   * off-by-one on the fuzzy channel. The G114 test above proves the CAUSE
   * reaches the residue and says nothing about the boundary the same run
   * reports — so the channel G217 minted to make a truncated search legible was
   * itself illegible to the suite.
   *
   * ⚠️ IT IS DELIBERATELY LINE GRAIN. The header-grain fixtures in this file
   * carry `lineIndex: null` on every row, so an assertion over one cannot tell a
   * carried index from a dropped one — see `lineDoc()`.
   */
  const starved: SubsetSumBound = { maxMembers: 4, stepBudget: 1, maxBucketSize: 50 }
  const result = resultOf(
    runSetReconciliation(
      makeInput({
        left: [
          lineDoc({ id: 'ob-a', amountMinor: 5000n, date: '2026-03-01', ref: null, party: 'ACME' }, 3),
          lineDoc({ id: 'ob-b', amountMinor: 7000n, date: '2026-03-02', ref: null, party: 'ACME' }, 4),
        ],
        right: [
          lineDoc({ id: 'cash', amountMinor: 12000n, date: '2026-03-05', ref: null, party: 'ACME' }, 7),
        ],
        strategies: AMOUNT_SUM_ONLY,
        bindings: AMOUNT_SUM_BINDING,
        cardinality: 'many_to_many',
        counterparty: PARTY_PATH,
        bound: starved,
      }),
    ),
  )

  /* The other two channels are EMPTY, and stating that is half the assertion: a
   * boundary reported on the wrong channel is a bound attributed to the wrong
   * bound, and `oversizedBuckets` is a PREDICTED cost while this is an OBSERVED
   * one. */
  assert.deepEqual(result.searchBoundary.oversizedBuckets, [])
  assert.deepEqual(result.searchBoundary.oversizedAmountBuckets, [])

  /* ONE search, not one bucket. The grain is the field name's whole subject:
   * `passAmountSum` cuts a search short once per CASH ITEM, and the field this
   * replaced was called `exhaustedBuckets` while counting exactly this. */
  assert.deepEqual(result.searchBoundary.exhaustedSearches, [
    {
      /* Two open obligations plus the payment whose search was cut short. */
      itemCount: 3,
      /* THE CASH ROW, at the line it came in on. It is the thing the engine gave
       * up trying to attribute, and line 7 is what an operator opens. */
      exampleRef: { sourceDocumentId: 'cash', lineIndex: 7 },
    },
  ])

  /* G217, restated as an assertion rather than a comment: nothing on this
   * channel is a string. `ACME` is the counterparty key that used to travel
   * here, and it is not the point that it is innocuous — it is text out of a
   * file somebody sent us, and the type has no property that could hold it. */
  assert.equal(JSON.stringify(result.searchBoundary).includes('ACME'), false)
})

test('test_g217_a_fuzzy_comparison_skipped_on_the_amount_bucket_bound_is_reported_where_g115_reported_nothing', () => {
  /**
   * 🛑 G115's REFUSAL REACHED NO READER FOR TWO WEEKS AND NO TEST NOTICED.
   * `runSetReconciliation` accumulated the fuzzy pass's oversized amount buckets
   * into a local and read them NOWHERE — the comment at the accumulation site
   * said they reused `bucket_exceeded_bound`, and they did not: that cause joins
   * on the COUNTERPARTY key and these are AMOUNT keys, so the two sets never
   * intersected. A bound that was hit was being silently absorbed, which is what
   * G114 exists to forbid.
   *
   * TWO ROWS A SIDE AT THE SAME AMOUNT, A BOUND OF ONE. The bucket is built over
   * the RIGHT side by exact minor units, so both right rows land in it and both
   * left rows find it too wide to compare.
   */
  const tight: SubsetSumBound = { maxMembers: 4, stepBudget: 1000, maxBucketSize: 1 }
  const fuzzy: PairingStrategy = { kind: 'fuzzy_reference', minSimilarity: 0.9 }
  const result = resultOf(
    runSetReconciliation(
      makeInput({
        left: [
          lineDoc({ id: 'l-a', amountMinor: 10000n, date: '2026-03-01', ref: 'INV-1', party: null }, 0),
          lineDoc({ id: 'l-b', amountMinor: 10000n, date: '2026-03-02', ref: 'INV-2', party: null }, 1),
        ],
        right: [
          lineDoc({ id: 'r-a', amountMinor: 10000n, date: '2026-03-01', ref: 'INV-1', party: null }, 5),
          lineDoc({ id: 'r-b', amountMinor: 10000n, date: '2026-03-02', ref: 'INV-2', party: null }, 6),
        ],
        strategies: [fuzzy],
        bindings: [{ strategy: fuzzy, amountTolerance: null, amountAnchor: 'exact' }],
        cardinality: 'one_to_one',
        counterparty: null,
        bound: tight,
      }),
    ),
  )

  /* ONE ENTRY PER ROW WHOSE COMPARISON WAS SKIPPED, not one per bucket — the
   * grain the field's own docblock states, asserted rather than described. */
  assert.deepEqual(result.searchBoundary.oversizedAmountBuckets, [
    { itemCount: 2, exampleRef: { sourceDocumentId: 'l-a', lineIndex: 0 } },
    { itemCount: 2, exampleRef: { sourceDocumentId: 'l-b', lineIndex: 1 } },
  ])
  assert.deepEqual(result.searchBoundary.oversizedBuckets, [])
  assert.deepEqual(result.searchBoundary.exhaustedSearches, [])

  /* ⚠️ AND THE RESIDUE CAUSE IS DELIBERATELY UNCHANGED BY THIS SLICE. Every one
   * of these rows reports `no_strategy_paired` — which is what a comparison that
   * never ran leaves behind — and re-attributing them to the bound is a MATCHING
   * decision, not a reporting one. Asserted so that a later change to the cause
   * is a decision somebody takes rather than a side effect. */
  assert.equal(result.residue.length, 4)
  for (const entry of result.residue) assert.equal(entry.cause.kind, 'no_strategy_paired')
})

test('test_g105_no_exact_solution_falls_through_to_the_waterfall_with_that_reason', () => {
  /* 100 against obligations of 50 and 70: no subset sums to it. */
  const result = resultOf(runSetReconciliation(amountSumInput(10000n, GENEROUS_BOUND)))

  assert.equal(result.state.allocations.length, 2)
  for (const allocation of result.state.allocations) {
    assert.equal(allocation.evidence.kind, 'amount_sum_waterfall')
    if (allocation.evidence.kind !== 'amount_sum_waterfall') return
    assert.equal(allocation.evidence.fellThroughFrom, 'no_exact_solution')
  }

  assert.deepEqual(at(result.state.allocations, 0).amount, money(5000n))
  assert.deepEqual(at(result.state.allocations, 1).amount, money(5000n))

  /* The half-paid obligation is a residue row carrying its own settlement. */
  assert.equal(result.residue.length, 1)
  const entry = at(result.residue, 0)
  assert.equal(entry.ref.sourceDocumentId, 'inv-70')
  assert.equal(entry.cause.kind, 'obligation_not_fully_settled')
  assert.equal(entry.settlement?.kind, 'partially_allocated')
  assert.deepEqual(result.postconditions, [])
})

/* ==================================================================== *
 * Determinism — no clock, no randomness, and a total FIFO order
 * ==================================================================== */

/**
 * Three same-currency obligations for one counterparty, and the middle one is
 * dated EARLIEST while being supplied SECOND. Map-insertion order and FIFO
 * order therefore disagree, which is what lets the assertion tell them apart.
 * 60 matches no subset of {50, 50, 50}, so the waterfall runs.
 */
function tieBreakInput(): SetReconciliationInput {
  return makeInput({
    left: [
      doc({ id: 'ob-late-first', amountMinor: 5000n, date: '2026-03-10', ref: null, party: 'ACME' }),
      doc({ id: 'ob-early-second', amountMinor: 5000n, date: '2026-03-01', ref: null, party: 'ACME' }),
      doc({ id: 'ob-late-third', amountMinor: 5000n, date: '2026-03-10', ref: null, party: 'ACME' }),
    ],
    right: [doc({ id: 'pay-60', amountMinor: 6000n, date: '2026-03-12', ref: null, party: 'ACME' })],
    strategies: AMOUNT_SUM_ONLY,
    bindings: AMOUNT_SUM_BINDING,
    cardinality: 'many_to_many',
    counterparty: PARTY_PATH,
    bound: GENEROUS_BOUND,
  })
}

test('test_determinism_the_same_input_run_twice_is_byte_identical', () => {
  const input = tieBreakInput()
  const first = canonical(resultOf(runSetReconciliation(input)))
  const second = canonical(resultOf(runSetReconciliation(input)))

  assert.equal(first, second, 'two runs over one input must render identically')
  /* Guard against the vacuous pass where both renderings are trivially small. */
  assert.ok(first.length > 500, `rendering is suspiciously short: ${first.length} bytes`)
  assert.ok(first.includes('amount_sum_waterfall'), 'the fixture must have exercised a pass')
})

test('test_fifo_order_is_date_then_admission_ordinal_and_not_map_insertion_order', () => {
  const result = resultOf(runSetReconciliation(tieBreakInput()))

  assert.equal(result.state.allocations.length, 2)

  /* Supplied SECOND, dated FIRST — so it is paid FIRST. Insertion order would
   * have paid `ob-late-first`. */
  const first = at(result.state.allocations, 0)
  assert.equal(first.toKey, keyOf('left', 'ob-early-second'))
  assert.deepEqual(first.amount, money(5000n))

  /* Two obligations share 2026-03-10; the tie breaks on admission ordinal, so
   * the one supplied first takes the remaining 10 and the third takes nothing. */
  const second = at(result.state.allocations, 1)
  assert.equal(second.toKey, keyOf('left', 'ob-late-first'))
  assert.deepEqual(second.amount, money(1000n))

  const untouched = result.residue.filter(
    (entry) => entry.ref.sourceDocumentId === 'ob-late-third',
  )
  assert.equal(untouched.length, 1)
  assert.equal(at(untouched, 0).settlement?.kind, 'unallocated')
  assert.deepEqual(result.postconditions, [])
})

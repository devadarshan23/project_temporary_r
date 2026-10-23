/**
 * C16 — CURRENCY IS DECLARED, NEVER INFERRED. THE GREEN HALF.
 *
 * 🛑 THIS FILE WAS WRITTEN RED AND IS NOW INVERTED, AND THE INVERSION IS THE
 * RECORD. Every test below once asserted a DEFECT as the current behaviour: two
 * denominations admitted and closed as SOUND, the same currency at two exponents
 * admitted, a tolerance in a third currency producing no signal at all. C16
 * refuses each of those configurations before the run starts, so each of those
 * assertions is now an assertion about the REFUSAL. Nothing was deleted; each
 * changed test says in its own comment what it asserted before and why the new
 * assertion is the correct one.
 *
 * WHY THE FILE EXISTED AT ALL, which has not changed. `docs/build/wave-two-plan
 * .md` §3 named its own highest risk: the CROSS-SIDE and TOLERANCE comparisons
 * had NO FIXTURE ANYWHERE IN THE RECORD, so deleting either would have turned
 * nothing red — `docs/HANDOFF.md` §5.10, a control with no construction site is
 * witnessed by nothing.
 *
 * 🛑 AND THE FINDING THIS FILE MADE BEFORE C16 WAS BUILT IS NOW CLOSED IN THE
 * ENGINE. Test 7 recorded that the plan's gate inspected
 * `input.pairing.amountTolerance` ALONE while `StrategyBinding.amountTolerance`
 * overrides it — `binding.amountTolerance ?? input.pairing.amountTolerance` is
 * what actually reaches `toleranceAdmits`. The gate as shipped compares BOTH, and
 * the refusal names the binding — `tolerance: { kind: 'strategy_binding', index }`
 * — so an operator is told which one to fix. That test is the only witness the
 * override half has here.
 *
 * ⚠️ AND THE REFUSAL WAS RESHAPED AFTER C16 SHIPPED, WITHOUT ANY BEHAVIOUR
 * MOVING. The single `declared_units_disagree` arm carried `against` and a
 * nullable `strategyIndex`, so `{ against: 'other_side', strategyIndex: 3 }` —
 * a cross-side comparison naming a strategy binding — compiled and meant
 * nothing (§5.5). It is now two kinds: `declared_units_disagree` for the
 * cross-side comparison, carrying only its `MoneyRefusal`, and
 * `tolerance_unit_disagrees` for the tolerance one, carrying which tolerance.
 * Every expectation below is the SAME CLAIM respelled — no test changed what it
 * asserts, only how the refusal it asserts is written.
 *
 * ⚠️ EVERY EXPECTATION WAS HAND-DERIVED BEFORE THE FILE WAS RUN, by reading
 * `runSetReconciliation`'s gate, `admitOne`, `passIdentifierJoin`,
 * `toleranceAdmits`, `guardUnit` and `sameUnit` and tracing the fold. That is the
 * corpus's own rule — `tests/scenarios/recon-corpus.ts:10-22`, *"NOTHING HERE WAS
 * PRODUCED BY RUNNING `runSetReconciliation()` AND PASTING THE OUTPUT BACK"* —
 * and it applies here for the same reason: an expectation copied out of the
 * engine is a constant compared to itself. The derivation is written out beside
 * each test so the next reader can check the trace rather than the output.
 *
 * WHAT EACH TEST ASSERTS NOW, and what it asserted before C16:
 *
 *   1  twoSidesInDifferentCurrencies…    was: both admitted, four items, nothing
 *                                        compared them. now: the run REFUSES,
 *                                        `declared_units_disagree`.
 *   2  aCrossCurrencyRunIsReportedSound… was: `ok`, 100% unmatched, postconditions
 *                                        empty. now: there is no result to read.
 *   3  theOnlyCrossCurrencySignal…       was: two buried `toleranceRefusals` on an
 *                                        `ok` run. now: the signal IS the outcome.
 *   4  sameCurrencyTwoExponents…         was: admitted, closed sound. now: refused,
 *                                        `exponent_mismatch`.
 *   5  moneyToleranceInAThirdCurrency     was: no signal whatever, because nothing
 *      (nothing pairs)                    paired. now: refused before admission.
 *   6  moneyToleranceInAThirdCurrency     was: two buried refusals. now: the SAME
 *      (a pair reaches it)                refusal as 5 — the observable no longer
 *                                        depends on what the data happened to do.
 *   7  perStrategyToleranceOverride…      was: the override reached the hole by a
 *                                        route the drafted gate did not inspect.
 *                                        now: refused, naming binding index 0.
 *   8  agreeingSidesStillMatch            UNCHANGED. Non-vacuity.
 *   9  roundingToleranceIsUnitFree        UNCHANGED. Non-vacuity.
 *  10  moneyToleranceInTheSameUnit…       UNCHANGED. Non-vacuity.
 *
 * 🛑 TESTS 8, 9 AND 10 ARE NOT DECORATION. A fixture that only proves refusals
 * would also pass against an engine that refused every run, which is §5.6 — a
 * check that asserts nothing while reporting health. They are the half that
 * distinguishes "C16 refuses the wrong configurations" from "C16 refuses". They
 * were required to stay green across the change and they did.
 *
 * ⚠️ WHAT THIS FILE DOES NOT TOUCH, DELIBERATELY. The corpus's own C16 rewrite —
 * `twoCurrenciesNeverMatchAcross` restated, `declaredUnitSurvivesRowOrder`,
 * `mixedExponentIsRefusedAtAdmission` and three run-level refusal scenarios —
 * lives in `tests/scenarios/recon-corpus.ts`, hand-derived from the specification
 * rather than from this file.
 *
 * ⚠️ AND IT PRICES NOTHING. Invariant 5: `UsageRecord` is immutable and unpriced.
 * No rate, price, cost or benchmark is read anywhere below, and every currency
 * and figure here already appears in `tests/scenarios/recon-corpus.ts`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { runSetReconciliation } from '../../model/reconciliation.ts'
import type {
  MoneyUnit,
  PopulationBinding,
  SetReconciliationInput,
  SetReconciliationRefusal,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type {
  DataClass,
  ExtractedScalar,
  ExtractedValue,
  PairingStrategy,
  SourceDocument,
  Tolerance,
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

/* ==================================================================== *
 * THE FIXTURE — one tenant, header-grain documents, one strategy
 *
 * Both sides name the same three paths. `counterparty` is NULL on both, which
 * keeps `amount_sum` from running at all (`model/reconciliation.ts:2958` — a
 * definition that has not named a partition key does not silently get one giant
 * bucket), so `exact_identifier` is the only pass and every finding below is
 * attributable to it.
 * ==================================================================== */

const TENANT = 'tenant-declared-unit-fixture' as TenantId
const DOC_TYPE = 'doctype-declared-unit-fixture' as DocumentTypeId

const AMOUNT_PATH: FieldPath = p('amount')
const DATE_PATH: FieldPath = p('date')
const REF_PATH: FieldPath = p('reference')

/** G106, fail-closed: a path with no classification is UNREADABLE and refused. */
const CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<FieldPathKey, DataClass>([
  [k(AMOUNT_PATH), 'internal'],
  [k(DATE_PATH), 'internal'],
  [k(REF_PATH), 'internal'],
])

interface Row {
  readonly docId: string
  readonly minor: bigint
  /** Stated per row, because the whole subject of this file is denomination. */
  readonly currency: string
  readonly exponent: number
  readonly date: string
  readonly reference: string
}

/* SGD 1000.00 and USD 1000.00 at exponent 2, and SGD 1000 at exponent 0 — the
 * same three denominations `tests/scenarios/recon-corpus.ts` already uses
 * (`:1628-1638` for the two currencies, `MONEY_VECTORS` at `:2300` for a
 * non-default exponent). Nothing new is invented here. */
const SGD_2 = { currency: 'SGD', exponent: 2 } as const
const USD_2 = { currency: 'USD', exponent: 2 } as const
const SGD_0 = { currency: 'SGD', exponent: 0 } as const

function row(
  docId: string,
  reference: string,
  minor: bigint,
  unit: { readonly currency: string; readonly exponent: number },
  date = '2026-03-03',
): Row {
  return { docId, reference, minor, currency: unit.currency, exponent: unit.exponent, date }
}

function value(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

function documentOf(r: Row): SourceDocument {
  return {
    tenantId: TENANT,
    id: r.docId as SourceDocumentId,
    documentTypeId: DOC_TYPE,
    filename: `${r.docId}.csv`,
    storageRef: `fixture://${r.docId}`,
    extracted: {
      [k(AMOUNT_PATH)]: value({
        kind: 'money',
        value: { currency: r.currency, amountMinor: r.minor, exponent: r.exponent },
      }),
      [k(DATE_PATH)]: value({ kind: 'date', value: r.date }),
      [k(REF_PATH)]: value({ kind: 'identifier', value: r.reference }),
    },
    lines: [],
    /* C18. These fixtures are hand-built rows, not files: there is no trailer to
     * find and none is expected. The OFF arm, stated rather than defaulted. */
    controlTotal: { kind: 'not_declared_by_format' },
    ingestedAt: '2026-04-01T09:00:00.000Z',
    /* Truthful — pass F ruled the sandbox is synthetic-only and enforced. */
    synthetic: true,
    purgeAfter: '2033-04-01T09:00:00.000Z',
    purgedAt: null,
  }
}

/**
 * ⚠️ THE FIELD THIS BUILDER NOW TAKES IS THE POINT OF THE FILE. It read
 * `population()` and could not state a denomination at all, because
 * `PopulationBinding` had none — the whole side's currency came from whichever
 * row admission happened to reach first. `declaredUnit` is REQUIRED and non-null,
 * so a test cannot leave it unstated even by accident; that is C16.
 */
function population(declaredUnit: MoneyUnit): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE,
      amount: AMOUNT_PATH,
      date: DATE_PATH,
      identifiers: [REF_PATH],
    },
    /* C18. These fixtures build rows by hand; the format they stand in for
     * carries no trailer, so the TYPE says so too and the parser's arm agrees. */
    carriesControlTotal: 'never',
    /* O-15. Every run in this file supplies documents on both sides — the C16
     * comparisons are only reachable over populations that presented rows — so
     * `'refuses'` is truthful and is the posture. */
    emptyExpectation: 'refuses',
    declaredUnit,
    normalisation: { ops: [], then: 'exact', maxInputChars: 64 },
    counterparty: null,
    description: null,
  }
}

/** `{ kind: 'rounding', minorUnits: 0 }` — unit-free, and exact. */
const EXACT_MONEY: Tolerance = { kind: 'rounding', minorUnits: 0 }

function inputOf(
  left: readonly Row[],
  right: readonly Row[],
  amountTolerance: Tolerance = EXACT_MONEY,
  /** `null` INHERITS `pairing.amountTolerance` — `StrategyBinding` at `:1436`. */
  bindingTolerance: Tolerance | null = null,
  /**
   * The two DECLARATIONS. Stated per side because comparison 2 exists precisely
   * to read one against the other; the right side defaults to the left's, so a
   * test that says nothing about denomination is testing an agreeing pair.
   */
  leftUnit: MoneyUnit = SGD_2,
  rightUnit: MoneyUnit = leftUnit,
): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'exact_identifier', on: REF_PATH }
  return {
    runId: 'run-declared-unit-fixture' as RunId,
    tenantId: TENANT,
    left: population(leftUnit),
    right: population(rightUnit),
    leftDocuments: left.map(documentOf),
    rightDocuments: right.map(documentOf),
    pairing: {
      cardinality: 'one_to_one',
      amountTolerance,
      dateTolerance: { kind: 'days', value: 0 },
      strategies: [strategy],
    },
    strategyBindings: [{ strategy, amountTolerance: bindingTolerance, amountAnchor: 'exact' }],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    fieldClassification: CLASSIFICATION,
    modelPromptEligible: new Set<FieldPathKey>(),
    /* G227. No floor stated; C16's declared-unit refusals are unaffected. */
    confidenceFloors: new Map<FieldPathKey, number>(),
    subsetSumBound: { maxMembers: 8, stepBudget: 5000, maxBucketSize: 50 },
    readerCandidateCap: 5,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    /* C13. Required by the engine, and 5000 rather than something tighter for a
     * stated reason: this file's C16 fixtures REFUSE rows on purpose — one bad
     * row in two is 5000 basis points — and a tighter ceiling here would make
     * C13 refuse the run before the denomination behaviour under test could be
     * observed. The comparison is strictly `>`, so a rate at 5000 is admitted.
     * A fixture choice; not a recommendation. */
    admissionRefusalCeilingBasisPoints: 5000,
  }
}

/**
 * ⚠️ `runOrFail` IS ITSELF A C16 ASSERTION AND IT IS THE LOUDEST ONE HERE.
 * Every test that reaches it is a run the engine ACCEPTED. Before C16 all ten
 * tests below used it; now only the three non-vacuity controls do, and that
 * three-versus-ten is the change stated as a shape.
 */
function runOrFail(input: SetReconciliationInput): SetReconciliationResult {
  const outcome = runSetReconciliation(input)
  assert.ok(
    outcome.ok,
    `the engine refused the fixture: ${outcome.ok ? '' : outcome.refusal.kind}`,
  )
  return outcome.result
}

/**
 * The other half, and it is the half C16 added. A misconfigured denomination is
 * an ERROR CHANNEL — a returned refusal a caller cannot read past — and not run
 * metadata sitting beside `ambiguities` on an `ok` result.
 */
function refusalOf(input: SetReconciliationInput): SetReconciliationRefusal {
  const outcome = runSetReconciliation(input)
  assert.equal(outcome.ok, false, 'the engine ACCEPTED a run whose denomination is misconfigured')
  if (outcome.ok) throw new Error('unreachable')
  return outcome.refusal
}

/* ==================================================================== *
 * 1. COMPARISON 2 — THE TWO SIDES ARE READ AGAINST EACH OTHER
 *
 * ⚠️ THIS HEADING READ *"THE TWO SIDES ARE NEVER READ AGAINST EACH OTHER"*.
 * A ledger declared in one denomination against a statement in another, each side
 * INTERNALLY CONSISTENT so the per-side seed never fired. The cost, in the plan's
 * own words: *"a CONFIGURATION error that would otherwise present as a
 * 100%-unmatched close reported as SOUND"*. `sameUnit(left.declaredUnit,
 * right.declaredUnit)` is the one line that ends it.
 * ==================================================================== */

const SGD_LEDGER = [
  row('doc-ledger-sgd-1', 'INV-9001', 100000n, SGD_2),
  row('doc-ledger-sgd-2', 'INV-9002', 100000n, SGD_2),
]
const USD_STATEMENT = [
  row('doc-bank-usd-1', 'INV-9001', 100000n, USD_2, '2026-03-06'),
  row('doc-bank-usd-2', 'INV-9002', 100000n, USD_2, '2026-03-06'),
]
/** The same statement in the ledger's own unit. Used by §3 and §4 both. */
const SGD_STATEMENT_MATCHING = [
  row('doc-bank-sgd-1', 'INV-9001', 100000n, SGD_2, '2026-03-06'),
  row('doc-bank-sgd-2', 'INV-9002', 100000n, SGD_2, '2026-03-06'),
]

/** Each side declares its own rows truthfully. It is the PAIR that is wrong. */
const CROSS_CURRENCY = () => inputOf(SGD_LEDGER, USD_STATEMENT, EXACT_MONEY, null, SGD_2, USD_2)

test('test_two_sides_declaring_different_currencies_refuse_the_run_before_a_single_row_is_read', () => {
  /* WHAT THIS ASSERTED BEFORE C16: that both sides were ADMITTED — four items in
   * the ledger, `refusedAtAdmission` empty, two SGD and two USD — because
   * `admitPopulation` seeded each side's currency from its own first admitted row
   * and the two seeds were never read against each other. There was no code path
   * that could have compared them: the seed was a local inside a per-side call.
   *
   * WHY THE CHANGE IS CORRECT. Nothing about that run was recoverable. Two
   * populations in two denominations cannot be reconciled — `FxConversion` and
   * `FxPolicy` are `@dropped-for-v1` — so admitting them and then failing to
   * match them is the engine doing work it knows is void.
   *
   * DERIVATION. The gate runs before admission. `guardUnit` passes on each side
   * (both stated, both exponent 2), `validateNormalisation` passes, and then
   * `sameUnit({SGD,2}, {USD,2})` returns `currency_mismatch` on its first line.
   * The refusal carries NOTHING but that reason, because a cross-side comparison
   * names no tolerance and no strategy binding — it is `declared_units_disagree`
   * and nothing else is representable on it. */
  assert.deepEqual(refusalOf(CROSS_CURRENCY()), {
    kind: 'declared_units_disagree',
    refusal: { kind: 'currency_mismatch' },
  })
})

test('test_a_cross_currency_run_can_no_longer_be_reported_sound_because_there_is_no_result_to_report', () => {
  /* WHAT THIS ASSERTED BEFORE C16, and it was the worst of the ten: the run came
   * back `{ ok: true }` with ZERO allocations, all four items in the residue as
   * `no_strategy_paired` — "nothing matched it", which was false — and
   * `postconditions` EMPTY. Every item unallocated and each in the residue
   * exactly once, so residue completeness held and `gross_not_partitioned`
   * balanced: each side balanced internally and nothing compared them. A
   * misconfigured run reported a sound ledger.
   *
   * WHY THE CHANGE IS CORRECT. A caller told to read `ok` and `postconditions`
   * before persisting saw a clean close. The only fix that reaches that caller is
   * to withhold the result, and `SetReconciliationOutcome` already has the arm
   * for it. This test therefore asserts the ABSENCE of the thing it used to
   * assert the presence of.
   *
   * DERIVATION. `runSetReconciliation` returns from the gate, so no
   * `SetReconciliationResult` is constructed at all: no residue, no
   * `postconditions: []`, no `state`. There is nothing to misread. */
  const outcome = runSetReconciliation(CROSS_CURRENCY())
  assert.equal(outcome.ok, false)
  assert.equal('result' in outcome, false, 'a refused run must carry no result to be read past')
})

test('test_the_cross_currency_signal_is_now_the_outcome_itself_rather_than_metadata_buried_in_a_list', () => {
  /* WHAT THIS ASSERTED BEFORE C16: two `toleranceRefusals`, one per JOIN KEY —
   * `{ kind: 'money', refusal: { kind: 'currency_mismatch' } }` twice, raised by
   * `toleranceAdmits`'s `subtractMoney` guard when the pass compared the two side
   * totals. `SetReconciliationResult.toleranceRefusals` sits beside `ambiguities`
   * and `oversizedBuckets` as run METADATA on an `{ ok: true }` result; nothing
   * escalated it.
   *
   * WHY THE CHANGE IS CORRECT. A signal that has to be found is not a control.
   * The same misconfiguration now returns through the outcome union, which no
   * caller can ignore without ignoring the outcome.
   *
   * ⚠️ AND THE OLD SIGNAL WAS ALSO DATA-DEPENDENT — see test 5, where the same
   * class of misconfiguration produced no metadata at all because nothing paired.
   *
   * DERIVATION. The gate returns before `toleranceRefusals` is even declared. */
  const outcome = runSetReconciliation(CROSS_CURRENCY())
  assert.equal(outcome.ok, false)
  if (!outcome.ok) assert.equal(outcome.refusal.kind, 'declared_units_disagree')
})

/* ==================================================================== *
 * 2. THE SAME-CURRENCY, DIFFERENT-EXPONENT CASE
 *
 * 🛑 THE CASE A CURRENCY-ONLY CHECK MISSES, AND THE ONE A NAIVE C16
 * IMPLEMENTATION WILL MISS TOO. `sameUnit` (`model/reconciliation.ts:631`)
 * compares currency AND exponent; the admission check it is not wired into
 * (`:1092`) compares `gross.currency` ALONE. Two sides both in SGD at different
 * exponents is a hundredfold error, and today it is admitted.
 *
 * `tests/scenarios/recon-corpus.ts:3559` already names this as an uncovered gap:
 * *"No scenario mixes exponents within one population — every amount is exponent
 * 2."* Nothing mixes them ACROSS populations either.
 * ==================================================================== */

const SGD_EXPONENT_0_STATEMENT = [
  row('doc-bank-sgd0-1', 'INV-9001', 1000n, SGD_0, '2026-03-06'),
  row('doc-bank-sgd0-2', 'INV-9002', 1000n, SGD_0, '2026-03-06'),
]

test('test_the_same_currency_at_two_exponents_refuses_the_run_and_names_the_exponent', () => {
  /* WHAT THIS ASSERTED BEFORE C16: that SGD 1000.00 (100000 minor, exponent 2)
   * against SGD 1000 (1000 minor, exponent 0) — the same money written two ways,
   * or a hundredfold error, and nothing could tell which — was ADMITTED on both
   * sides, because `admitOne` compared `gross.currency` ALONE and both said
   * `'SGD'`. The mismatch surfaced later, inside a pass, as two
   * `toleranceRefusals` from `subtractMoney`.
   *
   * WHY THE CHANGE IS CORRECT. §5.7: an admission defect was surfacing as a
   * tolerance artefact, three layers from its cause. `sameUnit` compares currency
   * AND exponent and always did; the old check simply was not wired into it.
   *
   * DERIVATION. Left declares `{SGD,2}`, right `{SGD,0}`. `guardUnit` passes on
   * both — an exponent of 0 is a perfectly valid declaration, JPY is one — so the
   * refusal comes from `sameUnit`'s SECOND line and is `exponent_mismatch`, not
   * `currency_mismatch`. That distinction is the whole reason C16 uses `sameUnit`
   * rather than a hand-rolled currency comparison. */
  assert.deepEqual(refusalOf(inputOf(SGD_LEDGER, SGD_EXPONENT_0_STATEMENT, EXACT_MONEY, null, SGD_2, SGD_0)), {
    kind: 'declared_units_disagree',
    refusal: { kind: 'exponent_mismatch' },
  })
})

/* ==================================================================== *
 * 3. COMPARISON 3 — THE AMOUNT TOLERANCE'S DENOMINATION IS CHECKED, BOTH OF THEM
 *
 * ⚠️ THIS HEADING READ *"IS NEVER CHECKED"*. A money tolerance was validated ONLY
 * at the moment a candidate pairing reached `toleranceAdmits`, so a tolerance
 * declared in a denomination neither side used was either a buried refusal or
 * COMPLETELY SILENT depending on whether anything happened to pair — a property
 * of the DATA, not of the configuration. Both routes to it are now gated: the
 * pairing-level tolerance and the per-strategy override.
 * ==================================================================== */

/** USD 100.00 — the figure `MONEY_VECTORS` already uses for a foreign amount. */
const USD_TOLERANCE: Tolerance = {
  kind: 'money',
  value: { currency: 'USD', amountMinor: 10000n, exponent: 2 },
}

const SGD_LEDGER_DISJOINT_REFS = [
  row('doc-ledger-sgd-3', 'INV-9003', 100000n, SGD_2),
  row('doc-ledger-sgd-4', 'INV-9004', 100000n, SGD_2),
]

/** The refusal both tolerance tests below must produce, spelled once. */
const PAIRING_TOLERANCE_REFUSAL: SetReconciliationRefusal = {
  kind: 'tolerance_unit_disagrees',
  tolerance: { kind: 'pairing' },
  refusal: { kind: 'currency_mismatch' },
}

test('test_a_money_tolerance_in_a_third_currency_refuses_the_run_even_when_nothing_would_have_paired', () => {
  /* WHAT THIS ASSERTED BEFORE C16, AND IT WAS THE PUREST STATEMENT OF THE HOLE:
   * NOTHING. `toleranceRefusals` empty, `postconditions` empty, outcome `ok`,
   * four items in the residue. Both sides were SGD and agreed with each other;
   * the tolerance was USD and agreed with neither — but the references were
   * disjoint, so `passIdentifierJoin` hit `if (right.length === 0) continue` for
   * every key and `toleranceAdmits` WAS NEVER CALLED. The misconfigured tolerance
   * was never read, never validated and never reported, and there was no
   * observable difference between this run and a correctly configured one that
   * simply found no matches.
   *
   * WHY THE CHANGE IS CORRECT. A money tolerance was validated only at the moment
   * a candidate pairing happened to reach it, which makes the firing of the check
   * a property of the DATA rather than of the CONFIGURATION. C16 reads it in the
   * gate, where the configuration lives.
   *
   * DERIVATION. `toleranceNamesUnit({kind:'money', USD}, {SGD,2})` delegates to
   * `sameUnit` and returns `currency_mismatch`; the refusal's `tolerance` names
   * `pairing` because this is `pairing.amountTolerance` itself and not an
   * override — and that arm carries no index, because there is one of it. */
  assert.deepEqual(
    refusalOf(inputOf(SGD_LEDGER, SGD_LEDGER_DISJOINT_REFS, USD_TOLERANCE)),
    PAIRING_TOLERANCE_REFUSAL,
  )
})

test('test_the_same_misconfigured_tolerance_gives_the_same_answer_when_a_pair_would_have_reached_it', () => {
  /* WHAT THIS ASSERTED BEFORE C16: two `toleranceRefusals` and no allocations —
   * `sameUnit(tolerance.value, delta.value)` inside `toleranceAdmits` refusing
   * `currency_mismatch` once per shared key. SAME CONFIGURATION ERROR AS THE TEST
   * ABOVE, DIFFERENT OBSERVABLE BEHAVIOUR, decided entirely by whether the data
   * happened to produce a candidate pair.
   *
   * WHY THE CHANGE IS CORRECT, and it is why this test is worth keeping rather
   * than folding into the one above: the two now assert the IDENTICAL value on
   * two different datasets. That equality is the property — a control on the
   * configuration must not depend on the rows. `assert.deepEqual` against the
   * same constant is how that is stated rather than described.
   *
   * DERIVATION. Identical to the test above; the gate returns before admission,
   * so the references never enter it. */
  assert.deepEqual(
    refusalOf(inputOf(SGD_LEDGER, SGD_STATEMENT_MATCHING, USD_TOLERANCE)),
    PAIRING_TOLERANCE_REFUSAL,
  )
})

test('test_a_per_strategy_tolerance_override_is_gated_too_and_the_refusal_names_the_binding', () => {
  /* 🛑 THE TEST THIS FILE WAS WRITTEN FOR, AND THE ONE THE PLAN WOULD HAVE MISSED.
   *
   * WHAT THIS ASSERTED BEFORE C16: two buried `toleranceRefusals`, exactly as the
   * pairing-level case did — and it recorded a FINDING ABOUT THE PLANNED FIX
   * rather than about the engine. `docs/build/wave-two-plan.md` §3.3(j) wrote
   * comparison 3 as `input.pairing.amountTolerance` and read nothing else, while
   * `StrategyBinding.amountTolerance` exists precisely to OVERRIDE it and
   * `runSetReconciliation` reads `binding.amountTolerance ??
   * input.pairing.amountTolerance`. The gate as drafted would have found nothing
   * wrong with this input and admitted the run.
   *
   * WHY THE CHANGE IS CORRECT. A gate that closed the pairing-level route and
   * left the override open would be §5.1 — a rule keyed on the convenient
   * landmark rather than on the property it protects — and it would have reported
   * the comparison closed. The shipped gate walks `input.strategyBindings`.
   *
   * DERIVATION. `pairing.amountTolerance` here is a unit-free `rounding`, so the
   * pairing-level check passes and cannot be the source of the refusal. The
   * BINDING at index 0 carries the USD money tolerance, so the loop refuses with
   * `tolerance: { kind: 'strategy_binding', index: 0 }` — the `strategy_binding`
   * arm rather than `pairing`, which is what tells an operator which of the two
   * tolerances to fix. That arm's index is REQUIRED, not nullable: a refusal from
   * this route always has one. */
  assert.deepEqual(refusalOf(inputOf(SGD_LEDGER, SGD_STATEMENT_MATCHING, EXACT_MONEY, USD_TOLERANCE)), {
    kind: 'tolerance_unit_disagrees',
    tolerance: { kind: 'strategy_binding', index: 0 },
    refusal: { kind: 'currency_mismatch' },
  })
})

/* ==================================================================== *
 * 4. THE NON-VACUITY HALF — WHAT MUST STILL BE ADMITTED AFTER C16
 *
 * 🛑 A FIXTURE THAT ONLY PROVES REFUSALS WOULD ALSO PASS AGAINST AN ENGINE THAT
 * REFUSED EVERYTHING. These three are the reason the tests above are evidence.
 * Every one of them must stay GREEN across C16 — if any turns red, the new gate
 * is over-refusing and the mutation table in §3.6 of the plan cannot tell you so.
 * ==================================================================== */

test('test_two_sides_agreeing_on_both_currency_and_exponent_still_match_and_leave_no_residue', () => {
  /* DERIVATION. Both sides SGD at exponent 2, both keys shared, amounts equal.
   * `toleranceAdmits` returns `{ ok: true, admitted: true,
   * signedVarianceMinor: 0 }`, and a zero variance selects
   * `{ kind: 'exact_identifier' }` over `tolerant_identifier` (`:1598-1601`).
   * `pourFifo` allocates min(100000, 100000) on each key. Every item closes, so
   * the residue is empty — a `fully_allocated` item is skipped at `:2995`. */
  const result = runOrFail(inputOf(SGD_LEDGER, SGD_STATEMENT_MATCHING))

  assert.deepEqual(result.refusedAtAdmission, [])
  assert.equal(result.state.allocations.length, 2)
  assert.deepEqual(
    result.state.allocations.map((a) => a.amount.amountMinor),
    [100000n, 100000n],
  )
  assert.deepEqual(
    result.state.allocations.map((a) => a.evidence.kind),
    ['exact_identifier', 'exact_identifier'],
  )
  assert.deepEqual(result.residue, [])
  assert.deepEqual(result.toleranceRefusals, [])
  assert.deepEqual(result.postconditions, [])
})

const SGD_EXPONENT_0_LEDGER = [
  row('doc-ledger-sgd0-1', 'INV-9001', 1000n, SGD_0),
  row('doc-ledger-sgd0-2', 'INV-9002', 1000n, SGD_0),
]

test('test_a_rounding_tolerance_carries_no_denomination_and_admits_an_exponent_zero_population', () => {
  /* DERIVATION, AND IT IS THE ONE C16'S GATE HAS TO GET RIGHT BY OMISSION.
   * `{ kind: 'rounding', minorUnits: n }` is expressed in MINOR UNITS and is
   * unit-free — `toleranceAdmits` reads `tolerance.minorUnits` and never calls
   * `sameUnit` on it (`model/reconciliation.ts:799-803`), which is why the
   * module's own docblock at `:778` says it *"is admitted against any
   * currency"*.
   *
   * Both sides here are SGD at EXPONENT 0, which agrees with neither the
   * exponent-2 population above nor any assumption a gate might smuggle in. The
   * run matches cleanly. C16's comparison 3 must skip the `rounding` arm
   * entirely; a gate that compared it against a declaration would turn this
   * red.
   *
   * ⚠️ UNCHANGED BY C16 EXCEPT FOR ONE ARGUMENT: both populations now DECLARE
   * `{SGD, 0}`, which is what they always were. `guardUnit` admits an exponent of
   * 0 — JPY is one — and `toleranceNamesUnit` returns null on the `rounding` arm
   * without consulting the declaration at all. Every assertion below is byte for
   * byte what it was before the change. */
  const result = runOrFail(
    inputOf(SGD_EXPONENT_0_LEDGER, SGD_EXPONENT_0_STATEMENT, EXACT_MONEY, null, SGD_0),
  )

  assert.deepEqual(result.refusedAtAdmission, [])
  assert.equal(result.state.allocations.length, 2)
  assert.deepEqual(
    result.state.allocations.map((a) => a.amount.amountMinor),
    [1000n, 1000n],
  )
  assert.deepEqual(result.residue, [])
  assert.deepEqual(result.toleranceRefusals, [])
  assert.deepEqual(result.postconditions, [])
})

/** SGD 995.00 against SGD 1000.00 — a 500-minor-unit shortfall on each key. */
const SGD_STATEMENT_SHORT = [
  row('doc-bank-sgd-short-1', 'INV-9001', 99500n, SGD_2, '2026-03-06'),
  row('doc-bank-sgd-short-2', 'INV-9002', 99500n, SGD_2, '2026-03-06'),
]

/** SGD 100.00 — the same figure as `USD_TOLERANCE`, in the sides' own unit. */
const SGD_TOLERANCE: Tolerance = {
  kind: 'money',
  value: { currency: 'SGD', amountMinor: 10000n, exponent: 2 },
}

test('test_a_money_tolerance_in_the_populations_own_unit_is_admitted_and_pairs_tolerantly', () => {
  /* DERIVATION. `sameUnit(tolerance.value, delta.value)` agrees — SGD against
   * SGD, exponent 2 against exponent 2 — so `ceilingMinor` is 10000 and the
   * variance of +500 on each key is inside it. `signedVarianceMinor` is
   * non-zero, so the evidence is `tolerant_identifier` and carries the variance
   * rather than discarding it.
   *
   * `pourFifo` allocates min(left residual 100000, right residual 99500) =
   * 99500 per key. The right side closes; each LEFT item keeps a residual of
   * 500 and lands in the residue as `obligation_not_fully_settled`, because
   * `obligationSide` is `'left'` and the settlement is `partially_allocated`
   * (`model/reconciliation.ts:3007-3011`). Every figure here is a literal.
   *
   * This is comparison 3's positive control: a money tolerance that AGREES with
   * the declaration must go on working. */
  const result = runOrFail(inputOf(SGD_LEDGER, SGD_STATEMENT_SHORT, SGD_TOLERANCE))

  assert.deepEqual(result.toleranceRefusals, [])
  assert.equal(result.state.allocations.length, 2)
  assert.deepEqual(
    result.state.allocations.map((a) => a.amount.amountMinor),
    [99500n, 99500n],
  )
  assert.deepEqual(result.state.allocations.map((a) => a.evidence), [
    { kind: 'tolerant_identifier', on: REF_PATH, signedVarianceMinor: 500n },
    { kind: 'tolerant_identifier', on: REF_PATH, signedVarianceMinor: 500n },
  ])

  assert.equal(result.residue.length, 2)
  assert.deepEqual(
    result.residue.map((e) => e.cause.kind),
    ['obligation_not_fully_settled', 'obligation_not_fully_settled'],
  )
  assert.deepEqual(result.postconditions, [])
})

/* ==================================================================== *
 * 5. THE SPLIT ITSELF — the meaningless state is now UNCONSTRUCTIBLE
 *
 * 🛑 WHAT THE SINGLE ARM ALLOWED. C16 shipped one arm carrying both
 * comparisons: `{ kind: 'declared_units_disagree'; against: 'other_side' |
 * 'amount_tolerance'; strategyIndex: number | null; refusal: MoneyRefusal }`.
 * `strategyIndex` means something only for the tolerance comparison, so
 * `{ against: 'other_side', strategyIndex: 3 }` — a cross-side comparison
 * naming a strategy binding that took no part in it — COMPILED, and the only
 * thing that said otherwise was a sentence in the declaration's comment. §5.5:
 * an invalid state the type made legal, inside a type written to close a
 * different fail-open.
 *
 * NO BEHAVIOUR MOVED WITH THE SPLIT. Every test above asserts the same claim it
 * asserted before; only the spelling of the refusal changed. This section is
 * what makes that a claim about the TYPE rather than about the three call sites
 * that happen to construct it today.
 *
 * HOW IT BITES IN BOTH DIRECTIONS, and it is the device
 * `tests/model/no-text-deep.test.ts` uses. Every rejection below is a
 * `@ts-expect-error` that MUST error; if the split is ever undone the directive
 * goes unused, which is `TS2578`, and `npm test` runs `typecheck:tests` before
 * it executes a single assertion. The three ACCEPTANCES carry no directive at
 * all, so a shape that over-rejects fails just as loudly.
 *
 * ⚠️ AND ONE HONEST CAVEAT. The rejections below rest on excess-property
 * checking, which applies to FRESH object literals — exactly what the engine's
 * three construction sites are, and not what a widened variable is. The
 * key-set assertion at the end of this section is the freshness-independent
 * half: it reads `keyof` off each arm and fails if either arm carries a field
 * the other one's meaning needs.
 * ==================================================================== */

/* -- 5a. THE REJECTIONS. Each was constructible under the single arm.
 *
 * ⚠️ THE DIRECTIVE SITS ON THE OFFENDING FIELD, NOT ON THE DECLARATION.
 * `@ts-expect-error` suppresses errors on the line IMMEDIATELY following it, and
 * an excess-property error is reported at the property, several lines into the
 * literal. Written above `export const` the directive is unused — `TS2578` —
 * while the real error fires anyway, so the assertion would be red for the wrong
 * reason. Placing it on the field also names exactly which field is refused. */

export const _crossSideWithAStrategyIndex: SetReconciliationRefusal = {
  kind: 'declared_units_disagree',
  // @ts-expect-error — THE BAD COMBINATION THE RULING NAMES: a cross-side
  // refusal carrying a strategy index. Nothing about comparing left's
  // declaration against right's involves a strategy binding.
  strategyIndex: 3,
  refusal: { kind: 'currency_mismatch' },
}

export const _crossSideWithAnAgainstDiscriminator: SetReconciliationRefusal = {
  kind: 'declared_units_disagree',
  // @ts-expect-error — the discriminator that carried both comparisons. There
  // is nothing left for `against` to discriminate: the kind does it.
  against: 'other_side',
  refusal: { kind: 'exponent_mismatch' },
}

export const _pairingToleranceWithAnIndex: SetReconciliationRefusal = {
  kind: 'tolerance_unit_disagrees',
  // @ts-expect-error — the pairing-level tolerance naming a binding. There is
  // ONE `pairing.amountTolerance`, so there is nothing to index.
  tolerance: { kind: 'pairing', index: 0 },
  refusal: { kind: 'currency_mismatch' },
}

export const _strategyToleranceWithoutItsIndex: SetReconciliationRefusal = {
  kind: 'tolerance_unit_disagrees',
  // @ts-expect-error — the per-strategy arm WITHOUT its index. The old shape
  // made this legal by typing the field `number | null`; a refusal from that
  // route always has an index, so the arm requires one.
  tolerance: { kind: 'strategy_binding' },
  refusal: { kind: 'currency_mismatch' },
}

/* -- 5b. THE ACCEPTANCES. No directive: over-rejection fails here. ------- */

export const _crossSideRefusal: SetReconciliationRefusal = {
  kind: 'declared_units_disagree',
  refusal: { kind: 'exponent_mismatch' },
}

export const _pairingToleranceRefusal: SetReconciliationRefusal = {
  kind: 'tolerance_unit_disagrees',
  tolerance: { kind: 'pairing' },
  refusal: { kind: 'currency_mismatch' },
}

export const _strategyToleranceRefusal: SetReconciliationRefusal = {
  kind: 'tolerance_unit_disagrees',
  tolerance: { kind: 'strategy_binding', index: 0 },
  refusal: { kind: 'currency_mismatch' },
}

/* -- 5c. THE FRESHNESS-INDEPENDENT HALF — the key sets, read off the arms.
 *
 * `never` unless the two key sets are identical in BOTH directions, so a field
 * added to either arm and a field removed from the expected set both fail. The
 * annotation is what turns `never` into a compile error. -------------------- */

type ExactKeys<T, K extends PropertyKey> = [Exclude<keyof T, K>] extends [never]
  ? [Exclude<K, keyof T>] extends [never]
    ? true
    : never
  : never

type ArmOf<K extends SetReconciliationRefusal['kind']> = Extract<
  SetReconciliationRefusal,
  { kind: K }
>

/** The cross-side arm carries its reason and NOTHING else. */
export const _crossSideCarriesOnlyItsReason: ExactKeys<
  ArmOf<'declared_units_disagree'>,
  'kind' | 'refusal'
> = true

/** The tolerance arm carries its reason and WHICH tolerance. */
export const _toleranceArmNamesWhichTolerance: ExactKeys<
  ArmOf<'tolerance_unit_disagrees'>,
  'kind' | 'tolerance' | 'refusal'
> = true

/* Inertness guard — the same shape as `no-text-deep`'s. A section of pure type
 * assertions runs no assertions, so the runner would report it as zero tests
 * whether or not it holds. This one test makes its presence observable. */
test('test_the_split_refusal_kinds_are_both_reachable_from_the_engine', () => {
  assert.equal(refusalOf(CROSS_CURRENCY()).kind, 'declared_units_disagree')
  assert.equal(
    refusalOf(inputOf(SGD_LEDGER, SGD_LEDGER_DISJOINT_REFS, USD_TOLERANCE)).kind,
    'tolerance_unit_disagrees',
  )
  assert.equal(_crossSideCarriesOnlyItsReason && _toleranceArmNamesWhichTolerance, true)
})

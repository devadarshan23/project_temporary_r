/**
 * O-15 — AN EMPTY POPULATION REFUSES, AND THE BOUNDARY WITH C13 IS THE SUBJECT.
 *
 * 🛑 WHAT WAS TRUE BEFORE THIS RULING, STATED AS THE THING THE FILE EXISTS TO
 * STOP. Nothing refused a side that presented ZERO rows, and every conservation
 * post-condition accumulates from zero: `checkPostconditions` walks
 * `state.items`, so over an empty side `admittedMinor !== accountedMinor`
 * compares `0 !== 0`, the residue partition is a partition of the empty set, and
 * all five arms are `count > 0` tests. A bank statement that failed to parse, a
 * source endpoint that returned nothing, or a run handed no document produced a
 * CLEAN, FULLY-RECONCILED CLOSE OVER NOTHING. Month-end green because nothing
 * was loaded.
 *
 * 🛑 AND THE DISTINCTION THAT DECIDES THE DESIGN, ASSERTED HERE FROM BOTH SIDES.
 * C13's `population_wholly_refused` is rows PRESENTED and none admitted — a
 * parsing or mapping failure, whose residue carries one reason per row and IS
 * the output, which is why it REPORTS. O-15 is nothing presented at all — an
 * ingestion or configuration failure, with no row to carry a reason and no
 * residue to preserve, which is why it REFUSES. Two pathologies, two remedies.
 * Test 3 below runs both inputs through the same engine and asserts each gets
 * its own answer; merge the arms and exactly one of the two goes red whichever
 * direction the merge is made in.
 *
 * ⚠️ EVERY EXPECTATION HERE WAS HAND-DERIVED BEFORE THE FILE WAS RUN, by reading
 * `runSetReconciliation`'s gate sequence, `presentedRows`, `admitOne` and
 * `checkPostconditions`. That is `tests/scenarios/recon-corpus.ts:10-22`'s rule
 * and it applies for the same reason: an expectation copied out of the engine is
 * a constant compared to itself.
 *
 * ⚠️ THE FIXTURE IS BUILT HERE RATHER THAN IMPORTED FROM THE CORPUS, so the
 * declaration has a SECOND independent construction site. `docs/HANDOFF.md`
 * §5.10 — a control witnessed by one builder is witnessed by that builder.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { presentedRowCount, runSetReconciliation } from '../../model/reconciliation.ts'
import type {
  PopulationBinding,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type {
  DataClass,
  ExtractedScalar,
  ExtractedValue,
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

/* ==================================================================== *
 * THE FIXTURE — one tenant, header-grain documents, one strategy
 * ==================================================================== */

const TENANT = 'tenant-empty-population-fixture' as TenantId
const DOC_TYPE = 'doctype-empty-population-fixture' as DocumentTypeId

const AMOUNT_PATH: FieldPath = p('amount')
const DATE_PATH: FieldPath = p('date')
const REF_PATH: FieldPath = p('reference')

/** G106, fail-closed: a path with no classification is UNREADABLE and refused. */
const CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<FieldPathKey, DataClass>([
  [k(AMOUNT_PATH), 'internal'],
  [k(DATE_PATH), 'internal'],
  [k(REF_PATH), 'internal'],
])

function value(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

/**
 * ⚠️ `lines: []` ON EVERY DOCUMENT HERE, AND IT IS LOAD-BEARING FOR TEST 4.
 * `presentedRows` derives ONE header-grain row from a document with no lines, so
 * a zero-line document is NOT an empty population — it presents a transaction.
 */
function documentOf(docId: string, reference: string, amount: ExtractedScalar): SourceDocument {
  return {
    tenantId: TENANT,
    id: docId as SourceDocumentId,
    documentTypeId: DOC_TYPE,
    filename: `${docId}.csv`,
    storageRef: `fixture://${docId}`,
    extracted: {
      [k(AMOUNT_PATH)]: value(amount),
      [k(DATE_PATH)]: value({ kind: 'date', value: '2026-03-03' }),
      [k(REF_PATH)]: value({ kind: 'identifier', value: reference }),
    },
    lines: [],
    /* C18. Hand-built rows, not files: there is no trailer to find and none is
     * expected. The OFF arm, stated rather than defaulted. */
    controlTotal: { kind: 'not_declared_by_format' },
    ingestedAt: '2026-04-01T09:00:00.000Z',
    /* Truthful — pass F ruled the sandbox is synthetic-only and enforced. */
    synthetic: true,
    purgeAfter: '2033-04-01T09:00:00.000Z',
    purgedAt: null,
  }
}

function money(minor: bigint): ExtractedScalar {
  return { kind: 'money', value: { currency: 'SGD', amountMinor: minor, exponent: 2 } }
}

/** A row admission cannot read: prose where the amount belongs. C13's shape. */
function prose(): ExtractedScalar {
  return { kind: 'text', value: 'per remittance advice' }
}

/**
 * 🛑 THE FIELD THIS BUILDER TAKES IS THE POINT OF THE FILE, AND WHERE IT SITS IS
 * THE CONTROL. `emptyExpectation` is a parameter of the BINDING — the source's
 * own statement about its nature, FDE-set and auditable — and not an argument to
 * `runSetReconciliation`. A boolean on the call would be §5.2: an off-switch on
 * the check, reachable by whoever finds the refusal inconvenient on close day.
 */
function population(emptyExpectation: 'refuses' | 'permitted'): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE,
      amount: AMOUNT_PATH,
      date: DATE_PATH,
      identifiers: [REF_PATH],
    },
    /* C18. No trailer in a hand-built row, and the TYPE says so too. */
    carriesControlTotal: 'never',
    emptyExpectation,
    /* C16 — declared, never seeded from row one. */
    declaredUnit: { currency: 'SGD', exponent: 2 },
    normalisation: { ops: [], then: 'exact', maxInputChars: 64 },
    counterparty: null,
    description: null,
  }
}

function inputOf(options: {
  readonly leftDocuments: readonly SourceDocument[]
  readonly rightDocuments: readonly SourceDocument[]
  readonly leftEmpty?: 'refuses' | 'permitted'
  readonly rightEmpty?: 'refuses' | 'permitted'
}): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'exact_identifier', on: REF_PATH }
  return {
    runId: 'run-empty-population-fixture' as RunId,
    tenantId: TENANT,
    left: population(options.leftEmpty ?? 'refuses'),
    right: population(options.rightEmpty ?? 'refuses'),
    leftDocuments: [...options.leftDocuments],
    rightDocuments: [...options.rightDocuments],
    pairing: {
      cardinality: 'one_to_one',
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
    subsetSumBound: { maxMembers: 8, stepBudget: 5000, maxBucketSize: 50 },
    readerCandidateCap: 5,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    /* C13. Required by the engine. 9999 rather than something tighter for a
     * stated reason: test 3 refuses EVERY row on one side deliberately, and a
     * tighter ceiling would refuse that run through C13's rate arm before
     * `population_wholly_refused` could be observed. A fixture choice; not a
     * recommendation, and `PRODUCT.md` forbids reading it as one. */
    admissionRefusalCeilingBasisPoints: 9_999,
  }
}

function runOrFail(input: SetReconciliationInput): SetReconciliationResult {
  const outcome = runSetReconciliation(input)
  assert.ok(outcome.ok, `the engine refused the fixture: ${outcome.ok ? '' : outcome.refusal.kind}`)
  return outcome.result
}

const LEDGER = documentOf('doc-ledger-1', 'INV-9001', money(125_00n))
const STATEMENT = documentOf('doc-statement-1', 'INV-9001', money(125_00n))
const UNREADABLE_LEDGER = documentOf('doc-ledger-dead', 'INV-9002', prose())

/* ==================================================================== *
 * 1 — NOTHING PRESENTED REFUSES, AND THE ARM NAMES WHICH SIDE
 * ==================================================================== */

test('a side that presented no rows refuses the run, and the arm names it', () => {
  /**
   * Derivation: `presentedRowsOnSide([])` folds `presentedRowCount` over zero
   * documents and is 0; the ledger binding declares `'refuses'`; the gate
   * returns before admission. Without the gate this input returns `ok: true` —
   * the statement admits its one row, no strategy pairs it, it lands in the
   * residue as `no_strategy_paired`, and `postconditions` is EMPTY because every
   * conservation arm accumulates from zero over the missing side.
   */
  const outcome = runSetReconciliation(inputOf({ leftDocuments: [], rightDocuments: [STATEMENT] }))
  assert.equal(outcome.ok, false, 'a run over a ledger nobody loaded was reported as a close')
  if (outcome.ok) return
  assert.deepStrictEqual(outcome.refusal, {
    kind: 'population_empty_and_not_expected',
    side: 'left',
  })
})

test('the same gate runs on the right side, and that is the direction that hides', () => {
  /**
   * The only witness that the gate iterates BOTH sides. An unloaded statement
   * side against a full ledger reconciles to a residue of unpaid invoices, which
   * reads as a bad month rather than as a broken feed — so the arm has to name
   * `right` rather than the run having to be inferred from its shape.
   */
  const outcome = runSetReconciliation(inputOf({ leftDocuments: [LEDGER], rightDocuments: [] }))
  assert.equal(outcome.ok, false, 'a run over a statement nobody loaded was reported as a close')
  if (outcome.ok) return
  assert.deepStrictEqual(outcome.refusal, {
    kind: 'population_empty_and_not_expected',
    side: 'right',
  })
})

/* ==================================================================== *
 * 2 — THE ESCAPE, AND IT IS A DECLARATION
 * ==================================================================== */

test('a side declared capable of being empty is admitted, and reports no arm at all', () => {
  /**
   * 🛑 THE SAME INPUT AS TEST 1 WITH ONE FIELD CHANGED, ON THE BINDING. That is
   * the control: a new tenant's first close, a dormant account or a genuinely
   * quiet week says so in CONFIGURATION, where an FDE sets it and an auditor can
   * read it — never as an argument somebody adds at the call site.
   *
   * Derivation: the gate finds `'permitted'` and does not refuse. The statement
   * admits one row of 12500; nothing pairs, because there is nothing on the left
   * to pair with; the row lands in the residue carrying its whole gross.
   * `checkPostconditions` skips the left rate at `presented === 0` and the right
   * at `admitted > 0`, so `population_wholly_refused` fires on NEITHER — and
   * `admittedMinor` (12500) equals `accountedMinor` (0 allocated + 12500
   * residue-carried), so nothing else fires either.
   */
  const result = runOrFail(
    inputOf({ leftDocuments: [], rightDocuments: [STATEMENT], leftEmpty: 'permitted' }),
  )
  assert.deepStrictEqual([...result.postconditions], [], 'a declared-empty side reported an arm')
  assert.deepStrictEqual(
    result.admissionRates.map((r) => ({ ...r })),
    [
      { side: 'left', presented: 0, admitted: 0, refused: 0 },
      { side: 'right', presented: 1, admitted: 1, refused: 0 },
    ],
    'the rate is recorded unconditionally, and three zeros on the left are three statements',
  )
  assert.equal(result.residue.length, 1, 'the unpaired payment is still visible')
})

/* ==================================================================== *
 * 3 — THE PARTITION, ASSERTED FROM BOTH SIDES ON THE SAME ENGINE
 * ==================================================================== */

test('nothing presented and presented-but-none-admitted get different answers', () => {
  /**
   * 🛑 THE TEST THAT KEEPS THE TWO ARMS DISJOINT.
   *
   * Left half: rows PRESENTED, none admitted. `UNREADABLE_LEDGER` carries prose
   * where the amount belongs, so `admitOne` refuses it and the row reaches the
   * residue WITH ITS REASON. The run must return `ok: true` and report
   * `population_wholly_refused` — refusing here would delete the only output
   * there is.
   *
   * Right half: nothing presented. Test 1 is that half, and it must refuse.
   *
   * Widen O-15 to swallow C13's case and this test's first assertion goes red;
   * fire C13's arm at `presented === 0` and test 2's empty `postconditions` goes
   * red. Neither mutation moves the other, which is what "partition" means here.
   */
  const result = runOrFail(
    inputOf({ leftDocuments: [UNREADABLE_LEDGER], rightDocuments: [STATEMENT] }),
  )
  assert.deepStrictEqual(
    [...result.postconditions],
    [{ kind: 'population_wholly_refused', side: 'left', sideRowCount: 1 }],
    'a side that presented a row and admitted none must REPORT, beside its residue',
  )
  assert.equal(result.refusedAtAdmission.length, 1, 'and the row survives as a residue entry')
  assert.deepStrictEqual(result.residue[0]?.cause, {
    kind: 'admission_refused',
    refusal: { kind: 'amount_not_money', found: 'text' },
  })
})

/* ==================================================================== *
 * 4 — THE BOUNDARY AT ONE ROW
 * ==================================================================== */

test('a document with no lines presents one row, so a side holding it is not empty', () => {
  /**
   * `presentedRows` derives a single header-grain row at `lineIndex: null` from
   * a document with no lines — one invoice PDF is one transaction. So `lines:
   * []` is NOT an empty population, and the gate must not read it as one.
   *
   * ⚠️ HONEST NOTE ON WHAT THIS DOES AND DOES NOT WITNESS. `presentedRowsOnSide`
   * and `documents.length` AGREE today: every document presents at least one
   * row, so a side presents zero rows exactly when it holds no document.
   * Rewriting the gate as `documents.length === 0` would therefore turn nothing
   * red — the argument for folding the shared rule is §5.3 (one spelling of "how
   * many rows is this", so the gate follows admission's grain rather than
   * contradicting it), not a behavioural difference this test can catch. Said
   * here rather than implied by coverage.
   */
  assert.equal(presentedRowCount(LEDGER), 1, 'a zero-line document presents one row')
  const result = runOrFail(inputOf({ leftDocuments: [LEDGER], rightDocuments: [STATEMENT] }))
  assert.equal(result.state.items.size, 2, 'both header-grain rows were admitted')
  assert.deepStrictEqual([...result.postconditions], [])
})

/* ==================================================================== *
 * 5 — THE ESCAPE HAS NO RUN-LEVEL HOME, PROVED AT COMPILE TIME
 *
 * 🛑 THE §5.2 DEFECT IS A REACHABILITY DEFECT AND NO FIXTURE CAN WITNESS IT.
 * Moving `emptyExpectation` to `SetReconciliationInput` would turn NOTHING red —
 * the tests above would keep passing while the control became an argument any
 * caller could set. The control against that is the type's LOCATION, so the
 * location is what is asserted, at compile time and not at runtime.
 *
 * 🛑 BOTH ARE WRITTEN AS A CONSTRAINT AND NOT AS A `? true : never`, AND THE
 * FIRST DRAFT OF THIS BLOCK GOT THAT WRONG. `export type X = … ? true : never`
 * COMPILES when it resolves to `never` — an alias may name `never` — so the
 * assertion was vacuous and said nothing. It was caught by running mutation (b)
 * rather than by reading, which is `CLAUDE.md`'s own warning about
 * `AssertNoTextDeep`: *"`Assert<never>` compiles, so a vacuous proof is
 * indistinguishable from a real one by reading."* `Assert<T extends true>`
 * rejects `false` with TS2344, which is a compile ERROR rather than a quieter
 * type.
 *
 * ⚠️ VERIFIED RED BOTH WAYS, by hand, before being trusted green: replacing
 * either `true` below with `false` produces TS2344, and moving the field to
 * `SetReconciliationInput` produced TS2339 on the first and TS2344 on the
 * second. Neither is a substitute for review; both are cheaper than one.
 * ==================================================================== */

type Assert<T extends true> = T

export type _theEscapeLivesOnTheBinding = Assert<
  PopulationBinding['emptyExpectation'] extends 'refuses' | 'permitted' ? true : false
>

export type _theEscapeIsNotARunParameter = Assert<
  'emptyExpectation' extends keyof SetReconciliationInput ? false : true
>

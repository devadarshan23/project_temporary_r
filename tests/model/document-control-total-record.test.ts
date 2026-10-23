/**
 * G236 (#198 [W-8]) — EVERY DOCUMENT'S CONTROL TOTAL IS RECORDED
 * UNCONDITIONALLY, INCLUDING MET TRAILERS.
 *
 * 🛑 WHAT WAS WRONG, STATED AS THE THING A READER COULD SEE. C18 records a
 * control-total DISAGREEMENT as a `PopulationDefect`. A document whose declared
 * line count and declared total both MATCH produced no defect and therefore
 * appeared in no channel — so **a met trailer that produces no row is
 * indistinguishable from a file that declared nothing.** An operator could not
 * tell *"this file vouched for itself and was right"* from *"this file said
 * nothing"*, and the first is EVIDENCE while the second is ABSENCE.
 * `design/routes/close.html`'s panel *What each file said about itself* draws
 * both, and its first row is a met trailer the engine could not report.
 *
 * That inverted the posture the engine holds everywhere else. G114: *a bound
 * that was hit is recorded, never silently absorbed.* C13 made `admissionRates`
 * unconditional for exactly this reason one grain up.
 *
 * 🛑 THE HONEST RED, RECORDED AS SUCH. There was no field to read, so §2 below
 * did not COMPILE at the red commit — a `TS2339`, not a runtime failure. That is
 * the honest red for a model addition. §1 is the guard that keeps this file from
 * being red-against-a-typo: every assertion in it PASSES AT BASE, before
 * `documentAccounts` existed, and it is what shows the fixture really does carry
 * one met trailer and one disagreement.
 *
 * ⚠️ THE FIXTURE IS BUILT HERE RATHER THAN IMPORTED FROM THE CORPUS, so the
 * declaration has a SECOND independent construction site — `docs/HANDOFF.md`
 * §5.10, a control witnessed by one builder is witnessed by that builder.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runSetReconciliation, POPULATION_DEFECT_KINDS } from '../../model/reconciliation.ts'
import type {
  AssertNoTextDeep,
  PopulationBinding,
  RunDocumentAccount,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type {
  ControlTotal,
  DataClass,
  ExtractedLine,
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

/* G214 — a `FieldPath` is a token list minted only by the seam. A refusal here
 * is a defect in this file, not a runtime condition, so the unwrap throws. */
function p(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`fixture declares an unparseable FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}
const k = (path: FieldPath): FieldPathKey => fieldPathKey(path)

/* ==================================================================== *
 * THE FIXTURE — three documents, three different trailer states
 *
 * · `MET`    declares 2 rows and 300.00, and presents exactly that.
 * · `SHORT`  declares 3 rows and presents 2 — `declared_line_count_disagrees`.
 * · `SILENT` carries no trailer at all — `not_declared_by_format`.
 *
 * ⚠️ THE THIRD DOCUMENT IS WHY THE VERDICT UNION HAS THREE REACHABLE ARMS AND
 * NOT TWO. `nothing_to_check` and `agreed` are DIFFERENT ANSWERS, and collapsing
 * them is the exact conflation this ruling exists to end one level down.
 *
 * 🛑 THE TWO SIDES DECLARE `carriesControlTotal` DIFFERENTLY AND THAT IS THE
 * FIXTURE'S ONE PIECE OF CARE. `carriesControlTotal` is the TYPE's declaration
 * and `ControlTotal.kind` is the PARSER's; a disagreement between them is
 * itself a C18 defect. Putting `SILENT` on a side declared `'always'` would fire
 * `control_total_arm_disagrees_with_document_type` on the one document this file
 * needs to read `nothing_to_check`, and putting `MET` on a side declared
 * `'never'` would fire it on the one document that has to read `agreed` — which
 * would leave the ruling's own arm unwitnessed. So the LEFT side declares
 * `'always'` and carries the two documents with trailers, and the RIGHT side
 * declares `'never'` and carries the one without.
 * ==================================================================== */

const TENANT = 'tenant-document-account-fixture' as TenantId
const DOC_TYPE = 'doctype-document-account-fixture' as DocumentTypeId

const AMOUNT_PATH: FieldPath = p('amount')
const DATE_PATH: FieldPath = p('date')
const REF_PATH: FieldPath = p('reference')

const CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<FieldPathKey, DataClass>([
  [k(AMOUNT_PATH), 'internal'],
  [k(DATE_PATH), 'internal'],
  [k(REF_PATH), 'internal'],
])

const MET = 'doc-trailer-met' as SourceDocumentId
const SHORT = 'doc-trailer-short' as SourceDocumentId
const SILENT = 'doc-no-trailer' as SourceDocumentId

function value(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

function sgd(minor: bigint): Money {
  return { currency: 'SGD', amountMinor: minor, exponent: 2 }
}

function row(index: number, reference: string, minor: bigint): ExtractedLine {
  return {
    index,
    fields: {
      [k(AMOUNT_PATH)]: value({ kind: 'money', value: sgd(minor) }),
      [k(DATE_PATH)]: value({ kind: 'date', value: '2026-03-03' }),
      [k(REF_PATH)]: value({ kind: 'identifier', value: reference }),
    },
  }
}

function documentOf(
  docId: SourceDocumentId,
  lines: readonly ExtractedLine[],
  controlTotal: ControlTotal,
): SourceDocument {
  return {
    tenantId: TENANT,
    id: docId,
    documentTypeId: DOC_TYPE,
    filename: `${docId}.csv`,
    storageRef: `fixture://${docId}`,
    extracted: {},
    lines: [...lines],
    controlTotal,
    ingestedAt: '2026-04-01T09:00:00.000Z',
    synthetic: true,
    purgeAfter: '2033-04-01T09:00:00.000Z',
    purgedAt: null,
  }
}

/** Declares two rows and 300.00, and presents two rows summing to 300.00. */
const MET_DOCUMENT = documentOf(MET, [row(0, 'MET-1', 100_00n), row(1, 'MET-2', 200_00n)], {
  kind: 'declared',
  lineCount: 2,
  total: sgd(300_00n),
})

/** Declares three rows and presents two. The count comparison fires. */
const SHORT_DOCUMENT = documentOf(SHORT, [row(0, 'SHORT-1', 50_00n), row(1, 'SHORT-2', 50_00n)], {
  kind: 'declared',
  lineCount: 3,
  total: null,
})

/** An API payload: this format carries no trailer at all. */
const SILENT_DOCUMENT = documentOf(SILENT, [row(0, 'SILENT-1', 10_00n)], {
  kind: 'not_declared_by_format',
})

function population(carriesControlTotal: 'always' | 'never'): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE,
      amount: AMOUNT_PATH,
      date: DATE_PATH,
      identifiers: [REF_PATH],
    },
    carriesControlTotal,
    emptyExpectation: 'refuses',
    declaredUnit: { currency: 'SGD', exponent: 2 },
    normalisation: { ops: [], then: 'exact', maxInputChars: 64 },
    counterparty: null,
    description: null,
  }
}

function inputOf(): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'exact_identifier', on: REF_PATH }
  return {
    runId: 'run-document-account-fixture' as RunId,
    tenantId: TENANT,
    left: population('always'),
    right: population('never'),
    leftDocuments: [MET_DOCUMENT, SHORT_DOCUMENT],
    rightDocuments: [SILENT_DOCUMENT],
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
    /* G227. No floor stated: this file is about what a FILE said about itself,
     * not about how confidently a field was read. */
    confidenceFloors: new Map<FieldPathKey, number>(),
    subsetSumBound: { maxMembers: 8, stepBudget: 5000, maxBucketSize: 50 },
    readerCandidateCap: 5,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    /* Permissive so C13's rate arm cannot refuse this run: nothing here is
     * refused at admission, and a tighter number would be a figure invented to
     * look careful. `PRODUCT.md` forbids reading any of these as advice. */
    admissionRefusalCeilingBasisPoints: 9_999,
  }
}

function runOrFail(): SetReconciliationResult {
  const outcome = runSetReconciliation(inputOf())
  assert.ok(outcome.ok, `the engine refused the fixture: ${outcome.ok ? '' : outcome.refusal.kind}`)
  return outcome.result
}

function accountsFor(
  result: SetReconciliationResult,
  id: SourceDocumentId,
): readonly RunDocumentAccount[] {
  return result.documentAccounts.filter((account) => account.sourceDocumentId === id)
}

/* ====================================================================== *
 * §1  THE GUARD — every assertion here PASSED AT BASE
 *
 * Reported as the split the issue asked for. These are what make the red in §2
 * a red about the missing channel rather than about a broken fixture.
 * ====================================================================== */

test('guard · `admissionRates` is per SIDE and has exactly two entries', () => {
  const result = runOrFail()
  assert.equal(result.admissionRates.length, 2)
  assert.deepEqual(
    result.admissionRates.map((rate) => rate.side),
    ['left', 'right'],
  )
  /* THREE documents on the run and TWO rates. That arithmetic IS the gap: a
   * per-side channel cannot answer a per-document question, and G195 said so in
   * the other direction — a document's own total is not the ARRIVALS
   * denominator. Two rulings, two denominators, both standing. */
  const input = inputOf()
  assert.equal(input.leftDocuments.length + input.rightDocuments.length, 3)
})

test('guard · a DISAGREEING trailer already produces a `PopulationDefect`', () => {
  const result = runOrFail()
  const reported = result.postconditions.filter(
    (failure) => failure.kind === 'population_integrity_reported',
  )
  assert.ok(
    reported.some(
      (failure) =>
        failure.defect.kind === 'declared_line_count_disagrees' &&
        failure.defect.sourceDocumentId === SHORT,
    ),
    'the SHORT document must disagree, or §2 has nothing to contrast the met one with',
  )
})

test('guard · a MET trailer produces NO defect anywhere — the gap itself', () => {
  const result = runOrFail()
  const namingMet = result.postconditions.filter(
    (failure) =>
      failure.kind === 'population_integrity_reported' &&
      failure.defect.kind !== 'admission_refusal_rate_above_ceiling' &&
      failure.defect.kind !== 'duplicate_item_address' &&
      failure.defect.sourceDocumentId === MET,
  )
  /* 🛑 ZERO, AND THE ZERO IS THE WHOLE ISSUE. The MET document declared two rows
   * and 300.00 and presented exactly that. Every comparison passed, so nothing
   * fires — and before G236 that meant the file appeared in no channel at all,
   * indistinguishable from a file that declared nothing. */
  assert.deepEqual(namingMet, [])
  assert.ok(
    result.postconditions.some(
      (failure) =>
        failure.kind === 'population_integrity_reported' &&
        failure.defect.kind === 'declared_line_count_disagrees',
    ),
    'and the OTHER file does fire, so the silence above is about MET and not about the run',
  )
})

test('guard · `POPULATION_DEFECT_KINDS` is unchanged at EIGHT', () => {
  /* 🛑 THE MET CASE IS A VERDICT ON A RECORD, NOT A NINTH DEFECT. Minting
   * `control_total_agreed` as a `PopulationDefect` would put a PASS into a list
   * whose every other member is a finding, and `POPULATION_DEFECT_DISPOSITION`
   * would then have to classify a non-defect as `'report'`. */
  assert.equal(POPULATION_DEFECT_KINDS.length, 8)
})

/* ====================================================================== *
 * §2  THE RED — it did not COMPILE before `documentAccounts` existed
 * ====================================================================== */

test('test_a_MET_trailer_produces_a_row_rather_than_a_silence', () => {
  const result = runOrFail()
  const [met] = accountsFor(result, MET)
  assert.ok(met !== undefined, 'the met document must be PRESENT rather than absent')

  assert.equal(met.side, 'left')
  assert.equal(met.trailer, 'declared')
  assert.equal(met.declaredLineCount, 2)
  assert.equal(met.declaredMinor, 300_00n)
  assert.equal(met.declaredExponent, 2)
  assert.equal(met.presented, 2)
  assert.equal(met.admitted, 2)
  assert.equal(met.refused, 0)

  /* 🛑 THE ARM THE RULING EXISTS FOR. Both comparisons passed and the record
   * says so in its own voice — *this file vouched for itself and was right* —
   * rather than leaving an operator to infer it from an absence. */
  assert.equal(met.verdict.kind, 'agreed')
})

test('test_every_document_gets_exactly_one_account_whatever_its_trailer_said', () => {
  const result = runOrFail()
  assert.deepEqual(
    result.documentAccounts.map((account) => [account.side, account.sourceDocumentId]),
    [
      ['left', MET],
      ['left', SHORT],
      ['right', SILENT],
    ],
    'left in supplied order, then right — one entry per document, no document missing',
  )
})

test('test_a_disagreeing_trailer_carries_the_PopulationDefect_verbatim', () => {
  const result = runOrFail()
  const [short] = accountsFor(result, SHORT)
  assert.ok(short !== undefined)
  assert.equal(short.declaredLineCount, 3)
  assert.equal(short.presented, 2)
  assert.equal(short.declaredMinor, null, 'this trailer declared no total')
  assert.equal(short.declaredExponent, null)

  assert.equal(short.verdict.kind, 'reported')
  const defects = short.verdict.kind === 'reported' ? short.verdict.defects : []
  const count = defects.find((defect) => defect.kind === 'declared_line_count_disagrees')
  assert.ok(count !== undefined && count.kind === 'declared_line_count_disagrees')
  /* 🛑 THE SAME VALUE, NOT A COPY OF IT. C18's operands are read off the defect
   * the account carries; re-declaring `declaredCount` and `documentRowCount` on
   * `RunDocumentAccount` would be two vocabularies for one finding (§5.3). */
  assert.equal(count.declaredCount, 3)
  assert.equal(count.documentRowCount, 2)
})

test('test_a_format_with_NO_trailer_reads_nothing_to_check_and_never_agreed', () => {
  const result = runOrFail()
  const [silent] = accountsFor(result, SILENT)
  assert.ok(silent !== undefined)
  assert.equal(silent.side, 'right')
  assert.equal(silent.trailer, 'not_declared_by_format')
  assert.equal(silent.declaredLineCount, null)
  assert.equal(silent.declaredMinor, null)
  assert.equal(silent.presented, 1)
  /* 🛑 THE WHOLE RULING IN ONE ASSERTION. A file that said nothing is not a file
   * that vouched for itself and was right. If these two ever collapse to one
   * arm, G236 has been undone without anybody editing its row. */
  assert.equal(silent.verdict.kind, 'nothing_to_check')
})

test('test_the_account_joins_the_defect_channels_rather_than_replacing_them', () => {
  const result = runOrFail()
  /* Every document-grain defect that reached `postconditions` also reaches an
   * account, and nothing reaches an account that reached no comparison. Two
   * grains of report over ONE comparison — never two comparisons. */
  const inPostconditions = result.postconditions
    .filter((failure) => failure.kind === 'population_integrity_reported')
    .map((failure) => (failure.kind === 'population_integrity_reported' ? failure.defect : null))
    .filter((defect) => defect !== null)
  const inAccounts = result.documentAccounts.flatMap((account) =>
    account.verdict.kind === 'reported' ? [...account.verdict.defects] : [],
  )
  assert.equal(inPostconditions.length, inAccounts.length)
  for (const defect of inAccounts) {
    assert.ok(
      inPostconditions.includes(defect),
      'the account must carry the SAME defect object, not an equal-looking rebuild',
    )
  }
})

/* ====================================================================== *
 * §3  CONTAINMENT — verified RED, and the red is the point
 *
 * ⚠️ `Assert<never>` COMPILES, so a vacuous proof reads exactly like a real one.
 * Every `@ts-expect-error` below MUST error: weaken the proof and the directive
 * goes unused, which is `TS2578`, and `npm test` runs `typecheck:tests` before a
 * single assertion executes. The SAFE case carries no directive, so a proof that
 * over-rejects fails just as loudly. Same device as
 * `tests/model/no-text-deep.test.ts`.
 * ====================================================================== */

/** The real record passes. A branded `SourceDocumentId` is an admissible leaf. */
export type _RunDocumentAccountIsProvenHere = AssertNoTextDeep<RunDocumentAccount>

// @ts-expect-error — A FILENAME IS COUNTERPARTY-CONTROLLED and this record is
// rendered and logged (invariant 6). This is the exact edit somebody will want
// the first time the drawn table looks unfriendly, which is why it is named here
// rather than left to a reviewer to remember.
export type _AFilenameOnTheAccountIsRefused = AssertNoTextDeep<RunDocumentAccount & { readonly filename: string }>

// @ts-expect-error — and a raw currency code is refused for `MoneyRefusal`'s
// reason: `Money.currency` is a bare `string`, which is why this record carries
// minor units and an exponent instead.
export type _AMoneyOnTheAccountIsRefused = AssertNoTextDeep<RunDocumentAccount & { readonly declaredTotal: Money }>

/* ====================================================================== *
 * §4  THE INERTNESS GUARD — §3 is types, and a type is erased before node runs
 * ====================================================================== */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODULE_TEXT = readFileSync(join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')

test('the account channel is UNCONDITIONAL in the module, not behind a condition', () => {
  /* The one property no fixture can witness: that the fold is not wrapped in a
   * test somebody could add later. `documentAccounts(...)` is pushed on the same
   * statement level as `checkPopulationIntegrity`, above the refusal filter. */
  assert.ok(
    MODULE_TEXT.includes('runDocumentAccounts.push(...documentAccounts(integrityInput, defects))'),
    'the unconditional fold has moved or acquired a condition — G236 is the word UNCONDITIONALLY',
  )
  assert.ok(
    MODULE_TEXT.includes('const defects = checkPopulationIntegrity(integrityInput)'),
    'the defects and the accounts must be taken over ONE hoisted input, or the second ' +
      'manufactures `agreed` rows the first would have contradicted',
  )
})

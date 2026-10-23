/**
 * O-16 — INCOMPLETE IS AN OUTCOME DISTINCT FROM INCONSISTENT.
 *
 * 🛑 WHAT IS TRUE AT THE TREE TODAY, STATED AS THE THING THIS FILE EXISTS TO
 * STOP, AND MEASURED RATHER THAN ASSUMED. Every post-condition is an
 * internal-consistency check over the ADMITTED set and none compares that set
 * against the outside world: `checkPostconditions` iterates `state.items`, and
 * every arm is a count or a comparison WITHIN that map. So the engine can say
 * *"what I was given balances"* and never *"I was given everything"*.
 *
 * ⚠️ THE DEFECT IS NOT A THEORY. Run the §1 fixture through the engine as it
 * stands — a ledger of three rows, one of which admission cannot read — and it
 * returns:
 *
 *     postconditions: []
 *     admissionRates: [{ side: 'left',  presented: 3, admitted: 2, refused: 1 },
 *                      { side: 'right', presented: 2, admitted: 2, refused: 0 }]
 *
 * **An empty `postconditions` is a clean close, and the engine's OWN record on
 * the line above it says a row was dropped.** C13 made `admissionRates`
 * unconditional, so the shortfall is not merely knowable — it is already
 * recorded, in the same result object, and nothing joins it to an outcome. That
 * is the whole of O-16: *inconsistent* means do-not-persist; *incomplete* means
 * sound over less than everything, which is a different act for a different
 * person.
 *
 * 🛑 WHAT THIS FILE ASSERTS, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * It asserts the half the OWNER RULED: a run has a THIRD terminal outcome and a
 * consumer can tell it apart from the other two — `docs/HANDOFF.md` G153,
 * `docs/build/owner-rulings-10-aug.md` §3.18, *"every consumer of a run's status
 * gains a third case, and the contracts' run status enum changes."*
 *
 * It does NOT assert where the engine's completeness FINDING lives.
 * `docs/build/wave-two-plan.md` §9.3 proposes
 * `SetReconciliationResult.completeness`, and §12 flags that placement as the
 * one decision that is the owner's and not the plan's — *"whether this lands on
 * `status` or beside `postconditions` is NOT decided."* Pinning an undecided
 * shape in a test is how a test starts governing a decision it was not given, so
 * this file names no channel. Every assertion below goes through the JOIN.
 *
 * ⚠️ THE JOIN'S NAME IS THIS FILE'S PROPOSAL; THE PROPERTY IS THE RULING. The
 * engine has no clock and no identity — `docs/build/wave-two-plan.md` §9.3:
 * *"the engine reports the finding and the caller sets the status"* — so
 * `terminalRunStatus()` is a TOTAL, PURE derivation from a finished result to
 * the outcome a caller records, and not the engine setting anything. It is one
 * function rather than a rule at every call site for G111's stated reason:
 * correctness that lives at call sites is correctness that drifts. If O-16 lands
 * it under another name, change the import — do not weaken the assertions.
 *
 * ⚠️ EVERY EXPECTATION HERE WAS HAND-DERIVED BEFORE THE FILE WAS RUN, by reading
 * `runSetReconciliation`'s gate sequence, `presentedRows`, `admitOne`,
 * `checkPopulationIntegrity` and `checkPostconditions`; the run above CONFIRMED
 * the derivation rather than supplying it. `tests/scenarios/recon-corpus.ts:10-22`
 * — an expectation copied out of the engine is a constant compared to itself.
 *
 * ⚠️ THE FIXTURE IS BUILT HERE RATHER THAN IMPORTED FROM THE CORPUS, so the
 * declaration has a SECOND independent construction site. `docs/HANDOFF.md`
 * §5.10 — a control witnessed by one builder is witnessed by that builder.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { runSetReconciliation, terminalRunStatus } from '../../model/reconciliation.ts'
import type {
  PopulationBinding,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type {
  ControlTotal,
  DataClass,
  ExtractedLine,
  ExtractedScalar,
  ExtractedValue,
  PairingStrategy,
  RunStatus,
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
 * THE FIXTURE — one tenant, LINE-GRAIN documents, one strategy
 *
 * ⚠️ LINE-GRAIN AND NOT HEADER-GRAIN, AND THAT IS LOAD-BEARING TWICE. A
 * document with no lines presents exactly one row, so a partial admission
 * cannot be expressed on one; and C18's count comparison reads
 * `lines.length`, so §4's trailer has something to disagree with.
 * ==================================================================== */

const TENANT = 'tenant-run-completeness-fixture' as TenantId
const DOC_TYPE = 'doctype-run-completeness-fixture' as DocumentTypeId

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

function money(minor: bigint): ExtractedScalar {
  return { kind: 'money', value: { currency: 'SGD', amountMinor: minor, exponent: 2 } }
}

/**
 * A row admission cannot read: prose where the amount belongs.
 *
 * 🛑 THE DROPPED ROW IS DROPPED BY A ROUTINE, BORING CAUSE, DELIBERATELY. A
 * mapper that emitted "per remittance advice" into the amount column is the
 * commonest partial load there is; it needs no exotic input, and it produces a
 * run whose ledger is PERFECT over the rows that survived.
 */
function prose(): ExtractedScalar {
  return { kind: 'text', value: 'per remittance advice' }
}

function row(index: number, reference: string, amount: ExtractedScalar): ExtractedLine {
  return {
    index,
    fields: {
      [k(AMOUNT_PATH)]: value(amount),
      [k(DATE_PATH)]: value({ kind: 'date', value: '2026-03-03' }),
      [k(REF_PATH)]: value({ kind: 'identifier', value: reference }),
    },
  }
}

function documentOf(
  docId: string,
  lines: readonly ExtractedLine[],
  controlTotal: ControlTotal,
): SourceDocument {
  return {
    tenantId: TENANT,
    id: docId as SourceDocumentId,
    documentTypeId: DOC_TYPE,
    filename: `${docId}.csv`,
    storageRef: `fixture://${docId}`,
    extracted: {},
    lines: [...lines],
    controlTotal,
    ingestedAt: '2026-04-01T09:00:00.000Z',
    /* Truthful — pass F ruled the sandbox is synthetic-only and enforced. */
    synthetic: true,
    purgeAfter: '2033-04-01T09:00:00.000Z',
    purgedAt: null,
  }
}

function population(carriesControlTotal: 'always' | 'never'): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE,
      amount: AMOUNT_PATH,
      date: DATE_PATH,
      identifiers: [REF_PATH],
    },
    carriesControlTotal,
    /* O-15. Neither side is ever empty here; the escape is not this file's
     * subject and stating it is cheaper than defaulting it. */
    emptyExpectation: 'refuses',
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
  readonly leftCarriesControlTotal?: 'always' | 'never'
}): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'exact_identifier', on: REF_PATH }
  return {
    runId: 'run-completeness-fixture' as RunId,
    tenantId: TENANT,
    left: population(options.leftCarriesControlTotal ?? 'never'),
    right: population('never'),
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
    /* G227. No floor stated, so nothing is held — O-16's two channels are
     * measured over the same population they were before. */
    confidenceFloors: new Map<FieldPathKey, number>(),
    subsetSumBound: { maxMembers: 8, stepBudget: 5000, maxBucketSize: 50 },
    readerCandidateCap: 5,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    /* C13. 9999 basis points rather than something tighter for a stated reason:
     * §1 refuses one row in three (3333bp) ON PURPOSE, and a tighter ceiling
     * would refuse the whole run through C13's rate arm before the SOUND
     * partial close this file is about could be observed. A fixture choice; not
     * a recommendation, and `PRODUCT.md` forbids reading it as one. */
    admissionRefusalCeilingBasisPoints: 9_999,
  }
}

function runOrFail(input: SetReconciliationInput): SetReconciliationResult {
  const outcome = runSetReconciliation(input)
  assert.ok(outcome.ok, `the engine refused the fixture: ${outcome.ok ? '' : outcome.refusal.kind}`)
  return outcome.result
}

const NO_TRAILER: ControlTotal = { kind: 'not_declared_by_format' }

/** Three rows presented. The third carries prose where the amount belongs. */
const LEDGER_PARTIAL = documentOf(
  'doc-ledger-partial',
  [
    row(0, 'INV-8001', money(100_00n)),
    row(1, 'INV-8002', money(200_00n)),
    row(2, 'INV-8003', prose()),
  ],
  NO_TRAILER,
)

/** The same file with the unreadable row removed. Everything presented is admitted. */
const LEDGER_WHOLE = documentOf(
  'doc-ledger-whole',
  [row(0, 'INV-8001', money(100_00n)), row(1, 'INV-8002', money(200_00n))],
  NO_TRAILER,
)

/**
 * C18. Two rows arrived and the file's own trailer says three. Every row that
 * DID arrive is readable, so admission is whole and the shortfall is knowable
 * from ONE PLACE ONLY: what the file said about itself.
 */
const LEDGER_TRUNCATED = documentOf(
  'doc-ledger-truncated',
  [row(0, 'INV-8001', money(100_00n)), row(1, 'INV-8002', money(200_00n))],
  { kind: 'declared', lineCount: 3, total: null },
)

const STATEMENT = documentOf(
  'doc-statement',
  [row(0, 'INV-8001', money(100_00n)), row(1, 'INV-8002', money(200_00n))],
  NO_TRAILER,
)

/* ==================================================================== *
 * 1 — THE RULING. SOUND OVER LESS THAN EVERYTHING IS NOT A CLOSE.
 * ==================================================================== */

test('a run sound over an admitted set smaller than what was presented is INCOMPLETE', () => {
  /**
   * Derivation: the ledger presents three rows; `admitOne` refuses the third at
   * `amount_not_money` and the other two are admitted; the statement's two rows
   * are admitted and pair 1×1 by `exact_identifier` at exactly 10000 and 20000
   * minor units, so both pour in full. `checkPostconditions` then finds nothing:
   * `population_wholly_refused` skips both sides (`admitted > 0`), no admitted
   * item is open, no address repeats, and `admittedMinor` equals
   * `accountedMinor` because the row that would have unbalanced it was never
   * admitted to be counted.
   *
   * 🛑 THE ASSERTION ON `postconditions` IS THE PREMISE, NOT THE SUBJECT, and it
   * is stated so the file goes red for the right reason if the premise moves.
   * `[]` here is the engine reporting a spotless ledger over a file it can see
   * it did not fully read.
   */
  const result = runOrFail(inputOf({ leftDocuments: [LEDGER_PARTIAL], rightDocuments: [STATEMENT] }))

  assert.deepStrictEqual(
    [...result.postconditions],
    [],
    'PREMISE MOVED: this fixture used to produce a spotless ledger, which is what ' +
      'made it the witness. If an arm now fires here, re-derive before editing.',
  )
  assert.deepStrictEqual(
    result.admissionRates.map((rate) => ({ ...rate })),
    [
      { side: 'left', presented: 3, admitted: 2, refused: 1 },
      { side: 'right', presented: 2, admitted: 2, refused: 0 },
    ],
    'C13 records the shortfall unconditionally — the engine already KNOWS it read two of three',
  )

  assert.equal(
    terminalRunStatus(result),
    'incomplete',
    'a run that balanced over two of the three rows it was presented reported an outcome ' +
      'indistinguishable from a full close. This is O-16.',
  )
})

/* ==================================================================== *
 * 2 — THE CONTROL, WITHOUT WHICH TEST 1 IS SATISFIED BY A CONSTANT
 * ==================================================================== */

test('a run that admitted everything it was presented is completed', () => {
  /**
   * 🛑 THE SAME INPUT AS TEST 1 WITH ONE ROW REMOVED. `terminalRunStatus` that
   * returned `'incomplete'` unconditionally would satisfy test 1 and every
   * downstream consumer would learn to ignore the state — which is precisely
   * what a control exists to stop.
   *
   * Derivation: 2 presented / 2 admitted on both sides, both pairs pour in
   * full, residue empty, `postconditions` empty.
   */
  const result = runOrFail(inputOf({ leftDocuments: [LEDGER_WHOLE], rightDocuments: [STATEMENT] }))

  assert.deepStrictEqual([...result.postconditions], [])
  assert.deepStrictEqual(
    result.admissionRates.map((rate) => ({ ...rate })),
    [
      { side: 'left', presented: 2, admitted: 2, refused: 0 },
      { side: 'right', presented: 2, admitted: 2, refused: 0 },
    ],
    'nothing was presented that was not admitted, on either side',
  )
  assert.equal(
    terminalRunStatus(result),
    'completed',
    'a whole run must still close. `incomplete` that fires on everything is a state ' +
      'consumers will route around.',
  )
})

/* ==================================================================== *
 * 3 — THE PARTITION. THREE OUTCOMES, PAIRWISE DISTINCT.
 * ==================================================================== */

test('incomplete and inconsistent are DIFFERENT outcomes, and neither is completed', () => {
  /**
   * 🛑 THE ASSERTION THE RULING IS ACTUALLY ABOUT. *Inconsistent* means the
   * ledger is unsound and must NOT be persisted. *Incomplete* means the ledger
   * is sound and is persistable, over a population that is not the population.
   * Collapsing them either DISCARDS a sound partial result or PERSISTS an
   * unsound one, and a consumer cannot choose between those two acts unless the
   * outcome tells them apart.
   *
   * ⚠️ THE UNSOUND RESULT IS HAND-BUILT ON TOP OF A REAL ONE, AND THAT IS SAID
   * RATHER THAN HIDDEN. No input reaches `open_item_missing_from_residue`
   * through `runSetReconciliation` — that is the point of a post-condition, and
   * `checkPostconditions` is exported and called directly for exactly this
   * reason. Test 2's real, sound result supplies every other field, so the ONE
   * difference between the two operands below is the arm on the channel.
   */
  const sound = runOrFail(inputOf({ leftDocuments: [LEDGER_WHOLE], rightDocuments: [STATEMENT] }))
  const incomplete = runOrFail(
    inputOf({ leftDocuments: [LEDGER_PARTIAL], rightDocuments: [STATEMENT] }),
  )
  const unsound: SetReconciliationResult = {
    ...sound,
    postconditions: [{ kind: 'open_item_missing_from_residue', count: 1 }],
  }

  const completed = terminalRunStatus(sound)
  const partial = terminalRunStatus(incomplete)
  const inconsistent = terminalRunStatus(unsound)

  assert.notEqual(
    partial,
    inconsistent,
    'a partial load and an unsound ledger reported the SAME outcome. One of the two ' +
      'consumers is then acting on the wrong instruction, whichever way the collapse went.',
  )
  assert.notEqual(partial, completed, 'a partial load reported a close')
  assert.notEqual(inconsistent, completed, 'an unsound ledger reported a close')

  assert.equal(inconsistent, 'failed', 'do-not-persist is the run that failed')
  assert.equal(partial, 'incomplete')
  assert.equal(completed, 'completed')
})

/* ==================================================================== *
 * 4 — A SECOND, INDEPENDENT PRODUCER, AND THE CHANNEL IT ARRIVES ON
 * ==================================================================== */

test('a file that declared more rows than it delivered is incomplete, not merely reported', () => {
  /**
   * 🛑 THE OTHER HALF OF THE HOLE, AND IT FAILS DIFFERENTLY FROM TEST 1. Here
   * admission is WHOLE — every row that arrived was readable — and the only
   * witness to the shortfall is the file's own trailer. C18 reports it as
   * `population_integrity_reported` ON `postconditions`, whose own docblock
   * tells a caller that non-empty means the ledger may be unsound. So today the
   * truncated file and the dropped ledger row wear the same clothes as a
   * conservation failure, and a caller reading one channel cannot act.
   *
   * ⚠️ THIS TEST ASSERTS THE OUTCOME AND NOT THE CHANNEL. Whether C18's report
   * arms stay on `postconditions`, move, or are mirrored elsewhere is the
   * placement decision `docs/build/wave-two-plan.md` §12 reserves to the owner.
   * What may NOT survive O-16 is a consumer that cannot tell this run from an
   * unsound one.
   *
   * Derivation: `presentedRowCount` is `lines.length` = 2; the trailer declares
   * 3; `POPULATION_DEFECT_DISPOSITION.declared_line_count_disagrees` is
   * `'report'`, so the run stays `ok: true`. The trailer declares no total, so
   * the count comparison is the only one that runs.
   */
  const result = runOrFail(
    inputOf({
      leftDocuments: [LEDGER_TRUNCATED],
      rightDocuments: [STATEMENT],
      leftCarriesControlTotal: 'always',
    }),
  )

  assert.deepStrictEqual(
    [...result.postconditions],
    [
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'declared_line_count_disagrees',
          sourceDocumentId: 'doc-ledger-truncated' as SourceDocumentId,
          declaredCount: 3,
          documentRowCount: 2,
        },
      },
    ],
    'PREMISE MOVED: C18 used to report the count disagreement here. Re-derive before editing.',
  )
  assert.deepStrictEqual(
    result.admissionRates.map((rate) => ({ ...rate })),
    [
      { side: 'left', presented: 2, admitted: 2, refused: 0 },
      { side: 'right', presented: 2, admitted: 2, refused: 0 },
    ],
    'admission is WHOLE here — this shortfall is invisible to C13 and to every ' +
      'internal check, which is why the trailer is the only witness',
  )

  assert.equal(
    terminalRunStatus(result),
    'incomplete',
    'a file that declared three rows and delivered two produced a persistable ledger ' +
      "wearing an unsound run's outcome",
  )
})

/* ==================================================================== *
 * 5 — THE VOCABULARY, PROVED AT COMPILE TIME
 *
 * 🛑 A RUNTIME TEST CANNOT REACH A TYPE, AND `RunStatus` IS A TYPE. The four
 * members are checked against the wire by `tests/contracts/run-status-wire.test.mjs`
 * and by `tools/check-wire-mirror.mjs`'s `run_status` pair; what neither can do
 * is fail when `incomplete` is absent from the MODEL, because both derive the
 * expectation from the model and would then agree with it.
 *
 * 🛑 WRITTEN AS A CONSTRAINT AND NOT AS `? true : never`. `export type X = … ?
 * true : never` COMPILES when it resolves to `never` — an alias may name
 * `never` — so the assertion would be vacuous and say nothing. `Assert<T extends
 * true>` rejects `false` with TS2344, which is a compile ERROR. `CLAUDE.md`
 * makes the same warning about `AssertNoTextDeep`: a vacuous proof is
 * indistinguishable from a real one by reading.
 *
 * ⚠️ VERIFIED RED BY HAND BEFORE BEING TRUSTED GREEN — replacing either `true`
 * below with `false` produces TS2344 rather than a quieter type.
 * ==================================================================== */

type Assert<T extends true> = T

export type _incompleteIsARunStatus = Assert<'incomplete' extends RunStatus ? true : false>

/**
 * And the join answers IN that vocabulary rather than in a second one. A
 * derivation returning its own three-member enum would be §5.3 — two spellings
 * of one concept, drifting the first time either moved.
 */
export type _theJoinAnswersInRunStatus = Assert<
  ReturnType<typeof terminalRunStatus> extends RunStatus ? true : false
>

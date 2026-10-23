/* ====================================================================== *
 * ILLUSTRATIVE SYNTHETIC DATA. Every counterparty, id, amount and narrative
 * below is fictional and machine-written; none of it is a customer result.
 *
 * WHAT THIS FILE IS. A March-close-shaped corpus for `model/reconciliation.ts`
 * — a receivables ledger on one side, a bank statement on the other — plus, for
 * every scenario, the outcome THE SPECIFICATION REQUIRES. It contains no test
 * assertions and imports no test runner. Two other agents import from here.
 *
 * 🛑 THE EXPECTATIONS WERE DERIVED FROM THE SPECIFICATION, NOT FROM THE ENGINE.
 * Each one was written by reading `model/reconciliation.ts`'s stated rules,
 * `model/domain.ts`'s `set_reconciliation` archetype and the rulings in
 * `docs/HANDOFF.md` §3 (G105 above all), and then hand-tracing the fold. NOTHING
 * HERE WAS PRODUCED BY RUNNING `runSetReconciliation()` AND PASTING THE OUTPUT
 * BACK. That distinction is the whole value of the file: an expectation copied
 * from the engine is a constant compared to itself (`docs/HANDOFF.md` §5.6) and
 * it blesses a bug as correct forever.
 *
 * SO: A FAILING SCENARIO IS AN OPEN QUESTION, NOT A VERDICT. It means the module
 * and this file disagree about what the spec says. Read the `derivedFrom`
 * citations on the expectation before changing either. Do NOT "fix" an
 * expectation by running the engine.
 *
 * WHY IT EXISTS. `model/reconciliation.ts` landed with no construction site
 * anywhere — the largest instance in this record of `docs/HANDOFF.md` §5.10:
 * a green `tsc` over a types-only module that nothing constructs tells you
 * nothing at all. These are construction sites. They witness content, which is
 * the thing a compile-time assertion cannot do.
 *
 * ON THE HOUSE RULE AGAINST INVENTED DATA. `CLAUDE.md` forbids fabricating data
 * and mocking APIs. A fixture is neither: §5.10 demands construction sites,
 * `model/examples.ts` already carries fixtures, and pass F ruled that the
 * sandbox is synthetic-only and enforced — so `synthetic: true` is set on every
 * document here, truthfully. What is NOT invented anywhere in this file: a
 * customer, a price, an SLA, a benchmark, a model identifier (G104), or a
 * product-recommended value for any of the three bounds the engine refuses to
 * default. The bounds below are THIS CORPUS's stated choices; OR-2 is open and
 * nothing here closes it.
 *
 * READING THE EXPECTED RESIDUE ORDER. `runSetReconciliation()` builds the
 * residue as: every admission refusal (all of the left population's, then all of
 * the right's, each in admission order), followed by every still-open admitted
 * item in admission order (the whole left population, then the whole right).
 * The expected arrays below are written in that order deliberately — the
 * ordering is itself part of the expectation, because a re-run must produce an
 * identical audit (A9(h), `RunTrigger.rerun`).
 * ====================================================================== */

import { DATA_CLASSES } from '../../model/domain.ts'
import type {
  ControlTotal,
  DataClass,
  ExtractedLine,
  ExtractedScalar,
  ExtractedValue,
  Money,
  PairingCardinality,
  PairingSpec,
  PairingStrategy,
  SourceDocument,
  Tolerance,
} from '../../model/domain.ts'
import type {
  DocumentTypeId,
  FieldPath,
  FieldPathKey,
  ModelCatalogEntryId,
  RunId,
  SourceDocumentId,
  TenantId,
} from '../../model/kernel.ts'
/* The one VALUE import from the engine. `admittedStateFor` below needs the
 * module's own admission function; re-implementing it here would be a second
 * vocabulary (§5.3) and the fixture would then be testing itself. */
import { admitPopulation } from '../../model/reconciliation.ts'
/* G214 — a `FieldPath` is a token list and this corpus may not mint one any
 * other way. `fieldPathKey()` is the only thing that turns one into a key. */
import { parseFieldPath, fieldPathKey } from '../../model/field-path.ts'
import type {
  AdmissionRefusal,
  AdmittedItem,
  AmountAnchor,
  EngineAssignableDisposition,
  EngineMeter,
  ExtractionRefusal,
  IdentifierNormalisation,
  ItemRef,
  ItemSettlement,
  MatchingState,
  MoneyRefusal,
  MoneyUnit,
  NormalisationDefect,
  PairingEvidence,
  PopulationBinding,
  PopulationSide,
  PostconditionFailure,
  ReaderOutcome,
  ResidueCause,
  SetReconciliationInput,
  SetReconciliationRefusal,
  SimilarityMetric,
  StrategyBinding,
  SubsetSumBound,
  ToleranceDirection,
  ToleranceRefusal,
} from '../../model/reconciliation.ts'

/* ====================================================================== *
 * §A  THE VOCABULARY — field paths, tenant, document types
 * ====================================================================== */

/**
 * ⚠️ `reference` IS ONE PATH SHARED BY BOTH POPULATIONS, AND THAT IS A REAL
 * ENGINE CONSTRAINT RATHER THAN A FIXTURE CONVENIENCE.
 *
 * `passIdentifierJoin(state, on, …)` indexes BOTH sides by
 * `item.identifiers.get(on)` — one `FieldPath`, both populations — and
 * `passFuzzyReference` is handed `input.left.spec.identifiers[0]` and applies it
 * to the right population too. So a definition whose two sides expose their
 * reference under different paths cannot be joined on it at all, whatever the
 * normalisation says. Amount, date and counterparty are genuinely per-side and
 * are spelled per-side here.
 */
/**
 * G214 — FIXTURE-ONLY UNWRAP. `parseFieldPath()` refuses rather than throwing,
 * because a path from a counterparty document or an operator form is a runtime
 * condition. A path written HERE is a literal in this file, so a refusal is a
 * defect in the corpus and failing at module load says so loudest.
 *
 * ⚠️ EVERY PATH BELOW WAS A DOTTED STRING UNTIL 22 Aug 2026 AND NONE OF THEM
 * ADDRESSED ANYTHING — `FieldPath` was `= string`. The translation is mechanical:
 * `'ledger.amount_due'` becomes `['ledger', 'amount_due']`. What it BUYS is that
 * `['bank.credit', 'amount']` and `['bank', 'credit', 'amount']` are now two
 * different paths; under the old alias they were the same six-word string.
 */
function p(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`recon-corpus declares an unparseable FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}

/** The key a path takes when it has to key a `Map`, a `Set` or a `Record`. */
const k = (path: FieldPath): FieldPathKey => fieldPathKey(path)

export const PATHS = {
  /** Shared join key. Both populations must present the reference here. */
  reference: p('txn', 'reference'),
  ledgerAmount: p('ledger', 'amount_due'),
  ledgerDate: p('ledger', 'issued_on'),
  ledgerCounterparty: p('ledger', 'customer_code'),
  bankAmount: p('bank', 'credit_amount'),
  bankDate: p('bank', 'value_date'),
  bankCounterparty: p('bank', 'payer_code'),
  /** The one counterparty-controlled prose field in the corpus. */
  bankNarrative: p('bank', 'narrative'),
} as const

export const TENANT = 'ten_SYN_harbourline' as TenantId
export const OTHER_TENANT = 'ten_SYN_not_harbourline' as TenantId
export const DOC_TYPE_LEDGER = 'doctype_SYN_ar_ledger' as DocumentTypeId
export const DOC_TYPE_BANK = 'doctype_SYN_bank_statement' as DocumentTypeId

/**
 * A catalogue ROW id, not a model identifier. G104 bans a model identifier
 * literal in engine code and the same discipline is worth keeping in a fixture:
 * nothing here names a vendor, a family or a version.
 */
export const SYNTHETIC_CATALOGUE_ROW = 'mce_SYN_catalogue_row_1' as ModelCatalogEntryId

/**
 * G106, fail-closed: a path absent from this map is UNREADABLE and the row is
 * refused. Every path the corpus uses is classified here except where a scenario
 * deliberately withholds one.
 *
 * The narrative is `personal` because a bank narrative names people. That class
 * travels onto `ReaderRequest.untrustedDescriptionClass`, where the CALLER — not
 * this engine — checks it against `ModelUseConfig.maxDataClassInPrompt`.
 */
export const STANDARD_CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<
  FieldPathKey,
  DataClass
>([
  [k(PATHS.reference), DATA_CLASSES.internal],
  [k(PATHS.ledgerAmount), DATA_CLASSES.internal],
  [k(PATHS.ledgerDate), DATA_CLASSES.internal],
  [k(PATHS.ledgerCounterparty), DATA_CLASSES.internal],
  [k(PATHS.bankAmount), DATA_CLASSES.internal],
  [k(PATHS.bankDate), DATA_CLASSES.internal],
  [k(PATHS.bankCounterparty), DATA_CLASSES.internal],
  [k(PATHS.bankNarrative), DATA_CLASSES.personal],
])

/** The caller's projection of `FieldSpec.modelProcessingAllowed`. Fail-closed. */
export const STANDARD_PROMPT_ELIGIBLE: ReadonlySet<FieldPathKey> = new Set<FieldPathKey>([
  k(PATHS.bankNarrative),
])

/** Nothing may reach a prompt. Used to witness the second fail-closed gate. */
export const NOTHING_PROMPT_ELIGIBLE: ReadonlySet<FieldPathKey> = new Set<FieldPathKey>()

/**
 * G227 — NO FIELD ON THIS RUN DECLARED A CONFIDENCE FLOOR, said as a value.
 *
 * ⚠️ IT IS THE CORPUS DEFAULT AND IT IS NOT A NUMBER. `PRODUCT.md` forbids
 * inventing a figure and `FieldSpec.confidenceFloor`'s own surface does not exist
 * yet ([M2-3], under G139), so the corpus states *no floor* rather than a floor
 * somebody would later cite. A scenario that wants a held read supplies its own
 * map, and `tests/model/below-floor-held.test.ts` is where one does.
 */
export const NO_CONFIDENCE_FLOORS: ReadonlyMap<FieldPathKey, number> = new Map<
  FieldPathKey,
  number
>()

/**
 * ⚠️ THREE NUMBERS THE ENGINE REFUSES TO DEFAULT, STATED HERE FOR THE CORPUS
 * AND FOR NOTHING ELSE. `docs/build/reconciliation-engine.md` §9 records that
 * the value of `readerCandidateCap` in particular is an open ruling (OR-2/OR-4)
 * and that a refusal is not a bound either. These are fixture choices sized to
 * make the scenarios legible; they are not a recommendation and no document may
 * cite them as one.
 */
export const CORPUS_SUBSET_SUM_BOUND: SubsetSumBound = {
  maxMembers: 8,
  stepBudget: 5000,
  maxBucketSize: 50,
}
export const CORPUS_READER_CANDIDATE_CAP = 5
export const CORPUS_SIMILARITY_MAX_CHARS = 128

/**
 * C13 — A FOURTH NUMBER THE ENGINE REFUSES TO DEFAULT, AND IT CARRIES THE SAME
 * DISCLAIMER AS THE THREE ABOVE. A fixture choice sized to make the scenarios
 * legible; not a recommendation, and no document may cite it as one. O-8 is the
 * open ruling that owns the real value, and a refusal is not a bound either.
 *
 * 🛑 IT MAY NOT BE 10000. That value is illegal at the gate: at 10000 the
 * comparison reduces to `admitted < 0` and the control is off. `9999` would be
 * legal and would be the same evasion one basis point away, so the number below
 * is chosen from the corpus instead: 5000 is the HIGHEST rate any pre-C13
 * scenario exhibits on a side that admitted anything — two refused rows of four
 * in `badDateAndSameDayTieBreak`, one of two in `mixedExponentIsRefusedAtAdmission`
 * — and the comparison is strictly `>`, so a rate AT it is admitted and every
 * existing scenario keeps its stated outcome.
 */
export const CORPUS_ADMISSION_REFUSAL_CEILING_BASIS_POINTS = 5000

/* ====================================================================== *
 * §B  BUILDERS — a row reads like a spreadsheet line
 * ====================================================================== */

/**
 * ⚠️ `bigint` SINCE 19 Sep 2026 — G286, AND EVERY CALL SITE MOVED WITH IT.
 * `mny(70_00)` is now `mny(70_00n)`. That is a REPRESENTATION change and not a
 * VALUE change: seventy dollars is still seventy dollars, and this file's rule
 * — *"THE EXPECTATIONS WERE DERIVED FROM THE SPECIFICATION, NOT FROM THE
 * ENGINE"* — is about the value, which no `n` suffix can move.
 *
 * ⚠️ IT TAKES `bigint` RATHER THAN CONVERTING A `number` INSIDE, DELIBERATELY.
 * A `number` parameter would have been a one-line change with no call site
 * touched — and it would have made a fixture above 2^53 minor units
 * INEXPRESSIBLE in the corpus, which is the exact ceiling G286 was taken to
 * raise. A builder that cannot state the value the ruling is about is a builder
 * that cannot witness it.
 */
export function mny(amountMinor: bigint, currency = 'SGD', exponent = 2): Money {
  return { currency, amountMinor, exponent }
}

export function id(value: string): ExtractedScalar {
  return { kind: 'identifier', value }
}
export function txt(value: string): ExtractedScalar {
  return { kind: 'text', value }
}
export function num(value: number): ExtractedScalar {
  return { kind: 'number', value }
}
export function dte(value: string): ExtractedScalar {
  return { kind: 'date', value }
}
export function amt(amountMinor: bigint, currency = 'SGD', exponent = 2): ExtractedScalar {
  return { kind: 'money', value: mny(amountMinor, currency, exponent) }
}
export const ABSENT: ExtractedScalar = { kind: 'absent' }

function val(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

/** One receivables-ledger row: reference, amount due, issue date, customer. */
export function ledgerFields(
  reference: ExtractedScalar,
  amount: ExtractedScalar,
  date: ExtractedScalar,
  counterparty: ExtractedScalar,
): Record<FieldPathKey, ExtractedValue> {
  return {
    [k(PATHS.reference)]: val(reference),
    [k(PATHS.ledgerAmount)]: val(amount),
    [k(PATHS.ledgerDate)]: val(date),
    [k(PATHS.ledgerCounterparty)]: val(counterparty),
  }
}

/** One bank-statement row: reference, credit, value date, payer, narrative. */
export function bankFields(
  reference: ExtractedScalar,
  amount: ExtractedScalar,
  date: ExtractedScalar,
  counterparty: ExtractedScalar,
  narrative: ExtractedScalar,
): Record<FieldPathKey, ExtractedValue> {
  return {
    [k(PATHS.reference)]: val(reference),
    [k(PATHS.bankAmount)]: val(amount),
    [k(PATHS.bankDate)]: val(date),
    [k(PATHS.bankCounterparty)]: val(counterparty),
    [k(PATHS.bankNarrative)]: val(narrative),
  }
}

export function line(index: number, fields: Record<FieldPathKey, ExtractedValue>): ExtractedLine {
  return { index, fields }
}

/**
 * C18 — the arm every document in this corpus carries unless it says otherwise.
 *
 * ⚠️ THIS PUTS MOST SCENARIOS ON THE *OFF* ARM AND THAT IS TRUTHFUL, NOT
 * CONVENIENT. These synthetic files carry no trailer row, and
 * `not_declared_by_format` is the only arm that says so without claiming a
 * trailer was looked for. It is also exactly why `PopulationBinding
 * .carriesControlTotal` is load-bearing: with the parser as the only voice, a
 * corpus like this one would exercise the disabled path almost exclusively and
 * a shredder that stopped reading trailers would look identical.
 */
export const NO_TRAILER: ControlTotal = { kind: 'not_declared_by_format' }

function doc(
  idText: string,
  documentTypeId: DocumentTypeId,
  filename: string,
  extracted: Record<FieldPathKey, ExtractedValue>,
  lines: ExtractedLine[],
  tenantId: TenantId = TENANT,
  controlTotal: ControlTotal = NO_TRAILER,
): SourceDocument {
  return {
    tenantId,
    id: idText as SourceDocumentId,
    documentTypeId,
    filename,
    storageRef: `s3://synthetic-corpus/${idText}`,
    extracted,
    lines,
    controlTotal,
    ingestedAt: '2026-04-01T09:00:00Z',
    /* Truthful: this corpus is synthetic, and pass F ruled sandbox tenants
     * accept only `true`. */
    synthetic: true,
    purgeAfter: '2033-04-01T09:00:00Z',
    purgedAt: null,
  }
}

/** A document with no line structure — one invoice PDF is one transaction. */
export function ledgerHeaderDoc(
  idText: string,
  filename: string,
  fields: Record<FieldPathKey, ExtractedValue>,
): SourceDocument {
  return doc(idText, DOC_TYPE_LEDGER, filename, fields, [])
}
export function ledgerDoc(idText: string, filename: string, lines: ExtractedLine[]): SourceDocument {
  return doc(idText, DOC_TYPE_LEDGER, filename, {}, lines)
}
export function bankHeaderDoc(
  idText: string,
  filename: string,
  fields: Record<FieldPathKey, ExtractedValue>,
): SourceDocument {
  return doc(idText, DOC_TYPE_BANK, filename, fields, [])
}
/** C18 — a trailer the parser FOUND. `null` on a component the trailer omitted. */
export function trailer(lineCount: number | null, total: Money | null): ControlTotal {
  return { kind: 'declared', lineCount, total }
}
/** C18 — the format was declared to carry a trailer and the parser found none. */
export const TRAILER_MISSING: ControlTotal = { kind: 'expected_but_absent' }

export function ledgerDocWithTrailer(
  idText: string,
  filename: string,
  lines: ExtractedLine[],
  controlTotal: ControlTotal,
): SourceDocument {
  return doc(idText, DOC_TYPE_LEDGER, filename, {}, lines, TENANT, controlTotal)
}
export function bankHeaderDocWithTrailer(
  idText: string,
  filename: string,
  fields: Record<FieldPathKey, ExtractedValue>,
  controlTotal: ControlTotal,
): SourceDocument {
  return doc(idText, DOC_TYPE_BANK, filename, fields, [], TENANT, controlTotal)
}
/**
 * The one shape nothing in this corpus reached until C18: header fields AND
 * lines on one document. `admitPopulation` presents the LINES and ignores the
 * header, and `presentedRowCount` mirrors that rather than inventing a second
 * rule — so a trailer declaring `lines.length` passes while the header
 * transaction is presented by nobody. Built here so the behaviour is witnessed.
 */
export function ledgerDocWithHeaderAndLines(
  idText: string,
  filename: string,
  header: Record<FieldPathKey, ExtractedValue>,
  lines: ExtractedLine[],
  controlTotal: ControlTotal,
): SourceDocument {
  return doc(idText, DOC_TYPE_LEDGER, filename, header, lines, TENANT, controlTotal)
}

export function bankDoc(idText: string, filename: string, lines: ExtractedLine[]): SourceDocument {
  return doc(idText, DOC_TYPE_BANK, filename, {}, lines)
}

/** `{ ops: [], then: 'exact' }` — the identity, spelled out because there is no default. */
export const IDENTITY_NORMALISATION: IdentifierNormalisation = {
  ops: [],
  then: 'exact',
  maxInputChars: 64,
}

/** Strips a bank's own routing furniture: `BR001-TXN99823-SG` → `TXN99823`. */
export const SEGMENT_NORMALISATION: IdentifierNormalisation = {
  ops: [{ kind: 'trim' }, { kind: 'split_take', separator: '-', index: 1 }],
  then: 'exact',
  maxInputChars: 64,
}

/**
 * C16 — the denomination every population in this corpus DECLARES.
 *
 * SGD at exponent 2, which is what `mny()` and `amt()` already default to, so no
 * scenario's arithmetic moves. It is spelled out rather than defaulted inside the
 * engine because that is the whole ruling: an unstated unit is a refusal, and the
 * corpus states one on every side of every run — including the seven refusal
 * scenarios, which have to be valid in every earlier gate to reach the one they
 * test.
 */
export const SGD_2: MoneyUnit = { currency: 'SGD', exponent: 2 }
/** The same currency at a different scale. `SGD 1000` rather than `SGD 1000.00`. */
export const SGD_0: MoneyUnit = { currency: 'SGD', exponent: 0 }

/**
 * 🛑 THE FOUR BELOW ARE EXPORTED, AND THE EXPORT IS THE WHOLE OF THIS EDIT.
 *
 * `tests/scenarios/synthetic-population.ts` builds POPULATIONS rather than
 * scenarios — a thousand rows at a time, out of a seeded generator — and it
 * needs the same bindings and the same run input these thirty scenarios are
 * built from. Re-spelling `ledgerBinding` over there would be
 * `docs/HANDOFF.md` §5.3 in miniature: two spellings of one binding vocabulary
 * inside one directory, agreeing until somebody edits one, and the generator
 * would then be exercising a population shape no scenario here has ever run.
 *
 * ⚠️ NOTHING ELSE MOVED. No body, no default, no field, no expectation. This
 * commit's diff against this file is four `export` keywords and this block.
 */
export function ledgerBinding(options: {
  identifiers: FieldPath[]
  counterparty: FieldPath | null
  normalisation?: IdentifierNormalisation
  declaredUnit?: MoneyUnit
  carriesControlTotal?: 'always' | 'never'
  emptyExpectation?: 'refuses' | 'permitted'
}): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE_LEDGER,
      amount: PATHS.ledgerAmount,
      date: PATHS.ledgerDate,
      identifiers: options.identifiers,
    },
    declaredUnit: options.declaredUnit ?? SGD_2,
    /* C18. `'never'` is this corpus's default because its documents carry no
     * trailer row, and the TYPE has to say so or the parser's
     * `not_declared_by_format` would be unchallenged. The C18 scenarios below
     * pass `'always'` and supply one. */
    carriesControlTotal: options.carriesControlTotal ?? 'never',
    /* O-15. `'refuses'` is THE POSTURE, not a corpus convenience — and it is
     * truthful for every scenario in this file, all of which hand the engine a
     * March close with rows in it. One fixture overrides it, and its whole
     * subject is what the override buys. */
    emptyExpectation: options.emptyExpectation ?? 'refuses',
    normalisation: options.normalisation ?? IDENTITY_NORMALISATION,
    counterparty: options.counterparty,
    /* A ledger side carries no counterparty prose. Null, not empty string. */
    description: null,
  }
}

export function bankBinding(options: {
  identifiers: FieldPath[]
  counterparty: FieldPath | null
  normalisation?: IdentifierNormalisation
  description?: FieldPath | null
  declaredUnit?: MoneyUnit
  carriesControlTotal?: 'always' | 'never'
  emptyExpectation?: 'refuses' | 'permitted'
}): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE_BANK,
      amount: PATHS.bankAmount,
      date: PATHS.bankDate,
      identifiers: options.identifiers,
    },
    declaredUnit: options.declaredUnit ?? SGD_2,
    /* C18. `'never'` is this corpus's default because its documents carry no
     * trailer row, and the TYPE has to say so or the parser's
     * `not_declared_by_format` would be unchallenged. The C18 scenarios below
     * pass `'always'` and supply one. */
    carriesControlTotal: options.carriesControlTotal ?? 'never',
    /* O-15. As on the ledger side: the posture, and truthful here. */
    emptyExpectation: options.emptyExpectation ?? 'refuses',
    normalisation: options.normalisation ?? IDENTITY_NORMALISATION,
    counterparty: options.counterparty,
    description: options.description === undefined ? PATHS.bankNarrative : options.description,
  }
}

export function pairing(
  cardinality: PairingCardinality,
  amountTolerance: Tolerance,
  dateTolerance: Tolerance,
  strategies: PairingStrategy[],
): PairingSpec {
  return { cardinality, amountTolerance, dateTolerance, strategies }
}

export function bound(
  strategy: PairingStrategy,
  amountTolerance: Tolerance | null = null,
  amountAnchor: AmountAnchor = 'exact',
): StrategyBinding {
  return { strategy, amountTolerance, amountAnchor }
}

export const EXACT_MONEY: Tolerance = { kind: 'rounding', minorUnits: 0 }
export const FIVE_DAYS: Tolerance = { kind: 'days', value: 5 }

export interface RunSpec {
  readonly runId: string
  readonly left: PopulationBinding
  readonly right: PopulationBinding
  readonly leftDocuments: SourceDocument[]
  readonly rightDocuments: SourceDocument[]
  readonly pairing: PairingSpec
  readonly strategyBindings: StrategyBinding[]
  readonly obligationSide: PopulationSide
  readonly toleranceDirection: ToleranceDirection
  readonly classification?: ReadonlyMap<FieldPathKey, DataClass>
  readonly promptEligible?: ReadonlySet<FieldPathKey>
  /** G227. Optional HERE and required on the engine input — see `runInput`. */
  readonly confidenceFloors?: ReadonlyMap<FieldPathKey, number>
  readonly subsetSumBound?: SubsetSumBound
  readonly readerCandidateCap?: number
  readonly similarityMaxChars?: number
  readonly similarityMetric?: SimilarityMetric
  readonly tenantId?: TenantId
  /** C13. Optional HERE and required on the engine input — see `runInput`. */
  readonly admissionRefusalCeilingBasisPoints?: number
}

export function runInput(spec: RunSpec): SetReconciliationInput {
  return {
    runId: spec.runId as RunId,
    tenantId: spec.tenantId ?? TENANT,
    left: spec.left,
    right: spec.right,
    leftDocuments: spec.leftDocuments,
    rightDocuments: spec.rightDocuments,
    pairing: spec.pairing,
    strategyBindings: spec.strategyBindings,
    obligationSide: spec.obligationSide,
    toleranceDirection: spec.toleranceDirection,
    fieldClassification: spec.classification ?? STANDARD_CLASSIFICATION,
    modelPromptEligible: spec.promptEligible ?? STANDARD_PROMPT_ELIGIBLE,
    /* G227. The corpus states floors PER SCENARIO; absent means none declared,
     * which holds nothing — see `AdmissionContext.confidenceFloors`. */
    confidenceFloors: spec.confidenceFloors ?? NO_CONFIDENCE_FLOORS,
    subsetSumBound: spec.subsetSumBound ?? CORPUS_SUBSET_SUM_BOUND,
    readerCandidateCap: spec.readerCandidateCap ?? CORPUS_READER_CANDIDATE_CAP,
    similarityMaxChars: spec.similarityMaxChars ?? CORPUS_SIMILARITY_MAX_CHARS,
    similarityMetric: spec.similarityMetric ?? 'levenshtein_ratio',
    admissionRefusalCeilingBasisPoints:
      spec.admissionRefusalCeilingBasisPoints ?? CORPUS_ADMISSION_REFUSAL_CEILING_BASIS_POINTS,
  }
}

/* ====================================================================== *
 * §C  THE SHAPE OF AN EXPECTATION
 *
 * Deliberately concrete. "The residue is non-empty" is not an expectation; it
 * is a shrug. Every field below names the exact value the specification
 * requires, so a disagreement points at one line of the module.
 * ====================================================================== */

/** A human label plus the address the engine actually keys on. */
export interface ItemAddress {
  readonly label: string
  readonly side: PopulationSide
  readonly ref: ItemRef
}

export function at(label: string, side: PopulationSide, document: string, lineIndex: number | null): ItemAddress {
  return { label, side, ref: { sourceDocumentId: document as SourceDocumentId, lineIndex } }
}

export interface ExpectedAllocation {
  /** The item value came OUT of — `Allocation.fromKey`. */
  readonly from: ItemAddress
  /** The item value went INTO — `Allocation.toKey`. */
  readonly to: ItemAddress
  /* ⚠️ `bigint` since 19 Sep 2026 — G286. A minor-unit EXPECTATION is money
   * and carries money's representation. The VALUES are unchanged. */
  readonly amountMinor: bigint
  readonly evidence: PairingEvidence
  readonly why: string
}

export interface ExpectedSettlement {
  readonly kind: ItemSettlement['kind']
  /* ⚠️ `bigint` since 19 Sep 2026 — G286. A minor-unit EXPECTATION is money
   * and carries money's representation. The VALUES are unchanged. */
  readonly allocatedMinor: bigint | null
  readonly residualMinor: bigint | null
}

export interface ExpectedResidueEntry {
  readonly item: ItemAddress
  /** Null for an item refused at admission — it has no amount, so no settlement. */
  readonly settlement: ExpectedSettlement | null
  readonly cause: ResidueCause
  readonly disposition: EngineAssignableDisposition
  readonly why: string
}

export interface ExpectedRefusedItem {
  readonly item: ItemAddress
  readonly path: FieldPath
  readonly refusal: AdmissionRefusal
}

export interface ExpectedAmbiguity {
  readonly on: FieldPath | null
  readonly strategyKind: PairingStrategy['kind']
  readonly leftCandidates: number
  readonly rightCandidates: number
  readonly leftRefs: readonly ItemRef[]
  readonly rightRefs: readonly ItemRef[]
}

export interface ExpectedReaderCandidate {
  readonly index: number
  readonly ref: ItemRef
  readonly identifierForPrompt: string
}

export interface ExpectedReaderRequest {
  readonly requestOrdinal: number
  readonly subject: ItemAddress
  readonly untrustedDescription: string
  readonly untrustedDescriptionClass: DataClass
  readonly candidates: readonly ExpectedReaderCandidate[]
}

/** One place a bound bit — the count, and the row it points at. */
export interface ExpectedSearchBoundaryEntry {
  readonly itemCount: number
  readonly example: ItemAddress
}

export interface ExpectedSearchBoundary {
  readonly oversizedBuckets: readonly ExpectedSearchBoundaryEntry[]
  readonly exhaustedSearches: readonly ExpectedSearchBoundaryEntry[]
  readonly oversizedAmountBuckets: readonly ExpectedSearchBoundaryEntry[]
}

/**
 * G291 — ONE BUCKET THE IDENTIFIER JOIN FOUND AND THE MONEY DECLINED: the
 * shape, the figure the engine computed, and the row it points at.
 *
 * 🛑 `signedVarianceMinor` IS STATED, NOT DERIVED, AND THAT IS THE ONLY WAY IT
 * IS WORTH STATING. `ToleranceDirection`'s declaration defines it once — for a
 * candidate pairing, `variance = left.gross − right.gross` — and a scenario's
 * `derivedFrom` has to be able to show the subtraction. A corpus that took this
 * number off the engine would be comparing a constant to itself.
 */
export interface ExpectedToleranceDecline {
  readonly leftItemCount: number
  readonly rightItemCount: number
  readonly signedVarianceMinor: bigint
  readonly example: ItemAddress
}

export interface Expectation {
  readonly summary: string
  /** Where the expectation comes from. Read these before editing it. */
  readonly derivedFrom: readonly string[]
  readonly allocations: readonly ExpectedAllocation[]
  readonly ambiguities: readonly ExpectedAmbiguity[]
  readonly refusedAtAdmission: readonly ExpectedRefusedItem[]
  readonly residue: readonly ExpectedResidueEntry[]
  readonly readerRequests: readonly ExpectedReaderRequest[]
  readonly toleranceRefusals: readonly ToleranceRefusal[]
  /**
   * G217 — WHERE THE ENGINE STOPPED LOOKING, AS COUNTS PLUS AN ADDRESS.
   *
   * ⚠️ THIS WAS `oversizedBuckets: readonly (string | null)[]` AND IT HELD
   * COUNTERPARTY-AUTHORED JOIN KEYS — `['CP-BEACON']` was the only non-empty
   * value in the whole corpus, and it is a name out of a file somebody sent us.
   * The corpus now states all THREE channels on every scenario rather than one,
   * because a channel nothing states is a channel a regression cannot fail.
   */
  readonly searchBoundary: ExpectedSearchBoundary
  /**
   * G291 — THE BUCKETS THAT JOINED AND WHOSE TOTALS MISSED THE TOLERANCE.
   *
   * 🛑 STATED ON EVERY SCENARIO, FOR THE REASON `searchBoundary` ABOVE GIVES
   * ABOUT ITSELF: *a channel nothing states is a channel a regression cannot
   * fail.* Twenty-nine of the thirty state that no tolerance bound was hit.
   *
   * ⚠️ THE ONE THAT DOES NOT IS `bankFeeWithinTolerance`, AND IT IS THE
   * SCENARIO THAT CAUGHT G291's FIRST IMPLEMENTATION BEING WRONG. That run
   * declares two bindings of the same strategy kind — exact, then tolerant — and
   * its own `summary` has said *"Pass 1 declines (variance 1500 exceeds a zero
   * rounding tolerance)"* since it was written. So the decline is stated in the
   * SPECIFICATION's voice and was reaching nothing; G291's channel is where it
   * lands. Its residue expectation — `obligation_not_fully_settled` — is
   * UNCHANGED, and that is the interesting half: the first implementation
   * reported `amount_tolerance_declined` on a row that PAIRED on pass 2, this
   * corpus went red, and the ENGINE was fixed rather than the expectation.
   */
  readonly toleranceDeclines: readonly ExpectedToleranceDecline[]
  /**
   * Non-empty means the run reported something about its own ledger.
   *
   * ⚠️ THIS READ *"Every scenario expects []"* AND C17 ENDED THAT DELIBERATELY.
   * `bothCopiesRefusedIsStillTheNamedOutcome` expects
   * `item_in_residue_twice` — a duplicated address whose copies are BOTH refused
   * is reported here rather than refused at §4a, and that named outcome is
   * exactly what C17's at-least-one-admitted narrowing exists to preserve.
   *
   * ⚠️ AND IT THEN READ *"Every other scenario still expects `SOUND`"*, which
   * C13 ENDED. Three scenarios now expect a non-empty list, and the second
   * property this channel carries is not unsoundness at all: `SOUND` means the
   * ledger is consistent, and `population_wholly_refused` means the ledger is
   * consistent OVER NOTHING. `unclassifiedFieldFailsClosed`,
   * `bothCopiesRefusedIsStillTheNamedOutcome` and
   * `wholeRunRefusedStillProducesTheResidue` each expect it, and each of the
   * three was `SOUND` before — which is the defect C13 exists to end.
   */
  readonly postconditions: readonly PostconditionFailure[]
  readonly meterFacts: readonly { readonly meter: EngineMeter; readonly quantity: number }[]
}

export interface Scenario {
  readonly name: string
  /** Which of the twelve exception topologies, or why the extra one exists. */
  readonly topology: string
  /** What a controller would call this row in a March close. */
  readonly story: string
  readonly input: SetReconciliationInput
  readonly expect: Expectation
}

/** Every successful run emits exactly this, from `runMeterFact()`. Never a price. */
const ONE_RUN_METERED: readonly { readonly meter: EngineMeter; readonly quantity: number }[] = [
  { meter: 'reconciliations_run', quantity: 1 },
]

const NO_TOLERANCE_REFUSALS: readonly ToleranceRefusal[] = []
const NO_AMBIGUITIES: readonly ExpectedAmbiguity[] = []
const NO_REFUSED: readonly ExpectedRefusedItem[] = []
const NO_REQUESTS: readonly ExpectedReaderRequest[] = []
/**
 * G217 — every scenario states all three channels, and thirty of them state
 * that nothing was bounded. ⚠️ THIS WAS `NO_BUCKETS: readonly (string | null)[]`
 * and it stood for ONE channel out of three; the other two were asserted by
 * nothing anywhere in the corpus.
 */
const NO_SEARCH_BOUNDARY: ExpectedSearchBoundary = {
  oversizedBuckets: [],
  exhaustedSearches: [],
  oversizedAmountBuckets: [],
}
/**
 * G291 — no identifier bucket joined and then missed its tolerance. Twenty-nine
 * of the thirty scenarios state this; `bankFeeWithinTolerance` is the one that
 * states a decline, and its own summary has always said so.
 */
const NO_TOLERANCE_DECLINES: readonly ExpectedToleranceDecline[] = []
/** The load-bearing one. A sound run leaves this empty. */
const SOUND: readonly PostconditionFailure[] = []

/* ====================================================================== *
 * §D  TOPOLOGY 1 — a clean 1:1 match on a canonical id
 * ====================================================================== */

const s1LeftInvoice = ledgerHeaderDoc(
  'srcdoc_SYN_inv_1001',
  'BEACON-INV-1001.pdf',
  ledgerFields(id('INV-1001'), amt(125_00n), dte('2026-03-02'), id('CP-BEACON')),
)
const s1RightPayment = bankHeaderDoc(
  'srcdoc_SYN_pay_1001',
  'advice-1001.pdf',
  bankFields(
    id('INV-1001'),
    amt(125_00n),
    dte('2026-03-05'),
    id('CP-BEACON'),
    txt('PAYNOW CREDIT BEACON FOODS INV-1001'),
  ),
)

const s1Invoice = at('INV-1001 (Beacon Foods)', 'left', 'srcdoc_SYN_inv_1001', null)
const s1Payment = at('PayNow credit 05 Mar', 'right', 'srcdoc_SYN_pay_1001', null)

export const cleanIdentifierMatch: Scenario = {
  name: 'cleanIdentifierMatch',
  topology: '1 — clean 1:1 exact match on a canonical id',
  story: 'Beacon Foods pays invoice INV-1001 in full and quotes the number. The boring row.',
  input: runInput({
    runId: 'run_SYN_0001',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s1LeftInvoice],
    rightDocuments: [s1RightPayment],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'One allocation of 12500 minor units carrying `exact_identifier` evidence; both items fully allocated; the residue is empty and so is the reader queue.',
    derivedFrom: [
      'model/reconciliation.ts passIdentifierJoin — arity 1×1 satisfies `one_to_one`',
      'toleranceAdmits: rounding 0 with variance 0 admits, and signedVarianceMinor 0 selects `exact_identifier` over `tolerant_identifier`',
      'runSetReconciliation residue loop skips `fully_allocated` items',
      'buildReaderRequests iterates the RESIDUE — an empty residue emits no request',
    ],
    allocations: [
      {
        from: s1Payment,
        to: s1Invoice,
        amountMinor: 125_00n,
        evidence: { kind: 'exact_identifier', on: PATHS.reference },
        why: 'pourFifo pours the payment into the invoice; min(residual, residual) is the whole 12500.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §E  TOPOLOGY 2 — routing furniture around the id: `BR001-TXN99823-SG`
 * ====================================================================== */

const s2LeftInvoice = ledgerHeaderDoc(
  'srcdoc_SYN_inv_2001',
  'CORMORANT-TXN99823.pdf',
  ledgerFields(id('TXN99823'), amt(980_50n), dte('2026-03-11'), id('CP-CORMORANT')),
)
const s2RightStatement = bankDoc('srcdoc_SYN_stmt_cormorant_a', 'statement-2026-03-a.csv', [
  line(
    0,
    bankFields(
      id('BR001-TXN99823-SG'),
      amt(980_50n),
      dte('2026-03-12'),
      id('CP-CORMORANT'),
      txt('INWARD TT BR001-TXN99823-SG'),
    ),
  ),
])

const s2Invoice = at('TXN99823 (Cormorant Logistics)', 'left', 'srcdoc_SYN_inv_2001', null)
const s2Credit = at('Inward TT 12 Mar', 'right', 'srcdoc_SYN_stmt_cormorant_a', 0)

export const noisyIdentifierNormalised: Scenario = {
  name: 'noisyIdentifierNormalised',
  topology: '2 — prefix/suffix noise around the id',
  story: "The bank wraps its own branch and country codes around the customer's reference.",
  input: runInput({
    runId: 'run_SYN_0002',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({
      identifiers: [PATHS.reference],
      counterparty: null,
      normalisation: SEGMENT_NORMALISATION,
    }),
    leftDocuments: [s2LeftInvoice],
    rightDocuments: [s2RightStatement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      "The right side's declared normalisation reduces `BR001-TXN99823-SG` to `TXN99823` at admission, so the identifier join sees one key on both sides: one exact allocation, empty residue.",
    derivedFrom: [
      "model/reconciliation.ts §2 — `split_take` on '-' index 1 is the module's own worked example, and it is the deterministic form of the draft's lookaround regex",
      'admitOne applies `applyExtraction` before any strategy keys on the value',
      'passIdentifierJoin then sees a single shared key',
    ],
    allocations: [
      {
        from: s2Credit,
        to: s2Invoice,
        amountMinor: 980_50n,
        evidence: { kind: 'exact_identifier', on: PATHS.reference },
        why: 'Both normalised keys are `TXN99823`, amounts agree exactly, arity is 1×1.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/**
 * The same two documents with the identity normalisation on both sides. Included
 * because a normalisation that is never witnessed failing is a normalisation
 * nobody can prove is load-bearing — this is the §2 comment's own claim
 * ("with no declared normalisation the two never key equal") as a fixture.
 */
export const noisyIdentifierWithoutNormalisation: Scenario = {
  name: 'noisyIdentifierWithoutNormalisation',
  topology: '2 (negative control) — the same rows with no declared normalisation',
  story: 'What the same statement looks like before anyone configures the extraction.',
  input: runInput({
    runId: 'run_SYN_0003',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s2LeftInvoice],
    rightDocuments: [s2RightStatement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary: 'Zero allocations. Two keys that never meet, and both rows fall to the residue.',
    derivedFrom: [
      'model/reconciliation.ts §2 IdentifierNormalisation — the identity is a statement, not an absence, and it keys `BR001-TXN99823-SG` verbatim',
      'runSetReconciliation residue cause default is `no_strategy_paired`',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s2Invoice,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 980_50n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'No right-hand key equals `TXN99823`.',
      },
      {
        item: s2Credit,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 980_50n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Its key is the whole bank string, which no ledger row carries.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §F  TOPOLOGY 3 — a bank fee: same id, amount short by a fixed charge
 * ====================================================================== */

const s3LeftInvoice = ledgerHeaderDoc(
  'srcdoc_SYN_inv_3001',
  'DUNLIN-INV-3001.pdf',
  ledgerFields(id('INV-3001'), amt(4000_00n), dte('2026-03-04'), id('CP-DUNLIN')),
)
const s3RightStatement = bankDoc('srcdoc_SYN_stmt_dunlin_fee', 'statement-2026-03-b.csv', [
  line(
    0,
    bankFields(
      id('INV-3001'),
      amt(3985_00n),
      dte('2026-03-09'),
      id('CP-DUNLIN'),
      txt('TT INV-3001 LESS CORRESPONDENT BANK CHARGES'),
    ),
  ),
])

const s3Invoice = at('INV-3001 (Dunlin Ceramics)', 'left', 'srcdoc_SYN_inv_3001', null)
const s3Credit = at('TT 09 Mar, net of charges', 'right', 'srcdoc_SYN_stmt_dunlin_fee', 0)

export const bankFeeWithinTolerance: Scenario = {
  name: 'bankFeeWithinTolerance',
  topology: '3 — a bank fee: same id, amount short by a small absolute tolerance',
  story:
    'The customer paid, the correspondent bank took SGD 15.00 on the way through. Two passes on the same strategy kind: exact first, then tolerant.',
  input: runInput({
    runId: 'run_SYN_0004',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s3LeftInvoice],
    rightDocuments: [s3RightStatement],
    /* Two strategies of the SAME KIND differing only in tolerance. This is the
     * ordering `PairingSpec.amountTolerance` alone cannot express, and the
     * reason `StrategyBinding` exists (diff-plan DP-3). */
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [
      bound({ kind: 'exact_identifier', on: PATHS.reference }, null),
      bound({ kind: 'exact_identifier', on: PATHS.reference }, { kind: 'money', value: mny(15_00n) }),
    ],
    obligationSide: 'left',
    /* variance = left − right, so a shortfall is POSITIVE here. An overpayment
     * would not be admitted by this run, which is the A9(g) choice made
     * explicitly rather than left to a symmetric default. */
    toleranceDirection: 'left_greater_only',
  }),
  expect: {
    summary:
      'Pass 1 declines (variance 1500 exceeds a zero rounding tolerance). Pass 2 admits it as `tolerant_identifier` with signedVarianceMinor 1500, allocates the 398500 that actually arrived, and leaves the SGD 15.00 fee OPEN in the residue.',
    derivedFrom: [
      'toleranceAdmits — |1500| ≤ 0 is false on pass 1; |1500| ≤ 1500 and variance ≥ 0 is true on pass 2 under left_greater_only',
      'passIdentifierJoin selects `tolerant_identifier` whenever signedVarianceMinor ≠ 0',
      'pourFifo stops when the source is exhausted, so the invoice keeps a residual of 1500 — A9(b)',
      'EngineAssignableDisposition excludes `write_off`: deciding to stop chasing SGD 15.00 is a finance judgement and the engine may not make it',
      /* G291, and the first line above is where it comes from: pass 1 DECLINES,
       * and a bound that was hit is recorded. ToleranceDirection defines the
       * sign once — variance = left − right — so 400000 − 398500 = +1500 over a
       * bucket of one row a side, addressed at the FIFO-oldest LEFT member. */
      'G114 — "a bound that was hit is recorded, never silently absorbed", so pass 1\'s decline reaches `toleranceDeclines` with the figure the first line above computes: 400000 − 398500 = +1500 over one row a side',
      'G291 — the residue cause is UNCHANGED at `obligation_not_fully_settled`: a decline superseded by a later pass is history, not a disposition. The invoice PAIRED on pass 2 and is open for the FEE, and reporting a tolerance decline on it would send an operator to widen a tolerance that already worked',
    ],
    allocations: [
      {
        from: s3Credit,
        to: s3Invoice,
        amountMinor: 3985_00n,
        evidence: { kind: 'tolerant_identifier', on: PATHS.reference, signedVarianceMinor: 15_00n },
        why: 'min(invoice residual 400000, credit residual 398500) = 398500.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s3Invoice,
        settlement: { kind: 'partially_allocated', allocatedMinor: 3985_00n, residualMinor: 15_00n },
        cause: { kind: 'obligation_not_fully_settled' },
        disposition: 'unidentified',
        why: 'The item sits on the obligation side and is not closed, so the fee is a visible open balance rather than a variance field.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    /* 🛑 G291 — THE ONE SCENARIO IN THE CORPUS THAT STATES A DECLINE, and it
     * states one because its own `summary` always did: *"Pass 1 declines
     * (variance 1500 exceeds a zero rounding tolerance)."* That sentence was
     * written before G291 and described a fact reaching no channel at all.
     *
     * THE FIGURE IS DERIVED, NOT READ. Pass 1's bucket is the one invoice of
     * SGD 4000.00 against the one credit of SGD 3985.00, and `ToleranceDirection`
     * defines the sign once: variance = left − right = 400000 − 398500 = +1500.
     * A SHORTFALL is positive here, which is the whole reason this scenario runs
     * `left_greater_only` rather than `symmetric`.
     *
     * ⚠️ AND IT IS A DECLINE ON A BUCKET THAT LATER PAIRED, which is exactly
     * what makes it the useful witness: the channel records the bound while the
     * row correctly reports `obligation_not_fully_settled` above. A fix that
     * conflated the two would have to break one of these two lines. */
    toleranceDeclines: [
      {
        leftItemCount: 1,
        rightItemCount: 1,
        signedVarianceMinor: 15_00n,
        example: s3Invoice,
      },
    ],
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §G  TOPOLOGY 4 — a typo in the reference, amount EXACT
 *
 * THE GOLDEN RULE: anchor the amount, blur the string, never both. The decoy row
 * below shares the amount and shares nothing else, and it must not pair.
 * ====================================================================== */

const s4LeftInvoice = ledgerHeaderDoc(
  'srcdoc_SYN_inv_4001',
  'EGRET-INV-2087.pdf',
  ledgerFields(id('INV-2087'), amt(3412_00n), dte('2026-03-06'), id('CP-EGRET')),
)
const s4RightStatement = bankDoc('srcdoc_SYN_stmt_egret_typo', 'statement-2026-03-c.csv', [
  /* `INV-2O87` — a capital letter O where a zero belongs. One substitution in
   * eight characters: 7/8 → 8750 basis points. */
  line(
    0,
    bankFields(id('INV-2O87'), amt(3412_00n), dte('2026-03-10'), id('CP-EGRET'), txt('GIRO INV-2O87')),
  ),
  /* Same amount, unrelated reference. In the bucket, below the threshold. */
  line(
    1,
    bankFields(id('PO-77777'), amt(3412_00n), dte('2026-03-10'), id('CP-FULMAR'), txt('GIRO PO-77777')),
  ),
])

const s4Invoice = at('INV-2087 (Egret Media)', 'left', 'srcdoc_SYN_inv_4001', null)
const s4Typo = at('GIRO with a mistyped reference', 'right', 'srcdoc_SYN_stmt_egret_typo', 0)
const s4Decoy = at('Unrelated GIRO, same amount', 'right', 'srcdoc_SYN_stmt_egret_typo', 1)

const fuzzyStrategies: PairingStrategy[] = [
  { kind: 'exact_identifier', on: PATHS.reference },
  { kind: 'fuzzy_reference', minSimilarity: 0.85 },
]
const fuzzyBindings: StrategyBinding[] = [
  bound({ kind: 'exact_identifier', on: PATHS.reference }),
  bound({ kind: 'fuzzy_reference', minSimilarity: 0.85 }),
]

export const typoAmountAnchoredFuzzy: Scenario = {
  name: 'typoAmountAnchoredFuzzy',
  topology: '4 — a typo in the reference with the amount EXACT (the fuzzy case)',
  story: 'Someone typed a letter O for a zero. The money is to the cent.',
  input: runInput({
    runId: 'run_SYN_0005',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s4LeftInvoice],
    rightDocuments: [s4RightStatement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, fuzzyStrategies),
    strategyBindings: fuzzyBindings,
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'Pass 1 finds nothing (the strings differ). Pass 2 buckets by EXACT minor units, scores `INV-2087` against `INV-2O87` at 8750 basis points, and allocates. The decoy scores far below the 8500 threshold and stays open.',
    derivedFrom: [
      'levenshteinBasisPoints — distance 1 over a longest length of 8 gives round(7/8 × 10000) = 8750',
      'passFuzzyReference — threshold is round(0.85 × 10000) = 8500, and 8750 ≥ 8500',
      'passFuzzyReference buckets on `amountBucketKey`, so a candidate must match the amount EXACTLY before any string maths runs',
      'AmountAnchor — the golden rule is in the type: if the string is blurry the amount must not be',
    ],
    allocations: [
      {
        from: s4Typo,
        to: s4Invoice,
        amountMinor: 3412_00n,
        evidence: { kind: 'fuzzy_reference', similarityBasisPoints: 8750, metric: 'levenshtein_ratio' },
        why: 'Single best candidate in the exact-amount bucket, above threshold, no tie.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s4Decoy,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 3412_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Sharing an amount is not evidence. Its similarity to `INV-2087` is nowhere near 8500 basis points, so it is never a candidate.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/**
 * The same rows under `jaro_winkler`. The module marks that metric as a stub and
 * returns null rather than a fabricated score, so the pass declines everything.
 */
export const jaroWinklerStubMatchesNothing: Scenario = {
  name: 'jaroWinklerStubMatchesNothing',
  topology: '4 (stub control) — the declared-but-unimplemented similarity metric',
  story: 'A pack author selects the metric the module has not implemented.',
  input: runInput({
    runId: 'run_SYN_0006',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s4LeftInvoice],
    rightDocuments: [s4RightStatement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, fuzzyStrategies),
    strategyBindings: fuzzyBindings,
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    similarityMetric: 'jaro_winkler',
  }),
  expect: {
    summary:
      'Zero allocations. A stub that returns null costs a match; a stub that returned a number would invent a matching policy with money on it.',
    derivedFrom: [
      'model/reconciliation.ts similarityBasisPoints — `jaro_winkler` is a marked stub returning null, because its prefix scale and prefix cap change which records pair',
      'passFuzzyReference skips any candidate whose score is null',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s4Invoice,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 3412_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'No metric produced a score.',
      },
      {
        item: s4Typo,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 3412_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Same.',
      },
      {
        item: s4Decoy,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 3412_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Same.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §H  N:M — the counterparty partition, subset sum, and the waterfall
 *
 * All three scenarios below use the same shape: a ledger partitioned by
 * customer code, a statement partitioned by payer code, `amount_sum` as the only
 * strategy, obligations on the left.
 * ====================================================================== */

const nmStrategies: PairingStrategy[] = [{ kind: 'amount_sum', maxMembers: 4 }]
const nmBindings: StrategyBinding[] = [bound({ kind: 'amount_sum', maxMembers: 4 })]

function nmRun(
  runId: string,
  leftDocuments: SourceDocument[],
  rightDocuments: SourceDocument[],
  subsetSumBound?: SubsetSumBound,
): SetReconciliationInput {
  const spec: RunSpec = {
    runId,
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: PATHS.ledgerCounterparty }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: PATHS.bankCounterparty }),
    leftDocuments,
    rightDocuments,
    pairing: pairing('many_to_many', EXACT_MONEY, FIVE_DAYS, nmStrategies),
    strategyBindings: nmBindings,
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    ...(subsetSumBound === undefined ? {} : { subsetSumBound }),
  }
  return runInput(spec)
}

/* --- Topology 5: an exact subset. What the customer INTENDED to pay. --- */

const s5Ledger = ledgerDoc('srcdoc_SYN_ledger_cormorant', 'ar-open-items-cormorant.csv', [
  line(0, ledgerFields(id('INV-5101'), amt(100_00n), dte('2026-03-01'), id('CP-CORMORANT'))),
  line(1, ledgerFields(id('INV-5102'), amt(50_00n), dte('2026-03-03'), id('CP-CORMORANT'))),
  line(2, ledgerFields(id('INV-5103'), amt(70_00n), dte('2026-03-04'), id('CP-CORMORANT'))),
])
const s5Statement = bankDoc('srcdoc_SYN_stmt_cormorant_b', 'statement-2026-03-d.csv', [
  line(
    0,
    bankFields(ABSENT, amt(120_00n), dte('2026-03-06'), id('CP-CORMORANT'), txt('FAST PAYMENT CORMORANT LOGISTICS')),
  ),
])

const s5Inv101 = at('INV-5101 · 100.00', 'left', 'srcdoc_SYN_ledger_cormorant', 0)
const s5Inv102 = at('INV-5102 · 50.00', 'left', 'srcdoc_SYN_ledger_cormorant', 1)
const s5Inv103 = at('INV-5103 · 70.00', 'left', 'srcdoc_SYN_ledger_cormorant', 2)
const s5Cash = at('FAST payment · 120.00', 'right', 'srcdoc_SYN_stmt_cormorant_b', 0)

export const exactSubsetIsAMatch: Scenario = {
  name: 'exactSubsetIsAMatch',
  topology: '5 — N:M where one payment settles an exact subset of open invoices',
  story: 'Cormorant pays SGD 120.00 against three open invoices. 50 + 70 is exactly what they chose to pay.',
  input: nmRun('run_SYN_0007', [s5Ledger], [s5Statement]),
  expect: {
    summary:
      'Two allocations, both carrying `amount_sum_exact` with memberCount 2 — INV-5102 and INV-5103 close, INV-5101 stays open. The oldest invoice is NOT touched, because the payer did not pay it.',
    derivedFrom: [
      'G105 — an exact combination of open obligations summing to the payment is what the counterparty INTENDED to pay, and it is a MATCH; the waterfall is a different thing and the audit trail must not confuse the two',
      'boundedSubsetSum searches in FIFO order and returns the first exact combination: {50.00, 70.00}',
      'pourFifo then fills those two members oldest-first from the single cash row',
      'docs/build/reconciliation-engine.md §8 run 2 records the anti-case: a waterfall-only engine pairs 100.00 + 20.00 and records it as a match',
    ],
    allocations: [
      {
        from: s5Cash,
        to: s5Inv102,
        amountMinor: 50_00n,
        evidence: { kind: 'amount_sum_exact', memberCount: 2 },
        why: 'First member of the exact solution, oldest first.',
      },
      {
        from: s5Cash,
        to: s5Inv103,
        amountMinor: 70_00n,
        evidence: { kind: 'amount_sum_exact', memberCount: 2 },
        why: 'Second member; the cash row is exhausted to the cent.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s5Inv101,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 100_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Genuinely unpaid. It was never a member of the solution, so nothing was poured into it.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* --- Topology 6: no exact subset. The waterfall, RECORDED as one. --- */

const s6Ledger = ledgerDoc('srcdoc_SYN_ledger_dunlin', 'ar-open-items-dunlin.csv', [
  line(0, ledgerFields(id('INV-6101'), amt(100_00n), dte('2026-03-02'), id('CP-DUNLIN'))),
  line(1, ledgerFields(id('INV-6102'), amt(50_00n), dte('2026-03-05'), id('CP-DUNLIN'))),
])
const s6Statement = bankDoc('srcdoc_SYN_stmt_dunlin_part', 'statement-2026-03-e.csv', [
  line(
    0,
    bankFields(ABSENT, amt(120_00n), dte('2026-03-07'), id('CP-DUNLIN'), txt('CHEQUE DEPOSIT DUNLIN CERAMICS')),
  ),
])

const s6Inv101 = at('INV-6101 · 100.00', 'left', 'srcdoc_SYN_ledger_dunlin', 0)
const s6Inv102 = at('INV-6102 · 50.00', 'left', 'srcdoc_SYN_ledger_dunlin', 1)
const s6Cash = at('Cheque deposit · 120.00', 'right', 'srcdoc_SYN_stmt_dunlin_part', 0)

export const waterfallWhenNoExactSubset: Scenario = {
  name: 'waterfallWhenNoExactSubset',
  topology: '6 — N:M where no exact subset exists, so the FIFO waterfall applies',
  story: 'Dunlin pays SGD 120.00 against 100.00 and 50.00. No combination sums to it; the firm allocates oldest-first.',
  input: nmRun('run_SYN_0008', [s6Ledger], [s6Statement]),
  expect: {
    summary:
      'Two allocations, both carrying `amount_sum_waterfall { fellThroughFrom: "no_exact_solution" }` — 100.00 closes INV-6101 and the remaining 20.00 part-pays INV-6102, which stays open for 30.00.',
    derivedFrom: [
      'G105 — the waterfall is a JUDGEMENT the firm makes about cash it cannot attribute, and the fall-through reason is recorded ON THE ROW rather than inferred from its absence',
      'boundedSubsetSum over {10000, 5000} for a target of 12000 exhausts the search space without hitting the step budget, so the result is `no_solution`, never `budget_exhausted`',
      'pourFifo allocates min(residual, residual) oldest-first and stops when the cash is spent',
    ],
    allocations: [
      {
        from: s6Cash,
        to: s6Inv101,
        amountMinor: 100_00n,
        evidence: { kind: 'amount_sum_waterfall', fellThroughFrom: 'no_exact_solution' },
        why: 'Oldest obligation, fully covered.',
      },
      {
        from: s6Cash,
        to: s6Inv102,
        amountMinor: 20_00n,
        evidence: { kind: 'amount_sum_waterfall', fellThroughFrom: 'no_exact_solution' },
        why: 'What is left of the cheque. min(residual 5000, residual 2000) = 2000.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s6Inv102,
        settlement: { kind: 'partially_allocated', allocatedMinor: 20_00n, residualMinor: 30_00n },
        cause: { kind: 'obligation_not_fully_settled' },
        disposition: 'unidentified',
        why: 'Part-paid obligations are distinguishable from unpaid ones by their settlement, not by a boolean somebody can forget to set (A9(c)).',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* --- Topology 7: leftover cash. THE bug the draft lost money on. --- */

const s7Ledger = ledgerDoc('srcdoc_SYN_ledger_egret', 'ar-open-items-egret.csv', [
  line(0, ledgerFields(id('INV-7101'), amt(100_00n), dte('2026-03-02'), id('CP-EGRET'))),
  line(1, ledgerFields(id('INV-7102'), amt(50_00n), dte('2026-03-03'), id('CP-EGRET'))),
])
const s7Statement = bankDoc('srcdoc_SYN_stmt_egret_over', 'statement-2026-03-f.csv', [
  line(0, bankFields(ABSENT, amt(200_00n), dte('2026-03-09'), id('CP-EGRET'), txt('TT EGRET MEDIA ON ACCOUNT'))),
])

const s7Inv101 = at('INV-7101 · 100.00', 'left', 'srcdoc_SYN_ledger_egret', 0)
const s7Inv102 = at('INV-7102 · 50.00', 'left', 'srcdoc_SYN_ledger_egret', 1)
const s7Cash = at('TT on account · 200.00', 'right', 'srcdoc_SYN_stmt_egret_over', 0)

export const leftoverCashLandsInResidue: Scenario = {
  name: 'leftoverCashLandsInResidue',
  topology: '7 — obligations total LESS than the payment; the leftover must land in the residue',
  story: 'Egret Media sends SGD 200.00 against SGD 150.00 of open invoices. Where does the other 50.00 go?',
  input: nmRun('run_SYN_0009', [s7Ledger], [s7Statement]),
  expect: {
    summary:
      'Both invoices close; the cash row is `partially_allocated` with a residual of 5000 and appears in the residue exactly once as `cash_exceeded_obligations`. The SGD 50.00 is visible, not absorbed into a variance field.',
    derivedFrom: [
      'A9(b) — the draft consumed every payment in the group and recorded the leftover as `variance`; money disappeared and no type in this repository could have caught it',
      'pourFifo stops when the obligations run out; an item with residual > 0 is simply still open',
      'runSetReconciliation residue cause: partially allocated, and the item is NOT on the obligation side, so the cause is `cash_exceeded_obligations`',
      'checkPostconditions — residue completeness, computed from two independent sources, is what actually catches a dropped item',
    ],
    allocations: [
      {
        from: s7Cash,
        to: s7Inv101,
        amountMinor: 100_00n,
        evidence: { kind: 'amount_sum_waterfall', fellThroughFrom: 'no_exact_solution' },
        why: 'No subset of {100.00, 50.00} sums to 200.00.',
      },
      {
        from: s7Cash,
        to: s7Inv102,
        amountMinor: 50_00n,
        evidence: { kind: 'amount_sum_waterfall', fellThroughFrom: 'no_exact_solution' },
        why: 'Second and last obligation in the bucket.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s7Cash,
        settlement: { kind: 'partially_allocated', allocatedMinor: 150_00n, residualMinor: 50_00n },
        cause: { kind: 'cash_exceeded_obligations' },
        disposition: 'unidentified',
        why: 'Unapplied cash is a finding for a human, not a rounding line.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* --- The bucket that is too big to attempt. --- */

const s15Ledger = ledgerDoc('srcdoc_SYN_ledger_beacon_big', 'ar-open-items-beacon.csv', [
  line(0, ledgerFields(id('INV-1501'), amt(100_00n), dte('2026-03-02'), id('CP-BEACON'))),
  line(1, ledgerFields(id('INV-1502'), amt(50_00n), dte('2026-03-03'), id('CP-BEACON'))),
])
const s15Statement = bankDoc('srcdoc_SYN_stmt_beacon_big', 'statement-2026-03-g.csv', [
  line(0, bankFields(ABSENT, amt(150_00n), dte('2026-03-06'), id('CP-BEACON'), txt('FAST BEACON FOODS'))),
])

const s15Inv1 = at('INV-1501 · 100.00', 'left', 'srcdoc_SYN_ledger_beacon_big', 0)
const s15Inv2 = at('INV-1502 · 50.00', 'left', 'srcdoc_SYN_ledger_beacon_big', 1)
const s15Cash = at('FAST payment · 150.00', 'right', 'srcdoc_SYN_stmt_beacon_big', 0)

export const oversizedBucketIsRefusedNotAttempted: Scenario = {
  name: 'oversizedBucketIsRefusedNotAttempted',
  topology: 'extra — the stated bound bites: a bucket larger than `maxBucketSize` is refused to the residue',
  story: 'A customer with more open items than the run is willing to search. The engine declines rather than guessing.',
  input: nmRun('run_SYN_0010', [s15Ledger], [s15Statement], {
    maxMembers: 8,
    stepBudget: 5000,
    /* One. Two obligations therefore overflow it. */
    maxBucketSize: 1,
  }),
  expect: {
    summary:
      'No allocations at all, even though 100.00 + 50.00 is exactly 150.00. The bucket is reported on `searchBoundary.oversizedBuckets` — three items in scope, addressed at the oldest — and all three rows carry `bucket_exceeded_bound`.',
    derivedFrom: [
      'passAmountSum — a bucket exceeding `maxBucketSize` is reported on the search boundary and skipped, never truncated',
      'G105 — silently truncating the search would make an allocation look like a match',
      'runSetReconciliation residue cause — an item whose counterparty was refused on the bound is attributed to the bound, not to an absence of evidence. G217: the KEY does that join INSIDE the engine and never leaves it',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s15Inv1,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 100_00n },
        cause: { kind: 'bucket_exceeded_bound' },
        disposition: 'unidentified',
        why: 'The reason is the bound, and it is on the row.',
      },
      {
        item: s15Inv2,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 50_00n },
        cause: { kind: 'bucket_exceeded_bound' },
        disposition: 'unidentified',
        why: 'Same bucket.',
      },
      {
        item: s15Cash,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 150_00n },
        cause: { kind: 'bucket_exceeded_bound' },
        disposition: 'unidentified',
        why: 'The cash row shares the counterparty, so it shares the reason.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    /* 🛑 THIS READ `oversizedBuckets: ['CP-BEACON']` UNTIL G217 AND IT IS THE
     * ONLY PLACE THE OLD SHAPE EVER CARRIED A VALUE — a counterparty NAME, out
     * of a file somebody sent us, on the corpus's own expectation. The boundary
     * says how much was in scope and where to look, and nothing about who. */
    searchBoundary: {
      oversizedBuckets: [{ itemCount: 3, example: s15Inv1 }],
      exhaustedSearches: [],
      oversizedAmountBuckets: [],
    },
    /* G291 — the bound that bit here is a COST bound and not a VALUE one: the
     * bucket was refused BEFORE any comparison ran, so no tolerance was ever
     * applied and nothing could have declined. The two channels are distinct on
     * exactly this scenario, which is why it states both. */
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* --- The unattributed bucket. A9(d): a named bucket, never a silent drop. --- */

const s16Ledger = ledgerDoc('srcdoc_SYN_ledger_unattributed', 'ar-open-items-mixed.csv', [
  line(0, ledgerFields(id('INV-1601'), amt(100_00n), dte('2026-03-02'), id('CP-BEACON'))),
])
const s16Statement = bankDoc('srcdoc_SYN_stmt_unattributed', 'statement-2026-03-h.csv', [
  /* No payer code at all — the field is present and absent-valued. */
  line(0, bankFields(ABSENT, amt(100_00n), dte('2026-03-05'), ABSENT, txt('CASH DEPOSIT BRANCH 04'))),
])

const s16Invoice = at('INV-1601 · 100.00', 'left', 'srcdoc_SYN_ledger_unattributed', 0)
const s16Cash = at('Cash deposit, no payer', 'right', 'srcdoc_SYN_stmt_unattributed', 0)

export const unattributedCounterpartyIsANamedBucket: Scenario = {
  name: 'unattributedCounterpartyIsANamedBucket',
  topology: 'extra — A9(d): a row with no counterparty is a named bucket, not a dropped record',
  story: 'A branch cash deposit with nothing identifying who paid it.',
  input: nmRun('run_SYN_0011', [s16Ledger], [s16Statement]),
  expect: {
    summary:
      'No allocation — the partition is absolute and the unattributed row is excluded from N:M — and the cash row reaches the residue with its own cause, `counterparty_unattributed`.',
    derivedFrom: [
      'A9(d) — the draft\'s `groupBy` silently dropped any record whose group key was absent, and an absent group key is exactly the record a reconciliation exists to find',
      'passAmountSum skips items with `counterparty === null` when building buckets',
      'runSetReconciliation residue cause — `counterparty_unattributed` applies where the definition NAMED a partition key and this row has no value for it',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s16Invoice,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 100_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Its counterparty is known; there was simply no cash in that bucket.',
      },
      {
        item: s16Cash,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 100_00n },
        cause: { kind: 'counterparty_unattributed' },
        disposition: 'unidentified',
        why: 'The cause names the actual defect — an unusable payer field — rather than reporting the row as simply unmatched.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §I  TOPOLOGY 8 — a duplicate canonical id on one side
 * ====================================================================== */

const s8Ledger = ledgerDoc('srcdoc_SYN_ledger_beacon_dup', 'ar-open-items-beacon-dup.csv', [
  line(0, ledgerFields(id('INV-3050'), amt(500_00n), dte('2026-03-05'), id('CP-BEACON'))),
  /* The same invoice number keyed twice. `RulePredicate.unique_within` exists
   * because this is a real finding, not a degraded mode. */
  line(1, ledgerFields(id('INV-3050'), amt(500_00n), dte('2026-03-11'), id('CP-BEACON'))),
])
const s8Statement = bankDoc('srcdoc_SYN_stmt_beacon_dup', 'statement-2026-03-i.csv', [
  line(0, bankFields(id('INV-3050'), amt(500_00n), dte('2026-03-12'), id('CP-BEACON'), txt('GIRO INV-3050'))),
])

const s8First = at('INV-3050 (first keying)', 'left', 'srcdoc_SYN_ledger_beacon_dup', 0)
const s8Second = at('INV-3050 (duplicate keying)', 'left', 'srcdoc_SYN_ledger_beacon_dup', 1)
const s8Credit = at('GIRO INV-3050', 'right', 'srcdoc_SYN_stmt_beacon_dup', 0)

export const duplicateIdentifierIsAnAmbiguity: Scenario = {
  name: 'duplicateIdentifierIsAnAmbiguity',
  topology: '8 — a duplicate canonical id on one side must produce an AMBIGUITY, not a last-wins collapse',
  story: 'The same invoice number sits on the ledger twice. One payment quotes it.',
  input: runInput({
    runId: 'run_SYN_0012',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s8Ledger],
    rightDocuments: [s8Statement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'Zero allocations. One ambiguity finding recording 2 left candidates against 1 right, and ALL THREE rows in the residue as `identifier_ambiguous`. Nothing is silently paired and nothing is silently dropped.',
    derivedFrom: [
      'A9(a) — the index is `Map<key, AdmittedItem[]>` and never `Map<key, item>`; the draft collapsed duplicates and the dropped record was never matched',
      'arityPermits — `one_to_one` pairs only 1×1, so 2×1 is declined and recorded',
      'runSetReconciliation — every ref named in an ambiguity finding, on BOTH sides, is attributed to `identifier_ambiguous`',
      'docs/build/reconciliation-engine.md §8 run 3 states the same outcome for the same shape',
    ],
    allocations: [],
    ambiguities: [
      {
        on: PATHS.reference,
        strategyKind: 'exact_identifier',
        leftCandidates: 2,
        rightCandidates: 1,
        leftRefs: [s8First.ref, s8Second.ref],
        rightRefs: [s8Credit.ref],
      },
    ],
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s8First,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 500_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'Paying one of two identically numbered invoices would be moving money on a name collision.',
      },
      {
        item: s8Second,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 500_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'Under a last-wins index this row would never have been seen again.',
      },
      {
        item: s8Credit,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 500_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'The payment is as unresolved as the invoices are.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §J  TOPOLOGIES 9 AND 10 — free text, and the LLM seam
 *
 * ⚠️ THE STATEMENT IS THE LEFT POPULATION IN THESE TWO. `buildReaderRequests`
 * only ever emits a request for a LEFT-side residue entry, so the side carrying
 * counterparty prose has to be the left one for the seam to be reachable at all.
 * Obligations therefore sit on the right and `obligationSide` says so.
 * ====================================================================== */

const s9Statement = bankDoc('srcdoc_SYN_stmt_wire', 'statement-2026-03-j.csv', [
  line(
    0,
    bankFields(
      ABSENT,
      amt(2000_00n),
      dte('2026-03-20'),
      ABSENT,
      txt('WIRE PAYMENT FROM DUNLIN CERAMICS INV #10023 AND #10024'),
    ),
  ),
])
const s9Ledger = ledgerDoc('srcdoc_SYN_ledger_wire', 'ar-open-items-wire.csv', [
  line(0, ledgerFields(id('INV-10023'), amt(2000_00n), dte('2026-03-02'), id('CP-DUNLIN'))),
  line(1, ledgerFields(id('INV-10024'), amt(2000_00n), dte('2026-03-04'), id('CP-DUNLIN'))),
])

const s9Wire = at('Wire naming two invoices', 'left', 'srcdoc_SYN_stmt_wire', 0)
const s9Inv23 = at('INV-10023 · 2000.00', 'right', 'srcdoc_SYN_ledger_wire', 0)
const s9Inv24 = at('INV-10024 · 2000.00', 'right', 'srcdoc_SYN_ledger_wire', 1)

function wireRun(runId: string, readerCandidateCap?: number, promptEligible?: ReadonlySet<FieldPathKey>): SetReconciliationInput {
  const spec: RunSpec = {
    runId,
    left: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s9Statement],
    rightDocuments: [s9Ledger],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    /* The ledger is on the right in this run, so that is where the obligations are. */
    obligationSide: 'right',
    toleranceDirection: 'symmetric',
    ...(readerCandidateCap === undefined ? {} : { readerCandidateCap }),
    ...(promptEligible === undefined ? {} : { promptEligible }),
  }
  return runInput(spec)
}

const wireResidue: readonly ExpectedResidueEntry[] = [
  {
    item: s9Wire,
    settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 2000_00n },
    cause: { kind: 'no_strategy_paired' },
    disposition: 'unidentified',
    why: 'The reference field is absent, so the row carries no key for any identifier strategy.',
  },
  {
    item: s9Inv23,
    settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 2000_00n },
    cause: { kind: 'no_strategy_paired' },
    disposition: 'unidentified',
    why: 'Nothing on the statement side keyed to it.',
  },
  {
    item: s9Inv24,
    settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 2000_00n },
    cause: { kind: 'no_strategy_paired' },
    disposition: 'unidentified',
    why: 'Same.',
  },
]

export const freeTextMultiEntityBuildsAReaderRequest: Scenario = {
  name: 'freeTextMultiEntityBuildsAReaderRequest',
  topology: '9 — free-text naming several entities: "WIRE PAYMENT FROM … INV #10023 AND #10024"',
  story: 'A wire whose only clue is prose, against two open invoices of the same amount.',
  input: wireRun('run_SYN_0013'),
  expect: {
    summary:
      'Zero allocations and three residue rows, plus exactly ONE reader request: one subject, one description, two candidates the privileged side chose. The model may name a candidate only by index.',
    derivedFrom: [
      'model/reconciliation.ts §7 — one prompt carries exactly one counterparty description; there is no plural arm on `ReaderRequest`',
      'buildReaderRequests builds the candidate set under an EXACT amount anchor ALWAYS: `compareMoney(residual, subject.gross) === 0`',
      'ReaderCandidate.identifierForPrompt is OUR OWN normalised identifier; `ref` is not put in the prompt',
      'The class travels on the request so the CALLER can check `ModelUseConfig.maxDataClassInPrompt` — the engine does not decide it',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: wireResidue,
    readerRequests: [
      {
        requestOrdinal: 0,
        subject: s9Wire,
        untrustedDescription: 'WIRE PAYMENT FROM DUNLIN CERAMICS INV #10023 AND #10024',
        untrustedDescriptionClass: DATA_CLASSES.personal,
        candidates: [
          { index: 0, ref: s9Inv23.ref, identifierForPrompt: 'INV-10023' },
          { index: 1, ref: s9Inv24.ref, identifierForPrompt: 'INV-10024' },
        ],
      },
    ],
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

export const readerCandidateCapWithholdsTheSubject: Scenario = {
  name: 'readerCandidateCapWithholdsTheSubject',
  topology: '9 (containment bound) — the candidate cap is a hard ceiling, and it is not authorable by a pack',
  story: 'The same wire, on a run whose stated cap is one candidate.',
  input: wireRun('run_SYN_0014', 1),
  expect: {
    summary:
      'Identical ledger outcome, and NO reader request at all. A subject whose candidate set exceeds the cap is withheld rather than trimmed — a trimmed set would silently change what the quarantined side is asked.',
    derivedFrom: [
      'buildReaderRequests — `candidates.length > candidateCap` skips the subject entirely',
      'model/reconciliation.ts §5 AmountAnchor — one knob a pack may turn (pairing), one it may not (what the model is shown)',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: wireResidue,
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

export const narrativeNotPromptEligibleIsNeverCarried: Scenario = {
  name: 'narrativeNotPromptEligibleIsNeverCarried',
  topology: '9 (fail-closed gate) — the narrative exists, and the field is not eligible for a prompt',
  story: 'The same wire on a tenant whose bank narrative is not cleared for model processing.',
  input: wireRun('run_SYN_0015', undefined, NOTHING_PROMPT_ELIGIBLE),
  expect: {
    summary:
      'Identical ledger outcome, no reader request, and the description is never even carried onto the admitted item. Two gates, both fail-closed, and invariant 4 supplies both.',
    derivedFrom: [
      'admitOne — the description is read only where the path is BOTH classified and present in `modelPromptEligible`',
      'buildReaderRequests skips any subject whose `untrustedDescription` is null',
      'model/reconciliation.ts PopulationBinding.description — a path here is not sufficient to reach a prompt',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: wireResidue,
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* --- Topology 10: unparseable, and no candidate to confirm. --- */

const s10Statement = bankDoc('srcdoc_SYN_stmt_cash_dep', 'statement-2026-03-k.csv', [
  line(0, bankFields(ABSENT, amt(75_00n), dte('2026-03-14'), ABSENT, txt('CASH DEP 08/12'))),
])
const s10Ledger = ledgerHeaderDoc(
  'srcdoc_SYN_inv_8001',
  'FULMAR-INV-8001.pdf',
  ledgerFields(id('INV-8001'), amt(300_00n), dte('2026-03-01'), id('CP-FULMAR')),
)

const s10Cash = at('CASH DEP 08/12 · 75.00', 'left', 'srcdoc_SYN_stmt_cash_dep', 0)
const s10Invoice = at('INV-8001 · 300.00', 'right', 'srcdoc_SYN_inv_8001', null)

export const unparseableNarrativeGetsNoRequest: Scenario = {
  name: 'unparseableNarrativeGetsNoRequest',
  topology: '10 — unparseable: "CASH DEP 08/12"',
  story: 'A deposit line with no reference, no payer and a narrative that names nothing.',
  input: runInput({
    runId: 'run_SYN_0016',
    left: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s10Statement],
    rightDocuments: [s10Ledger],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'right',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'Both rows fall to the residue and NO reader request is emitted — not because the text is unreadable, but because there is no open obligation of 7500 for the reader to confirm. The seam can only ever confirm something that already exists on our side.',
    derivedFrom: [
      'buildReaderRequests — an EMPTY candidate set produces NO REQUEST, and that is correct for reconciliation: the residue is the product',
      'model/reconciliation.ts §7 — this seam is NOT a general-purpose extractor and must never be reused as one',
      'The row is admitted, not refused: its amount and date are readable, so nothing about it is unreadable in the admission sense',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s10Cash,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 75_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'No reference, so no key; nothing to join on.',
      },
      {
        item: s10Invoice,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 300_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Still open, and it is not a candidate for the deposit: the amounts differ.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §K  TOPOLOGY 11 — two currencies, which must NEVER match across
 *
 * 🛑 C16 REWROTE THIS SECTION'S SPECIFICATION AND NOT ONLY ITS VALUES. It used
 * to say that a population takes its currency from its first admitted row. It
 * now says that a population is DECLARED, and the two scenarios below are the
 * same rows in two different orders reaching the same answer — which is the
 * property the seeding rule did not have.
 * ====================================================================== */

/** C16's row-level refusal, spelled once: a USD row against an SGD declaration. */
const USD_AGAINST_SGD: AdmissionRefusal = {
  kind: 'money_unit_disagrees_with_declared',
  refusal: { kind: 'currency_mismatch' },
}

const s11Ledger = ledgerDoc('srcdoc_SYN_ledger_fx', 'ar-open-items-fx.csv', [
  line(0, ledgerFields(id('INV-9001'), amt(1000_00n), dte('2026-03-03'), id('CP-FULMAR'))),
  line(1, ledgerFields(id('INV-9002'), amt(1000_00n, 'USD'), dte('2026-03-03'), id('CP-FULMAR'))),
])
const s11Statement = bankDoc('srcdoc_SYN_stmt_fx', 'statement-2026-03-l.csv', [
  line(0, bankFields(id('INV-9001'), amt(1000_00n), dte('2026-03-06'), id('CP-FULMAR'), txt('GIRO INV-9001'))),
  line(
    1,
    bankFields(id('INV-9002'), amt(1000_00n, 'USD'), dte('2026-03-06'), id('CP-FULMAR'), txt('TT INV-9002 USD')),
  ),
])

const s11SgdInvoice = at('INV-9001 · SGD 1000.00', 'left', 'srcdoc_SYN_ledger_fx', 0)
const s11UsdInvoice = at('INV-9002 · USD 1000.00', 'left', 'srcdoc_SYN_ledger_fx', 1)
const s11SgdCredit = at('GIRO · SGD 1000.00', 'right', 'srcdoc_SYN_stmt_fx', 0)
const s11UsdCredit = at('TT · USD 1000.00', 'right', 'srcdoc_SYN_stmt_fx', 1)

export const twoCurrenciesNeverMatchAcross: Scenario = {
  name: 'twoCurrenciesNeverMatchAcross',
  topology: '11 — two currencies present, which must NEVER match across',
  story: 'A ledger and a statement that each carry one SGD row and one USD row.',
  input: runInput({
    runId: 'run_SYN_0017',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s11Ledger],
    rightDocuments: [s11Statement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'Both sides DECLARE SGD at exponent 2, so the USD rows never reach the ledger at all: each is REFUSED at admission with `money_unit_disagrees_with_declared` carrying `currency_mismatch`. The SGD pair matches exactly. There is no cross-currency comparison anywhere in the run.',
    derivedFrom: [
      'C16 — CURRENCY IS DECLARED, NEVER INFERRED. ⚠️ THIS ROW USED TO READ *"admitPopulation — `currency` is fixed by the first admitted item and every later row is checked against it"*, which stated the SEEDING DEFECT as the specification: the first admitted row denominated the whole side and nothing refused it, so the same file in a different row order produced a different close. The expectation below was re-derived by hand from the declaration, not by running the engine — see `declaredUnitSurvivesRowOrder`, which is this scenario with the ledger rows swapped and the same answer.',
      'admitOne — `sameUnit(gross, binding.declaredUnit)` runs on EVERY row including the first, and a disagreement is a row-level refusal that lands in the residue with its reason. The declaration is the authority; a row may never redefine it.',
      'sameUnit — even reached, `subtractMoney` across currencies refuses with `currency_mismatch`, so a cross-currency pairing is unrepresentable at two independent layers',
      'model/domain.ts — `FxConversion` and `FxPolicy` are @dropped-for-v1: every figure on every v1 screen is in one currency',
      'ResidueEntry.settlement is NULL for an item refused at admission — an item whose amount was not accepted HAS no settlement, and a fabricated zero on that row is exactly what the field exists to prevent',
    ],
    allocations: [
      {
        from: s11SgdCredit,
        to: s11SgdInvoice,
        amountMinor: 1000_00n,
        evidence: { kind: 'exact_identifier', on: PATHS.reference },
        why: 'The one pair that shares a currency and a key.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: s11UsdInvoice, path: PATHS.ledgerAmount, refusal: USD_AGAINST_SGD },
      { item: s11UsdCredit, path: PATHS.bankAmount, refusal: USD_AGAINST_SGD },
    ],
    residue: [
      {
        item: s11UsdInvoice,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: USD_AGAINST_SGD },
        disposition: 'error_left',
        why: 'A refused row is never skipped; it lands in the residue with the reason attached.',
      },
      {
        item: s11UsdCredit,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: USD_AGAINST_SGD },
        disposition: 'error_right',
        why: 'Disposition follows the SIDE for an admission refusal — that is the only thing the engine may infer here.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---------------------------------------------------------------------- *
 * TOPOLOGY 11a — THE SAME ROWS, THE OTHER WAY UP
 *
 * 🛑 THE SCENARIO THAT MAKES C16 LEGIBLE, AND IT IS A PAIR WITH THE ONE ABOVE
 * RATHER THAN AN EXTRA CASE. The ledger's two lines are SWAPPED, so the USD row
 * is index 0 and is therefore the FIRST row admission reaches on that side.
 * Everything else is identical, and so is every expectation below except the line
 * indices the items live at.
 *
 * WHAT THE SEEDING RULE WOULD HAVE DONE HERE, hand-traced rather than run: the
 * left side would have taken USD from row 0 and REFUSED the SGD invoice; the
 * right side would still have taken SGD from its row 0 and refused the USD
 * credit. The two survivors — a USD invoice and an SGD credit — carry DIFFERENT
 * references, so `passIdentifierJoin` would have found no shared key, allocated
 * NOTHING, and closed a run in which every single row was either refused or
 * unmatched. Same file, two row orders, two different answers, neither of them
 * flagged. That is the defect stated as a fixture.
 * ---------------------------------------------------------------------- */

const s11aLedger = ledgerDoc('srcdoc_SYN_ledger_fx_rowswap', 'ar-open-items-fx-rowswap.csv', [
  /* Index 0 is the USD row. Under the rule C16 deletes, THIS row would have
   * denominated the ledger. */
  line(0, ledgerFields(id('INV-9002'), amt(1000_00n, 'USD'), dte('2026-03-03'), id('CP-FULMAR'))),
  line(1, ledgerFields(id('INV-9001'), amt(1000_00n), dte('2026-03-03'), id('CP-FULMAR'))),
])

const s11aUsdInvoice = at('INV-9002 · USD 1000.00 (row 0)', 'left', 'srcdoc_SYN_ledger_fx_rowswap', 0)
const s11aSgdInvoice = at('INV-9001 · SGD 1000.00 (row 1)', 'left', 'srcdoc_SYN_ledger_fx_rowswap', 1)

export const declaredUnitSurvivesRowOrder: Scenario = {
  name: 'declaredUnitSurvivesRowOrder',
  topology: '11a — the two-currency ledger with its rows swapped; the answer must not move',
  story: 'The same March ledger and statement, exported with the USD line first.',
  input: runInput({
    runId: 'run_SYN_0017a',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s11aLedger],
    rightDocuments: [s11Statement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'Identical to `twoCurrenciesNeverMatchAcross` in every dimension — one allocation on the SGD pair, two admission refusals on the USD rows, nothing else — because the denomination is declared and row order cannot reach it.',
    derivedFrom: [
      'C16 — the declaration is the authority, so `admitOne` compares every row against `binding.declaredUnit` and the fold carries no order-dependent state but the ordinal itself. Admission is therefore INDEPENDENT of row order, not merely deterministic in it.',
      'Hand-traced against the seeding rule for contrast: it would have denominated the ledger USD from row 0, refused the SGD invoice, left INV-9002(USD, left) against INV-9001(SGD, right), found no shared key and allocated nothing. This scenario and the one above would then disagree on the same rows.',
      'ResidueEntry.settlement is NULL for an item refused at admission — an item whose amount was not accepted HAS no settlement.',
    ],
    allocations: [
      {
        from: s11SgdCredit,
        to: s11aSgdInvoice,
        amountMinor: 1000_00n,
        evidence: { kind: 'exact_identifier', on: PATHS.reference },
        why: 'The one pair that shares a key and the declared unit — reached whichever row the exporter wrote first.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: s11aUsdInvoice, path: PATHS.ledgerAmount, refusal: USD_AGAINST_SGD },
      { item: s11UsdCredit, path: PATHS.bankAmount, refusal: USD_AGAINST_SGD },
    ],
    residue: [
      {
        item: s11aUsdInvoice,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: USD_AGAINST_SGD },
        disposition: 'error_left',
        why: 'Refused FIRST on its side and still refused — under the seeding rule this row was the definition.',
      },
      {
        item: s11UsdCredit,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: USD_AGAINST_SGD },
        disposition: 'error_right',
        why: 'Unchanged from the unswapped scenario; the right side was never reordered.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---------------------------------------------------------------------- *
 * TOPOLOGY 11b — THE SAME CURRENCY AT TWO SCALES
 *
 * 🛑 THE CASE A CURRENCY-ONLY CHECK CANNOT SEE, AND `KNOWN_GAPS` NAMED IT AS
 * UNCOVERED UNTIL C16. `SGD 1000` written at exponent 0 against a population
 * declared at exponent 2 is a HUNDREDFOLD error. The arm C16 replaces compared
 * `gross.currency` alone, so this row was ADMITTED and the error surfaced later,
 * inside a pass, as a tolerance artefact. `sameUnit` compares both halves.
 * ---------------------------------------------------------------------- */

const s11bLedger = ledgerDoc('srcdoc_SYN_ledger_scale', 'ar-open-items-scale.csv', [
  line(0, ledgerFields(id('INV-9101'), amt(1000_00n), dte('2026-03-03'), id('CP-FULMAR'))),
  /* SGD 1000, written whole rather than in cents. The currency AGREES. */
  line(1, ledgerFields(id('INV-9102'), amt(1000n, 'SGD', 0), dte('2026-03-03'), id('CP-FULMAR'))),
])
const s11bStatement = bankDoc('srcdoc_SYN_stmt_scale', 'statement-2026-03-l2.csv', [
  line(0, bankFields(id('INV-9101'), amt(1000_00n), dte('2026-03-06'), id('CP-FULMAR'), txt('GIRO INV-9101'))),
  line(1, bankFields(id('INV-9102'), amt(1000_00n), dte('2026-03-06'), id('CP-FULMAR'), txt('GIRO INV-9102'))),
])

const s11bScaledInvoice = at('INV-9102 · SGD 1000 at exponent 0', 'left', 'srcdoc_SYN_ledger_scale', 1)
const s11bOrphanCredit = at('GIRO INV-9102 · SGD 1000.00', 'right', 'srcdoc_SYN_stmt_scale', 1)

/** C16's other row-level refusal: the currency agrees and the SCALE does not. */
const SCALE_AGAINST_SGD_2: AdmissionRefusal = {
  kind: 'money_unit_disagrees_with_declared',
  refusal: { kind: 'exponent_mismatch' },
}

export const mixedExponentIsRefusedAtAdmission: Scenario = {
  name: 'mixedExponentIsRefusedAtAdmission',
  topology: '11b — one row in the declared currency at the wrong scale',
  story: 'A ledger export where one line was written in whole dollars and the rest in cents.',
  input: runInput({
    runId: 'run_SYN_0017b',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s11bLedger],
    rightDocuments: [s11bStatement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'The exponent-0 invoice is REFUSED at admission with `exponent_mismatch` — the same arm as a wrong currency, because a wrong scale is a wrong unit. Its counterpart credit then has no left-hand key at all and lands in the residue unmatched, which is TRUE of it: the row it belonged to never entered the ledger.',
    derivedFrom: [
      'C16 — `admitOne` calls `sameUnit(gross, binding.declaredUnit)`, which compares currency AND exponent. The check it replaces compared `gross.currency` alone, so this row was admitted and the hundredfold error surfaced later as a `MoneyRefusal` from `addMoney` inside a pass — an admission defect wearing a tolerance artefact (§5.7).',
      'passIdentifierJoin iterates the LEFT index keys and skips a key with no right-hand candidate; a key present only on the RIGHT is never visited at all, so the orphaned credit is untouched by the pass and stays open.',
      'dispositionFor — an unallocated item whose cause is `no_strategy_paired` is `unidentified`; only an `admission_refused` cause takes a side-specific error disposition.',
    ],
    allocations: [
      {
        from: at('GIRO INV-9101 · SGD 1000.00', 'right', 'srcdoc_SYN_stmt_scale', 0),
        to: at('INV-9101 · SGD 1000.00', 'left', 'srcdoc_SYN_ledger_scale', 0),
        amountMinor: 1000_00n,
        evidence: { kind: 'exact_identifier', on: PATHS.reference },
        why: 'The row written at the declared scale matches exactly; a zero variance selects `exact_identifier` over `tolerant_identifier`.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: s11bScaledInvoice, path: PATHS.ledgerAmount, refusal: SCALE_AGAINST_SGD_2 },
    ],
    residue: [
      {
        item: s11bScaledInvoice,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: SCALE_AGAINST_SGD_2 },
        disposition: 'error_left',
        why: 'Refused rows lead the residue, in admission order, left side first.',
      },
      {
        item: s11bOrphanCredit,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 1000_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Its counterpart never reached the ledger, so nothing matched it — and here that sentence is true rather than a mislabelled configuration error.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §L  TOPOLOGY 12 — a date that does not parse, and a same-day tie-break
 * ====================================================================== */

const s12Ledger = ledgerDoc('srcdoc_SYN_ledger_tiebreak', 'ar-open-items-tiebreak.csv', [
  /* Two invoices, same customer, same day, same amount. Only the admission
   * ordinal can separate them, and it must — every re-run has to allocate the
   * same one. */
  line(0, ledgerFields(id('INV-1201'), amt(100_00n), dte('2026-03-15'), id('CP-BEACON'))),
  line(1, ledgerFields(id('INV-1202'), amt(100_00n), dte('2026-03-15'), id('CP-BEACON'))),
  /* 30 February. A calendar that does not exist. */
  line(2, ledgerFields(id('INV-1203'), amt(100_00n), dte('2026-02-30'), id('CP-BEACON'))),
  /* A date column somebody exported as prose. */
  line(3, ledgerFields(id('INV-1204'), amt(100_00n), txt('15 March 2026'), id('CP-BEACON'))),
])
const s12Statement = bankDoc('srcdoc_SYN_stmt_tiebreak', 'statement-2026-03-m.csv', [
  line(0, bankFields(ABSENT, amt(100_00n), dte('2026-03-16'), id('CP-BEACON'), txt('FAST BEACON FOODS'))),
])

const s12First = at('INV-1201 · 15 Mar (ordinal 0)', 'left', 'srcdoc_SYN_ledger_tiebreak', 0)
const s12Second = at('INV-1202 · 15 Mar (ordinal 1)', 'left', 'srcdoc_SYN_ledger_tiebreak', 1)
const s12BadCalendar = at('INV-1203 · dated 2026-02-30', 'left', 'srcdoc_SYN_ledger_tiebreak', 2)
const s12ProseDate = at('INV-1204 · dated "15 March 2026"', 'left', 'srcdoc_SYN_ledger_tiebreak', 3)

export const badDateAndSameDayTieBreak: Scenario = {
  name: 'badDateAndSameDayTieBreak',
  topology: '12 — a date that does not parse, and a same-day tie needing a stable tie-break',
  story: 'A March ledger with two identical same-day invoices and two rows whose date column is broken.',
  input: nmRun('run_SYN_0018', [s12Ledger], [s12Statement]),
  expect: {
    summary:
      'The two broken rows are refused at admission with two DIFFERENT refusals and land in the residue with no settlement. Of the two identical same-day invoices, the payment settles the one with the LOWER admission ordinal — every time, on every re-run.',
    derivedFrom: [
      'A9(f) — `new Date` is never used; the date scalar is validated at admission and `parseCalendarDate` rejects 2026-02-30 because 30 > daysInMonth(2026, 2)',
      'AdmissionRefusal — `date_not_iso_calendar` carries NO value, because the rejected string is counterparty-controlled; `date_not_extractable` carries only the scalar KIND it found',
      'A9(h) — `fifoOrder` is total: (dayNumber, admission ordinal). Without the second term the same input produces two different audits',
      'boundedSubsetSum walks a FIFO-sorted candidate list and returns the FIRST exact combination, which here is the single invoice at ordinal 0',
    ],
    allocations: [
      {
        from: at('FAST payment · 100.00', 'right', 'srcdoc_SYN_stmt_tiebreak', 0),
        to: s12First,
        amountMinor: 100_00n,
        evidence: { kind: 'amount_sum_exact', memberCount: 1 },
        why: 'A single-member exact solution. The tie against INV-1202 is broken by ordinal, never by map order.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: s12BadCalendar, path: PATHS.ledgerDate, refusal: { kind: 'date_not_iso_calendar' } },
      { item: s12ProseDate, path: PATHS.ledgerDate, refusal: { kind: 'date_not_extractable', found: 'text' } },
    ],
    residue: [
      {
        item: s12BadCalendar,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: { kind: 'date_not_iso_calendar' } },
        disposition: 'error_left',
        why: 'A row that cannot be ordered cannot be allocated, and it is reported rather than sorted into an arbitrary position.',
      },
      {
        item: s12ProseDate,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: { kind: 'date_not_extractable', found: 'text' } },
        disposition: 'error_left',
        why: 'The refusal names the kind found, so an operator can see it is a mapping error rather than a bad date.',
      },
      {
        item: s12Second,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 100_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'The loser of the tie-break stays fully open — it is not half-paid and it is not closed.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §M  EXTRA — the amount-and-date pass, which no topology above reaches
 * ====================================================================== */

const s13Invoice = ledgerHeaderDoc(
  'srcdoc_SYN_inv_13001',
  'FULMAR-INV-13001.pdf',
  ledgerFields(ABSENT, amt(250_00n), dte('2026-03-10'), id('CP-FULMAR')),
)
const s13Statement = bankDoc('srcdoc_SYN_stmt_window', 'statement-2026-03-n.csv', [
  line(0, bankFields(ABSENT, amt(250_00n), dte('2026-03-13'), id('CP-FULMAR'), txt('INWARD FULMAR RAIL'))),
])

const s13InvoiceAt = at('Unreferenced invoice · 250.00', 'left', 'srcdoc_SYN_inv_13001', null)
const s13CreditAt = at('Inward credit 13 Mar', 'right', 'srcdoc_SYN_stmt_window', 0)

export const amountAndDateWithinWindow: Scenario = {
  name: 'amountAndDateWithinWindow',
  topology: 'extra — no reference on either side; the pairing is amount plus a date window',
  story: 'Neither system carries a reference. The amount is exact and the credit lands three days later.',
  input: runInput({
    runId: 'run_SYN_0019',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s13Invoice],
    rightDocuments: [s13Statement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [{ kind: 'amount_and_date' }]),
    strategyBindings: [bound({ kind: 'amount_and_date' })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'One allocation carrying `amount_and_date` with a dayGap of +3. The gap is signed (right minus left), so a credit BEFORE the invoice would be recorded as negative rather than as the same thing.',
    derivedFrom: [
      'passAmountAndDate — only a `days` tolerance drives this pass; any other kind returns the state untouched',
      'The day gap is computed by integer arithmetic over `dayNumber`, never by `new Date` subtraction',
      'A single admitted candidate allocates; two would be an ambiguity',
    ],
    allocations: [
      {
        from: s13CreditAt,
        to: s13InvoiceAt,
        amountMinor: 250_00n,
        evidence: { kind: 'amount_and_date', dayGap: 3 },
        why: '2026-03-13 minus 2026-03-10 is three days, inside the five-day tolerance.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

const s14Invoice = ledgerHeaderDoc(
  'srcdoc_SYN_inv_14001',
  'FULMAR-INV-14001.pdf',
  ledgerFields(ABSENT, amt(250_00n), dte('2026-03-10'), id('CP-FULMAR')),
)
const s14Statement = bankDoc('srcdoc_SYN_stmt_window_two', 'statement-2026-03-o.csv', [
  line(0, bankFields(ABSENT, amt(250_00n), dte('2026-03-11'), id('CP-FULMAR'), txt('INWARD FULMAR RAIL 1'))),
  line(1, bankFields(ABSENT, amt(250_00n), dte('2026-03-12'), id('CP-FULMAR'), txt('INWARD FULMAR RAIL 2'))),
])

const s14InvoiceAt = at('Unreferenced invoice · 250.00', 'left', 'srcdoc_SYN_inv_14001', null)
const s14CreditOne = at('Inward credit 11 Mar', 'right', 'srcdoc_SYN_stmt_window_two', 0)
const s14CreditTwo = at('Inward credit 12 Mar', 'right', 'srcdoc_SYN_stmt_window_two', 1)

export const amountAndDateTwoCandidatesIsAmbiguous: Scenario = {
  name: 'amountAndDateTwoCandidatesIsAmbiguous',
  topology: 'extra — two credits of the same amount inside the same window',
  story: 'Two identical credits, one invoice. Guessing would be a coin toss with money on it.',
  input: runInput({
    runId: 'run_SYN_0020',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s14Invoice],
    rightDocuments: [s14Statement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [{ kind: 'amount_and_date' }]),
    strategyBindings: [bound({ kind: 'amount_and_date' })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'Zero allocations, one ambiguity finding with `on: null` — this pass keys on no field — and all three rows in the residue as `identifier_ambiguous`.',
    derivedFrom: [
      'passAmountAndDate records an ambiguity and allocates nothing whenever more than one candidate is admitted',
      'AmbiguityFinding.on is nullable precisely because `amount_and_date` names no field',
    ],
    allocations: [],
    ambiguities: [
      {
        on: null,
        strategyKind: 'amount_and_date',
        leftCandidates: 1,
        rightCandidates: 2,
        leftRefs: [s14InvoiceAt.ref],
        rightRefs: [s14CreditOne.ref, s14CreditTwo.ref],
      },
    ],
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s14InvoiceAt,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 250_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'Named in the finding, so the cause is the ambiguity rather than an absence of evidence.',
      },
      {
        item: s14CreditOne,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 250_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'Both candidates are reported, not just the one that would have won.',
      },
      {
        item: s14CreditTwo,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 250_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'Same.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §N  EXTRA — G106, fail-closed: a path with no classification is unreadable
 * ====================================================================== */

const CLASSIFICATION_MISSING_BANK_AMOUNT: ReadonlyMap<FieldPathKey, DataClass> = new Map<
  FieldPathKey,
  DataClass
>([...STANDARD_CLASSIFICATION].filter(([key]) => key !== k(PATHS.bankAmount)))

export const unclassifiedFieldFailsClosed: Scenario = {
  name: 'unclassifiedFieldFailsClosed',
  topology: 'extra — G106: a key with no classification is UNREADABLE, and admission fails closed',
  story: 'Someone maps a new bank export and forgets to classify the credit column.',
  input: runInput({
    runId: 'run_SYN_0021',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s1LeftInvoice],
    rightDocuments: [s1RightPayment],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    classification: CLASSIFICATION_MISSING_BANK_AMOUNT,
  }),
  expect: {
    summary:
      'The whole right population is refused — one row, one refusal, `field_not_classified` on the amount path — and the invoice it would have settled is left open. Nothing defaults to readable and nothing defaults to a class.',
    derivedFrom: [
      'G106 — an unmapped key is stored but unaddressable by any agent, prompt, export or dashboard; the rejected alternative was defaulting to the most sensitive class, because readable-by-default-with-a-high-bar is scope failing OPEN',
      'admitOne checks classification BEFORE reading the value, so an unclassified field is never even read',
      'The refusal is reported per item with the offending path, so the fix is one line of configuration away',
      /* ⚠️ AN EXPECTATION THAT MOVED. This scenario expected `SOUND` until C13,
       * and it was the very case C13 exists to catch: the right population was
       * refused ENTIRELY and the run reported a ledger with nothing wrong with
       * it. Hand-derived, not re-run: the right side presents one row (a header
       * -grain document, so `presentedRowCount` is 1) and admits none, so
       * `presented === 1` and `admitted === 0` — the arm's exact condition. The
       * left side presents one and admits one, so it does not fire. */
      'C13 — `population_wholly_refused` on the RIGHT side, `sideRowCount: 1`. Every row this side presented was refused, so the ledger is sound over NOTHING, and `checkPostconditions` could not see that before C13 because every other check iterates the ADMITTED set — which is empty here and therefore trivially consistent.',
      'C13 — it is a POST-CONDITION and not a refusal, and this scenario is the argument for that ruling: refusing would delete the residue, and the residue entry below, carrying `field_not_classified` on the amount path, is the entire useful output of this run.',
      'C13 — the rate here is 10000 basis points, which exceeds every LEGAL ceiling because the upper bound is exclusive. `admission_refusal_rate_above_ceiling` does NOT fire, because it requires at least one admitted row: a refusal there would delete this residue, and there is no ledger-over-a-minority to refuse.',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: s1Payment, path: PATHS.bankAmount, refusal: { kind: 'field_not_classified' } },
    ],
    residue: [
      {
        item: s1Payment,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: { kind: 'field_not_classified' } },
        disposition: 'error_right',
        why: 'A configuration defect surfaces as a residue row an operator can act on.',
      },
      {
        item: s1Invoice,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 125_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Its counterpart never entered the run.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [{ kind: 'population_wholly_refused', side: 'right', sideRowCount: 1 }],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §N2  EXTRA — two references equally close to the same invoice
 *
 * 🛑 THIS SCENARIO'S EXPECTATION DISAGREES WITH THE MODULE AT HEAD, AND THE
 * EXPECTATION IS LEFT AS THE SPECIFICATION REQUIRES IT. See
 * `KNOWN_DISAGREEMENTS_AT_HEAD` at the end of this file before you touch it.
 * ====================================================================== */

const s21Invoice = ledgerHeaderDoc(
  'srcdoc_SYN_inv_21001',
  'EGRET-INV-2087-B.pdf',
  ledgerFields(id('INV-2087'), amt(3412_00n), dte('2026-03-06'), id('CP-EGRET')),
)
const s21Statement = bankDoc('srcdoc_SYN_stmt_egret_tie', 'statement-2026-03-p.csv', [
  /* One substitution each, in different positions, over the same length: both
   * score round(7/8 × 10000) = 8750. Neither is closer than the other. */
  line(0, bankFields(id('INV-2O87'), amt(3412_00n), dte('2026-03-10'), id('CP-EGRET'), txt('GIRO INV-2O87'))),
  line(1, bankFields(id('INV-20X7'), amt(3412_00n), dte('2026-03-10'), id('CP-EGRET'), txt('GIRO INV-20X7'))),
])

const s21InvoiceAt = at('INV-2087 (Egret Media)', 'left', 'srcdoc_SYN_inv_21001', null)
const s21TieOne = at('GIRO, first tied reference', 'right', 'srcdoc_SYN_stmt_egret_tie', 0)
const s21TieTwo = at('GIRO, second tied reference', 'right', 'srcdoc_SYN_stmt_egret_tie', 1)

export const fuzzyTieIsAnAmbiguity: Scenario = {
  name: 'fuzzyTieIsAnAmbiguity',
  topology: '4 (tie) — two credits equally similar to one reference; neither may be chosen',
  story: 'Two GIRO credits for the same amount, each one character away from the invoice number.',
  input: runInput({
    runId: 'run_SYN_0022',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s21Invoice],
    rightDocuments: [s21Statement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, fuzzyStrategies),
    strategyBindings: fuzzyBindings,
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'Zero allocations and one ambiguity naming BOTH tied candidates, so all three rows carry `identifier_ambiguous`. A tie is the case where a similarity score is at its least trustworthy, and picking the first one encountered would be moving money on iteration order.',
    derivedFrom: [
      'passFuzzyReference records an ambiguity and allocates nothing whenever `tied > 1`',
      'AmbiguityFinding carries `rightCandidates` AND `rightRefs`; a finding whose count is 2 and whose ref list has one entry contradicts itself, and the residue then disposes two equally implicated rows differently',
      'The module\'s two other passes both name every candidate: passIdentifierJoin lists `right.map(i => i.ref)` and passAmountAndDate lists `candidates.map(i => i.ref)`',
      'runSetReconciliation attributes `identifier_ambiguous` to every ref NAMED in a finding — so a ref left out of the finding is silently downgraded to `no_strategy_paired`',
    ],
    allocations: [],
    ambiguities: [
      {
        on: PATHS.reference,
        strategyKind: 'fuzzy_reference',
        leftCandidates: 1,
        rightCandidates: 2,
        leftRefs: [s21InvoiceAt.ref],
        /* BOTH. This is the line the module disagrees with at HEAD. */
        rightRefs: [s21TieOne.ref, s21TieTwo.ref],
      },
    ],
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s21InvoiceAt,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 3412_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'The invoice is what the two credits are ambiguous about.',
      },
      {
        item: s21TieOne,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 3412_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'One of the two tied candidates.',
      },
      {
        item: s21TieTwo,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 3412_00n },
        cause: { kind: 'identifier_ambiguous' },
        disposition: 'unidentified',
        why: 'The other. It is exactly as implicated as the first, and an operator reviewing the tie needs to see both rows carrying the same reason.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §N3  EXTRA — C17: TWO COPIES OF ONE ADDRESS, BOTH REFUSED AT ADMISSION
 *
 * 🛑 THIS IS THE REGRESSION GUARD ON C17's NARROWING, AND IT IS THE ONLY
 * FIXTURE THAT ASSERTS THE ENGINE STILL RUNS. C17 refuses a duplicated address
 * only when AT LEAST ONE copy was admitted, because only an admitted copy
 * reaches the fold and only the fold loses money. Two refused copies already
 * have a named outcome — two residue entries at one key, reported by
 * `checkPostconditions` as `item_in_residue_twice`, with both rows and both
 * reasons visible to an operator. Refusing the run here would REPLACE that
 * named outcome with nothing at all.
 *
 * Without this scenario, the next reader "simplifies" §4a by deleting the
 * `admittedAt` check and the suite stays green.
 * ====================================================================== */

/**
 * The same row twice, at line index 0 both times — a mapper that emitted a
 * constant index, not a duplicated invoice number. Neither copy is readable:
 * the amount column carries prose, so both are refused at admission.
 */
const s22RedeliveredRow = ledgerFields(
  id('INV-4100'),
  txt('see attached remittance'),
  dte('2026-03-04'),
  id('CP-PELICAN'),
)
const s22DoubledLedger = ledgerDoc('srcdoc_SYN_inv_4100_doubled', 'PELICAN-AR-2026-03.csv', [
  line(0, s22RedeliveredRow),
  line(0, s22RedeliveredRow),
])
const s22DoubledRow = at('INV-4100 (Pelican) at line 0 — twice', 'left', 'srcdoc_SYN_inv_4100_doubled', 0)

const AMOUNT_IS_PROSE: AdmissionRefusal = { kind: 'amount_not_money', found: 'text' }

export const bothCopiesRefusedIsStillTheNamedOutcome: Scenario = {
  name: 'bothCopiesRefusedIsStillTheNamedOutcome',
  topology: 'extra — C17: a duplicated ADDRESS whose copies are both refused keeps its named outcome',
  story: 'A ledger export writes every row at line 0, and the amount column holds a note rather than a figure.',
  input: runInput({
    runId: 'run_SYN_0023',
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s22DoubledLedger],
    rightDocuments: [s1RightPayment],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'The run PROCEEDS. Neither copy was admitted, so nothing reached the fold and no money can have been lost there; both copies are in the residue with their own reason, and `item_in_residue_twice` reports the collision as the post-condition it has always been. This is the one scenario in the corpus whose post-conditions are not empty, and the non-empty list is the expectation rather than a defect in the run.',
    derivedFrom: [
      'C17 — the refusal requires AT LEAST ONE ADMITTED COPY; a refused copy never enters `state.items`, so the fold cannot overwrite anything and there is nothing for the refusal to protect',
      'checkPostconditions counts residue entries per `itemKey` and reports `item_in_residue_twice` once per key seen more than once — two entries at one key is one duplicated key, so the count is 1 and not 2',
      'admitPopulation iterates `document.lines` and derives the ref from `line.index`, so two lines carrying index 0 produce two items at one address',
      'The residue order is every admission refusal in admission order, then every still-open admitted item — so both left refusals precede the open bank credit',
      'C17 IS NOT DUPLICATE-INVOICE DETECTION: the collision here is an ADDRESS collision, and the reason each row is refused (`amount_not_money`) is a per-row admission defect that C17 never looks at',
      /* ⚠️ A SECOND EXPECTATION THAT MOVED AT C13, and the plan named only the
       * other one. Hand-derived: the LEFT document carries two lines, so
       * `presentedRowCount` is 2 and `presented === 2`; both copies are refused,
       * so `admitted === 0`. That is the wholly-refused condition exactly, and it
       * is TRUE of this run — the summary above has always said so in prose
       * ("neither copy was admitted"), and C13 is what made the sentence
       * machine-visible. The right side presents one row and admits it, so it
       * does not fire. */
      'C13 — `population_wholly_refused` on the LEFT side, `sideRowCount: 2`, and it is reported BEFORE `item_in_residue_twice` because `checkPostconditions` emits the admission-grain finding first: on a wholly-refused side there is nothing for the ledger checks below it to be true OF.',
      'C13 — the rate arm does not fire even though the rate is 10000 basis points, because it requires at least one ADMITTED row. Refusing here would delete the two residue entries that are this scenario’s entire subject.',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: s22DoubledRow, path: PATHS.ledgerAmount, refusal: AMOUNT_IS_PROSE },
      { item: s22DoubledRow, path: PATHS.ledgerAmount, refusal: AMOUNT_IS_PROSE },
    ],
    residue: [
      {
        item: s22DoubledRow,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_left',
        why: 'The first copy. It is a row an operator has to fix, and it is visible.',
      },
      {
        item: s22DoubledRow,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_left',
        why: 'The second copy, at the SAME address. Both are reported; neither is chosen over the other, and nothing is dropped.',
      },
      {
        item: s1Payment,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 125_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'The obligation it would have settled never entered the run.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    /* `item_in_residue_twice` counts KEYS seen more than once, not entries, so
     * two entries at one address is a count of 1. C13's arm precedes it: the
     * left side presented two rows and admitted neither. */
    postconditions: [
      { kind: 'population_wholly_refused', side: 'left', sideRowCount: 2 },
      { kind: 'item_in_residue_twice', count: 1 },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/** Every scenario that expects `{ ok: true }`. Ordered by topology. */
/* ====================================================================== *
 * §N2  C18 — WHAT THE FILE SAID ABOUT ITSELF
 *
 * 🛑 THE THING NONE OF THE TWENTY-FIVE SCENARIOS ABOVE COULD SEE. Every
 * post-condition in this corpus is an INTERNAL-CONSISTENCY check: the ledger
 * against the residue, over what was ADMITTED. A file that arrived one row short
 * is internally consistent — the missing row is missing from both totals, so
 * `gross_not_partitioned` balances and nothing anywhere notices. C18 supplies the
 * only operand that comes from OUTSIDE the admitted set: the file's own trailer.
 *
 * 🛑 AND ONLY ONE OF THE SEVEN CONDITIONS REFUSES. Both trailer operands are
 * counterparty-controlled content parsed from the file's last row, so a supplier
 * typing `41` on a 40-row file would otherwise discard the OTHER side's admitted
 * rows too — a one-cell kill switch on the whole close, handed to the party being
 * reconciled against. `controlTotalDisagreesIsAPostcondition` is that decision as
 * a fixture: the residue survives a wrong trailer cell. Only
 * `expected_but_absent` refuses, because a truncated file has no sound ledger to
 * report beside.
 *
 * ⚠️ READ THE TRAILER ROW AS A FACT, NEVER AS A TRANSACTION.
 * `SourceDocument.controlTotal` is a FIELD; nothing in `presentedRows` can reach
 * it, so no admission path can spend it as a phantom receipt.
 * `trailerShreddedAsATransactionIsCaughtTwice` is the fixture for a parser that
 * put it in `lines` anyway — and the count and the total catch it INDEPENDENTLY,
 * which is why one comparison is not redundant with the other.
 * ====================================================================== */

const c18Row7001 = ledgerFields(id('INV-7001'), amt(300_00n), dte('2026-03-03'), id('CP-ORION'))
const c18Row7002 = ledgerFields(id('INV-7002'), amt(200_00n), dte('2026-03-04'), id('CP-ORION'))
/** The trailer row, shredded into `lines` by a parser that read it as a row. */
const c18ShreddedTrailerRow = ledgerFields(
  id('TOTAL'),
  amt(500_00n),
  dte('2026-03-04'),
  id('CP-ORION'),
)
/** The same address as `c18Row7002`, with prose where the amount belongs. */
const c18UnreadableRow7002 = ledgerFields(
  id('INV-7002'),
  txt('see remittance advice'),
  dte('2026-03-04'),
  id('CP-ORION'),
)

const c18Payment = bankHeaderDoc(
  'srcdoc_SYN_pay_7001',
  'orion-credit-7001.pdf',
  bankFields(
    id('INV-7001'),
    amt(300_00n),
    dte('2026-03-06'),
    id('CP-ORION'),
    txt('PAYNOW CREDIT ORION FREIGHT INV-7001'),
  ),
)
const c18PaymentAt = at('PayNow credit for INV-7001', 'right', 'srcdoc_SYN_pay_7001', null)

/* ⚠️ THE FOURTH C18 DOCUMENT, AND IT IS NOT ITS OWN SCENARIO. It restates F6 —
 * the re-delivered bank advice — WITH a declared trailer, so that C17's early
 * return inside `checkPopulationIntegrity` is witnessed rather than masked.
 * Without the trailer there was nothing for C18 to disagree about, so the early
 * return asserted nothing. With it, a doubled document would otherwise produce a
 * doubled sum against the declared 125.00 as well; the direct-call vector in
 * `tests/scenarios/export-surface.test.ts` is what asserts that it does not. */
const c18RedeliveredAdvice = bankHeaderDocWithTrailer(
  'srcdoc_SYN_pay_1001_trailer',
  'advice-1001-with-trailer.pdf',
  bankFields(
    id('INV-1001'),
    amt(125_00n),
    dte('2026-03-05'),
    id('CP-BEACON'),
    txt('PAYNOW CREDIT BEACON FOODS INV-1001'),
  ),
  trailer(1, mny(125_00n)),
)


/**
 * The left population DECLARES that its format carries a trailer; the right one
 * declares that it does not, and the right document agrees by carrying
 * `not_declared_by_format`. Both halves matter: without the left declaration a
 * shredder that stopped reading trailers would look identical to a format that
 * has none.
 */
function c18Spec(runId: string, leftDocuments: SourceDocument[]): RunSpec {
  return {
    runId,
    left: ledgerBinding({
      identifiers: [PATHS.reference],
      counterparty: null,
      carriesControlTotal: 'always',
    }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments,
    rightDocuments: [c18Payment],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }
}

const C18_EVIDENCE: PairingEvidence = { kind: 'exact_identifier', on: PATHS.reference }

/* ---- F7 — the truncated file, caught by the COUNT ALONE ---------------- */

const F7_DOC = 'srcdoc_SYN_ar_7100_truncated'
const f7Doc = ledgerDocWithTrailer(
  F7_DOC,
  'ORION-AR-2026-03-truncated.csv',
  [line(0, c18Row7001), line(1, c18Row7002)],
  /* The file says three rows. Two arrived. The trailer declares no total, so
   * this scenario depends on the COUNT comparison and nothing else — which is
   * what makes it the witness that the two comparisons are independent. */
  trailer(3, null),
)
const f7Inv7001 = at('INV-7001 (Orion Freight)', 'left', F7_DOC, 0)
const f7Inv7002 = at('INV-7002 (Orion Freight)', 'left', F7_DOC, 1)

export const truncatedShredIsCaughtByTheTrailer: Scenario = {
  name: 'truncatedShredIsCaughtByTheTrailer',
  topology: '13 — C18: a file that arrived one row short, which no internal check can see',
  story: 'The AR export was cut off mid-write. Two rows landed; the trailer says three.',
  input: runInput(c18Spec('run_SYN_0121', [f7Doc])),
  expect: {
    summary:
      'The run is SOUND as a ledger and reports one population defect: the file declared three rows and presented two. The residue survives and names the reason on the row.',
    derivedFrom: [
      'C18 — `presentedRowCount` returns `lines.length` (2) for a document with lines; the trailer declared 3, so `declared_line_count_disagrees` carries declaredCount 3 and documentRowCount 2',
      'POPULATION_DEFECT_DISPOSITION — `declared_line_count_disagrees` is `report`, so the outcome stays `ok: true` and the allocation and residue are produced',
      'runSetReconciliation residue cause — C18 is tested FIRST, so an open row out of an unverified document reads `control_total_unverified` rather than `no_strategy_paired`',
      'passIdentifierJoin — INV-7001 is 1×1 with the payment at exactly 30000 minor units, so `exact_identifier` evidence and a full pour',
    ],
    allocations: [
      {
        from: c18PaymentAt,
        to: f7Inv7001,
        amountMinor: 300_00n,
        evidence: C18_EVIDENCE,
        why: 'The truncation says nothing about the rows that DID arrive; INV-7001 still matches its payment exactly.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: f7Inv7002,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 200_00n },
        cause: { kind: 'control_total_unverified' },
        disposition: 'unidentified',
        why: 'Open, and the reason an operator needs first is that the file is short — chasing a counterparty for this row would be chasing the wrong thing.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'declared_line_count_disagrees',
          sourceDocumentId: F7_DOC as SourceDocumentId,
          declaredCount: 3,
          documentRowCount: 2,
        },
      },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---- F8 — the trailer spent as a transaction, caught TWICE ------------- */

const F8_DOC = 'srcdoc_SYN_ar_7200_shredded'
const f8Doc = ledgerDocWithTrailer(
  F8_DOC,
  'ORION-AR-2026-03-shredded.csv',
  [line(0, c18Row7001), line(1, c18Row7002), line(2, c18ShreddedTrailerRow)],
  trailer(2, mny(500_00n)),
)
const f8Inv7001 = at('INV-7001 (Orion Freight)', 'left', F8_DOC, 0)
const f8Inv7002 = at('INV-7002 (Orion Freight)', 'left', F8_DOC, 1)
const f8PhantomTotal = at('the trailer row, admitted as a transaction', 'left', F8_DOC, 2)

export const trailerShreddedAsATransactionIsCaughtTwice: Scenario = {
  name: 'trailerShreddedAsATransactionIsCaughtTwice',
  topology: '13 — C18: the single most valuable line in the file, spent as a phantom receipt',
  story: 'The CSV parser read the trailer row as a third invoice. The close now carries a 500.00 receivable that does not exist.',
  input: runInput(c18Spec('run_SYN_0122', [f8Doc])),
  expect: {
    summary:
      'Two population defects, in order: the count is one too many AND the sum is double the declared total. Two independent detectors on one defect.',
    derivedFrom: [
      'C18 — the presented row count is 3 against a declared 2, because the shredded trailer is a line like any other once a parser has put it there',
      'C18 — the admitted sum is 30000 + 20000 + 50000 = 100000 against a declared 50000: the trailer is counted once as itself and once as a row, which is exactly double',
      'The two comparisons are INDEPENDENT — delete the count check and this scenario still reports the total defect, which is the argument for carrying both',
      'checkPopulationIntegrity emits per document in supplied order, count before total, and runSetReconciliation preserves that order into `postconditions`',
    ],
    allocations: [
      {
        from: c18PaymentAt,
        to: f8Inv7001,
        amountMinor: 300_00n,
        evidence: C18_EVIDENCE,
        why: 'The phantom row does not disturb the pairing: `TOTAL` is a reference no bank row carries.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: f8Inv7002,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 200_00n },
        cause: { kind: 'control_total_unverified' },
        disposition: 'unidentified',
        why: 'A real open invoice, flagged because the file it came from does not reconcile against itself.',
      },
      {
        item: f8PhantomTotal,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 500_00n },
        cause: { kind: 'control_total_unverified' },
        disposition: 'unidentified',
        why: 'THE PHANTOM. Without C18 this sits in a March close as an unexplained 500.00 receivable and an operator hunts a payment for it forever.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'declared_line_count_disagrees',
          sourceDocumentId: F8_DOC as SourceDocumentId,
          declaredCount: 2,
          documentRowCount: 3,
        },
      },
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'declared_control_total_disagrees',
          sourceDocumentId: F8_DOC as SourceDocumentId,
          declaredMinor: 500_00n,
          declaredExponent: 2,
          admittedMinor: 1000_00n,
          admittedExponent: 2,
        },
      },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---- F9 — a wrong trailer cell does NOT delete the residue ------------- */

const F9_DOC = 'srcdoc_SYN_ar_7300_offbyacent'
const f9Doc = ledgerDocWithTrailer(
  F9_DOC,
  'ORION-AR-2026-03-offbyacent.csv',
  [line(0, c18Row7001), line(1, c18Row7002)],
  trailer(2, mny(500_01n)),
)
const f9Inv7001 = at('INV-7001 (Orion Freight)', 'left', F9_DOC, 0)
const f9Inv7002 = at('INV-7002 (Orion Freight)', 'left', F9_DOC, 1)

export const controlTotalDisagreesIsAPostcondition: Scenario = {
  name: 'controlTotalDisagreesIsAPostcondition',
  topology: '13 — C18: THE DECISION, as a fixture. A comparison failure reports; it does not refuse',
  story: 'The supplier’s trailer says 500.01 for a file whose two rows sum to 500.00. One wrong cell.',
  input: runInput(c18Spec('run_SYN_0123', [f9Doc])),
  expect: {
    summary:
      'ok: true. The allocation stands, the residue stands, and the disagreement is reported beside them — never instead of them.',
    derivedFrom: [
      'POPULATION_DEFECT_DISPOSITION — every C18 comparison arm is `report`. Both trailer operands are counterparty-controlled, so refusing here would hand a supplier a one-cell kill switch on the whole close, including the OTHER side’s admitted rows',
      'SetReconciliationOutcome — the `ok: false` arm carries no residue, no refusedAtAdmission, no ambiguities and no reader requests, in the module whose §6 banner is "RESIDUE — the product"',
      'C18 — the count agrees (2 = 2) so exactly one defect is emitted, which is what makes this fixture about the DECISION rather than about the arithmetic',
    ],
    allocations: [
      {
        from: c18PaymentAt,
        to: f9Inv7001,
        amountMinor: 300_00n,
        evidence: C18_EVIDENCE,
        why: 'A cent wrong in a trailer says nothing about whether this payment settles this invoice.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: f9Inv7002,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 200_00n },
        cause: { kind: 'control_total_unverified' },
        disposition: 'unidentified',
        why: 'THE ROW THE REFUSAL DESIGN WOULD HAVE DELETED. It is the product; it survives a wrong cell in somebody else’s file.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'declared_control_total_disagrees',
          sourceDocumentId: F9_DOC as SourceDocumentId,
          declaredMinor: 500_01n,
          declaredExponent: 2,
          admittedMinor: 500_00n,
          admittedExponent: 2,
        },
      },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---- F11 — a refused row makes the total UNVERIFIABLE, not wrong ------- */

const F11_DOC = 'srcdoc_SYN_ar_7400_unreadable'
const f11Doc = ledgerDocWithTrailer(
  F11_DOC,
  'ORION-AR-2026-03-unreadable.csv',
  [line(0, c18Row7001), line(1, c18UnreadableRow7002)],
  trailer(2, mny(500_00n)),
)
const f11Inv7001 = at('INV-7001 (Orion Freight)', 'left', F11_DOC, 0)
const f11Unreadable = at('the row whose amount is prose', 'left', F11_DOC, 1)

export const controlTotalUnverifiableWhenARowRefused: Scenario = {
  name: 'controlTotalUnverifiableWhenARowRefused',
  topology: '13 — C18: the arm that keeps the total check honest',
  story: 'Two rows arrived, as declared. One of them has "see remittance advice" where the amount belongs.',
  input: runInput(c18Spec('run_SYN_0124', [f11Doc])),
  expect: {
    summary:
      'The COUNT still agrees, because both rows were presented. The TOTAL is reported unverifiable rather than compared against a sum that is missing a row.',
    derivedFrom: [
      'C18 — the count is taken over rows PRESENTED (2), not rows admitted (1). A truncated file and an unreadable row are different defects and keying one check on both is §5.1',
      'C18 — `control_total_unverifiable_rows_refused` fires because a refused row has no readable amount, so the admitted sum (30000) is NOT this file’s total and comparing it against 50000 would report a 200.00 shortfall that is really one unreadable cell',
      'admitOne — a `text` scalar at the amount path is `amount_not_money` with found `text`; the row lands in the residue with `settlement: null` and disposition `error_left`',
    ],
    allocations: [
      {
        from: c18PaymentAt,
        to: f11Inv7001,
        amountMinor: 300_00n,
        evidence: C18_EVIDENCE,
        why: 'The readable row is unaffected by its neighbour.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: f11Unreadable, path: PATHS.ledgerAmount, refusal: AMOUNT_IS_PROSE },
    ],
    residue: [
      {
        item: f11Unreadable,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_left',
        why: 'Refused at admission, so it has no amount and therefore no settlement. Its own cause is the specific one; `control_total_unverified` would be less useful here, not more.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'control_total_unverifiable_rows_refused',
          sourceDocumentId: F11_DOC as SourceDocumentId,
          documentRowCount: 2,
          admittedCount: 1,
        },
      },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---- F12 — a trailer at another scale is NOT a mismatch ---------------- */

const F12_DOC = 'srcdoc_SYN_ar_7500_scaled'
const f12Doc = ledgerDocWithTrailer(
  F12_DOC,
  'ORION-AR-2026-03-scaled.csv',
  [line(0, c18Row7001), line(1, c18Row7002)],
  /* SGD 500 written at exponent 0 — the SAME money the rows sum to, at a scale
   * the population did not declare. C16 is what makes this distinguishable. */
  trailer(2, { currency: 'SGD', amountMinor: 500n, exponent: 0 }),
)
const f12Inv7001 = at('INV-7001 (Orion Freight)', 'left', F12_DOC, 0)
const f12Inv7002 = at('INV-7002 (Orion Freight)', 'left', F12_DOC, 1)

export const trailerInAnotherCurrencyIsNotAMismatch: Scenario = {
  name: 'trailerInAnotherCurrencyIsNotAMismatch',
  topology: '13 — C18: a named refusal, never a wrong verdict',
  story: 'The trailer is written in whole dollars where every row is in cents. The two numbers were never comparable.',
  input: runInput(c18Spec('run_SYN_0125', [f12Doc])),
  expect: {
    summary:
      'Reported as `control_total_not_evaluable` carrying `exponent_mismatch`, not as a hundredfold disagreement.',
    derivedFrom: [
      'compareMoney calls sameUnit FIRST, which compares currency AND exponent — the widening C16 made for exactly this class of comparison',
      'C18 — `control_total_not_evaluable` carries the reasoned MoneyRefusal rather than one flat kind (§5.2): "wrong scale" and "wrong total" are different operator errors with different fixes',
      'Drop the unit check and this fixture reports 500 against 50000 — a hundredfold error that is really a mapping error, which is the mutation that proves the arm bites',
    ],
    allocations: [
      {
        from: c18PaymentAt,
        to: f12Inv7001,
        amountMinor: 300_00n,
        evidence: C18_EVIDENCE,
        why: 'The ROWS are all denominated as the population declared; only the trailer is not.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: f12Inv7002,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 200_00n },
        cause: { kind: 'control_total_unverified' },
        disposition: 'unidentified',
        why: 'The file’s self-check could not be performed, which is a weaker statement than "the file is wrong" and is reported as one.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'control_total_not_evaluable',
          sourceDocumentId: F12_DOC as SourceDocumentId,
          refusal: { kind: 'exponent_mismatch' },
        },
      },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---- F12b — header AND lines: the known hole, witnessed ---------------- */

const F12B_DOC = 'srcdoc_SYN_ar_7600_headerandlines'
const f12bDoc = ledgerDocWithHeaderAndLines(
  F12B_DOC,
  'ORION-AR-2026-03-headerandlines.csv',
  /* A header transaction that NOTHING presents. It is not admitted, it is not
   * counted, and the trailer below passes anyway. */
  ledgerFields(id('INV-7010'), amt(999_00n), dte('2026-03-02'), id('CP-ORION')),
  [line(0, c18Row7001), line(1, c18Row7002)],
  trailer(2, mny(500_00n)),
)
const f12bInv7001 = at('INV-7001 (Orion Freight)', 'left', F12B_DOC, 0)
const f12bInv7002 = at('INV-7002 (Orion Freight)', 'left', F12B_DOC, 1)

export const headerAndLinesTogetherIsCounted: Scenario = {
  name: 'headerAndLinesTogetherIsCounted',
  topology: '13 — C18: the shape this corpus never reached, and the hole it exposes',
  story: 'One document carries header fields AND lines. The header invoice is presented by nobody.',
  input: runInput(c18Spec('run_SYN_0126', [f12bDoc])),
  expect: {
    summary:
      'ZERO defects — and that is the finding, not the reassurance. `presentedRowCount` mirrors admission exactly, so the trailer agrees while a 999.00 header transaction is silently absent from the close.',
    derivedFrom: [
      'admitPopulation branches on `lines.length === 0`, so a document carrying BOTH presents its lines only. `presentedRows` is that same branch and both callers share it — one rule, never two',
      'C18 therefore counts 2 against a declared 2 and sums 50000 against a declared 50000: no defect. The header row is invisible to admission AND to the control, which is the hole this fixture pins',
      'Making C18 count the header instead would report a defect against the ENGINE rather than against the file, which is why the shared counter is the right shape and the hole is documented rather than papered over',
    ],
    allocations: [
      {
        from: c18PaymentAt,
        to: f12bInv7001,
        amountMinor: 300_00n,
        evidence: C18_EVIDENCE,
        why: 'Line-grain admission is unchanged by the presence of header fields.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: f12bInv7002,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 200_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'NO defect on this document, so the cause is the ordinary one — which is also the negative control for `control_total_unverified` appearing in the five scenarios above.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---- F13 — a trailer that declared NOTHING ----------------------------- */

const F13_DOC = 'srcdoc_SYN_ar_7800_emptytrailer'
const f13Doc = ledgerDocWithTrailer(
  F13_DOC,
  'ORION-AR-2026-03-emptytrailer.csv',
  [line(0, c18Row7001), line(1, c18Row7002)],
  trailer(null, null),
)
const f13Inv7001 = at('INV-7001 (Orion Freight)', 'left', F13_DOC, 0)
const f13Inv7002 = at('INV-7002 (Orion Freight)', 'left', F13_DOC, 1)

export const trailerDeclaringNeitherIsADefect: Scenario = {
  name: 'trailerDeclaringNeitherIsADefect',
  topology: '13 — C18: the degenerate trailer, which must not read as a silent pass',
  story: 'The parser found the trailer row and could read neither number off it.',
  input: runInput(c18Spec('run_SYN_0128', [f13Doc])),
  expect: {
    summary:
      'One defect. A `declared` arm carrying two nulls asserts that a trailer was FOUND while checking nothing, which is the one state that would make the arm meaningless.',
    derivedFrom: [
      'C18 — inside the `declared` arm a null means "the trailer declared this one and not that one"; BOTH null is a parser that found a row it could not read, and admitting it silently would make the arm a no-op that reports health',
      'It is a `report` disposition like every other comparison arm: nothing about it says the file is short, so nothing about it justifies deleting a residue',
    ],
    allocations: [
      {
        from: c18PaymentAt,
        to: f13Inv7001,
        amountMinor: 300_00n,
        evidence: C18_EVIDENCE,
        why: 'An unreadable trailer says nothing about the rows.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: f13Inv7002,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 200_00n },
        cause: { kind: 'control_total_unverified' },
        disposition: 'unidentified',
        why: 'The file’s self-check could not be performed at all, which is exactly what this cause says.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'control_total_declared_nothing',
          sourceDocumentId: F13_DOC as SourceDocumentId,
        },
      },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---- F14 — THE PARSER TRYING TO SWITCH THE CONTROL OFF ----------------- */

const F14_DOC = 'srcdoc_SYN_ar_7900_parsersaysnone'
/* `ledgerDoc` supplies `NO_TRAILER` — `not_declared_by_format`. The TYPE says
 * this format always carries one. Exactly what a shredder refactored to stop
 * reading trailers produces, for every file, on a green gate. */
const f14Doc = ledgerDoc(F14_DOC, 'ORION-AR-2026-03-parsersaysnone.csv', [
  line(0, c18Row7001),
  line(1, c18Row7002),
])
const f14Inv7001 = at('INV-7001 (Orion Freight)', 'left', F14_DOC, 0)
const f14Inv7002 = at('INV-7002 (Orion Freight)', 'left', F14_DOC, 1)

export const parserArmDisagreesWithTheDocumentType: Scenario = {
  name: 'parserArmDisagreesWithTheDocumentType',
  topology: '13 — C18: the difference between a control and a control the checked component can turn off',
  story: 'The extractor stopped emitting trailers. Every file now reports "this format has none", and nothing else changed.',
  input: runInput(c18Spec('run_SYN_0129', [f14Doc])),
  expect: {
    summary:
      'One defect, and it is the whole reason `carriesControlTotal` exists on the TYPE. Delete the cross-check and this scenario passes silently — which is C18 switched off for every production file.',
    derivedFrom: [
      'C18 — `SourceDocument.controlTotal` records what the PARSER found; `PopulationBinding.carriesControlTotal` (→ `DocumentType.carriesControlTotal` under DP-2) records what the FORMAT is supposed to carry. A parser reporting `not_declared_by_format` for a type declared `always` is itself a defect',
      'Without this arm the parser is the only voice, and the corpus above would be exercising the disabled path almost exclusively while reporting health — §5.1, a rule keyed on a convenient landmark rather than on the property it protects',
    ],
    allocations: [
      {
        from: c18PaymentAt,
        to: f14Inv7001,
        amountMinor: 300_00n,
        evidence: C18_EVIDENCE,
        why: 'Matching is untouched; what is missing is the file’s self-check.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: f14Inv7002,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 200_00n },
        cause: { kind: 'control_total_unverified' },
        disposition: 'unidentified',
        why: 'No trailer was checked against this row’s file, and the row says so.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [
      {
        kind: 'population_integrity_reported',
        side: 'left',
        defect: {
          kind: 'control_total_arm_disagrees_with_document_type',
          sourceDocumentId: F14_DOC as SourceDocumentId,
        },
      },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §N3  C13 — THE CONFORMANCE FLOOR
 *
 * 🛑 WHAT WAS WRONG BEFORE IT. `admitPopulation` accumulates per-row refusals
 * and CARRIES ON, so a run in which most rows refused returned `ok: true` with a
 * ledger that is internally perfect over the minority that parsed. Every
 * `PostconditionFailure` arm is a count or a comparison WITHIN the admitted set,
 * so nothing could see it, and nothing reported the rate.
 *
 * TWO HALVES, AND THE SPLIT IS THE RULING:
 *
 *   · a CONFIGURABLE ceiling on the refusal rate, which REFUSES the run — and
 *     the upper bound is EXCLUSIVE, because at 10000 the comparison reduces to
 *     `admitted < 0` and the control is off. A caller-supplied parameter that
 *     switches a check off is §5.2, refused once already at G79;
 *   · the observed rate as an UNCONDITIONAL RECORD on the result, which needs no
 *     number from anybody. That is what makes the remediation *read the rate*
 *     rather than *raise the ceiling*, and the second sentence is refused
 *     outright: a permissive ceiling may suppress the REFUSAL and may never
 *     suppress the EVIDENCE.
 *
 * ⚠️ EXACT INTEGER ARITHMETIC, NEVER A DIVISION. `refused × 10000 > ceiling ×
 * sideRowCount`, strictly `>`, so a rate AT the stated ceiling is admitted. The
 * three fixtures below sit at 5000 basis points and move only the ceiling: 2500
 * refuses, 5000 admits, 10000 is illegal at the gate.
 * ---------------------------------------------------------------------- */

const c13PartialLedger = ledgerDoc('srcdoc_SYN_ar_9200_partial', 'TERN-AR-2026-03.csv', [
  line(0, ledgerFields(id('INV-9201'), amt(400_00n), dte('2026-03-04'), id('CP-TERN'))),
  line(1, ledgerFields(id('INV-9202'), amt(600_00n), dte('2026-03-04'), id('CP-TERN'))),
  /* Two rows the mapper left as prose. Exactly half the file. */
  line(2, ledgerFields(id('INV-9203'), txt('see remittance'), dte('2026-03-04'), id('CP-TERN'))),
  line(3, ledgerFields(id('INV-9204'), txt('see remittance'), dte('2026-03-04'), id('CP-TERN'))),
])
const c13Statement = bankDoc('srcdoc_SYN_stmt_9200', 'statement-2026-03-tern.csv', [
  line(0, bankFields(id('INV-9201'), amt(400_00n), dte('2026-03-07'), id('CP-TERN'), txt('GIRO INV-9201'))),
  line(1, bankFields(id('INV-9202'), amt(600_00n), dte('2026-03-07'), id('CP-TERN'), txt('GIRO INV-9202'))),
])

const c13Invoice1 = at('INV-9201 · 400.00', 'left', 'srcdoc_SYN_ar_9200_partial', 0)
const c13Invoice2 = at('INV-9202 · 600.00', 'left', 'srcdoc_SYN_ar_9200_partial', 1)
const c13Unreadable1 = at('INV-9203 · amount as prose', 'left', 'srcdoc_SYN_ar_9200_partial', 2)
const c13Unreadable2 = at('INV-9204 · amount as prose', 'left', 'srcdoc_SYN_ar_9200_partial', 3)
const c13Credit1 = at('GIRO INV-9201', 'right', 'srcdoc_SYN_stmt_9200', 0)
const c13Credit2 = at('GIRO INV-9202', 'right', 'srcdoc_SYN_stmt_9200', 1)

function c13Spec(runId: string, ceilingBasisPoints: number): RunSpec {
  return {
    runId,
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [c13PartialLedger],
    rightDocuments: [c13Statement],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    admissionRefusalCeilingBasisPoints: ceilingBasisPoints,
  }
}

/**
 * THE `>` BOUNDARY, ADMITTED. Half the ledger is unreadable and the operator's
 * stated ceiling is exactly half, so the run proceeds — and the two rows that
 * parsed produce a ledger that is genuinely sound over them.
 *
 * 🛑 THIS SCENARIO AND `refusalRateAboveTheStatedCeilingRefuses` DIFFER IN ONE
 * NUMBER AND NOTHING ELSE. Same documents, same bindings, same strategy. That is
 * deliberate: the pair is the only witness that the comparison is `>` and not
 * `>=`, and an off-by-one on this threshold decides whether a close runs.
 */
export const refusalRateAtTheCeilingIsAdmitted: Scenario = {
  name: 'refusalRateAtTheCeilingIsAdmitted',
  topology: 'extra — C13: the refusal rate is exactly the stated ceiling',
  story: 'Half a ledger export arrives with prose where the amount belongs. The controller has stated that half is the most they will close on.',
  input: runInput(c13Spec('run_SYN_0022', 5000)),
  expect: {
    summary:
      'Two of four left rows refuse, which is 5000 basis points against a ceiling of 5000 — and the comparison is strictly `>`, so the rate AT the ceiling is admitted. Both readable invoices settle in full, the two unreadable rows are in the residue with their reason, and the ledger is SOUND over what was admitted.',
    derivedFrom: [
      'C13 — `refused × 10000 > ceiling × sideRowCount` is 2 × 10000 = 20000 against 5000 × 4 = 20000. Not greater, so no defect. Cross-multiplied rather than divided: this module never divides, and 2/4 is exact only by accident of the fixture.',
      '`sideRowCount` is folded from `presentedRowCount` over the DOCUMENTS, not from `admitted.length + refused.length` — so the denominator is what the file presented, independently of what the admission fold did with it.',
      'admitOne refuses a non-money amount scalar as `amount_not_money` carrying the scalar KIND it found; it never carries the prose itself, which is counterparty-controlled text.',
      'passIdentifierJoin allocates from the RIGHT population into the LEFT on an exact key with zero variance, and a zero variance selects `exact_identifier` over `tolerant_identifier`.',
      'A fully allocated item is not in the residue at all — `checkPostconditions` reports `fully_allocated_item_in_residue` if it ever is — so only the two admission refusals appear, in admission order.',
      'C13 — the LEFT side admitted two rows, so `population_wholly_refused` does NOT fire; it requires an admitted count of zero.',
    ],
    allocations: [
      {
        from: c13Credit1,
        to: c13Invoice1,
        amountMinor: 400_00n,
        evidence: { kind: 'exact_identifier', on: PATHS.reference },
        why: 'The reference matches exactly and the amounts are equal, so the whole credit pours into the invoice.',
      },
      {
        from: c13Credit2,
        to: c13Invoice2,
        amountMinor: 600_00n,
        evidence: { kind: 'exact_identifier', on: PATHS.reference },
        why: 'The same, on the second readable pair.',
      },
    ],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: c13Unreadable1, path: PATHS.ledgerAmount, refusal: AMOUNT_IS_PROSE },
      { item: c13Unreadable2, path: PATHS.ledgerAmount, refusal: AMOUNT_IS_PROSE },
    ],
    residue: [
      {
        item: c13Unreadable1,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_left',
        why: 'Refused rows lead the residue, in admission order.',
      },
      {
        item: c13Unreadable2,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_left',
        why: 'The second one. Neither is summarised away into a count.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

/* ---------------------------------------------------------------------- *
 * C13's NON-CONFIGURABLE HALF — a run where NOTHING was admitted
 * ---------------------------------------------------------------------- */

const c13DeadLedger = ledgerDoc('srcdoc_SYN_ar_9300_dead', 'TERN-AR-2026-03-b.csv', [
  line(0, ledgerFields(id('INV-9301'), txt('see remittance'), dte('2026-03-04'), id('CP-TERN'))),
  line(1, ledgerFields(id('INV-9302'), txt('see remittance'), dte('2026-03-04'), id('CP-TERN'))),
])
const c13DeadStatement = bankDoc('srcdoc_SYN_stmt_9300', 'statement-2026-03-tern-b.csv', [
  line(0, bankFields(id('INV-9301'), txt('CR'), dte('2026-03-07'), id('CP-TERN'), txt('GIRO INV-9301'))),
  line(1, bankFields(id('INV-9302'), txt('CR'), dte('2026-03-07'), id('CP-TERN'), txt('GIRO INV-9302'))),
])

const c13DeadLeft1 = at('INV-9301 · amount as prose', 'left', 'srcdoc_SYN_ar_9300_dead', 0)
const c13DeadLeft2 = at('INV-9302 · amount as prose', 'left', 'srcdoc_SYN_ar_9300_dead', 1)
const c13DeadRight1 = at('GIRO INV-9301 · amount as prose', 'right', 'srcdoc_SYN_stmt_9300', 0)
const c13DeadRight2 = at('GIRO INV-9302 · amount as prose', 'right', 'srcdoc_SYN_stmt_9300', 1)

/**
 * 🛑 THE FIXTURE THAT PROTECTS A DECISION RATHER THAN A MECHANISM.
 *
 * Every row on both sides refuses — a rate of 10000 basis points, which exceeds
 * every LEGAL ceiling. The run nevertheless returns `ok: true`, because the rate
 * arm requires at least one ADMITTED row: refusing here would delete the residue,
 * and the residue with one entry per row and the reason on each IS the output.
 *
 * If a later reader "hardens" C13 into a refusal, this is the scenario that goes
 * red, and it is meant to.
 */
export const wholeRunRefusedStillProducesTheResidue: Scenario = {
  name: 'wholeRunRefusedStillProducesTheResidue',
  topology: 'extra — C13: nothing was admitted on either side, and the residue survives',
  story: 'A mapping change ships with the amount column bound to the wrong field. Nothing in the file parses.',
  input: runInput({
    ...c13Spec('run_SYN_0023', 2500),
    leftDocuments: [c13DeadLedger],
    rightDocuments: [c13DeadStatement],
  }),
  expect: {
    summary:
      'Four rows presented, four refused, nothing admitted, and the run still produces a residue naming every row and its reason. Both sides report `population_wholly_refused` — the ledger is consistent OVER NOTHING, which is a different statement from SOUND and now has its own arm.',
    derivedFrom: [
      'C13 — `population_wholly_refused` fires per side where `presented > 0` and `admitted === 0`. Both sides present two rows and admit none, so both arms fire, LEFT before RIGHT because `admissionRates` is built in that order.',
      'C13 — `admission_refusal_rate_above_ceiling` does NOT fire despite a ceiling of 2500 and a rate of 10000, because it requires at least one admitted row. That narrowing is the whole reason this scenario can exist: without it a wholly-refused population would always refuse the run, since the upper bound on the ceiling is exclusive.',
      'The post-condition is emitted by `checkPostconditions` and not by `checkPopulationIntegrity`, so it appears AFTER any `population_integrity_reported` entry and before the ledger-consistency findings — of which there are none, the admitted set being empty.',
      'admitOne refuses on the AMOUNT before it reads the date or the identifiers, so every refusal names the amount path even though the other columns are readable.',
      'The residue order is every admission refusal, left population first, each in admission order; there are no admitted items to follow them.',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: [
      { item: c13DeadLeft1, path: PATHS.ledgerAmount, refusal: AMOUNT_IS_PROSE },
      { item: c13DeadLeft2, path: PATHS.ledgerAmount, refusal: AMOUNT_IS_PROSE },
      { item: c13DeadRight1, path: PATHS.bankAmount, refusal: AMOUNT_IS_PROSE },
      { item: c13DeadRight2, path: PATHS.bankAmount, refusal: AMOUNT_IS_PROSE },
    ],
    residue: [
      {
        item: c13DeadLeft1,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_left',
        why: 'The row survives the run as a thing an operator can act on, which is the point of not refusing.',
      },
      {
        item: c13DeadLeft2,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_left',
        why: 'And the second. Four rows in, four rows out — nothing is ever dropped.',
      },
      {
        item: c13DeadRight1,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_right',
        why: 'The right population follows the left, in admission order.',
      },
      {
        item: c13DeadRight2,
        settlement: null,
        cause: { kind: 'admission_refused', refusal: AMOUNT_IS_PROSE },
        disposition: 'error_right',
        why: 'The last of them.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    postconditions: [
      { kind: 'population_wholly_refused', side: 'left', sideRowCount: 2 },
      { kind: 'population_wholly_refused', side: 'right', sideRowCount: 2 },
    ],
    meterFacts: ONE_RUN_METERED,
  },
}

/* ====================================================================== *
 * §N2  O-15 — THE DECLARED-EMPTY POPULATION, WHICH IS THE ESCAPE ITSELF
 *
 * 🛑 THIS IS THE FIXTURE THAT PROVES THE TWO ARMS PARTITION RATHER THAN
 * OVERLAP. The left side presents ZERO rows and the run returns `ok: true`,
 * because its binding DECLARED that zero is expected — and `postconditions` is
 * empty, which means `population_wholly_refused` is ABSENT. It has to be: that
 * arm is about rows that were presented and not admitted, and there are none of
 * either here. Fire C13's arm at `presented === 0` and this scenario goes red
 * while `wholeRunRefusedStillProducesTheResidue` stays green, which is exactly
 * the discrimination the two arms exist for.
 *
 * ⚠️ AND IT IS THE ONLY WITNESS THE ESCAPE HAS. Remove `emptyExpectation` from
 * the binding, or ignore it in the gate, and this run refuses —
 * `emptyPopulationRefusesTheRun` is the same input with the declaration left at
 * the posture. The pair is the control: one declaration, two outcomes, and
 * nothing on the CALL decides which.
 * ====================================================================== */

export const emptyPopulationIsAdmittedWhenDeclaredPermitted: Scenario = {
  name: 'emptyPopulationIsAdmittedWhenDeclaredPermitted',
  topology: 'extra — O-15: a source declared capable of presenting nothing, presenting nothing',
  story:
    'A newly onboarded tenant has issued no invoices yet, so the ledger side is genuinely empty. One payment on account arrives anyway.',
  input: runInput({
    runId: 'run_SYN_0024',
    left: ledgerBinding({
      identifiers: [PATHS.reference],
      counterparty: null,
      /* THE DECLARATION, AND THE ONLY LINE THAT SEPARATES THIS RUN FROM
       * `emptyPopulationRefusesTheRun`. It is on the BINDING — the source's
       * own statement about its nature — and not an argument to the engine. */
      emptyExpectation: 'permitted',
    }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [],
    rightDocuments: [s1RightPayment],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }),
  expect: {
    summary:
      'The run proceeds. Nothing pairs, because there is nothing on the left to pair with; the single payment lands in the residue as `no_strategy_paired`, carrying its whole 12500 as residual. `postconditions` is EMPTY — and `population_wholly_refused` is absent from it, which is the assertion this scenario exists to make.',
    derivedFrom: [
      'O-15 (docs/HANDOFF.md G172) — the gate reads `binding.emptyExpectation`, finds `permitted`, and does not refuse. That is a DECLARATION on the source, not a flag on the call: `emptyPopulationRefusesTheRun` is byte-for-byte the same input with the declaration left at the posture, and it refuses.',
      'passIdentifierJoin builds a multimap per side and joins them; the left multimap is empty, so no key has candidates on both sides and no allocation, ambiguity or tolerance refusal is produced.',
      'runSetReconciliation residue loop — the right item is `unallocated`, so its residual is its whole gross (12500). `unverifiedDocuments` is empty, it is in no ambiguity, and `input.left.counterparty` is null so the `counterparty_unattributed` branch cannot be taken. The cause is therefore `no_strategy_paired`, and `dispositionFor` returns `unidentified` for every non-admission cause.',
      'buildReaderRequests iterates residue entries whose side is LEFT and skips every other; the one entry here is on the right, so the reader queue is empty regardless of the bank binding carrying a narrative path.',
      'checkPostconditions — C13 skips the left rate because `presented === 0` and skips the right because `admitted > 0`, so `population_wholly_refused` fires on NEITHER side. `admittedMinor` is 12500 over one item; `accountedMinor` is 0 allocated plus 12500 residue-carried. They agree, so `gross_not_partitioned` cannot fire, and the item is open and present in the residue exactly once.',
      'checkPopulationIntegrity on the left is handed no documents, no admitted and no refused items: C17 finds no address, C13 has no denominator, and the C18 loop has nothing to iterate. It returns [], so nothing is reported beside the ledger.',
    ],
    allocations: [],
    ambiguities: NO_AMBIGUITIES,
    refusedAtAdmission: NO_REFUSED,
    residue: [
      {
        item: s1Payment,
        settlement: { kind: 'unallocated', allocatedMinor: null, residualMinor: 125_00n },
        cause: { kind: 'no_strategy_paired' },
        disposition: 'unidentified',
        why: 'Cash against an empty ledger is unapplied cash, and it is visible as such. A declared-empty side means the run may proceed; it does not mean the payment is explained.',
      },
    ],
    readerRequests: NO_REQUESTS,
    toleranceRefusals: NO_TOLERANCE_REFUSALS,
    searchBoundary: NO_SEARCH_BOUNDARY,
    toleranceDeclines: NO_TOLERANCE_DECLINES,
    /* 🛑 EMPTY, AND THE EMPTINESS IS THE ASSERTION. Not `SOUND` by accident —
     * `population_wholly_refused` must NOT appear here, and this is the only
     * fixture in the corpus that can say so. */
    postconditions: SOUND,
    meterFacts: ONE_RUN_METERED,
  },
}

export const SCENARIOS: readonly Scenario[] = [
  cleanIdentifierMatch,
  noisyIdentifierNormalised,
  noisyIdentifierWithoutNormalisation,
  bankFeeWithinTolerance,
  typoAmountAnchoredFuzzy,
  fuzzyTieIsAnAmbiguity,
  jaroWinklerStubMatchesNothing,
  exactSubsetIsAMatch,
  waterfallWhenNoExactSubset,
  leftoverCashLandsInResidue,
  oversizedBucketIsRefusedNotAttempted,
  unattributedCounterpartyIsANamedBucket,
  duplicateIdentifierIsAnAmbiguity,
  freeTextMultiEntityBuildsAReaderRequest,
  readerCandidateCapWithholdsTheSubject,
  narrativeNotPromptEligibleIsNeverCarried,
  unparseableNarrativeGetsNoRequest,
  twoCurrenciesNeverMatchAcross,
  declaredUnitSurvivesRowOrder,
  mixedExponentIsRefusedAtAdmission,
  badDateAndSameDayTieBreak,
  amountAndDateWithinWindow,
  amountAndDateTwoCandidatesIsAmbiguous,
  unclassifiedFieldFailsClosed,
  refusalRateAtTheCeilingIsAdmitted,
  wholeRunRefusedStillProducesTheResidue,
  bothCopiesRefusedIsStillTheNamedOutcome,
  truncatedShredIsCaughtByTheTrailer,
  trailerShreddedAsATransactionIsCaughtTwice,
  controlTotalDisagreesIsAPostcondition,
  controlTotalUnverifiableWhenARowRefused,
  trailerInAnotherCurrencyIsNotAMismatch,
  headerAndLinesTogetherIsCounted,
  trailerDeclaringNeitherIsADefect,
  parserArmDisagreesWithTheDocumentType,
  emptyPopulationIsAdmittedWhenDeclaredPermitted,
]

/* ====================================================================== *
 * §O  RUN-LEVEL REFUSALS — `{ ok: false }`, and every arm of the union
 *
 * The gates run in a fixed order inside `runSetReconciliation`: the three stated
 * bounds first, then normalisation, then tenancy, then the strategy bindings. A
 * scenario below therefore has to be valid in every earlier gate to reach the
 * one it is testing.
 * ====================================================================== */

export interface RefusalScenario {
  readonly name: string
  readonly story: string
  readonly input: SetReconciliationInput
  readonly expect: SetReconciliationRefusal
  readonly derivedFrom: string
}

function baseRefusalSpec(runId: string): RunSpec {
  return {
    runId,
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null }),
    leftDocuments: [s1LeftInvoice],
    rightDocuments: [s1RightPayment],
    pairing: pairing('one_to_one', EXACT_MONEY, FIVE_DAYS, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  }
}

export const refusesUnstatedReaderCap: RefusalScenario = {
  name: 'refusesUnstatedReaderCap',
  story: 'A run that did not state the containment bound.',
  input: runInput({ ...baseRefusalSpec('run_SYN_0101'), readerCandidateCap: 0 }),
  expect: { kind: 'reader_candidate_cap_not_stated' },
  derivedFrom: 'A bound with no number is not a bound (§5.6); the module refuses rather than inventing a default.',
}

export const refusesUnstatedSimilarityCap: RefusalScenario = {
  name: 'refusesUnstatedSimilarityCap',
  story: 'A run that did not cap the similarity matrix input.',
  input: runInput({ ...baseRefusalSpec('run_SYN_0102'), similarityMaxChars: 0 }),
  expect: { kind: 'similarity_max_chars_not_stated' },
  derivedFrom: 'The matrix is O(n·m) over an attacker-influenced string, so the cap is required, not defaulted.',
}

export const refusesUnstatedSubsetSumBound: RefusalScenario = {
  name: 'refusesUnstatedSubsetSumBound',
  story: 'A run whose subset-sum step budget is zero.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0103'),
    subsetSumBound: { maxMembers: 8, stepBudget: 0, maxBucketSize: 50 },
  }),
  expect: { kind: 'subset_sum_bound_not_stated' },
  derivedFrom:
    'G105 — `maxMembers` bounds TERMINATION, not COST; the step budget is the bound that makes the pass affordable and all three fields are required.',
}

export const refusesInvalidNormalisation: RefusalScenario = {
  name: 'refusesInvalidNormalisation',
  story: 'A normalisation with an empty separator, a negative index and no input cap.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0104'),
    left: ledgerBinding({
      identifiers: [PATHS.reference],
      counterparty: null,
      normalisation: {
        ops: [{ kind: 'split_take', separator: '', index: -1 }],
        then: 'exact',
        maxInputChars: 0,
      },
    }),
  }),
  expect: {
    kind: 'normalisation_invalid',
    side: 'left',
    /* Order follows `validateNormalisation`: the input cap first, then each op
     * in declaration order, and within an op the separator before the index. */
    defects: [
      { kind: 'max_input_chars_not_stated' },
      { kind: 'empty_separator', opIndex: 0 },
      { kind: 'negative_index', opIndex: 0 },
    ],
  },
  derivedFrom:
    "model/reconciliation.ts validateNormalisation — `split('')` explodes to characters and an index then addresses a CHARACTER, so the key becomes one letter. Silent corruption, refused up front.",
}

export const refusesCrossTenantDocuments: RefusalScenario = {
  name: 'refusesCrossTenantDocuments',
  story: 'A document from another tenant arrives in the batch.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0105'),
    rightDocuments: [
      doc(
        'srcdoc_SYN_pay_other_tenant',
        DOC_TYPE_BANK,
        'advice-foreign.pdf',
        bankFields(id('INV-1001'), amt(125_00n), dte('2026-03-05'), id('CP-BEACON'), txt('PAYNOW CREDIT')),
        [],
        OTHER_TENANT,
      ),
    ],
  }),
  expect: { kind: 'cross_tenant_documents' },
  derivedFrom:
    'Invariant 1 — the tenant is carried here FOR REFUSAL, never for scope. This check is explicitly the weaker of two lines; the real enforcement is G100 deny-on-NULL RLS plus G101. A test here must not be described as testing tenant isolation.',
}

export const refusesStrategyBindingCountMismatch: RefusalScenario = {
  name: 'refusesStrategyBindingCountMismatch',
  story: 'The spec declares one strategy and the caller supplies none.',
  input: runInput({ ...baseRefusalSpec('run_SYN_0106'), strategyBindings: [] }),
  expect: { kind: 'strategy_binding_count_mismatch', expected: 1, supplied: 0 },
  derivedFrom: 'StrategyBinding binds 1:1 to `pairing.strategies`, in order. A mismatch is a refusal, never a truncation.',
}

export const refusesStrategyBindingKindMismatch: RefusalScenario = {
  name: 'refusesStrategyBindingKindMismatch',
  story: 'The binding at index 0 is a different strategy kind from the one the spec declares.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0107'),
    strategyBindings: [bound({ kind: 'amount_and_date' })],
  }),
  expect: { kind: 'strategy_binding_kind_mismatch', index: 0 },
  derivedFrom: 'The passes ARE `PairingSpec.strategies` in declared order; a binding that disagrees would silently run a different pass.',
}

/* ---------------------------------------------------------------------- *
 * C16 — THE THREE RUN-LEVEL DENOMINATION REFUSALS
 *
 * 🛑 EACH OF THE THREE IS THE ONLY WITNESS ITS COMPARISON HAS. Delete the
 * cross-side comparison and only `refusesDeclaredUnitsDisagreeAcrossSides` goes
 * red; delete the per-strategy tolerance comparison and only
 * `refusesStrategyToleranceInAnotherUnit` does. A control whose mutation turns
 * nothing red is not a control.
 * ---------------------------------------------------------------------- */

export const refusesUnstatedDeclaredUnit: RefusalScenario = {
  name: 'refusesUnstatedDeclaredUnit',
  story: 'A population configured with no currency at all — the empty string.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0108'),
    left: ledgerBinding({
      identifiers: [PATHS.reference],
      counterparty: null,
      declaredUnit: { currency: '', exponent: 2 },
    }),
  }),
  expect: {
    kind: 'declared_unit_invalid',
    side: 'left',
    refusal: { kind: 'currency_not_stated' },
  },
  derivedFrom:
    'C16 — an unstated denomination is a REFUSAL, never a default, and never a nullable field that takes the permissive branch at the first hurried call site (§5.5). `guardUnit` runs per side inside the same loop as `validateNormalisation` and refuses BEFORE it, so the left side is reported before any normalisation defect on the right.',
}

export const refusesDeclaredUnitsDisagreeAcrossSides: RefusalScenario = {
  name: 'refusesDeclaredUnitsDisagreeAcrossSides',
  story: 'A ledger declared in whole dollars against a statement declared in cents.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0109'),
    left: ledgerBinding({
      identifiers: [PATHS.reference],
      counterparty: null,
      declaredUnit: SGD_0,
    }),
  }),
  expect: {
    kind: 'declared_units_disagree',
    refusal: { kind: 'exponent_mismatch' },
  },
  derivedFrom:
    'C16 — the comparison a PER-SIDE declaration cannot make. Both declarations here are individually valid, so `guardUnit` passes on each; without this arm every row on both sides is admitted, nothing allocates, the whole population lands in the residue as `no_strategy_paired` and `postconditions` is EMPTY because conservation over zero allocations is trivially sound. A 100%-unmatched close reported SOUND. The arm carries its `MoneyRefusal` and nothing else, because a cross-side comparison names no tolerance and no strategy binding — the tolerance comparison is `tolerance_unit_disagrees`, a separate kind.',
}

export const refusesStrategyToleranceInAnotherUnit: RefusalScenario = {
  name: 'refusesStrategyToleranceInAnotherUnit',
  story: 'A per-strategy tolerance override denominated in a currency neither side declares.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0110'),
    strategyBindings: [
      bound({ kind: 'exact_identifier', on: PATHS.reference }, {
        kind: 'money',
        value: mny(15_00n, 'USD'),
      }),
    ],
  }),
  expect: {
    kind: 'tolerance_unit_disagrees',
    tolerance: { kind: 'strategy_binding', index: 0 },
    refusal: { kind: 'currency_mismatch' },
  },
  derivedFrom:
    "C16, and the route `pairing.amountTolerance` does not own. `runSetReconciliation` reads `binding.amountTolerance ?? input.pairing.amountTolerance`, so the tolerance that actually reaches `toleranceAdmits` is the OVERRIDE wherever one is set. A gate inspecting only the pairing-level value would close the comparison it names and leave this open — §5.1, a rule keyed on the convenient landmark rather than on the property it protects. The `strategy_binding` arm carries index 0 — rather than the `pairing` arm, which carries no index at all — precisely so the refusal names the binding an operator has to fix. Here `pairing.amountTolerance` is a clean unit-free `rounding`, so the pairing-level check passes and only the override fires.",
}

/* ---------------------------------------------------------------------- *
 * C17 — THE DUPLICATE ADDRESS
 *
 * 🛑 AN ADDRESS COLLISION, NOT A DUPLICATED INVOICE NUMBER, AND THE CORPUS
 * ALREADY CARRIES THE OTHER ONE. `duplicateIdentifierIsAnAmbiguity` keys
 * `INV-3050` at line 0 and line 1 of one document — TWO addresses, two keys, no
 * collision — and it is an `AmbiguityFinding` with all three rows in the
 * residue. Nothing below changes it. `itemKey` is `(side, sourceDocumentId,
 * lineIndex)`, so a collision needs the same document and the same line index:
 * a re-delivered file, or a mapper minting an index from something constant.
 *
 * Each of the three below is the only witness its half of the rule has. F5 and
 * F6 witness that a collision refuses at all — and F6 witnesses it on the RIGHT
 * population, so deleting either iteration of the side loop turns exactly one
 * of them red. F5c witnesses the NARROWING: delete the `admittedAt` check and
 * `bothCopiesRefusedIsStillTheNamedOutcome` goes red; narrow it to require BOTH
 * copies admitted and F5c goes red. Neither mutation moves the other fixture.
 * ---------------------------------------------------------------------- */

const c17ValidRow = ledgerFields(id('INV-5200'), amt(880_00n), dte('2026-03-09'), id('CP-KESTREL'))
const c17UnreadableRow = ledgerFields(
  id('INV-5200'),
  txt('per remittance advice'),
  dte('2026-03-09'),
  id('CP-KESTREL'),
)

/** Two readable rows, both at line 0. Both are admitted; both reach the fold. */
const c17DoubledAdmitted = ledgerDoc('srcdoc_SYN_inv_5200_line0_twice', 'KESTREL-AR-2026-03.csv', [
  line(0, c17ValidRow),
  line(0, c17ValidRow),
])

/** One readable row and one unreadable row, both at line 0. */
const c17MixedAtOneAddress = ledgerDoc('srcdoc_SYN_inv_5200_mixed', 'KESTREL-AR-2026-03-b.csv', [
  line(0, c17ValidRow),
  line(0, c17UnreadableRow),
])

export const refusesDuplicateLineIndexInOnePopulation: RefusalScenario = {
  name: 'refusesDuplicateLineIndexInOnePopulation',
  story: 'A ledger export writes two different rows at line index 0 of the same document.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0111'),
    leftDocuments: [c17DoubledAdmitted],
  }),
  expect: {
    kind: 'population_integrity_refused',
    side: 'left',
    defects: [
      {
        kind: 'duplicate_item_address',
        ref: { sourceDocumentId: 'srcdoc_SYN_inv_5200_line0_twice' as SourceDocumentId, lineIndex: 0 },
        occurrences: 2,
      },
    ],
  },
  derivedFrom:
    'C17 — both copies are admitted, so both reach the fold, and the fold is a `Map` keyed on `itemKey`: the second `set` overwrote the first and the row VANISHED. `checkPostconditions` then computed the admitted total by iterating that same map, so both of its supposedly independent totals were short by the same amount and `gross_not_partitioned` could not fire. The engine cannot pick one of two rows that are the same row by every identity it has, so it refuses and names the address: side `left`, this document, line 0, seen twice.',
}

export const refusesMixedAdmittedAndRefusedAtOneAddress: RefusalScenario = {
  name: 'refusesMixedAdmittedAndRefusedAtOneAddress',
  story: 'The same duplicated line index, but the second copy carries prose where the amount belongs.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0112'),
    leftDocuments: [c17MixedAtOneAddress],
  }),
  expect: {
    kind: 'population_integrity_refused',
    side: 'left',
    defects: [
      {
        kind: 'duplicate_item_address',
        ref: { sourceDocumentId: 'srcdoc_SYN_inv_5200_mixed' as SourceDocumentId, lineIndex: 0 },
        occurrences: 2,
      },
    ],
  },
  derivedFrom:
    'C17 — AT LEAST ONE ADMITTED COPY, not both. One copy is admitted and one is refused, and this is the case the narrowing is drawn to include: the admitted copy sits in `state.items` at the SAME key its refused twin occupies in the residue, so `checkPostconditions` reads `inResidue` as true for a row whose residue entry belongs to the other one — `open_item_missing_from_residue` cannot fire and conservation balances over a ledger missing a transaction. `occurrences` counts admitted AND refused copies at the address, so it is 2 here exactly as it is when both are admitted: the count is a property of the address, not of admission.',
}

export const refusesRedeliveredDocumentOnTheRightSide: RefusalScenario = {
  name: 'refusesRedeliveredDocumentOnTheRightSide',
  story: 'The same bank advice file is uploaded twice into one run.',
  input: runInput({
    ...baseRefusalSpec('run_SYN_0113'),
    /* C18 RESTATEMENT. The advice now carries a declared trailer and the right
     * population declares that its format has one, so C17's early return is
     * load-bearing here: without it this population would report the collision
     * PLUS a doubled control total against the same file. */
    right: bankBinding({
      identifiers: [PATHS.reference],
      counterparty: null,
      carriesControlTotal: 'always',
    }),
    rightDocuments: [c18RedeliveredAdvice, c18RedeliveredAdvice],
  }),
  expect: {
    kind: 'population_integrity_refused',
    side: 'right',
    defects: [
      {
        kind: 'duplicate_item_address',
        ref: { sourceDocumentId: 'srcdoc_SYN_pay_1001_trailer' as SourceDocumentId, lineIndex: null },
        occurrences: 2,
      },
    ],
  },
  derivedFrom:
    'C17 at HEADER grain, and on the RIGHT population. The document has no lines, so `admitPopulation` derives one item per document at `lineIndex: null` — supplying the same `SourceDocument` twice therefore produces two items at one address, and the credit would have been counted once while appearing to have been counted twice. The left population is clean here, so this fixture is also the only witness that the integrity loop runs over BOTH sides: it reports `side: right`, and `checkPopulationIntegrity` is called per side rather than over a merged list, because a merged list has no side to report.',
}

/* ---------------------------------------------------------------------- *
 * C18 — THE ONE ARM THAT REFUSES
 *
 * 🛑 IT IS THE ARM A NULLABLE PAIR CANNOT EXPRESS, AND THAT IS THE ARGUMENT FOR
 * THE THREE-ARM UNION. `expectedLineCount: number | null` plus
 * `declaredControlTotal: Money | null` reads "unchecked" for BOTH *"this format
 * has no trailer"* and *"the trailer should have been there and was not"* — and
 * the second is a truncated or tampered file. Collapse the union and this
 * fixture cannot be WRITTEN: the counter-example becomes inexpressible and the
 * suite stops compiling rather than going red, which is the strongest form a
 * control takes here.
 * ---------------------------------------------------------------------- */

const c18MissingTrailerDoc = ledgerDocWithTrailer(
  'srcdoc_SYN_ar_7700_notrailer',
  'ORION-AR-2026-03-notrailer.csv',
  [line(0, c18Row7001), line(1, c18Row7002)],
  TRAILER_MISSING,
)

export const missingTrailerOnAFormatThatCarriesOneRefuses: RefusalScenario = {
  name: 'missingTrailerOnAFormatThatCarriesOneRefuses',
  story: 'The AR export always ends with a trailer row. This one does not, and a truncated file looks exactly like this.',
  input: runInput(c18Spec('run_SYN_0127', [c18MissingTrailerDoc])),
  expect: {
    kind: 'control_total_expected_but_absent',
    side: 'left',
    sourceDocumentId: 'srcdoc_SYN_ar_7700_notrailer' as SourceDocumentId,
  },
  derivedFrom:
    'C18 — the ONLY refusing condition, and it is argued for itself rather than by analogy with the five comparison arms. A format the TYPE declares to carry a trailer arrived without one; there is no way to distinguish that from a file whose tail was lost, so there is no sound ledger to produce and no residue worth preserving. It runs in the gate sequence beside the tenancy check rather than in §4a, because it needs no admitted item, no address and no sum — only the document.',
}

/* ---------------------------------------------------------------------- *
 * C13 — THE CEILING, AND THE OFF-SWITCH IT REFUSES
 *
 * 🛑 EACH OF THE TWO BELOW IS THE ONLY WITNESS ITS HALF OF THE GATE HAS. Admit
 * `10000` and `refusesACeilingOfTenThousand` goes red and NOTHING ELSE DOES —
 * which is precisely why it exists: without it the exclusive upper bound is a
 * comment. Change `>` to `>=` in the comparison and
 * `refusalRateAtTheCeilingIsAdmitted` goes red instead, and this one does not
 * move.
 * ---------------------------------------------------------------------- */

export const refusalRateAboveTheStatedCeilingRefuses: RefusalScenario = {
  name: 'refusalRateAboveTheStatedCeilingRefuses',
  story: 'The same half-unreadable ledger, against a controller who will not close on more than a quarter.',
  input: runInput(c13Spec('run_SYN_0128', 2500)),
  expect: {
    kind: 'population_integrity_refused',
    side: 'left',
    defects: [
      {
        kind: 'admission_refusal_rate_above_ceiling',
        refusedCount: 2,
        sideRowCount: 4,
        ceilingBasisPoints: 2500,
      },
    ],
  },
  derivedFrom:
    'C13 — 2 × 10000 = 20000 against 2500 × 4 = 10000, so the rate is above the ceiling and the run refuses. It arrives through `population_integrity_refused` rather than as a refusal kind of its own, because `model/reconciliation.ts` already declares that C13 and C18 "add a `PopulationDefect` member rather than a second refusal vocabulary". The arm carries BOTH operands and the ceiling: refusing discards the result, and with it `admissionRates`, so the refusal has to BE the evidence — a refusal saying only "too many rows refused" would leave "read the rate" with nothing to read.',
}

export const refusesACeilingOfTenThousand: RefusalScenario = {
  name: 'refusesACeilingOfTenThousand',
  story: 'A run configured with the ceiling wide open, which is the same thing as configured with the check off.',
  input: runInput({ ...baseRefusalSpec('run_SYN_0129'), admissionRefusalCeilingBasisPoints: 10_000 }),
  expect: { kind: 'admission_refusal_ceiling_not_stated' },
  derivedFrom:
    'C13 — THE UPPER BOUND IS EXCLUSIVE AND THAT EXCLUSIVITY IS THE CONTROL. At 10000 the comparison `refused × 10000 > 10000 × presented` reduces algebraically to `admitted < 0`, unsatisfiable for a `.length`, so a gate admitting it would certify OFF as STATED — §5.2 wearing a required-field costume, refused once already at G79 for `requireImprovementOptOut`. `SIMILARITY_MAX_CHARS_CEILING` is this module\'s own precedent for a gate that refuses ABOVE a bound. The remediation for a breach is to READ THE RATE, never to raise the ceiling, which is why the rate is recorded unconditionally on every successful run.',
}

/* ---------------------------------------------------------------------- *
 * O-15 — THE POPULATION THAT PRESENTED NOTHING
 *
 * 🛑 THE TWO BELOW ARE THE ONLY WITNESSES THE GATE HAS, AND THEY WITNESS
 * DIFFERENT HALVES OF IT. Delete the gate and both go green with a clean,
 * fully-reconciled close over one side — which is the defect O-15 exists to end,
 * and it is why a green run is not evidence here unless something red pins the
 * empty case. Write the gate for the LEFT side only and
 * `emptyRightPopulationRefusesTheRun` is the one that stays green while the
 * statement side goes unloaded, which is the direction that loses money.
 *
 * ⚠️ AND NEITHER IS C13's CASE. `wholeRunRefusedStillProducesTheResidue` and
 * `unclassifiedFieldFailsClosed` both PRESENT rows and admit none; both still
 * return `ok: true` with `population_wholly_refused` in `postconditions` and a
 * residue carrying one reason per row. If a change to this gate turns either of
 * those into a refusal, the two arms have been merged and the residue has been
 * deleted — read `population_empty_and_not_expected`'s own declaration before
 * "fixing" it.
 * ---------------------------------------------------------------------- */

export const emptyPopulationRefusesTheRun: RefusalScenario = {
  name: 'emptyPopulationRefusesTheRun',
  story: 'The AR export failed overnight, so the ledger side arrives with no documents at all. The bank side is fine.',
  input: runInput({ ...baseRefusalSpec('run_SYN_0130'), leftDocuments: [] }),
  expect: { kind: 'population_empty_and_not_expected', side: 'left' },
  derivedFrom:
    'O-15 (docs/HANDOFF.md G172) — `presentedRowsOnSide([])` is 0 and the ledger binding declares `emptyExpectation: "refuses"`, so the run refuses before admission. Without the gate this input returns `ok: true`: the right side admits its one row, no strategy pairs it, it lands in the residue as `no_strategy_paired`, and `checkPostconditions` reports NOTHING — the conservation arms accumulate from zero over the empty left side, `admittedMinor !== accountedMinor` compares 12500 against 12500 for the one real item, and `population_wholly_refused` skips `presented === 0`. A close reported sound over a ledger nobody loaded. The arm carries the side and nothing else because every count it could carry is zero by the condition that produced it.',
}

export const emptyRightPopulationRefusesTheRun: RefusalScenario = {
  name: 'emptyRightPopulationRefusesTheRun',
  story: 'The bank endpoint returns an empty response and the statement side arrives with nothing in it.',
  input: runInput({ ...baseRefusalSpec('run_SYN_0131'), rightDocuments: [] }),
  expect: { kind: 'population_empty_and_not_expected', side: 'right' },
  derivedFrom:
    'O-15 — the same gate on the OTHER side, and the only witness that it iterates both. The loop runs `left` then `right`, so a run with BOTH sides empty would report `left`; here the left side presents its one invoice, passes, and the refusal names `right`. This is the direction an operator most needs named: an unloaded statement side against a full ledger reconciles to a residue of unpaid invoices, which looks exactly like a bad month rather than like a broken feed.',
}

export const REFUSAL_SCENARIOS: readonly RefusalScenario[] = [
  refusesUnstatedReaderCap,
  refusesUnstatedSimilarityCap,
  refusesUnstatedSubsetSumBound,
  refusesInvalidNormalisation,
  refusesCrossTenantDocuments,
  refusesStrategyBindingCountMismatch,
  refusesStrategyBindingKindMismatch,
  refusesUnstatedDeclaredUnit,
  refusesDeclaredUnitsDisagreeAcrossSides,
  refusesStrategyToleranceInAnotherUnit,
  refusesDuplicateLineIndexInOnePopulation,
  refusesMixedAdmittedAndRefusedAtOneAddress,
  refusesRedeliveredDocumentOnTheRightSide,
  missingTrailerOnAFormatThatCarriesOneRefuses,
  refusalRateAboveTheStatedCeilingRefuses,
  refusesACeilingOfTenThousand,
  emptyPopulationRefusesTheRun,
  emptyRightPopulationRefusesTheRun,
]

/* ====================================================================== *
 * §O2  C13's UNCONDITIONAL HALF — `SetReconciliationResult.admissionRates`
 *
 * 🛑 WHY THIS IS A VECTOR TABLE AND NOT A FIELD ON `Expectation`. The rate is
 * reported on EVERY successful run, so putting it on the expectation shape would
 * have added a line to all thirty-five scenarios and told the reader nothing
 * about thirty-one of them. The four below are the ones whose value is the
 * argument, and the FIRST is the load-bearing one: a run with no refusals at all
 * and no ceiling anywhere near being breached still reports the rate. Make the
 * record conditional on a breach — or on a ceiling being set — and that vector
 * goes red, which is what keeps the evidence unsuppressable.
 *
 * ⚠️ `presented` IS NOT `admitted + refused` BY CONSTRUCTION. It is folded from
 * `presentedRowCount` over the documents, so a caller can check the equation.
 * Every row below states all three numbers for exactly that reason.
 * ====================================================================== */

export interface AdmissionRateVector {
  readonly scenario: string
  readonly expect: readonly {
    readonly side: PopulationSide
    readonly presented: number
    readonly admitted: number
    readonly refused: number
  }[]
  readonly why: string
}

export const ADMISSION_RATE_VECTORS: readonly AdmissionRateVector[] = [
  {
    scenario: 'cleanIdentifierMatch',
    expect: [
      { side: 'left', presented: 1, admitted: 1, refused: 0 },
      { side: 'right', presented: 1, admitted: 1, refused: 0 },
    ],
    why: 'THE ONE THAT MAKES THE RECORD UNCONDITIONAL. Nothing refused, nothing near the ceiling, and the rate is reported anyway — zero is a fact about the run, not an absence of one. Both documents are header-grain, so each presents exactly one row at `lineIndex: null`.',
  },
  {
    scenario: 'refusalRateAtTheCeilingIsAdmitted',
    expect: [
      { side: 'left', presented: 4, admitted: 2, refused: 2 },
      { side: 'right', presented: 2, admitted: 2, refused: 0 },
    ],
    why: 'A run that passed the gate at exactly the stated ceiling still says how close it came. This is the number an operator reads instead of raising the ceiling.',
  },
  {
    scenario: 'unclassifiedFieldFailsClosed',
    expect: [
      { side: 'left', presented: 1, admitted: 1, refused: 0 },
      { side: 'right', presented: 1, admitted: 0, refused: 1 },
    ],
    why: 'The wholly-refused side reads `admitted: 0` against `presented: 1` — the operand `population_wholly_refused` is derived from, stated per side rather than inferred from a residue that happens to hold refused rows.',
  },
  {
    scenario: 'wholeRunRefusedStillProducesTheResidue',
    expect: [
      { side: 'left', presented: 2, admitted: 0, refused: 2 },
      { side: 'right', presented: 2, admitted: 0, refused: 2 },
    ],
    why: 'Both sides at 10000 basis points, on a run that returned `ok: true`. The rate is recorded on the result precisely BECAUSE the engine declined to refuse here.',
  },
  {
    scenario: 'emptyPopulationIsAdmittedWhenDeclaredPermitted',
    expect: [
      { side: 'left', presented: 0, admitted: 0, refused: 0 },
      { side: 'right', presented: 1, admitted: 1, refused: 0 },
    ],
    why: 'O-15 — `presented: 0` against `admitted: 0` and `refused: 0`, and the three zeros are three different statements. This is the row that distinguishes an EMPTY side from a WHOLLY-REFUSED one: `wholeRunRefusedStillProducesTheResidue` reads `presented: 2, admitted: 0, refused: 2` and reports `population_wholly_refused`; this reads `presented: 0` and reports nothing, because there was nothing to refuse. A run that reached this row at all did so because its binding declared zero permitted.',
  },
]

/* ====================================================================== *
 * §P  UNIT VECTORS — the exports no end-to-end run can reach
 *
 * A scenario exercises the fold. These reach the total functions underneath it,
 * including the two marked stubs and the four money refusal arms. Every expected
 * value here is derived from the function's stated rule, not from its output.
 * ====================================================================== */

export type MoneyExpectation =
  | { readonly ok: true; readonly value: bigint }
  | { readonly ok: false; readonly refusal: MoneyRefusal['kind'] }

export interface MoneyVector {
  readonly name: string
  readonly op: 'add' | 'subtract' | 'compare' | 'min'
  readonly a: Money
  readonly b: Money
  /** For `compare`, the value is the sign (−1, 0, 1); for `min` it is the chosen amount. */
  readonly expect: MoneyExpectation
  readonly why: string
}

export const MONEY_VECTORS: readonly MoneyVector[] = [
  {
    name: 'add exact integers',
    op: 'add',
    a: mny(100_00n),
    b: mny(250_00n),
    expect: { ok: true, value: 350_00n },
    why: 'JavaScript `number` is EXACT on integers under + and − up to 2^53, so a minor-unit waterfall accumulates exactly zero error.',
  },
  {
    name: 'add across currencies',
    op: 'add',
    a: mny(100_00n),
    b: mny(100_00n, 'USD'),
    expect: { ok: false, refusal: 'currency_mismatch' },
    why: 'sameUnit refuses before any arithmetic. A USD invoice against an SGD order reported a 35% variance on a correct invoice before `currency` existed on Money.',
  },
  {
    name: 'add across exponents',
    op: 'add',
    a: mny(100_00n, 'SGD', 2),
    b: mny(100_000n, 'SGD', 3),
    expect: { ok: false, refusal: 'exponent_mismatch' },
    why: 'Same currency, different scale. Adding the minor units would be off by a factor of ten and the sum would look plausible.',
  },
  /* 🛑 A VECTOR STOOD HERE AND ITS INPUT IS NO LONGER CONSTRUCTIBLE — G286,
   * 19 Sep 2026. IT IS QUOTED RATHER THAN ERASED, because a register that
   * silently loses a row cannot be told from one that never had it:
   *
   *     name:   'add a fractional minor unit'
   *     a:      { currency: 'SGD', amountMinor: 10.5, exponent: 2 }
   *     b:      mny(1)
   *     expect: { ok: false, refusal: 'not_integer_minor_units' }
   *     why:    'A fractional minor unit is a major-unit float that arrived
   *              through the wrong door. It is refused, never rounded.'
   *
   * `amountMinor` is `bigint`, so `10.5` is a COMPILE ERROR rather than a
   * refusal. The expectation was not weakened and was not deleted: it MOVED to
   * the boundary where a fractional minor unit can still arrive, which is the
   * wire. `MONEY_CODEC_VECTORS` below carries `'10.5' → not_integer_minor_units`
   * and `tests/model/money-codec.test.ts` asserts it. The `why` above is still
   * the reason, word for word — only the door changed.
   */
  {
    name: 'add two minor units that no `number` could hold exactly',
    op: 'add',
    a: mny(9_007_199_254_740_993n),
    b: mny(2n),
    expect: { ok: true, value: 9_007_199_254_740_995n },
    /* 🛑 THIS VECTOR IS G286'S OWN WITNESS AND IT REPLACES ONE THAT EXPECTED A
     * REFUSAL HERE. The old vector read:
     *
     *     name:   'add beyond the exact integer range'
     *     a:      mny(Number.MAX_SAFE_INTEGER)
     *     b:      mny(1)
     *     expect: { ok: false, refusal: 'exceeds_exact_integer_range' }
     *     why:    'Both operands are safe; the SUM is not. G65 hardens this
     *              ceiling and does not rescue the arithmetic below it.'
     *
     * 🛑 THAT EXPECTATION IS NOW WRONG, AND IT BEING WRONG IS THE ENTIRE POINT
     * OF THE RULING. The value it refused is two minor units past
     * `Number.MAX_SAFE_INTEGER`; under `bigint` it is an ordinary exact sum. The
     * change is NOT the engine drifting — it is the specification moving, on an
     * owner ruling, in the direction the record had been asserting since 8 Aug
     * 2026. G286: 2^53 is *"ample for one close and not ample for a cumulative
     * total, a multi-year ledger or a minor unit finer than two decimals."*
     *
     * ⚠️ AND THE OPERAND IS THE PROOF, NOT JUST THE SUM. `9_007_199_254_740_993`
     * is 2^53 + 1, THE SMALLEST POSITIVE INTEGER A `number` CANNOT REPRESENT:
     * as a `number` it silently becomes 9_007_199_254_740_992, so `a + b` would
     * answer ...994 rather than ...995. Both are stated here as literals so the
     * two answers can be read side by side.
     *
     * ⚠️ THE REFUSAL DID NOT GO AWAY; ITS BOUND ROSE BY A FACTOR OF 1024. The
     * vector below sits at the `int8` edge and still refuses.
     */
    why: 'G286: exactness above 2^53 minor units is the whole reason `amountMinor` is `bigint`. 2^53 + 1 is the smallest positive integer a `number` cannot hold, and as a `number` this sum is off by one.',
  },
  {
    name: 'add beyond the STORABLE integer range',
    op: 'add',
    a: mny(9_223_372_036_854_775_807n),
    b: mny(1n),
    expect: { ok: false, refusal: 'exceeds_exact_integer_range' },
    why: 'Both operands are storable; the SUM is not. `exceeds_exact_integer_range` means the `int8` column G65 declares money is stored in (−2^63 … 2^63−1), not `Number.isSafeInteger` — G286 moved the bound and kept the arm. A run that cannot be persisted is not a smaller success.',
  },
  {
    name: 'subtract a bank charge',
    op: 'subtract',
    a: mny(4000_00n),
    b: mny(3985_00n),
    expect: { ok: true, value: 15_00n },
    why: 'Signed variance is defined once, as left minus right, and never re-derived.',
  },
  {
    name: 'compare equal',
    op: 'compare',
    a: mny(125_00n),
    b: mny(125_00n),
    expect: { ok: true, value: 0n },
    why: 'Returns −1, 0 or 1 — never a difference, which would leak an amount into a comparator.',
  },
  {
    name: 'compare less',
    op: 'compare',
    a: mny(100_00n),
    b: mny(125_00n),
    expect: { ok: true, value: -1n },
    why: 'Integer comparison; no epsilon, because there are no floats here.',
  },
  {
    name: 'compare greater',
    op: 'compare',
    a: mny(200_00n),
    b: mny(125_00n),
    expect: { ok: true, value: 1n },
    why: 'Same.',
  },
  {
    name: 'compare across currencies',
    op: 'compare',
    a: mny(100_00n),
    b: mny(100_00n, 'USD'),
    expect: { ok: false, refusal: 'currency_mismatch' },
    why: '§5.7 refused once, in one place, rather than at three inline call sites — which is what `model/access.ts` still does.',
  },
  {
    name: 'min picks the smaller',
    op: 'min',
    a: mny(400_00n),
    b: mny(398_50n),
    expect: { ok: true, value: 398_50n },
    why: 'Every pour allocates min(target residual, source residual); this is the only reason `minMoney` exists.',
  },
  {
    name: 'min of equals returns the first',
    op: 'min',
    a: mny(125_00n),
    b: mny(125_00n),
    expect: { ok: true, value: 125_00n },
    why: 'compare ≤ 0 selects `a`. Stated because the tie has to be deterministic.',
  },
]

/** Vectors for the four single-argument money predicates plus `zeroLike`. */
export const MONEY_PREDICATE_VECTORS: readonly {
  readonly name: string
  readonly value: Money
  readonly minorUnits: bigint
  readonly isZero: boolean
  readonly isPositive: boolean
  readonly isNegative: boolean
  readonly guardRefusal: MoneyRefusal['kind'] | null
  readonly zeroLikeMinor: bigint
}[] = [
  {
    name: 'a positive balance',
    value: mny(15_00n),
    minorUnits: 15_00n,
    isZero: false,
    isPositive: true,
    isNegative: false,
    guardRefusal: null,
    zeroLikeMinor: 0n,
  },
  {
    name: 'a closed balance',
    value: mny(0n),
    minorUnits: 0n,
    isZero: true,
    isPositive: false,
    isNegative: false,
    guardRefusal: null,
    zeroLikeMinor: 0n,
  },
  {
    name: 'a negative residual, which post-conditions treat as a defect',
    value: mny(-1n),
    minorUnits: -1n,
    isZero: false,
    isPositive: false,
    isNegative: true,
    guardRefusal: null,
    zeroLikeMinor: 0n,
  },
  /* 🛑 A VECTOR STOOD HERE AND ITS INPUT IS NO LONGER CONSTRUCTIBLE — G286,
   * 19 Sep 2026. Quoted rather than erased:
   *
   *     name:         'a fractional minor unit'
   *     value:        { currency: 'SGD', amountMinor: 0.5, exponent: 2 }
   *     minorUnits:   0.5
   *     guardRefusal: 'not_integer_minor_units'
   *
   * Same reason as the vector removed from `MONEY_VECTORS` above: `bigint`
   * admits no fractional value, so this is a compile error and not a refusal.
   * The expectation moved to `MONEY_CODEC_VECTORS`.
   */
  {
    name: 'a balance no `number` could hold exactly',
    value: mny(9_007_199_254_740_993n),
    minorUnits: 9_007_199_254_740_993n,
    isZero: false,
    isPositive: true,
    isNegative: false,
    guardRefusal: null,
    zeroLikeMinor: 0n,
  },
  {
    name: 'one minor unit past what the column can store',
    value: mny(9_223_372_036_854_775_808n),
    minorUnits: 9_223_372_036_854_775_808n,
    isZero: false,
    isPositive: true,
    isNegative: false,
    guardRefusal: 'exceeds_exact_integer_range',
    zeroLikeMinor: 0n,
  },
]

/* ====================================================================== *
 * §O2  THE CODEC — G111's one conversion, both directions
 *
 * 🛑 NEW ON 19 Sep 2026 WITH G286, AND IT IS WHERE TWO EXPECTATIONS DELETED
 * FROM THE TABLES ABOVE WENT. `Money.amountMinor` is `bigint` in the model and
 * a decimal STRING on the wire; `model/money.ts` is the only thing permitted to
 * convert between them. A fractional minor unit can no longer be CONSTRUCTED —
 * so the vectors that used to state what happens to one now state it at the
 * only door it can still come through.
 *
 * Every expectation here is derived from the codec's stated rule — the anchored
 * pattern `^-?[0-9]+$` and the `int8` range — not from running it.
 * ====================================================================== */

export interface MoneyCodecVector {
  readonly name: string
  /** The wire form. */
  readonly text: string
  /** `null` where the codec refuses. */
  readonly expect: bigint | null
  readonly refusal: 'not_integer_minor_units' | 'exceeds_exact_integer_range' | null
  readonly why: string
}

export const MONEY_CODEC_VECTORS: readonly MoneyCodecVector[] = [
  {
    name: 'an ordinary amount',
    text: '12500',
    expect: 12_500n,
    refusal: null,
    why: 'The base case. 125.00 in a two-decimal currency.',
  },
  {
    name: 'zero',
    text: '0',
    expect: 0n,
    refusal: null,
    why: 'A closed balance is a legal figure a ledger may hold.',
  },
  {
    name: 'a negative amount',
    text: '-1',
    expect: -1n,
    refusal: null,
    why: 'A negative residual is a defect the post-conditions REPORT, not a value the codec refuses.',
  },
  {
    name: 'an amount no `number` could hold exactly',
    text: '9007199254740993',
    expect: 9_007_199_254_740_993n,
    refusal: null,
    why: '2^53 + 1. `Number("9007199254740993")` is 9007199254740992 — off by one, silently. This is the round trip G65 made the wire a STRING for.',
  },
  {
    name: 'the largest storable amount',
    text: '9223372036854775807',
    expect: 9_223_372_036_854_775_807n,
    refusal: null,
    why: '2^63 − 1, the `int8` ceiling. Admitted at the bound; the bound is inclusive.',
  },
  {
    name: 'one past the largest storable amount',
    text: '9223372036854775808',
    expect: null,
    refusal: 'exceeds_exact_integer_range',
    why: 'A `bigint` has no range. The COLUMN does, and refusing at the boundary beats failing at INSERT after a run is computed.',
  },
  {
    name: 'a fractional minor unit',
    text: '10.5',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'A fractional minor unit is a major-unit float that arrived through the wrong door. It is refused, never rounded. THIS IS THE EXPECTATION `MONEY_VECTORS` CARRIED UNTIL G286, verbatim.',
  },
  {
    name: 'NaN',
    text: 'NaN',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'Not an integer, and `BigInt("NaN")` THROWS — which is why the pattern runs first and this module has no try/catch in it.',
  },
  {
    name: 'Infinity',
    text: 'Infinity',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'Same door, same refusal. An unbounded amount is not an amount.',
  },
  {
    name: 'scientific notation',
    text: '1e3',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'A thousand minor units written in a form nobody declared. Accepting it would mean two spellings of one amount.',
  },
  {
    name: 'an empty string',
    text: '',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'THE WORST ONE ON THIS LIST IF IT WERE ADMITTED: `BigInt("")` is `0n`, so an ABSENT amount would become a ZERO amount. `ResidueEntry.settlement` records what a fabricated zero cost this codebase once already.',
  },
  {
    name: 'whitespace',
    text: '   ',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: '`BigInt("   ")` is also `0n`. Same defect wearing a different hat.',
  },
  {
    name: 'a leading plus',
    text: '+7',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'Two spellings of seven. The pattern admits one.',
  },
  {
    name: 'hexadecimal',
    text: '0x10',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: '`BigInt("0x10")` is 16. An amount in a base nobody declared is an amount that reads as sixteen to the codec and ten to the operator.',
  },
  {
    name: 'a numeric separator',
    text: '1_000',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'A SOURCE syntax, not a wire syntax. `BigInt` refuses it and `Number` does not; refusing here means the two can never disagree.',
  },
  {
    name: 'digits with a tail',
    text: '12abc',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'THE ANCHORS ARE THE CONTROL. An unanchored pattern matches the `12` and admits an amount somebody appended to.',
  },
  {
    name: 'a padded amount',
    text: ' 7 ',
    expect: null,
    refusal: 'not_integer_minor_units',
    why: 'The other half of the anchors. Trimming here would be the codec deciding what a caller meant.',
  },
]

export type ToleranceExpectation =
  | { readonly ok: true; readonly admitted: boolean; readonly signedVarianceMinor: bigint }
  | { readonly ok: false; readonly refusal: ToleranceRefusal }

export interface ToleranceVector {
  readonly name: string
  readonly left: Money
  readonly right: Money
  readonly tolerance: Tolerance
  readonly direction: ToleranceDirection
  readonly expect: ToleranceExpectation
  readonly why: string
}

export const TOLERANCE_VECTORS: readonly ToleranceVector[] = [
  {
    name: 'exact under a zero rounding tolerance',
    left: mny(125_00n),
    right: mny(125_00n),
    tolerance: EXACT_MONEY,
    direction: 'symmetric',
    expect: { ok: true, admitted: true, signedVarianceMinor: 0n },
    why: 'A rounding tolerance is expressed in minor units and is unit-free, so it is admitted against any currency.',
  },
  {
    name: 'a shortfall exactly on the ceiling, in the permitted direction',
    left: mny(4000_00n),
    right: mny(3985_00n),
    tolerance: { kind: 'money', value: mny(15_00n) },
    direction: 'left_greater_only',
    expect: { ok: true, admitted: true, signedVarianceMinor: 15_00n },
    why: 'The comparison is ≤, so the boundary is inside the tolerance. Stated because a boundary left to inference is a boundary someone will change.',
  },
  {
    name: 'the same shortfall in the wrong direction',
    left: mny(4000_00n),
    right: mny(3985_00n),
    tolerance: { kind: 'money', value: mny(15_00n) },
    direction: 'right_greater_only',
    expect: { ok: true, admitted: false, signedVarianceMinor: 15_00n },
    why: 'A9(g) — writing off an underpayment and an overpayment under one number is a policy choice nobody made. The variance is still reported, so the direction stays recoverable.',
  },
  {
    name: 'an overpayment where only a shortfall is admitted',
    left: mny(3985_00n),
    right: mny(4000_00n),
    tolerance: { kind: 'money', value: mny(15_00n) },
    direction: 'left_greater_only',
    expect: { ok: true, admitted: false, signedVarianceMinor: -15_00n },
    why: 'Negative variance, admitted magnitude, refused direction.',
  },
  {
    name: 'a shortfall beyond the ceiling',
    left: mny(4000_00n),
    right: mny(3980_00n),
    tolerance: { kind: 'money', value: mny(15_00n) },
    direction: 'symmetric',
    expect: { ok: true, admitted: false, signedVarianceMinor: 20_00n },
    why: 'Not a refusal — a verdict. The comparison worked and the answer is no.',
  },
  {
    name: 'the absolute arm',
    left: mny(4000_00n),
    right: mny(3985_00n),
    tolerance: { kind: 'absolute', value: 15 },
    direction: 'symmetric',
    expect: { ok: false, refusal: { kind: 'float_money_tolerance', arm: 'absolute' } },
    why: 'A bare `number` applied to an amount IS floating-point money, which docs/build-conventions.md §3 bans on G65. A pack author who writes this gets a refusal, not a match, and that is the correct cost.',
  },
  {
    name: 'the percentage arm',
    left: mny(4000_00n),
    right: mny(3985_00n),
    tolerance: { kind: 'percentage', value: 2 },
    direction: 'symmetric',
    expect: { ok: false, refusal: { kind: 'float_money_tolerance', arm: 'percentage' } },
    why: 'Additionally requires a multiply and a rounding decision. This engine never multiplies, never divides and never rounds money.',
  },
  {
    name: 'a days tolerance handed to the amount comparison',
    left: mny(125_00n),
    right: mny(125_00n),
    tolerance: FIVE_DAYS,
    direction: 'symmetric',
    expect: { ok: false, refusal: { kind: 'not_an_amount_tolerance', arm: 'days' } },
    why: 'A tolerance on another quantity entirely. Refused rather than coerced.',
  },
  {
    name: 'a similarity tolerance handed to the amount comparison',
    left: mny(125_00n),
    right: mny(125_00n),
    tolerance: { kind: 'similarity', value: 0.9 },
    direction: 'symmetric',
    expect: { ok: false, refusal: { kind: 'not_an_amount_tolerance', arm: 'similarity' } },
    why: 'Same.',
  },
  {
    name: 'a negative rounding tolerance',
    left: mny(125_00n),
    right: mny(125_00n),
    tolerance: { kind: 'rounding', minorUnits: -1 },
    direction: 'symmetric',
    expect: { ok: false, refusal: { kind: 'money', refusal: { kind: 'not_integer_minor_units' } } },
    why: 'A negative ceiling would admit nothing while looking like a configured tolerance.',
  },
  {
    name: 'a money tolerance in another currency',
    left: mny(4000_00n),
    right: mny(3985_00n),
    tolerance: { kind: 'money', value: mny(15_00n, 'USD') },
    direction: 'symmetric',
    expect: { ok: false, refusal: { kind: 'money', refusal: { kind: 'currency_mismatch' } } },
    why: 'The tolerance must agree with the variance on currency AND exponent.',
  },
  {
    name: 'a cross-currency comparison',
    left: mny(4000_00n),
    right: mny(3985_00n, 'USD'),
    tolerance: { kind: 'money', value: mny(15_00n) },
    direction: 'symmetric',
    expect: { ok: false, refusal: { kind: 'money', refusal: { kind: 'currency_mismatch' } } },
    why: 'The subtraction fails first, so no tolerance arm is ever consulted.',
  },
]

export type ExtractionExpectation =
  | { readonly ok: true; readonly key: string }
  | { readonly ok: false; readonly refusal: ExtractionRefusal }

export interface ExtractionVector {
  readonly name: string
  readonly input: string
  readonly normalisation: IdentifierNormalisation
  readonly expect: ExtractionExpectation
  readonly why: string
}

function norm(ops: IdentifierNormalisation['ops'], then: IdentifierNormalisation['then'], maxInputChars = 64): IdentifierNormalisation {
  return { ops, then, maxInputChars }
}

export const EXTRACTION_VECTORS: readonly ExtractionVector[] = [
  {
    name: 'the module\'s own worked example',
    input: 'BR001-TXN99823-SG',
    normalisation: norm([{ kind: 'split_take', separator: '-', index: 1 }], 'exact'),
    expect: { ok: true, key: 'TXN99823' },
    why: "The deterministic form of the draft's `(?<=BR\\d{3}-)TXN\\d+(?=-SG)`. A human can evaluate `split on '-', take segment 1`; a human cannot evaluate a regex for ReDoS-safety.",
  },
  {
    name: 'surrounding whitespace',
    input: '  INV-1001  ',
    normalisation: norm([{ kind: 'trim' }], 'exact'),
    expect: { ok: true, key: 'INV-1001' },
    why: 'Total, allocates no backtracking state, has no quantifier.',
  },
  {
    name: 'leading zeros',
    input: '0000123',
    normalisation: norm([{ kind: 'strip_leading_zeros' }], 'exact'),
    expect: { ok: true, key: '123' },
    why: 'A ledger writes 123 and an export pads to seven digits.',
  },
  {
    name: 'an all-zero identifier',
    input: '0000',
    normalisation: norm([{ kind: 'strip_leading_zeros' }], 'exact'),
    expect: { ok: true, key: '0' },
    why: 'Documented explicitly on the op: an all-zero input normalises to `0`, never to the empty string, which would then be refused as empty.',
  },
  {
    name: 'a literal prefix',
    input: 'PO-998',
    normalisation: norm([{ kind: 'strip_literal', literal: 'PO-', at: 'prefix' }], 'exact'),
    expect: { ok: true, key: '998' },
    why: 'The case the draft wanted Jaro-Winkler for. A deterministic normalisation is strictly better evidence than a similarity score.',
  },
  {
    name: 'a literal suffix',
    input: 'INV-2087-SG',
    normalisation: norm([{ kind: 'strip_literal', literal: '-SG', at: 'suffix' }], 'exact'),
    expect: { ok: true, key: 'INV-2087' },
    why: 'A country tag the bank adds and the ledger does not.',
  },
  {
    name: 'a literal anywhere',
    input: 'A-B-C',
    normalisation: norm([{ kind: 'strip_literal', literal: '-', at: 'anywhere' }], 'exact'),
    expect: { ok: true, key: 'ABC' },
    why: 'Implemented as split-then-join, so no regex is constructed for it either.',
  },
  {
    name: 'casefold',
    input: 'INV-1001',
    normalisation: norm([], 'casefold'),
    expect: { ok: true, key: 'inv-1001' },
    why: 'The terminal transform is the closed `Normaliser` union the model already declares.',
  },
  {
    name: 'digits only',
    input: 'INV-1001',
    normalisation: norm([], 'digits_only'),
    expect: { ok: true, key: '1001' },
    why: 'Character-by-character, no regex.',
  },
  {
    name: 'digits only over a string with no digits',
    input: 'INV',
    normalisation: norm([], 'digits_only'),
    expect: { ok: false, refusal: { kind: 'empty_after_ops', opIndex: null } },
    why: 'An empty key would join every other empty key. Refused, and the row lands in the residue with a reason.',
  },
  {
    name: 'the name_normalise stub',
    input: 'BEACON FOODS PTE LTD',
    normalisation: norm([], 'name_normalise'),
    expect: { ok: false, refusal: { kind: 'normaliser_not_implemented', opIndex: null } },
    why: 'A member of the closed union that NOTHING in this repository defines. Company-suffix stripping? Diacritic folding? Each answer changes which records pair, so implementing a guess would be fabricating a matching rule.',
  },
  {
    name: 'a segment index past the end',
    input: 'BR001-TXN99823',
    normalisation: norm([{ kind: 'split_take', separator: '-', index: 5 }], 'exact'),
    expect: { ok: false, refusal: { kind: 'segment_index_out_of_range', opIndex: 0 } },
    why: 'Under `noUncheckedIndexedAccess` the read is `T | undefined`, and an undefined key silently skipped is A9(d) one layer down.',
  },
  {
    name: 'an input longer than the stated cap',
    input: 'BR001-TXN99823-SG-EXTRA-EXTRA-EXTRA',
    normalisation: norm([{ kind: 'trim' }], 'exact', 8),
    expect: { ok: false, refusal: { kind: 'input_exceeds_max_chars', opIndex: null } },
    why: 'The cap is applied BEFORE any op runs, and it is a required field with no default.',
  },
]

export interface NormalisationDefectVector {
  readonly name: string
  readonly normalisation: IdentifierNormalisation
  readonly expect: readonly NormalisationDefect[]
}

export const NORMALISATION_DEFECT_VECTORS: readonly NormalisationDefectVector[] = [
  { name: 'the identity is valid', normalisation: IDENTITY_NORMALISATION, expect: [] },
  { name: 'the segment normalisation is valid', normalisation: SEGMENT_NORMALISATION, expect: [] },
  {
    name: 'no input cap',
    normalisation: norm([], 'exact', 0),
    expect: [{ kind: 'max_input_chars_not_stated' }],
  },
  {
    name: 'an empty separator',
    normalisation: norm([{ kind: 'split_take', separator: '', index: 0 }], 'exact'),
    expect: [{ kind: 'empty_separator', opIndex: 0 }],
  },
  {
    name: 'a negative index',
    normalisation: norm([{ kind: 'split_take', separator: '-', index: -1 }], 'exact'),
    expect: [{ kind: 'negative_index', opIndex: 0 }],
  },
  {
    name: 'a fractional index',
    normalisation: norm([{ kind: 'split_take', separator: '-', index: 1.5 }], 'exact'),
    expect: [{ kind: 'non_integer_index', opIndex: 0 }],
  },
  {
    name: 'an empty literal',
    normalisation: norm([{ kind: 'strip_literal', literal: '', at: 'anywhere' }], 'exact'),
    expect: [{ kind: 'empty_literal', opIndex: 0 }],
  },
]

export interface CalendarVector {
  readonly input: string
  /** The ten characters the parse keeps, or null where it refuses. */
  readonly expectIso: string | null
  readonly why: string
}

export const CALENDAR_VECTORS: readonly CalendarVector[] = [
  { input: '2026-03-02', expectIso: '2026-03-02', why: 'The plain form.' },
  {
    input: '2026-03-02T09:15:00Z',
    expectIso: '2026-03-02',
    why: 'An RFC 3339 instant whose first ten characters are a valid calendar date.',
  },
  { input: '2026-03-02 09:15', expectIso: '2026-03-02', why: 'A space separator is accepted alongside T.' },
  { input: '2024-02-29', expectIso: '2024-02-29', why: '2024 is a leap year.' },
  { input: '2026-02-29', expectIso: null, why: '2026 is not.' },
  { input: '2000-02-29', expectIso: '2000-02-29', why: 'Divisible by 400, so it IS a leap year — the rule people get wrong.' },
  { input: '1900-02-29', expectIso: null, why: 'Divisible by 100 and not by 400, so it is not.' },
  { input: '2026-02-30', expectIso: null, why: 'The topology-12 row. No such day.' },
  { input: '2026-13-01', expectIso: null, why: 'Month out of range.' },
  { input: '2026-00-10', expectIso: null, why: 'Month zero.' },
  { input: '2026-03-00', expectIso: null, why: 'Day zero.' },
  { input: '2026/03/02', expectIso: null, why: 'Separators are checked by character code at positions 4 and 7.' },
  { input: '26-03-02', expectIso: null, why: 'Shorter than ten characters.' },
  { input: '2026-03-0X', expectIso: null, why: 'A non-digit where a digit belongs.' },
  { input: '2026-03-02X09:15', expectIso: null, why: 'A separator that is neither T nor space.' },
  { input: 'not a date at all', expectIso: null, why: 'The input that produced NaN in the draft and an order that depended on the sort implementation.' },
]

/**
 * `dayNumber` is defined as days since 1970-01-01, so these two are definitional
 * rather than observational — and the gaps below are the arithmetic the day
 * tolerance actually uses.
 */
export const CALENDAR_ANCHOR_VECTORS: readonly { readonly input: string; readonly dayNumber: number }[] = [
  { input: '1970-01-01', dayNumber: 0 },
  { input: '1969-12-31', dayNumber: -1 },
]

export const CALENDAR_GAP_VECTORS: readonly {
  readonly from: string
  readonly to: string
  readonly gapDays: number
  readonly why: string
}[] = [
  { from: '2026-03-02', to: '2026-03-05', gapDays: 3, why: 'Within a month.' },
  { from: '2026-03-10', to: '2026-03-13', gapDays: 3, why: 'The `amount_and_date` window in scenario 13.' },
  { from: '2026-02-28', to: '2026-03-01', gapDays: 1, why: 'Across a non-leap February boundary.' },
  { from: '2024-02-28', to: '2024-03-01', gapDays: 2, why: 'Across a leap February boundary.' },
  { from: '2025-12-31', to: '2026-01-01', gapDays: 1, why: 'Across a year end, with no timezone and no locale involved.' },
]

export interface SimilarityVector {
  readonly a: string
  readonly b: string
  readonly maxChars: number
  /** Null where the input exceeds the cap. */
  readonly expectBasisPoints: number | null
  readonly why: string
}

export const SIMILARITY_VECTORS: readonly SimilarityVector[] = [
  {
    a: 'INV-2087',
    b: 'INV-2O87',
    maxChars: CORPUS_SIMILARITY_MAX_CHARS,
    expectBasisPoints: 8750,
    why: 'One substitution over a longest length of eight: round(7/8 × 10000).',
  },
  {
    a: 'INV-1001',
    b: 'INV-1001',
    maxChars: CORPUS_SIMILARITY_MAX_CHARS,
    expectBasisPoints: 10000,
    why: 'Identical strings.',
  },
  {
    a: '',
    b: '',
    maxChars: CORPUS_SIMILARITY_MAX_CHARS,
    expectBasisPoints: 10000,
    why: 'Documented on the function: two empty strings score 10000 rather than dividing by zero.',
  },
  {
    a: 'ABCD',
    b: '',
    maxChars: CORPUS_SIMILARITY_MAX_CHARS,
    expectBasisPoints: 0,
    why: 'Distance 4 over a longest length of 4.',
  },
  {
    a: 'ABC',
    b: 'ABCDE',
    maxChars: CORPUS_SIMILARITY_MAX_CHARS,
    expectBasisPoints: 6000,
    why: 'Two insertions over a longest length of five.',
  },
  {
    a: 'ABC',
    b: 'ABD',
    maxChars: CORPUS_SIMILARITY_MAX_CHARS,
    expectBasisPoints: 6667,
    why: 'round(2/3 × 10000) = 6667. The ONLY rounding in the module, and it is on a similarity score, never on money.',
  },
  {
    a: 'INV-2087',
    b: 'INV-2O87',
    maxChars: 4,
    expectBasisPoints: null,
    why: 'Refused beyond the cap rather than allocating an O(n·m) matrix over an attacker-influenced string.',
  },
]

export interface ItemKeyVector {
  readonly side: PopulationSide
  readonly ref: ItemRef
  readonly expectKey: string
  readonly why: string
}

export const ITEM_KEY_VECTORS: readonly ItemKeyVector[] = [
  {
    side: 'left',
    ref: { sourceDocumentId: 'doc_a' as SourceDocumentId, lineIndex: null },
    expectKey: 'left:5:doc_a:h',
    why: "Header grain is spelled 'h', never 0 — a header is not line zero.",
  },
  {
    side: 'right',
    ref: { sourceDocumentId: 'doc_a' as SourceDocumentId, lineIndex: 0 },
    expectKey: 'right:5:doc_a:0',
    why: 'Line grain. The side prefix is why a left and a right item can never collide.',
  },
  {
    side: 'left',
    ref: { sourceDocumentId: 'doc:a:0' as SourceDocumentId, lineIndex: 1 },
    expectKey: 'left:7:doc:a:0:1',
    why: 'An id containing the delimiter. The LENGTH PREFIX is injective for any content at all, which is why the key needs no assumption about id shape — and why it is plain ASCII rather than the NUL byte the first version used, which made the whole source file binary to grep.',
  },
]

export interface MeterVector {
  readonly name: string
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number; readonly providerRequestId: string }
  readonly expect: readonly { readonly meter: EngineMeter; readonly quantity: number; readonly idempotencyKey: string }[]
  readonly why: string
}

export const TOKEN_METER_VECTORS: readonly MeterVector[] = [
  {
    name: 'a provider-reported pair',
    usage: { inputTokens: 812, outputTokens: 24, providerRequestId: 'req_SYN_0001' },
    expect: [
      { meter: 'input_tokens', quantity: 812, idempotencyKey: 'req_SYN_0001#input_tokens' },
      { meter: 'output_tokens', quantity: 24, idempotencyKey: 'req_SYN_0001#output_tokens' },
    ],
    why: 'THE KEY IS METER-QUALIFIED. One model call produces TWO `UsageRecord` rows, and `/metering/record` is idempotent on `idempotencyKey`: keyed on the provider request id alone the second row is rejected with 409 and OUTPUT TOKENS ARE NEVER COUNTED, in production, silently.',
  },
  {
    name: 'a fractional count',
    usage: { inputTokens: 812.5, outputTokens: 24, providerRequestId: 'req_SYN_0002' },
    expect: [],
    why: 'NEVER ESTIMATED. A computed estimate written into an append-only table with no compensating instrument is fabricated revenue data.',
  },
]

/**
 * Invariant 5 stated as a property of this vector set rather than as a comment:
 * a `MeterFact` carries a meter, a quantity, an idempotency key and a catalogue
 * row. There is no price on it, no rate and no cost, and `UsageRecord` is
 * immutable and unpriced. If anything in a test built from these vectors prices
 * something, the test is wrong.
 */
export const RUN_METER_VECTOR = {
  runId: 'run_SYN_0001' as RunId,
  meter: 'reconciliations_run' as EngineMeter,
  quantity: 1,
  expectIdempotencyKey: 'run_SYN_0001#reconciliations_run',
  expectModelEntryId: null,
} as const

/* ====================================================================== *
 * §Q  THE READER SEAM — outcomes to fold back, and what each one may do
 *
 * These are written against the single request that
 * `freeTextMultiEntityBuildsAReaderRequest` emits: requestOrdinal 0, two
 * candidates, subject on the left. Nothing here calls a model; the outcomes are
 * the values a caller WOULD hand back, and the expectation is what
 * `applyReaderVerdicts` must do with each.
 * ====================================================================== */

const SYNTHETIC_USAGE = {
  inputTokens: 812,
  outputTokens: 24,
  modelEntryId: SYNTHETIC_CATALOGUE_ROW,
  providerRequestId: 'req_SYN_0003',
}

export interface ReaderVector {
  readonly name: string
  readonly outcome: ReaderOutcome
  readonly expectAllocations: number
  /** Cause recorded against the subject, or null where the verdict allocated. */
  readonly expectUnresolved: ResidueCause | null
  readonly expectMeterFacts: number
  readonly why: string
}

export const READER_VECTORS: readonly ReaderVector[] = [
  {
    name: 'the stub',
    outcome: { kind: 'refused', requestOrdinal: 0, refusal: { kind: 'not_implemented' }, usage: null },
    expectAllocations: 0,
    expectUnresolved: { kind: 'reader_refused', refusal: { kind: 'not_implemented' } },
    expectMeterFacts: 0,
    why: "`notImplementedReader` returns a REFUSAL, not a fabricated value. The draft's failure mode was `return []`, which is indistinguishable from 'the model found nothing' — a broken integration then reads as a clean reconciliation.",
  },
  {
    name: 'a confirmed candidate with usage',
    outcome: {
      kind: 'verdict',
      requestOrdinal: 0,
      verdict: { kind: 'candidate', candidateIndex: 0, confidenceBasisPoints: 9200 },
      usage: SYNTHETIC_USAGE,
    },
    expectAllocations: 1,
    expectUnresolved: null,
    expectMeterFacts: 2,
    why: 'The allocation carries `reader_confirmed` with the catalogue row that incurred it. Confidence may ORDER A QUEUE; it may never GATE A DISPOSITION — autonomy is governed by `AutonomyConfig`, never by a model\'s opinion of itself.',
  },
  {
    name: 'a confirmed candidate with NO usage',
    outcome: {
      kind: 'verdict',
      requestOrdinal: 0,
      verdict: { kind: 'candidate', candidateIndex: 0, confidenceBasisPoints: 9200 },
      usage: null,
    },
    expectAllocations: 0,
    expectUnresolved: { kind: 'reader_refused', refusal: { kind: 'contract_violation' } },
    expectMeterFacts: 0,
    why: 'No usage means no `modelEntryId`, and an allocation whose evidence cannot name the catalogue row that produced it is not recordable. It becomes a contract violation rather than an unattributed match.',
  },
  {
    name: 'an index outside the candidate set',
    outcome: {
      kind: 'verdict',
      requestOrdinal: 0,
      verdict: { kind: 'candidate', candidateIndex: 7, confidenceBasisPoints: 9900 },
      usage: SYNTHETIC_USAGE,
    },
    expectAllocations: 0,
    expectUnresolved: { kind: 'reader_refused', refusal: { kind: 'candidate_index_out_of_range' } },
    expectMeterFacts: 2,
    why: 'THE CONTAINMENT ENFORCEMENT POINT. The out-of-range index is converted to a refusal and NOT to a lookup — an undefined candidate silently skipped is A9(d) reintroduced at the seam. The tokens are still metered, because they were still spent.',
  },
  {
    name: 'several candidates fit',
    outcome: {
      kind: 'verdict',
      requestOrdinal: 0,
      verdict: { kind: 'several', candidateIndices: [0, 1], confidenceBasisPoints: 6000 },
      usage: SYNTHETIC_USAGE,
    },
    expectAllocations: 0,
    expectUnresolved: { kind: 'reader_found_no_candidate' },
    expectMeterFacts: 2,
    why: 'FOUR ARMS, NOT FIVE — `several` is the one fact that more than one candidate fits, and it never allocates. The reader confirms a single candidate or says it cannot.',
  },
  {
    name: 'unreadable',
    outcome: {
      kind: 'verdict',
      requestOrdinal: 0,
      verdict: { kind: 'unreadable', confidenceBasisPoints: 1000 },
      usage: null,
    },
    expectAllocations: 0,
    expectUnresolved: { kind: 'reader_found_no_candidate' },
    expectMeterFacts: 0,
    why: 'The honest answer for "CASH DEP 08/12". It is a finding for a human.',
  },
  {
    name: 'a transport failure',
    outcome: { kind: 'refused', requestOrdinal: 0, refusal: { kind: 'transport_failed' }, usage: null },
    expectAllocations: 0,
    expectUnresolved: { kind: 'reader_refused', refusal: { kind: 'transport_failed' } },
    expectMeterFacts: 0,
    why: 'At most one retry on transport, reusing the same idempotency key or it double-meters. Zero retries on a contract violation — retrying with a different prompt is negotiating with the input.',
  },
  {
    name: 'a model the policy rejected',
    outcome: { kind: 'refused', requestOrdinal: 0, refusal: { kind: 'model_rejected_by_policy' }, usage: null },
    expectAllocations: 0,
    expectUnresolved: { kind: 'reader_refused', refusal: { kind: 'model_rejected_by_policy' } },
    expectMeterFacts: 0,
    why: 'Invariant 7 — `resolveModel()` returning `{ ok: false }` is a refusal, never a fallback. `ModelFallbackChain` is @dropped-for-v1.',
  },
  {
    name: 'an outcome for a request that was never made',
    outcome: { kind: 'refused', requestOrdinal: 99, refusal: { kind: 'contract_violation' }, usage: null },
    expectAllocations: 0,
    expectUnresolved: null,
    expectMeterFacts: 0,
    why: 'Unmatched ordinals are ignored rather than guessed at. The subject is unknown, so there is nothing to record it against.',
  },
]

/* ====================================================================== *
 * §R  POST-CONDITION PROBES — the checks that must be seen RED
 *
 * ⚠️ `gross = residual + Σ allocations` is a TAUTOLOGY here and catches nothing,
 * on any input, ever: residual is DERIVED by folding allocations. The
 * load-bearing post-condition is residue completeness. These three probes
 * corrupt a sound result in the three ways that matter and state what
 * `checkPostconditions` must report — the only way to know the check is not
 * itself §5.6.
 *
 * They are described against `leftoverCashLandsInResidue`, whose sound run
 * admits 35000 minor units in total: obligations of 10000 and 5000, and cash of
 * 20000 of which 5000 is carried in the residue.
 * ====================================================================== */

export type PostconditionProbeMutation = 'drop_open_item' | 'duplicate_entry' | 'add_closed_item'

export interface PostconditionProbe {
  readonly name: string
  readonly scenario: string
  readonly mutation: PostconditionProbeMutation
  /** Which residue entry the mutation targets. */
  readonly target: ItemAddress
  readonly expect: readonly PostconditionFailure[]
  readonly why: string
}

export const POSTCONDITION_PROBES: readonly PostconditionProbe[] = [
  {
    name: 'an open item dropped from the residue',
    scenario: 'leftoverCashLandsInResidue',
    mutation: 'drop_open_item',
    target: s7Cash,
    expect: [
      { kind: 'open_item_missing_from_residue', count: 1 },
      /* 35000 admitted; 30000 accounted once the cash row's 5000 residual is no
       * longer carried anywhere. The two figures come from INDEPENDENT sources,
       * which is why this one can fail at all. */
      { kind: 'gross_not_partitioned', admittedMinor: 35_000n, accountedMinor: 30_000n },
    ],
    why: 'This IS A9(b) — under an append-only ledger, losing money means dropping an item from the RESIDUE, and the conservation identity still holds because the money is lost from the residue and not from the ledger.',
  },
  {
    name: 'one item in the residue twice',
    scenario: 'leftoverCashLandsInResidue',
    mutation: 'duplicate_entry',
    target: s7Cash,
    expect: [{ kind: 'item_in_residue_twice', count: 1 }],
    why: 'A partition is a partition. The gross check is unaffected, because presence in the residue is a boolean and not a count — so this failure has to be reported in its own right or it is not reported at all.',
  },
  {
    name: 'a fully allocated item listed in the residue',
    scenario: 'leftoverCashLandsInResidue',
    mutation: 'add_closed_item',
    target: s7Inv101,
    expect: [{ kind: 'fully_allocated_item_in_residue', count: 1 }],
    why: 'A closed obligation on the exceptions list is a false positive an operator would chase. The gross figures still agree, so again this needs its own check.',
  },
]

/* ====================================================================== *
 * §S  ALLOCATION PROBES — every arm of `AllocationRefusal`
 *
 * Written against the admitted state of `cleanIdentifierMatch` BEFORE any pass
 * runs: one left item of 12500 and one right item of 12500, no allocations.
 * ====================================================================== */

export interface AllocationProbe {
  readonly name: string
  readonly from: ItemAddress | 'unknown'
  readonly to: ItemAddress | 'unknown'
  readonly amount: Money
  readonly expect:
    | { readonly ok: true; readonly amountMinor: bigint }
    | { readonly ok: false; readonly refusal: 'unknown_item' | 'same_side' | 'non_positive_amount' | 'would_over_allocate' | 'money' }
  readonly why: string
}

export const ALLOCATION_PROBES: readonly AllocationProbe[] = [
  {
    name: 'a valid pour',
    from: s1Payment,
    to: s1Invoice,
    amount: mny(125_00n),
    expect: { ok: true, amountMinor: 125_00n },
    why: 'Appends one allocation and returns a FRESH state. It never mutates the state it was given.',
  },
  {
    name: 'an item that is not in the run',
    from: 'unknown',
    to: s1Invoice,
    amount: mny(1n),
    expect: { ok: false, refusal: 'unknown_item' },
    why: 'Checked first, before anything else touches money.',
  },
  {
    name: 'both ends on the same side',
    from: s1Invoice,
    to: s1Invoice,
    amount: mny(1n),
    expect: { ok: false, refusal: 'same_side' },
    why: 'An allocation crosses the two populations by definition; a same-side pour would net two invoices against each other.',
  },
  {
    name: 'a zero amount',
    from: s1Payment,
    to: s1Invoice,
    amount: mny(0n),
    expect: { ok: false, refusal: 'non_positive_amount' },
    why: 'A zero allocation is a row that says nothing and still changes the audit.',
  },
  {
    name: 'a negative amount',
    from: s1Payment,
    to: s1Invoice,
    amount: mny(-1n),
    expect: { ok: false, refusal: 'non_positive_amount' },
    why: 'Reversal is not this function. `Exception.reversals` is an array elsewhere in the model precisely so that a reversal is a record rather than a sign.',
  },
  {
    name: 'more than the residual',
    from: s1Payment,
    to: s1Invoice,
    amount: mny(200_00n),
    expect: { ok: false, refusal: 'would_over_allocate' },
    why: 'There is deliberately NO `over_allocated` settlement member: over-allocation is a REFUSAL carrying both numbers (requested 20000, residual 12500), not a state something can be left in. §5.5 — do not make the invalid state legal.',
  },
  /* 🛑 A PROBE STOOD HERE AND ITS INPUT IS NO LONGER CONSTRUCTIBLE — G286,
   * 19 Sep 2026. Quoted rather than erased:
   *
   *     name:   'a fractional amount'
   *     amount: { currency: 'SGD', amountMinor: 100.5, exponent: 2 }
   *     expect: { ok: false, refusal: 'money' }
   *     why:    'The money guard runs before the sign check and before the
   *              residual check.'
   *
   * The ORDER it witnessed is the thing worth keeping, and the probe below keeps
   * it with an amount that is still refusable: one past the storable range, which
   * is also positive and also larger than the residual — so if the money guard
   * did NOT run first, this would report `would_over_allocate` instead.
   */
  {
    name: 'an amount past the storable range',
    from: s1Payment,
    to: s1Invoice,
    amount: mny(9_223_372_036_854_775_808n),
    expect: { ok: false, refusal: 'money' },
    why: 'The money guard runs before the sign check and before the residual check — and this amount would ALSO fail the residual check, so reporting `money` is the ordering being witnessed rather than the only answer available.',
  },
]

/* ====================================================================== *
 * §T  PASS PROBES — the four exported passes, called directly
 *
 * `runSetReconciliation` reaches all four, but only through whichever
 * `PairingSpec` a scenario declares, so several arms of `arityPermits` and the
 * whole of `PassOutcome.toleranceRefusals` are unreachable from the fold. These
 * probes call each pass on its own, against an admitted state with no
 * allocations in it.
 *
 * `admittedStateFor` is the corpus supplying a construction site, not a second
 * implementation: it calls the module's own `admitPopulation` and does exactly
 * what `runSetReconciliation` does with the two results.
 * ====================================================================== */

export function admittedStateFor(scenario: Scenario): MatchingState {
  const input = scenario.input
  const context = {
    fieldClassification: input.fieldClassification,
    modelPromptEligible: input.modelPromptEligible,
    confidenceFloors: input.confidenceFloors,
  }
  const left = admitPopulation('left', input.leftDocuments, input.left, context)
  const right = admitPopulation('right', input.rightDocuments, input.right, context)
  const items = new Map<string, AdmittedItem>()
  for (const item of [...left.admitted, ...right.admitted]) {
    /* 🛑 C17 — THE THIRD COPY OF THE LOSSY FOLD, AND IT IS IN THE FIXTURES.
     * `runSetReconciliation` refuses a duplicated address before it folds, and
     * `checkPopulationIntegrity` is the reason it can. This helper has no
     * refusal to return — it hands a `MatchingState` to a pass probe — so it
     * THROWS, which is the fixture-level equivalent: a silent `Map.set`
     * overwrite here would delete a row from a probe's state and every
     * expectation downstream would be measured against a population one row
     * short. No scenario reaches this today; that is an argument, and this is a
     * control. */
    if (items.has(item.key)) {
      throw new Error(
        `admittedStateFor(${scenario.name}): two admitted items share the address ${item.key}. ` +
          'C17 — the engine refuses this before folding; a fixture may not fold it silently.',
      )
    }
    items.set(item.key, item)
  }
  return { items, allocations: [] }
}

export interface ExpectedPassAllocation {
  readonly from: ItemAddress
  readonly to: ItemAddress
  /* ⚠️ `bigint` since 19 Sep 2026 — G286. A minor-unit EXPECTATION is money
   * and carries money's representation. The VALUES are unchanged. */
  readonly amountMinor: bigint
  readonly evidence: PairingEvidence
}

export interface ExpectedPassOutcome {
  readonly allocations: readonly ExpectedPassAllocation[]
  readonly ambiguities: readonly ExpectedAmbiguity[]
  readonly toleranceRefusals: readonly ToleranceRefusal[]
}

export interface IdentifierJoinProbe {
  readonly name: string
  readonly scenario: Scenario
  readonly on: FieldPath
  readonly tolerance: Tolerance
  readonly direction: ToleranceDirection
  readonly cardinality: PairingCardinality
  readonly expect: ExpectedPassOutcome
  readonly why: string
}

const WIDE_MONEY_TOLERANCE: Tolerance = { kind: 'money', value: mny(500_00n) }

/**
 * All four `arityPermits` arms over one state: two left rows sharing the
 * identifier `INV-3050`, one right row carrying it.
 *
 * ⚠️ The wide tolerance in the last two is a PROBE VALUE, sized to make the
 * aggregate comparison admit. No definition should carry it and no document may
 * cite it as a recommendation.
 */
export const IDENTIFIER_JOIN_PROBES: readonly IdentifierJoinProbe[] = [
  {
    name: 'one_to_one declines 2×1',
    scenario: duplicateIdentifierIsAnAmbiguity,
    on: PATHS.reference,
    tolerance: EXACT_MONEY,
    direction: 'symmetric',
    cardinality: 'one_to_one',
    expect: {
      allocations: [],
      ambiguities: [
        {
          on: PATHS.reference,
          strategyKind: 'exact_identifier',
          leftCandidates: 2,
          rightCandidates: 1,
          leftRefs: [s8First.ref, s8Second.ref],
          rightRefs: [s8Credit.ref],
        },
      ],
      toleranceRefusals: [],
    },
    why: 'Pairs only 1×1. Anything else is a finding and both sides go to the residue.',
  },
  {
    name: 'one_to_many also declines 2×1',
    scenario: duplicateIdentifierIsAnAmbiguity,
    on: PATHS.reference,
    tolerance: EXACT_MONEY,
    direction: 'symmetric',
    cardinality: 'one_to_many',
    expect: {
      allocations: [],
      ambiguities: [
        {
          on: PATHS.reference,
          strategyKind: 'exact_identifier',
          leftCandidates: 2,
          rightCandidates: 1,
          leftRefs: [s8First.ref, s8Second.ref],
          rightRefs: [s8Credit.ref],
        },
      ],
      toleranceRefusals: [],
    },
    why: 'Pairs only 1×N — the LEFT side must be the singleton, and here it is not.',
  },
  {
    name: 'many_to_one permits 2×1, and the aggregate is then compared',
    scenario: duplicateIdentifierIsAnAmbiguity,
    on: PATHS.reference,
    tolerance: EXACT_MONEY,
    direction: 'symmetric',
    cardinality: 'many_to_one',
    expect: { allocations: [], ambiguities: [], toleranceRefusals: [] },
    why: 'THE ARITY PERMITS IT AND THE MONEY DOES NOT. The join compares the SUM of each side — 100000 against 50000 — so a zero tolerance declines, with no ambiguity recorded because the shape was never in question.',
  },
  {
    name: 'many_to_one pours the aggregate when the tolerance admits it',
    scenario: duplicateIdentifierIsAnAmbiguity,
    on: PATHS.reference,
    tolerance: WIDE_MONEY_TOLERANCE,
    direction: 'symmetric',
    cardinality: 'many_to_one',
    expect: {
      allocations: [
        {
          from: s8Credit,
          to: s8First,
          amountMinor: 500_00n,
          evidence: { kind: 'tolerant_identifier', on: PATHS.reference, signedVarianceMinor: 500_00n },
        },
      ],
      ambiguities: [],
      toleranceRefusals: [],
    },
    why: 'Oldest first: the whole payment lands on the earlier of the two duplicate rows and the later one stays fully open. The signed variance of 50000 is recorded on the allocation, so the shortfall stays recoverable.',
  },
  {
    name: 'many_to_many permits it because the right side is a singleton',
    scenario: duplicateIdentifierIsAnAmbiguity,
    on: PATHS.reference,
    tolerance: WIDE_MONEY_TOLERANCE,
    direction: 'symmetric',
    cardinality: 'many_to_many',
    expect: {
      allocations: [
        {
          from: s8Credit,
          to: s8First,
          amountMinor: 500_00n,
          evidence: { kind: 'tolerant_identifier', on: PATHS.reference, signedVarianceMinor: 500_00n },
        },
      ],
      ambiguities: [],
      toleranceRefusals: [],
    },
    why: 'The ruling nobody had taken: `many_to_many` pairs only where AT LEAST ONE side is a singleton. An identifier repeating on both sides names no unique pair and `amount_sum` gets it instead.',
  },
]

export interface AmountAndDateProbe {
  readonly name: string
  readonly scenario: Scenario
  readonly amountTolerance: Tolerance
  readonly dateTolerance: Tolerance
  readonly direction: ToleranceDirection
  readonly expect: ExpectedPassOutcome
  readonly why: string
}

export const AMOUNT_AND_DATE_PROBES: readonly AmountAndDateProbe[] = [
  {
    name: 'a single candidate in the window allocates',
    scenario: amountAndDateWithinWindow,
    amountTolerance: EXACT_MONEY,
    dateTolerance: FIVE_DAYS,
    direction: 'symmetric',
    expect: {
      allocations: [
        {
          from: s13CreditAt,
          to: s13InvoiceAt,
          amountMinor: 250_00n,
          evidence: { kind: 'amount_and_date', dayGap: 3 },
        },
      ],
      ambiguities: [],
      toleranceRefusals: [],
    },
    why: 'The same outcome the fold produces, reached without the fold.',
  },
  {
    name: 'a date tolerance of the wrong kind disables the pass entirely',
    scenario: amountAndDateWithinWindow,
    amountTolerance: EXACT_MONEY,
    dateTolerance: EXACT_MONEY,
    direction: 'symmetric',
    expect: { allocations: [], ambiguities: [], toleranceRefusals: [] },
    why: 'Only a `days` tolerance drives this pass. Anything else returns the state untouched rather than defaulting to a window somebody did not choose.',
  },
  {
    name: 'a float money tolerance is REFUSED and the refusal is reported',
    scenario: amountAndDateWithinWindow,
    amountTolerance: { kind: 'absolute', value: 15 },
    dateTolerance: FIVE_DAYS,
    direction: 'symmetric',
    expect: {
      allocations: [],
      ambiguities: [],
      toleranceRefusals: [{ kind: 'float_money_tolerance', arm: 'absolute' }],
    },
    why: 'THE ONLY PATH IN THE CORPUS THAT POPULATES `PassOutcome.toleranceRefusals`. A pack author who writes an `absolute` tolerance gets a run that pairs nothing and says why, rather than a silent float multiply on money.',
  },
]

export interface FuzzyProbe {
  readonly name: string
  readonly scenario: Scenario
  readonly on: FieldPath
  readonly minSimilarity: number
  readonly metric: SimilarityMetric
  readonly maxChars: number
  readonly expect: ExpectedPassOutcome
  readonly why: string
}

export const FUZZY_PROBES: readonly FuzzyProbe[] = [
  {
    name: 'one candidate above threshold',
    scenario: typoAmountAnchoredFuzzy,
    on: PATHS.reference,
    minSimilarity: 0.85,
    metric: 'levenshtein_ratio',
    maxChars: CORPUS_SIMILARITY_MAX_CHARS,
    expect: {
      allocations: [
        {
          from: s4Typo,
          to: s4Invoice,
          amountMinor: 3412_00n,
          evidence: { kind: 'fuzzy_reference', similarityBasisPoints: 8750, metric: 'levenshtein_ratio' },
        },
      ],
      ambiguities: [],
      toleranceRefusals: [],
    },
    why: 'The decoy is in the same amount bucket and scores 1250, so it never becomes a candidate.',
  },
  {
    name: 'a threshold above every score pairs nothing',
    scenario: typoAmountAnchoredFuzzy,
    on: PATHS.reference,
    minSimilarity: 0.9,
    metric: 'levenshtein_ratio',
    maxChars: CORPUS_SIMILARITY_MAX_CHARS,
    expect: { allocations: [], ambiguities: [], toleranceRefusals: [] },
    why: '8750 is below a 9000 threshold. The comparison is in basis points precisely so a boundary is not decided by float equality.',
  },
  {
    name: 'a character cap below the input pairs nothing',
    scenario: typoAmountAnchoredFuzzy,
    on: PATHS.reference,
    minSimilarity: 0.85,
    metric: 'levenshtein_ratio',
    maxChars: 4,
    expect: { allocations: [], ambiguities: [], toleranceRefusals: [] },
    why: 'The bound is on the input, not on the work done, so it refuses before allocating the matrix.',
  },
]

export interface AmountSumProbe {
  readonly name: string
  readonly scenario: Scenario
  readonly obligationSide: PopulationSide
  readonly bound: SubsetSumBound
  readonly expectAllocations: readonly ExpectedPassAllocation[]
  readonly expectOversizedBuckets: readonly ExpectedSearchBoundaryEntry[]
  readonly why: string
}

export const AMOUNT_SUM_PROBES: readonly AmountSumProbe[] = [
  {
    name: 'the waterfall, leaving cash open',
    scenario: leftoverCashLandsInResidue,
    obligationSide: 'left',
    bound: CORPUS_SUBSET_SUM_BOUND,
    expectAllocations: [
      {
        from: s7Cash,
        to: s7Inv101,
        amountMinor: 100_00n,
        evidence: { kind: 'amount_sum_waterfall', fellThroughFrom: 'no_exact_solution' },
      },
      {
        from: s7Cash,
        to: s7Inv102,
        amountMinor: 50_00n,
        evidence: { kind: 'amount_sum_waterfall', fellThroughFrom: 'no_exact_solution' },
      },
    ],
    expectOversizedBuckets: [],
    why: 'The pass alone, with the same result the fold reaches.',
  },
  {
    name: 'a bucket over the bound is reported and skipped',
    scenario: leftoverCashLandsInResidue,
    obligationSide: 'left',
    bound: { maxMembers: 8, stepBudget: 5000, maxBucketSize: 1 },
    expectAllocations: [],
    /* G217 — the counterparty name is gone from the expectation for the reason
     * the ruling gives: it is text out of a counterparty's file. */
    expectOversizedBuckets: [{ itemCount: 3, example: s7Inv101 }],
    why: 'Two obligations and one cash row in the bucket, a bound of one. Reported as a COUNT and an ADDRESS so an operator can open the bucket without the summary carrying its key.',
  },
  {
    name: 'the obligation side is a parameter, not an assumption',
    scenario: leftoverCashLandsInResidue,
    obligationSide: 'right',
    bound: CORPUS_SUBSET_SUM_BOUND,
    expectAllocations: [
      {
        from: s7Inv101,
        to: s7Cash,
        amountMinor: 100_00n,
        evidence: { kind: 'amount_sum_waterfall', fellThroughFrom: 'no_exact_solution' },
      },
      {
        from: s7Inv102,
        to: s7Cash,
        amountMinor: 50_00n,
        evidence: { kind: 'amount_sum_waterfall', fellThroughFrom: 'no_exact_solution' },
      },
    ],
    expectOversizedBuckets: [],
    why: 'Declaring the ledger to be the CASH side inverts the pour: the two invoices are now poured into the 20000 row, which stays open for 5000. The engine is domain-neutral and this is what that costs and buys — nothing about "invoice" or "payment" is wired in.',
  },
]

/**
 * ⚠️ TOTALITY, NOT A COUNT. `ExtractionOp` is a closed union and
 * `EXTRACTION_OP_KINDS` is its value-level mirror. A test should assert that
 * every value in that const appears in this list — so adding a fifth op to the
 * module without a vector here becomes a failure rather than a silent gap. This
 * is the only place in the corpus that checks the module's own closed unions for
 * coverage, and the same shape is owed for `Normaliser`, `Tolerance`,
 * `AdmissionRefusal` and `ResidueCause`.
 */
export const EXTRACTION_OP_KINDS_COVERED: readonly string[] = [
  'trim',
  'strip_leading_zeros',
  'strip_literal',
  'split_take',
]

/* ====================================================================== *
 * §U  WHERE THE CORPUS AND THE MODULE DISAGREE AT HEAD
 *
 * 🛑 DO NOT RESOLVE ONE OF THESE BY EDITING THE EXPECTATION. The expectation is
 * what the specification requires; the disagreement is the finding. Either the
 * module changes or the ruling changes, and the second needs an owner.
 * ====================================================================== */

export interface KnownDisagreement {
  readonly scenario: string
  readonly what: string
  readonly moduleDoesAtHead: string
  readonly whyTheCorpusIsWritten: string
  readonly consequence: string
}

export const KNOWN_DISAGREEMENTS_AT_HEAD: readonly KnownDisagreement[] = [
  /* ✅ EMPTY, AND THAT IS THE POINT — IT WAS NOT EMPTY WHEN THIS CORPUS WAS WRITTEN.
   *
   * One entry sat here: `fuzzyTieIsAnAmbiguity`, recording that
   * `passFuzzyReference` raised an `AmbiguityFinding` with `rightCandidates: 2`
   * beside a `rightRefs` array of length ONE, so the finding contradicted itself
   * on a single object. Its recorded consequence was exact:
   *
   *   "runSetReconciliation attributes `identifier_ambiguous` only to refs NAMED
   *    in a finding, so the second tied candidate lands in the residue as
   *    `no_strategy_paired` — 'nothing matched it' — when it was in fact one of
   *    two equally scoring candidates for the same payment. Two rows in the same
   *    tie get two different reasons, and only one of them is true."
   *
   * THE CORPUS WAS WRITTEN TO THE SPECIFICATION AND LEFT RED. It was not bent to
   * match the module, and the module was fixed on 9 Aug 2026 — `tiedItems`
   * replaces the `tied` counter and the finding now names every candidate, as
   * both sibling passes always did. The scenario is back in the sweeps.
   *
   * Leave this array in place rather than deleting it. It is the register a
   * future disagreement gets recorded in, and an empty register that has been
   * used once is worth more than no register. */
]

/* ====================================================================== *
 * §V  WHAT THIS CORPUS DOES NOT COVER — stated, so nobody infers coverage
 *
 * Read this before reporting a coverage number from a run over these scenarios.
 * ====================================================================== */

export const KNOWN_GAPS: readonly string[] = [
  'Determinism across two runs is asserted in prose on `badDateAndSameDayTieBreak` and is not itself a scenario. Running the same input twice and comparing the allocation SEQUENCE is a separate test and it is still owed.',
  'Input immutability (A9(e)) is not expressed here at all. The witness is to `Object.freeze` every document, every `extracted` record and every `lines` array before the run — the corpus supplies the documents, not the freezing.',
  'The compile-time containment proofs (`AssertNoTextDeep` over `ReaderVerdict`, `ReaderRefusal`, `MoneyRefusal` and the rest) cannot be reached by any value in this file. They are `tsc` obligations and must be verified RED by adding a `string` field, then green by removing it.',
  'No scenario exercises `budget_exhausted` on the subset-sum fall-through. It needs a bucket large enough to blow a step budget, which would make the fixture unreadable; the `no_exact_solution` arm is covered and the two are distinguished only by the recorded reason.',
  '`applyReaderVerdicts` is exercised through the vectors in §Q, which describe outcomes a caller would hand back. Nothing here calls a model, and no test built from this file may claim the seam is integrated.',
  'All four `arityPermits` arms and `PassOutcome.toleranceRefusals` are reached ONLY through §T\'s pass probes, never through `runSetReconciliation`. A test suite that runs the scenarios and skips the probes reaches neither.',
  'Only `EXTRACTION_OP_KINDS` has a totality list (§T). `Normaliser`, `Tolerance`, `AdmissionRefusal`, `ResidueCause` and `ReaderRefusal` are each closed unions whose members are covered by hand here, so a member added to any of them is a silent gap.',
  '⚠️ NARROWED BY C16, NOT CLOSED. This read *"No scenario mixes exponents within one population — every amount is exponent 2. A JPY population (exponent 0) is covered only by the money vectors."* `mixedExponentIsRefusedAtAdmission` now mixes exponents within one population and `refusesDeclaredUnitsDisagreeAcrossSides` mixes them across two. What is still uncovered: no scenario runs a population DECLARED at exponent 0 end to end and matches inside it, so an exponent-0 close is exercised only by the money vectors and by the declared-unit fixture.',
  'Nothing here reaches a `SourceDocument` with both header fields AND lines. `admitPopulation` branches on `lines.length === 0`, and a document carrying both is header-blind by that branch — which is the module\'s stated behaviour and not a defect, but it is untested.',
]

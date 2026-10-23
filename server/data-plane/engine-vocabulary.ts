/**
 * THE ENGINE'S CLOSED VOCABULARIES, NARROWED AT THE READ BOUNDARY. G284's other
 * half, 19 Sep 2026.
 *
 * ┌─ THE HOLE THIS FILLS, AND IT IS `run-vocabulary.ts`'s HOLE ONE GRAIN DOWN ──┐
 * │ `db/migrations/0007_run_engine_account.sql` declines a CHECK constraint on  │
 * │ every vocabulary column it creates — sixteen of them — and gives            │
 * │ `0002_run.sql`'s reason: a third copy of a closed enum "would be a third    │
 * │ place to drift — and the one nothing checks, because no pair in the         │
 * │ wire-mirror addresses SQL."                                                 │
 * │                                                                            │
 * │ That argument is right and it leaves the same gap `run.status` left:        │
 * │ NOTHING stands between an unconstrained `text` column and the wire.         │
 * │ `fast-json-stringify` SERIALISES a response, it does not validate one, so   │
 * │ an out-of-enum `cause_kind` in the row is an out-of-enum `cause.kind` in    │
 * │ the body and the consumer meets a word its own contract says cannot occur.  │
 * │                                                                            │
 * │ So the check goes where it can be DERIVED instead of copied: here, against  │
 * │ the model. **Every record below is keyed `Record<Union['kind'], true>`, so  │
 * │ an arm added to a model union is a `TS2741` in this file** rather than a    │
 * │ list somebody forgot.                                                       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THAT IS NOT HYPOTHETICAL. **G291 added `amount_tolerance_declined` to
 *    `ResidueCause` on the same day this file landed** — the thirteenth member
 *    of a vocabulary that had eleven in August. A hand-written list would have
 *    been the list nobody updated, and the failure mode is an operator handed a
 *    cause the product's own types cannot name.
 *
 * ⚠️ A TOTAL RECORD IS TOTAL, NOT EXACT — `run-vocabulary.ts` records the same
 *    caveat, verified there by mutation. A record here can GAIN a key the union
 *    does not have, because a computed key raises no excess-property error.
 *    What it cannot do is LOSE one, and that is the only direction that would
 *    let an unmodelled value onto the wire.
 *
 * 🛑 ONE VOCABULARY IS DELIBERATELY NOT DECLARED HERE, AND IT IS THE BEST ONE.
 *    `PostconditionFailure['kind']` is the KEY SET of `POSTCONDITION_PROPERTY`,
 *    a total record `model/reconciliation.ts` already constructs and already
 *    ships. Restating it would be a second copy of a list that exists (§5.3),
 *    so `isPostconditionKind()` asks the model's own object. **Do not "fix" it
 *    into the pattern.**
 *
 * ⚠️ AND `run-vocabulary.ts`'s OPENING SENTENCE — *"THE ONE PLACE `server/`
 *    MEETS `model/`, AND IT IS DELIBERATELY ONE PLACE"* — WAS ALREADY FALSE
 *    BEFORE THIS FILE EXISTED, and is corrected there rather than here.
 *    `server/data-plane/authorise.ts` has imported `model/access.ts` since
 *    G200's gate landed on 19 Sep 2026. This file is the THIRD meeting point,
 *    not the second, and the property that survives is the one that was always
 *    load-bearing: **a vocabulary is derived from the model, never transcribed
 *    beside it.**
 */

import { POSTCONDITION_PROPERTY } from '../../model/reconciliation.ts'
import type {
  AdmissionRefusal,
  AmountAnchor,
  CompletenessFinding,
  DocumentTrailerVerdict,
  EngineAssignableDisposition,
  EngineMeter,
  ExtractionOp,
  ExtractionRefusal,
  ItemSettlement,
  PairingEvidence,
  PopulationBinding,
  PopulationDefect,
  PopulationSide,
  NormalisationDefect,
  PostconditionFailure,
  ReaderRefusal,
  SetReconciliationRefusal,
  ResidueCause,
  SimilarityMetric,
  TerminalRunStatus,
  ToleranceDirection,
} from '../../model/reconciliation.ts'
import type {
  ControlTotal,
  ExtractedScalar,
  Normaliser,
  PairingCardinality,
  PairingStrategy,
  Tolerance,
} from '../../model/domain.ts'
import type { MoneyRefusal } from '../../model/money.ts'

/**
 * The three states a FINISHED run may be in. `queued` and `running` are not
 * reachable on an engine account — *"a statement about the input rather than an
 * omission"* — and this narrowing is what stops a stored row carrying one of
 * them onto a wire whose enum has three members.
 */
const TERMINAL_RUN_STATUS: Readonly<Record<TerminalRunStatus, true>> = {
  completed: true,
  failed: true,
  incomplete: true,
}

const POPULATION_SIDE: Readonly<Record<PopulationSide, true>> = { left: true, right: true }

/** `ControlTotal['kind']` — the PARSER's arm, verbatim, per document. */
const CONTROL_TOTAL_KIND: Readonly<Record<ControlTotal['kind'], true>> = {
  declared: true,
  not_declared_by_format: true,
  expected_but_absent: true,
}

const TRAILER_VERDICT_KIND: Readonly<Record<DocumentTrailerVerdict['kind'], true>> = {
  nothing_to_check: true,
  agreed: true,
  reported: true,
  not_evaluated_address_collision: true,
}

const POPULATION_DEFECT_KIND: Readonly<Record<PopulationDefect['kind'], true>> = {
  duplicate_item_address: true,
  admission_refusal_rate_above_ceiling: true,
  control_total_declared_nothing: true,
  declared_line_count_disagrees: true,
  control_total_unverifiable_rows_refused: true,
  control_total_not_evaluable: true,
  declared_control_total_disagrees: true,
  control_total_arm_disagrees_with_document_type: true,
}

/**
 * ⚠️ EIGHT ARMS, AND THE EIGHTH IS OQ-1's `amount_not_exact_money`. It refuses
 * an amount that cannot be added, subtracted or compared AT ALL — the opposite
 * of a held read, where the value is exactly what must be seen.
 */
const ADMISSION_REFUSAL_KIND: Readonly<Record<AdmissionRefusal['kind'], true>> = {
  field_not_classified: true,
  field_absent: true,
  amount_not_money: true,
  date_not_extractable: true,
  date_not_iso_calendar: true,
  identifier_not_extractable: true,
  money_unit_disagrees_with_declared: true,
  amount_not_exact_money: true,
}

const EXTRACTION_REFUSAL_KIND: Readonly<Record<ExtractionRefusal['kind'], true>> = {
  input_exceeds_max_chars: true,
  segment_index_out_of_range: true,
  empty_after_ops: true,
  normaliser_not_implemented: true,
}

/**
 * WHY A RUN PRODUCED NOTHING — `db/migrations/0190`'s `run_refusal.kind`.
 * G1515, 21 Sep 2026.
 *
 * 🛑 TWELVE ARMS, AND THE TWO THAT ARE **NOT** HERE ARE THE POINT.
 *    `'pairing'` and `'strategy_binding'` are the discriminants of the NESTED
 *    union inside `tolerance_unit_disagrees` and are NOT members of
 *    `SetReconciliationRefusal`. `docs/contracts/capability.openapi.yaml` records
 *    that #186's wire-mirror harvested them as outer arms until 16 Aug 2026 and
 *    states the prohibition in its own voice: *"`RunRefusalKind` above must
 *    never contain them."* **This record is the TypeScript half of that
 *    sentence**, and because it is total over the model's own union, adding
 *    either one here is a `TS2353` rather than a phantom the wire quietly grows.
 */
const RUN_REFUSAL_KIND: Readonly<Record<SetReconciliationRefusal['kind'], true>> = {
  cross_tenant_documents: true,
  strategy_binding_count_mismatch: true,
  strategy_binding_kind_mismatch: true,
  normalisation_invalid: true,
  reader_candidate_cap_not_stated: true,
  similarity_max_chars_not_stated: true,
  subset_sum_bound_not_stated: true,
  admission_refusal_ceiling_not_stated: true,
  declared_unit_invalid: true,
  declared_units_disagree: true,
  tolerance_unit_disagrees: true,
  population_integrity_refused: true,
  /**
   * 🛑 THESE THREE ARE THE RECORD EARNING ITS KEEP, AND IT IS THE SECOND TIME
   * IN THIS FILE. The twelve above were transcribed from a `grep` over
   * `model/reconciliation.ts` whose window stopped here, and `tsc` answered
   * `TS2739: … is missing the following properties: admitted_item_key_collision,
   * control_total_expected_but_absent, population_empty_and_not_expected`.
   * **`MONEY_REFUSAL_KIND` records the identical failure three declarations up**
   * — six-sevenths of a union, caught by the compiler rather than by a person —
   * and `db/migrations/0190`'s header records what it would have cost here: a
   * schema with nowhere to put three of the engine's fifteen refusals.
   */
  admitted_item_key_collision: true,
  control_total_expected_but_absent: true,
  population_empty_and_not_expected: true,
}

/** `normalisation_invalid`'s list — `0190` §2's `kind`. */
const NORMALISATION_DEFECT_KIND: Readonly<Record<NormalisationDefect['kind'], true>> = {
  max_input_chars_not_stated: true,
  empty_separator: true,
  empty_literal: true,
  negative_index: true,
  non_integer_index: true,
}

/**
 * WHICH tolerance disagreed — `0190`'s `tolerance_route`.
 *
 * ⚠️ IT IS TYPED OFF THE NESTED UNION ITSELF rather than written as two
 *    literals, so it cannot drift from the thing it mirrors — and the COLUMN is
 *    called `tolerance_route` rather than `tolerance_kind` precisely so nobody
 *    reads these two values as run-refusal kinds. See `RUN_REFUSAL_KIND`.
 */
type ToleranceRoute = Extract<
  SetReconciliationRefusal,
  { kind: 'tolerance_unit_disagrees' }
>['tolerance']['kind']

const TOLERANCE_ROUTE: Readonly<Record<ToleranceRoute, true>> = {
  pairing: true,
  strategy_binding: true,
}

const MONEY_REFUSAL_KIND: Readonly<Record<MoneyRefusal['kind'], true>> = {
  currency_mismatch: true,
  exponent_mismatch: true,
  not_integer_minor_units: true,
  exceeds_exact_integer_range: true,
  currency_not_stated: true,
  exponent_not_a_non_negative_integer: true,
  /**
   * ⚠️ THE SEVENTH, AND THIS RECORD CAUGHT ITS OWN ABSENCE BEFORE A HUMAN DID.
   * The first six were transcribed from a `grep` over `model/money.ts` whose
   * window stopped one arm short, and `tsc` answered `TS2741: Property
   * 'no_items' is missing`. **That is the argument for a total `Record` made by
   * the compiler instead of by a paragraph** — and it is recorded rather than
   * quietly fixed, because a transcription that is six-sevenths right is exactly
   * the drift this file exists to catch, arriving while the file was being
   * written to catch it.
   *
   * ⚠️ AND THE ARM IS NOT DEAD WEIGHT. `model/money.ts` records it as
   * *"UNREACHABLE FROM C18 TODAY, said plainly rather than implied by
   * coverage"* — it exists *"because the OLD answer was a lie, not because a
   * fixture reaches it: a refusal that names the wrong cause is worse than one
   * nobody sees."*
   */
  no_items: true,
}

const EXTRACTED_SCALAR_KIND: Readonly<Record<ExtractedScalar['kind'], true>> = {
  text: true,
  number: true,
  date: true,
  money: true,
  identifier: true,
  absent: true,
}

/**
 * ⚠️ FOUR, NOT FIVE, AND THE FIFTH CANDIDATE IS A TRAP THAT SITS TWENTY LINES
 * AWAY IN `model/domain.ts`: `n_way_document_match` is an `ArchetypeConfig` arm,
 * not a `PairingStrategy` one. The wire's `PairingStrategyKind` enum has exactly
 * these four, and the `pairing_strategy_kinds` wire pair reads the DECLARATION
 * rather than the projection *"because a pair against a restatement compares a
 * copy with itself."*
 */
const PAIRING_STRATEGY_KIND: Readonly<Record<PairingStrategy['kind'], true>> = {
  exact_identifier: true,
  amount_and_date: true,
  amount_sum: true,
  fuzzy_reference: true,
}

const COMPLETENESS_FINDING_KIND: Readonly<Record<CompletenessFinding['kind'], true>> = {
  rows_presented_not_admitted: true,
  source_self_report_unmet: true,
}

/**
 * ⚠️ NOT `Meter`, AND THE TWO MUST NOT BE MERGED. `Meter` is the BILLING
 * vocabulary, eight values on the foundation and control-plane tiers; these four
 * are a STRICT SUBSET, and the other four have producers this engine is not.
 */
const ENGINE_METER: Readonly<Record<EngineMeter, true>> = {
  input_tokens: true,
  output_tokens: true,
  reconciliations_run: true,
  exceptions_raised: true,
}

/**
 * ⚠️ THREE OF THE SIX DISPOSITIONS, AND THE OTHER THREE ARE NOT MISSING.
 * `timing_difference`, `in_transit` and `write_off` are finance judgements about
 * WHY something failed to pair, and *"an engine that guessed one would be
 * manufacturing a finance decision out of an absence."* A stored row carrying
 * one of them is a row this engine did not write, and this narrowing is what
 * stops it being published as though it had.
 */
const ENGINE_DISPOSITION: Readonly<Record<EngineAssignableDisposition, true>> = {
  unidentified: true,
  error_left: true,
  error_right: true,
}

/** ⚠️ THIRTEEN SINCE G291, 19 Sep 2026 — the thirteenth is the last key here. */
const RESIDUE_CAUSE_KIND: Readonly<Record<ResidueCause['kind'], true>> = {
  no_strategy_paired: true,
  identifier_ambiguous: true,
  admission_refused: true,
  cash_exceeded_obligations: true,
  obligation_not_fully_settled: true,
  counterparty_unattributed: true,
  bucket_exceeded_bound: true,
  search_budget_exhausted: true,
  reader_refused: true,
  reader_found_no_candidate: true,
  control_total_unverified: true,
  read_held_below_floor: true,
  amount_tolerance_declined: true,
}

const READER_REFUSAL_KIND: Readonly<Record<ReaderRefusal['kind'], true>> = {
  not_implemented: true,
  contract_violation: true,
  response_truncated: true,
  response_exceeded_byte_cap: true,
  transport_failed: true,
  candidate_index_out_of_range: true,
  model_rejected_by_policy: true,
  field_not_eligible_for_prompt: true,
}

/**
 * ⚠️ NO `over_allocated` MEMBER, AND ITS ABSENCE IS THE WIRE'S OWN DECISION:
 * *"over-allocation is a REFUSAL carrying both numbers, not a state something
 * can be left in"* (§5.5).
 */
const ITEM_SETTLEMENT_KIND: Readonly<Record<ItemSettlement['kind'], true>> = {
  unallocated: true,
  partially_allocated: true,
  fully_allocated: true,
}

/**
 * ⚠️ `Object.hasOwn`, NEVER `in`, AND IT BINDS EVERY GUARD BELOW.
 * `'constructor' in RECORD` is `true`, so the obvious spelling admits every name
 * on `Object.prototype` — a membership test that answers yes for `toString` is a
 * membership test that lets a `toString` in a `cause_kind` column onto the wire.
 */
function member(table: Readonly<Record<string, true>>, value: string): boolean {
  return Object.hasOwn(table, value)
}

export function isTerminalRunStatus(v: string): v is TerminalRunStatus {
  return member(TERMINAL_RUN_STATUS, v)
}
export function isPopulationSide(v: string): v is PopulationSide {
  return member(POPULATION_SIDE, v)
}
export function isControlTotalKind(v: string): v is ControlTotal['kind'] {
  return member(CONTROL_TOTAL_KIND, v)
}
export function isTrailerVerdictKind(v: string): v is DocumentTrailerVerdict['kind'] {
  return member(TRAILER_VERDICT_KIND, v)
}
export function isPopulationDefectKind(v: string): v is PopulationDefect['kind'] {
  return member(POPULATION_DEFECT_KIND, v)
}
export function isAdmissionRefusalKind(v: string): v is AdmissionRefusal['kind'] {
  return member(ADMISSION_REFUSAL_KIND, v)
}
export function isExtractionRefusalKind(v: string): v is ExtractionRefusal['kind'] {
  return member(EXTRACTION_REFUSAL_KIND, v)
}
export function isRunRefusalKind(v: string): v is SetReconciliationRefusal['kind'] {
  return member(RUN_REFUSAL_KIND, v)
}

export function isNormalisationDefectKind(v: string): v is NormalisationDefect['kind'] {
  return member(NORMALISATION_DEFECT_KIND, v)
}

export function isToleranceRoute(v: string): v is ToleranceRoute {
  return member(TOLERANCE_ROUTE, v)
}

export function isMoneyRefusalKind(v: string): v is MoneyRefusal['kind'] {
  return member(MONEY_REFUSAL_KIND, v)
}
export function isExtractedScalarKind(v: string): v is ExtractedScalar['kind'] {
  return member(EXTRACTED_SCALAR_KIND, v)
}
export function isPairingStrategyKind(v: string): v is PairingStrategy['kind'] {
  return member(PAIRING_STRATEGY_KIND, v)
}
export function isCompletenessFindingKind(v: string): v is CompletenessFinding['kind'] {
  return member(COMPLETENESS_FINDING_KIND, v)
}
export function isEngineMeter(v: string): v is EngineMeter {
  return member(ENGINE_METER, v)
}
export function isEngineDisposition(v: string): v is EngineAssignableDisposition {
  return member(ENGINE_DISPOSITION, v)
}
export function isResidueCauseKind(v: string): v is ResidueCause['kind'] {
  return member(RESIDUE_CAUSE_KIND, v)
}
export function isReaderRefusalKind(v: string): v is ReaderRefusal['kind'] {
  return member(READER_REFUSAL_KIND, v)
}
export function isItemSettlementKind(v: string): v is ItemSettlement['kind'] {
  return member(ITEM_SETTLEMENT_KIND, v)
}

/**
 * R13 — G2372, 1 Oct 2026. `PairingEvidence`'s seven arms, TOTAL, so an eighth
 * arm in the model is a `TS2741` here before it is a row `0260`'s reader cannot
 * name. `amount_sum_waterfall`'s two fall-through reasons are the second
 * vocabulary that table stores, and get the same treatment.
 */
const PAIRING_EVIDENCE_KIND: Readonly<Record<PairingEvidence['kind'], true>> = {
  exact_identifier: true,
  tolerant_identifier: true,
  amount_and_date: true,
  amount_sum_exact: true,
  amount_sum_waterfall: true,
  fuzzy_reference: true,
  reader_confirmed: true,
}

type FellThroughFrom = Extract<PairingEvidence, { kind: 'amount_sum_waterfall' }>['fellThroughFrom']
const WATERFALL_FELL_THROUGH_FROM: Readonly<Record<FellThroughFrom, true>> = {
  budget_exhausted: true,
  no_exact_solution: true,
}

export function isPairingEvidenceKind(v: string): v is PairingEvidence['kind'] {
  return member(PAIRING_EVIDENCE_KIND, v)
}
export function isWaterfallFellThroughFrom(v: string): v is FellThroughFrom {
  return member(WATERFALL_FELL_THROUGH_FROM, v)
}

/**
 * 🛑 THE MODEL'S OWN TOTAL RECORD IS THE VOCABULARY — see the header.
 * `POSTCONDITION_PROPERTY` is declared `satisfies Record<PostconditionFailure['kind'],
 * 'soundness' | 'completeness'>`, so its keys ARE the arm names, and a second
 * list here could only ever drift from it.
 */
export function isPostconditionKind(v: string): v is PostconditionFailure['kind'] {
  return Object.hasOwn(POSTCONDITION_PROPERTY, v)
}

/* ==================================================================== *
 * §2  THE DEFINITION'S OWN VOCABULARIES — G1121, 20 Sep 2026
 *
 * 🛑 THESE NINE EXIST FOR THE SAME REASON THE SIXTEEN ABOVE DO, AND THE
 *    ARGUMENT IS `0160_definition_engine_spec.sql`'s RATHER THAN A NEW ONE:
 *    that migration declines a `CHECK` on every vocabulary column it creates,
 *    on `0069`'s ground — *"a CHECK naming the three members literally is the
 *    lazy repair … a fourth member added to the model would pass it
 *    silently"* — so the narrowing goes where it can be DERIVED from the model
 *    instead of transcribed beside it.
 *
 * ⚠️ THE STAKES ARE NOT A WIRE HERE, WHICH IS THE ONE DIFFERENCE WORTH
 *    STATING. Nothing above reaches an operator through these; they narrow a
 *    stored string into a value `runSetReconciliation()` will DISPATCH ON. A
 *    `similarity_metric` of `'jaro-winkler'` (one hyphen) coerced rather than
 *    refused is not a malformed response — it is a different pairing, silently,
 *    on money.
 * ==================================================================== */

const TOLERANCE_DIRECTION: Readonly<Record<ToleranceDirection, true>> = {
  symmetric: true,
  left_greater_only: true,
  right_greater_only: true,
}

/**
 * ⚠️ SIX ARMS AND THE ENGINE REFUSES TWO OF THEM AT USE. `absolute` and
 * `percentage` are *"floating-point money the moment they are applied to an
 * amount"* and `toleranceVerdict()` answers `float_money_tolerance` for both.
 * **They are still MEMBERS here, deliberately**: a stored `absolute` tolerance
 * must reach the engine and be refused BY NAME, which is `0009`'s posture for a
 * disabled person — *"a disabled person must be VISIBLE so the model can refuse
 * them BY NAME"*. Narrowing them away at the read would turn a pack author's
 * refusable mistake into a definition this plane cannot describe.
 */
const TOLERANCE_KIND: Readonly<Record<Tolerance['kind'], true>> = {
  absolute: true,
  percentage: true,
  days: true,
  similarity: true,
  money: true,
  rounding: true,
}

const SIMILARITY_METRIC: Readonly<Record<SimilarityMetric, true>> = {
  levenshtein_ratio: true,
  jaro_winkler: true,
}

const PAIRING_CARDINALITY: Readonly<Record<PairingCardinality, true>> = {
  one_to_one: true,
  one_to_many: true,
  many_to_one: true,
  many_to_many: true,
}

const NORMALISER: Readonly<Record<Normaliser, true>> = {
  exact: true,
  casefold: true,
  digits_only: true,
  name_normalise: true,
}

const EXTRACTION_OP_KIND: Readonly<Record<ExtractionOp['kind'], true>> = {
  trim: true,
  strip_leading_zeros: true,
  strip_literal: true,
  split_take: true,
}

/**
 * ⚠️ `within_tolerance` IS A MEMBER AND IT IS NOT THE CONTAINMENT BOUND.
 * `AmountAnchor`'s own declaration says so: *"the reader's candidate set is
 * built under an EXACT anchor ALWAYS, whatever this says"*. A stored
 * `within_tolerance` widens PAIRING and reaches no reader bound, so admitting
 * it here confers nothing.
 */
const AMOUNT_ANCHOR: Readonly<Record<AmountAnchor, true>> = {
  exact: true,
  within_tolerance: true,
}

/** `strip_literal`'s `at`. Three positions, and none of them is a default. */
const STRIP_AT: Readonly<Record<Extract<ExtractionOp, { kind: 'strip_literal' }>['at'], true>> = {
  prefix: true,
  suffix: true,
  anywhere: true,
}

const CARRIES_CONTROL_TOTAL: Readonly<
  Record<PopulationBinding['carriesControlTotal'], true>
> = { always: true, never: true }

const EMPTY_EXPECTATION: Readonly<Record<PopulationBinding['emptyExpectation'], true>> = {
  refuses: true,
  permitted: true,
}

export function isToleranceDirection(v: string): v is ToleranceDirection {
  return member(TOLERANCE_DIRECTION, v)
}
export function isToleranceKind(v: string): v is Tolerance['kind'] {
  return member(TOLERANCE_KIND, v)
}
export function isSimilarityMetric(v: string): v is SimilarityMetric {
  return member(SIMILARITY_METRIC, v)
}
export function isPairingCardinality(v: string): v is PairingCardinality {
  return member(PAIRING_CARDINALITY, v)
}
export function isNormaliser(v: string): v is Normaliser {
  return member(NORMALISER, v)
}
export function isExtractionOpKind(v: string): v is ExtractionOp['kind'] {
  return member(EXTRACTION_OP_KIND, v)
}
export function isAmountAnchor(v: string): v is AmountAnchor {
  return member(AMOUNT_ANCHOR, v)
}
export function isStripAt(v: string): v is Extract<ExtractionOp, { kind: 'strip_literal' }>['at'] {
  return member(STRIP_AT, v)
}
export function isCarriesControlTotal(v: string): v is PopulationBinding['carriesControlTotal'] {
  return member(CARRIES_CONTROL_TOTAL, v)
}
export function isEmptyExpectation(v: string): v is PopulationBinding['emptyExpectation'] {
  return member(EMPTY_EXPECTATION, v)
}

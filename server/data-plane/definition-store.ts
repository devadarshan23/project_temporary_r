/**
 * A RECONCILIATION DEFINITION'S CONTENT, READ BACK OUT OF TYPED COLUMNS AND
 * REASSEMBLED INTO THE ENGINE'S OWN INPUT TYPE. G1122, 20 Sep 2026.
 *
 * ┌─ WHAT THIS CLOSES, MEASURED BEFORE IT WAS WRITTEN ─────────────────────────┐
 * │ `SetReconciliationInput` has EIGHTEEN fields and                           │
 * │ `tenant.reconciliation_definition` stored FOUR — `tenant_id`, `id`,        │
 * │ `version`, `status`. Derive both, never read them:                         │
 * │                                                                            │
 * │   awk '/export interface SetReconciliationInput/,/^}/' \                    │
 * │     model/reconciliation.ts | grep -c '^  readonly'          → 18          │
 * │   awk '/CREATE TABLE tenant.reconciliation_definition \\(/,/\\);/' \          │
 * │     db/migrations/0069_run_admission.sql \                                 │
 * │     | grep -E '^  [a-z_]+ ' | awk '{print $1}'                             │
 * │                                                                            │
 * │ **The engine has had no definition to run since it was written.** Not a    │
 * │ partial one — none. `0069` stores a definition's NUMBER and its STATUS,    │
 * │ which is exactly what run ADMISSION reads and is nothing the engine        │
 * │ consumes, and `docs/build/red-buildability.md` B3 named that shape on      │
 * │ 7 Aug 2026: *"Definition versioning pins a NUMBER and stores no version    │
 * │ content."*                                                                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ─── R-A, THE OWNER'S RULING OF 20 Sep 2026, AND THE OPTION IT BEAT ──────────
 *
 * **"A definition's content lives in TYPED COLUMNS, one per declared field."**
 *
 * ⚠️ REJECTED AND PRESERVED, because a rejected option preserved is the only
 * thing that stops the next reader re-taking it: **one `jsonb` spec column.**
 * It is refused on `0007`'s own ground — G284 refused a `jsonb` operand column
 * for run RESULTS because a key with no `FieldSpec` is UNREADABLE under
 * invariant 4, and *"a result nobody may read is not persistence."* A
 * definition stored that way is the same trap one table over. **Also rejected:**
 * the content belongs to the pack and is published downward — right in
 * principle, and blocked, because G110's publication seam does not exist.
 *
 * **Cost accepted and named: a migration per new engine knob, forward-only
 * under G88.** `db/migrations/0160_definition_engine_spec.sql` carries that
 * sentence on its own face.
 *
 * ─── THE ONE CONTROL IN THIS FILE THAT IS NOT A RUNTIME CHECK ────────────────
 *
 * `StoredDefinition` is an `Omit` OF THE ENGINE'S OWN INTERFACE and never a
 * hand-written restatement of it. So a NINETEENTH field on
 * `SetReconciliationInput` is a `TS2739` HERE, in the reader, rather than a
 * field somebody forgets to store — which is the difference between a schema
 * that tracks the engine and a schema that used to.
 *
 * ⚠️ AND THE FOUR IT OMITS ARE OMITTED FOR THREE DIFFERENT REASONS, which is
 * why they are enumerated rather than waved at:
 *
 *   `runId`          NOT definition content. It is the run's, and it arrives
 *                    from `public.run.id` at the call site.
 *   `tenantId`       NOT definition content, and storing it would be worse
 *                    than useless. **Invariant 1: *"Tenant scope is derived
 *                    from the session, never read from a request."*** The
 *                    engine carries it FOR REFUSAL, and the value it must be
 *                    refused against is the SCOPE's — so it comes from the
 *                    scope this read already runs inside, never from a column
 *                    this read could have got wrong.
 *   `leftDocuments`  **CANNOT BE REPRESENTED, AND THIS READER STOPS AT THAT
 *   `rightDocuments`  BOUNDARY RATHER THAN INVENTING ONE.** See §0 below.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0  THE DOCUMENTS ARE NOT HERE AND CANNOT BE — MEASURED, NOT ASSUMED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `SetReconciliationInput.leftDocuments` is `readonly SourceDocument[]`, and a
 * `SourceDocument` carries `extracted: Record<FieldPathKey, ExtractedValue>`,
 * `lines: ExtractedLine[]`, `controlTotal`, `storageRef`, `filename` and
 * `slot`. **EXTRACTION IS THE ENGINE'S INPUT, NOT ITS OUTPUT**, and nothing in
 * this repository produces one:
 *
 *   grep -rn 'ExtractedValue\|ExtractedLine' server/ | grep -v '^\S*: *\*'  → 0
 *
 * `readAddressablePayload()` returns an `AddressableValue` — a pathKey, a path,
 * a `dataClass`, a `modelProcessingAllowed` and a `Json` — which is a
 * CLASSIFIED POSITION and not an `ExtractedValue`: no scalar kind, no fidelity,
 * no confidence. And `tenant.source_document` has five columns, with `0012` §3
 * refusing `filename`, `storage_ref`, `control_total`, `synthetic` and every
 * extraction column BY NAME.
 *
 * 🛑 SO A CONVERTER WRITTEN HERE WOULD BE INVENTING A FIDELITY AND A CONFIDENCE
 *    FOR EVERY VALUE IN THE PRODUCT, and `PRODUCT.md` forbids inventing a
 *    figure. **The honest surface is `completeSetReconciliationInput()`**: it
 *    takes the documents from its caller and this module never manufactures
 *    one. Today its only callers are in `tests/`, and that is stated here
 *    rather than left to be discovered.
 *
 * ✅ **THE LAST SENTENCE WENT FALSE ON 21 Sep 2026 AND THE WHOLE OF §0 IS
 *    CORRECTED HERE RATHER THAN DELETED, because it is the paragraph three
 *    files quote and the one a reader would have trusted before concluding the
 *    engine could never be given operands.**
 *
 *    **There IS a producer: `server/data-plane/document-assembly.ts` (E4), and
 *    `server/data-plane/run-executor.ts` (E5) is the caller.** The derivation
 *    quoted above no longer returns 0 — run it and see. What made it possible
 *    was not a converter written here but the two DECLARATIONS this module had
 *    no way to read: `FieldSpec.dataType` (`db/migrations/0170`, E1) says what
 *    KIND a position holds, and `DocumentType.expectedFidelity`
 *    (`db/migrations/0180`, E3) says what rung it arrived on. **Neither is
 *    invented and neither is sniffed** — which is exactly why §0 was right to
 *    refuse until they existed.
 *
 * ⚠️ **AND THE REFUSAL'S NARROW FORM SURVIVES WHOLE: this module still
 *    manufactures no document and must not.** `completeSetReconciliationInput()`
 *    takes them from its caller, the boundary is still a parameter rather than
 *    a paragraph, and **`lines` is still empty on every document the product
 *    can produce** — `readAddressablePayload()` is header-grain, so a
 *    line-grain payload is REFUSED rather than folded into one row. E4 §0b
 *    carries that argument.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0a  WHAT THIS FILE DOES NOT DO, SO NOBODY READS IT AS MORE THAN IT IS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · **It mounts nothing.** No contract operation reads a definition's engine
 *     spec on any of the seven tiers, and G300's test is table AND model AND
 *     capability. The columns are proven by
 *     `tests/db/definition-engine-spec.test.ts` over a real PostgreSQL, which
 *     is `0007`'s precedent for a column set proven without a route.
 *   · **It does not run the engine.** `runSetReconciliation()` is not imported
 *     here and must not be: R-B puts the executor behind a queue and that is a
 *     separate slice with an AWS dependency.
 *   · **It writes nothing.** `0160` grants `SELECT` and nothing else, and the
 *     argument is on the migration's face.
 */

import type { ScopedClient } from '../../db/tenant-scope.ts'
import type {
  DataClass,
  FieldPath,
  FieldPathKey,
  Money,
  Normaliser,
  PairingCardinality,
  PairingSpec,
  PairingStrategy,
  PopulationSpec,
  RunId,
  TenantId,
  Tolerance,
} from '../../model/domain.ts'
import type {
  AmountAnchor,
  ExtractionOp,
  IdentifierNormalisation,
  PopulationBinding,
  PopulationSide,
  ReconciliationDocument,
  SetReconciliationInput,
  SimilarityMetric,
  StrategyBinding,
  SubsetSumBound,
  ToleranceDirection,
} from '../../model/reconciliation.ts'
import { fieldPathKey, parseFieldPath } from '../../model/field-path.ts'
import { parseMinorUnits } from '../../model/money.ts'
import { DATA_CLASSES } from '../../model/domain.ts'
import {
  isAmountAnchor,
  isCarriesControlTotal,
  isEmptyExpectation,
  isExtractionOpKind,
  isNormaliser,
  isPairingCardinality,
  isPairingStrategyKind,
  isPopulationSide,
  isSimilarityMetric,
  isStripAt,
  isToleranceDirection,
  isToleranceKind,
} from './engine-vocabulary.ts'

/* ==================================================================== *
 * §1  THE ANSWER SHAPE — THREE ARMS, AND THE THIRD IS THE ONE A
 *     PLAUSIBLE IMPLEMENTATION LOSES
 * ==================================================================== */

/**
 * What a stored row carried that the model cannot name. **Carries no cell
 * value**, for `exception-store.ts`'s reason one table over: a refusal must not
 * carry a declaration this plane has just decided it cannot read.
 */
export interface DefinitionDefect {
  readonly table: string
  readonly column: string
  readonly definitionId: string
}

/**
 * 🛑 `no_definition` IS A STATED ANSWER AND NOT AN EMPTY ONE, exactly as
 * `run-account-store.ts`'s `no_account` is. A definition whose engine spec is
 * absent is NOT a definition with default knobs — `SetReconciliationInput`
 * refuses a default for `readerCandidateCap`, `similarityMaxChars`,
 * `subsetSumBound` and `admissionRefusalCeilingBasisPoints` in its own
 * declaration, by requiring each and defaulting none, and a reader that
 * supplied one would be taking O-8's ruling out of the owner's hands.
 */
export type DefinitionRead =
  | { readonly kind: 'definition'; readonly definition: StoredDefinition }
  | { readonly kind: 'no_definition' }
  | { readonly kind: 'unreadable'; readonly defect: DefinitionDefect }

/**
 * THE ENGINE'S INPUT MINUS THE FOUR THINGS A DEFINITION DOES NOT OWN.
 *
 * 🛑 AN `Omit` AND NEVER A RESTATEMENT — see the header. A nineteenth field on
 *    `SetReconciliationInput` fails to compile HERE.
 */
export type StoredDefinition = Omit<
  SetReconciliationInput,
  'runId' | 'tenantId' | 'leftDocuments' | 'rightDocuments'
>

/** The four a definition does not own. Named, so the boundary is a type. */
export interface RunOperands {
  readonly runId: RunId
  /**
   * ⚠️ **THE SCOPE'S, NEVER A COLUMN'S.** Invariant 1: *"Tenant scope is
   * derived from the session, never read from a request."* The engine carries
   * this to REFUSE a document set that disagrees with the run it was handed;
   * reading it back out of the definition row would compare a value against
   * itself.
   */
  readonly tenantId: TenantId
  /**
   * ✅ **§0 IS CORRECTED AND THESE HAVE A PRODUCER SINCE 21 Sep 2026 — E4,
   * `server/data-plane/document-assembly.ts`.** The type is narrowed to
   * `ReconciliationDocument`, which is `Pick<SourceDocument, …>` over the five
   * fields the engine actually reads — so a whole `SourceDocument` still
   * satisfies it and `tests/scenarios/recon-corpus.ts` is untouched.
   */
  readonly leftDocuments: readonly ReconciliationDocument[]
  readonly rightDocuments: readonly ReconciliationDocument[]
}

/**
 * The stored half plus the run's half. **This function invents nothing** — it
 * is a spread, and it exists so the boundary §0 describes is expressed as a
 * parameter a caller must fill rather than as a paragraph a caller may skip.
 */
export function completeSetReconciliationInput(
  stored: StoredDefinition,
  operands: RunOperands,
): SetReconciliationInput {
  return { ...stored, ...operands }
}

/* ==================================================================== *
 * §2  THE CODECS — a path, a money, a tolerance
 * ==================================================================== */

/** A stored `data_class` the model cannot name refuses the read; it is not coerced. */
function asDataClass(value: unknown): DataClass | null {
  if (typeof value !== 'string') return null
  for (const known of Object.values(DATA_CLASSES)) {
    if (known === value) return known
  }
  return null
}

/**
 * 🛑 THE STORED KEY IS RE-DERIVED AND NEVER TRUSTED, which is
 * `payload-store.ts`'s rule and is load-bearing for the same reason: a
 * `path_key` that disagrees with its own `path` would silently address a
 * position under the wrong identity, and `fieldClassification` is the map
 * invariant 4 rests on.
 */
function pathIn(raw: unknown): { path: FieldPath; key: FieldPathKey } | null {
  const parsed = parseFieldPath(raw)
  if (!parsed.ok) return null
  return { path: parsed.path, key: fieldPathKey(parsed.path) }
}

/** `int8` arrives from `pg` as a string. G286's codec is the only converter. */
function minorIn(value: unknown): bigint | null {
  if (typeof value !== 'string') return null
  const parsed = parseMinorUnits(value)
  return parsed.ok ? parsed.value : null
}

interface ToleranceColumns {
  readonly kind: unknown
  readonly value: unknown
  readonly currency: unknown
  readonly minor: unknown
  readonly exponent: unknown
  readonly roundingMinorUnits: unknown
}

/**
 * SIX ARMS, COLUMN PER ARM — G357's shape on `tenant.exception.delta_*`, a
 * second time.
 *
 * ⚠️ `absolute` AND `percentage` ARE ADMITTED HERE AND REFUSED AT USE, and the
 * separation is deliberate: `toleranceVerdict()` answers `float_money_tolerance`
 * for both because *"both are floating-point money the moment they are applied
 * to an amount"*. Narrowing them away at the READ would turn a pack author's
 * refusable mistake into a definition this plane cannot describe — which is
 * `0009`'s posture for a disabled person, *"a disabled person must be VISIBLE
 * so the model can refuse them BY NAME."*
 *
 * `null` in, `null` out — a `StrategyBinding.amountTolerance` of `null` INHERITS
 * `PairingSpec.amountTolerance` and is a stated value, not an absence.
 */
function toleranceIn(c: ToleranceColumns): Tolerance | null | 'refused' {
  if (c.kind === null || c.kind === undefined) return null
  if (typeof c.kind !== 'string' || !isToleranceKind(c.kind)) return 'refused'

  if (c.kind === 'money') {
    if (typeof c.currency !== 'string' || typeof c.exponent !== 'number') return 'refused'
    const amountMinor = minorIn(c.minor)
    if (amountMinor === null) return 'refused'
    const money: Money = { currency: c.currency, amountMinor, exponent: c.exponent }
    return { kind: 'money', value: money }
  }

  if (c.kind === 'rounding') {
    if (typeof c.roundingMinorUnits !== 'number') return 'refused'
    return { kind: 'rounding', minorUnits: c.roundingMinorUnits }
  }

  if (typeof c.value !== 'number') return 'refused'
  return { kind: c.kind, value: c.value }
}

/* ==================================================================== *
 * §3  THE ROWS
 * ==================================================================== */

interface SpecRow {
  readonly obligation_side: string
  readonly tolerance_direction: string
  readonly pairing_cardinality: string
  readonly amount_tolerance_kind: string
  readonly amount_tolerance_value: number | null
  readonly amount_tolerance_money_currency: string | null
  readonly amount_tolerance_money_minor: unknown
  readonly amount_tolerance_money_exponent: number | null
  readonly amount_tolerance_rounding_minor_units: number | null
  readonly date_tolerance_kind: string
  readonly date_tolerance_value: number | null
  readonly date_tolerance_money_currency: string | null
  readonly date_tolerance_money_minor: unknown
  readonly date_tolerance_money_exponent: number | null
  readonly date_tolerance_rounding_minor_units: number | null
  readonly subset_sum_max_members: number
  readonly subset_sum_step_budget: number
  readonly subset_sum_max_bucket_size: number
  readonly reader_candidate_cap: number
  readonly similarity_max_chars: number
  readonly similarity_metric: string
  readonly admission_refusal_ceiling_basis_points: number
}

interface PopulationRow {
  readonly side: string
  readonly document_type_id: string
  readonly amount_path: unknown
  readonly date_path: unknown
  readonly declared_unit_currency: string
  readonly declared_unit_exponent: number
  readonly carries_control_total: string
  readonly empty_expectation: string
  readonly normalisation_then: string
  readonly normalisation_max_input_chars: number
  readonly counterparty_path: unknown
  readonly description_path: unknown
}

interface IdentifierRow {
  readonly side: string
  readonly ordinal: number
  readonly path: unknown
}

interface OpRow {
  readonly side: string
  readonly ordinal: number
  readonly op_kind: string
  readonly op_literal: string | null
  readonly op_at: string | null
  readonly op_separator: string | null
  readonly op_index: number | null
}

interface StrategyRow {
  readonly ordinal: number
  readonly strategy_kind: string
  readonly strategy_on_path: unknown
  readonly strategy_max_members: number | null
  readonly strategy_min_similarity: number | null
  readonly binding_amount_tolerance_kind: string | null
  readonly binding_amount_tolerance_value: number | null
  readonly binding_amount_tolerance_money_currency: string | null
  readonly binding_amount_tolerance_money_minor: unknown
  readonly binding_amount_tolerance_money_exponent: number | null
  readonly binding_amount_tolerance_rounding_minor_units: number | null
  readonly binding_amount_anchor: string
}

interface FieldSpecRow {
  readonly document_type_id: string
  readonly path_key: string
  readonly path: unknown
  readonly data_class: string
  readonly model_processing_allowed: boolean
  readonly confidence_floor: number | null
}

/* ==================================================================== *
 * §4  THE READ
 * ==================================================================== */

/**
 * Read one definition's engine spec, inside the caller's tenant scope.
 *
 * 🛑 **THE `WHERE` IS `id = $1` AND NOTHING ELSE, ON EVERY ONE OF THE SIX
 *    QUERIES.** The tenant narrowing is the POLICY's — `0069`'s and `0160`'s
 *    `tenant_id = nullif(current_setting('app.tenant_id', true), '')` — and a
 *    `tenant_id = $2` here would be a SECOND enforcement of invariant 1 that
 *    looks like the first and is checked by nothing. `0039`'s reader states the
 *    same rule for the same reason.
 *
 * ⚠️ **OUTSIDE `withTenantScope()` THIS RETURNS `no_definition`, NOT AN ERROR**
 *    — G100 denies on NULL, so every one of the six queries answers zero rows.
 *    That is the fail-closed direction and `tests/db/definition-engine-spec.test.ts`
 *    §2b witnesses it rather than trusting it.
 */
export async function readSetReconciliationDefinition(
  tx: ScopedClient,
  definitionId: string,
): Promise<DefinitionRead> {
  const bad = (table: string, column: string): DefinitionRead => ({
    kind: 'unreadable',
    defect: { table, column, definitionId },
  })

  const specResult = await tx.query(
    `SELECT obligation_side, tolerance_direction, pairing_cardinality,
            amount_tolerance_kind, amount_tolerance_value,
            amount_tolerance_money_currency, amount_tolerance_money_minor::text AS amount_tolerance_money_minor,
            amount_tolerance_money_exponent, amount_tolerance_rounding_minor_units,
            date_tolerance_kind, date_tolerance_value,
            date_tolerance_money_currency, date_tolerance_money_minor::text AS date_tolerance_money_minor,
            date_tolerance_money_exponent, date_tolerance_rounding_minor_units,
            subset_sum_max_members, subset_sum_step_budget, subset_sum_max_bucket_size,
            reader_candidate_cap, similarity_max_chars, similarity_metric,
            admission_refusal_ceiling_basis_points
       FROM tenant.definition_engine_spec
      WHERE definition_id = $1`,
    [definitionId],
  )
  const spec = specResult.rows[0] as SpecRow | undefined
  if (spec === undefined) return { kind: 'no_definition' }

  if (!isPopulationSide(spec.obligation_side)) return bad('definition_engine_spec', 'obligation_side')
  const obligationSide: PopulationSide = spec.obligation_side
  if (!isToleranceDirection(spec.tolerance_direction)) {
    return bad('definition_engine_spec', 'tolerance_direction')
  }
  const toleranceDirection: ToleranceDirection = spec.tolerance_direction
  if (!isPairingCardinality(spec.pairing_cardinality)) {
    return bad('definition_engine_spec', 'pairing_cardinality')
  }
  const cardinality: PairingCardinality = spec.pairing_cardinality
  if (!isSimilarityMetric(spec.similarity_metric)) {
    return bad('definition_engine_spec', 'similarity_metric')
  }
  const similarityMetric: SimilarityMetric = spec.similarity_metric

  const amountTolerance = toleranceIn({
    kind: spec.amount_tolerance_kind,
    value: spec.amount_tolerance_value,
    currency: spec.amount_tolerance_money_currency,
    minor: spec.amount_tolerance_money_minor,
    exponent: spec.amount_tolerance_money_exponent,
    roundingMinorUnits: spec.amount_tolerance_rounding_minor_units,
  })
  /* `PairingSpec.amountTolerance` is NON-OPTIONAL, so a null kind is as
     unreadable as a malformed one — the column is `NOT NULL` and a null here
     means the constraint was dropped. */
  if (amountTolerance === 'refused' || amountTolerance === null) {
    return bad('definition_engine_spec', 'amount_tolerance_kind')
  }
  const dateTolerance = toleranceIn({
    kind: spec.date_tolerance_kind,
    value: spec.date_tolerance_value,
    currency: spec.date_tolerance_money_currency,
    minor: spec.date_tolerance_money_minor,
    exponent: spec.date_tolerance_money_exponent,
    roundingMinorUnits: spec.date_tolerance_rounding_minor_units,
  })
  if (dateTolerance === 'refused' || dateTolerance === null) {
    return bad('definition_engine_spec', 'date_tolerance_kind')
  }

  /* ---- the two populations ---------------------------------------- */

  const popResult = await tx.query(
    `SELECT side, document_type_id, amount_path, date_path,
            declared_unit_currency, declared_unit_exponent,
            carries_control_total, empty_expectation,
            normalisation_then, normalisation_max_input_chars,
            counterparty_path, description_path
       FROM tenant.definition_population
      WHERE definition_id = $1
      ORDER BY side`,
    [definitionId],
  )
  const popRows = popResult.rows as unknown as PopulationRow[]

  const idResult = await tx.query(
    `SELECT side, ordinal, path
       FROM tenant.definition_population_identifier
      WHERE definition_id = $1
      ORDER BY side, ordinal`,
    [definitionId],
  )
  const idRows = idResult.rows as unknown as IdentifierRow[]

  const opResult = await tx.query(
    `SELECT side, ordinal, op_kind, op_literal, op_at, op_separator, op_index
       FROM tenant.definition_normalisation_op
      WHERE definition_id = $1
      ORDER BY side, ordinal`,
    [definitionId],
  )
  const opRows = opResult.rows as unknown as OpRow[]

  const bindings = new Map<PopulationSide, PopulationBinding>()
  const documentTypes: string[] = []
  for (const row of popRows) {
    if (!isPopulationSide(row.side)) return bad('definition_population', 'side')
    if (bindings.has(row.side)) return bad('definition_population', 'side')

    const amount = pathIn(row.amount_path)
    if (amount === null) return bad('definition_population', 'amount_path')
    const date = pathIn(row.date_path)
    if (date === null) return bad('definition_population', 'date_path')

    const identifiers: FieldPath[] = []
    for (const idRow of idRows) {
      if (idRow.side !== row.side) continue
      const parsed = pathIn(idRow.path)
      if (parsed === null) return bad('definition_population_identifier', 'path')
      identifiers.push(parsed.path)
    }

    const ops: ExtractionOp[] = []
    for (const opRow of opRows) {
      if (opRow.side !== row.side) continue
      if (!isExtractionOpKind(opRow.op_kind)) {
        return bad('definition_normalisation_op', 'op_kind')
      }
      if (opRow.op_kind === 'strip_literal') {
        if (opRow.op_literal === null || opRow.op_at === null || !isStripAt(opRow.op_at)) {
          return bad('definition_normalisation_op', 'op_at')
        }
        ops.push({ kind: 'strip_literal', literal: opRow.op_literal, at: opRow.op_at })
      } else if (opRow.op_kind === 'split_take') {
        if (opRow.op_separator === null || opRow.op_index === null) {
          return bad('definition_normalisation_op', 'op_separator')
        }
        ops.push({ kind: 'split_take', separator: opRow.op_separator, index: opRow.op_index })
      } else {
        ops.push({ kind: opRow.op_kind })
      }
    }

    if (!isNormaliser(row.normalisation_then)) {
      return bad('definition_population', 'normalisation_then')
    }
    const then: Normaliser = row.normalisation_then
    if (!isCarriesControlTotal(row.carries_control_total)) {
      return bad('definition_population', 'carries_control_total')
    }
    if (!isEmptyExpectation(row.empty_expectation)) {
      return bad('definition_population', 'empty_expectation')
    }

    /* Both nullable pairs are whole-or-absent by a CHECK in `0160`. A
       half-written pair is a row the reader must refuse to publish, exactly as
       `0015`'s three wholeness constraints decide. */
    let counterparty: FieldPath | null = null
    if (row.counterparty_path !== null) {
      const parsed = pathIn(row.counterparty_path)
      if (parsed === null) return bad('definition_population', 'counterparty_path')
      counterparty = parsed.path
    }
    let description: FieldPath | null = null
    if (row.description_path !== null) {
      const parsed = pathIn(row.description_path)
      if (parsed === null) return bad('definition_population', 'description_path')
      description = parsed.path
    }

    const populationSpec: PopulationSpec = {
      documentTypeId: row.document_type_id as PopulationSpec['documentTypeId'],
      amount: amount.path,
      date: date.path,
      identifiers,
    }
    const normalisation: IdentifierNormalisation = {
      ops,
      then,
      maxInputChars: row.normalisation_max_input_chars,
    }
    bindings.set(row.side, {
      spec: populationSpec,
      declaredUnit: {
        currency: row.declared_unit_currency,
        exponent: row.declared_unit_exponent,
      },
      carriesControlTotal: row.carries_control_total,
      emptyExpectation: row.empty_expectation,
      normalisation,
      counterparty,
      description,
    })
    documentTypes.push(row.document_type_id)
  }

  const left = bindings.get('left')
  if (left === undefined) return bad('definition_population', 'side')
  const right = bindings.get('right')
  if (right === undefined) return bad('definition_population', 'side')

  /* ---- the strategies, and the 1:1 that cannot be broken ----------- */

  const stratResult = await tx.query(
    `SELECT ordinal, strategy_kind, strategy_on_path,
            strategy_max_members, strategy_min_similarity,
            binding_amount_tolerance_kind, binding_amount_tolerance_value,
            binding_amount_tolerance_money_currency,
            binding_amount_tolerance_money_minor::text AS binding_amount_tolerance_money_minor,
            binding_amount_tolerance_money_exponent,
            binding_amount_tolerance_rounding_minor_units,
            binding_amount_anchor
       FROM tenant.definition_strategy
      WHERE definition_id = $1
      ORDER BY ordinal`,
    [definitionId],
  )
  const stratRows = stratResult.rows as unknown as StrategyRow[]

  const strategies: PairingStrategy[] = []
  const strategyBindings: StrategyBinding[] = []
  for (const row of stratRows) {
    if (!isPairingStrategyKind(row.strategy_kind)) return bad('definition_strategy', 'strategy_kind')
    let strategy: PairingStrategy
    if (row.strategy_kind === 'exact_identifier') {
      const parsed = pathIn(row.strategy_on_path)
      if (parsed === null) return bad('definition_strategy', 'strategy_on_path')
      strategy = { kind: 'exact_identifier', on: parsed.path }
    } else if (row.strategy_kind === 'amount_sum') {
      if (row.strategy_max_members === null) return bad('definition_strategy', 'strategy_max_members')
      strategy = { kind: 'amount_sum', maxMembers: row.strategy_max_members }
    } else if (row.strategy_kind === 'fuzzy_reference') {
      if (row.strategy_min_similarity === null) {
        return bad('definition_strategy', 'strategy_min_similarity')
      }
      strategy = { kind: 'fuzzy_reference', minSimilarity: row.strategy_min_similarity }
    } else {
      strategy = { kind: 'amount_and_date' }
    }

    const bindingTolerance = toleranceIn({
      kind: row.binding_amount_tolerance_kind,
      value: row.binding_amount_tolerance_value,
      currency: row.binding_amount_tolerance_money_currency,
      minor: row.binding_amount_tolerance_money_minor,
      exponent: row.binding_amount_tolerance_money_exponent,
      roundingMinorUnits: row.binding_amount_tolerance_rounding_minor_units,
    })
    if (bindingTolerance === 'refused') {
      return bad('definition_strategy', 'binding_amount_tolerance_kind')
    }
    if (!isAmountAnchor(row.binding_amount_anchor)) {
      return bad('definition_strategy', 'binding_amount_anchor')
    }
    const amountAnchor: AmountAnchor = row.binding_amount_anchor

    strategies.push(strategy)
    strategyBindings.push({ strategy, amountTolerance: bindingTolerance, amountAnchor })
  }

  /* ---- invariant 4's three maps, from the table that already holds them --- */

  const classResult = await tx.query(
    `SELECT document_type_id, path_key, path, data_class,
            model_processing_allowed, confidence_floor
       FROM tenant.document_field_spec
      WHERE document_type_id = ANY($1::text[])
      ORDER BY document_type_id, path_key`,
    [documentTypes],
  )
  const classRows = classResult.rows as unknown as FieldSpecRow[]

  const fieldClassification = new Map<FieldPathKey, DataClass>()
  const modelPromptEligible = new Set<FieldPathKey>()
  const confidenceFloors = new Map<FieldPathKey, number>()
  const eligibility = new Map<FieldPathKey, boolean>()
  for (const row of classRows) {
    const parsed = pathIn(row.path)
    if (parsed === null) return bad('document_field_spec', 'path')
    const dataClass = asDataClass(row.data_class)
    if (dataClass === null) return bad('document_field_spec', 'data_class')

    /* 🛑 DISAGREEMENT IS A REFUSAL AND NEVER A MERGE, AND IT IS THE INVARIANT'S
       OWN ANSWER. Invariant 4: *"Classification is declared once, on
       `FieldSpec`, and everything derives from it."* Two document types
       declaring ONE position with two classes is that rule broken at the
       source, so a merge policy here — maximum class, conjunction of
       eligibility, strictest floor — would be a SECOND place classification is
       decided, invented by a reader. Identical declarations agree and pass. */
    const seenClass = fieldClassification.get(parsed.key)
    if (seenClass !== undefined && seenClass !== dataClass) {
      return bad('document_field_spec', 'data_class')
    }
    const seenEligible = eligibility.get(parsed.key)
    if (seenEligible !== undefined && seenEligible !== row.model_processing_allowed) {
      return bad('document_field_spec', 'model_processing_allowed')
    }
    const seenFloor = confidenceFloors.get(parsed.key)
    if (row.confidence_floor !== null && seenFloor !== undefined && seenFloor !== row.confidence_floor) {
      return bad('document_field_spec', 'confidence_floor')
    }

    fieldClassification.set(parsed.key, dataClass)
    eligibility.set(parsed.key, row.model_processing_allowed)
    if (row.model_processing_allowed) modelPromptEligible.add(parsed.key)
    /* ⚠️ A NULL FLOOR IS NOT A FLOOR OF ZERO. `confidenceFloors` is
       *"required and possibly EMPTY, never optional"* and an absent key says
       nothing; a zero would say the caller declared one and set it to nothing,
       which `applyReaderVerdicts()` would then enforce. */
    if (row.confidence_floor !== null) confidenceFloors.set(parsed.key, row.confidence_floor)
  }

  const pairing: PairingSpec = {
    cardinality,
    amountTolerance,
    dateTolerance,
    strategies,
  }
  const subsetSumBound: SubsetSumBound = {
    maxMembers: spec.subset_sum_max_members,
    stepBudget: spec.subset_sum_step_budget,
    maxBucketSize: spec.subset_sum_max_bucket_size,
  }

  return {
    kind: 'definition',
    definition: {
      left,
      right,
      pairing,
      strategyBindings,
      obligationSide,
      toleranceDirection,
      fieldClassification,
      modelPromptEligible,
      confidenceFloors,
      subsetSumBound,
      readerCandidateCap: spec.reader_candidate_cap,
      similarityMaxChars: spec.similarity_max_chars,
      similarityMetric,
      admissionRefusalCeilingBasisPoints: spec.admission_refusal_ceiling_basis_points,
    },
  }
}

/**
 * THE ENGINE RAISES THE EXCEPTIONS A RUN PRODUCES — G3741–G3750, 4 Oct 2026.
 * DERIVED, NOT THE OWNER'S. It discharges G3623: *"nothing in `server/` inserts a
 * `tenant.exception` row; the register is a migrator/seed projection."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §0  WHO MAY CALL THIS, AND WHY IT IS NOT "THE REQUEST PATH"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The INSERT this module issues is granted to `reconcile_engine` and to NO role
 * a request handler holds (`db/migrations/0500` §1). `0015`'s refusal stands for
 * the request path, unchanged: *"a request path that could INSERT an exception
 * could mint a finding against itself."* So `persistRaisedExceptions()` called
 * inside a request transaction is answered by the DATABASE with `permission
 * denied`, and `run-executor.ts` asks `has_table_privilege()` before calling it
 * at all — the property, not a landmark — so an executor driven over the app
 * pool (the existing suites, the demo-data witness) writes the account and
 * reports the exceptions as NOT PERSISTED rather than rolling the account back.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §1  WHAT IS RAISED: ONE EXCEPTION PER DECLARED RESIDUE ENTRY — G3745
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A residue entry is not yet an exception, and `model/reconciliation.ts` says why
 * in its own voice: *"A residue row HAS no severity … Defaulting to `'low'` would
 * buy a pass through the severity dial nobody set."* Five columns of
 * `tenant.exception` have no engine producer — rule id, version, label,
 * severity, and the definition's domain — so each comes from a DECLARATION
 * (`tenant.definition_exception_rule`, `reconciliation_definition.domain`) or
 * the entry raises nothing. **A withheld entry is not lost**: it is in
 * `run_residue` and `listRunResidue` publishes it. A guessed severity would be.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §2  TYPED FACTS ONLY — R-D, THE OWNER'S
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   `explanation_summary`   NULL, always. *"The sentence is composed where it is
 *                           displayed."* `0500` §2 makes it NULL in SQL too.
 *   `explanation_expected`  the declared RULE LABEL. `MatchRule.label`:
 *                           *"Human-readable; becomes the `expected` clause of
 *                           the explanation."* The operator's words, not ours
 *                           and not the counterparty's — so `0015`'s `NOT NULL`
 *                           is satisfied without a migration and without prose
 *                           this repository authored (G3746).
 *   `value_at_risk_*`       the entry's own SETTLEMENT RESIDUAL — what the engine
 *                           says is unsettled — written through
 *                           `model/money.ts`'s `formatMinorUnits()` (G111). A
 *                           fully allocated or unreadable item has NULL, never a
 *                           fabricated zero (`ResidueEntry.settlement`'s own
 *                           argument).
 *   `delta_*`               the `money` arm, a MAGNITUDE plus
 *                           `delta_money_direction` (G3803, `0510`): for
 *                           `amount_tolerance_declined` |signed variance| in
 *                           the side's DECLARED unit; for any other cause with
 *                           an open residual, that residual (`signedDeltaOf`).
 *                           ⚠️ THIS SAID *"for `amount_tolerance_declined`
 *                           only"* UNTIL 4 Oct 2026 and the sign was thrown
 *                           away — C3-02. `percentage` NULL: the bucket's
 *                           counterpart total is not on the residue row and a
 *                           percentage of a guessed base is a guess.
 *   observed values         the entry's own document's positions the engine
 *                           read — its amount and declared identifiers — exactly
 *                           as extracted, with the provenance and the data class
 *                           the definition declares. An undeclared class or an
 *                           absent position contributes NO row (invariant 4:
 *                           an unclassified position is unreadable).
 */

import type { ScopedClient } from '../../db/tenant-scope.ts'
import type {
  DataClass,
  DomainKey,
  ExtractedValue,
  FieldPath,
  Money,
  Severity,
  VarianceDirection,
} from '../../model/domain.ts'
import type { RunId } from '../../model/kernel.ts'
import type {
  PopulationSide,
  ReconciliationDocument,
  ResidueCause,
  ResidueEntry,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import { SEVERITY_ORDER } from '../../model/approval.ts'
import { fieldPathKey } from '../../model/field-path.ts'
import { formatMinorUnits } from '../../model/money.ts'
import type { StoredDefinition } from './definition-store.ts'
import { isPopulationSide, isResidueCauseKind } from './engine-vocabulary.ts'
import { isDomainKey, isSeverity } from './exception-vocabulary.ts'
import { pathTokens } from './run-account-store.ts'

/* ==================================================================== *
 * §3  THE DECLARATIONS
 * ==================================================================== */

export interface DeclaredRule {
  readonly ruleId: string
  readonly ruleVersion: number
  readonly ruleLabel: string
  readonly severity: Severity
}

export type ExceptionDeclarations =
  | {
      readonly kind: 'declarations'
      /** NULL = the definition declares no domain; nothing is raised (G3747). */
      readonly domain: DomainKey | null
      readonly rules: ReadonlyMap<string, DeclaredRule>
    }
  | { readonly kind: 'unreadable'; readonly table: string; readonly column: string }

function ruleKey(side: PopulationSide, cause: ResidueCause['kind']): string {
  return `${side}\u0000${cause}`
}

/**
 * Read what a definition declares its residue raises. Called BEFORE the engine,
 * so an unreadable declaration refuses the run the way an unreadable spec does
 * — nothing executed — rather than after an account has been written.
 */
export async function readExceptionDeclarations(
  tx: ScopedClient,
  definitionId: string,
): Promise<ExceptionDeclarations> {
  const def = (
    await tx.query('SELECT domain FROM tenant.reconciliation_definition WHERE id = $1', [
      definitionId,
    ])
  ).rows as unknown as { domain: string | null }[]
  const raw = def[0]?.domain ?? null
  if (raw !== null && !isDomainKey(raw)) {
    return { kind: 'unreadable', table: 'reconciliation_definition', column: 'domain' }
  }

  const rows = (
    await tx.query(
      `SELECT side, cause_kind, rule_id, rule_version, rule_label, severity
         FROM tenant.definition_exception_rule
        WHERE definition_id = $1`,
      [definitionId],
    )
  ).rows as unknown as {
    side: string
    cause_kind: string
    rule_id: string
    rule_version: number
    rule_label: string
    severity: string
  }[]

  const rules = new Map<string, DeclaredRule>()
  for (const r of rows) {
    if (!isPopulationSide(r.side)) {
      return { kind: 'unreadable', table: 'definition_exception_rule', column: 'side' }
    }
    if (!isResidueCauseKind(r.cause_kind)) {
      return { kind: 'unreadable', table: 'definition_exception_rule', column: 'cause_kind' }
    }
    if (!isSeverity(r.severity)) {
      return { kind: 'unreadable', table: 'definition_exception_rule', column: 'severity' }
    }
    rules.set(ruleKey(r.side, r.cause_kind), {
      ruleId: r.rule_id,
      ruleVersion: r.rule_version,
      ruleLabel: r.rule_label,
      severity: r.severity,
    })
  }
  return { kind: 'declarations', domain: raw, rules }
}

/* ==================================================================== *
 * §4  THE PROJECTION — pure, so it is witnessed without a database
 * ==================================================================== */

export interface RaisedObserved {
  readonly slot: string
  readonly path: FieldPath
  readonly lineIndex: number | null
  readonly sourceDocumentId: string
  readonly value: ExtractedValue
  readonly dataClass: DataClass
}

export interface RaisedException {
  readonly id: string
  readonly matchGroupId: string
  readonly side: PopulationSide
  readonly rule: DeclaredRule
  /**
   * 0 is critical. DERIVED from `SEVERITY_ORDER` and never a third table: the
   * column descends because a queue sorts ASC, the ladder ascends because a
   * threshold reads "at or above" (`model/approval.ts`'s own trap note).
   */
  readonly severityRank: number
  readonly valueAtRisk: Money | null
  /** A MAGNITUDE; `deltaDirection` carries the sign (G3803, `0510`). */
  readonly moneyDelta: Money | null
  readonly deltaDirection: VarianceDirection | null
  readonly observed: readonly RaisedObserved[]
}

export interface RunExceptionProjection {
  readonly raised: readonly RaisedException[]
  /** Residue entries whose (side, cause) has no declared rule. §1. */
  readonly withheld: number
}

export interface ProjectionInput {
  readonly runId: RunId
  readonly result: SetReconciliationResult
  readonly definition: StoredDefinition
  readonly left: readonly ReconciliationDocument[]
  readonly right: readonly ReconciliationDocument[]
  readonly slotOf: ReadonlyMap<string, string>
  readonly rules: ReadonlyMap<string, DeclaredRule>
}

function residualOf(entry: ResidueEntry): Money | null {
  const s = entry.settlement
  if (s === null) return null
  if (s.kind === 'unallocated' || s.kind === 'partially_allocated') return s.residual
  return null
}

/**
 * THE ROW'S SIGNED VARIANCE — G3803/G3804, the owner's C3-02/C3-09 ruling.
 *
 * The sign convention is the engine's own and is declared ONCE: `over` is the
 * LEFT side exceeding the RIGHT (`signedVarianceMinor = leftTotal −
 * rightTotal`). Two shapes, and together they make the register's Variance
 * column total the run's NET OPEN RESIDUAL (`getRunAccount`'s `openResidual`,
 * which the ruling names *"In variance"*):
 *
 *   `amount_tolerance_declined`  the engine's bucket figure, `leftTotal −
 *                                rightTotal` — for a 1:1 pair exactly the
 *                                left residual minus the right one.
 *   any other cause with an      the item's OWN open residual, `over` on the
 *   open residual                left and `under` on the right: an item with
 *                                no counterpart differs by all of itself.
 *
 * ⚠️ THE NETTING HOLDS WHEN EACH DECLINED BUCKET RAISES ONE EXCEPTION (G3805).
 *    Every member of a declined bucket carries the SAME bucket figure — the
 *    model says so at `ResidueCause` — so a definition declaring a declined
 *    rule on BOTH sides, or an N:M bucket with several members raising, counts
 *    the figure more than once. Named, not hidden; the demo definitions
 *    declare the declined rule on the left only.
 *
 * Zero has no sign, so a zero magnitude carries `null` (`0510`).
 */
export function signedDeltaOf(
  entry: ResidueEntry,
  declaredUnit: { readonly currency: string; readonly exponent: number },
): { readonly moneyDelta: Money | null; readonly deltaDirection: VarianceDirection | null } {
  if (entry.cause.kind === 'amount_tolerance_declined') {
    const signed = entry.cause.signedVarianceMinor
    return {
      moneyDelta: {
        currency: declaredUnit.currency,
        amountMinor: signed < 0n ? -signed : signed,
        exponent: declaredUnit.exponent,
      },
      deltaDirection: signed > 0n ? 'over' : signed < 0n ? 'under' : null,
    }
  }
  const residual = residualOf(entry)
  if (residual === null) return { moneyDelta: null, deltaDirection: null }
  return {
    moneyDelta: residual,
    deltaDirection: residual.amountMinor === 0n ? null : entry.side === 'left' ? 'over' : 'under',
  }
}

export function projectRunExceptions(input: ProjectionInput): RunExceptionProjection {
  const raised: RaisedException[] = []
  let withheld = 0

  input.result.residue.forEach((entry, ordinal) => {
    const rule = input.rules.get(ruleKey(entry.side, entry.cause.kind))
    if (rule === undefined) {
      withheld += 1
      return
    }
    const binding = entry.side === 'left' ? input.definition.left : input.definition.right
    const documents = entry.side === 'left' ? input.left : input.right

    /* 🛑 DETERMINISTIC IDS — `0500` §4. A second raise of the same run would
     * collide on `tenant.exception`'s primary key even if the account's own
     * key somehow did not; two independent guards, both witnessed. */
    const suffix = `${input.runId as string}_r${String(ordinal).padStart(4, '0')}`

    const { moneyDelta, deltaDirection } = signedDeltaOf(entry, binding.declaredUnit)

    const observed: RaisedObserved[] = []
    const docId = entry.ref.sourceDocumentId as string
    const document = documents.find((d) => (d.id as string) === docId)
    const slot = input.slotOf.get(docId)
    if (document !== undefined && slot !== undefined) {
      const fields =
        entry.ref.lineIndex === null
          ? document.extracted
          : document.lines.find((l) => l.index === entry.ref.lineIndex)?.fields
      for (const path of [binding.spec.amount, ...binding.spec.identifiers]) {
        const key = fieldPathKey(path)
        const value = fields?.[key]
        if (value === undefined || value.scalar.kind === 'absent') continue
        const dataClass = input.definition.fieldClassification.get(key)
        if (dataClass === undefined) continue
        observed.push({
          slot,
          path,
          lineIndex: entry.ref.lineIndex,
          sourceDocumentId: docId,
          value,
          dataClass,
        })
      }
    }

    raised.push({
      id: `exc_${suffix}`,
      matchGroupId: `mg_${suffix}`,
      side: entry.side,
      rule,
      severityRank: SEVERITY_ORDER.critical - SEVERITY_ORDER[rule.severity],
      valueAtRisk: residualOf(entry),
      moneyDelta,
      deltaDirection,
      observed,
    })
  })

  return { raised, withheld }
}

/* ==================================================================== *
 * §5  THE WRITER — inside the executor's ONE transaction, after the account
 * ==================================================================== */

export interface RaiseContext {
  readonly runId: RunId
  readonly definitionId: string
  readonly definitionVersion: number
  readonly domain: DomainKey
}

function minor(m: Money | null): string | null {
  return m === null ? null : formatMinorUnits(m.amountMinor)
}

export async function persistRaisedExceptions(
  tx: ScopedClient,
  context: RaiseContext,
  raised: readonly RaisedException[],
): Promise<void> {
  for (const x of raised) {
    /* `tenant_id` is the SCOPE's — invariant 1. RLS's `WITH CHECK` refuses any
     * other value, and the GUC is the only place the tenant is written. */
    await tx.query(
      `INSERT INTO tenant.exception (
         tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
         line_key, carried_forward_from, domain, definition_id, rule_label,
         severity, severity_rank,
         value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
         cost_centre, legal_entity, status, assigned_to, raised_at,
         explanation_summary, explanation_expected, explanation_confidence,
         delta_kind, delta_money_currency, delta_money_minor, delta_money_exponent,
         delta_money_direction, run_id)
       VALUES (
         current_setting('app.tenant_id'), $1, $2, $3, $4, $5,
         NULL, NULL, $6, $7, $8,
         $9, $10,
         $11, $12, $13,
         NULL, NULL, 'open', NULL, now(),
         NULL, $8, NULL,
         $14, $15, $16, $17,
         $19, $18)`,
      [
        x.id, x.matchGroupId, x.rule.ruleId, x.rule.ruleVersion, context.definitionVersion,
        context.domain, context.definitionId, x.rule.ruleLabel,
        x.rule.severity, x.severityRank,
        x.valueAtRisk?.currency ?? null, minor(x.valueAtRisk), x.valueAtRisk?.exponent ?? null,
        x.moneyDelta === null ? null : 'money',
        x.moneyDelta?.currency ?? null, minor(x.moneyDelta), x.moneyDelta?.exponent ?? null,
        context.runId,
        x.moneyDelta === null ? null : x.deltaDirection,
      ],
    )

    for (const [ordinal, o] of x.observed.entries()) {
      const s = o.value.scalar
      const p = o.value.provenance
      await tx.query(
        `INSERT INTO tenant.exception_observed_value (
           tenant_id, exception_id, ordinal, slot, path, line_index, source_document_id,
           scalar_kind, scalar_text, scalar_number, scalar_date,
           scalar_money_currency, scalar_money_minor, scalar_money_exponent,
           provenance_page, provenance_box_x, provenance_box_y,
           provenance_box_width, provenance_box_height, provenance_confidence,
           data_class)
         VALUES (current_setting('app.tenant_id'), $1, $2, $3, $4::jsonb, $5, $6,
                 $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          x.id, ordinal, o.slot, JSON.stringify(pathTokens(o.path)), o.lineIndex, o.sourceDocumentId,
          s.kind,
          s.kind === 'text' || s.kind === 'identifier' ? s.value : null,
          s.kind === 'number' ? s.value : null,
          s.kind === 'date' ? s.value : null,
          s.kind === 'money' ? s.value.currency : null,
          s.kind === 'money' ? formatMinorUnits(s.value.amountMinor) : null,
          s.kind === 'money' ? s.value.exponent : null,
          p.page,
          p.boundingBox?.x ?? null, p.boundingBox?.y ?? null,
          p.boundingBox?.width ?? null, p.boundingBox?.height ?? null,
          p.confidence,
          o.dataClass,
        ],
      )
    }
  }
}

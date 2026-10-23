/**
 * THE RECONCILIATION RESULT, WRITTEN INTO TYPED COLUMNS AND READ BACK AS THE
 * WIRE SHAPE THE CONTRACT DECLARES. G284, 19 Sep 2026.
 *
 * ┌─ WHY THIS FILE EXISTS AND NO HANDLER DOES ─────────────────────────────────┐
 * │ `docs/contracts/capability.openapi.yaml` says, of `getRunAccount` and       │
 * │ `listRunResidue`: **"The handler lands with the migration, in that          │
 * │ commit."** It does not, and that is a ruling rather than a shortfall.       │
 * │                                                                            │
 * │ **G200 was re-put to the owner on 19 Sep 2026 and the freeze was            │
 * │ reaffirmed: it binds until the gate GENUINELY ALLOWS SOMEBODY.** The gate   │
 * │ exists — `server/data-plane/authorise.ts` assembles a `PrincipalContext`    │
 * │ and asks `decide()` — and it answers `not_held` to every caller, because    │
 * │ three of `PrincipalContext`'s seven terms have no producer in this          │
 * │ database. Mounting either operation today ships a route that 403s for       │
 * │ everybody.                                                                 │
 * │                                                                            │
 * │ ⚠️ THE CONTRACT'S SENTENCE IS NOT THEREBY WRONG, AND ITS ARGUMENT IS WHY    │
 * │ THIS FILE IS NOT MERELY A SCHEMA COMMIT: *a column with no reader is a      │
 * │ column nothing checks*. So the reader lands now, shaped exactly as the      │
 * │ handlers will need it, and `tests/db/run-engine-account.test.ts` drives it  │
 * │ over a real PostgreSQL under `withTenantScope()`. **The commit that lifts   │
 * │ the freeze MOUNTS rather than builds.**                                     │
 * │                                                                            │
 * │ ✅ **IT LIFTED, AND THE HANDLER EXISTS — G300 AND G301, LATER ON 19 Sep      │
 * │ 2026. THE HEADING ABOVE IS NOW FALSE AND IS CORRECTED RATHER THAN           │
 * │ DELETED**, because *"WHY THIS FILE EXISTS AND NO HANDLER DOES"* is the      │
 * │ sentence a reader would have trusted before deciding whether to write one.  │
 * │ There IS one: **`server/data-plane/run-account.ts`**, and it is a ROUTE and │
 * │ nothing else — it calls §4 and §5 below and turns their three answers into  │
 * │ three status codes. **The prediction in the last line held exactly: that    │
 * │ commit mounted and built nothing.** What is also now false: *"it answers    │
 * │ `not_held` to every caller, because three of `PrincipalContext`'s seven     │
 * │ terms have no producer"* — `db/migrations/0009_identity_substrate.sql` gave │
 * │ all three a producer earlier the same day, which is the condition G296 set  │
 * │ and G300 found met. `tests/http/run-account-served.test.ts` drives both     │
 * │ operations over a socket against the PRODUCTION authoriser.                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ─── WHAT THE TWO READ FUNCTIONS ANSWER, AND THE THIRD ANSWER THAT MATTERS ───
 *
 * `readRunEngineAccount()` and `readRunResiduePage()` each return one of THREE
 * things, and the third is the one a plausible implementation loses:
 *
 *   `account` / `page`   the engine's own account, every channel present.
 *   `no_account`         **this run has no engine account.** NOT an empty
 *                        account and NOT an empty page — see below.
 *   `unpublishable`      a stored row carries a value the model does not name.
 *
 * 🛑 `no_account` IS A STATED ANSWER AND NOT A ZERO. An empty `RunEngineAccount`
 *    — ten empty channels and a `terminalStatus` of `completed` — would report a
 *    CLEAN CLOSE for a run nobody reconciled, which is precisely the fabrication
 *    `server/data-plane/runs.ts` refuses when it publishes `completeness: null`
 *    rather than `[]`:
 *
 *        `[]`    the ENGINE ran and observed no shortfall.
 *        `null`  this plane holds NO ENGINE ACCOUNT for this run at all.
 *
 *    The envelope row in `tenant.run_engine_account` is what turns that constant
 *    `null` into a derived fact. **An empty channel under an existing envelope
 *    is an OBSERVATION; an absent envelope is an absence, and they are different
 *    facts about the same run.**
 *
 * ⚠️ AND `no_account` COLLAPSES TWO CASES TODAY, WHICH IS A LOSS AND IS NAMED.
 *    `0007` persists the `produced` arm only; `RunRefusal` is fifteen arms and a
 *    second slice. So *"this run has not been reconciled"* and *"this run was
 *    REFUSED, and the refusal is the output"* are one answer here. The wire's own
 *    description is the measure of what that costs: *"before this operation
 *    existed the only thing a consumer could learn about a refused run was the
 *    word `failed` on `Run.status` — fifteen distinct refusals with fifteen
 *    distinct remedies flattened into one word."* The refused arm's migration is
 *    what un-flattens it.
 *
 * ─── INVARIANT 1 — READ THE SQL BELOW AND NOTE WHAT IS NOT IN IT ───
 *
 * 🛑 THERE IS NO TENANT PREDICATE IN ANY STATEMENT HERE. No `WHERE tenant_id =
 *    $1`, no `tenantId` bound anywhere, no filter a reviewer has to remember —
 *    and that includes the INSERTs, where the tenant column is supplied by
 *    `current_setting('app.tenant_id')` **through the policy's `WITH CHECK`**
 *    rather than by this module. Isolation is produced entirely by row-level
 *    security, reached through `withTenantScope()`, exactly as
 *    `server/data-plane/runs.ts` does it and for the reason that file gives.
 *
 *    That is asserted, not assumed: `tests/db/run-engine-account.test.ts`
 *    disables RLS on `tenant.run_engine_account` underneath this reader and
 *    requires the SAME call to LEAK — *"the only way to tell isolation produced
 *    by the database from isolation produced by a `WHERE` a handler happens to
 *    carry."* Since 19 Sep 2026 the same control exists one layer up, over a
 *    socket, in `tests/http/run-account-served.test.ts` §4a-control — and it
 *    earned its place immediately: with the two mounts deleted, four of that
 *    file's isolation assertions stayed GREEN and only the leak control went
 *    red, because a route that does not exist and a route that refuses another
 *    tenant correctly are indistinguishable from outside.
 *
 * ⚠️ AND NOTE WHAT IS ALSO NOT HERE: A TRANSACTION. Every function below takes a
 *    `ScopedClient`, never a pool. `withTenantScope()` issues `BEGIN`, then
 *    `SELECT set_config('app.tenant_id', $1, true)`, then `COMMIT`/`ROLLBACK`;
 *    `SET LOCAL` outside a transaction block is SILENTLY DISCARDED by
 *    PostgreSQL, so a module that opened its own would be one autocommit away
 *    from serving every tenant's rows with RLS reporting success. **A signature
 *    that took a pool would make the mistake available; this one does not.**
 *
 * ─── G286 — MONEY IS `bigint`, THE COLUMN IS `int8`, THE WIRE IS A STRING ───
 *
 * 🛑 `pg` RETURNS `int8` AS A STRING BY DEFAULT, AND THAT IS NOT A DETAIL TO
 *    WORK AROUND — IT IS THE WIRE FORM ALREADY. `Money.amountMinor` on the wire
 *    is `{type: string, pattern: '^-?[0-9]+$'}` because *"JSON has no bigint"*
 *    and a JSON number is an IEEE double that loses exactness above 2^53.
 *
 *    **The string is nonetheless not passed through unread.** Every minor-unit
 *    column goes through `parseMinorUnits()` on the way out and
 *    `formatMinorUnits()` on the way back in, which is G111's rule — *"ONE money
 *    codec module, and it is the only thing permitted to touch the
 *    representation"* — applied at a database boundary. What that buys, beyond
 *    tidiness: `parseMinorUnits()` carries `guardMinor`, so a column value
 *    outside −2^63 … 2^63−1 is refused HERE rather than published, and
 *    `exceeds_exact_integer_range` *"names the `int8` bound"* exactly.
 *
 * ⚠️ THE CONVERSE, ON THE WRITE SIDE: a `bigint` is bound as its decimal string
 *    and NOT as a JS `BigInt`. `formatMinorUnits()` is the only conversion out
 *    of the representation, and PostgreSQL casts the literal to `int8` on a
 *    column that is `int8`. Nothing here constructs a `Number` from an amount.
 */

import {
  POSTCONDITION_PROPERTY,
  type AdmissionRate,
  type Allocation,
  type AmbiguityFinding,
  type CompletenessFinding,
  type HeldRead,
  type MeterFact,
  type PopulationDefect,
  type PostconditionFailure,
  type RefusedItem,
  type ResidueEntry,
  type RunDocumentAccount,
  type SearchBoundaryEntry,
  type SetReconciliationRefusal,
  type SetReconciliationResult,
  type TerminalRunStatus,
} from '../../model/reconciliation.ts'
import { addMoney, formatMinorUnits, parseMinorUnits, subtractMoney } from '../../model/money.ts'
import type { Money } from '../../model/domain.ts'
import { parseFieldPath } from '../../model/field-path.ts'
import type { FieldPath } from '../../model/kernel.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import {
  isAdmissionRefusalKind,
  isCompletenessFindingKind,
  isControlTotalKind,
  isEngineDisposition,
  isEngineMeter,
  isExtractedScalarKind,
  isExtractionRefusalKind,
  isItemSettlementKind,
  isMoneyRefusalKind,
  isNormalisationDefectKind,
  isPairingEvidenceKind,
  isPairingStrategyKind,
  isPopulationDefectKind,
  isPopulationSide,
  isPostconditionKind,
  isReaderRefusalKind,
  isResidueCauseKind,
  isSimilarityMetric,
  isWaterfallFellThroughFrom,
  isRunRefusalKind,
  isTerminalRunStatus,
  isToleranceRoute,
  isTrailerVerdictKind,
} from './engine-vocabulary.ts'

/* ==================================================================== *
 * §1  THE WIRE SHAPES
 *
 * ⚠️ THESE ARE `Record<string, unknown>`-SHAPED OBJECT LITERALS AND NOT A
 *    HAND-WRITTEN MIRROR OF EVERY SCHEMA, AND THE CHOICE IS DELIBERATE.
 *    `server/contract/` already makes the OpenAPI document the router and the
 *    validator; a TypeScript restatement of `RunEngineAccount` here would be a
 *    SECOND declaration of the response, and the one nothing checks — §5.3, and
 *    the exact failure `0002_run.sql`'s header names one layer down. The types
 *    that ARE named below are the model's, which is where they are checked.
 * ==================================================================== */

/** What a row carried that the model cannot name. **Carries no cell value.** */
export interface AccountDefect {
  readonly table: string
  readonly column: string
  readonly runId: string
}

export type AccountRead =
  | { readonly kind: 'no_account' }
  | { readonly kind: 'account'; readonly account: Record<string, unknown> }
  | { readonly kind: 'unpublishable'; readonly defect: AccountDefect }

export type ResidueRead =
  | { readonly kind: 'no_account' }
  | {
      readonly kind: 'page'
      readonly items: readonly Record<string, unknown>[]
      readonly nextCursor: string | null
    }
  | { readonly kind: 'unpublishable'; readonly defect: AccountDefect }

/* ==================================================================== *
 * §2  THE CODECS — money, paths, refs
 * ==================================================================== */

/**
 * A `FieldPath` in the STORED form `model/field-path.ts` pins: *"A STRING
 * member is a key segment; a NUMBER member is an array index. That is the
 * entire encoding and there is nothing in it to escape."* WRITE side only.
 *
 * ⚠️ THIS SAID *"in the wire form `model/field-path.ts` pins"* UNTIL 1 Oct 2026
 *    AND IT WAS THE DEFECT, NOT A SLIP OF THE PEN — G2375, G2471. The token list
 *    is what a `jsonb` column holds; it is NOT what `capability.openapi.yaml`'s
 *    `FieldPath` publishes, which is an array of `FieldSegment` OBJECTS. The
 *    sentence let `pathIn()` reuse this function on the READ side, and three
 *    channels went to the wire as bare tokens and a 500.
 *
 * 🛑 NOTHING HERE JOINS, SPLITS OR ESCAPES. A dotted form breaks on any key
 *    containing a dot, which is legal JSON, *"and its failure mode is that it
 *    silently addresses the WRONG key rather than refusing — scope failing
 *    open."* That is the defect G214 was taken to remove and it must not be
 *    reintroduced at a storage boundary.
 */
export function pathTokens(path: FieldPath): readonly (string | number)[] {
  return path.map((segment) => (segment.kind === 'index' ? segment.index : segment.key))
}

/**
 * The reverse, through the ONE seam, and out in the WIRE form. `parseFieldPath()`
 * is *"the only mint in the repository"*, so a stored path that is not a token
 * list is refused here rather than being cast into one.
 *
 * 🛑 THIS IS THE ONE STORE→WIRE CONVERSION FOR EVERY PATH THIS MODULE PUBLISHES
 *    — G2375 DISCHARGED, G2471. `HeldRead.path`, `RefusedItem.path`,
 *    `AmbiguityFinding.on` and `PairingEvidence.on` (`listRunAllocations`) all
 *    leave through it, and nothing else in this file may shape a stored path for
 *    a response.
 *
 *      STORED  `["lines", 7, "amount"]` — strings and numbers.
 *      WIRE    `[{kind:'key',key:'lines'}, {kind:'index',index:7}, …]` — the
 *              contract's `FieldSegment` `oneOf`.
 *
 *    `parsed.path` IS ALREADY THE WIRE SHAPE, because `model/kernel.ts`'s
 *    `FieldSegment` is declared as exactly that union — so the conversion is to
 *    return it unchanged, and the mistake is to flatten it. Until this commit
 *    this function returned `pathTokens(parsed.path)`, the STORED form; the
 *    serialiser could match neither `oneOf` arm and threw, and the first served
 *    row carrying a held read, a path-bearing refused item or an ambiguity `on`
 *    was a 500. Witnessed RED at `tests/http/run-path-wire-served.test.ts`.
 *
 * ⚠️ `segmentsOut()` IS DELETED, NOT KEPT BESIDE THIS. It rebuilt the segment
 *    objects from the tokens this function had just flattened — a round trip
 *    through the wrong form, and a SECOND conversion (§5.3) that the
 *    allocation channel was correct only by calling. The encoding it produced
 *    is the encoding this returns; the allocation evidence now reaches it here.
 *
 * ⚠️ `server/data-plane/exception-store.ts` carries a function of the same
 *    name and the same body, which is correct and is a second copy of this
 *    seam. Folding the two is a separate cleanup (G2473), not this repair.
 */
function pathIn(value: unknown): FieldPath | null {
  const parsed = parseFieldPath(value)
  return parsed.ok ? parsed.path : null
}

/**
 * An `int8` column, out of `pg`'s string and back to one — through the codec.
 * `null` in, `null` out; a malformed or out-of-range value answers `'refused'`,
 * which the caller turns into an `AccountDefect`.
 */
function minorIn(value: unknown): string | null | 'refused' {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return 'refused'
  const parsed = parseMinorUnits(value)
  return parsed.ok ? formatMinorUnits(parsed.value) : 'refused'
}

function minorOut(value: bigint | null): string | null {
  return value === null ? null : formatMinorUnits(value)
}

/* ==================================================================== *
 * §3  THE WRITER
 *
 * 🛑 IT TAKES A `SetReconciliationResult` AND NOT A BAG OF CHANNELS. The engine
 *    produces one value; a signature that took ten arrays would let a caller
 *    supply nine, and the missing one would be stored as an empty channel —
 *    which reads as *"the engine observed nothing"* rather than as *"nobody
 *    passed it"*. That is the `[]`-versus-`null` confusion this whole slice
 *    exists to remove, arriving through the front door.
 *
 * ⚠️ `terminalStatus` IS COMPUTED HERE, BY THE MODEL, AND IS NOT A PARAMETER.
 *    `terminalRunStatus()` derives it from `postconditions` plus `completeness`
 *    plus `POSTCONDITION_PROPERTY`, and *"soundness outranks completeness"*. A
 *    caller-supplied status could disagree with the channels stored beside it in
 *    the same row, and nothing would be able to tell which was wrong.
 *
 * ⚠️ SEVEN OF `SetReconciliationResult`'s SEVENTEEN PROPERTIES ARE NOT WRITTEN,
 *    AND THAT IS `0002_run.sql`'s RULE RATHER THAN AN OVERSIGHT — *"They land
 *    with the schemas that publish them."* `state`, `readerRequests`,
 *    `toleranceRefusals` and G291's `toleranceDeclines` reach no contract tier;
 *    ✅ **`state.allocations` IS WRITTEN SINCE 1 Oct 2026 — R13, THE OWNER'S —
 *    and the clause above is corrected rather than deleted for that one
 *    property.** `listRunAllocations` publishes it, so `0002`'s condition is
 *    met; `state.items` is still NOT written, because an `AdmittedItem` carries
 *    the counterparty-authored fields R13 refuses, and the allocation loop at
 *    the foot of this function reads only `side` and `ref` off one;
 *    `0007`'s header carries the derivation and the argument, including why
 *    publishing ONE tolerance channel would be worse than publishing neither.
 * ==================================================================== */

export interface PersistInput {
  readonly runId: string
  readonly terminalStatus: TerminalRunStatus
  readonly result: SetReconciliationResult
}

export async function persistRunEngineAccount(tx: ScopedClient, input: PersistInput): Promise<void> {
  const { runId, result } = input

  /* THE TENANT COLUMN IS `current_setting('app.tenant_id')` AND NOT A BOUND
   * PARAMETER, WHICH IS THE INSERT-SIDE FORM OF THIS FILE'S HEADER RULE. The
   * value cannot be supplied by a caller, so an insert into another tenant is
   * not merely refused by `WITH CHECK` — it is unexpressible. And because the
   * GUC is `SET LOCAL` inside `withTenantScope()`'s transaction, a statement
   * issued outside one reads NULL and the policy denies (G100). */
  const T = "nullif(current_setting('app.tenant_id', true), '')"

  await tx.query(
    `INSERT INTO tenant.run_engine_account (tenant_id, run_id, outcome, terminal_status)
     VALUES (${T}, $1, 'produced', $2)`,
    [runId, input.terminalStatus],
  )

  for (const rate of result.admissionRates) {
    await tx.query(
      `INSERT INTO tenant.run_admission_rate
         (tenant_id, run_id, side, presented, admitted, refused)
       VALUES (${T}, $1, $2, $3, $4, $5)`,
      [runId, rate.side, rate.presented, rate.admitted, rate.refused],
    )
  }

  for (const [ordinal, account] of result.documentAccounts.entries()) {
    await tx.query(
      `INSERT INTO tenant.run_document_account
         (tenant_id, run_id, ordinal, side, source_document_id, trailer,
          declared_line_count, declared_minor, declared_exponent,
          presented, admitted, refused, verdict_kind)
       VALUES (${T}, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        runId,
        ordinal,
        account.side,
        account.sourceDocumentId,
        account.trailer,
        account.declaredLineCount,
        minorOut(account.declaredMinor),
        account.declaredExponent,
        account.presented,
        account.admitted,
        account.refused,
        account.verdict.kind,
      ],
    )
    if (account.verdict.kind === 'reported') {
      await writeDefects(tx, T, runId, 'document_account', ordinal, account.verdict.defects)
    }
  }

  for (const [ordinal, item] of result.refusedAtAdmission.entries()) {
    const r = item.refusal
    await tx.query(
      `INSERT INTO tenant.run_refused_item
         (tenant_id, run_id, ordinal, side, ref_source_document_id, ref_line_index, path,
          refusal_kind, refusal_found, refusal_extraction_kind, refusal_money_kind)
       VALUES (${T}, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        runId,
        ordinal,
        item.side,
        item.ref.sourceDocumentId,
        item.ref.lineIndex,
        JSON.stringify(pathTokens(item.path)),
        r.kind,
        r.kind === 'amount_not_money' || r.kind === 'date_not_extractable' ? r.found : null,
        r.kind === 'identifier_not_extractable' ? r.refusal.kind : null,
        r.kind === 'money_unit_disagrees_with_declared' || r.kind === 'amount_not_exact_money'
          ? r.refusal.kind
          : null,
      ],
    )
  }

  for (const [ordinal, finding] of result.ambiguities.entries()) {
    await tx.query(
      `INSERT INTO tenant.run_ambiguity
         (tenant_id, run_id, ordinal, on_path, strategy_kind, left_candidates, right_candidates)
       VALUES (${T}, $1, $2, $3, $4, $5, $6)`,
      [
        runId,
        ordinal,
        finding.on === null ? null : JSON.stringify(pathTokens(finding.on)),
        finding.strategyKind,
        finding.leftCandidates,
        finding.rightCandidates,
      ],
    )
    for (const [side, refs] of [
      ['left', finding.leftRefs],
      ['right', finding.rightRefs],
    ] as const) {
      for (const [at, ref] of refs.entries()) {
        await tx.query(
          `INSERT INTO tenant.run_ambiguity_ref
             (tenant_id, run_id, ambiguity_ordinal, side, ordinal,
              source_document_id, line_index)
           VALUES (${T}, $1, $2, $3, $4, $5, $6)`,
          [runId, ordinal, side, at, ref.sourceDocumentId, ref.lineIndex],
        )
      }
    }
  }

  for (const [channel, entries] of [
    ['oversized_buckets', result.searchBoundary.oversizedBuckets],
    ['exhausted_searches', result.searchBoundary.exhaustedSearches],
    ['oversized_amount_buckets', result.searchBoundary.oversizedAmountBuckets],
  ] as const) {
    for (const [ordinal, entry] of entries.entries()) {
      await tx.query(
        `INSERT INTO tenant.run_search_boundary_entry
           (tenant_id, run_id, channel, ordinal, item_count,
            example_source_document_id, example_line_index)
         VALUES (${T}, $1, $2, $3, $4, $5, $6)`,
        [
          runId,
          channel,
          ordinal,
          entry.itemCount,
          entry.exampleRef.sourceDocumentId,
          entry.exampleRef.lineIndex,
        ],
      )
    }
  }

  for (const [ordinal, failure] of result.postconditions.entries()) {
    await tx.query(
      `INSERT INTO tenant.run_postcondition
         (tenant_id, run_id, ordinal, kind, count, admitted_minor, accounted_minor,
          side, side_row_count)
       VALUES (${T}, $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        runId,
        ordinal,
        failure.kind,
        'count' in failure ? failure.count : null,
        failure.kind === 'gross_not_partitioned' ? formatMinorUnits(failure.admittedMinor) : null,
        failure.kind === 'gross_not_partitioned' ? formatMinorUnits(failure.accountedMinor) : null,
        'side' in failure ? failure.side : null,
        failure.kind === 'population_wholly_refused' ? failure.sideRowCount : null,
      ],
    )
    if (failure.kind === 'population_integrity_reported') {
      await writeDefects(tx, T, runId, 'postcondition', ordinal, [failure.defect])
    }
  }

  for (const [ordinal, finding] of result.completeness.entries()) {
    await tx.query(
      `INSERT INTO tenant.run_completeness
         (tenant_id, run_id, ordinal, kind, side, presented, admitted, refused)
       VALUES (${T}, $1, $2, $3, $4, $5, $6, $7)`,
      [
        runId,
        ordinal,
        finding.kind,
        finding.side,
        finding.kind === 'rows_presented_not_admitted' ? finding.presented : null,
        finding.kind === 'rows_presented_not_admitted' ? finding.admitted : null,
        finding.kind === 'rows_presented_not_admitted' ? finding.refused : null,
      ],
    )
    if (finding.kind === 'source_self_report_unmet') {
      await writeDefects(tx, T, runId, 'completeness', ordinal, [finding.defect])
    }
  }

  for (const [ordinal, fact] of result.meterFacts.entries()) {
    await tx.query(
      `INSERT INTO tenant.run_meter_fact
         (tenant_id, run_id, ordinal, meter, quantity, idempotency_key, model_entry_id)
       VALUES (${T}, $1, $2, $3, $4, $5, $6)`,
      [runId, ordinal, fact.meter, fact.quantity, fact.idempotencyKey, fact.modelEntryId],
    )
  }

  for (const [ordinal, entry] of result.residue.entries()) {
    const s = entry.settlement
    const allocated = s !== null && 'allocated' in s ? s.allocated : null
    const residual = s !== null && 'residual' in s ? s.residual : null
    const c = entry.cause
    await tx.query(
      `INSERT INTO tenant.run_residue
         (tenant_id, run_id, ordinal, side, ref_source_document_id, ref_line_index,
          settlement_kind,
          settlement_allocated_currency, settlement_allocated_minor, settlement_allocated_exponent,
          settlement_residual_currency,  settlement_residual_minor,  settlement_residual_exponent,
          disposition, cause_kind,
          cause_admission_refusal_kind, cause_admission_found,
          cause_admission_extraction_kind, cause_admission_money_kind,
          cause_reader_refusal_kind, cause_signed_variance_minor)
       VALUES (${T}, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $19, $20)`,
      [
        runId,
        ordinal,
        entry.side,
        entry.ref.sourceDocumentId,
        entry.ref.lineIndex,
        s === null ? null : s.kind,
        allocated === null ? null : allocated.currency,
        allocated === null ? null : formatMinorUnits(allocated.amountMinor),
        allocated === null ? null : allocated.exponent,
        residual === null ? null : residual.currency,
        residual === null ? null : formatMinorUnits(residual.amountMinor),
        residual === null ? null : residual.exponent,
        entry.disposition,
        c.kind,
        c.kind === 'admission_refused' ? c.refusal.kind : null,
        c.kind === 'admission_refused' &&
        (c.refusal.kind === 'amount_not_money' || c.refusal.kind === 'date_not_extractable')
          ? c.refusal.found
          : null,
        c.kind === 'admission_refused' && c.refusal.kind === 'identifier_not_extractable'
          ? c.refusal.refusal.kind
          : null,
        c.kind === 'admission_refused' &&
        (c.refusal.kind === 'money_unit_disagrees_with_declared' ||
          c.refusal.kind === 'amount_not_exact_money')
          ? c.refusal.refusal.kind
          : null,
        c.kind === 'reader_refused' ? c.refusal.kind : null,
        c.kind === 'amount_tolerance_declined' ? formatMinorUnits(c.signedVarianceMinor) : null,
      ],
    )
    for (const [at, held] of entry.heldReads.entries()) {
      await tx.query(
        `INSERT INTO tenant.run_held_read
           (tenant_id, run_id, residue_ordinal, ordinal,
            ref_source_document_id, ref_line_index, path, read_confidence, floor)
         VALUES (${T}, $1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          runId,
          ordinal,
          at,
          held.ref.sourceDocumentId,
          held.ref.lineIndex,
          JSON.stringify(pathTokens(held.path)),
          held.readConfidence,
          held.floor,
        ],
      )
    }
  }

  /* 🛑 R13 — G2371/G2373, 1 Oct 2026. WHAT MATCHED, AS IDS AND AMOUNTS, IN THE
   * SAME TRANSACTION AS THE ENVELOPE. Before this loop a fully matched run
   * stored an empty residue and nothing else — indistinguishable from a run
   * whose pairs were never recorded.
   *
   * ⚠️ THE KEYS ARE RESOLVED, NEVER STORED. `fromKey`/`toKey` are `itemKey()`
   * strings, which the wire refuses as identifiers; each is looked up in
   * `state.items` and ONLY `side` and `ref` are read off the item. The item's
   * `identifiers`, `counterparty` and `untrustedDescription` — the three
   * counterparty-authored fields — are never touched here, and `0260` has no
   * column that could hold one. **Invariant 6 held by absence.**
   *
   * ⚠️ A KEY THE STATE DOES NOT HOLD THROWS, which rolls the whole account back.
   * Storing the half of an allocation we can name would be a ledger that sums
   * to something the engine never computed. */
  for (const allocation of result.state.allocations) {
    const from = result.state.items.get(allocation.fromKey)
    const to = result.state.items.get(allocation.toKey)
    if (from === undefined || to === undefined) {
      throw new Error(
        `R13: allocation names an item the state does not hold (run ${runId}, ordinal ${allocation.ordinal}); ` +
          'the engine account is not written.',
      )
    }
    const e = allocation.evidence
    await tx.query(
      `INSERT INTO tenant.run_allocation
         (tenant_id, run_id, ordinal,
          from_side, from_source_document_id, from_line_index,
          to_side,   to_source_document_id,   to_line_index,
          amount_currency, amount_minor, amount_exponent,
          evidence_kind, evidence_on_path, evidence_signed_variance_minor,
          evidence_day_gap, evidence_member_count, evidence_fell_through_from,
          evidence_similarity_basis_points, evidence_metric,
          evidence_confidence_basis_points, evidence_model_entry_id)
       VALUES (${T}, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $19, $20, $21)`,
      [
        runId,
        allocation.ordinal,
        from.side,
        from.ref.sourceDocumentId,
        from.ref.lineIndex,
        to.side,
        to.ref.sourceDocumentId,
        to.ref.lineIndex,
        allocation.amount.currency,
        formatMinorUnits(allocation.amount.amountMinor),
        allocation.amount.exponent,
        e.kind,
        e.kind === 'exact_identifier' || e.kind === 'tolerant_identifier'
          ? JSON.stringify(pathTokens(e.on))
          : null,
        e.kind === 'tolerant_identifier' ? formatMinorUnits(e.signedVarianceMinor) : null,
        e.kind === 'amount_and_date' ? e.dayGap : null,
        e.kind === 'amount_sum_exact' ? e.memberCount : null,
        e.kind === 'amount_sum_waterfall' ? e.fellThroughFrom : null,
        e.kind === 'fuzzy_reference' ? e.similarityBasisPoints : null,
        e.kind === 'fuzzy_reference' ? e.metric : null,
        e.kind === 'reader_confirmed' ? e.confidenceBasisPoints : null,
        e.kind === 'reader_confirmed' ? e.modelEntryId : null,
      ],
    )
  }
}

/**
 * One vocabulary, three owners — see `0007`'s §4 for why this is a single table
 * and what the polymorphic parent pointer costs.
 */
async function writeDefects(
  tx: ScopedClient,
  T: string,
  runId: string,
  /**
   * ⚠️ A FOURTH OWNER SINCE 21 Sep 2026 — `'refusal'`, G1512. `0007` names
   * three on the column itself and carries no `CHECK` there, deliberately, so
   * this widening is a type change and no schema change. The alternative was a
   * second defect table, which would have been two spellings of one
   * `PopulationDefect` codec — §5.3, and the copy is the one that drifts.
   */
  owner: 'document_account' | 'postcondition' | 'completeness' | 'refusal',
  ownerOrdinal: number,
  defects: readonly PopulationDefect[],
): Promise<void> {
  for (const [ordinal, d] of defects.entries()) {
    await tx.query(
      `INSERT INTO tenant.run_population_defect
         (tenant_id, run_id, owner, owner_ordinal, ordinal, kind,
          ref_source_document_id, ref_line_index, occurrences,
          refused_count, side_row_count, ceiling_basis_points,
          source_document_id, declared_count, document_row_count, admitted_count,
          money_refusal_kind, declared_minor, declared_exponent,
          admitted_minor, admitted_exponent)
       VALUES (${T}, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, $18, $19, $20)`,
      [
        runId,
        owner,
        ownerOrdinal,
        ordinal,
        d.kind,
        d.kind === 'duplicate_item_address' ? d.ref.sourceDocumentId : null,
        d.kind === 'duplicate_item_address' ? d.ref.lineIndex : null,
        d.kind === 'duplicate_item_address' ? d.occurrences : null,
        d.kind === 'admission_refusal_rate_above_ceiling' ? d.refusedCount : null,
        d.kind === 'admission_refusal_rate_above_ceiling' ? d.sideRowCount : null,
        d.kind === 'admission_refusal_rate_above_ceiling' ? d.ceilingBasisPoints : null,
        'sourceDocumentId' in d ? d.sourceDocumentId : null,
        d.kind === 'declared_line_count_disagrees' ? d.declaredCount : null,
        d.kind === 'declared_line_count_disagrees'
          ? d.documentRowCount
          : d.kind === 'control_total_unverifiable_rows_refused'
            ? d.documentRowCount
            : null,
        d.kind === 'control_total_unverifiable_rows_refused' ? d.admittedCount : null,
        d.kind === 'control_total_not_evaluable' ? d.refusal.kind : null,
        d.kind === 'declared_control_total_disagrees' ? formatMinorUnits(d.declaredMinor) : null,
        d.kind === 'declared_control_total_disagrees' ? d.declaredExponent : null,
        d.kind === 'declared_control_total_disagrees' ? formatMinorUnits(d.admittedMinor) : null,
        d.kind === 'declared_control_total_disagrees' ? d.admittedExponent : null,
      ],
    )
  }
}

/* ==================================================================== *
 * §3a  THE REFUSED ARM'S WRITER — E6, G1511–G1514, 21 Sep 2026
 *
 * 🛑 IT IS A SECOND FUNCTION BESIDE `persistRunEngineAccount()` AND NOT A
 *    BRANCH INSIDE IT, AND THE REASON IS THE TYPE. `SetReconciliationOutcome`
 *    is `{ ok: true; result } | { ok: false; refusal }` — two arms with NO
 *    common payload — so one function taking both would take a union and
 *    narrow it immediately, which is a switch wearing a signature. Two
 *    functions means the CALLER narrows once, at the outcome, where the
 *    compiler is already making it.
 *
 * ⚠️ **AND IT WRITES THE ENVELOPE ITSELF.** `run_engine_account` carries the
 *    `outcome` discriminant, so a refused run needs a row there too —
 *    `terminal_status` NULL, which `0007` declares nullable in its own voice:
 *    *"NULL on the refused arm, which carries no terminal status because it
 *    carries no ledger."* A refusal row with no envelope is unrepresentable
 *    (`0190` §1's foreign key), so these two inserts are one act.
 * ==================================================================== */

export interface PersistRefusalInput {
  readonly runId: string
  readonly refusal: SetReconciliationRefusal
}

export async function persistRunRefusal(
  tx: ScopedClient,
  input: PersistRefusalInput,
): Promise<void> {
  const { runId, refusal } = input

  /* The GUC and never a bound parameter — see `persistRunEngineAccount()`. */
  const T = "nullif(current_setting('app.tenant_id', true), '')"

  await tx.query(
    `INSERT INTO tenant.run_engine_account (tenant_id, run_id, outcome, terminal_status)
     VALUES (${T}, $1, 'refused', NULL)`,
    [runId],
  )

  /* 🛑 EVERY OPERAND IS READ THROUGH A NARROWED `refusal.kind ===` AND NEVER
   * THROUGH AN `in` CHECK OR A CAST. Twelve arms share one row, and the
   * compiler is what guarantees `expected` is only read where it exists. */
  const moneyRefusalKind =
    refusal.kind === 'declared_unit_invalid' ||
    refusal.kind === 'declared_units_disagree' ||
    refusal.kind === 'tolerance_unit_disagrees'
      ? refusal.refusal.kind
      : null

  await tx.query(
    `INSERT INTO tenant.run_refusal
       (tenant_id, run_id, kind, side, expected, supplied, binding_index,
        money_refusal_kind, tolerance_route, tolerance_index,
        ref_source_document_id, ref_line_index, source_document_id)
     VALUES (${T}, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      runId,
      refusal.kind,
      /* SEVEN of the fifteen arms carry a side. `'side' in refusal` would be
       * shorter and is refused: an `in` check is a runtime guess where the
       * union is already a compile-time fact, and it would keep admitting a
       * sixteenth arm silently. */
      refusal.kind === 'normalisation_invalid' ||
      refusal.kind === 'declared_unit_invalid' ||
      refusal.kind === 'population_integrity_refused' ||
      refusal.kind === 'admitted_item_key_collision' ||
      refusal.kind === 'control_total_expected_but_absent' ||
      refusal.kind === 'population_empty_and_not_expected'
        ? refusal.side
        : null,
      refusal.kind === 'strategy_binding_count_mismatch' ? refusal.expected : null,
      refusal.kind === 'strategy_binding_count_mismatch' ? refusal.supplied : null,
      refusal.kind === 'strategy_binding_kind_mismatch' ? refusal.index : null,
      moneyRefusalKind,
      refusal.kind === 'tolerance_unit_disagrees' ? refusal.tolerance.kind : null,
      refusal.kind === 'tolerance_unit_disagrees' && refusal.tolerance.kind === 'strategy_binding'
        ? refusal.tolerance.index
        : null,
      refusal.kind === 'admitted_item_key_collision' ? refusal.ref.sourceDocumentId : null,
      /* ⚠️ NULL IS A LEGITIMATE VALUE INSIDE THIS ARM — `ItemRef.lineIndex` is
       * `number | null` and a null means HEADER GRAIN. The reader therefore
       * discriminates on `ref_source_document_id`, never on this. */
      refusal.kind === 'admitted_item_key_collision' ? refusal.ref.lineIndex : null,
      refusal.kind === 'control_total_expected_but_absent' ? refusal.sourceDocumentId : null,
    ],
  )

  if (refusal.kind === 'normalisation_invalid') {
    for (const [ordinal, defect] of refusal.defects.entries()) {
      await tx.query(
        `INSERT INTO tenant.run_refusal_normalisation_defect
           (tenant_id, run_id, ordinal, kind, op_index)
         VALUES (${T}, $1, $2, $3, $4)`,
        [
          runId,
          ordinal,
          defect.kind,
          defect.kind === 'max_input_chars_not_stated' ? null : defect.opIndex,
        ],
      )
    }
  }

  /* G1512 — the fourth owner. `owner_ordinal` is 0 because a refusal carries
   * ONE defect list, exactly as `0007` says of its two single-defect owners:
   * *"Always 0 for the two single-defect owners, which is a fact about those
   * arms rather than a placeholder."* */
  if (refusal.kind === 'population_integrity_refused') {
    await writeDefects(tx, T, runId, 'refusal', 0, refusal.defects)
  }
}

/* ==================================================================== *
 * §4  THE READER — `getRunAccount`'s body, minus the route
 *
 * 🛑 EVERY CHANNEL IS SELECTED, AND A ROW THE MODEL CANNOT NAME FAILS THE WHOLE
 *    RESPONSE RATHER THAN BEING DROPPED FROM IT. `server/data-plane/runs.ts`
 *    argues it for a page of runs and the argument is stronger here: *"an answer
 *    that is wrong and looks right"* on a run's own account of itself is a
 *    silently short list of findings, which is the one output an operator reads
 *    to find out what went wrong.
 * ==================================================================== */

interface EnvelopeRow {
  readonly outcome: string
  readonly terminal_status: string | null
}

export async function readRunEngineAccount(tx: ScopedClient, runId: string): Promise<AccountRead> {
  const envelope = (
    await tx.query(
      'SELECT outcome, terminal_status FROM tenant.run_engine_account WHERE run_id = $1',
      [runId],
    )
  ).rows as unknown as EnvelopeRow[]

  const head = envelope[0]
  if (head === undefined) return { kind: 'no_account' }

  const bad = (table: string, column: string): AccountRead => ({
    kind: 'unpublishable',
    defect: { table, column, runId },
  })

  /* ✅ **THE `refused` ARM HAS COLUMNS SINCE 21 Sep 2026 — `db/migrations/0190`,
   * E6 — AND THE PARAGRAPH BELOW IS CORRECTED RATHER THAN DELETED**, because it
   * is the sentence `0007` and `docs/build/completion-plan.md` both quote and
   * the one that named its own successor. IT READ:
   *
   *     "🛑 THE `refused` ARM HAS NO COLUMNS YET AND THIS REFUSES RATHER THAN
   *      IMPROVISING. An envelope saying `refused` with no `RunRefusal` to
   *      publish cannot be turned into a body — the wire's refused arm is
   *      `required: [outcome, refusal]` — and answering `produced` with ten
   *      empty channels would be the fabrication this file's header refuses.
   *      Nothing writes the word today; the migration that does also adds the
   *      columns."
   *
   * 🛑 **ITS ARGUMENT IS UNCHANGED AND IS WHY THE ARM LOOKS LIKE THIS**: the
   *    wire's refused arm is `required: [outcome, refusal]` and
   *    `additionalProperties: false`, so it must carry a COMPLETE `RunRefusal`
   *    or nothing. `readRunRefusal()` answers `unpublishable` BY COLUMN rather
   *    than minting a default arm — G1244's finding is the reason that matters:
   *    a missing `required` property makes `fast-json-stringify` **THROW**, so
   *    the failure mode of improvising here is a 500 on every read of that run.
   *
   * ⚠️ AND A THIRD `outcome` VALUE IS STILL A REFUSAL BY COLUMN. `0190` carries
   *    no `CHECK` on the vocabulary (G1514), so an unknown word must reach the
   *    model as `unpublishable` rather than be rejected at write time by a list
   *    somebody forgot to extend. */
  if (head.outcome === 'refused') return readRunRefusal(tx, runId)
  if (head.outcome !== 'produced') return bad('run_engine_account', 'outcome')
  if (head.terminal_status === null || !isTerminalRunStatus(head.terminal_status)) {
    return bad('run_engine_account', 'terminal_status')
  }

  const rates = (
    await tx.query(
      'SELECT side, presented, admitted, refused FROM tenant.run_admission_rate WHERE run_id = $1',
      [runId],
    )
  ).rows as unknown as {
    side: string
    presented: number
    admitted: number
    refused: number
  }[]

  /* ⚠️ `left` THEN `right` BY NAME AND NOT BY `ORDER BY side`. The wire declares
   * `minItems: 2, maxItems: 2` *"one entry for `left` and one for `right`, in
   * that order"*, and alphabetical order happens to agree — which is a
   * convenient landmark rather than the property (§5.1). */
  const admissionRates: Record<string, unknown>[] = []
  for (const side of ['left', 'right'] as const) {
    const row = rates.find((r) => r.side === side)
    if (row === undefined) return bad('run_admission_rate', 'side')
    admissionRates.push({
      side,
      presented: row.presented,
      admitted: row.admitted,
      refused: row.refused,
    })
  }

  const defectRows = (
    await tx.query(
      `SELECT owner, owner_ordinal, ordinal, kind,
              ref_source_document_id, ref_line_index, occurrences,
              refused_count, side_row_count, ceiling_basis_points,
              source_document_id, declared_count, document_row_count, admitted_count,
              money_refusal_kind, declared_minor, declared_exponent,
              admitted_minor, admitted_exponent
         FROM tenant.run_population_defect
        WHERE run_id = $1
        ORDER BY owner, owner_ordinal, ordinal`,
      [runId],
    )
  ).rows as unknown as DefectRow[]

  const defectsFor = (owner: string, ownerOrdinal: number): DefectRow[] =>
    defectRows.filter((d) => d.owner === owner && d.owner_ordinal === ownerOrdinal)

  /* ---- documentAccounts ---- */
  const documentRows = (
    await tx.query(
      `SELECT ordinal, side, source_document_id, trailer, declared_line_count,
              declared_minor, declared_exponent, presented, admitted, refused, verdict_kind
         FROM tenant.run_document_account WHERE run_id = $1 ORDER BY ordinal`,
      [runId],
    )
  ).rows as unknown as {
    ordinal: number
    side: string
    source_document_id: string
    trailer: string
    declared_line_count: number | null
    declared_minor: unknown
    declared_exponent: number | null
    presented: number
    admitted: number
    refused: number
    verdict_kind: string
  }[]

  const documentAccounts: Record<string, unknown>[] = []
  for (const row of documentRows) {
    if (!isPopulationSide(row.side)) return bad('run_document_account', 'side')
    if (!isControlTotalKind(row.trailer)) return bad('run_document_account', 'trailer')
    if (!isTrailerVerdictKind(row.verdict_kind)) return bad('run_document_account', 'verdict_kind')
    const declaredMinor = minorIn(row.declared_minor)
    if (declaredMinor === 'refused') return bad('run_document_account', 'declared_minor')

    let verdict: Record<string, unknown> = { kind: row.verdict_kind }
    if (row.verdict_kind === 'reported') {
      const defects: Record<string, unknown>[] = []
      for (const d of defectsFor('document_account', row.ordinal)) {
        const shaped = shapeDefect(d)
        if (shaped === null) return bad('run_population_defect', d.kind)
        defects.push(shaped)
      }
      /* `minItems: 1` on the wire: a `reported` verdict with no defect reports
       * nothing, which is `agreed` wearing the wrong word. */
      if (defects.length === 0) return bad('run_population_defect', 'reported_without_defects')
      verdict = { kind: 'reported', defects }
    }

    documentAccounts.push({
      side: row.side,
      sourceDocumentId: row.source_document_id,
      trailer: row.trailer,
      declaredLineCount: row.declared_line_count,
      declaredMinor,
      declaredExponent: row.declared_exponent,
      presented: row.presented,
      admitted: row.admitted,
      refused: row.refused,
      verdict,
    })
  }

  /* ---- refusedAtAdmission ---- */
  const refusedRows = (
    await tx.query(
      `SELECT side, ref_source_document_id, ref_line_index, path,
              refusal_kind, refusal_found, refusal_extraction_kind, refusal_money_kind
         FROM tenant.run_refused_item WHERE run_id = $1 ORDER BY ordinal`,
      [runId],
    )
  ).rows as unknown as {
    side: string
    ref_source_document_id: string
    ref_line_index: number | null
    path: unknown
    refusal_kind: string
    refusal_found: string | null
    refusal_extraction_kind: string | null
    refusal_money_kind: string | null
  }[]

  const refusedAtAdmission: Record<string, unknown>[] = []
  for (const row of refusedRows) {
    if (!isPopulationSide(row.side)) return bad('run_refused_item', 'side')
    const path = pathIn(row.path)
    if (path === null) return bad('run_refused_item', 'path')
    const refusal = shapeAdmissionRefusal(
      row.refusal_kind,
      row.refusal_found,
      row.refusal_extraction_kind,
      row.refusal_money_kind,
    )
    if (refusal === null) return bad('run_refused_item', 'refusal_kind')
    refusedAtAdmission.push({
      side: row.side,
      ref: { sourceDocumentId: row.ref_source_document_id, lineIndex: row.ref_line_index },
      path,
      refusal,
    })
  }

  /* ---- ambiguities ---- */
  const ambiguityRows = (
    await tx.query(
      `SELECT ordinal, on_path, strategy_kind, left_candidates, right_candidates
         FROM tenant.run_ambiguity WHERE run_id = $1 ORDER BY ordinal`,
      [runId],
    )
  ).rows as unknown as {
    ordinal: number
    on_path: unknown
    strategy_kind: string
    left_candidates: number
    right_candidates: number
  }[]
  const ambiguityRefRows = (
    await tx.query(
      `SELECT ambiguity_ordinal, side, source_document_id, line_index
         FROM tenant.run_ambiguity_ref WHERE run_id = $1 ORDER BY ambiguity_ordinal, side, ordinal`,
      [runId],
    )
  ).rows as unknown as {
    ambiguity_ordinal: number
    side: string
    source_document_id: string
    line_index: number | null
  }[]

  const ambiguities: Record<string, unknown>[] = []
  for (const row of ambiguityRows) {
    if (!isPairingStrategyKind(row.strategy_kind)) return bad('run_ambiguity', 'strategy_kind')
    let on: FieldPath | null = null
    if (row.on_path !== null && row.on_path !== undefined) {
      on = pathIn(row.on_path)
      if (on === null) return bad('run_ambiguity', 'on_path')
    }
    const refsOf = (side: string): Record<string, unknown>[] =>
      ambiguityRefRows
        .filter((r) => r.ambiguity_ordinal === row.ordinal && r.side === side)
        .map((r) => ({ sourceDocumentId: r.source_document_id, lineIndex: r.line_index }))
    ambiguities.push({
      on,
      strategyKind: row.strategy_kind,
      leftCandidates: row.left_candidates,
      rightCandidates: row.right_candidates,
      leftRefs: refsOf('left'),
      rightRefs: refsOf('right'),
    })
  }

  /* ---- searchBoundary ---- */
  const boundaryRows = (
    await tx.query(
      `SELECT channel, item_count, example_source_document_id, example_line_index
         FROM tenant.run_search_boundary_entry WHERE run_id = $1 ORDER BY channel, ordinal`,
      [runId],
    )
  ).rows as unknown as {
    channel: string
    item_count: number
    example_source_document_id: string
    example_line_index: number | null
  }[]
  const boundaryOf = (channel: string): Record<string, unknown>[] =>
    boundaryRows
      .filter((r) => r.channel === channel)
      .map((r) => ({
        itemCount: r.item_count,
        exampleRef: {
          sourceDocumentId: r.example_source_document_id,
          lineIndex: r.example_line_index,
        },
      }))
  const searchBoundary = {
    oversizedBuckets: boundaryOf('oversized_buckets'),
    exhaustedSearches: boundaryOf('exhausted_searches'),
    oversizedAmountBuckets: boundaryOf('oversized_amount_buckets'),
  }

  /* ---- postconditions ---- */
  const postRows = (
    await tx.query(
      `SELECT ordinal, kind, count, admitted_minor, accounted_minor, side, side_row_count
         FROM tenant.run_postcondition WHERE run_id = $1 ORDER BY ordinal`,
      [runId],
    )
  ).rows as unknown as {
    ordinal: number
    kind: string
    count: number | null
    admitted_minor: unknown
    accounted_minor: unknown
    side: string | null
    side_row_count: number | null
  }[]

  const postconditions: Record<string, unknown>[] = []
  for (const row of postRows) {
    if (!isPostconditionKind(row.kind)) return bad('run_postcondition', 'kind')
    if (row.kind === 'gross_not_partitioned') {
      const a = minorIn(row.admitted_minor)
      const b = minorIn(row.accounted_minor)
      if (a === 'refused' || a === null) return bad('run_postcondition', 'admitted_minor')
      if (b === 'refused' || b === null) return bad('run_postcondition', 'accounted_minor')
      postconditions.push({ kind: row.kind, admittedMinor: a, accountedMinor: b })
      continue
    }
    if (row.kind === 'population_integrity_reported') {
      if (row.side === null || !isPopulationSide(row.side)) return bad('run_postcondition', 'side')
      const owned = defectsFor('postcondition', row.ordinal)
      const first = owned[0]
      if (first === undefined) return bad('run_population_defect', 'postcondition_without_defect')
      const shaped = shapeDefect(first)
      if (shaped === null) return bad('run_population_defect', first.kind)
      postconditions.push({ kind: row.kind, side: row.side, defect: shaped })
      continue
    }
    if (row.kind === 'population_wholly_refused') {
      if (row.side === null || !isPopulationSide(row.side)) return bad('run_postcondition', 'side')
      if (row.side_row_count === null) return bad('run_postcondition', 'side_row_count')
      postconditions.push({ kind: row.kind, side: row.side, sideRowCount: row.side_row_count })
      continue
    }
    if (row.count === null) return bad('run_postcondition', 'count')
    postconditions.push({ kind: row.kind, count: row.count })
  }

  /* ---- completeness ---- */
  const completenessRows = (
    await tx.query(
      `SELECT ordinal, kind, side, presented, admitted, refused
         FROM tenant.run_completeness WHERE run_id = $1 ORDER BY ordinal`,
      [runId],
    )
  ).rows as unknown as {
    ordinal: number
    kind: string
    side: string
    presented: number | null
    admitted: number | null
    refused: number | null
  }[]

  /* G3442 — shaped by `shapeCompleteness()`, the ONE place this channel is
     turned from rows into the wire, because `readRunCompletenessBatch()` (the
     run list's reader) needs the same answer and two shapers would be §5.3. */
  const shapedCompleteness = shapeCompleteness(completenessRows, defectsFor)
  if (!shapedCompleteness.ok) return bad(shapedCompleteness.table, shapedCompleteness.column)
  const completeness = shapedCompleteness.value

  /* ---- meterFacts ---- */
  const meterRows = (
    await tx.query(
      `SELECT meter, quantity, idempotency_key, model_entry_id
         FROM tenant.run_meter_fact WHERE run_id = $1 ORDER BY ordinal`,
      [runId],
    )
  ).rows as unknown as {
    meter: string
    quantity: number
    idempotency_key: string
    model_entry_id: string | null
  }[]

  const meterFacts: Record<string, unknown>[] = []
  for (const row of meterRows) {
    if (!isEngineMeter(row.meter)) return bad('run_meter_fact', 'meter')
    meterFacts.push({
      meter: row.meter,
      quantity: row.quantity,
      idempotencyKey: row.idempotency_key,
      modelEntryId: row.model_entry_id,
    })
  }

  /* ---- settlementTallies — G3541 ---- */
  const tallies = await readSettlementTallies(tx, runId, admissionRates)
  if (!tallies.ok) return bad(tallies.table, tallies.column)

  return {
    kind: 'account',
    account: {
      outcome: 'produced',
      terminalStatus: head.terminal_status,
      admissionRates,
      settlementTallies: tallies.value.tallies,
      openResidual: tallies.value.openResidual,
      documentAccounts,
      refusedAtAdmission,
      ambiguities,
      searchBoundary,
      postconditions,
      completeness,
      meterFacts,
      /**
       * 🛑 PUBLISHED FROM THE MODEL'S CONSTANT AND NEVER FROM A COLUMN. The wire
       * calls it *"the soundness/completeness declaration, published beside the
       * list it classifies so a client switches on it instead of re-deriving the
       * split from an arm's name."* It is a DECLARATION about the vocabulary and
       * not a finding about this run, so storing it would put a second copy of
       * `POSTCONDITION_PROPERTY` in every account row — copies that could
       * disagree with the model AND with each other, on the field a client
       * switches on.
       */
      postconditionProperty: POSTCONDITION_PROPERTY,
    },
  }
}

/**
 * THE ARRIVAL'S `Matched` AND `In variance`, PER SIDE — G3541, 3 Oct 2026.
 *
 * 🛑 DERIVED AT READ TIME FROM TWO CHANNELS THIS ACCOUNT ALREADY STORES, AND
 *    STORED NOWHERE. `run_admission_rate.admitted` is how many items the engine
 *    admitted; `run_residue` holds every admitted item whose settlement is not
 *    `fully_allocated`, EXACTLY ONCE — that is RESIDUE COMPLETENESS, the
 *    engine's load-bearing post-condition (`model/reconciliation.ts`,
 *    `checkPostconditions`), and a run that broke it carries
 *    `open_item_missing_from_residue` or `item_in_residue_twice` in its own
 *    `postconditions` channel beside this one. So:
 *
 *      open     = residue rows on the side whose settlement is `unallocated`
 *                 or `partially_allocated` (a refused row has NO settlement
 *                 and was never admitted, so it is not counted)
 *      matched  = admitted − open
 *
 *    A column would be a SECOND copy of a fact the residue already states, and
 *    the two could disagree (§5.3).
 *
 * 🛑 THE OPEN VALUE IS FOLDED THROUGH `addMoney()` — G111: nothing outside
 *    `model/money.ts` does money arithmetic — AND IS NEVER SUMMED ACROSS UNITS.
 *    Two residuals in different currencies (or exponents) answer `mixed_units`:
 *    there is no FX rate on this path and `FxConversion` is dropped for v1, so
 *    a single figure would be a conversion nobody performed. `nothing_open` is
 *    its own arm because a zero needs a currency and an empty side has none —
 *    the fabricated-zero defect `ResidueEntry.settlement` already records.
 *
 * ⚠️ `matched < 0` IS A DEFECT AND IS REFUSED BY COLUMN, never clamped: it can
 *    only mean the residue holds an admitted-looking row the admission count
 *    does not — a figure published from that would be a guess.
 */
/**
 * THE RUN'S NET OPEN RESIDUAL — *"In variance"* — G3804, 4 Oct 2026, THE
 * OWNER'S RULING ON C3-02/C3-09, quoted: *"Store a signed delta: the engine
 * records direction (over/under); the column shows sign, totals net correctly,
 * 'In variance' is defined as the open residual."*
 *
 * The left side's unsettled total MINUS the right side's, in the sign
 * convention the engine declares once (`over` = left exceeds right). It is the
 * figure the register's signed Variance column totals to for the same run when
 * every open item raises one exception and each declined bucket raises once
 * (`exception-raise.ts` `signedDeltaOf`, G3805) — and
 * `tests/db/staging-demo-data.test.ts` §5 proves the two agree on the seed.
 *
 * ⚠️ IT REPLACES NOTHING. `settlementTallies` still publishes each side's
 *    unsettled total; this is DERIVED from those two, at read time, and stored
 *    nowhere (§5.3). `nothing_open` when neither side has anything open,
 *    `mixed_units` when the two sides' residuals are not one unit — never a
 *    conversion and never a fabricated zero.
 */
type SideOpen = { readonly kind: 'nothing' } | { readonly kind: 'mixed' } | { readonly kind: 'total'; readonly total: Money }

function netOpenResidual(left: SideOpen, right: SideOpen): Record<string, unknown> {
  if (left.kind === 'mixed' || right.kind === 'mixed') return { kind: 'mixed_units' }
  if (left.kind === 'nothing' && right.kind === 'nothing') return { kind: 'nothing_open' }
  let net: Money
  if (left.kind === 'total' && right.kind === 'total') {
    const d = subtractMoney(left.total, right.total)
    if (!d.ok) return { kind: 'mixed_units' }
    net = d.value
  } else if (left.kind === 'total') {
    net = left.total
  } else {
    const r = (right as { readonly total: Money }).total
    net = { ...r, amountMinor: -r.amountMinor }
  }
  return {
    kind: 'total',
    total: { currency: net.currency, amountMinor: formatMinorUnits(net.amountMinor), exponent: net.exponent },
  }
}

async function readSettlementTallies(
  tx: ScopedClient,
  runId: string,
  admissionRates: readonly Record<string, unknown>[],
): Promise<Shaped<{ readonly tallies: Record<string, unknown>[]; readonly openResidual: Record<string, unknown> }>> {
  const rows = (
    await tx.query(
      `SELECT side, settlement_residual_currency, settlement_residual_minor,
              settlement_residual_exponent
         FROM tenant.run_residue
        WHERE run_id = $1
          AND settlement_kind IN ('unallocated', 'partially_allocated')
        ORDER BY ordinal`,
      [runId],
    )
  ).rows as unknown as {
    side: string
    settlement_residual_currency: string | null
    settlement_residual_minor: unknown
    settlement_residual_exponent: number | null
  }[]

  const fail = (column: string): Shaped<never> => ({
    ok: false,
    table: 'run_residue',
    column,
  })

  const tallies: Record<string, unknown>[] = []
  const sideOpen = new Map<string, SideOpen>()
  for (const rate of admissionRates) {
    const side = rate['side']
    const admitted = rate['admitted']
    if (typeof admitted !== 'number') return { ok: false, table: 'run_admission_rate', column: 'admitted' }
    let open = 0
    let total: Money | null = null
    let mixed = false
    for (const row of rows) {
      if (!isPopulationSide(row.side)) return fail('side')
      if (row.side !== side) continue
      open += 1
      if (row.settlement_residual_currency === null || row.settlement_residual_exponent === null) {
        return fail('settlement_residual_currency')
      }
      if (typeof row.settlement_residual_minor !== 'string') return fail('settlement_residual_minor')
      const minor = parseMinorUnits(row.settlement_residual_minor)
      if (!minor.ok) return fail('settlement_residual_minor')
      const residual: Money = {
        currency: row.settlement_residual_currency,
        amountMinor: minor.value,
        exponent: row.settlement_residual_exponent,
      }
      if (mixed) continue
      if (total === null) {
        total = residual
        continue
      }
      const sum = addMoney(total, residual)
      if (sum.ok) {
        total = sum.value
      } else if (sum.refusal.kind === 'currency_mismatch' || sum.refusal.kind === 'exponent_mismatch') {
        mixed = true
      } else {
        return fail('settlement_residual_minor')
      }
    }
    const matched = admitted - open
    if (matched < 0) return fail('settlement_kind')
    const unsettled: Record<string, unknown> =
      open === 0
        ? { kind: 'nothing_open' }
        : mixed || total === null
          ? { kind: 'mixed_units' }
          : {
              kind: 'total',
              total: {
                currency: total.currency,
                amountMinor: formatMinorUnits(total.amountMinor),
                exponent: total.exponent,
              },
            }
    tallies.push({ side, matched, open, unsettled })
    sideOpen.set(
      String(side),
      open === 0 ? { kind: 'nothing' } : mixed || total === null ? { kind: 'mixed' } : { kind: 'total', total },
    )
  }
  const nothing: SideOpen = { kind: 'nothing' }
  return {
    ok: true,
    value: {
      tallies,
      openResidual: netOpenResidual(sideOpen.get('left') ?? nothing, sideOpen.get('right') ?? nothing),
    },
  }
}

interface DefectRow {
  readonly owner: string
  readonly owner_ordinal: number
  readonly ordinal: number
  readonly kind: string
  readonly ref_source_document_id: string | null
  readonly ref_line_index: number | null
  readonly occurrences: number | null
  readonly refused_count: number | null
  readonly side_row_count: number | null
  readonly ceiling_basis_points: number | null
  readonly source_document_id: string | null
  readonly declared_count: number | null
  readonly document_row_count: number | null
  readonly admitted_count: number | null
  readonly money_refusal_kind: string | null
  readonly declared_minor: unknown
  readonly declared_exponent: number | null
  readonly admitted_minor: unknown
  readonly admitted_exponent: number | null
}

/**
 * ONE DEFECT ROW → ONE WIRE ARM, OR `null`.
 *
 * 🛑 EVERY ARM CHECKS ITS OWN FIELDS AND REFUSES ON A NULL, WHICH IS THE
 *    INVARIANT `0007`'s §4 SAYS THE READ SEAM HOLDS. Single-table inheritance
 *    makes "exactly the arm's fields are non-null" expressible and not
 *    enforceable in the schema; publishing a defect with a hole in it —
 *    `{kind: 'declared_line_count_disagrees', declaredCount: null}` — would put a
 *    finding on an operator's screen with the number missing, which is worse
 *    than refusing the whole account and saying so.
 */
interface CompletenessRow {
  readonly ordinal: number
  readonly kind: string
  readonly side: string
  readonly presented: number | null
  readonly admitted: number | null
  readonly refused: number | null
}

type Shaped<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly table: string; readonly column: string }

/**
 * THE COMPLETENESS CHANNEL, ROWS → WIRE — G3442, 3 Oct 2026. Moved out of
 * `readRunEngineAccount()` verbatim so the run list can publish the SAME
 * answer `getRunAccount` does. Every refusal it can produce is the one the
 * account read produced before the move.
 */
function shapeCompleteness(
  rows: readonly CompletenessRow[],
  defectsFor: (owner: string, ownerOrdinal: number) => readonly DefectRow[],
): Shaped<Record<string, unknown>[]> {
  const bad = (table: string, column: string): Shaped<Record<string, unknown>[]> => ({ ok: false, table, column })
  const completeness: Record<string, unknown>[] = []
  for (const row of rows) {
    if (!isCompletenessFindingKind(row.kind)) return bad('run_completeness', 'kind')
    if (!isPopulationSide(row.side)) return bad('run_completeness', 'side')
    if (row.kind === 'rows_presented_not_admitted') {
      if (row.presented === null || row.admitted === null || row.refused === null) {
        return bad('run_completeness', 'presented')
      }
      completeness.push({
        kind: row.kind,
        side: row.side,
        presented: row.presented,
        admitted: row.admitted,
        refused: row.refused,
      })
      continue
    }
    const owned = defectsFor('completeness', row.ordinal)
    const first = owned[0]
    if (first === undefined) return bad('run_population_defect', 'completeness_without_defect')
    const shaped = shapeDefect(first)
    if (shaped === null) return bad('run_population_defect', first.kind)
    completeness.push({ kind: row.kind, side: row.side, defect: shaped })
  }
  return { ok: true, value: completeness }
}

/**
 * `Run.completeness` FOR A PAGE OF RUNS, IN THREE STATEMENTS — G3442 (RC-10).
 *
 * 🛑 THE N+1 `runs.ts` NAMED IS THE REASON THIS IS A BATCH. `listRuns` serves
 *    up to `limit` rows, and calling `readRunEngineAccount()` per row would be
 *    eleven statements per run. Here it is three for the whole page —
 *    envelopes, completeness rows, completeness-owned defects — each keyed on
 *    `run_id = ANY($1)` and narrowed by the policy the transaction carries.
 *
 * WHAT A RUN GETS:
 *   · an account whose outcome is `produced` → its channel (`[]` = the engine
 *     observed no shortfall), shaped by `shapeCompleteness()`;
 *   · no account, or an account whose outcome is `refused` → ABSENT from the
 *     map, and the caller publishes `null`. A refused run has no completeness
 *     channel at all: the engine refused the definition and accounted nothing,
 *     and `[]` would be the clean close `NO_ENGINE_ACCOUNT` refuses.
 *   · an outcome word the model does not know → a refusal BY COLUMN, exactly
 *     as `readRunEngineAccount()` answers for the same row.
 */
export type CompletenessBatch =
  | { readonly ok: true; readonly byRun: ReadonlyMap<string, readonly Record<string, unknown>[]> }
  | { readonly ok: false; readonly defect: AccountDefect }

export async function readRunCompletenessBatch(
  tx: ScopedClient,
  runIds: readonly string[],
): Promise<CompletenessBatch> {
  const byRun = new Map<string, readonly Record<string, unknown>[]>()
  if (runIds.length === 0) return { ok: true, byRun }
  const ids = [...runIds]

  const envelopes = (
    await tx.query('SELECT run_id, outcome FROM tenant.run_engine_account WHERE run_id = ANY($1::text[])', [ids])
  ).rows as unknown as { run_id: string; outcome: string }[]

  const produced: string[] = []
  for (const e of envelopes) {
    if (e.outcome === 'produced') produced.push(e.run_id)
    else if (e.outcome !== 'refused') {
      return { ok: false, defect: { table: 'run_engine_account', column: 'outcome', runId: e.run_id } }
    }
  }
  if (produced.length === 0) return { ok: true, byRun }

  const rows = (
    await tx.query(
      `SELECT run_id, ordinal, kind, side, presented, admitted, refused
         FROM tenant.run_completeness WHERE run_id = ANY($1::text[]) ORDER BY run_id, ordinal`,
      [produced],
    )
  ).rows as unknown as (CompletenessRow & { run_id: string })[]

  const defects = (
    await tx.query(
      `SELECT run_id, owner, owner_ordinal, ordinal, kind,
              ref_source_document_id, ref_line_index, occurrences,
              refused_count, side_row_count, ceiling_basis_points,
              source_document_id, declared_count, document_row_count, admitted_count,
              money_refusal_kind, declared_minor, declared_exponent,
              admitted_minor, admitted_exponent
         FROM tenant.run_population_defect
        WHERE run_id = ANY($1::text[]) AND owner = 'completeness'
        ORDER BY run_id, owner, owner_ordinal, ordinal`,
      [produced],
    )
  ).rows as unknown as (DefectRow & { run_id: string })[]

  for (const runId of produced) {
    const mine = rows.filter((r) => r.run_id === runId)
    const shaped = shapeCompleteness(mine, (owner, ownerOrdinal) =>
      defects.filter((d) => d.run_id === runId && d.owner === owner && d.owner_ordinal === ownerOrdinal),
    )
    if (!shaped.ok) return { ok: false, defect: { table: shaped.table, column: shaped.column, runId } }
    byRun.set(runId, shaped.value)
  }
  return { ok: true, byRun }
}

function shapeDefect(d: DefectRow): Record<string, unknown> | null {
  if (!isPopulationDefectKind(d.kind)) return null
  switch (d.kind) {
    case 'duplicate_item_address':
      if (d.ref_source_document_id === null || d.occurrences === null) return null
      return {
        kind: d.kind,
        ref: { sourceDocumentId: d.ref_source_document_id, lineIndex: d.ref_line_index },
        occurrences: d.occurrences,
      }
    case 'admission_refusal_rate_above_ceiling':
      if (
        d.refused_count === null ||
        d.side_row_count === null ||
        d.ceiling_basis_points === null
      ) {
        return null
      }
      return {
        kind: d.kind,
        refusedCount: d.refused_count,
        sideRowCount: d.side_row_count,
        ceilingBasisPoints: d.ceiling_basis_points,
      }
    case 'control_total_declared_nothing':
    case 'control_total_arm_disagrees_with_document_type':
      if (d.source_document_id === null) return null
      return { kind: d.kind, sourceDocumentId: d.source_document_id }
    case 'declared_line_count_disagrees':
      if (
        d.source_document_id === null ||
        d.declared_count === null ||
        d.document_row_count === null
      ) {
        return null
      }
      return {
        kind: d.kind,
        sourceDocumentId: d.source_document_id,
        declaredCount: d.declared_count,
        documentRowCount: d.document_row_count,
      }
    case 'control_total_unverifiable_rows_refused':
      if (
        d.source_document_id === null ||
        d.document_row_count === null ||
        d.admitted_count === null
      ) {
        return null
      }
      return {
        kind: d.kind,
        sourceDocumentId: d.source_document_id,
        documentRowCount: d.document_row_count,
        admittedCount: d.admitted_count,
      }
    case 'control_total_not_evaluable':
      if (
        d.source_document_id === null ||
        d.money_refusal_kind === null ||
        !isMoneyRefusalKind(d.money_refusal_kind)
      ) {
        return null
      }
      return {
        kind: d.kind,
        sourceDocumentId: d.source_document_id,
        refusal: { kind: d.money_refusal_kind },
      }
    case 'declared_control_total_disagrees': {
      const declared = minorIn(d.declared_minor)
      const admitted = minorIn(d.admitted_minor)
      if (d.source_document_id === null) return null
      if (declared === null || declared === 'refused') return null
      if (admitted === null || admitted === 'refused') return null
      if (d.declared_exponent === null || d.admitted_exponent === null) return null
      return {
        kind: d.kind,
        sourceDocumentId: d.source_document_id,
        declaredMinor: declared,
        declaredExponent: d.declared_exponent,
        admittedMinor: admitted,
        admittedExponent: d.admitted_exponent,
      }
    }
  }
}

/** The four flattened columns of §5/§11 → one `PopulationAdmissionRefusal`. */
function shapeAdmissionRefusal(
  kind: string,
  found: string | null,
  extraction: string | null,
  money: string | null,
): Record<string, unknown> | null {
  if (!isAdmissionRefusalKind(kind)) return null
  switch (kind) {
    case 'amount_not_money':
    case 'date_not_extractable':
      if (found === null || !isExtractedScalarKind(found)) return null
      return { kind, found }
    case 'identifier_not_extractable':
      if (extraction === null || !isExtractionRefusalKind(extraction)) return null
      return { kind, refusal: { kind: extraction } }
    case 'money_unit_disagrees_with_declared':
    case 'amount_not_exact_money':
      if (money === null || !isMoneyRefusalKind(money)) return null
      return { kind, refusal: { kind: money } }
    default:
      return { kind }
  }
}

/* ==================================================================== *
 * §5  THE RESIDUE PAGE — `listRunResidue`'s body, minus the route
 *
 * 🛑 THE CURSOR IS OPAQUE AND IT IS OPAQUE ON PURPOSE.
 *    `capability.openapi.yaml` → `components.parameters.Cursor`: *"A cursor a
 *    client can construct is a cursor a client can point at another tenant's
 *    ordering key."* Base64 is not a security boundary and is not pretending to
 *    be one — RLS is. What it buys is that a client cannot come to DEPEND on the
 *    shape, so the ordering key can change without breaking one.
 *
 * ⚠️ THE ORDERING KEY IS `ordinal`, THE ENGINE'S OWN EMISSION INDEX, AND IT IS
 *    THE ONLY CANDIDATE THAT CANNOT SKIP OR DUPLICATE. `(source_document_id,
 *    line_index)` looks natural and is not usable: `lineIndex` is NULL for a
 *    header-grain transaction — *"Null for a header-grain transaction; the line
 *    index for a statement line"* — and NULLs order differently from every value
 *    and compare unequal to each other, so a keyset predicate over them silently
 *    drops rows at a page edge.
 * ==================================================================== */

/**
 * THE `refused` ARM, READ BACK — E6, G1511–G1514, 21 Sep 2026.
 *
 * 🛑 IT PUBLISHES THE REFUSAL AND **NOTHING ELSE**, WHICH MIRRORS THE MODEL
 *    RATHER THAN TIDYING IT. `capability.openapi.yaml` states it on the schema:
 *    *"THE REFUSED ARM CANNOT CARRY A LEDGER … a refused run produced nothing,
 *    and the refusal IS the output. Declaring those properties on it 'just in
 *    case' would make an invalid state legal (§5.5)."* So there is no
 *    `terminalStatus`, no `admissionRates` and no `meterFacts` here, and their
 *    absence is the assertion rather than an omission.
 */
async function readRunRefusal(tx: ScopedClient, runId: string): Promise<AccountRead> {
  const bad = (table: string, column: string): AccountRead => ({
    kind: 'unpublishable',
    defect: { table, column, runId },
  })

  const rows = (
    await tx.query(
      `SELECT kind, side, expected, supplied, binding_index,
              money_refusal_kind, tolerance_route, tolerance_index,
              ref_source_document_id, ref_line_index, source_document_id
         FROM tenant.run_refusal WHERE run_id = $1`,
      [runId],
    )
  ).rows as unknown as {
    kind: string
    side: string | null
    expected: number | null
    supplied: number | null
    binding_index: number | null
    money_refusal_kind: string | null
    tolerance_route: string | null
    tolerance_index: number | null
    ref_source_document_id: string | null
    ref_line_index: number | null
    source_document_id: string | null
  }[]

  const row = rows[0]
  /* 🛑 AN ENVELOPE SAYING `refused` WITH NO REFUSAL ROW IS `unpublishable` AND
   * NEVER `no_account`. `0190` §1's foreign key makes the pair atomic, so
   * reaching this means something wrote an envelope another way — and answering
   * `no_account` would republish the exact 404 collision E6 exists to end. */
  if (row === undefined) return bad('run_refusal', 'run_id')
  if (!isRunRefusalKind(row.kind)) return bad('run_refusal', 'kind')

  const refusal: Record<string, unknown> = { kind: row.kind }

  const needSide = (): string | null =>
    row.side === null || !isPopulationSide(row.side) ? null : row.side
  const needMoney = (): string | null =>
    row.money_refusal_kind === null || !isMoneyRefusalKind(row.money_refusal_kind)
      ? null
      : row.money_refusal_kind

  /* ⚠️ EVERY ARM CHECKS ITS OWN OPERANDS PRESENT, so a row written by something
   * other than `persistRunRefusal()` cannot publish a refusal with a hole in
   * it. The wire marks each arm's operands `required`, and a missing one is a
   * THROW at serialisation rather than a quiet omission (G1244). */
  switch (row.kind) {
    case 'cross_tenant_documents':
    case 'reader_candidate_cap_not_stated':
    case 'similarity_max_chars_not_stated':
    case 'subset_sum_bound_not_stated':
    case 'admission_refusal_ceiling_not_stated':
      break

    case 'strategy_binding_count_mismatch': {
      if (row.expected === null) return bad('run_refusal', 'expected')
      if (row.supplied === null) return bad('run_refusal', 'supplied')
      refusal['expected'] = row.expected
      refusal['supplied'] = row.supplied
      break
    }

    case 'strategy_binding_kind_mismatch': {
      if (row.binding_index === null) return bad('run_refusal', 'binding_index')
      refusal['index'] = row.binding_index
      break
    }

    case 'normalisation_invalid': {
      const side = needSide()
      if (side === null) return bad('run_refusal', 'side')
      const defectRows = (
        await tx.query(
          `SELECT kind, op_index FROM tenant.run_refusal_normalisation_defect
            WHERE run_id = $1 ORDER BY ordinal`,
          [runId],
        )
      ).rows as unknown as { kind: string; op_index: number | null }[]

      const defects: Record<string, unknown>[] = []
      for (const d of defectRows) {
        if (!isNormalisationDefectKind(d.kind)) {
          return bad('run_refusal_normalisation_defect', 'kind')
        }
        if (d.kind === 'max_input_chars_not_stated') {
          defects.push({ kind: d.kind })
          continue
        }
        if (d.op_index === null) return bad('run_refusal_normalisation_defect', 'op_index')
        defects.push({ kind: d.kind, opIndex: d.op_index })
      }
      /* `minItems: 1`: a `normalisation_invalid` naming no defect names nothing. */
      if (defects.length === 0) return bad('run_refusal_normalisation_defect', 'ordinal')
      refusal['side'] = side
      refusal['defects'] = defects
      break
    }

    case 'declared_unit_invalid': {
      const side = needSide()
      if (side === null) return bad('run_refusal', 'side')
      const money = needMoney()
      if (money === null) return bad('run_refusal', 'money_refusal_kind')
      refusal['side'] = side
      refusal['refusal'] = { kind: money }
      break
    }

    case 'declared_units_disagree': {
      const money = needMoney()
      if (money === null) return bad('run_refusal', 'money_refusal_kind')
      refusal['refusal'] = { kind: money }
      break
    }

    case 'tolerance_unit_disagrees': {
      const money = needMoney()
      if (money === null) return bad('run_refusal', 'money_refusal_kind')
      if (row.tolerance_route === null || !isToleranceRoute(row.tolerance_route)) {
        return bad('run_refusal', 'tolerance_route')
      }
      if (row.tolerance_route === 'strategy_binding') {
        if (row.tolerance_index === null) return bad('run_refusal', 'tolerance_index')
        refusal['tolerance'] = { kind: 'strategy_binding', index: row.tolerance_index }
      } else {
        refusal['tolerance'] = { kind: 'pairing' }
      }
      refusal['refusal'] = { kind: money }
      break
    }

    case 'population_integrity_refused': {
      const side = needSide()
      if (side === null) return bad('run_refusal', 'side')
      const defectRows = (
        await tx.query(
          `SELECT owner, owner_ordinal, ordinal, kind,
                  ref_source_document_id, ref_line_index, occurrences,
                  refused_count, side_row_count, ceiling_basis_points,
                  source_document_id, declared_count, document_row_count, admitted_count,
                  money_refusal_kind, declared_minor, declared_exponent,
                  admitted_minor, admitted_exponent
             FROM tenant.run_population_defect
            WHERE run_id = $1 AND owner = 'refusal'
            ORDER BY ordinal`,
          [runId],
        )
      ).rows as unknown as DefectRow[]

      const defects: Record<string, unknown>[] = []
      for (const d of defectRows) {
        const shaped = shapeDefect(d)
        if (shaped === null) return bad('run_population_defect', d.kind)
        defects.push(shaped)
      }
      if (defects.length === 0) return bad('run_population_defect', 'refusal_without_defects')
      refusal['side'] = side
      refusal['defects'] = defects
      break
    }

    case 'admitted_item_key_collision': {
      const side = needSide()
      if (side === null) return bad('run_refusal', 'side')
      /* 🛑 THE DISCRIMINATOR IS THE DOCUMENT AND NEVER THE INDEX — see the
       * column's own note in `0190` §1: a null `lineIndex` means HEADER GRAIN
       * inside this arm, so testing it for absence would refuse every
       * header-grain collision. */
      if (row.ref_source_document_id === null) return bad('run_refusal', 'ref_source_document_id')
      refusal['side'] = side
      refusal['ref'] = {
        sourceDocumentId: row.ref_source_document_id,
        lineIndex: row.ref_line_index,
      }
      break
    }

    case 'control_total_expected_but_absent': {
      const side = needSide()
      if (side === null) return bad('run_refusal', 'side')
      if (row.source_document_id === null) return bad('run_refusal', 'source_document_id')
      refusal['side'] = side
      refusal['sourceDocumentId'] = row.source_document_id
      break
    }

    case 'population_empty_and_not_expected': {
      const side = needSide()
      if (side === null) return bad('run_refusal', 'side')
      refusal['side'] = side
      break
    }

    default: {
      /* 🛑 EXHAUSTIVE. A THIRTEENTH `SetReconciliationRefusal` ARM IS A `TS2322`
       * HERE — in the READER — before it is a column somebody forgets, which is
       * how `0190`'s *"a migration per new refusal arm"* is made payable rather
       * than merely stated. G1122's device, a third time. */
      const exhaustive: never = row.kind
      return bad('run_refusal', exhaustive)
    }
  }

  return { kind: 'account', account: { outcome: 'refused', refusal } }
}

export function encodeResidueCursor(ordinal: number): string {
  return Buffer.from(String(ordinal), 'utf8').toString('base64url')
}

export function decodeResidueCursor(cursor: string): number | null {
  try {
    const text = Buffer.from(cursor, 'base64url').toString('utf8')
    if (!/^[0-9]+$/.test(text)) return null
    const value = Number(text)
    return Number.isSafeInteger(value) ? value : null
  } catch {
    return null
  }
}

export async function readRunResiduePage(
  tx: ScopedClient,
  runId: string,
  page: { readonly after: number | null; readonly limit: number },
): Promise<ResidueRead> {
  /* 🛑 THE ENVELOPE IS CONSULTED FIRST, AND THAT IS THE WHOLE DIFFERENCE
   * BETWEEN AN EMPTY PAGE AND NO ACCOUNT. A run with no engine account and a run
   * whose residue is empty both produce zero rows from the table below. The
   * first means *nothing reconciled this run*; the second means *the engine
   * closed everything*. Answering `{items: [], nextCursor: null}` to both would
   * report a clean close for a run nobody ran — the `[]`-versus-`null` defect
   * this slice exists to remove, at the grain where it is least visible. */
  const envelope = (
    await tx.query('SELECT outcome FROM tenant.run_engine_account WHERE run_id = $1', [runId])
  ).rows as unknown as { outcome: string }[]
  if (envelope[0] === undefined) return { kind: 'no_account' }

  const bad = (column: string): ResidueRead => ({
    kind: 'unpublishable',
    defect: { table: 'run_residue', column, runId },
  })

  /* One more than asked for, so `nextCursor` STATES whether there is a next page
   * rather than guessing. `runs.ts`: *"A `nextCursor` that is sometimes a lie is
   * worse than no pagination at all."* */
  const rows = (
    await tx.query(
      `SELECT ordinal, side, ref_source_document_id, ref_line_index, settlement_kind,
              settlement_allocated_currency, settlement_allocated_minor, settlement_allocated_exponent,
              settlement_residual_currency,  settlement_residual_minor,  settlement_residual_exponent,
              disposition, cause_kind,
              cause_admission_refusal_kind, cause_admission_found,
              cause_admission_extraction_kind, cause_admission_money_kind,
              cause_reader_refusal_kind, cause_signed_variance_minor
         FROM tenant.run_residue
        WHERE run_id = $1 AND ordinal > $2
        ORDER BY ordinal
        LIMIT $3`,
      [runId, page.after ?? -1, page.limit + 1],
    )
  ).rows as unknown as ResidueRow[]

  const wanted = rows.slice(0, page.limit)
  const ordinals = wanted.map((r) => r.ordinal)

  const heldRows =
    ordinals.length === 0
      ? []
      : ((
          await tx.query(
            `SELECT residue_ordinal, ref_source_document_id, ref_line_index, path,
                    read_confidence, floor
               FROM tenant.run_held_read
              WHERE run_id = $1 AND residue_ordinal = ANY($2::int[])
              ORDER BY residue_ordinal, ordinal`,
            [runId, ordinals],
          )
        ).rows as unknown as {
          residue_ordinal: number
          ref_source_document_id: string
          ref_line_index: number | null
          path: unknown
          read_confidence: number | null
          floor: number
        }[])

  const items: Record<string, unknown>[] = []
  for (const row of wanted) {
    if (!isPopulationSide(row.side)) return bad('side')
    if (!isEngineDisposition(row.disposition)) return bad('disposition')

    const settlement = shapeSettlement(row)
    if (settlement === 'refused') return bad('settlement_kind')

    const cause = shapeCause(row)
    if (cause === null) return bad('cause_kind')

    const heldReads: Record<string, unknown>[] = []
    for (const held of heldRows.filter((h) => h.residue_ordinal === row.ordinal)) {
      const path = pathIn(held.path)
      if (path === null) return bad('held_read_path')
      heldReads.push({
        ref: { sourceDocumentId: held.ref_source_document_id, lineIndex: held.ref_line_index },
        path,
        readConfidence: held.read_confidence,
        floor: held.floor,
      })
    }

    items.push({
      side: row.side,
      ref: { sourceDocumentId: row.ref_source_document_id, lineIndex: row.ref_line_index },
      settlement,
      disposition: row.disposition,
      cause,
      heldReads,
    })
  }

  const last = wanted[wanted.length - 1]
  return {
    kind: 'page',
    items,
    nextCursor:
      rows.length > page.limit && last !== undefined ? encodeResidueCursor(last.ordinal) : null,
  }
}

interface ResidueRow {
  readonly ordinal: number
  readonly side: string
  readonly ref_source_document_id: string
  readonly ref_line_index: number | null
  readonly settlement_kind: string | null
  readonly settlement_allocated_currency: string | null
  readonly settlement_allocated_minor: unknown
  readonly settlement_allocated_exponent: number | null
  readonly settlement_residual_currency: string | null
  readonly settlement_residual_minor: unknown
  readonly settlement_residual_exponent: number | null
  readonly disposition: string
  readonly cause_kind: string
  readonly cause_admission_refusal_kind: string | null
  readonly cause_admission_found: string | null
  readonly cause_admission_extraction_kind: string | null
  readonly cause_admission_money_kind: string | null
  readonly cause_reader_refusal_kind: string | null
  readonly cause_signed_variance_minor: unknown
}

/**
 * 🛑 `null` IS A VALUE HERE AND NOT AN ABSENCE, WHICH IS WHY THIS FUNCTION
 *    RETURNS `null` AND `'refused'` AS DIFFERENT THINGS. An item refused at
 *    admission has no settlement because it has no AMOUNT; the wire makes the
 *    field required-and-nullable because its first version *"carried a zero in
 *    an empty currency — a FABRICATED zero sitting on the one row a finance user
 *    reads to find out what went wrong."*
 */
function shapeSettlement(row: ResidueRow): Record<string, unknown> | null | 'refused' {
  const kind = row.settlement_kind
  if (kind === null) return null
  if (!isItemSettlementKind(kind)) return 'refused'

  const allocated =
    row.settlement_allocated_currency === null || row.settlement_allocated_exponent === null
      ? null
      : {
          currency: row.settlement_allocated_currency,
          amountMinor: minorIn(row.settlement_allocated_minor),
          exponent: row.settlement_allocated_exponent,
        }
  const residual =
    row.settlement_residual_currency === null || row.settlement_residual_exponent === null
      ? null
      : {
          currency: row.settlement_residual_currency,
          amountMinor: minorIn(row.settlement_residual_minor),
          exponent: row.settlement_residual_exponent,
        }
  if (allocated !== null && (allocated.amountMinor === null || allocated.amountMinor === 'refused')) {
    return 'refused'
  }
  if (residual !== null && (residual.amountMinor === null || residual.amountMinor === 'refused')) {
    return 'refused'
  }

  if (kind === 'unallocated') {
    return residual === null ? 'refused' : { kind, residual }
  }
  if (kind === 'fully_allocated') {
    return allocated === null ? 'refused' : { kind, allocated }
  }
  return allocated === null || residual === null ? 'refused' : { kind, allocated, residual }
}

function shapeCause(row: ResidueRow): Record<string, unknown> | null {
  const kind = row.cause_kind
  if (!isResidueCauseKind(kind)) return null
  if (kind === 'admission_refused') {
    if (row.cause_admission_refusal_kind === null) return null
    const refusal = shapeAdmissionRefusal(
      row.cause_admission_refusal_kind,
      row.cause_admission_found,
      row.cause_admission_extraction_kind,
      row.cause_admission_money_kind,
    )
    return refusal === null ? null : { kind, refusal }
  }
  if (kind === 'reader_refused') {
    const refusal = row.cause_reader_refusal_kind
    if (refusal === null || !isReaderRefusalKind(refusal)) return null
    /* ⚠️ THE WIRE'S `reader_refused` ARM CARRIES `ReaderRefusalKind` — the bare
     * STRING enum, not a `{kind}` object. The model's arm carries a
     * `ReaderRefusal`, which is an object. The asymmetry is the contract's and
     * is reproduced rather than tidied: a second spelling would be §5.3. */
    return { kind, refusal }
  }
  if (kind === 'amount_tolerance_declined') {
    const variance = minorIn(row.cause_signed_variance_minor)
    if (variance === null || variance === 'refused') return null
    return { kind, signedVarianceMinor: variance }
  }
  return { kind }
}

/* ==================================================================== *
 * §6  THE ALLOCATION PAGE — `listRunAllocations`'s body, minus the route
 *     R13, THE OWNER'S, AND G2371–G2374. 1 Oct 2026.
 *
 * 🛑 IT PUBLISHES IDS AND AMOUNTS AND NOTHING THAT CAME OUT OF A PAYLOAD.
 *    *"Persist ids only: persist allocations as typed rows of item refs +
 *    amounts, never the counterparty join-key text; publish via a read
 *    operation. Invariant 6 held by absence."* `0260` has no column a join key,
 *    a counterparty or a description could be in, so there is nothing for this
 *    function to forget to strip.
 *
 * ⚠️ THE ENVELOPE IS CONSULTED FIRST, FOR §5's REASON EXACTLY: a run nobody
 *    reconciled and a run that paired nothing both produce zero rows, and only
 *    the first is a 404.
 *
 * ⚠️ AND THE CURSOR IS §5's CODEC. One opaque ordinal encoding for two pages
 *    over two tables keyed the same way; a second spelling would be §5.3.
 * ==================================================================== */

export type AllocationRead =
  | { readonly kind: 'no_account' }
  | {
      readonly kind: 'page'
      readonly items: readonly Record<string, unknown>[]
      readonly nextCursor: string | null
    }
  | { readonly kind: 'unpublishable'; readonly defect: AccountDefect }

interface AllocationRow {
  readonly ordinal: number
  readonly from_side: string
  readonly from_source_document_id: string
  readonly from_line_index: number | null
  readonly to_side: string
  readonly to_source_document_id: string
  readonly to_line_index: number | null
  readonly amount_currency: string
  readonly amount_minor: unknown
  readonly amount_exponent: number
  readonly evidence_kind: string
  readonly evidence_on_path: unknown
  readonly evidence_signed_variance_minor: unknown
  readonly evidence_day_gap: number | null
  readonly evidence_member_count: number | null
  readonly evidence_fell_through_from: string | null
  readonly evidence_similarity_basis_points: number | null
  readonly evidence_metric: string | null
  readonly evidence_confidence_basis_points: number | null
  readonly evidence_model_entry_id: string | null
}

export async function readRunAllocationPage(
  tx: ScopedClient,
  runId: string,
  page: { readonly after: number | null; readonly limit: number },
): Promise<AllocationRead> {
  const envelope = (
    await tx.query('SELECT outcome FROM tenant.run_engine_account WHERE run_id = $1', [runId])
  ).rows as unknown as { outcome: string }[]
  if (envelope[0] === undefined) return { kind: 'no_account' }

  const bad = (column: string): AllocationRead => ({
    kind: 'unpublishable',
    defect: { table: 'run_allocation', column, runId },
  })

  const rows = (
    await tx.query(
      `SELECT ordinal,
              from_side, from_source_document_id, from_line_index,
              to_side,   to_source_document_id,   to_line_index,
              amount_currency, amount_minor, amount_exponent,
              evidence_kind, evidence_on_path, evidence_signed_variance_minor,
              evidence_day_gap, evidence_member_count, evidence_fell_through_from,
              evidence_similarity_basis_points, evidence_metric,
              evidence_confidence_basis_points, evidence_model_entry_id
         FROM tenant.run_allocation
        WHERE run_id = $1 AND ordinal > $2
        ORDER BY ordinal
        LIMIT $3`,
      [runId, page.after ?? -1, page.limit + 1],
    )
  ).rows as unknown as AllocationRow[]

  const wanted = rows.slice(0, page.limit)
  const items: Record<string, unknown>[] = []
  for (const row of wanted) {
    if (!isPopulationSide(row.from_side)) return bad('from_side')
    if (!isPopulationSide(row.to_side)) return bad('to_side')
    const amountMinor = minorIn(row.amount_minor)
    if (amountMinor === null || amountMinor === 'refused') return bad('amount_minor')
    const evidence = shapeEvidence(row)
    if (evidence === null) return bad('evidence_kind')
    if (typeof evidence === 'string') return bad(evidence)
    items.push({
      from: {
        side: row.from_side,
        ref: { sourceDocumentId: row.from_source_document_id, lineIndex: row.from_line_index },
      },
      to: {
        side: row.to_side,
        ref: { sourceDocumentId: row.to_source_document_id, lineIndex: row.to_line_index },
      },
      amount: { currency: row.amount_currency, amountMinor, exponent: row.amount_exponent },
      evidence,
    })
  }

  const last = wanted[wanted.length - 1]
  return {
    kind: 'page',
    items,
    nextCursor:
      rows.length > page.limit && last !== undefined ? encodeResidueCursor(last.ordinal) : null,
  }
}

/**
 * One arm per `PairingEvidence` kind, and an arm whose operand column is NULL
 * is REFUSED by naming that column — a `day_gap` that is missing on an
 * `amount_and_date` row is a defect in the row, not a default of zero.
 * `null` means the kind itself is not one the model declares.
 *
 * ⚠️ `on` IS PUBLISHED AS THE CONTRACT'S SEGMENT OBJECTS — `{kind:'key',key}` /
 * `{kind:'index',index}`. This read *"AND NOT AS `pathIn()`'s BARE TOKENS …
 * Those three are not touched here; this one is born right"* until 1 Oct 2026,
 * and is corrected rather than deleted: G2471 moved the conversion INTO
 * `pathIn()`, so all four channels — this one and `HeldRead.path`,
 * `RefusedItem.path`, `AmbiguityFinding.on` — leave through one function and
 * the `segmentsOut()` that stood here is gone.
 */
function shapeEvidence(row: AllocationRow): Record<string, unknown> | string | null {
  const kind = row.evidence_kind
  if (!isPairingEvidenceKind(kind)) return null
  switch (kind) {
    case 'exact_identifier': {
      const on = pathIn(row.evidence_on_path)
      return on === null ? 'evidence_on_path' : { kind, on }
    }
    case 'tolerant_identifier': {
      const on = pathIn(row.evidence_on_path)
      if (on === null) return 'evidence_on_path'
      const variance = minorIn(row.evidence_signed_variance_minor)
      if (variance === null || variance === 'refused') return 'evidence_signed_variance_minor'
      return { kind, on, signedVarianceMinor: variance }
    }
    case 'amount_and_date':
      return row.evidence_day_gap === null
        ? 'evidence_day_gap'
        : { kind, dayGap: row.evidence_day_gap }
    case 'amount_sum_exact':
      return row.evidence_member_count === null
        ? 'evidence_member_count'
        : { kind, memberCount: row.evidence_member_count }
    case 'amount_sum_waterfall':
      return row.evidence_fell_through_from === null ||
        !isWaterfallFellThroughFrom(row.evidence_fell_through_from)
        ? 'evidence_fell_through_from'
        : { kind, fellThroughFrom: row.evidence_fell_through_from }
    case 'fuzzy_reference':
      if (row.evidence_similarity_basis_points === null) return 'evidence_similarity_basis_points'
      if (row.evidence_metric === null || !isSimilarityMetric(row.evidence_metric)) {
        return 'evidence_metric'
      }
      return {
        kind,
        similarityBasisPoints: row.evidence_similarity_basis_points,
        metric: row.evidence_metric,
      }
    case 'reader_confirmed':
      if (row.evidence_confidence_basis_points === null) return 'evidence_confidence_basis_points'
      if (row.evidence_model_entry_id === null) return 'evidence_model_entry_id'
      return {
        kind,
        confidenceBasisPoints: row.evidence_confidence_basis_points,
        modelEntryId: row.evidence_model_entry_id,
      }
  }
}

/* ⚠️ THE MODEL TYPES BELOW ARE IMPORTED AND NOT ALL READ THROUGH A `.`, AND THAT
 * IS DELIBERATE RATHER THAN DEAD WEIGHT: `PersistInput.result` is typed
 * `SetReconciliationResult`, so every loop in §3 is checked against the engine's
 * own declarations. A channel renamed in `model/reconciliation.ts` is a compile
 * error in this file. */
export type _ChannelsAreTheModels = [
  AdmissionRate,
  Allocation,
  AmbiguityFinding,
  CompletenessFinding,
  HeldRead,
  MeterFact,
  PostconditionFailure,
  RefusedItem,
  ResidueEntry,
  RunDocumentAccount,
  SearchBoundaryEntry,
]

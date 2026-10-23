/**
 * THE RESOLUTION CHAIN, READ AND WRITTEN — the bodies of C10's six operations,
 * minus their routes. G656–G660, 19 Sep 2026.
 *
 * `server/data-plane/proposals.ts` is the route and nothing else, exactly as
 * `exceptions.ts` is the route over `exception-store.ts`. Every question about
 * what a column HOLDS is settled in
 * `db/migrations/0059_resolution_chain.sql`; every question about what a VALUE
 * may be is settled in `server/data-plane/resolution-vocabulary.ts`, which
 * derives it from `model/`; every question about whether a proposal is
 * EXECUTABLE is settled in `model/approval.ts`, which is the one evaluator;
 * and no route is written here.
 *
 * ┌─ §0 · WHAT THIS FILE WILL NOT DO, STATED BEFORE WHAT IT DOES ──────────────┐
 * │                                                                            │
 * │ 🛑 IT WRITES NO TENANT PREDICATE, EVER. Invariant 1: *"Tenant scope is      │
 * │    derived from the session, never read from a request."* Every statement  │
 * │    below runs inside the `ScopedClient` the mint opened, and row-level      │
 * │    security supplies `tenant_id = current_setting('app.tenant_id')`.        │
 * │    `tests/db/resolution-chain.test.ts` §1 asserts the absence by scanning   │
 * │    the SQL, the way `tests/db/exception-register.test.ts` does.             │
 * │                                                                            │
 * │ 🛑 IT DOES NOT DECIDE WHETHER A CALLER MAY ACT. `decide()` did that, at the │
 * │    gate, before this file was reached, and `authorize()` did it again at    │
 * │    the mint. What this file decides is whether the THING is ready — a 409,  │
 * │    never a 403 — with the ONE exception the contract itself places on the   │
 * │    403: `approval_segregation_violation`, which is a refusal of THIS        │
 * │    caller for THIS act rather than a statement about the proposal.          │
 * │                                                                            │
 * │ 🛑 IT REFUSES; IT NEVER REPAIRS. A stored value the model cannot name is a  │
 * │    `ResolutionDefect` and a 500, never a coerced default. A fabricated      │
 * │    `family` would offer an operator a disposition their pack does not       │
 * │    ship, and the refusal would arrive later, from a different operation.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 THE IDEMPOTENCY KEY IS ACCEPTED AND **NOT HONOURED**. NAMED, NOT BUILT. ┐
 * │ `proposeResolution` and `executeProposal` both declare                     │
 * │ `Idempotency-Key`, and this slice stores no key and deduplicates nothing:  │
 * │ **a retry after a timeout double-proposes.**                               │
 * │                                                                            │
 * │ The half-measure was considered and is refused. Deduplicating on the KEY   │
 * │ ALONE would answer a DIFFERENT request with the FIRST one's body, silently │
 * │ — and the contract already has a name for the case that must not be        │
 * │ silent: `IdempotencyConflict`, *"Same key, different payload."* Answering  │
 * │ that needs a stored digest of the request, which is a table and a          │
 * │ retention question this slice does not take. A key that dedupes by name    │
 * │ and cannot detect a changed payload is worse than no key at all, because   │
 * │ the client believes it is protected.                                       │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import {
  APPROVAL_STATES,
  approvalState,
  segregationViolated,
  type ApprovalGate,
  type ApprovalRecord,
  type ApprovalVerdict,
  type ProposerRef,
} from '../../model/approval.ts'
import { compareMoney, formatMinorUnits, parseMinorUnits } from '../../model/money.ts'
import { RECONCILIATION_ARCHETYPES } from '../../model/domain.ts'
import type { Money, Severity } from '../../model/domain.ts'
import type { Timestamp, UserId } from '../../model/kernel.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import { isExceptionStatus, isSeverity } from './exception-vocabulary.ts'
import {
  BLOCKER_CODE,
  archetypeAllowsFamily,
  isApprovalDecision,
  isEvidenceKind,
  isProposalActorKind,
  isReconciliationArchetype,
  isReversibility,
  type WritableResolutionMode,
} from './resolution-vocabulary.ts'
import { formerMemberSql } from './former-member.ts'

/* ==================================================================== *
 * §1  THE ANSWERS
 *
 * ⚠️ `Record<string, unknown>`-SHAPED LITERALS AND NOT A HAND-WRITTEN MIRROR OF
 *    EVERY SCHEMA, for `exception-store.ts`'s reason: `server/contract/`
 *    already makes the OpenAPI document the router and the validator, and a
 *    TypeScript restatement of `Proposal` here would be a SECOND declaration
 *    of the response — §5.3, and the one nothing checks.
 * ==================================================================== */

/** What a row carried that the model cannot name. **Carries no cell value.** */
export interface ResolutionDefect {
  readonly table: string
  readonly column: string
  readonly rowId: string
}

/**
 * 🛑 ONE REFUSAL UNION FOR ALL SIX OPERATIONS, AND EVERY ARM IS A DIFFERENT
 *    STATUS. Six per-operation unions would be six places for a 409 to become
 *    a 422; the route turns arms into codes in one `switch`-free table.
 */
export type ChainRefusal =
  /** No such row, or a row row-level security made invisible. Always a 404. */
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unpublishable'; readonly defect: ResolutionDefect }
  /**
   * G3441 — the chain is NOT CONFIGURED for this tenant: no `approval_config`
   * row (see `loadGate()`), or no `definition_archetype` row for the
   * exception's definition (see `offeredFor()`). A 409
   * `resolution_not_configured`. ⚠️ THIS ARM WAS `no_gate` AND ANSWERED 500
   * `upstream_unavailable` UNTIL 3 Oct 2026, and every client rendered that as
   * "try again" — a retry that can never help (reaudit NC-01). It is still
   * FAIL-CLOSED: nothing below defaults to the weakest gate.
   */
  | { readonly kind: 'not_configured'; readonly missing: 'approval_config' | 'definition_archetype' }
  | { readonly kind: 'exception_already_resolved' }
  | { readonly kind: 'proposal_superseded' }
  | { readonly kind: 'disposition_not_offered' }
  | { readonly kind: 'disposition_requires_adjustment' }
  | { readonly kind: 'adjustment_currency_mismatch' }
  | { readonly kind: 'message_not_admitted' }
  | { readonly kind: 'segregation_violation' }
  | { readonly kind: 'rejection_reason_required' }
  /** Approved and not ready, or rejected. The contract's CENTRAL case. */
  | { readonly kind: 'not_executable'; readonly blockedBy: readonly string[] }

export type ChainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusal: ChainRefusal }

const refuse = <T>(refusal: ChainRefusal): ChainResult<T> => ({ ok: false, refusal })
const yes = <T>(value: T): ChainResult<T> => ({ ok: true, value })

const defect = <T>(table: string, column: string, rowId: string): ChainResult<T> =>
  refuse({ kind: 'unpublishable', defect: { table, column, rowId } })

/* ==================================================================== *
 * §2  THE MONEY SEAM — through the ONE codec, in both directions
 *
 * G111/G286: `model/money.ts` is the only thing in this repository permitted
 * to convert, and a `Number()` here would put the 2^53 ceiling back at the
 * read surface G286 was taken to lift. Copied in spirit from
 * `exception-store.ts`'s `minorIn`/`moneyIn`, and NOT imported from it,
 * because that pair returns a WIRE object and the approval gate needs a MODEL
 * `Money` to hand to `compareMoney()` — two different answers to one question
 * would be worse than two functions.
 * ==================================================================== */

/** The three columns as a model `Money`, or null, or refused. */
function moneyModel(
  currency: string | null,
  minor: unknown,
  exponent: number | null,
): Money | null | 'refused' {
  if (currency === null && minor === null && exponent === null) return null
  if (currency === null || exponent === null) return 'refused'
  if (typeof minor !== 'string') return 'refused'
  const parsed = parseMinorUnits(minor)
  if (!parsed.ok) return 'refused'
  return { currency, amountMinor: parsed.value, exponent }
}

/**
 * A model `Money` in the shape the wire declares.
 *
 * 🛑 `amountMinor` IS A DECIMAL STRING. *"A JSON number would be read back by
 *    every consumer as an IEEE-754 double and silently lose exactness above
 *    2^53."*
 */
function moneyWire(value: Money | null): Record<string, unknown> | null {
  if (value === null) return null
  return {
    currency: value.currency,
    amountMinor: formatMinorUnits(value.amountMinor),
    exponent: value.exponent,
  }
}

/**
 * The GREATER of the exception's `valueAtRisk` and the proposal's
 * `adjustment` — *"Evaluated against the greater … on EVERY execution path
 * including manual."*
 *
 * ⚠️ IT CANNOT REFUSE IN PRACTICE AND IT STILL HANDLES THE REFUSAL, because
 *    the currency agreement is enforced at `proposeResolution` and a row
 *    written before that rule existed would reach here. A refusal is treated
 *    as "the adjustment wins", which is the LARGER-of-two reading that fails
 *    towards requiring approval rather than away from it.
 */
function greaterAtRisk(valueAtRisk: Money | null, adjustment: Money | null): Money | null {
  if (valueAtRisk === null) return adjustment
  if (adjustment === null) return valueAtRisk
  const compared = compareMoney(valueAtRisk, adjustment)
  if (!compared.ok) return adjustment
  return compared.value >= 0 ? valueAtRisk : adjustment
}

/* ==================================================================== *
 * §3  THE THREE READS EVERY OPERATION SHARES
 * ==================================================================== */

interface ExceptionFacts {
  readonly id: string
  readonly definitionId: string
  readonly severity: Severity
  readonly status: string
  readonly valueAtRisk: Money | null
  readonly resolved: boolean
}

async function loadException(
  tx: ScopedClient,
  exceptionId: string,
): Promise<ChainResult<ExceptionFacts>> {
  /* 🛑 NO TENANT PREDICATE. The 404 is one answer to two questions — no such
     row, or a row in another tenant — because `capability.openapi.yaml`'s
     `NotFound` is returned *"identically … distinguishing them would make
     this endpoint an existence oracle across the tenant boundary."* Both
     arrive here as the same empty result set, so there is no branch to get
     wrong. */
  const rows = (
    await tx.query(
      `SELECT id, definition_id, severity, status,
              value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
              resolution_mode
         FROM tenant.exception
        WHERE id = $1`,
      [exceptionId],
    )
  ).rows as unknown as {
    id: string
    definition_id: string
    severity: string
    status: string
    value_at_risk_currency: string | null
    value_at_risk_minor: unknown
    value_at_risk_exponent: number | null
    resolution_mode: string | null
  }[]

  const row = rows[0]
  if (row === undefined) return refuse({ kind: 'not_found' })
  if (!isSeverity(row.severity)) return defect('exception', 'severity', row.id)
  if (!isExceptionStatus(row.status)) return defect('exception', 'status', row.id)

  const valueAtRisk = moneyModel(
    row.value_at_risk_currency,
    row.value_at_risk_minor,
    row.value_at_risk_exponent,
  )
  if (valueAtRisk === 'refused') return defect('exception', 'value_at_risk_minor', row.id)

  return yes({
    id: row.id,
    definitionId: row.definition_id,
    severity: row.severity,
    status: row.status,
    valueAtRisk,
    resolved: row.resolution_mode !== null,
  })
}

/**
 * The tenant's `ApprovalConfig`, lifted to an `ApprovalGate`.
 *
 * 🛑 A MISSING ROW IS A 500 AND NOT A DEFAULT, AND THAT IS THE SAME
 *    FAIL-CLOSED CHOICE `approval_decision_insert_restrictive` MAKES IN SQL.
 *    The tempting default — quorum 1, no severity floor, no segregation — is
 *    the WEAKEST configuration expressible, so a tenant nobody configured
 *    would silently get the least supervision. `docs/HANDOFF.md` §5.5:
 *    readable-by-default-with-a-high-bar is scope failing OPEN.
 *
 * ⚠️ AND IT IS A 500 RATHER THAN A 403 BECAUSE IT IS OUR MISCONFIGURATION AND
 *    NOT THE CALLER'S FAULT. A 403 would tell an operator they lack authority
 *    they may well hold.
 *
 * ✅ G3441, 3 Oct 2026 — THE TWO PARAGRAPHS ABOVE SAY "500" AND ARE CORRECTED
 *    RATHER THAN DELETED: the fail-closed half stands unchanged (no default
 *    gate), and the 403 refusal stands. What was wrong is the 500 itself — a
 *    500 is a transient failure on every client, and this answer is the same
 *    on every retry. It is a 409 `resolution_not_configured` now, which is
 *    neither a missing authority nor a failure below us.
 */
async function loadGate(tx: ScopedClient): Promise<ChainResult<ApprovalGate>> {
  const rows = (
    await tx.query(
      `SELECT quorum, mandatory_at_or_above,
              mandatory_value_currency, mandatory_value_minor, mandatory_value_exponent,
              segregation_of_duties
         FROM tenant.approval_config`,
    )
  ).rows as unknown as {
    quorum: number
    mandatory_at_or_above: string
    mandatory_value_currency: string | null
    mandatory_value_minor: unknown
    mandatory_value_exponent: number | null
    segregation_of_duties: boolean
  }[]

  const row = rows[0]
  if (row === undefined) return refuse({ kind: 'not_configured', missing: 'approval_config' })
  if (!isSeverity(row.mandatory_at_or_above)) {
    return defect('approval_config', 'mandatory_at_or_above', '')
  }
  const floor = moneyModel(
    row.mandatory_value_currency,
    row.mandatory_value_minor,
    row.mandatory_value_exponent,
  )
  if (floor === 'refused') return defect('approval_config', 'mandatory_value_minor', '')

  return yes({
    quorum: row.quorum,
    mandatoryAtOrAbove: row.mandatory_at_or_above,
    mandatoryAtOrAboveValue: floor,
    segregationOfDuties: row.segregation_of_duties,
  })
}

interface ProposalRow {
  readonly id: string
  readonly exception_id: string
  readonly proposed_by_kind: string
  readonly proposed_by_user_id: string | null
  readonly proposed_by_step_id: string | null
  readonly proposed_by_model_id: string | null
  /** G3886 — `0520`'s co-member name; verbatim, parsed by nothing (D6-9). */
  readonly proposed_by_name: string | null
  /** G4021 — `former-member.ts`; true iff a lapsed member, never a name. */
  readonly proposed_by_former_member: boolean
  readonly disposition_key: string
  readonly rationale: string
  readonly adjustment_currency: string | null
  readonly adjustment_minor: unknown
  readonly adjustment_exponent: number | null
  readonly proposed_at: Date
  readonly superseded_by_proposal_id: string | null
}

const PROPOSAL_COLUMNS = `
  id, exception_id, proposed_by_kind, proposed_by_user_id, proposed_by_step_id,
  proposed_by_model_id, disposition_key, rationale,
  adjustment_currency, adjustment_minor, adjustment_exponent,
  proposed_at, superseded_by_proposal_id,
  -- G3886 — the proposer's name through \`0520\`'s co-member view and nothing
  -- wider; NULL for an agent, a lapsed member, or a reader who is no member.
  (SELECT n.display_name FROM tenant.co_member_name n WHERE n.user_id = proposed_by_user_id) AS proposed_by_name,
  -- G4021 — whether the proposer is a FORMER member; never a name.
  ${formerMemberSql('proposed_by_user_id')} AS proposed_by_former_member`

/* ==================================================================== *
 * §4  THE DISPOSITION CATALOGUE — `listAvailableDispositions`'s body
 *
 * THE INTERSECTION OF THREE THINGS, and the contract names all three:
 *
 *   1 · what the INSTALLED PACK offers          → `tenant.disposition`
 *   2 · what the ARCHETYPE allows               → `DISPOSITION_FAMILIES`, in
 *                                                 `model/domain.ts`, read and
 *                                                 never transcribed
 *   3 · what POLICY permits this actor to
 *       choose right now                        → 🛑 SEE BELOW
 *
 * ┌─ 🛑 THE THIRD INTERSECTION HAS NO PRODUCER AND IS NOT FAKED ───────────────┐
 * │ There is no `policy` table and no `AutonomyConfig` row, so *"an            │
 * │ irreversible disposition above the autonomy ceiling"* cannot be computed   │
 * │ here at all. **`available` is therefore NOT the contract's full            │
 * │ predicate**, and publishing `true` for every row would be a claim this     │
 * │ database cannot support.                                                   │
 * │                                                                            │
 * │ What is published instead is the STRONGEST HONEST RULE: `available` is     │
 * │ false exactly when `proposeResolution` WOULD REFUSE, for a reason this     │
 * │ database can see. Two such reasons exist today and each mirrors one of     │
 * │ that operation's own refusals:                                             │
 * │                                                                            │
 * │   `exception_already_resolved`     the exception carries a resolution, so  │
 * │                                    NOTHING is choosable.                   │
 * │   `adjustment_currency_mismatch`   the disposition requires an adjustment  │
 * │                                    and the exception has NO `valueAtRisk`, │
 * │                                    so there is no currency for the         │
 * │                                    adjustment to agree with and no request │
 * │                                    could ever satisfy it.                  │
 * │                                                                            │
 * │ **The mirror is the property, and it is tested in both directions**:       │
 * │ `tests/db/resolution-chain.test.ts` §3 requires that every disposition     │
 * │ this function marks unavailable is refused by `createProposal()` with THE  │
 * │ SAME CODE, and that every one it marks available is accepted. A list       │
 * │ whose `available` disagrees with the POST is worse than no list — it       │
 * │ teaches an operator to pick the thing that will fail.                      │
 * │                                                                            │
 * │ ⚠️ SO THE AUTONOMY-CEILING HALF IS OWED, NOT DONE, and a client must not   │
 * │    read `available: true` as *"policy permits this"*. It means *"this      │
 * │    plane knows no reason to refuse it"*.                                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 * ==================================================================== */

export interface DispositionSet {
  readonly archetype: string
  readonly packKey: string | null
  readonly dispositions: readonly Record<string, unknown>[]
}

interface DispositionRow {
  readonly key: string
  readonly label: string
  readonly family: string
  readonly reversibility: string
  readonly terminal: boolean
  readonly requires_adjustment: boolean
}

/**
 * The offered set for one exception, as ROWS rather than as a wire shape —
 * `createProposal()` needs the same answer and must not compute a second one.
 */
async function offeredFor(
  tx: ScopedClient,
  facts: ExceptionFacts,
): Promise<ChainResult<{ archetype: string; packKey: string | null; rows: DispositionRow[] }>> {
  const defRows = (
    await tx.query(
      'SELECT archetype, pack_key FROM tenant.definition_archetype WHERE definition_id = $1',
      [facts.definitionId],
    )
  ).rows as unknown as { archetype: string; pack_key: string | null }[]

  const def = defRows[0]
  /* 🛑 NO ROW IS NOT A 404. The EXCEPTION exists; its definition has no
     projection here. `db/migrations/0059` §1 names that as a real state, and
     the honest answer is the exception's own archetype being unknown — which
     is a 500, because every `listAvailableDispositions` 200 declares
     `archetype` as `required` and there is nothing truthful to put in it.
     Publishing a guess would name a family set the pack never agreed to. */
  /* ⚠️ G3441 — THIS WAS `defect('definition_archetype', 'definition_id', …)`,
     A 500, AND THE ARGUMENT ABOVE IS WHY IT IS STILL NOT A 200: there is
     nothing truthful to put in `archetype`. What changed is the STATUS — an
     absent projection is a configuration nobody wrote, the same on every
     retry, so it answers 409 `resolution_not_configured` rather than a 500 a
     client renders as transient. An UNKNOWN archetype word, below, is still a
     defect and still a 500. */
  if (def === undefined) return refuse({ kind: 'not_configured', missing: 'definition_archetype' })
  if (!isReconciliationArchetype(def.archetype)) {
    return defect('definition_archetype', 'archetype', facts.id)
  }

  /* A definition with no pack has an EMPTY set, not a set of every pack's
     dispositions. `0059` §1 argues it: a disposition is NAMED by a pack. */
  if (def.pack_key === null) {
    return yes({ archetype: def.archetype, packKey: null, rows: [] })
  }

  const rows = (
    await tx.query(
      `SELECT key, label, family, reversibility, terminal, requires_adjustment
         FROM tenant.disposition
        WHERE pack_key = $1
        ORDER BY family, key`,
      [def.pack_key],
    )
  ).rows as unknown as DispositionRow[]

  const kept: DispositionRow[] = []
  for (const row of rows) {
    if (!isReversibility(row.reversibility)) {
      return defect('disposition', 'reversibility', row.key)
    }
    /* 🛑 THE ARCHETYPE FILTER, AND IT IS A FILTER RATHER THAN A REFUSAL. A
       pack legitimately ships dispositions for several archetypes — the rows
       are keyed by pack, not by definition — so a family outside THIS
       archetype is simply not offered here. An unknown family that belongs to
       NO archetype is a different thing and is refused, below, because it is
       a row the model cannot name at all. */
    if (archetypeAllowsFamily(def.archetype, row.family)) {
      kept.push(row)
      continue
    }
    if (!anyArchetypeAllows(row.family)) return defect('disposition', 'family', row.key)
  }
  return yes({ archetype: def.archetype, packKey: def.pack_key, rows: kept })
}

/**
 * Whether ANY archetype claims this family — the narrow question the filter
 * above needs and the one `resolution-vocabulary.ts` deliberately declines to
 * export as a general predicate, because as a general predicate it would admit
 * `quantity_variance` on a `set_reconciliation` definition.
 */
function anyArchetypeAllows(family: string): boolean {
  /* ⚠️ THE MODEL'S OWN OBJECT, READ RATHER THAN RE-LISTED. The one place this
     file names the archetype set. */
  for (const archetype of Object.values(RECONCILIATION_ARCHETYPES)) {
    if (archetypeAllowsFamily(archetype, family)) return true
  }
  return false
}

export async function readAvailableDispositions(
  tx: ScopedClient,
  exceptionId: string,
): Promise<ChainResult<DispositionSet>> {
  const exception = await loadException(tx, exceptionId)
  if (!exception.ok) return exception
  const offered = await offeredFor(tx, exception.value)
  if (!offered.ok) return offered

  const unvalued = exception.value.valueAtRisk === null
  const dispositions = offered.value.rows.map((row) => {
    /* See §4's header: the two rules, each mirroring a `createProposal()`
       refusal exactly. `unavailableFor` is `null` when available, which the
       schema's `oneOf` admits and which is not the same as omitting it. */
    const unavailableFor = exception.value.resolved
      ? 'exception_already_resolved'
      : row.requires_adjustment && unvalued
        ? 'adjustment_currency_mismatch'
        : null
    return {
      key: row.key,
      label: row.label,
      family: row.family,
      reversibility: row.reversibility,
      terminal: row.terminal,
      requiresAdjustment: row.requires_adjustment,
      available: unavailableFor === null,
      unavailableFor,
    }
  })

  return yes({
    archetype: offered.value.archetype,
    packKey: offered.value.packKey,
    dispositions,
  })
}

/**
 * IS THIS KEY IN THE OFFERED SET FOR THIS EXCEPTION? — the one question
 * `reverseResolution` asks of this file, and the reason it asks it HERE.
 * **G950, 20 Sep 2026.**
 *
 * 🛑 `correctedDispositionKey` IS *"Validated against the same closed list as a
 *    proposal — a correction is not an escape from the vocabulary."* **The
 *    same list means the same code.** `offeredFor()` resolves the definition's
 *    archetype, narrows to the pack that named the dispositions, filters the
 *    families that archetype claims and REFUSES a family no archetype claims;
 *    a second `SELECT … FROM tenant.disposition` in `reversal-store.ts` would
 *    be §5.3 — two implementations of one closed set — and the copy is always
 *    the one that drifts.
 *
 * ⚠️ ITS OWN UNION AND NOT `ChainResult`, DELIBERATELY. The caller is not in
 *    the resolution chain and must not gain the ability to answer
 *    `proposal_superseded` or `not_executable` by accident; the only two
 *    outcomes it can act on are *"offered or not"* and *"this row is
 *    unpublishable"*. The three `ChainRefusal` arms reachable from here are
 *    collapsed onto the second, and `not_found` is one of them: a caller that
 *    has already read the exception in THIS transaction and then cannot find
 *    it has a row problem, not a 404.
 */
export type OfferedCheck =
  | { readonly ok: true; readonly offered: boolean }
  | { readonly ok: false; readonly table: string; readonly column: string }

export async function dispositionIsOffered(
  tx: ScopedClient,
  exceptionId: string,
  key: string,
): Promise<OfferedCheck> {
  const exception = await loadException(tx, exceptionId)
  if (!exception.ok) return notOffered(exception.refusal)
  const offered = await offeredFor(tx, exception.value)
  if (!offered.ok) return notOffered(offered.refusal)
  return { ok: true, offered: offered.value.rows.some((row) => row.key === key) }
}

function notOffered(refusal: ChainRefusal): OfferedCheck {
  if (refusal.kind === 'unpublishable') {
    return { ok: false, table: refusal.defect.table, column: refusal.defect.column }
  }
  /* `not_found` and `not_configured` (G3441; it was `no_gate`) are the only other arms `loadException()` and
     `offeredFor()` can produce, and neither is a thing the caller may report:
     see the docblock. Named as a row problem on the table that failed to
     answer. */
  return { ok: false, table: 'exception', column: 'id' }
}

/* ==================================================================== *
 * §5  SHAPING A PROPOSAL — the one place `Proposal` is built
 *
 * 🛑 THREE STATEMENTS AND NOT ONE JOIN. A proposal carries an evidence array
 *    and a decision array, and a join would return the cartesian product of
 *    them — three evidence rows and two decisions is six, and the
 *    de-duplication in application code is where a lost approval would hide.
 *    `exception-store.ts` §7 reads its two arrays the same way for the same
 *    reason, and here the stakes are higher: a lost approval is a lost
 *    signature.
 * ==================================================================== */

async function shapeProposal(
  tx: ScopedClient,
  row: ProposalRow,
  gate: ApprovalGate,
  facts: ExceptionFacts,
  executed: boolean,
): Promise<ChainResult<{ wire: Record<string, unknown>; verdict: ApprovalVerdict }>> {
  if (!isProposalActorKind(row.proposed_by_kind)) {
    return defect('resolution_proposal', 'proposed_by_kind', row.id)
  }

  const adjustment = moneyModel(
    row.adjustment_currency,
    row.adjustment_minor,
    row.adjustment_exponent,
  )
  if (adjustment === 'refused') return defect('resolution_proposal', 'adjustment_minor', row.id)

  const evidence = await readEvidence(tx, row.id)
  if (!evidence.ok) return evidence

  const decisions = await readDecisions(tx, row.id)
  if (!decisions.ok) return decisions

  const proposedBy: ProposerRef =
    row.proposed_by_kind === 'user' && row.proposed_by_user_id !== null
      ? { kind: 'user', userId: row.proposed_by_user_id as UserId }
      : { kind: 'agent' }

  const verdict = approvalState(gate, {
    proposedBy,
    decisions: decisions.value.records,
    superseded: row.superseded_by_proposal_id !== null,
    executed,
    exceptionResolved: facts.resolved && !executed,
    severity: facts.severity,
    atRisk: greaterAtRisk(facts.valueAtRisk, adjustment),
  })

  /* The label is looked up rather than stored on the proposal: a pack that
     renames a disposition renames it everywhere, and a stored label would
     leave old proposals rendering a name the pack no longer uses.
     `dispositionLabel` is NOT `required` on the wire, so a key whose
     disposition has since been withdrawn publishes the key and no label —
     which is the truth. */
  const label = await dispositionLabel(tx, facts.definitionId, row.disposition_key)

  return yes({
    verdict,
    wire: {
      proposalId: row.id,
      exceptionId: row.exception_id,
      proposedBy: {
        kind: row.proposed_by_kind,
        userId: row.proposed_by_user_id,
        stepId: row.proposed_by_step_id,
        modelId: row.proposed_by_model_id,
        ...(row.proposed_by_kind === 'user'
          ? { displayName: row.proposed_by_name, formerMember: row.proposed_by_former_member }
          : {}),
      },
      dispositionKey: row.disposition_key,
      ...(label === null ? {} : { dispositionLabel: label }),
      rationale: row.rationale,
      evidence: evidence.value,
      adjustment: moneyWire(adjustment),
      proposedAt: row.proposed_at.toISOString(),
      supersededByProposalId: row.superseded_by_proposal_id,
      execution: executionBlock(gate, verdict, decisions.value.wire),
    },
  })
}

/**
 * `ProposalExecution` — *"'Approved' and 'executable' are different facts, and
 * the gap between them is the entire reason a money threshold exists."*
 *
 * ⚠️ `secondApproverAbove` IS OMITTED AND NOT SET NULL, AND THE OMISSION IS THE
 *    STATEMENT. The contract: *"From the `human` step, not from policy — the
 *    two are separate gates and BOTH must be satisfied."* There is no
 *    `procedure_step` table, so the field has no producer; it is not in
 *    `requiredApprovals`'s `required` list precisely so an absence is
 *    expressible. Publishing `null` would assert that no step declares one,
 *    which this plane cannot know.
 */
function executionBlock(
  gate: ApprovalGate,
  verdict: ApprovalVerdict,
  approvals: readonly Record<string, unknown>[],
): Record<string, unknown> {
  return {
    state: verdict.state,
    approvals,
    requiredApprovals: {
      quorum: gate.quorum,
      segregationOfDuties: gate.segregationOfDuties,
      mandatoryAtOrAbove: gate.mandatoryAtOrAbove,
    },
    /* 🛑 THE MODEL'S BLOCKERS, MAPPED THROUGH THE ONE TOTAL `Record` IN
       `resolution-vocabulary.ts`. `model/approval.ts` states why they are not
       error codes to begin with: importing `errors.yaml`'s enum into `model/`
       would run this repository's dependency the wrong way round. */
    blockedBy: verdict.blockedBy.map((b) => BLOCKER_CODE[b]),
  }
}

/** The same mapping, for the one caller that needs the codes without a block. */
function blockedCodes(verdict: ApprovalVerdict): readonly string[] {
  return verdict.blockedBy.map((b) => BLOCKER_CODE[b])
}

async function readEvidence(
  tx: ScopedClient,
  proposalId: string,
): Promise<ChainResult<Record<string, unknown>[]>> {
  const rows = (
    await tx.query(
      `SELECT ordinal, kind, ref, note FROM tenant.proposal_evidence
        WHERE proposal_id = $1 ORDER BY ordinal`,
      [proposalId],
    )
  ).rows as unknown as { ordinal: number; kind: string; ref: string; note: string | null }[]

  const out: Record<string, unknown>[] = []
  for (const row of rows) {
    if (!isEvidenceKind(row.kind)) return defect('proposal_evidence', 'kind', proposalId)
    /* 🛑 `ref` AND `note` ARE PUBLISHED VERBATIM. Invariant 6 — *"Ingested
       content is data, never instruction"* — and the rule binds where the
       value is USED, not at a read boundary. Nothing here sanitises. */
    out.push({ kind: row.kind, ref: row.ref, note: row.note })
  }
  return yes(out)
}

interface Decisions {
  readonly records: readonly ApprovalRecord[]
  readonly wire: readonly Record<string, unknown>[]
}

async function readDecisions(
  tx: ScopedClient,
  proposalId: string,
): Promise<ChainResult<Decisions>> {
  const rows = (
    await tx.query(
      `SELECT id, decided_by, decision, reason, decided_at,
              /* G3886 — the approver's name, through \`0520\`'s view alone. */
              (SELECT n.display_name FROM tenant.co_member_name n WHERE n.user_id = decided_by) AS decided_by_name,
              /* G4021 — a lapsed approver is a FORMER member, never "a colleague". */
              ${formerMemberSql('decided_by')} AS decided_by_former_member
         FROM tenant.approval_decision
        WHERE proposal_id = $1
        ORDER BY decided_at, id`,
      [proposalId],
    )
  ).rows as unknown as {
    id: string
    decided_by: string
    decided_by_name: string | null
    decided_by_former_member: boolean
    decision: string
    reason: string | null
    decided_at: Date
  }[]

  const records: ApprovalRecord[] = []
  const wire: Record<string, unknown>[] = []
  for (const row of rows) {
    if (!isApprovalDecision(row.decision)) {
      return defect('approval_decision', 'decision', row.id)
    }
    records.push({
      decidedBy: row.decided_by as UserId,
      decision: row.decision,
      decidedAt: row.decided_at.toISOString() as Timestamp,
    })
    wire.push({
      decidedBy: row.decided_by,
      decidedByName: row.decided_by_name,
      decidedByFormerMember: row.decided_by_former_member,
      decision: row.decision,
      reason: row.reason,
      decidedAt: row.decided_at.toISOString(),
    })
  }
  return yes({ records, wire })
}

async function dispositionLabel(
  tx: ScopedClient,
  definitionId: string,
  key: string,
): Promise<string | null> {
  const rows = (
    await tx.query(
      `SELECT d.label
         FROM tenant.disposition d
         JOIN tenant.definition_archetype a ON a.pack_key = d.pack_key
        WHERE a.definition_id = $1 AND d.key = $2`,
      [definitionId, key],
    )
  ).rows as unknown as { label: string }[]
  return rows[0]?.label ?? null
}

/* ==================================================================== *
 * §6  THE READS — `listProposals` and `getProposal`
 * ==================================================================== */

export async function readProposalsFor(
  tx: ScopedClient,
  exceptionId: string,
): Promise<ChainResult<readonly Record<string, unknown>[]>> {
  const facts = await loadException(tx, exceptionId)
  if (!facts.ok) return facts
  const gate = await loadGate(tx)
  if (!gate.ok) return gate

  /* 🛑 NEWEST FIRST, AND SUPERSEDED PROPOSALS ARE RETURNED. *"An exception
     that took three proposals to settle is a signal about the rule or the
     pack, and deleting the first two erases it."* The `, id DESC` tail is what
     makes the order total — two proposals minted in one microsecond would
     otherwise reorder between renders. */
  const rows = (
    await tx.query(
      `SELECT ${PROPOSAL_COLUMNS} FROM tenant.resolution_proposal
        WHERE exception_id = $1 ORDER BY proposed_at DESC, id DESC`,
      [exceptionId],
    )
  ).rows as unknown as ProposalRow[]

  const executedId = await executedProposalId(tx, exceptionId)
  const out: Record<string, unknown>[] = []
  for (const row of rows) {
    const shaped = await shapeProposal(tx, row, gate.value, facts.value, row.id === executedId)
    if (!shaped.ok) return shaped
    out.push(shaped.value.wire)
  }
  return yes(out)
}

/** The proposal the exception's resolution names, or null. */
async function executedProposalId(tx: ScopedClient, exceptionId: string): Promise<string | null> {
  const rows = (
    await tx.query('SELECT resolution_proposal_id FROM tenant.exception WHERE id = $1', [
      exceptionId,
    ])
  ).rows as unknown as { resolution_proposal_id: string | null }[]
  return rows[0]?.resolution_proposal_id ?? null
}

interface LoadedProposal {
  readonly row: ProposalRow
  readonly facts: ExceptionFacts
  readonly gate: ApprovalGate
  readonly executed: boolean
}

async function loadProposal(
  tx: ScopedClient,
  proposalId: string,
): Promise<ChainResult<LoadedProposal>> {
  const rows = (
    await tx.query(`SELECT ${PROPOSAL_COLUMNS} FROM tenant.resolution_proposal WHERE id = $1`, [
      proposalId,
    ])
  ).rows as unknown as ProposalRow[]
  const row = rows[0]
  if (row === undefined) return refuse({ kind: 'not_found' })

  const facts = await loadException(tx, row.exception_id)
  if (!facts.ok) return facts
  const gate = await loadGate(tx)
  if (!gate.ok) return gate

  const executedId = await executedProposalId(tx, row.exception_id)
  return yes({ row, facts: facts.value, gate: gate.value, executed: executedId === row.id })
}

export async function readProposal(
  tx: ScopedClient,
  proposalId: string,
): Promise<ChainResult<Record<string, unknown>>> {
  const loaded = await loadProposal(tx, proposalId)
  if (!loaded.ok) return loaded
  const shaped = await shapeProposal(
    tx,
    loaded.value.row,
    loaded.value.gate,
    loaded.value.facts,
    loaded.value.executed,
  )
  if (!shaped.ok) return shaped
  return yes(shaped.value.wire)
}

/* ==================================================================== *
 * §7  `proposeResolution` — the first act on this plane that records a
 *     JUDGEMENT.
 * ==================================================================== */

export interface EvidenceInput {
  readonly kind: string
  readonly ref: string
  readonly note?: string | null
}

export interface ProposalInput {
  readonly dispositionKey: string
  readonly rationale: string
  readonly evidence: readonly EvidenceInput[]
  readonly adjustment?: { readonly currency: string; readonly amountMinor: string; readonly exponent: number } | null
}

/**
 * 🛑 THE ORDER OF THE CHECKS IS THE SPECIFICATION. `exception_already_resolved`
 *    is a 409 and every other refusal here is a 422, so asking the 409's
 *    question LAST would answer *"that disposition is not offered"* about a
 *    row nobody may propose on at all — a true sentence pointing at the wrong
 *    problem.
 */
export async function createProposal(
  tx: ScopedClient,
  exceptionId: string,
  input: ProposalInput,
  actor: { readonly userId: UserId; readonly now: Timestamp; readonly proposalId: string },
): Promise<ChainResult<Record<string, unknown>>> {
  const facts = await loadException(tx, exceptionId)
  if (!facts.ok) return facts
  if (facts.value.resolved) return refuse({ kind: 'exception_already_resolved' })

  const gate = await loadGate(tx)
  if (!gate.ok) return gate

  const offered = await offeredFor(tx, facts.value)
  if (!offered.ok) return offered

  const chosen = offered.value.rows.find((r) => r.key === input.dispositionKey)
  /* *"Any other value is `disposition_not_offered`. There is no free-text
     fallback and there will not be one."* */
  if (chosen === undefined) return refuse({ kind: 'disposition_not_offered' })

  const adjustment =
    input.adjustment === undefined || input.adjustment === null
      ? null
      : moneyModel(input.adjustment.currency, input.adjustment.amountMinor, input.adjustment.exponent)
  if (adjustment === 'refused') {
    /* An adjustment ajv admitted whose `amountMinor` the codec will not parse.
       422 rather than 500: the string came from the caller. */
    return refuse({ kind: 'adjustment_currency_mismatch' })
  }

  if (chosen.requires_adjustment && adjustment === null) {
    return refuse({ kind: 'disposition_requires_adjustment' })
  }
  if (adjustment !== null) {
    /* 🛑 THE CURRENCY MUST AGREE WITH THE EXCEPTION'S OWN, AND AN EXCEPTION
       WITH NO `valueAtRisk` HAS NONE TO AGREE WITH. Both arms are the same
       refusal because both are the same fact: there is no exchange rate here
       and no codec may invent one. `readAvailableDispositions()` publishes
       `available: false` with this code for the second arm, so the list and
       the POST cannot disagree. */
    const against = facts.value.valueAtRisk
    if (against === null || against.currency !== adjustment.currency) {
      return refuse({ kind: 'adjustment_currency_mismatch' })
    }
  }

  for (const item of input.evidence) {
    if (!isEvidenceKind(item.kind)) return refuse({ kind: 'disposition_not_offered' })
    if (item.kind !== 'correspondence') continue
    /* 🛑 INVARIANT 6's SECOND ENFORCEMENT POINT. *"A CORRESPONDENCE REF MUST
       NAME AN ADMITTED MESSAGE."* `admitted_as_evidence_at` (`0022`) is the
       column that decides whether an agent may be fed a counterparty's words
       as grounds; a null one means the message was read and not admitted, and
       the two are not the same event. RLS scopes the lookup, so a message in
       another tenant is simply not admitted here. */
    const admitted = (
      await tx.query(
        `SELECT 1 FROM tenant.correspondence_message
          WHERE id = $1 AND admitted_as_evidence_at IS NOT NULL`,
        [item.ref],
      )
    ).rows
    if (admitted.length === 0) return refuse({ kind: 'message_not_admitted' })
  }

  /* 🛑 SUPERSEDE FIRST, INSERT SECOND, IN ONE TRANSACTION. The reverse order
     leaves an instant in which two proposals on one exception are both
     current, and `approvalState()` would call neither superseded. The whole
     act is inside the transaction the mint opened, so there is no instant at
     which a reader sees either half alone. */
  await tx.query(
    `UPDATE tenant.resolution_proposal
        SET superseded_by_proposal_id = $2
      WHERE exception_id = $1 AND superseded_by_proposal_id IS NULL`,
    [exceptionId, actor.proposalId],
  )

  await tx.query(
    `INSERT INTO tenant.resolution_proposal
       (tenant_id, id, exception_id, proposed_by_kind, proposed_by_user_id,
        disposition_key, rationale,
        adjustment_currency, adjustment_minor, adjustment_exponent, proposed_at)
     VALUES (nullif(current_setting('app.tenant_id', true), ''), $1, $2, 'user', $3,
             $4, $5, $6, $7, $8, $9::timestamptz)`,
    [
      actor.proposalId,
      exceptionId,
      actor.userId as string,
      input.dispositionKey,
      input.rationale,
      adjustment?.currency ?? null,
      adjustment === null ? null : formatMinorUnits(adjustment.amountMinor),
      adjustment?.exponent ?? null,
      actor.now,
    ],
  )

  for (const [ordinal, item] of input.evidence.entries()) {
    await tx.query(
      `INSERT INTO tenant.proposal_evidence
         (tenant_id, proposal_id, ordinal, kind, ref, note)
       VALUES (nullif(current_setting('app.tenant_id', true), ''), $1, $2, $3, $4, $5)`,
      [actor.proposalId, ordinal, item.kind, item.ref, item.note ?? null],
    )
  }

  /* 🛑 THE STATUS MOVES, AND WHICH WAY IT MOVES IS THE GATE'S ANSWER RATHER
     THAN A CONSTANT. `pending_approval` when approval is mandatory,
     `resolution_proposed` when it is not — because those two words are the
     difference between "somebody must sign this" and "somebody may execute
     it", and a queue that showed `pending_approval` for a proposal needing no
     approval would send an operator looking for an approver who is not
     required. The trigger in `0059` is what requires this UPDATE to carry a
     `propose_resolution` record. */
  const armed = approvalState(gate.value, {
    proposedBy: { kind: 'user', userId: actor.userId },
    decisions: [],
    superseded: false,
    executed: false,
    exceptionResolved: false,
    severity: facts.value.severity,
    atRisk: greaterAtRisk(facts.value.valueAtRisk, adjustment),
  })
  await tx.query('UPDATE tenant.exception SET status = $2 WHERE id = $1', [
    exceptionId,
    armed.approvalRequired ? 'pending_approval' : 'resolution_proposed',
  ])

  return readProposal(tx, actor.proposalId)
}

/* ==================================================================== *
 * §8  `decideApproval` — the four-eyes act
 * ==================================================================== */

export async function recordApproval(
  tx: ScopedClient,
  proposalId: string,
  input: { readonly decision: string; readonly reason?: string | null },
  actor: { readonly userId: UserId; readonly now: Timestamp; readonly decisionId: string },
): Promise<ChainResult<Record<string, unknown>>> {
  const loaded = await loadProposal(tx, proposalId)
  if (!loaded.ok) return loaded
  const { row, gate, executed } = loaded.value

  if (!isApprovalDecision(input.decision)) {
    /* ajv's enum already refused this; the guard exists because the
       alternative is an `else` branch that records an unknown verdict, and an
       unknown verdict in an approval table is a signature nobody can read. */
    return refuse({ kind: 'rejection_reason_required' })
  }
  if (input.decision === 'rejected' && (input.reason ?? '') === '') {
    return refuse({ kind: 'rejection_reason_required' })
  }

  /* *"`proposal_superseded` — a newer proposal exists on this exception, or
     this one was already rejected. Deciding a stale proposal would approve
     something nobody is looking at."* Executed is folded in here: a decision
     on a proposal that already ran is equally stale. */
  if (row.superseded_by_proposal_id !== null || executed) {
    return refuse({ kind: 'proposal_superseded' })
  }
  const existing = await readDecisions(tx, proposalId)
  if (!existing.ok) return existing
  if (existing.value.records.some((d) => d.decision === 'rejected')) {
    return refuse({ kind: 'proposal_superseded' })
  }

  /* 🛑 FOUR EYES, AND IT IS A 403 RATHER THAN A 409 BECAUSE IT IS ABOUT THIS
     CALLER. The same predicate is a RESTRICTIVE policy on the row
     (`db/migrations/0059`), so a handler that lost this line still cannot
     write the decision — and `tests/db/resolution-chain.test.ts` §6 drives the
     violation past the handler into the database to prove both halves
     independently. Two places, one predicate, and a test in both directions is
     what makes it a MIRROR rather than a second vocabulary. */
  const proposedBy: ProposerRef =
    row.proposed_by_kind === 'user' && row.proposed_by_user_id !== null
      ? { kind: 'user', userId: row.proposed_by_user_id as UserId }
      : { kind: 'agent' }
  if (segregationViolated(gate, proposedBy, actor.userId)) {
    return refuse({ kind: 'segregation_violation' })
  }

  await tx.query(
    `INSERT INTO tenant.approval_decision
       (tenant_id, id, proposal_id, exception_id, decided_by, decision, reason,
        requested_at, decided_at)
     VALUES (nullif(current_setting('app.tenant_id', true), ''), $1, $2, $3, $4, $5, $6,
             $7::timestamptz, $8::timestamptz)`,
    [
      actor.decisionId,
      proposalId,
      row.exception_id,
      actor.userId as string,
      input.decision,
      input.reason ?? null,
      /* 🛑 THE MISSING `t0`, FILLED FROM THE PROPOSAL AND NOT FROM `now()`.
         `model/policy.ts`: *"an approval that was never notified has no row at
         all. A missing notification therefore stalls an approval permanently,
         with no clock and nothing to escalate."* The clock's zero is the
         moment approval became outstanding, which is the moment the proposal
         was made. `now()` here would make every decision instantaneous and the
         field decorative. */
      row.proposed_at.toISOString(),
      actor.now,
    ],
  )

  if (input.decision === 'rejected') {
    await tx.query('UPDATE tenant.exception SET status = $2 WHERE id = $1', [
      row.exception_id,
      'rejected',
    ])
  }

  /* 🛑 THE WHOLE PROPOSAL COMES BACK, WITH THE RECOMPUTED `execution.state`.
     The contract: *"so the caller sees the recomputed `execution.state` in the
     same round trip rather than assuming it."* A 200 on this operation is NOT
     "done" — `approved_pending_second_approver` is the state a client most
     often renders as a green tick. */
  return readProposal(tx, proposalId)
}

/* ==================================================================== *
 * §9  `executeProposal` — the act that closes the exception
 * ==================================================================== */

export async function executeProposalNow(
  tx: ScopedClient,
  proposalId: string,
  actor: { readonly userId: UserId; readonly now: Timestamp },
): Promise<ChainResult<Record<string, unknown>>> {
  const loaded = await loadProposal(tx, proposalId)
  if (!loaded.ok) return loaded
  const { row, facts, gate, executed } = loaded.value

  if (executed || facts.resolved) return refuse({ kind: 'exception_already_resolved' })
  if (row.superseded_by_proposal_id !== null) return refuse({ kind: 'proposal_superseded' })

  const shaped = await shapeProposal(tx, row, gate, facts, false)
  if (!shaped.ok) return shaped
  const verdict = shaped.value.verdict

  /* 🛑 THE CENTRAL CASE, AND IT IS A 409. *"The proposal is approved and the
     second approver required above the money threshold has not signed, or the
     quorum is unmet."* The caller holds `execute_resolution` — `decide()` said
     so — and the THING is not ready. */
  if (verdict.state !== APPROVAL_STATES.executable) {
    return refuse({ kind: 'not_executable', blockedBy: blockedCodes(verdict) })
  }

  const offered = await offeredFor(tx, facts)
  if (!offered.ok) return offered
  const chosen = offered.value.rows.find((r) => r.key === row.disposition_key)
  /* A disposition the pack has since withdrawn. The proposal is unexecutable
     rather than executable-with-unknown-terminality: `terminal` decides
     whether the exception closes, and guessing it would either close an
     exception that should route on, or leave one open that should have shut. */
  if (chosen === undefined) return refuse({ kind: 'disposition_not_offered' })

  /**
   * 🛑 THE MODE. `approved` when a signature exists, `manual` when the gate
   *    was not armed and the executor acted directly. `autonomous` IS
   *    UNREACHABLE and is not in `WritableResolutionMode` — nothing here is an
   *    agent and there is no policy evaluation, so a resolution claiming
   *    policy authority would name an authority that does not exist.
   */
  const mode: WritableResolutionMode = verdict.approvedBy.length > 0 ? 'approved' : 'manual'

  await tx.query(
    `UPDATE tenant.exception
        SET resolution_mode            = $2,
            resolution_disposition_key = $3,
            resolution_proposal_id     = $4,
            resolution_decided_by      = $5,
            resolution_executed_by     = $6,
            resolution_at              = $7::timestamptz,
            status                     = $8
      WHERE id = $1`,
    [
      facts.id,
      mode,
      row.disposition_key,
      row.id,
      /* `decidedBy` is the FIRST approver and is a lossy projection of
         `approvedBy` — the contract says so at the field now. Null under
         `manual`, where nobody approved. */
      verdict.approvedBy[0] ?? null,
      actor.userId as string,
      actor.now,
      /* 🛑 A NON-TERMINAL DISPOSITION DOES NOT CLOSE THE EXCEPTION. *"It routes
         to another procedure."* There is no procedure table, so it routes
         nowhere and the honest status is `investigating` — the exception is
         open and being worked. `resolved` would close a finding nothing
         finished. */
      chosen.terminal ? 'resolved' : 'investigating',
    ],
  )

  return yes({
    exceptionId: facts.id,
    resolution: {
      dispositionKey: row.disposition_key,
      proposalId: row.id,
      mode,
      authorisedByPolicyId: null,
      authorisedByPolicyVersion: null,
      decidedBy: verdict.approvedBy[0] ?? null,
      approvedBy: verdict.approvedBy,
      executedBy: actor.userId as string,
      at: actor.now,
    },
    closedException: chosen.terminal,
    /* ⚠️ ALWAYS NULL, AND IT IS A STATEMENT. *"The response says which, rather
       than leaving a client to infer closure from a status it did not get."*
       There is no `procedure` table, so a non-terminal disposition names no
       procedure — and `closedException: false` with a null route is the true
       pair rather than a contradiction. */
    routedToProcedureId: null,
  })
}

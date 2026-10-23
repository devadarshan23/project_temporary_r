/**
 * THE EXCEPTION REGISTER'S CLOSED VOCABULARIES, NARROWED AT THE READ BOUNDARY.
 * G357's other half, 19 Sep 2026.
 *
 * ┌─ THE HOLE THIS FILLS IS `engine-vocabulary.ts`'s HOLE, ONE SURFACE OVER ───┐
 * │ `db/migrations/0015_exception_register.sql` declines a CHECK constraint on │
 * │ every vocabulary column it creates, and gives `0002_run.sql`'s reason: a   │
 * │ third copy of a closed enum *"would be a third place to drift — and the    │
 * │ one nothing checks, because no pair in the wire-mirror addresses SQL."*    │
 * │                                                                            │
 * │ That leaves the same gap `run.status` and `cause_kind` left: NOTHING       │
 * │ stands between an unconstrained `text` column and the wire.                │
 * │ `fast-json-stringify` SERIALISES a response, it does not validate one, so  │
 * │ an out-of-enum `status` in the row is an out-of-enum `status` in the body  │
 * │ and the operator meets a word their own contract says cannot occur.        │
 * │                                                                            │
 * │ So the check goes where it can be DERIVED instead of copied: here, against │
 * │ the model. Every record below is keyed `Record<Union, true>`, so a member  │
 * │ added to a model union is a `TS2741` in this file rather than a list       │
 * │ somebody forgot.                                                           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ A TOTAL RECORD IS TOTAL, NOT EXACT. `engine-vocabulary.ts` records the
 *    same caveat and it transfers unchanged: a record here can GAIN a key the
 *    union does not have, because a computed key raises no excess-property
 *    error. What it cannot do is LOSE one, and that is the only direction that
 *    would let an unmodelled value onto the wire.
 *
 * 🛑 TWO VOCABULARIES ARE DELIBERATELY NOT DECLARED HERE, AND BOTH ABSENCES ARE
 *    THE POINT RATHER THAN A GAP.
 *
 *    `Severity` and `DomainKey` are the KEY SETS of `SEVERITIES` and
 *    `DOMAIN_KEYS`, total const objects `model/domain.ts` already constructs
 *    and already ships. Restating either would be a second copy of a list that
 *    exists (§5.3), so the guards below ask the model's own objects — the same
 *    treatment `engine-vocabulary.ts` gives `POSTCONDITION_PROPERTY`, and for
 *    the same stated reason. **Do not "fix" them into the pattern.**
 *
 * ⚠️ AND THE THIRD MEETING POINT NOTE APPLIES. `run-vocabulary.ts`'s opening
 *    claim — *"THE ONE PLACE `server/` MEETS `model/`"* — was already false
 *    before `engine-vocabulary.ts` existed; this file is the fourth, and the
 *    property that survives is the one that was always load-bearing: **a
 *    vocabulary is DERIVED from the model, never transcribed beside it.**
 *    Derive them: `grep -rl "from '\.\./\.\./model/" server/ | sort`
 */

import { DATA_CLASSES, DOMAIN_KEYS, SEVERITIES } from '../../model/domain.ts'
import type {
  DataClass,
  DomainKey,
  ExceptionStatus,
  ExtractedScalar,
  ReversalReason,
  Severity,
} from '../../model/domain.ts'

/**
 * `model/domain.ts`'s `ExceptionStatus`, a BARE union with no const object
 * beside it — so unlike `Severity` there is no existing list to ask, and this
 * record is the derivation rather than a copy of one.
 *
 * 🛑 THE SEVEN ARE NOT INTERCHANGEABLE AND THE ORDER IS NOT A LIFECYCLE. An
 *    exception can be `resolved` and then, after a reversal, `open` again —
 *    *"an exception can be resolved, reversed, re-resolved and reversed
 *    again"* — so nothing here may be read as a state machine. It is a
 *    membership test and nothing else.
 */
const EXCEPTION_STATUS: Readonly<Record<ExceptionStatus, true>> = {
  open: true,
  investigating: true,
  resolution_proposed: true,
  pending_approval: true,
  resolved: true,
  rejected: true,
  dismissed: true,
}

/**
 * 🛑 THE DISTINCTION INSIDE THIS VOCABULARY IS LOAD-BEARING AND THIS RECORD
 *    DOES NOT CARRY IT. `reversalIndictsAutonomy()` is the thing that reads a
 *    reason, and it lives in `model/domain.ts` as *"a function rather than a
 *    comment, because every call site that computes a reversal rate must agree
 *    — and one that quietly counts all reversals will drive autonomy to `none`
 *    across the fleet and look like evidence while doing it."*
 *
 *    This record answers ONLY "is this a member". A `Record<ReversalReason,
 *    boolean>` here carrying the indictment would be exactly the second call
 *    site that function exists to prevent. `server/data-plane/exception-store.ts`
 *    calls the model's function.
 */
const REVERSAL_REASON: Readonly<Record<ReversalReason, true>> = {
  wrong_disposition: true,
  insufficient_evidence: true,
  data_corrected: true,
  rule_wrong: true,
  downstream_rejected: true,
  undone_by_actor: true,
}

/**
 * `ExtractedScalar`'s six arms, keyed on the discriminator.
 *
 * ⚠️ NOT SHARED WITH `engine-vocabulary.ts`'s `isExtractedScalarKind`, AND THE
 *    DUPLICATION IS DELIBERATE RATHER THAN OVERLOOKED — but it is the ONE place
 *    this file repeats another. That module's record is keyed on the same union
 *    and importing it would be the right answer if the two surfaces could not
 *    diverge; they can, because the engine publishes a scalar inside a residue
 *    row and this publishes one inside an `ObservedValue`, and a future arm
 *    admitted on one wire and not the other is a real possibility the contract
 *    already contemplates elsewhere. **If that never happens, collapse them —
 *    but collapse them to the MODEL, not to whichever file is nearer.**
 */
const EXTRACTED_SCALAR_KIND: Readonly<Record<ExtractedScalar['kind'], true>> = {
  text: true,
  number: true,
  date: true,
  money: true,
  identifier: true,
  absent: true,
}

/**
 * `Delta`'s four arms. There is no `Delta` const object in the model and the
 * union is structural, so the key set is written here and checked by the type.
 */
const DELTA_KIND: Readonly<Record<'numeric' | 'money' | 'temporal' | 'textual', true>> = {
  numeric: true,
  money: true,
  temporal: true,
  textual: true,
}

/**
 * `ExceptionResolution`'s three arms, keyed on `mode`.
 *
 * ⚠️ THE MODEL'S UNION AND THE WIRE'S RECORD DISAGREE, AND THIS RECORD FOLLOWS
 *    THE MODE STRING THEY SHARE. `model/domain.ts` makes
 *    `{mode:'autonomous', authorisedByPolicyId: null}` UNREPRESENTABLE;
 *    `capability.openapi.yaml` flattens it and re-admits it. The divergence is
 *    recorded at length in `db/migrations/0015_exception_register.sql`'s header
 *    and is not resolved here — a narrowing that guessed which side was right
 *    would be the second vocabulary, not the fix.
 */
const RESOLUTION_MODE: Readonly<Record<'autonomous' | 'approved' | 'manual', true>> = {
  autonomous: true,
  approved: true,
  manual: true,
}

/**
 * ⚠️ `Object.hasOwn`, NEVER `in`, AND IT BINDS EVERY GUARD BELOW.
 * `'constructor' in RECORD` is `true`, so the obvious spelling admits every
 * name on `Object.prototype` — a membership test that answers yes for
 * `toString` is a membership test that lets a `toString` in a `status` column
 * onto the wire. Copied from `engine-vocabulary.ts` deliberately: it is the
 * same three-line function and the same trap.
 */
function member(table: Readonly<Record<string, unknown>>, value: string): boolean {
  return Object.hasOwn(table, value)
}

export function isExceptionStatus(v: string): v is ExceptionStatus {
  return member(EXCEPTION_STATUS, v)
}
export function isReversalReason(v: string): v is ReversalReason {
  return member(REVERSAL_REASON, v)
}
export function isObservedScalarKind(v: string): v is ExtractedScalar['kind'] {
  return member(EXTRACTED_SCALAR_KIND, v)
}
export function isDeltaKind(v: string): v is keyof typeof DELTA_KIND {
  return member(DELTA_KIND, v)
}
export function isResolutionMode(v: string): v is keyof typeof RESOLUTION_MODE {
  return member(RESOLUTION_MODE, v)
}

/**
 * 🛑 THE MODEL'S OWN CONST OBJECTS ARE THE VOCABULARY — see the header. Their
 * VALUES are the members (`DOMAIN_KEYS.creditUnderwriting` is
 * `'credit_underwriting'`), so these ask the value set rather than the key set,
 * which is the one difference from every guard above.
 */
const SEVERITY_VALUES: readonly string[] = Object.values(SEVERITIES)
const DOMAIN_VALUES: readonly string[] = Object.values(DOMAIN_KEYS)
const DATA_CLASS_VALUES: readonly string[] = Object.values(DATA_CLASSES)

export function isSeverity(v: string): v is Severity {
  return SEVERITY_VALUES.includes(v)
}
export function isDomainKey(v: string): v is DomainKey {
  return DOMAIN_VALUES.includes(v)
}
export function isDataClass(v: string): v is DataClass {
  return DATA_CLASS_VALUES.includes(v)
}

/**
 * THE FOUR ORDERINGS, AND THE SET IS CLOSED BECAUSE THE CONTRACT CLOSES IT.
 *
 * *"THE SORT SET IS CLOSED. Four orderings, each backed by a covering index. An
 * arbitrary `sort=<column>` parameter is how a queue acquires a sort nobody
 * indexed, and the first person to notice is the customer with the most
 * exceptions — which is the customer who matters most."*
 *
 * ⚠️ THIS IS THE ONE VOCABULARY IN THIS FILE THAT IS **NOT** DERIVED FROM
 *    `model/` AND IT CANNOT BE. A sort order is a property of a READ SURFACE;
 *    the model declares no such thing and should not. What checks it is the
 *    contract's own `enum`, through ajv, before a handler runs — so a value
 *    reaching `isExceptionSort()` has already been admitted once. The guard
 *    exists anyway, because the alternative is a `switch` with a `default` that
 *    silently picks an ordering nobody asked for, and a register showing the
 *    wrong page order looks exactly like a register showing the right one.
 *    `db/migrations/0015_exception_register.sql` names the index behind each.
 */
export const EXCEPTION_SORTS = {
  severityThenValue: 'severity_then_value',
  valueAtRiskDesc: 'value_at_risk_desc',
  raisedAtDesc: 'raised_at_desc',
  raisedAtAsc: 'raised_at_asc',
} as const
export type ExceptionSort = (typeof EXCEPTION_SORTS)[keyof typeof EXCEPTION_SORTS]

const EXCEPTION_SORT: Readonly<Record<ExceptionSort, true>> = {
  severity_then_value: true,
  value_at_risk_desc: true,
  raised_at_desc: true,
  raised_at_asc: true,
}

export function isExceptionSort(v: string): v is ExceptionSort {
  return member(EXCEPTION_SORT, v)
}

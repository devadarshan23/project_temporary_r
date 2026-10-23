/**
 * THE RESOLUTION CHAIN'S CLOSED VOCABULARIES, NARROWED AT THE READ BOUNDARY —
 * and the ONE map from the model's blockers to the wire's error codes.
 * G656–G660, 19 Sep 2026.
 *
 * ┌─ THE HOLE THIS FILLS IS `exception-vocabulary.ts`'s HOLE, ONE SURFACE OVER ┐
 * │ `db/migrations/0059_resolution_chain.sql` declines a CHECK constraint on   │
 * │ every vocabulary column it creates, and gives `0002_run.sql`'s reason: a   │
 * │ third copy of a closed enum *"would be a third place to drift — and the    │
 * │ one nothing checks, because no pair in the wire-mirror addresses SQL."*    │
 * │                                                                            │
 * │ `fast-json-stringify` SERIALISES a response; it does not VALIDATE one. So  │
 * │ an out-of-enum `family` in a `tenant.disposition` row is an out-of-enum    │
 * │ `family` in the body, and the operator meets a word their own contract     │
 * │ says cannot occur.                                                         │
 * │                                                                            │
 * │ So the check goes where it can be DERIVED instead of copied: here, against │
 * │ the model. Nothing below transcribes a list the model already ships.       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ AND THE MEETING-POINT NOTE APPLIES. `run-vocabulary.ts`'s opening claim —
 *    *"THE ONE PLACE `server/` MEETS `model/`"* — was already false before
 *    `engine-vocabulary.ts` existed, `exception-vocabulary.ts` was the fourth,
 *    and this is another. The property that survives is the one that was always
 *    load-bearing: **a vocabulary is DERIVED from the model, never transcribed
 *    beside it.** Derive them:
 *    `grep -rl "from '\.\./\.\./model/" server/ | sort`
 */

import {
  DISPOSITION_FAMILIES,
  RECONCILIATION_ARCHETYPES,
  REVERSIBILITY,
} from '../../model/domain.ts'
import { APPROVAL_BLOCKERS } from '../../model/approval.ts'
import type { ApprovalBlocker } from '../../model/approval.ts'
import type {
  DispositionFamily,
  EvidenceKind,
  ReconciliationArchetype,
  Reversibility,
} from '../../model/domain.ts'
import { CODES } from '../http/problem.ts'

/**
 * ⚠️ `Object.hasOwn`, NEVER `in`, AND IT BINDS EVERY GUARD BELOW.
 * `'constructor' in RECORD` is `true`, so the obvious spelling admits every
 * name on `Object.prototype`. Copied from `exception-vocabulary.ts`
 * deliberately: same three lines, same trap.
 */
function member(table: Readonly<Record<string, unknown>>, value: string): boolean {
  return Object.hasOwn(table, value)
}

/**
 * 🛑 THE MODEL'S OWN CONST OBJECTS ARE THE VOCABULARY, so these ask the VALUE
 * set rather than the key set — `RECONCILIATION_ARCHETYPES.setReconciliation`
 * is `'set_reconciliation'`. Same treatment `exception-vocabulary.ts` gives
 * `SEVERITIES` and `DOMAIN_KEYS`, and for the same stated reason: restating
 * either would be a second copy of a list that exists.
 */
const ARCHETYPE_VALUES: readonly string[] = Object.values(RECONCILIATION_ARCHETYPES)
const REVERSIBILITY_VALUES: readonly string[] = Object.values(REVERSIBILITY)

export function isReconciliationArchetype(v: string): v is ReconciliationArchetype {
  return ARCHETYPE_VALUES.includes(v)
}
export function isReversibility(v: string): v is Reversibility {
  return REVERSIBILITY_VALUES.includes(v)
}

/**
 * 🛑 THE FAMILY TEST IS SCOPED TO AN ARCHETYPE AND THAT IS THE WHOLE POINT OF
 *    IT. `DISPOSITION_FAMILIES` is keyed by archetype, and the model states
 *    why: *"Set reconciliation always yields timing differences and in-transit
 *    items; N-way match always yields quantity and price variance. The names
 *    are domain-flavoured, the families are structural. Put families on the
 *    domain and every new vertical reinvents them."*
 *
 *    **A pack parameterises WITHIN an archetype and can never extend it**, so
 *    a `tenant.disposition` row whose family is not on its definition's
 *    archetype is not a disposition this definition may offer — and it is
 *    FILTERED OUT of the published set rather than refused, because a pack
 *    legitimately ships dispositions for several archetypes and the rows are
 *    keyed by pack rather than by definition.
 *
 * ⚠️ THE FLAT MEMBERSHIP TEST IS **NOT** PROVIDED, DELIBERATELY. A
 *    `isDispositionFamily(v)` that asked "is this any archetype's family"
 *    would admit `quantity_variance` on a `set_reconciliation` definition —
 *    which is exactly the extension the model forbids, wearing a helper's
 *    name. If a caller needs one, it needs the archetype.
 */
export function archetypeAllowsFamily(
  archetype: ReconciliationArchetype,
  family: string,
): family is DispositionFamily {
  const families: readonly string[] = DISPOSITION_FAMILIES[archetype]
  return families.includes(family)
}

/**
 * `EvidenceKind`'s five arms.
 *
 * ⚠️ A BARE UNION WITH NO CONST OBJECT BESIDE IT IN `model/domain.ts`, so this
 *    record IS the derivation rather than a copy of one — `Record<EvidenceKind,
 *    true>` makes a sixth arm a `TS2741` here. Same shape
 *    `exception-vocabulary.ts` uses for `ExceptionStatus`, and for the same
 *    reason.
 */
const EVIDENCE_KIND: Readonly<Record<EvidenceKind, true>> = {
  document: true,
  correspondence: true,
  system_record: true,
  attestation: true,
  free_text: true,
}
export function isEvidenceKind(v: string): v is EvidenceKind {
  return member(EVIDENCE_KIND, v)
}

/**
 * `ApprovalDecision.decision`'s two arms, and `ProposalActor.kind`'s two.
 *
 * ⚠️ NEITHER IS A NAMED TYPE IN `model/` — both are inline unions on their
 *    interfaces — so these records are written against the field's type by
 *    `Record<…, true>` and a third arm on either is a compile error here.
 */
const APPROVAL_DECISION: Readonly<Record<'approved' | 'rejected', true>> = {
  approved: true,
  rejected: true,
}
export function isApprovalDecision(v: string): v is 'approved' | 'rejected' {
  return member(APPROVAL_DECISION, v)
}

const PROPOSAL_ACTOR_KIND: Readonly<Record<'user' | 'agent', true>> = {
  user: true,
  agent: true,
}
export function isProposalActorKind(v: string): v is 'user' | 'agent' {
  return member(PROPOSAL_ACTOR_KIND, v)
}

/**
 * `ExceptionResolution.mode`'s three arms.
 *
 * ⚠️ DELIBERATELY NOT IMPORTED FROM `exception-vocabulary.ts`, WHICH DECLARES
 *    THE SAME THREE. That module's `isResolutionMode` is a READ-boundary guard
 *    over a stored column; this is a WRITE-side list of the modes this plane
 *    can PRODUCE, and the two differ today: `autonomous` is readable and is
 *    not writable, because nothing here is an agent and there is no policy
 *    evaluation. Collapsing them would erase that difference and let a future
 *    writer mint an arm no reader can explain.
 */
export const WRITABLE_RESOLUTION_MODES: Readonly<Record<'approved' | 'manual', true>> = {
  approved: true,
  manual: true,
}
export type WritableResolutionMode = keyof typeof WRITABLE_RESOLUTION_MODES

/**
 * 🛑 THE ONE MAP FROM THE MODEL'S BLOCKERS TO THE WIRE'S `ErrorCode`, AND IT IS
 *    TOTAL SO A BLOCKER ADDED IN `model/approval.ts` IS A COMPILE ERROR HERE
 *    RATHER THAN A CODE NOBODY PUBLISHES.
 *
 * `model/approval.ts` states why the blockers are not error codes in the first
 * place: *"`errors.yaml`'s enum is a WIRE vocabulary; importing it into
 * `model/` would make the domain model depend on a contract file, which is the
 * dependency this repository runs the other way round."* This is the join, in
 * the layer that already reads both.
 *
 * ⚠️ `quorum_unmet` MAPS TO `approval_quorum_unmet` AND NOT TO
 *    `approval_second_approver_required`, EVEN THOUGH THE STATE IS CALLED
 *    `approved_pending_second_approver`. The two codes mean different gates:
 *    the second-approver one belongs to `ProcedureStep.secondApproverAbove`,
 *    which has NO PRODUCER here (there is no procedure table), and publishing
 *    it would tell an operator to satisfy a gate this deployment does not
 *    have. `db/migrations/0059_resolution_chain.sql` §3 refuses the same
 *    conflation for `secondApproverAbove` itself.
 */
export const BLOCKER_CODE: Readonly<Record<ApprovalBlocker, string>> = {
  [APPROVAL_BLOCKERS.quorumUnmet]: CODES.approvalQuorumUnmet,
  [APPROVAL_BLOCKERS.rejected]: CODES.proposalNotExecutable,
  [APPROVAL_BLOCKERS.superseded]: CODES.proposalSuperseded,
  [APPROVAL_BLOCKERS.exceptionResolved]: CODES.exceptionAlreadyResolved,
}

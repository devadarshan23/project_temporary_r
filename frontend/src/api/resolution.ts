/**
 * C4 AND C5 — PROPOSING, APPROVING AND POSTING A RESOLUTION (3 Oct 2026).
 *
 * Six operations the data plane has served since the resolution chain landed
 * and no screen consumed: `listAvailableDispositions`, `listProposals`,
 * `getProposal`, `proposeResolution`, `decideApproval`, `executeProposal`.
 *
 * 🛑 THE CHECKS REFUSE; THEY NEVER REPAIR — `exceptions.ts`'s rule. A proposal
 * with no `execution` block is refused rather than drawn as "awaiting
 * approval", because `execution.state` is the ONE field the contract says to
 * read first, and a defaulted one would draw a green tick over a proposal
 * nobody authorised.
 *
 * ⚠️ FOUR EYES IS THE PLANE'S, NEVER THIS CLIENT'S. The screens hide the
 * approve control from the proposer of record because the pack draws it so,
 * but the refusal that matters is `approval_segregation_violation` from the
 * plane, and a client that skipped the request would not make it any weaker.
 */

import { call, type Money } from './exceptions.ts'
import { planeEndpoint, type Read } from './runs.ts'
import type { ProposalState } from '../words.ts'

export interface AvailableDisposition {
  readonly key: string
  readonly label: string
  readonly family: string
  readonly reversibility: string
  readonly terminal: boolean
  readonly requiresAdjustment: boolean
  readonly available: boolean
  readonly unavailableFor?: string | null
}

export interface DispositionSet {
  readonly archetype: string
  readonly packKey: string | null
  readonly dispositions: readonly AvailableDisposition[]
}

export interface ApprovalDecisionRecord {
  readonly decidedBy: string
  /** C3-05 / G3886 — the approver's display name: `null` when the plane may not name them (`0520`). */
  readonly decidedByName: string | null
  /** G4021 — true iff the approver is a former member (their membership lapsed); never a name. */
  readonly decidedByFormerMember: boolean
  readonly decision: 'approved' | 'rejected'
  readonly reason?: string | null
  readonly decidedAt: string
}

export interface ProposalExecution {
  readonly state: ProposalState
  readonly approvals: readonly ApprovalDecisionRecord[]
  readonly requiredApprovals: {
    readonly quorum: number
    readonly secondApproverAbove?: Money | null
    readonly segregationOfDuties: boolean
    readonly mandatoryAtOrAbove: string | null
  }
  readonly blockedBy: readonly string[]
}

export interface Proposal {
  readonly proposalId: string
  readonly exceptionId: string
  readonly proposedBy: {
    readonly kind: 'user' | 'agent'
    readonly userId?: string | null
    /** C3-05 / G3886 — the proposer's display name (a `user` actor): `null` when the plane may not name them. */
    readonly displayName?: string | null
    /** G4021 — true iff the proposer is a former member (a `user` actor). */
    readonly formerMember?: boolean
  }
  readonly dispositionKey: string
  readonly dispositionLabel?: string
  readonly rationale: string
  readonly evidence: readonly { readonly kind: string; readonly ref: string; readonly note?: string | null }[]
  readonly adjustment?: Money | null
  readonly proposedAt: string
  readonly supersededByProposalId?: string | null
  readonly execution: ProposalExecution
}

export interface ExecutionResult {
  readonly exceptionId: string
  readonly resolution: {
    readonly dispositionKey: string
    readonly proposalId: string
    readonly mode: string
    readonly approvedBy?: readonly string[]
    readonly executedBy?: string | null
    readonly at: string
  }
  readonly routedToProcedureId?: string | null
  readonly closedException: boolean
}

const STATES: readonly ProposalState[] = [
  'not_approved',
  'rejected',
  'approved_pending_second_approver',
  'executable',
  'executed',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** One `Proposal`, or a refusal naming what was missing. Exported for the suite. */
export function asProposal(body: unknown, op: string): Proposal {
  if (!isRecord(body) || typeof body['proposalId'] !== 'string' || typeof body['exceptionId'] !== 'string') {
    throw new Error(`\`${op}\` did not answer with a \`Proposal\``)
  }
  const execution = body['execution']
  if (
    !isRecord(execution) ||
    typeof execution['state'] !== 'string' ||
    !(STATES as readonly string[]).includes(execution['state']) ||
    !Array.isArray(execution['approvals']) ||
    !Array.isArray(execution['blockedBy']) ||
    !isRecord(execution['requiredApprovals'])
  ) {
    throw new Error(
      `\`${op}\` answered a proposal without a readable \`execution\` block. It is required, ` +
        'and "approved" and "executable" are different facts this screen will not guess between.',
    )
  }
  if (typeof body['dispositionKey'] !== 'string' || typeof body['rationale'] !== 'string') {
    throw new Error(`\`${op}\` answered a proposal without its disposition or rationale`)
  }
  return body as unknown as Proposal
}

/* ⚠️ NO `Idempotency-Key` IS SENT. The plane accepts the header and does not
   honour it yet, so a key here would claim a retry-safety nobody provides; a
   double press is refused by the screens instead (`aria-disabled` while a
   write is in flight). */

export async function fetchDispositions(
  o: Read & { readonly exceptionId: string },
): Promise<DispositionSet> {
  const url = planeEndpoint(o.origin, `/exceptions/${encodeURIComponent(o.exceptionId)}/dispositions`)
  const body = await call(url, { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['dispositions']) || typeof body['archetype'] !== 'string') {
    throw new Error('`listAvailableDispositions` did not answer with the closed set')
  }
  return body as unknown as DispositionSet
}

export async function fetchProposals(
  o: Read & { readonly exceptionId: string },
): Promise<readonly Proposal[]> {
  const url = planeEndpoint(o.origin, `/exceptions/${encodeURIComponent(o.exceptionId)}/proposals`)
  const body = await call(url, { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body['items'])) {
    throw new Error('`listProposals` answered without an `items` array')
  }
  return body['items'].map((p) => asProposal(p, 'listProposals'))
}

export async function fetchProposal(o: Read & { readonly proposalId: string }): Promise<Proposal> {
  const url = planeEndpoint(o.origin, `/proposals/${encodeURIComponent(o.proposalId)}`)
  return asProposal(await call(url, { method: 'GET' }), 'getProposal')
}

export async function proposeResolution(
  o: Read & {
    readonly exceptionId: string
    readonly dispositionKey: string
    readonly rationale: string
    readonly adjustment?: Money | null
  },
): Promise<Proposal> {
  const url = planeEndpoint(o.origin, `/exceptions/${encodeURIComponent(o.exceptionId)}/proposals`)
  const body = {
    dispositionKey: o.dispositionKey,
    rationale: o.rationale,
    evidence: [],
    ...(o.adjustment === undefined ? {} : { adjustment: o.adjustment }),
  }
  return asProposal(
    await call(url, { method: 'POST', body }),
    'proposeResolution',
  )
}

export async function decideApproval(
  o: Read & {
    readonly proposalId: string
    readonly decision: 'approved' | 'rejected'
    readonly reason?: string | null
  },
): Promise<Proposal> {
  const url = planeEndpoint(o.origin, `/proposals/${encodeURIComponent(o.proposalId)}/approvals`)
  const body = { decision: o.decision, ...(o.reason === undefined ? {} : { reason: o.reason }) }
  return asProposal(await call(url, { method: 'POST', body }), 'decideApproval')
}

export async function executeProposal(o: Read & { readonly proposalId: string }): Promise<ExecutionResult> {
  const url = planeEndpoint(o.origin, `/proposals/${encodeURIComponent(o.proposalId)}/execution`)
  const body = await call(url, { method: 'POST' })
  if (!isRecord(body) || !isRecord(body['resolution']) || typeof body['closedException'] !== 'boolean') {
    throw new Error('`executeProposal` did not answer with an `ExecutionResult`')
  }
  return body as unknown as ExecutionResult
}

/** The proposal this exception is currently judged by: the newest not superseded. */
export function currentProposal(items: readonly Proposal[]): Proposal | null {
  return items.find((p) => (p.supersededByProposalId ?? null) === null) ?? null
}

/**
 * `reverseResolution` — G3641, 3 Oct 2026. The contract's closed reason
 * vocabulary (`ReversalReason`), in the contract's order. The reason is
 * LOAD-BEARING: `wrong_disposition` and `insufficient_evidence` count against
 * the autonomy that produced the resolution; the other three do not.
 */
export const REVERSAL_REASONS = [
  'wrong_disposition',
  'insufficient_evidence',
  'data_corrected',
  'rule_wrong',
  'downstream_rejected',
  /* G3811 — the owner's C3-12 ruling. Undo sends it (`UNDO_ACCEPT_REASON`,
     G3883); Reopen never offers it (`REOPEN_REASONS`, below). */
  'undone_by_actor',
] as const
export type ReversalReason = (typeof REVERSAL_REASONS)[number]

/**
 * G3883 — THE REASONS REOPEN OFFERS: every reason but `undone_by_actor`. That
 * one is the actor's own Undo, sent by the register's Undo control alone; a
 * person reopening a line from the dialog is correcting a resolution, and
 * letting them pick *"I undid my own action"* there would launder a correction
 * past the reversal rate the owner's C3-12 ruling keeps it out of.
 */
export const REOPEN_REASONS: readonly Exclude<ReversalReason, 'undone_by_actor'>[] = REVERSAL_REASONS.filter(
  (r): r is Exclude<ReversalReason, 'undone_by_actor'> => r !== 'undone_by_actor',
)

/** What the plane answered for the line it reopened — only what the register merges. */
export interface ReversedException {
  readonly exceptionId: string
  readonly status: string
  readonly assignedTo: string | null
}

export async function reverseResolution(
  o: Read & { readonly exceptionId: string; readonly reason: ReversalReason },
): Promise<ReversedException> {
  const url = planeEndpoint(o.origin, `/exceptions/${encodeURIComponent(o.exceptionId)}/reversals`)
  /* 🛑 `newStatus` IS `open` AND NEVER CHOSEN HERE: Reopen means back to the
     register's open work — the contract's own *"Usually back to `open`"*.
     `correctedDispositionKey` is not sent: a correction is a new proposal. */
  const answer = await call(url, { method: 'POST', body: { reason: o.reason, newStatus: 'open' } })
  if (!isRecord(answer) || typeof answer['exceptionId'] !== 'string' || typeof answer['status'] !== 'string') {
    throw new Error('`reverseResolution` did not answer with an `Exception`')
  }
  return {
    exceptionId: answer['exceptionId'],
    status: answer['status'],
    assignedTo: typeof answer['assignedTo'] === 'string' ? answer['assignedTo'] : null,
  }
}

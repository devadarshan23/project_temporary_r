/**
 * WHAT A VIEWER MAY DO WITH A PROPOSAL, AND THE SMALL PURE HELPERS THE
 * SECONDARY SURFACES SHARE (C4, C5, RC-09 — 3 Oct 2026).
 *
 * Pure, `.ts`, and free of React, so `node --test` witnesses it with no build
 * and no browser — the same reason `routes/screens.ts` is written in
 * `createElement`.
 *
 * 🛑 FOUR EYES IS DRAWN HERE AND ENFORCED BY THE PLANE. `actsFor()` hides
 * Approve and Refuse from the proposer of record because the pack draws them
 * absent — *"Posting and refusing are both absent here"* — and the refusal
 * that makes it true is `approval_segregation_violation`, which the plane
 * answers whatever this function says.
 */

import type { Money } from './api/exceptions.ts'
import type { Proposal } from './api/resolution.ts'
import { PlaneRefused } from './api/runs.ts'
import { RESOLUTION_CODE_WORD } from './words.ts'

/**
 * The sentence a person reads when a write was refused. The plane's closed
 * `code`, put into words — NEVER its `detail`, which `errors.yaml` forbids a
 * client to put in front of a person.
 */
export function refusalText(err: unknown): string {
  if (err instanceof PlaneRefused) {
    if (err.status === 401) return 'Your session has ended. Sign in again to continue.'
    const word = err.code === undefined ? undefined : RESOLUTION_CODE_WORD[err.code]
    if (word !== undefined) return `${word}.`
    if (err.status === 403) return 'Your role cannot do this.'
    if (err.status === 404) return 'You cannot see this any more.'
    if (err.status >= 500) return 'Something failed on our side. Nothing was written — try again in a moment.'
  }
  return 'That did not go through. Nothing was written — try again in a moment.'
}

/**
 * G3441 (reaudit NC-01) — THE PLANE SAYS RESOLUTIONS ARE NOT SET UP for this
 * tenant or this reconciliation: no approval policy, or no resolution set. It
 * is a 409 `resolution_not_configured` and it is PERMANENT until somebody
 * configures it, so a surface draws a calm stated state — and never the
 * "try again" sentence `refusalText()` gives a 5xx. Before G3441 the plane
 * answered this as a 500 and every surface told the reader to retry.
 */
export function isResolutionNotConfigured(err: unknown): boolean {
  return err instanceof PlaneRefused && err.code === 'resolution_not_configured'
}

/** The sentence for it — the same words `refusalText()` gives the code. */
export const NOT_CONFIGURED_TEXT =
  'Resolutions are not set up for this reconciliation yet — your administrator configures approvals.'

export interface ProposalActs {
  /** The viewer proposed this, and the tenant separates proposing from approving. */
  readonly isProposerOfRecord: boolean
  /** Approve / Refuse are drawn. */
  readonly mayDecide: boolean
  /** The viewer already approved — a second approval by the same person does not count. */
  readonly alreadyDecided: boolean
  /** Post it is drawn: the plane says the proposal is executable. */
  readonly mayPost: boolean
  /** Nothing further can happen to it: posted, refused or superseded. */
  readonly settled: boolean
}

export function proposerOf(p: Proposal): string | null {
  return p.proposedBy.kind === 'user' ? p.proposedBy.userId ?? null : null
}

/**
 * WHAT THE SESSION'S ROLE LETS IT DO WITH A PROPOSAL — C3-03 (G3836, 4 Oct
 * 2026, DERIVED). `actsFor()` decided Approve, Refuse and Post it from the
 * proposal's state and the viewer's id alone, so the assurance reader, the
 * operator and both approvers were offered Post it, and the viewer was offered
 * Approve — each answered by the plane with a 403 the reader then had to read.
 * G3193 (the owner's): a refused control is HIDDEN. The plane still gates every
 * act; this only decides what is drawn (`capabilities.ts`).
 */
export interface ProposalMay {
  /** The session holds `approve_resolution`. */
  readonly decide: boolean
  /** The session holds `execute_resolution`. */
  readonly post: boolean
}

export function actsFor(p: Proposal, viewer: string | null, may: ProposalMay): ProposalActs {
  const superseded = (p.supersededByProposalId ?? null) !== null
  const state = p.execution.state
  const settled = superseded || state === 'executed' || state === 'rejected'
  const isProposerOfRecord =
    viewer !== null && proposerOf(p) === viewer && p.execution.requiredApprovals.segregationOfDuties
  const alreadyDecided = viewer !== null && p.execution.approvals.some((a) => a.decidedBy === viewer)
  const awaiting = state === 'not_approved' || state === 'approved_pending_second_approver'
  return {
    isProposerOfRecord,
    /* ⚠️ NOT WHILE THE VIEWER IS UNKNOWN: `getSessionPrincipal` lands a beat
       after the proposal, and drawing Approve before it would offer the
       proposer of record his own decision for that beat. */
    mayDecide: may.decide && viewer !== null && !settled && awaiting && !isProposerOfRecord && !alreadyDecided,
    alreadyDecided,
    mayPost: may.post && !settled && state === 'executable',
    settled,
  }
}

/**
 * C3-08 / C3-26 — DOES THIS PROPOSAL WAIT ON THIS READER'S APPROVAL? The
 * Approvals queue lists exactly these (the owner's ruling: *"every waiting
 * proposal the reader may approve"*): awaiting a decision, not the reader's
 * own under segregation, and not already decided by them. An `executable`
 * proposal waits on a poster, not an approver, and is not one of them.
 */
export function waitsOnApprovalOf(p: Proposal, viewer: string | null): boolean {
  return actsFor(p, viewer, { decide: true, post: false }).mayDecide
}

/**
 * C3-04 (G3837, DERIVED) — DOES THIS PROPOSAL NEED AN APPROVER AT ALL?
 *
 * `model/approval.ts`'s `approvalState()` answers `executable` with NO approvals
 * when `approvalRequiredFor()` says the line is below the policy's severity and
 * value thresholds; above them, `executable` needs `quorum` distinct approvers.
 * The wire does not publish `approvalRequired` (`ProposalExecution` has no such
 * field), so it is READ OFF THE STATE THE PLANE COMPUTED: an `executable` or
 * `executed` proposal with fewer distinct approvers than the quorum was not
 * required to have any. Every other state is the plane saying an approval is
 * owed.
 *
 * ⚠️ Before this, every surface around a below-threshold proposal said four
 * eyes were pending — *"Approvals 0 of 2"*, *"2 more approvers are needed"*,
 * *"it waits on an approver"* — on a line the proposer then posted alone.
 */
export function approvalNeeded(p: Proposal): boolean {
  const state = p.execution.state
  if (state !== 'executable' && state !== 'executed') return true
  return approvalsCounted(p).have >= Math.max(1, p.execution.requiredApprovals.quorum)
}

/** The sentence a successful propose says — read off the proposal the plane answered. */
export function proposedSentenceOf(p: Proposal, mayPost: boolean): string {
  if (!approvalNeeded(p)) {
    return mayPost
      ? 'Proposed. No approval is needed for this line — post it when you are ready.'
      : 'Proposed. No approval is needed for this line; someone whose role posts resolutions posts it.'
  }
  return p.execution.requiredApprovals.segregationOfDuties
    ? 'Proposed. Nothing is posted yet — it waits on an approver, and you cannot approve your own proposal.'
    : 'Proposed. Nothing is posted yet — it waits on an approver.'
}

/**
 * C3-05 (G3838, DERIVED) — A PERSON IS NAMED, NEVER SHOWN BY ID. The reader is
 * "you"; anyone else is the name the plane serves for them, or the neutral
 * word "a colleague" when it serves none. A raw `usr_…` id is never the text.
 *
 * G4021 (DERIVED) — AND "a former member" WHEN THE PLANE SAYS THEY ARE ONE. The
 * owner's C3-05 ruling names LIVE co-members only, so a lapsed approver or
 * assignee is unnamed — and "a colleague" for them asserts a membership the
 * plane knows has ended. `formerMember` is the plane's own fact
 * (`server/data-plane/former-member.ts`), never inferred from a missing name.
 */
export function personWord(
  userId: string | null | undefined,
  viewer: string | null,
  name?: string | null,
  formerMember?: boolean,
): string {
  if (userId !== null && userId !== undefined && viewer !== null && userId === viewer) return 'you'
  const n = name?.trim()
  if (n !== undefined && n !== '') return n
  return formerMember === true ? 'a former member' : 'a colleague'
}

/** How many distinct people have approved, against how many the policy needs. */
export function approvalsCounted(p: Proposal): { readonly have: number; readonly need: number } {
  const approvers = new Set(p.execution.approvals.filter((a) => a.decision === 'approved').map((a) => a.decidedBy))
  return { have: approvers.size, need: Math.max(1, p.execution.requiredApprovals.quorum) }
}

/**
 * A decimal a person typed, as `Money` in the exception's own currency and
 * exponent — or `null` when it is not a figure. It never rounds: a figure with
 * more decimals than the currency carries is refused, not truncated.
 */
export function adjustmentFrom(text: string, currency: string, exponent: number): Money | null {
  const t = text.trim().replace(/,/g, '')
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(t)
  if (m === null) return null
  const [, sign = '', whole = '0', frac = ''] = m
  if (frac.length > exponent) return null
  const minor = `${whole}${frac.padEnd(exponent, '0')}`.replace(/^0+(?=\d)/, '')
  return { currency, exponent, amountMinor: `${sign}${minor}` }
}

/** One page of a long list, and where it sits — "Count what you know". */
export interface Paged<T> {
  readonly rows: readonly T[]
  readonly page: number
  readonly pages: number
  readonly first: number
  readonly last: number
  readonly total: number
}

export function pageOf<T>(all: readonly T[], page: number, size: number): Paged<T> {
  const total = all.length
  const pages = Math.max(1, Math.ceil(total / size))
  const p = Math.min(Math.max(0, page), pages - 1)
  const start = p * size
  const rows = all.slice(start, start + size)
  return { rows, page: p, pages, first: total === 0 ? 0 : start + 1, last: start + rows.length, total }
}

import type { NextAct } from './close-state.ts'
import type { DispositionSet, Proposal, ReversalReason } from './api/resolution.ts'
import { PlaneRefused } from './api/runs.ts'
import { NOT_CONFIGURED_TEXT, refusalText } from './resolve-logic.ts'

/**
 * THE REGISTER'S NEXT ACTS, MADE REAL — feat/register-next-acts, G3641–G3650,
 * 3 Oct 2026 (DERIVED, NOT THE OWNER'S). `docs/HANDOFF.md` §0a's third thing
 * to do next: *"Wire the register's next acts. Accept → `proposeResolution` /
 * `executeProposal`, and Reopen → `reverseResolution`."*
 *
 * Plain TypeScript and no JSX, so `tests/app/register-acts.test.ts` runs every
 * decision here under `node --test` with no renderer — `close-state.ts`'s
 * reason for existing, one module over. Nothing here draws or fetches.
 *
 * 🛑 THE PLANE DECIDES; THIS MODULE ONLY READS WHAT IT ANSWERED. Whether a
 * proposal may post is `execution.state`, which the plane computes with
 * `model/approval.ts`'s evaluator — never this client's arithmetic over quorum
 * and value. Four eyes, segregation and the reversal window are the plane's
 * refusals, and a 409 is a STATE told calmly, never an error.
 */

/**
 * WHICH ACT THE ROW DRAWS — the next act by status (`nextActOf`), narrowed by
 * what the session may do (G3193: a control the role may not use is HIDDEN,
 * not drawn and refused). An act the role cannot take falls back to View —
 * C1's own act where the decision is not the reader's (NC-05) — rather than
 * leaving an empty cell.
 *
 *   accept  needs `propose_resolution`. Posting needs `execute_resolution`
 *           too, but a proposer without it can still accept: the line then
 *           waits on whoever can post (`acceptOutcomeOf`).
 *   reopen  needs `reverse_resolution` — `reverseResolution`'s own
 *           `x-capability`, which is what the plane gates on.
 */
export function drawnActOf(
  act: NextAct,
  may: { readonly propose: boolean; readonly reverse: boolean },
  /**
   * C3-11 (G3851) — the resolution was posted inside the plane's reversal
   * window. Reopen was drawn on a line resolved weeks earlier; the dialog took
   * a reason and then answered `reversal_window_expired`. An unknown posting
   * time is NOT in the window (`capabilities.ts`'s rule: unread is not held).
   */
  reopenInWindow: boolean,
): NextAct {
  if (act === 'accept') return may.propose ? 'accept' : 'view'
  if (act === 'reopen') return may.reverse && reopenInWindow ? 'reopen' : 'view'
  return act
}

/** The plane's reversal window — *"reversible for 24 hours from the post"*. */
export const REVERSAL_WINDOW_MS = 24 * 60 * 60 * 1000

/** Whether a resolution posted at `resolvedAt` may still be reopened at `now`. */
export function reopenWindowOpen(resolvedAt: string | null | undefined, now: Date): boolean {
  if (resolvedAt === null || resolvedAt === undefined) return false
  const at = Date.parse(resolvedAt)
  if (Number.isNaN(at)) return false
  return now.getTime() - at < REVERSAL_WINDOW_MS
}

/**
 * WHICH DISPOSITION "ACCEPT" COMMITS FROM THE ROW.
 *
 * ⚠️ THE PLANE SERVES NO "DEFAULT" DISPOSITION (G3643). `listAvailableDispositions`
 * answers the closed set ordered `family, key` with availability per entry,
 * and nothing in it — no flag, no rank — says which one the pack means by
 * default. Picking "the first" would let the alphabet choose a judgement
 * the product exists to make deliberately, so the row commits only where the
 * choice is UNAMBIGUOUS, which is the pack's own rule for the row:
 * *"Where the act is unambiguous it commits from here; where it needs evidence
 * or a choice, the row control opens the panel already on the right step."*
 *
 *   one     exactly ONE disposition is available, it needs no adjustment, AND
 *           IT CLOSES THE LINE (`terminal`) — Accept commits it from the row;
 *   choose  more than one is available, or the one needs an adjustment amount,
 *           or it does NOT close the line — Accept goes to the finding, where
 *           C4's panel offers the choice;
 *
 * 🛑 TERMINAL ONLY — THE OWNER'S RULING ON C3-10, 4 Oct 2026: *"Terminal only:
 * register Accept only for dispositions that close the line; others open the
 * finding."* A non-terminal disposition (e.g. *Carry as a timing difference*)
 * posted from the row, the toast said "Accepted and posted", the line went to
 * Investigating and still offered Accept — which then answered "Nothing
 * changed". G3849.
 *   none    nothing is available to this reader on this line.
 */
export type RowDisposition =
  | { readonly kind: 'one'; readonly key: string; readonly label: string }
  | { readonly kind: 'choose' }
  | { readonly kind: 'none' }

export function rowDispositionOf(set: DispositionSet): RowDisposition {
  const available = set.dispositions.filter((d) => d.available)
  if (available.length === 0) return { kind: 'none' }
  const only = available[0]
  if (available.length === 1 && only !== undefined && !only.requiresAdjustment && only.terminal) {
    return { kind: 'one', key: only.key, label: only.label }
  }
  return { kind: 'choose' }
}

/**
 * C3-21 (G3850) — WHAT THE READER IS TOLD WHEN ACCEPT OPENS THE FINDING. The
 * row's Accept used to navigate silently, so the act the reader pressed did
 * not happen and nothing said why.
 */
export const TO_FINDING_NOTICE = {
  title: 'Choose how to resolve this line.',
  body: 'It has more than one resolution, or one that does not close the line, so the choice is made on the finding.',
} as const

/** The rationale a row-level Accept records. A person wrote none; it says so. */
export function acceptRationaleOf(label: string): string {
  return `Accepted from the register: ${label}.`
}

/**
 * WHAT HAPPENS AFTER THE PROPOSAL LANDS — read off the plane's answer.
 *
 *   post     `execution.state` is `executable` and the reader holds
 *            `execute_resolution`: no further approval is required, so the
 *            row posts it (`executeProposal`).
 *   waiting  anything else: an approval is required (four eyes, a quorum, a
 *            value above a threshold) or the reader cannot post. The line
 *            waits in Approvals.
 */
export type AcceptOutcome = 'post' | 'waiting'
export function acceptOutcomeOf(proposal: Proposal, mayExecute: boolean): AcceptOutcome {
  return proposal.execution.state === 'executable' && mayExecute ? 'post' : 'waiting'
}

/** The sentence the waiting notice says — why it waits, in the plane's terms. */
export function waitingSentenceOf(proposal: Proposal, mayExecute: boolean): string {
  if (proposal.execution.state === 'executable') {
    return mayExecute
      ? 'It is ready to post.'
      : 'It is ready to post — someone whose role posts resolutions has to post it.'
  }
  if (proposal.execution.requiredApprovals.segregationOfDuties) {
    return 'It waits in Approvals. Segregation of duties is on, so someone other than you approves it.'
  }
  return 'It waits in Approvals until an approver acts.'
}

/**
 * HOW A REFUSED ACT IS TOLD — G3645.
 *
 *   state           a 409 the contract names as a condition of the THING,
 *                   not of the caller: already resolved, superseded, not
 *                   executable yet, segregation, nothing to reverse, the
 *                   window closed. Said calmly, as a fact about the line.
 *   not-configured  `resolution_not_configured` (G3441) — permanent until an
 *                   administrator configures approvals. Never "try again".
 *   fail            everything else — `refusalText()`'s sentence.
 */
export type ActRefusal =
  | { readonly kind: 'state'; readonly text: string }
  | { readonly kind: 'not-configured'; readonly text: string }
  | { readonly kind: 'fail'; readonly text: string }

const STATE_SENTENCE: Readonly<Record<string, string>> = {
  exception_already_resolved: 'This line is already resolved — reopen it first to change the resolution.',
  proposal_superseded: 'A newer proposal replaced this one. Open the finding to see it.',
  proposal_not_executable: 'The proposal is recorded and is not ready to post yet. It waits in Approvals.',
  approval_segregation_violation: 'The person who proposed this cannot approve it. Another approver has to act.',
  approval_quorum_unmet: 'More approvers are needed before it posts. It waits in Approvals.',
  approval_second_approver_required: 'A second approver is needed above this value. It waits in Approvals.',
  policy_requires_approval: 'Policy requires an approval first. It waits in Approvals.',
  reversal_window_expired:
    'This resolution can no longer be reopened — it is reversible for 24 hours from the post. A correction now is a new entry with its own approval.',
  validation_failed: 'This line holds no resolution to reopen.',
}

export function actRefusalOf(err: unknown): ActRefusal {
  if (err instanceof PlaneRefused && err.code === 'resolution_not_configured') {
    return { kind: 'not-configured', text: NOT_CONFIGURED_TEXT }
  }
  if (err instanceof PlaneRefused && err.status === 409 && err.code !== undefined) {
    const text = STATE_SENTENCE[err.code]
    if (text !== undefined) return { kind: 'state', text }
  }
  return { kind: 'fail', text: refusalText(err) }
}

/**
 * THE PACK'S REASON VOCABULARY, IN WORDS — total over `ReversalReason`, so a
 * sixth reason in the contract is a compile error here rather than a radio
 * with no label. The `indicts` flag is the contract's load-bearing split, said
 * to the person choosing so the choice is informed rather than incidental.
 */
export const REVERSAL_REASON_WORD: Readonly<Record<ReversalReason, { readonly label: string; readonly indicts: boolean }>> = {
  wrong_disposition: { label: 'The wrong resolution was chosen', indicts: true },
  insufficient_evidence: { label: 'The evidence did not support it', indicts: true },
  data_corrected: { label: 'The underlying data was corrected afterwards', indicts: false },
  rule_wrong: { label: 'The matching rule was wrong', indicts: false },
  downstream_rejected: { label: 'A downstream system rejected it', indicts: false },
  /* G3811 — the owner's C3-12 ruling; does not count against the disposition. */
  undone_by_actor: { label: 'I undid my own action', indicts: false },
}

/**
 * THE UNDO OF A ROW-LEVEL ACCEPT THAT POSTED — the person retracting their own
 * act within the reversal window.
 *
 * ⚠️ G3883 — THIS WAS `wrong_disposition`, ARGUED AS *"the honest reason: the
 * data did not change and the rule was not wrong; the choice was"*, AND IT IS
 * CORRECTED RATHER THAN DELETED. That reason INDICTS the disposition — it counts
 * against `reversalRate` — so every Undo of a misclick taught the autonomy
 * dials that a correct disposition was wrong. The owner's C3-12 ruling (G3811):
 * *"New 'undone' reason: add an 'undone_by_actor' reversal reason that does not
 * count against the disposition's reversal rate."*
 */
export const UNDO_ACCEPT_REASON: ReversalReason = 'undone_by_actor'

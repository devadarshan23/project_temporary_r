import { useRef, useState } from 'react'

import { fetchException, type ExceptionDetail, type ExceptionRow } from './api/exceptions.ts'
import {
  executeProposal,
  fetchDispositions,
  proposeResolution,
  reverseResolution,
  type ReversalReason,
} from './api/resolution.ts'
import type { ToastStore } from './overlays/Toast.tsx'
import {
  TO_FINDING_NOTICE,
  UNDO_ACCEPT_REASON,
  acceptOutcomeOf,
  acceptRationaleOf,
  actRefusalOf,
  rowDispositionOf,
  waitingSentenceOf,
} from './register-acts.ts'

/**
 * THE REGISTER'S ACCEPT AND REOPEN, AS ONE HOOK — G3641–G3650, 3 Oct 2026.
 *
 * A module of its own rather than more of `main.tsx`, so the screen that owns
 * the register gains a handful of lines and every decision lives in
 * `register-acts.ts`, where `node --test` reaches it.
 *
 * 🛑 NO OPTIMISM. The pack draws the row's result AFTER the act (`SAID.accept`),
 * never a row that changes before the plane answers, so the line is merged
 * from what the plane STORED — `getException` read back after the write — and
 * the button says what it is doing while it does it (`aria-disabled`, the
 * register's existing double-press rule). `mergeAssignment()` is the one
 * merge, as it is for Take.
 *
 * 🛑 THE UNDO IS A REAL ACT. Undoing a row-level Accept that POSTED is
 * `reverseResolution` with `wrong_disposition` — inside the plane's 24-hour
 * window, and refused calmly by it outside one. An Accept that only PROPOSED
 * offers no undo: no operation withdraws a proposal, and an Undo that did
 * nothing would be the worst control on the page.
 */

export interface RegisterActsOptions {
  readonly origin: string
  readonly toasts: ToastStore
  /** The session holds `execute_resolution` — posting is the reader's own act. */
  readonly mayPost: boolean
  /** Merge the plane's stored status (and assignee) into the row. */
  readonly onLine: (written: Pick<ExceptionDetail, 'exceptionId' | 'assignedTo' | 'status'>) => void
  /** Something moved: counts and the Approvals queue re-read. */
  readonly onMoved: () => void
  /** Accept needs a choice the row cannot make — the finding's C4 panel makes it. */
  readonly toFinding: (exceptionId: string) => void
}

export interface RegisterActs {
  /** The line an act is in flight on, or `null`. */
  readonly busy: string | null
  /** Lines the plane said have no resolution set up (G3441) — Accept goes quiet. */
  readonly notConfigured: ReadonlySet<string>
  readonly accept: (row: ExceptionRow) => void
  readonly reopen: (row: ExceptionRow, reason: ReversalReason) => void
}

export function useRegisterActs(o: RegisterActsOptions): RegisterActs {
  const [busy, setBusy] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState<ReadonlySet<string>>(new Set())
  const seq = useRef(0)
  const next = (): string => {
    seq.current += 1
    return `act-${String(seq.current)}`
  }

  const settle = async (exceptionId: string): Promise<void> => {
    const stored = await fetchException({ origin: o.origin, exceptionId })
    o.onLine(stored)
    o.onMoved()
  }

  const refused = (exceptionId: string, err: unknown, title: string): void => {
    const r = actRefusalOf(err)
    if (r.kind === 'not-configured') {
      setNotConfigured((s) => new Set([...s, exceptionId]))
    }
    o.toasts.raise({
      id: next(),
      /* A 409 is a STATE of the line, told calmly; only a real failure
         interrupts (`fail` is the one assertive kind). */
      kind: r.kind === 'fail' ? 'fail' : 'ok',
      title: r.kind === 'fail' ? title : r.kind === 'not-configured' ? 'Resolutions are not set up yet.' : 'Nothing changed.',
      body: r.text,
    })
  }

  const undoAccept = (exceptionId: string): void => {
    reverseResolution({ origin: o.origin, exceptionId, reason: UNDO_ACCEPT_REASON })
      .then(() => settle(exceptionId))
      .then(() => {
        o.toasts.raise({ id: next(), kind: 'ok', title: 'Undone — the line is open again.' })
      })
      .catch((err: unknown) => { refused(exceptionId, err, 'The accept was not undone.') })
  }

  const accept = (row: ExceptionRow): void => {
    if (busy !== null) return
    const id = row.exceptionId
    setBusy(id)
    void (async () => {
      try {
        const choice = rowDispositionOf(await fetchDispositions({ origin: o.origin, exceptionId: id }))
        if (choice.kind === 'choose') {
          o.toasts.raise({ id: next(), kind: 'ok', ...TO_FINDING_NOTICE })
          o.toFinding(id)
          return
        }
        if (choice.kind === 'none') {
          o.toasts.raise({
            id: next(),
            kind: 'ok',
            title: 'Nothing changed.',
            body: 'No resolution is open to you on this line. Open the finding to see why.',
          })
          return
        }
        const proposal = await proposeResolution({
          origin: o.origin,
          exceptionId: id,
          dispositionKey: choice.key,
          rationale: acceptRationaleOf(choice.label),
        })
        if (acceptOutcomeOf(proposal, o.mayPost) === 'post') {
          await executeProposal({ origin: o.origin, proposalId: proposal.proposalId })
          await settle(id)
          o.toasts.raise({
            id: next(),
            kind: 'undo',
            title: `Accepted and posted — ${choice.label}.`,
            body: 'It is reversible for 24 hours from the post.',
            action: { label: 'Undo', run: () => { undoAccept(id) } },
          })
          return
        }
        await settle(id)
        o.toasts.raise({
          id: next(),
          kind: 'ok',
          title: `Accepted — ${choice.label}. Nothing is posted yet.`,
          body: waitingSentenceOf(proposal, o.mayPost),
        })
      } catch (err: unknown) {
        refused(id, err, 'The line was not accepted.')
      } finally {
        setBusy(null)
      }
    })()
  }

  const reopen = (row: ExceptionRow, reason: ReversalReason): void => {
    if (busy !== null) return
    const id = row.exceptionId
    setBusy(id)
    reverseResolution({ origin: o.origin, exceptionId: id, reason })
      .then(() => settle(id))
      .then(() => {
        o.toasts.raise({
          id: next(),
          kind: 'ok',
          title: 'Reopened — the line is open again.',
          body: 'The reason is recorded on the line.',
        })
      })
      .catch((err: unknown) => { refused(id, err, 'The line was not reopened.') })
      .finally(() => { setBusy(null) })
  }

  return { busy, notConfigured, accept, reopen }
}

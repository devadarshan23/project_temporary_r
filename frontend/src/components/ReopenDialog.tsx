import { useState } from 'react'

import { findingLine } from '../api/exceptions.ts'
import { REOPEN_REASONS, type ReversalReason } from '../api/resolution.ts'
import { Surface } from '../overlays/Surface.tsx'
import { REVERSAL_REASON_WORD } from '../register-acts.ts'

/**
 * REOPEN — `reverseResolution`, asked first (G3644, 3 Oct 2026).
 *
 * A reversal is a correction and corrections are signed: the contract's
 * reason vocabulary is CLOSED and LOAD-BEARING (`wrong_disposition` and
 * `insufficient_evidence` count against the autonomy that resolved the line;
 * the other three do not), so the person chooses one of the five — never free
 * text, never a default. The confirm stays `aria-disabled` until one is chosen,
 * the register's existing rule for a commit that is not ready.
 *
 * Every word is a constant (`REVERSAL_REASON_WORD`); nothing from the row but
 * its summary — a text child, escaped (invariant 6) — reaches this dialog.
 */
export interface ReopenDialogProps {
  readonly line: { readonly exceptionId: string; readonly summary: string | null; readonly ruleLabel: string } | null
  readonly onReopen: (reason: ReversalReason) => void
  readonly onCancel: () => void
}

export function ReopenDialog({ line, onReopen, onCancel }: ReopenDialogProps) {
  const [reason, setReason] = useState<ReversalReason | null>(null)
  const cancel = (): void => {
    setReason(null)
    onCancel()
  }
  return (
    <Surface
      kind="modal"
      open={line !== null}
      onDismiss={cancel}
      title="Reopen this line"
      footer={
        line === null ? null : (
          <>
            <button
              className="btn btn--primary btn--small"
              type="button"
              data-confirm-reopen={line.exceptionId}
              aria-disabled={reason === null ? 'true' : undefined}
              onClick={() => {
                if (reason === null) return
                const chosen = reason
                setReason(null)
                onReopen(chosen)
              }}
            >
              Reopen
            </button>
            <button className="btn btn--small" type="button" onClick={cancel}>Cancel</button>
          </>
        )
      }
    >
      <p>{line === null ? null : findingLine(line)}</p>
      <fieldset className="reasons" data-reopen-reasons="">
        <legend className="lab">Why it is reopened</legend>
        {REOPEN_REASONS.map((key) => (
          <label key={key} className="field">
            <input
              type="radio"
              name="reopen-reason"
              value={key}
              data-reopen-reason={key}
              checked={reason === key}
              onChange={() => { setReason(key) }}
            />{' '}
            <span>{REVERSAL_REASON_WORD[key].label}</span>
          </label>
        ))}
      </fieldset>
      <p className="ov-why">
        The resolution is undone and the line goes back to open work. The reason is recorded on the line, and
        the first two count against the judgement that resolved it.
      </p>
    </Surface>
  )
}

import { useId, useState } from 'react'
import type { ReactNode } from 'react'

import { Surface } from './Surface.tsx'
import { reasonFrom, type Reason } from './reason.ts'

/**
 * THE MODAL — where a destructive act with a REQUIRED REASON lives.
 *
 * 🛑 THE REASON IS NOT A COURTESY FIELD AND THE BUNDLE SAYS SO IN AS MANY WORDS:
 * *"it is product machinery — it is what an SOP amendment would be drafted
 * from."* So it is required IN THE TYPE, not in a validator and not in a review
 * checklist: `onConfirm` takes a `Reason`, `Reason` has no literal, and the only
 * way to obtain one is `reasonFrom()`, which refuses blank text. **A destructive
 * act with no reason does not compile** — see `reason.ts` for why a required
 * `reason: string` prop would not have been the same guarantee.
 *
 * ⚠️ THE FIELD IS STILL A `<textarea>` AND THAT IS NOT A CONTRADICTION. The
 * ruling is about the TYPE the act carries, not about the control the reason is
 * typed into; a reason that an SOP amendment is drafted from is prose, and prose
 * needs more than one line. What the type stops is the act being invocable
 * without one.
 *
 * 🛑 THE PRIMARY IS `aria-disabled`, NEVER `disabled`, WHILE THE REASON IS BLANK.
 * G189's hard condition: a refused control keeps its place in the tab order so
 * its reason stays reachable. The `disabled` attribute removes it from the tab
 * order, which makes the explanation unreachable by keyboard BY CONSTRUCTION —
 * *"that is the trap the condition exists to close."* The consequence here is
 * that the button is reachable and must therefore refuse OUT LOUD when pressed,
 * which is what `role="status"` on the message below is for.
 */
export interface ModalProps {
  readonly open: boolean
  readonly onDismiss: () => void
  readonly title: string
  /** What the act will do, stated before it is done. */
  readonly children: ReactNode
  /** The verb on the primary control — "Reject", "Post", "Withdraw". */
  readonly verb: string
  /**
   * 🛑 THE SIGNATURE IS THE CONTROL. A `Reason` cannot be constructed from a
   * literal, so no caller can invoke this act without one, and no future edit can
   * make the reason optional without changing this line — which is a change a
   * reader sees.
   */
  readonly onConfirm: (reason: Reason) => void
  /** One line saying what the reason is FOR, above the field. Required: a field
   *  labelled only "Reason" collects "n/a". */
  readonly hint: string
}

export function Modal({ open, onDismiss, title, children, verb, onConfirm, hint }: ModalProps) {
  const [text, setText] = useState('')
  const [refused, setRefused] = useState<string | null>(null)
  const fieldId = useId()
  const hintId = useId()
  const whyId = useId()

  const reason = reasonFrom(text)
  const ready = reason !== null

  function confirm(): void {
    if (reason === null) {
      /* 🛑 IT REFUSES OUT LOUD RATHER THAN DOING NOTHING. The control is
         `aria-disabled` and therefore focusable and pressable; a press that
         silently did nothing would read, from the keyboard, as a broken button.
         The message is `role="status"` so the refusal EVENT is announced — which
         is a different guarantee from the `aria-describedby` reason, delivered on
         focus. */
      setRefused('Not ' + verb.toLowerCase() + 'ed — the reason is required. It is what an SOP amendment would be drafted from.')
      return
    }
    setRefused(null)
    onConfirm(reason)
  }

  return (
    <Surface
      kind="modal"
      open={open}
      onDismiss={onDismiss}
      title={title}
      footer={
        <>
          <button
            className="btn btn--primary btn--small"
            type="button"
            /* 🛑 `aria-disabled`, NEVER `disabled` — see the header. */
            aria-disabled={ready ? undefined : 'true'}
            aria-describedby={ready ? undefined : whyId}
            onClick={confirm}
          >
            {verb}
          </button>
          <button className="btn btn--small" type="button" onClick={onDismiss}>Cancel</button>
        </>
      }
    >
      {children}
      <div className="field" data-invalid={refused === null ? undefined : ''}>
        <label className="field-l" htmlFor={fieldId}>Reason</label>
        <p className="field-h" id={hintId}>{hint}</p>
        <textarea
          className="field-i"
          id={fieldId}
          value={text}
          aria-describedby={hintId}
          aria-invalid={refused === null ? undefined : 'true'}
          onChange={(e) => { setText(e.target.value) }}
        />
      </div>
      {/* ⚠️ THE REGION IS ALWAYS RENDERED, NEVER MOUNTED ON DEMAND. A live region
          inserted at the moment it has something to say is a live region a screen
          reader has not been watching, and the announcement is lost. It carries
          the empty string until there is something to announce, and it is the
          target of `aria-describedby` on the refused primary — so the reason
          resolves whether or not the act has been attempted. */}
      <p className="ov-why" id={whyId} role="status">
        {refused ?? (ready ? '' : 'A reason is required before this act can be taken.')}
      </p>
    </Surface>
  )
}

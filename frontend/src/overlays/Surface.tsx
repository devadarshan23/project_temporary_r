import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useFocusInto, useOverlay } from './useOverlay.ts'

/**
 * How long a leaving overlay's ghost stays mounted: a little over the kernel's
 * `--t-fade` (120ms), so the CSS fade completes before the node goes. The fade
 * itself is timed by the token in `overlays.css`; this only bounds the unmount.
 */
export const LEAVE_MS = 160

/**
 * THE DIALOG SURFACE the drawer and the modal both are.
 *
 * 🛑 THE KERNEL RULES WHAT AN OVERLAY LOOKS LIKE AND THIS COMPONENT DOES NOT GET
 * A VOTE (`design/system/tokens.css`, THE OVERLAY SURFACE):
 *
 *     AN OVERLAY IS  --paper ground · a 1px --rule-strong edge · radius 0 ·
 *                    NO shadow. A drawer takes the edge on the side it enters
 *                    from and nowhere else.
 *
 * The treatment is in `frontend/src/overlays.css`, referencing kernel tokens and
 * declaring no value of its own, in the same relationship `shell.css` has to
 * `design/system/shell.html`.
 *
 * ┌─ 🛑 WHY NOT A NATIVE `<dialog>` — THE REJECTED ALTERNATIVE, PRESERVED ──────┐
 * │ `design/system/overlays.html` uses `<dialog>` + `showModal()`, and it is a  │
 * │ genuinely good mechanism: the browser's own focus trap, Escape, top layer   │
 * │ and `::backdrop`. It was refused HERE for one reason, and it is G247's own  │
 * │ reason rather than a preference.                                           │
 * │                                                                            │
 * │ Taking it would give the drawer and the modal the BROWSER's focus trap and  │
 * │ the BROWSER's Escape, while the tooltip and the toast — which cannot be     │
 * │ dialogs — keep this module's. That is TWO implementations of escape         │
 * │ handling and TWO of focus containment across four surfaces, which is        │
 * │ precisely what the ruling forbids: *"one implementation of each behaviour,  │
 * │ four surfaces over it."* The divergence would also be the invisible kind —  │
 * │ `<dialog>`'s Escape fires `cancel` and can be prevented, ours cannot; its   │
 * │ trap includes the top layer, ours is `inert` on siblings — differences that │
 * │ never show in a screenshot.                                                 │
 * │                                                                            │
 * │ WHAT THE REFUSAL COSTS, STATED RATHER THAN DISCOVERED: this surface must    │
 * │ supply `inert`, the scrim and the top-layer stacking itself, and it does —  │
 * │ `behaviour.ts`'s `inertBackground()` and `overlays.css`'s `--scrim`. The    │
 * │ browser would have done those three for free.                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
export interface SurfaceProps {
  readonly open: boolean
  /** Every close path — the ✕, Cancel, Escape, the scrim — is this one function.
   *  Required: an overlay with no way out is the keyboard trap the whole module
   *  is arranged to prevent. */
  readonly onDismiss: () => void
  /** The heading. Required, because `aria-labelledby` points at it and a dialog
   *  announced as "dialog" and nothing else is a dialog a screen-reader user has
   *  to explore to identify. */
  readonly title: string
  readonly children: ReactNode
  /** The footer's controls. */
  readonly footer?: ReactNode
  /** `drawer` enters from the right and takes its edge there; `modal` is
   *  centred. The kernel's sentence — "a drawer takes the edge on the side it
   *  enters from and nowhere else" — is spelled in `overlays.css` against this. */
  readonly kind: 'drawer' | 'modal'
}

export function Surface({ open, onDismiss, title, children, footer, kind }: SurfaceProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  /* 🛑 ALL FOUR BEHAVIOURS, DECLARED RATHER THAN ASSUMED. A drawer and a modal
     take every one of them; the tooltip and the toast take different subsets and
     say so at their own call sites. Reading the four answers side by side is the
     point of the shape. */
  useOverlay(ref, open, onDismiss, { trapFocus: true, lockScroll: true, returnFocus: true })
  useFocusInto(ref, open)

  /* RMR-03 (G3479) — A LEAVING OVERLAY TAKES A PLAIN FADE. `tokens.css`:
     *"A LEAVING ELEMENT DOES NOT BOUNCE. Run the spring on the way IN and a
     plain --t-fade on the way OUT"*; `Handoff Specification`: *"Entry only; a
     leaving overlay takes a plain fade."* This returned `null` the frame the
     overlay closed, so the exit was a hard cut.
     🛑 THE DIALOG ITSELF STILL LEAVES AT ONCE, AND THAT IS THE POINT OF THE
     SHAPE: every behaviour — focus return, inert release, scroll unlock — runs
     on `open` exactly as before, and the dialog's role, name and controls are
     gone from the accessibility tree the moment it closes. What stays for one
     `--t-fade` is a GHOST: the last frame's paint, `aria-hidden` and `inert`,
     carrying no `role` and no `data-overlay`, so nothing can focus it, read
     it, or mistake it for an open overlay. Under reduced motion it is not
     drawn at all. */
  const last = useRef<{ title: string; children: ReactNode; footer: ReactNode | undefined } | null>(null)
  /* The ghost is decided DURING the render that closes the overlay (React's
     "adjust state when a prop changes" pattern), so the frame that removes the
     dialog is the frame that paints the ghost — an effect would leave one
     frame with neither, which is the hard cut this exists to remove. */
  const [leaving, setLeaving] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    setLeaving(!open)
  }
  useEffect(() => {
    if (!leaving) return undefined
    const t = setTimeout(() => { setLeaving(false) }, LEAVE_MS)
    return () => { clearTimeout(t) }
  }, [leaving])

  if (!open) {
    const ghost = last.current
    if (!leaving || ghost === null) return null
    return (
      <div className="ov-layer" data-leaving={kind} aria-hidden="true" inert>
        <div className="ov-scrim" />
        <div className="ov">
          <div className="ov-head">
            <h2 className="ov-title">{ghost.title}</h2>
            <span className="ov-x"><span>✕</span></span>
          </div>
          <div className="ov-body">{ghost.children}</div>
          {ghost.footer === undefined ? null : <div className="ov-foot">{ghost.footer}</div>}
        </div>
      </div>
    )
  }
  last.current = { title, children, footer }

  return (
    <div className="ov-layer" data-overlay={kind}>
      {/* 🛑 THE SCRIM IS NOT A BUTTON AND IT IS NOT IN THE TAB ORDER. It is a
          pointer shortcut for a close path that already exists on the keyboard
          (Escape) and in the footer (Cancel). A focusable scrim would be a tab
          stop with no name, announced as "button" with no label, immediately
          before the dialog it dims — which is a worse first impression of the
          overlay than no shortcut at all. `aria-hidden` says so out loud. */}
      <div className="ov-scrim" aria-hidden="true" onClick={onDismiss} />
      <div
        className="ov"
        /* 🛑 `role="dialog"` PLUS `aria-modal` PLUS REAL `inert` ON EVERYTHING
            ELSE. The third is what makes the second true — see
            `behaviour.ts`'s `inertBackground()`. */
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        /* The container takes focus when the overlay opens, so the dialog's name
           is announced before its first control. -1 keeps it out of the tab ring
           it is the boundary of. */
        tabIndex={-1}
        ref={ref}
      >
        <div className="ov-head">
          <h2 className="ov-title" id={titleId}>{title}</h2>
          <button className="ov-x" type="button" onClick={onDismiss}>
            {/* The glyph is decoration; the name is the word. A button whose
                accessible name is "✕" is a button nobody can describe. */}
            <span aria-hidden="true">✕</span>
            <span className="sr-only">Close {title}</span>
          </button>
        </div>
        <div className="ov-body">{children}</div>
        {footer === undefined ? null : <div className="ov-foot">{footer}</div>}
      </div>
    </div>
  )
}

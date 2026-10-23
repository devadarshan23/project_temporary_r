/**
 * THE REACT SEAM over `behaviour.ts` and `tooltip.ts`.
 *
 * ⚠️ THIS FILE IS `.ts` AND NOT `.tsx` ON PURPOSE. It holds hooks and no markup,
 * so it type-checks and imports exactly like the two framework-free modules
 * beside it. The JSX lives in the four components, which are as thin as they can
 * be made — every behaviour they have is a call into here.
 *
 * 🛑 NOTHING BELOW DECIDES WHETHER AN OVERLAY IS OPEN. The open state is the
 * component's `useState`, always, which is the kernel's "exactly one writer"
 * rule holding for all four surfaces rather than only for the tooltip. A hook
 * that owned the state would be a second writer the moment a caller needed to
 * open a drawer from a route.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import { attachOverlay, type OverlayBehaviours } from './behaviour.ts'
import { TOOLTIP_CLOSED, tooltipNext, type TooltipEvent, type TooltipState } from './tooltip.ts'

/**
 * Wire the four behaviours to an overlay while it is open, and unwire them —
 * including restoring focus — when it closes or unmounts.
 *
 * ⚠️ THE EFFECT DEPENDS ON `open`, SO CLOSING RUNS THE CLEANUP. That is the whole
 * mechanism: there is no `close()` to remember to call and therefore no close
 * path that can forget to restore focus. The drawn design needed a
 * `MutationObserver` as belt-and-braces because its state lived in the DOM and a
 * missed `close` event left `<main>` inert with nothing open; here the state
 * lives in React and unmounting is not an event that can be missed.
 */
export function useOverlay(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
  behaviours: OverlayBehaviours,
): void {
  /* 🛑 THE HANDLER IS HELD IN A REF AND THE EFFECT DOES NOT DEPEND ON IT. A
     caller passing an inline arrow — which every caller does — would otherwise
     re-run the effect on every render, and re-running it means DISPOSING: the
     scroll lock would be released and re-taken and, worse, focus would be
     RESTORED TO THE OPENER mid-interaction on every keystroke inside the
     overlay. Measured as a real failure shape, not a theoretical one. */
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  const { trapFocus, lockScroll, returnFocus } = behaviours

  useEffect(() => {
    if (!open) return
    const root = ref.current
    if (root === null) return
    return attachOverlay(root, {
      trapFocus,
      lockScroll,
      returnFocus,
      onDismiss: () => { dismissRef.current() },
    })
  }, [ref, open, trapFocus, lockScroll, returnFocus])
}

/**
 * MOVE FOCUS INTO A NEWLY OPENED OVERLAY.
 *
 * 🛑 A TRAP WITHOUT THIS IS A TRAP AROUND NOTHING. If focus is still on the
 * opener — which is outside the overlay — the first Tab goes to whatever follows
 * the opener in the document, and the "trap" only engages once focus happens to
 * wander in. The overlay's own container takes focus rather than its first
 * control, so a screen reader announces the dialog's label before its first
 * button, and so that opening a drawer does not look like an act.
 */
export function useFocusInto(ref: RefObject<HTMLElement | null>, open: boolean): void {
  useEffect(() => {
    if (!open) return
    const root = ref.current
    if (root === null) return
    root.focus()
  }, [ref, open])
}

/**
 * HAS A REAL PERSON TOUCHED THIS PAGE YET — the tooltip's load guard.
 *
 * 🛑 CARRIED FROM THE DESIGN RECORD RATHER THAN REDISCOVERED. A browser restores
 * focus on reload and a restored focus fires `focus` with no user behind it,
 * which opened a tooltip before the reviewer had touched anything. The listeners
 * are on the document in the capture phase so nothing can consume the first
 * input before it is counted.
 *
 * ⚠️ IT RETURNS A REF AND NOT STATE, DELIBERATELY. As state, the first mousedown
 * anywhere on the page would re-render every tooltip on it. The value is only ever
 * read inside an event handler, which is exactly what a ref is for.
 */
export function useUserActive(): RefObject<boolean> {
  const active = useRef(false)
  useEffect(() => {
    const mark = (): void => { active.current = true }
    const opts = { capture: true } as const
    document.addEventListener('mousedown', mark, opts)
    document.addEventListener('touchstart', mark, opts)
    document.addEventListener('keydown', mark, opts)
    return () => {
      document.removeEventListener('mousedown', mark, opts)
      document.removeEventListener('touchstart', mark, opts)
      document.removeEventListener('keydown', mark, opts)
    }
  }, [])
  return active
}

/** What `useTooltip` hands a component. `send` is the ONLY writer of `state`. */
export interface TooltipControl {
  readonly state: TooltipState
  readonly send: (e: TooltipEvent) => void
  readonly userActive: RefObject<boolean>
}

/**
 * THE TOOLTIP, DRIVEN BY THE PURE REDUCER IN `tooltip.ts`.
 *
 * Every route into the open state goes through `send`, so the kernel's rule —
 * one writer, and it is the script — is a property of this hook's shape rather
 * than a convention the next component has to remember.
 */
export function useTooltip(): TooltipControl {
  const [state, setState] = useState<TooltipState>(TOOLTIP_CLOSED)
  const userActive = useUserActive()
  const send = useCallback((e: TooltipEvent) => {
    setState((s) => tooltipNext(s, e))
  }, [])
  return { state, send, userActive }
}

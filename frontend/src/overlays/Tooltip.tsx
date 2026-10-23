import { useCallback, useId, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { tooltipFlip, tooltipFlipVertical, tooltipShift } from './tooltip.ts'
import { useOverlay, useTooltip } from './useOverlay.ts'

/**
 * THE TOOLTIP — G189/R4's component, and the reason this slice is not optional.
 *
 * ┌─ 🛑 `title=` IS REFUSED, AND THIS COMPONENT IS WHY THE REFUSALS EXIST ──────┐
 * │ `NotBuilt.tsx` and `Person.tsx` each decline `title="…"` in their own       │
 * │ prose, for one reason: it is HOVER-ONLY, and G189 requires a tooltip to be  │
 * │ reachable by focus AND tap. Those refusals are what minted the kernel's     │
 * │ TOOLTIP SURFACE. **A tooltip component that fell back to `title=` would**   │
 * │ **undo the ruling it implements**, so this file contains no `title`         │
 * │ attribute and no prop that could become one, and the assertions grep for it │
 * │ across the whole of `frontend/src` rather than trusting this paragraph.     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 FOUR RULES FROM THE KERNEL, EACH HELD STRUCTURALLY RATHER THAN BY REVIEW:
 *
 * 1 · NO CSS SELECTOR OPENS IT. The open state is `useTooltip()`'s `useState`,
 *     painted through `data-on`. There is no `:hover`, `:focus-visible` or
 *     `:focus-within` rule in `overlays.css` that reaches a panel — because a
 *     script can clear an attribute and cannot clear a CSS state, so on the
 *     keyboard path Escape would write the panel shut and leave it painted.
 *     Hover still opens it, through `pointerenter` calling the same reducer, so
 *     hover cannot disagree with Escape.
 *
 * 2 · IT IS HIDDEN BY OPACITY, NEVER `display:none` AND NEVER
 *     `visibility:hidden`. Both remove the panel from the accessibility tree, so
 *     every `aria-describedby` pointing at it resolves to NOTHING — which turns
 *     G189 from a reversal that ADDS a reason into one that TAKES a reason away
 *     from exactly the keyboard and screen-reader users it was imposed for.
 *
 * 3 · IT IS DISMISSIBLE WITH ESCAPE AND FOCUS DOES NOT MOVE. WCAG 2.2 1.4.13.
 *     Escape is routed through `behaviour.ts`'s shared handler — the same one the
 *     drawer and the modal use — with `returnFocus: false`, because a tooltip
 *     never moved focus and "restoring" it would move it.
 *
 * 4 · IT IS HOVERABLE AND PERSISTENT. The pointer may cross the gap onto the
 *     panel without it vanishing, and it survives while the trigger holds focus.
 */

export interface TooltipProps {
  /** The control the tooltip describes. It is rendered with `aria-describedby`
   *  wired to the panel; the caller passes a render function rather than a node
   *  so the wiring cannot be forgotten. */
  readonly control: (props: TooltipTriggerProps) => ReactNode
  /** The panel's content — *"the longer form the line box has no room for."* */
  readonly children: ReactNode
}

/** What `Tooltip` hands the control. Spreading this is the whole contract. */
export interface TooltipTriggerProps {
  readonly 'aria-describedby': string
  readonly onPointerEnter: () => void
  readonly onPointerLeave: () => void
  readonly onFocus: () => void
  readonly onBlur: () => void
  readonly onClick: () => void
}

export function Tooltip({ control, children }: TooltipProps) {
  const { state, send, userActive } = useTooltip()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  /* 🛑 G4091 — FLIP ON OPEN. The closed panel is a 1px box (`overlays.css`);
     on open it takes its full size at once (only the opacity fades), so it can
     be measured where its CSS anchored it in the same frame, before paint, and
     flipped inward if it would cross the viewport edge. `data-flip` is
     PLACEMENT, not open state — the open state's one writer is still the
     reducer — so it is written here, on the element, and React never renders
     it. It is cleared before every measurement so a panel flipped last time is
     measured at its own anchor this time, and it is LEFT in place on close so
     the fade-out happens where the reader saw the panel. */
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const panel = panelRef.current
    if (!state.open || wrap === null || panel === null) return
    panel.removeAttribute('data-flip')
    panel.removeAttribute('data-flip-y')
    panel.style.removeProperty('--tip-shift')
    const p = panel.getBoundingClientRect()
    const t = wrap.getBoundingClientRect()
    const across = {
      panelLeft: p.left,
      panelRight: p.right,
      triggerLeft: t.left,
      triggerRight: t.right,
      viewport: document.documentElement.clientWidth,
    }
    /* U-25 (G4187): when NEITHER anchor fits, the panel is shifted inside by
       an offset, keeping its own inset from the viewport edge. The offset is
       geometry the reader's viewport decides, so it is the one value written
       as a custom property rather than chosen from a token. */
    const shift = tooltipShift(across, Number.parseFloat(getComputedStyle(panel).paddingLeft) || 0)
    if (shift !== null) {
      panel.style.setProperty('--tip-shift', `${String(shift)}px`)
      panel.setAttribute('data-flip', 'shift')
    } else {
      const flip = tooltipFlip(across)
      if (flip !== null) panel.setAttribute('data-flip', flip)
    }
    /* U-25 (G4188): and up or down, when the panel would cross the viewport's
       top or foot. */
    const flipY = tooltipFlipVertical({
      panelTop: p.top,
      panelBottom: p.bottom,
      triggerTop: t.top,
      triggerBottom: t.bottom,
      viewportHeight: document.documentElement.clientHeight,
    })
    if (flipY !== null) panel.setAttribute('data-flip-y', flipY)
  }, [state.open])

  const dismiss = useCallback(() => { send({ kind: 'escape' }) }, [send])

  /* 🛑 THE SAME SHARED HANDLER THE DRAWER AND THE MODAL TAKE, WITH THREE OF THE
     FOUR BEHAVIOURS DECLINED. This is the line that makes the ruling literal:
     one implementation of escape handling, four surfaces over it. Writing a
     local `keydown` listener here instead would be a second implementation —
     and it would differ, because this one answers only for the TOPMOST overlay,
     so Escape inside an open modal would otherwise close a tooltip on the page
     behind it as well. */
  useOverlay(wrapRef, state.open, dismiss, {
    trapFocus: false,
    lockScroll: false,
    returnFocus: false,
  })

  const trigger: TooltipTriggerProps = {
    'aria-describedby': panelId,
    onPointerEnter: () => { send({ kind: 'pointerenter' }) },
    onPointerLeave: () => {
      /* The reducer decides; this only reports what the DOM knows. `overPanel`
         is read at the moment of the event rather than after a timer, because a
         timer here is what makes the behaviour untestable without a clock. */
      const wrap = wrapRef.current
      const panel = wrap?.querySelector('[data-tip]') ?? null
      send({
        kind: 'pointerleave',
        overPanel: panel instanceof HTMLElement && panel.matches(':hover'),
        focused: wrap !== null && wrap.contains(document.activeElement),
      })
    },
    onFocus: () => { send({ kind: 'focus', userActive: userActive.current }) },
    onBlur: () => { send({ kind: 'blur' }) },
    onClick: () => {
      const wrap = wrapRef.current
      send({ kind: 'click', focused: wrap !== null && wrap.contains(document.activeElement) })
    },
  }

  return (
    <span className="tipwrap" ref={wrapRef}>
      {control(trigger)}
      {/* 🛑 THE PANEL IS ALWAYS IN THE DOM AND ALWAYS IN THE ACCESSIBILITY TREE.
          Rendering it conditionally — `{open && <span…>}` — is the React spelling
          of `display:none`: `aria-describedby` would point at an id that does not
          exist, and the reason would exist only while it is painted. That is the
          exact bug three of the five design files shipped, arriving through JSX
          instead of through CSS. The kernel's rule is the one that governs here:
          A TOOLTIP MUST NEVER LEAVE THE ACCESSIBILITY TREE. */}
      <span className="tip" role="tooltip" id={panelId} ref={panelRef} data-tip="" data-on={state.open ? '' : undefined}>
        {children}
      </span>
    </span>
  )
}

/**
 * A REFUSED CONTROL — `aria-disabled`, the reason BESIDE it, and the tooltip.
 * All three, and all three are required by the type.
 *
 * 🛑 THIS COMPONENT EXISTS TO MAKE ONE FAILURE IMPOSSIBLE RATHER THAN UNLIKELY.
 * G189 is a REVERSAL and it is ADDITIVE: the earlier position was *"Disabled says
 * why beside it, never in a tooltip"*, and the reversal keeps the beside-text and
 * adds the tooltip. The issue names the failure precisely — *"a tooltip is the
 * obvious place to move the reason to, and moving it applies the opposite of both
 * positions at once."* A build that deleted the beside-text because a tooltip now
 * exists would have applied neither ruling.
 *
 * So `beside` and `detail` are BOTH required props. Dropping the beside-text is
 * not a review failure here; it is a type error.
 */
export interface RefusedControlProps {
  /** The control's label. */
  readonly children: ReactNode
  /** The SHORT reason, rendered as visible text beside the control. Required —
   *  see the header. This is the half G189 keeps, not the half it adds. */
  readonly beside: string
  /** The LONGER form, carried in the tooltip. Required — this is the half G189
   *  adds, and it is additive rather than a replacement. */
  readonly detail: ReactNode
}

export function RefusedControl({ children, beside, detail }: RefusedControlProps) {
  return (
    <span className="refused">
      <Tooltip
        control={(t) => (
          <button
            className="btn btn--small"
            type="button"
            /* 🛑 `aria-disabled="true"`, NEVER the `disabled` ATTRIBUTE. A truly
               disabled button is removed from the tab order, so a tooltip on it
               is unreachable by keyboard by construction — *"that is the trap the
               condition exists to close."* */
            aria-disabled="true"
            {...t}
          >
            {children}
          </button>
        )}
      >
        {detail}
      </Tooltip>
      {/* THE BESIDE-TEXT. Visible, unconditional, and not a tooltip. */}
      <small className="refused-why text-micro text-muted block">{beside}</small>
    </span>
  )
}

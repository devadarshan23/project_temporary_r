/**
 * THE TOOLTIP'S OPEN STATE — one writer, and this is it.
 *
 * 🛑 THE KERNEL RULES THIS SURFACE IN AS MANY WORDS AND THE RULE IS A CSS RULE,
 * NOT A REVIEW NOTE (`design/system/tokens.css`, THE TOOLTIP SURFACE, owner
 * ruling of 16 Aug 2026):
 *
 *     NO CSS SELECTOR MAY OPEN A TOOLTIP. Not :hover, not :focus-visible, not
 *     :focus-within. Visibility is painted by ONE attribute, and that attribute
 *     is set and cleared by script.
 *
 * THE REASON IS THAT ESCAPE MUST GENUINELY DISMISS. A script can clear an
 * attribute; it cannot clear `:focus-visible`, because pressing Escape does not
 * move focus. Three of the five design files shipped that bug live — the
 * attribute said dismissed and the pixels said open, which the kernel notes is
 * "worse than either alone, and it is WCAG 2.2 AA 1.4.13 dismissible failing
 * while every review of the source says it passes."
 *
 * ⚠️ IN A REACT COMPONENT THE SCRIPT IS REACT, so the rule is satisfied by the
 * open state being a `useState` and the panel being painted from `data-on`. What
 * is NOT automatic is everything below: the two guards the design record found by
 * building it wrong first, and the pin/unpin behaviour it corrected after a
 * keyboard user lost the reason while still standing on the control. Those are
 * REDUCER logic, so they live here as a pure function that node can drive
 * directly rather than inside a component only a browser can reach.
 *
 * ⚠️ AND THIS FILE IMPORTS NOTHING. No React, no DOM. `tooltipNext` is a total
 * function from (state, event) to state, which is what lets the assertions
 * enumerate every transition instead of sampling the three a click-through hits.
 */

/**
 * The tooltip's whole state.
 *
 * `pinned` is not a second open flag. A pinned tooltip is one a TAP opened, and
 * the difference from a hovered one is what happens when the pointer leaves:
 * a pinned panel stays, an unpinned one goes.
 */
export interface TooltipState {
  readonly open: boolean
  readonly pinned: boolean
}

export const TOOLTIP_CLOSED: TooltipState = { open: false, pinned: false }

/**
 * Every event that can reach a tooltip.
 *
 * ⚠️ `focus` CARRIES `userActive` AND THAT FIELD IS THE LOAD GUARD. It is not a
 * convenience — see `tooltipNext`.
 */
export type TooltipEvent =
  | { readonly kind: 'pointerenter' }
  | { readonly kind: 'pointerleave'; readonly overPanel: boolean; readonly focused: boolean }
  | { readonly kind: 'focus'; readonly userActive: boolean }
  | { readonly kind: 'blur' }
  | { readonly kind: 'click'; readonly focused: boolean }
  | { readonly kind: 'escape' }

/**
 * THE REDUCER. Total, pure, and the only place the open state is decided.
 */
export function tooltipNext(s: TooltipState, e: TooltipEvent): TooltipState {
  switch (e.kind) {
    /* Hover opens it. The kernel permits this precisely because it goes through
       the same writer as everything else: "overlays.html offers hover; it is
       legal there only because pointerenter calls the same show() and writes the
       same attribute, so hover cannot disagree with Escape." */
    case 'pointerenter':
      return { open: true, pinned: s.pinned }

    /* 🛑 1.4.13 HOVERABLE AND PERSISTENT. The panel survives the pointer moving
       ONTO it, and it survives the trigger still holding focus. A tooltip that
       vanished when the pointer crossed the gap to reach it is one whose content
       can never be selected, and 1.4.13 exists for exactly that. */
    case 'pointerleave':
      if (s.pinned || e.overPanel || e.focused) return s
      return { open: false, pinned: false }

    /* 🛑 THE LOAD GUARD, carried from the design record rather than rediscovered.
       A BROWSER RESTORES FOCUS ON RELOAD, and a restored focus is not a user:
       without this, a page opens a tooltip before anyone has touched it. The
       guard is `userActive` — has any real input happened yet — and it is passed
       IN rather than read from a module global so a test can drive both answers. */
    case 'focus':
      return e.userActive ? { open: true, pinned: s.pinned } : s

    /* Leaving the control closes it outright, pin included: the pin is a property
       of the tap that opened it and focus has now gone elsewhere. */
    case 'blur':
      return TOOLTIP_CLOSED

    /* 🛑 A TAP FOCUSES AND THEN CLICKS, so an unguarded pair opens on focus and
       closes on click and the tap user sees nothing. Toggling `pinned` rather
       than `open` is what makes the pair additive instead of cancelling.
       🛑 AND UN-PINNING FALLS BACK TO THE FOCUS-SHOWN STATE — it does NOT
       force-hide. The design record corrected exactly this: a keyboard user who
       pressed Enter twice lost the reason WHILE STILL STANDING ON THE CONTROL,
       and on an `aria-disabled` refused button that is a focused control with no
       visible reason, which is what G189's hard condition forbids. */
    case 'click': {
      const pinned = !s.pinned
      if (pinned) return { open: true, pinned: true }
      return { open: e.focused, pinned: false }
    }

    /* 🛑 ESCAPE CLEARS THE PIN TOO, and it must: a pinned panel that survived
       Escape would be the "attribute says dismissed, pixels say open" failure
       arriving through the pin instead of through a CSS selector.
       ⚠️ FOCUS IS NOT MOVED. 1.4.13 is dismissible WITHOUT moving focus, which is
       why the tooltip does not take `returnFocus` in `behaviour.ts`. */
    case 'escape':
      return TOOLTIP_CLOSED
  }
}

/**
 * WHICH EDGE AN OPEN PANEL ANCHORS TO — G4091, THE OWNER'S RULING ON G4077:
 * *"Flip-on-open + 1px closed box."*
 *
 * 🛑 THE CLOSED HALF IS CSS AND THIS IS THE OPEN HALF. `overlays.css` gives a
 * CLOSED panel a 1px box, so a quiet control near the edge no longer widens the
 * page while nobody is looking at its tooltip (G4077: Close scrolled sideways
 * at 390 because a "Coming soon" panel at `opacity: 0` sat at x 306–403). A
 * 1px box does nothing for an OPEN panel at the same edge: 34ch anchored
 * `left: 0` still ends past the viewport. So on open, `Tooltip.tsx` measures
 * the panel where its CSS put it and asks this function whether to flip it.
 *
 * ⚠️ IT ANSWERS ONLY WHEN THE PANEL WOULD CROSS AN EDGE (`null` otherwise), so a
 * panel `close.css` already anchors to the right (`.chrome .sp ~ .tipwrap .tip`
 * and its siblings) keeps that anchor unless it, too, would cross. When neither
 * anchor fits — a panel wider than the room on both sides of its trigger — it
 * takes the anchor that overflows LESS rather than refusing, because a tooltip
 * the reader cannot open is G189 failing in the other direction.
 *
 * ⚠️ AND THIS FILE STILL IMPORTS NOTHING. The function takes five numbers, not
 * a DOM rect, so `tests/design/tooltip-flip.test.ts` drives every arm in node.
 */
export type TooltipFlip = 'start' | 'end'

export interface TooltipGeometry {
  /** The panel's measured left and right, at whatever anchor its CSS gave it. */
  readonly panelLeft: number
  readonly panelRight: number
  /** The trigger's wrapper — the box the panel is positioned against. */
  readonly triggerLeft: number
  readonly triggerRight: number
  /** The layout viewport's width (`documentElement.clientWidth`, no scrollbar). */
  readonly viewport: number
}

export function tooltipFlip(g: TooltipGeometry): TooltipFlip | null {
  const crossesRight = g.panelRight > g.viewport
  const crossesLeft = g.panelLeft < 0
  if (!crossesRight && !crossesLeft) return null
  const width = g.panelRight - g.panelLeft
  /* How far each anchor would overflow, in px. `start` puts the panel's left
     edge on the trigger's left; `end` puts its right edge on the trigger's right. */
  const startOver = Math.max(0, -g.triggerLeft) + Math.max(0, g.triggerLeft + width - g.viewport)
  const endOver = Math.max(0, width - g.triggerRight) + Math.max(0, g.triggerRight - g.viewport)
  if (crossesRight) return endOver <= startOver ? 'end' : 'start'
  return startOver <= endOver ? 'start' : 'end'
}

/**
 * WHEN NEITHER ANCHOR FITS, SHIFT THE PANEL INSIDE — U-25, G4187. The open
 * half of G4091 chose between two anchors and, when NEITHER fitted, took the
 * one that overflowed less: G4097 (2) — *"a panel wider than the viewport at
 * every anchor still overflows by the smaller amount."* A smaller overflow is
 * still a sideways scroll (1.4.10), and it is not only a sub-272 case: a 34ch
 * panel on a trigger in the MIDDLE of a narrow row fits at neither edge.
 *
 * So when neither anchor fits, the panel is placed by offset instead: as close
 * to the trigger's left as it can sit while keeping `margin` from both viewport
 * edges (`Tooltip.tsx` passes the panel's own inset, so the gap outside it
 * matches the padding inside it). `overlays.css` caps the panel at the viewport
 * less two insets, so at any width a panel CAN fit. The answer is the panel's
 * `left` relative to the trigger's wrapper — the box it is positioned against.
 *
 * ⚠️ `null` WHENEVER EITHER ANCHOR FITS, or the panel already sits inside, so
 * `tooltipFlip()` keeps deciding every case it decided before; this answers
 * only the case it could not.
 */
export function tooltipShift(g: TooltipGeometry, margin: number): number | null {
  if (g.panelLeft >= 0 && g.panelRight <= g.viewport) return null
  const width = g.panelRight - g.panelLeft
  const startFits = g.triggerLeft >= 0 && g.triggerLeft + width <= g.viewport
  const endFits = g.triggerRight - width >= 0 && g.triggerRight <= g.viewport
  if (startFits || endFits) return null
  /* The inset shrinks to what the viewport leaves, never below zero. */
  const inset = Math.max(0, Math.min(margin, (g.viewport - width) / 2))
  const left = Math.max(0, Math.min(Math.max(g.triggerLeft, inset), g.viewport - inset - width))
  return left - g.triggerLeft
}

/**
 * WHICH SIDE OF ITS TRIGGER AN OPEN PANEL OPENS ON — U-25, G4188.
 *
 * G4097 (1): *"the flip is horizontal only; a panel opening below the fold
 * still extends the page downward."* A panel anchored below a trigger at the
 * viewport's foot is drawn where nobody can see it while they look at the
 * control it describes. On open this asks whether the panel crosses the
 * viewport's top or bottom and, if so, which side overflows LESS — the same
 * rule `tooltipFlip()` applies across.
 *
 * ⚠️ `null` WHEN IT FITS, so a panel `close.css` already opens upward (the
 * status bar's, `.statusbar .tip`) keeps that placement unless it, too, would
 * cross. The gap between trigger and panel is measured, not assumed, so a
 * flipped panel keeps the kernel's own spacing.
 */
export type TooltipFlipY = 'above' | 'below'

export interface TooltipVerticalGeometry {
  readonly panelTop: number
  readonly panelBottom: number
  readonly triggerTop: number
  readonly triggerBottom: number
  /** The layout viewport's height (`documentElement.clientHeight`). */
  readonly viewportHeight: number
}

export function tooltipFlipVertical(g: TooltipVerticalGeometry): TooltipFlipY | null {
  const crossesBottom = g.panelBottom > g.viewportHeight
  const crossesTop = g.panelTop < 0
  if (!crossesBottom && !crossesTop) return null
  const height = g.panelBottom - g.panelTop
  const below = g.panelTop >= g.triggerBottom
  const gap = Math.max(0, below ? g.panelTop - g.triggerBottom : g.triggerTop - g.panelBottom)
  /* How far each side would overflow, in px: `above` puts the panel's bottom
     `gap` above the trigger's top; `below` puts its top `gap` under the
     trigger's bottom. */
  const aboveOver = Math.max(0, height + gap - g.triggerTop) + Math.max(0, g.triggerTop - gap - g.viewportHeight)
  const belowOver = Math.max(0, g.triggerBottom + gap + height - g.viewportHeight) + Math.max(0, -(g.triggerBottom + gap))
  if (crossesBottom) return aboveOver <= belowOver ? 'above' : 'below'
  return belowOver <= aboveOver ? 'below' : 'above'
}

import type { ReactNode } from 'react'

import { Tooltip } from '../overlays/Tooltip.tsx'

/**
 * A CONTROL THE PACK DRAWS AND NOTHING SERVES — drawn exactly as the pack,
 * visibly disabled, with one small tooltip.
 *
 * G3091 (THE OWNER'S, 2 Oct 2026): *"Pack-faithful, quiet: draw exactly as the
 * pack, visibly disabled (muted, no hatch, no G-numbers); a small tooltip says
 * 'Coming soon'. Engineering rationale stays in docs/tests, never on screen."*
 * It supersedes G216 and G245's on-screen hatch FOR PRODUCT SURFACES. The
 * hatch primitive itself (`NotBuilt.tsx`, `.nb`) is unchanged and still lives
 * on the design-system specimen, where its survival under Tailwind is measured.
 *
 * THE HONESTY PROPERTY MOVES, IT IS NOT DROPPED. A hatch told a reader *"this
 * is not real"*; a quiet control has to make the same statement by BEHAVIOUR:
 *
 *   · `aria-disabled="true"` and never the `disabled` attribute — G189: a
 *     truly disabled button leaves the tab order, and its tooltip becomes
 *     unreachable by keyboard by construction;
 *   · no `href` and no handler that acts — the only thing a click does is open
 *     the tooltip, which is the Tooltip primitive's own behaviour;
 *   · `data-soon`, so a test can enumerate every one and require all three of
 *     the above. `tests/app/quiet-unbuilt.test.ts` does that on the built page,
 *     and `tests/e2e/browser-login.test.ts` §27 clicks each in a real browser.
 *
 * WHY there is nothing behind it is a sentence for `docs/HANDOFF.md`, not for
 * the screen — so this component takes no `why` and no G row, by design.
 */
export const COMING_SOON = 'Coming soon'

export interface SoonProps {
  /** The pack's own element: a button by default, a link inside the nav. */
  readonly as?: 'button' | 'link'
  readonly className?: string
  readonly children: ReactNode
  /** An accessible name where the drawn content is not one (a glyph, a key). */
  readonly label?: string
  /**
   * The pack's COMMIT shape — `data-commit`, the filled primary act (RV-04,
   * `C1 Close.dc.html:247`: Accept is `.abtn[data-commit]`). Kept on a quiet
   * control so the hierarchy the pack draws — one commit, the alternatives
   * beside it — survives the muting; `close.css` mutes the FILL, not the shape.
   */
  readonly commit?: boolean
  /**
   * C3-24 (G4041) — the control is an item of a `role="menu"` (the account
   * menu, Design System primitive 5: `li[role=none] > button[role=menuitem]`).
   * A quiet item is still an item: `aria-disabled` on a `menuitem` keeps it in
   * the menu's arrow-key walk, which is G189's condition one widget over.
   */
  readonly menuItem?: boolean
}

export function Soon({ as = 'button', className, children, label, commit = false, menuItem = false }: SoonProps) {
  const named = label === undefined ? {} : { 'aria-label': label }
  const cls = { ...(className === undefined ? {} : { className }), ...(commit ? { 'data-commit': '' } : {}) }
  return (
    <Tooltip
      control={(t) =>
        as === 'link' ? (
          <a role="link" tabIndex={0} aria-disabled="true" data-soon="" {...cls} {...named} {...t}>
            {children}
          </a>
        ) : (
          <button type="button" aria-disabled="true" data-soon="" {...(menuItem ? { role: 'menuitem' } : {})} {...cls} {...named} {...t}>
            {children}
          </button>
        )
      }
    >
      {COMING_SOON}
    </Tooltip>
  )
}

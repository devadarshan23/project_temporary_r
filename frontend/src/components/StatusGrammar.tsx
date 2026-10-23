import { useState, type ReactNode } from 'react'

import { Drawer } from '../overlays/Drawer.tsx'

/**
 * THE STATUS GRAMMAR AT EVERY WIDTH — the pack's `.statusbar` at 720 and up,
 * and below 720 *"one tappable row that opens the full grammar as a sheet. Not
 * truncated and not dropped — it moves. The row shows the provenance slot,
 * because that is the half a person checks without being asked."*
 * (`Handoff Specification`, primitive 12; `Design System`, *The phone shell*.)
 *
 * 🛑 ONE IMPLEMENTATION, THREE SURFACES — G4181. G4071 built the row and the
 * sheet inside `Shell.tsx` for the tenant Close surface alone, and the staff
 * console and the partner portal went on drawing their own `.statusbar`, which
 * wraps at 390. Copying the row and the sheet into each of them would be §5.3:
 * two implementations of one primitive, and the copy is the one that drifts.
 * So the row, the sheet's state, the `Drawer` and the `.statussheet` wrapper
 * live HERE, and each surface hands in only its own slots.
 *
 * ⚠️ THE BAR IS RENDERED HERE TOO, carrying `data-narrow-row`, so the one CSS
 * rule that hides it below 720 (`close.css`) keys on that attribute rather than
 * on which surface it sits in — a fourth surface gets the narrow tier by using
 * this component, not by remembering a selector.
 */
export interface StatusSheetSlot {
  /** The slot's name, written as `data-status-slot`. The sheet keeps the
   *  bar's order; it never rearranges. */
  readonly name: string
  readonly content: ReactNode
}

export interface StatusGrammarProps {
  /** The three-slot bar's children, exactly as the wide tier draws them. */
  readonly bar: ReactNode
  /** Extra `data-*` attributes for the bar element (a surface's own hook). */
  readonly barData?: { readonly [k: `data-${string}`]: string }
  /** The narrow row's visible text — the provenance slot (primitive 12). */
  readonly row: ReactNode
  /** The sheet's slots, in the bar's order. */
  readonly sheet: readonly StatusSheetSlot[]
}

export function StatusGrammar({ bar, barData, row, sheet }: StatusGrammarProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="statusbar" data-narrow-row="" {...barData}>
        {bar}
      </div>
      <button
        className="statusrow"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen(true) }}
      >
        <span>{row}</span>
        {/* The pack draws `›`; `indicator-roster` refuses a typed grammar
            character in a component, so the row says it in words (G4071). */}
        <span className="more" aria-hidden="true">all of it</span>
        <span className="sr-only">Open the full status grammar</span>
      </button>
      <Drawer open={open} onDismiss={() => { setOpen(false) }} title="Status">
        <div className="statussheet" data-status-sheet="">
          {sheet.map((s) => (
            <div key={s.name} data-status-slot={s.name}>
              {s.content}
            </div>
          ))}
        </div>
      </Drawer>
    </>
  )
}

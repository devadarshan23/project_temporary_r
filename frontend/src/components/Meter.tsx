import type { CSSProperties } from 'react'

import { meterScale } from './indicators.ts'

/**
 * MARK ONE · THE CONFIDENCE METER — the ONLY line in the system, ported.
 *
 * 🛑 A MEASUREMENT, ALWAYS. THE ONE LINE RULE: "Exactly one thing in this product
 * is a line, and it is the meter… No underline mark, no sparkline, no
 * rule-as-status, no second bar. Ever." A progress bar is a second line. This
 * component is where a second line would be introduced under a utility framework,
 * because `class="h-1 w-1/2 bg-agent"` draws one in four classes.
 *
 * WHY THE PROPS ARE `score` AND `floor` AND NOT `width`. A width is a length; a
 * score is a number the machine produced. Taking the number and computing the
 * length here is what keeps the primitive unable to express "60% done" — there is
 * no prop for it. THE AGENT RULE turns on the same distinction: `--agent` may
 * state a number and may not indicate activity.
 *
 * The kernel paints both bars as pseudo-elements of one element — `::before` is
 * the track, `::after` is the fill at `var(--score)`. Nothing here paints.
 * The tick is the floor the score had to clear, and it is what makes the line
 * self-explaining without a legend.
 *
 * 🛑 TWO FENCES STAND BETWEEN THIS COMPONENT AND AN UNMEASURED BAR, AND THE
 * FIRST IS THE STRONGER ONE. `score` and `floor` are REQUIRED `number`s, so a
 * caller holding `Provenance.confidence` — `number | null`
 * (`grep -n 'confidence: number | null' model/domain.ts`) — cannot construct
 * this component without answering the null arm. That is a compile error, and it
 * is more than the thrown refusal #268 asked for. The THROW behind it is
 * `meterScale()` in `indicators.ts`, and it is not redundant: the null arm is a
 * live path in the meter's one legitimate source, and a value parsed from JSON
 * at a boundary passes no compiler at all.
 */
export interface MeterProps {
  /** The score the machine produced, 0–1. Refused outside that range. */
  score: number
  /** The floor it had to clear, 0–1. Drawn as the tick. */
  floor: number
  /** What the tick is called. Rendered as a word, never as a colour. */
  floorLabel: string
  className?: string
}

export function Meter({ score, floor, floorLabel, className }: MeterProps) {
  /* The cast is React's, not ours: CSSProperties has no index signature for
     custom properties. The two values below are the component's whole output —
     every colour and every dimension of the line itself is the kernel's.
     `meterScale` THROWS rather than returning a degraded pair: an unmeasured
     meter is R6's violation, not a degraded state. */
  const scale = meterScale(score, floor) as CSSProperties

  return (
    <span
      /* `meter` FIRST — see the note in NotBuilt.tsx. */
      className={className === undefined ? 'meter' : `meter ${className}`}
      style={scale}
    >
      {/* `.mono` is THE TABULAR FIGURE RULE: a figure a reader compares against
          another figure never changes width between two renders. */}
      <span className="v mono">{score.toFixed(2)}</span>
      <span className="tick" data-t={floorLabel} />
    </span>
  )
}

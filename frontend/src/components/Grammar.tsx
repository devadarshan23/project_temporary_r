import type { ReactNode } from 'react'

import { INDICATOR_FORM, MARK_CLASS, statedFact, type Indicator } from './indicators.ts'

/**
 * THE FOUR GRAMMAR INDICATORS — three, four, five and six of the six, ported.
 *
 * 🛑 THEY ARE COMPONENTS RATHER THAN TYPED CHARACTERS, AND THAT IS THE WHOLE
 * POINT OF THIS FILE. A tilde typed into a string is a tilde; a `<Hedge>` is a
 * declaration that the figure beside it is a guess. The drawing makes the
 * distinction load-bearing — *"A figure the system is **guessing at** wears the
 * hedge. Nothing else does, so **a number without one is a number somebody can
 * rely on**"* — and a rule of that shape survives exactly as long as the
 * characters have one home. They have one: `indicators.ts`. Nothing in this file
 * spells `~`, `›` or `…`; every one of them is read out of the roster.
 *
 * ⚠️ THEY CARRY NO CSS AND MUST NOT ACQUIRE ANY. `design/system/tokens.css`
 * paints `.meter` and `.conn` and nothing else in the six — *"the other four
 * indicators are grammar and carry no CSS at all."* The moment one of these
 * gains a stylesheet it has become a third MARK, and the count is six by R5
 * whatever the file is called.
 *
 * ⚠️ AND THE QUALIFIER FROM THE SPECIMEN IS DELIBERATELY NOT A PROP.
 * `design/system/index.html` draws each of the four beside a `<span class="qt">`
 * — *"— an estimate, and it says so"* — and `grep -rn 'class="qt"' design`
 * returns those four lines and nothing else. It is the specimen EXPLAINING the
 * indicator to a reader of the specimen, not part of the indicator: no drawn
 * route carries one. Requiring it here would have invented a rule the drawing
 * does not have, which is the same error in the opposite direction from letting
 * a seventh indicator in.
 */

/**
 * The mark, read out of the roster. `INDICATOR_FORM` is a total
 * `Record<Indicator, …>` over a closed union, so this index is a known property
 * access rather than a lookup that might miss — there is no `undefined` arm to
 * handle and `noUncheckedIndexedAccess` agrees.
 */
function markFor(which: Indicator): string {
  const mark = INDICATOR_FORM[which].mark
  if (mark === null) {
    /* Unreachable for the three callers below, and stated rather than silently
       rendered as an empty span: a grammar indicator that lost its character
       would otherwise degrade into ordinary prose, which is precisely the state
       "a number without one is a number somebody can rely on" cannot survive. */
    throw new RangeError(`the ${which} indicator has no mark to render`)
  }
  return mark
}

const Mark = ({ which }: { which: Indicator }) => (
  <span className={MARK_CLASS}>{markFor(which)}</span>
)

export interface GrammarProps {
  /** The figure or phrase the indicator qualifies. Required — see each rule. */
  children: ReactNode
}

/**
 * GRAMMAR ONE · TILDE HEDGES A FORECAST.
 *
 * *"A figure the system is guessing at wears the hedge. Nothing else does, so a
 * number without one is a number somebody can rely on."* The mark is a PREFIX,
 * from the drawing: `~4 hours to clear`.
 */
export function Hedge({ children }: GrammarProps) {
  return (
    <span>
      <Mark which="hedge" />
      {children}
    </span>
  )
}

/**
 * GRAMMAR THREE · CHEVRON MEANS YOUR MOVE.
 *
 * *"The agent ran every row, so naming it says nothing. A person in the loop is
 * the exception, and the chevron is where the work stops until one acts. Ink,
 * not agent green."* A SUFFIX, from the drawing: `Needs authority ›`.
 *
 * ⚠️ IT IS NOT A DISCLOSURE ARROW AND MUST NOT BECOME ONE. The account menu's
 * caret in `ChromeBar.tsx` is `▾` for exactly this reason — a chevron that
 * sometimes means "your move" and sometimes means "this opens" means neither.
 */
export function YourMove({ children }: GrammarProps) {
  return (
    <span>
      {children} <Mark which="yourMove" />
    </span>
  )
}

/**
 * GRAMMAR FOUR · ELLIPSIS MEANS ELSEWHERE.
 *
 * 🛑 *"Not 'loading'. **Elsewhere** — the work is real, it is moving, and it is
 * not moving here. A reader who sees this knows there is nothing for them to do
 * yet."* This is the indicator a person reaches for when they want a spinner,
 * and it does not mean that: `DESIGN.md` reads *"Never: a spinner, a loading
 * state, a progress indicator"*, and `bridge.css` deletes `animate-spin`
 * outright. A SUFFIX, from the drawing: `Waiting on the bank feed …`.
 */
export function Elsewhere({ children }: GrammarProps) {
  return (
    <span>
      {children} <Mark which="elsewhere" />
    </span>
  )
}

export interface StatedProps {
  /**
   * The verb, in the past tense. Refused at run time if it is a present
   * participle — see `statedFact`.
   */
  verb: string
  /**
   * When it happened. REQUIRED, because *"a fact with a time on it"* is the
   * whole of what past tense buys: a tenseless claim with no time is the claim
   * about now wearing the fact's clothes.
   */
  at: string
  /** What the fact is about, before the verb. */
  children: ReactNode
}

/**
 * GRAMMAR TWO · PAST TENSE STATES A FACT.
 *
 * *"The tense carries the certainty. **'Completed at 03:12'** is a fact with a
 * time on it; 'completing' would be a claim about now that the page cannot
 * make."*
 *
 * 🛑 IT HAS NO CHARACTER, AND THAT IS NOT AN OVERSIGHT IN THE ROSTER. The tense
 * IS the mark. `INDICATOR_FORM.stated.mark` is `null` for the same reason the
 * two painted marks carry none, and inventing a glyph for it would have minted a
 * seventh indicator under the fourth one's name.
 */
export function Stated({ verb, at, children }: StatedProps) {
  /* The refusal lives in `indicators.ts` so a test can witness it without
     transforming JSX — node --test strips types and does not transform JSX, so
     a rule declared in this file is a rule nothing here can assert. */
  const fact = statedFact(verb, at)
  return (
    <span>
      {children} <b>{fact.verb}</b> {fact.at}
    </span>
  )
}

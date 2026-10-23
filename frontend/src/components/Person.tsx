import type { ReactNode } from 'react'

/**
 * THE PERSON — `.hu`, ported. The whole mark is a WORD.
 *
 * 🛑 IT EXISTS BECAUSE THE AGENT IS THE DEFAULT. The kernel says it in one
 * sentence — *"The agent ran every row, so naming it says nothing; a PERSON in
 * the loop is the exception, so that is what gets named."* So this mark is not a
 * byline and not an avatar: it is the exception being named, in ink, in words.
 *
 * 🛑 THE TWO WAYS A PORT BREAKS IT, AND BOTH ARE ONE CLASS AWAY.
 *
 *   1. IT GETS PAINTED THE AGENT GREEN. THE AGENT RULE confines `--agent` to
 *      *"a bar, a tick or a fill whose length or position states a NUMBER the
 *      machine produced"*, and the kernel records FOUR sites that reached for
 *      green for a job green may not do and were moved to `--ink`. A person in
 *      the loop is the opposite of a measurement, so this would be the fifth.
 *      Nothing in this file states a colour; the kernel's `.hu` declares
 *      `color:var(--ink)` and this component does not compete with it.
 *   2. IT GROWS AN AVATAR PIP. That is A SECOND DOT — the count under THE SIX
 *      INDICATORS is load-bearing and *"a seventh indicator is a design change,
 *      not an addition"*. A pip arrives as a `::before`, as a `rounded-full`
 *      span beside the name, or as an `<img>`; none of the three is reachable
 *      from the surface below.
 *
 * 🛑 THIS COMPONENT REFUSES `className`, WHICH THE OTHER THREE ACCEPT, AND THE
 * ASYMMETRY IS THE POINT. `NotBuilt` and `Luminous` take one because the kernel
 * PAINTS them — `.nb.nb` and `.lit.lit` are doubled-class defences, so a `bg-*`
 * utility loses on specificity and layout utilities are all that get through.
 * `.hu` DECLARES NO BACKGROUND AT ALL, so there is nothing for a utility to
 * collide with: `bg-white` paints it, `rounded-full` rounds it, and both win
 * unopposed. Measured, not assumed — see the fence note in bridge.css: the
 * `--radius-*` clear cannot reach `rounded-full`, which is static.
 * There is also nothing here to lay out. One `<span>` in a sentence needs no
 * box, so the prop would exist only to let the two defects above in.
 *
 * ⚠️ AND NO `title`. G189: a tooltip must be reachable by focus AND tap, and
 * `title="…"` is hover-only. The mark is already a word — the thing a tooltip
 * would have carried is the content.
 */
export interface PersonProps {
  /**
   * The person, named. Rendered verbatim; the kernel upper-cases it and tracks
   * it, so pass the name as it is written rather than as it is displayed.
   */
  children: ReactNode
  /**
   * Refused — see the block above. `.hu` declares no background and no radius,
   * so a utility class reaches this mark unopposed and the two shapes it would
   * add are a filled chip and an avatar pip.
   */
  className?: never
  /** Refused for the same reason, and for `NotBuilt`'s: an inline declaration
      outranks every rule in every layer, so it is the one attacker no
      arrangement of the cascade can be chosen to beat. */
  style?: never
}

export function Person({ children }: PersonProps) {
  return <span className="hu">{children}</span>
}

import type { ReactNode } from 'react'

/**
 * THE SKIP LINK — `.skip`, ported. The only mark that EXISTS ONLY WHILE FOCUSED.
 *
 * 🛑 WHICH MAKES IT THE ONLY PLACE THE FOCUS RING IS OBSERVABLE AT ALL, and the
 * ring is the finding the kernel has carried against itself since 15 Aug 2026:
 * *"the focus ring's erasability (:focus-visible below is a box-shadow at
 * (0,1,0) with outline:none and no fallback; six files restate it as an
 * `outline` because a component edge that is also a box-shadow beats it on
 * source order)"*. Nothing in this file re-declares a ring. If a ring ever has
 * to be restated in a component, the system has acquired a seventh spelling of
 * an indicator it declares once — the `--focus-ring` token in the kernel exists
 * so that an element with its own edge can compose instead of restate.
 *
 * 🛑 TWO PROPERTIES THIS COMPONENT CANNOT HOLD ALONE, STATED SO NOBODY READS ITS
 * EXISTENCE AS A GUARANTEE. Both belong to the PAGE and are asserted against the
 * built page in tests/design/more-primitives.test.ts §3:
 *
 *   · IT MUST BE THE FIRST FOCUSABLE ELEMENT IN THE DOCUMENT. A skip link that
 *     is not first is not a skip link — it skips whatever the user already
 *     tabbed through to reach it. A component cannot know its own position.
 *   · `target` MUST NAME AN ELEMENT THAT EXISTS. A dead skip link passes every
 *     visual review and moves focus nowhere. TypeScript cannot check a string
 *     against the DOM, so the type takes an id rather than an href only to stop
 *     the `#` being forgotten — the resolution is checked by the test.
 *
 * ⚠️ THE HIDING MECHANISM IS THE KERNEL'S AND IT IS A POSITION, NOT A
 * VISIBILITY. `.skip` parks at `left:-9999px` and `.skip:focus` brings it to
 * 8px/8px. `display:none` or `visibility:hidden` would take it OUT OF THE
 * ACCESSIBILITY TREE and out of the tab order — so the one control that exists
 * only for keyboard users would be unreachable by keyboard. The kernel's TOOLTIP
 * SURFACE block bans the same two mechanisms for the same reason. That is why
 * this component takes no `className`: `hidden`, `sr-only`, `absolute`, `left-*`
 * and `rounded-full` are each one class away from breaking it, and there is
 * nothing legitimate to lay out on a link that is off-screen at rest.
 */
export interface SkipLinkProps {
  /**
   * The id of the element focus jumps to — `content`, not `#content`. It must
   * exist on the page; see the block above for why the type cannot say so.
   */
  target: string
  /** What the link says. A sentence, since it is read aloud before anything else
      on the page: "Skip to the specimens", not "Skip". */
  children: ReactNode
  /** Refused — see the block above. Every way this mark can break is a class. */
  className?: never
  /** Refused: an inline declaration outranks every rule in every layer. */
  style?: never
}

export function SkipLink({ target, children }: SkipLinkProps) {
  return (
    /* `skip` is the only class, and the element is a real anchor: the kernel
       selects `.skip:focus`, and a <button> would be focusable but would move
       focus nowhere without script. */
    <a className="skip" href={`#${target}`}>
      {children}
    </a>
  )
}

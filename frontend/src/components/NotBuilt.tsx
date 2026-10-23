import type { ReactNode } from 'react'

/**
 * NOT-BUILT — the hatch, ported.
 *
 * 🛑 THIS IS THE ONLY CONTROL BETWEEN A MOCKUP AND A PROCUREMENT CONVERSATION,
 * and it has failed three distinct ways. The component answers all three
 * STRUCTURALLY rather than by remembering:
 *
 *   1. IT DIED TO A `background:` SHORTHAND. Answered by the kernel's doubled
 *      `.nb.nb` rule AND by where this bridge puts the kernel — unlayered, after
 *      Tailwind. Nothing in this file paints a background, so there is no second
 *      place for the treatment to be lost. See frontend/src/bridge.css §1.
 *   2. ITS MARKS CARRIED THE CONSTANT WORD "not built" RATHER THAN THE REFUSING
 *      DECISION. Answered by `data-nb` — the kernel renders it through
 *      `content: attr(data-nb)` — now reading `not built · G200` rather than
 *      `not built`. The plate names the decision, and the plate is the half that
 *      survives greyscale printing.
 *   3. A THIRD OF THEM HAD NO REASON WITHIN REACH. Answered on two axes, and
 *      BOTH are needed because each answers half. The TYPE requires `refusedBy`
 *      and `why`, so a mark with no reason does not compile — but that forces the
 *      string to EXIST, not to be WITHIN REACH, and "within reach" is the wording
 *      of the failure. What answers the other half is that the reason is RENDERED
 *      AS VISIBLE TEXT, below, and the bridge test reads it out of `textContent`.
 *
 * 🛑 THIS COMPONENT ALSO EMITTED `data-nb-why`, AND REMOVING IT IS A REPAIR, NOT
 * A TIDY-UP. The reason went to the DOM twice — once as visible text, once as
 * that attribute — and the assertion read the two concatenated, so EITHER ALONE
 * satisfied it. Proved by mutation rather than argued: with the visible `<small>`
 * deleted and the attribute left in place, `npm run check` stayed fully green.
 * A control that passes while asserting nothing is `docs/HANDOFF.md` §5.6, and it
 * had arrived inside the slice built to close this very failure. The attribute
 * had no reader — the kernel draws its plate from `data-nb` — so one line removes
 * it and binds the assertion to the half a person can actually see. Re-verified
 * in both directions: attribute gone AND `<small>` gone is RED with exactly one
 * failure; attribute gone with `<small>` intact is green.
 *
 * ⚠️ THE REASON IS RENDERED AS TEXT, NOT AS A TOOLTIP, AND THAT IS DELIBERATE.
 * `title="…"` is the obvious way to attach a sentence to a mark and it is
 * hover-only, which G189 forbids — tooltips must be reachable by focus AND tap.
 * Visible text needs no affordance at all, so the rule is satisfied by not
 * reaching for the pattern it governs.
 */

/**
 * A G row from `docs/HANDOFF.md` §3 — `G200`, not a sentence.
 *
 * ⚠️ WHAT THIS TYPE ACTUALLY CATCHES, stated so nobody over-reads it: it rejects
 * PROSE where a decision was required. It does not verify the row EXISTS —
 * `G9999` type-checks. Cheap and worth having anyway: every recorded instance of
 * the third failure is a mark with no decision named, not a mark citing a
 * decision that turned out to be fictional.
 */
export type GRow = `G${number}`

/**
 * 🛑 `style` IS REFUSED BY THIS TYPE, AND THE REFUSAL IS THE LAST FENCE AROUND
 * FAILURE 1. Measured on the built page, not reasoned about: `bg-white`,
 * `bg-none` and `bg-linear-to-r` all leave the hatch standing, and so does an
 * unlayered `<style>.nb{background:#fff}</style>` — but
 * `element.style.background = '#fff'` ERASES IT. An inline declaration outranks
 * every rule in every layer; the unlayered kernel cannot win that one, and no
 * arrangement of `@layer` can be chosen to make it. (`!important` on the hatch
 * would, and that is a KERNEL edit, deliberately not made in this slice.)
 *
 * So what closes it here is the API surface: the props below are the whole
 * surface, this component spreads NO rest props onto the div, and `style?: never`
 * makes the refusal a named declaration rather than an accident of excess-
 * property checking. `npm run typecheck:frontend` is in `npm run check`, so a
 * caller reaching for an inline background does not compile.
 *
 * ⚠️ THE IDIOMATIC GROWTH PATH RE-OPENS IT SILENTLY. Adding `...rest` to the div,
 * or a `style?: CSSProperties` for one caller's margin, restores failure 1 in a
 * register NO ASSERTION ON THE SPECIMEN COVERS — its four marks carry no inline
 * style, so the suite would stay green while every refused feature in the product
 * rendered as an ordinary one. Deleting the line below is that act. Do not.
 */
export interface NotBuiltProps {
  /** The decision that refused this feature. Required — see failure 3 above. */
  refusedBy: GRow
  /** Why it was refused, in the decision's own terms. Required. */
  why: string
  children: ReactNode
  /** Utility classes for layout. The kernel owns the treatment; this owns the box. */
  className?: string
  /** Refused, not forgotten — see the block above. An inline background is the
      one attacker the unlayered kernel cannot outrank, and it is measured LOST. */
  style?: never
}

export function NotBuilt({ refusedBy, why, children, className }: NotBuiltProps) {
  return (
    <div
      /* `nb` FIRST. The ONE LINE / ONE DOT detectors in tests/design/ label a mark
         by its element's first class, and the hatch's own rule is `.nb.nb`. */
      className={className === undefined ? 'nb' : `nb ${className}`}
      data-nb={`not built · ${refusedBy}`}
    >
      {children}
      {/* `nbwhy` FIRST, and it carries NO CSS — it is a HANDLE, not a treatment.
          The reason is already visible text and the kernel already draws the
          plate from `data-nb`; what was missing was a way for an assertion to
          say "the reason belonging to THIS mark" rather than reading the whole
          subtree's `textContent` and accepting any sentence in it. That looser
          read is how `data-nb-why` passed while asserting nothing — see the
          block above. */}
      <small className="nbwhy text-micro text-muted block">
        {refusedBy} — {why}
      </small>
    </div>
  )
}

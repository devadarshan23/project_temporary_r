import type { ReactNode } from 'react'

/**
 * THE LUMINOUS TOUCH — `.lit` / `.lit--running`, ported. AI has shone light on
 * an object: A SOURCE WITH FALLOFF, NEVER A FLAT FILL.
 *
 * 🛑 THIS IS THE HATCH'S FAILURE ONE CLASS OVER, AND THE KERNEL SAYS SO AGAINST
 * ITSELF: *"THIS GUARDS .nb ONLY, AND THE SIBLING EXPOSURE IS REAL … both are
 * erasable by the same local shorthand."* On 16 Aug 2026 three of nine `.lit`
 * elements were rendering with the light GONE and looking perfectly ordinary —
 * a panel that goes on saying "worked on" while nothing says it. The kernel now
 * splits the declaration: `.lit` carries what is not a background and `.lit.lit`
 * carries the paint, so a (0,1,0) `background:` shorthand can no longer reach
 * it. THAT DEFENCE IS SPECIFICITY, AND CASCADE LAYERS ARE RESOLVED BEFORE
 * SPECIFICITY — so it holds here only because bridge.css imports the kernel
 * UNLAYERED. Adding `layer(base)` to that import erases this light and the hatch
 * together, silently. `frontend/src/bridge.css` §1 is the measurement.
 *
 * 🛑 THREE THINGS A PORT LOSES WITHOUT NOTICING, all of them measured against
 * the built page rather than reasoned about:
 *
 *   1. THE FALLOFF. A flat fill and a source are four characters apart in a
 *      gradient and a whole idea apart on the page — and a `radial-gradient`
 *      with an OPAQUE outer stop is a fill wearing a source's shape. Nothing
 *      here spells a gradient: the light is `--lit-hot` → `--lit-mid` →
 *      `--lit-out`, declared once, in the kernel. A component that spelled it —
 *      the obvious move, since no utility framework can express it — would hold
 *      its own copy of the light.
 *   2. THE COUNT. *"Never on more than one thing per view — one light is
 *      legible, six lights are wallpaper."* A component makes a second one
 *      cheap. This is a page-level property and no component can hold it; it is
 *      asserted against the built page in more-primitives.test.ts §4.
 *   3. THE SWEEP'S GUARD. `.lit--running::after` is the living edge — one slow
 *      pass per 17s with 88% of the cycle at rest, and *"do not speed it up: a
 *      faster pass was built, read as a marquee, and was slowed deliberately"*.
 *      Its `prefers-reduced-motion` guard is the kernel's, at the foot of that
 *      file, and it stops the SWEEP while leaving the LIGHT standing. Six files
 *      once wrote six versions of that guard; this one writes none.
 *
 * 🛑 `focusable` PUTS THE PANEL IN THE TAB ORDER, AND IT IS THE PROP THAT FOUND
 * A KERNEL DEFECT. Until 17 Aug 2026 a focused `.lit` had NO FOCUS INDICATOR AT
 * ALL: `.lit`'s own inset edge and `:focus-visible`'s ring are both (0,1,0),
 * box-shadow does not accumulate across rules, and `outline:none` had already
 * removed the fallback — so the edge replaced the ring and left nothing. That is
 * WCAG 2.2 AA 2.4.7 failing on exactly the element a keyboard user is likeliest
 * to be tabbing to, because the design record puts this class on run cells that
 * ARE buttons — derive them, never cite a line into a moving file:
 * `grep -rn 'button[^>]*class="[^"]*\blit\b' design/system/*.html design/routes/*.html`
 * returns four. The repair is the kernel's
 * — `.lit:focus-visible` re-asserting the ring alongside the edge, composed from
 * `--focus-ring` — and NOT this component's. A component that restated the ring
 * would have hidden the defect behind a seventh spelling of it.
 *
 * ⚠️ AND `focusable` IS A CLAIM ABOUT REACHABILITY, NOT AN AFFORDANCE. It adds a
 * tab stop so a keyboard user can reach the thing the machine is working on and
 * read it. It does NOT render a `<button>`: the specimen mounts no operation
 * (G200 freezes serving at four of seventy-two), and a control that cannot act
 * is a fabricated affordance. The tension is worth naming rather than hiding —
 * a live region that is also a tab stop is unusual — but `role="status"` is what
 * the design record itself puts on a lit panel, and the alternative was a button
 * that does nothing. Derive the record's own usage:
 * `grep -rn 'class="[^"]*\blit\b[^"]*"[^>]*role="status"' design/system/*.html
 * design/routes/*.html`
 */
export interface LuminousProps {
  /**
   * Whether the machine is working on it RIGHT NOW. `true` adds the sweep and
   * announces the panel; `false` is a lit thing at rest.
   *
   * ⚠️ NOT A PROGRESS PROP, and there is deliberately no way to make it one.
   * There is no fraction, no elapsed time and no step count here: the sweep says
   * WORKING, never HOW FAR. A bar that said how far would be a second line.
   */
  running: boolean
  /** What the machine is working on — and the WORD that carries the state, since
      no state may depend on a light. */
  children: ReactNode
  /** Adds a tab stop. See the block above: it is reachability, not an action. */
  focusable?: boolean
  /**
   * Utility classes for layout. The kernel owns the treatment; this owns the
   * box. The collision is narrow and exact: the kernel declares no padding on
   * `.lit`, so `p-4` reaches it, while `bg-*` loses to `.lit.lit` — which is
   * the property the specimen carries `bg-linear-to-r` to witness.
   */
  className?: string
  /** Refused. An inline declaration outranks every rule in every layer, so
      `style={{ background: '#fff' }}` is the one attacker the unlayered kernel
      cannot beat — the same refusal, for the same measured reason, as NotBuilt. */
  style?: never
}

export function Luminous({ running, children, focusable, className }: LuminousProps) {
  /* `lit` FIRST. The ONE LINE / ONE DOT detectors in tests/design/ label a mark
     by its element's first class, and both of the kernel's guards on this mark
     are doubled-class rules. */
  const classes = ['lit']
  if (running) classes.push('lit--running')
  if (className !== undefined) classes.push(className)

  return (
    <div
      className={classes.join(' ')}
      {...(running ? { role: 'status' } : {})}
      {...(focusable === true ? { tabIndex: 0 } : {})}
    >
      {children}
    </div>
  )
}

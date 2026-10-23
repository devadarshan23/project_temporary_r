/**
 * THE FOUR BEHAVIOURS, SPELLED ONCE — G247.
 *
 * 🛑 THIS MODULE EXISTS BECAUSE THE RULING IS ABOUT DIVERGENCE, NOT ABOUT TIDINESS.
 * `design/system/overlays.html` and its four sibling sheets built the drawer, the
 * modal, the tooltip and the toast FIVE ways — five wrappers, three hide
 * mechanisms, four open-state attributes — and G189's row records that the
 * tooltip's forks were not cosmetic: three of the five files shipped a
 * `display:none` panel that took every `aria-describedby` reason out of the
 * accessibility tree, and three shipped a `:focus-visible` selector that made
 * Escape clear an attribute while the panel stayed painted. Both are behaviours
 * that look identical in a screenshot and differ only for the keyboard and
 * screen-reader users the rules were written for.
 *
 * So the four behaviours below are written HERE and nowhere else, and each of the
 * four surfaces declares which of them it takes:
 *
 *   FOCUS TRAP     drawer · modal          Tab and Shift+Tab cycle inside.
 *   ESCAPE         all four                Escape dismisses.
 *   SCROLL LOCK    drawer · modal          the page behind does not scroll.
 *   RETURN FOCUS   drawer · modal · toast  focus goes back where it came from.
 *
 * ⚠️ THE TOOLTIP TAKES ESCAPE AND NOT RETURN-FOCUS, AND THAT IS THE WHOLE POINT
 * OF LISTING THEM PER SURFACE RATHER THAN APPLYING FOUR EVERYWHERE. A tooltip
 * never moved focus, so "restoring" it would MOVE focus on Escape — and WCAG 2.2
 * 1.4.13 requires the opposite: dismissible without moving the pointer and
 * without moving focus. A shared primitive that applied all four uniformly would
 * have introduced that bug in the one surface the rule is about.
 *
 * ⚠️ AND THIS FILE IS FRAMEWORK-FREE ON PURPOSE. It is plain TypeScript with no
 * React import, for two reasons that are both load-bearing:
 *   · `tests/tsconfig.json` is `"include": ["**\/*.ts"]` and node strips types but
 *     does NOT transform JSX, so a `.tsx` module cannot be imported by a test at
 *     all. Every behaviour worth asserting in node lives in a `.ts` file.
 *   · A behaviour keyed to a component is a behaviour that gets re-implemented
 *     the first time somebody needs it outside one. That is the defect G247
 *     names.
 */

/**
 * THE FOCUSABLE SELECTOR, SPELLED ONCE.
 *
 * 🛑 THIS IS THE SINGLE MOST COPY-PASTED STRING IN ANY OVERLAY IMPLEMENTATION AND
 * IT IS WHY THEY DIVERGE. Two traps built from two spellings of this selector
 * differ only at the edges — a `summary`, a `[contenteditable]`, an
 * `[aria-disabled="true"]` button — and the edges are exactly where a keyboard
 * user gets stuck.
 *
 * ⚠️ `[aria-disabled="true"]` IS DELIBERATELY INCLUDED AND `[disabled]` IS
 * DELIBERATELY EXCLUDED, and the asymmetry is the tooltip ruling arriving in the
 * trap. G189's hard condition is that a refused control keeps its place in the
 * tab order so its reason stays reachable; a control carrying the `disabled`
 * ATTRIBUTE is removed from the tab order by the browser and its tooltip is
 * unreachable by keyboard BY CONSTRUCTION. So `aria-disabled` controls are
 * trapped like any other control, and `disabled` ones are not focusable for the
 * browser either — the selector agrees with the browser rather than second-
 * guessing it.
 *
 * ⚠️ `tabThrough()` in `tests/design/render.ts` counts stops with its own
 * near-identical selector. It is NOT imported from here and must not be: that
 * function walks the hand-authored design record, which this module does not
 * govern, and joining them would make a test agree with the code under test by
 * construction.
 */
export const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'

/**
 * Every focusable descendant of `root`, in document order, minus the ones no
 * user can reach.
 *
 * 🛑 `offsetParent === null` IS NOT THE VISIBILITY TEST AND THE OBVIOUS ONE IS
 * WRONG HERE. A `position:fixed` element — which every drawer, modal and toast in
 * this system is — reports `offsetParent === null` while perfectly visible, so
 * the idiomatic check would empty the trap on exactly the four surfaces this
 * module exists for. `getClientRects().length` answers the question actually
 * being asked: does this element generate a box a person could reach.
 */
export function focusablesIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll(FOCUSABLE)]
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .filter((el) => el.getClientRects().length > 0)
}

/**
 * BEHAVIOUR 4 · RETURN FOCUS — captured at open, restored on every close path.
 *
 * 🛑 THE RULING NAMES THIS ONE AS THE REASON THE SLICE IS ONE SLICE: *"Return-
 * focus is the behaviour most often omitted and least often noticed."* It is
 * omitted because nothing looks wrong — the overlay closes, the page is correct,
 * and focus is silently on `<body>`. A keyboard user's next Tab then starts from
 * the top of the document instead of from the control they just used.
 *
 * ⚠️ THE `isConnected` GUARD IS NOT DEFENSIVE PROGRAMMING. The opener is
 * routinely gone by the time the overlay closes — a row that was re-rendered, a
 * toast's own Dismiss button, a control the confirmed act removed. Focusing a
 * detached node silently does nothing AND leaves focus on `<body>`, which is the
 * failure this function exists to prevent, so the fallback is explicit.
 */
export function captureReturnFocus(): () => void {
  const opener = document.activeElement
  return function restore(): void {
    if (opener instanceof HTMLElement && opener.isConnected) {
      opener.focus()
      return
    }
    /* The opener is gone. Focus must still land somewhere a Tab can continue
       from, and `<body>` is not that place. `document.body.focus()` is a no-op
       without a tabindex, so this is stated rather than assumed.

       🛑 THE `tabindex` IS LEFT IN PLACE, AND THE TIDY VERSION UNDOES THE WHOLE
       FUNCTION. This read `setAttribute` → `focus()` → `removeAttribute`, which
       looks like good hygiene and is self-defeating: removing `tabindex` from the
       element that currently HAS focus makes it unfocusable, so the browser blurs
       it immediately and `document.activeElement` returns to `<body>` — the exact
       state this branch exists to avoid. It was measured doing so.
       `tabindex="-1"` adds no tab stop and no announcement; it only means "may be
       focused programmatically", which is permanently true of this element now. */
    const fallback = document.querySelector('main') ?? document.body
    if (fallback instanceof HTMLElement) {
      if (!fallback.hasAttribute('tabindex')) fallback.setAttribute('tabindex', '-1')
      fallback.focus()
    }
  }
}

/**
 * BEHAVIOUR 3 · SCROLL LOCK — reference counted, because overlays stack.
 *
 * 🛑 THE REFERENCE COUNT IS THE WHOLE IMPLEMENTATION AND A NAIVE VERSION IS
 * ACTIVELY WORSE THAN NONE. `overlays.html` stacks an evidence card over an open
 * drawer. Two overlays that each set `overflow:hidden` on open and clear it on
 * close leave the page UNSCROLLABLE when the outer one closes first and
 * SCROLLABLE UNDER THE INNER ONE when the inner one closes first — and neither
 * is visible in review, because both look right in the common case where only
 * one overlay is ever open.
 *
 * ⚠️ THE PREVIOUS VALUE IS RESTORED RATHER THAN CLEARED. Writing `''` on release
 * would delete an `overflow` some other code owns; the count remembers what was
 * there when the FIRST lock was taken.
 */
let scrollLocks = 0
let scrollWas = ''

export function lockScroll(): () => void {
  if (scrollLocks === 0) {
    scrollWas = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLocks += 1
  let released = false
  return function release(): void {
    /* Idempotent: `attachOverlay` disposes from both the explicit close path and
       the unmount path, and a double release would drop the count below zero and
       unlock the page under a still-open overlay. */
    if (released) return
    released = true
    scrollLocks -= 1
    if (scrollLocks === 0) document.body.style.overflow = scrollWas
  }
}

/**
 * MAKE EVERYTHING THAT IS NOT THE OVERLAY INERT, and give back the undo.
 *
 * 🛑 `aria-modal="true"` IS A CLAIM AND THIS IS WHAT MAKES IT TRUE. The attribute
 * asks a screen reader to treat the rest of the page as absent; on its own it
 * does nothing to the tab order, to pointer events, or to a virtual cursor in the
 * browsers that ignore it. A Tab trap alone is not the same guarantee either —
 * it holds the tab ring and leaves every control behind the overlay clickable and
 * readable. `inert` is the property both are reaching for.
 *
 * ⚠️ IT IS APPLIED TO SIBLINGS, NEVER TO AN ANCESTOR OF `root`. `inert` inherits
 * to the whole subtree, so marking a container that CONTAINS the overlay makes
 * the overlay itself inert — which is a keyboard trap over the entire page with
 * nothing focusable anywhere in it. That is not a hypothetical: the drawn design
 * records reaching exactly that state (`<main>` inert with nothing open) by a
 * different route.
 *
 * 🛑 IT WALKS THE ANCESTOR CHAIN AND MARKS SIBLINGS AT EVERY LEVEL. THE OBVIOUS
 * ONE-LEVEL VERSION MARKED NOTHING AT ALL AND WAS MEASURED DOING SO.
 * The first draft iterated `document.body.children` and skipped any child
 * containing `root`. In this application EVERY element is inside `<div id="root">`
 * — React mounts there — so the only body child was the one that contains the
 * overlay, the loop skipped it, and `inertBackground()` marked ZERO elements
 * while returning a perfectly good release function. `tests/design/overlays.test.ts`
 * §1 read `document.querySelector('main').inert` and found `false` with a drawer
 * open. **It is recorded here rather than quietly fixed because it is the shape
 * this whole slice is about: a behaviour that was present, plausible, and doing
 * nothing — and no screenshot would ever have shown it.**
 *
 * ⚠️ AND AN ALREADY-INERT ELEMENT IS LEFT ALONE ON RELEASE. Overlays stack; the
 * card over a drawer would otherwise clear the inert the drawer set.
 */
export function inertBackground(root: HTMLElement): () => void {
  const marked: HTMLElement[] = []
  let node: HTMLElement = root
  while (node !== document.body && node.parentElement !== null) {
    const parent = node.parentElement
    for (const sibling of parent.children) {
      if (sibling === node) continue
      if (!(sibling instanceof HTMLElement)) continue
      if (sibling.inert) continue
      sibling.inert = true
      marked.push(sibling)
    }
    node = parent
  }
  return function release(): void {
    for (const el of marked) el.inert = false
    marked.length = 0
  }
}

/** Which of the four behaviours a surface takes. Every field is required — see
 *  the module header: a surface that does not STATE its answer for each of the
 *  four is a surface that will differ from its siblings by omission. */
export interface OverlayBehaviours {
  /**
   * Tab and Shift+Tab cycle inside `root`, AND everything outside it is `inert`.
   * Drawer and modal: yes.
   *
   * ⚠️ THE TWO ARE ONE FLAG BECAUSE THEY ARE ONE BEHAVIOUR. A trap that holds the
   * tab ring while leaving the page behind clickable and screen-reader-readable
   * is the half-implementation this module exists to stop being written twice.
   */
  readonly trapFocus: boolean
  /** The page behind does not scroll. Drawer and modal: yes. */
  readonly lockScroll: boolean
  /** Focus returns to the opener on close. The tooltip: NO — see the header. */
  readonly returnFocus: boolean
}

export interface OverlayOptions extends OverlayBehaviours {
  /** Called when Escape is pressed. The caller closes; this module never does —
   *  the open state belongs to the component, which is the same "exactly one
   *  writer" rule the kernel states for the tooltip. */
  readonly onDismiss: () => void
}

/**
 * WIRE ONE OVERLAY. Returns the disposer, which is also the restore path.
 *
 * 🛑 ESCAPE IS BOUND ON THE DOCUMENT IN THE CAPTURE PHASE AND THAT IS DELIBERATE.
 * Bound on `root` instead, Escape would be dead whenever focus is not inside the
 * overlay — which is the tooltip's ordinary state, since a tooltip opened by
 * hover leaves focus wherever it was. WCAG 2.2 1.4.13 requires that panel to be
 * dismissible from where the user is standing, so the listener has to be where
 * the user is standing.
 *
 * ⚠️ THE TOPMOST OVERLAY ANSWERS ESCAPE AND NOTHING ELSE DOES. A stack of
 * document-level listeners would otherwise close every open overlay at once — the
 * card AND the drawer under it — which is one keystroke doing two things nobody
 * asked for. The registry below is the ordering, and it is a module-level array
 * rather than a count because "topmost" is a position, not a number.
 */
const stack: Array<() => void> = []

export function attachOverlay(root: HTMLElement, opts: OverlayOptions): () => void {
  const restoreFocus = opts.returnFocus ? captureReturnFocus() : null
  const releaseScroll = opts.lockScroll ? lockScroll() : null
  const releaseInert = opts.trapFocus ? inertBackground(root) : null

  const dismiss = opts.onDismiss
  stack.push(dismiss)

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      /* Only the topmost. `stack` is mutated by dispose(), so this reads the
         live answer rather than one captured at attach time. */
      if (stack[stack.length - 1] !== dismiss) return
      e.stopPropagation()
      dismiss()
      return
    }
    if (e.key !== 'Tab' || !opts.trapFocus) return

    /* BEHAVIOUR 1 · FOCUS TRAP.
       🛑 RE-QUERIED ON EVERY KEYSTROKE, NEVER CACHED AT OPEN. A drawer's content
       arrives asynchronously — `RunDetail` renders "opening…" and then the run —
       so a list captured at open time traps focus among the controls that existed
       before the content did, and the new ones become unreachable. */
    const items = focusablesIn(root)
    const first = items[0]
    const last = items[items.length - 1]
    if (first === undefined || last === undefined) {
      /* An overlay with nothing focusable in it. Focus must not escape to the
         page behind, so it is held on the overlay itself. */
      e.preventDefault()
      root.focus()
      return
    }
    const active = document.activeElement
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !root.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  document.addEventListener('keydown', onKeyDown, true)

  let disposed = false
  return function dispose(): void {
    if (disposed) return
    disposed = true
    document.removeEventListener('keydown', onKeyDown, true)
    const at = stack.lastIndexOf(dismiss)
    if (at !== -1) stack.splice(at, 1)
    if (releaseScroll !== null) releaseScroll()
    /* 🛑 `inert` IS CLEARED BEFORE THE FOCUS CALL AND THE ORDER IS LOAD-BEARING.
       The drawn design states the reason in its own voice: "inert MUST be cleared
       before the focus call — focusing a control inside an inert subtree fails
       SILENTLY, and the restore half of 'trap and restore' would then be a claim
       rather than a behaviour." The opener is, by construction, in the subtree
       this overlay just made inert. */
    if (releaseInert !== null) releaseInert()
    if (restoreFocus !== null) restoreFocus()
  }
}

/**
 * HOW MANY OVERLAYS ARE WIRED. Exported for the assertions only — a leak here is
 * a keyboard trap over the whole page, and the drawn design records reaching
 * exactly that state by keeping a stack that a missed close event desynchronised.
 * A test that can read the count can prove the leak is absent rather than assume
 * it.
 */
export function openOverlayCount(): number {
  return stack.length
}

/**
 * THE SCROLL LOCK DEPTH. Same reason as above: the failure mode is a page left
 * permanently unscrollable, which no screenshot shows.
 */
export function scrollLockDepth(): number {
  return scrollLocks
}

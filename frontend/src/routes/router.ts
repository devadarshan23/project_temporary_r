/**
 * THE ROUTER RUNTIME — history, resolution, and the focus move R10 requires.
 *
 * ┌─ WHY THIS TAKES A HOST INSTEAD OF TOUCHING `window` ──────────────────────┐
 * │ EVERY BROWSER SUITE IN THIS REPOSITORY SKIPS WHEN CHROMIUM IS ABSENT, AND  │
 * │ A PROPERTY WITNESSED ONLY BY A SKIPPED SUITE IS A PROPERTY WITNESSED BY    │
 * │ NOTHING. `tests/design/render.ts` and `tools/skip-census.mjs` both exist    │
 * │ because that failure has already happened here. So the four things a       │
 * │ router needs from a browser — read the pathname, push one, hear a pop,     │
 * │ move focus — are an interface, and `node --test` can drive it with a fake. │
 * │ The real one is `browserHost` at the bottom, structurally typed so this     │
 * │ file compiles under `tests/tsconfig.json`, which has no DOM lib.           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 FOCUS MOVES ON EVERY ROUTE CHANGE AND ON NOTHING ELSE. R10:
 * *"Keyboard first, and the focus ring is never optional. Everything operable is
 * reachable and operable by keyboard; modals and the palette trap focus and
 * restore it on close."* #206 [F-5a] adds *"four close paths, and focus restored
 * on every one"* — **a route change is the fifth path nobody drew**, and it is
 * the one where a single-page application silently differs from a document: the
 * browser moves focus to the top of a new document and moves it nowhere at all
 * when JavaScript swaps the content underneath.
 *
 * 🛑 AND IT DOES NOT MOVE WHEN NOTHING CHANGED. Navigating to where you already
 * are must not steal focus: a stolen focus is worse than an unrestored one,
 * because it interrupts somebody mid-task rather than merely failing to help
 * them. Both halves are asserted in `tests/app/route-table.test.ts` §5.
 *
 * ⚠️ NO REACT HERE. This file is imported by a `node --test` suite; pulling React
 * in would pull JSX's type graph in with it. The React seam is one hook away and
 * is not this slice's — nothing mounts this router yet, and that is stated in
 * the commit rather than hidden by wiring it up.
 *
 * 🛑 NOTHING BELOW KNOWS A SINGLE PATH. Resolution is `table.ts`'s and only
 * `table.ts`'s, so a route cannot be grown here.
 */

import { ROUTE_ROOT_ID, resolve, type Resolution } from './table.ts'

/**
 * THE FOUR THINGS A ROUTER NEEDS FROM A BROWSER.
 *
 * Deliberately four functions rather than a `Window`: an interface a fake can
 * satisfy is an interface a test can witness, and this one is small enough that
 * satisfying it dishonestly is harder than satisfying it honestly.
 */
export interface RouterHost {
  /** Where we are now. */
  readonly pathname: () => string
  /** Go there, adding a history entry. */
  readonly push: (pathname: string) => void
  /** Hear the back and forward buttons. Returns its own unsubscribe. */
  readonly onPop: (fn: () => void) => () => void
  /** Move focus to the element with this id, if it is there. */
  readonly focus: (id: string) => void
}

export interface Router {
  /** The resolution of wherever we are. */
  readonly current: () => Resolution
  /** Go somewhere. A no-op if it is where we already are. */
  readonly navigate: (pathname: string) => void
  /** Hear route changes. Returns its own unsubscribe. */
  readonly subscribe: (fn: (resolution: Resolution) => void) => () => void
  /** Stop listening to history. */
  readonly stop: () => void
}

/**
 * Build a router over a host.
 *
 * ⚠️ CONSTRUCTION IS NOT A ROUTE CHANGE. It resolves where you already are and
 * moves nothing: the first paint has whatever focus the document gave it, and a
 * router that grabbed focus on mount would take it away from a skip link before
 * anybody had pressed a key.
 */
export function createRouter(host: RouterHost): Router {
  let here: Resolution = resolve(host.pathname())
  const listeners = new Set<(resolution: Resolution) => void>()

  /* One place decides that a change happened, so the focus rule and the
     notification rule cannot drift apart. */
  const settle = (): void => {
    const next = resolve(host.pathname())
    if (next.kind === here.kind && key(next) === key(here)) return
    here = next
    for (const fn of listeners) fn(next)
    /* R10. A not-found resolution is still a route change — arriving at a 404
       with focus left behind on the link you came from is the same defect. */
    host.focus(ROUTE_ROOT_ID)
  }

  const unlisten = host.onPop(settle)

  return {
    current: () => here,
    navigate: (pathname: string): void => {
      if (pathname === host.pathname()) return
      host.push(pathname)
      settle()
    },
    subscribe: (fn: (resolution: Resolution) => void): (() => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    stop: (): void => {
      listeners.clear()
      unlisten()
    },
  }
}

/**
 * WHAT A CLICK ON A LINK HAS TO LOOK LIKE BEFORE THIS ROUTER MAY SWALLOW IT.
 *
 * ┌─ WHY A PREDICATE HERE AND NOT AN `onClick` IN A COMPONENT ────────────────┐
 * │ A single-page link is a real `<a href>` that the application CANCELS. Get  │
 * │ the cancellation condition wrong and the failures are silent and specific: │
 * │ ⌘-click and middle-click stop opening a new tab, and a modified click on   │
 * │ one link behaves differently from the same click on another because each   │
 * │ component wrote its own condition. That is a rule living at call sites,    │
 * │ which is the shape `docs/HANDOFF.md` §5 says drifts — so the rule is ONE   │
 * │ pure function, and `tests/app/route-links.test.ts` §3 enumerates it.       │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE EVENT IS A STRUCTURAL INTERFACE, NOT A `MouseEvent`, for the same
 * mechanical reason the host above is four functions: `tests/tsconfig.json`
 * carries `"types": ["node"]` and NO DOM lib, so a suite importing this module
 * could not name the browser's type. React's `MouseEvent` satisfies this shape,
 * so a component may pass one straight in.
 *
 * 🛑 THIS DECIDES NOTHING ABOUT THE TARGET. Whether the href belongs to this
 * application is `table.ts`'s question — `resolve()` answers `not-found` for a
 * pathname the product does not draw — and a caller that hands this a foreign
 * URL has made a mistake one layer up. Adding an origin check here would put a
 * second authority for "is this ours" beside the route table.
 */
export interface NavigationClick {
  /** Something upstream already handled it. */
  readonly defaultPrevented: boolean
  /** `0` is the primary button. `1` is the middle one, and it opens a tab. */
  readonly button: number
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  preventDefault(): void
}

/**
 * May the router take this click?
 *
 * ⚠️ IT DOES NOT CALL `preventDefault()`. Deciding and acting are separate so
 * the decision is witnessable without a spy: a test asserts the boolean, and
 * the one call site does the cancelling.
 */
export function shouldIntercept(event: NavigationClick): boolean {
  if (event.defaultPrevented) return false
  if (event.button !== 0) return false
  /* ⚠️ ALT IS IN THE LIST AND IT IS THE ONE PEOPLE LEAVE OUT. Alt-click is
     "download the target" in every major browser, and swallowing it makes a
     link that cannot be saved — a failure with no error and no symptom. */
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
}

/** Identity of a resolution, for deciding whether anything moved. */
function key(resolution: Resolution): string {
  if (resolution.kind === 'not-found') return resolution.pathname
  const params = resolution.params
  return [resolution.path, ...Object.keys(params).sort().map((k) => `${k}=${params[k]}`)].join('|')
}

/* ── THE REAL HOST ─────────────────────────────────────────────────────────
   Structurally typed rather than typed against `Window` and `Document`, for
   one mechanical reason: `tests/tsconfig.json` carries `"types": ["node"]` and
   no DOM lib, and this module is imported by a test. The real objects satisfy
   these shapes, and a fake in a suite satisfies them too, which is the point. */

interface HistoryLike {
  pushState(state: unknown, unused: string, url: string): void
}

interface WindowLike {
  readonly location: { readonly pathname: string }
  readonly history: HistoryLike
  addEventListener(type: 'popstate', listener: () => void): void
  removeEventListener(type: 'popstate', listener: () => void): void
}

interface DocumentLike {
  getElementById(id: string): { focus(): void } | null
}

/**
 * The browser's answer to `RouterHost`.
 *
 * ⚠️ `focus` IS A NO-OP WHEN THE ELEMENT IS NOT THERE, DELIBERATELY. A route
 * change that happens before the new root has rendered must not throw; it must
 * fail to help, visibly, and the assertion that the root IS rendered lives in
 * the suite rather than in a runtime exception a user would meet as a blank page.
 */
export function browserHost(win: WindowLike, doc: DocumentLike): RouterHost {
  return {
    pathname: () => win.location.pathname,
    push: (pathname: string) => { win.history.pushState(null, '', pathname) },
    onPop: (fn: () => void) => {
      win.addEventListener('popstate', fn)
      return () => { win.removeEventListener('popstate', fn) }
    },
    focus: (id: string) => { doc.getElementById(id)?.focus() },
  }
}

/**
 * THE REACT SEAM — the one hook `router.ts` said was owed, and the one place a
 * link becomes a navigation.
 *
 * ┌─ WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────┐
 * │ `router.ts` closes with *"NO REACT HERE … The React seam is one hook away  │
 * │ and is not this slice's — nothing mounts this router yet, and that is      │
 * │ stated in the commit rather than hidden by wiring it up."* This is that    │
 * │ slice, and the hook lands BESIDE `router.ts` rather than inside it so      │
 * │ that file keeps the property its header is about: a `node --test` suite    │
 * │ can drive the router with a fake host and never load React's type graph.   │
 * │                                                                            │
 * │ ⚠️ THIS FILE IS `.ts` AND CARRIES NO JSX, for the reason `table.ts` states │
 * │ at length: `node --test` strips types and does NOT transform JSX. The      │
 * │ split survives the wiring.                                                 │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 NOTHING HERE KNOWS A PATH, AND NOTHING HERE DECIDES WHAT A PATH MEANS.
 * Resolution is `table.ts`'s; the interception rule is `router.ts`'s; this file
 * joins them to React and adds no third authority.
 */

import { useSyncExternalStore } from 'react'

import { shouldIntercept, type NavigationClick, type Router } from './router.ts'
import type { Resolution } from './table.ts'

/**
 * Where we are, as a React value that re-renders when it moves.
 *
 * ⚠️ `useSyncExternalStore` RATHER THAN `useState` + `useEffect`, AND THE
 * DIFFERENCE IS OBSERVABLE. The effect spelling reads the router AFTER the
 * first paint, so a deep link renders the wrong route for one frame and then
 * corrects itself — which in this application means the register flashing
 * before the finding it was linked to. The store spelling reads the snapshot
 * during render, so the first paint is already the right route.
 *
 * 🛑 THE SERVER SNAPSHOT IS THE SAME FUNCTION, DELIBERATELY. `router.current()`
 * is a pure read of a value the router resolved at construction — it touches no
 * `window` — so a pre-rendered surface and the client agree by construction
 * rather than by a second branch somebody must keep in step.
 */
export function useRoute(router: Router): Resolution {
  return useSyncExternalStore(router.subscribe, router.current, router.current)
}

/**
 * What to spread onto an `<a>` so it navigates in place.
 *
 * 🛑 A REAL `href`, ALWAYS, AND THE CANCELLATION IS THE ADDITION RATHER THAN
 * THE MECHANISM. A `<span onClick>` would navigate and would also: not appear
 * in the tab order, not announce as a link, not open in a new tab, not show a
 * target in the status bar and not survive JavaScript failing to load. R10 —
 * *"Keyboard first, and the focus ring is never optional. Everything operable
 * is reachable and operable by keyboard"* — is satisfied here by using the
 * element the platform already made operable, not by re-implementing it.
 *
 * ⚠️ THE MODIFIER RULE IS `shouldIntercept`'s AND IS NOT RESTATED HERE. See its
 * header: a condition written at each call site is a condition that differs
 * between links, and a ⌘-click that silently stops opening a tab has no error
 * and no symptom.
 */
export interface LinkProps {
  readonly href: string
  readonly onClick: (event: NavigationClick) => void
}

export function linkTo(router: Router, href: string): LinkProps {
  return {
    href,
    onClick: (event: NavigationClick): void => {
      if (!shouldIntercept(event)) return
      event.preventDefault()
      router.navigate(href)
    },
  }
}

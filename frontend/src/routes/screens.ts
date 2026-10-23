/**
 * WHAT A RESOLVED ROUTE RENDERS — the route root, the scope, and the not-found
 * route.
 *
 * ✅ THERE IS A SEAM FOR A SCREEN NOW — G486, 19 Sep 2026 — AND THE PARAGRAPH
 * BELOW IS CORRECTED RATHER THAN DELETED, because its argument is exactly what
 * shaped the seam. *"When a route earns a screen it earns it in its own slice
 * … and this file gains a seam rather than eleven siblings"* is DISCHARGED:
 * the seam is the `Screens` partial mapped type declared below, ONE renderer
 * still, and eleven of the twelve routes still fall through to `scopeOf`. The
 * original follows and nothing in it has stopped being true.
 *
 * ⚠️ **THE SENTENCE ABOVE SAID "eleven of the twelve" AND IS CORRECTED HERE
 * RATHER THAN DELETED — IT WAS ALREADY WRONG BEFORE THIS SLICE AND IN TWO
 * DIRECTIONS AT ONCE.** G1031 gave `/close/run/:runId` a screen on
 * 20 Sep 2026 and the eleven became ten with nothing here following it; G1911
 * then added `/demo` and `/lookup` on 22 Sep 2026, so the twelve became
 * fourteen. **The first half was not this slice's to make stale and is named
 * so this sweep is not read as accounting for both.** Derive BOTH, never read
 * them:
 *
 *   awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' \
 *     frontend/src/routes/table.ts | grep -cE "^  '/"
 *   grep -cE "^    '/[^']*': \(" frontend/src/main.tsx
 *
 * **The ARGUMENT is what matters here and it has not moved**: a route with no
 * screen falls through to `scopeOf`, and the count of which ones is a fact
 * about a tree that every frontend slice changes.
 *
 * 🛑 THERE IS NO SCREEN HERE AND THAT IS THE SLICE. #267 [F-21]: *"the twelve
 * routes need a route table before any of them needs a screen."* Twelve
 * placeholder components, one per route, would be twelve places a thirteenth
 * route could be grown by hand — the exact shape the acceptance criterion
 * forbids when it says *"a route added by hand in a component is a test
 * failure."* So there is ONE renderer, and everything it draws it derives from
 * `ROUTES`. When a route earns a screen it earns it in its own slice, against
 * its own drawing, and this file gains a seam rather than eleven siblings.
 *
 * 🛑 NOTHING BELOW IS HATCHED, AND THE ABSENCE OF THE HATCH IS THE POINT.
 * A route with no screen yet is a GAP; the seventeen enumerated undrawn routes
 * are a GAP; neither is a REFUSAL, and the hatch means *refused* —
 * **G216 as amended**, and **G245**, which minted a separate REFUSED ink step
 * rather than let one mark carry two meanings. `design/routes/index.html` §2
 * says the same thing in its own voice about the same seventeen routes; derive
 * it with `grep -n 'NOT HATCHED, AND THAT IS DELIBERATE' design/routes/index.html`.
 * **A gap is stated in words instead**, which is what "unhatched and ARGUED"
 * means at a keyboard.
 *
 * ⚠️ THIS IS NOT #204 [F-6]'s EMPTY STATE AND MUST NOT BE MISTAKEN FOR IT. That
 * component does not exist in `frontend/src/components/` yet. What every route
 * renders here is its own scope — its path, its plane, the record it is drawn in
 * and (for the twelve the drawn record owns) its tier — plus a sentence saying
 * no operation is mounted for it. When #204 lands, this is the one call site
 * that changes.
 *
 * ⚠️ `createElement` RATHER THAN JSX, THROUGHOUT. `node --test` strips types and
 * does not transform JSX, so a `.tsx` route layer is a route layer whose
 * behaviour can only be witnessed through a browser and a build — and every
 * browser suite in this repository skips when chromium is absent.
 * `tests/app/route-table.test.ts` renders every one of these through
 * `react-dom/server` with no binary, no build and no skip.
 */

import { createElement, type ReactNode } from 'react'

import { ErrorPage } from '../components/ErrorPage.tsx'
import { ROUTE_TITLES } from './surfaces.ts'
import {
  ROUTE_ROOT_ID,
  type BoundParams,
  type Resolution,
  type RoutePath,
} from './table.ts'

/* Re-exported so the markup and the id a route change focuses are reachable
   from one import. It is DECLARED in `table.ts` because `router.ts` needs it
   too and must stay free of React — see that file's header. */
export { ROUTE_ROOT_ID }

/**
 * THE ROUTE ROOT. Programmatically focusable and NOT in the tab order.
 *
 * R10 — *"Keyboard first, and the focus ring is never optional"* — with G240's
 * outline ring, which is the kernel's and is declared once. `tabIndex={-1}` is
 * what lets `router.ts` move focus here on a route change without adding a focus
 * stop nobody measured: a container in the tab order is a stop, and every stop
 * in this repository is measured rather than reviewed.
 */
export function routeRoot(children: ReactNode): ReactNode {
  return createElement(
    'main',
    { className: 'route', ...ROUTE_ROOT_PROPS },
    children,
  )
}

/**
 * NX-01 — THE OWNER'S RULING (4 Oct 2026, G3702): *"… stop the main region
 * taking focus on click."* A `tabindex="-1"` element is the focus target of
 * every pointer press on content that is not itself focusable, so a click
 * anywhere in the work moved focus to `main` — and beside the ultra-tier frame
 * that read as a focus ring around the region. `main` still takes focus from
 * the router's move and from the skip link (neither is a pointer press); a
 * pointer press that would land focus on `main` ITSELF is undone, which is
 * what clicking plain text does on any page with no focusable ancestor.
 *
 * The pointer flag lives for one task: the press's own focus happens in the
 * same task as `pointerdown`, and a click that NAVIGATES moves focus later, in
 * the `click` task, so the router's move is never undone.
 */
let pressing = false

export const ROUTE_ROOT_PROPS = {
  id: ROUTE_ROOT_ID,
  tabIndex: -1,
  onPointerDown: (): void => {
    pressing = true
    setTimeout(() => { pressing = false }, 0)
  },
  onFocus: (e: { readonly target: EventTarget; readonly currentTarget: EventTarget & { blur(): void } }): void => {
    if (pressing && e.target === e.currentTarget) e.currentTarget.blur()
  },
} as const

/**
 * A resolved route with no screen yet — RC-01, 3 Oct 2026.
 *
 * ⚠️ THIS RENDERED THE ROUTE LAYER'S OWN SCOPE UNTIL 3 Oct 2026: the path as a
 * heading, *"Tier 1 · Work · data plane · drawn in design/routes/…, a record
 * deleted under G264"*, and a paragraph about gaps and refusals — on `/`, the
 * page a customer lands on. *"Engineering rationale stays in docs/tests, never
 * on screen"* (the owner's ruling of 2 Oct 2026). The provenance is still the
 * route table's (`ROUTES`) and `tests/app/route-provenance.test.ts` still reads
 * it there; what a PERSON reads is the page's name and one quiet sentence, the
 * pack's empty state, with the way back to the work.
 *
 * 🛑 STILL NO HATCH. A route with no screen is a GAP, not a refusal, and the
 * hatch means refused. The page claims nothing about when it will exist.
 *
 * The bound parameters arrive as a PROP. Nothing here reads a module-level
 * binding, a context or a `window` — #267's third assertion.
 */
function scopeOf(resolution: Resolution): ReactNode {
  if (resolution.kind !== 'route') return null
  return routeRoot(
    createElement(
      'div',
      { className: 'page', 'data-route-scope': resolution.path },
      createElement(
        'header',
        { key: 'head', className: 'head' },
        createElement('span', { className: 'lab' }, ROUTE_TITLES[resolution.path]),
        createElement('h1', null, 'There is nothing to show here yet.'),
        createElement(
          'p',
          { className: 'q' },
          'This page is not available in your workspace yet. Your work is on the register.',
        ),
      ),
      createElement(
        'div',
        { key: 'acts', className: 'acts' },
        createElement('a', { className: 'abtn', href: '/close' }, 'Back to Close'),
      ),
    ),
  )
}

/**
 * THE NOT-FOUND ROUTE.
 *
 * 🛑 IT RENDERS NO HATCH, IN EITHER SPELLING, AND THAT IS THE BEHAVIOURAL
 * ASSERTION THIS SLICE CARRIES. The obvious implementation reaches for the mark
 * that every unbuilt control on all five drawn route files already uses, and
 * `design/routes/index.html` §2 refuses it by name for exactly these routes:
 * hatching them *"would put a second vocabulary into the one mark whose value is
 * that it has only one."* An undrawn route is neither refused nor built. It is
 * simply not here.
 *
 * ⚠️ IT NAMES THE PATHNAME AND CLAIMS NOTHING ABOUT IT. It does not say the
 * route is coming, is planned, or is unfinished — three sentences a reader would
 * treat as a roadmap, and none of which this application is in a position to
 * promise.
 *
 * ✅ AND SINCE 2 Oct 2026 IT IS E1's 404 — G3049. It rendered a heading, *"No
 * such route"*, and *"`/x` is not one of the N routes this application has"*,
 * under the signed-in chrome bar. The pack draws this state:
 * `docs/handoff-pack/E1 Errors.dc.html`, *"404 · nothing at this address"*, on
 * the public shell. Both properties above survive the move — E1's 404 carries
 * no hatch, names the address as the thing to quote, and says nothing about
 * whether anything will ever answer there.
 */
function notFound(pathname: string): ReactNode {
  return routeRoot(createElement(ErrorPage, { code: '404', quote: pathname }))
}

/**
 * THE SEAM THIS FILE'S HEADER PREDICTED, ARRIVING.
 *
 * ┌─ *"this file gains a seam rather than eleven siblings"* ──────────────────┐
 * │ A PARTIAL MAPPED TYPE OVER `RoutePath`, and the two halves of that are     │
 * │ both load-bearing:                                                         │
 * │                                                                            │
 * │  · MAPPED OVER `RoutePath`, so a key that is not in `ROUTE_PATHS` is a     │
 * │    compile error (`TS2353`). An application cannot grow a route by         │
 * │    supplying a screen for it — which is the acceptance criterion           │
 * │    *"a route added by hand in a component is a test failure"* surviving    │
 * │    the thing that made it testable in the first place.                     │
 * │  · PARTIAL, deliberately, and NOT total. MOST of the routes have no       │
 * │    screen today and a total record would force a placeholder for each —    │
 * │    exactly the *"twelve places a thirteenth route could be grown by hand"* │
 * │    this file was written to refuse. An absent key falls through to         │
 * │    `scopeOf` below, which states the gap in words.                         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ A SCREEN TAKES `BoundParams` AND NOT `ParamsOf<P>`. The mapped type could
 * carry the per-path parameter shape, and it deliberately does not: the value
 * would have to be read out of a record keyed on a generic `P`, which needs the
 * cast `hrefOf` refuses at its own signature. A screen that wants its
 * parameters typed asks for them at ITS boundary; the map's job is to keep the
 * KEY set closed, and it does that with no cast at all.
 */
export type Screens = {
  readonly [P in RoutePath]?: (params: BoundParams) => ReactNode
}

export interface RouteViewProps {
  readonly resolution: Resolution
  /**
   * Absent on any surface with no screens — the specimen, a test of the scope
   * renderer — and `exactOptionalPropertyTypes` makes absent and `undefined`
   * different things, so callers spread it conditionally.
   */
  readonly screens?: Screens
}

/**
 * THE ONE ENTRY POINT. A pure function of the resolution it is handed.
 *
 * ⚠️ IT IS CALLED AS A FUNCTION BY THE SUITE, so it must stay free of hooks. A
 * hook here would make the whole route layer unwitnessable outside a renderer,
 * which is the cost the `.ts`/JSX split was taken to avoid.
 */
export function RouteView({ resolution, screens }: RouteViewProps): ReactNode {
  if (resolution.kind !== 'route') return notFound(resolution.pathname)
  const screen = screens?.[resolution.path]
  /* 🛑 THE ROUTE ROOT IS APPLIED HERE AND NOWHERE ELSE, WHICH IS THE WHOLE
     POINT OF PUTTING THE SEAM AT THIS FUNCTION RATHER THAN AT THE CALLER. If
     each screen wrapped itself, `id="route-root"` would be a thing twelve
     future files must remember — and R10's focus move is silent when it is
     forgotten, because `browserHost.focus()` is a deliberate no-op on a
     missing element. A rule nobody can forget beats a rule nobody breaks. */
  return screen === undefined
    ? scopeOf(resolution)
    : routeRoot(screen(resolution.params))
}

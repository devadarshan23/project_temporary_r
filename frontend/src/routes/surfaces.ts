/**
 * SIGNED-OUT SURFACES AND PAGE TITLES — G3041–G3044, 2 Oct 2026.
 *
 * 🛑 THE DEFECT THIS ENDS WAS MEASURED ON STAGING, SIGNED OUT, AND IT WAS TWO
 * DEFECTS WEARING ONE SYMPTOM. Every page a visitor loaded — `/signin`, the
 * callback, `/demo`, `/lookup`, an unknown path — rendered the signed-in chrome
 * bar (entity switcher, Close / Ask / Reports, the account menu) AND fired
 * `GET /v1/runs` and `GET /v1/exceptions`, which the plane answered 401 on every
 * load. `main.tsx` mounted the bar and both reads unconditionally, so a person
 * with no session was shown the controls of a product they had not entered and
 * the plane was asked for a register nobody could see.
 *
 * WHICH SURFACES ARE SIGNED OUT IS DERIVED FROM THE ROUTE TABLE, NEVER LISTED.
 * A second list of paths beside `ROUTE_PATHS` is a second authority for one
 * fact (§5.3); the table already says it twice over — a `public` PLANE, or the
 * drawn record's `Entry` TIER. An unknown path is signed out as well, because
 * the 404 is drawn on the public shell: *"Six states, drawn on the public shell
 * because that is the shell that survives when the application does not."*
 * (`docs/handoff-pack/E1 Errors.dc.html`).
 *
 * ⚠️ THIS IS A RENDERING DECISION AND NOT AN AUTHORISATION ONE. Hiding the bar
 * refuses a visitor nothing the plane would have given them — every read behind
 * it is gated on the server — and showing it would not have granted anything.
 * What it buys is that the page stops claiming a session exists.
 */
import { ROUTES, type Resolution, type RoutePath } from './table.ts'

/** True when the route is drawn on the public shell: no chrome bar, no register read. */
export function isSignedOutSurface(resolution: Resolution): boolean {
  if (resolution.kind !== 'route') return true
  const spec = ROUTES[resolution.path]
  if (spec.plane === 'public') return true
  return spec.kind === 'drawn_record' && spec.tier === 'Entry'
}

/** The product's name as it appears after the separator in every title. */
export const PRODUCT_TITLE = 'ReconcileAI'

/**
 * One title per route, TOTAL over `RoutePath`, so a seventeenth route is a
 * `TS2741` here rather than a tab that says what the previous page said.
 *
 * ⚠️ `index.html` SAID *"ReconcileAI — kernel primitives"* ON EVERY PAGE until
 * this commit — the specimen's title, left in the client entry. A tab named
 * after a design-system specimen is a page telling a person they are somewhere
 * else.
 */
export const ROUTE_TITLES: { readonly [P in RoutePath]: string } = {
  '/': PRODUCT_TITLE,
  '/signin': 'Sign in',
  '/signin/lapsed': 'Signed out',
  '/signin/callback': 'Completing sign-in',
  '/invite': 'Invitation',
  '/close': 'Close',
  '/close/run/:runId': 'Run',
  '/close/run/:runId/refused': 'Run refused',
  '/close/finding/:ref': 'Finding',
  '/close/finding/:ref/confirm': 'Confirm a finding',
  '/close/finding/:ref/post': 'Post a finding',
  '/ask': 'Ask',
  '/reports': 'Reports',
  '/setup': 'Setup',
  '/partner/deals': 'Deals',
  '/partner/sandbox': 'Sandbox',
  '/partner/people': 'People',
  '/demo': 'Book a demo',
  '/lookup': 'Find your sign-in',
}

/** E1's 404 heading — `kind: '404 · nothing at this address'`. */
export const NOT_FOUND_TITLE = 'Nothing at this address'

/** `Sign in · ReconcileAI`; the bare product name for the entry route. */
export function titleOf(resolution: Resolution, override: string | null = null): string {
  const page =
    override ?? (resolution.kind === 'route' ? ROUTE_TITLES[resolution.path] : NOT_FOUND_TITLE)
  return page === PRODUCT_TITLE ? PRODUCT_TITLE : `${page} · ${PRODUCT_TITLE}`
}

/**
 * THE PARTNER PORTAL'S SIGN-IN, FROM A HOST THAT IS NOT IT — G3045.
 *
 * 🛑 A PARTNER MUST SIGN IN AT THE PARTNER HOST, AND THE REASON IS G180 RATHER
 * THAN TIDINESS. A session is bound to the host the browser used, so a partner
 * who signs in on a tenant host or on the staff console holds a session for the
 * wrong surface — and `checkHostBinding()` revokes it the first time it is
 * presented anywhere else.
 *
 * ⚠️ IT IS DERIVED FOR THE ONE SHAPE WHERE THE ANSWER IS CERTAIN AND REFUSED
 * EVERYWHERE ELSE. G297 puts the two consoles FLAT, one label each on one apex
 * (`console.` and `partners.`), so on a console host the partner host is the
 * same name with its first label swapped. A tenant host carries a region label
 * and may be a customer's own domain under BYOA, and guessing a partner host
 * from one is a parse G179 refuses for the server's own resolution — so it
 * answers `null` and the page says where to go rather than linking somewhere
 * invented. This is a LINK, not a resolution: the plane still resolves the host
 * by lookup and binds the session to it.
 */
export type PartnerSignIn =
  | { readonly kind: 'here' }
  | { readonly kind: 'elsewhere'; readonly href: string }
  | { readonly kind: 'unknown' }

export function partnerSignIn(hostname: string, port = ''): PartnerSignIn {
  const host = hostname.toLowerCase()
  if (host.startsWith('partners.')) return { kind: 'here' }
  if (!host.startsWith('console.')) return { kind: 'unknown' }
  const rest = host.slice('console.'.length)
  if (rest === '') return { kind: 'unknown' }
  const suffix = port === '' ? '' : `:${port}`
  return { kind: 'elsewhere', href: `https://partners.${rest}${suffix}/signin` }
}

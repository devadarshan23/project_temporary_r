/**
 * CSRF — ONE PLACE, AT THE TRANSPORT, FOR EVERY STATE-CHANGING REQUEST A
 * BROWSER AUTHENTICATES ON ITS OWN. G3231–G3236, 2 Oct 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THIS FILE EXISTS: G3212 WAS RIGHT AND WAS SCOPED TO ONE OPERATION.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `session-cookie.ts` states what `SameSite=Lax` buys: a cross-SITE `POST`
 * does not carry `__Host-reconcile_session`. **It does not cover a same-SITE
 * sibling.** `evil.us-west-2.reconcileai.app`, any OTHER tenant's host, and
 * `console.reconcileai.app` are all same-site with a tenant host, and a form
 * `POST` with `Content-Type: text/plain` needs no CORS preflight. The `__Host-`
 * prefix stops a sibling SETTING the cookie; it does not stop a sibling's page
 * making the victim's browser SEND it here.
 *
 * G3212 closed that for D1 alone, inside `resolveTenantContextHandler()`, and
 * said so on its own row: *"⚠️ SCOPED TO D1: `assignException` (a `PUT`) and
 * the other cookie-authenticated writes do not carry it — owed, and the
 * authenticator is the right home."* Measured at the commit before this one,
 * that left **every other cookie-authenticated non-safe operation the plane
 * mounts** reachable from a sibling host — `assignException`,
 * `proposeResolution`, `decideApproval`, `executeProposal`,
 * `reverseResolution`, `admitRun`, `grantRoleAssignment`, the endpoint writes,
 * the onboarding writes, `signOut`. `decideApproval` is the one to read twice:
 * four eyes counted from a click the second pair of eyes never made.
 *
 * 🛑 A PER-HANDLER CHECK IS THE REJECTED SHAPE (§5.3). Twenty handlers each
 * remembering one predicate is twenty places it can be forgotten, and the
 * next mount is the twenty-first. **The predicate is now asked ONCE, by the
 * `onRequest` hook in `server/http/app.ts`, keyed on a fact the ROUTE carries
 * from the CONTRACT** — so a new mount cannot skip it without editing the
 * document that declares the operation. `tests/http/cross-origin-writes.test.ts`
 * is the census that makes the exemptions enumerable.
 *
 * ┌─ WHICH REQUESTS ───────────────────────────────────────────────────────────┐
 * │ `refusesCrossOrigin(spec)` is three terms, all read off the RouteSpec:      │
 * │                                                                            │
 * │  · NOT A SAFE METHOD. GET, HEAD and OPTIONS change nothing (RFC 9110 §9.2.1 │
 * │    — and no mounted GET writes; a state-changing GET would be its own       │
 * │    defect). A cross-origin GET's RESPONSE is unreadable to the page that    │
 * │    started it (no CORS is configured anywhere), and a top-level GET         │
 * │    NAVIGATION from another origin is exactly how a person arrives from the  │
 * │    broker or from a link, so refusing it would break sign-in.               │
 * │  · `secured`. An operation declaring `security: []` reads no credential at  │
 * │    all — `sessionCookieFrom()` is called by the session READER, and the     │
 * │    reader runs only on a secured route — so there is no ambient credential  │
 * │    for a forged request to borrow. That is `resolveHomeRealm`,              │
 * │    `beginFederatedSignIn` and `completeFederatedSignIn`: the first is       │
 * │    REACHED cross-origin by design (the apex's Amplify rewrite, G1966), and  │
 * │    the last is the broker's return leg.                                    │
 * │  · `callerMayBeAPerson(spec.caller)`. A person carries the COOKIE, which a  │
 * │    browser attaches by itself; a machine carries SigV4 in `Authorization`, │
 * │    which a browser never attaches to anything. `mixed` and `unclassified`  │
 * │    are treated as a person — the fail-closed polarity that predicate        │
 * │    already has for the fourth fence.                                       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE DEV `X-Session` CHANNEL IS NOT EXEMPT AND NEEDS NO EXEMPTION. Behind
 * `RECONCILE_LOCAL_TEST_AUTH` the reader accepts the handle from a header as
 * well; a browser cannot add a custom header to a cross-origin request without
 * a preflight this plane never answers, and a non-browser caller sends neither
 * of the two headers below, so it passes. Refusing a request a browser marked
 * foreign costs that channel nothing.
 *
 * ⚠️ ALB HEALTH (`checkLocalHealth`) IS A GET ON AN UNSECURED, MACHINE-FACING
 * TIER, so it fails all three terms and is never asked.
 */
import type { FastifyRequest } from 'fastify'

import { callerMayBeAPerson, type CallerKind } from '../contract/capability.ts'

/** RFC 9110 §9.2.1. Exactly the three methods the contracts can declare that are safe. */
export const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Must this route refuse a request a browser marks as started elsewhere?
 * Read once per route, at registration, by `mountTier()` — never per handler.
 */
export function refusesCrossOrigin(spec: {
  readonly method: string
  readonly secured: boolean
  readonly caller: CallerKind
}): boolean {
  return !SAFE_METHODS.has(spec.method) && spec.secured && callerMayBeAPerson(spec.caller)
}

/**
 * Did a browser mark this request as started by another origin? G3212's
 * predicate, MOVED here from `server/data-plane/context.ts` unchanged.
 *
 * `Sec-Fetch-Site` and `Origin` are forbidden header names — page script
 * cannot set either — so they report what the BROWSER knows about who started
 * the request.
 *
 * 🛑 THE `Origin` COMPARISON IS `new URL(origin).host === Host`, NEVER A
 * SUBSTRING AND NEVER A SUFFIX. `https://ten-acme.example.evil.test` ends with
 * nothing useful and starts with something misleading; `URL.host` is the
 * scheme-free authority, port included, which is what `Host` carries. A
 * malformed `Origin` (including the literal `null` a sandboxed frame sends)
 * is treated as foreign, because "unparseable" is not "same".
 *
 * ⚠️ ABSENT HEADERS PASS, DELIBERATELY. CSRF needs a browser and every browser
 * that implements `SameSite` sends `Origin` on a non-GET; a client with neither
 * header is a script holding the handle, and a script holding the handle needs
 * no forgery. Refusing on absence would refuse every non-browser caller and
 * protect no browser.
 */
export function startedElsewhere(request: FastifyRequest): boolean {
  const site = request.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin') return true
  const origin = request.headers.origin
  if (origin === undefined) return false
  const host = typeof request.headers.host === 'string' ? request.headers.host : ''
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

/**
 * The refusal's `detail`. A constant — `errors.yaml` forbids request-derived
 * text there, and naming the Origin back would tell a probing page which of
 * its two headers gave it away.
 */
export const CROSS_ORIGIN_DETAIL =
  'A browser marked this request as started by a different origin. The session cookie it ' +
  'carried was attached by the browser, not presented by the caller, so it is not honoured.'

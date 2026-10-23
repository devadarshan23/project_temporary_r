/**
 * THE SESSION HANDLE'S DELIVERY CHANNEL — G386, 19 Sep 2026, AND THIS FILE IS
 * THE WHOLE OF IT.
 *
 * ┌─ THE RULING, IN ITS OWN WORDS ─────────────────────────────────────────────┐
 * │ *"`Set-Cookie`, `HttpOnly` `Secure` `SameSite=Lax`, on the tenant host, in  │
 * │ production. Page script cannot read it, so the exfiltration class           │
 * │ `frontend/src/api/plane.ts`'s origin allowlist exists to guard STOPS BEING  │
 * │ POSSIBLE rather than being blocked — a crafted `?plane=` link has nothing   │
 * │ to steal."*                                                                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * It closes the decision `docs/contracts/session.openapi.yaml` reserved by
 * name: *"Whether the handle arrives as a `Set-Cookie` or as a response body
 * field is a security decision … It is owed to the D6 threat model."* That is
 * discharged; this is where it lands, and it lands in ONE module for
 * `model/money.ts`'s reason — *"correctness that lives at call sites is
 * correctness that drifts."* Nothing else in `server/` may name the cookie, set
 * its attributes or parse its value.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE NAME CARRIES THE `__Host-` PREFIX, AND IT IS A CONTROL RATHER THAN A
 *    CONVENTION.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A browser refuses to store a `__Host-`-prefixed cookie unless the
 * `Set-Cookie` carries `Secure`, carries `Path=/`, and carries **no `Domain`
 * attribute at all**. The third is the one that matters here: a cookie with no
 * `Domain` is HOST-ONLY — `a.example` cannot set it for `example`, and
 * `example` cannot set it for `a.example`.
 *
 * **That is G180's threat, refused by the user agent before our code runs.**
 * `model/serving-host.ts`: *"Cookie tossing and subdomain takeover both work by
 * getting a browser to send the right cookie to the wrong place, and neither
 * survives a server-side host-equality check."* The server-side check is
 * unchanged and is still the control; this is the same property asserted a
 * second time, on the other side of the wire, by a mechanism an attacker who
 * owns a sibling subdomain cannot reach. **Two fences, and the ruling is honest
 * only with both standing** — the same sentence `server/dev/test-token.ts`
 * carries about the flag and the loopback bind.
 *
 * ⚠️ `Secure` IS UNCONDITIONAL AND IS NOT KEYED ON AN ENVIRONMENT. A
 * `Secure`-when-production cookie is a boolean somebody can move, and G386's
 * own sentence about the OTHER half of this ruling applies unchanged to this
 * half: *"A boolean check inside a request handler does not satisfy this
 * ruling."* It costs nothing locally and it is measured rather than assumed:
 * Chromium treats `http://127.0.0.1` as a potentially-trustworthy origin and
 * stores a `Secure`, `__Host-`-prefixed cookie set over it — witnessed in
 * `tests/e2e/browser-login.test.ts` §10, where the SAME cookie is then
 * unreadable from `document.cookie`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ `SameSite=Lax` MITIGATES CSRF AND IS NOT A COMPLETE ANSWER, AND G386 SAYS
 *    SO IN AS MANY WORDS. READ THIS BEFORE SERVING A STATE-CHANGING OPERATION.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The header design had no CSRF exposure at all: a custom request header is
 * never attached by a cross-site form or navigation, so an attacker's page
 * could not make an authenticated request at any price. A cookie is attached BY
 * THE BROWSER, so the question becomes live the moment this file exists. What
 * `Lax` actually buys, stated precisely rather than as a slogan:
 *
 *   · A cross-site **`POST`, `PUT`, `PATCH` or `DELETE` does not carry it.**
 *     `Lax` attaches a cookie only to a TOP-LEVEL navigation using a safe
 *     method. Every state-changing operation this plane mounts — `POST
 *     /context/resolve`, `PUT /v1/exceptions/{id}/assignee` — is therefore
 *     unreachable cross-site with this credential attached.
 *   · The "Lax+POST" two-minute intervention, which re-admits a cross-site
 *     `POST` for a freshly-set cookie, applies ONLY to a cookie that declares
 *     no `SameSite` at all. This one declares it, so the intervention does not
 *     reach it. That is why the attribute is written out rather than left to a
 *     browser default that is itself a heuristic.
 *   · 🛑 **WHAT IS NOT COVERED, AND IT IS NAMED RATHER THAN GLOSSED:** a
 *     state-changing **`GET`**, reached by a top-level navigation, WOULD carry
 *     this cookie. There is no such operation today — every mounted `GET` is a
 *     read — and the honest statement is that `Lax` is load-bearing for that
 *     absence rather than indifferent to it. **A state-changing `GET`, or any
 *     cross-site `POST` the product later needs, owes an explicit anti-CSRF
 *     token; `SameSite` is not it.** `Session` declares no `csrfToken` and
 *     `docs/contracts/session.openapi.yaml` says that is deliberate, so minting
 *     one is a ruling and not a commit.
 *   · A SAME-SITE sibling — `evil.{tenant-domain}` — is same-site for
 *     `SameSite` purposes and would carry the cookie on any method. That is
 *     exactly what the `__Host-` prefix and `checkHostBinding()` refuse, and it
 *     is why both are here rather than either.
 */

import type { FastifyRequest } from 'fastify'

/**
 * 🛑 THE ONE NAME. Change it and every live session on a deployed host is
 * signed out at once — a rename is a revocation event, not a refactor.
 *
 * ⚠️ IT IS NOT `X-Session` SPELLED DIFFERENTLY. The header is `apiKey`/`in:
 * header` in three contract documents and survives, behind a flag, for exactly
 * one reason — `server/dev/session-header.ts`. The two names are deliberately
 * unlike so that a grep for either cannot answer a question about the other.
 */
export const SESSION_COOKIE = '__Host-reconcile_session'

/**
 * The attributes, in one string, written once.
 *
 * ⚠️ `Path=/` AND NO `Domain` ARE REQUIRED BY THE `__Host-` PREFIX and are not
 * free choices; `HttpOnly`, `Secure` and `SameSite=Lax` are G386's, verbatim.
 * There is no code path that assembles a different set — a function taking
 * options would be the call-site correctness this module exists to refuse.
 */
const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax'

/**
 * Read the handle the browser presented, or `undefined`.
 *
 * 🛑 A DUPLICATE NAME IS REFUSED RATHER THAN RESOLVED, AND THAT IS THE
 * INTERESTING LINE IN THIS FILE. A `Cookie` header carrying the name twice is
 * the WIRE SIGNATURE OF COOKIE TOSSING: a host-only `__Host-` cookie and a
 * domain-scoped shadow of it set by a sibling arrive as two pairs in one
 * header, in an order the browser does not promise and the server cannot
 * attribute. Taking the first is what every convenience parser does, and it
 * hands the attacker a coin flip. Taking neither costs a legitimate caller
 * nothing — no correct browser produces this — and turns a session-fixation
 * attempt into a 401.
 *
 * ⚠️ HAND-PARSED, AND NO COOKIE PLUGIN IS ADDED FOR IT. `@fastify/cookie` would
 * be a sixth runtime dependency under G191's pin-exact rule for one `split`,
 * and it parses PERMISSIVELY by design — its job is to hand a handler
 * everything it can salvage, which is the opposite polarity to the one above.
 */
export function sessionCookieFrom(request: FastifyRequest): string | undefined {
  const raw = request.headers.cookie
  if (typeof raw !== 'string' || raw === '') return undefined

  let found: string | undefined
  for (const pair of raw.split(';')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    /* Trimmed on the NAME only. A cookie value's surrounding whitespace is not
     * part of it per RFC 6265 §4.1.1, and a value here is a base64url handle
     * with no space in it at any rate — but trimming a value would be this
     * parser repairing a caller, and a repaired credential is a credential
     * somebody else chose the shape of. */
    if (pair.slice(0, eq).trim() !== SESSION_COOKIE) continue
    if (found !== undefined) return undefined // see the note above: two is none
    found = pair.slice(eq + 1)
  }
  return found === '' ? undefined : found
}

/**
 * The `Set-Cookie` VALUE that delivers a handle. A string, not a side effect.
 *
 * 🛑 IT HAS NO PRODUCTION CALLER TODAY AND THAT IS STATED HERE RATHER THAN
 *    DISCOVERED. Derive it: `grep -rn '^export function mintedSessionCookie'
 *    server/` returns this declaration, and no CALL SITE exists anywhere in
 *    `server/`. ⚠️ **THE `^export function` IS NEW — G2178, 28 Sep 2026**: the
 *    bare form said *"this declaration and nothing else"* and returned two
 *    lines, the second being that sentence. **Nothing in this repository mints a
 *    session** — `tenant.session.user_id` is `NOT NULL`, a `user_id` comes from
 *    the subject a directory asserted, and `grep -rn 'jwtVerify|createRemoteJWKSet' server/`
 *    returns nothing — so there is no act for a delivery to accompany.
 *
 * ⚠️ SO WHY DOES IT EXIST, GIVEN THAT THIS REPOSITORY REFUSES A COLUMN AHEAD OF
 * ITS READER? Because **G386 IS A RULING ABOUT THESE EXACT BYTES**, and the
 * alternative is not "no code" — it is the mint slice choosing them, at its
 * call site, months from now, from a paragraph. That is precisely the shape
 * G111 refuses for money and G67 for FX: *"correctness that lives at call
 * sites is correctness that drifts."* A `Set-Cookie` assembled at a handler is
 * one `Secure` away from a credential on the clear, and the browser reports
 * that failure by silently not storing the cookie.
 *
 * ⚠️ AND THE HONEST LIMIT OF WHAT IT BUYS: `tests/http/session-cookie-channel.test.ts`
 * asserts these bytes and NO BROWSER HAS EVER BEEN SENT THEM by this
 * repository. `tests/e2e/browser-login.test.ts` seeds the cookie into the jar
 * instead, so what is witnessed in a real Chromium is that a cookie WITH THESE
 * ATTRIBUTES is unreadable by page script and is sent to the plane — not that
 * this function's output is accepted by one. The two halves meet at the mint,
 * and the mint does not exist.
 */
/* ✅ ITS FIRST PRODUCTION CALLER ARRIVED 1 Oct 2026 — S6, G2490:
 * `server/data-plane/federated-signin.ts`, on the `303` that answers a
 * completed sign-in. The paragraph above saying no call site exists is kept as
 * the history it is. */
export function mintedSessionCookie(handle: string): string {
  return `${SESSION_COOKIE}=${handle}; ${ATTRIBUTES}`
}

/**
 * The `Set-Cookie` value that WITHDRAWS one.
 *
 * ⚠️ `Max-Age=0` AND AN EMPTY VALUE, AND THE ATTRIBUTES ARE IDENTICAL TO THE
 * DELIVERY'S. A browser matches a clearing cookie to a stored one by name,
 * domain and path; a clear that omitted `Secure` would not satisfy the
 * `__Host-` prefix and would be REFUSED OUTRIGHT, leaving the live cookie in
 * place while the server believed it had withdrawn it. That failure is silent
 * in every observable way except the next request, which is why the attribute
 * string is shared rather than retyped.
 *
 * 🛑 CLEARING IS NOT REVOKING, AND NO CALLER MAY TREAT IT AS ONE. The authority
 * on whether a session is live is `tenant.session.revoked_at`; this only stops
 * a cooperating browser from presenting it. A caller that cleared without
 * revoking would have signed nobody out.
 */
export function withdrawnSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${ATTRIBUTES}; Max-Age=0`
}

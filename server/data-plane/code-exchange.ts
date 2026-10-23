/**
 * THE CODE EXCHANGE — W3/S5, R3 and R4, G2151–G2159, 25 Sep 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ✅ G2443 IS APPLIED — S6, 1 Oct 2026 (G2485–G2489). THE OWNER'S RULING:
 *    *"Yes, bounded — exactly ONE file (`server/data-plane/code-exchange.ts`)
 *    may POST to the PINNED connection's token endpoint only, with a short
 *    timeout, outside any database transaction."*
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 **THE BANNER BELOW READ *"NOBODY CAN SIGN IN AFTER THIS FILE LANDS …
 * THIS MODULE IS REACHED BY NO ROUTE AND PERFORMS NO NETWORK CALL"* AND IS
 * KEPT RATHER THAN DELETED**, because it was exactly true for six days and
 * the R2-versus-R3 argument under it is the reason the ruling was needed.
 * **Both halves are false now**: `completeFederatedSignIn` is mounted
 * (`server/data-plane/federated-signin.ts`) and `tokenEndpointTransport()`
 * below makes the call. `unauthorisedEgressTransport()` is DELETED, and the
 * refusal arm that named it went with it — an arm nothing can reach is a
 * control nothing can witness.
 *
 * THE FOUR BOUNDS, EACH AN ASSERTION RATHER THAN A PARAGRAPH:
 *
 *   ONE FILE      `tests/http/console-roster-unreachable.test.ts` §1c — the
 *                 data plane's outbound census is `deepEqual` to TWO names,
 *                 `code-exchange.ts` and `jwks-source.ts`, and nothing wider.
 *   PINNED ONLY   the URL is an ARGUMENT of `tokenEndpointTransport()`'s
 *                 request value and is produced by `tokenEndpointOf()` from
 *                 the `token_endpoint` column of the row `0280` admits by the
 *                 attempt's own `connection_id` — never the body, never the
 *                 token. `tests/http/federated-signin-served.test.ts` §6
 *                 smuggles an endpoint in the body and requires a 400.
 *   SHORT         `TOKEN_ENDPOINT_TIMEOUT_MS`, argued at the constant, plus a
 *                 body cap and `redirect: 'error'`.
 *   NO TX HELD    the caller COMMITS the pin transaction and RELEASES its
 *                 connection before this file is asked to send anything;
 *                 §5 of that suite reads the pool's own counters FROM INSIDE
 *                 the fake broker's request handler and requires zero
 *                 checked-out connections.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 NOBODY CAN SIGN IN AFTER THIS FILE LANDS, AND THAT IS THE CORRECT STATE.
 *    THIS MODULE IS REACHED BY NO ROUTE AND PERFORMS NO NETWORK CALL.
 *    ⛔ SUPERSEDED 1 Oct 2026 BY G2443 — SEE ABOVE. KEPT AS HISTORY.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * **R1 — the D6 threat model's ten numbered decisions — IS AN OPEN OWNER'S
 * RULING**, and `completeFederatedSignIn` would be the product's first public
 * unauthenticated CREDENTIAL-MINTING endpoint. `docs/build/completion-plan.md`
 * §5 W3 puts that mount at S6, behind R1. **The served set is unchanged by
 * this slice**, this module's only caller is `tests/`, and
 * `server/data-plane/run-worker.ts` says the same thing in the same capitals
 * for the same reason: *a seam that does nothing is not a bug when the thing
 * that would call it is behind a ruling.*
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 R2 AND R3 PULL IN OPPOSITE DIRECTIONS HERE, AND THIS FILE IS WHERE THAT
 *    IS RESOLVED RATHER THAN SETTLED QUIETLY. READ THIS BEFORE THE CODE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The two rulings, both the owner's, both taken 25 Sep 2026:
 *
 *   **R2** — *"The JWKS is fetched ONCE AT BOOT and cached in memory.
 *             **No runtime egress.**"*
 *   **R3** — *"The code exchange is a STATELESS exchange inside the EXISTING
 *             data plane."* No third process, no new stack, no new network.
 *
 * 🛑 **AN AUTHORIZATION-CODE EXCHANGE IS AN OUTBOUND POST TO THE BROKER'S
 * TOKEN ENDPOINT, PER SIGN-IN. IT CANNOT HAPPEN AT BOOT — THERE IS NO CODE AT
 * BOOT.** So R3, built whole, is REQUEST-PATH EGRESS, which is the one thing
 * R2's second sentence names. **The two rulings are not reconcilable by
 * reading them more carefully, and pretending otherwise by quietly writing the
 * call would be taking a decision the owner has not been asked for.**
 *
 * **THE HONEST READING, AND IT IS THE NARROW ONE.** R2's subject is the JWKS:
 * *the JWKS* is fetched at boot, and there is no runtime egress **for it**.
 * What R2 unambiguously settles is that this product may make an outbound HTTP
 * request AT ALL — `docs/build/d6-threat-model.md` D6-2 says that is the real
 * question: *"What you are actually deciding is not caching policy. It is
 * whether this product makes outbound HTTP requests at all."* **The answer is
 * now yes, at boot.** Whether it may make one **on a request path** is a
 * different question with a different threat surface, and **no ruling answers
 * it.**
 *
 * ⚠️ **AND THE THREAT SURFACE IS NOT HYPOTHETICAL, WHICH IS WHY IT DESERVES
 * ITS OWN RULING RATHER THAN AN INFERENCE.** D6 §1.3 and §4.5 measure what an
 * anonymous caller can already make this plane spend — *"TEN CONCURRENT
 * WELL-FORMED SIGN-IN CALLBACKS HOLD THE ENTIRE DATA PLANE'S DATABASE
 * CAPACITY"*, with `createAppPool(max = 10)` against
 * `SERVING_TASKS_WHEN_UP.staging = 1` — and a request-path exchange adds a
 * SECOND resource an anonymous caller can exhaust: an outbound socket and a
 * multi-second wait on somebody else's server, inside the same request that is
 * already holding a pooled connection. That is D6-4, which is open.
 * ⚠️ **R-POOL (G2261, 1 Oct 2026) RAISES BOTH NUMBERS IN `infra/` — 47 per
 * task, two tasks, 94 in all — AND IS BUILT AND NOT DEPLOYED.** The quotation
 * above is D6's and stays true of the running fleet until a `Planes` deploy;
 * the argument it makes here is unchanged, because a pool that is nine times
 * larger is still a pool an outbound wait holds a connection from.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 SO THIS SLICE STOPS AT THE SEAM, AND THE SEAM IS THE DELIVERABLE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Everything R3 asks for that is NOT egress is built here, in the existing data
 * plane, stateless, with no third process and no new network:
 *
 *   · `signInCallbackUrl()`    — R4's shape, mirrored from `infra/` (§1)
 *   · `codeExchangeRequest()`  — the request as a VALUE: url, method, headers,
 *                                form. Building it is not sending it.
 *   · `readTokenEndpointResponse()` — the answer, refused in five ways
 *   · `bindTokenToAttempt()`   — D6 §4.3's binding, closed (§5)
 *   · `completeCodeExchange()` — the whole act, over a response it is HANDED
 *
 * **What is absent is one line: the call.** `TokenEndpointTransport` is the
 * seam it would occupy, and the only implementation in this repository is
 * `unauthorisedEgressTransport()`, which **refuses and names the open
 * ruling**. That is `unconfiguredRunQueue()`'s device (R-B) — *"IT IS LOUD, AND
 * THAT IS THE WHOLE OF IT. A silent no-op here is the shape this repository
 * refuses everywhere else"* — pointed at a decision rather than at a
 * configuration.
 *
 * ✅ **AND THE FENCE IS MECHANICAL RATHER THAN A PROMISE.**
 * `tests/http/console-roster-unreachable.test.ts` §1c enumerates every file
 * under `server/` that may carry an outbound call, **by name**, and the list
 * has exactly one member: `data-plane/jwks-source.ts`, reached by a dynamic
 * import from boot. **A commit that writes the call into this file fails that
 * assertion**, and the author then has to either add this file to the list —
 * which is the ruling, taken visibly, in a diff a reviewer reads — or not.
 *
 * ⚠️ **WHAT THIS COSTS, STATED PLAINLY: SIGN-IN CANNOT COMPLETE.** Not
 * *"cannot complete until S6 mounts it"* — it cannot complete at all, because
 * nothing can turn a code into a token. **That is a smaller loss than it
 * sounds and it is worth saying why:** S6 is blocked on R1 regardless, so no
 * caller would have reached this path in any case, and a request-path call
 * written now would have sat unreachable while having already spent the
 * property `tests/` asserts. **The cheapest thing in this slice is the line it
 * did not write.**
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ R4 MOVED G315's CALLBACK HOST — READ THE AMENDMENT, NOT THE ORIGINAL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * G315's original ruling is `auth.{region}.reconcileai.app/callback` and **it
 * is amended**: `docs/HANDOFF.md`'s row says *"the callback host MOVES; the
 * rest of this row stands"*, and the shape taken is the one
 * `infra/lib/config.ts` already synthesises — `COGNITO_CALLBACK_PATH` on the
 * console hosts. The original is preserved beneath the amendment because
 * `docs/build/completion-plan.md` R4 and `deploy-handoff.md` §5a both cite it.
 *
 * 🛑 **WHAT IS UNCHANGED AND IS THE LOAD-BEARING HALF, QUOTED FROM THE ROW:
 * *"the tenant is in `state` as a ROUTING FACT FOR THE 302 AND NEVER AS A
 * GRANT OF SCOPE, and the session is minted on the tenant host and nowhere
 * else."*** Invariant 1 is untouched by R4 and is untouched by this file.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 INVARIANT 1, ARRIVING HERE WEARING A RULING'S ENDORSEMENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Copy it, never paraphrase it — `CLAUDE.md` is the only place it is numbered:
 *
 *     "Tenant scope is derived from the session, never read from a request."
 *
 * G315 puts the tenant in the OIDC `state` **deliberately**. This module is the
 * next thing after that 302 to hold anything, and `model/session-mint.ts`
 * states the hazard exactly: *"if either carries it forward, tenant scope
 * becomes a thing conferred by authentication, **with a ruling apparently
 * endorsing it**."*
 *
 * **NOTHING THIS MODULE PRODUCES CARRIES A TENANT, AND `_ExchangeReachesNoTenantDeep`
 * BELOW MAKES THAT A `TS2344` RATHER THAN A REVIEW COMMENT.** It is
 * `AssertNoTenantDeep` — S2's proof, IMPORTED and not re-implemented (§5.3) —
 * and S2 measured why the shallow key check alone is insufficient: adding
 * `surface: ServedSurface` left the key proof **green** and failed only the
 * deep one, *"and the mint would have a tenant under a key named `surface`."*
 *
 * ⚠️ **AND THE CLEARTEXT `state` NEVER ENTERS THIS MODULE AT ALL.** What
 * crosses is `code` and the digest the redirect pinned. `state` is the value
 * that HOLDS the tenant; keeping it out is not tidiness, it is the reason the
 * deep proof has nothing to catch.
 */

import { timingSafeEqual } from 'node:crypto'

import type { AssertNoTenantDeep } from '../../model/session-mint.ts'
import type { AssertNoTextDeep } from '../../model/reconciliation.ts'
import type { SessionHandleDigest } from '../../model/domain.ts'
import { digestOfHandle } from './handle-digest.ts'
import { verifyIdentityToken } from './token-verify.ts'
import type { TokenVerificationRefusal, VerifiedClaims } from './token-verify.ts'
import type { PinnedVerificationTerms } from './verification-terms.ts'

type Assert<T extends true> = T

/* ==================================================================== *
 * §1  WHERE THE BROKER SENDS THE BROWSER BACK — R4
 * ==================================================================== */

/**
 * The callback path, R4's shape.
 *
 * 🛑 **IT IS A MIRROR OF `infra/lib/config.ts`'s `COGNITO_CALLBACK_PATH` AND
 * THE MIRROR IS ASSERTED RATHER THAN TRUSTED.** `server/` may not import
 * `infra/` — they are separate TypeScript projects with separate manifests,
 * and `aws-cdk-lib` must never enter the root one (G212's protected property).
 * So the string exists twice, which is `0002`'s *"third place to drift"* in
 * miniature, and what makes it a MIRROR rather than a drift is
 * `tests/http/code-exchange.test.ts` §1: it reads both files and requires the
 * two literals to agree. **If they disagree, Cognito redirects to a path this
 * plane does not serve and every sign-in dies at the broker** — a failure with
 * no error in our logs at all, because the request never arrives.
 */
export const SIGN_IN_CALLBACK_PATH = '/signin/callback'

/**
 * The `redirect_uri` for one console host.
 *
 * ⚠️ **IT TAKES A HOST AND IT DOES NOT CHOOSE ONE.** `model/serving-host.ts`'s
 * rule is *"a LOOKUP, never a parse"*, and the corollary for a URL builder is
 * that it must not be the thing that decides which host a browser is sent to:
 * the caller resolved the host through the registry, and this concatenates.
 * **`docs/build/d6-threat-model.md` §4.4 is the open-redirect finding and its
 * condition is exactly this** — *"the redirect target must come from
 * `resolveServingHost()` … never a concatenation"* — so the concatenation that
 * remains is the SCHEME and the PATH, both constants, around a host the caller
 * has already proven.
 *
 * 🛑 **`https` IS HARD-CODED AND MUST STAY SO.** The `redirect_uri` is compared
 * BYTE-FOR-BYTE by the broker against its registered list, so a scheme that
 * varied by environment would not be a downgrade risk — it would be an
 * exchange that fails at Cognito for every deployment that got it wrong. And
 * `__Host-reconcile_session` requires `Secure` regardless.
 */
export function signInCallbackUrl(consoleHost: string): string {
  return `https://${consoleHost}${SIGN_IN_CALLBACK_PATH}`
}

/**
 * ┌─ G2549 — THE OWNER'S, 2 Oct 2026: ONE SHARED RETURN URL ─────────────────┐
 * │ *"One shared callback host: all sign-ins return to one fixed callback    │
 * │ which then 303s to the tenant host via resolveServingHost (a registry    │
 * │ lookup, grant bound to the host)."*                                      │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The PATH the broker returns every sign-in to, on the shared return host.
 * It is a PLANE route (`relayBrokerReturn`, `GET /session/signin/return`) and
 * not a SPA route, because the relay is a registry lookup and a 303 — work the
 * browser must not be trusted with.
 *
 * ⚠️ MIRRORED BY `infra/lib/config.ts`'s `SIGN_IN_RETURN_PATH`, and the
 * mirror is asserted (`tests/http/signin-return-served.test.ts` §1), for the
 * reason `SIGN_IN_CALLBACK_PATH` above gives: a disagreement kills every
 * sign-in at the broker with no line in our logs.
 */
export const SIGN_IN_RETURN_PATH = '/session/signin/return'

/** The `redirect_uri` for the shared return host. `https`, for the reason above. */
export function signInReturnUrl(returnHost: string): string {
  return `https://${returnHost}${SIGN_IN_RETURN_PATH}`
}

/**
 * The `redirect_uri` a sign-in begun on `host` uses — and the SAME value the
 * completion must send to the token endpoint, which compares it byte for byte.
 * One function so the two cannot disagree.
 *
 * With a return host configured (G2549 — every deployed plane), EVERY sign-in
 * returns to it. Without one (a local plane, every suite that predates G2549),
 * the broker returns to the host the sign-in began on — G2548's shape, which
 * the ruling replaces in AWS and which needs no relay.
 */
export function signInRedirectUri(host: string, returnHost: string | null): string {
  return returnHost === null ? signInCallbackUrl(host) : signInReturnUrl(returnHost)
}

/* ==================================================================== *
 * §2  THE REQUEST, AS A VALUE
 * ==================================================================== */

/**
 * Everything the token endpoint needs, and nothing this plane may not hold.
 *
 * 🛑 **THERE IS NO `clientSecret` AND THERE MUST NOT BE ONE.** This constrains
 * the broker's app client to a **public client with PKCE**, and the argument is
 * G193's: a serving process that holds a long-lived credential holds it *for
 * its entire life*, which is why the migrator was split into a one-shot job —
 * *"any `process.env` disclosure yielded the read exemption every isolation
 * assertion in `tests/` is relative to."* A client secret in the data plane is
 * a credential that mints SESSIONS.
 *
 * ⚠️ **AND PKCE IS NOT A SUBSTITUTE FOR THE SECRET — IT IS A BETTER ANSWER TO A
 * DIFFERENT QUESTION, AND IT IS WHAT MAKES D6 §4.3's RESIDUAL SMALLER.** The
 * secret proves *this client*; `code_verifier` proves *this exchange belongs to
 * the redirect that started it*, which is the binding a stolen code needs to
 * defeat. D6-2's sub-question — *"whether the auth host's code exchange does
 * PKCE"*, recorded in §6 as undetermined and *"the one most likely to be
 * assumed rather than answered"* — **is answered here, in a required field.**
 */
export interface CodeExchangeInput {
  /** The broker's token endpoint, from configuration. Never parsed, never derived. */
  readonly tokenEndpoint: string
  /** The app client's public identifier. */
  readonly clientId: string
  /** `signInCallbackUrl(host)` for the host the redirect actually used. */
  readonly redirectUri: string
  /** The authorization code the browser presented. */
  readonly code: string
  /** PKCE. REQUIRED — see the interface's own note. */
  readonly codeVerifier: string
}

/**
 * The request, described rather than performed.
 *
 * ⚠️ **`form` IS A LIST OF PAIRS AND NOT A `URLSearchParams`**, so this value
 * is inspectable, comparable and assert-able without being executable. A test
 * can read what WOULD be sent; nothing can send it by holding it.
 */
export interface TokenEndpointRequest {
  readonly url: string
  readonly method: 'POST'
  readonly headers: Readonly<Record<string, string>>
  readonly form: readonly (readonly [string, string])[]
}

/**
 * Build the exchange request. **Pure. No clock, no environment, no I/O.**
 *
 * RFC 6749 §4.1.3 plus RFC 7636 §4.5, and nothing else: five form fields, no
 * `scope` (it is fixed at the AUTHORIZATION request and re-sending it here
 * cannot widen anything, so sending it would be a field with no reader), and
 * `Accept: application/json` because the same endpoint will serve
 * `application/x-www-form-urlencoded` to a caller that does not say.
 */
export function codeExchangeRequest(input: CodeExchangeInput): TokenEndpointRequest {
  return {
    url: input.tokenEndpoint,
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    form: [
      ['grant_type', 'authorization_code'],
      ['client_id', input.clientId],
      ['redirect_uri', input.redirectUri],
      ['code', input.code],
      ['code_verifier', input.codeVerifier],
    ],
  }
}

/* ==================================================================== *
 * §3  THE TRANSPORT — G2443, APPLIED 1 Oct 2026
 * ==================================================================== */

/** What the token endpoint answered: a status and an undecoded body. */
export interface TokenEndpointResponse {
  readonly status: number
  readonly body: string
}

/**
 * The shape of the one call this module makes.
 *
 * ⚠️ **THIS SAID *"The shape of the one call this module does not make …
 * SUPPLYING AN IMPLEMENTATION THAT REACHES THE NETWORK IS REQUEST-PATH EGRESS
 * AND IS AN OWNER'S RULING, NOT A CODE CHANGE"* UNTIL 1 Oct 2026 AND IS
 * CORRECTED RATHER THAN DELETED: the ruling is G2443, it is taken, and
 * `tokenEndpointTransport()` below is the implementation it authorises.**
 *
 * It stays a TYPE with a seam rather than a bare `fetch`, because the suites
 * drive a real local broker through the real transport, and a suite that
 * wanted a fixed answer can still hand `completeCodeExchange()` a response
 * value directly — which is what `tests/http/code-exchange.test.ts` does.
 */
export type TokenEndpointTransport = (
  request: TokenEndpointRequest,
) => Promise<TokenEndpointResponse>

/**
 * G2443's "SHORT TIMEOUT", AND IT IS THE SLICE'S CHOICE, NOT THE OWNER'S —
 * G2486. Three seconds.
 *
 * 🛑 READ WHAT IT BOUNDS BEFORE TUNING IT, BECAUSE IT IS NOT THE POOL. D6
 * §1.3 measured that ten concurrent anonymous requests hold
 * `createAppPool(max = 10)`; that exposure is closed by the FOURTH bound
 * (no transaction is held across this call), not by this number. **What this
 * bounds is an outbound socket and a pending request on the event loop**, per
 * anonymous caller, against a broker that is slow or one that never answers.
 *
 * ⚠️ WHY THREE AND NOT `DEFAULT_JWKS_TIMEOUT_MS`'s FIVE. That one is a BOOT
 * fetch: a slow broker there fails a deploy once, and patience is cheap. This
 * one runs per sign-in, with a person watching a spinner and an anonymous
 * caller able to open as many as the edge's rate rule admits. A token
 * endpoint answers in hundreds of milliseconds when it is healthy; three
 * seconds is generous to a healthy one and short against a stalled one. A
 * timeout here is reported as `token_endpoint_unreachable` → 502, and the
 * cost is a person told to try again — the attempt is NOT consumed, because
 * consumption happens in the mint transaction, which never opens.
 */
export const TOKEN_ENDPOINT_TIMEOUT_MS = 3_000

/**
 * The most this plane will read from a token endpoint. 64 KiB.
 *
 * ⚠️ UNDER BYOA (G276) THE BROKER IS IN THE CUSTOMER'S ACCOUNT, so this is a
 * body somebody else's server chooses the length of, read on the product's
 * first public credential-minting route. An ID token is a few kilobytes; a
 * response two orders of magnitude larger is not an ID token, and reading it
 * whole would let one door spend this process's memory per sign-in.
 */
export const TOKEN_ENDPOINT_MAX_BODY_BYTES = 64 * 1024

/**
 * The token endpoint a door declares, or a refusal. **Pure.**
 *
 * 🛑 THE INPUT IS A COLUMN AND ONLY A COLUMN — `tenant.identity_connection.
 * token_endpoint`, on the row `0280` admits by the attempt's `connection_id`
 * (G2443's "the PINNED connection's token endpoint ONLY"). The function cannot
 * tell where its argument came from; what makes the property true is that its
 * one caller in `server/` passes `PinnedSignIn.tokenEndpoint` and nothing
 * else, which `tests/http/federated-signin-served.test.ts` §6 holds over the
 * AST.
 *
 * ⚠️ `https:` OR A LOOPBACK `http:`, AND THE EXCEPTION IS ARGUED RATHER THAN
 * SLIPPED IN. A code and a PKCE verifier are bearer material for one exchange;
 * sent over cleartext off the host they are a stolen sign-in. A loopback
 * literal (`127.0.0.1` or `[::1]`) never leaves the host, and it is the shape
 * the gate's local broker runs in. **`localhost` is NOT admitted**: it is a
 * NAME, resolved by a resolver this process does not control, and the
 * exception is for an address that cannot be anywhere else.
 */
export function tokenEndpointOf(
  declared: string | null,
): { readonly ok: true; readonly url: string } | { readonly ok: false; readonly refusal: CodeExchangeRefusal } {
  const url = pinnedEndpointUrl(declared)
  if (url === null) return { ok: false, refusal: { kind: 'token_endpoint_not_declared' } }
  return { ok: true, url: url.toString() }
}

/**
 * THE ONE RULE FOR WHERE A DOOR'S DECLARED ENDPOINT MAY POINT — and it is ONE
 * function for BOTH of the door's endpoints since the begin operation landed
 * (1 Oct 2026, G2541; `0290`'s `authorization_endpoint`): `tokenEndpointOf()`
 * above, and `server/data-plane/signin-begin.ts`'s authorize URL. Two copies
 * of *"`https:` or a loopback literal, never `localhost`, no userinfo"* would
 * be §5.3, and the copy that drifts is always the one nobody re-reads.
 *
 * `null` for anything it will not admit — absent, unparseable, a scheme other
 * than `https:`, an `http:` that is not a loopback LITERAL, or a URL carrying
 * credentials. The caller names the refusal; this names nothing.
 */
export function pinnedEndpointUrl(declared: string | null): URL | null {
  if (declared === null) return null
  let url: URL
  try {
    url = new URL(declared)
  } catch {
    return null
  }
  const loopback = url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null
  if (url.username !== '' || url.password !== '') return null
  return url
}

/**
 * THE ONE OUTBOUND CALL ON A REQUEST PATH IN THIS REPOSITORY — G2443.
 *
 * It POSTs the request VALUE `codeExchangeRequest()` built — nothing here
 * chooses a URL, a header or a field — and returns a status and a body.
 *
 * 🛑 IT THROWS ON A NETWORK FAILURE, A TIMEOUT, A REDIRECT OR AN OVERSIZED
 * BODY, AND `exchangeCode()` IS WHAT TURNS EVERY ONE OF THOSE INTO A VALUE.
 * The asymmetry is `fetch`'s own: a status is an answer, a dropped socket is
 * not one.
 *
 * ⚠️ `redirect: 'error'`, BECAUSE A TOKEN ENDPOINT THAT REDIRECTS IS ONE THIS
 * PLANE DID NOT PIN. Following a `3xx` would send the code and the verifier
 * to whatever the `Location` named — the SSRF G2443's second bound exists to
 * refuse, arriving one hop later than the column.
 */
export function tokenEndpointTransport(
  timeoutMs: number = TOKEN_ENDPOINT_TIMEOUT_MS,
): TokenEndpointTransport {
  return async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: new URLSearchParams(request.form.map(([k, v]) => [k, v])).toString(),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    if (reader !== undefined) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > TOKEN_ENDPOINT_MAX_BODY_BYTES) {
          await reader.cancel().catch(() => undefined)
          throw new Error('token endpoint body exceeds TOKEN_ENDPOINT_MAX_BODY_BYTES')
        }
        chunks.push(value)
      }
    }
    return { status: response.status, body: Buffer.concat(chunks).toString('utf8') }
  }
}

/** The send, with every way it can fail as a value. */
export type TokenEndpointExchange =
  | { readonly ok: true; readonly response: TokenEndpointResponse }
  | { readonly ok: false; readonly refusal: CodeExchangeRefusal }

/**
 * Send the request; never throw.
 *
 * ⚠️ WHAT THE CAUGHT ERROR SAID IS DISCARDED, NOT LOGGED, AND THAT IS G261
 * §12.1 RATHER THAN CARELESSNESS: a `fetch` failure's message can carry the
 * URL, and the URL here is a door's configuration on a public route. The arm
 * names THAT the endpoint could not be read, which is what an operator acts
 * on.
 */
export async function exchangeCode(
  request: TokenEndpointRequest,
  transport: TokenEndpointTransport,
): Promise<TokenEndpointExchange> {
  try {
    return { ok: true, response: await transport(request) }
  } catch {
    return { ok: false, refusal: { kind: 'token_endpoint_unreachable' } }
  }
}

/* ==================================================================== *
 * §4  THE REFUSALS
 * ==================================================================== */

/**
 * Every way an exchange fails. NINE arms, and none collapses into another.
 *
 * ⚠️ THIS SAID EIGHT UNTIL 1 Oct 2026 (G2485): one arm left with the refusing
 * transport and two arrived with the real one.
 *
 * ⚠️ **NOT ONE CARRIES COUNTERPARTY TEXT**, which is `token-verify.ts` §0c's
 * rule and bites harder here: an OAuth error response carries an `error` and an
 * `error_description`, and the description is free prose from somebody else's
 * server. `token_endpoint_reported_error` therefore names THAT IT DID and not
 * WHAT IT SAID. The status is a number and is carried for the same reason
 * `jwks_status_not_ok` carries one.
 */
export type CodeExchangeRefusal =
  /**
   * ⛔ `token_endpoint_egress_not_authorised` STOOD HERE — *"No transport is
   * authorised"* — UNTIL 1 Oct 2026 AND IS DELETED WITH THE TRANSPORT THAT
   * RETURNED IT (G2443). Its two successors are below.
   *
   * The pinned door declares no usable token endpoint: `token_endpoint` is
   * NULL on the row, or is not `https:` (nor a loopback `http:`). See
   * `tokenEndpointOf()`. A fact about OUR configuration, never the caller's.
   */
  | { readonly kind: 'token_endpoint_not_declared' }
  /**
   * The send failed before an answer arrived: a dropped socket, the
   * `TOKEN_ENDPOINT_TIMEOUT_MS` deadline, a redirect (refused, see §3) or a
   * body over `TOKEN_ENDPOINT_MAX_BODY_BYTES`. Nothing is consumed.
   */
  | { readonly kind: 'token_endpoint_unreachable' }
  /** The broker answered outside 200–299 and did not name an OAuth error. */
  | { readonly kind: 'token_endpoint_status_not_ok'; readonly status: number }
  /** The body did not decode as a JSON object. */
  | { readonly kind: 'token_endpoint_body_unreadable' }
  /**
   * The body carries an OAuth `error`. The commonest is `invalid_grant`, which
   * is a code already used, expired, or issued for another `redirect_uri` — in
   * other words the REPLAY case, arriving from the broker instead of from our
   * own `consumed_at`.
   */
  | { readonly kind: 'token_endpoint_reported_error' }
  /** A 200 with no `id_token`. An access token alone identifies nobody. */
  | { readonly kind: 'token_endpoint_returned_no_id_token' }
  /** The ID token did not verify. The verifier's own arm travels with it. */
  | {
      readonly kind: 'identity_token_refused'
      readonly refusal: TokenVerificationRefusal
    }
  /**
   * The token carries no `nonce`, so it cannot be bound to the attempt.
   *
   * 🛑 **A REFUSAL AND NEVER A SKIP.** A token with no nonce is one this plane
   * cannot prove was issued for this sign-in, and admitting it would make the
   * binding optional — which is the same as not having it, because an attacker
   * presenting a stolen token chooses whether to include one.
   */
  | { readonly kind: 'token_carries_no_nonce' }
  /** The token's nonce digests to something other than the pinned challenge. */
  | { readonly kind: 'token_nonce_does_not_match_attempt' }
  /**
   * 🛑 G2764 — THE BROKER AUTHENTICATED THE PERSON THROUGH A DIRECTORY OTHER
   * THAN THE ONE THE ATTEMPT PINNED, OR WILL NOT SAY WHICH.
   *
   * One pool brokers several doors (G302), so a token's `iss` and `aud` are
   * the SAME for every door: they prove the broker, not the directory. The
   * plane builds the authorize URL with `identity_provider = <the pinned
   * door's broker_ref>`, but that parameter rides in a URL the browser holds,
   * and a person who edits it is authenticated by a DIFFERENT directory and
   * returns with a token that verifies. Without this arm the mint would
   * provision that person ON THE PINNED DOOR — another directory's identity
   * wearing this one's organisation. **The moment a second door shares the
   * pool (the Entra door and the staging mock door both do) this is live.**
   *
   * Cognito states the authenticating provider in the verified token's
   * `identities` claim; it must name EXACTLY ONE provider and it must be the
   * pinned `broker_ref`. A token that carries no such claim is refused, not
   * admitted — the absence of the evidence is not evidence of the right door.
   */
  | { readonly kind: 'token_broker_provider_mismatch' }

/** The containment proof. `kind`, `status` and the verifier's own union pass. */
export type _CodeExchangeRefusalHoldsNoText = AssertNoTextDeep<CodeExchangeRefusal>

export const CODE_EXCHANGE_REFUSALS = [
  'token_endpoint_not_declared',
  'token_endpoint_unreachable',
  'token_endpoint_status_not_ok',
  'token_endpoint_body_unreadable',
  'token_endpoint_reported_error',
  'token_endpoint_returned_no_id_token',
  'identity_token_refused',
  'token_carries_no_nonce',
  'token_nonce_does_not_match_attempt',
  'token_broker_provider_mismatch',
] as const

/** Both directions. A tenth arm with no roster entry fails to compile here. */
export type _EveryCodeExchangeRefusalIsListed = Assert<
  (typeof CODE_EXCHANGE_REFUSALS)[number] extends CodeExchangeRefusal['kind']
    ? CodeExchangeRefusal['kind'] extends (typeof CODE_EXCHANGE_REFUSALS)[number]
      ? true
      : false
    : false
>

/** The construction site, so the proof BITES rather than merely compiling. */
export const CODE_EXCHANGE_ROSTER_IS_TOTAL: _EveryCodeExchangeRefusalIsListed = true

/* ==================================================================== *
 * §5  THE BINDING — D6 §4.3, CLOSED
 * ==================================================================== */

/**
 * The verified token, tied to the attempt the redirect pinned.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS THE DEFENCE D6 §4.3 MEASURED AS ABSENT, AND IT IS WORTH READING
 *    WHY THE THING THAT LOOKED LIKE IT WAS NOT IT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `consumeSignInAttempt()` compares `callback.challengeDigest` against
 * `attempt.challengeDigest`, and D6 §4.3's finding is that **both sides of that
 * comparison are values the same caller supplied** — one now, one at redirect.
 * It proves the caller knows the challenge. It does not prove the token was
 * issued for this attempt.
 *
 * **THIS COMPARISON HAS A SIDE THE CALLER DOES NOT CONTROL**: the `nonce` claim
 * inside a token whose signature has already verified under the broker's own
 * key. G344 closed the identical shape one field over, for `connectionId`, the
 * identical way, and `model/domain.ts` states the rule on the column itself —
 * *"COMPARED, NEVER RE-DERIVED — re-deriving it from anything the callback
 * supplied would compare the caller's value against itself."* **A signed nonce
 * is not something the callback supplied.**
 *
 * 🛑 **THE DIGEST IS `digestOfHandle()` AND NOTHING ELSE.** `handle-digest.ts`
 * is *"the only place in `server/` that turns a presented handle into the value
 * a policy keys on"*, and its header says a second `createHmac` under
 * `server/data-plane/` is *"a defect, not a style preference"*. The stored
 * `challengeDigest` was produced by that function, so the comparison is only
 * meaningful if this side is too.
 *
 * ⚠️ **`timingSafeEqual` RATHER THAN `!==`, AND THE LENGTH GUARD IS PART OF
 * IT.** D6 §4.8 names the existing `!==` comparisons as a low-severity
 * observation, *"named so that a future reviewer finds it already
 * considered"*, and says `timingSafeEqual` *"would cost nothing"*. This is a
 * NEW comparison, so it costs nothing to write it the better way; the existing
 * one in `model/domain.ts` is unchanged and cannot be changed, because `model/`
 * reaches no `node:` module. **The guard is not defensive noise:
 * `timingSafeEqual` THROWS on unequal lengths**, which would turn a malformed
 * digest into a 500 and leak the length distinction it exists to hide.
 */
export type TokenAttemptBinding =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: CodeExchangeRefusal }

export function bindTokenToAttempt(
  claims: VerifiedClaims,
  pinnedChallengeDigest: SessionHandleDigest,
): TokenAttemptBinding {
  if (claims.nonce === null) {
    return { ok: false, refusal: { kind: 'token_carries_no_nonce' } }
  }
  const presented = digestOfHandle(claims.nonce)
  if (presented === null) {
    /* Unreachable through `VerifiedClaims`, whose `nonce` is non-empty or
     * `null` — asserted rather than assumed, because the alternative to an
     * explicit arm here is a `!` that a later change to `stringClaim` would
     * turn into a digest of the empty string. */
    return { ok: false, refusal: { kind: 'token_carries_no_nonce' } }
  }
  const a = Buffer.from(presented, 'utf8')
  const b = Buffer.from(pinnedChallengeDigest, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, refusal: { kind: 'token_nonce_does_not_match_attempt' } }
  }
  return { ok: true }
}

/* ==================================================================== *
 * §6  READING THE ANSWER
 * ==================================================================== */

/** The one field this module reads out of a token-endpoint response. */
export type TokenEndpointRead =
  | { readonly ok: true; readonly idToken: string }
  | { readonly ok: false; readonly refusal: CodeExchangeRefusal }

/**
 * Decide what the broker said. **Pure; takes a status and a string.**
 *
 * 🛑 **THE ORDER IS `token-verify.ts` §0b's AND IS NOT FREE TO CHANGE: THE
 * OAUTH `error` IS READ BEFORE THE STATUS IS JUDGED.** RFC 6749 §5.2 requires
 * an error response to be a 400 carrying `error`, so status-first would report
 * `token_endpoint_status_not_ok` for every `invalid_grant` — which is the
 * REPLAY case, the one an operator most needs named. *"A refusal that names the
 * wrong subject is worse than a ninth arm."*
 *
 * ⚠️ AND A 200 CARRYING AN `error` IS TREATED AS AN ERROR, because a broker
 * that does that is telling us something we should believe over its status
 * line — the fail-closed direction.
 */
export function readTokenEndpointResponse(response: TokenEndpointResponse): TokenEndpointRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(response.body)
  } catch {
    return { ok: false, refusal: { kind: 'token_endpoint_body_unreadable' } }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, refusal: { kind: 'token_endpoint_body_unreadable' } }
  }
  const body = parsed as Record<string, unknown>

  if (typeof body['error'] === 'string' && body['error'] !== '') {
    return { ok: false, refusal: { kind: 'token_endpoint_reported_error' } }
  }
  if (response.status < 200 || response.status > 299) {
    return {
      ok: false,
      refusal: { kind: 'token_endpoint_status_not_ok', status: response.status },
    }
  }

  const idToken = body['id_token']
  if (typeof idToken !== 'string' || idToken === '') {
    return { ok: false, refusal: { kind: 'token_endpoint_returned_no_id_token' } }
  }
  return { ok: true, idToken }
}

/* ==================================================================== *
 * §7  THE WHOLE ACT
 * ==================================================================== */

/**
 * What a verified, attempt-bound sign-in yields.
 *
 * 🛑 **NO TENANT, NO ORG, NO SESSION AND NO PERSON.** A subject and an issuer.
 * `orgClass` is `orgFor(connection.owner)` and is never conferred by a token
 * (`0200`: *"a minted person therefore inherits the owner of the door the
 * callback arrived through"*); a tenant is bound later and elsewhere, by
 * `selectTenantForSession()`, which is *a CHECK and never a CHOOSER*.
 */
export interface ExchangedIdentity {
  /**
   * `iss`, verified equal to the terms' issuer — which, since D6-5, is the
   * PINNED row's `broker_issuer` and never a value the token chose.
   */
  readonly issuer: string
  /** `sub`. The subject a directory asserted, bound to this attempt. */
  readonly subject: string
  /** `exp`, seconds since the epoch. Carried so a caller need not re-parse. */
  readonly expiresAt: number
  /**
   * THE DIGEST OF THE VERIFIED TOKEN'S `nonce` — S6, G2487. It is what the
   * mint transaction hands `consumeSignInAttempt()` as `challengeDigest`, so
   * the model's challenge arm compares the pinned digest against a value the
   * BROKER signed rather than one the caller typed. G344's move, one field
   * over, and D6 §4.3 closed at the model as well as here.
   */
  readonly challengeDigest: SessionHandleDigest
  /**
   * `VerifiedClaims.emailVerified`, carried verbatim — G2901. Whether the
   * directory attests the token's `email` claim; it says nothing about any
   * OTHER claim a door may project as an address, and the mint store is the
   * one place that knows which claim the door projected (see
   * `session-mint-store.ts`'s `addressIsVerified()`).
   */
  readonly emailVerified: boolean
  /**
   * The values of exactly the claims the caller NAMED, out of the VERIFIED
   * payload — S6, G2488. Its one caller names `email_claim` and `name_claim`
   * off the PINNED door's row (R6), and `projectPerson()` is the only reader.
   *
   * 🛑 `VerifiedClaims` IS NOT WIDENED, AND `tests/http/token-verify.test.ts`
   * §1b STILL HOLDS IT AT SEVEN KEYS WITH `email` REFUSED. That control's
   * argument is that a caller who can SEE an email will eventually RESOLVE a
   * person by it. This field is narrower in both directions: it carries only
   * the names a door declared, and it travels to the PROJECTION — the
   * person's display attributes, written once and never read back as a key.
   * The person is FOUND by `sub` alone (`0200` §4), and nothing here changes
   * that.
   *
   * ⚠️ JSON SCALARS, AND `unknown` WAS TRIED FIRST AND REFUSED BY THE PROOF
   * BELOW: `_ExchangeReachesNoTenantDeep` answered `TS2344` — *"Type
   * 'unknown' is not assignable to type 'never'"* — because an `unknown` can
   * be a `TenantId`, and a tenant arriving inside an untyped claim is exactly
   * the invariant-1 breach that proof is for. A scalar cannot carry a brand.
   * Non-scalar claims are dropped here, so `projectPerson()` answers
   * `claim_absent` for them rather than meeting an object; a broker may still
   * emit a non-string scalar, and `projectPerson()` is the one place that
   * narrows that.
   */
  readonly projected: Readonly<Record<string, ProjectedClaim>>
}

/**
 * INVARIANT 1, TRANSITIVELY, ON WHAT THIS MODULE HANDS ONWARD.
 *
 * `AssertNoTenantDeep` is S2's proof, IMPORTED rather than re-implemented
 * (§5.3), and S2 measured why the shallow key check is not sufficient — a
 * nested `ServedSurface` left it green. **This is the seam a tenant would
 * arrive at if `state` were carried forward**, which is `model/session-mint.ts`'s
 * own hazard one step upstream.
 *
 * VERIFIED RED: adding `readonly tenantId: TenantId` to `ExchangedIdentity`
 * fails here with `TS2344`.
 */
export type _ExchangeReachesNoTenantDeep = AssertNoTenantDeep<ExchangedIdentity>

export type CodeExchangeResult =
  | { readonly ok: true; readonly identity: ExchangedIdentity }
  | { readonly ok: false; readonly refusal: CodeExchangeRefusal }

/**
 * Read the answer, verify the token, bind it to the attempt.
 *
 * **Pure, total, and it takes the RESPONSE rather than fetching one** — see
 * §3 and the header. `terms` comes from `verificationTermsAt(source, issuer,
 * now)`, whose key document was obtained at boot (R2).
 *
 * 🛑 **AND `terms` IS `PinnedVerificationTerms`, NOT `TokenVerificationTerms`,
 * SINCE 1 Oct 2026 — D6-5, THE OWNER'S RULING, G2232.** *"The broker issuer
 * comes from the PINNED `identity_connection` ROW, never from the token."*
 * The issuer this function verifies against can therefore only have been
 * read off the door `assembleSignIn()` resolved and proved equal to the one
 * the redirect pinned (G344); a hand-built terms object carrying a bare
 * string — the token's own `iss`, say, or an allowlist entry that happened to
 * match it — is a `TS2322` at this call. **The token's `iss` is COMPARED, by
 * `token-verify.ts` step 9, after the signature holds, and selects nothing.**
 * `tests/http/pinned-issuer.test.ts` mounts the IdP mix-up against it.
 *
 * THE ORDER IS THE DESIGN:
 *
 *   1. read the response   — is there an ID token at all
 *   2. VERIFY it           — nothing in it is a fact until this returns
 *   3. BIND it             — and only now is `nonce` a value worth comparing
 *
 * 🛑 **BINDING AFTER VERIFICATION IS NOT AN OPTIMISATION.** `token-verify.ts`
 * §0b: the payload is not PARSED until the signature holds, *"a verifier that
 * parsed first would report a CLAIM defect on a FORGED token and so tell an
 * attacker which of their fields to fix next."* Comparing a nonce out of an
 * unverified token would be that mistake committed one layer up, against the
 * one claim an attacker most wants feedback on.
 */
export function completeCodeExchange(
  response: TokenEndpointResponse,
  terms: PinnedVerificationTerms,
  pinnedChallengeDigest: SessionHandleDigest,
  projectClaims: readonly string[] = [],
  /**
   * G2764 — the pinned door's `broker_ref`. The production callback passes it
   * on every call, and `tests/http/signin-return-served.test.ts` §8 witnesses
   * that over a socket (a token from another provider is refused and nobody is
   * provisioned); a caller that omits it is a unit test of the other arms.
   */
  pinnedBrokerProvider?: string,
): CodeExchangeResult {
  const read = readTokenEndpointResponse(response)
  if (!read.ok) return { ok: false, refusal: read.refusal }

  const verified = verifyIdentityToken(read.idToken, terms)
  if (!verified.ok) {
    return { ok: false, refusal: { kind: 'identity_token_refused', refusal: verified.refusal } }
  }

  const bound = bindTokenToAttempt(verified.claims, pinnedChallengeDigest)
  if (!bound.ok) return { ok: false, refusal: bound.refusal }

  if (pinnedBrokerProvider !== undefined && authenticatingProvider(read.idToken) !== pinnedBrokerProvider) {
    return { ok: false, refusal: { kind: 'token_broker_provider_mismatch' } }
  }

  return {
    ok: true,
    identity: {
      issuer: verified.claims.issuer,
      subject: verified.claims.subject,
      expiresAt: verified.claims.expiresAt,
      /* `bindTokenToAttempt()` has just proved this digest EQUAL to the pinned
       * one, so carrying the pinned argument would be the same bytes — and
       * would be the caller's value rather than the token's. Recomputed from
       * the verified claim, which is the point. */
      challengeDigest: digestOfHandle(verified.claims.nonce ?? '') as SessionHandleDigest,
      emailVerified: verified.claims.emailVerified,
      projected: projectedClaims(read.idToken, projectClaims),
    },
  }
}

/**
 * G2764 — the ONE provider Cognito's `identities` claim names, or `null` when
 * it names none, several, or is not the shape Cognito writes. Read off a token
 * `verifyIdentityToken()` has ALREADY accepted, for `projectedClaims()`'s
 * reason below. Exported for its suite.
 */
export function authenticatingProvider(idToken: string): string | null {
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  let identities = (payload as Record<string, unknown>)['identities']
  /* Cognito has been seen to serialise the claim as a JSON STRING; both are its own. */
  if (typeof identities === 'string') {
    try {
      identities = JSON.parse(identities)
    } catch {
      return null
    }
  }
  if (!Array.isArray(identities) || identities.length !== 1) return null
  const only = identities[0] as unknown
  if (typeof only !== 'object' || only === null) return null
  const name = (only as Record<string, unknown>)['providerName']
  return typeof name === 'string' && name !== '' ? name : null
}

/**
 * The named claims, out of a token `verifyIdentityToken()` has ALREADY
 * accepted. Called from one place, after verification, and nowhere else.
 *
 * ⚠️ IT RE-DECODES THE PAYLOAD SEGMENT RATHER THAN WIDENING THE VERIFIER, and
 * the bytes are the same bytes: the signature `verifyIdentityToken()` checked
 * covers `header.payload`, so once it has returned `ok` the payload is a fact.
 * `token-verify.ts` §0b's rule — *nothing read from an unverified token is a
 * fact* — is why this function has no caller before the verdict.
 */
function projectedClaims(
  idToken: string,
  names: readonly string[],
): Readonly<Record<string, ProjectedClaim>> {
  if (names.length === 0) return {}
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'))
  } catch {
    return {}
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return {}
  const out: Record<string, ProjectedClaim> = {}
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(payload, name)) continue
    const value = (payload as Record<string, unknown>)[name]
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[name] = value
    }
  }
  return out
}

/** A claim value this module will carry onward: a JSON scalar, and never a structure. */
export type ProjectedClaim = string | number | boolean | null

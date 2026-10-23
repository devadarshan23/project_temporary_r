/**
 * THE BROWSER'S HALF OF A FEDERATED SIGN-IN — W3/S7, 1 Oct 2026, G2501.
 *
 * Two things live here and nothing else: the key under which the REDIRECT
 * half leaves its three values in `sessionStorage`, and the one POST the
 * callback makes.
 *
 * 🛑 THE CALLBACK CHECKS `state` AGAINST WHAT THIS BROWSER STARTED, AND THAT
 *    IS THE LOGIN-CSRF DEFENCE — D6 §4.1.
 *
 * D6: *"the classic attack is LOGIN CSRF: the attacker completes a sign-in in
 * the victim's browser so the victim is logged into the ATTACKER's account."*
 * The attacker can obtain a perfectly valid `code` + `state` pair for their OWN
 * attempt and send the victim a link carrying both. The plane cannot tell that
 * link from an honest return — the attempt row is real and unconsumed. What it
 * lacks is THIS BROWSER's copy of the state, so the callback refuses a
 * `state` it did not itself put in `sessionStorage`, before anything is sent.
 * `sessionStorage` is per-tab and per-origin, so a link opened from another
 * site lands in a tab that never started a sign-in.
 *
 * ⚠️ THE POST IS SAME-ORIGIN, ALWAYS, AND NEVER THROUGH `?plane=`. A code and
 * a PKCE verifier are bearer material for one exchange; `planeFrom()`'s
 * allow-list is for READS, and this is the one request whose body must never
 * reach any origin but the one the browser is standing on.
 *
 * ⚠️ THE REDIRECT HALF IS NOT BUILT, AND THIS FILE SAYS SO RATHER THAN
 * PRETENDING: nothing in this repository writes a `tenant.sign_in_attempt`
 * row on a request path (`0013` grants the app role no `INSERT`) and no
 * contract operation BEGINS a sign-in. `PENDING_SIGN_IN_KEY` is the shape the
 * begin half will write; `tests/e2e/browser-login.test.ts` §24 writes it the
 * way that half will, and seeds the attempt as the migrator.
 *
 * ✅ **THE REDIRECT HALF IS BUILT — 1 Oct 2026, THE OWNER'S RULING (G2541) —
 * AND THE PARAGRAPH ABOVE IS KEPT RATHER THAN DELETED**, because it is the
 * sentence this file's reader would otherwise have trusted. `beginSignIn()`
 * below asks `resolveHomeRealm` which door, then `beginFederatedSignIn` to pin
 * it, writes `PENDING_SIGN_IN_KEY` with what the plane returned, and hands the
 * screen the URL to go to. `0290` grants the app role the column-level
 * `INSERT` the old sentence said was absent, and `tests/e2e/browser-login.test.ts`
 * §24a now starts from the `/signin` button rather than a seeded row.
 */

/**
 * THE BEGIN HALF — `/signin`'s one act.
 *
 * 🛑 THE ADDRESS NEVER LEAVES THE BROWSER. `resolveHomeRealm` is given the
 * DOMAIN and nothing that names a person (*"The client splits the address
 * locally; the address never leaves the browser until the door is chosen"*),
 * and `beginFederatedSignIn` is given the same domain and the door. Neither
 * call carries the part before the `@`.
 *
 * ⚠️ BOTH POSTS ARE SAME-ORIGIN JSON, `completeSignIn()`'s reason: the
 * response carries the PKCE verifier, which is bearer material for one
 * exchange and must reach no origin but the one the browser stands on.
 *
 * ⚠️ THE PENDING VALUES ARE WRITTEN BEFORE THE NAVIGATION, AND ONLY HERE —
 * this is the write `readPendingSignIn()` has been waiting for. The tab that
 * began is the only tab whose callback can complete (G2501).
 */
export type SignInBegin =
  | { readonly kind: 'redirect'; readonly authorizationUrl: string }
  | { readonly kind: 'not_an_address' }
  | { readonly kind: 'no_door'; readonly code: string | null }
  | { readonly kind: 'refused'; readonly status: number; readonly code: string | null }

/** The domain of an address, split HERE so the address is never sent. */
export function domainOfAddress(address: string): string | null {
  const at = address.trim().lastIndexOf('@')
  if (at < 1) return null
  const domain = address.trim().slice(at + 1)
  return domain === '' ? null : domain
}

async function codeOf(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { code?: unknown }
    return typeof body.code === 'string' ? body.code : null
  } catch {
    return null
  }
}

function postJson(doFetch: typeof fetch, path: string, body: unknown): Promise<Response> {
  return doFetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function beginSignIn(
  address: string,
  storage: Pick<Storage, 'setItem'>,
  doFetch: typeof fetch = fetch,
): Promise<SignInBegin> {
  const domain = domainOfAddress(address)
  if (domain === null) return { kind: 'not_an_address' }

  const realm = await postJson(doFetch, '/session/realm', { domain })
  if (realm.status === 422) return { kind: 'no_door', code: await codeOf(realm) }
  if (!realm.ok) return { kind: 'refused', status: realm.status, code: await codeOf(realm) }
  const routed = (await realm.json()) as { connectionId?: unknown }
  if (typeof routed.connectionId !== 'string') return { kind: 'refused', status: realm.status, code: null }
  const connectionId = routed.connectionId

  const begun = await postJson(doFetch, '/session/signin', { domain, connectionId })
  if (begun.status === 422) return { kind: 'no_door', code: await codeOf(begun) }
  if (!begun.ok) return { kind: 'refused', status: begun.status, code: await codeOf(begun) }
  const out = (await begun.json()) as { authorizationUrl?: unknown; state?: unknown; codeVerifier?: unknown }
  const { authorizationUrl, state, codeVerifier } = out
  if (typeof authorizationUrl !== 'string' || typeof state !== 'string' || typeof codeVerifier !== 'string') {
    return { kind: 'refused', status: begun.status, code: null }
  }
  const pending: PendingSignIn = { state, codeVerifier, connectionId }
  try {
    storage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify(pending))
  } catch {
    /* With nowhere to keep the verifier the callback cannot complete, so the
     * browser is not sent anywhere: a round trip that is certain to be
     * refused at the end is worse than an honest refusal now. */
    return { kind: 'refused', status: 0, code: null }
  }
  return { kind: 'redirect', authorizationUrl }
}

/** Where the redirect half leaves what the callback needs. Per tab, per origin. */
export const PENDING_SIGN_IN_KEY = 'reconcile.pendingSignIn'

/** What the redirect half stores — and the callback's whole input. */
export interface PendingSignIn {
  readonly state: string
  readonly codeVerifier: string
  readonly connectionId: string
}

export function readPendingSignIn(storage: Pick<Storage, 'getItem'>): PendingSignIn | null {
  let raw: string | null
  try {
    raw = storage.getItem(PENDING_SIGN_IN_KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const p = parsed as Record<string, unknown>
  const { state, codeVerifier, connectionId } = p
  if (typeof state !== 'string' || typeof codeVerifier !== 'string' || typeof connectionId !== 'string') {
    return null
  }
  return { state, codeVerifier, connectionId }
}

/** The callback's outcomes, as a closed union the screen renders one line for. */
export type SignInCompletion =
  | { readonly kind: 'signed_in'; readonly landing: string }
  | { readonly kind: 'not_started' }
  | { readonly kind: 'state_mismatch' }
  | { readonly kind: 'refused'; readonly status: number; readonly code: string | null }

/**
 * Complete the sign-in. Same-origin, JSON — so the request cannot be forged
 * by a cross-site form (D6 §4.1's incidental protection, kept on purpose).
 *
 * The plane answers a `303` to a PATH with the cookie on it; `fetch` follows
 * it, so a signed-in answer arrives `redirected` with its final URL on THIS
 * origin, and the screen navigates there.
 */
export async function completeSignIn(
  query: URLSearchParams,
  pending: PendingSignIn | null,
  doFetch: typeof fetch = fetch,
): Promise<SignInCompletion> {
  if (pending === null) return { kind: 'not_started' }
  const state = query.get('state')
  const code = query.get('code')
  if (state === null || code === null || state !== pending.state) return { kind: 'state_mismatch' }
  const res = await doFetch('/session/federated', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      state,
      code,
      codeVerifier: pending.codeVerifier,
      connectionId: pending.connectionId,
    }),
  })
  if (res.redirected && res.ok) {
    const landing = new URL(res.url)
    return { kind: 'signed_in', landing: `${landing.pathname}${landing.search}` }
  }
  let errorCode: string | null = null
  try {
    const body = (await res.json()) as { code?: unknown }
    errorCode = typeof body.code === 'string' ? body.code : null
  } catch {
    errorCode = null
  }
  return { kind: 'refused', status: res.status, code: errorCode }
}

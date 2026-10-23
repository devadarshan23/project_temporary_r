/**
 * `/lookup`'s one read — `resolveHomeRealm`, asked for a DOMAIN. G3075,
 * 2 Oct 2026.
 *
 * 🛑 THE ADDRESS NEVER LEAVES THE BROWSER. The contract's own sentence: *"The
 * client splits the address locally; the address never leaves the browser until
 * the door is chosen."* `domainOfAddress()` is `api/signin.ts`'s, imported rather
 * than written a second time, so `/signin` and `/lookup` split an address one way.
 *
 * 🛑 FOUR REFUSALS, ONE ARM. `resolveHomeRealm` answers its four routing
 * refusals with ONE status and distinguishes them by `ErrorCode` alone. This
 * union does not carry the code at all, so the screen CANNOT say which of the
 * four it got — `domain_not_verified` would tell a stranger an organisation is
 * mid-onboarding, `connection_disabled` that a customer suspended sign-in (D6's
 * third-party-disclosure question, G1990). What the screen can reveal is exactly
 * what the 200-versus-422 split already reveals and no more: whether the domain
 * has a door here. That domain-existence signal is the contract's, accepted
 * knowingly and named on `resolveHomeRealm` as D6's first question; this file
 * adds nothing to it.
 *
 * ⚠️ AN ID, NEVER A HOST. `RealmRouting` carries `connectionId` and nothing else
 * — *"Routing chooses the door; the door decides"* — so this file cannot tell a
 * person WHICH HOST they belong on, and it does not invent one. The routed arm
 * therefore carries no host, and the screen says so (G3076).
 *
 * 🛑 AND ON THE APEX THE HAND-OFF CANNOT BE A SAME-ORIGIN SIGN-IN — G3153,
 * 2 Oct 2026. This file was `frontend/src/api/lookup.ts` and moved into the apex
 * site under the owner's ruling. In the application bundle, Continue called
 * `/signin`'s own `beginSignIn()`, which posts `/session/signin` SAME-ORIGIN and
 * keeps the PKCE verifier in that origin's `sessionStorage`. On the apex neither
 * holds: the apex proxies `/session/realm` and NOTHING ELSE (G1966 refuses
 * `/session/<*>`, because a 200 rewrite makes every cookie the APEX's), and a
 * verifier left in the apex's storage is unreadable by the tenant host the
 * callback lands on. Sign-in begins on the TENANT HOST — `/signin` there, which
 * is what staging's own runbook drives (`docs/build/deploy-handoff.md` §21).
 *
 * ⚠️ AND THE TENANT HOST IS NOT IN THE REALM'S ANSWER, SO THE PERSON NAMES IT.
 * `RealmRouting` is a `connectionId` and nothing else; a door is not a host, and
 * several tenants may sit behind one directory. So `signInUrlFor()` builds the
 * host from the sign-in NAME the person types — their organisation's label, the
 * one their IT team gave them — through `tenantHost()`, the only constructor of a
 * tenant host the edge uses. It never guesses one from the domain: G179 says
 * resolution is *"a CONFIGURATION LOOKUP, never a pattern"*, and
 * `acme.example → acme` is exactly the pattern. Nothing new leaves the browser:
 * the navigation carries no address, no domain and no connection id.
 */

/** A tenant label: one DNS label, lower case, and never a reserved one (G179). */
export const SIGN_IN_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Where Continue goes for a sign-in name, or `null` for one that cannot be a
 * tenant's. A reserved label (`console`, `auth`, `www` …) is refused here
 * rather than navigated to, because each is claimed by something that is not a
 * tenant and none of them begins a tenant's sign-in.
 */
export function signInUrlFor(name: string): string | null {
  const label = name.trim().toLowerCase()
  if (!SIGN_IN_NAME.test(label) || isReservedHostLabel(label)) return null
  return `https://${tenantHost(label)}/signin`
}

/** The suffix the screen draws after the field, so the person sees the host they are naming. */
export const SIGN_IN_HOST_SUFFIX = tenantHost('')

import { isReservedHostLabel, tenantHost } from '../../../../infra/lib/config.ts'
import { domainOfAddress } from '../../../src/api/signin.ts'

export type RealmLookup =
  | { readonly kind: 'not_an_address' }
  | { readonly kind: 'routed'; readonly domain: string }
  | { readonly kind: 'no_door'; readonly domain: string }
  | { readonly kind: 'unanswered' }

export async function lookUpRealm(address: string, doFetch: typeof fetch = fetch): Promise<RealmLookup> {
  const domain = domainOfAddress(address)
  if (domain === null) return { kind: 'not_an_address' }
  let res: Response
  try {
    res = await doFetch('/session/realm', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ domain }),
    })
  } catch {
    return { kind: 'unanswered' }
  }
  if (res.status === 422) return { kind: 'no_door', domain }
  if (res.status !== 200) return { kind: 'unanswered' }
  try {
    const body = (await res.json()) as { connectionId?: unknown }
    return typeof body.connectionId === 'string' ? { kind: 'routed', domain } : { kind: 'unanswered' }
  } catch {
    return { kind: 'unanswered' }
  }
}

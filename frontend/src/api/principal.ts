/**
 * WHO AM I — `GET /session/principal`, `getSessionPrincipal`. G3354–G3360,
 * 3 Oct 2026 (derived).
 *
 * The chrome's who-am-I and its entity label. Until this read the account menu
 * said *"Signed in · your account"*, because nothing the plane served named the
 * signed-in person or the tenant, and a name drawn there would have been
 * invented.
 *
 * 🛑 EVERY STRING HERE IS RENDERED AS TEXT AND NEVER AS MARKUP. `displayName`
 * is what the person's DIRECTORY said, stored verbatim (D6-9) — under BYOA that
 * directory is the customer's — and `tenant.name` is the platform's roster
 * entry. A React text node escapes both; nothing in `frontend/src` may put
 * either into `dangerouslySetInnerHTML`, an attribute that is interpreted, or a
 * URL.
 *
 * ⚠️ NO TENANT IN THE REQUEST, BY CONSTRUCTION. The operation declares no
 * parameter and no body; the tenant it answers about is the one the SESSION
 * ROW is bound to (invariant 1). This function has no parameter that could
 * name one.
 */

import { call } from './exceptions.ts'

export type OrgClass = 'platform' | 'partner' | 'customer'

export interface SessionPrincipal {
  readonly userId: string
  readonly displayName: string
  readonly email: string
  readonly orgClass: OrgClass
  /** `null` = no tenant is bound to this session (a console, or before D1). */
  readonly tenant: {
    readonly tenantId: string
    readonly name: string | null
    /**
     * G4046 (the owner's) — the bound tenant's DECLARED reporting currency,
     * ISO 4217 by shape; `null` = declared none, and the chip then draws no
     * currency rather than an invented one (`db/migrations/0560` §1).
     */
    readonly reportingCurrency: string | null
  } | null
  /**
   * G3521 — the verbs the plane's gate would ALLOW this session, asked once
   * per verb. ADVISORY, FOR DRAWING ONLY (`capabilities.ts`): a control whose
   * verb is absent is hidden, and every operation still gates server-side.
   */
  readonly capabilities: readonly string[]
  /**
   * G4045 (the owner's) — the labels of the roles this session LIVE-holds,
   * as the gate counts them. TENANT-AUTHORED TEXT: rendered as text nodes,
   * never as markup (D6-9). `[]` when the session holds none.
   */
  readonly roles: readonly string[]
}

const CURRENCY_SHAPE = /^[A-Z]{3}$/

const ORG_CLASSES: readonly OrgClass[] = ['platform', 'partner', 'customer']

/** The session tier lives at the ROOT, not under `/v1`. */
export function principalEndpoint(origin: string): URL {
  const base = new URL(origin)
  if (base.search !== '' || base.hash !== '') {
    throw new Error(
      'the plane origin carries a query or a fragment, which a plane origin never does — ' +
        'refused rather than stripped, because it is the shape that smuggles a tenant.',
    )
  }
  return new URL('/session/principal', base.origin)
}

/**
 * Read who this session is. Throws `PlaneRefused` on any non-2xx.
 *
 * 🛑 THE CHECKS REFUSE; THEY NEVER REPAIR. A body missing a `required` key is
 * an error rather than a principal with a blank in it — the chrome then falls
 * back to saying nothing about who is signed in, which is true.
 */
export async function fetchSessionPrincipal(origin: string): Promise<SessionPrincipal> {
  const body = await call(principalEndpoint(origin), { method: 'GET' })
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('`getSessionPrincipal` did not answer with a `SessionPrincipal`')
  }
  const b = body as Record<string, unknown>
  const { userId, displayName, email, orgClass, tenant, capabilities, roles } = b
  if (
    typeof userId !== 'string' ||
    typeof displayName !== 'string' ||
    typeof email !== 'string' ||
    typeof orgClass !== 'string' ||
    !(ORG_CLASSES as readonly string[]).includes(orgClass) ||
    !('tenant' in b) ||
    !Array.isArray(capabilities) ||
    !capabilities.every((c): c is string => typeof c === 'string') ||
    !Array.isArray(roles) ||
    !roles.every((r): r is string => typeof r === 'string')
  ) {
    throw new Error('`getSessionPrincipal` answered without one of its seven required keys')
  }
  let boundTenant: SessionPrincipal['tenant'] = null
  if (tenant !== null) {
    if (typeof tenant !== 'object' || Array.isArray(tenant)) {
      throw new Error('`getSessionPrincipal` answered a `tenant` that is neither an object nor null')
    }
    const t = tenant as Record<string, unknown>
    const name = t['name']
    const currency = t['reportingCurrency']
    if (
      typeof t['tenantId'] !== 'string' ||
      !('name' in t) ||
      (name !== null && typeof name !== 'string') ||
      !('reportingCurrency' in t) ||
      (currency !== null && (typeof currency !== 'string' || !CURRENCY_SHAPE.test(currency)))
    ) {
      throw new Error('`getSessionPrincipal` answered a `tenant` without its three required keys')
    }
    boundTenant = { tenantId: t['tenantId'], name: name, reportingCurrency: currency }
  }
  return { userId, displayName, email, orgClass: orgClass as OrgClass, tenant: boundTenant, capabilities, roles }
}

/**
 * END THIS BROWSER'S SESSION — `signOut`, `DELETE /session` on the plane this
 * tab reads (RC-12, 3 Oct 2026). Idempotent on the plane, and a failure is
 * swallowed: a plane that does not answer holds no session this tab can end,
 * and the sign-in page is still the honest next place either way.
 */
export async function signOutAt(origin: string): Promise<void> {
  const url = new URL('/session', principalEndpoint(origin).origin)
  try {
    await fetch(url, { method: 'DELETE', credentials: 'same-origin', redirect: 'error', headers: { accept: 'application/json' } })
  } catch {
    /* See above — the caller navigates to sign-in regardless. */
  }
}

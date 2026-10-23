/**
 * D1 FROM THE BROWSER — `POST /context/resolve`, `resolveTenantContext`.
 * G3213, applying G3006 (2 Oct 2026, THE OWNER'S RULING): *"D1 reads the
 * cookie: POST /context/resolve takes the session from the HttpOnly cookie
 * (not the body); the tenant still comes only from the host registry and
 * selectTenantForSession() still checks membership/grant. Mint stays
 * tenant-less (G726/S2 unchanged)."*
 *
 * 🛑 UNTIL THIS FILE NOTHING IN `frontend/src` CALLED D1, AND IT COULD NOT
 * HAVE. The contract required the handle in the body as well as on the
 * cookie, and the cookie is `HttpOnly` — page script cannot read it, so no
 * browser could build that body. A sign-in minted a TENANT-LESS session (G726,
 * S2) and nothing bound one, so every read after a real sign-in answered
 * `tenant_context_missing`. `tests/e2e/single-origin.ts` recorded the absence
 * as a search of this directory that returned nothing — the search is not
 * repeated here, because this file would now be its only match.
 *
 * ⚠️ THE BODY IS `{}` AND NOTHING ELSE, BY CONTRACT. It is a CLOSED EMPTY
 * object, so this client cannot state a tenant even by mistake — a `tenantId`
 * here is a 400. The tenant is the HOST's (G179), checked against a live
 * membership or staff grant by `selectTenantForSession()` (G199/G729); this
 * function has no parameter that could name one.
 *
 * ⚠️ IDEMPOTENT ON THE SAME HOST, which is why the app may call it on every
 * boot rather than tracking whether it already did: the selection write sets
 * the session's tenant to the one the host names, and on a session already
 * bound to that tenant it writes the same value.
 */

import { call } from './exceptions.ts'

/**
 * `TenantContext` as the plane serves it — `foundation.openapi.yaml`'s four
 * `required` keys, mirrored from `model/access.ts`. 🛑 THERE IS NO DISPLAY
 * NAME AND NO PERSON IN IT, and the chrome draws only what is here: a tenant
 * name or a person's name would be invented.
 */
export interface TenantContext {
  readonly tenantId: string
  readonly environment: string
  readonly residency: string
  readonly deploymentMode: string
}

/** D1 lives at the ROOT, not under `/v1` — the foundation tier has no base path. */
export function contextEndpoint(origin: string): URL {
  const base = new URL(origin)
  if (base.search !== '' || base.hash !== '') {
    throw new Error(
      'the plane origin carries a query or a fragment, which a plane origin never does — ' +
        'refused rather than stripped, because it is the shape that smuggles a tenant.',
    )
  }
  return new URL('/context/resolve', base.origin)
}

/**
 * Bind this session to the tenant served on this host, and read back what was
 * bound. Throws `PlaneRefused` on any non-2xx — a 401 is "no session", a 403
 * is "nothing for this session here", and the caller renders each.
 *
 * 🛑 THE CHECKS REFUSE; THEY NEVER REPAIR. A body missing a `required` key is
 * an error rather than a context with a blank in it.
 */
export async function resolveTenantContext(origin: string): Promise<TenantContext> {
  const body = await call(contextEndpoint(origin), { method: 'POST', body: {} })
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('`resolveTenantContext` did not answer with a `TenantContext`')
  }
  const b = body as Record<string, unknown>
  const { tenantId, environment, residency, deploymentMode } = b
  if (
    typeof tenantId !== 'string' ||
    typeof environment !== 'string' ||
    typeof residency !== 'string' ||
    typeof deploymentMode !== 'string'
  ) {
    throw new Error('`resolveTenantContext` answered without one of its four required keys')
  }
  return { tenantId, environment, residency, deploymentMode }
}

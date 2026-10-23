/**
 * ════════════════════════════════════════════════════════════════════════════
 * `bindEndpointCredential` — C9's FIRST VERTICAL SLICE.
 * G2401, THE OWNER'S RULING OF 1 Oct 2026; G2402–G2410 derived.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `PUT /endpoints/{endpointId}/credential`, gated on `bind_secret` — the one
 * capability in the closed set whose class is `secret`
 * (`CAPABILITY_RESOURCE_CLASS.bind_secret`), and the verb
 * `CONNECTOR_PARAMETER_ENFORCEMENT.credential_ref.settableBy` already named.
 *
 * WHAT ONE CALL DOES, IN ORDER, INSIDE `authorisedHandler()`'s TRANSACTION —
 * whose authorisation record (invariant 10) is written BEFORE this body runs:
 *
 *   1. Read THIS tenant's key handle (`tenant.tenant_key_handle`, `0270` §2).
 *      Absent → refused. **Never a fallback to another key**: no handle means
 *      no key the ruling permits, and `aws/secretsmanager` is the account's
 *      shared key.
 *   2. Read and LOCK the endpoint (`FOR UPDATE`). No row → 404, and RLS makes
 *      another tenant's endpoint indistinguishable from none (§5).
 *   3. Reuse its handle (rotation) or MINT one — 16 random bytes, never derived
 *      from a tenant, an endpoint or the value.
 *   4. Write the secret through `CredentialCustody` — create under the tenant's
 *      key, or rotate.
 *   5. Write the HANDLE (never the value) and the act's authorisation id onto
 *      the row.
 *
 * 🛑 THE SECRET IS WRITTEN BEFORE THE ROW, AND THE COST OF THAT ORDER IS NAMED
 *    RATHER THAN HIDDEN (G2406). The two writes are in two systems and cannot
 *    be atomic. Row first would leave a COMMITTED reference to a secret that
 *    may not exist — a source "waiting on a credential" that claims to have
 *    one. Secret first leaves, on a crash between 4 and 5, an ORPHAN SECRET:
 *    a value under the tenant's key that no row names. That is the safe
 *    direction — nothing reads an unnamed secret, the person who typed it
 *    sees a 500 and binds again, and the retry mints a fresh handle. Orphans
 *    are found by the prefix and are erased with the tenant's key (G287).
 *
 * 🛑 THE TENANT IS NEVER READ FROM THE REQUEST — INVARIANT 1. The body schema
 *    is `additionalProperties: false` with ONE property, so `tenantId`,
 *    `secretName`, `keyAlias` and `credentialRef` in a body are a 400 (ajv
 *    rejects rather than strips, G191). The endpoint id names a row RLS has
 *    already narrowed to the session's tenant, and the secret name and key
 *    alias are both built here from handles read under that scope.
 *
 * ✅ THE FDE TAKES THIS PATH SINCE 1 Oct 2026 — G2591, applying G2407, THE
 *    OWNER'S RULING: *"Full staff-grant branch — decide() honours the delivery
 *    grant's whole class set on every mounted operation."* ⚠️ THE PARAGRAPH
 *    THAT STOOD HERE IS QUOTED RATHER THAN DELETED, because it is the sentence
 *    the ruling was taken against:
 *
 *      *"WHAT THE RULING NAMES AND THIS DOES NOT DELIVER — G2407 … The write
 *       path is built. **The FDE cannot take it** … **Nothing in `decide()`
 *       consults a `TenantAccessGrant` at all** … Closing it is a staff-grant
 *       arm in `decide()` — and a grant's `PERMITTED_RESOURCES.delivery`
 *       includes `tenant_data`, so that arm would open every mounted read to
 *       every FDE holding a delivery grant, not only this write. **That is the
 *       owner's to rule, and it is put rather than taken.**"*
 *
 *    **It was ruled, and the broad shape was taken knowingly.** An FDE holding
 *    a LIVE delivery grant naming `secret` binds here; the act's invariant 10
 *    record names the grant (`authorization_grant_via.access_grant_id`,
 *    `db/migrations/0310`). 🛑 **AND THE COST NAMED ABOVE IS NOW REAL**: the
 *    same grant opens every mounted `tenant_data` operation to that FDE — see
 *    `decide()`'s header. `tests/http/staff-grant-arm-served.test.ts` §1 is
 *    the bind and §2 is the cost.
 *
 * ⚠️ AND THE PACK DISAGREES WITH THE RULING, RECORDED AND NOT RESTATUSED
 *    (G2408): `Functional Specification.dc.html`'s C9 row *"The credential is
 *    theirs"* reads *"Written by the customer's cloud engineer into their
 *    Secrets Manager. We never hold one"*, and is marked `built`. Under G2401
 *    the data plane holds it, encrypted under the tenant's key. The ruling is
 *    newer and the owner's; the pack's word is untouched (PR #467's rule).
 */
import { randomBytes } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import type { ScopedClient } from '../../db/tenant-scope.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import type { CredentialCustody } from './credential-store.ts'

function endpointIdOf(request: FastifyRequest): string {
  return (request.params as { endpointId: string }).endpointId
}

const CREDENTIAL_REF = /^cred_([0-9a-f]{32})$/

/** 16 random bytes. NEVER derived — see `infra/lib/config.ts`'s secret-name note. */
function mintCredentialHandle(): string {
  return randomBytes(16).toString('hex')
}

export type CredentialBindRefusal =
  | 'tenant_key_absent'
  | 'tenant_key_unreadable'
  | 'endpoint_not_found'
  | 'credential_ref_unreadable'

async function readTenantKeyHandle(
  tx: ScopedClient,
): Promise<{ ok: true; handle: string } | { ok: false; refusal: CredentialBindRefusal }> {
  /* No tenant predicate: `tenant_key_handle_rls` narrows to the session's
   * tenant, and binding none here is the convention every store keeps. */
  const result = await tx.query('SELECT key_handle FROM tenant.tenant_key_handle', [])
  const rows = result.rows as Array<{ key_handle?: unknown }>
  if (rows.length === 0) return { ok: false, refusal: 'tenant_key_absent' }
  const handle = rows[0]?.key_handle
  if (rows.length !== 1 || typeof handle !== 'string') {
    return { ok: false, refusal: 'tenant_key_unreadable' }
  }
  return { ok: true, handle }
}

async function lockEndpoint(
  tx: ScopedClient,
  endpointId: string,
): Promise<
  | { ok: true; existingHandle: string | null }
  | { ok: false; refusal: CredentialBindRefusal }
> {
  const result = await tx.query(
    'SELECT credential_ref FROM tenant.endpoint WHERE id = $1 FOR UPDATE',
    [endpointId],
  )
  const row = (result.rows as Array<{ credential_ref?: unknown }>)[0]
  if (row === undefined) return { ok: false, refusal: 'endpoint_not_found' }
  const ref = row.credential_ref
  if (ref === null || ref === undefined) return { ok: true, existingHandle: null }
  const match = typeof ref === 'string' ? CREDENTIAL_REF.exec(ref) : null
  if (match === null || match[1] === undefined) {
    return { ok: false, refusal: 'credential_ref_unreadable' }
  }
  return { ok: true, existingHandle: match[1] }
}

const NOT_FOUND_DETAIL = 'No such endpoint is visible to this session.'
const UNBOUND_DETAIL =
  'The credential was not stored and nothing was recorded as bound. Bind it again; a ' +
  'credential is never recorded as bound unless it was stored under this tenant’s key.'

export function bindEndpointCredentialOperation(custody: CredentialCustody): AuthorisedOperation {
  const body: AuthorisedBody = async ({ request, reply, tx, grant }) => {
    const endpointId = endpointIdOf(request)
    const { secretValue } = request.body as { readonly secretValue: string }

    const key = await readTenantKeyHandle(tx)
    if (!key.ok) return refused(reply, endpointId, key.refusal)

    const endpoint = await lockEndpoint(tx, endpointId)
    if (!endpoint.ok) {
      if (endpoint.refusal === 'endpoint_not_found') {
        return sendProblem(reply, {
          status: 404,
          code: CODES.resourceNotFound,
          title: 'No such endpoint.',
          detail: NOT_FOUND_DETAIL,
        })
      }
      return refused(reply, endpointId, endpoint.refusal)
    }

    const handle = endpoint.existingHandle ?? mintCredentialHandle()
    const stored = await custody.store({
      secretName: custody.secretNameFor(handle),
      keyAlias: custody.keyAliasFor(key.handle),
      value: secretValue,
      mode: endpoint.existingHandle === null ? 'create' : 'rotate',
    })
    if (!stored.ok) return refused(reply, endpointId, stored.refusal)

    const written = await tx.query(
      `UPDATE tenant.endpoint
          SET credential_ref = $2,
              credential_bound_at = now(),
              credential_bound_authorization_id = $3
        WHERE id = $1
        RETURNING credential_bound_at`,
      [endpointId, `cred_${handle}`, grant.id],
    )
    const boundAt = (written.rows as Array<{ credential_bound_at?: unknown }>)[0]
      ?.credential_bound_at
    if (boundAt === undefined || boundAt === null) {
      /* The row was locked two statements ago in this transaction, so this is
       * a defect rather than a race. The secret is now an orphan (G2406). */
      return refused(reply, endpointId, 'endpoint_not_found')
    }

    reply.code(200)
    return {
      endpointId,
      boundAt: new Date(String(boundAt)).toISOString(),
      rotated: endpoint.existingHandle !== null,
    }
  }

  return {
    operationId: 'bindEndpointCredential',
    resourceType: 'Endpoint',
    instanceOf: (request) => endpointIdOf(request),
    body,
  }
}

/**
 * Every refusal after the gate that is OUR substrate rather than the caller's
 * request is a 500 `upstream_unavailable`, and the reason goes to the log and
 * never to the wire. ⚠️ AND NEVER THE VALUE: the body is not in scope here.
 */
function refused(
  reply: Parameters<AuthorisedBody>[0]['reply'],
  endpointId: string,
  refusal: string,
) {
  console.error(
    `data-plane: \`bindEndpointCredential\` on endpoint \`${endpointId}\` refused — ` +
      `\`${refusal}\`. Nothing was recorded as bound.`,
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The credential could not be bound.',
    detail: UNBOUND_DETAIL,
  })
}

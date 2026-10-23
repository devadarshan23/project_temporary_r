/**
 * RUN A BODY INSIDE A REAL PORTAL ACT — the same three steps
 * `authorisedHandler()`'s partner branch takes, against a real PostgreSQL:
 * read the principal's portal roles, `authorize()`, write the record (which
 * names itself in `app.authorisation_ref`), then the body, in ONE transaction.
 *
 * A test that set `app.authorisation_ref` by hand would prove a policy against
 * a GUC; this proves it against the receipt the seam actually writes.
 */
import assert from 'node:assert/strict'

import { withSessionScope } from '../../db/session-scope.ts'
import type { ScopedClient, TenantPool } from '../../db/tenant-scope.ts'
import {
  CAPABILITY_RESOURCE_CLASS,
  ORG_CLASSES,
  authorize,
  type Capability,
  type PartnerAuthorizationGrant,
  type PrincipalContext,
} from '../../model/access.ts'
import type { PartnerId, Timestamp, UserId } from '../../model/kernel.ts'
import { readPartnerHeld } from '../../server/data-plane/identity.ts'
import {
  mintAuthorizationGrantId,
  writePartnerAuthorisationRecord,
} from '../../server/data-plane/authorisation-record.ts'
import { digestOf } from './partner-fixture.ts'

export async function partnerPrincipal(
  pool: TenantPool,
  handle: string,
  user: string,
  firm: string,
): Promise<PrincipalContext> {
  const out = await withSessionScope(pool, digestOf(handle), (tx) => readPartnerHeld(tx))
  if (!out.ok) throw new Error(`readPartnerHeld refused: ${out.refusal}`)
  return {
    subject: { userId: user as UserId, status: 'active' },
    tenantId: null,
    orgClass: ORG_CLASSES.partner,
    partnerId: firm as PartnerId,
    partnerGrant: null,
    held: null,
    platformHeld: null,
    partnerHeld: out.partnerHeld,
    now: new Date().toISOString() as Timestamp,
  }
}

export async function inPartnerAct<T>(
  pool: TenantPool,
  who: { readonly handle: string; readonly user: string; readonly firm: string },
  capability: Capability,
  body: (tx: ScopedClient, grant: PartnerAuthorizationGrant) => Promise<T>,
): Promise<T> {
  const principal = await partnerPrincipal(pool, who.handle, who.user, who.firm)
  const out = authorize(principal, capability, {
    id: mintAuthorizationGrantId(),
    resource: {
      resourceClass: CAPABILITY_RESOURCE_CLASS[capability],
      resourceType: 'PartnerPortal',
      resourceId: null,
      solutionId: null,
    },
    ttlSeconds: 300,
  })
  assert.ok(out.grant !== null, `authorize() refused ${capability}: ${out.decision.reason}`)
  const grant = out.grant
  if (grant.home !== 'partner') throw new Error(`a portal act minted a ${grant.home} home`)
  return withSessionScope(pool, digestOf(who.handle), async (tx) => {
    await writePartnerAuthorisationRecord(tx, grant)
    return body(tx, grant)
  })
}

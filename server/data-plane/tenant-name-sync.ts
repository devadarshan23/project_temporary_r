/**
 * THE TENANT-NAME PULL — the one writer of `tenant.tenant_name_projection`.
 * G4311–G4315, 5 Oct 2026, applying THE OWNER'S "Full restore" ruling's first
 * clause: *"copy the tenant name to the data plane"*.
 *
 * It asks the control plane for the roster over the signed internal edge
 * (`getInternalRoster`), and for every roster tenant this data plane HOLDS,
 * upserts the name inside that tenant's own scope. A roster tenant this plane
 * does not hold is skipped — the roster is fleet-wide and this plane serves a
 * subset, so `tenant.tenant`'s foreign key would refuse it anyway.
 *
 * 🛑 IT IS A SYSTEM ACT AND CARRIES NO PLATFORM AUTHORISATION, BY RULE (G4312).
 * No person asked for it: it runs at boot and every ten minutes. Invariant 10's
 * `AUTHORIZATION_MAY_BE_ABSENT` names exactly one actor kind that may leave the
 * authorisation null — `system` — and this is that actor. It sends the literal
 * `system` in `X-Platform-Authorisation-Id`, which `getInternalRoster` alone
 * admits; every internal WRITE still requires an `azg_` id.
 *
 * ⚠️ IT NEVER STOPS THE PLANE. A pull that fails is logged and retried at the
 * next tick: *"A tenant serving a reconciliation must not stop because a staff
 * console's roster is unreachable"* (`compose.yaml`, G1161's argument, carried
 * over). And it NEVER DELETES on absence — see `0600`'s header.
 */

import { randomBytes } from 'node:crypto'

import { withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import type { ControlPlaneClient } from './control-plane-client.ts'

const TENANT_SLUG = /^ten_[a-z0-9][a-z0-9_]{0,60}$/

const HOLDS_TENANT = 'SELECT 1 FROM tenant.tenant'
const UPSERT = `
  INSERT INTO tenant.tenant_name_projection (tenant_id, name, pulled_at)
  VALUES ($1, $2, now())
  ON CONFLICT (tenant_id) DO UPDATE
     SET name = EXCLUDED.name, pulled_at = now()
`

export interface NameSyncOutcome {
  readonly written: number
  readonly skipped: number
}

export async function syncTenantNames(pool: TenantPool, client: ControlPlaneClient): Promise<NameSyncOutcome> {
  const reply = await client.get('/internal/console/roster', {
    authorisationId: 'system',
    idempotencyKey: `name-sync-${randomBytes(12).toString('hex')}`,
  })
  if (reply.status !== 200) {
    throw new Error(`the control plane answered ${reply.status} to the tenant-name pull`)
  }
  const tenants = (reply.body as { tenants?: unknown } | null)?.tenants
  if (!Array.isArray(tenants)) throw new Error('the control plane answered the roster pull without a tenant list')

  let written = 0
  let skipped = 0
  for (const row of tenants as Array<Record<string, unknown>>) {
    const tenantId = row['tenantId']
    const name = row['name']
    if (typeof tenantId !== 'string' || !TENANT_SLUG.test(tenantId) || typeof name !== 'string') {
      skipped++
      continue
    }
    const wrote = await withTenantScope(pool, tenantId, async (tx) => {
      if ((await tx.query(HOLDS_TENANT)).rows.length === 0) return false
      await tx.query(UPSERT, [tenantId, name])
      return true
    })
    if (wrote) written++
    else skipped++
  }
  return { written, skipped }
}

/** Run once now and every `everyMs` thereafter, never throwing; returns a stopper. */
export function scheduleTenantNameSync(
  pool: TenantPool,
  client: ControlPlaneClient,
  everyMs = 10 * 60_000,
): { readonly first: Promise<void>; stop(): void } {
  const run = async (): Promise<void> => {
    try {
      const out = await syncTenantNames(pool, client)
      console.log(`data-plane: tenant-name pull — ${out.written} written, ${out.skipped} skipped`)
    } catch (err) {
      console.error(`data-plane: tenant-name pull failed and will be retried — ${(err as Error).message}`)
    }
  }
  const first = run()
  const timer = setInterval(() => void run(), everyMs)
  timer.unref()
  return { first, stop: () => clearInterval(timer) }
}

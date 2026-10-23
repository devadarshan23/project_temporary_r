/**
 * `db/migrations/0600_tenant_name_projection.sql` and its one writer,
 * `server/data-plane/tenant-name-sync.ts` — G4311–G4315, 5 Oct 2026, THE
 * OWNER'S "Full restore" ruling: *"copy the tenant name to the data plane"*.
 *
 *   §1  ENABLEd and FORCEd; a scope reads its own name and no other tenant's.
 *   §2  the app role may upsert only INSIDE its scope — a cross-tenant write is
 *       refused by the policy's `WITH CHECK` — and holds no `DELETE`.
 *   §3  the pull writes every roster tenant this plane HOLDS, skips the rest,
 *       sends `system` as its authorisation (G4312), and never deletes on an
 *       empty answer.
 *   §4  a pull that fails throws to the scheduler, which logs and does not stop.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'
import type { ControlPlaneClient, InternalCall } from '../../server/data-plane/control-plane-client.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_NAME_PROJECTION_DB_NAME'] ?? runScopedName('reconcile_name_projection_test')

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { resetSchema, seedTwoTenants, migratorClient } = await import('../../db/provision.ts')
const { createAppPool, withTenantScope } = await import('../../db/tenant-scope.ts')
const { syncTenantNames, scheduleTenantNameSync } = await import('../../server/data-plane/tenant-name-sync.ts')

const probe = await probeDatabase()
const skip: false | string = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the tenant-name projection suite', probe)

async function mig(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const c = await migratorClient()
  try {
    return (await c.query(sql, params)).rows as Array<Record<string, unknown>>
  } finally {
    await c.end()
  }
}

function fakeControlPlane(tenants: unknown[] | null, calls: InternalCall[] = []): ControlPlaneClient {
  return {
    configured: true,
    get: async (_path, call) => {
      calls.push(call)
      return tenants === null ? { status: 503, body: null } : { status: 200, body: { tenants } }
    },
    post: async () => {
      throw new Error('the name pull must not write')
    },
  }
}

const fact = (tenantId: string, name: string): Record<string, unknown> => ({
  tenantId,
  name,
  deploymentMode: 'hosted',
  residency: 'us-west-2',
  supportAccessMode: 'never',
  plan: null,
  completedSteps: 0,
  forced: [],
})

describe('0600 · the tenant name, projected onto the data plane', { skip }, () => {
  let pool: Awaited<ReturnType<typeof createAppPool>>

  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    pool = await createAppPool(2)
  })
  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  it('§3 · the pull writes held tenants, skips the rest, and authorises as `system`', async () => {
    const calls: InternalCall[] = []
    const out = await syncTenantNames(
      pool,
      fakeControlPlane([fact('ten_acme', 'Acme Corporation'), fact('ten_borealis', 'Borealis'), { tenantId: 'TEN DROP' }], calls),
    )
    assert.deepEqual(out, { written: 1, skipped: 2 })
    assert.equal(calls[0]?.authorisationId, 'system')
    assert.deepEqual(await mig('SELECT tenant_id, name FROM tenant.tenant_name_projection'), [
      { tenant_id: 'ten_acme', name: 'Acme Corporation' },
    ])
    /* A rename reaches the projection on the next pull. */
    await syncTenantNames(pool, fakeControlPlane([fact('ten_acme', 'Acme Corp (renamed)')]))
    assert.deepEqual(await mig('SELECT name FROM tenant.tenant_name_projection'), [{ name: 'Acme Corp (renamed)' }])
    /* An EMPTY roster erases nothing. */
    await syncTenantNames(pool, fakeControlPlane([]))
    assert.equal((await mig('SELECT 1 FROM tenant.tenant_name_projection')).length, 1)
  })

  it('§1 · ENABLEd and FORCEd, and a scope reads its own name and no other tenant`s', async () => {
    const rls = await mig(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'tenant.tenant_name_projection'::regclass`,
    )
    assert.deepEqual(rls, [{ relrowsecurity: true, relforcerowsecurity: true }])
    const globex = await withTenantScope(pool, 'ten_globex', async (tx) =>
      (await tx.query('SELECT name FROM tenant.tenant_name_projection')).rows,
    )
    assert.deepEqual(globex, [], 'a tenant read another tenant`s projected name')
  })

  it('§2 · a cross-tenant write is refused by the policy, and the app role cannot DELETE', async () => {
    await assert.rejects(
      withTenantScope(pool, 'ten_globex', async (tx) =>
        tx.query(`INSERT INTO tenant.tenant_name_projection (tenant_id, name) VALUES ('ten_acme', 'forged')`),
      ),
      /row-level security/,
    )
    await assert.rejects(
      withTenantScope(pool, 'ten_acme', async (tx) => tx.query('DELETE FROM tenant.tenant_name_projection')),
      /permission denied/,
    )
  })

  it('§4 · a pull that fails is logged by the scheduler and the plane keeps going', async () => {
    const s = scheduleTenantNameSync(pool, fakeControlPlane(null), 60_000)
    await s.first
    s.stop()
    await assert.rejects(syncTenantNames(pool, fakeControlPlane(null)), /answered 503/)
  })
})

/**
 * `db/migrations/0560_tenant_reporting_currency.sql` — G4046, THE OWNER'S
 * RULING (4 Oct 2026): *"Declare tenant currency."* Applied as G4101–G4110.
 *
 *   §1  the table is tenant-scoped exactly as `0001` scopes `tenant.tenant`:
 *       ENABLEd AND FORCEd, and a scope reads its OWN tenant's declaration and
 *       nobody else's — the negative control is a scope that declared none.
 *   §2  NO DEFAULT and NO BACKFILL: a tenant `0560` did not name has no row,
 *       and an INSERT that omits the currency is refused (`0560` §1).
 *   §3  the SHAPE check: three upper-case letters, never a membership list
 *       (`0560` §2) — `sgd`, `SG` and `` are refused, `XTS` is admitted.
 *   §4  `SELECT` AND NOTHING ELSE to the app role (`0560` §3): no request path
 *       can declare or change how a tenant's figures are reported.
 *   §5  it is NOT on the control-owned row: `tenant.tenant` is still G185(d)'s
 *       projection and gains no currency column (the placement `0560` §0
 *       refuses, held as an absence).
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_REPORTING_CURRENCY_DB_NAME'] ?? runScopedName('reconcile_reporting_currency_test')

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { resetSchema, seedTwoTenants, migratorClient } = await import('../../db/provision.ts')
const { createAppPool, withTenantScope } = await import('../../db/tenant-scope.ts')

const probe = await probeDatabase()
const skip: false | string = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the tenant reporting currency suite', probe)

async function mig(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const c = await migratorClient()
  try {
    return (await c.query(sql, params)).rows as Array<Record<string, unknown>>
  } finally {
    await c.end()
  }
}

describe('0560 · a tenant`s declared reporting currency', { skip }, () => {
  let pool: Awaited<ReturnType<typeof createAppPool>>

  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await mig(`INSERT INTO tenant.tenant_reporting_currency (tenant_id, currency) VALUES ('ten_acme', 'SGD')`)
    pool = await createAppPool(2)
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  it('§1 · ENABLEd and FORCEd, and a scope reads its own declaration and no other tenant`s', async () => {
    const rls = await mig(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE oid = 'tenant.tenant_reporting_currency'::regclass`,
    )
    assert.deepEqual(rls, [{ relrowsecurity: true, relforcerowsecurity: true }])
    const acme = await withTenantScope(pool, 'ten_acme', async (tx) =>
      (await tx.query('SELECT tenant_id, currency FROM tenant.tenant_reporting_currency')).rows,
    )
    assert.deepEqual(acme, [{ tenant_id: 'ten_acme', currency: 'SGD' }])
    const globex = await withTenantScope(pool, 'ten_globex', async (tx) =>
      (await tx.query('SELECT tenant_id, currency FROM tenant.tenant_reporting_currency')).rows,
    )
    assert.deepEqual(globex, [], 'a tenant that declared nothing read another tenant`s declaration')
  })

  it('§2 · no default and no backfill: an omitted currency is refused, and an undeclared tenant has no row', async () => {
    const rows = await mig(`SELECT tenant_id FROM tenant.tenant_reporting_currency ORDER BY tenant_id`)
    assert.deepEqual(rows, [{ tenant_id: 'ten_acme' }], 'the migration backfilled a currency nobody declared')
    await assert.rejects(
      mig(`INSERT INTO tenant.tenant_reporting_currency (tenant_id) VALUES ('ten_globex')`),
      /null value in column "currency"/,
    )
  })

  it('§3 · ISO 4217 by SHAPE: lower case, two letters and empty are refused; an unlisted three-letter code is not', async () => {
    for (const bad of ['sgd', 'SG', '', 'SGDX']) {
      await assert.rejects(
        mig(`INSERT INTO tenant.tenant_reporting_currency (tenant_id, currency) VALUES ('ten_globex', $1)`, [bad]),
        /tenant_reporting_currency_is_iso_shaped/,
        `\`${bad}\` was admitted`,
      )
    }
    /* XTS is ISO 4217's own testing code — a shape check, not a membership one. */
    await mig(`INSERT INTO tenant.tenant_reporting_currency (tenant_id, currency) VALUES ('ten_globex', 'XTS')`)
    await mig(`DELETE FROM tenant.tenant_reporting_currency WHERE tenant_id = 'ten_globex'`)
  })

  it('§4 · `SELECT` and nothing else to the app role — no request path declares a currency', async () => {
    for (const sql of [
      `INSERT INTO tenant.tenant_reporting_currency (tenant_id, currency) VALUES ('ten_acme', 'USD')`,
      `UPDATE tenant.tenant_reporting_currency SET currency = 'USD'`,
      `DELETE FROM tenant.tenant_reporting_currency`,
    ]) {
      await assert.rejects(
        withTenantScope(pool, 'ten_acme', async (tx) => tx.query(sql)),
        /permission denied for table tenant_reporting_currency/,
        sql,
      )
    }
  })

  it('§5 · it is not on the control-owned row: `tenant.tenant` carries no currency column (G185(d))', async () => {
    const cols = await mig(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'tenant' AND table_name = 'tenant' AND column_name ILIKE '%currency%'`,
    )
    assert.deepEqual(cols, [])
  })
})

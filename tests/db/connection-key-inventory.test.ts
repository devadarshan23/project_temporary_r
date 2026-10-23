/**
 * `0300` AND `withKeyInventoryScope()` — THE BOOT-TIME KEY INVENTORY, AGAINST
 * A REAL PostgreSQL. R2 as amended, the owner's ruling of 1 Oct 2026, G2571–G2576.
 *
 * The ruling says *"fetch every registered connection's JWKS at boot"*, and at
 * boot there is no session and no tenant, so every other scope in `db/` denies
 * the read under G100. `0300` adds the one policy that admits it, keyed on a
 * GUC only `db/key-inventory-scope.ts` sets. This file holds the three things
 * that make that an INVENTORY and not a cross-tenant read path:
 *
 *   §1  the policy admits BROKERED rows only, and only inside the scope;
 *   §3  the scope is READ ONLY and leaves nothing on the pooled connection;
 *   §4  the reader names three columns, and no others;
 *   §5  the helper is CALLED once in `server/`, at boot, and the GUC is
 *       spelled in one file outside the migrations.
 *
 * ⚠️ §5 IS A CENSUS AND SAYS SO. The policy admits whole rows; what bounds a
 * misuse is that nothing but boot opens the scope. G1161's phrase — *"by
 * construction becomes by census"* — and `db/key-inventory-scope.ts` records
 * the construction that was measured and does not work (a column-granted role
 * entered by `SET LOCAL ROLE`: `permission denied for table membership`).
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { KEY_INVENTORY_GUC, withKeyInventoryScope } from '../../db/key-inventory-scope.ts'
import {
  KEY_INVENTORY_READ,
  readConnectionKeyInventory,
} from '../../server/data-plane/verification-terms.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_KEY_INVENTORY_DB_NAME'] ?? runScopedName('reconcile_key_inventory_test')

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the key inventory suite', probe)

async function asMigrator(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params)).rows as Array<Record<string, unknown>>
  } finally {
    await mig.end()
  }
}

describe('0300 — the boot-time key inventory', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await asMigrator(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status, jwks_uri, audience)
       VALUES ('idc_ki_acme','oidc','Acme','customer',NULL,'acc_acme',
               'https://idp.example/pool-acme','ref-acme','active',
               'https://idp.example/pool-acme/.well-known/jwks.json','client-acme'),
              ('idc_ki_globex','oidc','Globex','customer',NULL,'acc_globex',
               'https://idp.example/pool-globex','ref-globex','active',
               'https://idp.example/pool-globex/.well-known/jwks.json','client-globex'),
              ('idc_ki_undeclared','oidc','Undeclared','customer',NULL,'acc_acme',
               'https://idp.example/pool-new','ref-new','active',NULL,NULL),
              ('idc_ki_direct','oidc','Direct','customer',NULL,'acc_acme',
               NULL,NULL,'active',NULL,NULL)`,
    )
    pool = await createAppPool(2)
  })

  after(async () => {
    await pool?.end()
  })

  it('§0 · the two columns exist, are `text`, and are NULLABLE — `0012`’s rule, argued in `0300` §1', async () => {
    const rows = await asMigrator(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = 'tenant' AND table_name = 'identity_connection'
          AND column_name IN ('jwks_uri', 'audience') ORDER BY column_name`,
    )
    assert.deepEqual(rows, [
      { column_name: 'audience', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'jwks_uri', data_type: 'text', is_nullable: 'YES' },
    ])
  })

  it('§1 · inside the scope: EVERY brokered door, across tenants, and no unbrokered one', async () => {
    const seen = await withKeyInventoryScope(pool, (tx) => readConnectionKeyInventory(tx))
    assert.deepEqual(seen, [
      { connectionId: 'idc_ki_acme', jwksUri: 'https://idp.example/pool-acme/.well-known/jwks.json', audience: 'client-acme' },
      { connectionId: 'idc_ki_globex', jwksUri: 'https://idp.example/pool-globex/.well-known/jwks.json', audience: 'client-globex' },
      /* VISIBLE with both NULL, deliberately — `0300` §2: it must be reported
       * unverifiable BY NAME at boot, not silently absent. */
      { connectionId: 'idc_ki_undeclared', jwksUri: null, audience: null },
    ])
  })

  it('§1b · ANTI-VACUITY — outside the scope, the app role sees no door at all', async () => {
    const c = await pool.connect()
    try {
      await c.query('BEGIN READ ONLY')
      const rows = (await c.query('SELECT id FROM tenant.identity_connection')).rows
      await c.query('COMMIT')
      assert.deepEqual(rows, [], 'the inventory policy leaks without its GUC')
    } finally {
      c.release()
    }
  })

  it('§1c · a TENANT scope does not see the inventory — the policy is keyed on its own GUC alone', async () => {
    const rows = await withTenantScope(pool, 'ten_acme', async (tx) =>
      (await tx.query('SELECT id FROM tenant.identity_connection')).rows,
    )
    assert.deepEqual(rows, [])
  })

  it('§1d · a GUC value other than the one constant admits nothing', async () => {
    const c = await pool.connect()
    try {
      await c.query('BEGIN READ ONLY')
      await c.query('SELECT set_config($1, $2, true)', [KEY_INVENTORY_GUC, 'yes'])
      const rows = (await c.query('SELECT id FROM tenant.identity_connection')).rows
      await c.query('COMMIT')
      assert.deepEqual(rows, [])
    } finally {
      c.release()
    }
  })

  it('§2 · the policy is `FOR SELECT` — G1982’s lesson, `0027`’s before it', async () => {
    const rows = await asMigrator(
      `SELECT cmd, permissive FROM pg_policies
        WHERE schemaname = 'tenant' AND tablename = 'identity_connection'
          AND policyname = 'identity_connection_key_inventory_rls'`,
    )
    assert.deepEqual(rows, [{ cmd: 'SELECT', permissive: 'PERMISSIVE' }])
  })

  it('§3 · the scope is READ ONLY, and the GUC does not outlive it on the pooled connection', async () => {
    await assert.rejects(
      withKeyInventoryScope(pool, (tx) =>
        tx.query(`UPDATE tenant.identity_connection SET jwks_uri = 'https://attacker.example/jwks'`),
      ),
      /read-only transaction|permission denied/,
    )
    const c = await pool.connect()
    try {
      const guc = (await c.query('SELECT current_setting($1, true) AS v', [KEY_INVENTORY_GUC])).rows[0]
      assert.ok(guc?.['v'] === '' || guc?.['v'] === null, 'the inventory GUC survived COMMIT/ROLLBACK')
    } finally {
      c.release()
    }
    const after = await asMigrator(`SELECT jwks_uri FROM tenant.identity_connection WHERE id = 'idc_ki_acme'`)
    assert.equal(after[0]?.['jwks_uri'], 'https://idp.example/pool-acme/.well-known/jwks.json')
  })

  it('§4 · the reader names exactly three columns — the only thing between the boot read and a door’s label and owner', () => {
    const cols = /^SELECT (.+) FROM tenant\.identity_connection\b/.exec(KEY_INVENTORY_READ)?.[1]
    assert.equal(cols, 'id, jwks_uri, audience', `the inventory read widened: ${KEY_INVENTORY_READ}`)
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §5  THE CENSUS — no database needed, and it runs even when one is absent
 * ══════════════════════════════════════════════════════════════════ */

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...tsFilesUnder(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

function visit(node: ts.Node, fn: (n: ts.Node) => void): void {
  fn(node)
  node.forEachChild((child) => visit(child, fn))
}

describe('§5 · the census that stands in for a construction', () => {
  it('5a · `withKeyInventoryScope()` is CALLED once in `server/`, in `main.ts` — boot, and nothing else', () => {
    const calls: string[] = []
    for (const file of tsFilesUnder(path.join(REPO_ROOT, 'server'))) {
      const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      visit(sf, (n) => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'withKeyInventoryScope') {
          calls.push(path.relative(REPO_ROOT, file))
        }
      })
    }
    assert.deepEqual(
      calls,
      ['server/data-plane/main.ts'],
      'the key inventory scope is opened somewhere other than boot. Its policy admits every ' +
        'brokered door\'s WHOLE ROW across tenants; what keeps that an inventory rather than a ' +
        `cross-tenant read path is that nothing but boot opens it.\n\n${calls.join('\n')}`,
    )
  })

  it('5b · the GUC is spelled in exactly one file outside the migrations — the scope helper', () => {
    const spelled: string[] = []
    for (const root of ['server', 'db']) {
      for (const file of tsFilesUnder(path.join(REPO_ROOT, root))) {
        const code = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
        if (code.includes("'app.key_inventory'")) spelled.push(path.relative(REPO_ROOT, file))
      }
    }
    assert.deepEqual(spelled, ['db/key-inventory-scope.ts'], spelled.join('\n'))
  })
})

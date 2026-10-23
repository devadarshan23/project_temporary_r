/**
 * THE TENANT SCHEMA SPLIT AND THE CONTROL-OWNED ROW PROJECTION — G185.
 *
 * ⚠️ THE FIRST LINE OF THIS FILE READ `// RED — intentionally failing on creation.`
 * AND IT IS CORRECTED HERE RATHER THAN DELETED, because it was true of the
 * commit that introduced the file and false of every commit after it. The red
 * was witnessed at `0963d3a7` against a live PostgreSQL 14.18 — 4 tests, 0 pass,
 * 4 fail, four DISTINCT domain reasons (`['public']` vs `['tenant']`; `[]` vs
 * `['id','residency','status']`; pg `42P01`; pg `3F000`) — and the file is
 * byte-identical at `844cff94`, where it goes green. That history is what the
 * marker was for; it is not a description of the file as it stands.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it.
 *
 * 🛑 THIS LINE IS NOT HYGIENE, IT IS THE FIX FOR A NAMED FLAKE. `node --test`
 * runs test FILES concurrently. `db/provision.ts` takes `PROVISION_LOCK` around
 * `createRoles()`, which serialises the cluster-wide `ALTER ROLE` statements —
 * but `resetSchema()` runs `DROP SCHEMA … CASCADE`, `CREATE SCHEMA` and
 * `applyMigrations()` OUTSIDE any lock. Two files sharing one database therefore
 * still race on the schema rebuild, and the loser fails somewhere inside
 * `applyMigrations` with a message about a relation, saying nothing about
 * tenancy. Worse, `node:test` counts a cancelled subtest as CANCELLED, not
 * FAILED, so the summary prints `ℹ fail 0` on a run in which
 * `tests/db/tenant-isolation.test.ts` — the invariant-1 suite — never executed.
 *
 * The remedy is the one `tests/http/data-plane-http.test.ts:93` already uses:
 * each concurrent database-touching file takes its own database. `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, so setting it here
 * — above the `probeDatabase()` call below — is sufficient and is the only
 * placement that is.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PROJECTION_DB_NAME'] ?? runScopedName('reconcile_projection_test')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/tenant-projection.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS TEST CARRIES INVARIANT 3 — under G185(a) the plane split IS the',
      '   grant, and a grant can only be observed against a live cluster. A run',
      '   of the suite in which it skipped is NOT evidence the schemas are',
      '   separated. The `skipped N` counter says so too.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

/** The skip REASON, not a boolean: node:test prints it beside each skipped test. */
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the tenant/control schema-split assertions', probe)

describe('tenant schema split and the control-owned row projection', () => {
  let pool: TenantPool

  // ⚠️ HOOKS RUN EVEN WHEN EVERY SUBTEST IS SKIPPED. Without this guard the
  // suite FAILS on a machine with no database instead of skipping on it.
  before(async () => {
    if (skip) return
    await resetSchema()
    // TWO arguments. ⚠️ This comment cited `db/provision.ts:192`, which the merge
    // with main moved; re-derive rather than copy —
    // `grep -n 'export async function seedTwoTenants' db/provision.ts` → :281.
    await seedTwoTenants('ten_acme', 'ten_globex')
    pool = await createAppPool(1)
  })

  after(async () => {
    if (skip) return
    await pool.end()
  })

  it('tenant_contact lives in the tenant schema, not public', { skip }, async () => {
    const mig = await migratorClient()
    try {
      const r = await mig.query(
        `SELECT table_schema FROM information_schema.tables WHERE table_name = 'tenant_contact'`,
      )
      const schemas = r.rows as Array<{ table_schema: string }>
      assert.deepEqual(
        schemas.map((x) => x.table_schema),
        ['tenant'],
      )
    } finally {
      // migratorClient() returns `Client`. db/pg.d.ts declares connect/query/end —
      // THERE IS NO release(). Use end().
      await mig.end()
    }
  })

  /**
   * ⚠️ THIS ASSERTION WAS NAMED *"id, status and residency AND NOTHING ELSE"*
   * AND EXPECTED THREE COLUMNS UNTIL 19 Sep 2026. IT IS WIDENED, NOT DELETED,
   * AND THE TWO THAT JOINED ARE NAMED HERE RATHER THAN ABSORBED INTO A LIST.
   *
   * `db/migrations/0006_tenant_context_projection.sql` adds `environment` and
   * `deployment_mode` because **D1 could not answer without them**:
   * `foundation.openapi.yaml`'s `TenantContext` is `required: [tenantId,
   * environment, residency, deploymentMode]` and 0003 shipped two of the four.
   * The alternative was a handler answering `'production'` and `'hosted'` from
   * a constant, which manufactures a compliance posture on the response every
   * other tier is told to trust.
   *
   * 🛑 G185(d) IS NOT WEAKENED AND THE ASSERTION IS STILL AN EXACT SET.
   * `name`, `account_id` and `created_at` remain control-side and remain
   * absent — that is what this test was written to hold, and a `deepEqual`
   * against a closed list is what keeps a fourth column from arriving
   * unremarked. **Both new columns are control-owned facts with NO publication
   * path**, written today by `seedTwoTenants()` and by nothing else; 0006 says
   * so on itself and records it as owed.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * ⚠️ WIDENED A SECOND TIME ON 19 Sep 2026 — `partner_id`, G576 — AND THE
   *    ASSERTION DID ITS JOB: IT WENT RED IN THE COMMIT THAT ADDED THE
   *    COLUMN, WHICH IS THE WHOLE REASON IT IS A `deepEqual` AND NOT A
   *    SUBSET CHECK.
   * ═══════════════════════════════════════════════════════════════════════
   *
   * **The question the red forced is whether `partner_id` is control-side,
   * and the honest first answer is that it LOOKS control-side.** Who sold a
   * tenant is a commercial fact; the partner registry, the arrangement, the
   * rate cards and the commission statement are all control-plane surfaces in
   * `docs/contracts/administration.openapi.yaml`, and `name` and `account_id`
   * were kept out of here for exactly that reason.
   *
   * 🛑 IT IS ADMITTED ANYWAY, AND THE DECIDING FACT IS MECHANICAL RATHER THAN
   * CATEGORICAL: **the constraint that makes the column load-bearing is a
   * data-plane constraint, and there is no cross-database foreign key.**
   * Invariant 2 is a CONJUNCTION — *"`partner_admin(P)` may read tenant `T`
   * iff `T.partnerId = P`, and only within a live `PartnerAccessGrant`"* — and
   * `tenant.partner_access_grant` is a tenant-database table because
   * `decide()` reads it on a tenant-scoped request. `0039`'s composite
   * `FOREIGN KEY (tenant_id, partner_id) REFERENCES tenant.tenant (id,
   * partner_id)` is what makes a grant into an unsold tenant UNREPRESENTABLE;
   * put the column on the control plane and that constraint cannot exist, and
   * the first conjunct degrades to a check somebody has to remember to write
   * in every future writer.
   *
   * ⚠️ AND IT IS NOT A PUBLICATION. Nothing reads this column — not a handler,
   * not a projection, not a response schema. Derive it, and read the hits
   * rather than the count, because three OTHER tables have a column of almost
   * this name: `grep -rn 'partner_id' server/` returns
   * `partner_access_grant`'s own column, `authorization_grant.partner_id` and
   * `audit_event.actor_partner_id`, and **no `SELECT` from `tenant.tenant`
   * anywhere**. **Its only reader is the
   * constraint**, which is the narrowest possible form of "the data plane
   * holds it", and it is a materially different category from `name` and
   * `account_id`, which would be read and rendered. **If a handler ever
   * SELECTs this column, that is a new decision and this paragraph is the one
   * to re-argue** — `listTenantsSold` is the operation that will want to, and
   * it is a control-plane operation reading a control-plane book.
   */
  it(
    'the data-plane projection carries id, status, residency, environment, deployment_mode and partner_id AND NOTHING ELSE',
    { skip },
    async () => {
      const mig = await migratorClient()
      try {
        const r = await mig.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'tenant' AND table_name = 'tenant'
            ORDER BY column_name`,
        )
        // G185(d): the narrow projection. name/account_id/created_at stay control-side.
        const cols = r.rows as Array<{ column_name: string }>
        assert.deepEqual(
          cols.map((x) => x.column_name),
          ['deployment_mode', 'environment', 'id', 'partner_id', 'residency', 'status'],
        )
      } finally {
        await mig.end()
      }
    },
  )

  it('a scoped read still sees only its own tenant', { skip }, async () => {
    const rows = await withTenantScope(pool, 'ten_acme', async (tx) => {
      const r = await tx.query('SELECT tenant_id, id FROM tenant.tenant_contact ORDER BY id')
      return r.rows as Array<{ tenant_id: string }>
    })
    assert.ok(rows.length > 0, 'the scoped read must return acme rows')
    assert.ok(rows.every((r) => r.tenant_id === 'ten_acme'))
  })

  // ---- NEGATIVE CONTROL. Isolation must come from the POLICY, not from the move. ----
  it('with RLS DISABLED the same read leaks both tenants', { skip }, async () => {
    const mig = await migratorClient()
    try {
      await mig.query('ALTER TABLE tenant.tenant_contact DISABLE ROW LEVEL SECURITY')
      const leaked = await withTenantScope(pool, 'ten_acme', async (tx) => {
        const r = await tx.query('SELECT DISTINCT tenant_id FROM tenant.tenant_contact')
        return r.rows as Array<{ tenant_id: string }>
      })
      assert.ok(
        leaked.length > 1,
        'with RLS off the read MUST leak — otherwise the isolation above came ' +
          'from somewhere other than the policy and this suite proves nothing',
      )
    } finally {
      await mig.query('ALTER TABLE tenant.tenant_contact ENABLE ROW LEVEL SECURITY')
      await mig.end()
    }
  })
})

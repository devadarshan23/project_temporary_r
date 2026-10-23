/**
 * THE TWO-TENANT LEAK TEST.
 *
 * `docs/build/phase-one-plan.md` §4A item 9 calls this *"the single highest-value
 * test in the repository"* and the *"only thing that can catch B5 before a
 * customer does"*. It carries **invariant 1** — tenant scope is derived from the
 * session, never read from a request.
 *
 * 🛑 A LOOSE VERSION OF THIS TEST PASSES WITH THE PROPERTY ABSENT. An audit found
 * exactly that, so four things are asserted here and none of them is optional:
 *
 *   (a) the SQL the test issues contains NO tenant predicate — asserted by
 *       reading the statement TEXT that was actually sent to the server, not by
 *       inspecting the result set. If the query carried `WHERE tenant_id = $1`,
 *       isolation would come from the query and dropping the policy would change
 *       nothing.
 *   (b) with the RLS policy DROPPED the read LEAKS — so the isolation observed
 *       in (a) is demonstrably produced by the policy and by nothing else.
 *   (c) with `SET LOCAL` OMITTED the read returns ZERO rows — G100's deny-on-NULL.
 *       This is what separates "RLS is on" from "RLS is on AND the pooled
 *       connection is carrying the setting".
 *   (d) both tenant reads ran on the SAME pooled backend, asserted by
 *       `pg_backend_pid()` — not by construction order, and not by trusting
 *       `max: 1`.
 *
 * G98 picked `pg` precisely because it exposes the backend PID, which is what
 * makes (d) an assertion rather than an assumption.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  createAppPool,
  withTenantScope,
  type TenantPool,
  type QueryResultLike,
} from '../../db/tenant-scope.ts'

/* ------------------------------------------------------------------ *
 * The fixtures. G97 — ids are readable slugs, stored VERBATIM as `text`.
 * ------------------------------------------------------------------ */

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

/**
 * THE STATEMENT UNDER TEST, AND IT IS THE POINT OF THE WHOLE FILE.
 *
 * No `WHERE`. No bound parameter. No mention of `app.tenant_id`. Every row of
 * `tenant_contact` for every tenant is in scope of this SQL, and the only thing
 * that can narrow it is the row-level security policy. Assertion (a) reads the
 * text that reached the server and proves this stayed true.
 */
const UNSCOPED_READ = 'SELECT tenant_id, id, address FROM tenant_contact ORDER BY id'

/* ------------------------------------------------------------------ *
 * Reachability. A skipped test that says so is honest; a mocked database
 * asserting isolation is a lie that will be believed.
 * ------------------------------------------------------------------ */

/* Its OWN database, scoped to this run (G4152). This suite used `db/env.ts`'s
 * default `reconcile_test` — a name it SHARED with the other suite that never
 * named one, and with every other gate on the same cluster. */
process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_TENANT_ISOLATION_DB_NAME'] ?? runScopedName('reconcile_tenant_isolation_test')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/tenant-isolation.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE TEST THAT CARRIES INVARIANT 1. A run of the suite in which',
      '   it skipped is NOT evidence that tenant isolation holds. Start a',
      '   PostgreSQL and re-run before believing a green suite.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the two-tenant leak test', probe)

/* ------------------------------------------------------------------ *
 * A recording pool.
 *
 * Wraps the real pool and captures the TEXT of every statement issued through
 * it, which is what lets assertion (a) read what was actually sent rather than
 * what we believe we asked for. Production code is not instrumented for this —
 * `withTenantScope` takes a `TenantPool`, and this satisfies it structurally.
 * ------------------------------------------------------------------ */

interface Recorded {
  readonly text: string
  readonly values: readonly unknown[]
}

function recordingPool(inner: TenantPool): {
  pool: TenantPool
  statements: Recorded[]
} {
  const statements: Recorded[] = []
  const pool: TenantPool = {
    async connect() {
      const client = await inner.connect()
      return {
        async query(text: string, values?: readonly unknown[]) {
          statements.push({ text, values: values ?? [] })
          return client.query(text, values)
        },
        release() {
          client.release()
        },
      }
    },
    async end() {
      await inner.end()
    },
  }
  return { pool, statements }
}

/** The statements that are transaction plumbing rather than the read under test. */
function isPlumbing(text: string): boolean {
  const t = text.trim().toUpperCase()
  return t === 'BEGIN' || t === 'COMMIT' || t === 'ROLLBACK' || t.startsWith('SELECT SET_CONFIG(')
}

describe('tenant isolation — two tenants, one pooled connection', { skip }, () => {
  let appPool: TenantPool
  let recorded: Recorded[]

  before(async () => {
    // Rebuilt from the migration on every run, so a crashed earlier run that
    // left a policy dropped cannot make a later run report a false green.
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)

    /**
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE, NOT A RESOURCE ECONOMY.
     *
     * With a one-connection pool the second tenant's transaction is FORCED onto
     * the very connection the first tenant's transaction just returned. That is
     * the exact condition B5 describes — RLS session variables are connection
     * state, not request state — so the test runs against the arrangement most
     * likely to leak rather than one that happens not to.
     */
    const rec = recordingPool(await createAppPool(1))
    appPool = rec.pool
    recorded = rec.statements
  })

  after(async () => {
    if (appPool !== undefined) await appPool.end()
  })

  /* ---------------------------------------------------------------- *
   * The isolation assertion, plus (a) and (d).
   * ---------------------------------------------------------------- */

  it('each tenant sees only its own rows, and neither query says so in SQL', async () => {
    const acme = await withTenantScope(appPool, ACME, async (tx) => {
      const pid = await tx.query('SELECT pg_backend_pid() AS pid')
      const rows = await tx.query(UNSCOPED_READ)
      return { pid: pidOf(pid), rows: rows.rows as Array<{ tenant_id: string }> }
    })

    const globex = await withTenantScope(appPool, GLOBEX, async (tx) => {
      const pid = await tx.query('SELECT pg_backend_pid() AS pid')
      const rows = await tx.query(UNSCOPED_READ)
      return { pid: pidOf(pid), rows: rows.rows as Array<{ tenant_id: string }> }
    })

    // Each side saw rows, and saw ONLY its own. Both halves matter: a policy
    // that denies everything would satisfy the second half alone.
    assert.ok(acme.rows.length > 0, 'acme read returned no rows at all')
    assert.ok(globex.rows.length > 0, 'globex read returned no rows at all')
    assert.deepEqual(
      [...new Set(acme.rows.map((r) => r.tenant_id))],
      [ACME],
      'the acme-scoped read returned rows belonging to another tenant',
    )
    assert.deepEqual(
      [...new Set(globex.rows.map((r) => r.tenant_id))],
      [GLOBEX],
      'the globex-scoped read returned rows belonging to another tenant',
    )

    /* (d) SAME POOLED BACKEND — asserted, not assumed. */
    assert.equal(
      acme.pid,
      globex.pid,
      'the two tenant reads ran on DIFFERENT backends, so this run proved nothing ' +
        'about a pooled connection carrying another tenant\'s session state',
    )

    /* (a) NO TENANT PREDICATE IN THE SQL THAT REACHED THE SERVER. */
    const reads = recorded.filter((s) => !isPlumbing(s.text))
    assert.ok(reads.length >= 2, 'expected the reads to have been recorded')
    for (const s of reads) {
      const text = s.text.toLowerCase()
      assert.ok(
        !text.includes('where'),
        `statement carried a WHERE clause, so isolation may come from the query rather than RLS: ${s.text}`,
      )
      assert.ok(
        !text.includes('app.tenant_id'),
        `statement referenced app.tenant_id directly: ${s.text}`,
      )
      assert.ok(
        !text.includes('tenant_id ='),
        `statement carried a tenant predicate: ${s.text}`,
      )
    }
    const theRead = reads.filter((s) => s.text === UNSCOPED_READ)
    assert.equal(theRead.length, 2, 'both reads should be the identical unscoped statement')
    for (const s of theRead) {
      assert.deepEqual(s.values, [], 'the read must bind no tenant parameter')
    }
  })

  /* ---------------------------------------------------------------- *
   * (c) THE `SET LOCAL` NEGATIVE CONTROL — G100's deny-on-NULL.
   * ---------------------------------------------------------------- */

  it('a query issued OUTSIDE withTenantScope sees zero rows (deny-on-NULL)', async () => {
    // Deliberately bypasses the helper: a checked-out connection with no
    // transaction and no set_config. This is the exact hazard G99 names in
    // Drizzle and `pg` — an autocommitted statement silently discards SET LOCAL.
    const client = await appPool.connect()
    try {
      const unset = await client.query(
        "SELECT current_setting('app.tenant_id', true) AS v",
      )
      assert.ok(
        settingIsAbsent(unset),
        'app.tenant_id leaked across pooled checkouts — SET LOCAL is not being scoped to a transaction',
      )

      const res = await client.query(UNSCOPED_READ)
      assert.equal(
        res.rowCount,
        0,
        'the policy PERMITTED on NULL. G100 requires deny-on-NULL: a forgotten ' +
          'transaction must yield an empty result set, never another tenant\'s rows',
      )
    } finally {
      client.release()
    }
  })

  /* ---------------------------------------------------------------- *
   * (b) THE NEGATIVE CONTROL — WITHOUT ROW-LEVEL SECURITY, THIS LEAKS.
   *
   * Proves the isolation asserted above is produced by RLS and by nothing
   * else. Without this test the whole file passes with the property ABSENT,
   * which is precisely the audit finding it exists to answer.
   *
   * ⚠️ THE CONTROL IS `DISABLE`, NOT `DROP POLICY`, AND THE FIRST RED RUN OF
   * THIS FILE IS WHY. Dropping the policy while RLS stays ENABLED does not
   * leak — PostgreSQL applies a default-deny when no policy matches, so the
   * read returned ZERO rows and the assertion failed with `actual: []`. That
   * is a reassuring property and it is locked in by the test below, but it
   * makes `DROP POLICY` the wrong control here: it cannot distinguish
   * "isolation comes from RLS" from "the query returns nothing".
   *
   * The realistic defect is a migration that creates the table and FORGETS to
   * enable RLS, which fails OPEN. `DISABLE ROW LEVEL SECURITY` reproduces
   * exactly that state.
   * ---------------------------------------------------------------- */

  it('with RLS DISABLED the same read leaks both tenants — isolation comes from RLS', async () => {
    const admin = await migratorClient()
    try {
      await admin.query('ALTER TABLE tenant_contact DISABLE ROW LEVEL SECURITY')

      const leaked = await withTenantScope(appPool, ACME, async (tx) => {
        const rows = await tx.query(UNSCOPED_READ)
        return rows.rows as Array<{ tenant_id: string }>
      })

      const tenants = [...new Set(leaked.map((r) => r.tenant_id))].sort()
      assert.deepEqual(
        tenants,
        [ACME, GLOBEX].sort(),
        'turning RLS OFF did not change the result, which means the isolation ' +
          'asserted by the other tests in this file is NOT coming from RLS. Either ' +
          'the query is narrowing the rows itself, or the two tenants do not both ' +
          'have fixture rows — and in either case this file is proving nothing.',
      )
    } finally {
      await admin.query('ALTER TABLE tenant_contact ENABLE ROW LEVEL SECURITY')
      await admin.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * The companion property the first red run surfaced: losing the POLICY
   * while RLS stays enabled fails CLOSED. Worth locking in — it means the
   * dangerous edit is a missing `ENABLE`, not a missing `CREATE POLICY`.
   * ---------------------------------------------------------------- */

  it('with the policy DROPPED but RLS still enabled, the read fails CLOSED', async () => {
    const admin = await migratorClient()
    try {
      await admin.query('DROP POLICY tenant_contact_rls ON tenant_contact')

      const rows = await withTenantScope(appPool, ACME, async (tx) => {
        const res = await tx.query(UNSCOPED_READ)
        return res.rowCount
      })

      assert.equal(
        rows,
        0,
        'a table with RLS enabled and NO policy returned rows. The default-deny ' +
          'this test locks in is gone, and every future table that gains ENABLE ' +
          'before its policy is now readable.',
      )
    } finally {
      await admin.query(`
        CREATE POLICY tenant_contact_rls ON tenant_contact
          USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
          WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
      `)
      await admin.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * The role attributes the three tests above silently depend on.
   *
   * Every assertion in this file is void if the pool's role can bypass a
   * policy — and a superuser or a BYPASSRLS role passes the isolation test by
   * accident, seeing everything and being asked about only one tenant at a
   * time. Asserted rather than assumed.
   * ---------------------------------------------------------------- */

  it('the pool role can neither bypass RLS nor own the table it reads', async () => {
    const attrs = await withTenantScope(appPool, ACME, async (tx) => {
      const res = await tx.query(`
        SELECT r.rolsuper, r.rolbypassrls,
               (SELECT c.relforcerowsecurity FROM pg_class c WHERE c.relname = 'tenant_contact') AS forced,
               (SELECT c.relrowsecurity      FROM pg_class c WHERE c.relname = 'tenant_contact') AS enabled,
               pg_catalog.pg_get_userbyid(
                 (SELECT c.relowner FROM pg_class c WHERE c.relname = 'tenant_contact')) AS owner
        FROM pg_roles r WHERE r.rolname = current_user
      `)
      return res.rows[0] as {
        rolsuper: boolean
        rolbypassrls: boolean
        forced: boolean
        enabled: boolean
        owner: string
      }
    })

    assert.equal(attrs.rolsuper, false, 'the pool connected as a SUPERUSER, which bypasses RLS unconditionally')
    assert.equal(attrs.rolbypassrls, false, 'the pool role holds BYPASSRLS, so no assertion in this file means anything')
    assert.equal(attrs.enabled, true, 'row level security is not enabled on tenant_contact')
    assert.equal(
      attrs.forced,
      true,
      'FORCE ROW LEVEL SECURITY is off, so the table OWNER is exempt from the policy — ' +
        'which is the exemption G100 requires be held only by the explicit BYPASSRLS role',
    )
    assert.notEqual(
      attrs.owner,
      'reconcile_app',
      'the pool role OWNS the table it reads, and an owner may disable RLS on it',
    )
  })
})

function pidOf(result: QueryResultLike): number {
  const row = result.rows[0] as { pid: number } | undefined
  assert.ok(row !== undefined, 'pg_backend_pid() returned no row')
  return row.pid
}

function settingIsAbsent(result: QueryResultLike): boolean {
  const row = result.rows[0] as { v: string | null } | undefined
  return row === undefined || row.v === null || row.v === ''
}

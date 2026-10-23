/**
 * A CO-MEMBER'S NAME, AND NOTHING ELSE ABOUT THEM — over a real PostgreSQL.
 * **G3886–G3888, 4 Oct 2026**, applying THE OWNER'S C3-05 RULING, quoted:
 *
 *   *"Narrow name-only read: a policy letting a tenant member read
 *    display_name (only) of people who share their tenant membership; widen
 *    G447's directory rule for that one column."*
 *
 * `db/migrations/0520_co_member_names.sql` argues the shape. This suite is the
 * evidence for each clause of the ruling, and for what it must NOT open:
 *
 *   §1  a co-member's name IS readable, through `tenant.co_member_name`;
 *   §2  another tenant's person is INVISIBLE (and a lapsed member is not named);
 *   §3  a reader who is NOT a member (here a partner-door person with no
 *       membership; an FDE under a staff grant is the same shape) reads no
 *       names, and a transaction with no act's record reads none either. A
 *       partner who DOES hold a membership shares it and is named — the
 *       ruling's own test;
 *   §4  `email`, `status` and every other column are UNREADABLE — through the
 *       view (it has no such column) and through the base table (the reader
 *       role holds two columns, and the app role cannot become it);
 *   §5  the app role's own reach on `tenant."user"` did not widen;
 *   §6  recursion, measured from the catalogue — `0200`'s lesson.
 *
 * WITNESSED RED, recorded rather than claimed: with `0520`'s policy written
 * `TO PUBLIC` instead of `TO reconcile_name_reader`, §5 failed — the app role's
 * base-table read returned `[{ id: 'usr_mei', email: 'mei@invalid' }, { id:
 * 'usr_priya', email: 'priya@invalid' }]`, a co-member's `email`, which is
 * exactly the column-blindness of row level security the migration's header
 * names. With the actor-membership `EXISTS` removed, §3's partner read
 * returned `['Mei Tan', 'Priya Raman']`.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget, ROLES } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool, type ScopedClient } from '../../db/tenant-scope.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_CO_MEMBER_NAMES_DB_NAME'] ?? runScopedName('reconcile_co_member_names_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_names'
const GLOBEX_DOOR = 'idc_globex_names'

const PRIYA = 'usr_priya'
const MEI = 'usr_mei'
const LAPSED = 'usr_lapsed'
const RUTH = 'usr_globex_ruth'
const PARTNER = 'usr_partner_sam'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the co-member names suite', probe)

async function seed(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query('BEGIN')
    for (const [id, owner, account] of [
      [DOOR, 'Acme Entra ID', 'acc_acme'],
      [GLOBEX_DOOR, 'Globex Okta', 'acc_globex'],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status)
         VALUES ($1, 'oidc', $2, 'customer', NULL, $3,
                 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_NAMES', $1, 'active')`,
        [id, owner, account],
      )
    }
    for (const [id, name, door] of [
      [PRIYA, 'Priya Raman', DOOR],
      [MEI, 'Mei Tan', DOOR],
      [LAPSED, 'Lapsed Lee', DOOR],
      [RUTH, 'Ruth Iyer', GLOBEX_DOOR],
      [PARTNER, 'Sam Partner', DOOR],
    ] as const) {
      await c.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, substr($1, 5) || '@invalid', $2, 'active', $3)`,
        [id, name, door],
      )
    }
    for (const tenant of [ACME, GLOBEX]) {
      await c.query(
        `INSERT INTO tenant.role
           (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, 'rol_names', 'Names', 'names', 1, 'operator', 'tenant', NULL, 'active')`,
        [tenant],
      )
    }
    for (const [tenant, id, user, revoked] of [
      [ACME, 'mem_priya', PRIYA, false],
      [ACME, 'mem_mei', MEI, false],
      [ACME, 'mem_lapsed', LAPSED, true],
      [GLOBEX, 'mem_ruth', RUTH, false],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, 'rol_names', 'seed', now() - interval '2 days', NULL,
                 CASE WHEN $4 THEN now() - interval '1 day' END)`,
        [tenant, id, user, revoked],
      )
    }
    await c.query('COMMIT')
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await c.end()
  }
}

/** Mint the act's invariant 10 record the way `writeAuthorisationRecord()` does. */
async function actUnder(tx: ScopedClient, id: string, actor: string, orgClass = 'customer'): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.authorization_grant
       (tenant_id, id, subject_user_id, org_class, partner_id, capability,
        resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
     VALUES ($1, $2, $3, $4, NULL, 'view_exception',
             'tenant_data', 'Exception', NULL, NULL, now(), now() + interval '5 minutes')`,
    [ACME, id, actor, orgClass],
  )
  await tx.query('SELECT set_config($1, $2, true)', ['app.authorisation_ref', id])
}

async function names(tx: ScopedClient): Promise<readonly string[]> {
  const rows = (await tx.query('SELECT display_name FROM tenant.co_member_name ORDER BY display_name')).rows as unknown as Array<{
    display_name: string
  }>
  return rows.map((r) => r.display_name)
}

describe('a co-member\'s name, and nothing else about them (G3886)', { skip }, () => {
  let pool: TenantPool
  let n = 0
  const grant = (): string => `agr_names_${++n}`

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(1)
  })
  after(async () => {
    await pool?.end()
  })

  it('§1 · a tenant member reads a co-member\'s display_name — and their own', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, grant(), PRIYA)
      return names(tx)
    })
    assert.deepEqual(seen, ['Mei Tan', 'Priya Raman'])
  })

  it('§2 · another tenant\'s person is invisible, and a lapsed member is not named', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, grant(), PRIYA)
      const r = (await tx.query('SELECT user_id FROM tenant.co_member_name WHERE user_id = ANY($1)', [[RUTH, LAPSED]])).rows
      return r
    })
    assert.deepEqual(seen, [], 'Ruth (Globex) or a revoked Acme membership was named to an Acme member')
  })

  it('§3 · a reader who is not a member reads no names; nor does a transaction with no act', async () => {
    const partner = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, grant(), PARTNER, 'partner')
      return names(tx)
    })
    assert.deepEqual(partner, [], 'a non-member (a partner under a grant) was shown names')
    const noAct = await withTenantScope(pool, ACME, async (tx) => names(tx))
    assert.deepEqual(noAct, [], 'a transaction carrying no invariant 10 record was shown names')
    const lapsed = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, grant(), LAPSED)
      return names(tx)
    })
    assert.deepEqual(lapsed, [], 'a reader whose own membership lapsed was shown names')
  })

  it('§4 · email and every other column are unreadable — the view has two columns, the role two privileges', async () => {
    const cols = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, grant(), PRIYA)
      const r = await tx.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'tenant' AND table_name = 'co_member_name' ORDER BY ordinal_position`,
      )
      return (r.rows as unknown as Array<{ column_name: string }>).map((c) => c.column_name)
    })
    assert.deepEqual(cols, ['user_id', 'display_name'])

    const c = await migratorClient()
    try {
      const priv = (
        await c.query(
          `SELECT column_name FROM information_schema.column_privileges
            WHERE table_schema = 'tenant' AND table_name = 'user' AND grantee = $1 AND privilege_type = 'SELECT'
            ORDER BY column_name`,
          [ROLES.nameReader],
        )
      ).rows as unknown as Array<{ column_name: string }>
      assert.deepEqual(priv.map((p) => p.column_name), ['display_name', 'id'])
      const member = (
        await c.query(
          `SELECT r.rolname FROM pg_auth_members m
             JOIN pg_roles g ON g.oid = m.roleid JOIN pg_roles r ON r.oid = m.member
            WHERE g.rolname = $1 ORDER BY r.rolname`,
          [ROLES.nameReader],
        )
      ).rows as unknown as Array<{ rolname: string }>
      assert.ok(!member.some((m) => m.rolname === ROLES.app || m.rolname === ROLES.tenantRw || m.rolname === ROLES.engine),
        `a request-path role is a member of ${ROLES.nameReader}: ${JSON.stringify(member)}`)
    } finally {
      await c.end()
    }

    await assert.rejects(
      withTenantScope(pool, ACME, async (tx) => {
        await tx.query(`SET LOCAL ROLE ${ROLES.nameReader}`)
      }),
      /permission denied to set role/,
      'the app role could become the name reader',
    )
  })

  it('§5 · the app role\'s own reach on tenant."user" did not widen: its base-table read names itself only', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, grant(), PRIYA)
      return (await tx.query('SELECT id, email FROM tenant."user" ORDER BY id')).rows
    })
    assert.deepEqual(seen, [], 'a tenant scope with a view_exception record read rows (and their email) from tenant."user"')
  })

  it('§6 · recursion: no policy on the two relations the predicate reads mentions tenant."user"', async () => {
    const c = await migratorClient()
    try {
      const rows = (
        await c.query(
          `SELECT tablename, policyname, coalesce(qual, '') || coalesce(with_check, '') AS expr
             FROM pg_policies WHERE schemaname = 'tenant' AND tablename IN ('membership', 'authorization_grant')`,
        )
      ).rows as unknown as Array<{ tablename: string; policyname: string; expr: string }>
      assert.ok(rows.length >= 2, 'the catalogue read found no policy at all — the census is vacuous')
      for (const r of rows) assert.doesNotMatch(r.expr, /"user"|\buser\b/, `${r.tablename}.${r.policyname} reads tenant."user"`)
    } finally {
      await c.end()
    }
  })
})

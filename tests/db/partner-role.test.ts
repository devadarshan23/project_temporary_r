/**
 * R10 — `db/migrations/0250_partner_role.sql` AND `readPartnerHeld()`, OVER A
 * REAL POSTGRESQL. G2321–G2326, 1 Oct 2026.
 *
 * The fifth arm's term has a producer for the first time. What this suite
 * witnesses, in the order a reader should doubt it:
 *
 *   §1  the reader returns the holder's own rows, in `decide()`'s terms
 *   §2  the policy is SESSION-keyed: a colleague at the SAME firm is invisible
 *       (G2325 — the partner-keyed alternative would have made it a roster)
 *   §3  revoked and expired rows are RETURNED, not filtered — the refusals are
 *       `decide()`'s, and an empty `WHERE` is what keeps them reachable
 *   §4  an unknown verb in `partner_role_capability` is DROPPED, never widened
 *   §5  the composite FK makes a role and an assignment that disagree about
 *       the firm UNREPRESENTABLE, even to the migrator
 *   §6  the app role holds `SELECT` and nothing else — and every policy is
 *       `FOR SELECT`, so a future `GRANT INSERT` does not inherit `USING` as a
 *       `WITH CHECK` (G1982 / `0027`)
 *   §7  `ENABLE` and `FORCE`, both, read back from the catalogue
 *   §8  end to end: the rows read here, handed to `decide()`, PERMIT a portal
 *       verb and confer NOTHING inside a customer tenant
 *
 * ⚠️ EVERY ROW HERE IS WRITTEN BY THE MIGRATOR, because nothing on a request
 *    path can write one — which is §6's own assertion, and is the reason the
 *    fifth arm refuses every real partner today at
 *    `partner_staff_assignment_absent`.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import {
  CAPABILITIES,
  ORG_CLASSES,
  decide,
  type PrincipalContext,
} from '../../model/access.ts'
import { readPartnerHeld } from '../../server/data-plane/identity.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PARTNER_ROLE_DB_NAME'] ?? runScopedName('reconcile_partner_role_test')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* Top level, OUTSIDE every `describe` — `tests/ci/reachability-guards.test.ts`. */
databaseRequiredUnderCi('the partner role suite', probe)

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const NORTHWIND = 'prt_northwind'
const CONTOSO = 'prt_contoso'
const CONNECTION = 'idc_northwind_okta'
const ANA = 'usr_northwind_ana'
const BEN = 'usr_northwind_ben'
const ANA_DIGEST = 'digest_ana_7c1e0f2b9d4a46e8b3a1c5d7e9f0a2b4'
const BEN_DIGEST = 'digest_ben_8d2f1a3c0e5b47f9c4b2d6e8f0a1b3c5'

type UserId = PrincipalContext['subject']['userId']
type Timestamp = PrincipalContext['now']

async function asMigrator(sql: string, params: readonly unknown[] = []): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql, params as unknown[])
  } finally {
    await mig.end()
  }
}

async function migratorRows(sql: string): Promise<Array<Record<string, unknown>>> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql)).rows as Array<Record<string, unknown>>
  } finally {
    await mig.end()
  }
}

async function refusalOf(sql: string): Promise<string | null> {
  const mig = await migratorClient()
  try {
    await mig.query(sql)
    return null
  } catch (err) {
    return (err as { code?: string }).code ?? '?'
  } finally {
    await mig.end()
  }
}

async function seed(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query('BEGIN')
    await c.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Northwind Okta', 'partner', $2, NULL,
               'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_R10',
               'northwind-okta-r10', 'active')`,
      [CONNECTION, NORTHWIND],
    )
    for (const id of [ANA, BEN]) {
      await c.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@northwind.invalid', $1, 'active', $2)`,
        [id, CONNECTION],
      )
    }
    /* Two firms, one role each, and ANA and BEN both at Northwind. */
    await c.query(
      `INSERT INTO tenant.partner_role (id, partner_id, label, key, version, status) VALUES
         ('prl_nw_admin', $1, 'Partner administrator', 'partner_admin', 1, 'active'),
         ('prl_nw_user',  $1, 'Partner user',          'partner_user',  1, 'active'),
         ('prl_co_admin', $2, 'Partner administrator', 'partner_admin', 1, 'active')`,
      [NORTHWIND, CONTOSO],
    )
    await c.query(
      `INSERT INTO tenant.partner_role_capability (role_id, capability) VALUES
         ('prl_nw_admin', 'view_deals'),
         ('prl_nw_admin', 'register_deal'),
         ('prl_nw_admin', 'view_partner_staff'),
         ('prl_nw_admin', 'not_a_verb_at_all'),
         ('prl_nw_user',  'view_deals')`,
    )
    await c.query(
      `INSERT INTO tenant.partner_role_assignment
         (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES
         ('pra_ana', $1, $2, 'prl_nw_admin', 1, 'seed', now(), now() + interval '30 days', NULL),
         ('pra_ben', $1, $3, 'prl_nw_user',  1, 'seed', now(), now() + interval '30 days', NULL)`,
      [NORTHWIND, ANA, BEN],
    )
    for (const [id, digest, user] of [
      ['ses_ana', ANA_DIGEST, ANA],
      ['ses_ben', BEN_DIGEST, BEN],
    ] as const) {
      /* `tenant_id` NULL: a portal session is bound to no tenant (G726/G728). */
      await c.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, NULL, 'partners.reconcileai.app',
                 now(), now(), now() + interval '12 hours', NULL)`,
        [id, digest, user, CONNECTION],
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

describe('R10 · the partner-staff substrate — 0250 and `readPartnerHeld()`', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(2)
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  it('1 · the holder reads their own assignment, role and verbs, in `decide()`s terms', async () => {
    const out = await withSessionScope(pool, ANA_DIGEST, (tx) => readPartnerHeld(tx))
    assert.equal(out.ok, true)
    if (!out.ok) return
    assert.equal(out.partnerHeld.length, 1, 'ANA holds exactly one portal role')
    const [held] = out.partnerHeld
    assert.ok(held !== undefined)
    assert.equal(held.assignment.id, 'pra_ana')
    assert.equal(held.assignment.partnerId, NORTHWIND)
    assert.equal(held.role.partnerId, NORTHWIND)
    assert.equal(
      typeof held.assignment.expiresAt,
      'string',
      'a `Date` compares as `[object Date]`, greater than every ISO string, so every ' +
        'assignment would read as unexpired and `partner_staff_assignment_expired` would ' +
        'be unreachable — the same trap `readPartnerGrant()` names.',
    )
    assert.deepEqual([...held.role.capabilities].sort(), ['register_deal', 'view_deals', 'view_partner_staff'])
  })

  it('2 · SESSION-keyed, not partner-keyed: a colleague at the SAME firm is invisible (G2325)', async () => {
    const asAna = await withSessionScope(pool, ANA_DIGEST, (tx) =>
      tx.query(`SELECT id FROM tenant.partner_role_assignment ORDER BY id`),
    )
    assert.deepEqual(
      asAna.rows.map((r) => (r as { id: string }).id),
      ['pra_ana'],
      'ANA sees BEN`s assignment. The policy has become a FIRM ROSTER — the partner-keyed ' +
        'shape `0250` refuses, and the administrative reach G447 measures this schema as ' +
        'having nowhere. Opening one is a ruling with its own capability check.',
    )
    const roles = await withSessionScope(pool, ANA_DIGEST, (tx) =>
      tx.query(`SELECT id FROM tenant.partner_role ORDER BY id`),
    )
    assert.deepEqual(
      roles.rows.map((r) => (r as { id: string }).id),
      ['prl_nw_admin'],
      'the role catalogue is visible only through an assignment the caller holds',
    )
  })

  it('2a · outside a session scope the tables read EMPTY — deny on NULL (G100)', async () => {
    const rows = await withTenantScope(pool, ACME, (tx) =>
      tx.query(`SELECT count(*)::int AS n FROM tenant.partner_role_assignment`),
    )
    assert.equal((rows.rows[0] as { n: number }).n, 0)
  })

  it('3 · a REVOKED or EXPIRED row is RETURNED — the refusal is `decide()`s, not the reader`s', async () => {
    await asMigrator(`UPDATE tenant.partner_role_assignment SET revoked_at = now() WHERE id = 'pra_ana'`)
    const revoked = await withSessionScope(pool, ANA_DIGEST, (tx) => readPartnerHeld(tx))
    await asMigrator(`UPDATE tenant.partner_role_assignment SET revoked_at = NULL WHERE id = 'pra_ana'`)
    assert.equal(revoked.ok && revoked.partnerHeld.length, 1)
    assert.notEqual(revoked.ok && revoked.partnerHeld[0]?.assignment.revokedAt, null)

    await asMigrator(
      `UPDATE tenant.partner_role_assignment SET expires_at = now() - interval '1 day' WHERE id = 'pra_ana'`,
    )
    const expired = await withSessionScope(pool, ANA_DIGEST, (tx) => readPartnerHeld(tx))
    await asMigrator(
      `UPDATE tenant.partner_role_assignment SET expires_at = now() + interval '30 days' WHERE id = 'pra_ana'`,
    )
    assert.equal(expired.ok && expired.partnerHeld.length, 1, 'the reader filtered an expired row out')
  })

  it('4 · an unknown verb is DROPPED by the reader, never carried', async () => {
    const out = await withSessionScope(pool, ANA_DIGEST, (tx) => readPartnerHeld(tx))
    assert.equal(out.ok, true)
    if (!out.ok) return
    assert.equal(out.partnerHeld[0]?.role.capabilities.includes('not_a_verb_at_all' as never), false)
  })

  it('5 · a role and an assignment that disagree about the firm are UNREPRESENTABLE (composite FK)', async () => {
    const code = await refusalOf(
      `INSERT INTO tenant.partner_role_assignment
         (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at)
       VALUES ('pra_cross', '${CONTOSO}', '${ANA}', 'prl_nw_admin', 1, 'seed', now(), now() + interval '1 day')`,
    )
    assert.equal(
      code,
      '23503',
      'an assignment naming Contoso on a Northwind role was STORED. `0250`s composite ' +
        'foreign key is what makes the pair one fact; without it the evaluator`s ' +
        '`partner_staff_other_partner` is the only thing standing between a row and a ' +
        'cross-firm role.',
    )
    const nullExpiry = await refusalOf(
      `INSERT INTO tenant.partner_role_assignment
         (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at)
       VALUES ('pra_durable', '${NORTHWIND}', '${ANA}', 'prl_nw_admin', 1, 'seed', now(), NULL)`,
    )
    assert.equal(nullExpiry, '23502', '`DURABLE_ASSIGNMENT_PERMITTED.partner` is false — a durable portal role must not store')
  })

  /* ⚠️ THIS TITLE READ *"the app role holds SELECT and nothing else, and every
   * policy is `FOR SELECT`"* UNTIL 2 Oct 2026, AND BOTH HALVES WERE THE PROPERTY
   * `0250` ASKED THE INVITATION WRITER'S COMMIT TO PAY FOR: *"the writer's
   * commit owes its own WITH CHECK."* `0370` (G2801, the owner's) is that
   * commit. ONE grant moved — `INSERT` on the assignment, for REDEMPTION — and
   * ONE policy is not `FOR SELECT`: the redemption write, `FOR INSERT` with
   * no `USING`. The self-grant below is still refused, now by that policy
   * (no sign-in transaction, no invitation) rather than by a missing grant. */
  it('6 · the app role holds SELECT, plus INSERT on the assignment for redemption alone; every other policy is `FOR SELECT`', async () => {
    for (const table of ['partner_role', 'partner_role_capability', 'partner_role_assignment']) {
      for (const verb of ['INSERT', 'UPDATE', 'DELETE']) {
        const rows = await migratorRows(
          `SELECT has_table_privilege('tenant_rw', 'tenant.${table}', '${verb}') AS p`,
        )
        const want = table === 'partner_role_assignment' && verb === 'INSERT'
        assert.equal(rows[0]?.['p'], want, `tenant_rw ${want ? 'lacks' : 'holds'} ${verb} on tenant.${table}`)
      }
    }
    await assert.rejects(
      withSessionScope(pool, ANA_DIGEST, (tx) =>
        tx.query(
          `INSERT INTO tenant.partner_role_assignment
             (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at)
           VALUES ('pra_self', '${NORTHWIND}', '${ANA}', 'prl_nw_admin', 1, '${ANA}', now(), now() + interval '1 day')`,
        ),
      ),
      /row-level security/,
    )
    const policies = await migratorRows(
      `SELECT tablename, cmd, qual FROM pg_policies
        WHERE schemaname = 'tenant' AND tablename LIKE 'partner_role%'
          AND policyname <> 'partner_role_assignment_redemption_write' ORDER BY tablename`,
    )
    const write = await migratorRows(
      `SELECT cmd, qual FROM pg_policies
        WHERE schemaname = 'tenant' AND policyname = 'partner_role_assignment_redemption_write'`,
    )
    assert.deepEqual(write, [{ cmd: 'INSERT', qual: null }])
    /* ⚠️ THREE UNTIL `0321` (G2624): the directory arm on the assignment and the
     * catalogue arm on the role are two more policies, BOTH `FOR SELECT`, so
     * the property this test names — no policy here governs a write by
     * default — is unchanged and is what the loop below still asserts. */
    /* ⚠️ AND FIVE UNTIL `0370` (G2805): the redemption arms on the assignment
     * and the role are two more, both `FOR SELECT`. */
    assert.equal(policies.length, 7)
    for (const p of policies) {
      assert.equal(
        p['cmd'],
        'SELECT',
        `${String(p['tablename'])}'s policy is ${String(p['cmd'])}. A \`FOR ALL\` policy with no ` +
          '`WITH CHECK` reuses its `USING` for INSERT (G1982, `0027`), so the day an ' +
          'invitation writer is granted INSERT a person could insert an assignment for themselves.',
      )
    }
  })

  it('7 · ENABLE and FORCE, both, on all three — read from the catalogue', async () => {
    const rows = await migratorRows(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'tenant' AND c.relname LIKE 'partner_role%' AND c.relkind = 'r'`,
    )
    assert.equal(rows.length, 3)
    for (const r of rows) {
      assert.equal(r['relrowsecurity'], true, `${String(r['relname'])} is not ENABLEd`)
      assert.equal(r['relforcerowsecurity'], true, `${String(r['relname'])} is not FORCEd`)
    }
  })

  it('8 · end to end: the rows PERMIT a portal verb and confer NOTHING inside a customer tenant', async () => {
    const out = await withSessionScope(pool, ANA_DIGEST, (tx) => readPartnerHeld(tx))
    assert.equal(out.ok, true)
    if (!out.ok) return
    const principal: PrincipalContext = {
      subject: { userId: ANA as UserId, status: 'active' },
      tenantId: null,
      orgClass: ORG_CLASSES.partner,
      partnerId: NORTHWIND as PrincipalContext['partnerId'],
      partnerGrant: null,
      held: null,
      platformHeld: null,
      partnerHeld: out.partnerHeld,
      now: new Date().toISOString() as Timestamp,
    }
    const allowed = decide(principal, CAPABILITIES.registerDeal)
    assert.equal(allowed.allowed, true, `the fifth arm refused a live, carried portal verb: ${allowed.reason}`)
    const carrier = allowed.via[0]
    /* G2591: `via` is a discriminated union — a reader discriminates first. */
    assert.equal(carrier !== undefined && 'assignmentId' in carrier ? carrier.assignmentId : null, 'pra_ana')

    const intoTenant = decide({ ...principal, tenantId: ACME as PrincipalContext['tenantId'], held: [] }, CAPABILITIES.viewException)
    assert.equal(intoTenant.allowed, false)
    assert.equal(
      intoTenant.reason,
      'partner_grant_absent',
      'a portal role must never be a second door into a customer tenant — invariant 2',
    )
  })
})

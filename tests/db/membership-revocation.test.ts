/**
 * REVOKING A MEMBERSHIP VOIDS THAT PERSON'S SESSIONS — over a real PostgreSQL.
 * **G508, G509, G510 — 19 Sep 2026.**
 * `db/migrations/0019_membership_revocation_voids_sessions.sql`.
 *
 * ┌─ 🛑 THE DEFECT THIS EXISTS AGAINST IS SILENCE, AND IT WAS MEASURED ────────┐
 * │ `tests/db/administrative-reach.test.ts` §4b measured that                  │
 * │                                                                            │
 * │     UPDATE tenant.session SET revoked_at = now() WHERE user_id = <other>   │
 * │                                                                            │
 * │ **matches zero rows and COMMITS.** It does not raise. Every other refusal  │
 * │ in this repository is a thrown policy violation; that one is `rowCount =   │
 * │ 0`. So the natural implementation of the owner's ruling — revoke their     │
 * │ sessions, then revoke the membership — would commit the membership         │
 * │ revocation, report success, and leave every session live.                  │
 * │                                                                            │
 * │ That is why the owner ruled **both** guards, and it is why the assertions  │
 * │ below check `revoked_at` on the row rather than checking that nothing      │
 * │ threw. **A test that only asserted "no error" would pass against the       │
 * │ defect.**                                                                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 1  The trigger voids the removed person's sessions — and ONLY theirs.      │
 * │ 2  END TO END as the APP ROLE, inside `withTenantScope()`, carrying an     │
 * │    invariant 10 record. This is the assertion that says the ruling is      │
 * │    BUILT rather than reachable-by-the-migrator.                    G508    │
 * │ 3  Guard 1 — an unscoped revocation RAISES and rolls the membership back.  │
 * │ 4  Guard 1 — a revocation scoped to the WRONG tenant RAISES.               │
 * │ 5  Revoke-then-unrevoke fails closed: the amended restrictive policy       │
 * │    admits only a write that leaves the session dead.                       │
 * │ 6  The amended `session_selection_restrictive` still carries EVERY source  │
 * │    — `0005`'s membership terms AND `0008`'s whole staff machinery.  G199   │
 * │ 7  From the CATALOGUE: the function is NOT `SECURITY DEFINER`, and the     │
 * │    trigger is attached.                                             G160   │
 * │ 8  `DELETE ON tenant.session` is gone.                              G510   │
 * │ 9  The lapsed-member policy is NARROW: a LIVE member's session is not      │
 * │    readable by another member's administrative act.                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ §6 IS THE ASSERTION MOST LIKELY TO BE DELETED BY SOMEBODY IN A HURRY, AND
 *    IT IS THE ONE THAT NEARLY CAUGHT A REAL DEFECT IN THIS SLICE. `ALTER
 *    POLICY … WITH CHECK (…)` REPLACES the whole expression — there is no
 *    append — so amending it means restating `0008`'s staff disjunct, and the
 *    first draft of `0019` restated it WRONG, from prose rather than from
 *    bytes: a column that does not exist, a ceiling read as a column instead of
 *    a JOIN, and the entire `NOT EXISTS` over the three governance lists simply
 *    absent. That last omission would have PARSED and APPLIED and silently
 *    widened invariant 8's staff path to `statutory`, which invariant 8 refuses
 *    *at any price*. The migration's own header records it. §6 is the control.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  createAppPool,
  withTenantScope,
  type TenantPool,
  type ScopedClient,
} from '../../db/tenant-scope.ts'
import { withSelectionScope } from '../../db/selection-scope.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ITS OWN DATABASE — `db/env.ts` resolves the name per call, and two suites
   sharing one name race inside `applyMigrations()`. */
process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_MEMBERSHIP_REVOCATION_DB_NAME'] ?? runScopedName('reconcile_membership_revocation_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DOOR = 'idc_acme_entra'
const ADMIN = 'usr_acme_admin'
const MEI = 'usr_ops_mei'

const ADMIN_DIGEST = 'digest_admin_33b1e5a02d7e64a95b31067ce4a8d29f'
const MEI_DIGEST = 'digest_mei_44b1e5a02d7e64a95b31067ce4a8d29ff'
/** A SECOND live session for Mei, so §1's count is not trivially one. */
const MEI_DIGEST_2 = 'digest_mei2_55b1e5a02d7e64a95b31067ce4a8d29'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the membership revocation suite', probe)

async function seed(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query('BEGIN')
    await c.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_REV',
               'acme-entra-rev', 'active')`,
      [DOOR],
    )
    for (const [id, name] of [
      [ADMIN, 'Acme Administrator'],
      [MEI, 'Mei Tan'],
    ] as const) {
      await c.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@acme.invalid', $2, 'active', $3)`,
        [id, name, DOOR],
      )
    }
    await c.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, 'rol_rev', 'Rev', 'rev', 1, 'operator', 'tenant', NULL, 'active')`,
      [ACME],
    )
    for (const [id, user] of [
      ['mem_admin', ADMIN],
      ['mem_mei', MEI],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, 'rol_rev', 'seed', now(), NULL, NULL)`,
        [ACME, id, user],
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

/** A SECOND live membership for Mei, minted only by §11 and torn down by
 *  `restore()`. `0005` has no `UNIQUE (tenant_id, user_id)` — *"the same pair
 *  recurs every time a person is re-granted"* — so two live memberships for one
 *  person is a SUPPORTED SHAPE and not an abuse of the fixture. */
const MEI_SECOND = 'mem_mei_2'

/** Three live sessions: one administrator's, two of Mei's, and exactly one
 *  membership each. */
async function restore(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query(`SELECT set_config('app.tenant_id', $1, false)`, [ACME])
    /* Before the liveness UPDATE, so the second membership never survives a
       section. `DELETE` fires no trigger — the trigger is `AFTER UPDATE`, and
       `0019` argues in its own header why there is no `DELETE` arm. */
    await c.query(`DELETE FROM tenant.membership WHERE id = $1`, [MEI_SECOND])
    await c.query(`UPDATE tenant.membership SET revoked_at = NULL, expires_at = NULL`)
    await c.query(`DELETE FROM tenant.session`)
    for (const [id, digest, user] of [
      ['ses_admin', ADMIN_DIGEST, ADMIN],
      ['ses_mei', MEI_DIGEST, MEI],
      ['ses_mei_2', MEI_DIGEST_2, MEI],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, 'acme.rev.invalid',
                 now(), now(), now() + interval '12 hours', NULL)`,
        [id, digest, user, DOOR, ACME],
      )
    }
  } finally {
    await c.end()
  }
}

async function sessionState(): Promise<Record<string, boolean>> {
  const c = await migratorClient()
  try {
    const rows = (
      await c.query(
        `SELECT id, revoked_at IS NOT NULL AS revoked FROM tenant.session ORDER BY id`,
      )
    ).rows as unknown as Array<{ id: string; revoked: boolean }>
    return Object.fromEntries(rows.map((r) => [r.id, r.revoked]))
  } finally {
    await c.end()
  }
}

/**
 * A migrator connection already carrying the tenant scope and — unless
 * `record` is `false` — an invariant 10 `manage_roles` record, the way §1 does
 * it inline. `reconcile_migrator` is `BYPASSRLS`, so this is the HARDEST case
 * for every guard in the trigger: row-level security refuses it nothing.
 *
 * The caller must `end()` it.
 */
async function migratorActing(
  grantId: string,
  options: { readonly tenant?: string; readonly record?: boolean } = {},
): Promise<Awaited<ReturnType<typeof migratorClient>>> {
  const c = await migratorClient()
  const tenant = options.tenant ?? ACME
  await c.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenant])
  if (options.record !== false) {
    await c.query(
      `INSERT INTO tenant.authorization_grant
         (tenant_id, id, subject_user_id, org_class, partner_id, capability,
          resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
       VALUES ($1, $2, $3, 'customer', NULL, $4,
               'authority', 'Membership', NULL, NULL, now(), now() + interval '5 minutes')`,
      [tenant, grantId, ADMIN, CAPABILITIES.manageRoles],
    )
    await c.query(`SELECT set_config('app.authorisation_ref', $1, false)`, [grantId])
  }
  return c
}

/** Mint Mei's second live membership. `restore()` removes it again. */
async function addSecondMembership(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, 'rol_rev', 'seed', now(), NULL, NULL)`,
      [ACME, MEI_SECOND, MEI],
    )
  } finally {
    await c.end()
  }
}

/** How many of this person's memberships are LIVE, read as the migrator, by the
 *  same predicate `0005`, `0008`, `0018` and `0019` all use. */
async function liveMemberships(userId: string): Promise<number> {
  const c = await migratorClient()
  try {
    const r = (
      await c.query(
        `SELECT count(*)::int AS n
           FROM tenant.membership m
          WHERE m.user_id = $1
            AND m.tenant_id = $2
            AND m.revoked_at IS NULL
            AND (m.expires_at IS NULL OR m.expires_at > now())`,
        [userId, ACME],
      )
    ).rows as unknown as Array<{ n: number }>
    return r[0]?.n ?? 0
  } finally {
    await c.end()
  }
}

async function membershipRevoked(userId: string): Promise<boolean> {
  const c = await migratorClient()
  try {
    const r = (
      await c.query(
        `SELECT revoked_at IS NOT NULL AS revoked FROM tenant.membership WHERE user_id = $1`,
        [userId],
      )
    ).rows as unknown as Array<{ revoked: boolean }>
    return r[0]?.revoked ?? false
  } finally {
    await c.end()
  }
}

async function attempt(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run()
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

/** The invariant 10 record, written the way `writeAuthorisationRecord()` does. */
async function actUnder(tx: ScopedClient, id: string, capability: string): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.authorization_grant
       (tenant_id, id, subject_user_id, org_class, partner_id, capability,
        resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
     VALUES ($1, $2, $3, 'customer', NULL, $4,
             'authority', 'Membership', NULL, NULL, now(), now() + interval '5 minutes')`,
    [ACME, id, ADMIN, capability],
  )
  await tx.query('SELECT set_config($1, $2, true)', ['app.authorisation_ref', id])
}

describe('membership revocation voids sessions, over a real PostgreSQL', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(1)

    /**
     * 🛑 THE PRIVILEGE IS GRANTED HERE, BY THE SUITE, AND `0019` DELIBERATELY
     *    DOES NOT GRANT IT. `0005` forbids *"a write privilege ahead of a
     *    writer"* and **nothing in `server/` revokes a membership** — there is
     *    no operation, no handler and no contract declaration. The suite
     *    supplies it for the length of its own run so that the TRIGGER can be
     *    witnessed through the app role's real fence, and the tree does not.
     *    Derive the absence: `grep -c 'GRANT UPDATE.*membership'
     *    db/migrations/*.sql` → 0.
     */
    const g = await migratorClient()
    try {
      /* 🛑 BOTH COLUMNS, AND THE SECOND ONE IS THE POINT OF §10. `0035` argues
         that a future membership-revocation writer should take the COLUMN-LEVEL
         grant under G358's precedent — and that the property no longer DEPENDS
         on which shape that grant takes, because the trigger is keyed on the
         membership ceasing to be LIVE rather than on `revoked_at` changing.
         Granting `expires_at` here is what puts that claim under test: before
         `0035` this grant was the whole of the second removal path and nothing
         guarded it. */
      await g.query(`GRANT UPDATE (revoked_at, expires_at) ON tenant.membership TO tenant_rw`)
    } finally {
      await g.end()
    }
  })

  after(async () => {
    await pool?.end()
  })

  /* ---------------------------------------------------------------- *
   * §1 · THE TRIGGER FIRES, AND IT IS NARROW.
   * ---------------------------------------------------------------- */

  it('§1 · revoking a membership voids that person\'s sessions and no others', async () => {
    await restore()
    const c = await migratorClient()
    try {
      await c.query(`SELECT set_config('app.tenant_id', $1, false)`, [ACME])
      /* 🛑 EVEN THE MIGRATOR MINTS A RECORD, AND THAT IS GUARD 1b RATHER THAN
         TEST CEREMONY. `reconcile_migrator` is `BYPASSRLS`, so the rows are
         visible to it without one — the record buys no visibility here. It
         buys a DECLARATION OF INTENT in an append-only table, so a person
         removed by a migration is as answerable as one removed over HTTP. */
      await c.query(
        `INSERT INTO tenant.authorization_grant
           (tenant_id, id, subject_user_id, org_class, partner_id, capability,
            resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
         VALUES ($1, 'azg_rev_1', $2, 'customer', NULL, $3,
                 'authority', 'Membership', NULL, NULL, now(), now() + interval '5 minutes')`,
        [ACME, ADMIN, CAPABILITIES.manageRoles],
      )
      await c.query(`SELECT set_config('app.authorisation_ref', 'azg_rev_1', false)`)
      const r = await c.query(
        `UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [MEI],
      )
      assert.equal(r.rowCount, 1, 'one membership row revoked')
    } finally {
      await c.end()
    }

    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: true, ses_mei_2: true },
      'BOTH of the removed person\'s sessions are revoked and the administrator\'s is not. ' +
        'Two sessions rather than one, deliberately: a trigger that voided the FIRST match ' +
        'would pass a one-session fixture and leave a person signed in on their second device.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §2 · END TO END, AS THE APP ROLE. THIS IS THE ONE THAT MATTERS.
   * ---------------------------------------------------------------- */

  it('§2 · the APP ROLE revokes another person\'s membership and their sessions die with it', async () => {
    await restore()

    const err = await attempt(() =>
      withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, 'azg_rev_2', CAPABILITIES.manageRoles)
        const r = await tx.query(
          `UPDATE tenant.membership SET revoked_at = now()
            WHERE user_id = $1 AND revoked_at IS NULL`,
          [MEI],
        )
        assert.equal(r.rowCount, 1, 'the membership is reachable — it is tenant-scoped')
      }),
    )
    assert.equal(err, null, 'the whole act commits')

    /* 🛑 THIS IS G450 CLOSED, AND THE ASSERTION IS ON THE ROW RATHER THAN ON
       THE ABSENCE OF AN EXCEPTION. Before `0019` this exact transaction
       committed with `rowCount = 1` on the membership and left both of Mei's
       sessions LIVE, with nothing raised anywhere. `reconcile_app` is
       `NOBYPASSRLS`, so every policy in the chain is really being evaluated:
       `session_lapsed_member_rls` to SEE the rows, the amended
       `session_selection_restrictive` to WRITE them, and the trigger to do it
       without any caller having asked. */
    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: true, ses_mei_2: true },
      'the removed person is signed out everywhere, by a NOBYPASSRLS role, in one transaction',
    )
  })

  it('§2b · …and it is ATOMIC: a failure after the revocation takes the revocation back', async () => {
    await restore()

    const err = await attempt(() =>
      withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, 'azg_rev_2b', CAPABILITIES.manageRoles)
        await tx.query(
          `UPDATE tenant.membership SET revoked_at = now()
            WHERE user_id = $1 AND revoked_at IS NULL`,
          [MEI],
        )
        throw new Error('the act failed after the revocation')
      }),
    )
    assert.match(err ?? '', /the act failed after the revocation/)

    /* The owner's ruling is that the two acts cannot be separated by any
       caller. A trigger makes them one statement's effect, so a rollback takes
       BOTH — there is no window in which a membership is revoked and a session
       is not, and no window in which the reverse is true either. */
    assert.deepEqual(await sessionState(), {
      ses_admin: false,
      ses_mei: false,
      ses_mei_2: false,
    })
    assert.equal(await membershipRevoked(MEI), false, 'and the membership is back')
  })

  /* ---------------------------------------------------------------- *
   * §3 · GUARD 1 — THE PRECONDITION THAT MAKES THE ROW COUNT MEAN ANYTHING.
   * ---------------------------------------------------------------- */

  it('§3 · an UNSCOPED revocation RAISES rather than voiding nothing quietly', async () => {
    await restore()
    const c = await migratorClient()
    let err: string | null
    try {
      /* The MIGRATOR, which is `BYPASSRLS` — so this is not a policy refusing.
         It is the trigger refusing to act blind, and the migrator is the
         hardest case: RLS would not have stopped it. */
      await c.query(`SELECT set_config('app.tenant_id', '', false)`)
      err = await attempt(() =>
        c.query(`UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1`, [MEI]),
      )
    } finally {
      await c.end()
    }

    /* 🛑 THIS IS THE ASSERTION THAT STOPS THE ROW-COUNT GUARD BEING VACUOUS,
       AND SAYING WHY IS WORTH MORE THAN THE ASSERTION. Row-level security
       makes *hidden* and *absent* indistinguishable to the invoker: if the
       policy denies, the trigger's `SELECT count(*)` returns 0, its `UPDATE`
       affects 0, the two AGREE, and a naive assertion passes while voiding
       nothing. **That is G450 reproduced inside the guard written to catch
       G450.** Guard 1 refuses to proceed blind, so by the time guard 2 counts,
       visibility is total and the number is a fact. */
    assert.match(
      err ?? '',
      /membership revocation outside its own tenant scope/,
      'the trigger refuses to act blind — it does not void zero sessions and commit',
    )
    assert.equal(await membershipRevoked(MEI), false, 'and the revocation rolled back with it')
  })

  it('§3b · a correctly-scoped revocation carrying NO authorisation record RAISES', async () => {
    await restore()
    const c = await migratorClient()
    let err: string | null
    try {
      /* Guard 1a is SATISFIED — the tenant scope is right — and this is the
         case guard 1a alone missed. */
      await c.query(`SELECT set_config('app.tenant_id', $1, false)`, [ACME])
      err = await attempt(() =>
        c.query(`UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1`, [MEI]),
      )
    } finally {
      await c.end()
    }

    /* 🛑 THIS ASSERTION EXISTS BECAUSE THE FIRST DRAFT OF `0019` FAILED IT,
       AND IT WAS FOUND BY RUNNING THIS SUITE BESIDE
       `tests/db/administrative-reach.test.ts` §4 RATHER THAN BY REVIEW. That
       test revokes another person's membership inside `withSelectionScope()`:
       the tenant scope is correct, so guard 1a passed — and it carries no
       authorisation record, so `session_lapsed_member_rls` hid every session,
       `expected` was 0, `voided` was 0, **the two agreed, and guard 2 passed
       while the trigger voided nothing.** G450 surviving inside the guard
       written to close it. Guard 1b is the repair: the trigger demands the
       same record the policy demands, so it can never count a set it cannot
       see. */
    assert.match(
      err ?? '',
      /carries no manage_roles authorisation record/,
      'a trigger that cannot SEE the sessions must refuse rather than agree with itself ' +
        'about zero',
    )
    assert.equal(await membershipRevoked(MEI), false, 'and the revocation rolled back')
  })

  it('§4 · a revocation scoped to the WRONG tenant RAISES', async () => {
    await restore()
    const c = await migratorClient()
    let err: string | null
    try {
      await c.query(`SELECT set_config('app.tenant_id', $1, false)`, [GLOBEX])
      err = await attempt(() =>
        c.query(`UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1`, [MEI]),
      )
    } finally {
      await c.end()
    }
    assert.match(err ?? '', /app\.tenant_id is ten_globex, membership is ten_acme/)
    assert.equal(await membershipRevoked(MEI), false)
  })

  /* ---------------------------------------------------------------- *
   * §5 · THE AMENDED RESTRICTIVE POLICY FAILS CLOSED IN BOTH DIRECTIONS.
   * ---------------------------------------------------------------- */

  it('§5 · revoke-then-UNrevoke is refused: the new disjunct admits only a dead session', async () => {
    await restore()
    await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, 'azg_rev_5', CAPABILITIES.manageRoles)
      await tx.query(
        `UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [MEI],
      )
    })
    assert.deepEqual(await sessionState(), {
      ses_admin: false,
      ses_mei: true,
      ses_mei_2: true,
    })

    const err = await attempt(() =>
      withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, 'azg_rev_5b', CAPABILITIES.manageRoles)
        await tx.query(`UPDATE tenant.session SET revoked_at = NULL WHERE user_id = $1`, [MEI])
      }),
    )

    /* 🛑 THE DISJUNCT `0019` ADDS IS `revoked_at IS NOT NULL AND <ever a
       member>`, and this is the half that makes it safe rather than a hole. A
       write that leaves the session ALIVE skips the disjunct entirely and
       falls to the live-membership `EXISTS`, which fails for a removed person.
       **So through this policy a session may be REVOKED and may not be
       revived, rebound, or edited in any other way.**

       ⚠️ THE MESSAGE NAMES NO POLICY, AND THE ABSENCE OF A NAME IS THE FINDING
       RATHER THAN A LOOSE ASSERTION. This suite first demanded
       `/session_selection_restrictive/` and went RED with

           new row violates row-level security policy for table "session"

       PostgreSQL names a policy when a RESTRICTIVE one refuses, and names none
       when EVERY PERMISSIVE `WITH CHECK` fails — the row never reaches the
       restrictive stage. **So the revival is refused one step EARLIER than the
       assertion expected, by `session_lapsed_member_rls`'s own
       `WITH CHECK (… revoked_at IS NOT NULL …)`**, with `session_rls`'s
       digest check failing beside it because a tenant scope sets no
       `app.session_ref`. That is the stronger of the two readings: the policy
       that OPENS this row is itself the policy that refuses to let it live
       again, so the refusal does not depend on the restrictive policy being
       correctly amended. Both are asserted — the name-free form here, and
       §6's expression check for the restrictive one. */
    assert.match(
      err ?? '',
      /new row violates row-level security policy/,
      'a revoked session cannot be brought back to life by the same authority that killed it',
    )
    assert.doesNotMatch(
      err ?? '',
      /session_selection_restrictive/,
      'and it is refused BEFORE the restrictive policy is consulted — an unnamed policy in ' +
        'this message means every PERMISSIVE `WITH CHECK` failed, which is this file\'s own ' +
        '`revoked_at IS NOT NULL` doing the work. If a name appears here, the permissive ' +
        'check has been widened and the restrictive one is carrying it alone.',
    )
    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: true, ses_mei_2: true },
      'and the sessions are still dead',
    )
  })

  /* ---------------------------------------------------------------- *
   * §6 · THE MIRROR. `ALTER POLICY` REPLACES; THIS IS WHAT STOPS A REPLACE
   *      FROM QUIETLY DROPPING G199.
   * ---------------------------------------------------------------- */

  it('§6 · the amended restrictive policy still carries every source expression', async () => {
    const c = await migratorClient()
    let expr: string
    try {
      const rows = (
        await c.query(
          `SELECT coalesce(with_check, '') AS expr
             FROM pg_policies
            WHERE schemaname = 'tenant'
              AND tablename = 'session'
              AND policyname = 'session_selection_restrictive'`,
        )
      ).rows as unknown as Array<{ expr: string }>
      expr = rows[0]?.expr ?? ''
    } finally {
      await c.end()
    }

    assert.notEqual(expr, '', 'the restrictive policy exists and states a `WITH CHECK`')

    /**
     * 🛑 EVERY TABLE THE THREE SOURCES DEPEND ON, BY NAME. This is `0008`'s own
     *    answer to its own problem, applied to the file that had to restate
     *    `0008`. The three governance lists are the ones to watch:
     *    `authorisationPermits()` tests `NON_DELEGABLE_RESOURCES` FIRST, and
     *    G75's finding is that a staff arm consulting two of the three
     *    reproduces G60's defect exactly — so an amendment that dropped the
     *    `NOT EXISTS` would widen invariant 8's staff path to `statutory`,
     *    which invariant 8 refuses *at any price*, while parsing and applying
     *    perfectly. **The first draft of `0019` did exactly that.**
     */
    for (const required of [
      'membership', // 0005's customer arm
      'tenant_access_grant', // 0008's staff arm
      'grant_duration_ceiling', // G292's ceiling, a JOIN and not a column
      'access_resource_grant', // the grant's resource lines
      'non_delegable_resource', // invariant 8's `statutory`
      'contract_only_resource',
      'permitted_resource',
    ]) {
      assert.ok(
        expr.includes(required),
        `the restrictive policy no longer references \`${required}\`. \`ALTER POLICY\` REPLACES ` +
          'the whole expression, so an amendment that forgets a source SILENTLY DELETES the ' +
          'control it belonged to. If this is deliberate, the ruling that deletes it says so ' +
          'and this assertion moves with it.',
      )
    }

    /* And this file's own disjunct, so the mirror runs in both directions. */
    assert.ok(
      /revoked_at IS NOT NULL/.test(expr),
      "`0019`'s own disjunct is present — without it the trigger cannot write at all",
    )
  })

  /* ---------------------------------------------------------------- *
   * §7 · FROM THE CATALOGUE. G160's REFUSAL, STILL TRUE.
   * ---------------------------------------------------------------- */

  it('§7 · the trigger function is NOT `SECURITY DEFINER`, and the trigger is attached', async () => {
    const c = await migratorClient()
    let fn: { prosecdef: boolean; count: number } | undefined
    let definers: readonly string[] = []
    let triggers: readonly string[]
    try {
      /* ⚠️ `proname` IS SELECTED AND THE SCAN IS OVER EVERY FUNCTION, NOT
         THE FIRST. Until 19 Sep 2026 this read `f[0].prosecdef` and there was
         exactly one function, so "the function is not SECURITY DEFINER" and
         "no function is" were the same sentence. `db/migrations/0059` makes
         them different, and the assertion below now says the second. */
      const f = (
        await c.query(
          `SELECT p.proname, p.prosecdef, count(*) OVER () AS count
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'tenant'
            ORDER BY 1`,
        )
      ).rows as unknown as Array<{ proname: string; prosecdef: boolean; count: string }>
      definers = f.filter((r) => r.prosecdef).map((r) => r.proname)
      fn = f[0] === undefined ? undefined : { prosecdef: f[0].prosecdef, count: Number(f[0].count) }
      triggers = (
        (
          await c.query(
            `SELECT t.tgname
               FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'tenant' AND NOT t.tgisinternal
              ORDER BY 1`,
          )
        ).rows as unknown as Array<{ tgname: string }>
      ).map((r) => r.tgname)
    } finally {
      await c.end()
    }

    /**
     * 🛑 THIS ASSERTION READ `['membership_revocation_voids_sessions']` AND ITS
     *    OWN MESSAGE SAID WHAT TO DO WHEN A SECOND ARRIVED: *"a SECOND trigger
     *    is a mechanism nobody argued for, and this assertion exists to make
     *    somebody argue for it."* **A second arrived on 19 Sep 2026 and the
     *    argument is G659, on `db/migrations/0059_resolution_chain.sql`'s own
     *    face.** The witnessed red is quoted here rather than paraphrased:
     *
     *      + 'exception_resolution_requires_record',
     *        'membership_revocation_voids_sessions'
     *
     *    THE ARGUMENT, IN ONE SENTENCE: `0059` takes `GRANT UPDATE (status,
     *    resolution_*)` on `tenant.exception`, and **a POLICY cannot restore
     *    what `0015` refused that grant to protect** — a policy's `WITH CHECK`
     *    sees the NEW row and its `USING` sees the OLD one, and neither sees
     *    BOTH, so no policy can say *"this UPDATE CHANGED `status`"*. A
     *    `BEFORE UPDATE … FOR EACH ROW` trigger is the only construct that
     *    holds both. That is a different reason from `0019`'s — which needed a
     *    trigger to CASCADE a write — and the two are listed separately here
     *    rather than under one "triggers are allowed now".
     *
     * ⚠️ THE LIST IS STILL CLOSED AND STILL EXACT. A THIRD trigger is a red,
     *    and the sentence `0005` wrote — *"there must never be a `CREATE
     *    FUNCTION` here"* — has now been departed from twice, each time in
     *    writing, which is the whole of what this assertion buys.
     */
    /**
     * 🛑 AND A THIRD ARRIVED ON 1 Oct 2026 — G2623, W5 — AND IT IS ARGUED ON
     *    `db/migrations/0320`'s FACE, FOR A THIRD DIFFERENT REASON. The
     *    witnessed red:
     *
     *      +   'partner_authorization_grant_is_a_receipt'
     *
     *    THE ARGUMENT, IN ONE SENTENCE: the receipt's firm-and-verb term was a
     *    `WITH CHECK` first, and once `0321` gave `partner_role_assignment` and
     *    `partner_role` policies that READ the receipt, every portal act
     *    answered `infinite recursion detected in policy for relation
     *    "partner_authorization_grant"` — **a policy cannot read a table whose
     *    policies read it**, and a trigger's query is a separate statement.
     *    `0019` cascades a write, `0059` sees what changed, `0320` breaks a
     *    policy cycle: three reasons, listed separately, none of them *"triggers
     *    are allowed now"*. Invoker-rights, read back in
     *    `tests/db/partner-authorisation-record.test.ts` §5b.
     */
    /**
     * 🛑 AND A FOURTH ON 2 Oct 2026 — G2804, `0370`, THE OWNER'S REDEMPTION
     *    RULING (G2801) — FOR THE SAME REASON AS THE THIRD, MEASURED AGAIN. The
     *    witnessed red:
     *
     *      +   'partner_role_assignment_redeems_an_invitation'
     *
     *    THE ARGUMENT: the redemption's no-escalation re-check as a `WITH
     *    CHECK` on `partner_role_assignment` reads `partner_role`, whose
     *    `partner_role_rls` reads the assignment table — `42P17` on the first
     *    redemption, KEPT RUNNABLE at `tests/db/partner-invitation-redemption.test.ts`
     *    §8a. Invoker-rights, read back there in §7b.
     */
    /**
     * 🛑 AND A FIFTH ON 2 Oct 2026 — G2903, `0390` §3, closing G2811. The
     *    witnessed red:
     *
     *      +   'partner_invitation_one_standing_offer'
     *
     *    THE ARGUMENT: `0321`'s one-offer-per-address UNIQUE index had no
     *    state, so a lapsed offer blocked its address for ever, and a partial
     *    index cannot say "standing" — its predicate must be IMMUTABLE and
     *    `now()` is not. The exclusion-constraint alternative needs
     *    `btree_gist`, an extension nothing here creates. So the rule is a
     *    `BEFORE INSERT` trigger under an advisory lock, invoker-rights, read
     *    back in `tests/db/partner-invitation-redemption.test.ts` §10d.
     */
    /**
     * 🛑 AND A SIXTH ON 2 Oct 2026 — G2941, `0400`, THE OWNER'S RULING
     *    (answering G2908). The witnessed red:
     *
     *      +   'user_email_verified_upgrade_only'
     *
     *    THE ARGUMENT IS `0059`'s, A FIFTH TIME: the ruling is *"only ever sets
     *    … false→true"*, and a transition is a relation between OLD and NEW,
     *    which no policy can see. It also pins every other column by the whole
     *    row, so the property survives a wider grant. Invoker-rights, and it
     *    binds only roles RLS binds (G2945); read back in
     *    `tests/db/email-verified-upgrade.test.ts` §0, and CUT in §8 to prove
     *    the refusals are its own.
     */
    assert.deepEqual(
      triggers,
      [
        'exception_resolution_requires_record',
        'membership_revocation_voids_sessions',
        'partner_authorization_grant_is_a_receipt',
        'partner_invitation_one_standing_offer',
        'partner_role_assignment_redeems_an_invitation',
        'user_email_verified_upgrade_only',
      ],
      'the set of non-internal triggers in schema `tenant` has changed. This directory had ' +
        'ZERO before `0019` and `0005` says in its own voice that there must never be a ' +
        '`CREATE FUNCTION` here — so a NEW trigger is a mechanism nobody argued for, and ' +
        'this assertion exists to make somebody argue for it. Two are argued: `0019`/`0035` ' +
        '(cascade a write) and `0059` (see what changed, which no policy can). A third owes ' +
        'the same.',
    )

    assert.equal(fn?.count, 6, 'and exactly one function per trigger — six since 0400 (G2941); five since 0390 (G2903); four since 0370 (G2804)')
    /* 🛑 G160 REFUSED A `SECURITY DEFINER` FUNCTION BECAUSE IT *"becomes the
       most security-relevant object in the schema"*. `0019` keeps that true by
       granting the reach through a narrow POLICY instead, so the function holds
       no authority of its own and can do nothing its caller could not do.
       `SECURITY INVOKER` is the DEFAULT and is therefore stated by OMISSION —
       which is exactly the kind of claim that stays true until somebody
       helpfully adds a word, so it is read from the catalogue. */
    assert.deepEqual(
      definers,
      [],
      'a function in schema `tenant` is `SECURITY DEFINER`. Read as a SET since 19 Sep 2026, ' +
        'because there are two functions now and asserting the first said nothing about the ' +
        'second. ' +
        'A `SECURITY DEFINER` here would need to ' +
        'be owned by `reconcile_migrator` to defeat `FORCE ROW LEVEL SECURITY` — which is a ' +
        'BYPASSRLS execution path on the request path, the single thing this schema\'s role ' +
        'separation exists to prevent. G160.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §8 · THE WRONG CONTAINMENT IS GONE. G510.
   * ---------------------------------------------------------------- */

  it('§8 · a session can no longer be DELETEd — the evidence-destroying path is closed', async () => {
    await restore()
    const err = await attempt(() =>
      withSelectionScope(pool, MEI_DIGEST, ACME, async (tx) =>
        tx.query(`DELETE FROM tenant.session`),
      ),
    )

    /* 🛑 `administrative-reach` §5 measured the opposite and its assertion is
       amended in this same commit. `session_selection_restrictive` gates
       `UPDATE` and NOT `DELETE`, because PostgreSQL gates `DELETE` on `USING`
       and that policy states only `WITH CHECK` — so a lapsed member's session
       could not be revoked and COULD be destroyed, taking the `revoked_at`
       evidence with it. The repair is NOT a `USING` clause: `0005` measured
       that a restrictive `USING` would also gate `SELECT` and make a session
       unreadable until its membership was re-proved on every request. **The
       PRIVILEGE goes instead**, because nothing deletes a session —
       `grep -rn 'DELETE FROM tenant.session' server/ db/ model/` → nothing. */
    assert.match(
      err ?? '',
      /permission denied for table session/,
      'and it is refused by PRIVILEGE rather than by policy, which is the cheapest place to ' +
        'check it and the hardest to amend by accident',
    )
  })

  /* ---------------------------------------------------------------- *
   * §9 · THE NEW PERMISSIVE POLICY IS NARROW.
   * ---------------------------------------------------------------- */

  it('§9 · a LIVE member\'s session is invisible even to an administrative act', async () => {
    await restore()
    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, 'azg_rev_9', CAPABILITIES.manageRoles)
      return (await tx.query(`SELECT id FROM tenant.session`)).rowCount
    })

    /* 🛑 THE REFUSED ALTERNATIVE, AS A RUNNABLE ASSERTION. G450 names widening
       `session_rls` with a tenant disjunct as *"expressible"*, and it is the
       wrong shape: it would publish EVERY session row in the tenant —
       including `handle_digest`, which `0005` calls the credential's shadow,
       *"a database dump containing handles would be a session-hijack kit"* —
       to every tenant-scoped transaction. `session_lapsed_member_rls` opens
       ONLY the set G399 calls "no containment": sessions whose owner is not a
       live member. In the ordinary case that set is EMPTY, and this is the
       assertion that says so. */
    assert.equal(
      seen,
      0,
      'nobody has lapsed, so the lapsed-member policy opens nothing and an administrative act ' +
        'reads no session at all — not even a roster of digests',
    )
  })

  /* ================================================================== *
   * §10 · THE SECOND REMOVAL PATH. `0035`, 19 Sep 2026.
   *
   * 🛑 DEFECT 1, PROVED BEFORE IT WAS REPAIRED. `0019`'s trigger fired on
   *    `WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)` — the
   *    COLUMN, not the property. Measured against this very fixture:
   *
   *        live sessions before: 1
   *        UPDATE tenant.membership SET expires_at = now() - interval '1 hour'
   *          → rowCount 1, NO authorisation record, NO app.tenant_id, no raise
   *        live sessions after: 1      ← every session still live
   *
   *    Every other liveness predicate in this schema treats expiry and
   *    revocation IDENTICALLY — `0005`'s restrictive policy, `0008`'s staff
   *    arm, `0018`'s directory, and `0019`'s OWN `session_lapsed_member_read`
   *    four lines above the trigger it is inconsistent with. `docs/HANDOFF.md`
   *    §5.1, arriving in this repository's first trigger.
   *
   *    It refutes two of `0019`'s own claims and they are named rather than
   *    glossed: *"the two acts cannot be separated by any caller"* — they were
   *    separable by using the other column — and *"IT BINDS `BYPASSRLS`
   *    CALLERS TOO … a person removed by a migration is then as answerable as
   *    one removed over HTTP"* — a migration removed a person via `expires_at`
   *    with no invariant 10 record at all.
   * ================================================================== */

  it('§10 · lapsing a membership by EXPIRY voids that person\'s sessions', async () => {
    await restore()
    const c = await migratorActing('azg_rev_10')
    try {
      /* 🛑 THE MIGRATOR, WHICH IS `BYPASSRLS` — so nothing here is a policy
         doing the work. Before `0035` this statement committed, silently, and
         left both of Mei's sessions live. */
      const r = await c.query(
        `UPDATE tenant.membership SET expires_at = now() - interval '1 hour'
          WHERE user_id = $1`,
        [MEI],
      )
      assert.equal(r.rowCount, 1, 'one membership row lapsed')
    } finally {
      await c.end()
    }

    assert.equal(await liveMemberships(MEI), 0, 'the person is no longer a live member')
    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: true, ses_mei_2: true },
      'AN EXPIRY IS A REMOVAL. `0019` guarded one column and left the other open; a person ' +
        'removed by the clock column kept every session. Both of Mei\'s die and the ' +
        'administrator\'s does not.',
    )
  })

  it('§10b · …and the APP ROLE cannot use the second column either', async () => {
    await restore()
    const err = await attempt(() =>
      withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, 'azg_rev_10b', CAPABILITIES.manageRoles)
        const r = await tx.query(
          `UPDATE tenant.membership SET expires_at = now() - interval '1 hour'
            WHERE user_id = $1`,
          [MEI],
        )
        assert.equal(r.rowCount, 1, 'the membership is reachable — it is tenant-scoped')
      }),
    )
    assert.equal(err, null, 'the whole act commits')

    /* ⚠️ THE PRIVILEGE IS THIS SUITE'S, NOT THE TREE'S, AND THAT IS THE POINT
       OF ASSERTING IT ANYWAY. `0005` grants the app role `SELECT` ALONE on
       `tenant.membership`, so neither column is reachable over HTTP today —
       derive it, `grep -c 'GRANT UPDATE.*membership' db/migrations/*.sql` → 0.
       The hole went live the moment a writer landed. `0035` closes it in the
       TRIGGER rather than in the shape of a grant nobody has written yet, so
       the property does not depend on the next author reading G358. */
    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: true, ses_mei_2: true },
      'a NOBYPASSRLS role removes a person by expiry and their sessions die with it, in one ' +
        'transaction, with no caller having asked',
    )
  })

  it('§10c · an expiry set into the FUTURE fires nothing — the trigger reads LIVENESS, not a column', async () => {
    await restore()
    const c = await migratorClient()
    let err: string | null
    try {
      /* 🛑 NO TENANT SCOPE AND NO RECORD, DELIBERATELY. If the repair had been
         *"also fire when `expires_at` changes"* — the landmark repair for the
         landmark defect — guard 1a would raise here, because this transaction
         carries neither. It must not: extending a membership is not removing
         one. This is the assertion that stops `0035` being `0019`'s own defect
         written twice. */
      await c.query(`SELECT set_config('app.tenant_id', '', false)`)
      err = await attempt(() =>
        c.query(
          `UPDATE tenant.membership SET expires_at = now() + interval '30 days'
            WHERE user_id = $1`,
          [MEI],
        ),
      )
    } finally {
      await c.end()
    }
    assert.equal(err, null, 'extending a membership is not an act the trigger has any part in')
    assert.equal(await liveMemberships(MEI), 1, 'and the person is still a live member')
    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: false, ses_mei_2: false },
      'nothing was voided',
    )
  })

  it('§10d · an UNSCOPED expiry lapse RAISES, exactly as an unscoped revocation does', async () => {
    await restore()
    const c = await migratorClient()
    let err: string | null
    try {
      await c.query(`SELECT set_config('app.tenant_id', '', false)`)
      err = await attempt(() =>
        c.query(
          `UPDATE tenant.membership SET expires_at = now() - interval '1 hour' WHERE user_id = $1`,
          [MEI],
        ),
      )
    } finally {
      await c.end()
    }
    /* §3 asserts this for the revoked column. The whole of defect 1 is that
       the two paths were not the same path; these two assertions are the same
       assertion, and that is the repair stated as a test. */
    assert.match(err ?? '', /membership revocation outside its own tenant scope/)
    assert.equal(await liveMemberships(MEI), 1, 'and the lapse rolled back with it')
  })

  it('§10e · a scoped expiry lapse carrying NO authorisation record RAISES', async () => {
    await restore()
    const c = await migratorActing('azg_rev_10e', { record: false })
    let err: string | null
    try {
      err = await attempt(() =>
        c.query(
          `UPDATE tenant.membership SET expires_at = now() - interval '1 hour' WHERE user_id = $1`,
          [MEI],
        ),
      )
    } finally {
      await c.end()
    }
    /* 🛑 THIS IS `0019`'s OWN SENTENCE MADE TRUE. *"A person removed by a
       migration is then as answerable as one removed over HTTP"* was false
       while this path existed: a migration lapsed a membership and landed
       nothing in the append-only table. */
    assert.match(err ?? '', /carries no manage_roles authorisation record/)
    assert.equal(await liveMemberships(MEI), 1, 'and the lapse rolled back')
  })

  /* ================================================================== *
   * §11 · TWO LIVE MEMBERSHIPS. `0035`, 19 Sep 2026.
   *
   * 🛑 DEFECT 2, PROVED BEFORE IT WAS REPAIRED. `0019`'s trigger body reads
   *
   *        UPDATE tenant.session … WHERE user_id = NEW.user_id
   *
   *    with NO live-membership term. The POLICY has one; the BODY does not —
   *    and for a `BYPASSRLS` caller the policy is INERT. So with two live
   *    memberships for one person, a shape `0005` deliberately supports by
   *    having no `UNIQUE (tenant_id, user_id)`, revoking ONE of them measured:
   *
   *        migrator (BYPASSRLS) | sessions VOIDED ANYWAY  | all three guards pass
   *        app role             | NOT voided, committed   | all three guards pass
   *
   *    Both are wrong and they are wrong in opposite directions. The migrator
   *    signs out a person who is STILL A MEMBER. The app role reaches
   *    `expected = voided = remaining = 0` — **exactly the vacuity `0019`'s own
   *    header warns about, surviving its guard 1b**, because guard 1b proves a
   *    record exists and proves nothing about whether the policy's `NOT EXISTS
   *    (live membership)` opens the set.
   *
   *    `0019` claims *"the trigger can only run in a transaction the policy
   *    will also open, so the count it takes is over the complete set."* The
   *    policy carries THREE terms — the tenant, the record, and `NOT EXISTS
   *    (live membership)` — and guard 1 re-checks the first two.
   * ================================================================== */

  it('§11 · revoking ONE of two live memberships voids NOTHING — the person is still a member', async () => {
    await restore()
    await addSecondMembership()
    assert.equal(await liveMemberships(MEI), 2, 'the fixture really is the supported shape')

    const c = await migratorActing('azg_rev_11')
    try {
      const r = await c.query(
        `UPDATE tenant.membership SET revoked_at = now() WHERE id = $1`,
        [MEI_SECOND],
      )
      assert.equal(r.rowCount, 1, 'one of the two is revoked')
    } finally {
      await c.end()
    }

    assert.equal(await liveMemberships(MEI), 1, 'one live membership remains')
    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: false, ses_mei_2: false },
      'THE MIGRATOR SIGNED A LIVE MEMBER OUT. `BYPASSRLS` makes the policy inert, so the ' +
        'body\'s unqualified `WHERE user_id = NEW.user_id` voided every session of a person ' +
        'who had not been removed from anything.',
    )
  })

  it('§11b · …and the APP ROLE reaches the SAME answer — the outcome no longer flips on `BYPASSRLS`', async () => {
    /* 🛑 THE DIFFERENTIAL IS THE ASSERTION AND BOTH ARMS ARE RUN HERE, WHICH
       IS WHY THIS SECTION DOES NOT SIMPLY READ §11's STATE BACK. Before
       `0035` the two arms DISAGREED — the migrator voided both of Mei's
       sessions and the app role voided neither — **each with all three guards
       passing.** A guard whose verdict depends on who is asking is not a
       guard, and an assertion about one arm alone cannot see that.

       ⚠️ AND THE APP-ROLE ARM WAS THE MORE DANGEROUS ONE EVEN THOUGH ITS
       OUTCOME LOOKED CORRECT. It reached `expected = voided = remaining = 0`
       and committed — the right answer BY VACUITY, which is `0019`'s own
       named failure mode arriving one level past the guard written to close
       it. A suite asserting only the app role's session state would have been
       GREEN against the defect. */
    await restore()
    await addSecondMembership()
    const asMigrator = await migratorActing('azg_rev_11b_m')
    try {
      await asMigrator.query(`UPDATE tenant.membership SET revoked_at = now() WHERE id = $1`, [
        MEI_SECOND,
      ])
    } finally {
      await asMigrator.end()
    }
    const migratorOutcome = await sessionState()

    await restore()
    await addSecondMembership()
    const err = await attempt(() =>
      withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, 'azg_rev_11b', CAPABILITIES.manageRoles)
        const r = await tx.query(`UPDATE tenant.membership SET revoked_at = now() WHERE id = $1`, [
          MEI_SECOND,
        ])
        assert.equal(r.rowCount, 1)
      }),
    )
    assert.equal(err, null, 'the act commits')
    const appOutcome = await sessionState()

    assert.deepEqual(
      appOutcome,
      migratorOutcome,
      'THE OUTCOME FLIPPED ON THE READ EXEMPTION. The trigger body\'s ' +
        '`WHERE user_id = NEW.user_id` carried no live-membership term, so a `BYPASSRLS` ' +
        'caller — for whom `session_lapsed_member_read` is inert — voided a live member\'s ' +
        'sessions, and a `NOBYPASSRLS` caller voided nothing and agreed with itself about ' +
        'zero. The body now asks the question the policy asks, so both roles compute it.',
    )
    assert.deepEqual(
      appOutcome,
      { ses_admin: false, ses_mei: false, ses_mei_2: false },
      'and the answer they agree on is the right one: a person with a live membership ' +
        'remaining keeps their sessions, whoever revokes the other one',
    )
  })

  it('§11c · …and when the LAST live membership goes, they die — §11 is a decision, not a failure', async () => {
    await restore()
    await addSecondMembership()

    /* Both, in one authorised act. Nothing is voided at the first statement —
       a live membership remains — and everything is voided at the second. */
    await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, 'azg_rev_11c', CAPABILITIES.manageRoles)
      await tx.query(`UPDATE tenant.membership SET revoked_at = now() WHERE id = $1`, [MEI_SECOND])
      await tx.query(`UPDATE tenant.membership SET expires_at = now() - interval '1 hour'
                       WHERE id = 'mem_mei'`)
    })

    /* 🛑 THE SECOND STATEMENT USES THE OTHER COLUMN ON PURPOSE. Defect 1 and
       defect 2 meet here: the last membership is ended by EXPIRY, which
       `0019`'s trigger did not watch, on a person whose sessions `0019`'s body
       would have voided at the WRONG statement. Only a trigger keyed on
       liveness on BOTH sides gets this one right. */
    assert.equal(await liveMemberships(MEI), 0)
    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: true, ses_mei_2: true },
      'the last live membership ending is what signs the person out, and it does so whichever ' +
        'of the two columns ends it',
    )
  })

  it('§11d · a live membership in ANOTHER tenant does not keep this tenant`s sessions alive', async () => {
    /* 🛑 THIS SECTION EXISTS BECAUSE A MUTATION SURVIVED EVERYTHING ELSE.
       Guard 1c is a three-term predicate — the person, THE TENANT, and
       liveness — and dropping the TENANT term produces a defect with exactly
       defect 2's signature, in the same direction: for a `BYPASSRLS` caller
       the subquery then sees every tenant's memberships and the trigger
       silently declines to void; for the app role `membership_rls` narrows it
       back to `app.tenant_id` and the same code is correct. **The outcome
       flips on the read exemption again**, and §11/§11b cannot see it because
       their fixture is single-tenant. */
    await restore()
    const c = await migratorClient()
    try {
      await c.query(
        `INSERT INTO tenant.role
           (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, 'rol_rev_gx', 'Rev', 'rev', 1, 'operator', 'tenant', NULL, 'active')
         ON CONFLICT DO NOTHING`,
        [GLOBEX],
      )
      await c.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, 'rol_rev_gx', 'seed', now(), NULL, NULL)`,
        [GLOBEX, MEI_SECOND, MEI],
      )
    } finally {
      await c.end()
    }
    assert.equal(await liveMemberships(MEI), 1, 'one live membership IN ACME')

    const act = await migratorActing('azg_rev_11d')
    try {
      await act.query(`UPDATE tenant.membership SET revoked_at = now() WHERE id = 'mem_mei'`)
    } finally {
      await act.end()
    }

    assert.deepEqual(
      await sessionState(),
      { ses_admin: false, ses_mei: true, ses_mei_2: true },
      'the person`s ACME sessions die when their ACME membership ends. A live membership in ' +
        'GLOBEX is not a membership of ACME — invariant 1 — and a guard that reads it as one ' +
        'leaves a removed person signed in, for a `BYPASSRLS` caller only.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §12 · THE MIRROR, FROM THE CATALOGUE. `0002`'s CAUTION, ANSWERED.
   * ---------------------------------------------------------------- */

  it('§12 · the firing condition AND the body both state the whole liveness predicate', async () => {
    const c = await migratorClient()
    let def: string
    let body: string
    try {
      const t = (
        await c.query(
          /* 🛑 KEYED ON THE TRIGGER'S NAME, AND IT WAS KEYED ON *"the first
             non-internal trigger in schema `tenant`"* UNTIL 19 Sep 2026 —
             §5.1 INSIDE THE CONTROL WHOSE OWN COMMENT, FORTY LINES DOWN,
             BOASTS OF NOT BEING KEYED ON A LANDMARK. It was correct when
             written, because `0019`'s was the only trigger in this schema.
             `0059` added `exception_resolution_requires_record` and nothing
             here moved, so `t[0]` became a CATALOGUE SCAN ORDER — and the
             row order in `pg_trigger` is not guaranteed and shifts with the
             order and timing of migration application.
             ⚠️ MEASURED, NOT REASONED ABOUT: the suite was GREEN standalone
             and RED twice in `npm run check` on the same tree, and the two
             candidates were run through this section's own `norm`/`LIVE`
             comparison — `exception_resolution_requires_record` FAILS it and
             `membership_revocation_voids_sessions` PASSES it, so the gate's
             message (*"THE FIRING CONDITION NO LONGER STATES THE WHOLE
             LIVENESS PREDICATE"*) was the assertion reading the WRONG
             TRIGGER and reporting a defect that is not there.
             ⚠️ THE `prosrc` QUERY BELOW WAS ALWAYS KEYED ON `proname` and
             was never exposed, which is the asymmetry that makes this a slip
             rather than a policy. */
          `SELECT pg_get_triggerdef(t.oid) AS def
             FROM pg_trigger t JOIN pg_class k ON k.oid = t.tgrelid
             JOIN pg_namespace n ON n.oid = k.relnamespace
            WHERE n.nspname = 'tenant' AND NOT t.tgisinternal
              AND t.tgname = 'membership_revocation_voids_sessions'`,
        )
      ).rows as unknown as Array<{ def: string }>
      def = t[0]?.def ?? ''
      const p = (
        await c.query(
          `SELECT p.prosrc
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'tenant'
              AND p.proname = 'void_sessions_on_membership_revocation'`,
        )
      ).rows as unknown as Array<{ prosrc: string }>
      body = p[0]?.prosrc ?? ''
    } finally {
      await c.end()
    }

    /**
     * 🛑 `0002_run.sql` REFUSES A SECOND VOCABULARY WITH NOTHING CHECKING IT,
     *    AND `0019` ANSWERED THAT A TRIGGER *"copies nothing"*. That answer
     *    was right about the trigger and WRONG ABOUT THIS PREDICATE. The
     *    liveness expression is stated in `0005`'s restrictive policy,
     *    `0008`'s staff arm, `0018`'s directory, `0019`'s permissive policy,
     *    `0027`'s two halves and `selectTenantForSession()` — and **defect 1
     *    is what that drift looks like when it happens**: one copy was
     *    written with one term missing. Nothing in `npm run check` reads
     *    PL/pgSQL or a policy expression, so this is the control.
     */
    assert.notEqual(def, '', 'the trigger exists and has a definition')

    /* 🛑 THE ASSERTION IS THE WHOLE EXPRESSION AND NOT THE TWO COLUMN NAMES,
       AND THE DIFFERENCE WAS MEASURED RATHER THAN REASONED ABOUT. A first
       draft of this section required only that each text `includes` the
       strings `revoked_at` and `expires_at`, and a mutation that deleted the
       expiry term from GUARD 1c SURVIVED IT — because guard 1b's own
       `g.expires_at > now()`, over `tenant.authorization_grant`, satisfies a
       bare substring check. A landmark instead of the property, inside the
       control written against landmarks instead of properties. */
    /* Normalised so the assertion is about the PREDICATE and not about
       PostgreSQL's parenthesisation or a qualifier: `pg_get_triggerdef` prints
       `((new.expires_at IS NULL) OR (new.expires_at > now()))` and the body
       writes `(m.expires_at IS NULL OR m.expires_at > now())`.
       🛑 `--` COMMENTS ARE STRIPPED FIRST, so a future edit that deletes the
       guard and leaves a comment QUOTING it cannot satisfy this. */
    const norm = (s: string): string =>
      s
        .replace(/--[^\n]*/g, ' ')
        .replace(/[()]/g, ' ')
        .replace(/\b(new|old|m)\./gi, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
    const LIVE = 'revoked_at is null and expires_at is null or expires_at > now'

    assert.ok(
      norm(def).includes(LIVE),
      'THE FIRING CONDITION NO LONGER STATES THE WHOLE LIVENESS PREDICATE. `0019` watched ' +
        '`revoked_at` alone and left `expires_at` as an unguarded removal path, which is the ' +
        'defect `0035` exists against; every other liveness predicate in this schema — ' +
        '`0005`, `0008`, `0018`, `0027` — states both terms. If a ruling narrows this, it ' +
        'says so and this assertion moves with it.',
    )
    assert.ok(
      norm(body).includes(`from tenant.membership`) && norm(body).includes(LIVE),
      'GUARD 1c IS GONE OR HAS LOST A TERM. Without the whole live-membership predicate in ' +
        'the BODY the outcome flips on the caller`s `BYPASSRLS` bit — the policy carries the ' +
        'term and the policy is inert for an exempt caller — and with only half of it, a ' +
        'person whose last membership ends by EXPIRY keeps their sessions. §10, §11 and §11b ' +
        'are the measurements; this is the mirror.',
    )
  })
})

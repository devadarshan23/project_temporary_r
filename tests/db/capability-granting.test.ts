/**
 * CAPABILITY GRANTING, AGAINST A REAL POSTGRESQL — the twelve outcomes G449
 * designed, G511 re-measured on a throwaway database, and **neither slice was
 * allowed to commit**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS SUITE IS FOR, AND WHY IT IS NOT A RESTATEMENT OF `canGrant()`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `tests/model/` already proves the no-escalation rule as a function. This
 * proves it as a PRIVILEGE, which is a different claim: `canGrant()` refusing
 * is a statement about a code path somebody could forget to call, and
 * `role_assignment_grant_restrictive` refusing is a statement about what the
 * database will accept from ANY caller holding the app role — including a
 * handler with a bug, a future operation nobody has written, and a `psql`
 * session with the application's own credentials.
 *
 * ⚠️ AND IT IS THE HALF THAT COULD NOT BE ASSERTED AT ALL UNTIL THIS COMMIT.
 * Until `db/migrations/0020_capability_granting.sql` the app role held `SELECT`
 * and nothing else on `tenant.role_assignment`, so every one of the twelve
 * outcomes below would have been *"permission denied"* and the suite would have
 * proven a privilege rather than a policy — §5.6 with a very convincing green.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ONE MEASUREMENT EVERYTHING ELSE RESTS ON, RE-WITNESSED ON EVERY RUN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     A `WITH CHECK` on `tenant.role_assignment` whose expression SUBQUERIES
 *     `tenant.role_assignment` does NOT trigger PostgreSQL's policy recursion.
 *
 * G449 measured it and recorded it in prose; this file is where it stops being
 * prose. **§1's ALLOW arm would fail with `infinite recursion detected in
 * policy for relation "role_assignment"` if it were wrong**, so the
 * measurement is a property of the suite rather than a claim in a row.
 *
 * ⚠️ AND THE ALLOW ARM IS THE FIRST ASSERTION FOR THAT REASON AND FOR ONE
 * MORE: a control whose only observable behaviour is refusal is §5.6. Eleven
 * refusals with no permitted case would pass identically against a policy
 * reading `WITH CHECK (false)`.
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
import { CAPABILITIES } from '../../model/access.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, and two suites
 * sharing one name race inside `createDatabase()`, which does a `SELECT 1 FROM
 * pg_database` and then a `CREATE DATABASE` with no lock between them. Two
 * concurrent agents collided on `duplicate key (datname)` repeatedly on
 * 19 Sep 2026, and the signature is `fail 0` with a non-zero exit.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_CAPABILITY_GRANT_DB_NAME'] ?? runScopedName('reconcile_capability_grant_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DOOR = 'idc_acme_entra'
/** Holds `manage_roles` AND `view_exception`. The granter. */
const ADMIN = 'usr_acme_admin'
/** A live member with no assignment at all. The target. */
const MEI = 'usr_ops_mei'

/** Carries `manage_roles` + `view_exception`. The admin's own role. */
const ROLE_ADMIN = 'rol_admin'
/** Carries `view_exception`. Grantable BY the admin, because the admin holds it. */
const ROLE_TRIAGE = 'rol_triage'
/** Carries `approve_resolution`. NOT grantable: the admin does not hold it. */
const ROLE_SUPER = 'rol_super'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* Top level, OUTSIDE every `describe`. `tests/ci/reachability-guards.test.ts`
   asserts this by AST walk, because a guard inside a skipped suite is never
   registered and `describe(…, {skip})` never invokes its callback. */
databaseRequiredUnderCi('the capability granting suite', probe)

/**
 * Two people, three roles, one live assignment — and **no assignment for the
 * target**, which is the whole point of the fixture: everything MEI ends up
 * holding in this file was conferred through the fence.
 *
 * ⚠️ `rol_triage` EXISTS IN GLOBEX TOO, AND THAT IS NOT PADDING. §8's
 * cross-tenant arm inserts a row naming GLOBEX; without a GLOBEX role to point
 * at, the composite FOREIGN KEY would refuse it first and the assertion would
 * be measuring a constraint instead of a policy. G449 records that its own
 * first draft was refused by a foreign key and says so — *"REFUSED by the
 * policy (not by a foreign key, which the first draft was)"*.
 */
async function seed(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query('BEGIN')
    await c.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_GRANT',
               'acme-entra-grant', 'active')`,
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

    for (const [tenant, id, label, version] of [
      [ACME, ROLE_ADMIN, 'Administrator', 1],
      [ACME, ROLE_TRIAGE, 'Triage', 1],
      [ACME, ROLE_SUPER, 'Supervisor', 1],
      [GLOBEX, ROLE_TRIAGE, 'Triage', 1],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.role
           (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, $2, $3, $2, $4, 'operator', 'tenant', NULL, 'active')`,
        [tenant, id, label, version],
      )
    }

    for (const [tenant, role, capability] of [
      [ACME, ROLE_ADMIN, CAPABILITIES.manageRoles],
      [ACME, ROLE_ADMIN, CAPABILITIES.viewException],
      [ACME, ROLE_TRIAGE, CAPABILITIES.viewException],
      [ACME, ROLE_SUPER, CAPABILITIES.approveResolution],
      [GLOBEX, ROLE_TRIAGE, CAPABILITIES.viewException],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
         VALUES ($1, $2, $3)`,
        [tenant, role, capability],
      )
    }

    /* The granter's own authority. Written by the MIGRATOR, which is the
       bootstrap `server/data-plane/role-grants.ts` names on its own face: no
       conferral can produce the FIRST holder of a capability in a tenant. */
    await c.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'ras_admin', $2, $3, 1, 'seed', now(), NULL, NULL)`,
      [ACME, ADMIN, ROLE_ADMIN],
    )

    for (const [tenant, id, user] of [
      [ACME, 'mem_admin', ADMIN],
      [ACME, 'mem_mei', MEI],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 'seed', now(), NULL, NULL)`,
        [tenant, id, user, ROLE_ADMIN],
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

/**
 * MINT THIS ACT'S INVARIANT 10 RECORD AND NAME IT — what
 * `writeAuthorisationRecord()` does, in the order it does it.
 *
 * 🛑 THE ORDER IS COPIED FROM THE SEAM RATHER THAN CHOSEN HERE. The seam's
 * header states the property: *"there is no instant at which a transaction
 * names a record it has not written."* A test that named first and wrote second
 * would pass and would be witnessing a different mechanism.
 */
async function actUnder(
  tx: ScopedClient,
  opts: { id: string; capability?: string; actor?: string; tenant?: string },
): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.authorization_grant
       (tenant_id, id, subject_user_id, org_class, partner_id, capability,
        resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
     VALUES ($1, $2, $3, 'customer', NULL, $4,
             'authority', 'User', NULL, NULL, now(), now() + interval '5 minutes')`,
    [
      opts.tenant ?? ACME,
      opts.id,
      opts.actor ?? ADMIN,
      opts.capability ?? CAPABILITIES.manageRoles,
    ],
  )
  await tx.query('SELECT set_config($1, $2, true)', ['app.authorisation_ref', opts.id])
}

/** The one place this suite decides whether a statement was refused. */
async function attempt(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run()
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

interface ConferRow {
  readonly id: string
  readonly user?: string
  readonly role?: string
  readonly version?: number
  readonly grantedBy?: string
  readonly tenant?: string
}

/** The `INSERT` under test, with every field defaulting to the LAWFUL value. */
async function confer(tx: ScopedClient, row: ConferRow): Promise<unknown> {
  return tx.query(
    `INSERT INTO tenant.role_assignment
       (tenant_id, id, user_id, role_id, role_version,
        granted_by, granted_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), NULL, NULL)`,
    [
      row.tenant ?? ACME,
      row.id,
      row.user ?? MEI,
      row.role ?? ROLE_TRIAGE,
      row.version ?? 1,
      row.grantedBy ?? ADMIN,
    ],
  )
}

/**
 * Put the granter's own assignment back between the destructive sections.
 *
 * 🛑 IT DELETES EVERY ASSIGNMENT BUT `ras_admin`, AND NOT JUST THE TARGET'S —
 * THE MUTATION CAMPAIGN IS WHAT FOUND THAT, AND IT IS THE ONE DEFECT THE
 * CAMPAIGN FOUND IN THIS SUITE RATHER THAN IN THE FENCE.
 *
 * The first version deleted `WHERE user_id = MEI`. Under the mutation that
 * removes term 2, §3's self-grant SUCCEEDS and leaves the ADMIN holding a
 * second live assignment carrying `view_exception` — so §7 and §9, which
 * revoke or stale `ras_admin` alone, found the granter still holding the
 * conferred role's verb through the leftover row and **reported failures that
 * belonged to §3**. Three tests went red for one defect, and only one of the
 * three was about the term that had been deleted.
 *
 * ⚠️ NOTHING WAS WRONG WITH THE FENCE AND EVERYTHING WAS WRONG WITH THE
 * REPORTING, WHICH IS THE WORSE HALF: a suite that attributes a failure to the
 * wrong section sends the next reader at the wrong expression. The fixture is
 * now restored to one known state rather than to the absence of one row.
 */
async function restore(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query(
      `UPDATE tenant.role_assignment
          SET revoked_at = NULL, expires_at = NULL, role_version = 1
        WHERE id = 'ras_admin'`,
    )
    await c.query(`UPDATE tenant.role SET status = 'active', version = 1`)
    await c.query(`DELETE FROM tenant.role_assignment WHERE id <> 'ras_admin'`)
  } finally {
    await c.end()
  }
}

async function assignmentsFor(userId: string): Promise<number> {
  const c = await migratorClient()
  try {
    const r = await c.query(
      `SELECT count(*)::int AS n FROM tenant.role_assignment WHERE user_id = $1`,
      [userId],
    )
    return (r.rows as unknown as Array<{ n: number }>)[0]?.n ?? -1
  } finally {
    await c.end()
  }
}

describe('capability granting, over a real PostgreSQL', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /* `max: 1`, so every statement runs on ONE pooled backend and a GUC left
       behind by one transaction would be visible to the next. G101 says
       `SET LOCAL` prevents that; a pool of one is what makes that falsifiable. */
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool?.end()
  })

  /* ---------------------------------------------------------------- *
   * §0 · THE `ALTER POLICY` REPLACED WHAT IT NAMED AND NOTHING ELSE.
   * ---------------------------------------------------------------- */

  /**
   * 🛑 THIS ASSERTION EXISTS BECAUSE THE NEAR-MISS IS ON THE RECORD.
   * `0008`'s first draft `ALTER POLICY`d `session_selection_restrictive` and
   * dropped its three-governance-list `NOT EXISTS` while doing so — **it would
   * have parsed cleanly and silently widened invariant 8 to `statutory`**, the
   * class invariant 8 refuses *"at any price"*.
   *
   * `db/migrations/0020` names `WITH CHECK` and omits `USING`, so PostgreSQL
   * leaves the `USING` expression alone and there is no copy to mistype. **That
   * is a claim about PostgreSQL's semantics, which is exactly the kind of claim
   * that must be measured rather than remembered**, so this reads the catalogue
   * and compares `role_assignment_rls`'s surviving `qual` against the two
   * sibling policies `0009` wrote in the same statement block and this commit
   * did not touch.
   */
  it('§0 · the ALTER added a WITH CHECK and left 0009’s USING byte-identical', async () => {
    const c = await migratorClient()
    let rows: Array<{ policyname: string; qual: string | null; with_check: string | null }>
    try {
      rows = (
        await c.query(
          `SELECT policyname, qual, with_check
             FROM pg_policies
            WHERE schemaname = 'tenant'
              AND policyname IN ('role_rls', 'role_capability_rls', 'role_assignment_rls')
            ORDER BY 1`,
        )
      ).rows as unknown as Array<{
        policyname: string
        qual: string | null
        with_check: string | null
      }>
    } finally {
      await c.end()
    }

    assert.equal(rows.length, 3, 'all three of 0009’s tenant-scoped policies are present')

    const byName = new Map(rows.map((r) => [r.policyname, r]))
    const untouched = byName.get('role_rls')?.qual
    assert.ok(untouched, 'role_rls has a USING expression to compare against')

    assert.equal(
      byName.get('role_assignment_rls')?.qual,
      untouched,
      'the ALTER REPLACED the USING expression. `db/migrations/0020` names only `WITH CHECK` ' +
        'precisely so this cannot happen — if this is red, either the migration grew a ' +
        '`USING` clause or PostgreSQL does not leave an omitted clause unchanged, and the ' +
        'second would mean every `ALTER POLICY` in this directory needs re-reading.',
    )
    assert.equal(
      byName.get('role_capability_rls')?.qual,
      untouched,
      'the three predicates are 0001’s, verbatim, and their sameness is load-bearing ' +
        'rather than tidy — 0009 says so in its own voice',
    )

    assert.equal(
      byName.get('role_assignment_rls')?.with_check,
      untouched,
      '0009’s owed `WITH CHECK` is not the same sentence as its `USING`. A row may be ' +
        'READ from this tenant and may be WRITTEN into this tenant, and the two are one fact ' +
        'asked twice — 0010 and 0005 are the same shape.',
    )
    assert.equal(
      byName.get('role_rls')?.with_check,
      null,
      'this commit grants a write on ONE table and therefore owes a `WITH CHECK` on ONE ' +
        'table. A `WITH CHECK` on `role` would be a clause with no privilege behind it.',
    )
    assert.equal(byName.get('role_capability_rls')?.with_check, null, 'and the same for role_capability')
  })

  /* ---------------------------------------------------------------- *
   * §1 · THE ALLOW ARM. First, because eleven refusals prove nothing.
   * ---------------------------------------------------------------- */

  it('§1 · an administrator confers a role whose every capability it already holds', async () => {
    await restore()
    const failure = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_1' })
        await confer(tx, { id: 'ras_allowed_1' })
      })
    })

    assert.equal(
      failure,
      null,
      'the LAWFUL conferral was refused, so every refusal below is vacuous. If the message ' +
        'names `infinite recursion detected in policy for relation "role_assignment"`, then ' +
        'G449’s sharpest measurement is wrong and the whole fence has to be redesigned: ' +
        `got — ${failure}`,
    )
    assert.equal(await assignmentsFor(MEI), 1, 'and the row is actually there')
  })

  /* ---------------------------------------------------------------- *
   * §2–§8 · THE SEVEN THE POLICY REFUSES.
   * ---------------------------------------------------------------- */

  /**
   * 🛑 THE REFUSAL MESSAGE NAMES THE POLICY, AND THIS SUITE ASSERTS THAT NAME
   * RATHER THAN THE BARE PHRASE. PostgreSQL writes `new row violates row-level
   * security policy "<name>" for table "<t>"` when a RESTRICTIVE policy refuses
   * and the unnamed form when the PERMISSIVE set does — so asserting the name
   * is what distinguishes *"the fence refused this"* from *"the tenant
   * predicate refused this"*. Without it, §2 through §7 would all pass against
   * a `role_assignment_rls` that had accidentally been narrowed, and the fence
   * would be proving the tenant check.
   */
  const REFUSED_BY_THE_FENCE = /role_assignment_grant_restrictive/

  it('§2 · ESCALATION — a role carrying a verb the granter lacks', async () => {
    await restore()
    const failure = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_2' })
        await confer(tx, { id: 'ras_escalate', role: ROLE_SUPER })
      })
    })
    assert.match(
      failure ?? '',
      REFUSED_BY_THE_FENCE,
      'an administrator holding `manage_roles` and NOT `approve_resolution` conferred a role ' +
        'carrying `approve_resolution`. That is two maintenance capabilities becoming ' +
        'unlimited approval authority — `canGrant()`’s own worked example.',
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and nothing was written')
  })

  /**
   * ⚠️ THIS ARM WAS MISSING FROM THE FIRST DRAFT OF THIS SUITE AND THE
   * MUTATION CAMPAIGN MEASURED THE GAP RATHER THAN THE AUTHOR GUESSING AT IT:
   * with this test deleted, removing `AND tr.status = 'active'` from the fence
   * ran the whole suite GREEN — `fail 0`, sixteen tests, a SURVIVOR. An archived role is one a pack has withdrawn, and
   * `decide()` refuses `role_not_active` on it — so conferring one writes
   * authority that evaluates to nothing, which is the inert-row problem §7
   * argues, arriving through a different column.
   */
  it('§2b · the CONFERRED role must itself be active', async () => {
    await restore()
    const c = await migratorClient()
    try {
      await c.query(`UPDATE tenant.role SET status = 'archived' WHERE tenant_id = $1 AND id = $2`, [
        ACME,
        ROLE_TRIAGE,
      ])
    } finally {
      await c.end()
    }

    const failure = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_2b' })
        await confer(tx, { id: 'ras_archived' })
      })
    })
    assert.match(
      failure ?? '',
      REFUSED_BY_THE_FENCE,
      'an ARCHIVED role was conferred. `decide()` answers `role_not_active` for it, so the ' +
        'row would be authority nobody can use — and a withdrawn role being re-issued is ' +
        'exactly the state a pack rollback creates.',
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and nothing was written')
    await restore()
  })

  it('§3 · SELF-GRANT — the actor names itself as the holder', async () => {
    await restore()
    const failure = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_3' })
        await confer(tx, { id: 'ras_self', user: ADMIN })
      })
    })
    assert.match(
      failure ?? '',
      REFUSED_BY_THE_FENCE,
      'self-assignment of a role was accepted. `TenantAccessGrant` two modules over enforces ' +
        '`approvedByStaffUserId !== staffUserId` at issue AND re-checks it at evaluation; this ' +
        'is that rule on the tenant arm.',
    )
    assert.equal(await assignmentsFor(ADMIN), 1, 'and the admin still holds exactly its seeded one')
  })

  it('§4 · FORGED `granted_by` — a row attributing the act to somebody else', async () => {
    await restore()
    const failure = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_4' })
        await confer(tx, { id: 'ras_forged', grantedBy: MEI })
      })
    })
    assert.match(
      failure ?? '',
      REFUSED_BY_THE_FENCE,
      '`granted_by` did not have to equal the acting subject, so the audit column a reader ' +
        'uses to answer "who conferred this" was writable by the conferrer. The value comes ' +
        'from the act’s own invariant 10 record and from nowhere else.',
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and nothing was written')
  })

  it('§5 · A RECORD NAMING THE WRONG CAPABILITY', async () => {
    await restore()
    const failure = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_5', capability: CAPABILITIES.viewException })
        await confer(tx, { id: 'ras_wrong_cap' })
      })
    })
    assert.match(
      failure ?? '',
      REFUSED_BY_THE_FENCE,
      'a `view_exception` act conferred a role. Every gated handler on this plane mints a ' +
        'record and `writeAuthorisationRecord()` names it for ALL of them — deliberately, ' +
        'because "putting an `if` here would put a fragment of the access decision in the ' +
        'seam". The POLICY is what reads the capability column, and this is that read.',
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and nothing was written')
  })

  it('§6 · NO RECORD AT ALL — and a forged NAME is inert', async () => {
    await restore()

    const bare = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await confer(tx, { id: 'ras_no_record' })
      })
    })
    assert.match(
      bare ?? '',
      REFUSED_BY_THE_FENCE,
      'a conferral outside any authorised act was accepted. G100: the GUC is unset, ' +
        '`nullif(current_setting(…, true), \'\')` is NULL, `= NULL` is NULL, NULL is not ' +
        'TRUE, and the policy DENIES.',
    )

    /**
     * 🛑 THE SECOND HALF IS THE ONE THAT DISTINGUISHES THIS FENCE FROM A FLAG,
     * AND `0018` STATES IT: *"A forged NAME is inert."* `app.directory_reach =
     * '1'` would be a claim the database must believe; a grant id is a name the
     * database CHECKS.
     */
    const forged = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await tx.query('SELECT set_config($1, $2, true)', [
          'app.authorisation_ref',
          'azg_forged_0000000000000000000000',
        ])
        await confer(tx, { id: 'ras_forged_ref' })
      })
    })
    assert.match(
      forged ?? '',
      REFUSED_BY_THE_FENCE,
      'a grant id with no row behind it opened the fence, which would make this a flag ' +
        'wearing a name. The row must EXIST, be in this tenant scope, carry `manage_roles` ' +
        'and be unexpired — and the only writer of a matching row is `authorize()`.',
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and neither attempt wrote anything')
  })

  /**
   * ⚠️ THIS ARM WAS ALSO MISSING AND WAS MEASURED THE SAME WAY: with this test
   * deleted, replacing `g.expires_at > now()` with `true` ran the whole suite
   * GREEN — `fail 0`, a second SURVIVOR.
   *
   * 🛑 IT IS THE TERM THAT MAKES THE RECORD A RECEIPT RATHER THAN A KEY.
   * `tenant.authorization_grant` is APPEND-ONLY — `0010` grants no `UPDATE`
   * and no `DELETE` — so every grant ever minted stays readable forever. With
   * no clock term, a `manage_roles` record from any point in the tenant's
   * history would open the fence for any transaction that could name it, and
   * the append-only property would have turned from an audit guarantee into a
   * permanent key ring.
   */
  it('§6b · AN EXPIRED RECORD opens nothing, though the row is still there', async () => {
    await restore()
    const failure = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await tx.query(
          `INSERT INTO tenant.authorization_grant
             (tenant_id, id, subject_user_id, org_class, partner_id, capability,
              resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
           VALUES ($1, 'azg_grant_6b', $2, 'customer', NULL, $3,
                   'authority', 'User', NULL, NULL,
                   now() - interval '2 hours', now() - interval '1 hour')`,
          [ACME, ADMIN, CAPABILITIES.manageRoles],
        )
        await tx.query('SELECT set_config($1, $2, true)', [
          'app.authorisation_ref',
          'azg_grant_6b',
        ])
        await confer(tx, { id: 'ras_expired_ref' })
      })
    })
    assert.match(
      failure ?? '',
      REFUSED_BY_THE_FENCE,
      'an EXPIRED invariant 10 record opened the fence. `tenant.authorization_grant` is ' +
        'append-only, so without the clock term every record ever minted would stay a live ' +
        'key — the audit guarantee turned into a key ring.',
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and nothing was written')
  })

  it('§7 · A MOVED VERSION PIN — in both directions', async () => {
    await restore()

    const ahead = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_7a' })
        await confer(tx, { id: 'ras_pin_ahead', version: 99 })
      })
    })
    assert.match(
      ahead ?? '',
      REFUSED_BY_THE_FENCE,
      'a row pinned to a role version that does not exist was stored. `decide()` stops ' +
        'evaluating an assignment whose pin has moved IN EITHER DIRECTION, so such a row is ' +
        'authority nobody can ever use — and an inert authority row is indistinguishable ' +
        'from a live one to an auditor reading this table.',
    )

    /**
     * ⚠️ THE GRANTER'S OWN PIN IS THE OTHER HALF, AND IT IS THE ARM THAT MAKES
     * "a moved version pin" A NO-ESCALATION TERM RATHER THAN A TIDINESS ONE. A
     * granter whose own assignment is pinned to a version the role has moved
     * past does not HOLD the verb — `decide()` refuses `role_version_moved` —
     * so they may confer nothing.
     */
    const c = await migratorClient()
    try {
      await c.query(`UPDATE tenant.role SET version = 2 WHERE tenant_id = $1 AND id = $2`, [
        ACME,
        ROLE_ADMIN,
      ])
    } finally {
      await c.end()
    }

    const granterStale = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_7b' })
        await confer(tx, { id: 'ras_pin_granter' })
      })
    })
    assert.match(
      granterStale ?? '',
      REFUSED_BY_THE_FENCE,
      'a granter whose OWN assignment is pinned to a superseded role version still conferred. ' +
        '"A widened role is a NEW version and needs consent" — §10.5 adds the case that ' +
        'makes it non-negotiable: a failed injection probe can auto-revert a pack at 04:00.',
    )
    assert.equal(await assignmentsFor(MEI), 0, 'and neither attempt wrote anything')
    await restore()
  })

  it('§8 · CROSS-TENANT — a row naming another tenant', async () => {
    await restore()
    const failure = await attempt(async () => {
      await withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, { id: 'azg_grant_8' })
        await confer(tx, { id: 'ras_cross', tenant: GLOBEX })
      })
    })
    /**
     * ⚠️ THIS ONE IS REFUSED BY `role_assignment_rls`'s NEW `WITH CHECK` AND
     * NOT BY THE FENCE, WHICH IS WHY IT IS THE ONE ASSERTION HERE THAT DOES NOT
     * MATCH THE POLICY NAME. `0009` owed that clause — *"the commit that grants
     * a write here owes the `WITH CHECK` in the same commit as the writer"* —
     * and this is the assertion that discharges it. The unnamed form of the
     * message is PostgreSQL saying the PERMISSIVE set refused, which is exactly
     * the right component: a tenant boundary is invariant 1's and is not this
     * fence's to enforce.
     */
    assert.match(
      failure ?? '',
      /violates row-level security policy/,
      'a conferral wrote authority into another tenant. The `WITH CHECK` on ' +
        '`role_assignment_rls` is 0009’s owed clause and this is what it is for.',
    )
    assert.doesNotMatch(
      failure ?? '',
      REFUSED_BY_THE_FENCE,
      'the cross-tenant write was caught by the GRANT fence rather than by the tenant ' +
        'predicate. That is the right outcome by accident: it means `role_assignment_rls`’s ' +
        '`WITH CHECK` is missing or inert, and invariant 1 would be resting on a policy that ' +
        'exists to answer a different question.',
    )
    const c = await migratorClient()
    try {
      const r = await c.query(`SELECT count(*)::int AS n FROM tenant.role_assignment WHERE tenant_id = $1`, [GLOBEX])
      assert.equal((r.rows as unknown as Array<{ n: number }>)[0]?.n, 0, 'and GLOBEX holds nothing')
    } finally {
      await c.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * §9 · THE GRANTER'S OWN ASSIGNMENT MUST BE LIVE, IN EVERY SENSE.
   * ---------------------------------------------------------------- */

  /**
   * 🛑 THESE ARE NOT A FOURTH COPY OF `decide()` AND THE MIGRATION ARGUES WHY.
   * `0009` refuses a liveness `WHERE` in the READER, because it would rob the
   * evaluator of a named refusal — *"`decide()` owns those two questions and
   * answers them SEPARATELY, by name."* Nothing downstream of a `WITH CHECK`
   * reads a reason: it decides whether a row may be written, and a row written
   * on the strength of a revoked assignment is authority laundered through an
   * expired one.
   */
  it('§9 · a revoked, expired or inactive granter confers nothing', async () => {
    const arms: Array<[string, string, string]> = [
      ['revoked', `UPDATE tenant.role_assignment SET revoked_at = now() WHERE id = 'ras_admin'`, 'ras_live_a'],
      [
        'expired',
        `UPDATE tenant.role_assignment SET expires_at = now() - interval '1 hour' WHERE id = 'ras_admin'`,
        'ras_live_b',
      ],
      [
        'role archived',
        `UPDATE tenant.role SET status = 'archived' WHERE tenant_id = '${ACME}' AND id = '${ROLE_ADMIN}'`,
        'ras_live_c',
      ],
    ]

    for (const [what, mutate, rowId] of arms) {
      await restore()
      const c = await migratorClient()
      try {
        await c.query(mutate)
      } finally {
        await c.end()
      }

      const failure = await attempt(async () => {
        await withTenantScope(pool, ACME, async (tx) => {
          await actUnder(tx, { id: `azg_grant_9_${rowId}` })
          await confer(tx, { id: rowId })
        })
      })
      assert.match(
        failure ?? '',
        REFUSED_BY_THE_FENCE,
        `a granter whose authority is ${what} still conferred. The record proves the ` +
          'evaluator said yes AT MINT TIME; term 3 is what proves the granter STILL HOLDS the ' +
          'verbs at write time, which is G399’s shape arriving on a different table.',
      )
      assert.equal(await assignmentsFor(MEI), 0, `and nothing was written for the ${what} arm`)
    }
    await restore()
  })

  /* ---------------------------------------------------------------- *
   * §10 · WHAT IS REFUSED BY PRIVILEGE RATHER THAN BY POLICY.
   * ---------------------------------------------------------------- */

  /**
   * 🛑 FOUR REFUSALS THE FENCE DOES NOT MAKE, AND THE CHEAPEST PLACE TO CHECK
   * THEM IS THE HARDEST TO AMEND BY ACCIDENT — `tests/db/administrative-reach
   * .test.ts` §5's own phrasing about a privilege error.
   *
   * ⚠️ THE `role_capability` ONE IS THE ONE TO READ. Term 3 compares the
   * conferred role's capabilities against the granter's; a path that could add
   * a row to `tenant.role_capability` could add a verb to a role the granter
   * ALREADY HOLDS, which widens their own authority with no conferral at all
   * and which nothing in the fence looks at.
   */
  it('§10 · UPDATE and DELETE on the assignment, and INSERT on role and role_capability', async () => {
    await restore()
    await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, { id: 'azg_grant_10' })
      await confer(tx, { id: 'ras_priv_base' })
    })
    assert.equal(await assignmentsFor(MEI), 1, 'the lawful conferral stands, so the row exists to attack')

    const cases: Array<[string, string, string]> = [
      [
        'UPDATE the assignment',
        `UPDATE tenant.role_assignment SET revoked_at = NULL WHERE id = 'ras_admin'`,
        'permission denied for table role_assignment',
      ],
      [
        'DELETE the assignment',
        `DELETE FROM tenant.role_assignment WHERE id = 'ras_priv_base'`,
        'permission denied for table role_assignment',
      ],
      [
        'INSERT a role',
        `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ('${ACME}', 'rol_minted', 'Minted', 'minted', 1, 'operator', 'tenant', NULL, 'active')`,
        'permission denied for table role',
      ],
      [
        'INSERT a role capability',
        `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
         VALUES ('${ACME}', '${ROLE_ADMIN}', '${CAPABILITIES.approveResolution}')`,
        'permission denied for table role_capability',
      ],
    ]

    for (const [what, sql, expected] of cases) {
      const failure = await attempt(async () => {
        await withTenantScope(pool, ACME, async (tx) => {
          await actUnder(tx, { id: `azg_grant_10_${what.replace(/\W+/g, '_')}` })
          await tx.query(sql)
        })
      })
      assert.ok(
        (failure ?? '').includes(expected),
        `\`${what}\` was not refused by PRIVILEGE. \`db/migrations/0020\` grants INSERT on ` +
          'exactly one table and nothing else anywhere, and each of these four is argued by ' +
          `name in its grants block. Got — ${failure}`,
      )
    }
    await restore()
  })

  /* ---------------------------------------------------------------- *
   * §11 · THE MIRROR. `0002`'s "third place to drift", answered with a
   *       control rather than an argument — `0008`'s and `0018`'s answer.
   * ---------------------------------------------------------------- */

  it('§11 · the capability literal in the fence is a real member of `CAPABILITIES`', async () => {
    const c = await migratorClient()
    let expression: string
    try {
      const rows = (
        await c.query(
          `SELECT coalesce(with_check, '') AS expr
             FROM pg_policies
            WHERE schemaname = 'tenant'
              AND policyname = 'role_assignment_grant_restrictive'`,
        )
      ).rows as unknown as Array<{ expr: string }>
      assert.equal(rows.length, 1, 'the fence is present in the catalogue exactly once')
      expression = rows[0]?.expr ?? ''
    } finally {
      await c.end()
    }

    const literals = [...expression.matchAll(/capability\s*=\s*'([a-z_]+)'/g)].map(
      (m) => m[1] as string,
    )
    assert.ok(literals.length > 0, 'the policy names a capability at all')

    const known = new Set<string>(Object.values(CAPABILITIES))
    for (const literal of literals) {
      /* 🛑 A POLICY EXPRESSION CANNOT IMPORT A TYPESCRIPT CONSTANT — `0008`'s
         own sentence — so the literal is a MIRROR and this is the mirror's
         check. The failure mode without it is the worst one available: a
         capability renamed in `model/` leaves this policy matching nothing,
         every conferral is refused, and everything merely LOOKS safe. Nothing
         throws, no test fails, and the fence is quietly a `WITH CHECK (false)`. */
      assert.ok(
        known.has(literal),
        `the fence names \`${literal}\`, which is not in \`CAPABILITIES\`. A capability was ` +
          'renamed in `model/access.ts` and the policy was not. Every conferral is now ' +
          'permanently refused and FAILS SILENTLY — nothing throws.',
      )
    }
    assert.ok(
      literals.includes(CAPABILITIES.manageRoles),
      'the fence no longer requires `manage_roles`, so it is gated on some other verb',
    )
  })

  /* ---------------------------------------------------------------- *
   * §12 · WHO ELSE READS THIS TABLE, FROM THE CATALOGUE.
   * ---------------------------------------------------------------- */

  /**
   * 🛑 `0018` (1)'s QUESTION, ASKED IN THE OTHER DIRECTION AND ANSWERED THE
   * SAME WAY: FROM `pg_policies`, NOT FROM THE FILES. PostgreSQL applies
   * row-level security to a table referenced inside a policy expression, so a
   * policy elsewhere that joined to `tenant.role_assignment` would inherit
   * whatever this table's permissive policy admits — and a `grep` over
   * `db/migrations/` answers for today while the catalogue answers for the tree
   * that is actually applied, including anything an `ALTER POLICY` introduced.
   *
   * ⚠️ CHECKED IN BOTH DIRECTIONS, because *"an exemption that exempts nothing
   * is a licence waiting to be reused."*
   */
  it('§12 · exactly one policy reads `tenant.role_assignment`, and it is argued', async () => {
    const EXPECTED = new Set([
      /* 0009's platform-role reader. Its inner reference is
         `tenant.platform_role_assignment`, a DIFFERENT table — it is listed
         here only if the catalogue says its text matches, and it should not. */
      'role_assignment.role_assignment_grant_restrictive',
    ])

    const c = await migratorClient()
    let names: readonly string[]
    try {
      const rows = (
        await c.query(
          `SELECT tablename || '.' || policyname AS name
             FROM pg_policies
            WHERE schemaname = 'tenant'
              AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '\\mrole_assignment\\M'
            ORDER BY 1`,
        )
      ).rows as unknown as Array<{ name: string }>
      names = rows.map((r) => r.name)
    } finally {
      await c.end()
    }

    assert.deepEqual(
      [...names].sort(),
      [...EXPECTED].sort(),
      'the set of policies whose expression reads `tenant.role_assignment` has changed. A ' +
        'policy on another table that joined to it would inherit this table’s visibility ' +
        'silently — 0005’s measured fact, which 0009 then used deliberately for ' +
        '`platform_role_rls`. Either narrow that expression or argue the inheritance where ' +
        'the policy is written, and amend this assertion, which exists to force that ' +
        'conversation rather than to be deleted.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §13 · G100's FORM, READ FROM THE CATALOGUE.
   * ---------------------------------------------------------------- */

  /**
   * 🛑 `0005`'s ARGUMENT, AS A RUNNABLE ASSERTION — `tests/db/administrative-
   * directory.test.ts` §9's shape, applied to the two GUCs this fence reads.
   *
   * A GUC that was SET and reverted reads back as the EMPTY STRING, not NULL.
   * Without the `nullif`, `g.id = current_setting('app.authorisation_ref',
   * true)` becomes `g.id = ''` on such a connection, which denies BY ACCIDENT
   * and only because no grant id happens to be empty. **It is a predicate that
   * is correct for a reason nobody chose**, and the day something writes an
   * empty id it opens. Read from `pg_policies` rather than from the file,
   * because the catalogue answers for the tree that is applied.
   */
  it('§13 · every `current_setting` in the fence is wrapped in `nullif`', async () => {
    const c = await migratorClient()
    let expr: string
    try {
      const rows = (
        await c.query(
          `SELECT coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr
             FROM pg_policies
            WHERE schemaname = 'tenant'
              AND policyname IN ('role_assignment_grant_restrictive', 'role_assignment_rls')`,
        )
      ).rows as unknown as Array<{ expr: string }>
      assert.equal(rows.length, 2, 'both policies on this table are present in the catalogue')
      expr = rows.map((r) => r.expr).join(' ')
    } finally {
      await c.end()
    }

    const bare = [...expr.matchAll(/current_setting\('([a-z_.]+)'[^)]*\)/g)].filter((m) => {
      const at = m.index ?? 0
      return !/nullif\(\s*$/i.test(expr.slice(Math.max(0, at - 12), at))
    })
    assert.deepEqual(
      bare.map((m) => m[1]),
      [],
      'a `current_setting` is read without `nullif`, so a reverted GUC compares as the empty ' +
        'string rather than as NULL. G100 is the polarity; the `nullif` is what makes the ' +
        'polarity reachable.',
    )
    assert.ok(
      expr.includes("current_setting('app.authorisation_ref'"),
      'the fence no longer reads `app.authorisation_ref`, so G507’s mechanism is gone',
    )
    assert.ok(
      expr.includes("current_setting('app.tenant_id'"),
      'the fence no longer reads `app.tenant_id`',
    )
  })
})

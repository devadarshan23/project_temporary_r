/**
 * THE ADMINISTRATIVE DIRECTORY — over a real PostgreSQL. **G506, G507 —
 * 19 Sep 2026.** `db/migrations/0018_administrative_directory.sql`.
 *
 * ┌─ WHAT THIS IS THE POSITIVE HALF OF ───────────────────────────────────────┐
 * │ `tests/db/administrative-reach.test.ts` measured a WALL: a caller saw      │
 * │ exactly one person — itself — and inside `withTenantScope()` it saw ZERO.  │
 * │ That suite says of itself: *"it goes RED when the limitation is lifted …   │
 * │ the commit that widens administrative reach is the commit that must        │
 * │ re-argue every assertion here, one by one."*                               │
 * │                                                                            │
 * │ **This file is that re-argument, and the reach suite is amended in the     │
 * │ same commit rather than deleted** — `0017`'s discipline, quoted there:     │
 * │ a tripwire is *"replaced by the positive assertion in the same commit"*.   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 THE ONE THING TO UNDERSTAND BEFORE READING AN ASSERTION ───────────────┐
 * │ The policy does **NOT** ask whether the caller holds `manage_roles`. It    │
 * │ asks whether THIS TRANSACTION CARRIES AN INVARIANT 10 RECORD for           │
 * │ `manage_roles` — a row only `authorize()` can have written, named by       │
 * │ `app.authorisation_ref`, which `writeAuthorisationRecord()` sets from the  │
 * │ grant it just inserted.                                                    │
 * │                                                                            │
 * │ That is why there is no second evaluator here and why §3 and §4 are the    │
 * │ two assertions that carry the design: a record for the WRONG capability    │
 * │ opens nothing, and a NAME WITH NO ROW opens nothing. A bare flag would     │
 * │ fail both.                                                                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THIS SUITE MINTS ITS OWN GRANT ROWS RATHER THAN DRIVING A HANDLER, AND
 *    THAT IS A REAL LIMIT ON WHAT IT WITNESSES. It proves the POLICY. It does
 *    not prove that any served path sets `app.authorisation_ref` — that is
 *    `tests/http/authorisation-record.test.ts` and the served suites, and the
 *    join between the two is that both name the same GUC. Stated so a green
 *    run here is not read as a green request path.
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

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, and two suites
 * sharing one name race inside `applyMigrations()`. Two concurrent agents
 * collided on `duplicate key (datname)` twice on 19 Sep 2026.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_ADMIN_DIRECTORY_DB_NAME'] ?? runScopedName('reconcile_admin_directory_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DOOR = 'idc_acme_entra'
const ADMIN = 'usr_acme_admin'
const MEI = 'usr_ops_mei'
/** A person with a membership in GLOBEX and none in ACME. */
const RUTH = 'usr_globex_ruth'
const GLOBEX_DOOR = 'idc_globex_okta'

const ADMIN_DIGEST = 'digest_admin_7c1e5a02d7e64a95b31067ce4a8d29f1'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* Top level, OUTSIDE every `describe`. `tests/ci/reachability-guards.test.ts`
   asserts this by AST walk. */
databaseRequiredUnderCi('the administrative directory suite', probe)

async function seed(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query('BEGIN')
    /* `PROTOCOL_IS_BROKERED.oidc` is `true`, so an `oidc` door needs the
       broker pair — G304. A null there is a constraint violation, not a gap. */
    for (const [id, owner, account] of [
      [DOOR, 'Acme Entra ID', 'acc_acme'],
      [GLOBEX_DOOR, 'Globex Okta', 'acc_globex'],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status)
         VALUES ($1, 'oidc', $2, 'customer', NULL, $3,
                 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_DIR',
                 $1, 'active')`,
        [id, owner, account],
      )
    }
    for (const [id, name, door] of [
      [ADMIN, 'Acme Administrator', DOOR],
      [MEI, 'Mei Tan', DOOR],
      [RUTH, 'Ruth Iyer', GLOBEX_DOOR],
    ] as const) {
      await c.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@invalid', $2, 'active', $3)`,
        [id, name, door],
      )
    }
    for (const tenant of [ACME, GLOBEX]) {
      await c.query(
        `INSERT INTO tenant.role
           (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, 'rol_dir', 'Directory', 'directory', 1, 'operator', 'tenant', NULL, 'active')`,
        [tenant],
      )
    }
    for (const [tenant, id, user] of [
      [ACME, 'mem_admin', ADMIN],
      [ACME, 'mem_mei', MEI],
      [GLOBEX, 'mem_ruth', RUTH],
    ] as const) {
      await c.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, 'rol_dir', 'seed', now(), NULL, NULL)`,
        [tenant, id, user],
      )
    }
    await c.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_admin', $1, $2, $3, $4, 'acme.dir.invalid',
               now(), now(), now() + interval '12 hours', NULL)`,
      [ADMIN_DIGEST, ADMIN, DOOR, ACME],
    )
    await c.query('COMMIT')
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await c.end()
  }
}

/**
 * MINT AN INVARIANT 10 RECORD THE WAY `writeAuthorisationRecord()` DOES —
 * the `INSERT`, then the `set_config` naming it, in that order and in the
 * caller's own transaction.
 *
 * 🛑 THE ORDER IS COPIED FROM THE SEAM RATHER THAN CHOSEN HERE. The seam's
 *    header states the property: *"there is no instant at which a transaction
 *    names a record it has not written."* A test that named first and wrote
 *    second would pass and would be witnessing a different mechanism.
 */
async function actUnder(
  tx: ScopedClient,
  opts: { id: string; capability: string; actor: string; tenant?: string },
): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.authorization_grant
       (tenant_id, id, subject_user_id, org_class, partner_id, capability,
        resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
     VALUES ($1, $2, $3, 'customer', NULL, $4,
             'authority', 'User', NULL, NULL, now(), now() + interval '5 minutes')`,
    [opts.tenant ?? ACME, opts.id, opts.actor, opts.capability],
  )
  await tx.query('SELECT set_config($1, $2, true)', ['app.authorisation_ref', opts.id])
}

async function ids(tx: ScopedClient, sql: string): Promise<readonly string[]> {
  return ((await tx.query(sql)).rows as unknown as Array<{ id: string }>).map((r) => r.id)
}

/** Put memberships — and, since `0035`, sessions — back between the
 *  destructive sections.
 *
 *  ⚠️ THE SESSION LINE IS NEW AND IT IS `0035` ARRIVING IN THIS FIXTURE.
 *  Lapsing a membership now fires `membership_revocation_voids_sessions`, so
 *  §5b — which lapses the ACTOR's own membership — takes `ses_admin` down with
 *  it and §8 would then read a revoked session. The membership `UPDATE` below
 *  sets both columns to `NULL`, which makes the row LIVE, so it fires nothing. */
async function restore(): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query(`UPDATE tenant.membership SET revoked_at = NULL, expires_at = NULL`)
    await c.query(`UPDATE tenant.session SET revoked_at = NULL`)
  } finally {
    await c.end()
  }
}

/**
 * Lapse a membership BY EXPIRY, as the migrator, inside an authorised act.
 *
 * 🛑 THE SCOPE AND THE RECORD ARE NOT CEREMONY AND THEY ARE `0035`. Until
 *    19 Sep 2026 an expiry fired nothing, because `0019`'s trigger was keyed on
 *    `revoked_at` changing rather than on the membership ceasing to be LIVE —
 *    so **`expires_at` was a second, entirely unguarded removal path**, and
 *    this file's own §5/§5b were the two places in the tree that used it. The
 *    comment that stood here said an expiry is *"a clock arriving and nobody's
 *    act"* and that *"the trigger's `WHEN` does not match it"*; **the second
 *    half was the defect and the first half is the distinction that survives.**
 *    A clock ARRIVING is nobody's act and still fires nothing. A statement that
 *    WRITES a past `expires_at` is somebody's act, and it is now as answerable
 *    as a revocation: guard 1a wants the tenant scope, guard 1b wants the
 *    invariant 10 record.
 */
async function lapse(userId: string, grantId: string): Promise<void> {
  const c = await migratorClient()
  try {
    await c.query(`SELECT set_config('app.tenant_id', $1, false)`, [ACME])
    await c.query(
      `INSERT INTO tenant.authorization_grant
         (tenant_id, id, subject_user_id, org_class, partner_id, capability,
          resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
       VALUES ($1, $2, $3, 'customer', NULL, $4,
               'authority', 'Membership', NULL, NULL, now(), now() + interval '5 minutes')`,
      [ACME, grantId, ADMIN, CAPABILITIES.manageRoles],
    )
    await c.query(`SELECT set_config('app.authorisation_ref', $1, false)`, [grantId])
    await c.query(
      `UPDATE tenant.membership SET expires_at = now() - interval '1 hour' WHERE user_id = $1`,
      [userId],
    )
  } finally {
    await c.end()
  }
}

describe('the administrative directory, over a real PostgreSQL', { skip }, () => {
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
   * §1 · THE DEFAULT IS STILL CLOSED. G447's §1b, unchanged by G506.
   * ---------------------------------------------------------------- */

  it('§1 · a tenant scope carrying NO authorisation record reads NO person and NO door', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => ({
      users: (await tx.query(`SELECT id FROM tenant."user"`)).rowCount,
      doors: (await tx.query(`SELECT id FROM tenant.identity_connection`)).rowCount,
    }))

    /* 🛑 THIS IS THE ASSERTION THAT KEEPS G506 A WIDENING RATHER THAN A
       DELETION. `withTenantScope()` is the transaction every gated handler
       runs in, and the ordinary gated handler — `listRuns`, `getException` —
       must still read NOTHING here. A directory that opened for every
       authorised act would be `user_rls` deleted with extra steps. */
    assert.equal(seen.users, 0, 'no record, no directory — the default did not move')
    assert.equal(seen.doors, 0, 'and no door either')
  })

  /* ---------------------------------------------------------------- *
   * §2 · THE DIRECTORY OPENS — AND `orgFor()`'s INPUT ARRIVES WITH IT.
   * ---------------------------------------------------------------- */

  it('§2 · inside an act carrying `manage_roles` the tenant roster and its doors are readable', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, { id: 'azg_dir_2', capability: CAPABILITIES.manageRoles, actor: ADMIN })
      return {
        users: await ids(tx, `SELECT id FROM tenant."user" ORDER BY id`),
        doors: (
          (
            await tx.query(
              `SELECT id, owner_kind, owner_account_id FROM tenant.identity_connection ORDER BY id`,
            )
          ).rows as unknown as Array<{
            id: string
            owner_kind: string
            owner_account_id: string | null
          }>
        ).map((r) => r),
      }
    })

    assert.deepEqual(
      seen.users,
      [ADMIN, MEI],
      'both live members of ACME — and `usr_globex_ruth` is NOT among them, which is the ' +
        'tenant boundary holding inside a widened policy.',
    )

    /* 🛑 THIS IS THE ASSERTION G449 WAS BLOCKED ON, AND IT IS WORTH SPELLING
       OUT WHY A LIST OF DOORS IS THE PRIZE RATHER THAN A LIST OF PEOPLE.
       `canGrant()` needs `target.orgClass`; `model/access.ts` is emphatic that
       it has exactly one source, `orgFor(connection.owner)` — *"never a
       membership and never the route"*. `owner_kind` and `owner_account_id`
       below ARE that input. Before `0018` this query returned zero rows in
       every scope, and G449's row records the tempting wrong answer:
       defaulting the target's org to `customer` on the strength of a
       membership, which is G289's trap in the target position. **The default
       is no longer tempting because the real value is now readable.** */
    assert.deepEqual(
      seen.doors,
      [{ id: DOOR, owner_kind: 'customer', owner_account_id: 'acc_acme' }],
      "the ACME door and only it — `orgFor()` can now derive a target's organisation, " +
        'which is the single fact G449 was blocked on. Globex\'s door is absent because ' +
        '`identity_connection_directory_rls` is derived from the person directory and ' +
        'cannot exceed it.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §3 · THE RECORD'S CAPABILITY IS READ. G507.
   * ---------------------------------------------------------------- */

  it('§3 · an act carrying a DIFFERENT capability opens nothing', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, { id: 'azg_dir_3', capability: CAPABILITIES.viewException, actor: ADMIN })
      return {
        users: (await tx.query(`SELECT id FROM tenant."user"`)).rowCount,
        doors: (await tx.query(`SELECT id FROM tenant.identity_connection`)).rowCount,
      }
    })

    /* 🛑 THE ASSERTION THAT MAKES THE SEAM'S UNCONDITIONAL `set_config`
       CORRECT. `writeAuthorisationRecord()` names the act's grant on EVERY
       operation — it takes no authority decision at all — and this is what
       makes that safe: a `listRuns` act names its own record, the policy reads
       `capability`, finds a read verb, and the directory stays shut. If this
       ever returns rows, the seam has become a decision-maker and G289's
       one-evaluator rule has been broken in the place hardest to see. */
    assert.equal(seen.users, 0, 'a `view_exception` act is not an administrative act')
    assert.equal(seen.doors, 0, 'and reads no door either')
  })

  /* ---------------------------------------------------------------- *
   * §4 · A NAME IS NOT A CLAIM.
   * ---------------------------------------------------------------- */

  it('§4 · naming a grant that does not exist opens nothing', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await tx.query('SELECT set_config($1, $2, true)', [
        'app.authorisation_ref',
        'azg_forged_0000000000000000000000',
      ])
      return (await tx.query(`SELECT id FROM tenant."user"`)).rowCount
    })

    /* 🛑 THIS IS THE ASSERTION THAT SEPARATES THIS DESIGN FROM A BARE FLAG,
       AND IT IS THE ONE TO KEEP IF ONLY ONE SURVIVES. `app.directory_reach =
       '1'` would be a claim the database must BELIEVE. A grant id is a name
       the database CHECKS. The honest bound is still the one `0018` states —
       this is exactly as strong as invariant 1's own fence, because a handler
       that could forge this GUC could forge `app.tenant_id` — but forging it
       ALONE, without also writing a record through `authorize()`, buys
       nothing at all. */
    assert.equal(seen, 0, 'a grant id with no row behind it is inert')
  })

  it('§4b · a grant minted in ANOTHER tenant does not open this one', async () => {
    const seen = await withTenantScope(pool, GLOBEX, async (tx) => {
      await actUnder(tx, {
        id: 'azg_dir_4b',
        capability: CAPABILITIES.manageRoles,
        actor: RUTH,
        tenant: GLOBEX,
      })
      return await ids(tx, `SELECT id FROM tenant."user" ORDER BY id`)
    })
    assert.deepEqual(
      seen,
      [RUTH],
      "Globex's administrator reads Globex's roster and nobody else's. The grant row is " +
        'itself narrowed by `authorization_grant_rls`, and the policy states the tenant ' +
        'term a second time — two independent narrowings, either sufficient.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §5 · LIVENESS, ON BOTH SIDES OF THE JOIN.
   * ---------------------------------------------------------------- */

  it('§5 · a target whose membership has LAPSED leaves the directory', async () => {
    await restore()
    /* EXPIRED, not revoked — `0005` added the `expires_at` term over B1's
       quoted `revoked_at`-only predicate *"in the safe direction"*, and `0018`
       inherits it. An expired membership is not a revoked one, and a directory
       that read only `revoked_at` would publish a lapsed partner-scoped member
       forever. **`0035` makes the trigger read it the same way**, which is why
       this lapse is now an authorised act — see `lapse()`. */
    await lapse(MEI, 'azg_dir_5_lapse')

    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, { id: 'azg_dir_5', capability: CAPABILITIES.manageRoles, actor: ADMIN })
      return await ids(tx, `SELECT id FROM tenant."user" ORDER BY id`)
    })
    assert.deepEqual(seen, [ADMIN], 'an expired membership is not a live one')
    await restore()
  })

  it('§5b · an ACTOR whose own membership has lapsed reads no directory at all', async () => {
    await restore()
    /* ⚠️ EXPIRY RATHER THAN REVOCATION, AND THE REASON IS THAT `0018` TREATS
       THE TWO IDENTICALLY FOR LIVENESS — **§5 above uses expiry on the TARGET
       and this uses it on the ACTOR.**

       🛑 THE JUSTIFICATION THAT STOOD HERE IS CORRECTED RATHER THAN DELETED,
       because it was the sentence that made defect 1 look deliberate. It read:
       *"Setting `revoked_at` here would fire
       `membership_revocation_voids_sessions`, whose guard 1b requires the
       transaction to carry a `manage_roles` record — so a fixture that REVOKES
       has to be an authorised act, which this section is not about. An expiry
       is 'a clock arriving and nobody's act' (`0009`), the trigger's `WHEN`
       does not match it."* **The second half was the defect**: a statement
       that writes a past `expires_at` is somebody's act, and `0019`'s `WHEN`
       not matching it made expiry a removal path with no guard at all. `0035`
       fires on liveness, so this fixture is an authorised act too — which is
       the sentence above turned into a fact rather than an exemption. */
    await lapse(ADMIN, 'azg_dir_5b_lapse')

    const seen = await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, { id: 'azg_dir_5b', capability: CAPABILITIES.manageRoles, actor: ADMIN })
      return (await tx.query(`SELECT id FROM tenant."user"`)).rowCount
    })

    /* 🛑 THIS TERM IS THE ONE THAT IS EASY TO LEAVE OUT, AND LEAVING IT OUT
       WOULD BE G399 IN THE DIRECTORY. The grant proves the evaluator said yes
       AT MINT TIME. A session binds while its membership is live and keeps
       acting after it lapses, because `session_selection_restrictive` is a
       `WITH CHECK` and re-proves nothing on a read. Without the actor's own
       membership term, a removed administrator would keep reading the roster
       of the tenant that removed them for as long as their session lived. */
    assert.equal(seen, 0, 'a removed administrator reads nobody, including themselves')
    await restore()
  })

  /* ---------------------------------------------------------------- *
   * §6 · THE MIRROR. `0002`'s "third place to drift", answered with a
   *      control rather than an argument — `0008`'s own answer.
   * ---------------------------------------------------------------- */

  it('§6 · the capability literal in the policy is a real member of `CAPABILITIES`', async () => {
    const c = await migratorClient()
    let expressions: readonly string[]
    try {
      expressions = (
        (
          await c.query(
            `SELECT coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr
               FROM pg_policies
              WHERE schemaname = 'tenant'
                AND policyname IN ('user_directory_rls', 'session_lapsed_member_rls')`,
          )
        ).rows as unknown as Array<{ expr: string }>
      ).map((r) => r.expr)
    } finally {
      await c.end()
    }

    assert.equal(expressions.length, 2, 'both gated policies are present in the catalogue')

    const known = new Set<string>(Object.values(CAPABILITIES))
    for (const expr of expressions) {
      const literals = [...expr.matchAll(/capability\s*=\s*'([a-z_]+)'/g)].map((m) => m[1] as string)
      assert.ok(literals.length > 0, 'the policy names a capability at all')
      for (const literal of literals) {
        /* 🛑 A POLICY EXPRESSION CANNOT IMPORT A TYPESCRIPT CONSTANT — `0008`'s
           own sentence — so the literal is a MIRROR and this is the mirror's
           check. The failure mode without it is the worst one available: a
           capability renamed in `model/` leaves this policy matching nothing,
           the directory closes, and everything merely LOOKS refused. Nothing
           throws, no test fails, and the feature is quietly dead. */
        assert.ok(
          known.has(literal),
          `the policy names \`${literal}\`, which is not in \`CAPABILITIES\`. A capability ` +
            'was renamed in `model/access.ts` and the policy was not. The directory is now ' +
            'permanently closed and FAILS SILENTLY — nothing throws.',
        )
      }
    }
  })

  it('§7 · no OTHER policy joins to `tenant."user"`, so nothing inherits the widening', async () => {
    /**
     * 🛑 THE EXEMPTION LIST IS THE POINT, NOT AN ESCAPE HATCH — G446's own
     *    sentence about the RLS census, and the same discipline here.
     *
     * EXACTLY ONE policy outside `tenant."user"` may read it, and it is the
     * one `0018` argues at length: `identity_connection_directory_rls`, whose
     * whole expression is `id IN (SELECT u.connection_id FROM tenant."user" u)`.
     * The inheritance is the MECHANISM there rather than an accident — the
     * door directory is DERIVED from the person directory precisely so that it
     * cannot exceed it, which is `0009`'s `platform_role_rls` shape.
     *
     * ⚠️ AND THE EXEMPTION IS CHECKED IN BOTH DIRECTIONS, because *"an
     *    exemption that exempts nothing is a licence waiting to be reused."*
     *    An entry that is no longer present is a FAILURE, and the entry must
     *    still be the derived-directory policy rather than something that
     *    inherited the name.
     */
    /*
     * ⚠️ AND A SECOND, 1 Oct 2026 — W5, G2627. `0321`'s
     *    `partner_invitation_no_escalation` reads `tenant."user"` for its
     *    NOT-SELF term: `lower(email) <> (SELECT lower(u.email) FROM
     *    tenant."user" u WHERE u.id = partner_invitation.invited_by)`. **IT
     *    CANNOT INHERIT A WIDENING, AND THAT IS ARGUED RATHER THAN HOPED:** it
     *    selects ONE row by primary key, `invited_by`, which the permissive
     *    policy beside it pins to the acting session's own user — a row
     *    `user_rls` already shows the actor in every scope. A wider directory
     *    adds rows the predicate never asks for; a NULL (the row unreadable)
     *    REFUSES, because a policy expression that is not TRUE is a refusal.
     *    `tests/db/partner-directory.test.ts` §3c drives the self-invitation red.
     */
    /*
     * ⚠️ AND A THIRD, 2 Oct 2026 — G2806, `0370`, THE OWNER'S REDEMPTION
     *    RULING. `partner_invitation_redemption_rls` reads `tenant."user"` for
     *    the address of the person THIS SIGN-IN SESSION belongs to. **IT CANNOT
     *    INHERIT A WIDENING EITHER, ON THE SAME ARGUMENT AS THE SECOND:** it
     *    joins ONE row — `u.id = s.user_id` for the session whose digest is
     *    `app.session_ref` — and a wider directory adds rows the join never
     *    asks for. It is also inert outside a sign-in transaction
     *    (`app.signin_ref`), where no directory receipt is ever written.
     *    `tests/db/partner-invitation-redemption.test.ts` §4/§4b drive the
     *    wrong-door and wrong-address reds.
     */
    const EXEMPT = new Set([
      'identity_connection.identity_connection_directory_rls',
      'partner_invitation.partner_invitation_no_escalation',
      'partner_invitation.partner_invitation_redemption_rls',
    ])

    const c = await migratorClient()
    let offenders: readonly string[]
    let exemptPresent: readonly string[]
    try {
      const rows = (
        await c.query(
          /* 🛑 STRING LITERALS ARE STRIPPED BEFORE THE MATCH, AND THAT IS A
             CORRECTION MADE AGAINST A FALSE POSITIVE RATHER THAN A WEAKENING.
             19 Sep 2026, G656: `db/migrations/0059`'s
             `resolution_proposal_insert_restrictive` carries
             `proposed_by_kind = 'user'::text` — a VALUE of `ProposalActor
             .kind`, not a relation — and this scan reported it as a policy
             reading `tenant."user"`, because `'` is not a word character so
             `\m"?user"?\M` matches inside a quoted literal.

             **That is §5.1 in the control itself: a rule keyed on a
             convenient landmark (the characters) instead of the property (a
             reference to the relation).** Stripping `'…'` runs removes the
             class and removes nothing else — a policy that genuinely reads
             the table names it as an identifier, which survives the strip.
             The exemption assertion below is what proves the strip did not
             hollow the scan out: `identity_connection_directory_rls` must
             still be found. */
          `SELECT tablename || '.' || policyname AS name,
                  coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr
             FROM pg_policies
            WHERE schemaname = 'tenant'
              AND tablename <> 'user'
              AND regexp_replace(
                    coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                    '''[^'']*''', '', 'g'
                  ) ~ '\\m"?user"?\\M'
            ORDER BY 1`,
        )
      ).rows as unknown as Array<{ name: string; expr: string }>

      offenders = rows.filter((r) => !EXEMPT.has(r.name)).map((r) => r.name)
      exemptPresent = rows.filter((r) => EXEMPT.has(r.name)).map((r) => r.name)
    } finally {
      await c.end()
    }

    assert.deepEqual(
      [...exemptPresent].sort(),
      [...EXEMPT].sort(),
      'an exemption in this list no longer exists. An exemption that exempts nothing is a ' +
        'licence waiting to be reused — delete the entry in the commit that deletes the policy.',
    )

    /* 🛑 `0018`'s (1) AS A RUNNABLE ASSERTION, AND IT IS READ FROM THE
       CATALOGUE RATHER THAN FROM THE FILES ON PURPOSE. Permissive policies are
       OR-ed, so `user_directory_rls` WIDENS what a `SELECT` on `tenant."user"`
       returns. That is intended for that table. It is NOT intended anywhere
       else — and a policy on a THIRD table whose expression reads
       `tenant."user"` would inherit the whole directory silently, because
       PostgreSQL applies row-level security to a table referenced inside a
       policy expression (`0005`'s measured fact, which `0009` then used
       deliberately for `platform_role_rls`). A `grep` over `db/migrations/`
       would answer for today; the catalogue answers for the tree that is
       actually applied, including anything an `ALTER POLICY` introduced. */
    assert.deepEqual(
      offenders,
      [],
      'a policy on another table now reads `tenant."user"` and has therefore inherited the ' +
        'administrative directory without arguing for it. Either narrow that expression or ' +
        'argue the widening where the policy is written — and amend this assertion, which ' +
        'exists to force that conversation rather than to be deleted.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §8 · THE SELECTION SCOPE STILL SEES ITS OWN PERSON WITHOUT A RECORD.
   * ---------------------------------------------------------------- */

  it('§9 · every `current_setting` in the new policies is `nullif`-guarded — G100', async () => {
    const c = await migratorClient()
    let rows: ReadonlyArray<{ name: string; expr: string }>
    try {
      rows = (
        await c.query(
          `SELECT policyname AS name, coalesce(qual, '') || ' ' || coalesce(with_check, '') AS expr
             FROM pg_policies
            WHERE schemaname = 'tenant'
              AND policyname IN ('user_directory_rls', 'identity_connection_directory_rls',
                                 'session_lapsed_member_rls')
            ORDER BY 1`,
        )
      ).rows as unknown as Array<{ name: string; expr: string }>
    } finally {
      await c.end()
    }
    assert.equal(rows.length, 3, 'all three new policies are in the catalogue')

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * 🛑 THIS IS A FORM ASSERTION AND NOT A BEHAVIOURAL ONE, WHICH IS §5.1's
     *    OWN SHAPE — A RULE KEYED ON THE TEXT RATHER THAN ON THE PROPERTY. IT
     *    IS HERE ANYWAY, AND THE REASON IS A MEASUREMENT.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Mutation testing this slice ran thirteen mutations against `0018` and
     * `0019`. **Twelve went red. The thirteenth — deleting EVERY
     * `nullif(…, '')` from `0018` — changed nothing observable**, and the
     * reason is worth more than the assertion:
     *
     *   · `nullif` matters only for a GUC that was SET AND REVERTED, which
     *     reads back as the EMPTY STRING rather than NULL. Without it the
     *     predicate becomes `tenant_id = ''`, which — in `0005`'s own words —
     *     *"denies BY ACCIDENT and only because no tenant id happens to be
     *     empty."*
     *   · And a behavioural witness is **unavailable here**, because the two
     *     tables these policies reach through — `tenant.membership` and
     *     `tenant.authorization_grant` — carry their OWN `nullif` in
     *     `membership_rls` and `authorization_grant_rls`, and those narrow
     *     the subqueries first. **So `0018`'s guards are genuinely redundant
     *     today, and that redundancy is the thing `0018`'s note (3) argues
     *     for: two independent statements of one property, either sufficient.**
     *
     * A redundancy that cannot be observed is a redundancy nothing protects.
     * This assertion is the protection, and it is honest about being a check
     * on the TEXT: it would not catch a predicate that was wrong in some other
     * way, and it exists only because the behavioural version is unreachable
     * while the inherited guards hold. **If `0005` or `0010` ever drops one,
     * the behavioural witness becomes available and belongs here instead.**
     */
    for (const { name, expr } of rows) {
      /* ⚠️ THE CATALOGUE NORMALISES, SO THIS READS `NULLIF(` IN UPPER CASE AND
         `'app.tenant_id'::text` WITH AN EXPLICIT CAST — neither is how the
         migration spells it. Matching the FILE's bytes would be checking that
         somebody typed a word; matching the CATALOGUE's is checking what
         PostgreSQL actually holds, which is the only thing that runs. The
         first draft of this assertion looked for a lower-case `nullif(` and
         went red against a correct tree. */
      const bare = [...expr.matchAll(/current_setting\('([a-z_.]+)'[^)]*\)/g)].filter((m) => {
        const at = m.index ?? 0
        return !/nullif\(\s*$/i.test(expr.slice(Math.max(0, at - 12), at))
      })
      assert.deepEqual(
        bare.map((m) => m[1]),
        [],
        `\`${name}\` reads a GUC without a \`nullif(…, '')\` guard. G100 is deny-on-NULL and ` +
          'a reverted GUC reads back as the EMPTY STRING, not NULL — so the predicate ' +
          'silently becomes `= \'\'`, which denies only because no id happens to be empty. ' +
          'This is the one mutation of thirteen that the behavioural assertions could not ' +
          'see; do not delete it without reading the note above.',
      )
    }
  })

  it('§8 · `user_rls` survives: sign-in reads the caller\'s own person with no grant', async () => {
    await restore()
    const seen = await withSelectionScope(pool, ADMIN_DIGEST, ACME, async (tx) =>
      ids(tx, `SELECT id FROM tenant."user" ORDER BY id`),
    )

    /* 🛑 THE DISJUNCT THAT MUST SURVIVE, AND THE CIRCULARITY IF IT DOES NOT.
       `resolveSubject()` reads the caller's own row on EVERY request, before
       any capability is known — there is no authorisation record yet, because
       minting one requires a principal, which requires this read. Gating this
       on `manage_roles` would make signing in require the capability that
       signing in produces, which is exactly the circularity
       `POST /context/resolve`'s G200 exemption names. If this assertion ever
       returns `[]`, `0009`'s `user_rls` has been dropped or narrowed and
       nobody can authenticate. */
    assert.deepEqual(seen, [ADMIN], 'the caller reads itself, with no authorisation record')
  })
})

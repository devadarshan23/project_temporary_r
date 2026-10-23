/**
 * WHAT AN ADMINISTRATOR CAN REACH, AND WHAT IT CANNOT — over a real
 * PostgreSQL. **G447, G448, G449, G450 — 19 Sep 2026.**
 *
 * ┌─ WHY THIS FILE EXISTS, AND IT IS NOT THE USUAL REASON ─────────────────────┐
 * │ Every other suite in `tests/db/` witnesses a control that was BUILT. This   │
 * │ one witnesses a WALL that blocked two owner rulings on the day they were    │
 * │ taken, so that the wall is a measured, runnable fact rather than a          │
 * │ paragraph in a slice report nobody re-runs.                                 │
 * │                                                                             │
 * │ Both rulings of 19 Sep 2026 require acting on ANOTHER PERSON:               │
 * │                                                                             │
 * │   · CAPABILITY GRANTING — `canGrant()` needs `target.orgClass`, and         │
 * │     `orgFor()` derives it from an `IdentityConnection`.                     │
 * │   · MEMBERSHIP REVOCATION VOIDING SESSIONS — the sessions to void are the   │
 * │     REMOVED PERSON's, not the administrator's.                              │
 * │                                                                             │
 * │ Neither is reachable, and §1 and §4 measure why: **the person-scoped        │
 * │ tables are visible and writable only to their own owner.** `tenant."user"`  │
 * │ and `tenant.identity_connection` are keyed on the acting session's own row  │
 * │ (`0009`), and `tenant.session` on the acting session's own digest           │
 * │ (`0005`). A tenant administrator can read and write exactly themselves.     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 THE FINDING THAT MATTERS MOST IS §4b, AND IT IS A SILENT ONE ───────────┐
 * │ `UPDATE tenant.session … WHERE user_id = <somebody else>` does not raise.   │
 * │ It reports **`rowCount = 0`** and commits. So the natural implementation of │
 * │ the second ruling — *revoke their sessions, then revoke the membership* —   │
 * │ would COMMIT THE MEMBERSHIP REVOCATION, REPORT SUCCESS, AND LEAVE EVERY     │
 * │ SESSION OF THE REMOVED PERSON LIVE, with no error anywhere. That is         │
 * │ `docs/HANDOFF.md` G399's defect reproduced by the fix intended to close it. │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 1  THE VISIBILITY CENSUS. An administrator in its own selection scope sees  │
 * │    ITSELF in `tenant."user"`, ITS OWN session, and EVERY membership in the  │
 * │    tenant — and no other person's user row at all.              G447        │
 * │ 1b Under a TENANT scope alone the person-scoped tables return ZERO rows,    │
 * │    including the caller's own: `app.session_ref` is unset, so `withTenant-  │
 * │    Scope()` — which every gated handler runs inside — cannot read a person. │
 * │ 2  `orgFor()`'s input is unreachable for anybody but the caller, which is   │
 * │    why `canGrant()` cannot be called on a served path.          G449        │
 * │ 3  THE ORDER IS LOAD-BEARING. Session-then-membership commits; membership-  │
 * │    then-session is REFUSED and rolls both back.                 G448        │
 * │ 4  An administrator CAN revoke another person's MEMBERSHIP (tenant-scoped)  │
 * │    and CANNOT revoke their SESSION (session-scoped) — 4b: silently.  G450   │
 * │ 5  A lapsed member's own session cannot be UPDATEd and CAN be DELETEd.      │
 * │    The restrictive policy gates `WITH CHECK` and therefore INSERT and       │
 * │    UPDATE; `DELETE` is gated by `USING`, which that policy does not state.  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THIS SUITE ASSERTS A LIMITATION, SO IT GOES RED WHEN THE LIMITATION IS
 *    LIFTED — WHICH IS THE POINT AND IS STATED SO NOBODY "FIXES" IT. The day an
 *    owner ruling opens a directory policy, §1, §2 and §4 fail. **That is the
 *    correct outcome**: the commit that widens administrative reach is the
 *    commit that must re-argue every assertion here, one by one, rather than
 *    discovering afterwards which of them it silently spent. It is the shape
 *    `tests/http/authorisation-record.test.ts` §8 used as a tripwire and
 *    `db/migrations/0017`'s row records being replaced *"by the positive
 *    assertion in the same commit"*.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THAT DAY IS 19 Sep 2026, AND THIS BANNER IS THE RE-ARGUMENT THE PARAGRAPH
 *    ABOVE DEMANDS. **G506 AND G508 — THE OWNER'S TWO RULINGS — ARE BUILT**,
 *    in `db/migrations/0018_administrative_directory.sql` and
 *    `0019_membership_revocation_voids_sessions.sql`.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * **THE HEADING ABOVE IS NOW HALF FALSE AND IS CORRECTED RATHER THAN
 * REWRITTEN**, because the wall it measures is the premise both rulings were
 * argued on and a reader must be able to see what changed. Section by section:
 *
 *   §1 · **STILL TRUE, AND NARROWER THAN IT READS.** A selection scope carries
 *        no authorisation record, so the directory is shut and the caller
 *        still sees exactly itself. What is no longer true is the GENERAL
 *        claim — the prose now says *"without an authorisation record"* where
 *        it used to say nothing, because the sentence was a statement about
 *        the schema and is now a statement about a transaction.
 *   §1b · **STILL EXACTLY TRUE AND IT IS THE LOAD-BEARING ONE.** `withTenant-
 *        Scope()` with no record reads ZERO people. G506 did not open the
 *        directory to every gated handler; it opened it to an act carrying an
 *        invariant 10 record for `manage_roles`, and `listRuns` carries one
 *        for `view_run`. **If this ever goes red, the directory has been
 *        widened to every authorised act, which nobody ruled.**
 *   §2  · **THE TITLE WENT FALSE AND THE ASSERTIONS DID NOT.** `orgFor()`'s
 *        input is reachable — `tests/db/administrative-directory.test.ts` §2
 *        reads `owner_kind` and `owner_account_id` for another person — but
 *        it is reachable only inside a `manage_roles` act, and this section
 *        is not one. **G449's blocker is CLOSED**; the refusal to default
 *        `target.orgClass` to `customer` is unchanged and is still the point.
 *   §3  · **REWRITTEN. G448's ORDERING CONSTRAINT IS DELIBERATELY GONE** and
 *        the old assertion said so in advance: *"If this now passes, `0005`'s
 *        restrictive policy has been amended and G448's ordering rule is no
 *        longer load-bearing — say so where the rule is stated, not only
 *        here."* It is said in `0019`'s header, in G448's own row, and below.
 *   §4  · **REWRITTEN.** An administrator can no longer revoke a membership
 *        at all outside an authorised act — guard 1b of `0019`'s trigger.
 *   §4b · **REWRITTEN, AND THIS IS THE ONE THE SLICE EXISTS FOR.** The silent
 *        `rowCount = 0` is gone.
 *   §5  · **REWRITTEN. THE WRONG CONTAINMENT IS CLOSED** — G510 revokes
 *        `DELETE` rather than adding a `USING`, for `0005`'s measured reason.
 *
 * ⚠️ WHAT NONE OF THIS CHANGES: **`tenant."user"` STILL HAS NO `tenant_id`
 *    COLUMN AND MUST NOT GAIN ONE.** A person belongs to several tenants; the
 *    membership is the join and G506 uses it. §1b is the assertion that keeps
 *    the widening honest.
 *
 * ⚠️ AND IT IS NOT A CLAIM THAT THE WALL IS RIGHT. It is a claim about what the
 *    tree does. Whether an administrator SHOULD reach another person is the
 *    owner's question and is what G449 and G450 put to them.
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
 * sharing one name race inside `applyMigrations()`.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_ADMIN_REACH_DB_NAME'] ?? runScopedName('reconcile_admin_reach_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const CONNECTION = 'idc_acme_entra'
const ADMIN = 'usr_acme_admin'
const MEI = 'usr_ops_mei'

/* Digests, not handles. `0005`'s policy compares `handle_digest`, and this
   suite never needs the pre-image — which is `tests/db/session-isolation.ts`'s
   own rule: *"a database dump containing handles would be a session-hijack
   kit."* */
const ADMIN_DIGEST = 'digest_admin_0f4c8b02d7e64a95b31067ce4a8d29f1'
const MEI_DIGEST = 'digest_mei_1f4c8b02d7e64a95b31067ce4a8d29f11'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* Top level, OUTSIDE every `describe`. `tests/ci/reachability-guards.test.ts`
   asserts this by AST walk, because a guard inside a skipped suite is never
   registered and `describe(…, {skip})` never invokes its callback. */
databaseRequiredUnderCi('the administrative reach suite', probe)

/**
 * Two people in one tenant, each with a live membership and a live bound
 * session. **The ADMIN is not special in the schema** — there is no admin flag
 * and no admin table; it is called that only because the rulings cast it in
 * that part. Whatever it can reach, any session in the tenant can reach.
 */
async function seed(): Promise<void> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_REACH',
               'acme-entra-reach', 'active')`,
      [CONNECTION],
    )
    for (const [id, name] of [
      [ADMIN, 'Acme Administrator'],
      [MEI, 'Mei Tan'],
    ] as const) {
      await client.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@acme.invalid', $2, 'active', $3)`,
        [id, name, CONNECTION],
      )
    }
    await client.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, 'rol_reach', 'Reach', 'reach', 1, 'operator', 'tenant', NULL, 'active')`,
      [ACME],
    )
    for (const [id, userId] of [
      ['mem_admin', ADMIN],
      ['mem_mei', MEI],
    ] as const) {
      await client.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, 'rol_reach', 'seed', now(), NULL, NULL)`,
        [ACME, id, userId],
      )
    }
    for (const [id, digest, userId] of [
      ['ses_admin', ADMIN_DIGEST, ADMIN],
      ['ses_mei', MEI_DIGEST, MEI],
    ] as const) {
      await client.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, 'acme.reach.invalid',
                 now(), now(), now() + interval '12 hours', NULL)`,
        [id, digest, userId, CONNECTION, ACME],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await client.end()
  }
}

/** Put the fixture back between the destructive sections. */
async function restore(): Promise<void> {
  const client = await migratorClient()
  try {
    await client.query(`UPDATE tenant.membership SET revoked_at = NULL`)
    await client.query(`UPDATE tenant.session SET revoked_at = NULL`)
    const present = await client.query(`SELECT id FROM tenant.session WHERE id = 'ses_mei'`)
    if (present.rowCount === 0) {
      await client.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ('ses_mei', $1, $2, $3, $4, 'acme.reach.invalid',
                 now(), now(), now() + interval '12 hours', NULL)`,
        [MEI_DIGEST, MEI, CONNECTION, ACME],
      )
    }
  } finally {
    await client.end()
  }
}

async function revokedAt(sessionId: string): Promise<string | null | 'absent'> {
  const client = await migratorClient()
  try {
    const r = await client.query(`SELECT revoked_at FROM tenant.session WHERE id = $1`, [sessionId])
    const row = (r.rows as unknown as Array<{ revoked_at: string | null }>)[0]
    return row === undefined ? 'absent' : row.revoked_at
  } finally {
    await client.end()
  }
}

/**
 * MINT THIS ACT'S INVARIANT 10 RECORD AND NAME IT — what
 * `writeAuthorisationRecord()` does, in the order it does it.
 *
 * ⚠️ THIS HELPER DID NOT EXIST BEFORE 19 Sep 2026 AND ITS ARRIVAL IS THE WHOLE
 *    SHAPE OF THE SLICE. Before G506 an administrative act was refused by the
 *    SCHEMA and there was nothing a caller could carry that would change the
 *    answer. Now there is exactly one thing, and it is a record that only
 *    `authorize()` can write — so the sections below that still use a bare
 *    scope are asserting the DEFAULT, and the ones that call this are
 *    asserting the WIDENING.
 */
async function actUnder(tx: ScopedClient, id: string): Promise<void> {
  await tx.query(
    `INSERT INTO tenant.authorization_grant
       (tenant_id, id, subject_user_id, org_class, partner_id, capability,
        resource_class, resource_type, resource_id, solution_id, issued_at, expires_at)
     VALUES ($1, $2, $3, 'customer', NULL, $4,
             'authority', 'Membership', NULL, NULL, now(), now() + interval '5 minutes')`,
    [ACME, id, ADMIN, CAPABILITIES.manageRoles],
  )
  await tx.query('SELECT set_config($1, $2, true)', ['app.authorisation_ref', id])
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

describe('administrative reach, over a real PostgreSQL', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /* `max: 1`, so every statement in this file runs on ONE pooled backend and
       a GUC left behind by one transaction would be visible to the next. G101
       says `SET LOCAL` prevents that; a pool of one is what makes the claim
       falsifiable rather than untested. */
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool?.end()
  })

  /* ---------------------------------------------------------------- *
   * §1 · THE VISIBILITY CENSUS. G447.
   * ---------------------------------------------------------------- */

  it('§1 · in its own selection scope a session sees ITSELF, and no other person', async () => {
    const seen = await withSelectionScope(pool, ADMIN_DIGEST, ACME, async (tx) => ({
      users: (
        (await tx.query(`SELECT id FROM tenant."user" ORDER BY id`))
          .rows as unknown as Array<{ id: string }>
      ).map((r) => r.id),
      sessions: (
        (await tx.query(`SELECT id FROM tenant.session ORDER BY id`))
          .rows as unknown as Array<{ id: string }>
      ).map((r) => r.id),
      connections: (
        (await tx.query(`SELECT id FROM tenant.identity_connection ORDER BY id`))
          .rows as unknown as Array<{ id: string }>
      ).map((r) => r.id),
      memberships: (
        (await tx.query(`SELECT id FROM tenant.membership ORDER BY id`))
          .rows as unknown as Array<{ id: string }>
      ).map((r) => r.id),
    }))

    /* ⚠️ THE MESSAGE BELOW READ *"If this now lists a second, a directory
       policy has been opened and G449 has been answered: re-argue every
       assertion in this file rather than updating this one."* **That happened
       — G506, `db/migrations/0018` — and the re-argument is the banner at the
       top of this file.** The assertion survives unchanged because a SELECTION
       SCOPE carries no authorisation record, so `user_directory_rls`'s first
       `EXISTS` is empty and only `user_rls` admits anything. What changed is
       the SCOPE OF THE CLAIM: this is now a fact about a transaction that
       names no act, not a fact about the schema. */
    assert.deepEqual(
      seen.users,
      [ADMIN],
      'A session with no authorisation record sees exactly one person — itself. The directory ' +
        'G506 opened requires an invariant 10 record for `manage_roles`, and a selection ' +
        'scope has none.',
    )
    assert.deepEqual(seen.sessions, ['ses_admin'], '`session_rls` is keyed on the handle digest.')
    assert.deepEqual(
      seen.connections,
      [CONNECTION],
      'A session sees exactly the door it came through — its own — because ' +
        '`identity_connection_rls` selects on `session.connection_id`.',
    )
    /* 🛑 THE ASYMMETRY IS THE WHOLE FINDING: memberships ARE tenant-scoped, so
       the roster of WHO BELONGS is fully readable while WHO THEY ARE is not. */
    assert.deepEqual(
      seen.memberships,
      ['mem_admin', 'mem_mei'],
      'Memberships are tenant-scoped and both are visible — so the tenant knows WHO BELONGS ' +
        'and cannot read WHO THEY ARE. That asymmetry is why membership revocation is ' +
        'buildable and capability granting is not.',
    )
  })

  it('§1b · under a TENANT scope alone the person-scoped tables return ZERO rows', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => ({
      users: (await tx.query(`SELECT id FROM tenant."user"`)).rowCount,
      sessions: (await tx.query(`SELECT id FROM tenant.session`)).rowCount,
      connections: (await tx.query(`SELECT id FROM tenant.identity_connection`)).rowCount,
    }))

    /* 🛑 THIS IS THE ARM THAT DECIDES THE RULINGS, because `withTenantScope()`
       is the transaction EVERY GATED HANDLER RUNS INSIDE —
       `server/data-plane/authorisation-record.ts` opens it and hands the body a
       `tx` and no pool, deliberately: *"a body therefore has no way to reach
       tenant data except through the transaction the mint opened."* So a
       handler cannot read a person AT ALL, not even the caller's own. */
    assert.equal(seen.users, 0, 'no person is readable without `app.session_ref`')
    assert.equal(seen.sessions, 0, 'no session is readable without `app.session_ref`')
    assert.equal(
      seen.connections,
      0,
      'no door is readable without `app.session_ref` — and this is the arm that blocks ' +
        'capability granting, because it is the scope every gated handler runs in.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §2 · WHAT `canGrant()` NEEDS, AND WHERE IT IS STILL UNREACHABLE. G449.
   *
   * 🛑 THIS SECTION WAS TITLED *"the input `orgFor()` needs about ANOTHER
   *    person does not exist IN ANY SCOPE"* AND THAT IS NOW FALSE. It is
   *    corrected rather than deleted because it is the sentence G449 was
   *    argued on. **G506 gives it a producer** — `tests/db/administrative-
   *    directory.test.ts` §2 reads another person's `owner_kind` and
   *    `owner_account_id` — and the producer is reachable ONLY inside an act
   *    carrying an invariant 10 record for `manage_roles`.
   *    **The two scopes below are not such acts, so every assertion stands
   *    unchanged**, and the third one — the tempting wrong answer — is the
   *    reason the whole section survives rather than being deleted.
   * ---------------------------------------------------------------- */

  it('§2 · `orgFor()`\'s input is unreachable in a scope that names no act', async () => {
    /* `canGrant(granter, target)` requires `target.orgClass`, and
       `model/access.ts` is emphatic that it has exactly one source:
       `orgFor(connection.owner)` — *"never a membership and never the route"*.
       Reaching another person's connection needs their `user` row first. */
    const inSelection = await withSelectionScope(pool, ADMIN_DIGEST, ACME, async (tx) =>
      (await tx.query(`SELECT connection_id FROM tenant."user" WHERE id = $1`, [MEI])).rowCount,
    )
    const inTenant = await withTenantScope(pool, ACME, async (tx) =>
      (await tx.query(`SELECT connection_id FROM tenant."user" WHERE id = $1`, [MEI])).rowCount,
    )

    assert.equal(
      inSelection,
      0,
      "another person's connection is unreadable in a selection scope — which carries no " +
        'authorisation record, so `user_directory_rls` admits nothing',
    )
    assert.equal(
      inTenant,
      0,
      "another person's connection is unreadable in a BARE tenant scope. 🛑 THIS IS THE " +
        'ASSERTION THAT KEEPS G506 A WIDENING RATHER THAN A DELETION: the directory opens ' +
        'for a `manage_roles` act and NOT for every gated handler, and `listRuns` runs in ' +
        'exactly this scope.',
    )

    /* 🛑 AND THE DANGEROUS REPAIR IS NAMED HERE SO IT IS REFUSED IN WRITING.
       Defaulting `target.orgClass` to `'customer'` because the person has a
       membership is G289's own trap in the TARGET position: *"a membership
       proves nothing about organisation"*, and `Membership.partnerScope` exists
       precisely because partner-scoped memberships do. The absence measured
       above is a REFUSAL to invent, not a gap to paper. */
    const membershipProvesNothing = await withTenantScope(pool, ACME, async (tx) =>
      (await tx.query(`SELECT user_id FROM tenant.membership WHERE user_id = $1`, [MEI])).rowCount,
    )
    assert.equal(
      membershipProvesNothing,
      1,
      "the membership IS readable — which is exactly the tempting wrong answer, because it " +
        'carries no organisation and never has.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §3 · THE ORDER WAS LOAD-BEARING AND IS NOT ANY MORE. G448, AMENDED BY
   *      G508 IN THE COMMIT THAT BUILT THE OWNER'S SECOND RULING.
   *
   * 🛑 THE OLD ASSERTION PREDICTED THIS EXACT COMMIT AND SAID WHAT TO DO:
   *    *"If this now passes, `0005`'s restrictive policy has been amended and
   *    G448's ordering rule is no longer load-bearing — say so where the rule
   *    is stated, not only here."* It has been amended —
   *    `db/migrations/0019` `ALTER POLICY`s it — and it is said in that file's
   *    header, in G448's own row, and here.
   *
   * WHY THE AMENDMENT WAS FORCED RATHER THAN CHOSEN: **a trigger on membership
   * revocation runs in the REFUSED order, necessarily and by construction.**
   * It fires AFTER the membership write, so the session write it makes is
   * exactly arm B. G448's refusal made the owner's ruling unimplementable.
   *
   * WHAT SURVIVES, AND IT IS THE WHOLE OF WHAT THE REFUSAL PROTECTED: a
   * session may still not be BOUND to a tenant whose membership has lapsed.
   * `0019`'s new disjunct requires `revoked_at IS NOT NULL` — the row must end
   * up DEAD — and `resolveSubject()` refuses `session_revoked` by name before
   * it reads `session.tenantId` at all, so the tenant a revoked session names
   * is never read by anything. Arm B below now asserts the NEW fact, and §5
   * asserts that the LIVE write is still refused.
   * ---------------------------------------------------------------- */

  it('§3 · both orders now commit INSIDE an authorised act, and the trigger does the work', async () => {
    const granter = await migratorClient()
    try {
      /* Still granted HERE and still not by a migration. `0005` forbids *"a
         write privilege ahead of a writer"* and there is STILL no writer:
         nothing in `server/` revokes a membership, and `0019` deliberately
         adds no `GRANT`. Derive it:
         `grep -c 'GRANT UPDATE.*membership' db/migrations/*.sql` → 0. */
      await granter.query(`GRANT UPDATE (revoked_at) ON tenant.membership TO tenant_rw`)
    } finally {
      await granter.end()
    }

    /* ARM B — the order the ruling's own sentence suggests, and the order a
       trigger is forced into. It used to be REFUSED. */
    await restore()
    const arm_b = await attempt(() =>
      withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, 'azg_reach_3b')
        await tx.query(
          `UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
          [MEI],
        )
      }),
    )
    assert.equal(
      arm_b,
      null,
      'membership-then-session now COMMITS. This assertion was `assert.match(…, ' +
        '/session_selection_restrictive/)` until 19 Sep 2026 and the refusal it demanded is ' +
        'deliberately gone — G508 could not be built without removing it.',
    )
    assert.notEqual(
      await revokedAt('ses_mei'),
      null,
      "and the removed person's session is revoked — by the TRIGGER, which no caller asked " +
        "for and no caller can skip. That is the owner's ruling: the two acts cannot be " +
        'separated by any caller.',
    )

    /* ARM A — the order that always worked, still works, and is now REDUNDANT
       rather than required. A caller that revokes the session first finds the
       trigger has nothing left to void, which guard 2 reports as 0 expected
       and 0 voided — agreeing, correctly, about an empty set. */
    await restore()
    const arm_a = await attempt(() =>
      withTenantScope(pool, ACME, async (tx) => {
        await actUnder(tx, 'azg_reach_3a')
        await tx.query(
          `UPDATE tenant.session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
          [MEI],
        )
        await tx.query(
          `UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
          [MEI],
        )
      }),
    )
    assert.equal(arm_a, null, 'session-then-membership still commits')
    assert.notEqual(await revokedAt('ses_mei'), null)
  })

  /* ---------------------------------------------------------------- *
   * §4 · AN ADMINISTRATOR REACHES A MEMBERSHIP — AND ONLY INSIDE AN
   *      AUTHORISED ACT. G450, CLOSED BY G508.
   * ---------------------------------------------------------------- */

  it("§4 · revoking another person's membership OUTSIDE an authorised act is REFUSED", async () => {
    await restore()
    const err = await attempt(() =>
      withSelectionScope(pool, ADMIN_DIGEST, ACME, async (tx) =>
        tx.query(
          `UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
          [MEI],
        ),
      ),
    )

    /* 🛑 THIS ASSERTION USED TO READ `rowCount === 1` AND IS REVERSED, WHICH IS
       THE SHARPEST SINGLE CHANGE IN THE SLICE. `membership_rls` is still
       tenant-scoped and the row is still writable as far as row-level security
       is concerned — **what refuses now is `0019`'s trigger, at guard 1b**,
       because this transaction carries no `manage_roles` record and the
       trigger would therefore be unable to SEE the sessions it must void.
       Letting it through was the defect: `expected` 0, `voided` 0, the two
       agree, and a person is reported removed while every session stays live.
       **That is G450 surviving inside the fix for G450, and this suite is
       where it was caught — by being run beside the new one.** */
    assert.match(
      err ?? '',
      /carries no manage_roles authorisation record/,
      'a membership revocation outside an authorised act is refused LOUDLY rather than ' +
        'committing and voiding nothing',
    )
    assert.equal(
      await revokedAt('ses_mei'),
      null,
      'and nothing was written at all — the refusal rolls the whole transaction back',
    )
  })

  it('§4b · …and inside one, their session dies with it — the SILENT rowCount 0 is gone', async () => {
    await restore()
    await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, 'azg_reach_4b')
      await tx.query(
        `UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [MEI],
      )
    })

    /* 🛑 THE WHOLE OF G450, INVERTED. This section read *"NOT AN ERROR. NOT A
       POLICY VIOLATION. ZERO ROWS AND A COMMIT"* and asserted
       `revokedAt('ses_mei') === null` — **the session still live after an
       administrator tried to end it.** The old text is preserved in the banner
       at the top of this file and in G450's row, because it is the measurement
       both rulings were argued on. */
    assert.notEqual(
      await revokedAt('ses_mei'),
      null,
      "the removed person's session is revoked. The naive implementation reported success " +
        'and did nothing; this one cannot, because no caller performs the second write — the ' +
        'trigger does, and it RAISES rather than voiding a set it cannot see.',
    )
  })

  /* ---------------------------------------------------------------- *
   * §5 · THE WRONG CONTAINMENT IS CLOSED. G510.
   * ---------------------------------------------------------------- */

  it('§5 · a LAPSED member can now revoke their own session; an ABSENT one still cannot, and neither can DELETE', async () => {
    await restore()
    await withTenantScope(pool, ACME, async (tx) => {
      await actUnder(tx, 'azg_reach_5')
      await tx.query(`UPDATE tenant.membership SET revoked_at = now() WHERE user_id = $1`, [MEI])
    })
    /* The trigger has already revoked Mei's session, so put a LIVE one back.
       The state G399 describes is a session that OUTLIVED its membership, and
       reaching it now requires manufacturing it as the migrator — which is
       itself the measure of what `0019` changed: the state no longer arises
       on its own. */
    const put = await migratorClient()
    try {
      await put.query(`UPDATE tenant.session SET revoked_at = NULL WHERE id = 'ses_mei'`)
    } finally {
      await put.end()
    }

    const update = await attempt(() =>
      withSelectionScope(pool, MEI_DIGEST, ACME, async (tx) =>
        tx.query(`UPDATE tenant.session SET revoked_at = now() WHERE revoked_at IS NULL`),
      ),
    )

    /* ═══════════════════════════════════════════════════════════════════
       🛑 THIS ASSERTION WAS WRITTEN EXPECTING A REFUSAL AND WENT RED, AND
          THE RED IS A BETTER OUTCOME THAN THE GREEN WOULD HAVE BEEN. IT IS
          RECORDED RATHER THAN QUIETLY FLIPPED.
       ═══════════════════════════════════════════════════════════════════

       It demanded `/new row violates row-level security policy/` and the
       statement COMMITTED. **`0019` closes G399's LAPSED arm as a side
       effect, and the slice that wrote it did not intend to.**

       Why it works: the amended restrictive `WITH CHECK` admits
       `revoked_at IS NOT NULL AND EXISTS (a membership, live or not)`. A
       lapsed member still HAS a membership row — `0005` retains rather than
       deletes — so the disjunct is satisfied and the write lands. G399's
       complaint is *"the revocation works for every session that does not
       matter and fails for every session that does"*, and this is that arm.

       And it is SAFE for the same reason the disjunct is safe anywhere: the
       row must end up DEAD. `UPDATE … SET revoked_at = now(), tenant_id =
       'ten_victim'` fails, because the `EXISTS` is evaluated against
       `session.tenant_id` — the NEW value — and there is no membership of
       any kind in a tenant the person never belonged to.

       ⚠️ **THE THIRD ARM IS STILL OPEN AND IT IS THE ONE §12b IS.** See
       below: a person with NO membership row at all is still refused. */
    assert.equal(
      update,
      null,
      'a LAPSED member can now revoke their own session — G399\'s middle arm, closed as a ' +
        'consequence of `0019` rather than by intent. The old assertion here demanded a ' +
        'refusal.',
    )
    assert.notEqual(await revokedAt('ses_mei'), null, 'and the session really is dead')

    /* ---- THE ARM THAT IS STILL OPEN, AND IT IS `browser-login` §12b ---- */
    const wipe = await migratorClient()
    try {
      /* NO membership row at all — not lapsed, ABSENT. That is the state the
         browser suite's fixture is in: it seeds no membership, which is why
         §12b's witness is the third case rather than the second, and why
         giving that seed a membership would move it into the case that
         already worked. */
      await wipe.query(`DELETE FROM tenant.membership WHERE user_id = $1`, [MEI])
      await wipe.query(`UPDATE tenant.session SET revoked_at = NULL WHERE id = 'ses_mei'`)
    } finally {
      await wipe.end()
    }

    const absent = await attempt(() =>
      withSelectionScope(pool, MEI_DIGEST, ACME, async (tx) =>
        tx.query(`UPDATE tenant.session SET revoked_at = now() WHERE revoked_at IS NULL`),
      ),
    )
    assert.match(
      absent ?? '',
      /session_selection_restrictive/,
      'a session whose owner has NEVER been a member of the tenant it is bound to STILL ' +
        'cannot be revoked. 🛑 THIS IS WHY `tests/e2e/browser-login.test.ts` §12b STAYS ' +
        '`todo`: `0019` prevents the state ARISING — revoking a membership now takes the ' +
        'sessions with it — and it repairs the LAPSED case, and it does NOT reach a session ' +
        'that never had a membership behind it. Closing that one needs a ruling about a ' +
        'session bound to a tenant nobody ever admitted the person to, which is a different ' +
        'question and nobody has asked it.',
    )

    /* 🛑 AND IT CAN NO LONGER BE DESTROYED, WHICH IS THE HALF THAT MOVED.
       This assertion read `removed === 1` and `revokedAt === 'absent'` — the
       same row the UPDATE could not touch was DELETABLE, taking the
       `revoked_at` evidence with it. `0005` measured that the obvious repair,
       a `USING` on the restrictive policy, would also gate `SELECT` and make a
       session unreadable until its membership was re-proved on every request.
       **So G510 removes the PRIVILEGE instead**: nothing deletes a session,
       and `0005`'s `GRANT … DELETE` had never had a writer. */
    const removed = await attempt(() =>
      withSelectionScope(pool, MEI_DIGEST, ACME, async (tx) =>
        tx.query(`DELETE FROM tenant.session`),
      ),
    )
    assert.match(
      removed ?? '',
      /permission denied for table session/,
      'the evidence-destroying containment is gone, and it is gone by PRIVILEGE rather than ' +
        'by policy — the cheapest place to check it and the hardest to amend by accident.',
    )
    assert.notEqual(await revokedAt('ses_mei'), 'absent', 'and the row is still there to be read')
  })
})

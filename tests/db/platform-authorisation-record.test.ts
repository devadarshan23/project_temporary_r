/**
 * INVARIANT 10's SECOND HOME, AND THE POLICY THAT MAKES IT A RECORD RATHER
 * THAN A ROW NOBODY CAN READ — G730, 19 Sep 2026, over
 * `db/migrations/0091_platform_authorisation_record.sql`.
 *
 * `tests/db/authorisation-record.test.ts` is the shape this file copies, one
 * scope axis over, and its header is the one to read first. What is NOT copied
 * is the SCOPE: that file narrows on `app.tenant_id`; this one narrows on
 * `app.session_ref`, because the act it records has no tenant.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS FILE PROVES, AND WHAT IT DELIBERATELY DOES NOT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It proves that a tenant-less act CAN NOW BE RECORDED — which is the whole of
 * G728's finding, closed — and seven properties of the table it is recorded in:
 * that a record is visible to the session that wrote it, invisible to another
 * person's session, invisible outside any scope at all, invisible from a
 * TENANT scope (and the tenant home invisible from a session scope, which is
 * the two-homes claim in both directions), refused when its subject disagrees
 * with the transaction's, refused when there is no scope at all, and
 * **unamendable and undeletable by the role a request path runs as.**
 *
 * 🛑 IT PROVES NOTHING ABOUT `authorisedHandler()`'s PLATFORM ARM OVER HTTP,
 * AND THE REASON IS NOT LAZINESS. No gated console operation is mounted, and
 * none can be: `capability.openapi.yaml` declares no verb that reaches
 * `substrate`, `catalogue` or `commercial`, so `decide()` refuses every
 * platform principal at the GATE before a handler runs, and the 26
 * `platform-role` operations sit on a tier G602 measures as all-or-nothing.
 * **This file exercises every piece the seam composes — `authorize()`,
 * `writePlatformAuthorisationRecord()` and `withSessionScope()` — and not the
 * Fastify wrapper around them.** `tests/http/authorisation-record.test.ts`
 * §2d carries the boot half.
 *
 * It proves NOTHING about whether a console operation is served, because none
 * is mounted: `TIER_REQUIRES_CAPABILITY.administration` is `false` and G602
 * measures why the 59 operations are all-or-nothing. **That is the honest
 * boundary of this slice** — the table, the type and the writer exist and are
 * witnessed; the mount waits on the contract split.
 *
 * ⚠️ EVERY GRANT IN THIS FILE COMES FROM `authorize()` AND NONE IS BUILT BY
 * HAND, for the reason the tenant-home file states: *"`authorize()` mints an
 * `AuthorizationGrant` and nothing else does"* is the invariant's first
 * clause, and a fixture that assembled the object literally would be a second
 * minting path living in `tests/`.
 *
 * ⚠️ NEVER SKIPS UNDER CI. `databaseRequiredUnderCi()` at the top level.
 *
 * ⚠️ MUTATIONS RUN ARE RECORDED AT THE FOOT OF THE FILE.
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
  DENY_ALL,
  ORG_CLASSES,
  authorize,
  type PlatformAuthorizationGrant,
  type PlatformRole,
  type PlatformRoleAssignment,
  type PrincipalContext,
} from '../../model/access.ts'
import type { TenantId, Timestamp, UserId } from '../../model/kernel.ts'
import {
  mintAuthorizationGrantId,
  writePlatformAuthorisationRecord,
} from '../../server/data-plane/authorisation-record.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — the named flake
 * `tests/db/tenant-projection.test.ts` documents at length. The contended
 * resource is the shared cluster, not this file.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PLATFORM_AUTHORISATION_DB_NAME'] ??
  runScopedName('reconcile_platform_authorisation_test')

const ACME = 'ten_acme' as TenantId
const GLOBEX = 'ten_globex' as TenantId

/** Two PLATFORM staff. Neither has a tenant and neither has a membership. */
const MEI = 'usr_ops_mei' as UserId
const RAJ = 'usr_ops_raj' as UserId

/** Their sessions, on a console host, with `tenant_id` NULL. G726/G727. */
const DIGEST_MEI = 'dig_console_mei'
const DIGEST_RAJ = 'dig_console_raj'
const CONSOLE_HOST = 'console.reconcileai.app'
const DOOR = 'idc_platform_entra'

const NOW = '2026-09-19T12:00:00.000Z' as Timestamp

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the platform authorisation record test', probe)

/**
 * A CONSOLE PRINCIPAL — no tenant, no memberships, no `RoleAssignment`.
 *
 * ⚠️ `tenantId: null` AND `held: null` TOGETHER, AND BOTH ARE G728's. `held`
 * is not `[]` because *"a `RoleAssignment` is a tenant-scoped row … writing
 * `[]` here would assert a fact about a person on the strength of a query
 * nobody issued."* `decide()` never reads it on this path — the platform arm
 * returns first — and putting the honest value in is what keeps this fixture
 * a console session rather than a customer with an empty roster.
 *
 * ⚠️ THE CASTS ARE NAMED, because a cast of shape is not a check of content.
 * `PlatformRole` and `PlatformRoleAssignment` carry fields the platform arm
 * never reads; the cast asserts the shape the evaluator reads and nothing
 * about the rest. What is NOT cast is the grant this produces — that comes
 * back from `authorize()` fully typed, which is the point.
 */
function consolePrincipal(userId: UserId): PrincipalContext {
  const role = {
    id: 'pro_fleet_reader',
    label: 'Fleet Reader',
    key: 'fleet_reader',
    version: 2,
    stakeholderClass: 'platform_operator',
    capabilities: [CAPABILITIES.viewSubstrate],
    status: 'active',
  } as unknown as PlatformRole

  const assignment = {
    id: `pra_${userId}`,
    userId,
    roleId: 'pro_fleet_reader',
    /** MATCHES `role.version`. A moved pin refuses, for a reason unrelated to this file. */
    roleVersion: 2,
    grantedBy: 'usr_ops_root',
    grantedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    revokedAt: null,
  } as unknown as PlatformRoleAssignment

  return {
    subject: { userId, status: 'active' },
    tenantId: null,
    orgClass: ORG_CLASSES.platform,
    partnerId: null,
    partnerGrant: null,
    held: null,
    platformHeld: [{ role, assignment }],
    now: NOW,
  }
}

/**
 * One minted PLATFORM grant, or a hard failure naming the refusal.
 *
 * 🛑 THE `home` ASSERTION IS THE ANTI-VACUOUS HALF OF EVERY SECTION BELOW. A
 * mint that came back with the TENANT home would make every scope assertion
 * in this file a statement about the wrong table, and the narrowing is also
 * what lets the return type be the platform one.
 */
function mint(userId: UserId, resourceId: string | null): PlatformAuthorizationGrant {
  const out = authorize(consolePrincipal(userId), CAPABILITIES.viewSubstrate, {
    id: mintAuthorizationGrantId(),
    resource: {
      resourceClass: 'substrate',
      resourceType: 'ServingHost',
      resourceId,
      solutionId: null,
    },
    ttlSeconds: 300,
  })
  assert.ok(
    out.grant !== null,
    `\`authorize()\` refused the fixture principal — \`${out.decision.reason}\`. G728 ` +
      'recorded this function refusing every tenant-less principal at ' +
      '`principal_holds_no_tenant`; G730 is what ended that, and if this is red again the ' +
      'ruling has been reverted rather than a fixture broken.',
  )
  assert.equal(
    out.grant.home,
    'platform',
    'a principal with no tenant minted a grant in the TENANT home. Every assertion below ' +
      'reads `tenant.platform_authorization_grant`, so all of them would be asking about a ' +
      'table this act never touched.',
  )
  return out.grant
}

/** What the session named by `digest` can see in the platform home. */
async function rowsUnder(
  pool: TenantPool,
  digest: string,
): Promise<Array<Record<string, unknown>>> {
  return withSessionScope(
    pool,
    digest,
    async (tx) =>
      (
        await tx.query(
          'SELECT subject_user_id, id, org_class, partner_id, capability, resource_class,' +
            ' resource_type, resource_id, solution_id, issued_at, expires_at' +
            ' FROM tenant.platform_authorization_grant ORDER BY id',
        )
      ).rows as Array<Record<string, unknown>>,
  )
}

/**
 * THE FIXTURE ROWS THE POLICY NEEDS, AND NOTHING ELSE.
 *
 * 🛑 THE SESSIONS ARE WRITTEN BY THE MIGRATOR AND THE RECORDS ARE NOT. A
 * migrator write of the records would satisfy every assertion below with the
 * policy doing nothing — `reconcile_migrator` is `BYPASSRLS`. The two session
 * rows are fixture; the two authorisation rows go through the same function
 * and the same privilege a request path has.
 *
 * ⚠️ NO MEMBERSHIP IS SEEDED AND THAT IS THE FIXTURE BEING HONEST RATHER THAN
 * THIN. A console session is bound to no tenant, so there is no membership it
 * could imply — `selectTenantForSession()` has never run for these rows and
 * `session_selection_restrictive`'s `tenant_id IS NULL` arm is what admits
 * them. Seeding one would be forging a state the model cannot produce, which
 * is the opposite error to the one that bit two slices today.
 */
async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Platform Entra', 'platform', NULL, NULL,
               'https://cognito.invalid/platform', 'platform-entra', 'active')
       ON CONFLICT DO NOTHING`,
      [DOOR],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'mei@1cloudhub.invalid', 'Mei Tan',   'active', $3),
              ($2, 'raj@1cloudhub.invalid', 'Raj Patel', 'active', $3)
       ON CONFLICT DO NOTHING`,
      [MEI, RAJ, DOOR],
    )
    for (const [userId, digest] of [
      [MEI, DIGEST_MEI],
      [RAJ, DIGEST_RAJ],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ('ses_' || $1, $2, $1, $3, NULL, $4,
                 now(), now(), now() + interval '12 hours', NULL)
         ON CONFLICT DO NOTHING`,
        [userId, digest, DOOR, CONSOLE_HOST],
      )
    }
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('invariant 10 has a second home, keyed on the acting session', { skip }, () => {
  let pool: TenantPool
  let meiGrant: PlatformAuthorizationGrant
  let rajGrant: PlatformAuthorizationGrant

  before(async () => {
    await resetSchema()
    /* The two tenants exist so §1f can hold a TENANT scope open against this
     * table and find nothing. Neither console session belongs to either. */
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /**
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE, exactly as in the tenant-home
     * file: every scope below is forced onto the connection the previous one
     * released, which is the condition under which a session-level `SET`
     * would leak between them.
     */
    pool = await createAppPool(1)

    meiGrant = mint(MEI, 'shs_console')
    rajGrant = mint(RAJ, null)

    await withSessionScope(pool, DIGEST_MEI, (tx) =>
      writePlatformAuthorisationRecord(tx, meiGrant),
    )
    await withSessionScope(pool, DIGEST_RAJ, (tx) =>
      writePlatformAuthorisationRecord(tx, rajGrant),
    )
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  /* ================================================================ *
   * §0 · THE FINDING G728 REPORTED, CLOSED.
   * ================================================================ */

  it('0 · a tenant-less act mints a record, and it lands in the platform home', () => {
    /**
     * 🛑 THIS IS THE ASSERTION `tests/model/console-principal.test.ts` §3 USED
     * TO CARRY WITH THE OPPOSITE SIGN, and the two files are deliberately not
     * the same claim: that one is about `authorize()`, this one is about the
     * row. G728's own sentence was *"`authorize()` REFUSES A TENANT-LESS
     * PRINCIPAL IT HAS JUST ALLOWED … invariant 10 has nowhere to put the
     * record of a tenant-less act."* It has somewhere now.
     */
    assert.equal(meiGrant.home, 'platform')
    assert.equal(meiGrant.subjectUserId, MEI)
    assert.equal(meiGrant.orgClass, ORG_CLASSES.platform)
    assert.equal(
      meiGrant.scope,
      DENY_ALL,
      '`decide()`\'s platform arm returns `DENY_ALL` on an ALLOW, deliberately — "a platform ' +
        'allow is a VERB and never a DIMENSION". A grant pinning anything wider would be ' +
        'invariant 8 undone by the scope field instead of by the boolean.',
    )
    assert.ok(
      !Object.prototype.hasOwnProperty.call(meiGrant, 'tenantId'),
      'the platform home carries a `tenantId`. G728 refused a nullable one at this function ' +
        'because "under G100\'s deny-on-NULL such a row is visible to no scope"; a second ' +
        'type with no tenant field at all is what makes that unrepresentable rather than ' +
        'merely unwritten.',
    )
  })

  /* ================================================================ *
   * §1 · THE SCOPE.
   * ================================================================ */

  it('1a · a record written under a session is readable under that session, with its fields', async () => {
    const rows = await rowsUnder(pool, DIGEST_MEI)
    assert.equal(rows.length, 1, `Mei's session sees ${rows.length} record(s); it wrote one`)
    const row = rows[0] as Record<string, unknown>

    assert.equal(row['id'], meiGrant.id)
    assert.equal(row['subject_user_id'], MEI)
    assert.equal(row['capability'], CAPABILITIES.viewSubstrate)
    assert.equal(
      row['resource_class'],
      'substrate',
      'the stored class must be the one `CAPABILITY_RESOURCE_CLASS` gave at MINT time. It is ' +
        'DENORMALISED deliberately — "an auditor reading a March grant needs March\'s ' +
        'classification".',
    )
    assert.equal(row['resource_type'], 'ServingHost')
    assert.equal(row['resource_id'], 'shs_console')
    assert.equal(row['org_class'], ORG_CLASSES.platform)
    assert.equal(row['partner_id'], null)
    assert.equal(row['solution_id'], null)
    assert.ok(row['issued_at'] instanceof Date, '`issued_at` did not round-trip as a timestamp')
    assert.ok(
      (row['expires_at'] as Date).getTime() > (row['issued_at'] as Date).getTime(),
      '`expires_at` is not after `issued_at`. "An open-ended grant is not a grant", and one ' +
        'that expired before it was issued is not a grant either.',
    )
  })

  it('1b · a NULL `resource_id` is stored as a null — the non-instance-bound act', async () => {
    const rows = await rowsUnder(pool, DIGEST_RAJ)
    assert.equal(rows.length, 1)
    assert.equal(
      (rows[0] as Record<string, unknown>)['resource_id'],
      null,
      'opening a list is `ResourceRef.resourceId`\'s own example of an act that is genuinely ' +
        'not instance-bound. Storing a placeholder would invent an instance nobody acted on.',
    )
  })

  it('1c · one console session cannot see the other\'s record', async () => {
    const mei = await rowsUnder(pool, DIGEST_MEI)
    const raj = await rowsUnder(pool, DIGEST_RAJ)
    assert.deepEqual(mei.map((r) => r['id']), [meiGrant.id])
    assert.deepEqual(raj.map((r) => r['id']), [rajGrant.id])
  })

  it('1d · NEGATIVE CONTROL — with RLS DISABLED the same read returns BOTH', async () => {
    /**
     * 🛑 WITHOUT THIS, §1c PROVES NOTHING. A read that returns one person's
     * rows is indistinguishable from a read that would have returned one
     * person's rows anyway, and only turning the policy off can tell them
     * apart. `tests/db/authorisation-record.test.ts` §1d carries the same
     * control on the tenant axis, and `db/migrations/0091` cites this
     * assertion by name.
     */
    const mig = await migratorClient()
    try {
      await mig.query(
        'ALTER TABLE tenant.platform_authorization_grant DISABLE ROW LEVEL SECURITY',
      )
      const leaked = await rowsUnder(pool, DIGEST_MEI)
      assert.deepEqual(
        [...new Set(leaked.map((r) => String(r['subject_user_id'])))].sort(),
        [MEI, RAJ].sort(),
        'with row-level security DISABLED the read did NOT leak both subjects — so §1c\'s ' +
          'single-subject result was never evidence about the policy.',
      )
    } finally {
      await mig
        .query('ALTER TABLE tenant.platform_authorization_grant ENABLE ROW LEVEL SECURITY')
        .catch(() => undefined)
      await mig.end()
    }

    /* And back to narrowing, in the same test, so a failure above cannot leave
     * a disabled policy behind for every assertion that runs after it. */
    assert.deepEqual((await rowsUnder(pool, DIGEST_MEI)).map((r) => r['id']), [meiGrant.id])
  })

  it('1e · outside any scope the read returns ZERO — G100, deny on NULL', async () => {
    /**
     * A transaction with no `set_config('app.session_ref', …)` at all. The GUC
     * is unset, `nullif(current_setting(…, true), '')` is NULL, the subquery
     * returns no row, `subject_user_id = NULL` is NULL, and NULL is not TRUE.
     * **A forgotten scope yields an empty result set, never somebody else's
     * record of who did what.**
     */
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const out = await client.query('SELECT id FROM tenant.platform_authorization_grant')
      await client.query('COMMIT')
      assert.equal(
        out.rows.length,
        0,
        `an unscoped read returned ${out.rows.length} platform authorisation record(s).`,
      )
    } finally {
      client.release()
    }
  })

  it('1f · THE TWO HOMES DO NOT SEE EACH OTHER, AND THAT IS THE RULING IN BOTH DIRECTIONS', async () => {
    /**
     * 🛑 THE OWNER'S SENTENCE IS *"each home has a scope that can actually
     * read it"*, and the half nobody would think to check is the other one:
     * a TENANT scope must not reach the platform home either. If it did, the
     * two tables would be one table with extra steps, and the argument for
     * the second one — that a tenant predicate denies unconditionally for a
     * console act — would be false.
     */
    const fromTenant = await withTenantScope(
      pool,
      ACME,
      async (tx) =>
        (await tx.query('SELECT id FROM tenant.platform_authorization_grant')).rows,
    )
    assert.deepEqual(
      fromTenant,
      [],
      'a TENANT scope read the PLATFORM home. The policy compares `subject_user_id` against ' +
        'the user of the session in `app.session_ref`, which a tenant scope does not set — ' +
        'so this returning rows means the policy is not the one `0091` wrote.',
    )

    const fromSession = await withSessionScope(
      pool,
      DIGEST_MEI,
      async (tx) => (await tx.query('SELECT id FROM tenant.authorization_grant')).rows,
    )
    assert.deepEqual(
      fromSession,
      [],
      'a SESSION scope read the TENANT home. `authorization_grant_rls` keys on ' +
        '`app.tenant_id`, which `withSessionScope()` deliberately never sets — "a session ' +
        'read that opened a tenant scope would hand every caller of the cheaper helper a ' +
        'tenant scope derived from a row it had not yet validated."',
    )
  })

  /* ================================================================ *
   * §2 · APPEND-ONLY, AS A PRIVILEGE RATHER THAN A CONVENTION.
   * ================================================================ */

  it('2a · the app role cannot UPDATE a record it wrote', async () => {
    await assert.rejects(
      () =>
        withSessionScope(pool, DIGEST_MEI, (tx) =>
          tx.query(
            'UPDATE tenant.platform_authorization_grant SET capability = $1 WHERE id = $2',
            [CAPABILITIES.publishCatalogue, meiGrant.id],
          ),
        ),
      (err: unknown) => /permission denied/i.test(String(err)),
      'THE REQUEST PATH CAN AMEND ITS OWN AUDIT TRAIL. `db/migrations/0091` grants `SELECT, ' +
        'INSERT` and nothing else for exactly this. A record that can be edited after the ' +
        'act is a record of whatever was most convenient afterwards.',
    )
  })

  it('2b · the app role cannot DELETE one either', async () => {
    await assert.rejects(
      () =>
        withSessionScope(pool, DIGEST_MEI, (tx) =>
          tx.query('DELETE FROM tenant.platform_authorization_grant WHERE id = $1', [
            meiGrant.id,
          ]),
        ),
      (err: unknown) => /permission denied/i.test(String(err)),
      'the request path can erase a record of an act. Append-only is the whole claim.',
    )
  })

  /* ================================================================ *
   * §3 · THE `WITH CHECK`, WHICH THIS COMMIT OWES BECAUSE IT GRANTS A WRITE.
   * ================================================================ */

  it('3 · a record whose subject disagrees with the transaction is REFUSED, not written', async () => {
    /**
     * 🛑 THIS IS THE ASSERTION THE POLICY EXISTS FOR AND IT IS NOT A
     * HYPOTHETICAL SHAPE. The minting seam takes `subject_user_id` from the
     * GRANT and the scope from the SESSION; if those two ever came apart, a
     * console session could deposit a row attributing its own act to another
     * staff member, and every assertion in §1 would still pass. The `WITH
     * CHECK` is what requires them to be the same fact.
     *
     * `0009_identity_substrate.sql` names the shape of this obligation: *"the
     * commit that grants a write here owes the `WITH CHECK` in the same commit
     * as the writer."*
     */
    const notMine = mint(RAJ, 'shs_console')
    await assert.rejects(
      () =>
        withSessionScope(pool, DIGEST_MEI, (tx) =>
          writePlatformAuthorisationRecord(tx, notMine),
        ),
      (err: unknown) => /row-level security|violates/i.test(String(err)),
      'A GRANT MINTED FOR RAJ WAS WRITTEN INSIDE MEI\'S SESSION. That is an audit row that ' +
        'reads as evidence and is not.',
    )

    /* And nothing landed. A refused INSERT that left a row would be worse than
     * one that succeeded, because it would be invisible to the assertion above. */
    assert.deepEqual((await rowsUnder(pool, DIGEST_MEI)).map((r) => r['id']), [meiGrant.id])
  })

  it('3b · THE PARENT\'s WRITE HALF, ISOLATED — §3 alone does not test it', async () => {
    /**
     * 🛑 MEASURED, NOT ASSUMED, AND §3 WAS PASSING FOR THE WRONG REASON
     * UNTIL THIS WAS ADDED. Mutating the PARENT policy to
     * `WITH CHECK (true)` leaves §3 GREEN: `writePlatformAuthorisationRecord()`
     * writes the parent row and then the `via` rows, the CHILD policy still
     * refuses the via line, the transaction rolls back, and
     * `assert.rejects` sees a row-level-security error it did not cause.
     * **§3 proves the SEAM refuses; only this proves the PARENT POLICY
     * does.** §5.6, caught by running the mutation instead of predicting it.
     *
     * ⚠️ A RAW `INSERT` RATHER THAN THE WRITER, DELIBERATELY, AND IT IS THE
     * ONE PLACE IN THIS FILE THAT BUILDS A ROW BY HAND. Going through
     * `authorize()` cannot produce a parent row with no via lines —
     * `decide()`'s platform arm only allows when an assignment CARRIED the
     * verb, so `via` is never empty on this arm — and the child policy would
     * mask the parent every time. The row below is not a grant and is not
     * treated as one: nothing reads it, and the assertion is that it never
     * exists.
     */
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT set_config($1, $2, true)', ['app.session_ref', DIGEST_MEI])
      await assert.rejects(
        () =>
          client.query(
            `INSERT INTO tenant.platform_authorization_grant
               (subject_user_id, id, org_class, capability, resource_class, resource_type,
                issued_at, expires_at)
             VALUES ($1, 'azg_not_mine', 'platform', $2, 'substrate', 'ServingHost',
                     now(), now() + interval '5 minutes')`,
            [RAJ, CAPABILITIES.viewSubstrate],
          ),
        (err: unknown) => /row-level security|violates/i.test(String(err)),
        'MEI\'s SESSION WROTE A RECORD NAMING RAJ AS THE SUBJECT. The `WITH CHECK` is what ' +
          'requires the row\'s subject and the transaction\'s session to be the same fact; ' +
          'without it a console session can deposit an audit row attributing its own act ' +
          'to another staff member.',
      )
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  /* ================================================================ *
   * §4 · WHAT HAPPENS WITH NO SESSION SCOPE AT ALL — G100 ON THE WRITE.
   * ================================================================ */

  it('4 · a write with no session scope is REFUSED by the policy, not silently dropped', async () => {
    /**
     * 🛑 `server/data-plane/session.ts`'s `actingSessionOf()` throws before
     * this can happen on a served path, and its own docblock says why this
     * assertion exists anyway: a throw there would make the policy's write
     * half unreachable and untestable. **The database is the control; the
     * throw is the message.**
     */
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await assert.rejects(
        () =>
          client.query(
            `INSERT INTO tenant.platform_authorization_grant
               (subject_user_id, id, org_class, capability, resource_class, resource_type,
                issued_at, expires_at)
             VALUES ($1, 'azg_unscoped', 'platform', $2, 'substrate', 'ServingHost',
                     now(), now() + interval '5 minutes')`,
            [MEI, CAPABILITIES.viewSubstrate],
          ),
        (err: unknown) => /row-level security|violates/i.test(String(err)),
        'a record was written with NO session scope. Under G100 the `WITH CHECK` compares ' +
          'against NULL and must refuse — a row nobody could ever read is exactly the ' +
          'outcome G728 refused a nullable tenant column to avoid.',
      )
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  /* ================================================================ *
   * §5 · `via` — THE FIELD G301 NAMES BY NAME, ON THE PLATFORM ARM.
   * ================================================================ */

  it('5 · the via lines name the PLATFORM assignment, the role and the pinned version', async () => {
    const rows = await withSessionScope(
      pool,
      DIGEST_MEI,
      async (tx) =>
        (
          await tx.query(
            'SELECT seq, assignment_id, role_id, role_version' +
              ' FROM tenant.platform_authorization_grant_via WHERE grant_id = $1 ORDER BY seq',
            [meiGrant.id],
          )
        ).rows as Array<Record<string, unknown>>,
    )
    assert.equal(
      rows.length,
      1,
      'the grant carries one `via` entry and the table holds a different number. `decide()` ' +
        'fills `via` from the assignments that CARRIED the verb, and on this arm every ' +
        'entry is a `PlatformRoleAssignmentId` — a different brand over a different table, ' +
        'which is why `0091` writes no foreign key.',
    )
    const via = rows[0] as Record<string, unknown>
    assert.equal(via['seq'], 0)
    assert.equal(via['assignment_id'], `pra_${MEI}`)
    assert.equal(via['role_id'], 'pro_fleet_reader')
    assert.equal(
      via['role_version'],
      2,
      'the stored version must be the one that DECIDED, not the one the role carries today.',
    )
  })

  it('5b · the via lines are session-scoped too, and invisible from the other session', async () => {
    const fromRaj = await withSessionScope(
      pool,
      DIGEST_RAJ,
      async (tx) =>
        (
          await tx.query(
            'SELECT grant_id FROM tenant.platform_authorization_grant_via WHERE grant_id = $1',
            [meiGrant.id],
          )
        ).rows,
    )
    assert.deepEqual(
      fromRaj,
      [],
      'the child table is narrowed by its OWN `subject_user_id` rather than by a join to the ' +
        'parent — `0009`\'s decision for `role_capability` — and the composite foreign key ' +
        'is what stops the two narrowings from ever disagreeing.',
    )
  })
})

/* ==================================================================== *
 * MUTATIONS RUN, AND WHAT EACH CAUGHT
 * --------------------------------------------------------------------
 * WITNESSED RED FIRST, against the tree with `db/migrations/0091` removed:
 *
 *     ✖ invariant 10 has a second home, keyed on the acting session
 *       error: relation "tenant.platform_authorization_grant" does not exist
 *       code: '42P01'  — fail 0 / cancelled 14, from the `before` hook
 *
 * Then, with the migration back, 15 pass / 0 fail. Every mutation below was
 * applied to the LAST WRITER of the thing it mutates — which for both
 * policies is this migration, since `0091` creates them and nothing has
 * `ALTER POLICY`-ed them since.
 *
 *   M1  🛑 **A SURVIVOR, AND IT IS THE MOST USEFUL RESULT IN THIS BLOCK.**
 *       `WITH CHECK (…)` DELETED from `platform_authorization_grant_rls`.
 *       → **15 pass, 0 fail.** PostgreSQL uses a permissive policy's `USING`
 *          expression as its check when no `WITH CHECK` is given, so deleting
 *          it changes nothing observable. **The explicit clause is defensive,
 *          not load-bearing today** — which is exactly the reason
 *          `0005_session_and_membership.sql` gives for stating it anyway:
 *          *"so that a later `FOR SELECT`/`FOR ALL` edit cannot silently drop
 *          the write half."* Recorded rather than explained away: no
 *          assertion in this file can distinguish the two, and none should
 *          pretend to.
 *
 *   M1b `WITH CHECK (true)` — the mutation that ISOLATES the write half,
 *       reached only because M1 survived.
 *       → 2 red: §3b and §4. **§3 STAYED GREEN**, and that is the finding
 *          §3b exists for: `writePlatformAuthorisationRecord()` writes the
 *          parent and then the `via` rows, the CHILD policy refuses the via
 *          line, the transaction rolls back, and `assert.rejects` sees a
 *          row-level-security error it did not cause. **§3 proves the SEAM
 *          refuses; only §3b proves the PARENT POLICY does.** §3b was ADDED
 *          in response to this run — it did not exist when the mutation was
 *          first applied.
 *
 *   M2  the parent policy's predicate replaced by `USING (true)`.
 *       → 7 red: §1a, §1b, §1c, §1d, §1e, §1f and §3. §1d is the
 *          interesting one: the NEGATIVE CONTROL goes red under a mutation to
 *          the thing it is a control FOR, because its final re-narrowing
 *          assertion no longer narrows. §3b and §4 stay green, correctly —
 *          the `WITH CHECK` is untouched by this mutation.
 *
 *   M3  `GRANT SELECT, INSERT, UPDATE, DELETE` in place of `SELECT, INSERT`.
 *       → 4 red: §2a and §2b as predicted, **plus §3 and §5, which were
 *          not.** §2a's UPDATE and §2b's DELETE now SUCCEED, so the fixture
 *          row is amended and then erased and the two later sections are
 *          reading a table the earlier ones mutated. Order dependence between
 *          `it()` blocks, recorded rather than tidied: the extra reds are
 *          real failures of a real property (the row is gone), not noise.
 *
 *   M4  `writePlatformAuthorisationRecord()`'s parent `INSERT` taking the
 *       subject from the SCOPE — a subselect on `app.session_ref` — instead
 *       of from `grant.subjectUserId`. The change the function's own docblock
 *       warns against by name.
 *       → First attempt dropped `$1` and produced a BIND-ARITY error in the
 *          `before` hook, so the whole suite cancelled. That is a caught
 *          mutation and a useless one, and it is recorded so the second
 *          attempt is not read as the first.
 *
 *   M4b the same mutation, arity-preserved (`AND $1::text IS NOT NULL` keeps
 *       the parameter bound and ignored).
 *       → 🛑 **A SURVIVOR: 15 pass, 0 fail.** Nothing in this file — or
 *          anywhere — observes it, and the reason is structural rather than
 *          a missing assertion: **the policy requires the row's subject and
 *          the session's user to be EQUAL, so on every row that can exist the
 *          two sources give the same value.** §3 still rejects, because the
 *          `via` write keeps using `grant.subjectUserId` and disagrees with
 *          the mutant parent. The docblock's claim — *"passing the scope's
 *          value would make the `WITH CHECK` compare a value against itself
 *          and assert nothing"* — is therefore **an argument and not a
 *          witnessed control**, and the docblock says so rather than
 *          overstating it. A test that pretended otherwise would be §5.6.
 * ==================================================================== */

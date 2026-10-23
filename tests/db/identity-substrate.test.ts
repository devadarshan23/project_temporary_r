/**
 * THE IDENTITY SUBSTRATE, AND THE `WHERE` THAT WAS DELETED TO MAKE IT MEAN
 * ANYTHING — G299, 19 Sep 2026, over `db/migrations/0009_identity_substrate.sql`
 * and `server/data-plane/identity.ts`.
 *
 * `tests/db/session-isolation.test.ts` is the shape this file copies and its
 * header is the one to read first: the recording pool, the `max: 1` adversarial
 * pool, and the two negative controls. What is NOT copied is the SUBJECT. That
 * file is about which SESSION rows a caller can see. This one is about the
 * three rows a session RESOLVES INTO, and about the four arms that were
 * unenforced until it could.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 §1 IS THE WITNESSED RED AND IT IS THE REASON THIS FILE EXISTS. READ IT
 *    BEFORE THE REST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `server/data-plane/session.ts` enforced two of `resolveSubject()`'s seven
 * arms in the `WHERE` of one statement and four not at all:
 *
 *     WHERE revoked_at IS NULL
 *       AND expires_at > now()
 *
 * and said so on its own face — *"FOUR ARMS ARE UNENFORCED: a DISABLED PERSON
 * and a DISABLED DIRECTORY both reach this plane today."* **§1 runs that exact
 * predicate against a fixture whose person is disabled and whose directory is
 * disabled, and requires it to RETURN THE ROW.** The red is not a thing that
 * happened once in somebody's terminal; it is an assertion that stays in the
 * suite, so the defect cannot be re-introduced without the file that documents
 * it going green in the wrong direction.
 *
 * ⚠️ AND THAT IS WHY IT IS A `deletedPredicate()` HELPER RATHER THAN A COMMENT.
 * `docs/HANDOFF.md` §5.6: a control whose behaviour is never observed is not a
 * control. The mirror holds — a DELETION whose effect is never observed is not
 * a fix.
 *
 * ⚠️ §6 IS NEW ON 19 Sep 2026 AND COVERS A SECOND MIGRATION —
 * `db/migrations/0011_federated_connection.sql`, G304/G305, the broker handle.
 * It is here rather than in a file of its own because it is about the SAME
 * THREE ROWS: a broker handle is a column on `tenant.identity_connection`, it
 * is read by the same `readSubjectRows()`, and its refusal sits in the same
 * `SUBSTRATE_REFUSALS`. A separate suite would have had to re-seed this
 * fixture to say anything.
 *
 * 🛑 AND IT CARRIES TWO **ALLOW** ARMS, NOT ONE, BECAUSE G305's RULE IS TWO
 * DIRECTIONS: §6a is a brokered door resolving and §6c is an unbrokered one
 * resolving. A section that witnessed only refusals would be §5.6 — *a control
 * whose only observable behaviour is refusal* — in a file whose whole subject
 * is that defect.
 *
 * ⚠️ THE APP ROLE HOLDS `SELECT` AND NOTHING ELSE on all eight tables, which is
 * 0009's grant decision, so every fixture here is written as the MIGRATOR.
 * `server/dev/seed.ts` states the general form of that argument: seeding needs
 * the `BYPASSRLS` role *"and that is the policy working, not an
 * inconvenience."*
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
  DECISION_REASONS,
  SESSION_REFUSALS,
  decide,
  resolveSubject,
  type ResolvedSubject,
} from '../../model/access.ts'

/**
 * ⚠️ THE NARROWING, IN ONE PLACE — G727. `ResolvedSubject` is a union since
 * the console surface landed, and its CONSOLE arm carries no `tenantId` at
 * all, so `subject.tenantId` is a compile error without this. It THROWS rather
 * than returning `null` because every caller below resolved on a tenant host
 * and a console arm arriving here would mean `resolveSubject()` had ignored
 * its `surface` parameter — a fact about the model, not about the fixture,
 * and one a test must not paper over with a fallback.
 */
function tenantOf(subject: ResolvedSubject): TenantId {
  if (subject.surface !== 'tenant') {
    throw new Error(
      'resolveSubject() returned a CONSOLE subject for a fixture that passed ' +
        "surface: 'tenant'. The surface term is not being read.",
    )
  }
  return subject.tenantId
}
import type { Session } from '../../model/domain.ts'
import type { TenantId, Timestamp, UserId } from '../../model/kernel.ts'
import {
  SUBSTRATE_REFUSALS,
  readHeldAssignments,
  readSubjectRows,
} from '../../server/data-plane/identity.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — the named flake
 * `tests/db/tenant-projection.test.ts` documents at length. `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, so this placement
 * is sufficient and is the only one that is.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_IDENTITY_DB_NAME'] ?? runScopedName('reconcile_identity_test')

const ACME = 'ten_acme' as TenantId
const GLOBEX = 'ten_globex' as TenantId
const NOW = '2026-09-19T12:00:00.000Z' as Timestamp

/** Active person, active door, one live assignment carrying `admit_source`. */
const MEI = 'usr_ops_mei' as UserId
/** Same door, `status = 'disabled'`. Arm five of `resolveSubject()`. */
const RAJ = 'usr_ops_raj' as UserId
/** Active person behind a DISABLED door. Arm six. */
const LEE = 'usr_ops_lee' as UserId
/** A person in GLOBEX. The cross-tenant fixture. */
const ANA = 'usr_ops_ana' as UserId
/** A session naming a user id with NO ROW. `user_absent`. */
const GHOST = 'usr_never_created' as UserId

const DOOR_LIVE = 'idc_acme_entra'
const DOOR_DEAD = 'idc_acme_legacy'
const DOOR_PARTNER = 'idc_partner_northwind'
const DOOR_BROKEN = 'idc_broken_owner'
/** `cognito_pool` — the one protocol `PROTOCOL_IS_BROKERED` says is NOT brokered. */
const DOOR_POOL = 'idc_acme_pool'

/**
 * ONE POOL FRONTING EVERY BROKERED DOOR IN THIS FIXTURE — G304.
 *
 * ⚠️ SHARED ON PURPOSE. If each fixture had its own issuer, `broker_ref` would
 * be incidentally unique and §6e would pass whether or not the uniqueness
 * index existed. One issuer is the state in which the reference is the only
 * thing separating two doors, which is exactly the state G304 is about.
 */
const BROKER_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'

/**
 * ⚠️ EVERY DIGEST IS A PLACEHOLDER OF THE RIGHT SHAPE — 64 hex characters, an
 * HMAC-SHA256 output — and is not a real one, which is the rule
 * `tests/db/session-membership-selection.test.ts` states: a fixture carrying a
 * readable handle would be the first place a preimage got written down.
 */
const DIGEST: Readonly<Record<string, string>> = {
  [MEI]: '11a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f708',
  [RAJ]: '33c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2',
  [LEE]: '44d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3',
  [ANA]: '22b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819',
  [GHOST]: '66f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5',
}

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the identity substrate test', probe)

/* ------------------------------------------------------------------ *
 * 🛑 THE DELETED PREDICATE, KEPT VERBATIM SO THE RED CAN BE RE-RUN FOREVER.
 *
 * This is `LIVE_SESSION_READ` as `server/data-plane/session.ts` carried it
 * before G299, copied byte for byte from the commit that deleted it. It is not
 * imported, because the thing being asserted is that it NO LONGER EXISTS in
 * the serving path — an import would resurrect it.
 * ------------------------------------------------------------------ */

const DELETED_PREDICATE = `
  SELECT id, handle_digest, user_id, connection_id, tenant_id, issued_host,
         authenticated_at, last_used_at, expires_at
    FROM tenant.session
   WHERE revoked_at IS NULL
     AND expires_at > now()
`

async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES
         ($1, 'oidc', 'Acme Entra ID',   'customer', NULL,            'acc_acme',  $5, 'acme-entra',  'active'),
         ($2, 'saml', 'Acme Legacy ADFS','customer', NULL,            'acc_acme',  $5, 'acme-adfs',   'disabled'),
         ($3, 'oidc', 'Northwind',       'partner',  'prt_northwind', NULL,        $5, 'northwind',   'active'),
         -- A ROW THAT NAMES NO ORGANISATION: owner_kind partner with a NULL
         -- partner id. 0009 declines a CHECK constraint for 0002's enum reason,
         -- so this row is WRITABLE -- and the reader refuses it rather than
         -- defaulting, which is the whole of G289's priced shortcut.
         --
         -- ⚠️ ITS BROKER HANDLE IS COHERENT, DELIBERATELY. 0011 adds a SECOND
         -- way a connection row can be malformed, and a fixture that was wrong
         -- in both ways at once could not tell the two refusals apart -- the
         -- ordering inside identityConnectionFrom() would decide which name
         -- came back, and §2d would be asserting the order rather than the
         -- rule. Exactly one defect per fixture.
         ($4, 'oidc', 'Misconfigured',   'partner',  NULL,            NULL,        $5, 'misconfigured','active'),
         -- THE UNBROKERED ARM. cognito_pool is the managed fallback pool
         -- itself, so PROTOCOL_IS_BROKERED says false and BOTH handle
         -- columns must be NULL. This row is the ALLOW arm of the second
         -- direction of G305's rule; §6c is the refusal beside it.
         ($6, 'cognito_pool', 'Acme fallback pool', 'customer', NULL, 'acc_acme', NULL, NULL, 'active')
       ON CONFLICT DO NOTHING`,
      [DOOR_LIVE, DOOR_DEAD, DOOR_PARTNER, DOOR_BROKEN, BROKER_ISSUER, DOOR_POOL],
    )

    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES
         ($1, 'mei@acme.invalid', 'Mei Tan',   'active',   $5),
         ($2, 'raj@acme.invalid', 'Raj Patel', 'disabled', $5),
         ($3, 'lee@acme.invalid', 'Lee Ng',    'active',   $6),
         ($4, 'ana@globex.invalid','Ana Diaz', 'active',   $5)
       ON CONFLICT DO NOTHING`,
      [MEI, RAJ, LEE, ANA, DOOR_LIVE, DOOR_DEAD],
    )

    for (const [userId, connectionId, tenantId] of [
      [MEI, DOOR_LIVE, ACME],
      [RAJ, DOOR_LIVE, ACME],
      [LEE, DOOR_DEAD, ACME],
      [ANA, DOOR_LIVE, GLOBEX],
      [GHOST, DOOR_LIVE, ACME],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ('ses_' || $1, $2, $1, $3, $4, 'acme.invalid',
                 now(), now(), now() + interval '12 hours', NULL)
         ON CONFLICT DO NOTHING`,
        [userId, DIGEST[userId], connectionId, tenantId],
      )
    }

    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES
         ($1, 'rol_ap_approver',  'AP Approver', 'approver', 3, 'operator', 'pack', 'pck_ap', 'active'),
         ($1, 'rol_archived',     'Retired',     'retired',  1, 'operator', 'pack', 'pck_ap', 'archived'),
         ($2, 'rol_globex_approver','GX Approver','approver',1, 'operator', 'pack', 'pck_ap', 'active')
       ON CONFLICT DO NOTHING`,
      [ACME, GLOBEX],
    )

    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
       VALUES
         ($1, 'rol_ap_approver',   $3),
         ($1, 'rol_archived',      $3),
         ($2, 'rol_globex_approver', $3)
       ON CONFLICT DO NOTHING`,
      [ACME, GLOBEX, CAPABILITIES.admitSource],
    )

    /* ⚠️ FIVE ASSIGNMENTS FOR ONE PERSON, FOUR OF THEM DEAD IN A DIFFERENT WAY,
     * AND EVERY ONE OF THEM IS RETURNED BY THE READER. `decide()` is what
     * refuses them, by name and separately. A reader that filtered on liveness
     * would make four of these five fixtures unreachable — which is the defect
     * §1 preserves, arriving one table over.
     *
     * ⚠️ **`ras_expired` IS PINNED TO `NOW` AND NOT TO `now()`, AND IT READ
     * `now() - interval '2 days', now() - interval '1 day'` UNTIL 21 Sep 2026,
     * WHEN §4 WENT RED ON A CLOCK. G1209.**
     *
     * 🛑 THE FIXTURE USED THE DATABASE'S WALL CLOCK AND THE ASSERTION USES A
     * FROZEN ONE. `NOW` is `2026-09-19T12:00:00Z`, so `now() - interval
     * '1 day'` was BEFORE it for exactly two days and AFTER it from
     * `2026-09-20T12:00Z` — at which point the "expired" assignment became
     * LIVE relative to the clock `decide()` is handed, and §4 failed with
     * *"ras_expired was ALLOWED and must not have been"*. **`decide()` was
     * right every time; the fixture and the assertion were reading two
     * different clocks.**
     *
     * 🛑 THE REPAIR IS ONE CLOCK AND NOT A BIGGER INTERVAL. Widening to
     * `interval '400 days'` buys a year and rebuilds the same bomb with a
     * longer fuse; deriving the two timestamps from `NOW` itself makes the
     * drift UNREPRESENTABLE. §5.1: the old row keyed on a convenient landmark
     * — the database's clock, which was to hand — instead of on the property,
     * *expired as the evaluator reckons time*.
     *
     * ⚠️ `granted_at` AND `revoked_at` STAY ON `now()` DELIBERATELY: neither is
     * COMPARED against `NOW` by `decide()` — revocation is a non-null test —
     * so pinning them would suggest a drift that does not exist. **Only the
     * value the evaluator reckons against is pinned.**
     *
     * 🛑 FOUR SLICES FOUND THIS INDEPENDENTLY AND WROTE THE SAME REPAIR, AND
     * THE MERGE RECORDS ALL FOUR RATHER THAN THE ONE THAT LANDED FIRST —
     * SECTION 5.8, CONVERGENCE AS THE SIGNAL, AND IT IS THE STRONGEST INSTANCE
     * THIS REPOSITORY HAS. G1209 (21 Sep, main, the earliest), then
     * G1932/G1999 (S4), G2014 (S5) and G2027 (S6) on 22 Sep, each from a
     * different slice, each measuring the same red -- "ras_expired was ALLOWED
     * and must not have been" -- and none of the four aware of the others.
     *
     * The narration above is G1209's and is kept because it is the tree's and
     * because its section 5.1 reading is the sharpest: the old row keyed on the
     * clock that was TO HAND rather than on the clock the evaluator reckons by.
     * The three later ones add one fact between them: S6 measured the failure
     * with model/ and server/ RESTORED to its merge base, so the defect is
     * PRE-EXISTING rather than anything a slice introduced.
     *
     * WHY FOUR AGENTS AND NOT ONE REVIEWER FOUND IT: every one of them had a
     * PostgreSQL and CI does not. A suite that cannot run cannot rot loudly,
     * and this one stood down on every gate that had ever passed over it. */
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES
         ($1, 'ras_live',    $2, 'rol_ap_approver', 3, 'usr_admin', now(), NULL, NULL),
         ($1, 'ras_revoked', $2, 'rol_ap_approver', 3, 'usr_admin', now(), NULL, now()),
         /* ANCHORED TO THE TEST'S OWN FROZEN NOW AND NOT TO now() -- the
          * whole argument is on the docblock above this query and is NOT
          * restated here (section 5.3: two copies of one argument, and the
          * copy is what drifts). $5 is NOW, the same constant section 4 hands
          * decide(), so the fixture and the evaluator cannot read two clocks.
          * G1209 (main) - G1932/G1999 (S4) - G2014 (S5) - G2027 (S6). */
         ($1, 'ras_expired', $2, 'rol_ap_approver', 3, 'usr_admin',
             $5::timestamptz - interval '2 days', $5::timestamptz - interval '1 day', NULL),
         ($1, 'ras_moved',   $2, 'rol_ap_approver', 2, 'usr_admin', now(), NULL, NULL),
         ($1, 'ras_archived',$2, 'rol_archived',    1, 'usr_admin', now(), NULL, NULL),
         ($3, 'ras_globex',  $4, 'rol_globex_approver', 1, 'usr_admin', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI, GLOBEX, ANA, NOW],
    )

    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/** The session row as the serving reader now builds one, for `resolveSubject()`. */
function sessionRow(userId: string, connectionId: string, tenantId: string): Session {
  return {
    id: `ses_${userId}`,
    handleDigest: DIGEST[userId] ?? '',
    userId,
    connectionId,
    tenantId,
    issuedHost: 'acme.invalid',
    authenticatedAt: '2026-09-19T00:00:00.000Z',
    secondFactorAt: null,
    lastUsedAt: '2026-09-19T00:00:00.000Z',
    expiresAt: '2026-09-20T00:00:00.000Z',
    revokedAt: null,
  } as unknown as Session
}

describe('the identity substrate — the rows, the policies, and the deleted WHERE', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /**
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE, as in
     * `tests/db/tenant-isolation.test.ts`: every scoped transaction is FORCED
     * onto the connection the previous one released, which is the condition
     * under which a session-level `SET` would leak between scopes.
     */
    pool = await createAppPool(1)
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  /* ================================================================ *
   * §1 · THE WITNESSED RED. The predicate this commit deleted, run
   *      against the fixtures it could not see.
   * ================================================================ */

  it('1a · the DELETED predicate admits a DISABLED PERSON — this is the defect, preserved', async () => {
    const rows = await withSessionScope(pool, DIGEST[RAJ] ?? '', async (tx) =>
      (await tx.query(DELETED_PREDICATE)).rows as Array<Record<string, unknown>>,
    )
    assert.equal(
      rows.length,
      1,
      'the deleted predicate did NOT return the disabled person\'s session. If this ' +
        'assertion fails, the fixture changed and §1 is no longer witnessing anything — ' +
        'repair the fixture, do not delete the assertion.',
    )
    assert.equal(rows[0]?.['user_id'], RAJ)

    /* And the row it returns carries no hint at all: the statement never touches
     * `tenant."user"`, so nothing in this result could have told the caller. */
    assert.equal(
      Object.hasOwn(rows[0] ?? {}, 'status'),
      false,
      'the deleted predicate selected a `status` column, which it never did. The point ' +
        'of §1 is that the old read had NOTHING to consult: §8.6, "`User.status: ' +
        "'disabled'` was consulted by NOTHING\", one layer down.",
    )
  })

  it('1b · the DELETED predicate admits a person behind a DISABLED DIRECTORY', async () => {
    const rows = await withSessionScope(pool, DIGEST[LEE] ?? '', async (tx) =>
      (await tx.query(DELETED_PREDICATE)).rows as Array<Record<string, unknown>>,
    )
    assert.equal(rows.length, 1, 'the deleted predicate did not return the dead-door session')
    assert.equal(rows[0]?.['connection_id'], DOOR_DEAD)
  })

  it('1c · and the model REFUSES both, by name, from the rows the reader now supplies', async () => {
    for (const [userId, door, refusal] of [
      [RAJ, DOOR_LIVE, SESSION_REFUSALS.userDisabled],
      [LEE, DOOR_DEAD, SESSION_REFUSALS.connectionDisabled],
    ] as const) {
      const read = await withSessionScope(pool, DIGEST[userId] ?? '', (tx) => readSubjectRows(tx))
      assert.equal(read.ok, true, `the substrate read refused for ${userId}`)
      if (!read.ok) return

      const resolution = resolveSubject({
        session: sessionRow(userId, door, ACME),
        user: read.rows.user,
        connection: read.rows.connection,
        now: NOW,
        surface: 'tenant',
      })
      assert.equal(resolution.ok, false, `${userId} resolved a subject and must not have`)
      if (resolution.ok) return
      assert.equal(
        resolution.refusal,
        refusal,
        `${userId} was refused as \`${resolution.refusal}\` rather than \`${refusal}\`. ` +
          'The ORDER of `resolveSubject()`\'s seven arms is the slice — a refusal with the ' +
          'wrong name means an earlier arm fired and the one under test never ran.',
      )
    }
  })

  /* ================================================================ *
   * §2 · The policies. Deny on NULL, and narrowed by the SESSION.
   * ================================================================ */

  it('2a · inside a session scope, `user` and `identity_connection` return exactly the session\'s rows', async () => {
    const read = await withSessionScope(pool, DIGEST[MEI] ?? '', (tx) => readSubjectRows(tx))
    assert.equal(read.ok, true, 'the substrate read refused for a complete fixture')
    if (!read.ok) return
    assert.equal(read.rows.user.id, MEI)
    assert.equal(read.rows.user.status, 'active')
    assert.equal(read.rows.connection.id, DOOR_LIVE)
    assert.deepEqual(read.rows.connection.owner, { kind: 'customer', accountId: 'acc_acme' })
  })

  it('2b · under a digest that matches no session, both reads are EMPTY — G100 deny-on-NULL', async () => {
    const read = await withSessionScope(pool, 'f'.repeat(64), (tx) => readSubjectRows(tx))
    assert.equal(read.ok, false, 'a foreign digest resolved a person. The policy resolves the ' +
      'user id out of `tenant.session` by the digest in `app.session_ref`; a digest naming no ' +
      'session yields NULL, and `id = NULL` is not TRUE.')
    if (read.ok) return
    assert.equal(read.refusal, SUBSTRATE_REFUSALS.userAbsent)
  })

  it('2c · a session naming a user id with no row is `user_absent`, not a blank subject', async () => {
    const read = await withSessionScope(pool, DIGEST[GHOST] ?? '', (tx) => readSubjectRows(tx))
    assert.equal(read.ok, false, 'a session with no person behind it resolved one')
    if (read.ok) return
    assert.equal(
      read.refusal,
      SUBSTRATE_REFUSALS.userAbsent,
      '0009 declines a foreign key from `session.user_id` so that THIS state is ' +
        'representable and the refusal is testable. An FK would make it unrepresentable ' +
        'and make this assertion impossible to write — which is the mirror of the defect ' +
        'the whole slice exists to end.',
    )
  })

  it('2d · a connection whose owner columns disagree REFUSES rather than defaulting to `customer`', async () => {
    /* The broken row is reachable only by pointing a session at it, which is
     * what a misconfiguration would do. G289 priced the alternative: a default
     * here deletes the live-grant check, the `partnerId` check, revocation,
     * expiry and `PARTNER_CAPABILITY_MASK` in one assignment. */
    const mig = await migratorClient()
    try {
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ('ses_broken', $1, $2, $3, $4, 'acme.invalid',
                 now(), now(), now() + interval '1 hour', NULL)
         ON CONFLICT DO NOTHING`,
        ['ab'.repeat(32), MEI, DOOR_BROKEN, ACME],
      )
    } finally {
      await mig.end()
    }

    const read = await withSessionScope(pool, 'ab'.repeat(32), (tx) => readSubjectRows(tx))
    assert.equal(read.ok, false, 'a connection naming no organisation produced one')
    if (read.ok) return
    assert.equal(
      read.refusal,
      SUBSTRATE_REFUSALS.ownerUnresolvable,
      'G299: "If it cannot be resolved, refuse; do not default." A `partner` owner with ' +
        'no partner id names no organisation, and an organisation is what invariants 2 ' +
        'and 8 are both written in terms of.',
    )
  })

  /* ================================================================ *
   * §3 · The tenant-scoped half, and the control that makes it mean
   *      something.
   * ================================================================ */

  it('3a · assignments are visible in their own tenant scope and invisible in the other', async () => {
    const inAcme = await withTenantScope(pool, ACME, (tx) => readHeldAssignments(tx, MEI))
    assert.equal(inAcme.ok, true)
    if (!inAcme.ok) return
    assert.equal(inAcme.held.length, 5, 'ACME holds five assignments for Mei — one live and ' +
      'four dead in four different ways. A count below five means the reader grew a ' +
      'liveness `WHERE`, which is the defect this slice deleted one table over.')
    assert.deepEqual(
      [...new Set(inAcme.held.map((h) => h.assignment.tenantId))],
      [ACME],
      'a read scoped to ACME returned another tenant\'s assignment',
    )

    const inGlobex = await withTenantScope(pool, GLOBEX, (tx) => readHeldAssignments(tx, MEI))
    assert.equal(inGlobex.ok, true)
    if (!inGlobex.ok) return
    assert.deepEqual(
      inGlobex.held,
      [],
      'a subject in tenant A resolved authority inside tenant B. `role_assignment_rls` is ' +
        '0001\'s predicate verbatim and there is no `WHERE tenant_id` in the statement — ' +
        'the narrowing is the policy\'s, so an empty result here is the policy working.',
    )
  })

  it('3b · NEGATIVE CONTROL — with RLS DISABLED the same read leaks BOTH tenants', async () => {
    /**
     * 🛑 WITHOUT THIS, §3a PROVES NOTHING. `tests/db/tenant-isolation.test.ts`
     * carries the same control for the same reason: a read that returns one
     * tenant's rows is indistinguishable from a read that would have returned
     * one tenant's rows anyway, and only turning the policy off can tell them
     * apart.
     */
    const mig = await migratorClient()
    try {
      await mig.query('ALTER TABLE tenant.role_assignment DISABLE ROW LEVEL SECURITY')
      await mig.query('ALTER TABLE tenant.role DISABLE ROW LEVEL SECURITY')

      const leaked = await withTenantScope(pool, ACME, async (tx) =>
        (await tx.query(
          'SELECT tenant_id, id FROM tenant.role_assignment ORDER BY id',
        )).rows as Array<Record<string, unknown>>,
      )
      const tenants = [...new Set(leaked.map((r) => String(r['tenant_id'])))].sort()
      assert.deepEqual(
        tenants,
        [ACME, GLOBEX].sort(),
        'with row-level security DISABLED the read did NOT leak both tenants — so §3a\'s ' +
          'single-tenant result was never evidence about the policy. Either the fixture ' +
          'lost its GLOBEX row or something other than RLS is narrowing this read.',
      )
    } finally {
      await mig.query('ALTER TABLE tenant.role ENABLE ROW LEVEL SECURITY').catch(() => undefined)
      await mig
        .query('ALTER TABLE tenant.role_assignment ENABLE ROW LEVEL SECURITY')
        .catch(() => undefined)
      await mig.end()
    }

    /* And back to refusing, in the same test, so a failure above cannot leave a
     * disabled policy behind for every suite that runs after it. */
    const restored = await withTenantScope(pool, ACME, (tx) => readHeldAssignments(tx, MEI))
    assert.equal(restored.ok, true)
    if (!restored.ok) return
    assert.deepEqual([...new Set(restored.held.map((h) => h.assignment.tenantId))], [ACME])
  })

  /* ================================================================ *
   * §4 · THE DIFFERENTIAL. One ALLOW, and the same request refused
   *      with exactly one term removed — each refusal BY NAME.
   * ================================================================ */

  it('4 · a live assignment ALLOWS, and each single missing term refuses with its own reason', async () => {
    const read = await withSessionScope(pool, DIGEST[MEI] ?? '', (tx) => readSubjectRows(tx))
    assert.equal(read.ok, true)
    if (!read.ok) return

    const resolution = resolveSubject({
      session: sessionRow(MEI, DOOR_LIVE, ACME),
      user: read.rows.user,
      connection: read.rows.connection,
      now: NOW,
      surface: 'tenant',
    })
    assert.equal(resolution.ok, true, 'a complete, live fixture failed to resolve a subject')
    if (!resolution.ok) return
    assert.equal(
      resolution.subject.orgClass,
      'customer',
      'org class came out wrong. It derives from `orgFor(connection.owner)` and from ' +
        'nothing else — not from the membership, not from the route.',
    )

    const all = await withTenantScope(pool, ACME, (tx) => readHeldAssignments(tx, MEI))
    assert.equal(all.ok, true)
    if (!all.ok) return

    const principal = (held: typeof all.held) => ({
      subject: { userId: resolution.subject.userId, status: 'active' as const },
      tenantId: tenantOf(resolution.subject),
      orgClass: resolution.subject.orgClass,
      partnerId: resolution.subject.partnerId,
      partnerGrant: null,
      held,
      platformHeld: null,
      now: NOW,
    })

    const only = (id: string) => all.held.filter((h) => h.assignment.id === id)

    /* ---- THE ALLOW. Everything below is meaningless without it. ---- */
    const allowed = decide(principal(only('ras_live')), CAPABILITIES.admitSource)
    assert.equal(
      allowed.allowed,
      true,
      `a live assignment carrying \`admit_source\` was REFUSED as \`${allowed.reason}\`. ` +
        'Until this line went green, every authorisation arm in this product had only ever ' +
        'been observed refusing — which is `docs/HANDOFF.md` §5.6, and which is why this ' +
        'assertion comes first.',
    )
    assert.equal(allowed.reason, DECISION_REASONS.permitted)
    assert.deepEqual(
      /* G2591: `via` is a discriminated union — a reader discriminates first. */
      allowed.via.map((v) => ('assignmentId' in v ? v.assignmentId : v.accessGrantId)),
      ['ras_live'],
      'the decision did not name the assignment that carried it',
    )

    /* ---- ONE TERM REMOVED, FIVE TIMES, EACH REFUSED BY ITS OWN NAME. ---- */
    for (const [id, reason] of [
      ['ras_revoked', DECISION_REASONS.assignment_revoked],
      ['ras_expired', DECISION_REASONS.assignment_expired],
      ['ras_moved', DECISION_REASONS.role_version_moved],
      ['ras_archived', DECISION_REASONS.role_not_active],
    ] as const) {
      const verdict = decide(principal(only(id)), CAPABILITIES.admitSource)
      assert.equal(verdict.allowed, false, `${id} was ALLOWED and must not have been`)
      assert.equal(
        verdict.reason,
        reason,
        `${id} was refused as \`${verdict.reason}\` rather than \`${reason}\`. ` +
          '`decide()` keeps revocation and expiry as TWO members deliberately — "A ' +
          'revocation is an ACT somebody took and is answerable; an expiry is a clock ' +
          'arriving and is nobody\'s act" — and a reader that filtered either out in SQL ' +
          'would make both unreachable.',
      )
    }

    /* ---- NO ASSIGNMENT AT ALL: `[]` is a fact, and it has its own name. ---- */
    const none = decide(principal([]), CAPABILITIES.admitSource)
    assert.equal(none.allowed, false)
    assert.equal(
      none.reason,
      DECISION_REASONS.no_live_assignment,
      'a person with no role assignment must be refused as `no_live_assignment` — "a ' +
        'reader ran and found no assignments", which is a fact about the person. `null` ' +
        'would be "there is no reader", a fact about us, and the two must never collapse.',
    )

    /* ---- THE CAPABILITY THE ROLE DOES NOT CARRY. ---- */
    const wrongVerb = decide(principal(only('ras_live')), CAPABILITIES.exportData)
    assert.equal(wrongVerb.allowed, false)
    assert.equal(wrongVerb.reason, DECISION_REASONS.no_assignment_carries_capability)
  })

  /* ================================================================ *
   * §5 · A PARTNER DOES NOT GET THE CUSTOMER ARM.
   * ================================================================ */

  it('5 · a principal resolved through a PARTNER door is refused at `partner_grant_absent`', async () => {
    const mig = await migratorClient()
    try {
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ('ses_partner', $1, $2, $3, $4, 'acme.invalid',
                 now(), now(), now() + interval '1 hour', NULL)
         ON CONFLICT DO NOTHING`,
        ['cd'.repeat(32), MEI, DOOR_PARTNER, ACME],
      )
    } finally {
      await mig.end()
    }

    const read = await withSessionScope(pool, 'cd'.repeat(32), (tx) => readSubjectRows(tx))
    assert.equal(read.ok, true)
    if (!read.ok) return

    const resolution = resolveSubject({
      session: sessionRow(MEI, DOOR_PARTNER, ACME),
      user: read.rows.user,
      connection: read.rows.connection,
      now: NOW,
      surface: 'tenant',
    })
    assert.equal(resolution.ok, true)
    if (!resolution.ok) return
    assert.equal(
      resolution.subject.orgClass,
      'partner',
      'the SAME PERSON, through a partner door, must resolve `partner`. Org is a property ' +
        'of HOW YOU AUTHENTICATED, not of who you are — "a dual-affiliated consultant is ' +
        'partner on Monday and customer on Tuesday".',
    )
    assert.equal(resolution.subject.partnerId, 'prt_northwind')

    const all = await withTenantScope(pool, ACME, (tx) => readHeldAssignments(tx, MEI))
    assert.equal(all.ok, true)
    if (!all.ok) return

    const verdict = decide(
      {
        subject: { userId: resolution.subject.userId, status: 'active' },
        tenantId: tenantOf(resolution.subject),
        orgClass: resolution.subject.orgClass,
        partnerId: resolution.subject.partnerId,
        partnerGrant: null,
        held: all.held.filter((h) => h.assignment.id === 'ras_live'),
        platformHeld: null,
        now: NOW,
      },
      CAPABILITIES.admitSource,
    )

    assert.equal(verdict.allowed, false)
    assert.equal(
      verdict.reason,
      DECISION_REASONS.partner_grant_absent,
      `the partner was refused as \`${verdict.reason}\`. It must be ` +
        '`partner_grant_absent` — the PARTNER arm, by name. Any customer-arm reason here ' +
        'means `orgClass` was fabricated, which G289 prices at five deleted controls: the ' +
        'live-grant check, the `partnerId` check, revocation, expiry and the mask. **A ' +
        'live assignment carrying the verb is present in this fixture and must not save ' +
        'them.**',
    )
  })

  /* ================================================================ *
   * §6 · THE BROKER HANDLE — G304/G305, over
   *      `db/migrations/0011_federated_connection.sql`.
   *
   * 🛑 THE ALLOW ARMS COME FIRST AND THERE ARE TWO OF THEM, BECAUSE
   *    G305's RULE IS TWO DIRECTIONS AND A SUITE THAT ONLY WITNESSED
   *    REFUSALS WOULD BE `docs/HANDOFF.md` §5.6 — a control whose only
   *    observable behaviour is refusal. §6a is a BROKERED door
   *    resolving; §6c is an UNBROKERED one resolving. §6d is every way
   *    the pairing can fail, each by name.
   * ================================================================ */

  it('6a · ALLOW — a FEDERATED connection resolves, and the handle is the PAIR', async () => {
    const read = await withSessionScope(pool, DIGEST[MEI] ?? '', (tx) => readSubjectRows(tx))
    assert.equal(
      read.ok,
      true,
      'a coherently brokered `oidc` connection was REFUSED. Until this line went green ' +
        'the broker handle had no reader that could be observed succeeding, and a column ' +
        'proven only by its refusals is the shape §5.6 catalogues.',
    )
    if (!read.ok) return

    assert.deepEqual(
      read.rows.connection.federation,
      { brokerIssuer: BROKER_ISSUER, brokerRef: 'acme-entra' },
      'the reader did not assemble the broker handle. It is a PAIR — G304: a Cognito ' +
        'provider name is unique WITHIN ONE POOL and nowhere else, so the issuer ' +
        'namespaces the reference and a reader returning either half alone has produced ' +
        'a key that can collide across pools.',
    )

    const resolution = resolveSubject({
      session: sessionRow(MEI, DOOR_LIVE, ACME),
      user: read.rows.user,
      connection: read.rows.connection,
      now: NOW,
      surface: 'tenant',
    })
    assert.equal(resolution.ok, true, 'a federated principal failed to resolve a subject')
    if (!resolution.ok) return
    assert.equal(resolution.subject.orgClass, 'customer')
  })

  it('6b · federation is NOT a source of organisation — same broker, different owner, different org', async () => {
    /**
     * 🛑 THE ASSERTION THIS FILE MOST NEEDS AND THE ONE EASIEST TO OMIT.
     * `DOOR_LIVE` and `DOOR_PARTNER` sit behind the SAME `broker_issuer`;
     * they differ in `broker_ref` and in `owner_kind`. If anything ever
     * derived organisation from the broker — the issuer, the reference, or
     * their presence — these two would come out the same, and G289 prices that
     * at five deleted controls. The org axis derives from `owner` and from
     * nothing else.
     */
    const mig = await migratorClient()
    try {
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ('ses_fed_partner', $1, $2, $3, $4, 'acme.invalid',
                 now(), now(), now() + interval '1 hour', NULL)
         ON CONFLICT DO NOTHING`,
        ['e1'.repeat(32), MEI, DOOR_PARTNER, ACME],
      )
    } finally {
      await mig.end()
    }

    const read = await withSessionScope(pool, 'e1'.repeat(32), (tx) => readSubjectRows(tx))
    assert.equal(read.ok, true)
    if (!read.ok) return

    assert.equal(
      read.rows.connection.federation?.brokerIssuer,
      BROKER_ISSUER,
      'the partner door sits behind the SAME broker as the customer door in this ' +
        'fixture, deliberately. If the issuers differ, the fixture has stopped being the ' +
        'one this assertion is about.',
    )
    assert.notEqual(read.rows.connection.federation?.brokerRef, 'acme-entra')

    const resolution = resolveSubject({
      session: sessionRow(MEI, DOOR_PARTNER, ACME),
      user: read.rows.user,
      connection: read.rows.connection,
      now: NOW,
      surface: 'tenant',
    })
    assert.equal(resolution.ok, true)
    if (!resolution.ok) return
    assert.equal(
      resolution.subject.orgClass,
      'partner',
      'the SAME broker produced a DIFFERENT organisation, which is the property under ' +
        'test. A `customer` here would mean something derived org from the broker rather ' +
        'than from `owner` — and would route a partner past the live-grant check, the ' +
        '`partnerId` check, revocation, expiry and `PARTNER_CAPABILITY_MASK`.',
    )
  })

  it('6c · ALLOW — an UNBROKERED `cognito_pool` door resolves with NO handle', async () => {
    const mig = await migratorClient()
    try {
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ('ses_pool', $1, $2, $3, $4, 'acme.invalid',
                 now(), now(), now() + interval '1 hour', NULL)
         ON CONFLICT DO NOTHING`,
        ['e2'.repeat(32), MEI, DOOR_POOL, ACME],
      )
    } finally {
      await mig.end()
    }

    const read = await withSessionScope(pool, 'e2'.repeat(32), (tx) => readSubjectRows(tx))
    assert.equal(
      read.ok,
      true,
      'an unbrokered `cognito_pool` connection was refused. `PROTOCOL_IS_BROKERED` says ' +
        'false for it — the pool IS the directory, it does not front one — so NULL handle ' +
        'columns are the correct and only shape.',
    )
    if (!read.ok) return
    assert.equal(
      read.rows.connection.federation,
      null,
      '`null` here is an ANSWER — "this door is not brokered" — and not an absence of ' +
        'reading. The distinction is `authorise.ts`\'s `[]`-versus-`null` one, applied to ' +
        'a door.',
    )
  })

  it('6d · every incoherent pairing refuses `broker_unresolvable`, BY NAME and never by default', async () => {
    /**
     * FIVE MALFORMATIONS, ONE REFUSAL. 0011 declines a `CHECK` constraint for
     * 0009's reason — *"the constraint would delete a control rather than add
     * one … the refusal becomes untestable"* — so every one of these rows is
     * WRITABLE, and this test is the only thing in the system that says they
     * are wrong.
     *
     * ⚠️ EACH FIXTURE IS WRONG IN EXACTLY ONE WAY. A row that also had a
     * broken owner would be refused by whichever check runs first, and the
     * assertion would be pinning the ORDER of `identityConnectionFrom()`
     * rather than the rule.
     */
    const cases: ReadonlyArray<readonly [string, string, string, string | null, string | null]> = [
      // id, protocol, digest, broker_issuer, broker_ref
      ['idc_fed_none', 'oidc', 'a1'.repeat(32), null, null],
      ['idc_fed_issuer_only', 'oidc', 'a2'.repeat(32), BROKER_ISSUER, null],
      ['idc_fed_ref_only', 'oidc', 'a3'.repeat(32), null, 'orphan-ref'],
      ['idc_fed_empty', 'saml', 'a4'.repeat(32), BROKER_ISSUER, ''],
      ['idc_fed_pool_handle', 'cognito_pool', 'a5'.repeat(32), BROKER_ISSUER, 'pool-fronting-itself'],
    ]

    const mig = await migratorClient()
    try {
      for (const [id, protocol, digest, issuer, ref] of cases) {
        await mig.query(
          `INSERT INTO tenant.identity_connection
             (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
              broker_issuer, broker_ref, status)
           VALUES ($1, $2, 'Malformed', 'customer', NULL, 'acc_acme', $3, $4, 'active')
           ON CONFLICT DO NOTHING`,
          [id, protocol, issuer, ref],
        )
        await mig.query(
          `INSERT INTO tenant.session
             (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
              authenticated_at, last_used_at, expires_at, revoked_at)
           VALUES ('ses_' || $1, $2, $3, $1, $4, 'acme.invalid',
                   now(), now(), now() + interval '1 hour', NULL)
           ON CONFLICT DO NOTHING`,
          [id, digest, MEI, ACME],
        )
      }
    } finally {
      await mig.end()
    }

    for (const [id, , digest] of cases) {
      const read = await withSessionScope(pool, digest, (tx) => readSubjectRows(tx))
      assert.equal(read.ok, false, `${id} resolved a connection and must not have`)
      if (read.ok) return
      assert.equal(
        read.refusal,
        SUBSTRATE_REFUSALS.brokerUnresolvable,
        `${id} was refused as \`${read.refusal}\` rather than \`broker_unresolvable\`. ` +
          'G305 makes the rule BOTH directions — a handle is present exactly when ' +
          '`PROTOCOL_IS_BROKERED[protocol]` — and a wrong name here means a different ' +
          'check fired and the pairing was never tested. **The alternative to refusing is ' +
          'reading half a handle as none, which admits a door no token can name.**',
      )
    }
  })

  it('6e · the DATABASE refuses two doors sharing one broker handle — and the PAIR is the key', async () => {
    /**
     * 🛑 THE ONE THING IN 0011 THE DATABASE ENFORCES, AND THE ONLY PLACE IT
     * CAN BE. A resolver mapping a handle to a connection sees one row and
     * cannot know there is a second; `mayRouteToConnection()` refuses the
     * same shape on the DOMAIN axis only because it can see both claims at
     * once. Here the unique index is the thing that can.
     */
    const mig = await migratorClient()
    try {
      let code: string | undefined
      try {
        await mig.query(
          `INSERT INTO tenant.identity_connection
             (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
              broker_issuer, broker_ref, status)
           VALUES ('idc_handle_thief', 'oidc', 'Thief', 'partner', 'prt_thief', NULL,
                   $1, 'acme-entra', 'active')`,
          [BROKER_ISSUER],
        )
      } catch (err) {
        code = (err as { code?: string }).code
      }
      assert.equal(
        code,
        '23505',
        'a SECOND connection took the broker handle `acme-entra` already held by ' +
          `${DOOR_LIVE}, and the database allowed it. That is the state in which one ` +
          'token resolves to two organisations — a `customer` door and a `partner` door ' +
          'answering to one name. `identity_connection_broker_handle_uniq` is what refuses ' +
          'it; if this assertion fails, the index is missing or its predicate is wrong.',
      )

      /* AND THE PAIR IS THE KEY, NOT THE REFERENCE. The same `broker_ref`
       * under a DIFFERENT issuer is a DIFFERENT directory in a different pool
       * and must be accepted — otherwise the index would be enforcing global
       * uniqueness of a name Cognito only scopes per pool, which is a
       * constraint nobody ruled and which would break BYOA under G276. */
      await mig.query(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status)
         VALUES ('idc_other_pool', 'oidc', 'Another pool', 'customer', NULL, 'acc_other',
                 'https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_OTHERPOOL',
                 'acme-entra', 'active')
         ON CONFLICT DO NOTHING`,
      )

      const both = (await mig.query(
        `SELECT count(*)::int AS n FROM tenant.identity_connection WHERE broker_ref = 'acme-entra'`,
      )).rows as Array<Record<string, unknown>>
      assert.equal(
        both[0]?.['n'],
        2,
        'the same provider name under a DIFFERENT pool was rejected. The index is on the ' +
          'PAIR — G304 — and a reference is unique only within its issuer.',
      )

      /* Two NULL pairs do not collide either: the index is partial on
       * `broker_ref IS NOT NULL`, so unbrokered doors are simply not its
       * subject. A plain UNIQUE would have had an opinion about them. */
      await mig.query(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status)
         VALUES ('idc_second_pool_door', 'cognito_pool', 'Second pool door', 'customer',
                 NULL, 'acc_acme', NULL, NULL, 'active')
         ON CONFLICT DO NOTHING`,
      )
    } finally {
      await mig.query(
        `DELETE FROM tenant.identity_connection
          WHERE id IN ('idc_other_pool', 'idc_second_pool_door', 'idc_handle_thief')`,
      ).catch(() => undefined)
      await mig.end()
    }
  })

  it('6f · NEGATIVE CONTROL — with `identity_connection_rls` DROPPED the read FAILS CLOSED, and with RLS DISABLED it leaks', async () => {
    /**
     * 🛑 WITHOUT THIS, §6a PROVES NOTHING ABOUT THE POLICY. 0011 creates no
     * table and therefore issues no `ENABLE`/`FORCE` — it relies on 0009's,
     * and *a property inherited is a property nobody has observed*. This test
     * observes it, on THESE columns, in both directions:
     *
     *   · policy DROPPED, RLS still ENABLE+FORCE  → zero rows. No policy is a
     *     DENY, which is the fail-closed direction and is what makes the
     *     inheritance safe.
     *   · RLS DISABLED                            → every connection visible,
     *     including their broker handles. That is what §6a's single row is
     *     evidence against.
     */
    const mig = await migratorClient()
    try {
      await mig.query('DROP POLICY identity_connection_rls ON tenant.identity_connection')

      const closed = await withSessionScope(pool, DIGEST[MEI] ?? '', async (tx) =>
        (await tx.query(
          'SELECT id, broker_ref FROM tenant.identity_connection',
        )).rows as Array<Record<string, unknown>>,
      )
      assert.deepEqual(
        closed,
        [],
        'with the policy DROPPED and row-level security still ENABLEd and FORCEd, the ' +
          'read returned rows. `FORCE` is what makes the app role subject to policies at ' +
          'all, and no policy must mean NO ROWS — if this leaks, a future migration that ' +
          'drops a policy would silently publish every directory in the system.',
      )

      await mig.query('ALTER TABLE tenant.identity_connection DISABLE ROW LEVEL SECURITY')
      const leaked = await withSessionScope(pool, DIGEST[MEI] ?? '', async (tx) =>
        (await tx.query(
          `SELECT id FROM tenant.identity_connection WHERE broker_ref IS NOT NULL`,
        )).rows as Array<Record<string, unknown>>,
      )
      assert.equal(
        leaked.length > 1,
        true,
        'with row-level security DISABLED the read did NOT return more than one brokered ' +
          'door — so §6a\'s single row was never evidence about the policy. Either the ' +
          'fixture lost its other connections, or something other than RLS is narrowing ' +
          'this read.',
      )
    } finally {
      await mig
        .query('ALTER TABLE tenant.identity_connection ENABLE ROW LEVEL SECURITY')
        .catch(() => undefined)
      /* RECREATED VERBATIM from `db/migrations/0009_identity_substrate.sql`.
       * A restoration that differed from the migration by one token would
       * leave every suite after this one testing a policy nobody wrote. */
      await mig
        .query(
          `CREATE POLICY identity_connection_rls ON tenant.identity_connection
             USING (
               id = (
                 SELECT s.connection_id
                   FROM tenant.session s
                  WHERE s.handle_digest = nullif(current_setting('app.session_ref', true), '')
               )
             )`,
        )
        .catch(() => undefined)
      await mig.end()
    }

    /* And back to admitting exactly one, in the same test, so a failure above
     * cannot leave a policy-less table behind for every suite that follows. */
    const restored = await withSessionScope(pool, DIGEST[MEI] ?? '', (tx) => readSubjectRows(tx))
    assert.equal(restored.ok, true, 'the policy was not restored correctly')
    if (!restored.ok) return
    assert.equal(restored.rows.connection.id, DOOR_LIVE)
    assert.deepEqual(restored.rows.connection.federation, {
      brokerIssuer: BROKER_ISSUER,
      brokerRef: 'acme-entra',
    })
  })
})

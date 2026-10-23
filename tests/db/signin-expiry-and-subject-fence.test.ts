/**
 * D6-6 AND D6-7 — TWO OWNER RULINGS OF 29–30 Sep 2026, BUILT 1 Oct 2026,
 * G2201–G2210, over `db/migrations/0240_sign_in_attempt_expiry.sql` and
 * `db/migrations/0241_user_mint_names_the_subject.sql`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 READ THE TWO MIGRATIONS FIRST. THEY ARGUE EVERY CHOICE; THIS FILE ONLY
 *    WITNESSES THEM.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * §1 — D6-6. *"A sign-in attempt EXPIRES, on a short TTL enforced in the
 *      DATABASE."* Until `0240` nothing aged an attempt: `expires_at` was
 *      `NOT NULL` and read by nothing, so a stolen `state` was consumable for
 *      ever. WITNESSED RED FIRST, against the tree before `0240`:
 *
 *        §1a  an attempt STARTED eleven minutes ago, whose writer-set
 *             `expires_at` is an hour away  -> `{ ok: true }`, CONSUMED
 *        §1b  an attempt whose own `expires_at` passed a second ago
 *                                           -> `{ ok: true }`, CONSUMED
 *
 *      Both are `sign_in_attempt_absent` after it, and the row is left
 *      UNCONSUMED — §1c reads it back as the migrator.
 *
 * §2 — D6-7. *"The restrictive policy on `tenant."user"` gains the SUBJECT
 *      term, not just the door."* The hazard is PROSPECTIVE and §2a makes it
 *      real rather than imagined: it installs the FIFTH PERMISSIVE POLICY D6
 *      describes — `FOR INSERT WITH CHECK (true)`, the widest one anybody
 *      could write — and mints a person on the RIGHT door with a subject the
 *      scope never named. WITNESSED RED FIRST, against the tree before `0241`:
 *      the INSERT LANDED, rowCount 1. After it, the refusal NAMES
 *      `user_signin_mint_restrictive`, which PostgreSQL does only when a
 *      RESTRICTIVE policy fails — so the name is proof the probe ADMITTED the
 *      row and the restrictive term is the one thing that stopped it.
 *
 * §3 — THE RECURSION, RE-MEASURED AND NOT ASSUMED. S1 measured eleven of
 *      eleven probe arms answering `infinite recursion detected in policy for
 *      relation "user"` when a `user` policy subqueried `identity_connection`.
 *      The new term reads the row's OWN column against a GUC, and §3 drives
 *      every scope that reads or writes this table through it.
 *
 * §4 — THE CENSUS (D6-7 (b), which the owner took ALONGSIDE (a): *"defence in
 *      depth, which is this repo's established pattern for authority writes"*).
 *      The set of policies on `tenant."user"` and on `tenant.sign_in_attempt`
 *      is pinned BY NAME AND BY KIND, so a fifth policy is a red gate rather
 *      than a silent widening — and the commit that adds one has to delete an
 *      assertion here on purpose.
 *
 * ⚠️ EVERY CLOCK IN THIS FILE IS THE DATABASE's. Nothing here passes a frozen
 * `now:` to an evaluator, which is `tools/check-clock-fixtures.mjs`'s rule:
 * the policy compares `now()` against rows seeded from `now()`, so the two can
 * never disagree by the calendar alone.
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
import { withSignInScope, type SignInScope } from '../../db/signin-scope.ts'

import type { FederatedCallback, IdentityConnectionId, SessionHandleDigest } from '../../model/domain.ts'
import {
  SIGN_IN_ATTEMPT_TTL_MINUTES,
  SIGN_IN_REFUSALS,
  assembleSignIn,
} from '../../server/data-plane/signin.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SIGNIN_FENCE_DB_NAME'] ?? runScopedName('reconcile_signin_fence_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DOOR = 'idc_acme_entra' as IdentityConnectionId
const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLAAA'
const REF = 'acme-entra'
const MEI = 'usr_acme_mei'

/** 64 hex characters — the shape an HMAC-SHA256 output has — and not a real one. */
const STATE_LIVE = '10a1b2c3d4e5f60718293a4b5c6d7e8f10a1b2c3d4e5f60718293a4b5c6d7e8f' as SessionHandleDigest
const STATE_STALE_TTL = '20a1b2c3d4e5f60718293a4b5c6d7e8f20a1b2c3d4e5f60718293a4b5c6d7e8f' as SessionHandleDigest
const STATE_STALE_EXPIRY = '30a1b2c3d4e5f60718293a4b5c6d7e8f30a1b2c3d4e5f60718293a4b5c6d7e8f' as SessionHandleDigest
const CHALLENGE = 'a0b1c2d3e4f5061728394a5b6c7d8e9fa0b1c2d3e4f5061728394a5b6c7d8e9f' as SessionHandleDigest
const SESSION_DIGEST = 'bbbb1111cccc2222dddd3333eeee4444ffff5555aaaa6666bbbb7777cccc8888'

const SUBJECT = 'd6070000-0000-4aaa-8bbb-ccccdddd0001'
const OTHER_SUBJECT = 'd6070000-0000-4aaa-8bbb-ccccdddd0002'

/** The FIFTH permissive policy D6-7 is about. Installed by §2a and dropped in a `finally`. */
const PROBE_POLICY = 'd6_7_probe_fifth_permissive'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the sign-in expiry and subject-fence suite', probe)

function scope(stateDigest: string, over: Partial<SignInScope> = {}): SignInScope {
  return { brokerIssuer: ISSUER, brokerRef: REF, stateDigest, ...over }
}

function callback(handleDigest: SessionHandleDigest): FederatedCallback {
  return { handleDigest, connectionId: DOOR, challengeDigest: CHALLENGE }
}

const MINT_PERSON = `
  INSERT INTO tenant."user"
    (id, email, display_name, status, connection_id, external_subject,
     broker_issuer, broker_ref)
  VALUES ($1, $2, 'New Person', 'active', $3, $4, $5, $6)
`

async function asMigrator<T>(fn: (q: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, params) => mig.query(sql, params as unknown[]))
  } finally {
    await mig.end()
  }
}

async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status, email_claim, name_claim)
       VALUES ($1,'oidc','Acme Entra','customer',NULL,'acc_acme',$2,$3,'active','email','name')`,
      [DOOR, ISSUER, REF],
    )
    await mig.query(
      `INSERT INTO tenant.sign_in_attempt
         (id, handle_digest, connection_id, challenge_digest,
          started_at, expires_at, consumed_at)
       VALUES
         -- The anti-vacuity row: inside both bounds. It MUST still consume.
         ('sia_live',         $1, $4, $5, now(),                         now() + interval '5 minutes', NULL),
         -- STARTED past the TTL while its writer-set expiry is an hour away.
         -- The TTL is the database's, so a writer that sets a long expiry does
         -- not get a long-lived attempt.
         ('sia_stale_ttl',    $2, $4, $5, now() - interval '11 minutes', now() + interval '1 hour',    NULL),
         -- Inside the TTL, past its own declared expiry.
         ('sia_stale_expiry', $3, $4, $5, now() - interval '2 minutes',  now() - interval '1 second',  NULL)`,
      [STATE_LIVE, STATE_STALE_TTL, STATE_STALE_EXPIRY, DOOR, CHALLENGE],
    )
    /* A seeded person and a session for them — §3's session-scope read. */
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1,'mei@acme.invalid','Mei','active',$2)`,
      [MEI, DOOR],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_fence',$1,$2,$3,NULL,'acme.invalid',
               now(), now(), now() + interval '12 hours', NULL)`,
      [SESSION_DIGEST, MEI, DOOR],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

async function consumedAt(id: string): Promise<Date | null> {
  return asMigrator(async (q) => {
    const row = (await q('SELECT consumed_at FROM tenant.sign_in_attempt WHERE id = $1', [id]))
      .rows[0] as { consumed_at: Date | null } | undefined
    return row === undefined ? null : row.consumed_at
  })
}

describe('D6-6 and D6-7 — an attempt that ages, and a person minted only under the subject named', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool?.end()
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §1 — D6-6. THE ATTEMPT EXPIRES, AND THE DATABASE IS WHAT EXPIRES IT.
   * ═════════════════════════════════════════════════════════════════════ */

  it('1 · ANTI-VACUITY — an attempt inside both bounds still consumes', async () => {
    const out = await withSignInScope(pool, scope(STATE_LIVE), (tx) =>
      assembleSignIn(tx, callback(STATE_LIVE)),
    )
    assert.equal(
      out.ok,
      true,
      `a LIVE attempt was refused (${JSON.stringify(out)}), so every refusal ` +
        'below would be green for the wrong reason: the expiry term would be ' +
        'refusing EVERYTHING, which is an authentication outage wearing a control.',
    )
    assert.notEqual(await consumedAt('sia_live'), null, 'the live attempt was not consumed')
  })

  it('1a · an attempt STARTED past the TTL is unreadable, whatever its writer-set expiry says', async () => {
    const out = await withSignInScope(pool, scope(STATE_STALE_TTL), (tx) =>
      assembleSignIn(tx, callback(STATE_STALE_TTL)),
    )
    assert.deepEqual(
      out,
      { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInAttemptAbsent },
      'AN ATTEMPT ELEVEN MINUTES OLD WAS CONSUMED. D6-6: "a sign-in attempt ' +
        'EXPIRES, on a short TTL enforced in the DATABASE." The witnessed red ' +
        'before `0240` was `{ ok: true }` on exactly this row — a stolen `state` ' +
        'was usable for as long as the row existed, which is one of the three ' +
        'attacks D6 records as having no defence.',
    )
  })

  it('1b · an attempt past its OWN declared expiry is unreadable', async () => {
    const out = await withSignInScope(pool, scope(STATE_STALE_EXPIRY), (tx) =>
      assembleSignIn(tx, callback(STATE_STALE_EXPIRY)),
    )
    assert.deepEqual(
      out,
      { ok: false, kind: 'signin', refusal: SIGN_IN_REFUSALS.signInAttemptAbsent },
      '`expires_at` is NOT NULL and was READ BY NOTHING until `0240`; this row ' +
        'expired a second before the test ran and was still consumable.',
    )
  })

  it('1c · and neither stale row was consumed — the expiry also refuses the WRITE', async () => {
    assert.equal(await consumedAt('sia_stale_ttl'), null, 'a stale attempt was CONSUMED')
    assert.equal(await consumedAt('sia_stale_expiry'), null, 'a stale attempt was CONSUMED')
    /* The raw consuming write, round `assembleSignIn()`, as the app role. */
    const n = await withSignInScope(pool, scope(STATE_STALE_TTL), async (tx) =>
      (await tx.query('UPDATE tenant.sign_in_attempt SET consumed_at = now()')).rowCount,
    )
    assert.equal(
      n,
      0,
      'the consuming UPDATE reached a stale row. The term is a RESTRICTIVE ' +
        '`USING`, so it narrows the UPDATE as well as the SELECT — a writer ' +
        'that skipped the read could otherwise still burn or claim the row.',
    )
  })

  it('1d · the window in the policy is the window the code names — one constant, two homes', async () => {
    const rows = await asMigrator(async (q) =>
      (
        await q(
          `SELECT permissive, cmd, qual, with_check FROM pg_policies
            WHERE schemaname='tenant' AND tablename='sign_in_attempt'
              AND policyname='sign_in_attempt_unexpired_restrictive'`,
        )
      ).rows as Array<{ permissive: string; cmd: string; qual: string | null; with_check: string | null }>,
    )
    assert.equal(rows.length, 1, 'the expiry fence is gone')
    const p = rows[0]!
    assert.equal(p.permissive, 'RESTRICTIVE', 'the expiry term must be RESTRICTIVE so no later permissive policy can widen past it')
    assert.equal(p.cmd, 'ALL')
    const minutes = String(SIGN_IN_ATTEMPT_TTL_MINUTES).padStart(2, '0')
    assert.match(
      p.qual ?? '',
      new RegExp(`'00:${minutes}:00'::interval`),
      `the policy's window disagrees with SIGN_IN_ATTEMPT_TTL_MINUTES = ${SIGN_IN_ATTEMPT_TTL_MINUTES}. ` +
        'The database is the enforcement and the constant is the name; a drift ' +
        'between them is a window nobody chose. Deparsed: ' + String(p.qual),
    )
    assert.match(p.qual ?? '', /expires_at/, 'the declared expiry is no longer one of the two bounds')
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §2 — D6-7. THE RESTRICTIVE POLICY NAMES THE PERSON, NOT ONLY THE DOOR.
   * ═════════════════════════════════════════════════════════════════════ */

  it('2a · a FIFTH permissive policy cannot admit a person on the right door under a subject the scope never named', async () => {
    await asMigrator((q) =>
      q(`CREATE POLICY ${PROBE_POLICY} ON tenant."user" FOR INSERT WITH CHECK (true)`),
    )
    try {
      await assert.rejects(
        () =>
          withSignInScope(pool, scope(STATE_LIVE, { externalSubject: SUBJECT }), (tx) =>
            /* The RIGHT door and the RIGHT broker pair — so the FK and the
             * door half of the restrictive policy are both satisfied — and a
             * subject the scope did NOT name. */
            tx.query(MINT_PERSON, ['usr_wrong_subject', 'w@acme.invalid', DOOR, OTHER_SUBJECT, ISSUER, REF]),
          ),
        (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          assert.match(
            message,
            /user_signin_mint_restrictive/,
            'refused, and NOT by the restrictive policy. PostgreSQL names a policy ' +
              'only when a RESTRICTIVE one fails, so an unnamed refusal means the ' +
              `probe did not admit the row and this arm proves nothing. Refused with: ${message}`,
          )
          return true
        },
        'A PERSON WAS MINTED UNDER A SUBJECT THE SIGN-IN SCOPE NEVER NAMED. Before ' +
          '`0241` this INSERT LANDED (rowCount 1): `user_signin_mint_restrictive` ' +
          'compared the broker pair alone, so any permissive policy admitting the ' +
          'row was enough. D6-7 is the owner\'s ruling that the restrictive layer ' +
          'carries the subject too.',
      )
    } finally {
      await asMigrator((q) => q(`DROP POLICY IF EXISTS ${PROBE_POLICY} ON tenant."user"`))
    }
  })

  it('2b · ANTI-VACUITY — the subject the scope names still mints', async () => {
    const n = await withSignInScope(pool, scope(STATE_LIVE, { externalSubject: SUBJECT }), async (tx) =>
      (await tx.query(MINT_PERSON, ['usr_right_subject', 'r@acme.invalid', DOOR, SUBJECT, ISSUER, REF])).rowCount,
    )
    assert.equal(n, 1, 'the RIGHT subject on the RIGHT door was refused — the new term refuses everything')
  })

  it('2c · a scope that names NO subject mints nobody, even with a permissive probe installed', async () => {
    await asMigrator((q) =>
      q(`CREATE POLICY ${PROBE_POLICY} ON tenant."user" FOR INSERT WITH CHECK (true)`),
    )
    try {
      await assert.rejects(
        () =>
          withSignInScope(pool, scope(STATE_LIVE), (tx) =>
            tx.query(MINT_PERSON, ['usr_no_subject', 'n@acme.invalid', DOOR, OTHER_SUBJECT, ISSUER, REF]),
          ),
        /user_signin_mint_restrictive/,
        'a sign-in scope that named no subject minted a person. G100: deny on NULL.',
      )
    } finally {
      await asMigrator((q) => q(`DROP POLICY IF EXISTS ${PROBE_POLICY} ON tenant."user"`))
    }
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §3 — THE RECURSION, RE-MEASURED.
   * ═════════════════════════════════════════════════════════════════════ */

  it('3 · no scope that touches tenant."user" recurses — session, sign-in, tenant', async () => {
    const session = await withSessionScope(pool, SESSION_DIGEST, async (tx) =>
      (await tx.query(`SELECT id FROM tenant."user"`)).rows as Array<{ id: string }>,
    )
    assert.deepEqual(
      session.map((r) => r.id),
      [MEI],
      'the session-scope read of the person changed. `resolveSubject()` reads ' +
        'this table on EVERY request; a `USING` on the restrictive policy is the ' +
        'measured AUTHENTICATION OUTAGE `0200` §6 records, and a subquery is the ' +
        'measured RECURSION S1 recorded.',
    )
    const signin = await withSignInScope(pool, scope(STATE_LIVE, { externalSubject: SUBJECT }), async (tx) =>
      (await tx.query(`SELECT id FROM tenant."user"`)).rows as Array<{ id: string }>,
    )
    assert.deepEqual(signin.map((r) => r.id), ['usr_right_subject'])
    const tenant = await withTenantScope(pool, ACME, async (tx) =>
      (await tx.query(`SELECT id FROM tenant."user"`)).rows,
    )
    assert.ok(Array.isArray(tenant), 'the tenant-scope read did not complete')
  })

  it('3b · the restrictive policy reads only the row\'s own columns — no subquery, no USING', async () => {
    const rows = await asMigrator(async (q) =>
      (
        await q(
          `SELECT qual, with_check FROM pg_policies
            WHERE schemaname='tenant' AND tablename='user'
              AND policyname='user_signin_mint_restrictive'`,
        )
      ).rows as Array<{ qual: string | null; with_check: string | null }>,
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.qual, null, 'the restrictive policy grew a USING — the measured authentication outage')
    const check = rows[0]!.with_check ?? ''
    assert.match(check, /external_subject/, 'the subject term is gone from the restrictive WITH CHECK')
    assert.match(check, /broker_issuer/)
    assert.match(check, /broker_ref/)
    assert.doesNotMatch(check, /SELECT/i, 'the restrictive WITH CHECK subqueries a table — S1 measured that as infinite recursion')
  })

  /* ═════════════════════════════════════════════════════════════════════ *
   * §4 — THE CENSUS. A fifth policy is a red gate, not a silent widening.
   * ═════════════════════════════════════════════════════════════════════ */

  it('4 · tenant."user" and tenant.sign_in_attempt carry EXACTLY the policies argued for', async () => {
    const rows = await asMigrator(async (q) =>
      (
        await q(
          `SELECT tablename, policyname, permissive, cmd FROM pg_policies
            WHERE schemaname='tenant' AND tablename IN ('user','sign_in_attempt')
            ORDER BY tablename, policyname`,
        )
      ).rows as Array<{ tablename: string; policyname: string; permissive: string; cmd: string }>,
    )
    assert.deepEqual(
      rows.map((r) => `${r.tablename}:${r.policyname}:${r.permissive}:${r.cmd}`),
      [
        /* G2541/G2545 (1 Oct 2026) — `0290`'s WRITE path onto the replay key,
           arriving with its argument: the owner's "INSERT-only grant on
           sign_in_attempt with a restrictive WITH CHECK". Restrictive and
           FOR INSERT, so it only ever NARROWS the one write it governs. */
        'sign_in_attempt:sign_in_attempt_begin_restrictive:RESTRICTIVE:INSERT',
        /* G2549/G2763 (2 Oct 2026) — `0360` pins the begun row to the scope's
           REGISTRY-RESOLVED host. Restrictive and FOR INSERT: it narrows the one
           write `0290` already governs and opens no read or write path. */
        'sign_in_attempt:sign_in_attempt_begun_host_restrictive:RESTRICTIVE:INSERT',
        'sign_in_attempt:sign_in_attempt_rls:PERMISSIVE:ALL',
        'sign_in_attempt:sign_in_attempt_unexpired_restrictive:RESTRICTIVE:ALL',
        /* ✅ 4 Oct 2026 — G3886, THE OWNER'S C3-05 RULING (*"Narrow name-only
         * read …"*). A READ path onto the directory, argued on
         * `db/migrations/0520`: `FOR SELECT`, `TO reconcile_name_reader` ALONE
         * (a role holding two columns, which no request role can become), and
         * it admits a row only inside an act carrying an invariant 10 record
         * whose actor and whose named person are both live members — a sign-in
         * scope has no record and reads nothing through it. */
        'user:user_co_member_name_rls:PERMISSIVE:SELECT',
        'user:user_directory_rls:PERMISSIVE:ALL',
        /* ✅ 1 Oct 2026 — G2624, THE OWNER'S RULING (G447 for partners). A READ
         * path onto the directory, argued on `db/migrations/0321` §1: `FOR
         * SELECT` only, so it is no WRITE path onto anything (G1982), and it
         * admits a row only inside an act carrying a `view_partner_staff`
         * record for the person's own firm — a sign-in scope has no record and
         * reads nothing through it. */
        'user:user_partner_directory_rls:PERMISSIVE:SELECT',
        'user:user_rls:PERMISSIVE:ALL',
        'user:user_signin_mint_restrictive:RESTRICTIVE:ALL',
        'user:user_signin_rls:PERMISSIVE:ALL',
      ],
      'THE POLICY SET ON A SIGN-IN TABLE MOVED. D6-7 (b), taken by the owner ' +
        'alongside (a): a policy added here is a READ or WRITE path onto the ' +
        'directory or the replay key, and it must arrive with an argument and a ' +
        'deliberate edit to this list — not as a silent widening the restrictive ' +
        'layer is left to catch alone.',
    )
  })
})

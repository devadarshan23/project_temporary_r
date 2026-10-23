/**
 * `email_verified` UPGRADES, AND ONLY UPGRADES — `db/migrations/0400` and the
 * upgrade arm of `mintFederatedSession()`. G2941–G2946, 2 Oct 2026.
 *
 * THE OWNER'S RULING (G2941, answering G2908), verbatim: *"Yes, upgrade-only:
 * a column-level UPDATE that only ever sets tenant."user".email_verified
 * false→true, only inside a sign-in scope, only from a verified token for that
 * same subject."*
 *
 * 🛑 THE REDS THE BRIEF NAMED, EACH WITNESSED HERE:
 *
 *   §2  true → false            refused by the TRIGGER (and true → true)
 *   §3  another column          refused by the GRANT, and — with the grant
 *                               deliberately widened — by the TRIGGER
 *   §4  another subject's row   0 rows: not visible in this sign-in scope
 *   §5  outside a sign-in scope refused in a SESSION scope and a TENANT scope
 *   §6  unverified token        no proof in the transaction → refused BARE,
 *                               and the writer upgrades nothing
 *
 * and the inversion: a previously-unverified person REDEEMS after upgrading
 * is `tests/db/partner-invitation-redemption.test.ts` §1c, where G2908's own
 * assertion stood.
 *
 * §1 is the honest row, BARE, so every refusal below is a refusal of a term
 * and not of everything. §8 cuts the trigger and watches a downgrade commit,
 * because *"a belt that passes with the braces cut is not evidence about the
 * braces"* (G2638).
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { withSignInScope } from '../../db/signin-scope.ts'
import type { SessionHandleDigest } from '../../model/domain.ts'
import type { SessionId, UserId } from '../../model/kernel.ts'
import {
  mintFederatedSession,
  type MintFederatedSessionInput,
} from '../../server/data-plane/session-mint-store.ts'
import { DOOR_NW, PARTNERS_HOST, asMigrator, digestOf, seedPartnerPortal } from './partner-fixture.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_EMAIL_UPGRADE_DB_NAME'] ?? runScopedName('reconcile_email_upgrade_test')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the email_verified upgrade suite', probe)

const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_W5'
const REF = 'northwind-okta'
const CHALLENGE = '11112222333344445555666677778888111122223333444455556666777788' as SessionHandleDigest

let pool: TenantPool
let seq = 0

function hex(prefix: number): string {
  return (prefix.toString(16).padStart(8, '0') + 'cd'.repeat(28)).slice(0, 64)
}

/** Sign a person in at Northwind's door, for real, through the production writer. */
async function signIn(
  subject: string,
  email: string,
  overrides: Partial<MintFederatedSessionInput> = {},
): Promise<{ out: Awaited<ReturnType<typeof mintFederatedSession>>; userId: string; handle: string }> {
  seq += 1
  const state = hex(0x6100 + seq)
  const handle = `sh_emv_${seq}_${'0'.repeat(26)}`
  const userId = `usr_emv_${seq}`
  await asMigrator(
    `INSERT INTO tenant.sign_in_attempt
       (id, handle_digest, connection_id, challenge_digest, started_at, expires_at, consumed_at)
     VALUES ($1, $2, $3, $4, now(), now() + interval '10 minutes', NULL)`,
    [`sia_emv_${seq}`, state, DOOR_NW, CHALLENGE],
  )
  const out = await mintFederatedSession(pool, {
    brokerIssuer: ISSUER,
    brokerRef: REF,
    stateDigest: state as SessionHandleDigest,
    externalSubject: subject,
    callback: {
      handleDigest: state as SessionHandleDigest,
      connectionId: DOOR_NW as never,
      challengeDigest: CHALLENGE,
    },
    claims: { sub: subject, email, name: `Person ${seq}` },
    emailVerified: false,
    newUserId: userId as UserId,
    newSessionId: `ses_emv_${seq}` as SessionId,
    newHandleDigest: digestOf(handle) as SessionHandleDigest,
    issuedHost: PARTNERS_HOST,
    bounds: { maxLifetimeSeconds: 43200, maxIdleSeconds: 1800 },
    ...overrides,
  })
  /* `provisioned` is NOT asserted: §6c signs the same subject in twice. */
  assert.equal(out.ok, true, JSON.stringify(out))
  return { out, userId: out.ok ? (out.session.userId as string) : userId, handle }
}

async function storedFlag(userId: string): Promise<unknown> {
  return (await asMigrator(`SELECT email_verified FROM tenant."user" WHERE id = $1`, [userId]))[0]?.['email_verified']
}

/**
 * One bare statement as the APP ROLE inside the subject's own sign-in scope,
 * optionally with a proof GUC, always rolled back. Answers the row count or
 * the error message.
 */
async function bareInSignIn(subject: string, sql: string, proved: string | null): Promise<number | string> {
  return withSignInScope(
    pool,
    { brokerIssuer: ISSUER, brokerRef: REF, stateDigest: hex(0x6fff), externalSubject: subject },
    async (tx) => {
      if (proved !== null) await tx.query(`SELECT set_config('app.proved_email', $1, true)`, [proved])
      await tx.query('SAVEPOINT b')
      try {
        return (await tx.query(sql)).rowCount ?? 0
      } catch (e) {
        return (e as Error).message
      } finally {
        await tx.query('ROLLBACK TO SAVEPOINT b')
      }
    },
  )
}

const UPGRADE = `UPDATE tenant."user" SET email_verified = true`

describe('email_verified upgrades and only upgrades (0400)', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await seedPartnerPortal()
    await asMigrator(
      `UPDATE tenant.identity_connection SET email_claim = 'email', name_claim = 'name' WHERE id = $1`,
      [DOOR_NW],
    )
    pool = await createAppPool(2)
  })
  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  it('0 · the catalogue: ONE column grantable for UPDATE, one invoker-rights trigger, and NO new policy — the scope fence is 0241’s `FOR ALL`', async () => {
    const cols = await asMigrator(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE table_schema = 'tenant' AND table_name = 'user'
          AND grantee = 'tenant_rw' AND privilege_type = 'UPDATE' ORDER BY column_name`,
    )
    assert.deepEqual(cols.map((c) => c['column_name']), ['email_verified'],
      'the app role may UPDATE a column of tenant."user" other than email_verified')
    const table = await asMigrator(
      `SELECT has_table_privilege('tenant_rw', 'tenant."user"', 'UPDATE') AS u,
              has_table_privilege('tenant_rw', 'tenant."user"', 'DELETE') AS d`,
    )
    assert.deepEqual(table, [{ u: false, d: false }], 'a TABLE-level UPDATE or a DELETE was granted')
    const fn = await asMigrator(`SELECT prosecdef FROM pg_proc WHERE proname = 'user_email_verified_upgrade_only'`)
    assert.deepEqual(fn, [{ prosecdef: false }], 'the trigger function runs with its definer’s rights (G160)')
    /* 0400 term (3): the sign-in-scope requirement IS this policy, because it
     * is `FOR ALL` and its WITH CHECK therefore governs UPDATE. Narrowed to
     * `FOR INSERT`, the upgrade would lose its scope fence silently. */
    const scope = await asMigrator(
      `SELECT cmd, permissive FROM pg_policies WHERE schemaname = 'tenant' AND policyname = 'user_signin_mint_restrictive'`,
    )
    assert.deepEqual(scope, [{ cmd: 'ALL', permissive: 'RESTRICTIVE' }])
    const policies = await asMigrator(
      `SELECT policyname FROM pg_policies WHERE schemaname = 'tenant' AND tablename = 'user' ORDER BY policyname`,
    )
    assert.deepEqual(policies.map((p) => p['policyname']), [
      /* G3886 (`0520`, the owner's C3-05 ruling) — a READ policy `TO
         reconcile_name_reader` alone; it is not a scope fence, so it is no
         second spelling of `0241`'s. */
      'user_co_member_name_rls',
      'user_directory_rls',
      'user_partner_directory_rls',
      'user_rls',
      'user_signin_mint_restrictive',
      'user_signin_rls',
    ], '0400 adds no policy — a second spelling of 0241’s scope fence is §5.3')
  })

  it('1 · the HONEST upgrade, bare: the subject’s own row, in its own sign-in scope, proved for its stored address (any case) — and no recursion', async () => {
    const { userId } = await signIn('sub-honest', 'Honest@Northwind.invalid')
    assert.equal(await storedFlag(userId), false)
    const moved = await withSignInScope(
      pool,
      { brokerIssuer: ISSUER, brokerRef: REF, stateDigest: hex(0x6ffe), externalSubject: 'sub-honest' },
      async (tx) => {
        await tx.query(`SELECT set_config('app.proved_email', $1, true)`, ['honest@NORTHWIND.invalid'])
        const r = await tx.query(UPGRADE)
        /* RECURSION, MEASURED: every table the sign-in touches, read after the
         * write, in the same transaction. A cycle is 42P17 on the first. */
        for (const t of ['tenant."user"', 'tenant.identity_connection', 'tenant.session',
          'tenant.partner_invitation', 'tenant.partner_role_assignment', 'tenant.sign_in_attempt']) {
          await tx.query(`SELECT count(*) FROM ${t}`)
        }
        return r.rowCount
      },
    )
    assert.equal(moved, 1, 'the honest upgrade was refused — every refusal below would then prove nothing')
    assert.equal(await storedFlag(userId), true)
  })

  it('2 · RED — true → false is refused by the TRIGGER, and so is true → true', async () => {
    const { userId } = await signIn('sub-down', 'down@northwind.invalid')
    await asMigrator(`UPDATE tenant."user" SET email_verified = true WHERE id = $1`, [userId])
    assert.match(String(await bareInSignIn('sub-down', `UPDATE tenant."user" SET email_verified = false`, 'down@northwind.invalid')),
      /user_email_verified_upgrade_only/, 'a proved address was DOWNGRADED by the app role')
    assert.match(String(await bareInSignIn('sub-down', UPGRADE, 'down@northwind.invalid')),
      /user_email_verified_upgrade_only/, 'a true → true rewrite passed — the transition is not false → true only')
    assert.equal(await storedFlag(userId), true)
  })

  it('3 · RED — another column: refused by the GRANT; and with the grant deliberately WIDENED, refused by the TRIGGER', async () => {
    const { userId } = await signIn('sub-col', 'col@northwind.invalid')
    assert.match(String(await bareInSignIn('sub-col', `UPDATE tenant."user" SET display_name = 'Mallory'`, 'col@northwind.invalid')),
      /permission denied/, 'the app role renamed a person')
    assert.match(String(await bareInSignIn('sub-col', `UPDATE tenant."user" SET email_verified = true, status = 'disabled'`, 'col@northwind.invalid')),
      /permission denied/, 'an upgrade carried a second column past the grant')
    /* The trigger's half, witnessed rather than assumed: widen the grant the
     * way a later commit might, and the property must survive it. */
    await asMigrator(`GRANT UPDATE (display_name, email) ON tenant."user" TO tenant_rw`)
    try {
      assert.match(String(await bareInSignIn('sub-col', `UPDATE tenant."user" SET email_verified = true, display_name = 'Mallory'`, 'col@northwind.invalid')),
        /user_update_touches_other_column/, 'with the grant widened, an upgrade carried a rename')
      assert.match(String(await bareInSignIn('sub-col', `UPDATE tenant."user" SET email_verified = true, email = 'mallory@northwind.invalid'`, 'mallory@northwind.invalid')),
        /user_update_touches_other_column/, 'with the grant widened, the address was rewritten to the one the token proved')
    } finally {
      await asMigrator(`REVOKE UPDATE (display_name, email) ON tenant."user" FROM tenant_rw`)
    }
    assert.equal(await storedFlag(userId), false)
  })

  it('4 · RED — another subject’s row: invisible in this sign-in scope, so 0 rows, even proving THEIR address', async () => {
    const { userId: victim } = await signIn('sub-victim', 'victim@northwind.invalid')
    await signIn('sub-attacker', 'attacker@northwind.invalid')
    assert.equal(
      await bareInSignIn('sub-attacker', `UPDATE tenant."user" SET email_verified = true WHERE id = '${victim}'`, 'victim@northwind.invalid'),
      0, 'a sign-in upgraded a person it does not name')
    assert.equal(await storedFlag(victim), false)
  })

  it('5 · RED — outside a sign-in scope: refused in the person’s own SESSION scope and in a TENANT scope, proof or no proof', async () => {
    const { userId, handle } = await signIn('sub-session', 'session@northwind.invalid')
    const inSession = await withSessionScope(pool, digestOf(handle), async (tx) => {
      /* The row IS visible here (`0009`'s `user_rls`): this is not a 0-row pass. */
      const seen = (await tx.query(`SELECT count(*)::int AS n FROM tenant."user"`)).rows[0] as { n: number }
      assert.equal(seen.n, 1, 'the session’s own person is not visible — the refusal below would be vacuous')
      await tx.query(`SELECT set_config('app.proved_email', $1, true)`, ['session@northwind.invalid'])
      await tx.query('SAVEPOINT b')
      try {
        return String((await tx.query(UPGRADE)).rowCount)
      } catch (e) {
        return (e as Error).message
      } finally {
        await tx.query('ROLLBACK TO SAVEPOINT b')
      }
    })
    assert.match(inSession, /row-level security/, `a SESSION scope upgraded its own person: ${inSession}`)
    const inTenant = await withTenantScope(pool, 'ten_acme', async (tx) => {
      await tx.query(`SELECT set_config('app.proved_email', $1, true)`, ['session@northwind.invalid'])
      return (await tx.query(UPGRADE)).rowCount
    })
    assert.equal(inTenant, 0)
    assert.equal(await storedFlag(userId), false)
  })

  it('6 · RED — no verified token: no proof refused BARE, a proof of ANOTHER address refused BARE, and the writer upgrades nothing', async () => {
    const { userId } = await signIn('sub-unproved', 'unproved@northwind.invalid')
    assert.match(String(await bareInSignIn('sub-unproved', UPGRADE, null)),
      /user_email_verified_unproved/, 'an upgrade with no proof in the transaction passed')
    assert.match(String(await bareInSignIn('sub-unproved', UPGRADE, 'someone-else@northwind.invalid')),
      /user_email_verified_unproved/, 'a proof of a DIFFERENT address upgraded the stored one (G2944)')

    /* The writer: a later token that does NOT prove the address. */
    const again = await signIn('sub-unproved', 'unproved@northwind.invalid', { emailVerified: false })
    assert.ok(again.out.ok && again.out.emailUpgraded === false)
    assert.equal(await storedFlag(userId), false)
  })

  it('6b · a flag that attests a DIFFERENT claim proves nothing: a door projecting `upn` upgrades nothing', async () => {
    const { userId } = await signIn('sub-upn', 'upn@northwind.invalid')
    await asMigrator(`UPDATE tenant.identity_connection SET email_claim = 'upn' WHERE id = $1`, [DOOR_NW])
    try {
      const again = await signIn('sub-upn', 'unused@northwind.invalid', {
        emailVerified: true,
        claims: { sub: 'sub-upn', upn: 'upn@northwind.invalid', name: 'Upn' },
      })
      assert.ok(again.out.ok && again.out.emailUpgraded === false, JSON.stringify(again.out))
    } finally {
      await asMigrator(`UPDATE tenant.identity_connection SET email_claim = 'email' WHERE id = $1`, [DOOR_NW])
    }
    assert.equal(await storedFlag(userId), false)
  })

  it('6c · a VERIFIED token for a DIFFERENT address than the stored one signs in and upgrades nothing (G2944) — and the matching one does', async () => {
    const { userId } = await signIn('sub-moved', 'old@northwind.invalid')
    const moved = await signIn('sub-moved', 'new@northwind.invalid', { emailVerified: true })
    assert.ok(moved.out.ok && moved.out.emailUpgraded === false, 'a proof of the NEW address upgraded the OLD one')
    assert.equal(await storedFlag(userId), false)
    const same = await signIn('sub-moved', 'OLD@northwind.invalid', { emailVerified: true })
    assert.ok(same.out.ok && same.out.emailUpgraded === true && !same.out.provisioned)
    assert.equal(await storedFlag(userId), true)
    /* And a further verified sign-in is not a second write: true stays true. */
    const thrice = await signIn('sub-moved', 'old@northwind.invalid', { emailVerified: true })
    assert.ok(thrice.out.ok && thrice.out.emailUpgraded === false)
  })

  it('7 · a newly PROVISIONED person is written once and never “upgraded” in the same mint', async () => {
    const fresh = await signIn('sub-fresh', 'fresh@northwind.invalid', { emailVerified: true })
    assert.ok(fresh.out.ok && fresh.out.provisioned && fresh.out.emailUpgraded === false)
    assert.equal(await storedFlag(fresh.userId), true)
  })

  it('8 · BRACES CUT: with the trigger disabled, the app role’s DOWNGRADE commits — so §2’s red is the trigger’s, and a migrator is outside it by design (G2945)', async () => {
    const { userId } = await signIn('sub-cut', 'cut@northwind.invalid')
    await asMigrator(`UPDATE tenant."user" SET email_verified = true WHERE id = $1`, [userId])
    await asMigrator(`ALTER TABLE tenant."user" DISABLE TRIGGER user_email_verified_upgrade_only`)
    try {
      assert.equal(await bareInSignIn('sub-cut', `UPDATE tenant."user" SET email_verified = false`, null), 1,
        'with the trigger cut the downgrade was STILL refused — §2 is not evidence about the trigger')
    } finally {
      await asMigrator(`ALTER TABLE tenant."user" ENABLE TRIGGER user_email_verified_upgrade_only`)
    }
    /* The migrator, with the trigger live: fixtures set the fact both ways. */
    await asMigrator(`UPDATE tenant."user" SET email_verified = false WHERE id = $1`, [userId])
    assert.equal(await storedFlag(userId), false)
  })
})

/**
 * A PARTNER INVITATION, REDEEMED AT FIRST SIGN-IN — `db/migrations/0370`,
 * `server/data-plane/partner-redemption-store.ts`, and the redemption arm of
 * `mintFederatedSession()`. G2801–G2816, 2 Oct 2026.
 *
 * THE OWNER'S RULING, verbatim: *"Drop `name` from invitePartnerPerson's 201
 * (filled at redemption). Then mount it and build invitation redemption at
 * first sign-in."*
 *
 * Every arm here signs a person in for real — a `sign_in_attempt` row, the
 * production `mintFederatedSession()`, `withSignInScope()` — because a
 * redemption proven against a hand-set GUC would be a proof about the GUC.
 *
 * 🛑 THE REDS THE BRIEF NAMED, EACH WITNESSED HERE AND EACH LEAVING NO
 *    ASSIGNMENT BEHIND IT:
 *
 *   §2  EXPIRED          the offer's clock ran out        → `expired`
 *   §3  REDEEMED TWICE   a second account, same address   → `already_redeemed`
 *   §4  WRONG DOOR       the address, at another firm's door → `none`
 *   §4b WRONG EMAIL      this firm's door, another address   → `none`
 *   §5  INVITER LOST IT  the inviter's role revoked       → `inviter_lacks_verb`
 *   §5b SELF             the redeemer IS the inviter      → `self`
 *
 *   §9  UNPROVED ADDRESS  another person's address, `email_verified` false
 *                         → `email_unverified` (G2901, closing G2816)
 *   §1d UNPROVED, AGAIN   a later token that proves nothing upgrades nothing
 *                         → `email_unverified` (G2941 keeps G2901)
 *
 * §10 is G2903 (closing G2811): a lapsed offer no longer blocks re-inviting
 * its address, a standing one still does — including against a concurrent
 * writer — and single use is untouched.
 *
 * and §7 drives the fence BARE — the INSERT itself, in a real sign-in
 * transaction, with each term broken in turn — because a writer that
 * pre-filtered would pass this suite with the trigger cut (G2638's lesson:
 * *"a belt that passes with the braces cut is not evidence about the braces"*).
 *
 * §8 keeps the two RECURSIONS that decided `0370`'s shape RUNNABLE rather than
 * narrated: the `WITH CHECK` the trigger replaced, and the invitation-keyed
 * policy the GUCs replaced, each re-created inside a rolled-back transaction
 * and required to raise 42P17.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget, adminUser, dbTarget, dbSsl } from '../../db/env.ts'
import { loadPg } from '../../db/pg.ts'
import { migratorClient, resetSchema, seedTwoTenants } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { withSignInScope } from '../../db/signin-scope.ts'
import { CAPABILITIES } from '../../model/access.ts'
import type { SessionHandleDigest } from '../../model/domain.ts'
import type { SessionId, UserId } from '../../model/kernel.ts'
import {
  PARTNER_INVITATION_OFFER_SECONDS,
  PARTNER_INVITED_ROLE_SECONDS,
  PARTNER_REDEMPTION_REFUSALS,
} from '../../model/partner-portal.ts'
import {
  mintFederatedSession,
  type MintFederatedSessionInput,
} from '../../server/data-plane/session-mint-store.ts'
import { writePartnerInvitation } from '../../server/data-plane/partner-staff-store.ts'
import { readPartnerHeld } from '../../server/data-plane/identity.ts'
import {
  ANA,
  CONTOSO,
  DOOR_CO,
  DOOR_NW,
  HANDLES,
  NORTHWIND,
  PARTNERS_HOST,
  asMigrator,
  digestOf,
  seedPartnerPortal,
} from './partner-fixture.ts'
import { inPartnerAct } from './partner-act.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PARTNER_REDEMPTION_DB_NAME'] ?? runScopedName('reconcile_partner_redemption_test')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the partner invitation redemption suite', probe)

const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_W5'
const DOORS = {
  northwind: { id: DOOR_NW, ref: 'northwind-okta' },
  contoso: { id: DOOR_CO, ref: 'contoso-entra' },
} as const
const CHALLENGE = '11112222333344445555666677778888111122223333444455556666777788' as SessionHandleDigest

const ana = { handle: HANDLES.ana, user: ANA, firm: NORTHWIND }

let pool: TenantPool
let seq = 0

/** 64 hex characters, distinct per call, no real preimage. */
function hex(prefix: number): string {
  return (prefix.toString(16).padStart(8, '0') + 'ab'.repeat(28)).slice(0, 64)
}

/**
 * Sign one person in at one door, for real. Returns the outcome, the user id
 * the person was (or would have been) minted under, and the raw handle so a
 * later step can act as them.
 */
async function signIn(
  door: keyof typeof DOORS,
  email: string,
  overrides: Partial<MintFederatedSessionInput> = {},
): Promise<{
  out: Awaited<ReturnType<typeof mintFederatedSession>>
  userId: string
  handle: string
}> {
  seq += 1
  const state = hex(0x5100 + seq)
  const handle = `sh_redeem_${seq}_${'0'.repeat(24)}`
  const userId = `usr_redeem_${seq}`
  await asMigrator(
    `INSERT INTO tenant.sign_in_attempt
       (id, handle_digest, connection_id, challenge_digest, started_at, expires_at, consumed_at)
     VALUES ($1, $2, $3, $4, now(), now() + interval '10 minutes', NULL)`,
    [`sia_redeem_${seq}`, state, DOORS[door].id, CHALLENGE],
  )
  const subject = `sub-redeem-${seq}`
  const out = await mintFederatedSession(pool, {
    brokerIssuer: ISSUER,
    brokerRef: DOORS[door].ref,
    stateDigest: state as SessionHandleDigest,
    externalSubject: subject,
    callback: {
      handleDigest: state as SessionHandleDigest,
      connectionId: DOORS[door].id as never,
      challengeDigest: CHALLENGE,
    },
    claims: { sub: subject, email, name: `Person ${seq}` },
    emailVerified: true,
    newUserId: userId as UserId,
    newSessionId: `ses_redeem_${seq}` as SessionId,
    newHandleDigest: digestOf(handle) as SessionHandleDigest,
    issuedHost: PARTNERS_HOST,
    bounds: { maxLifetimeSeconds: 43200, maxIdleSeconds: 1800 },
    ...overrides,
  })
  return { out, userId, handle }
}

async function assignmentsOf(userId: string): Promise<Array<Record<string, unknown>>> {
  return asMigrator(
    `SELECT id, partner_id, role_id, role_version, granted_by, expires_at, invitation_id
       FROM tenant.partner_role_assignment WHERE user_id = $1`,
    [userId],
  )
}

/** ANA, through the PRODUCTION writer, in a real manage act. */
async function anaInvites(email: string, role: 'partner_user' | 'partner_administrator' = 'partner_user'): Promise<string> {
  const out = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, (tx, g) =>
    writePartnerInvitation(tx, g, { email, role }),
  )
  assert.ok(out.ok, `the invitation writer refused: ${JSON.stringify(out)}`)
  return out.invitation.id
}

/** A raw invitation row, as the migrator — for the arms the writer refuses to make. */
async function seedInvitation(row: {
  id: string
  email: string
  invitedBy: string
  invitedAgo?: string
  offer?: string
}): Promise<void> {
  const ago = row.invitedAgo ?? '0 seconds'
  await asMigrator(
    `INSERT INTO tenant.partner_invitation
       (id, partner_id, email, role_id, role_version, invited_by, invited_at,
        expires_at, assignment_expires_at, authorization_id)
     VALUES ($1, $2, $3, 'prl_nw_user', 1, $4, now() - $5::interval,
             now() - $5::interval + $6::interval,
             now() - $5::interval + interval '60 days', 'azg_seeded')`,
    [row.id, NORTHWIND, row.email, row.invitedBy, ago, row.offer ?? '14 days'],
  )
}

describe('a partner invitation, redeemed at first sign-in (0370)', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await seedPartnerPortal()
    await asMigrator(
      `UPDATE tenant.identity_connection SET email_claim = 'email', name_claim = 'name'
        WHERE id IN ($1, $2)`,
      [DOOR_NW, DOOR_CO],
    )
    pool = await createAppPool(2)
  })
  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  it('0 · NO RECURSION — every table 0370 touches reads inside a sign-in transaction with the GUCs set, and inside both staff acts', async () => {
    const tables = [
      'tenant."user"',
      'tenant.identity_connection',
      'tenant.session',
      'tenant.partner_invitation',
      'tenant.partner_role_assignment',
      'tenant.partner_role',
      'tenant.partner_role_capability',
      'tenant.partner_authorization_grant',
    ]
    await withSignInScope(
      pool,
      { brokerIssuer: ISSUER, brokerRef: 'northwind-okta', stateDigest: hex(0x50ff), externalSubject: 'nobody', sessionRef: digestOf(HANDLES.ana) },
      async (tx) => {
        await tx.query(`SELECT set_config('app.redeeming_partner', $1, true)`, [NORTHWIND])
        await tx.query(`SELECT set_config('app.redeeming_inviter', $1, true)`, [ANA])
        for (const t of tables) {
          await assert.doesNotReject(tx.query(`SELECT count(*) FROM ${t}`), `reading ${t} in a redemption transaction raised`)
        }
      },
    )
    for (const verb of [CAPABILITIES.viewPartnerStaff, CAPABILITIES.managePartnerStaff]) {
      await inPartnerAct(pool, ana, verb, async (tx) => {
        for (const t of tables) await tx.query(`SELECT count(*) FROM ${t}`)
      })
    }
  })

  it('1 · REDEEMED: an invitation becomes a portal role at first sign-in, in the same transaction, and the role is usable', async () => {
    const invitationId = await anaInvites('erin@northwind.invalid')
    const { out, userId, handle } = await signIn('northwind', 'Erin@Northwind.invalid')
    assert.equal(out.ok, true, JSON.stringify(out))
    if (!out.ok) return
    assert.equal(out.provisioned, true)
    assert.equal(out.redemption?.kind, 'redeemed', `the invitation was not redeemed: ${JSON.stringify(out.redemption)}`)

    const rows = await assignmentsOf(userId)
    assert.equal(rows.length, 1)
    const inv = await asMigrator(
      `SELECT invited_by, role_id, role_version, assignment_expires_at FROM tenant.partner_invitation WHERE id = $1`,
      [invitationId],
    )
    assert.equal(rows[0]?.['invitation_id'], invitationId)
    assert.equal(rows[0]?.['granted_by'], ANA, 'the assignment does not name the inviter as its granter')
    assert.equal(rows[0]?.['role_id'], inv[0]?.['role_id'])
    assert.equal(
      (rows[0]?.['expires_at'] as Date).toISOString(),
      (inv[0]?.['assignment_expires_at'] as Date).toISOString(),
      'the role’s end was decided at redemption rather than copied from the offer',
    )

    /* THE ROLE IS LIVE FOR THE PERSON WHO NOW HOLDS IT: a session-scope read of
     * their own portal roles finds it, and a portal act on its verb is allowed. */
    const held = await withSessionScope(pool, digestOf(handle), (tx) => readPartnerHeld(tx))
    assert.ok(held.ok && held.partnerHeld.length === 1, JSON.stringify(held))
    const ref = await inPartnerAct(pool, { handle, user: userId, firm: NORTHWIND }, CAPABILITIES.viewDeals, async (_tx, g) => g.id)
    assert.match(String(ref), /^azg_/)
  })

  /* G2906 — THE OWNER'S RULING OF 2 Oct 2026, superseding G2810: *"Any
   * sign-in: open, unexpired invitations matching the VERIFIED email redeem at
   * the person's next sign-in (not only first), with the same fences."* This
   * section read *"a person who already exists redeems nothing — the ruling
   * names FIRST sign-in (G2810)"* and asserted `redemption: null`. */
  it('1b · an EXISTING person redeems at a LATER sign-in, and a further sign-in does not redeem again (G2906, G2907)', async () => {
    /* DORA signs in with nothing to redeem, and so EXISTS. */
    const first = await signIn('northwind', 'dora-later@northwind.invalid', { externalSubject: 'sub-dora-later' })
    assert.equal(first.out.ok, true, JSON.stringify(first.out))
    if (!first.out.ok) return
    assert.equal(first.out.provisioned, true)
    assert.deepEqual(first.out.redemption, { kind: 'none' })

    /* ANA invites her; at her NEXT sign-in — not a first one — it redeems. */
    const invitationId = await anaInvites('dora-later@northwind.invalid')
    const again = await signIn('northwind', 'dora-later@northwind.invalid', { externalSubject: 'sub-dora-later' })
    assert.equal(again.out.ok, true, JSON.stringify(again.out))
    if (!again.out.ok) return
    assert.equal(again.out.provisioned, false, 'the second sign-in provisioned a second Dora')
    assert.equal(again.out.redemption.kind, 'redeemed', `an existing person did not redeem: ${JSON.stringify(again.out.redemption)}`)
    const rows = await assignmentsOf(first.userId)
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.['invitation_id'], invitationId)

    /* AND A THIRD SIGN-IN DOES NOT DOUBLE-REDEEM — and answers `none`, not a
     * refusal, because the offer she redeemed is hers (G2907). */
    const third = await signIn('northwind', 'dora-later@northwind.invalid', { externalSubject: 'sub-dora-later' })
    assert.equal(third.out.ok, true)
    if (!third.out.ok) return
    assert.deepEqual(third.out.redemption, { kind: 'none' }, 'a redeemed offer was offered again to the person who redeemed it')
    assert.equal((await assignmentsOf(first.userId)).length, 1, 'one invitation conferred two assignments on one person')
  })

  /* ⚠️ §1c IS INVERTED BY G2941 — THE OWNER'S RULING OF 2 Oct 2026, answering
   * G2908. It read *"an EXISTING person whose address was never PROVED still
   * cannot redeem at a later sign-in (G2906 keeps G2901)"* and asserted
   * `emailUnverified` on a second sign-in whose token PROVED the address, with
   * the comment *"what is STORED is what the fence reads, and nothing updates
   * it (G2908)"*. `db/migrations/0400` is that update: a later verified token
   * upgrades the stored fact BEFORE redemption, in the same transaction, so
   * the person redeems. **G2901's fence is unchanged and still reads the
   * STORED fact** — §1d is the arm where nothing upgrades it. */
  it('1c · an EXISTING person whose address was never PROVED redeems once a later token PROVES it (G2941 inverts G2908)', async () => {
    const first = await signIn('northwind', 'ezra@northwind.invalid', { externalSubject: 'sub-ezra', emailVerified: false })
    assert.equal(first.out.ok && first.out.redemption.kind, 'none')
    assert.deepEqual(await asMigrator(`SELECT email_verified FROM tenant."user" WHERE id = $1`, [first.userId]), [{ email_verified: false }])
    const invitationId = await anaInvites('ezra@northwind.invalid')
    const again = await signIn('northwind', 'ezra@northwind.invalid', { externalSubject: 'sub-ezra', emailVerified: true })
    assert.equal(again.out.ok, true, JSON.stringify(again.out))
    if (!again.out.ok) return
    assert.equal(again.out.provisioned, false)
    assert.equal(again.out.emailUpgraded, true, 'a verified token proving the stored address did not upgrade it')
    assert.equal(again.out.redemption.kind, 'redeemed', `the upgraded person did not redeem: ${JSON.stringify(again.out.redemption)}`)
    const rows = await assignmentsOf(first.userId)
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.['invitation_id'], invitationId)
    assert.deepEqual(await asMigrator(`SELECT email_verified FROM tenant."user" WHERE id = $1`, [first.userId]), [{ email_verified: true }])
  })

  it('1d · RED — a later token that does NOT prove the address upgrades nothing, and the person still cannot redeem (G2941 keeps G2901)', async () => {
    const first = await signIn('northwind', 'ezra-two@northwind.invalid', { externalSubject: 'sub-ezra-two', emailVerified: false })
    assert.equal(first.out.ok && first.out.redemption.kind, 'none')
    await anaInvites('ezra-two@northwind.invalid')
    const again = await signIn('northwind', 'ezra-two@northwind.invalid', { externalSubject: 'sub-ezra-two', emailVerified: false })
    assert.equal(again.out.ok, true)
    if (!again.out.ok) return
    assert.equal(again.out.emailUpgraded, false)
    assert.deepEqual(again.out.redemption, { kind: 'refused', refusal: PARTNER_REDEMPTION_REFUSALS.emailUnverified })
    assert.deepEqual(await assignmentsOf(first.userId), [])
    assert.deepEqual(await asMigrator(`SELECT email_verified FROM tenant."user" WHERE id = $1`, [first.userId]), [{ email_verified: false }])
  })

  it('2 · RED — EXPIRED: an offer past its clock is refused BY NAME, and the person still signs in with no role', async () => {
    await seedInvitation({ id: 'pinv_expired', email: 'fay@northwind.invalid', invitedBy: ANA, invitedAgo: '15 days' })
    const { out, userId } = await signIn('northwind', 'fay@northwind.invalid')
    assert.equal(out.ok, true, 'a refused REDEMPTION refused the SIGN-IN — a stale offer became a lock-out')
    if (!out.ok) return
    assert.deepEqual(out.redemption, { kind: 'refused', refusal: PARTNER_REDEMPTION_REFUSALS.expired })
    assert.deepEqual(await assignmentsOf(userId), [])
  })

  it('3 · RED — REDEEMED TWICE: a second account at the same door with the same address gets nothing', async () => {
    await anaInvites('gail@northwind.invalid')
    const first = await signIn('northwind', 'gail@northwind.invalid')
    assert.equal(first.out.ok && first.out.redemption?.kind, 'redeemed')
    const second = await signIn('northwind', 'GAIL@northwind.invalid')
    assert.equal(second.out.ok, true)
    if (!second.out.ok) return
    assert.deepEqual(second.out.redemption, { kind: 'refused', refusal: PARTNER_REDEMPTION_REFUSALS.alreadyRedeemed })
    assert.deepEqual(await assignmentsOf(second.userId), [], 'one invitation conferred a role on two people')
  })

  it('4 · RED — WRONG DOOR: the invited address, signing in at ANOTHER firm’s door, sees no invitation', async () => {
    await anaInvites('hana@northwind.invalid')
    const { out, userId } = await signIn('contoso', 'hana@northwind.invalid')
    assert.equal(out.ok, true)
    if (!out.ok) return
    assert.deepEqual(out.redemption, { kind: 'none' }, 'a Northwind offer was visible at Contoso’s door')
    assert.deepEqual(await assignmentsOf(userId), [])
  })

  it('4b · RED — WRONG EMAIL: this firm’s door, an address nobody invited, sees no invitation', async () => {
    const { out, userId } = await signIn('northwind', 'ivo@northwind.invalid')
    assert.equal(out.ok, true)
    if (!out.ok) return
    assert.deepEqual(out.redemption, { kind: 'none' })
    assert.deepEqual(await assignmentsOf(userId), [])
    /* And the invitation that IS standing for somebody else stays unredeemed. */
    const open = await asMigrator(
      `SELECT count(*)::int AS n FROM tenant.partner_invitation i
        WHERE i.email = 'hana@northwind.invalid'
          AND NOT EXISTS (SELECT 1 FROM tenant.partner_role_assignment a WHERE a.invitation_id = i.id)`,
    )
    assert.equal(open[0]?.['n'], 1)
  })

  it('5 · RED — INVITER LOST THE ROLE: no-escalation is re-checked at redemption, not inherited from the offer', async () => {
    await anaInvites('jun@northwind.invalid')
    await asMigrator(`UPDATE tenant.partner_role_assignment SET revoked_at = now() WHERE id = 'pra_ana'`)
    try {
      const { out, userId } = await signIn('northwind', 'jun@northwind.invalid')
      assert.equal(out.ok, true)
      if (!out.ok) return
      assert.deepEqual(out.redemption, { kind: 'refused', refusal: PARTNER_REDEMPTION_REFUSALS.inviterLacksVerb })
      assert.deepEqual(await assignmentsOf(userId), [])
    } finally {
      await asMigrator(`UPDATE tenant.partner_role_assignment SET revoked_at = NULL WHERE id = 'pra_ana'`)
    }
  })

  it('5b · RED — SELF: an invitation whose inviter is the redeemer is refused by name', async () => {
    /* The writer cannot make this row (`0321` §5 term (c)); the migrator can,
     * and the fence must not rely on the writer having refused it. */
    const self = `usr_redeem_${seq + 1}`
    await seedInvitation({ id: 'pinv_self', email: 'kai@northwind.invalid', invitedBy: self })
    const { out, userId } = await signIn('northwind', 'kai@northwind.invalid')
    assert.equal(userId, self, 'the fixture predicted the wrong user id')
    assert.equal(out.ok, true)
    if (!out.ok) return
    assert.deepEqual(out.redemption, { kind: 'refused', refusal: PARTNER_REDEMPTION_REFUSALS.self })
    assert.deepEqual(await assignmentsOf(userId), [])
  })

  it('5c · RED — ROLE MOVED: the role invited into was re-versioned after the offer', async () => {
    await anaInvites('lena@northwind.invalid')
    await asMigrator(`UPDATE tenant.partner_role SET version = 2 WHERE id = 'prl_nw_user'`)
    await asMigrator(`UPDATE tenant.partner_role_assignment SET role_version = 2 WHERE role_id = 'prl_nw_user'`)
    try {
      const { out } = await signIn('northwind', 'lena@northwind.invalid')
      assert.ok(out.ok)
      if (!out.ok) return
      assert.deepEqual(out.redemption, { kind: 'refused', refusal: PARTNER_REDEMPTION_REFUSALS.roleMoved })
    } finally {
      await asMigrator(`UPDATE tenant.partner_role SET version = 1 WHERE id = 'prl_nw_user'`)
      await asMigrator(`UPDATE tenant.partner_role_assignment SET role_version = 1 WHERE role_id = 'prl_nw_user'`)
    }
  })

  /* ================================================================== *
   * §6 · THE NUMBERS ARE MIRRORED, AND THE MIRROR IS THIS TEST (G2803).
   * ================================================================== */

  it('6 · the CHECKs’ intervals are the model’s constants, and a writer cannot exceed them', async () => {
    const defs = await asMigrator(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'tenant.partner_invitation'::regclass AND contype = 'c' ORDER BY conname`,
    )
    const byName = Object.fromEntries(defs.map((d) => [String(d['conname']), String(d['def'])]))
    assert.match(byName['partner_invitation_offer_bounded'] ?? '', new RegExp(`'${PARTNER_INVITATION_OFFER_SECONDS / 86400} days'`))
    assert.match(byName['partner_invitation_role_bounded'] ?? '', new RegExp(`'${PARTNER_INVITED_ROLE_SECONDS / 86400} days'`))
    await assert.rejects(
      asMigrator(
        `INSERT INTO tenant.partner_invitation
           (id, partner_id, email, role_id, role_version, invited_by, invited_at,
            expires_at, assignment_expires_at, authorization_id)
         VALUES ('pinv_century', $1, 'cent@northwind.invalid', 'prl_nw_user', 1, $2, now(),
                 now() + interval '1 day', now() + interval '100 years', 'azg_x')`,
        [NORTHWIND, ANA],
      ),
      /partner_invitation_role_bounded/,
    )
  })

  it('6b · the offer carries the act’s own record, and a backdated or re-pointed offer is refused', async () => {
    const out = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, async (tx, g) => {
      const written = await writePartnerInvitation(tx, g, { email: 'mo@northwind.invalid', role: 'partner_user' })
      const forged = await tx
        .query('SAVEPOINT f')
        .then(() =>
          tx.query(
            `INSERT INTO tenant.partner_invitation
               (id, partner_id, email, role_id, role_version, invited_by, invited_at,
                expires_at, assignment_expires_at, authorization_id)
             VALUES ('pinv_forged', $1, 'nia@northwind.invalid', 'prl_nw_user', 1, $2, now() - interval '1 day',
                     now() + interval '1 day', now() + interval '2 days', $3)`,
            [NORTHWIND, ANA, g.id],
          ),
        )
        .then(
          () => 'COMMITTED',
          (e: Error) => e.message,
        )
      await tx.query('ROLLBACK TO SAVEPOINT f')
      return { written, forged, ref: g.id }
    })
    assert.ok(out.written.ok)
    if (!out.written.ok) return
    assert.equal(out.written.invitation.authorizationId, out.ref)
    assert.match(out.forged, /row-level security/, 'a backdated invited_at was accepted — both bounds move with it')
  })

  /* ================================================================== *
   * §7 · THE FENCE, BARE — the INSERT itself, in a real sign-in transaction.
   * ================================================================== */

  async function bareInsert(
    sessionHandle: string,
    subject: string,
    door: keyof typeof DOORS,
    row: { user: string; invitation: string | null; role?: string; expires?: string; grantedBy?: string },
    gucs: { partner: string; inviter: string } | null,
  ): Promise<string> {
    return withSignInScope(
      pool,
      { brokerIssuer: ISSUER, brokerRef: DOORS[door].ref, stateDigest: hex(0x7000 + seq++), externalSubject: subject, sessionRef: digestOf(sessionHandle) },
      async (tx) => {
        if (gucs !== null) {
          await tx.query(`SELECT set_config('app.redeeming_partner', $1, true)`, [gucs.partner])
          await tx.query(`SELECT set_config('app.redeeming_inviter', $1, true)`, [gucs.inviter])
        }
        const inv = row.invitation === null
          ? undefined
          : (await asMigrator(`SELECT assignment_expires_at::text AS assignment_expires_at FROM tenant.partner_invitation WHERE id = $1`, [row.invitation]))[0]
        await tx.query('SAVEPOINT b')
        try {
          await tx.query(
            `INSERT INTO tenant.partner_role_assignment
               (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at, invitation_id)
             VALUES ($1, $2, $3, $4, 1, $5, now(), $6, $7)`,
            [
              `pra_bare_${seq++}`,
              NORTHWIND,
              row.user,
              row.role ?? 'prl_nw_user',
              row.grantedBy ?? ANA,
              row.expires ?? (inv?.['assignment_expires_at'] as string | undefined) ?? new Date(Date.now() + 86400000).toISOString(),
              row.invitation,
            ],
          )
          return 'COMMITTED'
        } catch (e) {
          return (e as Error).message
        } finally {
          await tx.query('ROLLBACK TO SAVEPOINT b')
        }
      },
    )
  }

  it('7 · the fence, bare: each term broken in turn is refused by the DATABASE, and the honest row passes', async () => {
    /* A fresh person at Northwind's door, signed in with NO invitation to them,
     * so the writer redeemed nothing and the rows below are this test's alone. */
    const { out, userId, handle } = await signIn('northwind', 'olu@northwind.invalid', { externalSubject: 'sub-olu' })
    assert.ok(out.ok && out.redemption?.kind === 'none')
    const inv = await anaInvites('olu@northwind.invalid')
    const gucs = { partner: NORTHWIND, inviter: ANA }

    assert.equal(await bareInsert(handle, 'sub-olu', 'northwind', { user: userId, invitation: inv }, gucs), 'COMMITTED',
      'the HONEST redemption row was refused — the fence refuses everything, which proves nothing about any term')
    assert.match(await bareInsert(handle, 'sub-olu', 'northwind', { user: userId, invitation: inv, role: 'prl_nw_admin' }, gucs),
      /partner_invitation_terms_disagree/, 'an offer into partner_user was redeemed as an ADMINISTRATOR')
    assert.match(await bareInsert(handle, 'sub-olu', 'northwind', { user: userId, invitation: inv, expires: '2126-01-01T00:00:00Z' }, gucs),
      /partner_invitation_terms_disagree/, 'the redeemer chose their own role’s end')
    assert.match(await bareInsert(handle, 'sub-olu', 'northwind', { user: userId, invitation: inv }, { partner: NORTHWIND, inviter: 'usr_nobody' }),
      /partner_invitation_inviter_lacks_verb/, 'a FORGED inviter GUC made a refusal pass — it must only ever hide, never admit')
    assert.match(await bareInsert(handle, 'sub-olu', 'northwind', { user: userId, invitation: 'pinv_expired' }, gucs),
      /partner_invitation_not_redeemable/, 'another person’s invitation was redeemable by naming its id')
    assert.match(await bareInsert(handle, 'sub-olu', 'northwind', { user: userId, invitation: null }, gucs),
      /row-level security/, 'an assignment with NO invitation was written by the app role — the grant is not narrow to redemption')
    /* ⚠️ `0390` §2 runs FIRST here: ANA's person row is not readable in OLU's
     * sign-in scope, and an unreadable row is `email_unverified`, never a pass.
     * Any of the three refusals is the property; a COMMIT is the defect. */
    assert.match(await bareInsert(handle, 'sub-olu', 'northwind', { user: ANA, invitation: inv }, gucs),
      /row-level security|partner_invitation_self|partner_invitation_email_unverified/, 'an assignment was written for a person other than the session’s')
    /* 0390 §2, BARE — G2901: the same honest row, from a person whose address
     * was never proved, is refused by the DATABASE, whatever the writer did. */
    await asMigrator(`UPDATE tenant."user" SET email_verified = false WHERE id = $1`, [userId])
    try {
      assert.match(await bareInsert(handle, 'sub-olu', 'northwind', { user: userId, invitation: inv }, gucs),
        /partner_invitation_email_unverified/, 'an UNPROVED address redeemed an offer at the database — the fence is only the writer’s')
    } finally {
      await asMigrator(`UPDATE tenant."user" SET email_verified = true WHERE id = $1`, [userId])
    }

    /* And OUTSIDE a sign-in transaction — a portal act — nothing is writable at
     * all, even with every term copied honestly so the TRIGGER passes: the
     * refusal must be the permissive policy's (no sign-in, no session person). */
    const ends = String(
      (await asMigrator(`SELECT assignment_expires_at::text AS e FROM tenant.partner_invitation WHERE id = $1`, [inv]))[0]?.['e'],
    )
    const inAct = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, async (tx) => {
      try {
        await tx.query(
          `INSERT INTO tenant.partner_role_assignment
             (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at, invitation_id)
           VALUES ('pra_in_act', $1, $2, 'prl_nw_user', 1, $3, now(), $5, $4)`,
          [NORTHWIND, userId, ANA, inv, ends],
        )
        return 'COMMITTED'
      } catch (e) {
        return (e as Error).message
      }
    })
    /* ⚠️ SINCE `0390` §2 THE TRIGGER CAN ANSWER FIRST: in a manage act the
     * invitee's person row is not readable (they hold no role yet), and an
     * unreadable row is `email_unverified`. Either refusal is the property;
     * a COMMIT is the defect. The policy's own refusal is still witnessed —
     * §7's `invitation: null` arm above reaches it with no trigger term. */
    assert.match(inAct, /row-level security|partner_invitation_email_unverified/,
      'a manage act wrote an assignment directly — the invitation became optional')
  })

  it('7b · the trigger is INVOKER-rights (G160) and every new policy is `FOR SELECT` or `FOR INSERT`, none `FOR ALL`', async () => {
    const fn = await asMigrator(
      `SELECT prosecdef FROM pg_proc WHERE proname = 'partner_role_assignment_redeems_an_invitation'`,
    )
    assert.deepEqual(fn, [{ prosecdef: false }])
    const policies = await asMigrator(
      `SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'tenant' AND policyname IN (
         'partner_invitation_redemption_rls', 'partner_role_assignment_redemption_rls',
         'partner_role_redemption_rls', 'partner_role_assignment_redemption_write',
         'partner_invitation_clock_and_receipt') ORDER BY policyname`,
    )
    assert.deepEqual(
      policies.map((p) => `${String(p['policyname'])}:${String(p['cmd'])}`),
      [
        'partner_invitation_clock_and_receipt:INSERT',
        'partner_invitation_redemption_rls:SELECT',
        'partner_role_assignment_redemption_rls:SELECT',
        'partner_role_assignment_redemption_write:INSERT',
        'partner_role_redemption_rls:SELECT',
      ],
    )
  })

  /* ================================================================== *
   * §8 · THE TWO RECURSIONS THAT DECIDED 0370's SHAPE — RUNNABLE.
   *
   * Each re-creates the rejected alternative inside a transaction as the
   * cluster admin, `SET LOCAL ROLE`s to the app role so RLS applies, drives
   * the act, and ROLLS BACK. A pass here is the measurement repeating.
   * ================================================================== */

  async function asAppInAlternative(ddl: readonly string[], act: (q: (sql: string, p?: unknown[]) => Promise<unknown>) => Promise<void>): Promise<string> {
    const { Client } = await loadPg()
    const t = dbTarget()
    const c = new Client({ host: t.host, port: t.port, ssl: dbSsl(t.host), database: t.database, user: adminUser() })
    await c.connect()
    try {
      await c.query('BEGIN')
      for (const d of ddl) await c.query(d)
      await c.query('SET LOCAL ROLE reconcile_app')
      try {
        await act((sql, p) => c.query(sql, (p ?? []) as unknown[]))
        return 'NO ERROR'
      } catch (e) {
        return `${(e as { code?: string }).code ?? ''} ${(e as Error).message}`
      }
    } finally {
      await c.query('ROLLBACK').catch(() => undefined)
      await c.end()
    }
  }

  it('8a · the rejected `WITH CHECK`: the fence written as a policy reading `partner_role` RECURSES (42P17)', async () => {
    const { out, userId, handle } = await signIn('northwind', 'pia@northwind.invalid', { externalSubject: 'sub-pia' })
    assert.ok(out.ok)
    const inv = await anaInvites('pia-two@northwind.invalid')
    const got = await asAppInAlternative(
      [
        'DROP TRIGGER partner_role_assignment_redeems_an_invitation ON tenant.partner_role_assignment',
        `CREATE POLICY alt_fence ON tenant.partner_role_assignment AS RESTRICTIVE FOR INSERT
           WITH CHECK (EXISTS (SELECT 1 FROM tenant.partner_role r
                                WHERE r.id = role_id AND r.status = 'active' AND r.version = role_version))`,
      ],
      async (q) => {
        await q(`SELECT set_config('app.signin_ref', 'x', true)`)
        await q(`SELECT set_config('app.session_ref', $1, true)`, [digestOf(handle)])
        await q(`SELECT set_config('app.redeeming_partner', $1, true)`, [NORTHWIND])
        await q(`SELECT set_config('app.redeeming_inviter', $1, true)`, [ANA])
        await q(
          `INSERT INTO tenant.partner_role_assignment
             (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at, invitation_id)
           VALUES ('pra_alt', $1, $2, 'prl_nw_user', 1, $3, now(), now() + interval '1 day', $4)`,
          [NORTHWIND, userId, ANA, inv],
        )
      },
    )
    assert.match(got, /^42P17 infinite recursion detected in policy for relation "partner_role_assignment"/, got)
  })

  it('8b · the rejected key: an assignment policy reading the INVITATION recurses every new invitation (42P17)', async () => {
    const principalRef = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, async (_tx, g) => g.id)
    const got = await asAppInAlternative(
      [
        `CREATE POLICY alt_inviter ON tenant.partner_role_assignment FOR SELECT
           USING (user_id IN (SELECT i.invited_by FROM tenant.partner_invitation i
                               WHERE i.id = nullif(current_setting('app.redemption_ref', true), '')))`,
      ],
      async (q) => {
        await q(`SELECT set_config('app.session_ref', $1, true)`, [digestOf(HANDLES.ana)])
        await q(`SELECT set_config('app.authorisation_ref', $1, true)`, [principalRef])
        await q(
          `INSERT INTO tenant.partner_invitation
             (id, partner_id, email, role_id, role_version, invited_by, invited_at,
              expires_at, assignment_expires_at, authorization_id)
           VALUES ('pinv_alt', $1, 'quin@northwind.invalid', 'prl_nw_user', 1, $2, now(),
                   now() + interval '1 day', now() + interval '2 days', $3)`,
          [NORTHWIND, ANA, principalRef],
        )
      },
    )
    assert.match(got, /^42P17 infinite recursion detected in policy for relation/, got)
  })

  /* ================================================================== *
   * §9 · AN ADDRESS NOBODY PROVED — G2901/G2902, closing G2816.
   * ================================================================== */

  /** The redemption fence's function body, out of a migration file. */
  function fenceBodyFrom(file: string): string {
    const src = readFileSync(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8')
    const start = src.indexOf('FUNCTION tenant.partner_role_assignment_redeems_an_invitation()')
    const end = src.indexOf('$$;', start) + 3
    assert.ok(start > 0 && end > start, `${file} carries no redemption fence — the witness is vacuous`)
    return 'CREATE OR REPLACE ' + src.slice(start, end)
  }

  it('9 · RED — UNPROVED ADDRESS: a person whose directory did not prove the address cannot take the role offered to it', async () => {
    /* PAT is invited. MALLORY signs in at the SAME firm's door with Pat's
     * address typed into her own directory profile — `email_verified` false. */
    await anaInvites('pat@northwind.invalid')
    const mallory = await signIn('northwind', 'pat@northwind.invalid', { emailVerified: false, externalSubject: 'sub-mallory' })
    assert.equal(mallory.out.ok, true, 'an unproved address refused the SIGN-IN — G2809: only the redemption is refused')
    if (!mallory.out.ok) return
    assert.equal(mallory.out.provisioned, true)
    assert.deepEqual(
      mallory.out.redemption,
      { kind: 'refused', refusal: PARTNER_REDEMPTION_REFUSALS.emailUnverified },
      'an UNPROVED address was not refused BY NAME',
    )
    assert.deepEqual(await assignmentsOf(mallory.userId), [], 'G2816: another person’s offer conferred a role on an unproved address')

    /* G2902 — WHAT PROVISIONING STORED: the address AND the fact. */
    const row = await asMigrator(`SELECT email, email_verified FROM tenant."user" WHERE id = $1`, [mallory.userId])
    assert.deepEqual(row[0], { email: 'pat@northwind.invalid', email_verified: false })

    /* And the offer is still STANDING for the person it was made to. */
    const pat = await signIn('northwind', 'pat@northwind.invalid', { externalSubject: 'sub-pat' })
    assert.equal(pat.out.ok && pat.out.redemption?.kind, 'redeemed', 'the refused attempt spent the real invitee’s offer')
    const patRow = await asMigrator(`SELECT email_verified FROM tenant."user" WHERE id = $1`, [pat.userId])
    assert.equal(patRow[0]?.['email_verified'], true)
  })

  it('9b · RED WITNESSED — with `0390` §2 cut back to `0370`’s fence, the same attack TAKES THE ROLE', async () => {
    await anaInvites('quill@northwind.invalid')
    await asMigrator(fenceBodyFrom('0370_partner_invitation_redemption.sql'))
    let stolen: Awaited<ReturnType<typeof signIn>> | undefined
    try {
      stolen = await signIn('northwind', 'quill@northwind.invalid', { emailVerified: false, externalSubject: 'sub-mallory-2' })
    } finally {
      await asMigrator(fenceBodyFrom('0390_invitation_gaps.sql'))
    }
    assert.equal(stolen.out.ok && stolen.out.redemption?.kind, 'redeemed',
      'the witness is vacuous: with the term cut, the unproved address should have been handed the role')
    assert.equal((await assignmentsOf(stolen.userId)).length, 1)
    /* And the restored fence is the one in force again. */
    const src = (await asMigrator(
      `SELECT prosrc FROM pg_proc WHERE proname = 'partner_role_assignment_redeems_an_invitation'`,
    ))[0]?.['prosrc']
    assert.match(String(src), /partner_invitation_email_unverified/)
  })

  it('9c · a flag that attests a DIFFERENT claim proves nothing: a door projecting `upn` stores the address unproved', async () => {
    await anaInvites('rhea@northwind.invalid')
    await asMigrator(`UPDATE tenant.identity_connection SET email_claim = 'upn' WHERE id = $1`, [DOOR_NW])
    try {
      const { out, userId } = await signIn('northwind', 'unused@northwind.invalid', {
        emailVerified: true,
        claims: { upn: 'rhea@northwind.invalid', name: 'Not Rhea' },
        externalSubject: 'sub-upn',
      })
      assert.equal(out.ok, true, JSON.stringify(out))
      if (!out.ok) return
      assert.deepEqual(out.redemption, { kind: 'refused', refusal: PARTNER_REDEMPTION_REFUSALS.emailUnverified },
        '`email_verified` attests `email`, and was read as attesting `upn`')
      assert.deepEqual(await assignmentsOf(userId), [])
    } finally {
      await asMigrator(`UPDATE tenant.identity_connection SET email_claim = 'email' WHERE id = $1`, [DOOR_NW])
    }
  })

  /* ================================================================== *
   * §10 · ONE STANDING OFFER, NOT ONE OFFER FOR EVER — G2903, closing G2811.
   * ================================================================== */

  it('10 · a LAPSED offer no longer blocks re-inviting its address; the new offer is the one redeemed', async () => {
    await seedInvitation({ id: 'pinv_lapsed_sami', email: 'sami@northwind.invalid', invitedBy: ANA, invitedAgo: '15 days' })
    /* Before 0390 this was `partner_person_already_invited`, for ever. */
    const reinvited = await anaInvites('SAMI@northwind.invalid')
    const { out, userId } = await signIn('northwind', 'sami@northwind.invalid')
    assert.equal(out.ok, true)
    if (!out.ok) return
    assert.equal(out.redemption?.kind, 'redeemed', `the standing re-invitation was not redeemed: ${JSON.stringify(out.redemption)}`)
    const rows = await assignmentsOf(userId)
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.['invitation_id'], reinvited, 'the LAPSED offer was redeemed instead of the standing one')
  })

  it('10b · a STANDING offer still blocks a second one — the writer’s 422, unchanged in meaning', async () => {
    await anaInvites('tova@northwind.invalid')
    const again = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, (tx, g) =>
      writePartnerInvitation(tx, g, { email: 'Tova@northwind.invalid', role: 'partner_user' }),
    )
    assert.deepEqual(again, { ok: false, refusal: 'partner_person_already_invited' })
    /* And a REDEEMED offer that is still standing blocks too. */
    const { out } = await signIn('northwind', 'tova@northwind.invalid')
    assert.equal(out.ok && out.redemption?.kind, 'redeemed')
    const third = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, (tx, g) =>
      writePartnerInvitation(tx, g, { email: 'tova@northwind.invalid', role: 'partner_user' }),
    )
    assert.deepEqual(third, { ok: false, refusal: 'partner_person_already_invited' })
  })

  it('10c · two CONCURRENT offers to one address: the advisory lock serialises them and the second is refused', async () => {
    const a = await migratorClient()
    const b = await migratorClient()
    const insert = `INSERT INTO tenant.partner_invitation
         (id, partner_id, email, role_id, role_version, invited_by, invited_at,
          expires_at, assignment_expires_at, authorization_id)
       VALUES ($1, $2, 'uma@northwind.invalid', 'prl_nw_user', 1, $3, now(),
               now() + interval '14 days', now() + interval '60 days', 'azg_seeded')`
    try {
      await a.query('BEGIN')
      await b.query('BEGIN')
      await a.query(insert, ['pinv_race_a', NORTHWIND, ANA])
      /* B blocks on A's advisory lock, which is released only when A commits. */
      const second = b.query(insert, ['pinv_race_b', NORTHWIND, ANA]).then(
        () => 'COMMITTED',
        (e: { code?: string; message?: string }) => `${e.code ?? ''} ${e.message ?? ''}`,
      )
      await new Promise((r) => setTimeout(r, 200))
      await a.query('COMMIT')
      const got = await second
      await b.query('ROLLBACK').catch(() => undefined)
      assert.match(got, /^23505 partner_invitation_offer_standing/, `the concurrent second offer was not refused: ${got}`)
    } finally {
      await a.end()
      await b.end()
    }
    const n = await asMigrator(`SELECT count(*)::int AS n FROM tenant.partner_invitation WHERE email = 'uma@northwind.invalid'`)
    assert.equal(n[0]?.['n'], 1)
  })

  it('10d · single use is untouched, and the catalogue says what 0390 did', async () => {
    const idx = await asMigrator(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'tenant' AND tablename IN ('partner_invitation', 'partner_role_assignment')`,
    )
    const names = idx.map((r) => r['indexname'])
    assert.ok(!names.includes('partner_invitation_one_per_address'), 'the stateless one-per-address index is back — G2811 reopened')
    assert.ok(names.includes('partner_role_assignment_one_per_invitation'), 'SINGLE USE was dropped with it')
    const fns = await asMigrator(
      `SELECT proname, prosecdef FROM pg_proc
        WHERE proname IN ('partner_invitation_one_standing_offer', 'partner_role_assignment_redeems_an_invitation')
        ORDER BY proname`,
    )
    assert.deepEqual(
      fns.map((r) => [r['proname'], r['prosecdef']]),
      [
        ['partner_invitation_one_standing_offer', false],
        ['partner_role_assignment_redeems_an_invitation', false],
      ],
      'a fence is SECURITY DEFINER (G160)',
    )
  })

  it('8c · CONTOSO is untouched by all of it: no Northwind offer, assignment or role leaks into its door', async () => {
    const rows = await asMigrator(
      `SELECT count(*)::int AS n FROM tenant.partner_role_assignment a
         JOIN tenant."user" u ON u.id = a.user_id
        WHERE a.partner_id = $1 AND u.connection_id = $2`,
      [NORTHWIND, DOOR_CO],
    )
    assert.equal(rows[0]?.['n'], 0, 'a person at Contoso’s door holds a Northwind portal role')
    assert.ok(CONTOSO.length > 0)
  })
})

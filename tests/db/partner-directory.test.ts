/**
 * A PARTNER FIRM'S OWN DIRECTORY AND ITS INVITATION WRITER —
 * `db/migrations/0321_partner_directory_and_invitation.sql`.
 * G2624 (THE OWNER'S, taking G447 for partners) and G2625–G2632.
 *
 * 🛑 THE RECURSION HAZARD IS RE-MEASURED HERE ON EVERY RUN (§0), because the
 *    owner said not to trust it: `0200`'s first draft of a policy on
 *    `tenant."user"` answered `infinite recursion detected in policy for
 *    relation "user"` eleven times of eleven, through a table nobody was
 *    looking at. §0 reads every table `0321` touches, inside a real portal act,
 *    and requires that no read raises.
 *
 * 🛑 REDS WITNESSED BEFORE THIS FILE WAS TRUSTED (captured on mutated trees,
 *    `0321` otherwise unchanged):
 *
 *   · `0321` §2 DELETED (the ruling's `"user"` policy ALONE): §1 read
 *     `[usr_nw_ana]` — ONE person, herself, through `user_visible_to_session`.
 *     The ruling's policy finds no colleague assignment to admit a colleague
 *     through, because `0250` hides it. This is why four policies land, not one.
 *   · `0321` §2's FIRM term weakened to "any receipt" (`partner_id = (…)` →
 *     `EXISTS (…)`): §1e read CARL's Contoso assignment from inside ANA's
 *     Northwind act. Invariant 2 is not what that breaks (no tenant is read),
 *     but it is a cross-FIRM read, which the ruling's *"in the same partner
 *     firm"* exists to refuse. §1 alone did NOT catch it — the `"user"` policy
 *     re-states the firm — which is why §1e reads the assignment table bare.
 *   · `0321` §5 term (b) DELETED: GUS, holding `manage_partner_staff` and no
 *     deal verb, COMMITTED an invitation into `partner_user`, which confers
 *     `view_deals` and `register_deal` — an escalation by proxy.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { CAPABILITIES } from '../../model/access.ts'
import {
  PARTNER_INVITATION_REFUSALS,
  readPartnerPeople,
  writePartnerInvitation,
} from '../../server/data-plane/partner-staff-store.ts'
import {
  ANA,
  BEN,
  CARL,
  CONTOSO,
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
  process.env['RECONCILE_PARTNER_DIRECTORY_DB_NAME'] ?? runScopedName('reconcile_partner_directory_test')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the partner directory suite', probe)

const GUS = 'usr_nw_gus'
const GUS_HANDLE = 'sh_gus_4b5c6d7e8f90a1b2c3d4e5f60718293a'

const ana = { handle: HANDLES.ana, user: ANA, firm: NORTHWIND }
const carl = { handle: HANDLES.carl, user: CARL, firm: CONTOSO }
const gus = { handle: GUS_HANDLE, user: GUS, firm: NORTHWIND }

let pool: TenantPool

/** GUS runs people operations and nothing else: `manage_partner_staff` alone. */
async function seedPeopleOps(): Promise<void> {
  await asMigrator(
    `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
     VALUES ($1, 'gus@northwind.invalid', 'Gus Ferreira', 'active', $2)`,
    [GUS, DOOR_NW],
  )
  await asMigrator(
    `INSERT INTO tenant.partner_role (id, partner_id, label, key, version, status)
     VALUES ('prl_nw_peopleops', $1, 'People operations', 'people_ops', 1, 'active')`,
    [NORTHWIND],
  )
  await asMigrator(
    `INSERT INTO tenant.partner_role_capability (role_id, capability)
     VALUES ('prl_nw_peopleops', 'manage_partner_staff')`,
  )
  await asMigrator(
    `INSERT INTO tenant.partner_role_assignment
       (id, partner_id, user_id, role_id, role_version, granted_by, granted_at, expires_at)
     VALUES ('pra_gus', $1, $2, 'prl_nw_peopleops', 1, 'seed', now(), now() + interval '30 days')`,
    [NORTHWIND, GUS],
  )
  await asMigrator(
    `INSERT INTO tenant.session
       (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
        authenticated_at, last_used_at, expires_at, revoked_at)
     VALUES ('ses_gus', $1, $2, $3, NULL, $4, now(), now(), now() + interval '12 hours', NULL)`,
    [digestOf(GUS_HANDLE), GUS, DOOR_NW, PARTNERS_HOST],
  )
}

const ids = (rows: unknown[]): string[] => rows.map((r) => (r as { id: string }).id).sort()

describe('a partner firm’s own directory and invitations (0321)', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await seedPartnerPortal()
    await seedPeopleOps()
    pool = await createAppPool(2)
  })
  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  it('0 · NO RECURSION — every table 0321 touches reads inside a view act and a manage act', async () => {
    const tables = [
      'tenant."user"',
      'tenant.identity_connection',
      'tenant.partner_role_assignment',
      'tenant.partner_role',
      'tenant.partner_role_capability',
      'tenant.partner_invitation',
      'tenant.partner_authorization_grant',
      'tenant.session',
    ]
    for (const verb of [CAPABILITIES.viewPartnerStaff, CAPABILITIES.managePartnerStaff]) {
      await inPartnerAct(pool, ana, verb, async (tx) => {
        for (const t of tables) {
          await assert.doesNotReject(
            tx.query(`SELECT count(*) FROM ${t}`),
            `reading ${t} inside a ${verb} act raised — 0200's recursion class, through a policy 0321 added`,
          )
        }
      })
    }
    /* And the plain session scope — `resolveSubject()`'s own read path — still reads. */
    await withSessionScope(pool, digestOf(HANDLES.ana), async (tx) => {
      for (const t of tables) await tx.query(`SELECT count(*) FROM ${t}`)
    })
  })

  it('1 · THE RULING: a view act reads its own firm’s people — and nobody else', async () => {
    const people = await inPartnerAct(pool, ana, CAPABILITIES.viewPartnerStaff, async (tx) =>
      ids((await tx.query(`SELECT id FROM tenant."user"`)).rows),
    )
    assert.deepEqual(
      people,
      [ANA, BEN, GUS].sort(),
      'the roster is wrong. CARL (Contoso) on it is a cross-FIRM read; DORA (Northwind’s ' +
        'door, no portal role) on it is the directory widened from "assignment in the firm" ' +
        'to "anyone at the door"; only ANA on it is the ruling’s policy with nothing to join to.',
    )
  })

  it('1b · OUTSIDE an act — a plain session scope — 0250 §2 still holds: a colleague is invisible', async () => {
    const out = await withSessionScope(pool, digestOf(HANDLES.ana), async (tx) => ({
      users: ids((await tx.query(`SELECT id FROM tenant."user"`)).rows),
      assignments: ids((await tx.query(`SELECT id FROM tenant.partner_role_assignment`)).rows),
      roles: ids((await tx.query(`SELECT id FROM tenant.partner_role`)).rows),
    }))
    assert.deepEqual(out, { users: [ANA], assignments: ['pra_ana'], roles: ['prl_nw_admin'] })
  })

  it('1c · a MANAGE act opens the role catalogue and NOT the people', async () => {
    const out = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, async (tx) => ({
      users: ids((await tx.query(`SELECT id FROM tenant."user"`)).rows),
      roles: ids((await tx.query(`SELECT id FROM tenant.partner_role`)).rows),
    }))
    assert.deepEqual(out.users, [ANA], 'manage_partner_staff opened the directory — the ruling names view_partner_staff alone')
    assert.deepEqual(out.roles, ['prl_nw_admin', 'prl_nw_peopleops', 'prl_nw_user'])
  })

  it('1d · a FORGED receipt is inert: ANA naming CARL’s record reads Northwind’s nothing and Contoso’s nothing', async () => {
    const carlsRef = await inPartnerAct(pool, carl, CAPABILITIES.viewPartnerStaff, async (_tx, g) => g.id)
    const out = await withSessionScope(pool, digestOf(HANDLES.ana), async (tx) => {
      await tx.query(`SELECT set_config('app.authorisation_ref', $1, true)`, [carlsRef])
      return ids((await tx.query(`SELECT id FROM tenant."user"`)).rows)
    })
    assert.deepEqual(out, [ANA], 'another person’s receipt opened a directory — G507’s "a forged name is INERT" failed')
  })

  it('1e · the colleague-assignment arm is the receipt’s FIRM, read bare', async () => {
    const out = await inPartnerAct(pool, ana, CAPABILITIES.viewPartnerStaff, async (tx) =>
      ids((await tx.query(`SELECT id FROM tenant.partner_role_assignment`)).rows),
    )
    assert.deepEqual(out, ['pra_ana', 'pra_ben', 'pra_gus'], 'a view act read another firm’s assignment')
  })

  it('2 · readPartnerPeople() answers the wire’s four required fields, state derived from the assignment', async () => {
    await asMigrator(`UPDATE tenant.partner_role_assignment SET revoked_at = now() WHERE id = 'pra_ben'`)
    const out = await inPartnerAct(pool, ana, CAPABILITIES.viewPartnerStaff, (tx, g) => readPartnerPeople(tx, g))
    await asMigrator(`UPDATE tenant.partner_role_assignment SET revoked_at = NULL WHERE id = 'pra_ben'`)
    assert.equal(out.ok, true)
    if (!out.ok) return
    assert.deepEqual(out.people, [
      { name: 'Ana Ruiz', email: 'ana@northwind.invalid', role: 'Partner administrator', state: 'active' },
      { name: 'Ben Okafor', email: 'ben@northwind.invalid', role: 'Partner user', state: 'revoked' },
      { name: 'Gus Ferreira', email: 'gus@northwind.invalid', role: 'People operations', state: 'active' },
    ])
  })

  it('3 · the writer: an administrator invites into a role whose verbs she holds', async () => {
    const out = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, (tx, g) =>
      writePartnerInvitation(tx, g, { email: 'erin@northwind.invalid', role: 'partner_user' }),
    )
    assert.equal(out.ok, true, JSON.stringify(out))
    const again = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, (tx, g) =>
      writePartnerInvitation(tx, g, { email: 'ERIN@northwind.invalid', role: 'partner_administrator' }),
    )
    assert.deepEqual(again, { ok: false, refusal: PARTNER_INVITATION_REFUSALS.alreadyInvited })
  })

  it('3b · NO ESCALATION: GUS holds manage_partner_staff and no deal verb, and cannot confer partner_user', async () => {
    const out = await inPartnerAct(pool, gus, CAPABILITIES.managePartnerStaff, (tx, g) =>
      writePartnerInvitation(tx, g, { email: 'hal@northwind.invalid', role: 'partner_user' }),
    )
    assert.deepEqual(
      out,
      { ok: false, refusal: PARTNER_INVITATION_REFUSALS.notPermitted },
      'a person who may manage staff but not register deals invited somebody who may register deals',
    )
    const rows = await asMigrator(`SELECT count(*)::int AS n FROM tenant.partner_invitation WHERE email = 'hal@northwind.invalid'`)
    assert.equal(rows[0]?.['n'], 0)
  })

  it('3c · NOT SELF, and an unknown role key is refused before the row', async () => {
    const self = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, (tx, g) =>
      writePartnerInvitation(tx, g, { email: 'Ana@Northwind.invalid', role: 'partner_administrator' }),
    )
    assert.deepEqual(self, { ok: false, refusal: PARTNER_INVITATION_REFUSALS.notPermitted })
    await asMigrator(`UPDATE tenant.partner_role SET status = 'archived' WHERE id = 'prl_nw_user'`)
    const archived = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, (tx, g) =>
      writePartnerInvitation(tx, g, { email: 'ivy@northwind.invalid', role: 'partner_user' }),
    )
    await asMigrator(`UPDATE tenant.partner_role SET status = 'active' WHERE id = 'prl_nw_user'`)
    assert.deepEqual(archived, { ok: false, refusal: PARTNER_INVITATION_REFUSALS.roleNotOffered })
  })

  it('3d · a refused row KEEPS the act’s record — the savepoint, not a silent ROLLBACK', async () => {
    const ref = await inPartnerAct(pool, gus, CAPABILITIES.managePartnerStaff, async (tx, g) => {
      await writePartnerInvitation(tx, g, { email: 'jo@northwind.invalid', role: 'partner_user' })
      return g.id
    })
    const rows = await asMigrator(`SELECT count(*)::int AS n FROM tenant.partner_authorization_grant WHERE id = $1`, [ref])
    assert.equal(rows[0]?.['n'], 1, 'an authorised, refused act left no invariant 10 record')
  })

  it('3e · the firm is the RECEIPT’s: a Northwind manage act cannot write a Contoso invitation', async () => {
    const err = await inPartnerAct(pool, ana, CAPABILITIES.managePartnerStaff, async (tx) => {
      try {
        await tx.query(
          /* `0370` §1's three columns are supplied, so the refusal is the
           * FIRM term's and not a NOT NULL arriving first. */
          `INSERT INTO tenant.partner_invitation
             (id, partner_id, email, role_id, role_version, invited_by, invited_at,
              expires_at, assignment_expires_at, authorization_id)
           VALUES ('pinv_x', $1, 'kim@contoso.invalid', 'prl_co_user', 1, $2, now(),
                   now() + interval '1 day', now() + interval '2 days',
                   current_setting('app.authorisation_ref'))`,
          [CONTOSO, ANA],
        )
        return null
      } catch (e) {
        return (e as Error).message
      }
    })
    assert.match(err ?? 'COMMITTED', /row-level security/)
  })

  /* ⚠️ THIS TITLE READ *"assignments still SELECT only"* AND THE ROW BELOW
   * ASSERTED `INSERT` ABSENT UNTIL 2 Oct 2026 — `0370` (G2801, the owner's)
   * grants it for REDEMPTION, with its own fence. What survives, and is
   * asserted: still no `UPDATE` and no `DELETE` on the assignment, and nothing
   * at all on the role catalogue. `tests/db/partner-invitation-redemption.test.ts`
   * proves the grant narrow to the redemption path. */
  it('4 · privileges and policy shape: invitation SELECT/INSERT only; assignments INSERT for redemption and nothing wider; no USING on the fence', async () => {
    for (const [table, verb, want] of [
      ['partner_invitation', 'INSERT', true],
      ['partner_invitation', 'UPDATE', false],
      ['partner_invitation', 'DELETE', false],
      ['partner_role_assignment', 'INSERT', true],
      ['partner_role_assignment', 'UPDATE', false],
      ['partner_role_assignment', 'DELETE', false],
      ['partner_role', 'INSERT', false],
    ] as const) {
      const rows = await asMigrator(`SELECT has_table_privilege('tenant_rw', 'tenant.${table}', '${verb}') AS p`)
      assert.equal(rows[0]?.['p'], want, `tenant_rw ${want ? 'lacks' : 'holds'} ${verb} on ${table}`)
    }
    const fence = await asMigrator(
      `SELECT permissive, cmd, qual FROM pg_policies
        WHERE schemaname = 'tenant' AND policyname = 'partner_invitation_no_escalation'`,
    )
    assert.deepEqual(fence, [{ permissive: 'RESTRICTIVE', cmd: 'INSERT', qual: null }])
    const all = await asMigrator(
      `SELECT policyname FROM pg_policies WHERE schemaname = 'tenant' AND cmd = 'ALL'
          AND policyname IN ('user_partner_directory_rls','partner_role_assignment_directory_rls',
                             'partner_role_catalogue_rls','partner_invitation_read_rls')`,
    )
    assert.deepEqual(all, [], 'a FOR ALL policy reuses its USING as a WITH CHECK (G1982)')
  })
})

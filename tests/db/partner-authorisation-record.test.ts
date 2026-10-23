/**
 * INVARIANT 10's THIRD HOME — `db/migrations/0320_partner_authorisation_record.sql`.
 * G2621 (THE OWNER'S, taking G2327), G2622, G2623 — 1 Oct 2026.
 *
 * 🛑 WHAT WAS RED BEFORE THIS FILE, WITNESSED RATHER THAN ARGUED:
 *
 *   · §0 — `authorize()` for ANA's `register_deal` returned `home: 'platform'`.
 *     A partner firm's deal registration would have been minted as a 1CloudHub
 *     STAFF act and written into `tenant.platform_authorization_grant`. Captured
 *     on the commit before this one:
 *       `AssertionError: Expected values to be strictly equal: 'platform' !== 'partner'`
 *
 *   · §3 — with `0320` §2's firm-and-verb term deleted (session term alone,
 *     `0091`'s shape), the app role COMMITTED a record naming CONTOSO and
 *     `view_partner_staff` from ANA's Northwind session. That is the row
 *     `0321`'s directory policy would then have honoured, i.e. a cross-firm
 *     roster read laundered through a forged receipt.
 *
 *   · AND THE FIRST FORM OF THAT TERM — a `WITH CHECK` — WAS ITSELF RED ONE
 *     COMMIT LATER, which is why it is a trigger: once `0321` gave the
 *     assignment and role tables arms that read this table, every portal act
 *     answered `infinite recursion detected in policy for relation
 *     "partner_authorization_grant"` (42P17). §5b reads the trigger back.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  ORG_CLASSES,
  authorize,
  type Capability,
  type PartnerAuthorizationGrant,
  type PrincipalContext,
} from '../../model/access.ts'
import type { PartnerId, Timestamp, UserId } from '../../model/kernel.ts'
import { readPartnerHeld } from '../../server/data-plane/identity.ts'
import {
  mintAuthorizationGrantId,
  writePartnerAuthorisationRecord,
} from '../../server/data-plane/authorisation-record.ts'
import {
  ANA,
  BEN,
  CONTOSO,
  HANDLES,
  NORTHWIND,
  asMigrator,
  digestOf,
  seedPartnerPortal,
} from './partner-fixture.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PARTNER_RECORD_DB_NAME'] ?? runScopedName('reconcile_partner_record_test')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the partner authorisation record suite', probe)

async function principalFor(handle: string, user: string): Promise<PrincipalContext> {
  const out = await withSessionScope(pool, digestOf(handle), (tx) => readPartnerHeld(tx))
  if (!out.ok) throw new Error(`readPartnerHeld refused: ${out.refusal}`)
  return {
    subject: { userId: user as UserId, status: 'active' },
    tenantId: null,
    orgClass: ORG_CLASSES.partner,
    partnerId: NORTHWIND as PartnerId,
    partnerGrant: null,
    held: null,
    platformHeld: null,
    partnerHeld: out.partnerHeld,
    now: new Date().toISOString() as Timestamp,
  }
}

function mint(principal: PrincipalContext, capability: Capability): PartnerAuthorizationGrant {
  const out = authorize(principal, capability, {
    id: mintAuthorizationGrantId(),
    resource: {
      resourceClass: CAPABILITY_RESOURCE_CLASS[capability],
      resourceType: 'DealRegistration',
      resourceId: null,
      solutionId: null,
    },
    ttlSeconds: 300,
  })
  assert.ok(out.grant !== null, `authorize() refused: ${out.decision.reason}`)
  assert.equal(out.grant.home, 'partner')
  if (out.grant.home !== 'partner') throw new Error('unreachable')
  return out.grant
}

let pool: TenantPool

/** The session/org term is the policy's; the firm-and-verb term is the trigger's (0320 §2). */
const REFUSED = /row-level security|partner authorisation record refused/

async function rawInsert(
  handle: string,
  row: { subject: string; partner: string; capability: string; orgClass?: string },
): Promise<string | null> {
  try {
    await withSessionScope(pool, digestOf(handle), (tx) =>
      tx.query(
        `INSERT INTO tenant.partner_authorization_grant
           (subject_user_id, id, org_class, partner_id, capability, resource_class,
            resource_type, resource_id, solution_id, issued_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, 'partner_staff', 'PartnerPerson', NULL, NULL, now(), now() + interval '5 minutes')`,
        [row.subject, mintAuthorizationGrantId(), row.orgClass ?? 'partner', row.partner, row.capability],
      ),
    )
    return null
  } catch (err) {
    return (err as Error).message
  }
}

describe('invariant 10’s third home — the partner firm’s own record (0320)', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await seedPartnerPortal()
    pool = await createAppPool(2)
  })
  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  it('0 · `authorize()` mints a PARTNER home for a partner-only verb, never the platform one', async () => {
    const ana = await principalFor(HANDLES.ana, ANA)
    const out = authorize(ana, CAPABILITIES.registerDeal, {
      id: mintAuthorizationGrantId(),
      resource: { resourceClass: 'deal', resourceType: 'DealRegistration', resourceId: null, solutionId: null },
      ttlSeconds: 300,
    })
    assert.ok(out.grant !== null, out.decision.reason)
    assert.equal(
      out.grant.home,
      'partner',
      'a partner firm’s portal act was minted into the PLATFORM home — an auditor reading ' +
        'what 1CloudHub’s own staff did would find a partner’s deal registration there (G2327).',
    )
    assert.equal(out.grant.partnerId, NORTHWIND)
    assert.equal('tenantId' in out.grant, false, 'the third home carries no tenant — not null, ABSENT')
  })

  it('1 · the record is written in the act’s session scope and names itself as the receipt', async () => {
    const ana = await principalFor(HANDLES.ana, ANA)
    const grant = mint(ana, CAPABILITIES.viewPartnerStaff)
    const ref = await withSessionScope(pool, digestOf(HANDLES.ana), async (tx) => {
      await writePartnerAuthorisationRecord(tx, grant)
      return (await tx.query(`SELECT current_setting('app.authorisation_ref', true) AS r`)).rows[0]
    })
    assert.equal((ref as { r: string }).r, grant.id, 'G507’s receipt was not named after the write')
    const rows = await asMigrator(
      `SELECT partner_id, org_class, capability FROM tenant.partner_authorization_grant WHERE id = $1`,
      [grant.id],
    )
    assert.deepEqual(rows, [{ partner_id: NORTHWIND, org_class: 'partner', capability: 'view_partner_staff' }])
    const via = await asMigrator(
      `SELECT assignment_id FROM tenant.partner_authorization_grant_via WHERE grant_id = $1`,
      [grant.id],
    )
    assert.deepEqual(via, [{ assignment_id: 'pra_ana' }])
  })

  it('2 · SESSION-keyed: a colleague cannot read it, and no tenant scope can either', async () => {
    const asBen = await withSessionScope(pool, digestOf(HANDLES.ben), (tx) =>
      tx.query(`SELECT count(*)::int AS n FROM tenant.partner_authorization_grant`),
    )
    assert.equal((asBen.rows[0] as { n: number }).n, 0, 'BEN reads ANA’s record — the home is a firm log, not a person’s')
    const tenant = await withTenantScope(pool, 'ten_acme', (tx) =>
      tx.query(`SELECT count(*)::int AS n FROM tenant.partner_authorization_grant`),
    )
    assert.equal((tenant.rows[0] as { n: number }).n, 0)
    const asAna = await withSessionScope(pool, digestOf(HANDLES.ana), (tx) =>
      tx.query(`SELECT count(*)::int AS n FROM tenant.partner_authorization_grant`),
    )
    assert.ok((asAna.rows[0] as { n: number }).n >= 1, 'the actor cannot read their own record')
  })

  it('3 · the write refuses every row the fifth arm could not have produced', async () => {
    assert.equal(
      await rawInsert(HANDLES.ana, { subject: ANA, partner: NORTHWIND, capability: 'view_partner_staff' }),
      null,
      'the positive control was refused — every refusal below would then be vacuous',
    )
    const cases: Array<[string, string | null]> = [
      [
        'another FIRM — a forged receipt for Contoso’s roster',
        await rawInsert(HANDLES.ana, { subject: ANA, partner: CONTOSO, capability: 'view_partner_staff' }),
      ],
      [
        'a verb the actor’s role does not carry',
        await rawInsert(HANDLES.ben, { subject: BEN, partner: NORTHWIND, capability: 'view_partner_staff' }),
      ],
      [
        'another PERSON — the session term',
        await rawInsert(HANDLES.ana, { subject: BEN, partner: NORTHWIND, capability: 'view_deals' }),
      ],
      [
        'an org class other than partner',
        await rawInsert(HANDLES.ana, { subject: ANA, partner: NORTHWIND, capability: 'view_deals', orgClass: 'platform' }),
      ],
    ]
    for (const [what, refusal] of cases) {
      assert.match(refusal ?? 'COMMITTED', REFUSED, `${what}: the record was COMMITTED`)
    }

    await asMigrator(`UPDATE tenant.partner_role_assignment SET revoked_at = now() WHERE id = 'pra_ana'`)
    const revoked = await rawInsert(HANDLES.ana, { subject: ANA, partner: NORTHWIND, capability: 'view_deals' })
    await asMigrator(`UPDATE tenant.partner_role_assignment SET revoked_at = NULL WHERE id = 'pra_ana'`)
    assert.match(revoked ?? 'COMMITTED', REFUSED, 'a REVOKED role minted a receipt')

    await asMigrator(`UPDATE tenant.partner_role SET version = 2 WHERE id = 'prl_nw_admin'`)
    const moved = await rawInsert(HANDLES.ana, { subject: ANA, partner: NORTHWIND, capability: 'view_deals' })
    await asMigrator(`UPDATE tenant.partner_role SET version = 1 WHERE id = 'prl_nw_admin'`)
    assert.match(moved ?? 'COMMITTED', REFUSED, 'a role whose pin MOVED minted a receipt')
  })

  it('4 · append-only as a PRIVILEGE: SELECT and INSERT, no UPDATE, no DELETE', async () => {
    for (const table of ['partner_authorization_grant', 'partner_authorization_grant_via']) {
      for (const [verb, want] of [
        ['SELECT', true],
        ['INSERT', true],
        ['UPDATE', false],
        ['DELETE', false],
      ] as const) {
        const rows = await asMigrator(
          `SELECT has_table_privilege('tenant_rw', 'tenant.${table}', '${verb}') AS p`,
        )
        assert.equal(rows[0]?.['p'], want, `tenant_rw ${want ? 'lacks' : 'holds'} ${verb} on ${table}`)
      }
    }
  })

  it('5 · no policy is FOR ALL, RLS is ENABLEd and FORCEd, and there is no tenant column', async () => {
    const policies = await asMigrator(
      `SELECT tablename, cmd FROM pg_policies
        WHERE schemaname = 'tenant' AND tablename LIKE 'partner_authorization_grant%'`,
    )
    assert.equal(policies.length, 4)
    for (const p of policies) assert.notEqual(p['cmd'], 'ALL', `${String(p['tablename'])} has a FOR ALL policy`)
    const rls = await asMigrator(
      `SELECT c.relrowsecurity AS e, c.relforcerowsecurity AS f
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'tenant' AND c.relname LIKE 'partner_authorization_grant%' AND c.relkind = 'r'`,
    )
    assert.equal(rls.length, 2)
    for (const r of rls) assert.deepEqual(r, { e: true, f: true })
    const tenantCol = await asMigrator(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'tenant' AND table_name LIKE 'partner_authorization_grant%'
          AND column_name = 'tenant_id'`,
    )
    assert.equal(tenantCol[0]?.['n'], 0, 'a tenant column on the fifth arm’s record is invariant 2’s second path')
  })

  it('5b · the firm-and-verb term is a BEFORE INSERT trigger, invoker-rights, not a WITH CHECK', async () => {
    const trig = await asMigrator(
      `SELECT t.tgname, p.prosecdef
         FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid = 'tenant.partner_authorization_grant'::regclass AND NOT t.tgisinternal`,
    )
    assert.deepEqual(trig, [{ tgname: 'partner_authorization_grant_is_a_receipt', prosecdef: false }])
  })
})

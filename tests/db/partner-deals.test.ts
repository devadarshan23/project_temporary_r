/**
 * A PARTNER FIRM'S DEALS, SANDBOX AND TRIAL REQUESTS —
 * `db/migrations/0322_partner_deals_sandbox_and_trials.sql`. G2633–G2640.
 *
 * 🛑 EVERY READ HERE IS BARE — NO `WHERE` — BECAUSE THE STORE'S `WHERE` HIDES
 *    THE POLICY. Witnessed: with `deal_registration_read_rls` weakened to
 *    `true OR …`, the WHOLE served suite (`tests/http/partner-portal-served.test.ts`)
 *    stayed GREEN, because `readDealRegistrations()` filters on the grant's firm
 *    itself. A belt that passes with the braces cut is not evidence about the
 *    braces; §1 here is, and it went RED on the same mutation (CARL read
 *    Northwind's claim).
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { withSessionScope } from '../../db/session-scope.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { normaliseCompany } from '../../model/partner-portal.ts'
import {
  DEAL_SUBMISSION_REFUSALS,
  TRIAL_REQUEST_REFUSALS,
  requestTrialTenant,
  submitDealRegistration,
} from '../../server/data-plane/partner-portal-store.ts'
import {
  ANA,
  BEN,
  CARL,
  CONTOSO,
  HANDLES,
  NORTHWIND,
  asMigrator,
  digestOf,
  seedPartnerPortal,
} from './partner-fixture.ts'
import { inPartnerAct } from './partner-act.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PARTNER_DEALS_DB_NAME'] ?? runScopedName('reconcile_partner_deals_test')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the partner deals suite', probe)

const ana = { handle: HANDLES.ana, user: ANA, firm: NORTHWIND }
const ben = { handle: HANDLES.ben, user: BEN, firm: NORTHWIND }
const carl = { handle: HANDLES.carl, user: CARL, firm: CONTOSO }

let pool: TenantPool

const TABLES = ['deal_registration', 'partner_sandbox', 'partner_sandbox_request', 'trial_tenant_request'] as const

async function refusal(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (err) {
    return (err as Error).message
  }
}

describe('a partner firm’s deals, sandbox and trials (0322)', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await seedPartnerPortal()
    pool = await createAppPool(2)
    await inPartnerAct(pool, ben, CAPABILITIES.registerDeal, (tx, g) =>
      submitDealRegistration(tx, g, { shape: 'deal', company: 'Initech', annualValue: { currency: 'SGD', amountMinor: 1000n, exponent: 2 }, expectedClose: '2027-01-01' }),
    )
    await inPartnerAct(pool, carl, CAPABILITIES.registerDeal, (tx, g) =>
      submitDealRegistration(tx, g, { shape: 'customer_claim', company: 'Umbrella', rationale: 'r', resaleScope: ['ap'] }),
    )
    await asMigrator(
      `INSERT INTO tenant.partner_sandbox (partner_id, standing, seed_version) VALUES ($1, 'live', 'seed-7'), ($2, 'live', 'seed-7')`,
      [NORTHWIND, CONTOSO],
    )
  })
  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  it('1 · BARE reads: an act reads its OWN firm’s rows and no other firm’s', async () => {
    const nw = await inPartnerAct(pool, ana, CAPABILITIES.viewDeals, async (tx) =>
      (await tx.query(`SELECT company FROM tenant.deal_registration`)).rows,
    )
    assert.deepEqual(nw, [{ company: 'Initech' }], 'a Northwind act read another firm’s claim (or none of its own)')
    const sbx = await inPartnerAct(pool, ana, CAPABILITIES.viewSandbox, async (tx) =>
      (await tx.query(`SELECT partner_id FROM tenant.partner_sandbox`)).rows,
    )
    assert.deepEqual(sbx, [{ partner_id: NORTHWIND }])
  })

  it('1b · OUTSIDE an act, and under the wrong verb, every table reads EMPTY', async () => {
    for (const t of TABLES) {
      const plain = await withSessionScope(pool, digestOf(HANDLES.ana), async (tx) =>
        (await tx.query(`SELECT count(*)::int AS n FROM tenant.${t}`)).rows[0] as { n: number },
      )
      assert.equal(plain.n, 0, `${t} is readable in a plain session scope — not keyed on the act’s receipt`)
    }
    const wrongVerb = await inPartnerAct(pool, ana, CAPABILITIES.viewPartnerStaff, async (tx) =>
      (await tx.query(`SELECT count(*)::int AS n FROM tenant.deal_registration`)).rows[0] as { n: number },
    )
    assert.equal(wrongVerb.n, 0, 'a view_partner_staff receipt opened the deal registry')
  })

  it('2 · the write pins standing, received_at and the submitter — and the firm is the receipt’s', async () => {
    const tries: Array<[string, string]> = [
      ['an ACCEPTED claim', `INSERT INTO tenant.deal_registration (id, partner_id, shape, company, submitted_by, received_at, standing)
                             VALUES ('d1', '${NORTHWIND}', 'deal', 'A1', '${BEN}', now(), 'accepted')`],
      ['a BACKDATED claim', `INSERT INTO tenant.deal_registration (id, partner_id, shape, company, submitted_by, received_at, standing)
                             VALUES ('d2', '${NORTHWIND}', 'deal', 'A2', '${BEN}', now() - interval '30 days', 'waiting')`],
      ['ANOTHER submitter', `INSERT INTO tenant.deal_registration (id, partner_id, shape, company, submitted_by, received_at, standing)
                             VALUES ('d3', '${NORTHWIND}', 'deal', 'A3', '${ANA}', now(), 'waiting')`],
      ['ANOTHER firm', `INSERT INTO tenant.deal_registration (id, partner_id, shape, company, submitted_by, received_at, standing)
                        VALUES ('d4', '${CONTOSO}', 'deal', 'A4', '${BEN}', now(), 'waiting')`],
    ]
    for (const [what, sql] of tries) {
      const err = await inPartnerAct(pool, ben, CAPABILITIES.registerDeal, (tx) => refusal(() => tx.query(sql)))
      assert.match(err ?? 'COMMITTED', /row-level security/, `${what} was COMMITTED`)
    }
    const viewOnly = await inPartnerAct(pool, ben, CAPABILITIES.viewDeals, (tx) =>
      refusal(() =>
        tx.query(`INSERT INTO tenant.deal_registration (id, partner_id, shape, company, submitted_by, received_at, standing)
                  VALUES ('d5', '${NORTHWIND}', 'deal', 'A5', '${BEN}', now(), 'waiting')`),
      ),
    )
    assert.match(viewOnly ?? 'COMMITTED', /row-level security/, 'a view_deals receipt wrote a claim')
  })

  it('2b · 0470: a deal value is WHOLE money or none, and never both the old string and the new money (G3561, G3562)', async () => {
    /* Each refused even for the migrator, which bypasses RLS: these are
       CHECKs on the table, not policies on a role. */
    const base = `INSERT INTO tenant.deal_registration (id, partner_id, shape, company, submitted_by, received_at, standing`
    const tries: Array<[string, string]> = [
      ['an amount with no currency', `${base}, annual_value_minor, annual_value_exponent)
         VALUES ('m1', '${NORTHWIND}', 'deal', 'M1', '${BEN}', now(), 'waiting', 100, 2)`],
      ['a currency with no amount', `${base}, annual_value_currency)
         VALUES ('m2', '${NORTHWIND}', 'deal', 'M2', '${BEN}', now(), 'waiting', 'SGD')`],
      ['the old string AND the new money', `${base}, annual_value, annual_value_minor, annual_value_currency, annual_value_exponent)
         VALUES ('m3', '${NORTHWIND}', 'deal', 'M3', '${BEN}', now(), 'waiting', '1', 100, 'SGD', 2)`],
    ]
    for (const [what, sql] of tries) {
      const err = await refusal(() => asMigrator(sql))
      assert.match(err ?? 'COMMITTED', /deal_registration_value_(is_whole_money|old_or_new)/, `${what} was COMMITTED`)
    }
    /* THE EXISTING ROWS ARE NOT BACKFILLED (G3562): a pre-0470 row — the old
       string, no currency — is still a legal row, and nothing invents SGD. */
    await asMigrator(`${base}, annual_value) VALUES ('m4', '${NORTHWIND}', 'deal', 'M4', '${BEN}', now(), 'waiting', '180000')`)
    const kept = await asMigrator(
      `SELECT annual_value, annual_value_currency FROM tenant.deal_registration WHERE id = 'm4'`,
    )
    assert.deepEqual(kept, [{ annual_value: '180000', annual_value_currency: null }])
    await asMigrator(`DELETE FROM tenant.deal_registration WHERE id = 'm4'`)
  })

  it('3 · one standing claim per company across EVERY firm, compared after normalisation', async () => {
    const out = await inPartnerAct(pool, carl, CAPABILITIES.registerDeal, (tx, g) =>
      submitDealRegistration(tx, g, { shape: 'deal', company: ' INITECH ', annualValue: { currency: 'SGD', amountMinor: 100n, exponent: 2 }, expectedClose: 'x' }),
    )
    assert.deepEqual(out, { ok: false, refusal: DEAL_SUBMISSION_REFUSALS.companyAlreadyClaimed })
    await asMigrator(`UPDATE tenant.deal_registration SET standing = 'refused' WHERE company = 'Initech'`)
    const released = await inPartnerAct(pool, carl, CAPABILITIES.registerDeal, (tx, g) =>
      submitDealRegistration(tx, g, { shape: 'deal', company: ' INITECH ', annualValue: { currency: 'SGD', amountMinor: 100n, exponent: 2 }, expectedClose: 'x' }),
    )
    assert.equal(released.ok, true, 'a REFUSED claim still held the company')
  })

  it('3b · the generated key and normaliseCompany() are ONE rule — evaluated from the COLUMN’s own expression', async () => {
    /* The expression is read back from the catalogue and evaluated, so this
     * compares the model against the column as deployed, not against a copy
     * of it typed into this file.
     *
     * ⚠️ 'Ünïcode' and the no-break space are the two cases that FOUND G2636:
     * without `COLLATE "C"`, `lower()` follows the database's collation while
     * JavaScript lowered `Ü`; and JavaScript's `\s` matched U+00A0 while the
     * database's did not — two normalisations of one precedence key. */
    const col = await asMigrator(
      `SELECT generation_expression AS e FROM information_schema.columns
        WHERE table_schema = 'tenant' AND table_name = 'deal_registration' AND column_name = 'company_key'`,
    )
    const expression = String(col[0]?.['e'])
    assert.match(expression, /\bcompany\b/, `the generated column does not read \`company\`: ${expression}`)
    for (const raw of ['  Acme   Corp ', 'ACME\tcorp', 'acme\n corp', 'Ünïcode  Gmbh', 'nb\u00a0 sp', 'x']) {
      const rows = await asMigrator(`SELECT ${expression.replace(/\bcompany\b/g, '$1::text')} AS k`, [raw])
      assert.equal(rows[0]?.['k'], normaliseCompany(raw), `the database and the model normalise ${JSON.stringify(raw)} differently`)
    }
  })

  it('4 · a trial request needs an ACCEPTED registration of the OWN firm — one answer for every miss', async () => {
    const contosoReg = String(
      (await asMigrator(`SELECT id FROM tenant.deal_registration WHERE partner_id = $1 LIMIT 1`, [CONTOSO]))[0]?.['id'],
    )
    await inPartnerAct(pool, ben, CAPABILITIES.registerDeal, (tx, g) =>
      submitDealRegistration(tx, g, { shape: 'deal', company: 'Wayne Enterprises', annualValue: { currency: 'SGD', amountMinor: 500n, exponent: 2 }, expectedClose: 'q3' }),
    )
    const nwReg = String(
      (await asMigrator(`SELECT id FROM tenant.deal_registration WHERE company = 'Wayne Enterprises'`))[0]?.['id'],
    )
    const waiting = await inPartnerAct(pool, ben, CAPABILITIES.registerDeal, (tx, g) =>
      requestTrialTenant(tx, g, { registrationId: nwReg }),
    )
    const foreign = await inPartnerAct(pool, ben, CAPABILITIES.registerDeal, (tx, g) =>
      requestTrialTenant(tx, g, { registrationId: contosoReg }),
    )
    const unknown = await inPartnerAct(pool, ben, CAPABILITIES.registerDeal, (tx, g) =>
      requestTrialTenant(tx, g, { registrationId: 'dreg_nope' }),
    )
    for (const out of [waiting, foreign, unknown]) {
      assert.deepEqual(out, { ok: false, refusal: TRIAL_REQUEST_REFUSALS.registrationNotAccepted })
    }
    await asMigrator(`UPDATE tenant.deal_registration SET standing = 'accepted' WHERE id = $1`, [nwReg])
    const ok = await inPartnerAct(pool, ben, CAPABILITIES.registerDeal, (tx, g) =>
      requestTrialTenant(tx, g, { registrationId: nwReg, note: 'pilot' }),
    )
    assert.deepEqual(ok, { ok: true })
  })

  it('5 · privileges, policy shape, RLS, and no tenant column anywhere', async () => {
    const want: Record<string, Record<string, boolean>> = {
      deal_registration: { SELECT: true, INSERT: true, UPDATE: false, DELETE: false },
      partner_sandbox: { SELECT: true, INSERT: false, UPDATE: false, DELETE: false },
      partner_sandbox_request: { SELECT: true, INSERT: true, UPDATE: false, DELETE: false },
      trial_tenant_request: { SELECT: true, INSERT: true, UPDATE: false, DELETE: false },
    }
    for (const [t, verbs] of Object.entries(want)) {
      for (const [v, expected] of Object.entries(verbs)) {
        const r = await asMigrator(`SELECT has_table_privilege('tenant_rw', 'tenant.${t}', '${v}') AS p`)
        assert.equal(r[0]?.['p'], expected, `tenant_rw ${expected ? 'lacks' : 'holds'} ${v} on ${t}`)
      }
    }
    const all = await asMigrator(
      `SELECT tablename FROM pg_policies WHERE schemaname = 'tenant' AND cmd = 'ALL' AND tablename = ANY($1)`,
      [[...TABLES]],
    )
    assert.deepEqual(all, [])
    const rls = await asMigrator(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'tenant' AND c.relname = ANY($1) AND c.relrowsecurity AND c.relforcerowsecurity`,
      [[...TABLES]],
    )
    assert.equal(rls.length, 4)
    const tenantCols = await asMigrator(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'tenant' AND column_name = 'tenant_id' AND table_name = ANY($1)`,
      [[...TABLES]],
    )
    assert.deepEqual(tenantCols, [], 'a partner-portal table names a tenant — invariant 2’s second path, in a column')
  })
})

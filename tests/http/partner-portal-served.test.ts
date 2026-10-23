/**
 * THE PARTNER PORTAL, SERVED — W5, 1 Oct 2026, G2633–G2640.
 *
 * The first five partner-portal operations either plane has mounted, driven
 * over a REAL SOCKET against the PRODUCTION authoriser and substrate (neither
 * is passed to `startDataPlane()`), on a real PostgreSQL. Every act must pass
 * the gate on `decide()`'s FIFTH ARM, leave a record in invariant 10's THIRD
 * home, and read its data only through that record.
 *
 * 🛑 §6 IS THE ASSERTION THE SLICE IS JUDGED ON: invariant 2's single path is
 *    still the only one. A partner administrator holding every portal verb and
 *    no `PartnerAccessGrant` reaches nothing inside a customer tenant.
 *
 * ⚠️ REDS WITNESSED BEFORE THE MOUNTS WERE TRUSTED:
 *   · with `listDealRegistrations` mounted as a BARE handler, the plane refused
 *     to boot at the sixth fence — §7, re-witnessed on every run;
 *   · with `authorisedHandler()`'s partner branch removed, the first act
 *     answered 500 — `0091`'s platform home cannot hold a partner record and the
 *     seam had no other — §1 (captured on the commit before `0320`'s writer).
 */
/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'

const CONTROL_DB =
  process.env['RECONCILE_PARTNER_SERVED_CONTROL_DB'] ?? runScopedName('reconcile_partner_served_control')
const TENANT_DB = process.env['RECONCILE_PARTNER_SERVED_TENANT_DB'] ?? runScopedName('reconcile_partner_served_tenant')

process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_WRITE_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_DB_NAME'] = TENANT_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

/* The PRODUCTION session reader: no test token, no dev fence. */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const PARTNERS = 'partners.reconcile.invalid'
const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
process.env['RECONCILE_SERVING_HOSTS'] = `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${PARTNERS}|partner|active`

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served partner portal', probe)

import { loadTier } from '../../server/contract/document.ts'
import { resetSchema, seedTwoTenants } from '../../db/provision.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { buildPlane, type Handler } from '../../server/http/app.ts'
import { provisionControlPlane } from '../../server/control-plane/provision.ts'
import { sessionCookie } from './harness.ts'
import {
  ANA,
  BEN,
  CARL,
  HANDLES,
  NORTHWIND,
  PARTNERS_HOST,
  asMigrator,
  digestOf,
  seedPartnerPortal,
} from '../db/partner-fixture.ts'
import { runScopedName } from '../run-scoped-db.ts'

assert.equal(PARTNERS_HOST, PARTNERS, 'the fixture issues its sessions on a different host from the one registered here')

/** ANA again, but on a CUSTOMER tenant host — the door invariant 2 guards. */
const ANA_ON_ACME = 'sh_ana_acme_9a8b7c6d5e4f30211f2e3d4c5b6a7980'

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function send(
  base: string,
  path: string,
  opts: { host: string; session?: string; method?: string; body?: unknown },
): Promise<Response> {
  const url = new URL(path, base)
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body)
  const headers: Record<string, string> = {
    Host: opts.host,
    accept: 'application/json',
    ...(opts.session === undefined ? {} : sessionCookie(opts.session)),
  }
  if (payload !== undefined) {
    headers['content-type'] = 'application/json'
    headers['content-length'] = String(Buffer.byteLength(payload))
  }
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: url.hostname, port: url.port, path: url.pathname + url.search, method: opts.method ?? 'GET', headers },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => {
          text += c
        })
        res.on('end', () => {
          let body: Record<string, unknown> | undefined
          try {
            const parsed: unknown = JSON.parse(text)
            body = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined
          } catch {
            body = undefined
          }
          resolve({ status: res.statusCode ?? 0, body, text })
        })
      },
    )
    req.on('error', reject)
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

async function rebuildControlDatabase(): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-partner-served-setup',
  })
  await admin.connect()
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [CONTROL_DB],
    )
    await admin.query(`DROP DATABASE IF EXISTS ${CONTROL_DB}`)
    await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TENANT_DB])
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${TENANT_DB}`)
  } finally {
    await admin.end()
  }
}

function requiredOf(schemaName: string): readonly string[] {
  const doc = loadTier('administration') as unknown as {
    components: { schemas: Record<string, { required?: string[] }> }
  }
  const s = doc.components.schemas[schemaName]
  assert.ok(s !== undefined, `${schemaName} is not in the administration document`)
  return s.required ?? []
}

const DEALS = '/v1/partner/registrations'
const SANDBOX = '/v1/partner/sandbox'
const PEOPLE = '/v1/partner/people'
const INVITATIONS = '/v1/partner/invitations'

describe('the partner portal, served (W5)', { skip }, () => {
  let plane: { url: string; close: () => Promise<void> }

  before(async () => {
    await rebuildControlDatabase()
    await provisionControlPlane()
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await seedPartnerPortal()
    await asMigrator(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_ana_acme', $1, $2, 'idc_northwind_okta', NULL, $3, now(), now(), now() + interval '12 hours', NULL)`,
      [digestOf(ANA_ON_ACME), ANA, ACME_HOST],
    )
    plane = await startDataPlane({ poolMax: 4 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  it('1 · a partner user lists the firm’s registry — empty, and a 200', async () => {
    const res = await send(plane.url, DEALS, { host: PARTNERS, session: HANDLES.ben })
    assert.equal(
      res.status,
      200,
      'THE FIRST PARTNER-PORTAL READ DID NOT ANSWER 200. Four things must hold: the tier is ' +
        'mounted, the session resolves a tenant-less PARTNER subject on the partners host, the ' +
        'fifth arm allows `view_deals` from BEN’s portal role, and `authorize()` mints the third ' +
        `home so the seam has somewhere to write the record. Body: ${res.text}`,
    )
    assert.deepEqual(res.body, { registrations: [] })
  })

  it('2 · a registration is RECEIVED, not registered — 202, our time, standing waiting', async () => {
    const res = await send(plane.url, DEALS, {
      host: PARTNERS,
      session: HANDLES.ben,
      method: 'POST',
      body: { shape: 'deal', company: '  Initech   Holdings ', annualValue: { currency: 'SGD', amountMinor: '12000000', exponent: 2 }, expectedClose: '2026-12-31', contact: 'Peter' },
    })
    assert.equal(res.status, 202, res.text)
    for (const k of requiredOf('DealRegistrationReceipt')) assert.ok(res.body?.[k] !== undefined, `receipt lacks required ${k}`)
    assert.equal(res.body?.['standing'], 'waiting')
    assert.ok(Math.abs(Date.parse(String(res.body?.['receivedAt'])) - Date.now()) < 60_000, 'receivedAt is not our clock')
  })

  it('2b · the registry is the FIRM’s: ANA sees BEN’s claim, CARL (Contoso) does not', async () => {
    const ana = await send(plane.url, DEALS, { host: PARTNERS, session: HANDLES.ana })
    assert.equal(ana.status, 200, ana.text)
    const rows = (ana.body?.['registrations'] ?? []) as Array<Record<string, unknown>>
    assert.equal(rows.length, 1)
    for (const k of requiredOf('DealRegistrationSummary')) assert.ok(rows[0]?.[k] !== undefined, `summary lacks required ${k}`)
    assert.equal(rows[0]?.['company'], '  Initech   Holdings ', 'the company was not stored verbatim')
    const carl = await send(plane.url, DEALS, { host: PARTNERS, session: HANDLES.carl })
    assert.deepEqual(carl.body, { registrations: [] }, 'another firm’s registry is visible — the receipt’s firm did not narrow the read')
    const filtered = await send(plane.url, `${DEALS}?standing=accepted`, { host: PARTNERS, session: HANDLES.ana })
    assert.deepEqual(filtered.body, { registrations: [] })
  })

  it('2c · a second firm’s claim on the same company is a 422 that names nobody', async () => {
    const res = await send(plane.url, DEALS, {
      host: PARTNERS,
      session: HANDLES.carl,
      method: 'POST',
      body: { shape: 'customer_claim', company: 'initech holdings', rationale: 'Ours', resaleScope: ['ap'] },
    })
    assert.equal(res.status, 422, res.text)
    assert.equal(res.body?.['code'], 'validation_failed')
    assert.doesNotMatch(res.text, /northwind|ben|ana/i, 'the collision refusal named the rival — "a map of everyone’s pipeline"')
  })

  it('2d · a body that breaks its shape, or smuggles a standing, is refused and writes nothing', async () => {
    const mismatch = await send(plane.url, DEALS, {
      host: PARTNERS,
      session: HANDLES.ben,
      method: 'POST',
      body: { shape: 'deal', company: 'Globex', rationale: 'a claim field on a deal' },
    })
    assert.equal(mismatch.status, 422, mismatch.text)
    const smuggled = await send(plane.url, DEALS, {
      host: PARTNERS,
      session: HANDLES.ben,
      method: 'POST',
      body: { shape: 'deal', company: 'Hooli', annualValue: { currency: 'SGD', amountMinor: '100', exponent: 2 }, expectedClose: 'x', standing: 'accepted' },
    })
    assert.notEqual(smuggled.status, 202, 'ajv let `standing` through — G191’s removeAdditional: false')
    const rows = await asMigrator(`SELECT company FROM tenant.deal_registration ORDER BY company`)
    assert.deepEqual(rows, [{ company: '  Initech   Holdings ' }])
  })

  it('2c · the deal value is money with its currency — G3561: stored through the codec; a bare decimal and a non-positive amount are refused', async () => {
    /* The received row from §2 carries the codec's three fields and NO
       undenominated string (`0470` §4). */
    const stored = await asMigrator(
      `SELECT annual_value, annual_value_minor::text AS minor, annual_value_currency AS currency,
              annual_value_exponent AS exponent
         FROM tenant.deal_registration WHERE company = '  Initech   Holdings '`,
    )
    assert.deepEqual(stored, [{ annual_value: null, minor: '12000000', currency: 'SGD', exponent: 2 }])

    /* Before G3561 a bare `DecimalAmount` string was the ONLY form the wire
       took — §2 of this suite sent `'120000.00'` and was answered 202, a value
       with no currency at all. It is a schema refusal now (400, G191). */
    const bare = await send(plane.url, DEALS, {
      host: PARTNERS,
      session: HANDLES.ben,
      method: 'POST',
      body: { shape: 'deal', company: 'Pied Piper', annualValue: '180000', expectedClose: 'q4' },
    })
    assert.equal(bare.status, 400, bare.text)
    const nought = await send(plane.url, DEALS, {
      host: PARTNERS,
      session: HANDLES.ben,
      method: 'POST',
      body: { shape: 'deal', company: 'Pied Piper', annualValue: { currency: 'SGD', amountMinor: '0', exponent: 2 }, expectedClose: 'q4' },
    })
    assert.equal(nought.status, 422, nought.text)
    const lower = await send(plane.url, DEALS, {
      host: PARTNERS,
      session: HANDLES.ben,
      method: 'POST',
      body: { shape: 'deal', company: 'Pied Piper', annualValue: { currency: 'sgd', amountMinor: '100', exponent: 2 }, expectedClose: 'q4' },
    })
    assert.equal(lower.status, 400, `a currency is three upper-case letters on the wire: ${lower.text}`)
    const rows = await asMigrator(`SELECT company FROM tenant.deal_registration WHERE company = 'Pied Piper'`)
    assert.deepEqual(rows, [], 'a refused value was stored')
  })

  it('3 · the sandbox: `none` is an answer; one request per firm; a user may not operate it', async () => {
    const view = await send(plane.url, SANDBOX, { host: PARTNERS, session: HANDLES.ana })
    assert.equal(view.status, 200, view.text)
    assert.deepEqual(view.body, { standing: 'none' })
    const asked = await send(plane.url, SANDBOX, { host: PARTNERS, session: HANDLES.ana, method: 'POST' })
    assert.equal(asked.status, 202, asked.text)
    /* G3701 — NP-01, THE OWNER'S: *"Report 'requested'"*. A firm that has
       asked is told so on the next read, not offered the ask again.
       WITNESSED RED before the store change: `{ standing: 'none' }`. */
    const pending = await send(plane.url, SANDBOX, { host: PARTNERS, session: HANDLES.ana })
    assert.equal(pending.status, 200, pending.text)
    assert.equal(pending.body?.['standing'], 'requested', `an open request read as: ${pending.text}`)
    assert.ok(
      typeof pending.body?.['requestedAt'] === 'string' && !Number.isNaN(Date.parse(String(pending.body?.['requestedAt']))),
      `requested carries when it was asked: ${pending.text}`,
    )
    assert.deepEqual(Object.keys(pending.body ?? {}).sort(), ['requestedAt', 'standing'], 'a requested plane fabricated a live field')
    const contosoBefore = await send(plane.url, SANDBOX, { host: PARTNERS, session: HANDLES.carl })
    assert.deepEqual(contosoBefore.body, { standing: 'none' }, 'one firm’s request is read as another’s')
    const again = await send(plane.url, SANDBOX, { host: PARTNERS, session: HANDLES.ana, method: 'POST' })
    assert.equal(again.status, 409, again.text)
    assert.equal(again.body?.['code'], 'idempotency_conflict')
    const contoso = await send(plane.url, SANDBOX, { host: PARTNERS, session: HANDLES.carl, method: 'POST' })
    assert.equal(contoso.status, 202, 'one firm’s request blocked another’s — the unique key is per FIRM')
    const ben = await send(plane.url, SANDBOX, { host: PARTNERS, session: HANDLES.ben })
    assert.equal(ben.status, 403, `a partner user without view_sandbox was served: ${ben.text}`)
  })

  it('4 · the roster: the owner’s ruling, over a socket — the firm’s people, the wire’s four fields', async () => {
    const res = await send(plane.url, PEOPLE, { host: PARTNERS, session: HANDLES.ana })
    assert.equal(res.status, 200, res.text)
    const people = (res.body?.['people'] ?? []) as Array<Record<string, unknown>>
    assert.deepEqual(
      people.map((p) => p['email']),
      ['ana@northwind.invalid', 'ben@northwind.invalid'],
      'the roster is not exactly Northwind’s two role-holders — DORA (no role) or CARL (Contoso) on it is a widened directory',
    )
    for (const p of people) for (const k of requiredOf('PartnerPerson')) assert.ok(p[k] !== undefined, `PartnerPerson lacks required ${k}`)
    assert.deepEqual(res.body?.['invitations'], [], 'G2904: `invitations` is required and EMPTY before anybody is invited — never absent')
    const ben = await send(plane.url, PEOPLE, { host: PARTNERS, session: HANDLES.ben })
    assert.equal(ben.status, 403, `a partner user read the roster: ${ben.text}`)
  })

  /* ✅ 2 Oct 2026 — G2801, THE OWNER'S: *"Drop `name` from invitePartnerPerson's
   * 201 (filled at redemption). Then mount it …"* The 201 is an
   * `InvitedPartnerPerson`; every one of its `required` fields is produced, and
   * `name` is ABSENT rather than empty — the serialiser would throw on a
   * missing required field (G1244), which is exactly why G2630 held this back. */
  it('4b · an invitation is MADE over a socket: 201, the wire’s required fields, no name; a user is refused; a repeat is a 422', async () => {
    const res = await send(plane.url, INVITATIONS, {
      host: PARTNERS,
      session: HANDLES.ana,
      method: 'POST',
      body: { email: 'erin@northwind.invalid', role: 'partner_user' },
    })
    assert.equal(res.status, 201, `THE INVITATION WAS NOT MADE. Body: ${res.text}`)
    for (const k of requiredOf('InvitedPartnerPerson')) assert.ok(res.body?.[k] !== undefined, `InvitedPartnerPerson lacks required ${k}`)
    assert.deepEqual(res.body, { email: 'erin@northwind.invalid', role: 'Partner user', state: 'invited' })
    assert.ok(!requiredOf('InvitedPartnerPerson').includes('name'), 'the owner’s ruling dropped `name` from this 201')
    const rows = await asMigrator(`SELECT partner_id, invited_by FROM tenant.partner_invitation WHERE email = 'erin@northwind.invalid'`)
    assert.deepEqual(rows, [{ partner_id: NORTHWIND, invited_by: ANA }])

    const again = await send(plane.url, INVITATIONS, {
      host: PARTNERS,
      session: HANDLES.ana,
      method: 'POST',
      body: { email: 'ERIN@northwind.invalid', role: 'partner_administrator' },
    })
    assert.equal(again.status, 422, again.text)
    const ben = await send(plane.url, INVITATIONS, {
      host: PARTNERS,
      session: HANDLES.ben,
      method: 'POST',
      body: { email: 'fay@northwind.invalid', role: 'partner_user' },
    })
    assert.equal(ben.status, 403, `a partner user without manage_partner_staff invited somebody: ${ben.text}`)
    const self = await send(plane.url, INVITATIONS, {
      host: PARTNERS,
      session: HANDLES.ana,
      method: 'POST',
      body: { email: 'ana@northwind.invalid', role: 'partner_user' },
    })
    assert.equal(self.status, 403, `an administrator invited her own address: ${self.text}`)
    assert.equal(self.body?.['code'], 'capability_not_held')
    const delivery = await send(plane.url, INVITATIONS, {
      host: PARTNERS,
      session: HANDLES.ana,
      method: 'POST',
      body: { email: 'gil@northwind.invalid', role: 'partner_delivery' },
    })
    assert.equal(delivery.status, 400, `partner delivery is not invitable, by the schema: ${delivery.text}`)
  })

  /* ✅ 2 Oct 2026 — G2904 (derived, closing G2808) and G2903 (closing G2811),
   * over a socket. The roster carries STANDING, UNREDEEMED offers in a second
   * array of the 201's own shape; a LAPSED offer is on neither list and no
   * longer blocks re-inviting its address. */
  it('4c · the roster lists the open offer as `invited`; a lapsed offer is off it and its address can be invited again', async () => {
    await asMigrator(
      `INSERT INTO tenant.partner_invitation
         (id, partner_id, email, role_id, role_version, invited_by, invited_at,
          expires_at, assignment_expires_at, authorization_id)
       VALUES ('pinv_lapsed_zoe', $1, 'zoe@northwind.invalid', 'prl_nw_user', 1, $2,
               now() - interval '15 days', now() - interval '1 day', now() + interval '60 days', 'azg_seeded')`,
      [NORTHWIND, ANA],
    )
    const before = await send(plane.url, PEOPLE, { host: PARTNERS, session: HANDLES.ana })
    assert.equal(before.status, 200, before.text)
    assert.deepEqual(
      before.body?.['invitations'],
      [{ email: 'erin@northwind.invalid', role: 'Partner user', state: 'invited' }],
      'the roster’s open offers are not exactly ERIN’s standing one — a lapsed offer (ZOE) listed as `invited` asserts a standing nobody holds',
    )
    for (const inv of before.body?.['invitations'] as Array<Record<string, unknown>>) {
      for (const k of requiredOf('InvitedPartnerPerson')) assert.ok(inv[k] !== undefined, `an invitation lacks required ${k}`)
      assert.equal(inv['name'], undefined, 'an invitee was given a name nothing produced')
    }
    const people = (before.body?.['people'] ?? []) as Array<Record<string, unknown>>
    assert.ok(!people.some((p) => p['email'] === 'erin@northwind.invalid'), 'an unredeemed invitee is on `people` as a role-holder')

    const reinvite = await send(plane.url, INVITATIONS, {
      host: PARTNERS,
      session: HANDLES.ana,
      method: 'POST',
      body: { email: 'zoe@northwind.invalid', role: 'partner_user' },
    })
    assert.equal(reinvite.status, 201, `G2811: a LAPSED offer still blocked re-inviting its address: ${reinvite.text}`)
    const after = await send(plane.url, PEOPLE, { host: PARTNERS, session: HANDLES.ana })
    assert.deepEqual(
      ((after.body?.['invitations'] ?? []) as Array<Record<string, unknown>>).map((i) => i['email']),
      ['erin@northwind.invalid', 'zoe@northwind.invalid'],
    )
  })

  it('5 · every served act left a record in the THIRD home, and none in the other two', async () => {
    const partner = await asMigrator(
      `SELECT subject_user_id, capability FROM tenant.partner_authorization_grant ORDER BY issued_at`,
    )
    const caps = new Set(partner.map((r) => String(r['capability'])))
    for (const c of ['view_deals', 'register_deal', 'view_sandbox', 'operate_sandbox', 'view_partner_staff', 'manage_partner_staff']) {
      assert.ok(caps.has(c), `no partner record for a served ${c} act`)
    }
    assert.ok(partner.every((r) => [ANA, BEN, CARL].includes(String(r['subject_user_id']))))
    const firms = await asMigrator(`SELECT DISTINCT partner_id FROM tenant.partner_authorization_grant ORDER BY 1`)
    assert.deepEqual(firms.map((r) => r['partner_id']), ['prt_contoso', NORTHWIND])
    const platform = await asMigrator(`SELECT count(*)::int AS n FROM tenant.platform_authorization_grant`)
    const tenant = await asMigrator(`SELECT count(*)::int AS n FROM tenant.authorization_grant`)
    assert.equal(platform[0]?.['n'], 0, 'a portal act was recorded as a 1CloudHub STAFF act (G2327)')
    assert.equal(tenant[0]?.['n'], 0, 'a portal act was recorded in a TENANT — invariant 2’s second path, written in a row')
  })

  it('6 · INVARIANT 2: every portal verb and no PartnerAccessGrant reaches nothing inside a tenant', async () => {
    const onPartners = await send(plane.url, '/v1/runs', { host: PARTNERS, session: HANDLES.ana })
    assert.notEqual(onPartners.status, 200, `a portal session listed a tenant’s runs: ${onPartners.text}`)
    const onAcme = await send(plane.url, '/v1/runs', { host: ACME_HOST, session: ANA_ON_ACME })
    assert.notEqual(onAcme.status, 200, `a partner administrator with no grant read Acme: ${onAcme.text}`)
    const dealsOnAcme = await send(plane.url, DEALS, { host: ACME_HOST, session: ANA_ON_ACME })
    assert.notEqual(dealsOnAcme.status, 200, 'the firm’s portal answered on a CUSTOMER’s host — the customer’s door to the firm')
    const tenant = await asMigrator(`SELECT count(*)::int AS n FROM tenant.authorization_grant`)
    assert.equal(tenant[0]?.['n'], 0)
  })

  it('6b · unauthenticated is a 401 on every mounted portal operation', async () => {
    for (const [path, method] of [[DEALS, 'GET'], [DEALS, 'POST'], [SANDBOX, 'GET'], [SANDBOX, 'POST'], [PEOPLE, 'GET'], [INVITATIONS, 'POST']] as const) {
      const body =
        method === 'POST' && path === DEALS
          ? { body: { shape: 'deal', company: 'x' } }
          : path === INVITATIONS
            ? { body: { email: 'x@y.invalid', role: 'partner_user' } }
            : {}
      const res = await send(plane.url, path, { host: PARTNERS, method, ...body })
      assert.equal(res.status, 401, `${method} ${path} answered ${res.status} with no session`)
    }
  })

  it('7 · the SIXTH fence: a BARE handler for any of the six refuses to BOOT', async () => {
    for (const operationId of [
      'listDealRegistrations',
      'submitDealRegistration',
      'getSandboxTenant',
      'requestSandboxTenant',
      'listPartnerPeople',
      'invitePartnerPerson',
    ]) {
      const bare: Handler = async () => ({})
      await assert.rejects(
        async () => {
          const app = await buildPlane<{ tenantId: string | null }>(
            {
              plane: 'test-partner-plane',
              authenticate: () => ({ tenantId: null }),
              unauthenticatedDetail: 'no session',
              authorise: () => 'held',
              unauthorisedDetail: 'no capability',
            },
            [{ tier: 'administration', handlers: { [operationId]: bare } }],
          )
          await app.close()
        },
        (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          assert.ok(message.includes(operationId) && message.includes('authorisation record'), message)
          return true
        },
      )
    }
  })
})

/**
 * G3354–G3360 — `getSessionPrincipal`, `GET /session/principal`, SERVED. The
 * chrome's who-am-I, against the PRODUCTION authoriser over two real databases.
 *
 *   §1  a BOUND customer session: the person AS STORED, `orgClass` from
 *       `orgFor()`, and the tenant's name read from the CONTROL database's
 *       roster — the body's key set EXACTLY, at both levels (K6's subtractive
 *       arm, asserted by name because `tests/http/required-fields-served.test.ts`
 *       provisions no control database and holds this operation out).
 *   §1b the directory's display name is returned BYTE FOR BYTE, markup and all
 *       — stored verbatim, parsed by nothing (D6-9). It is the CLIENT's job to
 *       render it as text, and §1b is what makes that job necessary.
 *   §2  a tenant the roster holds no row for answers `name: null` — never an
 *       invented name, and never the id dressed as one.
 *   §3  an UNBOUND session answers `tenant: null`.
 *   §4  a PLATFORM session on a console host: `orgClass: 'platform'`, no tenant.
 *   §5  no credential is a 401; a tenant named in the query is a 400 (G941).
 *   §6  it names nobody else: another person's name is in no response.
 *   §7  the roster rows come from `db/seeds/staging-control-roster.sql`, applied
 *       as written — so the staging seed is witnessed, not just committed.
 *   §9  G4045 (THE OWNER'S, "Serve role labels") — `roles`: the display names
 *       of the roles the caller LIVE-holds in the bound tenant (customer), or
 *       their platform / partner roles. Live is the GATE's word, never a second
 *       predicate: a revoked assignment and an archived role are not named, and
 *       another member's role never is.
 *   §10 G4046 (THE OWNER'S, "Declare tenant currency") — `tenant.reportingCurrency`
 *       from `0560`'s table, read in the session's own bound tenant; a tenant
 *       that declared none answers `null`, never a default.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { randomBytes } from 'node:crypto'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'

const CONTROL_DB = process.env['RECONCILE_PRINCIPAL_CONTROL_DB_NAME'] ?? runScopedName('reconcile_principal_control_test')
const TENANT_DB = process.env['RECONCILE_PRINCIPAL_TENANT_DB_NAME'] ?? runScopedName('reconcile_principal_tenant_test')

process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_DB_NAME'] = TENANT_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.us-west-2.reconcile.invalid'
const GLOBEX_HOST = 'globex.us-west-2.reconcile.invalid'
const CONSOLE_HOST = 'console.reconcile.invalid'
process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|us-west-2|pooled|active,${GLOBEX_HOST}|ten_globex|us-west-2|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active`

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')
const { resetSchema, migratorClient } = await import('../../db/provision.ts')
const { provisionControlPlane } = await import('../../server/control-plane/provision.ts')
const { digestOfHandle } = await import('../../server/data-plane/handle-digest.ts')
const { startDataPlane } = await import('../../server/data-plane/start.ts')
const { startInternalPair } = await import('./internal-pair.ts')
const { loadTier } = await import('../../server/contract/document.ts')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the session principal suite', probe)

/** What the directory said Mei is called — markup on purpose (§1b). */
const MEI_NAME = 'Mei <img src=x onerror=alert(1)> Tan'
const ROSTER_SEED = readFileSync(new URL('../../db/seeds/staging-control-roster.sql', import.meta.url), 'utf8')

async function q(sql: string, params: unknown[] = []): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql, params)
  } finally {
    await mig.end()
  }
}

async function controlAdmin(database: string): Promise<{ query(s: string): Promise<unknown>; end(): Promise<void> }> {
  const { Client } = await loadPg()
  const c = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database,
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-principal-setup',
  })
  await c.connect()
  return c
}

interface Answer {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function get(origin: string, path: string, host: string, handle: string | null): Promise<Answer> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        headers: {
          Host: host,
          accept: 'application/json',
          ...(handle === null ? {} : { cookie: `__Host-reconcile_session=${handle}` }),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => (text += c))
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
    req.end()
  })
}

async function session(id: string, user: string, door: string, tenant: string | null, host: string): Promise<string> {
  const handle = randomBytes(32).toString('base64url')
  await q(
    `INSERT INTO tenant.session
       (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
        authenticated_at, last_used_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now() + interval '1 hour', NULL)`,
    [id, digestOfHandle(handle), user, door, tenant, host],
  )
  return handle
}

/** The schema's own `required`, so the key-set assertion cannot drift from the contract. */
function requiredOf(name: string): string[] {
  const doc = loadTier('session') as unknown as {
    components: { schemas: Record<string, { required?: string[] }> }
  }
  const schema = doc.components.schemas[name]
  assert.ok(schema?.required !== undefined, `\`${name}\` declares no \`required\` list`)
  return [...schema.required].sort()
}

describe('getSessionPrincipal, served', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }
  let pair: { close(): Promise<void>; client: import('../../server/data-plane/control-plane-client.ts').ControlPlaneClient } | undefined
  let acme = ''
  let globex = ''
  let unbound = ''
  let staff = ''
  let them = ''

  before(async () => {
    /* A FRESH control database every run: `0030`'s append-only triggers refuse
       a DELETE of what an earlier run seeded, which is the property and not an
       obstacle — so the database is dropped rather than emptied. */
    const maint = await controlAdmin('postgres')
    try {
      await maint.query(`DROP DATABASE IF EXISTS ${CONTROL_DB} WITH (FORCE)`)
      await maint.query(`CREATE DATABASE ${CONTROL_DB}`)
    } finally {
      await maint.end()
    }
    await provisionControlPlane()
    const control = await controlAdmin(CONTROL_DB)
    try {
      /* §7 — THE STAGING SEED, AS WRITTEN. */
      await control.query(ROSTER_SEED)
    } finally {
      await control.end()
    }

    await resetSchema()
    for (const t of ['ten_acme', 'ten_globex']) {
      await q(
        `INSERT INTO tenant.tenant (id, status, residency, environment, deployment_mode)
         VALUES ($1, 'active', 'us-west-2', 'sandbox', 'hosted')`,
        [t],
      )
    }
    await q(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, status, broker_issuer, broker_ref)
       VALUES ('idc_pr_cust', 'oidc', 'Customer door', 'customer', NULL, 'acc_pr', 'active',
               'https://broker.pr.invalid', 'pr-cust'),
              ('idc_pr_plat', 'oidc', 'Platform door', 'platform', NULL, NULL, 'active',
               'https://broker.pr.invalid', 'pr-plat')`,
    )
    await q(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id) VALUES
         ('usr_mei', 'mei@acme.invalid', $1, 'active', 'idc_pr_cust'),
         ('usr_them', 'them@acme.invalid', 'Somebody Else Entirely', 'active', 'idc_pr_cust'),
         ('usr_priya', 'priya@1cloudhub.invalid', 'Priya R', 'active', 'idc_pr_plat')`,
      [MEI_NAME],
    )
    for (const t of ['ten_acme', 'ten_globex']) {
      await q(
        `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, 'rol_pr', 'Reader', 'reader', 1, 'operator', 'tenant', NULL, 'active')`,
        [t],
      )
      await q(
        `INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at) VALUES
           ($1, 'mem_mei', 'usr_mei', 'rol_pr', 'test', now()),
           ($1, 'mem_them', 'usr_them', 'rol_pr', 'test', now())`,
        [t],
      )
    }
    /* G3521 — the verbs. Mei holds `view_exception`, `view_endpoint` AND `configure_endpoint`
       in ten_acme; Them holds `view_exception` alone (the persona with no
       Setup); nobody holds anything in ten_globex; Priya holds `view_substrate`
       through a platform assignment. */
    await q(
      `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ('ten_acme', 'rol_pr_admin', 'Admin', 'admin', 1, 'operator', 'tenant', NULL, 'active'),
              ('ten_acme', 'rol_pr_view', 'Viewer', 'viewer', 1, 'operator', 'tenant', NULL, 'active')`,
    )
    await q(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES
         ('ten_acme', 'rol_pr_admin', 'view_exception'),
         ('ten_acme', 'rol_pr_admin', 'view_endpoint'),
         ('ten_acme', 'rol_pr_admin', 'configure_endpoint'),
         ('ten_acme', 'rol_pr_view', 'view_exception')`,
    )
    await q(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('ten_acme', 'ras_pr_mei', 'usr_mei', 'rol_pr_admin', 1, 'test', now(), NULL, NULL),
              ('ten_acme', 'ras_pr_them', 'usr_them', 'rol_pr_view', 1, 'test', now(), NULL, NULL)`,
    )
    await q(
      `INSERT INTO tenant.platform_role (id, label, key, version, stakeholder_class, status)
       VALUES ('prl_pr_fleet', 'Fleet reader', 'fleet_reader', 1, 'platform', 'active')`,
    )
    await q(`INSERT INTO tenant.platform_role_capability (role_id, capability) VALUES ('prl_pr_fleet', 'view_substrate')`)
    await q(
      `INSERT INTO tenant.platform_role_assignment
         (id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('pra_pr_priya', 'usr_priya', 'prl_pr_fleet', 1, 'bootstrap', now(), now() + interval '8 hours', NULL)`,
    )
    /* §9 — a REVOKED assignment to `Viewer` and a live one to an ARCHIVED role:
       neither may be named, because the gate would refuse both. */
    await q(
      `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ('ten_acme', 'rol_pr_gone', 'Retired approver', 'retired', 1, 'operator', 'tenant', NULL, 'archived')`,
    )
    await q(`INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ('ten_acme', 'rol_pr_gone', 'view_exception')`)
    await q(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('ten_acme', 'ras_pr_mei_old', 'usr_mei', 'rol_pr_view', 1, 'test', now(), NULL, now()),
              ('ten_acme', 'ras_pr_mei_gone', 'usr_mei', 'rol_pr_gone', 1, 'test', now(), NULL, NULL)`,
    )
    /* §10 — ten_acme DECLARES a reporting currency; ten_globex declares none. */
    await q(`INSERT INTO tenant.tenant_reporting_currency (tenant_id, currency) VALUES ('ten_acme', 'SGD')`)
    acme = await session('ses_pr_acme', 'usr_mei', 'idc_pr_cust', 'ten_acme', ACME_HOST)
    globex = await session('ses_pr_globex', 'usr_mei', 'idc_pr_cust', 'ten_globex', GLOBEX_HOST)
    unbound = await session('ses_pr_unbound', 'usr_mei', 'idc_pr_cust', null, ACME_HOST)
    them = await session('ses_pr_them', 'usr_them', 'idc_pr_cust', 'ten_acme', ACME_HOST)
    staff = await session('ses_pr_staff', 'usr_priya', 'idc_pr_plat', null, CONSOLE_HOST)
    /* G4313 — the name now reaches the data plane by the PULL, over the signed
       internal edge, into `tenant.tenant_name_projection`. The control plane
       serves the roster the seed above wrote; `startDataPlane()` awaits the
       boot pull, so §1's first request sees the projected name. */
    pair = await startInternalPair()
    plane = await startDataPlane({ poolMax: 4, identityTerms: null, controlPlane: pair.client })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
    if (pair !== undefined) await pair.close()
  })

  it('§1 · a bound customer session: the person as stored, the org class, and the roster`s tenant name — every required key, exactly', async () => {
    const r = await get(plane.url, '/session/principal', ACME_HOST, acme)
    assert.equal(r.status, 200, r.text)
    assert.deepEqual(r.body, {
      userId: 'usr_mei',
      displayName: MEI_NAME,
      email: 'mei@acme.invalid',
      orgClass: 'customer',
      tenant: { tenantId: 'ten_acme', name: 'Meridian Group Pte Ltd', reportingCurrency: 'SGD' },
      /* G3881 — `view_run` is carried by `view_exception`, in `CAPABILITIES`' order. */
      capabilities: ['view_exception', 'view_run', 'view_endpoint', 'configure_endpoint'],
      /* G4045 — the role she LIVE-holds; not the revoked `Viewer`, not the archived one. */
      roles: ['Admin'],
    })
    assert.deepEqual(Object.keys(r.body ?? {}).sort(), requiredOf('SessionPrincipal'))
    assert.deepEqual(
      Object.keys((r.body?.['tenant'] ?? {}) as object).sort(),
      requiredOf('SessionPrincipalTenant'),
    )
  })

  it('§1b · the directory`s display name comes back BYTE FOR BYTE — stored verbatim, parsed by nothing (D6-9)', async () => {
    const r = await get(plane.url, '/session/principal', ACME_HOST, acme)
    assert.equal(r.body?.['displayName'], MEI_NAME, 'the plane altered a directory-supplied name')
  })

  it('§2 · a tenant the roster does not hold answers `name: null`, never an invented name', async () => {
    const r = await get(plane.url, '/session/principal', GLOBEX_HOST, globex)
    assert.equal(r.status, 200, r.text)
    assert.deepEqual(r.body?.['tenant'], { tenantId: 'ten_globex', name: null, reportingCurrency: null })
  })

  it('§3 · an UNBOUND session answers `tenant: null`', async () => {
    const r = await get(plane.url, '/session/principal', ACME_HOST, unbound)
    assert.equal(r.status, 200, r.text)
    assert.equal(r.body?.['tenant'], null)
    assert.equal(r.body?.['displayName'], MEI_NAME)
    /* G3521 — an unbound session resolves no principal, so it holds nothing;
       the gate would refuse it every gated operation too. */
    assert.deepEqual(r.body?.['capabilities'], [])
  })

  it('§4 · a PLATFORM session on a console host: `orgClass: platform` and no tenant', async () => {
    const r = await get(plane.url, '/session/principal', CONSOLE_HOST, staff)
    assert.equal(r.status, 200, r.text)
    assert.deepEqual(r.body, {
      userId: 'usr_priya',
      displayName: 'Priya R',
      email: 'priya@1cloudhub.invalid',
      orgClass: 'platform',
      tenant: null,
      capabilities: ['view_substrate'],
      /* G4045 — a platform principal's PLATFORM role, by its label. */
      roles: ['Fleet reader'],
    })
  })

  it('§5 · no credential is a 401, and a tenant named in the query is REFUSED rather than ignored (G941)', async () => {
    const none = await get(plane.url, '/session/principal', ACME_HOST, null)
    assert.equal(none.status, 401, none.text)
    const smuggled = await get(plane.url, '/session/principal?tenantId=ten_globex', ACME_HOST, acme)
    assert.equal(smuggled.status, 400, smuggled.text)
  })

  it('§6 · it names nobody else — another member`s name is in no response', async () => {
    for (const [host, handle] of [
      [ACME_HOST, acme],
      [GLOBEX_HOST, globex],
      [ACME_HOST, unbound],
    ] as const) {
      const r = await get(plane.url, '/session/principal', host, handle)
      assert.doesNotMatch(r.text, /Somebody Else Entirely|them@acme\.invalid/)
    }
  })

  /*
   * §8 — G3521, `capabilities`: THE GATE'S VERDICTS READ BACK, NEVER A SECOND
   * EVALUATOR. Witnessed RED with the handler's `capabilities` line deleted
   * and the contract's `required` unchanged: §1–§4, §8 and §8b fail (7 of 10)
   * with `actual: 500, expected: 200` — `fast-json-stringify` THROWS on a
   * missing required property (G1244), so the field cannot silently vanish.
   * §8's second half is the property: the list and the GATE agree about
   * Setup's own route — the persona without the verbs is a 403 there, the
   * persona with them is not.
   */
  it('§8 · a persona lacking `configure_endpoint` is told so — and Setup`s own route agrees with the list', async () => {
    const r = await get(plane.url, '/session/principal', ACME_HOST, them)
    assert.equal(r.status, 200, r.text)
    assert.deepEqual(r.body?.['capabilities'], ['view_exception', 'view_run'] /* G3881: carried */)
    assert.ok(!(r.body?.['capabilities'] as string[]).includes('configure_endpoint'))
    /* the backstop: the gated route Setup reads refuses them, as the list says */
    const setup = await get(plane.url, '/v1/endpoints', ACME_HOST, them)
    assert.equal(setup.status, 403, setup.text)
    const setupMei = await get(plane.url, '/v1/endpoints', ACME_HOST, acme)
    assert.notEqual(setupMei.status, 403, setupMei.text)
  })

  it('§8b · the same person in a tenant where they hold nothing reports `[]` — the list is per SESSION, not per person', async () => {
    const r = await get(plane.url, '/session/principal', GLOBEX_HOST, globex)
    assert.deepEqual(r.body?.['capabilities'], [])
  })

  it('§9 · `roles` names the caller`s LIVE roles in the bound tenant, and nobody else`s (G4045)', async () => {
    const them_ = await get(plane.url, '/session/principal', ACME_HOST, them)
    assert.deepEqual(them_.body?.['roles'], ['Viewer'])
    const mei = await get(plane.url, '/session/principal', ACME_HOST, acme)
    /* revoked `Viewer`, archived `Retired approver`: the gate refuses both, so neither is named */
    assert.deepEqual(mei.body?.['roles'], ['Admin'])
    assert.doesNotMatch(mei.text, /Retired approver/)
    /* the same person in a tenant where they hold no assignment: `[]`, per SESSION */
    const g = await get(plane.url, '/session/principal', GLOBEX_HOST, globex)
    assert.deepEqual(g.body?.['roles'], [])
    /* unbound: no principal, no roles — and no role from any tenant leaks across */
    const u = await get(plane.url, '/session/principal', ACME_HOST, unbound)
    assert.deepEqual(u.body?.['roles'], [])
  })

  it('§10 · `tenant.reportingCurrency` is the bound tenant`s DECLARATION, and `null` where it declared none (G4046)', async () => {
    const a = await get(plane.url, '/session/principal', ACME_HOST, acme)
    assert.equal((a.body?.['tenant'] as Record<string, unknown>)['reportingCurrency'], 'SGD')
    const g = await get(plane.url, '/session/principal', GLOBEX_HOST, globex)
    assert.equal((g.body?.['tenant'] as Record<string, unknown>)['reportingCurrency'], null)
  })
})

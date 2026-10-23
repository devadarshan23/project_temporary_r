/**
 * G2998/G2999 — `db/seeds/staging-mock-personas.sql`, applied to a disposable
 * database exactly as the runbook applies it to staging (as the MIGRATOR,
 * after the Entra seed's phase 1), and then USED through the production D1.
 * THE OWNER'S RULING G2771: a STAGING mock sign-in, a public test login
 * accepted in writing.
 *
 *   §1  it applies, beside the Entra seed, TWICE (idempotent) — and the doors
 *       and claims are exactly the catalogue's.
 *   §2  the seed's personas, doors and domains ARE `infra/lib/mock-personas.ts`.
 *   §3  every verb is in the closed set; no tenant or partner role holds a
 *       platform-only verb; every platform verb is one the platform arm opens;
 *       the partner-on-tenant role sits inside its scope's mask.
 *   §4  run 1 grants NOBODY (Cognito mints the subject at first sign-in, G2998).
 *   §5  run 2 grants each provisioned persona — and NOT a namesake on another door.
 *   §6  the grants work: D1 binds `ten_mock` for the customer admin, the
 *       partner admin, and the FDE through the STAFF arm.
 *   §7  RED — the fences: a foreign door claiming a mock domain, a mock
 *       person reaching `ten_acme`, two persons on one door.
 *   §8  nothing of it touches `ten_acme`, the Entra door or `1cloudhub.com`.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { randomBytes } from 'node:crypto'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, migratorClient } from '../../db/provision.ts'
import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  PARTNER_CAPABILITY_MASK,
  PLATFORM_ASSIGNMENT_REACHES,
  capabilityIsPlatformOnly,
  type Capability,
} from '../../model/access.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import {
  MOCK_DOORS,
  MOCK_IDENTITY_DOMAIN,
  MOCK_PERSONAS,
  MOCK_TENANT_HOST,
  MOCK_TENANT_ID,
} from '../../infra/lib/mock-personas.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_STAGING_MOCK_SEED_DB_NAME'] ?? runScopedName('reconcile_staging_mock_seed_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

process.env['RECONCILE_SERVING_HOSTS'] = `${MOCK_TENANT_HOST}|${MOCK_TENANT_ID}|us-west-2|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = ''

const ENTRA_SEED = readFileSync(new URL('../../db/seeds/staging-signin-seed.sql', import.meta.url), 'utf8')
const SEED = readFileSync(new URL('../../db/seeds/staging-mock-personas.sql', import.meta.url), 'utf8')
const MOCK_DOOR_IDS = Object.values(MOCK_DOORS).map((d) => d.connectionId).sort()

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the staging mock-persona seed suite', probe)

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params)).rows as T[]
  } finally {
    await mig.end()
  }
}

async function run(sql: string): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql)
  } finally {
    await mig.end()
  }
}

/** Provision a persona the way R5 would: on their door, with the door's broker pair. */
async function provision(userId: string, email: string, door: string): Promise<void> {
  await q(
    `INSERT INTO tenant."user"
       (id, email, display_name, status, connection_id, external_subject, broker_issuer, broker_ref, email_verified)
     SELECT $1, $2, 'Mock', 'active', c.id, $3, c.broker_issuer, c.broker_ref, true
       FROM tenant.identity_connection c WHERE c.id = $4`,
    [userId, email, `cognito-sub-${userId}`, door],
  )
}

function resolveContext(origin: string, handle: string): Promise<{ status: number; text: string }> {
  const url = new URL(origin)
  /* G3254 — D1 reads the COOKIE (G3006, the owner's); the body is a closed
     empty object and a `sessionToken` in it is a 400. */
  const payload = JSON.stringify({})
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path: '/context/resolve',
        method: 'POST',
        headers: {
          Host: MOCK_TENANT_HOST,
          Cookie: `__Host-reconcile_session=${handle}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => (text += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text }))
      },
    )
    req.on('error', reject)
    req.end(payload)
  })
}

const persona = (sub: string) => {
  const p = MOCK_PERSONAS.find((x) => x.sub === sub)
  if (p === undefined) throw new Error(`no persona ${sub}`)
  return { ...p, connectionId: MOCK_DOORS[p.door].connectionId }
}

describe('the staging mock-persona seed', { skip }, () => {
  before(async () => {
    await resetSchema()
  })

  it('§1 · applies beside the Entra seed, twice, and the doors and claims are the catalogue’s', async () => {
    await run(ENTRA_SEED)
    await run(SEED)
    await run(SEED)
    const doors = await q<{ id: string; owner_kind: string; broker_ref: string }>(
      `SELECT id, owner_kind, broker_ref FROM tenant.identity_connection WHERE id LIKE 'idc_mock_%' ORDER BY id`,
    )
    assert.deepEqual(
      doors,
      Object.values(MOCK_DOORS)
        .map((d) => ({ id: d.connectionId, owner_kind: d.orgClass, broker_ref: `c-${d.handle}` }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    )
    const claims = await q<{ connection_id: string; domain: string; verified: boolean }>(
      `SELECT connection_id, domain, verified_at IS NOT NULL AS verified FROM tenant.domain_claim
        WHERE connection_id LIKE 'idc_mock_%' ORDER BY connection_id`,
    )
    assert.deepEqual(
      claims,
      Object.values(MOCK_DOORS)
        .map((d) => ({ connection_id: d.connectionId, domain: d.domain, verified: true }))
        .sort((a, b) => a.connection_id.localeCompare(b.connection_id)),
    )
  })

  it('§2 · the seed names exactly the catalogue’s personas, on their own doors and domains', () => {
    const rows = [...SEED.matchAll(/\('(mock-[a-z-]+)', '(idc_mock_[a-z]+)', '([^']+)', '([a-z]+)', /g)].map(
      (m) => ({ sub: m[1], door: m[2], email: m[3] }),
    )
    assert.deepEqual(
      rows.map((r) => r.sub).sort(),
      MOCK_PERSONAS.map((p) => p.sub).sort(),
      'the seed and `infra/lib/mock-personas.ts` disagree about WHO the personas are',
    )
    for (const r of rows) {
      const p = persona(r.sub ?? '')
      assert.equal(r.email, p.email, `${r.sub}: the seed's address is not the catalogue's`)
      assert.equal(r.door, p.connectionId, `${r.sub}: the seed's door is not the catalogue's`)
    }
    for (const p of MOCK_PERSONAS) {
      assert.ok(p.email.endsWith(`@${MOCK_DOORS[p.door].domain}`), `${p.sub} is not on its own door's domain`)
      assert.ok(MOCK_DOORS[p.door].domain.endsWith(`.${MOCK_IDENTITY_DOMAIN}`), `${p.door} is outside the mock domain`)
    }
  })

  it('§3 · every verb is real; tenant and partner roles hold no platform verb; platform verbs are reachable', async () => {
    const known = new Set<string>(Object.values(CAPABILITIES))
    const tenantCaps = await q<{ role_id: string; capability: string }>(
      `SELECT role_id, capability FROM tenant.role_capability WHERE tenant_id = 'ten_mock'`,
    )
    const partnerCaps = await q<{ capability: string }>(
      `SELECT capability FROM tenant.partner_role_capability WHERE role_id LIKE 'prl_mock_%'`,
    )
    const platformCaps = await q<{ capability: string }>(
      `SELECT capability FROM tenant.platform_role_capability WHERE role_id LIKE 'plr_mock_%'`,
    )
    assert.ok(tenantCaps.length > 0 && partnerCaps.length > 0 && platformCaps.length > 0, 'a role set is empty')
    for (const { capability } of [...tenantCaps, ...partnerCaps, ...platformCaps]) {
      assert.ok(known.has(capability), `\`${capability}\` is not a capability`)
    }
    for (const { capability } of [...tenantCaps, ...partnerCaps]) {
      assert.equal(capabilityIsPlatformOnly(capability as Capability), false, `${capability} is platform-only`)
    }
    for (const { capability } of platformCaps) {
      const cls = CAPABILITY_RESOURCE_CLASS[capability as Capability]
      assert.equal(PLATFORM_ASSIGNMENT_REACHES[cls], true, `${capability} (${cls}) is unreachable on the platform arm`)
    }
    const mask = new Set<string>(PARTNER_CAPABILITY_MASK.exceptions_operate)
    for (const { role_id, capability } of tenantCaps.filter((r) => r.role_id === 'rol_mock_partner_operator')) {
      assert.ok(mask.has(capability), `${role_id} carries ${capability}, outside exceptions_operate's mask`)
    }
  })

  it('§4 · run 1 grants NOBODY — no person exists until Cognito mints a subject (G2998)', async () => {
    for (const table of ['membership', 'role_assignment', 'tenant_access_grant', 'resolution_proposal']) {
      assert.deepEqual(await q(`SELECT 1 FROM tenant.${table} WHERE tenant_id = 'ten_mock'`), [], table)
    }
    assert.deepEqual(await q(`SELECT 1 FROM tenant.platform_role_assignment`), [])
    assert.deepEqual(await q(`SELECT 1 FROM tenant.partner_role_assignment`), [])
  })

  it('§5 · run 2 grants each provisioned persona, and not a namesake on another door', async () => {
    const admin = persona('mock-cust-admin')
    const operator = persona('mock-cust-operator')
    const partner = persona('mock-partner-admin')
    const fde = persona('mock-staff-fde')
    const platform = persona('mock-staff-platform')
    await provision('usr_m_admin', admin.email, admin.connectionId)
    await provision('usr_m_operator', operator.email, operator.connectionId)
    await provision('usr_m_partner', partner.email, partner.connectionId)
    await provision('usr_m_fde', fde.email, fde.connectionId)
    await provision('usr_m_platform', platform.email, platform.connectionId)
    /* The namesake: the customer admin's address on ANOTHER door. */
    await q(
      `INSERT INTO tenant.identity_connection (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, status)
       VALUES ('idc_elsewhere', 'oidc', 'Another directory', 'customer', NULL, 'acc_other', 'active')`,
    )
    await q(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id, external_subject)
       VALUES ('usr_namesake', $1, 'Not the persona', 'active', 'idc_elsewhere', 'sub-x')`,
      [admin.email],
    )
    await run(SEED)
    await run(SEED)

    const members = await q<{ user_id: string; expiring: boolean }>(
      `SELECT user_id, expires_at IS NOT NULL AS expiring FROM tenant.membership WHERE tenant_id = 'ten_mock' ORDER BY user_id`,
    )
    assert.deepEqual(members, [
      { user_id: 'usr_m_admin', expiring: false },
      { user_id: 'usr_m_operator', expiring: false },
      { user_id: 'usr_m_partner', expiring: true },
    ])
    const fdeGrant = await q<{ staff_user_id: string; purpose: string; within_ceiling: boolean }>(
      `SELECT staff_user_id, purpose, expires_at <= granted_at + interval '90 days' AS within_ceiling
         FROM tenant.tenant_access_grant WHERE tenant_id = 'ten_mock'`,
    )
    assert.deepEqual(fdeGrant, [{ staff_user_id: 'usr_m_fde', purpose: 'delivery', within_ceiling: true }])
    const classes = await q<{ resource: string }>(
      `SELECT resource FROM tenant.access_resource_grant WHERE grant_id = 'tag_mock_fde' ORDER BY resource`,
    )
    const permitted = await q<{ resource: string }>(
      `SELECT resource FROM tenant.permitted_resource WHERE purpose = 'delivery' ORDER BY resource`,
    )
    assert.deepEqual(classes, permitted, 'the FDE grant is not exactly what delivery permits')
    assert.deepEqual(
      await q(`SELECT user_id, role_id FROM tenant.platform_role_assignment ORDER BY user_id`),
      [{ user_id: 'usr_m_platform', role_id: 'plr_mock_platform' }],
    )
    assert.deepEqual(
      await q(`SELECT user_id, role_id FROM tenant.partner_role_assignment ORDER BY user_id`),
      [{ user_id: 'usr_m_partner', role_id: 'prl_mock_admin' }],
    )
    assert.deepEqual(
      await q(`SELECT proposed_by_user_id FROM tenant.resolution_proposal WHERE tenant_id = 'ten_mock'`),
      [{ proposed_by_user_id: 'usr_m_operator' }],
    )
  })

  async function bind(userId: string, door: string): Promise<{ status: number; text: string }> {
    const handle = randomBytes(32).toString('base64url')
    await q(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, NULL, $5, now(), now(), now() + interval '1 hour', NULL)`,
      [`ses_${userId}`, digestOfHandle(handle), userId, door, MOCK_TENANT_HOST],
    )
    const plane = await startDataPlane({ poolMax: 2, identityTerms: null })
    try {
      return await resolveContext(plane.url, handle)
    } finally {
      await plane.close()
    }
  }

  it('§6 · the grants work: D1 binds ten_mock for the admin, the partner admin and the FDE', async () => {
    const admin = await bind('usr_m_admin', MOCK_DOORS.customer.connectionId)
    assert.equal(admin.status, 200, `the customer admin was not bound: ${admin.text}`)
    const partner = await bind('usr_m_partner', MOCK_DOORS.partner.connectionId)
    assert.equal(partner.status, 200, `the partner admin was not bound: ${partner.text}`)
    const fde = await bind('usr_m_fde', MOCK_DOORS.platform.connectionId)
    assert.equal(fde.status, 200, `the FDE was not bound through the staff arm: ${fde.text}`)
    const platform = await bind('usr_m_platform', MOCK_DOORS.platform.connectionId)
    assert.notEqual(platform.status, 200, 'a platform principal with no grant was bound to a tenant — invariant 8')
  })

  it('§7 · RED — the fences refuse', async () => {
    await q(`INSERT INTO tenant.domain_claim (connection_id, domain, verified_at) VALUES ('idc_elsewhere', 'evil.mock.reconcileai.app', now())`)
    try {
      await assert.rejects(() => run(SEED), /not a mock door claims a mock\.reconcileai\.app domain/)
    } finally {
      await q(`DELETE FROM tenant.domain_claim WHERE connection_id = 'idc_elsewhere'`)
    }
    await q(
      `INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at)
       VALUES ('ten_acme', 'mem_leak', 'usr_m_admin', 'rol_staging_tenant_admin', 'test', now())`,
    )
    try {
      await assert.rejects(() => run(SEED), /reaches a tenant other than ten_mock/)
    } finally {
      await q(`DELETE FROM tenant.membership WHERE id = 'mem_leak'`)
    }
    const operator = persona('mock-cust-operator')
    await provision('usr_m_operator_twin', operator.email, operator.connectionId)
    try {
      await assert.rejects(() => run(SEED), /more than one person/)
    } finally {
      await q(`DELETE FROM tenant."user" WHERE id = 'usr_m_operator_twin'`)
    }
    await run(SEED)
  })

  it('§8 · nothing of it touches ten_acme, the Entra door or 1cloudhub.com', async () => {
    const leaked = await q(
      `SELECT 1 FROM tenant.domain_claim
        WHERE (connection_id = ANY($1) AND domain NOT LIKE '%.mock.reconcileai.app')
           OR (domain = '1cloudhub.com' AND connection_id <> 'idc_staging_entra_1ch')`,
      [MOCK_DOOR_IDS],
    )
    assert.deepEqual(leaked, [])
    assert.deepEqual(
      await q(
        `SELECT 1 FROM tenant.membership m JOIN tenant."user" u ON u.id = m.user_id
          WHERE m.tenant_id = 'ten_acme' AND u.connection_id = ANY($1)`,
        [MOCK_DOOR_IDS],
      ),
      [],
    )
    const statements = SEED.replace(/--.*$/gm, '')
    assert.ok(!statements.includes('ten_acme'), 'a statement in the seed names ten_acme')
    assert.ok(!statements.includes('1cloudhub.com'), 'a statement in the seed names 1cloudhub.com')
    assert.ok(!statements.includes('idc_staging_entra'), 'a statement in the seed names the Entra door')
  })
})

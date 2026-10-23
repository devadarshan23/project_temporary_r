/**
 * G2769 — `db/seeds/staging-signin-seed*.sql`, applied to a disposable
 * database exactly as the runbook applies them to staging (as the MIGRATOR),
 * and then USED: a session for the owner's provisioned person binds
 * `ten_acme` at the staging host through the PRODUCTION D1.
 *
 *   §1  phase 1 applies, and applies TWICE (idempotent).
 *   §2  every capability the seed names is in the model's closed set, and
 *       none is platform-only.
 *   §3  phase 2 before the first sign-in writes NOTHING.
 *   §4  phase 2 grants the person provisioned on the ENTRA door — and NOT a
 *       person with the same address on another door.
 *   §5  the grant works: D1 binds `ten_acme` at its staging host.
 *   §6  RED — a residency disagreement on an existing `ten_acme` is refused.
 *   §7  RED — two people on the Entra door with the owner's address: refused.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { randomBytes } from 'node:crypto'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, migratorClient } from '../../db/provision.ts'
import { CAPABILITIES, capabilityIsPlatformOnly } from '../../model/access.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_STAGING_SEED_DB_NAME'] ?? runScopedName('reconcile_staging_seed_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const HOST = 'ten-acme.us-west-2.reconcileai.app'
process.env['RECONCILE_SERVING_HOSTS'] = `${HOST}|ten_acme|us-west-2|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = ''

const PHASE1 = readFileSync(new URL('../../db/seeds/staging-signin-seed.sql', import.meta.url), 'utf8')
const PHASE2 = readFileSync(new URL('../../db/seeds/staging-signin-seed-phase2.sql', import.meta.url), 'utf8')
const ENTRA = 'idc_staging_entra_1ch'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the staging sign-in seed suite', probe)

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params)).rows as T[]
  } finally {
    await mig.end()
  }
}

/** Run a whole file as the migrator, the way `psql -f` would. */
async function run(sql: string): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql)
  } finally {
    await mig.end()
  }
}

function resolveContext(origin: string, handle: string): Promise<{ status: number; text: string }> {
  const url = new URL(origin)
  const payload = JSON.stringify({})
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path: '/context/resolve',
        method: 'POST',
        headers: {
          Host: HOST,
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

describe('the staging sign-in seed', { skip }, () => {
  before(async () => {
    await resetSchema()
  })

  it('§1 · phase 1 applies, twice', async () => {
    await run(PHASE1)
    await run(PHASE1)
    const doors = await q<{ id: string; owner_kind: string; broker_ref: string }>(
      'SELECT id, owner_kind, broker_ref FROM tenant.identity_connection',
    )
    assert.deepEqual(doors, [{ id: ENTRA, owner_kind: 'customer', broker_ref: 'c-536ff22dd95a0cd0' }])
    const claims = await q<{ domain: string; verified: boolean }>(
      'SELECT domain, verified_at IS NOT NULL AS verified FROM tenant.domain_claim',
    )
    assert.deepEqual(claims, [{ domain: '1cloudhub.com', verified: true }])
  })

  it('§2 · every seeded capability is in the closed set and none is platform-only', async () => {
    const caps = await q<{ capability: string }>('SELECT capability FROM tenant.role_capability')
    assert.ok(caps.length > 0)
    const known = new Set<string>(Object.values(CAPABILITIES))
    for (const { capability } of caps) {
      assert.ok(known.has(capability), `\`${capability}\` is not a capability`)
      assert.equal(
        capabilityIsPlatformOnly(capability as never),
        false,
        `\`${capability}\` is platform-only and grants a tenant role nothing`,
      )
    }
  })

  it('§3 · phase 2 before the first sign-in writes nothing', async () => {
    await run(PHASE2)
    assert.deepEqual(await q('SELECT 1 FROM tenant.membership'), [])
    assert.deepEqual(await q('SELECT 1 FROM tenant.role_assignment'), [])
  })

  it('§4 · phase 2 grants the person on the ENTRA door, and not a namesake on another door', async () => {
    await q(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, status)
       VALUES ('idc_other_door', 'oidc', 'Another directory', 'customer', NULL, 'acc_other', 'active')`,
    )
    await q(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id, external_subject)
       VALUES ('usr_owner', 'Phani@1CloudHub.com', 'Phani', 'active', $1, 'cognito-sub-owner'),
              ('usr_namesake', 'phani@1cloudhub.com', 'Not Phani', 'active', 'idc_other_door', 'sub-x')`,
      [ENTRA],
    )
    await run(PHASE2)
    await run(PHASE2)
    const members = await q<{ user_id: string; tenant_id: string }>(
      'SELECT user_id, tenant_id FROM tenant.membership',
    )
    assert.deepEqual(members, [{ user_id: 'usr_owner', tenant_id: 'ten_acme' }])
    const assigned = await q<{ user_id: string }>('SELECT user_id FROM tenant.role_assignment')
    assert.deepEqual(assigned, [{ user_id: 'usr_owner' }])
  })

  it('§5 · the grant works: the production D1 binds ten_acme at its staging host', async () => {
    const handle = randomBytes(32).toString('base64url')
    await q(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_seed_owner', $1, 'usr_owner', $2, NULL, $3, now(), now(), now() + interval '1 hour', NULL)`,
      [digestOfHandle(handle), ENTRA, HOST],
    )
    const plane = await startDataPlane({ poolMax: 2, identityTerms: null })
    try {
      const res = await resolveContext(plane.url, handle)
      assert.equal(res.status, 200, `D1 did not bind the seeded owner: ${res.text}`)
    } finally {
      await plane.close()
    }
  })

  it('§6 · RED — an existing ten_acme with another residency is refused, not overwritten', async () => {
    await q(`UPDATE tenant.tenant SET residency = 'ap-southeast-1' WHERE id = 'ten_acme'`)
    try {
      await assert.rejects(() => run(PHASE1), /residency other than us-west-2/)
    } finally {
      await q(`UPDATE tenant.tenant SET residency = 'us-west-2' WHERE id = 'ten_acme'`)
    }
  })

  it('§7 · RED — two people on the Entra door with the owner’s address: refused', async () => {
    await q(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id, external_subject)
       VALUES ('usr_owner_twin', 'phani@1cloudhub.com', 'Twin', 'active', $1, 'cognito-sub-twin')`,
      [ENTRA],
    )
    await assert.rejects(() => run(PHASE2), /more than one person/)
  })

  after(async () => {
    /* nothing held */
  })
})

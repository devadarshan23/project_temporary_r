/**
 * G3004 — `signOut`, `DELETE /session`, SERVED. The revoke half of the owner's
 * profile-switcher ruling G2771: *"choosing one = real sign-out (revoke)"*.
 *
 *   §1  a signed-in caller is answered 204, its row is REVOKED and the cookie
 *       is WITHDRAWN with the delivery's own attributes.
 *   §2  the same cookie is then refused everywhere — a 401, including a second
 *       sign-out (G3005: the authenticator answers before the handler).
 *   §3  it reaches no other row: another person's live session stays live,
 *       and no credential at all is a 401 that writes nothing.
 *   §5  an unscoped session (signed in, no tenant bound) can sign out too —
 *       the switcher's case, because nothing in a browser binds one (G3006).
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { randomBytes } from 'node:crypto'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { withdrawnSessionCookie } from '../../server/data-plane/session-cookie.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_SIGN_OUT_DB_NAME'] ?? runScopedName('reconcile_sign_out_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const HOST = 'ten-acme.us-west-2.reconcileai.app'
process.env['RECONCILE_SERVING_HOSTS'] = `${HOST}|ten_acme|us-west-2|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = ''

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the sign-out suite', probe)

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params)).rows as T[]
  } finally {
    await mig.end()
  }
}

function call(
  origin: string,
  method: string,
  path: string,
  handle: string | null,
): Promise<{ status: number; text: string; setCookie: string[] }> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method,
        headers: {
          Host: HOST,
          accept: 'application/json',
          ...(handle === null ? {} : { Cookie: `__Host-reconcile_session=${handle}` }),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => (text += c))
        res.on('end', () => {
          const raw = res.headers['set-cookie']
          resolve({ status: res.statusCode ?? 0, text, setCookie: raw === undefined ? [] : [raw].flat() })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function session(id: string, user: string, tenant: string | null): Promise<string> {
  const handle = randomBytes(32).toString('base64url')
  await q(
    `INSERT INTO tenant.session
       (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
        authenticated_at, last_used_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, 'idc_so', $4, $5, now(), now(), now() + interval '1 hour', NULL)`,
    [id, digestOfHandle(handle), user, tenant, HOST],
  )
  return handle
}

const revoked = async (id: string): Promise<boolean> =>
  (await q<{ r: boolean }>('SELECT revoked_at IS NOT NULL AS r FROM tenant.session WHERE id = $1', [id]))[0]?.r ===
  true

describe('signOut, served', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }
  let mine = ''
  let theirs = ''
  let unscoped = ''

  before(async () => {
    await resetSchema()
    await q(
      `INSERT INTO tenant.tenant (id, status, residency, environment, deployment_mode)
       VALUES ('ten_acme', 'active', 'us-west-2', 'sandbox', 'hosted')`,
    )
    await q(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, status, broker_issuer, broker_ref)
       VALUES ('idc_so', 'oidc', 'Sign-out door', 'customer', NULL, 'acc_so', 'active',
               'https://broker.so.invalid', 'so-door')`,
    )
    await q(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id) VALUES
         ('usr_me', 'me@so.invalid', 'Me', 'active', 'idc_so'),
         ('usr_them', 'them@so.invalid', 'Them', 'active', 'idc_so')`,
    )
    await q(
      `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ('ten_acme', 'rol_so', 'Reader', 'reader', 1, 'operator', 'tenant', NULL, 'active')`,
    )
    await q(
      `INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at) VALUES
         ('ten_acme', 'mem_me', 'usr_me', 'rol_so', 'test', now()),
         ('ten_acme', 'mem_them', 'usr_them', 'rol_so', 'test', now())`,
    )
    mine = await session('ses_me', 'usr_me', 'ten_acme')
    theirs = await session('ses_them', 'usr_them', 'ten_acme')
    unscoped = await session('ses_me_unscoped', 'usr_me', null)
    plane = await startDataPlane({ poolMax: 2, identityTerms: null })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  it('§1 · 204, the row revoked, the cookie withdrawn with the delivery’s attributes', async () => {
    const res = await call(plane.url, 'DELETE', '/session', mine)
    assert.equal(res.status, 204, res.text)
    assert.equal(await revoked('ses_me'), true, 'the 204 revoked nothing — clearing is not revoking')
    assert.deepEqual(res.setCookie, [withdrawnSessionCookie()])
  })

  it('§2 · the same cookie is refused afterwards — including a second sign-out (G3005)', async () => {
    const again = await call(plane.url, 'DELETE', '/session', mine)
    assert.equal(again.status, 401)
    const read = await call(plane.url, 'GET', '/v1/runs', mine)
    assert.equal(read.status, 401, 'a signed-out cookie still reads')
  })

  it('§3 · another person’s session is untouched', async () => {
    assert.equal(await revoked('ses_them'), false)
    const read = await call(plane.url, 'DELETE', '/session', null)
    assert.equal(read.status, 401)
    assert.equal(await revoked('ses_them'), false)
    void theirs
  })

  it('§5 · an unscoped session signs out too — the switcher’s case (G3006)', async () => {
    const res = await call(plane.url, 'DELETE', '/session', unscoped)
    assert.equal(res.status, 204, res.text)
    assert.equal(await revoked('ses_me_unscoped'), true)
  })
})

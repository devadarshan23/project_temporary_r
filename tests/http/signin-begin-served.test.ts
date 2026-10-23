/**
 * `beginFederatedSignIn`, SERVED — the owner's ruling of 1 Oct 2026 (G2541),
 * which closes G2497: *"NOTHING BEGINS A SIGN-IN."*
 *
 *   §1   a real begin: 200, `no-store`, an authorize URL built from the PINNED
 *        ROW, an attempt pinned by DIGESTS only — and the round trip it begins
 *        completes through `completeFederatedSignIn` to a `303`.
 *   §2   the URL's endpoint is the ROW's: change the row, the URL follows; the
 *        request has no field through which it could arrive.
 *   §3   a smuggled endpoint, redirect, tenant or state is a 400 — nothing written.
 *   §4   routing refusals are `resolveHomeRealm`'s four codes, one status, one
 *        LENGTH — and a door the domain does not route to is refused too.
 *   §5   an unregistered host begins nothing (403), and nothing is written.
 *   §6   a door with no `authorization_endpoint` is the platform's 503.
 *   §7   the verifier is stored NOWHERE and the nonce is returned NOWHERE.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { signInCallbackUrl } from '../../server/data-plane/code-exchange.ts'
import { SIGN_IN_SCOPES } from '../../server/data-plane/signin-begin.ts'
import { startFakeBroker, type FakeBroker } from '../e2e/fake-oidc-broker.ts'
import type { IdentityConnectionId } from '../../model/domain.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SIGNIN_BEGIN_DB_NAME'] ?? runScopedName('reconcile_signin_begin_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const ACME_HOST = 'acme.ap-southeast-1.begin.invalid'
const UNREGISTERED_HOST = 'attacker.ap-southeast-1.begin.invalid'
process.env['RECONCILE_SERVING_HOSTS'] = `${ACME_HOST}|${ACME}|ap-southeast-1|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = 'console.begin.invalid|staff|active'
process.env['RECONCILE_SESSION_MAX_LIFETIME_SECONDS'] = '28800'
process.env['RECONCILE_SESSION_MAX_IDLE_SECONDS'] = '900'

const AUDIENCE = 'reconcile-begin-test-client'
const DOMAIN = 'acme.example'
const DOOR = 'idc_begin_acme'
const OTHER_DOOR = 'idc_begin_other'
const BARE_DOOR = 'idc_begin_bare'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the sign-in begin suite', probe)

interface Res {
  readonly status: number
  readonly headers: Record<string, string | string[] | undefined>
  readonly text: string
  readonly body: Record<string, unknown> | undefined
}

function post(origin: string, path: string, host: string, body: unknown): Promise<Res> {
  const url = new URL(origin)
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'POST',
        headers: {
          Host: host,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => (text += c))
        res.on('end', () => {
          let parsed: Record<string, unknown> | undefined
          try {
            parsed = JSON.parse(text) as Record<string, unknown>
          } catch {
            parsed = undefined
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text, body: parsed })
        })
      },
    )
    req.on('error', reject)
    req.end(payload)
  })
}

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params)).rows as T[]
  } finally {
    await mig.end()
  }
}

async function attempts(): Promise<number> {
  const rows = await q<{ n: string }>('SELECT count(*) AS n FROM tenant.sign_in_attempt')
  return Number(rows[0]?.n ?? 0)
}

describe('beginFederatedSignIn, served', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let broker: FakeBroker

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    broker = await startFakeBroker({ audience: AUDIENCE })
    const doors: Array<[string, string, string, string | null]> = [
      [DOOR, broker.issuer, 'acme-begin', broker.authorizeEndpoint],
      [OTHER_DOOR, 'https://idp.other.invalid/pool', 'other-begin', 'https://idp.other.invalid/authorize'],
      [BARE_DOOR, 'https://idp.bare.invalid/pool', 'bare-begin', null],
    ]
    for (const [id, iss, ref, authorize] of doors) {
      await q(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status, email_claim, name_claim, token_endpoint,
            authorization_endpoint)
         VALUES ($1,'oidc','Begin door','customer',NULL,'acc_acme',$2,$3,'active','email','name',$4,$5)`,
        [id, iss, ref, broker.tokenEndpoint, authorize],
      )
    }
    await q(
      `INSERT INTO tenant.domain_claim (connection_id, domain, verified_at)
       VALUES ($1, $3, now()), ($2, 'other.example', now()), ($4, 'bare.example', now())`,
      [DOOR, OTHER_DOOR, DOMAIN, BARE_DOOR],
    )
    plane = await startDataPlane({
      poolMax: 2,
      /* G2571 (#512) made the terms per door; G2741 (integrate/1oct-c) reads the
       * begin's `client_id` off the ROUTED door's audience. */
      identityTerms: {
        connections: new Map(
          [DOOR, OTHER_DOOR, BARE_DOOR].map((id) => [
            id as IdentityConnectionId,
            { ok: true as const, terms: { audience: AUDIENCE, jwks: broker.jwks } },
          ]),
        ),
        clockSkewSeconds: 60,
        loadedAt: new Date(),
      },
    })
  })

  after(async () => {
    await plane?.close()
    await broker?.close()
  })

  it('§1 · a real begin pins a door by DIGESTS, and the round trip it starts completes', async () => {
    const res = await post(plane.url, '/session/signin', ACME_HOST, { domain: 'ACME.example', connectionId: DOOR })
    assert.equal(res.status, 200, res.text)
    assert.equal(res.headers['cache-control'], 'no-store')
    const state = String(res.body?.['state'])
    const verifier = String(res.body?.['codeVerifier'])
    const url = new URL(String(res.body?.['authorizationUrl']))
    assert.equal(`${url.origin}${url.pathname}`, broker.authorizeEndpoint, 'the URL is not the pinned door’s endpoint')
    const p = url.searchParams
    assert.equal(p.get('response_type'), 'code')
    assert.equal(p.get('client_id'), AUDIENCE)
    assert.equal(p.get('redirect_uri'), signInCallbackUrl(ACME_HOST), 'the broker returns to a host this request did not arrive at')
    assert.equal(p.get('scope'), SIGN_IN_SCOPES)
    assert.equal(p.get('state'), state)
    assert.equal(p.get('code_challenge_method'), 'S256')
    assert.equal(
      p.get('code_challenge'),
      createHash('sha256').update(verifier, 'ascii').digest('base64url'),
      'the challenge is not S256 of the verifier the tab was handed',
    )
    assert.equal(p.get('identity_provider'), 'acme-begin', 'the provider name is not the routed row’s broker_ref')
    const nonce = p.get('nonce') ?? ''
    assert.ok(nonce.length >= 43)

    const rows = await q<{
      connection_id: string
      challenge_digest: string
      consumed_at: Date | null
      ttl_seconds: number
    }>(
      `SELECT connection_id, challenge_digest, consumed_at,
              extract(epoch FROM expires_at - started_at)::int AS ttl_seconds
         FROM tenant.sign_in_attempt WHERE handle_digest = $1`,
      [digestOfHandle(state)],
    )
    assert.equal(rows.length, 1, 'no attempt row is addressed by the digest of the returned state')
    assert.equal(rows[0]?.connection_id, DOOR)
    assert.equal(rows[0]?.challenge_digest, digestOfHandle(nonce), 'the pinned challenge is not the nonce’s digest')
    assert.equal(rows[0]?.consumed_at, null)
    assert.equal(rows[0]?.ttl_seconds, 600, 'D6-6: the attempt does not live exactly the TTL')

    /* THE ROUND TRIP IT BEGINS — through the real callback. */
    const code = broker.mintCode({
      redirectUri: p.get('redirect_uri') ?? '',
      nonce,
      codeChallenge: p.get('code_challenge') ?? '',
      subject: 'sub-begin',
      provider: p.get('identity_provider'),
      claims: { email: 'begin@acme.invalid', name: 'Begin Person' },
    })
    const done = await post(plane.url, '/session/federated', ACME_HOST, {
      state,
      code,
      codeVerifier: verifier,
      connectionId: DOOR,
    })
    assert.equal(done.status, 303, `the begun sign-in did not complete: ${done.text}`)
  })

  it('§2 · the endpoint is the ROW’s — change the row and the URL follows', async () => {
    await q(`UPDATE tenant.identity_connection SET authorization_endpoint = 'https://moved.invalid/oauth2/authorize' WHERE id = $1`, [DOOR])
    try {
      const res = await post(plane.url, '/session/signin', ACME_HOST, { domain: DOMAIN, connectionId: DOOR })
      assert.equal(res.status, 200, res.text)
      assert.ok(String(res.body?.['authorizationUrl']).startsWith('https://moved.invalid/oauth2/authorize?'))
    } finally {
      await q('UPDATE tenant.identity_connection SET authorization_endpoint = $2 WHERE id = $1', [DOOR, broker.authorizeEndpoint])
    }
  })

  it('§3 · a smuggled endpoint, redirect, tenant or state is a 400 and writes nothing', async () => {
    const before = await attempts()
    for (const extra of [
      { authorizationEndpoint: 'https://evil.invalid/authorize' },
      { redirectUri: 'https://evil.invalid/cb' },
      { tenantId: GLOBEX },
      { state: 'chosen-by-the-caller' },
    ]) {
      const res = await post(plane.url, '/session/signin', ACME_HOST, { domain: DOMAIN, connectionId: DOOR, ...extra })
      assert.equal(res.status, 400, `${JSON.stringify(extra)} was not refused: ${res.text}`)
    }
    assert.equal(await attempts(), before)
  })

  it('§4 · routing refusals are one status and one LENGTH, and a door the domain does not route to is refused', async () => {
    const before = await attempts()
    const unclaimed = await post(plane.url, '/session/signin', ACME_HOST, { domain: 'nobody.example', connectionId: DOOR })
    assert.equal(unclaimed.status, 422)
    assert.equal(unclaimed.body?.['code'], 'domain_not_claimed')
    const mismatch = await post(plane.url, '/session/signin', ACME_HOST, { domain: DOMAIN, connectionId: OTHER_DOOR })
    assert.equal(mismatch.status, 422)
    assert.equal(mismatch.body?.['code'], 'sign_in_attempt_connection_mismatch')
    assert.equal(
      Buffer.byteLength(unclaimed.text),
      Buffer.byteLength(mismatch.text),
      'two refusals are told apart by Content-Length — G1989’s channel',
    )
    assert.equal(await attempts(), before, 'a refused begin wrote an attempt')
  })

  it('§5 · an UNREGISTERED host begins nothing', async () => {
    const before = await attempts()
    const res = await post(plane.url, '/session/signin', UNREGISTERED_HOST, { domain: DOMAIN, connectionId: DOOR })
    assert.equal(res.status, 403)
    assert.equal(res.body?.['code'], 'tenant_context_missing')
    assert.equal(await attempts(), before)
  })

  it('§6 · a door with no `authorization_endpoint` is the platform’s 503, and writes nothing', async () => {
    const before = await attempts()
    const res = await post(plane.url, '/session/signin', ACME_HOST, { domain: 'bare.example', connectionId: BARE_DOOR })
    assert.equal(res.status, 503, res.text)
    assert.equal(res.body?.['code'], 'upstream_unavailable')
    assert.equal(await attempts(), before)
  })

  it('§7 · the verifier is stored NOWHERE and the nonce is returned NOWHERE', async () => {
    const res = await post(plane.url, '/session/signin', ACME_HOST, { domain: DOMAIN, connectionId: DOOR })
    assert.equal(res.status, 200)
    assert.deepEqual(Object.keys(res.body ?? {}).sort(), ['authorizationUrl', 'codeVerifier', 'state'])
    const verifier = String(res.body?.['codeVerifier'])
    const nonce = new URL(String(res.body?.['authorizationUrl'])).searchParams.get('nonce') ?? ''
    const state = String(res.body?.['state'])
    const dump = JSON.stringify(
      await q('SELECT * FROM tenant.sign_in_attempt WHERE handle_digest = $1', [digestOfHandle(state)]),
    )
    for (const [name, secret] of [
      ['verifier', verifier],
      ['nonce', nonce],
      ['state', state],
    ] as const) {
      assert.ok(!dump.includes(secret), `the ${name} is stored in the clear: a database dump would be a sign-in kit`)
    }
  })
})

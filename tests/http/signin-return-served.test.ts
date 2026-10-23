/**
 * G2549 — ONE SHARED RETURN HOST, SERVED (THE OWNER'S RULING OF 2 Oct 2026):
 * *"One shared callback host: all sign-ins return to one fixed callback which
 * then 303s to the tenant host via resolveServingHost (a registry lookup,
 * grant bound to the host)."*
 *
 *   §1   the relay's path is mirrored by `infra/lib/config.ts`, byte for byte.
 *   §2   THE ROUND TRIP: begin on the tenant host → the broker returns to the
 *        SHARED host → 303 to the TENANT host → the completion mints a
 *        `__Host-` cookie THERE. The `redirect_uri` is the shared URL on both
 *        the authorize and the token request.
 *   §3   RED — the relay answers on the return host ALONE: 403 elsewhere.
 *   §4   RED — a smuggled `tenantId` or `host` is a 400, never a target.
 *   §5   RED — an UNREGISTERED target (the row's host is served by nothing) is
 *        refused and NOT redirected to; so is a NULL `begun_host`.
 *   §6   RED — a REPLAYED grant: after the mint, the relay refuses the same
 *        `state` and the completion refuses it again.
 *   §7   RED — the grant PRESENTED ON ANOTHER HOST (a registered one) is
 *        refused before any code is spent, and the attempt is not consumed.
 *   §8   RED — G2764: a token authenticated through ANOTHER provider of the
 *        same broker, or one that names none, is refused.
 *   §9   RED — a return host that is also a served host fails the BOOT.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import type { IdentityConnectionId } from '../../model/kernel.ts'
import {
  SIGN_IN_CALLBACK_PATH,
  SIGN_IN_RETURN_PATH,
  signInReturnUrl,
} from '../../server/data-plane/code-exchange.ts'
import { RELAYED_BROKER_ERROR } from '../../server/data-plane/signin-return.ts'
import { startFakeBroker, type FakeBroker } from '../e2e/fake-oidc-broker.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SIGNIN_RETURN_DB_NAME'] ?? runScopedName('reconcile_signin_return_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const ACME_HOST = 'acme.us-west-2.return.invalid'
const GLOBEX_HOST = 'globex.us-west-2.return.invalid'
const CONSOLE_HOST = 'console.return.invalid'
const RETURN_HOST = 'auth.us-west-2.return.invalid'
process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|${ACME}|us-west-2|pooled|active,${GLOBEX_HOST}|${GLOBEX}|us-west-2|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active`
process.env['RECONCILE_SESSION_MAX_LIFETIME_SECONDS'] = '28800'
process.env['RECONCILE_SESSION_MAX_IDLE_SECONDS'] = '900'

const AUDIENCE = 'reconcile-return-test-client'
const DOMAIN = 'acme.example'
const DOOR = 'idc_return_acme'
const BROKER_REF = 'acme-return'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the sign-in return suite', probe)

interface Res {
  readonly status: number
  readonly headers: Record<string, string | string[] | undefined>
  readonly text: string
  readonly body: Record<string, unknown> | undefined
}

function call(origin: string, method: 'GET' | 'POST', path: string, host: string, body?: unknown): Promise<Res> {
  const url = new URL(origin)
  const payload = body === undefined ? undefined : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method,
        headers: {
          Host: host,
          ...(payload === undefined
            ? {}
            : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }),
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

function relayPath(params: Record<string, string>): string {
  return `${SIGN_IN_RETURN_PATH}?${new URLSearchParams(params).toString()}`
}

test_mirror()

function test_mirror(): void {
  it('§1 · the return path is mirrored by `infra/lib/config.ts`, byte for byte', () => {
    const config = readFileSync(new URL('../../infra/lib/config.ts', import.meta.url), 'utf8')
    const m = /export const SIGN_IN_RETURN_PATH = '([^']+)'/.exec(config)
    assert.ok(m, 'infra/lib/config.ts declares no SIGN_IN_RETURN_PATH')
    assert.equal(
      m[1],
      SIGN_IN_RETURN_PATH,
      'the broker would return every sign-in to a path the plane does not serve',
    )
  })
}

describe('G2549 — the shared return host, served', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let broker: FakeBroker

  before(async () => {
    process.env['RECONCILE_SIGNIN_RETURN_HOST'] = RETURN_HOST
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    broker = await startFakeBroker({ audience: AUDIENCE })
    await q(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status, email_claim, name_claim, token_endpoint,
          authorization_endpoint)
       VALUES ($1,'oidc','Return door','customer',NULL,'acc_acme',$2,$3,'active','email','name',$4,$5)`,
      [DOOR, broker.issuer, BROKER_REF, broker.tokenEndpoint, broker.authorizeEndpoint],
    )
    await q(`INSERT INTO tenant.domain_claim (connection_id, domain, verified_at) VALUES ($1, $2, now())`, [
      DOOR,
      DOMAIN,
    ])
    plane = await startDataPlane({
      poolMax: 2,
      /* R2 as amended (G2571): terms are per DOOR now. */
      identityTerms: {
        connections: new Map([
          [DOOR as IdentityConnectionId, { ok: true as const, terms: { audience: AUDIENCE, jwks: broker.jwks } }],
        ]),
        clockSkewSeconds: 60,
        loadedAt: new Date(),
      },
    })
  })

  after(async () => {
    await plane?.close()
    await broker?.close()
    delete process.env['RECONCILE_SIGNIN_RETURN_HOST']
  })

  /** Begin on `host`, and answer the broker's half as the URL asked. */
  async function begin(host = ACME_HOST): Promise<{ state: string; verifier: string; url: URL }> {
    const res = await call(plane.url, 'POST', '/session/signin', host, { domain: DOMAIN, connectionId: DOOR })
    assert.equal(res.status, 200, res.text)
    return {
      state: String(res.body?.['state']),
      verifier: String(res.body?.['codeVerifier']),
      url: new URL(String(res.body?.['authorizationUrl'])),
    }
  }

  function codeFor(b: { url: URL }, provider: string | null = BROKER_REF, subject = 'sub-return'): string {
    const p = b.url.searchParams
    return broker.mintCode({
      redirectUri: p.get('redirect_uri') ?? '',
      nonce: p.get('nonce') ?? '',
      codeChallenge: p.get('code_challenge') ?? '',
      subject,
      provider,
      claims: { email: `${subject}@acme.invalid`, name: 'Return Person' },
    })
  }

  async function consumedFor(state: string): Promise<boolean> {
    const rows = await q<{ consumed_at: Date | null }>(
      'SELECT consumed_at FROM tenant.sign_in_attempt WHERE handle_digest = $1',
      [digestOfHandle(state)],
    )
    assert.equal(rows.length, 1)
    return rows[0]?.consumed_at !== null
  }

  it('§2 · THE ROUND TRIP: tenant host → shared host → 303 → tenant host mints the cookie', async () => {
    const b = await begin()
    assert.equal(
      b.url.searchParams.get('redirect_uri'),
      signInReturnUrl(RETURN_HOST),
      'the broker was not told to return to the ONE shared URL',
    )
    const rows = await q<{ begun_host: string }>(
      'SELECT begun_host FROM tenant.sign_in_attempt WHERE handle_digest = $1',
      [digestOfHandle(b.state)],
    )
    assert.equal(rows[0]?.begun_host, ACME_HOST, '`0360`: the begun host was not recorded')

    const code = codeFor(b)
    const relayed = await call(plane.url, 'GET', relayPath({ code, state: b.state }), RETURN_HOST)
    assert.equal(relayed.status, 303, relayed.text)
    assert.equal(relayed.headers['cache-control'], 'no-store')
    assert.equal(relayed.headers['referrer-policy'], 'no-referrer')
    const location = new URL(String(relayed.headers['location']))
    assert.equal(location.origin, `https://${ACME_HOST}`, 'the relay sent the browser somewhere other than the begun host')
    assert.equal(location.pathname, SIGN_IN_CALLBACK_PATH)
    assert.equal(location.searchParams.get('code'), code)
    assert.equal(location.searchParams.get('state'), b.state)
    assert.equal(await consumedFor(b.state), false, 'the relay consumed the attempt — it must only relay')

    const done = await call(plane.url, 'POST', '/session/federated', ACME_HOST, {
      state: b.state,
      code,
      codeVerifier: b.verifier,
      connectionId: DOOR,
    })
    assert.equal(done.status, 303, done.text)
    const cookie = String(done.headers['set-cookie'])
    assert.match(cookie, /^__Host-reconcile_session=/, 'the session was not minted on the tenant host')
    assert.doesNotMatch(cookie, /Domain=/i, '`__Host-` forbids a Domain attribute')
    const sessions = await q<{ issued_host: string; tenant_id: string | null }>(
      'SELECT issued_host, tenant_id FROM tenant.session',
    )
    assert.deepEqual(sessions, [{ issued_host: ACME_HOST, tenant_id: null }])
  })

  it('§2b · a broker error is relayed as ONE fixed word, never the broker’s text', async () => {
    const b = await begin()
    const res = await call(
      plane.url,
      'GET',
      relayPath({ error: 'access_denied', error_description: '<script>x</script>', state: b.state }),
      RETURN_HOST,
    )
    assert.equal(res.status, 303, res.text)
    const location = new URL(String(res.headers['location']))
    assert.equal(location.searchParams.get('error'), RELAYED_BROKER_ERROR)
    assert.equal(location.searchParams.get('code'), null)
    assert.doesNotMatch(location.toString(), /script|access_denied/)
  })

  it('§3 · RED — the relay answers on the return host ALONE', async () => {
    const b = await begin()
    const code = codeFor(b)
    for (const host of [ACME_HOST, CONSOLE_HOST, 'attacker.example']) {
      const res = await call(plane.url, 'GET', relayPath({ code, state: b.state }), host)
      assert.equal(res.status, 403, `${host}: ${res.text}`)
      assert.equal(res.headers['location'], undefined)
    }
  })

  it('§4 · RED — a smuggled tenant or host is a 400, never a target', async () => {
    const b = await begin()
    const code = codeFor(b)
    for (const extra of [{ tenantId: GLOBEX }, { host: GLOBEX_HOST }, { return_to: `https://${GLOBEX_HOST}/` }]) {
      const res = await call(plane.url, 'GET', relayPath({ code, state: b.state, ...extra }), RETURN_HOST)
      assert.equal(res.status, 400, `${JSON.stringify(extra)}: ${res.text}`)
      assert.equal(res.headers['location'], undefined)
    }
  })

  it('§5 · RED — an UNREGISTERED target is refused and not redirected to; a NULL host too', async () => {
    for (const [i, host] of [['1', 'evil.example'], ['2', null]] as const) {
      const state = `state-unregistered-${i}`
      await q(
        `INSERT INTO tenant.sign_in_attempt
           (id, handle_digest, connection_id, challenge_digest, started_at, expires_at, consumed_at, begun_host)
         VALUES ($1, $2, $3, 'c', now(), now() + interval '5 minutes', NULL, $4)`,
        [`sia_unreg_${i}`, digestOfHandle(state), DOOR, host],
      )
      const res = await call(plane.url, 'GET', relayPath({ code: 'any', state }), RETURN_HOST)
      assert.equal(res.status, 422, res.text)
      assert.equal(res.body?.['code'], 'sign_in_attempt_handle_mismatch')
      assert.equal(res.headers['location'], undefined, 'an unregistered host was redirected to — the open redirect')
    }
  })

  it('§6 · RED — a REPLAYED grant: the relay and the completion both refuse it after the mint', async () => {
    const b = await begin()
    const code = codeFor(b, BROKER_REF, 'sub-replay')
    assert.equal((await call(plane.url, 'GET', relayPath({ code, state: b.state }), RETURN_HOST)).status, 303)
    const first = await call(plane.url, 'POST', '/session/federated', ACME_HOST, {
      state: b.state,
      code,
      codeVerifier: b.verifier,
      connectionId: DOOR,
    })
    assert.equal(first.status, 303, first.text)
    const relayAgain = await call(plane.url, 'GET', relayPath({ code, state: b.state }), RETURN_HOST)
    assert.equal(relayAgain.status, 422, relayAgain.text)
    assert.equal(relayAgain.body?.['code'], 'sign_in_attempt_replayed')
    assert.equal(relayAgain.headers['location'], undefined)
    const completeAgain = await call(plane.url, 'POST', '/session/federated', ACME_HOST, {
      state: b.state,
      code,
      codeVerifier: b.verifier,
      connectionId: DOOR,
    })
    assert.equal(completeAgain.status, 422, completeAgain.text)
  })

  it('§7 · RED — the grant presented on ANOTHER (registered) host is refused before a code is spent', async () => {
    const b = await begin(ACME_HOST)
    const code = codeFor(b, BROKER_REF, 'sub-elsewhere')
    const calls = broker.tokenCalls()
    for (const host of [GLOBEX_HOST, CONSOLE_HOST]) {
      const res = await call(plane.url, 'POST', '/session/federated', host, {
        state: b.state,
        code,
        codeVerifier: b.verifier,
        connectionId: DOOR,
      })
      assert.equal(res.status, 422, `${host}: ${res.text}`)
      assert.equal(res.body?.['code'], 'sign_in_attempt_handle_mismatch')
      assert.equal(res.headers['set-cookie'], undefined)
    }
    assert.equal(broker.tokenCalls(), calls, 'a code was sent to the token endpoint for a grant presented elsewhere')
    assert.equal(await consumedFor(b.state), false)
  })

  it('§8 · RED — G2764: another provider of the same broker, or none, is refused; the attempt survives', async () => {
    for (const provider of ['some-other-directory', null]) {
      const b = await begin()
      const code = codeFor(b, provider, `sub-provider-${String(provider)}`)
      const res = await call(plane.url, 'POST', '/session/federated', ACME_HOST, {
        state: b.state,
        code,
        codeVerifier: b.verifier,
        connectionId: DOOR,
      })
      assert.equal(res.status, 422, `${String(provider)}: ${res.text}`)
      assert.equal(res.body?.['code'], 'sign_in_attempt_challenge_mismatch')
      assert.equal(await consumedFor(b.state), false)
      const users = await q('SELECT 1 FROM tenant."user" WHERE external_subject = $1', [
        `sub-provider-${String(provider)}`,
      ])
      assert.equal(users.length, 0, 'a person was provisioned on this door by another directory')
    }
  })

  it('§9 · RED — a return host that is also a served host fails the BOOT', async () => {
    process.env['RECONCILE_SIGNIN_RETURN_HOST'] = ACME_HOST
    try {
      await assert.rejects(
        () => startDataPlane({ poolMax: 1, identityTerms: null }),
        /return_host_is_a_served_host/,
      )
    } finally {
      process.env['RECONCILE_SIGNIN_RETURN_HOST'] = RETURN_HOST
    }
  })
})

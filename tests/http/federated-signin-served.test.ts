/**
 * `completeFederatedSignIn` OVER HTTP, AGAINST A LIVE PostgreSQL AND A LOCAL
 * OIDC BROKER — W3/S6, 1 Oct 2026, G2490–G2499.
 *
 * Every section is a witness the slice owes, and every refusal is driven
 * through the PRODUCTION handler, the PRODUCTION transport and the PRODUCTION
 * verifier; the only fake is the directory (`tests/e2e/fake-oidc-broker.ts`).
 *
 *   §1   the happy path: 303 to a PATH, the cookie, a NULL-tenant session on
 *        the host it arrived at, a provisioned person, a consumed attempt —
 *        and the session is USABLE: D1 binds the HOST's tenant once a
 *        membership exists
 *   §2   replay                        → 422, the broker never called
 *   §3   forged state                  → 422, the broker never called
 *   §4   expired attempt (D6-6)        → 422, the broker never called
 *   §5   G2443's FOURTH bound          → no app-role backend in a transaction
 *                                        or a query while the broker answers
 *   §6   D6-5/G2235/G2443's second     → a smuggled endpoint, pair, issuer or
 *        bound                           tenant is a 400; the call sites read
 *                                        the PIN and nothing else
 *   §7   wrong issuer                  → 422, NOT consumed
 *   §8   wrong nonce                   → 422, NOT consumed
 *   §9   unregistered host             → 403, the broker never called
 *   §10  a tenant smuggled in `state`  → the session is tenant-less and the
 *                                        HOST decides
 *   §11  connection mismatch           → 422, the broker never called
 *   §12  disabled door                 → 422 `connection_disabled`
 *   §13  broker down                   → 502, NOT consumed
 *   §14  no endpoint on the door       → 503
 *   §15  disabled person               → 403 `user_disabled`, NOT consumed —
 *                                        G2489's rollback, witnessed
 *   §16  console host                  → 303 to `/`
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool } from '../../db/tenant-scope.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { SESSION_COOKIE } from '../../server/data-plane/session-cookie.ts'
import { signInCallbackUrl } from '../../server/data-plane/code-exchange.ts'
import { mintFederatedSession } from '../../server/data-plane/session-mint-store.ts'
import type { FederatedCallback, IdentityConnectionId, SessionHandleDigest } from '../../model/domain.ts'
import type { SessionId, UserId } from '../../model/kernel.ts'
import { startFakeBroker, pkcePair, type FakeBroker } from '../e2e/fake-oidc-broker.ts'
import { REPO_ROOT } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_FEDERATED_SIGNIN_DB_NAME'] ?? runScopedName('reconcile_federated_signin_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const ACME_HOST = 'acme.ap-southeast-1.signin.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.signin.invalid'
const CONSOLE_HOST = 'console.signin.invalid'
const UNREGISTERED_HOST = 'attacker.ap-southeast-1.signin.invalid'
process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|${ACME}|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|${GLOBEX}|ap-southeast-1|pooled|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active`
process.env['RECONCILE_SESSION_MAX_LIFETIME_SECONDS'] = '28800'
process.env['RECONCILE_SESSION_MAX_IDLE_SECONDS'] = '900'

const AUDIENCE = 'reconcile-signin-test-client'
const DOOR = 'idc_s6_acme' as IdentityConnectionId
const OTHER_DOOR = 'idc_s6_other' as IdentityConnectionId
const SHUT_DOOR = 'idc_s6_shut' as IdentityConnectionId
const NO_ENDPOINT_DOOR = 'idc_s6_noendpoint' as IdentityConnectionId
const DEAD_DOOR = 'idc_s6_dead' as IdentityConnectionId
/** G2571: registered in the database and ABSENT from the boot inventory — a door added after boot. */
const UNLOADED_DOOR = 'idc_s6_unloaded' as IdentityConnectionId

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the federated sign-in callback suite', probe)

interface Res {
  readonly status: number
  readonly headers: Record<string, string | string[] | undefined>
  readonly body: Record<string, unknown> | undefined
}

function post(origin: string, host: string, body: unknown, cookie?: string): Promise<Res> {
  const url = new URL(origin)
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path: '/session/federated',
        method: 'POST',
        headers: {
          Host: host,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(cookie === undefined ? {} : { Cookie: cookie }),
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
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed })
        })
      },
    )
    req.on('error', reject)
    req.end(payload)
  })
}

function postTo(origin: string, p: string, host: string, cookie: string, body: unknown): Promise<Res> {
  const url = new URL(origin)
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path: p,
        method: 'POST',
        headers: {
          Host: host,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Cookie: cookie,
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
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed })
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

let seq = 0
/** A fresh attempt row on `door`, and the browser-side values that go with it. */
async function attempt(
  door: IdentityConnectionId,
  over: { started?: string; expires?: string; state?: string; host?: string | null } = {},
): Promise<{ state: string; nonce: string; verifier: string; challenge: string; id: string }> {
  seq += 1
  const state = over.state ?? `state-s6-${seq}-${Math.random().toString(36).slice(2)}`
  const nonce = `nonce-s6-${seq}-${Math.random().toString(36).slice(2)}`
  const { verifier, challenge } = pkcePair()
  const id = `sia_s6_${seq}`
  await q(
    `INSERT INTO tenant.sign_in_attempt
       (id, handle_digest, connection_id, challenge_digest, started_at, expires_at, consumed_at, begun_host)
     VALUES ($1, $2, $3, $4, ${over.started ?? 'now()'}, ${over.expires ?? "now() + interval '5 minutes'"}, NULL, $5)`,
    /* G2549 / `0360`: the host the begin would have recorded. Defaults to
     * the host every completion in this suite arrives on. */
    [id, digestOfHandle(state), door, digestOfHandle(nonce), over.host === undefined ? ACME_HOST : over.host],
  )
  return { state, nonce, verifier, challenge, id }
}

async function consumed(id: string): Promise<boolean> {
  const rows = await q<{ consumed_at: Date | null }>(
    'SELECT consumed_at FROM tenant.sign_in_attempt WHERE id = $1',
    [id],
  )
  return rows[0]?.consumed_at !== null && rows[0]?.consumed_at !== undefined
}

function cookieOf(res: Res): string | null {
  const raw = res.headers['set-cookie']
  const line = Array.isArray(raw) ? raw[0] : raw
  if (line === undefined) return null
  return line.split(';')[0] ?? null
}

/** G2764: the `identities` provider the fake broker states for each door — the row's `broker_ref`. */
const BROKER_REF_OF: Readonly<Record<string, string>> = {
  [DOOR]: 'acme-s6',
  [OTHER_DOOR]: 'other-s6',
  [SHUT_DOOR]: 'shut-s6',
  [NO_ENDPOINT_DOOR]: 'none-s6',
  [DEAD_DOOR]: 'dead-s6',
}

describe('S6 — completeFederatedSignIn, served', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let broker: FakeBroker

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    broker = await startFakeBroker({ audience: AUDIENCE })
    const rows: Array<[IdentityConnectionId, string, string, string, string | null]> = [
      [DOOR, broker.issuer, 'acme-s6', 'active', broker.tokenEndpoint],
      [OTHER_DOOR, 'https://idp.other.invalid/pool', 'other-s6', 'active', broker.tokenEndpoint],
      [SHUT_DOOR, 'https://idp.shut.invalid/pool', 'shut-s6', 'disabled', broker.tokenEndpoint],
      [NO_ENDPOINT_DOOR, 'https://idp.none.invalid/pool', 'none-s6', 'active', null],
      /* Port 9 is discard; nothing listens on it locally, so a connect is refused. */
      [DEAD_DOOR, 'https://idp.dead.invalid/pool', 'dead-s6', 'active', 'http://127.0.0.1:9/oauth2/token'],
      [UNLOADED_DOOR, broker.issuer, 'unloaded-s6', 'active', broker.tokenEndpoint],
    ]
    for (const [id, iss, ref, status, endpoint] of rows) {
      await q(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status, email_claim, name_claim, token_endpoint)
         VALUES ($1,'oidc','S6 door','customer',NULL,'acc_acme',$2,$3,$4,'email','name',$5)`,
        [id, iss, ref, status, endpoint],
      )
    }
    plane = await startDataPlane({
      poolMax: 2,
      /* G2571: per door. ⚠️ This was ONE `{ audience, jwks }` for the whole
       * plane until 1 Oct 2026; every door here shares the fake broker's
       * terms, and UNLOADED_DOOR is deliberately ABSENT — registered after boot. */
      identityTerms: {
        connections: new Map(
          [DOOR, OTHER_DOOR, SHUT_DOOR, NO_ENDPOINT_DOOR, DEAD_DOOR].map((id) => [
            id,
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

  async function signIn(
    host: string,
    door: IdentityConnectionId,
    a: { state: string; nonce: string; verifier: string; challenge: string },
    subject: string,
    over: {
      issuerOverride?: string
      nonceOverride?: string
      connectionId?: string
      extraClaims?: Record<string, unknown>
    } = {},
  ): Promise<Res> {
    const code = broker.mintCode({
      redirectUri: signInCallbackUrl(host),
      nonce: a.nonce,
      codeChallenge: a.challenge,
      subject,
      provider: BROKER_REF_OF[door] ?? null,
      claims: { email: `${subject}@acme.invalid`, name: `Person ${subject}`, ...over.extraClaims },
      ...(over.issuerOverride === undefined ? {} : { issuerOverride: over.issuerOverride }),
      ...(over.nonceOverride === undefined ? {} : { nonceOverride: over.nonceOverride }),
    })
    return post(plane.url, host, {
      state: a.state,
      code,
      codeVerifier: a.verifier,
      connectionId: over.connectionId ?? door,
    })
  }

  it('§1 · a real round trip: 303 to a PATH, the cookie, a NULL-tenant session bound to the host', async () => {
    const a = await attempt(DOOR)
    const res = await signIn(ACME_HOST, DOOR, a, 'sub-mei')
    assert.equal(res.status, 303, `expected 303, got ${res.status} ${JSON.stringify(res.body)}`)
    assert.equal(res.headers['location'], '/close', 'the redirect is not the tenant surface’s PATH')
    const cookie = cookieOf(res)
    assert.ok(cookie !== null && cookie.startsWith(`${SESSION_COOKIE}=`), 'no session cookie')
    const raw = String(res.headers['set-cookie'])
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) {
      assert.ok(raw.includes(attr), `the cookie lacks ${attr}`)
    }
    assert.ok(!/domain=/i.test(raw), 'the cookie carries a Domain attribute — `__Host-` forbids it')

    const handle = cookie.slice(SESSION_COOKIE.length + 1)
    const sessions = await q<{ tenant_id: string | null; issued_host: string; user_id: string }>(
      'SELECT tenant_id, issued_host, user_id FROM tenant.session WHERE handle_digest = $1',
      [digestOfHandle(handle)],
    )
    assert.equal(sessions.length, 1, 'the cookie names no session row')
    assert.equal(sessions[0]?.tenant_id, null, 'INVARIANT 1: the minted session carries a tenant')
    assert.equal(sessions[0]?.issued_host, ACME_HOST, 'G180: the session is not bound to the host it arrived at')
    const people = await q<{ external_subject: string; email: string; connection_id: string }>(
      'SELECT external_subject, email, connection_id FROM tenant."user" WHERE id = $1',
      [sessions[0]?.user_id],
    )
    assert.deepEqual(people[0], {
      external_subject: 'sub-mei',
      email: 'sub-mei@acme.invalid',
      connection_id: DOOR,
    })
    assert.equal(await consumed(a.id), true, 'the attempt was not consumed')

    /* AND IT IS A USABLE SESSION — the HOST's tenant binds, and only after a
     * membership exists, which is `selectTenantForSession()`'s check. */
    const unbound = await postTo(plane.url, '/context/resolve', ACME_HOST, cookie, {})
    assert.equal(unbound.status, 403)
    assert.equal(unbound.body?.['code'], 'membership_absent')
    await q(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_s6_mei', $2, 'rol_pack_ap_approver', 'usr_acme_admin', now(), NULL, NULL)`,
      [ACME, sessions[0]?.user_id],
    )
    const bound = await postTo(plane.url, '/context/resolve', ACME_HOST, cookie, {})
    assert.equal(bound.status, 200, `D1 did not bind: ${JSON.stringify(bound.body)}`)
    const tenants = await q<{ tenant_id: string | null }>(
      'SELECT tenant_id FROM tenant.session WHERE handle_digest = $1',
      [digestOfHandle(handle)],
    )
    assert.equal(tenants[0]?.tenant_id, ACME, 'D1 bound a tenant other than the HOST’s')
  })

  it('§2 · a REPLAYED callback is refused before anything is sent', async () => {
    const a = await attempt(DOOR)
    const first = await signIn(ACME_HOST, DOOR, a, 'sub-replay')
    assert.equal(first.status, 303)
    const before = broker.tokenCalls()
    const again = await signIn(ACME_HOST, DOOR, a, 'sub-replay')
    assert.equal(again.status, 422)
    assert.equal(again.body?.['code'], 'sign_in_attempt_replayed')
    assert.equal(broker.tokenCalls(), before, 'a replayed callback made the plane send a code')
  })

  it('§3 · a FORGED state names no row, and nothing is sent', async () => {
    const a = await attempt(DOOR)
    const before = broker.tokenCalls()
    const res = await signIn(ACME_HOST, DOOR, { ...a, state: 'forged-state-value' }, 'sub-forge')
    assert.equal(res.status, 422)
    assert.equal(res.body?.['code'], 'sign_in_attempt_handle_mismatch')
    assert.equal(broker.tokenCalls(), before)
    assert.equal(await consumed(a.id), false)
  })

  it('§4 · an EXPIRED attempt (D6-6) answers exactly as a forged one, and nothing is sent', async () => {
    const a = await attempt(DOOR, { started: "now() - interval '11 minutes'", expires: "now() + interval '1 hour'" })
    const before = broker.tokenCalls()
    const res = await signIn(ACME_HOST, DOOR, a, 'sub-expired')
    assert.equal(res.status, 422)
    assert.equal(res.body?.['code'], 'sign_in_attempt_handle_mismatch', 'an expired attempt is distinguishable from a forged one — an oracle over which `state`s once existed')
    assert.equal(broker.tokenCalls(), before)
  })

  it('§5 · G2443’s FOURTH BOUND — no app-role backend is in a transaction while the broker answers', async () => {
    /* ANTI-VACUITY FIRST: the probe query really does see an app-role backend
     * that is inside a transaction. */
    /* ⚠️ THE PROBE CONNECTS AS `reconcile_app` ITSELF, AND THAT IS MEASURED
     * RATHER THAN A STYLE: `pg_stat_activity` reports `state` as NULL for
     * another role's backends unless the reader is privileged, so a probe
     * run as the migrator saw NOTHING and this section passed vacuously on
     * its first run. A role always sees its own role's backends whole. */
    const probePool = await createAppPool(2)
    const inside = async (): Promise<number> => {
      const c = await probePool.connect()
      try {
        return Number(((await c.query(INSIDE_A_TRANSACTION)).rows[0] as { n: string }).n)
      } finally {
        c.release()
      }
    }
    try {
      const held = await probePool.connect()
      try {
        await held.query('BEGIN')
        await held.query('SELECT 1')
        assert.ok((await inside()) >= 1, 'the probe cannot see an open app-role transaction — §5 would pass vacuously')
        await held.query('ROLLBACK')
      } finally {
        held.release()
      }

      let during: number | null = null
      broker.onToken(async () => {
        during = Math.max(during ?? 0, await inside())
      })
      try {
        const a = await attempt(DOOR)
        const res = await signIn(ACME_HOST, DOOR, a, 'sub-pool')
        assert.equal(res.status, 303)
      } finally {
        broker.onToken(null)
      }
    assert.equal(
      during,
      0,
      'AN APP-ROLE CONNECTION WAS INSIDE A TRANSACTION WHILE THE BROKER WAS ANSWERING. G2443: ' +
        '"outside any database transaction" — D6 measured that ten anonymous callers already ' +
        'hold `createAppPool(max = 10)`, and a connection held across a network round trip ' +
        'makes that cheaper by the IdP’s latency.',
      )
    } finally {
      await probePool.end()
    }
  })

  it('§6 · a smuggled endpoint, broker pair, issuer or tenant is a 400, and nothing is sent', async () => {
    const a = await attempt(DOOR)
    const before = broker.tokenCalls()
    for (const extra of [
      { tokenEndpoint: 'http://127.0.0.1:1/steal' },
      { brokerIssuer: 'https://evil.invalid' },
      { brokerRef: 'evil' },
      { tenantId: GLOBEX },
    ]) {
      const res = await post(plane.url, ACME_HOST, {
        state: a.state,
        code: 'x',
        codeVerifier: a.verifier,
        connectionId: DOOR,
        ...extra,
      })
      assert.equal(res.status, 400, `a body carrying ${Object.keys(extra)[0]} was not refused`)
      assert.equal(res.body?.['code'], 'validation_failed')
    }
    assert.equal(broker.tokenCalls(), before)
    assert.equal(await consumed(a.id), false)
  })

  it('§6b · D6-5/G2235/G2443 — the call sites take the pair, the issuer and the endpoint off the PIN', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'server', 'data-plane', 'federated-signin.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    assert.match(src, /tokenEndpointOf\(pinned\.tokenEndpoint\)/, 'the endpoint is not the pinned row’s')
    assert.match(src, /brokerIssuer:\s*pinned\.brokerIssuer/, 'the mint scope’s issuer is not the pinned row’s')
    assert.match(src, /brokerRef:\s*pinned\.brokerRef/, 'the mint scope’s reference is not the pinned row’s')
    /* ⚠️ This matched `verificationTermsAt(deps.terms, pinned.brokerIssuer` until
     * 1 Oct 2026; G2571 makes the second argument the pinned DOOR — its id
     * selects the keys and audience, its issuer is D6-5's. Same property, wider. */
    assert.match(
      src,
      /verificationTermsAt\(\s*deps\.terms,\s*\{\s*connectionId:\s*pinned\.connection\.id,\s*issuer:\s*pinned\.brokerIssuer\s*\}/,
      'the token is not verified against the pinned door’s issuer, keys and audience',
    )
    assert.equal(/body\.(brokerIssuer|brokerRef|tokenEndpoint|tenantId)/.test(src), false, 'the handler reads a pair, an endpoint or a tenant off the BODY')
  })

  it('§7 · a token with the WRONG issuer is refused, and the attempt is NOT consumed', async () => {
    const a = await attempt(DOOR)
    const res = await signIn(ACME_HOST, DOOR, a, 'sub-iss', { issuerOverride: 'https://idp.other.invalid/pool' })
    assert.equal(res.status, 422)
    assert.equal(res.body?.['code'], 'sign_in_attempt_challenge_mismatch')
    assert.equal(await consumed(a.id), false, 'a refused token burned the attempt')
  })

  it('§8 · a token with the WRONG nonce is refused (D6 §4.3), and the attempt is NOT consumed', async () => {
    const a = await attempt(DOOR)
    const res = await signIn(ACME_HOST, DOOR, a, 'sub-nonce', { nonceOverride: 'another-attempt-nonce' })
    assert.equal(res.status, 422)
    assert.equal(res.body?.['code'], 'sign_in_attempt_challenge_mismatch')
    assert.equal(await consumed(a.id), false)
    const people = await q('SELECT 1 FROM tenant."user" WHERE external_subject = $1', ['sub-nonce'])
    assert.equal(people.length, 0, 'a refused sign-in provisioned a person')
  })

  it('§8b · the wire answers for a bad token and a bad nonce are one LENGTH as well as one code', async () => {
    const a = await attempt(DOOR)
    const b = await attempt(DOOR)
    const iss = await signIn(ACME_HOST, DOOR, a, 'sub-len', { issuerOverride: 'https://x.invalid' })
    const non = await signIn(ACME_HOST, DOOR, b, 'sub-len', { nonceOverride: 'other' })
    assert.equal(JSON.stringify(iss.body).length, JSON.stringify(non.body).length)
  })

  it('§9 · an UNREGISTERED host is refused before anything is read or sent', async () => {
    const a = await attempt(DOOR)
    const before = broker.tokenCalls()
    const res = await signIn(UNREGISTERED_HOST, DOOR, a, 'sub-host')
    assert.equal(res.status, 403)
    assert.equal(res.body?.['code'], 'tenant_context_missing')
    assert.equal(res.headers['location'], undefined, 'a refusal carried a Location')
    assert.equal(broker.tokenCalls(), before)
    assert.equal(await consumed(a.id), false)
  })

  it('§10 · a tenant SMUGGLED in `state` confers nothing: the session is tenant-less and the HOST decides', async () => {
    const a = await attempt(DOOR, { state: `tenant=${GLOBEX};redirect=https://${GLOBEX_HOST}/` })
    const res = await signIn(ACME_HOST, DOOR, a, 'sub-smuggle')
    assert.equal(res.status, 303)
    assert.equal(res.headers['location'], '/close', 'the redirect was steered by `state`')
    const handle = (cookieOf(res) ?? '').slice(SESSION_COOKIE.length + 1)
    const rows = await q<{ tenant_id: string | null; issued_host: string }>(
      'SELECT tenant_id, issued_host FROM tenant.session WHERE handle_digest = $1',
      [digestOfHandle(handle)],
    )
    assert.deepEqual(rows[0], { tenant_id: null, issued_host: ACME_HOST })
  })

  it('§11 · a callback naming another door is refused, and nothing is sent', async () => {
    const a = await attempt(DOOR)
    const before = broker.tokenCalls()
    const res = await signIn(ACME_HOST, DOOR, a, 'sub-door', { connectionId: OTHER_DOOR })
    assert.equal(res.status, 422)
    assert.equal(res.body?.['code'], 'sign_in_attempt_connection_mismatch')
    assert.equal(broker.tokenCalls(), before)
  })

  it('§12 · a DISABLED pinned door is refused before the exchange', async () => {
    const a = await attempt(SHUT_DOOR)
    const before = broker.tokenCalls()
    const res = await signIn(ACME_HOST, SHUT_DOOR, a, 'sub-shut')
    assert.equal(res.status, 422)
    assert.equal(res.body?.['code'], 'connection_disabled')
    assert.equal(broker.tokenCalls(), before)
  })

  it('§13 · a broker that cannot be reached is a 502 and consumes nothing', async () => {
    const a = await attempt(DEAD_DOOR)
    const res = await signIn(ACME_HOST, DEAD_DOOR, a, 'sub-dead')
    assert.equal(res.status, 502)
    assert.equal(res.body?.['code'], 'upstream_unavailable')
    assert.equal(await consumed(a.id), false)
  })

  it('§14 · a door with no token endpoint is the platform’s 503', async () => {
    const a = await attempt(NO_ENDPOINT_DOOR)
    const res = await signIn(ACME_HOST, NO_ENDPOINT_DOOR, a, 'sub-none')
    assert.equal(res.status, 503)
    assert.equal(res.body?.['code'], 'upstream_unavailable')
  })

  it('§15 · a DISABLED person is refused AND THE ATTEMPT IS NOT CONSUMED — G2489’s rollback', async () => {
    await q(
      `INSERT INTO tenant."user"
         (id, email, display_name, status, connection_id, external_subject, broker_issuer, broker_ref)
       VALUES ('usr_s6_disabled','d@acme.invalid','Disabled','disabled',$1,'sub-disabled',$2,'acme-s6')`,
      [DOOR, broker.issuer],
    )
    const a = await attempt(DOOR)
    const res = await signIn(ACME_HOST, DOOR, a, 'sub-disabled')
    assert.equal(res.status, 403)
    assert.equal(res.body?.['code'], 'user_disabled')
    assert.equal(
      await consumed(a.id),
      false,
      'the mint was refused and the CONSUMPTION COMMITTED. `withSignInScope()` commits what its ' +
        'callback returns; G2489 makes a post-write refusal roll back.',
    )
  })

  it('§15b · G2489 directly: unusable bounds on a FIRST sign-in leave no person and no consumption', async () => {
    const a = await attempt(DOOR)
    const pool = await createAppPool(1)
    const out = await mintFederatedSession(pool, {
      brokerIssuer: broker.issuer,
      brokerRef: 'acme-s6',
      stateDigest: digestOfHandle(a.state) as SessionHandleDigest,
      externalSubject: 'sub-bounds',
      callback: {
        handleDigest: digestOfHandle(a.state),
        connectionId: DOOR,
        challengeDigest: digestOfHandle(a.nonce),
      } as FederatedCallback,
      claims: { email: 'b@acme.invalid', name: 'B' },
      emailVerified: true,
      newUserId: 'usr_s6_bounds' as UserId,
      newSessionId: 'ses_s6_bounds' as SessionId,
      newHandleDigest: digestOfHandle('handle-s6-bounds') as SessionHandleDigest,
      issuedHost: ACME_HOST,
      bounds: {},
    }).finally(() => pool.end())
    assert.equal(out.ok, false)
    if (!out.ok) assert.equal(out.kind, 'mint')
    const people = await q('SELECT 1 FROM tenant."user" WHERE id = $1', ['usr_s6_bounds'])
    assert.equal(
      people.length,
      0,
      'A PERSON WAS PROVISIONED FOR A SIGN-IN THAT MINTED NO SESSION — G1637’s "directory that ' +
        'grows by one row per abandoned callback". Witnessed RED before G2489.',
    )
    assert.equal(await consumed(a.id), false)
  })

  it('§14b · G2571 — a door registered AFTER boot is the platform’s 503 by name, and nothing is sent', async () => {
    const before = broker.tokenCalls()
    const a = await attempt(UNLOADED_DOOR)
    const res = await signIn(ACME_HOST, UNLOADED_DOOR, a, 'sub-unloaded')
    assert.equal(res.status, 503)
    assert.equal(res.body?.['code'], 'upstream_unavailable')
    assert.equal(broker.tokenCalls(), before, 'a code was exchanged for a door with no boot-time terms')
    assert.equal(await consumed(a.id), false)
  })

  /* G2901/G2902 — `email_verified` travels the WHOLE served path: signed by the
   * broker, read after the signature, carried through the exchange, and STORED
   * on the provisioned person. Both spellings a Cognito broker emits — the
   * boolean and the string `"true"` — and the absent claim. */
  it('§18 · `email_verified` reaches the provisioned person: `true` and Cognito’s `"true"` prove it; absent does not', async () => {
    const cases: ReadonlyArray<readonly [string, Record<string, unknown>, boolean]> = [
      ['sub-ev-bool', { email_verified: true }, true],
      ['sub-ev-cognito', { email_verified: 'true' }, true],
      ['sub-ev-false', { email_verified: 'false' }, false],
      ['sub-ev-absent', {}, false],
    ]
    for (const [subject, extraClaims, expected] of cases) {
      const a = await attempt(DOOR)
      const res = await signIn(ACME_HOST, DOOR, a, subject, { extraClaims })
      assert.equal(res.status, 303, `${subject}: ${res.status} ${JSON.stringify(res.body)}`)
      const rows = await q<{ email_verified: boolean }>(
        'SELECT email_verified FROM tenant."user" WHERE external_subject = $1',
        [subject],
      )
      assert.equal(rows[0]?.email_verified, expected, `${subject}: email_verified stored ${String(rows[0]?.email_verified)}`)
    }
  })

  it('§16 · a CONSOLE host lands on `/`', async () => {
    const a = await attempt(DOOR, { host: CONSOLE_HOST })
    const res = await signIn(CONSOLE_HOST, DOOR, a, 'sub-console')
    assert.equal(res.status, 303)
    assert.equal(res.headers['location'], '/')
  })

  it('§17 · G2495 — two CONCURRENT callbacks for one `state`, two different codes: exactly ONE mints', async () => {
    /**
     * 🛑 DETERMINISTIC RATHER THAN LUCKY. A third connection (the migrator)
     * holds the attempt's ROW LOCK while both callbacks are fired, and the
     * lock is released only once BOTH are parked on it — so the interleaving
     * that let both mint is FORCED rather than hoped for. Without
     * `ATTEMPT_READ_FOR_CONSUME`'s `FOR UPDATE` both mint transactions READ the
     * row unconsumed (a plain `SELECT` is not blocked by a row lock), park at
     * the consuming `UPDATE`, and on release BOTH commit: two `303`s, two
     * sessions — witnessed RED before the lock was taken. With it, both park at
     * the READ, and the second reads the row AS CONSUMED and is refused by the
     * model by name.
     */
    const a = await attempt(DOOR)
    const codes = ['first', 'second'].map((n) =>
      broker.mintCode({
        redirectUri: signInCallbackUrl(ACME_HOST),
        nonce: a.nonce,
        codeChallenge: a.challenge,
        subject: 'sub-race',
        provider: 'acme-s6',
        claims: { email: `race-${n}@acme.invalid`, name: 'Race' },
      }),
    )
    const holder = await migratorClient()
    try {
      await holder.query('BEGIN')
      await holder.query('SELECT 1 FROM tenant.sign_in_attempt WHERE id = $1 FOR UPDATE', [a.id])
      const inflight = codes.map((code) =>
        post(plane.url, ACME_HOST, { state: a.state, code, codeVerifier: a.verifier, connectionId: DOOR }),
      )
      const deadline = Date.now() + 10_000
      for (;;) {
        /* `pg_locks` and not `pg_stat_activity`: the migrator holds no
         * `pg_read_all_stats`, so another role's wait columns read NULL. */
        const waiting = await q<{ n: string }>(
          `SELECT count(DISTINCT pid) AS n FROM pg_locks WHERE NOT granted`,
        )
        if (Number(waiting[0]?.n ?? 0) >= 2) break
        if (Date.now() > deadline) throw new Error('the two callbacks never both reached the attempt’s row lock')
        await new Promise((r) => setTimeout(r, 25))
      }
      await holder.query('COMMIT')
      const answers = await Promise.all(inflight)
      const statuses = answers.map((r) => r.status).sort()
      assert.deepEqual(
        statuses,
        [303, 422],
        `one attempt minted ${statuses.filter((s) => s === 303).length} sessions — G2495: ` +
          JSON.stringify(answers.map((r) => r.body)),
      )
      const refused = answers.find((r) => r.status === 422)
      assert.equal(refused?.body?.['code'], 'sign_in_attempt_replayed', 'the loser was not refused AS A REPLAY')
      const sessions = await q<{ n: string }>(
        `SELECT count(*) AS n FROM tenant.session s JOIN tenant."user" u ON u.id = s.user_id
          WHERE u.external_subject = 'sub-race'`,
      )
      assert.equal(Number(sessions[0]?.n), 1, 'two sessions were minted from one attempt')
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined)
      await holder.end()
    }
  })
})

const INSIDE_A_TRANSACTION = `
  SELECT count(*) AS n FROM pg_stat_activity
   WHERE datname = current_database()
     AND usename = current_user
     AND pid <> pg_backend_pid()
     AND (state LIKE 'idle in transaction%' OR state = 'active')
`

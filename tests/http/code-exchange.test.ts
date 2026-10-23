/**
 * THE CODE EXCHANGE, AND THE BINDING D6 §4.3 MEASURED AS ABSENT — W3/S5,
 * R3 and R4, G2151–G2159, 25 Sep 2026.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ NOTHING IN THIS FILE REACHES A NETWORK, AND THE MODULE UNDER TEST CANNOT.  │
 * │ Every token is minted here with a keypair this file generated; every       │
 * │ token-endpoint response is a VALUE this file wrote.                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THAT IS THE SLICE'S SHAPE AND NOT A TESTING CONVENIENCE. R2 authorises
 * outbound HTTP **at boot**; nothing authorises it on a request path, and an
 * authorization-code exchange is per sign-in by construction. `code-exchange.ts`
 * therefore stops at the seam and its header argues the conflict at length.
 * **§6 below is the executable half of that argument**: this module carries no
 * outbound call, and the only transport it ships refuses.
 *
 * 🛑 §4 IS THE ONE TO READ. `docs/build/d6-threat-model.md` §4.3:
 * *"`challengeDigest` … Both sides of that comparison are values the same
 * caller supplied … It does not prove the token was issued for this attempt,
 * because the binding that would prove that is the ID token's `nonce` claim,
 * and §2.1 measured that `VerifiedClaims` has no `nonce` field."* It has one
 * now, and §4 drives the comparison that uses it — including the case where an
 * attacker holds a live `state` AND the challenge digest and still fails.
 *
 * ⚠️ NO DATABASE, NO BROWSER, NO PLANE, NO SOCKET — no `tests/reachability.ts`
 * guard here and there must not be one.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CODE_EXCHANGE_REFUSALS,
  SIGN_IN_CALLBACK_PATH,
  bindTokenToAttempt,
  codeExchangeRequest,
  completeCodeExchange,
  TOKEN_ENDPOINT_MAX_BODY_BYTES,
  TOKEN_ENDPOINT_TIMEOUT_MS,
  exchangeCode,
  readTokenEndpointResponse,
  signInCallbackUrl,
  tokenEndpointOf,
  tokenEndpointTransport,
} from '../../server/data-plane/code-exchange.ts'
import type { CodeExchangeRefusal } from '../../server/data-plane/code-exchange.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { SUGGESTED_CLOCK_SKEW_SECONDS } from '../../server/data-plane/token-verify.ts'
import type { JsonWebKeyEntry, VerifiedClaims } from '../../server/data-plane/token-verify.ts'
import {
  pinnedBrokerIssuer,
  type PinnedVerificationTerms,
} from '../../server/data-plane/verification-terms.ts'
import type { AssertNoTenantDeep } from '../../model/session-mint.ts'
import type { TenantId } from '../../model/kernel.ts'
import type { SessionHandleDigest } from '../../model/domain.ts'

/* ------------------------------------------------------------------ *
 * Fixtures — this file holds the private key, so it can forge anything
 * ------------------------------------------------------------------ */

const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const AUDIENCE = 'reconcile-tenant-client'
const SUBJECT = 'a4f1e2c0-0000-4000-8000-000000000077'
const NOW = new Date('2026-09-20T12:00:00.000Z')
const NOW_SECONDS = NOW.getTime() / 1000

/** What our own redirect sent to the broker as `nonce`. */
const CHALLENGE = 'chal_0S6_WzA2Mj_this_attempt'
/** What `tenant.sign_in_attempt.challenge_digest` therefore holds. */
const PINNED = digestOfHandle(CHALLENGE) as SessionHandleDigest
assert.notEqual(PINNED, null, 'the fixture challenge did not digest — the file is vacuous')

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = publicKey.export({ format: 'jwk' })
const BROKER_JWK: JsonWebKeyEntry = {
  kty: 'RSA',
  kid: 'broker-key-1',
  use: 'sig',
  alg: 'RS256',
  n: typeof jwk.n === 'string' ? jwk.n : '',
  e: typeof jwk.e === 'string' ? jwk.e : '',
}

/* D6-5, 1 Oct 2026: the issuer reaches the terms through the PINNED ROW and
 * nothing else, so this suite builds a door and reads it — it was a bare
 * `issuer: ISSUER` on a `TokenVerificationTerms` until then, which is now a
 * `TS2322` at every `completeCodeExchange()` call below. */
const PINNED_ISSUER = pinnedBrokerIssuer({ federation: { brokerIssuer: ISSUER, brokerRef: 'acme-entra' } })
if (PINNED_ISSUER === null) throw new Error('a brokered door produced no pinned issuer — the file is vacuous')

const TERMS: PinnedVerificationTerms = {
  issuer: PINNED_ISSUER,
  audience: AUDIENCE,
  jwks: { keys: [BROKER_JWK] },
  now: NOW,
  clockSkewSeconds: SUGGESTED_CLOCK_SKEW_SECONDS,
}

function b64url(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return Buffer.from(text, 'utf8').toString('base64url')
}

function idToken(extra: Record<string, unknown> = {}): string {
  const header = b64url({ alg: 'RS256', kid: BROKER_JWK.kid })
  const payload = b64url({
    iss: ISSUER,
    aud: AUDIENCE,
    sub: SUBJECT,
    exp: NOW_SECONDS + 3600,
    iat: NOW_SECONDS - 10,
    nonce: CHALLENGE,
    ...extra,
  })
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`, 'ascii')
    .sign(privateKey)
    .toString('base64url')
  return `${header}.${payload}.${signature}`
}

function response(body: unknown, status = 200): { status: number; body: string } {
  return { status, body: typeof body === 'string' ? body : JSON.stringify(body) }
}

/** The claims a verified token yields, for the binding cases that skip §0. */
function claims(over: Partial<VerifiedClaims> = {}): VerifiedClaims {
  return {
    issuer: ISSUER,
    subject: SUBJECT,
    audience: [AUDIENCE],
    expiresAt: NOW_SECONDS + 3600,
    notBefore: null,
    issuedAt: NOW_SECONDS - 10,
    nonce: CHALLENGE,
    emailVerified: true,
    ...over,
  }
}

const WITNESSED = new Set<CodeExchangeRefusal['kind']>()

function refusedWith(
  result: { ok: boolean; refusal?: CodeExchangeRefusal },
  expected: CodeExchangeRefusal['kind'],
  why: string,
): void {
  assert.equal(result.ok, false, `${why} — but it SUCCEEDED`)
  const refusal = result.refusal
  assert.notEqual(refusal, undefined, `${why} — refused with no refusal`)
  if (refusal === undefined) return
  assert.equal(refusal.kind, expected, `${why} — wrong arm`)
  WITNESSED.add(refusal.kind)
}

/* ══════════════════════════════════════════════════════════════════ *
 * §0  THE ANTI-VACUITY ARM. A file that only witnesses refusals is
 *     §5.6 wearing a census.
 * ══════════════════════════════════════════════════════════════════ */

test('§0 · a real broker response, a real token and the right nonce yields an identity', () => {
  const result = completeCodeExchange(response({ id_token: idToken() }), TERMS, PINNED)
  assert.equal(
    result.ok,
    true,
    'the whole happy path failed, so every refusal below is true of a function that refuses ' +
      'everything.',
  )
  if (!result.ok) return
  assert.equal(result.identity.subject, SUBJECT)
  assert.equal(result.identity.issuer, ISSUER)
  assert.equal(result.identity.expiresAt, NOW_SECONDS + 3600)
})

test('§0b · and what it yields carries no tenant, no org and no session', () => {
  const result = completeCodeExchange(response({ id_token: idToken() }), TERMS, PINNED)
  assert.equal(result.ok, true)
  if (!result.ok) return
  /* ⚠️ FIVE KEYS SINCE S6 (G2487, G2488), AND THE TWO ADDED ARE ARGUED ON THE
   * DECLARATION: the digest of the VERIFIED nonce, and the claims the caller
   * NAMED. Neither is a tenant, an org or a session, and `_ExchangeReachesNoTenantDeep`
   * still proves it deep. ⚠️ SIX SINCE 2 Oct 2026 (G2901): `emailVerified`, a
   * BOOLEAN about the token's `email` claim — not a tenant, an org or a session
   * either, and argued on `VerifiedClaims`. */
  assert.deepEqual(
    Object.keys(result.identity).sort(),
    ['challengeDigest', 'emailVerified', 'expiresAt', 'issuer', 'projected', 'subject'],
    'the exchange now yields more than it is argued to. `orgClass` is ' +
      '`orgFor(connection.owner)` and is NEVER conferred by a token; a tenant is bound later ' +
      'and elsewhere by `selectTenantForSession()`, which is a CHECK and never a CHOOSER.',
  )
  assert.equal(result.identity.challengeDigest, PINNED, 'the carried digest is not the bound one')
  assert.deepEqual(result.identity.projected, {}, 'claims were projected that nobody named')
  assert.equal(result.identity.emailVerified, false, 'a token with no `email_verified` was carried as PROVED')
})

test('§0c · only the NAMED claims are projected, and only as scalars', () => {
  const result = completeCodeExchange(
    response({
      id_token: idToken({ email: 'mei@acme.example', name: 'Mei', groups: ['admins'], tid: 'ten_x' }),
    }),
    TERMS,
    PINNED,
    ['email', 'name', 'groups'],
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.identity.projected,
    { email: 'mei@acme.example', name: 'Mei' },
    'a claim nobody named (`tid`) or a structure (`groups`) was carried onward',
  )
})

/**
 * INVARIANT 1, AND THE PROOF IS KNOWN TO BITE RATHER THAN MERELY TO COMPILE.
 *
 * `_ExchangeReachesNoTenantDeep` in the module asserts `AssertNoTenantDeep` over
 * `ExchangedIdentity`. This is the `@ts-expect-error` that shows the assertion
 * has teeth — S2's own device (`tests/model/session-mint.test.ts` §1), because
 * a type-level proof that never fails is a proof nobody has witnessed.
 */
// @ts-expect-error invariant 1 — a `TenantId` at ANY property position is refused
type _TenantWouldNotCompile = AssertNoTenantDeep<{ readonly tenantId: TenantId }>

/* ══════════════════════════════════════════════════════════════════ *
 * §1  R4's SHAPE — THE MIRROR, ASSERTED RATHER THAN TRUSTED
 * ══════════════════════════════════════════════════════════════════ */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')

test('§1 · the callback path agrees with what `infra/` registers with the broker', () => {
  const infra = readFileSync(join(REPO, 'infra', 'lib', 'config.ts'), 'utf8')
  const match = /export const COGNITO_CALLBACK_PATH = '([^']+)'/.exec(infra)
  assert.notEqual(
    match,
    null,
    '`COGNITO_CALLBACK_PATH` is no longer declared in `infra/lib/config.ts` in the form this ' +
      'mirror reads. The two literals must be compared by SOMETHING: `server/` cannot import ' +
      '`infra/` (separate projects, and `aws-cdk-lib` must never enter the root manifest — ' +
      'G212), so this test is the only thing standing between them.',
  )
  assert.equal(
    match?.[1],
    SIGN_IN_CALLBACK_PATH,
    'the callback path this plane builds and the one `infra/` registers with Cognito have ' +
      'DRIFTED. A `redirect_uri` is compared byte-for-byte by the broker, so every sign-in ' +
      'would die AT COGNITO with no request reaching us and no error in our logs at all.',
  )
})

test('§1b · and the redirect URI is `https`, concatenated around a host the caller resolved', () => {
  assert.equal(
    signInCallbackUrl('console.reconcileai.app'),
    'https://console.reconcileai.app/signin/callback',
  )
  /* D6 §4.4's condition: the target comes from `resolveServingHost()` — a
   * LOOKUP that refuses unregistered hosts — and never from a parse. What this
   * function concatenates is the scheme and the path, both constants. */
  assert.ok(
    signInCallbackUrl('partners.reconcileai.app').startsWith('https://'),
    'the scheme is not fixed. `__Host-reconcile_session` requires `Secure` regardless, and a ' +
      'scheme that varied by environment would fail at the broker for every deployment that ' +
      'got it wrong.',
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §2  THE REQUEST — WHAT IT CARRIES, AND THE CREDENTIAL IT DOES NOT
 * ══════════════════════════════════════════════════════════════════ */

test('§2 · the exchange request is RFC 6749 §4.1.3 plus PKCE, and nothing else', () => {
  const request = codeExchangeRequest({
    tokenEndpoint: 'https://auth.example.test/oauth2/token',
    clientId: 'reconcile-tenant-client',
    redirectUri: signInCallbackUrl('console.reconcileai.app'),
    code: 'authz-code-abc',
    codeVerifier: 'verifier-xyz',
  })
  assert.equal(request.method, 'POST')
  assert.equal(request.url, 'https://auth.example.test/oauth2/token')
  assert.deepEqual(
    request.form.map(([k]) => k).sort(),
    ['client_id', 'code', 'code_verifier', 'grant_type', 'redirect_uri'],
    'the form fields changed. `scope` is deliberately absent — it is fixed at the ' +
      'AUTHORIZATION request and re-sending it here cannot widen anything, so it would be a ' +
      'field with no reader.',
  )
  assert.deepEqual(
    request.form.find(([k]) => k === 'grant_type'),
    ['grant_type', 'authorization_code'],
  )
})

test('§2b · there is NO client secret, and the input type has nowhere to put one', () => {
  const request = codeExchangeRequest({
    tokenEndpoint: 'https://auth.example.test/oauth2/token',
    clientId: 'reconcile-tenant-client',
    redirectUri: signInCallbackUrl('console.reconcileai.app'),
    code: 'authz-code-abc',
    codeVerifier: 'verifier-xyz',
  })
  const names = [
    ...request.form.map(([k]) => k),
    ...Object.keys(request.headers),
  ].join(' ')
  assert.equal(
    /secret|authorization/i.test(names),
    false,
    'the exchange now carries a client secret or an Authorization header. That is a ' +
      'long-lived credential held by a SERVING process for its entire life, which is what ' +
      'G193 split the migrator into a one-shot job to prevent — and this one mints SESSIONS. ' +
      'PKCE is what replaces it, and `codeVerifier` is REQUIRED for exactly that reason.',
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §3  READING THE ANSWER
 * ══════════════════════════════════════════════════════════════════ */

test('§3 · an OAuth error is named as one, even though it arrives with a 400', () => {
  /* RFC 6749 §5.2 requires a 400 carrying `error`, so a status-first reader
   * would report `token_endpoint_status_not_ok` for every `invalid_grant` —
   * which is the REPLAY case, the one an operator most needs named. */
  refusedWith(
    readTokenEndpointResponse(response({ error: 'invalid_grant' }, 400)),
    'token_endpoint_reported_error',
    'a replayed or expired authorization code',
  )
})

test('§3b · and a 200 carrying an `error` is believed over its own status line', () => {
  refusedWith(
    readTokenEndpointResponse(response({ error: 'invalid_client' }, 200)),
    'token_endpoint_reported_error',
    'a broker contradicting itself — the fail-closed direction',
  )
})

test('§3c · a bad status with no OAuth error keeps the status', () => {
  const read = readTokenEndpointResponse(response({ message: 'gateway' }, 502))
  assert.equal(read.ok, false)
  if (read.ok) return
  assert.equal(read.refusal.kind, 'token_endpoint_status_not_ok')
  if (read.refusal.kind !== 'token_endpoint_status_not_ok') return
  assert.equal(read.refusal.status, 502)
  WITNESSED.add('token_endpoint_status_not_ok')
})

test('§3d · a body that is not a JSON object is unreadable', () => {
  refusedWith(
    readTokenEndpointResponse(response('<html>proxy error</html>')),
    'token_endpoint_body_unreadable',
    'an HTML error page from a proxy',
  )
  refusedWith(
    readTokenEndpointResponse(response('[1,2,3]')),
    'token_endpoint_body_unreadable',
    'a JSON array is not a token response',
  )
})

test('§3e · a 200 with an access token and no ID token identifies nobody', () => {
  refusedWith(
    readTokenEndpointResponse(response({ access_token: 'at', token_type: 'Bearer' })),
    'token_endpoint_returned_no_id_token',
    'an access-token-only response',
  )
})

test('§3f · and the verifier’s own refusal travels whole rather than being flattened', () => {
  /* A token from the RIGHT broker for the WRONG audience: `aud` is the one
   * claim that decides whether ANOTHER application's token is accepted as
   * ours. */
  const result = completeCodeExchange(
    response({ id_token: idToken({ aud: 'some-other-app' }) }),
    TERMS,
    PINNED,
  )
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.refusal.kind, 'identity_token_refused')
  if (result.refusal.kind !== 'identity_token_refused') return
  assert.equal(
    result.refusal.refusal.kind,
    'token_audience_mismatch',
    'the verifier’s fifteen arms mean fifteen different things to an operator — a ' +
      'misconfigured client, a rotated key, an unreadable key document, a forgery. Collapsing ' +
      'them here would file every one under whichever name somebody happened to grep.',
  )
  WITNESSED.add('identity_token_refused')
})

/* ══════════════════════════════════════════════════════════════════ *
 * §4  THE BINDING — D6 §4.3, CLOSED
 * ══════════════════════════════════════════════════════════════════ */

test('§4 · a token whose nonce digests to the pinned challenge is bound', () => {
  assert.deepEqual(bindTokenToAttempt(claims(), PINNED), { ok: true })
})

test('§4b · a token carrying NO nonce is refused, never waved through', () => {
  refusedWith(
    bindTokenToAttempt(claims({ nonce: null }), PINNED),
    'token_carries_no_nonce',
    'a token that cannot be proven to belong to this attempt',
  )
  /* Admitting it would make the binding OPTIONAL, which is the same as not
   * having one: an attacker presenting a stolen token chooses whether to
   * include a nonce. */
})

test('§4c · THE ATTACK D6 §4.3 NAMES: a live state AND the challenge, with another token', () => {
  /**
   * The residual D6 measured: *"If an attacker obtains a live, unconsumed
   * `state` AND the challenge digest, every arm passes."* Every arm of
   * `consumeSignInAttempt()` still does — both sides of ITS comparison are the
   * caller's. What refuses here is that the attacker's TOKEN was issued for a
   * different sign-in, so its signed `nonce` is not ours, and the attacker
   * cannot change it without the broker's private key.
   */
  refusedWith(
    bindTokenToAttempt(claims({ nonce: 'chal_a_different_sign_in' }), PINNED),
    'token_nonce_does_not_match_attempt',
    'a valid, correctly signed token from a DIFFERENT attempt',
  )
})

test('§4d · and the whole act refuses it too, so the arm is reachable end to end', () => {
  refusedWith(
    completeCodeExchange(
      response({ id_token: idToken({ nonce: 'chal_a_different_sign_in' }) }),
      TERMS,
      PINNED,
    ),
    'token_nonce_does_not_match_attempt',
    'a fully valid token for another attempt, through the real verifier',
  )
})

test('§4f · G2764 — the directory the broker used must be the pinned door\'s, by `identities`', () => {
  const one = (name: string) => [{ providerName: name, providerType: 'OIDC' }]
  /* Anti-vacuity: the pinned provider, as an array and as Cognito's string form, PASSES. */
  for (const identities of [one('c-pinned'), JSON.stringify(one('c-pinned'))]) {
    const ok = completeCodeExchange(response({ id_token: idToken({ identities }) }), TERMS, PINNED, [], 'c-pinned')
    assert.equal(ok.ok, true, `the pinned provider was refused: ${JSON.stringify(ok)}`)
  }
  for (const [identities, why] of [
    [one('c-another-door'), 'a different directory behind the same broker'],
    [undefined, 'a token that names no directory'],
    [[...one('c-pinned'), ...one('c-another-door')], 'a token naming two directories'],
    ['not json', 'an unreadable claim'],
  ] as const) {
    refusedWith(
      completeCodeExchange(
        response({ id_token: idToken(identities === undefined ? {} : { identities }) }),
        TERMS,
        PINNED,
        [],
        'c-pinned',
      ),
      'token_broker_provider_mismatch',
      why,
    )
  }
})

test('§4e · the comparison is over DIGESTS, so no cleartext challenge is needed to check it', () => {
  /* `model/domain.ts` on `challengeDigest`: "COMPARED, NEVER RE-DERIVED —
   * re-deriving it from anything the callback supplied would compare the
   * caller's value against itself." The token's nonce is not something the
   * callback supplied: it is inside a signature. */
  const pinnedElsewhere = digestOfHandle('chal_a_different_sign_in') as SessionHandleDigest
  assert.deepEqual(
    bindTokenToAttempt(claims({ nonce: 'chal_a_different_sign_in' }), pinnedElsewhere),
    { ok: true },
    'the binding is not symmetric under a consistent rename, so it is not comparing what it ' +
      'claims to compare.',
  )
  assert.notEqual(
    PINNED,
    pinnedElsewhere,
    'two different challenges digested to the same value — the fixture proves nothing.',
  )
})

test('§4f · a malformed pinned digest refuses rather than throwing out of `timingSafeEqual`', () => {
  refusedWith(
    bindTokenToAttempt(claims(), 'too-short' as SessionHandleDigest),
    'token_nonce_does_not_match_attempt',
    'a stored digest of the wrong length',
  )
  /* `timingSafeEqual` THROWS on unequal lengths. Without the guard this would
   * be a 500 rather than a refusal, and the 500 would itself leak the length
   * distinction the constant-time comparison exists to hide. */
})

/* ══════════════════════════════════════════════════════════════════ *
 * §5  THE TRANSPORT — G2443, APPLIED 1 Oct 2026
 *
 * ⚠️ THIS SECTION WAS *"THE TRANSPORT THAT REFUSES"* AND ITS ONE TEST READ
 * *"the only transport this repository ships refuses, loudly, naming the
 * ruling"*. The ruling is taken (G2443) and that transport is DELETED; the
 * title is quoted rather than kept, because the function it named no longer
 * exists to be witnessed. What replaces it is the real transport, driven
 * against a REAL local server, on every arm the ruling bounds.
 * ══════════════════════════════════════════════════════════════════ */

interface LocalServer {
  readonly url: string
  close(): Promise<void>
}

async function localServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<LocalServer> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  return {
    url: `http://127.0.0.1:${address.port}/oauth2/token`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

function sampleRequest(url: string) {
  return codeExchangeRequest({
    tokenEndpoint: url,
    clientId: AUDIENCE,
    redirectUri: signInCallbackUrl('ten-acme.us-west-2.reconcileai.app'),
    code: 'the-code',
    codeVerifier: 'v'.repeat(43),
  })
}

test('§5 · the real transport POSTs the request VALUE, form-encoded, and returns status and body', async () => {
  let seen: { method: string; type: string; body: string } | null = null
  const broker = await localServer((req, res) => {
    let body = ''
    req.on('data', (c: Buffer) => (body += c.toString('utf8')))
    req.on('end', () => {
      seen = { method: req.method ?? '', type: String(req.headers['content-type']), body }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id_token: 'x' }))
    })
  })
  try {
    const out = await exchangeCode(sampleRequest(broker.url), tokenEndpointTransport())
    assert.equal(out.ok, true, 'the transport failed against a broker that answered')
    if (!out.ok) return
    assert.equal(out.response.status, 200)
    assert.equal(JSON.parse(out.response.body).id_token, 'x')
    assert.notEqual(seen, null)
    const got = seen as unknown as { method: string; type: string; body: string }
    assert.equal(got.method, 'POST')
    assert.equal(got.type, 'application/x-www-form-urlencoded')
    assert.deepEqual(
      [...new URLSearchParams(got.body).keys()],
      ['grant_type', 'client_id', 'redirect_uri', 'code', 'code_verifier'],
      'the transport sent something other than the five fields `codeExchangeRequest()` built',
    )
  } finally {
    await broker.close()
  }
})

test('§5b · a broker that never answers is cut off at the timeout and is a VALUE, not a throw', async () => {
  const broker = await localServer(() => {
    /* never answers */
  })
  try {
    const started = Date.now()
    const out = await exchangeCode(sampleRequest(broker.url), tokenEndpointTransport(150))
    refusedWith(out, 'token_endpoint_unreachable', 'a broker that never answered')
    assert.ok(
      Date.now() - started < 2_000,
      'the timeout did not bound the call — an anonymous caller could hold a socket open ' +
        'on a stalled broker for as long as it liked (G2443\'s third bound)',
    )
  } finally {
    await broker.close()
  }
})

test('§5c · a REDIRECT from the token endpoint is refused, never followed', async () => {
  let followed = false
  const elsewhere = await localServer((_req, res) => {
    followed = true
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"id_token":"stolen"}')
  })
  const broker = await localServer((_req, res) => {
    res.writeHead(307, { location: elsewhere.url })
    res.end()
  })
  try {
    const out = await exchangeCode(sampleRequest(broker.url), tokenEndpointTransport())
    refusedWith(out, 'token_endpoint_unreachable', 'a token endpoint that redirected')
    assert.equal(
      followed,
      false,
      'THE CODE AND THE VERIFIER WERE SENT TO A HOST THE DOOR DID NOT PIN. A followed ' +
        '`307` re-POSTs the body to the `Location` — G2443\'s second bound, defeated one hop ' +
        'later than the column.',
    )
  } finally {
    await broker.close()
    await elsewhere.close()
  }
})

test('§5d · a body larger than the cap is refused rather than read whole', async () => {
  const broker = await localServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('"' + 'a'.repeat(TOKEN_ENDPOINT_MAX_BODY_BYTES + 10) + '"')
  })
  try {
    const out = await exchangeCode(sampleRequest(broker.url), tokenEndpointTransport())
    refusedWith(out, 'token_endpoint_unreachable', 'an oversized token-endpoint body')
  } finally {
    await broker.close()
  }
})

test('§5e · the endpoint must be declared, and must be `https:` or a loopback literal', () => {
  refusedWith(tokenEndpointOf(null), 'token_endpoint_not_declared', 'a door with no endpoint')
  refusedWith(
    tokenEndpointOf('http://idp.example.com/oauth2/token'),
    'token_endpoint_not_declared',
    'a CLEARTEXT endpoint off the host — the code and verifier would cross the network in the clear',
  )
  refusedWith(
    tokenEndpointOf('http://localhost:9/oauth2/token'),
    'token_endpoint_not_declared',
    '`localhost` — a NAME a resolver this process does not control decides',
  )
  refusedWith(
    tokenEndpointOf('https://user:pw@idp.example.com/token'),
    'token_endpoint_not_declared',
    'an endpoint carrying credentials in its authority',
  )
  refusedWith(tokenEndpointOf('not a url'), 'token_endpoint_not_declared', 'an unparseable endpoint')
  assert.deepEqual(tokenEndpointOf('https://auth.example.com/oauth2/token'), {
    ok: true,
    url: 'https://auth.example.com/oauth2/token',
  })
  assert.equal(tokenEndpointOf('http://127.0.0.1:4100/oauth2/token').ok, true)
  assert.equal(TOKEN_ENDPOINT_TIMEOUT_MS <= 5_000, true, 'the timeout is no longer SHORT')
})

/* ══════════════════════════════════════════════════════════════════ *
 * §6  ONE CALL, IN THIS FILE, AND NO BOOT-TIME TRANSPORT
 * ══════════════════════════════════════════════════════════════════ */

function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

test('§6 · `code-exchange.ts` carries EXACTLY ONE outbound call and imports no boot transport', () => {
  /**
   * ⚠️ INVERTED, NOT DELETED — 1 Oct 2026, G2443. This read *"`code-exchange.ts`
   * carries no outbound call"* and required ZERO `fetch(`. The owner's ruling
   * names this file as the ONE that may; what is held now is that it is ONE
   * call and not two, which is the narrow half of §1c's census.
   */
  const code = codeOnly(
    readFileSync(join(REPO, 'server', 'data-plane', 'code-exchange.ts'), 'utf8'),
  )
  assert.equal(
    (code.match(/\bfetch\s*\(/g) ?? []).length,
    1,
    'the code exchange makes a number of outbound calls other than ONE. G2443 authorises a ' +
      'POST to the pinned token endpoint and nothing else.',
  )
  assert.equal(
    /jwks-source/.test(code),
    false,
    '`code-exchange.ts` now reaches the boot-time transport. That module is dynamically ' +
      'imported from `loadVerificationTerms()` and nowhere else.',
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §7  THE CENSUS. A tenth arm with no test is a RED GATE.
 * ══════════════════════════════════════════════════════════════════ */

test('§7 · every declared exchange refusal has been witnessed', () => {
  /**
   * ⚠️ THE EXEMPTION THAT STOOD HERE IS GONE WITH THE ARM IT EXEMPTED.
   * `token_endpoint_egress_not_authorised` was added to `WITNESSED` by hand,
   * because nothing could return it. Both successors are RETURNED, by §5b–§5e.
   */
  const declared = [...CODE_EXCHANGE_REFUSALS].sort()
  const witnessed = [...WITNESSED].sort()
  assert.deepEqual(
    witnessed,
    declared,
    'a member of `CODE_EXCHANGE_REFUSALS` was never produced in this file. ' +
      `Missing: [${declared.filter((d) => !witnessed.includes(d)).join(' | ')}]`,
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §8  MOUNTED ONCE, PUBLICLY, ON THE DATA PLANE — S6
 * ══════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ INVERTED, NOT DELETED — 1 Oct 2026. This read *"`completeFederatedSignIn`
 * is still mounted nowhere — R1 is open"*. R1 is CLOSED (D6-1, the owner's:
 * *"Both operations go public; mount the callback too."*). The property that
 * survives is the one the old assertion's own comment cared about: it pins a
 * SET and no count — the control plane mounts it NOWHERE, and the data plane
 * mounts it under `servedPublicly()`, D6-8's mark.
 */
test('§8 · `completeFederatedSignIn` is mounted on the data plane alone, under servedPublicly()', () => {
  const control = codeOnly(readFileSync(join(REPO, 'server', 'control-plane', 'start.ts'), 'utf8'))
  assert.equal(
    /completeFederatedSignIn/.test(control),
    false,
    'the CONTROL plane mounts the sign-in callback. It reads tenant tables — invariant 3.',
  )
  const data = codeOnly(readFileSync(join(REPO, 'server', 'data-plane', 'start.ts'), 'utf8'))
  assert.match(
    data,
    /completeFederatedSignIn:\s*servedPublicly\(/,
    'the data plane mounts the callback without D6-8\'s mark (or not at all)',
  )
})

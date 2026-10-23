/**
 * G2996–G3002 — THE STAGING MOCK OIDC DOOR, EXECUTED. `infra/lambda/mock-idp/
 * idp.mjs` driven with an in-memory RSA key standing in for KMS, so every
 * refusal its header names is witnessed rather than read.
 *
 *   §1  discovery and JWKS; the issuer is AWS's `domainName`, never `Host`.
 *   §2  `/authorize` refuses an unknown client and ANY redirect but Cognito's.
 *   §3  the picker shows a door ONLY its own personas; `login_hint` pre-selects.
 *   §4  RED — an EMPTY password secret refuses every sign-in.
 *   §5  RED — a wrong password, and a persona of another door.
 *   §6  a sign-in mints a code, logs ONE line, and sends it to Cognito alone.
 *   §7  `/token`: client secret, client binding, redirect binding, expiry —
 *       and an id_token that verifies against the published key.
 *   §8  `/userinfo` answers the persona, and nothing for a forged token.
 *   §10 every page's form-action is 'self' alone (G3284 reverts G3281's widening).
 *   §11 RED — a non-https redirect allow-list will not start (G3282).
 *   §12 a sign-in answers a 200 HAND-OFF, never a 302 (G3284), and `state`
 *       cannot inject markup or a second refresh target.
 *   §9  RED — a catalogue naming an address outside the mock domain will not
 *       start, and the function refuses to run outside staging.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicKey, createSign, createVerify, generateKeyPairSync } from 'node:crypto'

import { handle, parseCatalogue, allowedRedirectOrigin, CODE_TTL_SECONDS } from '../../infra/lambda/mock-idp/idp.mjs'
import { awsDeps } from '../../infra/lambda/mock-idp/index.mjs'
import { MOCK_DOORS, MOCK_PERSONAS } from '../../infra/lib/mock-personas.ts'

const REDIRECT = 'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com/oauth2/idpresponse'
const DOMAIN = 'abcdefghijklmnopqrstuvwxyz012345.lambda-url.us-west-2.on.aws'
const ISSUER = `https://${DOMAIN}`
const CLIENT_SECRET = 'generated-client-secret-not-a-real-one'
const PASSWORD = 'correct horse battery staple, mock'

function catalogueJson() {
  return JSON.stringify({
    doors: Object.fromEntries(
      Object.entries(MOCK_DOORS).map(([k, d]) => [k, { clientId: d.clientId, domain: d.domain }]),
    ),
    personas: MOCK_PERSONAS.map((p) => ({ sub: p.sub, door: p.door, email: p.email, name: p.name, actor: p.actor })),
  })
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256', use: 'sig' }

function deps({ password = PASSWORD, now = () => Date.now() } = {}) {
  const lines = []
  return {
    lines,
    catalogue: parseCatalogue(catalogueJson()),
    now,
    allowedRedirectUri: REDIRECT,
    log: (line) => lines.push(line),
    password: async () => password,
    clientSecret: async () => CLIENT_SECRET,
    publicJwk: async () => jwk,
    signRs256: async (bytes) => createSign('RSA-SHA256').update(bytes).sign(privateKey).toString('base64url'),
  }
}

function get(path, query = {}, extra = {}) {
  return {
    rawPath: path,
    queryStringParameters: query,
    headers: { host: 'evil.example.com', ...(extra.headers ?? {}) },
    requestContext: { domainName: DOMAIN, http: { method: 'GET' } },
  }
}
function post(path, form, extra = {}) {
  return {
    rawPath: path,
    body: new URLSearchParams(form).toString(),
    isBase64Encoded: false,
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(extra.headers ?? {}) },
    requestContext: { domainName: DOMAIN, http: { method: 'POST' } },
  }
}

const customer = MOCK_DOORS.customer
const admin = MOCK_PERSONAS.find((p) => p.sub === 'mock-cust-admin')
const staff = MOCK_PERSONAS.find((p) => p.sub === 'mock-staff-platform')
const authorizeQuery = (over = {}) => ({
  client_id: customer.clientId,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: 'openid email profile',
  state: 'cognito-state-1',
  nonce: 'cognito-nonce-1',
  ...over,
})

async function signIn(d, over = {}) {
  return handle(post('/authorize', { ...authorizeQuery(), persona: admin.email, password: PASSWORD, ...over }), d)
}

test('§1 · discovery and JWKS; the issuer is AWS’s domainName and never the Host header', async () => {
  const res = await handle(get('/.well-known/openid-configuration'), deps())
  const body = JSON.parse(res.body)
  assert.equal(body.issuer, ISSUER)
  assert.equal(body.token_endpoint, `${ISSUER}/token`)
  assert.deepEqual(body.id_token_signing_alg_values_supported, ['RS256'])
  const keys = JSON.parse((await handle(get('/jwks'), deps())).body).keys
  assert.equal(keys.length, 1)
  assert.equal(keys[0].kid, 'test-kid')
  assert.equal(keys[0].d, undefined, 'the JWKS published a PRIVATE key component')
})

test('§2 · /authorize refuses an unknown client and any redirect but Cognito’s', async () => {
  for (const [over, why] of [
    [{ client_id: 'someone-else' }, 'unknown_client'],
    [{ redirect_uri: 'https://evil.example.com/cb' }, 'redirect_uri_not_allowed'],
    [{ redirect_uri: `${REDIRECT}?x=1` }, 'redirect_uri_not_allowed'],
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ scope: 'email' }, 'openid_scope_absent'],
  ]) {
    const res = await handle(get('/authorize', authorizeQuery(over)), deps())
    assert.equal(res.statusCode, 400, JSON.stringify(over))
    assert.match(res.body, new RegExp(why))
  }
})

test('§3 · the picker shows a door ONLY its own personas, says it is a test door, and login_hint pre-selects', async () => {
  const hint = MOCK_PERSONAS.find((p) => p.sub === 'mock-cust-approver-b')
  const res = await handle(get('/authorize', authorizeQuery({ login_hint: hint.email })), deps())
  assert.equal(res.statusCode, 200)
  assert.match(res.body, /TEST DOOR — STAGING ONLY/)
  for (const p of MOCK_PERSONAS) {
    assert.equal(res.body.includes(p.email), p.door === 'customer', `${p.sub} on the customer door's page`)
  }
  assert.match(res.body, new RegExp(`value="${hint.email.replace('.', '\\.')}" checked`))
  assert.equal(res.headers['x-frame-options'], 'DENY')
  assert.doesNotMatch(res.body, /value="correct horse/, 'the password reached the page')
})

test('§4 · RED — an EMPTY password secret refuses every sign-in', async () => {
  const d = deps({ password: '' })
  const res = await signIn(d, { password: '' })
  assert.equal(res.statusCode, 401)
  assert.equal(res.headers.location, undefined)
  assert.deepEqual(d.lines.at(-1), { event: 'mock_sign_in_refused', refusal: 'password_not_set', door: 'customer' })
})

test('§5 · RED — a wrong password, and a persona of another door, mint nothing', async () => {
  const d = deps()
  const wrong = await signIn(d, { password: 'guess' })
  assert.equal(wrong.statusCode, 401)
  assert.equal(wrong.headers.location, undefined)
  assert.doesNotMatch(wrong.body, /http-equiv="refresh"/)
  assert.equal(d.lines.at(-1).refusal, 'password_mismatch')
  const crossing = await signIn(d, { persona: staff.email })
  assert.equal(crossing.statusCode, 401)
  assert.equal(d.lines.at(-1).refusal, 'persona_not_on_this_door')
  const tampered = await signIn(d, { redirect_uri: 'https://evil.example.com/cb' })
  assert.equal(tampered.statusCode, 400, 'the POST trusted the hidden redirect_uri field')
})

function unescapeHtml(v) {
  return v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

/** G3284: the hand-off page's ONE target, read from both the meta refresh and the link, which must agree. */
function handoffTarget(res) {
  assert.equal(res.statusCode, 200, 'a sign-in must answer the 200 hand-off, not a redirect')
  assert.equal(res.headers.location, undefined, 'a sign-in must not 302 — form-action governs the whole redirect chain')
  const metas = [...res.body.matchAll(/<meta http-equiv="refresh" content="0;url=([^"]*)">/g)]
  assert.equal(metas.length, 1, 'exactly one refresh')
  const links = [...res.body.matchAll(/<a href="([^"]*)">/g)]
  assert.equal(links.length, 1, 'exactly one link')
  const target = unescapeHtml(metas[0][1])
  assert.equal(unescapeHtml(links[0][1]), target)
  return target
}

async function codeFor(d, over = {}) {
  const res = await signIn(d, over)
  const back = new URL(handoffTarget(res))
  return { back, code: back.searchParams.get('code') }
}

test('§6 · a sign-in mints a code for Cognito alone and logs exactly one line', async () => {
  const d = deps()
  const { back, code } = await codeFor(d)
  assert.equal(`${back.origin}${back.pathname}`, REDIRECT)
  assert.equal(back.searchParams.get('state'), 'cognito-state-1')
  assert.ok(code)
  assert.deepEqual(d.lines, [{ event: 'mock_sign_in', persona: 'mock-cust-admin', door: 'customer' }])
})

function tokenForm(code, over = {}) {
  return {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT,
    client_id: customer.clientId,
    client_secret: CLIENT_SECRET,
    ...over,
  }
}

test('§7 · /token binds client, secret, redirect and expiry, and the id_token verifies', async () => {
  const d = deps()
  const { code } = await codeFor(d)
  assert.equal((await handle(post('/token', tokenForm(code, { client_secret: 'nope' })), d)).statusCode, 401)
  assert.equal(
    (await handle(post('/token', tokenForm(code, { client_id: MOCK_DOORS.platform.clientId })), d)).statusCode,
    400,
    'a customer-door code was redeemed by the platform door',
  )
  assert.equal((await handle(post('/token', tokenForm(code, { redirect_uri: `${REDIRECT}x` })), d)).statusCode, 400)
  const later = deps({ now: () => Date.now() + (CODE_TTL_SECONDS + 5) * 1000 })
  assert.equal((await handle(post('/token', tokenForm(code)), later)).statusCode, 400, 'an expired code was redeemed')

  const basic = Buffer.from(`${customer.clientId}:${CLIENT_SECRET}`).toString('base64')
  const res = await handle(
    post('/token', { grant_type: 'authorization_code', code, redirect_uri: REDIRECT }, { headers: { authorization: `Basic ${basic}` } }),
    d,
  )
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  const [h, p, s] = body.id_token.split('.')
  const ok = createVerify('RSA-SHA256')
    .update(`${h}.${p}`)
    .verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'))
  assert.equal(ok, true, 'the id_token does not verify against the published key')
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  assert.equal(claims.iss, ISSUER)
  assert.equal(claims.aud, customer.clientId)
  assert.equal(claims.sub, 'mock-cust-admin')
  assert.equal(claims.nonce, 'cognito-nonce-1')
  assert.equal(claims.email, admin.email)
  assert.equal(claims.email_verified, true)
  assert.equal(JSON.parse(Buffer.from(h, 'base64url').toString('utf8')).alg, 'RS256')

  const info = await handle(get('/userinfo', {}, { headers: { authorization: `Bearer ${body.access_token}` } }), d)
  assert.equal(info.statusCode, 200)
  assert.deepEqual(JSON.parse(info.body), {
    sub: 'mock-cust-admin',
    email: admin.email,
    email_verified: true,
    name: admin.name,
  })
})

test('§8 · /userinfo answers nothing for a forged or absent token', async () => {
  const d = deps()
  for (const auth of ['', 'Bearer ', 'Bearer eyJrIjoiYWNjZXNzIn0.forged']) {
    const res = await handle(get('/userinfo', {}, { headers: { authorization: auth } }), d)
    assert.equal(res.statusCode, 401, auth)
  }
})

test('§9 · RED — a catalogue outside the mock domain will not start; nor will the door outside staging', () => {
  const good = JSON.parse(catalogueJson())
  const outside = structuredClone(good)
  outside.personas[0].email = 'admin@1cloudhub.com'
  assert.throws(() => parseCatalogue(JSON.stringify(outside)), /own door's mock domain/)
  const wrongDoor = structuredClone(good)
  wrongDoor.personas[0].email = `admin@${MOCK_DOORS.platform.domain}`
  assert.throws(() => parseCatalogue(JSON.stringify(wrongDoor)), /own door's mock domain/)
  const doorOutside = structuredClone(good)
  doorOutside.doors.customer.domain = 'acme.example'
  assert.throws(() => parseCatalogue(JSON.stringify(doorOutside)), /outside mock\.reconcileai\.app/)
  assert.doesNotThrow(() => parseCatalogue(JSON.stringify(good)))

  const env = {
    MOCK_IDP_ENVIRONMENT: 'prod',
    MOCK_IDP_KMS_KEY_ID: 'k',
    MOCK_IDP_PASSWORD_SECRET: 'p',
    MOCK_IDP_CLIENT_SECRET: 'c',
    MOCK_IDP_ALLOWED_REDIRECT_URI: REDIRECT,
    MOCK_IDP_CATALOGUE: catalogueJson(),
  }
  assert.throws(() => awsDeps({ kms: null, secrets: null, commands: {}, env }), /refusing to run/)
  assert.doesNotThrow(() => awsDeps({ kms: null, secrets: null, commands: {}, env: { ...env, MOCK_IDP_ENVIRONMENT: 'staging' } }))
})

/*
 * §10 · G3284 — EVERY PAGE'S `form-action` IS `'self'` ALONE. G3281 admitted
 * Cognito's origin and staging was still blocked: Chrome enforces form-action
 * across the WHOLE redirect chain of a submission (mock → Cognito → auth relay
 * → tenant host), and no allow-list can name every tenant host. The hand-off
 * page ends the chain at the mock door, so the tightest policy holds.
 */
test('§10 · every page’s form-action is exactly self, the hand-off included', async () => {
  const res = await handle(get('/authorize', authorizeQuery()), deps())
  assert.equal(res.statusCode, 200)
  const csp = res.headers['content-security-policy']
  assert.equal(csp, "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")
  assert.equal(res.headers['x-frame-options'], 'DENY')
  const again = await signIn(deps(), { password: 'nope' })
  assert.equal(again.headers['content-security-policy'], csp)
  const refused = await handle(get('/authorize', authorizeQuery({ client_id: 'someone-else' })), deps())
  assert.equal(refused.headers['content-security-policy'], csp)
  const handoff = await signIn(deps())
  assert.equal(handoff.headers['content-security-policy'], csp)
  assert.equal(handoff.headers['referrer-policy'], 'no-referrer', 'the hand-off URL carries the code')
  assert.equal(handoff.headers['cache-control'], 'no-store')
  assert.doesNotMatch(handoff.body, /<script|<form/i)
})

test('§11 · RED — a redirect allow-list that is not an absolute https URL will not start', () => {
  for (const bad of ['', 'not a url', 'http://reconcile.auth.us-west-2.amazoncognito.com/oauth2/idpresponse']) {
    assert.throws(() => allowedRedirectOrigin(bad), /redirect_uri is not/, JSON.stringify(bad))
  }
  assert.equal(allowedRedirectOrigin(REDIRECT), 'https://reconcile-000000000000-staging.auth.us-west-2.amazoncognito.com')
  const env = {
    MOCK_IDP_ENVIRONMENT: 'staging',
    MOCK_IDP_KMS_KEY_ID: 'k',
    MOCK_IDP_PASSWORD_SECRET: 'p',
    MOCK_IDP_CLIENT_SECRET: 'c',
    MOCK_IDP_ALLOWED_REDIRECT_URI: 'http://insecure.example/cb',
    MOCK_IDP_CATALOGUE: catalogueJson(),
  }
  assert.throws(() => awsDeps({ kms: null, secrets: null, commands: {}, env }), /not https/)
})

test('§12 · a sign-in answers the hand-off to exactly the allow-listed redirect_uri, and state cannot inject', async () => {
  const evil = `x"><script>alert(1)</script><meta http-equiv="refresh" content="0;url=https://evil.example/'&`
  const res = await signIn(deps(), { state: evil })
  const back = new URL(handoffTarget(res))
  assert.equal(`${back.origin}${back.pathname}`, REDIRECT)
  assert.deepEqual([...back.searchParams.keys()], ['code', 'state'])
  assert.equal(back.searchParams.get('state'), evil, 'state round-trips verbatim')
  assert.doesNotMatch(res.body, /<script/i)
  assert.doesNotMatch(res.body, /evil\.example\/'/)
  // no state, no state parameter
  const bare = new URL(handoffTarget(await signIn(deps(), { state: '' })))
  assert.deepEqual([...bare.searchParams.keys()], ['code'])
})

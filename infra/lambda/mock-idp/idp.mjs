/**
 * THE STAGING MOCK OIDC IDENTITY PROVIDER — THE TESTABLE CORE (G2996–G3002;
 * the owner's rulings G2771, 2 Oct 2026: *"Create a mock sign-in so Claude can
 * run live browser tests against staging without passkeys."*).
 *
 * 🛑 READ `infra/lib/mock-idp-stack.ts` FIRST. The fences live there, with the
 * IAM and the concurrency they describe; this file is the protocol and the
 * half a test can execute. `index.mjs` wires it to KMS and Secrets Manager.
 *
 * THE MINIMUM SURFACE COGNITO NEEDS FROM AN OIDC PROVIDER, AND NOTHING ELSE:
 *
 *   GET  /.well-known/openid-configuration
 *   GET  /jwks                 the public half of a KMS key; the private half
 *                              never leaves KMS and is in this tree nowhere
 *   GET  /authorize            a persona picker and a password field
 *   POST /authorize            checks the password, mints a code
 *   POST /token                exchanges the code; client auth by secret
 *   GET  /userinfo             the persona's claims, by access token
 *
 * ┌─ 🛑 WHAT THIS DOOR REFUSES, EACH BECAUSE THE ALTERNATIVE IS A CREDENTIAL ─┐
 * │ ⛔ A `redirect_uri` THAT IS NOT COGNITO'S `idpresponse` URL, BYTE FOR BYTE. │
 * │    The code is the credential this door issues; a redirect anywhere else  │
 * │    hands it to whoever composed the link — D6 §4.4 at a second door.      │
 * │ ⛔ A SIGN-IN WHILE THE PASSWORD SECRET IS EMPTY. The stack creates it with │
 * │    an empty `password`; until a person puts a value every POST refuses.   │
 * │    There is no default password and no published one — the exact reason  │
 * │    G192's test token is refused on a deployed plane.                     │
 * │ ⛔ A PERSONA OF ANOTHER DOOR. A customer-door `client_id` is shown, and   │
 * │    may sign in, only the customer personas.                              │
 * │ ⛔ A CATALOGUE NAMING AN ADDRESS OUTSIDE `*.mock.reconcileai.app`.        │
 * │    `parseCatalogue()` throws at boot, so the door never starts.          │
 * │ ⛔ A CODE OLDER THAN `CODE_TTL_SECONDS`, A CODE FOR ANOTHER CLIENT OR      │
 * │    ANOTHER `redirect_uri`, AND A CLIENT THAT CANNOT STATE THE SECRET.     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ A CODE IS SELF-CONTAINED AND HMAC-SEALED, AND THEREFORE NOT SINGLE-USE AT
 * THIS DOOR. There is no table behind a Lambda function URL, and adding one
 * for a test door is a second store to secure. Single use is COGNITO's — it
 * redeems a code once, at its own back channel, holding the client secret —
 * and a replay here buys a token for a persona the replayer already had the
 * password for. Named rather than hidden (G3000).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const CODE_TTL_SECONDS = 120
export const TOKEN_TTL_SECONDS = 300

/** The one environment this door may run in. `mock-idp-stack.ts` throws on any other at synth. */
export const MOCK_IDP_ENVIRONMENT = 'staging'
/** Every persona address lives under this; the catalogue is refused otherwise. */
export const MOCK_IDENTITY_DOMAIN = 'mock.reconcileai.app'

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
}

/**
 * G3281 → G3284 — WHY THE LOGIN PAGE'S `form-action` IS `'self'` AGAIN, AND
 * WHY A SUCCESSFUL SIGN-IN ANSWERS 200 RATHER THAN 302.
 *
 * 🛑 LIVE ON STAGING, 3 Oct 2026, TWICE. With `form-action 'self'` alone the
 * 302 from `/authorize` to Cognito's `idpresponse` was blocked silently. G3281
 * then admitted Cognito's origin — and the sign-in was STILL blocked, because
 * Chrome enforces `form-action` across the ENTIRE redirect chain of a form
 * submission: mock 302 → Cognito `idpresponse` 302 → the G2549 relay on
 * `auth.<region>.reconcileai.app` 303 → `<tenant|console|partners>/signin/
 * callback`. Measured in Chromium: `FAILED GET …/oauth2/idpresponse?code=…
 * net::ERR_ABORTED`, with the console naming `form-action`. Admitting every hop
 * would mean listing every tenant host in a CSP, which no allow-list can hold.
 *
 * G3284: a successful POST answers a 200 HAND-OFF page (`handoffPage()`) whose
 * `<meta http-equiv="refresh">` navigates to Cognito. That navigation is a NEW
 * top-level navigation started by a document, not part of the form submission,
 * so `form-action` governs nothing downstream of it — and the policy returns to
 * `'self'` alone, its tightest form. The meta target is ONLY ever the
 * byte-for-byte allow-listed `redirect_uri` plus `code` and `state`.
 *
 * `allowedRedirectOrigin()` survives as G3282's BOOT refusal: the hand-off
 * navigates to that value, so one that is not an absolute `https:` URL refuses
 * to START rather than redirecting a browser somewhere plain-text.
 */
export function allowedRedirectOrigin(allowedRedirectUri) {
  let url
  try {
    url = new URL(allowedRedirectUri)
  } catch {
    throw new Error('mock-idp: the allowed redirect_uri is not an absolute URL')
  }
  if (url.protocol !== 'https:') throw new Error('mock-idp: the allowed redirect_uri is not https')
  return url.origin
}

/**
 * G3284 — the 200 hand-off. No script (the CSP is `default-src 'none'`), so the
 * refresh is a `<meta>` and a visible link carries the same URL for a browser
 * that ignores refresh. `referrer-policy: no-referrer` and `no-store` hold
 * because the URL carries the authorisation code.
 */
export function handoffPage(target) {
  const href = escapeHtml(target)
  return {
    statusCode: 200,
    headers: HTML_HEADERS,
    body:
      '<!doctype html><meta charset="utf-8">' +
      `<meta http-equiv="refresh" content="0;url=${href}">` +
      '<title>ReconcileAI staging — MOCK sign-in</title>' +
      `<p data-mock-handoff>Signed in to the mock door. <a href="${href}">Continue</a>.</p>`,
  }
}
const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' }

function json(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function b64url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').toString('base64url')
}

function underMockDomain(domain) {
  return typeof domain === 'string' && domain.endsWith(`.${MOCK_IDENTITY_DOMAIN}`) && !/[^a-z0-9.-]/.test(domain)
}

/**
 * The catalogue the stack hands this function — `{ doors, personas }` from
 * `infra/lib/mock-personas.ts`, as JSON. 🛑 FENCE 3 (G2999) HELD AGAIN AT THE
 * DOOR ITSELF: every door's domain and every persona's address must sit under
 * `mock.reconcileai.app`, and a persona's address must be on ITS OWN door's
 * domain. A catalogue that breaks either THROWS, so a door that would sign in
 * a real address cannot start.
 */
export function parseCatalogue(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('mock-idp: MOCK_IDP_CATALOGUE is not JSON')
  }
  const doors = parsed?.doors
  const personas = parsed?.personas
  if (typeof doors !== 'object' || doors === null || !Array.isArray(personas) || personas.length === 0) {
    throw new Error('mock-idp: MOCK_IDP_CATALOGUE has no doors or no personas')
  }
  const clients = new Map()
  for (const [key, door] of Object.entries(doors)) {
    if (!underMockDomain(door?.domain)) {
      throw new Error(`mock-idp: door '${key}' is claimed for '${String(door?.domain)}', outside ${MOCK_IDENTITY_DOMAIN}`)
    }
    if (typeof door.clientId !== 'string' || door.clientId === '' || clients.has(door.clientId)) {
      throw new Error(`mock-idp: door '${key}' has no client id of its own`)
    }
    clients.set(door.clientId, key)
  }
  const subs = new Set()
  for (const p of personas) {
    const door = doors[p?.door]
    if (door === undefined) throw new Error(`mock-idp: persona '${String(p?.sub)}' names no door`)
    const at = typeof p.email === 'string' ? p.email.lastIndexOf('@') : -1
    if (at < 1 || p.email.slice(at + 1) !== door.domain || p.email !== p.email.toLowerCase()) {
      throw new Error(`mock-idp: persona '${String(p.sub)}' is not an address on its own door's mock domain`)
    }
    if (typeof p.sub !== 'string' || p.sub === '' || subs.has(p.sub)) {
      throw new Error('mock-idp: persona subjects must be present and unique')
    }
    subs.add(p.sub)
  }
  return {
    doors,
    personas,
    doorOfClient: (clientId) => clients.get(clientId) ?? null,
    personasOfDoor: (door) => personas.filter((p) => p.door === door),
  }
}

/** HMAC-seal a small JSON value. */
export function seal(payload, key) {
  const body = b64url(payload)
  const mac = createHmac('sha256', key).update(body, 'ascii').digest('base64url')
  return `${body}.${mac}`
}

/** Open a sealed value, or `null`. Constant-time on the MAC. */
export function unseal(token, key) {
  if (typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const body = token.slice(0, dot)
  const mac = Buffer.from(token.slice(dot + 1), 'base64url')
  const want = createHmac('sha256', key).update(body, 'ascii').digest()
  if (mac.length !== want.length || !timingSafeEqual(mac, want)) return null
  try {
    const out = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return typeof out === 'object' && out !== null ? out : null
  } catch {
    return null
  }
}

function sameSecret(presented, held) {
  if (typeof presented !== 'string' || typeof held !== 'string' || held === '') return false
  const a = Buffer.from(presented, 'utf8')
  const b = Buffer.from(held, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The issuer is the function URL's own origin, read off the request's
 * `requestContext.domainName` — which AWS sets, not the caller — and never
 * configured, so the deploy needs no second pass to learn its own URL.
 */
export function issuerOf(event) {
  const host = event?.requestContext?.domainName ?? ''
  return `https://${host}`
}

function methodOf(event) {
  return String(event?.requestContext?.http?.method ?? 'GET').toUpperCase()
}

function formOf(event) {
  if (typeof event?.body !== 'string') return new URLSearchParams()
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
  return new URLSearchParams(raw)
}

function queryOf(event) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(event?.queryStringParameters ?? {})) {
    if (typeof v === 'string') q.set(k, v)
  }
  return q
}

/**
 * Authorize parameters, re-validated on BOTH the GET and the POST: the POST is
 * a form the browser submits, so every hidden field in it is attacker-editable
 * and nothing the GET checked may be trusted on the way back.
 */
function authorizeRequest(params, deps) {
  const clientId = params.get('client_id') ?? ''
  const door = deps.catalogue.doorOfClient(clientId)
  if (door === null) return { ok: false, why: 'unknown_client' }
  if (params.get('response_type') !== 'code') return { ok: false, why: 'unsupported_response_type' }
  const redirectUri = params.get('redirect_uri') ?? ''
  if (redirectUri !== deps.allowedRedirectUri) return { ok: false, why: 'redirect_uri_not_allowed' }
  const scope = (params.get('scope') ?? '').split(/\s+/)
  if (!scope.includes('openid')) return { ok: false, why: 'openid_scope_absent' }
  return {
    ok: true,
    door,
    clientId,
    redirectUri,
    state: params.get('state') ?? '',
    nonce: params.get('nonce') ?? '',
    scope: params.get('scope') ?? '',
    loginHint: (params.get('login_hint') ?? '').trim().toLowerCase(),
  }
}

function refusedPage(why) {
  return {
    statusCode: 400,
    headers: HTML_HEADERS,
    body: `<!doctype html><title>Mock sign-in refused</title><p>Refused: ${escapeHtml(why)}.</p>`,
  }
}

/** The persona picker. `login_hint` PRE-SELECTS; it never decides, and never skips the password. */
export function loginPage(req, note, deps) {
  const personas = deps.catalogue.personasOfDoor(req.door)
  const hinted = personas.some((x) => x.email === req.loginHint) ? req.loginHint : personas[0]?.email
  const fields = {
    client_id: req.clientId,
    redirect_uri: req.redirectUri,
    state: req.state,
    nonce: req.nonce,
    scope: req.scope,
    response_type: 'code',
  }
  const hidden = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}">`)
    .join('')
  const options = personas
    .map(
      (x) =>
        `<label><input type="radio" name="persona" value="${escapeHtml(x.email)}"${x.email === hinted ? ' checked' : ''}> ` +
        `<b>${escapeHtml(x.name)}</b> — ${escapeHtml(x.email)} · ${escapeHtml(x.actor)}</label><br>`,
    )
    .join('')
  return {
    statusCode: note === null ? 200 : 401,
    headers: HTML_HEADERS,
    body:
      '<!doctype html><meta charset="utf-8"><title>ReconcileAI staging — MOCK sign-in</title>' +
      '<style>body{font-family:system-ui;max-width:44rem;margin:2rem auto;padding:0 1rem}' +
      '.warn{border:2px solid #b00;padding:.75rem;margin-bottom:1rem}</style>' +
      '<div class="warn" data-mock-door><b>TEST DOOR — STAGING ONLY.</b> These are mock personas on ' +
      `<code>${escapeHtml(deps.catalogue.doors[req.door].domain)}</code>. No real person signs in here.</div>` +
      (note === null ? '' : `<p class="warn" data-mock-refusal>${escapeHtml(note)}</p>`) +
      `<form method="post" action="/authorize">${hidden}<fieldset><legend>Persona</legend>${options}</fieldset>` +
      '<p><label>Mock password <input type="password" name="password" autocomplete="off" required></label></p>' +
      '<p><button type="submit">Sign in as this persona</button></p></form>',
  }
}

export function discovery(issuer) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'email', 'email_verified', 'name'],
  }
}

function headerOf(event, name) {
  const headers = event?.headers ?? {}
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === name) return typeof v === 'string' ? v : undefined
  }
  return undefined
}

function clientCredentials(event, form) {
  const auth = headerOf(event, 'authorization')
  if (typeof auth === 'string' && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8')
    const colon = decoded.indexOf(':')
    if (colon > 0) {
      try {
        return {
          clientId: decodeURIComponent(decoded.slice(0, colon)),
          clientSecret: decodeURIComponent(decoded.slice(colon + 1)),
        }
      } catch {
        return { clientId: '', clientSecret: '' }
      }
    }
  }
  return { clientId: form.get('client_id') ?? '', clientSecret: form.get('client_secret') ?? '' }
}

async function idToken(issuer, persona, clientId, nonce, deps) {
  const now = Math.floor(deps.now() / 1000)
  const jwk = await deps.publicJwk()
  const header = b64url({ alg: 'RS256', typ: 'JWT', kid: jwk.kid })
  const payload = b64url({
    iss: issuer,
    sub: persona.sub,
    aud: clientId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    ...(nonce ? { nonce } : {}),
    email: persona.email,
    email_verified: true,
    name: persona.name,
  })
  const signature = await deps.signRs256(Buffer.from(`${header}.${payload}`, 'ascii'))
  return `${header}.${payload}.${signature}`
}

/**
 * The whole IdP. `deps` is the only way out of this function:
 * `{ catalogue, now, allowedRedirectUri, password(), clientSecret(), publicJwk(), signRs256(bytes), log(line) }`.
 */
export async function handle(event, deps) {
  const method = methodOf(event)
  const path = String(event?.rawPath ?? '/')
  const issuer = issuerOf(event)

  if (method === 'GET' && path === '/.well-known/openid-configuration') {
    return json(200, discovery(issuer))
  }
  if (method === 'GET' && path === '/jwks') {
    return json(200, { keys: [await deps.publicJwk()] })
  }
  if (path === '/authorize' && (method === 'GET' || method === 'POST')) {
    const params = method === 'GET' ? queryOf(event) : formOf(event)
    const req = authorizeRequest(params, deps)
    if (!req.ok) {
      deps.log({ event: 'mock_authorize_refused', refusal: req.why })
      return refusedPage(req.why)
    }
    if (method === 'GET') return loginPage(req, null, deps)

    const held = await deps.password()
    if (held === '') {
      deps.log({ event: 'mock_sign_in_refused', refusal: 'password_not_set', door: req.door })
      return loginPage(req, 'The mock password has not been set on this stack. A person must put it first.', deps)
    }
    const chosen = (params.get('persona') ?? '').trim().toLowerCase()
    const persona = deps.catalogue.personasOfDoor(req.door).find((x) => x.email === chosen)
    if (persona === undefined) {
      deps.log({ event: 'mock_sign_in_refused', refusal: 'persona_not_on_this_door', door: req.door })
      return loginPage(req, 'That persona is not on this door.', deps)
    }
    if (!sameSecret(params.get('password') ?? '', held)) {
      deps.log({ event: 'mock_sign_in_refused', refusal: 'password_mismatch', door: req.door })
      return loginPage(req, 'Wrong mock password.', deps)
    }
    const key = await deps.clientSecret()
    const code = seal(
      {
        k: 'code',
        sub: persona.sub,
        cid: req.clientId,
        ru: req.redirectUri,
        n: req.nonce,
        exp: Math.floor(deps.now() / 1000) + CODE_TTL_SECONDS,
      },
      key,
    )
    /* FENCE 5 (G3002) — ONE LINE PER SIGN-IN, naming the persona and the door. */
    deps.log({ event: 'mock_sign_in', persona: persona.sub, door: req.door })
    const back = new URL(req.redirectUri)
    back.searchParams.set('code', code)
    if (req.state !== '') back.searchParams.set('state', req.state)
    return handoffPage(back.toString())
  }
  if (method === 'POST' && path === '/token') {
    const form = formOf(event)
    const { clientId, clientSecret } = clientCredentials(event, form)
    const key = await deps.clientSecret()
    if (deps.catalogue.doorOfClient(clientId) === null || !sameSecret(clientSecret, key)) {
      deps.log({ event: 'mock_token_refused', refusal: 'invalid_client' })
      return json(401, { error: 'invalid_client' })
    }
    if (form.get('grant_type') !== 'authorization_code') return json(400, { error: 'unsupported_grant_type' })
    const code = unseal(form.get('code') ?? '', key)
    const now = Math.floor(deps.now() / 1000)
    if (
      code === null ||
      code.k !== 'code' ||
      code.cid !== clientId ||
      code.ru !== (form.get('redirect_uri') ?? '') ||
      typeof code.exp !== 'number' ||
      code.exp < now
    ) {
      deps.log({ event: 'mock_token_refused', refusal: 'invalid_grant' })
      return json(400, { error: 'invalid_grant' })
    }
    const door = deps.catalogue.doorOfClient(clientId)
    const persona = deps.catalogue.personas.find((x) => x.sub === code.sub && x.door === door)
    if (persona === undefined) return json(400, { error: 'invalid_grant' })
    const access = seal({ k: 'access', sub: persona.sub, cid: clientId, exp: now + TOKEN_TTL_SECONDS }, key)
    deps.log({ event: 'mock_token_issued', persona: persona.sub, door })
    return json(200, {
      access_token: access,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
      id_token: await idToken(issuer, persona, clientId, code.n, deps),
    })
  }
  if (method === 'GET' && path === '/userinfo') {
    const auth = headerOf(event, 'authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const access = unseal(token, await deps.clientSecret())
    const now = Math.floor(deps.now() / 1000)
    const persona =
      access !== null && access.k === 'access' && typeof access.exp === 'number' && access.exp >= now
        ? deps.catalogue.personas.find(
            (x) => x.sub === access.sub && x.door === deps.catalogue.doorOfClient(access.cid),
          )
        : undefined
    if (persona === undefined) return json(401, { error: 'invalid_token' })
    return json(200, { sub: persona.sub, email: persona.email, email_verified: true, name: persona.name })
  }
  return json(404, { error: 'not_found' })
}

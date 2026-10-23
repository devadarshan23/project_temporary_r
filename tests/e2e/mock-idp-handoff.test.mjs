/**
 * G3284–G3286 — THE MOCK DOOR'S SIGN-IN, DRIVEN IN A REAL CHROMIUM THROUGH A
 * THREE-HOP REDIRECT CHAIN. This is the test G3283 recorded as missing: the
 * header assertions in `tests/infra/mock-idp-door.test.mjs` prove what the door
 * SAYS, and only a browser can prove what Chrome DOES with it.
 *
 * 🛑 THE FINDING IT EXISTS FOR (staging, 3 Oct 2026): Chrome enforces
 * `form-action` across the ENTIRE redirect chain of a form submission. With
 * G3281's `form-action 'self' <cognito-origin>`, the chain mock 302 → Cognito
 * `idpresponse` 302 → auth relay 303 → tenant `/signin/callback` was refused at
 * the second hop. G3284 answers the POST with a 200 hand-off page whose meta
 * refresh starts a NEW navigation, which `form-action` does not govern.
 *
 * Four local origins (four ports on 127.0.0.1, so four origins) stand in for
 * the door, Cognito, the G2549 relay and the tenant host. The door is the REAL
 * `handle()` from `infra/lambda/mock-idp/idp.mjs`, with an in-memory RSA key in
 * place of KMS — every byte of the page, header and hand-off is production's.
 *
 *   §1  the fixed door: the browser lands on the tenant callback with the code.
 *   §2  RED CONTROL — the same chain with G3281's shape (302 + form-action
 *       'self' + Cognito's origin) never reaches the callback. Without this arm
 *       §1 could pass in a harness that enforces nothing (§5.6).
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createSign, generateKeyPairSync } from 'node:crypto'

import { handle, parseCatalogue } from '../../infra/lambda/mock-idp/idp.mjs'
import { MOCK_DOORS, MOCK_PERSONAS } from '../../infra/lib/mock-personas.ts'
import { browserRequiredUnderCi } from '../reachability.ts'
import { browserSkip, closeBrowser } from '../design/render.ts'

const browserWhy = await browserSkip()
browserRequiredUnderCi('the mock door hand-off suite', browserWhy)
after(async () => {
  await closeBrowser()
})

const PASSWORD = 'correct horse battery staple, mock'
const customer = MOCK_DOORS.customer
const admin = MOCK_PERSONAS.find((p) => p.sub === 'mock-cust-admin')
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })

function catalogueJson() {
  return JSON.stringify({
    doors: Object.fromEntries(Object.entries(MOCK_DOORS).map(([k, d]) => [k, { clientId: d.clientId, domain: d.domain }])),
    personas: MOCK_PERSONAS.map((p) => ({ sub: p.sub, door: p.door, email: p.email, name: p.name, actor: p.actor })),
  })
}

function listen(onRequest) {
  return new Promise((resolve) => {
    const server = createServer(onRequest)
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }))
  })
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

/**
 * The chain. `legacy` reproduces G3281 exactly — the hand-off is turned back
 * into a 302 to the same target, and the login page carries form-action
 * `'self'` plus Cognito's origin — so §2 is the staging failure, not a guess.
 */
async function startChain({ legacy }) {
  const hits = { callback: [], cognito: 0, relay: 0 }
  const tenant = await listen((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (url.pathname !== '/signin/callback') return res.writeHead(404).end()
    hits.callback.push(url.searchParams.get('code'))
    res.writeHead(200, { 'content-type': 'text/html' }).end('<p id="landed">signed in</p>')
  })
  const relay = await listen((req, res) => {
    hits.relay++
    const code = new URL(req.url, 'http://x').searchParams.get('code') ?? ''
    res.writeHead(303, { location: `${tenant.origin}/signin/callback?code=${encodeURIComponent(code)}` }).end()
  })
  const cognito = await listen((req, res) => {
    hits.cognito++
    const code = new URL(req.url, 'http://x').searchParams.get('code') ?? ''
    res.writeHead(302, { location: `${relay.origin}/session/signin/return?code=${encodeURIComponent(code)}` }).end()
  })
  const redirectUri = `${cognito.origin}/oauth2/idpresponse`
  const deps = {
    catalogue: parseCatalogue(catalogueJson()),
    now: () => Date.now(),
    allowedRedirectUri: redirectUri,
    log: () => {},
    password: async () => PASSWORD,
    clientSecret: async () => 'e2e-client-secret',
    publicJwk: async () => ({ ...publicKey.export({ format: 'jwk' }), kid: 'e2e', alg: 'RS256', use: 'sig' }),
    signRs256: async (bytes) => createSign('RSA-SHA256').update(bytes).sign(privateKey).toString('base64url'),
  }
  const door = await listen(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const event = {
      rawPath: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: await readBody(req),
      isBase64Encoded: false,
      headers: req.headers,
      requestContext: { domainName: req.headers.host, http: { method: req.method } },
    }
    let out = await handle(event, deps)
    if (legacy) {
      const csp = out.headers?.['content-security-policy']
      if (csp) out = { ...out, headers: { ...out.headers, 'content-security-policy': csp.replace("form-action 'self'", `form-action 'self' ${cognito.origin}`) } }
      const meta = /content="0;url=([^"]*)"/.exec(out.body ?? '')
      if (out.statusCode === 200 && meta) {
        const target = meta[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        out = { statusCode: 302, headers: { location: target, 'cache-control': 'no-store' }, body: '' }
      }
    }
    res.writeHead(out.statusCode, out.headers ?? {}).end(out.body ?? '')
  })
  const authorize = new URL(`${door.origin}/authorize`)
  for (const [k, v] of Object.entries({
    client_id: customer.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'e2e-state',
    nonce: 'e2e-nonce',
    login_hint: admin.email,
  })) authorize.searchParams.set(k, v)
  const servers = [tenant, relay, cognito, door].map((x) => x.server)
  return {
    hits,
    tenantOrigin: tenant.origin,
    authorize: authorize.toString(),
    close: () => Promise.all(servers.map((s) => new Promise((r) => s.close(() => r())))),
  }
}

describe('the mock door hand-off, in a real chromium', { skip: browserWhy }, () => {
  let br
  before(async () => {
    const pw = await import('playwright')
    br = await pw.chromium.launch()
  })
  after(async () => {
    await br?.close()
  })

  async function submit(chain) {
    const ctx = await br.newContext()
    const page = await ctx.newPage()
    const cspViolations = []
    page.on('console', (m) => {
      if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text())
    })
    await page.goto(chain.authorize)
    await page.fill('input[name="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    return { ctx, page, cspViolations }
  }

  it('§1 · the fixed door: the browser completes all three hops and lands on the tenant callback', async () => {
    const chain = await startChain({ legacy: false })
    try {
      const { ctx, page, cspViolations } = await submit(chain)
      await page.waitForURL(`${chain.tenantOrigin}/signin/callback**`, { timeout: 10_000 })
      assert.equal(await page.textContent('#landed'), 'signed in')
      assert.equal(chain.hits.cognito, 1)
      assert.equal(chain.hits.relay, 1)
      assert.equal(chain.hits.callback.length, 1)
      assert.ok(chain.hits.callback[0], 'the code reached the tenant host')
      assert.deepEqual(cspViolations, [])
      await ctx.close()
    } finally {
      await chain.close()
    }
  })

  it('§2 · RED CONTROL — G3281’s 302 with form-action self + Cognito never reaches the callback', async () => {
    const chain = await startChain({ legacy: true })
    try {
      const { ctx, page, cspViolations } = await submit(chain)
      await page.waitForTimeout(2_000)
      assert.equal(chain.hits.callback.length, 0, 'the harness enforced nothing — §1 would prove nothing')
      assert.ok(!page.url().startsWith(chain.tenantOrigin))
      assert.ok(cspViolations.some((t) => /form-action/.test(t)), `no form-action violation logged: ${cspViolations.join(' | ')}`)
      await ctx.close()
    } finally {
      await chain.close()
    }
  })
})

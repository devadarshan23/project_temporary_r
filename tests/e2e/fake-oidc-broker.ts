/**
 * A LOCAL OIDC BROKER, FOR THE GATE — W3/S7, 1 Oct 2026, G2500.
 *
 * 🛑 IT IS NOT A MOCK OF THE PLANE'S SIDE OF ANYTHING. The plane under test
 * reaches it through the REAL transport (`tokenEndpointTransport()`, G2443),
 * verifies what it issues with the REAL verifier (`verifyIdentityToken()`,
 * RS256 against a JWKS the broker publishes), and binds the REAL nonce. What
 * this file fakes is the one thing the gate cannot have: somebody else's
 * directory. G108's determinism condition forbids the gate reaching the
 * internet, so the directory runs on `127.0.0.1` for the life of one suite.
 *
 * WHAT IT DOES, AND EACH IS A CHECK A REAL BROKER MAKES:
 *
 *   `GET  /authorize`  issues a ONE-USE code bound to the `redirect_uri`, the
 *                      `nonce`, the PKCE `code_challenge` (S256 only) and a
 *                      subject, and 302s the browser to `redirect_uri` with
 *                      `code` and `state`.
 *   `POST /token`      RFC 6749 §4.1.3 + RFC 7636 §4.6: `grant_type`,
 *                      `client_id`, the SAME `redirect_uri`, the code's PKCE
 *                      verifier, and the code used ONCE. Answers an RS256 ID
 *                      token, or `400 {"error":"invalid_grant"}`.
 *
 * ⚠️ ONE DEPARTURE FROM A REAL BROKER, NAMED RATHER THAN HIDDEN: the gate
 * has no TLS, and `signInCallbackUrl()` hard-codes `https` (and must — the
 * broker compares `redirect_uri` byte-for-byte). So when `browserOrigin` is
 * set, `/authorize` sends the BROWSER to that `http://` origin's callback path
 * while still binding the code to the `https://` `redirect_uri` it was given —
 * which is the value the plane presents at `/token` and the one compared.
 * A real broker would 302 to the `https://` URL; nothing else differs.
 *
 * ⚠️ WHO SIGNS IN AT `/authorize`: a real broker shows the person its own
 * sign-in page. This one takes `login_hint` (and `display_name`) when the
 * URL carries them — the shape §24a used before the begin operation existed
 * — and otherwise the identity the suite set with `signsInAs()`. The plane's
 * own authorize URL (`beginFederatedSignIn`, G2541) carries neither, which is
 * correct: the plane must not name the person it is about to learn about.
 *
 * ⚠️ AND ITS MISBEHAVIOURS ARE OPT-IN, PER CODE, so a suite can mint a token
 * with the WRONG issuer or the WRONG nonce and watch the plane refuse it —
 * the reds the S6/S7 witnesses are made of.
 */

import { createHash, createSign, generateKeyPairSync, randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import type { JsonWebKeyEntry, JwksDocument } from '../../server/data-plane/token-verify.ts'

export interface CodeGrant {
  readonly redirectUri: string
  readonly nonce: string
  readonly codeChallenge: string
  readonly subject: string
  /**
   * G2764 — the provider the broker states it authenticated through, in the
   * `identities` claim, exactly as Cognito does; `null` writes no claim. The
   * plane refuses a token whose provider is not the pinned door's
   * `broker_ref`, so a suite must say which directory it is impersonating.
   */
  readonly provider: string | null
  readonly claims?: Readonly<Record<string, unknown>>
  /** Misbehaviours: sign a token whose `iss` / `nonce` is not the right one. */
  readonly issuerOverride?: string
  readonly nonceOverride?: string
}

export interface FakeBroker {
  /** The broker's `iss`. A door's `broker_issuer` must equal this to sign in. */
  readonly issuer: string
  readonly audience: string
  readonly tokenEndpoint: string
  readonly authorizeEndpoint: string
  readonly jwks: JwksDocument
  /**
   * Where this broker PUBLISHES `jwks` — G2571. A door's `jwks_uri` is set to
   * this so a suite can drive the real boot-time inventory load against it.
   */
  readonly jwksUri: string
  /** How many times `/token` was CALLED — a refusal that egressed is visible here. */
  tokenCalls(): number
  /** Register a code directly, for suites that drive the plane without a browser. */
  mintCode(grant: CodeGrant): string
  /** Who `/authorize` authenticates when the URL carries no `login_hint`. */
  signsInAs(identity: { subject: string; email: string; name: string }): void
  /** The last `/authorize` query the broker received — the plane's URL, as a browser presented it. */
  lastAuthorize(): URLSearchParams | null
  /** Called inside every `/token` request before it answers — a suite's probe. */
  onToken(probe: (() => Promise<void>) | null): void
  close(): Promise<void>
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier, 'ascii').digest('base64url')
  return { verifier, challenge }
}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

async function formOf(req: IncomingMessage): Promise<URLSearchParams> {
  let body = ''
  for await (const chunk of req) body += (chunk as Buffer).toString('utf8')
  return new URLSearchParams(body)
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

export async function startFakeBroker(opts: {
  audience: string
  /** See the header's one departure. */
  browserOrigin?: string
  /** G3007 — send the browser back over `http` to the host the plane named. */
  downgradeToHttp?: boolean
}): Promise<FakeBroker> {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = publicKey.export({ format: 'jwk' })
  const key: JsonWebKeyEntry = {
    kty: 'RSA',
    kid: `fake-broker-${randomBytes(4).toString('hex')}`,
    use: 'sig',
    alg: 'RS256',
    n: typeof jwk.n === 'string' ? jwk.n : '',
    e: typeof jwk.e === 'string' ? jwk.e : '',
  }
  const codes = new Map<string, CodeGrant>()
  let calls = 0
  let probe: (() => Promise<void>) | null = null
  let issuer = ''
  let identity = { subject: 'subject-unknown', email: 'nobody', name: 'Nobody' }
  let lastQuery: URLSearchParams | null = null

  function sign(grant: CodeGrant): string {
    const now = Math.floor(Date.now() / 1000)
    const header = b64url({ alg: 'RS256', kid: key.kid, typ: 'JWT' })
    const payload = b64url({
      iss: grant.issuerOverride ?? issuer,
      aud: opts.audience,
      sub: grant.subject,
      iat: now,
      exp: now + 300,
      nonce: grant.nonceOverride ?? grant.nonce,
      ...(grant.provider === null
        ? {}
        : { identities: [{ providerName: grant.provider, providerType: 'OIDC', primary: 'true' }] }),
      ...(grant.claims ?? {}),
    })
    const signature = createSign('RSA-SHA256')
      .update(`${header}.${payload}`, 'ascii')
      .sign(privateKey)
      .toString('base64url')
    return `${header}.${payload}.${signature}`
  }

  function mintCode(grant: CodeGrant): string {
    const code = randomBytes(18).toString('base64url')
    codes.set(code, grant)
    return code
  }

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://broker.invalid')
      if (req.method === 'GET' && url.pathname === '/authorize') {
        const q = url.searchParams
        lastQuery = new URLSearchParams(q)
        if (q.get('code_challenge_method') !== 'S256' || q.get('client_id') !== opts.audience) {
          return json(res, 400, { error: 'invalid_request' })
        }
        const redirectUri = q.get('redirect_uri') ?? ''
        const code = mintCode({
          redirectUri,
          nonce: q.get('nonce') ?? '',
          codeChallenge: q.get('code_challenge') ?? '',
          subject: q.get('login_hint') ?? identity.subject,
          /* Cognito's own behaviour: the provider the URL named is the one it used. */
          provider: q.get('identity_provider'),
          claims: {
            email: q.get('login_hint') ?? identity.email,
            name: q.get('display_name') ?? identity.name,
          },
        })
        const back = new URL(redirectUri)
        /* G3007 — `downgradeToHttp`: the plane builds an `https` callback for
           EVERY host (`code-exchange.ts` hard-codes it, rightly), and a suite
           serving SEVERAL hosts over loopback cannot pin one `browserOrigin`.
           Only the SCHEME changes; the host the plane named is kept. */
        if (opts.downgradeToHttp === true) back.protocol = 'http:'
        const target =
          opts.browserOrigin === undefined
            ? back
            : new URL(back.pathname, opts.browserOrigin)
        target.searchParams.set('code', code)
        target.searchParams.set('state', q.get('state') ?? '')
        res.writeHead(302, { location: target.toString() })
        return res.end()
      }
      if (req.method === 'GET' && url.pathname === '/.well-known/jwks.json') {
        return json(res, 200, { keys: [key] })
      }
      if (req.method === 'POST' && url.pathname === '/oauth2/token') {
        calls += 1
        if (probe !== null) await probe()
        const form = await formOf(req)
        const code = form.get('code') ?? ''
        const grant = codes.get(code)
        codes.delete(code)
        const verifier = form.get('code_verifier') ?? ''
        const ok =
          grant !== undefined &&
          form.get('grant_type') === 'authorization_code' &&
          form.get('client_id') === opts.audience &&
          form.get('redirect_uri') === grant.redirectUri &&
          createHash('sha256').update(verifier, 'ascii').digest('base64url') ===
            grant.codeChallenge
        if (!ok || grant === undefined) return json(res, 400, { error: 'invalid_grant' })
        return json(res, 200, {
          id_token: sign(grant),
          access_token: randomBytes(16).toString('base64url'),
          token_type: 'Bearer',
          expires_in: 300,
        })
      }
      json(res, 404, { error: 'not_found' })
    })().catch(() => {
      if (!res.headersSent) json(res, 500, { error: 'server_error' })
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fake broker bound no port')
  const origin = `http://127.0.0.1:${address.port}`
  issuer = `${origin}/pool`

  return {
    issuer,
    audience: opts.audience,
    tokenEndpoint: `${origin}/oauth2/token`,
    authorizeEndpoint: `${origin}/authorize`,
    jwks: { keys: [key] },
    jwksUri: `${origin}/.well-known/jwks.json`,
    tokenCalls: () => calls,
    mintCode,
    signsInAs: (next) => {
      identity = next
    },
    lastAuthorize: () => lastQuery,
    onToken: (p) => {
      probe = p
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

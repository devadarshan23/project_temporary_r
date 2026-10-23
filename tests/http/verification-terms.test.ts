/**
 * THE VERIFICATION TERMS RESOLVER, DRIVEN AGAINST A REAL SERVER — W3/S4, R2,
 * G2131–G2141, 25 Sep 2026.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ EVERY REQUEST IN THIS FILE GOES TO A `node:http` SERVER THIS FILE STARTED  │
 * │ ON 127.0.0.1, AND NOTHING REACHES THE PUBLIC INTERNET. The transport is    │
 * │ the REAL one — `jwks-source.ts`, through the real dynamic import — because │
 * │ a stub would prove the shape of a function and not the behaviour of a      │
 * │ boot.                                                                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE LOOPBACK SERVER IS WHY THIS IS IN THE GATE AT ALL. G108's condition on
 * a gate stage is that it be deterministic and offline; `tests/e2e/probe-staging.mjs`
 * is excluded *"because it reaches the public internet"* and is deliberately
 * not named `*.test.mjs`. A server this process starts, binds to `127.0.0.1:0`
 * and closes is neither slow nor shared nor reachable from anywhere, and it is
 * the only way to witness `jwks_status_not_ok` against a real status line
 * rather than against a fake.
 *
 * ⚠️ NO DATABASE AND NO BROWSER, so there is no `tests/reachability.ts` guard
 * here and there must not be one.
 *
 * 🛑 §10 IS THE CENSUS: every member of `JWKS_FETCH_REFUSALS` must have been
 * produced by a real server behaving badly. A sixth arm with no test is a red
 * gate — `token-verify.test.ts` §12's shape.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_JWKS_TIMEOUT_MS,
  IDENTITY_TERMS_ENV,
  describeConnectionTermsRefusal,
  identityTolerances,
  loadVerificationTerms,
  pinnedBrokerIssuer,
  verificationTermsAt,
} from '../../server/data-plane/verification-terms.ts'
import type {
  ConnectionKeyTarget,
  ConnectionTermsLoad,
  IdentityTolerances,
  PinnedVerificationTerms,
  VerificationTermsSource,
} from '../../server/data-plane/verification-terms.ts'
import type { IdentityConnectionId } from '../../model/domain.ts'
import { JWKS_FETCH_REFUSALS } from '../../server/data-plane/jwks-source.ts'
import type { JwksFetchRefusal } from '../../server/data-plane/jwks-source.ts'
import {
  SUGGESTED_CLOCK_SKEW_SECONDS,
  verifyIdentityToken,
} from '../../server/data-plane/token-verify.ts'
import type { JsonWebKeyEntry } from '../../server/data-plane/token-verify.ts'

/* ------------------------------------------------------------------ *
 * A keypair this file holds, so the ACCEPT path can be proven
 * ------------------------------------------------------------------ */

const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const AUDIENCE = 'reconcile-tenant-client'
const SUBJECT = 'a4f1e2c0-0000-4000-8000-000000000042'
const NOW = new Date('2026-09-20T12:00:00.000Z')
const NOW_SECONDS = NOW.getTime() / 1000

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const exported = publicKey.export({ format: 'jwk' })
const BROKER_JWK: JsonWebKeyEntry = {
  kty: 'RSA',
  kid: 'broker-key-1',
  use: 'sig',
  alg: 'RS256',
  n: typeof exported.n === 'string' ? exported.n : '',
  e: typeof exported.e === 'string' ? exported.e : '',
}
assert.notEqual(BROKER_JWK.n, '', 'the fixture keypair exported no modulus — the file is vacuous')

function b64url(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return Buffer.from(text, 'utf8').toString('base64url')
}

function goodToken(extra: Record<string, unknown> = {}): string {
  const header = b64url({ alg: 'RS256', kid: BROKER_JWK.kid })
  const payload = b64url({
    iss: ISSUER,
    aud: AUDIENCE,
    sub: SUBJECT,
    exp: NOW_SECONDS + 3600,
    iat: NOW_SECONDS - 10,
    ...extra,
  })
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`, 'ascii')
    .sign(privateKey)
    .toString('base64url')
  return `${header}.${payload}.${signature}`
}

/* ------------------------------------------------------------------ *
 * The loopback broker
 * ------------------------------------------------------------------ */

type Respond = (
  reply: (status: number, body: string, headers?: Record<string, string>) => void,
) => void

/** Start a one-route server on 127.0.0.1 and hand back its URL. Always closed. */
async function withBroker(respond: Respond, run: (url: string) => Promise<void>): Promise<void> {
  const server: Server = createServer((_request, response) => {
    respond((status, body, headers = {}) => {
      response.writeHead(status, { 'content-type': 'application/json', ...headers })
      response.end(body)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${address.port}/.well-known/jwks.json`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

/* D6-5, 1 Oct 2026: the issuer is the PINNED ROW's, not the deployment's, so
 * it no longer appears in `target()` and reaches `verificationTermsAt()` as a
 * `PinnedBrokerIssuer` read off a door. */
const PINNED = pinnedBrokerIssuer({ federation: { brokerIssuer: ISSUER, brokerRef: 'acme-entra' } })
if (PINNED === null) throw new Error('a brokered door produced no pinned issuer — the file is vacuous')

/* G2571, 1 Oct 2026: the key-set URL and the audience are the DOOR's, read
 * off its row at boot. ⚠️ `target()` returned one deployment-wide
 * `IdentityTermsTarget` until then; it now returns the one door this file
 * loads, and the tolerances travel separately because they are not a door's. */
const DOOR_ID = 'idc_vt_door1' as IdentityConnectionId
const TOLERANCES: IdentityTolerances = {
  clockSkewSeconds: SUGGESTED_CLOCK_SKEW_SECONDS,
  jwksTimeoutMs: 2_000,
}

function target(url: string): ConnectionKeyTarget {
  return { connectionId: DOOR_ID, jwksUri: url, audience: AUDIENCE }
}

/** Load ONE door through the real loader and hand back the source and that door's outcome. */
async function loadOne(
  t: ConnectionKeyTarget,
): Promise<{ readonly source: VerificationTermsSource; readonly load: ConnectionTermsLoad }> {
  const source = await loadVerificationTerms(TOLERANCES, [t])
  const load = source.connections.get(t.connectionId)
  assert.ok(load !== undefined, 'the loader dropped a door it was given — the file is vacuous')
  return { source, load }
}

/** The pinned door's terms at an instant; fails the test if the door could not verify. */
function termsAt(source: VerificationTermsSource, now: Date): PinnedVerificationTerms {
  const resolved = verificationTermsAt(source, { connectionId: DOOR_ID, issuer: PINNED as NonNullable<typeof PINNED> }, now)
  assert.equal(resolved.ok, true, 'a loaded door yielded no terms')
  if (!resolved.ok) throw new Error('unreachable')
  return resolved.terms
}

const WITNESSED = new Set<JwksFetchRefusal['kind']>()

async function refusedWith(
  t: ConnectionKeyTarget,
  expected: JwksFetchRefusal['kind'],
  why: string,
): Promise<void> {
  const { load } = await loadOne(t)
  assert.equal(load.ok, false, `${why} — but the load SUCCEEDED`)
  if (load.ok) return
  assert.equal(load.refusal.kind, 'connection_key_document_unavailable', `${why} — wrong door arm`)
  if (load.refusal.kind !== 'connection_key_document_unavailable') return
  assert.equal(load.refusal.jwks.kind, expected, `${why} — wrong arm`)
  WITNESSED.add(load.refusal.jwks.kind)
  /* The message is part of the control: a refusal nobody can act on is a
   * refusal that gets worked around. See §9. ⚠️ G2574: it names the DOOR as
   * well as the URL now, because the boot no longer dies on it. */
  const message = describeConnectionTermsRefusal(t, TOLERANCES.jwksTimeoutMs, load.refusal)
  assert.ok(
    message.includes(t.jwksUri ?? '\u0000') && message.includes(t.connectionId),
    `the boot message for \`${expected}\` does not name the door and the URL that was ` +
      'unreachable, which is the one thing an operator needs in order to act.',
  )
  assert.equal(/REFUSING TO BOOT/.test(message), false, 'a door outage no longer refuses the boot (G2574)')
}

/* ══════════════════════════════════════════════════════════════════ *
 * §0  THE ANTI-VACUITY ARM — the terms this produces VERIFY a token
 * ══════════════════════════════════════════════════════════════════ */

test('§0 · a real key document is loaded ONCE and the terms it yields verify a real token', async () => {
  await withBroker(
    (reply) => reply(200, JSON.stringify({ keys: [BROKER_JWK] })),
    async (url) => {
      const { source, load } = await loadOne(target(url))
      assert.equal(load.ok, true, 'a well-behaved broker did not yield a key document')
      if (!load.ok) return

      assert.equal(load.terms.jwks.keys.length, 1, 'the key set did not survive the load')
      /* ⚠️ THIS ASSERTED `load.source.issuer === ISSUER` UNTIL 1 Oct 2026. A
       * boot-time source carries no issuer now — D6-5 — and asserting the
       * absence is the honest replacement rather than a deleted line. */
      assert.equal('issuer' in source, false, 'the boot-time source carries an issuer again')
      /* G2571: the audience is the DOOR's, off its row. ⚠️ This read
       * `load.source.audience` — one per deployment — until 1 Oct 2026. */
      assert.equal('audience' in source, false, 'the boot-time source carries a deployment audience again')
      assert.equal(load.terms.audience, AUDIENCE)

      /* THE POINT OF THE WHOLE SLICE: `verifyIdentityToken()` took its key
       * document as an ARGUMENT and nothing produced one. This is a produced
       * one, verifying a token signed by the key the server published. */
      const verified = verifyIdentityToken(goodToken(), termsAt(source, NOW))
      assert.equal(
        verified.ok,
        true,
        'the terms produced from a boot-time load did not verify a token signed with the ' +
          'key that document published. Every refusal below would then be meaningless.',
      )
      if (!verified.ok) return
      assert.equal(verified.claims.subject, SUBJECT)
    },
  )
})

test('§0b · and the SEVENTH claim is read: `nonce` reaches the caller (G2141)', async () => {
  await withBroker(
    (reply) => reply(200, JSON.stringify({ keys: [BROKER_JWK] })),
    async (url) => {
      const { source, load } = await loadOne(target(url))
      assert.equal(load.ok, true)
      if (!load.ok) return
      const terms = termsAt(source, NOW)

      const withNonce = verifyIdentityToken(goodToken({ nonce: 'n-0S6_WzA2Mj' }), terms)
      assert.equal(withNonce.ok, true)
      if (!withNonce.ok) return
      assert.equal(
        withNonce.claims.nonce,
        'n-0S6_WzA2Mj',
        'the `nonce` claim did not reach `VerifiedClaims`. D6 §4.3: without it "nothing in ' +
          'this repository can bind an ID token to the sign-in attempt it was issued for", ' +
          'because `challengeDigest` compares two values the SAME caller supplied.',
      )

      const without = verifyIdentityToken(goodToken(), terms)
      assert.equal(without.ok, true, 'a token with no nonce must still VERIFY — see below')
      if (!without.ok) return
      assert.equal(
        without.claims.nonce,
        null,
        'an absent nonce must be `null` here and a REFUSAL at the binding. Refusing it in ' +
          'the verifier would make every legitimately nonce-less token unverifiable and ' +
          'would put a fact about one flow inside a general verifier.',
      )
    },
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §1  WHAT A DEPLOYMENT STATES
 * ══════════════════════════════════════════════════════════════════ */

function withEnv(stated: Record<string, string | undefined>, run: () => void): void {
  /* ⚠️ Two names since 1 Oct 2026 (G2572); the audience and key-set URL are a door's. */
  const names = Object.values(IDENTITY_TERMS_ENV)
  const saved = new Map<string, string | undefined>()
  for (const name of names) {
    saved.set(name, process.env[name])
    delete process.env[name]
  }
  try {
    for (const [name, value] of Object.entries(stated)) {
      if (value !== undefined) process.env[name] = value
    }
    run()
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

/* ⚠️ THIS WAS `§1 · both strings or nothing` UNTIL 1 Oct 2026, AND
 * `§1 · all three strings or nothing` BEFORE THAT. The deployment no longer
 * states an issuer (D6-5), an audience or a key-set URL (G2572): all three are
 * the pinned door's. What a deployment states is two TOLERANCES, and the
 * honest replacement for "both or nothing" is that the retired variables are
 * IGNORED rather than half-honoured. */
test('§1 · the retired variables are ignored — a door’s terms come from its row, never the environment', async () => {
  const saved = new Map<string, string | undefined>()
  for (const name of ['RECONCILE_IDENTITY_AUDIENCE', 'RECONCILE_IDENTITY_JWKS_URL']) {
    saved.set(name, process.env[name])
  }
  process.env['RECONCILE_IDENTITY_AUDIENCE'] = 'an-audience-nobody-wrote-on-a-row'
  process.env['RECONCILE_IDENTITY_JWKS_URL'] = 'http://127.0.0.1:9/jwks.json'
  try {
    assert.equal('audience' in IDENTITY_TERMS_ENV, false)
    assert.equal('jwksUrl' in IDENTITY_TERMS_ENV, false)
    /* A door with neither declared stays undeclared with both variables set:
     * no fallback, and — because nothing is fetchable — no import of the
     * transport either. */
    const source = await loadVerificationTerms(identityTolerances(), [
      { connectionId: DOOR_ID, jwksUri: null, audience: null },
    ])
    const load = source.connections.get(DOOR_ID)
    assert.deepEqual(
      load,
      { ok: false, refusal: { kind: 'connection_jwks_uri_undeclared' } },
      'a deployment-wide key-set URL filled in for a door that declares none. G2572: a value ' +
        'per environment is one pool per environment, the shape D6-5 refused for the issuer.',
    )
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('§1a · a door with a key set and NO audience is refused by name, and nothing is fetched for it', async () => {
  let hits = 0
  await withBroker(
    (reply) => {
      hits += 1
      reply(200, JSON.stringify({ keys: [BROKER_JWK] }))
    },
    async (url) => {
      const { load } = await loadOne({ connectionId: DOOR_ID, jwksUri: url, audience: null })
      assert.deepEqual(load, { ok: false, refusal: { kind: 'connection_audience_undeclared' } })
    },
  )
  assert.equal(hits, 0, 'a key document was fetched for a door that could verify nothing with it')
})

test('§1b · the skew is stated out loud at the call site, using the exported constant', () => {
  withEnv({}, () => {
    const t = identityTolerances()
    assert.equal(
      t.clockSkewSeconds,
      SUGGESTED_CLOCK_SKEW_SECONDS,
      '`token-verify.ts` §1: "A caller that wants sixty seconds says sixty seconds, out ' +
        'loud, at the call site, using this."',
    )
    assert.equal(t.jwksTimeoutMs, DEFAULT_JWKS_TIMEOUT_MS)
  })
})

test('§1c · a stated skew and timeout are taken, and a mistyped one falls back CLOSED', () => {
  withEnv({ [IDENTITY_TERMS_ENV.clockSkewSeconds]: '30' }, () => {
    assert.equal(identityTolerances().clockSkewSeconds, 30)
  })
  withEnv({ [IDENTITY_TERMS_ENV.clockSkewSeconds]: 'a minute' }, () => {
    assert.equal(
      identityTolerances().clockSkewSeconds,
      SUGGESTED_CLOCK_SKEW_SECONDS,
      'a mistyped skew fell through to something permissive. Both numbers here fail CLOSED ' +
        'when wrong — a small skew expires a token early, a small timeout leaves a door ' +
        'unverifiable — which is exactly why a default is safe HERE and refused for a session bound.',
    )
  })
  withEnv({ [IDENTITY_TERMS_ENV.jwksTimeoutMs]: '-5' }, () => {
    assert.equal(identityTolerances().jwksTimeoutMs, DEFAULT_JWKS_TIMEOUT_MS)
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §2–§6  THE FIVE REFUSALS, each against a server behaving badly
 * ══════════════════════════════════════════════════════════════════ */

test('§2 · a broker that is not there marks the DOOR unverifiable (G2574 — it no longer refuses the boot)', async () => {
  /* A port nothing is listening on. Closing a server and then using its URL is
   * the deterministic way to get a connection refusal without a timeout. */
  let deadUrl = ''
  await withBroker(
    (reply) => reply(200, '{}'),
    async (url) => {
      deadUrl = url
    },
  )
  await refusedWith(target(deadUrl), 'jwks_unreachable', 'a broker that is not listening')
})

test('§2b · and so does one that REDIRECTS, because the configured URL is the one we mean', async () => {
  await withBroker(
    (reply) => reply(302, '', { location: 'https://elsewhere.test/jwks.json' }),
    async (url) => {
      await refusedWith(
        target(url),
        'jwks_unreachable',
        'a broker redirecting the key document elsewhere — `redirect: "error"` refuses it, ' +
          'because following one would make the issuer this plane trusts a property of ' +
          'somebody else’s response header',
      )
    },
  )
})

test('§3 · a status outside 200–299 refuses, and the STATUS reaches the operator', async () => {
  await withBroker(
    (reply) => reply(404, JSON.stringify({ message: 'Not Found' })),
    async (url) => {
      const t = target(url)
      const { load } = await loadOne(t)
      assert.equal(load.ok, false)
      if (load.ok) return
      assert.equal(load.refusal.kind, 'connection_key_document_unavailable')
      if (load.refusal.kind !== 'connection_key_document_unavailable') return
      assert.equal(load.refusal.jwks.kind, 'jwks_status_not_ok')
      if (load.refusal.jwks.kind !== 'jwks_status_not_ok') return
      assert.equal(load.refusal.jwks.status, 404)
      WITNESSED.add('jwks_status_not_ok')
      assert.ok(
        describeConnectionTermsRefusal(t, TOLERANCES.jwksTimeoutMs, load.refusal).includes('404'),
        'the boot message did not carry the status. A 404 is a wrong URL and a 403 is a pool ' +
          'policy; folding them would file both under whichever an operator happened to grep.',
      )
    },
  )
})

test('§4 · a 200 that is not JSON refuses, and the BODY is not quoted', async () => {
  const html = '<html><body>Gateway error for tenant acme</body></html>'
  await withBroker(
    (reply) => reply(200, html, { 'content-type': 'text/html' }),
    async (url) => {
      const t = target(url)
      await refusedWith(t, 'jwks_body_unreadable', 'an HTML error page served with a 200')
      const { load } = await loadOne(t)
      if (load.ok) return
      assert.equal(
        describeConnectionTermsRefusal(t, TOLERANCES.jwksTimeoutMs, load.refusal).includes('acme'),
        false,
        'the boot message quoted the response body. G261 §12.1 governs what may reach a log, ' +
          'and a broker’s error page is the one thing in this path we did not write.',
      )
    },
  )
})

test('§5 · a JSON object with no `keys` is not a key set', async () => {
  await withBroker(
    /* The OIDC discovery document is the realistic mistake: it NAMES the key
     * set at `jwks_uri` and is not one. */
    (reply) => reply(200, JSON.stringify({ issuer: ISSUER, jwks_uri: 'https://x.test/jwks' })),
    async (url) => {
      await refusedWith(target(url), 'jwks_not_a_key_set', 'the discovery document, not the keys')
    },
  )
})

test('§6 · an EMPTY key set is refused rather than cached — the §5.6 arm', async () => {
  await withBroker(
    (reply) => reply(200, JSON.stringify({ keys: [] })),
    async (url) => {
      await refusedWith(
        target(url),
        'jwks_key_set_empty',
        'an empty key set verifies NOTHING while looking exactly like a healthy boot',
      )
    },
  )
})

test('§6b · and a key set of only non-objects is empty too, rather than a set of nothings', async () => {
  await withBroker(
    (reply) => reply(200, JSON.stringify({ keys: ['not-a-key', 42, null] })),
    async (url) => {
      await refusedWith(target(url), 'jwks_key_set_empty', 'three members and no keys')
    },
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §7  THE PROJECTION CHANGES NO OUTCOME — it makes the TYPE honest
 * ══════════════════════════════════════════════════════════════════ */

test('§7 · a non-string `n` is dropped, and reaches the SAME arm it always would have', async () => {
  await withBroker(
    (reply) =>
      reply(200, JSON.stringify({ keys: [{ ...BROKER_JWK, n: 12345 }] })),
    async (url) => {
      const { source, load } = await loadOne(target(url))
      assert.equal(load.ok, true, 'a malformed key must not refuse the whole document')
      if (!load.ok) return
      assert.equal(
        load.terms.jwks.keys[0]?.n,
        undefined,
        'a numeric `n` survived into a field typed `string`. The projection exists so the ' +
          'declared types are TRUE of the value rather than asserted over it by a cast.',
      )
      const verified = verifyIdentityToken(goodToken(), termsAt(source, NOW))
      assert.equal(verified.ok, false)
      if (verified.ok) return
      assert.equal(
        verified.refusal.kind,
        'token_key_unusable',
        'the projection changed which arm a malformed key reaches. It must not: ' +
          '`verifyIdentityToken()` answers `token_key_unusable` for an absent `n` and for a ' +
          'non-string one alike, and re-judging keys here would be §5.3.',
      )
    },
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §8  A ROTATION NEEDS A RESTART — structural, not a comment
 * ══════════════════════════════════════════════════════════════════ */

test('§8 · the module exports no way to replace a loaded key document', async () => {
  const module = await import('../../server/data-plane/verification-terms.ts')
  const mutators = Object.keys(module).filter((name) =>
    /refresh|reload|invalidate|reset|clear|set[A-Z]/.test(name),
  )
  assert.deepEqual(
    mutators,
    [],
    'the terms resolver now exports something that looks like a way to replace the cached ' +
      'key document. R2 is "once at boot"; the cache is a VALUE held by the caller precisely ' +
      'so that there is nothing to invalidate, and the first caller of a refresh hook is a ' +
      `request path — which is the runtime egress R2 forbids. Found: [${mutators.join(' | ')}]`,
  )
})

test('§8b · and `verificationTermsAt` reads a clock from nobody — it is handed one', async () => {
  await withBroker(
    (reply) => reply(200, JSON.stringify({ keys: [BROKER_JWK] })),
    async (url) => {
      const { source, load } = await loadOne(target(url))
      assert.equal(load.ok, true)
      if (!load.ok) return
      const early = termsAt(source, new Date('2020-01-01T00:00:00.000Z'))
      assert.equal(early.now.toISOString(), '2020-01-01T00:00:00.000Z')
      const late = termsAt(source, NOW)
      assert.equal(late.now.toISOString(), NOW.toISOString())
      assert.equal(
        early.jwks,
        late.jwks,
        'two reads of one boot-time source produced two key documents. The source IS the ' +
          'cache; copying it per request would be a place for a refresh to hide.',
      )
    },
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §9  THE TRANSPORT IS NOT IN THE REQUEST PATH'S REACH
 * ══════════════════════════════════════════════════════════════════ */

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_PLANE = join(HERE, '..', '..', 'server', 'data-plane')

function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

test('§9 · the resolver itself carries no outbound call — only the module it dynamically imports', () => {
  const code = codeOnly(readFileSync(join(DATA_PLANE, 'verification-terms.ts'), 'utf8'))
  assert.equal(
    /\bfetch\s*\(/.test(code),
    false,
    '`verification-terms.ts` now makes an outbound request directly. The split is the fence: ' +
      'the transport lives in `jwks-source.ts` and is reached ONLY through the dynamic import ' +
      'inside `loadVerificationTerms()`, so a plane with no broker configured never loads it.',
  )
  assert.ok(
    /await import\('\.\/jwks-source\.ts'\)/.test(code),
    'the dynamic import is gone, so the boot-only property now rests on nothing.',
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §10  THE CENSUS. A sixth arm with no test is a RED GATE.
 * ══════════════════════════════════════════════════════════════════ */

test('§10 · every declared key-document refusal was produced by a real server', () => {
  const declared = [...JWKS_FETCH_REFUSALS].sort()
  const witnessed = [...WITNESSED].sort()
  assert.deepEqual(
    witnessed,
    declared,
    'a member of `JWKS_FETCH_REFUSALS` was never produced in this file. Every one of these ' +
      'arms STOPS A DEPLOY, so an arm nothing can produce is a boot failure nobody has seen. ' +
      `Missing: [${declared.filter((d) => !witnessed.includes(d)).join(' | ')}]`,
  )
})

/**
 * PER-CONNECTION KEY DOCUMENTS, DRIVEN AGAINST TWO REAL SERVERS — R2 AS
 * AMENDED, THE OWNER'S RULING OF 1 Oct 2026, G2571–G2576.
 *
 *     "Per-connection, boot-time: fetch every registered connection's JWKS
 *      at boot and cache by connection; audience becomes a column. Still no
 *      runtime JWKS egress; a new connection needs a restart."
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ TWO POOLS, TWO KEY PAIRS, TWO AUDIENCES, TWO `node:http` SERVERS ON         │
 * │ 127.0.0.1 — and the REAL loader, through its real dynamic import of the     │
 * │ transport. Nothing reaches the public internet; G108's determinism          │
 * │ condition holds for the same reason `verification-terms.test.ts` gives.     │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THIS IS THE COMPLEMENT OF `pinned-issuer.test.ts`, AND THE DIFFERENCE IS
 * THE POINT. That file signs BOTH pools' tokens with ONE key so the ISSUER is
 * the only check that can refuse the mix-up (G2234). Here each pool has its
 * OWN key and its OWN audience — which is what G2498 said a second pool could
 * not have — so the KEYS refuse a pool-B token at a door-A sign-in before the
 * issuer comparison is reached, and the AUDIENCE refuses a token minted for
 * another client of the right pool.
 *
 * 🛑 WITNESSED RED BY MUTATION, 1 Oct 2026, before this file was committed:
 * with `verificationTermsAt()` handed the UNION of every loaded door's keys —
 * R2's one-document shape — §2 failed *"a token signed by pool B verified at a
 * door-A sign-in"*; with it handed the LAST loaded door's audience — R2's
 * one-audience shape — §1 and §3b failed. Each mutation was reverted.
 *
 * ⚠️ NO DATABASE AND NO BROWSER, so there is no `tests/reachability.ts` guard
 * here and there must not be one. The database half — the inventory read and
 * its policy — is `tests/db/connection-key-inventory.test.ts`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createSign, generateKeyPairSync, type KeyObject } from 'node:crypto'

import type { IdentityConnectionId } from '../../model/domain.ts'
import {
  CONNECTION_TERMS_REFUSALS,
  describeConnectionTermsRefusal,
  loadVerificationTerms,
  pinnedBrokerIssuer,
  verificationTermsAt,
  type ConnectionKeyTarget,
  type ConnectionTermsRefusal,
  type IdentityTolerances,
  type PinnedVerificationTerms,
  type VerificationTermsSource,
} from '../../server/data-plane/verification-terms.ts'
import {
  SUGGESTED_CLOCK_SKEW_SECONDS,
  verifyIdentityToken,
  type JsonWebKeyEntry,
} from '../../server/data-plane/token-verify.ts'

const NOW = new Date('2026-10-01T12:00:00.000Z')
const NOW_SECONDS = NOW.getTime() / 1000
const TOLERANCES: IdentityTolerances = {
  clockSkewSeconds: SUGGESTED_CLOCK_SKEW_SECONDS,
  jwksTimeoutMs: 2_000,
}

interface Pool {
  readonly door: IdentityConnectionId
  readonly issuer: string
  readonly audience: string
  readonly jwk: JsonWebKeyEntry
  readonly privateKey: KeyObject
}

function pool(name: string, kid: string): Pool {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const exported = publicKey.export({ format: 'jwk' })
  return {
    door: `idc_pcj_${name}` as IdentityConnectionId,
    issuer: `https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOL${name.toUpperCase()}`,
    audience: `reconcile-client-${name}`,
    jwk: {
      kty: 'RSA',
      kid,
      use: 'sig',
      alg: 'RS256',
      n: typeof exported.n === 'string' ? exported.n : '',
      e: typeof exported.e === 'string' ? exported.e : '',
    },
    privateKey,
  }
}

const A = pool('a', 'key-a')
const B = pool('b', 'key-b')
/** Pool B again, publishing under door A's `kid` — a collision a broker never promised to avoid. */
const B_SAME_KID: Pool = { ...B, jwk: { ...B.jwk, kid: 'key-a' } }
assert.notEqual(A.jwk.n, '', 'the fixture keypair exported no modulus — the file is vacuous')

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

/** A token SIGNED by `signer`, carrying whatever claims the test names. */
function token(signer: Pool, claims: { iss: string; aud: string }): string {
  const header = b64url({ alg: 'RS256', kid: signer.jwk.kid })
  const payload = b64url({
    ...claims,
    sub: 'a4f1e2c0-0000-4000-8000-0000000000aa',
    exp: NOW_SECONDS + 3600,
    iat: NOW_SECONDS - 10,
  })
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`, 'ascii')
    .sign(signer.privateKey)
    .toString('base64url')
  return `${header}.${payload}.${signature}`
}

/** One server per pool, each publishing ONLY its own key set. */
async function withBrokers(
  pools: readonly Pool[],
  run: (urls: readonly string[]) => Promise<void>,
): Promise<void> {
  const servers: Server[] = []
  const urls: string[] = []
  for (const p of pools) {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [p.jwk] }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    servers.push(server)
    urls.push(`http://127.0.0.1:${(server.address() as AddressInfo).port}/.well-known/jwks.json`)
  }
  try {
    await run(urls)
  } finally {
    for (const s of servers) await new Promise<void>((resolve) => s.close(() => resolve()))
  }
}

function inventoryFor(pools: readonly Pool[], urls: readonly string[]): ConnectionKeyTarget[] {
  return pools.map((p, i) => ({ connectionId: p.door, jwksUri: urls[i] ?? null, audience: p.audience }))
}

/** The PINNED door's terms — id from the row, issuer through the one constructor. */
function pinnedTerms(source: VerificationTermsSource, p: Pool): PinnedVerificationTerms {
  const issuer = pinnedBrokerIssuer({ federation: { brokerIssuer: p.issuer, brokerRef: 'shared-ref' } })
  if (issuer === null) throw new Error('a brokered door yielded no pinned issuer')
  const resolved = verificationTermsAt(source, { connectionId: p.door, issuer }, NOW)
  assert.equal(resolved.ok, true, `door ${p.door} yielded no terms`)
  if (!resolved.ok) throw new Error('unreachable')
  return resolved.terms
}

const WITNESSED = new Set<ConnectionTermsRefusal['kind']>()

/* ══════════════════════════════════════════════════════════════════ *
 * §1  ANTI-VACUITY — two pools, two doors, each verifies its own token
 * ══════════════════════════════════════════════════════════════════ */

test('§1 · tokens of TWO pools both verify, each against its own door — G2498 closed', async () => {
  await withBrokers([A, B], async (urls) => {
    const source = await loadVerificationTerms(TOLERANCES, inventoryFor([A, B], urls))
    for (const p of [A, B]) {
      const verified = verifyIdentityToken(token(p, { iss: p.issuer, aud: p.audience }), pinnedTerms(source, p))
      assert.equal(
        verified.ok,
        true,
        `door ${p.door}'s own token did not verify against its own boot-time terms. G2498 said ` +
          'a second pool "pins the right issuer and cannot verify"; if this is red, it still cannot, ' +
          `and every refusal below is a fact about a loader that loads nothing: ${JSON.stringify(verified)}`,
      )
    }
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §2  THE KEYS ARE THE PINNED DOOR'S — G2575
 * ══════════════════════════════════════════════════════════════════ */

test('§2 · RED — a pool-B token verified against door A’s keys is refused, EVERY OTHER CLAIM BEING A’s', async () => {
  await withBrokers([A, B], async (urls) => {
    const source = await loadVerificationTerms(TOLERANCES, inventoryFor([A, B], urls))
    /* Signed by B's key, but claiming A's issuer and A's audience — so only the
     * KEY can refuse it. Under R2's single document it would have been refused
     * only because B's key was missing from EVERYTHING, door B included. */
    const forged = token(B, { iss: A.issuer, aud: A.audience })
    const verified = verifyIdentityToken(forged, pinnedTerms(source, A))
    assert.equal(verified.ok, false, 'a token signed by pool B verified at a door-A sign-in')
    if (verified.ok) return
    assert.equal(verified.refusal.kind, 'token_key_not_found')
  })
})

test('§2b · and when pool B publishes under door A’s `kid`, the SIGNATURE refuses it — the kid does not choose the key set', async () => {
  await withBrokers([A, B_SAME_KID], async (urls) => {
    const source = await loadVerificationTerms(TOLERANCES, inventoryFor([A, B_SAME_KID], urls))
    const forged = token(B_SAME_KID, { iss: A.issuer, aud: A.audience })
    const verified = verifyIdentityToken(forged, pinnedTerms(source, A))
    assert.equal(verified.ok, false, 'a kid collision let pool B’s key verify at door A')
    if (verified.ok) return
    assert.equal(verified.refusal.kind, 'token_signature_invalid')
  })
})

test('§2c · the REFUSED alternative — choosing the key set by the token’s own `iss` — ACCEPTS the forgery', async () => {
  /**
   * 🛑 MEASURED, NOT NARRATED. The obvious per-pool shape is a map from issuer
   * to document, looked up by the token's `iss`. Built here by hand: a pool-B
   * token claiming pool B's issuer, at a sign-in PINNED to door A, finds pool
   * B's keys and verifies. `verificationTermsAt()` takes no token and keys on
   * the pinned door's id, so the shape is not expressible through it.
   */
  await withBrokers([A, B], async (urls) => {
    const source = await loadVerificationTerms(TOLERANCES, inventoryFor([A, B], urls))
    const byIssuer = new Map([
      [A.issuer, pinnedTerms(source, A)],
      [B.issuer, pinnedTerms(source, B)],
    ])
    const presented = token(B, { iss: B.issuer, aud: B.audience })
    const iss = JSON.parse(Buffer.from(presented.split('.')[1] ?? '', 'base64url').toString('utf8')).iss
    const chosen = byIssuer.get(iss)
    assert.ok(chosen !== undefined)
    assert.equal(
      verifyIdentityToken(presented, chosen).ok,
      true,
      'the token-selected alternative refused the mix-up, so this no longer measures why it was refused',
    )
    /* And through the real seam, pinned to A, the same token is refused. */
    assert.equal(verifyIdentityToken(presented, pinnedTerms(source, A)).ok, false)
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §3  THE AUDIENCE IS THE PINNED DOOR'S COLUMN — G2571
 * ══════════════════════════════════════════════════════════════════ */

test('§3 · RED — a token from the RIGHT pool minted for ANOTHER client is refused on audience', async () => {
  await withBrokers([A], async (urls) => {
    const source = await loadVerificationTerms(TOLERANCES, inventoryFor([A], urls))
    const otherClient = token(A, { iss: A.issuer, aud: 'some-other-app-in-pool-a' })
    const verified = verifyIdentityToken(otherClient, pinnedTerms(source, A))
    assert.equal(verified.ok, false, 'a token for another application of the same pool was accepted as ours')
    if (verified.ok) return
    assert.equal(verified.refusal.kind, 'token_audience_mismatch')
  })
})

test('§3b · and door B’s audience is not door A’s — a pool-B-client token at door A refuses on audience', async () => {
  /* Signed by A's own key, so the signature holds and the audience is the only check left. */
  await withBrokers([A, B], async (urls) => {
    const source = await loadVerificationTerms(TOLERANCES, inventoryFor([A, B], urls))
    const verified = verifyIdentityToken(
      token(A, { iss: A.issuer, aud: B.audience }),
      pinnedTerms(source, A),
    )
    assert.equal(verified.ok, false)
    if (verified.ok) return
    assert.equal(verified.refusal.kind, 'token_audience_mismatch')
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §4  UNVERIFIABLE DOORS, BY NAME — and the boot survives them (G2574)
 * ══════════════════════════════════════════════════════════════════ */

test('§4 · one unreachable door marks THAT door unverifiable and every other door still loads', async () => {
  let deadUrl = ''
  await withBrokers([B], async (urls) => {
    deadUrl = urls[0] ?? ''
  })
  await withBrokers([A], async (urls) => {
    const source = await loadVerificationTerms(TOLERANCES, [
      { connectionId: A.door, jwksUri: urls[0] ?? null, audience: A.audience },
      { connectionId: B.door, jwksUri: deadUrl, audience: B.audience },
    ])
    assert.equal(source.connections.get(A.door)?.ok, true, 'one door’s outage took a healthy door down with it')
    const dead = source.connections.get(B.door)
    assert.equal(dead?.ok, false)
    if (dead === undefined || dead.ok) return
    assert.equal(dead.refusal.kind, 'connection_key_document_unavailable')
    WITNESSED.add(dead.refusal.kind)
    const message = describeConnectionTermsRefusal(
      { connectionId: B.door, jwksUri: deadUrl, audience: B.audience },
      TOLERANCES.jwksTimeoutMs,
      dead.refusal,
    )
    assert.ok(message.includes(B.door) && message.includes(deadUrl), 'the boot line does not name the door and the URL')
    assert.equal(message.includes(B.audience), false, 'the boot line prints the audience, which nobody acting on it needs')

    /* And a sign-in pinned to it is refused BY NAME — never as a key that was
     * not found, which reads as a rotation (G2133). */
    const issuer = pinnedBrokerIssuer({ federation: { brokerIssuer: B.issuer, brokerRef: 'shared-ref' } })
    if (issuer === null) throw new Error('unreachable')
    const resolved = verificationTermsAt(source, { connectionId: B.door, issuer }, NOW)
    assert.deepEqual(resolved, { ok: false, refusal: dead.refusal })
  })
})

test('§4b · a brokered door with no `jwks_uri`, or no `audience`, is refused by name — never defaulted', async () => {
  const source = await loadVerificationTerms(TOLERANCES, [
    { connectionId: A.door, jwksUri: null, audience: A.audience },
    { connectionId: B.door, jwksUri: 'http://127.0.0.1:9/never-fetched.json', audience: null },
  ])
  const a = source.connections.get(A.door)
  const b = source.connections.get(B.door)
  assert.deepEqual(a, { ok: false, refusal: { kind: 'connection_jwks_uri_undeclared' } })
  assert.deepEqual(b, { ok: false, refusal: { kind: 'connection_audience_undeclared' } })
  WITNESSED.add('connection_jwks_uri_undeclared')
  WITNESSED.add('connection_audience_undeclared')
})

test('§4c · a door the boot never read — "a new connection needs a restart" — is refused by name', async () => {
  const source = await loadVerificationTerms(TOLERANCES, [])
  const issuer = pinnedBrokerIssuer({ federation: { brokerIssuer: A.issuer, brokerRef: 'shared-ref' } })
  if (issuer === null) throw new Error('unreachable')
  const resolved = verificationTermsAt(source, { connectionId: A.door, issuer }, NOW)
  assert.deepEqual(resolved, { ok: false, refusal: { kind: 'connection_not_loaded_at_boot' } })
  WITNESSED.add('connection_not_loaded_at_boot')
  assert.equal(source.connections.size, 0)
})

/* ══════════════════════════════════════════════════════════════════ *
 * §5  THE CENSUS. A fifth arm with no test is a RED GATE.
 * ══════════════════════════════════════════════════════════════════ */

test('§5 · every declared door refusal was produced in this file', () => {
  assert.deepEqual(
    [...WITNESSED].sort(),
    [...CONNECTION_TERMS_REFUSALS].sort(),
    'a member of `CONNECTION_TERMS_REFUSALS` was never produced here — an arm nothing ' +
      'produces is a door that is unverifiable in a way nobody has seen.',
  )
})

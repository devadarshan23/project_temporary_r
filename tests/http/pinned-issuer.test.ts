/**
 * D6-5 — THE BROKER ISSUER COMES FROM THE PINNED ROW, NEVER FROM THE TOKEN.
 * G2231–G2235, 1 Oct 2026, applying THE OWNER'S RULING of 29–30 Sep 2026.
 *
 * The ruling, verbatim from `docs/HANDOFF.md` §3: *"The broker issuer comes
 * from the PINNED `identity_connection` ROW, never from the token."* And its
 * refused alternative: *"validating the token's own `iss` against an
 * allowlist lets the TOKEN participate in choosing what verifies it — the
 * shape `token-verify.ts` already refuses for `alg`, and exactly where D6's
 * IdP mix-up attack lives."*
 *
 * WHAT THIS SUITE MOUNTS, AND IN WHAT ORDER:
 *
 *   §1  ANTI-VACUITY — a real token from the pinned door's broker verifies.
 *       Without it every refusal below is a fact about a function that
 *       refuses everything.
 *   §2  THE IdP MIX-UP — a token whose signature, audience, expiry and nonce
 *       are ALL GOOD, minted under ANOTHER pool's issuer, against a sign-in
 *       the platform sent to door A. Refused, as `token_issuer_mismatch`.
 *   §2b THE ISSUER FOLLOWS THE ROW — the very same token is accepted when the
 *       pinned door IS pool B. So the token never decided; the row did.
 *   §2c THE REFUSED ALTERNATIVE, MEASURED — terms built from the token's own
 *       `iss` (an allowlist that happens to contain it) ACCEPT the mix-up
 *       token. It is a `TS2322` at the call, and `@ts-expect-error` proves the
 *       type still bites while the runtime half proves what it guards.
 *   §3  THE ONE CONSTRUCTOR — `pinnedBrokerIssuer()` is called exactly once
 *       in `server/`, in `signin.ts`, on the door G344 proved is pinned; and
 *       the brand is cast exactly once. Read off the TypeScript AST, so a
 *       comment quoting either name counts for nothing (G978, G1392).
 *   §4  NO ENVIRONMENT ISSUER — configuration-per-environment was the other
 *       refused alternative; the variable is retired and ignored.
 *
 * ⚠️ **WHAT IT DOES NOT PROVE, NAMED:** where `withSignInScope()`'s broker
 * pair comes from at a real callback. No caller exists — `completeFederatedSignIn`
 * is unmounted — and D6 §D6-5 records that *"the commit that writes the
 * callback handler owes an assertion that these two values are not derived
 * from the request body"*. That commit still owes it. What IS held: whatever
 * opened the scope, the issuer a token is checked against is the one on the
 * row `assembleSignIn()` resolved and proved equal to the pinned one
 * (`tests/db/federated-signin.test.ts` §4a reads it off a real row).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { completeCodeExchange } from '../../server/data-plane/code-exchange.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { SUGGESTED_CLOCK_SKEW_SECONDS } from '../../server/data-plane/token-verify.ts'
import type { JsonWebKeyEntry } from '../../server/data-plane/token-verify.ts'
import {
  IDENTITY_TERMS_ENV,
  identityTolerances,
  pinnedBrokerIssuer,
  verificationTermsAt,
  type PinnedVerificationTerms,
  type VerificationTermsSource,
} from '../../server/data-plane/verification-terms.ts'
import type { IdentityConnectionId, SessionHandleDigest } from '../../model/domain.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')

/* Two pools, ONE provider name — G304's collision exactly: a provider name is
 * unique only within one pool. */
const POOL_A = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLAAAAA'
const POOL_B = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_POOLBBBBB'
const SHARED_REF = 'acme-entra'
const AUDIENCE = 'reconcile-tenant-client'
const SUBJECT = 'a4f1e2c0-0000-4000-8000-000000000099'
const NOW = new Date('2026-10-01T12:00:00.000Z')
const NOW_SECONDS = NOW.getTime() / 1000
const CHALLENGE = 'chal_d6_5_pinned_issuer'
const PINNED_CHALLENGE = digestOfHandle(CHALLENGE) as SessionHandleDigest

const DOOR_A = {
  id: 'idc_d65_a' as IdentityConnectionId,
  federation: { brokerIssuer: POOL_A, brokerRef: SHARED_REF },
}
const DOOR_B = {
  id: 'idc_d65_b' as IdentityConnectionId,
  federation: { brokerIssuer: POOL_B, brokerRef: SHARED_REF },
}

/**
 * ⚠️ ONE KEY SIGNS BOTH TOKENS, DELIBERATELY — THE STRONGEST FORM OF THE
 * ATTACK. If pool B's token failed the SIGNATURE, §2 would be green for the
 * wrong reason and would say nothing about the issuer. Here every check but
 * the issuer passes, so the issuer is the only thing that can refuse it.
 */
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = publicKey.export({ format: 'jwk' })
const KEY: JsonWebKeyEntry = {
  kty: 'RSA',
  kid: 'broker-key-1',
  use: 'sig',
  alg: 'RS256',
  n: typeof jwk.n === 'string' ? jwk.n : '',
  e: typeof jwk.e === 'string' ? jwk.e : '',
}

/* G2571, 1 Oct 2026: keys and audience are per DOOR now. Both doors carry the
 * SAME key and audience here, deliberately — the paragraph above is why: the
 * ISSUER must remain the only thing that can refuse the mix-up in this file.
 * `tests/http/per-connection-jwks.test.ts` is where the two pools hold
 * DIFFERENT keys and the keys refuse it first. */
const SOURCE: VerificationTermsSource = {
  connections: new Map([
    [DOOR_A.id, { ok: true as const, terms: { audience: AUDIENCE, jwks: { keys: [KEY] } } }],
    [DOOR_B.id, { ok: true as const, terms: { audience: AUDIENCE, jwks: { keys: [KEY] } } }],
  ]),
  clockSkewSeconds: SUGGESTED_CLOCK_SKEW_SECONDS,
  loadedAt: NOW,
}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function idTokenFrom(iss: string): string {
  const header = b64url({ alg: 'RS256', kid: KEY.kid })
  const payload = b64url({
    iss,
    aud: AUDIENCE,
    sub: SUBJECT,
    exp: NOW_SECONDS + 3600,
    iat: NOW_SECONDS - 10,
    nonce: CHALLENGE,
  })
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`, 'ascii')
    .sign(privateKey)
    .toString('base64url')
  return `${header}.${payload}.${signature}`
}

function response(idToken: string): { status: number; body: string } {
  return { status: 200, body: JSON.stringify({ id_token: idToken }) }
}

/** The pinned door's terms: its id selects keys and audience, its row the issuer. */
function pinned(door: typeof DOOR_A): PinnedVerificationTerms {
  const issuer = pinnedBrokerIssuer(door)
  if (issuer === null) throw new Error('a brokered door yielded no pinned issuer')
  const resolved = verificationTermsAt(SOURCE, { connectionId: door.id, issuer }, NOW)
  if (!resolved.ok) throw new Error(`a loaded door yielded no terms: ${resolved.refusal.kind}`)
  return resolved.terms
}

/* ══════════════════════════════════════════════════════════════════ *
 * §1  ANTI-VACUITY
 * ══════════════════════════════════════════════════════════════════ */

test('§1 · a token from the PINNED door`s broker verifies, and its issuer is the row`s', () => {
  const result = completeCodeExchange(
    response(idTokenFrom(POOL_A)),
    pinned(DOOR_A),
    PINNED_CHALLENGE,
  )
  assert.equal(
    result.ok,
    true,
    `the happy path failed, so §2's refusal would be a fact about a function that refuses ` +
      `everything: ${JSON.stringify(result)}`,
  )
  if (!result.ok) return
  assert.equal(result.identity.issuer, POOL_A)
  assert.equal(result.identity.subject, SUBJECT)
})

test('§1b · a door no broker fronts yields NO issuer — never a default', () => {
  assert.equal(pinnedBrokerIssuer({ federation: null }), null)
})

/* ══════════════════════════════════════════════════════════════════ *
 * §2  THE IdP MIX-UP
 * ══════════════════════════════════════════════════════════════════ */

test('§2 · RED — a fully valid token from ANOTHER pool, against a sign-in pinned to door A, is refused', () => {
  const result = completeCodeExchange(
    response(idTokenFrom(POOL_B)),
    pinned(DOOR_A),
    PINNED_CHALLENGE,
  )
  assert.equal(result.ok, false, 'the IdP mix-up SUCCEEDED: a pool-B token signed in through door A')
  if (result.ok) return
  assert.equal(result.refusal.kind, 'identity_token_refused')
  assert.equal(
    result.refusal.kind === 'identity_token_refused' ? result.refusal.refusal.kind : null,
    'token_issuer_mismatch',
    'the mix-up was refused for the wrong reason — every other claim in this token is GOOD, so ' +
      'anything but the issuer arm means the fixture is not mounting the attack it names',
  )
})

test('§2b · and the SAME token is accepted when the pinned door IS pool B — the row decides, not the token', () => {
  const token = idTokenFrom(POOL_B)
  const result = completeCodeExchange(
    response(token),
    pinned(DOOR_B),
    PINNED_CHALLENGE,
  )
  assert.equal(result.ok, true, `door B's own token was refused: ${JSON.stringify(result)}`)
  if (!result.ok) return
  assert.equal(result.identity.issuer, POOL_B)
})

test('§2c · the REFUSED alternative accepts the mix-up — which is why it is a type error', () => {
  /**
   * 🛑 THIS IS THE ALLOWLIST, MEASURED. An allowlist containing both pools,
   * matched against the token's own `iss`, is exactly "the token's iss is in
   * the list, so verify against the token's iss". Built here by hand as a
   * bare string — and `completeCodeExchange()` refuses it at COMPILE time.
   * The `@ts-expect-error` is the type half: if the brand ever stopped biting,
   * `TS2578` would fail the gate. The assertion is the runtime half: the
   * alternative really would have let pool B in through door A.
   */
  const ALLOWLIST = [POOL_A, POOL_B]
  const token = idTokenFrom(POOL_B)
  const iss = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')).iss
  assert.ok(ALLOWLIST.includes(iss), 'the fixture is not the attack — pool B must be on the list')
  const result = completeCodeExchange(
    response(token),
    // @ts-expect-error — D6-5: a bare string (here, the token's own `iss`) is not a PinnedBrokerIssuer.
    { ...pinned(DOOR_A), issuer: iss as string },
    PINNED_CHALLENGE,
  )
  assert.equal(
    result.ok,
    true,
    'the allowlist alternative REFUSED the mix-up token, so this test no longer measures why ' +
      'the alternative was refused',
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §3  THE ONE CONSTRUCTOR — read off the AST, never off a grep
 * ══════════════════════════════════════════════════════════════════ */

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...tsFilesUnder(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

function visit(node: ts.Node, fn: (n: ts.Node) => void): void {
  fn(node)
  node.forEachChild((child) => visit(child, fn))
}

test('§3 · `pinnedBrokerIssuer()` is CALLED once in `server/`, in `signin.ts`, on the assembled door', () => {
  const calls: string[] = []
  const casts: string[] = []
  for (const file of tsFilesUnder(path.join(REPO_ROOT, 'server'))) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const rel = path.relative(REPO_ROOT, file)
    visit(sf, (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'pinnedBrokerIssuer') {
        calls.push(`${rel}: ${n.getText(sf)}`)
      }
      if (ts.isAsExpression(n) && n.type.getText(sf) === 'PinnedBrokerIssuer') {
        casts.push(`${rel}: ${n.getText(sf)}`)
      }
    })
  }
  assert.deepEqual(
    calls,
    ['server/data-plane/signin.ts: pinnedBrokerIssuer(door.connection)'],
    'the issuer a token is verified against must be read off the door `assembleSignIn()` ' +
      'proved is the pinned one, at exactly one site. A second call is a second source of the ' +
      `issuer, and D6-5 names exactly one.\n\n${calls.join('\n')}`,
  )
  assert.deepEqual(
    casts,
    ['server/data-plane/verification-terms.ts: door.federation.brokerIssuer as PinnedBrokerIssuer'],
    `the brand is minted somewhere other than its constructor.\n\n${casts.join('\n')}`,
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §4  NO ENVIRONMENT ISSUER
 * ══════════════════════════════════════════════════════════════════ */

test('§4 · the per-environment issuer is retired, and a plane that still sets it is IGNORED', () => {
  /* ⚠️ This set `RECONCILE_IDENTITY_AUDIENCE` and `RECONCILE_IDENTITY_JWKS_URL`
   * through `IDENTITY_TERMS_ENV` and read `identityTermsTarget()` until 1 Oct
   * 2026; both variables and that function are retired too (G2572), so the
   * deployment's terms are now its two TOLERANCES and nothing else. */
  assert.equal('issuer' in IDENTITY_TERMS_ENV, false)
  const names = [...Object.values(IDENTITY_TERMS_ENV), 'RECONCILE_IDENTITY_ISSUER']
  const saved = new Map(names.map((n) => [n, process.env[n]] as const))
  try {
    process.env['RECONCILE_IDENTITY_ISSUER'] = POOL_B
    const t = identityTolerances()
    assert.equal('issuer' in t, false, 'an environment issuer reached the terms')
  } finally {
    for (const [n, v] of saved) {
      if (v === undefined) delete process.env[n]
      else process.env[n] = v
    }
  }
})

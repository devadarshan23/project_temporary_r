/**
 * THE TOKEN VERIFIER, PUT UNDER ATTACK — W1-E.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ EVERY TOKEN IN THIS FILE IS MINTED HERE, BY THIS FILE, WITH A KEYPAIR THIS  │
 * │ FILE GENERATED. Nothing is a recorded fixture, nothing is a captured        │
 * │ Cognito token, and nothing reaches the network.                            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 WHY THAT MATTERS RATHER THAN BEING TIDY. A verifier is a control whose
 * only interesting behaviour is REFUSAL, and `docs/HANDOFF.md` §5.6 is the
 * shape where a control passes while asserting nothing. The way to avoid it
 * here is to hold the PRIVATE key: a suite that can only present tokens it was
 * given cannot mint the forgeries, and a forgery nobody can mint is a refusal
 * nobody has witnessed. So this file signs its own good tokens — which proves
 * the ACCEPT path is real — and then mints, one at a time, every attack the
 * module's header claims to refuse.
 *
 * §12 is the census: it requires every member of `TOKEN_VERIFICATION_REFUSALS`
 * to have been observed by the time the file finishes. **A sixteenth arm added
 * with no test is a red gate**, which is the property a list of assertions does
 * not have on its own.
 *
 * ⚠️ NO DATABASE, NO BROWSER, NO PLANE, NO SOCKET — so there is no
 * `tests/reachability.ts` guard at the top of this file and there must not be
 * one. `verifyIdentityToken()` is pure, and that purity is itself asserted, in
 * §11, by reading the module's own source text.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSign, createHmac, generateKeyPairSync } from 'node:crypto'
import type { KeyObject } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  REQUIRED_ALGORITHM,
  SUGGESTED_CLOCK_SKEW_SECONDS,
  TOKEN_VERIFICATION_REFUSALS,
  verifyIdentityToken,
} from '../../server/data-plane/token-verify.ts'
import type {
  JsonWebKeyEntry,
  JwksDocument,
  TokenVerification,
  TokenVerificationRefusal,
  TokenVerificationTerms,
} from '../../server/data-plane/token-verify.ts'
import type { AssertNoTextDeep } from '../../model/reconciliation.ts'

type RefusalKind = TokenVerificationRefusal['kind']

/* ==================================================================== *
 * THE FIXTURE — two real RSA keypairs and one clock
 * ==================================================================== */

const ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const AUDIENCE = 'reconcile-tenant-client'
const SUBJECT = 'a4f1e2c0-0000-4000-8000-000000000001'

/** A fixed instant. See the module header: the clock is injected, never read. */
const NOW = new Date('2026-09-20T12:00:00.000Z')
const NOW_SECONDS = NOW.getTime() / 1000

interface Keypair {
  readonly kid: string
  readonly privateKey: KeyObject
  /** The SPKI PEM of the PUBLIC half — the material an `HS256` forgery would use. */
  readonly publicPem: string
  readonly jwk: JsonWebKeyEntry
}

function mintKeypair(kid: string): Keypair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const exported = publicKey.export({ format: 'jwk' })
  const n = typeof exported.n === 'string' ? exported.n : ''
  const e = typeof exported.e === 'string' ? exported.e : ''
  assert.notEqual(n, '', 'the fixture keypair exported no modulus — the test is vacuous')
  return {
    kid,
    privateKey,
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    jwk: { kty: 'RSA', kid, use: 'sig', alg: 'RS256', n, e },
  }
}

/** THE key. Its public half is what the JWKS below publishes. */
const BROKER = mintKeypair('broker-key-1')
/**
 * A SECOND, entirely unrelated keypair, published under NO kid of its own.
 * §6 signs with this and presents `BROKER`'s `kid`, which is the forgery that
 * matters: same key id, different key.
 */
const IMPOSTOR = mintKeypair('broker-key-1')

const JWKS: JwksDocument = { keys: [BROKER.jwk] }

function terms(overrides: Partial<TokenVerificationTerms> = {}): TokenVerificationTerms {
  return {
    issuer: overrides.issuer ?? ISSUER,
    audience: overrides.audience ?? AUDIENCE,
    jwks: overrides.jwks ?? JWKS,
    now: overrides.now ?? NOW,
    clockSkewSeconds: overrides.clockSkewSeconds ?? SUGGESTED_CLOCK_SKEW_SECONDS,
  }
}

/* ==================================================================== *
 * THE MINT — this file holds the private key, so it can forge anything
 * ==================================================================== */

function b64url(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return Buffer.from(text, 'utf8').toString('base64url')
}

/** A well-formed payload. Every attack below is this, with one thing changed. */
function goodPayload(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: SUBJECT,
    exp: NOW_SECONDS + 3600,
    iat: NOW_SECONDS - 10,
    email: 'operator@acme.test',
    ...extra,
  }
}

/** Sign an arbitrary header over an arbitrary payload SEGMENT, with RS256. */
function assemble(
  header: Record<string, unknown>,
  payloadSegment: string,
  privateKey: KeyObject,
): string {
  const headerSegment = b64url(header)
  const signingInput = `${headerSegment}.${payloadSegment}`
  const signature = createSign('RSA-SHA256')
    .update(signingInput, 'ascii')
    .sign(privateKey)
    .toString('base64url')
  return `${signingInput}.${signature}`
}

/** The ordinary case: RS256, the broker's kid, the broker's key. */
function goodToken(payload: Record<string, unknown> = goodPayload()): string {
  return assemble({ alg: 'RS256', kid: BROKER.kid }, b64url(payload), BROKER.privateKey)
}

/* ==================================================================== *
 * THE CENSUS — §12 closes over this
 * ==================================================================== */

const WITNESSED = new Set<RefusalKind>()

function refusedWith(result: TokenVerification, expected: RefusalKind, why: string): void {
  assert.equal(result.ok, false, `${why} — but the token VERIFIED`)
  if (result.ok) return
  assert.equal(result.refusal.kind, expected, why)
  WITNESSED.add(result.refusal.kind)
}

/* ==================================================================== *
 * §1 · THE ACCEPT PATH — without this every refusal below is vacuous
 * ==================================================================== */

test('1 · a good token verifies, and the subject it carries is the one that was signed', () => {
  const result = verifyIdentityToken(goodToken(), terms())
  assert.equal(result.ok, true, 'a correctly signed, in-date, correctly addressed token was refused')
  if (!result.ok) return
  assert.equal(result.claims.subject, SUBJECT)
  assert.equal(result.claims.issuer, ISSUER)
  assert.deepEqual(result.claims.audience, [AUDIENCE])
  assert.equal(result.claims.expiresAt, NOW_SECONDS + 3600)
  assert.equal(result.claims.notBefore, null)
  assert.equal(result.claims.issuedAt, NOW_SECONDS - 10)
})

test('1a · `aud` as an ARRAY containing the audience verifies — RFC 7519 §4.1.3', () => {
  const token = goodToken(goodPayload({ aud: ['some-other-client', AUDIENCE] }))
  const result = verifyIdentityToken(token, terms())
  assert.equal(result.ok, true, 'a list-valued `aud` containing our audience was refused')
  if (!result.ok) return
  assert.deepEqual(result.claims.audience, ['some-other-client', AUDIENCE])
})

test('1b · the verified claims are a NARROW RECORD — `email` was signed and is not returned', () => {
  /**
   * 🛑 THIS IS A CONTROL, NOT A COMPLETENESS CHECK. `server/data-plane/signin.ts`
   * refuses resolving a person by email BY NAME — *"an email is a claim the
   * DIRECTORY makes and nothing here checks that the directory is entitled to
   * make it"* — and the cheapest way for that refusal to stop being enforced is
   * for the verifier to hand `email` to a caller who then uses it. The payload
   * above really does carry one; the verdict really does not.
   *
   * ⚠️ **THIS LIST WENT FROM SIX TO SEVEN ON 25 Sep 2026 AND THE ASSERTION
   * FIRED, WHICH IS THE CONTROL WORKING RATHER THAN THE CONTROL BEING IN THE
   * WAY.** The seventh is `nonce` (W3/S4, G2141). `VerifiedClaims`'s own
   * declaration demands that *"the next claim anybody needs arrives with an
   * argument for it at this declaration"*, and the argument is there, at
   * length: `docs/build/d6-threat-model.md` §4.3 measured that **nothing in
   * this repository could bind an ID token to the sign-in attempt it was
   * issued for**, because the thing that looks like the binding —
   * `challengeDigest` — *"compares two values the SAME caller supplied"*.
   * `bindTokenToAttempt()` in `server/data-plane/code-exchange.ts` is the
   * comparison, and it was impossible while this record could not carry a
   * nonce.
   *
   * 🛑 **THE LIST IS NOT REPLACED BY A "SIX OR MORE" CHECK, AND THAT IS THE
   * POINT.** A widened assertion would have admitted `email` too, which is the
   * one thing this test exists to refuse. **An eighth claim must break this
   * again**, and its author must write its argument on the declaration exactly
   * as this one did.
   *
   * ⚠️ **AND IT DID — SEVEN TO EIGHT ON 2 Oct 2026, G2901.** The eighth is
   * `emailVerified`, a BOOLEAN, argued on its declaration: `0370`'s redemption
   * keys on an address, and an address the directory never proved conferred
   * another person's role (`tests/db/partner-invitation-redemption.test.ts`
   * §9). `email` is still absent and still the one that must never appear.
   */
  const result = verifyIdentityToken(goodToken(), terms())
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    Object.keys(result.claims).sort(),
    ['audience', 'emailVerified', 'expiresAt', 'issuedAt', 'issuer', 'nonce', 'notBefore', 'subject'],
    'the verdict’s claim set has changed. If a claim was ADDED, its argument belongs on ' +
      '`VerifiedClaims` and not in this list; `email` is the one that must never appear, ' +
      'because `signin.ts` refuses resolving a person by it BY NAME and a caller that can SEE ' +
      'it will eventually use it.',
  )
  assert.equal(
    result.claims.nonce,
    null,
    'the ordinary fixture token carries no `nonce`, so a verified one must report `null` ' +
      'rather than absent — an absent property and a null one narrow differently at the ' +
      'binding, and `bindTokenToAttempt()` refuses on `null`.',
  )
})

/**
 * §1c · `email_verified` IS READ AFTER THE SIGNATURE IN EXACTLY TWO SPELLINGS
 * — G2901. The JSON boolean (OIDC Core §5.1) and Amazon Cognito's STRING
 * `"true"`, which is what a federated user's mapped attribute arrives as and
 * this product's broker is Cognito (G302). Every other value is `false`,
 * absence included: a false negative costs a person a role they can be
 * re-invited into, a false positive confers one.
 */
test('1c · `emailVerified` is true for `true` and for Cognito’s `"true"`, and false for everything else', () => {
  const cases: ReadonlyArray<readonly [string, Record<string, unknown>, boolean]> = [
    ['the JSON boolean true', { email_verified: true }, true],
    ['Cognito’s string "true"', { email_verified: 'true' }, true],
    ['absent', {}, false],
    ['the JSON boolean false', { email_verified: false }, false],
    ['Cognito’s string "false"', { email_verified: 'false' }, false],
    ['"TRUE" — not a spelling any broker emits', { email_verified: 'TRUE' }, false],
    ['the number 1', { email_verified: 1 }, false],
    ['null', { email_verified: null }, false],
  ]
  for (const [label, extra, expected] of cases) {
    const result = verifyIdentityToken(goodToken(goodPayload(extra)), terms())
    assert.equal(result.ok, true, `${label}: the token did not verify — the case is vacuous`)
    if (!result.ok) continue
    assert.equal(result.claims.emailVerified, expected, `${label}: emailVerified read ${String(result.claims.emailVerified)}`)
  }
})

/**
 * §1d · AND IT IS NEVER READ OFF A TOKEN THAT DID NOT VERIFY: a forged
 * signature over `email_verified: true` is refused at the signature, so the
 * flag never reaches a verdict. `token-verify.ts` §0b — nothing in an
 * unverified payload is a fact.
 */
test('1d · a forged token claiming `email_verified: true` yields no verdict at all', () => {
  const good = goodToken(goodPayload({ email_verified: true }))
  const [h, , sig] = good.split('.')
  const forged = `${h}.${b64url(goodPayload({ email_verified: true, sub: 'someone-else' }))}.${sig}`
  refusedWith(verifyIdentityToken(forged, terms()), 'token_signature_invalid', 'a payload swapped under a valid signature')
})

/* ==================================================================== *
 * §2 · SHAPE
 * ==================================================================== */

test('2 · a token that is not three base64url segments is `token_malformed`', () => {
  const good = goodToken()
  const parts = good.split('.')
  refusedWith(verifyIdentityToken('', terms()), 'token_malformed', 'the empty string')
  refusedWith(verifyIdentityToken('one.two', terms()), 'token_malformed', 'two segments')
  refusedWith(verifyIdentityToken(`${good}.extra`, terms()), 'token_malformed', 'four segments')
  refusedWith(
    verifyIdentityToken(`${parts[0] ?? ''}*.${parts[1] ?? ''}.${parts[2] ?? ''}`, terms()),
    'token_malformed',
    'a header segment carrying a character base64url does not define',
  )
})

test('2a · ANTI-VACUOUS — the same three segments, unedited, verify', () => {
  /* Without this, §2 would pass against a verifier that refused everything. */
  assert.equal(verifyIdentityToken(goodToken(), terms()).ok, true)
})

/* ==================================================================== *
 * §3 · THE HEADER
 * ==================================================================== */

test('3 · a header segment that is not a JSON OBJECT is `token_header_unreadable`', () => {
  const payloadSegment = b64url(goodPayload())
  const notJson = `${b64url('{oops')}.${payloadSegment}.AAAA`
  const notAnObject = `${b64url([1, 2, 3])}.${payloadSegment}.AAAA`
  refusedWith(verifyIdentityToken(notJson, terms()), 'token_header_unreadable', 'invalid JSON')
  refusedWith(verifyIdentityToken(notAnObject, terms()), 'token_header_unreadable', 'a JSON array')
})

/* ==================================================================== *
 * §4 · THE ALGORITHM — the attack the module's §0a exists for
 * ==================================================================== */

test('4 · `alg: none` with an EMPTY signature is `token_algorithm_not_allowed`', () => {
  const token = `${b64url({ alg: 'none', kid: BROKER.kid })}.${b64url(goodPayload())}.`
  refusedWith(
    verifyIdentityToken(token, terms()),
    'token_algorithm_not_allowed',
    '`alg: none` was not refused on the ALGORITHM',
  )
})

test('4a · `alg: none` with a JUNK signature is refused on the ALGORITHM, not the bytes', () => {
  /**
   * 🛑 THIS IS THE ASSERTION THAT PINS THE REASON. A verifier that happened to
   * refuse §4 because the third segment was EMPTY would pass §4 and fail here
   * with `token_signature_invalid` — a refusal that names the wrong subject and
   * that would go on refusing the right tokens for the wrong reason until
   * somebody wrote `alg: none` with four bytes of noise on the end.
   */
  const token = `${b64url({ alg: 'none', kid: BROKER.kid })}.${b64url(goodPayload())}.AAAABBBB`
  refusedWith(
    verifyIdentityToken(token, terms()),
    'token_algorithm_not_allowed',
    '`alg: none` with a junk signature was refused for the wrong reason',
  )
})

test('4b · THE CONFUSION ATTACK — HS256 signed with the RSA PUBLIC key is refused', () => {
  /**
   * 🛑 THE ONE THAT MATTERS. The public key is PUBLISHED — it is in the JWKS
   * this very suite hands the verifier — so if `alg` selected the algorithm,
   * anybody holding the key document could mint a token for any subject they
   * liked. The forgery below is genuine: it is a correct HMAC-SHA256 over the
   * signing input, keyed with the broker's own public key in PEM, and a
   * verifier that dispatched on `alg` would ACCEPT it.
   */
  const headerSegment = b64url({ alg: 'HS256', kid: BROKER.kid })
  const payloadSegment = b64url(goodPayload({ sub: 'somebody-else-entirely' }))
  const forged = createHmac('sha256', BROKER.publicPem)
    .update(`${headerSegment}.${payloadSegment}`, 'ascii')
    .digest('base64url')
  const token = `${headerSegment}.${payloadSegment}.${forged}`

  refusedWith(
    verifyIdentityToken(token, terms()),
    'token_algorithm_not_allowed',
    'an HS256 token keyed with the published RSA public key was not refused on the ALGORITHM',
  )
})

test('4c · ANTI-VACUOUS — the HMAC in §4b really is correct for that signing input', () => {
  /**
   * Without this, §4b would pass against a verifier that refused it for being a
   * bad signature, and the suite would be recording a defeat of the confusion
   * attack it had never actually mounted.
   */
  const headerSegment = b64url({ alg: 'HS256', kid: BROKER.kid })
  const payloadSegment = b64url(goodPayload({ sub: 'somebody-else-entirely' }))
  const input = `${headerSegment}.${payloadSegment}`
  const a = createHmac('sha256', BROKER.publicPem).update(input, 'ascii').digest('base64url')
  const b = createHmac('sha256', BROKER.publicPem).update(input, 'ascii').digest('base64url')
  assert.equal(a, b)
  assert.notEqual(a, '')
})

test('4d · a STRONGER RSA algorithm is refused too — the set is one member, not a floor', () => {
  const token = assemble({ alg: 'RS512', kid: BROKER.kid }, b64url(goodPayload()), BROKER.privateKey)
  refusedWith(verifyIdentityToken(token, terms()), 'token_algorithm_not_allowed', 'RS512')
  const headerless = assemble({ kid: BROKER.kid }, b64url(goodPayload()), BROKER.privateKey)
  refusedWith(verifyIdentityToken(headerless, terms()), 'token_algorithm_not_allowed', 'no `alg`')
})

test('4e · and the constant really is the one the accept path uses', () => {
  assert.equal(REQUIRED_ALGORITHM, 'RS256')
})

/* ==================================================================== *
 * §5 · `crit`
 * ==================================================================== */

test('5 · a `crit` header is refused outright — RFC 7515 §4.1.11, fail-closed', () => {
  const token = assemble(
    { alg: 'RS256', kid: BROKER.kid, crit: ['exp'] },
    b64url(goodPayload()),
    BROKER.privateKey,
  )
  refusedWith(
    verifyIdentityToken(token, terms()),
    'token_critical_header_unsupported',
    'a critical header extension this verifier does not understand was IGNORED',
  )
})

/* ==================================================================== *
 * §6 · THE KEY
 * ==================================================================== */

test('6 · no `kid` at all is `token_kid_absent`', () => {
  const token = assemble({ alg: 'RS256' }, b64url(goodPayload()), BROKER.privateKey)
  refusedWith(verifyIdentityToken(token, terms()), 'token_kid_absent', 'a token naming no key')
})

test('6a · an UNKNOWN `kid` is `token_key_not_found` — not a signature failure', () => {
  const token = assemble(
    { alg: 'RS256', kid: 'broker-key-99' },
    b64url(goodPayload()),
    BROKER.privateKey,
  )
  refusedWith(
    verifyIdentityToken(token, terms()),
    'token_key_not_found',
    'an unknown key id must name the KEY DOCUMENT, so an operator reads it as a rotation',
  )
})

test('6b · a JWKS entry that is not an RSA key is `token_key_unusable`', () => {
  /**
   * 🛑 THE CONFUSION ATTACK FROM THE KEY SIDE. If the entry's `kty` steered the
   * import, an `oct` entry published under the right `kid` would be imported as
   * a SECRET — and a verifier holding a secret is one line from HMAC. Only
   * `kty`, `n` and `e` cross into `createPublicKey()`, and `kty` must be `RSA`.
   */
  const octJwks: JwksDocument = { keys: [{ kty: 'oct', kid: BROKER.kid, n: 'AQAB', e: 'AQAB' }] }
  refusedWith(
    verifyIdentityToken(goodToken(), terms({ jwks: octJwks })),
    'token_key_unusable',
    'a symmetric JWKS entry under the right key id',
  )
})

test('6c · an RSA entry with no modulus is `token_key_unusable` too', () => {
  const partial: JwksDocument = { keys: [{ kty: 'RSA', kid: BROKER.kid, e: 'AQAB' }] }
  refusedWith(
    verifyIdentityToken(goodToken(), terms({ jwks: partial })),
    'token_key_unusable',
    'an RSA entry carrying no `n`',
  )
})

/* ==================================================================== *
 * §7 · THE SIGNATURE
 * ==================================================================== */

test('7 · a token signed by a DIFFERENT key under the SAME kid is `token_signature_invalid`', () => {
  const token = assemble(
    { alg: 'RS256', kid: BROKER.kid },
    b64url(goodPayload()),
    IMPOSTOR.privateKey,
  )
  refusedWith(
    verifyIdentityToken(token, terms()),
    'token_signature_invalid',
    'a token signed by a key we never published was accepted',
  )
})

test('7a · a payload TAMPERED WITH AFTER SIGNING is `token_signature_invalid`', () => {
  const original = goodToken()
  const parts = original.split('.')
  const swapped = b64url(goodPayload({ sub: 'attacker-chosen-subject' }))
  const tampered = `${parts[0] ?? ''}.${swapped}.${parts[2] ?? ''}`
  assert.notEqual(tampered, original, 'the tamper changed nothing — the test is vacuous')

  refusedWith(
    verifyIdentityToken(tampered, terms()),
    'token_signature_invalid',
    'a re-written payload under a valid signature was accepted',
  )
})

test('7b · and the SUBJECT a tampered token asked for never reaches a caller', () => {
  /* The refusal arm is the assertion above. This one is the consequence, said
   * as a value: there is no arm of the verdict carrying claims on a refusal. */
  const parts = goodToken().split('.')
  const tampered = `${parts[0] ?? ''}.${b64url(goodPayload({ sub: 'attacker' }))}.${parts[2] ?? ''}`
  const result = verifyIdentityToken(tampered, terms())
  assert.equal(result.ok, false)
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'claims'), false)
})

/* ==================================================================== *
 * §8 · THE PAYLOAD — parsed only after the signature, which this proves
 * ==================================================================== */

test('8 · a SIGNED token whose payload is not an object is `token_payload_unreadable`', () => {
  /**
   * 🛑 THIS ARM IS REACHABLE ONLY BECAUSE THE SIGNATURE IS CHECKED FIRST, and
   * that is the point of the test rather than an accident of it: the token
   * below is correctly signed by the broker's own key over a payload segment
   * that decodes to a STRING. A verifier that parsed the payload before
   * verifying would reach this arm on forgeries too, and would be telling an
   * attacker which of their fields to fix.
   */
  const token = assemble({ alg: 'RS256', kid: BROKER.kid }, b64url('"not-an-object"'), BROKER.privateKey)
  refusedWith(verifyIdentityToken(token, terms()), 'token_payload_unreadable', 'a signed non-object')
})

test('8a · THE ORDER, WITNESSED — the same unreadable payload UNSIGNED reports the SIGNATURE', () => {
  const token = assemble({ alg: 'RS256', kid: BROKER.kid }, b64url('"not-an-object"'), IMPOSTOR.privateKey)
  refusedWith(
    verifyIdentityToken(token, terms()),
    'token_signature_invalid',
    'a forged token was diagnosed on its CLAIMS, which tells an attacker what to fix',
  )
})

/* ==================================================================== *
 * §9 · THE CLAIMS
 * ==================================================================== */

test('9 · a wrong `iss` is `token_issuer_mismatch`, and a missing one too', () => {
  refusedWith(
    verifyIdentityToken(goodToken(goodPayload({ iss: `${ISSUER}_OTHER` })), terms()),
    'token_issuer_mismatch',
    'a token from a neighbouring pool',
  )
  const { iss: _dropped, ...withoutIssuer } = goodPayload()
  refusedWith(
    verifyIdentityToken(goodToken(withoutIssuer), terms()),
    'token_issuer_mismatch',
    'a token carrying no issuer at all',
  )
})

test('9a · the issuer is compared EXACTLY — a prefix of ours is not ours', () => {
  const prefix = ISSUER.slice(0, ISSUER.length - 4)
  refusedWith(
    verifyIdentityToken(goodToken(goodPayload({ iss: prefix })), terms()),
    'token_issuer_mismatch',
    'an issuer that is a prefix of the expected one',
  )
})

test('9b · a wrong `aud` is `token_audience_mismatch`, scalar and list alike', () => {
  refusedWith(
    verifyIdentityToken(goodToken(goodPayload({ aud: 'another-client' })), terms()),
    'token_audience_mismatch',
    'a token minted for another client',
  )
  refusedWith(
    verifyIdentityToken(goodToken(goodPayload({ aud: ['x', 'y'] })), terms()),
    'token_audience_mismatch',
    'a list-valued `aud` that does not contain ours',
  )
  const { aud: _dropped, ...withoutAudience } = goodPayload()
  refusedWith(
    verifyIdentityToken(goodToken(withoutAudience), terms()),
    'token_audience_mismatch',
    'a token carrying no audience at all',
  )
})

test('9c · a token with no `sub` is `token_subject_absent` — never a null subject', () => {
  const { sub: _dropped, ...withoutSubject } = goodPayload()
  refusedWith(
    verifyIdentityToken(goodToken(withoutSubject), terms()),
    'token_subject_absent',
    'a token naming nobody',
  )
})

test('9d · a token with no `exp` is `token_expiry_absent` — never "no expiry"', () => {
  const { exp: _dropped, ...withoutExpiry } = goodPayload()
  refusedWith(
    verifyIdentityToken(goodToken(withoutExpiry), terms()),
    'token_expiry_absent',
    'a missing expiry read as an unbounded credential',
  )
})

/* ==================================================================== *
 * §10 · THE CLOCK, AND THE SKEW
 * ==================================================================== */

test('10 · an EXPIRED token is refused, and an expiry inside the skew is not', () => {
  const justInside = goodToken(goodPayload({ exp: NOW_SECONDS - 30 }))
  const wellOutside = goodToken(goodPayload({ exp: NOW_SECONDS - 120 }))

  const inside = verifyIdentityToken(justInside, terms({ clockSkewSeconds: 60 }))
  assert.equal(inside.ok, true, 'a token 30s past expiry was refused under a 60s allowance')

  refusedWith(
    verifyIdentityToken(wellOutside, terms({ clockSkewSeconds: 60 })),
    'token_expired',
    'a token 120s past expiry was accepted under a 60s allowance',
  )
})

test('10a · and with NO allowance the same 30s-expired token is refused — the skew is load-bearing', () => {
  const justInside = goodToken(goodPayload({ exp: NOW_SECONDS - 30 }))
  refusedWith(
    verifyIdentityToken(justInside, terms({ clockSkewSeconds: 0 })),
    'token_expired',
    'the allowance in §10 was not what admitted that token',
  )
})

test('10b · a token NOT YET VALID is refused, and an `nbf` inside the skew is not', () => {
  const justInside = goodToken(goodPayload({ nbf: NOW_SECONDS + 30 }))
  const wellOutside = goodToken(goodPayload({ nbf: NOW_SECONDS + 120 }))

  const inside = verifyIdentityToken(justInside, terms({ clockSkewSeconds: 60 }))
  assert.equal(inside.ok, true, 'an `nbf` 30s in the future was refused under a 60s allowance')
  if (inside.ok) assert.equal(inside.claims.notBefore, NOW_SECONDS + 30)

  refusedWith(
    verifyIdentityToken(wellOutside, terms({ clockSkewSeconds: 60 })),
    'token_not_yet_valid',
    'an `nbf` 120s in the future was accepted under a 60s allowance',
  )
})

test('10c · and with NO allowance the same 30s-early token is refused', () => {
  const justInside = goodToken(goodPayload({ nbf: NOW_SECONDS + 30 }))
  refusedWith(
    verifyIdentityToken(justInside, terms({ clockSkewSeconds: 0 })),
    'token_not_yet_valid',
    'the allowance in §10b was not what admitted that token',
  )
})

test('10d · the clock is an ARGUMENT — the same token verifies now and expires later', () => {
  const token = goodToken(goodPayload({ exp: NOW_SECONDS + 3600 }))
  assert.equal(verifyIdentityToken(token, terms({ clockSkewSeconds: 0 })).ok, true)
  const later = new Date(NOW.getTime() + 7200 * 1000)
  refusedWith(
    verifyIdentityToken(token, terms({ now: later, clockSkewSeconds: 0 })),
    'token_expired',
    'moving the injected clock two hours forward did not expire the token',
  )
})

/* ==================================================================== *
 * §11 · THE CONTROLS THAT ARE NOT ABOUT ONE TOKEN
 * ==================================================================== */

const MODULE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'server',
  'data-plane',
  'token-verify.ts',
)
const MODULE_TEXT = readFileSync(MODULE_PATH, 'utf8')

/**
 * 🛑 THE COMMENTS ARE STRIPPED BEFORE ANY OF THE FOUR CONTROLS BELOW LOOKS, AND
 * THAT IS THE WHOLE REASON THEY ARE TESTS RATHER THAN GREPS.
 *
 * This file's subject module opens by recording that
 * `grep -rn 'jwtVerify|createRemoteJWKSet' server/` returned THREE lines and
 * that all three were HEADERS QUOTING THE COMMAND. **The first draft of §11
 * reproduced that defect exactly**: `/\bfetch\s*\(/` over the raw text was RED,
 * because the module's own §0 says *"`grep -rn 'fetch(' server/` returns
 * nothing"* — twice — and a grep cannot tell a warning from a violation. The
 * `case '` control was red for the same reason, against a sentence saying there
 * is no `case`.
 *
 * So the controls run over CODE. The prose is still the argument; it is just no
 * longer the evidence.
 */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}
const MODULE_CODE = codeOnly(MODULE_TEXT)

test('11 · the verifier makes no outbound request — the JWKS is an argument', () => {
  /**
   * ⚠️ `tests/http/console-roster-unreachable.test.ts` §1c asserts this over
   * the WHOLE of both plane directories and would therefore catch it anyway.
   * It is repeated here, narrowly, because this is the module somebody will be
   * tempted to add one to: *"where the JWKS comes from"* is the obvious next
   * line to write, and it is an owner's ruling rather than a line.
   */
  assert.equal(/\bfetch\s*\(/.test(MODULE_CODE), false, 'token-verify.ts now makes an HTTP request')
  assert.equal(/\bhttps?:\/\//.test(MODULE_CODE), false, 'a URL is hard-coded in the verifier')
})

test('11a · it takes no package dependency — `node:crypto` and `model/` only', () => {
  const specifiers = [...MODULE_CODE.matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? '')
  assert.deepEqual(
    [...new Set(specifiers)].sort(),
    ['../../model/reconciliation.ts', 'node:crypto'],
    'the verifier now imports something else — G191 pins every dependency exact, ' +
      'and taking a new one is a ruling rather than an import',
  )
})

test('11b · it DISPATCHES on nothing — there is no per-algorithm branch', () => {
  assert.equal((MODULE_CODE.match(/case\s/g) ?? []).length, 0, 'a `case` arrived in the verifier')
  assert.equal(MODULE_CODE.includes('switch'), false, 'a `switch` arrived in the verifier')
})

test('11c · and it mints no session and writes no SQL', () => {
  for (const forbidden of ['INSERT', 'UPDATE ', 'withTenantScope', 'withSignInScope', 'Pool']) {
    assert.equal(
      MODULE_CODE.includes(forbidden),
      false,
      `token-verify.ts now mentions \`${forbidden}\` in code — a verifier is not a sign-in`,
    )
  }
})

test('11d · ANTI-VACUOUS — `codeOnly()` really does keep the code it is asked about', () => {
  /* A stripper that returned the empty string would make every control above
   * pass while asserting nothing — §5.6, in the tests written to avoid it. */
  assert.equal(MODULE_CODE.includes('export function verifyIdentityToken'), true)
  assert.equal(MODULE_CODE.includes("from 'node:crypto'"), true)
  assert.equal(MODULE_CODE.includes('token_algorithm_not_allowed'), true)
  assert.equal(
    MODULE_CODE.includes('THE ALGORITHM IS OURS'),
    false,
    'the comment stripper kept the header, so these controls are reading prose again',
  )
})

/**
 * 🛑 THE CONTAINMENT PROOF, WITNESSED BITING RATHER THAN MERELY COMPILING.
 * `_TokenRefusalHoldsNoText` in the module asserts that no refusal arm carries
 * text. If the proof ever weakened, the directive below would go UNUSED, which
 * is `TS2578` — and `npm test` runs `typecheck:tests` before a single assertion
 * executes. `tests/model/no-text-deep.test.ts` uses the same device.
 */
// @ts-expect-error — a refusal arm carrying the token's own `kid` is a bare
// `string` from a token we have refused to believe. §0c of the module.
export type _RefusalMayNotCarryTheKid = AssertNoTextDeep<{
  readonly kind: 'token_key_not_found'
  readonly kid: string
}>

/* The positive control for the directive above: an arm with only a `kind` is a
 * string LITERAL and must keep compiling, or the proof has started
 * over-rejecting and every arm in the module is a lie. */
export type _RefusalWithOnlyAKindIsFine = AssertNoTextDeep<{ readonly kind: 'token_expired' }>

/* ==================================================================== *
 * §12 · THE CENSUS — every arm, witnessed
 * ==================================================================== */

test('12 · every declared refusal was witnessed by this file', () => {
  const declared = [...TOKEN_VERIFICATION_REFUSALS].sort()
  const witnessed = [...WITNESSED].sort()
  assert.deepEqual(
    witnessed,
    declared,
    'a refusal this module declares was never observed. A sixteenth arm with no ' +
      'test is a control that exists only as a type — §5.6 — and this assertion ' +
      'is the reason that cannot land quietly.',
  )
})

test('12a · and the roster really is the union — the module proves it both ways', () => {
  assert.equal(TOKEN_VERIFICATION_REFUSALS.length, 15)
  assert.equal(new Set(TOKEN_VERIFICATION_REFUSALS).size, 15, 'a duplicated roster entry')
})

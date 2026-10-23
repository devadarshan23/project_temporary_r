/**
 * MID-FLIGHT AUTHENTICATION STATE — #223 [A-5].
 *
 * A federated callback has nothing to consume, so a replayed one mints a second
 * session, and a caller may name a DIFFERENT connection at callback than the one
 * it was sent to — which is the ORG AXIS read from a request. That is invariant
 * 1's shape one axis over.
 *
 * 🛑 WHY SOME TESTS PASS AT BASE. #223 requires the red to be partial and named:
 * *"At the red commit the type is absent, so the file must also carry assertions
 * that pass at base … and report the split."* The BASE FACTS below assert the
 * two premises the row rests on — `Timestamp` is a string alias and
 * `IdentityConnectionId` is branded — plus the one that makes the deliberate
 * absence of `userId` load-bearing: the realm lookup already returns no
 * user-existence signal, and a `userId` written at redirect would re-create the
 * oracle it was designed to avoid.
 *
 * The row's values are reached through `await import()` inside the tests that
 * need them, for the reason `tests/model/finding-standing.test.ts` records.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL_DIR = join(REPO_ROOT, 'model')

const DOMAIN_TEXT = readFileSync(join(MODEL_DIR, 'domain.ts'), 'utf8')
const KERNEL_TEXT = readFileSync(join(MODEL_DIR, 'kernel.ts'), 'utf8')
const IDENTITY_TEXT = readFileSync(join(MODEL_DIR, 'identity.ts'), 'utf8')

function modelSources(): ReadonlyArray<readonly [string, string]> {
  return readdirSync(MODEL_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort()
    .map((f) => [`model/${f}`, readFileSync(join(MODEL_DIR, f), 'utf8')] as const)
}

/**
 * See the identical helper in `tests/model/session-shape.test.ts` for the full
 * argument. In one sentence: a sweep for an ABSENCE has to read code, because
 * the paragraph explaining why the thing is absent contains its name — and this
 * slice tripped on exactly that, twice.
 */
function codeOnly(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const two = text.slice(i, i + 2)
    if (two === '//') {
      const end = text.indexOf('\n', i)
      i = end === -1 ? text.length : end
      continue
    }
    if (two === '/*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    const ch = text[i] ?? ''
    if (ch === '"' || ch === "'" || ch === '`') {
      out += ch
      i += 1
      while (i < text.length && text[i] !== ch) {
        if (text[i] === '\\') i += 1
        out += text[i] ?? ''
        i += 1
      }
      out += ch
      i += 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/** See the identical helper in `tests/model/session-shape.test.ts` for why text. */
function interfaceFieldNames(text: string, name: string): string[] {
  const open = text.indexOf(`export interface ${name} {`)
  if (open === -1) return []
  let depth = 0
  let i = text.indexOf('{', open)
  const start = i
  for (; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  const body = text.slice(start + 1, i)
  const names: string[] = []
  let nesting = 0
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (nesting === 0) {
      const m = /^(?:readonly )?([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(line)
      if (m?.[1] !== undefined) names.push(m[1])
    }
    nesting += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
    if (nesting < 0) nesting = 0
  }
  return names
}

/* ==================================================================== *
 * BASE FACTS
 * ==================================================================== */

test('BASE — `IdentityConnectionId` is branded, so the door pinned at redirect is not a bare string', () => {
  assert.match(KERNEL_TEXT, /^export type IdentityConnectionId = Id<'IdentityConnection'>$/m)
})

test('BASE — `Timestamp` is a bare `string` alias', () => {
  assert.match(KERNEL_TEXT, /^export type Timestamp = string$/m)
})

test('BASE — the realm lookup returns an ID and no user-existence signal', async () => {
  // `routeToConnection()` is the unauthenticated surface this row sits behind.
  // Its four refusals name a DOMAIN and a CONNECTION and never a person — which
  // is exactly the property a `SignInAttempt.userId` would destroy.
  const { DOMAIN_ROUTING_REFUSALS, routeToConnection } = await import('../../model/domain.ts')
  const refusals = Object.values(DOMAIN_ROUTING_REFUSALS)
  assert.equal(refusals.length, 4)
  for (const refusal of refusals) {
    assert.doesNotMatch(
      refusal,
      /user|account|principal|person|email/,
      `\`${refusal}\` names a principal on an UNAUTHENTICATED surface. ` +
        '`docs/build/green-platform-slices.md` requires the realm operation to return ' +
        '"no user-existence signal".',
    )
  }
  const nobody = routeToConnection([], 'nobody.example')
  assert.equal(nobody.ok, false)
  assert.equal(
    nobody.ok === false ? nobody.refusal : null,
    'domain_not_claimed',
    'An unknown domain must be indistinguishable from an unclaimed one.',
  )
})

/* ==================================================================== *
 * THE ROW — every test below fails at base
 * ==================================================================== */

test('exactly one module declares `export interface SignInAttempt`, and it is `model/domain.ts`', () => {
  const declaring = modelSources()
    .filter(([, text]) => /^export interface SignInAttempt \{/m.test(text))
    .map(([path]) => path)
  assert.deepEqual(declaring, ['model/domain.ts'])
})

test('the attempt key set is exactly these SEVEN, in declaration order', () => {
  assert.deepEqual(interfaceFieldNames(DOMAIN_TEXT, 'SignInAttempt'), [
    'id',
    'handleDigest',
    'connectionId',
    'challengeDigest',
    'startedAt',
    'expiresAt',
    'consumedAt',
  ])
})

test('an eighth key of any type is a compile error, and the closure that makes it one is declared', () => {
  assert.match(
    IDENTITY_TEXT,
    /export type _SignInAttemptCarriesExactlyTheseKeys = AssertKeySetIsExactly</,
  )
})

test('the attempt carries NO `userId`, and the docblock cites the user-existence oracle', () => {
  const keys = interfaceFieldNames(DOMAIN_TEXT, 'SignInAttempt')
  assert.ok(
    !keys.includes('userId'),
    'BEFORE THE DOOR ANSWERS THERE IS NO PRINCIPAL, and a `userId` written at redirect is ' +
      'a USER-EXISTENCE ORACLE on an unauthenticated surface. G223 names the same field as ' +
      'the obstacle anyone reopening the second-factor question must clear first: a ' +
      'per-user attempt counter cannot live here without re-creating it.',
  )
  const at = DOMAIN_TEXT.indexOf('export interface SignInAttempt {')
  assert.notEqual(at, -1)
  const docblock = DOMAIN_TEXT.slice(Math.max(0, at - 6000), at)
  assert.ok(
    /user-existence oracle/i.test(docblock),
    'PUT THAT SENTENCE IN THE DOCBLOCK OR THE NEXT READER ADDS THE FIELD BACK. It reads ' +
      'as an oversight, not a decision, and adding it makes no test fail except this one.',
  )
  // The type-level half, so that adding the field is a compile error and not
  // only a text assertion somebody can amend in the same commit.
  assert.match(IDENTITY_TEXT, /export type _SignInAttemptCarriesNoUserId = /)
})

test('MG4 — no attempt counter and no lockout arrived with this row; it is a separate unruled question', () => {
  const found = modelSources().flatMap(([path, text]) =>
    [
      ...codeOnly(text).matchAll(
        /\b(lockout|lockedUntil|attemptCount|failedAttempts|maxAttempts)\b/gi,
      ),
    ].map((m) => `${path}: ${m[0]}`),
  )
  assert.deepEqual(
    found,
    [],
    'G223: "A lockout is a separate question and is NOT ruled here." This row is where an ' +
      'attempt counter would eventually live, and it cannot be keyed per-user without the ' +
      'oracle above. Do not add one as a side effect of this slice.',
  )
})

test('no challenge value and no relay parameter is stored in the clear — digests only', () => {
  const keys = interfaceFieldNames(DOMAIN_TEXT, 'SignInAttempt')
  for (const forbidden of ['handle', 'relayState', 'nonce', 'codeVerifier', 'challenge', 'state']) {
    assert.ok(
      !keys.includes(forbidden),
      `\`${forbidden}\` stores a credential preimage. Same rule and same reason as ` +
        '`Session.handleDigest`: the row holds the shadow, never the value.',
    )
  }
})

/* ==================================================================== *
 * BEHAVIOUR — the two assertions #223 names
 * ==================================================================== */

test('test_a_consumed_attempt_cannot_mint_a_second_session', async () => {
  const { consumeSignInAttempt } = await import('../../model/domain.ts')
  const { acmePendingSignInAttempt, acmeConsumedSignInAttempt, acmeFederatedCallback } =
    await import('../../model/examples.ts')

  // The negative control for this assertion is THE LAZY REPAIR: deleting the
  // `consumedAt` check makes EXACTLY this test fail and no other, because the
  // consumed fixture is valid in every other respect — same handle, same door,
  // same challenge — so it falls straight through to `ok: true`.
  const first = consumeSignInAttempt(acmePendingSignInAttempt, acmeFederatedCallback)
  assert.equal(first.ok, true, 'the pending attempt must be consumable exactly once')

  const replay = consumeSignInAttempt(acmeConsumedSignInAttempt, acmeFederatedCallback)
  assert.equal(replay.ok, false)
  assert.equal(
    replay.ok === false ? replay.refusal : null,
    'sign_in_attempt_replayed',
    'A REPLAYED CALLBACK MINTS A SECOND SESSION. `consumedAt` is set in the SAME ' +
      'transaction that mints the `Session`, under the row\'s own uniqueness — a process ' +
      'map could not make that atomic across two nodes; a row can.',
  )
})

test('test_the_connection_is_read_from_the_attempt_and_not_from_the_callback', async () => {
  const { consumeSignInAttempt } = await import('../../model/domain.ts')
  const { acmePendingSignInAttempt, acmeFederatedCallback, acmeGoogleConnection } = await import(
    '../../model/examples.ts'
  )

  const impostor = { ...acmeFederatedCallback, connectionId: acmeGoogleConnection.id }
  const refused = consumeSignInAttempt(acmePendingSignInAttempt, impostor)
  assert.equal(
    refused.ok,
    false,
    'A CALLBACK NAMING A DIFFERENT DOOR IS THE ORG AXIS READ FROM A REQUEST. Routing ' +
      'chooses the door; the door decides — and the door was decided at redirect. Note ' +
      'the two fixtures are both `oidc` and both owned by the same customer, so nothing ' +
      'but the pinned id distinguishes them.',
  )
  assert.equal(
    refused.ok === false ? refused.refusal : null,
    'sign_in_attempt_connection_mismatch',
  )

  // THE LAZY REPAIR THIS DEFENDS AGAINST: honouring the callback's connection
  // rather than refusing. Under it the assertion above is the only failure, and
  // it fails only if the check is deleted rather than reordered.
  const honest = consumeSignInAttempt(acmePendingSignInAttempt, acmeFederatedCallback)
  assert.equal(honest.ok, true)
  assert.equal(
    honest.ok === true ? honest.connectionId : null,
    acmePendingSignInAttempt.connectionId,
    'THE SUCCESS ARM RETURNS THE ATTEMPT\'S CONNECTION, NOT THE CALLBACK\'S. Returning ' +
      'the callback\'s would be correct-looking and wrong: it is the value a caller ' +
      'supplied, and this function exists to stop a caller supplying it.',
  )
})

test('a mismatched challenge digest refuses — compared, never re-derived', async () => {
  const { consumeSignInAttempt } = await import('../../model/domain.ts')
  const { acmePendingSignInAttempt, acmeFederatedCallback } = await import(
    '../../model/examples.ts'
  )
  const tampered = {
    ...acmeFederatedCallback,
    challengeDigest: acmePendingSignInAttempt.handleDigest,
  }
  const refused = consumeSignInAttempt(acmePendingSignInAttempt, tampered)
  assert.equal(refused.ok, false)
  assert.equal(
    refused.ok === false ? refused.refusal : null,
    'sign_in_attempt_challenge_mismatch',
    'The tampered value is the attempt\'s OWN handle digest, so a check written as ' +
      '"is this a plausible digest" passes it and only an equality against the pinned ' +
      'challenge refuses it.',
  )
})

test('a callback presented against the wrong row refuses on the lookup key', async () => {
  const { consumeSignInAttempt } = await import('../../model/domain.ts')
  const { acmePendingSignInAttempt, acmeFederatedCallback } = await import(
    '../../model/examples.ts'
  )
  const strayed = {
    ...acmeFederatedCallback,
    handleDigest: acmeFederatedCallback.challengeDigest,
  }
  const refused = consumeSignInAttempt(acmePendingSignInAttempt, strayed)
  assert.equal(refused.ok, false)
  assert.equal(refused.ok === false ? refused.refusal : null, 'sign_in_attempt_handle_mismatch')
})

test('the refusal union is CLOSED and every arm is reachable', async () => {
  const { SIGN_IN_ATTEMPT_REFUSALS } = await import('../../model/domain.ts')
  assert.deepEqual(Object.values(SIGN_IN_ATTEMPT_REFUSALS), [
    'sign_in_attempt_handle_mismatch',
    'sign_in_attempt_replayed',
    'sign_in_attempt_connection_mismatch',
    'sign_in_attempt_challenge_mismatch',
  ])
  // ORDER is asserted, not membership: when `POST /session/federated` lands,
  // these names mirror onto the wire BY EXACT NAME, so renaming one here is a
  // wire change. Same discipline as `SESSION_BOUND_REFUSAL_REASONS`.
  assert.equal(Object.keys(SIGN_IN_ATTEMPT_REFUSALS).length, 4)
})

test('`consumeSignInAttempt()` reads NO clock, and the absence is deliberate rather than forgotten', () => {
  // `mayRouteToConnection()` in the same module makes the identical argument:
  // "a function accepting a parameter it does not read is a lie about what
  // decides." `Timestamp = string`, so any expiry comparison here would be a
  // LEXICAL string comparison — right for ISO-8601 in UTC with fixed fractional
  // digits and silently wrong for anything else. G220's row says the timestamp
  // codec is its own work and is not started; `model/session.ts` says in its own
  // header "Do not add a comparison to this file; add the codec."
  const signature =
    /export function consumeSignInAttempt\(\s*attempt: SignInAttempt,\s*callback: FederatedCallback,\s*\): SignInAttemptConsumption/.exec(
      DOMAIN_TEXT,
    )
  assert.ok(
    signature !== null,
    'THE SIGNATURE TOOK A CLOCK. Deciding expiry REQUIRES changing this signature, which ' +
      'is a visible act with a test standing on it, rather than a lexical comparison ' +
      'somebody slips into a body.',
  )
  assert.ok(
    !/sign_in_attempt_expired/.test(codeOnly(DOMAIN_TEXT)),
    'AN EXPIRY ARM WITH NO COMPARISON BEHIND IT is a refusal nothing can return — the ' +
      'shape G223 names as the defect it is avoiding, one type over.',
  )
})

test('`model/kernel.ts` declares `SignInAttemptId`, beside `SessionId`', () => {
  assert.match(KERNEL_TEXT, /^export type SignInAttemptId = Id<'SignInAttempt'>$/m)
})

test('the fixtures construct real attempts, because `tsc` stays green whatever is wrong here', async () => {
  const { acmePendingSignInAttempt, acmeConsumedSignInAttempt } = await import(
    '../../model/examples.ts'
  )
  for (const [name, attempt] of [
    ['acmePendingSignInAttempt', acmePendingSignInAttempt],
    ['acmeConsumedSignInAttempt', acmeConsumedSignInAttempt],
  ] as const) {
    assert.deepEqual(
      Object.keys(attempt).sort(),
      [
        'challengeDigest',
        'connectionId',
        'consumedAt',
        'expiresAt',
        'handleDigest',
        'id',
        'startedAt',
      ],
      `${name} does not carry the seven keys`,
    )
    assert.ok(!('userId' in attempt), `${name} carries a userId`)
    assert.match(attempt.handleDigest, /^[0-9a-f]{64}$/)
    assert.match(attempt.challengeDigest, /^[0-9a-f]{64}$/)
  }
  assert.equal(acmePendingSignInAttempt.consumedAt, null)
  assert.notEqual(acmeConsumedSignInAttempt.consumedAt, null)
})

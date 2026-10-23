/**
 * THE SESSION TIER'S VOCABULARY, PINNED AGAINST THE MODEL BEFORE ANY OPERATION
 * CAN MOVE IT — #230 [A-9a].
 *
 * `tools/check-wire-mirror.mjs`'s own sequencing rule, quoted: "a vocabulary
 * registered after the enum it governs has shipped is registered after the
 * drift it exists to catch." The sixteen codes this slice adds are therefore
 * asserted in the commit that adds them, and every one of them is DERIVED FROM
 * `model/` AT RUNTIME rather than read out of the YAML under test.
 *
 * ┌─ WHY THIS IS A TEST AND NOT A `check-wire-mirror` PAIR ─────────────────────┐
 * │ THE QUESTION WAS ASKED AND ANSWERED RATHER THAN SKIPPED, because the        │
 * │ 11 Aug 2026 amendment to G109 attaches a red-fixture condition to every new │
 * │ pair and a slice that quietly declines to register one owes the reason.     │
 * │                                                                            │
 * │ A pair compares a model vocabulary against a wire enum as EQUAL LISTS IN    │
 * │ ORDER. `ErrorCode` is none of those things: it is ONE closed enum shared by │
 * │ every tier, sorted ALPHABETICALLY rather than in any model's declaration    │
 * │ order, and it is the union of many vocabularies PLUS codes with no model    │
 * │ twin at all. Every candidate pair against it therefore reports DRIFT        │
 * │ against a correct wire — which is why none of the twenty-four existing      │
 * │ pairs addresses `ErrorCode` despite seventy-one members and a dozen model   │
 * │ unions sitting behind them.                                                 │
 * │                                                                            │
 * │ The relationship that actually holds is MEMBERSHIP, not equality, and the   │
 * │ precedent is in-tree: `tests/contracts/meter-fact-wire.test.mjs` B checks   │
 * │ its subset relation "never as equality", because "a pair that demanded      │
 * │ equality would go red the day one of them shipped." Same shape, same        │
 * │ reason. `PAIRS.length` is therefore UNCHANGED by this slice, and no drifted │
 * │ fixture is owed because no source kind and no pair were added.              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE ARITHMETIC IN #230 IS STALE AND THE CORRECTION IS THE SUBSTANCE OF
 * THIS FILE. The issue names TEN codes and asserts them against
 * `SESSION_REFUSALS` and `TENANT_SELECTION_REFUSALS` — two const objects that
 * do not exist and never did. It was written before #222/#223/#226 landed. What
 * DOES exist, and what the sixteen are derived from, is three const objects
 * with three real producer functions:
 *
 *   DOMAIN_ROUTING_REFUSALS        model/domain.ts   routeToConnection()
 *   SIGN_IN_ATTEMPT_REFUSALS       model/domain.ts   consumeSignInAttempt()
 *   SESSION_BOUND_REFUSAL_REASONS  model/session.ts  validateSessionBounds()
 *
 * Each of the three carries a WRITTEN COMMITMENT, in its own docblock, that its
 * names mirror onto this wire by exact name when the session tier lands. This
 * file is that commitment executed. Nothing here is chosen; assertion A8 is the
 * control that nothing was.
 *
 * ⚠️ #230'S ASSERTION 3 — "declares ZERO paths" — IS NOT ASSERTED AND ITS
 * ABSENCE IS DELIBERATE. It was a sequencing property of splitting #230 from
 * #231, and this PR builds both: the tier and its operations are one contract
 * file, so a zero-path assertion would be a control written to fail on the
 * commit that satisfies it. The operations are asserted in
 * `tests/contracts/session-operations-wire.test.mjs`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

import { DOMAIN_ROUTING_REFUSALS, SIGN_IN_ATTEMPT_REFUSALS } from '../../model/domain.ts'
import { SESSION_BOUND_REFUSAL_REASONS } from '../../model/session.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTRACTS = path.join(ROOT, 'docs', 'contracts')

const read = (rel) => readFileSync(path.join(CONTRACTS, rel), 'utf8')

/**
 * THE THREE VOCABULARIES, AS VALUES, IN DECLARATION ORDER.
 *
 * Read by importing the const objects, never by scanning the source and never
 * by reading the YAML this file checks. A test that harvested these names out
 * of `errors.yaml` would assert that the file agrees with itself.
 */
const MODEL_VOCABULARIES = {
  DOMAIN_ROUTING_REFUSALS: Object.values(DOMAIN_ROUTING_REFUSALS),
  SIGN_IN_ATTEMPT_REFUSALS: Object.values(SIGN_IN_ATTEMPT_REFUSALS),
  SESSION_BOUND_REFUSAL_REASONS: Object.values(SESSION_BOUND_REFUSAL_REASONS),
}

const ALL_MODEL_ARMS = Object.values(MODEL_VOCABULARIES).flat()

/** The enum members, in file order, from the shared vocabulary. */
function errorCodes() {
  const doc = parse(read('errors.yaml'))
  const members = doc?.components?.schemas?.ErrorCode?.enum
  assert.ok(
    Array.isArray(members),
    'docs/contracts/errors.yaml did not parse to a document with an ErrorCode enum. Every ' +
      'assertion below reads that array; a bad parse would pass them all vacuously.',
  )
  return members
}

/**
 * THE NINE NAMES #230 PROPOSED THAT HAVE NO MODEL ARM.
 *
 * The issue lists ten codes. Exactly ONE of them — `connection_disabled` — is a
 * real member of a real model vocabulary. The other nine were written against a
 * model that had not been built yet, and three of them are now ruled OUT rather
 * than merely absent:
 *
 *   second_factor_required · second_factor_replayed   G223 — no second factor
 *                                                     in v1; federation owns it
 *   tenant_not_selected                               G210 — the two selection
 *                                                     operations are DROPPED,
 *                                                     not deferred
 *
 * The remaining six name conditions no function in `model/` can produce.
 * `session_lifetime_unconfigured` is the instructive one: #226 promised that
 * name by exact mirror, and when `validateSessionBounds()` actually landed the
 * arm was called `bounds_not_configured`. Transcribing the ISSUE would have put
 * a name on the closed enum that nothing can ever return.
 *
 * ⚠️ THIS LIST IS A NEGATIVE CONTROL AND IS THE ONLY HAND-WRITTEN NAME LIST IN
 * THIS FILE. It exists so that an implementation which transcribed #230 fails
 * loudly instead of passing A1–A3 with nine extra members riding along.
 */
const PROPOSED_WITHOUT_A_MODEL_ARM = [
  'connection_owner_mismatch',
  'directory_guest_refused',
  'second_factor_replayed',
  'second_factor_required',
  'session_expired',
  'session_lifetime_unconfigured',
  'session_revoked',
  'subject_not_active',
  'tenant_not_selected',
]

/**
 * THE FOUR THAT ALREADY EXIST. #230's assertion 4, and its point is that this
 * slice REUSES them rather than minting a session-flavoured twin of each.
 */
const ALREADY_PRESENT = [
  'membership_absent',
  'session_invalid',
  'tenant_context_missing',
  'tenant_suspended',
]

/* ==================================================================== *
 * 0 · THE §5.6 GUARDS. Every assertion below iterates one of these
 *     arrays. If an import silently produced an empty object, A1–A3
 *     would each pass while asserting nothing — a control that passes
 *     vacuously, inside the file written to stop exactly that.
 * ==================================================================== */

test('guard · the three model vocabularies load and are non-empty', () => {
  for (const [name, members] of Object.entries(MODEL_VOCABULARIES)) {
    assert.ok(
      members.length > 0,
      `${name} imported as an empty vocabulary. Every assertion below iterates it, so a ` +
        'silent import failure would pass them all.',
    )
    for (const m of members) {
      assert.equal(typeof m, 'string', `${name} carries a non-string member: ${String(m)}`)
    }
  }
  assert.equal(
    ALL_MODEL_ARMS.length,
    16,
    'The three vocabularies together should carry sixteen arms — 4 routing, 4 sign-in ' +
      'attempt, 8 session bound. A different number means a vocabulary moved in `model/` ' +
      'and this slice\'s wire has not followed it. Derive: `node -e "..."` over the three ' +
      'const objects, or read `routeToConnection()`, `consumeSignInAttempt()` and ' +
      `\`validateSessionBounds()\`.\n\nGot: ${ALL_MODEL_ARMS.join(' · ')}`,
  )
})

test('guard · every model arm is distinct across the three vocabularies', () => {
  const seen = new Map()
  const collisions = []
  for (const [vocab, members] of Object.entries(MODEL_VOCABULARIES)) {
    for (const m of members) {
      if (seen.has(m)) collisions.push(`${m} (${seen.get(m)} and ${vocab})`)
      seen.set(m, vocab)
    }
  }
  assert.deepEqual(
    collisions,
    [],
    'Two model vocabularies declare the same arm name. The closed enum has one slot per ' +
      'name, so a collision means one of the two producers can never be diagnosed from the ' +
      `error class — the only channel that survives redaction.\n\n${collisions.join(' · ')}`,
  )
})

test('guard · the shared vocabulary parses and carries the codes this file counts', () => {
  const codes = errorCodes()
  assert.ok(
    codes.length >= 71,
    `Parsed ${codes.length} member(s) from errors.yaml's ErrorCode enum. Seventy-one stood ` +
      'there before this slice; fewer means the parse is wrong and A1–A5 are vacuous. ' +
      "Derive: `grep -cE '^        - [a-z_]+$' docs/contracts/errors.yaml`.",
  )
})

/* ==================================================================== *
 * A · THE MIRROR. Derived from `model/`, never from the YAML.
 * ==================================================================== */

for (const [vocab, members] of Object.entries(MODEL_VOCABULARIES)) {
  test(`assertion 1 · every ${vocab} arm has an ErrorCode of the same name`, () => {
    const codes = new Set(errorCodes())
    const missing = members.filter((m) => !codes.has(m))
    assert.deepEqual(
      missing,
      [],
      `${missing.length} of ${members.length} arms in \`${vocab}\` have no ErrorCode. The ` +
        'declaration says in its own docblock that these names mirror onto the session wire ' +
        'BY EXACT NAME when it lands. This is that wire. Under a restrictive ' +
        'SpanAttributePolicy the error class is the only diagnostic channel that survives ' +
        'redaction, so an arm with no code is a refusal that can happen in a customer ' +
        `account and cannot be diagnosed there.\n\nMissing: ${missing.join(' · ')}`,
    )
  })
}

test('assertion 4 · the four codes that already exist are reused, not duplicated', () => {
  const codes = errorCodes()
  const counts = new Map()
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1)

  const absent = ALREADY_PRESENT.filter((c) => !counts.has(c))
  assert.deepEqual(
    absent,
    [],
    'A code this slice is required to REUSE has gone missing from the enum: ' +
      `${absent.join(' · ')}. \`getSession\` and \`signOut\` refuse with \`session_invalid\`; ` +
      'a session-flavoured twin of it would be the second vocabulary this tier exists not to ' +
      'mint.',
  )

  const duplicated = [...counts].filter(([, n]) => n > 1).map(([c, n]) => `${c} ×${n}`)
  assert.deepEqual(
    duplicated,
    [],
    'The closed enum lists a code more than once. `errors.yaml`\'s own origin story is two ' +
      'ErrorCode definitions disagreeing by thirteen members within an afternoon — "a copied ' +
      `enum diverges; a referenced one cannot."\n\nDuplicated: ${duplicated.join(' · ')}`,
  )
})

test('assertion 5 · the enum is sorted, so an insertion cannot hide', () => {
  const codes = errorCodes()
  const sorted = [...codes].sort()
  const firstBad = codes.findIndex((c, i) => c !== sorted[i])
  assert.equal(
    firstBad,
    -1,
    'The ErrorCode enum is out of order. The schema description says "Listed alphabetically" ' +
      'and nothing was checking it, so an added member could sit anywhere and read as ' +
      'belonging there. Sorted order is what makes a sixteen-member insertion reviewable as ' +
      `sixteen separate lines rather than as one block.\n\nFirst out of order at index ` +
      `${firstBad}: ${codes[firstBad]} (expected ${sorted[firstBad]})`,
  )
})

/* ==================================================================== *
 * A8 · THE NEGATIVE CONTROL — the behavioural red.
 *
 * 🛑 A1–A3 pass on an implementation that adds the sixteen AND nine
 *    more. This is the assertion that fails it. #230's own words: "an
 *    implementation that adds fourteen codes rather than ten passes 2
 *    and 3."
 * ==================================================================== */

test('assertion 8 · no proposed code without a model arm reached the closed enum', () => {
  const codes = new Set(errorCodes())
  const invented = PROPOSED_WITHOUT_A_MODEL_ARM.filter((c) => codes.has(c))
  assert.deepEqual(
    invented,
    [],
    `${invented.length} code(s) from #230's proposed list reached the enum with no model arm ` +
      'of that name behind them. The enum is CLOSED and shared across every tier: a member ' +
      'nothing can return is a diagnostic channel pointing at a condition that cannot occur, ' +
      'and it can never be removed cheaply. Two of these are also ruled out outright — G223 ' +
      'puts the second factor with the customer\'s directory, and G210 DROPS tenant ' +
      `selection rather than deferring it.\n\nInvented: ${invented.join(' · ')}`,
  )
})

test('assertion 8b · every code this slice added matches a model arm by exact name', () => {
  const codes = errorCodes()
  const known = new Set([...ALL_MODEL_ARMS, ...ALREADY_PRESENT])

  /*
   * The sixteen are the intersection of the enum with the model's session
   * vocabularies. Anything session-shaped in the enum that is NOT in that
   * intersection is a name somebody wrote rather than derived — which is the
   * only way a code can enter this file without a producer.
   */
  const sessionShaped = codes.filter((c) =>
    /^(session_|sign_in_|domain_|bound_|bounds_|idle_|connection_|second_factor|subject_not_|directory_|tenant_not_)/.test(
      c,
    ),
  )
  const unbacked = sessionShaped.filter((c) => !known.has(c))
  assert.deepEqual(
    unbacked,
    [],
    `${unbacked.length} session-shaped code(s) match no model refusal arm and no code this ` +
      'slice inherited. This slice\'s whole discipline is that the wire MIRRORS what already ' +
      'exists rather than minting a second vocabulary — §5.3. If one of these is genuinely ' +
      'needed, the arm goes in `model/` FIRST and the mirror follows it; a wire ahead of its ' +
      `model is the defect the mirror exists to catch.\n\nUnbacked: ${unbacked.join(' · ')}`,
  )
})

/* ==================================================================== *
 * B · THE FILE ITSELF — #230's assertions 3 and 4, minus the zero-path
 *     clause, which this PR is the commit that ends.
 * ==================================================================== */

test('assertion 3a · the session tier exists and is a parseable OpenAPI document', () => {
  let text
  try {
    text = read('session.openapi.yaml')
  } catch (e) {
    assert.fail(
      'docs/contracts/session.openapi.yaml does not exist. Sixty-nine paths and not one ' +
        'signs in, exchanges a token or signs out; `X-Session` is a security scheme on ' +
        'three tiers with no producer anywhere. This is the file that produces it. ' +
        `(${e.code ?? e.message})`,
    )
  }
  const doc = parse(text)
  assert.equal(typeof doc?.openapi, 'string', 'session.openapi.yaml declares no `openapi` version.')
  assert.ok(doc?.paths && typeof doc.paths === 'object', 'session.openapi.yaml declares no `paths`.')
})

test('assertion 3b · the tier declares document-level `security: []`', () => {
  const doc = parse(read('session.openapi.yaml'))
  assert.deepEqual(
    doc.security,
    [],
    'The session tier must declare `security: []` at document level. It cannot live in any ' +
      'existing file precisely because all three of those declare a REQUIRED scheme at ' +
      'document level, and this is the tier whose first two operations have no session yet — ' +
      'that is the whole reason a fifth file exists. G191 reads security per operation with ' +
      'the document as the fallback, so an empty document-level list plus per-operation ' +
      'overrides is the mechanism rather than a workaround.',
  )
})

test('assertion 3c · the tier references the shared enum and restates none of it', () => {
  const text = read('session.openapi.yaml')
  const doc = parse(text)

  assert.ok(
    text.includes('./errors.yaml#/components/schemas/Problem'),
    'The session tier declares no reference to the shared Problem schema. Every tier ' +
      'references one closed vocabulary; a tier that shaped its own errors would be the ' +
      '27-versus-40 divergence errors.yaml exists to record.',
  )

  const schemas = doc?.components?.schemas ?? {}
  assert.ok(
    !('ErrorCode' in schemas) && !('Problem' in schemas),
    'The session tier declares its own `ErrorCode` or `Problem` schema. "A copied enum ' +
      'diverges; a referenced one cannot." Reference `./errors.yaml`, never restate it.\n\n' +
      `Declared: ${Object.keys(schemas).join(' · ')}`,
  )
})

/**
 * `checkHostBinding()` — #227 [A-10], applying G180.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE EXISTS FOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * G180, ruled and unapplied until this slice: *"The session record stores the
 * host it was issued on, and any request whose Host differs is refused and the
 * session revoked."* It is the control that survives a hostile sibling —
 * cookie tossing and subdomain takeover both work by getting a browser to send
 * the right cookie to the wrong place, and neither survives a server-side
 * host-equality check.
 *
 * 🛑 THE ATTACKER DOES NOT WANT THE VICTIM'S SESSION; THE ATTACKER WANTS THE
 * VICTIM ON THEIRS. `model/access.ts` refuses the JWT shape by name — *"A
 * REFERENCE, NOT A BEARER TOKEN"* — which kills forgery and makes revocation
 * instant, and does nothing at all against fixation or tossing. For a
 * reconciliation product the harm is exact: the victim uploads their own bank
 * statements into the attacker's tenant. **Nothing in this file, and nothing in
 * the module it tests, may say or imply that an opaque handle mitigates
 * either.** G180 forbids it in those words.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TWO MUTATIONS THAT ARE THE WHOLE SLICE
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   · **Refuse without revoking.** Every mismatch test still passes, and a
 *     stolen-and-tossed session survives to be retried against the right host.
 *     `test_a_mismatch_revokes_and_a_refusal_alone_is_not_enough` fails on that
 *     alone.
 *   · **A suffix-tolerant compare** (`endsWith`, or a registrable-domain
 *     fold). `test_a_sibling_subdomain_is_not_a_match` fails on that alone,
 *     and a sibling subdomain is precisely what a takeover gives an attacker.
 *
 * Both are the lazy repair a hurried reader reaches for, and a suite asserting
 * only "a different host is refused" passes against both.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  HOST_BINDING_REFUSALS,
  checkHostBinding,
  normaliseHost,
} from '../../model/serving-host.ts'
import { acmeScopedSession } from '../../model/examples.ts'
import type { Session } from '../../model/domain.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL_DIR = join(REPO_ROOT, 'model')
const SERVING_HOST_TEXT = readFileSync(join(MODEL_DIR, 'serving-host.ts'), 'utf8')

/** Comments stripped — `tests/model/session-shape.test.ts` records why. */
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

/** The session as issued: `app.reconcile.invalid`, per `model/examples.ts`. */
const issued: Session = acmeScopedSession
const ISSUED_HOST = 'app.reconcile.invalid'

test('the fixture is bound to the host this suite assumes', () => {
  assert.equal(issued.issuedHost, ISSUED_HOST)
})

/* ------------------------------------------------------------------ *
 * 1. The match
 * ------------------------------------------------------------------ */

test('a request on the issuing host is admitted', () => {
  const out = checkHostBinding(issued, ISSUED_HOST)
  assert.equal(out.ok, true)
})

/**
 * ⚠️ A HOST COMPARISON IS CASE-INSENSITIVE, and a bare `!==` refuses a
 * legitimate request on a capitalised Host. `Session.issuedHost`'s own
 * docblock names this: *"The failure is closed rather than open, which is why
 * it would be found by a customer and not by a test."* This is that test.
 */
test('a capitalised Host is the same host — DNS is case-insensitive', () => {
  assert.equal(checkHostBinding(issued, 'APP.Reconcile.Invalid').ok, true)
  assert.equal(checkHostBinding(issued, '  app.reconcile.invalid  ').ok, true)
})

/* ------------------------------------------------------------------ *
 * 2. The mismatch, and the revocation
 * ------------------------------------------------------------------ */

test('test_a_request_on_a_different_host_is_refused_AND_revokes_the_session', () => {
  const out = checkHostBinding(issued, 'attacker.example')
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, 'session_host_mismatch')
  assert.equal(out.revoke, true)
})

/**
 * 🛑 THE MUTATION THAT MATTERS, AND IT IS THE LIKELIEST LAZY REPAIR: implement
 * the refusal WITHOUT the revocation. Every mismatch test above still passes,
 * and a stolen-and-tossed session survives to be retried against the right
 * host — which is the attack, undiminished, with a 403 in the log.
 *
 * The instruction is a VALUE on the result and never a side effect: the model
 * is types and total functions, and the revoking write belongs to the caller.
 * A boolean return could not carry it at all, which is why the union exists.
 */
test('test_a_mismatch_revokes_and_a_refusal_alone_is_not_enough', () => {
  const out = checkHostBinding(issued, 'evil.reconcile.invalid')
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(
    out.revoke,
    true,
    'G180: "any request whose Host differs is refused AND the session revoked." ' +
      'A refusal alone leaves the handle live for the attacker to retry on the ' +
      'right host.',
  )
})

/**
 * 🛑 THE SECOND MUTATION. A sibling subdomain is what a subdomain takeover
 * hands an attacker, and `endsWith` — or any registrable-domain fold — admits
 * it. The comparison is byte-exact on a normalised host.
 */
test('test_a_sibling_subdomain_is_not_a_match', () => {
  for (const sibling of [
    'evil.app.reconcile.invalid',
    'app.reconcile.invalid.evil.example',
    'xapp.reconcile.invalid',
    'reconcile.invalid',
    'app.reconcile.invalid.',
  ]) {
    const out = checkHostBinding(issued, sibling)
    assert.equal(out.ok, false, `${sibling} must not match ${ISSUED_HOST}`)
    assert.equal(out.ok === false ? out.revoke : null, true)
  }
})

/**
 * ⚠️ A PORT IS PART OF THE HOST HERE, AND THE DECISION IS STATED RATHER THAN
 * LEFT TO THE NORMALISER. `issuedHost` is written from validated configuration
 * at mint time, so a deployment serving on a non-default port configures one;
 * stripping a port in the comparison would be the normaliser deciding what
 * counts as the same place, which is the thing this control exists to stop
 * anyone doing casually. The refusal is CLOSED, which is the correct direction
 * for a control whose open failure is a cross-tenant upload.
 */
test('a port is not stripped — normalisation folds case and nothing else', () => {
  assert.equal(checkHostBinding(issued, 'app.reconcile.invalid:8443').ok, false)
})

/* ------------------------------------------------------------------ *
 * 3. The two fail-open holes the ordering closes
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE FAIL-OPEN THE ORDER EXISTS TO CLOSE, AND IT IS NOT HYPOTHETICAL. A
 * session row whose `issuedHost` is empty — a mint bug, a bad migration
 * default, a hand-inserted row — normalises to `''`, and a request arriving
 * with no Host header also normalises to `''`. A bare equality check would
 * MATCH them and admit the request. The session's own binding is therefore
 * checked before the request's, and its absence kills the session.
 */
test('test_a_session_with_no_recorded_host_is_refused_rather_than_matching_an_absent_Host', () => {
  const unbound: Session = { ...issued, issuedHost: '   ' }
  const out = checkHostBinding(unbound, '')
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, 'session_host_not_recorded')
  assert.equal(
    out.revoke,
    true,
    'a session with no host binding cannot be used on any host, so it dies here',
  )
})

/**
 * ⚠️ AN ABSENT Host IS REFUSED AND DOES **NOT** REVOKE, and the asymmetry is
 * deliberate. A request that names no host names no OTHER host: there is
 * nothing to conclude about relocation. Revoking on it would make a malformed
 * proxy, or a stripped header at an edge, into a logout button. The request is
 * still refused — nothing is admitted — so the fail-closed property is intact
 * and only the destructive half is withheld.
 */
test('test_an_absent_Host_is_refused_but_does_not_revoke', () => {
  const out = checkHostBinding(issued, '')
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, 'host_not_presented')
  assert.equal(out.revoke, false)
})

test('the host-binding refusal set is closed', () => {
  assert.deepEqual(Object.values(HOST_BINDING_REFUSALS).sort(), [
    'host_not_presented',
    'session_host_mismatch',
    'session_host_not_recorded',
  ])
})

/* ------------------------------------------------------------------ *
 * 4. One normalisation, and it is frozen
 * ------------------------------------------------------------------ */

/**
 * ⚠️ A COMPARISON ANYONE CAN RE-IMPLEMENT IS A COMPARISON THAT WILL DIFFER.
 * `normaliseHost()` is the only host normaliser in `model/`, and this sweeps
 * the tree's own bytes for a second one. `normaliseClaimedDomain()` in
 * `model/domain.ts` is NOT a duplicate and is deliberately not reused —
 * `Session.issuedHost`'s docblock calls it *"the shape to copy"*, and G179
 * gives the reason one row over: which identity provider to try and which host
 * is being served are two different questions, and one function answering both
 * is one function that can disagree with itself.
 */
test('test_there_is_exactly_one_host_normaliser_in_model', () => {
  const hits = readdirSync(MODEL_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .filter((f) =>
      /function normaliseHost\b/.test(codeOnly(readFileSync(join(MODEL_DIR, f), 'utf8'))),
    )
  assert.deepEqual(hits, ['serving-host.ts'])
})

test('normaliseHost folds case and trims, and does nothing else', () => {
  assert.equal(normaliseHost('  APP.Reconcile.Invalid '), 'app.reconcile.invalid')
  assert.equal(normaliseHost('app.reconcile.invalid.'), 'app.reconcile.invalid.')
  assert.equal(normaliseHost('app.reconcile.invalid:8443'), 'app.reconcile.invalid:8443')
  assert.equal(normaliseHost(''), '')
})

/* ------------------------------------------------------------------ *
 * 5. G180's rules, on the declaration
 * ------------------------------------------------------------------ */

/**
 * ⚠️ THIS ONE READS THE COMMENTS ON PURPOSE, and is the exception the
 * comment-stripping helper's own docblock names: *"anything asserting 'this
 * ruling is cited on the declaration' deliberately does NOT"* go through
 * `codeOnly`.
 */
test('test_the_permanent_and_additive_rule_and_the_Domain_cookie_pressure_are_on_the_declaration', () => {
  assert.match(
    SERVING_HOST_TEXT,
    /never MOVES between hosts/,
    'G180: "A tenant may GAIN a second host; it never MOVES between hosts."',
  )
  assert.match(
    SERVING_HOST_TEXT,
    /Domain=/,
    'the commercial pressure this control exists to make impossible: widening the ' +
      'session cookie to `Domain=` during a sales-driven migration',
  )
  assert.match(SERVING_HOST_TEXT, /G180/)
})

/**
 * 🛑 G180 FORBIDS IT IN THOSE WORDS: *"OPAQUE SESSIONS DO NOT HELP HERE AND NO
 * DOCUMENT MAY IMPLY THEY DO."* This sweeps the module this slice produced for
 * any sentence that could be read as a mitigation claim.
 */
test('test_no_sentence_here_implies_an_opaque_handle_mitigates_fixation_or_tossing', () => {
  const claims = [...SERVING_HOST_TEXT.matchAll(/[^.\n]*opaque[^.]*\./gi)].map((m) =>
    m[0].trim(),
  )
  for (const sentence of claims) {
    assert.equal(
      /mitigat|prevent|protect|stops|defends/i.test(sentence),
      false,
      `G180 forbids this sentence: ${JSON.stringify(sentence)}`,
    )
  }
})

/** Total, and it returns values. `model/reconciliation.ts` holds the same rule. */
test('the added band throws nowhere', () => {
  assert.equal(/\bthrow\b/.test(codeOnly(SERVING_HOST_TEXT)), false)
})

/* ==================================================================== *
 * MUTATIONS RUN, AND WHAT EACH CAUGHT
 * --------------------------------------------------------------------
 * `tsc` was GREEN under every one of these.
 *
 *   M1  🛑 REFUSE WITHOUT REVOKING — `revoke: false` on the mismatch arm.
 *       → 3 red: `test_a_request_on_a_different_host_is_refused_AND_revokes_
 *          the_session`, `test_a_mismatch_revokes_and_a_refusal_alone_is_not_
 *          enough`, and `test_a_sibling_subdomain_is_not_a_match`. A suite
 *          asserting only "a different host is refused" is GREEN under this
 *          mutant, which is the whole reason the instruction is a field on the
 *          value rather than a `boolean` return.
 *
 *   M2  🛑 SUFFIX-TOLERANT COMPARE — `!presented.endsWith(issued)`.
 *       → 1 red, and ONLY one: `test_a_sibling_subdomain_is_not_a_match`, on
 *          `evil.app.reconcile.invalid`. Every other test in the file passes,
 *          including the exact-match test, the case-folding test and BOTH
 *          revocation tests. A takeover of any sibling label then admits the
 *          tossed cookie, and the only thing standing in the way is that one
 *          case.
 *
 *   M3  Case-sensitive compare — drop `.toLowerCase()` from `normaliseHost()`.
 *       → 4 red, and the spread is the point: the capitalised-Host test, the
 *          normaliser's own unit test, `lookup folds case and trims, through the
 *          one host normaliser`, and `a host that is not already normalised is
 *          refused at registration`. One function, four call sites, and every
 *          one of them fails CLOSED — so this would be found by a customer
 *          rather than by review, which is why it has tests rather than a
 *          comment.
 *
 *   M4  🛑 THE FAIL-OPEN. Compare the two normalised hosts FIRST, so
 *       `normaliseHost(session.issuedHost) === normaliseHost('')` matches
 *       before the session's own binding is checked.
 *       → 1 red: `test_a_session_with_no_recorded_host_is_refused_rather_than_
 *          matching_an_absent_Host`. Under the mutant an unbound session admits
 *          a request that presents no Host at all — and exactly one assertion
 *          in this file says so.
 *
 *   M5  Revoke on `host_not_presented` as well.
 *       → 1 red: `test_an_absent_Host_is_refused_but_does_not_revoke`. Recorded
 *          because it is the one mutation that makes the control STRICTER and
 *          is still wrong: it hands anyone who can strip a header at an edge a
 *          mass logout.
 *
 *   M6  Strip the port in `normaliseHost()`.
 *       → 2 red: the port test and the normaliser unit test. Recorded because
 *          the argument for the current polarity is a judgement, not a
 *          theorem — see the docblock on `normaliseHost()`.
 * ==================================================================== */

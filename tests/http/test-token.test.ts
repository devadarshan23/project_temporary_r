/**
 * THE VERIFIER'S OWN PROPERTIES — asserted against tokens THIS FILE FORGES,
 * rather than against tokens the minter was kind enough to produce.
 *
 * 🛑 THE ONE IDEA IN THIS FILE. `mintTestToken()` is the half an attacker does
 * not run. Every property ruling 2 asks for — "a script mints a SHORT-LIVED
 * token" — is worth exactly what the VERIFIER enforces, because anyone holding
 * the signing key writes their own minter in four lines, and this file is those
 * four lines. An adversarial read on 16 Aug 2026 minted a hundred-year token and
 * was served; the lifetime was a convention in the client and nothing at all in
 * the server.
 *
 * ⚠️ THIS FILE NEVER SKIPS AND NEEDS NO DATABASE. It exercises one pure module.
 * That matters: the token seam is the one piece of this slice whose defects are
 * reachable without a listener, so its assertions should not be behind a
 * PostgreSQL probe.
 *
 * ⚠️ `RECONCILE_LOCAL_TEST_SECRET` IS SET BELOW, BEFORE THE MODULE IS IMPORTED,
 * and the forging helper uses the same value. `node --test` gives each FILE its
 * own process, so this changes nothing for any other test. The point is that the
 * key is known here — a test that could not sign its own payload could only
 * assert that a MALFORMED token is refused, which is a much weaker claim than
 * the one below and is not the claim that matters.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

const KEY = 'test-token.test.ts/known-key'
process.env['RECONCILE_LOCAL_TEST_SECRET'] = KEY

const { DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS, mintTestToken, verifyTestToken } = await import(
  '../../server/dev/test-token.ts'
)

/* ------------------------------------------------------------------ *
 * The forger. Deliberately NOT a call into the minter.
 * ------------------------------------------------------------------ */

const VERSION = 'rtt1'

/** Sign any payload at all, exactly as somebody holding the key would. */
function forge(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const body = `${VERSION}.${encoded}`
  return `${body}.${createHmac('sha256', Buffer.from(KEY, 'utf8')).update(body).digest('base64url')}`
}

const now = (): number => Math.floor(Date.now() / 1000)

describe('the local test token — what the VERIFIER enforces, not what the minter chooses', () => {
  /* ================================================================ *
   * ANTI-VACUOUS. A verifier that refused everything would pass every
   * refusal below and prove nothing about any of them.
   * ================================================================ */

  it('an ordinary freshly minted token verifies', () => {
    const session = verifyTestToken(mintTestToken({ tenantId: 'ten_acme' }))
    assert.notEqual(
      session,
      null,
      'a token minted with the defaults was refused by the verifier, so every ' +
        'refusal asserted below is satisfied by a verifier that refuses everything ' +
        'and none of them is evidence of anything.',
    )
    assert.equal(session?.tenantId, 'ten_acme')
  })

  it('a correctly signed forgery of the ordinary payload verifies too', () => {
    /* The forger itself is anti-vacuous. If `forge()` produced tokens the
     * verifier rejected for a reason unrelated to the property under test —
     * a wrong key, a wrong version, a wrong encoding — every assertion below
     * would pass for the wrong reason. */
    const t = now()
    const forged = forge({ tenantId: 'ten_acme', iat: t, exp: t + 60 })
    assert.notEqual(
      verifyTestToken(forged),
      null,
      'this file cannot forge a token the verifier accepts, so the refusals below ' +
        'may be refusing the forgery rather than the property. Check VERSION, the ' +
        'encoding and RECONCILE_LOCAL_TEST_SECRET.',
    )
  })

  /* ================================================================ *
   * THE LIFETIME CEILING — ENFORCED WHERE THE TOKEN IS CONSUMED.
   * ================================================================ */

  it('a token whose lifetime exceeds the ceiling is REFUSED however it was signed', () => {
    assert.ok(
      Number.isSafeInteger(MAX_TTL_SECONDS) && MAX_TTL_SECONDS > DEFAULT_TTL_SECONDS,
      'MAX_TTL_SECONDS must be a ceiling above the default, or the default itself ' +
        'would be refused and the anti-vacuous assertion above would be the failing one',
    )

    const t = now()
    for (const [label, ttl] of [
      ['one second over the ceiling', MAX_TTL_SECONDS + 1],
      ['a day', 24 * 60 * 60 * 10],
      ['a hundred years', 3_153_600_000],
    ] as ReadonlyArray<readonly [string, number]>) {
      const forged = forge({ tenantId: 'ten_acme', iat: t, exp: t + ttl })
      assert.equal(
        verifyTestToken(forged),
        null,
        `${label} (ttl=${ttl}s): a correctly signed token with a lifetime beyond ` +
          `${MAX_TTL_SECONDS}s was ACCEPTED. Ruling 2 says "a script mints a ` +
          'SHORT-LIVED token" — a ceiling that lives only in the minter is a ' +
          'convention in the half an attacker does not run. Enforce `exp - iat` in ' +
          '`verifyTestToken()`.',
      )
    }

    /* And the ceiling itself must still be usable, or the control is an outage. */
    assert.notEqual(
      verifyTestToken(forge({ tenantId: 'ten_acme', iat: t, exp: t + MAX_TTL_SECONDS })),
      null,
      'a token exactly AT the ceiling was refused, so the bound is off by one and a ' +
        'correct caller is refused for being correct',
    )
  })

  it('a token carrying no `iat`, or one dated in the future, is REFUSED', () => {
    const t = now()

    assert.equal(
      verifyTestToken(forge({ tenantId: 'ten_acme', exp: t + 60 })),
      null,
      'a token with NO `iat` was accepted. Without an issue time there is no ' +
        '`exp - iat` to bound, so omitting the field would be the one-character ' +
        'bypass of the ceiling asserted above.',
    )

    assert.equal(
      verifyTestToken(forge({ tenantId: 'ten_acme', iat: 'yesterday', exp: t + 60 })),
      null,
      'a token whose `iat` is not a number was accepted — the same bypass, spelled ' +
        'differently',
    )

    assert.equal(
      verifyTestToken(forge({ tenantId: 'ten_acme', iat: t + 3600, exp: t + 3660 })),
      null,
      'a token ISSUED AN HOUR IN THE FUTURE was accepted. Its `exp - iat` is inside ' +
        'the ceiling, so a future `iat` buys an arbitrarily long usable window while ' +
        'satisfying the bound — which is the ceiling defeated by arithmetic rather ' +
        'than by forgery.',
    )

    /* A small skew must survive, or a developer machine one second fast is locked out. */
    assert.notEqual(
      verifyTestToken(forge({ tenantId: 'ten_acme', iat: t + 5, exp: t + 65 })),
      null,
      'a token five seconds in the future was refused; clocks disagree by more than ' +
        'that between a container and its host, and a control that fails while the ' +
        'property holds is a control people switch off',
    )
  })

  it('an expired token is REFUSED', () => {
    const t = now()
    assert.equal(
      verifyTestToken(forge({ tenantId: 'ten_acme', iat: t - 600, exp: t - 1 })),
      null,
      'an expired token was accepted',
    )
  })

  /* ================================================================ *
   * THE TENANT SLUG — G97's MINT-TIME RULE, GIVEN AN EXECUTABLE FORM.
   * ================================================================ */

  it('a token carrying a tenant id that is not a well-formed slug is REFUSED', () => {
    const t = now()

    /**
     * G97: "the database enforces no id format, so preventing `ten_acme` versus
     * `ten_ACME` is a mint-time rule in `model/`, not a column constraint." Until
     * this slice there was no mint-time enforcement point on the request path at
     * all — an adversarial read confirmed that `' ten_acme'`, `'*'`, `'%'` and a
     * 5000-character id all reached `withTenantScope()`. RLS makes each of them a
     * harmless empty page TODAY, and stops doing so the first time a write path
     * lands, because `WITH CHECK` will accept an INSERT for a tenant that does not
     * exist wherever no foreign key catches it.
     */
    const malformed: ReadonlyArray<readonly [string, unknown]> = [
      ['a leading space', ' ten_acme'],
      ['a trailing space', 'ten_acme '],
      ['upper case', 'ten_ACME'],
      ['a LIKE wildcard', '%'],
      ['a glob', '*'],
      ['a quote', "ten_acme'"],
      ['a newline', 'ten_acme\nten_globex'],
      ['no prefix', 'acme'],
      ['5000 characters', `ten_${'a'.repeat(5000)}`],
      ['empty', ''],
      ['not a string', 12],
      ['an object', { toString: () => 'ten_acme' }],
    ]

    for (const [label, tenantId] of malformed) {
      assert.equal(
        verifyTestToken(forge({ tenantId, iat: t, exp: t + 60 })),
        null,
        `${label}: a correctly signed token carrying \`${JSON.stringify(tenantId)}\` ` +
          'as its tenant was ACCEPTED, and that value would have gone straight to ' +
          '`withTenantScope()` and become an RLS predicate. The seam that turns a ' +
          'token into a session is the last place a tenant id can be checked for ' +
          'shape before it is one.',
      )
    }

    /* The well-formed ones must survive — a grammar that refuses the fixtures is
     * an outage wearing a control's clothes. */
    for (const good of ['ten_acme', 'ten_globex', 'ten_a', 'ten_acme_2', 'ten_1cloudhub']) {
      assert.notEqual(
        verifyTestToken(forge({ tenantId: good, iat: t, exp: t + 60 })),
        null,
        `\`${good}\` is a well-formed slug and was refused`,
      )
    }
  })

  it('the minter refuses to mint what the verifier would refuse', () => {
    /* Not the control — the verifier above is the control. This is the ordinary
     * courtesy of failing at the point a human can read the message, and it is
     * asserted so the two halves cannot drift into disagreeing. */
    for (const bad of [' ten_acme', 'ten_ACME', '*', '']) {
      assert.throws(
        () => mintTestToken({ tenantId: bad }),
        `\`${bad}\` was minted into a token the verifier will refuse, so the script ` +
          'hands a developer a credential that silently does not work',
      )
    }
    assert.throws(
      () => mintTestToken({ tenantId: 'ten_acme', ttlSeconds: MAX_TTL_SECONDS + 1 }),
      'a ttl beyond the ceiling was minted into a token the verifier will refuse',
    )
  })
})

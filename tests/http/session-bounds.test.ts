/**
 * THE PLATFORM SESSION BOUNDS READER, AND THE EIGHT 503 ARMS IT MAKES
 * REACHABLE — W3/R7, G2121–G2124, 25 Sep 2026.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ THIS FILE IS THE PROOF R7 WAS TAKEN FOR: that every member of              │
 * │ `SESSION_BOUND_REFUSAL_REASONS` can now be produced BY A REAL DEPLOYMENT   │
 * │ CONFIGURATION, through the reader a serving path would use.                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 WHY THAT NEEDED PROVING. `docs/contracts/session.openapi.yaml` declares a
 * **503** on `completeFederatedSignIn` — *"THE PLATFORM CANNOT MINT A SESSION
 * BECAUSE ITS OWN BOUNDS ARE NOT USABLE. The eight arms of
 * `SESSION_BOUND_REFUSAL_REASONS`, by exact name"* — and until this slice
 * **nothing in `server/` read `PLATFORM_SESSION_CEILING` or called
 * `validateSessionBounds()` at all.** Measured before the reader was written:
 *
 *     grep -rn "PLATFORM_SESSION_CEILING\|validateSessionBounds" server/   ->  0
 *
 * So all eight were arms of a union with no serving-path producer, and two of
 * them — the two ceiling arms — had no producer anywhere, because the only
 * caller was a test handing `validateSessionBounds()` literals.
 * `model/session-mint.ts` says the live half in its own voice: *"nothing in
 * the tree configures bounds at all, so until R7 is answered
 * `bounds_not_configured` is not an unreachable arm — **it is the only answer
 * a real mint can produce.**"*
 *
 * 🛑 AND §9 IS THE CENSUS THAT MAKES THE REST WORTH ANYTHING. A NINTH arm
 * added to `SESSION_BOUND_REFUSAL_REASONS` with no test here is a RED GATE —
 * `token-verify.test.ts` §12's shape, which is the property a list of
 * assertions does not have on its own.
 *
 * ⚠️ NO DATABASE, NO BROWSER, NO PLANE AND NO SOCKET — so there is no
 * `tests/reachability.ts` guard at the top of this file and there must not be
 * one. The reader touches `process.env` and nothing else.
 *
 * ⚠️ AND EVERY CASE BELOW RESTORES THE ENVIRONMENT IN A `finally`. Two of
 * these variables decide whether a session may be minted at all; a case that
 * leaked one would make a LATER case pass or fail for a reason nobody wrote
 * down, which is the shape `docs/HANDOFF.md` §5.6 is about.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mintSession, MINT_SESSION_REFUSALS } from '../../model/session-mint.ts'
import type { MintSessionInput } from '../../model/session-mint.ts'
import {
  PLATFORM_SESSION_CEILING,
  SESSION_BOUND_FIELDS,
  SESSION_BOUND_REFUSAL_REASONS,
  validateSessionBounds,
} from '../../model/session.ts'
import type { SessionBoundRefusalReason } from '../../model/session.ts'
import type { IdentityConnectionId, SessionId, UserId } from '../../model/kernel.ts'
import type { SessionHandleDigest } from '../../model/domain.ts'
import { SESSION_BOUND_ENV, platformSessionBounds } from '../../server/data-plane/session-bounds.ts'

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const SESSION = 'ses_bounds_fixture' as SessionId
const SESSION_DIGEST = 'dig_session_bounds' as SessionHandleDigest
const RELAY_DIGEST = 'dig_relay_bounds' as SessionHandleDigest
const PERSON = 'usr_ops_mei' as UserId
const DOOR = 'icn_acme_okta' as IdentityConnectionId

/**
 * Everything a mint needs EXCEPT the bounds, which every case below supplies
 * from the reader rather than from a literal. **That is the whole point: a
 * test that passed bounds in by hand would be re-testing
 * `validateSessionBounds()`, which `tests/model/session-mint.test.ts` already
 * does. This one tests that a DEPLOYMENT can produce each arm.**
 */
function mintWithPlatformBounds(): ReturnType<typeof mintSession> {
  const input: MintSessionInput = {
    id: SESSION,
    handleDigest: SESSION_DIGEST,
    signInHandleDigest: RELAY_DIGEST,
    consumption: { ok: true, connectionId: DOOR },
    user: { id: PERSON, status: 'active', connectionId: DOOR },
    issuedHost: 'ten-acme.us-west-2.reconcileai.app',
    bounds: platformSessionBounds(),
  }
  return mintSession(input)
}

const WITNESSED = new Set<SessionBoundRefusalReason>()

/**
 * Run one case with exactly the stated environment, and nothing else.
 *
 * ⚠️ IT DELETES BOTH VARIABLES FIRST. A case that set only the lifetime while
 * a previous case's idle value survived would be asserting about a state no
 * deployment has, and it would do it silently.
 */
function withEnv(stated: Partial<Record<keyof typeof SESSION_BOUND_ENV, string>>, run: () => void) {
  const saved = new Map<string, string | undefined>()
  for (const field of SESSION_BOUND_FIELDS) {
    const name = SESSION_BOUND_ENV[field]
    saved.set(name, process.env[name])
    delete process.env[name]
  }
  try {
    for (const [field, value] of Object.entries(stated)) {
      process.env[SESSION_BOUND_ENV[field as keyof typeof SESSION_BOUND_ENV]] = value
    }
    run()
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

/** Assert the mint refused on bounds, and that the named arm is among them. */
function refusedOnBounds(reason: SessionBoundRefusalReason, why: string): void {
  const minted = mintWithPlatformBounds()
  assert.equal(minted.ok, false, `${why} — but the mint SUCCEEDED`)
  if (minted.ok) return
  assert.equal(
    minted.refusal,
    MINT_SESSION_REFUSALS.sessionBoundsUnusable,
    `${why} — the mint refused, but not on BOUNDS (it answered \`${minted.refusal}\`), so the ` +
      '503 arm is not what a deployment in this state would reach.',
  )
  if (minted.refusal !== MINT_SESSION_REFUSALS.sessionBoundsUnusable) return
  const reasons = minted.boundRefusals.map((r) => r.reason)
  assert.ok(
    reasons.includes(reason),
    `${why} — expected \`${reason}\` among the bound refusals, got [${reasons.join(' | ')}]`,
  )
  WITNESSED.add(reason)
}

/* ══════════════════════════════════════════════════════════════════ *
 * §0  THE ANTI-VACUITY ARM. A suite that only witnesses refusals is
 *     §5.6 wearing a census, so the ACCEPT path is proven FIRST.
 * ══════════════════════════════════════════════════════════════════ */

test('§0 · a deployment that states both bounds MINTS, and the arm is not reachable at all', () => {
  withEnv({ maxLifetimeSeconds: '28800', maxIdleSeconds: '900' }, () => {
    const stated = platformSessionBounds()
    assert.deepEqual(
      stated,
      { maxLifetimeSeconds: 28800, maxIdleSeconds: 900 },
      'the reader did not carry the deployment’s two numbers through unedited.',
    )
    const minted = mintWithPlatformBounds()
    assert.equal(
      minted.ok,
      true,
      'a deployment stating two sound bounds still cannot mint a session. Every refusal ' +
        'below is then meaningless: they would all be true of a reader that returned nothing.',
    )
    if (!minted.ok) return
    assert.deepEqual(
      minted.bounds,
      { maxLifetimeSeconds: 28800, maxIdleSeconds: 900 },
      'the VALIDATED bounds the writer receives are not the ones stated.',
    )
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §1  ABSENCE — G139's whole point, and the state of every plane today
 * ══════════════════════════════════════════════════════════════════ */

test('§1 · an unconfigured platform refuses on BOTH fields, and mints nothing', () => {
  withEnv({}, () => {
    assert.deepEqual(
      platformSessionBounds(),
      {},
      'the reader invented a bound nobody stated. G220: `PLATFORM_SESSION_CEILING` is a ' +
        'CEILING, NOT A DEFAULT — reading it here would make `bounds_not_configured` ' +
        'unreachable and would ratify twelve hours as what every deployment WANTS.',
    )
    const minted = mintWithPlatformBounds()
    assert.equal(minted.ok, false, 'an unconfigured platform minted a session.')
    if (minted.ok || minted.refusal !== MINT_SESSION_REFUSALS.sessionBoundsUnusable) {
      assert.fail('the refusal was not the bounds arm')
    }
    /* BOTH, not just the first: `validateSessionBounds()` reports both so that
     * a deployer is not told to state one number and then refused for the
     * other. */
    assert.deepEqual(
      minted.boundRefusals.map((r) => `${r.reason}:${r.field}`).sort(),
      ['bounds_not_configured:maxIdleSeconds', 'bounds_not_configured:maxLifetimeSeconds'],
      'an unconfigured platform was told about one missing bound rather than two.',
    )
    WITNESSED.add(SESSION_BOUND_REFUSAL_REASONS.boundsNotConfigured)
  })
})

test('§1b · an EMPTY variable is absence and not zero', () => {
  withEnv({ maxLifetimeSeconds: '', maxIdleSeconds: '' }, () => {
    assert.deepEqual(
      platformSessionBounds(),
      {},
      '`Number("")` is 0, so passing an empty variable through would report `bound_zero` — ' +
        '"absence wearing a value’s clothes" — for a variable that is simply unset in ' +
        'every shell and in `compose.yaml`. `bounds_not_configured` names that correctly.',
    )
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §2  THE DANGEROUS ONE. `NaN` compares false against everything, so
 *     a bound that reached a comparison would expire NOTHING.
 * ══════════════════════════════════════════════════════════════════ */

test('§2 · an unparseable bound reaches the model as `NaN` and is refused BY NAME', () => {
  withEnv({ maxLifetimeSeconds: 'eight hours', maxIdleSeconds: '900' }, () => {
    const stated = platformSessionBounds()
    assert.ok(
      Number.isNaN(stated.maxLifetimeSeconds),
      'the reader SANITISED an unparseable bound instead of carrying it. That is the one ' +
        'thing it must not do: a reader that coerced, clamped or skipped would be deciding ' +
        'the bound, and `bound_not_a_number` — the arm the contract calls the dangerous ' +
        'one — would have no producer.',
    )
    refusedOnBounds(
      SESSION_BOUND_REFUSAL_REASONS.boundNotANumber,
      'a deployment stating `eight hours` as a lifetime',
    )
  })
})

test('§2b · and so does `Infinity`, which sails through any naive `> 0` guard', () => {
  withEnv({ maxLifetimeSeconds: 'Infinity', maxIdleSeconds: '900' }, () => {
    refusedOnBounds(
      SESSION_BOUND_REFUSAL_REASONS.boundNotANumber,
      'a deployment stating `Infinity` as a lifetime',
    )
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §3  THE ORDINARY MISTAKES
 * ══════════════════════════════════════════════════════════════════ */

test('§3 · a fractional bound is refused rather than truncated', () => {
  withEnv({ maxLifetimeSeconds: '3600.5', maxIdleSeconds: '900' }, () => {
    refusedOnBounds(SESSION_BOUND_REFUSAL_REASONS.boundNotAnInteger, 'a fractional lifetime')
  })
})

test('§3b · `0` is a bound somebody WROTE, and it has its own arm', () => {
  withEnv({ maxLifetimeSeconds: '0', maxIdleSeconds: '900' }, () => {
    /* This is the producer `bound_zero` keeps after §1b: a deployer who means
     * "no limit" writes 0, and 0 is what the reader hands over. */
    refusedOnBounds(SESSION_BOUND_REFUSAL_REASONS.boundZero, 'a lifetime of zero')
  })
})

test('§3c · a negative bound expires every session before it is minted', () => {
  withEnv({ maxLifetimeSeconds: '-1', maxIdleSeconds: '900' }, () => {
    refusedOnBounds(SESSION_BOUND_REFUSAL_REASONS.boundNegative, 'a negative lifetime')
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §4  THE TWO CEILING ARMS — the ones that had no producer ANYWHERE,
 *     because a ceiling is only reachable from a bound somebody chose
 * ══════════════════════════════════════════════════════════════════ */

test('§4 · a deployment may TIGHTEN and may not LOOSEN — the lifetime ceiling', () => {
  withEnv({
    maxLifetimeSeconds: String(PLATFORM_SESSION_CEILING.maxLifetimeSeconds + 1),
    maxIdleSeconds: '900',
  }, () => {
    refusedOnBounds(
      SESSION_BOUND_REFUSAL_REASONS.sessionLifetimeExceedsCeiling,
      'a deployment stating one second more lifetime than G220 permits',
    )
  })
})

test('§4b · and the idle ceiling, which #226 never named because G220 had not supplied it', () => {
  withEnv({
    maxLifetimeSeconds: '28800',
    maxIdleSeconds: String(PLATFORM_SESSION_CEILING.maxIdleSeconds + 1),
  }, () => {
    refusedOnBounds(
      SESSION_BOUND_REFUSAL_REASONS.sessionIdleExceedsCeiling,
      'a deployment stating one second more idle than G220 permits',
    )
  })
})

test('§4c · exactly AT the ceiling is permitted — the boundary, not just past it', () => {
  withEnv({
    maxLifetimeSeconds: String(PLATFORM_SESSION_CEILING.maxLifetimeSeconds),
    maxIdleSeconds: String(PLATFORM_SESSION_CEILING.maxIdleSeconds),
  }, () => {
    assert.equal(
      mintWithPlatformBounds().ok,
      true,
      'a deployment stating EXACTLY the platform ceiling was refused. The comparison is ' +
        '`value > ceilingSeconds`; an off-by-one here would make the documented maximum ' +
        'unusable and every operator would state one second less without knowing why.',
    )
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §5  THE PAIR — both sound, and one can never fire
 * ══════════════════════════════════════════════════════════════════ */

test('§5 · an idle bound that outlives the lifetime is a number the system cannot act on', () => {
  withEnv({ maxLifetimeSeconds: '600', maxIdleSeconds: '1200' }, () => {
    refusedOnBounds(
      SESSION_BOUND_REFUSAL_REASONS.idleExceedsLifetime,
      'an idle bound longer than the lifetime',
    )
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §6  NO PER-TENANT OVERRIDE — R7's second sentence, as an ARITY
 * ══════════════════════════════════════════════════════════════════ */

test('§6 · the reader takes no argument, so there is no position a tenant could occupy', () => {
  assert.equal(
    platformSessionBounds.length,
    0,
    'R7: "session bounds are a PLATFORM-WIDE CONSTANT. No per-tenant override." A reader ' +
      'that took a parameter would have somewhere to put a `TenantId`, and G1610 measured ' +
      'why the override is not merely unconfigured but UNREADABLE: at mint time there is ' +
      'no tenant, by `MintedSession.tenantId: const null` and by design.',
  )
  /* The type-level half is `_PlatformBoundsTakeNoArgument` in the module,
   * VERIFIED RED by adding a `tenantId` parameter (TS2344). This is the
   * runtime half, because a type assertion cannot be witnessed by a test. */
})

test('§6b · and no variable it reads names a tenant', () => {
  for (const field of SESSION_BOUND_FIELDS) {
    const name = SESSION_BOUND_ENV[field]
    assert.ok(
      name.startsWith('RECONCILE_SESSION_'),
      `\`${name}\` is not in the platform namespace. A variable named for a tenant is one ` +
        'somebody will key on a tenant, and R7 says there is no such key.',
    )
  }
})

/* ══════════════════════════════════════════════════════════════════ *
 * §7  THE CEILING NOW HAS A SERVING-PATH READER, WHICH IS R7's OWN
 *     WORDING AND WAS THE MEASURED GAP
 * ══════════════════════════════════════════════════════════════════ */

test('§7 · `PLATFORM_SESSION_CEILING` is consulted by a `server/` path, which it never was', () => {
  withEnv({ maxLifetimeSeconds: String(PLATFORM_SESSION_CEILING.maxLifetimeSeconds + 60) }, () => {
    const verdict = validateSessionBounds(platformSessionBounds())
    assert.equal(verdict.ok, false)
    if (verdict.ok) return
    const ceiling = verdict.refusals.find((r) => r.reason === 'session_lifetime_exceeds_ceiling')
    assert.ok(ceiling, 'the ceiling arm did not fire for a bound a minute past it')
    if (ceiling === undefined || ceiling.reason !== 'session_lifetime_exceeds_ceiling') return
    assert.equal(
      ceiling.ceilingSeconds,
      PLATFORM_SESSION_CEILING.maxLifetimeSeconds,
      'the refusal reported a ceiling other than G220’s constant, so the number an ' +
        'operator is shown is not the number that refused them.',
    )
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §8  THE CONFIGURATION READ IS A READ OF THE SEAM, NEVER THE SEAM
 * ══════════════════════════════════════════════════════════════════ */

test('§8 · `dataPlaneConfig().sessionBoundsUsable` agrees with what a mint would do', async () => {
  const { dataPlaneConfig } = await import('../../server/data-plane/config.ts')
  withEnv({}, () => {
    assert.equal(
      dataPlaneConfig().sessionBoundsUsable,
      false,
      'an unconfigured plane reports its session bounds as usable. The boot line would then ' +
        'tell an operator that sign-in works on a plane that refuses every mint with a 503.',
    )
  })
  withEnv({ maxLifetimeSeconds: '28800', maxIdleSeconds: '900' }, () => {
    assert.equal(
      dataPlaneConfig().sessionBoundsUsable,
      true,
      'a plane stating two sound bounds reports them unusable — the report and the decision ' +
        'have drifted, which is exactly what deriving the report from the same reader avoids.',
    )
  })
})

/* ══════════════════════════════════════════════════════════════════ *
 * §9  THE CENSUS. A ninth arm with no test is a RED GATE.
 * ══════════════════════════════════════════════════════════════════ */

test('§9 · every declared bound refusal has been produced by a real configuration', () => {
  const declared = Object.values(SESSION_BOUND_REFUSAL_REASONS).sort()
  const witnessed = [...WITNESSED].sort()
  assert.deepEqual(
    witnessed,
    declared,
    'a member of `SESSION_BOUND_REFUSAL_REASONS` was not produced by any case in this file. ' +
      'The contract declares all eight BY EXACT NAME on `completeFederatedSignIn`’s 503, ' +
      'so an arm with no reachable configuration is a documented status nothing can return. ' +
      `Missing: [${declared.filter((d) => !witnessed.includes(d)).join(' | ')}]`,
  )
})

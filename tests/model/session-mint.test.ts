/**
 * `mintSession()` — and the type-level defence of invariant 1 at the mint.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE EXISTS FOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Copy it, never paraphrase it: *"Tenant scope is derived from the session,
 * never read from a request."* G315 puts the tenant in the OIDC `state`
 * deliberately, so the breach this file guards against arrives **carrying a
 * ruling's endorsement** — the auth host's grant holds it, a writer stores it,
 * and every reviewer who traces it back finds a decision that looks deliberate.
 *
 * §1 is the whole claim and it is a `@ts-expect-error`: **passing a `tenantId`
 * to `mintSession()` does not compile.**
 *
 * ⚠️ A `@ts-expect-error` IS A CONTROL THAT CAN PASS FOR THE WRONG REASON, AND
 * §1b IS WHY THIS FILE IS NOT §5.6. That directive succeeds if the line has
 * ANY error — a typo in a sibling field, a missing property, a bad cast — so it
 * would keep passing against an input type that carried a `tenantId` happily
 * and merely rejected something else on the same line. §1b mints from the
 * BYTE-IDENTICAL literal with that one property removed and requires
 * `ok: true`, so the only difference between the failing line and the passing
 * one is the property this module exists to refuse.
 *
 * ⚠️ AND `tsc` IS WEAK EVIDENCE IN THIS REPOSITORY, WHICH IS WHY MOST OF THIS
 * FILE CONSTRUCTS VALUES. `CLAUDE.md`: *"a total `Record` only bites where
 * something CONSTRUCTS one, and in a types-only model nothing does … Five total
 * records landed on 7 Aug 2026 with no construction site anywhere."* Every
 * refusal below is produced by calling the function, and every field of the
 * success arm is read back off the returned value.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE FOUR REDS, WITNESSED BY MUTATION BEFORE THIS FILE WAS COMMITTED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Each was applied to `model/session-mint.ts`, compiled with
 * `npx tsc -p model/tsconfig.json --noEmit`, and reverted:
 *
 *   `readonly tenantId: TenantId` on the input
 *       -> TS2344 at `_MintSessionInputCarriesNoTenantId`   (the key proof)
 *       -> TS2344 at `_MintSessionInputReachesNoTenantDeep` (the deep proof)
 *
 *   `readonly tenantId: TenantId | null` on the input
 *       -> TS2344 at BOTH, which is the arm an `extends` leaf test would have
 *          waved through: `TenantId | null extends TenantId` is FALSE.
 *
 *   `readonly surface: ServedSurface` on the input
 *       -> TS2344 at the DEEP proof **and nothing at the shallow one.**
 *          🛑 THIS IS THE MEASUREMENT THE SLICE TURNS ON. The tenant arrives
 *          one level down, inside a value the caller is already holding, under
 *          a key named `surface`; a key check reads green and the mint has a
 *          tenant. Nothing else in this file would have caught it.
 *
 *   deleting `'tenantId'` from the output `Omit`
 *       -> TS2344 at `_MintedSessionFactsReachesNoTenantDeep`
 *       -> AND TS2741 in `mintSession()`'s own return statement, which is the
 *          `Omit`'s second job biting: a field on `Session` that the mint does
 *          not produce is a compile error AT THE MINT.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MINT_SESSION_REFUSALS, mintSession } from '../../model/session-mint.ts'
import type { MintSessionInput, MintSessionRefusal } from '../../model/session-mint.ts'
import type { IdentityConnectionId, SessionId, TenantId, UserId } from '../../model/kernel.ts'
import type { SessionHandleDigest } from '../../model/domain.ts'

/* ------------------------------------------------------------------ *
 * Fixtures — named, so a refusal is about the value and not the shape
 * ------------------------------------------------------------------ */

const SESSION = 'ses_mint_fixture' as SessionId
const SESSION_DIGEST = 'dig_session_fixture' as SessionHandleDigest
const RELAY_DIGEST = 'dig_relay_fixture' as SessionHandleDigest
const MEI = 'usr_ops_mei' as UserId
const DOOR = 'icn_acme_okta' as IdentityConnectionId
/** Their OWN directory, deliberately NOT the door they came through. See §4. */
const OTHER_DOOR = 'icn_partner_entra' as IdentityConnectionId

/** Inside G220's ceiling: 43200 lifetime, 1800 idle. */
const GOOD_BOUNDS = { maxLifetimeSeconds: 28800, maxIdleSeconds: 900 } as const

function input(over: Partial<MintSessionInput> = {}): MintSessionInput {
  return {
    id: SESSION,
    handleDigest: SESSION_DIGEST,
    signInHandleDigest: RELAY_DIGEST,
    consumption: { ok: true, connectionId: DOOR },
    user: { id: MEI, status: 'active', connectionId: DOOR },
    issuedHost: 'ten-acme.us-west-2.reconcileai.app',
    bounds: GOOD_BOUNDS,
    ...over,
  }
}

/* ══════════════════════════════════════════════════════════════════ *
 * §1  INVARIANT 1 — A `tenantId` DOES NOT COMPILE
 * ══════════════════════════════════════════════════════════════════ */

test('§1 a tenantId cannot be passed to mintSession — it is a tsc error, not a review comment', () => {
  const tenant = 'ten_acme' as TenantId

  mintSession({
    id: SESSION,
    handleDigest: SESSION_DIGEST,
    signInHandleDigest: RELAY_DIGEST,
    consumption: { ok: true, connectionId: DOOR },
    user: { id: MEI, status: 'active', connectionId: DOOR },
    issuedHost: 'ten-acme.us-west-2.reconcileai.app',
    bounds: GOOD_BOUNDS,
    // @ts-expect-error invariant 1 — `MintSessionInput` has no `tenantId` field
    // at all, absent rather than null, so a caller carrying G315's `state`
    // forward cannot hand it to the mint. Removing this property makes the
    // identical call compile, which §1b witnesses.
    tenantId: tenant,
  })

  /* The directive above is the assertion. This line exists so the test has a
   * runtime effect and cannot be mistaken for an empty body. */
  assert.equal(typeof tenant, 'string')
})

test('§1b ANTI-VACUITY — the same literal without tenantId compiles and mints', () => {
  const result = mintSession({
    id: SESSION,
    handleDigest: SESSION_DIGEST,
    signInHandleDigest: RELAY_DIGEST,
    consumption: { ok: true, connectionId: DOOR },
    user: { id: MEI, status: 'active', connectionId: DOOR },
    issuedHost: 'ten-acme.us-west-2.reconcileai.app',
    bounds: GOOD_BOUNDS,
  })

  assert.equal(result.ok, true)
})

test('§1c THE LIMIT OF §1, MEASURED RATHER THAN CLAIMED — a spread carries tenantId past the compiler, and the mint discards it', () => {
  /* Excess-property checking is a check on FRESH object literals. Built as a
   * variable first, this compiles with no error at all — so §1 is the legible
   * half of the defence and the output `Omit` is the load-bearing half. Stating
   * that here rather than leaving a reader to believe the key check is total. */
  const smuggled = { ...input(), tenantId: 'ten_globex' as TenantId }

  const result = mintSession(smuggled)

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.session, 'tenantId'),
    false,
    'the minted facts must carry no tenant even when the caller supplied one',
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §2  THE OUTPUT CARRIES NO TENANT, AT RUNTIME
 * ══════════════════════════════════════════════════════════════════ */

test('§2 the minted facts are exactly six keys and none of them is a tenant', () => {
  const result = mintSession(input())
  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.deepEqual(Object.keys(result.session).sort(), [
    'connectionId',
    'handleDigest',
    'id',
    'issuedHost',
    'revokedAt',
    'userId',
  ])
})

test('§2b no timestamp is minted — the writer computes expiry from the bounds, in SQL', () => {
  const result = mintSession(input())
  assert.equal(result.ok, true)
  if (!result.ok) return

  for (const absent of ['authenticatedAt', 'lastUsedAt', 'expiresAt', 'secondFactorAt']) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.session, absent),
      false,
      `${absent} must not be minted — the model reads no clock`,
    )
  }
  /* And the bounds ARE returned, because the writer needs the seconds. */
  assert.deepEqual(result.bounds, { maxLifetimeSeconds: 28800, maxIdleSeconds: 900 })
})

test('§2c revokedAt is STATED as null rather than left to a column default', () => {
  const result = mintSession(input())
  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(
    Object.prototype.hasOwnProperty.call(result.session, 'revokedAt'),
    true,
    'a minted session is not a revoked one, and this module says so rather than defaulting',
  )
  assert.equal(result.session.revokedAt, null)
})

/* ══════════════════════════════════════════════════════════════════ *
 * §3  THE HAPPY PATH — every field read back off the value
 * ══════════════════════════════════════════════════════════════════ */

test('§3 a mint carries the id, the digest and the person through unchanged', () => {
  const result = mintSession(input())
  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.session.id, 'ses_mint_fixture')
  assert.equal(result.session.handleDigest, 'dig_session_fixture')
  assert.equal(result.session.userId, 'usr_ops_mei')
})

/* ══════════════════════════════════════════════════════════════════ *
 * §4  THE DOOR IS THE ATTEMPT'S, AND THE USER'S OWN IS NOT COMPARED
 * ══════════════════════════════════════════════════════════════════ */

test('§4 the session records the door the CONSUMPTION pinned, not the door on the user row', () => {
  const result = mintSession(
    input({
      consumption: { ok: true, connectionId: DOOR },
      user: { id: MEI, status: 'active', connectionId: OTHER_DOOR },
    }),
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.session.connectionId, 'icn_acme_okta')
})

test('§4b THE NON-CHECK IS DELIBERATE — a person whose directory differs from the door still mints', () => {
  /* `Session.connectionId`'s own declaration: *"org is a property of HOW YOU
   * AUTHENTICATED, not of who you are: a dual-affiliated consultant is partner
   * on Monday and customer on Tuesday, and each session has to record which."*
   * An equality check here would read as tightening and would break exactly
   * the case the model was designed to support. This test is what a commit
   * adding one has to delete on purpose. */
  const result = mintSession(
    input({ user: { id: MEI, status: 'active', connectionId: OTHER_DOOR } }),
  )

  assert.equal(result.ok, true)
})

/* ══════════════════════════════════════════════════════════════════ *
 * §5  THE REFUSALS — each produced by a call, each named
 * ══════════════════════════════════════════════════════════════════ */

const REFUSAL_CASES: ReadonlyArray<{
  readonly reason: MintSessionRefusal
  readonly why: string
  readonly input: MintSessionInput
}> = [
  {
    reason: MINT_SESSION_REFUSALS.userDisabled,
    why: 'a disabled person is refused a credential rather than given one that fails on use',
    input: input({ user: { id: MEI, status: 'disabled', connectionId: DOOR } }),
  },
  {
    reason: MINT_SESSION_REFUSALS.sessionHandleReusesSignInHandle,
    why: 'the relay handle travelled in a redirect URL; a session credential equal to it is already written down',
    input: input({ handleDigest: RELAY_DIGEST }),
  },
  {
    reason: MINT_SESSION_REFUSALS.issuedHostNotRecorded,
    why: 'checkHostBinding() answers session_host_not_recorded with revoke:true, so the session would destroy itself on its first request',
    input: input({ issuedHost: '   ' }),
  },
  {
    reason: MINT_SESSION_REFUSALS.sessionBoundsUnusable,
    why: 'G220 is a ceiling and a deployment may tighten it, never loosen it',
    input: input({ bounds: { maxLifetimeSeconds: 86400, maxIdleSeconds: 900 } }),
  },
]

test('§5 every refusal is produced by a real call and named', () => {
  for (const c of REFUSAL_CASES) {
    const result = mintSession(c.input)
    assert.equal(result.ok, false, `expected a refusal: ${c.why}`)
    if (result.ok) continue
    assert.equal(result.refusal, c.reason, c.why)
  }
})

test('§5b CENSUS — a new refusal arm with no case above is a red gate', () => {
  const covered = new Set<string>(REFUSAL_CASES.map((c) => c.reason))
  const declared = Object.values(MINT_SESSION_REFUSALS)

  for (const reason of declared) {
    assert.equal(
      covered.has(reason),
      true,
      `MINT_SESSION_REFUSALS.${reason} is declared and no case in this file produces it`,
    )
  }
  assert.equal(covered.size, declared.length)
})

test('§5c the bounds arm carries its reasons and they are a NON-EMPTY tuple', () => {
  const result = mintSession({
    ...input(),
    bounds: { maxLifetimeSeconds: 86400, maxIdleSeconds: 900 },
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.refusal, 'session_bounds_unusable')
  if (result.refusal !== 'session_bounds_unusable') return

  assert.equal(result.boundRefusals.length > 0, true)
  assert.deepEqual(
    result.boundRefusals.map((r) => r.reason),
    ['session_lifetime_exceeds_ceiling'],
  )
})

test('§5d absent bounds refuse — G139, and today this is the only answer a real mint can give (R7)', () => {
  const result = mintSession({ ...input(), bounds: {} })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.refusal, 'session_bounds_unusable')
  if (result.refusal !== 'session_bounds_unusable') return
  assert.deepEqual(
    result.boundRefusals.map((r) => r.reason),
    ['bounds_not_configured', 'bounds_not_configured'],
  )
})

/* ══════════════════════════════════════════════════════════════════ *
 * §6  THE HOST IS NORMALISED BY THE ONE SEAM, AND STORED THAT WAY
 * ══════════════════════════════════════════════════════════════════ */

test('§6 the stored host is the normalised form, so it equals what checkHostBinding() compares', () => {
  const result = mintSession(input({ issuedHost: '  TEN-Acme.US-West-2.ReconcileAI.app  ' }))

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.session.issuedHost, 'ten-acme.us-west-2.reconcileai.app')
})

test('§6b an empty host refuses — not stored as an empty string that revokes later', () => {
  for (const host of ['', '   ', '\t\n']) {
    const result = mintSession(input({ issuedHost: host }))
    assert.equal(result.ok, false, `host ${JSON.stringify(host)} must refuse`)
    if (result.ok) continue
    assert.equal(result.refusal, 'issued_host_not_recorded')
  }
})

/* ══════════════════════════════════════════════════════════════════ *
 * §7  THE ORDER IS THE DESIGN
 * ══════════════════════════════════════════════════════════════════ */

test('§7 a disabled person is refused as a fact about them, before anything about their input is examined', () => {
  /* Everything else in this input is ALSO wrong: the handle reuses the relay
   * handle, the host is blank, and the bounds are unconfigured. The answer is
   * still `user_disabled`, because the person is asked about first. */
  const result = mintSession({
    ...input(),
    user: { id: MEI, status: 'disabled', connectionId: DOOR },
    handleDigest: RELAY_DIGEST,
    issuedHost: '',
    bounds: {},
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.refusal, 'user_disabled')
})

test('§7b bounds are asked LAST — a sound person with a bad handle answers about the handle', () => {
  const result = mintSession({ ...input(), handleDigest: RELAY_DIGEST, bounds: {} })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.refusal, 'session_handle_reuses_sign_in_handle')
})

/* ══════════════════════════════════════════════════════════════════ *
 * §8  A REFUSED MINT PRODUCES NO SESSION FACTS AT RUNTIME
 * ══════════════════════════════════════════════════════════════════ */

test('§8 a refusal carries no session — a row in a log that nothing revoked', () => {
  for (const c of REFUSAL_CASES) {
    const result = mintSession(c.input)
    assert.equal(result.ok, false)
    if (result.ok) continue
    assert.equal(
      Object.prototype.hasOwnProperty.call(result, 'session'),
      false,
      `${c.reason} must not carry the row it refused to write`,
    )
  }
})

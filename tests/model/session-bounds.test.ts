/**
 * `validateSessionBounds()` — the refuse-on-absence half of #226 [A-4].
 *
 * WHAT THIS FILE EXISTS FOR.
 * `grep -rniE 'idleTimeout|sessionLifetime|sessionTimeout|idle_timeout'
 * model/*.ts | wc -l` returned **0**. `Session.expiresAt` was a field with
 * nothing anywhere in the model to compute it from — no lifetime, no idle
 * bound, no refusal for their absence. MG5 in `docs/model-gaps.md`.
 *
 * 🛑 THE TRAP THIS SUITE ALSO EXISTS TO KEEP SHUT. `MAX_AUTHORIZATION_SECONDS`
 * (`grep -n 'MAX_AUTHORIZATION_SECONDS' model/access.ts`) is a GRANT ceiling
 * keyed by resource class — how long one authorised ACT may live. Reading it as
 * a session clock is §5.1's landmark substitution exactly, and a lapsed-session
 * screen is the surface most likely to reach for it.
 * `test_the_session_module_imports_nothing_so_it_cannot_have_read_the_grant_ceiling`
 * makes that structural rather than a review convention.
 *
 * ⚠️ WHAT THE FIRST RED PROVED, AND WHAT IT DID NOT. `model/session.ts` did not
 * exist when this file was written, so the only red available was ABSENCE:
 * `TS2307: Cannot find module '../../model/session.ts'`. An import error proves
 * nothing about behaviour — the same discipline
 * `tests/model/managed-service.test.ts` states for itself. Every assertion
 * below was therefore additionally proved to BITE by mutation once the
 * implementation existed; the mutations and the test each caught are recorded
 * in the block at the foot of this file.
 *
 * ⚠️ G220 SUPPLIED TWO INTEGERS AND THEY ARE A CEILING, NOT A DEFAULT.
 * `maxLifetimeSeconds = 43200` and `maxIdleSeconds = 1800` are a PLATFORM
 * FLOOR — a deployment may configure tighter bounds and may not configure
 * looser ones. G139 still forbids a default, so absence still refuses, and
 * `test_absent_bounds_are_not_silently_filled_in_from_the_platform_ceiling` is
 * the control that stops the ceiling quietly becoming one.
 *
 * Every expected value below is a literal typed into this file, for the reason
 * `tests/model/access-decide.test.ts` gives: comparing a constant to itself
 * passes forever and witnesses nothing.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PLATFORM_SESSION_CEILING,
  SESSION_BOUND_FIELDS,
  SESSION_BOUND_REFUSAL_REASONS,
  validateSessionBounds,
} from '../../model/session.ts'
import type {
  SessionBoundRefusal,
  SessionBoundsInput,
} from '../../model/session.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * The reasons a call actually produced, in order. Named rather than counted:
 * `assert.equal(refusals.length, 1)` passes for a refusal with the wrong reason
 * in it.
 */
function reasonsOf(input: SessionBoundsInput): readonly string[] {
  const result = validateSessionBounds(input)
  if (result.ok) return []
  return result.refusals.map((refusal: SessionBoundRefusal) => refusal.reason)
}

function fieldsOf(input: SessionBoundsInput): readonly string[] {
  const result = validateSessionBounds(input)
  if (result.ok) return []
  return result.refusals.map((refusal: SessionBoundRefusal) => refusal.field)
}

/* A pair that satisfies every arm with room to spare — one hour of life, a
 * quarter hour of idle — so no test below sits on a boundary by accident. The
 * boundaries get tests of their own. */
const wellInside = { maxLifetimeSeconds: 3600, maxIdleSeconds: 900 } as const

/* ------------------------------------------------------------------ *
 * 1. Absence — the whole point of the slice
 * ------------------------------------------------------------------ */

test('test_a_session_cannot_be_minted_when_the_bounds_are_unconfigured', () => {
  const result = validateSessionBounds({})
  assert.equal(result.ok, false)
  assert.deepEqual(reasonsOf({}), ['bounds_not_configured', 'bounds_not_configured'])
  /* BOTH fields named, not just the first. A validator that stops at the first
   * absent bound tells a deployer to set one number and refuses again. */
  assert.deepEqual(fieldsOf({}), ['maxLifetimeSeconds', 'maxIdleSeconds'])
})

test('test_an_absent_lifetime_alone_refuses_and_names_only_that_field', () => {
  const input = { maxIdleSeconds: 900 }
  assert.deepEqual(reasonsOf(input), ['bounds_not_configured'])
  assert.deepEqual(fieldsOf(input), ['maxLifetimeSeconds'])
})

test('test_an_absent_idle_bound_alone_refuses_and_names_only_that_field', () => {
  const input = { maxLifetimeSeconds: 3600 }
  assert.deepEqual(reasonsOf(input), ['bounds_not_configured'])
  assert.deepEqual(fieldsOf(input), ['maxIdleSeconds'])
})

test('test_an_explicit_undefined_is_absence_not_a_stated_value', () => {
  /* `Number(process.env.X)` on an unset variable yields NaN; a config reader
   * that spreads an object yields `undefined`. Both arrive, and they are
   * different defects — this pins the second. */
  const input: SessionBoundsInput = { maxLifetimeSeconds: undefined, maxIdleSeconds: 900 }
  assert.deepEqual(reasonsOf(input), ['bounds_not_configured'])
})

test('test_absent_bounds_are_not_silently_filled_in_from_the_platform_ceiling', () => {
  /* 🛑 THE ANTI-DEFAULT CONTROL. G139: a bound with no number is not a bound.
   * G220 supplied two integers as a CEILING; the failure this guards is those
   * two integers quietly becoming the fallback, at which point absence stops
   * being visible and nobody ever discovers the number was never chosen. */
  const result = validateSessionBounds({})
  assert.equal(result.ok, false)
  assert.equal('bounds' in result, false)
})

/* ------------------------------------------------------------------ *
 * 2. Zero, minus one and NaN — three defects, three reasons
 *
 * They fail for genuinely different reasons and the issue requires each to have
 * its own named case:
 *   NaN  every comparison against it is false, so a NaN bound never expires
 *        anything. It fails OPEN, which is the dangerous one.
 *   -1   expires every session before it is minted. Fails closed, nonsensically.
 *   0    is what a missing integer reads as in most config parsers, so it is
 *        absence wearing a value's clothes.
 * ------------------------------------------------------------------ */

test('test_a_lifetime_of_zero_refuses_with_its_own_reason', () => {
  assert.deepEqual(reasonsOf({ maxLifetimeSeconds: 0, maxIdleSeconds: 900 }), ['bound_zero'])
})

test('test_a_lifetime_of_minus_one_refuses_with_its_own_reason', () => {
  assert.deepEqual(reasonsOf({ maxLifetimeSeconds: -1, maxIdleSeconds: 900 }), ['bound_negative'])
})

test('test_a_lifetime_of_nan_refuses_with_its_own_reason', () => {
  assert.deepEqual(
    reasonsOf({ maxLifetimeSeconds: Number.NaN, maxIdleSeconds: 900 }),
    ['bound_not_a_number'],
  )
})

test('test_an_idle_bound_of_zero_refuses_with_its_own_reason', () => {
  assert.deepEqual(reasonsOf({ maxLifetimeSeconds: 3600, maxIdleSeconds: 0 }), ['bound_zero'])
  assert.deepEqual(fieldsOf({ maxLifetimeSeconds: 3600, maxIdleSeconds: 0 }), ['maxIdleSeconds'])
})

test('test_an_idle_bound_of_minus_one_refuses_with_its_own_reason', () => {
  assert.deepEqual(reasonsOf({ maxLifetimeSeconds: 3600, maxIdleSeconds: -1 }), ['bound_negative'])
})

test('test_an_idle_bound_of_nan_refuses_with_its_own_reason', () => {
  assert.deepEqual(
    reasonsOf({ maxLifetimeSeconds: 3600, maxIdleSeconds: Number.NaN }),
    ['bound_not_a_number'],
  )
})

test('test_an_infinite_lifetime_is_refused_rather_than_read_as_a_very_long_one', () => {
  /* `Number('Infinity')` parses. Under a naive `> 0` guard it sails through and
   * the session never expires — the same fail-open shape as NaN. */
  assert.deepEqual(
    reasonsOf({ maxLifetimeSeconds: Number.POSITIVE_INFINITY, maxIdleSeconds: 900 }),
    ['bound_not_a_number'],
  )
})

test('test_a_fractional_lifetime_refuses_rather_than_truncating_silently', () => {
  assert.deepEqual(
    reasonsOf({ maxLifetimeSeconds: 3600.5, maxIdleSeconds: 900 }),
    ['bound_not_an_integer'],
  )
})

test('test_two_bad_bounds_are_both_reported_rather_than_the_first_one_only', () => {
  assert.deepEqual(
    reasonsOf({ maxLifetimeSeconds: 0, maxIdleSeconds: Number.NaN }),
    ['bound_zero', 'bound_not_a_number'],
  )
})

/* ------------------------------------------------------------------ *
 * 3. The platform ceiling — G220's two integers
 * ------------------------------------------------------------------ */

test('test_the_platform_ceiling_states_g220s_two_integers', () => {
  /* Literals typed here, not read from the module twice. Twelve hours — a
   * working day with one re-authentication — and thirty minutes. */
  assert.equal(PLATFORM_SESSION_CEILING.maxLifetimeSeconds, 43200)
  assert.equal(PLATFORM_SESSION_CEILING.maxIdleSeconds, 1800)
})

test('test_the_ceiling_covers_exactly_the_two_declared_bound_fields', () => {
  assert.deepEqual([...SESSION_BOUND_FIELDS], ['maxLifetimeSeconds', 'maxIdleSeconds'])
  assert.deepEqual(Object.keys(PLATFORM_SESSION_CEILING).sort(), [
    'maxIdleSeconds',
    'maxLifetimeSeconds',
  ])
})

test('test_a_lifetime_above_the_platform_ceiling_is_refused_and_carries_the_ceiling', () => {
  const result = validateSessionBounds({ maxLifetimeSeconds: 43201, maxIdleSeconds: 900 })
  assert.equal(result.ok, false)
  if (result.ok) return
  const [refusal] = result.refusals
  assert.deepEqual(refusal, {
    reason: 'session_lifetime_exceeds_ceiling',
    field: 'maxLifetimeSeconds',
    ceilingSeconds: 43200,
  })
})

test('test_an_idle_bound_above_the_platform_ceiling_is_refused_and_carries_the_ceiling', () => {
  const result = validateSessionBounds({ maxLifetimeSeconds: 3600, maxIdleSeconds: 1801 })
  assert.equal(result.ok, false)
  if (result.ok) return
  const [refusal] = result.refusals
  assert.deepEqual(refusal, {
    reason: 'session_idle_exceeds_ceiling',
    field: 'maxIdleSeconds',
    ceilingSeconds: 1800,
  })
})

test('test_the_ceiling_itself_is_admitted_so_the_bound_is_a_ceiling_and_not_a_wall', () => {
  const result = validateSessionBounds({ maxLifetimeSeconds: 43200, maxIdleSeconds: 1800 })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.bounds, { maxLifetimeSeconds: 43200, maxIdleSeconds: 1800 })
})

test('test_bounds_tighter_than_the_platform_ceiling_are_admitted', () => {
  const result = validateSessionBounds(wellInside)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.bounds, { maxLifetimeSeconds: 3600, maxIdleSeconds: 900 })
})

test('test_a_one_second_pair_is_admitted_because_tightening_is_always_permitted', () => {
  const result = validateSessionBounds({ maxLifetimeSeconds: 1, maxIdleSeconds: 1 })
  assert.equal(result.ok, true)
})

/* ------------------------------------------------------------------ *
 * 4. The two bounds against each other
 * ------------------------------------------------------------------ */

test('test_an_idle_bound_longer_than_the_lifetime_is_refused_as_unreachable', () => {
  /* Both are individually inside the ceiling. An idle bound that can never fire
   * before the lifetime does is a number the system holds and cannot act on —
   * G220's own argument for keeping `lastUsedAt` on the row, one layer up. */
  const result = validateSessionBounds({ maxLifetimeSeconds: 600, maxIdleSeconds: 1800 })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.deepEqual(result.refusals, [
    { reason: 'idle_exceeds_lifetime', field: 'maxIdleSeconds' },
  ])
})

test('test_an_idle_bound_equal_to_the_lifetime_is_admitted', () => {
  const result = validateSessionBounds({ maxLifetimeSeconds: 900, maxIdleSeconds: 900 })
  assert.equal(result.ok, true)
})

/* ------------------------------------------------------------------ *
 * 5. Closure and the landmark trap
 * ------------------------------------------------------------------ */

test('test_every_declared_refusal_reason_is_reachable_from_a_real_call', () => {
  const inputs: readonly SessionBoundsInput[] = [
    {},
    { maxLifetimeSeconds: Number.NaN, maxIdleSeconds: 900 },
    { maxLifetimeSeconds: 3600.5, maxIdleSeconds: 900 },
    { maxLifetimeSeconds: 0, maxIdleSeconds: 900 },
    { maxLifetimeSeconds: -1, maxIdleSeconds: 900 },
    { maxLifetimeSeconds: 43201, maxIdleSeconds: 900 },
    { maxLifetimeSeconds: 3600, maxIdleSeconds: 1801 },
    { maxLifetimeSeconds: 600, maxIdleSeconds: 1800 },
  ]
  const reached = new Set<string>()
  for (const input of inputs) for (const reason of reasonsOf(input)) reached.add(reason)
  /* A declared arm nothing can produce is a refusal that will never be seen —
   * and an arm produced but never declared is a wire name nothing mirrors. */
  assert.deepEqual(
    [...reached].sort(),
    [...Object.values(SESSION_BOUND_REFUSAL_REASONS)].sort(),
  )
})

test('test_the_session_module_imports_nothing_so_it_cannot_have_read_the_grant_ceiling', () => {
  const source = readFileSync(join(REPO_ROOT, 'model', 'session.ts'), 'utf8')
  /* Structural, not a review convention: with no module specifier at all there
   * is no path by which `MAX_AUTHORIZATION_SECONDS` could have been read. */
  const specifiers = source.match(/^(?:import|export)[^\n]*\bfrom\s+'/gm)
  assert.equal(specifiers, null)
  /* And the trap is named on the file, per #226's acceptance list, so the next
   * reader meets it before reaching for it. */
  assert.ok(source.includes('MAX_AUTHORIZATION_SECONDS'))
  assert.ok(source.includes("grep -n 'MAX_AUTHORIZATION_SECONDS' model/access.ts"))
})

test('test_the_grant_ceiling_and_the_session_ceiling_are_not_the_same_numbers', () => {
  /* The literal is `MAX_AUTHORIZATION_SECONDS.identity` at model/access.ts,
   * typed out rather than imported. If a future edit ever made the session
   * lifetime equal a grant ceiling, that coincidence would make the landmark
   * substitution invisible to review. */
  assert.notEqual(PLATFORM_SESSION_CEILING.maxLifetimeSeconds, 900)
  assert.notEqual(PLATFORM_SESSION_CEILING.maxIdleSeconds, 900)
})

/* ====================================================================
 * MUTATION LOG — what each assertion above was proved to catch
 *
 * The first red here was `TS2307: Cannot find module '../../model/session.ts'`,
 * which proves the import and nothing about behaviour. So every arm of
 * `validateSessionBounds()` was mutated to the plausible wrong thing, exactly
 * the named tests below were watched to go red, and the change was reverted.
 *
 * 🛑 `npx tsc -p model/tsconfig.json --noEmit` STAYED GREEN THROUGH ALL NINE.
 * That is not a footnote — it is CLAUDE.md's §5.10 warning arriving in the one
 * slice it was written for. The compiler had nothing to say about any of these,
 * including M4 and M8, which are the two that would have mattered.
 *
 *   M1  Delete the `value === 0` arm, so zero falls through to the ceiling test
 *       and is ADMITTED.
 *       → 4 red: both `..._of_zero_refuses_with_its_own_reason` tests, the
 *          two-bad-bounds test, and the reason-closure test. The closure test
 *          is the one that matters here: it catches a DECLARED arm nothing can
 *          produce, which review does not.
 *
 *   M2  `!Number.isFinite(value)` → `Number.isNaN(value)`, so `Infinity`
 *       survives every guard and is read as a very long session.
 *       → 1 red: `test_an_infinite_lifetime_is_refused_rather_than_read_as_a_
 *          very_long_one`, alone — which is the proof that the NaN tests do NOT
 *          cover Infinity and the separate case earns its place.
 *
 *   M3  Ceiling comparison `value > ceilingSeconds` → `>=`, turning G220's
 *       ceiling into a wall the configuration may approach and not reach.
 *       → 3 red, and the third is instructive:
 *          `..._the_bound_is_a_ceiling_and_not_a_wall` and the closure test as
 *          expected, plus `..._idle_bound_longer_than_the_lifetime_is_refused_
 *          as_unreachable`, because its idle value of 1800 sits ON the ceiling
 *          and is refused one arm earlier. The cross-bound fixture therefore
 *          depends on the ceiling arm being `>`; noted so a future edit does not
 *          read that red as unrelated.
 *
 *   M4  🛑 THE ONE THIS SLICE EXISTS FOR. Absence returns
 *       `{ ok: true, seconds: PLATFORM_SESSION_CEILING[field] }` — the ceiling
 *       quietly becoming a default, which is precisely what G139 forbids and
 *       precisely what a hurried reader would think reasonable.
 *       → 6 red, including `..._are_not_silently_filled_in_from_the_platform_
 *          ceiling`. `tsc` green. Nothing else in this repository catches it.
 *
 *   M5  Delete the combined `!lifetime.ok && !idle.ok` arm, so only the first
 *       bad bound is reported.
 *       → 2 red: the unconfigured test (which asserts BOTH fields are named)
 *          and the two-bad-bounds test. A deployer under the mutant states one
 *          number, redeploys, and is refused again for the other.
 *
 *   M6  Cross-bound comparison `idle > lifetime` → `>=`, so an idle bound equal
 *       to the lifetime is refused.
 *       → 2 red, and the second is the useful one: the `1`/`1` pair. A one-second
 *          pair is legitimate — tightening is always permitted — and under the
 *          mutant the strictest expressible posture becomes unsatisfiable.
 *
 *   M7  `maxLifetimeSeconds: 43200` → `28800`, the eight-hour alternative G220
 *       explicitly REFUSED.
 *       → 3 red. The literal is pinned, so a later edit cannot quietly adopt a
 *          rejected alternative.
 *
 *   M8  🛑 THE LANDMARK SUBSTITUTION, PERFORMED. Import
 *       `MAX_AUTHORIZATION_SECONDS` from `./access.ts` and read `.identity` as
 *       the session lifetime — §5.1 exactly, and the defect #226 names by number.
 *       → 11 red, including both tests that exist for it: the structural
 *          no-imports test and `..._are_not_the_same_numbers`. `tsc` green,
 *          because a grant ceiling and a session ceiling are both `number`.
 *
 *   M9  Delete the `idle_exceeds_lifetime` arm.
 *       → 2 red: its own test and the closure test.
 * ==================================================================== */

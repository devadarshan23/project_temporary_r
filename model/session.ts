/**
 * ReconcileAI — session bounds. G220 and G225, 22 Aug 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS MODULE EXISTS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `Session.expiresAt` was a field with nothing in the model to compute it from.
 * MG5, `docs/model-gaps.md`: *"no idle timeout and no session lifetime
 * anywhere"* —
 *
 *     grep -rniE 'idleTimeout|sessionLifetime|sessionTimeout|idle_timeout' \
 *       model/*.ts | wc -l                                              → 0
 *
 * A session with no bound is a scope with no end, and invariant 1 derives
 * tenant scope FROM the session — so the scope outlives the authority that
 * granted it. That is the whole argument for this file.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE LANDMARK TRAP, NAMED HERE BECAUSE IT IS THE ONE PEOPLE REACH FOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 *     grep -n 'MAX_AUTHORIZATION_SECONDS' model/access.ts
 *
 * `MAX_AUTHORIZATION_SECONDS` is a GRANT ceiling keyed by resource class, and
 * its own docblock says what it bounds: *"a single authorised act, and the
 * right unit is the time one act plausibly takes"*. A session is not an act. It
 * is a period during which a human works, and its exposure is not *"how long
 * does a mis-issued artefact stay live"* but *"how long does a stolen handle
 * remain useful"*. Reading one as the other is `docs/HANDOFF.md` §5.1's
 * landmark substitution exactly — a rule keyed on a convenient nearby constant
 * instead of the property it protects — and a lapsed-session screen is the
 * surface most likely to make it.
 *
 * 🛑 THIS MODULE IMPORTS NOTHING, AND THAT IS THE ENFORCEMENT. There is no
 * module specifier anywhere below, so there is no path by which the grant
 * ceiling could be read here even by accident.
 * `tests/model/session-bounds.test.ts` asserts the absence against the file's
 * own bytes rather than trusting this sentence.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY A NEW MODULE — G225
 * ══════════════════════════════════════════════════════════════════════════
 *
 * #226's landing slot named `model/access.ts`. G225 permits a new module in
 * `model/` instead, and the trap above is the reason to take it: `access.ts` is
 * where `MAX_AUTHORIZATION_SECONDS` lives, and putting a session clock in the
 * same file as the grant ceiling it must not be confused with is a filing
 * decision that makes the confusion easier. A separate file with no imports
 * makes it structurally impossible.
 *
 * Two obligations travel with any new module here and both are met:
 * a VALUE import must carry its `.ts` extension (there are no imports at all,
 * so the obligation is satisfied vacuously and stays satisfied only while that
 * is true), and `MODULE_COUNT` in `tests/model/runtime-importability.test.ts`
 * moved with this file rather than being left to fail.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IS DELIBERATELY NOT HERE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 NO EXPIRY COMPARISON, AND NO TIMESTAMP. #226 asks for a timestamp codec
 * as well and this file does not contain one — it is the issue's other half and
 * it is out of scope here on purpose, not by oversight. `Timestamp` is a string
 * alias, so `session.expiresAt <= now` compares LEXICALLY: correct for ISO-8601
 * in UTC with fixed fractional digits and silently wrong for anything else,
 * while the migration declares `timestamptz` and the hand-written `pg` shim
 * types result values as `unknown`. Nobody has verified what the driver
 * returns. That belongs in one codec module with one call site — G111's shape —
 * covering the ROW's timestamps as well as the parameter's, and it is not
 * started. **Do not add a comparison to this file; add the codec.**
 *
 * NO STORAGE SHAPE. G220 rules that `lastUsedAt` STAYS on the session row —
 * without it there is nothing to compare the clock against and `maxIdleSeconds`
 * becomes a number the system holds and cannot act on. That is a decision about
 * a table and a row, and this module declares neither.
 */

/* ------------------------------------------------------------------ *
 * 1. The bounds
 * ------------------------------------------------------------------ */

/**
 * The two numbers a deployment must state before any session can be minted.
 *
 * ⚠️ REQUIRED, NON-NULL AND UNDEFAULTED. The same discipline
 * `IdentifierNormalisation.maxInputChars` states for itself under G139: *"a
 * bound with no number is not a bound … It is never silently unbounded, which
 * is the outcome a default would produce."* `SessionBoundsInput` below is the
 * shape a configuration reader hands in, where either may be missing; this is
 * the shape that survives `validateSessionBounds()`, where neither can be.
 */
export interface SessionBounds {
  /** Absolute wall-clock life of a session, in seconds. */
  readonly maxLifetimeSeconds: number
  /** Permitted gap between uses before the session lapses, in seconds. */
  readonly maxIdleSeconds: number
}

/**
 * What a configuration reader actually produces. Either key may be missing and
 * either may be present-and-`undefined` — `Number(process.env.X)` on an unset
 * variable yields `NaN`, a spread of a partial object yields `undefined`, and
 * the two are different defects with different reasons below.
 *
 * ⚠️ `| undefined` is written explicitly because `exactOptionalPropertyTypes`
 * is on: without it, `{ maxLifetimeSeconds: undefined }` would not type-check
 * and the commonest real input would be unrepresentable.
 */
export interface SessionBoundsInput {
  readonly maxLifetimeSeconds?: number | undefined
  readonly maxIdleSeconds?: number | undefined
}

export const SESSION_BOUND_FIELDS = ['maxLifetimeSeconds', 'maxIdleSeconds'] as const

export type SessionBoundField = (typeof SESSION_BOUND_FIELDS)[number]

type Assert<T extends true> = T

/**
 * The array above and the interface are two lists of the same thing, so they
 * are pinned to each other. A third bound added to `SessionBounds` and not to
 * the array is a compile error here rather than a field nothing validates.
 */
export type _SessionBoundFieldsAreExactlyTheBoundsKeys = Assert<
  SessionBoundField extends keyof SessionBounds
    ? keyof SessionBounds extends SessionBoundField
      ? true
      : false
    : false
>

/* ------------------------------------------------------------------ *
 * 2. The platform ceiling — G220
 * ------------------------------------------------------------------ */

/**
 * G220's two integers, 22 Aug 2026.
 *
 * 🛑 A CEILING, NOT A DEFAULT, AND THE DIFFERENCE IS THE WHOLE RULING.
 * `validateSessionBounds()` never reads these when a bound is absent — absence
 * refuses. It reads them only to reject a bound that is LOOSER than the
 * platform permits. A deployment may tighten and may not loosen.
 *
 *   `maxLifetimeSeconds` 43200 — twelve hours. A working day with one
 *                                re-authentication. 8h was refused because more
 *                                re-authentications push people toward keeping
 *                                sessions alive artificially, which defeats the
 *                                bound it tightens; 24h because a stolen handle
 *                                would stay useful for a full day.
 *   `maxIdleSeconds`      1800 — thirty minutes. 15m and 60m were the refused
 *                                alternatives, for the same two reasons.
 *
 * ⚠️ A PLATFORM FLOOR, NOT A CUSTOMER SETTING. If a tenant is ever permitted to
 * tighten these per-tenant, that is a separate ruling under G139's
 * FDE-set-bounds discipline and it is not this constant.
 *
 * TOTAL BY CONSTRUCTION, like `CAPABILITY_RESOURCE_CLASS` — and unlike most
 * total records in `model/`, this one BITES, because this module constructs it
 * one line below. A third bound with no ceiling is a compile error here, not a
 * bound that inherits whichever number was written first.
 */
export const PLATFORM_SESSION_CEILING: Record<SessionBoundField, number> = {
  maxLifetimeSeconds: 43200,
  maxIdleSeconds: 1800,
}

/* ------------------------------------------------------------------ *
 * 3. The closed refusal union
 * ------------------------------------------------------------------ */

/**
 * Every way a stated pair of bounds can fail to be a pair of bounds.
 *
 * CLOSED, and each arm is a different failure with a different argument. When
 * the session wire lands, these names mirror onto it EXACTLY — #226: *"when the
 * session wire lands, `session_lifetime_unconfigured` mirrors the model arm by
 * exact name"* — so renaming one here is a wire change.
 */
export const SESSION_BOUND_REFUSAL_REASONS = {
  /** The field is absent, or present and `undefined`. G139's whole point. */
  boundsNotConfigured: 'bounds_not_configured',
  /**
   * `NaN` or `±Infinity`. THE DANGEROUS ONE: every comparison against `NaN` is
   * false, so a `NaN` bound expires nothing and fails OPEN — and `Infinity`
   * parses out of a config string and sails through any naive `> 0` guard to
   * the same place.
   */
  boundNotANumber: 'bound_not_a_number',
  /** Fractional seconds. Refused rather than truncated toward a number nobody stated. */
  boundNotAnInteger: 'bound_not_an_integer',
  /**
   * Exactly `0`. Absence wearing a value's clothes — it is what a missing
   * integer reads as in most configuration parsers, and as a bound it means no
   * session may live at all.
   */
  boundZero: 'bound_zero',
  /** Negative. Expires every session before it is minted; fails closed, nonsensically. */
  boundNegative: 'bound_negative',
  /** Looser than G220 permits. Named by #226 by exact name. */
  sessionLifetimeExceedsCeiling: 'session_lifetime_exceeds_ceiling',
  /**
   * The sibling of the arm above. #226 named only the lifetime one because G220
   * had not yet supplied the idle number when the issue was filed; G220 supplies
   * both, so both need an arm.
   */
  sessionIdleExceedsCeiling: 'session_idle_exceeds_ceiling',
  /**
   * Both bounds individually valid, and the idle bound can never fire before
   * the lifetime does. A bound that cannot be reached is a number the system
   * holds and cannot act on — G220's own argument for keeping `lastUsedAt`,
   * one layer up.
   */
  idleExceedsLifetime: 'idle_exceeds_lifetime',
} as const

export type SessionBoundRefusalReason =
  (typeof SESSION_BOUND_REFUSAL_REASONS)[keyof typeof SESSION_BOUND_REFUSAL_REASONS]

/**
 * ⚠️ EVERY ARM CARRIES `field`, AND NONE CARRIES FREE TEXT. The field is a
 * literal union, never a bare `string`, so a refusal can be logged, mirrored to
 * the wire and rendered without carrying anything a caller supplied.
 */
export type SessionBoundRefusal =
  | { readonly reason: 'bounds_not_configured'; readonly field: SessionBoundField }
  | { readonly reason: 'bound_not_a_number'; readonly field: SessionBoundField }
  | { readonly reason: 'bound_not_an_integer'; readonly field: SessionBoundField }
  | { readonly reason: 'bound_zero'; readonly field: SessionBoundField }
  | { readonly reason: 'bound_negative'; readonly field: SessionBoundField }
  | {
      readonly reason: 'session_lifetime_exceeds_ceiling'
      readonly field: 'maxLifetimeSeconds'
      readonly ceilingSeconds: number
    }
  | {
      readonly reason: 'session_idle_exceeds_ceiling'
      readonly field: 'maxIdleSeconds'
      readonly ceilingSeconds: number
    }
  | { readonly reason: 'idle_exceeds_lifetime'; readonly field: 'maxIdleSeconds' }

export type _SessionBoundRefusalReasonsAreExhaustive = Assert<
  SessionBoundRefusal['reason'] extends SessionBoundRefusalReason
    ? SessionBoundRefusalReason extends SessionBoundRefusal['reason']
      ? true
      : false
    : false
>

/**
 * ⚠️ THE REFUSED ARM CARRIES A NON-EMPTY TUPLE, NOT AN ARRAY. `{ ok: false;
 * refusals: [] }` — a refusal with no reason in it — is unrepresentable, so a
 * caller that renders the first reason cannot be handed nothing to render.
 */
export type SessionBoundsResult =
  | { readonly ok: true; readonly bounds: SessionBounds }
  | {
      readonly ok: false
      readonly refusals: readonly [SessionBoundRefusal, ...SessionBoundRefusal[]]
    }

/* ------------------------------------------------------------------ *
 * 4. The validator
 * ------------------------------------------------------------------ */

type BoundCheck =
  | { readonly ok: true; readonly seconds: number }
  | { readonly ok: false; readonly refusal: SessionBoundRefusal }

/**
 * One bound, checked in the order the failures matter.
 *
 * `Number.isFinite` before `Number.isInteger` deliberately: both reject `NaN`,
 * and reporting `NaN` as a non-integer would be true and useless. The
 * fail-open case gets its own name.
 */
function checkBound(field: SessionBoundField, value: number | undefined): BoundCheck {
  if (value === undefined) {
    return { ok: false, refusal: { reason: 'bounds_not_configured', field } }
  }
  if (!Number.isFinite(value)) {
    return { ok: false, refusal: { reason: 'bound_not_a_number', field } }
  }
  if (!Number.isInteger(value)) {
    return { ok: false, refusal: { reason: 'bound_not_an_integer', field } }
  }
  if (value === 0) {
    return { ok: false, refusal: { reason: 'bound_zero', field } }
  }
  if (value < 0) {
    return { ok: false, refusal: { reason: 'bound_negative', field } }
  }
  const ceilingSeconds = PLATFORM_SESSION_CEILING[field]
  if (value > ceilingSeconds) {
    return {
      ok: false,
      refusal:
        field === 'maxLifetimeSeconds'
          ? { reason: 'session_lifetime_exceeds_ceiling', field, ceilingSeconds }
          : { reason: 'session_idle_exceeds_ceiling', field, ceilingSeconds },
    }
  }
  return { ok: true, seconds: value }
}

/**
 * The only way to obtain a `SessionBounds`.
 *
 * Total; never throws; reads no clock and no environment. With no numbers
 * stated it refuses, which means no session can be minted — **that is the
 * intended failure, not a regression.** G139: the alternative, a default, is a
 * silently-unbounded session nobody would ever discover was never chosen.
 *
 * BOTH BOUNDS ARE REPORTED, not just the first. A validator that stops at the
 * first absent bound tells a deployer to state one number and then refuses
 * again for the other.
 */
export function validateSessionBounds(input: SessionBoundsInput): SessionBoundsResult {
  const lifetime = checkBound('maxLifetimeSeconds', input.maxLifetimeSeconds)
  const idle = checkBound('maxIdleSeconds', input.maxIdleSeconds)

  if (!lifetime.ok && !idle.ok) {
    return { ok: false, refusals: [lifetime.refusal, idle.refusal] }
  }
  if (!lifetime.ok) return { ok: false, refusals: [lifetime.refusal] }
  if (!idle.ok) return { ok: false, refusals: [idle.refusal] }

  /* Only reachable once both bounds are individually sound, which is why it is
   * a separate arm rather than a clause inside `checkBound`: an idle bound
   * cannot be compared against a lifetime that is itself `NaN`. */
  if (idle.seconds > lifetime.seconds) {
    return { ok: false, refusals: [{ reason: 'idle_exceeds_lifetime', field: 'maxIdleSeconds' }] }
  }

  return {
    ok: true,
    bounds: { maxLifetimeSeconds: lifetime.seconds, maxIdleSeconds: idle.seconds },
  }
}

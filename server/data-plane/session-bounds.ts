/**
 * THE PLATFORM SESSION BOUNDS READER — W3/R7, G2121–G2124, 25 Sep 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 NOBODY CAN SIGN IN AFTER THIS FILE LANDS, AND THAT IS THE CORRECT STATE.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This module mounts nothing, routes nothing and writes nothing. It is the
 * READER the one G220 constant has never had on a serving path, and its whole
 * effect is that `mintSession()` can now be reached with numbers somebody
 * chose. **R1 — the D6 threat model — is an OPEN OWNER'S RULING**, so
 * `completeFederatedSignIn` is mounted nowhere and the served set is unchanged
 * by this slice. `server/data-plane/run-worker.ts` states the same shape in the
 * same capitals for the same reason: *a seam that does nothing is not a bug
 * when the thing that would call it is behind a ruling.*
 *
 * ══════════════════════════════════════════════════════════════════════════
 * R7, THE OWNER'S RULING OF 25 Sep 2026
 * ══════════════════════════════════════════════════════════════════════════
 *
 *     "Session bounds are a PLATFORM-WIDE CONSTANT. No per-tenant override."
 *
 * That is `docs/build/d6-threat-model.md` D6-10 option **(a)** — *"Platform-wide,
 * from configuration"* — and that row already predicted the mechanical
 * consequence in the words this slice is measured against: *"`validateSessionBounds()`
 * already refuses on absence rather than defaulting — G139 — so the 503 arms
 * become reachable with no new mechanism."*
 *
 * 🛑 **HALF OF R7 WAS DECIDED BY INVARIANT 1 RATHER THAN BY PREFERENCE, AND
 * G1610 FOUND IT BEFORE THE OWNER RULED.** Copy the invariant, never paraphrase
 * it — `CLAUDE.md` is the only place the eleven are numbered:
 *
 *     "Tenant scope is derived from the session, never read from a request."
 *
 * At a mint there IS no tenant — `MintedSession.tenantId` is `const: null` and
 * `MintSessionInput` has no `tenantId` field at all — so a per-tenant session
 * bound is not merely unconfigured, **it is unreadable**: the act that would
 * consult one has nothing to key on. A per-tenant bound could only be applied
 * at tenant BINDING, which is `selectTenantForSession()`'s act, and it would
 * then be SHORTENING a session that already exists. The owner's *"no per-tenant
 * override"* and the model's own shape agree, and they agree for different
 * reasons; this header records both so the next reader does not reopen one
 * having only met the other.
 *
 * ⚠️ **THE "NO PER-TENANT OVERRIDE" HALF IS HELD BY AN ARITY AND NOT BY A
 * COMMENT.** `platformSessionBounds()` takes **no parameter at all**, so there
 * is no position a `TenantId` could occupy, and
 * `_PlatformBoundsTakeNoArgument` below makes adding one a `TS2344` rather
 * than a review comment. That is `model/session-mint.ts`'s discipline — *"an
 * absent field cannot be set by anyone"* — applied to a parameter list instead
 * of to an interface.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS READER MINTS NO DEFAULT, AND THAT IS THE WHOLE OF WHY IT IS SAFE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `PLATFORM_SESSION_CEILING` is a **CEILING, NOT A DEFAULT**, and its own
 * declaration says so in capitals: *"`validateSessionBounds()` never reads
 * these when a bound is absent — absence refuses. It reads them only to reject
 * a bound that is LOOSER than the platform permits. A deployment may tighten
 * and may not loosen."*
 *
 * **THE REJECTED READING IS PRESERVED BECAUSE IT IS THE OBVIOUS ONE.** R7 says
 * the bounds are a platform-wide CONSTANT, and the shortest way to honour that
 * sentence is to return `PLATFORM_SESSION_CEILING`'s two integers directly.
 * **It was refused, on three measurable grounds:**
 *
 *   1. It converts a ceiling into a default in one line, which is the exact
 *      distinction G220 calls *"the whole ruling"*.
 *   2. It makes `bounds_not_configured` — G139's entire point — **structurally
 *      unreachable**, and with it `session_lifetime_exceeds_ceiling` and
 *      `session_idle_exceeds_ceiling`, because a value read FROM the ceiling
 *      can never exceed it. **Three of the eight 503 arms would become arms
 *      nothing can return**, which is the shape `SIGN_IN_ATTEMPT_REFUSALS`
 *      refuses one module over: *"An arm nothing can return is … a declaration
 *      with no producer."*
 *   3. It would silently re-decide something nobody ruled on: that twelve hours
 *      of life is what every deployment WANTS, rather than the most any
 *      deployment may HAVE.
 *
 * **So "platform-wide constant" is read as *one pair of numbers for the whole
 * platform, stated once, by the deployment* — as opposed to per tenant — which
 * is the axis the ruling's second sentence is about.** The ceiling stays the
 * ceiling. A deployment that states nothing gets no session, loudly, at the
 * mint, with `bounds_not_configured` on both fields.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT SANITISE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `Number(raw)` is passed through **unguarded**, and that is the design rather
 * than an omission. `model/session.ts` names the arm it exists for:
 *
 *     "`NaN` or `±Infinity`. THE DANGEROUS ONE: every comparison against `NaN`
 *      is false, so a `NaN` bound expires nothing and fails OPEN — and
 *      `Infinity` parses out of a config string and sails through any naive
 *      `> 0` guard to the same place."
 *
 * A reader that coerced `NaN` to a number, or clamped to the ceiling, or
 * skipped an unparseable value, would be **deciding the bound itself** and
 * would hand `validateSessionBounds()` a value nobody stated. The validator is
 * the one place a bound is judged (G111's discipline: correctness that lives at
 * call sites is correctness that drifts), and this module's job is to carry the
 * deployment's words to it without editing them.
 *
 * ⚠️ **AN EMPTY VARIABLE IS ABSENCE AND NOT ZERO, AND THE CHOICE IS ARGUED
 * BECAUSE IT MOVES WHICH ARM FIRES.** `Number('') === 0`, so passing an empty
 * string through would report `bound_zero` — *"absence wearing a value's
 * clothes"* — for a variable that is, in every shell and in `compose.yaml`,
 * simply unset. `bounds_not_configured` names that defect correctly and
 * `bound_zero` does not. **`bound_zero` keeps a real producer regardless**: a
 * deployer who means *"no limit"* writes `0`, and `0` is what this reader
 * hands over.
 */

import {
  PLATFORM_SESSION_CEILING,
  SESSION_BOUND_FIELDS,
  type SessionBoundField,
  type SessionBoundsInput,
} from '../../model/session.ts'

type Assert<T extends true> = T

/* ==================================================================== *
 * §1  WHERE THE PLATFORM STATES ITS TWO NUMBERS
 * ==================================================================== */

/**
 * One variable per bound, and the map is TOTAL over `SessionBoundField`.
 *
 * 🛑 A THIRD BOUND ADDED TO `SessionBounds` IS A COMPILE ERROR HERE RATHER THAN
 * A BOUND WITH NO VARIABLE. `PLATFORM_SESSION_CEILING` is total for the same
 * reason and says so — *"unlike most total records in `model/`, this one BITES,
 * because this module constructs it one line below"*. This one is constructed
 * one line below too, so it bites in the same way and in the same place.
 *
 * ⚠️ THE NAMES ARE `RECONCILE_SESSION_*` AND NOT `RECONCILE_TENANT_*`, WHICH IS
 * NOT COSMETIC: a variable named for a tenant is a variable somebody will one
 * day try to key on one, and R7 says there is no such key.
 */
export const SESSION_BOUND_ENV: Record<SessionBoundField, string> = {
  maxLifetimeSeconds: 'RECONCILE_SESSION_MAX_LIFETIME_SECONDS',
  maxIdleSeconds: 'RECONCILE_SESSION_MAX_IDLE_SECONDS',
}

/* ==================================================================== *
 * §2  THE READER
 * ==================================================================== */

/**
 * The platform's stated session bounds, UNVALIDATED and UNEDITED.
 *
 * Returns `SessionBoundsInput` — the raw shape — and never `SessionBounds`,
 * because `MintSessionInput.bounds` is typed raw for a stated reason: *"the
 * validated shape is a plain interface anybody can construct literally, so
 * accepting it would let a caller hand over `{ maxLifetimeSeconds: 999999,
 * maxIdleSeconds: 1 }` and skip G220's ceiling entirely."* A reader that
 * returned the validated shape would be that skip, arriving through the door
 * built to prevent it.
 *
 * **NO PARAMETER. NO CLOCK. NO DATABASE. NO TENANT.** It reads two environment
 * variables and returns what they said.
 *
 * ⚠️ IT IS READ AT MINT TIME AND NOT AT BOOT, WHICH IS THE ONE PLACE THIS
 * MODULE DEPARTS FROM `runQueueTarget()`'s *"read once, at boot, like every
 * other fence in this directory"*. R7's own words are *"read at mint time"*,
 * and the reason the departure is safe is that **this reader is not a fence**:
 * it decides nothing and admits nobody. The fence is `validateSessionBounds()`,
 * which runs on every mint either way, and the eight arms it can return are the
 * eight things an operator needs told about their own configuration. A boot
 * read would report a defect once, into a log nobody keeps (`logger: false`),
 * and then serve 503s that named nothing.
 */
export function platformSessionBounds(): SessionBoundsInput {
  const stated: { -readonly [K in SessionBoundField]?: number | undefined } = {}
  for (const field of SESSION_BOUND_FIELDS) {
    const raw = process.env[SESSION_BOUND_ENV[field]]
    /* Absence stays absence. See the header: `Number('')` is `0`, and `0` is a
     * bound somebody wrote rather than a bound nobody wrote. */
    if (raw === undefined || raw === '') continue
    /* Unguarded, deliberately. `NaN` and `Infinity` are the arms this reader
     * exists to be able to produce. */
    stated[field] = Number(raw)
  }
  return stated
}

/* ==================================================================== *
 * §3  THE PROOFS
 * ==================================================================== */

/**
 * R7's SECOND SENTENCE, EXPRESSED AS AN ARITY.
 *
 * *"No per-tenant override."* A function with no parameters has nowhere to put
 * a `TenantId`, so the override is unrepresentable rather than refused —
 * `model/session-mint.ts`'s *"a `tenantId: null` is a field every caller must
 * remember to keep null; an absent field cannot be set by anyone"*, applied one
 * layer out.
 *
 * VERIFIED RED: giving `platformSessionBounds()` a `tenantId: TenantId`
 * parameter fails here with `TS2344`, `Type 'false' does not satisfy the
 * constraint 'true'`.
 */
export type _PlatformBoundsTakeNoArgument = Assert<
  Parameters<typeof platformSessionBounds>['length'] extends 0 ? true : false
>

/**
 * THE READER HANDS OVER THE RAW SHAPE AND NEVER THE VALIDATED ONE.
 *
 * `SessionBounds` requires both fields; `SessionBoundsInput` requires neither.
 * If somebody widens this function's return type to the validated shape, the
 * ceiling stops being consulted at the one call site that consults it, and this
 * assertion is where that shows up.
 *
 * VERIFIED RED: typing the return as `SessionBounds` fails here, because a
 * total record's keys do not extend an all-optional one's in the direction
 * asserted.
 */
export type _PlatformBoundsAreUnvalidated = Assert<
  Record<string, never> extends ReturnType<typeof platformSessionBounds> ? true : false
>

/**
 * ⚠️ DECLARED SO `noUnusedLocals` CANNOT SATISFY ITSELF BY DELETING THE IMPORT
 * THIS MODULE'S ENTIRE ARGUMENT RESTS ON.
 *
 * `PLATFORM_SESSION_CEILING` is imported and **deliberately not read by
 * `platformSessionBounds()`** — reading it there is the rejected shape the
 * header refuses at length. What it is read for is this: a compile-time
 * statement that the two bounds this module names are exactly the two bounds
 * the ceiling governs, so a third ceiling entry without a third variable, or a
 * third variable without a ceiling, is a failure at a named line.
 *
 * 🛑 AND IT IS A REAL CONTROL RATHER THAN AN IMPORT-KEEPER, WHICH IS WHY THE
 * VALUE IS CONSTRUCTED AND NOT MERELY TYPED. `CLAUDE.md`: *"a total `Record`
 * only bites where something CONSTRUCTS one."* This is the construction site.
 */
export const BOUND_ENV_COVERS_THE_CEILING: Assert<
  keyof typeof PLATFORM_SESSION_CEILING extends keyof typeof SESSION_BOUND_ENV
    ? keyof typeof SESSION_BOUND_ENV extends keyof typeof PLATFORM_SESSION_CEILING
      ? true
      : false
    : false
> = true

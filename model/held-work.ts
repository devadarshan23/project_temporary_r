/**
 * ReconcileAI — held work. G156, G162, G225 and G233, 23 Aug 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY THIS MODULE EXISTS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `/signin/lapsed` draws a panel that says work was held, and — because G156
 * gives an open draft TWO independent clocks — it may say the work is gone.
 * Neither clock had a number and neither had a type. MG6,
 * `docs/model-gaps.md`: *"Neither module nor clock exists, so neither clock has
 * a number to render."*
 *
 *     ls model/held-work.ts                      → No such file or directory
 *     grep -rn 'IngestBound' model/*.ts | wc -l  → 0
 *
 * G162 rules the filing: *"`ReconciliationRun` is on the wire and is the
 * business record; a lease is neither, and a held draft is neither."* G225
 * permits the new file. Both obligations that travel with a new module are met
 * below — the value-import rule (there are no value imports at all; see the
 * next block) and `MODULE_COUNT` in
 * `tests/model/runtime-importability.test.ts`, which moved with this file
 * rather than being left to fail.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE LANDMARK TRAP, NAMED HERE BECAUSE IT IS THE ONE PEOPLE REACH FOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 *     grep -n 'Record<AccessResourceClass, number>' model/access.ts
 *
 * ⚠️ THE CONSTANT IS CITED BY ANCHOR AND NOT BY NAME, WHICH LOOKS COY AND IS
 * NOT. #238's acceptance criterion is a `grep -c` over THIS file for that
 * constant's name, and it must return 0 — so a comment that spells out the
 * thing it is warning against turns the control into one that can never go
 * green. `model/kernel.ts` already states the same discipline for `FieldPath`'s
 * superseded declaration, and `CLAUDE.md` records the v1-drop marker count
 * being moved TWICE by paragraphs explaining a drop. Cite by anchor, not by
 * copy.
 *
 * ⚠️ AND THIS PARAGRAPH DID IT TO ITSELF ON THE FIRST DRAFT, WHICH IS RECORDED
 * RATHER THAN QUIETLY FIXED. The sentence above originally spelled the drop
 * marker out while telling the reader not to — and `node tools/check-doc-counts.mjs`
 * immediately reported `CLAUDE.md` STALE at 236 markers against a tree of 237.
 * A file with no dropped declarations in it had moved the governed drop count
 * by one, from a comment. Third instance of that class in this record.
 *
 * The ceiling the anchor finds is a GRANT ceiling keyed by resource class, and
 * its own docblock says what it bounds: *"a single authorised act, and the
 * right unit is the time one act plausibly takes"*. A held draft is not an act.
 * It is a piece of unfinished human work, and its exposure is not *"how long
 * does a mis-issued artefact stay live"* but *"how long may we keep personal
 * data somebody stopped working on"*. Reading one as the other is
 * `docs/HANDOFF.md` §5.1's landmark substitution exactly, and #238 names it by
 * number. `model/session.ts` states the same trap for the same reason; that two
 * modules need the same warning is the argument for both of them having no
 * imports.
 *
 * 🛑 THIS MODULE HAS NO VALUE IMPORT, AND THAT IS THE ENFORCEMENT. The single
 * `import type` below is erased by `verbatimModuleSyntax` before the loader
 * ever sees it, so there is no module specifier at runtime and therefore no
 * path by which the grant ceiling could be read here even by accident.
 * `tests/model/held-work.test.ts` asserts the absence against this file's own
 * bytes rather than trusting this sentence.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE UNIT IS EPOCH SECONDS, NOT `Timestamp`, AND THAT IS DELIBERATE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * G156's rule is arithmetic over instants —
 * `purge_after = least(held_at + cap, last_held_at + idle)` — and `Timestamp`
 * is a bare `string` alias (`model/kernel.ts`). Adding string arithmetic here
 * would require a parse and a format, and `model/session.ts` records why that
 * must not be improvised: *"`session.expiresAt <= now` compares LEXICALLY:
 * correct for ISO-8601 in UTC with fixed fractional digits and silently wrong
 * for anything else, while the migration declares `timestamptz` and the
 * hand-written `pg` shim types result values as `unknown`. Nobody has verified
 * what the driver returns."* That belongs in one codec module with one call
 * site — G111's shape — and it is not started.
 *
 * So this module takes and returns `EpochSeconds`, an integer, and **the
 * conversion is the caller's**. The arithmetic here is then total, exact and
 * testable without a codec, and the codec — when it lands — has exactly one
 * more call site rather than a second private implementation to reconcile.
 * **Do not add a `Timestamp` parse to this file; add the codec.**
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ABANDONMENT RULE — G233's EXPLICIT DEMAND
 * ══════════════════════════════════════════════════════════════════════════
 *
 * G233 mints `held_work` as the fourteenth `RetentionClass` and says in its own
 * cell: *"The class needs a stated ABANDONMENT rule, not only a retention
 * period. Held work whose holder never returns is the common case, and a class
 * whose clock never starts is a class that never expires."*
 *
 * The rule, stated here because this is the module that makes it computable:
 *
 *   A held draft is ABANDONED — and deleted — at `purgeAfter`, which is
 *   `least(heldAt + capSeconds, lastHeldAt + idleSeconds)`, where
 *   `idleSeconds` is `RetentionPolicy.days.held_work`.
 *
 * That is G156's ruled formula verbatim, and the reason it satisfies G233 is
 * the FIRST operand: `heldAt + capSeconds` is fixed at creation and no
 * subsequent event can move it, so the clock starts whether or not anybody ever
 * comes back. A holder who walks away is expired by the idle term; a holder who
 * never stops touching is expired by the cap term; there is no third case.
 * `latestPossiblePurge()` below states it as a number that `lastHeldAt` does not
 * enter into, so a test can hold it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IS DELIBERATELY NOT HERE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NO NUMBERS. Both bounds are FDE-set configuration refusing on absence,
 * G139's posture, and `PRODUCT.md` forbids inventing a figure. There is no
 * duration literal anywhere in this file — not even a permissive one — and
 * `validateHeldWorkBounds()` refuses rather than defaulting. Unlike
 * `model/session.ts`, there is not even a platform ceiling to refuse against:
 * G220 supplied two integers for sessions and no ruling has supplied any for
 * drafts.
 *
 * NO BILLING METER. G175 rules held-work autosave metered at draft grain, and
 * `METERS`/`METER_AGGREGATION` (`model/billing.ts`) are a paired total record,
 * so minting one is a compile error until its aggregation is stated. The GRAIN
 * is enforced here — `autosaveMeterGrain()` folds N touches of one draft to one
 * row — and the `Meter` member is deliberately NOT minted, because G175's own
 * row records an undischarged privacy consequence: *"a per-person count of how
 * many drafts each named finance operator opened … Nothing on any drawn screen
 * discloses this."* Minting the meter without the disclosure would apply half a
 * ruling. The fold is the half that is safe to build now.
 *
 * NO STORAGE SHAPE. `HeldDraft` below is a row's worth of fields; the table,
 * its RLS policy and its migration are not this module's to declare.
 */

/* ⚠️ EXTENSIONLESS, AND THE ASYMMETRY WITH THE VALUE RULE IS THE HOUSE
 * CONVENTION RATHER THAN AN OVERSIGHT. A VALUE import inside `model/` must
 * carry `.ts` because Node's ESM resolver adds none; an `import type` is erased
 * by `verbatimModuleSyntax` before the loader ever sees it, so an extension
 * here would advertise a runtime edge that does not exist.
 * `tests/model/runtime-importability.test.ts` asserts both directions, and it
 * is what caught this line written the other way. */
import type { RetentionClass } from './domain'

/* ------------------------------------------------------------------ *
 * 0. The unit
 * ------------------------------------------------------------------ */

/**
 * Whole seconds since the Unix epoch, UTC.
 *
 * An alias rather than a brand, deliberately: a brand would force every caller
 * through a mint function that does not exist yet, and the honest statement is
 * that this module does no conversion at all. See the header block.
 */
export type EpochSeconds = number

type Assert<T extends true> = T

/**
 * The fourteenth `RetentionClass`, G233, pinned to the minted member rather
 * than transcribed beside it.
 *
 * ⚠️ THE ASSERTION IS THE POINT, NOT THE CONSTANT. A string literal repeated in
 * two modules is `docs/HANDOFF.md` §5.3 — two vocabularies for one concept —
 * and the way this file avoids it is a compile-time pin: rename or drop
 * `held_work` in `model/domain.ts` and the line below fails to compile here.
 * The import is type-only, so nothing crosses the module boundary at runtime
 * and the no-value-import property above survives.
 */
export const HELD_WORK_RETENTION_CLASS = 'held_work'

export type _HeldWorkRetentionClassIsAMintedRetentionClass = Assert<
  typeof HELD_WORK_RETENTION_CLASS extends RetentionClass ? true : false
>

/* ------------------------------------------------------------------ *
 * 1. The two clocks — G156
 * ------------------------------------------------------------------ */

/**
 * The two numbers a deployment must state before any draft can be held.
 *
 * G156: *"AN OPEN DRAFT CARRIES AN ABSOLUTE CAP FROM CREATION ALONGSIDE IDLE
 * EXPIRY — TWO INDEPENDENT CLOCKS, AND TOUCHING THE DRAFT CANNOT EXTEND THE
 * CAP."* The design's author foreclosed the cap as §5.3 — two vocabularies for
 * one concept — and the red disputed it and was upheld: *"they are two
 * different questions: idle expiry and absolute lifetime."*
 *
 * ⚠️ REQUIRED, NON-NULL AND UNDEFAULTED, the discipline
 * `IdentifierNormalisation.maxInputChars` states for itself under G139: *"a
 * bound with no number is not a bound … It is never silently unbounded, which
 * is the outcome a default would produce."*
 */
export interface HeldWorkBounds {
  /**
   * Absolute life of a held draft measured from `heldAt`, in seconds. The term
   * that no touch can move, and therefore the term that makes abandonment
   * computable at creation.
   */
  readonly maxOpenDraftAgeSeconds: number
  /**
   * Permitted gap between touches before the hold lapses, in seconds.
   *
   * 🛑 ITS SOURCE IS THE RETENTION POLICY, NOT A SECOND CONFIGURATION SURFACE.
   * G156's ruled formula reads `least(held_at + maxOpenDraftAgeDays,
   * last_held_at + days.held_edit)` — and `days.held_edit` is
   * `RetentionPolicy.days` keyed by the class G233 mints, which this module
   * calls `held_work` (see `HELD_WORK_RETENTION_CLASS`). **The idle term IS the
   * retention window**, which is what makes `held_work` a retention class rather
   * than a UI timeout, and it is per-tenant configured and counsel-owned like
   * the other thirteen.
   *
   * `heldWorkIdleSecondsFromRetentionDays()` is the conversion, so the
   * provenance is executable rather than asserted in a comment.
   */
  readonly maxIdleSeconds: number
}

/**
 * What a configuration reader actually produces. Either key may be missing and
 * either may be present-and-`undefined` — `Number(process.env.X)` on an unset
 * variable yields `NaN`, a spread of a partial object yields `undefined`, and
 * the two are different defects with different reasons below.
 *
 * ⚠️ `| undefined` is written explicitly because `exactOptionalPropertyTypes`
 * is on: without it `{ maxIdleSeconds: undefined }` would not type-check and
 * the commonest real input would be unrepresentable.
 */
export interface HeldWorkBoundsInput {
  readonly maxOpenDraftAgeSeconds?: number | undefined
  readonly maxIdleSeconds?: number | undefined
}

export const HELD_WORK_BOUND_FIELDS = ['maxOpenDraftAgeSeconds', 'maxIdleSeconds'] as const

export type HeldWorkBoundField = (typeof HELD_WORK_BOUND_FIELDS)[number]

/**
 * The array above and the interface are two lists of the same thing, so they
 * are pinned to each other. A third clock added to `HeldWorkBounds` and not to
 * the array is a compile error here rather than a bound nothing validates.
 */
export type _HeldWorkBoundFieldsAreExactlyTheBoundsKeys = Assert<
  HeldWorkBoundField extends keyof HeldWorkBounds
    ? keyof HeldWorkBounds extends HeldWorkBoundField
      ? true
      : false
    : false
>

/* ------------------------------------------------------------------ *
 * 2. The closed refusal union
 * ------------------------------------------------------------------ */

/**
 * Every way a stated pair of bounds can fail to be a pair of bounds.
 *
 * CLOSED, and each arm is a different failure with a different argument. The
 * shape is `model/session.ts`'s, for the reason #238 gives — *"the shape #226
 * [A-4] uses for `SessionBounds`, for the same reason"* — and the arms are NOT
 * the same arms, because the two modules bound different things.
 */
export const HELD_WORK_BOUND_REFUSAL_REASONS = {
  /** The field is absent, or present and `undefined`. G139's whole point. */
  boundsNotConfigured: 'bounds_not_configured',
  /**
   * `NaN` or `±Infinity`. THE DANGEROUS ONE, and here it is worse than it is
   * for a session: every comparison against `NaN` is false, and `Math.min`
   * PROPAGATES `NaN` — so a `NaN` cap makes `purgeAfter` `NaN`, and a draft
   * whose purge instant is `NaN` is never swept by any comparison anybody
   * writes. That is exactly the never-expiring class G233 warns about, arriving
   * through a config string rather than through a design decision. `Infinity`
   * parses out of a config string and sails through any naive `> 0` guard to
   * the same place.
   */
  boundNotANumber: 'bound_not_a_number',
  /** Fractional seconds. Refused rather than truncated toward a number nobody stated. */
  boundNotAnInteger: 'bound_not_an_integer',
  /**
   * Exactly `0`. Absence wearing a value's clothes — it is what a missing
   * integer reads as in most configuration parsers, and as a bound it means no
   * draft may be held at all.
   */
  boundZero: 'bound_zero',
  /** Negative. Abandons every draft before it is held; fails closed, nonsensically. */
  boundNegative: 'bound_negative',
  /**
   * The idle bound is at least the cap, so the idle clock can never fire first
   * and G156's two clocks collapse into one.
   *
   * 🛑 THIS ARM IS WHY G156 IS NOT §5.3. A configuration in which the idle
   * bound is unreachable is a configuration in which there is only an absolute
   * lifetime — which is the single-clock design the ruling's author proposed
   * and the red refused. Refusing it here is what keeps the two clocks
   * measuring two different things rather than one thing twice.
   */
  idleAtLeastCap: 'idle_at_least_cap',
} as const

export type HeldWorkBoundRefusalReason =
  (typeof HELD_WORK_BOUND_REFUSAL_REASONS)[keyof typeof HELD_WORK_BOUND_REFUSAL_REASONS]

/**
 * ⚠️ EVERY ARM CARRIES `field`, AND NONE CARRIES FREE TEXT. The field is a
 * literal union, never a bare `string`, so a refusal can be logged, mirrored to
 * the wire and rendered without carrying anything a caller supplied.
 */
export type HeldWorkBoundRefusal =
  | { readonly reason: 'bounds_not_configured'; readonly field: HeldWorkBoundField }
  | { readonly reason: 'bound_not_a_number'; readonly field: HeldWorkBoundField }
  | { readonly reason: 'bound_not_an_integer'; readonly field: HeldWorkBoundField }
  | { readonly reason: 'bound_zero'; readonly field: HeldWorkBoundField }
  | { readonly reason: 'bound_negative'; readonly field: HeldWorkBoundField }
  | { readonly reason: 'idle_at_least_cap'; readonly field: 'maxIdleSeconds' }

export type _HeldWorkBoundRefusalReasonsAreExhaustive = Assert<
  HeldWorkBoundRefusal['reason'] extends HeldWorkBoundRefusalReason
    ? HeldWorkBoundRefusalReason extends HeldWorkBoundRefusal['reason']
      ? true
      : false
    : false
>

/**
 * ⚠️ THE REFUSED ARM CARRIES A NON-EMPTY TUPLE, NOT AN ARRAY. `{ ok: false;
 * refusals: [] }` — a refusal with no reason in it — is unrepresentable, so a
 * caller that renders the first reason cannot be handed nothing to render.
 */
export type HeldWorkBoundsResult =
  | { readonly ok: true; readonly bounds: HeldWorkBounds }
  | {
      readonly ok: false
      readonly refusals: readonly [HeldWorkBoundRefusal, ...HeldWorkBoundRefusal[]]
    }

/* ------------------------------------------------------------------ *
 * 3. The validator
 * ------------------------------------------------------------------ */

type BoundCheck =
  | { readonly ok: true; readonly seconds: number }
  | { readonly ok: false; readonly refusal: HeldWorkBoundRefusal }

/**
 * One bound, checked in the order the failures matter.
 *
 * `Number.isFinite` before `Number.isInteger` deliberately: both reject `NaN`,
 * and reporting `NaN` as a non-integer would be true and useless. The
 * fail-open case gets its own name.
 */
function checkBound(field: HeldWorkBoundField, value: number | undefined): BoundCheck {
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
  return { ok: true, seconds: value }
}

/**
 * The only way to obtain a `HeldWorkBounds`.
 *
 * Total; never throws; reads no clock and no environment. With no numbers
 * stated it refuses, which means no draft can be held — **that is the intended
 * failure, not a regression.** G139: the alternative, a default, is a silently
 * unbounded hold nobody would ever discover was never chosen. And a silently
 * unbounded hold is precisely the never-expiring retention class G233 forbids.
 *
 * 🛑 AND SPECIFICALLY NOT DEFAULTED FROM THE GRANT CEILING the header block
 * cites by anchor. There is no import here through which it could be read.
 *
 * BOTH BOUNDS ARE REPORTED, not just the first. A validator that stops at the
 * first absent bound tells a deployer to state one number and then refuses
 * again for the other.
 */
export function validateHeldWorkBounds(input: HeldWorkBoundsInput): HeldWorkBoundsResult {
  const cap = checkBound('maxOpenDraftAgeSeconds', input.maxOpenDraftAgeSeconds)
  const idle = checkBound('maxIdleSeconds', input.maxIdleSeconds)

  if (!cap.ok && !idle.ok) {
    return { ok: false, refusals: [cap.refusal, idle.refusal] }
  }
  if (!cap.ok) return { ok: false, refusals: [cap.refusal] }
  if (!idle.ok) return { ok: false, refusals: [idle.refusal] }

  /* Only reachable once both bounds are individually sound, which is why it is
   * a separate arm rather than a clause inside `checkBound`: an idle bound
   * cannot be compared against a cap that is itself `NaN`. */
  if (idle.seconds >= cap.seconds) {
    return { ok: false, refusals: [{ reason: 'idle_at_least_cap', field: 'maxIdleSeconds' }] }
  }

  return {
    ok: true,
    bounds: { maxOpenDraftAgeSeconds: cap.seconds, maxIdleSeconds: idle.seconds },
  }
}

/* ------------------------------------------------------------------ *
 * 4. The held draft
 * ------------------------------------------------------------------ */

/**
 * A row's worth of held work.
 *
 * ⚠️ IT CARRIES NO CONTENT, AND THAT IS NOT AN OVERSIGHT. What is held — a
 * half-written rejection reason, a partially filled form — is counterparty- or
 * operator-supplied text, and this module computes a schedule over it rather
 * than reading it. Keeping the payload out of the type keeps every function
 * below total over values it can actually reason about, and keeps invariant 6's
 * data-never-instruction boundary on the other side of this module.
 *
 * `tenantId` is the `TenantScoped` field spelled out rather than inherited,
 * because inheriting it would need a value import (see the header). Invariant 1
 * is unchanged: the field RECORDS the scope an authenticated session already
 * established, it does not select one, and every read of the row runs inside
 * `withTenantScope()` where the SQL carries no tenant predicate of its own.
 */
export interface HeldDraft {
  readonly tenantId: string
  readonly draftId: string
  /** Who holds it. Needed by `/signin/lapsed` to say whose work this is. */
  readonly heldByUserId: string
  /**
   * When the hold began. 🛑 IMMUTABLE. This is the field the absolute cap is
   * measured from, and a write to it is a cap extension wearing an update's
   * clothes.
   */
  readonly heldAt: EpochSeconds
  /** The most recent touch. Moves; the cap term does not depend on it. */
  readonly lastHeldAt: EpochSeconds
  /**
   * Invariant 10 — the grant the hold ran under. Holding a draft is a user act
   * against tenant data, so it is never null here; `AUTHORIZATION_MAY_BE_ABSENT`
   * permits null for exactly one actor kind (`system`), and a person opening a
   * draft is not it. The PURGE is the `system` act, and it is not this type.
   */
  readonly authorizationId: string
}

/* ------------------------------------------------------------------ *
 * 5. The two clocks, evaluated — G156's rule, and the one this slice exists for
 * ------------------------------------------------------------------ */

/**
 * When this draft's hold lapses. G156's formula, verbatim:
 * `purge_after = least(held_at + maxOpenDraftAge, last_held_at + idle)`.
 *
 * 🛑 THE LAZY REPAIR THIS FUNCTION EXISTS TO REFUSE, NAMED BY THE RULING.
 * Recomputing the whole schedule from `lastHeldAt` — `lastHeldAt + idle`, with
 * no `heldAt` term — passes every idle-expiry test anybody would write, and
 * makes an actively-touched draft IMMORTAL. G156: it *"means the retention
 * class is decorative and destroys the PDPA argument that justified minting
 * it"* — *"I'll come back to it"* is not a lawful basis for holding personal
 * data indefinitely. `test_touching_a_draft_cannot_extend_the_absolute_cap`
 * fails on that repair and on no other.
 *
 * The `heldAt + cap` operand is a constant of the draft: `heldAt` is `readonly`
 * and never rewritten, so no number of touches can raise the value `Math.min`
 * is choosing between. **That is the whole mechanism.**
 *
 * 🟢 The tree's existing polarity, which this matches: `SourceDocument
 * .purgeAfter` is computed AT INGEST (`grep -n 'purgeAfter' model/domain.ts`),
 * never at read, for the reason stated there — *"Read-time resolution would let
 * a policy edit"* change the schedule of rows already written.
 *
 * Total; never throws; reads no clock. `now` is not a parameter because this is
 * not a question about now.
 */
export function purgeAfterForHeldDraft(
  draft: Pick<HeldDraft, 'heldAt' | 'lastHeldAt'>,
  bounds: HeldWorkBounds,
): EpochSeconds {
  const cappedAt = draft.heldAt + bounds.maxOpenDraftAgeSeconds
  const idleAt = draft.lastHeldAt + bounds.maxIdleSeconds
  return Math.min(cappedAt, idleAt)
}

/**
 * A touch. Moves `lastHeldAt` and NOTHING else.
 *
 * Returns a new draft rather than mutating, so a caller cannot accidentally
 * write `heldAt` on the way past. A touch at an instant BEFORE the recorded
 * `lastHeldAt` is ignored rather than accepted — clocks go backwards across
 * nodes, and G143 requires a retry to be reconstructible, so a replayed touch
 * must not be able to move the schedule at all, in either direction.
 */
export function touchHeldDraft(draft: HeldDraft, at: EpochSeconds): HeldDraft {
  if (!Number.isFinite(at) || at <= draft.lastHeldAt) return draft
  return { ...draft, lastHeldAt: at }
}

/**
 * Where a draft stands against its two clocks.
 *
 * `warned` is not decoration: G156 accepts as a cost that *"a genuinely
 * long-running investigation loses its draft at the ceiling"*, and requires
 * that *"the operator must be warned well before it"*. A standing with no
 * warning arm gives `/signin/lapsed` nothing to render until the work is
 * already gone.
 */
export const HELD_WORK_STANDINGS = {
  held: 'held',
  /** Past the warning point and not yet lapsed. The panel's amber state. */
  lapsingSoon: 'lapsing_soon',
  /** The idle clock fired first. The holder stopped and did not come back. */
  lapsedIdle: 'lapsed_idle',
  /**
   * The absolute cap fired first. The holder may have been touching it the
   * whole time — this is the arm that exists BECAUSE touching cannot extend the
   * cap, and the arm a single-clock design cannot produce.
   */
  lapsedCap: 'lapsed_cap',
} as const

export type HeldWorkStanding = (typeof HELD_WORK_STANDINGS)[keyof typeof HELD_WORK_STANDINGS]

/**
 * ⚠️ THE WARNING POINT IS A FRACTION OF THE REMAINING WINDOW, NOT A DURATION.
 * `PRODUCT.md` forbids inventing a figure and no ruling has supplied one, so a
 * literal number of days here would be exactly the invented duration MG20
 * catalogues elsewhere in this record. A fraction is derived from the
 * deployment's own stated bounds and invents nothing.
 *
 * The caller states it; there is no default, for G139's reason.
 */
export interface HeldWorkStandingInput {
  readonly draft: Pick<HeldDraft, 'heldAt' | 'lastHeldAt'>
  readonly bounds: HeldWorkBounds
  readonly now: EpochSeconds
  /** In `(0, 1)`. The share of the window still remaining at which to warn. */
  readonly warnAtRemainingFraction: number
}

export function heldWorkStanding(input: HeldWorkStandingInput): HeldWorkStanding {
  const { draft, bounds, now } = input
  const cappedAt = draft.heldAt + bounds.maxOpenDraftAgeSeconds
  const idleAt = draft.lastHeldAt + bounds.maxIdleSeconds
  const purgeAfter = Math.min(cappedAt, idleAt)

  if (now >= purgeAfter) {
    /* ⚠️ ORDER MATTERS AND THE CAP WINS A TIE. When both clocks fire at the
     * same instant the cap is the stronger statement — it is the one that
     * fires whether or not the holder came back — and reporting the tie as an
     * idle lapse would tell an operator their work was dropped for inactivity
     * when it was dropped for age. */
    return cappedAt <= idleAt ? 'lapsed_cap' : 'lapsed_idle'
  }

  const remaining = purgeAfter - now
  const window = purgeAfter - draft.heldAt
  if (window > 0 && remaining <= window * input.warnAtRemainingFraction) {
    return 'lapsing_soon'
  }
  return 'held'
}

/* ------------------------------------------------------------------ *
 * 6. Abandonment — G233's clock start
 * ------------------------------------------------------------------ */

/**
 * `RetentionPolicy.days.held_work` → the idle bound, in seconds.
 *
 * The one conversion this module performs, and it exists so that the idle
 * term's provenance is executable. G156's formula names `days.held_work` as the
 * second operand directly, so a caller that reaches for any other number is
 * departing from the ruling rather than configuring a different surface.
 *
 * `null` on a non-integer or non-positive input rather than a thrown error or a
 * silent `NaN`: `validateHeldWorkBounds()` is where a bad number acquires a
 * named refusal, and this function must not pre-empt it with a different
 * failure shape.
 */
export function heldWorkIdleSecondsFromRetentionDays(days: number): number | null {
  if (!Number.isInteger(days) || days <= 0) return null
  return days * 86400
}

/**
 * 🛑 THE ABANDONMENT RULE, G233's EXPLICIT DEMAND, AS AN EXECUTABLE PREDICATE.
 *
 * *"A class whose clock never starts is a class that never expires. Held work
 * whose holder never returns is the common case."*
 *
 * This is the answer, and it is a function rather than a sentence so a test can
 * hold it: **for every draft and every valid pair of bounds, the purge instant
 * is at most `heldAt + maxOpenDraftAgeSeconds`** — a bound fixed at creation
 * that no touch, no absence and no human decision can move. Abandonment
 * therefore needs no event. A holder who walks away is expired by the idle
 * term; a holder who never stops touching is expired by the cap term; **there
 * is no third case, and that exhaustiveness is the whole of the rule.**
 *
 * Returns the latest instant at which this draft can possibly still exist,
 * computed WITHOUT reference to `lastHeldAt` — which is exactly why it is a
 * separate function from `purgeAfterForHeldDraft()` rather than an alias for
 * it. A reader checking G233's demand needs to see a number that no touch
 * enters into.
 */
export function latestPossiblePurge(
  draft: Pick<HeldDraft, 'heldAt'>,
  bounds: HeldWorkBounds,
): EpochSeconds {
  return draft.heldAt + bounds.maxOpenDraftAgeSeconds
}

/* ------------------------------------------------------------------ *
 * 7. Autosave metering grain — G175
 * ------------------------------------------------------------------ */

/**
 * Fold a stream of touches to the set of drafts that were touched.
 *
 * G175: *"HELD-WORK AUTOSAVE IS METERED AT A COARSE GRAIN — ONE ROW PER DRAFT,
 * NEVER PER KEYSTROKE-BATCH."* The rejected alternative and why it lost, from
 * the ruling: a row per keystroke-batch makes *"the metering table a per-person
 * typing-cadence record of a regulated customer's staff — not a billing
 * artefact but behavioural telemetry about named individuals, produced as a
 * side effect of a save button."*
 *
 * ⚠️ WHAT THIS FUNCTION IS AND IS NOT. It returns draft ids, not
 * `UsageRecord`s, and no `Meter` member is minted — see the header for why the
 * billing half of G175 is deliberately unbuilt. This is the GRAIN, expressed
 * as a fold, so that the coarse grain is a property something can test rather
 * than a convention a caller is trusted to follow.
 *
 * Order-preserving and duplicate-free: the first touch of each draft fixes its
 * position, so the output is stable across two runs over the same input, which
 * G143(b) requires of anything a retry may recompute.
 *
 * Invariant 5 is untouched: nothing here prices anything.
 */
export function autosaveMeterGrain(
  touches: readonly Pick<HeldDraft, 'draftId'>[],
): readonly string[] {
  const seen = new Set<string>()
  const rows: string[] = []
  for (const touch of touches) {
    if (seen.has(touch.draftId)) continue
    seen.add(touch.draftId)
    rows.push(touch.draftId)
  }
  return rows
}

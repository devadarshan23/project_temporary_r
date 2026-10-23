/**
 * ReconcileAI — the session mint. G1601–G1612, 21 Sep 2026.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS MODULE IS FOR, IN ONE SENTENCE: IT IS THE TYPE-LEVEL HALF OF
 *    INVARIANT 1, AIMED AT THE ONE BREACH THAT ARRIVES WEARING A RULING'S
 *    ENDORSEMENT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Copy it, never paraphrase it — `CLAUDE.md` is the only place it is numbered:
 *
 *     "Tenant scope is derived from the session, never read from a request."
 *
 * G315 puts the tenant in the OIDC `state` **deliberately**, as a routing fact
 * for the 302. That is fine as a routing fact. But the auth host's one-time
 * grant is the next thing to hold it, and a mint writer is the next thing after
 * that — and if either carries it forward, **tenant scope becomes a thing
 * conferred by authentication, with a ruling apparently endorsing it.** Every
 * reviewer who traces that back finds a decision that looks deliberate, because
 * it was; what was deliberate was the 302, not the session row.
 *
 * So the defence is not a review comment and not a runtime check. It is that
 * `MintSessionInput` **has no `tenantId` field at all — absent, not `null`** —
 * and that no value reachable from it has one either. A `tenantId: null` is a
 * field every caller must remember to keep null. An absent field cannot be set
 * by anyone.
 *
 * ⚠️ THE SHAPE IS NOT INVENTED HERE AND MUST NOT BE (§5.3). It is
 * `model/identity.ts`'s `_InvitationRedemptionCarriesNoTenantId`, which makes
 * the identical argument about the identical axis for the ACCEPT path, in its
 * own words: *"IT IS THE RELOCATION CASE RATHER THAN THE DELETION CASE …
 * Nobody deletes the tenant derivation; somebody ADDS a convenient parameter,
 * and the derivation stays where it was and stops being the only source."* It
 * is also `ResolvedSubject`'s union-not-nullable-record shape in
 * `model/access.ts`, and `ServedSurface`'s in `model/serving-host.ts` §8, whose
 * declaration says the reason in one line: *"a console surface has no
 * `tenantId` property to read, so binding one is a compile error rather than a
 * value somebody has to remember to check."*
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 WHERE THE TENANT IS BOUND, AND IT IS NOT HERE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Later and separately, by `selectTenantForSession()` in `model/access.ts` §7a,
 * which is **a CHECK and never a CHOOSER** (G210): the tenant arrives from the
 * HOST under G179 and that function answers yes or no about that one. The other
 * half is `session_selection_restrictive` in
 * `db/migrations/0005_session_and_membership.sql`, as amended by `0008`. G160
 * and G199: *"either alone is a defeat."* **This module touches neither**, and
 * a commit that makes this module bind a tenant has not added a feature — it
 * has moved the derivation.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🛑 THE DEFENCE IS TWO PROOFS AND ONE OMIT, BECAUSE A KEY CHECK ALONE LEAKS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A shallow `'tenantId' extends keyof MintSessionInput` proof is necessary and
 * it is **not sufficient**, and the gap is not hypothetical — it is one field
 * away. The caller standing at a mint is holding a `ServedSurface`, because it
 * has just resolved the host it is serving; and a `ServedSurface`'s tenant arm
 * **carries a `TenantId`**. Adding `surface: ServedSurface` to the input below
 * would be natural, would read as tightening (the surface is derived from the
 * host, which is invariant 1's own chain), and would hand the mint a tenant
 * through a key named `surface`. The shallow proof would stay green.
 *
 * So the input also carries `AssertNoTenantDeep`, which refuses a `TenantId` at
 * ANY property position, transitively. `surface: ServedSurface` fails there.
 *
 * And the OUTPUT is an `Omit` of `Session` rather than a fresh interface, so
 * `tenantId` is absent from what a writer receives as well as from what a
 * caller supplies. **That third one is the only part of the defence that does
 * not depend on excess-property checking** — see the honesty note on
 * `MintSessionInput` — and it is therefore the load-bearing one. The `Omit`
 * form is `server/data-plane/definition-store.ts`'s (G1122), taken for its
 * other property too: a thirteenth field on `Session` is a `TS2739` HERE rather
 * than a column somebody forgets.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IS DELIBERATELY NOT HERE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 NO WRITER, NO ROUTE, NO MIGRATION. This is `docs/build/completion-plan.md`
 * §5 W3 S2 and nothing else. S1 (`external_subject`) is blocked on R5 and R6,
 * S3 (the writer) on S1, S4 on R2, S5 on R3 and R4, S6 on R1. **None of R1–R7
 * is taken here**; they are the owner's.
 *
 * 🛑 NO CLOCK, AND THAT IS WHY NOTHING BELOW PRODUCES `expiresAt`.
 * `consumeSignInAttempt()` states the rule for the neighbouring act — *"IT
 * READS NO CLOCK, AND THE ABSENCE IS DELIBERATE"* — and `model/session.ts`
 * states the reason in its own header: `Timestamp` is a string alias, so any
 * arithmetic or comparison on one in the model is LEXICAL, correct for ISO-8601
 * in UTC with fixed fractional digits and silently wrong otherwise, while the
 * migration declares `timestamptz` and the hand-written `pg` shim types result
 * values as `unknown`. That module's instruction is verbatim: **"Do not add a
 * comparison to this file; add the codec."** It applies to arithmetic with more
 * force than to comparison, and the codec is not started.
 *
 * ⚠️ THE CONSEQUENCE IS NAMED RATHER THAN WORKED AROUND: this module hands the
 * writer the VALIDATED `bounds` and no timestamps at all, so `expires_at` is
 * computed where a clock legitimately lives — `now() + interval` in SQL, on the
 * `timestamptz` column, by the one clock every policy in `db/migrations/`
 * already compares against. Taking `expiresAt` as a parameter instead was
 * refused: it puts the ceiling's arithmetic at the call site, which is exactly
 * the shape G111 refuses for money.
 *
 * ⚠️ `MintedSession` IS NOT IN `model/` AND THIS MODULE IS NOT IT.
 * `MintedSession` is a **wire-only** schema — it exists in
 * `docs/contracts/session.openapi.yaml` (`components/schemas/MintedSession`,
 * described there as `SessionView` narrowed) and **nowhere in `model/*.ts`**.
 * Derive it, never read this line:
 *
 *     grep -rnE '(export )?(type|interface|const) MintedSession\b' model/  -> 0
 *     grep -rn  'MintedSession:' docs/contracts/*.yaml                     -> 1
 *
 * 🛑 AND THE OBVIOUS DERIVATION IS WRONG — G1612, MEASURED ON THIS FILE, AND
 * IT IS RECORDED HERE BECAUSE A FIRST DRAFT OF THIS VERY BLOCK CARRIED IT.
 * That draft said `grep -rn 'MintedSession' model/ | wc -l  -> 0`. **It
 * returns 16**, for two independent reasons and neither is a wrong answer
 * about the property: eleven matches are `MintedSessionFacts`, the type
 * declared below, because the name is a PREFIX of it; and five are the bare
 * word inside THIS paragraph, which exists only to say the thing is absent.
 * **A grep for a name, in a file that discusses the name, measures the
 * discussion.** That is `server/data-plane/token-verify.ts`'s G978 — *"THE
 * COMMAND RETURNED THREE LINES … AND ALL THREE WERE PROSE"* — arriving a
 * second time, and §5.1 wearing a `grep`. Key on the DECLARATION, never on
 * the mention.
 *
 * So there is **no `tsc` link of any kind** between the 200 body and `Session`,
 * and none between it and `MintedSessionFacts` below. The two are related by a
 * contract test and by nothing else. **Do not describe this module as declaring
 * the wire type, and do not add a re-export to make it look as though it does**
 * — the mirror would then exist in two places and drift in one of them (§5.3),
 * and the honest statement is that the wire narrowing is held by
 * `tests/contracts/` and is a different control with a different failure mode.
 * `MintedSessionFacts` is what a WRITER stores; `MintedSession` is what a
 * BROWSER is shown; and the second is a strict narrowing of a third thing
 * (`SessionView`) that this module also does not declare.
 *
 * ⚠️ INVARIANT 1'S DERIVATION CHAIN BOTTOMS OUT IN AN ENVIRONMENT VARIABLE, AND
 * IT IS RECORDED HERE RATHER THAN CHANGED. `resolveServingHost()` is a registry
 * LOOKUP and refuses an unregistered host — G179's whole point — but the
 * registry is read from `RECONCILE_SERVING_HOSTS`, **not from a table**. So the
 * host→tenant map that invariant 1 rests on is deployment configuration, and a
 * process started with a wrong one derives a wrong tenant correctly. That is
 * worth an owner knowing and it is **not this track's to change**; nothing
 * below depends on it, because nothing below reads a tenant at all.
 */

import type { IdentityConnectionId, SessionId, TenantId, UserId } from './kernel'
import type { Session, SessionHandleDigest, SignInAttemptConsumption, User } from './domain'
import type { SessionBoundRefusal, SessionBounds, SessionBoundsInput } from './session'
/* VALUE imports, and both carry `.ts`: Node's ESM resolver adds no extension,
 * and on 8 Aug 2026 three of sixteen modules could not be LOADED for exactly
 * this reason while `tsc` stayed green. `tests/model/runtime-importability.test.ts`
 * is what catches it. */
import { validateSessionBounds } from './session.ts'
import { normaliseHost } from './serving-host.ts'

/* ------------------------------------------------------------------ *
 * 1. The deep tenant-containment proof
 * ------------------------------------------------------------------ */

type Assert<T extends true> = T
type AssertFalse<T extends false> = T

/**
 * 🛑 A `TenantId` AT ANY PROPERTY POSITION, TRANSITIVELY, MAPS TO `never`.
 *
 * This is `model/reconciliation.ts`'s `NoTextField` idiom pointed at a
 * different leaf, and **it is a different ORDER rather than a second
 * implementation of the same one** — that file bans the TYPE `string` at a
 * property position; this one bans assignability to `TenantId`. Nothing is
 * duplicated: neither guard subsumes the other, and `issuedHost: string` below
 * is a bare string this proof deliberately permits.
 *
 * 🛑 THE ARM ORDER IS LOAD-BEARING AND THE LESSON IS BORROWED RATHER THAN
 * REDISCOVERED. `NoTextField`'s own docblock records it: *"`T extends string`
 * before the callability and object arms, or a branded `Id<'X'>` recurses into
 * `String`'s own method signatures — which are callable — and every branded id
 * in the tree fails."* Every id in this module's input is branded, so getting
 * that order wrong would have failed the whole file rather than silently
 * weakening it — which is the good direction, and is not a reason to guess.
 *
 * THE LEAF TEST IS `Extract`, NOT `extends`, AND THE DIFFERENCE IS A NULL.
 * `TenantId | null extends TenantId` is **false**, so an `extends` test would
 * wave through exactly the field this module exists to refuse — a nullable
 * tenant, which is precisely the shape `Session.tenantId` has and precisely
 * what a writer would copy. `[Extract<T, TenantId>] extends [never]` refuses
 * both. A sibling brand is untouched: `Extract<UserId, TenantId>` is `never`,
 * because `'User' extends 'Tenant'` is false.
 *
 * FAIL-CLOSED AT THREE PLACES, matching `NoTextField` and G106's `DENY_ALL`
 * posture: `unknown extends T` catches `any` and `unknown` before anything else
 * can answer for them; a `Function` is refused because a closure can hold a
 * tenant nothing can see; and an object with no readable member — an opaque
 * leaf — is refused because it is not PROVABLY tenant-free.
 */
type NoTenantField<T> = unknown extends T
  ? never
  : [Extract<T, TenantId>] extends [never]
    ? T extends string
      ? T
      : T extends Function
        ? never
        : T extends readonly (infer U)[]
          ? readonly NoTenantField<U>[]
          : T extends object
            ? [keyof T] extends [never]
              ? never
              : { [K in keyof T]: NoTenantField<T[K]> }
            : T extends number | bigint | boolean | null | undefined
              ? T
              : never
    : never

type NoTenantDeep<T> = { [K in keyof T]: NoTenantField<T[K]> }

/**
 * The constraint form, so a violation fails at the assertion's own line with
 * `TS2344` rather than resolving to a `never` nobody reads. `AssertNoTextDeep`
 * is declared the same way for the same reason.
 */
export type AssertNoTenantDeep<T extends NoTenantDeep<T>> = T

/* ------------------------------------------------------------------ *
 * 2. What a mint is given
 * ------------------------------------------------------------------ */

/**
 * 🛑 THERE IS NO `tenantId` HERE AND THERE MUST NEVER BE ONE. Read the header.
 *
 * ⚠️ AND THERE IS NO `surface`, NO `ServedSurface`, NO `ServingHost` AND NO
 * `state` EITHER — each refused BY NAME, because each is a container a tenant
 * rides in and the second one is the one a reviewer would approve. The proofs
 * below make all four a compile error rather than a habit.
 *
 * ⚠️ HONESTY ABOUT WHAT THE KEY-ABSENCE BUYS, BECAUSE OVERSTATING IT IS WORSE
 * THAN NOT HAVING IT. Excess-property checking is a check on object LITERALS.
 * `mintSession({ …, tenantId: t })` is a `TS2353` — `tests/model/session-mint.test.ts`
 * §1 mounts exactly that with a `@ts-expect-error` — but a caller that builds
 * the object as a wider variable first, or spreads one, passes `tenantId`
 * through with **no error at all**. It is then simply ignored, because nothing
 * in `mintSession()` reads it and nothing in `MintedSessionFacts` can carry it.
 * **That is why the output `Omit` is the load-bearing half and this is the
 * legible one.** Both are asserted; neither is described as the whole defence.
 */
export interface MintSessionInput {
  /** The new session's id. Minted by the caller; this module allocates nothing. */
  readonly id: SessionId
  /**
   * THE NEW SESSION HANDLE'S DIGEST — G160's one digest seam, never the handle.
   *
   * ⚠️ NOT the sign-in attempt's. See `signInHandleDigest` below, which exists
   * only so that confusing the two is a refusal rather than a vulnerability.
   */
  readonly handleDigest: SessionHandleDigest
  /**
   * THE RELAY HANDLE'S DIGEST, CARRIED SOLELY TO BE COMPARED AND REFUSED.
   *
   * `SignInAttempt.handleDigest` is *"The relay/state parameter's DIGEST"* — a
   * value that travelled in a redirect URL and therefore may sit in an access
   * log, a `Referer`, or a browser history entry. Minting a session whose
   * credential digests to the same thing makes the session credential equal to
   * a value already written down in three places. It is a one-character mistake
   * to make and it has no other symptom.
   *
   * ⚠️ IT IS NOT A SECOND SOURCE OF ANYTHING. Nothing below reads it except the
   * equality test, which is why it is a `SessionHandleDigest` and not the
   * attempt row.
   */
  readonly signInHandleDigest: SessionHandleDigest
  /**
   * THE CONSUMED SIGN-IN ATTEMPT'S SUCCESS ARM, AND THE REFUSED ARM IS
   * UNREPRESENTABLE — `Extract<…, { ok: true }>`, so minting from an attempt
   * that was replayed, mismatched or never consumed is a `tsc` error rather
   * than a branch somebody forgets.
   *
   * 🛑 THE CONNECTION COMES FROM HERE AND THE INPUT DECLARES NO OTHER.
   * `consumeSignInAttempt()` says why in its own voice: *"THE SUCCESS ARM
   * RETURNS THE ATTEMPT'S CONNECTION, NOT THE CALLBACK'S … so a handler wiring
   * this up cannot accidentally carry the supplied value forward."* A
   * `connectionId` field beside this one would restore exactly the value that
   * function went out of its way to discard — and `SignInAttempt.connectionId`
   * records that re-choosing the door at callback is *"the ORG AXIS READ FROM A
   * REQUEST — invariant 1's shape, one axis over."*
   */
  readonly consumption: Extract<SignInAttemptConsumption, { readonly ok: true }>
  /**
   * THE PERSON, NARROWED TO THE THREE FIELDS THIS ACT READS.
   *
   * A whole `User` would satisfy this, and taking `Pick` rather than `User`
   * means a fourth field added to `User` does not silently become an input to
   * the mint. Neither shape can carry a tenant — `User` has no `tenantId`, by
   * `model/domain.ts`'s own design — so this narrowing is about blast radius
   * and not about invariant 1.
   */
  readonly user: Pick<User, 'id' | 'status' | 'connectionId'>
  /**
   * THE HOST THE BROWSER PRESENTED — G180, and the binding is PERMANENT.
   *
   * ⚠️ IT IS A HOST AND NEVER A SURFACE. `resolveServedHost()` answers what a
   * host SERVES and its tenant arm carries a `TenantId`; this field is the
   * string, so the mint records where the session was issued without ever
   * learning what is behind it. That distinction is the single most important
   * line in this interface after the absent `tenantId`, and
   * `_MintSessionInputReachesNoTenantDeep` is what keeps it true.
   */
  readonly issuedHost: string
  /**
   * THE SESSION BOUNDS A CONFIGURATION READER PRODUCED, UNVALIDATED.
   *
   * `SessionBoundsInput` rather than `SessionBounds`, deliberately: the
   * validated shape is a plain interface anybody can construct literally, so
   * accepting it would let a caller hand over
   * `{ maxLifetimeSeconds: 999999, maxIdleSeconds: 1 }` and skip G220's
   * ceiling entirely. Taking the raw shape means **every mint runs
   * `validateSessionBounds()` exactly once**, at one call site, which is G111's
   * discipline rather than a convention.
   *
   * 🛑 R7 IS OPEN AND THIS FIELD IS WHERE IT LANDS — *"Where session bounds are
   * configured, per-tenant or platform-wide."* NOT TAKEN HERE. But one half of
   * it is **decided by invariant 1 rather than by preference, and no document
   * says so yet**: at mint time there is no tenant, so a PER-TENANT bound is
   * not merely unconfigured, it is **unreadable** — the act that would consult
   * it has nothing to key on. A per-tenant session bound could only be applied
   * at tenant BINDING, which is `selectTenantForSession()`'s act and a
   * different one, and it would then be shortening a session already minted.
   * ⚠️ THE PRACTICAL CONSEQUENCE TODAY: nothing in the tree configures bounds
   * at all, so until R7 is answered `bounds_not_configured` is not an
   * unreachable arm — **it is the only answer a real mint can produce.**
   */
  readonly bounds: SessionBoundsInput
}

/* ------------------------------------------------------------------ *
 * 3. The proofs — each one red before the shape it guards
 * ------------------------------------------------------------------ */

/**
 * INVARIANT 1, STATED BY NAME ON THE INPUT THAT COULD DEFEAT IT BY RELOCATION.
 *
 * The direct sibling of `model/identity.ts`'s
 * `_InvitationRedemptionCarriesNoTenantId`, and the argument transfers without
 * amendment: nobody deletes the tenant derivation; somebody ADDS a convenient
 * parameter, and the derivation stays where it was and stops being the only
 * source. G315's `state` is the convenient parameter, and it arrives with a
 * ruling behind it.
 *
 * VERIFIED RED: adding `readonly tenantId: TenantId` to `MintSessionInput`
 * fails here with `TS2344`, `Type 'true' does not satisfy the constraint
 * 'false'` — and fails at `_MintSessionInputReachesNoTenantDeep` as well, which
 * is the redundancy that block argues for.
 */
export type _MintSessionInputCarriesNoTenantId = AssertFalse<
  'tenantId' extends keyof MintSessionInput ? true : false
>

/**
 * THE SAME REFUSAL, TRANSITIVELY, AND IT IS THE ONE THAT CATCHES THE REAL CASE.
 *
 * The key check above cannot see a tenant one level down, and one level down is
 * where it would actually arrive. Measured rather than imagined: adding
 * `readonly surface: ServedSurface` — the value the caller is already holding,
 * derived from the host, which is invariant 1's own chain — leaves
 * `_MintSessionInputCarriesNoTenantId` **green** and fails HERE, because
 * `ServedSurface`'s tenant arm carries a `TenantId` and a homomorphic mapped
 * type distributes over a union.
 *
 * VERIFIED RED, three ways, each a shape somebody would plausibly write:
 *   `readonly tenantId: TenantId`            -> TS2344 (also caught above)
 *   `readonly tenantId: TenantId | null`     -> TS2344 (NOT caught by an
 *                                               `extends` leaf test; see
 *                                               `NoTenantField`)
 *   `readonly surface: ServedSurface`        -> TS2344 (caught ONLY here)
 */
export type _MintSessionInputReachesNoTenantDeep = AssertNoTenantDeep<MintSessionInput>

/* ------------------------------------------------------------------ *
 * 4. What a mint produces
 * ------------------------------------------------------------------ */

/**
 * THE SESSION FACTS A WRITER STORES — an `Omit` of `Session`, never a fresh
 * interface, and the `Omit` does two jobs.
 *
 * 🛑 FIRST: `tenantId` IS ABSENT FROM WHAT THE WRITER RECEIVES. This is the
 * half of the defence that does not rest on excess-property checking. Even a
 * caller who smuggles a `tenantId` past the input by spreading a wider object
 * has handed it to a function that never reads it and receives back a value
 * with nowhere to put it, so **the column cannot be written from this path at
 * any price** — and `db/migrations/0005`'s `session_selection_restrictive`
 * refuses it a second time at the row, which W3-S0 measured against a live
 * PostgreSQL (`tests/db/session-mint-scope.test.ts` §2: refused `42501`, with
 * the message naming that policy). Two controls, each sufficient, neither a
 * restatement: one is a `tsc` error at build time, the other a `42501` at run
 * time. That is `server/data-plane/role-grants.ts`'s four-control argument —
 * *"each SUFFICIENT rather than each necessary, which is what makes the
 * duplication defence in depth rather than §5.3"* — with two instead of four.
 *
 * ⚠️ SECOND, AND IT IS WHY THIS IS AN `Omit`: a THIRTEENTH field on `Session`
 * appears here automatically and is a `TS2739` in `mintSession()`'s own return
 * statement — a compile error at the mint rather than a column somebody
 * forgets. That is `server/data-plane/definition-store.ts`'s shape under G1122,
 * taken deliberately: *"a nineteenth field on the engine's interface is a
 * `TS2739` HERE rather than a column somebody forgets."*
 *
 * THE FIVE OMISSIONS, EACH WITH ITS OWN REASON — a long omit list is worth less
 * than a short one, so none of these is filed under another's argument:
 *
 *   `tenantId`        INVARIANT 1. The whole module.
 *   `authenticatedAt` \
 *   `lastUsedAt`       > THE MODEL READS NO CLOCK. See the header: `Timestamp`
 *   `expiresAt`       /  is a string alias and the codec is not started, so
 *                        these are the database's `now()` and `now() +
 *                        interval` on a `timestamptz`, set by the writer.
 *   `secondFactorAt`  DROPPED FOR v1 under G223 — *"no second factor in v1;
 *                     federation owns it."* A mint may not resurrect it.
 *                     ⚠️ THE MARKER IS CITED BY ANCHOR AND NOT COPIED, and
 *                     this line is here because the control CAUGHT THIS FILE:
 *                     a first draft spelled the marker out in prose ABOUT
 *                     another declaration's drop and moved
 *                     `check-doc-counts`'s `dropped markers` from 236 to 237
 *                     while dropping nothing. That is the false-positive class
 *                     `CLAUDE.md` records biting two drafts of
 *                     `model/identity.ts`, arriving a third time. Read the
 *                     marker on `Session.secondFactorAt` itself.
 *
 * ⚠️ `revokedAt` IS **NOT** OMITTED, AND THE ASYMMETRY IS THE POINT. A minted
 * session is not a revoked one, and that is a fact this module can state rather
 * than a column default nobody chose. `model/session.ts` makes the identical
 * argument about a different field — *"a bound with no number is not a bound …
 * It is never silently unbounded, which is the outcome a default would
 * produce."*
 */
export type MintedSessionFacts = Omit<
  Session,
  'tenantId' | 'authenticatedAt' | 'lastUsedAt' | 'expiresAt' | 'secondFactorAt'
>

/**
 * The output cannot carry a tenant either, asserted rather than assumed.
 *
 * ⚠️ IT WOULD BE REASONABLE TO CALL THIS REDUNDANT AGAINST THE `Omit` AND IT IS
 * NOT, for the reason `_SignInAttemptCarriesNoUserId` gives about its own
 * neighbour: *"redundant as a MECHANISM and … not redundant as a RECORD."* The
 * `Omit`'s key list is one edit from losing a name, and losing THIS name is the
 * edit that reads most like tidying — `'tenantId'` sits in a list whose other
 * four members are all about clocks, so a future commit that supplies the
 * timestamp codec will shorten that list and must not shorten it by one too
 * many. This line is what stops that being silent.
 *
 * VERIFIED RED: removing `'tenantId'` from the `Omit` above fails here with
 * `TS2344`.
 */
export type _MintedSessionFactsReachesNoTenantDeep = AssertNoTenantDeep<MintedSessionFacts>

/**
 * `MintedSessionFacts` is a NARROWING of `Session` and never a parallel
 * declaration, pinned so it stays one.
 *
 * VERIFIED RED: re-declaring `MintedSessionFacts` as a hand-written interface
 * with a field `Session` does not have fails here.
 */
export type _MintedSessionFactsIsASessionNarrowing = Assert<
  keyof MintedSessionFacts extends keyof Session ? true : false
>

/* ------------------------------------------------------------------ *
 * 5. The closed refusal union
 * ------------------------------------------------------------------ */

/**
 * Every way a mint can fail that is NOT a bounds failure.
 *
 * ⚠️ NO ARM CARRIES FREE TEXT and no arm carries a host, a handle or an id.
 * `model/session.ts`'s refusals make the same choice in the same words — a
 * refusal is the value most likely to reach a log — and here the values on
 * offer are a session credential's digest and a host, so the rule bites.
 */
export const MINT_SESSION_REFUSALS = {
  /**
   * `validateSessionBounds()` refused. The reasons travel with it rather than
   * being flattened, because they are a NON-EMPTY tuple over there and
   * discarding them would leave a caller with nothing to render.
   */
  sessionBoundsUnusable: 'session_bounds_unusable',
  /**
   * The person is not `active`. `User.status` is *"LOAD-BEARING as of 5 Aug"*
   * and its own docblock records what happened when nothing consulted it: *"a
   * disabled user's assignments evaluated as granted."*
   *
   * ⚠️ REFUSED AT THE MINT AS WELL AS AT THE READ, AND THAT IS NOT A SECOND
   * EVALUATOR. `resolveSubject()` refuses a disabled person on every REQUEST;
   * this refuses MINTING them a credential in the first place. Without it a
   * disabled person holds a live handle that fails on use — which is a
   * different and worse thing than never having one, because the row exists.
   */
  userDisabled: 'user_disabled',
  /**
   * The new session's handle digests to the sign-in relay handle's digest.
   * See `MintSessionInput.signInHandleDigest`.
   */
  sessionHandleReusesSignInHandle: 'session_handle_reuses_sign_in_handle',
  /**
   * The presented host normalises to the empty string.
   *
   * 🛑 MEASURED FROM `checkHostBinding()` RATHER THAN IMAGINED: that function
   * answers `session_host_not_recorded` **with `revoke: true`** when a stored
   * host normalises to `''`. So minting one produces a session that revokes
   * ITSELF on its first request — a credential that exists, passes every other
   * control, and is destroyed by the control meant to protect it. Refusing at
   * the mint is the only place this is a refusal rather than an incident.
   */
  issuedHostNotRecorded: 'issued_host_not_recorded',
} as const

export type MintSessionRefusal =
  (typeof MINT_SESSION_REFUSALS)[keyof typeof MINT_SESSION_REFUSALS]

/**
 * ⚠️ THE BOUNDS ARM IS SEPARATED IN THE RESULT, NOT IN THE VOCABULARY, so the
 * closed set above stays one list and `Exclude` does the narrowing.
 */
export type MintSessionResult =
  | {
      readonly ok: true
      readonly session: MintedSessionFacts
      /**
       * ⚠️ RETURNED BESIDE THE ROW AND NOT ON IT. The writer needs the seconds
       * to compute `expires_at` in SQL; `Session` has no column for a bound,
       * because G220 rules bounds are configuration and the row stores the
       * instant they produced.
       */
      readonly bounds: SessionBounds
    }
  | {
      readonly ok: false
      readonly refusal: typeof MINT_SESSION_REFUSALS.sessionBoundsUnusable
      readonly boundRefusals: readonly [SessionBoundRefusal, ...SessionBoundRefusal[]]
    }
  | {
      readonly ok: false
      readonly refusal: Exclude<
        MintSessionRefusal,
        typeof MINT_SESSION_REFUSALS.sessionBoundsUnusable
      >
    }

export type _MintSessionRefusalsAreExhaustive = Assert<
  Extract<MintSessionResult, { ok: false }>['refusal'] extends MintSessionRefusal
    ? MintSessionRefusal extends Extract<MintSessionResult, { ok: false }>['refusal']
      ? true
      : false
    : false
>

/**
 * A refused mint returns no session facts, asserted so that adding them "for
 * logging" is a compile error. A refusal that carries the row it refused to
 * write is a row, in a log, that nothing revoked.
 */
export type _RefusedMintCarriesNoSession = AssertFalse<
  'session' extends keyof Extract<MintSessionResult, { ok: false }> ? true : false
>

/* ------------------------------------------------------------------ *
 * 6. The mint
 * ------------------------------------------------------------------ */

/**
 * Mint the facts of a session. **Total, fail-closed at every branch, no I/O,
 * no clock, and no tenant.**
 *
 * 🛑 IT DECIDES NOTHING ABOUT AUTHORITY. It does not read a role, a capability,
 * a membership or a grant, and it never calls `decide()`. A session is a
 * statement that a person authenticated through a door; what they may then DO
 * is `model/access.ts`'s, and what they may do it TO is
 * `selectTenantForSession()`'s. Three questions, three functions — and this one
 * answers the smallest.
 *
 * THE ORDER IS THE DESIGN, and each branch answers a different question:
 *
 *   1. Is the PERSON entitled to a credential at all? Asked first because a
 *      disabled person should be refused before anything about the request is
 *      examined, so the refusal is a fact about them and not about their input.
 *   2. Is the credential itself sound — i.e. not the relay handle wearing a
 *      session's name?
 *   3. Is the binding G180 depends on actually recordable?
 *   4. Are the bounds usable? LAST, because it is the only arm that every real
 *      caller currently hits (R7: nothing configures bounds), and putting it
 *      first would mask all three above it during development and leave them
 *      witnessed only by fixtures.
 *
 * ⚠️ ONE CHECK THAT IS DELIBERATELY ABSENT, AND IT IS THE ONE A REVIEWER WILL
 * ASK FOR: `user.connectionId` IS NOT COMPARED AGAINST
 * `consumption.connectionId`. They may legitimately differ, and `Session`'s own
 * declaration says why — *"org is a property of HOW YOU AUTHENTICATED, not of
 * who you are: a dual-affiliated consultant is partner on Monday and customer
 * on Tuesday, and each session has to record which."* An equality check here
 * would read as tightening and would break exactly the case the model was
 * designed to support. **The session records the door it came through; the user
 * records their directory; the two are different facts and neither validates
 * the other.**
 */
export function mintSession(input: MintSessionInput): MintSessionResult {
  if (input.user.status !== 'active') {
    return { ok: false, refusal: MINT_SESSION_REFUSALS.userDisabled }
  }

  if (input.handleDigest === input.signInHandleDigest) {
    return { ok: false, refusal: MINT_SESSION_REFUSALS.sessionHandleReusesSignInHandle }
  }

  /* The ONE normalisation function, CALLED rather than re-implemented —
   * `checkHostBinding()` normalises both sides on every request, so storing the
   * normalised form makes the row equal to what the check compares. */
  const issuedHost = normaliseHost(input.issuedHost)
  if (issuedHost === '') {
    return { ok: false, refusal: MINT_SESSION_REFUSALS.issuedHostNotRecorded }
  }

  const bounds = validateSessionBounds(input.bounds)
  if (!bounds.ok) {
    return {
      ok: false,
      refusal: MINT_SESSION_REFUSALS.sessionBoundsUnusable,
      boundRefusals: bounds.refusals,
    }
  }

  return {
    ok: true,
    session: {
      id: input.id,
      handleDigest: input.handleDigest,
      userId: input.user.id,
      /* The ATTEMPT's connection, which is the only one in scope. */
      connectionId: input.consumption.connectionId,
      issuedHost,
      /* STATED, not defaulted. A minted session is not a revoked one. */
      revokedAt: null,
    },
    bounds: bounds.bounds,
  }
}

/**
 * ⚠️ DECLARED SO THE UNUSED-IMPORT RULE CANNOT BE SATISFIED BY DELETING THE
 * TYPES THE PROOFS ABOVE REST ON. `noUnusedLocals` is on, and `UserId` and
 * `IdentityConnectionId` are reachable only from here — so a future edit that
 * weakens the mint into returning bare strings has to delete a named assertion
 * rather than have the imports fall out of a lint fix.
 *
 * It pins the two ids the mint carries through `Pick` and `Extract`, so a
 * re-brand of either is a failure at a named line.
 */
export type _MintCarriesTheseBrandedIds = Assert<
  MintedSessionFacts['userId'] extends UserId
    ? MintedSessionFacts['connectionId'] extends IdentityConnectionId
      ? true
      : false
    : false
>

/* ------------------------------------------------------------------ *
 * 7. The claim projection — W3-S1/S3, G1638, 21 Sep 2026
 * ------------------------------------------------------------------ */

/**
 * 🛑 WHY THIS LIVES IN THIS MODULE AND NOT IN `model/domain.ts`, WHICH IS
 *    WHERE `consumeSignInAttempt()` SITS.
 *
 * Because the projection below is **exactly the place a tenant could be
 * conferred by a token**, and this module is the one whose entire purpose is
 * proving that no tenant reaches a mint. An identity provider is free to emit
 * a `tenant`, `org`, `tid` or `custom:tenant` claim — Entra emits `tid` on
 * every token it issues — and a projection that grew a third output field
 * would be invariant 1 breached through a claim map an OPERATOR controls,
 * which is further from review than any of the paths §1 defends against.
 *
 * `AssertNoTenantDeep<ProvisionedPersonFacts>` below is what makes that a
 * `TS2344` instead of a code review. The projection's output is TWO strings
 * and the callers' own ids; it has no arm that could carry a `TenantId`, and
 * the assertion is what keeps it that way.
 *
 * ⚠️ AND IT DELIBERATELY DOES NOT REACH `IdentityConnection`. The claim map is
 * read by `server/data-plane/session-mint-store.ts` as two bare strings and
 * never travels on a model type, so no claim name can reach `orgFor()`,
 * `decide()` or any authorisation surface. That containment is asserted at
 * `tests/db/external-subject-and-claim-map.test.ts` §7 rather than described.
 */

/**
 * The claim names an operator declared for ONE door.
 *
 * ⚠️ BOTH ARE `string | null` AND `null` IS A REFUSAL RATHER THAN A DEFAULT —
 * `db/migrations/0200` §4's polarity, carried into the type so a reader cannot
 * reach for `?? 'email'`. The OIDC standard names are the obvious fall-back and
 * are refused: a default that is right for every door we provisioned and wrong
 * for a BYOA door maps the wrong claim SILENTLY.
 *
 * 🛑 THERE IS NO `subjectClaim` AND THERE MUST NOT BE. The subject is `sub`,
 * fixed — the migration's §4 argues it at length, and the deciding half is that
 * a subject mapped to a mutable claim makes an account REASSIGNABLE.
 */
export interface ConnectionClaimMap {
  readonly emailClaim: string | null
  readonly nameClaim: string | null
}

/**
 * What a verified token yields about a person, once the map is applied.
 *
 * ⚠️ IT CARRIES NO `connectionId` AND NO ids AT ALL. The door is the SCOPE's
 * and the caller's; a projection that also named a connection would be a second
 * source for the one fact `orgFor()` reads, which is `0009`'s rule.
 */
export interface ProvisionedPersonFacts {
  readonly email: string
  readonly displayName: string
}

/** The projection cannot carry a tenant. See the block above. */
export type _ProvisionedPersonFactsReachNoTenantDeep =
  AssertNoTenantDeep<ProvisionedPersonFacts>

/**
 * Every way the projection can refuse.
 *
 * ⚠️ NO ARM CARRIES THE CLAIM NAME OR THE CLAIM VALUE, for
 * `MINT_SESSION_REFUSALS`' stated reason one section up: a refusal is the value
 * most likely to reach a log, and here the values on offer are a person's
 * address and a claim name an operator chose. `claim_absent` and
 * `claim_not_a_string` do not say WHICH, and a reader wanting that has the
 * connection row in front of them.
 */
export const PROJECT_PERSON_REFUSALS = {
  /** The door declares no map. `db/migrations/0200` §4: a refusal, not `sub`. */
  connectionClaimMapAbsent: 'connection_claim_map_absent',
  /** A declared claim is missing from the verified claim set. */
  claimAbsent: 'claim_absent',
  /** A declared claim is present and is not a non-empty string. */
  claimNotAString: 'claim_not_a_string',
} as const

export type ProjectPersonRefusal =
  (typeof PROJECT_PERSON_REFUSALS)[keyof typeof PROJECT_PERSON_REFUSALS]

export type ProjectPersonResult =
  | { readonly ok: true; readonly person: ProvisionedPersonFacts }
  | { readonly ok: false; readonly refusal: ProjectPersonRefusal }

/**
 * Apply one door's claim map to one verified claim set.
 *
 * 🛑 THE CLAIMS ARE `unknown` BY PARAMETER TYPE AND THAT IS THE POINT. They
 * come from a token — JSON somebody else authored — so typing them
 * `Record<string, string>` would be a claim about a value we do not control,
 * and `verifyIdentityToken()`'s own header makes the same argument in its own
 * voice: *"nothing read from an unverified token is a fact"*. Here the token IS
 * verified, which makes the values AUTHENTIC and still not TYPED: a broker may
 * legitimately emit `email_verified: false` or a numeric `name`.
 *
 * ⚠️ IT READS NO CLOCK, TAKES NO PRINCIPAL AND DECIDES NOTHING ABOUT ACCESS.
 * It is asked strictly before `mintSession()` and its refusal is a 4xx about
 * the DOOR's configuration, never a 403 about the caller.
 */
export function projectPerson(
  map: ConnectionClaimMap,
  claims: Readonly<Record<string, unknown>>,
): ProjectPersonResult {
  if (map.emailClaim === null || map.nameClaim === null) {
    return { ok: false, refusal: PROJECT_PERSON_REFUSALS.connectionClaimMapAbsent }
  }

  /* `noUncheckedIndexedAccess` is on, so both of these are `unknown | undefined`
   * and the two arms below are forced rather than defensive. */
  const rawEmail = claims[map.emailClaim]
  const rawName = claims[map.nameClaim]

  if (rawEmail === undefined || rawName === undefined) {
    return { ok: false, refusal: PROJECT_PERSON_REFUSALS.claimAbsent }
  }

  /* ⚠️ EMPTY IS REFUSED WITH NON-STRING, and the two are one arm deliberately:
   * `''` would satisfy a `typeof` check and produce a person with no address,
   * which is a row nothing downstream can use and nothing downstream refuses. */
  if (typeof rawEmail !== 'string' || rawEmail === '') {
    return { ok: false, refusal: PROJECT_PERSON_REFUSALS.claimNotAString }
  }
  if (typeof rawName !== 'string' || rawName === '') {
    return { ok: false, refusal: PROJECT_PERSON_REFUSALS.claimNotAString }
  }

  return { ok: true, person: { email: rawEmail, displayName: rawName } }
}

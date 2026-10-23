/**
 * THE DATA PLANE'S AUTHORISER — IT ASKS `decide()`, AND SINCE 19 Sep 2026 IT
 * CAN ANSWER `held`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ **G299 LANDED AND THE HEADING OF THIS FILE WAS *"IT STILL REFUSES
 *    EVERYTHING"* UNTIL IT DID.** THE WHOLE OF THE ACCOUNTING BELOW IS KEPT
 *    RATHER THAN DELETED, BECAUSE IT IS QUOTED IN FOUR OTHER FILES AND BECAUSE
 *    A READER HAS TO BE ABLE TO SEE WHAT MOVED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **What is now true, field by field, against the tree:**
 *
 *   ✅ `tenantId`      the session row. Unchanged.
 *   ✅ `now`           the request's clock. Unchanged.
 *   ✅ `subject`       `tenant."user"` — 0009. `status` is READ, so §8.6's
 *                      *"consulted by NOTHING"* field is consulted twice:
 *                      `resolveSubject()` refuses `user_disabled`, and
 *                      `decide()` reads the term again at step 1.
 *   ✅ `orgClass`      `tenant.identity_connection` — 0009 — through
 *                      `orgFor(connection.owner)` inside `resolveSubject()`,
 *                      and through nothing else.
 *   ✅ `partnerId`     the same row's owner arm.
 *   ✅ `partnerGrant`  `tenant.partner_access_grant` — **0039, G576, 19 Sep
 *                      2026.** ⚠️ **THIS ROW READ `⛔ STILL NO
 *                      `partner_access_grant` TABLE` AND IT IS CORRECTED
 *                      RATHER THAN DELETED**, because it is the sentence four
 *                      files quote and the one a reader would trust before
 *                      deciding the partner arm is unreachable. The table
 *                      exists; `server/data-plane/identity.ts` §6a reads it
 *                      with an EMPTY `WHERE`, so all four of `decide()`'s
 *                      partner refusals stay reachable.
 *   ✅ `held`          `tenant.role` × `tenant.role_capability` ×
 *                      `tenant.role_assignment` — 0009.
 *   ✅ `platformHeld`  `tenant.platform_role` ×
 *                      `tenant.platform_role_assignment` — 0009. G289's owed
 *                      term, produced.
 *   ✅ `partnerHeld`   `tenant.partner_role` × `tenant.partner_role_capability`
 *                      × `tenant.partner_role_assignment` — **0250, R10,
 *                      1 Oct 2026, THE OWNER'S.** The fifth arm's term. A
 *                      NINTH term, and read only on the CONSOLE surface for a
 *                      `partner` principal (`resolveAuthority()`); it is
 *                      optional on `PrincipalSubstrate`, so its absence is
 *                      *"no reader ran"* and the eight-of-eight sentence below
 *                      is about the eight that every surface reads. ⚠️ **NO
 *                      ROW HAS EVER BEEN WRITTEN**, so every portal act is
 *                      refused at `partner_staff_assignment_absent` today.
 *
 * 🛑 THE HONEST SUMMARY IS NOW **EIGHT OF EIGHT** — ⚠️ **AND IT READ "SEVEN OF
 *    EIGHT, AND THE EIGHTH REFUSES ON THE RIGHT ARM" UNTIL G576 ON 19 Sep
 *    2026.** A customer principal with a live assignment carrying the verb is
 *    ALLOWED, and so now is a PARTNER principal whose customer has granted one
 *    — inside `PARTNER_CAPABILITY_MASK` and nowhere outside it.
 *    `tests/http/identity-substrate-served.test.ts` witnesses the customer
 *    side over a socket and removes one term at a time;
 *    `tests/http/partner-arm-served.test.ts` does the same for the partner arm
 *    and adds the two things only a partner has — a SCOPE differential and a
 *    MASK ceiling.
 *
 * ⚠️ EIGHT OF EIGHT IS NOT "INVARIANT 2 IS FINISHED", AND THE GAP THAT SURVIVES
 *    IS NAMED RATHER THAN GLOSSED. The invariant is a CONJUNCTION —
 *    *"`partner_admin(P)` may read tenant `T` iff `T.partnerId = P`, and only
 *    within a live `PartnerAccessGrant`"* — and the first conjunct is held by
 *    `0039`'s composite FOREIGN KEY at WRITE time, not by anything on this
 *    path. Nothing here re-checks it, deliberately: a grant row that exists at
 *    all is one the database already proved was issued by the tenant that
 *    partner sold. **The residual is that nothing in `model/` re-derives it, so
 *    a future writer reaching this table by a route that bypasses the
 *    constraint — a restore, a manual `ALTER`, a second schema — would not be
 *    caught here.** `tests/db/partner-access-grant.test.ts` §2 is what keeps
 *    the constraint honest.
 *
 * ⚠️ AND THE OLD HEADER'S SHARPEST SENTENCE IS STILL BINDING, WHICH IS WHY IT
 * IS QUOTED RATHER THAN RETIRED: *"`orgClass` IS THE ONE THAT WOULD HAVE BEEN
 * FABRICATED … Fabricating one would route a PARTNER's principal down
 * `decide()`'s customer arm, skipping — in one assignment — the live-grant
 * check, the `partnerId` agreement check §9.5 exists for, the revocation check,
 * the expiry check and `PARTNER_CAPABILITY_MASK`'s intersection. That is five
 * controls deleted by a default value, and `decide()` would report success the
 * whole way."* Nothing about that changed; what changed is that there is a row
 * to read instead of a default to resist.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * THE ORIGINAL HEADER FOLLOWS, AS WRITTEN. Its premise is discharged and its
 * arguments are not.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ THIS FILE WAS A `denyAll` THAT READ NEITHER OF ITS PARAMETERS, AND ITS
 * OWN HEADER IS QUOTED RATHER THAN DELETED BECAUSE IT WAS RIGHT AND IS NOW
 * HALF-RIGHT: *"A capability is held BY A SUBJECT. There is no subject here to
 * hold one: this repository declares no identity substrate at all."* **Half of
 * that ended on 19 Sep 2026.** `db/migrations/0005_session_and_membership.sql`
 * shipped `tenant.session` and `tenant.membership`, and D1 binds a real tenant
 * to a real session row. **The other half did not end, and it is the half a
 * capability turns on.** Derive it; do not take it from this line:
 *
 *     grep -h 'CREATE TABLE' db/migrations/*.sql db/migrations-control/*.sql
 *
 * returns `tenant`, `tenant_contact`, `run`, `tenant.subject_ledger`,
 * `pack_catalogue`, `tenant.membership` and `tenant.session`. **There is no
 * `user`, no `identity_connection`, no `role` and no `role_assignment`.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 FIVE OF `PrincipalContext`'s SEVEN FIELDS HAVE NO PRODUCER, NOT ONE.
 *    STATE THE NUMBER, BECAUSE THE RECORD HAS BEEN STATING A SMALLER ONE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `tests/http/deployed-path-cannot-be-permissive.test.ts` says the gap is
 * *"no `user`, `session`, `role` or `role_assignment` table"* and the brief
 * over this slice narrows it further, to `held[]` alone. **Both understate it.**
 * Field by field, against the tree:
 *
 *   ✅ `tenantId`      — the session row. D1 binds it; G199 gates the binding.
 *   ✅ `now`           — the request's clock, supplied rather than read inside
 *                        the model, for `PrincipalContext.now`'s own reason.
 *   ⛔ `subject`       — `{ userId, status }`. `userId` IS on the session row;
 *                        **`status` is not, and there is no `user` table**, so
 *                        the field §8.6 was written about — *"`User.status:
 *                        'disabled'` was consulted by NOTHING"* — has nothing
 *                        to be consulted in. A DISABLED PERSON IS INDISTIN-
 *                        GUISHABLE FROM A LIVE ONE HERE.
 *   ⛔ `orgClass`      — `orgFor(connection.owner)`, and there is no
 *                        `identity_connection` table.
 *   ⛔ `partnerId`     — the same row.
 *   ⛔ `partnerGrant`  — no `partner_access_grant` table.
 *   ⛔ `held`          — no `role` and no `role_assignment` table.
 *
 * 🛑 AND `orgClass` IS THE ONE THAT WOULD HAVE BEEN FABRICATED, SO IT GETS THE
 * ARGUMENT. A membership row exists for this principal in this tenant — D1
 * proved it — and the tempting inference is `orgClass: 'customer'`. **It is
 * WRONG, and wrong in the direction that matters.** `Membership.expiresAt`'s
 * own declaration reads *"Partner-scoped memberships must expire. Null only
 * for direct staff"*, so a membership is NOT evidence of a customer
 * organisation. Fabricating one would route a PARTNER's principal down
 * `decide()`'s customer arm, skipping — in one assignment — the live-grant
 * check, the `partnerId` agreement check §9.5 exists for, the revocation
 * check, the expiry check and `PARTNER_CAPABILITY_MASK`'s intersection. That
 * is five controls deleted by a default value, and `decide()` would report
 * success the whole way.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 SO WHAT CHANGED, EXACTLY, AND WHAT DID NOT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHAT CHANGED: the MECHANISM is real. This file now resolves a
 * `PrincipalContext` through one total function, narrows the opaque capability
 * string against the model's closed set, and calls `decide()` — the single
 * evaluator — with the result. When the missing tables land, the substrate
 * gains readers and this file does not change.
 *
 * WHAT DID NOT: the ANSWER. Every capability-tier operation still answers 403
 * to every caller, because `principalContextFor()` refuses to assemble a
 * context out of five absences. **A mounted D1 and a real session row do not
 * make a capability holdable.**
 *
 * ⚠️ AND THE PART THAT MAKES THIS MORE THAN A RENAMED `denyAll` IS WITNESSED
 * RATHER THAN CLAIMED. `tests/http/capability-decide.test.ts` hands
 * `principalContextFor()` a COMPLETE substrate — a live role, a live
 * assignment, an active subject, a customer org — and requires `'held'` back;
 * then removes one term at a time and requires `'not_held'` for each. Without
 * the allow arm this file would be indistinguishable from the `denyAll` it
 * replaces, which is `docs/HANDOFF.md` §5.6 wearing a decision's clothes.
 *
 * 🛑 `held: []` DENIES, AND `held: null` REFUSES BEFORE `decide()` — TWO STATES
 * AND NOT ONE. An empty array means a reader ran and found no assignments;
 * `decide()` answers `no_live_assignment` and denies. `null` means there is no
 * reader at all. Collapsing them would make "nobody has granted this person
 * anything" and "we cannot tell" the same answer, and only one of those is a
 * fact about the tenant.
 */

import {
  CAPABILITIES,
  decide,
  type Capability,
  type HeldAssignment,
  type HeldPartnerAssignment,
  type HeldStaffGrant,
  type HeldPlatformAssignment,
  type OrgClass,
  type PartnerGrantTerms,
  type PrincipalContext,
} from '../../model/access.ts'
import type { PartnerId, TenantId, Timestamp, UserId } from '../../model/kernel.ts'
import type { CapabilityAuthoriser } from '../http/app.ts'
import type { TenantSession } from './session.ts'

/**
 * THE FIVE TERMS A `PrincipalContext` NEEDS THAT THIS DATABASE CANNOT SUPPLY,
 * EACH WITH THE TABLE THAT WOULD SUPPLY IT.
 *
 * ⚠️ `null` IS THE ONLY VALUE ANY OF THESE TAKES IN A SERVING PROCESS TODAY,
 * and the type admits the real ones so that the seam is a PARAMETER rather
 * than a rewrite. A reader that lands later fills a field; nothing about the
 * evaluation below changes.
 */
export interface PrincipalSubstrate {
  /** `user`. §8.6 — the status a disabled person's assignments must not survive. */
  readonly subject: { readonly userId: UserId; readonly status: 'active' | 'disabled' } | null
  /** `identity_connection`, through `orgFor(connection.owner)`. Never guessed. */
  readonly orgClass: OrgClass | null
  /** `identity_connection`. Null is a VALUE when the org is not `partner`. */
  readonly partnerId: PartnerId | null
  /**
   * `tenant.partner_access_grant` — **0039, G576, 19 Sep 2026.** Null is a
   * VALUE when the org is not `partner`, and also when it IS `partner` and the
   * customer has granted nobody; see `ResolvedPrincipal.partnerGrant` for why
   * those two are one state here and `platformHeld`'s three are not.
   */
  readonly partnerGrant: PartnerGrantTerms | null
  /**
   * `role` × `role_assignment`. **`null` is "no reader"; `[]` is "no rows".**
   * See the header — the two must not be collapsed.
   */
  readonly held: readonly HeldAssignment[] | null
  /**
   * `platform_role` × `platform_role_assignment`. **G289's OWED TERM, SUPPLIED
   * — G299, 19 Sep 2026.** That row names the debt in its own voice:
   * *"`platformHeld` is OPTIONAL because `server/data-plane/authorise.ts` is
   * the only construction site outside `tests/` and this slice was fenced out
   * of `server/`; making it required, with the matching `PrincipalSubstrate`
   * term, is a `server/` edit."* **This is that edit, and it lands the half
   * that has a producer.**
   *
   * ⚠️ AND IT DELIBERATELY DOES NOT LAND THE OTHER HALF. `PrincipalContext
   * .platformHeld` STAYS OPTIONAL. Making it required would collapse the ABSENT
   * state, and `tests/model/platform-arm.test.ts` asserts that state by name —
   * it destructures the term away with `const { platformHeld: _omitted, ...}`
   * and requires `platform_assignment_unreadable`. **Required would delete that
   * assertion rather than strengthen it**, and the three states are the
   * control: ABSENT and `null` both mean *"we cannot tell"*, `[]` means *"they
   * hold none"*, and only one of those is a fact about a person. The direction
   * of the default is what makes the interim safe and it is unchanged: an
   * omitted term refuses.
   *
   * 🛑 `null` HERE IS *"NO READER RAN"* AND IS THE VALUE FOR EVERY NON-PLATFORM
   * ORGANISATION, WHICH IS NOT A GAP. `decide()` reads this term only after
   * `orgClass` has said `platform`; looking up a customer's platform
   * assignments would answer a question nobody asked, and reporting `[]` would
   * assert a fact nothing checked.
   */
  readonly platformHeld: readonly HeldPlatformAssignment[] | null
  /**
   * R10, 1 Oct 2026 — the fifth arm's term, `readPartnerHeld()`. OPTIONAL
   * where `platformHeld` is required, and the asymmetry is churn avoided rather
   * than a different meaning: absent and `null` are the same state — *"no
   * reader ran"* — and `decide()` refuses it at
   * `partner_staff_assignment_unreadable`. Never defaulted to `[]`.
   */
  readonly partnerHeld?: readonly HeldPartnerAssignment[] | null
  /**
   * G2591, 1 Oct 2026 (G2407, THE OWNER'S) — `readStaffGrant()`'s grant.
   * OPTIONAL: absent and `null` both mean *"no grant offered"*, and on this
   * term that is a FACT because a failed read is a 401 upstream. `decide()`
   * reads it on the platform arm only, and re-derives liveness itself.
   */
  readonly staffGrant?: HeldStaffGrant | null
}

/**
 * WHAT A SERVING PROCESS HOLDS. Every term absent, stated once, in the one
 * place a future reader has to delete a `null` from.
 *
 * 🛑 IT IS A CONSTANT AND NOT A FUNCTION, DELIBERATELY. A function returning
 * this would be a place somebody could put an `if`, and an `if` here is how
 * `orgClass: 'customer'` arrives — see the header for the five controls that
 * one default would delete.
 */
export const NO_IDENTITY_SUBSTRATE: PrincipalSubstrate = {
  subject: null,
  orgClass: null,
  partnerId: null,
  partnerGrant: null,
  held: null,
  platformHeld: null,
}

/**
 * A RESOLVED SESSION → THE THING `decide()` IS EVALUATED AGAINST. **G299,
 * 19 Sep 2026, and this function is why `denyAllCapabilities` is no longer the
 * default an entry point takes.**
 *
 * 🛑 IT IS A PROJECTION AND NOT A RESOLUTION, AND THE DISTINCTION IS WHERE THE
 * WORK HAPPENS. Every term below was read from a row by
 * `server/data-plane/identity.ts`, inside the scope that owns that row, during
 * AUTHENTICATION. Nothing is looked up here, nothing is defaulted here, and
 * there is no `if` here that could become `orgClass: 'customer'` — the header
 * names the five controls that one assignment would delete. A session that
 * resolved no principal projects to `NO_IDENTITY_SUBSTRATE`, which refuses.
 *
 * ✅ **`partnerGrant` IS A ROW SINCE G576, 19 Sep 2026, AND THIS PARAGRAPH'S
 * LAST SENTENCE PREDICTED THE COMMIT THAT DID IT.** ⚠️ **The original is quoted
 * rather than deleted, because it is the sentence four files carry and the one
 * that told a reader the partner arm was unreachable:**
 *
 *   *"`partnerGrant` IS `null` UNCONDITIONALLY AND THAT IS A STATED GAP RATHER
 *    THAN A VALUE. **There is no `partner_access_grant` table**, so a partner
 *    principal — one whose `IdentityConnection.owner.kind` is `partner`,
 *    resolved through the door and not guessed — reaches `decide()`'s partner
 *    arm and is refused at `partner_grant_absent`, **by name, on the right
 *    arm**. … The commit that builds the grant table fills this field and
 *    changes nothing else here."*
 *
 * **It changed nothing else here.** The line below reads a term
 * `server/data-plane/session.ts` had already resolved, and this function is
 * still a PROJECTION: nothing is looked up here, nothing is defaulted here.
 * A partner whose customer has granted nobody is still refused at
 * `partner_grant_absent` — which is now a fact about that customer's decision
 * rather than about our schema, and those are different sentences wearing one
 * refusal.
 */
export function substrateFromSession(session: TenantSession): PrincipalSubstrate {
  const principal = session.principal
  if (principal === null) return NO_IDENTITY_SUBSTRATE
  return {
    subject: principal.subject,
    orgClass: principal.orgClass,
    partnerId: principal.partnerId,
    partnerGrant: principal.partnerGrant,
    held: principal.held,
    platformHeld: principal.platformHeld,
    partnerHeld: principal.partnerHeld ?? null,
    staffGrant: principal.staffGrant ?? null,
  }
}

/** The name of each term, for a refusal that says which ones were missing. */
export type MissingTerm = 'subject' | 'orgClass' | 'held'

export type PrincipalResolution =
  | { readonly ok: true; readonly principal: PrincipalContext }
  | { readonly ok: false; readonly missing: readonly MissingTerm[] }

/**
 * A session plus a substrate → the thing `decide()` takes, or a stated refusal.
 *
 * Total. Never throws. Reads no clock — `now` is supplied, for
 * `PrincipalContext.now`'s reason.
 *
 * 🛑 THREE TERMS ARE CHECKED AND FOUR FIELDS ARE FILLED, AND THE ASYMMETRY IS
 * NOT A MISS. `partnerId` and `partnerGrant` are LEGITIMATELY `null` for a
 * customer principal — `PrincipalContext` declares both *"Null unless
 * `partner`"* — so a `null` there is a value, not an absence, and demanding one
 * would make every customer unresolvable. `decide()` already refuses a
 * `partner` org whose grant is null, at `partner_grant_absent`, which is the
 * single evaluator owning its own term rather than this function second-
 * guessing it.
 *
 * 🛑 AND THE `tenantId` TERM IS NULLABLE SINCE G728, 19 Sep 2026. ⚠️ **THIS
 * PARAGRAPH READ *"IT IS NOT CHECKED HERE EITHER, BECAUSE IT CANNOT BE ABSENT
 * AT THIS POINT … a session with no bound tenant reaching a tenant-scoped
 * operation is the case `boundTenantOf()` throws on"*, AND IT IS CORRECTED
 * RATHER THAN DELETED, because it is the sentence that told a reader a
 * tenant-less principal could not exist.** It CAN: the owner ruled on
 * 19 Sep 2026 that the data plane serves the console hosts with tenant-less
 * sessions, and `session.tenant_id = NULL` is legal there.
 *
 * **It is still not CHECKED here, and now that is a decision rather than a
 * tautology.** `decide()` owns the term: its platform arm reads no tenant at
 * all and its `principal_holds_no_tenant` guard refuses every other arm by
 * name. A refusal here would be a second answer to a question the single
 * evaluator already answers — *"Splitting one decision across two components
 * is the structural precondition for a confused deputy"* — and it would refuse
 * the one principal the owner's ruling exists to admit.
 *
 * 🛑 `boundTenantOf()` IS UNCHANGED AND IS STILL THE BACKSTOP, which is the
 * half of the old paragraph that survives whole: a HANDLER reaching a
 * tenant-scoped read with no tenant still THROWS, because *"a 403 would be a
 * gate reporting success at doing nothing."* What changed is that the gate can
 * now answer for a caller who has none, instead of refusing them before the
 * evaluator is asked.
 */
export function principalContextFor(input: {
  readonly tenantId: TenantId | null
  readonly substrate: PrincipalSubstrate
  readonly now: Timestamp
}): PrincipalResolution {
  const { substrate } = input
  const missing: MissingTerm[] = []
  if (substrate.subject === null) missing.push('subject')
  if (substrate.orgClass === null) missing.push('orgClass')
  /**
   * 🛑 `held` IS REQUIRED ONLY WHERE IT IS READABLE — G728, AND THE CONDITION
   * IS THE SURFACE RATHER THAN A FLAG. A `RoleAssignment` is a tenant-scoped
   * row; a principal with no tenant has no scope those rows could have been
   * read under, so `null` there is *"no reader ran"* AND *"no reader could
   * have"*. Demanding the term would make every console principal
   * unresolvable and the owner's ruling inert.
   *
   * ⚠️ AND IT IS NOT A HOLE, BECAUSE `decide()` NEVER READS `held` ON A
   * TENANT-LESS PRINCIPAL. The platform arm reads `platformHeld`; every other
   * arm stops at `principal_holds_no_tenant`, which sits ABOVE the assignment
   * loop. **There is no path on which a `null` passed here is iterated**, and
   * `tests/model/console-principal.test.ts` §3 is the differential that says
   * so by removing the term and requiring the same refusal back.
   */
  if (input.tenantId !== null && substrate.held === null) missing.push('held')
  if (
    substrate.subject === null ||
    substrate.orgClass === null ||
    (input.tenantId !== null && substrate.held === null)
  ) {
    return { ok: false, missing }
  }

  return {
    ok: true,
    principal: {
      subject: substrate.subject,
      tenantId: input.tenantId,
      orgClass: substrate.orgClass,
      partnerId: substrate.partnerId,
      partnerGrant: substrate.partnerGrant,
      /**
       * ⚠️ `?? null` IS NOT A DEFAULT AND IS NOT A FABRICATION — G728. On a
       * tenant surface the guard above has already refused a `null`, so this
       * expression cannot fire; on a console surface it passes the honest
       * `null` through to a `decide()` that never reads it. `[]` here would
       * be the one thing the three-state discipline forbids: *"a reader ran
       * and they hold none"*, asserted about a query nobody issued.
       */
      held: substrate.held ?? null,
      /**
       * ⚠️ THE TERM IS NOW ALWAYS PASSED AND ITS ABSENT STATE IS NEVER
       * PRODUCED BY THIS FUNCTION, WHICH IS THE PRACTICAL HALF OF G289's OWED
       * ITEM. `null` still reaches `decide()` — for every non-platform
       * organisation and for a substrate with no reader — and `null` is
       * `platform_assignment_unreadable`, a refusal with a name. **The
       * direction of the default is unchanged: there is no value of this field
       * that permits anything.**
       */
      platformHeld: substrate.platformHeld,
      partnerHeld: substrate.partnerHeld ?? null,
      staffGrant: substrate.staffGrant ?? null,
      now: input.now,
    },
  }
}

/**
 * The opaque wire string → a member of the closed set, or `null`.
 *
 * 🛑 THIS IS NOT THE `.includes()` `model/access.ts` FORBIDS, AND THE
 * DIFFERENCE IS WHICH SET IS BEING SEARCHED. That prohibition is about a
 * PRINCIPAL's capability set — *"A two-halves API will be half-called,
 * once"* — and asking whether a principal's roster contains a verb is the
 * evaluation `decide()` owns. This asks whether a string the ROUTER read out
 * of a YAML document names a verb the model declares at all. One is a
 * decision about a caller; the other is a decision about a vocabulary, and a
 * string that is in no vocabulary can be decided by nobody.
 *
 * ⚠️ AN UNRECOGNISED CAPABILITY IS A REFUSAL AND NOT A THROW, WHICH IS THE
 * OPPOSITE OF THE CHOICE `server/data-plane/context.ts` MAKES FOR AN
 * UNCLASSIFIABLE TENANT ROW. The two differ because a boot fence already
 * covers this one: `mountTier()`'s third fence refuses an operation whose
 * annotation is absent or malformed, and `tools/check-capability-annotations.mjs`
 * walks every tier in the gate. Reaching here with a non-member therefore
 * means the CONTRACT names a verb the model does not — a drift a 403 states
 * safely and a 500 states loudly at the caller instead of at us.
 */
export function asCapability(value: string): Capability | null {
  const members = Object.values(CAPABILITIES) as readonly Capability[]
  return members.find((m) => m === value) ?? null
}

/**
 * Build the authoriser from a substrate reader.
 *
 * ⚠️ THE READER IS A PARAMETER SO THAT THE ALLOW ARM CAN BE WITNESSED, and
 * that is the same shape — and the same justification — as
 * `startDataPlane()`'s `authorise` option: *"G200's gate can only be witnessed
 * by a MATCHED PAIR."* The difference, and it is the one that matters, is that
 * this parameter cannot make a plane permissive on its own: whatever substrate
 * it returns, the verdict still comes from `decide()`, and `decide()` is the
 * single evaluator. A reader that returned a fabricated substrate would be
 * lying to the evaluator rather than replacing it — which is why
 * `NO_IDENTITY_SUBSTRATE` is the only one that exists outside `tests/`.
 */
export function capabilityAuthoriser(
  substrateFor: (session: TenantSession) => PrincipalSubstrate,
  clock: () => string = () => new Date().toISOString(),
): CapabilityAuthoriser<TenantSession> {
  return (session, capability) => {
    /**
     * 🛑 THIS LINE READ `if (session.tenantId === null) return 'not_held'` AND
     * IT IS DELETED RATHER THAN WEAKENED — G728, 19 Sep 2026. It is recorded
     * here because it was a REAL control for as long as every session had a
     * tenant, and because deleting a refusal is the change a reader must be
     * able to see the argument for.
     *
     * **What it did:** refuse every gated operation to a session whose tenant
     * column was NULL — which, before the owner's console ruling, meant
     * exactly one thing: an authenticated caller standing in front of D1, with
     * `principal: null` behind them. The refusal was correct and it was also
     * REDUNDANT even then, because `substrateFromSession()` projects such a
     * session to `NO_IDENTITY_SUBSTRATE` and `principalContextFor()` refuses
     * it for three missing terms.
     *
     * **Why it has to go:** a console session is tenant-less BY DESIGN and
     * carries a resolved principal. Keeping the line would refuse the one
     * caller the ruling exists to admit, before `decide()` — the single
     * evaluator — was asked anything, which is the two-halves split this
     * module's own header forbids.
     *
     * 🛑 NOTHING IS WIDENED BY THE DELETION AND THE REFUSALS ARE NAMED RATHER
     * THAN ASSUMED. A pre-D1 session still refuses, at `principalContextFor()`,
     * for three missing terms. A console session whose organisation is
     * `customer` or `partner` refuses at `principal_holds_no_tenant`. A
     * console session whose organisation is `platform` is EVALUATED — and
     * every capability-tier verb this plane mounts is of class `tenant_data`
     * or `identity`, both of which `PLATFORM_ASSIGNMENT_REACHES` refuses, so
     * it is refused at `platform_class_out_of_reach`. **Three different
     * refusals where there was one, each answerable.**
     */
    const verb = asCapability(capability)
    if (verb === null) return 'not_held'

    const resolution = principalContextFor({
      /**
       * ⚠️ THE CAST IS ON THE NON-NULL ARM ONLY — G97 makes every branded id
       * `text` and the session column is a `string | null`, so this is the
       * same cast of SHAPE the rest of this directory makes at its row seams,
       * with the `null` passed through untouched rather than coerced.
       */
      tenantId: session.tenantId === null ? null : (session.tenantId as TenantId),
      substrate: substrateFor(session),
      now: clock() as Timestamp,
    })
    if (!resolution.ok) return 'not_held'

    /**
     * 🛑 THE ONLY EVALUATION IN `server/`. `model/access.ts`: *"Splitting one
     * decision across two components is the structural precondition for a
     * confused deputy."* The `scope` on the decision is deliberately NOT read
     * here — `PlaneOptions.authorise` answers `held | not_held` and a scope is
     * a handler's question about a resource, which a `preValidation` hook does
     * not have. Reading it here and dropping it would be worse than not
     * reading it: a narrowed grant would look like an unconditional one.
     */
    return decide(resolution.principal, verb).allowed ? 'held' : 'not_held'
  }
}

/**
 * WHAT A SESSION MAY DO, FOR DRAWING ONLY — G3521, 3 Oct 2026 (DERIVED, NOT
 * THE OWNER'S), answering G2871 (*"nothing the plane serves tells a client what
 * its session may do"*) for C9 row #22 and G3193 (a refused control is HIDDEN,
 * not drawn and then refused).
 *
 * 🛑 IT IS NOT A SECOND EVALUATOR, AND THE SHAPE IS WHAT MAKES THAT TRUE RATHER
 * THAN ARGUED. It takes the plane's own `CapabilityAuthoriser` — the function
 * the `preValidation` gate calls — and asks it once per member of the closed
 * set. Every verdict in the answer is therefore exactly the verdict the gate
 * would return for that verb on that session, through `decide()` and through
 * nothing else; G289's confused-deputy argument (one evaluator, extended) is
 * untouched because no predicate is written here at all. A customer's role
 * assignments, the fifth arm's portal roles (R10), the platform arm's
 * assignments and a live staff grant (G2591) all arrive because `decide()`
 * reads them, not because this function names them.
 *
 * ⚠️ ADVISORY. A client may HIDE a control with this; it may never SKIP a
 * check with it. Every operation still gates server-side, and a list read at
 * page load goes stale the moment an assignment is revoked — the 403 is the
 * backstop, and that is why nothing here is a cache the gate consults.
 *
 * ⚠️ IN `CAPABILITIES`' OWN ORDER, which the wire's `Capability` enum mirrors
 * (`check-wire-mirror`'s `capabilities` pair), so the answer is deterministic.
 */
export function heldCapabilities<P>(authorise: CapabilityAuthoriser<P>, principal: P): Capability[] {
  return (Object.values(CAPABILITIES) as Capability[]).filter((c) => authorise(principal, c) === 'held')
}

/**
 * The production authoriser. It asks the real evaluator, about a principal it
 * cannot assemble, and therefore refuses.
 *
 * ⚠️ IT IS NOT A CONSTANT `'not_held'` AND MUST NOT BE SIMPLIFIED INTO ONE.
 * The refusal is a CONSEQUENCE of five absent producers rather than a
 * decision, and the day the last of them lands this line starts allowing
 * without being edited. A hard-coded refusal would have to be noticed and
 * deleted — and a fence nobody remembers to delete is how a shipped feature
 * stays unreachable, which is #157's *"an unbuilt feature wearing an
 * invariant's badge"* in the mirror.
 */
export const denyAllCapabilities: CapabilityAuthoriser<TenantSession> = capabilityAuthoriser(
  () => NO_IDENTITY_SUBSTRATE,
)

/**
 * ✅ **THE PRODUCTION AUTHORISER, AND IT CAN SAY YES — G299, 19 Sep 2026.**
 *
 * 🛑 THE PARAGRAPH ABOVE `denyAllCapabilities` PREDICTED THIS LINE AND IT IS
 * WORTH READING BEFORE THIS ONE: *"the day the last of them lands this line
 * starts allowing without being edited. A hard-coded refusal would have to be
 * noticed and deleted — and a fence nobody remembers to delete is how a shipped
 * feature stays unreachable."* **The prediction held exactly.**
 * `capabilityAuthoriser()` is unchanged, `principalContextFor()` is unchanged,
 * `decide()` is unchanged; a substrate reader landed and the same mechanism
 * started producing a different answer.
 *
 * ⚠️ WHAT `denyAllCapabilities` IS NOW, SO NOBODY DELETES IT. It is no longer
 * the default any entry point takes — `server/data-plane/start.ts` takes this
 * one — and it stays because it is the NEGATIVE half of the matched pair:
 * `tests/http/capability-gate.test.ts` drives the same request through it and
 * requires a 403, which is the only way to tell a gate that runs before the
 * validator from one that runs after it.
 *
 * 🛑 AND THIS IS NOT A WIDENING OF `startDataPlane()`'s FENCE. That fence is
 * about which ENTRY POINT admits an authoriser, and it is untouched:
 * `listenDataPlane()` still takes no `authorise` option, still cannot be
 * configured permissive, and `tests/http/deployed-path-cannot-be-permissive
 * .test.ts` still reads the signatures. What changed is what the DEFAULT does
 * when it is handed a real subject, and that verdict comes from `decide()`
 * either way — *"A reader that returned a fabricated substrate would be lying
 * to the evaluator rather than replacing it."* This reader fabricates nothing:
 * every term is a row, and a term with no row is `null`, and `null` refuses.
 */
export const sessionCapabilities: CapabilityAuthoriser<TenantSession> =
  capabilityAuthoriser(substrateFromSession)

/**
 * The sentence a 403 carries. A constant — `errors.yaml` forbids `detail` from
 * carrying anything request-derived, and a refusal naming the capability the
 * caller lacks would turn the gate into a roster oracle for anybody who can
 * authenticate.
 *
 * ⚠️ IT NO LONGER SAYS "THIS PLANE RESOLVES NO SUBJECT", BECAUSE IT RESOLVES
 * PART OF ONE. The corrected sentence is narrower and truer: a session and a
 * tenant are resolvable; an AUTHORITY is not.
 */
export const UNAUTHORISED_DETAIL =
  'This plane can resolve a session and a tenant, and can resolve no authority: the ' +
  'subject status, the organisation class and the role assignments a capability is ' +
  'evaluated against have no table to be read from. The verb required by this operation ' +
  'is declared in the OpenAPI document that routes it.'

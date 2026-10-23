/**
 * ReconcileAI — support access, partner-scope clamping, and erasure.
 *
 * Platform layer. Implements P0-1, P0-2 and P0-3 of docs/model-change-ledger.md.
 *
 * Three doors are closed here:
 *
 *   1. THE OPERATOR'S DOOR. Platform support access was unmodelled — the only
 *      cross-tenant path guaranteed to be exercised in production. A rigorous
 *      front door existed for partners, who have strictly less access than the
 *      operator, and the operator's door was unlocked.
 *
 *   2. THE SECOND PARTNER DOOR. Membership.partnerScope bypassed
 *      PartnerAccessGrant entirely; ApprovalConfig.approvers (then approverRoles) admits
 *      'partner_admin', so partner staff could approve customer exceptions with
 *      no grant anywhere in the path.
 *
 *   3. ERASURE. Purging a SourceDocument did not remove the personal data,
 *      because Explanation stores a copy and is deliberately retained longer.
 *      DataSubjectRequest.kind 'erasure' was a status field over an operation
 *      the system could not perform.
 *
 * REVISED 5 AUG 2026 against docs/access-and-agency.md §8.3, §8.5, §8.7, §9.4a,
 * §10.1, §10.2 and §10.7. Four of those changes close controls that existed
 * only as sentences:
 *
 *   - `configuration` no longer includes "policies", so a delivery grant that
 *     provably cannot read tenant data can no longer rewrite the rules about
 *     reading it. Three new classes: authority, statutory, identity.
 *   - `SupportAuthorisation` — consent at signing, drawn against per incident,
 *     so nobody waits on a customer process at 03:00 and nobody routes around
 *     the control into a console this model cannot see.
 *   - MAX_GRANT_HOURS and grant.extensions are READ. Both had zero call sites
 *     while their comments described enforcement.
 *   - grantAllows() and evaluateTenantAccess() compare tenants. Neither did,
 *     so a grant for tenant A validated an operation against tenant B.
 *
 * The second partner door is closed differently now: the clamp that closed it
 * is deleted in favour of access.ts's capability mask — see section 2, which
 * records the two defects that made migration the wrong answer.
 */

import type {
  AuthorizationGrantId,
  MessageId,
  RegionKey,
  DataClass,
  ExceptionId,
  MatchGroupId,
  PartnerId,
  SourceDocumentId,
  TenantId,
  TenantScoped,
  Timestamp,
  UserId,
} from './domain'
/**
 * Organisation class is derived from the identity connection that authenticated
 * the session (§8.3, §8.9) and is defined once, in access.ts. It is imported
 * rather than restated because an audit row that disagrees with the
 * authorisation layer about what a partner IS would be worse than one that
 * carried nothing.
 */
import type { OrgClass } from './access'

/**
 * The two governance-record ids, 7 Aug (G35). From `./kernel` directly; see the
 * note in `billing.ts` — the ids above arrive by re-export for historical
 * reasons, and a new id has no history to preserve.
 */
import type { ChainAnchorId, ErasurePlanId } from './kernel'

/* SLICE 6 — the reference sweep's targets. Imported from `./kernel` directly
 * rather than through `./domain`: a NEW id has no re-export history to
 * preserve, and routing it through the largest module in the system is the
 * indirection slice 3 was written to end. Re-exported for the same reason the
 * older ids are — a consumer that already reads this module keeps reading it. */
import type {
  DataSubjectRequestId,
  LegalHoldId,
  /* 7 Aug 2026 — one of the trim's four model-identity brandings. See the field
   * comment on `AuditActor`'s agent arm. */
  ModelCatalogEntryId,
  TenantAccessGrantId,
} from './kernel'
export type {
  DataSubjectRequestId,
  LegalHoldId,
  TenantAccessGrantId,
} from './kernel'

export type { ChainAnchorId, ErasurePlanId } from './kernel'

/* ================================================================== *
 * 1. Platform support access
 * ================================================================== */

/**
 * Time-boxed, two-person-approved, tenant-visible access for 1CloudHub staff.
 *
 * Being staff grants nothing. This grant is the only path, and a customer can
 * refuse it permanently via Tenant.supportAccessMode = 'never'.
 */
/* ------------------------------------------------------------------ *
 * Reaching a customer tenant — one grant, two purposes
 *
 * The previous type was SupportAccessGrant: "hours, not weeks", two-person
 * approval, per session. Correct for an incident and unusable for delivery,
 * where a forward deployment engineer configures a tenant for WEEKS. There was
 * no third option, so in practice the choice was re-requesting a grant daily or
 * quietly granting a membership — and the second erases the audit story that
 * made the first worth having.
 *
 * The fix is to stop conflating three independent things:
 *
 *   DURATION        hours for an incident, an engagement for delivery
 *   RESOURCE CLASS  telemetry, configuration, nominated samples, tenant data
 *   CONSENT BASIS   requested at incident time, or contracted at signing
 *
 * The second axis is what makes a long grant safe. CONFIGURATION IS NOT TENANT
 * DATA — definitions, rules, procedures, document types and tag policy are what
 * delivery writes, and delivery reads almost no exceptions. A grant that permits
 * configuration write and no data read is a far smaller thing than the old
 * read_write.
 *
 * Not overclaimed: configuration is LOW risk, not zero. A fuzzy_name constant
 * or a `when` guard could name an individual, and cost-centre vocabularies are
 * customer-authored and revealing. So it is still recorded as a data access —
 * it simply does not need the same approval weight.
 * ------------------------------------------------------------------ */

export const ACCESS_PURPOSES = {
  /** Weeks. Configuration under a signed engagement. Consent is commercial. */
  delivery: 'delivery',
  /** Hours. Diagnosing a live problem. Consent is per incident. */
  incident: 'incident',
} as const
export type AccessPurpose =
  (typeof ACCESS_PURPOSES)[keyof typeof ACCESS_PURPOSES]

export const ACCESS_RESOURCE_CLASSES = {
  /**
   * Traces and spans. No rows at all.
   *
   * ⚠️ NO CAPABILITY MAPS HERE, and unlike `substrate` and `catalogue` that is
   * an INCONSISTENCY rather than a statement — reviewed 7 Aug 2026 and left
   * open. Both entries of `PERMITTED_RESOURCES` admit `telemetry`, so a support
   * grant reaches a class no verb names; and `configure_telemetry` — the verb
   * whose name says this class — maps to `authority` instead, deliberately and
   * for a stated reason (a delivery grant must not set the classification
   * ceiling on what lands in a trace). Reading a trace and setting what may
   * appear in one are two acts, and only the second has a verb. HANDOFF §8 item
   * 1g says to settle this on its own rather than fold it into a minting pass.
   */
  telemetry: 'telemetry',
  /**
   * Definitions, rules, procedures, document types, tag policy.
   *
   * THE WORD "policies" WAS HERE UNTIL 5 AUG AND IT WAS A HOLE (§8.7).
   * `PERMITTED_RESOURCES.delivery` includes `configuration`, so a 90-day
   * delivery grant — the one whose safety property is that it PROVABLY cannot
   * read tenant data — could rewrite `AutonomyConfig`,
   * `DataEgressConfig.allowedDestinations` and `CorrespondenceConfig`: the
   * rules deciding who reaches tenant data and where it is sent. Not reading
   * the data was worth very little while the same grant could change the rules
   * about reading it. Those now sit in `authority`, which no purpose reaches on
   * its own.
   */
  configuration: 'configuration',
  /** Everything. Exceptions, explanations, extracted values, documents. */
  tenantData: 'tenant_data',
  /**
   * The autonomy envelope, roles, user administration — what `configuration`
   * used to smuggle (§8.7).
   *
   * Reachable ONLY where the contract pre-authorises it: it appears in neither
   * entry of `PERMITTED_RESOURCES`, and a live `SupportAuthorisation` naming it
   * is the only way in. That is deliberate rather than restrictive — a lean
   * customer who wants 1CloudHub to run the tenant authorises it in the
   * paperwork; a regulated customer with its own security function withholds
   * it, and neither outcome is hard-coded here.
   *
   * The cost is stated in §8.7 and not paid yet: onboarding needs a
   * propose-and-approve path — an FDE PROPOSES the initial autonomy setting and
   * a tenant role OWNS it. Until that exists, withholding `authority` means the
   * setting has nobody to set it.
   */
  authority: 'authority',
  /**
   * `place_legal_hold`, `handle_subject_request`.
   *
   * In NEITHER list, ever, at any price — and no authorisation opens it. These
   * are not the customer's to delegate: the obligation sits with the controller
   * regardless of what a contract says, so a customer purporting to authorise
   * 1CloudHub to answer their data-subject requests may simply lack the
   * standing to do it. `authorisationPermits()` refuses this class before any
   * other check, so a malformed authorisation cannot reach it either.
   *
   * One narrow exception exists and is deliberately NOT modelled as a grant:
   * see `BreakGlassPreservation`, which covers preservation only and confers no
   * read.
   */
  statutory: 'statutory',
  /**
   * Configuring an `IdentityConnection` — the federation door, not what is
   * behind it (§9.4a).
   *
   * A DELIVERY GRANT MAY REACH THIS, and that is the entire point. If connection
   * configuration sat inside `authority`, the customers most likely to withhold
   * `authority` — regulated, running their own security function — would be
   * exactly the ones unable to have SSO configured, which inverts the decision
   * against itself. A connection is an account-level fact and does not belong in
   * a class defined by tenant-scoped risk appetite.
   *
   * Reaching the connection is not reaching the directory: it selects which door
   * is tried, and the door still decides.
   */
  identity: 'identity',
  /**
   * Where the platform reaches, in either direction — one registry replacing
   * four unrelated lists.
   *
   * `DataEgressConfig.allowedDestinations`, `CounterpartyEndpoint`,
   * `TenantContact.address` and `TelemetryExport.endpoint` were four places
   * naming an outside address, and the same verification rule was enforced
   * twice and not enforced at all twice. Slack and Teams installs were modelled
   * nowhere.
   *
   * DIRECTION IS A FLAG, NOT A CLASS. A mailbox you send to and a mailbox you
   * poll are the same mailbox; direction is a property of the binding. What
   * differs is which gate applies to traffic over it — inbound is a TRUST
   * BOUNDARY and needs admission, outbound is a DISCLOSURE SURFACE and needs a
   * classification ceiling and a residency check. Different controls keyed off
   * a flag, not different classes.
   *
   * Adding an inbound direction to an outbound endpoint is a WIDENING and
   * therefore an act, which is the existing law rather than a new rule.
   *
   * A delivery grant may reach this — declaring where we reach is onboarding
   * work. It may not reach write-back (`authority`).
   *
   * ⚠️ AMENDED 8 AUG 2026 — G75. This sentence read *"It may not reach the
   * credential (`secret`) or write-back (`authority`)"*, and the first half of
   * that is no longer true: `secret` is in `PERMITTED_RESOURCES.delivery`, so a
   * delivery grant now reaches the endpoint AND the credential it resolves. The
   * separation of the two classes survives the change and is not decorative —
   * `secret` still has no read mode, and the classes are still granted
   * separately — but the endpoint/credential split is no longer a boundary a
   * delivery grant stops at.
   */
  endpoint: 'endpoint',
  /**
   * The credential an endpoint resolves. Its own class on a property nothing
   * else in this set has: THERE IS NO READ MODE.
   *
   * Modes are bind and rotate. `read` is unrepresentable, because three modules
   * independently state that no field in this model may hold key material — so
   * the reference IS the resource, and reading a reference is not a thing
   * anyone needs to do.
   *
   * 🛑 REVERSED 8 AUG 2026 — G75. IT IS IN `PERMITTED_RESOURCES.delivery`.
   *
   * This comment read: *"In NEITHER entry of PERMITTED_RESOURCES. A partner or
   * an FDE cannot hold the customer's ERP credential at any grant length, which
   * was live until 5 Aug: `configure_connection` mapped to `configuration`, and
   * delivery reaches `configuration`."* Half of that still holds and half does
   * not, so it is quoted rather than edited into something that never existed.
   *
   * WHAT STILL HOLDS. A PARTNER cannot reach it: partners hold no
   * `AccessPurpose` and this class is in neither entry for them by
   * construction. The 5 Aug fix is untouched — `configure_connection` no longer
   * launders a credential through `configuration`, so reaching this class is
   * now an explicit act rather than a side effect of a class named something
   * else.
   *
   * WHAT DOES NOT. An FDE CAN hold the customer's credential, for the full
   * delivery grant length. G60 decided the reach, G75 chose the standing shape
   * over the contract-only one; both write-ups are on
   * `PERMITTED_RESOURCES.delivery` and on `NON_DELEGABLE_RESOURCES`, which this
   * class also left.
   *
   * THE MISSING READ MODE IS WHY THE CHANGE IS SURVIVABLE, AND IT IS NOT A
   * DEFENCE OF IT. Bind and rotate are reachable; `read` remains
   * unrepresentable, so an FDE may point a source at a credential and replace
   * one without any path in this model that hands them the material.
   */
  secret: 'secret',
  /**
   * The plane the tenant runs on, and its licence to run.
   *
   * THE RULE THAT IS TRUE HERE AND NOWHERE ELSE: authority is shared with
   * someone else's root, and revocation is asynchronous and best-effort BY
   * CONSTRUCTION. `EntitlementLease` states its own limit — an offline-verifiable
   * lease cannot learn it was revoked while offline, so the guarantee is "no
   * more than the ceiling, and not past expiry", not "stops on command". Every
   * other class in this set revokes synchronously.
   *
   * `DataPlane` `DataPlaneHeartbeat` `SupportedVersionWindow` `EntitlementLease`
   * `UsageAttestation`. Under BYOA the customer holds root on the account, so a
   * grant here is a request rather than a control.
   *
   * In neither permitted list: a platform RELEASE reaches it, not a support
   * grant.
   *
   * 🛑 **TWO CAPABILITIES MAP HERE SINCE 19 Sep 2026 — G601 — AND NEITHER IS A
   * TENANT CAPABILITY, WHICH IS WHAT THE STATEMENT BELOW ACTUALLY SAYS.** The
   * statement is QUOTED AND KEPT rather than edited, because every word of it
   * remains true of the instrument it was written about and four other files
   * cite it:
   *
   * NO CAPABILITY MAPS HERE, AND THAT IS THE STATEMENT (E1, settled 7 Aug 2026
   * alongside `metering` and `commercial`, which were gaps). A tenant
   * capability pointing at `substrate` would be a verb no tenant principal could
   * ever legitimately hold — the sentence above says a release reaches this and
   * a grant does not, and a capability is the currency of grants. Under BYOA the
   * customer holds root here anyway, so a verb would be a request wearing the
   * costume of a control. G36 slips BYOA to v1+1, so there is not even a surface
   * to be wrong about yet.
   *
   * ⚠️ **WHAT CHANGED IS NOT THIS CLASS. IT IS THAT A SECOND INSTRUMENT NOW
   * SPENDS CAPABILITIES.** On 7 Aug 2026 the only thing that did was a
   * `RoleAssignment`, held in a tenant, or a grant — so *"a capability is the
   * currency of grants"* was exhaustive. **G289 built
   * `PlatformRoleAssignment` on 19 Sep 2026**: it carries
   * `readonly Capability[]`, extends no `TenantScoped`, and is not a grant.
   * `view_substrate` and `provision_substrate` are denominated in that second
   * currency and in no other — `PLATFORM_ONLY_RESOURCE_CLASSES` in
   * `model/access.ts` names this class, and `decide()` refuses it on the
   * customer and partner arms at their first line, so *"a verb no tenant
   * principal could ever legitimately hold"* is now enforced rather than
   * merely asserted.
   *
   * 🛑 **THE BYOA SENTENCE IS NOT ANSWERED BY ANY OF THAT AND SURVIVES AS A
   * NAMED LIMIT.** It is a claim about who holds root, not about who holds a
   * verb, and it lands entirely on `provision_substrate`, whose own
   * declaration carries it. It costs nothing today — G36 keeps BYOA at v1+1
   * and `grep -rn 'byoa' db/migrations/` returns nothing — and **the commit
   * that lands a BYOA tenant owes the re-argument.**
   */
  substrate: 'substrate',
  /**
   * Invoices, budgets, plans, rate cards, derived totals.
   *
   * THE RULE: a partner is a legitimate reader here and nowhere else. That is
   * the whole of `partnerCommercialVisibility()` — and it is why raw metering
   * is NOT in this class (see `metering`), because a partner reading volume in
   * the clear is the disclosure §8.8 exists to prevent.
   *
   * ✅ CLOSED 7 Aug 2026 by `view_commercial` (CAPABILITY 36). The warning this
   * replaces read: "No capability maps here yet. Nothing in CAPABILITIES names a
   * budget, an invoice or a plan, so a tenant admin cannot see what they owe."
   *
   * NOTE WHAT DID NOT CHANGE. The partner's read here is still NOT that
   * capability — `view_commercial` appears in no `PARTNER_CAPABILITY_MASK`
   * scope. The partner path is `partnerCommercialVisibility()`, a derivation
   * keyed on the billing arrangement, because a mask intersects capabilities and
   * cannot express "the band and nothing inside it". The rule at the top of this
   * comment says WHO may read the class; it was never a promise about HOW.
   */
  commercial: 'commercial',
  /**
   * Packs, models, policy templates, scorers, gates, probes.
   *
   * THE RULE: no tenant principal may write it, and a platform principal
   * writing it needs no tenant grant at all. Gated by release process rather
   * than by grant, and the blast radius is the fleet rather than one tenant.
   *
   * Note what this means for `install_pack`: INSTALLING is a tenant act on
   * `configuration` and stays there. AUTHORING is the catalogue act, and it has
   * no verb because it is not a tenant capability.
   *
   * 🛑 **AUTHORING HAS THREE VERBS SINCE 19 Sep 2026 — G601 — AND THE SENTENCE
   * DIRECTLY ABOVE IS KEPT BECAUSE IT NAMES ITS OWN CONDITION.** *"It has no
   * verb BECAUSE IT IS NOT A TENANT CAPABILITY"* was exhaustive while a
   * capability could only be held in a tenant. `PlatformRoleAssignment`
   * (G289) holds capabilities in no tenant at all, so the clause after
   * *because* is satisfied by a verb that exists: `view_catalogue`,
   * `author_catalogue` and `publish_catalogue` are unreachable from every
   * tenant arm of `decide()` by `PLATFORM_ONLY_RESOURCE_CLASSES`.
   *
   * ⚠️ **THREE AND NOT ONE, ON THIS CLASS'S OWN SENTENCE ABOVE:** *"the blast
   * radius is the fleet rather than one tenant."* A draft reaches nobody; a
   * published version reaches every tenant that installs it. One verb covering
   * both would make the person who may sketch a rule the person who may ship
   * it to everybody.
   *
   * 🛑 **AND THE OPEN RISK ON THIS CLASS IS INVARIANT 6's, NOT INVARIANT 8's.**
   * A published pack carries procedure templates and agent tool bindings.
   * G110 rules that `validateProcedureInjectionSafety()` and
   * `validateAgentToolBindings()` need BOTH a CI call site and a **publication
   * seam that refuses**; `tools/check-pack-safety.mjs` is the first and the
   * seam does not exist. `publish_catalogue` is the verb that seam would sit
   * behind. **Minting it does not build the seam.**
   *
   * ⚠️ `install_pack` IS UNCHANGED and is still `configuration`. The line
   * above survives intact and is the reason a platform assignment reaching
   * this class reaches nothing inside any tenant.
   */
  catalogue: 'catalogue',
  /**
   * Crons, ingest watchers, retention sweeps, rollouts.
   *
   * THE RULE, and it is structural rather than a matter of degree: THERE IS NO
   * PRINCIPAL AT THE MOMENT OF ACTION. Four of five `RunTrigger` kinds have no
   * human, so the agent-authority intersection — platform clamp, step
   * requirement, delegator's scope — has no operand for its third term. A
   * schedule must therefore PIN its scope at arming rather than resolve one at
   * firing.
   *
   * ⚠️ STILL EMPTY, AND STILL A GAP RATHER THAN A STATEMENT — reviewed 7 Aug
   * 2026 and deliberately NOT closed in the same pass as `metering` and
   * `commercial`. `trigger_run` is not the missing verb: triggering a run is an
   * act with a principal present, and ARMING a schedule is the act that has
   * none. The verb is missing because its SCOPE SEMANTICS are undecided — an
   * armed schedule must PIN a scope at arming rather than resolve one at firing,
   * and every other capability in `CAPABILITY_RESOURCE_CLASS` resolves. Minting
   * `arm_schedule` before deciding how a pinned scope is represented ships a
   * capability that behaves unlike all thirty-six others while looking
   * identical, which is worse than the empty class.
   */
  schedule: 'schedule',
  /**
   * Usage records, attestations, token counts — the measurements, never the
   * money.
   *
   * ITS OWN CLASS ON A MISSING MODE, which is how `secret` earned one. `secret`
   * has no READ mode; metering has no WRITE mode. `UsageRecord` is immutable
   * and unpriced (invariant 5, money is always derived), so nobody edits a meter
   * reading — not the customer, not a partner, not us.
   *
   * IT CANNOT LIVE IN `commercial`, and this is the load-bearing reason for
   * splitting them: `commercial`'s defining rule is that a partner may read it.
   * A raw `UsageRecord` is VOLUME IN THE CLEAR, which is the exact quantity
   * §8.8 spent the partner-visibility argument protecting — spend and rate
   * together invert to volume, and volume is the customer's real exposure. One
   * class containing both a partner-readable summary and a partner-forbidden
   * record has no defining rule left.
   *
   * ✅ CLOSED 7 Aug 2026 by `view_metering` (CAPABILITY 35), which is a READ
   * VERB AND ONLY A READ VERB — the missing write mode above is what makes a
   * companion `record_usage` wrong rather than merely absent.
   *
   * The class was reachable and empty for the most frequently performed read in
   * the product: the token meter renders in the chrome of every screen.
   */
  metering: 'metering',

  /* --- a partner organisation's OWN surface. R10, 1 Oct 2026 — THE OWNER'S ---
   *
   * 🛑 THREE CLASSES ARRIVE AT ONCE AND EACH CARRIES ITS OWN RULE, BECAUSE
   *    §11.2's TEST IS PER CLASS: *"A class earns its place by carrying a rule
   *    that is true of it and false of its nearest neighbour."* The owner's
   *    ruling names the three — *"new resource classes for deals / sandbox /
   *    partner staff"* — and `docs/build/completion-plan.md` §4 R10 records
   *    why none of the thirteen fit: *"a deal registration, a sandbox, a
   *    partner's own staff list match NONE of the thirteen resource classes."*
   *
   * 🛑 ALL THREE ARE `PARTNER_ONLY_RESOURCE_CLASSES` (model/access.ts §6c),
   *    THE MIRROR OF G601's PLATFORM FENCE: no customer principal and no
   *    platform principal reaches any of them by any route, and `decide()`
   *    answers them on its FIFTH arm alone. **None of them is a read into any
   *    tenant**, which is the whole reason the fifth arm opens no cross-tenant
   *    path: invariant 2's single path — *"`partner_admin(P)` may read tenant
   *    `T` iff `T.partnerId = P`, and only within a live `PartnerAccessGrant`"*
   *    — is untouched and is still the only one.
   */
  /**
   * A CLAIM ABOUT A COMPANY THAT IS NOT A TENANT. Deal registrations and
   * trial-tenant requests: the partner asserting *"this prospect is mine"* to
   * the platform, before any tenant exists.
   *
   * THE RULE, AND THE NEIGHBOUR IT IS DISTINGUISHED FROM: **the subject has no
   * `tenantId` and may never get one.** `commercial` is money ABOUT a tenant
   * and `tenant_data` is the tenant's business; a registration names a company
   * no tenant row describes, which is exactly why
   * `submitDealRegistration`'s old exemption read *"there is no tenantId for
   * decide() to build a PrincipalContext around and no resource class for a
   * capability to name."* The second half of that sentence is what this class
   * ends; the first half is what the fifth arm answers.
   *
   * ⚠️ THE PLATFORM'S SIDE OF A REGISTRATION — accepting or refusing it in the
   *    staff console — IS NOT THIS CLASS AND IS NOT REACHED BY THIS RULING.
   *    `PLATFORM_ASSIGNMENT_REACHES.deal` is `false`: what the platform reads
   *    is its own QUEUE of claims made to it, a different act on a different
   *    record, and it gets its own argument when it is built.
   */
  deal: 'deal',
  /**
   * A TENANT THE PARTNER OWNS OUTRIGHT AND NO CUSTOMER IS IN — the demo
   * plane's LIFECYCLE: standing, seed version, reset cycle, hand-back.
   *
   * THE RULE, AND THE NEIGHBOUR IT IS DISTINGUISHED FROM: **the owner of the
   * plane is the partner.** `substrate` is a CUSTOMER tenant's plane, where
   * authority is shared with someone else's root and the platform is the actor;
   * a sandbox is a plane the partner asked for, demonstrates on and hands back,
   * and no customer's business is ever in it.
   *
   * 🛑 LIFECYCLE ONLY, NEVER A READ INTO THE SANDBOX. The contract says so at
   *    `getSandboxTenant`: *"none of it is a read INTO the tenant, which is
   *    where a capability would begin to apply."* A read into the sandbox
   *    tenant's rows is `tenant_data` IN THAT TENANT, reached the way any
   *    tenant's data is reached — and this class does not open it.
   */
  sandbox: 'sandbox',
  /**
   * WHO AT A PARTNER FIRM CARRIES WHICH PORTAL ROLE. The partner organisation's
   * own roster and its invitations.
   *
   * THE RULE, AND THE NEIGHBOUR IT IS DISTINGUISHED FROM: **it is held in no
   * tenant.** `authority` is roles and user administration EVALUATED IN A
   * TENANT, and `listPartnerPeople`'s old exemption named the gap exactly —
   * *"`manage_users` is classed authority and authority is evaluated IN A
   * TENANT — a partner organisation own roster is not a tenant roster, so the
   * only capability whose name fits is one this principal could never hold."*
   *
   * ⚠️ AND G266 BOUNDS WHAT IT HOLDS: *"the credential carries the
   *    organisation, this record carries the role."* A partner person is added
   *    and removed in the partner's OWN identity provider; this class is the
   *    portal-role record and never the directory.
   */
  partnerStaff: 'partner_staff',
} as const
export type AccessResourceClass =
  (typeof ACCESS_RESOURCE_CLASSES)[keyof typeof ACCESS_RESOURCE_CLASSES]

/**
 * What each purpose may EVER reach on the strength of the purpose alone.
 *
 * THE SAFETY PROPERTY CHANGED SHAPE ON 5 AUG AND GOT STRONGER. It was
 * "delivery cannot reach tenant data". It is now "delivery cannot reach tenant
 * data it has not been handed, instance by instance, by the customer" — see
 * REQUIRES_ENUMERATION. Incident reaches tenant data on the strength of the
 * purpose alone, because it needs the actual failing record, under a grant
 * measured in hours rather than weeks.
 *
 * SEVEN of the thirteen classes appear in neither entry, for three different
 * reasons — and the count is the point: a support grant reaches six classes,
 * not most of them.
 *
 * ⚠️ IT WAS EIGHT AND FOUR UNTIL 8 AUG 2026. G75 moved `secret` into
 * `delivery` below, so the class that used to be its own fourth reason —
 * *"nothing opens it — a credential is not the customer's to delegate to a
 * processor either"* — is now on the permitted side. The counts are restated
 * rather than left, because a stale count in this position reads as a safety
 * property.
 *
 *   `authority`  only a contract opens it (CONTRACT_ONLY_RESOURCES)
 *   `statutory`  nothing opens it (NON_DELEGABLE_RESOURCES), and it is now the
 *                only member of that list
 *   `substrate` `catalogue`
 *                a platform RELEASE reaches these, not a grant
 *   `commercial` `metering` `schedule`
 *                no purpose lists them and no contract may, because they are
 *                not in CONTRACT_ONLY_RESOURCES. ⚠️ Each has a plausible case
 *                for becoming contract-openable — support reading usage during
 *                a billing dispute, an on-call disarming a runaway schedule —
 *                and adding one is a WIDENING, so it is an act rather than a
 *                default. Left closed deliberately.
 *   `deal` `sandbox` `partner_staff`
 *                ⚠️ **ADDED BY R10, 1 Oct 2026, SO THE COUNT ABOVE IS NOW TEN OF
 *                SIXTEEN — corrected here rather than in the sentence, which
 *                was true of thirteen.** A partner organisation's own surface,
 *                and no purpose lists them because a `TenantAccessGrant` is a
 *                reach INTO A CUSTOMER TENANT and none of the three is in one.
 *                `PARTNER_ONLY_RESOURCE_CLASSES` refuses all three to staff on
 *                `decide()`'s platform arm as well, so there is no second route.
 */
export const PERMITTED_RESOURCES: Record<
  AccessPurpose,
  readonly AccessResourceClass[]
> = {
  delivery: [
    'telemetry',
    'configuration',
    'identity',
    'endpoint',
    'tenant_data',
    /**
     * ADDED 8 AUG 2026 UNDER G75, AND TAKEN AGAINST THE WRITTEN
     * RECOMMENDATION. Recorded here because this is the line that does it.
     *
     * G60 decided the FDE may reach `secret` at all: G56 puts source
     * configuration with the FDE, a source has a credential, so the old
     * invariant made the FDE's own job structurally impossible. G75 decides the
     * SHAPE, and it is the broader of the two shapes that were on the table.
     *
     * WHAT WAS RECOMMENDED AND NOT CHOSEN. `docs/v1-trim-proposal.md` §4.4
     * recommended `CONTRACT_ONLY_RESOURCES`, beside `authority` — reachable only
     * under a signed `SupportAuthorisation` the customer pre-authorises at
     * contract time, naming purpose, max hours and who may invoke. Same
     * capability for the FDE, far narrower blast radius.
     *
     * WHAT THE COUNTER-ARGUMENT WAS, PRESERVED RATHER THAN DROPPED. Pass A
     * recorded that `PERMITTED_RESOURCES` is *"the single constraint that makes
     * a weeks-long grant acceptable"*, and pass F records the first non-demo
     * customer as a regulated enterprise. `MAX_GRANT_HOURS.delivery` is
     * `24 * 90`, so membership of this list is a STANDING 90-DAY REACH to every
     * customer credential rather than a per-engagement one.
     *
     * WHAT WAS CHOSEN, AND WHAT WAS GIVEN UP. The product owner chose the
     * standing reach with that argument in front of them. What is given up is
     * the customer's per-contract say over whether a credential is reachable at
     * all: the platform now decides it, and a customer who withholds
     * `authority` still cannot withhold this. What survives is unchanged — every
     * reach is still a grant, still authorised, still audited, `secret` still
     * has no read mode, and `statutory` is still reachable by nothing.
     *
     * Do not relitigate it; do not quietly narrow it back.
     */
    'secret',
  ],
  incident: ['telemetry', 'configuration', 'endpoint', 'tenant_data'],
}

/**
 * Classes a purpose may name ONLY with a non-empty instance enumeration.
 *
 * `sample_data` used to be a resource class. It was not one — it was
 * `tenant_data` under a different SELECTOR, and `grantAllows()` proved it by
 * carrying one special-case `if` for one class. Keeping it made the class axis
 * mix "what kind of thing" with "how much of it".
 *
 * The safety property this replaces it with is STRONGER, not weaker. It was
 * "delivery cannot reach tenant data". It is now "delivery cannot reach tenant
 * data it has not been handed, document by document, by the customer" — and
 * the nomination remains the customer's auditable act.
 *
 * It also fixes an operational failure the old shape caused: an FDE who needed
 * one EXCEPTION to debug a field mapping had no delivery path at all, because
 * `sample_data` enumerated `SourceDocumentId` only. They would raise an
 * incident grant instead — defeating the delivery/incident split entirely.
 */
export const REQUIRES_ENUMERATION: Record<
  AccessPurpose,
  readonly AccessResourceClass[]
> = {
  delivery: ['tenant_data'],
  incident: [],
}

/**
 * Classes a purpose never opens by itself, and a `SupportAuthorisation` may.
 *
 * The distinction is the whole of §8.7: `PERMITTED_RESOURCES` is what the
 * platform decides, this is what the customer decides, and `statutory` is what
 * neither decides.
 */
export const CONTRACT_ONLY_RESOURCES: readonly AccessResourceClass[] = [
  'authority',
]

/**
 * Classes no purpose and no contract opens. Checked first, always.
 *
 * A list of one, which is the point: the value of "in neither list, ever" is
 * entirely in the word *ever*, and this is the constant a future reader has to
 * edit — visibly, in a diff — to take that word away.
 *
 * ⚠️ THAT SENTENCE WAS FALSE FOR THREE DAYS AND IS TRUE AGAIN. `secret` was
 * added beside `statutory` on 5 Aug and the comment above was never updated, so
 * a comment reading *"a list of one, which is the point"* sat on top of a list
 * of two — and `authorisationPermits()`'s refusal code is named for one of
 * them. G75 removed `secret` on 8 Aug (see `PERMITTED_RESOURCES.delivery` for
 * the decision and what it gave up), which is why the sentence holds again
 * rather than because anybody fixed the prose. The deleted entry read: *"Added
 * 5 Aug. A credential binding is not the customer's to delegate to a processor
 * either — and unlike `statutory` there is no break-glass, because preservation
 * has an analogue here and reading a credential does not."* It is quoted rather
 * than dropped because it is the argument G75 was taken against.
 *
 * THE NAME `'statutory_never_delegable'` IS NOW HONEST AND WAS REVIEWED, NOT
 * ASSUMED. It was minted for a one-member list, spent 5–8 Aug describing a
 * two-member one — §5.1, a rule keyed on a convenient landmark instead of the
 * property it protects — and is correct again for exactly the reason it was
 * correct originally. It is deliberately NOT renamed to something list-shaped
 * (`never_delegable`): a name that survives another member being added is a
 * name that stops warning you when one is. Adding a class here must break the
 * name, visibly, in the same diff.
 */
export const NON_DELEGABLE_RESOURCES: readonly AccessResourceClass[] = [
  'statutory',
]

/**
 * The PLATFORM DEFAULT ceiling per purpose, in hours.
 *
 * It had zero call sites while its comment claimed "a grant beyond this is
 * rejected at issue" — a control that existed only as a sentence. It is now
 * read by `maxGrantHours()`, which `evaluateTenantAccess()` enforces on every
 * evaluation, extensions included.
 *
 * DEFAULT, NOT CAP (§8.5). A `SupportAuthorisation.maxHours` is a negotiated
 * per-customer number and WINS outright when one exists, including upward — the
 * alternative, `min(platform, negotiated)`, would leave the contract unable to
 * say the thing it was negotiated to say, and would silently shorten an
 * engagement the customer signed for. The number below applies where no
 * authorisation exists to state one.
 *
 * 🛑 **G292, 19 Sep 2026 — THIS CONSTANT IS NOW A LIVENESS TERM AND NOT ONLY A
 * CEILING, AND IT HAS A SECOND READER OUTSIDE THIS MODULE.** The ruling makes
 * the ceiling *"a property of the PREDICATE rather than of whoever issues the
 * grant — so a grant cannot be issued, or extended, past it, and the enforcement
 * does not depend on the issuing path being the only path."* The second reader
 * is `selectTenantForSession()` (`model/access.ts` §7a), which refuses to bind a
 * tenant to a session on a grant held longer than the number below **even when
 * that grant is unrevoked and unexpired**. There is no issuing path anywhere in
 * this repository — which is exactly why the ceiling could not be left to one.
 *
 * ⚠️ **AND THERE IS A THIRD COPY OF THESE TWO NUMBERS, IN SQL, ON PURPOSE.**
 * `db/migrations/0008_staff_grant_selection.sql` seeds
 * `tenant.grant_duration_ceiling` because a policy expression cannot import a
 * TypeScript constant. It is a copy this repository normally forbids —
 * `0002_run.sql`: *"a third place to drift, and the one nothing checks"* — and
 * the difference is that this one IS checked: `tests/db/…` reads both and
 * requires set equality in BOTH directions, so editing this record without
 * editing that seed is a RED, not a silent divergence.
 */
export const MAX_GRANT_HOURS: Record<AccessPurpose, number> = {
  incident: 24,
  delivery: 24 * 90,
}

/* ------------------------------------------------------------------ *
 * The standing authorisation each grant draws against
 * ------------------------------------------------------------------ */

/**
 * The customer's consent, given once at signing, that per-incident grants draw
 * against (§8.5).
 *
 * WHY IT EXISTS. The standing constraint from July — "I do not want to be
 * waiting on a customer internal process to have access to the environment
 * either for troubleshooting or completing delivery work" — has to be
 * reconciled with *being staff is not access*. It is reconciled by moving
 * consent to the moment the customer is actually READING, not the moment we are
 * actually working. A per-incident approval at 03:00 is theatre: nobody reads
 * it, they click yes. And a control people route around is worse than a looser
 * one they use — because under BYOA the way people route around it is to work
 * in the customer's own console, where this model never sees the activity at
 * all.
 *
 * WHAT SHAPE IT REUSES, AND THE LIMIT IT INHERITS. This is `EntitlementLease`
 * applied to access instead of capacity: a signed, time-boxed standing
 * permission drawn down locally. It inherits that type's honest statement of
 * its own limit — withdrawal stops FUTURE draws, it does not kill live ones, so
 * the guarantee is *"no more than the ceiling, and not past expiry"*, never
 * *"stops on command"*. A customer who needs a live session to stop revokes the
 * `TenantAccessGrant`, or under BYOA withdraws the cross-account trust, which
 * is the only lever that was ever real.
 *
 * WHAT IT IS NOT. It is not the second party to an issue. §10.2 keeps the
 * two-person rule at 1CloudHub, and the runner-up — treating the contract-time
 * signature as the approver — was rejected precisely because it would put a
 * CUSTOMER principal in `TenantAccessGrant.approvedByStaffUserId`, a different
 * control wearing the same field.
 */
export interface SupportAuthorisation extends TenantScoped {
  id: string
  /** Which purposes may be self-issued at all. An absent purpose is refused. */
  purposes: AccessPurpose[]
  /**
   * The classes this contract opens, INCLUDING the contract-only ones. Naming
   * `authority` here is the only way it is ever reachable; naming `statutory`
   * has no effect, because that class is refused before this list is read.
   *
   * Note the polarity: when an authorisation exists it GOVERNS, so a class
   * absent from this list is refused even where the purpose would otherwise
   * permit it. Signing a narrow authorisation narrows.
   */
  resourceClasses: AccessResourceClass[]
  /** The negotiated ceiling per purpose. Replaces MAX_GRANT_HOURS, not capped by it. */
  maxHours: Record<AccessPurpose, number>
  /**
   * Who at 1CloudHub may draw against this.
   *
   * EMPTY AUTHORISES NOBODY, not everybody — the same polarity as
   * `AccessResourceGrant.nominatedDocumentIds`, and for the same reason: a
   * freshly constructed record, a failed lookup and a defensive `catch` must all
   * fail closed. §8.6 records what the opposite polarity cost elsewhere.
   */
  mayInvokeStaffUserIds: UserId[]
  /**
   * Where the operational notice goes when a grant is issued against this.
   *
   * Carried here rather than looked up, so the notice has a destination even for
   * a tenant nobody is administering. §10.1 makes that notice a service
   * communication rather than a content-bearing digest, which is what stops
   * `customerNotifiedAt` deadlocking every grant in the system.
   */
  notificationPath: string
  /** The contract clause this is evidence of. The paperwork is the control. */
  contractRef: string
  authorisedAt: Timestamp
  /**
   * A CUSTOMER principal — the person who signed. Deliberately not the same
   * field type-adjacent readers assume of `approvedByStaffUserId`, which holds
   * 1CloudHub staff and must keep doing so.
   */
  authorisedBy: UserId
  /** Stops future draws. Says nothing about sessions already open. */
  withdrawnAt: Timestamp | null
}

/** Why a draw against the standing authorisation was refused. Closed. */
export type AuthorisationRefusal =
  /**
   * Never delegable. Not a configuration outcome — a standing one.
   *
   * The name matches `NON_DELEGABLE_RESOURCES` exactly again as of 8 Aug 2026
   * (G75). Between 5 and 8 Aug the list also held `secret` and this code was
   * returned for it, so a refusal saying *statutory* was raised over a
   * credential — a name keyed on a convenient landmark rather than the property
   * it protects (§5.1). Keeping the narrow name is deliberate: it is designed to
   * become wrong the moment a second class is added. See
   * `NON_DELEGABLE_RESOURCES`.
   */
  | 'statutory_never_delegable'
  /** A contract-only class with no contract behind it. */
  | 'no_authorisation'
  | 'authorisation_withdrawn'
  | 'purpose_not_authorised'
  | 'resource_not_authorised'
  /** The purpose does not reach this class, and no contract may move it there. */
  | 'beyond_purpose'
  | 'staff_not_nominated'

export type AuthorisationVerdict =
  | { permitted: true }
  | { permitted: false; refusal: AuthorisationRefusal }

/**
 * May this staff member draw THIS class, for THIS purpose, against this
 * authorisation?
 *
 * Structural only, and deliberately clock-free for the same reason
 * `grantAllows()` is: expiry is a time question answered where the caller has a
 * clock. Withdrawal is a null check, not a clock, so it belongs here.
 *
 * Order is load-bearing. `statutory` is refused BEFORE the null check, before
 * withdrawal, before anything — so no absent record, no malformed authorisation
 * and no future edit to the order of the other branches can reach it.
 *
 * ⚠️ THAT ORDERING IS ALSO WHY G60 WOULD HAVE BEEN INERT ON ITS OWN. G60 said
 * the FDE may reach `secret`; nobody noticed that `secret` was ALSO in
 * `NON_DELEGABLE_RESOURCES`, which this function tests first — so adding it to a
 * permitted list would have changed nothing observable, and the decision would
 * have been recorded as applied while the FDE still could not bind a
 * credential. G75 is the edit to both lists. The lesson generalises: a
 * first-position refusal makes every later list a no-op for the classes it
 * names, so widening a permitted list means checking this list too.
 *
 * 🛑 **THIS FUNCTION HAS A CALLER OUTSIDE THIS MODULE SINCE 19 Sep 2026, AND IT
 * IS HERE BECAUSE OF THE ORDERING PARAGRAPH ABOVE RATHER THAN IN SPITE OF IT.**
 * `selectTenantForSession()` (`model/access.ts` §7a) calls it once per resource
 * line on the staff arm, with `authorisation = null`. G167's content — carried
 * through its own reversal by G199 — is that the staff arm must test
 * *"`PERMITTED_RESOURCES`, `CONTRACT_ONLY_RESOURCES` and
 * `NON_DELEGABLE_RESOURCES` — all three, in ONE helper with ONE call site"*, and
 * **this is that helper**: an arm that reached for the lists directly would
 * choose its own order, and the order is the thing G75 had to be taken to
 * discover. **Do not add an early return above the `NON_DELEGABLE_RESOURCES`
 * line; two callers now depend on its position, and one of them is a door.**
 */
export function authorisationPermits(
  authorisation: SupportAuthorisation | null,
  purpose: AccessPurpose,
  resource: AccessResourceClass,
  staffUserId: UserId,
): AuthorisationVerdict {
  if (NON_DELEGABLE_RESOURCES.includes(resource)) {
    return { permitted: false, refusal: 'statutory_never_delegable' }
  }

  if (authorisation === null) {
    if (CONTRACT_ONLY_RESOURCES.includes(resource)) {
      return { permitted: false, refusal: 'no_authorisation' }
    }
    return PERMITTED_RESOURCES[purpose].includes(resource)
      ? { permitted: true }
      : { permitted: false, refusal: 'beyond_purpose' }
  }

  if (authorisation.withdrawnAt !== null) {
    return { permitted: false, refusal: 'authorisation_withdrawn' }
  }
  if (!authorisation.purposes.includes(purpose)) {
    return { permitted: false, refusal: 'purpose_not_authorised' }
  }
  if (!authorisation.resourceClasses.includes(resource)) {
    return { permitted: false, refusal: 'resource_not_authorised' }
  }
  /**
   * A contract may OPEN a contract-only class; it may never MOVE an ordinary
   * one across purposes. Without this line a customer could authorise
   * `tenant_data` for `delivery` and dissolve the property that makes a 90-day
   * grant acceptable — with the customer's own signature as the justification.
   */
  if (
    !CONTRACT_ONLY_RESOURCES.includes(resource) &&
    !PERMITTED_RESOURCES[purpose].includes(resource)
  ) {
    return { permitted: false, refusal: 'beyond_purpose' }
  }
  if (!authorisation.mayInvokeStaffUserIds.includes(staffUserId)) {
    return { permitted: false, refusal: 'staff_not_nominated' }
  }
  return { permitted: true }
}

/**
 * The duration ceiling that actually applies, in hours.
 *
 * The negotiated number wins where one exists — see MAX_GRANT_HOURS for why
 * this is not a `min()`.
 */
export function maxGrantHours(
  authorisation: SupportAuthorisation | null,
  purpose: AccessPurpose,
): number {
  if (authorisation === null || authorisation.withdrawnAt !== null) {
    return MAX_GRANT_HOURS[purpose]
  }
  return authorisation.maxHours[purpose]
}

/**
 * Hours between two `Timestamp`s.
 *
 * The ONLY place this module parses a timestamp. Everywhere else a duration is
 * a caller-supplied number — `idleDays` here, `secondsSinceLastBeat` in
 * deployment.ts — because `Timestamp` is an opaque string alias and the model
 * owns no clock. A ceiling is different: it must be derived from the two dates
 * ON THE GRANT, or a caller could satisfy it by passing a smaller number.
 *
 * Returns NaN on anything unparseable, and every caller must treat that as a
 * refusal rather than letting a NaN comparison fall through to `false`.
 */
export function hoursBetween(from: Timestamp, to: Timestamp): number {
  return (Date.parse(to) - Date.parse(from)) / 3_600_000
}

export type AccessMode = 'read' | 'write'

export interface AccessResourceGrant {
  resource: AccessResourceClass
  mode: AccessMode
  /**
   * The instances this line reaches, where the purpose requires an enumeration
   * (see REQUIRES_ENUMERATION). The customer nominates them, and that
   * nomination is their auditable act.
   *
   * Was `nominatedDocumentIds: SourceDocumentId[]`, which could only ever name
   * documents — so an FDE needing one EXCEPTION to debug a mapping had no
   * delivery path and would raise an incident grant instead. Widened to bare
   * ids because a delivery enumeration may legitimately name a document, an
   * exception or a run.
   *
   * A FINITE ENUMERATION, never a pattern. `id = ANY($1)` is still a SELECT;
   * `id LIKE '01J%'` is not, and the reverse query — "who can reach this" —
   * has to stay relational.
   */
  /**
   * ⚠️ STAYS BARE (R4), AND THE PARAGRAPH ABOVE IS THE ARGUMENT. It WAS
   * `nominatedDocumentIds: SourceDocumentId[]` — branded, and wrong, because a
   * branded enumeration could only ever name documents and an FDE needing one
   * EXCEPTION had no delivery path. Widening it to bare ids is what fixed that.
   * Re-branding it to any single type in this sweep would reinstate exactly the
   * defect the widening removed. Listed in `BareByRule` in `model/identity.ts`.
   */
  nominatedSubjectIds: string[]
}

/**
 * An extension to a delivery grant.
 *
 * Delivery slips. Extension is deliberately within 1CloudHub's control rather
 * than a customer approval loop — waiting on someone else's internal process to
 * finish our own delivery work is how engagements stall. It still costs two
 * staff, a stated reason and a notification, and every extension is a row.
 */
export interface AccessExtension {
  at: Timestamp
  extendedTo: Timestamp
  reason: string
  extendedByStaffUserId: UserId
  /** Self-extension is the failure mode this exists for. */
  approvedByStaffUserId: UserId
  customerNotifiedAt: Timestamp | null
}

export type AccessRevocation =
  | 'completed'
  /** Lapsed unused. The abandoned grant nobody remembered to close. */
  | 'idle'
  | 'engagement_ended'
  | 'withdrawn_by_customer'
  | 'withdrawn_by_staff'
  | 'superseded'

/**
 * One incident or one engagement. Draws against a `SupportAuthorisation`.
 *
 * THE TWO-PERSON RULE HOLDS, AND §8.5 DOES NOT REPEAL IT (§10.2). Read alone,
 * "each incident self-issues against that entitlement" looks like it deletes
 * `approvedByStaffUserId !== staffUserId`. It does not. *Self-issue* means
 * WITHOUT THE CUSTOMER, not without a second pair of eyes: what §8.5 asked for
 * was "I do not want to be waiting on a **customer internal process**", and a
 * second 1CloudHub engineer is a rota problem, which is ours. The on-call
 * engineer raises; a second staff member approves; nobody wakes the customer.
 *
 * The runner-up — treating the customer's contract-time signature as the second
 * party — was rejected because it would put a customer principal in
 * `approvedByStaffUserId`, and every reader of that row currently assumes two
 * 1CloudHub people looked at it. The customer's signature lives on
 * `SupportAuthorisation.authorisedBy`, where it means what it says.
 *
 * Cost, stated rather than discovered: at 03:00 on a Sunday you need two
 * people. That is an operational commitment and should be priced before it is
 * promised.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ SINCE 19 Sep 2026 THIS ROW IS INVARIANT 8's PERMITTED PATH IN FACT AND NOT
 *    ONLY IN PRINCIPLE — S-21, G199 and G292.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `selectTenantForSession()` (`model/access.ts` §7a) reads one of these to bind
 * a tenant to a staff session, and `db/migrations/0008_staff_grant_selection.sql`
 * carries the same predicate as an `AS RESTRICTIVE` `WITH CHECK` disjunct on
 * `tenant.session`. **Until then a platform FDE could not be scoped to a tenant
 * at all** — G199 declared that cost in writing and two tests asserted it, and
 * both went RED on the commit that ended it.
 *
 * 🛑 **THREE OF THIS INTERFACE'S FIELDS ARE NOW LOAD-BEARING IN A POLICY
 * EXPRESSION AND A FOURTH DECIDES THE CEILING: `staffUserId`, `tenantId`,
 * `revokedAt`/`expiresAt`, and `purpose`.** G292's liveness terms are
 * *"unrevoked, unexpired, AND within a maximum duration ceiling"*, the ceiling
 * being `MAX_GRANT_HOURS[purpose]` measured from `grantedAt` to the latest of
 * `expiresAt` and any `extensions[].extendedTo`. **Renaming or re-typing any of
 * them is a migration, not a refactor.**
 *
 * ⚠️ **AND SELECTION IS NOT USE. `evaluateTenantAccess()` below is unchanged and
 * is still the gate on reaching anything.** The selection arm deliberately
 * enforces neither `customerNotifiedAt`, nor `approvedByStaffUserId !==
 * staffUserId`, nor `idleRevokeDays`, nor `engagementRef`, nor
 * `Tenant.supportAccessMode` — every one of those needs a parameter the
 * selection input refuses to carry, and reading a `Tenant` row there is the very
 * thing B2 proved cannot happen before the scope exists. **A bound session is
 * not an authorised read.**
 */
export interface TenantAccessGrant extends TenantScoped {
  /**
   * BRANDED 7 Aug, slice 6, with `AccessSession.grantId` and
   * `PlatformTenantInspection.supportGrantId`. Invariant 8: being staff is not
   * access — reaching a tenant requires one of these rows, so a reference to it
   * resolving to something else is the shape that would make the invariant
   * unenforceable rather than merely unenforced.
   */
  id: TenantAccessGrantId
  purpose: AccessPurpose
  staffUserId: UserId
  /**
   * A second staff member. The invariant approvedByStaffUserId !== staffUserId
   * is enforced at issue AND re-checked in evaluateTenantAccess, deliberately,
   * so a grant written around the issue path still fails when it is used.
   * Self-approval is the failure mode this exists for. Do not remove it on the
   * strength of §8.5 — see the type comment above.
   */
  approvedByStaffUserId: UserId
  /** Required, free text, and shown to the customer. */
  justification: string

  resources: AccessResourceGrant[]

  grantedAt: Timestamp
  expiresAt: Timestamp
  /**
   * Delivery only. The grant cannot outlive the engagement someone signed —
   * a date that already exists rather than a fresh judgement call.
   */
  engagementRef: string | null
  /** Lapses after this many idle days regardless of expiry. */
  idleRevokeDays: number
  lastUsedAt: Timestamp | null
  extensions: AccessExtension[]

  /**
   * Literal `true`, so an access the customer cannot see is unrepresentable
   * rather than merely discouraged. The audit trail IS the customer-facing
   * surface — decided 5 Aug in preference to a separate standing view.
   */
  visibleToTenant: true
  customerNotifiedAt: Timestamp | null
  /**
   * Null unless this tenant requires approval. Default posture is
   * `granted_only` — no customer gate — because blocking troubleshooting or
   * delivery on someone else's internal process is not acceptable.
   *
   * The setting remains because a regulated buyer may have contracted for it,
   * and because under BYOA it is only half ours anyway: the cross-account role
   * trust policy lives in the customer's account and they can gate or revoke it
   * whatever this field says. See Tenant.supportAccessMode.
   */
  customerApprovedAt: Timestamp | null

  revokedAt: Timestamp | null
  revokedBy: UserId | null
  revocationReason: AccessRevocation | null
}

/** One period of actual use. The grant permits; the session records. */
export interface AccessSession extends TenantScoped {
  id: string
  /** The grant this session drew against. The grant permits; the session records. */
  grantId: TenantAccessGrantId
  staffUserId: UserId
  startedAt: Timestamp
  endedAt: Timestamp | null
  /**
   * Which classes were actually touched this session, which is usually narrower
   * than what the grant permits and is the number worth reporting.
   */
  resourcesTouched: AccessResourceClass[]
  /** Every distinct thing looked at, for the customer-facing access report. */
  accessedSubjects: string[]
}

/**
 * Structural check only: does this grant permit this operation at all?
 *
 * Deliberately takes no clock. Expiry, idle lapse and engagement end are
 * enforced when a session opens, where the caller has a time source — keeping
 * this function pure and testable, as livenessFor() is in deployment.ts.
 *
 * TAKES THE TENANT BEING REACHED, added 5 Aug. It previously took the grant and
 * never compared `grant.tenantId` to anything, so a grant for tenant A
 * validated an operation against tenant B — the exact shape of the failure this
 * whole module exists to prevent, in the function named after permitting it.
 * Invariant 1 says tenant scope is derived from the session; comparing it here
 * is what makes that derivation load-bearing rather than decorative.
 *
 * Reachability is delegated to authorisationPermits() rather than testing
 * PERMITTED_RESOURCES directly, so `statutory`, the contract-only classes and
 * the nominated-staff roster are decided in ONE place for both this function
 * and evaluateTenantAccess().
 */
export function grantAllows(
  grant: TenantAccessGrant,
  tenantId: TenantId,
  authorisation: SupportAuthorisation | null,
  resource: AccessResourceClass,
  mode: AccessMode,
): boolean {
  if (grant.tenantId !== tenantId) return false
  if (authorisation !== null && authorisation.tenantId !== tenantId) return false
  if (grant.revokedAt !== null) return false
  if (
    !authorisationPermits(authorisation, grant.purpose, resource, grant.staffUserId)
      .permitted
  ) {
    return false
  }
  const line = grant.resources.find((r) => r.resource === resource)
  if (line === undefined) return false
  /**
   * The enumeration rule, generalised from the `sample_data` special case it
   * replaces. An empty list grants nothing rather than everything — the same
   * polarity the whole model was corrected to on 5 Aug.
   *
   * NOTE what this still does not do: it checks that AN enumeration exists, not
   * that the subject being reached is IN it. That check needs the subject, and
   * `grantAllows` does not take one. This is the caller-checks-the-other-half
   * shape that `decide()` was built to end, surviving here because the fix is a
   * signature change with a caller audit behind it.
   */
  if (
    REQUIRES_ENUMERATION[grant.purpose].includes(resource) &&
    line.nominatedSubjectIds.length === 0
  ) {
    return false
  }
  return mode === 'read' ? true : line.mode === 'write'
}

/**
 * Who acted. Distinguishes a customer user from partner staff from platform
 * staff on every audited event — without which BreachRecord.affectedTenants is
 * unpopulatable, and the only defensible response to a staff-credential
 * incident is to notify every tenant.
 */
export type AuditActor =
  /**
   * A user of the tenant. Gains `orgClass` and `assignmentId` on 5 Aug (§8.3).
   *
   * THE DELEGATED CASE WAS BETTER RECORDED THAN THE DIRECT ONE. Three of the
   * four original variants carried their authority inline — `partnerId` +
   * `grantId`, `supportGrantId`, and the agent variant's `onBehalfOf` — while
   * the ordinary user variant carried a bare id and nothing else. So an agent's
   * read could be traced to the authority behind it and a human's could not.
   *
   * Org is DERIVED from the identity connection at authentication (§8.3, §8.9)
   * and stamped here at write time, because an IdP knows who someone is *now*
   * and an audit needs who they were *then*. Left to a join, every historic
   * approval would be retrospectively attributed to the actor's current
   * employer — wrong in exactly the cases that matter, and unrecoverable. This
   * is the same discipline as `CorrespondenceMessage.admittingToolScopeSize`: a
   * row must reach its authority without traversing a mutable table.
   */
  | {
      kind: 'user'
      userId: UserId
      orgClass: OrgClass
      /**
       * The assignment the act ran under. Null ONLY where no assignment was in
       * the path — authentication, consenting to one's own role, a self-service
       * act on one's own account. A null on a capability-gated act is a defect
       * in the writer, not a permitted shape, and is worth a standing query.
       */
      assignmentId: string | null
    }
  | { kind: 'partner_staff'; userId: UserId; partnerId: PartnerId; grantId: string }
  | {
      kind: 'platform_staff'
      userId: UserId
      supportGrantId: string
      /**
       * The standing authorisation the grant drew against (§8.5).
       *
       * Null where there was none to draw against — a grant predating the
       * regime, or a `BreakGlassPreservation`, which by design answers to an
       * external order rather than to a contract. A null is therefore
       * meaningful rather than missing, and is the row an auditor should read
       * first.
       */
      supportAuthorisationId: string | null
    }
  /**
   * Genuine machinery — a scheduler, a retention sweep. NOT an agent.
   */
  | { kind: 'system'; component: string }
  /**
   * An agent acting under a delegation.
   *
   * Added 5 Aug. Agent reads audited as `{ kind: 'system', component: 'C8' }`,
   * which cannot answer which step, which model, or under whose authority — so
   * DataAccessEvent could not attribute a classified read to a delegation, and
   * "under whose authority did this agent read this document" was unanswerable
   * from stored rows.
   *
   * `onBehalfOf` is carried inline rather than joined, so the row reaches a
   * human without traversing a mutable table — the same discipline as
   * CorrespondenceMessage.admittingToolScopeSize.
   */
  | {
      kind: 'agent'
      stepId: string
      stepExecutionId: string
      /**
       * BRANDED 7 Aug 2026, with `ProposalActor.agent.modelId`,
       * `PackBinding.modelOverride` and `TokenUsage.model`. Was `string`. The
       * audit row is where "which model did this under whose authority" is
       * answered; an unresolvable identifier makes it unanswerable against the
       * catalogue that carries region and retention posture.
       *
       * `stepId` and `stepExecutionId` beside it stay bare deliberately —
       * separate finding, and branding them is the identity sweep's business,
       * not the trim's.
       */
      modelId: ModelCatalogEntryId
      onBehalfOf:
        | { kind: 'user'; userId: UserId; assignmentId: string }
        | { kind: 'policy'; policyId: string; policyVersion: number }
    }

/** Read access to sensitive data is itself an event. */
/* ------------------------------------------------------------------ *
 * Tamper evidence for the record streams
 * ------------------------------------------------------------------ */

/**
 * A hash chain over an append-only record stream.
 *
 * WHY THIS EXISTS, AND WHY IT DID NOT. `UsageRecord.sequence` is monotonic per
 * plane so "a gap is detectable rather than merely absent", and
 * `UsageAttestation` is hash-chained and signed because — its own words — "the
 * lease was an honour system without this". Both were built because a
 * customer-owned data plane could under-report.
 *
 * `AuditEvent` and `DataAccessEvent` live in the same database, under the same
 * customer root, and carried NO sequence, NO hash and NO signature. So the
 * thing that costs us money was tamper-evident and the thing that proves who
 * touched a data subject's record was not. The argument was made once and not
 * carried across.
 *
 * WHAT THIS DOES AND DOES NOT BUY. It makes a deleted row and an edited row
 * detectable — the chain breaks. It does NOT defend against a root holder who
 * rewrites the whole chain, and under BYOA that is exactly who holds the
 * database. That is why `anchoredHead` exists.
 *
 * ⚠️ NO CANONICALISATION SCHEME IS DEFINED ANYWHERE IN THIS REPOSITORY.
 * `UsageAttestation.bodyHash` says "canonical body" and nothing states what
 * canonical means — no JCS, no RFC 8785. A hash over JSON whose serialisation
 * two implementations disagree about is the CVE-2017-12635 shape: one document,
 * two parsers, two authorisation answers. Pick a scheme before the first hash
 * is computed, because afterwards every stored chain is bound to it.
 */
export interface RecordChain {
  /**
   * Monotonic per tenant per stream. Gaps are the detection; absence of a row
   * is invisible without it.
   */
  sequence: number
  /** Hash of the previous record's canonical body. Null only at sequence 1. */
  previousHash: string | null
  /** Hash of this record's canonical body. */
  bodyHash: string
}

/**
 * The periodic anchor that makes the chain mean something under BYOA.
 *
 * A chain the customer holds entirely is a chain the customer can rewrite
 * entirely. The fix is NOT to ship audit content upward — that would break
 * invariant 3, and the audit trail is precisely the tenant data the control
 * plane must never read.
 *
 * So ship the HEAD HASH ONLY. It is a scalar. It carries no subject, no actor,
 * no action and no field value, so it crosses the plane boundary without
 * carrying tenant data — and once we hold it, a rewritten history no longer
 * matches an anchor we recorded before the rewrite.
 *
 * Same shape as `UsageAttestation`, one property weaker: we can prove the
 * chain changed, not what it used to say.
 */
export interface ChainAnchor {
  /**
   * ADDED 7 Aug (G35). THE EVIDENCE ROW IN A DISPUTE WITH A CUSTOMER WHO HOLDS
   * THE CHAIN. Its whole purpose is to be produced later and compared against a
   * history that may have been rewritten, which makes "which anchor did we
   * rely on" the first question asked of it — and `(tenantId, stream,
   * throughSequence)` is not an answer once an anchor can be re-taken.
   */
  id: ChainAnchorId
  tenantId: TenantId
  stream: 'audit' | 'data_access'
  /** The sequence this anchor covers up to, inclusive. */
  throughSequence: number
  headHash: string
  anchoredAt: Timestamp
}

export interface DataAccessEvent extends TenantScoped {
  id: string
  /** Tamper evidence. See RecordChain — this stream was unprotected until 5 Aug. */
  chain: RecordChain
  actor: AuditActor
  /**
   * THE SPINE, on the read stream. Same field, same type, same meaning as on
   * `AuditEvent` and `UsageRecord` — one identifier all three carry, so *"who
   * read this, under what authority, and what did the inference cost"* is one
   * query rather than three that cannot be combined.
   *
   * This stream is where the join matters most, and it is where it was most
   * obviously missing. `maxDataClass` records HOW SENSITIVE the read was and
   * `actor` records WHO — and the authorisation that permitted a
   * `sensitive_personal` read was computed, used, and discarded. So the one
   * question a regulator asks first, *under what authority was this person's
   * record opened*, was answerable only by reconstructing the principal's
   * assignments as they stood at the time, from a table that has since changed.
   *
   * Nullable, and `authorizationIsWellFormed()` below says exactly when.
   */
  authorizationId: AuthorizationGrantId | null
  at: Timestamp
  subjectType: string
  /**
   * ⚠️ STAYS BARE (R4), and DELIBERATELY IDENTICAL TO `AuditEvent`'s. The pair
   * `(subjectType, subjectId)` IS the identifier; a read row names a row of ANY
   * type. The two streams answer *"who read this and who changed it"* together,
   * and a divergence in this pair between them is what would break that join.
   * Listed in `BareByRule` in `model/identity.ts`.
   */
  subjectId: string
  /** Highest classification actually returned. */
  maxDataClass: DataClass
}

/* ------------------------------------------------------------------ *
 * When an unauthorised record is legitimate
 * ------------------------------------------------------------------ */

/**
 * WHICH ACTOR KINDS MAY LEAVE `authorizationId` NULL.
 *
 * THE LAW, EXECUTABLE RATHER THAN COMMENTED — the same treatment
 * `DURABLE_ASSIGNMENT_PERMITTED` gives "being staff is not access". A nullable
 * join key with a paragraph explaining when null is acceptable is a rule that
 * nothing enforces and every writer interprets for itself; the failure mode is
 * a stream where a third of the rows carry null and nobody can tell which of
 * those are legitimate.
 *
 * TOTAL OVER `AuditActor['kind']`, so a sixth actor variant is a COMPILE ERROR
 * until somebody decides whether it acts under an authorisation. That is the
 * same discipline as `CAPABILITY_RESOURCE_CLASS` keying on `Capability`.
 *
 * ONE KIND MAY. `system` is genuine machinery — a retention sweep, a scheduler
 * tick, the timeout clock that ends a parked `await`. No capability was
 * evaluated because there was no principal to evaluate one against, and
 * inventing a service principal to satisfy the column would be worse than the
 * null: it would put machine work in the same table shape as human work and
 * make *"acts with no human behind them"* unqueryable.
 *
 * FOUR MAY NOT, and `agent` is the one worth stating out loud. An agent looks
 * like machinery and is not: it acts under a delegation, `AuditActor.agent`
 * carries `onBehalfOf` inline precisely so the delegator is reachable, and
 * agent authority is an intersection that includes "the scope of the initiating
 * principal". An agent read with no authorisation is the exact gap §3 closed —
 * a bounded capability quietly acting unbounded.
 *
 * ⚠️ WHAT THIS DOES NOT COVER. Authentication itself, and self-service acts on
 * one's own account, produce `{ kind: 'user' }` rows with no capability in the
 * path — `AuditActor.user.assignmentId` documents the same exemption for the
 * same reason. Those rows will fail this check. That is DELIBERATE and it is the
 * cheaper error: a small, enumerable set of known-null actions that a standing
 * query filters by `action`, versus a `user` variant that may carry null
 * whenever a writer felt like it. The alternative — an `authorizationOptional`
 * flag per action — is a second policy surface, and there is no budget for one.
 */
export const AUTHORIZATION_MAY_BE_ABSENT: Record<AuditActor['kind'], boolean> = {
  user: false,
  partner_staff: false,
  platform_staff: false,
  agent: false,
  system: true,
}

/**
 * Does this row's authorisation reference agree with its actor?
 *
 * Structural only, and deliberately so: it answers *may this row look like
 * this*, not *was that authorisation valid* — which is `redeemAuthorization()`
 * in access.ts and needs a live principal this function has no business taking.
 * Splitting a check across two components is what `decide()` exists to end, and
 * this is not that split: these are two different questions, and neither one
 * hands the other half back to a caller.
 *
 * Returns false rather than throwing, because it is a WRITE-TIME GATE on an
 * append-only stream and the answer to a malformed audit row is to refuse the
 * write, not to lose the row to an exception on a hot path.
 */
export function authorizationIsWellFormed(
  actor: AuditActor,
  authorizationId: AuthorizationGrantId | null,
): boolean {
  if (authorizationId !== null) {
    /**
     * A `system` actor that DOES carry one is fine and is not an error: a
     * scheduler running a job on a user's standing delegation legitimately has
     * an authorisation to name. The table says when null is permitted, never
     * when a reference is forbidden.
     */
    return true
  }
  return AUTHORIZATION_MAY_BE_ABSENT[actor.kind]
}

/**
 * The closed list of service-notice kinds — pass D §10.1's carve-out, made
 * mechanical.
 *
 * **WHY THIS EXISTS, AND IT IS NOT TIDINESS.** `evaluateTenantAccess()` below
 * refuses any grant whose `customerNotifiedAt` is null. Nothing could set it,
 * because a notification is a read under §8.4 unless it is *service
 * communication*, and "service communication" had no definition — so the
 * carve-out was, in the words of the comment that used to sit at the refusal,
 * *"held open by a comment"*. **Every support grant failed forever.** That is
 * the deadlock this constant clears.
 *
 * The rule it encodes: *"1CloudHub opened a support grant on your tenant"*
 * carries no tenant data and is not a read, which is why `mayNotifyContact()`
 * gates a contact on VERIFICATION and never on capability. A notice that
 * carries tenant data is not on this list at all — it is a §8.4 read and needs
 * `view_summary`, a mask, a classification ceiling and a residency check.
 *
 * ⚠️ **THE RISK NAMED WHEN THIS WAS DECIDED IS NOT CLOSED BY WRITING THE LIST:**
 * *"service communication is a category someone will widen."* The list is what
 * makes widening an act rather than a judgement call per call site — which is
 * *narrowing is automatic, widening is an act* applied to a notification
 * channel.
 */
export const SERVICE_NOTICE_KINDS = {
  /** The three that clear the deadlock. Each names a grant, never its contents. */
  supportGrantIssued: 'support_grant_issued',
  supportGrantExtended: 'support_grant_extended',
  supportGrantClosed: 'support_grant_closed',
  /** Pre-authorised at signing under the 72-hour clause: notification, not approval. */
  securityPatchApplied: 'security_patch_applied',
  scheduledMaintenance: 'scheduled_maintenance',
  /**
   * The three drawn on `Mockups/rec/Notifications.dc.html`'s catalogue — ⚠️ **an
   * ARCHIVE path since G264, `git show
   * archive/pre-handoff-pack:Mockups/rec/Notifications.dc.html`; the pack ships
   * no notification catalogue** — that are
   * about the SYSTEM rather than about a row. Each says the machinery did or
   * did not do something; none of them names a tenant row at all.
   *
   * ⚠️ **`work_assigned` WAS HERE AND WAS REMOVED — G93, 8 Aug 2026.** See the
   * ruling below the map; it is the reason this list is eight and not nine.
   */
  runFailed: 'run_failed',
  connectionUnreachable: 'connection_unreachable',
  postingFailed: 'posting_failed',
} as const

export type ServiceNoticeKind =
  (typeof SERVICE_NOTICE_KINDS)[keyof typeof SERVICE_NOTICE_KINDS]

/**
 * THE WHOLE CONTROL. Total over the kind, so a tenth kind is a compile error
 * until somebody says whether it carries tenant data.
 *
 * ⚠️ **Typed `Record<ServiceNoticeKind, false>` and NOT `<…, boolean>`, and the
 * literal is the entire mechanism.** `boolean` would make widening a
 * configuration change; `false` makes it a compile error. **A kind that carries
 * tenant data does not belong in this map at all** — it belongs in the digest
 * path behind `view_summary`, which is capability 31 and reaches a mailbox we
 * do not control (§10.6).
 *
 * 🟢 **UNLIKE THE FIVE TOTAL RECORDS OF §5.10, THIS ONE IS ITS OWN
 * CONSTRUCTION SITE.** `PolicyDefaults` and `RetentionPolicy` are types with no
 * value, so `tsc` confirmed their shape was total and never that any content
 * satisfied it. This is a `const` with the literal written out, so the totality
 * bites the moment a kind is added. **Verified with two red runs, 8 Aug 2026,
 * both reverted:** a tenth kind with no row here gives
 * `TS2741: Property 'red_flag_test_kind' is missing … but required in type
 * 'Record<ServiceNoticeKind, false>'`, and a tenth kind mapped `true` gives
 * `TS2322: Type 'true' is not assignable to type 'false'`.
 *
 * ⚠️ **What is still NOT witnessed is the ROUTING, and no red run can reach
 * it.** Nothing sends a notice — `sendServiceNotice` exists on no contract — so
 * this map proves what a notice kind may be and proves nothing about whether a
 * real notice takes this path. That gap closes with an operation and a test,
 * not with another type.
 */
export const NOTICE_CARRIES_TENANT_DATA: Record<ServiceNoticeKind, false> = {
  support_grant_issued: false,
  support_grant_extended: false,
  support_grant_closed: false,
  security_patch_applied: false,
  scheduled_maintenance: false,
  run_failed: false,
  connection_unreachable: false,
  posting_failed: false,
}

/**
 * 🛑 **G93, 8 Aug 2026 — THE BOUNDARY IS STRICT, AND `work_assigned` CAME OUT.**
 *
 * **The rule, and it is the hard reading:** a service notice may say that the
 * SYSTEM did or did not do something. **The moment a notice names a tenant row
 * — an exception, a finding, a posting — it is a §8.4 read**, and it needs
 * `view_summary`, a mask, a classification ceiling and a residency check. It is
 * not a service notice however operationally useful it would be to treat it as
 * one.
 *
 * **The alternative was offered and REJECTED, and the argument is preserved
 * because that is house style:** the softer rule was *a notice names an OBJECT
 * and never its CONTENTS*, which would have kept `work_assigned` and admitted
 * `undo_window_expiring` as a tenth kind, on the ground that an identifier is
 * not a value and invariant 4's grain is the field. **It was rejected as a line
 * someone will push on.** "Names an object" has no mechanical test; "carries no
 * tenant data" does.
 *
 * ⚠️ **THIS COSTS A DRAWN SCREEN AND THE COST WAS ACCEPTED.**
 * `Mockups/rec/Notifications.dc.html` — ⚠️ **an ARCHIVE path since G264:
 * `git show archive/pre-handoff-pack:Mockups/rec/Notifications.dc.html`, and
 * the pack draws no replacement** — draws *"Finding assigned to you for
 * review"* at rank **Bell**, reaching a *"Named reviewer only"* — and under this
 * ruling the bell cannot tell that reviewer they have work without a capability
 * check. **The screen needs redrawing.** That is an action on the design team,
 * in the same bucket as G28, and it is recorded here rather than in a comment
 * nobody reads because this constant is where someone will try to put
 * `work_assigned` back.
 *
 * **Both affected events are now §8.4 reads behind `view_summary`:**
 * *"Finding assigned to you for review"* and *"Undo window expiring on your
 * posting"*. Neither is a `ServiceNoticeKind` and neither may become one.
 *
 * ---
 *
 * **How the question was found**, kept because the method generalises: by
 * diffing this list against the drawn catalogue, which is the check the build
 * contract asked for and which no tool performs.
 *
 * 🛑 **THIS COMMAND STOPPED RUNNING ON 18 Sep 2026 AND SAID NOTHING ABOUT IT.**
 * G264 deleted `Mockups/`, so `open('Mockups/rec/Notifications.dc.html')`
 * raises `FileNotFoundError` — **a reproduction that reproduces nothing, which
 * is worse than no reproduction at all**, because the sentence above still
 * claims a method. It is repaired rather than re-pointed: the catalogue lives
 * at the tag and the command reads it from `stdin`. **Verified to run and to
 * return the same seven names it returned before the deletion:**
 *
 * ```bash
 * git show archive/pre-handoff-pack:Mockups/rec/Notifications.dc.html \
 * | python3 -c "import re,sys;s=sys.stdin.read();\
 * print([dict(re.findall(r\"(\w+):\s*'([^']*)'\",r)).get('name') \
 * for r in re.findall(r'\{([^}]*)\}',s.split('catalogue: [')[1].split('],')[0])])"
 * ```
 *
 * ⚠️ **THE PACK HAS NO NOTIFICATION CATALOGUE AND THIS IS NOT RE-HOMED TO ONE.**
 * `grep -rn "catalogue: \[" docs/handoff-pack/` returns nothing, and no pack
 * record draws the seven events. **A citation re-pointed to an approximate home
 * is worse than one pointed at the tag**, because the next reader trusts it —
 * so this stays an ARCHIVE citation, labelled, until the pack draws the
 * catalogue. That absence is itself the finding: the design action this row
 * records ("the screen needs redrawing") now has no screen to redraw.
 *
 * **Seven events are drawn, and after G93 exactly THREE map to kinds here** —
 * run failed, connection lost, posting rejected. The other four are all §8.4
 * reads:
 *
 * | Drawn | Rank | Disposition |
 * |---|---|---|
 * | Reconciliation failed or did not fire | Interrupt | ✅ `run_failed` |
 * | Connection lost for over 10 minutes | Interrupt | ✅ `connection_unreachable` |
 * | Posting rejected by the ERP | Interrupt | ✅ `posting_failed` |
 * | Finding assigned to you for review | Bell | ⛔ §8.4 read — **G93 removed it** |
 * | Undo window expiring on your posting | Bell | ⛔ §8.4 read |
 * | Close pack ready to acknowledge | Digest | ⛔ §8.4 read, content-bearing |
 * | Period closing in three days | Digest | ⛔ §8.4 read |
 *
 * The two digests were never in question and the screen says so itself:
 * *"findings, proposals and cleared runs are conspicuously missing — they
 * belong to the register."* **G93's finding is that the same sentence
 * disqualifies the two Bell rows, and the screen draws them on the bell
 * anyway.**
 *
 * 🟢 **Note what survives, because it is the whole point of the deadlock fix:**
 * every kind that clears `customerNotifiedAt` — the three support-grant kinds —
 * is untouched by G93. The strict rule costs operational convenience on the
 * customer's bell and costs invariant 8's unblocking nothing at all.
 */

/**
 * Whether a grant may be used right now.
 *
 * Renamed from evaluateSupportAccess: it now serves delivery as well as
 * incident work, and carries the two new lapse conditions — idle and
 * engagement end — that make a weeks-long grant safe to hold.
 *
 * Takes `now` because expiry is genuinely a time question; grantAllows() above
 * stays pure and answers the structural half.
 */
export function evaluateTenantAccess(
  grant: TenantAccessGrant | null,
  /**
   * The tenant actually being reached, from the session — never from the grant
   * and never from a request. Compared, not assumed.
   */
  tenantId: TenantId,
  /** The standing authorisation this grant draws against, if the tenant has one. */
  authorisation: SupportAuthorisation | null,
  mode: 'granted_only' | 'granted_with_customer_approval' | 'never',
  now: Timestamp,
  /** Days since lastUsedAt. Null when the grant has never been used. */
  idleDays: number | null,
): { allowed: boolean; reason: string } {
  if (mode === 'never') {
    return { allowed: false, reason: 'Tenant has disabled platform access' }
  }
  if (!grant) return { allowed: false, reason: 'No grant' }
  /**
   * Added 5 Aug. This function took the grant as a parameter and never compared
   * it to anything, so a live grant for tenant A validated a session against
   * tenant B — and the two-person approval, the notification and the expiry all
   * passed, because they were all true of the wrong tenant.
   */
  if (grant.tenantId !== tenantId) {
    return { allowed: false, reason: 'Grant is for a different tenant' }
  }
  if (authorisation !== null && authorisation.tenantId !== tenantId) {
    return { allowed: false, reason: 'Authorisation is for a different tenant' }
  }
  if (grant.revokedAt !== null) return { allowed: false, reason: 'Grant revoked' }
  if (grant.expiresAt <= now) return { allowed: false, reason: 'Grant expired' }
  if (idleDays !== null && idleDays >= grant.idleRevokeDays) {
    return { allowed: false, reason: 'Grant lapsed through inactivity' }
  }
  if (grant.purpose === 'delivery' && grant.engagementRef === null) {
    return { allowed: false, reason: 'Delivery grant without an engagement' }
  }
  if (grant.approvedByStaffUserId === grant.staffUserId) {
    return { allowed: false, reason: 'Self-approved grant is not valid' }
  }

  /**
   * EXTENSIONS ARE NOW WALKED. Nothing read `grant.extensions` — so
   * AccessExtension's own comment, "self-extension is the failure mode this
   * exists for", described a control that did not exist: an engineer could
   * extend their own grant indefinitely by writing rows nobody evaluated, and
   * the audit trail would show every extension neatly recorded and none of them
   * checked.
   */
  let effectiveExpiry = grant.expiresAt
  for (const extension of grant.extensions) {
    if (grant.purpose !== 'delivery') {
      return { allowed: false, reason: 'Only a delivery grant may be extended' }
    }
    if (extension.extendedByStaffUserId === extension.approvedByStaffUserId) {
      return { allowed: false, reason: 'Self-extended grant is not valid' }
    }
    if (extension.customerNotifiedAt === null) {
      return { allowed: false, reason: 'Extension not notified to the customer' }
    }
    if (extension.extendedTo > effectiveExpiry) effectiveExpiry = extension.extendedTo
  }

  /**
   * THE DURATION CEILING IS NOW ENFORCED. MAX_GRANT_HOURS claimed "a grant
   * beyond this is rejected at issue" and had zero call sites; the cumulative
   * extension cap had none either. Measured from grantedAt to the LATEST
   * extension, so a chain of short extensions cannot arrive where a single long
   * grant would have been refused.
   */
  const ceilingHours = maxGrantHours(authorisation, grant.purpose)
  const heldHours = hoursBetween(grant.grantedAt, effectiveExpiry)
  if (!Number.isFinite(heldHours)) {
    return { allowed: false, reason: 'Grant duration is not computable' }
  }
  if (heldHours > ceilingHours) {
    return { allowed: false, reason: 'Grant exceeds the duration ceiling' }
  }

  /**
   * Every class the grant claims must survive the standing authorisation —
   * which is where `statutory`, the contract-only classes and the nominated
   * staff roster are decided. A grant naming a class the contract does not open
   * fails whole, rather than quietly permitting the classes it does open: the
   * grant is the unit someone approved.
   */
  for (const line of grant.resources) {
    const verdict = authorisationPermits(
      authorisation,
      grant.purpose,
      line.resource,
      grant.staffUserId,
    )
    if (!verdict.permitted) {
      return {
        allowed: false,
        reason: `Resource ${line.resource} refused: ${verdict.refusal}`,
      }
    }
  }

  /**
   * This line was a deadlock until §10.1 (5 Aug). It blocks unconditionally on
   * a notice to the security-duty `TenantContact` — "an address with a duty
   * attached; it authorises nothing" — and §8.4, taken minutes earlier, made
   * every content-bearing digest an authorised read. A contact that authorises
   * nothing can never be sent one, the field is never set, and EVERY
   * TenantAccessGrant evaluates false forever, incident and delivery alike.
   *
   * Carved out: §8.4 governs content-bearing digests only. "1CloudHub opened a
   * support grant on your tenant" carries no tenant data and is not a read —
   * which is why `mayNotifyContact()` gates a contact on VERIFICATION, never on
   * capability. The risk was named while deciding and is not closed here:
   * "service communication" is a category someone will widen, and it needs a
   * CLOSED LIST OF NOTICE KINDS rather than a judgement call per call site.
   *
   * ✅ **That list exists as of 8 Aug 2026 — `SERVICE_NOTICE_KINDS` above, with
   * `NOTICE_CARRIES_TENANT_DATA` total over it.** This refusal is no longer a
   * carve-out held open by a comment. ⚠️ **What is still missing is the SENDER:**
   * no operation on any contract sends a notice, so nothing sets the field this
   * line reads. The deadlock is now clearable in principle and not yet cleared
   * in practice — `sendServiceNotice` is the operation that closes it.
   */
  if (grant.customerNotifiedAt === null) {
    return { allowed: false, reason: 'Customer not yet notified' }
  }
  /**
   * Only checked when the tenant has contracted for it. The default posture is
   * `granted_only`, so this does not block by default — which was the point.
   */
  if (mode === 'granted_with_customer_approval' && grant.customerApprovedAt === null) {
    return { allowed: false, reason: 'Customer approval required and not given' }
  }
  return { allowed: true, reason: 'Grant valid' }
}

/* ================================================================== *
 * 2. Partner scope as a ceiling — DELETED 5 Aug 2026
 * ================================================================== */

/**
 * `roleCeilingForScope()` and `effectivePartnerRole()` were here. They are gone,
 * and the replacement is `PARTNER_CAPABILITY_MASK` / `effectivePartnerCapabilities()`
 * in access.ts, which intersects capabilities instead of clamping one enum value
 * to another.
 *
 * They were the last two `RoleKey` consumers whose subject was an ORGANISATION
 * rather than a person, which is reason enough to move them. But two verified
 * defects say REMOVE rather than MIGRATE — neither survives a rewrite, and both
 * were live:
 *
 *   1. IT FAILED OPEN. `if (partnerScope === null) return membershipRole` — the
 *      one branch reached by every non-partner call, returning the unclamped
 *      role. A clamp whose default is "no clamp" is a comment.
 *
 *   2. THE CLAMP DEFEATED A CONTROL IT NEVER MENTIONED. Follow it through:
 *      `roleCeilingForScope('exceptions_operate')` returns `'operator'`;
 *      `mayAdmit()`'s ladder in policy.ts is
 *      `['viewer','operator','approver','tenant_admin']`, excluding
 *      `'partner_admin'` on the stated principle that "a partner may operate on
 *      exceptions but is never the party that decides what to believe"; and
 *      `minimumRoleToAdmit` defaults to exactly `'operator'`. The clamp
 *      GUARANTEES a partner never carries the one string the ladder excludes,
 *      and hands them the one it requires. **A partner clears the
 *      prompt-injection admission gate** — the checkpoint separating reading a
 *      vendor email from obeying one — because the exclusion was written
 *      against a string while the clamp rewrote the string.
 *
 * The general lesson, worth more than the fix: a control expressed as "this
 * value is absent from that list" is defeated by anything that edits the value.
 * A capability mask cannot be defeated that way, because it intersects rather
 * than substitutes. `Membership.partnerScope` still needs deleting (§9.5), and
 * the partner check it stood in for belongs in `decide()`, against the org
 * derived from the identity connection.
 */

/* ================================================================== *
 * 2b. Break-glass preservation
 * ================================================================== */

/**
 * The single exception to `statutory` being unreachable — and it is not a grant
 * (§10.7).
 *
 * THE CASE. A regulator or court may order 1CloudHub, AS PROCESSOR, to preserve
 * data inside a tenant. An abandoned or insolvent tenant has nobody left to
 * place a hold, while the retention sweep keeps running and purging under
 * `AuditActor.system`. Nothing in §8.7 could answer that.
 *
 * THE ARGUMENT AGAINST, WHICH WAS MADE AND OVERRULED, RECORDED RATHER THAN
 * DROPPED — because whoever reads this next is likely to be the person asked to
 * widen it:
 *
 *   - STANDING IS NOT CONFERRED BY AN EMERGENCY. If the obligation runs to the
 *     controller, no procedure of ours transfers it. Urgency changes what is
 *     convenient, not who is entitled.
 *   - A CLASS WITH ONE EXCEPTION ACQUIRES A SECOND. The value of "in neither
 *     list, ever" is entirely in the word *ever*, and this type spends that
 *     word.
 *
 * The counter-argument that carried it: a rule with no exception grows one
 * informally, and an informal exception is unaudited. This one is a row.
 *
 * SCOPE IS PRESERVATION ONLY, and the boundary is the point. Preserving is an
 * act defensible under an order. Answering a data-subject request on the
 * controller's behalf is one where standing genuinely cannot be conferred by an
 * emergency — making both break-glass would concede the premise §8.7 rests on.
 * So `act` is a literal, `handle_subject_request` is unrepresentable here, and
 * widening this requires editing a type rather than passing an argument.
 */
/** @dropped-for-v1 7 Aug 2026 — break glass has no operation and no approver in v1; LegalHold itself stays live. Declared, not built. */
export interface BreakGlassPreservation extends TenantScoped {
  id: string
  /**
   * Literal, so the second act is unrepresentable rather than merely
   * discouraged — the same device as `TenantAccessGrant.visibleToTenant: true`.
   */
  act: 'place_legal_hold'
  /**
   * Literal `false`. PRESERVATION IS NOT ACCESS, and separating them is what
   * makes the emergency defensible: this path suspends the sweep and reads
   * nothing. A break-glass record can never be the authority behind a
   * `DataAccessEvent`.
   */
  grantsRead: false

  /** The order this answers to. Without it this is not break-glass, it is a decision. */
  externalOrderRef: string
  /** Who issued it — the court, the regulator. Named, not "legal". */
  issuingAuthority: string
  /** Free text, and the thing an auditor reads first. */
  justification: string

  invokedByStaffUserId: UserId
  /**
   * A NAMED approver, checked against a roster held outside this record — see
   * `breakGlassPermits()`. Two-person, as everywhere else in this module: an
   * emergency is the worst possible reason to drop the second pair of eyes.
   */
  approvedByStaffUserId: UserId
  invokedAt: Timestamp
  /**
   * Time-boxed, always. An indefinite break-glass is a standing authority
   * acquired without anyone granting one.
   */
  expiresAt: Timestamp

  /** The hold this produced. Null until it is placed — and then it is the point. */
  legalHoldId: LegalHoldId | null
  /**
   * Tenant-visible, recorded — but NOT a precondition, unlike
   * `TenantAccessGrant.customerNotifiedAt`. The case this exists for is the
   * tenant with nobody left to notify, so blocking on delivery would disable it
   * exactly where it is needed. Recorded so the omission is legible.
   */
  tenantNotifiedAt: Timestamp | null

  closedAt: Timestamp | null
  closureNote: string | null
}

/** @dropped-for-v1 7 Aug 2026 — break glass has no operation and no approver in v1; LegalHold itself stays live. Declared, not built. */
export type BreakGlassRefusal =
  | 'tenant_mismatch'
  | 'expired'
  | 'closed'
  | 'self_approved'
  | 'approver_not_on_roster'
  | 'no_external_order'

/**
 * May this break-glass record be acted on right now?
 *
 * Takes the roster as a parameter rather than reading a constant: the named
 * approvers are an operational list that changes with the rota, and a model
 * constant would be stale the first time someone left.
 */
/** @dropped-for-v1 7 Aug 2026 — break glass has no operation and no approver in v1; LegalHold itself stays live. Declared, not built. */
export function breakGlassPermits(
  record: BreakGlassPreservation,
  tenantId: TenantId,
  namedApprovers: readonly UserId[],
  now: Timestamp,
): { permitted: true } | { permitted: false; refusal: BreakGlassRefusal } {
  if (record.tenantId !== tenantId) {
    return { permitted: false, refusal: 'tenant_mismatch' }
  }
  if (record.closedAt !== null) return { permitted: false, refusal: 'closed' }
  if (record.expiresAt <= now) return { permitted: false, refusal: 'expired' }
  if (record.externalOrderRef.length === 0) {
    return { permitted: false, refusal: 'no_external_order' }
  }
  if (record.approvedByStaffUserId === record.invokedByStaffUserId) {
    return { permitted: false, refusal: 'self_approved' }
  }
  if (!namedApprovers.includes(record.approvedByStaffUserId)) {
    return { permitted: false, refusal: 'approver_not_on_roster' }
  }
  return { permitted: true }
}

/* ================================================================== *
 * 3. Erasure that reaches the data
 * ================================================================== */

/**
 * Every place a subject's personal data can come to rest.
 *
 * Written at CREATION time, not discovered by scanning. A scan cannot find a
 * value inside a stored Explanation, and an erasure design that depends on
 * finding it later will quietly miss it.
 *
 * ✅ DELTA 1 VERIFIED APPLIED, 7 Aug 2026, AND NOTHING WAS ADDED HERE.
 * `docs/data-architecture.md` §12 delta 1 and `docs/HANDOFF.md` §4.1 both listed
 * *"`SubjectLocation` gains `blob` and `trace` variants"* as **Outstanding**.
 * Both landed on 5 Aug and two more (`correspondence_message`, `notification`)
 * have landed since; the union was ten variants at that point — an eleventh,
 * `bi_dataset`, landed on 8 Aug under G80a and is described on the variant
 * itself. The two delta tables were stale,
 * not the model, and they are now marked applied. Recorded here rather than only
 * in the tables because an open delta against a closed union invites someone to
 * add a variant that already exists under a second name — which is how a closed
 * union stops being closed.
 *
 * ⚠️ THE WIRE WAS NOT STALE IN THE SAME DIRECTION AND WAS FIXED IN THE SAME
 * PASS. `foundation.openapi.yaml` enumerated NINE of the ten — `notification`
 * was absent, so a subject's name carried out in an approval mail could be
 * registered in the model and rejected at the boundary. An erasure index the API
 * will not accept a write to is an erasure index with a hole in it.
 *
 * ⚠️ `trace` SURVIVES THE V1 TRIM, checked rather than assumed. The trim took
 * observability's PARTNER and PLATFORM-AGGREGATE views (`PartnerHealthView`,
 * `PlatformHealthWindow`, `PlatformTenantInspection`); `TraceRef`,
 * `TelemetryPolicy`, `TelemetryExport` and `SpanAttributePolicy` are all live.
 * So this variant does have a writer in v1 and is NOT annotated `@dropped-for-v1`.
 */
export type SubjectLocation =
  | { kind: 'source_document'; sourceDocumentId: SourceDocumentId }
  | { kind: 'match_group_key'; matchGroupId: MatchGroupId }
  | { kind: 'explanation_observed'; exceptionId: ExceptionId; observedIndex: number }
  | { kind: 'audit_event'; auditEventId: string }
  | { kind: 'observed_label'; labelId: string }
  | { kind: 'score_rationale'; scoreResultId: string }
  /**
   * Object storage. Exported CSVs and page renders were unreachable: purging a
   * SourceDocument row cascades to its own object through storageRef, but an
   * export contains whatever the export contained and no row addressed it.
   */
  | { kind: 'blob'; bucket: string; key: string }
  /**
   * A correspondence body. A vendor reply quoting a passport number is personal
   * data in a blob nobody was indexing.
   */
  | { kind: 'correspondence_message'; messageId: MessageId }
  /**
   * A trace. The correct disposition is usually `out_of_reach`, but the plan
   * needs somewhere to attach that — otherwise erasure silently omits the copy
   * rather than disclosing it.
   */
  | { kind: 'trace'; traceId: string; region: RegionKey }
  /**
   * A notification that carried the value out — a digest, an approval mail, an
   * alert.
   *
   * §8.4 makes the digest a first-class READ carrying content, which means it is
   * also a first-class COPY. Once sent, it is at rest in a mail store we do not
   * own, retained on someone else's schedule and forwarded freely. Without this
   * variant the erasure plan has nowhere to attach it, so a subject's name in a
   * weekly exception digest is unreachable AND undisclosed — the same hole
   * `blob` was added to close, through a channel nobody was indexing.
   *
   * The honest disposition is usually `out_of_reach`. That is the point: an
   * erasure plan that admits what it cannot reach is worth more than one that
   * reports success.
   */
  | {
      kind: 'notification'
      notificationId: string
      /** The mailbox or endpoint it was delivered to, as far as we know it. */
      destination: string
      sentAt: Timestamp
    }
  /**
   * A dataset inside the bought BI tool — Amazon Quick Suite / QuickSight
   * (G80a, 8 Aug 2026). THE ELEVENTH VARIANT.
   *
   * WHY IT HAD TO EXIST. `PRODUCT.md` names PDPA as the primary regime, and
   * G68 puts dashboard rendering in a tool we did not build. A SPICE dataset is
   * therefore a COPY of tenant data sitting outside our own store — no row here
   * addresses it, so before this variant an erasure plan could not reach it and
   * could not disclose that it had not. That is the same hole `blob` and
   * `notification` were added to close, through a third channel nobody was
   * indexing.
   *
   * ⚠️ G82 MAKES IT SHARPER RATHER THAN SOFTER: the BI layer runs in
   * `ap-southeast-2` while the data plane is `ap-southeast-1`, so this copy is
   * also in a DIFFERENT REGION from the data it copies — and SPICE ingestion
   * crosses that boundary on every refresh rather than once. `region` is
   * carried on the variant for exactly that reason: a dataset outside the
   * tenant's residency region is a finding, not a note.
   *
   * `datasetId` and `biAccountId` stay bare strings under R1 — AWS mints them,
   * and branding a foreign namespace claims an authority we do not have.
   */
  | {
      kind: 'bi_dataset'
      /** Quick Suite's own dataset id. Bare under R1. */
      datasetId: string
      /**
       * The Quick Suite account holding it. G70 puts ONE ACCOUNT PER TENANT, so
       * without this the plan names a dataset it cannot address.
       */
      biAccountId: string
      /** Where the copy actually rests. Under G82 this is not the tenant's region. */
      region: RegionKey
      /**
       * SPICE — a materialised copy, erasable, with its own retention — versus
       * direct query, where no copy exists and the honest disposition says so.
       * Two different erasure obligations, separated by one boolean.
       */
      materialised: boolean
      /** A copy refreshed BEFORE an erasure request is still a copy. */
      refreshedAt: Timestamp | null
    }

/**
 * The index that makes erasure executable.
 *
 * `subjectRef` is a PER-TENANT HMAC of the natural identifier. A global key
 * would turn the privacy index itself into a cross-tenant correlation surface —
 * exactly the failure this design exists to prevent.
 */
export interface SubjectIndexEntry extends TenantScoped {
  id: string
  subjectRef: string
  location: SubjectLocation
  dataClass: DataClass
  recordedAt: Timestamp
}

/** Per-tenant keying scheme. The salt never leaves the tenant's region. */
export interface SubjectKeyScheme extends TenantScoped {
  algorithm: 'hmac_sha256'
  /** Reference to the key. No field in this model may hold key material. */
  keyRef: string
  rotatedAt: Timestamp | null
}

/**
 * A statutory or contractual obligation to retain, overriding erasure.
 *
 * AML/CFT recordkeeping commonly imposes a minimum that conflicts with a
 * deletion request. Silently honouring the request would breach the obligation;
 * silently refusing would breach the request. Both must be visible.
 */
/**
 * ⚠️ KEPT IN V1 DELIBERATELY, 7 Aug 2026, against a proposed drop. `purgeVerdict()`
 * below takes `hold: LegalHold | null` and reads `releasedAt`, `until` and
 * `reason` in its FIRST branch. Dropping this type while keeping that function
 * silently rewrites the stated precedence from HOLD > MINIMUM > ERASURE >
 * MAXIMUM to MINIMUM > ERASURE > MAXIMUM. Only the break-glass PATH is dropped
 * — `BreakGlassPreservation`, `BreakGlassRefusal`, `breakGlassPermits` — not
 * the hold itself.
 */
export interface LegalHold extends TenantScoped {
  /** BRANDED 7 Aug, slice 6, with `BreakGlassPreservation.legalHoldId`. */
  id: LegalHoldId
  reason: string
  /** Null = indefinite, which requires periodic review. */
  until: Timestamp | null
  /** Narrow holds are preferred; null means the whole tenant. */
  subjectRef: string | null
  placedBy: UserId
  placedAt: Timestamp
  releasedAt: Timestamp | null
}

export type PurgeVerdict =
  | { decision: 'purge'; reason: string }
  | { decision: 'retain'; reason: string; until: Timestamp | null }

/**
 * Precedence: HOLD > MINIMUM > ERASURE > MAXIMUM.
 *
 * A legal hold beats everything. A regulatory minimum beats an erasure request.
 * An erasure request beats ordinary retention. Ordinary retention expires last.
 */
export function purgeVerdict(input: {
  now: Timestamp
  hold: LegalHold | null
  regulatoryMinimumUntil: Timestamp | null
  erasureRequested: boolean
  retainUntil: Timestamp
}): PurgeVerdict {
  const { now, hold, regulatoryMinimumUntil, erasureRequested, retainUntil } = input

  if (hold && hold.releasedAt === null && (hold.until === null || hold.until > now)) {
    return { decision: 'retain', reason: `Legal hold: ${hold.reason}`, until: hold.until }
  }
  if (regulatoryMinimumUntil !== null && regulatoryMinimumUntil > now) {
    return {
      decision: 'retain',
      reason: 'Regulatory minimum retention not yet elapsed',
      until: regulatoryMinimumUntil,
    }
  }
  if (erasureRequested) {
    return { decision: 'purge', reason: 'Data subject erasure request' }
  }
  if (retainUntil <= now) {
    return { decision: 'purge', reason: 'Retention period elapsed' }
  }
  return { decision: 'retain', reason: 'Within retention period', until: retainUntil }
}

/**
 * What will actually happen for one request.
 *
 * `out_of_reach` is deliberate. An erasure plan that admits what it cannot
 * reach — a value already exported to a customer's own telemetry endpoint, a
 * backup outside the purge window — is worth more than one that silently
 * misses it and reports success.
 */
export interface ErasurePlan extends TenantScoped {
  /**
   * ADDED 7 Aug (G35). `requestId` names THE REQUEST, not the plan, and the two
   * are not one-to-one: `partially_completed` is a terminal state this type
   * admits, so a request that leaves `out_of_reach` items is re-planned, and
   * every plan for it would share the same `requestId`. A regulator asking which
   * plan was executed needs to be able to name one.
   */
  id: ErasurePlanId
  requestId: DataSubjectRequestId
  subjectRef: string
  plannedAt: Timestamp
  items: ErasurePlanItem[]
  status: 'planned' | 'executing' | 'completed' | 'partially_completed'
}

export interface ErasurePlanItem {
  location: SubjectLocation
  disposition: 'purge' | 'retain_under_hold' | 'retain_regulatory' | 'out_of_reach'
  reason: string
  executedAt: Timestamp | null
}

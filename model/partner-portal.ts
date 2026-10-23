/**
 * THE PARTNER PORTAL'S OWN RECORDS — W5, 1 Oct 2026 (G2624–G2640).
 *
 * R10 gave the portal a PRINCIPAL (`PartnerRole` × `PartnerRoleAssignment`, the
 * fifth arm of `decide()`, three partner-only resource classes). This module
 * gives it the THINGS that principal acts on, which `docs/build/completion-plan.md`
 * W5 named as the first of four blockers: *"A table per operation's data."*
 * G300 needs table AND model AND capability AND a record; this is the model.
 *
 * 🛑 NOTHING HERE NAMES A TENANT, AND THAT IS INVARIANT 2 HELD BY A TYPE.
 *    *"`partner_admin(P)` may read tenant `T` iff `T.partnerId = P`, and only
 *    within a live `PartnerAccessGrant`"* is the ONE cross-tenant path, and
 *    every declaration below is a fact about the FIRM — a claim on a company
 *    that may never become a tenant, a request that the platform provision a
 *    plane, an invitation to the portal. A `tenantId` on any of them would be
 *    a second path, written in a field; `_PartnerPortalRecordsNameNoTenant`
 *    makes adding one a compile error.
 *
 * ⚠️ VOCABULARIES ARE CLOSED HERE AND `text` IN THE DATABASE, `0007`/`0069`'s
 *    polarity: an unknown value reaches the reader as an `*_unreadable`
 *    refusal rather than being rejected at write time by a list somebody
 *    forgot to extend.
 */

import type { Money } from './domain'
import { guardMoney, guardUnit, isPositiveMoney } from './money.ts'
import type { AuthorizationGrantId, Id, PartnerId, RoleId, Timestamp, UserId } from './kernel'

/* ------------------------------------------------------------------ *
 * §1 · THE DIRECTORY — who at the firm reaches the portal.
 * ------------------------------------------------------------------ */

export type PartnerInvitationId = Id<'PartnerInvitation'>

/**
 * TWO ROLES ARE INVITABLE, NOT THREE — `PartnerInvitationRequest`'s own enum.
 * *"Partner delivery is refused access by ruling, so offering it here would
 * mint an invitation to nothing."* The key is `PartnerRole.key`, *"stable
 * within the firm"*, so the request names a role the firm's catalogue must
 * already hold.
 */
export const PARTNER_INVITABLE_ROLE_KEYS = {
  partnerAdministrator: 'partner_administrator',
  partnerUser: 'partner_user',
} as const
export type PartnerInvitableRoleKey =
  (typeof PARTNER_INVITABLE_ROLE_KEYS)[keyof typeof PARTNER_INVITABLE_ROLE_KEYS]

/**
 * AN INVITATION, NOT AN ASSIGNMENT. It names an ADDRESS, because the invitee
 * has no `tenant."user"` row until they first sign in at the firm's own door
 * (R5). ✅ **REDEMPTION IS BUILT SINCE 2 Oct 2026 — THE OWNER'S RULING, G2801**
 * (*"Drop `name` from invitePartnerPerson's 201 (filled at redemption). Then
 * mount it and build invitation redemption at first sign-in."*). ⚠️ THIS NOTE
 * READ *"Redemption — the act that turns one into a `PartnerRoleAssignment` —
 * is OWED (G2629); nothing here pretends it has happened"* AND IS CORRECTED
 * RATHER THAN DELETED: `db/migrations/0370` and
 * `server/data-plane/partner-redemption-store.ts` are that act.
 *
 * ⚠️ STILL NO `name`, AND NOW BY RULING RATHER THAN BY GAP. The request carries
 * none and the 201 no longer requires one: it is an `InvitedPartnerPerson`,
 * not a `PartnerPerson`, and the name is *"filled at redemption"* — it is the
 * display name the door's claim map projects onto the person R5 provisions.
 */
export interface PartnerInvitation {
  id: PartnerInvitationId
  partnerId: PartnerId
  email: string
  roleId: RoleId
  /** Pinned: the version whose verbs the inviter was checked against. */
  roleVersion: number
  invitedBy: UserId
  invitedAt: Timestamp
  /**
   * WHEN THE OFFER STOPS STANDING. Never null: *"An open-ended grant is not a
   * grant"*, and an offer of authority to somebody the system does not yet
   * know is the last place to relax it (`Invitation.expiresAt`'s argument).
   */
  expiresAt: Timestamp
  /**
   * WHEN THE ROLE IT CONFERS ENDS — copied VERBATIM onto the assignment at
   * redemption, `Invitation.membershipExpiresAt`'s shape. Not nullable:
   * `DURABLE_ASSIGNMENT_PERMITTED.partner` is `false`.
   */
  assignmentExpiresAt: Timestamp
  /**
   * The `manage_partner_staff` record the offer was made under — G229's
   * `Invitation.grantId`, one table over. A redeemed assignment traces through
   * it to invariant 10's third home.
   */
  authorizationId: AuthorizationGrantId
}

/**
 * THE TWO NUMBERS, AND THEY ARE OURS — G2803, DERIVED AND NOT THE OWNER'S.
 *
 * The request carries no expiry and the contract names none, so a bound must
 * come from somewhere, and G139's posture forbids the alternative: *"a bound
 * with no number is not a bound … never silently unbounded, which is the
 * outcome a default would produce."*
 *
 *   OFFER — 14 days. Long enough to cross a fortnight's leave; short enough
 *           that a forgotten offer to a departed address does not stand.
 *   ROLE  — 90 days from the offer. `MAX_GRANT_HOURS.delivery`'s ceiling, the
 *           one standing reach this model already argues, and short because
 *           the contract records that *"a departed employee's portal role
 *           outlives their employment until somebody edits a row"* and there
 *           is still no revoke.
 *
 * ⚠️ `db/migrations/0370` §1 bounds both with a CHECK, and
 *    `tests/db/partner-invitation-redemption.test.ts` §6 derives the two
 *    intervals from THESE constants and requires the catalogue to agree — a
 *    mirror held by a test, `0008`'s discipline. Changing either is an owner's
 *    call and a migration.
 */
export const PARTNER_INVITATION_OFFER_SECONDS = 14 * 24 * 60 * 60
export const PARTNER_INVITED_ROLE_SECONDS = 90 * 24 * 60 * 60

/**
 * WHERE AN INVITEE STANDS ON THE 201 — `invited`, and nothing else, because
 * the 201 is answered before anybody has signed in. It is not a member of
 * `PARTNER_PERSON_STATES`, which is derived from an ASSIGNMENT: an invitation
 * has none until it is redeemed.
 */
export const PARTNER_INVITATION_STATE = 'invited' as const

/**
 * WHY AN INVITATION WAS NOT REDEEMED — `0370` §4's six trigger refusals plus
 * the unique index's one. CLOSED: the writer maps a database message onto
 * exactly one of these, and a message it does not recognise is a throw.
 */
export const PARTNER_REDEMPTION_REFUSALS = {
  /** Not visible to this sign-in: wrong address, another firm's door, or no row. */
  notRedeemable: 'partner_invitation_not_redeemable',
  /**
   * The redeemer's address is not one their directory PROVED — G2901,
   * closing G2816. An invitation keys on an address, and an address a person
   * merely typed is not evidence they are the person it was sent to. Asked
   * BEFORE the offer's clock, so an unproved address learns nothing about the
   * offer it matched.
   */
  emailUnverified: 'partner_invitation_email_unverified',
  /** The offer's own clock has run out. */
  expired: 'partner_invitation_expired',
  /** The assignment would not copy the invitation verbatim. */
  termsDisagree: 'partner_invitation_terms_disagree',
  /** The redeemer is the inviter. */
  self: 'partner_invitation_self',
  /** The role invited into is archived or re-versioned. */
  roleMoved: 'partner_invitation_role_moved',
  /** The inviter no longer holds, live, every verb the role confers. */
  inviterLacksVerb: 'partner_invitation_inviter_lacks_verb',
  /** SINGLE USE: an assignment already carries this invitation. */
  alreadyRedeemed: 'partner_invitation_already_redeemed',
} as const
export type PartnerRedemptionRefusal =
  (typeof PARTNER_REDEMPTION_REFUSALS)[keyof typeof PARTNER_REDEMPTION_REFUSALS]

/**
 * WHERE A PERSON STANDS ON THE ROSTER, DERIVED FROM THEIR ASSIGNMENT AND NEVER
 * STORED. Exactly `decide()`'s two liveness terms, in `decide()`'s order —
 * revoked before expired — so the roster and the evaluator cannot disagree
 * about who may act.
 *
 * ⚠️ NOT THE PACK'S *"invited / signed in"*. `invited` belongs to an
 * invitation — it is the 201's `state` (`PARTNER_INVITATION_STATE`), and
 * since 2 Oct 2026 (G2904, closing G2808) the roster carries standing offers in
 * a SEPARATE `invitations` array of that shape, never as a person's state
 * (⚠️ this read *"invitations are still not on the served ROSTER (G2808)"*);
 * *"signed in"* is a
 * claim about a login, and a `tenant."user"` row proves only that a row
 * exists. The vocabulary below claims only what an assignment records.
 */
export const PARTNER_PERSON_STATES = {
  active: 'active',
  expired: 'expired',
  revoked: 'revoked',
} as const
export type PartnerPersonState = (typeof PARTNER_PERSON_STATES)[keyof typeof PARTNER_PERSON_STATES]

export function partnerPersonState(
  assignment: { readonly revokedAt: Timestamp | null; readonly expiresAt: Timestamp },
  now: Timestamp,
): PartnerPersonState {
  if (assignment.revokedAt !== null) return PARTNER_PERSON_STATES.revoked
  /* Lexical ISO-8601 UTC comparison, `decide()`'s own. */
  if (assignment.expiresAt <= now) return PARTNER_PERSON_STATES.expired
  return PARTNER_PERSON_STATES.active
}

/* ------------------------------------------------------------------ *
 * §2 · DEALS — the portal's one write the pack counts.
 * ------------------------------------------------------------------ */

export type DealRegistrationId = Id<'DealRegistration'>

export const DEAL_SHAPES = { deal: 'deal', customerClaim: 'customer_claim' } as const
export type DealShape = (typeof DEAL_SHAPES)[keyof typeof DEAL_SHAPES]

/**
 * *"waiting, accepted, dormant or refused."* ⚠️ NO `expired` MEMBER — `User
 * Journeys` P9.5 records that no expiry is specified and that its absence is a
 * live hazard; inventing one here would answer an open question by accident.
 * A submission is `waiting`; only `acceptRegistration` (staff, unmounted) moves
 * it, so every served registration is `waiting` today.
 */
export const DEAL_STANDINGS = {
  waiting: 'waiting',
  accepted: 'accepted',
  dormant: 'dormant',
  refused: 'refused',
} as const
export type DealStanding = (typeof DEAL_STANDINGS)[keyof typeof DEAL_STANDINGS]

/** The fields each shape may carry — `DealRegistrationRequest`'s description, made total. */
export interface DealRegistrationFields {
  readonly shape: DealShape
  readonly company: string
  /**
   * MONEY, WITH ITS CURRENCY — G3561, THE OWNER'S RULING (3 Oct 2026): *"Deal
   * registration carries a currency: amount + currency through the money codec
   * (model/money.ts, G111)."* It was a bare decimal string until then.
   */
  readonly annualValue?: Money
  readonly expectedClose?: string
  readonly contact?: string
  readonly rationale?: string
  readonly resaleScope?: readonly string[]
}

/**
 * A DEAL REGISTRATION, AS RECEIVED.
 *
 * ⚠️ THE MONEY SENTENCE THAT STOOD HERE IS QUOTED RATHER THAN DELETED, because
 * it was true and it is the premise the owner's ruling answered: *"Money:
 * `annualValue` is a decimal STRING with no currency and no exponent on the
 * wire, so it is NOT `Money` and G111's codec has nothing to apply — it is
 * stored verbatim, read by nothing, and never computed on. Named rather than
 * converted: inventing a currency to satisfy the codec would be supplying a
 * denomination nobody declared."* Since G3561 the wire carries `MoneyWire` and
 * `parseMoneyWire()` is the one conversion; the currency is DECLARED by the
 * submitter (the form defaults to SGD and shows it), never supplied here. Rows
 * written before `0470` keep their undenominated string and no currency (G3562).
 */
export interface DealRegistration extends DealRegistrationFields {
  readonly id: DealRegistrationId
  readonly partnerId: PartnerId
  readonly submittedBy: UserId
  /** AUTHORITATIVE AND OURS — *"Precedence is decided on this value."* */
  readonly receivedAt: Timestamp
  /**
   * NAMED `dealStanding` AND NOT `standing`, DELIBERATELY: G74 reserves the
   * bare word for a FINDING's standing, which is derived and never stored, and
   * `tests/model/finding-standing.test.ts` refuses a stored `standing` on any
   * model row. A claim's standing is a different thing — a workflow state staff
   * MOVE (`acceptRegistration`) — and it IS stored. The wire calls it
   * `standing`; the store maps.
   */
  readonly dealStanding: DealStanding
  readonly lastActivityAt: Timestamp | null
}

export const DEAL_SHAPE_REFUSALS = {
  /** A deal with no value or no close date, or a claim with no rationale or no scope. */
  shapeIncomplete: 'deal_shape_incomplete',
  /** A field the chosen shape does not carry — a deal with a rationale, a claim with a close date. */
  fieldOfTheOtherShape: 'deal_field_of_the_other_shape',
  /** A company that normalises to nothing. */
  companyBlank: 'deal_company_blank',
  /**
   * A deal value that is not a positive amount of money — zero, negative, or
   * refused by `guardMoney()`/`guardUnit()` (G3563). A claim worth nothing is
   * not a deal, and a negative one has no meaning a registry could hold.
   */
  valueNotPositive: 'deal_value_not_positive',
} as const
export type DealShapeRefusal = (typeof DEAL_SHAPE_REFUSALS)[keyof typeof DEAL_SHAPE_REFUSALS]

const SHAPE_FIELDS: Readonly<
  Record<DealShape, { readonly required: readonly (keyof DealRegistrationFields)[]; readonly optional: readonly (keyof DealRegistrationFields)[] }>
> = {
  deal: { required: ['annualValue', 'expectedClose'], optional: ['contact'] },
  customer_claim: { required: ['rationale', 'resaleScope'], optional: [] },
}

const SHAPE_SPECIFIC: readonly (keyof DealRegistrationFields)[] = [
  'annualValue',
  'expectedClose',
  'contact',
  'rationale',
  'resaleScope',
]

/**
 * §5.5: *"A single optional-everything shape would admit a deal with no value
 * and a claim with a close date — two states with no meaning."* The wire schema
 * cannot say this (every shape-specific field is optional there), so the model
 * does, totally over `DealShape`: a third shape is a `TS2741` at `SHAPE_FIELDS`.
 */
export function checkDealRegistrationShape(fields: DealRegistrationFields): DealShapeRefusal | null {
  if (normaliseCompany(fields.company) === '') return DEAL_SHAPE_REFUSALS.companyBlank
  const rule = SHAPE_FIELDS[fields.shape]
  for (const key of SHAPE_SPECIFIC) {
    const present = fields[key] !== undefined
    if (present && !rule.required.includes(key) && !rule.optional.includes(key)) {
      return DEAL_SHAPE_REFUSALS.fieldOfTheOtherShape
    }
  }
  for (const key of rule.required) {
    const v = fields[key]
    if (v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)) {
      return DEAL_SHAPE_REFUSALS.shapeIncomplete
    }
  }
  const value = fields.annualValue
  if (value !== undefined && (guardUnit(value) !== null || guardMoney(value) !== null || !isPositiveMoney(value))) {
    return DEAL_SHAPE_REFUSALS.valueNotPositive
  }
  return null
}

/**
 * THE KEY PRECEDENCE IS DECIDED ON — *"compared after normalisation"*. ASCII
 * case and surrounding / repeated whitespace only, and stated once: the
 * database's `company_key` column is GENERATED from the same rule (`0322`),
 * and `tests/db/partner-deals.test.ts` §3b asserts the two agree.
 */
export function normaliseCompany(company: string): string {
  /* ASCII-only, to match `0322`'s generated column — G2636: `toLowerCase()`
   * folds `Ü` and a `C`-collated `lower()` does not, and JavaScript's `\s`
   * matches a no-break space while the database's does not. Both sides name
   * the six ASCII whitespace characters instead. */
  return company
    .replace(/[ \t\n\r\f\v]+/g, ' ')
    .replace(/^ | $/g, '')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
}

/* ------------------------------------------------------------------ *
 * §3 · THE SANDBOX — lifecycle only, never a read INTO the tenant.
 * ------------------------------------------------------------------ */

export type SandboxRequestId = Id<'SandboxRequest'>

/**
 * A REQUEST THAT THE PLATFORM PROVISION A PLANE THE PARTNER WILL OWN. 202,
 * *"because nothing exists when this returns"*; one per firm. Provisioning is
 * `provision_substrate`'s, a platform verb, and is not modelled here.
 */
export interface SandboxRequest {
  readonly id: SandboxRequestId
  readonly partnerId: PartnerId
  readonly requestedBy: UserId
  readonly requestedAt: Timestamp
}

/**
 * THE SANDBOX'S STANDING, AS THE PORTAL MAY SEE IT. *"Absence is an answer,
 * not a 404."* A provisioned sandbox is a row that only the platform writes
 * (owed); with no row and no open request the answer is `none`.
 *
 * ⚠️ THIS SAID *"its absence is `none`, including while a request is open — a
 * requested plane is not a live one"* UNTIL 4 Oct 2026 AND IS CORRECTED RATHER
 * THAN DELETED (G3701). NP-01, THE OWNER'S RULING: *"Report 'requested':
 * getSandboxTenant gains a 'requested' state (contract change) and the portal
 * shows the pending request."* A firm that had asked was told on reload that
 * it had no sandbox and offered *Ask for one* again, whose only answer was the
 * 409. **A requested plane is still not a live one** — `requested` is its own
 * arm, read off `tenant.partner_sandbox_request`, and is never stored in
 * `tenant.partner_sandbox.standing`.
 */
export const SANDBOX_STANDINGS = { live: 'live', requested: 'requested', none: 'none' } as const
export type SandboxStanding = (typeof SANDBOX_STANDINGS)[keyof typeof SANDBOX_STANDINGS]

export interface PartnerSandbox {
  readonly partnerId: PartnerId
  /** `sandboxStanding`, not `standing` — see `DealRegistration.dealStanding` (G74). */
  readonly sandboxStanding: SandboxStanding
  readonly seedVersion: string | null
  readonly nextResetAt: Timestamp | null
  /** The PARTNER's own AWS account (G276) — theirs, not ours. */
  readonly awsAccountId: string | null
  readonly residency: string | null
}

/* ------------------------------------------------------------------ *
 * §4 · TRIAL TENANT REQUESTS — attribution through an ACCEPTED registration.
 * ------------------------------------------------------------------ */

export type TrialTenantRequestId = Id<'TrialTenantRequest'>

/**
 * *"Attribution runs through an accepted registration"*, so the request names
 * one rather than naming a company again. The trial tenant it asks for does
 * not exist and the partner will never sign into it — there is no field here
 * that could name it.
 */
export interface TrialTenantRequest {
  readonly id: TrialTenantRequestId
  readonly partnerId: PartnerId
  readonly registrationId: DealRegistrationId
  readonly note: string | null
  readonly requestedBy: UserId
  readonly requestedAt: Timestamp
}

/* ------------------------------------------------------------------ *
 * §5 · INVARIANT 2, AS A TYPE.
 * ------------------------------------------------------------------ */

type NamesNoTenant<T> = 'tenantId' extends keyof T ? false : true
type AllTrue<T extends readonly boolean[]> = T[number] extends true ? true : false
type AssertTrue<T extends true> = T

export type _PartnerPortalRecordsNameNoTenant = AssertTrue<
  AllTrue<
    [
      NamesNoTenant<PartnerInvitation>,
      NamesNoTenant<DealRegistration>,
      NamesNoTenant<SandboxRequest>,
      NamesNoTenant<PartnerSandbox>,
      NamesNoTenant<TrialTenantRequest>,
    ]
  >
>

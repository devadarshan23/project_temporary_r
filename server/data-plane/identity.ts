/**
 * THE IDENTITY SUBSTRATE, READ — G299, 19 Sep 2026.
 *
 * ⚠️ THIS FILE IS NEW AND IT IS THE PRODUCER THREE RULINGS HAVE BEEN WAITING
 * ON. `server/data-plane/authorise.ts` names five terms and the table each one
 * would come from; `model/access.ts` §7 declares `resolveSubject()` and
 * `server/data-plane/session.ts` records that it *"IS NOT CALLED HERE AND IT
 * CANNOT BE"*; G289's platform arm is built and refuses
 * `platform_assignment_unreadable` to everybody. **All three sentences were
 * true because `db/migrations/0009_identity_substrate.sql` did not exist.** It
 * exists. This module is what reads it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS FILE IS NOT, STATED FIRST BECAUSE IT IS THE THING A READER WILL
 *    GET WRONG: IT DECIDES NOTHING.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * There is no liveness test in this file. No `revoked_at IS NULL`, no
 * `expires_at > now()`, no `status = 'active'` — not in a `WHERE`, not in a
 * policy, not in a branch. **Every one of those questions belongs to
 * `resolveSubject()` and to `decide()`, which answer them BY NAME**, and a
 * reader that answered any of them first would hand the evaluator a list in
 * which the interesting cases had already been filtered out. The refusal
 * reasons would then be unreachable, and an unreachable refusal is a control
 * that cannot be witnessed — `docs/HANDOFF.md` §5.6.
 *
 * That is not an abstract preference. It is the defect this commit deletes:
 * `server/data-plane/session.ts` enforced *"TWO of those seven arms … in the
 * `WHERE` clause of the one read"* and **four not at all**, so a DISABLED
 * PERSON and a DISABLED DIRECTORY both reached this plane. The repair is not a
 * longer `WHERE`. It is no `WHERE` at all, and the model deciding.
 *
 * ┌─ WHAT THIS FILE DOES ──────────────────────────────────────────────────────┐
 * │  · turns rows into the three model records `resolveSubject()` takes;        │
 * │  · turns rows into the `HeldAssignment[]` and `HeldPlatformAssignment[]`    │
 * │    that `decide()` takes;                                                   │
 * │  · REFUSES, by name, when a row cannot be turned into one.                  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `orgClass` IS THE TERM THIS FILE EXISTS TO GET RIGHT, AND THE ONE MOST
 *    EASILY FAKED. IT IS RESOLVED IN EXACTLY ONE WAY.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `orgFor(connection.owner)` — an `IdentityConnection`, never a membership,
 * never the route a request arrived on, never a column on a user. G299 and
 * G289 both write the prohibition in capitals and G289 prices the shortcut:
 *
 *     "Defaulting it to `customer` routes a partner down the customer arm PAST
 *      the live-grant check, the `partnerId` check, revocation, expiry and
 *      `PARTNER_CAPABILITY_MASK` — five controls deleted by one assignment."
 *
 * So `identityConnectionFrom()` below assembles `owner` as a DISCRIMINATED
 * UNION out of three columns, and **returns `null` rather than a default when
 * the three do not agree**: `owner_kind = 'partner'` with a NULL
 * `owner_partner_id` is a row that names no partner, and a connection that
 * names no organisation cannot authenticate anybody. The refusal is
 * `owner_unresolvable` and it is a 401. There is no value of these columns —
 * including their absence — that produces an organisation nobody wrote down.
 *
 * ⚠️ AND `orgFor()` IS CALLED BY `resolveSubject()`, NOT BY THIS FILE. That is
 * deliberate: §2 of `model/access.ts` makes the derivation total over a
 * `Record<ConnectionOwnerKind, OrgClass>` so that a fourth owner arm is a
 * COMPILE ERROR rather than a silent default, and a second call site here
 * would be a second place for that to be got wrong — §5.3, where the copy is
 * always what drifts. This file's job ends at producing the `owner`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE BROKER HANDLE — G304/G305, 19 Sep 2026, over
 *    `db/migrations/0011_federated_connection.sql`. READ THIS WITH THE
 *    `orgClass` BLOCK ABOVE, BECAUSE THE TWO ARE EASY TO CONFLATE AND MUST NOT
 *    BE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `tenant.identity_connection` now carries `(broker_issuer, broker_ref)` — the
 * pair that names this door INSIDE THE BROKER. `docs/build/deploy-handoff.md`
 * §5a called its absence *"the one blocker with a named cause"*; 0011 is the
 * column and `federationFrom()` below is the reader.
 *
 * ┌─ WHAT A BROKER HANDLE IS, AND WHAT IT IS NOT ─────────────────────────────┐
 * │  IS      · the name the broker knows this directory by, namespaced by the │
 * │            broker's own issuer, because a Cognito provider name is unique │
 * │            within ONE POOL and nowhere else (G304).                       │
 * │  IS NOT  · a source of `orgClass`. Never. The org axis derives from       │
 * │            `owner` and from nothing else. A partner and a customer can    │
 * │            sit behind the SAME broker; they are two rows, two owners, two │
 * │            organisations, and the handle distinguishes neither.           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE PAIRING IS A REFUSAL AND NOT A TOLERANCE. G305 makes it both
 * directions — a handle is present EXACTLY WHEN `PROTOCOL_IS_BROKERED
 * [protocol]` — and a row that disagrees is `broker_unresolvable`, refused
 * rather than read leniently. A `saml` or `oidc` row with no handle is a door
 * the broker cannot name, so no token it issues could ever resolve to it:
 * admitting such a row would authenticate somebody through a door that, by
 * construction, did not authenticate them.
 *
 * ⚠️ WHAT THIS FILE STILL DOES NOT DO, STATED SO THE COLUMN IS NOT MISTAKEN
 * FOR THE FEATURE. **There is no resolver from a broker handle to a
 * connection, and there is no token verification.** The handle is read on the
 * SESSION path, where the session already names its connection; the reverse
 * lookup belongs to federated sign-in, which has no scope to run in — at
 * sign-in time there is no session, so `app.session_ref` is unset and
 * `identity_connection_rls` denies every row under G100. That lookup arrives
 * with the policy it needs, in the commit that needs it. Reproduce the
 * absence: `grep -rn 'broker_ref' server/ | grep -v 'identity.ts'` → nothing.
 *
 * ✅ **THE FIRST HALF WENT FALSE ON 19 Sep 2026 AND IS CORRECTED RATHER THAN
 * DELETED. THERE IS A RESOLVER — `readConnectionByBrokerHandle()`, §4a below —
 * AND ITS ARRIVAL IS EXACTLY WHAT THE PARAGRAPH ABOVE PREDICTED.** *"That
 * lookup arrives with the policy it needs, in the commit that needs it"*: the
 * policy is `identity_connection_signin_rls`
 * (`db/migrations/0013_federated_signin.sql`, G340 applied and G343 taken) and
 * the scope is `withSignInScope()`, `db/signin-scope.ts` — the FOURTH named
 * scoped helper, which argues itself against `db/selection-scope.ts`'s bar on
 * its own face. The deadlock this paragraph describes is not narrated away
 * either: `tests/db/federated-signin.test.ts` §1 runs it and REQUIRES the
 * empty result, so it stays observable after the repair.
 *
 * 🛑 **THE SECOND HALF IS UNCHANGED AND IS NOW THE WHOLE OF THE GAP: THERE IS
 * STILL NO TOKEN VERIFICATION**, so nothing produces the issuer and reference
 * the new resolver is given. `grep -rn 'jwtVerify\|createRemoteJWKSet' server/`
 * returns nothing — G306's own derivation — and `server/data-plane/signin.ts`
 * states at length what that costs: a callback can prove which door it came
 * through and cannot yet say who came through it.
 *
 * ⚠️ AND THE `grep` ANCHOR ABOVE STILL RETURNS NOTHING, WHICH IS WHY IT IS THE
 * WRONG CONTROL FOR THIS SENTENCE AND IS LEFT STANDING AS THE HISTORY IT IS:
 * the resolver is in THIS file, which that command excludes. A control keyed on
 * a convenient landmark rather than on the property it protects — §5.1, in the
 * file that teaches it. Derive the resolver instead:
 * `grep -rn 'readConnectionByBrokerHandle' server/`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHICH SCOPE EACH READ RUNS IN, AND WHY IT IS TWO TRANSACTIONS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   SESSION scope   `tenant.session`, `tenant."user"`,
 *   (app.session_ref) `tenant.identity_connection`, and the platform pair.
 *                   They are read BEFORE a tenant is known — `Session.tenantId`
 *                   is NULL between authentication and selection — so there is
 *                   no `app.tenant_id` to read them under.
 *
 *   TENANT scope    `tenant.role`, `tenant.role_capability`,
 *   (app.tenant_id)   `tenant.role_assignment`. All three `extends
 *                   TenantScoped`; 0001's predicate applies verbatim.
 *
 * ⚠️ THE COST IS TWO ROUND TRIPS PER GATED REQUEST AND IT IS STATED RATHER
 * THAN HIDDEN, because the alternative is worse in a way that is hard to
 * reverse. The one-transaction version needs `app.tenant_id` set from the raw
 * session column BEFORE liveness has been checked — which
 * `docs/build/stateless-adjudication.md` refused as RULED 2, because *"the
 * tenant scope opens for revoked sessions, expired sessions and fired
 * employees, and is only then refused."* Two transactions is the price of the
 * order being right.
 *
 * ⚠️ AND THERE IS NO CACHE. A decision is taken against rows read on THIS
 * request. A revoked assignment stops working on the next request rather than
 * at the end of a TTL, which is the property `PrincipalContext.now` exists for
 * — *"a decision has to be reproducible in an audit"* — applied to the rows
 * rather than to the clock.
 *
 * Compiles under: tsc -p server/tsconfig.json --noEmit
 */

import {
  CAPABILITIES,
  DENY_ALL,
  PARTNER_ACCESS_SCOPES,
  type Capability,
  type HeldStaffGrant,
  type HeldAssignment,
  type HeldPartnerAssignment,
  type HeldPlatformAssignment,
  type PartnerAccessScopeKey,
  type PartnerRole,
  type PartnerRoleAssignment,
  type PartnerGrantTerms,
  type PlatformRole,
  type PlatformRoleAssignment,
  type Role,
  type RoleAssignment,
} from '../../model/access.ts'
/**
 * ⚠️ TWO VALUE IMPORTS FROM `model/governance.ts`, AND BOTH ARE READ AS KEY
 * SETS RATHER THAN COPIED — G729. `MAX_GRANT_HOURS` is a
 * `Record<AccessPurpose, number>`, so its keys ARE that union and a third
 * purpose needs no edit here; `ACCESS_RESOURCE_CLASSES` is the thirteen-member
 * const object. A hand-written list of either would be `0002_run.sql`'s
 * *"third place to drift — and the one nothing checks."*
 */
import { ACCESS_RESOURCE_CLASSES, MAX_GRANT_HOURS } from '../../model/governance.ts'
import type { AccessPurpose, AccessResourceClass } from '../../model/governance.ts'
import { IDENTITY_PROTOCOLS, PROTOCOL_IS_BROKERED } from '../../model/domain.ts'
import type {
  BrokeredConnection,
  IdentityConnection,
  IdentityProtocol,
  Membership,
  User,
} from '../../model/domain.ts'
import type { ScopedClient } from '../../db/tenant-scope.ts'

/* ------------------------------------------------------------------ *
 * 1. Refusals — a closed set, and a DIFFERENT one from `SessionRefusal`
 * ------------------------------------------------------------------ */

/**
 * WHY THESE ARE NOT MEMBERS OF `SESSION_REFUSALS`, WHICH IS THE OBVIOUS PLACE
 * TO PUT THEM AND THE WRONG ONE.
 *
 * `SessionRefusal` is a closed set of facts about a PERSON and their SESSION —
 * this door is not that door, this account is switched off, this session has
 * expired. Every member is answerable by somebody. **The four below are facts
 * about OUR SUBSTRATE**: a session row naming a user row that is not there is
 * not a statement about the user, it is a statement about us.
 *
 * `decide()` already draws exactly this line and gives the reason in its own
 * voice, between `platform_assignment_unreadable` and
 * `platform_assignment_absent`: *"**This is NOT 'they hold none'**, and the two
 * must never be reported as one: one is a fact about a person and the other is
 * a fact about our substrate."* Folding these into `SessionRefusal` would put
 * an operator's problem into a vocabulary an auditor reads as a person's.
 *
 * ⚠️ THEY ALL BECOME THE SAME 401 ON THE WIRE, AND THAT IS `PlaneOptions
 * .authenticate`'s rule rather than a loss here: *"so that 'no session' and 'an
 * error while checking the session' cannot take different paths. Both are
 * `null`; both are 401."* The distinction is for the operator's log, which is
 * the one reader entitled to it.
 */
export const SUBSTRATE_REFUSALS = {
  /** The session names a user id with no row. Not a disabled person — an absent one. */
  userAbsent: 'user_absent',
  /** The session names a connection id with no row. The door is not merely shut; it is missing. */
  connectionAbsent: 'connection_absent',
  /**
   * 🛑 THE ORG TERM COULD NOT BE ASSEMBLED. `owner_kind` disagrees with the two
   * id columns, or names an arm this build does not know. **G299: "If it cannot
   * be resolved, refuse; do not default."**
   */
  ownerUnresolvable: 'owner_unresolvable',
  /**
   * 🛑 THE BROKER HANDLE COULD NOT BE ASSEMBLED — G304/G305, 19 Sep 2026.
   *
   * The row disagrees with its own `protocol` about whether this door is
   * reached through a broker: a `saml` or `oidc` connection naming no broker,
   * a `cognito_pool` connection naming one, or half a handle — an issuer with
   * no reference, or a reference with no issuer.
   *
   * ⚠️ IT IS `ownerUnresolvable`'s SIBLING AND IS DELIBERATELY MODELLED ON IT,
   * INCLUDING THE DECISION TO BE **ONE** MEMBER COVERING SEVERAL
   * MALFORMATIONS. `owner_unresolvable` already covers three — an unknown
   * kind, a partner with no partner id, a customer with no account id — on the
   * ground that every one of them is the same fact: *a row somebody wrote
   * wrong, which this build cannot turn into a record.* Splitting this one
   * would say the reverse about a fact of identical shape.
   *
   * 🛑 AND REFUSING IS THE ONLY ANSWER HERE FOR A REASON THAT IS NOT
   * `owner_unresolvable`'s. A missing owner leaves the ORGANISATION unknown; a
   * missing broker handle leaves the DOOR unaddressable — no token the broker
   * ever issues can name this row — so admitting it would authenticate
   * somebody on a connection that, by construction, could not have
   * authenticated them.
   */
  brokerUnresolvable: 'broker_unresolvable',
  /**
   * A closed-set column carries a value the model does not declare — a status,
   * a protocol. Refused rather than coerced, because the alternative to
   * refusing an unrecognised status is guessing one, and the convenient guess
   * is always `active`.
   */
  valueUnrecognised: 'value_unrecognised',
  /**
   * 🛑 MORE THAN ONE PARTNER GRANT IN ONE TENANT — G576, 19 Sep 2026.
   *
   * `PrincipalContext.partnerGrant` is SINGULAR by declaration, and
   * `db/migrations/0039_partner_access_grant.sql` makes it singular in the
   * database with `partner_access_grant_one_per_tenant`. **So this member is
   * STRUCTURALLY UNREACHABLE while that constraint stands, and it exists
   * precisely for the commit that drops it.**
   *
   * ⚠️ IT IS NOT DEAD CODE AND IT IS NOT DEFENSIVE PADDING — IT IS THE ONLY
   * ALTERNATIVE TO THIS FILE DECIDING SOMETHING. The three candidate answers to
   * *"which of several grants"* are enumerated on that constraint; two of them
   * are a reader choosing, and *"IT DECIDES NOTHING"* is the first sentence of
   * this module. Refusing is the third, and it is the one that stays true after
   * somebody widens the schema without reading this file. `tests/db/
   * partner-access-grant.test.ts` §5 drops the constraint and witnesses it.
   *
   * 🛑 AND IT IS A FACT ABOUT OUR SUBSTRATE, WHICH IS WHY IT IS HERE AND NOT A
   * `DecisionReason`. A tenant carrying two grants is a row somebody wrote
   * wrong; reporting it as `partner_grant_absent` would tell an auditor the
   * partner holds nothing, which is the opposite of what is true.
   */
  partnerGrantNotUnique: 'partner_grant_not_unique',
  /**
   * 🛑 TWO LIVE-LOOKING `TenantAccessGrant` ROWS FOR ONE STAFF PERSON IN ONE
   * TENANT — G729, 19 Sep 2026, AND IT IS `partnerGrantNotUnique`'s ARGUMENT
   * WITH A WEAKER CONSTRAINT BEHIND IT.
   *
   * `db/migrations/0039` has `UNIQUE (tenant_id)` on the partner grant, so that
   * refusal is reachable only by dropping a constraint. **`0008` has no such
   * uniqueness on `(tenant_id, staff_user_id)` and was never meant to** — its
   * primary key is `(tenant_id, id)`, and two purposes (`incident` and
   * `delivery`) with two different ceilings are a legitimate pair of rows for
   * one FDE. So this arm is reachable from ordinary data.
   *
   * ⚠️ AND REFUSING IS THE ONLY HONEST ANSWER, BECAUSE THE MODEL TAKES ONE
   * GRANT BY RULING. `TenantSelectionInput.staffGrant` is singular *"for
   * `hostBoundTenantId`'s REASON and not a weaker one … a menu of grants is
   * the selector G210 dropped wearing staff clothing — the caller would be
   * choosing which authority to present, and the choice would be made outside
   * anything that checks it."* **A reader that picked the longest, the newest
   * or the first would BE that choice**, made by us instead of by the caller,
   * which is worse rather than better. The commit that wants two grants to
   * coexist owes a ruling on which one a selection spends, and it is not this
   * one's to take.
   */
  staffGrantNotUnique: 'staff_grant_not_unique',
} as const

export type SubstrateRefusal =
  (typeof SUBSTRATE_REFUSALS)[keyof typeof SUBSTRATE_REFUSALS]

/* ------------------------------------------------------------------ *
 * 2. Narrowing a column to a closed set — total, and compile-checked
 * ------------------------------------------------------------------ */

type AssertTrue<T extends true> = T

/**
 * ⚠️ THESE TWO ASSERTIONS ARE THE REASON THE GUARDS BELOW ARE NOT A COPY OF AN
 * ENUM. `User['status']` and `Role['status']` are inline two-member unions on
 * their declarations — there is no exported `const` to iterate, so a runtime
 * guard has to name the members. What stops that becoming `0002_run.sql`'s
 * *"third place to drift"* is that each assertion is MUTUAL: the declared union
 * must extend the guard's set AND the guard's set must extend the declared
 * union. A third member added to either declaration is a compile error HERE,
 * at this line, rather than a value this file silently refuses at runtime.
 */
export type _UserStatusIsExactlyTwoValued = AssertTrue<
  User['status'] extends 'active' | 'disabled'
    ? 'active' | 'disabled' extends User['status']
      ? true
      : false
    : false
>
export type _RoleStatusIsExactlyTwoValued = AssertTrue<
  Role['status'] extends 'active' | 'archived'
    ? 'active' | 'archived' extends Role['status']
      ? true
      : false
    : false
>

function personStatus(value: unknown): User['status'] | null {
  return value === 'active' || value === 'disabled' ? value : null
}

function doorStatus(value: unknown): IdentityConnection['status'] | null {
  return value === 'active' || value === 'disabled' ? value : null
}

/**
 * ⚠️ THIS ONE IS NOT A HAND-WRITTEN MEMBER LIST AND DOES NOT NEED A MUTUAL
 * ASSERTION, WHICH IS THE DIFFERENCE BETWEEN A CLOSED SET THAT EXPORTS A
 * `const` AND ONE THAT DOES NOT. `IDENTITY_PROTOCOLS` is an exported const
 * object, so the members are READ from the declaration rather than copied
 * beside it, and a fourth protocol is admitted here the instant it is
 * declared — with no edit, and therefore with nothing to forget. The two
 * assertions above exist only because `User['status']` and `Role['status']`
 * are inline unions with no `const` to iterate.
 *
 * Same shape as `asCapability()` below, for the same reason.
 */
function connectionProtocol(value: unknown): IdentityProtocol | null {
  const members = Object.values(IDENTITY_PROTOCOLS) as readonly IdentityProtocol[]
  return members.find((m) => m === value) ?? null
}

function roleStatus(value: unknown): Role['status'] | null {
  return value === 'active' || value === 'archived' ? value : null
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

function isoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value)
}

/* ------------------------------------------------------------------ *
 * 3. Rows → the three records `resolveSubject()` takes
 * ------------------------------------------------------------------ */

/**
 * ⚠️ ONE CAST PER RECORD, AT ONE SEAM, AND IT IS A CAST OF SHAPE RATHER THAN
 * OF MEANING — `session.ts`'s `rowToSession()` states the argument and this
 * file follows it rather than restating it. Every branded id is `text` under
 * G97 and is stored VERBATIM, so there is nothing to parse and nothing that
 * could be wrong except the column NAMES, which are pinned by the statements
 * below.
 *
 * 🛑 WHAT IS **NOT** CAST IS EVERY FIELD SOMETHING BRANCHES ON. `status` is
 * classified by a guard that refuses; `owner` is assembled and refuses; a
 * capability that is not a member of the closed set is DROPPED. The line is:
 * an id is data, a discriminant is a decision.
 */
export const USER_READ = `
  SELECT id, status, connection_id
    FROM tenant."user"
`

/**
 * ⚠️ `email` AND `display_name` ARE COLUMNS AND ARE NOT SELECTED, WHICH IS
 * `PrincipalContext`'s NARROWING HELD ONE LAYER DOWN. That declaration is
 * *"structurally narrowed to `{ userId, status }` … so that no evaluation can
 * reach an email, a display name, or the `identityProvider` field the org axis
 * is derived from."* A `SELECT *` here would put both in a row object that
 * every later frame can see, and the narrowing would survive only as a comment.
 *
 * 🛑 THE CONSEQUENCE IS THAT THIS IS NOT A `User`, AND THE TYPE SAYS SO. It is
 * the subset `resolveSubject()` reads, and it is handed in as a `User` through
 * one cast whose two absent fields are never touched — `resolveSubject()` reads
 * `user.id` and `user.status` and nothing else. **If a later arm reads
 * `user.email`, this read has to grow in the same commit as that arm**, and the
 * classification question comes with it.
 */
function personFrom(row: Record<string, unknown>): User | SubstrateRefusal {
  const status = personStatus(row['status'])
  if (status === null) return SUBSTRATE_REFUSALS.valueUnrecognised
  return {
    id: String(row['id']),
    status,
    connectionId: String(row['connection_id']),
  } as unknown as User
}

/**
 * ⚠️ `protocol` JOINED THIS LIST ON 19 Sep 2026 AND IT IS THE FIRST COLUMN
 * HERE THAT IS SELECTED IN ORDER TO BE BRANCHED ON RATHER THAN CARRIED.
 * `broker_issuer` and `broker_ref` mean nothing without it: G305 makes the
 * pairing rule *"non-null exactly when `PROTOCOL_IS_BROKERED[protocol]`"*, so
 * a reader holding the two handle columns and not the protocol could check
 * that they agree with each other and could not check the thing that matters.
 *
 * 🛑 `label` IS STILL NOT SELECTED, AND THE REASON IS SHARPER NOW THAN WHEN
 * 0009 STATED IT. G232 rules the label operator-written *precisely because* a
 * customer-authored one would be counterparty text on a staff console, and
 * invariant 6 has never been ruled for that class. Adding two columns to this
 * statement is not licence to add a third.
 */
export const CONNECTION_READ = `
  SELECT id, status, protocol, owner_kind, owner_partner_id, owner_account_id,
         broker_issuer, broker_ref
    FROM tenant.identity_connection
`

/**
 * 🛑 THE BROKER HANDLE, ASSEMBLED OR REFUSED — G304/G305. The second place in
 * this file where a row is turned into a discriminated answer and there is NO
 * DEFAULT ARM, and it is the second for the same reason.
 *
 * ┌─ THE RULE, WHICH IS ONE SENTENCE AND IS BOTH DIRECTIONS ──────────────────┐
 * │  A handle is present EXACTLY WHEN `PROTOCOL_IS_BROKERED[protocol]`.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE SECOND DIRECTION IS THE ONE A REVIEWER WILL WANT TO DROP, SO IT IS
 * ARGUED RATHER THAN ASSERTED. Refusing a `cognito_pool` row that carries a
 * handle looks like pedantry — the handle is simply unused, what harm? The
 * harm is that `cognito_pool` is *"the managed fallback pool — PER ACCOUNT,
 * never shared"*, i.e. the connection that IS the pool. A handle on it claims
 * the pool fronts itself, which is not a relationship that exists; a row
 * asserting it was written by something that does not understand this schema,
 * and **the next thing that reads `broker_ref` — the resolver federated
 * sign-in will bring — would find a pool row answering to a provider name.**
 * One row of that kind is one org-class collision.
 *
 * ⚠️ AND A NON-BROKERED ROW IS NOT THE SAME AS A REFUSED ONE. `null` here is
 * an ANSWER: this door is not brokered, it is coherent, and it resolves. The
 * `[]`-versus-`null` distinction `authorise.ts` draws — *"an empty array means
 * a reader ran and found no assignments; `null` means there is no reader at
 * all"* — is the same distinction, and this function never returns a `null`
 * meaning "I did not look".
 *
 * ⚠️ THE EMPTY STRING IS A REFUSAL, NOT AN ABSENCE, AND THAT IS `nullif(…, '')`
 * IN 0005's POLICIES WEARING A DIFFERENT HAT. A column holding `''` is a
 * column something wrote and got wrong; treating it as "no handle" would let a
 * brokered row pass as unbrokered, which is the accidental-denial shape in
 * reverse — an accidental ADMISSION.
 */
function federationFrom(
  protocol: IdentityProtocol,
  row: Record<string, unknown>,
): BrokeredConnection | null | SubstrateRefusal {
  const issuer = row['broker_issuer']
  const ref = row['broker_ref']
  const hasIssuer = typeof issuer === 'string' && issuer !== ''
  const hasRef = typeof ref === 'string' && ref !== ''

  if (!PROTOCOL_IS_BROKERED[protocol]) {
    /* A pool does not front itself. ANY value in either column is a refusal —
     * including `''`, which is a value somebody wrote, not an absence. */
    const issuerAbsent = issuer === null || issuer === undefined
    const refAbsent = ref === null || ref === undefined
    return issuerAbsent && refAbsent ? null : SUBSTRATE_REFUSALS.brokerUnresolvable
  }

  /* Brokered: both, or the door is unaddressable. Half a handle is not a
   * lenient case — it is the case in which somebody believed they had
   * configured a broker and had not. */
  if (!hasIssuer || !hasRef) return SUBSTRATE_REFUSALS.brokerUnresolvable
  return { brokerIssuer: issuer, brokerRef: ref }
}

/**
 * 🛑 THE ONE PLACE THE ORGANISATION IS ASSEMBLED, AND THE ONE PLACE IT CAN BE
 * REFUSED. Read the header before changing a line of this function.
 *
 * Three columns, one discriminated union, and **no default arm**. A `switch`
 * with a `default` returning `customer` is one line, it compiles, every test
 * that does not specifically test a partner keeps passing, and it deletes five
 * controls — G289 priced it and the price is quoted at the top of this file.
 *
 * ⚠️ THE PAIRING IS CHECKED IN BOTH DIRECTIONS FOR `partner`, AND ONLY ONE
 * DIRECTION FOR `customer`, WHICH IS NOT AN OVERSIGHT. `partnerId` flows into
 * `PrincipalContext.partnerId` and `decide()` compares it against the grant's
 * `partnerId` at `partner_grant_other_partner` — §9.5's check — so a missing
 * one is an authorisation term missing, not a cosmetic gap. `accountId` is read
 * by nothing on this path; it is carried because the union declares it, and a
 * missing one is still a refusal because a `customer` arm that cannot name its
 * account is a row somebody wrote wrong.
 *
 * ⚠️ AN UNKNOWN `owner_kind` REFUSES RATHER THAN THROWS. `ConnectionOwnerKind`
 * is derived from the declaration, so a fourth arm added to `model/domain.ts`
 * fails to compile at `ORG_CLASS_FOR_CONNECTION_OWNER` — the total `Record` §2
 * exists for — long before it could reach a row. What arrives here instead is a
 * row written by something that is not this build, and that is a refusal.
 */
function identityConnectionFrom(
  row: Record<string, unknown>,
): IdentityConnection | SubstrateRefusal {
  const status = doorStatus(row['status'])
  if (status === null) return SUBSTRATE_REFUSALS.valueUnrecognised

  /* ⚠️ THE PROTOCOL IS CLASSIFIED BEFORE THE OWNER, AND THE ORDER IS THE SAME
   * ARGUMENT `resolveSubject()` MAKES ABOUT ITS SEVEN ARMS. An unrecognised
   * protocol is a row this build does not understand AT ALL; answering
   * `owner_unresolvable` for it would name the wrong column in the operator's
   * log, and the log is the one reader entitled to the distinction. */
  const protocol = connectionProtocol(row['protocol'])
  if (protocol === null) return SUBSTRATE_REFUSALS.valueUnrecognised

  const federation = federationFrom(protocol, row)
  if (typeof federation === 'string') return federation

  const kind = row['owner_kind']
  const partnerId = row['owner_partner_id']
  const accountId = row['owner_account_id']

  let owner: IdentityConnection['owner']
  if (kind === 'platform') {
    owner = { kind: 'platform' }
  } else if (kind === 'partner') {
    if (typeof partnerId !== 'string' || partnerId === '') {
      return SUBSTRATE_REFUSALS.ownerUnresolvable
    }
    owner = { kind: 'partner', partnerId } as IdentityConnection['owner']
  } else if (kind === 'customer') {
    if (typeof accountId !== 'string' || accountId === '') {
      return SUBSTRATE_REFUSALS.ownerUnresolvable
    }
    owner = { kind: 'customer', accountId } as IdentityConnection['owner']
  } else {
    return SUBSTRATE_REFUSALS.ownerUnresolvable
  }

  /* ⚠️ THE CAST NOW COVERS FIVE OF SEVEN FIELDS RATHER THAN THREE, WHICH IS
   * THE RIGHT DIRECTION AND IS STATED SO IT IS NOT MISTAKEN FOR DRIFT. What is
   * still absent is `label` — not selected, G232 — and `domains`.
   *
   * ⚠️ **THE `domains` CLAUSE READ *"which has no table at all (0009: 'the
   * commit that builds federated sign-in owns the `domain_claim` table, in the
   * same commit as the router that reads it')"* UNTIL 22 Sep 2026 AND IS
   * CORRECTED RATHER THAN DELETED, because it is the sentence that told a
   * reader the claim table did not exist and it is the sentence 0009 wrote
   * this commit's instruction into.** `db/migrations/0220_domain_claim.sql` is
   * that table and `resolveHomeRealm` is that router.
   *
   * **What is unchanged is this FUNCTION**: it still returns a connection with
   * no `domains`, because neither read above needs one and a read that carried
   * every claim a door holds would put other customers' domains into a
   * session-scoped request's memory for nothing.
   * `readConnectionsClaimingDomain()` below is the one path that attaches
   * them, and it attaches only the claims on the domain the caller named. */
  return {
    id: String(row['id']),
    protocol,
    owner,
    federation,
    status,
  } as unknown as IdentityConnection
}

/* ------------------------------------------------------------------ *
 * 4. The session-scoped read
 * ------------------------------------------------------------------ */

export interface SubjectRows {
  readonly user: User
  readonly connection: IdentityConnection
}

export type SubjectRowsOutcome =
  | { readonly ok: true; readonly rows: SubjectRows }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

/**
 * The person and the door the session names, read inside the SESSION scope.
 *
 * 🛑 NEITHER STATEMENT CARRIES A `WHERE`, AND THAT IS THE SAME PROPERTY
 * `session.ts` STATES ABOUT ITS OWN READ: *"`session_rls` decides which row it
 * can see."* `user_rls` and `identity_connection_rls` resolve the current
 * session out of `tenant.session` by the digest in `app.session_ref` and admit
 * exactly the row that session names — so the narrowing is the POLICY's, it is
 * the same narrowing on every request, and there is no predicate here for a
 * handler to get wrong or for a later reader to extend.
 *
 * ⚠️ THE `rows.length !== 1` GUARD IS NOT PARANOIA. Both policies resolve
 * through a scalar subquery, so a scope carrying no digest yields zero rows and
 * a correct scope yields exactly one. More than one would mean the primary key
 * had stopped being one, and serving a request on the first of them is how a
 * substrate defect becomes an authorisation defect.
 */
export async function readSubjectRows(tx: ScopedClient): Promise<SubjectRowsOutcome> {
  const users = (await tx.query(USER_READ)).rows as Array<Record<string, unknown>>
  const userRow = users[0]
  if (userRow === undefined || users.length !== 1) {
    return { ok: false, refusal: SUBSTRATE_REFUSALS.userAbsent }
  }
  const user = personFrom(userRow)
  if (typeof user === 'string') return { ok: false, refusal: user }

  const doors = (await tx.query(CONNECTION_READ)).rows as Array<Record<string, unknown>>
  const doorRow = doors[0]
  if (doorRow === undefined || doors.length !== 1) {
    return { ok: false, refusal: SUBSTRATE_REFUSALS.connectionAbsent }
  }
  const connection = identityConnectionFrom(doorRow)
  if (typeof connection === 'string') return { ok: false, refusal: connection }

  return { ok: true, rows: { user, connection } }
}

/* ------------------------------------------------------------------ *
 * 4a. The SIGN-IN-scoped read — the same row, reached the other way
 * ------------------------------------------------------------------ */

export type ConnectionOutcome =
  | { readonly ok: true; readonly connection: IdentityConnection }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

/**
 * THE DOOR A BROKER HANDLE NAMES, READ WITH NO SESSION — G340, applied 19 Sep
 * 2026.
 *
 * ⚠️ IT IS THE SAME STATEMENT AND THE SAME ASSEMBLER AS `readSubjectRows()`
 * ABOVE, AND THAT IS THE ONLY REASON IT LIVES IN THIS FILE RATHER THAN IN
 * `server/data-plane/signin.ts`. A second `SELECT … FROM
 * tenant.identity_connection` beside a second copy of `identityConnectionFrom`
 * would be two places a row becomes a record, and the two would answer
 * differently about a malformed row on the day one of them was extended —
 * §5.3, where the copy is what drifts. **`CONNECTION_READ` is reused verbatim;
 * this function adds no predicate at all.**
 *
 * 🛑 THE NARROWING IS THE POLICY'S, EXACTLY AS IT IS ONE FUNCTION UP, AND THE
 * POLICY IS A DIFFERENT ONE. `identity_connection_signin_rls`
 * (`db/migrations/0013_federated_signin.sql`) admits the row whose
 * `(broker_issuer, broker_ref)` equals the pair in `app.broker_issuer` and
 * `app.broker_ref` — G343, because a predicate on the reference alone is the
 * collided key G304 refused. There is no `WHERE broker_ref = $1` here and
 * there must never be one: a handler-side predicate beside a policy-side one
 * is two answers to one question, and the handler is the one an attacker gets
 * to influence.
 *
 * ⚠️ SO CALLING THIS OUTSIDE `withSignInScope()` RETURNS `connection_absent`
 * RATHER THAN EVERY ROW. Both policies are permissive and both resolve through
 * a comparison against an unset GUC, which is NULL, and NULL is not TRUE —
 * G100 unchanged. `tests/db/federated-signin.test.ts` §2c asserts it.
 *
 * ⚠️ AND IT RETURNS THE **WHOLE** RECORD RATHER THAN AN ID, WHICH IS WHAT MAKES
 * IT WORTH HAVING. `federationFrom()` runs, so G305's coherence rule is
 * enforced on this path too: a `cognito_pool` row carrying a handle, or a
 * brokered row carrying half of one, is `broker_unresolvable` here exactly as
 * it is on the session path. A resolver that returned `row.id` would have
 * skipped that check on the one path where the handle is the lookup key.
 */
export async function readConnectionByBrokerHandle(
  tx: ScopedClient,
): Promise<ConnectionOutcome> {
  const doors = (await tx.query(CONNECTION_READ)).rows as Array<Record<string, unknown>>
  const doorRow = doors[0]
  /* ⚠️ `!== 1` IS NOT PARANOIA HERE EITHER, AND IT IS A DIFFERENT GUARANTEE
   * THAN THE ONE ABOVE. There the policy resolves through a scalar subquery on
   * a primary key; here it is an equality on two columns, and what makes it at
   * most one row is `identity_connection_broker_handle_uniq` — a PARTIAL index
   * (G304). Two rows would mean that index was dropped, and serving a sign-in
   * on the first of them is an org-class collision resolved by row order. */
  if (doorRow === undefined || doors.length !== 1) {
    return { ok: false, refusal: SUBSTRATE_REFUSALS.connectionAbsent }
  }
  const connection = identityConnectionFrom(doorRow)
  if (typeof connection === 'string') return { ok: false, refusal: connection }
  return { ok: true, connection }
}

/* ------------------------------------------------------------------ *
 * 4b. The realm-scoped read — the doors claiming ONE domain
 * ------------------------------------------------------------------ */

/**
 * THE CLAIMS, AND NOTHING ELSE. `db/migrations/0220_domain_claim.sql`.
 *
 * ⚠️ **THREE COLUMNS AND THE `challenge` PAIR IS NOT AMONG THEM, BECAUSE THE
 * TABLE HAS NO SUCH COLUMNS.** 0170 refuses them by name — they are the
 * VERIFIER's, and there is no verifier — so this statement could not select
 * them if somebody wanted to. Stated here because `CONNECTION_READ` above
 * carries the opposite note (columns that exist and are deliberately not
 * selected) and a reader moving between the two should not have to guess which
 * kind of absence this is.
 *
 * 🛑 **NO `WHERE`, AND IT IS THE SAME SENTENCE `readConnectionByBrokerHandle()`
 * CARRIES:** *"There is no `WHERE broker_ref = $1` here and there must never be
 * one: a handler-side predicate beside a policy-side one is two answers to one
 * question, and the handler is the one an attacker gets to influence."*
 * `domain_claim_realm_rls` is the narrowing.
 */
export const DOMAIN_CLAIM_READ = `
  SELECT connection_id, domain, verified_at
    FROM tenant.domain_claim
`

export type RealmConnectionsOutcome =
  | { readonly ok: true; readonly connections: readonly IdentityConnection[] }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

/**
 * THE DOORS THAT CLAIM THE DOMAIN IN `app.claimed_domain`, READ WITH NO
 * SESSION AND NO CREDENTIAL AT ALL — G1946, 22 Sep 2026.
 *
 * ⚠️ IT IS THE SAME STATEMENT AND THE SAME ASSEMBLER AS THE TWO READS ABOVE,
 * AND THAT IS THE ONLY REASON IT LIVES IN THIS FILE RATHER THAN IN
 * `server/data-plane/realm.ts`. A second `SELECT … FROM
 * tenant.identity_connection` beside a second copy of `identityConnectionFrom`
 * would be two places a row becomes a record, and the two would answer
 * differently about a malformed row on the day one of them was extended —
 * §5.3, where the copy is what drifts. **`CONNECTION_READ` is reused verbatim
 * and this function adds no predicate to it either.**
 *
 * 🛑 **IT RETURNS A LIST AND THE LIST IS THE POINT.** `routeToConnection()`
 * counts ambiguity over VERIFIED claims — *"Two connections with a verified
 * claim on one domain IS the takeover state — picking either picks an
 * `orgClass` for the user, which is the reach invariant 2 exists to close"* —
 * so a reader that returned the FIRST door would resolve that state by row
 * order and report success. The two reads above return exactly one row each
 * and say why; this one must not.
 *
 * 🛑 **A MALFORMED CLAIMANT REFUSES THE WHOLE READ AND IS NOT DROPPED, AND
 * THAT IS THE ARM TO ARGUE WITH BEFORE CHANGING IT.** `identityConnectionFrom`
 * refuses a row whose owner columns disagree, whose protocol this build does
 * not know, or whose broker handle is half-present. Skipping such a row would
 * be the ambiguity check deciding a takeover state by discarding one of its
 * two participants — the exact failure `HELD_READ`'s `INNER JOIN` note is
 * allowed to have because a `HeldAssignment` has no half, and which this path
 * is not allowed to have because the COUNT is the control.
 *
 * ⚠️ SO CALLING THIS OUTSIDE `withRealmScope()` RETURNS AN EMPTY LIST RATHER
 * THAN EVERY ROW. Both new policies resolve through a comparison against an
 * unset GUC, which is NULL, and NULL is not TRUE — G100 unchanged.
 * `tests/db/domain-claim.test.ts` §3 asserts it inside each of the other four
 * scopes rather than reasoning about it.
 *
 * ⚠️ AND A CLAIM NAMING A CONNECTION WITH NO ROW CONTRIBUTES NO CLAIMANT, BY
 * CONSTRUCTION RATHER THAN BY A GUARD: 0170 declines the foreign key (0009's
 * precedent), so the join here is a lookup that finds nothing and the answer
 * is `domain_not_claimed` — which is TRUE, because a claim pointing at no door
 * routes to no door.
 */
export async function readConnectionsClaimingDomain(
  tx: ScopedClient,
): Promise<RealmConnectionsOutcome> {
  const claims = (await tx.query(DOMAIN_CLAIM_READ)).rows as Array<Record<string, unknown>>

  /**
   * 🛑 **BOTH READS ARE ISSUED UNCONDITIONALLY, AND THE EARLY RETURN THAT
   * STOOD HERE WAS A TIMING SIDE CHANNEL — G1988, 22 Sep 2026.**
   *
   * This function read:
   *
   *     if (claims.length === 0) return { ok: true, connections: [] }
   *
   * which is the obvious shape and looks like a pure saving, because the
   * second read cannot change the answer when there are no claims. **What it
   * changes is the number of database round trips, and that is observable to
   * a caller who cannot read the body:**
   *
   *     a domain NOBODY claims        -> 1 read   -> faster
   *     a domain with an ORPHAN claim -> 2 reads  -> slower
   *
   * Both answer `422 domain_not_claimed`, byte for byte. The contract's whole
   * design for this operation is that the four refusals *"share one status …
   * distinguished by `ErrorCode` and by nothing else"*, and its stated reason
   * is that two statuses would put the distinction *"in a channel a caller
   * can read without parsing a body."* **A round trip is such a channel**, and
   * it discloses a fact about a THIRD PARTY's directory configuration — that
   * somebody registered this domain against a connection that no longer
   * exists — to a caller who has presented nothing.
   *
   * ⚠️ **THIS DOES NOT MAKE THE OPERATION CONSTANT-TIME AND MUST NOT BE READ
   * AS DOING SO.** Two statements always issued is not two statements that
   * always cost the same: the second read returns more rows when doors exist,
   * `identityConnectionFrom` runs per row, and the 200 arm does strictly more
   * work than any 422. **What is closed is the arm-to-arm difference in the
   * number of ROUND TRIPS, which was the discrete and reliably measurable
   * one.** The residual timing spread is recorded as an OPEN D6 question on
   * `server/data-plane/realm.ts` rather than claimed as handled here.
   *
   * ⚠️ AND THE COST IS ONE `SELECT` ON THE COMMONEST PATH, INSIDE A SCOPE
   * WHERE IT CAN RETURN AT MOST THE DOORS CLAIMING THE ONE NAMED DOMAIN — so
   * with no claims, `identity_connection_realm_rls`'s `EXISTS` is false for
   * every row and it reads nothing. It is a round trip, not a scan.
   */
  const doors = (await tx.query(CONNECTION_READ)).rows as Array<Record<string, unknown>>
  if (claims.length === 0) return { ok: true, connections: [] }
  const out: IdentityConnection[] = []
  for (const doorRow of doors) {
    const connection = identityConnectionFrom(doorRow)
    if (typeof connection === 'string') return { ok: false, refusal: connection }
    const id = connection.id
    /* ⚠️ THE CLAIMS ARE ATTACHED RATHER THAN RE-QUERIED, AND `domains` CARRIES
     * ONLY THE ONES THIS SCOPE COULD SEE — which is the claims on the one
     * domain the caller named. `routeToConnection()` filters by that key
     * itself, so a narrower list changes no answer it can give; what it does
     * change is that nothing in this process ever holds a connection's other
     * claims, which are other customers' domains. */
    const domains = claims
      .filter((claim) => claim['connection_id'] === id)
      .map((claim) => ({
        domain: String(claim['domain']),
        verifiedAt: isoOrNull(claim['verified_at']),
      }))
    if (domains.length === 0) continue
    /* ⚠️ THE CAST IS `identityConnectionFrom`'s OWN, EXTENDED BY ONE FIELD.
     * That assembler already returns an `IdentityConnection` missing `label`
     * (not selected, G232) and `domains`; this adds `domains` and leaves
     * `label` exactly as absent as it was. `challenge` and
     * `verificationExpiresAt` are absent because 0170 has no columns for them
     * — `mayRouteToConnection()` reads neither. */
    out.push({ ...connection, domains } as unknown as IdentityConnection)
  }
  return { ok: true, connections: out }
}

/* ------------------------------------------------------------------ *
 * 5. The tenant-scoped read — `held`
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE ONLY NARROWING IN THIS STATEMENT IS `user_id`, AND IT IS AN ADDRESS
 * RATHER THAN A POLICY. Read the difference before adding a term: `user_id =
 * $1` says WHOSE assignments these are, which is a question about which rows
 * are being asked for; `revoked_at IS NULL` would say WHETHER they count, which
 * is a question `decide()` answers and answers with a NAME —
 * `assignment_revoked`, `assignment_expired`, `role_not_active`,
 * `role_version_moved`, `durable_assignment_forbidden_for_org`. **Five refusal
 * reasons become unreachable the moment this `WHERE` grows a second clause**,
 * and the evaluator would go on reporting success at deciding a question the
 * SQL had already decided.
 *
 * ⚠️ IT IS AN `INNER JOIN` TO `tenant.role`, SO AN ASSIGNMENT POINTING AT A
 * ROLE THAT IS NOT THERE IS DROPPED RATHER THAN REFUSED. That is the one place
 * this file does discard a row silently, and it is stated rather than hidden:
 * `HeldAssignment` is `{ role, assignment }` and there is no such thing as half
 * of one. The composite foreign key makes the case unrepresentable inside one
 * tenant, so what remains is a row from a tenant this scope cannot see — which
 * is RLS working, not a defect.
 *
 * ⚠️ AND `assignment.roleId !== role.id` IS STILL CHECKED BY `decide()`
 * AFTERWARDS, ON A PAIR THIS JOIN JUST MADE EQUAL. That looks redundant and is
 * not: `decide()` does not know where its list came from, and
 * `assignment_role_mismatch` has to stay reachable for the callers that build a
 * `HeldAssignment` by hand — every fixture in `tests/model/` does.
 */
const HELD_READ = `
  SELECT a.id            AS assignment_id,
         a.user_id       AS assignment_user_id,
         a.role_id       AS assignment_role_id,
         a.role_version  AS assignment_role_version,
         a.granted_by    AS assignment_granted_by,
         a.granted_at    AS assignment_granted_at,
         a.expires_at    AS assignment_expires_at,
         a.revoked_at    AS assignment_revoked_at,
         a.tenant_id     AS tenant_id,
         r.id            AS role_id,
         r.label         AS role_label,
         r.key           AS role_key,
         r.version       AS role_version,
         r.stakeholder_class AS role_stakeholder_class,
         r.origin        AS role_origin,
         r.pack_id       AS role_pack_id,
         r.status        AS role_status
    FROM tenant.role_assignment a
    JOIN tenant.role r
      ON r.tenant_id = a.tenant_id
     AND r.id        = a.role_id
   WHERE a.user_id = $1
`

const ROLE_CAPABILITY_READ = `
  SELECT role_id, capability
    FROM tenant.role_capability
`

/**
 * A capability string from a row → a member of the closed set, or dropped.
 *
 * 🛑 DROPPED AND NOT REFUSED, AND THE DIRECTION IS THE WHOLE ARGUMENT. A row
 * naming a verb this build does not declare can only NARROW what a role
 * carries, never widen it — `decide()` asks `role.capabilities.includes(…)`
 * against a member of the closed set, so an unknown string could never match
 * anything anyway. Refusing the whole role instead would let one bad row in a
 * capability table take a person's entire authority away, which is a denial of
 * service written as a safety check.
 *
 * ⚠️ THIS IS NOT THE `.includes()` `model/access.ts` FORBIDS, for the reason
 * `asCapability()` in `server/data-plane/authorise.ts` already gives at length:
 * that prohibition is about a PRINCIPAL's capability set, and this is a
 * question about a vocabulary.
 */
function asCapability(value: unknown): Capability | null {
  const members = Object.values(CAPABILITIES) as readonly Capability[]
  return members.find((m) => m === value) ?? null
}

function roleFrom(
  row: Record<string, unknown>,
  capabilities: readonly Capability[],
): Role | SubstrateRefusal {
  const status = roleStatus(row['role_status'])
  if (status === null) return SUBSTRATE_REFUSALS.valueUnrecognised
  return {
    tenantId: String(row['tenant_id']),
    id: String(row['role_id']),
    label: String(row['role_label']),
    key: String(row['role_key']),
    version: Number(row['role_version']),
    /**
     * ⚠️ `stakeholderClass` AND `origin` ARE CAST AND `status` IS CLASSIFIED,
     * AND THE LINE BETWEEN THEM IS WHETHER ANYTHING BRANCHES ON THE VALUE.
     * `decide()` reads `role.status`, `role.version` and `role.capabilities`
     * and reads neither of these two; a wrong `origin` cannot change a verdict.
     * Classifying them would need a local copy of two closed sets that have no
     * exported `const` to iterate — `RoleOrigin` is a bare union — and
     * `0002_run.sql`'s prohibition on a second copy of an enum is about the
     * UNCHECKED-NESS of the copy, which a hand-written literal list in a
     * serving module would have in full. **The day something branches on
     * either, it needs a guard and the guard needs a mutual assertion, exactly
     * like the two at the head of this file.**
     */
    stakeholderClass: row['role_stakeholder_class'],
    origin: row['role_origin'],
    packId: row['role_pack_id'] === null ? null : String(row['role_pack_id']),
    capabilities,
    /** See `0009`'s scope note: no columns, `DENY_ALL`, and the debt is named there. */
    defaultScope: DENY_ALL,
    status,
  } as unknown as Role
}

function assignmentFrom(row: Record<string, unknown>): RoleAssignment {
  return {
    tenantId: String(row['tenant_id']),
    id: String(row['assignment_id']),
    userId: String(row['assignment_user_id']),
    roleId: String(row['assignment_role_id']),
    roleVersion: Number(row['assignment_role_version']),
    /** See `0009`'s scope note. `DENY_ALL` is the SAFE filler, not a convenient one. */
    scope: DENY_ALL,
    grantedBy: String(row['assignment_granted_by']),
    grantedAt: iso(row['assignment_granted_at']),
    expiresAt: isoOrNull(row['assignment_expires_at']),
    revokedAt: isoOrNull(row['assignment_revoked_at']),
  } as unknown as RoleAssignment
}

export type HeldOutcome =
  | { readonly ok: true; readonly held: readonly HeldAssignment[] }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

/**
 * Every role assignment this person holds in this tenant — live, revoked,
 * expired, pinned to a moved version, all of them.
 *
 * ⚠️ AN EMPTY ARRAY IS A FACT AND IS NOT AN ABSENCE. `server/data-plane/
 * authorise.ts`: *"`held: []` DENIES, and `held: null` REFUSES … An empty array
 * means a reader ran and found no assignments; `null` means there is no reader
 * at all."* This function returning `{ ok: true, held: [] }` is the first
 * statement; a caller that never reached it is the second. `decide()` answers
 * `no_live_assignment` to the first, by name.
 *
 * Runs inside `withTenantScope()`. `role_rls`, `role_capability_rls` and
 * `role_assignment_rls` are 0001's predicate verbatim, so the tenant narrowing
 * is the policy's and no clause here repeats it.
 */
export async function readHeldAssignments(
  tx: ScopedClient,
  userId: string,
): Promise<HeldOutcome> {
  const rows = (await tx.query(HELD_READ, [userId])).rows as Array<Record<string, unknown>>
  if (rows.length === 0) return { ok: true, held: [] }

  const capRows = (await tx.query(ROLE_CAPABILITY_READ)).rows as Array<
    Record<string, unknown>
  >
  const byRole = new Map<string, Capability[]>()
  for (const capRow of capRows) {
    const verb = asCapability(capRow['capability'])
    if (verb === null) continue
    const key = String(capRow['role_id'])
    const list = byRole.get(key)
    if (list === undefined) byRole.set(key, [verb])
    else list.push(verb)
  }

  const held: HeldAssignment[] = []
  for (const row of rows) {
    const role = roleFrom(row, byRole.get(String(row['role_id'])) ?? [])
    if (typeof role === 'string') return { ok: false, refusal: role }
    held.push({ role, assignment: assignmentFrom(row) })
  }
  return { ok: true, held }
}

/* ------------------------------------------------------------------ *
 * 5a. The tenant-scoped read — `memberships`. G641, 19 Sep 2026.
 * ------------------------------------------------------------------ */

/**
 * THE MEMBERSHIP ROWS FOR ONE PERSON, INSIDE WHATEVER TENANT SCOPE IS OPEN.
 *
 * 🛑 THIS STATEMENT AND THE THREE LINES UNDER IT MOVED HERE FROM
 * `server/data-plane/context.ts` IN THE COMMIT THAT ADDED A SECOND CALLER, AND
 * THE MOVE IS THE POINT RATHER THAN A TIDY-UP. G641 makes the per-request path
 * ask the question D1 asks; a second `SELECT … FROM tenant.membership` beside
 * the first would be the drift `db/migrations/0035` catalogues in SQL —
 * *"the liveness expression below IS a copy … one of the copies was written
 * with one term missing"* — reproduced in TypeScript, on the read instead of on
 * the predicate. **One read, one predicate (`holdsLiveMembership()`), two
 * callers.** `context.ts` imports this and states no statement of its own.
 *
 * ⚠️ THE `user_id` FILTER IS AN INDEX HINT AND NOT A CONTROL, AND THE
 * DISTINCTION IS WORTH A LINE — `context.ts`'s own words, carried with the
 * statement. `membership_live_idx` is `(tenant_id, user_id)`; the tenant half
 * is supplied by `membership_rls` without anybody writing it, and
 * `holdsLiveMembership()` re-checks BOTH terms on every row regardless, because
 * a check that depends on its caller having already checked is not a check.
 *
 * 🛑 NO LIVENESS TERM IN THIS QUERY, WHICH IS THIS FILE'S OWN RULE AND NOT AN
 * IMPORT OF ONE. The header two hundred lines up: *"There is no liveness test
 * in this file. No `revoked_at IS NULL`, no `expires_at > now()` … Every one of
 * those questions belongs to `resolveSubject()` and to `decide()`, which answer
 * them BY NAME."* `revoked_at` and `expires_at` are read as COLUMNS and decided
 * by the model, so the two halves of G199 — and now the two callers of G641 —
 * compare the same rows. Filtering here would leave a disagreement between the
 * halves invisible, which is the third defeat
 * `tests/db/session-membership-selection.test.ts` assertion (e) exists to catch.
 */
export const MEMBERSHIP_READ = `
  SELECT id, user_id, tenant_id, role_id, granted_by, granted_at, expires_at, revoked_at
    FROM tenant.membership
   WHERE user_id = $1
`

function membershipFrom(row: Record<string, unknown>): Membership {
  return {
    id: String(row['id']),
    userId: String(row['user_id']),
    tenantId: String(row['tenant_id']),
    roleId: String(row['role_id']),
    grantedBy: String(row['granted_by']),
    grantedAt: iso(row['granted_at']),
    expiresAt: isoOrNull(row['expires_at']),
    revokedAt: isoOrNull(row['revoked_at']),
  } as unknown as Membership
}

/**
 * ⚠️ NO `MembershipOutcome`, AND THE ASYMMETRY WITH `readHeldAssignments()` IS
 * DELIBERATE RATHER THAN AN OMISSION. A `SubstrateRefusal` exists for a row
 * whose bytes this build cannot classify — `readHeldAssignments()` has one
 * because `role.status` is a closed set and a row outside it is our defect.
 * **A membership row has no closed-set column**: every field is a branded id
 * (`text` under G97, stored verbatim) or a nullable timestamp. There is nothing
 * to fail to classify, so a refusal arm here would be a member nothing could
 * return — `docs/HANDOFF.md` §5.6 minted on purpose.
 *
 * 🛑 A READ THAT **THROWS** IS STILL A FACT ABOUT US AND IS STILL NOT AN EMPTY
 * ROSTER. This function does not catch; its caller's `try` does, and
 * `resolveAuthority()` turns a throw into `null` — a 401 — and never into
 * `[]`. `[]` means a reader ran and found no membership, which is a fact about
 * the PERSON and is what G641 refuses on.
 */
export async function readMemberships(
  tx: ScopedClient,
  userId: string,
): Promise<readonly Membership[]> {
  const rows = (await tx.query(MEMBERSHIP_READ, [userId])).rows as Array<
    Record<string, unknown>
  >
  return rows.map(membershipFrom)
}

/* ------------------------------------------------------------------ *
 * 6. The platform pair — G289's term, produced for the first time
 * ------------------------------------------------------------------ */

const PLATFORM_HELD_READ = `
  SELECT a.id            AS assignment_id,
         a.user_id       AS assignment_user_id,
         a.role_id       AS assignment_role_id,
         a.role_version  AS assignment_role_version,
         a.granted_by    AS assignment_granted_by,
         a.granted_at    AS assignment_granted_at,
         a.expires_at    AS assignment_expires_at,
         a.revoked_at    AS assignment_revoked_at,
         r.id            AS role_id,
         r.label         AS role_label,
         r.key           AS role_key,
         r.version       AS role_version,
         r.stakeholder_class AS role_stakeholder_class,
         r.status        AS role_status
    FROM tenant.platform_role_assignment a
    JOIN tenant.platform_role r ON r.id = a.role_id
`

const PLATFORM_ROLE_CAPABILITY_READ = `
  SELECT role_id, capability
    FROM tenant.platform_role_capability
`

/**
 * ⚠️ NO `WHERE user_id = $1` HERE, WHERE `readHeldAssignments()` HAS ONE, AND
 * THE ASYMMETRY IS THE POLICIES DIFFERING RATHER THAN THIS FILE BEING
 * INCONSISTENT. `platform_role_assignment_rls` already keys on the session's
 * user — *"a platform principal cannot enumerate their colleagues' authority
 * through it"* — so the address is the policy's. `role_assignment_rls` keys on
 * the TENANT and cannot key on the person, because a tenant's roster is
 * legitimately readable within its own scope; there the address has to be
 * written down.
 *
 * 🛑 `PlatformRoleAssignment` CARRIES NO `expiresAt: null` ARM AND THE COLUMN
 * IS `NOT NULL`, so `isoOrNull` is not used for it. That is
 * `DURABLE_ASSIGNMENT_PERMITTED.platform === false` made unrepresentable rather
 * than checked — the declaration's own argument, held one layer down.
 */
function platformRoleFrom(
  row: Record<string, unknown>,
  capabilities: readonly Capability[],
): PlatformRole | SubstrateRefusal {
  const status = row['role_status']
  if (status !== 'active' && status !== 'archived') {
    return SUBSTRATE_REFUSALS.valueUnrecognised
  }
  return {
    id: String(row['role_id']),
    label: String(row['role_label']),
    key: String(row['role_key']),
    version: Number(row['role_version']),
    stakeholderClass: row['role_stakeholder_class'],
    capabilities,
    status,
  } as unknown as PlatformRole
}

function platformAssignmentFrom(row: Record<string, unknown>): PlatformRoleAssignment {
  return {
    id: String(row['assignment_id']),
    userId: String(row['assignment_user_id']),
    roleId: String(row['assignment_role_id']),
    roleVersion: Number(row['assignment_role_version']),
    grantedBy: String(row['assignment_granted_by']),
    grantedAt: iso(row['assignment_granted_at']),
    expiresAt: iso(row['assignment_expires_at']),
    revokedAt: isoOrNull(row['assignment_revoked_at']),
  } as unknown as PlatformRoleAssignment
}

export type PlatformHeldOutcome =
  | { readonly ok: true; readonly platformHeld: readonly HeldPlatformAssignment[] }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

/**
 * The platform role assignments this person holds, in no tenant. Runs inside
 * the SESSION scope, because neither table carries a `tenant_id` and
 * `PlatformRoleAssignment`'s declaration says what adding one would mean: *"If
 * a `tenantId` is ever added here, invariant 8 has been deleted in a field."*
 *
 * 🛑 THIS IS CALLED **ONLY** AFTER `orgClass` HAS ALREADY SAID `platform`, AND
 * THE ORDER IS G289's PROHIBITION HELD RATHER THAN RESTATED: *"holding a
 * platform role proves nothing about which directory authenticated anybody."*
 * The caller in `session.ts` passes `platformHeld: null` for every other
 * organisation — *"no reader ran"* — rather than `[]`, because `[]` would be
 * asserting a fact nobody checked.
 */
export async function readPlatformHeld(tx: ScopedClient): Promise<PlatformHeldOutcome> {
  const rows = (await tx.query(PLATFORM_HELD_READ)).rows as Array<Record<string, unknown>>
  if (rows.length === 0) return { ok: true, platformHeld: [] }

  const capRows = (await tx.query(PLATFORM_ROLE_CAPABILITY_READ)).rows as Array<
    Record<string, unknown>
  >
  const byRole = new Map<string, Capability[]>()
  for (const capRow of capRows) {
    const verb = asCapability(capRow['capability'])
    if (verb === null) continue
    const key = String(capRow['role_id'])
    const list = byRole.get(key)
    if (list === undefined) byRole.set(key, [verb])
    else list.push(verb)
  }

  const platformHeld: HeldPlatformAssignment[] = []
  for (const row of rows) {
    const role = platformRoleFrom(row, byRole.get(String(row['role_id'])) ?? [])
    if (typeof role === 'string') return { ok: false, refusal: role }
    platformHeld.push({ role, assignment: platformAssignmentFrom(row) })
  }
  return { ok: true, platformHeld }
}

/* ------------------------------------------------------------------ *
 * 6c. A partner firm's OWN portal roles — R10, 1 Oct 2026, the fifth
 *     arm's term, produced for the first time
 * ------------------------------------------------------------------ */

/*
 * 🛑 THE SAME SHAPE AS §6 ABOVE, ON PURPOSE, AND THE ONE DIFFERENCE IS
 *    `partner_id` ON BOTH ROWS. `db/migrations/0250_partner_role.sql` keys all
 *    three tables on the SESSION — the holder's own rows — exactly as `0009`
 *    keys the platform trio, so the address is the POLICY's and there is no
 *    `WHERE user_id = $1` here either. The firm is NOT filtered in SQL: a
 *    `WHERE partner_id = $1` would delete `partner_staff_other_partner`, the
 *    evaluator's own refusal, which is `readPartnerGrant()`'s empty-`WHERE`
 *    argument one table over.
 */
const PARTNER_HELD_READ = `
  SELECT a.id            AS assignment_id,
         a.partner_id    AS assignment_partner_id,
         a.user_id       AS assignment_user_id,
         a.role_id       AS assignment_role_id,
         a.role_version  AS assignment_role_version,
         a.granted_by    AS assignment_granted_by,
         a.granted_at    AS assignment_granted_at,
         a.expires_at    AS assignment_expires_at,
         a.revoked_at    AS assignment_revoked_at,
         r.id            AS role_id,
         r.partner_id    AS role_partner_id,
         r.label         AS role_label,
         r.key           AS role_key,
         r.version       AS role_version,
         r.status        AS role_status
    FROM tenant.partner_role_assignment a
    JOIN tenant.partner_role r ON r.id = a.role_id
`

const PARTNER_ROLE_CAPABILITY_READ = `
  SELECT role_id, capability
    FROM tenant.partner_role_capability
`

function partnerRoleFrom(
  row: Record<string, unknown>,
  capabilities: readonly Capability[],
): PartnerRole | SubstrateRefusal {
  const status = row['role_status']
  if (status !== 'active' && status !== 'archived') {
    return SUBSTRATE_REFUSALS.valueUnrecognised
  }
  return {
    id: String(row['role_id']),
    partnerId: String(row['role_partner_id']),
    label: String(row['role_label']),
    key: String(row['role_key']),
    version: Number(row['role_version']),
    capabilities,
    status,
  } as unknown as PartnerRole
}

/** `expires_at` is `NOT NULL`, so `iso` and not `isoOrNull` — `DURABLE_ASSIGNMENT_PERMITTED.partner === false`, held one layer down. */
function partnerAssignmentFrom(row: Record<string, unknown>): PartnerRoleAssignment {
  return {
    id: String(row['assignment_id']),
    partnerId: String(row['assignment_partner_id']),
    userId: String(row['assignment_user_id']),
    roleId: String(row['assignment_role_id']),
    roleVersion: Number(row['assignment_role_version']),
    grantedBy: String(row['assignment_granted_by']),
    grantedAt: iso(row['assignment_granted_at']),
    expiresAt: iso(row['assignment_expires_at']),
    revokedAt: isoOrNull(row['assignment_revoked_at']),
  } as unknown as PartnerRoleAssignment
}

export type PartnerHeldOutcome =
  | { readonly ok: true; readonly partnerHeld: readonly HeldPartnerAssignment[] }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

/**
 * The portal-role assignments this person holds in their own firm, in no
 * tenant. Runs inside the SESSION scope.
 *
 * 🛑 CALLED ONLY AFTER `orgClass` HAS SAID `partner`, for `readPlatformHeld()`'s
 *    reason: holding a partner role proves nothing about which directory
 *    authenticated anybody, and the caller passes `partnerHeld: null` — *"no
 *    reader ran"* — for every other organisation.
 *
 * ⚠️ AND NOTHING HAS EVER WRITTEN A ROW, so in this repository every partner
 *    principal reaching the fifth arm is refused at
 *    `partner_staff_assignment_absent`. That is the substrate's state, not the
 *    arm's — the same shape §6 records for the platform trio.
 */
export async function readPartnerHeld(tx: ScopedClient): Promise<PartnerHeldOutcome> {
  const rows = (await tx.query(PARTNER_HELD_READ)).rows as Array<Record<string, unknown>>
  if (rows.length === 0) return { ok: true, partnerHeld: [] }

  const capRows = (await tx.query(PARTNER_ROLE_CAPABILITY_READ)).rows as Array<
    Record<string, unknown>
  >
  const byRole = new Map<string, Capability[]>()
  for (const capRow of capRows) {
    const verb = asCapability(capRow['capability'])
    if (verb === null) continue
    const key = String(capRow['role_id'])
    const list = byRole.get(key)
    if (list === undefined) byRole.set(key, [verb])
    else list.push(verb)
  }

  const partnerHeld: HeldPartnerAssignment[] = []
  for (const row of rows) {
    const role = partnerRoleFrom(row, byRole.get(String(row['role_id'])) ?? [])
    if (typeof role === 'string') return { ok: false, refusal: role }
    partnerHeld.push({ role, assignment: partnerAssignmentFrom(row) })
  }
  return { ok: true, partnerHeld }
}

/* ------------------------------------------------------------------ *
 * 6a. THE PARTNER GRANT — invariant 2's own term, produced for the
 *     first time. G576, 19 Sep 2026.
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE `WHERE` IS EMPTY AND THAT IS THE WHOLE OF THIS DECLARATION.
 *
 * Three predicates suggest themselves and every one of them would delete a
 * refusal `decide()` owns:
 *
 *   `WHERE partner_id = $1`   deletes `partner_grant_other_partner` — §9.5's
 *                             check, the one that stops a partner engineer who
 *                             moved to the customer keeping grant-derived
 *                             authority. Filtered out here, the arm can only
 *                             ever answer `partner_grant_absent`, and the
 *                             difference between *"there is no grant"* and
 *                             *"the grant belongs to somebody else"* is
 *                             invariant 2's entire subject.
 *   `WHERE revoked_at IS NULL` deletes `partner_grant_revoked`.
 *   `WHERE expires_at > now()` deletes `partner_grant_expired`.
 *
 * This module's own header states the rule and it is not restated here beyond
 * the reference: *"There is no liveness test in this file … a reader that
 * answered any of them first would hand the evaluator a list in which the
 * interesting cases had already been filtered out. The refusal reasons would
 * then be unreachable, and an unreachable refusal is a control that cannot be
 * witnessed."*
 *
 * ⚠️ THE TENANT NARROWING IS THE POLICY'S. `partner_access_grant_rls` is
 * 0001's predicate verbatim, so inside `withTenantScope()` this statement can
 * see exactly one tenant's rows and a `WHERE tenant_id = …` would be a second
 * copy of a narrowing that is already load-bearing elsewhere.
 *
 * ⚠️ `id` IS NOT SELECTED. `PartnerGrantTerms` has four fields and none of them
 * is the grant id; selecting it would put `PartnerAccessGrantId` — *"the row on
 * the ONLY cross-tenant read path … the highest-consequence mistype in the
 * model"* — into a record nothing reads. The commit that writes an audit row
 * naming the grant it ran under adds the column to this list, with its reader.
 */
export const PARTNER_GRANT_READ = `
  SELECT partner_id, scope, expires_at, revoked_at
    FROM tenant.partner_access_grant
`

/**
 * ⚠️ NO MUTUAL `AssertTrue` HERE, AND THE REASON IS THE ONE `connectionProtocol()`
 * GIVES: `PARTNER_ACCESS_SCOPES` is an exported `const` object, so the members
 * are READ from `model/access.ts` rather than copied beside it. A fourth scope
 * is admitted the instant the model declares it, with no edit here and
 * therefore with nothing to forget. The two assertions at the head of this file
 * exist only because `User['status']` and `Role['status']` are inline unions
 * with no `const` to iterate.
 */
function partnerScope(value: unknown): PartnerAccessScopeKey | null {
  const members = Object.values(PARTNER_ACCESS_SCOPES) as readonly PartnerAccessScopeKey[]
  return members.find((m) => m === value) ?? null
}

export type PartnerGrantOutcome =
  | { readonly ok: true; readonly grant: PartnerGrantTerms | null }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

/**
 * The tenant's partner grant, in the terms `decide()` takes — or `null`,
 * which is a FACT and not an absence.
 *
 * 🛑 `{ ok: true, grant: null }` IS *"A READER RAN AND THIS TENANT HAS GRANTED
 * NOBODY"*, AND `{ ok: false }` IS *"WE COULD NOT TELL"*. The distinction is
 * `readHeldAssignments()`'s `[]`-versus-`null` rule applied to a singular term,
 * and it matters in exactly one direction: a failed read must NOT arrive at
 * `decide()` as `partnerGrant: null`, because the model has no
 * `partner_grant_unreadable` reason to tell the two apart — it would be served
 * as `partner_grant_absent`, **a fact about our substrate reported as a fact
 * about the customer's decision.** `session.ts` turns `ok: false` into a 401,
 * exactly as it does for a failed assignment read.
 *
 * ⚠️ AND THIS IS CALLED **ONLY** AFTER `orgClass` HAS ALREADY SAID `partner`,
 * for `readPlatformHeld()`'s reason in the mirror: the grant is read against a
 * `partnerId` that comes from `orgFor(connection.owner)` and from nowhere else,
 * and reading a customer's tenant for a partner grant would answer a question
 * nobody asked. `session.ts` passes `partnerGrant: null` for every other
 * organisation — which `decide()` never reads on those arms.
 *
 * Runs inside `withTenantScope()`, in the SAME transaction as the assignment
 * read, so a grant revoked between the two cannot produce a mixed view of one
 * principal.
 */
export async function readPartnerGrant(tx: ScopedClient): Promise<PartnerGrantOutcome> {
  const rows = (await tx.query(PARTNER_GRANT_READ)).rows as Array<Record<string, unknown>>
  if (rows.length === 0) return { ok: true, grant: null }
  if (rows.length > 1) return { ok: false, refusal: SUBSTRATE_REFUSALS.partnerGrantNotUnique }

  const row = rows[0] as Record<string, unknown>
  const scope = partnerScope(row['scope'])
  if (scope === null) return { ok: false, refusal: SUBSTRATE_REFUSALS.valueUnrecognised }

  /**
   * ⚠️ ONE CAST OF SHAPE, at this seam, for the reason §3 gives: every branded
   * id is `text` under G97 and is stored VERBATIM, so `partner_id` is data.
   * `scope` is the discriminant and is CLASSIFIED rather than cast — *"an id is
   * data, a discriminant is a decision"* — and the two timestamps go through
   * the same `iso`/`isoOrNull` pair every other record here uses, because
   * `decide()` compares `expiresAt <= now` as STRINGS and a `Date` would
   * compare as `[object Date]`.
   */
  return {
    ok: true,
    grant: {
      partnerId: String(row['partner_id']),
      scope,
      expiresAt: iso(row['expires_at']),
      revokedAt: isoOrNull(row['revoked_at']),
    } as unknown as PartnerGrantTerms,
  }
}

/* ------------------------------------------------------------------ *
 * 7. THE DIRECTORY READS — ANOTHER PERSON, THEIR DOOR, AND A ROLE.
 *    G512, 19 Sep 2026, and every one of them is a G506 read.
 * ------------------------------------------------------------------ */

/**
 * 🛑 WHY THESE ARE IN THIS FILE AND NOT IN A STORE MODULE BESIDE THEIR CALLER.
 *
 * `personFrom()`, `identityConnectionFrom()` and `roleFrom()` are PRIVATE to
 * this module, and they are the three places a row becomes a record. A second
 * `SELECT … FROM tenant."user"` beside a second copy of `personFrom` would be
 * two answers to *"what is a person"* — §5.3, where the copy is what drifts —
 * and `readConnectionByBrokerHandle()` is already in this file for exactly that
 * reason, stated in its own header: *"`CONNECTION_READ` is reused verbatim;
 * this function adds no predicate at all."*
 *
 * ⚠️ THESE THREE DO ADD A PREDICATE, AND THE DIFFERENCE IS WHAT THEY ARE FOR.
 * `readSubjectRows()` names nobody because the policy names the caller: inside
 * `withSessionScope()` exactly one person is visible, so a `WHERE` would be a
 * second narrowing with nothing to narrow. These run inside `withTenantScope()`
 * carrying an invariant 10 record for `manage_roles`, where
 * `user_directory_rls` (`db/migrations/0018`) admits EVERY live member of the
 * tenant — so a `WHERE id = $1` here is a CHOICE of row out of a set the policy
 * already bounded, which is an ordinary read and not an access decision.
 *
 * 🛑 AND `readSubjectRows()`'s `rows.length !== 1` GUARD IS WHY THEY CANNOT
 * SIMPLY REUSE IT. That guard is correct where it is — *"More than one would
 * mean the primary key had stopped being one"* — and would be flatly wrong
 * here, where a tenant with two people is the normal case. **A reader that
 * assumed a singleton is precisely the defect `0018` records shipping**: its
 * door policy widened `tenant."user"` to two rows and
 * `server/data-plane/identity.ts` resolved the wrong one and refused. Two
 * functions, two predicates, two guards; not one function with a flag.
 */
const USER_BY_ID_READ = `${USER_READ} WHERE id = $1`
const CONNECTION_BY_ID_READ = `${CONNECTION_READ} WHERE id = $1`

/**
 * A NAMED PERSON AND THE DOOR THEY AUTHENTICATE THROUGH, READ OUT OF THE
 * DIRECTORY G506 OPENED.
 *
 * `{ ok: true, rows: null }` is **"the directory does not contain them"** and is
 * a FACT rather than a refusal: the policy returned no row, which means the
 * person is not a live member of this tenant, or does not exist, or the act
 * carries no `manage_roles` record. **Those are deliberately indistinguishable
 * here and must stay so** — `errors.yaml`'s `NotFound` says why one table over:
 * *"Returned identically for a row that does not exist and for a row in another
 * tenant — distinguishing them would make this endpoint an existence oracle."*
 *
 * ⚠️ AND A REFUSAL IS A DIFFERENT ANSWER AGAIN, WHICH IS THE `[]`-VERSUS-`null`
 * DISTINCTION THIS FILE DRAWS EVERYWHERE. A malformed row — an unrecognised
 * status, an owner that will not assemble, half a broker handle — is
 * `{ ok: false }` with a named `SubstrateRefusal`, because *"a session row
 * naming a user row that is not there is not a statement about the user, it is
 * a statement about us."* A caller must not report our defect as their absence.
 *
 * 🛑 THE DOOR IS READ AND NOT INFERRED, AND THAT IS `canGrant()`'s WHOLE
 * BLOCKER. `target.orgClass` has exactly one source — `orgFor(connection.owner)`
 * — and G449 stopped precisely here: *"reaching another person's
 * `IdentityConnection` needs their `tenant."user"` row first."* The tempting
 * repair, defaulting the target's org to `customer` because they hold a
 * membership, is G289's own trap in the target position and is refused in
 * writing at `tests/db/administrative-reach.test.ts` §2. **If the door does not
 * resolve, this returns an absence and the caller refuses; it never guesses.**
 */
export type DirectoryPersonOutcome =
  | { readonly ok: true; readonly rows: SubjectRows | null }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

export async function readPersonInDirectory(
  tx: ScopedClient,
  userId: string,
): Promise<DirectoryPersonOutcome> {
  const users = (await tx.query(USER_BY_ID_READ, [userId])).rows as Array<
    Record<string, unknown>
  >
  const userRow = users[0]
  if (userRow === undefined) return { ok: true, rows: null }
  const user = personFrom(userRow)
  if (typeof user === 'string') return { ok: false, refusal: user }

  /**
   * ⚠️ THE DOOR IS LOOKED UP BY THE PERSON'S OWN `connection_id` AND THE
   * ABSENCE IS A REFUSAL RATHER THAN A `null`. A person row carries a
   * `connection_id` that `0009` gives no foreign key, so an unresolvable door
   * is a substrate defect and not a statement about membership —
   * `connectionAbsent` is the member for it and it already exists.
   */
  const doors = (await tx.query(CONNECTION_BY_ID_READ, [user.connectionId])).rows as Array<
    Record<string, unknown>
  >
  const doorRow = doors[0]
  if (doorRow === undefined) return { ok: false, refusal: SUBSTRATE_REFUSALS.connectionAbsent }
  const connection = identityConnectionFrom(doorRow)
  if (typeof connection === 'string') return { ok: false, refusal: connection }

  return { ok: true, rows: { user, connection } }
}

/**
 * ONE ROLE AND THE VERBS IT CARRIES, in this tenant.
 *
 * ⚠️ `defaultScope` IS `DENY_ALL` AND SO IS EVERY SCOPE THIS FILE PRODUCES —
 * `0009`'s scope note argues it at length and `roleFrom()` already does it.
 * Restating it here would be a second decision about the same absent columns.
 *
 * 🛑 THE CAPABILITY LIST IS `asCapability()`-FILTERED, WHICH MEANS A VERB THIS
 * BUILD DOES NOT DECLARE IS DROPPED RATHER THAN REFUSED — this file's own rule,
 * and the direction is what makes it safe: *"A row naming a verb this build
 * does not declare can only NARROW what a role carries, never widen it."*
 *
 * ⚠️ AND THAT INTERACTS WITH `canGrant()` IN THE SAFE DIRECTION, WHICH IS WORTH
 * STATING BECAUSE IT IS THE ONE PLACE A DROP COULD HAVE WIDENED SOMETHING.
 * `canGrant()` requires the granter to hold EVERY capability of the conferred
 * role, so a dropped row makes the role look SMALLER and the check EASIER to
 * pass. **The database's own term 3 is what closes that**, because
 * `role_assignment_grant_restrictive` reads `tenant.role_capability` directly
 * and knows nothing about which verbs this build declares — so a row the model
 * cannot name still has to be held by the granter. Two checks, one strictly
 * narrower, and a row must pass both: `db/migrations/0020` argues the shape.
 */
export type RoleOutcome =
  | { readonly ok: true; readonly role: Role | null }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

const ROLE_BY_ID_READ = `
  SELECT r.tenant_id          AS tenant_id,
         r.id                 AS role_id,
         r.label              AS role_label,
         r.key                AS role_key,
         r.version            AS role_version,
         r.stakeholder_class  AS role_stakeholder_class,
         r.origin             AS role_origin,
         r.pack_id            AS role_pack_id,
         r.status             AS role_status
    FROM tenant.role r
   WHERE r.id = $1
`

const ROLE_CAPABILITY_BY_ROLE_READ = `
  SELECT capability
    FROM tenant.role_capability
   WHERE role_id = $1
`

export async function readRoleById(tx: ScopedClient, roleId: string): Promise<RoleOutcome> {
  const rows = (await tx.query(ROLE_BY_ID_READ, [roleId])).rows as Array<
    Record<string, unknown>
  >
  const row = rows[0]
  if (row === undefined) return { ok: true, role: null }

  const capRows = (await tx.query(ROLE_CAPABILITY_BY_ROLE_READ, [roleId])).rows as Array<
    Record<string, unknown>
  >
  const capabilities: Capability[] = []
  for (const capRow of capRows) {
    const verb = asCapability(capRow['capability'])
    if (verb !== null) capabilities.push(verb)
  }

  const role = roleFrom(row, capabilities)
  if (typeof role === 'string') return { ok: false, refusal: role }
  return { ok: true, role }
}

/* ------------------------------------------------------------------ *
 * 6b. THE STAFF GRANT — invariant 8's permitted path, read.
 *     G729, 19 Sep 2026.
 * ------------------------------------------------------------------ */

/**
 * 🛑 THE `WHERE` IS **EMPTY**, AND EVERY PREDICATE SOMEBODY WOULD ADD HERE
 * DELETES A REFUSAL — `PARTNER_GRANT_READ`'s argument, one table over, and it
 * is sharper on this side because `selectTenantForSession()`'s staff arm
 * collapses SIX distinct facts into one refusal name on purpose:
 *
 *   `WHERE staff_user_id = $1`  deletes the `staffGrant.staffUserId !==
 *                               session.userId` comparison, which is the one
 *                               that stops a caller binding a tenant on
 *                               somebody else's grant.
 *   `WHERE revoked_at IS NULL`  deletes G292's first liveness term.
 *   `WHERE expires_at > now()`  deletes G292's second, and moves the clock
 *                               from the CALLER's `now` — reproducible in an
 *                               audit — to the transaction's.
 *   any ceiling arithmetic      deletes G292's third, which is *"a property of
 *                               the PREDICATE rather than of whoever issues the
 *                               grant"*.
 *
 * **The model is the only thing that decides. This reader reads.** That is this
 * module's own standing rule, quoted rather than restated: *"a reader that
 * answered any of them first would hand the evaluator a list in which the
 * interesting cases had already been filtered out."*
 *
 * ⚠️ THE TENANT NARROWING IS THE POLICY'S. `tenant_access_grant_rls`
 * (`db/migrations/0008`) is 0001's predicate verbatim, so inside a scope
 * carrying `app.tenant_id` this statement sees exactly one tenant's rows and a
 * `WHERE tenant_id = …` would be a second copy of a narrowing that is already
 * load-bearing elsewhere.
 *
 * 🛑 AND THE RESOURCE LINES ARE JOINED RATHER THAN READ SEPARATELY, BECAUSE
 * 0008 SAYS THE TWO POLICIES MUST NARROW IDENTICALLY AND STATES THE FAIL-OPEN:
 * *"a grant could be found with its resource lines hidden and the three-list
 * check would silently pass over a `statutory` claim."* One statement, one
 * snapshot, one visibility decision — a `LEFT JOIN` so that a grant whose lines
 * are genuinely absent arrives with `resources: []` and is REFUSED by the
 * three-list loop rather than silently skipped by it.
 *
 * ⚠️ `justification`, `approved_by_staff_user_id` AND THE OTHER NINE FIELDS OF
 * `TenantAccessGrant` ARE NOT SELECTED AND HAVE NO COLUMNS TO SELECT.
 * `StaffGrantTerms` (`model/access.ts` §7a) is the narrowed type this produces
 * and carries the whole argument; the short version is that a reader forced to
 * produce a `TenantAccessGrant` would fabricate eleven fields — including a
 * customer-visible `justification` — in order to have eight read back out.
 */
export const STAFF_GRANT_READ = `
  SELECT g.id,
         g.purpose,
         g.staff_user_id,
         g.tenant_id,
         g.granted_at,
         g.expires_at,
         g.revoked_at,
         r.resource
    FROM tenant.tenant_access_grant g
    LEFT JOIN tenant.access_resource_grant r
      ON r.tenant_id = g.tenant_id AND r.grant_id = g.id
`

/**
 * ⚠️ CLASSIFIED AND NEVER CAST, for `partnerScope()`'s reason: *"an id is data,
 * a discriminant is a decision."* `AccessPurpose` has no `const` object beside
 * it, so the two members are read off `MAX_GRANT_HOURS`, which is a
 * `Record<AccessPurpose, number>` — its KEY SET IS the union, so a third
 * purpose is admitted the instant the model declares one and there is nothing
 * here to forget. A hand-written pair would be the copy that drifts.
 *
 * 🛑 AND A PURPOSE THIS READER CANNOT CLASSIFY IS `null`, WHICH BECOMES A
 * REFUSAL RATHER THAN A DEFAULT. `selectTenantForSession()` already refuses a
 * grant whose purpose does not index `MAX_GRANT_HOURS` — *"a grant it cannot
 * read is a grant it refuses"* — so this is the same decision taken one layer
 * earlier and by name, rather than relying on an index returning `undefined`.
 */
function accessPurpose(value: unknown): AccessPurpose | null {
  const members = Object.keys(MAX_GRANT_HOURS) as readonly AccessPurpose[]
  return members.find((m) => m === value) ?? null
}

/**
 * ⚠️ CLASSIFIED AGAINST `ACCESS_RESOURCE_CLASSES` FOR THE SAME REASON, AND THE
 * DIRECTION OF THE FAILURE IS THE POINT. A resource line naming a class the
 * model does not declare must not be DROPPED — dropping it would hand
 * `authorisationPermits()` a shorter list and the grant would pass the
 * three-list check it should have failed. It refuses the whole grant instead,
 * which is `evaluateTenantAccess()`'s rule quoted: *"A grant naming a class the
 * contract does not open fails whole … the grant is the unit someone
 * approved."*
 */
function accessResourceClass(value: unknown): AccessResourceClass | null {
  const members = Object.values(ACCESS_RESOURCE_CLASSES) as readonly AccessResourceClass[]
  return members.find((m) => m === value) ?? null
}

export type StaffGrantOutcome =
  | { readonly ok: true; readonly grant: HeldStaffGrant | null }
  | { readonly ok: false; readonly refusal: SubstrateRefusal }

/**
 * The one `TenantAccessGrant` offered for this principal and this host, in the
 * terms the staff arm reads — or `null`, which is a FACT and not an absence.
 *
 * 🛑 `{ ok: true, grant: null }` IS *"A READER RAN AND THIS TENANT HAS NO GRANT
 * THIS CALLER COULD BE ADMITTED ON"*, AND `{ ok: false }` IS *"WE COULD NOT
 * TELL"* — `readPartnerGrant()`'s distinction, and it matters here in the same
 * one direction: a failed read arriving as `grant: null` would be served as
 * `membership_absent`, **a fact about our substrate reported as a fact about
 * whether anybody ever granted this person access.**
 *
 * 🛑 IT IS SINGULAR, AND THE SINGULARITY IS THE MODEL'S RULE RATHER THAN THIS
 * READER'S CONVENIENCE. `TenantSelectionInput.staffGrant` is one grant *"for
 * `hostBoundTenantId`'s REASON and not a weaker one: a `readonly
 * TenantAccessGrant[]` would be a menu, and a menu of grants is the selector
 * G210 dropped wearing staff clothing."* **So a caller holding TWO live grants
 * into one tenant is a shape this reader must not resolve by choosing.** It
 * refuses — `staffGrantNotUnique` — because picking one would be a reader
 * deciding which authority a person presents, and `readPartnerGrant()` refuses
 * the identical shape for the identical reason.
 *
 * ⚠️ THE CALLER IS NARROWED BY THE READER AND NOT BY THE STATEMENT, WHICH IS
 * THE ONE PLACE THIS FUNCTION DOES FILTER AND IT IS ARGUED. `staffUserId` is a
 * parameter and rows for other staff are discarded HERE rather than in SQL,
 * for the reason `readMemberships()` states about its own bind: it is an INDEX
 * HINT and not a control. The control is
 * `staffGrant.staffUserId !== session.userId` inside
 * `selectTenantForSession()`, which still runs and still sees the value this
 * returns. **Filtering in the reader keeps the uniqueness question — "does this
 * PERSON hold more than one grant here" — answerable at all**, which a
 * statement-level `WHERE` would also have done and a model-level check could
 * not, because the model is handed one grant by construction.
 *
 * Runs inside a scope carrying `app.tenant_id`, in the SAME transaction as
 * whatever else the caller reads, so a grant revoked between two reads cannot
 * produce a mixed view of one principal.
 */
export async function readStaffGrant(
  tx: ScopedClient,
  staffUserId: string,
): Promise<StaffGrantOutcome> {
  const rows = (await tx.query(STAFF_GRANT_READ)).rows as Array<Record<string, unknown>>

  const mine = rows.filter((r) => String(r['staff_user_id']) === staffUserId)
  if (mine.length === 0) return { ok: true, grant: null }

  const ids = new Set(mine.map((r) => String(r['id'])))
  if (ids.size > 1) return { ok: false, refusal: SUBSTRATE_REFUSALS.staffGrantNotUnique }

  const head = mine[0] as Record<string, unknown>
  const purpose = accessPurpose(head['purpose'])
  if (purpose === null) return { ok: false, refusal: SUBSTRATE_REFUSALS.valueUnrecognised }

  /**
   * ⚠️ A `LEFT JOIN` WITH NO LINES YIELDS ONE ROW WHOSE `resource` IS NULL, AND
   * THAT IS `resources: []` RATHER THAN A LINE NOBODY WROTE. The three-list
   * loop then runs zero times and the grant proceeds to the liveness terms —
   * which is correct and is 0008's own shape: `access_resource_grant` is a
   * separate table and a grant with no lines reaches no class. It is not a
   * refusal here, because refusing it would be this reader deciding a question
   * `authorisationPermits()` is not asked.
   */
  const resources: { readonly resource: AccessResourceClass }[] = []
  for (const row of mine) {
    const raw = row['resource']
    if (raw === null || raw === undefined) continue
    const resource = accessResourceClass(raw)
    if (resource === null) {
      return { ok: false, refusal: SUBSTRATE_REFUSALS.valueUnrecognised }
    }
    resources.push({ resource })
  }

  /**
   * 🛑 `extensions` IS `[]` AND IT IS A FACT ABOUT THE SCHEMA RATHER THAN A
   * PLACEHOLDER. `db/migrations/0008` ships no extension table, and
   * `selectTenantForSession()` names the consequence itself: *"in the database
   * a grant's `expires_at` IS its effective expiry … The two halves therefore
   * agree on every state the database can represent, and the commit that adds
   * an `access_extension` table owes the `greatest(…)` term."* **That commit
   * owes this line too**, and `tests/db/console-session.test.ts` §6 asserts the
   * emptiness so it cannot be left behind quietly.
   */
  return {
    ok: true,
    grant: {
      /**
       * G2591: the grant's own id, because `decide()`'s staff-grant branch
       * names it in `via` and invariant 10's record must say which grant an
       * act ran under. Selection ignores it.
       */
      id: String(head['id']),
      purpose,
      staffUserId: String(head['staff_user_id']),
      tenantId: String(head['tenant_id']),
      grantedAt: iso(head['granted_at']),
      expiresAt: iso(head['expires_at']),
      revokedAt: isoOrNull(head['revoked_at']),
      resources,
      extensions: [],
    } as unknown as HeldStaffGrant,
  }
}

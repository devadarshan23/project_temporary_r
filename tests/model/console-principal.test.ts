/**
 * A PRINCIPAL WITH NO TENANT — G727, G728, G729, 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SUITE IS FOR, AND THE SENTENCE IT IS WRITTEN AGAINST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The owner ruled that the data plane serves the console hosts **with
 * tenant-less sessions** — *"`session.tenant_id = NULL` is legal"* — and named
 * the cost: *"a tenant-less session is a new shape in the one place [G179 and
 * G180] are enforced."* `tests/model/console-host.test.ts` covers the HOST
 * half. This file covers the PRINCIPAL half, and it asks one question in four
 * places:
 *
 *   **when a principal has no tenant, does every arm that needs one refuse it
 *   BY NAME, and does the one arm that does not need one still work?**
 *
 * 🛑 THE FAILURE THIS SUITE EXISTS TO CATCH IS NOT AN ALLOW. It is a REFUSAL
 * WITH THE WRONG REASON. Delete `principal_holds_no_tenant` and the customer
 * loop answers anyway — `role.tenantId !== null` is true for every row, so
 * every assignment lands on `tenant_mismatch` and the caller is still refused.
 * **The suite would stay green on outcomes and the audit trail would say *the
 * role is in the wrong tenant* about a caller who has none.** §5.1: a guard
 * that is correct only because a later comparison happens to fail closed.
 * §2b is the assertion that separates them.
 *
 * ✅ **§3 CHANGED SIGN ON 19 Sep 2026 — G730, THE OWNER'S RULING.** It used
 * to pin `authorize()` REFUSING an allowed console principal, and its own
 * message demanded that the commit which closed the gap *"delete an assertion
 * and argue for it."* This is that commit; the old test is quoted in full
 * inside the new one rather than erased, and §3c is what keeps the half of
 * its argument that survives — **a nullable `tenantId` is still refused.**
 *
 * ⚠️ MUTATIONS RUN ARE RECORDED AT THE FOOT OF THE FILE.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  DENY_ALL,
  DECISION_REASONS,
  MAX_AUTHORIZATION_SECONDS,
  SESSION_REFUSALS,
  authorize,
  decide,
  resolveSubject,
} from '../../model/access.ts'
import type {
  HeldAssignment,
  HeldPlatformAssignment,
  PlatformRole,
  PlatformRoleAssignment,
  PrincipalContext,
  Role,
  RoleAssignment,
} from '../../model/access.ts'
import type { IdentityConnection, Session, User } from '../../model/domain.ts'
import type {
  AuthorizationGrantId,
  IdentityConnectionId,
  RoleAssignmentId,
  RoleId,
  TenantId,
  Timestamp,
  UserId,
} from '../../model/kernel.ts'

const NOW = '2026-09-19T12:00:00.000Z' as Timestamp
const LATER = '2026-09-20T12:00:00.000Z' as Timestamp
const MEI = 'usr_ops_mei' as UserId
const ACME = 'ten_acme' as TenantId
const DOOR = 'idc_platform_entra' as IdentityConnectionId

/* ------------------------------------------------------------------ *
 * Fixtures — a platform door, a person, and a session with no tenant
 * ------------------------------------------------------------------ */

const platformDoor = {
  id: DOOR,
  protocol: 'oidc',
  label: 'Platform Entra',
  owner: { kind: 'platform' },
  domains: [],
  federation: null,
  status: 'active',
} as unknown as IdentityConnection

const livePerson = {
  id: MEI,
  email: 'mei@1cloudhub.invalid',
  displayName: 'Mei Tan',
  status: 'active',
  connectionId: DOOR,
} as unknown as User

/** The console session: live in every respect, and bound to no tenant. */
const unbound = {
  id: 'ses_console',
  handleDigest: 'digest',
  userId: MEI,
  connectionId: DOOR,
  tenantId: null,
  issuedHost: 'console.reconcile.invalid',
  authenticatedAt: NOW,
  secondFactorAt: null,
  lastUsedAt: NOW,
  expiresAt: LATER,
  revokedAt: null,
} as unknown as Session

const bound = { ...unbound, tenantId: ACME } as unknown as Session

/* ------------------------------------------------------------------ *
 * 1. `resolveSubject()` — the surface decides, and it is not derived
 * ------------------------------------------------------------------ */

test('test_1a_a_live_unbound_session_on_a_CONSOLE_host_resolves_a_subject', () => {
  const out = resolveSubject({
    session: unbound,
    user: livePerson,
    connection: platformDoor,
    now: NOW,
    surface: 'console',
  })
  assert.equal(
    out.ok,
    true,
    'THE OWNER RULED THAT A TENANT-LESS SESSION IS LEGAL ON A CONSOLE HOST. Before ' +
      'G727 this same row answered `tenant_not_selected` and carried no authority at ' +
      'all, which is what made the staff console unbuildable.',
  )
  if (!out.ok) return
  assert.equal(out.subject.surface, 'console')
  assert.equal(out.subject.userId, MEI)
  assert.equal(out.subject.orgClass, 'platform')
  assert.equal(out.subject.partnerId, null)
})

test('test_1b_the_SAME_row_on_a_TENANT_host_is_still_tenant_not_selected', () => {
  /**
   * 🛑 THE DIFFERENTIAL THAT SAYS THE SURFACE IS READ. One fixture, two
   * surfaces, two answers. If `resolveSubject()` derived the surface from
   * `session.tenantId` — *"unbound therefore console"* — this assertion is
   * the one that dies, and with it `tenant_not_selected` for every caller
   * standing in front of D1.
   */
  const out = resolveSubject({
    session: unbound,
    user: livePerson,
    connection: platformDoor,
    now: NOW,
    surface: 'tenant',
  })
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, SESSION_REFUSALS.tenantNotSelected)
})

test('test_1c_a_TENANT_BOUND_session_presented_on_a_console_host_is_refused', () => {
  const out = resolveSubject({
    session: bound,
    user: livePerson,
    connection: platformDoor,
    now: NOW,
    surface: 'console',
  })
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(
    out.refusal,
    SESSION_REFUSALS.consoleSessionIsTenantBound,
    'A session carrying tenant scope must not be usable on a surface that has none. ' +
      'Nothing in `server/` can produce this row — D1 resolves the tenant from the HOST ' +
      'and refuses on a console host before any write — so the reachable producer is a ' +
      'migrator INSERT, and `tests/db/console-session.test.ts` §3 builds one.',
  )
})

test('test_1d_the_surface_arm_is_LAST_a_revoked_console_session_is_refused_as_revoked', () => {
  /**
   * 🛑 `tenant_not_selected`'s OWN ORDERING ARGUMENT, INHERITED. That arm is
   * last *"because the defect this function replaces answered
   * `tenant_not_selected` for a session that had been revoked"*. The console
   * arm sits beside it and inherits the property for free — this assertion is
   * what says so rather than assuming it.
   */
  const out = resolveSubject({
    session: { ...bound, revokedAt: NOW } as unknown as Session,
    user: livePerson,
    connection: platformDoor,
    now: NOW,
    surface: 'console',
  })
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(
    out.refusal,
    SESSION_REFUSALS.sessionRevoked,
    'A REVOKED session was reported as a console-shape defect. The surface arm must sit ' +
      'BELOW every liveness check, or the newest arm reintroduces the exact defect the ' +
      'oldest one was ordered to prevent.',
  )
})

test('test_1e_a_disabled_person_on_a_console_host_is_refused_as_disabled', () => {
  const out = resolveSubject({
    session: unbound,
    user: { ...livePerson, status: 'disabled' } as unknown as User,
    connection: platformDoor,
    now: NOW,
    surface: 'console',
  })
  assert.equal(out.ok, false)
  if (out.ok) return
  assert.equal(out.refusal, SESSION_REFUSALS.userDisabled)
})

/* ------------------------------------------------------------------ *
 * 2. `decide()` — the platform arm answers, every other arm refuses
 * ------------------------------------------------------------------ */

const platformRole = {
  id: 'prl_commercial',
  name: 'Commercial',
  version: 1,
  capabilities: [CAPABILITIES.viewCommercial],
  status: 'active',
} as unknown as PlatformRole

const platformAssignment = {
  id: 'pra_mei',
  userId: MEI,
  roleId: platformRole.id,
  roleVersion: 1,
  grantedAt: NOW,
  expiresAt: LATER,
  revokedAt: null,
} as unknown as PlatformRoleAssignment

const platformHeld: readonly HeldPlatformAssignment[] = [
  { role: platformRole, assignment: platformAssignment } as unknown as HeldPlatformAssignment,
]

/** A console principal: no tenant, no tenant-scoped reader, a platform roster. */
const consolePrincipal: PrincipalContext = {
  subject: { userId: MEI, status: 'active' },
  tenantId: null,
  orgClass: 'platform',
  partnerId: null,
  partnerGrant: null,
  held: null,
  platformHeld,
  now: NOW,
}

test('test_2a_a_PLATFORM_console_principal_is_ALLOWED_on_a_verb_its_arm_reaches', () => {
  /**
   * 🛑 THE ALLOW ARM, AND WITHOUT IT THIS WHOLE SLICE IS A CONTROL WHOSE ONLY
   * OBSERVABLE BEHAVIOUR IS REFUSAL — §5.6. `commercial` is the one resource
   * class `PLATFORM_ASSIGNMENT_REACHES` opened before G601 and one of the
   * three it opens now, and `decide()`'s platform arm reads no tenant at all:
   * *"THERE IS NO TENANT PAIRING CHECK HERE AND ITS ABSENCE IS THE POINT."*
   * **That absence is what makes the owner's ruling buildable, and it was
   * written for a different reason two slices earlier.**
   */
  const out = decide(consolePrincipal, CAPABILITIES.viewCommercial)
  assert.equal(
    out.allowed,
    true,
    'A PLATFORM PRINCIPAL WITH NO TENANT WAS REFUSED. The platform arm compares no ' +
      'tenant — neither `PlatformRole` nor `PlatformRoleAssignment` extends ' +
      '`TenantScoped` — so widening `PrincipalContext.tenantId` reaches a branch that ' +
      'was already tenant-free.',
  )
  assert.equal(out.reason, DECISION_REASONS.permitted)
  assert.deepEqual(
    out.scope,
    DENY_ALL,
    'A platform allow is a VERB and never a DIMENSION — `decide()` returns `DENY_ALL` ' +
      'on this arm deliberately, because every dimension of `AssignmentScope` narrows ' +
      'TENANT BUSINESS DATA and *"a caller that ignores the boolean and applies the ' +
      'scope still denies."* A tenant-less principal must not be the caller that finds ' +
      'an exception to it.',
  )
})

test('test_2b_a_CUSTOMER_console_principal_is_refused_BY_NAME_and_not_as_a_tenant_mismatch', () => {
  /**
   * 🛑 THE ASSERTION THE WHOLE FILE TURNS ON. Delete
   * `principal_holds_no_tenant` and this caller is STILL REFUSED — the
   * customer loop compares `role.tenantId !== principal.tenantId`, which is
   * true against `null` for every row, so the answer becomes
   * `tenant_mismatch`. **Same status code, same denial, wrong sentence in the
   * audit trail**: *the role is in the wrong tenant* about a caller who has
   * none.
   */
  const role = {
    id: 'rol_ap' as RoleId,
    tenantId: ACME,
    name: 'AP Approver',
    version: 1,
    capabilities: [CAPABILITIES.viewException],
    status: 'active',
  } as unknown as Role
  const assignment = {
    id: 'ras_mei' as RoleAssignmentId,
    tenantId: ACME,
    userId: MEI,
    roleId: role.id,
    roleVersion: 1,
    scope: {},
    grantedAt: NOW,
    expiresAt: LATER,
    revokedAt: null,
  } as unknown as RoleAssignment
  const held: readonly HeldAssignment[] = [{ role, assignment } as unknown as HeldAssignment]

  const out = decide(
    { ...consolePrincipal, orgClass: 'customer', platformHeld: null, held },
    CAPABILITIES.viewException,
  )
  assert.equal(out.allowed, false)
  assert.equal(
    out.reason,
    DECISION_REASONS.principal_holds_no_tenant,
    'A TENANT-LESS CUSTOMER PRINCIPAL WAS REFUSED FOR THE WRONG REASON. If this reads ' +
      '`tenant_mismatch`, the guard has been deleted and the assignment loop is ' +
      'answering — which refuses correctly and reports a fact about the ROLE when the ' +
      'fact is about the SURFACE. That is §5.1 and it is invisible from a status code.',
  )
})

test('test_2c_a_PARTNER_console_principal_is_refused_before_its_grant_is_read', () => {
  /**
   * ⚠️ THE ORDERING CLAIM. The tenant guard sits ABOVE the partner arm, so a
   * partner on a console host does not get `partner_grant_absent` — which
   * would be true and misleading, since a `PartnerAccessGrant` is per CUSTOMER
   * TENANT and there is no tenant here for one to be into.
   */
  const out = decide(
    { ...consolePrincipal, orgClass: 'partner', partnerId: null, platformHeld: null },
    CAPABILITIES.viewException,
  )
  assert.equal(out.allowed, false)
  assert.equal(out.reason, DECISION_REASONS.principal_holds_no_tenant)
})

test('test_2d_a_platform_only_VERB_answers_before_the_surface_does', () => {
  /**
   * ⚠️ THE OTHER ORDERING CLAIM, AND IT GOES THE OTHER WAY. 2e's verb check
   * sits ABOVE the tenant guard, for its own stated reason: a platform-only
   * verb asked by a tenant-less customer principal is refused because the VERB
   * was never theirs, which is true on every surface and is the stronger
   * statement.
   */
  const out = decide(
    { ...consolePrincipal, orgClass: 'customer', platformHeld: null, held: [] },
    CAPABILITIES.publishCatalogue,
  )
  assert.equal(out.allowed, false)
  assert.equal(out.reason, DECISION_REASONS.capability_is_platform_only)
})

test('test_2e_the_platform_arm_still_refuses_a_class_it_does_not_reach', () => {
  const out = decide(consolePrincipal, CAPABILITIES.admitSource)
  assert.equal(out.allowed, false)
  assert.equal(
    out.reason,
    DECISION_REASONS.platform_class_out_of_reach,
    'INVARIANT 8 IS UNCHANGED BY THE CONSOLE SURFACE. `tenant_data` is `false` in ' +
      '`PLATFORM_ASSIGNMENT_REACHES` and a tenant-less principal must not be the caller ' +
      'that finds a way past it.',
  )
})

test('test_2f_held_null_on_a_TENANT_principal_is_assignments_unreadable_and_not_no_live_assignment', () => {
  /**
   * 🛑 THE THIRD STATE, WITNESSED THE WAY `tests/model/platform-arm.test.ts`
   * witnesses `platformHeld`'s ABSENT state — by building the context
   * directly. `[]` DENIES with `no_live_assignment` (a fact about a person);
   * `null` REFUSES with this (a fact about our substrate).
   * `server/data-plane/authorise.ts` forbids collapsing them in capitals, and
   * until G728 `PrincipalContext` could not express the second at all.
   */
  const unreadable = decide(
    { ...consolePrincipal, tenantId: ACME, orgClass: 'customer', platformHeld: null, held: null },
    CAPABILITIES.viewException,
  )
  assert.equal(unreadable.reason, DECISION_REASONS.assignments_unreadable)

  const empty = decide(
    { ...consolePrincipal, tenantId: ACME, orgClass: 'customer', platformHeld: null, held: [] },
    CAPABILITIES.viewException,
  )
  assert.equal(
    empty.reason,
    DECISION_REASONS.no_live_assignment,
    'THE TWO STATES COLLAPSED. "An empty array means a reader ran and found no ' +
      'assignments; `null` means there is no reader at all … only one of those is a fact."',
  )
})

/* ------------------------------------------------------------------ *
 * 3. `authorize()` — allowed, and RECORDABLE SINCE G730
 * ------------------------------------------------------------------ */

test('test_3_an_ALLOWED_console_principal_MINTS_into_invariant_10s_second_home', () => {
  /**
   * ✅ **THE FINDING §3 USED TO PIN IS CLOSED — G730, 19 Sep 2026, THE
   * OWNER'S RULING — AND THIS IS THE COMMIT THAT DELETED THE ASSERTION.**
   *
   * 🛑 THE OLD TEST AND ITS ARGUMENT ARE QUOTED IN FULL RATHER THAN ERASED,
   * because the old test asked for exactly this and the argument it asked
   * for is the thing a later reader will want:
   *
   *     `test_3_an_ALLOWED_console_principal_mints_NOTHING_because_invariant_10_has_no_home`
   *     assert.equal(out.grant, null,
   *       'A TENANT-LESS ACT MINTED AN `AuthorizationGrant`. Invariant 10 has
   *        no home for one: the grant extends `TenantScoped` and its table is
   *        keyed on `app.tenant_id`. **If this now returns a grant, somebody
   *        has decided where a tenant-less record lives — which is a ruling,
   *        and it owes this assertion an argument.**')
   *     assert.equal(out.decision.reason,
   *                  DECISION_REASONS.principal_holds_no_tenant)
   *
   * **THE ARGUMENT IT IS OWED, IN THE OWNER'S OWN WORDS:** a
   * `platform_authorization_grant` table, *"policy keyed on the acting
   * session rather than on a tenant — `0009` already does exactly this for
   * the five tables read BEFORE a tenant is selected. Same argument, same
   * shape."* **Invariant 10 keeps one meaning with two homes, and each home
   * has a scope that can actually read it.**
   *
   * ⚠️ AND THE HALF OF THE OLD ARGUMENT THAT SURVIVES UNTOUCHED: **a nullable
   * `tenantId` is still refused.** Under G100's deny-on-NULL such a row is
   * visible to no scope — *"a result nobody may read is not persistence"*
   * applied to the audit trail. What landed is a SECOND TYPE whose record
   * lives in a SECOND TABLE, not a widened first one; §3c is the assertion
   * that keeps the two apart.
   *
   * 🛑 `principal_holds_no_tenant` IS NOT GONE FROM THE MODEL. It is still
   * `decide()`'s 2f answer for every arm but the platform one, and §2c and
   * §2d above are what keep it reachable. This test asserts only that
   * `authorize()` no longer adds a SECOND refusal on top of an ALLOW.
   */
  const request = {
    id: 'aug_1' as AuthorizationGrantId,
    resource: { resourceClass: 'commercial' },
    ttlSeconds: 60,
  } as unknown as Parameters<typeof authorize>[2]

  assert.ok(
    MAX_AUTHORIZATION_SECONDS.commercial >= 60,
    'the fixture ttl must be inside the ceiling, or this assertion passes for the wrong ' +
      'reason — `authorization_ttl_out_of_bounds` instead of the arm it is about.',
  )

  const out = authorize(consolePrincipal, CAPABILITIES.viewCommercial, request)
  assert.notEqual(
    out.grant,
    null,
    'A TENANT-LESS ACT MINTED NOTHING. G730 gave invariant 10 a second home and G301 makes ' +
      'minting a PRECONDITION OF MOUNTING, so a console operation that cannot mint cannot ' +
      'boot. If this is red, the ruling has been reverted rather than a fixture broken.',
  )
  assert.equal(
    out.grant?.home,
    'platform',
    'the record was routed to the TENANT home. There is no tenant on this principal, so ' +
      'that row would be keyed on `app.tenant_id` and visible to no scope.',
  )
  assert.equal(out.decision.reason, DECISION_REASONS.permitted)
  assert.equal(out.grant?.subjectUserId, MEI)
  assert.equal(out.grant?.orgClass, 'platform')
  assert.equal(out.grant?.capability, CAPABILITIES.viewCommercial)
})

test('test_3b_and_a_TENANT_principal_on_the_same_path_still_mints_in_the_TENANT_home', () => {
  /**
   * ⚠️ THE DIFFERENTIAL. It was the anti-vacuous half when §3 asserted a
   * refusal — *"without it §3 would pass on a broken `authorize()` that
   * minted nothing for anybody"* — and it is a stronger thing now: §3 and
   * §3b differ in ONE field of the principal and land in TWO DIFFERENT
   * TABLES. Collapse the two homes and one of them goes red.
   */
  const request = {
    id: 'aug_2' as AuthorizationGrantId,
    resource: { resourceClass: 'commercial' },
    ttlSeconds: 60,
  } as unknown as Parameters<typeof authorize>[2]

  const out = authorize(
    { ...consolePrincipal, tenantId: ACME },
    CAPABILITIES.viewCommercial,
    request,
  )
  assert.notEqual(out.grant, null)
  assert.equal(out.grant?.home, 'tenant')
  /* The narrowing is the assertion: `tenantId` does not exist on the platform
   * arm of the union, so this line does not COMPILE unless `home` is read
   * first. G730's discriminant, biting in a test. */
  assert.equal(out.grant?.home === 'tenant' ? out.grant.tenantId : null, ACME)
})

test('test_3c_the_PLATFORM_home_carries_no_tenant_field_at_all', () => {
  /**
   * 🛑 THE ASSERTION THAT KEEPS G728's REFUSAL ALIVE INSIDE G730's RULING.
   * The repair G728 refused was *"a nullable `tenantId` on the grant"*, and
   * the way to take it accidentally is to widen `AuthorizationGrant` and call
   * it two homes. A field that is present and `null` would compile, would
   * reach `writeAuthorisationRecord()`, and would be refused only by the
   * database — *"unrepresentable rather than merely unlikely"* is the
   * property this file is asserting instead.
   */
  const request = {
    id: 'aug_3' as AuthorizationGrantId,
    resource: { resourceClass: 'commercial' },
    ttlSeconds: 60,
  } as unknown as Parameters<typeof authorize>[2]

  const out = authorize(consolePrincipal, CAPABILITIES.viewCommercial, request)
  assert.ok(out.grant !== null)
  assert.equal(
    Object.prototype.hasOwnProperty.call(out.grant, 'tenantId'),
    false,
    'the platform home carries a `tenantId` key. Even as `null` that is the repair G728 ' +
      'refused: `TenantScoped` is what `authorization_grant_rls` is written against, and a ' +
      'grant that can carry a null there is one that can be written into a table where no ' +
      'scope will ever read it.',
  )
})

/* ==================================================================== *
 * MUTATIONS RUN, AND WHAT EACH CAUGHT
 * --------------------------------------------------------------------
 * `tsc -p model/tsconfig.json` was GREEN under M1 and M3.
 *
 *   M1  🛑 THE ONE §2b EXISTS FOR. Delete the
 *       `principal.tenantId === null` guard from `decide()`.
 *       → `tsc` RED first, at the assignment loop, because `held` cannot be
 *          iterated without the narrowing beside it — so the honest mutation
 *          is the guard replaced by `if (principal.tenantId === null &&
 *          false)`, which compiles. Then 2 red: `test_2b…` and `test_2c…`,
 *          both on the REASON and neither on the outcome. **Every caller is
 *          still refused under the mutant**, which is the whole point: a
 *          suite asserting only `allowed === false` would have been green.
 *
 *   M2  Move the tenant guard ABOVE the platform arm — the tidier-looking
 *       placement, and the one that makes the owner's ruling inert.
 *       → 3 red, and the PREDICTION WRITTEN HERE BEFORE THE RUN SAID ONE.
 *          `test_2a…` (the ALLOW arm) was expected; `test_2d…` and `test_2e…`
 *          were not, and they are the more interesting pair — both are
 *          REFUSALS that the mutant answers with a DIFFERENT refusal, because
 *          a guard moved to the top shadows the verb check and the class
 *          check as well as the allow. **Three arms lose their reason and
 *          none loses its outcome**, which is the same shape §2b is about.
 *          Recorded as refuted rather than quietly corrected. G60's shape —
 *          *"recorded as applied, with the FDE still unable to bind a
 *          credential"* — caught three ways.
 *
 *   M3  `resolveSubject()`'s console arm collapsed to
 *       `if (surface === console && tenantId === null)`, so a BOUND session
 *       on a console host falls through to the tenant arm instead of being
 *       refused.
 *       → 1 red: `test_1c…`, and only that one. **The prediction said TWO**
 *          (`test_1a…` and `test_1b…`) and both stay green, because the
 *          mutant still reads the surface for an unbound session — which is
 *          worth knowing: the differential in §1a/§1b proves the parameter is
 *          READ, and §1c is the only thing proving what it is read FOR.
 *          Under the mutant that bound session resolves as a TENANT subject
 *          carrying `ten_acme`, on a host that serves no tenant at all.
 *
 *   M4  `authorize()`'s tenant guard deleted.
 *       → `tsc` RED — `tenantId: TenantId | null` is not assignable to
 *          `AuthorizationGrant.tenantId`. **The compiler is the control here
 *          and the test is the explanation**, which is recorded rather than
 *          claimed as a runtime catch; §3 is what states WHY the compiler
 *          error must not be silenced with a cast.
 *
 *   ----- ADDED 19 Sep 2026 WITH G730, FOR THE THREE TESTS IN §3 -----
 *
 *   M5  `authorize()`'s platform mint reverted to
 *       `return refuse(DECISION_REASONS.principal_holds_no_tenant)` — the
 *       state of the tree before G730.
 *       → 2 red: `test_3…MINTS_into_invariant_10s_second_home` and
 *          `test_3c…carries_no_tenant_field_at_all`. `test_3b…` stays
 *          green, correctly: the TENANT home is untouched by the mutation,
 *          which is the differential doing its job.
 *
 *   M6  `tenantId: null` added to the platform grant literal — the repair
 *       G728 refused, taken accidentally.
 *       → `tsc -p model/tsconfig.json` RED: **TS2353, "Object literal may
 *          only specify known properties, and 'tenantId' does not exist in
 *          type 'PlatformAuthorizationGrant'"**, at `model/access.ts`. **The
 *          compiler is the control here and §3c is the explanation**, which
 *          is the same shape M4 above records for G728's own guard — and
 *          §3c is what states why that error must not be silenced with a
 *          cast. Recorded as a compiler catch rather than claimed as a
 *          runtime one.
 * ==================================================================== */

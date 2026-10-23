/**
 * G289 — `decide()`'s FOURTH `OrgClass` ARM, AND THE DIFFERENTIAL THAT MAKES IT
 * MEAN ANYTHING.
 *
 * 🛑 WHY THE ALLOW ARM IS THE FIRST ASSERTION IN THIS FILE AND NOT THE LAST.
 * Until 19 Sep 2026 `decide()` refused EVERY platform principal at step two,
 * before any capability was read. A new arm that refuses every platform
 * principal for eleven new reasons is behaviourally indistinguishable from the
 * one line it replaced — *"a control whose only observable behaviour is refusal
 * is `docs/HANDOFF.md` §5.6 until something witnesses it deciding"*, which is
 * the sentence `tests/http/capability-decide.test.ts` was written around. So
 * assertion 1 permits, and every assertion after it removes exactly ONE term
 * from the request assertion 1 permits and requires a refusal BY NAME.
 *
 * ⚠️ WHAT A GREEN RUN HERE DOES NOT PROVE, AND IT IS MOST OF WHAT MATTERS.
 * **Nothing in this repository produces a `PlatformRoleAssignment`.** There is
 * no `platform_role` table, no `platform_role_assignment` table and no seed;
 * every holding below is a fixture typed into this file. This proves the
 * MECHANISM decides. It proves nothing about anybody holding a platform role.
 * `PrincipalContext.platformHeld` is absent in every serving path, and absence
 * is `platform_assignment_unreadable` — assertion 2a.
 *
 * ⚠️ AND ONE NOTE ON EXPECTED VALUES. Every expected reason below is a string
 * LITERAL typed into this file, for `tests/model/access-decide.test.ts`'s
 * reason: `assert.equal(DECISION_REASONS.x, DECISION_REASONS.x)` passes forever
 * and witnesses nothing. The constants appear only as PINS, on their own line,
 * so that renaming a key is a failure rather than a silent agreement.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  AGENTS_HOLD_ROLES,
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  DECISION_REASONS,
  DENY_ALL,
  ORG_CLASSES,
  PLATFORM_ASSIGNMENT_REACHES,
  SOLUTION_IS_GRANTABLE,
  UNSCOPED,
  canGrant,
  decide,
  type Capability,
  type HeldPlatformAssignment,
  type PlatformRole,
  type PlatformRoleAssignment,
  type PrincipalContext,
  type Role,
} from '../../model/access.ts'
import {
  ACCESS_RESOURCE_CLASSES,
  CONTRACT_ONLY_RESOURCES,
  NON_DELEGABLE_RESOURCES,
  type AccessResourceClass,
} from '../../model/governance.ts'

type UserId = PrincipalContext['subject']['userId']
type TenantId = PrincipalContext['tenantId']
type Timestamp = PrincipalContext['now']
type RoleId = PlatformRole['id']
type PlatformRoleAssignmentId = PlatformRoleAssignment['id']

const STAFF = 'usr_1ch_priya' as UserId
const NOW = '2026-09-19T00:00:00.000Z' as Timestamp
/**
 * ⚠️ A TENANT ID IS PRESENT AND IS NEVER READ BY THIS ARM, WHICH IS A FINDING
 * RATHER THAN A FIXTURE DETAIL. `PrincipalContext.tenantId` is `TenantId`,
 * non-null, so every call to the single evaluator names a tenant — including a
 * staff act that addresses none. `docs/contracts/administration.openapi.yaml`
 * names the same shape: *"most of what is below addresses no tenant at all."*
 * Neither `PlatformRole` nor `PlatformRoleAssignment` carries a tenant, so
 * nothing on this arm can compare one; the field is inert here, not honoured.
 */
const TENANT = 'ten_acme' as TenantId

/** The one capability whose class this arm admits. Named, never counted. */
const THE_REACHABLE_CAPABILITY: Capability = CAPABILITIES.viewCommercial

function platformRole(
  capabilities: readonly Capability[],
  overrides: Partial<PlatformRole> = {},
): PlatformRole {
  return {
    id: 'prl_commercial' as unknown as RoleId,
    label: 'Commercial',
    key: 'commercial',
    version: 4,
    stakeholderClass: 'administrator',
    capabilities,
    status: 'active',
    ...overrides,
  }
}

/**
 * A live platform assignment pinned to a live platform role.
 *
 * ⚠️ `roleVersion` MATCHES `version` DELIBERATELY, and `expiresAt` is in the
 * FUTURE relative to `NOW`. A fixture that got either wrong would refuse for a
 * reason that has nothing to do with the term under test, and the allow arm
 * would never go green however correctly the arm was written.
 */
function platformHolding(
  capabilities: readonly Capability[] = [THE_REACHABLE_CAPABILITY],
  roleOverrides: Partial<PlatformRole> = {},
  assignmentOverrides: Partial<PlatformRoleAssignment> = {},
): HeldPlatformAssignment {
  const role = platformRole(capabilities, roleOverrides)
  const assignment: PlatformRoleAssignment = {
    id: 'pra_priya_commercial' as unknown as PlatformRoleAssignmentId,
    userId: STAFF,
    roleId: role.id,
    roleVersion: 4,
    grantedBy: 'usr_1ch_owner' as UserId,
    grantedAt: '2026-09-01T00:00:00.000Z' as Timestamp,
    /** NOT NULLABLE — `DURABLE_ASSIGNMENT_PERMITTED.platform` made unwritable. */
    expiresAt: '2026-12-01T00:00:00.000Z' as Timestamp,
    revokedAt: null,
    ...assignmentOverrides,
  }
  return { role, assignment }
}

/** The request assertion 1 permits. Every later assertion removes ONE term. */
function platformPrincipal(
  overrides: Partial<PrincipalContext> = {},
): PrincipalContext {
  return {
    subject: { userId: STAFF, status: 'active' },
    tenantId: TENANT,
    orgClass: ORG_CLASSES.platform,
    partnerId: null,
    partnerGrant: null,
    held: [],
    platformHeld: [platformHolding()],
    now: NOW,
    ...overrides,
  }
}

describe('G289 · a platform principal is EVALUATED, not refused at the org term', () => {
  /* ---------------------------------------------------------------- *
   * 1. THE ALLOW ARM. Without it every assertion below is vacuous.
   * ---------------------------------------------------------------- */

  it('1 · a live platform assignment carrying the verb is PERMITTED', () => {
    const decision = decide(platformPrincipal(), THE_REACHABLE_CAPABILITY)

    assert.equal(
      decision.allowed,
      true,
      'the platform arm refused a principal it is supposed to permit. Before G289 ' +
        'this call answered `platform_org_holds_no_assignment` at step two, and an arm ' +
        'that still refuses every platform principal — for newer reasons — is the one ' +
        'line it replaced wearing eleven names.',
    )
    assert.equal(decision.reason, 'permitted')
    assert.deepEqual(decision.via, [
      {
        assignmentId: 'pra_priya_commercial',
        roleId: 'prl_commercial',
        roleVersion: 4,
      },
    ])
  })

  it('1a · the PERMITTED decision carries `DENY_ALL` scope — a verb, never a dimension', () => {
    const decision = decide(platformPrincipal(), THE_REACHABLE_CAPABILITY)

    assert.equal(decision.allowed, true)
    /* Every dimension of `AssignmentScope` narrows TENANT BUSINESS DATA. A
     * platform allow that returned `UNSCOPED` would hand a caller unrestricted
     * domains, definitions, solutions, cost centres, legal entities and an
     * unbounded value ceiling on the strength of a staff assignment — invariant
     * 8 undone by the scope field rather than by the boolean. */
    assert.deepEqual(decision.scope, DENY_ALL)
    assert.notDeepEqual(
      decision.scope,
      UNSCOPED,
      'a platform allow must never travel with an unscoped `AssignmentScope`.',
    )
  })

  /* ---------------------------------------------------------------- *
   * 2. THE DIFFERENTIAL. One term removed at a time, each refused BY NAME.
   * ---------------------------------------------------------------- */

  it('2a · the TERM ABSENT is `platform_assignment_unreadable` — the state of the tree today', () => {
    const { platformHeld: _omitted, ...withoutTheTerm } = platformPrincipal()
    const decision = decide(withoutTheTerm, THE_REACHABLE_CAPABILITY)

    assert.equal(decision.allowed, false)
    assert.equal(decision.reason, 'platform_assignment_unreadable')
    assert.equal(
      DECISION_REASONS.platform_assignment_unreadable,
      'platform_assignment_unreadable',
    )
    /* 🛑 THE DIRECTION OF THE DEFAULT IS THE WHOLE SAFETY ARGUMENT FOR THE TERM
     * BEING OPTIONAL. A caller who omits it LOSES authority. There is no value
     * of this field — its absence included — that permits anything. */
    assert.deepEqual(decision.scope, DENY_ALL)
  })

  it('2b · `null` is the SAME refusal as absent — both mean "no reader"', () => {
    const decision = decide(
      platformPrincipal({ platformHeld: null }),
      THE_REACHABLE_CAPABILITY,
    )

    assert.equal(decision.reason, 'platform_assignment_unreadable')
  })

  it('2c · `[]` is a DIFFERENT refusal — a reader ran and the person holds none', () => {
    const empty = decide(
      platformPrincipal({ platformHeld: [] }),
      THE_REACHABLE_CAPABILITY,
    )
    const noReader = decide(
      platformPrincipal({ platformHeld: null }),
      THE_REACHABLE_CAPABILITY,
    )

    assert.equal(empty.reason, 'platform_assignment_absent')
    /* 🛑 THE ASSERTION THIS TEST EXISTS FOR. Collapsing the two would make
     * "nobody has granted this person anything" and "we cannot tell" the same
     * answer, and only one of those is a fact about a person. */
    assert.notEqual(empty.reason, noReader.reason)
    assert.equal(empty.allowed, false)
    assert.equal(noReader.allowed, false)
  })

  it('2d · a REVOKED assignment and an EXPIRED one are refused SEPARATELY', () => {
    const revoked = decide(
      platformPrincipal({
        platformHeld: [
          platformHolding(undefined, {}, { revokedAt: '2026-09-10T00:00:00.000Z' as Timestamp }),
        ],
      }),
      THE_REACHABLE_CAPABILITY,
    )
    const expired = decide(
      platformPrincipal({
        platformHeld: [
          platformHolding(undefined, {}, { expiresAt: '2026-09-18T23:59:59.999Z' as Timestamp }),
        ],
      }),
      THE_REACHABLE_CAPABILITY,
    )

    assert.equal(revoked.reason, 'platform_assignment_revoked')
    assert.equal(expired.reason, 'platform_assignment_expired')
    /* 🛑 TWO MEMBERS AND NOT ONE. A revocation is an ACT somebody took and is
     * answerable; an expiry is a clock arriving and is nobody's act. An audit
     * that cannot tell them apart cannot answer "who took this away". */
    assert.notEqual(revoked.reason, expired.reason)
  })

  it('2e · an assignment expiring EXACTLY now is expired — `<=`, not `<`', () => {
    const decision = decide(
      platformPrincipal({
        platformHeld: [platformHolding(undefined, {}, { expiresAt: NOW })],
      }),
      THE_REACHABLE_CAPABILITY,
    )

    assert.equal(decision.reason, 'platform_assignment_expired')
  })

  it('2f · an ARCHIVED platform role is refused, and a MOVED PIN is refused separately', () => {
    const archived = decide(
      platformPrincipal({
        platformHeld: [platformHolding(undefined, { status: 'archived' })],
      }),
      THE_REACHABLE_CAPABILITY,
    )
    const moved = decide(
      platformPrincipal({
        platformHeld: [platformHolding(undefined, { version: 5 })],
      }),
      THE_REACHABLE_CAPABILITY,
    )

    assert.equal(archived.reason, 'platform_role_not_active')
    /* §10.5: a failed injection probe can auto-revert a pack at 04:00, and a
     * reverted-to version with a WIDER role would widen live authority
     * unattended. A staff role is the worst place for that, not the safest. */
    assert.equal(moved.reason, 'platform_role_version_moved')
  })

  it('2g · a LIVE assignment that does not carry the verb is its own refusal', () => {
    const decision = decide(
      /* Same class, live role, wrong verb — so the class gate passes and the
       * refusal can only have come from the capability test. */
      platformPrincipal({ platformHeld: [platformHolding([CAPABILITIES.viewMetering])] }),
      THE_REACHABLE_CAPABILITY,
    )

    assert.equal(decision.reason, 'no_platform_assignment_carries_capability')
    assert.notEqual(decision.reason, 'platform_assignment_absent')
  })

  it('2h · a DISABLED staff subject is refused before the arm is reached at all', () => {
    const decision = decide(
      platformPrincipal({ subject: { userId: STAFF, status: 'disabled' } }),
      THE_REACHABLE_CAPABILITY,
    )

    /* §8.6's check is step 1 and G289 did not move it. A platform arm that ran
     * ahead of it would evaluate a disabled person's assignments. */
    assert.equal(decision.reason, 'subject_not_active')
  })

  /* ---------------------------------------------------------------- *
   * 3. THE ARM DOES NOT INFER AN `OrgClass`. G289's capitalised prohibition.
   * ---------------------------------------------------------------- */

  it('3 · holding a platform role does NOT make a principal platform', () => {
    /* The identical `platformHeld` roster, on a CUSTOMER principal. If the arm
     * inferred org from the roster it would run here — and permit. */
    const asCustomer = decide(
      platformPrincipal({ orgClass: ORG_CLASSES.customer }),
      THE_REACHABLE_CAPABILITY,
    )

    assert.equal(asCustomer.allowed, false)
    assert.equal(
      asCustomer.reason,
      'no_live_assignment',
      'the customer arm answered a PLATFORM reason, which means the roster — and ' +
        'not `orgFor(connection.owner)` — decided which arm ran. That is invariant 8 ' +
        'relocated rather than held.',
    )
  })

  it('3a · a PARTNER principal carrying the same roster is unaffected — invariant 2', () => {
    const asPartner = decide(
      platformPrincipal({ orgClass: ORG_CLASSES.partner }),
      THE_REACHABLE_CAPABILITY,
    )

    /* The partner arm's own first question, unchanged: a partner needs a live
     * `PartnerAccessGrant` and the roster is not one. */
    assert.equal(asPartner.reason, 'partner_grant_absent')
  })

  it('3b · a CUSTOMER principal decides identically with and without the new term', () => {
    const base: PrincipalContext = {
      subject: { userId: 'usr_acme_mei' as UserId, status: 'active' },
      tenantId: TENANT,
      orgClass: ORG_CLASSES.customer,
      partnerId: null,
      partnerGrant: null,
      held: [],
      now: NOW,
    }

    const without = decide(base, THE_REACHABLE_CAPABILITY)
    const withTerm = decide(
      { ...base, platformHeld: [platformHolding()] },
      THE_REACHABLE_CAPABILITY,
    )

    assert.deepEqual(withTerm, without)
    assert.equal(without.reason, 'no_live_assignment')
  })

  /* ---------------------------------------------------------------- *
   * 4. `statutory`, AT ANY PRICE — AND REFUSED BY THE LIST, NOT THE VERB.
   * ---------------------------------------------------------------- */

  it('4 · a platform role that CARRIES a statutory verb is still refused', () => {
    for (const capability of [
      CAPABILITIES.placeLegalHold,
      CAPABILITIES.handleSubjectRequest,
    ]) {
      const decision = decide(
        /* Everything present: live role, live assignment, and the role really
         * does carry the verb. The refusal cannot be "nobody holds it". */
        platformPrincipal({ platformHeld: [platformHolding([capability])] }),
        capability,
      )

      assert.equal(decision.allowed, false)
      assert.equal(
        decision.reason,
        'platform_class_never_delegable',
        'a statutory capability was refused for some OTHER reason, which means the ' +
          '`NON_DELEGABLE_RESOURCES` branch is not what stopped it. Invariant 8 says ' +
          '"at any price", and a price is what a later branch becomes.',
      )
      assert.notEqual(decision.reason, 'no_platform_assignment_carries_capability')
      assert.notEqual(decision.reason, 'platform_class_out_of_reach')
    }
  })

  it('4a · the statutory refusal precedes the TERM — no reader is needed to refuse it', () => {
    const { platformHeld: _omitted, ...noReader } = platformPrincipal()
    const decision = decide(noReader, CAPABILITIES.placeLegalHold)

    /* `authorisationPermits()` tests `statutory` "BEFORE the null check, before
     * withdrawal, before anything", and this arm copies that order for its
     * reason: no absent reader and no malformed row may reach the class. */
    assert.equal(decision.reason, 'platform_class_never_delegable')
    assert.notEqual(decision.reason, 'platform_assignment_unreadable')
  })

  it('4b · all THREE lists are read, and each produces its OWN reason', () => {
    const held = [platformHolding([CAPABILITIES.placeLegalHold, CAPABILITIES.manageRoles, CAPABILITIES.viewException])]

    /* NON_DELEGABLE_RESOURCES → statutory */
    assert.equal(
      decide(platformPrincipal({ platformHeld: held }), CAPABILITIES.placeLegalHold).reason,
      'platform_class_never_delegable',
    )
    /* CONTRACT_ONLY_RESOURCES → authority. G75 exists because a third list
     * nobody had named made G60 inert for eight days; reading two of three is
     * exactly that defect. */
    assert.equal(
      decide(platformPrincipal({ platformHeld: held }), CAPABILITIES.manageRoles).reason,
      'platform_class_contract_only',
    )
    /* PLATFORM_ASSIGNMENT_REACHES → the other eleven */
    assert.equal(
      decide(platformPrincipal({ platformHeld: held }), CAPABILITIES.viewException).reason,
      'platform_class_out_of_reach',
    )
  })

  it('4c · the table AGREES with both governance lists, in both directions', () => {
    for (const cls of NON_DELEGABLE_RESOURCES) {
      assert.equal(
        PLATFORM_ASSIGNMENT_REACHES[cls],
        false,
        `\`${cls}\` is in NON_DELEGABLE_RESOURCES and PLATFORM_ASSIGNMENT_REACHES admits it. ` +
          'The list would still refuse it first — which is exactly what made G60 inert: a ' +
          'first-position refusal hides a disagreement instead of surfacing it.',
      )
    }
    for (const cls of CONTRACT_ONLY_RESOURCES) {
      assert.equal(PLATFORM_ASSIGNMENT_REACHES[cls], false, `\`${cls}\` is contract-only`)
    }
  })

  /* ---------------------------------------------------------------- *
   * 5. EVERY RESOURCE CLASS ANSWERED — and the CONTENT witnessed, §5.10.
   * ---------------------------------------------------------------- */

  it('5 · all THIRTEEN classes are answered, and exactly one is reachable — BY NAME', () => {
    const classes = Object.values(ACCESS_RESOURCE_CLASSES) as readonly AccessResourceClass[]
    const answered = Object.keys(PLATFORM_ASSIGNMENT_REACHES).sort()

    assert.deepEqual(
      answered,
      [...classes].sort(),
      'the arm must answer every resource class rather than defaulting — that totality ' +
        'is the mitigation G289 names for the cost it accepts.',
    )

    const reachable = classes.filter((c) => PLATFORM_ASSIGNMENT_REACHES[c])
    /* 🛑 BY NAME, NEVER BY A LENGTH — G173's discipline. A length agrees with
     * itself while the set moves underneath it, which is the merge that put two
     * different thirty-eights on two branches of `CAPABILITIES`.
     *
     * ⚠️ THIS READ `['commercial']` UNTIL 19 Sep 2026 AND THE TITLE OF THIS
     * TEST STILL SAYS *"exactly one is reachable"* — the title is left as the
     * history it is and the LIST is the claim, which is the whole argument for
     * asserting by name. G601 opened `substrate` and `catalogue`, each argued
     * at its own entry in `PLATFORM_ASSIGNMENT_REACHES` and each refused to
     * every TENANT arm by `PLATFORM_ONLY_RESOURCE_CLASSES`. Note what did NOT
     * move: `tenant_data` is still out, which is invariant 8. */
    assert.deepEqual([...reachable].sort(), ['catalogue', 'commercial', 'substrate'])
  })

  it('5a · the CONTENT is witnessed: every one of the capabilities is decided, and only one allows', () => {
    /* 🛑 §5.10 — "a total `Record` only bites where something CONSTRUCTS one, and
     * in a types-only model nothing does. Compile-time assertions hold the
     * SHAPE; only a fixture witnesses the CONTENT." This is that fixture: every
     * capability in the closed set, held live by a platform role, decided. */
    const allCapabilities = Object.values(CAPABILITIES) as readonly Capability[]
    const allowed: Capability[] = []

    for (const capability of allCapabilities) {
      const decision = decide(
        platformPrincipal({ platformHeld: [platformHolding([capability])] }),
        capability,
      )
      if (decision.allowed) allowed.push(capability)

      const cls = CAPABILITY_RESOURCE_CLASS[capability]
      assert.equal(
        decision.allowed,
        PLATFORM_ASSIGNMENT_REACHES[cls],
        `\`${capability}\` (class \`${cls}\`) decided ${decision.allowed} while the table ` +
          `says ${PLATFORM_ASSIGNMENT_REACHES[cls]}. The verdict must come from the class, ` +
          'not from the verb.',
      )
    }

    /* ⚠️ ONE MEMBER UNTIL 19 Sep 2026 — G601's five platform-only verbs are the
     * other five, and they are sorted so the assertion reads as a SET rather
     * than as an accident of declaration order. */
    assert.deepEqual([...allowed].sort(), [
      'author_catalogue',
      'provision_substrate',
      'publish_catalogue',
      'view_catalogue',
      'view_commercial',
      'view_substrate',
    ])
    assert.equal(THE_REACHABLE_CAPABILITY, 'view_commercial')
  })

  /* ---------------------------------------------------------------- *
   * 6. WHAT G289 DID NOT CHANGE.
   * ---------------------------------------------------------------- */

  it('6 · invariant 11 is untouched — a container is never granted', () => {
    assert.equal(AGENTS_HOLD_ROLES, false)
    assert.equal(SOLUTION_IS_GRANTABLE, false)
  })

  it('6a · a platform principal still cannot grant a tenant role — `canGrant()` refuses first', () => {
    const target = {
      userId: 'usr_acme_mei' as UserId,
      orgClass: ORG_CLASSES.customer,
      role: {} as unknown as Role,
      scope: DENY_ALL,
    }
    const verdict = canGrant(
      platformPrincipal({ platformHeld: [platformHolding([CAPABILITIES.manageRoles])] }),
      target,
    )

    /* `DURABLE_ASSIGNMENT_PERMITTED[granter.orgClass]` is the first question
     * `canGrant()` asks and G289 did not touch it. `manage_roles` is classed
     * `authority` besides, which this arm refuses as contract-only — two
     * independent refusals, either sufficient. */
    assert.equal(verdict.allowed, false)
    assert.equal(verdict.reason, 'granter_not_customer_org')
  })

  it('6b · the retired reason is still a member of the closed set', () => {
    /* ⚠️ `platform_org_holds_no_assignment` is no longer reachable from
     * `decide()`. It stays in the vocabulary because a `DecisionReason` is an
     * AUDIT vocabulary: rows minted before this commit carry the string, and a
     * closed set that drops a member makes them unreadable rather than
     * historical. */
    const closed: readonly string[] = Object.values(DECISION_REASONS)
    assert.ok(closed.includes('platform_org_holds_no_assignment'))

    const reasons = new Set<string>()
    for (const capability of Object.values(CAPABILITIES) as readonly Capability[]) {
      reasons.add(decide(platformPrincipal({ platformHeld: [] }), capability).reason)
      reasons.add(decide(platformPrincipal(), capability).reason)
    }
    assert.ok(
      !reasons.has('platform_org_holds_no_assignment'),
      'the arm still answers the retired reason, which means the fourth arm is not ' +
        'actually reached.',
    )
  })
})

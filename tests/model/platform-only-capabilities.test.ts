/**
 * THE FENCE THAT MAKES G601's FIVE NEW CAPABILITIES SAFE TO MINT INTO A SHARED
 * CLOSED SET — 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 READ THE HOLE BEFORE READING THE ASSERTIONS, BECAUSE THE HOLE IS WHAT
 *    THIS FILE IS FOR AND A NAIVE MINTING WOULD NOT HAVE SEEN IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `Capability` is ONE closed set, shared by every arm of `decide()`. G601 mints
 * five members for the PLATFORM's own surface — the fleet and the catalogue —
 * and the customer arm of `decide()` tests
 * `role.capabilities.includes(capability)` and asks nothing at all about class.
 * So minting alone would have made this true:
 *
 *   a tenant-authored `Role` carrying `publish_catalogue`, held by a customer
 *   administrator, is PERMITTED to publish a pack version to the fleet.
 *
 * Three things that look like they would stop it do not:
 *
 *   · `CAPABILITY_STAKEHOLDER_CLASSES` says of itself, in its own declaration,
 *     that *"a tenant-authored `Role` is checked by NONE of this … the
 *     mechanism that would bind it is a write-time validator that does not
 *     exist."*
 *   · `db/migrations/0009_identity_substrate.sql` types
 *     `tenant.role_capability.capability` as bare `text`. The database will
 *     store the row.
 *   · `PARTNER_MASK_MEMBERSHIP` bounds a PARTNER and says nothing about a
 *     customer.
 *
 * The thing that does stop it is `PLATFORM_ONLY_RESOURCE_CLASSES` plus one
 * branch at the top of `decide()`'s non-platform path, and this file is its
 * only witness.
 *
 * ┌─ WITNESSED RED FIRST, BY MUTATION. EVERY BLOCK BELOW WAS RUN AND THE ─────┐
 * │  EXACT FAILURE TEXT IS TRANSCRIBED FROM THE RUN, NOT PARAPHRASED.          │
 * │                                                                            │
 * │ MUTATION 1 · delete the `capabilityIsPlatformOnly()` branch from            │
 * │   `decide()` (the whole `if` at step 2e). §2 and §2b turn red:              │
 * │                                                                            │
 * │     AssertionError [ERR_ASSERTION]: a CUSTOMER administrator holding        │
 * │     `view_substrate` on a tenant-authored role was PERMITTED. The class is  │
 * │     the platform own and no tenant principal may reach it; the role is one  │
 * │     `db/migrations/0009` will store, because `role_capability.capability`   │
 * │     is bare `text`.                                                         │
 * │                                                                            │
 * │     AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:   │
 * │     + 'partner_grant_absent'  - 'capability_is_platform_only'               │
 * │                                                                            │
 * │   🛑 AND NOTHING ELSE IN THE TREE CAUGHT IT — MEASURED, NOT ASSUMED. The    │
 * │   whole of `tests/model/**` and `tests/contracts/**` was re-run under that  │
 * │   mutation and the ONLY two failures were §2 and §2b of this file. §1, §1a, │
 * │   §3, §3a, §4, §5 and §5a all stayed GREEN, which is why §2 exists as a     │
 * │   `decide()` fixture rather than as another derivation over the tables.     │
 * │                                                                            │
 * │ MUTATION 2 · empty `PLATFORM_ONLY_RESOURCE_CLASSES` to `[]`. SIX assertions │
 * │   turn red, and the §5.6 guard is the first of them —                       │
 * │     AssertionError [ERR_ASSERTION]: the fence list is empty, so §2 is       │
 * │     vacuous                                                                 │
 * │   — followed by §1 (`+ [] - ['catalogue','substrate']`), §1a, §2, §2b and   │
 * │   §3a. A list that can be silently emptied is the shape `CAPABILITY_FLOOR`  │
 * │   already refuses; here the guard refuses it before the vacuity spreads.    │
 * │                                                                            │
 * │ MUTATION 3 · reclassify `publish_catalogue` to `configuration` in           │
 * │   `CAPABILITY_RESOURCE_CLASS`. FIVE assertions here turn red plus §5a of    │
 * │   `tests/model/platform-arm.test.ts`, and the two most useful are:          │
 * │     §2c: `publish_catalogue` is fenced away from every tenant arm and its   │
 * │     class `configuration` is NOT reachable by a platform assignment         │
 * │     either, so the verb is held by nobody at all.                           │
 * │     §3a: `publish_catalogue` names NO tenant stakeholder class and is       │
 * │     classed `configuration`, which no fence covers.                         │
 * │   That is the two-directional mirror doing its job: a capability cannot be  │
 * │   quietly moved out from behind the fence in either direction.              │
 * │                                                                            │
 * │ 🛑 MUTATION 4 · THE ONE WHOSE RESULT CONTRADICTED THE PREDICTION, AND IT IS │
 * │   RECORDED AS THE CORRECTION IT IS RATHER THAN QUIETLY REWRITTEN. A sixth   │
 * │   platform verb (`retire_catalogue`, classed `catalogue`, `[]` in all four  │
 * │   total records) was predicted here to be caught by NOTHING. It is caught   │
 * │   by FOUR assertions: this file's §1a, `platform-arm.test.ts` §5a, and the  │
 * │   two capability-count guards in `endpoint-read-capability.test.ts` and     │
 * │   `role-capability-floor.test.mjs`. **The prediction was wrong and the      │
 * │   controls are stronger than claimed.**                                     │
 * │                                                                            │
 * │   WHAT SURVIVES IS NARROWER AND IS THE HONEST RESIDUAL: every one of those  │
 * │   four reds is a SWEEP PROMPT — a number to update and a set to re-sort —   │
 * │   and not one of them asks whether a sixth verb should exist. A person      │
 * │   clearing them mechanically ships the verb, correctly fenced, unargued.    │
 * │   That is the intended behaviour of a class-keyed control (G577's whole     │
 * │   argument): this file can tell you a verb cannot escape. It cannot tell    │
 * │   you it was a good idea.                                                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  CAPABILITY_STAKEHOLDER_CLASSES,
  DENY_ALL,
  ORG_CLASSES,
  PARTNER_MASK_MEMBERSHIP,
  PLATFORM_ASSIGNMENT_REACHES,
  PLATFORM_ONLY_RESOURCE_CLASSES,
  SEEDED_CAPABILITY_HOLDERS,
  capabilityIsPartnerOnly,
  capabilityIsPlatformOnly,
  decide,
  type Capability,
  type PrincipalContext,
  type Role,
  type RoleAssignment,
} from '../../model/access.ts'
import { ACCESS_RESOURCE_CLASSES } from '../../model/governance.ts'
import type { PartnerGrantTerms } from '../../model/access.ts'
import type { TenantId, Timestamp, UserId } from '../../model/kernel.ts'

const NOW = '2026-09-19T12:00:00.000Z' as Timestamp
const TENANT = 'ten_acme' as TenantId

type RoleId = Role['id']
type RoleAssignmentId = RoleAssignment['id']

/**
 * THE MALFORMED ROLE THE DATABASE WOULD ACCEPT. Not a hypothetical: `0009`
 * declares `tenant.role_capability.capability` as bare `text` with no
 * closed-set constraint, so this exact row is storable today by the migrator
 * and — if `0020` ever granted an `INSERT` beyond `role_assignment` — by a
 * request path.
 */
function tenantRoleCarrying(capabilities: readonly Capability[]): Role {
  return {
    tenantId: TENANT,
    id: 'rol_acme_admin' as RoleId,
    label: 'Administrator',
    key: 'tenant_admin',
    version: 1,
    stakeholderClass: 'administrator',
    origin: 'tenant',
    capabilities,
    defaultScope: DENY_ALL,
    status: 'active',
  } as Role
}

function tenantAssignment(): RoleAssignment {
  return {
    tenantId: TENANT,
    id: 'ras_acme_mei' as RoleAssignmentId,
    userId: 'usr_acme_mei' as UserId,
    roleId: 'rol_acme_admin' as RoleId,
    roleVersion: 1,
    scope: DENY_ALL,
    grantedBy: 'usr_acme_root' as UserId,
    grantedAt: '2026-09-01T00:00:00.000Z' as Timestamp,
    expiresAt: null,
    revokedAt: null,
  } as RoleAssignment
}

function customerPrincipal(
  capabilities: readonly Capability[],
): PrincipalContext {
  return {
    subject: { userId: 'usr_acme_mei' as UserId, status: 'active' },
    tenantId: TENANT,
    orgClass: ORG_CLASSES.customer,
    partnerId: null,
    partnerGrant: null,
    held: [{ role: tenantRoleCarrying(capabilities), assignment: tenantAssignment() }],
    platformHeld: null,
    now: NOW,
  }
}

const PLATFORM_ONLY: readonly Capability[] = [
  CAPABILITIES.viewSubstrate,
  CAPABILITIES.provisionSubstrate,
  CAPABILITIES.viewCatalogue,
  CAPABILITIES.authorCatalogue,
  CAPABILITIES.publishCatalogue,
]

/* ==================================================================== *
 * 0 · THE §5.6 GUARD. Every assertion below joins two vocabularies; a
 *     failed import would make all of them vacuous.
 * ==================================================================== */

test('guard · the five members and the two classes really are imported', () => {
  assert.equal(PLATFORM_ONLY.length, 5)
  assert.equal(new Set(PLATFORM_ONLY).size, 5)
  for (const c of PLATFORM_ONLY) {
    assert.equal(typeof c, 'string', `${String(c)} did not resolve out of CAPABILITIES`)
  }
  assert.ok(PLATFORM_ONLY_RESOURCE_CLASSES.length > 0, 'the fence list is empty, so §2 is vacuous')
})

/* ==================================================================== *
 * 1 · THE LIST AGREES WITH `governance.ts`, IN BOTH DIRECTIONS.
 * ==================================================================== */

test('1 · the fenced classes are exactly the two documented as having no TENANT capability', () => {
  /**
   * 0008's mirror discipline, in TypeScript: a copy is acceptable only where a
   * test asserts set equality in BOTH directions. The two classes are named in
   * `governance.ts` prose, so the agreement asserted here is with the
   * DECLARED CLASS SET rather than with the prose — the prose is quoted on
   * `PLATFORM_ONLY_RESOURCE_CLASSES`'s own declaration.
   */
  assert.deepEqual(
    [...PLATFORM_ONLY_RESOURCE_CLASSES].sort(),
    [ACCESS_RESOURCE_CLASSES.substrate, ACCESS_RESOURCE_CLASSES.catalogue].sort(),
  )

  /* And every member is a real class, so a typo cannot fence nothing. */
  const declared = new Set<string>(Object.values(ACCESS_RESOURCE_CLASSES))
  for (const cls of PLATFORM_ONLY_RESOURCE_CLASSES) {
    assert.ok(declared.has(cls), `\`${cls}\` is not a declared AccessResourceClass`)
  }
})

test('1a · every capability of a fenced class is reported platform-only, and no other is', () => {
  const all = Object.values(CAPABILITIES) as readonly Capability[]
  const fenced = all.filter((c) => capabilityIsPlatformOnly(c))

  assert.deepEqual([...fenced].sort(), [...PLATFORM_ONLY].sort())

  for (const c of all) {
    assert.equal(
      capabilityIsPlatformOnly(c),
      PLATFORM_ONLY_RESOURCE_CLASSES.includes(CAPABILITY_RESOURCE_CLASS[c]),
      `\`${c}\` disagrees with its own class \`${CAPABILITY_RESOURCE_CLASS[c]}\`. The verdict ` +
        'must come from the class and never from a list of verb names — G577.',
    )
  }
})

/* ==================================================================== *
 * 2 · THE ENFORCEMENT. §5.10 — only a fixture witnesses the CONTENT.
 * ==================================================================== */

test('2 · a CUSTOMER administrator holding the verb on a real role is REFUSED, by name', () => {
  for (const capability of PLATFORM_ONLY) {
    const decision = decide(customerPrincipal([capability]), capability)

    assert.equal(
      decision.allowed,
      false,
      `a CUSTOMER administrator holding \`${capability}\` on a tenant-authored role was ` +
        'PERMITTED. The class is the platform own and no tenant principal may reach it; the ' +
        'role is one `db/migrations/0009` will store, because `role_capability.capability` ' +
        'is bare `text`.',
    )
    assert.equal(
      decision.reason,
      'capability_is_platform_only',
      'the refusal must name the VERB and not the row. `no_assignment_carries_capability` ' +
        'would tell an auditor to go and grant the role, which is the one remedy that must ' +
        'not work.',
    )
    assert.deepEqual(decision.scope, DENY_ALL)
    assert.deepEqual(decision.via, [])
  }
})

test('2a · ANTI-VACUOUS — the same principal, same role shape, is PERMITTED a tenant verb', () => {
  /**
   * §5.6: a control whose only observable behaviour is refusal proves nothing.
   * If the fixture were malformed — a dead role, a moved pin, a wrong tenant —
   * §2 would pass for the wrong reason and this assertion is what catches it.
   */
  const decision = decide(
    customerPrincipal([CAPABILITIES.viewException]),
    CAPABILITIES.viewException,
  )
  assert.equal(decision.allowed, true, 'the fixture itself is dead, so §2 proves nothing')
  assert.equal(decision.reason, 'permitted')
})

test('2b · a PARTNER is refused the same five BEFORE the grant is even read', () => {
  /**
   * 🛑 THE ORDER IS THE ASSERTION. The branch sits above the partner arm, so
   * the refusal is a fact about the VERB. Below it, a partner with no grant
   * would be refused `partner_grant_absent` and one with a grant
   * `capability_outside_partner_mask` — both true today, and both one mask
   * edit away from being wrong for the right-looking reason.
   */
  const grant: PartnerGrantTerms = {
    partnerId: 'prt_northwind' as PartnerGrantTerms['partnerId'],
    scope: 'exceptions_operate',
    expiresAt: '2027-01-01T00:00:00.000Z' as Timestamp,
    revokedAt: null,
  } as PartnerGrantTerms

  for (const capability of PLATFORM_ONLY) {
    const withNoGrant = decide(
      { ...customerPrincipal([capability]), orgClass: ORG_CLASSES.partner },
      capability,
    )
    assert.equal(withNoGrant.reason, 'capability_is_platform_only')
    assert.notEqual(withNoGrant.reason, 'partner_grant_absent')

    const withGrant = decide(
      {
        ...customerPrincipal([capability]),
        orgClass: ORG_CLASSES.partner,
        partnerId: grant.partnerId,
        partnerGrant: grant,
      },
      capability,
    )
    assert.equal(withGrant.reason, 'capability_is_platform_only')
    assert.notEqual(withGrant.reason, 'capability_outside_partner_mask')
  }
})

test('2c · the PLATFORM arm is untouched — the fence refuses tenants, never the platform', () => {
  /**
   * The mirror of §2. If the branch were placed above the platform arm rather
   * than below it, G601 would have minted five verbs and fenced them away from
   * the only principal that may hold them — the shape that made G60 inert for
   * eight days, arriving in the opposite direction.
   */
  for (const capability of PLATFORM_ONLY) {
    const cls = CAPABILITY_RESOURCE_CLASS[capability]
    assert.equal(
      PLATFORM_ASSIGNMENT_REACHES[cls],
      true,
      `\`${capability}\` is fenced away from every tenant arm and its class \`${cls}\` is ` +
        'NOT reachable by a platform assignment either, so the verb is held by nobody at all.',
    )
  }
})

/* ==================================================================== *
 * 3 · THE FOUR TOTAL RECORDS AGREE WITH THE FENCE.
 * ==================================================================== */

test('3 · every fenced capability is empty in all three TENANT-side records', () => {
  for (const capability of PLATFORM_ONLY) {
    assert.deepEqual(
      [...CAPABILITY_STAKEHOLDER_CLASSES[capability]],
      [],
      `\`${capability}\` names a tenant stakeholder class. Every member of ` +
        'StakeholderClass is a position inside a CUSTOMER tenant, so there is no coherent ' +
        'pairing to name.',
    )
    assert.deepEqual([...SEEDED_CAPABILITY_HOLDERS[capability]], [])
    assert.deepEqual([...PARTNER_MASK_MEMBERSHIP[capability]], [])
  }
})

test('3a · and the other direction — an EMPTY ceiling entry is a fenced capability', () => {
  /**
   * The half that catches the real drift: somebody mints a sixth verb, writes
   * `[]` in the ceiling because nothing tenant-side should hold it, and forgets
   * to class it. Without this the verb would be `configuration`, tenant-held
   * and ungated, while every record in the tree looked answered.
   */
  for (const capability of Object.values(CAPABILITIES) as readonly Capability[]) {
    if (CAPABILITY_STAKEHOLDER_CLASSES[capability].length === 0) {
      /* ⚠️ R10, 1 Oct 2026: there are now TWO fences, and an empty ceiling entry
       * must be covered by ONE of them. This read `capabilityIsPlatformOnly()`
       * alone and went RED — correctly — on `view_deals`, which is fenced by
       * `PARTNER_ONLY_RESOURCE_CLASSES` instead. The property is unchanged: a
       * verb no tenant class may hold must be one `decide()` refuses on every
       * tenant arm. `tests/model/partner-staff-arm.test.ts` §4a witnesses the
       * partner fence firing on a customer role. */
      assert.ok(
        capabilityIsPlatformOnly(capability) || capabilityIsPartnerOnly(capability),
        `\`${capability}\` names NO tenant stakeholder class and is classed ` +
          `\`${CAPABILITY_RESOURCE_CLASS[capability]}\`, which no fence covers. A verb no ` +
          'tenant class may coherently hold and that `decide()` will nonetheless evaluate ' +
          'on a tenant arm is the hole this file exists for.',
      )
    }
  }
})

/* ==================================================================== *
 * 4 · THE REASON IS IN THE CLOSED SET AND IS REACHED FROM TWO ARMS ONLY.
 * ==================================================================== */

test('4 · `capability_is_platform_only` never arises on the PLATFORM arm', () => {
  const platform: PrincipalContext = {
    ...customerPrincipal([]),
    orgClass: ORG_CLASSES.platform,
    held: [],
    platformHeld: null,
  }
  const reasons = new Set<string>()
  for (const capability of Object.values(CAPABILITIES) as readonly Capability[]) {
    reasons.add(decide(platform, capability).reason)
  }
  assert.ok(
    !reasons.has('capability_is_platform_only'),
    'the platform arm reached a refusal that exists to keep TENANTS out, which means the ' +
      'branch is above the arm rather than below it.',
  )
  /* And the arm is genuinely being reached, so the assertion is not vacuous. */
  assert.ok(reasons.has('platform_assignment_unreadable'))
  assert.ok(reasons.has('platform_class_out_of_reach'))
})

/* ==================================================================== *
 * 5 · WHAT THIS DOES NOT DO — asserted, so the next reader does not
 *     re-derive it and does not overstate it.
 * ==================================================================== */

test('5 · no tenant-data class is fenced, so invariant 8 is untouched by this control', () => {
  /**
   * `PLATFORM_ONLY_RESOURCE_CLASSES` is NOT the complement of
   * `PLATFORM_ASSIGNMENT_REACHES` and must never be derived from it. The two
   * answer different questions, and `commercial` is the proof: a platform
   * assignment reaches it AND a tenant administrator legitimately holds
   * `view_commercial`.
   */
  assert.ok(!PLATFORM_ONLY_RESOURCE_CLASSES.includes(ACCESS_RESOURCE_CLASSES.commercial))
  assert.equal(PLATFORM_ASSIGNMENT_REACHES[ACCESS_RESOURCE_CLASSES.commercial], true)
  assert.ok(CAPABILITY_STAKEHOLDER_CLASSES.view_commercial.length > 0)

  /* And the class invariant 8 is about is on neither list. */
  assert.ok(!PLATFORM_ONLY_RESOURCE_CLASSES.includes(ACCESS_RESOURCE_CLASSES.tenantData))
  assert.equal(PLATFORM_ASSIGNMENT_REACHES[ACCESS_RESOURCE_CLASSES.tenantData], false)
})

test('5b · the reach §5 protects is LIVE — a tenant administrator is PERMITTED `view_commercial` TODAY', () => {
  /**
   * ═════════════════════════════════════════════════════════════════════════
   * 🛑 G881, 20 Sep 2026. §5 ABOVE IS A STATEMENT ABOUT TWO LISTS. THIS IS THE
   *    SAME PROPERTY STATED ABOUT AUTHORITY, AND THE DIFFERENCE IS THE WHOLE
   *    REASON THIS ASSERTION EXISTS RATHER THAN A SIXTH LINE IN §5.
   * ═════════════════════════════════════════════════════════════════════════
   *
   * §5.10, quoted rather than re-derived: *"Compile-time assertions hold the
   * SHAPE; only a fixture witnesses the CONTENT."* §5 asserts that `commercial`
   * is absent from one list and `true` in another. Neither says what a person
   * loses when that stops being so.
   *
   * ┌─ MEASURED 20 Sep 2026, NOT REASONED ──────────────────────────────────┐
   * │ MUTATION · add `'commercial'` to `PLATFORM_ONLY_RESOURCE_CLASSES`,     │
   * │   which is the mechanism the owner's `write_commercial` ruling names   │
   * │   in as many words. `decide()` on the fixture below goes from          │
   * │                                                                        │
   * │     {"allowed":true,"reason":"permitted"}                              │
   * │   to                                                                   │
   * │     {"allowed":false,"reason":"capability_is_platform_only"}           │
   * │                                                                        │
   * │   SEVEN existing assertions across THREE suites turn red under that    │
   * │   mutation — this file's §1, §1a and §5; `platform-arm.test.ts` §3,    │
   * │   §3a and §3b; `administration-evaluators.test.mjs` §3a — and NOT ONE  │
   * │   OF THEM NAMES THE REVOCATION. They report a list that changed, an    │
   * │   arm that answered the wrong reason, and a roster that decided which  │
   * │   arm ran. A person clearing seven reds of that shape sweeps a list    │
   * │   and ships the narrowing.                                             │
   * │                                                                        │
   * │ 🛑 AND THE GAP WAS MEASURED BEFORE THIS ASSERTION WAS WRITTEN:         │
   * │   `grep -rn 'view_commercial' tests/ | grep -i 'allowed\|permitted'`   │
   * │   returned NOTHING. No test in the tree asserted that any tenant       │
   * │   principal may hold this verb at all.                                 │
   * └────────────────────────────────────────────────────────────────────────┘
   *
   * WHY IT IS A REVOCATION AND NOT A SCOPE CHANGE. `commercial` is NOT the
   * shape `substrate` and `catalogue` were when G601 fenced them: those two
   * classes had NO tenant capability, so fencing them cost a tenant nothing.
   * This one ships in the seed — `SEEDED_CAPABILITY_HOLDERS.view_commercial`
   * names `tenant_admin` and `sponsor` — and the verb exists because
   * `governance.ts` recorded that *"a tenant admin cannot see what they owe …
   * a commercial relationship the customer cannot inspect is not a smaller
   * feature, it is a billing dispute with no self-service answer."*
   *
   * Invariant 9's shape, arriving through a capability roster rather than
   * through a rollback: **a narrowing of live authority that no file
   * announces.**
   */
  const decision = decide(
    customerPrincipal([CAPABILITIES.viewCommercial]),
    CAPABILITIES.viewCommercial,
  )

  assert.equal(
    decision.allowed,
    true,
    'A TENANT ADMINISTRATOR CAN NO LONGER READ WHAT THEY OWE. If you reached this by adding ' +
      '`commercial` to `PLATFORM_ONLY_RESOURCE_CLASSES` — the mechanism the `write_commercial` ' +
      'ruling names — then the fence has done what it is for and to the wrong class: it is ' +
      'keyed on the CLASS (G577, and that is correct), and `commercial` is the one class that ' +
      'is reachable from BOTH sides. There is no state of this list in which a platform WRITE ' +
      'on `commercial` is fenced and the tenant READ survives.\n\n' +
      'This is not a red to sweep. It is a revocation, and the ruling that wants ' +
      '`write_commercial` needs a mechanism that is not this list. See `docs/HANDOFF.md` G881.',
  )
  assert.equal(decision.reason, 'permitted')

  /* The class is reachable from BOTH arms, which is the structural fact that
   * makes it unfenceable at the class axis. Derived, so it moves if either
   * side closes. */
  assert.equal(
    PLATFORM_ASSIGNMENT_REACHES[ACCESS_RESOURCE_CLASSES.commercial],
    true,
    'the platform side closed, so `commercial` is no longer a two-sided class and G881 must ' +
      'be re-argued rather than inherited.',
  )
  assert.ok(
    SEEDED_CAPABILITY_HOLDERS.view_commercial.length > 0,
    'no seeded role ships `view_commercial` any more, so the revocation G881 measures would ' +
      'now be prospective rather than live. Re-measure before quoting that row.',
  )

  /* §5.6 — the fixture must be capable of refusing, or `allowed: true` above is
   * a fact about a permissive fixture rather than about this verb. */
  const refused = decide(
    customerPrincipal([CAPABILITIES.viewCommercial]),
    CAPABILITIES.viewSubstrate,
  )
  assert.equal(refused.allowed, false)
  assert.equal(refused.reason, 'capability_is_platform_only')
})

test('5a · nothing produces a holder of any of the five — the verbs are declared, not held', () => {
  /**
   * 🛑 SAID AS AN ASSERTION RATHER THAN IN A COMMENT, so the commit that first
   * seeds a `PlatformRoleAssignment` carrying one of these has to come here and
   * argue rather than discover the claim was prose. `SEEDED_PLATFORM_ROLES` is
   * a set of TENANT seeds and there is no seeded `PlatformRole` anywhere.
   */
  for (const capability of PLATFORM_ONLY) {
    assert.deepEqual([...SEEDED_CAPABILITY_HOLDERS[capability]], [])
  }
})

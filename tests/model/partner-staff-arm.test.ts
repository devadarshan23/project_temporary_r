/**
 * R10 — `decide()`'s FIFTH ARM, AND THE DIFFERENTIAL THAT MAKES IT MEAN
 * ANYTHING. G2321–G2324, 1 Oct 2026, applying the OWNER'S ruling:
 *
 *   *"Partner role tables + a fifth arm: new partner_role /
 *   partner_role_assignment tables keyed on partnerId, decide() gains a fifth
 *   arm, and new resource classes for deals / sandbox / partner staff."*
 *
 * 🛑 THE ALLOW ARM IS ASSERTION 1, for `tests/model/platform-arm.test.ts`'s
 *    reason: an arm whose only observable behaviour is refusal is §5.6 until
 *    something witnesses it deciding. Every assertion in §2 removes exactly ONE
 *    term from the request §1 permits and requires a refusal BY NAME.
 *
 * 🛑 §3 IS THE ONE TO READ BEFORE TRUSTING THE ARM, because it is invariant 2:
 *    a partner role assignment must never be a second door into a customer
 *    tenant. A portal role that NAMES a tenant capability confers nothing, and
 *    the refusal is the tenant partner arm's own `partner_grant_absent` — the
 *    fifth arm is never entered.
 *
 * ⚠️ WHAT A GREEN RUN DOES NOT PROVE: that anybody holds a portal role. Every
 *    holding below is a fixture. `tests/db/partner-role.test.ts` proves the
 *    rows can be READ; nothing in this repository writes one.
 *
 * Expected reasons are string LITERALS, never `DECISION_REASONS.x` compared to
 * itself — `tests/model/access-decide.test.ts`'s rule.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  CAPABILITY_STAKEHOLDER_CLASSES,
  DENY_ALL,
  ORG_CLASSES,
  PARTNER_CAPABILITY_MASK,
  PARTNER_ONLY_RESOURCE_CLASSES,
  PLATFORM_ASSIGNMENT_REACHES,
  PLATFORM_ONLY_RESOURCE_CLASSES,
  capabilityIsPartnerOnly,
  decide,
  type Capability,
  type HeldAssignment,
  type HeldPartnerAssignment,
  type HeldPlatformAssignment,
  type PartnerRole,
  type PartnerRoleAssignment,
  type PrincipalContext,
} from '../../model/access.ts'
import {
  ACCESS_RESOURCE_CLASSES,
  CONTRACT_ONLY_RESOURCES,
  NON_DELEGABLE_RESOURCES,
  PERMITTED_RESOURCES,
} from '../../model/governance.ts'

type UserId = PrincipalContext['subject']['userId']
type PartnerId = NonNullable<PrincipalContext['partnerId']>
type TenantId = NonNullable<PrincipalContext['tenantId']>
type Timestamp = PrincipalContext['now']
type RoleId = PartnerRole['id']

const ANA = 'usr_northwind_ana' as UserId
const NORTHWIND = 'prt_northwind' as PartnerId
const CONTOSO = 'prt_contoso' as PartnerId
const NOW = '2026-10-01T00:00:00.000Z' as Timestamp

/** The verb §1 permits. Named, never counted. */
const PORTAL_VERB: Capability = CAPABILITIES.registerDeal

function partnerRole(caps: readonly Capability[], o: Partial<PartnerRole> = {}): PartnerRole {
  return {
    id: 'prl_nw_admin' as unknown as RoleId,
    partnerId: NORTHWIND,
    label: 'Partner administrator',
    key: 'partner_admin',
    version: 2,
    capabilities: caps,
    status: 'active',
    ...o,
  }
}

function holding(
  caps: readonly Capability[] = [PORTAL_VERB],
  roleO: Partial<PartnerRole> = {},
  assignO: Partial<PartnerRoleAssignment> = {},
): HeldPartnerAssignment {
  const role = partnerRole(caps, roleO)
  return {
    role,
    assignment: {
      id: 'pra_ana' as PartnerRoleAssignment['id'],
      partnerId: NORTHWIND,
      userId: ANA,
      roleId: role.id,
      roleVersion: 2,
      grantedBy: 'usr_northwind_owner' as UserId,
      grantedAt: '2026-09-01T00:00:00.000Z' as Timestamp,
      expiresAt: '2026-12-01T00:00:00.000Z' as Timestamp,
      revokedAt: null,
      ...assignO,
    },
  }
}

/** A portal session: no tenant (G726/G728), a partner door, one live portal role. */
function partnerStaff(o: Partial<PrincipalContext> = {}): PrincipalContext {
  return {
    subject: { userId: ANA, status: 'active' },
    tenantId: null,
    orgClass: ORG_CLASSES.partner,
    partnerId: NORTHWIND,
    partnerGrant: null,
    held: null,
    platformHeld: null,
    partnerHeld: [holding()],
    now: NOW,
    ...o,
  }
}

describe('R10 · decide()`s fifth arm — a partner firm`s own staff, on its own surface', () => {
  /* ---------------------------------------------------------------- *
   * 1. THE ALLOW ARM.
   * ---------------------------------------------------------------- */

  it('1 · a live portal role carrying the verb is PERMITTED, with no tenant at all', () => {
    const d = decide(partnerStaff(), PORTAL_VERB)
    assert.equal(d.allowed, true, `the fifth arm refused the one request it exists to permit: ${d.reason}`)
    assert.equal(d.reason, 'permitted')
    assert.deepEqual(d.via, [{ assignmentId: 'pra_ana', roleId: 'prl_nw_admin', roleVersion: 2 }])
  })

  it('1a · the permit carries `DENY_ALL` — a verb, never a dimension', () => {
    assert.deepEqual(decide(partnerStaff(), PORTAL_VERB).scope, DENY_ALL)
  })

  it('1b · the arm is tenant-INDEPENDENT: a bound tenant neither helps nor is read', () => {
    const d = decide(partnerStaff({ tenantId: 'ten_acme' as TenantId, held: [] }), PORTAL_VERB)
    assert.equal(d.allowed, true)
  })

  /* ---------------------------------------------------------------- *
   * 2. THE DIFFERENTIAL. One term removed at a time, refused BY NAME.
   * ---------------------------------------------------------------- */

  it('2a · the term ABSENT is `partner_staff_assignment_unreadable` — never read as `[]`', () => {
    const { partnerHeld: _omitted, ...without } = partnerStaff()
    assert.equal(decide(without, PORTAL_VERB).reason, 'partner_staff_assignment_unreadable')
    assert.equal(decide(partnerStaff({ partnerHeld: null }), PORTAL_VERB).reason, 'partner_staff_assignment_unreadable')
  })

  it('2b · `[]` — a reader ran and found none — is `partner_staff_assignment_absent`', () => {
    assert.equal(decide(partnerStaff({ partnerHeld: [] }), PORTAL_VERB).reason, 'partner_staff_assignment_absent')
  })

  it('2c · an unresolved firm is `partner_staff_partner_unresolved` — never compared against null', () => {
    assert.equal(decide(partnerStaff({ partnerId: null }), PORTAL_VERB).reason, 'partner_staff_partner_unresolved')
  })

  it('2d · a role OF ANOTHER FIRM is `partner_staff_other_partner` — the check the platform arm lacks', () => {
    const roleElsewhere = holding([PORTAL_VERB], { partnerId: CONTOSO })
    assert.equal(decide(partnerStaff({ partnerHeld: [roleElsewhere] }), PORTAL_VERB).reason, 'partner_staff_other_partner')
    const assignmentElsewhere = holding([PORTAL_VERB], {}, { partnerId: CONTOSO })
    assert.equal(
      decide(partnerStaff({ partnerHeld: [assignmentElsewhere] }), PORTAL_VERB).reason,
      'partner_staff_other_partner',
    )
    /* And the principal's own firm is the comparand, not the rows' agreement:
     * a Contoso principal holding a consistent Northwind pair is refused too. */
    assert.equal(decide(partnerStaff({ partnerId: CONTOSO }), PORTAL_VERB).reason, 'partner_staff_other_partner')
  })

  it('2e · revoked · expired · archived · version-moved · role-mismatch — each by name', () => {
    const cases: Array<[HeldPartnerAssignment, string]> = [
      [holding([PORTAL_VERB], {}, { revokedAt: '2026-09-15T00:00:00.000Z' as Timestamp }), 'partner_staff_assignment_revoked'],
      [holding([PORTAL_VERB], {}, { expiresAt: NOW }), 'partner_staff_assignment_expired'],
      [holding([PORTAL_VERB], { status: 'archived' }), 'partner_staff_role_not_active'],
      [holding([PORTAL_VERB], {}, { roleVersion: 1 }), 'partner_staff_role_version_moved'],
      [holding([PORTAL_VERB], {}, { roleId: 'prl_other' as unknown as RoleId }), 'assignment_role_mismatch'],
    ]
    for (const [h, reason] of cases) {
      const d = decide(partnerStaff({ partnerHeld: [h] }), PORTAL_VERB)
      assert.equal(d.allowed, false, reason)
      assert.equal(d.reason, reason)
    }
  })

  it('2f · a live role NOT carrying the verb is `no_partner_staff_assignment_carries_capability`', () => {
    const d = decide(partnerStaff({ partnerHeld: [holding([CAPABILITIES.viewDeals])] }), PORTAL_VERB)
    assert.equal(d.reason, 'no_partner_staff_assignment_carries_capability')
  })

  it('2g · a disabled person is refused at step one, before the arm', () => {
    assert.equal(
      decide(partnerStaff({ subject: { userId: ANA, status: 'disabled' } }), PORTAL_VERB).reason,
      'subject_not_active',
    )
  })

  /* ---------------------------------------------------------------- *
   * 3. INVARIANT 2. A portal role is never a door into a customer tenant.
   * ---------------------------------------------------------------- */

  it('3 · a portal role NAMING `view_exception` confers nothing — the fifth arm is never entered', () => {
    const smuggled = holding([CAPABILITIES.viewException, CAPABILITIES.exportData, PORTAL_VERB])
    const d = decide(
      partnerStaff({ tenantId: 'ten_acme' as TenantId, held: [], partnerHeld: [smuggled] }),
      CAPABILITIES.viewException,
    )
    assert.equal(d.allowed, false)
    assert.equal(
      d.reason,
      'partner_grant_absent',
      'a partner reached a customer`s exceptions on the strength of a PORTAL role. Invariant 2: ' +
        '"`partner_admin(P)` may read tenant `T` iff `T.partnerId = P`, and only within a live ' +
        '`PartnerAccessGrant`" — the fifth arm must be entered for partner-only classes ALONE.',
    )
    /* And on the console surface, with no tenant at all, the tenant term refuses it. */
    assert.equal(
      decide(partnerStaff({ partnerHeld: [smuggled] }), CAPABILITIES.viewException).reason,
      'principal_holds_no_tenant',
    )
  })

  it('3a · no partner-only verb is in any PARTNER_CAPABILITY_MASK scope — the mask stays the cross-tenant path', () => {
    for (const [scope, caps] of Object.entries(PARTNER_CAPABILITY_MASK)) {
      for (const c of caps) {
        assert.equal(capabilityIsPartnerOnly(c), false, `${c} is a portal verb inside mask scope ${scope}`)
      }
    }
  })

  /* ---------------------------------------------------------------- *
   * 4. THE FENCE, MIRRORED. Customer and platform principals never reach it.
   * ---------------------------------------------------------------- */

  it('4a · a CUSTOMER role carrying a portal verb is refused at `capability_is_partner_only`', () => {
    const customerHolding = {
      role: {
        tenantId: 'ten_acme', id: 'rol_admin', label: 'Admin', key: 'admin', version: 1,
        stakeholderClass: 'administrator', origin: 'tenant', packId: null,
        capabilities: [PORTAL_VERB], defaultScope: DENY_ALL, status: 'active',
      },
      assignment: {
        tenantId: 'ten_acme', id: 'ras_admin', userId: ANA, roleId: 'rol_admin', roleVersion: 1,
        scope: DENY_ALL, grantedBy: ANA, grantedAt: NOW, expiresAt: null, revokedAt: null,
      },
    } as unknown as HeldAssignment
    const d = decide(
      {
        subject: { userId: ANA, status: 'active' },
        tenantId: 'ten_acme' as TenantId,
        orgClass: ORG_CLASSES.customer,
        partnerId: null,
        partnerGrant: null,
        held: [customerHolding],
        now: NOW,
      },
      PORTAL_VERB,
    )
    assert.equal(d.allowed, false)
    assert.equal(d.reason, 'capability_is_partner_only')
  })

  it('4b · a PLATFORM role carrying a portal verb is refused — staff never act AS a partner', () => {
    const staffHolding = {
      role: {
        id: 'prl_support', label: 'Support', key: 'support', version: 1,
        stakeholderClass: 'administrator', capabilities: [PORTAL_VERB], status: 'active',
      },
      assignment: {
        id: 'pla_priya', userId: 'usr_1ch_priya', roleId: 'prl_support', roleVersion: 1,
        grantedBy: 'usr_1ch_owner', grantedAt: NOW, expiresAt: '2026-12-01T00:00:00.000Z', revokedAt: null,
      },
    } as unknown as HeldPlatformAssignment
    const d = decide(
      {
        subject: { userId: 'usr_1ch_priya' as UserId, status: 'active' },
        tenantId: null,
        orgClass: ORG_CLASSES.platform,
        partnerId: null,
        partnerGrant: null,
        held: null,
        platformHeld: [staffHolding],
        partnerHeld: [holding()],
        now: NOW,
      },
      PORTAL_VERB,
    )
    assert.equal(d.allowed, false)
    assert.equal(d.reason, 'capability_is_partner_only')
    for (const cls of PARTNER_ONLY_RESOURCE_CLASSES) {
      assert.equal(PLATFORM_ASSIGNMENT_REACHES[cls], false, `the platform arm reaches ${cls}`)
    }
  })

  /* ---------------------------------------------------------------- *
   * 5. THE TAXONOMY. Three classes, six verbs, every list answered.
   * ---------------------------------------------------------------- */

  it('5 · the partner-only classes are exactly the three R10 names, and every verb on them is fenced', () => {
    assert.deepEqual([...PARTNER_ONLY_RESOURCE_CLASSES].sort(), ['deal', 'partner_staff', 'sandbox'])
    const classes = new Set(Object.values(ACCESS_RESOURCE_CLASSES))
    for (const cls of PARTNER_ONLY_RESOURCE_CLASSES) assert.ok(classes.has(cls))
    const fenced = (Object.keys(CAPABILITY_RESOURCE_CLASS) as Capability[]).filter(capabilityIsPartnerOnly)
    assert.deepEqual(fenced.sort(), [
      'manage_partner_staff', 'operate_sandbox', 'register_deal',
      'view_deals', 'view_partner_staff', 'view_sandbox',
    ])
    /* Every partner-only class carries at least one verb — a class arriving
     * EMPTY would be the `schedule`/`telemetry` gap minted on purpose. */
    for (const cls of PARTNER_ONLY_RESOURCE_CLASSES) {
      assert.ok(fenced.some((c) => CAPABILITY_RESOURCE_CLASS[c] === cls), `${cls} has no verb`)
    }
  })

  it('5a · the two fences are DISJOINT, and no grant purpose or contract reaches a partner-only class', () => {
    for (const cls of PARTNER_ONLY_RESOURCE_CLASSES) {
      assert.equal(PLATFORM_ONLY_RESOURCE_CLASSES.includes(cls), false, `${cls} is on both fences — reachable by no arm`)
      assert.equal(NON_DELEGABLE_RESOURCES.includes(cls), false)
      assert.equal(CONTRACT_ONLY_RESOURCES.includes(cls), false)
      for (const [purpose, list] of Object.entries(PERMITTED_RESOURCES)) {
        assert.equal(list.includes(cls), false, `a ${purpose} TenantAccessGrant reaches ${cls}`)
      }
    }
  })

  it('5b · no customer stakeholder class may hold a portal verb', () => {
    const table = CAPABILITY_STAKEHOLDER_CLASSES as Record<Capability, readonly string[]>
    for (const c of (Object.keys(CAPABILITY_RESOURCE_CLASS) as Capability[]).filter(capabilityIsPartnerOnly)) {
      assert.deepEqual(table[c], [], `${c} is coherent for a customer stakeholder class`)
    }
  })
})

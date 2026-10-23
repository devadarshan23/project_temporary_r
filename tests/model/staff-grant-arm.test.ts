/**
 * ════════════════════════════════════════════════════════════════════════════
 * `decide()`'s STAFF-GRANT BRANCH — G2591, applying G2407 (THE OWNER'S RULING,
 * 1 Oct 2026): *"Full staff-grant branch — decide() honours the delivery
 * grant's whole class set on every mounted operation."*
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Pure: no database, no clock. Each assertion removes ONE term from the
 * request §1 permits and requires a refusal BY NAME, so an allow that held for
 * the wrong reason would show up as a refusal that held for the wrong reason.
 *
 * 🛑 §2 IS THE COST THE OWNER ACCEPTED, ASSERTED RATHER THAN NARRATED: a
 *    delivery grant naming `tenant_data` opens EVERY `tenant_data` verb, not
 *    one write. If somebody narrows the branch back to a per-operation list,
 *    §2 goes red and the narrowing has to be argued against the ruling.
 * 🛑 §4 IS INVARIANT 8's *"at any price"*: `statutory` stays unreachable with a
 *    grant in hand, and a grant naming it carries nothing at all.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  DECISION_REASONS,
  DENY_ALL,
  ORG_CLASSES,
  decide,
  holdsLiveStaffGrant,
  type Capability,
  type HeldStaffGrant,
  type PrincipalContext,
} from '../../model/access.ts'
import type { AccessResourceClass } from '../../model/governance.ts'

type UserId = PrincipalContext['subject']['userId']
type TenantId = NonNullable<PrincipalContext['tenantId']>
type Timestamp = PrincipalContext['now']

const FDE = 'usr_1ch_priya' as UserId
const ACME = 'ten_acme' as TenantId
const GLOBEX = 'ten_globex' as TenantId
const NOW = '2026-10-01T12:00:00.000Z' as Timestamp

function grant(overrides: Partial<HeldStaffGrant> = {}): HeldStaffGrant {
  return {
    id: 'tag_priya_acme' as HeldStaffGrant['id'],
    purpose: 'delivery',
    staffUserId: FDE,
    tenantId: ACME,
    grantedAt: '2026-10-01T00:00:00.000Z' as Timestamp,
    expiresAt: '2026-10-15T00:00:00.000Z' as Timestamp,
    revokedAt: null,
    resources: (['secret', 'configuration', 'tenant_data'] as AccessResourceClass[]).map(
      (resource) => ({ resource }),
    ),
    extensions: [],
    ...overrides,
  }
}

function fde(overrides: Partial<PrincipalContext> = {}): PrincipalContext {
  return {
    subject: { userId: FDE, status: 'active' },
    tenantId: ACME,
    orgClass: ORG_CLASSES.platform,
    partnerId: null,
    partnerGrant: null,
    held: [],
    platformHeld: [],
    staffGrant: grant(),
    now: NOW,
    ...overrides,
  }
}

describe('G2591 · decide() honours a live staff grant on the platform arm', () => {
  it('1 · a live delivery grant naming `secret` PERMITS `bind_secret`, and `via` names the grant', () => {
    const d = decide(fde(), CAPABILITIES.bindSecret)
    assert.equal(d.allowed, true, `the staff-grant branch refused a live grant: ${d.reason}`)
    assert.equal(d.reason, DECISION_REASONS.permitted)
    assert.deepEqual(
      d.via,
      [{ accessGrantId: 'tag_priya_acme', purpose: 'delivery' }],
      'invariant 10: the allow must NAME the grant it ran under, or the record says nothing ' +
        'about which authority an FDE used',
    )
    assert.deepEqual(d.scope, DENY_ALL, 'a grant carries no scope, so the allow asserts none')
  })

  it('1b · ANTI-VACUOUS — the same FDE with NO grant is refused, as before G2591', () => {
    const d = decide(fde({ staffGrant: null }), CAPABILITIES.bindSecret)
    assert.equal(d.allowed, false)
    assert.equal(d.reason, DECISION_REASONS.platform_class_out_of_reach)
    const absent = fde()
    delete absent.staffGrant
    assert.equal(decide(absent, CAPABILITIES.bindSecret).reason, DECISION_REASONS.platform_class_out_of_reach)
  })

  it('2 · THE OWNER\'S ACCEPTED COST — the grant opens EVERY verb of every class it names', () => {
    const tenantDataVerbs = (Object.keys(CAPABILITY_RESOURCE_CLASS) as Capability[]).filter(
      (c) => CAPABILITY_RESOURCE_CLASS[c] === 'tenant_data',
    )
    assert.ok(tenantDataVerbs.length > 5, 'the class has its verbs')
    for (const c of tenantDataVerbs) {
      const d = decide(fde(), c)
      assert.equal(
        d.allowed,
        true,
        `G2407 is the WHOLE class set, and \`${c}\` (tenant_data) was refused: ${d.reason}. ` +
          'A narrowing back to a per-operation allowlist is a different ruling than the one taken.',
      )
    }
  })

  it('3 · a class the grant does not name is refused by THE GRANT\'S reason', () => {
    const d = decide(fde({ staffGrant: grant({ resources: [{ resource: 'tenant_data' }] }) }), CAPABILITIES.bindSecret)
    assert.equal(d.allowed, false)
    assert.equal(d.reason, DECISION_REASONS.staff_grant_class_not_granted)
  })

  it('4 · `statutory` is refused WITH a grant in hand — invariant 8, "at any price"', () => {
    for (const c of [CAPABILITIES.placeLegalHold, CAPABILITIES.handleSubjectRequest]) {
      assert.equal(CAPABILITY_RESOURCE_CLASS[c], 'statutory')
      assert.equal(decide(fde(), c).reason, DECISION_REASONS.platform_class_never_delegable)
    }
    /* And a grant that NAMES it carries nothing at all — it fails whole. */
    const poisoned = grant({
      resources: [{ resource: 'secret' }, { resource: 'statutory' }],
    })
    const d = decide(fde({ staffGrant: poisoned }), CAPABILITIES.bindSecret)
    assert.equal(d.allowed, false)
    assert.equal(d.reason, DECISION_REASONS.staff_grant_not_live)
  })

  it('4b · `authority` stays contract-only — no grant opens `manage_roles`', () => {
    assert.equal(decide(fde(), CAPABILITIES.manageRoles).reason, DECISION_REASONS.platform_class_contract_only)
  })

  it('4c · an INCIDENT grant cannot carry `secret` — G75 widened delivery, not incident', () => {
    const d = decide(
      fde({ staffGrant: grant({ purpose: 'incident', expiresAt: '2026-10-01T20:00:00.000Z' as Timestamp }) }),
      CAPABILITIES.bindSecret,
    )
    assert.equal(d.allowed, false, 'an incident grant naming `secret` fails whole')
    assert.equal(d.reason, DECISION_REASONS.staff_grant_not_live)
  })

  it('5 · a REVOKED, EXPIRED, over-ceiling, other-person or other-tenant grant carries nothing', () => {
    const cases: Array<[string, Partial<HeldStaffGrant>]> = [
      ['revoked', { revokedAt: '2026-10-01T06:00:00.000Z' as Timestamp }],
      ['expired', { expiresAt: '2026-10-01T11:00:00.000Z' as Timestamp }],
      ['expiring exactly now', { expiresAt: NOW }],
      ['past the 90-day ceiling', { expiresAt: '2027-02-01T00:00:00.000Z' as Timestamp }],
      ['another person\'s', { staffUserId: 'usr_1ch_someone_else' as UserId }],
      ['another tenant\'s', { tenantId: GLOBEX }],
      ['unreadable purpose', { purpose: 'audit' as HeldStaffGrant['purpose'] }],
    ]
    for (const [label, o] of cases) {
      const d = decide(fde({ staffGrant: grant(o) }), CAPABILITIES.bindSecret)
      assert.equal(d.allowed, false, `a ${label} grant carried \`bind_secret\``)
      assert.equal(d.reason, DECISION_REASONS.staff_grant_not_live, label)
    }
  })

  it('6 · a tenant-less principal holding a grant is refused — a grant reaches a tenant or nothing', () => {
    const d = decide(fde({ tenantId: null }), CAPABILITIES.bindSecret)
    assert.equal(d.reason, DECISION_REASONS.staff_grant_without_tenant)
  })

  it('7 · DIFFERENTIAL — a CUSTOMER principal holding the same grant gains nothing from it', () => {
    const customer = fde({ orgClass: ORG_CLASSES.customer })
    const d = decide(customer, CAPABILITIES.bindSecret)
    assert.equal(d.allowed, false, 'the staff-grant branch leaked onto the customer arm')
    assert.equal(d.reason, DECISION_REASONS.no_live_assignment)
  })

  it('8 · a disabled FDE is refused before any grant is read', () => {
    const d = decide(fde({ subject: { userId: FDE, status: 'disabled' } }), CAPABILITIES.bindSecret)
    assert.equal(d.reason, DECISION_REASONS.subject_not_active)
  })

  it('9 · ONE predicate — selection and use agree, because both call `holdsLiveStaffGrant()`', () => {
    assert.equal(holdsLiveStaffGrant({ grant: grant(), userId: FDE, tenantId: ACME, now: NOW }), true)
    assert.equal(
      holdsLiveStaffGrant({ grant: grant({ revokedAt: NOW }), userId: FDE, tenantId: ACME, now: NOW }),
      false,
    )
  })
})

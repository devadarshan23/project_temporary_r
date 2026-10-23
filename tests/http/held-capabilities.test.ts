/**
 * `heldCapabilities()` — G3521, 3 Oct 2026 (DERIVED, NOT THE OWNER'S).
 *
 * The property under test is the one the function's header claims: it is the
 * GATE'S verdicts read back and never a second evaluator. Three arms:
 *
 *   §1  it asks the authoriser it is given — once per member of the closed set,
 *       with the same principal, in `CAPABILITIES`' order — and reports exactly
 *       what that authoriser said. A fixture authoriser is the witness, so a
 *       version that consulted anything else (a role list, a lookup table)
 *       would disagree with it.
 *   §2  over the PRODUCTION authoriser, the answer equals `decide()` asked
 *       directly, verb by verb, for a resolving substrate and for an
 *       unresolvable one.
 *   §3  the advisory list is EMPTY for a session `decide()` cannot resolve a
 *       principal for — the same answer the gate gives every gated operation.
 *
 * ⚠️ WITNESSED RED by replacing the body with
 * `Object.values(CAPABILITIES).filter(c => c.startsWith('view_'))` — a
 * plausible "readers see everything" shortcut — and all four (§1, §2, §2b, §3)
 * fail.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  DENY_ALL,
  ORG_CLASSES,
  decide,
  type Capability,
  type HeldAssignment,
  type PrincipalContext,
  type Role,
  type RoleAssignment,
} from '../../model/access.ts'
import {
  NO_IDENTITY_SUBSTRATE,
  capabilityAuthoriser,
  heldCapabilities,
  principalContextFor,
  type PrincipalSubstrate,
} from '../../server/data-plane/authorise.ts'
import type { TenantSession } from '../../server/data-plane/session.ts'

type UserId = PrincipalContext['subject']['userId']
type TenantId = NonNullable<PrincipalContext['tenantId']>
type Timestamp = PrincipalContext['now']

const TENANT = 'ten_acme' as TenantId
const USER = 'usr_ops_mei' as UserId
const NOW = '2026-10-03T00:00:00.000Z' as Timestamp
const ALL = Object.values(CAPABILITIES) as Capability[]

const SESSION: TenantSession = {
  tenantId: TENANT,
  sessionRef: 'a'.repeat(64),
  row: null,
  principal: null,
}

function holding(capabilities: Capability[]): HeldAssignment {
  const role = {
    tenantId: TENANT,
    id: 'rol_admin',
    label: 'Admin',
    key: 'admin',
    version: 1,
    stakeholderClass: 'operator',
    origin: 'tenant',
    packId: null,
    capabilities,
    defaultScope: DENY_ALL,
    status: 'active',
  } as unknown as Role
  const assignment = {
    tenantId: TENANT,
    id: 'ras_mei_admin',
    userId: USER,
    roleId: 'rol_admin',
    roleVersion: 1,
    scope: DENY_ALL,
    grantedBy: 'usr_bootstrap',
    grantedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    revokedAt: null,
  } as unknown as RoleAssignment
  return { role, assignment }
}

function customer(capabilities: Capability[]): PrincipalSubstrate {
  return {
    subject: { userId: USER, status: 'active' },
    orgClass: ORG_CLASSES.customer,
    partnerId: null,
    partnerGrant: null,
    held: [holding(capabilities)],
    platformHeld: null,
  }
}

describe('heldCapabilities — the gate`s verdicts, read back', () => {
  it('§1 · asks the given authoriser once per verb, in order, and reports exactly its `held` answers', () => {
    const asked: string[] = []
    const principals = new Set<unknown>()
    const chosen = new Set<string>([CAPABILITIES.configureEndpoint, CAPABILITIES.viewException])
    const fixture = (p: TenantSession, c: string) => {
      asked.push(c)
      principals.add(p)
      return chosen.has(c) ? ('held' as const) : ('not_held' as const)
    }
    const got = heldCapabilities(fixture, SESSION)
    assert.deepEqual(asked, ALL, 'it must ask about every verb in the closed set, in CAPABILITIES` order')
    assert.equal(principals.size, 1)
    assert.ok(principals.has(SESSION))
    /* CAPABILITIES' order, not the order the fixture's set was written in */
    assert.deepEqual(got, [CAPABILITIES.viewException, CAPABILITIES.configureEndpoint])
  })

  it('§2 · over the production authoriser it equals `decide()` asked directly, verb by verb', () => {
    for (const substrate of [
      customer([CAPABILITIES.viewException]),
      customer([CAPABILITIES.viewEndpoint, CAPABILITIES.configureEndpoint, CAPABILITIES.triggerRun]),
      customer([]),
    ]) {
      const got = heldCapabilities(capabilityAuthoriser(() => substrate, () => NOW), SESSION)
      const resolution = principalContextFor({ tenantId: TENANT, substrate, now: NOW })
      assert.ok(resolution.ok)
      const direct = ALL.filter((c) => decide(resolution.principal, c).allowed)
      assert.deepEqual(got, direct)
    }
  })

  it('§2b · a persona lacking `configure_endpoint` does not get it — the Setup verb is absent', () => {
    const got = heldCapabilities(
      capabilityAuthoriser(() => customer([CAPABILITIES.viewException]), () => NOW),
      SESSION,
    )
    /* G3881 — `view_run` is CARRIED by `view_exception`, so the gate allows it and
       the list (the gate asked once per verb) carries it, with no role row. */
    assert.deepEqual(got, [CAPABILITIES.viewException, CAPABILITIES.viewRun])
    assert.ok(!(got as readonly string[]).includes(CAPABILITIES.configureEndpoint))
  })

  it('§3 · a session no principal resolves for holds nothing', () => {
    const got = heldCapabilities(capabilityAuthoriser(() => NO_IDENTITY_SUBSTRATE, () => NOW), SESSION)
    assert.deepEqual(got, [])
  })
})

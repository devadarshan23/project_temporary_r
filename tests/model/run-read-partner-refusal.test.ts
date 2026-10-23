/**
 * RUN READS: OPEN TO A CUSTOMER WHO READS THE REGISTER, CLOSED TO A PARTNER.
 * **G3881, 4 Oct 2026**, applying THE OWNER'S RULING ON G3802, quoted:
 *
 *   *"Keep partners out: run reads open to customer roles holding
 *    view_exception, but are excluded from the partner capability mask;
 *    partners still see exceptions, not run residue."*
 *
 * THE SHAPE, AND WHY IT IS NOT A LIST OF OPERATIONS (G577's question):
 * `decide()` takes a capability and never an operation, and since G911 an
 * operation's verdict is read off its own `x-capability`. So the five run reads
 * name ONE verb, `view_run`; `view_exception` CARRIES it (`CAPABILITY_CARRIED_BY`)
 * on every arm, and `PARTNER_MASK_MEMBERSHIP.view_run` is `[]`, so the partner
 * arm refuses it at the mask before any role is read.
 *
 * §1 is the decide()-level differential, §2 the contract join that keeps it a
 * property of the OPERATION rather than of a list. The HTTP witness is
 * `tests/http/partner-arm-served.test.ts` §7.
 *
 * WITNESSED RED: with `roleCarries()` reduced to `role.capabilities.includes`,
 * §1a failed (`no_assignment_carries_capability` for the customer viewer); with
 * `view_run` added to the two exception scopes, §1b answered `permitted`.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

import {
  CAPABILITIES,
  CAPABILITY_CARRIED_BY,
  DENY_ALL,
  ORG_CLASSES,
  PARTNER_CAPABILITY_MASK,
  PARTNER_ACCESS_SCOPES,
  decide,
  type Capability,
  type HeldAssignment,
  type PrincipalContext,
} from '../../model/access.ts'

type UserId = PrincipalContext['subject']['userId']
type TenantId = NonNullable<PrincipalContext['tenantId']>
type PartnerId = NonNullable<PrincipalContext['partnerId']>
type Timestamp = PrincipalContext['now']
type Grant = NonNullable<PrincipalContext['partnerGrant']>

const NOW = '2026-10-04T00:00:00.000Z' as Timestamp
const ACME = 'ten_acme' as TenantId
const NORTHWIND = 'prt_northwind' as PartnerId
const RUN_READS = ['listRuns', 'getRun', 'getRunAccount', 'listRunResidue', 'listRunAllocations'] as const

function holding(caps: readonly Capability[], expiresAt: Timestamp | null): HeldAssignment {
  return {
    role: {
      tenantId: ACME, id: 'rol_viewer', label: 'Viewer', key: 'viewer', version: 1,
      stakeholderClass: 'viewer', origin: 'tenant', packId: null,
      capabilities: caps, defaultScope: DENY_ALL, status: 'active',
    },
    assignment: {
      tenantId: ACME, id: 'ras_v', userId: 'usr_v', roleId: 'rol_viewer', roleVersion: 1,
      scope: DENY_ALL, grantedBy: 'usr_admin', grantedAt: NOW, expiresAt, revokedAt: null,
    },
  } as unknown as HeldAssignment
}

const customerViewer = (caps: readonly Capability[] = [CAPABILITIES.viewException]): PrincipalContext => ({
  subject: { userId: 'usr_v' as UserId, status: 'active' },
  tenantId: ACME,
  orgClass: ORG_CLASSES.customer,
  partnerId: null,
  partnerGrant: null,
  held: [holding(caps, null)],
  now: NOW,
})

const partnerUnder = (scope: Grant['scope']): PrincipalContext => ({
  subject: { userId: 'usr_v' as UserId, status: 'active' },
  tenantId: ACME,
  orgClass: ORG_CLASSES.partner,
  partnerId: NORTHWIND,
  partnerGrant: {
    tenantId: ACME, partnerId: NORTHWIND, scope,
    expiresAt: '2026-12-01T00:00:00.000Z' as Timestamp, revokedAt: null,
  } as unknown as Grant,
  held: [holding([CAPABILITIES.viewException], '2026-12-01T00:00:00.000Z' as Timestamp)],
  now: NOW,
})

describe('G3881 · run reads — customers who read the register, never partners', () => {
  it('§1a · a customer viewer holding only view_exception is permitted view_run (carried, never stored)', () => {
    const d = decide(customerViewer(), CAPABILITIES.viewRun)
    assert.equal(d.allowed, true, `refused: ${d.reason}`)
    assert.equal(CAPABILITY_CARRIED_BY[CAPABILITIES.viewRun], CAPABILITIES.viewException)
  })

  it('§1a\' · a customer role without view_exception is refused view_run', () => {
    const d = decide(customerViewer([CAPABILITIES.viewDashboard]), CAPABILITIES.viewRun)
    assert.equal(d.allowed, false)
    assert.equal(d.reason, 'no_assignment_carries_capability')
  })

  it('§1b · a partner under each live scope keeps the register and is refused view_run AT THE MASK', () => {
    for (const scope of [PARTNER_ACCESS_SCOPES.exceptionsRead, PARTNER_ACCESS_SCOPES.exceptionsOperate]) {
      assert.equal(decide(partnerUnder(scope), CAPABILITIES.viewException).allowed, true, `${scope}: the register was refused, so the next refusal is not the mask`)
      const d = decide(partnerUnder(scope), CAPABILITIES.viewRun)
      assert.equal(d.allowed, false, `${scope}: a partner was permitted a run read`)
      assert.equal(d.reason, 'capability_outside_partner_mask')
    }
    for (const [scope, verbs] of Object.entries(PARTNER_CAPABILITY_MASK)) {
      assert.ok(!verbs.includes(CAPABILITIES.viewRun), `view_run is in the partner scope ${scope}`)
    }
  })

  it('§2 · every operation naming view_run is one of the five run reads, and all five name it with no partner-exposure acceptance', () => {
    const doc = parse(readFileSync(join(import.meta.dirname, '../../docs/contracts/capability.openapi.yaml'), 'utf8')) as {
      paths: Record<string, Record<string, { operationId?: string; 'x-capability'?: string; 'x-partner-exposure'?: string }>>
    }
    const named: string[] = []
    const all = new Map<string, { cap: string | undefined; exposure: string | undefined }>()
    for (const item of Object.values(doc.paths)) {
      for (const op of Object.values(item)) {
        if (typeof op !== 'object' || op === null || op.operationId === undefined) continue
        all.set(op.operationId, { cap: op['x-capability'], exposure: op['x-partner-exposure'] })
        if (op['x-capability'] === CAPABILITIES.viewRun) named.push(op.operationId)
      }
    }
    assert.deepEqual([...named].sort(), [...RUN_READS].sort())
    for (const id of RUN_READS) {
      assert.equal(all.get(id)?.exposure, undefined, `${id} still accepts a partner exposure`)
    }
    assert.equal(all.get('admitRun')?.cap, CAPABILITIES.triggerRun, 'starting a run is still trigger_run (G3801)')
  })
})

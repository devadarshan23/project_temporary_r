/**
 * THE DATA PLANE'S AUTHORISER ASKS `decide()` — AND THE ALLOW ARM IS THE
 * ASSERTION THAT MAKES THE REFUSAL MEAN ANYTHING.
 *
 * 🛑 WHY THIS FILE EXISTS. `server/data-plane/authorise.ts` replaced a
 * `denyAll` that *"reads neither of its parameters"* with a function that
 * resolves a `PrincipalContext` and calls the single evaluator. In a serving
 * process the two are INDISTINGUISHABLE: five of the seven terms
 * `PrincipalContext` needs have no producer — no `user`, no
 * `identity_connection`, no `role`, no `role_assignment`, no
 * `partner_access_grant` — so every request is refused either way.
 *
 * **A control whose only observable behaviour is refusal is
 * `docs/HANDOFF.md` §5.6 until something witnesses it deciding.** That is what
 * this file does, and it is the same argument `startDataPlane()`'s `authorise`
 * option makes for the gate one layer up: *"G200's gate can only be witnessed
 * by a MATCHED PAIR."*
 *
 * ⚠️ AND WHAT IT DOES NOT CLAIM, SO THE GREEN IS NOT MISREAD. Every substrate
 * below is a FIXTURE. Nothing in `server/` can produce one, `capabilityAuthoriser`
 * is called with `NO_IDENTITY_SUBSTRATE` in every serving path, and
 * `tests/http/deployed-path-cannot-be-permissive.test.ts` is what keeps it
 * that way. This file proves the MECHANISM is wired to the evaluator. It
 * proves nothing about anybody holding a capability.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPABILITIES,
  DENY_ALL,
  ORG_CLASSES,
  type HeldAssignment,
  type PrincipalContext,
  type Role,
  type RoleAssignment,
} from '../../model/access.ts'
import {
  NO_IDENTITY_SUBSTRATE,
  capabilityAuthoriser,
  denyAllCapabilities,
  principalContextFor,
  type PrincipalSubstrate,
} from '../../server/data-plane/authorise.ts'
import type { TenantSession } from '../../server/data-plane/session.ts'

type UserId = PrincipalContext['subject']['userId']
type TenantId = PrincipalContext['tenantId']
type Timestamp = PrincipalContext['now']

const TENANT = 'ten_acme' as TenantId
const USER = 'usr_ops_mei' as UserId
const NOW = '2026-09-19T00:00:00.000Z' as Timestamp

/**
 * ⚠️ `principal: null` ON EVERY SESSION IN THIS FILE, AND IT IS THE POINT
 * RATHER THAN BOILERPLATE — G299, 19 Sep 2026. `TenantSession.principal` is
 * what the real reader fills from `db/migrations/0009_identity_substrate.sql`;
 * these fixtures supply the substrate DIRECTLY, through `substrateFor`, so that
 * `principalContextFor()` and `decide()` are exercised without a database.
 * A session carrying `null` here proves the projection is not consulted, which
 * is what keeps this file a test of the EVALUATOR rather than of the reader.
 * The reader is witnessed over a socket in
 * `tests/http/identity-substrate-served.test.ts`.
 */
const SESSION: TenantSession = {
  tenantId: TENANT,
  sessionRef: 'a'.repeat(64),
  row: null,
  principal: null,
}

/**
 * A live role carrying one capability, and a live assignment pinned to it.
 *
 * ⚠️ `roleVersion` MATCHES `version` DELIBERATELY. `decide()` stops evaluating
 * an assignment whose pin has moved — *"a widened role is a NEW version and
 * needs consent"* — so a fixture that got this wrong would deny for a reason
 * that has nothing to do with what is under test, and the allow arm would
 * never go green no matter how correctly this file was wired.
 */
function liveHolding(): HeldAssignment {
  const role = {
    tenantId: TENANT,
    id: 'rol_ap_approver',
    label: 'AP Approver',
    key: 'approver',
    version: 3,
    stakeholderClass: 'operator',
    origin: 'pack',
    packId: 'pck_ap',
    capabilities: [CAPABILITIES.viewException],
    defaultScope: DENY_ALL,
    status: 'active',
  } as unknown as Role

  const assignment = {
    tenantId: TENANT,
    id: 'ras_mei_approver',
    userId: USER,
    roleId: 'rol_ap_approver',
    roleVersion: 3,
    scope: DENY_ALL,
    grantedBy: 'usr_acme_admin',
    grantedAt: '2026-01-01T00:00:00.000Z',
    /** ⚠️ NULL IS LEGAL HERE AND ONLY HERE: `DURABLE_ASSIGNMENT_PERMITTED`
     * admits a never-expiring assignment for the CUSTOMER row alone. */
    expiresAt: null,
    revokedAt: null,
  } as unknown as RoleAssignment

  return { role, assignment }
}

/** Every term present. The only substrate in the repository that resolves. */
function completeSubstrate(): PrincipalSubstrate {
  return {
    subject: { userId: USER, status: 'active' },
    orgClass: ORG_CLASSES.customer,
    partnerId: null,
    partnerGrant: null,
    held: [liveHolding()],
    /**
     * ⚠️ `null` IS THE RIGHT VALUE FOR A CUSTOMER AND NOT A MISSING FIXTURE.
     * G289's arm reads this term only after `orgClass` has said `platform`;
     * `[]` would claim a reader ran and found none, which nothing did.
     */
    platformHeld: null,
  }
}

describe('the data plane authoriser is the evaluator, not a renamed denyAll', () => {
  /* ---------------------------------------------------------------- *
   * THE ALLOW ARM. Without it every assertion below is vacuous.
   * ---------------------------------------------------------------- */

  it('1 · a complete substrate holding the verb answers `held`', () => {
    const authorise = capabilityAuthoriser(completeSubstrate, () => NOW)
    assert.equal(
      authorise(SESSION, CAPABILITIES.viewException),
      'held',
      'the authoriser refused a principal that `decide()` permits. Either the ' +
        'substrate is not reaching the evaluator, or the verdict is not coming back ' +
        'from it — and in both cases this file is the only thing that can tell, ' +
        'because in a serving process the answer is a refusal either way.',
    )
  })

  it('2 · the SAME substrate answers `not_held` for a verb the role does not carry', () => {
    const authorise = capabilityAuthoriser(completeSubstrate, () => NOW)
    assert.equal(authorise(SESSION, CAPABILITIES.approveResolution), 'not_held')
  })

  /* ---------------------------------------------------------------- *
   * ONE TERM AT A TIME. Each is a producer that does not exist.
   * ---------------------------------------------------------------- */

  const axes: ReadonlyArray<readonly [string, () => PrincipalSubstrate]> = [
    ['subject — there is no `user` table', () => ({ ...completeSubstrate(), subject: null })],
    ['orgClass — there is no `identity_connection` table', () => ({ ...completeSubstrate(), orgClass: null })],
    ['held — there is no `role_assignment` table', () => ({ ...completeSubstrate(), held: null })],
  ]

  for (const [why, substrate] of axes) {
    it(`3 · a missing ${why} refuses`, () => {
      const authorise = capabilityAuthoriser(substrate, () => NOW)
      assert.equal(authorise(SESSION, CAPABILITIES.viewException), 'not_held')
    })
  }

  it('4 · `held: []` DENIES rather than refusing, and the two states are different', () => {
    /* An empty array means a reader RAN and found nothing — `decide()` answers
     * `no_live_assignment`. `null` means there is no reader. Collapsing them
     * would make "nobody has granted this person anything" and "we cannot
     * tell" the same answer, and only one of those is a fact about the tenant. */
    const empty = principalContextFor({
      tenantId: TENANT,
      substrate: { ...completeSubstrate(), held: [] },
      now: NOW,
    })
    assert.equal(empty.ok, true, '`held: []` must RESOLVE — it is an answer, not an absence')

    const absent = principalContextFor({
      tenantId: TENANT,
      substrate: { ...completeSubstrate(), held: null },
      now: NOW,
    })
    assert.equal(absent.ok, false)
    assert.deepEqual(absent.ok === false ? absent.missing : [], ['held'])

    const authorise = capabilityAuthoriser(() => ({ ...completeSubstrate(), held: [] }), () => NOW)
    assert.equal(
      authorise(SESSION, CAPABILITIES.viewException),
      'not_held',
      'an EMPTY assignment list allowed a capability. That is the failure the brief ' +
        'over this slice names in bold: "do not make `held` an empty array that ' +
        'silently allows."',
    )
  })

  /* ---------------------------------------------------------------- *
   * THE PRODUCTION AUTHORISER.
   * ---------------------------------------------------------------- */

  it('5 · the production authoriser refuses, and refuses because FIVE terms are absent', () => {
    assert.equal(denyAllCapabilities(SESSION, CAPABILITIES.viewException), 'not_held')

    const resolution = principalContextFor({
      tenantId: TENANT,
      substrate: NO_IDENTITY_SUBSTRATE,
      now: NOW,
    })
    assert.equal(resolution.ok, false)
    assert.deepEqual(
      resolution.ok === false ? [...resolution.missing].sort() : [],
      ['held', 'orgClass', 'subject'],
      'the production substrate is missing a different set of terms than this ' +
        'repository records. `tests/http/deployed-path-cannot-be-permissive.test.ts` ' +
        'says the gap is "no `user`, `session`, `role` or `role_assignment` table" and ' +
        '`server/data-plane/authorise.ts` corrects it field by field: `partnerId` and ' +
        '`partnerGrant` are legitimately null for a customer, and the three named here ' +
        'are the ones with no producer at all.',
    )
  })

  it('6 · an unscoped session is refused before the evaluator is reached', () => {
    const unscoped: TenantSession = {
      tenantId: null,
      sessionRef: 'b'.repeat(64),
      row: null,
      principal: null,
    }
    const authorise = capabilityAuthoriser(completeSubstrate, () => NOW)
    assert.equal(
      authorise(unscoped, CAPABILITIES.viewException),
      'not_held',
      'a session with no bound tenant reached `decide()`. Invariant 1: the tenant a ' +
        'decision is made in comes from the session, and this one has none — D1 has ' +
        'not run for it.',
    )
  })

  it('7 · a capability string the model does not declare is refused, not thrown on', () => {
    const authorise = capabilityAuthoriser(completeSubstrate, () => NOW)
    assert.equal(
      authorise(SESSION, 'view_everything_forever'),
      'not_held',
      'a verb that is in no vocabulary can be decided by nobody. The boot fences in ' +
        '`mountTier()` and `tools/check-capability-annotations.mjs` are what make this ' +
        'unreachable; it is refused rather than thrown on so a contract/model drift ' +
        'states itself safely at the caller rather than as a 500.',
    )
  })
})

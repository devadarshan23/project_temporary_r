/**
 * THE RESOLUTION CHAIN, OVER A REAL POSTGRESQL — `db/migrations/0059_resolution_chain.sql`
 * and `server/data-plane/proposal-store.ts`. G656–G660, 19 Sep 2026.
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 1  No statement the store issues carries a TENANT PREDICATE.  INVARIANT 1  │
 * │ 2  The GRANTS, in both directions — what the app role may write and the    │
 * │    five things `0059` withholds by name.                          G358     │
 * │ 3  🛑 THE AVAILABILITY MIRROR: every disposition `listAvailableDispositions`│
 * │    marks unavailable is refused by `proposeResolution` WITH THE SAME CODE,  │
 * │    and every one it marks available is accepted.                           │
 * │ 4  The chain end to end: propose → approve ×2 → execute, and the exception  │
 * │    carries a resolution afterwards.                                        │
 * │ 5  🛑 THE RESTRICTIVE POLICIES: a proposal attributed to somebody else, and │
 * │    an approval attributed to somebody else, are refused BY THE DATABASE.    │
 * │ 6  🛑 FOUR EYES AT THE ROW — the same violation the handler refuses is      │
 * │    refused again by `approval_decision_insert_restrictive`, with the        │
 * │    handler BYPASSED. This is what makes two copies a MIRROR.      G658     │
 * │ 7  The TRIGGER: a resolution written without an `execute_resolution`        │
 * │    record is refused, and the SCOPE-keyed early return is witnessed.  G659  │
 * │ 8  Another tenant's proposal, by its exact id, is invisible.     INVARIANT 1│
 * │ 9  The RLS negative control — policy dropped, read fails closed.           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 EVERY WRITE BELOW MINTS A REAL AUTHORISATION RECORD ───────────────────┐
 * │ `asActor()` does what `authorisedHandler()` does, minus the socket: it     │
 * │ builds a `PrincipalContext`, calls `authorize()` — *"`authorize()` mints   │
 * │ an `AuthorizationGrant` and nothing else does"* — and writes the row with  │
 * │ `writeAuthorisationRecord()`, which sets `app.authorisation_ref`.          │
 * │                                                                            │
 * │ **INSERTING A GRANT ROW BY HAND WAS THE ALTERNATIVE AND IT IS REFUSED.**   │
 * │ The restrictive policies and the trigger all read that row, so a fixture   │
 * │ that wrote one directly would be testing the policies against a record     │
 * │ invariant 10 says cannot exist — and would go on passing after a change    │
 * │ that made `authorize()` refuse.                                            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type ScopedClient } from '../../db/tenant-scope.ts'
import {
  CAPABILITIES,
  CAPABILITY_RESOURCE_CLASS,
  DENY_ALL,
  MAX_AUTHORIZATION_SECONDS,
  ORG_CLASSES,
  authorize,
} from '../../model/access.ts'
import type { Capability, HeldAssignment, Role, RoleAssignment } from '../../model/access.ts'
import type { TenantId, Timestamp, UserId } from '../../model/kernel.ts'
import {
  mintAuthorizationGrantId,
  writeAuthorisationRecord,
} from '../../server/data-plane/authorisation-record.ts'
import { principalContextFor } from '../../server/data-plane/authorise.ts'
import type { PrincipalSubstrate } from '../../server/data-plane/authorise.ts'
import {
  createProposal,
  executeProposalNow,
  readAvailableDispositions,
  readProposal,
  readProposalsFor,
  recordApproval,
} from '../../server/data-plane/proposal-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RESOLUTION_CHAIN_DB_NAME'] ?? runScopedName('reconcile_resolution_chain_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const MEI = 'usr_ops_mei' as UserId
const VIK = 'usr_ops_vik' as UserId
const CHEN = 'usr_ops_chen' as UserId

const EXC = 'exc_acme_chain_0001'
/** No `valueAtRisk`, so a `requiresAdjustment` disposition is unavailable on it. */
const EXC_UNVALUED = 'exc_acme_chain_0002'
/** Low severity and no value — the gate is NOT armed, so `manual` is reachable. */
const EXC_LOW = 'exc_acme_chain_0003'
const GLOBEX_EXC = 'exc_globex_chain_0001'

const PACK = 'pck_ap'
const DEFINITION = 'def_ap_close'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/resolution-chain.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER THE SIX OPERATIONS G656 MOUNTED AT THE',
      '   DATABASE. A run in which it skipped is NOT evidence that four eyes are',
      '   enforced at the row, NOT evidence that a resolution cannot be written',
      '   without an authorisation record, and NOT evidence that the published',
      '   disposition list agrees with what the POST will accept.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the resolution-chain assertions', probe)

/* ------------------------------------------------------------------ *
 * THE ACTOR SEAM. See the header for why this mints rather than inserts.
 * ------------------------------------------------------------------ */

function holding(capability: Capability, roleId: string, user: UserId): HeldAssignment {
  const role = {
    tenantId: ACME,
    id: roleId,
    label: roleId,
    key: 'operator',
    version: 1,
    stakeholderClass: 'operator',
    origin: 'pack',
    packId: PACK,
    capabilities: [capability],
    defaultScope: DENY_ALL,
    status: 'active',
  } as unknown as Role

  const assignment = {
    tenantId: ACME,
    id: `ras_${roleId}_${user}`,
    userId: user,
    roleId,
    roleVersion: 1,
    scope: DENY_ALL,
    grantedBy: 'usr_acme_admin',
    grantedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    revokedAt: null,
  } as unknown as RoleAssignment

  return { role, assignment }
}

function substrateFor(user: UserId, capability: Capability): PrincipalSubstrate {
  return {
    subject: { userId: user, status: 'active' },
    orgClass: ORG_CLASSES.customer,
    partnerId: null,
    partnerGrant: null,
    held: [holding(capability, `rol_${capability}`, user)],
    platformHeld: null,
  }
}

const pool = await createAppPool(2)

/**
 * Run `fn` inside a tenant scope carrying a REAL invariant 10 record for
 * `capability`, exactly as `authorisedHandler()` does.
 */
async function asActor<T>(
  user: UserId,
  capability: Capability,
  resourceType: string,
  resourceId: string | null,
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const now = new Date().toISOString() as Timestamp
  const resolution = principalContextFor({
    tenantId: ACME as TenantId,
    substrate: substrateFor(user, capability),
    now,
  })
  assert.equal(resolution.ok, true, 'the fixture principal will not resolve')
  if (!resolution.ok) throw new Error('unreachable')

  const resourceClass = CAPABILITY_RESOURCE_CLASS[capability]
  const authorisation = authorize(resolution.principal, capability, {
    id: mintAuthorizationGrantId(),
    resource: { resourceClass, resourceType, resourceId, solutionId: null },
    ttlSeconds: Math.min(300, MAX_AUTHORIZATION_SECONDS[resourceClass]),
  })
  const grant = authorisation.grant
  assert.notEqual(
    grant,
    null,
    `\`authorize()\` refused the fixture principal for \`${capability}\` — ` +
      `\`${authorisation.decision.reason}\`. The fixture, not the subject under test.`,
  )
  if (grant === null) throw new Error('unreachable')
  /* G730 — `authorize()` returns a union now. This fixture's principal has a
   * tenant, so the tenant home is the only correct answer; narrowing rather
   * than casting is what makes a fixture that lost its tenant a RED test. */
  assert.equal(grant.home, 'tenant', 'the fixture principal minted a PLATFORM grant')
  if (grant.home !== 'tenant') throw new Error('unreachable')

  return withTenantScope(pool, ACME, async (tx) => {
    await writeAuthorisationRecord(tx, grant)
    return fn(tx)
  })
}

/* ------------------------------------------------------------------ *
 * THE FIXTURE. Three exceptions, one pack of four dispositions, one
 * approval policy requiring two distinct approvers and segregation.
 * ------------------------------------------------------------------ */

async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    for (const [tenant, id, severity, rank, currency] of [
      [ACME, EXC, 'critical', 0, 'SGD'],
      [ACME, EXC_UNVALUED, 'critical', 0, null],
      [ACME, EXC_LOW, 'low', 3, null],
      [GLOBEX, GLOBEX_EXC, 'critical', 0, 'SGD'],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            domain, definition_id, rule_label, severity, severity_rank,
            value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
            status, raised_at, explanation_summary, explanation_expected)
         VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
                 'finance', $3, 'Three-way match', $4, $5,
                 $6, CASE WHEN $6::text IS NULL THEN NULL ELSE 90000 END,
                 CASE WHEN $6::text IS NULL THEN NULL ELSE 2 END,
                 'open', now(),
                 'the invoice disagrees with the purchase order', 'the purchase order')`,
        [tenant, id, DEFINITION, severity, rank, currency],
      )
    }

    /* The definition projection — §1 of the migration. Both tenants, because
       §8's cross-tenant read must fail on RLS and not on a missing row. */
    for (const tenant of [ACME, GLOBEX]) {
      await mig.query(
        `INSERT INTO tenant.definition_archetype (tenant_id, definition_id, archetype, pack_key)
         VALUES ($1, $2, 'n_way_document_match', $3)`,
        [tenant, DEFINITION, PACK],
      )
    }

    /* FOUR dispositions, and the fourth is deliberately outside this
       archetype's families — `timing_difference` belongs to
       `set_reconciliation`, so §3 requires it to be FILTERED OUT rather than
       refused, which is the one behaviour a pack shipping several archetypes
       depends on. */
    for (const [key, label, family, reversibility, terminal, adj] of [
      ['write_off', 'Write off', 'charge_variance', 'irreversible', true, false],
      ['price_correction', 'Correct the price', 'price_variance', 'reversible', true, true],
      ['route_to_dispute', 'Raise a dispute', 'quantity_variance', 'reversible', false, false],
      ['timing_difference', 'Timing', 'timing_difference', 'reversible', true, false],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.disposition
           (tenant_id, pack_key, key, label, family, reversibility, terminal, requires_adjustment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ACME, PACK, key, label, family, reversibility, terminal, adj],
      )
    }

    /* Four eyes, mandatory at `critical`, no money floor — so `EXC` arms the
       gate on severity and `EXC_LOW` does not. */
    await mig.query(
      `INSERT INTO tenant.approval_config
         (tenant_id, quorum, mandatory_at_or_above, segregation_of_duties, escalate_after_hours)
       VALUES ($1, 2, 'critical', true, 48), ($2, 2, 'critical', true, 48)`,
      [ACME, GLOBEX],
    )

    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('the resolution chain, over a real PostgreSQL', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
  })

  /* ================================================================ *
   * §1 · INVARIANT 1 — NO TENANT PREDICATE ANYWHERE IN THE STORE.
   * ================================================================ */

  it('§1 · no statement the store issues carries a tenant predicate', async () => {
    const source = await readFile(
      new URL('../../server/data-plane/proposal-store.ts', import.meta.url),
      'utf8',
    )
    /* 🛑 THE `WHERE` CLAUSES ARE WHAT IS SCANNED, AND THE COLUMN APPEARS IN
       THIS FILE IN EXACTLY ONE OTHER SHAPE — as an INSERT VALUE, read from
       `current_setting('app.tenant_id')`, which is the GUC the scope set and
       not a caller's string. `tenant-isolation.test.ts` scans the same way. */
    for (const forbidden of [
      /WHERE[^;'`]*tenant_id\s*=\s*\$/i,
      /AND\s+tenant_id\s*=\s*\$/i,
      /tenant_id\s*=\s*ANY/i,
    ]) {
      assert.equal(
        forbidden.test(source),
        false,
        'THE STORE FILTERS BY TENANT IN TYPESCRIPT. Invariant 1: *"Tenant scope is derived ' +
          'from the session, never read from a request."* Row-level security supplies the ' +
          'predicate; a handler that also filtered would have two paths and one of them ' +
          `would eventually grow a different message. Matched: ${String(forbidden)}`,
      )
    }
  })

  /* ================================================================ *
   * §2 · THE GRANTS, IN BOTH DIRECTIONS.
   * ================================================================ */

  it('§2 · the app role may not write the three REFERENCE tables', async () => {
    /* 🛑 THE FOUR-EYES RULE IS ONLY WORTH HAVING IF THE ROW THAT DECLARES IT IS
       OUT OF REACH OF THE PERSON IT BINDS. A request path that could write
       `approval_config` could set its own quorum to one and `segregation_of_
       duties` to false, and then approve its own proposal — with every control
       in this file still passing. */
    const forged: readonly [string, string][] = [
      [
        'tenant.disposition',
        `INSERT INTO tenant.disposition (tenant_id, pack_key, key, label, family,
           reversibility, terminal, requires_adjustment)
         VALUES ('${ACME}', '${PACK}', 'forged', 'Forged', 'charge_variance',
                 'reversible', true, false)`,
      ],
      [
        'tenant.approval_config',
        `UPDATE tenant.approval_config SET quorum = 1, segregation_of_duties = false`,
      ],
      [
        'tenant.definition_archetype',
        `INSERT INTO tenant.definition_archetype (tenant_id, definition_id, archetype, pack_key)
         VALUES ('${ACME}', 'def_forged', 'set_reconciliation', '${PACK}')`,
      ],
    ]
    for (const [table, statement] of forged) {
      await withTenantScope(pool, ACME, async (tx) => {
        await assert.rejects(
          () => tx.query(statement),
          (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            assert.match(
              message,
              /permission denied/i,
              `\`${table}\` is writable by the app role. It is SEEDED REFERENCE DATA and a ` +
                'request path that could write it could mint the judgement it is about to ' +
                `make, or lower its own quorum. The database said: ${message}`,
            )
            return true
          },
        )
      }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(message, /permission denied|current transaction is aborted/i, message)
      })
    }
  })

  it('§2b · a proposal’s JUDGEMENT columns are not writable, and nothing may be DELETEd', async () => {
    const forged: readonly string[] = [
      `UPDATE tenant.resolution_proposal SET disposition_key = 'route_to_dispute'`,
      `UPDATE tenant.resolution_proposal SET rationale = 'rewritten'`,
      `UPDATE tenant.resolution_proposal SET proposed_by_user_id = '${VIK}'`,
      `UPDATE tenant.approval_decision SET decision = 'approved'`,
      `DELETE FROM tenant.approval_decision`,
      `DELETE FROM tenant.resolution_proposal`,
    ]
    for (const statement of forged) {
      await withTenantScope(pool, ACME, async (tx) => {
        await assert.rejects(
          () => tx.query(statement),
          (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            assert.match(
              message,
              /permission denied/i,
              'A proposal approved for one disposition and executed as another is a laundered ' +
                'decision with two signatures on it; an amended decision rewrites who approved ' +
                `what. The database said: ${message}`,
            )
            return true
          },
        )
      }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(message, /permission denied|current transaction is aborted/i, message)
      })
    }
  })

  /* ================================================================ *
   * §3 · 🛑 THE AVAILABILITY MIRROR.
   * ================================================================ */

  it('§3 · every disposition the list marks UNAVAILABLE is refused by the POST with the SAME code', async () => {
    const listed = await asActor(MEI, CAPABILITIES.viewException, 'Exception', EXC_UNVALUED, (tx) =>
      readAvailableDispositions(tx, EXC_UNVALUED),
    )
    assert.equal(listed.ok, true)
    if (!listed.ok) return

    assert.equal(
      listed.value.archetype,
      'n_way_document_match',
      '`archetype` is `required` on this 200 and comes from `tenant.definition_archetype`.',
    )
    assert.equal(listed.value.packKey, PACK)

    /* 🛑 THE OUT-OF-ARCHETYPE DISPOSITION IS FILTERED, NOT REFUSED. A pack may
       ship dispositions for several archetypes; `timing_difference` belongs to
       `set_reconciliation` and this definition is `n_way_document_match`. */
    const keys = listed.value.dispositions.map((d) => d['key'])
    assert.deepEqual(
      [...keys].sort(),
      ['price_correction', 'route_to_dispute', 'write_off'],
      'the archetype filter is wrong. `DISPOSITION_FAMILIES` is keyed by archetype and *"a ' +
        'pack parameterises within an archetype and can never extend it"* — a flat family ' +
        'membership test would offer `timing_difference` on an N-way match.',
    )

    /* THE MIRROR. `EXC_UNVALUED` has no `valueAtRisk`, so the one disposition
       requiring an adjustment can never be satisfied — and the list says so
       with the code the POST will answer. */
    for (const disposition of listed.value.dispositions) {
      const key = disposition['key'] as string
      const available = disposition['available'] as boolean
      /* 🛑 THE ADJUSTMENT IS SENT EXACTLY WHEN THE DISPOSITION ASKS FOR ONE,
         which is what a client reading this list would do. Sending one
         unconditionally tests a DIFFERENT refusal — an adjustment on an
         unvalued finding is refused whatever the disposition — and the first
         draft of this assertion did exactly that and went red on `write_off`,
         which is the mirror catching the TEST rather than the code. */
      const requiresAdjustment = disposition['requiresAdjustment'] as boolean
      const posted = await asActor(MEI, CAPABILITIES.proposeResolution, 'Exception', EXC_UNVALUED, (tx) =>
        createProposal(
          tx,
          EXC_UNVALUED,
          {
            dispositionKey: key,
            rationale: 'the vendor reissued the invoice',
            evidence: [],
            ...(requiresAdjustment
              ? { adjustment: { currency: 'SGD', amountMinor: '100', exponent: 2 } }
              : {}),
          },
          { userId: MEI, now: new Date().toISOString() as Timestamp, proposalId: `prp_mirror_${key}` },
        ),
      )

      if (available) {
        assert.equal(
          posted.ok,
          true,
          `\`${key}\` is published as AVAILABLE and the POST refused it — ` +
            `\`${posted.ok ? '' : posted.refusal.kind}\`. **A list whose \`available\` ` +
            'disagrees with the POST teaches an operator to pick the thing that will fail.**',
        )
        continue
      }

      assert.equal(posted.ok, false, `\`${key}\` is published as UNAVAILABLE and the POST took it`)
      if (posted.ok) continue
      assert.equal(
        posted.refusal.kind,
        disposition['unavailableFor'],
        `\`${key}\` is published as unavailable for \`${String(disposition['unavailableFor'])}\` ` +
          `and the POST refused it for \`${posted.refusal.kind}\`. The two must be the SAME ` +
          'code, or `unavailableFor` is a guess about a refusal that has not been made.',
      )
    }
  })

  /* ================================================================ *
   * §4 · THE CHAIN, END TO END.
   * ================================================================ */

  it('§4 · propose → approve ×2 → execute, and the exception carries a resolution', async () => {
    const proposalId = 'prp_chain_0001'
    const created = await asActor(MEI, CAPABILITIES.proposeResolution, 'Exception', EXC, (tx) =>
      createProposal(
        tx,
        EXC,
        { dispositionKey: 'write_off', rationale: 'below the pursuit threshold', evidence: [] },
        { userId: MEI, now: new Date().toISOString() as Timestamp, proposalId },
      ),
    )
    assert.equal(created.ok, true, created.ok ? '' : `propose refused: ${created.refusal.kind}`)
    if (!created.ok) return

    const execution = created.value['execution'] as Record<string, unknown>
    assert.equal(execution['state'], 'not_approved')
    const required = execution['requiredApprovals'] as Record<string, unknown>
    assert.equal(required['quorum'], 2)
    assert.equal(required['segregationOfDuties'], true)
    assert.equal(required['mandatoryAtOrAbove'], 'critical')
    assert.equal(
      'secondApproverAbove' in required,
      false,
      '`secondApproverAbove` is published. It comes *"From the `human` step, not from ' +
        'policy — the two are separate gates and BOTH must be satisfied"*, and there is no ' +
        'procedure-step table; mapping the POLICY threshold onto it collapses two gates and ' +
        'reports the collapse as satisfaction.',
    )

    /* 🛑 THE PROPOSAL MOVED THE EXCEPTION TO `pending_approval` AND NOT TO
       `resolution_proposed`, because the gate IS armed at `critical`. Those
       two words are the difference between "somebody must sign this" and
       "somebody may execute it". */
    await asActor(MEI, CAPABILITIES.viewException, 'Exception', EXC, async (tx) => {
      const rows = (await tx.query('SELECT status FROM tenant.exception WHERE id = $1', [EXC]))
        .rows as unknown as { status: string }[]
      assert.equal(rows[0]?.status, 'pending_approval')
    })

    /* One approval: approved and NOT executable. */
    const first = await asActor(VIK, CAPABILITIES.approveResolution, 'ResolutionProposal', proposalId, (tx) =>
      recordApproval(
        tx,
        proposalId,
        { decision: 'approved' },
        { userId: VIK, now: new Date().toISOString() as Timestamp, decisionId: 'apd_1' },
      ),
    )
    assert.equal(first.ok, true, first.ok ? '' : `approve refused: ${first.refusal.kind}`)
    if (!first.ok) return
    const afterOne = first.value['execution'] as Record<string, unknown>
    assert.equal(
      afterOne['state'],
      'approved_pending_second_approver',
      '*"A client that treats HTTP 200 on this operation as done will show a green tick over ' +
        'an exception nobody has authorised to move money."*',
    )
    assert.deepEqual(afterOne['blockedBy'], ['approval_quorum_unmet'])

    /* Executing now is the CENTRAL 409. */
    const early = await asActor(CHEN, CAPABILITIES.executeResolution, 'ResolutionProposal', proposalId, (tx) =>
      executeProposalNow(tx, proposalId, { userId: CHEN, now: new Date().toISOString() as Timestamp }),
    )
    assert.equal(early.ok, false)
    if (early.ok) return
    assert.equal(early.refusal.kind, 'not_executable')

    /* Second distinct approver clears the quorum. */
    const second = await asActor(CHEN, CAPABILITIES.approveResolution, 'ResolutionProposal', proposalId, (tx) =>
      recordApproval(
        tx,
        proposalId,
        { decision: 'approved' },
        { userId: CHEN, now: new Date().toISOString() as Timestamp, decisionId: 'apd_2' },
      ),
    )
    assert.equal(second.ok, true, second.ok ? '' : `approve refused: ${second.refusal.kind}`)
    if (!second.ok) return
    assert.equal((second.value['execution'] as Record<string, unknown>)['state'], 'executable')

    /* Execute. */
    const done = await asActor(CHEN, CAPABILITIES.executeResolution, 'ResolutionProposal', proposalId, (tx) =>
      executeProposalNow(tx, proposalId, { userId: CHEN, now: new Date().toISOString() as Timestamp }),
    )
    assert.equal(done.ok, true, done.ok ? '' : `execute refused: ${done.refusal.kind}`)
    if (!done.ok) return

    const resolution = done.value['resolution'] as Record<string, unknown>
    assert.equal(resolution['mode'], 'approved')
    assert.equal(resolution['dispositionKey'], 'write_off')
    assert.equal(done.value['closedException'], true, '`write_off` is terminal')
    assert.equal(done.value['routedToProcedureId'], null)

    /* 🛑 THE THREE FIELDS G660 PUT ON THE WIRE, AND THE ONE IT DID NOT. */
    assert.deepEqual(
      resolution['approvedBy'],
      [VIK, CHEN],
      '`approvedBy` is *"EVERY approver, not one"* and is DERIVED from ' +
        '`tenant.approval_decision`. A quorum of two publishing one name loses a signature.',
    )
    assert.equal(resolution['executedBy'], CHEN)
    assert.equal(
      resolution['decidedBy'],
      VIK,
      '`decidedBy` is the FIRST approver and a lossy projection of `approvedBy` — the ' +
        'contract now says so at the field, and this is the pin that keeps it true.',
    )
    assert.equal(
      'policyEvaluationId' in resolution,
      false,
      '`policyEvaluationId` reached the wire. It belongs to `mode: autonomous`, which nothing ' +
        'here can reach — no agent proposer, no `policy` table, no policy evaluation. A wire ' +
        'field ahead of its writer reads as a fact that merely happens to be null.',
    )

    /* And the exception itself. */
    const read = await asActor(MEI, CAPABILITIES.viewException, 'Exception', EXC, async (tx) => {
      const rows = (
        await tx.query(
          'SELECT status, resolution_mode, resolution_executed_by FROM tenant.exception WHERE id = $1',
          [EXC],
        )
      ).rows as unknown as { status: string; resolution_mode: string; resolution_executed_by: string }[]
      return rows[0]
    })
    assert.equal(read?.status, 'resolved')
    assert.equal(read?.resolution_mode, 'approved')
    assert.equal(read?.resolution_executed_by, CHEN)

    /* 🛑 AND `reverseResolution`'s FIRST OBSTACLE IS NOW CLOSED, WHICH IS THE
       ONE THING THIS ASSERTION IS ALSO FOR. G359 said *"nothing can produce a
       resolution, so its only reachable answer is its own 409"*; a row with
       `resolution_mode IS NOT NULL` now exists. **The SECOND obstacle is
       not** — see §10. */
  })

  it('§4b · below the severity floor with no money floor, the mode is `manual` and nobody approved', async () => {
    const proposalId = 'prp_chain_manual'
    const created = await asActor(MEI, CAPABILITIES.proposeResolution, 'Exception', EXC_LOW, (tx) =>
      createProposal(
        tx,
        EXC_LOW,
        { dispositionKey: 'route_to_dispute', rationale: 'ask the vendor', evidence: [] },
        { userId: MEI, now: new Date().toISOString() as Timestamp, proposalId },
      ),
    )
    assert.equal(created.ok, true, created.ok ? '' : `propose refused: ${created.refusal.kind}`)
    if (!created.ok) return
    assert.equal(
      (created.value['execution'] as Record<string, unknown>)['state'],
      'executable',
      '*"Below this severity the disposition may resolve without approval."*',
    )

    const done = await asActor(MEI, CAPABILITIES.executeResolution, 'ResolutionProposal', proposalId, (tx) =>
      executeProposalNow(tx, proposalId, { userId: MEI, now: new Date().toISOString() as Timestamp }),
    )
    assert.equal(done.ok, true, done.ok ? '' : `execute refused: ${done.refusal.kind}`)
    if (!done.ok) return
    const resolution = done.value['resolution'] as Record<string, unknown>
    assert.equal(
      resolution['mode'],
      'manual',
      'a resolution with no approver published `approved`. The model: the `manual` arm exists ' +
        'because *"a manual execution requiring no approval recorded the proposer … and never ' +
        'the person who actually acted."*',
    )
    assert.equal(resolution['executedBy'], MEI)
    assert.deepEqual(resolution['approvedBy'], [])
    assert.equal(resolution['decidedBy'], null)
    assert.equal(
      done.value['closedException'],
      false,
      '`route_to_dispute` is NON-TERMINAL — *"It routes to another procedure"* — so the ' +
        'exception does not close.',
    )
  })

  /* ================================================================ *
   * §5 · THE RESTRICTIVE POLICIES — AUTHORSHIP, READ OFF THE RECORD.
   * ================================================================ */

  it('§5 · a proposal attributed to somebody other than the acting subject is refused BY THE DATABASE', async () => {
    /* The handler cannot produce this — it passes `ctx.principal` — so the
       statement is issued directly, inside a scope carrying MEI's record. */
    await assert.rejects(
      () =>
        asActor(MEI, CAPABILITIES.proposeResolution, 'Exception', EXC_LOW, (tx) =>
          tx.query(
            `INSERT INTO tenant.resolution_proposal
               (tenant_id, id, exception_id, proposed_by_kind, proposed_by_user_id,
                disposition_key, rationale, proposed_at)
             VALUES (nullif(current_setting('app.tenant_id', true), ''), 'prp_forged', $1,
                     'user', $2, 'write_off', 'not mine', now())`,
            [EXC_LOW, VIK],
          ),
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /row-level security/i,
          'A PROPOSAL WAS ATTRIBUTED TO SOMEBODY WHO DID NOT MAKE IT. ' +
            '`resolution_proposal_insert_restrictive` compares `proposed_by_user_id` against ' +
            'the acting subject on the act’s OWN authorisation record — `0018`’s rule: one ' +
            `name, one source, read off the record. The database said: ${message}`,
        )
        return true
      },
    )
  })

  it('§5b · an INSERT with no authorisation record at all is refused', async () => {
    /* 🛑 THE WHOLE POINT OF G507's RECEIPT: the GUC names a ROW, so setting it
       to a value for which no row exists opens nothing. Here it is unset. */
    await assert.rejects(
      () =>
        withTenantScope(pool, ACME, (tx) =>
          tx.query(
            `INSERT INTO tenant.resolution_proposal
               (tenant_id, id, exception_id, proposed_by_kind, proposed_by_user_id,
                disposition_key, rationale, proposed_at)
             VALUES (nullif(current_setting('app.tenant_id', true), ''), 'prp_norec', $1,
                     'user', $2, 'write_off', 'no record', now())`,
            [EXC_LOW, MEI],
          ),
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(message, /row-level security/i, message)
        return true
      },
    )
  })

  it('§5c · a forged `app.authorisation_ref` naming no row opens nothing', async () => {
    await assert.rejects(
      () =>
        withTenantScope(pool, ACME, async (tx) => {
          await tx.query('SELECT set_config($1, $2, true)', [
            'app.authorisation_ref',
            'azg_0000000000000000000000000000000f',
          ])
          return tx.query(
            `INSERT INTO tenant.resolution_proposal
               (tenant_id, id, exception_id, proposed_by_kind, proposed_by_user_id,
                disposition_key, rationale, proposed_at)
             VALUES (nullif(current_setting('app.tenant_id', true), ''), 'prp_forgedref', $1,
                     'user', $2, 'write_off', 'forged ref', now())`,
            [EXC_LOW, MEI],
          )
        }),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /row-level security/i,
          'A FORGED GRANT ID OPENED THE TABLE. *"It is a NAME, not a CLAIM"* — the row must ' +
            `exist, be in this scope, carry the right capability and be unexpired. ${message}`,
        )
        return true
      },
    )
  })

  /* ================================================================ *
   * §6 · 🛑 FOUR EYES AT THE ROW, WITH THE HANDLER BYPASSED.
   * ================================================================ */

  it('§6 · the proposer cannot approve their own proposal — refused by the HANDLER and by the DATABASE', async () => {
    const proposalId = 'prp_foureyes'
    const created = await asActor(MEI, CAPABILITIES.proposeResolution, 'Exception', EXC_UNVALUED, (tx) =>
      createProposal(
        tx,
        EXC_UNVALUED,
        { dispositionKey: 'write_off', rationale: 'mine', evidence: [] },
        { userId: MEI, now: new Date().toISOString() as Timestamp, proposalId },
      ),
    )
    assert.equal(created.ok, true, created.ok ? '' : `propose refused: ${created.refusal.kind}`)

    /* HALF ONE — the handler, through `model/approval.ts`. */
    const byHandler = await asActor(MEI, CAPABILITIES.approveResolution, 'ResolutionProposal', proposalId, (tx) =>
      recordApproval(
        tx,
        proposalId,
        { decision: 'approved' },
        { userId: MEI, now: new Date().toISOString() as Timestamp, decisionId: 'apd_self' },
      ),
    )
    assert.equal(byHandler.ok, false)
    if (byHandler.ok) return
    assert.equal(
      byHandler.refusal.kind,
      'segregation_violation',
      '`model/approval.ts`’s `segregationViolated()` did not fire. *"The same person ' +
        'approving their own proposal is not a policy nuance; it is the control being ' +
        'absent."*',
    )

    /**
     * HALF TWO — THE DATABASE, WITH THE HANDLER BYPASSED ENTIRELY.
     *
     * 🛑 THIS IS WHAT MAKES TWO COPIES A MIRROR RATHER THAN `0002`'s THIRD
     *    PLACE TO DRIFT. `0008` states the rule for its own copy of
     *    `model/governance.ts`: a copy is a mirror when a test asserts the
     *    agreement in BOTH directions. Delete `segregationViolated()` from the
     *    handler and the assertion above goes red; delete the `NOT EXISTS`
     *    disjunct from `approval_decision_insert_restrictive` and this one
     *    does.
     */
    await assert.rejects(
      () =>
        asActor(MEI, CAPABILITIES.approveResolution, 'ResolutionProposal', proposalId, (tx) =>
          tx.query(
            `INSERT INTO tenant.approval_decision
               (tenant_id, id, proposal_id, exception_id, decided_by, decision,
                requested_at, decided_at)
             VALUES (nullif(current_setting('app.tenant_id', true), ''), 'apd_selfraw', $1, $2,
                     $3, 'approved', now(), now())`,
            [proposalId, EXC_UNVALUED, MEI],
          ),
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /row-level security/i,
          'THE DATABASE LET THE PROPOSER APPROVE THEIR OWN PROPOSAL. The handler refuses it ' +
            'too, and a control that lives only in a handler stops existing the moment a ' +
            `second writer arrives by another route. The database said: ${message}`,
        )
        return true
      },
    )
  })

  it('§6b · with `segregation_of_duties` FALSE the database permits it — the column is read', async () => {
    /* Without this arm, a policy that refused every self-approval
       unconditionally would pass §6 while ignoring the tenant's own setting —
       and the `EXISTS (… approval_config …)` would be asserting nothing. */
    const mig = await migratorClient()
    try {
      await mig.query('UPDATE tenant.approval_config SET segregation_of_duties = false WHERE tenant_id = $1', [ACME])
    } finally {
      await mig.end()
    }

    const proposalId = 'prp_relaxed'
    await asActor(MEI, CAPABILITIES.proposeResolution, 'Exception', EXC_UNVALUED, (tx) =>
      createProposal(
        tx,
        EXC_UNVALUED,
        { dispositionKey: 'write_off', rationale: 'mine again', evidence: [] },
        { userId: MEI, now: new Date().toISOString() as Timestamp, proposalId },
      ),
    )
    const selfApproved = await asActor(MEI, CAPABILITIES.approveResolution, 'ResolutionProposal', proposalId, (tx) =>
      recordApproval(
        tx,
        proposalId,
        { decision: 'approved' },
        { userId: MEI, now: new Date().toISOString() as Timestamp, decisionId: 'apd_relaxed' },
      ),
    )
    assert.equal(
      selfApproved.ok,
      true,
      'the self-approval was refused with `segregation_of_duties` FALSE, so neither the ' +
        'handler nor the policy is reading the column and §6 proves nothing about it.',
    )

    const restore = await migratorClient()
    try {
      await restore.query('UPDATE tenant.approval_config SET segregation_of_duties = true WHERE tenant_id = $1', [ACME])
    } finally {
      await restore.end()
    }
  })

  /* ================================================================ *
   * §7 · THE TRIGGER.
   * ================================================================ */

  it('§7 · a resolution written without an `execute_resolution` record is refused, even with a VALID record for another verb', async () => {
    /**
     * 🛑 THE `view_exception` RECORD IS THE POINT. A trigger that merely
     *    required `app.authorisation_ref` to name SOME row would pass this,
     *    and every read on this plane carries one — so the capability term is
     *    what makes the guard mean anything.
     */
    await assert.rejects(
      () =>
        asActor(MEI, CAPABILITIES.viewException, 'Exception', EXC_LOW, (tx) =>
          tx.query(
            `UPDATE tenant.exception
                SET resolution_mode = 'manual', resolution_disposition_key = 'write_off',
                    resolution_proposal_id = 'prp_forged', resolution_at = now()
              WHERE id = $1`,
            [EXC_LOW],
          ),
        ),
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        assert.match(
          message,
          /carries no execute_resolution authorisation record/i,
          'A RESOLUTION WAS WRITTEN UNDER A READ’S AUTHORISATION. The trigger keys on the ' +
            `CAPABILITY and not merely on the presence of a record. It said: ${message}`,
        )
        return true
      },
    )
  })

  it('§7b · the trigger governs the REQUEST PATH and lets the migrator seed — the guard is keyed on the SCOPE', async () => {
    /**
     * 🛑 THE EARLY RETURN IS NOT A HOLE AND THIS ASSERTION IS WHY. It fires
     *    only when `app.tenant_id` is unset, and under G100 a `NOBYPASSRLS`
     *    role with no scope SEES NO ROW and can therefore UPDATE none — so the
     *    only writer that reaches it is a `BYPASSRLS` one, which is the
     *    migrator, and *"rows arrive as the migrator"* is `0015`'s own
     *    sentence about how this table is populated.
     */
    const mig = await migratorClient()
    try {
      const result = await mig.query(
        `UPDATE tenant.exception SET status = 'investigating'
          WHERE tenant_id = $1 AND id = $2`,
        [ACME, EXC_UNVALUED],
      )
      assert.equal(
        (result as { rowCount?: number }).rowCount,
        1,
        'the migrator can no longer seed a status. The trigger’s scope gate has become a role ' +
          'gate, or has lost its early return — and `0015` says rows arrive as the migrator.',
      )
    } finally {
      await mig.end()
    }

    /* AND THE APP ROLE, UNSCOPED, SEES NOTHING — which is the half that makes
       the early return unreachable from a request path. */
    const client = await pool.connect()
    try {
      const rows = (await client.query('SELECT id FROM tenant.exception')).rows
      assert.equal(
        rows.length,
        0,
        'THE APP ROLE READ A ROW OUTSIDE A TENANT SCOPE. G100’s deny-on-NULL is what makes ' +
          'the trigger’s scope gate safe; without it the early return is a hole.',
      )
    } finally {
      client.release()
    }
  })

  /* ================================================================ *
   * §8 · INVARIANT 1 — ANOTHER TENANT'S PROPOSAL.
   * ================================================================ */

  it('§8 · another tenant’s exception and proposal are invisible, by their exact ids', async () => {
    const listed = await asActor(MEI, CAPABILITIES.viewException, 'Exception', GLOBEX_EXC, (tx) =>
      readProposalsFor(tx, GLOBEX_EXC),
    )
    assert.equal(listed.ok, false)
    if (listed.ok) return
    assert.equal(
      listed.refusal.kind,
      'not_found',
      'GLOBEX’s exception was visible from ACME’s scope. There is no tenant predicate in the ' +
        'store; row-level security is the whole of the control.',
    )

    const one = await asActor(MEI, CAPABILITIES.viewException, 'ResolutionProposal', 'prp_chain_0001', (tx) =>
      readProposal(tx, 'prp_chain_0001'),
    )
    assert.equal(one.ok, true, 'ACME cannot read its OWN proposal, so §8 proves nothing')
  })

  /* ================================================================ *
   * §9 · THE NEGATIVE CONTROL — database isolation, not a handler's WHERE.
   * ================================================================ */

  it('§9 · 🛑 THE CONTROL — with the policy dropped, the same read FAILS CLOSED', async () => {
    /* `0015` §3's control, on this slice's own table: without it, §8 passes
       just as well against a policy that does nothing, because the store
       happens to be reading in the right scope anyway. */
    const mig = await migratorClient()
    try {
      await mig.query('DROP POLICY resolution_proposal_rls ON tenant.resolution_proposal')
      const read = await asActor(MEI, CAPABILITIES.viewException, 'ResolutionProposal', 'prp_chain_0001', (tx) =>
        readProposal(tx, 'prp_chain_0001'),
      )
      assert.equal(
        read.ok,
        false,
        'WITH NO POLICY THE APP ROLE STILL READ THE ROW. `FORCE ROW LEVEL SECURITY` plus no ' +
          'permissive policy must deny everything; a row coming back means the table is not ' +
          'forced and every isolation assertion above is about a handler’s luck.',
      )
    } finally {
      await mig.query(
        `CREATE POLICY resolution_proposal_rls ON tenant.resolution_proposal
           USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
           WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''))`,
      )
      await mig.end()
    }
  })

  /* ================================================================ *
   * §10 · 🛑 `reverseResolution`'s SECOND OBSTACLE, ASSERTED SO THE NEXT
   *       SLICE MEETS A RED RATHER THAN A SURPRISE.
   * ================================================================ */

  it('§10 · a resolution is producible AND a reversal with no authorisation record is REFUSED', async () => {
    /**
     * ⚠️ THIS SECTION ASSERTED `permission denied` UNTIL 20 Sep 2026 AND IS
     *    INVERTED RATHER THAN DELETED, because its old text is the reason the
     *    grant was withheld and is quoted in four files:
     *
     *      *"G359 gave ONE reason for not mounting `reverseResolution` —
     *       nothing can produce a resolution — and an adversarial pass found
     *       that true but NOT BINDING: the operation also had no privilege to
     *       write anything, so mounting it would have answered 500, not 409.
     *       §4 closed the first obstacle. This asserts the second is still
     *       there … so that the commit which takes the `GRANT INSERT` arrives
     *       against a red here and has to argue for it."*
     *
     *    **It did.** `db/migrations/0140` §1 takes the grant and
     *    `server/data-plane/reversal-store.ts` is the writer it owes, in one
     *    commit — G511.
     *
     * 🛑 THE ASSERTION IS NOT DELETED, IT IS MOVED ONE LAYER IN, AND THE NEW
     *    ONE IS STRICTLY STRONGER. Before, a bare `INSERT` was refused because
     *    the ROLE could not write the table at all. Now it is refused because
     *    the TRANSACTION carries no `reverse_resolution` authorisation
     *    record — `0140` §3's restrictive policy, which is `0059`'s
     *    `approval_decision_insert_restrictive` shape taken a second time. **A
     *    handler that skipped the mint would be refused at the row rather than
     *    trusted**, and that is a property the old grant could not express.
     */
    const resolved = await asActor(MEI, CAPABILITIES.viewException, 'Exception', EXC, async (tx) => {
      const rows = (
        await tx.query('SELECT resolution_mode FROM tenant.exception WHERE resolution_mode IS NOT NULL')
      ).rows
      return rows.length
    })
    assert.ok(
      resolved > 0,
      'OBSTACLE 1 IS BACK: no row in this database carries a resolution, so `reverseResolution` ' +
        'is once again refusable on G359’s original ground alone.',
    )

    await withTenantScope(pool, ACME, async (tx) => {
      await assert.rejects(
        () =>
          tx.query(
            `INSERT INTO tenant.exception_reversal
               (tenant_id, exception_id, ordinal, at, reversed_by, reason, new_status,
                reversed_disposition_key, reversed_mode, reversed_at)
             VALUES (nullif(current_setting('app.tenant_id', true), ''), $1, 0, now(), $2,
                     'data_corrected', 'open', 'write_off', 'approved', now())`,
            [EXC, MEI],
          ),
        (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          assert.match(
            message,
            /row-level security policy/i,
            'A REVERSAL WAS WRITTEN BY A TRANSACTION CARRYING NO AUTHORISATION RECORD. ' +
              '`0140` §3’s `exception_reversal_insert_restrictive` reads ' +
              '`app.authorisation_ref` and requires a live `reverse_resolution` grant naming ' +
              'this actor — *"a reversal is a correction, and corrections are signed"*, signed ' +
              'by the person who authorised THIS act. If this now says `permission denied`, ' +
              'the `GRANT INSERT` was removed and `server/data-plane/reversal-store.ts` must ' +
              `go with it (G511). The database said: ${message}`,
          )
          return true
        },
      )
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      assert.match(message, /row-level security policy|current transaction is aborted/i, message)
    })
  })

  /* ================================================================ *
   * §11 · THE PINS `0140` §2 ADDS, AND THE ONE DIRECTION `reverse_resolution`
   *       MAY MOVE A RESOLUTION. G947, G949.
   * ================================================================ */

  it('§11 · a `reverse_resolution` record may CLEAR a resolution and may not WRITE one', async () => {
    /**
     * 🛑 THE LAUNDERING MOVE, REFUSED IN SQL. The contract keeps an agent off
     *    `reverseResolution` because *"an agent that can undo its own
     *    resolutions can launder a bad one"*, and the move it fears is
     *    undo-then-redo in ONE act. `0140` §4's clearing arm fires only when
     *    every one of the six resolution columns goes to NULL from a row that
     *    had one; a write that SETS any of them falls through to the arm that
     *    demands `execute_resolution`.
     *
     * ⚠️ IT IS DRIVEN AS THE MIGRATOR WOULD NOT BE — inside a tenant scope
     *    with a minted `reverse_resolution` grant — because the trigger's own
     *    scope gate returns early for a caller with no `app.tenant_id`, and a
     *    `BYPASSRLS` writer is therefore the one caller it deliberately does
     *    not govern. `0140` §4 states that residual on its face.
     */
    const ref = await asActor(MEI, CAPABILITIES.reverseResolution, 'Exception', EXC, async (tx) => {
      /* The CLEARING write: permitted. */
      await tx.query(
        `UPDATE tenant.exception
            SET resolution_mode = NULL, resolution_disposition_key = NULL,
                resolution_proposal_id = NULL, resolution_decided_by = NULL,
                resolution_executed_by = NULL, resolution_at = NULL,
                status = 'open'
          WHERE id = $1`,
        [EXC],
      )

      /* The MINTING write, in the same act, under the same record: refused. */
      await assert.rejects(
        () =>
          tx.query(
            `UPDATE tenant.exception
                SET resolution_mode = 'manual',
                    resolution_disposition_key = 'write_off',
                    resolution_proposal_id = 'prp_laundered',
                    resolution_at = now()
              WHERE id = $1`,
            [EXC],
          ),
        (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          assert.match(
            message,
            /carries no execute_resolution authorisation record/i,
            'A `reverse_resolution` RECORD MINTED A RESOLUTION. That is undo-then-redo in one ' +
              'act — a resolution nobody proposed, nobody approved and nobody executed, ' +
              'carrying a reversal’s signature. `0140` §4’s clearing arm must require ALL SIX ' +
              `columns to be NULL. The database said: ${message}`,
          )
          return true
        },
      )
      return true
    })
    assert.equal(ref, true)
  })
})

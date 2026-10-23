/**
 * INVARIANT 10's TABLE, AND THE POLICY THAT MAKES IT A RECORD RATHER THAN A LOG
 * FILE — G301, 19 Sep 2026, over `db/migrations/0010_authorisation_record.sql`.
 *
 * `tests/db/identity-substrate.test.ts` is the shape this file copies, and its
 * header is the one to read first: the `max: 1` adversarial pool, the migrator
 * for every fixture write, and the negative control that turns the policy off.
 * What is NOT copied is the SUBJECT. That file is about the rows a session
 * resolves into. **This one is about the row an ACT leaves behind.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS FILE PROVES, AND WHAT IT DELIBERATELY DOES NOT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It proves five properties of the TABLE: that a record is visible to its own
 * tenant, invisible to another, invisible outside any scope at all, refused
 * when its `tenant_id` disagrees with the transaction's, and **unamendable and
 * undeletable by the role a request path runs as.**
 *
 * It proves NOTHING about whether the served path writes one. That is
 * `tests/http/authorisation-record.test.ts`, over a socket, and neither file is
 * the whole control: a table nothing writes and a writer nothing scopes are two
 * different ways of having half of invariant 10.
 *
 * ⚠️ EVERY GRANT IN THIS FILE COMES FROM `authorize()` AND NONE IS BUILT BY
 * HAND, WHICH IS AN ASSERTION IN DISGUISE. *"`authorize()` mints an
 * `AuthorizationGrant` and nothing else does"* is the invariant's first clause;
 * a fixture that assembled the object literally would be a second minting path
 * living in `tests/`, and the first thing a later reader would copy.
 *
 * ⚠️ NEVER SKIPS UNDER CI. `databaseRequiredUnderCi()` at the top level.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  CAPABILITIES,
  DENY_ALL,
  ORG_CLASSES,
  authorize,
  type AuthorizationGrant,
  type PrincipalContext,
  type Role,
  type RoleAssignment,
} from '../../model/access.ts'
import type { TenantId, Timestamp, UserId } from '../../model/kernel.ts'
import {
  mintAuthorizationGrantId,
  writeAuthorisationRecord,
} from '../../server/data-plane/authorisation-record.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — the named flake
 * `tests/db/tenant-projection.test.ts` documents at length.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_AUTHORISATION_DB_NAME'] ?? runScopedName('reconcile_authorisation_record_test')

const ACME = 'ten_acme' as TenantId
const GLOBEX = 'ten_globex' as TenantId
const MEI = 'usr_ops_mei' as UserId
const NOW = '2026-09-19T12:00:00.000Z' as Timestamp

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the authorisation record test', probe)

/**
 * A principal that `decide()` permits, assembled from the same shapes
 * `tests/http/capability-decide.test.ts` uses and for its reason.
 *
 * ⚠️ THE CASTS ARE NAMED, because a cast of shape is not a check of content.
 * `Role` and `RoleAssignment` carry fields `decide()` never reads on this path;
 * the cast asserts the shape the evaluator reads and nothing about the rest.
 * What is NOT cast is the grant this produces — that comes back from
 * `authorize()` fully typed, which is the point.
 */
function principal(tenantId: TenantId): PrincipalContext {
  const role = {
    tenantId,
    id: 'rol_ap_approver',
    label: 'AP Approver',
    key: 'approver',
    version: 3,
    stakeholderClass: 'operator',
    origin: 'pack',
    packId: 'pck_ap',
    capabilities: [CAPABILITIES.admitSource],
    defaultScope: DENY_ALL,
    status: 'active',
  } as unknown as Role

  const assignment = {
    tenantId,
    id: 'ras_mei_approver',
    userId: MEI,
    roleId: 'rol_ap_approver',
    /** MATCHES `role.version`. A moved pin refuses, for a reason unrelated to this file. */
    roleVersion: 3,
    scope: DENY_ALL,
    grantedBy: 'usr_acme_admin',
    grantedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    revokedAt: null,
  } as unknown as RoleAssignment

  return {
    subject: { userId: MEI, status: 'active' },
    tenantId,
    orgClass: ORG_CLASSES.customer,
    partnerId: null,
    partnerGrant: null,
    held: [{ role, assignment }],
    platformHeld: null,
    now: NOW,
  }
}

/** One minted grant, or a hard failure naming the refusal. */
function mint(tenantId: TenantId, resourceId: string | null): AuthorizationGrant {
  const out = authorize(principal(tenantId), CAPABILITIES.admitSource, {
    id: mintAuthorizationGrantId(),
    resource: {
      resourceClass: 'tenant_data',
      resourceType: 'Run',
      resourceId,
      solutionId: null,
    },
    ttlSeconds: 300,
  })
  assert.ok(
    out.grant !== null,
    `\`authorize()\` refused the fixture principal — \`${out.decision.reason}\`. Every ` +
      'assertion below is about a row that was never minted, so none of them mean ' +
      'anything until this is green.',
  )
  /**
   * 🛑 THE HOME, ASSERTED RATHER THAN CAST — G730, 19 Sep 2026. `authorize()`
   * now returns a union: a tenant-less principal mints a
   * `PlatformAuthorizationGrant` whose record lives in
   * `tenant.platform_authorization_grant` under a session-keyed policy. This
   * fixture's principal HAS a tenant, so the tenant home is the only correct
   * answer — and narrowing here rather than casting is what makes a fixture
   * that quietly lost its tenant a RED test instead of a write into the wrong
   * table.
   */
  assert.equal(
    out.grant.home,
    'tenant',
    'the fixture principal minted a PLATFORM grant. Every assertion below reads ' +
      '`tenant.authorization_grant`, so all of them would be asking about a table this ' +
      'act never touched.',
  )
  return out.grant
}

async function rowsUnder(
  pool: TenantPool,
  tenantId: TenantId,
): Promise<Array<Record<string, unknown>>> {
  return withTenantScope(
    pool,
    tenantId,
    async (tx) =>
      (
        await tx.query(
          'SELECT tenant_id, id, subject_user_id, capability, resource_class, resource_type,' +
            ' resource_id, org_class, partner_id, solution_id, issued_at, expires_at' +
            ' FROM tenant.authorization_grant ORDER BY id',
        )
      ).rows as Array<Record<string, unknown>>,
  )
}

describe('the authorisation record is a tenant-scoped, append-only row', { skip }, () => {
  let pool: TenantPool
  let acmeGrant: AuthorizationGrant
  let globexGrant: AuthorizationGrant

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    /**
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE, exactly as it is in
     * `tests/db/tenant-isolation.test.ts`: every scope below is forced onto the
     * connection the previous one released, which is the condition under which
     * a session-level `SET` would leak between them.
     */
    pool = await createAppPool(1)

    acmeGrant = mint(ACME, 'run_acme_1')
    globexGrant = mint(GLOBEX, null)

    /* 🛑 WRITTEN AS THE APP ROLE, NOT THE MIGRATOR, AND THAT IS THE WHOLE
     * FIXTURE. A migrator write would satisfy every assertion below with the
     * policy doing nothing — `reconcile_migrator` is `BYPASSRLS`. These two
     * inserts go through the same function and the same privilege a request
     * path has, which is what makes §1c and §3 evidence rather than intent. */
    await withTenantScope(pool, ACME, (tx) => writeAuthorisationRecord(tx, acmeGrant))
    await withTenantScope(pool, GLOBEX, (tx) => writeAuthorisationRecord(tx, globexGrant))
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  /* ================================================================ *
   * §1 · THE SCOPE.
   * ================================================================ */

  it('1a · a record written under a tenant is readable under that tenant, with its fields', async () => {
    const rows = await rowsUnder(pool, ACME)
    assert.equal(rows.length, 1, `ACME sees ${rows.length} record(s); it wrote exactly one`)
    const row = rows[0] as Record<string, unknown>

    assert.equal(row['id'], acmeGrant.id)
    assert.equal(row['tenant_id'], ACME)
    assert.equal(row['subject_user_id'], MEI)
    assert.equal(row['capability'], CAPABILITIES.admitSource)
    assert.equal(
      row['resource_class'],
      'tenant_data',
      'the stored class must be the one `CAPABILITY_RESOURCE_CLASS` gave at MINT time. It is ' +
        'DENORMALISED deliberately — "a platform release may move a capability between ' +
        'classes … an auditor reading a March grant needs March\'s classification".',
    )
    assert.equal(row['resource_type'], 'Run')
    assert.equal(row['resource_id'], 'run_acme_1')
    assert.equal(row['org_class'], ORG_CLASSES.customer)
    assert.equal(row['partner_id'], null, '`partnerId` is null unless the org is `partner`')
    assert.equal(row['solution_id'], null)
    assert.ok(row['issued_at'] instanceof Date, '`issued_at` did not round-trip as a timestamp')
    assert.ok(
      (row['expires_at'] as Date).getTime() > (row['issued_at'] as Date).getTime(),
      '`expires_at` is not after `issued_at`. "An open-ended grant is not a grant", and one ' +
        'that expired before it was issued is not a grant either.',
    )
  })

  it('1b · a NULL `resource_id` is stored as a null — the non-instance-bound act', async () => {
    const rows = await rowsUnder(pool, GLOBEX)
    assert.equal(rows.length, 1)
    assert.equal(
      (rows[0] as Record<string, unknown>)['resource_id'],
      null,
      '`listRuns` is "opening a list" — `ResourceRef.resourceId`\'s own example of an act ' +
        'that is genuinely not instance-bound. Storing a placeholder instead would invent an ' +
        'instance nobody acted on.',
    )
  })

  it('1c · ACME cannot see GLOBEX\'s record, and neither can see the other\'s', async () => {
    const acme = await rowsUnder(pool, ACME)
    const globex = await rowsUnder(pool, GLOBEX)
    assert.deepEqual(acme.map((r) => r['id']), [acmeGrant.id])
    assert.deepEqual(globex.map((r) => r['id']), [globexGrant.id])
  })

  it('1d · NEGATIVE CONTROL — with RLS DISABLED the same read returns BOTH', async () => {
    /**
     * 🛑 WITHOUT THIS, §1c PROVES NOTHING. A read that returns one tenant's rows
     * is indistinguishable from a read that would have returned one tenant's
     * rows anyway, and only turning the policy off can tell them apart.
     * `tests/db/tenant-isolation.test.ts` carries the same control for the same
     * reason, and `db/migrations/0010` cites this assertion by name.
     */
    const mig = await migratorClient()
    try {
      await mig.query('ALTER TABLE tenant.authorization_grant DISABLE ROW LEVEL SECURITY')
      const leaked = await rowsUnder(pool, ACME)
      assert.deepEqual(
        [...new Set(leaked.map((r) => String(r['tenant_id'])))].sort(),
        [ACME, GLOBEX].sort(),
        'with row-level security DISABLED the read did NOT leak both tenants — so §1c\'s ' +
          'single-tenant result was never evidence about the policy.',
      )
    } finally {
      await mig
        .query('ALTER TABLE tenant.authorization_grant ENABLE ROW LEVEL SECURITY')
        .catch(() => undefined)
      await mig.end()
    }

    /* And back to narrowing, in the same test, so a failure above cannot leave a
     * disabled policy behind for every assertion that runs after it. */
    assert.deepEqual((await rowsUnder(pool, ACME)).map((r) => r['id']), [acmeGrant.id])
  })

  it('1e · outside any scope the read returns ZERO — G100, deny on NULL', async () => {
    /**
     * A transaction with no `set_config('app.tenant_id', …)` at all. The GUC is
     * unset, `nullif(current_setting(…, true), '')` is NULL, `tenant_id = NULL`
     * is NULL, and NULL is not TRUE. **A forgotten scope yields an empty result
     * set, never another tenant's rows** — which is the property that makes
     * `withTenantScope()`'s footgun survivable.
     */
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const out = await client.query('SELECT id FROM tenant.authorization_grant')
      await client.query('COMMIT')
      assert.equal(
        out.rows.length,
        0,
        `an unscoped read returned ${out.rows.length} authorisation record(s). G100's ` +
          'polarity is the thing standing between a forgotten transaction and a ' +
          'cross-tenant read of who did what.',
      )
    } finally {
      client.release()
    }
  })

  /* ================================================================ *
   * §2 · APPEND-ONLY, AS A PRIVILEGE RATHER THAN A CONVENTION.
   * ================================================================ */

  it('2a · the app role cannot UPDATE a record it wrote', async () => {
    await assert.rejects(
      () =>
        withTenantScope(pool, ACME, (tx) =>
          tx.query('UPDATE tenant.authorization_grant SET capability = $1 WHERE id = $2', [
            CAPABILITIES.approveResolution,
            acmeGrant.id,
          ]),
        ),
      (err: unknown) => /permission denied/i.test(String(err)),
      'THE REQUEST PATH CAN AMEND ITS OWN AUDIT TRAIL. `AuthorizationGrant` is "IMMUTABLE ' +
        'ONCE WRITTEN, which is what makes it safe for the three streams to reference it ' +
        'rather than duplicate the principal", and `db/migrations/0010` grants `SELECT, ' +
        'INSERT` and nothing else for exactly this. A record that can be edited after the ' +
        'act is a record of whatever was most convenient afterwards.',
    )
  })

  it('2b · the app role cannot DELETE one either', async () => {
    await assert.rejects(
      () =>
        withTenantScope(pool, ACME, (tx) =>
          tx.query('DELETE FROM tenant.authorization_grant WHERE id = $1', [acmeGrant.id]),
        ),
      (err: unknown) => /permission denied/i.test(String(err)),
      'the request path can erase a record of an act. Append-only is the whole claim.',
    )
  })

  /* ================================================================ *
   * §3 · THE `WITH CHECK`, WHICH `0009` SAID THIS COMMIT WOULD OWE.
   * ================================================================ */

  it('3 · a record whose tenant disagrees with the transaction is REFUSED, not written', async () => {
    /**
     * 🛑 THIS IS THE ASSERTION THE POLICY EXISTS FOR AND IT IS NOT A HYPOTHETICAL
     * SHAPE. The minting seam takes `tenant_id` from the GRANT and the scope
     * from the SESSION; if those two ever came apart, the record would attribute
     * one tenant's act to another and every assertion in §1 would still pass.
     * The `WITH CHECK` is what requires them to be the same fact.
     *
     * `0009_identity_substrate.sql` names this commit as the one that owes it:
     * *"The commit that grants a write here owes the `WITH CHECK` in the same
     * commit as the writer."*
     */
    const crossed = mint(GLOBEX, 'run_globex_1')
    await assert.rejects(
      () => withTenantScope(pool, ACME, (tx) => writeAuthorisationRecord(tx, crossed)),
      (err: unknown) => /row-level security|violates/i.test(String(err)),
      'A GRANT MINTED FOR GLOBEX WAS WRITTEN INSIDE ACME\'S TRANSACTION. That is an audit ' +
        'row that reads as evidence and is not — the exact failure the tripwire this table ' +
        'replaces was written to prevent.',
    )

    /* And nothing landed. A refused INSERT that left a row would be worse than
     * one that succeeded, because it would be invisible to the assertion above. */
    const stillOne = await rowsUnder(pool, ACME)
    assert.deepEqual(stillOne.map((r) => r['id']), [acmeGrant.id])
  })

  /* ================================================================ *
   * §4 · `via` — THE FIELD G301 NAMES BY NAME.
   * ================================================================ */

  it('4 · the via lines name the assignment, the role and the PINNED role version', async () => {
    const rows = await withTenantScope(
      pool,
      ACME,
      async (tx) =>
        (
          await tx.query(
            'SELECT seq, assignment_id, role_id, role_version' +
              ' FROM tenant.authorization_grant_via WHERE grant_id = $1 ORDER BY seq',
            [acmeGrant.id],
          )
        ).rows as Array<Record<string, unknown>>,
    )
    assert.equal(
      rows.length,
      1,
      'the grant carries one `via` entry and the table holds a different number. `decide()` ' +
        'fills `via` from the assignments that CARRIED the verb, and storing it is "the whole ' +
        'of the third missing stream: `Decision.via` named the authority and joined to ' +
        'nothing because the decision was computed and thrown away."',
    )
    const via = rows[0] as Record<string, unknown>
    assert.equal(via['seq'], 0)
    assert.equal(via['assignment_id'], 'ras_mei_approver')
    assert.equal(via['role_id'], 'rol_ap_approver')
    assert.equal(
      via['role_version'],
      3,
      'the stored version must be the one that DECIDED, not the one the role carries today. ' +
        '`RoleAssignment.roleVersion` is pinned because "a widened role is a NEW version and ' +
        'needs consent", and an audit that read today\'s version would attribute the act to ' +
        'an authority that was not standing when it happened.',
    )
  })

  it('4b · the via lines are tenant-scoped too, and invisible from the other tenant', async () => {
    const fromGlobex = await withTenantScope(
      pool,
      GLOBEX,
      async (tx) =>
        (
          await tx.query('SELECT grant_id FROM tenant.authorization_grant_via WHERE grant_id = $1', [
            acmeGrant.id,
          ])
        ).rows as Array<Record<string, unknown>>,
    )
    assert.equal(
      fromGlobex.length,
      0,
      'a child table that is not scoped is a parent table that is not scoped. The authority ' +
        "that carried another tenant's act is exactly as much theirs as the act itself.",
    )
  })
})

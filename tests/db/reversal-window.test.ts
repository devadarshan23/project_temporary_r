/**
 * THE REVERSAL WINDOW, OVER A REAL POSTGRESQL — 24 HOURS FROM THE POST.
 * THE OWNER'S RULING, 22 Sep 2026. G1831–G1833.
 *
 * ┌─ WHAT THIS CLOSES ──────────────────────────────────────────────────────┐
 * │ `docs/build/pack-tree-join.md` (G1733): `reverseResolution` is served    │
 * │ and mounted, and the pack's own 24-hour undo window existed in NO        │
 * │ constant, NO column, NO check and NO contract field anywhere in this     │
 * │ repository. A reversal was UNBOUNDED IN TIME.                            │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH CONTROL EACH ONE IS ────────────────────────┐
 * │ 1  RED FIRST: with `db/migrations/0210_reversal_window.sql` NOT applied, │
 * │    a reversal 25 hours after resolution SUCCEEDS. Witnessed against the  │
 * │    tree as it stood before this migration.                               │
 * │ 2  GREEN: with 0210 applied, the same reversal is refused,               │
 * │    `{ kind: 'window_expired' }`, at the STORE layer.                     │
 * │ 3  A reversal one hour after resolution still succeeds — the window is a │
 * │    ceiling, not a new prohibition.                                       │
 * │ 4  DEFENCE IN DEPTH: bypassing the store and issuing the raw `INSERT`    │
 * │    directly (with a valid authorisation record, so ONLY the window is    │
 * │    under test) is refused by the DATABASE — `0210`'s restrictive policy  │
 * │    — even though the store's own check never ran. This is the property   │
 * │    the ruling asked for: "the other layer should still refuse too."      │
 * │ 5  THE ORIGINAL FENCE SURVIVES: a reversal with NO authorisation record  │
 * │    is still refused (0140 §3's own clause, re-witnessed after 0210's     │
 * │    `ALTER POLICY` replaced the expression) — proving the near-miss       │
 * │    0020 warns about (a dropped clause during `ALTER POLICY`) did not     │
 * │    happen here.                                                          │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 NO FROZEN CLOCK ANYWHERE IN THIS FILE ────────────────────────────────┐
 * │ `tools/check-clock-fixtures.mjs` (G1351) exists because a fixture seeded  │
 * │ from the database's clock and asserted against a FROZEN one flips on a   │
 * │ date nobody wrote down. Every `now: …` this file passes to               │
 * │ `reverseResolutionOf()` is `new Date().toISOString()`, taken at call     │
 * │ time — genuinely current, never a literal. Ages are seeded the other     │
 * │ way, with `now() - interval 'N hours'` evaluated by the DATABASE at      │
 * │ INSERT time, which is the ordinary and safe half of that checker's       │
 * │ pattern.                                                                  │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  createAppPool,
  withTenantScope,
  type ScopedClient,
  type TenantPool,
} from '../../db/tenant-scope.ts'
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
import { reverseResolutionOf } from '../../server/data-plane/reversal-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_REVERSAL_WINDOW_DB_NAME'] ?? runScopedName('reconcile_reversal_window_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const MEI = 'usr_ops_mei' as UserId

/** Resolved 25 hours ago. The window has closed. */
const EXC_STALE = 'exc_acme_reversal_window_stale'
/** Resolved 1 hour ago. Still inside the window. */
const EXC_RECENT = 'exc_acme_reversal_window_recent'
/** Resolved 1 hour ago, seeded a second time for §4's raw-SQL bypass probe. */
const EXC_BYPASS_STALE = 'exc_acme_reversal_window_bypass_stale'
/** Never resolved. §5's negative control needs a live resolution to attempt. */
const EXC_FOR_NO_RECORD = 'exc_acme_reversal_window_no_record'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/reversal-window.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER db/migrations/0210_reversal_window.sql.',
      '   A run in which it skipped is NOT evidence that a reversal older than',
      '   REVERSAL_WINDOW_HOURS is refused, at the store OR at the database.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the reversal-window assertions', probe)

/* ------------------------------------------------------------------ *
 * THE ACTOR SEAM — `resolution-chain.test.ts`'s own pattern, minted rather
 * than inserted so every write is accompanied by a real invariant 10
 * record, exactly as `authorisedHandler()` requires.
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
    packId: 'pck_ap',
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

const pool: TenantPool = await createAppPool(2)

/**
 * Run `fn` inside a tenant scope carrying a REAL invariant 10 record for
 * `capability`, exactly as `authorisedHandler()` does. Returns the grant id
 * so §5's negative control can mint a DIFFERENT act and never write this
 * one's record — the shape `resolution-chain.test.ts` §10 uses to prove the
 * fence rather than assume it.
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
  assert.equal(grant.home, 'tenant', 'the fixture principal minted a PLATFORM grant')
  if (grant.home !== 'tenant') throw new Error('unreachable')

  return withTenantScope(pool, ACME, async (tx) => {
    await writeAuthorisationRecord(tx, grant)
    return fn(tx)
  })
}

/* ------------------------------------------------------------------ *
 * THE FIXTURE. Four exceptions, seeded ALREADY RESOLVED by the migrator at
 * controlled ages — `resolution_at = now() - interval '…'`, evaluated by
 * POSTGRES at INSERT time, never by this process's clock. `correctedDispositionKey`
 * is left `null` throughout (a reopening, not a correction), so the fixture
 * needs no `tenant.disposition` row at all — `reversal-store.ts` only
 * queries the offered set when a correction is requested.
 * ------------------------------------------------------------------ */

async function seedResolvedException(
  id: string,
  ageInterval: string,
): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(
      `INSERT INTO tenant.exception
         (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
          domain, definition_id, rule_label, severity, severity_rank,
          status, raised_at, explanation_summary, explanation_expected,
          resolution_mode, resolution_disposition_key, resolution_proposal_id,
          resolution_executed_by, resolution_at)
       VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
               'finance', 'def_ap_close', 'Three-way match', 'critical', 0,
               'resolved', now() - $3::interval,
               'the invoice disagrees with the purchase order', 'the purchase order',
               'manual', 'write_off', 'prp_seeded_manual', $4,
               now() - $3::interval)`,
      [ACME, id, ageInterval, MEI],
    )
  } finally {
    await mig.end()
  }
}

describe('the reversal window, over a real PostgreSQL', { skip }, () => {
  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedResolvedException(EXC_STALE, '25 hours')
    await seedResolvedException(EXC_RECENT, '1 hour')
    await seedResolvedException(EXC_BYPASS_STALE, '1 hour')
    await seedResolvedException(EXC_FOR_NO_RECORD, '1 hour')
  })

  after(async () => {
    await pool.end()
  })

  /* ================================================================ *
   * §1 · A RESOLUTION AGED PAST THE WINDOW IS REFUSED AT THE STORE.
   * ================================================================ */

  it('§1 · a resolution 25 hours old is refused `window_expired`', async () => {
    const result = await asActor(
      MEI,
      CAPABILITIES.reverseResolution,
      'Exception',
      EXC_STALE,
      (tx) =>
        reverseResolutionOf(
          tx,
          EXC_STALE,
          { reason: 'data_corrected', newStatus: 'open', note: null, correctedDispositionKey: null },
          { userId: MEI, now: new Date().toISOString() as Timestamp },
        ),
    )
    assert.deepEqual(
      result,
      { kind: 'window_expired' },
      `expected \`window_expired\`, got ${JSON.stringify(result)}. If REVERSAL_WINDOW_HOURS ` +
        'changed, this fixture (aged 25 hours) may no longer be past it.',
    )
  })

  /* ================================================================ *
   * §2 · THE SAME ROW, WITH THE `INSERT` COMMENTED OUT, WOULD HAVE
   *      ANSWERED `reversed` — DOCUMENTED RATHER THAN RE-RUN, BECAUSE
   *      RUNNING THE UNPATCHED CODE HERE WOULD MEAN RECOMPILING A SECOND
   *      COPY OF THIS FILE. THE RED WAS WITNESSED BY HAND BEFORE §3 OF
   *      `0210` LANDED: WITH THE `AND (now() - reversed_at) <= interval
   *      '24 hours'` CLAUSE REMOVED FROM THE MIGRATION AND
   *      `reversal-store.ts`'S `window_expired` CHECK COMMENTED OUT, THIS
   *      EXACT CALL ANSWERED `{ kind: 'reversed', … }` FOR `EXC_STALE`.
   * ================================================================ */

  it('§2 · a resolution 1 hour old is still inside the window and succeeds', async () => {
    const result = await asActor(
      MEI,
      CAPABILITIES.reverseResolution,
      'Exception',
      EXC_RECENT,
      (tx) =>
        reverseResolutionOf(
          tx,
          EXC_RECENT,
          { reason: 'data_corrected', newStatus: 'open', note: null, correctedDispositionKey: null },
          { userId: MEI, now: new Date().toISOString() as Timestamp },
        ),
    )
    assert.equal(
      result.kind,
      'reversed',
      `expected \`reversed\` for a 1-hour-old resolution, got ${JSON.stringify(result)}. ` +
        'The window is a CEILING, not a new prohibition on reversals in general.',
    )
  })

  /* ================================================================ *
   * §3 · DEFENCE IN DEPTH — THE DATABASE REFUSES INDEPENDENTLY OF THE
   *      STORE. G1831's own instruction: "the other layer should still
   *      refuse too."
   * ================================================================ */

  it(
    '§3 · 🛑 THE DATABASE REFUSES A STALE REVERSAL EVEN WHEN THE STORE\'S CHECK NEVER RAN',
    async () => {
      /**
       * Bypass `reverseResolutionOf()` entirely: mint a REAL `reverse_resolution`
       * authorisation record (so the ONLY thing under test is the window, not
       * the authorisation fence §5 covers separately) and issue the raw
       * `INSERT` by hand, exactly as `resolution-chain.test.ts` §10 does for
       * the authorisation fence. `reversed_at` is set to the resolution's
       * real age (1 hour), and `at` — the reversal's own timestamp, which the
       * policy does NOT read — is set to `now()`, so a passing test here is
       * about the POLICY and not about a bypass being detected by the wrong
       * clause.
       */
      await asActor(MEI, CAPABILITIES.reverseResolution, 'Exception', EXC_BYPASS_STALE, async (tx) => {
        await assert.rejects(
          () =>
            tx.query(
              `INSERT INTO tenant.exception_reversal
                 (tenant_id, exception_id, ordinal, at, reversed_by, reason, new_status,
                  reversed_disposition_key, reversed_mode, reversed_at)
               VALUES (nullif(current_setting('app.tenant_id', true), ''), $1, 0, now(), $2,
                       'data_corrected', 'open', 'write_off', 'manual',
                       now() - interval '25 hours')`,
              [EXC_BYPASS_STALE, MEI],
            ),
          (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            assert.match(
              message,
              /row-level security policy/i,
              'A REVERSAL BACKDATED PAST THE WINDOW WAS WRITTEN WITH A VALID AUTHORISATION ' +
                "RECORD AND NO HANDLER-LEVEL CHECK. `0210`'s `ALTER POLICY` reads " +
                "`exception_reversal.reversed_at` against `now()` independently of the " +
                `store's own \`window_expired\` check. The database said: ${message}`,
            )
            return true
          },
        )
      })
    },
  )

  /* ================================================================ *
   * §4 · THE ORIGINAL FENCE SURVIVES THE `ALTER POLICY`. `0140` §10's own
   *      assertion, re-witnessed after `0210` replaced the expression —
   *      proving the near-miss `0020` warns about (a dropped clause during
   *      `ALTER POLICY`) did not happen here.
   * ================================================================ */

  it('§4 · a reversal with NO authorisation record is still refused, unrelated to the window', async () => {
    await withTenantScope(pool, ACME, async (tx) => {
      await assert.rejects(
        () =>
          tx.query(
            `INSERT INTO tenant.exception_reversal
               (tenant_id, exception_id, ordinal, at, reversed_by, reason, new_status,
                reversed_disposition_key, reversed_mode, reversed_at)
             VALUES (nullif(current_setting('app.tenant_id', true), ''), $1, 0, now(), $2,
                     'data_corrected', 'open', 'write_off', 'manual', now() - interval '1 hour')`,
            [EXC_FOR_NO_RECORD, MEI],
          ),
        (err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          assert.match(
            message,
            /row-level security policy/i,
            "0140 §3's `EXISTS (… authorization_grant …)` clause did not survive `0210`'s " +
              `\`ALTER POLICY\`. The database said: ${message}`,
          )
          return true
        },
      )
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      assert.match(message, /row-level security policy|current transaction is aborted/i, message)
    })
  })
})

/**
 * `db/migrations/0480_exception_run_id.sql` — AN EXCEPTION RECORDS THE RUN
 * THAT RAISED IT. G3621 (THE OWNER'S, 3 Oct 2026): *"Add run id: exceptions
 * record the run that raised them; the register, counts and 'Needs you' can
 * scope to the selected run."* G3622–G3626 derive the rest.
 *
 * WHAT THIS SUITE HOLDS. §2, §3, §5 and §6 were WITNESSED RED BY MUTATION
 * (constraint dropped; `ON DELETE CASCADE`; `runScopeTerms()` returning no
 * term); §1, §4 and §7 are guards on a property no mutation here produced:
 *
 *   §1  the column is NULLABLE, and null means NOT RECORDED (`0480` §1);
 *   §2  the composite foreign key makes another tenant's run UNREPRESENTABLE;
 *   §3  a run that raised an exception cannot be deleted under it (NO ACTION,
 *       not CASCADE);
 *   §4  the app role cannot WRITE `run_id` — no grant was widened;
 *   §5  `runId` and `periodId` narrow the QUEUE, and a not-recorded row is
 *       outside both;
 *   §6  the same two terms narrow the FACETS, so a count beside a run-scoped
 *       register is a count OF it;
 *   §7  both reads PUBLISH the run, `null` included.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  readException,
  readExceptionFacets,
  readExceptionQueuePage,
} from '../../server/data-plane/exception-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_EXCEPTION_RUN_DB_NAME'] ?? runScopedName('reconcile_exception_run_id_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const RUN_MARCH = 'run_acme_march'
const RUN_APRIL = 'run_acme_april'
const RUN_GLOBEX = 'run_globex_march'

const EXC_MARCH_A = 'exc_acme_march_a'
const EXC_MARCH_B = 'exc_acme_march_b'
const EXC_APRIL = 'exc_acme_april'
const EXC_UNRECORDED = 'exc_acme_unrecorded'

const probe = await probeDatabase()
const skip: false | string = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/exception-run-id.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '   A run in which it skipped is NOT evidence that an exception is scoped to its run.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

databaseRequiredUnderCi('the exception run-id assertions', probe)

type Q = (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>

async function asMigrator<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

async function insertRun(q: Q, tenant: string, id: string, period: string): Promise<void> {
  await q(
    `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,
                      trigger_kind, status, started_at, finished_at, exceptions_raised)
     VALUES ($1, $2, 'def_ap_close', 1, $3, 'manual', 'completed', now(), now(), 0)`,
    [tenant, id, period],
  )
}

async function insertException(
  q: Q,
  tenant: string,
  id: string,
  runId: string | null,
  assignedTo: string | null = null,
): Promise<void> {
  await q(
    `INSERT INTO tenant.exception
       (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
        domain, definition_id, rule_label, severity, severity_rank,
        status, assigned_to, raised_at, explanation_summary, explanation_expected, run_id)
     VALUES ($1, $2, 'mg_1', 'rul_1', 1, 1,
             'finance', 'def_ap_close', 'Three-way match', 'high', 1,
             'open', $4, now(), 'the invoice disagrees with the purchase order', 'the purchase order', $3)`,
    [tenant, id, runId, assignedTo],
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

describe('0480 — an exception records the run that raised it', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await asMigrator(async (q) => {
      await insertRun(q, ACME, RUN_MARCH, 'per_2026_03')
      await insertRun(q, ACME, RUN_APRIL, 'per_2026_04')
      await insertRun(q, GLOBEX, RUN_GLOBEX, 'per_2026_03')
      await insertException(q, ACME, EXC_MARCH_A, RUN_MARCH)
      await insertException(q, ACME, EXC_MARCH_B, RUN_MARCH, 'usr_someone_else')
      await insertException(q, ACME, EXC_APRIL, RUN_APRIL)
      await insertException(q, ACME, EXC_UNRECORDED, null)
    })
    pool = await createAppPool(1)
  })

  after(async () => {
    await pool.end()
  })

  it('1 · `run_id` is NULLABLE — a row stored before it is NOT RECORDED, never guessed', async () => {
    const found = (
      await asMigrator((q) =>
        q(
          `SELECT is_nullable::text AS n FROM information_schema.columns
            WHERE table_schema = 'tenant' AND table_name = 'exception' AND column_name = 'run_id'`,
        ),
      )
    ).rows as { n: string }[]
    assert.deepEqual(found, [{ n: 'YES' }])
  })

  it('2 · a row naming ANOTHER tenant`s run is unrepresentable — the composite key', async () => {
    await assert.rejects(
      asMigrator((q) => insertException(q, ACME, 'exc_acme_names_globex_run', RUN_GLOBEX)),
      (error: unknown) => {
        assert.match(
          messageOf(error),
          /violates foreign key constraint "exception_raised_by_run"/,
          'An ACME exception was stored naming GLOBEX`s run — even the BYPASSRLS migrator must be refused.',
        )
        return true
      },
    )
    /* And a run that does not exist at all. */
    await assert.rejects(
      asMigrator((q) => insertException(q, ACME, 'exc_acme_names_no_run', 'run_nobody')),
      /exception_raised_by_run/,
    )
  })

  it('3 · a run that raised an exception CANNOT be deleted under it — NO ACTION, not CASCADE', async () => {
    await assert.rejects(
      asMigrator((q) => q(`DELETE FROM run WHERE tenant_id = $1 AND id = $2`, [ACME, RUN_APRIL])),
      (error: unknown) => {
        assert.match(
          messageOf(error),
          /violates foreign key constraint "exception_raised_by_run"/,
          'Deleting a run took its exceptions with it (CASCADE) or orphaned them. `0480` §2: the ' +
            'register is a record of findings and outlives nothing that raised it.',
        )
        return true
      },
    )
    const left = (
      await asMigrator((q) => q(`SELECT id FROM tenant.exception WHERE tenant_id = $1 AND id = $2`, [ACME, EXC_APRIL]))
    ).rows
    assert.equal(left.length, 1)
  })

  it('4 · the app role cannot WRITE `run_id` — no grant was widened', async () => {
    await assert.rejects(
      withTenantScope(pool, ACME, (tx) =>
        tx.query(`UPDATE tenant.exception SET run_id = $2 WHERE id = $1`, [EXC_MARCH_A, RUN_APRIL]),
      ),
      /permission denied/i,
    )
  })

  it('5 · `runId` and `periodId` narrow the QUEUE; a not-recorded row is outside both', async () => {
    const ids = async (filter: Parameters<typeof readExceptionQueuePage>[1]): Promise<string[]> => {
      const page = await withTenantScope(pool, ACME, (tx) =>
        readExceptionQueuePage(tx, filter, { cursor: undefined, limit: 50, sort: 'raised_at_asc' }),
      )
      assert.equal(page.kind, 'page')
      if (page.kind !== 'page') return []
      return page.items.map((item) => item['exceptionId'] as string).sort()
    }

    /* The differential first (§5.6): unscoped, every row — the not-recorded one too. */
    assert.deepEqual(await ids({}), [EXC_APRIL, EXC_MARCH_A, EXC_MARCH_B, EXC_UNRECORDED].sort())
    assert.deepEqual(
      await ids({ runId: [RUN_MARCH] }),
      [EXC_MARCH_A, EXC_MARCH_B].sort(),
      'THE RUN WAS IGNORED. A run-scoped register showed rows another run raised, or the row ' +
        'whose run is not recorded — which `0480` §1 puts outside every run.',
    )
    assert.deepEqual(await ids({ periodId: ['per_2026_04'] }), [EXC_APRIL])
    assert.deepEqual(await ids({ periodId: ['per_2026_03'] }), [EXC_MARCH_A, EXC_MARCH_B].sort())
    /* Another tenant's run names nothing here — RLS and the key, both. */
    assert.deepEqual(await ids({ runId: [RUN_GLOBEX] }), [])
    /* The terms compose with the queue's own. */
    assert.deepEqual(await ids({ runId: [RUN_MARCH], unassignedOnly: true }), [EXC_MARCH_A])
  })

  it('6 · the same terms narrow the FACETS — a count beside a run is a count OF that run', async () => {
    const total = async (scope: Parameters<typeof readExceptionFacets>[2]): Promise<number> => {
      const read = await withTenantScope(pool, ACME, (tx) => readExceptionFacets(tx, ['open'], scope))
      assert.equal(read.kind, 'facets')
      if (read.kind !== 'facets') return -1
      const severities = read.facets['severities'] as { count: number }[]
      return severities.reduce((n, s) => n + s.count, 0)
    }
    assert.equal(await total({}), 4)
    assert.equal(await total({ runId: [RUN_MARCH] }), 2, 'A run-scoped facet counted the whole tenant.')
    assert.equal(await total({ runId: [RUN_MARCH], mineOrUnassignedFor: 'usr_reader' }), 1)
    assert.equal(await total({ periodId: ['per_2026_04'] }), 1)
    assert.equal(await total({ runId: [RUN_GLOBEX] }), 0)
  })

  it('7 · both reads PUBLISH the run, and `null` when it is not recorded', async () => {
    const page = await withTenantScope(pool, ACME, (tx) =>
      readExceptionQueuePage(tx, {}, { cursor: undefined, limit: 50, sort: 'raised_at_asc' }),
    )
    assert.equal(page.kind, 'page')
    if (page.kind !== 'page') return
    const runOf = new Map(page.items.map((item) => [item['exceptionId'], item['runId']]))
    assert.equal(runOf.get(EXC_MARCH_A), RUN_MARCH)
    assert.equal(runOf.get(EXC_UNRECORDED), null)
    assert.ok(runOf.has(EXC_UNRECORDED) && 'runId' in (page.items.find((i) => i['exceptionId'] === EXC_UNRECORDED) ?? {}))

    const detail = await withTenantScope(pool, ACME, (tx) => readException(tx, EXC_APRIL))
    assert.equal(detail.kind, 'exception')
    if (detail.kind !== 'exception') return
    assert.equal(detail.exception['runId'], RUN_APRIL)
    const none = await withTenantScope(pool, ACME, (tx) => readException(tx, EXC_UNRECORDED))
    assert.equal(none.kind === 'exception' ? none.exception['runId'] : 'not read', null)
  })
})

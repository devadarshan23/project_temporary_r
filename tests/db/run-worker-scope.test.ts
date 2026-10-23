/**
 * THE WORKER OPENS EXACTLY THE TENANT'S SCOPE THE MESSAGE NAMED, AND NO OTHER.
 * **R-B, 20 Sep 2026, THE OWNER'S RULING — AND THIS FILE IS THE REASON IT WAS
 * TAKEN OVER A SCAN.**
 *
 * ┌─ §1 IS A-4's MEASUREMENT, KEPT RUNNABLE RATHER THAN NARRATED ──────────────┐
 * │                                                                            │
 * │ The rejected alternative was a worker holding `BYPASSRLS` and issuing       │
 * │ `SELECT … FROM run WHERE status = 'queued' FOR UPDATE SKIP LOCKED`. The     │
 * │ owner refused the ROLE — *"it puts a role that can read every tenant into a │
 * │ long-running process, and every isolation assertion in `tests/` is relative │
 * │ to no serving process holding that role"* — and the MEASUREMENT is what     │
 * │ makes that refusal costless rather than expensive:                          │
 * │                                                                            │
 * │     as the BYPASSRLS migrator     ->  2 queued run(s)                       │
 * │     claim scan, no app.tenant_id  ->  0 row(s)                              │
 * │     tenant enumeration            ->  0 row(s)                              │
 * │                                                                            │
 * │ **The scan does not work at all without that role.** G100 denies on NULL,   │
 * │ so a worker that does not yet know its tenant sees nothing — every time,    │
 * │ correctly — and it cannot list the tenants it would have to iterate         │
 * │ either. §1 re-runs both halves on every gate run, so the day somebody       │
 * │ proposes a scan the answer is a test rather than an argument.               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH CONTROL EACH ONE IS ──────────────────────────┐
 * │ 1  A-4 re-measured: the claim scan and the tenant enumeration both return  │
 * │    ZERO to the app role outside a tenant scope.                    G100     │
 * │ 2  THE ALLOW ARM FIRST. A message naming tenant A and A's run reaches it,  │
 * │    with its definition and its status — because a claim that returned only │
 * │    a boolean would be green against a query that never ran.                 │
 * │ 3  🛑 **THE NEGATIVE CONTROL, AND THE WHOLE POINT OF R-B:** a message      │
 * │    naming tenant A and **tenant B's run id** reaches NOTHING.   INVARIANT 1 │
 * │ 4  🛑 WITH RLS DISABLED THE SAME MESSAGE LEAKS — the control that makes 3  │
 * │    mean anything, because isolation from a `WHERE` a reader happens to     │
 * │    carry is indistinguishable from isolation from the database until you   │
 * │    turn the database off.                                          §5.1     │
 * │ 5  THE SQL CARRIES NO TENANT PREDICATE AND BINDS NO TENANT PARAMETER,      │
 * │    read out of the module's own source. Without it, 3 and 4 could both     │
 * │    pass against a reader doing the narrowing itself.                        │
 * │ 6  A run id that never existed is INDISTINGUISHABLE from another tenant's. │
 * │ 7  The worker CREATES NOTHING: the row count in both tenants is unchanged  │
 * │    by every claim above. A duplicate delivery is therefore harmless, which │
 * │    is what SQS's at-least-once guarantee requires of any consumer.          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, type TenantPool } from '../../db/tenant-scope.ts'
import { claimAdmittedRun, describeClaim } from '../../server/data-plane/run-worker.ts'
import { RUN_QUEUE_MESSAGE_KIND } from '../../server/data-plane/run-queue.ts'
import type { RunId, TenantId } from '../../model/kernel.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RUN_WORKER_DB_NAME'] ?? runScopedName('reconcile_run_worker_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const ACME_RUN = 'run_acme_queued'
const GLOBEX_RUN = 'run_globex_queued'
const NEVER_EXISTED = 'run_never_minted_at_all'

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/run-worker-scope.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER THE PROPERTY R-B WAS TAKEN FOR. A run in',
      '   which it skipped is NOT evidence that a message naming one tenant',
      '   cannot reach another tenant`s run, and NOT evidence that a scanning',
      '   worker would need BYPASSRLS — which is the measurement the ruling',
      '   rests on.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the run-worker scope assertions', probe)

const message = (tenantId: string, runId: string) => ({
  kind: RUN_QUEUE_MESSAGE_KIND,
  tenantId: tenantId as TenantId,
  runId: runId as RunId,
})

async function asMigrator<T>(
  fn: (q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>,
): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    await q(
      `INSERT INTO run (tenant_id, id, definition_id, definition_version, trigger_kind,
                        status, inputs, started_at)
       VALUES ($1, $2, 'def_acme_close', 4, 'manual', 'queued', '{}'::jsonb, now()),
              ($3, $4, 'def_globex_close', 9, 'manual', 'queued', '{}'::jsonb, now())`,
      [ACME, ACME_RUN, GLOBEX, GLOBEX_RUN],
    )
  })
}

const totalRuns = () =>
  asMigrator(async (q) => {
    const r = await q('SELECT id FROM run')
    return r.rows.length
  })

describe('the run worker opens one tenant`s scope and sees only that tenant', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /*
     * ⚠️ `max: 1` IS ADVERSARIAL ON PURPOSE, exactly as it is in
     * `tests/db/tenant-isolation.test.ts`: every claim below runs on the SAME
     * pooled backend, so a `SET LOCAL` that outlived its transaction would
     * leak into the next assertion rather than being hidden by a fresh
     * connection.
     */
    pool = await createAppPool(1)
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  /* ================================================================ *
   * §1 · A-4, RE-MEASURED. The alternative R-B rejected does not work.
   * ================================================================ */

  it('1 · a claim SCAN with no tenant returns ZERO, and the worker cannot enumerate tenants either', async () => {
    const asMigratorSees = await asMigrator(async (q) => {
      const r = await q("SELECT id FROM run WHERE status = 'queued'")
      return r.rows.length
    })
    assert.equal(
      asMigratorSees,
      2,
      'the fixture did not land two queued runs, so everything below is vacuous',
    )

    const client = await pool.connect()
    try {
      await client.query('BEGIN', [])
      const scan = await client.query(
        "SELECT tenant_id, id FROM run WHERE status = 'queued' FOR UPDATE SKIP LOCKED",
        [],
      )
      assert.equal(
        scan.rows.length,
        0,
        'A `FOR UPDATE SKIP LOCKED` scan over `public.run` with no `app.tenant_id` RETURNED ' +
          'ROWS. That would mean `run_rls` is not denying on NULL — and it would also mean ' +
          'the alternative R-B rejected is buildable without `BYPASSRLS`, which is the ' +
          'measurement the ruling rests on.',
      )
      const tenants = await client.query('SELECT id FROM tenant.tenant', [])
      assert.equal(
        tenants.rows.length,
        0,
        'the app role enumerated tenants outside a tenant scope. A worker that could list ' +
          'tenants could iterate them, which is the second half of why a scanning worker ' +
          'needs a role no serving process may hold.',
      )
      await client.query('ROLLBACK', [])
    } finally {
      client.release()
    }
  })

  /* ================================================================ *
   * §2 · THE ALLOW ARM. Without it every refusal below passes against
   *      a reader that simply cannot read.
   * ================================================================ */

  it('2 · a message naming tenant A and A`s run REACHES it, with its definition and its status', async () => {
    const claim = await claimAdmittedRun(pool, message(ACME, ACME_RUN))
    assert.equal(claim.kind, 'reached', `the worker could not reach acme's own run: ${claim.kind}`)
    if (claim.kind !== 'reached') return
    assert.equal(claim.run.runId, ACME_RUN)
    assert.equal(claim.run.tenantId, ACME)
    assert.equal(claim.run.definitionId, 'def_acme_close')
    assert.equal(claim.run.definitionVersion, 4)
    assert.equal(claim.run.status, 'queued')
  })

  /* ================================================================ *
   * §3 · 🛑 THE NEGATIVE CONTROL. **THIS IS WHY R-B EXISTS.**
   * ================================================================ */

  it('3 · a message naming tenant A and tenant B`s run id reaches NOTHING', async () => {
    const claim = await claimAdmittedRun(pool, message(ACME, GLOBEX_RUN))
    assert.equal(
      claim.kind,
      'run_not_visible',
      'A MESSAGE NAMING ONE TENANT REACHED ANOTHER TENANT`S RUN. This is the property R-B ' +
        'was taken for — *"the worker consumes one message and opens exactly THAT tenant`s ' +
        'scope; no cross-tenant read exists anywhere in the design"* — and it is invariant 1 ' +
        'and invariant 2 at once. `claimAdmittedRun()` opens `withTenantScope(pool, ' +
        'message.tenantId)` and its SQL carries no tenant predicate: `run_rls` is what ' +
        'refuses, so this failing means the POLICY is not doing it.',
    )
  })

  /* ================================================================ *
   * §4 · 🛑 THE CONTROL THAT MAKES §3 MEAN ANYTHING. With RLS off, the
   *      same message leaks — so §3 is the database and not the reader.
   * ================================================================ */

  it('4 · with `run` RLS DISABLED the same message LEAKS globex`s run into acme`s scope', async () => {
    await asMigrator(async (q) => {
      await q('ALTER TABLE run DISABLE ROW LEVEL SECURITY')
    })
    try {
      const leaked = await claimAdmittedRun(pool, message(ACME, GLOBEX_RUN))
      assert.equal(
        leaked.kind,
        'reached',
        'WITH ROW LEVEL SECURITY DISABLED the cross-tenant message STILL reached nothing. ' +
          'That means §3 is not being enforced by the database — something in the reader is ' +
          'narrowing, and isolation from a `WHERE` a reader happens to carry is ' +
          'indistinguishable from isolation from the database until you turn the database ' +
          'off. §5.1.',
      )
      if (leaked.kind === 'reached') {
        assert.equal(leaked.run.definitionId, 'def_globex_close')
      }
    } finally {
      await asMigrator(async (q) => {
        await q('ALTER TABLE run ENABLE ROW LEVEL SECURITY')
      })
    }

    /* And the property is restored, in the same test, so a failure above
     * cannot leave the rest of the suite asserting against an open table. */
    const restored = await claimAdmittedRun(pool, message(ACME, GLOBEX_RUN))
    assert.equal(restored.kind, 'run_not_visible', 'RLS was not restored after the control')
  })

  /* ================================================================ *
   * §5 · THE READER'S SQL. No tenant predicate, no tenant bind.
   * ================================================================ */

  it('5 · `claimAdmittedRun()` issues no tenant predicate and binds no tenant parameter', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(
      path.resolve(here, '..', '..', 'server', 'data-plane', 'run-worker.ts'),
      'utf8',
    )
    const body = source.slice(source.indexOf('export async function claimAdmittedRun'))

    assert.equal(
      /tenant_id\s*=/.test(body),
      false,
      '`claimAdmittedRun()` carries a `tenant_id =` predicate. Isolation here is `run_rls` ' +
        'reached through `withTenantScope()`, and a predicate in the reader would make §3 ' +
        'pass for the wrong reason — which §4 exists to detect and which this assertion ' +
        'names directly.',
    )
    assert.equal(
      /\[message\.tenantId,/.test(body) || /message\.tenantId,\s*message\.runId/.test(body),
      false,
      '`claimAdmittedRun()` binds the tenant as a query parameter. The tenant belongs in the ' +
        'SCOPE and nowhere else.',
    )
    assert.match(
      body,
      /withTenantScope\(pool, message\.tenantId/,
      'the scope is not opened with the tenant the message named',
    )
  })

  /* ================================================================ *
   * §6 · THREE FACTS, ONE ANSWER — and that is deliberate.
   * ================================================================ */

  it('6 · a run id that NEVER EXISTED is indistinguishable from another tenant`s run', async () => {
    const never = await claimAdmittedRun(pool, message(ACME, NEVER_EXISTED))
    const other = await claimAdmittedRun(pool, message(ACME, GLOBEX_RUN))
    assert.equal(never.kind, 'run_not_visible')
    assert.equal(other.kind, 'run_not_visible')
    assert.equal(
      describeClaim(never).replace(NEVER_EXISTED, 'X'),
      describeClaim(other).replace(GLOBEX_RUN, 'X'),
      'the two arms produce DIFFERENT operator lines, so the worker is distinguishing ' +
        '*"a run that never existed"* from *"another tenant`s run"*. Telling them apart ' +
        'requires reading outside the scope, which is the one thing this design does not do.',
    )
  })

  /* ================================================================ *
   * §7 · THE WORKER CREATES NOTHING, which is what makes a duplicate
   *      delivery harmless — and SQS is at-least-once by definition.
   * ================================================================ */

  it('7 · every claim above left `public.run` exactly as it found it', async () => {
    const before = await totalRuns()
    await claimAdmittedRun(pool, message(ACME, ACME_RUN))
    await claimAdmittedRun(pool, message(ACME, ACME_RUN))
    await claimAdmittedRun(pool, message(GLOBEX, GLOBEX_RUN))
    await claimAdmittedRun(pool, message(ACME, NEVER_EXISTED))
    const after = await totalRuns()
    assert.equal(
      after,
      before,
      'the worker changed `public.run`. It must read and not write: SQS is at-least-once, ' +
        'and `server/data-plane/run-queue.ts` §2 adds a SECOND source of duplicates on ' +
        'purpose — pressing Run again re-publishes — so a consumer that created anything ' +
        'would create it twice.',
    )
    assert.equal(before, 2, 'the fixture is not two runs, so this assertion proves little')
  })

  /* ================================================================ *
   * §8 · THE SEAM IS NOT THE EXECUTOR, asserted rather than narrated.
   * ================================================================ */

  it('8 · the worker executes nothing, and says so where an operator will read it', async () => {
    const claim = await claimAdmittedRun(pool, message(ACME, ACME_RUN))
    assert.match(
      describeClaim(claim),
      /NOTHING WAS EXECUTED/,
      'the reached line does not say that nothing was executed. A worker that logged ' +
        '*"reached run X"* and stopped would read, in an incident, as a worker that had ' +
        'executed it — and R-A has not landed, so a definition stores four columns while ' +
        '`SetReconciliationInput` needs eighteen.',
    )
    const stillQueued = await asMigrator(async (q) => {
      const r = await q('SELECT status FROM run WHERE tenant_id = $1 AND id = $2', [
        ACME,
        ACME_RUN,
      ])
      return (r.rows[0] as { status: string } | undefined)?.status
    })
    assert.equal(
      stillQueued,
      'queued',
      'the worker moved a run`s status. It has no privilege question to answer yet and no ' +
        'engine to answer it with; a status transition arrives with the executor.',
    )
  })
})

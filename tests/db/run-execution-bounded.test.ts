/**
 * EVERY ADMITTED RUN REACHES A TERMINAL STATUS OR AN ALARM — G4361, G4362, G4365–G4367,
 * 5 Oct 2026, applying the OWNER'S amendment of G211 and closing G4132's
 * named residue.
 *
 * G4132 left one sentence standing: *"a run whose execution THROWS reads
 * `running` until a redelivery settles it … one whose message dead-letters
 * stays `running`."* The owner's ruling: *"SQS redelivery bounded by
 * RUN_QUEUE_MAX_RECEIVE_COUNT is the only retry authority. Duration is bounded
 * below the visibility timeout. Every admitted run reaches a terminal status or
 * an alarm."* — and *"Terminal status for an execution error: REUSE `failed`
 * (no contract change); record the reason separately."*
 *
 * RED FIRST (§1): driven through `processReceivedRun()` as it stood — the body
 * of `run-worker-main.ts`, moved verbatim — the final receive of a run whose
 * execution throws left the run `running` and the error propagated. Captured
 * against PostgreSQL 14.18, verbatim:
 *
 *     AssertionError [ERR_ASSERTION]: the last delivery of a run whose
 *     execution threw left it `running` — G4132`s residue: nothing will ever
 *     deliver it again, so it reads that way for ever.
 *       + actual - expected
 *       + 'running'
 *       - 'failed'
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
import type { TenantId } from '../../model/domain.ts'
import type { RunId } from '../../model/kernel.ts'
import {
  RUN_QUEUE_MAX_RECEIVE_COUNT,
  RUN_QUEUE_MESSAGE_KIND,
  type RunAdmittedMessage,
} from '../../server/data-plane/run-queue.ts'
import { processReceivedRun } from '../../server/data-plane/run-worker-process.ts'
import {
  RUN_EXECUTION_FAILURE_CAUSES,
  executeRun,
  isRunDeadlineExceeded,
  isRunInputsChanged,
  settleRunAsFailed,
} from '../../server/data-plane/run-executor.ts'
import {
  inProcessEngine,
  threadedEngine,
  type EngineRunner,
} from '../../server/data-plane/run-engine-thread.ts'
import { runScopedName } from '../run-scoped-db.ts'
import {
  seedCorpusDefinition,
  seedCorpusDocuments,
  seedCorpusReference,
  seedCorpusRun,
  type Q,
} from './run-corpus.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RUN_BOUNDED_DB_NAME'] ?? runScopedName('reconcile_run_bounded_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DEF = 'def_bounded'
const DEF_MOVING = 'def_moving'

const RUN_THROWS_FINAL = 'run_throws_final'
const RUN_THROWS_EARLY = 'run_throws_early'
const RUN_SLOW_ENGINE = 'run_slow_engine'
const RUN_SLOW_SQL = 'run_slow_sql'
const RUN_THREADED = 'run_threaded'
const RUN_ACCOUNTED = 'run_accounted'
const RUN_QUEUED_ONLY = 'run_queued_only'
const RUN_COMPLETED = 'run_completed'

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the bounded-run assertions', probe)

async function asMigrator<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

function message(runId: string): RunAdmittedMessage {
  return { kind: RUN_QUEUE_MESSAGE_KIND, tenantId: ACME as TenantId, runId: runId as RunId }
}

/**
 * A pool whose connections THROW on any statement matching `pattern` — a
 * transient execution error, injected below the executor so nothing in
 * `server/` is told it is under test.
 */
function faultingPool(inner: TenantPool, pattern: RegExp): TenantPool {
  return {
    async connect(): Promise<ScopedClient> {
      const c = await inner.connect()
      return {
        query: async (text, values) => {
          if (pattern.test(text)) throw new Error(`injected fault on: ${text.slice(0, 40)}`)
          return c.query(text, values)
        },
        release: (err) => c.release(err),
      }
    },
    end: () => inner.end(),
  }
}

async function runRow(
  pool: TenantPool,
  runId: string,
): Promise<{ status: string; finished: boolean; cause: string | null }> {
  return withTenantScope(pool, ACME, async (tx) => {
    const r = (
      await tx.query(
        'SELECT status, finished_at, execution_failure_cause FROM run WHERE id = $1',
        [runId],
      )
    ).rows as unknown as {
      status: string
      finished_at: unknown
      execution_failure_cause: string | null
    }[]
    const row = r[0]
    if (row === undefined) throw new Error(`run ${runId} not visible`)
    return {
      status: row.status,
      finished: row.finished_at !== null,
      cause: row.execution_failure_cause,
    }
  })
}

/** An engine that never answers until it is aborted — a run that would not end. */
const hangingEngine: EngineRunner = (_input, signal) =>
  new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })

/** A pool whose connections sleep `seconds` before any statement matching `pattern`. */
function sleepingPool(inner: TenantPool, pattern: RegExp, seconds: number): TenantPool {
  return {
    async connect(): Promise<ScopedClient> {
      const c = await inner.connect()
      return {
        query: async (text, values) => {
          if (pattern.test(text)) await c.query('SELECT pg_sleep($1)', [seconds])
          return c.query(text, values)
        },
        release: (err) => c.release(err),
      }
    },
    end: () => inner.end(),
  }
}

describe('a run reaches a terminal status or an alarm', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await asMigrator(async (q) => {
      await seedCorpusReference(q, ACME)
      await seedCorpusDefinition(q, ACME, DEF)
      await seedCorpusDocuments(q, ACME, DEF, 'sd', 2)
      await seedCorpusDefinition(q, ACME, DEF_MOVING)
      await seedCorpusDocuments(q, ACME, DEF_MOVING, 'mv', 3)
      for (const r of [
        RUN_THROWS_FINAL, RUN_THROWS_EARLY, RUN_SLOW_ENGINE, RUN_SLOW_SQL,
        RUN_THREADED, RUN_ACCOUNTED, RUN_QUEUED_ONLY, RUN_COMPLETED,
      ]) {
        await seedCorpusRun(q, ACME, r, DEF)
      }
      await q(`UPDATE run SET status = 'completed', finished_at = now() WHERE id = $1`, [RUN_COMPLETED])
    })
    pool = await createAppPool(4)
  })

  after(async () => {
    await pool.end()
  })

  it('1 · the FINAL receive of a run whose execution throws settles it `failed` and removes the message', async () => {
    const removed: string[] = []
    const faulty = faultingPool(pool, /definition_engine_spec/)
    await processReceivedRun(
      faulty,
      { message: message(RUN_THROWS_FINAL), handle: 'rh_final', receiveCount: RUN_QUEUE_MAX_RECEIVE_COUNT },
      { remove: async (h) => void removed.push(h), log: () => undefined },
    ).catch(() => undefined)

    const row = await runRow(pool, RUN_THROWS_FINAL)
    assert.equal(
      row.status,
      'failed',
      'the last delivery of a run whose execution threw left it `' + row.status + '` — G4132`s ' +
        'residue: nothing will ever deliver it again, so it reads that way for ever.',
    )
    assert.equal(row.finished, true)
    assert.equal(row.cause, 'execution_error', 'the reason is recorded SEPARATELY from the status')
    assert.deepEqual(removed, ['rh_final'])
  })

  it('1a · an EARLIER delivery that throws leaves the run `running` and the message on the queue', async () => {
    const removed: string[] = []
    const faulty = faultingPool(pool, /definition_engine_spec/)
    await assert.rejects(
      processReceivedRun(
        faulty,
        { message: message(RUN_THROWS_EARLY), handle: 'rh_early', receiveCount: 1 },
        { remove: async (h) => void removed.push(h), log: () => undefined },
      ),
      /injected fault/,
    )
    const row = await runRow(pool, RUN_THROWS_EARLY)
    assert.equal(
      row.status,
      'running',
      'a non-final delivery settled the run — the worker is RETRYING ON ITS OWN AUTHORITY. ' +
        'G211 as amended: SQS redelivery is the only retry authority.',
    )
    assert.deepEqual(removed, [], 'the message was deleted, so SQS can never redeliver it')

    /* … and the redelivery that succeeds settles it normally. */
    const removedLater: string[] = []
    await processReceivedRun(
      pool,
      { message: message(RUN_THROWS_EARLY), handle: 'rh_early_2', receiveCount: 2 },
      { remove: async (h) => void removedLater.push(h), log: () => undefined, engine: inProcessEngine },
    )
    assert.equal((await runRow(pool, RUN_THROWS_EARLY)).status, 'completed')
    assert.deepEqual(removedLater, ['rh_early_2'])
  })

  it('2 · an engine that does not end is STOPPED at the deadline and the run is `failed` on THIS delivery', async () => {
    const removed: string[] = []
    const started = Date.now()
    const out = await processReceivedRun(
      pool,
      { message: message(RUN_SLOW_ENGINE), handle: 'rh_slow', receiveCount: 1 },
      {
        remove: async (h) => void removed.push(h),
        log: () => undefined,
        deadline: Date.now() + 800,
        engine: hangingEngine,
      },
    )
    const took = Date.now() - started
    assert.deepEqual(out, { kind: 'settled_failed', cause: 'deadline_exceeded' })
    assert.ok(took < 5000, `the deadline did not stop the engine — it took ${took}ms`)
    const row = await runRow(pool, RUN_SLOW_ENGINE)
    assert.equal(row.status, 'failed')
    assert.equal(row.cause, 'deadline_exceeded')
    assert.deepEqual(
      removed,
      ['rh_slow'],
      'a deadline is deterministic: redelivering it is four more wasted executions, not a retry',
    )
  })

  it('2a · `statement_timeout` is bound to the deadline: a slow STATEMENT is cancelled, and that is the deadline too', async () => {
    const removed: string[] = []
    const slow = sleepingPool(pool, /definition_engine_spec/, 30)
    const started = Date.now()
    const out = await processReceivedRun(
      slow,
      { message: message(RUN_SLOW_SQL), handle: 'rh_sql', receiveCount: 1 },
      {
        remove: async (h) => void removed.push(h),
        log: () => undefined,
        deadline: Date.now() + 1500,
        engine: inProcessEngine,
      },
    )
    const took = Date.now() - started
    assert.deepEqual(out, { kind: 'settled_failed', cause: 'deadline_exceeded' })
    assert.ok(took < 10_000, `a 30s statement was not cancelled at the deadline — it took ${took}ms`)
    assert.equal((await runRow(pool, RUN_SLOW_SQL)).cause, 'deadline_exceeded')
  })

  it('2b · `isRunDeadlineExceeded()` reads SQLSTATE 57014 as the deadline, and no other code', () => {
    assert.equal(isRunDeadlineExceeded({ code: '57014' }), true)
    assert.equal(isRunDeadlineExceeded({ code: '23505' }), false)
    assert.equal(isRunDeadlineExceeded(new Error('x')), false)
    assert.equal(isRunDeadlineExceeded(null), false)
  })

  it('3 · the DEFAULT engine runs on a thread and still reconciles — the clone carries the corpus', async () => {
    const out = await executeRun(pool, message(RUN_THREADED), { engine: threadedEngine })
    assert.equal(out.kind, 'produced', JSON.stringify(out, (_k, v: unknown) => (typeof v === 'bigint' ? String(v) : v)))
    if (out.kind !== 'produced') return
    assert.equal(out.terminalStatus, 'completed')
    assert.equal((await runRow(pool, RUN_THREADED)).cause, null)
  })

  it('3a · an already-aborted signal rejects at once with its reason', async () => {
    const controller = new AbortController()
    const reason = new Error('stop')
    controller.abort(reason)
    await assert.rejects(threadedEngine({} as never, controller.signal), (e) => e === reason)
  })

  it('4 · the settle NEVER overwrites a terminal status', async () => {
    assert.equal(await settleRunAsFailed(pool, message(RUN_COMPLETED), 'execution_error'), false)
    const row = await runRow(pool, RUN_COMPLETED)
    assert.equal(row.status, 'completed')
    assert.equal(row.cause, null)
  })

  it('4a · nor a run that has an ACCOUNT, even one still reading `running`', async () => {
    await executeRun(pool, message(RUN_ACCOUNTED), { engine: inProcessEngine })
    await asMigrator((q) =>
      q(`UPDATE run SET status = 'running', finished_at = NULL WHERE id = $1`, [RUN_ACCOUNTED]),
    )
    assert.equal(await settleRunAsFailed(pool, message(RUN_ACCOUNTED), 'deadline_exceeded'), false)
    assert.equal((await runRow(pool, RUN_ACCOUNTED)).status, 'running')
  })

  it('4b · nor a run that never STARTED — `queued` is left for the queue, so the dead-letter alarm holds it', async () => {
    const removed: string[] = []
    const faulty = faultingPool(pool, /SET status = 'running'/)
    await assert.rejects(
      processReceivedRun(
        faulty,
        { message: message(RUN_QUEUED_ONLY), handle: 'rh_q', receiveCount: RUN_QUEUE_MAX_RECEIVE_COUNT },
        { remove: async (h) => void removed.push(h), log: () => undefined },
      ),
    )
    assert.equal((await runRow(pool, RUN_QUEUED_ONLY)).status, 'queued')
    assert.deepEqual(
      removed,
      [],
      'the message was deleted for a run nobody settled — no terminal status AND no alarm',
    )
  })

  it('6 · `observe` reports read, engine and write once each, and the connection-held time covers them (G4368)', async () => {
    await asMigrator((q) => seedCorpusRun(q, ACME, 'run_observed', DEF))
    const phases: string[] = []
    const ms: Record<string, number> = {}
    const held: number[] = []
    const out = await executeRun(pool, message('run_observed'), {
      engine: inProcessEngine,
      observe: (phase, t) => {
        phases.push(phase)
        ms[phase] = t
      },
      observeConnection: (t) => void held.push(t),
    })
    assert.equal(out.kind, 'produced')
    assert.deepEqual(phases, ['read', 'engine', 'write'])
    assert.equal(
      held.length,
      3,
      'three scopes since G4363: the start transition, the read and the write — the engine holds none',
    )
  })

  it('7 · G4363 — NO DATABASE CONNECTION IS IN A TRANSACTION WHILE THE ENGINE RUNS', async () => {
    await asMigrator((q) => seedCorpusRun(q, ACME, 'run_no_conn_held', DEF))
    /* ⚠️ THE PROBE CONNECTS AS `reconcile_app` ITSELF: `pg_stat_activity`
     * hides another role's `xact_start` from an unprivileged reader, so a probe
     * run as the migrator counted ZERO against the single-transaction executor
     * too and passed vacuously on its first run — measured here, and the same
     * finding `tests/http/federated-signin-served.test.ts` §5 records. */
    const probePool = await createAppPool(2)
    const inside = async (): Promise<number> => {
      const c = await probePool.connect()
      try {
        const r = (
          await c.query(
            `SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname = current_database() AND usename = current_user
                AND pid <> pg_backend_pid() AND xact_start IS NOT NULL`,
          )
        ).rows as unknown as { n: number }[]
        return r[0]?.n ?? -1
      } finally {
        c.release()
      }
    }
    /* ANTI-VACUITY: the probe really does see an app-role backend in a transaction. */
    const holder = await pool.connect()
    try {
      await holder.query('BEGIN')
      await holder.query('SELECT 1')
      assert.equal(await inside(), 1, 'the probe cannot see an open app-role transaction')
    } finally {
      await holder.query('ROLLBACK')
      holder.release()
    }
    let inTransaction = -1
    const probing: EngineRunner = async (input, signal) => {
      inTransaction = await inside()
      return inProcessEngine(input, signal)
    }
    const out = await executeRun(pool, message('run_no_conn_held'), { engine: probing })
    await probePool.end()
    assert.equal(out.kind, 'produced')
    assert.equal(
      inTransaction,
      0,
      `${inTransaction} app-role backend(s) were INSIDE A TRANSACTION while the engine ran — ` +
        'G1521`s single scope held a pooled connection for the whole engine call (G1524).',
    )
  })

  /* ================================================================ *
   * §8  G4369 — THE FINGERPRINT: a change between the read and the write
   *     REFUSES the write. Mutations land WHILE THE ENGINE RUNS, which is the
   *     only window the split opened.
   * ================================================================ */

  /** An engine that runs `during` (as the migrator) before computing. */
  const mutatingEngine =
    (during: (q: Q) => Promise<unknown>): EngineRunner =>
    async (input, signal) => {
      await asMigrator(during)
      return inProcessEngine(input, signal)
    }

  async function accountCount(runId: string): Promise<number> {
    return withTenantScope(pool, ACME, async (tx) =>
      (await tx.query('SELECT 1 FROM tenant.run_engine_account WHERE run_id = $1', [runId])).rows.length,
    )
  }

  it('8 · the definition VERSION moves mid-engine: the write is refused, nothing is written, the run stays `running`', async () => {
    await asMigrator((q) => seedCorpusRun(q, ACME, 'run_mv_version', DEF_MOVING))
    await assert.rejects(
      executeRun(pool, message('run_mv_version'), {
        engine: mutatingEngine((q) =>
          q(`UPDATE tenant.reconciliation_definition SET version = version + 1 WHERE id = $1`, [DEF_MOVING]),
        ),
      }),
      (e) => isRunInputsChanged(e),
    )
    assert.equal(await accountCount('run_mv_version'), 0, 'an account was written over inputs it was not computed from')
    assert.equal((await runRow(pool, 'run_mv_version')).status, 'running')
  })

  it('8a · the DOCUMENT SET moves mid-engine on an early delivery: refused, and the message is LEFT for SQS', async () => {
    await asMigrator((q) => seedCorpusRun(q, ACME, 'run_mv_docs', DEF_MOVING))
    const removed: string[] = []
    await assert.rejects(
      processReceivedRun(
        pool,
        { message: message('run_mv_docs'), handle: 'rh_mv', receiveCount: 1 },
        {
          remove: async (h) => void removed.push(h),
          log: () => undefined,
          engine: mutatingEngine((q) =>
            q(
              `DELETE FROM tenant.document_slot_binding
                WHERE definition_id = $1 AND source_document_id = 'mv_r1'`,
              [DEF_MOVING],
            ),
          ),
        },
      ),
      (e) => isRunInputsChanged(e),
    )
    assert.deepEqual(removed, [])
    assert.equal(await accountCount('run_mv_docs'), 0)
    /* … and the redelivery reads the NEW inputs and settles normally. */
    await processReceivedRun(
      pool,
      { message: message('run_mv_docs'), handle: 'rh_mv_2', receiveCount: 2 },
      { remove: async () => undefined, log: () => undefined, engine: inProcessEngine },
    )
    assert.equal(await accountCount('run_mv_docs'), 1)
  })

  it('8b · on the LAST delivery a moving input settles the run `failed`, cause `inputs_changed`', async () => {
    await asMigrator((q) => seedCorpusRun(q, ACME, 'run_mv_final', DEF_MOVING))
    const removed: string[] = []
    const out = await processReceivedRun(
      pool,
      { message: message('run_mv_final'), handle: 'rh_mvf', receiveCount: RUN_QUEUE_MAX_RECEIVE_COUNT },
      {
        remove: async (h) => void removed.push(h),
        log: () => undefined,
        engine: mutatingEngine((q) =>
          q(
            `DELETE FROM tenant.document_slot_binding
              WHERE definition_id = $1 AND source_document_id = 'mv_r0'`,
            [DEF_MOVING],
          ),
        ),
      },
    )
    assert.deepEqual(out, { kind: 'settled_failed', cause: 'inputs_changed' })
    const row = await runRow(pool, 'run_mv_final')
    assert.equal(row.status, 'failed')
    assert.equal(row.cause, 'inputs_changed')
    assert.deepEqual(removed, ['rh_mvf'])
  })

  it('9 · two deliveries executing CONCURRENTLY: one produces, the other answers `already_accounted` without an error', async () => {
    await asMigrator((q) => seedCorpusRun(q, ACME, 'run_concurrent', DEF))
    const both = await Promise.all([
      executeRun(pool, message('run_concurrent'), { engine: inProcessEngine }),
      executeRun(pool, message('run_concurrent'), { engine: inProcessEngine }),
    ])
    const kinds = both.map((o) => o.kind).sort()
    assert.deepEqual(kinds, ['already_accounted', 'produced'])
    assert.equal(await accountCount('run_concurrent'), 1)
  })

  it('5 · a cause may stand only beside `failed` — the one CHECK `0620` adds', async () => {
    await assert.rejects(
      asMigrator((q) =>
        q(`UPDATE run SET execution_failure_cause = 'execution_error' WHERE id = $1`, [RUN_COMPLETED]),
      ),
      /run_execution_failure_cause_only_when_failed/,
    )
  })

  it('5a · and the cause VOCABULARY is not a CHECK (`0007`/`0069``s polarity)', async () => {
    const defs = await asMigrator(
      async (q) =>
        (
          await q(
            `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
              WHERE conrelid = 'public.run'::regclass AND contype = 'c'`,
          )
        ).rows as { d: string }[],
    )
    for (const cause of RUN_EXECUTION_FAILURE_CAUSES) {
      assert.ok(!defs.some((r) => r.d.includes(cause)), `a CHECK names \`${cause}\``)
    }
  })
})

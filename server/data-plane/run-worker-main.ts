/**
 * THE RUN WORKER AS A PROCESS — ONE MESSAGE, ONE SCOPE, THEN EXIT.
 * 20 Sep 2026, R-B.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 IT IS NOT A LOOP, AND THAT IS A REFUSAL RATHER THAN AN OMISSION.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A loop is a PROCESS SHAPE, and a process shape is a deployment decision:
 * long-running ECS service, scheduled task, Lambda on an event-source mapping,
 * or a container somebody runs by hand. **Each of those is a different
 * `infra/` change and a different cost, and none of them is this slice's to
 * choose** — `infra/lib/run-queue-stack.ts` says in its own header that the
 * queue has a producer and NO CONSUMER IN AWS, names the three shapes, and
 * leaves the choice to a person. Writing the loop here would settle that
 * question in a file nobody would think to look in.
 *
 * So: receive at most one message, act on it, delete it, exit 0. Run it
 * locally against `compose.yaml`'s queue as many times as you like.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 IT HOLDS THE APP ROLE AND NOTHING STRONGER — THE SAME CREDENTIAL THE
 *    LISTENER HOLDS, AND FOR THE SAME REASON.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `createAppPool()` connects as `reconcile_app`, `NOBYPASSRLS`, owning
 * nothing. **That is the whole of what R-B bought** — the owner's rejected
 * alternative was *"a `BYPASSRLS` worker role, which is simplest to write and
 * puts a role that can read every tenant into a long-running process — every
 * isolation assertion in `tests/` is relative to no serving process holding
 * that role."* A worker that took the migrator would make this file the
 * exception that ends that sentence.
 *
 * ⚠️ IT DOES NOT PROVISION AND IT DOES NOT MIGRATE, exactly as
 * `server/data-plane/main.ts` does not: this file's static import closure
 * reaches neither `db/provision.ts` nor `db/migrate.ts`, so there is no code
 * path to `CREATE ROLE` no matter which variables somebody sets.
 *
 * ✅ **IT EXECUTES SINCE 21 Sep 2026 — E5, `server/data-plane/run-executor.ts`.
 * ⚠️ THE SENTENCE BELOW IS CORRECTED RATHER THAN DELETED, because it is the
 * one this file and `run-worker.ts` both carried and the one a reader would
 * have quoted onward.** IT READ:
 *
 *     "⚠️ AND IT EXECUTES NOTHING. Read `server/data-plane/run-worker.ts`'s
 *      header before concluding this process is broken: R-A gives a definition
 *      its content, and until it lands there is nothing for an executor to
 *      execute."
 *
 * **R-A landed (`db/migrations/0160`), and so did the three slices that give a
 * definition documents to run over — E1, E2 and E3.** This process now claims
 * the run AND executes it, in that order and in two separate scopes.
 *
 * ⚠️ **TWO SCOPES AND NOT ONE, WHICH IS A COST RATHER THAN A DESIGN.** The
 * claim proves the worker reached the right tenant's scope and can see the run;
 * the execution opens its own transaction because the engine call belongs
 * inside the same scope as the writes and not inside the same scope as a
 * diagnostic read. A run that vanishes between the two is `run_not_visible`
 * again on the second, which is the honest answer.
 *
 * 🛑 **AND THE VISIBILITY TIMEOUT IS NOW LOAD-BEARING — READ
 * `run-executor.ts` §3 BEFORE DEPLOYING THIS ANYWHERE.** Execution may exceed
 * `RUN_QUEUE_VISIBILITY_SECONDS` — ⚠️ **raised from 30 to 1800 (G1834, 22 Sep
 * 2026, THE OWNER'S), a policy choice bounded by nothing measured; see that
 * constant's own header** — in which case a second worker starts a
 * second execution of the same run. Exactly one account row survives —
 * `run_engine_account`'s primary key — but the duplicated WORK is real.
 */

import { enginePassword } from '../../db/env.ts'
import { createAppPool, createEnginePool } from '../../db/tenant-scope.ts'
import { dataPlaneConfig } from './config.ts'
import { runQueueTarget } from './run-queue.ts'
import {
  RUN_FAILED_WRITE_SECONDS,
  RUN_HARD_KILL_GRACE_SECONDS,
  RUN_MAX_EXECUTION_SECONDS,
} from './run-executor.ts'
import { processReceivedRun } from './run-worker-process.ts'
import { sqsRunQueueConsumer } from './sqs-run-queue.ts'

/**
 * Long-poll rather than spin.
 *
 * ⚠️ TWENTY IS SQS's MAXIMUM AND IS THE CHEAPEST SETTING RATHER THAN THE
 * SLOWEST: a short poll returns immediately and is billed per empty receive,
 * so the value that costs least is the one that waits longest.
 */
const WAIT_SECONDS = 20


async function main(): Promise<void> {
  const config = dataPlaneConfig()
  const target = runQueueTarget()

  if (target === null) {
    console.error(
      'run-worker: no run queue is configured. Set `RECONCILE_RUN_QUEUE_URL` (and ' +
        '`RECONCILE_RUN_QUEUE_ENDPOINT` against the local stack). Nothing was read and ' +
        'nothing was changed.',
    )
    process.exitCode = 1
    return
  }

  const consumer = sqsRunQueueConsumer(target, WAIT_SECONDS)
  /*
   * ✅ G3741 — THE WORKER HOLDS `reconcile_engine` WHEN IT IS GIVEN ITS
   * CREDENTIAL, AND THE HEADER'S *"THE SAME CREDENTIAL THE LISTENER HOLDS"* IS
   * CORRECTED HERE RATHER THAN THERE: it is true of a worker started without
   * `RECONCILE_ENGINE_PASSWORD`. ⚠️ THIS SAID *"and that is still every
   * deployed worker, because `infra/lib/run-queue-stack.ts` hands the task
   * `RECONCILE_APP_PASSWORD` alone (G3749, owed)"* — G3861 (4 Oct 2026) hands
   * it the engine credential instead, IN CODE; a deployed worker holds it only
   * once `Data`, `Planes` and `RunQueue` are deployed in that order and the
   * data migrate task has run (`docs/build/deploy-handoff.md`). Until then the
   * line below still fires. `reconcile_engine` is `reconcile_app`'s privileges
   * PLUS `INSERT` on the two exception tables (`db/migrations/0500` §1) — still
   * `NOBYPASSRLS`, still owning nothing, so R-B's sentence about a `BYPASSRLS`
   * worker is untouched. Without the credential the executor writes the run's
   * account and says, by name, that its exceptions were NOT persisted.
   */
  const asEngine = enginePassword() !== undefined
  const pool = asEngine
    ? await createEnginePool(config.database.poolMax)
    : await createAppPool(config.database.poolMax)
  if (!asEngine) {
    console.log(
      'run-worker: no `RECONCILE_ENGINE_PASSWORD` — connected as `reconcile_app`. Runs ' +
        'will be ACCOUNTED and their exceptions NOT persisted (`db/migrations/0500` §1).',
    )
  }

  try {
    const received = await consumer.receive()

    if (received.kind === 'none') {
      console.log(`run-worker: no message after ${WAIT_SECONDS}s. Nothing to do.`)
      return
    }

    if (received.kind === 'unreadable') {
      /*
       * 🛑 NOT DELETED. See `receiverOver()`: the redrive policy carries it to
       * the dead-letter queue after `maxReceiveCount` deliveries, which is the
       * one place a person can look at whatever wrote it. Deleting it here
       * would destroy the only evidence.
       */
      console.error(
        `run-worker: a message on this queue could not be read — \`${received.refusal}\`. ` +
          'It is LEFT ON THE QUEUE so the redrive policy can carry it to the dead-letter ' +
          'queue. Nothing was opened and nothing was changed.',
      )
      process.exitCode = 1
      return
    }

    const receivedAt = Date.now()
    const watchdog = setTimeout(
      () => {
        console.error(
          `run-worker: run \`${received.message.runId}\` is still being processed ` +
            `${RUN_MAX_EXECUTION_SECONDS + RUN_FAILED_WRITE_SECONDS + RUN_HARD_KILL_GRACE_SECONDS}s ` +
            'after receipt. EXITING NOW (G4367); the message is left for the queue.',
        )
        process.exit(70)
      },
      (RUN_MAX_EXECUTION_SECONDS + RUN_FAILED_WRITE_SECONDS + RUN_HARD_KILL_GRACE_SECONDS) * 1000,
    )
    watchdog.unref()

    try {
      await processReceivedRun(
        pool,
        { message: received.message, handle: received.handle, receiveCount: received.receiveCount },
        {
          remove: (handle) => consumer.remove(handle),
          log: (line) => console.log(line),
          receivedAt,
        },
      )
    } catch {
      /* `processReceivedRun()` has already said why on its own line; the
       * message stays on the queue for SQS to redeliver or dead-letter. */
      process.exitCode = 1
    } finally {
      clearTimeout(watchdog)
    }
  } finally {
    consumer.close()
    await pool.end()
  }
}

await main()

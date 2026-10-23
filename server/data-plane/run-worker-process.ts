/**
 * ONE RECEIVED MESSAGE, ACTED ON — THE BODY OF `run-worker-main.ts`, MOVED
 * HERE SO A TEST CAN DRIVE IT WITHOUT A QUEUE. 5 Oct 2026, G4366.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE OWNER'S AMENDMENT OF G211, 5 Oct 2026, IS WHAT THIS FILE ENFORCES:
 *    *"SQS redelivery bounded by RUN_QUEUE_MAX_RECEIVE_COUNT is the only retry
 *    authority. Duration is bounded below the visibility timeout. Every
 *    admitted run reaches a terminal status or an alarm."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Before this file, an execution that THREW left the run `running` and the
 * message on the queue (G4132's named residue): a redelivery might settle it,
 * and a message that dead-lettered left it `running` for ever. Now:
 *
 *   · the execution is given a DEADLINE measured from RECEIPT
 *     (`RUN_MAX_EXECUTION_SECONDS`, below `RUN_QUEUE_VISIBILITY_SECONDS`).
 *     When it expires the run is settled `failed` (`deadline_exceeded`) on
 *     THIS delivery — the same input would expire again, so redelivering it is
 *     four more wasted executions, not a retry;
 *   · any OTHER error on a delivery that is NOT the last rethrows and leaves
 *     the message: SQS redelivers it after the visibility timeout. **This
 *     worker never retries itself** — the queue is the only retry authority;
 *   · the same error on the LAST delivery (`ApproximateReceiveCount ≥
 *     RUN_QUEUE_MAX_RECEIVE_COUNT`) settles the run `failed`
 *     (`execution_error`) and deletes the message, because nothing will ever
 *     deliver it again.
 *
 * ⚠️ AND WHERE IT CANNOT SETTLE, IT LEAVES THE MESSAGE — WHICH IS THE ALARM.
 * `settleRunAsFailed()` moves a row only from `running` with no account. A run
 * still `queued` (the start transaction itself failed) or a settle that throws
 * (the database is down) leaves the message on the queue, and after the last
 * delivery the redrive policy carries it to the dead-letter queue, whose alarm
 * (`RUN_QUEUE_DEAD_LETTER_MESSAGE_THRESHOLD`) is the *"or an alarm"* half of
 * the ruling. A process KILLED mid-execution (the hard watchdog, an ECS stop)
 * writes nothing and is the same case.
 */

import type { TenantPool } from '../../db/tenant-scope.ts'
import type { EngineRunner } from './run-engine-thread.ts'
import {
  RUN_MAX_EXECUTION_SECONDS,
  describeExecution,
  executeRun,
  isRunDeadlineExceeded,
  isRunInputsChanged,
  settleRunAsFailed,
  type RunExecutionFailureCause,
} from './run-executor.ts'
import { RUN_QUEUE_MAX_RECEIVE_COUNT, type RunAdmittedMessage } from './run-queue.ts'
import { claimAdmittedRun, describeClaim } from './run-worker.ts'

export interface ReceivedRun {
  readonly message: RunAdmittedMessage
  readonly handle: string
  /** `ApproximateReceiveCount`. 1 on the first delivery. */
  readonly receiveCount: number
}

export interface ProcessDeps {
  readonly remove: (handle: string) => Promise<void>
  readonly log: (line: string) => void
  /** Epoch ms the message was received. Defaults to now. */
  readonly receivedAt?: number
  /** Defaults to `RUN_MAX_EXECUTION_SECONDS` after `receivedAt`. */
  readonly deadline?: number
  /** Defaults to the threaded engine. */
  readonly engine?: EngineRunner
}

/** What happened to the message. */
export type ProcessedRun =
  | { readonly kind: 'done' }
  | { readonly kind: 'settled_failed'; readonly cause: RunExecutionFailureCause }

/** Whether this delivery is the last one the queue will make. */
export function isFinalDelivery(receiveCount: number): boolean {
  return receiveCount >= RUN_QUEUE_MAX_RECEIVE_COUNT
}

export async function processReceivedRun(
  pool: TenantPool,
  received: ReceivedRun,
  deps: ProcessDeps,
): Promise<ProcessedRun> {
  const receivedAt = deps.receivedAt ?? Date.now()
  const deadline = deps.deadline ?? receivedAt + RUN_MAX_EXECUTION_SECONDS * 1000
  const { message } = received

  try {
    const claim = await claimAdmittedRun(pool, message)
    deps.log(describeClaim(claim))
    if (claim.kind === 'reached') {
      const options = deps.engine === undefined ? { deadline } : { deadline, engine: deps.engine }
      deps.log(describeExecution(await executeRun(pool, message, options)))
    }
    /* Deleted on every arm the executor ANSWERED — `run_not_visible` included;
     * `run-worker-main.ts`'s note on that arm is unchanged. */
    await deps.remove(received.handle)
    return { kind: 'done' }
  } catch (err) {
    /* G4369 — inputs that moved between the read and the write are RETRIED
     * like any other execution error (a redelivery reads the new inputs), and
     * recorded under their own cause when the last delivery still meets them. */
    const cause: RunExecutionFailureCause = isRunDeadlineExceeded(err)
      ? 'deadline_exceeded'
      : isRunInputsChanged(err)
        ? 'inputs_changed'
        : 'execution_error'
    const final = isFinalDelivery(received.receiveCount)

    if (cause !== 'deadline_exceeded' && !final) {
      deps.log(
        `run-worker: run \`${message.runId}\` THREW on delivery ${received.receiveCount} of ` +
          `${RUN_QUEUE_MAX_RECEIVE_COUNT}. The message is LEFT ON THE QUEUE; SQS redelivers it ` +
          'after the visibility timeout. This worker does not retry (G211 as amended).',
      )
      throw err
    }

    const settled = await settleRunAsFailed(pool, message, cause)
    if (!settled) {
      deps.log(
        `run-worker: run \`${message.runId}\` could not be settled \`failed\` (\`${cause}\`) — ` +
          'it is not `running`, or it has an account. The message is LEFT; if this was the ' +
          'last delivery the dead-letter queue and its alarm hold it.',
      )
      throw err
    }
    deps.log(
      `run-worker: run \`${message.runId}\` SETTLED \`failed\` — \`${cause}\`, delivery ` +
        `${received.receiveCount} of ${RUN_QUEUE_MAX_RECEIVE_COUNT}. The message is deleted.`,
    )
    await deps.remove(received.handle)
    return { kind: 'settled_failed', cause }
  }
}

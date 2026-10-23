/**
 * THE ENGINE CALL, RUN ON A WORKER THREAD SO A DEADLINE CAN STOP IT.
 * 5 Oct 2026, G4365 — the owner's amendment of G211: *"Duration is bounded
 * below the visibility timeout."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY A THREAD AND NOT A `setTimeout`: `runSetReconciliation()` IS
 *    SYNCHRONOUS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A timer on the main thread cannot fire while a synchronous call holds it, so
 * a JS deadline around an in-process engine call is a deadline that is checked
 * only AFTER the engine has finished — which bounds nothing. `statement_timeout`
 * bounds the SQL and is blind to the engine for the same reason a database is
 * blind to its client's CPU. **The engine is the one unbounded phase**
 * (G1524: *"a bound is a reason to expect survivability and is not a
 * measurement"*), so it is the phase that runs where it can be terminated.
 *
 * `Worker.terminate()` stops the thread at its next JS instruction boundary
 * even mid-loop. The main thread stays responsive throughout, which is also
 * what lets `run-worker-main.ts`'s hard watchdog fire.
 *
 * ⚠️ THE COST, NAMED: the input and the result cross the thread boundary by
 * STRUCTURED CLONE. Both are plain data — branded strings, numbers, `bigint`
 * money (G286), arrays and records — and structured clone carries every one of
 * those, `bigint` included. A future field holding a function or a class
 * instance would fail LOUDLY here (`DataCloneError`) rather than silently,
 * which is the right direction. The clone is a copy, so peak memory is roughly
 * twice the corpus; `tools/run-measure.mjs` (G1524's harness) prints RSS so the
 * cost is a figure rather than a guess.
 *
 * ⚠️ AND THE THREAD HOLDS NO CONNECTION, NO CREDENTIAL AND NO SCOPE. It imports
 * `model/reconciliation.ts` and nothing from `db/` — the engine is pure, so the
 * thread is a function call on another stack and not a second worker.
 */

import { Worker, isMainThread, parentPort } from 'node:worker_threads'

import {
  runSetReconciliation,
  type SetReconciliationInput,
  type SetReconciliationOutcome,
} from '../../model/reconciliation.ts'

/**
 * Runs the engine; resolves with its outcome, rejects if the thread throws or
 * `signal` aborts first. Aborting TERMINATES the thread.
 */
export type EngineRunner = (
  input: SetReconciliationInput,
  signal: AbortSignal,
) => Promise<SetReconciliationOutcome>

/** The in-process engine. Used by tests that need an engine with no thread. */
export const inProcessEngine: EngineRunner = async (input) => runSetReconciliation(input)

export const threadedEngine: EngineRunner = (input, signal) =>
  new Promise<SetReconciliationOutcome>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const worker = new Worker(new URL(import.meta.url))
    let settled = false
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      fn()
    }
    const onAbort = (): void => {
      finish(() => reject(signal.reason))
      void worker.terminate()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    worker.once('message', (outcome: SetReconciliationOutcome) => {
      finish(() => resolve(outcome))
      void worker.terminate()
    })
    worker.once('error', (err) => finish(() => reject(err)))
    worker.once('exit', (code) =>
      finish(() => reject(new Error(`run-engine-thread: the engine thread exited (${code}) with no outcome`))),
    )
    worker.postMessage(input)
  })

/* ---- the thread side ---- */
if (!isMainThread && parentPort !== null) {
  const port = parentPort
  port.once('message', (input: SetReconciliationInput) => {
    port.postMessage(runSetReconciliation(input))
  })
}

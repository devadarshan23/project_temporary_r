/**
 * THE CONSUME HALF OF R-B — AND IT IS **THE SEAM, NOT THE EXECUTOR.**
 * 20 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ **THE PRODUCT RECONCILES SINCE 21 Sep 2026 — E5,
 *    `server/data-plane/run-executor.ts` — AND THIS HEADER'S CAPITALISED CLAIM
 *    WENT FALSE WITH IT. IT IS CORRECTED RATHER THAN DELETED**, because a
 *    capitalised claim left standing after it goes false is worse than none:
 *    the next reader trusts the capitals. IT READ:
 *
 *      "🛑 READ THIS BEFORE READING THE CODE AS UNFINISHED: **THIS WORKER
 *       DELIBERATELY RECONCILES NOTHING, AND THE ABSENCE IS THE SLICE.** …
 *       **Nothing here calls `runSetReconciliation()`, and nothing here writes
 *       a row.** A reader who mistakes that for a stub will "fix" it and land
 *       an executor with no definition to execute."
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🛑 **IT IS STILL EXACTLY TRUE OF THIS FILE, AND THAT IS THE DISTINCTION TO
 *    READ.** `claimAdmittedRun()` below still takes one message, opens exactly
 *    that tenant's scope, reads the run and reports. **Nothing in THIS module
 *    calls `runSetReconciliation()` and nothing in it writes a row**. What
 *    changed is that `run-worker-main.ts` now calls the EXECUTOR after this
 *    claim, in its own scope. Derive it — **and note the `grep -v`, which is
 *    not decoration:**
 *
 *      grep -v '^\s*\*' server/data-plane/run-worker.ts \
 *        | grep -c 'runSetReconciliation\|INSERT'                          # 0
 *
 * ⚠️ **THE NAIVE FORM OF THAT COMMAND ANSWERS 3, AND ALL THREE ARE THIS VERY
 *    PARAGRAPH.** It was written here without the `grep -v` first and measured
 *    its own argument — **G978's shape exactly**, which `server/data-plane/token-verify.ts`
 *    records costing six documents a false derivation: *"It answers `4` today —
 *    this very correction is the fourth prose line — and it would answer `4` if
 *    a verifier had never been written."* Caught by running it rather than by
 *    reading it.
 *
 * ⚠️ **AND THE CONDITION THE OLD CLAIM RESTED ON IS DISCHARGED**: *"an executor
 *    with no definition to execute"* was true while `tenant.reconciliation_definition`
 *    stored four columns the engine does not consume. R-A (`db/migrations/0160`)
 *    gave a definition its content and E1–E4 gave it documents, so the executor
 *    that landed is not the one this paragraph warned against.
 *
 * **WHY, MEASURED RATHER THAN ASSERTED.** `SetReconciliationInput` needs
 * EIGHTEEN fields and `tenant.reconciliation_definition` stores FOUR. Derive
 * both, never read them:
 *
 *     awk '/export interface SetReconciliationInput/,/^}/' model/reconciliation.ts \
 *       | grep -c '^\s*readonly'                                          # 18
 *     awk '/CREATE TABLE tenant.reconciliation_definition \(/,/\);/' \
 *       db/migrations/0069_run_admission.sql | grep -E '^\s+[a-z_]+ ' | awk '{print $1}'
 *     #   tenant_id  id  version  status — and nothing else
 *
 * `PopulationBinding`, `PairingSpec`, `StrategyBinding[]`, the tolerance
 * direction, the subset-sum bound, the similarity policy and the admission
 * ceiling are DEFINITION CONTENT with no column anywhere. **R-A is the ruling
 * that gives them one, it is being built concurrently, and an executor written
 * before it lands would have to invent the seventeen it cannot read** —
 * inventing a tolerance direction is inventing a reconciliation result.
 *
 * ✅ **R-A LANDED AS `db/migrations/0160` AND THE FOUR IS NOW EIGHTEEN MINUS
 *    THE FOUR A DEFINITION DOES NOT OWN.** The paragraph above is kept whole
 *    because its ARGUMENT is why the executor waited, and it is the sentence
 *    that says what would have been wrong with writing one sooner. **Re-run the
 *    two derivations rather than reading either number** — the second now
 *    returns `tenant.definition_engine_spec`'s columns as well.
 *
 * ⚠️ SO THE HONEST BOUNDARY OF THIS SLICE IS: the message leaves the admitting
 * handler, crosses a real queue, arrives at a process, and that process proves
 * it reached the right tenant's scope and can see that run. Everything after
 * that is R-A's and the executor's. **Both arrived on 21 Sep 2026; this
 * module's boundary is unchanged and is now one half of two.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE SQL CARRIES NO TENANT PREDICATE, AND THAT IS THE ASSERTION RATHER
 *    THAN AN OVERSIGHT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `SELECT … FROM run WHERE id = $1` — one bind, the run id, and nothing about
 * a tenant. Isolation is `run_rls` (`db/migrations/0002_run.sql`), reached
 * through the `withTenantScope()` transaction this function opens with the
 * tenant the MESSAGE named.
 *
 * **A message naming tenant A and tenant B's run therefore reaches an empty
 * result set**, and that is `tests/db/run-worker-scope.test.ts` §3 — the whole
 * reason R-B was taken over a scan. Adding `AND tenant_id = $2` would make the
 * suite pass for the wrong reason: isolation from a `WHERE` a reader happens
 * to carry is indistinguishable from isolation from the database until you
 * turn the database off, which is why §4 of that suite turns it off.
 *
 * ⚠️ AND THE OUTCOME IS THE SAME FOR THREE DIFFERENT FACTS, WHICH IS STATED
 * HERE SO NOBODY READS `run_not_visible` AS *"another tenant tried"*: a run in
 * another tenant, a run id that never existed, and a run whose admitting
 * transaction rolled back all reach it. **They are indistinguishable by
 * construction and must stay so** — telling them apart would mean reading
 * outside the scope, which is the thing this design does not do.
 */

import { withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import type { DefinitionId, RunId, TenantId } from '../../model/kernel.ts'
import type { RunAdmittedMessage } from './run-queue.ts'

/**
 * What the worker found, in the scope it was told to open.
 *
 * ⚠️ `status` AND `definitionId` ARE CARRIED AND NOTHING IS DONE WITH THEM
 * HERE. They are what the executor's first line will need, and reading them
 * now is how this function's test can tell *"opened the right scope"* from
 * *"opened a scope"* — a claim that returned only a boolean would be green
 * against a query that never ran.
 */
export interface ClaimedRun {
  readonly tenantId: TenantId
  readonly runId: RunId
  readonly definitionId: DefinitionId
  readonly definitionVersion: number
  readonly status: string
}

export type RunClaim =
  | { readonly kind: 'reached'; readonly run: ClaimedRun }
  | { readonly kind: 'run_not_visible'; readonly tenantId: TenantId; readonly runId: RunId }

interface RunRow {
  readonly id: string
  readonly definition_id: string
  readonly definition_version: number
  readonly status: string
}

/**
 * Open the tenant's scope the message named, and look for the run it named.
 *
 * 🛑 IT READS AND DOES NOT WRITE, WHICH IS WHAT MAKES A DUPLICATE DELIVERY
 * HARMLESS. SQS is at-least-once and §2 of `server/data-plane/run-queue.ts`
 * adds a second source of duplicates on purpose — pressing Run again
 * re-publishes — so the consuming side has to be idempotent whatever the
 * transport does. **A function that creates nothing is idempotent by
 * construction rather than by discipline.**
 *
 * ⚠️ THERE IS NO `FOR UPDATE` AND NO `SKIP LOCKED`. Those belong to a CLAIM
 * against a shared pool of work, and there is no shared pool here: the message
 * names one run, in one tenant. The executor that eventually writes a status
 * transition will need a concurrency answer, and it will be a different
 * question — *"did somebody else already run THIS run"* — with `run.status`
 * and the same transaction to answer it in.
 */
export async function claimAdmittedRun(
  pool: TenantPool,
  message: RunAdmittedMessage,
): Promise<RunClaim> {
  const rows = await withTenantScope(pool, message.tenantId, async (tx) => {
    const result = await tx.query(
      'SELECT id, definition_id, definition_version, status FROM run WHERE id = $1',
      [message.runId],
    )
    return result.rows as unknown as readonly RunRow[]
  })

  const row = rows[0]
  if (row === undefined) {
    return { kind: 'run_not_visible', tenantId: message.tenantId, runId: message.runId }
  }
  return {
    kind: 'reached',
    run: {
      tenantId: message.tenantId,
      runId: row.id as RunId,
      definitionId: row.definition_id as DefinitionId,
      definitionVersion: row.definition_version,
      status: row.status,
    },
  }
}

/**
 * The line a person reads when the worker runs.
 *
 * ⚠️ IT SAYS WHAT WAS **NOT** DONE, EVERY TIME. A worker that logged
 * *"reached run X"* and stopped would read, in an incident, as a worker that
 * had executed it. The sentence is the same sentence as the header's, because
 * a header nobody opens is not where this belongs.
 */
export function describeClaim(claim: RunClaim): string {
  if (claim.kind === 'run_not_visible') {
    return (
      `run-worker: run \`${claim.runId}\` is NOT VISIBLE in tenant \`${claim.tenantId}\`'s ` +
      'scope. That is one of three facts and they are indistinguishable by construction: ' +
      'another tenant`s run, a run id that never existed, or a run whose admitting ' +
      'transaction rolled back. Nothing was executed.'
    )
  }
  return (
    `run-worker: reached run \`${claim.run.runId}\` in tenant \`${claim.run.tenantId}\` — ` +
    `definition \`${claim.run.definitionId}\` v${claim.run.definitionVersion}, status ` +
    `\`${claim.run.status}\`. NOTHING WAS EXECUTED: this is R-B's seam and not the engine. ` +
    'A definition stores four columns and `SetReconciliationInput` needs eighteen (R-A).'
  )
}

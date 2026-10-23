/**
 * THE EXECUTOR — THE POINT AT WHICH THIS PRODUCT FIRST RECONCILES SOMETHING.
 * G1521–G1528, 21 Sep 2026. E5 of the completion plan's W1.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE GAP THIS CLOSES WAS A CALL SITE AND NOT A WRITER, AND THAT IS WHY
 *    THIS FILE IS SHORT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `persistRunEngineAccount()` has existed since G284, issues all THIRTEEN
 * `INSERT`s, and `db/migrations/0007` has granted `INSERT` on all thirteen
 * tables the whole time. **Its only callers were tests.** So nothing here is a
 * second persister — writing one would be §5.3, and the copy is the one that
 * drifts.
 *
 * What was genuinely missing was the two ENDS: a definition with content (R-A,
 * `definition-store.ts`) and documents to run it over (E4,
 * `document-assembly.ts`). This file is the seam between them and
 * `runSetReconciliation()`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §1  ONE `withTenantScope()` TRANSACTION, AND THE REASON IS NOT TIDINESS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `SET LOCAL` outside a transaction block applies to the current statement and
 * is **silently discarded** — `docs/build/red-buildability.md` names every
 * driver that does it, `pg` included. Under G100 RLS then DENIES ON NULL, so a
 * forgotten transaction does not leak: it yields an EMPTY RESULT SET.
 *
 * 🛑 **AND AN EMPTY RESULT SET IS THE DANGEROUS OUTCOME HERE, NOT A SAFE ONE.**
 *    Everywhere else in this repository deny-on-NULL turns a mistake into a
 *    404. On this path it turns a mistake into **a run that reconciles NOTHING
 *    and reports SUCCESS**: no bindings found, both populations empty, an
 *    engine result that balances perfectly because it accounts for nothing, and
 *    a `run_engine_account` row saying `completed`. The whole act is one
 *    transaction so that the read of the definition, the read of the documents,
 *    the engine call and the thirteen writes are the same scope or none of
 *    them.
 *
 * ✅ **AMENDED 5 Oct 2026 — G4363, THE OWNER'S: *"G1521's one-transaction rule
 *    becomes read → compute (no connection held) → write, with an input
 *    fingerprint checked on write."* THE PARAGRAPH ABOVE IS KEPT, because its
 *    REASON still binds every scope this file opens.** There are now THREE
 *    scopes after the start transition, and each is still `withTenantScope()`,
 *    so deny-on-NULL still cannot be reached by forgetting a transaction:
 *
 *      · READ  — the run, the definition, the declarations, the documents, and
 *                the INPUT FINGERPRINT (`readInputFingerprint()`), read FIRST;
 *      · ENGINE — on a thread (G4365), with NO connection held: G1524's pooling
 *                half, which G4368's harness measured as conn-held ≈ total;
 *      · WRITE — the run row locked `FOR UPDATE`, the fingerprint RE-READ and
 *                compared, then the thirteen writes. A difference REFUSES the
 *                write (`RunInputsChanged`): nothing is written, the scope
 *                rolls back, and the worker treats it as an execution error —
 *                SQS redelivers it (G4361: *"the only retry authority"*) and a
 *                redelivery reads the NEW inputs; on the last delivery the run
 *                is `failed` with cause `inputs_changed` (G4362).
 *
 *    ⚠️ WHAT "A WRITE NOBODY COULD SEE" BECOMES: the engine now runs over data
 *    read in a transaction that has COMMITTED. The fingerprint is what makes
 *    that sound — the account is written only over the inputs it was computed
 *    from — and it is `(definition version, document set)` BY RULING. A spec
 *    row edited without a version bump is NOT caught; nothing on a request path
 *    can write one today (`0160`, `SELECT` only), and that is named rather than
 *    assumed away (G4370).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §2  🛑 THE TRANSACTION IS HELD OPEN ACROSS A CPU-BOUND ENGINE CALL, AND THE
 *     COST OF THAT IS **MEASURED FOR A FIXTURE AND UNMEASURED FOR A REAL
 *     DOCUMENT SET** — G1524. READ THIS BEFORE DEPLOYING ANYTHING.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ✅ **THE HEADING ABOVE WENT FALSE ON 5 Oct 2026 — G4363/G4369 — AND IS KEPT
 * AS IT STOOD.** The engine now runs BETWEEN two scopes with no connection
 * checked out (§1's amendment), which `tests/db/run-execution-bounded.test.ts`
 * §7 witnesses from `pg_stat_activity`. The measurement half below is still
 * exactly true of a real corpus; `tools/run-measure.mjs` (G4368) gives a
 * synthetic one.
 *
 * `docs/build/completion-plan.md` §10 item 5 asks whether `runSetReconciliation()`
 * is fast enough to run inside one `withTenantScope()` transaction for a real
 * document set, and says E5 owes a measurement or an explicit statement that it
 * is unmeasured. **Both halves are given here, and the second is the important
 * one.**
 *
 *   · **MEASURED:** `tests/db/run-executor.test.ts` §7 times the whole scope
 *     against the fixture in that suite and prints it. It is a SMALL fixture —
 *     single-figure documents, single-figure rows — and the figure it reports
 *     is a few milliseconds. **That number is evidence about a fixture and
 *     about nothing else.**
 *   · **UNMEASURED, AND STATED AS SUCH:** nobody has run this against a real
 *     corpus, because **no real corpus exists in this repository** — nothing
 *     has ever ingested a production document, so there is no set to time.
 *     `subsetSumBound`, `readerCandidateCap` and `similarityMaxChars` all exist
 *     to BOUND the engine's cost, and `model/reconciliation.ts` records that
 *     G115 added an upper bound to `similarityMaxChars` precisely because
 *     `levenshteinBasisPoints` is O(n×m) and the pass was *"an unbounded
 *     quadratic over counterparty-controlled text"*. **Those bounds are the
 *     reason to expect this to be survivable and they are not a measurement.**
 *
 * ⚠️ **AND IT IS A POOLING QUESTION UNDER G101, WHICH IS WHY IT IS NOT MERELY
 *    A PERFORMANCE NOTE.** G101 assumes TRANSACTION-MODE pooling from day one.
 *    Under transaction-mode pooling a connection is held for the LIFE OF THE
 *    TRANSACTION, so an engine call of seconds holds a pooled server connection
 *    for seconds — and the pool is shared with the serving plane. A slow run
 *    does not merely take a long time; **it takes a connection away from
 *    requests.** The repair, if one is needed, is a ruling about where the
 *    engine runs and not a change to this file.
 *
 * ⚠️ AND NOTHING IN `npm run check` CAN ANSWER IT. A green gate on a small
 *    fixture is not evidence about a large one, and reporting the fixture's
 *    milliseconds as *"the executor is fast"* would be exactly the shape this
 *    repository catalogues at §5.6.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §3  🛑 EXECUTION EXCEEDING THE QUEUE'S VISIBILITY TIMEOUT — G1525
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ✅ **THE TIMEOUT WAS RAISED — G1834, 22 Sep 2026, THE OWNER'S RULING — AND
 * EVERY "30" BELOW IS CORRECTED HERE RATHER THAN AT EACH SITE, BECAUSE THE
 * MECHANISM THIS SECTION ARGUES IS UNCHANGED AND ONLY THE NUMBER MOVED.**
 * `RUN_QUEUE_VISIBILITY_SECONDS` is now **1800** (30 minutes), a POLICY
 * CHOICE bounded by nothing measured — see that constant's own header in
 * `infra/lib/config.ts`. **The mechanism described below still holds
 * exactly**: a run whose duration exceeds the visibility window still
 * causes a second concurrent execution, `run_engine_account`'s PRIMARY KEY
 * is still what makes exactly one account row survive, and the DLQ triage
 * §3a describes is still the second line of defence. What changed is only
 * how OFTEN the exposure fires — a 45-second run no longer becomes visible
 * at 30 seconds; it would need to exceed 1800.
 *
 * `infra/lib/config.ts` sets `RUN_QUEUE_VISIBILITY_SECONDS = 30`. **That bounds
 * how long the worker may hold a message before SQS makes it visible again, and
 * §2 says plainly that a real document set may exceed it.** When it does, a
 * SECOND worker receives the same `(tenantId, runId)` and starts a SECOND
 * execution while the first is still running.
 *
 * ⚠️ **`run_idempotency_key` DOES NOT HELP, AND THE DISTINCTION MATTERS.** That
 *    UNIQUE INDEX is on ADMISSION — it stops one press of Run creating two
 *    `public.run` rows. It says nothing about executing one run twice.
 *
 * ✅ **WHAT DOES HOLD IS `run_engine_account`'s PRIMARY KEY, `(tenant_id,
 *    run_id)`, AND IT IS WITNESSED RATHER THAN REASONED** —
 *    `tests/db/run-executor.test.ts` §6 runs the executor twice over one run
 *    and requires the second to write nothing:
 *
 *      · If the first has COMMITTED, the second's `already_accounted` arm sees
 *        the row and returns before the engine is called at all.
 *      · If the first is STILL IN FLIGHT, the second's read sees no row (the
 *        first's insert is uncommitted), it does the work, and its own
 *        `INSERT` **blocks on the uncommitted row's lock** until the first
 *        commits — then fails `23505`, and `withTenantScope()` rolls the whole
 *        second transaction back. **Exactly one account row exists either way.**
 *
 * 🛑 **SO THE EXPOSURE IS WASTED WORK AND NOT A DOUBLE WRITE, AND THAT IS THE
 *    HONEST BOUND — IT IS NOT NOTHING.** A duplicate execution costs a second
 *    pooled connection, a second engine run and a second block on a row lock,
 *    all of it discarded.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §3a  🛑 AND D-1 MEASURED THIS FROM THE OTHER SIDE AND FOUND THE HALF THIS
 *      HEADER ORIGINALLY UNDERSTATED. THE PARAGRAPH ABOVE ENDED *"which is at
 *      least a place a person can look"*, AND THAT WAS TOO KIND.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * D-1's measurement, from the consumer side: **a 45-second run becomes visible
 * again at 30s and the next tick executes it CONCURRENTLY** — and after
 * `RUN_QUEUE_MAX_RECEIVE_COUNT` deliveries **a run that SUCCEEDS EVERY TIME
 * lands on the dead-letter queue, so the dead-letter alarm fires reporting the
 * OPPOSITE of what happened.** A green run, alarmed as a failure.
 *
 * ⚠️ **NOTHING IN THIS FILE PREVENTS THAT, AND IT MUST NOT BE READ AS DOING
 *    SO.** The PRIMARY KEY protects the DATA and protects nothing else: the
 *    duplicate EXECUTION happens, the redeliveries happen, and the DLQ message
 *    is written for a run that completed.
 *
 * ✅ **WHAT THIS SLICE DOES ADD IS THAT THE FALSE ALARM IS NOW FALSIFIABLE,
 *    AND THAT IS WORTH STATING BECAUSE BEFORE E5/E6 THERE WAS NOTHING TO
 *    CHECK.** A DLQ'd `(tenantId, runId)` can be resolved against
 *    `tenant.run_engine_account` in that tenant's scope:
 *
 *      · a row with `outcome = 'produced'` — **the run SUCCEEDED and the DLQ
 *        message is the false alarm.** Nothing is lost; the alarm is wrong.
 *      · a row with `outcome = 'refused'` — the engine refused it, the reason
 *        is in `tenant.run_refusal`, and the DLQ message is again not the
 *        story.
 *      · NO row — **the only case where the DLQ message means what it says.**
 *
 *    That triage is the difference between an alarm nobody can act on and one
 *    with a defined next step, and it exists because a refused run now has a
 *    row at all (E6).
 *
 * 🛑 **IT IS A TRIAGE AND NOT A REPAIR, AND THE REPAIR IS NOT THIS FILE'S.**
 *    Raising `RUN_QUEUE_VISIBILITY_SECONDS`, heartbeating the message, or
 *    deleting it before executing (which trades the false alarm for LOSING a
 *    run on a crash) are each an `infra/` or process-shape decision — and
 *    **where the worker runs is still undecided**: `infra/lib/run-queue-stack.ts`
 *    grants nobody `sqs:ReceiveMessage` and names three shapes without choosing
 *    one (G1204, G1205). **Choosing a timeout before choosing a process is
 *    choosing the wrong thing first.**
 *
 * ⚠️ **AND ONE THING IS IN THIS FILE'S FAVOUR AND IS THE REASON THE ESCALATION
 *    IS BOUNDED RATHER THAN UNBOUNDED: once the FIRST execution COMMITS, every
 *    later delivery answers `already_accounted` BEFORE the engine is called.**
 *    So the expensive redeliveries are confined to the window in which nothing
 *    has yet committed; after that they are a `SELECT` and a return.
 *
 * ⚠️ **NOTHING HERE RAISES THE TIMEOUT OR EXTENDS THE MESSAGE, DELIBERATELY.**
 *    Both are `infra/` changes with costs (a longer timeout delays every
 *    genuine retry; a heartbeat needs a process shape), and **where the worker
 *    runs is already an open decision** — `infra/lib/run-queue-stack.ts` grants
 *    nobody `sqs:ReceiveMessage` and names three shapes without choosing one
 *    (G1204, G1205). Choosing a timeout before choosing a process is choosing
 *    the wrong thing first.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §4  WHAT IT RECORDS, AND WHAT IT DELIBERATELY DOES NOT — G1526
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Invariant 10: *"An act with no authorisation is unrecordable."* `authorize()`
 * mints an `AuthorizationGrant` and nothing else does.
 *
 * **This executor mints none, and writes nothing to any of invariant 10's three
 * streams.** That is stated rather than left to be discovered, because a reader
 * who assumed otherwise would be looking for an audit trail that does not
 * exist. The reasons, in order:
 *
 *   · **The worker is not a request path and has no principal.** There is no
 *     session, no subject, no capability and no `ResourceRef` — `decide()` is
 *     never reached, and `AuthorizationGrant extends TenantScoped` wants a
 *     grant minted against an ACT somebody performed. The act here was
 *     performed by the operator who pressed Run, and **that act already has its
 *     record**: `admitRun` mints one, in its own transaction, at admission.
 *   · **`AUTHORIZATION_MAY_BE_ABSENT` names exactly one actor kind that may
 *     leave it null — `system`** — so a `system`-actor `AuditEvent` for the
 *     execution is REPRESENTABLE. It is not written, because `0014`'s three
 *     streams have no caller on any path outside `tests/` and giving one its
 *     first production writer is a slice with its own argument, not a line
 *     here.
 *
 * ⚠️ **SO A RUN'S EXECUTION IS RECORDED BY `tenant.run_engine_account` AND BY
 *    NOTHING ELSE.** That row says what the engine produced or why it refused;
 *    it is not an audit trail, and no document may describe it as one.
 */

import { withTenantScope, type ScopedClient, type TenantPool } from '../../db/tenant-scope.ts'
import type { RunId, TenantId } from '../../model/kernel.ts'
import type { RunStatus } from '../../model/domain.ts'
import type { SetReconciliationRefusal } from '../../model/reconciliation.ts'
import { terminalRunStatus } from '../../model/reconciliation.ts'
import { threadedEngine, type EngineRunner } from './run-engine-thread.ts'
import type { RunAdmittedMessage } from './run-queue.ts'
import {
  completeSetReconciliationInput,
  readSetReconciliationDefinition,
} from './definition-store.ts'
import {
  assembleRunDocuments,
  type AssemblyDefect,
  type DocumentAssemblyRefusal,
} from './document-assembly.ts'
import { persistRunEngineAccount, persistRunRefusal } from './run-account-store.ts'
import {
  persistRaisedExceptions,
  projectRunExceptions,
  readExceptionDeclarations,
} from './exception-raise.ts'

/**
 * G3741–G3750 — what happened to the exceptions a produced run raised.
 *
 * 🛑 `not_persisted` IS A STATED ANSWER AND NOT A FAILURE, AND THE ACCOUNT IS
 *    WRITTEN EITHER WAY. Two reasons, each NAMED:
 *
 *   · `privilege_absent` — this connection may not `INSERT` into
 *     `tenant.exception`. Only `reconcile_engine` may (`db/migrations/0500` §1);
 *     the request path's role may not, and that refusal is the point. The
 *     executor ASKS (`has_table_privilege`) rather than letting the INSERT fail,
 *     because a failed statement aborts the transaction and would take the
 *     run's account down with a finding the account does not depend on.
 *   · `domain_not_declared` — the definition declares no domain, and
 *     `tenant.exception.domain` is `NOT NULL`. Inventing one is refused.
 *
 * `withheld` counts residue entries whose (side, cause) has no declared rule —
 * they raise nothing and stay readable as residue (`exception-raise.ts` §1).
 */
export type ExceptionsOutcome =
  | { readonly kind: 'raised'; readonly raised: number; readonly withheld: number }
  | {
      readonly kind: 'not_persisted'
      readonly reason: 'privilege_absent' | 'domain_not_declared'
      readonly wouldRaise: number
      readonly withheld: number
    }

/**
 * What one execution did. **Every arm is something an operator or an incident
 * can act on**, which is why `run_not_visible` and `no_definition` are separate
 * from each other and from a refusal.
 */
export type RunExecution =
  /** The three facts `run-worker.ts` keeps indistinguishable, unchanged. */
  | { readonly kind: 'run_not_visible'; readonly runId: RunId }
  /**
   * An account row already exists for this run. **Not an error** — see §3: it is
   * the ordinary answer to a redelivered message, and the arm that makes a
   * duplicate delivery cheap instead of merely harmless.
   */
  | { readonly kind: 'already_accounted'; readonly runId: RunId }
  /**
   * G4133 — the run row already carries a TERMINAL status and no account row
   * says so (a document refusal or an unreadable definition settled it, and
   * neither writes an account). A redelivery; nothing is executed and the
   * status is never moved back.
   */
  | { readonly kind: 'already_settled'; readonly runId: RunId; readonly status: string }
  /** The definition has no engine spec. `0160`'s `no_definition`, carried. */
  | { readonly kind: 'no_definition'; readonly runId: RunId }
  /** A stored row the model cannot name — the definition's or a document's. */
  | {
      readonly kind: 'unreadable'
      readonly runId: RunId
      readonly table: string
      readonly column: string
    }
  /** E4 refused. The run is NOT accounted; see the note on the arm below. */
  | {
      readonly kind: 'documents_refused'
      readonly runId: RunId
      readonly refusal: DocumentAssemblyRefusal
      readonly defect: AssemblyDefect | null
    }
  /** The ENGINE refused, and `tenant.run_refusal` now says why. */
  | {
      readonly kind: 'engine_refused'
      readonly runId: RunId
      readonly refusal: SetReconciliationRefusal
      readonly elapsedMs: number
    }
  | {
      readonly kind: 'produced'
      readonly runId: RunId
      readonly terminalStatus: string
      readonly elapsedMs: number
      /** G3741. The exceptions this run raised, or why none were persisted. */
      readonly exceptions: ExceptionsOutcome
      /** §2. The whole scope, engine call included. A FIXTURE figure in tests. */
      readonly scopeMs: number
    }

/* ═══════════════════════════════════════════════════════════════════════════
 * §6  THE DEADLINE — G4365, 5 Oct 2026, the owner's amendment of G211:
 *     *"Duration is bounded below the visibility timeout. Every admitted run
 *     reaches a terminal status or an alarm."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `RUN_QUEUE_VISIBILITY_SECONDS` is 1800 (G1834). A run still executing when
 * it expires is delivered AGAIN, concurrently — G1525's wasted work, and after
 * five of those a run that never finished lands on the dead-letter queue. So
 * an execution is given LESS time than the message is hidden for, and the
 * margin is spent on the things that happen after the deadline: the `failed`
 * write (`RUN_FAILED_WRITE_SECONDS`), the hard watchdog's grace
 * (`RUN_HARD_KILL_GRACE_SECONDS`, `run-worker-main.ts`), and the receive's own
 * clock skew. `tests/infra/run-deadline.test.mjs` asserts the sum stays below
 * the visibility timeout, against `infra/lib/config.ts`'s own constant.
 *
 * ⚠️ 1500 IS A POLICY CHOICE AND NOT A MEASUREMENT — G1834's discipline, kept.
 * No real corpus has ever been timed; `tools/run-measure.mjs` (G1524's harness)
 * gives a synthetic figure, and that figure is what the next person to move
 * this number should read.
 *
 * TWO MECHANISMS, BECAUSE THERE ARE TWO KINDS OF TIME:
 *   · SQL — `SET LOCAL statement_timeout` to what is LEFT of the deadline, in
 *     every scope this module opens. A statement cancelled by it is SQLSTATE
 *     `57014`, which `isRunDeadlineExceeded()` reads as the deadline.
 *   · the engine — synchronous, so it runs on a thread
 *     (`run-engine-thread.ts`) and the race below TERMINATES it.
 */

/** The whole execution's budget, from receipt. Below the visibility timeout. */
export const RUN_MAX_EXECUTION_SECONDS = 1500

/** What the `failed` write may take once the deadline has fired. */
export const RUN_FAILED_WRITE_SECONDS = 30

/**
 * THE HARD WATCHDOG — G4367, 5 Oct 2026.
 *
 * (Armed in `run-worker-main.ts`.) `executeRun()` bounds its SQL with `statement_timeout` and its engine with a
 * terminable thread, and `processReceivedRun()` then writes `failed`. This is
 * the backstop for everything those do not reach — a hung `pg` socket, a
 * stuck DNS lookup, a bug: once the deadline AND the `failed` write's budget
 * AND this grace have all passed, the process EXITS, whatever it is doing. The
 * message is then left on the queue, which is the *"or an alarm"* half.
 *
 * ⚠️ IT IS AN UNREF'D TIMER, SO IT NEVER KEEPS AN IDLE PROCESS ALIVE, and it is
 * armed at RECEIPT — the long-poll wait before a message arrives is not part
 * of the visibility clock and is not part of this one.
 * `tests/infra/run-deadline.test.mjs` asserts deadline + write + grace stays
 * below `RUN_QUEUE_VISIBILITY_SECONDS`.
 */
export const RUN_HARD_KILL_GRACE_SECONDS = 60

/** The marker an expired deadline throws with. */
const DEADLINE_MARKER = 'run_deadline_exceeded'

export class RunDeadlineExceeded extends Error {
  readonly code: string = DEADLINE_MARKER
  constructor(runId: string, phase: string) {
    super(`run ${runId}: the execution deadline expired during ${phase}`)
  }
}

/**
 * Whether `err` is the deadline — ours, or PostgreSQL's `statement_timeout`
 * (`57014`, `query_canceled`), which only ever fires here because this module
 * set it to the deadline's remainder.
 */
export function isRunDeadlineExceeded(err: unknown): boolean {
  if (err instanceof RunDeadlineExceeded) return true
  const code = (err as { code?: unknown } | null)?.code
  return code === DEADLINE_MARKER || code === '57014'
}

function remainingMs(deadline: number): number {
  return deadline - Date.now()
}

/**
 * `SET LOCAL statement_timeout` to the deadline's remainder. `set_config`
 * because `SET` takes no bind parameters (`db/tenant-scope.ts`'s reason);
 * `true` makes it LOCAL, so the pooled connection goes back carrying nothing.
 */
async function bindStatementTimeout(
  tx: ScopedClient,
  runId: string,
  deadline: number,
  phase: string,
): Promise<void> {
  const left = remainingMs(deadline)
  if (left <= 0) throw new RunDeadlineExceeded(runId, phase)
  await tx.query("SELECT set_config('statement_timeout', $1, true)", [String(Math.ceil(left))])
}

/** Race `work` against the deadline; on expiry ABORT it and throw. */
async function withinDeadline<T>(
  runId: string,
  deadline: number,
  phase: string,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const left = remainingMs(deadline)
  if (left <= 0) throw new RunDeadlineExceeded(runId, phase)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new RunDeadlineExceeded(runId, phase)
      controller.abort(err)
      reject(err)
    }, left)
  })
  try {
    return await Promise.race([work(controller.signal), expiry])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The inputs a run's account is computed from, as one comparable value —
 * G4369. BY RULING it is the definition's VERSION and the DOCUMENT SET (the
 * `(slot, source document)` bindings `readSlotFill()` reads for this
 * definition and period). One statement, so the read and the write scopes
 * compute it the same way.
 *
 * ⚠️ `md5` IS CHANGE DETECTION, NOT A SECURITY CONTROL: both values are read by
 *    this process inside the tenant's own scope; nobody chooses them adversarially
 *    against the comparison.
 * ⚠️ THE DOCUMENT SET IS IDS, NOT PAYLOADS: `tenant.document_payload` is
 *    `SELECT, INSERT` to the app role (`0012`) — a payload cannot change under
 *    an id on any request path.
 */
export interface InputFingerprint {
  readonly definitionVersion: number | null
  readonly documentSet: string
}

export async function readInputFingerprint(
  tx: ScopedClient,
  definitionId: string,
  periodId: string | null,
): Promise<InputFingerprint> {
  const rows = (
    await tx.query(
      `SELECT (SELECT d.version FROM tenant.reconciliation_definition d WHERE d.id = $1) AS version,
              md5(coalesce(string_agg(b.slot || E'\t' || b.source_document_id, E'\n'
                                      ORDER BY b.slot, b.source_document_id), '')) AS document_set
         FROM tenant.document_slot_binding b
        WHERE b.definition_id = $1 AND b.period_id IS NOT DISTINCT FROM $2`,
      [definitionId, periodId],
    )
  ).rows as unknown as { version: number | null; document_set: string }[]
  const row = rows[0]
  return { definitionVersion: row?.version ?? null, documentSet: row?.document_set ?? '' }
}

export function sameInputs(a: InputFingerprint, b: InputFingerprint): boolean {
  return a.definitionVersion === b.definitionVersion && a.documentSet === b.documentSet
}

/** G4369 — the inputs changed between the read and the write. */
export class RunInputsChanged extends Error {
  readonly code: string = 'run_inputs_changed'
  constructor(runId: string) {
    super(
      `run ${runId}: the definition version or the document set changed between the read ` +
        'and the write — the account is not written over inputs it was not computed from',
    )
  }
}

export function isRunInputsChanged(err: unknown): boolean {
  if (err instanceof RunInputsChanged) return true
  return (err as { code?: unknown } | null)?.code === 'run_inputs_changed'
}

export interface ExecuteRunOptions {
  /** Epoch ms. Defaults to `RUN_MAX_EXECUTION_SECONDS` from now. */
  readonly deadline?: number
  /** Defaults to `threadedEngine`. Tests may pass a slower or faster one. */
  readonly engine?: EngineRunner
  /**
   * G4368 — G1524's measurement, OBSERVED rather than inferred. Called once per
   * phase that ran, with its wall time. A run refused before the engine
   * reports `read` alone. Nothing in `server/` passes one; `tools/run-measure.mjs`
   * does, and it changes no behaviour.
   */
  readonly observe?: (phase: RunPhase, ms: number) => void
  /**
   * G4368 — how long a pooled connection was HELD, once per scope, from
   * checkout to release (G101: under transaction-mode pooling a connection is
   * held for the life of a transaction). The pooling half of G1524.
   */
  readonly observeConnection?: (heldMs: number) => void
}

/** The phases `observe` reports. */
export type RunPhase = 'read' | 'engine' | 'write'

/**
 * Why a run was settled `failed` by the WORKER rather than by the engine. The
 * owner's ruling: *"REUSE `failed` (no contract change); record the reason
 * separately."* — `run.execution_failure_cause`, `db/migrations/0620`.
 *
 * ⚠️ CLOSED, AND NO `CHECK` MIRRORS IT (`0007`/`0069`'s polarity).
 */
export const RUN_EXECUTION_FAILURE_CAUSES = [
  'deadline_exceeded',
  'execution_error',
  /** G4369 — the last delivery still found the inputs moving under it. */
  'inputs_changed',
] as const
export type RunExecutionFailureCause = (typeof RUN_EXECUTION_FAILURE_CAUSES)[number]

/**
 * Settle a run `failed` because its EXECUTION did not finish — G4366.
 *
 * 🛑 ONLY FROM `running`, AND ONLY WHEN NO ACCOUNT ROW EXISTS. A run that
 * reads `queued` never started (the start transaction itself failed), so its
 * message is left for the queue; a run with an account, or already terminal,
 * was settled by somebody else and is not this delivery's to overwrite. Returns
 * whether THIS call moved the row.
 *
 * Its own short scope, with its own `statement_timeout`: it runs AFTER the
 * execution's transaction rolled back, and it must not inherit the deadline it
 * is recording.
 */
export async function settleRunAsFailed(
  pool: TenantPool,
  message: RunAdmittedMessage,
  cause: RunExecutionFailureCause,
): Promise<boolean> {
  return withTenantScope(pool, message.tenantId, async (tx) => {
    await tx.query("SELECT set_config('statement_timeout', $1, true)", [
      String(RUN_FAILED_WRITE_SECONDS * 1000),
    ])
    return recordRunOutcome(tx, message.runId, { to: 'execution_failed', cause })
  })
}

/**
 * G4001 — the ONE writer of the run row's outcome, for both arms the engine
 * answers on (G4031's produced arm, G4033's refused arm).
 *
 * ⚠️ NO TENANT PREDICATE — `run_rls` is the narrowing, as for the `SELECT` at
 *    the top of `executeRun()`. The run was visible there, inside this same
 *    transaction, so anything but EXACTLY ONE row is a defect and THROWS — which
 *    rolls the account and the exceptions back with it, rather than committing
 *    an account for a run row the update silently missed (a bare `UPDATE`
 *    touching zero rows reports success).
 *
 * ⚠️ THE PRIVILEGE IS NOT NEW (G4002): `0002` grants `reconcile_app` `UPDATE ON
 *    run`, and `reconcile_engine` holds it by MEMBERSHIP of `reconcile_app`
 *    (`db/provision.ts`). No migration lands with this writer because no fence
 *    moved; `tests/db/engine-raises-exceptions.test.ts` §7c pins both roles.
 *
 * ✅ G4131–G4134, 4 Oct 2026 (U-21, U-22) — IT IS STILL THE ONE WRITER AND IT
 *    NOW WRITES EVERY TRANSITION THE RUN ROW TAKES: `queued → running` in its
 *    own short transaction before the execution scope opens (otherwise the
 *    word is invisible until it is already terminal), `running → queued` when
 *    nothing executed, and the terminal status on EVERY arm that settles a
 *    run — the engine's two and, since G4131, the document refusal and the
 *    unreadable definition too. `tests/db/run-executor.test.ts` §11.
 */
async function recordRunOutcome(
  tx: ScopedClient,
  runId: string,
  transition: RunRowTransition,
): Promise<boolean> {
  if (transition.to === 'execution_failed') {
    /* G4366 — `running → failed`, the WORKER's settle and never the engine's.
     * Guarded on BOTH `running` and the absence of an account row, so it can
     * never overwrite a terminal status nor contradict a stored account. Zero
     * rows is an ANSWER here (`settleRunAsFailed()` reports it), not a fault. */
    const moved = await tx.query(
      `UPDATE run SET status = 'failed', finished_at = now(), execution_failure_cause = $2
        WHERE id = $1 AND status = 'running'
          AND NOT EXISTS (SELECT 1 FROM tenant.run_engine_account a WHERE a.run_id = run.id)`,
      [runId, transition.cause],
    )
    return moved.rowCount === 1
  }
  if (transition.to === 'running') {
    /* G4132 — `queued → running`, and ONLY from `queued`. A redelivery of a
     * run another delivery already settled, or already accounted (a run
     * accounted before G4031 can still read `queued`), moves nothing. Zero
     * rows is an ordinary answer here: another tenant's run, a run already
     * running, a run already terminal. */
    await tx.query(
      `UPDATE run SET status = 'running'
        WHERE id = $1 AND status = 'queued'
          AND NOT EXISTS (SELECT 1 FROM tenant.run_engine_account a WHERE a.run_id = run.id)`,
      [runId],
    )
    return true
  }
  if (transition.to === 'queued') {
    /* G4134 — back to `queued` when NOTHING executed (`no_definition`), and
     * only from `running`: §10b's recovery path needs `queued`. */
    await tx.query(`UPDATE run SET status = 'queued' WHERE id = $1 AND status = 'running'`, [runId])
    return true
  }
  /* 🛑 G4133 — A TERMINAL STATUS IS WRITTEN ONLY OVER A NON-TERMINAL ONE. Under
   * G1525 a second delivery can reach this line for the same run; it blocks on
   * the first's row lock, re-evaluates under READ COMMITTED, finds a terminal
   * status, touches ZERO rows and throws — rolling its own transaction back
   * rather than re-stamping a settled run. G4001's exactly-one guard is
   * unchanged and now also covers that race. */
  const updated = await tx.query(
    `UPDATE run SET status = $2, finished_at = now(), exceptions_raised = $3
      WHERE id = $1 AND status IN ('queued', 'running')`,
    [runId, transition.to, transition.exceptionsRaised],
  )
  if (updated.rowCount !== 1) {
    throw new Error(
      `run ${runId}: visible at the start of this transaction, and UPDATE run touched ` +
        `${String(updated.rowCount)} rows — the run row is not this execution's to settle ` +
        '(another delivery settled it first, or it is gone); refusing to commit',
    )
  }
  return true
}

/**
 * G4131–G4134 — every change this executor makes to the run row, as ONE type,
 * so `recordRunOutcome()` stays the ONE writer (G4001) of all of them.
 */
type RunRowTransition =
  | { readonly to: 'running' }
  | { readonly to: 'queued' }
  /** G4366 — the worker's settle of a run whose EXECUTION did not finish. */
  | { readonly to: 'execution_failed'; readonly cause: RunExecutionFailureCause }
  | {
      readonly to: Exclude<RunStatus, 'queued' | 'running'>
      readonly exceptionsRaised: number | null
    }

/** The statuses a run may still be executed from. Anything else is settled. */
function isUnsettled(status: string): boolean {
  return status === 'queued' || status === 'running'
}

/**
 * Execute one admitted run, in one tenant scope.
 *
 * 🛑 **THE TENANT COMES FROM THE MESSAGE AND THE SCOPE IS OPENED WITH IT, WHICH
 *    IS R-B's WHOLE ARGUMENT.** The message names `(tenantId, runId)`; this
 *    opens exactly that tenant's scope and every read below is narrowed by RLS
 *    rather than by a `WHERE` a reader happened to write. A message naming
 *    tenant A and tenant B's run reaches an empty result set —
 *    `tests/db/run-worker-scope.test.ts` §3, unchanged by this slice.
 */
export async function executeRun(
  pool: TenantPool,
  message: RunAdmittedMessage,
  options: ExecuteRunOptions = {},
): Promise<RunExecution> {
  const runId = message.runId
  const startedAt = Date.now()
  const deadline = options.deadline ?? startedAt + RUN_MAX_EXECUTION_SECONDS * 1000
  const engine = options.engine ?? threadedEngine
  const observe = options.observe ?? ((): void => undefined)
  const observeConnection = options.observeConnection ?? ((): void => undefined)

  /* ---- G4132 (U-22) — `queued → running`, COMMITTED BEFORE THE WORK ----
   *
   * 🛑 ITS OWN TRANSACTION, AND THAT IS THE WHOLE POINT. The execution below is
   *    ONE transaction (§1), so a `running` written inside it would be visible
   *    to nobody until it had already been replaced by a terminal status. The
   *    same tenant scope, the same writer, a separate commit.
   * ⚠️ IF THE EXECUTION THEN THROWS, THE RUN READS `running` UNTIL A
   *    REDELIVERY SETTLES IT — the worker does not delete a message whose
   *    execution threw, so the queue redelivers it, and the terminal write
   *    accepts `running` as its starting point. A run whose message reaches the
   *    dead-letter queue stays `running`; §3a's triage is the place to look. */
  const startOpenedAt = Date.now()
  await withTenantScope(pool, message.tenantId, async (tx) => {
    await bindStatementTimeout(tx, runId, deadline, 'the start transition')
    await recordRunOutcome(tx, runId, { to: 'running' })
  })
  observeConnection(Date.now() - startOpenedAt)

  const scopeOpenedAt = Date.now()
  let readStartedAt = scopeOpenedAt
  const prepared = await withTenantScope(pool, message.tenantId, async (tx) => {
    readStartedAt = Date.now()
    /* G4365 — every statement below is cancelled at the deadline. */
    await bindStatementTimeout(tx, runId, deadline, 'the read scope')

    /* ---- the run itself. No tenant predicate; `run_rls` is the narrowing. ---- */
    const runRows = (
      await tx.query(
        'SELECT id, definition_id, definition_version, period_id, status FROM run WHERE id = $1',
        [runId],
      )
    ).rows as unknown as {
      id: string
      definition_id: string
      definition_version: number
      period_id: string | null
      status: string
    }[]

    const run = runRows[0]
    if (run === undefined) return { kind: 'run_not_visible', runId } as const

    /* ---- §3's first arm: has this run already been accounted for? ----
     *
     * ⚠️ IT IS A READ AND THE PRIMARY KEY IS THE GUARANTEE, NOT THIS. A read
     * cannot see an in-flight insert, so this arm is an OPTIMISATION for the
     * committed case; correctness under concurrency is `0007`'s primary key,
     * and §6 of the suite witnesses both paths. Naming it as the guarantee
     * would be a check-then-act nobody could see was one. */
    const existing = (
      await tx.query('SELECT 1 FROM tenant.run_engine_account WHERE run_id = $1', [runId])
    ).rows
    if (existing.length > 0) return { kind: 'already_accounted', runId } as const

    /* ---- G4133 — a run already SETTLED is never executed again ----
     * The arms that settle a run without an account row (document refusal,
     * unreadable definition) are invisible to the read above, so a redelivery
     * of one would otherwise re-execute and then fail the terminal write's
     * guard on every delivery until the dead-letter queue. A status this
     * reader does not know is treated as settled: it is not `queued` or
     * `running`, and moving it is the one thing this executor must not do. */
    if (!isUnsettled(run.status)) {
      return { kind: 'already_settled', runId, status: run.status } as const
    }

    /* ---- the definition's content ---- */
    /* G4369 — the fingerprint is read BEFORE the inputs, so a change landing
     * between this statement and the assembly makes the write refuse (safe),
     * rather than one landing after the assembly going unnoticed. */
    const fingerprint = await readInputFingerprint(tx, run.definition_id, run.period_id)

    const definition = await readSetReconciliationDefinition(tx, run.definition_id)
    if (definition.kind === 'no_definition') {
      /* G4134 — NOTHING executed, so the run goes back to `queued` rather than
       * sitting `running` over nothing. §10b of the suite argues why it is not
       * settled: a re-press of Run deduplicates onto this run and republishes,
       * which is the recovery once a spec exists. Whether a run naming a
       * definition with no spec should instead be settled is G4138. */
      await recordRunOutcome(tx, runId, { to: 'queued' })
      return { kind: 'no_definition', runId } as const
    }
    if (definition.kind === 'unreadable') {
      /* G4131 (U-21) — settled as `refused`: no ledger was produced and the
       * worker deletes the message on this arm, so nothing would ever move a
       * `queued` again. */
      await recordRunOutcome(tx, runId, { to: 'refused', exceptionsRaised: null })
      return {
        kind: 'unreadable',
        runId,
        table: definition.defect.table,
        column: definition.defect.column,
      } as const
    }

    /* ---- what this definition's residue raises (G3745) ----
     * Read BEFORE the engine, so an unreadable declaration refuses the run the
     * way an unreadable spec does: nothing executed, nothing written. */
    const declarations = await readExceptionDeclarations(tx, run.definition_id)
    if (declarations.kind === 'unreadable') {
      /* G4131 — settled, as the unreadable spec above is. */
      await recordRunOutcome(tx, runId, { to: 'refused', exceptionsRaised: null })
      return {
        kind: 'unreadable',
        runId,
        table: declarations.table,
        column: declarations.column,
      } as const
    }

    /* ---- the operands (E4) ---- */
    const documents = await assembleRunDocuments(tx, {
      tenantId: message.tenantId,
      definitionId: run.definition_id as never,
      periodId: run.period_id,
      left: definition.definition.left,
      right: definition.definition.right,
    })
    if (!documents.ok) {
      /* 🛑 NOT ACCOUNTED, AND THAT IS A DELIBERATE ASYMMETRY WITH THE ENGINE'S
       * REFUSAL ONE ARM DOWN. `RunRefusal` is the ENGINE's closed union, and
       * `line_grain_not_representable` is not a member of it — writing one of
       * these into `tenant.run_refusal` would mean inventing an arm the wire
       * cannot publish, or mapping it onto an arm that means something else.
       * **So a document refusal leaves NO account row and `getRunAccount`
       * answers 404**, which is the collision E6 exists to end, surviving in
       * this one case. It is named here rather than hidden: closing it needs a
       * contract change, which is a ruling and not a line (G4137).
       *
       * ✅ G4131 (U-21) — BUT THE RUN ROW IS SETTLED: `refused`, finished, no
       * count. G4033 ruled the word for the ENGINE's refusal and left this arm
       * `queued`; a document refusal is the same fact one step earlier — no
       * ledger was produced — and the worker deletes the message, so a
       * `queued` here would claim for ever that nothing had happened. */
      await recordRunOutcome(tx, runId, { to: 'refused', exceptionsRaised: null })
      return {
        kind: 'documents_refused',
        runId,
        refusal: documents.refusal,
        defect: documents.defect,
      } as const
    }

    /* ---- THE ENGINE ---- */
    const input = completeSetReconciliationInput(definition.definition, {
      runId: runId as RunId,
      /* Invariant 1 — the SCOPE's tenant, never a column's. */
      tenantId: message.tenantId as TenantId,
      leftDocuments: documents.left,
      rightDocuments: documents.right,
    })

    return {
      kind: 'prepared',
      run,
      definition: definition.definition,
      declarations,
      documents,
      input,
      fingerprint,
    } as const
  })
  observeConnection(Date.now() - scopeOpenedAt)
  observe('read', Date.now() - readStartedAt)
  if (prepared.kind !== 'prepared') return prepared
  const { run, definition, declarations, documents, input, fingerprint } = prepared

  /* ---- THE ENGINE — G4363: NO CONNECTION IS HELD WHILE IT RUNS ---- */
  const engineStartedAt = Date.now()
  /* G4365 — on a thread, raced against the deadline; expiry TERMINATES it. */
  const result = await withinDeadline(runId, deadline, 'the engine call', (signal) =>
    engine(input, signal),
  )
  const elapsedMs = Date.now() - engineStartedAt
  observe('engine', elapsedMs)

  /* ---- THE WRITE — G4363/G4369: lock the run, re-check the inputs, write ---- */
  const writeOpenedAt = Date.now()
  const outcome = await withTenantScope(pool, message.tenantId, async (tx) => {
    await bindStatementTimeout(tx, runId, deadline, 'the writes')

    /* The run row is LOCKED, so two deliveries that both reach this scope
     * serialise here; the second then finds the account and answers
     * `already_accounted` instead of failing on the primary key (G1525). */
    const locked = (
      await tx.query('SELECT status FROM run WHERE id = $1 FOR UPDATE', [runId])
    ).rows as unknown as { status: string }[]
    const current = locked[0]
    if (current === undefined) return { kind: 'run_not_visible', runId } as const
    const accounted = (
      await tx.query('SELECT 1 FROM tenant.run_engine_account WHERE run_id = $1', [runId])
    ).rows
    if (accounted.length > 0) return { kind: 'already_accounted', runId } as const
    if (!isUnsettled(current.status)) {
      return { kind: 'already_settled', runId, status: current.status } as const
    }

    const now = await readInputFingerprint(tx, run.definition_id, run.period_id)
    if (!sameInputs(fingerprint, now)) throw new RunInputsChanged(runId)

    if (!result.ok) {
      await persistRunRefusal(tx, { runId, refusal: result.refusal })
      /* G4033, THE OWNER'S — a refused run carries `refused`, with
       * `finished_at` set and `exceptions_raised` NULL: it raised nothing into
       * the register and has no count to record. WHY is `tenant.run_refusal`'s,
       * published by `getRunAccount`. */
      await recordRunOutcome(tx, runId, { to: 'refused', exceptionsRaised: null })
      return { kind: 'engine_refused', runId, refusal: result.refusal, elapsedMs } as const
    }

    /* 🛑 THE TERMINAL STATUS IS THE ENGINE'S AND IS NEVER RECOMPUTED AT READ
     * TIME — `0007`'s own argument for storing it: *"recomputing it at READ
     * time would mean a row could report a status its own stored channels do
     * not produce, with no way to tell a drifted algorithm from a drifted
     * row."* */
    const status = terminalRunStatus(result.result)
    await persistRunEngineAccount(tx, {
      runId,
      terminalStatus: status,
      result: result.result,
    })

    /* ---- G3741 — the exceptions the run raised, in the SAME transaction ----
     *
     * 🛑 AFTER THE ACCOUNT, AND THE ORDER IS LOAD-BEARING: `0500` §2's
     *    restrictive policy admits an exception only for a run whose account
     *    is already visible, so an exception for a run nobody reconciled is
     *    unrepresentable. A rollback takes both; a commit keeps both. */
    const projection = projectRunExceptions({
      runId: runId as RunId,
      result: result.result,
      definition,
      left: documents.left,
      right: documents.right,
      slotOf: documents.slotOf,
      rules: declarations.rules,
    })
    const privileged = (
      (
        await tx.query(
          "SELECT has_table_privilege('tenant.exception', 'INSERT') AS ok",
        )
      ).rows as unknown as { ok: boolean }[]
    )[0]?.ok === true

    let exceptions: ExceptionsOutcome
    if (!privileged) {
      exceptions = {
        kind: 'not_persisted',
        reason: 'privilege_absent',
        wouldRaise: projection.raised.length,
        withheld: projection.withheld,
      }
    } else if (declarations.domain === null) {
      exceptions = {
        kind: 'not_persisted',
        reason: 'domain_not_declared',
        wouldRaise: projection.raised.length,
        withheld: projection.withheld,
      }
    } else {
      await persistRaisedExceptions(
        tx,
        {
          runId: runId as RunId,
          definitionId: run.definition_id,
          definitionVersion: run.definition_version,
          domain: declarations.domain,
        },
        projection.raised,
      )
      exceptions = {
        kind: 'raised',
        raised: projection.raised.length,
        withheld: projection.withheld,
      }
    }

    /* ---- G4031 — THE RUN ROW RECORDS WHAT THIS EXECUTION PRODUCED ----
     *
     * G3750 named `public.run.status` and `exceptions_raised` as never written
     * by the executor: a reconciled run stayed `queued` on `listRuns` while its
     * account said `completed`. Both now have a producer HERE, in the SAME
     * transaction as the account and the exceptions — so a rollback (the loser
     * of a concurrent delivery, G1525) takes the update with it, and a
     * redelivery never reaches this line (`already_accounted`).
     *
     *   · `status`            — `terminalRunStatus()`, the model's own join,
     *                           the value the account already stores. Not
     *                           recomputed, not a second rule (§5.3).
     *   · `finished_at`       — `now()`, the transaction's clock: the engine
     *                           has none and this is the moment it was recorded.
     *   · `exceptions_raised` — the count that REACHED THE REGISTER, and NULL
     *                           when none could (`not_persisted`). A `0` there
     *                           would say the run raised nothing while it would
     *                           have raised `wouldRaise`; NULL is "not recorded",
     *                           which is the wire's own reading of the field.
     *
     * ⚠️ AN ENGINE REFUSAL DOES NOT MOVE THE RUN'S STATUS, DELIBERATELY. No
     *    model function maps a `SetReconciliationRefusal` to a `RunStatus` —
     *    `terminalRunStatus()` takes a RESULT — and `failed` is defined as
     *    *"do-not-persist"* for a SOUNDNESS failure, which a refusal is not. So
     *    a refused run stays `queued` and `getRunAccount` publishes the reason;
     *    which status it should carry is G4033, put to the owner.
     *    ✅ G4033 IS RULED (4 Oct 2026) AND THE PARAGRAPH ABOVE IS KEPT AS ITS
     *    PREMISE: `refused` is a sixth `RunStatus` and the refusal arm writes it
     *    through `recordRunOutcome()`, as this arm now does (G4001's guard). */
    await recordRunOutcome(tx, runId, {
      to: status,
      exceptionsRaised: exceptions.kind === 'raised' ? exceptions.raised : null,
    })

    return { kind: 'produced', runId, terminalStatus: status, elapsedMs, exceptions } as const
  })

  const writeClosedAt = Date.now()
  observeConnection(writeClosedAt - writeOpenedAt)
  observe('write', writeClosedAt - writeOpenedAt)
  const scopeMs = Date.now() - startedAt
  if (outcome.kind === 'produced') return { ...outcome, scopeMs }
  return outcome
}

/**
 * The line a person reads when the worker runs.
 *
 * ⚠️ IT SAYS WHAT WAS **NOT** DONE WHEREVER THAT IS THE TRUTH, which is
 * `describeClaim()`'s rule one file over: a worker that logged only its happy
 * path would read, in an incident, as a worker that had always taken one.
 */
export function describeExecution(execution: RunExecution): string {
  switch (execution.kind) {
    case 'run_not_visible':
      return (
        `run-executor: run \`${execution.runId}\` is NOT VISIBLE in this scope — another ` +
        'tenant`s run, a run id that never existed, or a run whose admitting transaction ' +
        'rolled back. They are indistinguishable by construction. Nothing was executed.'
      )
    case 'already_accounted':
      return (
        `run-executor: run \`${execution.runId}\` ALREADY HAS AN ENGINE ACCOUNT. Nothing ` +
        'was executed and nothing was written. This is the ordinary answer to a ' +
        'redelivered message.'
      )
    case 'already_settled':
      return (
        `run-executor: run \`${execution.runId}\` is ALREADY SETTLED — its row reads ` +
        `\`${execution.status}\`. Nothing was executed and the status was not moved. This is ` +
        'the ordinary answer to a redelivered message for a run settled without an account.'
      )
    case 'no_definition':
      return (
        `run-executor: run \`${execution.runId}\` names a definition with NO ENGINE SPEC. ` +
        'That is a stated answer and not an empty one — a definition with no spec is not ' +
        'a definition with default knobs. Nothing was executed; the run is `queued` again.'
      )
    case 'unreadable':
      return (
        `run-executor: run \`${execution.runId}\` could not be executed — a stored row ` +
        `carried something the model cannot name, at \`${execution.table}.${execution.column}\`. ` +
        'Nothing was executed. The run row now reads `refused`.'
      )
    case 'documents_refused':
      return (
        `run-executor: run \`${execution.runId}\` could not have its documents assembled — ` +
        `\`${execution.refusal.kind}\`. **NO ENGINE ACCOUNT WAS WRITTEN**, so ` +
        '`getRunAccount` will answer 404 for this run (G4137); the run row reads `refused`.'
      )
    case 'engine_refused':
      return (
        `run-executor: the engine REFUSED run \`${execution.runId}\` — ` +
        `\`${execution.refusal.kind}\`, after ${execution.elapsedMs}ms. A refusal IS an ` +
        'account: `tenant.run_refusal` records it and `getRunAccount` publishes it.'
      )
    case 'produced':
      return (
        `run-executor: run \`${execution.runId}\` RECONCILED — terminal status ` +
        `\`${execution.terminalStatus}\`, engine ${execution.elapsedMs}ms, whole scope ` +
        `${execution.scopeMs}ms. ⚠️ THOSE FIGURES ARE ABOUT THIS DOCUMENT SET AND NOT ` +
        'ABOUT A LARGE ONE — see `run-executor.ts` §2. ' +
        describeExceptions(execution.exceptions)
      )
  }
}

function describeExceptions(e: ExceptionsOutcome): string {
  if (e.kind === 'raised') {
    return (
      `Exceptions: ${e.raised} raised into the register, ${e.withheld} residue ` +
      'entr(ies) WITHHELD for want of a declared rule (still readable as residue).'
    )
  }
  return (
    `Exceptions: NONE PERSISTED — \`${e.reason}\`. ${e.wouldRaise} would have been ` +
    `raised and ${e.withheld} withheld. ` +
    (e.reason === 'privilege_absent'
      ? 'This connection is not `reconcile_engine` (`db/migrations/0500` §1).'
      : 'The definition declares no domain (`0500` §3).')
  )
}

/**
 * THE RUN QUEUE — THE ONE PLACE A `(tenantId, runId)` MESSAGE IS SPELLED,
 * ENCODED, PARSED AND REFUSED. **R-B, 20 Sep 2026, THE OWNER'S RULING.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RULING, VERBATIM, BECAUSE A PARAPHRASED RULING IS A CHANGED ONE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "R-B · A worker claims runs from a REAL QUEUE (SQS), never by scanning.
 *      **The property that decides it:** the admitting handler publishes the
 *      tenant id and the run id; the worker consumes one message and opens
 *      exactly that tenant's scope. **No cross-tenant read exists anywhere in
 *      the design**, so invariant 2 — *"Exactly one cross-tenant read path"* —
 *      is untouched rather than argued about."
 *
 * 🛑 READ THE PROPERTY BEFORE THE CODE, BECAUSE THE CODE IS SMALL AND THE
 *    PROPERTY IS THE WHOLE OF WHY IT IS THIS SHAPE. Every byte that crosses
 *    this seam is a tenant id and a run id that the ADMITTING transaction
 *    already held. Nothing downstream discovers a tenant; it is TOLD one, and
 *    then `run_rls` decides whether the run it was told about is visible in
 *    that tenant's scope. A message naming tenant A and another tenant's run
 *    reaches an empty result set — which is
 *    `tests/db/run-worker-scope.test.ts` §3, and is the reason this design was
 *    taken over a scan.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE REJECTED ALTERNATIVES, PRESERVED — A REJECTED OPTION WRITTEN DOWN IS
 *    THE ONLY THING THAT STOPS THE NEXT READER RE-TAKING IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * (a) **A `BYPASSRLS` WORKER THAT SCANS `public.run`.** Simplest to write, and
 *     REFUSED BY THE OWNER: *"it puts a role that can read every tenant into a
 *     long-running process, and every isolation assertion in `tests/` is
 *     relative to no serving process holding that role."*
 *
 *     ⚠️ AND IT IS NOT A STYLE PREFERENCE — THE SCAN DOES NOT WORK AT ALL
 *     WITHOUT THAT ROLE, WHICH WAS MEASURED BEFORE THIS FILE WAS WRITTEN.
 *     Against a real PostgreSQL carrying two queued runs, as `reconcile_app`
 *     inside a transaction with no `app.tenant_id`:
 *
 *         as the BYPASSRLS migrator     -> 2 queued run(s)
 *         claim scan, no app.tenant_id  -> 0 row(s)
 *         tenant enumeration            -> 0 row(s)
 *
 *     `SELECT … FROM run WHERE status = 'queued' FOR UPDATE SKIP LOCKED`
 *     returns NOTHING, every time, correctly, under G100 — and the worker
 *     cannot list the tenants it would have to iterate either. **The first
 *     line of a scanning executor cannot see the row it is meant to claim.**
 *     `tests/db/run-worker-scope.test.ts` §1 keeps that measurement RUNNABLE
 *     rather than narrating it.
 *
 * (b) **A SWEEP DRIVEN BY THE CONTROL-PLANE TENANCY ROSTER**
 *     (`db/migrations-control/0002_tenancy_roster.sql`). No tenant data
 *     crosses, so invariant 3 survives — and it **couples the engine to the
 *     console topology**, which G835 records as an OPEN OWNER'S RULING: the
 *     data plane holds no control-plane credential and `compose.yaml` puts it
 *     on `data-net` alone. A run engine blocked on where the consoles are
 *     served is a run engine blocked on a question it has no stake in.
 *
 * (c) **A TRANSACTIONAL OUTBOX** — a `tenant.run_publication_outbox` row
 *     written in the admitting transaction and drained by a relay. It is the
 *     textbook answer to the ordering problem §2 below argues, and **it is
 *     (a) wearing different clothes**: the relay has to find rows across every
 *     tenant, so it needs `BYPASSRLS` or a second policy on a tenant-scoped
 *     table, which is invariant 2's *"exactly one cross-tenant read path"*
 *     becoming two. The ordering problem is answered in §2 instead, at the
 *     cost this file names rather than by a mechanism that reopens the one
 *     question the ruling closed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §2 · 🛑 THE PUBLISH HAPPENS **AFTER THE TRANSACTION COMMITS**, AND THE COST
 *      OF THAT IS NAMED HERE RATHER THAN DISCOVERED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * There are exactly two places the publish can go and each loses something:
 *
 *   INSIDE the transaction — the message is sent for a run that MAY ROLL BACK.
 *     SQS has no rollback, so the worker is handed a run id that does not
 *     exist and never will, and `run_rls` cannot tell that case from *another
 *     tenant's run* — both are an empty result set. **A phantom message is
 *     indistinguishable from an attack**, and that is the deciding fact.
 *
 *   AFTER the transaction — the message is LOST if the process dies in the
 *     window between `COMMIT` and the send. The run row exists, carries
 *     `status = 'queued'`, and nothing ever picks it up.
 *
 * **AFTER is taken.** The recovery for the second is a sentence rather than a
 * mechanism, and it is the operation's own idempotency:
 *
 *   🛑 **PRESSING RUN AGAIN RE-PUBLISHES.** The basis is
 *   `(definition, period, slot-fill state)`, so a second press computes the
 *   SAME `idempotency_key`, `ON CONFLICT (tenant_id, idempotency_key) DO
 *   NOTHING` creates NO SECOND RUN, `admitRun` answers `deduplicated` — **and
 *   this seam publishes on that arm too.** The operator's repair for "my run
 *   never started" is the button they already pressed, and it cannot produce a
 *   second run at any price, because the guarantee is a UNIQUE INDEX
 *   (`db/migrations/0069_run_admission.sql` §3) rather than a lookup.
 *
 * ⚠️ **SO A DUPLICATE MESSAGE IS ORDINARY AND MUST STAY HARMLESS.** SQS is
 * at-least-once regardless, so the worker would have to tolerate one anyway —
 * and it does, by construction: `claimAdmittedRun()` CREATES NOTHING. It reads
 * one row in one tenant's scope and reports what it found.
 *
 * 🛑 WHAT IS *NOT* RECOVERED, STATED PLAINLY: a run whose message was lost and
 * whose operator never presses Run again sits `queued` for ever. There is no
 * sweeper and no clock — **the same shape G641 ruled on for membership
 * liveness, and the same answer: no background process.** A sweeper here would
 * be alternative (a) or (c) above arriving through the back door.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §3 · ⚠️ THE MESSAGE CARRIES TWO IDS AND NOTHING ELSE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No definition, no period, no slot fill, no status, no timestamp. Every one
 * of those is a fact the worker can read from the row it is about to open —
 * **and a fact on the wire is a fact that can be STALE or FORGED**, while a
 * fact read inside `withTenantScope()` is one `run_rls` has already vouched
 * for. A message that carried `definitionId` would let whoever can write to
 * the queue choose which definition a run is executed against, which is
 * `db/migrations/0150`'s *"a caller who chooses the operands chooses the
 * answer"* arriving through a different door.
 *
 * ⚠️ AND THE TENANT ID IS ON THE WIRE, WHICH LOOKS LIKE INVARIANT 1 AND IS
 * NOT. Invariant 1 is *"Tenant scope is derived from the session, never read
 * from a REQUEST"* — copy it from `CLAUDE.md`, never from here. This is not a
 * request: there is no session, no principal and no caller. The tenant is
 * carried BECAUSE the alternative is a worker that discovers one, and
 * discovering one is exactly what (a), (b) and (c) above do.
 */

import type { RunId, TenantId } from '../../model/kernel.ts'

/**
 * The only message kind this queue carries.
 *
 * ⚠️ A DISCRIMINANT ON A SINGLE-ARM UNION IS NOT CEREMONY HERE. The queue is a
 * durable buffer that outlives a deploy, so a message written by the previous
 * version of this file is read by the next one; a body with no `kind` is a
 * body whose meaning has to be inferred from its shape, and inference is what
 * `parseRunQueueMessage()` exists to refuse.
 */
export const RUN_QUEUE_MESSAGE_KIND = 'run_admitted' as const

/**
 * How many times SQS delivers one message before the redrive policy carries it
 * to the dead-letter queue — G4366, 5 Oct 2026.
 *
 * 🛑 A MIRROR OF `infra/lib/config.ts`'s `RUN_QUEUE_MAX_RECEIVE_COUNT`, AND
 * THE MIRROR IS PINNED BY A TEST RATHER THAN IMPORTED: `infra/` is its own
 * package and `server/` may not reach into it. `tests/infra/run-deadline.test.mjs`
 * asserts the two are EQUAL, so a change to either is a red gate until the
 * other moves with it.
 *
 * ⚠️ WHY THE WORKER NEEDS IT AT ALL — the owner's amendment of G211, 5 Oct 2026:
 * *"SQS redelivery bounded by RUN_QUEUE_MAX_RECEIVE_COUNT is the only retry
 * authority."* The worker does not retry; it decides, on the delivery the
 * queue says is the LAST (`ApproximateReceiveCount ≥` this), that a run whose
 * execution threw is `failed` rather than left `running` for ever.
 */
export const RUN_QUEUE_MAX_RECEIVE_COUNT = 5

/** `(tenantId, runId)`. Two ids. See §3 for why there is nothing else. */
export interface RunAdmittedMessage {
  readonly kind: typeof RUN_QUEUE_MESSAGE_KIND
  readonly tenantId: TenantId
  readonly runId: RunId
}

/**
 * Why a body on this queue could not be read as a message.
 *
 * 🛑 CLOSED, AND CARRYING THE `kind` AND NOTHING ELSE. Every value one could
 * attach — the malformed id, the unexpected `kind`, the raw body — is a string
 * from a source we have just decided not to believe, and putting it in a
 * refusal is how it reaches a log line, a dashboard or a prompt.
 * `model/run-admission.ts` takes the same position for the same reason.
 */
export const RUN_QUEUE_REFUSALS = [
  'body_not_json',
  'body_not_an_object',
  'kind_unrecognised',
  'tenant_id_absent',
  'run_id_absent',
] as const

export type RunQueueRefusal = (typeof RUN_QUEUE_REFUSALS)[number]

export type RunQueueRead =
  | { readonly ok: true; readonly message: RunAdmittedMessage }
  | { readonly ok: false; readonly refusal: RunQueueRefusal }

/**
 * The body, as bytes.
 *
 * ⚠️ `JSON.stringify` OVER A LITERAL RATHER THAN OVER THE ARGUMENT, so a field
 * somebody adds to `RunAdmittedMessage` has to be added here too instead of
 * riding along unexamined. §3 is the argument for keeping the set at two.
 */
export function encodeRunQueueMessage(message: RunAdmittedMessage): string {
  return JSON.stringify({
    kind: RUN_QUEUE_MESSAGE_KIND,
    tenantId: message.tenantId,
    runId: message.runId,
  })
}

/**
 * The body, read back.
 *
 * 🛑 IT VALIDATES RATHER THAN CASTS, AND THE TWO IDS ARE CHECKED FOR BEING
 * NON-EMPTY STRINGS AND FOR NOTHING ELSE. G97 stores every branded id as
 * `text` with no format the database enforces, so a shape check here would be
 * a second, weaker copy of a rule that does not exist — and an id that is not
 * a tenant's resolves to an empty scope rather than to somebody else's data,
 * which is G100 doing the work a regex would only look like it was doing.
 */
export function parseRunQueueMessage(body: string): RunQueueRead {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { ok: false, refusal: 'body_not_json' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, refusal: 'body_not_an_object' }
  }
  const record = parsed as Record<string, unknown>
  if (record['kind'] !== RUN_QUEUE_MESSAGE_KIND) {
    return { ok: false, refusal: 'kind_unrecognised' }
  }
  const tenantId = record['tenantId']
  if (typeof tenantId !== 'string' || tenantId === '') {
    return { ok: false, refusal: 'tenant_id_absent' }
  }
  const runId = record['runId']
  if (typeof runId !== 'string' || runId === '') {
    return { ok: false, refusal: 'run_id_absent' }
  }
  return {
    ok: true,
    message: {
      kind: RUN_QUEUE_MESSAGE_KIND,
      tenantId: tenantId as TenantId,
      runId: runId as RunId,
    },
  }
}

/**
 * The transport, as a function.
 *
 * 🛑 A FUNCTION AND NOT A CLASS, AND NOT AN `SQSClient`, BECAUSE THIS TYPE IS
 * WHAT `server/data-plane/start.ts` CHOOSES ONCE AT BOOT. The SQS
 * implementation lives in `server/data-plane/sqs-run-queue.ts` and is reached
 * through a DYNAMIC import that only runs when a queue URL is configured —
 * the same fence shape `resolveSessionReader()` uses for
 * `server/dev/test-token.ts`, and for a weaker reason honestly stated: this
 * one is about not constructing a client nobody asked for, not about an
 * accepting code path.
 */
export type RunQueuePublisher = (message: RunAdmittedMessage) => Promise<void>

/**
 * The publisher a plane gets when no queue is configured.
 *
 * 🛑 IT IS LOUD, AND THAT IS THE WHOLE OF IT. A silent no-op here is the shape
 * this repository refuses everywhere else: the run is admitted, the operator
 * sees a 201, and nothing anywhere says that the thing which would have picked
 * it up was never told. The line names both ids and names the repair, because
 * §2's recovery is an operator pressing a button rather than an engineer
 * reading a runbook.
 *
 * ⚠️ IT DOES NOT THROW. The transaction has already committed by the time this
 * runs; throwing would turn a 201 into a 500 for a run that genuinely exists,
 * which is a worse answer than an admitted run nobody has collected.
 */
export function unconfiguredRunQueue(): RunQueuePublisher {
  return async (message) => {
    console.error(
      `data-plane: run \`${message.runId}\` was admitted for tenant \`${message.tenantId}\` ` +
        'and NO RUN QUEUE IS CONFIGURED, so nothing was told about it. The run row exists ' +
        'and carries `status = \'queued\'`. Set `RECONCILE_RUN_QUEUE_URL`; pressing Run ' +
        'again re-publishes, and cannot create a second run — `run_idempotency_key`.',
    )
  }
}

/**
 * Where the queue is, if anywhere.
 *
 * ⚠️ `RECONCILE_RUN_QUEUE_ENDPOINT` IS SEPARATE FROM THE URL AND IS FOR THE
 * LOCAL STACK ALONE. Against AWS the queue URL is the endpoint; against the
 * SQS-compatible server `compose.yaml` stands up, the URL a client is given
 * and the host it must actually connect to differ, because the queue's own URL
 * names the container's hostname on `data-net`. Overriding the endpoint is the
 * documented way to point an SDK at a local implementation, and it is read
 * here so no other module has to know the local stack exists.
 */
export interface RunQueueTarget {
  readonly url: string
  readonly endpoint?: string
  readonly region: string
}

const DEFAULT_REGION = 'us-west-2'

/**
 * The configured target, or `null`.
 *
 * 🛑 READ ONCE, AT BOOT, LIKE EVERY OTHER FENCE IN THIS DIRECTORY. A plane
 * keeps the answer it was born with; there is no per-request check of an
 * environment variable anywhere in `server/data-plane/`.
 */
export function runQueueTarget(): RunQueueTarget | null {
  const url = process.env['RECONCILE_RUN_QUEUE_URL']
  if (url === undefined || url === '') return null
  const endpoint = process.env['RECONCILE_RUN_QUEUE_ENDPOINT']
  const region = process.env['AWS_REGION']
  return {
    url,
    ...(endpoint === undefined || endpoint === '' ? {} : { endpoint }),
    region: region === undefined || region === '' ? DEFAULT_REGION : region,
  }
}

/**
 * The publisher this process will use, decided once.
 *
 * ⚠️ THE IMPORT IS DYNAMIC AND THE `await` IS WHY THIS IS ASYNCHRONOUS. A
 * plane with no queue configured never loads `sqs-run-queue.ts` and therefore
 * never constructs an `SQSClient`, which is what keeps a process with no AWS
 * credentials from trying to find some. Derive the fence, never read it:
 * `grep -rnE "^import .*from './sqs-run-queue.ts'" server/` → exactly one
 * line, and it is inside this function.
 *
 * 🛑 **THE `^import` IS NEW — G2172, 28 Sep 2026 — AND THE BARE FORM THIS LINE
 * CARRIED ANSWERED TWO AGAINST A CLAIM OF ONE**, the second being this very
 * paragraph's predecessor. It is not restated here, for the reason it was
 * wrong: a path spelled inside `server/` is a path `server/` contains.
 * **G2134 found this exact shape on `jwks-source.ts` on 25 Sep 2026, named it
 * G978's, and repaired only its own two files** — this one was measured by
 * nobody and went on claiming *exactly one* for three days. A defect that is
 * named and not swept grows; this is the sweep.
 * ⚠️ **AND THE ANCHOR IS A LANDMARK, NOT THE PROPERTY**: a static `import type`
 * is erased by `verbatimModuleSyntax` before the loader sees it, so no
 * path-grep can answer the dynamic-import question at all. The control is
 * `tests/http/console-roster-unreachable.test.ts` §1c.
 */
export async function resolveRunQueuePublisher(): Promise<RunQueuePublisher> {
  const target = runQueueTarget()
  if (target === null) return unconfiguredRunQueue()
  const { sqsRunQueuePublisher } = await import('./sqs-run-queue.ts')
  return sqsRunQueuePublisher(target)
}

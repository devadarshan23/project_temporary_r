/**
 * C5 · PRESS RUN — `POST /v1/runs` (`admitRun`). G692, G693, G694.
 * 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS MOUNT DISCHARGES A WITNESS THAT HAS BEEN RED SINCE 16 Aug 2026, AND
 *    THE WITNESS IS ABOUT BODY VALIDATION RATHER THAN ABOUT RUNS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `tests/http/engine-on-served-path.test.ts` §4, verbatim:
 *
 *     "NO REQUEST BODY IS VALIDATED ANYWHERE IN THIS SERVER … So a body
 *      carrying `tenantId` — the one key `docs/contracts/README.md` says
 *      appears in NO request body in ANY tier — reaches no validator at all.
 *      A 404 here means `admitRun` is not mounted; a 2xx would mean it is
 *      mounted and the key was accepted, which is strictly worse."
 *
 * **Nothing in this file validates that body.** `admitRun`'s `requestBody` is
 * `additionalProperties: false, required: [definitionId]`,
 * `server/contract/routes.ts` bundles it into `schema.body`, and ajv refuses
 * the request before this module is reached — with
 * `removeAdditional: false`, which `server/http/app.ts` sets precisely so the
 * key is REJECTED rather than silently stripped. **A handler cannot make that
 * assertion pass and cannot make it fail; mounting the route is the whole of
 * what was missing.** The `todo` is converted to a live assertion in the
 * commit that adds this file.
 *
 * ⚠️ AND THE TODO NAMED THREE BLOCKERS OF WHICH ONE WAS NOT ONE, WHICH IS
 * RECORDED RATHER THAN QUIETLY SKIPPED: *"no member of `errors.yaml`'s closed
 * 71-code enum means 'declared and unbuilt', so it cannot even be registered
 * as an honest refusal."* `admitRun` needs no such member. Every refusal it
 * can produce is declared on the operation and is already in the enum —
 * `definition_not_active`, `slot_fill_incomplete`, `period_closed` — and the
 * two that WERE blockers are closed by `db/migrations/0069_run_admission.sql`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G300's THREE PARTS, DERIVED WITH THE COMMANDS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   TABLE       `tenant.reconciliation_definition` × `tenant.definition_slot`
 *               × `tenant.reconciliation_period`, plus `public.run`'s two new
 *               columns and its unique index —
 *               `db/migrations/0069_run_admission.sql`; and, since
 *               20 Sep 2026, `tenant.document_slot_binding` —
 *               `db/migrations/0150_document_slot_binding.sql`, which is what
 *               `readSlotFill()` reads and what gives the third part of the
 *               idempotency basis a producer at all. Derive:
 *               `grep -c 'CREATE UNIQUE INDEX run_idempotency_key' db/migrations/0069_run_admission.sql`
 *   MODEL       `admitRun()` in `model/run-admission.ts`, with its three total
 *               records and its nine-arm refusal union. Derive:
 *               `grep -rln 'export function admitRun' model/`
 *   CAPABILITY  `x-capability: trigger_run`, a member of the closed set;
 *               `CAPABILITY_RESOURCE_CLASS.trigger_run` is `configuration`,
 *               not `tenant_data`, which is `model/access.ts`'s own decision
 *               and not this file's. Derive:
 *               `grep -n 'operationId: admitRun' -A 2 docs/contracts/capability.openapi.yaml`
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 DEDUPLICATION IS A UNIQUE INDEX, NOT A LOOKUP. READ THIS BEFORE
 *    "SIMPLIFYING" THE INSERT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The contract's entire argument for this operation is a RACE — *"an operator
 * presses Run at the same moment a document lands and fires the `ingest`
 * trigger, and two runs form over identical inputs."* A handler that `SELECT`ed
 * for an existing run and then `INSERT`ed would LOSE that race: both requests
 * find nothing, both insert, and the operation fails at exactly the thing it
 * is named for. So:
 *
 *     INSERT … ON CONFLICT (tenant_id, idempotency_key) DO NOTHING RETURNING …
 *
 * The database arbitrates. Zero rows returned means somebody else won, and the
 * follow-up `SELECT` reads THEIR row — which is the `deduplicated` arm, and
 * which the contract insists is a SUCCESS: *"A client showing an error toast
 * on `deduplicated` is telling the operator that the correct behaviour went
 * wrong."*
 *
 * ⚠️ AND THE FOLLOW-UP `SELECT` CAN LEGITIMATELY FIND NOTHING, WHICH IS A 500
 * AND NOT AN EMPTY 200. It would mean the conflicting row is invisible to this
 * transaction — a tenant disagreement the `WITH CHECK` should already have
 * refused — and inventing a run to publish, or publishing `deduplicated` with
 * no run, are both worse than saying so.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 READ THE SQL AND NOTE WHAT IS NOT IN IT: THERE IS NO TENANT PREDICATE ON
 *    ANY READ.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Isolation is `reconciliation_definition_rls`, `definition_slot_rls`,
 * `reconciliation_period_rls` and `run_rls`, reached through the
 * `withTenantScope()` transaction `server/data-plane/authorisation-record.ts`
 * opened. **The INSERT is the exception and it is not one**: `tenant_id` is a
 * COLUMN VALUE there, not a `WHERE`, and what makes it safe is `run_rls`'s
 * `WITH CHECK` comparing it against `app.tenant_id` — the same construction
 * and the same argument as `writeAuthorisationRecord()`, which passes
 * `grant.tenantId` rather than the scope's own string precisely so the policy
 * compares two facts instead of comparing a value with itself.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ **IT PUBLISHES NOW — R-B, 20 Sep 2026, THE OWNER'S RULING. ⚠️ THE
 *    SENTENCE THIS REPLACES IS QUOTED RATHER THAN DELETED, because it is the
 *    one three files carried and the one a reader would have quoted onward.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It read, on the `started_at` block below and still does:
 *
 *     "**There is no executor**, so the two are the same instant today; the
 *      commit that writes one owes either a second column or an argument that
 *      admission time is what a consumer wants."
 *
 * **That sentence is STILL EXACTLY TRUE and this commit does not discharge
 * it**: there is still no executor, `Run.startedAt` is still the admission
 * time, and `server/data-plane/run-worker.ts` says in capitals that it
 * reconciles nothing. What changed is that a run no longer sits in `queued`
 * with NOTHING ANYWHERE TOLD ABOUT IT — the admitting act now publishes
 * `(tenantId, runId)` to a real queue, and a worker consuming that message
 * opens exactly that tenant's scope.
 *
 * 🛑 THE PUBLISH IS `afterCommit`, ON THE SEAM, AND NOT THE LAST LINE OF
 * `admitRunBody`. A body runs INSIDE the transaction, so a message sent there
 * would be a message for a run that may roll back — and the worker cannot tell
 * a rolled-back run from another tenant's, because both are an empty result
 * set under `run_rls`. `server/data-plane/run-queue.ts` §2 argues the whole
 * trade and names what the choice costs: a process that dies between `COMMIT`
 * and the send loses the message, and the repair is the operator pressing Run
 * again — which is free, because `run_idempotency_key` makes a second press
 * produce no second run. **Both outcome arms publish for exactly that
 * reason.**
 */

import { createHash, randomBytes } from 'node:crypto'

import type { FastifyReply, FastifyRequest } from 'fastify'

import type { ScopedClient } from '../../db/tenant-scope.ts'
import type {
  DefinitionId,
  ReconciliationPeriodId,
  RunId,
  SourceDocumentId,
} from '../../model/kernel.ts'
import {
  admitRun,
  type PeriodRecord,
  type RunAdmissionRefusal,
  type SlotDeclaration,
  type SlotFill,
  type DefinitionRecord,
} from '../../model/run-admission.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { actingTenantOf, type AuthorisedBody, type AuthorisedOperation } from './authorisation-record.ts'
import { RUN_QUEUE_MESSAGE_KIND, type RunQueuePublisher } from './run-queue.ts'
import { RUN_COLUMNS, toRun, unpublishable, type RunRow } from './runs.ts'
import { readRunCompletenessBatch } from './run-account-store.ts'

/**
 * The body, exactly as `capability.openapi.yaml` declares it — after ajv has
 * refused everything else. `periodId` is `type: [string, 'null']` and is not
 * `required`, so all three of absent, `null` and a string are legal and the
 * first two mean the same thing here.
 *
 * 🛑 THERE IS NO `tenantId` KEY AND THERE MUST NEVER BE ONE.
 * `docs/contracts/README.md`: *"`tenantId` appears in no request body,
 * anywhere … A request that could STATE its tenant is a request that could
 * state the wrong one — invariant 1, expressed as an absence rather than a
 * comment."* The tenant comes from `boundTenantOf(session)`, through the seam
 * that opened this transaction, and this module never sees a request-supplied
 * one because ajv refused it forty microseconds earlier.
 */
interface AdmitRunBody {
  readonly definitionId: string
  readonly periodId?: string | null
}

function bodyOf(request: FastifyRequest): AdmitRunBody {
  return request.body as AdmitRunBody
}

/**
 * A fresh `RunId`.
 *
 * ⚠️ G97 — *"every branded id is `text`; the slug is stored VERBATIM. THERE IS
 * NO `uuid` ANYWHERE IN THIS MODEL."* Same shape and same width as
 * `mintAuthorizationGrantId()`, and `randomBytes` for its reason: this is a
 * PRIMARY KEY on a table an append-only record points at, and a predictable
 * one lets anybody who can write a row choose which run they collide with.
 */
function mintRunId(): string {
  return `run_${randomBytes(16).toString('hex')}`
}

/**
 * The idempotency key — `sha256` over a LENGTH-PREFIXED join of the three
 * parts the contract names.
 *
 * 🛑 LENGTH-PREFIXED, AND THAT IS `fieldPathKey()`'s CONSTRUCTION RATHER THAN
 * A STYLE. `model/kernel.ts` argues it there: a separator-joined key is
 * ambiguous the moment a part can contain the separator, and a definition id
 * is `text` stored verbatim under G97 with no format the database enforces. A
 * length prefix makes the join INJECTIVE, so two different bases cannot
 * produce one key and deduplicate two unrelated runs into one.
 *
 * 🛑 AND IT IS HASHED RATHER THAN STORED PLAIN FOR A MEASURABLE REASON, NOT A
 * SECURITY ONE — **the key is not a secret and confers nothing.**
 * `slotFillBasis` is canonical JSON over every document in every slot and
 * grows without bound; PostgreSQL's btree refuses an index entry beyond
 * roughly 2704 bytes, so a plain key would make `admitRun` fail on exactly the
 * runs with the most inputs. A fixed 64 hex characters cannot.
 *
 * ⚠️ THE FINGERPRINT IS PUBLISHED AND THE KEY IS NOT. `RunAdmission
 * .idempotencyBasis.slotFillFingerprint` is the hash of the slot-fill basis
 * ALONE — *"returned so a puzzled operator can see WHY their press of Run
 * joined an existing run"* — and the key composes it with the other two parts.
 * Publishing the key instead would tell an operator nothing they could compare.
 */
function part(value: string): string {
  return `${value.length}:${value}`
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function idempotencyKeyFor(args: {
  definitionId: string
  periodId: string | null
  fingerprint: string
}): string {
  const period = args.periodId === null ? '0:' : part(args.periodId)
  return sha256(`${part(args.definitionId)}|${period}|${part(args.fingerprint)}`)
}

/**
 * Nine model refusals → three declared wire answers.
 *
 * 🛑 THE MAPPING IS MANY-TO-ONE AND EVERY COLLAPSE IS ARGUED WHERE THE CODE IS
 *    DECLARED, IN `server/http/problem.ts`, RATHER THAN HERE — because the
 *    argument is about what the CODE means and it must be true for every
 *    caller of it, not only for this one.
 *
 * ⚠️ THE `*_unreadable` ARMS ARE 500s AND NOT 422s, WHICH IS THE ONE ROW OF
 * THIS TABLE A READER SHOULD CHECK. A stored `status` the model cannot read is
 * not a fact about the caller's request; it is a fact about our own storage,
 * and answering 422 would tell an operator to change a definition that may be
 * perfectly reasonable. `server/data-plane/runs.ts`'s `unpublishable()` takes
 * exactly this position for `run.status`.
 *
 * 🛑 AND IT IS **NOT** REUSED HERE, WHICH IS A DECISION AND THE OPPOSITE OF
 * THE ONE `RUN_COLUMNS` GOT. `Unpublishable` is `{ table, column, runId }` and
 * `unpublishable()` logs *"row for run `X`"*; the four arms below are about a
 * DEFINITION, a PERIOD and a SLOT, and none of them has a run — the run does
 * not exist yet. Passing a definition id as a `runId` would send the operator
 * reading the log to `public.run` and they would find nothing there. **A
 * refusal that names the wrong subject is worse than a second four-line
 * function**, and the STATUS and the CODE are identical because the fact is
 * identical: a stored value the domain model does not define.
 */
function unreadableConfiguration(
  reply: FastifyReply,
  table: string,
  column: string,
  rowId: string,
): FastifyReply {
  console.error(
    `data-plane: \`${table}\` row \`${rowId}\` carries a \`${column}\` that is not in the ` +
      'domain model’s vocabulary; no run was admitted.',
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The request could not be completed.',
    detail: 'Stored reconciliation configuration carries a value the domain model does not define.',
  })
}

function refuse(reply: FastifyReply, refusal: RunAdmissionRefusal): FastifyReply {
  switch (refusal.kind) {
    case 'definition_absent':
    case 'definition_not_active':
      return sendProblem(reply, {
        status: 422,
        code: CODES.definitionNotActive,
        title: 'That definition cannot be run.',
        /* A CONSTANT. `errors.yaml` forbids a request-derived `detail`. */
        detail: 'No active reconciliation definition with that id is visible to this session.',
      })
    case 'period_absent':
    case 'period_not_open':
      return sendProblem(reply, {
        status: 409,
        code: CODES.periodClosed,
        title: 'That period is not open.',
        detail: 'Reopen the period before running against it.',
      })
    case 'slot_fill_incomplete':
      return sendProblem(reply, {
        status: 422,
        code: CODES.slotFillIncomplete,
        title: 'A required slot has no document in it.',
        detail: 'At least one slot the definition requires a document for is empty.',
      })
    case 'definition_status_unreadable':
      return unreadableConfiguration(
        reply,
        'tenant.reconciliation_definition',
        'status',
        refusal.definitionId,
      )
    case 'period_status_unreadable':
      return unreadableConfiguration(
        reply,
        'tenant.reconciliation_period',
        'status',
        refusal.periodId,
      )
    case 'slot_cardinality_unreadable':
      return unreadableConfiguration(
        reply,
        'tenant.definition_slot',
        'cardinality',
        refusal.definitionId,
      )
    case 'slot_fill_unrepresentable':
      /*
       * Not a table and not a column. The slot-fill state could not be
       * canonicalised, which is unreachable while nothing fills a slot; the
       * subject named is the FUNCTION rather than a row, because there is no
       * row to send anybody to.
       */
      return unreadableConfiguration(
        reply,
        'model/run-admission.ts',
        'slotFillBasis()',
        refusal.definitionId,
      )
  }
}

/**
 * WHICH DOCUMENTS OCCUPY WHICH SLOT, FOR THIS DEFINITION AND THIS PERIOD —
 * `db/migrations/0150_document_slot_binding.sql`. G961–G964, 20 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FUNCTION IS THE PRODUCER OF A FIELD THAT HAD NONE, AND THE SENTENCE
 *    IT ENDS IS QUOTED IN FULL AT ITS OLD CALL SITE BELOW RATHER THAN DELETED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ IT DECIDES NOTHING. It answers *"what is bound"* and `admitRun()` answers
 * *"is that enough"* — `CARDINALITY_REQUIRES_A_DOCUMENT` is the model's and
 * stays there. A reader that filtered on cardinality would delete
 * `slot_cardinality_unreadable`, which exists precisely so an unknown
 * cardinality refuses the whole admission rather than reading as optional.
 *
 * 🛑 READ THE `WHERE` AND THEN READ WHAT IS NOT IN IT.
 *
 *   · **NO TENANT PREDICATE.** Isolation is `document_slot_binding_rls`,
 *     reached through the `withTenantScope()` transaction
 *     `server/data-plane/authorisation-record.ts` opened — the same
 *     construction as every other read in this file. `tests/http/
 *     slot-fill-served.test.ts` §6 is the witness, and it is sharpened
 *     deliberately: the other tenant holds a definition with **the same id**
 *     and **the same slot name**, so nothing but the policy separates them.
 *   · **NO JOIN TO `tenant.source_document`, AND NO FILTER ON ITS ARRIVAL.**
 *     Whether a document is FIT to reconcile is the engine's question. A
 *     reader that dropped a bound-but-unfit document would answer
 *     `slot_fill_incomplete` — a refusal naming the wrong cause, sending an
 *     operator to bind a document that is already bound.
 *   · **NO `DISTINCT`.** The two partial unique indexes in
 *     `db/migrations/0150` §3 carry that, and they have to: `slotFillBasis()`
 *     sorts and does not dedupe, so a duplicated row is a different basis and
 *     therefore a second run over identical inputs. A `DISTINCT` here would be
 *     a reader compensating for what storage allows — `0039`'s refusal, one
 *     table over.
 *   · **NO `ORDER BY`.** `slotFillBasis()` sorts each slot's documents by
 *     UTF-16 code unit and `canonicalise()` sorts the keys, because *"two
 *     callers holding the same documents in a different order would
 *     canonicalise to two different strings and press Run twice."* A second
 *     sort here would be a second implementation of one order, and §5.3 says
 *     which of two copies drifts.
 *
 * 🛑 `period_id IS NOT DISTINCT FROM $2` AND NOT `= $2`, AND THE DIFFERENCE IS
 *    NOT COSMETIC. `admitRun`'s `periodId` is legitimately `null`, and `x = NULL`
 *    is NULL rather than true — so `= $2` would return NO ROWS for every
 *    unperiodised press, turning every definition with a required slot into
 *    `slot_fill_incomplete` forever while the bindings sat in the table. That
 *    is the defect this slice exists to remove, reintroduced by one operator.
 *
 * ⚠️ AND THE NULL IS NOT A WILDCARD: a binding for a named period does not
 * satisfy an unperiodised run and vice versa. `db/migrations/0150` §2 argues
 * it; `tests/http/slot-fill-served.test.ts` §5 witnesses it.
 *
 * ⚠️ **EXPORTED SINCE 21 Sep 2026 — G1506, E4 — AND THE EXPORT IS THE POINT
 *    RATHER THAN A CONVENIENCE.** `server/data-plane/document-assembly.ts` asks
 *    the same question this function answers — *"what is bound to this
 *    definition for this period"* — and a second query over there would be two
 *    implementations of one order, which is §5.3 with the copy being the one
 *    that drifts. **The clause a copy gets wrong is named three paragraphs up**:
 *    `= $2` instead of `IS NOT DISTINCT FROM $2` returns no rows for every
 *    unperiodised run, silently, with the bindings sitting in the table. One
 *    rule, two callers.
 */
export async function readSlotFill(
  tx: ScopedClient,
  definitionId: string,
  periodId: string | null,
): Promise<readonly SlotFill[]> {
  const result = await tx.query(
    'SELECT slot, source_document_id FROM tenant.document_slot_binding\n' +
      '      WHERE definition_id = $1 AND period_id IS NOT DISTINCT FROM $2',
    [definitionId, periodId],
  )
  const bySlot = new Map<string, SourceDocumentId[]>()
  for (const row of result.rows as unknown as Array<{
    slot: string
    source_document_id: string
  }>) {
    const documentId = row.source_document_id as SourceDocumentId
    const documents = bySlot.get(row.slot)
    if (documents === undefined) bySlot.set(row.slot, [documentId])
    else documents.push(documentId)
  }
  return [...bySlot].map(([slot, documentIds]) => ({ slot, documentIds }))
}

const admitRunBody: AuthorisedBody = async ({ request, reply, tx, grant }) => {
  const body = bodyOf(request)
  const periodId = body.periodId ?? null

  const definitionResult = await tx.query(
    'SELECT id, version, status FROM tenant.reconciliation_definition WHERE id = $1',
    [body.definitionId],
  )
  const definitionRow = (definitionResult.rows as unknown as
    | Array<{ id: string; version: number; status: string }>)[0]
  const definition: DefinitionRecord | null =
    definitionRow === undefined
      ? null
      : {
          id: definitionRow.id as DefinitionId,
          version: definitionRow.version,
          status: definitionRow.status,
        }

  const slotResult = await tx.query(
    'SELECT slot, cardinality FROM tenant.definition_slot WHERE definition_id = $1',
    [body.definitionId],
  )
  const slots: readonly SlotDeclaration[] = (
    slotResult.rows as unknown as Array<{ slot: string; cardinality: string }>
  ).map((r) => ({ slot: r.slot, cardinality: r.cardinality }))

  /*
   * ⚠️ READ ONLY WHEN ONE WAS NAMED. A `SELECT … WHERE id = NULL` returns no
   * rows and would reach `admitRun()` as `period: null`, which the model reads
   * as `period_absent` — a refusal for a request that named no period at all.
   * The model already guards it (`facts.periodId !== null` gates the whole
   * arm), so this is belt and braces; it is here because the query is also a
   * round trip nobody needs.
   */
  let period: PeriodRecord | null = null
  if (periodId !== null) {
    const periodResult = await tx.query(
      'SELECT id, status FROM tenant.reconciliation_period WHERE id = $1',
      [periodId],
    )
    const row = (periodResult.rows as unknown as Array<{ id: string; status: string }>)[0]
    period =
      row === undefined
        ? null
        : { id: row.id as ReconciliationPeriodId, status: row.status }
  }

  /*
   * ✅ THE SLOT FILL HAS A PRODUCER — `db/migrations/0150_document_slot_binding.sql`
   * AND `readSlotFill()` ABOVE, G961–G964, 20 Sep 2026.
   *
   * ⚠️ THE PARAGRAPH THIS REPLACES IS QUOTED RATHER THAN DELETED, because it
   * is the sentence three files carried and the one a reader would have quoted
   * onward before concluding that a required slot could never be satisfied:
   *
   *     "🛑 THE SLOT FILL IS EMPTY AND IT IS A FACT RATHER THAN A STUB.
   *      **Nothing in this repository binds a `SourceDocument` to a slot** —
   *      `db/migrations/0012`'s `source_document` carries an arrival and a
   *      document type and no slot … ⚠️ SO A DEFINITION DECLARING AN
   *      `exactly_one` OR `at_least_one` SLOT IS REFUSED 422 FOREVER, AND THAT
   *      IS THE CORRECT ANSWER."
   *
   * **Its first clause is now false and its second is still exactly right.**
   * `0012`'s `source_document` still carries no slot — the binding is its own
   * table — and an UNBOUND required slot is still a 422, on the same reasoning
   * and against the same quotation: *"Running anyway would raise exceptions
   * for absent documents and call them breaks."* What changed is that the
   * refusal now has a way out. `tests/http/slot-fill-served.test.ts` §1
   * re-witnesses the old red on every run so the way out cannot be mistaken
   * for the refusal having gone.
   *
   * 🛑 AND WHAT MUST STILL NOT BE DONE IS UNCHANGED: an empty `fill` is read as
   * *no document occupies any slot* and never as *all slots satisfied*. That
   * is `model/run-admission.ts`'s sentence and this slice does not touch it.
   *
   * ⚠️ THE READ IS UNCONDITIONAL, UNLIKE THE PERIOD READ TWENTY LINES UP, AND
   * THE DIFFERENCE IS THE ONE THAT MATTERS: that one is gated on what the
   * REQUEST said, this one would have to be gated on a VERDICT — *"only read
   * the fill if the definition is active"* — and the order of those tests is
   * `admitRun()`'s, argued in its header. A handler that decided the
   * definition check before the model did would be a second copy of the
   * cascade's order, and §5.3 says which copy drifts. One round trip on a
   * request that is about to be refused is the price.
   */
  const verdict = admitRun(
    {
      definitionId: body.definitionId as DefinitionId,
      periodId: periodId === null ? null : (periodId as ReconciliationPeriodId),
    },
    { definition, slots, period, fill: await readSlotFill(tx, body.definitionId, periodId) },
  )

  if (verdict.kind === 'refused') {
    if (verdict.unfilledSlots.length > 0) {
      /*
       * The slot NAMES go here and nowhere else. See
       * `RunAdmissionVerdict.unfilledSlots` and `CODES.slotFillIncomplete`:
       * `errors.yaml` forbids a request-derived `detail`, so the caller gets
       * the code and the operator gets this line.
       */
      console.error(
        `data-plane: \`admitRun\` refused \`${body.definitionId}\` — slot(s) with no document: ` +
          verdict.unfilledSlots.join(', '),
      )
    }
    return refuse(reply, verdict.refusal)
  }

  const fingerprint = sha256(verdict.basis.slotFillBasis)
  const idempotencyKey = idempotencyKeyFor({
    definitionId: verdict.basis.definitionId,
    periodId: verdict.basis.periodId,
    fingerprint,
  })

  /*
   * 🛑 `now()` IS THE ADMISSION TIME AND `Run.startedAt` IS THE ONLY TIMESTAMP
   * THIS SCHEMA HAS, WHICH IS SAID HERE RATHER THAN LEFT TO BE NOTICED.
   * `0002_run.sql` declares `started_at timestamptz NOT NULL` and no
   * `admitted_at`, and `Run.startedAt` is `required` on the wire. A run
   * admitted at 10:00 and picked up at 10:05 therefore reports 10:00. **There
   * is no executor**, so the two are the same instant today; the commit that
   * writes one owes either a second column or an argument that admission time
   * is what a consumer wants.
   *
   * ⚠️ `trigger_kind` IS THE LITERAL `'manual'` AND IS NOT TAKEN FROM THE
   * REQUEST, WHICH IS THE CONTRACT'S OWN RULE: *"THE TRIGGER IS ATTRIBUTION,
   * NEVER IDENTITY … A client cannot claim `scheduled` or `ingest` — those are
   * recorded by the mechanisms that actually did them. A trigger a caller
   * could assert would be a trigger a caller could disown."* There is no key
   * for it in the body schema, so the claim is unrepresentable as well as
   * unread.
   *
   * 🛑 `trigger_by_user_id` IS `grant.subjectUserId` AND NOT ANYTHING THE
   * REQUEST SUPPLIED. It is the principal `authorize()` minted this act's
   * record against — one resolution, one principal, one act, which is the
   * property `AuthorisedContext.principal` exists to hold.
   */
  const inserted = await tx.query(
    'INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,\n' +
      '                 trigger_kind, trigger_by_user_id, status, inputs, started_at,\n' +
      '                 idempotency_key)\n' +
      "     VALUES ($1, $2, $3, $4, $5, 'manual', $6, 'queued', $7::jsonb, now(), $8)\n" +
      ' ON CONFLICT (tenant_id, idempotency_key) DO NOTHING\n' +
      `  RETURNING ${returningColumns()}`,
    [
      actingTenantOf(grant),
      mintRunId(),
      verdict.basis.definitionId,
      verdict.definitionVersion,
      verdict.basis.periodId,
      grant.subjectUserId,
      JSON.stringify(verdict.inputs),
      idempotencyKey,
    ],
  )

  const basis = {
    definitionId: verdict.basis.definitionId,
    periodId: verdict.basis.periodId,
    slotFillFingerprint: fingerprint,
  }

  const freshRow = (inserted.rows as unknown as RunRow[])[0]
  if (freshRow !== undefined) {
    const view = toRun(freshRow)
    if (!view.ok) return unpublishable(reply, view.why)
    reply.code(201)
    return { outcome: 'admitted', run: view.value, idempotencyBasis: basis }
  }

  /* DEDUPLICATED — somebody else won the race, or this caller pressed twice. */
  const existing = await tx.query(`${RUN_COLUMNS} WHERE idempotency_key = $1`, [idempotencyKey])
  const existingRow = (existing.rows as unknown as RunRow[])[0]
  if (existingRow === undefined) {
    /* See the header: a conflict this transaction cannot then read is a 500. */
    console.error(
      'data-plane: `admitRun` conflicted on `run_idempotency_key` and then could not read the ' +
        'conflicting row. That row is invisible to this tenant scope, which `run_rls`’s ' +
        '`WITH CHECK` should have refused at the INSERT.',
    )
    return sendProblem(reply, {
      status: 500,
      code: CODES.upstreamUnavailable,
      title: 'The request could not be completed.',
      detail: 'An equivalent run exists and could not be read back.',
    })
  }
  /* G3442 — the deduplicated run may already have been reconciled, so it
     publishes its account's completeness like `getRun` does. */
  const accounted = await readRunCompletenessBatch(tx, [existingRow.id])
  if (!accounted.ok) return unpublishable(reply, accounted.defect)
  const view = toRun(existingRow, accounted.byRun.get(existingRow.id) ?? null)
  if (!view.ok) return unpublishable(reply, view.why)
  return { outcome: 'deduplicated', run: view.value, idempotencyBasis: basis }
}

/**
 * `RUN_COLUMNS` without its `SELECT` and without its `FROM`, for the
 * `RETURNING` clause.
 *
 * 🛑 DERIVED FROM THE ONE LIST RATHER THAN RETYPED, WHICH IS THE WHOLE REASON
 * `RUN_COLUMNS` IS EXPORTED. A hand-written `RETURNING` here would be a second
 * column list for one `Run` schema — `0002_run.sql`'s *"a second vocabulary
 * with nothing checking it"* — and the field it dropped would be dropped on
 * the 201 arm alone, where the `deduplicated` arm went on carrying it.
 */
function returningColumns(): string {
  return RUN_COLUMNS.replace(/^SELECT /, '').replace(/\s*FROM run\s*$/, '')
}

/**
 * ⚠️ `resourceId: null`, AND IT IS THE INTERESTING ONE ON THIS OPERATION.
 * There is no run yet — the act is *admit a run against this definition* — and
 * the run's id is minted inside the transaction the record already opened. The
 * `definitionId` was considered and refused: `ResourceRef.resourceType` is
 * `'Run'` here, and naming a definition's id under a run's type would make the
 * audit row say a thing that is not true. *"A SCOPE, NEVER A GRANT. Its
 * presence narrows; its absence never widens"* — the null is accurate.
 *
 * 🛑 THE RECORD IS MINTED BEFORE THE RUN EXISTS AND COMMITS WITH IT. If the
 * `INSERT` throws, the authorisation record rolls back too; if it is
 * deduplicated, the record still commits, because the act happened and its
 * outcome was *this is the same run*.
 */
export function admitRunOperation(publish: RunQueuePublisher): AuthorisedOperation {
  return {
    operationId: 'admitRun',
    resourceType: 'Run',
    instanceOf: () => null,
    body: admitRunBody,
    afterCommit: async ({ grant, result }) => {
      const admitted = admittedRunOf(result)
      if (admitted === null) return
      await publish({
        kind: RUN_QUEUE_MESSAGE_KIND,
        tenantId: actingTenantOf(grant),
        runId: admitted.runId as RunId,
      })
    },
  }
}

/**
 * The run this act admitted or deduplicated onto, or `null`.
 *
 * 🛑 **BOTH ARMS PUBLISH, AND THE `deduplicated` ONE IS THE RECOVERY STORY
 * RATHER THAN A DUPLICATE.** `server/data-plane/run-queue.ts` §2 takes the
 * publish AFTER the commit, which loses the message if the process dies in
 * between — and the repair it names is the operator pressing Run again. That
 * press computes the SAME idempotency key, creates NO SECOND RUN, and arrives
 * here on the `deduplicated` arm; if this arm did not publish, the one repair
 * the design offers would be the one thing that does not work.
 *
 * ⚠️ AND A SECOND MESSAGE FOR ONE RUN IS ORDINARY AND HARMLESS: SQS is
 * at-least-once anyway, and `claimAdmittedRun()` creates nothing.
 *
 * 🛑 A REAL RUNTIME GUARD RATHER THAN A CAST, AND IT FAILS CLOSED. The seam
 * hands `afterCommit` an `unknown` — see `AuthorisedOperation.afterCommit` for
 * why it is not generic — and a body that changed shape would otherwise
 * publish a message built out of `undefined`. The `else` arm SAYS SO rather
 * than returning quietly, because a silent miss here is a run nobody collects.
 */
function admittedRunOf(result: unknown): { readonly runId: string } | null {
  if (typeof result !== 'object' || result === null) return null
  const record = result as Record<string, unknown>
  const outcome = record['outcome']
  /* A refusal arm returns the `FastifyReply`, which carries no `outcome`. */
  if (outcome !== 'admitted' && outcome !== 'deduplicated') return null
  const run = record['run']
  if (typeof run !== 'object' || run === null) {
    console.error(
      'data-plane: `admitRun` reported `' + String(outcome) + '` and carried no run, so no ' +
        'run-queue message was published. The run row exists. This is a shape change in ' +
        '`admitRunBody` that `admittedRunOf()` did not follow.',
    )
    return null
  }
  /*
   * 🛑 `runId` AND NOT `id`, AND THE FIRST DRAFT OF THIS FUNCTION READ `id`.
   * `toRun()` publishes the wire's `Run`, whose identity field is `runId`;
   * `RunRow`'s column is `id`. **The guard caught it on the first run of
   * `tests/http/run-queue-publish.test.ts`**, printing its own error line
   * rather than publishing a message built out of `undefined` — which is
   * exactly the failure mode `AuthorisedOperation.afterCommit` says a real
   * runtime guard buys over a cast.
   */
  const id = (run as Record<string, unknown>)['runId']
  if (typeof id !== 'string' || id === '') {
    console.error(
      'data-plane: `admitRun` reported `' + String(outcome) + '` with a run carrying no ' +
        '`runId`, so no run-queue message was published. The run row exists.',
    )
    return null
  }
  return { runId: id }
}

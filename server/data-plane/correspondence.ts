/**
 * CORRESPONDENCE, MOUNTED — the pack's **C6 · Ask a question**, which the
 * contract tags **C9 Correspondence**. G318's THIRD wave: *"INGESTION,
 * EXCEPTIONS, CORRESPONDENCE, AND ONLY THEN THE PARTNER PORTAL AND THE STAFF
 * CONSOLE."*
 *
 * THREE OPERATIONS MOUNTED, ALL READS, ALL ON THE CAPABILITY TIER:
 *
 *   `GET /threads`              `listThreads`  view_document
 *   `GET /threads/{threadId}`   `getThread`    view_document
 *   `GET /messages/{messageId}` `getMessage`   view_document
 *
 * **FOUR DECLARED C9 OPERATIONS ARE NOT MOUNTED AND EACH IS REFUSED BY NAME
 * AT THE FOOT OF THIS FILE.** They are all of the WRITES.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE MOUNTS RATHER THAN BUILDS. THE BODIES ARE IN
 *    `server/data-plane/correspondence-store.ts`, WHICH IS WHY IT IS SHORT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `exceptions.ts` set the shape and this follows it: a route reads validated
 * parameters, calls one store function with the transaction the mint opened,
 * and turns its answers into status codes. **Every question about what a
 * column HOLDS is settled in `db/migrations/0022_correspondence.sql`, every
 * question about what a VALUE may be is settled in
 * `server/data-plane/correspondence-vocabulary.ts`, and no SQL is written
 * here.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G300's THREE-PART TEST, DERIVED PER OPERATION AND NOT ASSERTED.
 *    *"A table alone is the trap … Derive each; do not assert readiness."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ALL THREE SHARE THE SAME THREE PARTS, because all three read the same four
 * tables under the same capability. They are derived once and the commands are
 * here rather than in the commit message alone:
 *
 *   TABLE       `grep -c '^CREATE TABLE tenant\.' db/migrations/0022_correspondence.sql`
 *               → 4 — `counterparty`, `correspondence_thread`,
 *               `correspondence_thread_exception`, `correspondence_message`.
 *               **They did not exist before this wave**:
 *               `grep -cil 'correspondence\|thread' db/migrations/00{01..17}*.sql`
 *               finds no table. `tests/db/correspondence.test.ts` drives all
 *               four over a real PostgreSQL, including the RLS-disabled leak
 *               control that tells database isolation from a handler's
 *               `WHERE`, and `tests/db/rls-census.test.ts` (G446) proves all
 *               four carry RLS from the catalogue rather than from a comment.
 *               ⚠️ PER OPERATION: `listThreads` and `getThread` read all four;
 *               `getMessage` reads `correspondence_message` alone and needs no
 *               other.
 *   MODEL       `grep -n 'export interface CorrespondenceThread\|export interface CorrespondenceMessage\|export type ThreadStatus\|export type MessageTrust\|export function isAdmissible' model/correspondence.ts`
 *               → five declarations, all live and **none `@dropped-for-v1`** —
 *               derive that too: `grep -c '@dropped-for-v1' model/correspondence.ts`
 *               → 0, which is the only module in `model/` with no drop in it.
 *               `correspondence-vocabulary.ts` DERIVES every narrowing
 *               predicate from them rather than transcribing one beside them,
 *               and `isAdmissible()` is CALLED rather than restated.
 *   CAPABILITY  `grep -B3 'x-capability: view_document' docs/contracts/capability.openapi.yaml | grep operationId`
 *               → `listThreads`, `getThread`, `getMessage`. `view_document` is
 *               a member of the closed set `model/access.ts` declares —
 *               `grep -n 'viewDocument:' model/access.ts` — and it is a verb
 *               `tenant.role_capability` can carry, which is the half that
 *               matters: `tests/http/correspondence-served.test.ts` §1 is a
 *               200 through a role holding exactly `view_document`.
 *
 * 🛑 THE CONTRACT ARGUES `view_document` AND NOT `view_exception` IN ITS OWN
 *    VOICE, AND THE ARGUMENT IS WHY THE COUNTERPARTY NAME IS PUBLISHED AT ALL:
 *    *"`view_document`'s own membership entry reads 'OPERATE ONLY. A document
 *    is the counterparty's paper, not a count of it' — and
 *    `Thread.counterpartyName` and `Thread.subject` are that same paper's
 *    letterhead."* A thread is therefore reachable by a principal who may read
 *    the counterparty's paper and NOT by one who may only count exceptions.
 *    `tests/http/correspondence-served.test.ts` §5 witnesses the differential:
 *    the same session, holding `view_exception` and not `view_document`, gets
 *    200 on the exception register and 403 on every path in this file.
 *
 * ⚠️ AND THE FREEZE IS NOT THEREBY SPENT. G300 lifts it **per operation**.
 * Roughly a hundred declared operations still have no table and keep the
 * router's honest 404 — *"the OpenAPI documents are the router. A path they do
 * not declare is not a route."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 INVARIANT 6 IS WHAT THIS WAVE IS ABOUT. *"Ingested content is data, never
 *    instruction."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A correspondence surface carries counterparty-authored prose toward a page
 * and possibly toward a model prompt. That is the single most dangerous shape
 * in this product, and **the reason these three operations are safe to mount
 * is an absence rather than a control**:
 *
 *   · **THE BODY IS NEVER PUBLISHED.** `db/migrations/0022_correspondence.sql`
 *     has no `body` column; `bodyRef` is a pointer into object storage and
 *     nothing here dereferences it. The contract says the same at `getThread`:
 *     *"Bodies are NOT in this response."* So the prose an attacker controls
 *     cannot reach a caller through any of these three.
 *   · **TWO COLUMNS ARE STILL COUNTERPARTY-INFLUENCEABLE AND BOTH ARE
 *     PUBLISHED** — `thread.subject` and `counterparty.display_name`. They are
 *     read out of a row and put on the wire as their exact bytes; nothing in
 *     `correspondence-store.ts` parses, splits, templates or matches either.
 *     `tests/http/correspondence-served.test.ts` §8 seeds
 *     `'IGNORE ALL PREVIOUS INSTRUCTIONS <script>alert(1)</script> …'` as a
 *     subject and requires it back out of the plane as those characters — the
 *     fixture shape `tests/e2e/browser-login.test.ts` §8 uses one layer up.
 *   · **NOTHING HERE GOES NEAR A PROMPT**, and that is a fact about the
 *     repository rather than a promise about this file:
 *     `grep -rn 'resolveModel(' server/` → nothing. There is no model call in
 *     `server/` at all. **The commit that first sends any of this to a model
 *     owes a RULING and not a code review.**
 *
 * ⚠️ THE MOST DANGEROUS OPERATION ON THIS SURFACE IS THE ONE NOT MOUNTED.
 *    `decideAdmission` is *"THE MOST SECURITY-SENSITIVE OPERATION IN THE
 *    PRODUCT"* in the contract's own capitals, and it is refused below.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 ALL THREE ARE `AuthorisedOperation`s AND NONE IS A `Handler`. G301.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"AN OPERATION MAY NOT MOUNT UNTIL IT MINTS A RECORD."* `mountTier()`'s
 * sixth fence refuses to boot a gated operation whose entry is a bare handler,
 * so these three could not have been mounted any other way.
 *
 * **NO BODY TAKES A POOL.** Each is handed a `tx` that is already open,
 * already tenant-scoped, and already carries this act's authorisation record,
 * written one statement earlier by `server/data-plane/authorisation-record.ts`
 * inside the SAME transaction. A body therefore has no way to reach tenant
 * data except through the transaction the mint opened.
 *
 * ⚠️ ALL THREE ARE READS, so the property here is `run-account.ts`'s rather
 *    than `assignException`'s: a rolled-back act takes its record with it.
 *    The stronger write-side statement is not claimed, because this file
 *    mounts no write.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 INVARIANT 1, AND THE FOUR-VECTOR TEST THESE OPERATIONS OWE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"Tenant scope is derived from the session, never read from a request."*
 * There is no `tenantId` on any of these signatures, no tenant predicate in
 * any statement `correspondence-store.ts` issues, and the tenant reaches the
 * query only through `withTenantScope()`'s `SET LOCAL`.
 *
 * ✅ **THE LIMITATION BELOW IS CLOSED — G941, 20 Sep 2026 — AND THE BLOCK IS
 *    CORRECTED RATHER THAN DELETED.** All THREE of these operations now refuse
 *    a smuggled `?tenantId=` with a 400. ⚠️ **THE SENTENCE THAT MATTERS MOST
 *    IN IT WAS THE WARNING ABOUT THE COUNT — *"which makes it five of the
 *    fourteen served operations, not the two a code comment in `exceptions.ts`
 *    counts for its own four. The comment is right about its four and must not
 *    be read as a repository-wide figure"* — AND IT WAS RIGHT AND STILL
 *    UNDERSTATED: the repository-wide figure was 122 of 136**, measured in
 *    `tests/http/parameter-free-querystring.test.ts`'s captured red. §3 of
 *    this file's suite needed no edit. THE ORIGINAL FOLLOWS, UNCHANGED.
 *
 * ⚠️ AND THE KNOWN, UNRULED LIMITATION APPLIES TO **TWO OF THESE THREE**. An
 *    operation declaring **no** query parameter gets **no querystring schema
 *    at all** — `schemaFromParameters()` returns `undefined` when it finds no
 *    `in: query` parameter — so `?tenantId=…` against such an operation is
 *    **IGNORED rather than REFUSED**. Invariant 1 still holds (nothing reads
 *    it), but *ignored and read look identical from outside*.
 *
 *    **`listThreads` declares six query parameters**, so it gets
 *    `additionalProperties: false` and a smuggled `?tenantId=` is a 400.
 *    **`getThread` and `getMessage` declare only a PATH parameter**, so both
 *    are in the IGNORING class — which makes it five of the fourteen served
 *    operations, not the two a code comment in `exceptions.ts` counts for its
 *    own four. The comment is right about its four and must not be read as a
 *    repository-wide figure.
 *
 *    **This file does not fix it.** The fix changes behaviour on every tier at
 *    once and is a ruling nobody has taken.
 *    `tests/http/correspondence-served.test.ts` §3 asserts the four vectors —
 *    header, cookie, query and path — **and asserts the ANSWER DOES NOT MOVE**
 *    rather than asserting a status, which is the assertion that stays true
 *    whichever way the ruling goes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE `$defs` BOOT DEFECT, AND `listThreads` WAS NAMED AS ITS NEXT VICTIM.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `server/contract/routes.ts` records it: `bundleSchema()` returns a
 * self-contained schema whose `$defs` sits BESIDE the node, and a parameter's
 * bundled schema becomes a PROPERTY of a larger object — so the `$defs` landed
 * nested at `properties.status.$defs` while the pointer inside still read
 * `#/$defs/ThreadStatus`, and Fastify refused to build the route:
 *
 *     FST_ERR_SCH_VALIDATION_BUILD — … can't resolve reference #/$defs/… from id #
 *
 * The fix — hoisting every parameter's `$defs` to the root — landed with the
 * exceptions wave, and that commit's own note says *"`listThreads` is the next
 * one waiting."* **IT IS, AND IT IS COVERED.** `listThreads`'s `status`
 * parameter is `type: array` whose `items` `$ref`s
 * `#/components/schemas/ThreadStatus`, which is the same class one nesting
 * level deeper than the exceptions parameters that found it. The proof is that
 * the plane BOOTS — `tests/http/correspondence-served.test.ts` starts one, and
 * a boot failure here is a stack trace and not a silent hole, which is
 * `bundle.ts`'s design working.
 */

import type { FastifyRequest } from 'fastify'

import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import {
  readMessage,
  readThread,
  readThreadPage,
  type CorrespondenceDefect,
} from './correspondence-store.ts'

/**
 * `components.parameters.ThreadId` / `MessageId` — `in: path`,
 * `required: true`. Each read once and used twice, for `runs.ts`'s reason: the
 * body needs the id to read on and `instanceOf` needs it to name the
 * `ResourceRef` the authorisation is minted against, and *"the one that
 * drifted silently would be the AUDIT record rather than the query — which is
 * the worse direction."*
 */
function threadIdOf(request: FastifyRequest): string {
  return (request.params as { threadId: string }).threadId
}

function messageIdOf(request: FastifyRequest): string {
  return (request.params as { messageId: string }).messageId
}

/**
 * The store could not publish a row. A 500, logged with the COLUMN and never
 * with the cell — `exceptions.ts`'s `unpublishableException()` one surface
 * over, and written separately rather than shared because that one's message
 * says *"exception"* and a message that said the wrong noun would send
 * somebody to the wrong table.
 *
 * 🛑 THE CELL IS NEVER LOGGED AND THAT MATTERS MORE HERE THAN IT DID THERE. On
 *    this surface the unpublishable value could BE the counterparty's text —
 *    a `trust` column carrying something a hostile sender's pipeline wrote —
 *    and a log line is read by a human in a terminal that may render control
 *    characters. The column name and the row id are enough to find it.
 */
function unpublishableCorrespondence(
  reply: Parameters<AuthorisedBody>[0]['reply'],
  why: CorrespondenceDefect,
) {
  console.error(
    `data-plane: \`${why.table}\` row \`${why.rowId}\` carries a \`${why.column}\` that is ` +
      `not in the domain model’s vocabulary, or a shape the contract cannot publish; ` +
      `the row was not published.`,
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The request could not be completed.',
    detail:
      'A stored correspondence row carries a value the domain model does not define. ' +
      'It was not published.',
  })
}

/**
 * The one 404 both instance-bound operations answer, written once so they
 * cannot diverge into two messages that tell a caller which they hit.
 *
 * ⚠️ THE `detail` IS A CONSTANT AND CARRIES NO ID. `errors.yaml`: `detail`
 * *"MUST NOT contain field values, record contents or customer-authored
 * strings"* — and an id echoed back would additionally confirm, for the
 * cross-tenant case, that the attacker's id was well formed enough to reach a
 * handler.
 *
 * ⚠️ ONE MESSAGE FOR TWO NOUNS, DELIBERATELY. A thread 404 and a message 404
 * say the same words. Distinguishing them would tell a caller which of the two
 * ids they guessed was real, which is the disclosure invariant 1 forbids.
 */
const NOT_VISIBLE_DETAIL = 'No correspondence with that id is visible to this session.'

function notFound(reply: Parameters<AuthorisedBody>[0]['reply']): unknown {
  return sendProblem(reply, {
    status: 404,
    code: CODES.resourceNotFound,
    title: 'No such correspondence.',
    detail: NOT_VISIBLE_DETAIL,
  })
}

/* ------------------------------------------------------------------ *
 * `listThreads` — the conversations, filtered by exception or counterparty.
 * ------------------------------------------------------------------ */

/**
 * The querystring AFTER ajv has coerced, defaulted and refused.
 *
 * ⚠️ `limit` IS NOT OPTIONAL HERE BECAUSE `components.parameters.Limit`
 *    CARRIES `default: 50` and `useDefaults: true` is on — so a request that
 *    omits it arrives with it. Restating the default in this file would be a
 *    second place for it to drift.
 *
 * ⚠️ `status` ARRIVES AS AN ARRAY EVEN FOR ONE VALUE, because
 *    `AJV_OPTIONS.coerceTypes` is `'array'`. A handler that special-cased the
 *    scalar would be handling a case ajv has already removed.
 */
interface ListThreadsQuery {
  readonly exceptionId?: string
  readonly counterpartyId?: string
  readonly status?: readonly string[]
  readonly overdueOnly?: boolean
  readonly cursor?: string
  readonly limit: number
}

const listThreadsBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const query = request.query as ListThreadsQuery

  const read = await readThreadPage(
    tx,
    {
      ...(query.exceptionId === undefined ? {} : { exceptionId: query.exceptionId }),
      ...(query.counterpartyId === undefined ? {} : { counterpartyId: query.counterpartyId }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.overdueOnly === undefined ? {} : { overdueOnly: query.overdueOnly }),
    },
    { cursor: query.cursor, limit: query.limit },
  )

  /**
   * ⚠️ A 400 AND NOT `listExceptions`'s 422, AND THE DIFFERENCE IS THE
   *    CONTRACT RATHER THAN A PREFERENCE. `listThreads` DECLARES ONLY 200 AND
   *    403 — no 422 and no 400 — so there is no declared status for an
   *    unreadable cursor and whichever is answered is undeclared. 400 is taken
   *    because it is the status Fastify's own validator already answers for a
   *    malformed query value on this same operation, so a client meets ONE
   *    status for "your query string was wrong" rather than two that depend on
   *    which component noticed.
   *
   *    🛑 **THE REPOSITORY NOW ANSWERS THREE DIFFERENT WAYS FOR THE IDENTICAL
   *    FAULT** — `listRuns` 400 (undeclared), `listExceptions` 422 (declared),
   *    `listThreads` 400 (undeclared). `exceptions.ts` named the first
   *    divergence and said *"the fix is a 422 on `listRuns` or a 400 declared
   *    on both, and either is a contract change nobody has ruled."* That is
   *    still true and there are three of them now. Named rather than
   *    quietly made a fourth shape.
   */
  if (read.kind === 'bad_cursor') {
    return sendProblem(reply, {
      status: 400,
      code: CODES.validationFailed,
      title: 'The cursor is not one this plane issued.',
      detail:
        'A cursor is a position in an ordering. One this plane did not issue is refused ' +
        'rather than honoured, because honouring it silently skips rows.',
    })
  }
  if (read.kind === 'unpublishable') return unpublishableCorrespondence(reply, read.defect)

  return { items: read.items, nextCursor: read.nextCursor }
}

/* ------------------------------------------------------------------ *
 * `getThread` — one thread and its messages, each with its evidence state.
 * ------------------------------------------------------------------ */

const getThreadBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const read = await readThread(tx, threadIdOf(request))
  if (read.kind === 'not_found') return notFound(reply)
  if (read.kind === 'unpublishable') return unpublishableCorrespondence(reply, read.defect)
  return { thread: read.thread, messages: read.messages }
}

/* ------------------------------------------------------------------ *
 * `getMessage` — one message, and precisely what it may be used for.
 * ------------------------------------------------------------------ */

const getMessageBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const read = await readMessage(tx, messageIdOf(request))
  if (read.kind === 'not_found') return notFound(reply)
  if (read.kind === 'unpublishable') return unpublishableCorrespondence(reply, read.defect)
  return read.message
}

/* ------------------------------------------------------------------ *
 * THE THREE OPERATIONS, AS G301 REQUIRES THEM: A CAPABILITY, A RESOURCE, A
 * BODY.
 *
 * 🛑 THE CAPABILITY IS TAKEN FROM `CAPABILITIES`, NOT WRITTEN AS A STRING, so
 * a capability the model retires is a compile error here rather than a 403
 * nobody can explain. Each must equal the `x-capability` the contract
 * annotates, and the two are joined by nothing but a test:
 * `tests/http/authorisation-record.test.ts` §3 asserts the agreement and gains
 * a case per operation in the commit that mounts one.
 *
 * ⚠️ `resourceType` IS `'CorrespondenceThread'` AND `'CorrespondenceMessage'`,
 * WHICH ARE THE MODEL'S OWN INTERFACE NAMES — `ResourceRef`'s docblock:
 * *"Entity name: 'Exception', 'SourceDocument', 'Solution'. Never parsed."*
 * They are also exactly the brands `model/kernel.ts` uses:
 * `ThreadId = Id<'CorrespondenceThread'>` and
 * `MessageId = Id<'CorrespondenceMessage'>`. That agreement is not enforced by
 * anything and is worth stating: an audit record naming `'Thread'` would be
 * pointing at a type this repository does not declare.
 *
 * 🛑 TWO RESOURCE TYPES AND NOT ONE, WHICH `exceptions.ts` DID NOT HAVE TO
 * DECIDE. A message is not a thread — `getMessage` is reachable without ever
 * naming a thread, by the contract's own route shape — so recording
 * `'CorrespondenceThread'` for a message read would name a resource the caller
 * did not ask for and did not necessarily reach.
 * ------------------------------------------------------------------ */

/**
 * The conversations.
 *
 * ⚠️ `instanceOf` IS `null`, AND IT IS `listRuns`'s AND `listExceptions`'s
 * CASE. `ResourceRef.resourceId`'s own example for a null is *"opening a
 * list"*.
 *
 * 🛑 AND `?exceptionId=` DOES **NOT** MAKE IT INSTANCE-BOUND, WHICH IS WORTH
 * ARGUING BECAUSE IT LOOKS LIKE IT SHOULD. A filter narrows a list; it does
 * not turn the act into a read OF that exception. Recording the exception id
 * here would additionally record a `ResourceRef` whose `resourceType` is
 * `CorrespondenceThread` and whose `resourceId` is an `ExceptionId` — an audit
 * row that names two different entities and is wrong about at least one.
 */
export const listThreadsOperation: AuthorisedOperation = {
  operationId: 'listThreads',
  resourceType: 'CorrespondenceThread',
  instanceOf: () => null,
  body: listThreadsBody,
}

/** One thread and its messages. The instance is the thread. */
export const getThreadOperation: AuthorisedOperation = {
  operationId: 'getThread',
  resourceType: 'CorrespondenceThread',
  instanceOf: (request) => threadIdOf(request),
  body: getThreadBody,
}

/** One message. The instance is the message, not the thread it sits in. */
export const getMessageOperation: AuthorisedOperation = {
  operationId: 'getMessage',
  resourceType: 'CorrespondenceMessage',
  instanceOf: (request) => messageIdOf(request),
  body: getMessageBody,
}

/* ══════════════════════════════════════════════════════════════════ *
 * 🛑 THE FOUR C9 OPERATIONS THAT ARE **NOT** MOUNTED, REFUSED BY NAME.
 *
 * G300's test is TABLE **and** MODEL **and** CAPABILITY. All four pass the
 * CAPABILITY part — `send_outbound` and `admit_correspondence` are both in
 * `CAPABILITIES` — and all four pass the MODEL part, because
 * `model/correspondence.ts` and `model/policy.ts` declare every type they
 * need. **Each fails on a table, and the missing table is DIFFERENT in three
 * of the four cases, so they are argued one at a time rather than swept.**
 *
 * `exceptions.ts` established that a sweep is the thing to avoid here: G359
 * refused `reverseResolution` on a reason G300 does not name, and the value of
 * that row was that it was argued rather than grouped.
 *
 * ─────────────────────────────────────────────────────────────────────
 * `openThread`  POST /threads  ·  send_outbound
 *
 *   TABLE: `tenant.correspondence_thread` EXISTS — this is the only one of the
 *   four whose table is present. It fails on a DIFFERENT table:
 *   **`CorrespondenceConfig` has none.** Derive it:
 *       grep -rn 'permittedChannels\|correspondence_config' db/migrations/
 *   → nothing.
 *
 *   The contract declares a 422 `outbound_channel_not_permitted` and argues
 *   for its placement: *"Refused at open rather than at send, so nobody drafts
 *   into a channel that cannot be used."* `permittedChannels` is the list that
 *   refusal reads and there is nowhere to read it from — so the operation
 *   would mount with its ONLY declared refusal structurally unreachable, and
 *   would accept every channel including ones a tenant has prohibited.
 *
 *   ⚠️ AND THE SECOND HALF IS THE PRIVILEGE. `0022` grants `SELECT` and
 *   nothing else, deliberately: *"a request path that could INSERT a thread
 *   could fabricate a correspondence history"* — evidence in a dispute and a
 *   defence in an audit. The grant lands with the writer, in that commit,
 *   which is `0009`'s rule.
 *
 * ─────────────────────────────────────────────────────────────────────
 * `checkOutboundDisclosure`  POST /threads/{id}/messages/disclosure-check
 *                            ·  send_outbound
 *
 *   TABLE: **none for `CorrespondenceConfig`, and none for the ceiling it
 *   computes over.** The response REQUIRES `wouldDiscloseClass`, `ceiling`
 *   and `policyVersion`, and every one of the three is a field of a config
 *   that does not exist.
 *
 *   🛑 AND THERE IS A SECOND, HARDER BLOCKER THAT IS INVARIANT 4's. The
 *   verdict is a maximum over the `FieldSpec` classes of the paths in
 *   `includeFields` — G208 — and invariant 4 says *"a JSONB key with no
 *   `FieldSpec` is UNREADABLE"*, fail-closed. `db/migrations/0012` has a
 *   `document_field_spec` table, so some of this is reachable; the OUTBOUND
 *   ceiling itself (`maxDataClassInOutbound`) is not. **Mounting a
 *   disclosure DRY RUN that cannot read the ceiling would report `sendable`
 *   for a draft no ceiling had been applied to**, which is worse than a 404:
 *   it is an affirmative safety answer with nothing behind it.
 *
 * ─────────────────────────────────────────────────────────────────────
 * `sendOutboundMessage`  POST /threads/{id}/messages  ·  send_outbound
 *
 *   TABLE: **`DisclosureRecord` has no columns at all** — G472, argued at
 *   length in `db/migrations/0022_correspondence.sql`. Nor is there anything
 *   to write a body to (`bodyRef` points into object storage and no bucket is
 *   reachable from this plane), nor a `CounterpartyEndpoint` row for
 *   `requireVerifiedEndpoint` to check.
 *
 *   🛑 THIS IS THE ONE WHERE MOUNTING PARTIALLY WOULD BE A BREACH RATHER THAN
 *   A GAP. *"THE `DisclosureRecord` IS WRITTEN BECAUSE THE DISCLOSURE
 *   HAPPENED, NOT AS A LOG LINE."* An operation that sent a message and wrote
 *   no record would make "which fields did we send to which counterparty"
 *   unanswerable for exactly the sends it performed — and PDPA treats
 *   disclosure to a third party as a distinct act. *"An unverified endpoint is
 *   a phishing vector pointing outward: we would be the trusted party sending
 *   a customer's invoice details to an address a vendor's compromised mailbox
 *   rewrote."*
 *
 * ─────────────────────────────────────────────────────────────────────
 * `decideAdmission`  POST /messages/{id}/admission  ·  admit_correspondence
 *
 *   TABLE: **`CorrespondenceConfig` has none**, and this is the operation
 *   where that absence is most consequential rather than least.
 *
 *   🛑 IT IS *"THE MOST SECURITY-SENSITIVE OPERATION IN THE PRODUCT"* IN THE
 *   CONTRACT'S OWN CAPITALS, AND IT IS THE ONE INVARIANT 6 IS ENFORCED AT:
 *   *"Without this checkpoint, 'the agent read the email' and 'the agent
 *   obeyed the email' are the same event."* The decision is gated on
 *   `capabilityToAdmit` CONJOINED with `orgClassesThatMayAdmit` CONJOINED with
 *   `secondPersonToAdmitAboveClass` — and `model/policy.ts` explains at length
 *   that the org-class half is not decoration: *"the partner hole is an
 *   org-class problem wearing a role costume … there is no arrangement under
 *   which 1CloudHub staff decide what a customer treats as evidence."*
 *
 *   **Two of the three gates have no producer.** Mounting on the capability
 *   alone would reproduce, exactly, the ladder failure `model/policy.ts`
 *   documents as the reason `admit_correspondence` was minted in the first
 *   place — a checkpoint that *"fails open for the one party it names"*.
 *
 *   ⚠️ AND `GRANT UPDATE (admitted_as_evidence_at)` IS THE CHEAP SHORTCUT
 *   SOMEBODY WILL REACH FOR, because `0015`'s G358 made the column-level
 *   UPDATE a familiar tool. `0022`'s grants block refuses it in advance and
 *   by name. **The narrow privilege applied to the widest consequence is not
 *   least privilege.**
 *
 * ─────────────────────────────────────────────────────────────────────
 * 🛑 MOUNTING ANY OF THE FOUR ANYWAY WAS CONSIDERED AND IS REFUSED ON G300's
 * OWN ARGUMENT, READ IN THE DIRECTION IT POINTS: *"a 403 indistinguishable
 * from an unbuilt feature is worse than an honest 404 from the router."* A 422
 * that always fires, or a 200 from a gate with two unreadable arms, is the
 * same sentence — the router's 404 tells a caller something true.
 *
 * `tests/http/correspondence-served.test.ts` §9 asserts all four answer the
 * ROUTER's 404, by its own title, so that a later commit mounting one arrives
 * against a RED rather than silently.
 * ══════════════════════════════════════════════════════════════════ */

/**
 * THE ENGINE READ SURFACE, MOUNTED — `GET /v1/runs/{runId}/account`
 * (`getRunAccount`) and `GET /v1/runs/{runId}/residue` (`listRunResidue`).
 * **G300 and G301 together, 19 Sep 2026.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE MOUNTS RATHER THAN BUILDS, AND THE DISTINCTION IS THE WHOLE OF
 *    WHY IT IS SHORT. THE BODIES WERE ALREADY WRITTEN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `server/data-plane/run-account-store.ts` §4 is *"`getRunAccount`'s body,
 * minus the route"* and §5 is *"`listRunResidue`'s body, minus the route"*.
 * This file is the route, and nothing else: it reads a validated path
 * parameter, calls one of those two functions with the transaction the mint
 * opened, and turns their three answers into three status codes. **Every
 * question about what a channel MEANS is settled in the store, every question
 * about what a column HOLDS is settled in `db/migrations/0007_run_engine_
 * account.sql`, and no SQL is written here.**
 *
 * `db/migrations/0007` names this file by path — *"`server/data-plane/run-
 * account.ts` says so at the handler"* — which is why it has that name.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THESE TWO MAY MOUNT WHEN ROUGHLY A HUNDRED OPERATIONS MAY NOT. G300,
 *    AND ITS TEST IS THREE-PART: **TABLE AND MODEL AND CAPABILITY.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"It lifts on merit, not wholesale … A table alone is the trap —
 * `getRunAccount` had wire schemas and an engine and no columns for a month,
 * and G284's row named six channels when the contract requires ten. **Derive
 * each; do not assert readiness.**"* So, derived rather than asserted, each
 * with the command:
 *
 *   TABLE       `grep -c '^CREATE TABLE tenant\.run_' db/migrations/0007_run_engine_account.sql`
 *               → 13, and `tests/db/run-engine-account.test.ts` drives every
 *               one of them over a real PostgreSQL, including the RLS-disabled
 *               leak control that tells database isolation from a handler's
 *               `WHERE`.
 *   MODEL       `SetReconciliationResult` and `ResidueEntry` are
 *               `model/reconciliation.ts`'s, and `server/data-plane/engine-
 *               vocabulary.ts` DERIVES every narrowing predicate from them
 *               rather than transcribing one beside them.
 *   CAPABILITY  `grep -A1 'operationId: getRunAccount' docs/contracts/capability.openapi.yaml`
 *               → `x-capability: admit_source`, a member of the closed set
 *               `model/access.ts` declares, and one the identity substrate can
 *               actually carry — `tests/http/identity-substrate-served.test.ts`
 *               §1 is a 200 through `role_capability` holding exactly it.
 *
 * ⚠️ AND THE FREEZE IS NOT THEREBY SPENT. G300 lifts it **per operation**.
 * Nothing in this file licenses mounting a third, and the operations whose
 * table does not exist keep the router's honest 404 — *"the OpenAPI documents
 * are the router. A path they do not declare is not a route."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 BOTH ARE `AuthorisedOperation`s AND NEITHER IS A `Handler`. G301.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"AN OPERATION MAY NOT MOUNT UNTIL IT MINTS A RECORD."* `mountTier()`'s sixth
 * fence refuses to boot a gated operation whose entry is a bare handler, so
 * these two could not have been mounted any other way — which is the ruling's
 * own point: *"every newly mounted operation arrives already recording, rather
 * than a backlog accruing behind a promise."*
 *
 * **NEITHER BODY TAKES A POOL.** It is handed a `tx` that is already open,
 * already tenant-scoped, and already carries this act's authorisation record,
 * written one statement earlier by `server/data-plane/authorisation-record.ts`
 * inside the SAME transaction. A body therefore has no way to reach tenant data
 * except through the transaction the mint opened, and a rolled-back read takes
 * its own record with it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE 404 IS ONE ANSWER TO THREE QUESTIONS, AND THERE IS NO BRANCH HERE TO
 *    GET WRONG. READ THIS BEFORE "IMPROVING" THE MESSAGE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Three different facts reach `no_account` from the store, and all three are
 * the same empty result set arriving from the database:
 *
 *   ① this run has no engine account — nobody reconciled it;
 *   ② this run BELONGS TO ANOTHER TENANT, so row-level security made its
 *     envelope row invisible to this scope;
 *   ③ there is no such run anywhere.
 *
 * ② and ③ must be indistinguishable or this operation is an existence oracle
 * across the tenant boundary, which is the property `capability.openapi.yaml`'s
 * `NotFound` response requires in its own words: *"identically for a row that
 * does not exist and for a row in another tenant."* `server/data-plane/runs.ts`
 * makes the same argument for `getRun` and adds the reason it is structural
 * rather than careful: *"a handler that filtered in TypeScript would have two
 * paths and one of them would eventually grow a different message."* There is
 * one path here.
 *
 * 🛑 ① IS THE NEW ONE AND IT IS A LOSS RATHER THAN A DESIGN. It is also FOUR
 * facts rather than one, and `db/migrations/0007` names the missing half:
 * *"The `refused` arm is NOT persisted … a refused run has no account row, so
 * `getRunAccount` answers 404 for it — the same answer it gives for a run
 * nobody has reconciled yet. Those two facts are collapsed today."* So the 404
 * is honest about the RESOURCE it addresses — this run has no account — and
 * silent about WHY, and the silence is the cost. **A handler that answered
 * `{outcome: 'refused'}` to make the arm look served would be fabricating a
 * refusal nobody produced**, which is `NO_ENGINE_ACCOUNT`'s argument one file
 * over: *never mock, never fabricate, leave a clearly marked stub.*
 * `tests/http/run-account-served.test.ts` §5 asserts the collapse rather than
 * implying it is resolved.
 */

import type { FastifyRequest } from 'fastify'

import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import {
  decodeResidueCursor,
  readRunAllocationPage,
  readRunEngineAccount,
  readRunResiduePage,
} from './run-account-store.ts'
import { unpublishable } from './runs.ts'

/**
 * `components.parameters.RunId` — `in: path`, `required: true`, `type: string`.
 * Read once and used twice, for `server/data-plane/runs.ts`'s reason: the body
 * needs the id to read on and `instanceOf` needs it to name the `ResourceRef`
 * the authorisation is minted against, and *"the one that drifted silently
 * would be the AUDIT record rather than the query — which is the worse
 * direction."*
 */
function runIdOf(request: FastifyRequest): string {
  return (request.params as { runId: string }).runId
}

/**
 * `components.parameters.Cursor` and `components.parameters.Limit`, exactly as
 * the contract declares them — after ajv has coerced, defaulted and refused.
 * `limit` is not optional here because the schema carries `default: 50`, so a
 * request that omits it arrives with it.
 */
interface ResidueQuery {
  readonly cursor?: string
  readonly limit: number
}

/**
 * The one 404 both operations answer, written once so the two cannot diverge
 * into two messages that tell a caller which of them it hit.
 *
 * ⚠️ THE `detail` IS A CONSTANT AND CARRIES NO RUN ID. `errors.yaml`: `detail`
 * *"MUST NOT contain field values, record contents or customer-authored
 * strings"* — and a run id echoed back would additionally confirm, for the
 * cross-tenant case, that the attacker's id was well formed enough to reach a
 * handler.
 */
const NO_ACCOUNT_DETAIL = 'No engine account for that run is visible to this session.'

const getRunAccountBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const read = await readRunEngineAccount(tx, runIdOf(request))

  if (read.kind === 'no_account') {
    return sendProblem(reply, {
      status: 404,
      code: CODES.resourceNotFound,
      title: 'No such run account.',
      detail: NO_ACCOUNT_DETAIL,
    })
  }
  if (read.kind === 'unpublishable') return unpublishable(reply, read.defect)

  /**
   * ⚠️ RETURNED VERBATIM, AND THE ABSENCE OF A TRANSFORMATION HERE IS THE
   * POINT. The store already produces the wire shape `RunEngineAccount`'s
   * produced arm declares — *"a TypeScript restatement of `RunEngineAccount`
   * here would be a SECOND declaration of the response, and the one nothing
   * checks"* — and `fast-json-stringify` SERIALISES against the response
   * schema without validating against it, so a reshaping step in this file
   * could drop a required channel and nothing downstream would say so.
   * `tests/db/run-engine-account.test.ts` asserts the key set as a whole for
   * exactly that reason.
   */
  return read.account
}

const listRunResidueBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const query = request.query as ResidueQuery

  const after = query.cursor === undefined ? null : decodeResidueCursor(query.cursor)
  if (query.cursor !== undefined && after === null) {
    /* An unreadable cursor is not a 500 and not an empty page: it is a request
     * that does not satisfy the contract, and `listRuns` already answers the
     * identical shape for the identical reason. */
    return sendProblem(reply, {
      status: 400,
      code: CODES.validationFailed,
      title: 'The cursor is not one this plane issued.',
    })
  }

  const read = await readRunResiduePage(tx, runIdOf(request), { after, limit: query.limit })

  /**
   * 🛑 `no_account` IS A 404 AND NOT AN EMPTY PAGE, WHICH IS THE WHOLE REASON
   * THE STORE CONSULTS THE ENVELOPE BEFORE IT READS A ROW. *"A run with no
   * engine account and a run whose residue is empty both produce zero rows from
   * the table below. The first means nothing reconciled this run; the second
   * means the engine closed everything. Answering `{items: [], nextCursor:
   * null}` to both would report a clean close for a run nobody ran."* An empty
   * page is a real answer here and it means the engine left no residue.
   */
  if (read.kind === 'no_account') {
    return sendProblem(reply, {
      status: 404,
      code: CODES.resourceNotFound,
      title: 'No such run account.',
      detail: NO_ACCOUNT_DETAIL,
    })
  }
  if (read.kind === 'unpublishable') return unpublishable(reply, read.defect)

  return { items: read.items, nextCursor: read.nextCursor }
}

/* ------------------------------------------------------------------ *
 * THE TWO OPERATIONS, AS G301 REQUIRES THEM: A CAPABILITY, A RESOURCE, A BODY.
 *
 * 🛑 THE CAPABILITY IS TAKEN FROM `CAPABILITIES`, NOT WRITTEN AS A STRING, so a
 * capability the model retires is a compile error here rather than a 403 nobody
 * can explain. It must equal the `x-capability` the contract annotates — both
 * are `admit_source`, the same verb `listRuns` and `getRun` already carry —
 * and the two are joined by nothing but a test:
 * `tests/http/authorisation-record.test.ts` §3 asserts the agreement, and it
 * gains a case per operation in the commit that mounts one.
 *
 * ⚠️ `resourceType` IS `'Run'` ON BOTH, NOT `'RunEngineAccount'` AND NOT
 * `'ResidueEntry'`, AND THE CHOICE IS ARGUED RATHER THAN COPIED. `ResourceRef`
 * wants the ENTITY name — *"'Exception', 'SourceDocument', 'Solution'. Never
 * parsed."* — and the account is not an entity: it has no id of its own, it is
 * keyed by `run_id`, and `redeemAuthorization()` binds a grant to a RESOURCE so
 * that *"an authorisation to view ONE document"* cannot read a corpus. The
 * thing being reached here is one run, and naming it anything else would make
 * two grants over the same act unjoinable in the audit.
 * ------------------------------------------------------------------ */

/** One run's account of itself. The instance is the run, stored verbatim. */
export const getRunAccountOperation: AuthorisedOperation = {
  operationId: 'getRunAccount',
  resourceType: 'Run',
  instanceOf: (request) => runIdOf(request),
  body: getRunAccountBody,
}

/**
 * One run's residue, paged.
 *
 * ⚠️ `instanceOf` IS THE RUN AND NOT `null`, WHICH IS THE OPPOSITE OF
 * `listRuns` AND IS NOT AN INCONSISTENCY. `ResourceRef.resourceId`'s own
 * example for a null is *"opening a list"* — a list of every run there is,
 * which is genuinely not instance-bound. This is a list OF ONE RUN's rows, and
 * the act is bounded by that run; recording `null` would say the caller was
 * authorised to open every residue in the tenant, which is a wider act than the
 * one that happened. **An audit record that overstates a grant is worse than
 * none, because it reads as evidence.**
 */
export const listRunResidueOperation: AuthorisedOperation = {
  operationId: 'listRunResidue',
  resourceType: 'Run',
  instanceOf: (request) => runIdOf(request),
  body: listRunResidueBody,
}

/* ------------------------------------------------------------------ *
 * R13 — `listRunAllocations`. G2374, 1 Oct 2026.
 *
 * `listRunResidue`'s shape, for `listRunResidue`'s reasons: an unreadable
 * cursor is a 400, a run with no engine account is a 404 and never an empty
 * page, and the store's answer is returned verbatim because it already IS the
 * wire shape. What it publishes is ids and amounts and nothing that came out
 * of a payload — the owner's ruling, held by absence in `0260`.
 * ------------------------------------------------------------------ */

const listRunAllocationsBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const query = request.query as ResidueQuery

  const after = query.cursor === undefined ? null : decodeResidueCursor(query.cursor)
  if (query.cursor !== undefined && after === null) {
    return sendProblem(reply, {
      status: 400,
      code: CODES.validationFailed,
      title: 'The cursor is not one this plane issued.',
    })
  }

  const read = await readRunAllocationPage(tx, runIdOf(request), { after, limit: query.limit })
  if (read.kind === 'no_account') {
    return sendProblem(reply, {
      status: 404,
      code: CODES.resourceNotFound,
      title: 'No such run account.',
      detail: NO_ACCOUNT_DETAIL,
    })
  }
  if (read.kind === 'unpublishable') return unpublishable(reply, read.defect)

  return { items: read.items, nextCursor: read.nextCursor }
}

export const listRunAllocationsOperation: AuthorisedOperation = {
  operationId: 'listRunAllocations',
  resourceType: 'Run',
  instanceOf: (request) => runIdOf(request),
  body: listRunAllocationsBody,
}

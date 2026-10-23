/**
 * THE OPERATOR SURFACE, MOUNTED — the pack's **C3 · Triage the register** and
 * **C4 · Resolve an exception**, which `docs/build/deploy-handoff.md` §5a calls
 * *"the product's actual operator surface"*. G318's second wave.
 *
 * FIVE OPERATIONS, ALL ON THE CAPABILITY TIER — ⚠️ **THIS SAID FOUR UNTIL
 * 20 Sep 2026, when `reverseResolution` was mounted under G946–G950 and the
 * refusal three screens down was discharged**:
 *
 *   `GET /exceptions`                          `listExceptions`      view_exception
 *   `GET /exceptions/facets`                   `getExceptionFacets`  view_exception
 *   `GET /exceptions/{exceptionId}`            `getException`        view_exception
 *   `PUT /exceptions/{exceptionId}/assignment` `assignException`     assign_exception
 *   `POST /exceptions/{exceptionId}/reversals` `reverseResolution`   reverse_resolution
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE MOUNTS RATHER THAN BUILDS. THE BODIES ARE IN
 *    `server/data-plane/exception-store.ts`, WHICH IS WHY IT IS SHORT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `run-account.ts` set the shape and this follows it: a route reads validated
 * parameters, calls one store function with the transaction the mint opened,
 * and turns its answers into status codes. **Every question about what a
 * column HOLDS is settled in `db/migrations/0015_exception_register.sql`, every
 * question about what a VALUE may be is settled in
 * `server/data-plane/exception-vocabulary.ts`, and no SQL is written here.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G300's THREE-PART TEST, DERIVED PER OPERATION AND NOT ASSERTED.
 *    *"A table alone is the trap … Derive each; do not assert readiness."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   TABLE       `grep -c '^CREATE TABLE tenant\.exception' db/migrations/0015_exception_register.sql`
 *               → 3 — `exception`, `exception_observed_value`,
 *               `exception_reversal`. **They did not exist before this wave**:
 *               `git show origin/main:db/migrations/ | grep -ci exception` over
 *               0001–0012 returns 0 tables. `tests/db/exception-register.test.ts`
 *               drives all three over a real PostgreSQL, including the
 *               RLS-disabled leak control that tells database isolation from a
 *               handler's `WHERE`.
 *   MODEL       `grep -n 'export interface Exception \|export type ExceptionStatus\|export interface Explanation\|export type ReversalReason' model/domain.ts`
 *               → four declarations, all live and none `@dropped-for-v1`.
 *               `server/data-plane/exception-vocabulary.ts` DERIVES every
 *               narrowing predicate from them rather than transcribing one
 *               beside them, and `reversalIndictsAutonomy()` is CALLED rather
 *               than restated.
 *   CAPABILITY  `grep -A2 'operationId: listExceptions' docs/contracts/capability.openapi.yaml`
 *               → `x-capability: view_exception`; `assignException` →
 *               `assign_exception`. Both are members of the closed set
 *               `model/access.ts` declares — `grep -n "viewException:\|assignException:" model/access.ts`
 *               — and both are verbs `tenant.role_capability` can carry, which
 *               is the half that matters: `tests/http/exception-served.test.ts`
 *               §1 is a 200 through a role holding exactly `view_exception`.
 *
 * ⚠️ AND THE FREEZE IS NOT THEREBY SPENT. G300 lifts it **per operation**.
 * Roughly a hundred declared operations still have no table and keep the
 * router's honest 404 — *"the OpenAPI documents are the router. A path they do
 * not declare is not a route."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ THE FIFTH C6 OPERATION IS MOUNTED — G946–G950, 20 Sep 2026 — AND THE
 *    REFUSAL BELOW IS CORRECTED RATHER THAN DELETED, because it is the
 *    sentence four files carried and the one a reader would have quoted
 *    onward.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Its premise was true when written and is false now.** *"There is nothing
 * to reverse"* stopped holding on 19 Sep 2026, when G658's `executeProposal`
 * became able to write `resolution_*`; `tests/db/resolution-chain.test.ts` §10
 * was armed on exactly that and asserted the SECOND obstacle — the privileges
 * — so that *"a later reader cannot mistake one removed obstacle for none."*
 * `db/migrations/0140_reversal_write_and_mix_pins.sql` removes the second, in
 * the same commit as the writer, which is G511's *"the fence and the writer
 * are one commit or neither."*
 *
 * G300's three parts for it, DERIVED rather than asserted:
 *
 *   TABLE       `tenant.exception_reversal` (`0015` §3) **plus `0140` §1's
 *               `GRANT INSERT` and §2's three pins**. Derive the half that was
 *               missing: `grep -c 'GRANT INSERT ON tenant.exception_reversal' db/migrations/*.sql`
 *               → 1, and it is `0140`. Before it, `grep -n 'tenant.exception_reversal'
 *               db/migrations/0015_exception_register.sql` showed `GRANT
 *               SELECT` alone, so the happy path answered **500, not 409** —
 *               which is why the operation could pass G300 on its face and
 *               still not be mountable.
 *   MODEL       `grep -n 'export interface ExceptionReversal\|export type ReversalReason\|export function reversalIndictsAutonomy' model/domain.ts`
 *               → three declarations, all live and none `@dropped-for-v1`.
 *               `server/data-plane/exception-vocabulary.ts` DERIVES
 *               `isReversalReason()` from the model rather than transcribing
 *               it beside it.
 *   CAPABILITY  `grep -A2 'operationId: reverseResolution' docs/contracts/capability.openapi.yaml`
 *               → `x-capability: reverse_resolution`, a member of the closed
 *               set — `grep -n 'reverseResolution:' model/access.ts` — and a
 *               verb `tenant.role_capability` can carry.
 *
 * 🛑 AND A FOURTH THING, BECAUSE THE 409 IS STILL REACHABLE AND MUST BE: an
 * exception with no resolution answers `validation_failed` and not a 201.
 * **That is now a REAL refusal about a real row rather than the only answer
 * the operation had**, which is precisely the distinction G359 drew when it
 * declined to mount — *"a 409 indistinguishable from an unbuilt feature is the
 * same sentence"* as G300's 403. `tests/http/exception-reversal-served.test.ts`
 * §2 is the 409 and §3 is the 201, in one suite, so neither can be mistaken
 * for the other.
 *
 * ⚠️ THE ACT DOES NOT RE-RESOLVE. `correctedDispositionKey` is recorded on the
 * reversal and never written into `resolution_disposition_key`;
 * `reversal-store.ts` argues it and `0140` §4's trigger enforces it, because
 * undo-then-redo in one act is the laundering the contract refuses an agent
 * this operation for.
 *
 * 🛑 AND A FIFTH THING, 22 Sep 2026 — G1831, THE OWNER'S RULING: the 409 above
 * is not the only one. `reverseResolution` was SERVED with the pack's own
 * 24-hour undo window enforced NOWHERE — `docs/build/pack-tree-join.md`
 * (G1733). It is now `reversal-store.ts`'s `window_expired`, checked against
 * the DATABASE's clock, and `db/migrations/0210_reversal_window.sql`'s
 * restrictive policy independently, at the row.
 *
 * THE ORIGINAL REFUSAL FOLLOWS, UNCHANGED, AS THE HISTORY IT IS:
 *
 * `reverseResolution` passes all three parts — `tenant.exception_reversal`
 * exists, `ExceptionReversal`/`ReversalReason`/`reversalIndictsAutonomy()`
 * exist, and `reverse_resolution` is in `CAPABILITIES`. **It is still not
 * mounted, because a fourth thing is missing that G300 does not name and the
 * contract does: there is nothing to reverse.** Its 409 is *"there is no
 * resolution to reverse"*; a resolution arrives from `executeProposal`, which
 * needs a `proposal` table that does not exist, so every row this database can
 * produce has `resolution_mode IS NULL` and the operation's only reachable
 * answer is that 409.
 *
 * Mounting it anyway was considered and is refused on **G300's own argument,
 * read in the direction it points**: *"a 403 indistinguishable from an unbuilt
 * feature is worse than an honest 404 from the router."* A 409
 * indistinguishable from an unbuilt feature is the same sentence — the router's
 * 404 tells a caller something true, and a blanket 409 tells them something
 * false, that they asked wrongly.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 ALL FIVE ARE `AuthorisedOperation`s AND NONE IS A `Handler`. G301.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"AN OPERATION MAY NOT MOUNT UNTIL IT MINTS A RECORD."* `mountTier()`'s sixth
 * fence refuses to boot a gated operation whose entry is a bare handler, so
 * these five could not have been mounted any other way.
 *
 * ⚠️ AND ON `reverseResolution` THE RECORD IS LOAD-BEARING TWICE OVER RATHER
 *    THAN MERELY PRESENT: `0140` §3's restrictive policy reads
 *    `app.authorisation_ref` to pin `reversed_by` to the person the record
 *    names, and `0140` §4's trigger reads it again to admit the clearing
 *    UPDATE. **A reversal written without its record is not refused by this
 *    file — it is unrepresentable in the database.**
 *
 * **NO BODY TAKES A POOL.** Each is handed a `tx` that is already open, already
 * tenant-scoped, and already carries this act's authorisation record, written
 * one statement earlier by `server/data-plane/authorisation-record.ts` inside
 * the SAME transaction. A body therefore has no way to reach tenant data except
 * through the transaction the mint opened.
 *
 * ⚠️ AND `assignException` IS THE FIRST **WRITE** THIS PROPERTY HAS COVERED,
 *    WHICH MAKES IT STRONGER RATHER THAN THE SAME. On a read, a rolled-back act
 *    takes its record with it. On a write, the ACT and the RECORD commit
 *    together or neither does — so there is no assignment in this database that
 *    is not accompanied by the authorisation it ran under.
 *    `tests/http/exception-served.test.ts` §6 asserts both halves: the row
 *    changed, and `tenant.authorization_grant` grew by one in the same
 *    transaction.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 INVARIANT 1, AND THE FOUR-VECTOR TEST THESE OPERATIONS OWE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"Tenant scope is derived from the session, never read from a request."*
 * There is no `tenantId` on any of these signatures, no tenant predicate in any
 * statement `exception-store.ts` issues, and the tenant reaches the query only
 * through `withTenantScope()`'s `SET LOCAL`.
 *
 * ✅ **THE LIMITATION BELOW IS CLOSED — G941, 20 Sep 2026 — AND THE BLOCK IS
 *    CORRECTED RATHER THAN DELETED, because it is the paragraph two other
 *    handler files and `docs/HANDOFF.md` §8 were written from.** A
 *    parameter-free operation now gets `{type:'object', properties:{},
 *    additionalProperties:false}` on its query string, so **all four of these
 *    operations refuse a smuggled `?tenantId=` with a 400**, not two of four.
 *    ⚠️ **THE MEASUREMENT BELOW WAS RIGHT AND ITS SCOPE WAS UNDERSTATED
 *    EVERYWHERE**: the hole covered **122 of 136** declared operations, and
 *    `tests/http/parameter-free-querystring.test.ts` carries that as its
 *    captured red. **`tests/http/exception-served.test.ts` §3 NEEDED NO
 *    EDIT** — its `if (res.status !== 200) continue` absorbed the change
 *    exactly as its own note predicted, which is why that shape was chosen.
 *    THE ORIGINAL FOLLOWS, UNCHANGED.
 *
 * ⚠️ AND A LIMITATION FOUND ON 19 Sep 2026 AND **NOT** FIXED HERE, BECAUSE
 *    FIXING IT IS A RULING NOBODY HAS TAKEN. An operation declaring **no**
 *    query parameter gets **no querystring schema at all** —
 *    `schemaFromParameters()` returns `undefined` when it finds no `in: query`
 *    parameter — so `?tenantId=…` against such an operation is **IGNORED rather
 *    than REFUSED**. Invariant 1 still holds (nothing reads it), but *ignored
 *    and read look identical from outside*, which is the exact objection
 *    `server/http/app.ts` raises against `removeAdditional: true`.
 *
 *    **Two of these four operations are affected and two are not.**
 *    `listExceptions` and `getExceptionFacets` declare query parameters, so
 *    they get `additionalProperties: false` and a smuggled `?tenantId=`
 *    is a 400. `getException` and `assignException` declare only a PATH
 *    parameter, so both are in the ignoring class. `tests/http/exception-served.test.ts`
 *    §3 asserts the four vectors — header, cookie, query and path — **and
 *    asserts the ANSWER DOES NOT MOVE** rather than asserting a status, which
 *    is the assertion that stays true whichever way the ruling goes.
 */

import type { FastifyRequest } from 'fastify'

import type { ReversalReason } from '../../model/domain.ts'
import type { Timestamp } from '../../model/kernel.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import { actingTenantOf, type AuthorisedBody, type AuthorisedOperation } from './authorisation-record.ts'
import {
  assigneeIsLiveMember,
  assignExceptionTo,
  readException,
  readExceptionFacets,
  readExceptionQueuePage,
  type ExceptionRead,
  type ExceptionDefect,
} from './exception-store.ts'
import { isExceptionSort, type ExceptionSort } from './exception-vocabulary.ts'
import { reverseResolutionOf } from './reversal-store.ts'

/**
 * `components.parameters.ExceptionId` — `in: path`, `required: true`. Read once
 * and used twice, for `runs.ts`'s reason: the body needs the id to read on and
 * `instanceOf` needs it to name the `ResourceRef` the authorisation is minted
 * against, and *"the one that drifted silently would be the AUDIT record rather
 * than the query — which is the worse direction."*
 */
function exceptionIdOf(request: FastifyRequest): string {
  return (request.params as { exceptionId: string }).exceptionId
}

/**
 * The store could not publish a row. A 500, logged with the COLUMN and never
 * with the cell — `runs.ts`'s `unpublishable()` one surface over, and written
 * separately rather than shared because that one's message says *"run"* and a
 * message that said the wrong noun would send somebody to the wrong table.
 */
function unpublishableException(reply: Parameters<AuthorisedBody>[0]['reply'], why: ExceptionDefect) {
  console.error(
    `data-plane: \`${why.table}\` row for exception \`${why.exceptionId}\` carries a ` +
      `\`${why.column}\` that is not in the domain model’s vocabulary; the row was not published.`,
  )
  return sendProblem(reply, {
    status: 500,
    code: CODES.upstreamUnavailable,
    title: 'The request could not be completed.',
    detail:
      'A stored exception carries a value the domain model does not define. It was not published.',
  })
}

/**
 * The one 404 all three instance-bound operations answer, written once so they
 * cannot diverge into three messages that tell a caller which they hit.
 *
 * ⚠️ THE `detail` IS A CONSTANT AND CARRIES NO EXCEPTION ID. `errors.yaml`:
 * `detail` *"MUST NOT contain field values, record contents or customer-authored
 * strings"* — and an id echoed back would additionally confirm, for the
 * cross-tenant case, that the attacker's id was well formed enough to reach a
 * handler.
 */
const NO_EXCEPTION_DETAIL = 'No exception with that id is visible to this session.'

/** Turn the store's three answers into three status codes. One place, four callers. */
function respond(read: ExceptionRead, reply: Parameters<AuthorisedBody>[0]['reply']): unknown {
  if (read.kind === 'not_found') {
    return sendProblem(reply, {
      status: 404,
      code: CODES.resourceNotFound,
      title: 'No such exception.',
      detail: NO_EXCEPTION_DETAIL,
    })
  }
  if (read.kind === 'unpublishable') return unpublishableException(reply, read.defect)
  return read.exception
}

/* ------------------------------------------------------------------ *
 * `listExceptions` — the queue. The product's home screen.
 * ------------------------------------------------------------------ */

/**
 * The querystring AFTER ajv has coerced, defaulted and refused.
 *
 * ⚠️ `sort` AND `limit` ARE NOT OPTIONAL HERE BECAUSE THE SCHEMA CARRIES
 *    `default:` FOR BOTH and `useDefaults: true` is on — so a request that
 *    omits them arrives with them. Restating either default in this file would
 *    be a second place for it to drift, which is the reason
 *    `frontend/src/api/runs.ts` declines to SEND one.
 *
 * ⚠️ EVERY ARRAY MEMBER ARRIVES AS AN ARRAY EVEN FOR ONE VALUE, because
 *    `AJV_OPTIONS.coerceTypes` is `'array'`. A handler that special-cased the
 *    scalar would be handling a case ajv has already removed.
 */
interface ListExceptionsQuery {
  readonly domain?: readonly string[]
  readonly definitionId?: readonly string[]
  readonly ruleLabel?: readonly string[]
  readonly severity?: readonly string[]
  readonly status?: readonly string[]
  readonly assignedTo?: string
  readonly unassignedOnly?: boolean
  readonly mineOrUnassigned?: boolean
  readonly valueAtRiskAtLeastMinor?: string
  readonly currency?: string
  readonly raisedFrom?: string
  readonly raisedTo?: string
  readonly carriedForwardOnly?: boolean
  /** G3622 — `db/migrations/0480`. */
  readonly runId?: readonly string[]
  readonly periodId?: readonly string[]
  readonly sort: string
  readonly cursor?: string
  readonly limit: number
}

const listExceptionsBody: AuthorisedBody = async ({ request, reply, tx, principal }) => {
  const query = request.query as ListExceptionsQuery

  /**
   * 🛑 THE CONTRACT'S `enum` HAS ALREADY ADMITTED THIS VALUE AND THE GUARD RUNS
   *    ANYWAY. The alternative is a `switch` with a `default`, and a register
   *    showing the wrong page ORDER looks exactly like a register showing the
   *    right one — there is no symptom. A throw here would be honest too; a
   *    422 is chosen because the contract declares that status on this
   *    operation and because the only way to reach this line is a request the
   *    schema and this file disagree about, which is a request problem from the
   *    caller's side whichever component is wrong.
   */
  if (!isExceptionSort(query.sort)) {
    return sendProblem(reply, {
      status: 422,
      code: CODES.validationFailed,
      title: 'That is not one of the four orderings this queue supports.',
    })
  }
  const sort: ExceptionSort = query.sort

  /**
   * ⚠️ TWO CROSS-FIELD RULES THE SCHEMA CANNOT STATE, AND THE CONTRACT NAMES
   *    BOTH IN PROSE. OpenAPI 3.1 could express them with `dependentRequired`
   *    and `not`, and the document does not; restating them as ajv keywords
   *    HERE would put the rule in the code rather than in the contract, which
   *    is the direction `server/contract/` exists to prevent. They are enforced
   *    at the one place that can see both fields, and the contract's own 422
   *    description names the first: *"e.g. a value threshold without a
   *    currency."*
   */
  if (query.valueAtRiskAtLeastMinor !== undefined && query.currency === undefined) {
    return sendProblem(reply, {
      status: 422,
      code: CODES.validationFailed,
      title: 'A value-at-risk threshold requires a currency.',
      detail:
        'A bare amount compared across mixed currencies reports a variance that is not one. ' +
        'Send `currency` with `valueAtRiskAtLeastMinor`.',
    })
  }
  const conflict = assigneeTermsConflict(query)
  if (conflict !== null) return sendProblem(reply, conflict)

  const read = await readExceptionQueuePage(
    tx,
    {
      ...(query.domain === undefined ? {} : { domain: query.domain }),
      ...(query.definitionId === undefined ? {} : { definitionId: query.definitionId }),
      ...(query.ruleLabel === undefined ? {} : { ruleLabel: query.ruleLabel }),
      ...(query.severity === undefined ? {} : { severity: query.severity }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.assignedTo === undefined ? {} : { assignedTo: query.assignedTo }),
      ...(query.unassignedOnly === undefined ? {} : { unassignedOnly: query.unassignedOnly }),
      ...(query.mineOrUnassigned === true ? { mineOrUnassignedFor: principal.subject.userId } : {}),
      ...(query.valueAtRiskAtLeastMinor === undefined
        ? {}
        : { valueAtRiskAtLeastMinor: query.valueAtRiskAtLeastMinor }),
      ...(query.currency === undefined ? {} : { currency: query.currency }),
      ...(query.raisedFrom === undefined ? {} : { raisedFrom: query.raisedFrom }),
      ...(query.raisedTo === undefined ? {} : { raisedTo: query.raisedTo }),
      ...(query.carriedForwardOnly === undefined
        ? {}
        : { carriedForwardOnly: query.carriedForwardOnly }),
      ...(query.runId === undefined ? {} : { runId: query.runId }),
      ...(query.periodId === undefined ? {} : { periodId: query.periodId }),
    },
    { cursor: query.cursor, limit: query.limit, sort },
  )

  /**
   * ⚠️ A 422 AND NOT `listRuns`'s 400, AND THE DIFFERENCE IS THE CONTRACT
   *    RATHER THAN A PREFERENCE. `listRuns` declares only 200 and 403 and
   *    answers 400 for an unreadable cursor, which is an undeclared status;
   *    `listExceptions` DECLARES 422 for `validation_failed`, so the same
   *    condition gets the status its own operation publishes. **The two
   *    operations therefore answer differently for the identical fault**, which
   *    is worth writing down rather than letting a reader discover: the fix is
   *    a 422 on `listRuns` or a 400 declared on both, and either is a contract
   *    change nobody has ruled.
   */
  if (read.kind === 'bad_cursor') {
    return sendProblem(reply, {
      status: 422,
      code: CODES.validationFailed,
      title: 'The cursor is not one this plane issued for this ordering.',
      detail:
        'A cursor is a position in one ordering. Applied to another it silently skips rows, ' +
        'so it is refused rather than honoured.',
    })
  }
  if (read.kind === 'unpublishable') return unpublishableException(reply, read.defect)

  return { items: read.items, nextCursor: read.nextCursor, estimatedTotal: read.estimatedTotal }
}

/* ------------------------------------------------------------------ *
 * `getExceptionFacets` — the values the filters can legally take.
 * ------------------------------------------------------------------ */

/**
 * G3424 — the assignee terms, and the one cross-field rule they share. Two of
 * them were mutually exclusive already; `mineOrUnassigned` is a THIRD way to
 * say whose rows, so any two together is the same 422 for the same reason —
 * the request asks two different questions and answering either silently
 * answers the wrong one.
 */
interface AssigneeTerms {
  readonly assignedTo?: string
  readonly unassignedOnly?: boolean
  readonly mineOrUnassigned?: boolean
}
function assigneeTermsConflict(q: AssigneeTerms): Parameters<typeof sendProblem>[1] | null {
  const terms = [q.assignedTo !== undefined, q.unassignedOnly === true, q.mineOrUnassigned === true]
  if (terms.filter(Boolean).length < 2) return null
  return {
    status: 422,
    code: CODES.validationFailed,
    title: '`assignedTo`, `unassignedOnly` and `mineOrUnassigned` are mutually exclusive.',
  }
}

const getExceptionFacetsBody: AuthorisedBody = async ({ request, reply, tx, principal }) => {
  const query = request.query as {
    readonly status?: readonly string[]
    readonly definitionId?: readonly string[]
    readonly runId?: readonly string[]
    readonly periodId?: readonly string[]
  } & AssigneeTerms
  const conflict = assigneeTermsConflict(query)
  if (conflict !== null) return sendProblem(reply, conflict)
  /* 🛑 `mineOrUnassigned` IS A BOOLEAN ON THE WIRE AND THE USER IT MEANS IS
     THE SEAM'S OWN PRINCIPAL — never a value the caller can name. */
  const read = await readExceptionFacets(tx, query.status, {
    ...(query.definitionId === undefined ? {} : { definitionId: query.definitionId }),
    ...(query.assignedTo === undefined ? {} : { assignedTo: query.assignedTo }),
    ...(query.unassignedOnly === undefined ? {} : { unassignedOnly: query.unassignedOnly }),
    ...(query.mineOrUnassigned === true ? { mineOrUnassignedFor: principal.subject.userId } : {}),
    ...(query.runId === undefined ? {} : { runId: query.runId }),
    ...(query.periodId === undefined ? {} : { periodId: query.periodId }),
  })
  if (read.kind === 'unpublishable') return unpublishableException(reply, read.defect)
  return read.facets
}

/* ------------------------------------------------------------------ *
 * `getException` — one exception, with the explanation that justifies it.
 * ------------------------------------------------------------------ */

const getExceptionBody: AuthorisedBody = async ({ request, reply, tx }) =>
  respond(await readException(tx, exceptionIdOf(request)), reply)

/* ------------------------------------------------------------------ *
 * `assignException` — assign, or clear the assignment.
 * ------------------------------------------------------------------ */

const assignExceptionBody: AuthorisedBody = async ({ request, reply, tx, grant }) => {
  /**
   * 🛑 `assignedTo` IS `required` AND NULLABLE, SO `null` IS A VALUE AND NOT AN
   *    OMISSION. *"Assigning to null unassigns."* `body.assignedTo` is read
   *    directly rather than through a `?? null`, because the coalescing
   *    spelling makes a MISSING key and an explicit `null` the same request —
   *    and ajv has already refused the missing one.
   */
  const body = request.body as { readonly assignedTo: string | null }
  /**
   * 🛑 G3426 — THE ASSIGNEE MUST BE A LIVE MEMBER OF THIS TENANT. A client sent
   *    the literal `'me'` and the plane stored it (RC-14). See
   *    `exception-store.ts` §8a for why `tenant.membership` can answer this when
   *    `tenant."user"` could not. Null skips the check: unassigning names nobody.
   */
  if (body.assignedTo !== null) {
    const member = await assigneeIsLiveMember(
      tx,
      actingTenantOf(grant),
      body.assignedTo,
      new Date().toISOString(),
    )
    if (!member) {
      return sendProblem(reply, {
        status: 422,
        code: CODES.validationFailed,
        title: 'That person is not a member of this tenant.',
        detail:
          '`assignedTo` must name a person who holds a live membership in this tenant. ' +
          'Assign to yourself with your own user id; assigning to null unassigns.',
      })
    }
  }
  return respond(await assignExceptionTo(tx, exceptionIdOf(request), body.assignedTo), reply)
}

/* ------------------------------------------------------------------ *
 * `reverseResolution` — undoing one, with a closed reason and a signature.
 * ------------------------------------------------------------------ */

const reverseResolutionBody: AuthorisedBody = async (ctx) => {
  const { request, reply, tx } = ctx
  /**
   * 🛑 `reason` AND `newStatus` ARE `required` ON THE WIRE AND `note` AND
   *    `correctedDispositionKey` ARE OPTIONAL AND NULLABLE, so `?? null` is
   *    the CORRECT spelling for those two and would be lossy for the first
   *    two. `assignException` records the opposite case one function up —
   *    there, `assignedTo` is `required` and nullable, so `null` is a VALUE
   *    and the coalescing spelling would collapse it with an omission ajv has
   *    already refused. **The two rules differ because the two schemas do.**
   *
   * ⚠️ `reason` IS TAKEN AS A `ReversalReason` WITHOUT A GUARD HERE AND THAT
   *    IS THE ONE PLACE IN THIS FILE THAT LEANS ON AJV. The contract's
   *    `ReversalReason` is a closed `enum` and `server/http/app.ts` validates
   *    the body BEFORE a handler runs, with `removeAdditional: false` — so an
   *    unlisted reason is a 400 and never reaches this line.
   *    `tests/contracts/` joins that enum to the model's union, which is what
   *    makes the cast a derivation rather than a hope.
   */
  const body = request.body as {
    readonly reason: ReversalReason
    readonly newStatus: string
    readonly note?: string | null
    readonly correctedDispositionKey?: string | null
  }

  const result = await reverseResolutionOf(
    tx,
    exceptionIdOf(request),
    {
      reason: body.reason,
      newStatus: body.newStatus,
      note: body.note ?? null,
      correctedDispositionKey: body.correctedDispositionKey ?? null,
    },
    {
      /* 🛑 `ctx.principal`, WHICH IS THE SEAM'S OWN OBJECT AND NOT A SECOND
         RESOLUTION — `proposals.ts`'s `actorOf()` argues it at length, and
         `0140` §3 is why it cannot be faked: the row's `reversed_by` is
         compared against the authorisation record's own subject. */
      userId: ctx.principal.subject.userId,
      now: new Date().toISOString() as Timestamp,
    },
  )

  if (result.kind === 'not_found') {
    return sendProblem(reply, {
      status: 404,
      code: CODES.resourceNotFound,
      title: 'No such exception.',
      detail: NO_EXCEPTION_DETAIL,
    })
  }
  if (result.kind === 'no_resolution') {
    /* 🛑 409 AND NOT 422, BECAUSE THE CONTRACT SAYS SO AND SAYS WHY:
       *"`validation_failed` — there is no resolution to reverse. Reversing an
       unresolved exception is a client bug, not a workflow."* The CALLER is
       permitted — `decide()` allowed the verb — and the THING is not in a
       state to be undone, which is `model/approval.ts`'s own rule for the
       difference between a 403 and a 409. */
    return sendProblem(reply, {
      status: 409,
      code: CODES.validationFailed,
      title: 'There is no resolution to reverse.',
      detail:
        'This exception is not resolved. Reversing an unresolved exception is a client bug, ' +
        'not a workflow.',
    })
  }
  if (result.kind === 'window_expired') {
    /**
     * 🛑 409, ALONGSIDE `no_resolution` AND FOR THE SAME REASON: THE CALLER IS
     *    PERMITTED AND THE THING IS NOT (NO LONGER) IN A STATE TO BE UNDONE.
     *    **THE OWNER'S RULING, 22 Sep 2026 — G1831**, matching the pack's own
     *    posted-entry copy: *"reversible for 24 hours from the post … After
     *    that a correction is a new entry with its own approval, which is the
     *    point: an unlimited undo is not an audit trail."*
     */
    return sendProblem(reply, {
      status: 409,
      code: CODES.reversalWindowExpired,
      title: 'The reversal window has closed.',
      detail:
        'A resolution is reversible for a limited time after it was recorded. Past that, a ' +
        'correction is a new entry with its own approval — an unlimited undo is not an audit ' +
        'trail.',
    })
  }
  if (result.kind === 'disposition_not_offered') {
    return sendProblem(reply, {
      status: 422,
      code: CODES.dispositionNotOffered,
      title: 'That disposition is not offered for this exception.',
      detail:
        'A correction is validated against the same closed list as a proposal. There is no ' +
        'free-text fallback and there will not be one.',
    })
  }
  if (result.kind === 'unpublishable') return unpublishableException(reply, result.defect)

  /* 🛑 201 AND NOT 200. The contract declares `'201'` on this operation, and it
     is the only one in this file that creates an addressable thing — a new
     `ExceptionReversal` at the next ordinal. `proposals.ts` makes the same
     distinction for `proposeResolution`. */
  reply.code(201)
  return result.exception
}

/* ------------------------------------------------------------------ *
 * THE FIVE OPERATIONS, AS G301 REQUIRES THEM: A CAPABILITY, A RESOURCE, A BODY.
 *
 * 🛑 THE CAPABILITY IS TAKEN FROM `CAPABILITIES`, NOT WRITTEN AS A STRING, so a
 * capability the model retires is a compile error here rather than a 403 nobody
 * can explain. Each must equal the `x-capability` the contract annotates, and
 * the two are joined by nothing but a test:
 * `tests/http/authorisation-record.test.ts` §3 asserts the agreement and gains
 * a case per operation in the commit that mounts one.
 *
 * ⚠️ `resourceType` IS `'Exception'` ON ALL FOUR, AND IT IS THE NAME
 * `ResourceRef`'s OWN DOCBLOCK USES AS ITS FIRST EXAMPLE — *"Entity name:
 * 'Exception', 'SourceDocument', 'Solution'. Never parsed."* That is a happier
 * accident than it looks: `run-account.ts` had to ARGUE its way to `'Run'`
 * because a run account is not an entity. An exception is one, with an id of
 * its own.
 * ------------------------------------------------------------------ */

/**
 * The queue.
 *
 * ⚠️ `instanceOf` IS `null`, AND IT IS `listRuns`'s CASE RATHER THAN
 * `listRunResidue`'s. `ResourceRef.resourceId`'s own example for a null is
 * *"opening a list"* — and this is genuinely a list of every exception the
 * session can reach, not a list bounded by some parent row. Recording an id
 * here would understate the act; recording null on `listRunResidue` would have
 * overstated one. **The two nulls differ and the difference is which way an
 * audit record would be wrong.**
 */
export const listExceptionsOperation: AuthorisedOperation = {
  operationId: 'listExceptions',
  resourceType: 'Exception',
  instanceOf: () => null,
  body: listExceptionsBody,
}

/**
 * The facet counts.
 *
 * ⚠️ `instanceOf` IS `null` FOR THE SAME REASON, AND THE CONTRACT ADDS ONE:
 * *"Counts respect the caller's scope, and therefore differ between users. A
 * facet count is not a tenant statistic."* An aggregate over the reachable set
 * is not bound to any instance in it.
 */
export const getExceptionFacetsOperation: AuthorisedOperation = {
  operationId: 'getExceptionFacets',
  resourceType: 'Exception',
  instanceOf: () => null,
  body: getExceptionFacetsBody,
}

/** One exception and its explanation. The instance is the exception. */
export const getExceptionOperation: AuthorisedOperation = {
  operationId: 'getException',
  resourceType: 'Exception',
  instanceOf: (request) => exceptionIdOf(request),
  body: getExceptionBody,
}

/**
 * Taking a row, or putting it down.
 *
 * 🛑 `assign_exception` AND NOT `view_exception`, WHICH IS THE WHOLE REASON
 * THIS OPERATION IS MOUNTED SEPARATELY FROM THE THREE READS. The contract
 * annotates a different verb and `model/access.ts` gives it a different
 * stakeholder set — `view_exception` reaches `['viewer','operator','approver',
 * 'tenant_admin']` and `assign_exception` reaches `['operator']` alone. A
 * VIEWER can read this queue and cannot take a row off it, and that difference
 * is enforced by `decide()` rather than by this file.
 * `tests/http/exception-served.test.ts` §5 witnesses it: the same session,
 * holding only `view_exception`, gets 200 on the read and 403 on the write.
 */
export const assignExceptionOperation: AuthorisedOperation = {
  operationId: 'assignException',
  resourceType: 'Exception',
  instanceOf: (request) => exceptionIdOf(request),
  body: assignExceptionBody,
}

/**
 * Undoing a resolution.
 *
 * 🛑 `reverse_resolution` IS ITS OWN VERB AND IS NOT `execute_resolution`, AND
 * THE SEPARATION IS THE CONTROL RATHER THAN A TAXONOMY. The contract refuses
 * an agent this operation outright — *"there is no agent path to this
 * operation, because an agent that can undo its own resolutions can launder a
 * bad one"* — and a single verb covering both making and unmaking would give
 * every executor that power by construction. `0140` §4 states the same
 * separation in SQL, in the direction that matters: a `reverse_resolution`
 * record may CLEAR a resolution and may not WRITE one.
 *
 * ⚠️ AND THE PERSON IS PINNED TWICE. `ExceptionReversal.reversedBy` is
 * *"Always a human. A reversal is a correction, and corrections are signed."*
 * The handler takes it from `ctx.principal` and never from the body — there is
 * no `reversedBy` field on the request schema to take it from — and `0140` §3
 * compares the stored value against the authorisation record this act minted,
 * so a rewritten handler that passed somebody else's id would have its INSERT
 * refused rather than its lie stored.
 */
export const reverseResolutionOperation: AuthorisedOperation = {
  operationId: 'reverseResolution',
  resourceType: 'Exception',
  instanceOf: (request) => exceptionIdOf(request),
  body: reverseResolutionBody,
}

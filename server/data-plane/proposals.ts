/**
 * C4's OTHER HALF, MOUNTED — the pack's **C4 · Resolve an exception**, which
 * `server/data-plane/exceptions.ts` said in its own voice it had only half of:
 *
 *   *"C4 is half of C4. Accept/Reject/Park/Attach are all `proposeResolution`
 *    → `decideApproval` → `executeProposal`, and THERE IS NO `proposal`
 *    TABLE. What landed is C4's read plus its one reachable act (taking a
 *    row)."*
 *
 * G656–G660, 19 Sep 2026. SIX OPERATIONS, ALL ON THE CAPABILITY TIER:
 *
 *   `GET  /exceptions/{id}/dispositions`  `listAvailableDispositions`  view_exception
 *   `GET  /exceptions/{id}/proposals`     `listProposals`              view_exception
 *   `POST /exceptions/{id}/proposals`     `proposeResolution`          propose_resolution
 *   `GET  /proposals/{id}`                `getProposal`                view_exception
 *   `POST /proposals/{id}/approvals`      `decideApproval`             approve_resolution
 *   `POST /proposals/{id}/execution`      `executeProposal`            execute_resolution
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS FILE MOUNTS RATHER THAN BUILDS. THE BODIES ARE IN
 *    `server/data-plane/proposal-store.ts`, WHICH IS WHY IT IS SHORT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `run-account.ts` set the shape and `exceptions.ts` followed it: a route reads
 * validated parameters, calls one store function with the transaction the mint
 * opened, and turns its answers into status codes. **No SQL is written here,
 * and no policy is decided here.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 G300's THREE-PART TEST, DERIVED PER OPERATION AND NOT ASSERTED.
 *    *"A table alone is the trap … Derive each; do not assert readiness."*
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `listAvailableDispositions`
 *   TABLE       `tenant.definition_archetype` × `tenant.disposition`, both new
 *               in `db/migrations/0059_resolution_chain.sql`. Derive:
 *               `grep -c 'CREATE TABLE tenant.disposition' db/migrations/0059_resolution_chain.sql`
 *   MODEL       `Disposition`, `DISPOSITION_FAMILIES`, `REVERSIBILITY`,
 *               `ReconciliationArchetype` — derive:
 *               `grep -n 'export interface Disposition \|export const DISPOSITION_FAMILIES' model/domain.ts`
 *   CAPABILITY  `view_exception`. Derive:
 *               `grep -A2 'operationId: listAvailableDispositions' docs/contracts/capability.openapi.yaml`
 *
 * `listProposals` · `getProposal`
 *   TABLE       `tenant.resolution_proposal` × `tenant.proposal_evidence` ×
 *               `tenant.approval_decision`, all three new in `0059`.
 *   MODEL       `ResolutionProposal`, `ProposalEvidence`, `ProposalActor`,
 *               `ApprovalDecision` — derive:
 *               `grep -n 'export interface ResolutionProposal\|export interface ApprovalDecision' model/domain.ts`
 *   CAPABILITY  `view_exception`, the same verb the register's three reads
 *               carry. A proposal is a fact ABOUT an exception, and gating it
 *               behind a different verb would let a viewer read a finding and
 *               not the judgement somebody made about it.
 *
 * `proposeResolution`
 *   TABLE       `tenant.resolution_proposal` + `tenant.proposal_evidence`,
 *               with `GRANT INSERT` on both and `GRANT UPDATE
 *               (superseded_by_proposal_id)` on the first. Derive:
 *               `grep -c 'GRANT SELECT, INSERT' db/migrations/0059_resolution_chain.sql`
 *   MODEL       `ResolutionProposal` (above) plus the closed disposition set.
 *   CAPABILITY  `propose_resolution` — a member of `CAPABILITIES`, reachable
 *               by the `operator` stakeholder class and inside
 *               `PARTNER_CAPABILITY_MASK` under `exceptions_operate`. Derive:
 *               `grep -n 'proposeResolution:' model/access.ts`
 *
 * `decideApproval`
 *   TABLE       `tenant.approval_decision` + `tenant.approval_config`.
 *   MODEL       `ApprovalDecision`, `ApprovalConfig`, **and `model/approval.ts`
 *               — the evaluator that did not exist before this slice.**
 *               Derive: `grep -rln 'export function approvalState' model/`
 *   CAPABILITY  `approve_resolution` — reachable by `approver` alone, and
 *               `PARTNER_MASK_MEMBERSHIP.approve_resolution` is `[]` with the
 *               invariant stated on it: *"a partner may operate on a
 *               customer's exceptions and may never be the approving
 *               authority for them."*
 *
 * `executeProposal`
 *   TABLE       the above, plus `GRANT UPDATE` on SEVEN NAMED COLUMNS of
 *               `tenant.exception` and the trigger that fences them. Derive:
 *               `grep -c 'exception_resolution_requires_record' db/migrations/0059_resolution_chain.sql`
 *   MODEL       `ExceptionResolution` — and `model/money.ts` for the
 *               threshold, and `model/approval.ts` for the verdict.
 *   CAPABILITY  `execute_resolution`, DISTINCT from `propose_resolution`, and
 *               the separation is the autonomy design rather than tidiness:
 *               *"an agent may propose everywhere and execute only inside the
 *               ceiling."* Also `[]` in the partner mask — *"The one that
 *               moves money."*
 *
 * ⚠️ AND THE FREEZE IS NOT THEREBY SPENT. G300 lifts it **per operation**.
 * Most declared operations still have no table and keep the router's honest
 * 404 — *"the OpenAPI documents are the router. A path they do not declare is
 * not a route."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ `reverseResolution` IS MOUNTED SINCE 20 Sep 2026 — G946–G950 — AND THE
 *    BLOCK BELOW IS CORRECTED RATHER THAN DELETED, BECAUSE IT IS THE SENTENCE
 *    FIVE FILES CARRIED AND THE ONE THE NEXT SLICE WAS COMMISSIONED AGAINST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Both obstacles are closed and neither closed itself.** OBSTACLE 1 was this
 * slice's doing. OBSTACLE 2 — *"`tenant.exception_reversal` still has `GRANT
 * SELECT` only … mounting the operation today would still answer 500, not
 * 409"* — is `db/migrations/0140_reversal_write_and_mix_pins.sql` §1's, taken
 * in the same commit as `server/data-plane/reversal-store.ts`, which is G511's
 * *"the fence and the writer are one commit or neither"*. **The 500 was
 * witnessed first**, with §1 commented out: `permission denied for table
 * exception_reversal`, exactly as the paragraph below predicted.
 *
 * ⚠️ AND THE PARAGRAPH'S LAST SENTENCE — *"that is a slice, not a line"* —
 * turned out to understate it by one whole operation. The reversal CLEARS the
 * resolution, so `getDispositionMix`'s `count` and `reversalRate` both go
 * wrong the moment it mounts; `0140` §2's three pins and C11's report landed
 * with it. See G952.
 *
 * ⚠️ **`dispositionIsOffered()` IS EXPORTED FROM `proposal-store.ts` FOR THAT
 * OPERATION AND FOR NOTHING ELSE.** `correctedDispositionKey` is *"validated
 * against the same closed list as a proposal"*, and the same list means the
 * same code: a second `SELECT … FROM tenant.disposition` in the reversal store
 * would be §5.3, and the copy is what drifts.
 *
 * THE ORIGINAL BLOCK FOLLOWS, UNCHANGED, AS THE HISTORY IT IS:
 *
 * G359 gave one reason — *"nothing can produce a resolution, so its only
 * reachable answer is its own 409"* — and an adversarial pass then found that
 * **true but not binding**: the operation also had no privilege to write
 * anything, so mounting it would have answered **500, not 409**, and a later
 * reader would have believed one obstacle was removed when two remained.
 *
 *   OBSTACLE 1 · NOTHING PRODUCES A RESOLUTION.   ✅ **CLOSED BY THIS SLICE.**
 *     `executeProposal` writes `resolution_*`, so a row with
 *     `resolution_mode IS NOT NULL` is now reachable and the 409 is no longer
 *     the only answer.
 *
 *   OBSTACLE 2 · THE PRIVILEGES.                  🟠 **HALF CLOSED.**
 *     `tenant.exception` now takes `GRANT UPDATE` on its resolution columns
 *     and on `status`, which is the half a reversal needs to CLEAR one.
 *     **`tenant.exception_reversal` still has `GRANT SELECT` only**, so the
 *     act's own row — the reversal itself — cannot be written, and mounting
 *     the operation today would still answer 500 on the happy path. Derive it,
 *     never read it:
 *       `grep -n 'tenant.exception_reversal' db/migrations/*.sql`
 *
 * **So it stays unmounted, and the reason has changed rather than gone.** The
 * `GRANT INSERT` is not taken here because `0004`'s rule binds in both
 * directions and G511 states it in one line — *"the fence and the writer are
 * one commit or neither"* — and the writer is an operation with its own
 * capability (`reverse_resolution`), its own ordinal allocation, its own
 * status transition and its own effect on `AutonomyDials.reversalRate`.
 * **That is a slice, not a line.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 ALL SIX ARE `AuthorisedOperation`s AND NONE IS A `Handler`. G301.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"AN OPERATION MAY NOT MOUNT UNTIL IT MINTS A RECORD."* `mountTier()`'s sixth
 * fence refuses to boot a gated operation whose entry is a bare handler.
 *
 * **NO BODY TAKES A POOL.** Each is handed a `tx` that is already open, already
 * tenant-scoped, and already carries this act's authorisation record. On a
 * WRITE that is stronger than on a read: the act and the record commit together
 * or neither does — **and here it is stronger again**, because
 * `db/migrations/0059`'s restrictive policies and its trigger READ that record
 * back out of `app.authorisation_ref`. A handler that somehow skipped the mint
 * would not merely leave no trace; **its writes would be refused by the
 * database.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 INVARIANT 1, AND THE FOUR-VECTOR TEST THESE OPERATIONS OWE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"Tenant scope is derived from the session, never read from a request."*
 * There is no `tenantId` on any of these signatures, no tenant predicate in any
 * statement `proposal-store.ts` issues, and the tenant reaches the query only
 * through `withTenantScope()`'s `SET LOCAL`.
 *
 * ✅ **THE LIMITATION BELOW IS CLOSED — G941, 20 Sep 2026 — AND THE BLOCK IS
 *    CORRECTED RATHER THAN DELETED.** All SIX of these operations now refuse a
 *    smuggled `?tenantId=` with a 400, and the *"it would change the answer of
 *    seven already-served operations"* clause is what made it a ruling: it
 *    changed the answer of **122 of 136 declared operations**, measured before
 *    the change and captured in `tests/http/parameter-free-querystring.test.ts`.
 *    ⚠️ **`tests/http/proposal-chain-served.test.ts` §4 DID NEED AN EDIT, unlike
 *    the two suites one file over**: it pinned `res.status === baseline.status`
 *    across all four vectors rather than continuing past a non-200, so the
 *    query vector is now split out and carries the STRONGER claim — refused,
 *    and refused identically for another tenant's exception, so the 400 is not
 *    an existence oracle. THE ORIGINAL FOLLOWS, UNCHANGED.
 *
 * ⚠️ AND THE LIMITATION `exceptions.ts` FOUND ON 19 Sep 2026 APPLIES TO **ALL
 *    SIX** OF THESE, WHICH IS WORSE THAN THE TWO-OF-FOUR IT REPORTED. An
 *    operation declaring **no** query parameter gets **no querystring schema at
 *    all** — `schemaFromParameters()` returns `undefined` when it finds no
 *    `in: query` parameter — so `?tenantId=…` is **IGNORED rather than
 *    REFUSED**. **Every one of these six declares only a PATH parameter**, so
 *    every one is in the ignoring class. Invariant 1 still holds (nothing reads
 *    it), and *ignored and read look identical from outside*.
 *    **IT IS NOT FIXED HERE**, because fixing it is a ruling nobody has taken
 *    and it would change the answer of seven already-served operations.
 *    `tests/http/proposal-chain-served.test.ts` §4 asserts the four vectors —
 *    header, cookie, query and path — **and asserts the ANSWER DOES NOT MOVE**
 *    rather than asserting a status, which is the assertion that stays true
 *    whichever way the ruling goes.
 */

import { randomBytes } from 'node:crypto'

import type { FastifyRequest } from 'fastify'

import type { Timestamp, UserId } from '../../model/kernel.ts'
import { sendProblem } from '../http/app.ts'
import { CODES } from '../http/problem.ts'
import type { AuthorisedBody, AuthorisedOperation } from './authorisation-record.ts'
import {
  createProposal,
  executeProposalNow,
  readAvailableDispositions,
  readProposal,
  readProposalsFor,
  recordApproval,
  type ChainRefusal,
  type ChainResult,
  type EvidenceInput,
} from './proposal-store.ts'

/**
 * `components.parameters.ExceptionId` / `ProposalId` — both `in: path`,
 * `required: true`. Read once and used twice per operation, for `runs.ts`'s
 * reason: the body needs the id and `instanceOf` needs it to name the
 * `ResourceRef` the authorisation is minted against, and *"the one that
 * drifted silently would be the AUDIT record rather than the query — which is
 * the worse direction."*
 */
const exceptionIdOf = (request: FastifyRequest): string =>
  (request.params as { exceptionId: string }).exceptionId

const proposalIdOf = (request: FastifyRequest): string =>
  (request.params as { proposalId: string }).proposalId

/**
 * A fresh id for a proposal or a decision.
 *
 * ⚠️ G97 — *"every branded id is `text`; the slug is stored VERBATIM. THERE IS
 * NO `uuid` ANYWHERE IN THIS MODEL."* A readable prefix and a random tail, in
 * the shape every other id here takes. Copied from
 * `mintAuthorizationGrantId()` and NOT imported, because that function's name
 * and prefix are about a grant; a shared `mintId(prefix)` would be one helper
 * whose callers can no longer be found by grepping for what they mint.
 *
 * 🛑 `randomBytes` AND NOT `Math.random()`, FOR THE SAME REASON THAT FUNCTION
 * GIVES: possession of the id confers nothing, but it is a PRIMARY KEY on a
 * table that takes `INSERT` and no `UPDATE`, and a predictable one lets
 * anybody who can write a row choose which act they collide with. There is no
 * `ON CONFLICT` anywhere in this chain, deliberately — a collision is a thing a
 * person needs to be told about.
 */
const mintProposalId = (): string => `prp_${randomBytes(16).toString('hex')}`
const mintDecisionId = (): string => `apd_${randomBytes(16).toString('hex')}`

/**
 * 🛑 ONE TABLE FROM THE STORE'S REFUSAL ARMS TO STATUS CODES, AND IT IS THE
 *    REASON THE SIX BODIES BELOW ARE THREE LINES EACH.
 *
 * Six per-operation `switch`es would be six places for a 409 to become a 422,
 * and the contract is specific about which is which — `proposal_not_executable`
 * is *"THE CENTRAL CASE"* and a 409, while `approval_segregation_violation` is
 * a **403**, listed under `decideApproval`'s 403 beside `policy_denied`,
 * because it refuses THIS CALLER rather than reporting on the proposal.
 *
 * ⚠️ `detail` IS A CONSTANT WHEREVER ONE APPEARS AND CARRIES NO ID AND NO CELL
 *    VALUE. `errors.yaml`: `detail` *"MUST NOT contain field values, record
 *    contents or customer-authored strings"* — and an id echoed back would
 *    additionally confirm, for the cross-tenant case, that the attacker's id
 *    was well formed enough to reach a handler.
 */
const NO_ROW_DETAIL = 'No exception or proposal with that id is visible to this session.'

function respondRefusal(reply: Parameters<AuthorisedBody>[0]['reply'], refusal: ChainRefusal) {
  switch (refusal.kind) {
    case 'not_found':
      return sendProblem(reply, {
        status: 404,
        code: CODES.resourceNotFound,
        title: 'No such exception or proposal.',
        detail: NO_ROW_DETAIL,
      })

    case 'unpublishable':
      /* The COLUMN and never the cell — `exceptions.ts`'s
         `unpublishableException()` one surface over. */
      console.error(
        `data-plane: \`${refusal.defect.table}\` row \`${refusal.defect.rowId}\` carries a ` +
          `\`${refusal.defect.column}\` that is not in the domain model’s vocabulary; the row ` +
          'was not published.',
      )
      return sendProblem(reply, {
        status: 500,
        code: CODES.upstreamUnavailable,
        title: 'The request could not be completed.',
        detail:
          'A stored row carries a value the domain model does not define. It was not published.',
      })

    case 'not_configured':
      /**
       * 🛑 NOT A 403, AND `proposal-store.ts`'s `loadGate()` ARGUES IT: this
       *    is OUR configuration, not the caller's lack of authority, and a 403
       *    would tell an operator they lack something they may well hold. The
       *    tempting default — quorum 1, no floor, no segregation — is the
       *    WEAKEST configuration expressible, so a tenant nobody configured
       *    would silently get the least supervision.
       *
       * ✅ G3441, 3 Oct 2026 — AND NOT A 500 ANY MORE. This arm (then
       *    `no_gate`) answered 500 `upstream_unavailable`, and the finding page
       *    and Approve-and-post rendered it as *"Something failed on our side
       *    … try again in a moment"* (reaudit NC-01). The answer is the same on
       *    every retry, so a retry sentence is a false one. A 409 with a closed
       *    code a client can name: resolutions are not set up yet.
       */
      console.error(
        `data-plane: this tenant has no \`tenant.${refusal.missing}\` row for this request, so ` +
          'the resolution chain cannot be evaluated. It fails CLOSED (409) rather than ' +
          'defaulting to the weakest gate.',
      )
      return sendProblem(reply, {
        status: 409,
        code: CODES.resolutionNotConfigured,
        title: 'Resolutions are not set up for this reconciliation yet.',
        detail:
          refusal.missing === 'approval_config'
            ? 'No approval policy is configured for this tenant.'
            : 'This reconciliation has no resolution set configured.',
      })

    case 'exception_already_resolved':
      return sendProblem(reply, {
        status: 409,
        code: CODES.exceptionAlreadyResolved,
        title: 'This exception is already resolved.',
        detail:
          'Reverse the resolution before proposing another. A second resolution silently ' +
          'replacing the first would break the reversal chain.',
      })

    case 'proposal_superseded':
      return sendProblem(reply, {
        status: 409,
        code: CODES.proposalSuperseded,
        title: 'That proposal is not the current one.',
        detail:
          'A newer proposal exists on this exception, it was already rejected, or it has ' +
          'already been executed. Deciding a stale proposal would approve something nobody ' +
          'is looking at.',
      })

    case 'disposition_not_offered':
      return sendProblem(reply, {
        status: 422,
        code: CODES.dispositionNotOffered,
        title: 'That disposition is not offered for this exception.',
        detail:
          'The legal set comes from `GET /exceptions/{exceptionId}/dispositions`. There is no ' +
          'free-text fallback and there will not be one.',
      })

    case 'disposition_requires_adjustment':
      return sendProblem(reply, {
        status: 422,
        code: CODES.dispositionRequiresAdjustment,
        title: 'That disposition requires a money adjustment.',
      })

    case 'adjustment_currency_mismatch':
      return sendProblem(reply, {
        status: 422,
        code: CODES.adjustmentCurrencyMismatch,
        title: 'The adjustment does not agree with the exception’s value at risk.',
        detail:
          'An adjustment must be stated in the same currency as the finding. A cross-currency ' +
          'adjustment accepted without conversion is a variance that is not one, at the point ' +
          'where money moves.',
      })

    case 'message_not_admitted':
      return sendProblem(reply, {
        status: 422,
        code: CODES.messageNotAdmitted,
        title: 'That correspondence has not been admitted as evidence.',
        detail:
          'A message must be admitted before it may be cited. Unadmitted is not a weaker form ' +
          'of admitted.',
      })

    case 'segregation_violation':
      /* 🛑 403 AND NOT 409 — the contract lists it under `decideApproval`'s 403
         beside `policy_denied`. Anybody else holding `approve_resolution` may
         take it; this caller may not, because they proposed it. */
      return sendProblem(reply, {
        status: 403,
        code: CODES.approvalSegregationViolation,
        title: 'The proposer may not approve their own proposal.',
        detail:
          'This tenant requires segregation of duties. The same person approving their own ' +
          'proposal is not a policy nuance; it is the control being absent.',
      })

    case 'rejection_reason_required':
      return sendProblem(reply, {
        status: 422,
        code: CODES.approvalRejectionReasonRequired,
        title: 'A rejection requires a reason.',
        detail:
          'A rejection without one tells the next reviewer nothing and the analyst who ' +
          'proposed it less.',
      })

    case 'not_executable':
      /**
       * 🛑 THE CENTRAL CASE. *"The proposal is approved and the second approver
       *    required above the money threshold has not signed, or the quorum is
       *    unmet."* The `detail` names WHAT IS OUTSTANDING in the contract's
       *    own vocabulary — these are `ErrorCode` members, not values from any
       *    row — and `execution.blockedBy` on the proposal is the
       *    machine-readable form a client should read instead.
       */
      return sendProblem(reply, {
        status: 409,
        code: CODES.proposalNotExecutable,
        title: 'That proposal is not executable yet.',
        detail:
          refusal.blockedBy.length === 0
            ? 'The proposal is not in an executable state.'
            : `Outstanding: ${refusal.blockedBy.join(', ')}.`,
      })
  }
}

/** Unwrap a store result into a body or a problem. One place, six callers. */
function respond<T>(result: ChainResult<T>, reply: Parameters<AuthorisedBody>[0]['reply']): unknown {
  if (result.ok) return result.value
  return respondRefusal(reply, result.refusal)
}

/**
 * The acting principal, in the two fields every write here needs.
 *
 * 🛑 IT IS `ctx.principal`, WHICH IS THE SEAM'S OWN OBJECT AND NOT A SECOND
 *    RESOLUTION. `authorisation-record.ts` states the whole argument at the
 *    field: `principalContextFor()` runs exactly once per act and `authorize()`
 *    has already evaluated `decide()` against THIS object, so a body that
 *    resolved its own *"would be asking the same question a second time
 *    against a substrate that may have moved."*
 *
 * ⚠️ AND THE DATABASE CHECKS IT RATHER THAN TRUSTING IT. `0059`'s restrictive
 *    policies compare the row's own actor column against
 *    `authorization_grant.subject_user_id` — the record this act minted — so a
 *    handler that passed somebody else's id here would have its INSERT refused
 *    rather than its lie stored.
 */
function actorOf(ctx: Parameters<AuthorisedBody>[0]): {
  readonly userId: UserId
  readonly now: Timestamp
} {
  return {
    userId: ctx.principal.subject.userId,
    now: new Date().toISOString() as Timestamp,
  }
}

/* ------------------------------------------------------------------ *
 * THE SIX BODIES.
 * ------------------------------------------------------------------ */

const listAvailableDispositionsBody: AuthorisedBody = async ({ request, reply, tx }) =>
  respond(await readAvailableDispositions(tx, exceptionIdOf(request)), reply)

const listProposalsBody: AuthorisedBody = async ({ request, reply, tx }) => {
  const read = await readProposalsFor(tx, exceptionIdOf(request))
  if (!read.ok) return respondRefusal(reply, read.refusal)
  return { items: read.value }
}

const proposeResolutionBody: AuthorisedBody = async (ctx) => {
  const { request, reply, tx } = ctx
  /**
   * ⚠️ `dispositionKey`, `rationale` AND `evidence` ARE ALL `required` ON THE
   *    WIRE, so ajv has already refused a request missing any of them and none
   *    is defaulted here. `adjustment` is a `oneOf [Money, null]` and is
   *    OPTIONAL, so `undefined` and explicit `null` are both legal and both
   *    mean "no adjustment" — which is the one place in this file where the
   *    coalescing spelling is correct rather than lossy, and the store takes
   *    both.
   */
  const body = request.body as {
    readonly dispositionKey: string
    readonly rationale: string
    readonly evidence: readonly EvidenceInput[]
    readonly adjustment?: { currency: string; amountMinor: string; exponent: number } | null
  }

  const created = await createProposal(
    tx,
    exceptionIdOf(request),
    {
      dispositionKey: body.dispositionKey,
      rationale: body.rationale,
      evidence: body.evidence,
      ...(body.adjustment === undefined ? {} : { adjustment: body.adjustment }),
    },
    { ...actorOf(ctx), proposalId: mintProposalId() },
  )
  if (!created.ok) return respondRefusal(reply, created.refusal)

  /* 🛑 201 AND NOT 200. The contract declares `'201'` on this operation alone
     of the six, and it is the only one that creates an addressable thing. */
  reply.code(201)
  return created.value
}

const getProposalBody: AuthorisedBody = async ({ request, reply, tx }) =>
  respond(await readProposal(tx, proposalIdOf(request)), reply)

const decideApprovalBody: AuthorisedBody = async (ctx) => {
  const { request, reply, tx } = ctx
  const body = request.body as { readonly decision: string; readonly reason?: string | null }
  return respond(
    await recordApproval(
      tx,
      proposalIdOf(request),
      { decision: body.decision, ...(body.reason === undefined ? {} : { reason: body.reason }) },
      { ...actorOf(ctx), decisionId: mintDecisionId() },
    ),
    reply,
  )
}

const executeProposalBody: AuthorisedBody = async (ctx) =>
  respond(await executeProposalNow(ctx.tx, proposalIdOf(ctx.request), actorOf(ctx)), ctx.reply)

/* ------------------------------------------------------------------ *
 * THE SIX OPERATIONS, AS G301 REQUIRES THEM: A CAPABILITY, A RESOURCE, A BODY.
 *
 * 🛑 THE CAPABILITY IS TAKEN FROM `CAPABILITIES`, NOT WRITTEN AS A STRING, so a
 * capability the model retires is a compile error here rather than a 403 nobody
 * can explain. Each must equal the `x-capability` the contract annotates, and
 * the two are joined by nothing but a test:
 * `tests/http/authorisation-record.test.ts` §3 asserts the agreement and gains
 * a case per operation in the commit that mounts one.
 *
 * ⚠️ TWO `resourceType`s AND THE SECOND IS ARGUED RATHER THAN ASSUMED.
 * `ResourceRef`'s own docblock gives *"Entity name: 'Exception',
 * 'SourceDocument', 'Solution'. Never parsed."* The three exception-addressed
 * operations take `'Exception'`, exactly as `exceptions.ts`'s four do. The
 * three PROPOSAL-addressed ones take `'ResolutionProposal'`, which is the
 * model's own interface name and is an entity with an id of its own
 * (`ProposalId = Id<'ResolutionProposal'>`, `model/identity.ts`) — **using
 * `'Exception'` for them would record an audit row naming the wrong thing**,
 * and `run-account.ts` had to argue its way to `'Run'` precisely because a run
 * account is NOT an entity. This one is.
 * ------------------------------------------------------------------ */

/**
 * The closed set for one exception.
 *
 * ⚠️ `instanceOf` IS THE EXCEPTION AND NOT NULL, WHICH IS THE OPPOSITE OF
 * `listExceptions`. `ResourceRef.resourceId`'s null example is *"opening a
 * list"*, and this is a list BOUNDED BY A PARENT ROW rather than a list of
 * everything the session can reach — which is `listRunResidue`'s case, where
 * `exceptions.ts` records that a null *"would have overstated one"*.
 */
export const listAvailableDispositionsOperation: AuthorisedOperation = {
  operationId: 'listAvailableDispositions',
  resourceType: 'Exception',
  instanceOf: (request) => exceptionIdOf(request),
  body: listAvailableDispositionsBody,
}

/** Every proposal on one exception, current and superseded. */
export const listProposalsOperation: AuthorisedOperation = {
  operationId: 'listProposals',
  resourceType: 'Exception',
  instanceOf: (request) => exceptionIdOf(request),
  body: listProposalsBody,
}

/**
 * Proposing a disposition.
 *
 * 🛑 `propose_resolution` AND NOT `view_exception`, AND THE DIFFERENCE IS
 * ENFORCED BY `decide()` RATHER THAN BY THIS FILE. `view_exception` reaches
 * `['viewer','operator','approver','tenant_admin']`; `propose_resolution`
 * reaches `['operator']` alone. A VIEWER may read the queue, the finding and
 * every proposal on it, and may propose nothing.
 * `tests/http/proposal-chain-served.test.ts` §6 witnesses it: the same session,
 * holding only `view_exception`, gets 200 on all three reads and 403 here.
 */
export const proposeResolutionOperation: AuthorisedOperation = {
  operationId: 'proposeResolution',
  resourceType: 'Exception',
  instanceOf: (request) => exceptionIdOf(request),
  body: proposeResolutionBody,
}

/** One proposal, and exactly why it is or is not executable yet. */
export const getProposalOperation: AuthorisedOperation = {
  operationId: 'getProposal',
  resourceType: 'ResolutionProposal',
  instanceOf: (request) => proposalIdOf(request),
  body: getProposalBody,
}

/**
 * Approving or rejecting.
 *
 * 🛑 `approve_resolution` REACHES `['approver']` ALONE — not `operator`, not
 * `tenant_admin` — and `PARTNER_MASK_MEMBERSHIP.approve_resolution` is `[]`
 * with the invariant written on the entry: *"a partner may operate on a
 * customer's exceptions and may never be the approving authority for them."*
 * So a partner holding the strongest operating scope reaches
 * `propose_resolution` and is refused here, on the mask, by `decide()`.
 *
 * ⚠️ AND THE CAPABILITY IS THE FIRST-ORDER GATE AND NOTHING FINER. The
 * contract's 403 lists `policy_denied` — *"the caller's role is not in
 * `ApprovalConfig.approverRoles`"* — and **that check is not implemented**,
 * because `approvers: CapabilityRequirement[]` needs the APPROVER's own
 * assignments and `db/migrations/0009`'s `user_visible_to_session` lets a
 * request path read exactly one person: itself. Named in `model/approval.ts`'s
 * header rather than silently folded into `approve_resolution`.
 */
export const decideApprovalOperation: AuthorisedOperation = {
  operationId: 'decideApproval',
  resourceType: 'ResolutionProposal',
  instanceOf: (request) => proposalIdOf(request),
  body: decideApprovalBody,
}

/**
 * Executing.
 *
 * 🛑 THE FOURTH DISTINCT VERB IN ONE CHAIN, AND THE SEPARATION FROM
 * `propose_resolution` IS THE WHOLE AUTONOMY DESIGN: *"an agent may propose
 * everywhere and execute only inside the ceiling."* `execute_resolution` is
 * `[]` in the partner mask — *"The one that moves money."*
 */
export const executeProposalOperation: AuthorisedOperation = {
  operationId: 'executeProposal',
  resourceType: 'ResolutionProposal',
  instanceOf: (request) => proposalIdOf(request),
  body: executeProposalBody,
}

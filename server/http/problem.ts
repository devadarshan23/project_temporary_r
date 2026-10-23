/**
 * RFC 9457, AND THE CLOSED ERROR ENUM READ OUT OF `errors.yaml` AT IMPORT TIME.
 *
 * `errors.yaml`'s own header states why the enum is closed: "under a restrictive
 * SpanAttributePolicy the error class is the only diagnostic channel that
 * survives redaction — a free-text message is stripped and undiagnosable." A
 * server that invented a code would be shipping a diagnosis nobody downstream
 * can read.
 *
 * 🛑 SO A CODE IS RESOLVED AT IMPORT, NOT AT SEND. `code()` throws the moment
 * this module loads if a name is not in the document's enum. The failure is a
 * process that will not start, at the top of a stack trace naming the code —
 * rather than a 500 in the one refusal path nobody exercised. Same polarity as
 * every other control here: fail at boot, loudly, over a running server with a
 * hole in it.
 *
 * ⚠️ `detail` IS DELIBERATELY NEVER POPULATED FROM A REQUEST. `errors.yaml`:
 * "MUST NOT contain field values, record contents or customer-authored strings."
 * Every call site below passes a constant, and a helper that took one from a
 * request would make that rule a review convention.
 */

import { loadTier, type JsonValue } from '../contract/document.ts'

function errorCodeEnum(): ReadonlySet<string> {
  const doc = loadTier('errors')
  const components = doc['components']
  const path = (node: JsonValue | undefined, key: string): JsonValue | undefined => {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) return undefined
    return (node as { [k: string]: JsonValue })[key]
  }
  const members = path(path(path(components, 'schemas'), 'ErrorCode'), 'enum')
  if (!Array.isArray(members) || members.length === 0) {
    throw new Error('errors.yaml carries no `components.schemas.ErrorCode.enum`')
  }
  return new Set(members.filter((m): m is string => typeof m === 'string'))
}

const CLOSED_ENUM = errorCodeEnum()

function code(name: string): string {
  if (!CLOSED_ENUM.has(name)) {
    throw new Error(
      `\`${name}\` is not in errors.yaml's closed ErrorCode enum (${CLOSED_ENUM.size} members). ` +
        'Adding a member is a contract change; it is not a server change.',
    )
  }
  return name
}

/**
 * The codes this slice can return. Named constants rather than string literals
 * at call sites so that every one of them is resolved — and every one of them
 * can fail — on the first import, before a listener is bound.
 *
 * ⚠️ THIS SAID "THE FOUR CODES" UNTIL 19 Sep 2026 AND THERE ARE FIVE. The fifth
 * is `capabilityNotHeld`, arriving with G200's request-time gate. Derive it:
 * `grep -cE "^  [a-zA-Z]+: code\('" server/http/problem.ts`.
 *
 * 🛑 AND THE CORRECTION ABOVE WAS STALE WITHIN THE SAME DAY — THERE ARE SEVEN.
 * The sixth and seventh are `tenantContextMissing` and `membershipAbsent`,
 * arriving with D1. **Both are REUSED, not minted**, which is the property
 * `tests/contracts/session-error-vocabulary.test.mjs` exists to hold: it lists
 * `membership_absent` among *"THE FOUR THAT ALREADY EXIST … this slice REUSES
 * them rather than minting a session-flavoured twin of each."* Adding a member
 * to the enum is a contract change; adding a constant here is not, and the
 * `code()` call above is what keeps the two from being confused. **Derive the
 * number; this sentence has now been wrong twice.**
 */
export const CODES = {
  /** No valid session. The only member of the enum that means "not authenticated". */
  sessionInvalid: code('session_invalid'),
  /**
   * The caller authenticated and does not hold the verb the operation declares.
   *
   * 🛑 NOT `policy_denied`, AND THE DISTINCTION IS THE REASON THIS MEMBER WAS
   * MINTED RATHER THAN BORROWED. `policy_denied` is F3 refusing an ACT the
   * caller was entitled to attempt; this is the caller never having been granted
   * the verb. `errors.yaml` carries the full argument at the head of the file —
   * the error class is the only diagnostic channel that survives redaction, so
   * two causes answered by two different people must not share one code.
   */
  capabilityNotHeld: code('capability_not_held'),
  /** The request did not satisfy the contract's own schema. */
  validationFailed: code('validation_failed'),
  /**
   * `capability.openapi.yaml` on its `NotFound` response: returned identically
   * for a row that does not exist and for a row in another tenant, because
   * distinguishing them "would make this endpoint an existence oracle across the
   * tenant boundary." Used here for an unrouted path too, for the same reason.
   */
  resourceNotFound: code('resource_not_found'),
  /** An unhandled failure below us. The only honest code for a 500. */
  upstreamUnavailable: code('upstream_unavailable'),
  /**
   * No tenant could be resolved for this request — D1's refusal.
   *
   * 🛑 IT COVERS FOUR DISTINCT REGISTRY OUTCOMES AND THAT IS DELIBERATE.
   * `resolveServingHost()` answers `host_not_presented`, `host_not_registered`,
   * `host_registered_more_than_once` and `host_retired`, and returning them
   * separately would make this operation an oracle over the published registry
   * for anybody holding a session — which host names exist, which used to, and
   * which we have misconfigured. `resource_not_found`'s own note one member up
   * makes the identical argument for a row in another tenant: distinguishing
   * them *"would make this endpoint an existence oracle across the tenant
   * boundary."*
   */
  tenantContextMissing: code('tenant_context_missing'),
  /**
   * The principal holds no LIVE membership in the tenant the host serves.
   *
   * ⚠️ REUSED FROM `errors.yaml`, NOT MINTED, AND `model/access.ts` §7a SAYS
   * WHY THE MODEL'S REFUSAL SET HAS EXACTLY ONE MEMBER: *"the refusal set has
   * exactly one member so any later arm is a VISIBLE ADDITION TO A CLOSED UNION
   * rather than a widened predicate inside a function body."* One wire code
   * against one model refusal keeps that property visible from the outside too
   * — revoked, expired and never-granted are one answer here for the reason
   * `TENANT_SELECTION_REFUSALS.membershipAbsent` states at length.
   */
  membershipAbsent: code('membership_absent'),

  /* ---------------------------------------------------------------- *
   * THE RESOLUTION CHAIN — G656–G660, 19 Sep 2026. NINE, AND EVERY ONE IS
   * REUSED FROM `errors.yaml` RATHER THAN MINTED. The `code()` call above is
   * what makes that a fact rather than an intention: a name this enum does not
   * carry throws on the first import, before a listener is bound.
   *
   * ⚠️ THE SENTENCE ABOVE — *"Derive the number; this sentence has now been
   *    wrong twice"* — IS NOW WRONG A THIRD TIME AND IS LEFT STANDING AS THE
   *    HISTORY IT IS. Derive it:
   *    `grep -cE "^  [a-zA-Z]+: code\('" server/http/problem.ts`.
   *
   * 🛑 **THE COLUMN ANCHOR IS NEW — G2177, 28 Sep 2026 — AND THE BARE FORM
   *    BOTH SITES CARRIED ANSWERED 28 AGAINST 26 CODES.** The two surplus
   *    lines were this derivation and its twin above: **a count that has
   *    been "wrong three times" by its own narration was over by exactly the
   *    number of times it had been narrated.**
   *
   * 🛑 **AND THE FIRST REPAIR THIS SLICE WROTE WAS THE SAME DEFECT NARROWED
   *    RATHER THAN CLOSED — G2182, CAUGHT BY RUNNING THE GATE BEFORE THE
   *    COMMIT LANDED.** It keyed on the key's own punctuation, reasoning that
   *    *"no sentence writes a colon before it"* — **and the sentence that said
   *    so wrote one**, in the very act of quoting the command. It answered 28,
   *    exactly what it replaced. **The property is not *a colon precedes it*;
   *    it is *a declaration begins in column three*, which no block comment
   *    can do.** That is G1953's finding, one file over, inside the sweep
   *    written to close its class.
   * ---------------------------------------------------------------- */

  /**
   * The disposition key is not in the closed set this exception offers.
   *
   * 🛑 THERE IS NO FREE-TEXT FALLBACK AND THERE WILL NOT BE ONE. The contract:
   * *"`ResolutionProposal.action` used to be a free-text string. That single
   * field made the judgement the product exists to automate unscoreable,
   * unreportable, unlearnable and impossible to vary per domain."*
   */
  dispositionNotOffered: code('disposition_not_offered'),
  /** The disposition declares `requiresAdjustment` and none was stated. */
  dispositionRequiresAdjustment: code('disposition_requires_adjustment'),
  /**
   * The adjustment's currency does not agree with the exception's
   * `valueAtRisk`. *"A cross-currency adjustment accepted without conversion is
   * the USD-invoice-against-SGD-purchase-order defect reappearing at the point
   * where money actually moves."*
   */
  adjustmentCurrencyMismatch: code('adjustment_currency_mismatch'),
  /**
   * A `correspondence` evidence ref names a message that was never admitted.
   *
   * ⚠️ THIS IS THE SECOND OF THE TWO ENFORCEMENT POINTS INVARIANT 6 HAS ON
   * THIS PATH, and the contract names it as such — C7's advance is the first.
   * *"Without this checkpoint, 'the agent read the email' and 'the agent obeyed
   * the email' are the same event."*
   */
  messageNotAdmitted: code('message_not_admitted'),
  /** A resolution already exists. Reverse it before proposing another. */
  exceptionAlreadyResolved: code('exception_already_resolved'),
  /** A newer proposal exists on this exception, or this one was rejected. */
  proposalSuperseded: code('proposal_superseded'),
  /**
   * G3441 — no approval policy (`tenant.approval_config`) or no archetype
   * projection (`tenant.definition_archetype`) is configured, so the
   * resolution chain cannot be evaluated. A 409: a fact about how the tenant
   * is set up, identical on every retry. It replaced a 500
   * `upstream_unavailable`, which every client rendered as "try again".
   */
  resolutionNotConfigured: code('resolution_not_configured'),
  /**
   * THE CENTRAL CASE. Approved, and still not executable.
   *
   * ⚠️ A 409 AND NEVER A 403, AND THE SEPARATION IS THE WHOLE REASON THIS CODE
   * IS DISTINCT FROM `capabilityNotHeld`. The caller is permitted; the
   * PROPOSAL is not ready. `model/approval.ts`'s header states the same split
   * from the other side.
   */
  proposalNotExecutable: code('proposal_not_executable'),
  /** Fewer distinct approvers than `ApprovalConfig.quorum`. */
  approvalQuorumUnmet: code('approval_quorum_unmet'),
  /**
   * The caller proposed this and `ApprovalConfig.segregationOfDuties` is set.
   *
   * 🛑 A 403 AND NOT A 409, WHICH IS THE CONTRACT'S OWN PLACEMENT — it lists
   * this code under `decideApproval`'s 403 beside `policy_denied`. It is a
   * refusal of THIS CALLER for THIS ACT rather than a statement about the
   * proposal's readiness: anybody else holding `approve_resolution` may take
   * it. *"The same person approving their own proposal is not a policy nuance;
   * it is the control being absent."*
   */
  approvalSegregationViolation: code('approval_segregation_violation'),
  /** A rejection with no reason. *"Carried over from existing behaviour."* */
  approvalRejectionReasonRequired: code('approval_rejection_reason_required'),

  /* ---------------------------------------------------------------- *
   * G692's RUN ADMISSION, MERGED ALONGSIDE — §5.11 WITH A SECOND PARENT,
   * ARRIVING IN THIS BLOCK. Both branches appended to the same object and
   * both were right about their own tree; neither list is the merged one.
   * ---------------------------------------------------------------- */
  /**
   * The definition this run would be admitted against is not `active`.
   *
   * 🛑 IT ALSO ANSWERS *"no such definition"*, AND THAT IS A DECISION TAKEN IN
   * `db/migrations/0069` RATHER THAN A COLLAPSE MADE HERE. `admitRun` declares
   * NO 404, and `errors.yaml`'s closed enum has no member meaning *"no such
   * definition"*; minting one is a contract change. Answering identically for
   * a draft definition, an archived one and one that does not exist is the
   * same posture `resourceNotFound` takes for *"a row that does not exist and
   * a row in another tenant"* — a definition register is a customer's
   * configuration, and an operation that distinguished the two would be an
   * existence oracle over it.
   */
  definitionNotActive: code('definition_not_active'),
  /**
   * A slot with cardinality `exactly_one` or `at_least_one` has nothing in it.
   *
   * ⚠️ IT DOES NOT NAME THE SLOT AND MUST NOT. `errors.yaml` forbids `detail`
   * from carrying *"field values, record contents or customer-authored
   * strings"*, and a slot name is tenant configuration. The names go to the
   * process log; `model/run-admission.ts` carries them on
   * `RunAdmissionVerdict.unfilledSlots`, deliberately outside the containment
   * proof, and says so at its own declaration.
   */
  slotFillIncomplete: code('slot_fill_incomplete'),
  /**
   * The period was closed, or closing, or this plane holds no record of it.
   *
   * 🛑 THE THIRD CASE IS G693 AND IT IS FAIL-CLOSED BY RULING. A period this
   * plane has no record of cannot be shown to be OPEN, and admitting a run
   * against it attributes a reconciliation to an accounting period nobody
   * opened — *"a run against it would reopen a signed number behind the
   * controller's back."* `db/migrations/0069` §3 argues it at length and names
   * the cost: an operator who mistypes a period id is told it is closed.
   */
  periodClosed: code('period_closed'),

  /* ---------------------------------------------------------------- *
   * HOME-REALM ROUTING — G1941, 22 Sep 2026. FOUR, AND EVERY ONE IS REUSED
   * FROM `errors.yaml` RATHER THAN MINTED: they are `DOMAIN_ROUTING_REFUSALS`'
   * four values, spelled identically, and `code()` is what makes that a fact
   * rather than an intention.
   *
   * 🛑 **THEY SHARE ONE STATUS — 422 — AND THAT IS THE WHOLE DESIGN OF THE
   * OPERATION THAT USES THEM.** `docs/contracts/session.openapi.yaml`: *"EVERY
   * REFUSAL SHARES ONE STATUS, and that is deliberate … 'returning 404 for an
   * unknown address is the natural thing to write and it is a user-existence
   * oracle.' Two statuses would put the distinction in a channel a caller can
   * read without parsing a body, and one of them would eventually be keyed on
   * something narrower than a domain."*
   *
   * ⚠️ **SO A FUTURE READER MUST NOT GIVE ONE OF THESE ITS OWN STATUS.** The
   * temptation is `domain_not_claimed` → 404, which reads as tidier and is the
   * exact defect. `server/data-plane/realm.ts` carries the argument at its
   * refusal map, and the contract carries it at the operation.
   * ---------------------------------------------------------------- */

  /** Nobody claims this domain. Also what an orphan claim answers, truly. */
  domainNotClaimed: code('domain_not_claimed'),
  /**
   * Somebody claims it and nobody has proved it.
   *
   * 🛑 #221's OWN RED. `model/domain.ts`: *"This is the refusal #221's red test
   * names, and it is why a `claims.length > 0` guard is the mutation to defend
   * against."* `mayRouteToConnection()` is `verifiedAt !== null` and
   * `db/migrations/0220_domain_claim.sql` stores that null.
   */
  domainNotVerified: code('domain_not_verified'),
  /** A verified claim on a door that is switched off. It does not route. */
  connectionDisabled: code('connection_disabled'),
  /**
   * TWO doors hold a VERIFIED claim on one domain. **The takeover state.**
   *
   * ⚠️ IT REFUSES RATHER THAN PICKING, AND THE MODEL SAYS WHY: *"picking
   * either picks an `orgClass` for the user, which is the reach invariant 2
   * exists to close."* Ambiguity is counted over VERIFIED claims only, so an
   * unverified claim cannot take a tenant's sign-in down — *"A denial of
   * service is not an improvement on a takeover."*
   */
  domainClaimedByMoreThanOneConnection: code('domain_claimed_by_more_than_one_connection'),
  /**
   * The named onboarding step is not the one that may be completed.
   *
   * **R8, 21 Sep 2026.** An existing member of `errors.yaml`'s closed enum,
   * minted for a PROCEDURE step and reused here rather than twinned — the
   * discipline `session.openapi.yaml` states for `session_invalid`: *"a
   * session-flavoured twin of an existing code would be the second vocabulary
   * this tier exists not to create."* `completeOnboardingStep` declares it as
   * its only 409 and this is that code.
   *
   * 🛑 **IT CARRIES TWO OF `model/onboarding.ts`'s FOUR REFUSALS AND THE
   * COLLAPSE IS NAMED RATHER THAN HIDDEN.** `stepNotCurrent` and
   * `stepAlreadyDone` are distinct in the model — *"completing it twice is not
   * idempotent — it is a lie"* — and both arrive here, because the contract
   * declares one 409 and the enum has no `step_already_done`. **Both mean the
   * named step is not the next one**, which is what the code says, so the
   * answer is true of both and less precise than the model. Minting a second
   * member is a contract change and a ruling; it is not taken here.
   *
   * ⚠️ AND IT IS NOT USED BY `forceOnboardingStep`, which declares no 409 at
   * all. That operation's three refusals land on `validationFailed` and
   * `server/data-plane/onboarding.ts` argues each one at the mapping.
   */
  stepNotCurrent: code('step_not_current'),

  /**
   * `reverseResolution` refused a resolution older than
   * `REVERSAL_WINDOW_HOURS`. **THE OWNER'S RULING, 22 Sep 2026 — G1831.**
   * Matches the pack's own posted-entry copy: *"reversible for 24 hours from
   * the post … After that a correction is a new entry with its own
   * approval, which is the point: an unlimited undo is not an audit
   * trail."*
   */
  reversalWindowExpired: code('reversal_window_expired'),

  /**
   * `requestSandboxTenant`'s 409 — *"a sandbox already stands. One per
   * partner."* REUSED FROM THE ENUM, NOT MINTED (W5, G2637): the contract
   * itself names `idempotency_conflict` on that response, and a second ask for
   * the one sandbox a firm may have IS the same request arriving twice.
   */
  idempotencyConflict: code('idempotency_conflict'),

  /* ---------------------------------------------------------------- *
   * THE FEDERATED CALLBACK — S6, 1 Oct 2026, G2492. FOUR REUSED BY EXACT
   * NAME AND ONE MINTED.
   *
   * The four `sign_in_attempt_*` codes have been on the enum since #230 and
   * mirror `SIGN_IN_ATTEMPT_REFUSALS` by exact name — the contract has
   * declared them on `completeFederatedSignIn`'s 422 since that operation was
   * written, and this is the first handler to return them.
   * ---------------------------------------------------------------- */
  signInAttemptHandleMismatch: code('sign_in_attempt_handle_mismatch'),
  signInAttemptReplayed: code('sign_in_attempt_replayed'),
  signInAttemptConnectionMismatch: code('sign_in_attempt_connection_mismatch'),
  signInAttemptChallengeMismatch: code('sign_in_attempt_challenge_mismatch'),
  /**
   * The person the directory named exists and is `disabled` — MINTED, and it
   * MIRRORS `MINT_SESSION_REFUSALS.userDisabled` (`model/session-mint.ts`) BY
   * EXACT NAME, which is `tests/contracts/session-error-vocabulary.test.mjs`
   * §8b's discipline: the arm was in `model/` first and the wire follows it.
   *
   * ⚠️ IT IS NOT AN EXISTENCE ORACLE, AND THE REASON IS THE ORDER: it is
   * answered only AFTER a code was exchanged and a token VERIFIED for that
   * subject, so the only caller who can see it is one who has just
   * authenticated as that person at their own directory. Telling them their
   * account is switched off is the answer they need, and nobody else reaches it.
   *
   * ⚠️ AND A CODE OR A TOKEN THAT DID NOT YIELD A PERSON IS NOT A NEW CODE AT
   * ALL — G2492. A first draft minted `sign_in_refused` and §8b refused it, for
   * the right reason: a session-shaped code with no model arm. Those refusals
   * answer `sign_in_attempt_challenge_mismatch`, and that is a MEANING, not a
   * borrowing: since S6 the challenge the model compares IS the verified
   * token's `nonce` (G2487), so *"no verified token bound to this attempt"* is
   * exactly *"the IdP's challenge does not match the one stored at redirect"*.
   */
  userDisabled: code('user_disabled'),

  /**
   * `declareEndpointDocumentType` named a document type this tenant does not
   * have — REUSED from the enum, where `createUpload` already declares it for
   * the identical fact. G2687, 1 Oct 2026. Another tenant's type is the same
   * answer, because the read that decides it runs under this tenant's RLS.
   */
  documentTypeUnknown: code('document_type_unknown'),
} as const

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

export interface Problem {
  readonly type: string
  readonly title: string
  readonly status: number
  readonly code: string
  readonly detail?: string
}

/**
 * `.invalid` is reserved by RFC 2606 and the control-plane contract already
 * uses it for exactly this purpose — "reserved precisely so this cannot be
 * mistaken for a deployment instruction."
 */
const TYPE_BASE = 'https://docs.reconcile.invalid/problems'

export function problem(args: {
  status: number
  code: string
  title: string
  detail?: string
}): Problem {
  return {
    type: `${TYPE_BASE}/${args.code}`,
    title: args.title,
    status: args.status,
    code: args.code,
    ...(args.detail === undefined ? {} : { detail: args.detail }),
  }
}

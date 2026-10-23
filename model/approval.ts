/**
 * THE APPROVAL EVALUATOR — `ApprovalConfig.quorum` and
 * `ApprovalConfig.segregationOfDuties`, EVALUATED. G658, 19 Sep 2026.
 *
 * ┌─ WHY THIS MODULE EXISTS, MEASURED RATHER THAN ASSERTED ────────────────────┐
 * │ Before this file, `grep -rn distinctHolders model/ server/ tests/`         │
 * │ returned the declaration, three literal `2`s and two equality assertions   │
 * │ — **zero evaluators**. `segregationOfDuties` was a boolean nothing read,   │
 * │ and its own field comment in `model/policy.ts` says what that is worth:    │
 * │ *"A control that always passes is a false assurance, and a false assurance │
 * │ is the one thing worse than a missing control."*                           │
 * │                                                                            │
 * │ Four-eyes is the thing the resolution chain exists for. This is the one    │
 * │ place it is computed.                                                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THIS IS NOT A SECOND EVALUATOR BESIDE `decide()`, AND THE DISTINCTION IS
 *    THE WHOLE REASON IT IS LAWFUL TO WRITE. READ IT BEFORE EXTENDING IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G289 refused a control-plane evaluator beside `decide()` on the confused-
 * deputy argument `model/access.ts` states in its own header, and
 * `db/migrations/0018` refused re-deriving *"holds `manage_roles`"* in SQL for
 * the same reason. **Nothing here answers *"may this principal do X"*.**
 *
 *   `decide()`         takes a PRINCIPAL and a CAPABILITY and answers
 *                      AUTHORITY. It is asked FIRST, by the gate, and it is
 *                      the only thing that may be.
 *   `approvalState()`  takes a PROPOSAL and its DECISIONS and answers whether
 *                      **the proposal** is executable. It never sees a role,
 *                      an assignment, an org class or a capability, and it
 *                      cannot be asked about a principal because it takes no
 *                      argument that is one.
 *
 * The two compose in one direction only: a caller who has already been allowed
 * `execute_resolution` by `decide()` may then be told by this function that the
 * PROPOSAL is not ready. **A refusal here is a 409, never a 403** — the caller
 * is permitted, the thing is not ready — and the server keeps those statuses
 * apart deliberately.
 *
 * ⚠️ WHY IT CANNOT LIVE ON THE CAPABILITY TIER, WHICH IS WHERE SOMEBODY WILL
 *    TRY TO PUT IT. `server/contract/capability.ts`'s `Annotation` carries ONE
 *    SCALAR CAPABILITY PER OPERATION, and `decide(principal, capability)` takes
 *    ONE PRINCIPAL AND NO RESOURCE STATE. Quorum counts DISTINCT PEOPLE across
 *    several acts and segregation compares TWO actors of TWO acts: both are
 *    inherently RELATIONAL, and there is no annotation that can say either.
 *    Teaching `decide()` to read rows would make every authority answer depend
 *    on a resource read — which is the structural precondition for a confused
 *    deputy, stated in `model/access.ts`'s own words.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT IS **NOT** EVALUATED HERE, NAMED RATHER THAN GLOSSED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ApprovalConfig.approvers: CapabilityRequirement[]` — and therefore
 * `CapabilityRequirement.distinctHolders` — is absent from `ApprovalGate`
 * below, and the blocker is a MEASURED property of the database rather than a
 * preference. `db/migrations/0009_identity_substrate.sql`'s
 * `user_visible_to_session` keys on the SESSION, so a request path can read
 * EXACTLY ONE user row: its own. Asking *"does this OTHER person hold
 * `approve_resolution` on this domain"* needs their `role_assignment` rows, and
 * nothing on a request path can see them.
 *
 * **So `distinctHolders` still has no evaluator and this module does not
 * pretend otherwise.** What it evaluates is the two terms whose inputs are
 * readable: `quorum`, a count of distinct names on rows we can read, and
 * `segregationOfDuties`, a comparison of two ids we already hold.
 *
 * ⚠️ THE HONEST CONSEQUENCE: an approver's ENTITLEMENT is checked once, by the
 *    capability gate, and never against `approvers[]`. A tenant whose
 *    `ApprovalConfig.approvers` is narrower than `approve_resolution` has a
 *    control that reads as present and is not.
 */

import { compareMoney } from './money.ts'
import type { Money, Severity } from './domain'
import type { ApprovalConfig } from './policy'
import type { Timestamp, UserId } from './kernel'

type Assert<T extends true> = T

/* ==================================================================== *
 * §1  SEVERITY AS A LADDER
 *
 * ⚠️ `SEVERITIES` IS A CONST OBJECT AND NOT AN ORDER. `model/domain.ts`
 *    declares `{critical, high, medium, low}` and says nothing about rank; the
 *    ORDER lives on `Exception.severityRank`, which exists because *"ORDER BY
 *    on the string union sorts critical, high, low, medium — alphabetically,
 *    and therefore wrongly, in a way that looks plausible enough to ship."*
 *
 * 🛑 SO THE LADDER HAS TO BE DECLARED SOMEWHERE AND THIS IS THE FIRST PLACE IT
 *    IS DECLARED AS DATA. It is a TOTAL `Record<Severity, number>`, so a fifth
 *    severity is a `TS2741` here rather than a comparison that silently returns
 *    `undefined` and compares as `NaN`.
 *
 * ⚠️ IT ASCENDS AND `Exception.severityRank` DESCENDS, AND THAT IS NOT A BUG
 *    BUT IT IS A TRAP. The column is 0-is-critical because a queue sorts
 *    `severity_rank ASC`; this is 3-is-critical because a THRESHOLD reads
 *    "at or above". Two orderings of one ladder is one too many, and the
 *    reason they are not collapsed is that collapsing them would invert one of
 *    the two readers. `tests/model/approval-state.test.ts` §1 asserts the
 *    inversion holds so it cannot drift into agreement by accident.
 * ==================================================================== */

export const SEVERITY_ORDER: Readonly<Record<Severity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

/** `severity` is at or above `floor` on the ladder. */
export function severityAtOrAbove(severity: Severity, floor: Severity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[floor]
}

/* ==================================================================== *
 * §2  THE GATE — `ApprovalConfig`, minus what cannot be read, plus an
 *     exponent.
 * ==================================================================== */

/**
 * The three terms of `ApprovalConfig` this evaluator can answer.
 *
 * 🛑 `mandatoryAtOrAboveValue` IS A `Money` HERE AND A `MoneyAmount` ON
 *    `ApprovalConfig`, AND THE DIFFERENCE IS THE ONE FIELD THAT MAKES THE
 *    COMPARISON SAFE. `MoneyAmount` is `{currency, amountMinor}` with NO
 *    EXPONENT, and `model/policy.ts` says what that costs: the two *"are
 *    compared by `amountMinor` directly once the exponent is known"* — which
 *    is a comparison whose correctness lives at the call site, which is the
 *    shape G111 refuses for money.
 *
 *    So the threshold is lifted to a `Money` before it gets here, and the
 *    comparison goes through `compareMoney()` — which REFUSES across
 *    currencies OR exponents rather than returning a number that looks fine.
 *    `db/migrations/0059_resolution_chain.sql` stores
 *    `mandatory_value_exponent` for exactly this reason and for no other.
 *
 * ⚠️ `approvers` AND `escalateAfterHours` ARE DELIBERATELY ABSENT. See the
 *    header for `approvers`; `escalateAfterHours` is a SWEEP's input and this
 *    is not a sweep.
 */
export interface ApprovalGate {
  /** `ApprovalConfig.quorum`. Distinct approvers required. >1 is four-eyes. */
  readonly quorum: number
  /** Severity at or above which approval is mandatory regardless of value. */
  readonly mandatoryAtOrAbove: Severity
  /** Value at or above which approval is mandatory regardless of severity. */
  readonly mandatoryAtOrAboveValue: Money | null
  /** The approver may not be the proposer. */
  readonly segregationOfDuties: boolean
}

/**
 * ⚠️ A NAME-LEVEL PIN AND NOT A SHAPE-LEVEL ONE, AND THE LIMIT IS STATED SO
 * NOBODY READS MORE INTO IT. `mandatoryAtOrAboveValue` has a DIFFERENT TYPE
 * here from the one it has on `ApprovalConfig` (see the field), so a structural
 * assertion is unavailable. What this catches is a RENAME: if
 * `ApprovalConfig.quorum` becomes `ApprovalConfig.minimumApprovers`, this is a
 * `TS2344` in the module that evaluates it rather than a gate that quietly
 * stops being the one the policy declares.
 */
export type _ApprovalGateNamesApprovalConfigFields = Assert<
  [keyof ApprovalGate] extends [keyof ApprovalConfig] ? true : false
>

/* ==================================================================== *
 * §3  THE PROPOSAL UNDER APPROVAL
 * ==================================================================== */

/** One `ApprovalDecision`, reduced to what the count and the order need. */
export interface ApprovalRecord {
  readonly decidedBy: UserId
  readonly decision: 'approved' | 'rejected'
  readonly decidedAt: Timestamp
}

/**
 * `ProposalActor`, reduced to the one question segregation asks of it.
 *
 * 🛑 THE AGENT ARM CARRIES NO ID, AND THAT ABSENCE IS THE POINT.
 *    `model/policy.ts` records that `segregationOfDuties` is *"VACUOUS WHEN
 *    THE PROPOSER IS AN AGENT … `approver !== proposer` is trivially true
 *    against `{ kind: 'agent' }`, so the flag reads as satisfied while
 *    asserting nothing at all."* Giving the arm a `userId` here would let this
 *    evaluator quietly compare against one and report the vacuous case as a
 *    satisfied control. It has none, so `segregationViolated()` cannot
 *    accidentally pass — it answers `false` and the caller must read the
 *    `vacuous` flag on the verdict, which is the whole of why that flag exists.
 */
export type ProposerRef =
  | { readonly kind: 'user'; readonly userId: UserId }
  | { readonly kind: 'agent' }

export interface ProposalUnderApproval {
  readonly proposedBy: ProposerRef
  /** Every decision on THIS proposal, in the order they were taken. */
  readonly decisions: readonly ApprovalRecord[]
  /** A newer proposal exists on the same exception. */
  readonly superseded: boolean
  /** This proposal has already been executed. */
  readonly executed: boolean
  /** The exception carries a resolution — from this proposal or another. */
  readonly exceptionResolved: boolean
  readonly severity: Severity
  /**
   * The greater of `Exception.valueAtRisk` and the proposal's `adjustment` —
   * *"on EVERY execution path including manual"*. Null when the finding is
   * non-monetary and no adjustment was stated: **not zero.** A non-monetary
   * finding is not below the threshold, it is outside the question.
   */
  readonly atRisk: Money | null
}

/* ==================================================================== *
 * §4  THE VERDICT
 * ==================================================================== */

/**
 * The five states, and the contract carries the definitive gloss on each. The
 * one to read is the third: *"APPROVED AND NOT EXECUTABLE … the state a client
 * most often gets wrong, rendering a green tick over an exception nobody has
 * authorised to move money."*
 */
export const APPROVAL_STATES = {
  notApproved: 'not_approved',
  rejected: 'rejected',
  approvedPendingSecondApprover: 'approved_pending_second_approver',
  executable: 'executable',
  executed: 'executed',
} as const
export type ApprovalState = (typeof APPROVAL_STATES)[keyof typeof APPROVAL_STATES]

/**
 * Why it is not executable, in the model's own vocabulary.
 *
 * ⚠️ THESE ARE NOT `ErrorCode`s AND MUST NOT BECOME THEM. `errors.yaml`'s enum
 *    is a WIRE vocabulary; importing it into `model/` would make the domain
 *    model depend on a contract file, which is the dependency this repository
 *    runs the other way round. `server/data-plane/resolution-vocabulary.ts`
 *    maps these to codes in one total `Record`, so a blocker added here is a
 *    compile error there rather than a code nobody publishes.
 */
export const APPROVAL_BLOCKERS = {
  /** Fewer distinct approvers than `quorum`. */
  quorumUnmet: 'quorum_unmet',
  /** Somebody rejected it. Terminal for this proposal. */
  rejected: 'rejected',
  /** A newer proposal exists on this exception. */
  superseded: 'superseded',
  /** The exception already carries a resolution. */
  exceptionResolved: 'exception_resolved',
} as const
export type ApprovalBlocker = (typeof APPROVAL_BLOCKERS)[keyof typeof APPROVAL_BLOCKERS]

export interface ApprovalVerdict {
  readonly state: ApprovalState
  /** Empty exactly when `state` is `executable` or `executed`. */
  readonly blockedBy: readonly ApprovalBlocker[]
  /**
   * Whether the gate applies at all. False means the disposition may resolve
   * without approval — `mandatoryAtOrAbove`'s own field comment — and it is a
   * separate fact from `state`, because a client that read `executable` alone
   * could not tell an unapproved-and-unneeded proposal from an approved one.
   */
  readonly approvalRequired: boolean
  /**
   * DISTINCT approvers, in the order they first approved. This is the
   * `approvedBy: UserId[]` the model's `approved` resolution arm requires —
   * *"EVERY approver, not one. Quorum may exceed 1 and four-eyes means two
   * names."*
   */
  readonly approvedBy: readonly UserId[]
  /**
   * 🛑 TRUE WHEN `segregationOfDuties` IS SET AND THE PROPOSER IS AN AGENT —
   *    the case `model/policy.ts` calls *"worse than absent"*. A caller that
   *    renders "four-eyes: satisfied" without reading this is publishing the
   *    false assurance that field comment is about.
   */
  readonly segregationVacuous: boolean
  /**
   * 🛑 SET WHEN THE THRESHOLD COMPARISON WAS REFUSED — a mismatched currency or
   *    exponent between `atRisk` and `mandatoryAtOrAboveValue`. **The verdict
   *    then treats approval as REQUIRED**, which is the fail-closed direction:
   *    a threshold nobody could evaluate must not read as "below it". The
   *    caller publishes nothing and refuses; a `MoneyRefusal` that reached a
   *    200 would be a comparison silently skipped.
   */
  readonly thresholdUnevaluable: boolean
}

/* ==================================================================== *
 * §5  THE TWO PREDICATES, AND THEN THE VERDICT THAT USES THEM
 * ==================================================================== */

/**
 * The four-eyes comparison, alone, because `decideApproval` must answer it
 * BEFORE a decision row exists and `approvalState()` answers about a set of
 * rows that already do.
 *
 * ⚠️ IT ANSWERS `false` FOR AN AGENT PROPOSER AND THAT IS NOT A PASS. See
 *    `ProposerRef` and `ApprovalVerdict.segregationVacuous`.
 */
export function segregationViolated(
  gate: ApprovalGate,
  proposedBy: ProposerRef,
  approver: UserId,
): boolean {
  if (!gate.segregationOfDuties) return false
  if (proposedBy.kind !== 'user') return false
  return proposedBy.userId === approver
}

/**
 * Whether approval is mandatory at all. TWO INDEPENDENT GATES, either of which
 * arms it — severity, and value. `model/policy.ts` records why the second
 * exists: *"a person could execute a disposition of unbounded value on a
 * low-severity exception with no procedure attached and no approval
 * whatsoever — and severity is deliberately decoupled from value elsewhere in
 * this model, so 'high value implies high severity' was never available as a
 * defence."*
 *
 * Returns the verdict AND whether the money comparison could be made, because
 * an unevaluable threshold must arm the gate rather than disarm it.
 */
export function approvalRequiredFor(
  gate: ApprovalGate,
  severity: Severity,
  atRisk: Money | null,
): { readonly required: boolean; readonly thresholdUnevaluable: boolean } {
  if (severityAtOrAbove(severity, gate.mandatoryAtOrAbove)) {
    return { required: true, thresholdUnevaluable: false }
  }
  const floor = gate.mandatoryAtOrAboveValue
  if (floor === null) return { required: false, thresholdUnevaluable: false }
  /* A non-monetary finding is OUTSIDE the question rather than below it. */
  if (atRisk === null) return { required: false, thresholdUnevaluable: false }

  const compared = compareMoney(atRisk, floor)
  if (!compared.ok) {
    /* Fail closed. See `ApprovalVerdict.thresholdUnevaluable`. */
    return { required: true, thresholdUnevaluable: true }
  }
  return { required: compared.value >= 0, thresholdUnevaluable: false }
}

/**
 * THE EVALUATOR.
 *
 * 🛑 THE ORDER OF THE BRANCHES IS THE SPECIFICATION AND IS NOT ARBITRARY.
 *    `executed` first, because a proposal that ran is done whatever else is
 *    true of it; then `rejected`, which is terminal for THIS proposal; then
 *    the two conditions that are about the EXCEPTION rather than the proposal.
 *    Only then is the quorum counted — counting first and reporting
 *    `quorum_unmet` on a superseded proposal would send a caller to find a
 *    second approver for something nobody is looking at.
 *
 * ⚠️ `count(DISTINCT)` AND NOT `length`. *"`quorum` counts DISTINCT approvers
 *    of one proposal"*, so a person who approves twice does not become two
 *    people. The database keeps both rows — a decision is an act — and this is
 *    where the duplicate stops counting.
 *
 * ⚠️ A LATER `rejected` BEATS AN EARLIER `approved`, AND THE CONVERSE IS ALSO
 *    TRUE: any rejection at all is terminal, regardless of order. The contract
 *    puts `rejected` in `execution.state` as a state and not as a tally, and
 *    `decideApproval`'s own 409 says a rejected proposal cannot be decided
 *    again — so a rejection cannot be outvoted, only superseded by a new
 *    proposal.
 */
export function approvalState(
  gate: ApprovalGate,
  proposal: ProposalUnderApproval,
): ApprovalVerdict {
  const seen = new Set<string>()
  const approvedBy: UserId[] = []
  let anyRejection = false
  for (const d of proposal.decisions) {
    if (d.decision === 'rejected') {
      anyRejection = true
      continue
    }
    if (seen.has(d.decidedBy)) continue
    seen.add(d.decidedBy)
    approvedBy.push(d.decidedBy)
  }

  const gateArmed = approvalRequiredFor(gate, proposal.severity, proposal.atRisk)
  const segregationVacuous = gate.segregationOfDuties && proposal.proposedBy.kind !== 'user'

  const base = {
    approvalRequired: gateArmed.required,
    approvedBy,
    segregationVacuous,
    thresholdUnevaluable: gateArmed.thresholdUnevaluable,
  } as const

  if (proposal.executed) {
    return { ...base, state: APPROVAL_STATES.executed, blockedBy: [] }
  }
  if (anyRejection) {
    return {
      ...base,
      state: APPROVAL_STATES.rejected,
      blockedBy: [APPROVAL_BLOCKERS.rejected],
    }
  }
  if (proposal.superseded) {
    return {
      ...base,
      state: APPROVAL_STATES.notApproved,
      blockedBy: [APPROVAL_BLOCKERS.superseded],
    }
  }
  if (proposal.exceptionResolved) {
    return {
      ...base,
      state: APPROVAL_STATES.notApproved,
      blockedBy: [APPROVAL_BLOCKERS.exceptionResolved],
    }
  }
  if (!gateArmed.required) {
    return { ...base, state: APPROVAL_STATES.executable, blockedBy: [] }
  }
  if (approvedBy.length >= gate.quorum) {
    return { ...base, state: APPROVAL_STATES.executable, blockedBy: [] }
  }
  return {
    ...base,
    /* `not_approved` is "nobody has decided"; anything else short of quorum is
       the approved-and-not-executable state the contract says clients get
       wrong most often. */
    state:
      approvedBy.length === 0
        ? APPROVAL_STATES.notApproved
        : APPROVAL_STATES.approvedPendingSecondApprover,
    blockedBy: [APPROVAL_BLOCKERS.quorumUnmet],
  }
}

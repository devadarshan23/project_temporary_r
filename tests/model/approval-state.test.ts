/**
 * G658 — `ApprovalConfig.quorum` AND `segregationOfDuties`, EVALUATED, AND THE
 * DIFFERENTIAL THAT MAKES THE EVALUATOR MEAN ANYTHING.
 *
 * 🛑 WHY THE ALLOW ARM IS THE FIRST ASSERTION IN THIS FILE. Before
 * `model/approval.ts` existed, `grep -rn distinctHolders model/ server/ tests/`
 * returned the declaration, three literal `2`s and two equality assertions —
 * **zero evaluators** — and `segregationOfDuties` was a boolean nothing read. A
 * new evaluator that refuses everything is behaviourally indistinguishable from
 * the nothing it replaced: *"a control whose only observable behaviour is
 * refusal is `docs/HANDOFF.md` §5.6 until something witnesses it deciding."* So
 * §1 says `executable`, and every assertion after it removes exactly one term
 * and requires the block back BY NAME.
 *
 * ⚠️ EVERY EXPECTED VALUE BELOW IS A STRING LITERAL TYPED INTO THIS FILE, for
 *    `tests/model/access-decide.test.ts`'s reason:
 *    `assert.equal(APPROVAL_STATES.x, APPROVAL_STATES.x)` passes forever and
 *    witnesses nothing. The constants appear only as PINS, on their own lines,
 *    so that renaming a key is a failure rather than a silent agreement.
 *
 * ⚠️ WHAT A GREEN RUN HERE DOES NOT PROVE. This is the evaluator alone, over
 *    fixtures typed into this file. That the DATABASE refuses the same
 *    violation is `tests/db/resolution-chain.test.ts` §6, and that a caller
 *    meets it over a socket is `tests/http/proposal-chain-served.test.ts` §7.
 *    **Three places, one predicate, and the mirror is only a mirror because
 *    all three are asserted.**
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  APPROVAL_BLOCKERS,
  APPROVAL_STATES,
  SEVERITY_ORDER,
  approvalRequiredFor,
  approvalState,
  segregationViolated,
  severityAtOrAbove,
  type ApprovalGate,
  type ApprovalRecord,
  type ProposalUnderApproval,
} from '../../model/approval.ts'
import { SEVERITIES } from '../../model/domain.ts'
import type { Money } from '../../model/domain.ts'
import type { Timestamp, UserId } from '../../model/kernel.ts'

const MEI = 'usr_ops_mei' as UserId
const VIK = 'usr_ops_vik' as UserId
const CHEN = 'usr_ops_chen' as UserId

const sgd = (minor: bigint): Money => ({ currency: 'SGD', amountMinor: minor, exponent: 2 })

const approved = (by: UserId, at: string): ApprovalRecord => ({
  decidedBy: by,
  decision: 'approved',
  decidedAt: at as Timestamp,
})

const rejected = (by: UserId, at: string): ApprovalRecord => ({
  decidedBy: by,
  decision: 'rejected',
  decidedAt: at as Timestamp,
})

/** Four-eyes, a severity floor of `critical`, no money floor. */
const FOUR_EYES: ApprovalGate = {
  quorum: 2,
  mandatoryAtOrAbove: 'critical',
  mandatoryAtOrAboveValue: null,
  segregationOfDuties: true,
}

const baseProposal: ProposalUnderApproval = {
  proposedBy: { kind: 'user', userId: MEI },
  decisions: [],
  superseded: false,
  executed: false,
  exceptionResolved: false,
  severity: 'critical',
  atRisk: sgd(90000n),
}

describe('the approval evaluator — the one place four eyes are counted', () => {
  /* ================================================================ *
   * §1 · THE LADDER, BECAUSE EVERY THRESHOLD BELOW RESTS ON IT.
   * ================================================================ */

  it('1 · the severity ladder ascends, and it is the INVERSE of `Exception.severityRank`', () => {
    /* 🛑 THE INVERSION IS THE ASSERTION. The column is 0-is-critical because a
       queue sorts `severity_rank ASC`; this is 3-is-critical because a
       THRESHOLD reads "at or above". Two orderings of one ladder is one too
       many, and collapsing them would invert one of the two readers — so this
       pins them apart rather than letting them drift into agreement. */
    assert.equal(SEVERITY_ORDER.critical, 3)
    assert.equal(SEVERITY_ORDER.high, 2)
    assert.equal(SEVERITY_ORDER.medium, 1)
    assert.equal(SEVERITY_ORDER.low, 0)

    /* And it is TOTAL over the model's own set, in both directions, so a fifth
       severity is caught here as well as by `tsc`. */
    assert.deepEqual(
      Object.keys(SEVERITY_ORDER).sort(),
      Object.values(SEVERITIES).sort(),
      'the ladder and `SEVERITIES` name different sets. A severity with no rank compares as ' +
        '`undefined >= n`, which is `false` — so a new severity would silently never reach ' +
        'any threshold.',
    )

    assert.equal(severityAtOrAbove('critical', 'high'), true)
    assert.equal(severityAtOrAbove('high', 'high'), true, '"at or above" must include "at"')
    assert.equal(severityAtOrAbove('medium', 'high'), false)
  })

  /* ================================================================ *
   * §2 · THE ALLOW ARM. Everything after this removes ONE term.
   * ================================================================ */

  it('2 · two distinct approvers on a four-eyes gate make it EXECUTABLE', () => {
    const verdict = approvalState(FOUR_EYES, {
      ...baseProposal,
      decisions: [approved(VIK, '2026-09-19T10:00:00.000Z'), approved(CHEN, '2026-09-19T11:00:00.000Z')],
    })
    assert.equal(
      verdict.state,
      'executable',
      'THE EVALUATOR REFUSES EVERYTHING. Before this file, quorum and segregation had ZERO ' +
        'evaluators; an evaluator that never permits is indistinguishable from that.',
    )
    assert.equal(APPROVAL_STATES.executable, 'executable')
    assert.deepEqual(verdict.blockedBy, [])
    assert.equal(verdict.approvalRequired, true)
    assert.deepEqual(
      verdict.approvedBy,
      [VIK, CHEN],
      '`approvedBy` is the model’s `approved` arm — *"EVERY approver, not one"* — in the ' +
        'order they approved.',
    )
    assert.equal(verdict.segregationVacuous, false)
    assert.equal(verdict.thresholdUnevaluable, false)
  })

  /* ================================================================ *
   * §3 · ONE TERM REMOVED AT A TIME.
   * ================================================================ */

  it('3a · ONE approver against a quorum of two is APPROVED-AND-NOT-EXECUTABLE', () => {
    const verdict = approvalState(FOUR_EYES, {
      ...baseProposal,
      decisions: [approved(VIK, '2026-09-19T10:00:00.000Z')],
    })
    /* 🛑 THE STATE THE CONTRACT SAYS CLIENTS GET WRONG MOST OFTEN:
       *"approved, recorded, signed, and still not executable … a green tick
       over an exception nobody has authorised to move money."* */
    assert.equal(verdict.state, 'approved_pending_second_approver')
    assert.equal(APPROVAL_STATES.approvedPendingSecondApprover, 'approved_pending_second_approver')
    assert.deepEqual(verdict.blockedBy, ['quorum_unmet'])
    assert.equal(APPROVAL_BLOCKERS.quorumUnmet, 'quorum_unmet')
  })

  it('3b · NO approver is `not_approved`, which is a different fact from 3a', () => {
    const verdict = approvalState(FOUR_EYES, baseProposal)
    assert.equal(verdict.state, 'not_approved')
    assert.equal(APPROVAL_STATES.notApproved, 'not_approved')
    assert.deepEqual(verdict.blockedBy, ['quorum_unmet'])
    assert.deepEqual(verdict.approvedBy, [])
  })

  it('3c · THE SAME PERSON TWICE IS ONE PERSON — `count(DISTINCT)`, not `length`', () => {
    /* 🛑 THE ONE LINE THAT WOULD MAKE FOUR EYES INTO TWO. `quorum` counts
       DISTINCT approvers, and the database keeps both rows because a decision
       is an act — so the de-duplication has to happen HERE, and a `.length`
       would let one approver clear a quorum of two by clicking twice. */
    const verdict = approvalState(FOUR_EYES, {
      ...baseProposal,
      decisions: [approved(VIK, '2026-09-19T10:00:00.000Z'), approved(VIK, '2026-09-19T12:00:00.000Z')],
    })
    assert.equal(
      verdict.state,
      'approved_pending_second_approver',
      'ONE APPROVER CLEARED A QUORUM OF TWO BY APPROVING TWICE. `quorum` counts DISTINCT ' +
        'approvers; a `.length` over the decision rows is four eyes belonging to one head.',
    )
    assert.deepEqual(verdict.approvedBy, [VIK])
  })

  it('3d · a REJECTION is terminal and beats any number of approvals, in either order', () => {
    for (const decisions of [
      [rejected(VIK, '2026-09-19T10:00:00.000Z'), approved(CHEN, '2026-09-19T11:00:00.000Z')],
      [approved(CHEN, '2026-09-19T10:00:00.000Z'), rejected(VIK, '2026-09-19T11:00:00.000Z')],
      [
        approved(CHEN, '2026-09-19T10:00:00.000Z'),
        rejected(VIK, '2026-09-19T11:00:00.000Z'),
        approved(MEI, '2026-09-19T12:00:00.000Z'),
      ],
    ]) {
      const verdict = approvalState(FOUR_EYES, { ...baseProposal, decisions })
      assert.equal(
        verdict.state,
        'rejected',
        'a rejection was OUTVOTED. The contract puts `rejected` in `execution.state` as a ' +
          'STATE and not as a tally, and `decideApproval`’s own 409 says a rejected proposal ' +
          'cannot be decided again — so it can be superseded by a new proposal and by nothing ' +
          'else.',
      )
      assert.deepEqual(verdict.blockedBy, ['rejected'])
    }
  })

  it('3e · a SUPERSEDED proposal blocks before the quorum is even counted', () => {
    /* 🛑 THE ORDER OF THE BRANCHES IS THE SPECIFICATION. Counting first and
       reporting `quorum_unmet` on a superseded proposal would send a caller to
       find a second approver for something nobody is looking at. */
    const verdict = approvalState(FOUR_EYES, { ...baseProposal, superseded: true })
    assert.deepEqual(verdict.blockedBy, ['superseded'])
    assert.equal(APPROVAL_BLOCKERS.superseded, 'superseded')
  })

  it('3f · an EXECUTED proposal is `executed` whatever else is true of it', () => {
    const verdict = approvalState(FOUR_EYES, {
      ...baseProposal,
      executed: true,
      superseded: true,
      exceptionResolved: true,
    })
    assert.equal(verdict.state, 'executed')
    assert.deepEqual(verdict.blockedBy, [], 'the contract: `blockedBy` is empty when executed')
  })

  /* ================================================================ *
   * §4 · SEGREGATION OF DUTIES — THE THING THE CHAIN EXISTS FOR.
   * ================================================================ */

  it('4a · the proposer may not approve their own proposal', () => {
    assert.equal(
      segregationViolated(FOUR_EYES, { kind: 'user', userId: MEI }, MEI),
      true,
      'THE CONTROL IS ABSENT. *"The same person approving their own proposal is not a policy ' +
        'nuance; it is the control being absent."*',
    )
    assert.equal(segregationViolated(FOUR_EYES, { kind: 'user', userId: MEI }, VIK), false)
  })

  it('4b · with `segregationOfDuties: false` the proposer MAY approve — the flag is read', () => {
    /* Without this arm, an evaluator that ignored the flag and always refused
       would pass 4a. The differential is what proves the flag is consulted. */
    const relaxed: ApprovalGate = { ...FOUR_EYES, segregationOfDuties: false }
    assert.equal(segregationViolated(relaxed, { kind: 'user', userId: MEI }, MEI), false)
  })

  it('4c · 🛑 AN AGENT PROPOSER MAKES THE FLAG VACUOUS, AND THE VERDICT SAYS SO', () => {
    /**
     * `model/policy.ts` on `segregationOfDuties`: *"VACUOUS WHEN THE PROPOSER
     * IS AN AGENT, and that is worse than absent. `approver !== proposer` is
     * trivially true against `{ kind: 'agent' }`, so the flag reads as
     * satisfied while asserting nothing at all."*
     *
     * So `segregationViolated()` answers `false` — which is NOT a pass — and
     * the verdict carries `segregationVacuous`, which is the only thing a
     * renderer may distinguish "four eyes: satisfied" from "four eyes: not
     * asked" by.
     */
    assert.equal(segregationViolated(FOUR_EYES, { kind: 'agent' }, MEI), false)

    const verdict = approvalState(FOUR_EYES, {
      ...baseProposal,
      proposedBy: { kind: 'agent' },
      decisions: [approved(VIK, '2026-09-19T10:00:00.000Z'), approved(CHEN, '2026-09-19T11:00:00.000Z')],
    })
    assert.equal(
      verdict.segregationVacuous,
      true,
      'THE VACUOUS CASE IS INVISIBLE. A caller rendering "four-eyes: satisfied" off `state` ' +
        'alone is publishing the false assurance `model/policy.ts` names.',
    )
    /* And a human proposer does NOT set it, so the flag is a differential. */
    assert.equal(approvalState(FOUR_EYES, baseProposal).segregationVacuous, false)
  })

  /* ================================================================ *
   * §5 · WHEN THE GATE IS ARMED AT ALL — TWO INDEPENDENT THRESHOLDS.
   * ================================================================ */

  it('5a · below the severity floor and with no money floor, approval is NOT required', () => {
    const gate: ApprovalGate = { ...FOUR_EYES, mandatoryAtOrAbove: 'critical' }
    const verdict = approvalState(gate, { ...baseProposal, severity: 'low' })
    assert.equal(verdict.approvalRequired, false)
    assert.equal(
      verdict.state,
      'executable',
      '*"Below this severity the disposition may resolve without approval."* A proposal that ' +
        'needs no approval and has none is executable, and `approvalRequired: false` is what ' +
        'tells a client the difference from an approved one.',
    )
  })

  it('5b · the MONEY floor arms the gate independently of severity', () => {
    /**
     * `model/policy.ts`: *"a person could execute a disposition of unbounded
     * value on a low-severity exception with no procedure attached and no
     * approval whatsoever — and severity is deliberately decoupled from value
     * elsewhere in this model, so 'high value implies high severity' was never
     * available as a defence."*
     */
    const gate: ApprovalGate = {
      ...FOUR_EYES,
      mandatoryAtOrAbove: 'critical',
      mandatoryAtOrAboveValue: sgd(50000n),
    }
    const over = approvalState(gate, { ...baseProposal, severity: 'low', atRisk: sgd(90000n) })
    assert.equal(over.approvalRequired, true, 'the money gate did not arm on a low-severity row')
    assert.equal(over.state, 'not_approved')

    const at = approvalState(gate, { ...baseProposal, severity: 'low', atRisk: sgd(50000n) })
    assert.equal(at.approvalRequired, true, '"at or above" must include "at"')

    const under = approvalState(gate, { ...baseProposal, severity: 'low', atRisk: sgd(49999n) })
    assert.equal(under.approvalRequired, false)
  })

  it('5c · a NON-MONETARY finding is OUTSIDE the money question, not below it', () => {
    /* `exception-store.ts`'s sentence, one layer up: *"a non-monetary finding
       is not below the threshold, it is outside the question."* A `null`
       treated as zero would arm nothing, which is the same answer here — but
       a `null` treated as "unknown, so require approval" would arm the gate on
       every KYC finding in the product. */
    const gate: ApprovalGate = {
      ...FOUR_EYES,
      mandatoryAtOrAbove: 'critical',
      mandatoryAtOrAboveValue: sgd(1n),
    }
    const verdict = approvalRequiredFor(gate, 'low', null)
    assert.equal(verdict.required, false)
    assert.equal(verdict.thresholdUnevaluable, false)
  })

  it('5d · 🛑 AN UNEVALUABLE THRESHOLD ARMS THE GATE — fail CLOSED', () => {
    /**
     * `compareMoney()` REFUSES across currencies OR exponents. A comparison
     * nobody could make must not read as "below the threshold": that is scope
     * failing OPEN, which `docs/HANDOFF.md` §5.5 records this codebase already
     * fixing once.
     */
    const gate: ApprovalGate = {
      ...FOUR_EYES,
      mandatoryAtOrAbove: 'critical',
      mandatoryAtOrAboveValue: { currency: 'USD', amountMinor: 50000n, exponent: 2 },
    }
    const verdict = approvalRequiredFor(gate, 'low', sgd(1n))
    assert.equal(
      verdict.required,
      true,
      'A THRESHOLD NOBODY COULD EVALUATE READ AS "BELOW IT". One SGD against a USD ceiling is ' +
        'the USD-invoice-against-SGD-purchase-order defect arriving at the approval gate.',
    )
    assert.equal(verdict.thresholdUnevaluable, true)

    /* And the whole verdict carries it, so a caller can refuse rather than
       publish a gate it cannot explain. */
    const whole = approvalState(gate, { ...baseProposal, severity: 'low', atRisk: sgd(1n) })
    assert.equal(whole.thresholdUnevaluable, true)
  })

  /* ================================================================ *
   * §6 · THE WIRE'S `decidedBy` IS `approvedBy[0]`, PINNED.
   * ================================================================ */

  it('6 · `decidedBy` on the wire is the FIRST approver — the two cannot drift', () => {
    /**
     * `capability.openapi.yaml` now carries BOTH fields and says `decidedBy`
     * is *"a lossy projection of `approvedBy`"*, retained because it is the
     * field every existing reader binds to. This is the pin that makes that
     * sentence true rather than hopeful:
     * `server/data-plane/proposal-store.ts` publishes `verdict.approvedBy[0]`
     * into `resolution_decided_by`, and `approvedBy` is the same array.
     */
    const verdict = approvalState(FOUR_EYES, {
      ...baseProposal,
      decisions: [approved(CHEN, '2026-09-19T10:00:00.000Z'), approved(VIK, '2026-09-19T11:00:00.000Z')],
    })
    assert.equal(verdict.approvedBy[0], CHEN)
    assert.equal(
      verdict.approvedBy.length,
      2,
      'the wire publishes `decidedBy` as one name and `approvedBy` as every name; a quorum ' +
        'of two that published one array entry would have lost a signature.',
    )
  })
})

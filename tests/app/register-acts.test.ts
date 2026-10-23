/**
 * THE REGISTER'S NEXT ACTS — feat/register-next-acts, G3641–G3650 (3 Oct 2026).
 *
 * Every decision `frontend/src/register-acts.ts` makes, under `node --test`
 * with no renderer. The browser half — Accept posting a line and Reopen
 * reversing it, against a real plane — is `tests/e2e/register-acts.test.ts`.
 *
 * Each block was witnessed RED before the repair; the captured failure is
 * quoted on the block.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REPO } from '../design/render.ts'
import { NEXT_ACT } from '../../frontend/src/close-state.ts'
import { DRAW_GATES } from '../../frontend/src/capabilities.ts'
import { PlaneRefused } from '../../frontend/src/api/runs.ts'
import { REOPEN_REASONS, REVERSAL_REASONS, type DispositionSet, type Proposal } from '../../frontend/src/api/resolution.ts'
import {
  REVERSAL_REASON_WORD,
  UNDO_ACCEPT_REASON,
  acceptOutcomeOf,
  actRefusalOf,
  drawnActOf,
  rowDispositionOf,
} from '../../frontend/src/register-acts.ts'
import { NOT_CONFIGURED_TEXT } from '../../frontend/src/resolve-logic.ts'
import { CAPABILITIES } from '../../model/access.ts'

const read = (p: string): string => readFileSync(join(REPO, p), 'utf8')

function set(...ds: { key: string; available?: boolean; requiresAdjustment?: boolean }[]): DispositionSet {
  return {
    archetype: 'n_way_document_match',
    packKey: 'pck_ap',
    dispositions: ds.map((d) => ({
      key: d.key,
      label: d.key.replace(/_/g, ' '),
      family: 'charge_variance',
      reversibility: 'reversible',
      terminal: true,
      requiresAdjustment: d.requiresAdjustment ?? false,
      available: d.available ?? true,
    })),
  }
}

function proposal(state: Proposal['execution']['state'], segregationOfDuties = false): Proposal {
  return {
    proposalId: 'prp_1',
    exceptionId: 'exc_1',
    proposedBy: { kind: 'user', userId: 'usr_me' },
    dispositionKey: 'write_off',
    rationale: 'r',
    evidence: [],
    proposedAt: '2026-10-03T00:00:00Z',
    execution: {
      state,
      approvals: [],
      requiredApprovals: { quorum: 1, segregationOfDuties, mandatoryAtOrAbove: null },
      blockedBy: [],
    },
  }
}

describe('§1 · the act a row DRAWS is narrowed by what the session may do (G3193)', () => {
  /* WITNESSED RED with the accept narrowing deleted: `actual: 'accept',
     expected: 'view'` — a reader without `propose_resolution` was offered an
     Accept the plane refuses. */
  it('Accept needs propose_resolution; Reopen needs reverse_resolution; both fall back to View', () => {
    assert.equal(drawnActOf('accept', { propose: true, reverse: false }, false), 'accept')
    assert.equal(drawnActOf('accept', { propose: false, reverse: true }, true), 'view')
    assert.equal(drawnActOf('reopen', { propose: true, reverse: true }, true), 'reopen')
    assert.equal(drawnActOf('reopen', { propose: true, reverse: false }, true), 'view')
    assert.equal(drawnActOf('view', { propose: false, reverse: false }, true), 'view')
    /* C3-11 — outside the reversal window Reopen is not drawn, whatever the role. */
    assert.equal(drawnActOf('reopen', { propose: true, reverse: true }, false), 'view')
  })

  it('the gates are the operations\' own x-capability, spelled from the closed set', () => {
    assert.equal(DRAW_GATES.acceptLine, CAPABILITIES.proposeResolution)
    assert.equal(DRAW_GATES.postResolution, CAPABILITIES.executeResolution)
    assert.equal(DRAW_GATES.reopenLine, CAPABILITIES.reverseResolution)
    const contract = read('docs/contracts/capability.openapi.yaml')
    for (const [op, cap] of [
      ['proposeResolution', 'propose_resolution'],
      ['executeProposal', 'execute_resolution'],
      ['reverseResolution', 'reverse_resolution'],
    ] as const) {
      assert.match(contract, new RegExp(`operationId: ${op}\\n\\s+x-capability: ${cap}\\n`), `${op} is not gated on ${cap}`)
    }
  })

  it('a cleared line — and only a cleared line — offers Reopen', () => {
    const reopen = Object.entries(NEXT_ACT).filter(([, a]) => a === 'reopen').map(([s]) => s).sort()
    assert.deepEqual(reopen, ['dismissed', 'rejected', 'resolved'])
  })
})

describe('§2 · which disposition the row commits — unambiguous only (G3643)', () => {
  /* WITNESSED RED with a "first available" rule: `actual: { kind: 'one', key:
     'write_off' … }, expected: { kind: 'choose' }` — two available
     dispositions, and the row committed one, a judgement made by the alphabet. */
  it('exactly one available, needing no adjustment, commits from the row', () => {
    assert.deepEqual(rowDispositionOf(set({ key: 'write_off' }, { key: 'escalate', available: false })), {
      kind: 'one', key: 'write_off', label: 'write off',
    })
  })
  it('two available, or one needing an adjustment, is a choice the finding makes', () => {
    assert.deepEqual(rowDispositionOf(set({ key: 'write_off' }, { key: 'credit_note' })), { kind: 'choose' })
    assert.deepEqual(rowDispositionOf(set({ key: 'credit_note', requiresAdjustment: true })), { kind: 'choose' })
  })
  it('nothing available is said, never guessed', () => {
    assert.deepEqual(rowDispositionOf(set({ key: 'write_off', available: false })), { kind: 'none' })
    assert.deepEqual(rowDispositionOf(set()), { kind: 'none' })
  })
  it('the plane serves no default — the contract carries no such field', () => {
    const contract = read('docs/contracts/capability.openapi.yaml')
    const block = contract.slice(contract.indexOf('operationId: listAvailableDispositions'), contract.indexOf('operationId: proposeResolution'))
    assert.equal(/\bdefault(Disposition|Key)?:/.test(block), false, 'a default disposition is served now — G3643 is owed a revisit')
  })
})

describe('§3 · after the proposal, the plane\'s state decides — never this client\'s arithmetic', () => {
  it('executable and holding execute_resolution posts; anything else waits', () => {
    assert.equal(acceptOutcomeOf(proposal('executable'), true), 'post')
    assert.equal(acceptOutcomeOf(proposal('executable'), false), 'waiting')
    for (const s of ['not_approved', 'approved_pending_second_approver', 'rejected'] as const) {
      assert.equal(acceptOutcomeOf(proposal(s, true), true), 'waiting', s)
    }
  })
})

describe('§4 · a refused act — a 409 is a STATE, not an error (G3645)', () => {
  /* WITNESSED RED with every refusal routed through `refusalText()`:
     `AssertionError: exception_already_resolved — actual: 'fail', expected:
     'state'` — a condition of the line told as a failure. */
  it('the contract\'s 409s are calm states', () => {
    for (const code of [
      'exception_already_resolved',
      'approval_segregation_violation',
      'reversal_window_expired',
      'validation_failed',
      'proposal_not_executable',
    ]) {
      const r = actRefusalOf(new PlaneRefused(409, code, 't'))
      assert.equal(r.kind, 'state', code)
      assert.equal(/try again/i.test(r.text), false, `${code} tells the reader to retry`)
    }
  })
  it('resolution_not_configured is its own calm, permanent state (G3441)', () => {
    assert.deepEqual(actRefusalOf(new PlaneRefused(409, 'resolution_not_configured', 't')), {
      kind: 'not-configured', text: NOT_CONFIGURED_TEXT,
    })
  })
  it('a 403 or a 5xx is a failure', () => {
    assert.equal(actRefusalOf(new PlaneRefused(403, 'capability_not_held', 't')).kind, 'fail')
    assert.equal(actRefusalOf(new PlaneRefused(503, 'upstream_unavailable', 't')).kind, 'fail')
    assert.equal(actRefusalOf(new Error('boom')).kind, 'fail')
  })
})

describe('§5 · the reason vocabulary is the contract\'s, in its order', () => {
  it('REVERSAL_REASONS equals the contract enum', () => {
    const contract = read('docs/contracts/capability.openapi.yaml')
    const at = contract.indexOf('    ReversalReason:')
    const enumBlock = contract.slice(contract.indexOf('enum:', at), contract.indexOf('\n\n', at))
    const wire = [...enumBlock.matchAll(/^\s+- ([a-z_]+)$/gm)].map((m) => m[1])
    assert.deepEqual([...REVERSAL_REASONS], wire)
  })
  it('the two that indict autonomy are the contract\'s two', () => {
    const indicting = REVERSAL_REASONS.filter((r) => REVERSAL_REASON_WORD[r].indicts)
    assert.deepEqual(indicting, ['wrong_disposition', 'insufficient_evidence'])
    /* G3883 — Undo sends the owner's non-indicting reason (C3-12, G3811). */
    assert.equal(UNDO_ACCEPT_REASON, 'undone_by_actor')
    assert.equal(REVERSAL_REASON_WORD[UNDO_ACCEPT_REASON].indicts, false)
  })
  it('Reopen offers every reason but the actor\'s own Undo (G3883)', () => {
    assert.deepEqual([...REOPEN_REASONS], REVERSAL_REASONS.filter((r) => r !== 'undone_by_actor'))
    const dialog = read('frontend/src/components/ReopenDialog.tsx')
    assert.match(dialog, /REOPEN_REASONS\.map\(/)
    assert.doesNotMatch(dialog, /REVERSAL_REASONS\.map\(/)
  })
})

describe('§6 · the register drives them — nothing quiet left on the two acts', () => {
  /* WITNESSED RED against origin/main: `<Soon className="rowact" commit=…>`
     was the only drawing of Accept and Reopen. */
  it('ExceptionRegister renders a live control for Accept and Reopen', () => {
    const src = read('frontend/src/components/ExceptionRegister.tsx')
    assert.match(src, /'data-accept': row\.exceptionId/)
    assert.match(src, /'data-reopen': row\.exceptionId/)
    assert.equal(/<Soon className="rowact" commit=\{act === 'accept'\}>/.test(src), false)
  })
})

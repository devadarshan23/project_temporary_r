/**
 * RED-TEAM ROUND THREE, THE FRONTEND HALF — fix/c1-round4-frontend,
 * G3831–G3855, 4 Oct 2026. `docs/build/ui-audit/red-c1-round3.md`.
 *
 * Every decision this slice made lives in a `.ts` module so it is reached here
 * with no renderer (`completeness.ts`'s reason); where the property is that a
 * component WRITES a gate or does NOT write an id, the assertion is a source
 * scan and says so. The browser half — each surface rendered in Chromium as
 * admin, approver, operator and viewer — is recorded in `docs/HANDOFF.md`.
 *
 * WITNESSED RED — §1 by `tsc` against the tree before this slice
 * (`origin/main` at `09b90f58`); §3, §4, §6 and §8 by MUTATION of the shipped
 * code back to the old behaviour, each failing exactly its section:
 *
 *   §1  `tsc` — `RunAccount.tsx(404,46): error TS2345: Argument of type
 *       'number | null' is not assignable to parameter of type 'number'` the
 *       moment `ResidueEntry.lineIndex` was typed as the wire serves it.
 *   §3  `actsFor(p, viewer)` took no capability: a viewer was offered Approve.
 *   §4  `approvalsCounted()` said 0 of 2 needed on a below-threshold line.
 *   §6  `scopedClaimOf()` was the only claim: "Ten of the twenty … need you"
 *       for the viewer and the approver.
 *   §8  `rowDispositionOf()` returned `one` for a lone non-terminal choice.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REPO } from '../design/render.ts'
import type { ResidueEntry } from '../../frontend/src/api/runs.ts'
import type { Proposal } from '../../frontend/src/api/resolution.ts'
import {
  NOT_YOUR_ROLE,
  documentNameOf,
  documentNamesOf,
  emptyResidueSentenceOf,
  lineCellOf,
  readRefusalSentenceOf,
} from '../../frontend/src/run-account-words.ts'
import {
  actsFor,
  approvalNeeded,
  personWord,
  proposedSentenceOf,
  waitsOnApprovalOf,
} from '../../frontend/src/resolve-logic.ts'
import { proposalStateWordOf } from '../../frontend/src/words.ts'
import { claimRoleOf, roleClaimOf, scopedClaimOf } from '../../frontend/src/close-state.ts'
import {
  REVERSAL_WINDOW_MS,
  TO_FINDING_NOTICE,
  reopenWindowOpen,
  rowDispositionOf,
} from '../../frontend/src/register-acts.ts'
import { DRAW_GATES } from '../../frontend/src/capabilities.ts'

const src = (rel: string): string => readFileSync(join(REPO, 'frontend', 'src', rel), 'utf8')

function proposal(o: {
  readonly state?: Proposal['execution']['state']
  readonly approvals?: Proposal['execution']['approvals']
  readonly quorum?: number
  readonly segregation?: boolean
  readonly by?: string
} = {}): Proposal {
  return {
    proposalId: 'prp_1',
    exceptionId: 'exc_1',
    proposedBy: { kind: 'user', userId: o.by ?? 'usr_raj' },
    dispositionKey: 'carry',
    rationale: 'r',
    evidence: [],
    proposedAt: '2026-10-04T09:00:00.000Z',
    execution: {
      state: o.state ?? 'not_approved',
      approvals: o.approvals ?? [],
      requiredApprovals: { quorum: o.quorum ?? 2, segregationOfDuties: o.segregation ?? true, mandatoryAtOrAbove: 'high' },
      blockedBy: [],
    },
  }
}

describe('§1 · C3-01 — the run page survives a whole-file residue item', () => {
  it('the wire type admits a null line, and the cell says it in words', () => {
    /* A compile-time witness: before this slice this literal was `TS2322`. */
    const item: ResidueEntry = {
      side: 'left',
      ref: { sourceDocumentId: 'sdo_demo_1', lineIndex: null },
      settlement: null,
      disposition: 'unmatched',
      cause: { kind: 'no_candidate' },
    }
    assert.equal(lineCellOf(item.ref.lineIndex), 'Whole file')
    assert.equal(lineCellOf(1234), '1,234')
  })
  it('the residue table no longer hands the nullable line to countOf()', () => {
    assert.equal(/countOf\(row\.ref\.lineIndex\)/.test(src('components/RunAccount.tsx')), false)
    assert.match(src('components/RunAccount.tsx'), /lineCellOf\(row\.ref\.lineIndex\)/)
  })
})

describe('§2 · C3-13 / C3-27 — the run page in plain words', () => {
  it('documents are named by their place in the run, never by id', () => {
    const names = documentNamesOf(['sdo_b', 'sdo_a', 'sdo_b'])
    assert.equal(documentNameOf(names, 'sdo_b'), 'File 1')
    assert.equal(documentNameOf(names, 'sdo_a'), 'File 2')
    assert.equal(documentNameOf(names, 'sdo_zzz'), 'A file')
    assert.equal(/<td className="mono">\{(doc\.sourceDocumentId|row\.ref\.sourceDocumentId)\}<\/td>/.test(src('components/RunAccount.tsx')), false)
  })
  it('a refused run does not claim every line was closed', () => {
    assert.doesNotMatch(emptyResidueSentenceOf('refused'), /closed|matched\. Nothing/i)
    assert.match(emptyResidueSentenceOf('produced'), /Every line was matched/)
    assert.equal(/The engine closed every line/.test(src('components/RunAccount.tsx')), false)
  })
  it('a role refusal is told as a role, never "try again"', () => {
    assert.equal(readRefusalSentenceOf({ status: 403 }), NOT_YOUR_ROLE)
    assert.doesNotMatch(NOT_YOUR_ROLE, /try again/i)
    assert.match(readRefusalSentenceOf({ status: 500 }), /Try again/)
    assert.match(readRefusalSentenceOf(null), /Try again/)
  })
})

describe('§3 · C3-03 — refused controls are hidden (G3193)', () => {
  it('Approve/Refuse need approve_resolution; Post it needs execute_resolution', () => {
    const waiting = proposal({ by: 'usr_raj' })
    assert.equal(actsFor(waiting, 'usr_viewer', { decide: false, post: false }).mayDecide, false, 'a viewer was offered Approve')
    assert.equal(actsFor(waiting, 'usr_appr', { decide: true, post: false }).mayDecide, true)
    const ready = proposal({ state: 'executable' })
    assert.equal(actsFor(ready, 'usr_appr', { decide: true, post: false }).mayPost, false, 'an approver without execute was offered Post it')
    assert.equal(actsFor(ready, 'usr_admin', { decide: true, post: true }).mayPost, true)
  })
  it('the propose form is drawn only under propose_resolution — the gate precedes the form', () => {
    const r = src('components/Resolve.tsx')
    assert.match(r, /const mayPropose = useHolds\(DRAW_GATES\.acceptLine\)/)
    const gate = r.indexOf('if (!mayPropose)')
    const form = r.indexOf('data-resolve="propose"')
    assert.ok(gate !== -1 && form !== -1 && gate < form, 'Resolve.tsx draws the propose form without its gate')
    assert.equal(DRAW_GATES.acceptLine, 'propose_resolution')
  })
  it('the post page and the queue read the session’s verbs, not the proposal’s state alone', () => {
    const a = src('components/Approvals.tsx')
    assert.match(a, /decide: useHolds\(DRAW_GATES\.approvals\), post: useHolds\(DRAW_GATES\.postResolution\)/)
    assert.equal(/actsFor\([^,()]+, [^,()]+\)/.test(a), false, 'an actsFor() call without the session’s verbs')
  })
})

describe('§4 · C3-04 — the four-eyes panel says what model/approval.ts will do', () => {
  it('an executable proposal with fewer approvers than the quorum needed none', () => {
    const below = proposal({ state: 'executable', approvals: [], quorum: 2 })
    assert.equal(approvalNeeded(below), false)
    assert.equal(proposalStateWordOf('executable', false), 'Ready to post · no approval needed')
    assert.doesNotMatch(proposedSentenceOf(below, true), /waits on an approver/)
  })
  it('above the threshold an approval is owed, and the words say so', () => {
    const owed = proposal({ state: 'not_approved', quorum: 2 })
    assert.equal(approvalNeeded(owed), true)
    assert.match(proposedSentenceOf(owed, true), /waits on an approver, and you cannot approve your own proposal/)
    const met = proposal({
      state: 'executable',
      quorum: 1,
      approvals: [{ decidedBy: 'usr_b', decidedByName: null, decidedByFormerMember: false, decision: 'approved', decidedAt: 'x' }],
    })
    assert.equal(approvalNeeded(met), true)
    assert.equal(proposalStateWordOf('executable', true), 'Approved · ready to post')
  })
})

describe('§5 · C3-05 — people by name, never by id', () => {
  it('the reader is "you"; a named person is their name; anyone else is a neutral word', () => {
    assert.equal(personWord('usr_r3_admin', 'usr_r3_admin'), 'you')
    assert.equal(personWord('usr_demo_rosalie_tan', 'usr_x', 'Rosalie Tan'), 'Rosalie Tan')
    assert.equal(personWord('usr_demo_rosalie_tan', 'usr_x'), 'a colleague')
    assert.equal(personWord('usr_demo_rosalie_tan', null, '  '), 'a colleague')
    assert.doesNotMatch(personWord('usr_demo_rosalie_tan', 'usr_x', null), /usr_/)
  })
  it('no surface prints a raw user id', () => {
    const a = src('components/Approvals.tsx')
    assert.equal(/>\{a\.decidedBy\}</.test(a), false)
    assert.equal(/\{posted\.resolution\.executedBy\}/.test(a), false)
    assert.equal(/approvedBy \?\? \[\]\)\.join/.test(a), false)
    assert.equal(/\{proposer \?\? 'someone'\}/.test(a), false)
    assert.equal(/\{f\.assignedTo\}/.test(src('components/Finding.tsx')), false)
  })
})

describe('§6 · C3-07 — the owner’s role sentences', () => {
  const scope = { label: 'Three-way match', status: 'completed' as const }
  it('the role is read off the verbs: propose or take → actor, approve → approver, else viewer', () => {
    assert.equal(claimRoleOf({ act: true, approve: true }), 'actor')
    assert.equal(claimRoleOf({ act: false, approve: true }), 'approver')
    assert.equal(claimRoleOf({ act: false, approve: false }), 'viewer')
    assert.equal(DRAW_GATES.takeLine, 'assign_exception')
  })
  it('viewer: "N open exceptions in this run"', () => {
    assert.equal(roleClaimOf('viewer', { needs: 10, total: 20, open: 12, approvals: null }, scope), 'Twelve open exceptions in this run.')
    assert.equal(roleClaimOf('viewer', { needs: 10, total: 20, open: 1, approvals: null }, scope), 'One open exception in this run.')
    assert.equal(roleClaimOf('viewer', { needs: 10, total: 20, open: null, approvals: null }, scope), null)
  })
  it('approver: "N proposals wait on your approval"', () => {
    assert.equal(roleClaimOf('approver', { needs: 10, total: 20, open: 12, approvals: 3 }, scope), 'Three proposals wait on your approval.')
    assert.equal(roleClaimOf('approver', { needs: 10, total: 20, open: 12, approvals: 1 }, scope), 'One proposal waits on your approval.')
    assert.equal(roleClaimOf('approver', { needs: 10, total: 20, open: 12, approvals: null }, scope), null)
  })
  it('actors keep "N need you"; an unread principal claims nothing', () => {
    assert.equal(roleClaimOf('actor', { needs: 3, total: 6, open: null, approvals: null }, scope), scopedClaimOf(3, 6, scope))
    assert.equal(roleClaimOf(null, { needs: 3, total: 6, open: 6, approvals: 2 }, scope), null)
  })
  it('C3-29 — when the parts equal the whole the sentence says "all"', () => {
    assert.equal(scopedClaimOf(4, 4, scope), 'All four exceptions in this run of Three-way match need you.')
  })
  it('the chrome draws "Needs you" only for an actor', () => {
    assert.match(src('main.tsx'), /needsYouShown=\{role === 'actor'\}/)
  })
})

describe('§7 · C3-08 / C3-26 — Approvals lists what waits on THIS reader', () => {
  it('a proposal the reader may decide is listed; theirs, a decided one and an executable one are not', () => {
    assert.equal(waitsOnApprovalOf(proposal({ by: 'usr_raj' }), 'usr_appr'), true)
    assert.equal(waitsOnApprovalOf(proposal({ by: 'usr_appr' }), 'usr_appr'), false, 'the proposer of record was asked to approve their own')
    assert.equal(
      waitsOnApprovalOf(
        proposal({ state: 'approved_pending_second_approver', approvals: [{ decidedBy: 'usr_appr', decidedByName: null, decidedByFormerMember: false, decision: 'approved', decidedAt: 'x' }] }),
        'usr_appr',
      ),
      false,
    )
    assert.equal(waitsOnApprovalOf(proposal({ state: 'executable' }), 'usr_appr'), false, 'a proposal waiting on a POSTER was listed')
  })
  it('the queue is no longer drawn under the register; it is the Approvals destination', () => {
    const m = src('main.tsx')
    assert.equal(m.includes('approvals-on-close'), false)
    assert.match(m, /closeDest === 'approvals' && mayApprove/)
  })
})

describe('§8 · C3-10 / C3-21 — the row commits only a disposition that closes the line', () => {
  const set = (terminal: boolean) => ({
    archetype: 'a',
    packKey: null,
    dispositions: [{ key: 'carry', label: 'Carry', family: 'f', reversibility: 'reversible', terminal, requiresAdjustment: false, available: true }],
  })
  it('a lone terminal disposition commits; a lone non-terminal one opens the finding', () => {
    assert.equal(rowDispositionOf(set(true)).kind, 'one')
    assert.equal(rowDispositionOf(set(false)).kind, 'choose')
  })
  it('opening the finding says why — the act pressed did not silently not happen', () => {
    assert.match(TO_FINDING_NOTICE.title, /Choose/)
    const r = src('register-acts-run.ts')
    const notice = r.indexOf('...TO_FINDING_NOTICE')
    const go = r.indexOf('o.toFinding(id)')
    assert.ok(notice !== -1 && go !== -1 && notice < go)
  })
})

describe('§9 · C3-11 — Reopen only inside the reversal window', () => {
  const now = new Date('2026-10-04T12:00:00.000Z')
  it('24 hours from the post, and an unread time is not in the window', () => {
    assert.equal(REVERSAL_WINDOW_MS, 86_400_000)
    assert.equal(reopenWindowOpen('2026-10-04T09:00:00.000Z', now), true)
    assert.equal(reopenWindowOpen('2026-03-05T09:00:00.000Z', now), false)
    assert.equal(reopenWindowOpen(null, now), false)
    assert.equal(reopenWindowOpen('not a time', now), false)
  })
})

describe('§10 · C3-17 / C3-18 — the owner’s two register rulings', () => {
  it('the Parked facet is retired', () => {
    const r = src('components/ExceptionRegister.tsx')
    assert.equal(r.includes('PARKED_LABEL'), false)
    assert.equal(src('close-state.ts').includes("export const PARKED_LABEL"), false)
  })
  it('run-less lines are shown in an "Unattributed" section', () => {
    const m = src('main.tsx')
    assert.match(m, /heading: 'Unattributed'/)
    assert.match(m, /r\.runId === null/)
  })
})

describe('§11 · C3-19 — the register’s rows are not nested interactive content', () => {
  it('no row is a button; the disclosure is one real button; the sorted column says so', () => {
    const r = src('components/ExceptionRegister.tsx')
    assert.equal(/role: 'button', tabIndex: 0/.test(r), false)
    assert.match(r, /className="rowtog"/)
    assert.match(r, /'aria-sort': 'ascending'/)
    assert.match(r, /'aria-sort': 'descending'/)
  })
})

describe('§12 · C3-16 — a completed run’s sub-line holds AA in dark', () => {
  const tokens = readFileSync(join(REPO, 'docs', 'handoff-pack', 'tokens.css'), 'utf8')
  const dark = tokens.slice(tokens.indexOf('[data-theme="dark"]{'))
  const hex = (name: string): string => {
    const m = new RegExp(`--${name}:(#[0-9a-f]{6})`).exec(dark)
    assert.ok(m?.[1] !== undefined, `no dark --${name}`)
    return m[1]
  }
  const lum = (h: string): number => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0)
  }
  const ratio = (a: string, b: string): number => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
    return (x + 0.05) / (y + 0.05)
  }
  it('the strip draws --muted on --sheet, and --muted clears 4.5:1 there', () => {
    assert.ok(ratio(hex('muted'), hex('sheet')) >= 4.5)
    /* Witnessed: --recede on --sheet is 4.10:1 — the finding. */
    assert.ok(ratio(hex('recede'), hex('sheet')) < 4.5)
    assert.equal(/\.cell\[data-state="completed"\] \.st\{color:var\(--recede\)\}/.test(src('close.css')), false)
  })
})

describe('§13 · the smaller ones', () => {
  it('C3-20 — money is two words on the finding and the approvals', () => {
    for (const f of ['components/Approvals.tsx', 'components/Finding.tsx']) {
      assert.match(src(f), /<span className="cu">\{unit\}<\/span> \{figure\}/, f)
    }
  })
  it('C3-22 — the post page asks the dispositions read whether resolutions are set up', () => {
    assert.match(src('components/Approvals.tsx'), /if \(items\.length > 0\) return items\s+await fetchDispositions/)
  })
  it('C3-31 — the FDE is the 1CloudHub FDE', () => {
    /* Drawn text only — a comment may still say "the FDE". */
    assert.equal(/^\s+Raised? with the FDE|'raised with the FDE'|raised with the FDE`|>Raise it with the FDE</m.test(src('components/ParkedPile.tsx') + src('parked.ts')), false)
  })
})

/**
 * THE SECONDARY SURFACES — RC-01, RC-08, RC-09, RC-12, RC-13 and the C4/C5
 * resolution chain's screens (3 Oct 2026).
 *
 * Three kinds of assertion, none of which needs a browser (the browser half is
 * `tests/e2e/browser-login.test.ts` §30–§33):
 *
 *  §1 · EVERY CLOSED VOCABULARY THE PLANE SPEAKS ON THESE SCREENS HAS A WORD.
 *       Each map in `frontend/src/words.ts` is compared, as a SET, with the
 *       enum the contract declares — derived from the YAML at runtime, never
 *       typed into this file — so a member the contract adds and the screen
 *       does not is a red here rather than a raw `snake_case` token in front
 *       of a finance user.
 *  §2 · WHAT A VIEWER MAY DO WITH A PROPOSAL (`resolve-logic.ts`), including
 *       the four-eyes property the pack draws: the proposer of record is
 *       offered neither Approve nor Refuse.
 *  §3 · THE ENGINEERING TEXT IS GONE FROM THE ROUTE LAYER, AND THE FIVE
 *       ROUTES RC-01 NAMES EACH HAVE A SCREEN.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

import { REPO } from '../design/render.ts'
import {
  POSTCONDITION_WORD,
  PROPOSAL_STATE_WORD,
  RESIDUE_CAUSE_WORD,
  RESIDUE_DISPOSITION_WORD,
  RESOLUTION_CODE_WORD,
  REVERSIBILITY_WORD,
  RUN_STATUS_WORD,
  TERMINAL_STATUS_WORD,
  TRAILER_WORD,
  TRIGGER_WORD,
  VERDICT_WORD,
  EXCEPTION_STATUS_WORD,
  SEVERITY_WORD,
  labelOf,
  sentenceOf,
} from '../../frontend/src/words.ts'
import {
  actsFor,
  adjustmentFrom,
  approvalsCounted,
  pageOf,
  refusalText,
} from '../../frontend/src/resolve-logic.ts'
import { asProposal, currentProposal, type Proposal } from '../../frontend/src/api/resolution.ts'
import { PlaneRefused } from '../../frontend/src/api/runs.ts'
import { greetingFor } from '../../frontend/src/format.ts'

/** A role holding both verbs — the four-eyes logic alone (C3-03's gate is §c1-round4). */
const ALL = { decide: true, post: true } as const

type Schema = Record<string, unknown>

const contract = parse(
  readFileSync(join(REPO, 'docs', 'contracts', 'capability.openapi.yaml'), 'utf8'),
) as { components: { schemas: Record<string, Schema> } }
const errors = parse(readFileSync(join(REPO, 'docs', 'contracts', 'errors.yaml'), 'utf8')) as unknown
const S = contract.components.schemas

function schema(name: string): Schema {
  const s = S[name]
  assert.ok(s !== undefined, `the contract no longer declares ${name} — this suite is reading nothing`)
  return s
}

/** `enum` at a dotted path inside a schema. */
function enumAt(name: string, ...path: string[]): string[] {
  let node: unknown = schema(name)
  for (const k of path) node = (node as Record<string, unknown>)[k]
  const e = (node as { enum?: unknown }).enum
  assert.ok(Array.isArray(e) && e.length > 0, `${name}.${path.join('.')} carries no enum`)
  return e as string[]
}

/** Every `properties.kind.enum[0]` across a `oneOf` union. */
function kindsOf(name: string): string[] {
  const one = (schema(name) as { oneOf?: Schema[] }).oneOf
  assert.ok(Array.isArray(one) && one.length > 0, `${name} is not a oneOf union`)
  return one.map((arm) => {
    const kind = ((arm['properties'] as Record<string, { enum?: string[] }>)['kind'])?.enum?.[0]
    assert.ok(typeof kind === 'string', `an arm of ${name} has no kind`)
    return kind
  })
}

function sameSet(map: Readonly<Record<string, string>>, members: readonly string[], what: string): void {
  assert.deepEqual(
    Object.keys(map).sort(),
    [...members].sort(),
    `${what}: the screen's word map and the contract's enum differ. A member the contract adds ` +
      'and the map does not is a raw token on a screen.',
  )
}

/** Every string anywhere under `errors.yaml` that looks like a closed code. */
function errorCodes(): Set<string> {
  const out = new Set<string>()
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(walk)
    else if (n !== null && typeof n === 'object') Object.values(n).forEach(walk)
    else if (typeof n === 'string' && /^[a-z][a-z0-9_]+$/.test(n)) out.add(n)
  }
  walk(errors)
  return out
}

describe('§1 · every closed vocabulary on the secondary surfaces has a word', () => {
  it('the run account: trigger, status, terminal status, trailer, self-check, residue cause and disposition, postconditions', () => {
    sameSet(TRIGGER_WORD, enumAt('RunTrigger', 'properties', 'kind'), 'RunTrigger.kind')
    sameSet(RUN_STATUS_WORD, enumAt('Run', 'properties', 'status'), 'Run.status')
    const produced = (schema('RunEngineAccount') as { oneOf: Schema[] }).oneOf[0] as Schema
    const terminal = ((produced['properties'] as Record<string, { enum: string[] }>)['terminalStatus'])?.enum ?? []
    sameSet(TERMINAL_STATUS_WORD, terminal, 'RunEngineAccount.terminalStatus')
    sameSet(TRAILER_WORD, enumAt('RunDocumentAccount', 'properties', 'trailer'), 'RunDocumentAccount.trailer')
    sameSet(VERDICT_WORD, kindsOf('DocumentTrailerVerdict'), 'DocumentTrailerVerdict.kind')
    sameSet(RESIDUE_CAUSE_WORD, (schema('ResidueCauseKind') as { enum: string[] }).enum, 'ResidueCauseKind')
    sameSet(RESIDUE_DISPOSITION_WORD, (schema('EngineAssignableDisposition') as { enum: string[] }).enum, 'EngineAssignableDisposition')
    sameSet(POSTCONDITION_WORD, (schema('PostconditionFailureKind') as { enum: string[] }).enum, 'PostconditionFailureKind')
  })

  it('the finding and the resolution chain: status, severity, proposal state, reversibility', () => {
    sameSet(EXCEPTION_STATUS_WORD, (schema('ExceptionStatus') as { enum: string[] }).enum, 'ExceptionStatus')
    sameSet(SEVERITY_WORD, (schema('Severity') as { enum: string[] }).enum, 'Severity')
    sameSet(PROPOSAL_STATE_WORD, enumAt('ProposalExecution', 'properties', 'state'), 'ProposalExecution.state')
    sameSet(REVERSIBILITY_WORD, enumAt('AvailableDisposition', 'properties', 'reversibility'), 'AvailableDisposition.reversibility')
  })

  it('every refusal code the resolution screens put into words is a real code in errors.yaml', () => {
    const codes = errorCodes()
    assert.ok(codes.size > 50, `only ${codes.size} codes read from errors.yaml — the probe is inert`)
    const unknown = Object.keys(RESOLUTION_CODE_WORD).filter((c) => !codes.has(c))
    assert.deepEqual(unknown, [], 'a word is mapped to a code errors.yaml does not have')
    for (const c of ['approval_quorum_unmet', 'approval_second_approver_required', 'approval_segregation_violation']) {
      assert.ok(c in RESOLUTION_CODE_WORD, `${c} can appear in execution.blockedBy and has no word`)
    }
  })

  it('a token outside any map is sentence-cased, never shown raw', () => {
    assert.equal(sentenceOf('not_declared_by_format'), 'Not declared by format')
    assert.equal(labelOf({}, 'some_new_kind'), 'Some new kind')
    assert.doesNotMatch(labelOf(TRAILER_WORD, 'expected_but_absent'), /_/)
  })
})

/* ═══ §2 ═══════════════════════════════════════════════════════════════════ */

function proposal(over: Partial<Proposal['execution']> & { proposer?: string; superseded?: string | null } = {}): Proposal {
  return asProposal(
    {
      proposalId: 'prp_1',
      exceptionId: 'exc_1',
      proposedBy: { kind: 'user', userId: over.proposer ?? 'usr_raj' },
      dispositionKey: 'write_off',
      dispositionLabel: 'Write off',
      rationale: 'below the pursuit threshold',
      evidence: [],
      proposedAt: '2026-10-03T09:00:00.000Z',
      supersededByProposalId: over.superseded ?? null,
      execution: {
        state: over.state ?? 'not_approved',
        approvals: over.approvals ?? [],
        requiredApprovals: over.requiredApprovals ?? {
          quorum: 1,
          segregationOfDuties: true,
          mandatoryAtOrAbove: 'critical',
        },
        blockedBy: over.blockedBy ?? [],
      },
    },
    'test',
  )
}

describe('§2 · what a viewer may do with a proposal — four eyes, drawn', () => {
  it('the proposer of record is offered neither Approve nor Refuse; another person is', () => {
    const p = proposal()
    const own = actsFor(p, 'usr_raj', ALL)
    assert.equal(own.isProposerOfRecord, true)
    assert.equal(own.mayDecide, false, 'the proposer was offered their own approval')
    const other = actsFor(p, 'usr_admin', ALL)
    assert.equal(other.isProposerOfRecord, false)
    assert.equal(other.mayDecide, true, 'a second person was not offered the decision')
    assert.equal(actsFor(p, null, ALL).mayDecide, false, 'a decision was offered before the viewer was known')
  })

  it('with segregation OFF the proposer is not the proposer OF RECORD, and the plane decides', () => {
    const p = proposal({ requiredApprovals: { quorum: 1, segregationOfDuties: false, mandatoryAtOrAbove: null } })
    assert.equal(actsFor(p, 'usr_raj', ALL).mayDecide, true)
  })

  it('a person who already approved is not offered it twice; an executable proposal offers Post', () => {
    const pending = proposal({
      state: 'approved_pending_second_approver',
      approvals: [{ decidedBy: 'usr_admin', decidedByName: null, decidedByFormerMember: false, decision: 'approved', decidedAt: '2026-10-03T10:00:00.000Z' }],
      requiredApprovals: { quorum: 2, segregationOfDuties: true, mandatoryAtOrAbove: null },
    })
    assert.equal(actsFor(pending, 'usr_admin', ALL).mayDecide, false)
    assert.equal(actsFor(pending, 'usr_admin', ALL).alreadyDecided, true)
    assert.deepEqual(approvalsCounted(pending), { have: 1, need: 2 })
    const ready = proposal({ state: 'executable' })
    assert.equal(actsFor(ready, 'usr_raj', ALL).mayPost, true)
    assert.equal(actsFor(ready, 'usr_raj', ALL).mayDecide, false)
  })

  it('posted, refused and superseded proposals are settled — no act is offered', () => {
    for (const p of [proposal({ state: 'executed' }), proposal({ state: 'rejected' }), proposal({ superseded: 'prp_2' })]) {
      const a = actsFor(p, 'usr_admin', ALL)
      assert.equal(a.settled, true)
      assert.equal(a.mayDecide || a.mayPost, false)
    }
  })

  it('approvals are counted by DISTINCT person, and a refusal is not an approval', () => {
    const p = proposal({
      approvals: [
        { decidedBy: 'usr_a', decidedByName: null, decidedByFormerMember: false, decision: 'approved', decidedAt: 'x' },
        { decidedBy: 'usr_a', decidedByName: null, decidedByFormerMember: false, decision: 'approved', decidedAt: 'y' },
        { decidedBy: 'usr_b', decidedByName: null, decidedByFormerMember: false, decision: 'rejected', decidedAt: 'z' },
      ],
      requiredApprovals: { quorum: 2, segregationOfDuties: true, mandatoryAtOrAbove: null },
    })
    assert.deepEqual(approvalsCounted(p), { have: 1, need: 2 })
  })

  it('a proposal without a readable execution block is REFUSED, not defaulted', () => {
    assert.throws(() => asProposal({ proposalId: 'p', exceptionId: 'e', dispositionKey: 'k', rationale: 'r' }, 'getProposal'))
    assert.throws(() =>
      asProposal(
        { proposalId: 'p', exceptionId: 'e', dispositionKey: 'k', rationale: 'r', execution: { state: 'done', approvals: [], blockedBy: [], requiredApprovals: {} } },
        'getProposal',
      ),
    )
  })

  it('the current proposal is the first one nothing superseded', () => {
    assert.equal(currentProposal([proposal({ superseded: 'prp_2' }), proposal()])?.supersededByProposalId, null)
    assert.equal(currentProposal([]), null)
  })

  it('an adjustment is the exception’s own currency and exponent, and is refused rather than rounded', () => {
    assert.deepEqual(adjustmentFrom('1,234.5', 'SGD', 2), { currency: 'SGD', exponent: 2, amountMinor: '123450' })
    assert.deepEqual(adjustmentFrom('0.07', 'SGD', 2), { currency: 'SGD', exponent: 2, amountMinor: '7' })
    assert.equal(adjustmentFrom('1.234', 'SGD', 2), null, 'a third decimal was rounded rather than refused')
    assert.equal(adjustmentFrom('ten', 'SGD', 2), null)
  })

  it('a refused write is put into words from its CODE, never from the plane’s detail', () => {
    const err = new PlaneRefused(403, 'approval_segregation_violation', 'Forbidden', 'usr_raj proposed prp_1')
    const text = refusalText(err)
    assert.match(text, /proposed this cannot approve it/)
    assert.doesNotMatch(text, /usr_raj|prp_1/, 'the plane’s detail reached the screen')
    assert.match(refusalText(new PlaneRefused(401, undefined, 'x')), /session has ended/)
    assert.match(refusalText(new Error('boom')), /Nothing was written/)
  })
})

describe('§2b · paging and the greeting', () => {
  it('a long list is cut into pages that say where they are', () => {
    const all = Array.from({ length: 3652 }, (_, i) => i)
    const first = pageOf(all, 0, 50)
    assert.equal(first.rows.length, 50)
    assert.deepEqual([first.first, first.last, first.total, first.pages], [1, 50, 3652, 74])
    const last = pageOf(all, 999, 50)
    assert.deepEqual([last.page, last.first, last.last], [73, 3651, 3652])
    assert.deepEqual(pageOf([], 0, 50).first, 0)
  })

  it('the greeting carries the first name when the directory gave one, and stands alone when not', () => {
    const morning = new Date(2026, 9, 3, 9, 0)
    assert.equal(greetingFor(morning, 'Rosalie Tan'), 'Good morning, Rosalie.')
    assert.equal(greetingFor(morning, null), 'Good morning.')
    assert.equal(greetingFor(morning, '   '), 'Good morning.')
  })
})

/* ═══ §3 ═══════════════════════════════════════════════════════════════════ */

const SRC = join(REPO, 'frontend', 'src')

function codeOf(rel: string): string {
  return readFileSync(join(SRC, rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

describe('§3 · RC-01 — no route renders engineering text', () => {
  it('the route layer’s fallback names no record, no tier, no G row and no "no screen yet"', () => {
    const code = codeOf('routes/screens.ts')
    for (const forbidden of [/design\/routes/, /handoff-pack/, /\bG\d{2,4}\b/, /no screen yet/i, /gap rather than a refusal/, /spec\.tier/]) {
      assert.doesNotMatch(code, forbidden, `routes/screens.ts still draws ${forbidden} on screen`)
    }
    /* Positive control: the stripped source still has the fallback, so the
       probe above is not reading an empty string. */
    assert.match(code, /function scopeOf/)
  })

  it('every route RC-01 names has a screen in main.tsx, so none falls through', () => {
    const main = codeOf('main.tsx')
    for (const path of ['/', '/ask', '/reports', '/invite', '/signin/lapsed', '/close/finding/:ref/post']) {
      assert.match(main, new RegExp(`^\\s{4}'${path.replace(/[/:]/g, (c) => `\\${c}`)}': \\(`, 'm'), `${path} has no screen`)
    }
  })

  it('Sign out is wired to the plane, not drawn Coming soon, on the signed-in chrome', () => {
    const main = codeOf('main.tsx')
    assert.match(main, /onSignOut=\{/, 'the chrome is not handed a sign-out')
    assert.match(main, /signOutAt\(plane\.origin\)/)
    const principal = codeOf('api/principal.ts')
    assert.match(principal, /method: 'DELETE'/)
    assert.match(principal, /new URL\('\/session'/)
  })
})

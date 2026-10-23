/**
 * THE CLOSE SURFACE'S PURE DECISIONS — fix/ui-close-surface, G3421–G3440.
 *
 * Every decision the Close screen makes that is not drawing — which ONE thing
 * holds the light, what a row's next act is, whose move a line is, what a
 * refusal is called, what a period is called, and what an assignment leaves of
 * a row — is a plain function in `frontend/src/` and is pinned here, under
 * `node --test`, without a renderer. The browser half (the light computed on a
 * real cell, the counts against a real plane, the document width at 390px) is
 * `tests/e2e/browser-login.test.ts` §9 and §30.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { litTargetOf } from '../../frontend/src/luminous.ts'
import { NEXT_ACT, TAKEABLE, claimOf, refusalKindOf, whoseOf } from '../../frontend/src/close-state.ts'
import { periodLabel, type Run } from '../../frontend/src/api/runs.ts'
import { mergeAssignment, type ExceptionRow } from '../../frontend/src/api/exceptions.ts'

function run(runId: string, status: Run['status'], startedAt: string): Run {
  return {
    runId,
    definitionId: `def_${runId}`,
    definitionName: null,
    definitionVersion: 1,
    periodId: null,
    periodStartsOn: null,
    periodEndsOn: null,
    trigger: { kind: 'scheduled' },
    status,
    startedAt,
    finishedAt: null,
    exceptionsRaised: null,
    completeness: null,
  }
}

describe('ONE LIGHT PER VIEW — litTargetOf (RM-07)', () => {
  const reading = run('a', 'running', '2026-10-03T01:00:00.000Z')
  const newer = run('b', 'running', '2026-10-03T02:00:00.000Z')
  const done = run('c', 'completed', '2026-10-03T03:00:00.000Z')

  it('an open evidence panel outranks a reading reconciliation', () => {
    assert.deepEqual(
      litTargetOf({ openPanel: 'exc_1', stripRuns: [reading, done] }),
      { kind: 'panel', exceptionId: 'exc_1' },
    )
  })

  it('with nothing open, the reading cell holds the light — and a finished one never does', () => {
    assert.deepEqual(litTargetOf({ openPanel: null, stripRuns: [done, reading] }), {
      kind: 'strip',
      runId: 'a',
    })
    assert.deepEqual(litTargetOf({ openPanel: null, stripRuns: [done] }), { kind: 'none' })
  })

  /* ⚠️ THIS SAID *"the selected one if reading, else the newest"* UNTIL 3 Oct
     2026 — RMR-04, THE OWNER'S RULING (G3471): *"when two runs are reading,
     light only the most recently started."* The selection no longer moves it,
     and `workingRunOf` is the same answer for the mark. */
  it('two reading at once light ONE cell: the most recently started, whichever is selected', () => {
    assert.deepEqual(litTargetOf({ openPanel: null, stripRuns: [reading, newer] }), {
      kind: 'strip',
      runId: 'b',
    })
    assert.deepEqual(litTargetOf({ openPanel: null, stripRuns: [newer, reading] }), {
      kind: 'strip',
      runId: 'b',
    })
  })
})

describe('THE NEXT ACT — RC-04, the owner\'s ruling (G3423)', () => {
  it('an open line offers Accept, a line in flight offers View, a cleared line offers Reopen', () => {
    assert.deepEqual(NEXT_ACT, {
      open: 'accept',
      investigating: 'accept',
      resolution_proposed: 'view',
      pending_approval: 'view',
      resolved: 'reopen',
      rejected: 'reopen',
      dismissed: 'reopen',
    })
  })

  it('Take is never offered on a resolved line or one awaiting approval', () => {
    assert.deepEqual([...TAKEABLE].sort(), ['investigating', 'open'])
    for (const s of ['resolved', 'pending_approval', 'resolution_proposed', 'rejected', 'dismissed'] as const) {
      assert.equal(TAKEABLE.includes(s), false, `Take offered on a ${s} line`)
    }
  })
})

describe('WHOSE MOVE — whoseOf', () => {
  it('names nobody, you or a colleague — and never guesses while the reader is unread', () => {
    assert.equal(whoseOf(null, 'usr_mei'), 'nobody')
    assert.equal(whoseOf('usr_mei', 'usr_mei'), 'you')
    assert.equal(whoseOf('usr_vik', 'usr_mei'), 'someone')
    assert.equal(whoseOf('usr_mei', null), 'assigned', 'an unread reader turned a taken line into "a colleague"')
  })
})

describe('REFUSALS BY STATUS — RC-11', () => {
  it('a 429 is a rate limit and is never told as a missing role', () => {
    assert.equal(refusalKindOf(403), 'role')
    assert.equal(refusalKindOf(429), 'rate')
    assert.equal(refusalKindOf(500), 'other')
    assert.equal(refusalKindOf(null), 'other')
  })
})

describe('THE CLAIM — claimOf (RC-03 / RC-16)', () => {
  it('draws nothing while either count is unread', () => {
    assert.equal(claimOf(null, 6), null)
    assert.equal(claimOf(3, null), null)
  })
  it('spells the counts as the pack does', () => {
    assert.equal(claimOf(3, 6), 'Three of the six exceptions need you.')
    assert.equal(claimOf(1, 2), 'One of the two exceptions needs you.')
    assert.equal(claimOf(0, 2), 'None of the two exceptions needs you.')
  })
})

describe('THE PERIOD, NOT ITS ID — periodLabel (RC-02, G3429)', () => {
  const base = run('p', 'completed', '2026-03-06T03:12:00.000Z')
  it('the pack\'s own span: "02 – 08 Mar 2026"', () => {
    assert.equal(periodLabel({ ...base, periodId: 'per_w10', periodStartsOn: '2026-03-02', periodEndsOn: '2026-03-08' }), '02 – 08 Mar 2026')
  })
  it('spans across a month, across a year, and a single day', () => {
    assert.equal(periodLabel({ ...base, periodId: 'x', periodStartsOn: '2026-02-23', periodEndsOn: '2026-03-01' }), '23 Feb – 01 Mar 2026')
    assert.equal(periodLabel({ ...base, periodId: 'x', periodStartsOn: '2025-12-29', periodEndsOn: '2026-01-04' }), '29 Dec 2025 – 04 Jan 2026')
    assert.equal(periodLabel({ ...base, periodId: 'x', periodStartsOn: '2026-03-02', periodEndsOn: '2026-03-02' }), '02 Mar 2026')
  })
  it('falls back to the id when no dates are held, and to null with no period at all', () => {
    assert.equal(periodLabel({ ...base, periodId: 'per_w10' }), 'per_w10')
    assert.equal(periodLabel(base), null)
  })
  it('never moves a day with the reader\'s zone — parsed as text, not through Date', () => {
    const prior = process.env['TZ']
    process.env['TZ'] = 'America/Los_Angeles'
    try {
      assert.equal(periodLabel({ ...base, periodId: 'x', periodStartsOn: '2026-03-02', periodEndsOn: '2026-03-08' }), '02 – 08 Mar 2026')
    } finally {
      if (prior === undefined) delete process.env['TZ']
      else process.env['TZ'] = prior
    }
  })
})

describe('AN ASSIGNMENT KEEPS THE ROW — mergeAssignment (RC-05)', () => {
  const row: ExceptionRow = {
    exceptionId: 'exc_1',
    domain: 'finance',
    definitionId: 'def_ap',
    ruleLabel: 'Three-way match',
    severity: 'high',
    severityRank: 1,
    valueAtRisk: { currency: 'SGD', amountMinor: '100', exponent: 2 },
    costCentre: null,
    legalEntity: null,
    status: 'open',
    assignedTo: null,
    assignedToName: null,
    assignedToFormerMember: false,
    raisedAt: '2026-10-03T00:00:00.000Z',
    summary: 'Invoice total exceeds the goods received',
    carriedForwardFrom: null,
    runId: null,
    variance: null,
  }
  it('takes the two fields the plane wrote and keeps the line text', () => {
    const merged = mergeAssignment(row, { assignedTo: 'usr_mei', status: 'investigating' })
    assert.equal(merged.summary, row.summary, 'the line text vanished on assignment — RC-05')
    assert.equal(merged.assignedTo, 'usr_mei')
    assert.equal(merged.status, 'investigating')
    assert.deepEqual({ ...merged, assignedTo: null, status: 'open' }, row)
  })
})

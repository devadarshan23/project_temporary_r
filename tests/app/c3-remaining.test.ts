/**
 * THE C3 REGISTER AUDIT'S LAST FOUR ITEMS — the decisions that are not drawing,
 * pinned under `node --test`. G4041–G4048 (4 Oct 2026). The browser half — the
 * menu walked by keyboard, the status bar while the runs read is held, the skip
 * link, Accept's busy word — is `tests/e2e/c3-remaining.test.ts`.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isMenuKey, menuKeyTarget } from '../../frontend/src/overlays/menu-keys.ts'
import { periodWordOf } from '../../frontend/src/period-word.ts'
import type { Run } from '../../frontend/src/api/runs.ts'

function run(over: Partial<Run>): Run {
  return {
    runId: 'run_1',
    definitionId: 'def_1',
    definitionName: null,
    definitionVersion: 1,
    periodId: null,
    periodStartsOn: null,
    periodEndsOn: null,
    trigger: { kind: 'scheduled' },
    status: 'completed',
    startedAt: '2026-10-04T01:00:00.000Z',
    finishedAt: null,
    exceptionsRaised: null,
    completeness: null,
    ...over,
  } as Run
}

describe('§1 C3-24 · the menu keys (G4041)', () => {
  it('walks, wraps and jumps', () => {
    assert.equal(menuKeyTarget('ArrowDown', 4, -1), 0, 'from the avatar, ArrowDown enters at the first item')
    assert.equal(menuKeyTarget('ArrowUp', 4, -1), 3, 'from the avatar, ArrowUp enters at the last item')
    assert.equal(menuKeyTarget('ArrowDown', 4, 3), 0, 'ArrowDown wraps')
    assert.equal(menuKeyTarget('ArrowUp', 4, 0), 3, 'ArrowUp wraps')
    assert.equal(menuKeyTarget('Home', 4, 2), 0)
    assert.equal(menuKeyTarget('End', 4, 1), 3)
    assert.equal(menuKeyTarget('ArrowDown', 0, -1), null, 'an empty menu has nowhere to go')
  })
  it('claims the four keys and no others — Escape and Tab are not the menu\'s', () => {
    assert.deepEqual(['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab', 'Enter'].filter(isMenuKey), ['ArrowDown', 'ArrowUp', 'Home', 'End'])
  })
})

describe('§2 C3-25 · the status bar\'s period word (G4042)', () => {
  it('says the period is being read while the runs read is out — never "no period"', () => {
    /* WITNESSED RED in a browser against 4a831a00: `the status bar asserted "no
       period" while the runs read was out: Close · no period`. */
    assert.deepEqual(periodWordOf(null, true), { word: 'reading the period', state: 'reading' })
  })
  it('says "no period" only once the read has answered', () => {
    assert.deepEqual(periodWordOf(null, false), { word: 'no period', state: 'none' })
    assert.deepEqual(periodWordOf(run({}), false), { word: 'no period', state: 'none' })
  })
  it('names the period a run carries', () => {
    const named = periodWordOf(run({ periodStartsOn: '2026-08-01', periodEndsOn: '2026-08-31' }), false)
    assert.equal(named.state, 'named')
    assert.match(named.word, /Aug 2026/)
  })
})

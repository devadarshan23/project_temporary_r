/**
 * fix/ui-server-truth — G3441–G3445, 3 Oct 2026. The pure decisions the
 * customer portal now takes on what the plane says (reaudit NC-01, NC-02,
 * NC-03, RC-10). No renderer, no plane: `node --test` loads the modules.
 *
 * Each case was WITNESSED RED against the shape it replaces, recorded beside
 * it: the default selection landed on the most recent definition whatever it
 * was doing; the claim named no scope; the strip printed the raw status and
 * "no engine account" for a reading run; a `resolution_not_configured` 409 was
 * rendered with the 5xx "try again" sentence.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { defaultDefinitionOf, defaultRunOf, scopedClaimOf, stripSaysOf } from '../../frontend/src/close-state.ts'
import { NOT_CONFIGURED_TEXT, isResolutionNotConfigured, refusalText } from '../../frontend/src/resolve-logic.ts'
import { PlaneRefused } from '../../frontend/src/api/runs.ts'

type S = 'queued' | 'running' | 'completed' | 'failed' | 'incomplete'
const g = (definitionId: string, ...statuses: S[]) => ({
  definitionId,
  runs: statuses.map((status) => ({ status })),
})

describe('NC-02 — C1 opens on the reconciliation with the work, never on a reading one', () => {
  it('prefers a FINISHED reconciliation holding the reader\'s lines over the most recent one', () => {
    /* Witnessed red: the old rule was `groupRuns(runs)[0]` → `def_bank` (running). */
    const groups = [g('def_bank', 'running'), g('def_card', 'completed'), g('def_3wm', 'completed')]
    assert.equal(defaultDefinitionOf(groups, ['def_3wm']), 'def_3wm')
  })
  it('with no lines for the reader, opens on the most recent FINISHED run, not the reading one', () => {
    assert.equal(defaultDefinitionOf([g('def_bank', 'running'), g('def_card', 'completed')], []), 'def_card')
    assert.equal(defaultDefinitionOf([g('def_bank', 'queued'), g('def_card', 'incomplete')], null), 'def_card')
  })
  it('a finished reconciliation wins over a reading one even when only the reading one holds lines', () => {
    assert.equal(defaultDefinitionOf([g('def_card', 'completed'), g('def_bank', 'running')], ['def_bank']), 'def_card')
  })
  it('falls back to a reading reconciliation with lines, then to the most recent', () => {
    assert.equal(defaultDefinitionOf([g('def_a', 'running'), g('def_b', 'running')], ['def_b']), 'def_b')
    assert.equal(defaultDefinitionOf([g('def_a', 'running')], null), 'def_a')
    assert.equal(defaultDefinitionOf([], null), null)
  })
})

describe('NC-02 / NC-03 — the claim names its scope and never asserts "none" for a reading run', () => {
  it('names the RUN the count is about — G3626, since the counts are the selected run`s', () => {
    /* Witnessed red (G3626): the claim said "… in Three-way match" over a
       count that `0480` scopes to ONE run of it. */
    assert.equal(
      scopedClaimOf(3, 6, { label: 'Three-way match', status: 'completed' }),
      'Three of the six exceptions in this run of Three-way match need you.',
    )
    assert.equal(
      scopedClaimOf(0, 0, { label: 'Card settlement', status: 'completed' }),
      'No exception is waiting on anyone in this run of Card settlement.',
    )
  })
  it('a reading run with nothing yet says it is still reading', () => {
    /* Witnessed red: `claimOf(0, 0)` → "No exception is waiting on anyone." on a running run. */
    assert.equal(
      scopedClaimOf(0, 0, { label: 'Bank to ERP', status: 'running' }),
      'Still reading — exceptions land here as they are raised.',
    )
  })
  it('U-12 (G4136) — a QUEUED run is not said to be reading: it has not started', () => {
    /* `running` is real since G4132, so "still running" over a queued run
     * became a false sentence; the pack's word "reading" is free since
     * `settled()` reads `data-reading`, not the word. */
    assert.equal(
      scopedClaimOf(0, 0, { label: 'Bank to ERP', status: 'queued' }),
      'Queued — exceptions land here as they are raised.',
    )
  })
  it('no claim while either count is unread', () => {
    assert.equal(scopedClaimOf(null, 6, { label: 'x', status: 'completed' }), null)
  })
})

describe('RC-10 / C3-14 — what a strip cell says about its run, in plain words', () => {
  it('a running run says the pack\'s "reading" and nothing about an account (U-12, G4136)', () => {
    assert.deepEqual(stripSaysOf({ status: 'running', exceptionsRaised: null }), {
      state: 'reading',
      raised: null,
      gaps: null,
      needs: null,
    })
  })
  it('a finished run says its counts, its completeness in plain words, and its status word', () => {
    /* Witnessed red (C3-14): the account read "engine observed no shortfall". */
    assert.deepEqual(stripSaysOf({ status: 'completed', exceptionsRaised: 5, completeness: [] }), {
      state: 'completed',
      raised: '5 raised',
      gaps: 'every line read in',
      needs: null,
    })
    assert.equal(stripSaysOf({ status: 'completed', exceptionsRaised: 0 }).raised, 'none raised')
    assert.equal(stripSaysOf({ status: 'completed', exceptionsRaised: 0, completeness: null }).gaps, 'account not recorded')
    assert.equal(stripSaysOf({ status: 'incomplete', exceptionsRaised: null }).raised, null)
    assert.equal(stripSaysOf({ status: 'incomplete', exceptionsRaised: null }).state, 'incomplete')
    assert.equal(stripSaysOf({ status: 'failed', exceptionsRaised: 2 }).state, 'stopped')
    assert.equal(stripSaysOf({ status: 'failed', exceptionsRaised: 2 }).raised, null)
    assert.equal(stripSaysOf({ status: 'completed', exceptionsRaised: 3, completeness: [{}] }).gaps, 'lines not read in')
  })
})

describe('G3626 — the strip cell says the pack`s "N need you" for ITS run', () => {
  it('counts the reader`s open lines of the cell`s run, singular and plural', () => {
    /* Witnessed red: `stripSaysOf` took no count and the cell drew none. */
    assert.equal(stripSaysOf({ status: 'completed', exceptionsRaised: 14 }, 5).needs, '5 need you')
    assert.equal(stripSaysOf({ status: 'completed', exceptionsRaised: 14 }, 1).needs, '1 needs you')
  })
  it('says nothing for zero or an unread count — never "0 need you"', () => {
    assert.equal(stripSaysOf({ status: 'completed', exceptionsRaised: 3 }, 0).needs, null)
    assert.equal(stripSaysOf({ status: 'completed', exceptionsRaised: 3 }, null).needs, null)
  })
})

describe('G3626 — C1 opens on the RUN with the reader`s work, within the selected reconciliation', () => {
  const r = (runId: string, status: S) => ({ runId, status })
  it('prefers the most recent FINISHED run holding the reader`s lines over a later empty one', () => {
    /* Witnessed red: the old rule was `group.runs[0]` → the reading run, an empty register. */
    assert.equal(defaultRunOf([r('run_w11', 'running'), r('run_w10', 'completed'), r('run_w09', 'completed')], ['run_w10']), 'run_w10')
  })
  it('falls back to a reading run with lines, then to the most recent', () => {
    assert.equal(defaultRunOf([r('run_b', 'running'), r('run_a', 'completed')], ['run_b']), 'run_b')
    assert.equal(defaultRunOf([r('run_b', 'running'), r('run_a', 'completed')], null), 'run_b')
    assert.equal(defaultRunOf([], ['run_x']), null)
  })
})

describe('NC-01 — "resolutions are not set up" is a calm, permanent state', () => {
  const notConfigured = new PlaneRefused(409, 'resolution_not_configured', 'not set up')
  it('is recognised by its closed code', () => {
    assert.equal(isResolutionNotConfigured(notConfigured), true)
    assert.equal(isResolutionNotConfigured(new PlaneRefused(500, 'upstream_unavailable', 'x')), false)
  })
  it('never offers a retry', () => {
    /* Witnessed red: the plane answered this as a 500 and `refusalText` said "try again in a moment". */
    assert.doesNotMatch(refusalText(notConfigured), /try again/i)
    assert.doesNotMatch(NOT_CONFIGURED_TEXT, /try again|failed/i)
    assert.match(refusalText(notConfigured), /not set up/)
  })
})

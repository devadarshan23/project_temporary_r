/**
 * `tools/run-measure.mjs` IS A REPORTER AND STAYS OUT OF THE GATE — G4368.
 *
 * A timing is neither deterministic nor fast, which is G108's condition for a
 * checker, so the harness must never become a `check:*` stage nor be reached
 * from `npm test`. This file asserts the absence rather than trusting it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

test('test_run_measure_is_not_a_gate_stage', () => {
  const offenders = Object.entries(pkg.scripts).filter(
    ([name, cmd]) => (name === 'check' || name.startsWith('check:') || name === 'test') && cmd.includes('run-measure'),
  )
  assert.deepEqual(
    offenders,
    [],
    'run-measure.mjs reached the gate. A timing varies by machine and by load; a gate that ' +
      'fails on a slow laptop teaches people to ignore it (G108).',
  )
})

test('test_run_measure_says_it_is_a_reporter_and_fails_nothing', () => {
  const src = readFileSync(new URL('../../tools/run-measure.mjs', import.meta.url), 'utf8')
  assert.match(src, /IT IS NOT A CHECKER AND IT IS NOT IN `npm run check`/)
  assert.doesNotMatch(src, /process\.exitCode\s*=\s*1/)
})

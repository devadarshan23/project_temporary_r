/**
 * `docs/build/phase-one-plan.md` — the two properties of the pass-H re-cut that
 * a machine can hold.
 *
 * WHY THIS EXISTS. G92 ratified the plan and made re-cutting its gates against
 * pass H an obligation. Its gate D4 was already fully closed and the plan did
 * not know it; because the plan adjudicates rather than proposes, that one
 * stale edge was reached transitively by sixteen phase-two issues.
 *
 * ⚠️ BOTH ASSERTIONS ARE WRITTEN TO FAIL ON AN EMPTY FILE. A test shaped
 * "the gate table has seven rows" passes when the file is truncated to
 * nothing, which is the §5.7 shape — a rule keyed on a convenient landmark
 * rather than on the property it protects. So D4's absence is asserted BY
 * NAME, in the same test as D1's and D8's presence, and the status-label test
 * fails when either label cannot be found at all.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PLAN = 'docs/build/phase-one-plan.md'
const INDEX = 'docs/INDEX.md'

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8')

test('test_the_plan_states_no_live_d4_gate_while_still_stating_d1_and_d8', () => {
  const plan = read(PLAN)

  assert.ok(
    !plan.includes('| **D4** |'),
    `${PLAN} still states a live decision gate D4. D4 is fully closed — its four ` +
      'items were decided by G75, G78, G80b and G85, all recorded in docs/HANDOFF.md §3 ' +
      '— and a live D4 row here gates plan items 10 and 14 on a decision already taken.',
  )
  assert.ok(
    plan.includes('| **D1** |'),
    `${PLAN} no longer states gate D1. D1 is OPEN: no §3 row closes it. Striking it ` +
      'with D4 would delete an open decision rather than a stale one.',
  )
  assert.ok(
    plan.includes('| **D8** |'),
    `${PLAN} no longer states gate D8. D8 is OPEN: no §3 row closes it.`,
  )
})

test('test_the_plans_status_label_and_the_index_row_for_it_carry_the_same_words', () => {
  const planLabel = /^> \*\*STATUS:\*\* (.+?)\s*$/m.exec(read(PLAN))?.[1]
  assert.ok(
    planLabel !== undefined,
    `${PLAN} has no "> **STATUS:** …" line in its banner at all.`,
  )

  const indexRow = read(INDEX)
    .split('\n')
    .find((l) => l.startsWith('|') && l.includes(`\`${PLAN}\``))
  assert.ok(
    indexRow !== undefined,
    `${INDEX} has no master-table row for ${PLAN}.`,
  )

  const indexLabel = /\|\s*\*\*([A-Z][A-Z ]+)\*\*\s*·/.exec(indexRow)?.[1]
  assert.ok(
    indexLabel !== undefined,
    `${INDEX}'s row for ${PLAN} carries no "**LABEL** ·" status cell:\n  ${indexRow.slice(0, 160)}`,
  )

  assert.equal(
    indexLabel,
    planLabel,
    `The status label disagrees between the document and the summary a reader consults ` +
      `instead of it — §5.4. ${PLAN} says "${planLabel}"; ${INDEX}'s row says ` +
      `"${indexLabel}". Both halves move together or neither moves.\n\n` +
      `  DO NOT close this by editing this test, and do not close it by reverting the ` +
      `plan's banner: the plan's label is a derivation from G92, which ratified it. ` +
      `${INDEX} is a record file, written by the record's owner in one voice, and the ` +
      `two rows for this plan (the master table, and the docs/build sub-table) also ` +
      `still carry the struck D4 warning. Both are owed the same edit.`,
  )
})

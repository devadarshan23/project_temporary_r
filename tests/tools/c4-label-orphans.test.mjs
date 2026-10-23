/**
 * tools/planner/render-c4-page.mjs — THE LABELS→TEMPLATE DIRECTION.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  auditLabelReferences,
  verifyLabelsReferenced,
  renderC4Page,
} from '../../tools/planner/render-c4-page.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PLANNER = path.join(REPO_ROOT, 'tools', 'planner')
const FIXTURES = path.join(REPO_ROOT, 'tests', 'tools', 'fixtures', 'c4-labels')

const fixturePath = (name) => path.join(FIXTURES, name)
const readFixture = (name) => readFileSync(fixturePath(name), 'utf8')
const labelsFixture = (name) => JSON.parse(readFixture(name))

test('test_the_orphaned_fixture_yields_exactly_the_stranded_key_and_the_thrower_names_it_in_its_message', () => {
  const labels = labelsFixture('orphaned-labels.json')
  const template = readFixture('orphaned-template.html')
  const audit = auditLabelReferences(labels, template)

  assert.deepEqual(audit.unreferenced, ['strandedLabel'])
  assert.equal(audit.labelsExamined, 3)
  assert.throws(() => verifyLabelsReferenced(labels, template), /strandedLabel/)
})

test('test_the_clean_fixture_yields_no_finding_while_reporting_a_nonzero_count_of_labels_actually_examined', () => {
  const audit = auditLabelReferences(
    labelsFixture('clean-labels.json'),
    readFixture('clean-template.html'),
  )
  assert.deepEqual(audit.unreferenced, [])
  assert.equal(audit.labelsExamined, 3)
  assert.notEqual(audit.labelsExamined, 0)
})

test('test_the_exemption_is_the_underscore_prefix_and_covers_nothing_wider_than_the_keys_that_carry_it', () => {
  const labels = labelsFixture('orphaned-labels.json')
  const template = readFixture('orphaned-template.html')
  assert.equal(Object.keys(labels).length, 5)
  assert.ok('_README' in labels)
  assert.ok('_notes' in labels)
  assert.ok(!template.includes('{{label._README}}'))
  assert.ok(!template.includes('{{label._notes}}'))

  const audit = auditLabelReferences(labels, template)
  assert.equal(audit.labelsExamined, 3)
  assert.deepEqual(audit.unreferenced, ['strandedLabel'])
})

test('test_a_placeholder_naming_a_longer_key_is_not_counted_as_a_reference_to_the_shorter_one_it_begins_with', () => {
  const labels = { alpha: { text: 'a', status: 'DESIGNED', ruling: null } }
  assert.deepEqual(auditLabelReferences(labels, '<p>{{label.alphaExtended}}</p>').unreferenced, ['alpha'])
  assert.deepEqual(auditLabelReferences(labels, '<p>{{label.alpha}}</p>').unreferenced, [])
})

test('test_against_the_real_tree_every_label_entry_is_referenced_by_at_least_one_placeholder_in_the_template', () => {
  const labels = JSON.parse(readFileSync(path.join(PLANNER, 'c4-labels.json'), 'utf8'))
  const template = readFileSync(path.join(PLANNER, 'c4-template.html'), 'utf8')
  const audit = auditLabelReferences(labels, template)

  assert.deepEqual(
    audit.unreferenced,
    [],
    'a label entry no placeholder references renders NOWHERE — a ruling that reached the data file and not the page',
  )
  assert.ok(audit.labelsExamined >= 6, 'a guard that examined nothing must not report clean')
})

/**
 * The labels a RULING placed on the page. Deleting one is not a refactor —
 * it removes a decision from the record the page is supposed to carry.
 *
 * THE PIN IS BY NAME AND IT HAS TO BE. A set derived from the tree cannot
 * notice its own shrinkage: delete a key from `c4-labels.json` AND its
 * placeholder from `c4-template.html` in one commit and `unreferenced` stays
 * empty, because both halves left together. A floor does not catch it either —
 * with nine ruled keys, `ruled.length >= 6` is satisfied after deleting three,
 * with no replacement key added at all. Witnessed on the merged tree: deleting
 * `controlPlaneZone`, `controlDatabase` and `dataPlaneZone` from both files
 * left this file at 7 pass / 0 fail and `npm run check` at EXIT 0, with three
 * G185 rulings gone from the rendered page.
 *
 * A SUPERSET, NOT AN EQUALITY. Adding a ruled label never edits this list, so
 * an in-flight slice that mints one stays green. Only a REMOVAL goes red, and
 * a removal is the event that has to be visible — the whole entry is deleted
 * in the same commit, deliberately, where a reviewer reads it.
 */
const PINNED_RULINGS = {
  controlPlaneZone: 'G185 — the control plane is one account, one owner',
  controlDatabase: 'G185 — ONE writer against the control schema, not N',
  tenantDatabase: 'G185 — the tenant schema is RLS-scoped',
  dataPlaneZone: 'G185 — the data plane is multi-tenant when hosted',
  downwardCrossing: 'G185 — the crossing is DOWNWARD ONLY, which is invariant 3 drawn',
  tenantRowHome:
    'G185(e) — the tenant row is control-owned. Deleting it removes the ruling ' +
    'from the page, which is the defect M0-4 exists to end, reached by deletion ' +
    'instead of by omission.',
  frontendKernel: 'G72 — the token kernel is the design system on the page',
  frontendSpecimens: 'G72 — the specimens are what the kernel is witnessed by',
  frontendRoutes: 'G72 — the drawn routes, and that none of them reaches a seam',
}

test('test_every_ruling_bearing_label_is_still_present_and_rendered', () => {
  const labels = JSON.parse(readFileSync(path.join(PLANNER, 'c4-labels.json'), 'utf8'))
  const template = readFileSync(path.join(PLANNER, 'c4-template.html'), 'utf8')

  const ruled = Object.entries(labels)
    .filter(([k, v]) => !k.startsWith('_') && v && v.ruling)
    .map(([k]) => k)

  // Non-vacuity: if this ever reads 0, the filter broke, not the tree.
  // Implied by the pins below, and kept because its message names the filter.
  assert.ok(ruled.length >= 6, `expected the G185 label set, got ${ruled.length}`)

  // Presence. Nulling a key's `ruling` drops it out of `ruled` and fails here too.
  for (const [key, why] of Object.entries(PINNED_RULINGS)) {
    assert.ok(ruled.includes(key), `${key} left the record — ${why}`)
  }

  // Present in the data file is not the claim. Rendered is the claim, and an
  // empty string renders as a blank line: the key, the ruling and the
  // placeholder all survive while the sentence the ruling made does not.
  const audit = auditLabelReferences(labels, template)
  for (const key of ruled) {
    assert.ok(
      !audit.unreferenced.includes(key),
      `${key} carries a ruling and renders nowhere`,
    )
    assert.ok(
      typeof labels[key].text === 'string' && labels[key].text.trim().length > 0,
      `${key} carries a ruling and renders BLANK — an empty label is a deleted one ` +
        'that left its key behind',
    )
  }
})

test('test_render_c4_page_refuses_an_orphaned_label_set_so_the_guard_has_a_call_site_inside_the_page_the_gate_regenerates', async () => {
  await assert.rejects(
    renderC4Page({
      labelsPath: fixturePath('orphaned-labels.json'),
      templatePath: fixturePath('orphaned-template.html'),
    }),
    /strandedLabel/,
  )
})

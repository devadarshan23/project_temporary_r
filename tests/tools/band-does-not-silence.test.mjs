/**
 * EVERY DERIVED TOTAL SITS INSIDE ITS OWN BAND, BECAUSE A BAND THE TREE HAS
 * OUTGROWN IS A CHECKER THAT STOPS SEEING THE NUMBERS THAT ARE RIGHT.
 *
 * 🛑 THIS EXISTS BECAUSE IT HAPPENED. `check-doc-counts.mjs` filters a
 * CANDIDATE by a plausibility band — `claimed < band[0] || claimed > band[1]`
 * → `continue` — so the band is applied to the number a DOCUMENT states, not
 * to the number the TREE holds.
 *
 * When G288's `administration.openapi.yaml` took the contract totals to 135
 * operations across 124 paths, the band was `[40, 120]`. The consequence is
 * the exact inversion of what a staleness checker is for:
 *
 *   · a line stating the CURRENT total (135) fell OUTSIDE the band and was
 *     skipped — never checked;
 *   · a line carrying an OLD, WRONG total (72) sat INSIDE it and went on
 *     being checked.
 *
 * **The checker went silent about the right answers and stayed loud about the
 * wrong ones**, and `npm run check` was EXIT 0 throughout. That is
 * `docs/HANDOFF.md` §5.6 — a control that passes while asserting nothing — and
 * §5 as well: a rule keyed on a convenient landmark, a range somebody guessed,
 * instead of the property it protects.
 *
 * ⚠️ WIDENING THE BAND DOES NOT FIX THE CLASS. Any ceiling is one the tree can
 * grow through, and the failure is SILENT when it does. This test is what makes
 * the next crossing a RED GATE instead of another quiet one — the band may be
 * raised deliberately, by someone reading this, and never outgrown by accident.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * ⚠️ THIS READS THE SOURCE AND THE CHECKER'S OWN OUTPUT, NOT AN EXPORT, AND THE
 * FIRST DRAFT OF THIS FILE IS WHY. It reached for `mod.METRICS`, which
 * `check-doc-counts.mjs` does not export, and fell to a branch that returned
 * early — so it PASSED against the very band that had gone silent. §5.6 inside
 * the control written to catch §5.6, found by witnessing the red it was
 * supposed to produce. Do not reintroduce an export-shaped read here.
 */

/** Every `band: [lo, hi]` with the metric key it belongs to, from the source. */
function bandsFromSource() {
  const src = readFileSync(join(REPO, 'tools/check-doc-counts.mjs'), 'utf8')
  const out = new Map()
  for (const m of src.matchAll(/\{\s*key:\s*'([^']+)'[\s\S]{0,400}?band:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/g)) {
    out.set(m[1], [Number(m[2]), Number(m[3])])
  }
  return out
}

/** What the tree actually holds, from the checker's own `--derive`. */
function derived() {
  const run = spawnSync(process.execPath, ['tools/check-doc-counts.mjs', '--derive'], {
    cwd: REPO,
    encoding: 'utf8',
  })
  assert.equal(run.status, 0, `--derive failed: ${run.stderr}`)
  const out = new Map()
  for (const line of run.stdout.split('\n')) {
    const m = /^\s*(\d+)\s+(.+?)\s*$/.exec(line)
    if (m !== null) out.set(m[2], Number(m[1]))
  }
  return out
}

test('test_every_derived_total_sits_inside_its_own_plausibility_band', () => {
  const bands = bandsFromSource()
  const totals = derived()

  /* The probe must be able to fail. If either side came back empty the regex or
     the output format moved, and an empty comparison is a vacuous pass — which
     is the exact defect this file exists to catch. */
  assert.ok(bands.size > 0, 'no `band: [lo, hi]` found in check-doc-counts.mjs — the reader has rotted')
  assert.ok(totals.size > 0, 'no totals parsed from --derive — the output format moved')

  const outgrown = []
  let compared = 0
  for (const [key, [lo, hi]] of bands) {
    const actual = totals.get(key)
    if (actual === undefined) continue
    compared += 1
    if (actual < lo || actual > hi) {
      outgrown.push(`${key}: the tree holds ${actual}, outside band [${lo}, ${hi}]`)
    }
  }

  assert.ok(compared > 0, 'no band was matched to a derived total — the two vocabularies have drifted apart')

  assert.deepEqual(
    outgrown,
    [],
    'A derived total has grown outside its plausibility band. `check-doc-counts.mjs` ' +
      'applies that band to the CLAIMED value, so from now on every document line ' +
      'stating the CURRENT total is silently skipped while lines carrying OLD, WRONG ' +
      'totals stay inside the band and keep being checked \u2014 the checker goes quiet ' +
      'about the right answers and stays loud about the wrong ones, at EXIT 0.\n  ' +
      outgrown.join('\n  ') +
      '\nRaise the band deliberately in tools/check-doc-counts.mjs and say why. Note ' +
      'that 400 was tried and is WRONG: it reports docs/salvage-ledger.md\u2019s 184 \u2014 ' +
      'a claim about the REPLACED SAP-line application \u2014 as our stale number.',
  )
})

/**
 * \u00a72 \u00b7 THE FLOOR CASE, WHICH IS THE ONE THIS FILE FOUND AND DID NOT CLOSE \u2014
 * G1771/G1772, 21 Sep 2026, K5's half of G1480.
 *
 * \ud83d\uded1 **THE TEST ABOVE CATCHES A TREE THAT HAS LEFT ITS BAND. IT CANNOT CATCH A
 * BAND THAT EXCLUDES A VALUE ITS OWN METRIC CAN TAKE**, and for `visuals` the
 * floor of 1 did exactly that: ZERO is reachable \u2014 G264 deleted nine visuals in
 * one commit \u2014 so every document line stating `0 visuals` was filtered out
 * before it was ever compared.
 *
 * **Witnessed, at the floor of 1**: a line reading *"The repository ships 0
 * visuals."* added to `docs/INDEX.md` \u2014 WRONG, the tree holds 1 \u2014 produced NO
 * finding and EXIT 0, while three other wrong lines on the same metric (2, 9,
 * 10) were reported. At `[0, 30]` the same line is `STALE` and the run is
 * EXIT 1.
 *
 * \u26a0\ufe0f **AND THE CHANGE WAS MEASURED BEFORE IT WAS MADE, which is the check 400
 * failed for `contract operations`:** this metric reports the SAME SEVEN lines
 * at a floor of 1 and at a floor of 0. Nothing foreign enters.
 */
test('test_the_visuals_floor_admits_the_value_its_own_metric_can_reach', () => {
  const bands = bandsFromSource()
  const visuals = bands.get('visuals')
  assert.ok(visuals !== undefined, '`visuals` is no longer a governed metric \u2014 this pin has rotted')
  assert.equal(
    visuals[0],
    0,
    'the `visuals` floor is back above zero. **A count of HTML files in `docs/` can be zero \u2014 ' +
      'G264 deleted nine in one commit \u2014 and a floor that excludes a reachable value of its ' +
      'own metric is not separating a foreign subject, it is hiding its own.** Witnessed at a ' +
      'floor of 1: a document line saying `0 visuals` was WRONG, was never reported, and the ' +
      'run was EXIT 0, while lines saying 2, 9 and 10 were reported. Measured before the ' +
      'change: the metric reports the SAME SEVEN lines at floor 1 and at floor 0, so nothing ' +
      'foreign enters. If this was raised deliberately, say what a floor of 0 sweeps in.',
  )
})

/**
 * \u00a73 \u00b7 AND THE HEADROOM READING MUST NOT WARN ABOUT A CROSSING THAT CANNOT
 * HAPPEN \u2014 G1772.
 *
 * Every derivation counts things, so no metric reaches a value below zero. A
 * line reading `visuals: 1, floor 0 \u2014 1 of headroom` is a permanent warning
 * about an impossible event, sitting inside a block that tells the reader to
 * ACT. **G95's argument applies exactly** \u2014 a signal that is always on teaches
 * people to skim the block it lives in, and the next line in that block is a
 * real one.
 *
 * \ud83d\uded1 **THIS IS RED IN BOTH DIRECTIONS AND BOTH ARE ASSERTED**: no floor-0
 * metric may appear in the reading, AND the reading must still be produced for
 * the metrics genuinely near an edge \u2014 a version that printed nothing at all
 * would satisfy the first half alone.
 */
test('test_a_floor_of_zero_is_not_reported_as_headroom_and_the_reading_still_works', () => {
  const run = spawnSync(process.execPath, ['tools/check-doc-counts.mjs'], {
    cwd: REPO,
    encoding: 'utf8',
  })
  const out = `${run.stdout}${run.stderr}`

  const headroom = out
    .split('\n')
    .filter((l) => l.includes('of headroom'))
    .map((l) => l.trim())

  /* ANTI-VACUOUS. If the reading stopped being printed, "no floor-0 line" is
     true of an empty set and this test passes having checked nothing \u2014 \u00a75.6,
     in the file written to catch \u00a75.6. `scope dimensions` (6, floor 4) and
     `invariants` (11, floor 8) are both within three today. */
  assert.ok(
    headroom.length > 0,
    'the headroom reading printed nothing at all. At least two metrics sit within three of a ' +
      'band edge on this tree, so an empty reading means the block stopped being produced \u2014 ' +
      'and the assertion below would then be vacuously true.',
  )

  const floorZero = headroom.filter((l) => /floor 0\b/.test(l))
  assert.deepEqual(
    floorZero,
    [],
    'the headroom reading names a metric whose floor is 0. **A count cannot go below zero, so ' +
      'there is no crossing to warn about** \u2014 the line is a permanent warning about an ' +
      'impossible event, in a block headed "raise the band DELIBERATELY". Measured: with the ' +
      '`visuals` floor moved to 0 and the `lo > 0` condition absent, the run still printed ' +
      '`visuals: 1, floor 0 \u2014 1 of headroom`, about the very metric the move was made for.\n  ' +
      floorZero.join('\n  '),
  )
})

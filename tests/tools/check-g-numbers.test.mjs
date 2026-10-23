/**
 * The seam suite for `tools/check-g-numbers.mjs` — exactly three tests, one per
 * exported seam, driven over fixtures rather than over stdout.
 *
 * 🛑 THIS FILE DECLARED THREE TESTS AND THE RUNNER REPORTED `tests 1` UNTIL
 * 17 Aug 2026, AND THAT IS THE DEFECT IT NOW GUARDS. The checker had no
 * main-module guard, so importing any seam from it ran the CLI and called
 * `process.exit()` DURING MODULE EVALUATION — before `node --test` collected a
 * single `test()` callback. The runner saw a child that exited cleanly with no
 * test output and marked the FILE green. Every assertion below was phantom;
 * replacing all four of them with knowingly false ones still reported
 * `pass 1 · fail 0`. §5.6, shipped inside the PR whose whole purpose was to add
 * a control.
 *
 * ACCEPTANCE SIGNAL, and it is a count rather than a colour:
 *   node --test tests/tools/check-g-numbers.test.mjs   →   `tests 3`
 * Anything reporting `tests 1` is vacuous no matter how green it looks.
 *
 * The five negative controls M1–M5 live next door in
 * `check-g-numbers-negative-controls.test.mjs`; the process exit codes live in
 * `check-g-numbers-exit.test.ts`.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseGRows,
  findDuplicates,
  findTrunkCollisions,
} from '../../tools/check-g-numbers.mjs'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'g-numbers')
const fixture = (...parts) => parseGRows(readFileSync(join(FIXTURES, ...parts), 'utf8'))

test('only column-0 table anchors are rows, and a number that anchors two of them is a duplicate', () => {
  const rows = parseGRows([
    'G186 in prose is not a row.',
    '`| G186 |` inline is not a row either.',
    '| G186 | one |',
    '| G187 | two |',
    '| G186 | three |',
  ].join('\n'))
  assert.deepEqual(rows.map(r => r.number), [186, 187, 186])
  assert.deepEqual(rows.map(r => r.line), [3, 4, 5])
  assert.deepEqual(findDuplicates(rows), [186])
  assert.deepEqual(findDuplicates(fixture('m4-amendment', 'branch.md')), [])
})

test('a collision is a number ABSENT at the merge base and already spent on trunk — replay of 1a919485', () => {
  // The one real G-number collision in this repository's history:
  // `design/teal-world-and-o16` (ce2fb20e) against trunk (7f3aa24b), forked at
  // 50991c12, merged at 1a919485 with the design set renumbered to G186–G190.
  const dir = 'replay-1a919485'
  const branch = fixture(dir, 'branch.md')
  const trunk = fixture(dir, 'trunk.md')
  const base = fixture(dir, 'merge-base.md')
  assert.deepEqual([base.length, trunk.length, branch.length], [178, 185, 183])

  const verdict = findTrunkCollisions(branch, trunk, base)
  assert.equal(verdict.state, 'ok')
  // Exactly the five the merge commit renumbered. NOT the twelve a
  // branch-to-trunk byte comparison reports — 72, 109, 139, 150, 153, 172 and
  // 178 are rows trunk amended after the fork, and flagging them is what makes
  // a gate get routed around.
  assert.deepEqual(verdict.numbers, [179, 180, 181, 182, 183])
  for (const amended of [72, 109, 139, 150, 153, 172, 178]) {
    assert.ok(!verdict.numbers.includes(amended), `${amended} is an amendment, not a collision`)
  }
})

test('either side missing is reported as `unavailable`, never as a clean `ok`', () => {
  const rows = fixture('m4-amendment', 'branch.md')
  const trunk = fixture('m4-amendment', 'trunk.md')
  const base = fixture('m4-amendment', 'merge-base.md')
  for (const [t, b] of [[null, null], [trunk, null], [null, base]]) {
    const verdict = findTrunkCollisions(rows, t, b)
    assert.equal(verdict.state, 'unavailable')
    assert.deepEqual(verdict.numbers, [])
  }
  // …and with both sides present it must actually reach a verdict, or the
  // assertions above are satisfied by a function that always says unavailable.
  assert.equal(findTrunkCollisions(rows, trunk, base).state, 'ok')
})

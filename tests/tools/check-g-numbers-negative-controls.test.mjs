/**
 * M1–M5 — the five negative controls issue #242 owes, each a plausible lazy
 * implementation of `tools/check-g-numbers.mjs` taken from a real shape in this
 * tree rather than invented.
 *
 * | | mutation | what it certifies wrongly |
 * |---|---|---|
 * | M1 | count rows with `grep -c` | `grep -c` counts LINES; `grep -o` counts MATCHES; a row is neither |
 * | M2 | match `G[0-9]+` anywhere instead of at `^\| G(\d+) \|` | prose narrating a renumber, and a cell citing another ruling, register as rulings |
 * | M3 | compare against local `main` | a local `main` is arbitrarily behind — precisely how both collisions reproduce |
 * | M4 | flag any row trunk also has whose text differs | every in-place amendment goes red, and this record amends constantly |
 * | M5 | scan the raw file including fenced blocks | the reproduce commands quoting row syntax register as rulings |
 *
 * Each mutation is applied to a scratch copy of the GREEN commit and this file
 * is required to go red; the transcript is in the implementing commit message.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseGRows,
  findTrunkCollisions,
  readComparisonSides,
  TRUNK_REF,
  BRANCH_REF,
  RECORD_PATH,
} from '../../tools/check-g-numbers.mjs'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'g-numbers')
const fixture = (...parts) => parseGRows(readFileSync(join(FIXTURES, ...parts), 'utf8'))

test('M1 — a row is not a line and not a match: two rows across three `| G` lines and four patterns', () => {
  const raw = readFileSync(join(FIXTURES, 'm1-two-patterns-one-line.md'), 'utf8')
  // The three counts a lazy implementation would reach for, all different.
  assert.equal(raw.split('\n').filter(l => l.includes('| G')).length, 3, 'grep -c would say 3')
  assert.equal(raw.match(/\| G\d+ \|/g).length, 4, 'grep -o would say 4')
  // The only right answer.
  const rows = parseGRows(raw)
  assert.deepEqual(rows.map(r => r.number), [186, 188])
  assert.equal(rows.length, 2)
})

test('M2 — prose narrating a renumber, and a cell citing another ruling, mint nothing', () => {
  const rows = fixture('m2-prose-and-citations.md')
  // Pass J's paragraph names G179–G183 in running text and G72's own cell cites
  // G179. Not one of those is a row.
  assert.deepEqual(rows.filter(r => r.number === 179), [])
  for (const narrated of [179, 180, 181, 182, 183, 185, 186, 190]) {
    assert.ok(!rows.some(r => r.number === narrated), `G${narrated} is narrated, not minted`)
  }
  // Exactly one anchor in the file: G72's amendment row itself.
  assert.deepEqual(rows.map(r => r.number), [72])
})

test('M3 — the refs read are `origin/main` and the merge base, never a local `main`', () => {
  const asked = []
  const fake = args => {
    asked.push(args)
    if (args[0] === 'merge-base') return '50991c12837c10e42a49887dee8895447b681fb6\n'
    return '| G60 | a row |\n'
  }
  const sides = readComparisonSides(fake)
  assert.equal(sides.state, 'ok')

  assert.equal(TRUNK_REF, 'origin/main')
  assert.notEqual(TRUNK_REF, 'main')
  assert.equal(BRANCH_REF, 'HEAD')
  assert.deepEqual(asked[0], ['merge-base', 'origin/main', 'HEAD'])
  assert.deepEqual(asked[1], ['show', `origin/main:${RECORD_PATH}`])
  assert.deepEqual(asked[2], ['show', `50991c12837c10e42a49887dee8895447b681fb6:${RECORD_PATH}`])
  assert.equal(asked.length, 3, 'three local object reads, no fetch and no fourth ref')
  // Not one of them may name a bare local branch.
  for (const args of asked) {
    for (const arg of args) {
      assert.ok(!/(^|[\s:])main([\s:]|$)/.test(arg), `\`${arg}\` names a local branch`)
    }
  }
  // The merge base must be RESOLVED, not assumed: refuse if git cannot answer.
  const unresolvable = readComparisonSides(() => { throw new Error('fatal: no merge base') })
  assert.equal(unresolvable.state, 'unavailable')
  assert.equal(unresolvable.trunkRows, null)
  assert.equal(unresolvable.baseRows, null)
})

test('M4 — an in-place amendment is not a collision; a number absent at the fork is', () => {
  const dir = 'm4-amendment'
  const verdict = findTrunkCollisions(fixture(dir, 'branch.md'), fixture(dir, 'trunk.md'), fixture(dir, 'merge-base.md'))
  assert.equal(verdict.state, 'ok')
  // G60 — amended in place here, trunk's text preserved and appended to (cause c).
  // G61 — amended by TRUNK after the fork; this branch is simply stale (cause b).
  // G62 — minted here for a different ruling, already spent on trunk (cause a).
  assert.deepEqual(verdict.numbers, [62])
  assert.ok(!verdict.numbers.includes(60), 'an in-place amendment is normal operation')
  assert.ok(!verdict.numbers.includes(61), 'a stale branch is not a collision')
})

test('M5 — a FENCED block quoting row syntax mints nothing', () => {
  const raw = readFileSync(join(FIXTURES, 'm5-fenced-block.md'), 'utf8')
  // The fixture must actually contain fenced rows at column 0, or it asserts
  // nothing about fence tracking — the inline-backtick form fails the `^| G`
  // anchor on its own and leaves the fence lines deletable with all tests green.
  const fenceOpeners = raw.split('\n').filter(l => /^\s*```/.test(l)).length
  assert.ok(fenceOpeners >= 4 && fenceOpeners % 2 === 0, 'two closed fenced blocks')
  const insideFence = raw.split('\n').filter(l => /^\| G\d+ \|/.test(l)).length
  assert.equal(insideFence, 3, 'three column-0 row-shaped lines, two of them fenced')

  assert.deepEqual(parseGRows(raw).map(r => r.number), [191])
})

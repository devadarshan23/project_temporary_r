/**
 * A FIXTURE WITH A KNOWN NUMBER OF HIDDEN ASSERTIONS.
 *
 * Not named `*.test.mjs`: `npm test`'s glob would otherwise run it as part of
 * the suite, and a fixture that deliberately skips would then appear in the
 * census it exists to measure.
 *
 * THE NUMBERS THIS FIXTURE IS BUILT TO PRODUCE, and they are asserted in
 * `tests/tools/skip-census.test.ts` rather than only written here:
 *
 *   · the skipped suite hides 5 assertions — 2 direct, 1 in a nested suite,
 *     and 2 more created by a `for…of` over a 2-element array, which the AST
 *     walk sees as ONE call expression and therefore marks `≥`.
 *   · node reports `skipped 1`: the loose `it` below, which was registered and
 *     then stood down. The suite's five contribute nothing to that counter.
 */

import { describe, it } from 'node:test'

describe('a suite that stands down', { skip: 'the fixture skips on purpose' }, () => {
  it('one', () => {})
  it('two', () => {})
  describe('nested', () => {
    it('three', () => {})
  })
  for (const n of ['four', 'five']) {
    it(n, () => {})
  }
})

it('a registered test that stands down', { skip: 'counted by node' }, () => {})

it('a test that runs', () => {})

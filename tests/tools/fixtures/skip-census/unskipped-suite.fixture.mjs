/**
 * THE CONTROL FOR `skipped-suite.fixture.mjs` — THE SAME FILE WITH THE `{ skip }`
 * REMOVED, AND NOTHING ELSE CHANGED.
 *
 * Its only job is to make the hidden number a MEASUREMENT rather than a claim:
 * run this one and node reports the five assertions its twin hides. Without it,
 * `tests/tools/skip-census.test.ts` would be comparing the census against a
 * number written in a comment by the same person who wrote the census.
 */

import { describe, it } from 'node:test'

describe('a suite that stands down', () => {
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

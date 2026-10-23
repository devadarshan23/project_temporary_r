import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { indexDeclarations, resolveFragment } from '../../tools/citation-symbols.mjs'

const FIXTURE = `
import type { RegionKey } from './regions.ts'

/**
 * THE ENDPOINT SPINE. \`Endpoint\` is the thing a Solution binds to, and this
 * sentence exists so that a bare-name search lands HERE and not on the
 * declaration below. A stray brace in prose — { — and a literal '}' too.
 */
export interface Endpoint {
  /** Where the credential lives. */
  origin: 'upload' | 'connector'
  /**
   * Reading from SAP and posting to SAP are a cliff, not a slope.
   */
  writebackEnabled: boolean
}

export interface SourceDocument {
  origin: 'upload' | 'connector' | 'api'
  filename: string
}

export type RolloutStrategy =
  | { kind: 'canary'; percentages: number[] }
  /** Essential where residency differs per tenant. */
  | { kind: 'regional'; order: RegionKey[] }

export const Dup = {
  row: 1,
  row: 2,
}
`

const idx = indexDeclarations(FIXTURE)
const at = (frag) => resolveFragment(idx, FIXTURE, frag)

describe('a SYMBOL fragment resolves to the declaration, not to a mention of it', () => {
  it('a top-level interface resolves to its own declaration line', () => {
    const r = at('Endpoint')
    assert.equal(r.verdict, 'RESOLVED')
    assert.match(FIXTURE.split('\n')[r.line - 1], /^export interface Endpoint/)
  })

  it('and it does NOT resolve to the docblock six lines above that names it', () => {
    const r = at('Endpoint')
    assert.doesNotMatch(FIXTURE.split('\n')[r.line - 1], /^\s*\*/)
  })

  it('a member resolves to the member, and its extent includes its OWN docblock', () => {
    const r = at('Endpoint.writebackEnabled')
    assert.equal(r.verdict, 'RESOLVED')
    assert.ok(r.start < r.line, 'the docblock above the member is part of it')
    assert.match(FIXTURE.split('\n').slice(r.start - 1, r.line).join('\n'), /cliff, not a slope/)
  })

  it('a union arm resolves to the type alias that owns it', () => {
    const r = at('RolloutStrategy')
    assert.equal(r.verdict, 'RESOLVED')
    assert.ok(r.end - r.start >= 3, 'the extent must cover every arm, not just the first')
  })
})

describe('NC — a name that is present but not DECLARED is refused (mutation M1)', () => {
  for (const [what, frag] of [
    ['a name that only appears in a docblock', 'THE'],
    ['an imported-but-not-declared type', 'RegionKey'],
    ['a name that appears nowhere at all', 'Nonesuch'],
  ]) {
    it(`refuses ${what}`, () => {
      assert.equal(at(frag).verdict, 'NO_SUCH_SYMBOL', 'a bare-name search finds this and a declaration index does not')
    })
  }

  it('and the refusal discriminates — a real declaration beside it resolves', () => {
    assert.equal(at('SourceDocument').verdict, 'RESOLVED')
  })
})

describe('NC — a member is checked as a MEMBER, not as its parent (mutation M2)', () => {
  it('refuses a member the parent does not have', () => {
    assert.equal(at('SourceDocument.nonexistent').verdict, 'NO_SUCH_SYMBOL')
  })

  it('refuses a member borrowed from a DIFFERENT parent', () => {
    assert.equal(at('SourceDocument.writebackEnabled').verdict, 'NO_SUCH_SYMBOL')
  })

  it('and both siblings named `origin` resolve, to DIFFERENT lines', () => {
    const a = at('Endpoint.origin'), b = at('SourceDocument.origin')
    assert.equal(a.verdict, 'RESOLVED')
    assert.equal(b.verdict, 'RESOLVED')
    assert.notEqual(a.line, b.line, 'if these are equal the index attributed a member to the wrong parent — M4')
  })

  it('refuses the BARE member name, because a member is only addressable qualified', () => {
    assert.equal(at('origin').verdict, 'NO_SUCH_SYMBOL')
  })
})

describe('NC — a duplicate name is REFUSED, never silently chosen (mutation M3)', () => {
  it('refuses an ambiguous fragment rather than taking the first', () => {
    const r = at('Dup.row')
    assert.equal(r.verdict, 'AMBIGUOUS')
    assert.equal(r.candidates.length, 2, 'and it must report BOTH, so a human can pick')
  })
})

describe('NC — the index masks comments and literals (mutation M4)', () => {
  it('a stray `{` in a docblock does not swallow the following declaration', () => {
    assert.equal(at('SourceDocument').verdict, 'RESOLVED')
    assert.equal(at('RolloutStrategy').verdict, 'RESOLVED')
  })

  it("a `}` inside a string literal does not close the interface early", () => {
    assert.equal(at('Endpoint.writebackEnabled').verdict, 'RESOLVED')
  })
})

describe('NC — an ANCHOR must occur EXACTLY once (mutation M5)', () => {
  it('resolves a phrase that occurs once', () => {
    assert.equal(at('"a cliff, not a slope"').verdict, 'RESOLVED')
  })

  it('refuses a phrase that occurs twice', () => {
    assert.equal(at('"origin"').verdict, 'ANCHOR_AMBIGUOUS')
  })

  it('refuses a phrase that occurs never', () => {
    assert.equal(at('"a slope, not a cliff"').verdict, 'ANCHOR_MISSING')
  })

  it('the anchor is LITERAL — it is not a regex and does not become one', () => {
    assert.equal(at('"a cliff. not a slope"').verdict, 'ANCHOR_MISSING')
  })
})

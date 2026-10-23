/**
 * THE NAME, THE PAIR AND THE PARKED PILE — `model/ingestion.ts` §2a.
 * G2831–G2840, 2 Oct 2026, applying G2692 (THE OWNER'S RULING): *"store an
 * Arrival's filename verbatim, interpreted by nothing … add a `parked`
 * ArrivalVerdict arm."*
 *
 * Pure. The stored half is `tests/db/arrival-parking.test.ts`; the served half
 * is `tests/http/parked-pile-served.test.ts`.
 *
 * THE REDS THIS FILE EXISTS FOR, each witnessed by mutation (G2841):
 *   §2  `nameFallsUnder()` made case-insensitive (`toLowerCase()` on both
 *       sides) — the NFC/NFD, case and trailing-space rows went RED: a name the
 *       operator never declared was claimed by a pair.
 *   §3  the ambiguity arm deleted (first match wins) — §3b went RED: two
 *       matching pairs extracted into whichever was declared first, which is
 *       row 7's *"guessed into the nearest type"*.
 *   §5  the `Object.create(null)` containers replaced by `{}` — §5c went RED:
 *       a declared `__proto__` key wrote the PROTOTYPE and the field vanished
 *       from `JSON.stringify`.
 *   §7  `parked.ts` made to publish `row.filename?.toLowerCase()` — RED:
 *       *"server/data-plane/parked.ts interprets a filename"*.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import {
  ARRIVAL_VERDICT_HOLDS_THE_ARTEFACT,
  ARRIVAL_VERDICT_KINDS,
  ARRIVAL_VERDICT_STORES_A_DOCUMENT,
  PARK_REASONS,
  arrivalFilenameFrom,
  decideArrival,
  nameFallsUnder,
  projectThroughMapping,
  type ArrivalFacts,
  type ArrivalFilename,
  type ArrivalVerdict,
  type DeclaredPair,
} from '../../model/ingestion.ts'
import { parseFieldPath } from '../../model/field-path.ts'
import type { AssertNoTextDeep } from '../../model/reconciliation.ts'
import type { FieldPath } from '../../model/kernel.ts'

function path(input: unknown): FieldPath {
  const parsed = parseFieldPath(input)
  if (!parsed.ok) throw new Error('fixture path did not parse')
  return parsed.path
}

function name(raw: string): ArrivalFilename {
  const n = arrivalFilenameFrom(raw)
  if (n === null) throw new Error(`fixture name refused: ${JSON.stringify(raw)}`)
  return n
}

const MAPPING = [
  { sourceField: 'InvNo', path: path(['invoice', 'number']) },
  { sourceField: 'Total', path: path(['invoice', 'total']) },
]

function pair(over: Partial<DeclaredPair> = {}): DeclaredPair {
  return {
    pairId: 'edt_a',
    documentTypeId: 'dty_invoice',
    match: { kind: 'path_prefix', value: 'invoices/' },
    expectedFidelity: 'structured',
    mapping: MAPPING,
    ...over,
  }
}

const RECORD = { InvNo: 'INV-1', Total: '100.00', Extra: 'dropped' }

describe('the parked pile in the model (G2692 — the owner’s)', () => {
  it('§1 · THREE verdicts, and the two total records answer for every one', () => {
    assert.deepEqual(Object.values(ARRIVAL_VERDICT_KINDS).sort(), ['admitted', 'parked', 'refused'])
    /* Only an admission stores a document AT ARRIVAL; only a park holds the
     * artefact for later. A parked arrival may become a document only through a
     * drain, which is a different act. */
    assert.deepEqual(ARRIVAL_VERDICT_STORES_A_DOCUMENT, { admitted: true, refused: false, parked: false })
    assert.deepEqual(ARRIVAL_VERDICT_HOLDS_THE_ARTEFACT, { admitted: false, refused: false, parked: true })
    const parked: ArrivalVerdict = { kind: 'parked', parkedAt: '2026-10-02T00:00:00.000Z' }
    // @ts-expect-error — a parked verdict carries NO reason: it is derived (row 7, "one state")
    const withReason: ArrivalVerdict = { kind: 'parked', parkedAt: parked.parkedAt, reason: 'x' }
    void withReason
  })

  it('§1b · the name NEVER enters the cascade — `ArrivalFacts` still admits no text', () => {
    // @ts-expect-error — a filename on the facts is a bare `string` and breaks the proof
    type _WithName = AssertNoTextDeep<ArrivalFacts & { readonly filename: string }>
    const facts: Record<keyof ArrivalFacts, true> = {
      arrivalId: true,
      channelId: true,
      channelKind: true,
      endpointId: true,
      authorizationId: true,
      byteCount: true,
    }
    assert.equal(Object.keys(facts).length, 6, 'ArrivalFacts gained a field')
  })

  it('§1c · the ONE seam stores what it is given, and refuses only what cannot be stored', () => {
    for (const raw of ['../etc/passwd', '/abs', 'trailing ', 'tab\there', 'a\nb', 'café', '.*']) {
      assert.equal(arrivalFilenameFrom(raw), raw, `${JSON.stringify(raw)} was not stored verbatim`)
    }
    for (const raw of ['', 'nul\u0000x', 'x'.repeat(1025), 42, null, undefined, {}]) {
      assert.equal(arrivalFilenameFrom(raw), null, `${JSON.stringify(raw)} was accepted`)
    }
  })

  it('§2 · the ONE comparison is byte equality or a byte prefix — nothing is folded, normalised or compiled', () => {
    const exact = { kind: 'filename', value: 'invoice.csv' } as const
    assert.equal(nameFallsUnder(name('invoice.csv'), exact), true)
    assert.equal(nameFallsUnder(name('in/2026/invoice.csv'), exact), true, 'a filename pattern compares the LAST segment')
    for (const other of ['INVOICE.csv', 'invoice.csv ', 'invoice.CSV', 'xinvoice.csv', 'invoice.csv/']) {
      assert.equal(nameFallsUnder(name(other), exact), false, `${other} matched "invoice.csv"`)
    }
    /* NFC vs NFD: the same glyph, different code units. Not the same name. */
    assert.equal(
      nameFallsUnder(name('café.csv'), { kind: 'filename', value: 'café.csv' }),
      false,
      'Unicode normalisation was applied — that is interpretation',
    )
    /* A pattern that LOOKS like a regex is a literal. */
    const dotStar = { kind: 'path_prefix', value: '.*' } as const
    assert.equal(nameFallsUnder(name('anything.csv'), dotStar), false, 'a pattern was compiled')
    assert.equal(nameFallsUnder(name('.*/a.csv'), dotStar), true)
    const prefix = { kind: 'path_prefix', value: 'invoices/' } as const
    assert.equal(nameFallsUnder(name('invoices/a.csv'), prefix), true)
    assert.equal(nameFallsUnder(name('Invoices/a.csv'), prefix), false)
    assert.equal(nameFallsUnder(name('x/invoices/a.csv'), prefix), false)
  })

  it('§3 · exactly one pair extracts; none or two PARK — never guessed into the nearest type', () => {
    const one = decideArrival(name('invoices/a.json'), RECORD, [pair()])
    assert.deepEqual(one, {
      kind: 'extract',
      pairId: 'edt_a',
      documentTypeId: 'dty_invoice',
      payload: one.kind === 'extract' ? one.payload : null,
    })
    assert.equal(JSON.stringify(one.kind === 'extract' ? one.payload : null), '{"invoice":{"number":"INV-1","total":"100.00"}}')

    const none = decideArrival(name('statements/a.json'), RECORD, [pair()])
    assert.deepEqual(none, { kind: 'park', reason: PARK_REASONS.noDeclaredPairMatches, matchingPairIds: [] })

    /* Row 7: a document that arrived BEFORE its type was declared parks in the
     * same bucket — no pairs at all is the same answer. */
    assert.deepEqual(decideArrival(name('invoices/a.json'), RECORD, []), none)
    assert.deepEqual(decideArrival(null, RECORD, [pair()]), none, 'a nameless artefact was classified')
  })

  it('§3b · two matching pairs park, naming both', () => {
    const b = pair({ pairId: 'edt_b', match: { kind: 'filename', value: 'a.json' } })
    const two = decideArrival(name('invoices/a.json'), RECORD, [pair(), b])
    assert.deepEqual(two, {
      kind: 'park',
      reason: PARK_REASONS.moreThanOnePairMatches,
      matchingPairIds: ['edt_a', 'edt_b'],
    })
  })

  it('§4 · the TYPE may refuse after the name selects — R12 took no OCR (G2690)', () => {
    for (const fidelity of ['digital_text', 'scanned'] as const) {
      assert.deepEqual(decideArrival(name('invoices/a.json'), RECORD, [pair({ expectedFidelity: fidelity })]), {
        kind: 'park',
        reason: PARK_REASONS.pairTypeIsNotExtractable,
        matchingPairIds: ['edt_a'],
      })
    }
    assert.equal(decideArrival(name('invoices/a.json'), RECORD, [pair({ expectedFidelity: 'tabular' })]).kind, 'extract')
  })

  it('§5 · the mapping is APPLIED and nothing else crosses', () => {
    /* A record that is not an object cannot be mapped: it parks. */
    for (const held of [[1, 2], 'text', 42, null]) {
      assert.deepEqual(decideArrival(name('invoices/a.json'), held, [pair()]), {
        kind: 'park',
        reason: PARK_REASONS.artefactDoesNotFitTheMapping,
        matchingPairIds: ['edt_a'],
      })
    }
    /* An absent source field leaves its position absent — not null, absent. */
    const partial = projectThroughMapping({ InvNo: 'INV-2' }, MAPPING)
    assert.equal(JSON.stringify(partial.ok ? partial.payload : null), '{"invoice":{"number":"INV-2"}}')
    /* An inherited property is not a delivered field. */
    const inherited = projectThroughMapping(Object.create({ InvNo: 'INHERITED' }) as unknown, MAPPING)
    assert.equal(JSON.stringify(inherited.ok ? inherited.payload : null), '{}')
  })

  it('§5b · an indexed or colliding target is refused rather than built', () => {
    const indexed = projectThroughMapping(RECORD, [{ sourceField: 'InvNo', path: path(['lines', 0, 'ref']) }])
    assert.deepEqual(indexed, { ok: false, refusal: { kind: 'mapping_target_is_indexed' } })
    const collide = projectThroughMapping(RECORD, [
      { sourceField: 'InvNo', path: path(['invoice']) },
      { sourceField: 'Total', path: path(['invoice', 'total']) },
    ])
    assert.deepEqual(collide, { ok: false, refusal: { kind: 'mapping_targets_collide' } })
  })

  it('§5c · a declared `__proto__` key is a property, never a prototype write', () => {
    const held = JSON.parse('{"__proto__": {"polluted": true}, "InvNo": "INV-3"}') as unknown
    const out = projectThroughMapping(held, [
      { sourceField: '__proto__', path: path(['__proto__']) },
      { sourceField: 'InvNo', path: path(['invoice', 'number']) },
    ])
    assert.ok(out.ok)
    assert.equal(JSON.stringify(out.payload), '{"__proto__":{"polluted":true},"invoice":{"number":"INV-3"}}')
    assert.equal(({} as Record<string, unknown>)['polluted'], undefined, 'Object.prototype was polluted')
  })

  it('§7 · INVARIANT 6, AS A CENSUS — in `server/`, a name is stored, published and handed to `decideArrival()`, and nothing else', () => {
    /* The ruling: *"interpreted by nothing"*. A filename that reaches a string
     * method, a pattern, a log line or a model is interpretation, and this
     * census is what makes the next one a red gate rather than a review. */
    const allowed = new Set(['server/data-plane/payload-store.ts', 'server/data-plane/parked.ts'])
    const forbidden = /filename[^,;)]*\.(split|match|replace|startsWith|endsWith|includes|slice|toLowerCase|toUpperCase|normalize|trim)\(|RegExp\([^)]*filename|console\.[a-z]+\([^)]*filename|resolveModel\([^)]*filename/
    const root = new URL('../../', import.meta.url)
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(new URL(dir, root), { withFileTypes: true })) {
        const rel = `${dir}${entry.name}`
        if (entry.isDirectory()) walk(`${rel}/`)
        else if (rel.endsWith('.ts')) files.push(rel)
      }
    }
    walk('server/')
    assert.ok(files.length > 20, `the census read ${files.length} files — it is reading nothing`)
    const naming: string[] = []
    for (const rel of files) {
      const code = readFileSync(new URL(rel, root), 'utf8')
        .split('\n')
        .filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l))
      const hits = code.filter((l) => /\bfilename\b/.test(l) && !/'filename'/.test(l))
      if (hits.length === 0) continue
      naming.push(rel)
      for (const line of hits) assert.doesNotMatch(line, forbidden, `${rel} interprets a filename: ${line.trim()}`)
    }
    assert.deepEqual(naming.filter((f) => !allowed.has(f)), [], 'a new file in server/ handles an arrival name')
    assert.ok(naming.length === 2, `the census found ${naming.length} handlers, not the two it governs`)
  })

  it('§6 · INVARIANT 6 — nothing in the model compiles or folds a name', () => {
    const src = readFileSync(new URL('../../model/ingestion.ts', import.meta.url), 'utf8')
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join('\n')
    const section = code.slice(code.indexOf('export function nameFallsUnder'), code.indexOf('export interface PairMappingLine'))
    assert.ok(section.length > 0, 'nameFallsUnder was not found — this control reads nothing')
    for (const forbidden of ['RegExp', 'toLowerCase', 'toUpperCase', 'normalize', 'trim', 'match(', 'localeCompare']) {
      assert.equal(section.includes(forbidden), false, `nameFallsUnder uses ${forbidden}`)
    }
  })
})

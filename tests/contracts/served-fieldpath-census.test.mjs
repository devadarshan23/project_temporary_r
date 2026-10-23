/**
 * THE SERVED `FieldPath` CENSUS — G2472, 1 Oct 2026. The control G2375 says
 * was missing.
 *
 * G2375 was a 500 waiting on the first served row that carried a stored path:
 * three channels published the STORED token list (`['lines', 7, 'amount']`)
 * where the contract's `FieldPath` is an array of `FieldSegment` OBJECTS, and
 * `fast-json-stringify` threw. It was latent for a month because **no served
 * suite ever persisted a row carrying one** — every fixture had
 * `heldReads: []`, `refusedAtAdmission: []`, `ambiguities: []`. The type
 * system could not see it (the store answers `Record<string, unknown>`), the
 * wire-mirror checker could not see it (it compares vocabularies, not
 * encodings), and `required-fields-served` could not see it (a present field
 * of the wrong shape is present).
 *
 * WHAT THIS DOES. It DERIVES, from the contract corpus and the two `start.ts`
 * files, every location at which a MOUNTED operation's success response can
 * carry a `FieldPath` (or a bare `FieldSegment`), and requires that set to
 * equal `WITNESSED` below EXACTLY. Each entry names a served test that
 * persists a row carrying the path and asserts the segment-object wire shape.
 *
 *   · a NEW path-bearing field on a served response   → RED until it is listed
 *     here with a witness, which means somebody wrote the served test;
 *   · a NEW mount of an operation that already carries one → RED, same reason;
 *   · a field or mount that goes away                 → RED, so the registry
 *     cannot rot into listing things that no longer exist.
 *
 * ⚠️ WHAT IT CANNOT KNOW, NAMED RATHER THAN IMPLIED. It cannot know that the
 *    witness ACTUALLY persists a non-empty row through every listed location —
 *    it checks the witness exists, names the operation, and asserts at least
 *    one segment object (`kind: 'key'`). A witness that names the operation
 *    and asserts an empty array would pass here. That is a person's to read;
 *    this makes sure there is something to read. The mounted set is
 *    `tools/served-set.mjs`'s derivation, imported rather than restated (§5.3).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

import { declaredOperations, mountedOperations } from '../../tools/served-set.mjs'
import { stripComments } from '../../tools/check-clock-fixtures.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Every served location of a `FieldPath`, keyed by operation, and the served
 * test that witnesses its WIRE SHAPE with a persisted row. Locations are named
 * `Schema.property` from the nearest named component, `[]` for an array item.
 */
const WITNESSED = {
  getRunAccount: {
    witness: 'tests/http/run-path-wire-served.test.ts',
    locations: ['AmbiguityFinding.on', 'RefusedItem.path'],
  },
  listRunResidue: {
    witness: 'tests/http/run-path-wire-served.test.ts',
    locations: ['HeldRead.path'],
  },
  listRunAllocations: {
    witness: 'tests/http/run-allocations-served.test.ts',
    locations: ['PairingEvidence.on'],
  },
  /*
   * ⚠️ THE THREE EXCEPTION OPERATIONS SHARE ONE WITNESS AND ONE READER, AND
   *    THAT IS WHY ONE SUITE IS ENOUGH: `getException`, `assignException` and
   *    `reverseResolution` each answer through `readException()` in
   *    `server/data-plane/exception-store.ts`, whose `pathIn()` returns the
   *    segment objects (it was born right — its header records the first draft
   *    that was not). `exception-served.test.ts` §2 persists an observed value
   *    and asserts `[{kind:'key',key:'invoice'}, …]` through `getException`.
   */
  getException: {
    witness: 'tests/http/exception-served.test.ts',
    locations: ['ObservedValue.path'],
  },
  assignException: {
    witness: 'tests/http/exception-served.test.ts',
    locations: ['ObservedValue.path'],
  },
  reverseResolution: {
    witness: 'tests/http/exception-served.test.ts',
    locations: ['ObservedValue.path'],
  },
}

/**
 * Served locations a FieldPath is DECLARED at and that NOTHING PRODUCES — so
 * there is no wire shape to witness, and the census instead pins the absence of
 * a producer. The day a producer lands, §3 goes red and the location must move
 * into `WITNESSED` with a served test, rather than shipping as G2375 did.
 */
const NOT_PRODUCED = {
  getMessage: {
    store: 'server/data-plane/correspondence-store.ts',
    locations: ['DisclosureRecord.fieldsDisclosed[]', 'Message.redactedPaths[]'],
    /* G472: a `DisclosureRecord` gets NO COLUMNS, and `redactedPaths` has none
       either — both are OMITTED from the response, not nulled. */
    producers: ['redactedPaths', 'fieldsDisclosed', 'disclosure'],
  },
  getThread: {
    store: 'server/data-plane/correspondence-store.ts',
    locations: ['DisclosureRecord.fieldsDisclosed[]', 'Message.redactedPaths[]'],
    producers: ['redactedPaths', 'fieldsDisclosed', 'disclosure'],
  },
}

const PATH_SCHEMAS = new Set(['FieldPath', 'FieldSegment'])

function refName(ref) {
  return ref.slice(ref.lastIndexOf('/') + 1)
}

/** Walk one schema; push `loc` (or `loc→FieldSegment`) for every path it can carry. */
function walk(doc, schema, loc, stack, out) {
  if (schema === null || typeof schema !== 'object') return
  if (typeof schema.$ref === 'string') {
    assert.ok(schema.$ref.startsWith('#/'), `an external $ref the census cannot follow: ${schema.$ref}`)
    const name = refName(schema.$ref)
    if (PATH_SCHEMAS.has(name)) {
      out.add(name === 'FieldPath' ? loc : `${loc}→FieldSegment`)
      return
    }
    if (stack.has(name)) return
    const target = doc.components?.schemas?.[name]
    assert.ok(target !== undefined, `an unresolvable $ref: ${schema.$ref}`)
    walk(doc, target, name, new Set([...stack, name]), out)
    return
  }
  for (const key of ['oneOf', 'anyOf', 'allOf']) {
    if (Array.isArray(schema[key])) for (const s of schema[key]) walk(doc, s, loc, stack, out)
  }
  if (schema.properties) {
    for (const [k, s] of Object.entries(schema.properties)) walk(doc, s, `${loc}.${k}`, stack, out)
  }
  if (schema.items) walk(doc, schema.items, `${loc}[]`, stack, out)
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    walk(doc, schema.additionalProperties, `${loc}{}`, stack, out)
  }
}

function resolveResponse(doc, response) {
  if (response && typeof response.$ref === 'string') return doc.components.responses[refName(response.$ref)]
  return response
}

/** operationId → sorted path locations, for every MOUNTED operation that carries one. */
function derive() {
  const declared = declaredOperations()
  const mounted = mountedOperations(undefined, declared)
  const docs = new Map()
  const found = {}
  let walked = 0
  for (const id of [...mounted].sort()) {
    const { file, path, method } = declared.get(id)
    if (!docs.has(file)) docs.set(file, YAML.parse(readFileSync(join(ROOT, 'docs', 'contracts', file), 'utf8')))
    const doc = docs.get(file)
    const op = doc.paths[path][method]
    const out = new Set()
    for (const [status, raw] of Object.entries(op.responses ?? {})) {
      if (!/^2/.test(status)) continue
      const response = resolveResponse(doc, raw)
      for (const media of Object.values(response?.content ?? {})) {
        walked++
        walk(doc, media.schema, `${id}<${status}>`, new Set(), out)
      }
    }
    if (out.size > 0) found[id] = [...out].sort()
  }
  return { found, mounted: mounted.size, walked }
}

test('§0 · the census has a subject — it walked mounted success schemas, and found paths in some', () => {
  const { found, mounted, walked } = derive()
  assert.ok(mounted > 0, 'no mounted operation was derived — the census would pass over nothing')
  assert.ok(walked > 0, 'no success schema was walked')
  assert.ok(Object.keys(found).length > 0, 'no served FieldPath at all — either the corpus changed or the walker is blind')
  console.log(
    `  census: ${mounted} mounted operation(s) · ${walked} success schema(s) walked · ` +
      `${Object.keys(found).length} carry a FieldPath`,
  )
})

test('§1 · every served FieldPath location is EXACTLY the registered set — a new one is red until it has a served test', () => {
  const { found } = derive()
  const expected = {}
  for (const [id, entry] of [...Object.entries(WITNESSED), ...Object.entries(NOT_PRODUCED)]) {
    expected[id] = [...entry.locations].sort()
  }
  assert.deepEqual(
    Object.keys(found).sort(),
    Object.keys(expected).sort(),
    'the set of MOUNTED operations whose success response can carry a FieldPath changed. ' +
      'A new one needs a served test that persists a row carrying the path and asserts the ' +
      "`{kind:'key'|'index', …}` wire shape (G2375), and a WITNESSED entry naming it.",
  )
  assert.deepEqual(found, expected)
})

test('§2 · each witness exists, names its operation, and asserts the SEGMENT-OBJECT form', () => {
  for (const [id, { witness }] of Object.entries(WITNESSED)) {
    const file = join(ROOT, witness)
    assert.ok(existsSync(file), `${id}'s witness ${witness} does not exist`)
    const text = readFileSync(file, 'utf8')
    assert.ok(text.includes(id), `${witness} never names ${id}`)
    assert.ok(text.includes("kind: 'key'"), `${witness} asserts no segment object — it cannot witness the wire shape`)
  }
})

test('§3 · a NOT_PRODUCED location still has no producer — the day one lands, it must earn a witness', () => {
  for (const [id, { store, producers }] of Object.entries(NOT_PRODUCED)) {
    const code = stripComments(readFileSync(join(ROOT, store), 'utf8'))
    for (const name of producers) {
      assert.ok(
        !new RegExp(`\\b${name}\\b`).test(code),
        `${store} now names \`${name}\` in CODE, so ${id} may publish a FieldPath there. ` +
          'Move the location into WITNESSED with a served test asserting the segment-object form (G2375).',
      )
    }
  }
})

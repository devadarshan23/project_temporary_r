/**
 * G217 / #201 [W-9] — WHERE THE ENGINE STOPPED LOOKING, ON THE WIRE, WITH NO
 * BUCKET KEY ON IT.
 *
 * ┌─ THE RULING THIS FILE ENCODES ─────────────────────────────────────────────┐
 * │ G217, 22 Aug 2026: THE SEARCH BOUNDARY IS REPORTED AS COUNTS PLUS          │
 * │ `ItemRef`. NO BUCKET KEY REACHES THE WIRE, IN ANY FORM — NOT VERBATIM AND  │
 * │ NOT HASHED.                                                               │
 * │                                                                            │
 * │ A bucket key is counterparty-authored text by construction: it is whatever │
 * │ the join key held in a file somebody sent us. `oversizedBuckets` and       │
 * │ `exhaustedBuckets` were `readonly (string | null)[]`, and                  │
 * │ `SetReconciliationResult` had NO containment site at all — which is how    │
 * │ they got there.                                                           │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE HASH ALTERNATIVE WAS REFUSED FOR A REASON THAT LOOKS SAFE AND IS NOT,
 * and this file asserts against it BY NAME rather than trusting the absence of a
 * `hash` field to be noticed. A digest of a LOW-CARDINALITY key — a date, a
 * short code, an invoice prefix — is reversible by anyone who can guess the
 * input space, and for a reconciliation join key that space is small and
 * structured. **A hash of a guessable value is an encoding, not a protection.**
 *
 * ⚠️ ASSERTION 3 IS WRITTEN SO THAT IT ENCODES THE RULING RATHER THAN THE
 * IMPLEMENTATION. Under G217 a bare `string` in a bucket position is a FAILURE
 * of this file, whatever the schema happens to hold. Had the ruling gone the
 * other way this file would be asking for an exposure sentence instead; it is
 * not, and that is a decision it carries rather than inherits.
 *
 * WHY IT IS `.mjs` AND PARSES YAML. Same reason as
 * `tests/contracts/engine-read-wire.test.mjs`: `server/contract/document.ts`
 * already took `yaml@2.9.0` under G109, and every structural assertion here —
 * required vs nullable, `additionalProperties`, an item type behind a `$ref` —
 * is exactly the class a line scanner gets subtly wrong. The MODEL side is read
 * as text, because what it asserts is the absence of a declaration.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

import { PAIRS } from '../../tools/check-wire-mirror.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CAPABILITY = path.join(REPO_ROOT, 'docs', 'contracts', 'capability.openapi.yaml')

const engineText = readFileSync(path.join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')
const doc = parse(readFileSync(CAPABILITY, 'utf8'))
const schemas = doc?.components?.schemas ?? {}

/** The produced arm of `RunEngineAccount` — the envelope every channel lands on. */
function producedArm() {
  const arms = schemas.RunEngineAccount?.oneOf ?? []
  const produced = arms.find((arm) => arm?.properties?.outcome?.enum?.[0] === 'produced')
  assert.ok(produced, '`RunEngineAccount` has no `produced` arm; the parse or the contract is wrong')
  return produced
}

/* ==================================================================== *
 * §1  THE MODEL — no bucket key survives on the result, in any form
 * ==================================================================== */

test('A1 — `SetReconciliationResult` declares NO bucket key, verbatim or hashed', () => {
  const block = engineText.slice(
    engineText.indexOf('export interface SetReconciliationResult {'),
  )
  const body = block.slice(0, block.indexOf('\n}'))
  assert.ok(body.length > 0, 'the `SetReconciliationResult` declaration was not found')

  /* THE EXACT DECLARATION G217 RULES AGAINST. Written out rather than matched
   * loosely, so that a rename to `bucketKeys: readonly string[]` is caught by
   * the second assertion rather than slipping past a pattern tuned to the old
   * spelling. */
  assert.equal(
    /readonly (oversized|exhausted)Buckets: readonly \(string \| null\)\[\]/.test(body),
    false,
    'a bucket KEY array is still declared on the result. G217: counts plus `ItemRef`, and ' +
      'no key in any form.',
  )

  /* No property on this interface may be typed as bare text, however spelled.
   * `state`, `readerRequests` and `meterFacts` are the three that legitimately
   * carry strings and they are named here rather than pattern-matched away —
   * see A3 for why the whole interface cannot carry the proof. */
  const suspect = body
    .split('\n')
    .filter((line) => /^\s*readonly \w+:/.test(line))
    .filter((line) => /\bstring\b/.test(line))
  assert.deepEqual(
    suspect,
    [],
    `a property on \`SetReconciliationResult\` is declared with a bare \`string\`: ${suspect.join(' / ')}`,
  )
})

test('A2 — the search boundary is COUNTS PLUS `ItemRef`, and the type says so', () => {
  assert.ok(
    /export interface SearchBoundary \{/.test(engineText),
    '`SearchBoundary` is not declared. G217 rules a representation, and a ruling with no ' +
      'declaration behind it is a sentence in a table.',
  )
  const block = engineText.slice(engineText.indexOf('export interface SearchBoundary {'))
  const body = block.slice(0, block.indexOf('\n}'))

  /* Every channel is a list of boundary entries; the COUNT is the list's length
   * and the ADDRESS is an `ItemRef`. Nothing here is a key. */
  for (const field of ['oversizedBuckets', 'exhaustedSearches', 'oversizedAmountBuckets']) {
    assert.ok(
      new RegExp(`readonly ${field}: readonly SearchBoundaryEntry\\[\\]`).test(body),
      `\`SearchBoundary.${field}\` must be a \`readonly SearchBoundaryEntry[]\`; body was:\n${body}`,
    )
  }

  const entry = engineText.slice(engineText.indexOf('export interface SearchBoundaryEntry {'))
  const entryBody = entry.slice(0, entry.indexOf('\n}'))
  assert.ok(/readonly itemCount: number/.test(entryBody), 'the entry must carry a COUNT')
  assert.ok(/readonly exampleRef: ItemRef/.test(entryBody), 'the entry must address by `ItemRef`')
  assert.equal(
    /\bstring\b/.test(entryBody),
    false,
    'a `string` reached `SearchBoundaryEntry`. That is the bucket key coming back under a new name.',
  )
})

test('A3 — the result gains a containment site, and the site that cannot exist is NAMED', () => {
  /* G217's obligation. `SetReconciliationResult` had no containment proof at
   * all, which is how two counterparty-controlled arrays got onto it. */
  assert.ok(
    /export type _SearchBoundaryHoldsNoTextDeep = AssertNoTextDeep<SearchBoundary>/.test(engineText),
    'the search boundary carries no `AssertNoTextDeep` site. G217 attaches that obligation to ' +
      'this slice explicitly.',
  )

  /* ⚠️ AND THE HONEST HALF, ASSERTED RATHER THAN LEFT AS A GAP. The WHOLE
   * result cannot carry the proof and never could: `state.items` is a
   * `ReadonlyMap`, `ReaderRequest.untrustedDescription` is a bare `string` by
   * design (it is the quarantined side), and `MeterFact.idempotencyKey` is a
   * `string`. A slice claiming `AssertNoTextDeep<SetReconciliationResult>` would
   * be claiming something the type system will not give it. The module must say
   * so at the declaration rather than leaving the absence to read as an
   * oversight — the same discipline `HeldRead` already carries. */
  const block = engineText.slice(
    engineText.lastIndexOf('/**', engineText.indexOf('export interface SetReconciliationResult {')),
    engineText.indexOf('export interface SetReconciliationResult {'),
  )
  for (const named of ['state', 'readerRequests', 'meterFacts']) {
    assert.ok(
      block.includes(named),
      `the note above \`SetReconciliationResult\` must name \`${named}\` as one of the three ` +
        'channels that keep the whole interface off the proof. An unexplained absence reads as ' +
        'forgetfulness, and this one is a finding.',
    )
  }
})

/* ==================================================================== *
 * §2  THE WIRE — the boundary reaches the account, carrying no key
 * ==================================================================== */

test('B1 — `SearchBoundary` and `SearchBoundaryEntry` are on the wire, addressed by `ItemRef`', () => {
  const entry = schemas.SearchBoundaryEntry
  assert.ok(entry, '`SearchBoundaryEntry` is not a schema on the capability tier')
  assert.equal(entry.additionalProperties, false)
  assert.deepEqual([...entry.required].sort(), ['exampleRef', 'itemCount'])
  assert.equal(entry.properties.itemCount.type, 'integer')
  assert.equal(entry.properties.exampleRef.$ref, '#/components/schemas/ItemRef')

  const boundary = schemas.SearchBoundary
  assert.ok(boundary, '`SearchBoundary` is not a schema on the capability tier')
  assert.equal(boundary.additionalProperties, false)
  assert.deepEqual(
    [...boundary.required].sort(),
    ['exhaustedSearches', 'oversizedAmountBuckets', 'oversizedBuckets'],
    'all three channels are REQUIRED. An optional channel lets a server omit the evidence ' +
      'under exactly the condition it exists to survive — `admissionRates`\' argument, one ' +
      'grain down.',
  )
  for (const field of ['oversizedBuckets', 'exhaustedSearches', 'oversizedAmountBuckets']) {
    assert.equal(boundary.properties[field].type, 'array')
    assert.equal(boundary.properties[field].items.$ref, '#/components/schemas/SearchBoundaryEntry')
  }
})

test('B2 — NO BUCKET KEY, VERBATIM OR HASHED, ANYWHERE IN THE BOUNDARY SCHEMAS', () => {
  /* 🛑 ASSERTION 3 OF THE ISSUE, AND IT IS THE ONE THAT ENCODES THE RULING. A
   * bare `string` in a bucket position is a failure of this test under G217 —
   * whichever way the implementation found convenient.
   *
   * ⚠️ DESCRIPTIONS ARE STRIPPED BEFORE THE SCAN, AND THAT IS A REAL DECISION
   * RATHER THAN A CONVENIENCE. The first form of this test scanned the rendered
   * JSON whole and went red on the word `hash` — inside the paragraph explaining
   * why a hash was REFUSED. A control that fails while the property holds
   * teaches people to ignore controls, which is §5.6 read from the other side,
   * and it is the same trap `model/reconciliation.ts`'s own header records
   * itself falling into six times out of nine. The subject is the SHAPE. */
  const stripDescriptions = (node) => {
    if (Array.isArray(node)) return node.map(stripDescriptions)
    if (node === null || typeof node !== 'object') return node
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => key !== 'description')
        .map(([key, value]) => [key, stripDescriptions(value)]),
    )
  }
  const rendered = JSON.stringify(
    stripDescriptions([schemas.SearchBoundary, schemas.SearchBoundaryEntry]),
  )

  assert.equal(
    /"type":"string"/.test(rendered),
    false,
    'a `string` property reached the search-boundary schemas. Under G217 that is the bucket ' +
      'key returning, and it fails whether it is spelled `key`, `bucket`, `counterparty` or ' +
      'anything else.',
  )
  for (const forbidden of ['hash', 'digest', 'fingerprint', 'bucketKey', 'counterparty', 'key']) {
    assert.equal(
      new RegExp(forbidden, 'i').test(rendered),
      false,
      `\`${forbidden}\` appears in the boundary schemas' SHAPE. G217 refused the hash BY NAME: ` +
        'a digest of a low-cardinality key is reversible by anyone who can guess the input ' +
        'space, and a hash of a guessable value is an encoding, not a protection.',
    )
  }
})

test('B3 — the account carries an AMBIGUITY read, and it addresses by `ItemRef`, never by key', () => {
  const finding = schemas.AmbiguityFinding
  assert.ok(finding, '`AmbiguityFinding` is not a schema on the capability tier')
  assert.equal(finding.additionalProperties, false)
  assert.deepEqual(
    [...finding.required].sort(),
    ['leftCandidates', 'leftRefs', 'on', 'rightCandidates', 'rightRefs', 'strategyKind'],
  )

  /* ASSERTION 2 OF THE ISSUE: an ADDRESS is actionable and a KEY is not. */
  for (const side of ['leftRefs', 'rightRefs']) {
    assert.equal(finding.properties[side].type, 'array')
    assert.equal(
      finding.properties[side].items.$ref,
      '#/components/schemas/ItemRef',
      `\`${side}\` must be an \`ItemRef\` array. A key names a bucket; a ref names a row an ` +
        'operator can open.',
    )
  }
  for (const count of ['leftCandidates', 'rightCandidates']) {
    assert.equal(finding.properties[count].type, 'integer')
  }
  assert.equal(finding.properties.strategyKind.$ref, '#/components/schemas/PairingStrategyKind')

  /* `on` is a `FieldPath` and that is the ONE string-bearing thing here that is
   * defensible: a declared path is OPERATOR-authored addressing, not
   * counterparty content — `RefusedItem.path` makes the same argument, and
   * `HeldRead` carries the banner explaining why the containment proof stops at
   * exactly this line. It is required-and-nullable, never optional. */
  assert.deepEqual(finding.properties.on.oneOf ?? [finding.properties.on], [
    { $ref: '#/components/schemas/FieldPath' },
    { type: 'null' },
  ])
})

test('B4 — both channels reach the PRODUCED arm, unconditionally', () => {
  const produced = producedArm()
  for (const channel of ['ambiguities', 'searchBoundary']) {
    assert.ok(
      produced.required.includes(channel),
      `\`${channel}\` is not REQUIRED on the produced arm. G114's rule — a bound that was hit ` +
        'is recorded, never silently absorbed — is the whole reason this slice exists.',
    )
  }
  assert.equal(produced.properties.ambiguities.type, 'array')
  assert.equal(
    produced.properties.ambiguities.items.$ref,
    '#/components/schemas/AmbiguityFinding',
  )
  assert.equal(produced.properties.searchBoundary.$ref, '#/components/schemas/SearchBoundary')

  /* THE REFUSED ARM CARRIES NEITHER, and that mirrors the model rather than
   * tidying it: a refused run produced nothing, so declaring the channels on it
   * "just in case" would make an invalid state legal (§5.5). */
  const refused = (schemas.RunEngineAccount.oneOf ?? []).find(
    (arm) => arm?.properties?.outcome?.enum?.[0] === 'refused',
  )
  assert.ok(refused)
  for (const channel of ['ambiguities', 'searchBoundary']) {
    assert.equal(refused.properties[channel], undefined)
  }
})

test('B5 — `PairingStrategyKind` is a REGISTERED pair, not a hand-maintained enum', () => {
  const kind = schemas.PairingStrategyKind
  assert.ok(kind, '`PairingStrategyKind` is not a schema on the capability tier')
  assert.deepEqual(kind.enum, [
    'exact_identifier',
    'amount_and_date',
    'amount_sum',
    'fuzzy_reference',
  ])

  const pair = PAIRS.find((p) => p.wire.schema === 'PairingStrategyKind')
  assert.ok(
    pair,
    'the enum reaches the wire with no pair behind it. This repository\'s sequencing rule is ' +
      'that a vocabulary registered after the enum it governs has shipped is registered after ' +
      'the drift it exists to catch.',
  )
  /* `PairingStrategy` is declared in `model/domain.ts`, not in the engine —
   * `AmbiguityFinding.strategyKind` is `PairingStrategy['kind']`, a projection.
   * The pair therefore reads the DECLARATION rather than the projection, which
   * is what keeps it from comparing a restatement against itself. */
  assert.equal(pair.model.file, 'model/domain.ts')
  assert.equal(pair.model.source, 'union')
  assert.equal(pair.model.name, 'PairingStrategy')
})

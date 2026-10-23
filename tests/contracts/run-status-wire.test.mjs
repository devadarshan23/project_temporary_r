/**
 * O-16'S WIRE HALF — the run-status vocabulary, in ALL THREE places it lives.
 *
 * 🛑 THIS FILE EXISTS BECAUSE `tools/check-wire-mirror.mjs` STRUCTURALLY CANNOT
 * REACH ONE OF THEM, AND THE CHECKER SAYS SO ABOUT ITSELF IN EVERY RUN. The
 * `run_status` pair was registered at `7ed3966d`, before O-16, so that the
 * vocabulary would be pinned while the model and the wire still agreed — the
 * only time a pair is cheap to add. That pair covers the `Run` SCHEMA. **The
 * same strings are restated inline at the `/runs` `status` QUERY PARAMETER,
 * outside `components.schemas`, where a pair addressed at a schema name has
 * nothing to bind to.** `docs/HANDOFF.md` records it as O-16's blocker:
 * *"whoever ships O-16 must edit that copy BY HAND and nothing will catch a
 * miss."*
 *
 * **This test is the something.** Silence from a checker is not evidence of
 * absence, and this one is explicit about its own blind spot rather than
 * leaving it implicit — so the blind spot gets a test instead of a promise.
 *
 * THE EXPECTATION IS DERIVED FROM THE MODEL, NEVER FROM THE YAML UNDER TEST.
 * `RunStatus` is read out of `model/domain.ts` at runtime with the checker's own
 * `literal_union` extractor — the same code path `npm run check:wire` uses, so
 * the two cannot disagree about what the model says. A test that read the enum
 * out of the file it is checking would pass against any value that file happened
 * to hold, which is how the G75 drift survived a wire mirror, a citation checker
 * and a count checker (`tests/contracts/g75-wire.test.ts`).
 *
 * ⚠️ AND DERIVATION ALONE WOULD NOT BE ENOUGH HERE, WHICH IS WHY `incomplete` IS
 * ALSO ASSERTED BY NAME. Model and wire agree today at four members, so an
 * equality test alone is GREEN today and would go red only after somebody moved
 * the model — i.e. it would report the drift it was meant to prevent. The
 * by-name assertions are what make this file red BEFORE O-16 lands, on all three
 * copies, which is the state a red-first commit is supposed to record.
 *
 * ⚠️ NOT A YAML PARSER, and deliberately not one — G109's real parser is ruled
 * and unbought, and adding a dependency is not this file's decision. It is a
 * line scanner over two anchors, and it resolves ONE level of
 * `$ref: '#/components/schemas/…'` so that it keeps working if O-16 mints a
 * named `RunStatus` schema and points both occurrences at it, as
 * `docs/build/wave-two-plan.md` §9.3 proposes. It asserts it FOUND each anchor
 * before comparing anything: a scanner that silently found none would pass every
 * assertion vacuously, which is §5.6.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { unionLiterals } from '../../tools/check-wire-mirror.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL = path.join(REPO_ROOT, 'model', 'domain.ts')
const CONTRACT = path.join(REPO_ROOT, 'docs', 'contracts', 'capability.openapi.yaml')

const modelText = readFileSync(MODEL, 'utf8')
const yaml = readFileSync(CONTRACT, 'utf8')
const lines = yaml.split('\n')

/** The model is the authority. Read with the checker's own extractor. */
const expected = unionLiterals(modelText, 'RunStatus')

const indentOf = (line) => line.length - line.trimStart().length

/** `enum: [a, b, c]` anywhere on a line, flow form — the only form this file uses. */
function enumOn(line) {
  const m = /enum:\s*\[([^\]]*)\]/.exec(line)
  if (m === null) return null
  return (m[1] ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '')
}

/** `$ref: '#/components/schemas/Name'` anywhere on a line. */
function schemaRefOn(line) {
  const m = /\$ref:\s*'#\/components\/schemas\/([A-Za-z0-9_]+)'/.exec(line)
  return m === null ? null : m[1]
}

/**
 * The first `enum:` inside the block a named schema owns.
 *
 * Only one level of resolution, on purpose: a `$ref` chain is G109's job and
 * hand-rolling one is how a checker starts passing while asserting nothing.
 */
function enumOfSchema(name) {
  const start = lines.findIndex((l) => l === `    ${name}:`)
  assert.notEqual(start, -1, `capability.openapi.yaml declares no \`${name}\` schema to $ref`)
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '') continue
    if (indentOf(line) <= 4) break
    const members = enumOn(line)
    if (members !== null) return members
  }
  assert.fail(`the \`${name}\` schema carries no \`enum: [...]\``)
}

/**
 * The enum a site EFFECTIVELY declares — inline, or through one `$ref`.
 *
 * Scans forward from the anchor and stops at the first line indented at or
 * outside the anchor, so a runaway scan cannot capture an unrelated enum
 * further down the file.
 */
function effectiveEnum(anchorIndex, label) {
  const anchor = lines[anchorIndex] ?? ''
  const anchorIndent = indentOf(anchor)

  const here = enumOn(anchor)
  if (here !== null) return here
  const refHere = schemaRefOn(anchor)
  if (refHere !== null) return enumOfSchema(refHere)

  for (let i = anchorIndex + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '') continue
    if (indentOf(line) <= anchorIndent) break
    const members = enumOn(line)
    if (members !== null) return members
    const ref = schemaRefOn(line)
    if (ref !== null) return enumOfSchema(ref)
  }
  assert.fail(`${label} declares neither an inline \`enum: [...]\` nor a schema \`$ref\``)
}

/** The `/runs` collection's own block — up to the next path key. */
function runsPathBlock() {
  const start = lines.findIndex((l) => l === '  /runs:')
  assert.notEqual(start, -1, 'capability.openapi.yaml declares no `/runs` path')
  let end = start + 1
  while (end < lines.length && !/^ {2}\//.test(lines[end] ?? '')) end++
  return { start, end }
}

/**
 * 🛑 THE COPY NO PAIR CAN REACH. A query parameter is not a schema, so
 * `tools/check-wire-mirror.mjs` — which addresses a wire vocabulary BY SCHEMA
 * NAME — has nothing to bind to here.
 */
function queryParameterAnchor() {
  const { start, end } = runsPathBlock()
  const found = []
  for (let i = start + 1; i < end; i++) {
    if (/^\s*- name: status\s*$/.test(lines[i] ?? '')) found.push(i)
  }
  assert.equal(
    found.length,
    1,
    `expected exactly one \`- name: status\` parameter in the /runs block; found ${found.length}. ` +
      'The scanner is comparing nothing until this holds.',
  )
  return found[0]
}

/** The `Run` schema's `status` property — the copy the pinned pair DOES cover. */
function runSchemaStatusAnchor() {
  const start = lines.findIndex((l) => l === '    Run:')
  assert.notEqual(start, -1, 'capability.openapi.yaml declares no `Run` schema')
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '') continue
    if (indentOf(line) <= 4) break
    if (/^\s*status:/.test(line)) return i
  }
  assert.fail('the `Run` schema declares no `status` property')
}

test('the model side is read, and it is a bare union of literals', () => {
  assert.ok(
    Array.isArray(expected) && expected.length > 0,
    '`RunStatus` yielded no members — every comparison below would be vacuous',
  )
  for (const member of ['queued', 'running', 'completed', 'failed']) {
    assert.ok(
      expected.includes(member),
      `\`RunStatus\` no longer declares \`${member}\`. O-16 ADDS a state; it removes none. ` +
        'If a lifecycle state was deliberately dropped, this line is the one to argue with.',
    )
  }
})

test('the MODEL declares `incomplete` — O-16, and the source of every expectation here', () => {
  assert.ok(
    expected.includes('incomplete'),
    '`RunStatus` (model/domain.ts) has four members and none of them is `incomplete`. ' +
      'A run can report that what it was given balances and never that it was given ' +
      'everything — G153 / owner ruling §3.18.',
  )
})

test('the `Run` schema status enum matches RunStatus element-for-element', () => {
  const members = effectiveEnum(runSchemaStatusAnchor(), 'the `Run` schema status property')
  assert.deepEqual(
    members,
    expected,
    'components.schemas.Run.properties.status disagrees with `RunStatus` in model/domain.ts. ' +
      'This one is also pinned by tools/check-wire-mirror.mjs `run_status`.',
  )
})

test('the /runs `status` QUERY PARAMETER matches RunStatus element-for-element', () => {
  const members = effectiveEnum(queryParameterAnchor(), 'the /runs `status` query parameter')
  assert.deepEqual(
    members,
    expected,
    'The /runs `status` query parameter disagrees with `RunStatus` in model/domain.ts. ' +
      'NOTHING ELSE IN THIS REPOSITORY CHECKS THIS COPY — it lives outside ' +
      'components.schemas and tools/check-wire-mirror.mjs cannot address it.',
  )
})

/**
 * 🛑 BY NAME, NOT BY LENGTH, AND IN TWO TESTS RATHER THAN ONE. A wire enum that
 * gained a WRONG fifth member would satisfy an equality-of-length check, and
 * would satisfy the pinned pair for exactly as long as the model happened to
 * hold the same count.
 *
 * ⚠️ TWO TESTS BECAUSE ONE WOULD HIDE THE MESSAGE THAT MATTERS. Asserted
 * together, the schema copy fails first and short-circuits — and the query
 * parameter, the copy nothing else in this repository can reach, would never be
 * reported at all. The first draft of this file did exactly that.
 */
test('the /runs query parameter names `incomplete` — the hand edit no checker can police', () => {
  /**
   * The consequence of a miss is concrete and asymmetric: a plane validating
   * strictly REFUSES a client asking for the runs the engine could not complete
   * — which is the population an operator most needs to list.
   */
  const members = effectiveEnum(queryParameterAnchor(), 'the /runs `status` query parameter')
  assert.ok(
    members.includes('incomplete'),
    'the /runs `status` query parameter omits `incomplete`. This is the copy the record ' +
      'warned about in advance: outside components.schemas, unreachable by any pair, ' +
      'and edited by hand or not at all.',
  )
})

test('the `Run` schema names `incomplete`', () => {
  const members = effectiveEnum(runSchemaStatusAnchor(), 'the `Run` schema status property')
  assert.ok(
    members.includes('incomplete'),
    'components.schemas.Run.properties.status omits `incomplete`',
  )
})

test('the two wire copies agree with each other', () => {
  /**
   * Independent of the model comparisons above, and it stays meaningful if
   * O-16 points both occurrences at one minted `RunStatus` schema: it then
   * asserts the two really do resolve to the same place rather than to two
   * schemas that happen to agree today.
   */
  assert.deepEqual(
    effectiveEnum(queryParameterAnchor(), 'the /runs `status` query parameter'),
    effectiveEnum(runSchemaStatusAnchor(), 'the `Run` schema status property'),
    'a client may filter on a status the resource can never report, or vice versa',
  )
})

/**
 * G4033, RULED 4 Oct 2026 — an engine-refused run carries a SIXTH status,
 * `refused`. Asserted BY NAME on all three copies for the reason `incomplete`
 * is: an equality test alone is green until somebody moves the model, so it
 * would report the drift rather than prevent it.
 */
test('G4033 — the MODEL declares `refused`', () => {
  assert.ok(
    expected.includes('refused'),
    '`RunStatus` (model/domain.ts) does not declare `refused`. An engine refusal ' +
      'produced no ledger, so it is neither `failed` (unsound over a ledger) nor ' +
      '`queued` (nothing ran) — G4033.',
  )
})

test('G4033 — the `Run` schema AND the /runs query parameter name `refused`', () => {
  for (const [anchor, what] of [
    [runSchemaStatusAnchor(), 'the `Run` schema status property'],
    [queryParameterAnchor(), 'the /runs `status` query parameter'],
  ]) {
    assert.ok(effectiveEnum(anchor, what).includes('refused'), `${what} omits \`refused\``)
  }
})

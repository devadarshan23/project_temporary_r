/**
 * G90 — `SolutionPack` reserves a nullable `palette`.
 *
 * WHAT THIS FILE IS DEFENDING. G13 argues that a pack body is eventually
 * SIGNED, and that a key added after a signature exists is a migration rather
 * than an edit. Reserving the key now, while all four fixture packs still
 * carry `signature: null`, is free. G90 is the decision; docs/HANDOFF.md is
 * the row, and no sentence of it is restated here.
 *
 * ⚠️ WHY THREE TESTS AND NOT ONE. Each of the three guards a DIFFERENT way
 * this reservation can be silently undone, and none of them subsumes another:
 *
 *   1. `palette?:` instead of `palette:` — the field exists, every fixture
 *      typechecks unchanged, and the reservation asserts nothing. The guard is
 *      a `@ts-expect-error` on a literal that omits the key. That directive is
 *      enforced by `npm run typecheck:tests`, which `npm test` runs BEFORE
 *      `node --test`: when the field is optional (or absent) the directive
 *      becomes unused and TypeScript reports TS2578 and the whole run fails.
 *      The runner-visible half below asserts the directive is still in this
 *      file, so deleting the guard cannot pass quietly either.
 *
 *   2. the key present on a test object but never DECLARED on the interface —
 *      `Object.keys(body).length` would pass for any pack with the right
 *      number of unrelated fields, and a stray property on a local literal
 *      would pass a bare `hasOwn`. Test 2 therefore asserts the key by NAME in
 *      both places: declared in the interface, and present-and-null in the
 *      serialised body.
 *
 *   3. the drop note drifting off the field. `readFileSync(domain.ts)
 *      .includes('@dropped-for-v1')` passes trivially — there are hundreds of
 *      those markers in model/. Test 3 anchors the note to the FIELD by
 *      slicing the interface block, locating the `palette:` line, and walking
 *      up to the comment that closes directly above it.
 *
 * Every expected string below is a literal typed into this file. Re-reading a
 * value out of the module and comparing it to itself passes forever and
 * witnesses nothing.
 *
 * ⚠️ THIS FILE DOES NOT IMPORT model/examples.ts AT RUNTIME. The four fixture
 * packs are the only construction sites of `SolutionPack` in the tree, and
 * what forces each of them to carry the key is the compiler (TS2741), not this
 * runner. See the note in the summary about a fixture sweep.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SolutionPack, SolutionPackId } from '../../model/domain.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOMAIN_TS = join(REPO_ROOT, 'model', 'domain.ts')
const THIS_FILE = fileURLToPath(import.meta.url)

/** The field name under test. A literal, never derived from the module. */
const FIELD = 'palette'

/** The marker string G90 requires above the field. A literal, on purpose. */
const DROP_MARKER = '@dropped-for-v1'

/**
 * The `SolutionPack` interface block, sliced out of model/domain.ts by the same
 * shape as the awk the record publishes: from the `export interface` line to
 * the first line that is exactly `}`.
 */
function solutionPackBlock(): string[] {
  const lines = readFileSync(DOMAIN_TS, 'utf8').split('\n')
  const open = lines.indexOf('export interface SolutionPack {')
  assert.notEqual(
    open,
    -1,
    'model/domain.ts no longer declares `export interface SolutionPack {` — this test is anchored to that exact line',
  )
  const rest = lines.slice(open)
  const close = rest.indexOf('}')
  assert.notEqual(close, -1, '`export interface SolutionPack {` is never closed by a bare `}`')
  return rest.slice(0, close + 1)
}

/**
 * Top-level field names declared on `SolutionPack`, read off the block. Nested
 * object literals are not a concern: every field in this interface is declared
 * at one indent level, `  name: Type`.
 */
function declaredFields(block: string[]): string[] {
  const names: string[] = []
  for (const line of block) {
    const m = /^ {2}(?:readonly )?([A-Za-z_$][\w$]*)\??:/.exec(line)
    if (m !== null && m[1] !== undefined) names.push(m[1])
  }
  return names
}

/* ------------------------------------------------------------------ *
 * Test 1 — the field is REQUIRED, not optional.
 * ------------------------------------------------------------------ */

/**
 * The compile-time half of test 1. If `palette` becomes optional, or is
 * removed, this literal stops erroring, the directive below becomes unused, and
 * `npm run typecheck:tests` fails with TS2578 — which is what makes the
 * reservation load-bearing rather than decorative.
 *
 * The literal deliberately supplies every OTHER field, so the only possible
 * error is the missing `palette`.
 */
// @ts-expect-error `palette` is required on SolutionPack (G90); omitting it must not compile.
const packWithoutPalette: SolutionPack = {
  id: 'pack_test_g90' as SolutionPackId,
  key: 'test_g90',
  label: 'G90 control pack',
  domain: 'finance',
  version: 1,
  authoredBy: null,
  availability: 'available',
  lifecycle: 'active',
  posture: {
    maxLatencyP95Ms: null,
    costCeilingPerRun: null,
    targetOutcomeScore: null,
    complianceScope: [],
  },
  rollout: null,
  gateIds: [],
  bindings: [],
  signature: null,
  supersededBy: null,
  documentTypeTemplates: [],
  classificationRules: [],
  definitionTemplates: [],
  procedureTemplates: [],
  dispositions: [],
}

test('test_a_solution_pack_literal_that_omits_palette_is_a_compile_error', () => {
  // The literal above is real and must stay real: `noUnusedLocals` would fail
  // the typecheck if nothing referenced it, and a guard the compiler deletes is
  // not a guard.
  assert.equal(packWithoutPalette.key, 'test_g90')

  // The runner-visible half. `@ts-expect-error` is invisible to `node --test`;
  // this asserts the directive is still sitting on the line directly above the
  // literal, so it cannot be quietly deleted without turning this test red too.
  const lines = readFileSync(THIS_FILE, 'utf8').split('\n')
  const literalAt = lines.findIndex((l) => l.startsWith('const packWithoutPalette: SolutionPack = {'))
  assert.notEqual(literalAt, -1, 'the omitting literal has been renamed or removed from this file')

  const directive = lines[literalAt - 1]
  assert.ok(directive !== undefined, 'no line above the omitting literal')
  assert.ok(
    directive.includes('@ts-expect-error'),
    `the line above the omitting literal must carry @ts-expect-error, found: ${JSON.stringify(directive)}`,
  )

  // And the field must be declared WITHOUT a `?`. `palette?: null` would let
  // every fixture typecheck unchanged, which is the exact failure this issue
  // exists to prevent.
  const block = solutionPackBlock()
  const required = block.some((l) => l.trimStart().startsWith(`${FIELD}:`))
  const optional = block.some((l) => l.trimStart().startsWith(`${FIELD}?:`))
  assert.equal(optional, false, `SolutionPack.${FIELD} is optional; G90 reserves a REQUIRED nullable field`)
  assert.equal(required, true, `SolutionPack declares no required \`${FIELD}:\` field`)
})

/* ------------------------------------------------------------------ *
 * Test 2 — the key survives serialisation of a pack body.
 * ------------------------------------------------------------------ */

test('test_a_pack_body_serialises_the_palette_key_rather_than_dropping_it', () => {
  // Declared on the interface, by name. This is what makes the assertion below
  // evidence about the MODEL rather than about a stray property on a local
  // object: without this, `{ palette: null }` on any object would pass.
  const fields = declaredFields(solutionPackBlock())
  assert.ok(
    fields.includes(FIELD),
    `SolutionPack declares no \`${FIELD}\` field; declared fields are ${JSON.stringify(fields)}`,
  )

  const pack: SolutionPack = {
    id: 'pack_test_g90_body' as SolutionPackId,
    key: 'test_g90_body',
    label: 'G90 body pack',
    domain: 'finance',
    version: 1,
    authoredBy: null,
    availability: 'available',
    lifecycle: 'active',
    posture: {
      maxLatencyP95Ms: null,
      costCeilingPerRun: null,
      targetOutcomeScore: null,
      complianceScope: [],
    },
    rollout: null,
    gateIds: [],
    bindings: [],
    signature: null,
    supersededBy: null,
    documentTypeTemplates: [],
    classificationRules: [],
    definitionTemplates: [],
    procedureTemplates: [],
    dispositions: [],
    palette: null,
  }

  // The G13 property: the canonical body carries the KEY. `pack.palette ===
  // null` alone cannot tell "present and null" apart from "deleted", and JSON
  // is what a signature is taken over.
  const body: unknown = JSON.parse(JSON.stringify(pack))
  assert.equal(typeof body, 'object')
  assert.notEqual(body, null)
  assert.ok(
    Object.hasOwn(body as object, FIELD),
    `a serialised pack body dropped the \`${FIELD}\` key: ${JSON.stringify(body)}`,
  )
  assert.equal((body as Record<string, unknown>)[FIELD], null)

  // Belt and braces on the wire text itself — this is the byte sequence G90
  // promises stays identical when the type widens in v2.
  assert.ok(
    JSON.stringify(pack).includes(`"${FIELD}":null`),
    `a serialised pack body does not contain "${FIELD}":null`,
  )
})

/* ------------------------------------------------------------------ *
 * Test 3 — the drop note is on the FIELD, not merely in the module.
 * ------------------------------------------------------------------ */

test('test_the_dropped_for_v1_note_sits_directly_above_the_palette_field_and_not_merely_somewhere_in_the_module', () => {
  const block = solutionPackBlock()

  const fieldAt = block.findIndex((l) => l.trimStart().startsWith(`${FIELD}:`))
  assert.notEqual(
    fieldAt,
    -1,
    `no line in the SolutionPack block starts with \`${FIELD}:\``,
  )

  // Walk upward from the field to the comment that closes directly above it.
  // Anything other than a `*/` immediately above means the field carries no
  // doc comment of its own.
  let cursor = fieldAt - 1
  while (cursor >= 0 && block[cursor]?.trim() === '') cursor -= 1
  assert.ok(cursor >= 0, `nothing precedes \`${FIELD}:\` inside the SolutionPack block`)
  assert.equal(
    block[cursor]?.trim(),
    '*/',
    `the line above \`${FIELD}:\` is not the end of a block comment; the drop note must sit on the field`,
  )

  const commentEnd = cursor
  while (cursor >= 0 && block[cursor]?.trim() !== '/**') cursor -= 1
  assert.ok(cursor >= 0, `the comment above \`${FIELD}:\` never opens with /**`)

  const comment = block.slice(cursor, commentEnd + 1).join('\n')
  assert.ok(
    comment.includes(DROP_MARKER),
    `the comment attached to \`${FIELD}:\` does not carry ${DROP_MARKER}:\n${comment}`,
  )

  // ⚠️ The whole point of this test. The marker is everywhere in model/; being
  // "in the module" proves nothing. Assert the marker we just found belongs to
  // THIS comment and not to a neighbouring field's.
  const otherFieldBetween = block
    .slice(cursor, fieldAt)
    .some((l) => /^ {2}[A-Za-z_$][\w$]*\??:/.test(l))
  assert.equal(
    otherFieldBetween,
    false,
    `another field declaration sits between the ${DROP_MARKER} comment and \`${FIELD}:\``,
  )
})

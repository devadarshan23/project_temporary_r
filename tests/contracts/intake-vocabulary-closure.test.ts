/**
 * I-1 / #176 — G184: ONE INTAKE VOCABULARY.
 *
 * The tree held two and neither was the ruled one:
 * `SourceDocument.origin: 'upload' | 'connector' | 'api'` in `model/domain.ts`,
 * and the four-member channel enum inline in `capability.openapi.yaml` under a
 * description that RECORDED the divergence in its own text and declined to fix
 * it. G184 rules the operator's four channels are the one vocabulary, that
 * `origin` is DELETED rather than deprecated, and that a third vocabulary is
 * forbidden.
 *
 * 🛑 `api` IS DROPPED, NEVER FOLDED. `upload` is a presigned PUT (`UploadTicket`
 * in the same contract) — a different act with a different admission story.
 * Test 2 asserts the absence of `api` AND of `connector` BY NAME, because a
 * length check of four is satisfied by the wrong four.
 *
 * ⚠️ IT IMPORTS NOTHING FROM `model/`, DELIBERATELY. This file must compile at
 * the commit it lands red at, and at that commit `model/ingestion.ts` does not
 * exist — `import { INTAKE_CHANNEL_KINDS }` would be a `TS2307` compile failure
 * rather than a test failure, and a suite that does not compile is not a red
 * witness. So it reads the declarations out of the source text.
 *
 * ⚠️ NOT A YAML PARSER, DELIBERATELY. `yaml@2.9.0` is in the manifest and
 * `server/contract/document.ts` uses it, but the line scanners in `tests/` and
 * `tools/` are unchanged and changing them is not this slice's decision
 * (G109 as amended). This is a line scanner over the same narrow subset
 * `tools/check-wire-mirror.mjs` resolves, and EVERY scanner here asserts it
 * FOUND its site before it asserts anything about it — which is the reason
 * test 3 cannot pass vacuously.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...p: string[]): string => readFileSync(path.join(REPO_ROOT, ...p), 'utf8')

/** `export const X = {...} as const` members, in DECLARATION ORDER. */
function constMembers(source: string, name: string): string[] {
  const lines = source.split('\n')
  const start = lines.findIndex((l) => l === `export const ${name} = {`)
  assert.notEqual(start, -1, `no \`export const ${name} = {\` in the source under test`)
  const end = lines.findIndex((l, i) => i > start && l.startsWith('} as const'))
  assert.notEqual(end, -1, `${name} has no \`} as const\` terminator`)
  return lines
    .slice(start + 1, end)
    .map((l) => /^\s*[A-Za-z][A-Za-z0-9]*:\s*'([^']+)',?$/.exec(l))
    .map((m) => m?.[1])
    .filter((v): v is string => v !== undefined)
}

test('test_source_document_declares_no_origin_because_g184_deletes_it', () => {
  const lines = read('model', 'domain.ts').split('\n')
  const start = lines.findIndex(
    (l) => l === 'export interface SourceDocument extends TenantScoped {',
  )
  assert.notEqual(start, -1, 'no `export interface SourceDocument extends TenantScoped {` found')
  const end = lines.findIndex((l, i) => i > start && l === '}')
  assert.notEqual(end, -1, 'SourceDocument has no closing brace')
  const origin = lines.slice(start, end).find((l) => /^\s*origin\s*[?:]/.test(l))
  assert.equal(
    origin,
    undefined,
    `SourceDocument still declares \`origin\` (${origin?.trim()}) — G184 deletes it, ` +
      'not deprecates it, and a second intake vocabulary is forbidden',
  )
})

test('test_intake_channel_kinds_is_closed_in_the_model_and_api_is_not_folded_in', () => {
  const members = constMembers(read('model', 'ingestion.ts'), 'INTAKE_CHANNEL_KINDS')
  // BY NAME AND IN ORDER, never by a length — a wrong member satisfies a length check.
  assert.deepEqual(members, ['upload', 'watched_drop', 'connector_pull', 'mailbox'])
  assert.ok(!members.includes('api'), '`api` is DROPPED, never reinterpreted as `upload`')
  assert.ok(
    !members.includes('connector'),
    '`connector` is the three-value projection G184 deletes',
  )
})

test('test_the_wire_enum_mirrors_intake_channel_kinds_as_a_sequence', () => {
  const model = constMembers(read('model', 'ingestion.ts'), 'INTAKE_CHANNEL_KINDS')
  const lines = read('docs', 'contracts', 'capability.openapi.yaml').split('\n')
  const at = lines.findIndex((l) => l === '    IntakeChannelStatus:')
  assert.notEqual(at, -1, 'no `IntakeChannelStatus:` schema under components.schemas')
  const enumLine = lines
    .slice(at, at + 20)
    .find((l) => l.trimStart().startsWith('enum: [') && l.includes('upload'))
  assert.notEqual(enumLine, undefined, 'IntakeChannelStatus.channel declares no inline `enum:`')
  const wire = (/enum:\s*\[([^\]]*)\]/.exec(enumLine ?? '')?.[1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  assert.deepEqual(
    wire,
    model,
    'the channel enum and INTAKE_CHANNEL_KINDS differ in members or in ORDER',
  )
})

test('test_the_contracts_self_admitted_divergence_paragraph_is_discharged', () => {
  assert.ok(
    !read('docs', 'contracts', 'capability.openapi.yaml').includes(
      'NOTE A DIVERGENCE FROM THE MODEL',
    ),
    'capability.openapi.yaml still records the SourceDocument.origin divergence as ' +
      "unresolved — G184's discharge note requires it deleted in the same commit",
  )
})

/**
 * G75'S WIRE HALF — the resource-class enums in `control-plane.openapi.yaml`.
 *
 * G75 (8 Aug 2026) put `secret` into `PERMITTED_RESOURCES.delivery` and took it
 * out of `NON_DELEGABLE_RESOURCES`. THE MODEL HALF LANDED AND THE WIRE HALF DID
 * NOT. Both resource enums in the control-plane contract stayed at six values
 * with `secret` absent, so under strict validation a plane would REFUSE a
 * well-formed grant the model permits — and the record meanwhile claimed the
 * enum "went six values to seven". That is `docs/HANDOFF.md` §5.4, a claim
 * asserted in a document the contracts refute, sitting on the invariant-8
 * amendment itself.
 *
 * THE EXPECTATION IS DERIVED FROM THE MODEL, NEVER FROM THE YAML UNDER TEST.
 * Every constant below is read out of `model/governance.ts` at runtime. A test
 * that read the enum out of the file it is checking would pass against any
 * value the file happened to hold, which is how this drift survived a wire
 * mirror, a citation checker and a count checker.
 *
 * NEGATIVE CONTROLS, because "the sets are equal" is not enough on its own:
 *   · `secret` is asserted present BY NAME, not by a length of seven. A wrong
 *     seventh member would satisfy a length check.
 *   · `statutory` is asserted ABSENT BY NAME. It is the sole remaining member
 *     of `NON_DELEGABLE_RESOURCES` — `authorisationPermits()` refuses it before
 *     the null check — so a grant line naming it is unrepresentable, and an
 *     enum admitting it would make the wire wider than the model.
 *   · the derivation itself is asserted against the model half of G75, so if
 *     someone quietly narrows `PERMITTED_RESOURCES.delivery` back this file
 *     fails on the model rather than silently agreeing with the wire.
 *
 * ⚠️ NOT A YAML PARSER, and deliberately not one. There is no YAML dependency
 * in this repository and adding one is a decision nobody has taken. This is a
 * line scanner over the two `resource:` properties, the same narrow subset of
 * YAML `tools/check-wire-mirror.mjs` resolves. It asserts it found exactly TWO
 * enum sites before comparing anything: a scanner that silently found none
 * would pass every other assertion vacuously.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ACCESS_RESOURCE_CLASSES,
  PERMITTED_RESOURCES,
  CONTRACT_ONLY_RESOURCES,
  NON_DELEGABLE_RESOURCES,
} from '../../model/governance.ts'
import type { AccessResourceClass } from '../../model/governance.ts'

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)
const CONTRACT = path.join(
  REPO_ROOT,
  'docs',
  'contracts',
  'control-plane.openapi.yaml',
)

/**
 * The complete set a `TenantAccessGrant` line may name.
 *
 * `PERMITTED_RESOURCES.delivery ∪ PERMITTED_RESOURCES.incident ∪
 * CONTRACT_ONLY_RESOURCES`, in first-appearance order. Order is retained rather
 * than sorted because the wire is read by people beside the model, and a
 * reordering is the shape that hides the next insertion — the same reason
 * `check-wire-mirror.mjs` compares sequences and not sets.
 */
function deriveExpected(): AccessResourceClass[] {
  const out: AccessResourceClass[] = []
  for (const member of [
    ...PERMITTED_RESOURCES.delivery,
    ...PERMITTED_RESOURCES.incident,
    ...CONTRACT_ONLY_RESOURCES,
  ]) {
    if (!out.includes(member)) out.push(member)
  }
  return out
}

/**
 * Every `enum: [...]` that belongs to a property named `resource`.
 *
 * Scans forward from each `resource:` key to the first `enum:` flow sequence,
 * skipping comment and description lines, and stops at the next key at or above
 * the `resource:` indentation so a runaway scan cannot capture an unrelated
 * enum further down the file.
 */
function readResourceEnums(yaml: string): { line: number; members: string[] }[] {
  const lines = yaml.split('\n')
  const found: { line: number; members: string[] }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    const key = /^(\s*)resource:\s*$/.exec(line)
    if (key === null) continue
    const indent = (key[1] ?? '').length

    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j]
      if (candidate === undefined) break
      if (candidate.trim() === '') continue
      const candidateIndent = candidate.length - candidate.trimStart().length
      if (candidateIndent <= indent) break
      const flow = /^\s*enum:\s*\[([^\]]*)\]\s*$/.exec(candidate)
      if (flow !== null) {
        found.push({
          line: j + 1,
          members: (flow[1] ?? '')
            .split(',')
            .map((m) => m.trim())
            .filter((m) => m !== ''),
        })
        break
      }
    }
  }
  return found
}

/** Number words the contract prose uses to state a count in words. */
const NUMBER_WORDS: Record<string, number> = {
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  /* R10, 1 Oct 2026 — `deal`, `sandbox` and `partner_staff` took the class
   * count to sixteen, and the contract prose this file polices says so. */
  sixteen: 16,
}

const yaml = readFileSync(CONTRACT, 'utf8')

/**
 * The prose, with every run of whitespace collapsed to one space.
 *
 * ⚠️ THE PROSE ASSERTIONS BELOW MUST READ THIS AND NOT `yaml`. Every sentence
 * they match lives inside a folded block description and WRAPS ACROSS LINES at
 * an arbitrary column, so a regex run against the raw file fails on the line
 * break rather than on the claim — a test that goes red for a reason that has
 * nothing to do with the defect it is guarding.
 */
const flat = yaml.replace(/\s+/g, ' ')
const expected = deriveExpected()

test('the model half of G75 is in place, so the derivation means what it says', () => {
  assert.ok(
    PERMITTED_RESOURCES.delivery.includes('secret'),
    'PERMITTED_RESOURCES.delivery must contain `secret` (G75). If this fails, ' +
      'the model half has been narrowed back and the wire is not the problem.',
  )
  assert.deepEqual(
    [...NON_DELEGABLE_RESOURCES],
    ['statutory'],
    'NON_DELEGABLE_RESOURCES must be exactly [statutory] (G75).',
  )
  assert.ok(
    expected.includes('secret'),
    'the derived set must contain `secret`',
  )
  assert.ok(
    !expected.includes('statutory'),
    'the derived set must not contain `statutory`',
  )
})

test('both resource enums are found — the scanner is not vacuous', () => {
  const enums = readResourceEnums(yaml)
  assert.equal(
    enums.length,
    2,
    'expected exactly two `resource:` enums in control-plane.openapi.yaml ' +
      '(AccessResourceGrant.resource and AccessSessionReport.touched[].resource); ' +
      `found ${enums.length}`,
  )
})

test('AccessResourceGrant.resource and the session-report enum match the model element-for-element', () => {
  const enums = readResourceEnums(yaml)
  for (const found of enums) {
    assert.deepEqual(
      found.members,
      expected,
      `control-plane.openapi.yaml:${found.line} disagrees with ` +
        'PERMITTED_RESOURCES ∪ CONTRACT_ONLY_RESOURCES in model/governance.ts',
    )
  }
})

test('`secret` is present BY NAME in both enums — G75 is transmissible', () => {
  const enums = readResourceEnums(yaml)
  for (const found of enums) {
    assert.ok(
      found.members.includes('secret'),
      `control-plane.openapi.yaml:${found.line} omits \`secret\`, so a plane ` +
        'validating strictly would refuse a grant the model permits',
    )
  }
})

test('`statutory` is ABSENT from both enums — it is non-delegable', () => {
  const enums = readResourceEnums(yaml)
  for (const found of enums) {
    assert.ok(
      !found.members.includes('statutory'),
      `control-plane.openapi.yaml:${found.line} admits \`statutory\`, which ` +
        'authorisationPermits() refuses first, always',
    )
  }
})

test('the two enums agree with each other', () => {
  const enums = readResourceEnums(yaml)
  const [first, second] = enums
  assert.ok(first !== undefined && second !== undefined)
  assert.deepEqual(
    second.members,
    first.members,
    'a session may only touch a class some grant could name; divergence here ' +
      'hides a report about an act nobody authorised',
  )
})

test('the prose states the enum length, and it is the derived length', () => {
  const derived = /THE (\w+) VALUES ARE DERIVED/.exec(flat)
  assert.ok(derived !== null, 'expected a "THE <N> VALUES ARE DERIVED" sentence')
  assert.equal(
    NUMBER_WORDS[(derived[1] ?? '').toLowerCase()],
    expected.length,
    `prose says "${derived[1]}" values; the model derives ${expected.length}`,
  )

  const mirror = /Same (\w+) values and they must stay/.exec(flat)
  assert.ok(mirror !== null, 'expected a "Same <N> values" sentence')
  assert.equal(
    NUMBER_WORDS[(mirror[1] ?? '').toLowerCase()],
    expected.length,
    `prose says "${mirror[1]}" values; the model derives ${expected.length}`,
  )
})

test('the prose states how many classes are absent, and it is derived too', () => {
  const total = Object.keys(ACCESS_RESOURCE_CLASSES).length
  const absent = total - expected.length
  const stated = /The other (\w+) of the (\w+) classes are absent/.exec(flat)
  assert.ok(
    stated !== null,
    'expected a "The other <N> of the <M> classes are absent" sentence',
  )
  assert.equal(
    NUMBER_WORDS[(stated[1] ?? '').toLowerCase()],
    absent,
    `prose says ${stated[1]} classes absent; the model derives ${absent}`,
  )
  assert.equal(
    NUMBER_WORDS[(stated[2] ?? '').toLowerCase()],
    total,
    `prose says ${stated[2]} classes total; the model has ${total}`,
  )
})

/**
 * ⚠️ SCOPED TO THE LIVE SENTENCE, AND THAT IS DELIBERATE.
 *
 * The first draft of this test banned the string
 * "`statutory` and `secret` are in `NON_DELEGABLE_RESOURCES`" from the whole
 * file. That is the wrong control. This record NARRATES ITS CORRECTIONS — every
 * reversal quotes the sentence it replaced rather than deleting it, which is
 * the same HISTORICAL-versus-STALE distinction `check-doc-counts.mjs` draws — so
 * a whole-file ban would forbid the honest write-up of G75 and reward silently
 * erasing the property that was given up.
 *
 * So the assertion is made against the LIVE reasons sentence only: the one
 * beginning "The other N of the thirteen classes are absent", which is the
 * contract speaking in its own voice about what the enum excludes today. A
 * quoted superseded sentence elsewhere in the description is not a claim and is
 * not policed here.
 */
test('the live reasons sentence names `statutory` as non-delegable and not `secret`', () => {
  const sentence = /The other \w+ of the \w+ classes are absent[^]*?therefore an act\./.exec(
    flat,
  )
  assert.ok(
    sentence !== null,
    'expected the live "The other N of the thirteen classes are absent … ' +
      'therefore an act." sentence, which is what this test polices',
  )
  const live = sentence[0]

  assert.ok(
    live.includes('`statutory`'),
    'the live reasons sentence must still name `statutory` as unreachable',
  )
  assert.ok(
    !live.includes('`secret`'),
    'the live reasons sentence still lists `secret` among the classes the ' +
      'enum excludes. G75 moved it into PERMITTED_RESOURCES.delivery and out ' +
      'of NON_DELEGABLE_RESOURCES; it is now IN the enum, not excluded from it.',
  )
})

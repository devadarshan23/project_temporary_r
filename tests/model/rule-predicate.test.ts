/**
 * G130 — `RulePredicate` COMPILES NO PATTERN.
 *
 * WHAT WAS THERE. `| { kind: 'matches_pattern'; subject: Expr; pattern: string }`
 * sat in `RulePredicate` with NO EVALUATOR ANYWHERE in the tree. `RulePredicate`
 * is what `MatchRule.predicate` (`model/domain.ts:1922`) and
 * `ProcedureStep.branch` (`model/domain.ts:3149`) carry, and `MatchRule` is
 * where G123 puts learned disposition rules. The first engineer to implement
 * that path writes `new RegExp(predicate.pattern)` over counterparty-controlled
 * text — the S1 shape `model/reconciliation.ts`'s header bans by name, reached
 * through a door nobody opened deliberately.
 *
 * WHAT REPLACES IT. `extraction_in_set`: a declared `IdentifierNormalisation`
 * (the closed, total op vocabulary that already exists) plus the enumerated
 * values the EXTRACTION is compared against. Nothing is compiled, and a
 * reviewer approves `split on '-', take segment 1, casefold` rather than a
 * regex — which is G124's deciding argument, because an approval nobody can
 * read is not an approval.
 *
 * ⚠️ FOR A NEW DECLARATION THE ONLY AVAILABLE RED IS ABSENCE, and absence
 * proves nothing about behaviour. The first red here was a module that would
 * not load. Every test below was therefore proven by MUTATION instead —
 * `model/domain.ts` was changed to the plausible wrong thing, exactly the named
 * tests went red, and the change was reverted byte-for-byte (checksum compared)
 * five times:
 *
 *   A  compare the RAW subject, not the extracted key  → 3 red
 *   B  hold unconditionally                            → 6 red
 *   C  on a refused extraction, fall back to the raw    → 2 red
 *   D  re-declare the pattern arm on `RulePredicate`    → 1 red, naming the line
 *   E  evaluate by compiling the values into a RegExp   → 5 red, naming the line
 *
 * ⚠️ AND ONE TEST HERE NEVER WENT RED AND SAYS SO IN PLACE: the `RegExp`
 * control was green before this change, because `model/` never constructed one.
 * It is a standing guard rather than evidence of new behaviour, and mutation E
 * is the only thing that shows it bites at all.
 *
 * ⚠️ COMMENTS ARE STRIPPED BEFORE THE SOURCE CONTROLS MATCH, AND THAT IS
 * LOAD-BEARING. This very block names both banned strings, and so does the
 * replacement's own docblock in `model/domain.ts`: this record narrates its own
 * corrections, so a control that fired on prose would fire while the property
 * held — `docs/HANDOFF.md` §5.6 read from the other side. The stripper is the
 * one in `tests/model/reconciliation-controls.test.ts`, copied rather than
 * imported because importing a test module re-registers its tests. Folding both
 * copies into a shared helper is a follow-up; it needs a file outside this
 * build's ownership.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractionInSetHolds } from '../../model/domain.ts'
import type { ExtractionFn, RulePredicate } from '../../model/domain.ts'
import { applyExtraction } from '../../model/reconciliation.ts'
import type { IdentifierNormalisation } from '../../model/reconciliation.ts'
/* G214 — a `FieldPath` is a token list; the seam is the only way to mint one. */
import { parseFieldPath } from '../../model/field-path.ts'

/** Fixture-only unwrap — a refusal here is a defect in this file, not a result. */
function fixturePath(...tokens: readonly string[]) {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`unparseable fixture FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODEL_DIR = join(REPO_ROOT, 'model')

// ------------------------------------------------------- the source controls

type Mode = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'

interface Frame {
  readonly mode: Mode
  braces: number
}

/**
 * Comments removed, EVERYTHING ELSE KEPT — character by character. String
 * literals survive on purpose: a banned token may legitimately be a string, and
 * a stripper that ate strings would look greener while asserting less.
 *
 * Verbatim from `tests/model/reconciliation-controls.test.ts`, including its
 * stated limit: it does not recognise a regex LITERAL. No file under `model/`
 * contains one, and the failure mode is loud rather than silent — a derailed
 * scanner preserves comment text and the controls below go RED.
 */
function stripComments(source: string): string {
  const stack: Frame[] = [{ mode: 'code', braces: 0 }]
  let out = ''

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] ?? ''
    const next = source[i + 1] ?? ''
    const frame = stack[stack.length - 1] ?? { mode: 'code', braces: 0 }
    const parent = stack[stack.length - 2]

    if (frame.mode === 'code') {
      if (ch === '/' && next === '/') {
        stack.push({ mode: 'line', braces: 0 })
        out += '  '
        i += 1
      } else if (ch === '/' && next === '*') {
        stack.push({ mode: 'block', braces: 0 })
        out += '  '
        i += 1
      } else if (ch === "'" || ch === '"' || ch === '`') {
        const mode: Mode =
          ch === "'" ? 'single' : ch === '"' ? 'double' : 'template'
        stack.push({ mode, braces: 0 })
        out += ch
      } else if (ch === '{') {
        frame.braces += 1
        out += ch
      } else if (ch === '}' && frame.braces === 0 && parent?.mode === 'template') {
        stack.pop()
        out += ch
      } else {
        if (ch === '}') frame.braces -= 1
        out += ch
      }
      continue
    }

    if (frame.mode === 'line') {
      if (ch === '\n') {
        stack.pop()
        out += '\n'
      } else {
        out += ' '
      }
      continue
    }

    if (frame.mode === 'block') {
      if (ch === '*' && next === '/') {
        stack.pop()
        out += '  '
        i += 1
      } else {
        out += ch === '\n' ? '\n' : ' '
      }
      continue
    }

    out += ch
    if (ch === '\\') {
      out += next
      i += 1
      continue
    }
    if (frame.mode === 'single' && ch === "'") stack.pop()
    else if (frame.mode === 'double' && ch === '"') stack.pop()
    else if (frame.mode === 'template') {
      if (ch === '`') stack.pop()
      else if (ch === '$' && next === '{') {
        out += next
        i += 1
        stack.push({ mode: 'code', braces: 0 })
      }
    }
  }

  return out
}

interface Module {
  readonly name: string
  readonly code: string
}

const MODULES: readonly Module[] = readdirSync(MODEL_DIR)
  .filter((f) => f.endsWith('.ts'))
  .sort()
  .map((name) => ({
    name,
    code: stripComments(readFileSync(join(MODEL_DIR, name), 'utf8')),
  }))

/** Every hit of `needle` in code, as `file:line`, so a failure names the site. */
function codeHits(needle: string): readonly string[] {
  const hits: string[] = []
  for (const mod of MODULES) {
    const lines = mod.code.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if ((lines[i] ?? '').includes(needle)) hits.push(`model/${mod.name}:${i + 1}`)
    }
  }
  return hits
}

test('test_the_scanner_reached_every_module_and_the_code_survived_the_stripper', () => {
  /* The other direction of the stripper. If this ever passes vacuously — no
   * modules, or a stripper that ate the file — every control below is green
   * while asserting nothing, which is §5.6. */
  assert.ok(MODULES.length >= 17, `only ${MODULES.length} modules scanned`)
  const domain = MODULES.find((m) => m.name === 'domain.ts')
  assert.ok(domain !== undefined)
  assert.ok(domain.code.includes('export type RulePredicate ='))
  assert.ok(domain.code.includes("kind: 'unique_within'"))
})

test('test_no_code_line_under_model_declares_or_reads_a_matches_pattern_arm', () => {
  /* BY NAME, not by a count. A count drifts to whatever the tree happens to
   * hold; the property is that the token appears in no executable line at all. */
  assert.deepEqual(codeHits('matches_pattern'), [])
})

test('test_no_code_line_under_model_constructs_a_RegExp', () => {
  /* GREEN BEFORE THE CHANGE AND SAID SO. This never went red — it is a standing
   * guard, not a proof of new behaviour. It exists so that the replacement
   * cannot be quietly undone by an evaluator that compiles the op list. */
  assert.deepEqual(codeHits('new RegExp'), [])
})

test('test_the_replacement_arm_is_declared_on_RulePredicate_in_domain', () => {
  const domain = MODULES.find((m) => m.name === 'domain.ts')
  assert.ok(domain !== undefined)
  assert.ok(domain.code.includes("kind: 'extraction_in_set'"))
})

// -------------------------------------------------------------- the evaluator

/** The identity op list. `{ ops: [], then: 'exact' }` plus the required cap. */
const IDENTITY: IdentifierNormalisation = { ops: [], then: 'exact', maxInputChars: 64 }

function armWith(
  values: readonly string[],
  extraction: IdentifierNormalisation = IDENTITY,
): Extract<RulePredicate, { kind: 'extraction_in_set' }> {
  return {
    kind: 'extraction_in_set',
    subject: { kind: 'field', slot: 'bank', path: fixturePath('reference') },
    extraction,
    values,
  }
}

/** An extractor that provably rewrites its input, so raw and key never coincide. */
const REWRITES: ExtractionFn = (input) => ({ ok: true, key: `EXTRACTED(${input})` })

const REFUSES: ExtractionFn = () => ({ ok: false })

test('test_the_declared_values_are_compared_against_the_EXTRACTION_and_not_the_raw_subject', () => {
  /* MUTATION THAT KILLS THIS: compare `raw` instead of the extracted key. */
  const held = extractionInSetHolds(armWith(['EXTRACTED(BR001)']), 'BR001', REWRITES)
  assert.deepEqual(held, { held: true })
})

test('test_a_value_equal_to_the_RAW_subject_but_not_to_the_extraction_does_not_hold', () => {
  /* The same property from the other side. Without this, an evaluator that
   * compared the raw string would still pass the test above whenever the
   * extraction happened to be the identity. */
  const held = extractionInSetHolds(armWith(['BR001']), 'BR001', REWRITES)
  assert.deepEqual(held, { held: false, reason: 'not_in_set' })
})

test('test_a_subject_absent_from_the_declared_set_is_refused_rather_than_held', () => {
  /* MUTATION THAT KILLS THIS: `return { held: true }` unconditionally. Without
   * this test the predicate could hold for everything and every test above
   * would still be green. */
  const held = extractionInSetHolds(armWith(['TXN1', 'TXN2']), 'TXN9', REWRITES)
  assert.deepEqual(held, { held: false, reason: 'not_in_set' })
})

test('test_an_empty_declared_set_holds_for_nothing', () => {
  assert.deepEqual(extractionInSetHolds(armWith([]), 'TXN1', REWRITES), {
    held: false,
    reason: 'not_in_set',
  })
})

test('test_a_refused_extraction_does_not_fall_back_to_the_raw_subject', () => {
  /* MUTATION THAT KILLS THIS: on `ok: false`, compare the raw string. That is
   * the fail-OPEN branch §5.5 records this codebase already fixing once — the
   * op list refuses precisely on the inputs somebody chose to be hostile
   * (over the cap, segment out of range), which is when falling back to the
   * attacker's own bytes is worst. */
  const held = extractionInSetHolds(armWith(['BR001']), 'BR001', REFUSES)
  assert.deepEqual(held, { held: false, reason: 'extraction_refused' })
})

test('test_the_arm_composes_with_the_real_applyExtraction_over_the_bank_reference_shape', () => {
  /* The draft's own `(?<=BR\d{3}-)TXN\d+(?=-SG)`, expressed as ops and run
   * through the real interpreter rather than a stand-in. `applyExtraction` is
   * passed by value; nothing in `model/domain.ts` imports it. */
  const normalisation: IdentifierNormalisation = {
    ops: [{ kind: 'split_take', separator: '-', index: 1 }],
    then: 'exact',
    maxInputChars: 64,
  }
  assert.deepEqual(
    extractionInSetHolds(armWith(['TXN99823'], normalisation), 'BR001-TXN99823-SG', applyExtraction),
    { held: true },
  )
  assert.deepEqual(
    extractionInSetHolds(armWith(['TXN99823'], normalisation), 'BR001-TXN00001-SG', applyExtraction),
    { held: false, reason: 'not_in_set' },
  )
})

test('test_the_real_extractors_own_refusal_arms_reach_the_predicate_unchanged', () => {
  /* Over the cap, and segment out of range. Both are `ok: false` from
   * `applyExtraction`, and both must land as `extraction_refused` rather than
   * as a match — proving the composition carries the refusal rather than
   * swallowing it. */
  const tiny: IdentifierNormalisation = { ops: [], then: 'exact', maxInputChars: 4 }
  assert.deepEqual(extractionInSetHolds(armWith(['BR001']), 'BR001', applyExtraction), {
    held: true,
  })
  assert.deepEqual(extractionInSetHolds(armWith(['BR001'], tiny), 'BR001', applyExtraction), {
    held: false,
    reason: 'extraction_refused',
  })

  const outOfRange: IdentifierNormalisation = {
    ops: [{ kind: 'split_take', separator: '-', index: 7 }],
    then: 'exact',
    maxInputChars: 64,
  }
  assert.deepEqual(
    extractionInSetHolds(armWith(['BR001'], outOfRange), 'BR001', applyExtraction),
    { held: false, reason: 'extraction_refused' },
  )
})

test('test_the_evaluator_mutates_neither_the_predicate_nor_its_declared_values', () => {
  const values = ['TXN1', 'TXN2']
  const arm = armWith(values)
  const before = JSON.stringify(arm)
  extractionInSetHolds(arm, 'TXN9', REWRITES)
  assert.equal(JSON.stringify(arm), before)
  assert.deepEqual(values, ['TXN1', 'TXN2'])
})

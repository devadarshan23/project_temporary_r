/**
 * THE DANGLING BRAND. `Id<'NormalisedDescription'>` named no interface.
 *
 * ------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AND WHY tsc IS NOT THE TEST
 * ------------------------------------------------------------------------
 *
 * A brand is a phantom type. `tsc` never resolves `Id<'X'>` back to an `X`, so
 * `export type NormalisedDescriptionId = Id<'NormalisedDescription'>` compiled
 * clean from the day it landed (9 Aug 2026, G131) while naming a type that has
 * never existed in this tree. `CLAUDE.md` records the precedent: four such
 * mismatches once broke 18 of 172 typed edges with a green build throughout.
 *
 * `tools/planner/extract.mjs` is the only thing here that resolves brands, so
 * IT is the test runner for this defect and the assertions below are made
 * against ITS OUTPUT, by number. A green exit from the extractor proves
 * nothing — it exits 0 with dangling edges present, which is exactly the state
 * this file was written red in.
 *
 * ------------------------------------------------------------------------
 * WHAT WAS ACTUALLY WRONG — THE DIAGNOSIS THESE TESTS PIN
 * ------------------------------------------------------------------------
 *
 * The brand was not merely unaccompanied; it was the WRONG KIND OF TYPE. A
 * normalised description is a VALUE the engine produced from a row — the string
 * a human was shown — not a REFERENCE to a row of its own. `model/learning.ts`
 * said both things at once: the declaration's docblock called it "a reference
 * and never the text", while `ObservedScopeValue`'s docblock, twenty lines
 * later, said "a normalised description is not an entity; it is a VALUE
 * observed on a row, WITH NO REGISTRY TO CHECK IT AGAINST, so provenance is the
 * only thing that makes it real."
 *
 * The second reading is the one the code implements, and `observedOn` is the
 * proof: provenance exists precisely BECAUSE there is no row to point at. Were
 * there a `NormalisedDescription` table, the id would carry its own provenance
 * and G131's whole mechanism would be redundant.
 *
 * So the fix is a branded VALUE type, not a new entity. Minting a
 * `NormalisedDescription` interface would satisfy the extractor by inventing a
 * table for a derived, recomputable, untimed string — and G35's rule ("a
 * machine-produced TIMED record gets its own identity") does not reach it.
 * `test_no_NormalisedDescription_interface_was_created_to_satisfy_the_brand`
 * is the negative control that keeps that door shut, BY NAME.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ROW_FACT_FOR_DIMENSION, entryAppliesToRow } from '../../model/learning.ts'
import type {
  LearningEntry,
  LearningScope,
  NormalisedDescriptionValue,
  ObservedScopeValue,
  ResidueRowFacts,
} from '../../model/learning.ts'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const LEARNING_SRC = readFileSync(new URL('../../model/learning.ts', import.meta.url), 'utf8')

/* ------------------------------------------------------------------ *
 * The extractor, run once, parsed two ways.
 * ------------------------------------------------------------------ */

/**
 * ⚠️ RUN, NOT READ. `docs/model-graph.json` is a committed artefact and may be
 * stale by exactly the edit under test, so reading it alone would let this file
 * pass against a snapshot taken before the fix. The extractor is executed here
 * and its own stdout is the evidence; the JSON is read only afterwards, from
 * the run this test caused.
 */
function runExtractor(): { stdout: string; graph: Record<string, unknown> } {
  // 🛑 `--out` INTO A TEMP FILE, NEVER INTO THE TREE. Until 12 Aug 2026 this ran
  // the extractor with no flag and it wrote `docs/model-graph.json` — so `npm test`
  // mutated a COMMITTED ARTEFACT on every run. Every contributor saw the file dirty
  // after the suite and learned to ignore it, which is precisely how the committed
  // copy stayed stale for days while the record kept warning about it: the signal
  // that would have shown the staleness was the one everybody had been trained to
  // discard. A test may read the tree; it may not write to it.
  //
  // The extractor is still EXECUTED, which is what this file's header defends —
  // reading the committed snapshot instead would let this test pass against a graph
  // taken before the edit under test.
  const out = join(mkdtempSync(join(tmpdir(), 'reconcile-graph-')), 'model-graph.json')
  const stdout = execFileSync(process.execPath, ['tools/planner/extract.mjs', '--out', out], {
    cwd: REPO,
    encoding: 'utf8',
  })
  const graph: unknown = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(typeof graph, 'object')
  assert.notEqual(graph, null)
  return { stdout, graph: graph as Record<string, unknown> }
}

interface GraphEdge {
  readonly from: string
  readonly field: string
  readonly kind: string
  readonly typedAs: string
}
interface GraphGap {
  readonly kind: string
  readonly subject: string
  readonly evidence: string
}
interface GraphNode {
  readonly name: string
}
interface GraphIdType {
  readonly name: string
  readonly brand: string
  readonly resolvesTo: string | null
}

/* ================================================================== *
 * 1. The count, by number
 * ================================================================== */

test('test_the_model_graph_reports_zero_dangling_edges_by_number_not_by_exit_code', () => {
  const { stdout } = runExtractor()

  const line = /typed edges\s+(\d+)\s+\((\d+) resolving \+ (\d+) dangling\)/.exec(stdout)
  assert.notEqual(line, null, `extractor summary line not found in:\n${stdout}`)
  const total = Number(line?.[1])
  const resolving = Number(line?.[2])
  const dangling = Number(line?.[3])

  /* THE ASSERTION THE WHOLE TASK TURNS ON. Not `exitCode === 0` — the
   * extractor exits 0 with dangling edges present, and did so for the entire
   * time this defect was live. */
  assert.equal(dangling, 0, `expected 0 dangling edges, extractor reported ${dangling}`)

  /* And the other two numbers must agree, so a future change that hides a
   * dangling edge by dropping it from the total is red here too. */
  assert.equal(resolving, total)
  assert.ok(total > 0, 'a graph with no edges would satisfy "0 dangling" vacuously')
})

/* ================================================================== *
 * 2. The specific edge, and the gap it raised
 * ================================================================== */

test('test_no_edge_and_no_gap_names_the_NormalisedDescription_brand', () => {
  const { graph } = runExtractor()

  const edges = graph['edges'] as readonly GraphEdge[]
  const gaps = graph['gaps'] as readonly GraphGap[]
  const idTypes = graph['idTypes'] as readonly GraphIdType[]

  /* The edge that was dangling: LearningScope.normalisedDescriptions. It must
   * now produce NO edge at all — a value is not a reference, so the graph
   * should not carry an arrow for it in either state. */
  const scopeEdges = edges.filter(
    (e) => e.from === 'LearningScope' && e.field === 'normalisedDescriptions',
  )
  assert.deepEqual(scopeEdges, [], 'a branded VALUE must not appear as a graph edge')

  /* The five sibling dimensions DO name entities and must still resolve —
   * a sensitivity control, so this test cannot pass by the extractor having
   * stopped seeing LearningScope at all. */
  const siblings = edges.filter((e) => e.from === 'LearningScope')
  assert.equal(siblings.length, 4)
  assert.deepEqual(
    siblings.map((e) => e.kind),
    ['typed', 'typed', 'typed', 'typed'],
  )

  assert.deepEqual(
    gaps.filter((g) => g.kind === 'brand_without_interface'),
    [],
  )
  assert.deepEqual(
    idTypes.filter((t) => t.brand === 'NormalisedDescription'),
    [],
  )
  assert.deepEqual(
    idTypes.filter((t) => t.resolvesTo === null),
    [],
  )
})

/* ================================================================== *
 * 3. The negative controls
 * ================================================================== */

test('test_no_NormalisedDescription_interface_was_created_to_satisfy_the_brand', () => {
  const modelDir = new URL('../../model/', import.meta.url)
  const offenders: string[] = []
  for (const file of readdirSync(modelDir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(new URL(file, modelDir), 'utf8')
    src.split('\n').forEach((l, i) => {
      if (/^\s*(export\s+)?(interface|type|class)\s+NormalisedDescription\b(?!\w)/.test(l)) {
        offenders.push(`model/${file}:${i + 1}: ${l.trim()}`)
      }
    })
  }
  assert.deepEqual(
    offenders,
    [],
    'the brand must be fixed by retyping the value, never by inventing a table for it',
  )

  const { graph } = runExtractor()
  const nodes = graph['nodes'] as readonly GraphNode[]
  assert.equal(
    nodes.some((n) => n.name === 'NormalisedDescription'),
    false,
  )
  assert.ok(nodes.length > 0)
})

test('test_the_normalised_description_type_is_no_longer_id_shaped_anywhere', () => {
  /* CODE LINES ONLY. The docblock preserves the old declaration verbatim —
   * this record narrates its corrections rather than erasing them — so a bare
   * grep over the file would forbid the history along with the defect. The
   * filter is `COMMENT_LINE` from tools/planner/extract.mjs, copied exactly,
   * because "not a comment" must mean here what it means to the tool whose
   * output the first test asserts on. */
  const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/
  const code = LEARNING_SRC.split('\n').filter((l) => !COMMENT_LINE.test(l))

  /* An `Id<>` alias is what the extractor indexes; an `…Id` NAME is what every
   * human here reads as a reference. Both are gone, and both are asserted —
   * the second is the one no tool in this repository can check. */
  assert.deepEqual(code.filter((l) => /Id<'NormalisedDescription'>/.test(l)), [])
  assert.deepEqual(code.filter((l) => /\bNormalisedDescriptionId\b/.test(l)), [])
  assert.deepEqual(code.filter((l) => /\bnormalisedDescriptionId\b/.test(l)), [])

  /* The filter is not swallowing the file: the declaration under test is on a
   * code line and is found there. Without this, every assertion above would
   * pass against an empty array. */
  assert.equal(
    code.filter((l) => /^export type NormalisedDescriptionValue = string &/.test(l)).length,
    1,
  )
  /* And the brand is module-private, so the only way to make one is a cast at
   * a declared seam. An exported symbol would let any module mint one. */
  assert.equal(/^declare const normalisedDescription: unique symbol$/m.test(LEARNING_SRC), true)
  assert.equal(/export declare const normalisedDescription\b/.test(LEARNING_SRC), false)

  /* ID_SHAPED in tools/planner/extract.mjs is /^[a-zA-Z]*[Ii]ds?$/. The new
   * names must not match it, or the extractor reads the value as a bare
   * reference and the defect returns in its other form. */
  const idShaped = /^[a-zA-Z]*[Ii]ds?$/
  assert.equal(idShaped.test('NormalisedDescriptionValue'), false)
  assert.equal(idShaped.test('normalisedDescriptionValue'), false)
  /* A control: the old names DID match, which is why this rule bites. */
  assert.equal(idShaped.test('NormalisedDescriptionId'), true)
  assert.equal(idShaped.test('normalisedDescriptionId'), true)
})

/* ================================================================== *
 * 4. G125 survives the retype — exact membership, unchanged
 * ================================================================== */

type ExceptionId = Extract<LearningEntry['counterExample'], { kind: 'named' }>['exceptionId']

const SEEN_ON = 'exc_00001' as ExceptionId
const SHOWN = 'acme freight surcharge' as NormalisedDescriptionValue
const ONE_CHARACTER_OFF = 'acme freight surcharg' as NormalisedDescriptionValue

function observed(value: NormalisedDescriptionValue): ObservedScopeValue<NormalisedDescriptionValue> {
  return { value, observedOn: SEEN_ON }
}

const SCOPE: LearningScope = {
  counterpartyIds: { kind: 'unconstrained' },
  documentTypeIds: { kind: 'unconstrained' },
  definitionIds: { kind: 'unconstrained' },
  solutionIds: { kind: 'unconstrained' },
  dispositionFamilies: { kind: 'unconstrained' },
  normalisedDescriptions: { kind: 'these', values: [observed(SHOWN)] },
}

const ENTRY: LearningEntry = {
  tenantId: 'ten_acme' as LearningEntry['tenantId'],
  id: 'lrn_0001' as LearningEntry['id'],
  nominationId: 'lnm_0001' as LearningEntry['nominationId'],
  destination: 'memory',
  scope: SCOPE,
  reason: 'counterparty_pattern',
  preferredDispositionKey: 'timing_difference',
  counterExample: { kind: 'named', exceptionId: SEEN_ON },
  dataClass: 'internal',
  status: 'active',
  effectiveUntil: '2026-12-31T00:00:00Z' as LearningEntry['effectiveUntil'],
  promotedAt: '2026-08-09T00:00:00Z' as LearningEntry['promotedAt'],
}

function row(value: NormalisedDescriptionValue | null): ResidueRowFacts {
  return {
    counterpartyId: null,
    documentTypeId: null,
    definitionId: null,
    solutionId: null,
    dispositionFamily: null,
    normalisedDescriptionValue: value,
  }
}

test('test_exact_membership_still_holds_after_the_retype_and_a_one_character_variant_still_misses', () => {
  const hit = entryAppliesToRow(ENTRY, row(SHOWN))
  assert.equal(hit.applies, true)
  assert.deepEqual(hit.applies === true ? hit.boundDimensions : null, ['normalisedDescriptions'])

  const miss = entryAppliesToRow(ENTRY, row(ONE_CHARACTER_OFF))
  assert.equal(miss.applies, false)
  assert.equal(miss.applies === false ? miss.code : null, 'value_not_enumerated')
  assert.equal(miss.applies === false ? miss.dimension : null, 'normalisedDescriptions')

  /* The delta is genuinely one character, asserted rather than eyeballed. */
  assert.equal(String(SHOWN).length - String(ONE_CHARACTER_OFF).length, 1)
  assert.equal(String(SHOWN).startsWith(String(ONE_CHARACTER_OFF)), true)

  /* ⚠️ BOTH DIRECTIONS OF "STARTS WITH", AND THE SECOND ONE IS HERE BECAUSE A
   * MUTATION SURVIVED WITHOUT IT. `ONE_CHARACTER_OFF` is a PREFIX of `SHOWN`,
   * so mutating the evaluator's `candidate === fact` to `fact.startsWith(
   * candidate)` left every assertion above green — the shorter variant misses
   * under prefix matching too. Only a variant one character LONGER, of which
   * the enumerated value is the prefix, kills that mutation. */
  const ONE_CHARACTER_LONGER = 'acme freight surcharges' as NormalisedDescriptionValue
  const longer = entryAppliesToRow(ENTRY, row(ONE_CHARACTER_LONGER))
  assert.equal(longer.applies, false)
  assert.equal(longer.applies === false ? longer.code : null, 'value_not_enumerated')
  assert.equal(String(ONE_CHARACTER_LONGER).startsWith(String(SHOWN)), true)

  /* And case is not folded. Normalisation happened upstream in the engine
   * under a declared `IdentifierNormalisation`; this evaluator transforms
   * nothing. Kills a `toLowerCase() ===` mutation, which neither variant
   * above would catch. */
  const cased = entryAppliesToRow(ENTRY, row('ACME FREIGHT SURCHARGE' as NormalisedDescriptionValue))
  assert.equal(cased.applies, false)
  assert.equal(cased.applies === false ? cased.code : null, 'value_not_enumerated')

  /* And the row that carries no value at all still misses on the row side,
   * not on the enumeration side — the two refusals stay distinguishable. */
  const absent = entryAppliesToRow(ENTRY, row(null))
  assert.equal(absent.applies, false)
  assert.equal(absent.applies === false ? absent.code : null, 'row_lacks_dimension')
})

test('test_the_row_fact_named_for_the_dimension_still_exists_on_the_row_type', () => {
  /* `ROW_FACT_FOR_DIMENSION` maps a dimension to a FIELD NAME as a STRING, so
   * a rename that updates the type and forgets the map is a runtime miss the
   * compiler cannot see: the map's value is `keyof ResidueRowFacts`, and a
   * stale entry would simply be a different, still-valid key. This joins the
   * map to a real row object, which is the only thing that catches it. */
  const named = ROW_FACT_FOR_DIMENSION.normalisedDescriptions
  assert.equal(named, 'normalisedDescriptionValue')

  const r = row(SHOWN)
  assert.equal(Object.hasOwn(r, named), true)
  assert.equal(r[named], SHOWN)
  assert.equal(Object.hasOwn(r, 'normalisedDescriptionId'), false)
})

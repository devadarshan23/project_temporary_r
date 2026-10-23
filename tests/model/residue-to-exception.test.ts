/**
 * G228 / #247 [W-12] — THE REGISTER'S OWN OPEN-A-FINDING TRANSITION, AT LINE
 * GRAIN.
 *
 * ┌─ THE GAP THIS FILE MEASURES (MG14) ────────────────────────────────────────┐
 * │ An `Exception` is addressed at DOCUMENT grain: `matchGroupId` and `ruleId`  │
 * │ are both REQUIRED on it. A residue entry is addressed at LINE grain by an   │
 * │ `ItemRef` — `(sourceDocumentId, lineIndex)`. Nothing converted one to the   │
 * │ other, so a finding opened from a residue row could not carry its own       │
 * │ audit trail.                                                               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 G228 RULES THE SHAPE AND THIS FILE ENCODES THE RULING RATHER THAN THE
 * IMPLEMENTATION'S CONVENIENCE. A line-grain finding is a SECOND ROW TYPE beside
 * `Exception`, not a widening of it — because widening changes the meaning of
 * every existing `Exception` reader, and a type whose grain changes under its
 * readers is worse than a second type, which announces itself.
 *
 * ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT DECIDE. `FindingBasis`'s arity is
 * [W-14]'s, and G228 says so on itself. Nothing here asserts that the new row
 * type reaches `standingFor()`, and nothing here adds a basis member. Two
 * independent answers to one question is §5.3's two-vocabularies defect arriving
 * by another door.
 *
 * §1 carries assertions that PASS AT BASE — that `Exception` requires
 * `matchGroupId` and `ruleId`, and that `ItemRef` carries `lineIndex` — so that
 * the red run is legible as a missing conversion rather than as a wall of
 * identical import failures.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runSetReconciliation, openLineFinding } from '../../model/reconciliation.ts'
import type {
  AssertNoTextDeep,
  ItemRef,
  LineFinding,
  LineFindingRefusal,
  PopulationBinding,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type {
  DataClass,
  Exception,
  ExtractedLine,
  ExtractedScalar,
  ExtractedValue,
  Money,
  PairingStrategy,
  Provenance,
  SourceDocument,
} from '../../model/domain.ts'
import type {
  DocumentTypeId,
  FieldPath,
  FieldPathKey,
  RunId,
  SourceDocumentId,
  TenantId,
} from '../../model/kernel.ts'
import { parseFieldPath, fieldPathKey } from '../../model/field-path.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ENGINE_TEXT = readFileSync(join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')
const DOMAIN_TEXT = readFileSync(join(REPO_ROOT, 'model', 'domain.ts'), 'utf8')

/* G214 — a `FieldPath` is a token list minted only by the seam. */
function p(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`fixture declares an unparseable FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}
const k = (path: FieldPath): FieldPathKey => fieldPathKey(path)

/* ==================================================================== *
 * THE FIXTURE — two rows that CANNOT pair, so both reach the residue
 *
 * Different references, different amounts. `exact_identifier` finds no join, so
 * each side lands in the residue as `no_strategy_paired` at LINE grain — which
 * is the exact row an operator opens a finding from.
 * ==================================================================== */

const TENANT = 'tenant-residue-to-finding-fixture' as TenantId
const DOC_TYPE = 'doctype-residue-to-finding-fixture' as DocumentTypeId
const RUN = 'run-residue-to-finding-fixture' as RunId

const AMOUNT_PATH: FieldPath = p('invoice', 'total')
const DATE_PATH: FieldPath = p('date')
const REF_PATH: FieldPath = p('reference')

const CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<FieldPathKey, DataClass>([
  [k(AMOUNT_PATH), 'internal'],
  [k(DATE_PATH), 'internal'],
  [k(REF_PATH), 'internal'],
])

const LEFT_DOC = 'doc-ledger-residue-to-finding' as SourceDocumentId
const RIGHT_DOC = 'doc-statement-residue-to-finding' as SourceDocumentId

/** The line the left row sits on. The whole point is that this survives. */
const LEFT_LINE = 0

function value(scalar: ExtractedScalar, confidence: number | null): ExtractedValue {
  const provenance: Provenance = { page: null, boundingBox: null, confidence }
  return { scalar, provenance }
}

function sgd(minor: bigint): Money {
  return { currency: 'SGD', amountMinor: minor, exponent: 2 }
}

function row(index: number, reference: string, minor: bigint): ExtractedLine {
  return {
    index,
    fields: {
      [k(AMOUNT_PATH)]: value({ kind: 'money', value: sgd(minor) }, 1),
      [k(DATE_PATH)]: value({ kind: 'date', value: '2026-03-03' }, 1),
      [k(REF_PATH)]: value({ kind: 'identifier', value: reference }, 1),
    },
  }
}

function documentOf(docId: SourceDocumentId, lines: readonly ExtractedLine[]): SourceDocument {
  return {
    tenantId: TENANT,
    id: docId,
    documentTypeId: DOC_TYPE,
    filename: `${docId}.csv`,
    storageRef: `fixture://${docId}`,
    extracted: {},
    lines: [...lines],
    controlTotal: { kind: 'not_declared_by_format' },
    ingestedAt: '2026-04-01T09:00:00.000Z',
    synthetic: true,
    purgeAfter: '2033-04-01T09:00:00.000Z',
    purgedAt: null,
  }
}

function population(): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE,
      amount: AMOUNT_PATH,
      date: DATE_PATH,
      identifiers: [REF_PATH],
    },
    carriesControlTotal: 'never',
    emptyExpectation: 'refuses',
    declaredUnit: { currency: 'SGD', exponent: 2 },
    normalisation: { ops: [], then: 'exact', maxInputChars: 64 },
    counterparty: null,
    description: null,
  }
}

function inputOf(): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'exact_identifier', on: REF_PATH }
  return {
    runId: RUN,
    tenantId: TENANT,
    left: population(),
    right: population(),
    leftDocuments: [documentOf(LEFT_DOC, [row(LEFT_LINE, 'INV-7001', 250_00n)])],
    rightDocuments: [documentOf(RIGHT_DOC, [row(0, 'INV-8002', 310_00n)])],
    pairing: {
      cardinality: 'one_to_one',
      amountTolerance: { kind: 'rounding', minorUnits: 0 },
      dateTolerance: { kind: 'days', value: 0 },
      strategies: [strategy],
    },
    strategyBindings: [{ strategy, amountTolerance: null, amountAnchor: 'exact' }],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    fieldClassification: CLASSIFICATION,
    modelPromptEligible: new Set<FieldPathKey>(),
    confidenceFloors: new Map<FieldPathKey, number>(),
    subsetSumBound: { maxMembers: 8, stepBudget: 5000, maxBucketSize: 50 },
    readerCandidateCap: 4,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    admissionRefusalCeilingBasisPoints: 9_999,
  }
}

function resultOf(): SetReconciliationResult {
  const outcome = runSetReconciliation(inputOf())
  if (!outcome.ok) throw new Error(`fixture refused: ${outcome.refusal.kind}`)
  return outcome.result
}

const LEFT_REF: ItemRef = { sourceDocumentId: LEFT_DOC, lineIndex: LEFT_LINE }

/* ==================================================================== *
 * §1  THE BASE FACTS — these pass BEFORE the conversion exists
 *
 * They are here so the red run reads as *"there is no conversion"* rather than
 * as *"nothing in this file compiles"*.
 * ==================================================================== */

test('test_an_Exception_is_addressed_at_document_grain_and_requires_a_match_group_and_a_rule', () => {
  /* Not optional, not nullable. A residue row has neither, which is the whole
   * of MG14. Asserted as a TYPE so a later widening of `Exception` — the change
   * G228 refused — fails here rather than passing quietly. */
  type RequiredKeys = 'matchGroupId' | 'ruleId'
  type _MatchGroupIsRequired = Exception[RequiredKeys] extends undefined ? never : true
  const _proof: _MatchGroupIsRequired = true
  assert.equal(_proof, true)

  const block = DOMAIN_TEXT.slice(DOMAIN_TEXT.indexOf('export interface Exception extends TenantScoped'))
  const head = block.slice(0, block.indexOf('\n}'))
  for (const field of ['matchGroupId: MatchGroupId', 'ruleId: RuleId']) {
    assert.ok(
      head.includes(field),
      `\`Exception\` no longer declares \`${field}\`. G228 refused the widening; ` +
        'if it happened anyway, this file is the wrong place to find out.',
    )
    assert.equal(
      head.includes(`${field.split(':')[0]}?:`),
      false,
      `\`${field}\` became OPTIONAL — that is the widening G228 ruled against.`,
    )
  }
})

test('test_a_residue_row_is_addressed_at_line_grain_by_an_ItemRef_that_carries_the_line_index', () => {
  const result = resultOf()
  const left = result.residue.filter((entry) => entry.side === 'left')
  assert.equal(left.length, 1, 'the fixture puts exactly one left row in the residue')
  const [entry] = left
  assert.ok(entry !== undefined)
  assert.equal(entry.ref.sourceDocumentId, LEFT_DOC)
  assert.equal(entry.ref.lineIndex, LEFT_LINE)
})

/* ==================================================================== *
 * §2  THE CONVERSION — it carries the line, and it announces its grain
 * ==================================================================== */

test('test_a_finding_opened_from_a_residue_row_carries_the_line_it_came_from', () => {
  const result = resultOf()
  const outcome = openLineFinding(result, RUN, 'left', LEFT_REF)
  assert.equal(outcome.ok, true, 'the fixture row exists; the conversion must not refuse it')
  if (!outcome.ok) return

  /* THE ASSERTION MG14 IS ABOUT. All three components of the address survive. */
  assert.equal(outcome.finding.side, 'left')
  assert.equal(outcome.finding.ref.sourceDocumentId, LEFT_DOC)
  assert.equal(outcome.finding.ref.lineIndex, LEFT_LINE)

  /* G228 — the second type ANNOUNCES ITSELF. A heterogeneous register can tell
   * a line-grain row from a document-grain one without inspecting its fields. */
  assert.equal(outcome.finding.grain, 'line')
  assert.equal(outcome.finding.runId, RUN)
  assert.equal(outcome.finding.cause.kind, 'no_strategy_paired')
  assert.equal(outcome.finding.disposition, 'unidentified')
})

test('test_the_lazy_repair_is_refused_no_match_group_id_is_synthesised_anywhere_and_no_line_index_is_dropped', () => {
  /* 🛑 THE LIKELIEST WRONG ANSWER, NAMED, AND THIS CASE FAILS ON IT ALONE.
   * Synthesise a `matchGroupId` from the source document and drop the
   * `lineIndex`: it typechecks, it satisfies `Exception`'s required fields, and
   * invariant 10's audit trail degrades to a document pointer — the finding
   * says *"something in this file"* where the engine knew which line. */
  const code = ENGINE_TEXT.split('\n')
    .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
    .join('\n')
  assert.equal(
    (code.match(/matchGroupId/g) ?? []).length,
    0,
    'a `matchGroupId` appears in the engine. There is nothing here to derive one FROM — ' +
      'a residue row has no match group — so any occurrence is a synthesis, which is a ' +
      'fabricated fact on the one row an auditor reads.',
  )

  /* The other half of the same repair: the address must not be narrowed to the
   * document. A finding that resolves to a file is not a finding at line grain. */
  const result = resultOf()
  const outcome = openLineFinding(result, RUN, 'left', LEFT_REF)
  assert.equal(outcome.ok, true)
  if (!outcome.ok) return
  assert.notEqual(
    outcome.finding.ref.lineIndex,
    null,
    'the line index was dropped. The engine knew which line; the finding must too.',
  )
})

/* ==================================================================== *
 * §3  THE REFUSAL — an address that names no row does not become a finding
 * ==================================================================== */

test('test_a_residue_row_that_does_not_exist_refuses_rather_than_fabricating_one', () => {
  const result = resultOf()

  /* A ref the run never produced. `/close/finding/:ref` is addressed by the
   * caller, so this is the shape a stale link or a hand-typed address takes. */
  const unknown: ItemRef = { sourceDocumentId: LEFT_DOC, lineIndex: 41 }
  const outcome = openLineFinding(result, RUN, 'left', unknown)
  assert.equal(outcome.ok, false, 'an address that names no residue row must not yield a finding')
  if (outcome.ok) return
  assert.equal(outcome.refusal.kind, 'no_such_residue_row')

  /* The SIDE is part of the address, not decoration: the same line index on the
   * other side is a different row and must not be reached by accident. */
  const wrongSide = openLineFinding(result, RUN, 'right', LEFT_REF)
  assert.equal(wrongSide.ok, false)
  if (wrongSide.ok) return
  assert.equal(wrongSide.refusal.kind, 'no_such_residue_row')
})

test('test_an_address_naming_more_than_one_residue_row_refuses_rather_than_picking_the_first', () => {
  /* 🛑 A NAMED NEGATIVE CONTROL, IN THIS MODULE'S OWN IDIOM. `admitPopulation`
   * refuses a duplicated address at §4a, so `runSetReconciliation` cannot
   * produce this — the arm exists because picking the first of two rows at one
   * address is a silent choice about which finding an operator opens, and a
   * refusal that names the wrong cause is worse than one nobody sees.
   * `MoneyRefusal.no_items` is the same shape for the same reason. */
  const result = resultOf()
  const [entry] = result.residue.filter((e) => e.side === 'left')
  assert.ok(entry !== undefined)
  const doubled: SetReconciliationResult = { ...result, residue: [...result.residue, entry] }

  const outcome = openLineFinding(doubled, RUN, 'left', LEFT_REF)
  assert.equal(outcome.ok, false)
  if (outcome.ok) return
  assert.equal(outcome.refusal.kind, 'residue_row_not_unique')
})

/* ==================================================================== *
 * §4  CONTAINMENT — the inverted allow-list, not the shallow form
 *
 * G146 inverted `AssertNoTextDeep` to an allow-list of value-free leaves. The
 * conversion carries REFS and engine vocabulary; the document behind the row is
 * counterparty content and never travels with it.
 * ==================================================================== */

// The proof itself. No `@ts-expect-error`: this must COMPILE.
export type _LineFindingIsContained = AssertNoTextDeep<LineFinding>
export type _LineFindingRefusalIsContained = AssertNoTextDeep<LineFindingRefusal>

// @ts-expect-error — a filename on the finding is counterparty content, and the
// proof must reject it. If this directive ever goes unused the containment
// assertion has stopped biting.
export type _AFilenameOnTheFindingFails = AssertNoTextDeep<LineFinding & { readonly filename: string }>

test('test_the_conversion_carries_no_money_and_no_field_path_and_says_why_rather_than_omitting_them', () => {
  /* 🛑 THE TWO OMISSIONS ARE FORCED BY THE PROOF, NOT CHOSEN FOR BREVITY, and
   * they are asserted so that a later addition has to answer this test.
   *
   *   • `Money.currency` is a bare `string`, so a settlement on this row is a
   *     `TS2344`. The amount is on the residue row, read through
   *     `listRunResidue` under the same capability; carrying it here would mint
   *     a second representation of one number (G111) as well as breaking the
   *     proof.
   *   • `HeldRead.path` is a `FieldPath`, whose `key` segment is a bare
   *     `string`. Same argument, and `HeldRead` already carries it in the
   *     module with its own banner saying so.
   */
  const result = resultOf()
  const outcome = openLineFinding(result, RUN, 'left', LEFT_REF)
  assert.equal(outcome.ok, true)
  if (!outcome.ok) return
  assert.deepEqual(Object.keys(outcome.finding).sort(), [
    'cause',
    'disposition',
    'grain',
    'ref',
    'runId',
    'side',
  ])
})

test('test_the_conversion_is_pure_and_takes_no_tenant', () => {
  /* Invariant 1 — tenant scope is DERIVED FROM THE SESSION, never read from a
   * request, and never carried by a pure derivation. `LineFinding` deliberately
   * does not extend `TenantScoped`: the engine has no clock and no identity, so
   * the persisted row is minted by a writer inside `withTenantScope()` and the
   * id, the tenant and the timestamps are that writer's, not this function's. */
  const block = ENGINE_TEXT.slice(
    ENGINE_TEXT.indexOf('export function openLineFinding'),
    ENGINE_TEXT.indexOf('export function openLineFinding') + 600,
  )
  assert.equal(
    /tenantId|TenantScoped/.test(block.slice(0, block.indexOf('{'))),
    false,
    '`openLineFinding` took a tenant. A pure derivation that takes one invites a caller to ' +
      'pass a tenant read off a request, which is exactly what invariant 1 forbids.',
  )
  const declaration = ENGINE_TEXT.slice(ENGINE_TEXT.indexOf('export interface LineFinding {'))
  assert.equal(
    declaration.slice(0, declaration.indexOf('\n}')).includes('tenantId'),
    false,
    '`LineFinding` gained a `tenantId`. Scope is the session\'s to establish.',
  )
})

/**
 * THE BREADTH PASS OVER `model/reconciliation.ts` — every export named, every
 * runtime export INVOKED, and an honest coverage number derived rather than
 * claimed.
 *
 * WHAT THIS FILE IS FOR. `model/reconciliation.ts` landed with 100 exports and
 * no construction site anywhere — `docs/HANDOFF.md` §5.10 at the largest scale
 * in this record. Two sibling suites (`tests/model/reconciliation-*.test.ts`)
 * assert specific behaviours deeply. This one asks a different question:
 * WHICH EXPORTS HAS ANYTHING AT ALL EVER RUN? It drives the corpus in
 * `tests/scenarios/recon-corpus.ts` across the twelve exception topologies and
 * then reaches, by direct call, the helpers no end-to-end run can touch.
 *
 * 🛑 THE COVERAGE NUMBER IS OBSERVED, NOT DECLARED, AND THAT IS THE POINT.
 * There is no hand-written list of "exports we tested". Instead:
 *
 *   1. the export list is PARSED FROM `model/reconciliation.ts` ON DISK at run
 *      time, and the parse asserts that every `^export ` line was understood —
 *      a regex that silently skipped a declaration would otherwise shrink the
 *      denominator and inflate the score;
 *   2. every call site below is wrapped in `used(name, expression)`, which
 *      records the name only AFTER the expression has been evaluated, so the
 *      register is a record of INVOCATIONS and not of intentions;
 *   3. `test_every_runtime_export_of_the_module_was_invoked_by_a_constructed_value`
 *      compares the two sets in BOTH directions and fails on either a runtime
 *      export nobody called or a register entry naming something the module no
 *      longer exports.
 *
 * ⚠️ WHAT THIS FILE DOES NOT AND CANNOT COVER, stated so nobody reads the
 * denominator as a promise. Of the module's exports, only the `function` and
 * `const` declarations have runtime behaviour a value can observe. The rest are
 * `type` and `interface` declarations — including the `_…HoldsNoText` family,
 * which are COMPILE-TIME obligations discharged by `tsc -p tests/tsconfig.json`
 * and by nothing in here. Their arms are inhabited by values below and their
 * discriminants are asserted, but the declarations themselves are not
 * "exercised" and this file never counts them as such. `KNOWN_GAPS` in the
 * corpus lists what else is owed; read it before quoting a number from here.
 *
 * ⚠️ NOTHING BELOW WAS PRODUCED BY RUNNING THE ENGINE AND PASTING THE OUTPUT
 * BACK. Every expected value comes from `tests/scenarios/recon-corpus.ts`,
 * whose header records that its expectations were hand-traced from the
 * specification before anything executed — `docs/HANDOFF.md` §5.6. Where this
 * file states an expectation of its own it is a literal typed here, derived
 * from the rule quoted beside it.
 *
 * ⚠️ `refusesCrossTenantDocuments` IS NOT A TENANT-ISOLATION TEST. The module
 * says of itself that the tenant is carried FOR REFUSAL, never for scope, and
 * that this check is the weaker of two lines — G100's deny-on-NULL RLS plus
 * G101 is the real enforcement. Do not cite the green tick below as isolation
 * evidence.
 *
 * NOTHING HERE PRICES ANYTHING (invariant 5). The meter assertions read a
 * meter, a quantity, an idempotency key and a catalogue row id, and the
 * `MeterFact` key-set assertion exists precisely so that a price field added
 * later fails this file rather than passing through it.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  accountLedgerWrite,
  addMoney,
  admitPopulation,
  allocatedOf,
  applyAllocation,
  applyExtraction,
  applyReaderVerdicts,
  buildReaderRequests,
  checkPopulationIntegrity,
  documentAccounts,
  defectDocument,
  presentedRowCount,
  checkPostconditions,
  compareMoney,
  EXTRACTION_OP_KINDS,
  guardMoney,
  guardUnit,
  isNegativeMoney,
  isPositiveMoney,
  isZeroMoney,
  itemKey,
  LEARNED_RULE_ACTION,
  levenshteinBasisPoints,
  minMoney,
  minorUnitsOf,
  notImplementedReader,
  parseCalendarDate,
  passAmountAndDate,
  passAmountSum,
  passFuzzyReference,
  passIdentifierJoin,
  POPULATION_DEFECT_DISPOSITION,
  POPULATION_DEFECT_KINDS,
  POSTCONDITION_PROPERTY,
  terminalRunStatus,
  openLineFinding,
  proposeResidueDispositions,
  residualOf,
  runMeterFact,
  runSetReconciliation,
  SIMILARITY_MAX_CHARS_CEILING,
  settlementOf,
  subtractMoney,
  toleranceAdmits,
  tokenMeterFacts,
  validateNormalisation,
  valueAtRiskOf,
  zeroLike,
  UNIQUENESS_SCOPES,
  evaluateUniqueWithin,
  uniquenessConflictPinning,
  uniquenessPreflight,
} from '../../model/reconciliation.ts'
import type {
  Allocation,
  AllocationOutcome,
  AmbiguityFinding,
  ItemRef,
  ItemSettlement,
  LearnedDispositionRule,
  MoneyRefusal,
  MoneyUnit,
  PairingEvidence,
  PassOutcome,
  ReaderTokenUsage,
  ResidueEntry,
  SearchBoundary,
  SearchBoundaryEntry,
  SetReconciliationResult,
  SubjectDigest,
  ToleranceDecline,
} from '../../model/reconciliation.ts'
import type { Disposition } from '../../model/domain.ts'
import type { FieldPath, RunId } from '../../model/kernel.ts'
import type { LearningEntryId } from '../../model/learning.ts'
import type { AutonomyConfig } from '../../model/policy.ts'

import {
  admittedStateFor,
  ALLOCATION_PROBES,
  AMOUNT_AND_DATE_PROBES,
  AMOUNT_SUM_PROBES,
  CALENDAR_ANCHOR_VECTORS,
  CALENDAR_GAP_VECTORS,
  CALENDAR_VECTORS,
  cleanIdentifierMatch,
  EXTRACTION_OP_KINDS_COVERED,
  EXTRACTION_VECTORS,
  freeTextMultiEntityBuildsAReaderRequest,
  fuzzyTieIsAnAmbiguity,
  typoAmountAnchoredFuzzy,
  FUZZY_PROBES,
  IDENTIFIER_JOIN_PROBES,
  ITEM_KEY_VECTORS,
  KNOWN_DISAGREEMENTS_AT_HEAD,
  leftoverCashLandsInResidue,
  MONEY_PREDICATE_VECTORS,
  MONEY_VECTORS,
  NORMALISATION_DEFECT_VECTORS,
  PATHS,
  POSTCONDITION_PROBES,
  READER_VECTORS,
  headerAndLinesTogetherIsCounted,
  missingTrailerOnAFormatThatCarriesOneRefuses,
  REFUSAL_SCENARIOS,
  refusesDuplicateLineIndexInOnePopulation,
  refusesMixedAdmittedAndRefusedAtOneAddress,
  refusalRateAboveTheStatedCeilingRefuses,
  refusesRedeliveredDocumentOnTheRightSide,
  truncatedShredIsCaughtByTheTrailer,
  wholeRunRefusedStillProducesTheResidue,
  bothCopiesRefusedIsStillTheNamedOutcome,
  RUN_METER_VECTOR,
  SCENARIOS,
  SIMILARITY_VECTORS,
  SYNTHETIC_CATALOGUE_ROW,
  TOKEN_METER_VECTORS,
  TOLERANCE_VECTORS,
  twoCurrenciesNeverMatchAcross,
} from './recon-corpus.ts'
import type {
  ExpectedAmbiguity,
  ExpectedPassOutcome,
  ExpectedSearchBoundary,
  ExpectedSearchBoundaryEntry,
  ExpectedToleranceDecline,
  ExpectedSettlement,
  ItemAddress,
  Scenario,
} from './recon-corpus.ts'

/* ====================================================================== *
 * §0  THE REGISTER — what "exercised" means here, mechanically
 * ====================================================================== */

const TOUCHED = new Set<string>()

/* G228. A run id for the conversion, which takes one rather than reading it off
 * a result — the engine has no identity, so the caller supplies the run's. */
const RESIDUE_FINDING_RUN = 'run_SYN_0007' as RunId

/**
 * Records `name` AFTER `value` has been evaluated, and returns the value.
 *
 * The argument order is load-bearing: JavaScript evaluates the argument before
 * entering the function, so `used('addMoney', addMoney(a, b))` cannot register
 * a name without the call having happened. A `TOUCHED.add()` written NEXT TO a
 * call would register on a line that was reached; this registers on a call that
 * RETURNED. That distinction is the difference between a coverage number and a
 * coverage claim.
 */
function used<T>(name: string, value: T): T {
  TOUCHED.add(name)
  return value
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MODULE_PATH = join(REPO_ROOT, 'model', 'reconciliation.ts')

interface ExportCensus {
  /** `export function` and `export const` — the declarations with behaviour. */
  readonly runtime: readonly string[]
  /** `export type` and `export interface` — no behaviour a value can observe. */
  readonly typeLevel: readonly string[]
  /** The `_…` type-level assertions, discharged by `tsc` and by nothing here. */
  readonly compileTimeAssertions: readonly string[]
  /**
   * ⚠️ NEW ON 19 Sep 2026 — G286/G111, AND IT IS KEPT OUT OF `runtime`
   * DELIBERATELY. `model/reconciliation.ts` §3 moved to `model/money.ts` and is
   * RE-EXPORTED from its old home, so every caller resolves the money surface at
   * the name it has always used. Those names are exported BY this module and
   * declared by another.
   *
   * 🛑 COUNTING THEM AS `runtime` WOULD INFLATE THE DENOMINATOR AND THEN THE
   * SCORE, WHICH IS EXACTLY WHAT THE `unparsed` CONTROL ABOVE EXISTS TO PREVENT
   * IN THE OTHER DIRECTION. This file exercises the ENGINE; the codec is
   * exercised by `tests/model/money-codec.test.ts`, against the corpus's
   * `MONEY_CODEC_VECTORS`. So the bucket is named, asserted non-empty, and
   * checked against `model/money.ts`'s own declarations — but the coverage
   * number stays a statement about what this module DECLARES.
   */
  readonly reExported: readonly string[]
  /** The same, for names re-exported as TYPES. Out of `typeLevel` for the same reason. */
  readonly reExportedTypes: readonly string[]
  /**
   * ⚠️ STATEMENTS, NOT NAMES, AND THE DISTINCTION IS WHAT KEEPS
   * *"every counted export line is classified exactly once"* TRUE. `exportLines`
   * counts LINES beginning `export `; a re-export block is ONE such line and
   * carries nineteen names. Classifying it by name made the two sides of that
   * assertion 179 and 159 — the control firing correctly on a parse that had
   * quietly started counting a different thing.
   */
  readonly reExportStatements: number
  readonly exportLines: number
}

/**
 * The denominator, read from the tree rather than typed here.
 *
 * ⚠️ `unparsed` is the control that matters. `CLAUDE.md` records that a grep
 * over this repository has been wrong in its own right more than once, and a
 * declaration this regex failed to understand would silently leave the
 * denominator and make the coverage number look better. It is asserted to be
 * zero rather than logged.
 */
function census(path = MODULE_PATH): ExportCensus & { readonly unparsed: readonly string[] } {
  const source = readFileSync(path, 'utf8')
  const runtime: string[] = []
  const typeLevel: string[] = []
  const compileTimeAssertions: string[] = []
  const reExported: string[] = []
  const reExportedTypes: string[] = []
  let reExportStatements = 0
  const unparsed: string[] = []
  let exportLines = 0

  /* ⚠️ A RE-EXPORT BLOCK IS MULTI-LINE AND ONLY ITS FIRST LINE STARTS WITH
   * `export`, so the scan carries one bit of state rather than growing a regex
   * that would have to understand the whole grammar. `inReExport` is the form
   * the block opened with: a `type` block contributes type-level names, a value
   * block contributes re-exported runtime names. */
  let inReExport: 'type' | 'value' | null = null

  for (const raw of source.split('\n')) {
    if (inReExport !== null) {
      if (raw.startsWith('}')) {
        inReExport = null
        continue
      }
      const name = /^\s*([A-Za-z_][A-Za-z0-9_]*),?\s*$/.exec(raw)
      if (name === null || name[1] === undefined) continue
      if (inReExport === 'value') reExported.push(name[1])
      else reExportedTypes.push(name[1])
      continue
    }
    if (!raw.startsWith('export ')) continue
    exportLines += 1
    /* `export type { A, B } from './x'` and `export { a, b } from './x.ts'`,
     * one line or many. Named rather than swept into `unparsed`: an unparsed
     * line is a finding, and these are a declared shape. */
    const inlineReExport = /^export (type )?\{([^}]*)\} from /.exec(raw)
    if (inlineReExport !== null) {
      const names = (inlineReExport[2] ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
      if (inlineReExport[1] === undefined) reExported.push(...names)
      else reExportedTypes.push(...names)
      reExportStatements += 1
      continue
    }
    const openReExport = /^export (type )?\{\s*$/.exec(raw)
    if (openReExport !== null) {
      inReExport = openReExport[1] === undefined ? 'value' : 'type'
      reExportStatements += 1
      continue
    }
    const match = /^export (function|const|type|interface) ([A-Za-z_][A-Za-z0-9_]*)/.exec(raw)
    if (match === null) {
      unparsed.push(raw)
      continue
    }
    const form = match[1]
    const name = match[2]
    if (form === undefined || name === undefined) {
      unparsed.push(raw)
      continue
    }
    if (form === 'function' || form === 'const') runtime.push(name)
    else {
      typeLevel.push(name)
      if (name.startsWith('_')) compileTimeAssertions.push(name)
    }
  }
  return {
    runtime,
    typeLevel,
    compileTimeAssertions,
    reExported,
    reExportedTypes,
    reExportStatements,
    exportLines,
    unparsed,
  }
}

const CENSUS = census()
/** G286/G111 — the codec the re-exports come from, read the same way. */
const CODEC_CENSUS = census(join(REPO_ROOT, 'model', 'money.ts'))

/* ====================================================================== *
 * §1  COMPARISON HELPERS — a failure must name the row, not just fail
 * ====================================================================== */

/* G217 — one projection for the engine's shape, one for the corpus's. */
function boundaryShape(boundary: SearchBoundary): Record<string, unknown> {
  const channel = (entries: readonly SearchBoundaryEntry[]): unknown[] =>
    entries.map((entry) => ({ itemCount: entry.itemCount, exampleRef: refShape(entry.exampleRef) }))
  return {
    oversizedBuckets: channel(boundary.oversizedBuckets),
    exhaustedSearches: channel(boundary.exhaustedSearches),
    oversizedAmountBuckets: channel(boundary.oversizedAmountBuckets),
  }
}

/* G291 — the second tolerance channel, projected the same way. The variance is
 * rendered as a decimal string, which is how G65 puts money on the wire and how
 * every other `bigint` on this comparison surface is spelled. */
function declineShape(declines: readonly ToleranceDecline[]): unknown[] {
  return declines.map((d) => ({
    leftItemCount: d.leftItemCount,
    rightItemCount: d.rightItemCount,
    signedVarianceMinor: d.signedVarianceMinor,
    exampleRef: refShape(d.exampleRef),
  }))
}

function statedDeclineShape(stated: readonly ExpectedToleranceDecline[]): unknown[] {
  return stated.map((d) => ({
    leftItemCount: d.leftItemCount,
    rightItemCount: d.rightItemCount,
    signedVarianceMinor: d.signedVarianceMinor,
    exampleRef: refShape(d.example.ref),
  }))
}

function statedBoundaryShape(stated: ExpectedSearchBoundary): Record<string, unknown> {
  const channel = (entries: readonly ExpectedSearchBoundaryEntry[]): unknown[] =>
    entries.map((entry) => ({
      itemCount: entry.itemCount,
      exampleRef: refShape(entry.example.ref),
    }))
  return {
    oversizedBuckets: channel(stated.oversizedBuckets),
    exhaustedSearches: channel(stated.exhaustedSearches),
    oversizedAmountBuckets: channel(stated.oversizedAmountBuckets),
  }
}

function addressKey(address: ItemAddress): string {
  return used('itemKey', itemKey(address.side, address.ref))
}

function settlementShape(settlement: ItemSettlement | null): ExpectedSettlement | null {
  if (settlement === null) return null
  if (settlement.kind === 'unallocated') {
    return {
      kind: 'unallocated',
      allocatedMinor: null,
      residualMinor: used('minorUnitsOf', minorUnitsOf(settlement.residual)),
    }
  }
  if (settlement.kind === 'fully_allocated') {
    return {
      kind: 'fully_allocated',
      allocatedMinor: used('minorUnitsOf', minorUnitsOf(settlement.allocated)),
      residualMinor: null,
    }
  }
  return {
    kind: 'partially_allocated',
    allocatedMinor: used('minorUnitsOf', minorUnitsOf(settlement.allocated)),
    residualMinor: used('minorUnitsOf', minorUnitsOf(settlement.residual)),
  }
}

function expectedSettlementShape(expected: ExpectedSettlement | null): ExpectedSettlement | null {
  if (expected === null) return null
  return {
    kind: expected.kind,
    allocatedMinor: expected.allocatedMinor,
    residualMinor: expected.residualMinor,
  }
}

function refShape(ref: ItemRef): { readonly document: string; readonly lineIndex: number | null } {
  return { document: ref.sourceDocumentId, lineIndex: ref.lineIndex }
}

function ambiguityShape(finding: AmbiguityFinding): Record<string, unknown> {
  return {
    on: finding.on,
    strategyKind: finding.strategyKind,
    leftCandidates: finding.leftCandidates,
    rightCandidates: finding.rightCandidates,
    leftRefs: finding.leftRefs.map(refShape),
    rightRefs: finding.rightRefs.map(refShape),
  }
}

function expectedAmbiguityShape(expected: ExpectedAmbiguity): Record<string, unknown> {
  return {
    on: expected.on,
    strategyKind: expected.strategyKind,
    leftCandidates: expected.leftCandidates,
    rightCandidates: expected.rightCandidates,
    leftRefs: expected.leftRefs.map(refShape),
    rightRefs: expected.rightRefs.map(refShape),
  }
}

/**
 * Reduces a result to the shape the corpus states an expectation about.
 *
 * Deliberately NOT a partial comparison. Asserting only the allocation count
 * would pass on an allocation of the right size between the wrong two rows,
 * which is the failure mode that moves money to the wrong account.
 */
function resultShape(result: SetReconciliationResult): Record<string, unknown> {
  return {
    allocations: result.state.allocations.map((allocation) => ({
      fromKey: allocation.fromKey,
      toKey: allocation.toKey,
      amountMinor: used('minorUnitsOf', minorUnitsOf(allocation.amount)),
      evidence: allocation.evidence,
    })),
    ambiguities: result.ambiguities.map(ambiguityShape),
    refusedAtAdmission: result.refusedAtAdmission.map((refused) => ({
      side: refused.side,
      ref: refShape(refused.ref),
      path: refused.path,
      refusal: refused.refusal,
    })),
    residue: result.residue.map((entry) => ({
      side: entry.side,
      ref: refShape(entry.ref),
      settlement: settlementShape(entry.settlement),
      cause: entry.cause,
      disposition: entry.disposition,
    })),
    readerRequests: result.readerRequests.map((request) => ({
      requestOrdinal: request.requestOrdinal,
      subjectRef: refShape(request.subjectRef),
      untrustedDescription: request.untrustedDescription,
      untrustedDescriptionClass: request.untrustedDescriptionClass,
      candidates: request.candidates.map((candidate) => ({
        index: candidate.index,
        ref: refShape(candidate.ref),
        identifierForPrompt: candidate.identifierForPrompt,
      })),
    })),
    toleranceRefusals: [...result.toleranceRefusals],
    /* G291 — the other tolerance channel, stated separately because a REFUSAL
     * and a DECLINE are two findings with two different fixes. */
    toleranceDeclines: declineShape(result.toleranceDeclines),
    /* G217 — three channels, counts and addresses. The old line exported one
     * channel of counterparty-authored bucket keys onto a comparison surface. */
    searchBoundary: boundaryShape(result.searchBoundary),
    postconditions: [...result.postconditions],
    meterFacts: result.meterFacts.map((fact) => ({ meter: fact.meter, quantity: fact.quantity })),
  }
}

function expectationShape(scenario: Scenario): Record<string, unknown> {
  const expect = scenario.expect
  return {
    allocations: expect.allocations.map((allocation) => ({
      fromKey: addressKey(allocation.from),
      toKey: addressKey(allocation.to),
      amountMinor: allocation.amountMinor,
      evidence: allocation.evidence,
    })),
    ambiguities: expect.ambiguities.map(expectedAmbiguityShape),
    refusedAtAdmission: expect.refusedAtAdmission.map((refused) => ({
      side: refused.item.side,
      ref: refShape(refused.item.ref),
      path: refused.path,
      refusal: refused.refusal,
    })),
    residue: expect.residue.map((entry) => ({
      side: entry.item.side,
      ref: refShape(entry.item.ref),
      settlement: expectedSettlementShape(entry.settlement),
      cause: entry.cause,
      disposition: entry.disposition,
    })),
    readerRequests: expect.readerRequests.map((request) => ({
      requestOrdinal: request.requestOrdinal,
      subjectRef: refShape(request.subject.ref),
      untrustedDescription: request.untrustedDescription,
      untrustedDescriptionClass: request.untrustedDescriptionClass,
      candidates: request.candidates.map((candidate) => ({
        index: candidate.index,
        ref: refShape(candidate.ref),
        identifierForPrompt: candidate.identifierForPrompt,
      })),
    })),
    toleranceRefusals: [...expect.toleranceRefusals],
    toleranceDeclines: statedDeclineShape(expect.toleranceDeclines),
    searchBoundary: statedBoundaryShape(expect.searchBoundary),
    postconditions: [...expect.postconditions],
    meterFacts: expect.meterFacts.map((fact) => ({ meter: fact.meter, quantity: fact.quantity })),
  }
}

function runOrFail(scenario: Scenario): SetReconciliationResult {
  const outcome = used('runSetReconciliation', runSetReconciliation(scenario.input))
  assert.equal(
    outcome.ok,
    true,
    `${scenario.name}: expected a result, got a run-level refusal ${JSON.stringify(
      outcome.ok ? null : outcome.refusal,
    )}`,
  )
  if (!outcome.ok) throw new Error('unreachable — the assertion above has already failed')
  return outcome.result
}

/** Scenario names the corpus itself records as disagreeing with the module. */
const DISAGREEING = new Set(KNOWN_DISAGREEMENTS_AT_HEAD.map((entry) => entry.scenario))

/* ====================================================================== *
 * §2  THE FOLD — all twelve topologies through `runSetReconciliation`
 * ====================================================================== */

for (const scenario of SCENARIOS) {
  if (DISAGREEING.has(scenario.name)) continue
  test(`test_scenario_${scenario.name}_matches_the_specification_the_corpus_states`, () => {
    const result = runOrFail(scenario)
    assert.deepStrictEqual(
      resultShape(result),
      expectationShape(scenario),
      `${scenario.name} — topology ${scenario.topology}\n${scenario.expect.summary}\n` +
        `derived from:\n  ${scenario.expect.derivedFrom.join('\n  ')}`,
    )
  })
}

/**
 * ✅ THE CHARACTERISATION TEST THAT USED TO LIVE HERE IS GONE, AS IT ASKED TO BE.
 *
 * It pinned a DEFECT rather than a requirement — `passFuzzyReference` raised an
 * `AmbiguityFinding` counting two tied candidates while naming one — and its own
 * failure message carried the handoff: "When it becomes 2, delete this test and
 * restore fuzzyTieIsAnAmbiguity to the sweep above."
 *
 * The module was fixed on 9 Aug 2026, the assertion failed exactly as designed,
 * and this is that instruction carried out. `KNOWN_DISAGREEMENTS_AT_HEAD` is now
 * empty, so `DISAGREEING` excludes nothing and the scenario is asserted the right
 * way round by the sweep above like every other.
 *
 * The pattern is worth keeping: a permanently red assertion teaches people to
 * ignore the suite, so a known defect is pinned by a test that goes RED ON BEING
 * FIXED. That is what happened here.
 */

/* ====================================================================== *
 * §3  RUN-LEVEL REFUSALS — every arm of `SetReconciliationRefusal`
 * ====================================================================== */

for (const scenario of REFUSAL_SCENARIOS) {
  test(`test_run_refuses_${scenario.name}`, () => {
    const outcome = used('runSetReconciliation', runSetReconciliation(scenario.input))
    assert.equal(outcome.ok, false, `${scenario.name}: expected a refusal, got a result`)
    if (outcome.ok) return
    assert.deepStrictEqual(outcome.refusal, scenario.expect, scenario.derivedFrom)
  })
}

/* ====================================================================== *
 * §3a  C17 — `checkPopulationIntegrity`, called directly
 *
 * The three refusal scenarios above prove the arm fires through the fold. These
 * reach the function itself, which is where the NARROWING and the ORDER live —
 * neither is observable from a refusal that carries one defect.
 * ====================================================================== */

function admittedAndRefusedOf(scenario: Scenario | { input: Scenario['input'] }, side: 'left' | 'right') {
  const input = scenario.input
  const context = {
    fieldClassification: input.fieldClassification,
    modelPromptEligible: input.modelPromptEligible,
    confidenceFloors: input.confidenceFloors,
  }
  return used(
    'admitPopulation',
    admitPopulation(
      side,
      side === 'left' ? input.leftDocuments : input.rightDocuments,
      side === 'left' ? input.left : input.right,
      context,
    ),
  )
}

test('test_checkPopulationIntegrity_reports_nothing_on_an_empty_population', () => {
  /* A population with no rows has no colliding addresses. Stated as a vector
   * because the walk builds three maps and an early return, and "returns []"
   * is the branch a rewrite is most likely to lose. */
  assert.deepStrictEqual(
    [...used('checkPopulationIntegrity', checkPopulationIntegrity({ side: 'left', admitted: [], refused: [], documents: [], carriesControlTotal: 'never', admissionRefusalCeilingBasisPoints: 0 }))],
    [],
  )
})

test('test_checkPopulationIntegrity_requires_at_least_one_admitted_copy', () => {
  /**
   * 🛑 THE NARROWING, ASSERTED FROM BOTH SIDES ON THE SAME FUNCTION.
   *
   * Two copies of one address where NEITHER was admitted is not a C17 defect:
   * neither copy reaches the fold, so no row can be overwritten, and the
   * collision already has a named outcome in `item_in_residue_twice`. One
   * admitted copy is enough, because one admitted copy is what the fold folds.
   */
  const bothRefused = admittedAndRefusedOf(bothCopiesRefusedIsStillTheNamedOutcome, 'left')
  assert.equal(bothRefused.admitted.length, 0, 'the fixture must admit neither copy')
  assert.equal(bothRefused.refused.length, 2, 'the fixture must refuse both copies at one address')
  assert.deepStrictEqual(
    [...checkPopulationIntegrity({ side: 'left', admitted: bothRefused.admitted, refused: bothRefused.refused, documents: [], carriesControlTotal: 'never', admissionRefusalCeilingBasisPoints: 0 })],
    [],
  )

  const mixed = admittedAndRefusedOf(refusesMixedAdmittedAndRefusedAtOneAddress, 'left')
  assert.equal(mixed.admitted.length, 1, 'the fixture must admit exactly one of the two copies')
  assert.equal(mixed.refused.length, 1, 'and refuse the other')
  const defects = checkPopulationIntegrity({
    side: 'left',
    admitted: mixed.admitted,
    refused: mixed.refused,
    /* C18 held out of the way: no documents, so no trailer to compare and the
     * only thing this vector can report is C17's collision.
     *
     * ⚠️ AND C13 HELD OUT OF THE WAY BY THE SAME FIELD, WHICH IS WHY THE CEILING
     * BELOW IS 0 AND NOT SOMETHING PERMISSIVE. `sideRowCount` is folded from the
     * DOCUMENTS, so an empty array means no denominator and no rate — asserted
     * here at the strictest ceiling the gate admits, so a rate arm that ever
     * started firing without a denominator would fail this vector rather than
     * hide behind a lenient number. */
    documents: [],
    carriesControlTotal: 'never',
    admissionRefusalCeilingBasisPoints: 0,
  })
  assert.equal(defects.length, 1)
  assert.equal(defects[0]?.kind, 'duplicate_item_address')
  assert.equal(
    defects[0]?.kind === 'duplicate_item_address' ? defects[0].occurrences : null,
    2,
    '`occurrences` counts admitted AND refused copies at the address — it is a property of the address',
  )
})

test('test_checkPopulationIntegrity_reports_every_colliding_address_in_first_seen_order', () => {
  /* Two distinct collisions in one population. The refusal arm carries a LIST
   * for exactly this reason: a population reports every defect it has rather
   * than the first, so an operator re-cuts one file instead of discovering the
   * second collision on the next run. */
  const doubled = admittedAndRefusedOf(refusesDuplicateLineIndexInOnePopulation, 'left')
  const mixed = admittedAndRefusedOf(refusesMixedAdmittedAndRefusedAtOneAddress, 'left')

  const defects = checkPopulationIntegrity({
    side: 'left',
    admitted: [...doubled.admitted, ...mixed.admitted],
    refused: [...doubled.refused, ...mixed.refused],
    documents: [],
    carriesControlTotal: 'never',
    admissionRefusalCeilingBasisPoints: 0,
  })
  assert.deepStrictEqual(
    defects.map((defect) =>
      defect.kind === 'duplicate_item_address'
        ? { id: defect.ref.sourceDocumentId, line: defect.ref.lineIndex, occurrences: defect.occurrences }
        : { id: null, line: null, occurrences: null },
    ),
    [
      { id: 'srcdoc_SYN_inv_5200_line0_twice', line: 0, occurrences: 2 },
      { id: 'srcdoc_SYN_inv_5200_mixed', line: 0, occurrences: 2 },
    ],
    'first-seen order over `admitted` then `refused`, which is the order admission produced them in',
  )
})

/* ====================================================================== *
 * §3b  G236 — `documentAccounts`, called directly
 *
 * The engine never reaches `not_evaluated_address_collision`: C17's defect
 * REFUSES, so a run that collided produces no result to carry an account. The
 * arm exists because this function is exported and callable, and this is the
 * only place that reaches it — the idiom `MoneyRefusal.no_items` already uses.
 * ====================================================================== */

test('test_documentAccounts_reports_no_verdict_at_all_when_an_address_collided', () => {
  /* 🛑 THE ARM THAT MUST NOT BE `agreed`. A document listed twice makes every
   * per-document count on the side wrong — 2N against N, and a doubled sum — and
   * `checkPopulationIntegrity` returns before any of C18's comparisons run. So
   * there IS no verdict, and manufacturing a met trailer here would be worse
   * than the silence G236 was taken to end. */
  const doubled = admittedAndRefusedOf(refusesDuplicateLineIndexInOnePopulation, 'left')
  const input = {
    side: 'left' as const,
    admitted: doubled.admitted,
    refused: doubled.refused,
    documents: refusesDuplicateLineIndexInOnePopulation.input.leftDocuments,
    carriesControlTotal: 'never' as const,
    admissionRefusalCeilingBasisPoints: 0,
  }
  const defects = checkPopulationIntegrity(input)
  assert.ok(
    defects.some((defect) => defect.kind === 'duplicate_item_address'),
    'the fixture must actually collide, or this vector asserts nothing',
  )

  const accounts = used('documentAccounts', documentAccounts(input, defects))
  assert.ok(accounts.length > 0, 'every document is accounted for, collision or not')
  assert.deepStrictEqual(
    [...new Set(accounts.map((account) => account.verdict.kind))],
    ['not_evaluated_address_collision'],
    'no document may read `agreed` while the counts underneath it are wrong',
  )
  /* AND THE ROWS ARE STILL THERE. G236 is about a document never disappearing
   * from the account, so the collision changes the VERDICT and not the census. */
  assert.deepStrictEqual(
    accounts.map((account) => account.sourceDocumentId),
    input.documents.map((document) => document.id),
  )
})

/**
 * TOTALITY, NOT A COUNT — the same shape as the extraction-op test below.
 * `POPULATION_DEFECT_KINDS` is the value-level mirror of the closed
 * `PopulationDefect` union (the module's own type alias fails to compile if a
 * kind is added and not listed). This asserts the other half: that every listed
 * kind is actually produced by a corpus fixture, so a second kind added at C18
 * with no fixture becomes a failure here rather than a silent gap.
 */
test('test_every_declared_population_defect_kind_is_produced_by_a_corpus_fixture', () => {
  /* ⚠️ TWO SOURCES SINCE C18, AND THE SPLIT IS THE RULING. C17's kind reaches a
   * REFUSAL; C18's six reach `postconditions` as `population_integrity_reported`,
   * because a wrong number in a counterparty's trailer must not delete a correct
   * residue. Scanning only the refusals would have declared six kinds untested
   * while every one of them had a fixture. */
  const declared = [...used('POPULATION_DEFECT_KINDS', POPULATION_DEFECT_KINDS)].sort()
  const produced = new Set<string>()
  for (const scenario of REFUSAL_SCENARIOS) {
    if (scenario.expect.kind !== 'population_integrity_refused') continue
    for (const defect of scenario.expect.defects) produced.add(defect.kind)
  }
  for (const scenario of SCENARIOS) {
    for (const failure of scenario.expect.postconditions) {
      if (failure.kind !== 'population_integrity_reported') continue
      produced.add(failure.defect.kind)
    }
  }
  assert.deepStrictEqual(
    declared.filter((kind) => !produced.has(kind)),
    [],
    'a PopulationDefect kind with no corpus fixture producing it is untested',
  )
})

/**
 * 🛑 EVERY DECLARED KIND ALSO HAS A DECLARED DISPOSITION, AND EVERY CONTROL-TOTAL
 * ARM REPORTS.
 *
 * `POPULATION_DEFECT_DISPOSITION` is the ruling as data rather than as an `if` in
 * `runSetReconciliation`. This vector asserts its CONTENT, which the `satisfies`
 * cannot: a total `Record` proves every key is present and says nothing about
 * which value was chosen, and the value is the whole decision (§5.10).
 *
 * ⚠️ THIS TEST WAS NAMED `…only_the_address_collision_refuses…` AND EXPECTED A
 * ONE-MEMBER LIST. C13 added a second refusing kind and the change is recorded
 * here rather than absorbed, because the old list is what a reader would have
 * cited as the ruling.
 *
 * WHAT THE RULING ACTUALLY TURNS ON, AND IT IS UNCHANGED: WHO CONTROLS THE
 * OPERAND. A trailer's `lineCount` and `total` are counterparty-controlled
 * content parsed from a file's last row, so refusing on them would hand the party
 * being reconciled against a one-cell kill switch on the whole close. C13's
 * operand is the OPERATOR's own stated ceiling. So the assertion that carries the
 * decision is the second one below — every C18 arm still reports — and the first
 * is now a membership list rather than a claim of uniqueness.
 */
test('test_every_control_total_arm_reports_and_only_operator_stated_thresholds_refuse', () => {
  const disposition = used('POPULATION_DEFECT_DISPOSITION', POPULATION_DEFECT_DISPOSITION)
  const refusing = POPULATION_DEFECT_KINDS.filter((kind) => disposition[kind] === 'refuse')
  assert.deepStrictEqual(
    [...refusing],
    ['duplicate_item_address', 'admission_refusal_rate_above_ceiling'],
    'C17 refuses because the fold would eat a row before any post-condition could see it; C13 refuses because the threshold is the operator’s own number and not a cell in the counterparty’s file',
  )
  assert.deepStrictEqual(
    POPULATION_DEFECT_KINDS.filter((kind) => kind.startsWith('control_total') || kind.startsWith('declared_')).filter(
      (kind) => disposition[kind] !== 'report',
    ),
    [],
    'C18 rules that no trailer comparison may refuse: both operands are counterparty-controlled, so a wrong number in a supplier’s file must never delete a correct residue',
  )
})

/**
 * O-16 / G153 — `POSTCONDITION_PROPERTY`'s CONTENT, which the `satisfies` cannot
 * reach.
 *
 * A total `Record` proves every key is present and says nothing about which
 * value was chosen, and here the value IS the decision: it is what stops
 * `postconditions.length > 0` from meaning `failed` (§5.10). Asserted as two
 * complete lists rather than as spot checks, so a NEW arm classified into the
 * wrong bucket fails this test rather than passing through it.
 */
test('test_only_the_five_ledger_arms_are_about_soundness_and_the_two_population_arms_are_about_completeness', () => {
  const property = used('POSTCONDITION_PROPERTY', POSTCONDITION_PROPERTY)
  const kindsWith = (value: 'soundness' | 'completeness'): string[] =>
    Object.keys(property).filter((kind) => property[kind as keyof typeof property] === value)

  assert.deepStrictEqual(
    kindsWith('soundness'),
    [
      'open_item_missing_from_residue',
      'item_in_residue_twice',
      'fully_allocated_item_in_residue',
      'negative_residual',
      'gross_not_partitioned',
    ],
    'these five iterate the ADMITTED set and are the do-not-persist arms; adding a sixth here without a fixture is how `incomplete` starts meaning `failed`',
  )
  assert.deepStrictEqual(
    kindsWith('completeness'),
    ['population_integrity_reported', 'population_wholly_refused'],
    'C18’s reports and C13’s wholly-refused side were never about the ledger’s arithmetic — that is the whole of O-16',
  )
})

/**
 * O-16 / G153 — `terminalRunStatus` over three REAL runs and one hand-built
 * unsound one.
 *
 * ⚠️ THREE OF THE FOUR OPERANDS COME OUT OF THE CORPUS AND NOT OUT OF THIS FILE.
 * `tests/model/run-completeness.test.ts` builds its own fixture deliberately, so
 * that the join has two independent construction sites (§5.10); this vector's
 * job is the different one of proving the join answers correctly on the
 * scenarios the corpus already hand-traced for other reasons.
 *
 * 🛑 THE UNSOUND OPERAND IS HAND-BUILT ON TOP OF A REAL RESULT AND THAT IS SAID
 * RATHER THAN HIDDEN. No input reaches `open_item_missing_from_residue` through
 * `runSetReconciliation` — that is what a post-condition is for — so the one
 * difference between the first and last operands below is the arm on the
 * channel.
 */
test('test_terminal_run_status_separates_a_close_from_a_partial_load_from_an_unsound_ledger', () => {
  /* Derivation: every presented row is admitted on both sides and the ledger is
   * spotless, so `completeness` is empty and no post-condition fires. */
  const clean = runOrFail(cleanIdentifierMatch)
  assert.deepStrictEqual([...clean.completeness], [])
  assert.equal(used('terminalRunStatus', terminalRunStatus(clean)), 'completed')

  /* Derivation: BOTH sides present two rows and admit none — the corpus states
   * it, *"four rows presented, four refused, nothing admitted"* — so
   * `presented > admitted` yields one finding PER SIDE, left before right,
   * because `admissionRates` is built in that order. `population_wholly_refused`
   * says the same thing twice on `postconditions`, where C13 put it. Both are
   * completeness; neither is do-not-persist, which is why this run keeps its
   * residue.
   *
   * ⚠️ THIS EXPECTATION WAS HAND-DERIVED AS ONE FINDING AND THE ENGINE SAID TWO.
   * The engine was right and the derivation had read only the left side; it is
   * corrected here rather than quietly widened, and the payload is asserted in
   * full below precisely because a `.map(kind)` comparison is what let a
   * half-read derivation look plausible. */
  const wholly = runOrFail(wholeRunRefusedStillProducesTheResidue)
  assert.deepStrictEqual(
    wholly.completeness.map((finding) => ({ ...finding })),
    [
      { kind: 'rows_presented_not_admitted', side: 'left', presented: 2, admitted: 0, refused: 2 },
      { kind: 'rows_presented_not_admitted', side: 'right', presented: 2, admitted: 0, refused: 2 },
    ],
    'the finding carries the magnitude and the side — a bare boolean here would reproduce O-16 one remove out',
  )
  assert.equal(terminalRunStatus(wholly), 'incomplete')

  /* Derivation: admission is WHOLE here — every row that arrived was readable —
   * and the only witness is the file's own trailer. It fails DIFFERENTLY from
   * the case above, and an implementation handling one and not the other passes
   * half of this test. */
  const truncated = runOrFail(truncatedShredIsCaughtByTheTrailer)
  assert.deepStrictEqual(
    truncated.completeness.map((finding) => finding.kind),
    ['source_self_report_unmet'],
    'admission is whole on both sides here, so the ONLY witness is the trailer',
  )
  assert.deepStrictEqual(
    truncated.completeness.map((finding) =>
      finding.kind === 'source_self_report_unmet' ? finding.defect.kind : null,
    ),
    ['declared_line_count_disagrees'],
    'the defect is carried VERBATIM rather than restated, so `declaredCount` and `documentRowCount` reach an operator through one vocabulary',
  )
  assert.equal(terminalRunStatus(truncated), 'incomplete')

  /* Soundness outranks completeness: a run that is both must report the
   * stronger instruction, or a caller persists an unsound ledger. */
  const unsound: SetReconciliationResult = {
    ...truncated,
    postconditions: [...truncated.postconditions, { kind: 'negative_residual', count: 1 }],
  }
  assert.equal(terminalRunStatus(unsound), 'failed')
})

/**
 * `presentedRowCount` and `defectDocument` — the two totals C18 leans on, reached
 * by direct call because neither is observable from a scenario's shape.
 */
test('test_presented_row_count_is_the_admission_rule_and_never_a_second_one', () => {
  const headerGrain = missingTrailerOnAFormatThatCarriesOneRefuses.input.rightDocuments[0]
  assert.notEqual(headerGrain, undefined)
  if (headerGrain === undefined) throw new Error('unreachable')
  assert.equal(
    used('presentedRowCount', presentedRowCount(headerGrain)),
    1,
    'a document with no lines presents exactly one row, at `lineIndex: null` — the same branch admission takes',
  )

  const lineGrain = missingTrailerOnAFormatThatCarriesOneRefuses.input.leftDocuments[0]
  assert.notEqual(lineGrain, undefined)
  if (lineGrain === undefined) throw new Error('unreachable')
  assert.equal(presentedRowCount(lineGrain), 2, 'a document with lines presents its lines')

  /* THE DOCUMENTED HOLE, ASSERTED RATHER THAN DESCRIBED. Header fields AND lines
   * together present the LINES only, so the header transaction is presented by
   * neither admission nor C18's count. `headerAndLinesTogetherIsCounted` is the
   * end-to-end half of this. */
  const both = headerAndLinesTogetherIsCounted.input.leftDocuments[0]
  assert.notEqual(both, undefined)
  if (both === undefined) throw new Error('unreachable')
  assert.equal(Object.keys(both.extracted).length > 0, true, 'the fixture must carry header fields')
  assert.equal(presentedRowCount(both), both.lines.length)
})

test('test_every_population_defect_names_one_document_however_it_spells_it', () => {
  /* C17 addresses a document through an `ItemRef`; C18's six name it directly.
   * `defectDocument` is the total accessor so a caller asking "which file do I
   * re-cut" need not know which spelling an arm happens to use. */
  const collision = admittedAndRefusedOf(refusesDuplicateLineIndexInOnePopulation, 'left')
  const c17 = checkPopulationIntegrity({
    side: 'left',
    admitted: collision.admitted,
    refused: collision.refused,
    documents: [],
    carriesControlTotal: 'never',
    admissionRefusalCeilingBasisPoints: 0,
  })[0]
  assert.notEqual(c17, undefined)
  if (c17 === undefined) throw new Error('unreachable')
  assert.equal(
    used('defectDocument', defectDocument(c17)),
    'srcdoc_SYN_inv_5200_line0_twice',
    'the C17 arm carries its document inside `ref`',
  )

  const truncation = truncatedShredIsCaughtByTheTrailer.expect.postconditions[0]
  assert.notEqual(truncation, undefined)
  if (truncation === undefined || truncation.kind !== 'population_integrity_reported') {
    throw new Error('the fixture must expect a reported population defect')
  }
  assert.equal(
    defectDocument(truncation.defect),
    'srcdoc_SYN_ar_7100_truncated',
    'a C18 arm carries its document directly',
  )

  /* 🛑 AND SINCE C13, ONE ARM NAMES NO DOCUMENT AT ALL. This test was called
   * `…names_one_document…` and that claim is no longer true of every arm: a
   * refusal rate is a property of the SIDE, whose rows came from every document
   * on it, so naming one of them would be a claim about which file caused a rate.
   * `null` is the answer, and it is asserted rather than left to a reader —
   * returning some document here would be worse than returning nothing, because
   * a caller would act on it. */
  const rate = refusalRateAboveTheStatedCeilingRefuses.expect
  if (rate.kind !== 'population_integrity_refused') {
    throw new Error('the fixture must expect a population-integrity refusal')
  }
  const rateDefect = rate.defects[0]
  assert.notEqual(rateDefect, undefined)
  if (rateDefect === undefined) throw new Error('unreachable')
  assert.equal(
    defectDocument(rateDefect),
    null,
    'a refusal rate is a property of the side; there is no one file to re-cut',
  )
})

/**
 * 🛑 C17's EARLY RETURN, WITNESSED RATHER THAN MASKED.
 *
 * `refusesRedeliveredDocumentOnTheRightSide` now delivers a document that CARRIES
 * a declared trailer, twice. Without the early return, `checkPopulationIntegrity`
 * would walk the same document twice below it and report a doubled sum against
 * the declared 125.00 — a false control-total disagreement beside one true
 * collision. The refusal alone cannot show this, because a refusal discards
 * everything reported; only a direct call can.
 */
test('test_an_address_collision_returns_before_any_control_total_is_compared', () => {
  const doubled = admittedAndRefusedOf(refusesRedeliveredDocumentOnTheRightSide, 'right')
  const defects = checkPopulationIntegrity({
    side: 'right',
    admitted: doubled.admitted,
    refused: doubled.refused,
    documents: refusesRedeliveredDocumentOnTheRightSide.input.rightDocuments,
    carriesControlTotal: 'always',
    admissionRefusalCeilingBasisPoints: 0,
  })
  assert.deepStrictEqual(
    defects.map((defect) => defect.kind),
    ['duplicate_item_address'],
    'an address collision makes every later count wrong, so C18 must not run beside it',
  )
})

/* ====================================================================== *
 * §4  MONEY — §3 of the module, reached only by direct call
 * ====================================================================== */

test('test_money_arithmetic_matches_the_corpus_vectors', () => {
  for (const vector of MONEY_VECTORS) {
    const result =
      vector.op === 'add'
        ? used('addMoney', addMoney(vector.a, vector.b))
        : vector.op === 'subtract'
          ? used('subtractMoney', subtractMoney(vector.a, vector.b))
          : vector.op === 'compare'
            ? used('compareMoney', compareMoney(vector.a, vector.b))
            : used('minMoney', minMoney(vector.a, vector.b))

    if (!vector.expect.ok) {
      assert.equal(result.ok, false, `${vector.name}: expected a refusal — ${vector.why}`)
      if (result.ok) continue
      assert.equal(result.refusal.kind, vector.expect.refusal, vector.why)
      continue
    }
    assert.equal(result.ok, true, `${vector.name}: expected a value — ${vector.why}`)
    if (!result.ok) continue
    /* ⚠️ G286: `MoneyExpectation.value` is `bigint`, because for every op but
     * `compare` it IS an amount. `compare` returns a SIGN — three-valued, no
     * minor units — so the sign is widened to compare against it rather than the
     * amount being narrowed, which would be the ceiling coming back in through a
     * test. */
    const actual =
      typeof result.value === 'number'
        ? BigInt(result.value)
        : used('minorUnitsOf', minorUnitsOf(result.value))
    assert.equal(actual, vector.expect.value, `${vector.name}: ${vector.why}`)
  }
})

test('test_money_predicates_and_zeroLike_match_the_corpus_vectors', () => {
  for (const vector of MONEY_PREDICATE_VECTORS) {
    assert.equal(used('minorUnitsOf', minorUnitsOf(vector.value)), vector.minorUnits, vector.name)
    assert.equal(used('isZeroMoney', isZeroMoney(vector.value)), vector.isZero, vector.name)
    assert.equal(used('isPositiveMoney', isPositiveMoney(vector.value)), vector.isPositive, vector.name)
    assert.equal(used('isNegativeMoney', isNegativeMoney(vector.value)), vector.isNegative, vector.name)

    const guard = used('guardMoney', guardMoney(vector.value))
    assert.equal(guard === null ? null : guard.kind, vector.guardRefusal, vector.name)

    const zero = used('zeroLike', zeroLike(vector.value))
    assert.equal(used('minorUnitsOf', minorUnitsOf(zero)), vector.zeroLikeMinor, vector.name)
    /* `zeroLike` exists so nothing constructs a `Money` by hand — the unit must
     * therefore be carried across, not defaulted. */
    assert.equal(zero.currency, vector.value.currency, vector.name)
    assert.equal(zero.exponent, vector.value.exponent, vector.name)
  }
})

/**
 * C16 — `guardUnit` is reachable by no end-to-end run that states a valid unit,
 * so it is called here directly. Every expected value is a LITERAL typed from the
 * function's stated rule, in the form this file's header permits: a unit is
 * checked as STATED, never as a member of any currency table — there is none in
 * `model/`, and `PRODUCT.md` forbids inventing one.
 */
test('test_guardUnit_checks_that_a_unit_is_stated_and_never_that_it_is_a_currency', () => {
  const cases: readonly {
    readonly unit: MoneyUnit
    readonly expect: MoneyRefusal['kind'] | null
    readonly why: string
  }[] = [
    { unit: { currency: 'SGD', exponent: 2 }, expect: null, why: 'Stated, and an integer scale.' },
    {
      unit: { currency: 'JPY', exponent: 0 },
      expect: null,
      why: 'Exponent 0 is a real denomination and must not be read as absent — the reason the guard tests INTEGER-and-non-negative rather than truthiness.',
    },
    {
      unit: { currency: 'ZZZ', exponent: 2 },
      expect: null,
      why: 'NOT a currency, and deliberately ADMITTED. Membership belongs to the ingestion codec and to G111\'s money codec; a currency list minted in the engine would be a second catalogue for a list it is not authoritative for (§5.3, §5.7).',
    },
    {
      unit: { currency: '', exponent: 2 },
      expect: 'currency_not_stated',
      why: 'A declaration that declares nothing. Refused, never defaulted — the same posture as the three stated bounds.',
    },
    {
      unit: { currency: 'SGD', exponent: -1 },
      expect: 'exponent_not_a_non_negative_integer',
      why: 'Stated and INVALID, which is a different operator error from not stated at all, and a different fix (§5.2).',
    },
    {
      unit: { currency: 'SGD', exponent: 2.5 },
      expect: 'exponent_not_a_non_negative_integer',
      why: 'An exponent is a power of ten, so a fractional one is not a scale; `Number.isInteger` is what catches it.',
    },
  ]
  for (const probe of cases) {
    const refusal = used('guardUnit', guardUnit(probe.unit))
    assert.equal(refusal === null ? null : refusal.kind, probe.expect, probe.why)
  }
})

test('test_toleranceAdmits_matches_the_corpus_vectors', () => {
  for (const vector of TOLERANCE_VECTORS) {
    const verdict = used(
      'toleranceAdmits',
      toleranceAdmits(vector.left, vector.right, vector.tolerance, vector.direction),
    )
    if (!vector.expect.ok) {
      assert.equal(verdict.ok, false, `${vector.name}: expected a refusal — ${vector.why}`)
      if (verdict.ok) continue
      assert.deepStrictEqual(verdict.refusal, vector.expect.refusal, vector.why)
      continue
    }
    assert.equal(verdict.ok, true, `${vector.name}: expected a verdict — ${vector.why}`)
    if (!verdict.ok) continue
    assert.equal(verdict.admitted, vector.expect.admitted, `${vector.name}: ${vector.why}`)
    assert.equal(
      verdict.signedVarianceMinor,
      vector.expect.signedVarianceMinor,
      `${vector.name}: the signed variance is reported whether or not the pairing is admitted`,
    )
  }
})

/* ====================================================================== *
 * §5  NORMALISATION AND EXTRACTION — §2 of the module
 * ====================================================================== */

test('test_applyExtraction_matches_the_corpus_vectors', () => {
  for (const vector of EXTRACTION_VECTORS) {
    const result = used('applyExtraction', applyExtraction(vector.input, vector.normalisation))
    if (!vector.expect.ok) {
      assert.equal(result.ok, false, `${vector.name}: expected a refusal — ${vector.why}`)
      if (result.ok) continue
      assert.deepStrictEqual(result.refusal, vector.expect.refusal, vector.why)
      continue
    }
    assert.equal(result.ok, true, `${vector.name}: expected a key — ${vector.why}`)
    if (!result.ok) continue
    assert.equal(result.key, vector.expect.key, `${vector.name}: ${vector.why}`)
  }
})

test('test_validateNormalisation_reports_every_defect_in_declaration_order', () => {
  for (const vector of NORMALISATION_DEFECT_VECTORS) {
    const defects = used('validateNormalisation', validateNormalisation(vector.normalisation))
    assert.deepStrictEqual([...defects], [...vector.expect], vector.name)
  }
})

/**
 * TOTALITY, NOT A COUNT. `EXTRACTION_OP_KINDS` is the value-level mirror of the
 * closed `ExtractionOp` union, and this asserts that the corpus carries a vector
 * for every member — so a fifth op added to the module becomes a failure here
 * rather than a silent gap in the extraction vectors.
 */
test('test_every_declared_extraction_op_kind_is_covered_by_a_corpus_vector', () => {
  const declared = Object.values(used('EXTRACTION_OP_KINDS', EXTRACTION_OP_KINDS)).slice().sort()
  assert.deepStrictEqual(
    declared,
    [...EXTRACTION_OP_KINDS_COVERED].sort(),
    'EXTRACTION_OP_KINDS_COVERED in the corpus must name every member of EXTRACTION_OP_KINDS',
  )

  const exercised = new Set<string>()
  for (const vector of EXTRACTION_VECTORS) {
    for (const op of vector.normalisation.ops) exercised.add(op.kind)
  }
  const missing = declared.filter((kind) => !exercised.has(kind))
  assert.deepStrictEqual(
    missing,
    [],
    'each op kind must appear in at least one vector that actually runs applyExtraction',
  )
})

/* ====================================================================== *
 * §6  CALENDAR AND SIMILARITY — the two total helpers with no `Date` and no
 *     regex in them
 * ====================================================================== */

test('test_parseCalendarDate_matches_the_corpus_vectors', () => {
  for (const vector of CALENDAR_VECTORS) {
    const parsed = used('parseCalendarDate', parseCalendarDate(vector.input))
    assert.equal(
      parsed === null ? null : parsed.iso,
      vector.expectIso,
      `${vector.input}: ${vector.why}`,
    )
  }
  for (const vector of CALENDAR_ANCHOR_VECTORS) {
    const parsed = used('parseCalendarDate', parseCalendarDate(vector.input))
    assert.notEqual(parsed, null, vector.input)
    if (parsed === null) continue
    assert.equal(parsed.dayNumber, vector.dayNumber, `${vector.input}: days since 1970-01-01`)
  }
  for (const vector of CALENDAR_GAP_VECTORS) {
    const from = used('parseCalendarDate', parseCalendarDate(vector.from))
    const to = used('parseCalendarDate', parseCalendarDate(vector.to))
    assert.notEqual(from, null)
    assert.notEqual(to, null)
    if (from === null || to === null) continue
    assert.equal(to.dayNumber - from.dayNumber, vector.gapDays, `${vector.from}→${vector.to}: ${vector.why}`)
  }
})

test('test_levenshteinBasisPoints_matches_the_corpus_vectors', () => {
  for (const vector of SIMILARITY_VECTORS) {
    const score = used(
      'levenshteinBasisPoints',
      levenshteinBasisPoints(vector.a, vector.b, vector.maxChars),
    )
    assert.equal(score, vector.expectBasisPoints, `${vector.a} vs ${vector.b}: ${vector.why}`)
  }
})

test('test_itemKey_is_length_prefixed_and_survives_an_id_containing_the_delimiter', () => {
  for (const vector of ITEM_KEY_VECTORS) {
    assert.equal(used('itemKey', itemKey(vector.side, vector.ref)), vector.expectKey, vector.why)
  }
  /* The property the length prefix exists for, asserted rather than described:
   * two different refs can never produce one key. */
  const keys = new Set(ITEM_KEY_VECTORS.map((vector) => itemKey(vector.side, vector.ref)))
  assert.equal(keys.size, ITEM_KEY_VECTORS.length, 'distinct refs must not collide')
})

/* ====================================================================== *
 * §7  ADMISSION AND THE DERIVED SETTLEMENT
 * ====================================================================== */

test('test_admitPopulation_refuses_a_second_currency_and_never_drops_the_row', () => {
  const input = twoCurrenciesNeverMatchAcross.input
  const context = {
    fieldClassification: input.fieldClassification,
    modelPromptEligible: input.modelPromptEligible,
    confidenceFloors: input.confidenceFloors,
  }
  const left = used('admitPopulation', admitPopulation('left', input.leftDocuments, input.left, context))
  const right = used(
    'admitPopulation',
    admitPopulation('right', input.rightDocuments, input.right, context),
  )

  /* Nothing is ever dropped: admitted + refused accounts for every row supplied. */
  for (const [side, outcome, documents] of [
    ['left', left, input.leftDocuments],
    ['right', right, input.rightDocuments],
  ] as const) {
    const supplied = documents.reduce(
      (total, document) => total + (document.lines.length === 0 ? 1 : document.lines.length),
      0,
    )
    assert.equal(
      outcome.admitted.length + outcome.refused.length,
      supplied,
      `${side}: every supplied row is either admitted or refused, never skipped`,
    )
  }

  const refusals = [...left.refused, ...right.refused].map((refused) => refused.refusal.kind)
  /* ⚠️ C16. This asserted `currency_disagrees_with_population` twice, with the
   * reason *"the currency is fixed by the first admitted row on each side; the
   * second is refused"* — the seeding rule, now deleted. The refusal is against
   * the population's DECLARED unit and it carries the reasoned `MoneyRefusal`
   * rather than one flat kind, so a wrong SCALE is distinguishable from a wrong
   * currency at the point of refusal. */
  assert.deepStrictEqual(
    refusals,
    ['money_unit_disagrees_with_declared', 'money_unit_disagrees_with_declared'],
    'a row disagreeing with the DECLARED unit is refused, on either side, in any row order',
  )
})

test('test_allocatedOf_residualOf_and_settlementOf_derive_the_settlement_from_the_ledger', () => {
  const result = runOrFail(cleanIdentifierMatch)
  const invoiceKey = itemKey('left', {
    sourceDocumentId: 'srcdoc_SYN_inv_1001' as ItemRef['sourceDocumentId'],
    lineIndex: null,
  })

  const allocated = used('allocatedOf', allocatedOf(result.state, invoiceKey))
  assert.equal(allocated.ok, true)
  if (allocated.ok) assert.equal(minorUnitsOf(allocated.value), 125_00n)

  const residual = used('residualOf', residualOf(result.state, invoiceKey))
  assert.equal(residual.ok, true)
  if (residual.ok) assert.equal(minorUnitsOf(residual.value), 0n)

  const settlement = used('settlementOf', settlementOf(result.state, invoiceKey))
  assert.equal(settlement.ok, true)
  if (settlement.ok) assert.equal(settlement.value.kind, 'fully_allocated')

  /* An unknown key refuses rather than returning a fabricated zero. */
  const unknown = used('allocatedOf', allocatedOf(result.state, 'left:1:x:h'))
  assert.equal(unknown.ok, false)
  const unknownResidual = used('residualOf', residualOf(result.state, 'left:1:x:h'))
  assert.equal(unknownResidual.ok, false)
  const unknownSettlement = used('settlementOf', settlementOf(result.state, 'left:1:x:h'))
  assert.equal(unknownSettlement.ok, false)

  /* ⚠️ AND THE REASON IT GIVES IS FALSE, PINNED HERE RATHER THAN LEFT UNSEEN.
   *
   * `MoneyResult` has no `unknown_item` arm — `AllocationRefusal` does, but
   * these three return `MoneyResult`, so `model/reconciliation.ts:1187`,
   * `:1200` and the `sumGross` helper all report a MISSING ITEM as
   * `currency_mismatch`. Nothing allocates wrongly because of it: every caller
   * inside the module treats `!ok` as "skip", so the mislabel never moves
   * money. What it costs is the first engineer who logs the refusal kind and
   * goes looking for a currency problem that is not there — and it is
   * inconsistent with the module's own rule, stated on
   * `counterparty_unattributed`, that a cause must name the actual defect.
   *
   * Asserted as-is because the module is owned elsewhere this minute. If a
   * `MoneyRefusal` arm for an absent item is added, this assertion fails and
   * that is the intended signal, not a regression. */
  if (!unknown.ok) {
    assert.equal(
      unknown.refusal.kind,
      'currency_mismatch',
      'an absent item is reported as a currency mismatch — see the note above',
    )
  }
})

/* ====================================================================== *
 * §8  ALLOCATION — every arm of `AllocationRefusal`
 * ====================================================================== */

/** A key no item in the run carries. Not a real id; it is not meant to resolve. */
const UNRESOLVABLE_KEY = 'left:20:srcdoc_SYN_absent_x:h'
const PROBE_EVIDENCE: PairingEvidence = { kind: 'amount_sum_exact', memberCount: 1 }

test('test_applyAllocation_matches_every_corpus_probe_and_never_mutates_the_state', () => {
  const base = admittedStateFor(cleanIdentifierMatch)
  for (const probe of ALLOCATION_PROBES) {
    const fromKey = probe.from === 'unknown' ? UNRESOLVABLE_KEY : addressKey(probe.from)
    const toKey = probe.to === 'unknown' ? UNRESOLVABLE_KEY : addressKey(probe.to)
    const before = base.allocations.length

    /* Annotated rather than inferred: `AllocationOutcome.state` names the same
     * `MatchingState` `base` was widened from, and TS reports TS7022 on the
     * cycle rather than resolving it. */
    const outcome: AllocationOutcome = used(
      'applyAllocation',
      applyAllocation(base, fromKey, toKey, probe.amount, PROBE_EVIDENCE),
    )
    if (!probe.expect.ok) {
      assert.equal(outcome.ok, false, `${probe.name}: expected a refusal — ${probe.why}`)
      if (outcome.ok) continue
      assert.equal(outcome.refusal.kind, probe.expect.refusal, `${probe.name}: ${probe.why}`)
      if (outcome.refusal.kind === 'would_over_allocate') {
        /* §5.5 — the refusal carries BOTH numbers so the caller need not
         * re-derive the one it was refused for. */
        assert.equal(outcome.refusal.requestedMinor, minorUnitsOf(probe.amount), probe.name)
        assert.equal(outcome.refusal.residualMinor, 125_00n, probe.name)
      }
    } else {
      assert.equal(outcome.ok, true, `${probe.name}: expected an allocation — ${probe.why}`)
      if (!outcome.ok) continue
      assert.equal(outcome.state.allocations.length, before + 1, probe.name)
      const appended: Allocation | undefined = outcome.state.allocations[before]
      assert.notEqual(appended, undefined)
      if (appended !== undefined) {
        assert.equal(minorUnitsOf(appended.amount), probe.expect.amountMinor, probe.name)
        assert.deepStrictEqual(appended.evidence, PROBE_EVIDENCE, probe.name)
      }
    }
    /* A9(e) at the function scale: the state it was handed is never written. */
    assert.equal(base.allocations.length, before, `${probe.name}: applyAllocation must not mutate`)
  }
})

/* ====================================================================== *
 * §9  THE FOUR PASSES, CALLED DIRECTLY
 *
 * The corpus records that all four `arityPermits` arms and the whole of
 * `PassOutcome.toleranceRefusals` are unreachable through `runSetReconciliation`
 * — a fold only ever runs the strategies a `PairingSpec` declares. These probes
 * are the only path to them.
 * ====================================================================== */

function assertPassOutcome(label: string, actual: PassOutcome, expected: ExpectedPassOutcome): void {
  assert.deepStrictEqual(
    actual.state.allocations.map((allocation) => ({
      fromKey: allocation.fromKey,
      toKey: allocation.toKey,
      amountMinor: minorUnitsOf(allocation.amount),
      evidence: allocation.evidence,
    })),
    expected.allocations.map((allocation) => ({
      fromKey: addressKey(allocation.from),
      toKey: addressKey(allocation.to),
      amountMinor: allocation.amountMinor,
      evidence: allocation.evidence,
    })),
    `${label}: allocations`,
  )
  assert.deepStrictEqual(
    actual.ambiguities.map(ambiguityShape),
    expected.ambiguities.map(expectedAmbiguityShape),
    `${label}: ambiguities`,
  )
  assert.deepStrictEqual(
    [...actual.toleranceRefusals],
    [...expected.toleranceRefusals],
    `${label}: toleranceRefusals`,
  )
}

test('test_passIdentifierJoin_rules_all_four_cardinalities_over_one_duplicated_identifier', () => {
  for (const probe of IDENTIFIER_JOIN_PROBES) {
    const state = admittedStateFor(probe.scenario)
    const outcome = used(
      'passIdentifierJoin',
      passIdentifierJoin(state, probe.on, probe.tolerance, probe.direction, probe.cardinality),
    )
    assertPassOutcome(`${probe.name} — ${probe.why}`, outcome, probe.expect)
  }
})

test('test_passAmountAndDate_is_the_only_path_that_reports_a_tolerance_refusal', () => {
  for (const probe of AMOUNT_AND_DATE_PROBES) {
    const state = admittedStateFor(probe.scenario)
    const outcome = used(
      'passAmountAndDate',
      passAmountAndDate(state, probe.amountTolerance, probe.dateTolerance, probe.direction),
    )
    assertPassOutcome(`${probe.name} — ${probe.why}`, outcome, probe.expect)
  }
})

test('test_passFuzzyReference_anchors_the_amount_and_respects_both_bounds', () => {
  for (const probe of FUZZY_PROBES) {
    const state = admittedStateFor(probe.scenario)
    const outcome = used(
      'passFuzzyReference',
      passFuzzyReference(state, probe.on, probe.minSimilarity, probe.metric, probe.maxChars,
    /* G115 — the bucket ceiling this pass now requires */ 512,
  ),
    )
    assertPassOutcome(`${probe.name} — ${probe.why}`, outcome, probe.expect)
  }
})

/**
 * 🛑 THE MARKED STUB, ASSERTED AS A STUB AND NOT AS A FAILURE.
 *
 * `jaro_winkler` is a declared member of `SimilarityMetric` that nothing in this
 * repository defines: choosing its prefix scale and prefix cap changes which
 * records pair, which is a matching-policy decision with money on it. The module
 * returns null and the pass declines. That is the specified behaviour, so this
 * asserts it rather than reporting it as an unimplemented feature.
 */
test('test_the_jaro_winkler_metric_is_a_declared_stub_that_pairs_nothing', () => {
  const state = admittedStateFor(fuzzyTieIsAnAmbiguity)
  const outcome = used(
    'passFuzzyReference',
    passFuzzyReference(state, PATHS.reference, 0.5, 'jaro_winkler', 128,
    /* G115 — the bucket ceiling this pass now requires */ 512,
  ),
  )
  assert.deepStrictEqual(
    outcome.state.allocations,
    [],
    'an undefined metric must pair nothing, never fall back to another metric',
  )
  assert.deepStrictEqual(outcome.ambiguities, [], 'and must not manufacture a finding either')
})

test('test_passAmountSum_runs_G105s_two_stages_and_reports_an_oversized_bucket', () => {
  for (const probe of AMOUNT_SUM_PROBES) {
    const state = admittedStateFor(probe.scenario)
    const outcome = used('passAmountSum', passAmountSum(state, probe.obligationSide, probe.bound))
    assert.deepStrictEqual(
      outcome.state.allocations.map((allocation) => ({
        fromKey: allocation.fromKey,
        toKey: allocation.toKey,
        amountMinor: minorUnitsOf(allocation.amount),
        evidence: allocation.evidence,
      })),
      probe.expectAllocations.map((allocation) => ({
        fromKey: addressKey(allocation.from),
        toKey: addressKey(allocation.to),
        amountMinor: allocation.amountMinor,
        evidence: allocation.evidence,
      })),
      `${probe.name}: ${probe.why}`,
    )
    assert.deepStrictEqual(
      outcome.oversizedBuckets.map((entry) => ({
        itemCount: entry.boundary.itemCount,
        exampleRef: refShape(entry.boundary.exampleRef),
      })),
      probe.expectOversizedBuckets.map((entry) => ({
        itemCount: entry.itemCount,
        exampleRef: refShape(entry.example.ref),
      })),
      `${probe.name}: an oversized bucket is REPORTED as a count and an address, never silently ` +
        'truncated and never by its counterparty key (G217)',
    )
  }
})

/* ====================================================================== *
 * §10  THE READER SEAM — a type the caller fills, exercised without a model
 * ====================================================================== */

function readerFixture(): { readonly result: SetReconciliationResult } {
  return { result: runOrFail(freeTextMultiEntityBuildsAReaderRequest) }
}

test('test_notImplementedReader_returns_a_refusal_rather_than_a_fabricated_empty_result', () => {
  const { result } = readerFixture()
  const request = result.readerRequests[0]
  assert.notEqual(request, undefined, 'the free-text scenario must emit one request')
  if (request === undefined) return

  const outcome = used('notImplementedReader', notImplementedReader(request))
  assert.equal(outcome.kind, 'refused', 'the draft returned [], which reads as "found nothing"')
  assert.equal(outcome.requestOrdinal, request.requestOrdinal)
  if (outcome.kind === 'refused') assert.equal(outcome.refusal.kind, 'not_implemented')
  assert.equal(outcome.usage, null, 'no call was made, so nothing may be metered')
})

test('test_buildReaderRequests_treats_the_candidate_cap_as_a_ceiling_and_not_a_trim', () => {
  const { result } = readerFixture()
  const atCap = used('buildReaderRequests', buildReaderRequests(result.state, result.residue, 5))
  assert.equal(atCap.length, 1, 'two candidates under a cap of five')
  const first = atCap[0]
  assert.notEqual(first, undefined)
  if (first !== undefined) assert.equal(first.candidates.length, 2)

  /* A subject whose candidate set exceeds the cap is WITHHELD, not trimmed —
   * a trimmed set would silently change what the quarantined side is asked. */
  const belowCap = used('buildReaderRequests', buildReaderRequests(result.state, result.residue, 1))
  assert.deepStrictEqual([...belowCap], [], 'over the cap the subject is not sent at all')

  /* A cap with no number is not a bound. */
  const unstated = used('buildReaderRequests', buildReaderRequests(result.state, result.residue, 0))
  assert.deepStrictEqual([...unstated], [], 'a non-positive cap emits nothing')
})

test('test_applyReaderVerdicts_folds_every_outcome_arm_back_without_calling_a_model', () => {
  const { result } = readerFixture()
  const requests = result.readerRequests
  assert.equal(requests.length, 1)

  for (const vector of READER_VECTORS) {
    const application = used(
      'applyReaderVerdicts',
      applyReaderVerdicts(result.state, requests, [vector.outcome]),
    )
    assert.equal(
      application.state.allocations.length - result.state.allocations.length,
      vector.expectAllocations,
      `${vector.name}: ${vector.why}`,
    )
    assert.equal(
      application.meterFacts.length,
      vector.expectMeterFacts,
      `${vector.name}: tokens are metered when they were spent, and never otherwise`,
    )
    if (vector.expectUnresolved === null) {
      assert.deepStrictEqual([...application.unresolved], [], vector.name)
      continue
    }
    assert.equal(application.unresolved.length, 1, vector.name)
    const unresolved = application.unresolved[0]
    assert.notEqual(unresolved, undefined)
    if (unresolved !== undefined) {
      assert.deepStrictEqual(unresolved.cause, vector.expectUnresolved, vector.name)
    }
  }
})

/* ====================================================================== *
 * §11  METERS — a measurement, never a price (invariant 5)
 * ====================================================================== */

/** The exact key set a `MeterFact` may carry. A price added later fails here. */
const METER_FACT_KEYS = ['idempotencyKey', 'meter', 'modelEntryId', 'quantity']

test('test_tokenMeterFacts_qualifies_the_idempotency_key_by_meter_and_never_estimates', () => {
  for (const vector of TOKEN_METER_VECTORS) {
    const usage: ReaderTokenUsage = {
      inputTokens: vector.usage.inputTokens,
      outputTokens: vector.usage.outputTokens,
      modelEntryId: SYNTHETIC_CATALOGUE_ROW,
      providerRequestId: vector.usage.providerRequestId,
    }
    const facts = used('tokenMeterFacts', tokenMeterFacts(usage))
    assert.equal(facts.length, vector.expect.length, `${vector.name}: ${vector.why}`)
    for (let i = 0; i < vector.expect.length; i += 1) {
      const actual = facts[i]
      const expected = vector.expect[i]
      assert.notEqual(actual, undefined)
      assert.notEqual(expected, undefined)
      if (actual === undefined || expected === undefined) continue
      assert.equal(actual.meter, expected.meter, vector.name)
      assert.equal(actual.quantity, expected.quantity, vector.name)
      assert.equal(actual.idempotencyKey, expected.idempotencyKey, vector.why)
      assert.equal(actual.modelEntryId, SYNTHETIC_CATALOGUE_ROW, vector.name)
      assert.deepStrictEqual(Object.keys(actual).sort(), METER_FACT_KEYS, 'invariant 5')
    }
  }
})

test('test_runMeterFact_carries_a_quantity_and_no_price', () => {
  const fact = used(
    'runMeterFact',
    runMeterFact(RUN_METER_VECTOR.runId, RUN_METER_VECTOR.meter, RUN_METER_VECTOR.quantity),
  )
  assert.equal(fact.meter, RUN_METER_VECTOR.meter)
  assert.equal(fact.quantity, RUN_METER_VECTOR.quantity)
  assert.equal(fact.idempotencyKey, RUN_METER_VECTOR.expectIdempotencyKey)
  assert.equal(fact.modelEntryId, RUN_METER_VECTOR.expectModelEntryId, 'no inference incurred it')
  assert.deepStrictEqual(Object.keys(fact).sort(), METER_FACT_KEYS, 'invariant 5')
})

/* ====================================================================== *
 * §12  POST-CONDITIONS — seen RED, or they are §5.6
 * ====================================================================== */

function scenarioNamed(name: string): Scenario {
  const found = SCENARIOS.find((scenario) => scenario.name === name)
  assert.notEqual(found, undefined, `the corpus must still carry a scenario named ${name}`)
  if (found === undefined) throw new Error(`no scenario named ${name}`)
  return found
}

test('test_checkPostconditions_is_green_on_a_sound_run_and_red_on_each_corruption', () => {
  const sound = runOrFail(leftoverCashLandsInResidue)
  assert.deepStrictEqual(
    [...used('checkPostconditions', checkPostconditions(sound.state, sound.residue, sound.admissionRates))],
    [],
    'the unmutated run must be sound, or every probe below proves nothing',
  )

  for (const probe of POSTCONDITION_PROBES) {
    const result = runOrFail(scenarioNamed(probe.scenario))
    const targetKey = addressKey(probe.target)
    const targetEntry = result.residue.find(
      (entry) => itemKey(entry.side, entry.ref) === targetKey,
    )

    let corrupted: ResidueEntry[]
    if (probe.mutation === 'drop_open_item') {
      corrupted = result.residue.filter((entry) => itemKey(entry.side, entry.ref) !== targetKey)
      assert.equal(
        corrupted.length,
        result.residue.length - 1,
        `${probe.name}: the mutation must actually remove a row, or the probe is inert`,
      )
    } else if (probe.mutation === 'duplicate_entry') {
      assert.notEqual(targetEntry, undefined, `${probe.name}: the target must be in the residue`)
      if (targetEntry === undefined) continue
      corrupted = [...result.residue, targetEntry]
    } else {
      /* A closed item added to the exceptions list.
       *
       * ⚠️ THE `settlement` HERE IS LOAD-BEARING AND THIS COMMENT ONCE SAID IT
       * WAS NOT. It read: *"`checkPostconditions` reads only `side` and `ref`
       * when building its seen-set, so the remaining fields are the
       * least-surprising legal values rather than a claim"*, and the entry
       * carried `settlement: null`. That stopped being true when
       * `checkPostconditions` learned that an entry with NO settlement is an
       * admission-refused row which is not in the ledger at all and must not
       * stand in for one — so a `null` here made the probe INERT rather than
       * red. The settlement is read back out of the state the run produced, not
       * written here: this fabricates a misplaced residue ROW, never an amount. */
      const settlement = used('settlementOf', settlementOf(result.state, targetKey))
      assert.equal(
        settlement.ok,
        true,
        `${probe.name}: the target must have a derivable settlement, or the probe is inert`,
      )
      if (!settlement.ok) continue
      corrupted = [
        ...result.residue,
        {
          side: probe.target.side,
          ref: probe.target.ref,
          settlement: settlement.value,
          disposition: 'unidentified',
          cause: { kind: 'no_strategy_paired' },
          /* G227. A fabricated probe row holds no read. */
          heldReads: [],
        },
      ]
    }

    const failures = used('checkPostconditions', checkPostconditions(result.state, corrupted, result.admissionRates))
    assert.deepStrictEqual([...failures], [...probe.expect], `${probe.name}: ${probe.why}`)
  }
})

/* ====================================================================== *
 * §13  TWO PROPERTIES THE CORPUS LISTS AS OWED — supplied here
 *
 * `KNOWN_GAPS` records that determinism across two runs and input immutability
 * (A9(e)) are stated in the corpus's prose and covered by nothing. They are
 * covered here. They are properties of the engine, not of a scenario, so they
 * sweep every scenario rather than picking one.
 * ====================================================================== */

test('test_two_runs_over_one_input_produce_an_identical_allocation_sequence', () => {
  for (const scenario of SCENARIOS) {
    const first = used('runSetReconciliation', runSetReconciliation(scenario.input))
    const second = used('runSetReconciliation', runSetReconciliation(scenario.input))
    assert.equal(first.ok, true, scenario.name)
    assert.equal(second.ok, true, scenario.name)
    if (!first.ok || !second.ok) continue
    /* The SEQUENCE, not the set. `RunTrigger.rerun` exists, so an audit that
     * reorders between runs is a real defect and a set comparison would hide it. */
    assert.deepStrictEqual(
      first.result.state.allocations.map((allocation) => ({
        ordinal: allocation.ordinal,
        fromKey: allocation.fromKey,
        toKey: allocation.toKey,
        amountMinor: minorUnitsOf(allocation.amount),
        evidence: allocation.evidence,
      })),
      second.result.state.allocations.map((allocation) => ({
        ordinal: allocation.ordinal,
        fromKey: allocation.fromKey,
        toKey: allocation.toKey,
        amountMinor: minorUnitsOf(allocation.amount),
        evidence: allocation.evidence,
      })),
      `${scenario.name}: the engine takes no clock and no randomness`,
    )
    assert.deepStrictEqual(
      first.result.residue.map((entry) => itemKey(entry.side, entry.ref)),
      second.result.residue.map((entry) => itemKey(entry.side, entry.ref)),
      `${scenario.name}: residue order is part of the audit`,
    )
  }
})

/**
 * A9(e), witnessed rather than asserted in prose.
 *
 * Under ES module strict mode an assignment to a frozen object THROWS, so a
 * mutating implementation fails loudly here instead of passing quietly. The
 * freeze reaches the documents, their `extracted` records, their `lines`, every
 * line's `fields` and the two binding objects — a shallow freeze would leave
 * every field a mutating implementation would actually reach.
 */
function deepFreezeInput(scenario: Scenario): void {
  for (const document of [...scenario.input.leftDocuments, ...scenario.input.rightDocuments]) {
    for (const value of Object.values(document.extracted)) Object.freeze(value)
    Object.freeze(document.extracted)
    for (const line of document.lines) {
      for (const value of Object.values(line.fields)) Object.freeze(value)
      Object.freeze(line.fields)
      Object.freeze(line)
    }
    Object.freeze(document.lines)
    Object.freeze(document)
  }
  Object.freeze(scenario.input.left)
  Object.freeze(scenario.input.left.spec)
  Object.freeze(scenario.input.right)
  Object.freeze(scenario.input.right.spec)
  Object.freeze(scenario.input.pairing)
  Object.freeze(scenario.input.strategyBindings)
  Object.freeze(scenario.input)
}

test('test_runSetReconciliation_mutates_nothing_it_was_given', () => {
  for (const scenario of SCENARIOS) {
    deepFreezeInput(scenario)
    const outcome = used('runSetReconciliation', runSetReconciliation(scenario.input))
    assert.equal(outcome.ok, true, `${scenario.name}: a frozen input must still run`)
  }
  /* And the run still produces the same answer over the frozen input, which is
   * what distinguishes "did not mutate" from "silently did less work". */
  const result = runOrFail(cleanIdentifierMatch)
  assert.equal(result.state.allocations.length, 1)
})

/* ====================================================================== *
 * §14  THE CENSUS — the coverage number, in both directions
 * ====================================================================== */

test('test_the_export_census_parses_every_export_line_in_the_module', () => {
  assert.deepStrictEqual(
    [...CENSUS.unparsed],
    [],
    'a declaration this regex did not understand would leave the denominator and inflate the score',
  )
  assert.equal(
    CENSUS.runtime.length + CENSUS.typeLevel.length + CENSUS.reExportStatements,
    CENSUS.exportLines,
    'every counted export line is classified exactly once',
  )
  assert.ok(CENSUS.runtime.length > 0, 'the module must have runtime exports to exercise')
  assert.ok(CENSUS.typeLevel.length > 0, 'and type-level ones, which this file cannot exercise')
  assert.ok(
    CENSUS.runtime.includes('runSetReconciliation'),
    'an anchor: the entry point must appear in the parsed list, or the parse read the wrong file',
  )
  assert.ok(
    CENSUS.compileTimeAssertions.length > 0,
    'the `_…HoldsNoText` family is discharged by tsc and by nothing here',
  )
})

/**
 * §10 — the residue-side disposition pass, reached for BREADTH only.
 *
 * The depth is `tests/model/learned-dispositions.test.ts`, which owns G123's
 * conservation argument, G127's type-level exclusion of `write_off` and every
 * arm of the gate. This test exists because that file is not this file's
 * register: `test_every_runtime_export_of_the_module_was_invoked_by_a_constructed_value`
 * counts what ran HERE, so three exports would otherwise read as never invoked
 * while being thoroughly tested next door. It drives them over a CORPUS
 * scenario rather than a fixture of its own.
 */
test('test_the_residue_side_disposition_pass_runs_over_a_corpus_scenario_and_gates_what_it_proposes', () => {
  const result = runOrFail(leftoverCashLandsInResidue)

  /* The scenario's one residue row is a partially-allocated bank credit whose
   * narrative reads `TT EGRET MEDIA ON ACCOUNT`. `split_take` on a space at
   * index 0 is *"starts with TT"* — G124's declarative op list, nothing
   * compiled. */
  const entry = result.residue[0]
  assert.notEqual(entry, undefined, 'the scenario must still leave a residue row to disposition')
  if (entry === undefined) return
  assert.equal(entry.settlement?.kind, 'partially_allocated')

  const suspense: Disposition = {
    key: 'route_to_suspense',
    label: 'Route to suspense',
    family: 'unidentified',
    reversibility: 'reversible',
    terminal: false,
    requiresAdjustment: false,
  }
  const rule: LearnedDispositionRule = {
    entryId: 'lrn-export-surface' as LearningEntryId,
    predicate: {
      kind: 'extraction_in_set',
      /* G214 — the `?? ''` fallback died with `FieldPath = string`: an empty
       * string is not a path and never was, it just typechecked. The scenario's
       * description path is the subject, and `PATHS.bankNarrative` is what it
       * is; a fixture that reaches here with `null` is a fixture defect. */
      subject: {
        kind: 'field',
        slot: 'statement',
        path: leftoverCashLandsInResidue.input.right.description ?? PATHS.bankNarrative,
      },
      extraction: {
        ops: [{ kind: 'split_take', separator: ' ', index: 0 }],
        then: 'exact',
        maxInputChars: 64,
      },
      values: ['TT'],
    },
    proposed: 'unidentified',
    disposition: suspense,
  }
  const autonomy: AutonomyConfig = {
    maxAutoResolveSeverity: 'low',
    autonomousIn: { kind: 'these', values: ['finance'] },
    autoResolveValueCeiling: null,
    permittedActions: ['propose_resolution', 'execute_resolution'],
    mayProposeBeyondLimits: true,
  }

  /* G129 — proposing is not the risky act; EXECUTING unattended is. */
  assert.equal(used('LEARNED_RULE_ACTION', LEARNED_RULE_ACTION), 'execute_resolution')

  const outcome = used(
    'proposeResidueDispositions',
    proposeResidueDispositions({
      state: result.state,
      residue: result.residue,
      left: leftoverCashLandsInResidue.input.left,
      right: leftoverCashLandsInResidue.input.right,
      rules: [rule],
      autonomy,
      context: { severity: 'low', domain: 'finance' },
    }),
  )
  assert.deepStrictEqual(outcome.unusableRules, [])
  assert.equal(outcome.proposals.length, 1)
  assert.deepStrictEqual(outcome.proposals[0]?.outcome, {
    kind: 'gated',
    allowed: true,
    reason: 'permitted',
  })

  /* 🛑 G123. The pass proposed something and the ledger did not move: the SAME
   * post-conditions over the SAME state and residue are still empty. */
  assert.deepStrictEqual(checkPostconditions(result.state, result.residue, result.admissionRates), [])

  /* The value handed to the gate is the RESIDUAL. Asserted as a PROPERTY —
   * strictly less than the row's gross — rather than by reading the fold back
   * out of itself; the literal 5000 case is in the depth suite. */
  const atRisk = used('valueAtRiskOf', valueAtRiskOf(entry))
  assert.equal(atRisk.ok, true)
  const item = result.state.items.get(itemKey(entry.side, entry.ref))
  assert.notEqual(item, undefined)
  if (!atRisk.ok || item === undefined) return
  const versusGross = compareMoney(atRisk.value, item.gross)
  assert.equal(versusGross.ok, true)
  if (versusGross.ok) assert.equal(versusGross.value, -1, 'the residual is below the gross')

  /* And the refusing arm, so `{ ok: false }` is reachable and not dead code. */
  assert.deepStrictEqual(valueAtRiskOf({ ...entry, settlement: null }), { ok: false })
})

test('test_SIMILARITY_MAX_CHARS_CEILING_is_the_boundary_the_validator_enforces', () => {
  /**
   * G115. The constant is only meaningful if it is the SAME number the validator
   * compares against, so this exercises the boundary from both sides rather than
   * asserting the constant equals itself — which would be a constant compared to
   * itself and would pass under any value.
   */
  const ceiling = used('SIMILARITY_MAX_CHARS_CEILING', SIMILARITY_MAX_CHARS_CEILING)
  assert.equal(Number.isInteger(ceiling), true)

  const base = typoAmountAnchoredFuzzy.input
  const over = runSetReconciliation({ ...base, similarityMaxChars: ceiling + 1 })
  assert.equal(over.ok, false, 'one above the ceiling is REFUSED, never clamped')
  if (!over.ok) assert.equal(over.refusal.kind, 'similarity_max_chars_not_stated')

  const at = runSetReconciliation({ ...base, similarityMaxChars: ceiling })
  assert.equal(at.ok, true, 'the ceiling itself is admitted — the bound is inclusive')
})

/* ====================================================================== *
 * G228 — THE REGISTER'S SECOND ROW TYPE, EXERCISED WITH A CONSTRUCTED VALUE
 *
 * A residue row addressed the way `/close/finding/:ref` addresses it, converted,
 * and the line it came from asserted on the far side. The refusal arm is
 * exercised too: a coverage register that counted only the happy path would
 * report this export as tested while half of it had never run.
 * ====================================================================== */

test('test_openLineFinding_carries_the_line_grain_address_and_refuses_an_address_it_cannot_find', () => {
  const result = runOrFail(leftoverCashLandsInResidue)
  const [first] = result.residue
  assert.ok(first !== undefined, 'the scenario must leave a residue for this to mean anything')

  const opened = used('openLineFinding', openLineFinding(result, RESIDUE_FINDING_RUN, first.side, first.ref))
  assert.equal(opened.ok, true)
  if (!opened.ok) return
  assert.equal(opened.finding.grain, 'line')
  assert.equal(opened.finding.side, first.side)
  assert.deepStrictEqual(refShape(opened.finding.ref), refShape(first.ref))
  assert.deepStrictEqual(opened.finding.cause, first.cause)

  const missing = openLineFinding(result, RESIDUE_FINDING_RUN, first.side, {
    sourceDocumentId: first.ref.sourceDocumentId,
    lineIndex: 4_242,
  })
  assert.equal(missing.ok, false)
  if (missing.ok) return
  assert.equal(missing.refusal.kind, 'no_such_residue_row')
})

/* ====================================================================== *
 * §11  CROSS-RUN UNIQUENESS — G178, #239
 *
 * The five runtime exports §11 of the module adds, each invoked against a
 * CONSTRUCTED value. `tests/model/unique-within.test.ts` is the deep suite;
 * this is the breadth pass, and its job is only to make sure nothing here
 * arrived unexercised.
 *
 * ⚠️ THESE CANNOT BE REACHED BY DRIVING THE CORPUS, and the reason is the
 * design rather than a gap in the fixtures. `period` and `tenant_lifetime`
 * cross RUN boundaries, so the ledger projection they evaluate against is
 * injected by the caller after a batched query the engine never makes — G178
 * rules exactly that, for the reason `AdmissionContext.fieldClassification`
 * already establishes. A scenario that ran one population through
 * `reconcileSets()` would touch none of this, which is why the calls below are
 * direct.
 * ====================================================================== */

test('test_the_uniqueness_preflight_and_evaluator_are_invoked_against_constructed_values', () => {
  const path = [{ kind: 'key', key: 'invoice_number' }] as unknown as FieldPath
  const digest = 'sha256:corpus' as SubjectDigest

  const preflight = used(
    'uniquenessPreflight',
    uniquenessPreflight([
      {
        kind: 'unique_within',
        subject: { kind: 'field', slot: 'invoice', path },
        scope: 'tenant_lifetime',
      },
    ]),
  )
  assert.equal(preflight.subjects.length, 1)
  assert.deepStrictEqual(preflight.defects, [])

  const scopes = used('UNIQUENESS_SCOPES', Object.values(UNIQUENESS_SCOPES))
  assert.equal(scopes.length, 4)

  /* Amendment (a). An unsupplied map REFUSES; it does not pass. Both arms are
   * driven, because a register that counted only the happy path would report
   * the export as exercised while the fail-closed half had never run. */
  const refused = used(
    'evaluateUniqueWithin',
    evaluateUniqueWithin({ scope: 'tenant_lifetime', digest, conflicts: { byScope: new Map() } }),
  )
  assert.equal(refused.kind, 'refused')

  const conflicts = { byScope: new Map([['tenant_lifetime', new Set([digest])]] as const) }
  const duplicate = evaluateUniqueWithin({ scope: 'tenant_lifetime', digest, conflicts })
  assert.equal(duplicate.kind, 'duplicate')

  /* Amendment (c). The pinnable projection, order-stable. */
  const pinned = used('uniquenessConflictPinning', uniquenessConflictPinning(conflicts))
  assert.deepStrictEqual(pinned, [['tenant_lifetime', ['sha256:corpus']]])

  /* Amendment (d). Bounded retry, counted suppression — and the race arm, not
   * only the clean insert. */
  const account = used(
    'accountLedgerWrite',
    accountLedgerWrite([{ kind: 'raced' }, { kind: 'inserted' }], 3),
  )
  assert.equal(account.settled, 'inserted')
  assert.equal(account.suppressedRepeats, 1)
  assert.equal(account.attemptBudget, 3)
})

/**
 * 🛑 THE HONEST NUMBER. This test is the deliverable of the file.
 *
 * It compares the set of runtime exports on disk against the set of names
 * `used()` actually registered while the tests above ran, in BOTH directions:
 *
 *   · a runtime export nobody invoked fails as `never invoked`;
 *   · a registered name the module no longer exports fails as `registered but
 *     not exported`, which is what catches a rename that left a stale wrapper
 *     behind.
 *
 * ⚠️ IT DELIBERATELY DOES NOT COUNT THE TYPE-LEVEL EXPORTS. Mentioning a type
 * in a signature is not testing it, and a coverage number that counted them
 * would read as high and mean nothing — which is worse than a low one, because
 * it stops anyone looking.
 */
test('test_every_runtime_export_of_the_module_was_invoked_by_a_constructed_value', () => {
  const runtime = [...CENSUS.runtime].sort()
  const invoked = [...TOUCHED].sort()

  const neverInvoked = runtime.filter((name) => !TOUCHED.has(name))
  const notExported = invoked.filter(
    (name) => !CENSUS.runtime.includes(name) && !CENSUS.reExported.includes(name),
  )

  assert.deepStrictEqual(
    neverInvoked,
    [],
    `${runtime.length - neverInvoked.length} of ${runtime.length} runtime exports were invoked; ` +
      `these were not: ${neverInvoked.join(', ')}`,
  )
  assert.deepStrictEqual(
    notExported,
    [],
    `registered but not exported by the module: ${notExported.join(', ')}`,
  )

  /* ⚠️ G286/G111 — THE RE-EXPORTED SURFACE, ASSERTED RATHER THAN IGNORED. It is
   * out of the coverage number above on purpose (see `ExportCensus.reExported`),
   * and a bucket nobody checks is a bucket anything can be put in. Both halves:
   * it is non-empty, so the parse is not silently reading nothing; and every
   * value name in it is really declared by `model/money.ts`, so a re-export that
   * drifted from the codec fails here rather than at somebody's import. */
  assert.ok(CENSUS.reExported.length > 0, 'the money surface must still be re-exported')
  assert.deepStrictEqual(
    CENSUS.reExported.filter((name) => !CODEC_CENSUS.runtime.includes(name)),
    [],
    're-exported from `model/reconciliation.ts` but not declared by `model/money.ts`',
  )
  /* ⚠️ THE TOTAL NOW HAS TWO TERMS — G286. It read `assert.equal(invoked.length,
   * runtime.length)`, which was exact while every name this file registered was
   * DECLARED by the module. Eleven of them are now RE-EXPORTED from the codec,
   * and folding those into `runtime` would inflate the coverage denominator with
   * declarations another module owns. Both directions above already pin the
   * membership; this line pins that nothing was counted twice. */
  const touchedReExports = CENSUS.reExported.filter((name) => TOUCHED.has(name))
  assert.equal(invoked.length, runtime.length + touchedReExports.length)
})

/**
 * The other half of the number, asserted so nobody has to take it on trust: the
 * type-level exports are NOT claimed. This test states the gap in the same place
 * the coverage is stated, because a gap recorded somewhere else is a gap nobody
 * reads.
 */
test('test_no_type_level_export_is_counted_as_exercised_by_this_file', () => {
  const overlap = CENSUS.typeLevel.filter((name) => TOUCHED.has(name))
  assert.deepStrictEqual(
    overlap,
    [],
    'a `type` or `interface` has no runtime behaviour a value can observe; ' +
      'the `_…HoldsNoText` assertions are discharged by `tsc -p tests/tsconfig.json`, ' +
      'and the corpus KNOWN_GAPS records that proving them RED needs a deliberate `string` field',
  )
})

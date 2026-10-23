/**
 * G227 (#248 [W-13]) — A READ BELOW THE CONFIDENCE FLOOR IS HELD AND ASKED
 * ABOUT, AND IT FOLDS INTO THE RESIDUE AS A CAUSE.
 *
 * 🛑 THE GAP, STATED THE WAY THE ISSUE STATED IT. `FieldSpec.confidenceFloor`'s
 * own docblock opens *"The extraction confidence below which a person is asked
 * instead of guessed at."* HELD AND ASKED — not refused. `AdmissionRefusal` had
 * seven arms and none of them was a floor breach, and **that absence was correct
 * rather than missing**: a refusal DISCARDS the value, and the design requires a
 * person to see it. What was missing is that **no type expressed the held state
 * either** — nothing carried the `ItemRef` a read came from, the `FieldPath` it
 * was reading, the confidence it achieved or the floor it missed. The floor was a
 * number with an enforcement story and no artefact.
 *
 * 🛑 THE BEHAVIOURAL RED IS §1 AND IT IS THE POINT OF THIS FILE. The obvious fix
 * is a NEW `AdmissionRefusal` arm. It passes every *"the floor is enforced"*
 * assertion anybody would write and it breaks the design the floor states about
 * itself — the value would be discarded instead of shown. §1 therefore asserts
 * that NO ARM OF THAT UNION IS A FLOOR BREACH. **It passed at base and it must
 * keep passing**: it is the regression guard against the repair that looks like
 * the fix, not a test of new behaviour.
 *
 * ⚠️ §1 SAID *"the union is UNCHANGED at seven"* AND ASSERTED `arms.length === 7`
 * UNTIL OQ-1 WAS FIXED, AND THAT IS CORRECTED RATHER THAN DELETED because the
 * sentence is quoted in `model/reconciliation.ts`'s `ResidueCause` docblock and
 * a reader would have trusted it. The union now has EIGHT arms: OQ-1 added
 * `amount_not_exact_money`, because `admitOne` never called `guardMoney` and a
 * row whose minor units were `1.5`, `NaN` or past the exact integer range was
 * ADMITTED and then left the ledger entirely. **That arm is not this file's
 * defect returning** — there is no value to show when the value cannot be
 * added, subtracted or compared — and the count was the LANDMARK, not the
 * property. §1 is re-keyed onto the property and onto the seven arms BY NAME,
 * so a deleted arm still fails while an added one does not.
 *
 * ⚠️ AND IT IS NOT A THIRD RESULT CHANNEL EITHER. C18 refused `populationFindings`
 * as *"a channel with no caller obligation"*. The residue HAS one — something must
 * dispose of every entry, which is what makes `settlement` required — so a held
 * read dropped there inherits an obligation to resolve it. The same fact on a
 * channel of its own would inherit none. That is C18's argument APPLIED, not
 * overruled.
 *
 * ⚠️ NO FLOOR VALUE IS INVENTED ANYWHERE IN THIS SLICE. Under G139 the floor is
 * FDE-set pack configuration and there is no surface that sets one ([M2-3]). The
 * fixture below supplies one; nothing in `model/` defaults it, and §4 asserts
 * that absence holds nothing rather than holding everything.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runSetReconciliation, itemKey } from '../../model/reconciliation.ts'
import type {
  AssertNoTextDeep,
  HeldRead,
  ItemRef,
  PopulationBinding,
  ResidueEntry,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import type {
  DataClass,
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
const MODULE_TEXT = readFileSync(join(REPO_ROOT, 'model', 'reconciliation.ts'), 'utf8')

/* G214 — a `FieldPath` is a token list minted only by the seam. */
function p(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`fixture declares an unparseable FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}
const k = (path: FieldPath): FieldPathKey => fieldPathKey(path)

/* ==================================================================== *
 * THE FIXTURE — two rows that WOULD pair, one of them read badly
 *
 * 🛑 THE TWO ROWS ARE BUILT TO PAIR EXACTLY, and that is the whole design of
 * this fixture. Same reference, same amount, same date. Without a floor they
 * match and neither reaches the residue. With a floor on the LEFT row's amount
 * the engine holds it — so the residue growing from zero to two rows is a
 * consequence of the hold and of nothing else, and there is no *"it was going to
 * be residue anyway"* reading available.
 * ==================================================================== */

const TENANT = 'tenant-below-floor-fixture' as TenantId
const DOC_TYPE = 'doctype-below-floor-fixture' as DocumentTypeId

const AMOUNT_PATH: FieldPath = p('invoice', 'total')
const DATE_PATH: FieldPath = p('date')
const REF_PATH: FieldPath = p('reference')

const CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<FieldPathKey, DataClass>([
  [k(AMOUNT_PATH), 'internal'],
  [k(DATE_PATH), 'internal'],
  [k(REF_PATH), 'internal'],
])

const LEFT_DOC = 'doc-ledger-below-floor' as SourceDocumentId
const RIGHT_DOC = 'doc-statement-below-floor' as SourceDocumentId

/**
 * ⚠️ A FIXTURE CHOICE AND NOT A RECOMMENDATION. `PRODUCT.md` forbids inventing a
 * figure and nothing in `model/` carries one; these two numbers exist only so
 * that one is below the other. `FieldSpec.confidenceFloor` is stated as a
 * fraction in the corpus (`model/examples.ts`), and this file states BOTH
 * operands in that same unit rather than converting either — see `HeldRead.floor`
 * on why a second representation would be the defect.
 */
const FLOOR = 0.95
const A_BAD_READ = 0.42

function value(scalar: ExtractedScalar, confidence: number | null): ExtractedValue {
  const provenance: Provenance = { page: null, boundingBox: null, confidence }
  return { scalar, provenance }
}

function sgd(minor: bigint): Money {
  return { currency: 'SGD', amountMinor: minor, exponent: 2 }
}

function row(reference: string, minor: bigint, amountConfidence: number | null): ExtractedLine {
  return {
    index: 0,
    fields: {
      [k(AMOUNT_PATH)]: value({ kind: 'money', value: sgd(minor) }, amountConfidence),
      [k(DATE_PATH)]: value({ kind: 'date', value: '2026-03-03' }, 1),
      [k(REF_PATH)]: value({ kind: 'identifier', value: reference }, 1),
    },
  }
}

function documentOf(docId: SourceDocumentId, line: ExtractedLine): SourceDocument {
  return {
    tenantId: TENANT,
    id: docId,
    documentTypeId: DOC_TYPE,
    filename: `${docId}.csv`,
    storageRef: `fixture://${docId}`,
    extracted: {},
    lines: [line],
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

function inputOf(options: {
  readonly leftAmountConfidence: number | null
  readonly confidenceFloors: ReadonlyMap<FieldPathKey, number>
}): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'exact_identifier', on: REF_PATH }
  return {
    runId: 'run-below-floor-fixture' as RunId,
    tenantId: TENANT,
    left: population(),
    right: population(),
    leftDocuments: [documentOf(LEFT_DOC, row('INV-9001', 250_00n, options.leftAmountConfidence))],
    rightDocuments: [documentOf(RIGHT_DOC, row('INV-9001', 250_00n, 1))],
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
    confidenceFloors: options.confidenceFloors,
    subsetSumBound: { maxMembers: 8, stepBudget: 5000, maxBucketSize: 50 },
    readerCandidateCap: 5,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    admissionRefusalCeilingBasisPoints: 9_999,
  }
}

const NO_FLOORS: ReadonlyMap<FieldPathKey, number> = new Map<FieldPathKey, number>()
const AMOUNT_FLOOR: ReadonlyMap<FieldPathKey, number> = new Map<FieldPathKey, number>([
  [k(AMOUNT_PATH), FLOOR],
])

function runOrFail(input: SetReconciliationInput): SetReconciliationResult {
  const outcome = runSetReconciliation(input)
  assert.ok(outcome.ok, `the engine refused the fixture: ${outcome.ok ? '' : outcome.refusal.kind}`)
  return outcome.result
}

const heldRun = (): SetReconciliationResult =>
  runOrFail(inputOf({ leftAmountConfidence: A_BAD_READ, confidenceFloors: AMOUNT_FLOOR }))

function leftEntry(result: SetReconciliationResult): ResidueEntry {
  const entry = result.residue.find((candidate) => candidate.ref.sourceDocumentId === LEFT_DOC)
  assert.ok(entry !== undefined, 'the held row must reach the residue')
  return entry
}

/* ====================================================================== *
 * §1  THE REGRESSION GUARD — it passed at base and must keep passing
 * ====================================================================== */

test('test_no_arm_of_AdmissionRefusal_is_a_floor_breach', () => {
  /* 🛑 THE ASSERTION THE ISSUE WAS FILED WITH, RUN AS CODE RATHER THAN QUOTED.
   * A floor arm here would be the repair that looks like the fix: it enforces
   * the floor and it discards the value the floor exists to have looked at.
   *
   * ⚠️ THIS TEST WAS NAMED `test_AdmissionRefusal_still_has_SEVEN_arms_and_a
   * _floor_breach_is_not_one` AND ITS FIRST ASSERTION WAS `arms.length === 7`.
   * It is corrected rather than deleted, because it is the control a reader
   * would have trusted to mean *"nobody has turned a hold into a refusal"*.
   *
   * 🛑 THE COUNT WAS A LANDMARK AND THE LANDMARK MOVED FOR A REASON THAT HAS
   * NOTHING TO DO WITH G227. OQ-1 — a row whose `amountMinor` was not an exact
   * integer was ADMITTED, because `admitOne` never called `guardMoney`, and it
   * then left the ledger entirely: in neither the residue nor the allocations,
   * with `refusedAtAdmission` empty. The fix is an EIGHTH arm,
   * `amount_not_exact_money`, and it is a refusal in exactly the sense G227
   * argued a floor breach is not: there is no value to show, because the value
   * cannot be added, subtracted or compared at all.
   *
   * 🛑 SO THE CONTROL IS RE-KEYED ONTO THE PROPERTY IT PROTECTS RATHER THAN
   * ONTO THE NUMBER THAT HAPPENED TO EXPRESS IT — which is §5.1, arriving
   * inside a control written to hold §5.1's line. `!block.includes('floor')` is
   * the assertion that was always doing the work, and it is untouched: G227's
   * ruling is that a below-floor read is HELD, and no arm of this union may be
   * a floor breach however many arms there are. The arm count is still read,
   * and it is still asserted — as a LOWER bound with the union's own names
   * listed, so a deleted arm is a failure and an added one is not.
   */
  const block = MODULE_TEXT.slice(
    MODULE_TEXT.indexOf('export type AdmissionRefusal ='),
    MODULE_TEXT.indexOf('export type _AdmissionRefusalHoldsNoText'),
  )
  assert.ok(block.length > 0, 'the union or its proof has been renamed — this control is inert')
  const arms = block.split('\n').filter((line) => /^ {2}\| \{ kind:/.test(line))

  /* THE SEVEN THAT EXISTED WHEN G227 WAS RULED, BY NAME. A count would have
   * passed while one of them was quietly swapped for a floor arm; this does
   * not. */
  for (const kind of [
    'field_not_classified',
    'field_absent',
    'amount_not_money',
    'date_not_extractable',
    'date_not_iso_calendar',
    'identifier_not_extractable',
    'money_unit_disagrees_with_declared',
  ]) {
    assert.ok(
      arms.some((arm) => arm.includes(`'${kind}'`)),
      `AdmissionRefusal lost the arm \`${kind}\`. G227 reasoned about these seven; removing one is a decision, not a refactor.`,
    )
  }
  assert.ok(
    !block.includes('floor'),
    'a floor breach is not an admission refusal — a refusal discards the value',
  )
})

test('guard · with NO floor declared the two rows PAIR and the residue is empty', () => {
  /* The negative control that makes §2 mean something. Same fixture, same rows,
   * no floor: they match, and nothing reaches the residue at all. */
  const result = runOrFail(inputOf({ leftAmountConfidence: A_BAD_READ, confidenceFloors: NO_FLOORS }))
  assert.deepEqual(result.residue, [])
  assert.deepEqual(result.refusedAtAdmission, [])
})

/* ====================================================================== *
 * §2  THE RED — there was no field to read, so this did not COMPILE at base
 * ====================================================================== */

test('test_a_read_below_the_floor_is_HELD_and_never_refused', () => {
  const result = heldRun()

  /* 🛑 THE CENTRAL ASSERTION, IN THE NEGATIVE. The run's refused count does NOT
   * grow. The value was read, kept, admitted and shown — it was not discarded. */
  assert.deepEqual(result.refusedAtAdmission, [])
  assert.deepEqual(
    result.admissionRates.map((rate) => [rate.side, rate.presented, rate.admitted, rate.refused]),
    [
      ['left', 1, 1, 0],
      ['right', 1, 1, 0],
    ],
  )

  const entry = leftEntry(result)
  assert.equal(entry.cause.kind, 'read_held_below_floor')
  assert.equal(entry.heldReads.length, 1)
  const [held] = entry.heldReads
  assert.ok(held !== undefined)

  /* The four things G227 requires survive the fold. */
  assert.deepEqual(held.ref, { sourceDocumentId: LEFT_DOC, lineIndex: 0 })
  assert.deepEqual(
    [...held.path],
    [
      { kind: 'key', key: 'invoice' },
      { kind: 'key', key: 'total' },
    ],
    'the DECLARED path, as a token list — G214, and never a dotted string',
  )
  assert.equal(held.readConfidence, A_BAD_READ)
  assert.equal(held.floor, FLOOR)

  /* AND THE VALUE IS STILL IN THE LEDGER. A held row is open, not absent: its
   * settlement is derivable and its amount is the amount that was read. */
  assert.ok(entry.settlement !== null)
  assert.equal(entry.settlement.kind, 'unallocated')
})

test('test_a_held_read_makes_the_item_UNPAIRABLE_rather_than_merely_annotated', () => {
  /* 🛑 THIS IS WHAT *A PERSON IS ASKED* MEANS OPERATIONALLY. An engine that
   * annotated the row and then paired it has asked nobody, and the annotation
   * would never be seen: the item would be `fully_allocated` and the residue
   * builder skips those. The module has already recorded that exact failure once,
   * about `budget_exhausted` — the reason was recorded in a place and the item was
   * removed from the place people look. */
  const result = heldRun()
  assert.deepEqual(result.state.allocations, [], 'nothing may pair on a value we do not trust')

  /* BOTH rows are open — the right one has no partner left — so the residue is
   * two entries and the RIGHT one carries no held read of its own. */
  assert.equal(result.residue.length, 2)
  const right = result.residue.find((entry) => entry.ref.sourceDocumentId === RIGHT_DOC)
  assert.ok(right !== undefined)
  assert.deepEqual(right.heldReads, [])
  assert.equal(right.cause.kind, 'no_strategy_paired')

  /* AND CONSERVATION IS UNTOUCHED. A hold keeps the item IN the ledger, so the
   * partition checks still see it — which is why this is not the pre-engine
   * filter §10's banner refuses. */
  assert.deepEqual(result.postconditions, [])
  assert.ok(result.state.items.has(itemKey('left', { sourceDocumentId: LEFT_DOC, lineIndex: 0 })))
})

test('test_a_held_read_is_never_sent_to_the_quarantined_reader', () => {
  /* Asking a model about a row whose own read the pack declared untrustworthy
   * answers the floor's question — *is a person asked?* — with *no, a model
   * was*. The subject filter and the candidate filter are two different seams
   * and this asserts the run produces no request at all. */
  const result = heldRun()
  assert.deepEqual(result.readerRequests, [])
})

test('test_a_declared_floor_with_NO_reported_confidence_is_held_fail_closed', () => {
  /* 🛑 THE NULL IS A STATE, NOT AN ABSENCE. A floor was declared and the
   * extraction reported no confidence, so there is nothing to compare against it.
   * Passing would be scope failing OPEN, which is the direction G106 and G100
   * both refuse. */
  const result = runOrFail(inputOf({ leftAmountConfidence: null, confidenceFloors: AMOUNT_FLOOR }))
  const [held] = leftEntry(result).heldReads
  assert.ok(held !== undefined)
  assert.equal(held.readConfidence, null)
  assert.equal(held.floor, FLOOR)
})

test('test_a_read_AT_the_floor_clears_it', () => {
  /* A floor is a floor: `>=` and not `>`. The strict form would hold every
   * exactly-conforming read, which is a different rule wearing the same name. */
  const result = runOrFail(inputOf({ leftAmountConfidence: FLOOR, confidenceFloors: AMOUNT_FLOOR }))
  assert.deepEqual(result.residue, [])
})

/* ====================================================================== *
 * §3  THE FOLD — a cause, not a channel, and not an eighth refusal
 * ====================================================================== */

test('test_the_hold_is_a_RESIDUE_CAUSE_and_no_new_result_channel_appeared', () => {
  const result = heldRun()
  /* 🛑 G227 IN ONE ASSERTION, AND IT IS RE-KEYED ONTO THE CLAIM IT WAS ALWAYS
   * MAKING. This test asserted the WHOLE channel set and called it *"the
   * channel SET is still not this ruling's to grow"* — which reads as a
   * standing prohibition and is not one. It is G227's claim ABOUT G227: a held
   * read folds into the residue rather than onto a channel of its own, because
   * the residue already carries a caller obligation and a new channel would
   * carry none. A later ruling is free to grow the set on its own argument, and
   * one did.
   *
   * ⚠️ G291 GREW IT BY ONE — `toleranceDeclines` — AND THAT IS WHY THE
   * ASSERTION IS SPLIT IN TWO RATHER THAN HAVING A KEY ADDED TO IT. Leaving it
   * as a whole-set equality would make every future ruling edit G227's test to
   * say nothing new, which is §5.1: a rule keyed on a convenient landmark (the
   * key count) instead of the property it protects (that G227 minted no
   * channel). The first assertion below is the property, by NAME. The second
   * keeps the full-set check as a tripwire on an UNARGUED channel, with the
   * two rulings that are allowed to be there named in it. */
  assert.ok(
    !Object.keys(result).some((key) => /held|floor|confidence/i.test(key)),
    'G227 minted NO result channel — the held read is a `ResidueCause` and a field on the row. ' +
      `Channels: ${Object.keys(result).sort().join(', ')}`,
  )
  /* And the detail really is on the row, which is the other half of the claim:
   * a prohibition with no positive is a test that passes on an empty result. */
  assert.equal(leftEntry(result).heldReads.length, 1)

  assert.deepEqual(Object.keys(result).sort(), [
    'admissionRates',
    'ambiguities',
    'completeness',
    'documentAccounts',
    'meterFacts',
    'postconditions',
    'readerRequests',
    'refusedAtAdmission',
    'residue',
    /* G217 — ONE channel where `oversizedBuckets` and `exhaustedBuckets` stood.
     * The two arrays it replaced held counterparty-authored join keys and the
     * result carried no containment proof at all; the boundary is counts plus
     * `ItemRef`. */
    'searchBoundary',
    'state',
    /* 🛑 G291, 19 Sep 2026 — THE FIRST CHANNEL ADDED SINCE THIS LIST WAS
     * WRITTEN, and it answers C18's standing objection rather than ignoring it.
     * A bucket the identifier join FOUND and whose totals missed the tolerance
     * was reaching no channel at all, and the cause slot could not hold it: that
     * slot is ONE value and it is DOMINATED, so `control_total_unverified` would
     * absorb the decline — the word G114 forbids. It sits beside
     * `toleranceRefusals` and not inside it because a REFUSAL means *this
     * tolerance is nonsense* and a DECLINE means *this tolerance was too tight*,
     * two findings with two different fixes. `model/reconciliation.ts` §5b
     * carries the argument. */
    'toleranceDeclines',
    'toleranceRefusals',
  ])
})

test('test_the_twelfth_cause_is_declared_once_and_the_disposition_is_the_engines_own', () => {
  const result = heldRun()
  const entry = leftEntry(result)
  /* `unidentified`, not an error disposition: nothing about this row is wrong,
   * it is unresolved. `error_left`/`error_right` are for admission refusals. */
  assert.equal(entry.disposition, 'unidentified')

  const block = MODULE_TEXT.slice(
    MODULE_TEXT.indexOf('export type ResidueCause ='),
    MODULE_TEXT.indexOf('export type _ResidueCauseHoldsNoText'),
  )
  const arms = block.split('\n').filter((line) => /^ {2}\| \{ kind:/.test(line))

  /* 🛑 THIS ASSERTED `arms.length === 12` AND IS RE-KEYED ONTO THE ARM IT
   * REASONS ABOUT, BY NAME — the same repair OQ-1's fix had to make one file
   * over when `amount_not_exact_money` became the eighth `AdmissionRefusal`
   * arm. A total is a LANDMARK: it goes red for any ruling that mints any
   * cause, and every one of those reds is answered by editing a number in
   * G227's test, which teaches the next person that this file's numbers are
   * noise. The property G227 states is *the held read is ONE cause, declared
   * ONCE*, and that is what is asserted here.
   *
   * ⚠️ G291 IS THE RULING THAT PROVED IT. It minted `amount_tolerance_declined`
   * as the thirteenth cause, and the only thing that went red about G227 was a
   * number G227 never cared about. The ARM COUNT still has a control — it is
   * `tests/contracts/engine-read-wire.test.mjs` A3, which compares it against
   * the WIRE, so a cause added to the model and not to the contract is still a
   * red gate. That is the right home for it: there the number is the point. */
  const held = arms.filter((line) => line.includes("kind: 'read_held_below_floor'"))
  assert.equal(held.length, 1, `\`read_held_below_floor\` is declared once: ${arms.join(' | ')}`)

  /* And it carries NO payload — G227's own ruling, argued at the declaration:
   * the field-level detail lives on `ResidueEntry.heldReads`, because a cause
   * is per-ROW and a held read is per-FIELD. An arm that grew a payload here
   * would be a second spelling of that detail (§5.3). */
  assert.equal(held[0]?.trim(), "| { kind: 'read_held_below_floor' }")

  /* The three arms G227's ORDERING reasons about, named rather than counted:
   * `control_total_unverified` dominates it, and it dominates every matching
   * verdict — of which `no_strategy_paired` is the one the docblock names. */
  for (const kind of ['control_total_unverified', 'no_strategy_paired']) {
    assert.ok(
      arms.some((line) => line.includes(`kind: '${kind}'`)),
      `G227's ordering argument names \`${kind}\`, and it is no longer an arm`,
    )
  }
})

/* ====================================================================== *
 * §4  NOTHING IS DEFAULTED — absence holds nothing, and says so
 * ====================================================================== */

test('test_a_path_with_no_declared_floor_holds_nothing_and_no_number_is_invented', () => {
  /* ⚠️ THE ONE PLACE THIS SLICE DELIBERATELY DOES NOT FAIL CLOSED, and the
   * reason is in `AdmissionContext.confidenceFloors`: G106 fails closed on
   * CLASSIFICATION because an unclassified key is unreadable, while a floor is a
   * THRESHOLD and there is no threshold a stated-nothing falls below. Under G139
   * the archetype default is pack configuration with no surface that sets one
   * ([M2-3]), so manufacturing a number here is what `PRODUCT.md` forbids. */
  const result = runOrFail(inputOf({ leftAmountConfidence: 0, confidenceFloors: NO_FLOORS }))
  assert.deepEqual(result.residue, [], 'a confidence of zero with no declared floor holds nothing')

  /* And the module states no floor of its own. A numeric literal compared
   * against a confidence would be the invented figure this asserts against. */
  assert.ok(
    !/confidenceFloor\s*[:=]\s*[0-9]/.test(MODULE_TEXT),
    'model/reconciliation.ts must carry no floor VALUE, only the caller-supplied map',
  )
})

/* ====================================================================== *
 * §5  CONTAINMENT — and the interesting result is the one that FAILS
 *
 * ⚠️ Every `@ts-expect-error` MUST error, or it is `TS2578` and `typecheck:tests`
 * runs before a single assertion here executes. The SAFE case carries no
 * directive, so a proof that over-rejects fails just as loudly.
 * ====================================================================== */

/**
 * 🛑 `AssertNoTextDeep<HeldRead>` IS A COMPILE ERROR AND THAT IS THE PROOF
 * WORKING, NOT A MISSING SITE. `HeldRead` carries a `FieldPath`, whose `key`
 * segment is a bare `string` — a path names counterparty-chosen JSON keys. The
 * absence of a containment site on this record is therefore a FINDING rather
 * than an omission, and it is asserted here so that nobody reads it as
 * forgetfulness and nobody "fixes" it by weakening the proof.
 *
 * `RefusedItem` is the same shape for the same reason: the closed union carrying
 * the REASON holds the proof, the record carrying the declared path does not.
 */
// @ts-expect-error — a `FieldPath` is text-bearing. See above.
export type _HeldReadCannotCarryTheDeepProof = AssertNoTextDeep<HeldRead>

/** The value-free part of the record passes, so the proof is not vacuous here. */
export type _TheHeldReadingIsValueFree = AssertNoTextDeep<{
  readonly ref: ItemRef
  readonly readConfidence: number | null
  readonly floor: number
}>

// @ts-expect-error — 🛑 THE EDIT THIS RECORD EXISTS TO REFUSE. A held read is
// precisely where counterparty content wants to travel: the whole point of
// holding it is that a person will look at the value, and somebody will want the
// value right there on the row. It must be FETCHED under a classification, never
// embedded in the verdict (invariant 6).
export type _AnExtractedValueOnAHeldReadIsRefused = AssertNoTextDeep<{ readonly ref: ItemRef; readonly readConfidence: number | null; readonly floor: number; readonly extractedValue: string }>

/* ====================================================================== *
 * §6  THE INERTNESS GUARD — §5 is types, and a type is erased before node runs
 * ====================================================================== */

test('the hold is enforced at the ONE seam every pass draws from', () => {
  /* Six passes and `buildReaderRequests` reach candidates through `openItems`.
   * Six copies of the test are six branches that agree until somebody adds a
   * seventh pass, and the seventh would pair on values the floor withheld. */
  assert.ok(
    /function openItems\([\s\S]{0,400}?if \(item\.heldReads\.length > 0\) continue/.test(MODULE_TEXT),
    'the hold has left `openItems` — a held item is offerable to a pass again',
  )
  assert.ok(
    MODULE_TEXT.includes('if (entry.heldReads.length > 0) continue'),
    'the reader-subject filter has gone — a held row can reach a model again',
  )
})

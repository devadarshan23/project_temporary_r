/**
 * G123's RIGHT-HAND HALF — the residue-side disposition pass.
 *
 * `mayAutoResolve()` landed on 9 Aug with a fixture and NO PRODUCTION CALLER,
 * and G129's own applied row says so rather than implying it away: *"the gate
 * exists and nothing routes through it"*. A control with zero call sites is the
 * defect this repository names most often — `model/reconciliation.ts` calls it
 * *"`MAX_GRANT_HOURS`'s failure again"* — so this file exists to make the gate
 * load-bearing, not merely present.
 *
 * WHAT IS UNDER TEST, AND WHY THESE FIVE THINGS.
 *
 *   1. G123. The pass runs AFTER `runSetReconciliation`, over its residue, and
 *      the conservation post-conditions still hold afterwards. The negative
 *      control is the whole argument: the same rule applied as a PRE-ENGINE
 *      FILTER is shown breaking `open_item_missing_from_residue` AND
 *      `gross_not_partitioned` on the same fixture. That is the A9(b) shape one
 *      layer above the check written to catch it, demonstrated rather than
 *      asserted.
 *   2. G127. `write_off` is not constructible as a learned disposition. The
 *      control is a `@ts-expect-error` in the typecheck, which bites in BOTH
 *      directions — an unused directive is itself an error — so widening
 *      `LearnedDisposition` back to `SetDisposition` fails `npm test` before a
 *      single assertion runs.
 *   3. G129. The gate is CALLED, its answer is carried on every proposal, and
 *      an irreversible disposition is refused with every dial wide open.
 *   4. G124/G130. The only predicate a learned rule may use is
 *      `extraction_in_set`, and `extraction_refused` stays distinguishable from
 *      an ordinary miss — the distinction `extractionInSetHolds()`'s own
 *      docblock says every call site reporting one must preserve.
 *   5. The pass changes no ledger state and proposes nothing it cannot gate.
 *
 * ⚠️ WHAT THE RED HERE PROVED, AND WHAT IT DID NOT. Every declaration under
 * test is NEW, so the only red available on the first run was ABSENCE —
 * `TS2305: Module … has no exported member`. An import error proves nothing
 * about behaviour. Every assertion below was therefore additionally proved to
 * BITE by mutation: the implementation was changed to the plausible wrong
 * thing, exactly one test was watched to go red, and the change was reverted.
 * The mutations and the test each caught are recorded at the foot of this file.
 *
 * Every expected value below is a LITERAL typed into this file. Not one is
 * re-derived from `settlementOf`, `residualOf` or `valueAtRiskOf` — the folds
 * the engine and the pass use. A total compared against the fold that produced
 * it is a constant compared to itself.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  checkPostconditions,
  itemKey,
  proposeResidueDispositions,
  runSetReconciliation,
  valueAtRiskOf,
  LEARNED_RULE_ACTION,
} from '../../model/reconciliation.ts'
import type {
  LearnedDisposition,
  LearnedDispositionRule,
  PopulationBinding,
  ResidueEntry,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'
import { DISPOSITION_FAMILIES } from '../../model/domain.ts'
import type {
  DataClass,
  Disposition,
  Expr,
  ExtractedScalar,
  ExtractedValue,
  Money,
  PairingStrategy,
  RulePredicate,
  SourceDocument,
} from '../../model/domain.ts'
import { narrowLiveAutonomy } from '../../model/examples.ts'
import type { AutonomyConfig } from '../../model/policy.ts'
import type {
  DocumentTypeId,
  FieldPath,
  FieldPathKey,
  RunId,
  SourceDocumentId,
  TenantId,
} from '../../model/kernel.ts'
import type { LearningEntryId } from '../../model/learning.ts'
import { parseFieldPath, fieldPathKey } from '../../model/field-path.ts'

/* ------------------------------------------------------------------ *
 * G214 — a `FieldPath` is a structured token list, minted only by the seam.
 *
 * ⚠️ EVERY PATH IN THIS FILE WAS A BARE STRING UNTIL 22 Aug 2026 and addressed
 * nothing: `FieldPath` was `= string`. `p()` is the fixture-only unwrap — the
 * seam refuses rather than throwing because a path from a document is a runtime
 * condition, while a path written HERE is a literal and a refusal is a defect in
 * this file. `k()` is the identity token a path takes when it keys a collection,
 * because a path is an ARRAY and an array keys a `Map` by reference.
 * ------------------------------------------------------------------ */
function p(...tokens: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(tokens)
  if (!parsed.ok) throw new Error(`fixture declares an unparseable FieldPath: ${parsed.refusal.kind}`)
  return parsed.path
}
const k = (path: FieldPath): FieldPathKey => fieldPathKey(path)

/* ==================================================================== *
 * The fixture — one tenant, one currency, header-grain documents
 *
 * Deliberately the shape `tests/model/reconciliation-conservation.test.ts`
 * already proves the engine on, plus ONE addition: the cash side names a
 * `description` path, because a learned rule reads the untrusted description
 * and nothing else.
 * ==================================================================== */

const TENANT = 'tenant-learned-fixture' as TenantId
const DOC_TYPE = 'doctype-learned-fixture' as DocumentTypeId

const AMOUNT_PATH: FieldPath = p('amount')
const DATE_PATH: FieldPath = p('date')
const REF_PATH: FieldPath = p('reference')
const PARTY_PATH: FieldPath = p('counterparty')
/** The one path carrying counterparty prose. G106 classifies it like any other. */
const NARRATIVE_PATH: FieldPath = p('narrative')

const CLASSIFICATION: ReadonlyMap<FieldPathKey, DataClass> = new Map<FieldPathKey, DataClass>([
  [k(AMOUNT_PATH), 'internal'],
  [k(DATE_PATH), 'internal'],
  [k(REF_PATH), 'internal'],
  [k(PARTY_PATH), 'internal'],
  [k(NARRATIVE_PATH), 'internal'],
])

interface Row {
  readonly docId: string
  /** Minor units. SGD, exponent 2 — so 10000 is one hundred dollars. */
  readonly minor: bigint
  readonly date: string
  readonly reference: string
  readonly party: string
  /** Counterparty-controlled prose. Null on the ledger side. */
  readonly narrative: string | null
}

/** Obligations, PARTY-A. 15000 minor units between them. */
const OBLIGATION_ONE: Row = {
  docId: 'doc-obl-a', minor: 10000n, date: '2026-01-10',
  reference: 'OBL-A', party: 'PARTY-A', narrative: null,
}
const OBLIGATION_TWO: Row = {
  docId: 'doc-obl-b', minor: 5000n, date: '2026-01-20',
  reference: 'OBL-B', party: 'PARTY-A', narrative: null,
}
/** 20000 of cash against 15000 of obligations. 5000 is left over and OPEN. */
const CASH_STRIPE: Row = {
  docId: 'doc-cash-a', minor: 20000n, date: '2026-02-01',
  reference: 'CASH-A', party: 'PARTY-A', narrative: 'STRIPE PAYOUT SG 0042',
}
/** PARTY-B has cash and no obligations, so this row never pairs at all. */
const CASH_ACME: Row = {
  docId: 'doc-cash-b', minor: 4000n, date: '2026-02-03',
  reference: 'CASH-B', party: 'PARTY-B', narrative: 'ACME REFUND 77',
}

function value(scalar: ExtractedScalar): ExtractedValue {
  return { scalar, provenance: { page: null, boundingBox: null, confidence: null } }
}

function documentOf(row: Row): SourceDocument {
  const extracted: Record<FieldPathKey, ExtractedValue> = {
    [k(AMOUNT_PATH)]: value({
      kind: 'money',
      value: { currency: 'SGD', amountMinor: row.minor, exponent: 2 },
    }),
    [k(DATE_PATH)]: value({ kind: 'date', value: row.date }),
    [k(REF_PATH)]: value({ kind: 'identifier', value: row.reference }),
    [k(PARTY_PATH)]: value({ kind: 'identifier', value: row.party }),
  }
  if (row.narrative !== null) {
    extracted[k(NARRATIVE_PATH)] = value({ kind: 'text', value: row.narrative })
  }
  return {
    tenantId: TENANT,
    id: row.docId as SourceDocumentId,
    documentTypeId: DOC_TYPE,
    filename: `${row.docId}.csv`,
    storageRef: `fixture://${row.docId}`,
    extracted,
    lines: [],
    /* C18. These fixtures are hand-built rows, not files: there is no trailer to
     * find and none is expected. The OFF arm, stated rather than defaulted. */
    controlTotal: { kind: 'not_declared_by_format' },
    ingestedAt: '2026-02-02T00:00:00.000Z',
    synthetic: true,
    purgeAfter: '2027-02-02T00:00:00.000Z',
    purgedAt: null,
  }
}

function population(description: FieldPath | null): PopulationBinding {
  return {
    spec: {
      documentTypeId: DOC_TYPE,
      amount: AMOUNT_PATH,
      date: DATE_PATH,
      identifiers: [REF_PATH],
    },
    /* C16 — declared, not inferred. Every row here is SGD at exponent 2. */
    /* C18. These fixtures build rows by hand; the format they stand in for
     * carries no trailer, so the TYPE says so too and the parser's arm agrees. */
    carriesControlTotal: 'never',
    /* O-15. Every fixture in this file hands the engine rows, so `'refuses'` is
     * the truthful declaration and the posture at the same time. */
    emptyExpectation: 'refuses',
    declaredUnit: { currency: 'SGD', exponent: 2 },
    normalisation: { ops: [], then: 'exact', maxInputChars: 64 },
    counterparty: PARTY_PATH,
    description,
  }
}

const LEDGER = population(null)
const BANK = population(NARRATIVE_PATH)

/**
 * `promptEligible` is a PARAMETER and not a constant, and that is a departure
 * from the spec this file was written against. Admission fills
 * `AdmittedItem.untrustedDescription` only behind BOTH of G106's classification
 * gate and the `modelPromptEligible` projection, so an empty set here yields a
 * residue whose rows carry no readable description at all — the one fixture that
 * can witness `description_unreadable`. See that test for why it exists.
 */
function inputOf(
  left: readonly Row[],
  right: readonly Row[],
  promptEligible: ReadonlySet<FieldPathKey> = new Set<FieldPathKey>([k(NARRATIVE_PATH)]),
): SetReconciliationInput {
  const strategy: PairingStrategy = { kind: 'amount_sum', maxMembers: 4 }
  return {
    runId: 'run-learned-fixture' as RunId,
    tenantId: TENANT,
    left: LEDGER,
    right: BANK,
    leftDocuments: left.map(documentOf),
    rightDocuments: right.map(documentOf),
    pairing: {
      cardinality: 'many_to_many',
      amountTolerance: { kind: 'rounding', minorUnits: 0 },
      dateTolerance: { kind: 'days', value: 0 },
      strategies: [strategy],
    },
    strategyBindings: [{ strategy, amountTolerance: null, amountAnchor: 'exact' }],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
    fieldClassification: CLASSIFICATION,
    modelPromptEligible: promptEligible,
    /* G227. Empty: this suite states no confidence floor, so no read is held and
     * the disposition pass sees the residue it saw before G227 landed. */
    confidenceFloors: new Map<FieldPathKey, number>(),
    subsetSumBound: { maxMembers: 4, stepBudget: 1000, maxBucketSize: 50 },
    readerCandidateCap: 4,
    similarityMaxChars: 128,
    similarityMetric: 'levenshtein_ratio',
    /* C13. Required by the engine and irrelevant to this file's subject: every
     * row of every fixture here is admitted, so the rate is 0 on both sides.
     * A fixture choice with nothing behind it. */
    admissionRefusalCeilingBasisPoints: 2500,
  }
}

function runOrFail(promptEligible?: ReadonlySet<FieldPathKey>): SetReconciliationResult {
  const outcome = runSetReconciliation(
    promptEligible === undefined
      ? inputOf([OBLIGATION_ONE, OBLIGATION_TWO], [CASH_STRIPE, CASH_ACME])
      : inputOf([OBLIGATION_ONE, OBLIGATION_TWO], [CASH_STRIPE, CASH_ACME], promptEligible),
  )
  assert.ok(outcome.ok, `the engine refused the fixture: ${outcome.ok ? '' : outcome.refusal.kind}`)
  return outcome.result
}

/* ==================================================================== *
 * The rules
 *
 * `split_take` on a space, index 0, then `exact` — *"starts with STRIPE"*
 * expressed as ops a finance operator can read, which is G124's deciding
 * argument. Nothing here is a pattern and nothing compiles one.
 * ==================================================================== */

const NARRATIVE_SUBJECT: Expr = { kind: 'field', slot: 'statement', path: NARRATIVE_PATH }

function predicateOn(
  values: readonly string[],
  maxInputChars = 64,
  subject: Expr = NARRATIVE_SUBJECT,
): Extract<RulePredicate, { kind: 'extraction_in_set' }> {
  return {
    kind: 'extraction_in_set',
    subject,
    extraction: {
      ops: [{ kind: 'split_take', separator: ' ', index: 0 }],
      then: 'exact',
      maxInputChars,
    },
    values,
  }
}

/**
 * SUSPENSE. A holding decision — reversible, and the cash stays on the balance
 * sheet awaiting resolution. `unidentified` is the family it lands in.
 */
const SUSPENSE: Disposition = {
  key: 'route_to_suspense',
  label: 'Route to suspense',
  family: 'unidentified',
  reversibility: 'reversible',
  terminal: false,
  requiresAdjustment: false,
}

/** The same routing declared irreversible. Nothing else differs. */
const SUSPENSE_IRREVERSIBLE: Disposition = { ...SUSPENSE, reversibility: 'irreversible' }

const ENTRY_STRIPE = 'lrn-stripe-suspense' as LearningEntryId
const ENTRY_ACME = 'lrn-acme-suspense' as LearningEntryId

const STRIPE_RULE: LearnedDispositionRule = {
  entryId: ENTRY_STRIPE,
  predicate: predicateOn(['STRIPE']),
  proposed: 'unidentified',
  disposition: SUSPENSE,
}

/** A SECOND human assertion, matching the OTHER cash row and nothing else. */
const ACME_RULE: LearnedDispositionRule = {
  entryId: ENTRY_ACME,
  predicate: predicateOn(['ACME']),
  proposed: 'unidentified',
  disposition: SUSPENSE,
}

/* ------------------------------------------------------------------ *
 * Autonomy dials
 * ------------------------------------------------------------------ */

/** Every dial open. Used ONLY to prove irreversibility is not outvoted. */
const everyDialPermits: AutonomyConfig = {
  ...narrowLiveAutonomy,
  maxAutoResolveSeverity: 'critical',
  autonomousIn: { kind: 'all' },
  autoResolveValueCeiling: null,
  permittedActions: [
    'classify', 'extract', 'explain', 'admit',
    'propose_resolution', 'execute_resolution', 'notify', 'close_exception',
  ],
}

/** The context a caller must supply. Neither field is derivable from a residue row. */
const FINANCE_LOW = { severity: 'low', domain: 'finance' } as const

function pass(
  result: SetReconciliationResult,
  rules: readonly LearnedDispositionRule[],
  autonomy: AutonomyConfig = everyDialPermits,
  context: { readonly severity: 'low' | null; readonly domain: 'finance' | null } = FINANCE_LOW,
): ReturnType<typeof proposeResidueDispositions> {
  return proposeResidueDispositions({
    state: result.state,
    residue: result.residue,
    left: LEDGER,
    right: BANK,
    rules,
    autonomy,
    context,
  })
}

/* ==================================================================== *
 * 1. The fixture itself, and that the pass demonstrably runs over it
 * ==================================================================== */

test('test_the_engine_admits_the_fixture_and_leaves_two_open_cash_rows_in_the_residue', () => {
  const result = runOrFail()

  assert.deepEqual(result.refusedAtAdmission, [])
  assert.deepEqual(result.postconditions, [])
  assert.equal(result.state.items.size, 4)

  /* Both residue rows are on the cash side; both obligations settled. Asserted
   * by ref, never by a count — a count passes while the wrong row is present. */
  const docIds = result.residue.map((e) => `${e.side}:${e.ref.sourceDocumentId}`).sort()
  assert.deepEqual(docIds, ['right:doc-cash-a', 'right:doc-cash-b'])
})

test('test_the_pass_proposes_nothing_when_no_rule_matches_and_that_is_distinguishable_from_not_running', () => {
  const result = runOrFail()

  /* A rule whose enumerated value no row carries. `WISE` is not `STRIPE` and
   * is not `ACME`, so every row is an ordinary miss. */
  const noMatch = pass(result, [{ ...STRIPE_RULE, predicate: predicateOn(['WISE']) }])
  assert.deepEqual(noMatch.proposals, [])
  assert.deepEqual(noMatch.unusableRules, [])

  /* NOT RUNNING AT ALL IS A DIFFERENT VALUE, and this is the half a
   * `proposals.length === 0` assertion cannot tell apart. The pass returns both
   * lists, always — an absent key would be `undefined`, which `deepEqual([])`
   * would not accept — and the SAME fixture yields exactly one proposal the
   * moment a rule does match. */
  assert.deepEqual(Object.keys(noMatch).sort(), ['proposals', 'unusableRules'])
  assert.equal(pass(result, [STRIPE_RULE]).proposals.length, 1)
})

/* ==================================================================== *
 * 2. G127 — the boundary is in the TYPE, not in prose
 * ==================================================================== */

test('test_write_off_is_a_declared_set_reconciliation_family_and_is_not_a_learned_disposition', () => {
  /* The exclusion is only meaningful because the family EXISTS and a human may
   * still choose it. G127 forbids a learned rule firing it unattended; it does
   * not remove write-off from the product. */
  assert.ok(DISPOSITION_FAMILIES.set_reconciliation.includes('write_off'))

  /* THE CONTROL. If `LearnedDisposition` is ever widened back to
   * `SetDisposition`, this directive becomes unused and `tsc` fails with
   * `TS2578: Unused '@ts-expect-error' directive` — so the control cannot rot
   * into a comment nobody runs. `npm test` typechecks before it executes. */
  // @ts-expect-error — G127: a learned rule may route to suspense; it may not write off.
  const forbidden: LearnedDisposition = 'write_off'
  assert.equal(forbidden, 'write_off')

  /* And the three that ARE constructible, named one by one. A count would pass
   * while the wrong member was admitted. */
  const timing: LearnedDisposition = 'timing_difference'
  const inTransit: LearnedDisposition = 'in_transit'
  const unidentified: LearnedDisposition = 'unidentified'
  const errorLeft: LearnedDisposition = 'error_left'
  const errorRight: LearnedDisposition = 'error_right'
  assert.deepEqual(
    [timing, inTransit, unidentified, errorLeft, errorRight].sort(),
    ['error_left', 'error_right', 'in_transit', 'timing_difference', 'unidentified'],
  )
})

/* ==================================================================== *
 * 3. G129 — the gate is CALLED, and its answer is on every proposal
 * ==================================================================== */

test('test_a_matching_rule_proposes_its_disposition_and_carries_the_gates_permission', () => {
  const result = runOrFail()
  const proposals = pass(result, [STRIPE_RULE]).proposals

  assert.equal(proposals.length, 1)
  const proposal = proposals[0]
  assert.ok(proposal !== undefined)
  assert.equal(proposal.side, 'right')
  assert.equal(proposal.ref.sourceDocumentId, 'doc-cash-a')
  assert.equal(proposal.ref.lineIndex, null)
  assert.equal(proposal.entryId, ENTRY_STRIPE)
  assert.equal(proposal.proposed, 'unidentified')
  assert.deepEqual(proposal.outcome, { kind: 'gated', allowed: true, reason: 'permitted' })

  /* The FULL key set, so a field added later — a note, an echoed description —
   * is a failure rather than something no assertion happens to look at. */
  assert.deepEqual(
    Object.keys(proposal).sort(),
    ['entryId', 'outcome', 'proposed', 'ref', 'side'],
  )
})

test('test_two_rules_propose_for_their_own_rows_and_each_proposal_names_the_entry_that_made_it', () => {
  /* ADDED TO THIS FILE, not inherited from the spec it was written against —
   * `ENTRY_ACME` was declared there and never used, so nothing proved a
   * proposal carries the entry that PRODUCED it rather than whichever entry the
   * implementation happened to have in hand. With one rule and one row, an
   * implementation that reported a constant entry id would pass every other
   * test in this file. G125/G131: provenance is the point. */
  const result = runOrFail()
  const outcome = pass(result, [STRIPE_RULE, ACME_RULE])

  assert.deepEqual(outcome.unusableRules, [])
  assert.equal(outcome.proposals.length, 2)

  /* Paired by ref, so a swap of the two entry ids is a failure. */
  assert.deepEqual(
    outcome.proposals.map((p) => [p.ref.sourceDocumentId, p.entryId]).sort(),
    [['doc-cash-a', ENTRY_STRIPE], ['doc-cash-b', ENTRY_ACME]].sort(),
  )
  for (const proposal of outcome.proposals) {
    assert.deepEqual(proposal.outcome, { kind: 'gated', allowed: true, reason: 'permitted' })
  }

  /* And neither rule reaches the other's row: ACME alone proposes for cash-b
   * only, on the same residue. */
  const acmeOnly = pass(result, [ACME_RULE]).proposals
  assert.equal(acmeOnly.length, 1)
  assert.equal(acmeOnly[0]?.ref.sourceDocumentId, 'doc-cash-b')
})

test('test_an_irreversible_disposition_is_refused_by_name_even_when_every_dial_permits', () => {
  const result = runOrFail()
  const rule: LearnedDispositionRule = { ...STRIPE_RULE, disposition: SUSPENSE_IRREVERSIBLE }
  const proposals = pass(result, [rule], everyDialPermits).proposals

  assert.equal(proposals.length, 1)
  const proposal = proposals[0]
  assert.ok(proposal !== undefined)
  assert.deepEqual(proposal.outcome, {
    kind: 'gated',
    allowed: false,
    reason: 'autonomy_disposition_irreversible',
  })

  /* The ONLY difference from the permitted case is `reversibility`. Same rule,
   * same row, same dials — so the refusal can have come from nothing else. */
  assert.equal(SUSPENSE.reversibility, 'reversible')
  assert.equal(SUSPENSE_IRREVERSIBLE.reversibility, 'irreversible')
  assert.equal(SUSPENSE_IRREVERSIBLE.key, SUSPENSE.key)
})

test('test_a_refused_gate_names_its_reason_and_leaves_the_row_untouched', () => {
  const result = runOrFail()
  const before = structuredClone(result.residue)

  /* One dial closed: the domain. `narrowLiveAutonomy` is autonomous in finance
   * only, so naming KYC refuses on the domain arm and on nothing else. */
  const kycOnly: AutonomyConfig = {
    ...everyDialPermits,
    autonomousIn: { kind: 'these', values: ['kyc'] },
  }
  const proposals = pass(result, [STRIPE_RULE], kycOnly).proposals

  assert.equal(proposals.length, 1)
  const proposal = proposals[0]
  assert.ok(proposal !== undefined)
  assert.deepEqual(proposal.outcome, {
    kind: 'gated',
    allowed: false,
    reason: 'autonomy_domain_not_permitted',
  })

  /* THE ROW IS UNTOUCHED. Not "still present" — IDENTICAL, field for field,
   * including its engine-assigned disposition and its cause. */
  assert.deepEqual(result.residue, before)
  const row = result.residue.find((e) => e.ref.sourceDocumentId === 'doc-cash-a')
  assert.ok(row !== undefined)
  assert.equal(row.disposition, 'unidentified')
  assert.deepEqual(row.cause, { kind: 'cash_exceeded_obligations' })
})

test('test_the_gated_action_is_execute_resolution_and_a_config_permitting_only_proposal_refuses', () => {
  const result = runOrFail()

  /* Proposing is not the risky act; EXECUTING unattended is. A pass that gated
   * `propose_resolution` would answer a question nobody is asking and leave
   * execution ungated the first time somebody wires it up. */
  assert.equal(LEARNED_RULE_ACTION, 'execute_resolution')

  const mayOnlyPropose: AutonomyConfig = {
    ...everyDialPermits,
    permittedActions: ['propose_resolution'],
  }
  const proposals = pass(result, [STRIPE_RULE], mayOnlyPropose).proposals
  assert.equal(proposals.length, 1)
  const proposal = proposals[0]
  assert.ok(proposal !== undefined)
  assert.deepEqual(proposal.outcome, {
    kind: 'gated',
    allowed: false,
    reason: 'action_not_permitted',
  })
})

test('test_a_stated_value_ceiling_refuses_as_unevaluable_rather_than_approximating_money', () => {
  const result = runOrFail()

  /* G66/G112 ruled the `Money`/`MoneyAmount` collapse and it is NOT applied, so
   * the gate refuses rather than comparing. The pass must carry that refusal
   * through unchanged rather than deciding the row is small enough. */
  const withCeiling: AutonomyConfig = {
    ...everyDialPermits,
    autoResolveValueCeiling: { currency: 'SGD', amountMinor: 1_000_000n },
  }
  const proposals = pass(result, [STRIPE_RULE], withCeiling).proposals
  assert.equal(proposals.length, 1)
  const proposal = proposals[0]
  assert.ok(proposal !== undefined)
  assert.deepEqual(proposal.outcome, {
    kind: 'gated',
    allowed: false,
    reason: 'autonomy_value_ceiling_unevaluable',
  })
})

test('test_the_value_at_risk_handed_to_the_gate_is_the_rows_residual_and_carries_its_currency', () => {
  const result = runOrFail()

  /* Observed through the one arm of the gate that READS the amount: a ceiling
   * in a different currency answers `autonomy_value_currency_mismatch`, and it
   * can only do so if a `Money` reached it. A null `valueAtRisk` falls through
   * to `autonomy_value_ceiling_unevaluable` instead, so the two arms
   * distinguish "the residual was passed" from "nothing was". */
  const foreignCeiling: AutonomyConfig = {
    ...everyDialPermits,
    autoResolveValueCeiling: { currency: 'USD', amountMinor: 1_000_000n },
  }
  const proposals = pass(result, [STRIPE_RULE], foreignCeiling).proposals
  assert.equal(proposals.length, 1)
  const proposal = proposals[0]
  assert.ok(proposal !== undefined)
  assert.deepEqual(proposal.outcome, {
    kind: 'gated',
    allowed: false,
    reason: 'autonomy_value_currency_mismatch',
  })
})

/* ==================================================================== *
 * 4. `valueAtRiskOf` — the one field this pass CAN derive from a residue row
 * ==================================================================== */

test('test_value_at_risk_is_the_residual_not_the_gross_on_a_partially_allocated_row', () => {
  const result = runOrFail()
  const row = result.residue.find((e) => e.ref.sourceDocumentId === 'doc-cash-a')
  assert.ok(row !== undefined)

  const derived = valueAtRiskOf(row)
  assert.ok(derived.ok)
  /* 20000 of cash met 15000 of obligations. The value still at risk is 5000 —
   * every figure a literal, none read back out of the fold that produced it. */
  assert.equal(derived.value.amountMinor, 5000n)
  assert.equal(derived.value.currency, 'SGD')
  assert.equal(derived.value.exponent, 2)
})

test('test_value_at_risk_is_the_whole_amount_on_an_unallocated_row', () => {
  const result = runOrFail()
  const row = result.residue.find((e) => e.ref.sourceDocumentId === 'doc-cash-b')
  assert.ok(row !== undefined)

  const derived = valueAtRiskOf(row)
  assert.ok(derived.ok)
  assert.equal(derived.value.amountMinor, 4000n)
  assert.equal(derived.value.currency, 'SGD')
})

test('test_value_at_risk_refuses_on_a_row_with_no_settlement_and_on_a_closed_one', () => {
  const noSettlement: ResidueEntry = {
    side: 'right',
    ref: { sourceDocumentId: 'doc-refused' as SourceDocumentId, lineIndex: null },
    /* The shape an item REFUSED AT ADMISSION carries: it has no amount, so it
     * has no settlement, and nothing may invent a zero for it. */
    settlement: null,
    disposition: 'error_right',
    cause: { kind: 'admission_refused', refusal: { kind: 'date_not_iso_calendar' } },
    /* G227. A refused row has no admitted item, so no read of it was held. */
    heldReads: [],
  }
  assert.deepEqual(valueAtRiskOf(noSettlement), { ok: false })

  const closed: Money = { currency: 'SGD', amountMinor: 9000n, exponent: 2 }
  const fullyAllocated: ResidueEntry = {
    ...noSettlement,
    settlement: { kind: 'fully_allocated', allocated: closed },
    disposition: 'unidentified',
    cause: { kind: 'no_strategy_paired' },
  }
  /* A closed item in the residue is `fully_allocated_item_in_residue` — an
   * unsound run. Refusing is the fail-closed reading; reporting the ALLOCATED
   * amount as at-risk would be a fabricated figure on an already-broken row. */
  assert.deepEqual(valueAtRiskOf(fullyAllocated), { ok: false })
})

/* ==================================================================== *
 * 5. What the pass will not do — rules it refuses, and rows it cannot read
 * ==================================================================== */

test('test_a_rule_whose_normalisation_is_invalid_is_unusable_and_evaluates_no_row', () => {
  const result = runOrFail()
  const invalid: LearnedDispositionRule = {
    ...STRIPE_RULE,
    predicate: predicateOn(['STRIPE'], 0),
  }
  const outcome = pass(result, [invalid])

  assert.deepEqual(outcome.proposals, [])
  assert.deepEqual(outcome.unusableRules, [
    {
      entryId: ENTRY_STRIPE,
      reason: {
        kind: 'normalisation_invalid',
        defects: [{ kind: 'max_input_chars_not_stated' }],
      },
    },
  ])
})

test('test_a_rule_enumerating_no_value_is_unusable_rather_than_silently_false_forever', () => {
  const result = runOrFail()
  const outcome = pass(result, [{ ...STRIPE_RULE, predicate: predicateOn([]) }])

  assert.deepEqual(outcome.proposals, [])
  assert.deepEqual(outcome.unusableRules, [
    { entryId: ENTRY_STRIPE, reason: { kind: 'no_enumerated_values' } },
  ])
})

test('test_a_rule_whose_subject_names_a_path_that_is_no_sides_description_is_unusable', () => {
  const result = runOrFail()
  const wrongSubject: LearnedDispositionRule = {
    ...STRIPE_RULE,
    predicate: predicateOn(['STRIPE'], 64, {
      kind: 'field', slot: 'statement', path: AMOUNT_PATH,
    }),
  }
  const outcome = pass(result, [wrongSubject])

  /* Silently evaluating this against the description would run the rule over a
   * field its author never named. It is refused BY NAME instead. */
  assert.deepEqual(outcome.proposals, [])
  assert.deepEqual(outcome.unusableRules, [
    { entryId: ENTRY_STRIPE, reason: { kind: 'subject_not_the_description' } },
  ])
})

test('test_a_rule_whose_declared_disposition_disagrees_with_what_it_proposes_is_unusable', () => {
  const result = runOrFail()
  const disagreeing: LearnedDispositionRule = {
    ...STRIPE_RULE,
    proposed: 'in_transit',
    disposition: SUSPENSE,
  }
  const outcome = pass(result, [disagreeing])

  /* The gate reads `disposition.reversibility`. If the record it reads is not
   * the disposition being proposed, the gate is gating a different act — §5.6
   * with two objects instead of one. */
  assert.equal(SUSPENSE.family, 'unidentified')
  assert.deepEqual(outcome.proposals, [])
  assert.deepEqual(outcome.unusableRules, [
    { entryId: ENTRY_STRIPE, reason: { kind: 'disposition_family_disagrees' } },
  ])
})

test('test_an_extraction_refusal_is_reported_and_stays_distinguishable_from_an_ordinary_miss', () => {
  const result = runOrFail()

  /* `maxInputChars: 4` refuses both narratives before any op runs. That is NOT
   * the same fact as "no enumerated value matched", and collapsing the two
   * would make a refusal invisible at the one place anybody reports it. */
  const capped: LearnedDispositionRule = {
    ...STRIPE_RULE,
    predicate: predicateOn(['STRIPE'], 4),
  }
  const outcome = pass(result, [capped])

  assert.deepEqual(outcome.unusableRules, [])
  assert.equal(outcome.proposals.length, 2)
  for (const proposal of outcome.proposals) {
    assert.deepEqual(proposal.outcome, { kind: 'not_gated', reason: 'extraction_refused' })
  }
  assert.deepEqual(
    outcome.proposals.map((p) => p.ref.sourceDocumentId).sort(),
    ['doc-cash-a', 'doc-cash-b'],
  )

  /* The ordinary miss produces NO row at all, on the same fixture. */
  assert.deepEqual(pass(result, [{ ...STRIPE_RULE, predicate: predicateOn(['WISE']) }]).proposals, [])
})

test('test_a_row_whose_description_was_never_readable_is_refused_by_name_rather_than_silently_missed', () => {
  /* ADDED TO THIS FILE. The spec it was written against had the pass skip such
   * a row silently, and that is the one gap in it I judged to be a defect:
   * `AdmittedItem.untrustedDescription` is filled only behind G106's
   * classification gate AND `modelPromptEligible`, and the second is a
   * MODEL-PROMPT gate while a learned rule makes no model call. So a tenant
   * whose descriptions are classified but not prompt-eligible would have EVERY
   * learned rule silently disabled, reported as `proposals: []` — the same
   * value as "no rule matched". Two very different facts, one output. */
  const unreadable = runOrFail(new Set<FieldPathKey>())
  assert.deepEqual(unreadable.postconditions, [])

  const outcome = pass(unreadable, [STRIPE_RULE])
  assert.deepEqual(outcome.unusableRules, [])
  assert.equal(outcome.proposals.length, 2)
  for (const proposal of outcome.proposals) {
    assert.deepEqual(proposal.outcome, { kind: 'not_gated', reason: 'description_unreadable' })
  }
  assert.deepEqual(
    outcome.proposals.map((p) => p.ref.sourceDocumentId).sort(),
    ['doc-cash-a', 'doc-cash-b'],
  )

  /* THE CONTROL: the ONLY difference is `modelPromptEligible`. The same rule on
   * the same fixture with the description eligible gates one row normally, so
   * the refusal above cannot have come from anything else. */
  const readable = pass(runOrFail(), [STRIPE_RULE]).proposals
  assert.equal(readable.length, 1)
  assert.deepEqual(readable[0]?.outcome, { kind: 'gated', allowed: true, reason: 'permitted' })
})

test('test_an_undeclared_severity_refuses_before_the_gate_rather_than_defaulting_to_one', () => {
  const result = runOrFail()
  const proposals = pass(result, [STRIPE_RULE], everyDialPermits, {
    severity: null, domain: 'finance',
  }).proposals

  assert.equal(proposals.length, 1)
  const proposal = proposals[0]
  assert.ok(proposal !== undefined)
  /* A residue row HAS no severity — there is no `Exception` yet. Inventing
   * `'low'` here would buy a pass through the severity dial with a number
   * nobody stated. */
  assert.deepEqual(proposal.outcome, { kind: 'not_gated', reason: 'severity_not_supplied' })
})

test('test_an_undeclared_domain_refuses_before_the_gate_rather_than_defaulting_to_finance', () => {
  const result = runOrFail()
  const proposals = pass(result, [STRIPE_RULE], everyDialPermits, {
    severity: 'low', domain: null,
  }).proposals

  assert.equal(proposals.length, 1)
  const proposal = proposals[0]
  assert.ok(proposal !== undefined)
  assert.deepEqual(proposal.outcome, { kind: 'not_gated', reason: 'domain_not_supplied' })
})

/* ==================================================================== *
 * 6. G123 — THE PROPERTY THAT DECIDED THE DESIGN
 * ==================================================================== */

test('test_the_conservation_postconditions_still_hold_after_the_pass_has_run', () => {
  const result = runOrFail()
  assert.deepEqual(result.postconditions, [])

  const outcome = pass(result, [STRIPE_RULE])
  assert.equal(outcome.proposals.length, 1)

  /* Re-checked against the SAME state and the SAME residue the pass was given.
   * The pass removes no item, mints no allocation and rewrites no row, so this
   * is still empty — and the next test proves the check would have noticed. */
  assert.deepEqual(checkPostconditions(result.state, result.residue, result.admissionRates), [])
  assert.equal(result.state.items.size, 4)
  assert.equal(result.state.allocations.length, 2)
  assert.equal(result.residue.length, 2)
})

test('test_the_same_rule_applied_as_a_pre_engine_filter_breaks_both_conservation_checks', () => {
  const result = runOrFail()

  /* THE NEGATIVE CONTROL FOR THE TEST ABOVE, and G123's whole argument as an
   * executable fact. A pre-engine filter removes the record before the engine
   * runs, so the row is outside the proof entirely: the item is still admitted
   * and still open, and the residue no longer accounts for it.
   *
   * Simulated here by removing exactly the row the STRIPE rule matched — no
   * other difference — and re-running the SAME post-conditions. */
  const filtered: readonly ResidueEntry[] = result.residue.filter(
    (e) => itemKey(e.side, e.ref) !== itemKey('right', {
      sourceDocumentId: 'doc-cash-a' as SourceDocumentId, lineIndex: null,
    }),
  )
  assert.equal(filtered.length, 1)

  const failures = checkPostconditions(result.state, filtered, result.admissionRates)
  assert.deepEqual(failures, [
    { kind: 'open_item_missing_from_residue', count: 1 },
    /* 39000 admitted; 34000 accounted for once the 5000 residual stops being
     * carried. The 5000 is the money that left without the residue knowing. */
    { kind: 'gross_not_partitioned', admittedMinor: 39000n, accountedMinor: 34000n },
  ])
})

test('test_the_pass_mutates_nothing_it_was_given', () => {
  const result = runOrFail()

  /* A9(e), the same way the engine's own contract states it: under strict mode
   * an assignment to a frozen object throws, so a mutating implementation fails
   * loudly instead of passing quietly. */
  Object.freeze(result.residue)
  for (const entry of result.residue) Object.freeze(entry)
  Object.freeze(result.state)
  Object.freeze(result.state.allocations)
  Object.freeze(STRIPE_RULE)
  Object.freeze(everyDialPermits)

  const outcome = pass(result, Object.freeze([STRIPE_RULE]))
  assert.equal(outcome.proposals.length, 1)
  assert.equal(result.residue.length, 2)
  assert.equal(result.state.allocations.length, 2)
})

/* ==================================================================== *
 * MUTATIONS RUN, AND THE TEST EACH ONE CAUGHT
 *
 * Every declaration above is new, so the first red was ABSENCE and proved
 * nothing about behaviour. These are the plausible wrong implementations. Each
 * was applied to `model/reconciliation.ts`, the suite was run, the named test
 * was watched to fail, and the file was reverted and verified byte-identical.
 *
 *   M1  `LearnedDisposition = SetDisposition` (drop the `Exclude`)
 *       → TS2578, unused `@ts-expect-error`. The G127 control, biting.
 *   M2  the gate call replaced by `{ allowed: true, reason: 'permitted' }`
 *       → irreversible, domain, action and both ceiling tests.
 *   M3  `valueAtRiskOf` returns the item's GROSS instead of the residual
 *       → the residual test (5000 → 20000).
 *   M4  `extraction_refused` folded into the ordinary-miss branch
 *       → the refusal/miss distinction test.
 *   M5  the `validateNormalisation` refusal skipped
 *       → the invalid-normalisation test.
 *   M6  `LEARNED_RULE_ACTION` changed to `'propose_resolution'`
 *       → the action-dial test.
 *   M7  `subject.path` check dropped
 *       → the wrong-subject test.
 *   M8  the family-agreement check dropped
 *       → the disagreeing-disposition test.
 *   M9  the pass returns a residue with matched rows removed
 *       → the conservation test, via `open_item_missing_from_residue`.
 * ==================================================================== */

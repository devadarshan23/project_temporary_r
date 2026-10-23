/* ====================================================================== *
 * THE BREADTH PASS OVER `model/reconciliation.ts`.
 *
 * WHAT THIS FILE IS. Assertions, and nothing else. Every input and every
 * expected value lives in `./recon-corpus.ts`; this file only drives the engine
 * and compares. That separation is deliberate — the corpus states what the
 * SPECIFICATION requires, and a test that also owned the expectation could
 * quietly move it.
 *
 * 🛑 A FAILING ASSERTION HERE IS A FINDING, NOT A TEST TO ADJUST. The module
 * landed with no construction site anywhere (`docs/HANDOFF.md` §5.10 at the
 * largest scale in this record), so finding a defect is the EXPECTED outcome of
 * running it for the first time. Do NOT weaken an expectation to make this file
 * green: the corpus's §U (`KNOWN_DISAGREEMENTS_AT_HEAD`) records where the
 * module and the specification already disagree, and bending a test to match a
 * bug blesses the bug forever.
 *
 * WHAT A GREEN RUN OF THIS FILE PROVES, AND WHAT IT DOES NOT. It proves the
 * engine behaves as specified ON THESE INPUTS. It proves nothing about the
 * compile-time containment proofs (`AssertNoTextDeep`), which no value can
 * reach, and nothing about the reader seam being integrated — nothing here
 * calls a model. `KNOWN_GAPS` in the corpus is the authority on what is not
 * covered; read it before quoting a coverage number from this run.
 *
 * ILLUSTRATIVE SYNTHETIC DATA throughout, by way of the corpus. No figure here
 * is a customer result.
 * ====================================================================== */

import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EXTRACTION_OP_KINDS,
  addMoney,
  admitPopulation,
  allocatedOf,
  applyAllocation,
  applyExtraction,
  applyReaderVerdicts,
  buildReaderRequests,
  checkPostconditions,
  compareMoney,
  guardMoney,
  isNegativeMoney,
  isPositiveMoney,
  isZeroMoney,
  itemKey,
  levenshteinBasisPoints,
  minMoney,
  minorUnitsOf,
  notImplementedReader,
  parseCalendarDate,
  passAmountAndDate,
  passAmountSum,
  passFuzzyReference,
  passIdentifierJoin,
  residualOf,
  runMeterFact,
  runSetReconciliation,
  settlementOf,
  subtractMoney,
  toleranceAdmits,
  tokenMeterFacts,
  validateNormalisation,
  zeroLike,
} from '../../model/reconciliation.ts'
import type {
  ItemRef,
  ItemSettlement,
  MatchingState,
  PairingEvidence,
  ReaderRequest,
  ResidueEntry,
  SearchBoundary,
  SetReconciliationResult,
  ToleranceDecline,
} from '../../model/reconciliation.ts'

import {
  ADMISSION_RATE_VECTORS,
  ALLOCATION_PROBES,
  AMOUNT_AND_DATE_PROBES,
  AMOUNT_SUM_PROBES,
  CALENDAR_ANCHOR_VECTORS,
  CALENDAR_GAP_VECTORS,
  CALENDAR_VECTORS,
  EXTRACTION_OP_KINDS_COVERED,
  EXTRACTION_VECTORS,
  FUZZY_PROBES,
  IDENTIFIER_JOIN_PROBES,
  ITEM_KEY_VECTORS,
  MONEY_PREDICATE_VECTORS,
  MONEY_VECTORS,
  NORMALISATION_DEFECT_VECTORS,
  PATHS,
  POSTCONDITION_PROBES,
  READER_VECTORS,
  REFUSAL_SCENARIOS,
  RUN_METER_VECTOR,
  SCENARIOS,
  SIMILARITY_VECTORS,
  SYNTHETIC_CATALOGUE_ROW,
  TOKEN_METER_VECTORS,
  TOLERANCE_VECTORS,
  admittedStateFor,
  cleanIdentifierMatch,
  duplicateIdentifierIsAnAmbiguity,
  freeTextMultiEntityBuildsAReaderRequest,
  leftoverCashLandsInResidue,
  mny,
  twoCurrenciesNeverMatchAcross,
} from './recon-corpus.ts'
import type {
  ExpectedPassOutcome,
  ExpectedSearchBoundary,
  ExpectedSearchBoundaryEntry,
  ExpectedSettlement,
  ExpectedToleranceDecline,
  ItemAddress,
  Scenario,
} from './recon-corpus.ts'

/* ====================================================================== *
 * §1  PROJECTIONS — how an engine value is compared to a stated expectation
 *
 * Every projection below is lossless in the dimension it names and drops only
 * the `Money` wrapper, because the corpus states amounts in minor units. None
 * of them re-derives anything: a projection that computed a value would be a
 * second implementation of the thing under test.
 * ====================================================================== */

/* G217 — the corpus states an `ItemAddress`; the engine reports an `ItemRef`.
 * These two project both onto the same shape so a mismatch names the FIELD that
 * differs rather than dumping two structurally unrelated objects. */
function statedBoundaryEntries(
  stated: readonly ExpectedSearchBoundaryEntry[],
): readonly { readonly itemCount: number; readonly exampleRef: ItemRef }[] {
  return stated.map((entry) => ({ itemCount: entry.itemCount, exampleRef: entry.example.ref }))
}

function boundaryProjection(boundary: SearchBoundary): Record<string, unknown> {
  return {
    oversizedBuckets: boundary.oversizedBuckets.map((e) => ({ ...e })),
    exhaustedSearches: boundary.exhaustedSearches.map((e) => ({ ...e })),
    oversizedAmountBuckets: boundary.oversizedAmountBuckets.map((e) => ({ ...e })),
  }
}

/* G291 — the same two-projections device, one channel over. The corpus states
 * an `ItemAddress` and the engine reports an `ItemRef`; neither side re-derives
 * `signedVarianceMinor`, which is the point of stating it. */
function declineProjection(
  declines: readonly ToleranceDecline[],
): readonly Record<string, unknown>[] {
  return declines.map((d) => ({ ...d }))
}

function statedDeclines(
  stated: readonly ExpectedToleranceDecline[],
): readonly Record<string, unknown>[] {
  return stated.map((d) => ({
    leftItemCount: d.leftItemCount,
    rightItemCount: d.rightItemCount,
    signedVarianceMinor: d.signedVarianceMinor,
    exampleRef: d.example.ref,
  }))
}

function statedBoundary(stated: ExpectedSearchBoundary): Record<string, unknown> {
  return {
    oversizedBuckets: statedBoundaryEntries(stated.oversizedBuckets).map((e) => ({ ...e })),
    exhaustedSearches: statedBoundaryEntries(stated.exhaustedSearches).map((e) => ({ ...e })),
    oversizedAmountBuckets: statedBoundaryEntries(stated.oversizedAmountBuckets).map((e) => ({
      ...e,
    })),
  }
}

function keyOf(address: ItemAddress): string {
  return itemKey(address.side, address.ref)
}

interface FlatAllocation {
  readonly fromKey: string
  readonly toKey: string
  /* ⚠️ `bigint` since 19 Sep 2026 — G286. It comes out of `minorUnitsOf`. */
  readonly amountMinor: bigint
  readonly evidence: PairingEvidence
}

/**
 * `JSON.stringify` with money spelled, G286.
 *
 * A `bigint` throws under the plain call. Rendered as its DECIMAL STRING, which
 * is the form G65 puts on the wire, so a sequence compared here is the sequence
 * a consumer would see.
 */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, raw: unknown) =>
    typeof raw === 'bigint' ? raw.toString(10) : raw,
  )
}

function actualAllocations(state: MatchingState): FlatAllocation[] {
  return state.allocations.map((allocation) => ({
    fromKey: allocation.fromKey,
    toKey: allocation.toKey,
    amountMinor: minorUnitsOf(allocation.amount),
    evidence: allocation.evidence,
  }))
}

function statedAllocations(
  expected: readonly {
    readonly from: ItemAddress
    readonly to: ItemAddress
    readonly amountMinor: bigint
    readonly evidence: PairingEvidence
  }[],
): FlatAllocation[] {
  return expected.map((allocation) => ({
    fromKey: keyOf(allocation.from),
    toKey: keyOf(allocation.to),
    amountMinor: allocation.amountMinor,
    evidence: allocation.evidence,
  }))
}

/**
 * `ItemSettlement` carries `Money`; the corpus states minor units and uses
 * `null` for the member a given arm does not have. A settlement that is absent
 * entirely — an item refused at admission — stays `null`, and that distinction
 * is load-bearing: a refused row HAS no amount, and inventing a zero for it is
 * the exact defect the module's own comment on `ResidueEntry.settlement`
 * records.
 */
function actualSettlement(settlement: ItemSettlement | null): ExpectedSettlement | null {
  if (settlement === null) return null
  if (settlement.kind === 'unallocated') {
    return { kind: 'unallocated', allocatedMinor: null, residualMinor: minorUnitsOf(settlement.residual) }
  }
  if (settlement.kind === 'fully_allocated') {
    return { kind: 'fully_allocated', allocatedMinor: minorUnitsOf(settlement.allocated), residualMinor: null }
  }
  return {
    kind: 'partially_allocated',
    allocatedMinor: minorUnitsOf(settlement.allocated),
    residualMinor: minorUnitsOf(settlement.residual),
  }
}

function actualResidue(residue: readonly ResidueEntry[]): unknown[] {
  return residue.map((entry) => ({
    key: itemKey(entry.side, entry.ref),
    settlement: actualSettlement(entry.settlement),
    cause: entry.cause,
    disposition: entry.disposition,
  }))
}

function statedResidue(scenario: Scenario): unknown[] {
  return scenario.expect.residue.map((entry) => ({
    key: keyOf(entry.item),
    settlement: entry.settlement,
    cause: entry.cause,
    disposition: entry.disposition,
  }))
}

function actualReaderRequests(requests: readonly ReaderRequest[]): unknown[] {
  return requests.map((request) => ({
    requestOrdinal: request.requestOrdinal,
    subjectRef: request.subjectRef,
    untrustedDescription: request.untrustedDescription,
    untrustedDescriptionClass: request.untrustedDescriptionClass,
    candidates: request.candidates.map((candidate) => ({
      index: candidate.index,
      ref: candidate.ref,
      identifierForPrompt: candidate.identifierForPrompt,
    })),
  }))
}

function statedReaderRequests(scenario: Scenario): unknown[] {
  return scenario.expect.readerRequests.map((request) => ({
    requestOrdinal: request.requestOrdinal,
    subjectRef: request.subject.ref,
    untrustedDescription: request.untrustedDescription,
    untrustedDescriptionClass: request.untrustedDescriptionClass,
    candidates: request.candidates.map((candidate) => ({
      index: candidate.index,
      ref: candidate.ref,
      identifierForPrompt: candidate.identifierForPrompt,
    })),
  }))
}

/** The run must COMPLETE. A refusal where a result was specified is itself a failure. */
function resultOf(scenario: Scenario): SetReconciliationResult {
  const outcome = runSetReconciliation(scenario.input)
  ok(
    outcome.ok,
    `${scenario.name}: the specification requires a completed run; the engine refused with ` +
      `${outcome.ok ? '' : outcome.refusal.kind}`,
  )
  return outcome.result
}

function passProjection(
  outcome: { readonly state: MatchingState; readonly ambiguities: readonly unknown[]; readonly toleranceRefusals: readonly unknown[] },
): { allocations: FlatAllocation[]; ambiguities: readonly unknown[]; toleranceRefusals: readonly unknown[] } {
  return {
    allocations: actualAllocations(outcome.state),
    ambiguities: outcome.ambiguities,
    toleranceRefusals: outcome.toleranceRefusals,
  }
}

function statedPassProjection(expected: ExpectedPassOutcome): {
  allocations: FlatAllocation[]
  ambiguities: readonly unknown[]
  toleranceRefusals: readonly unknown[]
} {
  return {
    allocations: statedAllocations(expected.allocations),
    ambiguities: expected.ambiguities,
    toleranceRefusals: expected.toleranceRefusals,
  }
}

/** A9(e): the engine mutates nothing it was given. Frozen input is the witness. */
function deepFreeze(value: unknown, seen: Set<unknown> = new Set<unknown>()): void {
  if (value === null || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)
  if (value instanceof Map) {
    for (const entry of value.values()) deepFreeze(entry, seen)
  } else if (value instanceof Set) {
    for (const entry of value.values()) deepFreeze(entry, seen)
  } else {
    for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry, seen)
  }
  Object.freeze(value)
}

function scenarioNamed(name: string): Scenario {
  const found = SCENARIOS.find((scenario) => scenario.name === name)
  ok(found !== undefined, `the corpus no longer exports a scenario called ${name}`)
  return found
}

/* ====================================================================== *
 * §2  THE TWENTY-TWO END-TO-END SCENARIOS
 *
 * One `describe` per scenario, one `it` per dimension of the expectation, so a
 * failure names the dimension rather than dumping the whole run.
 * ====================================================================== */

/**
 * 🛑 `fuzzyTieIsAnAmbiguity` IS EXPECTED TO FAIL TWO OF THESE ASSERTIONS AT
 * HEAD, and that is the point of it. `passFuzzyReference` raises an
 * `AmbiguityFinding` with `rightCandidates: tied` but `rightRefs:
 * [best.item.ref]` — one ref — so the finding's count contradicts its own ref
 * list, and `runSetReconciliation` then attributes `identifier_ambiguous` only
 * to refs NAMED in a finding. The second tied candidate lands as
 * `no_strategy_paired`: two rows in the same tie, two different reasons, one of
 * them untrue. See `KNOWN_DISAGREEMENTS_AT_HEAD` in the corpus. DO NOT weaken
 * either assertion to make this green — the module is owned by another
 * workstream and the fix belongs there.
 */
describe('runSetReconciliation · the corpus scenarios', () => {
  for (const scenario of SCENARIOS) {
    describe(`${scenario.name} — topology ${scenario.topology}`, () => {
      it('allocates exactly what the specification states, in order', () => {
        deepStrictEqual(
          actualAllocations(resultOf(scenario).state),
          statedAllocations(scenario.expect.allocations),
          scenario.expect.summary,
        )
      })

      it('raises exactly the stated ambiguity findings', () => {
        deepStrictEqual(resultOf(scenario).ambiguities, scenario.expect.ambiguities)
      })

      it('refuses exactly the stated rows at admission', () => {
        const refused = resultOf(scenario).refusedAtAdmission.map((entry) => ({
          key: itemKey(entry.side, entry.ref),
          path: entry.path,
          refusal: entry.refusal,
        }))
        const stated = scenario.expect.refusedAtAdmission.map((entry) => ({
          key: keyOf(entry.item),
          path: entry.path,
          refusal: entry.refusal,
        }))
        deepStrictEqual(refused, stated)
      })

      it('produces exactly the stated residue, in the stated order', () => {
        deepStrictEqual(actualResidue(resultOf(scenario).residue), statedResidue(scenario))
      })

      it('builds exactly the stated reader requests', () => {
        deepStrictEqual(actualReaderRequests(resultOf(scenario).readerRequests), statedReaderRequests(scenario))
      })

      it('reports exactly the stated tolerance refusals, declines and search boundary', () => {
        const result = resultOf(scenario)
        deepStrictEqual(result.toleranceRefusals, scenario.expect.toleranceRefusals)
        /* 🛑 G291 — THE TWO TOLERANCE CHANNELS ARE ASSERTED SEPARATELY AND THE
         * SEPARATION IS THE ASSERTION. A REFUSAL is *this tolerance is
         * nonsense*; a DECLINE is *this tolerance was too tight*. Before G291
         * the second reached nothing at all and twenty-nine scenarios stating
         * `NO_TOLERANCE_REFUSALS` were silently true about both. */
        deepStrictEqual(
          declineProjection(result.toleranceDeclines),
          statedDeclines(scenario.expect.toleranceDeclines),
        )
        /* G217 — all THREE channels, and the expectation carries counts and
         * addresses rather than the counterparty keys it used to. The old
         * assertion reached one channel; the other two were stated nowhere. */
        deepStrictEqual(
          boundaryProjection(result.searchBoundary),
          statedBoundary(scenario.expect.searchBoundary),
        )
      })

      /* ⚠️ THE TITLE READ *"leaves a SOUND ledger — the post-conditions are
       * empty"* AND C17 ENDED THAT. `bothCopiesRefusedIsStillTheNamedOutcome`
       * expects `item_in_residue_twice`: a duplicated ADDRESS whose copies are
       * both refused is reported rather than refused, and that named outcome is
       * what C17's at-least-one-admitted narrowing exists to preserve. The
       * assertion is unchanged — it has always compared against the stated
       * list — but a title claiming every run is sound would now be false. */
      it('reports exactly the stated post-conditions', () => {
        deepStrictEqual(
          resultOf(scenario).postconditions,
          scenario.expect.postconditions,
          'a non-empty post-condition list means the run produced an unsound ledger and must not be persisted',
        )
      })

      it('meters the run and prices nothing (invariant 5)', () => {
        const facts = resultOf(scenario).meterFacts
        deepStrictEqual(
          facts.map((fact) => ({ meter: fact.meter, quantity: fact.quantity })),
          scenario.expect.meterFacts.map((fact) => ({ meter: fact.meter, quantity: fact.quantity })),
        )
        for (const fact of facts) {
          strictEqual(fact.idempotencyKey, `${scenario.input.runId}#${fact.meter}`, 'the key is never bare')
          strictEqual(fact.modelEntryId, null, 'a run meter names no catalogue row')
          deepStrictEqual(Object.keys(fact).sort(), ['idempotencyKey', 'meter', 'modelEntryId', 'quantity'])
        }
      })

      it('is DETERMINISTIC — the same input twice gives an identical result', () => {
        const first = runSetReconciliation(scenario.input)
        const second = runSetReconciliation(scenario.input)
        deepStrictEqual(first, second, 'the engine takes no clock and no randomness')
        ok(first.ok && second.ok)
        /* ⚠️ `stableJson`, NOT `JSON.stringify` — G286, 19 Sep 2026. An
         * allocation carries `amountMinor`, which is `bigint`, and
         * `JSON.stringify` THROWS on one. G71 names that throw as a FEATURE: it
         * forces the boundary decision at the boundary. This IS a boundary, so
         * the decision is taken — the decimal string, which is the wire form —
         * rather than worked around. */
        strictEqual(
          stableJson(actualAllocations(first.result.state)),
          stableJson(actualAllocations(second.result.state)),
          'the allocation SEQUENCE, not merely the set, must be reproducible — RunTrigger.rerun',
        )
      })

      it('mutates nothing it was given — A9(e), witnessed by a frozen input', () => {
        const clone = structuredClone(scenario.input)
        deepFreeze(clone)
        /* Under ESM strict mode an assignment to a frozen object THROWS, so a
         * mutating implementation fails loudly here instead of passing. */
        const outcome = runSetReconciliation(clone)
        deepStrictEqual(outcome, runSetReconciliation(scenario.input))
      })
    })
  }
})

/* ====================================================================== *
 * §3  THE TWO MONEY-LOSING SHAPES, ASSERTED IN THEIR OWN RIGHT
 *
 * Both are already covered by §2. They are restated here because the residue
 * assertion above would still pass if the corpus's own expectation drifted, and
 * these two are the ones where drift costs money.
 * ====================================================================== */

describe('leftover cash lands in the RESIDUE, by amount and by ref — A9(b)', () => {
  const result = resultOf(leftoverCashLandsInResidue)
  /* The cash row is whichever item the corpus says the waterfall poured OUT of. */
  const cashAddress = leftoverCashLandsInResidue.expect.allocations[0]?.from
  const cashKey = cashAddress === undefined ? '' : keyOf(cashAddress)

  it('carries the cash row in the residue exactly once', () => {
    const appearances = result.residue.filter((entry) => itemKey(entry.side, entry.ref) === cashKey)
    strictEqual(appearances.length, 1, 'a partition is a partition')
  })

  it('names the leftover as an OPEN residual, never as a variance field', () => {
    const entry = result.residue.find((candidate) => itemKey(candidate.side, candidate.ref) === cashKey)
    ok(entry !== undefined, 'the cash row must be in the residue at all')
    deepStrictEqual(entry.cause, { kind: 'cash_exceeded_obligations' })
    deepStrictEqual(actualSettlement(entry.settlement), {
      kind: 'partially_allocated',
      allocatedMinor: 150_00n,
      residualMinor: 50_00n,
    })
  })

  it('conserves the gross: everything admitted is either settled or carried', () => {
    /* ⚠️ `0n` SINCE 19 Sep 2026 — G286. These three are CUMULATIVE TOTALS over
     * a population, which is the case `Number.isSafeInteger`'s ceiling reached
     * first and the reason the ruling was taken. The three asserted VALUES below
     * are unchanged. */
    let admittedMinor = 0n
    for (const item of result.state.items.values()) admittedMinor += minorUnitsOf(item.gross)
    let carriedMinor = 0n
    for (const entry of result.residue) {
      const settlement = entry.settlement
      if (settlement === null) continue
      if (settlement.kind === 'unallocated') carriedMinor += minorUnitsOf(settlement.residual)
      if (settlement.kind === 'partially_allocated') carriedMinor += minorUnitsOf(settlement.residual)
    }
    let allocatedMinor = 0n
    for (const allocation of result.state.allocations) allocatedMinor += minorUnitsOf(allocation.amount)
    /* Each allocation moves value between TWO items, so it accounts for twice
     * its own amount across the two populations. 35000 admitted = 2 × 15000
     * allocated + 5000 still carried. */
    strictEqual(admittedMinor, 35_000n)
    strictEqual(allocatedMinor * 2n + carriedMinor, admittedMinor, 'no money may vanish between the two')
  })
})

describe('a duplicate canonical id is an AMBIGUITY, never a last-wins collapse — A9(a)', () => {
  const result = resultOf(duplicateIdentifierIsAnAmbiguity)

  it('allocates NOTHING', () => {
    strictEqual(result.state.allocations.length, 0, 'a collapse would have silently paired one of the two')
  })

  it('raises one finding that NAMES every candidate on both sides', () => {
    strictEqual(result.ambiguities.length, 1)
    const finding = result.ambiguities[0]
    ok(finding !== undefined)
    strictEqual(finding.leftCandidates, finding.leftRefs.length, 'the count and the ref list must agree')
    strictEqual(finding.rightCandidates, finding.rightRefs.length, 'the count and the ref list must agree')
  })

  it('drops no record — every admitted item is in the residue', () => {
    strictEqual(result.residue.length, result.state.items.size)
    for (const entry of result.residue) deepStrictEqual(entry.cause, { kind: 'identifier_ambiguous' })
  })
})

/* ====================================================================== *
 * §4  RUN-LEVEL REFUSALS — every arm of `SetReconciliationRefusal`
 * ====================================================================== */

describe('runSetReconciliation · refusals', () => {
  for (const scenario of REFUSAL_SCENARIOS) {
    it(`${scenario.name} refuses with the stated arm`, () => {
      deepStrictEqual(runSetReconciliation(scenario.input), { ok: false, refusal: scenario.expect }, scenario.derivedFrom)
    })
  }
})

/* ====================================================================== *
 * §5  UNIT VECTORS — the total functions underneath the fold
 * ====================================================================== */

describe('§3 money — exact integer arithmetic in minor units', () => {
  for (const vector of MONEY_VECTORS) {
    it(vector.name, () => {
      const outcome =
        vector.op === 'add'
          ? addMoney(vector.a, vector.b)
          : vector.op === 'subtract'
            ? subtractMoney(vector.a, vector.b)
            : vector.op === 'compare'
              ? compareMoney(vector.a, vector.b)
              : minMoney(vector.a, vector.b)

      if (!vector.expect.ok) {
        ok(!outcome.ok, `${vector.name}: expected a refusal — ${vector.why}`)
        strictEqual(outcome.refusal.kind, vector.expect.refusal, vector.why)
        return
      }
      ok(outcome.ok, `${vector.name}: expected a value — ${vector.why}`)
      const value = outcome.value
      strictEqual(
        /* ⚠️ G286: `MoneyExpectation.value` is `bigint`, because for every op
         * but `compare` it IS an amount. `compare` returns a SIGN — three
         * valued, no minor units — so the sign is widened to compare against
         * it rather than the amount being narrowed, which would be the ceiling
         * coming back through a test. */
        typeof value === 'number' ? BigInt(value) : minorUnitsOf(value),
        vector.expect.value,
        vector.why,
      )
    })
  }
})

describe('§3 money predicates', () => {
  for (const vector of MONEY_PREDICATE_VECTORS) {
    it(vector.name, () => {
      strictEqual(minorUnitsOf(vector.value), vector.minorUnits)
      strictEqual(isZeroMoney(vector.value), vector.isZero)
      strictEqual(isPositiveMoney(vector.value), vector.isPositive)
      strictEqual(isNegativeMoney(vector.value), vector.isNegative)
      const guard = guardMoney(vector.value)
      strictEqual(guard === null ? null : guard.kind, vector.guardRefusal)
      const zero = zeroLike(vector.value)
      strictEqual(minorUnitsOf(zero), vector.zeroLikeMinor)
      strictEqual(zero.currency, vector.value.currency, 'zeroLike never invents a currency')
      strictEqual(zero.exponent, vector.value.exponent, 'nor a scale')
    })
  }
})

describe('§3 toleranceAdmits — a verdict, or a refusal, never a coercion', () => {
  for (const vector of TOLERANCE_VECTORS) {
    it(vector.name, () => {
      const verdict = toleranceAdmits(vector.left, vector.right, vector.tolerance, vector.direction)
      if (!vector.expect.ok) {
        ok(!verdict.ok, vector.why)
        deepStrictEqual(verdict.refusal, vector.expect.refusal, vector.why)
        return
      }
      ok(verdict.ok, vector.why)
      strictEqual(verdict.admitted, vector.expect.admitted, vector.why)
      strictEqual(verdict.signedVarianceMinor, vector.expect.signedVarianceMinor, 'variance is left minus right')
    })
  }
})

describe('§2 applyExtraction — deterministic normalisation, no RegExp', () => {
  for (const vector of EXTRACTION_VECTORS) {
    it(vector.name, () => {
      const outcome = applyExtraction(vector.input, vector.normalisation)
      if (!vector.expect.ok) {
        ok(!outcome.ok, vector.why)
        deepStrictEqual(outcome.refusal, vector.expect.refusal, vector.why)
        return
      }
      ok(outcome.ok, vector.why)
      strictEqual(outcome.key, vector.expect.key, vector.why)
    })
  }

  it('EXTRACTION_OP_KINDS is covered exhaustively — a fifth op is a failure, not a gap', () => {
    deepStrictEqual(
      [...Object.values(EXTRACTION_OP_KINDS)].sort(),
      [...EXTRACTION_OP_KINDS_COVERED].sort(),
    )
  })
})

describe('§2 validateNormalisation — defects in declaration order', () => {
  for (const vector of NORMALISATION_DEFECT_VECTORS) {
    it(vector.name, () => {
      deepStrictEqual(validateNormalisation(vector.normalisation), vector.expect)
    })
  }
})

describe('§4 parseCalendarDate — A9(f), and never `new Date`', () => {
  for (const vector of CALENDAR_VECTORS) {
    it(`${vector.input} → ${vector.expectIso ?? 'refused'}`, () => {
      const parsed = parseCalendarDate(vector.input)
      strictEqual(parsed === null ? null : parsed.iso, vector.expectIso, vector.why)
    })
  }

  for (const vector of CALENDAR_ANCHOR_VECTORS) {
    it(`${vector.input} is day ${vector.dayNumber}`, () => {
      const parsed = parseCalendarDate(vector.input)
      ok(parsed !== null)
      strictEqual(parsed.dayNumber, vector.dayNumber, 'days since 1970-01-01, by integer arithmetic')
    })
  }

  for (const vector of CALENDAR_GAP_VECTORS) {
    it(`${vector.from} → ${vector.to} is ${vector.gapDays} day(s)`, () => {
      const from = parseCalendarDate(vector.from)
      const to = parseCalendarDate(vector.to)
      ok(from !== null && to !== null)
      strictEqual(to.dayNumber - from.dayNumber, vector.gapDays, vector.why)
    })
  }
})

describe('§6 levenshteinBasisPoints — the only rounding in the module', () => {
  for (const vector of SIMILARITY_VECTORS) {
    it(`${vector.a || '∅'} vs ${vector.b || '∅'} (cap ${vector.maxChars})`, () => {
      strictEqual(levenshteinBasisPoints(vector.a, vector.b, vector.maxChars), vector.expectBasisPoints, vector.why)
    })
  }
})

describe('§4 itemKey — length-prefixed, and injective for any id content', () => {
  for (const vector of ITEM_KEY_VECTORS) {
    it(vector.expectKey, () => {
      strictEqual(itemKey(vector.side, vector.ref), vector.expectKey, vector.why)
    })
  }
})

describe('§8 meters — a measurement, never a price (invariant 5)', () => {
  for (const vector of TOKEN_METER_VECTORS) {
    it(vector.name, () => {
      const facts = tokenMeterFacts({ ...vector.usage, modelEntryId: SYNTHETIC_CATALOGUE_ROW })
      strictEqual(facts.length, vector.expect.length, vector.why)
      facts.forEach((fact, index) => {
        const stated = vector.expect[index]
        ok(stated !== undefined)
        strictEqual(fact.meter, stated.meter)
        strictEqual(fact.quantity, stated.quantity)
        strictEqual(fact.idempotencyKey, stated.idempotencyKey, vector.why)
      })
    })
  }

  it('runMeterFact keys on `${runId}#${meter}` and names no catalogue row', () => {
    const fact = runMeterFact(RUN_METER_VECTOR.runId, RUN_METER_VECTOR.meter, RUN_METER_VECTOR.quantity)
    strictEqual(fact.idempotencyKey, RUN_METER_VECTOR.expectIdempotencyKey)
    strictEqual(fact.modelEntryId, RUN_METER_VECTOR.expectModelEntryId)
    strictEqual(fact.quantity, RUN_METER_VECTOR.quantity)
    deepStrictEqual(Object.keys(fact).sort(), ['idempotencyKey', 'meter', 'modelEntryId', 'quantity'])
  })
})

/* ====================================================================== *
 * §6  THE LEDGER — settlement derivation and every `AllocationRefusal` arm
 * ====================================================================== */

describe('§5 the ledger — settlement is DERIVED, never a stored field', () => {
  const base = admittedStateFor(cleanIdentifierMatch)
  const stated = cleanIdentifierMatch.expect.allocations[0]
  const paymentKey = stated === undefined ? '' : keyOf(stated.from)
  const invoiceKey = stated === undefined ? '' : keyOf(stated.to)
  const evidence: PairingEvidence = { kind: 'exact_identifier', on: PATHS.reference }

  it('an untouched item is `unallocated` with its whole gross outstanding', () => {
    const allocated = allocatedOf(base, invoiceKey)
    const residual = residualOf(base, invoiceKey)
    const settlement = settlementOf(base, invoiceKey)
    ok(allocated.ok && residual.ok && settlement.ok)
    strictEqual(minorUnitsOf(allocated.value), 0n)
    strictEqual(minorUnitsOf(residual.value), 125_00n)
    deepStrictEqual(actualSettlement(settlement.value), {
      kind: 'unallocated',
      allocatedMinor: null,
      residualMinor: 125_00n,
    })
  })

  it('a part pour leaves `partially_allocated` with the remainder visible', () => {
    const poured = applyAllocation(base, paymentKey, invoiceKey, mny(50_00n), evidence)
    ok(poured.ok)
    const settlement = settlementOf(poured.state, invoiceKey)
    ok(settlement.ok)
    deepStrictEqual(actualSettlement(settlement.value), {
      kind: 'partially_allocated',
      allocatedMinor: 50_00n,
      residualMinor: 75_00n,
    })
  })

  it('a full pour closes both ends and leaves the source state untouched', () => {
    const poured = applyAllocation(base, paymentKey, invoiceKey, mny(125_00n), evidence)
    ok(poured.ok)
    for (const key of [paymentKey, invoiceKey]) {
      const settlement = settlementOf(poured.state, key)
      ok(settlement.ok)
      strictEqual(settlement.value.kind, 'fully_allocated')
    }
    strictEqual(base.allocations.length, 0, 'applyAllocation returns a FRESH state; it never mutates')
  })

  it('an unknown key yields no settlement at all', () => {
    /* The arm is asserted only as "not ok". `MoneyRefusal` has no `unknown_item`
     * member, so the module reuses `currency_mismatch` here — recorded as a
     * finding rather than pinned by this test, which would bless the mislabel. */
    ok(!allocatedOf(base, 'left:0::h').ok)
    ok(!residualOf(base, 'left:0::h').ok)
    ok(!settlementOf(base, 'left:0::h').ok)
  })
})

describe('§5 applyAllocation — every refusal arm', () => {
  const base = admittedStateFor(cleanIdentifierMatch)
  const UNKNOWN = 'left:0::h'
  const evidence: PairingEvidence = { kind: 'exact_identifier', on: PATHS.reference }

  for (const probe of ALLOCATION_PROBES) {
    it(probe.name, () => {
      const fromKey = probe.from === 'unknown' ? UNKNOWN : keyOf(probe.from)
      const toKey = probe.to === 'unknown' ? UNKNOWN : keyOf(probe.to)
      const outcome = applyAllocation(base, fromKey, toKey, probe.amount, evidence)
      if (!probe.expect.ok) {
        ok(!outcome.ok, probe.why)
        strictEqual(outcome.refusal.kind, probe.expect.refusal, probe.why)
        if (outcome.refusal.kind === 'would_over_allocate') {
          strictEqual(outcome.refusal.requestedMinor, minorUnitsOf(probe.amount))
          strictEqual(outcome.refusal.residualMinor, 125_00n, 'the refusal carries BOTH numbers')
        }
        return
      }
      ok(outcome.ok, probe.why)
      strictEqual(outcome.state.allocations.length, 1)
      strictEqual(minorUnitsOf(outcome.state.allocations[0]?.amount ?? mny(0n)), probe.expect.amountMinor)
      strictEqual(base.allocations.length, 0, 'the state handed in is never mutated')
    })
  }
})

/* ====================================================================== *
 * §7  THE FOUR PASSES, CALLED DIRECTLY
 *
 * All four `arityPermits` arms and the whole of `PassOutcome.toleranceRefusals`
 * are unreachable from the fold. These probes are the only thing that reaches
 * them — a suite that runs §2 and skips this section reaches neither.
 * ====================================================================== */

describe('§6 passIdentifierJoin — all four cardinalities', () => {
  for (const probe of IDENTIFIER_JOIN_PROBES) {
    it(probe.name, () => {
      const outcome = passIdentifierJoin(
        admittedStateFor(probe.scenario),
        probe.on,
        probe.tolerance,
        probe.direction,
        probe.cardinality,
      )
      deepStrictEqual(passProjection(outcome), statedPassProjection(probe.expect), probe.why)
    })
  }
})

describe('§6 passAmountAndDate', () => {
  for (const probe of AMOUNT_AND_DATE_PROBES) {
    it(probe.name, () => {
      const outcome = passAmountAndDate(
        admittedStateFor(probe.scenario),
        probe.amountTolerance,
        probe.dateTolerance,
        probe.direction,
      )
      deepStrictEqual(passProjection(outcome), statedPassProjection(probe.expect), probe.why)
    })
  }
})

describe('§6 passFuzzyReference — anchor the amount, blur the string', () => {
  for (const probe of FUZZY_PROBES) {
    it(probe.name, () => {
      const outcome = passFuzzyReference(
        admittedStateFor(probe.scenario),
        probe.on,
        probe.minSimilarity,
        probe.metric,
        probe.maxChars,
          /* G115 — the bucket ceiling this pass now requires */
    512,
  )
      deepStrictEqual(passProjection(outcome), statedPassProjection(probe.expect), probe.why)
    })
  }
})

describe('§6 passAmountSum — G105, and the obligation side is a parameter', () => {
  for (const probe of AMOUNT_SUM_PROBES) {
    it(probe.name, () => {
      const outcome = passAmountSum(admittedStateFor(probe.scenario), probe.obligationSide, probe.bound)
      deepStrictEqual(actualAllocations(outcome.state), statedAllocations(probe.expectAllocations), probe.why)
      /* The pass outcome keeps the KEY, because `runSetReconciliation` joins the
       * residue cause on it — G217 fences the RESULT, not the engine's insides.
       * The probe states the boundary half, which is the half that travels. */
      deepStrictEqual(
        outcome.oversizedBuckets.map((entry) => entry.boundary),
        statedBoundaryEntries(probe.expectOversizedBuckets),
        probe.why,
      )
    })
  }
})

/* ====================================================================== *
 * §8  ADMISSION, CALLED DIRECTLY
 * ====================================================================== */

describe('§4 admitPopulation — a refused row is a NAMED refusal, never a drop', () => {
  it('refuses the second currency and admits the first, losing no row', () => {
    const input = twoCurrenciesNeverMatchAcross.input
    const outcome = admitPopulation('left', input.leftDocuments, input.left, {
      fieldClassification: input.fieldClassification,
      modelPromptEligible: input.modelPromptEligible,
      confidenceFloors: input.confidenceFloors,
    })
    let rows = 0
    for (const document of input.leftDocuments) rows += document.lines.length === 0 ? 1 : document.lines.length
    strictEqual(outcome.admitted.length + outcome.refused.length, rows, 'every row is accounted for')
    /* ⚠️ C16. This line read *"the population fixes its currency from the first
     * admitted row"* — the seeding rule, which made row one the definition. The
     * refusal now comes from the DECLARATION, and it fires on the first row as
     * readily as on the last: `declaredUnitSurvivesRowOrder` is the same rows in
     * the other order reaching the same answer. */
    ok(outcome.refused.length > 0, 'a row disagreeing with the DECLARED unit is refused')
    for (const refused of outcome.refused) {
      strictEqual(refused.refusal.kind, 'money_unit_disagrees_with_declared')
    }
  })

  it('assigns a total, deterministic admission order', () => {
    const first = admittedStateFor(cleanIdentifierMatch)
    const second = admittedStateFor(cleanIdentifierMatch)
    deepStrictEqual([...first.items.keys()], [...second.items.keys()])
  })
})

/* ====================================================================== *
 * §9  THE READER SEAM — §7 of the module. NOTHING HERE CALLS A MODEL.
 * ====================================================================== */

describe('§7 the reader seam', () => {
  const wire = resultOf(freeTextMultiEntityBuildsAReaderRequest)
  const requests = wire.readerRequests

  it('notImplementedReader returns a REFUSAL, never a fabricated empty result', () => {
    const request = requests[0]
    ok(request !== undefined, 'the wire scenario must emit one request for this to be reachable')
    deepStrictEqual(notImplementedReader(request), {
      kind: 'refused',
      requestOrdinal: request.requestOrdinal,
      refusal: { kind: 'not_implemented' },
      usage: null,
    })
  })

  it('buildReaderRequests withholds a subject whose candidate set exceeds the cap', () => {
    strictEqual(buildReaderRequests(wire.state, wire.residue, 1).length, 0, 'withheld, never trimmed')
    strictEqual(buildReaderRequests(wire.state, wire.residue, 2).length, 1)
  })

  it('buildReaderRequests refuses an unstated cap rather than defaulting', () => {
    strictEqual(buildReaderRequests(wire.state, wire.residue, 0).length, 0)
    strictEqual(buildReaderRequests(wire.state, wire.residue, -1).length, 0)
  })

  for (const vector of READER_VECTORS) {
    it(`applyReaderVerdicts · ${vector.name}`, () => {
      const application = applyReaderVerdicts(wire.state, requests, [vector.outcome])
      strictEqual(
        application.state.allocations.length,
        vector.expectAllocations,
        vector.why,
      )
      strictEqual(application.meterFacts.length, vector.expectMeterFacts, vector.why)
      if (vector.expectUnresolved === null) {
        strictEqual(application.unresolved.length, 0, vector.why)
      } else {
        strictEqual(application.unresolved.length, 1, vector.why)
        deepStrictEqual(application.unresolved[0]?.cause, vector.expectUnresolved, vector.why)
      }
      if (vector.expectAllocations > 0) {
        const allocation = application.state.allocations[0]
        ok(allocation !== undefined)
        strictEqual(allocation.evidence.kind, 'reader_confirmed')
        ok(
          allocation.evidence.kind === 'reader_confirmed' && allocation.evidence.modelEntryId !== null,
          'an allocation whose evidence cannot name the catalogue row is not recordable',
        )
      }
      for (const fact of application.meterFacts) {
        deepStrictEqual(Object.keys(fact).sort(), ['idempotencyKey', 'meter', 'modelEntryId', 'quantity'])
      }
    })
  }
})

/* ====================================================================== *
 * §9b  C13 — THE RATE AS AN UNCONDITIONAL RECORD
 *
 * 🛑 THIS IS THE HALF THAT CANNOT BE SUPPRESSED, AND THESE ARE THE VECTORS THAT
 * SAY SO. Make `admissionRates` conditional on the ceiling being breached — or
 * on a ceiling being set at all — and the first vector goes red, because it is a
 * run with nothing refused and nothing near the ceiling. That is what makes the
 * remediation for a breach *read the rate* rather than *raise the ceiling*, and
 * the second sentence is refused outright (§5.2, G79).
 * ====================================================================== */

describe('§9b admissionRates — recorded on every successful run', () => {
  for (const vector of ADMISSION_RATE_VECTORS) {
    it(`${vector.scenario} — ${vector.why}`, () => {
      const result = resultOf(scenarioNamed(vector.scenario))
      deepStrictEqual(
        result.admissionRates.map((rate) => ({
          side: rate.side,
          presented: rate.presented,
          admitted: rate.admitted,
          refused: rate.refused,
        })),
        [...vector.expect],
        vector.why,
      )
      for (const rate of result.admissionRates) {
        /* ⚠️ NOT A TAUTOLOGY, AND IT IS THE REASON `presented` IS FOLDED FROM
         * THE DOCUMENTS RATHER THAN FROM THE TWO ADMISSION ARRAYS. An admission
         * fold that lost a row breaks this equation and nothing else in the
         * result would show it. */
        strictEqual(
          rate.presented,
          rate.admitted + rate.refused,
          'every row the documents presented was either admitted or refused — nothing is ever dropped',
        )
      }
    })
  }
})

/* ====================================================================== *
 * §10  POST-CONDITIONS SEEN RED
 *
 * A check nobody has watched fail is a check nobody can trust (§5.6). These
 * corrupt a SOUND run in the three ways that lose or fabricate a row.
 * ====================================================================== */

describe('§9 checkPostconditions — the residue-completeness partition', () => {
  for (const probe of POSTCONDITION_PROBES) {
    it(probe.name, () => {
      const scenario = scenarioNamed(probe.scenario)
      const result = resultOf(scenario)
      const targetKey = keyOf(probe.target)
      let mutated: ResidueEntry[]

      if (probe.mutation === 'drop_open_item') {
        mutated = result.residue.filter((entry) => itemKey(entry.side, entry.ref) !== targetKey)
      } else if (probe.mutation === 'duplicate_entry') {
        const entry = result.residue.find((candidate) => itemKey(candidate.side, candidate.ref) === targetKey)
        ok(entry !== undefined, 'the mutation targets a row that must be in the sound residue')
        mutated = [...result.residue, entry]
      } else {
        const settlement = settlementOf(result.state, targetKey)
        ok(settlement.ok, 'the target must be an admitted item')
        strictEqual(settlement.value.kind, 'fully_allocated', 'this probe adds a CLOSED item to the residue')
        mutated = [
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

      deepStrictEqual(checkPostconditions(result.state, mutated, result.admissionRates), probe.expect, probe.why)
    })
  }

  it('reports nothing on the sound run it corrupts', () => {
    const result = resultOf(leftoverCashLandsInResidue)
    deepStrictEqual(checkPostconditions(result.state, result.residue, result.admissionRates), [])
  })
})

/* ====================================================================== *
 * §11  ARMS THE CORPUS DOES NOT REACH
 *
 * ⚠️ THE EXPECTATIONS IN THIS SECTION WERE AUTHORED HERE, NOT IN THE CORPUS,
 * and each names the module rule it is derived from. They exist because three
 * closed unions have members that no scenario or vector inhabits, and an
 * uninhabited member is a member nobody has ever watched behave. They are
 * deliberately small: anything needing a realistic corpus belongs in
 * `recon-corpus.ts`, not here.
 * ====================================================================== */

describe('§11 union members the corpus leaves uninhabited', () => {
  const wire = resultOf(freeTextMultiEntityBuildsAReaderRequest)

  it("ReaderVerdict `no_candidate` never allocates — applyReaderVerdicts routes every non-`candidate` verdict to `reader_found_no_candidate`", () => {
    const application = applyReaderVerdicts(wire.state, wire.readerRequests, [
      { kind: 'verdict', requestOrdinal: 0, verdict: { kind: 'no_candidate', confidenceBasisPoints: 500 }, usage: null },
    ])
    strictEqual(application.state.allocations.length, 0)
    strictEqual(application.meterFacts.length, 0, 'no usage reported means no token meter — NEVER ESTIMATED')
    strictEqual(application.unresolved.length, 1)
    deepStrictEqual(application.unresolved[0]?.cause, { kind: 'reader_found_no_candidate' })
  })

  for (const arm of ['response_truncated', 'response_exceeded_byte_cap', 'field_not_eligible_for_prompt'] as const) {
    it(`ReaderRefusal \`${arm}\` is recorded verbatim against the subject, never softened`, () => {
      const application = applyReaderVerdicts(wire.state, wire.readerRequests, [
        { kind: 'refused', requestOrdinal: 0, refusal: { kind: arm }, usage: null },
      ])
      strictEqual(application.state.allocations.length, 0)
      deepStrictEqual(application.unresolved[0]?.cause, { kind: 'reader_refused', refusal: { kind: arm } })
      deepStrictEqual(application.unresolved[0]?.ref, wire.readerRequests[0]?.subjectRef)
    })
  }

  it('PostconditionFailure `negative_residual` fires on a hand-built over-allocated ledger', () => {
    /* `applyAllocation` REFUSES over-allocation, so no run can produce this
     * state — which is exactly why the check has never been seen fire. The
     * ledger below is corrupted by hand, the same way §10's probes corrupt a
     * residue by hand, and for the same reason: a check nobody has watched fail
     * is a check nobody can trust (§5.6).
     *
     * Derivation: two items of 12500, one allocation of 20000 touching both.
     * Each derives allocated 20000 and residual −7500, so both are
     * `partially_allocated` with a negative residual → count 2. Both are
     * carried in the residue, so accounted = 2 × (20000 − 7500) = 25000, which
     * equals the admitted gross — `gross_not_partitioned` must NOT also fire. */
    const admitted = admittedStateFor(cleanIdentifierMatch)
    const stated = cleanIdentifierMatch.expect.allocations[0]
    ok(stated !== undefined)
    const fromKey = keyOf(stated.from)
    const toKey = keyOf(stated.to)
    const corrupt: MatchingState = {
      items: admitted.items,
      allocations: [
        {
          ordinal: 0,
          fromKey,
          toKey,
          amount: mny(200_00n),
          evidence: { kind: 'exact_identifier', on: PATHS.reference },
        },
      ],
    }
    const residue: ResidueEntry[] = []
    for (const item of corrupt.items.values()) {
      const settlement = settlementOf(corrupt, item.key)
      ok(settlement.ok)
      residue.push({
        side: item.side,
        ref: item.ref,
        settlement: settlement.value,
        disposition: 'unidentified',
        cause: { kind: 'no_strategy_paired' },
        /* G227. A fabricated probe row holds no read. */
        heldReads: [],
      })
    }
    /* C13's operand, stated to match the hand-built ledger: two items, one per
     * side, both admitted. `population_wholly_refused` therefore stays silent
     * and the arm under test fires alone. */
    deepStrictEqual(
      checkPostconditions(corrupt, residue, [
        { side: 'left', presented: 1, admitted: 1, refused: 0 },
        { side: 'right', presented: 1, admitted: 1, refused: 0 },
      ]),
      [{ kind: 'negative_residual', count: 2 }],
    )
  })

  it('applyAllocation is what makes that state unreachable in a real run', () => {
    const admitted = admittedStateFor(cleanIdentifierMatch)
    const stated = cleanIdentifierMatch.expect.allocations[0]
    ok(stated !== undefined)
    const outcome = applyAllocation(admitted, keyOf(stated.from), keyOf(stated.to), mny(200_00n), {
      kind: 'exact_identifier',
      on: PATHS.reference,
    })
    ok(!outcome.ok)
    strictEqual(outcome.refusal.kind, 'would_over_allocate')
  })
})

/* ====================================================================== *
 * THE SCALE PASS OVER `model/reconciliation.ts`.
 *
 * WHAT THIS FILE IS. Assertions over POPULATIONS, where
 * `./engine-behaviour.test.ts` asserts over hand-traced SCENARIOS. Every input
 * comes from `./synthetic-population.ts`; every expectation comes from that
 * file's `GenerationPlan`, which is derived from the specification and not from
 * the engine. This file drives and compares, and owns no expectation of its own.
 *
 * 🛑 WHY IT EXISTS, AND IT IS NOT "MORE COVERAGE". The corpus is ~45 amounts.
 * Every property this module advertises about itself — "nothing is ever
 * dropped", `presented === admitted + refused` from two independent folds, a
 * total FIFO order because `RunTrigger.rerun` exists — is a property about a
 * POPULATION, and a population of forty-five cannot distinguish a fold that
 * conserves from a fold that happens to conserve on the shapes somebody drew.
 * At 19,500 rows the same properties are worth something. `docs/HANDOFF.md`
 * §5.10 is the general form: a compile-time assertion holds the shape and only
 * a fixture witnesses the content — and a small fixture witnesses small content.
 *
 * 🛑 AN INVARIANT, NEVER AN OUTPUT, ABOVE ABOUT A HUNDRED ROWS. A thousand-row
 * expectation written out longhand is a thousand chances to paste the engine's
 * behaviour back in and call it a requirement (§5.6), and nobody would ever
 * read it. What is compared here is the plan's COMPOSITION ARITHMETIC against
 * the run's, plus the module's own stated invariants.
 *
 * ⚠️ WHAT A GREEN RUN OF THIS FILE PROVES, AND WHAT IT DOES NOT. It proves the
 * engine conserves, orders and reproduces ON THESE POPULATIONS, which reach
 * two of the five passes. `SCALE_KNOWN_GAPS` in the generator is the authority
 * on what is NOT reached — `amount_sum` and `passFuzzyReference` are both
 * absent, and the fuzzy pass is the one most likely to be the real cost.
 * Read it before quoting a number out of this file.
 *
 * ⚠️ AND THE MEASUREMENTS ARE MEASUREMENTS. They are printed, never asserted.
 * A wall-clock assertion is a flaky test on somebody else's laptop, and G108
 * requires every gate stage to be deterministic — a timing threshold is the
 * opposite of that. `PRODUCT.md` forbids presenting a figure as a benchmark and
 * these are one machine, one run, no warm-up.
 *
 * ILLUSTRATIVE SYNTHETIC DATA throughout, by way of the generator. No figure
 * here is a customer result.
 * ====================================================================== */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { itemKey, runSetReconciliation, settlementOf } from '../../model/reconciliation.ts'
import type {
  ResidueCause,
  SetReconciliationInput,
  SetReconciliationResult,
} from '../../model/reconciliation.ts'

import {
  canonicalise,
  generatePopulation,
  mixForSize,
  tiedPopulation,
  withAmountAndDate,
} from './synthetic-population.ts'
import type { GeneratedPopulation } from './synthetic-population.ts'

/* ====================================================================== *
 * §1  DRIVING
 * ====================================================================== */

function runOrFail(label: string, input: SetReconciliationInput): SetReconciliationResult {
  const outcome = runSetReconciliation(input)
  assert.equal(
    outcome.ok,
    true,
    `${label}: the generator produced a population the engine refused — ${JSON.stringify(
      outcome.ok ? null : outcome.refusal,
    )}. Every generated population is built to clear every gate; a refusal here is a defect in the GENERATOR or a gate that moved, and either is a finding.`,
  )
  if (!outcome.ok) throw new Error('unreachable — the assertion above has already failed')
  return outcome.result
}

/**
 * Wall clock, printed at the end of the run rather than asserted.
 *
 * ⚠️ IT IS A MAGNITUDE AND NOT A BENCHMARK. One machine, one run per size, no
 * warm-up, no repetition, inside a test runner that is doing other things.
 */
const measurements: { readonly what: string; readonly rows: number; readonly ms: number }[] = []

function timed<T>(what: string, rows: number, work: () => T): T {
  const started = process.hrtime.bigint()
  const value = work()
  measurements.push({ what, rows, ms: Number(process.hrtime.bigint() - started) / 1e6 })
  return value
}

/* ====================================================================== *
 * §2  THE INVARIANT BATTERY — one function, applied at every size
 *
 * 🛑 ONE FUNCTION AND NOT ONE PER SIZE. Six copies of these checks with the
 * numbers changed is §5.3: they agree until somebody edits one, and the sizes
 * would then be testing different properties while reporting the same name.
 * ====================================================================== */

interface Census {
  readonly fullyAllocated: number
  readonly residueKeys: readonly string[]
  readonly byCause: ReadonlyMap<ResidueCause['kind'], number>
}

function census(result: SetReconciliationResult): Census {
  let fullyAllocated = 0
  for (const item of result.state.items.values()) {
    const settlement = settlementOf(result.state, item.key)
    /* 🛑 `!settlement.ok` IS COUNTED AS NEITHER, DELIBERATELY. An item whose
     * settlement cannot be derived is invisible to §6's residue loop AND to
     * `checkPostconditions`, because both skip on this same guard. Over a
     * generated population it never fires — every amount here is a safe integer
     * — and the conservation assertion below would silently weaken if it ever
     * did, so it is asserted separately rather than folded in.
     *
     * ✅ THIS SAID *"AND THAT IS THE HOLE THE ADVERSARIAL SUITE WALKS THROUGH"*
     * UNTIL OQ-1 WAS FIXED. It is corrected rather than deleted because it named
     * a live defect. `admitOne` now calls `guardMoney`, so an amount that is not
     * an exact integer is REFUSED at admission and never becomes a ledger item:
     * no INPUT can put an underivable settlement into `state.items` any more.
     * The guard stays because `checkPostconditions` is exported and a caller may
     * hand it a state the engine would not build. */
    assert.equal(
      settlement.ok,
      true,
      `a generated row has an underivable settlement (${item.key}): ${JSON.stringify(
        settlement.ok ? null : settlement.refusal,
      )}. Every generated amount is a safe integer in the declared unit, and since OQ-1 was fixed NO input can produce one: admission refuses a non-exact amount with \`amount_not_exact_money\`. ⚠️ THIS SENTENCE POINTED AT OQ-1 AND ITS TRIPWIRES — \`grep -rn OQ1_TRIPWIRE tests/scenarios/\` now returns nothing. The remaining way to reach this branch is a hand-built MatchingState handed to the exported functions: see tests/model/reconciliation-conservation.test.ts §3.`,
    )
    if (settlement.ok && settlement.value.kind === 'fully_allocated') fullyAllocated += 1
  }

  const byCause = new Map<ResidueCause['kind'], number>()
  const residueKeys: string[] = []
  for (const entry of result.residue) {
    residueKeys.push(itemKey(entry.side, entry.ref))
    byCause.set(entry.cause.kind, (byCause.get(entry.cause.kind) ?? 0) + 1)
  }
  return { fullyAllocated, residueKeys, byCause }
}

function assertConservation(
  population: GeneratedPopulation,
  result: SetReconciliationResult,
): void {
  const { plan, label } = population
  const c = census(result)
  const presented = new Set(plan.presentedKeysInAdmissionOrder)

  /* --- §4's heading, as an assertion: "nothing is ever dropped" ---
   *
   * Two directions, and BOTH are needed. Nothing lost: every presented row is
   * accounted for. Nothing invented: no row is accounted for that was never
   * presented. A partition check over the row set — not an identity over
   * derived quantities, which is the distinction `checkPostconditions`'s own
   * docblock draws about `gross_not_partitioned`. */
  assert.equal(
    c.residueKeys.length + c.fullyAllocated + result.refusedAtAdmission.length,
    plan.presentedRows,
    `${label}: rows lost or invented. residue ${c.residueKeys.length} + fully allocated ${c.fullyAllocated} + refused ${result.refusedAtAdmission.length} must equal the ${plan.presentedRows} rows the documents presented.`,
  )
  for (const key of c.residueKeys) {
    assert.equal(presented.has(key), true, `${label}: residue names a row nothing presented — ${key}`)
  }
  assert.equal(
    new Set(c.residueKeys).size,
    c.residueKeys.length,
    `${label}: a row appears in the residue more than once, and \`item_in_residue_twice\` did not fire.`,
  )

  /* --- `presented === admitted + refused`, per side, from two INDEPENDENT
   * folds. `AdmissionRate.presented` comes from `presentedRowCount` over the
   * DOCUMENTS; `admitted` and `refused` come from the admission result. The
   * module's own declaration says this is why the field exists. --- */
  assert.equal(result.admissionRates.length, 2, `${label}: admissionRates must carry both sides`)
  let presentedFromRates = 0
  for (const rate of result.admissionRates) {
    assert.equal(
      rate.presented,
      rate.admitted + rate.refused,
      `${label}: side ${rate.side} — the document fold and the admission fold disagree about how many rows arrived.`,
    )
    presentedFromRates += rate.presented
  }
  assert.equal(presentedFromRates, plan.presentedRows, `${label}: admissionRates total`)

  /* --- the plan's own arithmetic --- */
  assert.equal(result.refusedAtAdmission.length, plan.expectedRefusedAtAdmission, `${label}: refusals`)
  assert.equal(result.state.allocations.length, plan.expectedAllocations, `${label}: allocations`)
  assert.equal(c.fullyAllocated, plan.expectedFullyAllocated, `${label}: fully allocated`)
  assert.equal(c.residueKeys.length, plan.expectedResidueTotal, `${label}: residue size`)
  assert.deepStrictEqual(
    [...c.byCause.entries()].sort(),
    [...plan.expectedResidueByCause.entries()].sort(),
    `${label}: the residue causes the specification requires, per §6's ordered cause ladder, are not the causes the engine produced.`,
  )

  /* --- A9(h): the residue order is TOTAL and it is the admission order ---
   *
   * `runSetReconciliation` builds the residue as every admission refusal (left
   * then right, in admission order) followed by every still-open admitted item
   * in admission order — the whole left population, then the whole right. With
   * no refusals in a generated population, the residue must therefore be
   * exactly the admission-order sequence filtered to the open rows. This is a
   * stronger claim than "stable across two runs": it pins the order to
   * something outside the engine. */
  assert.deepStrictEqual(
    c.residueKeys,
    plan.presentedKeysInAdmissionOrder.filter((key) => plan.expectedResidueKeys.has(key)),
    `${label}: the residue is not the admission-order subsequence of the open rows.`,
  )

  /* --- the ledger's own verdict on itself --- */
  assert.deepStrictEqual(result.postconditions, [], `${label}: postconditions`)
  assert.deepStrictEqual(result.completeness, [], `${label}: completeness`)
}

/* ====================================================================== *
 * §3  SCALE
 *
 * ⚠️ 200 AND 1,000 RUN IN THE GATE; 10,000 DOES NOT, AND THE REASON IS G108
 * RATHER THAN TASTE. A gate stage must be deterministic AND FAST, "because the
 * gate slows as checkers accumulate and one flaky checker blocks everything."
 * The 10,000-row case takes ~8.7 s inside the runner on the machine this was
 * written on, against ~0.7 s for the whole pre-existing scenario suite — an
 * order of magnitude more than everything else put together, for a property the
 * 1,000-row case already witnesses. It is one environment variable away and the
 * suite says so rather than dropping it:
 *
 *     RECONCILE_SCALE_10K=1 npm test
 *
 * 🛑 THOSE SECONDS ARE THEMSELVES A FINDING AND ARE NOT A COMPLAINT ABOUT THE
 * TEST. One machine, one run per size, no warm-up, identifier-join only,
 * measured outside the runner so the sizes are comparable with each other:
 *
 *        490 rows      21 ms
 *        975 rows      31 ms
 *      1,950 rows     108 ms
 *      3,900 rows     293 ms
 *      7,800 rows   1,232 ms
 *     19,500 rows   6,966 ms
 *
 * Every doubling of the population costs roughly four times the wall clock,
 * which is the signature of a quadratic fold, and the mechanism is visible in
 * the module: `allocatedOf` is a LINEAR SCAN of `state.allocations` for one
 * item's key, `residualOf` and `settlementOf` call it, and `openItems` calls
 * `residualOf` for every item — so a pass is O(items × allocations) and the
 * residue build and `checkPostconditions` each pay it again. It is correct and
 * it is stated here as a measurement, not as a defect ruling: whether an index
 * beside the allocation list is worth its second source of truth is a decision
 * with money on it and it is not this suite's to take.
 * ====================================================================== */

for (const targetRows of [200, 1000]) {
  test(`test_scale_${targetRows}_rows_conserves_orders_and_reproduces`, () => {
    const population = generatePopulation({
      label: `s${targetRows}`,
      seed: 20_260_919,
      mix: mixForSize(targetRows),
    })
    const result = timed('identifier join', population.plan.presentedRows, () =>
      runOrFail(population.label, population.input),
    )
    assertConservation(population, result)
  })
}

test('test_scale_10000_rows_is_gated_behind_an_environment_variable_and_says_so', (t) => {
  if (process.env['RECONCILE_SCALE_10K'] !== '1') {
    /* ⚠️ NOT `t.skip()`. A skipped suite's children are never created and never
     * counted — `tools/skip-census.mjs` exists because of exactly that — and a
     * silently absent case is the shape `tests/ci/reachability-guards.test.ts`
     * was written to end. This case ASSERTS the gate it is behind, so the run
     * records that the 10k population was deliberately not run rather than
     * quietly not run. */
    assert.equal(
      process.env['RECONCILE_SCALE_10K'],
      undefined,
      'RECONCILE_SCALE_10K is set to something other than "1"; it is a switch, not a level.',
    )
    t.diagnostic('10k population NOT run — set RECONCILE_SCALE_10K=1 to include it (~8.7s).')
    return
  }
  const population = generatePopulation({
    label: 's10000',
    seed: 20_260_919,
    mix: mixForSize(10_000),
  })
  const result = timed('identifier join', population.plan.presentedRows, () =>
    runOrFail(population.label, population.input),
  )
  assertConservation(population, result)
})

/* ====================================================================== *
 * §4  DETERMINISM — A9(h), and `RunTrigger.rerun` is why it is not theoretical
 * ====================================================================== */

test('test_the_same_seed_twice_produces_a_byte_identical_result', () => {
  const build = (): GeneratedPopulation =>
    generatePopulation({ label: 'determinism', seed: 31_337, mix: mixForSize(500) })

  const first = runOrFail('determinism/1', build().input)
  const second = runOrFail('determinism/2', build().input)

  /* 🛑 `canonicalise` AND NOT `deepStrictEqual`, AND THE DIFFERENCE IS NOT
   * COSMETIC. `deepStrictEqual` compares Maps by membership and says nothing
   * about ITERATION ORDER — and `MatchingState.items` is a Map whose iteration
   * order IS the residue order, which is the property under test. Two results
   * with the same items inserted in a different order are `deepStrictEqual` and
   * are NOT the same audit. See the function's own docblock. */
  assert.equal(
    canonicalise(first),
    canonicalise(second),
    'two runs over one seeded population disagree — A9(h), and `RunTrigger.rerun` means a re-run must reproduce the audit.',
  )
})

/* ====================================================================== *
 * §5  ROW ORDER — the generalisation of `declaredUnitSurvivesRowOrder`
 *
 * The corpus asserts, over TWO ledger rows, that swapping them does not move
 * the answer. That scenario exists because the rule C16 deleted — seeding the
 * population's denomination from its first row — made the answer depend on the
 * export order of a file. This is the same claim over ~975 rows, and it is
 * stated in three parts because the three are not the same claim:
 *
 *   · the residue CONTENT is identical                    — asserted
 *   · the allocation MULTISET is identical                — asserted
 *   · the residue SEQUENCE is NOT identical               — asserted, and it is
 *     the correct behaviour: §6 walks admission order, admission order is row
 *     order, so a re-exported file has a re-ordered residue carrying the same
 *     findings. Asserting the sequence would be asserting that the engine
 *     ignores the order it is documented to follow.
 * ====================================================================== */

test('test_row_order_does_not_reach_the_answer_when_no_fifo_tie_exists', () => {
  const mix = mixForSize(500)
  const ordered = generatePopulation({ label: 'roworder', seed: 8_191, mix })
  const shuffled = generatePopulation({ label: 'roworder', seed: 8_191, mix, shuffleRows: true })

  const a = runOrFail('roworder/ordered', ordered.input)
  const b = runOrFail('roworder/shuffled', shuffled.input)

  /* 🛑 THE SHUFFLED POPULATION GOES THROUGH THE FULL BATTERY, AND THAT IS NOT
   * BELT-AND-BRACES — IT IS WHERE §2's ORDERING ASSERTION ACQUIRES ITS TEETH.
   *
   * ⚠️ FOUND BY WITNESSING THIS SUITE RED AGAINST A DELIBERATELY BROKEN ENGINE,
   * WHICH IS WHY THE RECORD DEMANDS THAT STEP. A mutation that SORTS the residue
   * instead of leaving it in admission order left every ordered-population
   * assertion GREEN: at these mix proportions every row that reaches the residue
   * sits at a THREE-DIGIT line index, and over equal-width numerals a
   * lexicographic sort and a numeric one are the same sequence. The control was
   * reading a coincidence about the fixture, not a property of the fold —
   * `docs/HANDOFF.md` §5.1, a rule keyed on a convenient landmark, arriving
   * inside a control written to catch that class.
   *
   * The SHUFFLED population has no such coincidence available: its admission
   * order is a permutation, so "the residue is the admission-order subsequence"
   * and "the residue is sorted" are different claims, and only one of them can
   * pass. The mutation is RED here. */
  assertConservation(ordered, a)
  assertConservation(shuffled, b)

  const finding = (entry: SetReconciliationResult['residue'][number]): string =>
    `${itemKey(entry.side, entry.ref)}|${entry.cause.kind}|${entry.settlement?.kind ?? 'none'}`
  assert.deepStrictEqual(
    a.residue.map(finding).sort(),
    b.residue.map(finding).sort(),
    'the same rows, exported in a different order, produced a different set of findings. Every matched pair in this population has a private reference, so `fifoOrder` never falls through to the ordinal and the specification claims the answer is independent of row order here.',
  )

  const allocation = (x: SetReconciliationResult['state']['allocations'][number]): string =>
    `${x.fromKey}|${x.toKey}|${x.amount.amountMinor}|${x.evidence.kind}`
  assert.deepStrictEqual(
    a.state.allocations.map(allocation).sort(),
    b.state.allocations.map(allocation).sort(),
    'the allocation multiset moved under a row permutation.',
  )

  assert.notDeepStrictEqual(
    a.residue.map(finding),
    b.residue.map(finding),
    'the residue SEQUENCE was identical under a row permutation, which the specification does not claim — §6 walks admission order and admission order is row order. If this ever passes, the residue has been sorted by something other than admission order and the ordering assertion in §2 is now asserting a different property than it says.',
  )
})

/* ====================================================================== *
 * §6  THE BOUNDARY OF THAT CLAIM — where row order MAY reach the answer
 *
 * 🛑 THE CASE ABOVE IS TRUE BECAUSE OF HOW THE POPULATION IS BUILT, AND SAYING
 * SO IS THE DIFFERENCE BETWEEN A PROPERTY AND A COINCIDENCE. `fifoOrder` is
 * `(dayNumber, ordinal)` and the ordinal IS the row order, so a population with
 * a genuine FIFO tie is one where the specification deliberately lets the file
 * order decide — A9(h)'s whole subject is that the alternative, FIFO with NO
 * tie-break, produces two different audits from one input. What the module
 * promises over a tie is TOTALITY and REPRODUCIBILITY, not invariance, and
 * those are what is asserted here.
 * ====================================================================== */

test('test_a_fifo_tie_is_total_and_reproducible_and_row_order_decides_it', () => {
  const ordered = tiedPopulation({ label: 'tie', credits: 6, shortfallMinor: 50_00n })
  const orderedAgain = tiedPopulation({ label: 'tie', credits: 6, shortfallMinor: 50_00n })
  const shuffled = tiedPopulation({ label: 'tie', credits: 6, shortfallMinor: 50_00n, shuffleSeed: 4_242 })

  const a = runOrFail('tie/ordered', ordered)
  const b = runOrFail('tie/ordered-again', orderedAgain)
  const c = runOrFail('tie/shuffled', shuffled)

  assert.equal(canonicalise(a), canonicalise(b), 'a tie is not reproducible for a fixed input — A9(h).')

  /* Six identical credits against one obligation fifty dollars short of their
   * total. The pour consumes five whole and half of the sixth, so exactly one
   * credit stays open, `partially_allocated`, and it is NOT on the obligation
   * side — `cash_exceeded_obligations`, the cause the corpus's
   * `leftoverCashLandsInResidue` derives for the same shape at two rows. */
  for (const [name, result] of [['ordered', a], ['shuffled', c]] as const) {
    assert.equal(result.residue.length, 1, `tie/${name}: exactly one credit must stay open`)
    const entry = result.residue[0]
    assert.notEqual(entry, undefined)
    if (entry === undefined) continue
    assert.deepStrictEqual(entry.cause, { kind: 'cash_exceeded_obligations' }, `tie/${name}: cause`)
    assert.equal(entry.settlement?.kind, 'partially_allocated', `tie/${name}: settlement`)
  }

  const openRef = (result: SetReconciliationResult): number | null =>
    result.residue[0]?.ref.lineIndex ?? null
  assert.notEqual(
    openRef(a),
    openRef(c),
    'the tie-break did NOT follow the row order. That is not automatically a defect — it means `fifoOrder` found another discriminator — but every row in this population shares a reference, a date and an amount, so there is nothing left for it to have found and the ordinal is documented as the tie-break. Read `fifoOrder` before changing this.',
  )
})

/* ====================================================================== *
 * §7  TWO PASSES — the invariants only, and the type says why
 * ====================================================================== */

test('test_a_second_strategy_pass_preserves_conservation_at_scale', () => {
  const population = generatePopulation({ label: 'twopass', seed: 4_099, mix: mixForSize(500) })
  const result = timed('identifier join + amount and date', population.plan.presentedRows, () =>
    runOrFail('twopass', withAmountAndDate(population)),
  )

  /* ⚠️ NO PER-ROW PLAN IS CLAIMED AND `withAmountAndDate`'s RETURN TYPE IS WHY:
   * it hands back a bare `SetReconciliationInput` with no `GenerationPlan`
   * attached, because a second pass can legitimately pair a `leftOnly` row with
   * an unrelated `rightOnly` row of the same amount inside the date window. The
   * conservation and soundness claims survive that; the composition arithmetic
   * does not. */
  const c = census(result)
  assert.equal(
    c.residueKeys.length + c.fullyAllocated + result.refusedAtAdmission.length,
    population.plan.presentedRows,
    'two passes: rows lost or invented',
  )
  assert.equal(new Set(c.residueKeys).size, c.residueKeys.length, 'two passes: a row is in the residue twice')
  assert.deepStrictEqual(result.postconditions, [], 'two passes: postconditions')
  assert.deepStrictEqual(result.completeness, [], 'two passes: completeness')
})

/* ====================================================================== *
 * §8  THE MEASUREMENTS — printed, never asserted
 * ====================================================================== */

test('test_the_wall_clock_measurements_are_reported_and_not_asserted', (t) => {
  assert.ok(measurements.length > 0, 'nothing was timed')
  for (const m of measurements) {
    t.diagnostic(`SCALE ${m.what}: ${m.rows} rows, ${m.ms.toFixed(1)} ms`)
  }
  /* 🛑 THE ONLY ASSERTION IN THIS TEST IS THAT SOMETHING WAS MEASURED. A
   * wall-clock threshold here would be a stage of `npm run check` that fails on
   * a loaded laptop, which is precisely the flaky gate G108 forbids — and it
   * would also be a performance NUMBER in a repository whose product document
   * forbids publishing one. The figures belong in the header, where a person
   * reads them and decides. */
})

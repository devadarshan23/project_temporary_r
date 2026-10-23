/* ====================================================================== *
 * ILLUSTRATIVE SYNTHETIC DATA, GENERATED. Every counterparty, reference,
 * amount and narrative below is machine-written from a seeded PRNG; none of it
 * is a customer result, and `synthetic: true` is set truthfully on every
 * document because every document here is one.
 *
 * WHAT THIS FILE IS. A POPULATION generator, where `./recon-corpus.ts` is a
 * SCENARIO corpus. The corpus states, for thirty hand-traced March-close
 * topologies, the exact outcome the specification requires; it is ~45 amounts
 * and it is the right size for that job. NOTHING in this repository had ever
 * run `runSetReconciliation()` over a realistic population, so nothing here
 * knew what the engine's stated invariants cost, or whether they hold, at a
 * thousand rows. This file builds those rows. It contains no test assertions
 * and imports no test runner.
 *
 * 🛑 THE CORPUS'S GOVERNING RULE BINDS THIS FILE TOO, AND IT IS THE ONLY
 * REASON EITHER FILE IS WORTH ANYTHING: THE EXPECTATIONS WERE DERIVED FROM THE
 * SPECIFICATION, NOT FROM THE ENGINE. Every number in `GenerationPlan` below is
 * computed from the COMPOSITION this generator emitted, by hand-tracing
 * `model/reconciliation.ts`'s stated rules — `passIdentifierJoin`'s arity gate,
 * `pourFifo`'s stop condition, §6's residue-cause ORDER, and `presentedRows`'s
 * one rule about what a document presents. NOTHING here was produced by running
 * the engine and pasting the output back. A failing scale assertion is an open
 * question, not a verdict.
 *
 * 🛑 AND THE SECOND RULE, WHICH IS THIS FILE'S OWN. AT SCALE, PREFER AN
 * INVARIANT TO AN OUTPUT. A thousand-row expectation written out longhand is a
 * thousand chances to encode the engine's behaviour by accident, and nobody
 * would ever read it. What is asserted at scale is what the module CLAIMS ABOUT
 * ITSELF, in its own words:
 *
 *   · CONSERVATION — "nothing is ever dropped" (§4's heading). Every presented
 *     row appears exactly once across {fully allocated} ∪ {residue} ∪ {refused},
 *     and no row appears that was never presented.
 *   · `presented === admitted + refused`, per side, from two INDEPENDENT folds
 *     (`AdmissionRate.presented` is folded from the DOCUMENTS; the other two
 *     from the admission result). That independence is the module's own stated
 *     reason for the field.
 *   · TOTAL, DETERMINISTIC RESIDUE ORDER — A9(h), and `RunTrigger.rerun` is why
 *     it is not theoretical.
 *   · SEED-STABILITY — the same seed twice is byte-identical output.
 *   · ROW ORDER DOES NOT REACH THE ANSWER — the generalisation of the corpus's
 *     `declaredUnitSurvivesRowOrder`, over a thousand rows instead of two.
 *     ⚠️ QUALIFIED, AND THE QUALIFICATION IS NOT A WEAKENING. `fifoOrder` is
 *     `(dayNumber, ordinal)` and the ordinal IS the row order, so a population
 *     with FIFO TIES is one where the spec says row order MAY move which of two
 *     tied rows is poured first. The generator gives every matched pair a
 *     private reference precisely so that no tie exists, which makes
 *     order-independence a property the specification actually claims here
 *     rather than one a fixture got lucky with. `TIED` below builds the
 *     opposite population on purpose.
 *
 * ON THE PRNG. Written out below, thirteen lines, because `package.json` pins
 * every dependency exact under G191 and adding one is a RULING, not a
 * convenience — `docs/HANDOFF.md` §3. It is SplitMix32: a counter, two
 * multiply-xorshift rounds, `Math.imul` throughout so every intermediate stays
 * in int32 and the sequence is identical on every engine that runs this suite.
 * It is not cryptographic and nothing here wants it to be.
 *
 * WHAT IS NOT INVENTED ANYWHERE IN THIS FILE: a customer, a price, an SLA, a
 * benchmark, a model identifier (G104), or a product-recommended value for any
 * bound the engine refuses to default. The bounds come from `./recon-corpus.ts`,
 * which states in its own voice that they are fixture choices and that no
 * document may cite them as a recommendation.
 * ====================================================================== */

import type {
  ExtractedLine,
  ExtractedScalar,
  Tolerance,
} from '../../model/domain.ts'
import type { SourceDocumentId } from '../../model/kernel.ts'
import { itemKey } from '../../model/reconciliation.ts'
import type {
  IdentifierNormalisation,
  PopulationSide,
  ResidueCause,
  SetReconciliationInput,
} from '../../model/reconciliation.ts'

import {
  PATHS,
  amt,
  bankBinding,
  bankDoc,
  bankFields,
  dte,
  id,
  ledgerBinding,
  ledgerDoc,
  ledgerFields,
  line,
  mny,
  pairing,
  bound,
  runInput,
  txt,
} from './recon-corpus.ts'

/* ====================================================================== *
 * §1  THE PRNG — thirteen lines, no dependency, identical everywhere
 * ====================================================================== */

/**
 * SplitMix32. Returns a function yielding a float in `[0, 1)`.
 *
 * ⚠️ `Math.imul` IS LOAD-BEARING AND IS NOT AN OPTIMISATION. `a * b` on two
 * 32-bit values overflows into the float mantissa and the low bits — the ones
 * this construction relies on — are then rounded away. `Math.imul` performs the
 * multiply in int32 and wraps, which is what makes the stream reproducible at
 * all. A generator whose stream depends on how a runtime rounds is a generator
 * whose "same seed, same population" claim is false, and that claim is the
 * whole reason this file may be used in a determinism assertion.
 */
export function splitmix32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x9e3779b9) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0
    return ((t ^ (t >>> 15)) >>> 0) / 4_294_967_296
  }
}

/** An integer in `[min, max]`, inclusive. */
/**
 * ⚠️ MINOR UNITS ARE `bigint` SINCE 19 Sep 2026 — G286 — SO THE GENERATOR HAS
 * TWO DRAWS, NOT ONE. `between` still draws the things that are counts: a
 * counterparty index, a day of the month, a repeat. `betweenMinor` draws the
 * things that are MONEY. Keeping one function and converting at each call site
 * is exactly the drift G111's one-codec rule exists to prevent, one layer out.
 */
function betweenMinor(next: () => number, min: number, max: number): bigint {
  return BigInt(between(next, min, max))
}

function between(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1))
}

/**
 * Fisher–Yates, in place, from a supplied stream.
 *
 * 🛑 IT IS THE ROW-ORDER EXPERIMENT AND NOT A CONVENIENCE. Permuting the ARRAY
 * while each `ExtractedLine` keeps its own `index` field is exactly "the same
 * file, exported in a different order": `presentedRows` maps over the array and
 * addresses each row by `line.index`, so every `ItemRef` is unchanged and only
 * the admission ORDINAL moves. That is the one variable the experiment wants.
 */
function shuffleInPlace<T>(items: T[], next: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    const a = items[i]
    const b = items[j]
    if (a === undefined || b === undefined) continue
    items[i] = b
    items[j] = a
  }
}

/* ====================================================================== *
 * §2  THE MIX — composition is DECLARED, never sampled
 * ====================================================================== */

/**
 * 🛑 COUNTS, NOT PROBABILITIES, AND THE DIFFERENCE IS THE WHOLE POINT. A mix
 * expressed as weights and drawn per row gives a population whose composition
 * is only approximately what was asked for, and every plan figure below would
 * then be an estimate — so a conservation assertion would be comparing the
 * engine against a guess. These are exact counts; the PRNG decides amounts,
 * dates, fee sizes and ROW ORDER, and it decides nothing about how many of each
 * class exists.
 */
export interface PopulationMix {
  /** Left and right agree on the reference byte for byte, and on the amount. */
  readonly cleanPairs: number
  /** The right reference arrives wrapped in the bank's own routing furniture. */
  readonly noisyPairs: number
  /** The right credit is short by a fee inside the run's amount tolerance. */
  readonly feePairs: number
  /** Two left rows and two right rows under ONE reference. A true ambiguity. */
  readonly ambiguousGroups: number
  /** An obligation nothing on the other side keys to. */
  readonly leftOnly: number
  /** Cash nothing on this side keys to. */
  readonly rightOnly: number
}

/**
 * The mix used by the scale suite, scaled to a target row count.
 *
 * ⚠️ THE PROPORTIONS ARE THIS FILE'S CHOICE AND ARE NOT A CLAIM ABOUT ANY REAL
 * CLOSE. `PRODUCT.md` forbids inventing a figure and presenting it as
 * experience; a real March close's match rate is exactly such a figure and
 * nobody here is authoritative for one. What these numbers ARE: a shape that
 * puts every residue cause and every pass outcome on the board at once, sized
 * so that no single class dominates the fold. Do not cite them as a benchmark.
 */
export function mixForSize(targetLeftRows: number): PopulationMix {
  const clean = Math.round(targetLeftRows * 0.55)
  const noisy = Math.round(targetLeftRows * 0.15)
  const fee = Math.round(targetLeftRows * 0.1)
  const ambiguousGroups = Math.round(targetLeftRows * 0.05)
  const leftOnly = Math.round(targetLeftRows * 0.08)
  const rightOnly = Math.round(targetLeftRows * 0.07)
  return { cleanPairs: clean, noisyPairs: noisy, feePairs: fee, ambiguousGroups, leftOnly, rightOnly }
}

/* ====================================================================== *
 * §3  THE PLAN — every figure hand-traced from the specification
 * ====================================================================== */

/**
 * What the specification requires of a run over the population beside it.
 *
 * 🛑 READ THE DERIVATION IN EACH FIELD BEFORE CHANGING ONE. These are not
 * observations. Each is a consequence of a rule stated in
 * `model/reconciliation.ts`, named on the field, and a disagreement between one
 * of them and the engine points at that rule rather than at this file.
 */
export interface GenerationPlan {
  readonly leftRows: number
  readonly rightRows: number
  readonly presentedRows: number
  /**
   * `pourFifo` moves `min(targetResidual, sourceResidual)` and records ONE
   * allocation per pour step. Every matched pair here is one left against one
   * right under a private reference, so each pair is exactly one allocation and
   * no pair can reach a second step.
   */
  readonly expectedAllocations: number
  /**
   * ZERO. Every generated row carries a classified amount path, a classified
   * date path, a money scalar in the declared unit, an ISO calendar date and an
   * extractable identifier — so no arm of `AdmissionRefusal` is reachable.
   * ⚠️ Stated as a number rather than assumed, because `AdmissionRate` exists
   * to make `presented === admitted + refused` checkable and a silent refusal
   * would otherwise look exactly like a row that was never there.
   */
  readonly expectedRefusedAtAdmission: number
  /** One entry per open admitted row. Keys are `ResidueCause['kind']`. */
  readonly expectedResidueByCause: ReadonlyMap<ResidueCause['kind'], number>
  readonly expectedResidueTotal: number
  /** `settlementOf` returns `fully_allocated`; §6 skips it. */
  readonly expectedFullyAllocated: number
  /**
   * Every presented row's `itemKey`, in ADMISSION ORDER — the whole left
   * population in supplied order, then the whole right. This is the sequence
   * §6 walks, and it is what makes the residue ORDER assertable rather than
   * merely stable.
   */
  readonly presentedKeysInAdmissionOrder: readonly string[]
  /** The subset of the above the specification requires in the residue. */
  readonly expectedResidueKeys: ReadonlySet<string>
}

export interface GeneratedPopulation {
  readonly label: string
  readonly seed: number
  readonly mix: PopulationMix
  readonly input: SetReconciliationInput
  readonly plan: GenerationPlan
}

/* ====================================================================== *
 * §4  THE NORMALISATION THE RIGHT SIDE DECLARES
 * ====================================================================== */

/**
 * `  BANKREF/RF000042  ` → `RF000042`, and `RF000042` → `RF000042`.
 *
 * 🛑 `strip_literal` RATHER THAN `split_take`, AND THE CHOICE IS WHAT LETS ONE
 * POPULATION HOLD BOTH CLEAN AND NOISY ROWS. `split_take('-', 1)` — the corpus's
 * `SEGMENT_NORMALISATION` — REFUSES any row with no separator in it
 * (`segment_index_out_of_range`), so a side declaring it must have every row
 * wrapped, and "clean" and "noisy" could not coexist on one side at all.
 * `strip_literal` at `'prefix'` is a no-op on a row that does not carry the
 * prefix, which is the property the mix needs. The refusing form is exercised
 * by the corpus; this file needs the other one.
 */
export const BANK_PREFIX_NORMALISATION: IdentifierNormalisation = {
  ops: [{ kind: 'trim' }, { kind: 'strip_literal', literal: 'BANKREF/', at: 'prefix' }],
  then: 'exact',
  maxInputChars: 64,
}

/**
 * The bank's fee ceiling, as a DENOMINATED money tolerance.
 *
 * ⚠️ `money` AND NOT `rounding`. `rounding` counts minor units and is unit-free,
 * so it would pass `toleranceNamesUnit` without ever naming the declared
 * denomination — and the generator would then be exercising the one tolerance
 * arm C16's cross-check cannot see. Fifty minor units is a fixture choice sized
 * to make a fee legible; it is not a policy and no document may cite it as one.
 */
export const FEE_TOLERANCE: Tolerance = { kind: 'money', value: mny(50n) }
const FEE_CEILING_MINOR = 50

/* ====================================================================== *
 * §5  THE GENERATOR
 * ====================================================================== */

interface Row {
  readonly index: number
  readonly reference: ExtractedScalar
  readonly amountMinor: bigint
  readonly date: string
  readonly counterparty: ExtractedScalar
  readonly narrative: ExtractedScalar
}

/** March 2026, day 1..28 — inside every month, so no calendar arm is grazed. */
function marchDay(next: () => number): string {
  return `2026-03-${String(between(next, 1, 28)).padStart(2, '0')}`
}

function token(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(6, '0')}`
}

export interface GenerateOptions {
  readonly label: string
  readonly seed: number
  readonly mix: PopulationMix
  /**
   * When true, the LINE ARRAYS are permuted before the documents are built,
   * with each line keeping its own `index`. Same rows, same addresses, a
   * different export order — see `shuffleInPlace`.
   */
  readonly shuffleRows?: boolean
}

export function generatePopulation(options: GenerateOptions): GeneratedPopulation {
  const next = splitmix32(options.seed)
  const mix = options.mix

  const leftRows: Row[] = []
  const rightRows: Row[] = []
  /* Addressed by `(side, lineIndex)`, so each side counts its own. */
  let leftIndex = 0
  let rightIndex = 0

  /** Every left key that the specification requires in the residue, by cause. */
  const residueCauseOf = new Map<string, ResidueCause['kind']>()

  const pushLeft = (row: Omit<Row, 'index'>): number => {
    const index = leftIndex
    leftRows.push({ ...row, index })
    leftIndex += 1
    return index
  }
  const pushRight = (row: Omit<Row, 'index'>): number => {
    const index = rightIndex
    rightRows.push({ ...row, index })
    rightIndex += 1
    return index
  }

  const LEFT_DOC = `srcdoc_SYN_gen_${options.label}_ledger`
  const RIGHT_DOC = `srcdoc_SYN_gen_${options.label}_statement`

  /**
   * 🛑 THROUGH `itemKey`, NEVER BY HAND. The key is length-prefixed
   * (`left:34:srcdoc…:7`) precisely because a delimiter-joined one is ambiguous
   * the moment an id contains the delimiter, and the module's own comment
   * records that it found that out by running the engine. A fixture that
   * re-spells the encoding is a second answer to "what is an item's identity"
   * — §5.3 — and it would agree with the module until the day it did not.
   */
  const mintKey = (side: PopulationSide, lineIndex: number): string =>
    itemKey(side, {
      sourceDocumentId: (side === 'left' ? LEFT_DOC : RIGHT_DOC) as SourceDocumentId,
      lineIndex,
    })

  let sequence = 0

  /* --- clean: the reference agrees byte for byte, and so does the amount --- */
  for (let i = 0; i < mix.cleanPairs; i += 1) {
    sequence += 1
    const reference = token('RF', sequence)
    const amountMinor = betweenMinor(next, 10_00, 9_999_00)
    const day = marchDay(next)
    const cp = token('CP', between(next, 1, 40))
    pushLeft({ reference: id(reference), amountMinor, date: day, counterparty: id(cp), narrative: txt('') })
    pushRight({
      reference: id(reference),
      amountMinor,
      date: day,
      counterparty: id(cp),
      narrative: txt(`GIRO CREDIT ${reference}`),
    })
  }

  /* --- noisy: the same reference, wrapped in the bank's routing furniture --- */
  for (let i = 0; i < mix.noisyPairs; i += 1) {
    sequence += 1
    const reference = token('RF', sequence)
    const amountMinor = betweenMinor(next, 10_00, 9_999_00)
    const day = marchDay(next)
    const cp = token('CP', between(next, 1, 40))
    pushLeft({ reference: id(reference), amountMinor, date: day, counterparty: id(cp), narrative: txt('') })
    pushRight({
      reference: id(`  BANKREF/${reference}  `),
      amountMinor,
      date: day,
      counterparty: id(cp),
      narrative: txt(`PAYNOW ${reference}`),
    })
  }

  /* --- fee: the credit is short, inside the declared money tolerance --- *
   *
   * The LEFT row is therefore `partially_allocated` after the pour and the
   * RIGHT row is `fully_allocated`. §6 reaches `obligation_not_fully_settled`
   * because `item.side === input.obligationSide` and the left is the obligation
   * side on every run this generator builds. */
  for (let i = 0; i < mix.feePairs; i += 1) {
    sequence += 1
    const reference = token('RF', sequence)
    const amountMinor = betweenMinor(next, 500_00, 9_999_00)
    const fee = betweenMinor(next, 1, FEE_CEILING_MINOR)
    const day = marchDay(next)
    const cp = token('CP', between(next, 1, 40))
    const leftAt = pushLeft({
      reference: id(reference),
      amountMinor,
      date: day,
      counterparty: id(cp),
      narrative: txt(''),
    })
    pushRight({
      reference: id(`BANKREF/${reference}`),
      amountMinor: amountMinor - fee,
      date: day,
      counterparty: id(cp),
      narrative: txt(`PAYNOW NET OF CHARGES ${reference}`),
    })
    residueCauseOf.set(mintKey('left', leftAt), 'obligation_not_fully_settled')
  }

  /* --- ambiguous: two against two under one reference --- *
   *
   * `arityPermits('one_to_one', 2, 2)` is FALSE, so `passIdentifierJoin` raises
   * an `AmbiguityFinding` naming all four refs and allocates NOTHING in that
   * bucket. §6 then reads `ambiguousKeys` and every one of the four lands as
   * `identifier_ambiguous`. */
  for (let g = 0; g < mix.ambiguousGroups; g += 1) {
    sequence += 1
    const reference = token('AM', sequence)
    const base = betweenMinor(next, 100_00, 5_000_00)
    const day = marchDay(next)
    const cp = token('CP', between(next, 1, 40))
    for (let copy = 0; copy < 2; copy += 1) {
      const leftAt = pushLeft({
        reference: id(reference),
        amountMinor: base + BigInt(copy),
        date: day,
        counterparty: id(cp),
        narrative: txt(''),
      })
      const rightAt = pushRight({
        reference: id(reference),
        amountMinor: base + BigInt(copy),
        date: day,
        counterparty: id(cp),
        narrative: txt(`DUPLICATE ADVICE ${reference}`),
      })
      residueCauseOf.set(mintKey('left', leftAt), 'identifier_ambiguous')
      residueCauseOf.set(mintKey('right', rightAt), 'identifier_ambiguous')
    }
  }

  /* --- unmatched residue on both sides --- */
  for (let i = 0; i < mix.leftOnly; i += 1) {
    sequence += 1
    const reference = token('LO', sequence)
    const leftAt = pushLeft({
      reference: id(reference),
      amountMinor: betweenMinor(next, 10_00, 9_999_00),
      date: marchDay(next),
      counterparty: id(token('CP', between(next, 1, 40))),
      narrative: txt(''),
    })
    residueCauseOf.set(mintKey('left', leftAt), 'no_strategy_paired')
  }
  for (let i = 0; i < mix.rightOnly; i += 1) {
    sequence += 1
    const reference = token('RO', sequence)
    const rightAt = pushRight({
      reference: id(reference),
      amountMinor: betweenMinor(next, 10_00, 9_999_00),
      date: marchDay(next),
      counterparty: id(token('CP', between(next, 1, 40))),
      narrative: txt(`UNATTRIBUTED CREDIT ${reference}`),
    })
    residueCauseOf.set(mintKey('right', rightAt), 'no_strategy_paired')
  }

  /* --- documents --- */
  const leftLines: ExtractedLine[] = leftRows.map((row) =>
    line(
      row.index,
      ledgerFields(row.reference, amt(row.amountMinor), dte(row.date), row.counterparty),
    ),
  )
  const rightLines: ExtractedLine[] = rightRows.map((row) =>
    line(
      row.index,
      bankFields(row.reference, amt(row.amountMinor), dte(row.date), row.counterparty, row.narrative),
    ),
  )
  if (options.shuffleRows === true) {
    shuffleInPlace(leftLines, next)
    shuffleInPlace(rightLines, next)
  }

  const leftDocument = ledgerDoc(LEFT_DOC, `${options.label}-ar-open-items.csv`, leftLines)
  const rightDocument = bankDoc(RIGHT_DOC, `${options.label}-statement-2026-03.csv`, rightLines)

  /* --- the run --- *
   *
   * ONE strategy, deliberately. `exact_identifier` is the only pass whose
   * outcome over a thousand rows is hand-derivable row by row; adding
   * `amount_and_date` would let a leftOnly row pair with an unrelated rightOnly
   * row of the same amount inside the date window, and the plan would then be
   * an estimate. The two-pass shape is exercised by `withAmountAndDate` below,
   * where only the INVARIANTS are asserted and no per-row plan is claimed. */
  const input = runInput({
    runId: `run_SYN_gen_${options.label}`,
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({
      identifiers: [PATHS.reference],
      counterparty: null,
      normalisation: BANK_PREFIX_NORMALISATION,
      /* No description path: `buildReaderRequests` draws SUBJECTS from the LEFT
       * residue only, and the ledger is the left side here, so a bank narrative
       * could never become a request on this shape. Stating `null` says that,
       * rather than leaving a reader to infer it from an empty array. */
      description: null,
    }),
    leftDocuments: [leftDocument],
    rightDocuments: [rightDocument],
    pairing: pairing('one_to_one', FEE_TOLERANCE, { kind: 'days', value: 5 }, [
      { kind: 'exact_identifier', on: PATHS.reference },
    ]),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  })

  /* --- the plan, hand-derived from the composition above --- */
  const byCause = new Map<ResidueCause['kind'], number>()
  for (const cause of residueCauseOf.values()) {
    byCause.set(cause, (byCause.get(cause) ?? 0) + 1)
  }

  const presentedKeysInAdmissionOrder: string[] = []
  for (const l of leftLines) presentedKeysInAdmissionOrder.push(mintKey('left', l.index))
  for (const r of rightLines) presentedKeysInAdmissionOrder.push(mintKey('right', r.index))

  const matchedPairs = mix.cleanPairs + mix.noisyPairs + mix.feePairs
  const plan: GenerationPlan = {
    leftRows: leftRows.length,
    rightRows: rightRows.length,
    presentedRows: leftRows.length + rightRows.length,
    expectedAllocations: matchedPairs,
    expectedRefusedAtAdmission: 0,
    expectedResidueByCause: byCause,
    expectedResidueTotal: residueCauseOf.size,
    /* Both sides of every clean and noisy pair, plus the RIGHT side of every
     * fee pair — the short credit is exhausted by the pour and the obligation
     * is not. */
    expectedFullyAllocated: 2 * (mix.cleanPairs + mix.noisyPairs) + mix.feePairs,
    presentedKeysInAdmissionOrder,
    expectedResidueKeys: new Set(residueCauseOf.keys()),
  }

  return { label: options.label, seed: options.seed, mix, input, plan }
}

/**
 * The same population, run with `amount_and_date` bound as a SECOND pass.
 *
 * 🛑 THE PLAN DOES NOT SURVIVE THIS AND THE FUNCTION SAYS SO IN ITS RETURN
 * TYPE. A second pass over the still-open rows can pair a `leftOnly` row with
 * an unrelated `rightOnly` row of the same amount inside the date window, which
 * is CORRECT behaviour for the strategy and makes every per-row figure in
 * `GenerationPlan` an estimate. Only the INVARIANTS are assertable here — which
 * is exactly the distinction the header draws, made structural rather than left
 * to a comment.
 */
export function withAmountAndDate(population: GeneratedPopulation): SetReconciliationInput {
  const base = population.input
  return {
    ...base,
    runId: `${base.runId}_ad` as SetReconciliationInput['runId'],
    pairing: {
      ...base.pairing,
      strategies: [
        { kind: 'exact_identifier', on: PATHS.reference },
        { kind: 'amount_and_date' },
      ],
    },
    strategyBindings: [
      bound({ kind: 'exact_identifier', on: PATHS.reference }),
      bound({ kind: 'amount_and_date' }),
    ],
  }
}

/**
 * A population built to have FIFO TIES, so the row-order claim is stated WITH
 * ITS BOUNDARY rather than only on the side where it holds.
 *
 * One obligation, `credits` identical credits, one reference, one date, one
 * amount each. `fifoOrder` is `(dayNumber, ordinal)`, every `dayNumber` is
 * equal, and `ordinal` IS the row order — so the tie-break is the export order
 * of the file, BY DESIGN (A9(h): the alternative is FIFO with no tie-break,
 * which produces two different audits from one input). The specification's
 * claim over this population is NOT that the answer is unchanged. It is that
 * the answer is TOTAL and REPRODUCIBLE for a fixed input. Asserting
 * order-independence here would be asserting something the module deliberately
 * does not promise.
 *
 * 🛑 THE BUCKET TOTAL HAS TO CLEAR THE TOLERANCE OR THE TIE IS NEVER REACHED,
 * AND THAT COST ME AN HOUR. `passIdentifierJoin` compares `sumGross(left)`
 * against `sumGross(right)` FOR THE WHOLE BUCKET and pours only if that ONE
 * comparison is admitted — it is not a per-row decision. An obligation of
 * SGD 300.00 against six credits of SGD 100.00 therefore pours NOTHING: the
 * bucket totals differ by SGD 300.00, `toleranceAdmits` says no, and all seven
 * rows land in the residue as `no_strategy_paired` with zero allocations. So
 * the shortfall must sit INSIDE the amount tolerance, which is what
 * `shortfallMinor` is: the obligation is `credits × 100.00 − shortfall`, the
 * tolerance is `money(shortfall)`, the pour consumes every credit but the last
 * and leaves that one PARTIALLY allocated — and which row is last is the
 * ordinal, which is the row order.
 *
 * ⚠️ `one_to_many`: `arityPermits('one_to_one', 1, 6)` is false and would make
 * the whole bucket an ambiguity instead.
 */
export interface TiedOptions {
  readonly label: string
  /** How many identical SGD 100.00 credits the statement carries. */
  readonly credits: number
  /**
   * How far the single obligation falls short of the credits' total, in minor
   * units. Must be under 100_00 and must equal the run's amount tolerance, or
   * the bucket comparison above refuses and nothing pours.
   */
  readonly shortfallMinor: bigint
  /** Permute the credit rows, each keeping its own `index`. */
  readonly shuffleSeed?: number
}

export function tiedPopulation(options: TiedOptions): SetReconciliationInput {
  const LEFT_DOC = `srcdoc_SYN_tie_${options.label}_ledger`
  const RIGHT_DOC = `srcdoc_SYN_tie_${options.label}_statement`
  const reference = 'RF-TIE-0001'
  const day = '2026-03-11'
  const obligation = 100_00n * BigInt(options.credits) - options.shortfallMinor

  const leftDocument = ledgerDoc(LEFT_DOC, `${options.label}-tied-ar.csv`, [
    line(0, ledgerFields(id(reference), amt(obligation), dte(day), id('CP-TIE'))),
  ])
  const creditLines: ExtractedLine[] = Array.from({ length: options.credits }, (_unused, i) =>
    line(i, bankFields(id(reference), amt(100_00n), dte(day), id('CP-TIE'), txt(`SPLIT ${i}`))),
  )
  if (options.shuffleSeed !== undefined) shuffleInPlace(creditLines, splitmix32(options.shuffleSeed))
  const rightDocument = bankDoc(RIGHT_DOC, `${options.label}-tied-statement.csv`, creditLines)

  return runInput({
    runId: `run_SYN_tie_${options.label}`,
    left: ledgerBinding({ identifiers: [PATHS.reference], counterparty: null }),
    right: bankBinding({ identifiers: [PATHS.reference], counterparty: null, description: null }),
    leftDocuments: [leftDocument],
    rightDocuments: [rightDocument],
    pairing: pairing(
      'one_to_many',
      { kind: 'money', value: mny(options.shortfallMinor) },
      { kind: 'days', value: 5 },
      [{ kind: 'exact_identifier', on: PATHS.reference }],
    ),
    strategyBindings: [bound({ kind: 'exact_identifier', on: PATHS.reference })],
    obligationSide: 'left',
    toleranceDirection: 'symmetric',
  })
}

/* ====================================================================== *
 * §6  CANONICAL FORM — what "byte-identical" is measured on
 * ====================================================================== */

/**
 * A stable string for any value the engine returns, Maps and Sets included.
 *
 * 🛑 `JSON.stringify` ALONE IS NOT A DETERMINISM WITNESS HERE, FOR TWO REASONS
 * AND BOTH BITE. `MatchingState.items` is a `Map` and
 * `AdmittedItem.identifiers` is a `Map`; `JSON.stringify` renders both as `{}`,
 * so a comparison over the raw result would report two runs identical while
 * saying nothing at all about the LEDGER. And object key order is insertion
 * order in V8, which would make this assertion sensitive to a field being moved
 * in a constructor — a change with no semantic content. Keys are sorted; Maps
 * are emitted as their entries IN ORDER, because Map iteration order IS part of
 * what a re-run must reproduce.
 *
 * ⚠️ IT ALSO REFUSES TO HIDE A `NaN`. `JSON.stringify(NaN)` is `"null"`, which
 * is how a poisoned money total can pass an equality check while being neither
 * equal nor a number — see `tests/scenarios/adversarial-inputs.test.ts` §3,
 * where a `NaN` really does reach a result field. `#NaN` is emitted instead.
 */
export function canonicalise(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '#NaN'
    if (!Number.isFinite(value)) return value > 0 ? '#Infinity' : '#-Infinity'
    return String(value)
  }
  if (typeof value === 'bigint') return `${String(value)}n`
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'undefined') return '#undefined'
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`
  if (value instanceof Map) {
    return `Map(${[...value.entries()].map(([k, v]) => `${canonicalise(k)}=>${canonicalise(v)}`).join(',')})`
  }
  if (value instanceof Set) {
    return `Set(${[...value.values()].map(canonicalise).join(',')})`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalise(record[k])}`).join(',')}}`
}

/* ====================================================================== *
 * §7  WHAT THIS GENERATOR DOES NOT COVER — stated, so nobody infers it
 * ====================================================================== */

export const SCALE_KNOWN_GAPS: readonly string[] = [
  'No generated population reaches `amount_sum`. The subset-sum pass needs a counterparty partition on BOTH bindings, and every binding here declares `counterparty: null` so pass 4 does not run at all — `runSetReconciliation` skips it by name. A scale measurement of the bounded search is still owed and it is the one pass whose cost is governed by a stated bound rather than by population size.',
  'No generated population reaches `passFuzzyReference`, so `similarityMaxChars` and `levenshteinBasisPoints` are unmeasured at scale. Fuzzy is O(n·m) per comparison over counterparty text and is the pass most likely to be the real cost; it is not exercised here because its outcome is not hand-derivable over a thousand rows.',
  'No generated row is REFUSED at admission — `expectedRefusedAtAdmission` is zero by construction. The admission-refusal ceiling (C13) is therefore never approached, and a population whose refusal rate crosses it is covered by the corpus at four rows and by nothing at scale.',
  'Nothing here declares a `confidenceFloor`, so G227 held reads are absent from every generated population and `read_held_below_floor` is never a cause at scale.',
  'Nothing here declares `carriesControlTotal: "always"`, so C18 and G236 document accounts are exercised at scale only in their `not_declared_by_format` arm.',
  'The measurements the scale suite prints are WALL CLOCK ON ONE MACHINE, taken once, with no warm-up and no repetition. They are a magnitude, not a benchmark, and `PRODUCT.md` forbids presenting them as anything else.',
]

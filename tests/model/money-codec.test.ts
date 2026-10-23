/* ====================================================================== *
 * THE MONEY CODEC — G111's one conversion, and G286's ceiling, witnessed.
 *
 * 🛑 WHAT THIS SUITE IS FOR, IN ONE SENTENCE: to show that the thing G286 was
 * taken to buy is actually bought. The ruling's deciding fact is a CEILING —
 * `Number.isSafeInteger` caps exact money at 2^53 minor units — so the load
 * bearing assertion here is a value that is WRONG under `number` and RIGHT
 * under `bigint`, computed both ways in the same test, side by side.
 *
 * ⚠️ IT IS NOT A SECOND CORPUS. The vectors are `MONEY_CODEC_VECTORS` in
 * `tests/scenarios/recon-corpus.ts`, beside the money vectors they were split
 * out of, and this file is the runner for them. Two of those vectors are
 * expectations that used to live in `MONEY_VECTORS` and `MONEY_PREDICATE_VECTORS`
 * against a fractional `Money`: `bigint` makes that input a compile error, so
 * the expectation moved to the only door a non-integer minor unit can still come
 * through. The corpus quotes both originals in place.
 *
 * ⚠️ AND IT IS NOT A SECOND IMPLEMENTATION. Nothing here re-derives a decimal
 * string or a bound; every expectation is a literal, derived from the codec's
 * STATED rule — the anchored pattern and the `int8` range — in the corpus rule's
 * own words: *"an expectation copied from the engine is a constant compared to
 * itself and it blesses a bug as correct forever."*
 * ====================================================================== */

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it, test } from 'node:test'

import type { Money } from '../../model/domain.ts'
import {
  MINOR_UNITS_MAX,
  MINOR_UNITS_MIN,
  formatMinorUnits,
  guardMoney,
  minorUnitsFromCount,
  parseMinorUnits,
  parseMoneyWire,
  toMoneyWire,
} from '../../model/money.ts'
import { MONEY_CODEC_VECTORS } from '../scenarios/recon-corpus.ts'

const SGD = (amountMinor: bigint): Money => ({ currency: 'SGD', amountMinor, exponent: 2 })

/** Every module in `model/`, read from the tree rather than listed by hand. */
const MODEL_FILES = readdirSync(new URL('../../model/', import.meta.url)).filter((f) =>
  f.endsWith('.ts'),
)

/* ====================================================================== *
 * §1  THE CEILING — the fact G286 was ruled on, shown both ways
 * ====================================================================== */

describe('the ceiling that G286 raised', () => {
  /**
   * 2^53 + 1 — the smallest positive integer a `number` cannot represent.
   *
   * 🛑 STATED AS A LITERAL AND NEVER COMPUTED FROM `Number.MAX_SAFE_INTEGER`.
   * A test that derived this bound from the same arithmetic it is testing would
   * be comparing a constant to itself, which is the corpus rule verbatim.
   */
  const TWO_POW_53_PLUS_ONE = 9_007_199_254_740_993n

  test('test_the_defect_G286_fixes_a_number_cannot_hold_this_amount', () => {
    /* THE WRONG ANSWER, produced deliberately, so the right one below means
     * something. `Number('9007199254740993')` rounds to the nearest double, which
     * is 2^53 — one LESS than what the string says — and does so silently. */
    assert.equal(Number('9007199254740993'), 9_007_199_254_740_992)
    assert.equal(Number.isSafeInteger(Number('9007199254740993')), false)
    /* And the loss is invisible at the only place anybody would look. */
    assert.equal(String(Number('9007199254740993')), '9007199254740992')
  })

  test('test_the_codec_round_trips_an_amount_no_number_can_hold', () => {
    const parsed = parseMinorUnits('9007199254740993')
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.value, TWO_POW_53_PLUS_ONE)
    /* THE RIGHT ANSWER, against the wrong one above: the string that goes back
     * out is the string that came in, byte for byte. */
    assert.equal(formatMinorUnits(parsed.value), '9007199254740993')
  })

  test('test_arithmetic_above_the_old_ceiling_is_exact', () => {
    /* 2^53 + 1 plus 2. Under `number` both the operand and the sum round, and
     * the answer is 9007199254740994 — off by one. Stated as literals rather
     * than computed, on the corpus rule. */
    assert.equal(TWO_POW_53_PLUS_ONE + 2n, 9_007_199_254_740_995n)
    assert.equal(9_007_199_254_740_993 + 2, 9_007_199_254_740_994)
  })

  test('test_a_cumulative_total_is_the_case_the_ruling_names', () => {
    /**
     * G286: 2^53 minor units is *"ample for one close and not ample for a
     * cumulative total."* A hundred thousand closes of a hundred billion minor
     * units each is 10^16 — past the old ceiling, nowhere near the new one, and
     * no single amount in it is remarkable.
     */
    let total = 0n
    for (let i = 0; i < 100_000; i += 1) total += 100_000_000_000n
    assert.equal(total, 10_000_000_000_000_000n)
    assert.equal(guardMoney(SGD(total)), null, 'and it is storable')
    /* The same sum in `number` is past 2^53 and is no longer exact: adding one
     * minor unit to it changes nothing at all. */
    assert.equal(10_000_000_000_000_000 + 1, 10_000_000_000_000_000)
    assert.notEqual(total + 1n, total)
  })
})

/* ====================================================================== *
 * §2  THE VECTORS — parse, in both directions
 * ====================================================================== */

describe('the codec vectors', () => {
  for (const vector of MONEY_CODEC_VECTORS) {
    test(`test_parseMinorUnits_${vector.name.replace(/[^a-z0-9]+/gi, '_')}`, () => {
      const result = parseMinorUnits(vector.text)
      if (vector.expect === null) {
        assert.equal(result.ok, false, `${vector.name}: ${vector.why}`)
        if (result.ok) return
        assert.equal(result.refusal.kind, vector.refusal, vector.why)
        return
      }
      assert.equal(result.ok, true, `${vector.name}: ${vector.why}`)
      if (!result.ok) return
      assert.equal(result.value, vector.expect, vector.why)
    })
  }

  test('test_every_admitted_vector_round_trips_to_the_string_it_came_from', () => {
    for (const vector of MONEY_CODEC_VECTORS) {
      if (vector.expect === null) continue
      assert.equal(formatMinorUnits(vector.expect), vector.text, vector.name)
    }
  })

  test('test_the_two_refusal_kinds_are_both_reached_by_the_vectors', () => {
    /* ⚠️ §5.6: a table of vectors that all take one arm proves less than it
     * looks. Both surviving guard refusals must be exercised, and this is the
     * assertion that says so rather than leaving it to a reader to count. */
    const kinds = new Set(MONEY_CODEC_VECTORS.map((v) => v.refusal).filter((k) => k !== null))
    assert.deepStrictEqual(
      [...kinds].sort(),
      ['exceeds_exact_integer_range', 'not_integer_minor_units'],
      'both refusal arms must be witnessed, or the table is asserting one thing twice',
    )
  })
})

/* ====================================================================== *
 * §3  THE WHOLE-`Money` BOUNDARY
 * ====================================================================== */

describe('a whole Money across the wire', () => {
  test('test_a_money_round_trips_through_the_wire_unchanged', () => {
    const original = SGD(9_007_199_254_740_993n)
    const wire = toMoneyWire(original)
    assert.equal(wire.ok, true)
    if (!wire.ok) return
    /* 🛑 A STRING, NOT A JSON NUMBER — G65. This is the assertion that would
     * have to change for the ceiling to come back. */
    assert.equal(typeof wire.value.amountMinor, 'string')
    assert.equal(wire.value.amountMinor, '9007199254740993')
    assert.equal(typeof wire.value.exponent, 'number', 'an exponent is not an amount')

    const back = parseMoneyWire(wire.value)
    assert.equal(back.ok, true)
    if (!back.ok) return
    assert.deepStrictEqual(back.value, original)
  })

  test('test_the_wire_form_survives_JSON_and_the_model_form_does_not', () => {
    const original = SGD(9_007_199_254_740_993n)
    const wire = toMoneyWire(original)
    assert.equal(wire.ok, true)
    if (!wire.ok) return
    /* The whole point of the codec, in two lines. */
    assert.equal(JSON.stringify(wire.value), '{"currency":"SGD","amountMinor":"9007199254740993","exponent":2}')
    /* ⚠️ G71 NAMES THIS THROW AS A FEATURE: it forces the boundary decision at
     * the boundary rather than letting it drift to call sites. */
    assert.throws(() => JSON.stringify(original), TypeError)
  })

  test('test_the_boundary_refuses_an_unstated_denomination_before_it_reads_the_amount', () => {
    const unstated = toMoneyWire({ currency: '', amountMinor: 1n, exponent: 2 })
    assert.equal(unstated.ok, false)
    if (unstated.ok) return
    assert.equal(unstated.refusal.kind, 'currency_not_stated')

    /* Both halves wrong: the UNIT is named, because an amount without a stated
     * denomination is C16's problem and the amount is the second-order one. */
    const both = parseMoneyWire({ currency: '', amountMinor: 'not a number', exponent: 2 })
    assert.equal(both.ok, false)
    if (both.ok) return
    assert.equal(both.refusal.kind, 'currency_not_stated')
  })

  test('test_the_boundary_refuses_an_amount_the_column_could_not_hold', () => {
    const tooBig = toMoneyWire(SGD(MINOR_UNITS_MAX + 1n))
    assert.equal(tooBig.ok, false)
    if (tooBig.ok) return
    assert.equal(tooBig.refusal.kind, 'exceeds_exact_integer_range')

    const tooSmall = toMoneyWire(SGD(MINOR_UNITS_MIN - 1n))
    assert.equal(tooSmall.ok, false)
    if (tooSmall.ok) return
    assert.equal(tooSmall.refusal.kind, 'exceeds_exact_integer_range')

    /* Inclusive at both ends. */
    assert.equal(guardMoney(SGD(MINOR_UNITS_MAX)), null)
    assert.equal(guardMoney(SGD(MINOR_UNITS_MIN)), null)
  })

  test('test_the_range_is_the_int8_column_G65_names', () => {
    /* Stated as literals so that changing the bound has to be a deliberate edit
     * in two places rather than a silent one in the module. */
    assert.equal(MINOR_UNITS_MAX, 9_223_372_036_854_775_807n)
    assert.equal(MINOR_UNITS_MIN, -9_223_372_036_854_775_808n)
  })
})

/* ====================================================================== *
 * §4  THE OTHER SURVIVING HOME OF `not_integer_minor_units`
 * ====================================================================== */

describe('a configured count of minor units', () => {
  test('test_a_whole_count_converts', () => {
    const ok = minorUnitsFromCount(50)
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.value, 50n)
  })

  for (const bad of [0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    test(`test_a_count_that_is_not_an_integer_is_refused_${String(bad).replace(/[^a-z0-9]+/gi, '_')}`, () => {
      const result = minorUnitsFromCount(bad)
      assert.equal(result.ok, false, `${String(bad)} is not a count of minor units`)
      if (result.ok) return
      assert.equal(result.refusal.kind, 'not_integer_minor_units')
    })
  }

  test('test_an_enormous_count_is_out_of_RANGE_and_not_NOT_AN_INTEGER', () => {
    /* ⚠️ THE DISTINCTION THE TWO GUARD ARMS HAVE DRAWN SINCE THE MONEY SECTION
     * WAS WRITTEN, PRESERVED ACROSS THE RETYPE. `Number.isInteger(1e21)` is
     * TRUE — it is an integer, exactly representable, and simply enormous — so
     * naming it "not an integer" would report the wrong defect. */
    assert.equal(Number.isInteger(1e21), true)
    const result = minorUnitsFromCount(1e21)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.refusal.kind, 'exceeds_exact_integer_range')
  })
})

/* ====================================================================== *
 * §5  THE PROPERTY G111 ASKS FOR
 * ====================================================================== */

describe('one codec, and only one', () => {
  /* ⚠️ THE `amountMinor` HALF OF THIS PROPERTY IS ASSERTED ELSEWHERE AND IS NOT
   * DUPLICATED HERE. `tests/model/reconciliation-controls.test.ts` carries the
   * `money-sentinel` control, which G286 re-keyed from *"after the §3 sentinel"*
   * to the WHOLE FILE — and it runs over the COMMENT-STRIPPED module, which is
   * the part that matters: `model/reconciliation.ts` still says `amountMinor`
   * eleven times in prose, narrating where the field went and why. A second
   * control over the raw bytes would be red on the narration and would teach
   * people to delete the narration. */

  it('is the only file in model/ that parses or formats a minor-unit string', () => {
    const codec = readFileSync(new URL('../../model/money.ts', import.meta.url), 'utf8')
    assert.equal(codec.includes('BigInt('), true, 'the conversion lives here')
    for (const name of MODEL_FILES) {
      if (name === 'money.ts') continue
      const text = readFileSync(new URL(`../../model/${name}`, import.meta.url), 'utf8')
      assert.equal(
        /\bBigInt\(/.test(text),
        false,
        `${name} converts to \`bigint\`. G111: nothing but the codec may touch the representation.`,
      )
    }
  })
})

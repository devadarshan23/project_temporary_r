/* ==================================================================== *
 * model/money.ts — THE MONEY CODEC. G111, G65, G286.
 *
 * ⚠️ NEW ON 19 Sep 2026, AND IT IS THE MODULE G111 HAS BEEN ASKING FOR SINCE
 * 8 Aug 2026. G111 rules: *"ONE money codec module, and it is the only thing
 * permitted to touch the representation… Every boundary calls the codec;
 * nothing else constructs a `Money` from a string or a string from a `Money`.
 * Same shape G67 demands for `parseFxRate()` — exactly one function — and for
 * the same reason: correctness that lives at call sites is correctness that
 * drifts."*
 *
 * 🛑 WHY IT LANDS NOW, AND THE DIRECTION OF THE CORRECTION MATTERS.
 * `CLAUDE.md` has said since 8 Aug 2026, under G111, that *"`Money.amountMinor`
 * is `bigint` in the model and a decimal STRING on the wire"*. The TREE said
 * `number`, and `model/reconciliation.ts` §3 said so in its own voice —
 * *"Verified at HEAD: `Money.amountMinor` is `number` … and
 * `grep -rn bigint model/*.ts` returns 0."* Two documents asserted opposite
 * things about the load-bearing type in a reconciliation product. **G286
 * (19 Sep 2026) rules that the RECORD WAS RIGHT AND THE CODE WAS WRONG**, and
 * refuses the cheap direction — correcting `CLAUDE.md` to say `number` — on the
 * ground that it *"ratifies a ceiling nobody chose by writing down what
 * drifted."*
 *
 * 🛑 THE DECIDING FACT IS A CEILING, NOT AN ARITHMETIC DEFECT, AND CONFLATING
 * THE TWO IS THE MISREADING THIS HEADER EXISTS TO PREVENT. JavaScript `number`
 * is EXACT on integers under `+` and `−` up to 2^53, so the minor-unit
 * waterfall this engine runs accumulated exactly zero error under `number`.
 * What `number` imposed was a LIMIT: `Number.isSafeInteger` caps exact money at
 * 2^53 minor units — about 90 trillion cents — which is ample for one close and
 * not ample for a cumulative total, a multi-year ledger, or a minor unit finer
 * than two decimals. G88 makes migrations forward-only, so **a stored `number`
 * is a stored ceiling**, and the ruling is taken before ingestion writes rows
 * rather than after.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHAT MOVED HERE, AND WHAT DID NOT
 *
 * Every declaration below but the four wire functions and the two range
 * constants was `model/reconciliation.ts` §3 until this commit, verbatim or
 * near-verbatim, and its reasoning came with it rather than being re-authored.
 * §3's own header predicted this move in its own words: *"G111 rules that ONE
 * money codec module owns the representation; when it lands, this section
 * collapses into a call to it."* It has. `model/reconciliation.ts` re-exports
 * the surface, so every existing import path still resolves and no caller
 * outside this file learned a new name.
 *
 * ⚠️ THE `model/money.ts` THE MODEL GRAPH WAS ASKING FOR IS NOT QUITE THIS ONE,
 * AND THE DIFFERENCE IS NAMED RATHER THAN GLOSSED. `tools/planner/extract.mjs`
 * reported a `module_specified_not_written` gap for this path, cited to
 * `docs/build/reconciliation-engine.md:240` — but that citation is inside the
 * REJECTION of "Design 1", which proposed `model/matching.ts` plus
 * `model/money.ts` and whose negative control was scoped to a FILE rather than
 * to a property (§5.1). What lands here is **G111's codec, not Design 1's
 * split**: `model/matching.ts` is still not written and is still not wanted,
 * and the passes stay in `model/reconciliation.ts`. The gap closes because the
 * path now exists; do not read that as the rejected design being adopted.
 *
 * 🛑 WHAT IS STILL OUTSIDE THIS MODULE AND IS NOT CLOSED BY IT.
 * `model/access.ts` compares `amountMinor` inline in three places — `:2467`,
 * `:2521`, `:3175` — none of which checks `exponent` and none of which is a
 * shared function. §3 named that as a §5.3 instance with a scheduled end date
 * and said those three *"should migrate in the same commit"*. **THEY HAVE NOT,
 * AND THE REASON IS STATED RATHER THAN HIDDEN:** all three sit inside
 * boolean-returning authorisation narrowing, and `compareMoney` returns a
 * REFUSAL — so routing them through it is a decision about what a currency
 * mismatch MEANS for scope narrowing, which is a behaviour change to
 * authorisation code and not a type migration. `CLAUDE.md` rules that cleanups
 * are separate, isolated commits. They compile unchanged under `bigint`
 * (`>` and `<=` are defined on it), which is precisely why the compiler will
 * not force the issue and why it is written down here instead.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE TWO GUARD REFUSALS CHANGED MEANING. THEY WERE NOT DELETED.
 *
 * `MoneyRefusal` is PINNED to the wire — `money_refusal_kinds` in
 * `tools/check-wire-mirror.mjs`, which compares arms AS SEQUENCES against
 * `docs/contracts/capability.openapi.yaml` — so an arm that becomes unreachable
 * cannot simply be dropped without a breaking wire change. Neither was dropped,
 * and neither is vestigial. What each one MEANS after G286:
 *
 *   `not_integer_minor_units` — NO LONGER REACHABLE FROM A CONSTRUCTED `Money`,
 *   BY CONSTRUCTION. A `bigint` is always an exact integer; there is no value
 *   of the type that could fail. It survives because the two places a minor-unit
 *   quantity is still born from something that is NOT already a `bigint` are
 *   real, and both are in this file: `parseMinorUnits()`, where a wire decimal
 *   string may read `"1.5"`, `"NaN"` or `"1e3"`; and `minorUnitsFromCount()`,
 *   where `Tolerance`'s `{ kind: 'rounding'; minorUnits: number }` is pack
 *   CONFIGURATION typed `number` and may be fractional. **The refusal moved
 *   from the middle of the engine to the two edges where a non-integer can
 *   still arrive**, which is the whole point of a codec.
 *
 *   `exceeds_exact_integer_range` — A `bigint` HAS NO RANGE. A COLUMN DOES, AND
 *   THAT IS NOW WHAT THIS ARM NAMES. G65 rules that money *"maps cleanly to
 *   PostgreSQL `bigint` with no silent truncation above 2^53"*, so the storage
 *   this model is declared against is `int8`: −2^63 … 2^63−1. A value outside
 *   it is refusable HERE, at admission, or it is an `INSERT` error after a run
 *   has already been computed — and a run that cannot be stored is not a
 *   smaller success. The bound rose from 2^53−1 to 2^63−1, by a factor of 1024,
 *   and **that rise is the entire subject of G286**: it is why a fixture that
 *   expected this refusal at `Number.MAX_SAFE_INTEGER + 2` now expects an
 *   admission.
 *
 * ⚠️ THE OTHER CEILING IS THE WIRE CONSUMER'S AND IT IS NOT A REFUSAL HERE.
 * A caller that reads the decimal string and hands it to `Number()` is back at
 * 2^53 and has silently lost exactness. **That is why the wire is a STRING and
 * not a JSON number** — G65: *"JSON has no bigint"*. This module cannot police
 * what a consumer does with the string, so it does not pretend to: it emits a
 * form that is exact, and the contract says so in the schema description.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE RULES THIS MODULE KEEPS, all inherited from §3 and all still binding:
 *
 *   1. `amountMinor` is named ONLY in this file. Derive it, do not read it:
 *      `grep -rlc 'amountMinor' model/*.ts` — `access.ts`, `domain.ts`,
 *      `examples.ts`, `learning.ts` and `policy.ts` name it in DECLARATIONS or
 *      prose; no other module READS it through a `.` after this commit except
 *      the three `access.ts` sites named above.
 *   2. Every arithmetic signature is `Money` in and `Money` out. No bare minor
 *      units cross a function boundary except inside a refusal, which carries
 *      none, and out of `minorUnitsOf()`, which exists to be the one way out.
 *   3. `zeroLike()` exists so nobody hand-writes `{ currency, amountMinor: 0n,
 *      exponent }`.
 *   4. The engine only ADDS, SUBTRACTS and COMPARES. It never multiplies, never
 *      divides and never rounds.
 *   5. A throw is banned. Every failure is a value — `MoneyResult`. That is why
 *      `parseMinorUnits()` validates with a pattern BEFORE calling `BigInt()`
 *      rather than catching the `SyntaxError` `BigInt('1.5')` raises: a codec
 *      whose correctness rests on a caught exception is a codec with a throw in
 *      it.
 * ==================================================================== */

import type { Money } from './domain'

/* -------------------------------------------------------------------- *
 * The refusal vocabulary — MOVED FROM `model/reconciliation.ts` §1
 * -------------------------------------------------------------------- */

export type MoneyRefusal =
  | { kind: 'currency_mismatch' }
  | { kind: 'exponent_mismatch' }
  /**
   * ⚠️ RE-HOMED BY G286, NOT RETIRED. Unreachable from a constructed `Money`
   * now that `amountMinor` is `bigint` — a `bigint` cannot be fractional. Live
   * at exactly two edges, both in this module: `parseMinorUnits()` over a wire
   * decimal string, and `minorUnitsFromCount()` over a configured `number`.
   * The module header argues it at length.
   */
  | { kind: 'not_integer_minor_units' }
  /**
   * ⚠️ RE-HOMED BY G286, NOT RETIRED, AND THE BOUND MOVED BY A FACTOR OF 1024.
   * It meant `Number.isSafeInteger` — 2^53 — and now means the `int8` column
   * G65 declares money is stored in: −2^63 … 2^63−1. A `bigint` has no range;
   * a column and a run that must be persisted both do.
   */
  | { kind: 'exceeds_exact_integer_range' }
  /**
   * C16. A declared unit whose currency is the empty string — a declaration that
   * declares nothing. Carries no value: the rejected string would be
   * configuration rather than counterparty text, but the arm's siblings carry
   * none and consistency here is cheaper than an exception.
   */
  | { kind: 'currency_not_stated' }
  /**
   * C16. Stated and INVALID — negative, or not an integer. Distinct from
   * `currency_not_stated` because they are different operator errors with
   * different fixes, and folding both into one kind is the shape
   * `docs/HANDOFF.md` §5.2 catalogues.
   */
  | { kind: 'exponent_not_a_non_negative_integer' }
  /**
   * `sumGross` over an EMPTY list. It returned `currency_mismatch`, which is
   * simply FALSE — there is no second currency to mismatch, and a caller reading
   * that arm would go looking for a denomination problem that does not exist.
   *
   * 🛑 UNREACHABLE FROM C18 TODAY, SAID PLAINLY RATHER THAN IMPLIED BY COVERAGE,
   * in the idiom `admitted_item_key_collision` already uses in the engine.
   * `presentedRows` yields at least one row for every document, so a document
   * whose admitted set is empty always has a refused row and is caught by
   * `control_total_unverifiable_rows_refused` before any sum is attempted. The
   * arm exists because the OLD answer was a lie, not because a fixture reaches
   * it: a refusal that names the wrong cause is worse than one nobody sees.
   */
  | { kind: 'no_items' }

export type MoneyResult<T> =
  | { ok: true; value: T }
  | { ok: false; refusal: MoneyRefusal }

/* -------------------------------------------------------------------- *
 * The unit — MOVED FROM `model/reconciliation.ts` §3
 * -------------------------------------------------------------------- */

/**
 * A money UNIT — the denomination, with no amount attached.
 *
 * ⚠️ NOT A SECOND MONEY VOCABULARY (§5.3), AND THE ASSERTION BELOW IS WHAT MAKES
 * THAT CHECKABLE RATHER THAN ASSERTED. It is `Money` with `amountMinor`
 * removed, and `Money` is assignable to it structurally — which is why
 * `sameUnit()` can take it and keep working, unchanged, on the `Money`
 * arguments it already has.
 *
 * WHY IT EXISTS AT ALL. C16 requires a population's denomination to be DECLARED.
 * The only existing carrier of a denomination is a `Money`, and declaring one
 * would mean writing an amount — a FABRICATED ZERO, in the one place a
 * declaration is supposed to be authoritative. `ResidueEntry.settlement` records
 * what a fabricated zero cost this codebase once already.
 *
 * 🛑 WHAT IT DOES NOT DO, AND THIS IS A REFUSAL AND NOT AN OMISSION. It asserts
 * NOTHING about ISO 4217 membership. There is no currency table anywhere in
 * `model/` — `Money.currency` and `MoneyAmount.currency` (`model/policy.ts`)
 * are both bare strings — and `model/policy.ts` already refuses to derive an
 * exponent from a currency code rather than invent one, on §5.7. Membership
 * belongs to the ingestion codec and, under G111, to this module. ⚠️ **THIS
 * MODULE NOW EXISTS AND STILL DOES NOT MINT A CURRENCY TABLE**, which is a
 * refusal rather than an omission for the reason §3 gave: a currency list
 * minted here would be a table `PRODUCT.md` forbids inventing, and nothing in
 * this repository is authoritative for it.
 *
 * 🛑 AND IT MAY NEVER APPEAR ON A TEXT-PROOFED UNION. `currency` is a free
 * `string`, so `AssertNoTextDeep` over anything holding a `MoneyUnit` fails by
 * design. Refusals carry a `MoneyRefusal`, never a unit.
 */
export interface MoneyUnit {
  /** ISO 4217, e.g. 'SGD'. Checked as STATED, never as a member. */
  readonly currency: string
  /** Minor units per major unit as a power of ten. 2 for SGD, 0 for JPY. */
  readonly exponent: number
}

type Assert<T extends true> = T

/**
 * The §5.3 mitigation, in the type system — IN BOTH DIRECTIONS.
 *
 * 🛑 THE OBVIOUS ENCODING IS HALF A PROOF, AND THE HALF IT MISSES IS THE ONE THAT
 * MATTERS. `Assert<Money extends MoneyUnit ? true : false>` catches `MoneyUnit`
 * gaining a field. It does NOT catch `Money` gaining a THIRD denomination field —
 * a scale, an fx marker: the `extends` stays true, `MoneyUnit` silently
 * under-specifies, and `sameUnit` compares an incomplete pair while the assertion
 * reports health. Asserting over KEYS, both ways, is what makes drift in either
 * type a compile error.
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN. `Assert<never>` COMPILES, so a proof
 * can be vacuous and look identical to a proof that holds. Add a `scale: number`
 * to `Money` and this must report TS2344.
 */
export type _MoneyIsAMoneyUnitPlusAnAmount = Assert<
  [Exclude<keyof Money, 'amountMinor'>] extends [keyof MoneyUnit]
    ? [keyof MoneyUnit] extends [Exclude<keyof Money, 'amountMinor'>]
      ? true
      : false
    : false
>

/**
 * ⚠️ WIDENED FROM `Money` TO `MoneyUnit` BY C16, BODY UNCHANGED. Every existing
 * caller passes a `Money` and still compiles, because a `Money` IS a unit plus an
 * amount — the assertion above is what keeps that true. It compares currency AND
 * exponent, which is why C16 uses it for all three of its comparisons rather than
 * hand-rolling a currency test: `model/access.ts` hand-rolls that comparison in
 * three places and none of them checks the exponent.
 *
 * ⚠️ EXPORTED BY G286, WHERE §3 KEPT IT PRIVATE. `toleranceNamesUnit()` stays in
 * `model/reconciliation.ts` — a tolerance is engine configuration, not money —
 * and it needs this comparison. One export is cheaper than a second currency
 * comparison, which is the §5.3 this whole module exists to end.
 */
export function sameUnit(a: MoneyUnit, b: MoneyUnit): MoneyRefusal | null {
  if (a.currency !== b.currency) return { kind: 'currency_mismatch' }
  if (a.exponent !== b.exponent) return { kind: 'exponent_mismatch' }
  return null
}

/* -------------------------------------------------------------------- *
 * The storage range — NEW UNDER G286, and the bound the ruling raised
 * -------------------------------------------------------------------- */

/**
 * The inclusive minor-unit range money may take, and the ONLY definition of it.
 *
 * 🛑 IT IS A COLUMN'S RANGE, NOT A LANGUAGE'S. G65: money *"maps cleanly to
 * PostgreSQL `bigint` with no silent truncation above 2^53"*. `int8` is a signed
 * 64-bit integer, so the range is −2^63 … 2^63−1 and a value outside it cannot
 * be stored. Refusing at admission rather than at `INSERT` is the difference
 * between a run that refuses a row and a run that is computed, reported and then
 * fails to persist.
 *
 * ⚠️ NO COLUMN HOLDS MONEY YET — a case-insensitive grep for `minor` or `money`
 * across every file under `db/` returns nothing at this commit — so this bound is
 * declared against the storage G65 NAMES rather than against a table that
 * exists. Stated plainly rather than implied: when that column lands it must be
 * `bigint`, and `pg` returns `int8` as a STRING by default, which is exactly the
 * form `parseMinorUnits()` takes. That is not a coincidence; it is why the wire
 * form and the driver form are the same form.
 *
 * ⚠️ AND IT WAS 2^53−1 UNTIL 19 Sep 2026 — `Number.MAX_SAFE_INTEGER`, via
 * `Number.isSafeInteger`. THE RISE IS THE RULING. Anything that expected a
 * refusal between 2^53 and 2^63 now expects an admission, and that is G286
 * working rather than a regression.
 */
export const MINOR_UNITS_MIN = -(2n ** 63n)
export const MINOR_UNITS_MAX = 2n ** 63n - 1n

/**
 * The only statement of what a legal minor-unit quantity is.
 *
 * ⚠️ IT NO LONGER CHECKS INTEGRALITY AND THAT IS NOT AN OMISSION. Its first line
 * was `if (!Number.isInteger(amountMinor)) return { kind: 'not_integer_minor_units' }`
 * and there is no `bigint` for which that could fire. The check moved to the two
 * edges that can still produce a non-integer — see the module header.
 */
function guardMinor(amountMinor: bigint): MoneyRefusal | null {
  if (amountMinor < MINOR_UNITS_MIN || amountMinor > MINOR_UNITS_MAX) {
    return { kind: 'exceeds_exact_integer_range' }
  }
  return null
}

/* -------------------------------------------------------------------- *
 * Reads and constructions — MOVED FROM `model/reconciliation.ts` §3
 * -------------------------------------------------------------------- */

export function zeroLike(like: Money): Money {
  return { currency: like.currency, amountMinor: 0n, exponent: like.exponent }
}

export function isZeroMoney(value: Money): boolean {
  return value.amountMinor === 0n
}

/**
 * THE ONLY WAY OUT OF THE `Money` REPRESENTATION, AND THE POINT OF IT IS G111.
 *
 * G111 rules that ONE money codec owns the representation and nothing else may
 * touch it. Every read of the field outside this module was a site the G286
 * migration would have had to find by hand. Routing them through four accessors
 * means the whole engine presented that migration with a single surface.
 *
 * ✅ AND THAT IS EXACTLY WHAT HAPPENED, WHICH IS WORTH RECORDING BECAUSE THE
 * PREDICTION WAS MADE IN WRITING FIRST. §3 said of this function: *"THIS
 * FUNCTION IS THE ONE THAT BREAKS UNDER G65, deliberately and visibly: its
 * return type is `number` and it will have to become `bigint` or lose precision.
 * Better one loud compile error here than twenty silent `number`/`bigint`
 * mixings scattered through five passes."* It broke here, loudly, and the
 * mixings the sentence predicted did not happen — every downstream site the
 * compiler then named is an accumulator whose type followed this one.
 */
export function minorUnitsOf(value: Money): bigint {
  return value.amountMinor
}

export function isPositiveMoney(value: Money): boolean {
  return value.amountMinor > 0n
}

export function isNegativeMoney(value: Money): boolean {
  return value.amountMinor < 0n
}

/** `guardMinor` over a whole `Money`. Exported so callers need not name the field. */
export function guardMoney(value: Money): MoneyRefusal | null {
  return guardMinor(value.amountMinor)
}

/**
 * Is a declared unit STATED? Not: is it a currency. See `MoneyUnit`.
 *
 * ⚠️ NO UPPER BOUND ON `exponent`, DELIBERATELY. This engine only ADDS, SUBTRACTS
 * and COMPARES — it never multiplies, never divides and never rounds — so a large
 * exponent has no arithmetic consequence, and `sameUnit` refuses a mismatch
 * so it cannot be mixed. A ceiling would be a number nobody in this repository is
 * authoritative for (`PRODUCT.md`).
 *
 * ⚠️ IT LIVED IN §3 BECAUSE §3 WAS THE ONLY PLACE THAT OWNED MONEY, AND THE
 * ARGUMENT FOR ITS PLACEMENT IS NOW SIMPLER RATHER THAN GONE. §3's note read:
 * *"The obvious placement is beside the per-side loop in `runSetReconciliation`,
 * which is BELOW `_MoneySectionEndsHere` … the `money-sentinel` control bans the
 * literal `amountMinor` ONLY, so a gate reading `unit.currency` and
 * `unit.exponent` down there would leave that control green while the property
 * it protects is breached — §5.6."* That is still the reason it may not move
 * down; it is now also simply where money lives.
 */
export function guardUnit(unit: MoneyUnit): MoneyRefusal | null {
  if (unit.currency.length === 0) return { kind: 'currency_not_stated' }
  if (!Number.isInteger(unit.exponent) || unit.exponent < 0) {
    return { kind: 'exponent_not_a_non_negative_integer' }
  }
  return null
}

/* -------------------------------------------------------------------- *
 * Arithmetic — MOVED FROM `model/reconciliation.ts` §3. Bodies unchanged
 * except for the literal suffix the retype forces.
 * -------------------------------------------------------------------- */

export function addMoney(a: Money, b: Money): MoneyResult<Money> {
  const unit = sameUnit(a, b)
  if (unit !== null) return { ok: false, refusal: unit }
  const ga = guardMinor(a.amountMinor)
  if (ga !== null) return { ok: false, refusal: ga }
  const gb = guardMinor(b.amountMinor)
  if (gb !== null) return { ok: false, refusal: gb }
  const sum = a.amountMinor + b.amountMinor
  /**
   * ⚠️ THE ONE GUARD THAT GOT STRONGER RATHER THAN WEAKER UNDER G286, AND IT IS
   * THE REASON AN OVERFLOW CHECK ON A `bigint` IS NOT VACUOUS. Under `number`,
   * a sum past 2^53 had ALREADY lost exactness by the time this line ran — the
   * guard reported a loss that had happened. `sum` is now exact whatever its
   * magnitude, so this refuses a total that could not be STORED while the total
   * itself is still correct. Two operands inside `int8` can sum outside it.
   */
  const gs = guardMinor(sum)
  if (gs !== null) return { ok: false, refusal: gs }
  return { ok: true, value: { currency: a.currency, amountMinor: sum, exponent: a.exponent } }
}

export function subtractMoney(a: Money, b: Money): MoneyResult<Money> {
  const negated: Money = { currency: b.currency, amountMinor: -b.amountMinor, exponent: b.exponent }
  return addMoney(a, negated)
}

/**
 * −1, 0 or 1. Refuses across currencies OR exponents — §5.7's refusal, once.
 *
 * ⚠️ RETURNS A `number`, NOT A `bigint`, AND THAT IS DELIBERATE. The value is an
 * ORDERING, not an amount: it is three-valued and carries no minor units, so
 * giving it the money representation would be a second vocabulary for a thing
 * that is not money. Every caller compares it against `0`.
 */
export function compareMoney(a: Money, b: Money): MoneyResult<number> {
  const unit = sameUnit(a, b)
  if (unit !== null) return { ok: false, refusal: unit }
  const ga = guardMinor(a.amountMinor)
  if (ga !== null) return { ok: false, refusal: ga }
  const gb = guardMinor(b.amountMinor)
  if (gb !== null) return { ok: false, refusal: gb }
  const d = a.amountMinor - b.amountMinor
  return { ok: true, value: d === 0n ? 0 : d < 0n ? -1 : 1 }
}

export function minMoney(a: Money, b: Money): MoneyResult<Money> {
  const c = compareMoney(a, b)
  if (!c.ok) return c
  return { ok: true, value: c.value <= 0 ? a : b }
}

/* -------------------------------------------------------------------- *
 * THE CODEC PROPER — NEW UNDER G286. The only conversion between the
 * model's `bigint` and the wire's decimal string, in either direction.
 * -------------------------------------------------------------------- */

/**
 * A `Money` as it appears on the wire.
 *
 * 🛑 `amountMinor` IS A STRING AND THAT IS G65, NOT A STYLE CHOICE. *"JSON has
 * no bigint, so both contract files change: `amountMinor: {type: integer}` →
 * `{type: string, pattern: '^-?[0-9]+$'}`. Breaking on the wire."* A JSON
 * number would be read back by every consumer as an IEEE double and would be
 * silently wrong above 2^53 — which is the exact ceiling G286 was taken to
 * raise. Emitting the integer would raise the ceiling in the model and leave it
 * in place on the wire.
 *
 * ⚠️ `exponent` STAYS A JSON NUMBER. It is a power of ten in single digits, not
 * an amount; making it a string would be a second answer to a question money
 * only has one of.
 *
 * ⚠️ AND `JSON.stringify` ON A RAW `Money` NOW THROWS — `TypeError: Do not know
 * how to serialize a BigInt`. G71 names that as a FEATURE, not a hazard: it
 * forces the boundary decision at the boundary instead of letting it drift.
 * `model/canonical.ts` already refuses a `bigint` rather than inventing an
 * encoding for it, for the same reason, and says so in its own header.
 */
export interface MoneyWire {
  readonly currency: string
  /** Minor units as a DECIMAL STRING. `^-?[0-9]+$`. Never a JSON number. */
  readonly amountMinor: string
  /** Minor units per major unit as a power of ten. 2 for SGD, 0 for JPY. */
  readonly exponent: number
}

/**
 * The accepted wire form, stated ONCE and anchored at both ends.
 *
 * 🛑 THE ANCHORS ARE THE WHOLE CONTROL. `/-?[0-9]+/` without `^…$` matches
 * INSIDE `"1.5"`, `"12abc"` and `" 7 "`, and a codec that accepted those would
 * be §5.6 in the one module G111 exists to make trustworthy. Refused by
 * construction, and each is a fixture in `tests/model/money-codec.test.ts`.
 *
 * ⚠️ WHAT IT REFUSES THAT `BigInt()` WOULD HAVE ACCEPTED, and each is money
 * arriving in a shape nobody declared: `'0x10'` (hex), `'0b1'`, `'0o7'`,
 * `'1_000'` (numeric separators are a SOURCE syntax and `BigInt` rejects them,
 * but `Number` does not — refusing here means the two never disagree), `'+7'`,
 * `''` and `'   '` (both of which `BigInt` reads as `0n`, which is the worst
 * failure mode on this list: an absent amount becoming a zero amount).
 */
const MINOR_UNITS_ON_THE_WIRE = /^-?[0-9]+$/

/**
 * A `bigint` OUT of the model and onto the wire. The only such conversion.
 *
 * Total: every `bigint` has a decimal form. Range is NOT checked here — a value
 * that reached this function was guarded when it was constructed, and re-guarding
 * on the way out would put a refusal on a path that has no way to report one.
 * `toMoneyWire()` is the guarded boundary.
 */
export function formatMinorUnits(minor: bigint): string {
  return minor.toString(10)
}

/**
 * A decimal string OFF the wire and into the model. The only such conversion.
 *
 * ⚠️ PATTERN FIRST, `BigInt()` SECOND, AND THE ORDER IS THE RULE THAT KEEPS THE
 * THROW BAN. `BigInt('1.5')` raises `SyntaxError`. A `try`/`catch` would work
 * and would make this module's correctness rest on an exception, in a file whose
 * governing rule is that every failure is a value. The pattern makes the call
 * total.
 */
export function parseMinorUnits(text: string): MoneyResult<bigint> {
  if (!MINOR_UNITS_ON_THE_WIRE.test(text)) return { ok: false, refusal: { kind: 'not_integer_minor_units' } }
  const parsed = BigInt(text)
  const g = guardMinor(parsed)
  if (g !== null) return { ok: false, refusal: g }
  return { ok: true, value: parsed }
}

/**
 * A configured `number` count of minor units, into the representation.
 *
 * 🛑 THIS IS THE SECOND SURVIVING HOME OF `not_integer_minor_units` AND IT IS
 * NOT A CONVENIENCE. `Tolerance` carries `{ kind: 'rounding'; minorUnits:
 * number }` (`model/domain.ts`) — pack CONFIGURATION, authored by a human, typed
 * `number`, and perfectly capable of being `0.5`. `toleranceAdmits()` compares it
 * against a `bigint` variance, so SOMETHING has to convert, and G111 says that
 * something is this module and nothing else. `BigInt(0.5)` throws, so the
 * integrality test comes first and the call is total.
 *
 * ⚠️ `Number.isInteger`, NOT `Number.isSafeInteger`, AND THE DIFFERENCE IS
 * DELIBERATE. `Number.isInteger(1e21)` is TRUE — it is an integer, exactly
 * representable as a `number`; it is simply enormous. Refusing it HERE as *not
 * an integer* would name the wrong defect. `BigInt(1e21)` converts it exactly
 * and `guardMinor` then refuses it as out of range, which is what it actually
 * is. That is the same distinction `MoneyRefusal` has drawn between its two
 * guard arms since the money section was written, preserved across the retype.
 *
 * ⚠️ IT DOES NOT REFUSE A NEGATIVE COUNT. `toleranceAdmits()` refuses that
 * itself, on its own ground — a negative tolerance is a tolerance defect, not a
 * money defect, and `MoneyRefusal` has no arm that says so truthfully.
 */
export function minorUnitsFromCount(count: number): MoneyResult<bigint> {
  if (!Number.isInteger(count)) return { ok: false, refusal: { kind: 'not_integer_minor_units' } }
  const parsed = BigInt(count)
  const g = guardMinor(parsed)
  if (g !== null) return { ok: false, refusal: g }
  return { ok: true, value: parsed }
}

/**
 * A whole `Money` onto the wire — guarded, because this is a boundary.
 *
 * Refuses an unstated or invalid denomination (`guardUnit`) and an amount
 * outside the storage range (`guardMoney`) rather than emitting either, so a
 * value that leaves this function is one a consumer can read and a column can
 * hold.
 */
export function toMoneyWire(value: Money): MoneyResult<MoneyWire> {
  const unit = guardUnit(value)
  if (unit !== null) return { ok: false, refusal: unit }
  const amount = guardMoney(value)
  if (amount !== null) return { ok: false, refusal: amount }
  return {
    ok: true,
    value: {
      currency: value.currency,
      amountMinor: formatMinorUnits(value.amountMinor),
      exponent: value.exponent,
    },
  }
}

/**
 * A whole `Money` off the wire — guarded at the same strength, in both fields.
 *
 * ⚠️ THE UNIT IS CHECKED BEFORE THE AMOUNT, DELIBERATELY. An amount without a
 * stated denomination is not a smaller problem than a malformed amount; it is
 * the problem C16 exists about, and reporting the amount first would name the
 * second-order defect.
 */
export function parseMoneyWire(wire: MoneyWire): MoneyResult<Money> {
  const unit = guardUnit(wire)
  if (unit !== null) return { ok: false, refusal: unit }
  const minor = parseMinorUnits(wire.amountMinor)
  if (!minor.ok) return minor
  return {
    ok: true,
    value: { currency: wire.currency, amountMinor: minor.value, exponent: wire.exponent },
  }
}

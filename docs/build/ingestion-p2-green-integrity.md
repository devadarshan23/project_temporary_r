# GREEN — the three integrity changes inside `model/reconciliation.ts`

**C16 (declared currency) · C17 (the named duplicate) · C18 (control-total admission) · C13's admission floor**

> *Analysis and design only. No file in `/Users/jrkphani/Projects/Reconcile` was created, edited or
> deleted; no git command was run. This document IS the plan `CLAUDE.md` requires before touching
> `model/reconciliation.ts`.*
>
> **Every `file:line` below was opened in this session.** Where I cite a line I did not open in full
> (three test-file builder functions) I say `grep-verified` and nothing rests on the surrounding text.
> Counts are derived with the command shown, never quoted from prose (§5.11).

---

## 0. Reproduce the premises before believing this page

```bash
# The four sites C16/C17/C18/C13 name, at HEAD. Each is quoted in §1.
sed -n '1004p;1024,1026p;1122p;1132p;1144p'  model/reconciliation.ts   # C16
sed -n '2834,2836p;2699,2703p'               model/reconciliation.ts   # C17, both sites
sed -n '1840,1864p'                          model/domain.ts           # C18 — no trailer field
sed -n '1146,1150p'                          model/reconciliation.ts   # C13 — accumulate and carry on

grep -rn 'unique_within' model/ tests/ docs/       # 5 hits, ZERO evaluator
grep -rn 'controlTotal\|expectedLineCount\|declaredControlTotal' model/   # 0 — nothing exists
grep -n 'amountMinor' model/domain.ts              # :535 — `number`, NOT bigint. See §6.4
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md          # 131 rows
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'   # 35 applied (the adjudication said 33)
```

⚠️ **One brief premise is false at the tree and the design changes because of it.** The brief says
*"Money is bigint in the model and a decimal string on the wire."* `Money.amountMinor` is
**`number`** (`model/domain.ts:535`), `grep -rn bigint model/*.ts` returns nothing, and
`model/reconciliation.ts:541-542` says so in the module itself: *"Verified at HEAD:
`Money.amountMinor` is `number` … and `grep -rn bigint model/*.ts` returns 0."* G65, G78, G111 and
G112 are all **not applied** (`docs/HANDOFF.md:719`, `:804`, `:837`, `:838`). §6.4 states exactly
what my design needs from the codec and what it deliberately does not do while the codec is absent.

---

## 1. What already exists that this reuses

Nothing below is new machinery. Each row is the existing thing, its verified line, and the piece of
my design that stands on it.

| # | Existing thing | Verified at | What it carries for me |
|---|---|---|---|
| 1 | `sameUnit(a, b)` — currency **and** exponent, one refusal | `model/reconciliation.ts:563-567` | **C16's whole comparison.** It already expresses "same money unit". I widen its parameter type; I do not write a second comparison. |
| 2 | `MoneyRefusal` = `currency_mismatch \| exponent_mismatch \| not_integer_minor_units \| exceeds_exact_integer_range` | `:264-268` | The reason vocabulary for every unit disagreement, in both C16 and C18. No new reason strings. |
| 3 | `_MoneyRefusalHoldsNoText` and the stated reason a refusal carries no amount and no currency | `:275-284` | Why C18's defect carries **minor units, not `Money`**: `Money.currency` is `string` (`model/domain.ts:533`), so `AssertNoTextDeep` mechanically forbids putting a `Money` in an asserted union. The compiler enforces the shape I wanted anyway. |
| 4 | `AssertNoTextDeep<T>` / `NoTextField<T>`, with the load-bearing `T extends string ? T` arm that lets a branded `Id<'…'>` pass | `:248-258`, reason at `:239-242`; `Id<TName> = string & { readonly [brand]: TName }` at `model/kernel.ts:43` | Lets a defect name the offending **document id** and **`ItemRef`** while still proving no free text escapes. Verified by construction: `ItemRef` is `{ sourceDocumentId: SourceDocumentId; lineIndex: number \| null }` (`:785-789`). |
| 5 | `itemKey(side, ref)` — length-prefixed, provably collision-free | `:791-813` | **C17's identity function.** The duplicate I must detect is an `itemKey` collision, and `itemKey` is what already defines the address. |
| 6 | `sumGross(items)` — folds `addMoney` over admitted items, returns `MoneyResult` | `:1463-1473` | **C18's sum.** Private to the module, already used by `passAmountSum`. I call it; I do not write an adder. |
| 7 | `compareMoney(a, b)` → `MoneyResult<number>`, refuses across units | `:633-642` | **C18's comparison against the trailer.** Catches a trailer denominated in another currency as a *named* refusal rather than a wrong verdict. |
| 8 | `minorUnitsOf(value)` — the only read of the field, and the declared G111 migration surface | `:597-599` (docblock `:583-595`) | The one legal way for a defect to carry a number. It also keeps the `money-sentinel` control green (`tests/model/reconciliation-controls.test.ts:308-326` bans the literal `amountMinor` after `_MoneySectionEndsHere` at `model/reconciliation.ts:762`). |
| 9 | `normalisation_invalid { kind, side, defects: readonly NormalisationDefect[] }` | `:2633` | **The exact shape of my one new refusal arm.** One arm, one side, many named defects. `_SetReconciliationRefusalHoldsNoText` (`:2638`) already proves an array-of-unions passes the containment assertion, so I inherit that proof. |
| 10 | `bindingsAgree(spec, bindings): SetReconciliationRefusal \| null`, called as a gate inside the fold | `:2732-2754`, called `:2823-2824` | The house idiom for "a pure checker returning a reasoned refusal or null" at exactly the position I need one (§5.2 — never a boolean). |
| 11 | The stated-bound gates: `reader_candidate_cap_not_stated`, `similarity_max_chars_not_stated`, `subset_sum_bound_not_stated`, each refusing on absence | `:2775-2807`; arms `:2634-2636` | **C13's ceiling and C16's declared unit are bounds, and this is where a bound that is not stated refuses.** *"An absent bound is a refusal, never a default"* (`:2775`). |
| 12 | `checkPostconditions(state, residue): readonly PostconditionFailure[]` — an exported, pure, list-returning integrity pass | `:2681-2730` | The shape of `checkPopulationIntegrity()`, and the home of `population_wholly_refused`. |
| 13 | `PostconditionFailure.gross_not_partitioned { admittedMinor, accountedMinor }` | `:2646` | The precedent that a **diagnostic** may carry minor units even though a **refusal** may not carry a currency. C18's defect follows it. |
| 14 | `indexBy(items, on): ReadonlyMap<string, readonly AdmittedItem[]>` — the multimap that fixed A9(a) | `:1418-1431` | The grouping idiom I reuse verbatim to bucket admitted items **by document** for C18. |
| 15 | `AmbiguityFinding` + `identifier_ambiguous` residue attribution + `arityPermits` | `:1379-1386`, `:2903-2907`, `:1433-1443` | **The mechanism that already makes a *value*-level duplicate a named outcome**, witnessed by `duplicateIdentifierIsAnAmbiguity` (`tests/scenarios/recon-corpus.ts:1329-1396`). This is the whole reason `unique_within` gets a drop note and not an evaluator (§2.6). |
| 16 | `PopulationBinding` — the declared stopgap that carries fields `PopulationSpec` does not have yet, each naming the declaration it will collapse into | `:931-981`; end state `docs/build/reconciliation-engine.md:647-675` (DP-2) | Where `declaredUnit` lands. **DP-2 gains a fourth field; I do not invent a DP-2b.** |
| 17 | `ExtractedLine { index; fields }` and `SourceDocument { lines; extracted; … }` | `model/domain.ts:1835-1838`, `:1840-1864` | C18's row count: `lines.length`, or **1** for a header-grain document — the branch `admitPopulation` already takes at `model/reconciliation.ts:1126`. |
| 18 | `ACQUISITION_FIDELITY` / `DocumentType.expectedFidelity` | `model/domain.ts:1782-1793`, `:1801-1807` | Names the tier a document arrived as. **I do not touch it** — C7's `actualFidelity` is another commit's work (`docs/build/ingestion-pipeline.md` build row 2). Recorded so the two commits do not collide in `SourceDocument`. |
| 19 | The export-surface register: the export list is **parsed from the module on disk** and compared in **both directions**, so a new runtime export nobody calls fails the suite | `tests/scenarios/export-surface.test.ts:15-27` | **My fixture obligation is mechanically enforced.** `checkPopulationIntegrity` cannot land without a call site. This is §5.10 already solved for me. |
| 20 | The corpus's `doc()` / `ledgerBinding()` / `bankBinding()` / `runInput()` builders and the 22-scenario × 10-`it` sweep | `tests/scenarios/recon-corpus.ts:250-274`, `:312-348`, `:389-408`, `:2094-2117`; the ten `it`s at `tests/scenarios/engine-behaviour.test.ts:306-386` | Every new required field lands in **one** builder and propagates to 22 scenarios. The blast radius is small *because* the corpus is centralised. |
| 21 | `KNOWN_GAPS` — *"No scenario mixes exponents within one population — every amount is exponent 2"* | `tests/scenarios/recon-corpus.ts:3558` | A stated gap that C16 closes with one new scenario. I am not inventing a test subject; the corpus already asked for it. |
| 22 | `ResidueEntry.settlement: ItemSettlement \| null` and its docblock refusing a fabricated zero | `:2100-2119` | The posture C18 must not break: a row that could not be read gets **null**, never `{ currency: '', amountMinor: 0 }`. My design adds no `Money` literal anywhere. |

**Two things I must NOT reuse, stated because they look reusable.**

- `RulePredicate.unique_within` (`model/domain.ts:367`) is **not** the duplicate mechanism for this
  seam. See §2.6.
- `PostconditionFailure` is **not** where a control-total mismatch goes. A control-total mismatch
  says *the population is not the population*; a postcondition says *the ledger over this population
  is unsound* (`:2661`, `:2669-2679`). Folding them would be §5.3 — two properties, one vocabulary.

---

## 2. The design — exact declarations, with file and insertion point

Four commits' worth of declarations, ordered as they will be applied (§3a has the sequence and the
reason the order is not the adjudication's).

### 2.1 `MoneyUnit` — the currency-and-exponent pair, without an amount

**File.** `model/reconciliation.ts`. **Insertion point.** §3, immediately after the section banner
closes at `:561` and **before** `function sameUnit` at `:563`.

```ts
/**
 * A money UNIT — the denomination, with no amount attached.
 *
 * ⚠️ THIS IS NOT A SECOND MONEY VOCABULARY (§5.3), AND THE ASSERTION BELOW IS
 * WHAT MAKES THAT CHECKABLE RATHER THAN ASSERTED. It is `Money`
 * (`model/domain.ts:531`) with `amountMinor` removed, and `Money` is assignable
 * to it structurally — which is exactly why `sameUnit()` below can take it and
 * keep working, unchanged, on the `Money` arguments it already has.
 *
 * WHY IT HAS TO EXIST AT ALL. C16 requires a population's denomination to be
 * DECLARED. The only existing carrier of a denomination is a `Money`, and
 * declaring one would mean writing an amount — a fabricated zero, in the one
 * place a declaration is supposed to be authoritative. `ResidueEntry.settlement`
 * (§9) records what a fabricated zero cost this codebase once already.
 *
 * WHAT IT DOES NOT DO. It asserts nothing about ISO 4217 membership. Whether
 * `'XBT'` is a currency is a CATALOGUE question, and there is no currency table
 * anywhere in `model/` (`grep -rn "ISO 4217" model/` returns comments only). The
 * closed-ISO-set half of C16 belongs to the ingestion codec — C11's `ValueCodec`
 * — and under G111 to the money codec that owns the representation. Inventing a
 * currency list here would be a second catalogue in the engine (§5.3) for a list
 * this module is not authoritative for.
 */
export interface MoneyUnit {
  /** ISO 4217, e.g. 'SGD'. Length-checked as STATED, never as a member. */
  readonly currency: string
  /** Minor units per major unit as a power of ten. 2 for SGD, 0 for JPY. */
  readonly exponent: number
}

/**
 * The §5.3 mitigation, in the type system. If `Money` and `MoneyUnit` ever drift
 * apart in the two fields that name a denomination, this line is a compile
 * error rather than a silently divergent second spelling.
 */
export type _MoneyIsAMoneyUnitPlusAnAmount = Assert<Money extends MoneyUnit ? true : false>
```

**And one existing signature widens** — `model/reconciliation.ts:563`:

```ts
function sameUnit(a: MoneyUnit, b: MoneyUnit): MoneyRefusal | null {
```

The body at `:564-566` is unchanged. Every existing caller passes `Money` and still compiles.

### 2.2 C16 — the declared unit, and admission stops inferring one

**(a) `PopulationBinding` gains the declaration.** `model/reconciliation.ts`, immediately after
`readonly spec: PopulationSpec` at `:951`.

```ts
  /**
   * → `PopulationSpec.declaredUnit` under DP-2. Required, NON-NULL.
   *
   * 🛑 C16 — CURRENCY IS DECLARED, NEVER INFERRED, AND THIS FIELD IS THE WHOLE
   * RULING. `admitPopulation` used to seed the population's currency from
   * WHICHEVER ROW WAS ADMITTED FIRST (`:1122`, `:1132`, `:1144`) and check every
   * later row against that seed (`:1024`). A CSV cell carries no currency, so
   * whoever controls row one denominated the entire side — and nothing refused,
   * because the first row is compared against `null` and always agrees. The
   * poisoned row was not rejected; it became the definition.
   *
   * NULLABLE WOULD REINTRODUCE THE DEFECT WEARING A NULL. `null` here would read
   * as "not stated", and not-stated takes the permissive branch at the first
   * call site somebody writes in a hurry — §5.5, and §8.6's
   * `neverExport → exportable` inversion is this record's own precedent for a
   * null that fails OPEN. Required-and-non-null; an unstated unit is a REFUSAL
   * (`declared_unit_not_stated`), in the same gate as the other three bounds
   * this engine refuses to default.
   *
   * WHERE THE VALUE COMES FROM, and it is never this engine: source
   * configuration set by an FDE (G56/G59), or a column bound as a currency field
   * by a promoted mapping whose codec validated it against a closed ISO set
   * (C11). This module consumes a declaration; it does not resolve one.
   */
  readonly declaredUnit: MoneyUnit
```

**(b) The refusal arm.** `model/reconciliation.ts:854` — **replace** the single line
`| { kind: 'currency_disagrees_with_population' }` with:

```ts
  /**
   * C16. The row's money unit disagrees with the population's DECLARED unit —
   * currency or exponent, and `sameUnit()` (§3) is the only thing that decides
   * which. The name no longer says "population" because the population is no
   * longer the authority: a DECLARATION is, and a row that disagrees with it is
   * refused rather than allowed to redefine it.
   *
   * ⚠️ IT CATCHES A SECOND CASE THE OLD ARM COULD NOT SEE. The old check
   * compared `gross.currency` alone, so SGD-exponent-0 against SGD-exponent-2
   * was ADMITTED and then failed later, inside a pass, as a `MoneyRefusal` from
   * `addMoney` — a hundredfold unit error surfacing as a tolerance artefact
   * instead of an admission refusal. §5.7 exactly, and
   * `tests/scenarios/recon-corpus.ts:3558` records that no scenario mixed
   * exponents, so nothing would have caught it.
   */
  | { kind: 'money_unit_disagrees_with_declared'; refusal: MoneyRefusal }
```

`_AdmissionRefusalHoldsNoText` (`:856`) still holds: `MoneyRefusal` is already proven text-free
(`:284`).

**(c) `admitOne` stops taking a seed.** `model/reconciliation.ts:997-1005` — delete the
`expectedCurrency: string | null` parameter at `:1004`; and replace `:1024-1026` with:

```ts
  const gross = amountScalar.value
  const disagreement = sameUnit(gross, binding.declaredUnit)
  if (disagreement !== null) {
    return refuse(amountPath, { kind: 'money_unit_disagrees_with_declared', refusal: disagreement })
  }
```

**(d) `admitPopulation` stops carrying one.** `model/reconciliation.ts:1113-1151` — delete
`let currency: string | null = null` (`:1122`), the two seeding lines (`:1132`, `:1144`), and drop
the trailing `currency` argument from both `admitOne` calls (`:1128`, `:1140`). The docblock at
`:1103-1112` gains one sentence:

```
 * ⚠️ THIS FUNCTION NO LONGER INFERS A DENOMINATION. The unit is
 * `binding.declaredUnit` and every row is checked against it, including the
 * first — C16. There is no order-dependent state left in this fold, which is
 * what makes the admission result INDEPENDENT of row order rather than merely
 * deterministic in it.
```

**(e) The statedness gate.** `model/reconciliation.ts` — fold into the existing per-side loop at
`:2809-2815`, before the `validateNormalisation` call, so one loop checks both bindings:

```ts
    const unit = binding.declaredUnit
    if (unit.currency.length === 0 || !Number.isInteger(unit.exponent) || unit.exponent < 0) {
      return { ok: false, refusal: { kind: 'declared_unit_not_stated', side } }
    }
```

⚠️ **No upper bound on `exponent`, deliberately, and it is not an oversight.** This engine *"only
ADDS, SUBTRACTS and COMPARES … never multiplies, never divides and never rounds"* (`:550-552`), so
a large exponent has no arithmetic consequence here — and `sameUnit` refuses a mismatch, so it
cannot be mixed. A ceiling would be a number nobody in this repository is authoritative for
(`PRODUCT.md`), and it belongs to the codec that parses a wire currency under G111.

### 2.3 C17 — the duplicate becomes a named outcome, at both sites

**The two sites, quoted.**

```
model/reconciliation.ts:2834   const items = new Map<string, AdmittedItem>()
model/reconciliation.ts:2835   for (const item of [...left.admitted, ...right.admitted]) items.set(item.key, item)
```

```
model/reconciliation.ts:2702   for (const item of state.items.values()) {
model/reconciliation.ts:2703     admittedMinor += minorUnitsOf(item.gross)
```

`checkPostconditions` computes the admitted total by iterating **the same map that just ate the
row**, so `admittedMinor` and `accountedMinor` are both short by the same amount and
`gross_not_partitioned` (`:2646`) cannot fire. There is a **third** site with the identical fold,
in the fixtures: `admittedStateFor` at `tests/scenarios/recon-corpus.ts:3165-3175`.

**⚠️ FIRST, A SHARPENING THE ADJUDICATION'S C17 DOES NOT MAKE, AND THE DESIGN TURNS ON IT.**
`item.key` is `itemKey(side, ref)` = `side:len:sourceDocumentId:lineIndex` (`:809-813`). Two rows
collide **iff they share an address**, not iff they share a value. The corpus's duplicate-invoice
scenario (`tests/scenarios/recon-corpus.ts:1315-1320`) keys `INV-3050` twice at `line(0)` and
`line(1)` — two addresses, two keys, **no collision**, and it is correctly handled today as an
`AmbiguityFinding`. So the `Map.set` overwrite is reachable only three ways, and every one of them
is an ingestion defect:

1. the same `SourceDocument` appears **twice** in the documents array — a re-delivered file, which
   R5(ii)'s content-hash idempotency key exists to prevent;
2. two `ExtractedLine`s carry the **same `index`** — a shredder that minted `lineIndex` from
   insertion order rather than the parser's own row ordinal, which R5(ii) names as the mistake;
3. the same document id appears twice header-grain (`lines.length === 0`, `lineIndex: null`).

**Therefore the named outcome is a REFUSAL, not a finding.** Two rows at one address means the
caller's population is not a set. The engine cannot choose between them: they are the same row by
every identity it has, and *"nothing is ever dropped"* (`:764-771`) forbids picking one. This is the
one place where refusing beats residue, because there is no *row* to put in the residue — there are
two rows claiming to be one.

**(a) Detection where the address is known** — a defect arm of §2.5's `PopulationDefect`:

```ts
  /**
   * C17, and the reason it is a REFUSAL rather than a residue entry. Two
   * admitted or refused rows share one `itemKey` (`:809`) — the same
   * `(side, sourceDocumentId, lineIndex)`. The fold at `:2835` would silently
   * `Map.set` the second over the first, the row would VANISH, and
   * `checkPostconditions` would then compute the admitted total by iterating
   * that same map (`:2702-2703`) — so conservation would hold over a population
   * one row short and `gross_not_partitioned` could not fire.
   *
   * THE ENGINE CANNOT PICK ONE. They are the same row by every identity it has.
   * A duplicate ADDRESS is an ingestion defect — a re-delivered file, or a
   * `lineIndex` minted from insertion order rather than the parser's own row
   * ordinal (R5(ii)) — and it is fixed upstream, not disambiguated here.
   *
   * ⚠️ THIS IS NOT DUPLICATE-INVOICE DETECTION. The same invoice number at two
   * DIFFERENT addresses is a different finding and it already has a mechanism:
   * `passIdentifierJoin`'s multimap (`:1418`), an `AmbiguityFinding` (`:1379`)
   * and `identifier_ambiguous` on every named ref (`:2903-2907`), witnessed by
   * `duplicateIdentifierIsAnAmbiguity`. Conflating the two would be §5.1 — a
   * rule keyed on the word "duplicate" instead of on the property each protects.
   */
  | { kind: 'duplicate_item_address'; ref: ItemRef; occurrences: number }
```

**(b) The fold itself must not be able to swallow one.** `model/reconciliation.ts:2834-2835` becomes:

```ts
  const items = new Map<string, AdmittedItem>()
  for (const item of [...left.admitted, ...right.admitted]) {
    /* A NAMED NEGATIVE CONTROL, NOT A REVIEW CONVENTION — the same posture G99
     * demands of `withTenantScope()`. §2.5's integrity pass refuses this case
     * before the fold is reached, so this arm is UNREACHABLE TODAY and I am
     * saying so rather than implying coverage: its only witness is the mutation
     * in §5.2b. It stays because THIS is the line that loses the row, and a
     * `Map.set` that can silently eat money should not be one edit away from
     * doing it again. */
    if (items.has(item.key)) {
      return {
        ok: false,
        refusal: { kind: 'admitted_item_key_collision', side: item.side, ref: item.ref },
      }
    }
    items.set(item.key, item)
  }
```

### 2.4 C18 — control-total admission, and the null that must not fail open

**(a) The type.** `model/domain.ts`, immediately after `ExtractedLine` closes at `:1838` and before
`export interface SourceDocument` at `:1840`.

```ts
/**
 * WHAT A FILE SAID ABOUT ITSELF — its own trailer, admitted as a first-class
 * fact rather than shredded as a transaction.
 *
 * 🛑 C18, AND THE THREE ARMS EXIST BECAUSE A NULLABLE FIELD CANNOT SAY THIS.
 * The obvious shape is `expectedLineCount: number | null` plus
 * `declaredControlTotal: Money | null`, and its null is AMBIGUOUS in the one way
 * that matters: it cannot distinguish *"this format has no trailer"* from
 * *"the trailer should have been there and was not"*. The second is a truncated
 * or tampered file, and a null that reads as "unchecked" is scope failing OPEN —
 * the `neverExport → exportable` inversion (`docs/access-and-agency.md` §8.6) is
 * this record's own precedent for exactly that, and `docs/HANDOFF.md` §5.5
 * records this codebase already fixing the shape once.
 *
 * WHO SETS IT, AND IT IS NEVER THE ENGINE. The PARSER declares which arm
 * applies, in the pass that reads the file; the reconciliation engine only
 * refuses on it. That division is deliberate: deciding whether a `.csv` "should"
 * carry a trailer needs a per-format registry, and putting one inside the engine
 * would be a rule keyed on a filename instead of on what the parser actually
 * found (§5.1).
 *
 * AND IT IS WHAT CATCHES THE TRAILER SHREDDED AS A TRANSACTION. If the trailer
 * row is spent as a £1,234,567.89 phantom receipt, `lines.length` is one greater
 * than `lineCount` AND the summed amount is double the declared total — so the
 * two comparisons below detect it INDEPENDENTLY, which is why the line count is
 * not redundant with the total.
 */
export type ControlTotal =
  /**
   * The parser found a trailer. `lineCount` and `total` may each be null —
   * inside THIS arm a null means *"the trailer declared this one and not that
   * one"*, which cannot be read as "unchecked" because the arm itself is the
   * assertion that a trailer was found. A trailer declaring NEITHER is a
   * refusal (`control_total_declared_nothing`), not a silent pass.
   */
  | { kind: 'declared'; lineCount: number | null; total: Money | null }
  /** This format carries no trailer at all. An API payload, a bare CSV. */
  | { kind: 'not_declared_by_format' }
  /**
   * The parser EXPECTED a trailer for this format and did not find one. A
   * truncated file presents exactly like this, so it is a REFUSAL — never a
   * document admitted with an unchecked total.
   */
  | { kind: 'expected_but_absent' }
```

**(b) The field.** `model/domain.ts`, inside `SourceDocument`, immediately after
`lines: ExtractedLine[]` at `:1853`:

```ts
  /**
   * C18. What the file said about itself. Required and NON-OPTIONAL: the
   * `TS2741` at every construction site is the only evidence the field landed
   * (§5.10, and the same argument `ResidueEntry.settlement` makes at
   * `model/reconciliation.ts:2113-2114`).
   */
  controlTotal: ControlTotal
```

**(c) The defect arms** (in §2.5's union). Six, and each catches something the others cannot:

```ts
  /** The parser expected a trailer for this format and found none — truncation
   *  presents exactly like this. Fail closed. */
  | { kind: 'control_total_expected_but_absent'; sourceDocumentId: SourceDocumentId }
  /** A trailer that declared neither a count nor a total. Degenerate, and
   *  admitting it would make the `declared` arm meaningless. */
  | { kind: 'control_total_declared_nothing'; sourceDocumentId: SourceDocumentId }
  /** THE TRUNCATED-SHRED DETECTOR, and the trailer-as-transaction detector.
   *  Compared against rows PRESENTED (admitted + refused), never against rows
   *  admitted — a truncated file and an unreadable row are different defects and
   *  keying one check on both is §5.1. */
  | {
      kind: 'declared_line_count_disagrees'
      sourceDocumentId: SourceDocumentId
      declaredCount: number
      presentedCount: number
    }
  /** ⚠️ THE ARM THAT MAKES THE TOTAL CHECK HONEST. A refused row has no readable
   *  amount, so a sum over the admitted rows of a partially-refused document is
   *  not the file's total and comparing it would produce a WRONG verdict in
   *  either direction. The engine says it cannot verify, and refuses. Silently
   *  skipping the comparison here is the C13 defect at document grain. */
  | {
      kind: 'control_total_unverifiable_rows_refused'
      sourceDocumentId: SourceDocumentId
      presentedCount: number
      admittedCount: number
    }
  /** `sumGross`/`compareMoney` refused. The reachable case is a trailer
   *  denominated differently from the population's declared unit — a real
   *  finding, and one that must not be reported as a mismatch. */
  | { kind: 'control_total_not_evaluable'; sourceDocumentId: SourceDocumentId; refusal: MoneyRefusal }
  /** The file's own arithmetic disagrees with the file's own rows. Minor units,
   *  never a `Money`: `Money.currency` is a `string`, so `AssertNoTextDeep`
   *  forbids it — the same reason `MoneyRefusal` carries no currency (`:275`).
   *  `gross_not_partitioned` (`:2646`) is the precedent for a DIAGNOSTIC
   *  carrying minor units. */
  | {
      kind: 'declared_control_total_disagrees'
      sourceDocumentId: SourceDocumentId
      declaredMinor: number
      admittedMinor: number
    }
```

### 2.5 The one new checker, and the one new refusal arm it feeds

**File.** `model/reconciliation.ts`. **Insertion point.** A new `§4a` immediately after
`admitPopulation` closes at `:1151` and before the `§5` banner at `:1153`.

```ts
/* ==================================================================== *
 * §4a  POPULATION INTEGRITY — the three things a per-ROW check cannot see
 *
 * §4 asks of each row: can it be read? This section asks of the POPULATION:
 * is it the population? Those are different questions and no per-row refusal
 * answers the second one — which is why a run whose rows were individually
 * fine could be short, doubled, or 60% unread, and every post-condition in §9
 * would still pass. Every post-condition there is an INTERNAL-CONSISTENCY
 * check over the admitted set, and not one of them compares that set against
 * the source artefact.
 *
 * C17 — an ADDRESS admitted twice. The fold at §9 would eat one.
 * C18 — the file's own trailer, admitted as a fact rather than shredded.
 * C13 — a run whose rows mostly refused, returning a sound ledger over the rest.
 *
 * WHY A REFUSAL AND NOT A RESIDUE ENTRY, for the first two. The residue is the
 * product (§0) and a refused ROW belongs in it with its reason. But a doubled
 * address and a mismatched control total are not statements about a row — they
 * are statements that every allocation computed over this population was
 * computed over the WRONG SET. A residue built from the wrong set looks like a
 * complete picture of a truncated file, which is worse than no picture.
 *
 * WHY `population_wholly_refused` IS A POST-CONDITION AND NOT A REFUSAL, and
 * the asymmetry is deliberate. Refusing destroys the per-row reasons, and
 * `unclassifiedFieldFailsClosed` (`tests/scenarios/recon-corpus.ts:1946`) is
 * the corpus scenario whose entire point is that a G106 refusal LANDS IN THE
 * RESIDUE with its reason attached. A refusal there would delete the only
 * useful output of the run. See §9.
 * ==================================================================== */

export type PopulationDefect =
  /* C17 */
  | { kind: 'duplicate_item_address'; ref: ItemRef; occurrences: number }
  /* C18 — six arms, listed at §2.4(c) */
  | { kind: 'control_total_expected_but_absent'; sourceDocumentId: SourceDocumentId }
  | { kind: 'control_total_declared_nothing'; sourceDocumentId: SourceDocumentId }
  | {
      kind: 'declared_line_count_disagrees'
      sourceDocumentId: SourceDocumentId
      declaredCount: number
      presentedCount: number
    }
  | {
      kind: 'control_total_unverifiable_rows_refused'
      sourceDocumentId: SourceDocumentId
      presentedCount: number
      admittedCount: number
    }
  | { kind: 'control_total_not_evaluable'; sourceDocumentId: SourceDocumentId; refusal: MoneyRefusal }
  | {
      kind: 'declared_control_total_disagrees'
      sourceDocumentId: SourceDocumentId
      declaredMinor: number
      admittedMinor: number
    }
  /* C13 — the configurable half. The number is the owner's (O-8). */
  | {
      kind: 'admission_refusal_rate_above_ceiling'
      refusedCount: number
      presentedCount: number
      ceilingBasisPoints: number
    }

/**
 * 🟢 THE CONTAINMENT PROOF, ON A UNION THAT NAMES DOCUMENTS.
 *
 * VERIFY IT RED BEFORE TRUSTING IT GREEN, the way
 * `_ReaderVerdictHoldsNoTextDeep` (`:2246`) asks to be verified: add
 * `filename: string` to any arm and `tsc` reports TS2344. A branded
 * `SourceDocumentId` passes (`model/kernel.ts:43`, and the `T extends string ?
 * T` arm at `:250` exists precisely for it) while a raw filename cannot —
 * which is the distinction that matters, because a filename is
 * counterparty-controlled and these defects will be logged.
 */
export type _PopulationDefectHoldsNoTextDeep = AssertNoTextDeep<PopulationDefect>

/**
 * Everything §4a needs, named rather than positional. Six arguments in a row is
 * how `side` and `documents` get transposed by somebody in a hurry.
 */
export interface PopulationIntegrityInput {
  readonly side: PopulationSide
  readonly documents: readonly SourceDocument[]
  readonly admitted: readonly AdmittedItem[]
  readonly refused: readonly RefusedItem[]
  /** C13. Required, no default; 10000 bp is 100% by definition of the unit. */
  readonly admissionRefusalCeilingBasisPoints: number
}

/**
 * Every population-grain defect, in a fixed order. Pure, total, no clock, no
 * throw — the same contract as `checkPostconditions()` (§9), whose shape this
 * copies deliberately rather than inventing a second integrity idiom.
 *
 * ORDER IS PART OF THE CONTRACT: C17 first (an address collision makes every
 * later count wrong), then C18 per document in supplied order, then C13. A
 * fixture asserts the sequence, so a reordering is a failure and not a diff
 * nobody notices.
 */
export function checkPopulationIntegrity(
  input: PopulationIntegrityInput,
): readonly PopulationDefect[] {
  const defects: PopulationDefect[] = []

  /* --- C17: one address, one row. Admitted AND refused: a doubled address is
   * the same defect whichever way each copy went. --- */
  const occurrences = new Map<string, number>()
  const firstRef = new Map<string, ItemRef>()
  for (const ref of [
    ...input.admitted.map((item) => item.ref),
    ...input.refused.map((item) => item.ref),
  ]) {
    const key = itemKey(input.side, ref)
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1)
    if (!firstRef.has(key)) firstRef.set(key, ref)
  }
  for (const [key, count] of occurrences) {
    if (count <= 1) continue
    const ref = firstRef.get(key)
    if (ref === undefined) continue
    defects.push({ kind: 'duplicate_item_address', ref, occurrences: count })
  }

  /* --- C18: the file's own trailer. --- */
  const presentedByDocument = new Map<SourceDocumentId, number>()
  for (const document of input.documents) {
    const rows = document.lines.length === 0 ? 1 : document.lines.length
    presentedByDocument.set(document.id, (presentedByDocument.get(document.id) ?? 0) + rows)
  }
  const admittedByDocument = new Map<SourceDocumentId, AdmittedItem[]>()
  for (const item of input.admitted) {
    const bucket = admittedByDocument.get(item.ref.sourceDocumentId)
    if (bucket === undefined) admittedByDocument.set(item.ref.sourceDocumentId, [item])
    else bucket.push(item)
  }

  for (const document of input.documents) {
    const control = document.controlTotal
    if (control.kind === 'not_declared_by_format') continue
    if (control.kind === 'expected_but_absent') {
      defects.push({ kind: 'control_total_expected_but_absent', sourceDocumentId: document.id })
      continue
    }
    if (control.lineCount === null && control.total === null) {
      defects.push({ kind: 'control_total_declared_nothing', sourceDocumentId: document.id })
      continue
    }
    const presentedCount = presentedByDocument.get(document.id) ?? 0
    if (control.lineCount !== null && control.lineCount !== presentedCount) {
      defects.push({
        kind: 'declared_line_count_disagrees',
        sourceDocumentId: document.id,
        declaredCount: control.lineCount,
        presentedCount,
      })
    }
    if (control.total === null) continue
    const rows = admittedByDocument.get(document.id) ?? []
    if (rows.length !== presentedCount) {
      defects.push({
        kind: 'control_total_unverifiable_rows_refused',
        sourceDocumentId: document.id,
        presentedCount,
        admittedCount: rows.length,
      })
      continue
    }
    const summed = sumGross(rows)
    if (!summed.ok) {
      defects.push({
        kind: 'control_total_not_evaluable',
        sourceDocumentId: document.id,
        refusal: summed.refusal,
      })
      continue
    }
    const agreement = compareMoney(summed.value, control.total)
    if (!agreement.ok) {
      defects.push({
        kind: 'control_total_not_evaluable',
        sourceDocumentId: document.id,
        refusal: agreement.refusal,
      })
      continue
    }
    if (agreement.value !== 0) {
      defects.push({
        kind: 'declared_control_total_disagrees',
        sourceDocumentId: document.id,
        declaredMinor: minorUnitsOf(control.total),
        admittedMinor: minorUnitsOf(summed.value),
      })
    }
  }

  /* --- C13: the stated ceiling on the admission refusal rate.
   *
   * CROSS-MULTIPLIED, NEVER DIVIDED. `refused / presented` is a float and a
   * rounding decision; `refused × 10000 > ceiling × presented` is exact integer
   * arithmetic and this module never divides (`:550-552`). The product is
   * bounded by `IngestBound.maxRows × 10^4` — the bound lives upstream (C4),
   * which is why there is no guard for it here and why C4 is a dependency.
   *
   * `presentedCount === 0` does NOT refuse: there is no denominator, so there is
   * no rate. An EMPTY population is a real hazard and it is not this arm's — see
   * §6.3, stated rather than left as silence. --- */
  const presented = input.admitted.length + input.refused.length
  if (presented > 0) {
    const ceiling = input.admissionRefusalCeilingBasisPoints
    if (input.refused.length * 10_000 > ceiling * presented) {
      defects.push({
        kind: 'admission_refusal_rate_above_ceiling',
        refusedCount: input.refused.length,
        presentedCount: presented,
        ceilingBasisPoints: ceiling,
      })
    }
  }

  return defects
}
```

**The three new `SetReconciliationRefusal` arms.** `model/reconciliation.ts`, appended inside the
union at `:2636`, before `_SetReconciliationRefusalHoldsNoText` at `:2638`:

```ts
  /** C16. A population whose denomination was not stated. Same posture as the
   *  three bound arms above: an absent bound is a refusal, never a default. */
  | { kind: 'declared_unit_not_stated'; side: PopulationSide }
  /** C13. The ceiling itself is required. `PRODUCT.md` forbids inventing the
   *  number, and the record's precedent is refuse rather than default (O-8). */
  | { kind: 'admission_refusal_ceiling_not_stated' }
  /** C17 + C18 + C13. ONE arm carrying MANY named defects — the exact shape of
   *  `normalisation_invalid` above, chosen so a population reports every defect
   *  it has rather than the first, and so no second refusal vocabulary appears. */
  | { kind: 'population_integrity_refused'; side: PopulationSide; defects: readonly PopulationDefect[] }
  /** C17's second site. UNREACHABLE while the arm above runs first; its only
   *  witness is the mutation at §5.2b, and that is stated rather than implied. */
  | { kind: 'admitted_item_key_collision'; side: PopulationSide; ref: ItemRef }
```

**`SetReconciliationInput` gains the ceiling.** `model/reconciliation.ts`, after
`readonly similarityMetric: SimilarityMetric` at `:2626`:

```ts
  /**
   * C13 — THE ADMISSION FLOOR, AS A CEILING ON THE REFUSAL RATE. Required, no
   * default, integer basis points in [0, 10000].
   *
   * WHAT IT FIXES. `admitPopulation` accumulates per-row `RefusedItem`s and
   * CARRIES ON (`:1146-1150`), so a run in which most rows refused returns
   * `ok: true` with a ledger that is internally perfect over the minority that
   * parsed. Nothing in §9 can see it: every post-condition is a consistency
   * check over the admitted set.
   *
   * BASIS POINTS BECAUSE THIS MODULE ALREADY COUNTS IN THEM —
   * `levenshteinBasisPoints` (`:1665`) and `ReaderVerdict
   * .confidenceBasisPoints` (`:2228`). A second rate unit would be §5.3.
   *
   * 10000 IS NOT AN INVENTED THRESHOLD; it is 100%, by definition of the unit.
   * Contrast `SIMILARITY_MAX_CHARS_CEILING = 512` (`:2772`), which IS a stated
   * ceiling and says so. THE VALUE A RUN USES IS THE OWNER'S (O-8) and is
   * FDE-set configuration in a pack template — the `FieldSpec.confidenceFloor`
   * posture (G38, `model/domain.ts:1732-1764`), never a constant here.
   *
   * ⚠️ AND THE COST, STATED. A run refused on this ceiling produces NO residue,
   * so the diagnostic path is to re-run with the ceiling at 10000 and read the
   * refusals. That is acceptable ONLY because the ceiling is declared in
   * advance by the operator: it is their own instruction, not the engine
   * discarding a finding they wanted.
   */
  readonly admissionRefusalCeilingBasisPoints: number
```

**The gate.** `model/reconciliation.ts`, appended to the bounds block after `:2807`:

```ts
  if (
    !Number.isInteger(input.admissionRefusalCeilingBasisPoints) ||
    input.admissionRefusalCeilingBasisPoints < 0 ||
    input.admissionRefusalCeilingBasisPoints > 10_000
  ) {
    return { ok: false, refusal: { kind: 'admission_refusal_ceiling_not_stated' } }
  }
```

**The call.** `model/reconciliation.ts`, between the two `admitPopulation` calls (`:2831-2832`) and
the fold (`:2834`):

```ts
  for (const side of ['left', 'right'] as const) {
    const outcome = side === 'left' ? left : right
    const defects = checkPopulationIntegrity({
      side,
      documents: side === 'left' ? input.leftDocuments : input.rightDocuments,
      admitted: outcome.admitted,
      refused: outcome.refused,
      admissionRefusalCeilingBasisPoints: input.admissionRefusalCeilingBasisPoints,
    })
    if (defects.length > 0) {
      return { ok: false, refusal: { kind: 'population_integrity_refused', side, defects } }
    }
  }
```

### 2.6 `unique_within` — RULED UNBUILT, with a dated drop note

**The ruling: a drop note, not an evaluator.** Three independent sufficient reasons, and the first
is structural.

1. **The two scopes that carry the product claim are not evaluable in `model/`.** `period` and
   `tenant_lifetime` require reading rows **outside the run**, and this engine *"has no authority,
   no clock, no identity and no network"* (`model/reconciliation.ts:80-87`). An evaluator here
   could implement only `group` and `run`.
2. **So an evaluator would be §5.6 and §5.1 at once.** Shipping `group`/`run` and calling the
   predicate implemented is a control that passes while asserting nothing — keyed on the two scopes
   that happen to be computable rather than on the property it protects, which is *"the same invoice
   number from the same vendor, resubmitted months later"* (`model/domain.ts:363-366`).
3. **And the `run` case already has a mechanism, so a second one would be §5.3.**
   `passIdentifierJoin`'s multimap (`:1418-1431`), `arityPermits` (`:1433-1443`), an
   `AmbiguityFinding` (`:1379-1386`) and `identifier_ambiguous` on every named ref (`:2903-2907`) —
   witnessed end-to-end by `duplicateIdentifierIsAnAmbiguity`
   (`tests/scenarios/recon-corpus.ts:1329-1396`). The module's own pass-1 banner already says so:
   *"`RulePredicate.unique_within` already exists in the model because a duplicate invoice number is
   a REAL FINDING"* (`:1413-1415`).

**The declaration.** `model/domain.ts:362-367` — the existing docblock gains the marker; the arm
itself is unchanged.

```ts
  /**
   * `tenant_lifetime` is what duplicate-invoice detection actually needs: the
   * same invoice number from the same vendor, resubmitted months later, is not
   * detectable within a group or a run.
   *
   * @dropped-for-v1 <DATE OF COMMIT> — no evaluator, and the two scopes that
   * carry the claim CANNOT have one inside `model/`. `period` and
   * `tenant_lifetime` require reading rows outside the run, and the engine that
   * would read them has no clock, no identity and no network
   * (`model/reconciliation.ts:80-87`) — so an evaluator here could only ever
   * implement `group` and `run`, and calling THAT `unique_within` is a control
   * that passes while asserting nothing (§5.6), keyed on the scopes that happen
   * to be computable instead of on the property it protects (§5.1). The `run`
   * case is ALREADY a named outcome by another mechanism —
   * `passIdentifierJoin`'s multimap raises an `AmbiguityFinding` and every ref
   * in it lands in the residue as `identifier_ambiguous`
   * (`model/reconciliation.ts:1418`, `:2903-2907`), witnessed by
   * `duplicateIdentifierIsAnAmbiguity`
   * (`tests/scenarios/recon-corpus.ts:1329`) — so a second evaluator over the
   * same fact would be §5.3. Declared, not built.
   *
   * 🛑 WHAT V1 THEREFORE DOES NOT DO, said plainly: cross-run duplicate-invoice
   * detection. C17 refuses a duplicate ADDRESS; nothing detects the same invoice
   * VALUE resubmitted in a later run. That is a product decision and it needs an
   * owner (§7, O-9) — it is not closed by this marker.
   *
   * ⚠️ `docs/domain-model.md:755` says this arm *"gains `period` and
   * `tenant_lifetime`"* for duplicate-invoice detection. That sentence now
   * describes something v1 does not do; mark it, do not delete it.
   */
```

⚠️ **This moves a governed count.** `grep -rho '@dropped-for-v1' model/*.ts | wc -l` goes from 230
to 231 and `node tools/check-doc-counts.mjs` will report `CLAUDE.md`'s line STALE **in the same
commit**. Fix it there; do not leave the gate red.

---

## 3. What each declaration REFUSES, and what fails closed

### 3a. The ordered gate, as it will read at `HEAD`

```
runSetReconciliation
 1  readerCandidateCap            not an integer ≥ 1              → refusal   (exists, :2776)
 2  similarityMaxChars            outside [1, 512]                → refusal   (exists, :2793)
 3  subsetSumBound                any member not an integer ≥ 1   → refusal   (exists, :2801)
 4  admissionRefusalCeiling       outside [0, 10000]              → refusal   NEW  C13
 5  declaredUnit, per side        empty currency / bad exponent   → refusal   NEW  C16
 6  normalisation, per side       defects                         → refusal   (exists, :2811)
 7  tenant, per document          disagrees with the run          → refusal   (exists, :2818)
 8  strategy bindings             count or kind mismatch          → refusal   (exists, :2823)
 --- admission, per row: every refusal lands in the RESIDUE with its reason ---
 9  money unit vs declaredUnit    disagrees                       → row refused  NEW  C16
10  population integrity, side    duplicate address               → refusal   NEW  C17
                                  trailer expected/absent/empty   → refusal   NEW  C18
                                  line count disagrees            → refusal   NEW  C18
                                  total unverifiable / disagrees   → refusal   NEW  C18
                                  refusal rate above ceiling      → refusal   NEW  C13
11  the fold                      an itemKey admitted twice       → refusal   NEW  C17 (negative control)
 --- passes, residue, reader requests: unchanged ---
12  post-conditions               a population wholly refused     → UNSOUND   NEW  C13
```

### 3b. What fails closed, item by item

| Control | Fails closed how | The open failure it replaces |
|---|---|---|
| **C16 declared unit** | An unstated unit **refuses the run**; a row disagreeing **refuses the row into the residue**. There is no order-dependent state left in `admitPopulation`, so the admission result is **independent of row order**, not merely deterministic in it. | Today the first admitted row is compared against `null` (`:1024`) and *always agrees*, then becomes the definition (`:1132`, `:1144`). Control row one and you denominate the side. Nothing refuses. |
| **C16 exponent** | `sameUnit` refuses `exponent_mismatch` at admission. | Today a hundredfold unit error is admitted and surfaces later as a `MoneyRefusal` inside a pass — §5.7, over a case the corpus says it never tested (`:3558`). |
| **C17 duplicate address** | The population **refuses**, naming the `ItemRef` and the occurrence count. | Today the row silently vanishes at `:2835` and `checkPostconditions` computes the admitted total over the same map (`:2702-2703`), so conservation holds over a population one row short and `gross_not_partitioned` cannot fire. |
| **C17 the fold** | The fold **cannot** overwrite; it returns a refusal. Reachable only if the integrity gate is edited away. | Today `items.set(item.key, item)` is unconditional. |
| **C18 `expected_but_absent`** | **Refuses.** A truncated file presents exactly as a missing trailer. | The field does not exist; there is nothing to be absent. |
| **C18 the third arm** | `null` can only appear **inside** `declared`, where the arm itself asserts a trailer was found. "The file declared none" is `not_declared_by_format`; "it should have and did not" is `expected_but_absent`. **No null means "unchecked".** | The obvious `number \| null` shape, which is §8.6's inversion — a null that fails open. |
| **C18 partial refusal** | `control_total_unverifiable_rows_refused` **refuses** rather than comparing a sum that is missing rows. | A silent skip, which would be C13's defect at document grain. |
| **C18 trailer as a transaction** | Detected **twice, independently**: `lines.length` is one too many *and* the sum is double. | Nothing. The single most valuable line in the file is spent as a phantom receipt. |
| **C13 ceiling** | Required; **refuses on absence**; the rate check is exact integer arithmetic. | `ok: true` with a sound ledger over the minority that parsed. |
| **C13 wholly refused** | A **post-condition**, so the run is marked UNSOUND *and* every per-row reason survives in the residue. No configuration, so it needs no owner ruling and cannot be tuned off. | Nothing at all. |

**One thing that deliberately does NOT fail closed, and it is a decision.** `population_wholly_refused`
does not refuse the run. Refusing would destroy the residue, and
`unclassifiedFieldFailsClosed` (`tests/scenarios/recon-corpus.ts:1946-1990`) is the corpus scenario
whose whole point is that a G106 refusal *lands in the residue with its reason attached*. The
rejected alternative is recorded rather than dropped: a third result channel
(`SetReconciliationResult.populationFindings`) was considered and refused, because a channel with no
caller obligation is C13 one layer up — whereas `postconditions` already carries the stated
obligation *"Non-empty means the run produced an unsound ledger. Do not persist it."* (`:2661`).
**That sentence must widen in the same commit** to *"…either the ledger is unsound or the population
it was computed over is not the population"*, or the new arm is filed under a claim it does not
make.

---

## 4. The fixtures that witness it, and why `tsc` alone tells nobody anything

§5.10 is the reason this section exists: **`model/reconciliation.ts` is types-first and
`model/` constructs almost nothing**, so every declaration in §2 compiles green whatever its content.
Concretely, for these four controls `tsc` cannot see:

- that `declaredUnit` is *read* — a field nobody reads compiles;
- that `sameUnit(gross, declaredUnit)` compares the right two things — arguments of the right type
  compile whichever way round they go;
- that the C18 line count is compared against **presented** rather than **admitted** — both are
  `number`;
- that the fold's guard fires — an unreachable `if` compiles;
- that `population_wholly_refused` is pushed **after** `gross_not_partitioned` — order is not a type.

**Two mechanisms already in the tree make the fixture obligation mechanical rather than moral**, and
both must be honoured in the same commit as the declaration:

1. `tests/scenarios/export-surface.test.ts:15-27` — the export list is parsed **from the module on
   disk** and compared in **both directions**. `checkPopulationIntegrity` cannot land without a call
   site.
2. `tests/model/reconciliation-controls.test.ts:230-333` — nine source-text controls over the
   comment-stripped code. The one my design touches is `money-sentinel` (`:308-326`): no line after
   `_MoneySectionEndsHere` (`model/reconciliation.ts:762`) may contain the literal `amountMinor`. My
   §4a reads money **only** through `sumGross`, `compareMoney` and `minorUnitsOf`, so the control
   stays green — and `declaredMinor`/`admittedMinor` are field names that do not contain the banned
   literal, exactly as `gross_not_partitioned` already does at `:2646`.

### 4.1 Mechanical fixture updates (no new assertions, but nothing compiles without them)

| Where | Change | Count |
|---|---|---|
| `tests/scenarios/recon-corpus.ts:250-274` (`doc()`) | one `controlTotal: { kind: 'not_declared_by_format' }` — truthful: these synthetic files carry no trailer | 1 site → 22 scenarios |
| `tests/scenarios/recon-corpus.ts:312-348` (`ledgerBinding`, `bankBinding`) | `declaredUnit: { currency: 'SGD', exponent: 2 }`, overridable per scenario | 2 sites |
| `tests/scenarios/recon-corpus.ts:389-408` (`runInput`) | `admissionRefusalCeilingBasisPoints: spec.ceilingBasisPoints ?? CORPUS_ADMISSION_REFUSAL_CEILING_BASIS_POINTS`, plus the `RunSpec` field at `:370-387` | 2 sites |
| `tests/model/reconciliation-conservation.test.ts:145` (`documentOf`) · `tests/model/learned-dispositions.test.ts:151` (`documentOf`) · `tests/model/reconciliation-passes.test.ts:120` (`doc`) | `controlTotal` on each — *grep-verified builders* | 3 sites |

**`CORPUS_ADMISSION_REFUSAL_CEILING_BASIS_POINTS = 10_000`**, declared beside
`CORPUS_READER_CANDIDATE_CAP` (`:169-183`) and **carrying that block's disclaimer verbatim**: these
are *"fixture choices sized to make the scenarios legible; they are not a recommendation and no
document may cite them as one."* 10000 is not a default hiding in the corpus — it is the corpus
**declaring** that these twelve topologies exist to exercise refusal paths and do not police rates.
Two of the new scenarios state a tighter ceiling explicitly, which is what witnesses the control.

### 4.2 New scenarios (`Scenario`, so all ten `it`s at `engine-behaviour.test.ts:306-386` run over each)

| # | Name | What it witnesses | Expectation |
|---|---|---|---|
| F1 | `declaredUnitSurvivesRowOrder` | **C16's whole point.** `twoCurrenciesNeverMatchAcross` (`:1645`) with `s11Ledger`'s two lines **swapped** so the USD row is index 0, and `declaredUnit` SGD on both sides. | Identical to F2 below in every dimension. Under HEAD's seeding the SGD rows would be refused and the USD pair would match — *the file would have chosen the denomination.* |
| F2 | `twoCurrenciesNeverMatchAcross` **rewritten** | The same scenario, unswapped. | Allocations and residue as today; `refusal` becomes `{ kind: 'money_unit_disagrees_with_declared', refusal: { kind: 'currency_mismatch' } }` at `:1685`, `:1690`, `:1697`, `:1704`; the `summary` at `:1664` and `derivedFrom[0]` at `:1666` are **rewritten**, because both currently state the seeding rule as the specification. |
| F3 | `mixedExponentIsRefusedAtAdmission` | Closes `KNOWN_GAPS`'s stated gap (`:3558`). One SGD-exponent-0 row against a declared exponent 2. | Refused with `{ refusal: { kind: 'exponent_mismatch' } }`; residue `error_left`. Under HEAD it is **admitted**. |
| F4 | `unstatedDeclaredUnitRefusesTheRun` | A `RefusalScenario` (`:2250-2258`), `declaredUnit.currency: ''`. | `{ kind: 'declared_unit_not_stated', side: 'left' }` |
| F5 | `duplicateLineIndexRefusesThePopulation` | **C17.** One document with `line(0, …)` twice — the shredder minting `lineIndex` from insertion order. | `population_integrity_refused` with one `duplicate_item_address { ref: {…, lineIndex: 0}, occurrences: 2 }`. |
| F6 | `redeliveredDocumentRefusesThePopulation` | **C17's other arm.** The same `SourceDocument` listed **twice** in `leftDocuments` — a re-delivered file. | Same defect, `lineIndex: null` on the header-grain ref. |
| F7 | `truncatedShredIsCaughtByTheTrailer` | **C18's headline.** `lineCount: 3`, two lines present. | `declared_line_count_disagrees { declaredCount: 3, presentedCount: 2 }` |
| F8 | `trailerShreddedAsATransactionIsCaughtTwice` | The bug C18 exists for. A trailer row shredded as line 2, `lineCount: 2`, `total` = the two real rows. | **Two** defects in order: `declared_line_count_disagrees` then `declared_control_total_disagrees`. The two-defect array is the witness that the arm carries *many* defects. |
| F9 | `controlTotalDisagreesRefusesTheRun` | The arithmetic check alone. | `declared_control_total_disagrees { declaredMinor, admittedMinor }` |
| F10 | `missingTrailerOnAFormatThatCarriesOneRefuses` | The null that must not fail open. `{ kind: 'expected_but_absent' }`. | `control_total_expected_but_absent` |
| F11 | `controlTotalUnverifiableWhenARowRefused` | The honest-comparison arm. `lineCount: 2`, `total` stated, one row unclassified (G106). | `control_total_unverifiable_rows_refused { presentedCount: 2, admittedCount: 1 }` — **and NOT** `declared_control_total_disagrees`, which is the assertion that matters. |
| F12 | `trailerInAnotherCurrencyIsNotAMismatch` | `control_total_not_evaluable`. Trailer total in USD, population declared SGD. | `{ kind: 'control_total_not_evaluable', refusal: { kind: 'currency_mismatch' } }` — a named refusal, never a wrong verdict. |
| F13 | `refusalRateAboveTheStatedCeilingRefuses` | **C13's configurable half.** Four rows, two unclassified, `ceilingBasisPoints: 2500`. | `admission_refusal_rate_above_ceiling { refusedCount: 2, presentedCount: 4, ceilingBasisPoints: 2500 }` |
| F14 | `refusalRateAtTheCeilingIsAdmitted` | The boundary, so the comparison is `>` and not `>=`. Same fixture, ceiling `5000`. | No defect. Run proceeds. |
| F15 | `unclassifiedFieldFailsClosed` **amended** (`:1946`) | **C13's non-configurable floor.** The whole right population is refused (its own summary at `:1966` says so). | `postconditions` changes from `SOUND` to `[{ kind: 'population_wholly_refused', side: 'right', presentedCount: 1 }]`. ⚠️ **This is an expectation change on a hand-derived scenario.** The corpus header forbids "fixing" an expectation by running the engine (`:10-22`); this one is derived from the new rule and its `derivedFrom` must cite it, or the change is indistinguishable from the thing the header bans. |
| F16 | `wholeRunRefusedStillProducesTheResidue` | The reason F15 is a post-condition and not a refusal. | `ok: true`, non-empty residue, every reason present, `postconditions` non-empty. **This is the scenario that would go red if somebody "hardened" C13 into a refusal.** |

### 4.3 Direct-call vectors (`export-surface.test.ts`, which mechanically requires them)

- `checkPopulationIntegrity` invoked under `used('checkPopulationIntegrity', …)` — **required**, or
  the both-directions comparison fails.
- The defect **order** contract: one input carrying an address collision, a bad line count and a
  breached rate, asserting the returned array's sequence.
- `presentedCount === 0` returns `[]` — the no-denominator case, asserted rather than assumed.
- The refusal-kind table at `:666` gains `money_unit_disagrees_with_declared`, and the assertion at
  `tests/scenarios/engine-behaviour.test.ts:800` (*grep-verified*) changes with it.
- **A totality list for `PopulationDefect`**, in the shape of `EXTRACTION_OP_KINDS_COVERED`
  (`tests/scenarios/recon-corpus.ts:3489-3503`). Its docblock already asks for exactly this and
  names `AdmissionRefusal` and `ResidueCause` as owing it: without a list, an eighth defect arm is a
  silent gap. Add `PopulationDefect` to the list and remove it from `KNOWN_GAPS`'s "silent gap"
  sentence (`:3556`).
- **A compile-time RED check, run by hand and recorded in the commit message**, for
  `_PopulationDefectHoldsNoTextDeep`: add `filename: string` to any arm, confirm `TS2344`, remove
  it. `_ReaderVerdictHoldsNoTextDeep` (`:2236-2246`) asks to be verified this way and
  `KNOWN_GAPS` (`:3554`) records that no value in the corpus can reach these proofs.

---

## 5. The mutations that prove each control bites

Every mutation is a **one-line edit to `model/`**, and each names the expected failure. Counts are
**estimates derived from the fixture arithmetic** — 22 scenarios × 10 `it`s
(`tests/scenarios/engine-behaviour.test.ts:306-386`), 30 tests in `export-surface.test.ts`
(`grep -c '^test(' → 30`) — not from a run. I did not execute the suite; anyone applying this should
record the real numbers.

### 5.1 C16 — currency is declared, never inferred

**(a) Restore the inference.** In `admitOne`, replace
`sameUnit(gross, binding.declaredUnit)` with `expectedCurrency === null ? null : …` and reinstate the
seed at `:1132`/`:1144`.
**Expected red:** `declaredUnitSurvivesRowOrder` (F1) fails on **allocations**,
**refusedAtAdmission** and **residue** — the swapped fixture now denominates in USD and the *other*
pair matches. `mixedExponentIsRefusedAtAdmission` (F3) fails on **refusedAtAdmission** and
**residue**. ≈ **8 `it`s**, and F1 versus F2 is the pair that makes the defect legible: same file,
two row orders, two different answers.

**(b) Compare currency only.** Change `sameUnit(gross, binding.declaredUnit)` to
`gross.currency === binding.declaredUnit.currency ? null : { kind: 'currency_mismatch' }`.
**Expected red:** F3 only, on 2 `it`s. **This is the mutation that shows why `sameUnit` and not a
hand-rolled comparison** — the hand-rolled one is what `model/access.ts` already does in three
places, which `model/reconciliation.ts:554-560` names as a live §5.3 risk.

**(c) Make the unit nullable.** Change `declaredUnit: MoneyUnit` to `MoneyUnit | null` and skip the
check when null.
**Expected red:** `unstatedDeclaredUnitRefusesTheRun` (F4). ≈ **1**. Small, and the point of it is
the §5.5 shape: the type change is what makes the defect possible again.

### 5.2 C17 — the duplicate becomes a named outcome

**(a) Delete the `duplicate_item_address` block** from `checkPopulationIntegrity`.
**Expected red:** F5 and F6 on **refusal identity** — and this is the mutation that must be watched
most carefully, because with the fold guard still present they go red with the *wrong* refusal
(`admitted_item_key_collision`), not with a pass. ≈ **2-4**.

**(b) Delete BOTH — the block and the fold guard.** Restore
`for (…) items.set(item.key, item)`.
**Expected red:** F5 and F6 flip to `ok: true` and fail on **allocations**, **residue** and
**post-conditions** — and **`gross_not_partitioned` stays silent**, which is the finding. ≈ **6-8**.
**This is the single most important mutation in the plan**: it is the only one that demonstrates the
defect the adjudication found, and it demonstrates it by showing a *green* conservation check over a
population one row short.

**(c) Detect only among admitted rows** (drop `input.refused` from the collision walk).
**Expected red:** a variant of F5 in which the doubled address refuses at admission on both copies
goes green. ≈ **1**, and it needs its own fixture — worth adding, because a doubled address whose
copies both refuse still doubles the residue.

### 5.3 C18 — control-total admission

**(a) Compare the line count against ADMITTED instead of PRESENTED.**
**Expected red:** F7 stays green (nothing refused there) and **F11 breaks the right way**: it now
reports `declared_line_count_disagrees` instead of `control_total_unverifiable_rows_refused`. ≈
**2**. This mutation is the one that distinguishes *truncation* from *unreadability* — §5.1 in one
line.

**(b) Skip the total comparison when a row refused** — replace the
`control_total_unverifiable_rows_refused` push with `continue`.
**Expected red:** F11 goes `ok: true` with an unverified total. ≈ **3-4**.

**(c) Treat `expected_but_absent` as `not_declared_by_format`** — one `continue`.
**Expected red:** F10 goes `ok: true`. ≈ **3-4**. This is the §8.6 fail-open shape restored, and it
is a single character's worth of edit — which is the argument for the three-arm union.

**(d) Collapse the union to `lineCount: number | null; total: Money | null`.**
**Expected red:** F10 becomes **inexpressible** — the fixture cannot be written, so the suite fails
to **compile**. A control you cannot write the counter-example for is the strongest form.

**(e) Drop the line-count check, keep the total.**
**Expected red:** F7 (truncated shred whose remaining rows have no declared total) goes green; F8
reports one defect instead of two. ≈ **3**. Witnesses that the two comparisons are independent.

### 5.4 C13 — the admission floor

**(a) Default the ceiling** — `input.admissionRefusalCeilingBasisPoints ?? 10_000`.
**Expected red:** F4-shaped refusal scenario for the unstated ceiling goes green. ≈ **1-2**. The
defect is exactly the one the three existing bound arms exist to prevent (`:2775`).

**(b) Use `>=` instead of `>`.**
**Expected red:** `refusalRateAtTheCeilingIsAdmitted` (F14) refuses. ≈ **1**. An off-by-one on a
threshold that decides whether a close runs.

**(c) Divide instead of cross-multiplying** —
`input.refused.length / presented > ceiling / 10_000`.
**Expected red:** a fixture at 1/3 refused against a ceiling of 3333 bp. This mutation may well stay
**green**, and I am saying so: it is a *robustness* argument, not a witnessed one. The reason to
cross-multiply is that this module never divides (`:550-552`), not that I can prove a failing case
at these fixture sizes.

**(d) Delete `population_wholly_refused`.**
**Expected red:** F15 (`unclassifiedFieldFailsClosed`, amended) fails on **post-conditions**. ≈
**1**.

**(e) Promote `population_wholly_refused` to a refusal.**
**Expected red:** F16 fails — no residue is produced. ≈ **3-4**. **This mutation exists to protect a
decision**, not a mechanism: it is what stops the next reader "hardening" C13 into something that
deletes the product.

---

## 6. What I did NOT solve, and what it is blocked on

**6.1 The trailer is not verified against the artefact.** C18 checks a document against *what the
parser said the file declared*. A parser that fabricates `{ kind: 'not_declared_by_format' }` defeats
the whole control, and nothing in `model/` can see the bytes. **Blocked on:** the ingestion module
(C5's `NativeTextOutcome`, C9's `ObservedSchema`) and on the shred-in-one-transaction work — R5(vi),
build row 8. The honest statement: **C18 makes the trailer *load-bearing*; it does not make the
parser trustworthy.**

**6.2 Correction is still undesigned** — §8 item 3 of the adjudication. `population_integrity_refused`
tells you a population is wrong; nothing re-parses. `RunTrigger.rerun` re-runs the **engine** over
already-extracted documents. Not mine, not solved, and C8's `mappingVersionId` is what makes the
blast radius enumerable.

**6.3 An EMPTY population is invisible.** `presentedCount === 0` produces no rate, no control-total
check (no documents to check) and no `population_wholly_refused`. A side that arrived as zero
documents reconciles against nothing and every row on the other side lands in the residue as
`no_strategy_paired` — *"nothing matched it"* — which is untrue. This is the same shape as the
fuzzy-tie defect the corpus caught on 9 Aug. **Not solved here and stated rather than left silent:**
an empty side needs either a `population_empty` post-condition or a declared expected-row-count at
population grain, and the second is really C18 at the *run* level rather than the *document* level.
**Blocked on:** an owner ruling (O-10 below).

**6.4 Money.** My design touches money in exactly three places and each is a call into §3 — `sameUnit`,
`sumGross`, `compareMoney` — plus one read through `minorUnitsOf`. **What it needs from G111's codec
and does not have:** the codec is what will parse a trailer's total *off the wire* into a `Money`,
and today nothing does. `Money.amountMinor` is `number` (`model/domain.ts:535`), so a trailer total
above 2^53 minor units cannot be represented; `sumGross` refuses with
`exceeds_exact_integer_range` (`:571`) and my `control_total_not_evaluable` carries that refusal
outward. **That is the honest behaviour and it is not a fix.** Concretely, the codec owes me one
function — *decimal string → `MoneyResult<Money>`, refusing rather than truncating* — and until it
exists the trailer total must be constructed by the caller with no shared parser, which is §5.7 with
a scheduled end date. I did **not** approximate money anywhere: there is no new `Money` literal, no
new arithmetic, and no new read of `amountMinor`.

**6.5 The `guardMoney` gap at admission.** A fractional `amountMinor` is admitted today and only
refused later, inside `applyAllocation` (witnessed by the allocation probe at
`tests/scenarios/recon-corpus.ts:3141-3148`). Adding `guardMoney(gross)` to `admitOne` is three
lines and is a real hardening — **and it is not C16.** Deliberately deferred and named here so
nobody records it as missed.

**6.6 `unique_within` is ruled unbuilt, which removes a product capability.** Cross-run
duplicate-invoice detection is not in v1 under this plan (§2.6). The mechanism is a query over prior
runs, so it belongs to whatever owns the database, not to `model/`. **Blocked on:** O-9 below.

**6.7 I did not touch `admitPopulation`'s return type.** A union return would have been the §5.2
purist's answer, and I refused it: it would break `admittedStateFor`
(`tests/scenarios/recon-corpus.ts:3165`) and `engine-behaviour.test.ts`'s direct admission test
(`export-surface.test.ts:633-668`) for no property gain, since the population-grain checks are
better as a *separately callable pure function* — which is what makes F5-F14 unit-testable at all.
Recorded as a choice, not an oversight.

**6.8 The document array's order is still unspecified** — A2. My design makes the *admission result*
order-independent (C16 removes the only order-dependent state in the fold), but the **residue order**
and the **allocation sequence** still follow `documents` as supplied (`:1103-1112`). A2 is not
closed by this plan and remains the caller's.

---

## 7. What this depends on — G rulings, invariants, and the owner rulings it needs first

### 7.1 Invariants and G rulings the design stands on (copied, never paraphrased)

| Depends on | Where it bites |
|---|---|
| **Invariant 4** — *"Classification is declared once, on `FieldSpec`, and everything derives from it."* | The posture C16 copies: a property is **declared** in one place and derived everywhere. C16 is invariant 4's shape applied to denomination. |
| **G106** — a key with no `FieldSpec` is UNREADABLE, fail-closed | Already executable at `model/reconciliation.ts:1011` + four call sites (`:1015`, `:1030`, `:1044`, `:1062`). F11 and F15 both use it as the *cause* of a refused row, so C18 and C13 are built on top of a control that already runs. |
| **Invariant 5** — *"Money is always derived."* | Nothing in §2 names a price, a rate card or a cost. The `no-pricing-vocabulary` and `no-cost-field` controls (`tests/model/reconciliation-controls.test.ts:267-278`) stay green. |
| **G111** — one money codec owns the representation | §6.4. My design routes every money touch through §3 so the codec presents **one** surface, as `:583-595` intends. |
| **G65 / G78 / G112** — the `bigint` retype, **not applied** | §6.4. `minorUnitsOf` is the declared breaking point and my defect fields ride on it. |
| **G38** — the `confidenceFloor` posture: FDE-set, in a pack template, rendered read-only, **no `editableByTenant` flag** | Where C13's ceiling lives (`model/domain.ts:1732-1764`). |
| **G99 / G100 / G101** | Why C17 is worth having at all: the shred and the `SourceDocument` insert are one transaction, so a *partial* shred cannot happen — but a **re-delivered** file still can, and that is the arm C17 catches. |
| **G105 / G114** | The evidence-recording posture C18 copies: a bound that was hit is **recorded** (`exhaustedBuckets`, `:2658`), never silently absorbed. |
| **G118** | Nothing here claims an LLM path. `checkPopulationIntegrity` is pure and calls nothing. |
| **G123 / G129** | §10's rule that a pre-engine filter is invisible to the conservation proof (`:2981-2990`). My checks run **inside** `runSetReconciliation`, after admission, for exactly that reason — a pre-engine control-total filter would be the same defect one layer up. |
| **§5.1, §5.2, §5.3, §5.5, §5.6, §5.7, §5.10, §5.11** (`docs/HANDOFF.md:1494`, `:1513`, `:1532`, `:1613`, `:1634`, `:1651`, `:1689`, `:1753`) | Cited at the point of use throughout §2. |

### 7.2 Adjudication rulings this implements, and the one place I deviate

R5(ii) (three idempotency keys), R5(v) (a duplicate is a named outcome; `unique_within` gets an
evaluator or a drop note), C13, C16, C17, C18 — implemented as written, except:

🛑 **I reverse the within-step order of build row 3.** `docs/build/ingestion-pipeline.md:426` lists
*"C18 + C17 + C16"*. **C16 must land first**, because C18's total comparison sums a document's
admitted gross and `sumGross` folds `addMoney`, which refuses across units (`:614-625`). Under
HEAD's seeding the population's unit is *whatever row one said*, so a control total compared against
that sum is compared against a quantity the file chose the denomination of. **C16 is a precondition
for C18 being meaningful, not merely tidier.** Order: **C16 → C17 → C18 → C13**.

🛑 **Two refinements of C18, with the reason.** (a) One arm becomes **two** —
`declared_line_count_disagrees` and `declared_control_total_disagrees` — because a truncated file
and a wrong sum are different defects and collapsing them makes the refusal unactionable, which is
the argument `ExtractionInSetOutcome` already makes for keeping `extraction_refused` distinct from
`not_in_set` (`model/domain.ts:399-406`). (b) The nullable pair becomes a **three-arm union**,
because a nullable field cannot distinguish "no trailer" from "trailer missing" — which is the
requirement C18 itself states.

🛑 **C13's floor splits in two.** The configurable rate ceiling is a **refusal**; a wholly-refused
population is a **post-condition**. §3b and §5.4(e) carry the argument. `mapping_conformance_below_floor`
— the *other* C13 arm — is the ingestion team's and belongs on the same union; **the two must not be
collapsed**, because one says "the mapping did not fit the held-out sample" and the other says "this
run's rows did not parse".

### 7.3 Owner rulings needed BEFORE this can be built

| Ruling | Status | What it blocks |
|---|---|---|
| **O-8** — *"Every `IngestBound` number, every C6 threshold, every C13 floor"*, recommended as FDE-set pack configuration | **REQUIRED, blocking a value but not the code** | `admissionRefusalCeilingBasisPoints`. The engine refuses on absence, so the **code** ships without O-8; **no run can execute** until a number is stated. The corpus states 10000 with the standing disclaimer and that is not an answer to O-8. |
| **O-5** — the grain a mapping is pinned to, `(sourceEndpointId, headerSetHash)` | **Non-blocking, but read it** | If a single `sourceEndpointId` receives files of two schemas, then two documents in one population may legitimately carry different trailers. My design is per-document and survives that; a population-grain control total would not. |
| **O-3** — no document-level `DataClass` exists | **Non-blocking** | Named because F11 and F15 use a G106 refusal as their cause, and O-3 is the same missing-derivation shape one layer over. |
| **O-9 — NEW.** *May v1 ship without cross-run duplicate-invoice detection?* | **REQUIRED before §2.6 lands** | The `@dropped-for-v1` marker on `unique_within`. §2.6 argues the engine cannot host the evaluator; whether the **product** ships without the capability is not mine. `docs/domain-model.md:755` currently says it does ship. Recommended: **yes for v1**, with the detection ruled as a query owned by whatever owns the database, and the sentence at `:755` marked rather than deleted. Cost: a resubmitted invoice from a prior period is not flagged, and the C17 refusal does **not** cover it. |
| **O-10 — NEW.** *Is an EMPTY population a defect?* | **REQUIRED before §6.3 closes; NOT blocking C16/C17/C18/C13** | §6.3. Recommended: a `population_empty` post-condition, on the same argument as `population_wholly_refused` — the residue must survive. Cost: a legitimately empty side (no bank activity in the period) reports UNSOUND, which is arguably correct and arguably noisy, and I cannot settle which without a real close. |
| **O-11 — NEW.** *May a `PostconditionFailure` mean "the population is incomplete" as well as "the ledger is unsound"?* | **REQUIRED before C13 lands** | Adding `population_wholly_refused` widens what `SetReconciliationResult.postconditions` (`:2661`) claims. Recommended: **yes, and the sentence widens with it in the same commit.** The alternative — a third result channel — is refused in §3b because a channel with no caller obligation is C13 one layer up. Cost: one channel now carries two properties, which is §5.3-adjacent and must be argued in the docblock rather than done quietly. |

### 7.4 The commit sequence

| # | Commit | Files | Verify |
|---|---|---|---|
| 0 | **No cleanup commit is owed, and here is why rather than silence.** Rule 1 asks for a dead-code pass before a structural refactor >300 LOC. `noUnusedLocals`/`noUnusedParameters` are on, so unused locals cannot exist; unused **exports** do exist and are deliberate — `export-surface.test.ts` names every one and `docs/HANDOFF.md:164` states the coverage honestly. | — | — |
| 1 | **C16.** `MoneyUnit`, `sameUnit` widened, `PopulationBinding.declaredUnit`, the renamed `AdmissionRefusal` arm, `admitOne`/`admitPopulation`, the statedness gate. Fixtures F1-F4. | `model/reconciliation.ts`, `tests/scenarios/recon-corpus.ts`, `tests/scenarios/export-surface.test.ts`, `tests/scenarios/engine-behaviour.test.ts` — **4** | `npm run check`; mutations 5.1(a)-(c) |
| 2 | **C17** + the `unique_within` drop note + the `CLAUDE.md` dropped-marker count. `PopulationDefect` is introduced here with its first arm and its containment proof; `checkPopulationIntegrity` and the fold guard. Fixtures F5, F6. | `model/reconciliation.ts`, `model/domain.ts`, `tests/scenarios/recon-corpus.ts`, `tests/scenarios/export-surface.test.ts`, `CLAUDE.md` — **5** | `npm run check`; **mutation 5.2(b) is the one to run and record** |
| 3a | **C18, the type only** — `ControlTotal`, `SourceDocument.controlTotal`, and the four fixture builders. Mechanical, no behaviour. | `model/domain.ts` + 4 test builders — **5** | `npm run check` — and say out loud that a green run here proves **nothing** (§5.10) |
| 3b | **C18, the checks** — six defect arms, the per-document pass. Fixtures F7-F12. | `model/reconciliation.ts`, `tests/scenarios/recon-corpus.ts`, `tests/scenarios/export-surface.test.ts` — **3** | mutations 5.3(a)-(e) |
| 4 | **C13.** The input field, the gate, the rate defect, `population_wholly_refused`, the widened `postconditions` sentence. Fixtures F13, F14, F15, F16. | `model/reconciliation.ts`, `tests/scenarios/recon-corpus.ts`, `tests/scenarios/engine-behaviour.test.ts` — **3** | mutations 5.4(a)-(e) |
| 5 | **The record.** G rows for C16/C17/C18/C13 (**next free number is G132** — `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md` → 131), `docs/build/ingestion-pipeline.md` build row 3 ticked, `docs/domain-model.md:755` marked, the DP-2 fourth field written into `docs/build/reconciliation-engine.md:647`, `node tools/check-doc-counts.mjs` green. | docs only | `npm run check` |

---

## 8. Corrections found at the tree while designing (not applied — analysis only)

| Claim | Where | Reality |
|---|---|---|
| *"Money is bigint in the model"* | the brief for this task | **False at HEAD.** `Money.amountMinor` is `number` (`model/domain.ts:535`); `model/reconciliation.ts:541-542` says so itself. G65/G78/G111/G112 are all **not applied** (`docs/HANDOFF.md:719`, `:804`, `:837`, `:838`). |
| `PopulationSpec` *"opens `:1931`"*, `identifiers` at `:1937` | `model/reconciliation.ts:935`; `docs/build/reconciliation-engine.md:648-649` | The interface opens at **`model/domain.ts:2065`** and `identifiers` is at **`:2071`**. DP-2's insertion point is stale in the diff-plan — the class `tools/check-citations.mjs` cannot catch, because the citation *resolves*. |
| *"the model already mandates [minor units] at `model/domain.ts:401`"* and *"`Money.amountMinor` is `number` (`model/domain.ts:401`)"* | `model/reconciliation.ts:537`, `:542` | `Money` is declared at **`model/domain.ts:531-538`**. `:401` is inside the `ExtractionInSetOutcome` docblock. Two dead citations in the §3 banner. |
| *"See §5.12"* | `docs/HANDOFF.md:129` | **There is no §5.12.** `grep -n '^### 5\.' docs/HANDOFF.md` stops at §5.11 (`:1753`). |
| *"33 applied"* G rows | the adjudication, `docs/build/ingestion-pipeline.md` lineage | **35** now (`grep -E '^\| G[0-9]+ \|' docs/HANDOFF.md \| grep -c '✅'`). The tree moved again. Derive, do not replace. |
| *"635 tests"* | `docs/HANDOFF.md:157` | The brief for this task states **666**. Not re-derived here (I did not run the suite); flagged as a moving count that `check-doc-counts.mjs` does not govern. |
| C17 framed as *"a duplicate carrying the same key"* | the adjudication `§5 C17`, `docs/build/ingestion-pipeline.md:409` | True but **under-specified in a way that changes the design**: `itemKey` is an **address**, so the collision is an address collision (a re-delivered file, a `lineIndex` minted from insertion order), **not** the same invoice number twice. The corpus's own duplicate-invoice scenario (`tests/scenarios/recon-corpus.ts:1315-1320`) does **not** collide and is already handled correctly. §2.3 carries this. |
| C16 cited at `model/reconciliation.ts:1094`, `:1106` (adjudication) / `:1004`, `:1024` (design record) | adjudication §5 C16; `docs/build/ingestion-pipeline.md:408` | The parameter is at **`:1004`** and the comparison at **`:1024-1026`** — the design record is right. **Neither document cites the seeding lines, which are the actual defect:** `let currency` at **`:1122`**, assigned at **`:1132`** and **`:1144`**. |
| C13's floor placed on `SetReconciliationRefusal` | adjudication §5 C13 | Half of it cannot go there without deleting the residue on the scenario whose purpose is to preserve it (`unclassifiedFieldFailsClosed`, `tests/scenarios/recon-corpus.ts:1946-1990`). §3b splits it and argues both halves. |
| A **third** copy of the lossy fold | `tests/scenarios/recon-corpus.ts:3165-3175` (`admittedStateFor`) | Neither the adjudication nor the design record names it. It is a fixture, so it cannot lose production money — but it is the site a future pass-probe fixture would silently lose a row at, and it must gain the same guard or a comment saying why not. |

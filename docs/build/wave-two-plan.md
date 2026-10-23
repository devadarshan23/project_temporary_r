# Wave two — the implementation plan for the integrity six

> **STATUS:** **WORKING MATERIAL · V1 AUTHORITY: NO** — like everything in `docs/build/`.
> 🛑 **This is a PLAN. Not one line of it is applied.** No declaration below exists in the tree.
> Where this page and a row in `docs/HANDOFF.md` §3 disagree, the G row wins.
>
> **Why a plan and not code.** `CLAUDE.md`'s working practice requires a written plan before anything
> touching `model/reconciliation.ts`, because the blast radius is the whole model; and Rule 2 caps a
> phase at five files with verification between them. Wave one — the containment-proof inversion — is
> **committed at `77d7277d`**. Wave two is the six below, and the owner asked for it planned first.
>
> ⚠️ **THE TREE MOVED WHILE THIS WAS BEING WRITTEN, AND EVERY CITATION BELOW WAS RE-DERIVED AFTER IT
> SETTLED.** The first half of this investigation read `model/reconciliation.ts` at `f988f2a4`, where
> `admitPopulation` was at `:1113`; the inversion landed mid-pass and moved it to `:1181`. **Every
> `file:line` on this page was re-derived at `77d7277d`, after the commit**, against
> `shasum model/reconciliation.ts` → `ff2774842c95e31f406198082765d5d4084e2d0f`. `tools/check-citations.mjs`
> cannot catch this class — a citation that drifted from one real line to another real line *resolves*.
> **Re-derive with §0 before trusting any of them.**

---

## 0. Reproduce every claim on this page

`tools/check-doc-counts.mjs`'s `TARGETS` (`tools/check-doc-counts.mjs:224-232`) does not descend into
`docs/build/`, so **no count on this page is checked by any tool.** Each ships with its command.
`tools/check-citations.mjs` *does* scan this directory, but only resolves paths ending `.ts` or
`.yaml` — so the `.md` and `.mjs` citations below are checked by nobody but a reader.

```bash
git rev-parse --short HEAD                                     # 77d7277d — the inversion commit
shasum model/reconciliation.ts                                 # ff277484… ; 3473 lines

# The six premises, each verified by opening the line, not by trusting a document.
grep -n 'expectedCurrency' model/reconciliation.ts             # :1072 param · :1092 comparison
grep -n 'let currency: string | null' model/reconciliation.ts  # :1190 — THE SEEDING LINE
grep -n 'items.set(item.key, item)' model/reconciliation.ts    # :2903 — the lossy fold
grep -n 'controlTotal\|ControlTotal' model/domain.ts           # 0 — C18 has no carrier at all
grep -c 'RefusedItem\[\]' model/reconciliation.ts              # admission accumulates and carries on
grep -n '_not_stated' model/reconciliation.ts | wc -l          # 8 — four arms, four refusal sites

# The verification surface these steps extend.
grep -c '^test(' tests/model/reconciliation-conservation.test.ts   # 9
grep -c '^test(' tests/model/reconciliation-passes.test.ts         # 7
grep -c 'describe(' tests/scenarios/engine-behaviour.test.ts       # 24 suites
grep -c ': Scenario = {' tests/scenarios/recon-corpus.ts           # 23 declared; 22 in SCENARIOS
node --test tests/scenarios/engine-behaviour.test.ts 2>&1 | tail -5 # 367 tests, 45 suites at HEAD
```

**Two counts this wave moves, and both are governed:**

```bash
grep -rho '@dropped-for-v1' model/*.ts | wc -l   # 235 at 77d7277d. CLAUDE.md:90 says 230 — ALREADY STALE.
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md        # 131 rows. G132-G166 are DRAFTED in
                                                 # docs/build/owner-rulings-10-aug.md §4, none applied.
```

⚠️ **`node tools/check-doc-counts.mjs` is red on the drop-marker line before this wave starts.** That
is not wave two's defect and wave two must not be blamed for it — but a commit here that moves the
count again inherits the fix. Named at step 2.

---

## 1. Where the rulings live, and which document outranks which

**Four documents govern these six, they disagree, and the disagreements are load-bearing.** Reading
the wrong one produces a design that was already refused.

| Document | What it is | Rank |
|---|---|---|
| `docs/build/ingestion-p2-green-integrity.md` | The **design** for C16/C17/C18/C13. 1194 lines of exact declarations. | ⚠️ **SUPERSEDED ON SIX POINTS.** Do not implement from it directly. |
| `docs/build/ingestion-p2-red-integrity.md` | The adversarial review. **Sixteen findings**, not twelve. | Every one was upheld; one remedy partly struck. |
| `docs/build/ingestion-p2-adjudication.md` §1.3, §4.4, §5, §6 | The **ruling** on all sixteen. | 🛑 **This outranks the green design.** |
| `docs/build/owner-rulings-10-aug.md` §3.6, §3.18 | The **owner's** rulings — O-15 and O-16. | 🛑 **Latest, and the owner's. Outranks the adjudication where they differ, and on O-15 they differ.** |

🛑 **THREE PLACES WHERE A READER WOULD GO WRONG, AND EACH IS RECORDED RATHER THAN SMOOTHED:**

1. **`docs/build/ingestion-p2-green-correction.md` is NOT the answer to the red.** It is a different
   team's design for the mapping-retraction and corrected-rerun path — `MappingRetraction`,
   `RecapturePlan`, `DocumentCapture`. Both files carry the same mtime; the correction could not be a
   reply to a review written beside it. **If a handoff points there for the integrity answers, that
   pointer is wrong.** The answers are the adjudication and the owner rulings.
2. **The O-numbers were renumbered.** Green-integrity raises the empty-population question as **O-10**
   (`docs/build/ingestion-p2-green-integrity.md:1164`) and the incomplete-status question as **O-11**.
   The adjudication's canonical mapping table renumbers them **O-15** and **O-16**. This plan uses the
   canonical numbers throughout. Never cite an O-number without its document.
3. **On O-15 the adjudication and the owner DISAGREE, and the owner wins.** The adjudication
   *recommends* a `population_empty` **post-condition**. The owner *ruled* a **REFUSAL** with a
   declared-expectation escape. This plan builds the refusal. The rejected recommendation is preserved
   at step 5 rather than dropped, because a later reader will find the adjudication first.

**Neither O-15 nor O-16 has a G number.** `docs/build/owner-rulings-10-aug.md` records that §3.1–§3.12
are unnumbered and need **G167 onward**; §3.6 and §3.18 sit outside even that range. Only the product
owner places a G row. **This wave lands code under rulings that have no number, and that must be said
in each commit message rather than discovered later.**

---

## 2. Build order, and the dependency graph

```
                       wave one (DONE, 77d7277d)
                     invert AssertNoTextDeep
                               │
        ┌──────────────────────┼───────────────────────────┐
        │                      │                           │
        ▼                      ▼                           ▼
  ① C16 declared unit    ⑥a pin the run-status       (independent)
        │                    wire pair, RED first
        │                      │
        ├──────────────┐       │
        ▼              │       │
  ② C17 duplicate      │       │
     address           │       │
        │              │       │
        ▼              │       │
  ②b the mixed-address │       │
     seen-map fix      │       │
        │              │       │
        ▼              │       │
  ③ C18 control totals ◄┘      │
        │                      │
        ▼                      │
  ④ C13 conformance floor      │
        │                      │
        ▼                      │
  ⑤ O-15 empty population      │
        │                      │
        └──────────┬───────────┘
                   ▼
          ⑥b O-16 `incomplete` ships
```

### The edges, each with its reason

| Edge | Why it is an edge and not a preference |
|---|---|
| **C16 → C18** 🛑 hard | C18's total check sums a document's admitted gross through `sumGross` (`model/reconciliation.ts:1531`), which folds `addMoney` and **refuses across units**. Under the seeding rule at `model/reconciliation.ts:1190` the population's unit is *whatever row one said*, so a declared control total would be compared against a quantity **the file chose the denomination of**. Both integrity reports and the adjudication converge here, against the first adjudication's stated order of *"C18 + C17 + C16"*. |
| **C16 → C13** 🛑 hard | C13's rate is `refused / presented`. Under seeding, a file that denominates itself in the wrong currency makes every *other* row refuse — so the rate measures the seed, not the mapping. |
| **C17 → C17b** ⚠️ ruled, and the reasoning cuts the other way | The adjudication states the order as *C16 → C17 → the mixed-address fix → C18 → C13* **and** states that C17 *"would MASK it rather than fix it"*. Both are true, and the consequence must be planned for: once C17 refuses the mixed case, **the `seen`-map defect is no longer reachable through `runSetReconciliation`**, so C17b's witness must be a **direct `checkPostconditions()` call**. `tests/model/reconciliation-conservation.test.ts` already calls it directly at five sites, so the fixture has a home. **Ordering it after C17 costs one degree of fixture freedom and is what was ruled; do not reorder it silently.** |
| **C17 → C18** ⚠️ soft but real | NOTED 13's early return: a document listed twice **with a declared trailer** yields `duplicate_item_address` *plus* a false `declared_line_count_disagrees` (2N vs N) *plus* a false `declared_control_total_disagrees` (sum doubled). Two of three false. The early return only has something to return early *from* once both walks exist. |
| **C13 → O-15** ⚠️ soft | Both partition the same space, and the boundary is the whole point: C13's rate arm **must not fire at `presented === 0`** (no denominator, no rate) and O-15's arm **must not fire when rows were presented and all refused** (that is C13's `population_wholly_refused`). Landing them together invites one arm to swallow the other. Landing C13 first means O-15's fixture can assert the C13 arm is *absent*. |
| **C18 + O-15 → O-16** 🛑 hard | O-16 exists because C18 and O-15 both produce **completeness facts with nowhere to go**. Shipping O-16 first would be a third run state with no producer. |
| **⑥a → ⑥b** 🛑 hard, and it is the owner's | *"the run-status wire pair must be pinned in `tools/check-wire-mirror.mjs` FIRST"* — or model and wire drift while `npm run check` stays green throughout. ⑥a is on the **critical path but not the dependency chain**: it touches `tools/` and can be built any time before ⑥b. |

### The two commits that are NOT one-per-change, and why

The brief asks that each of the six be its own commit. **Two are split, and neither split is mine:**

- **C17 / C17b** — the adjudication rules the `seen`-map fix *"owed on its OWN commit with its own
  mutation."* It is a fix to an **existing, live** defect, not part of C17.
- **C18a / C18b** — the five-file phase cap forces it. C18 touches `model/domain.ts`,
  `model/reconciliation.ts` and **four** fixture construction sites. Splitting types from checks puts
  it at 5 and 3. Green proposed the same split independently.
- **O-16a / O-16b** — the owner's sequencing constraint above.

**Eight commits, six changes, gate green between every one.**

---

## 3. STEP ① — C16, the declared unit

### 3.1 What is true at the tree today

`admitOne` takes a seed and compares against it (`model/reconciliation.ts:1072`, `:1092`):

```ts
  expectedCurrency: string | null,
```
```ts
  if (expectedCurrency !== null && gross.currency !== expectedCurrency) {
    return refuse(amountPath, { kind: 'currency_disagrees_with_population' })
  }
```

`admitPopulation` mints that seed from whichever row was admitted first (`model/reconciliation.ts:1190`,
and the two seeding sites at `:1200` and `:1212`):

```ts
  let currency: string | null = null
```
```ts
        if (currency === null) currency = outcome.item.gross.currency
```

**So the first admitted row denominates the entire side, and nothing refuses** — row one is compared
against `null` and always agrees. The poisoned row is not rejected; **it becomes the definition.**

⚠️ **The corpus states the defect as the specification.** `twoCurrenciesNeverMatchAcross`
(`tests/scenarios/recon-corpus.ts:1645`) has, in its own `derivedFrom`:
*"admitPopulation — `currency` is fixed by the first admitted item and every later row is checked
against it"*. **That sentence is what this step deletes.** It is not a fixture that will happen to
break; it is a hand-derived expectation that asserts the wrong rule, and the corpus header forbids
"fixing" an expectation by running the engine — so the rewrite must cite C16 in `derivedFrom`.

⚠️ **A second defect the current check cannot see.** It compares `gross.currency` **alone**. SGD-exponent-0
against SGD-exponent-2 is **ADMITTED**, and then fails later inside a pass as a `MoneyRefusal` from
`addMoney` — a hundredfold unit error surfacing as a tolerance artefact. `tests/scenarios/recon-corpus.ts:3558`
records that no scenario mixes exponents, so nothing would have caught it.

### 3.2 The money situation — verified, and what the unbuilt codec owes

🛑 **The brief is right and `model/canonical.ts` is wrong.** `Money.amountMinor` is **`number`**
(`model/domain.ts:535`), not `bigint`. `model/canonical.ts:66` asserts *"After G65 `Money.amountMinor`
is `bigint`"* — G65 is **recorded, not applied**, and `grep -rn bigint model/*.ts` returns nothing but
prose. `model/reconciliation.ts:541` says the opposite, correctly, in the same tree.

**The prior design's claim that the existing helpers suffice — CHECKED, and it holds with two
exceptions.** `sameUnit` (`model/reconciliation.ts:631`) compares **currency AND exponent**, which is
exactly the comparison C16 needs and is strictly stronger than the field it replaces. `compareMoney`
(`:701`) and `minorUnitsOf` (`:665`) are unchanged by this step. The exceptions:

1. 🛑 **`sumGross([])` returns `{ kind: 'currency_mismatch' }`** (`model/reconciliation.ts:1531`), a
   reason that is simply **false**, in a module whose §1 rule is that every failure is a *named* value.
   Unreachable today; C18 is the first caller that can pass an empty array. `MoneyRefusal` gains
   `{ kind: 'no_items' }` at step ③.
2. 🛑 **Nothing in `model/` constructs a `Money` from a declaration.** `zeroLike()`
   (`model/reconciliation.ts:643`) constructs one from an *existing* `Money` — which is why C16 must
   declare a **unit** and not a `Money`: declaring a `Money` means writing an amount, and a fabricated
   zero on an authoritative declaration is the exact defect `ResidueEntry.settlement`
   (`model/reconciliation.ts:2168`) exists to prevent.

**What the unbuilt G111 money codec owes this work, stated rather than approximated (§5.7):**

- **The closed currency set.** ✅ Verified: there is **no `CurrencyCode` type, no ISO 4217 table and no
  closed union anywhere** — `Money.currency` (`model/domain.ts:533`), `MoneyAmount.currency`
  (`model/policy.ts:167`) and four more are all bare `string`. `model/policy.ts` already refuses
  `autonomy_value_ceiling_unevaluable` rather than deriving an exponent from a currency code, on the
  stated ground that inventing the table at one call site is §5.7. 🛑 **So C16 must NOT validate
  membership.** `MoneyUnit` checks that a unit is **stated**, never that it is *a currency*. Membership
  is the ingestion codec's and the money codec's; a currency list minted here would be a second
  catalogue in the engine (§5.3) for a list this module is not authoritative for. **The brief's
  "validated against a closed set" is satisfied upstream, by an FDE-declared admissible-unit list under
  the O-8 posture — not by a constant invented here** (`PRODUCT.md`).
- **Parsing and rendering.** A wire currency string becomes a `MoneyUnit` through the codec. This
  module consumes a declaration; it never resolves one.
- **The `bigint` retype.** `minorUnitsOf()` is the one function that breaks under G65, deliberately and
  loudly. C16 adds **no** new read of `amountMinor` — `guardUnit()` reads `currency` and `exponent`
  only, and it lives **inside §3**, above `_MoneySectionEndsHere` (`model/reconciliation.ts:830`), so
  the money surface stays one section wide.

### 3.3 The exact declarations

**(a) `model/reconciliation.ts` — §3, immediately after the section banner closes and BEFORE
`function sameUnit` at `:631`.**

```ts
/**
 * A money UNIT — the denomination, with no amount attached.
 *
 * ⚠️ NOT A SECOND MONEY VOCABULARY (§5.3), AND THE ASSERTION BELOW IS WHAT MAKES
 * THAT CHECKABLE RATHER THAN ASSERTED. It is `Money` (`model/domain.ts:531`) with
 * `amountMinor` removed, and `Money` is assignable to it structurally — which is
 * why `sameUnit()` can take it and keep working, unchanged, on the `Money`
 * arguments it already has.
 *
 * WHY IT EXISTS AT ALL. C16 requires a population's denomination to be DECLARED.
 * The only existing carrier of a denomination is a `Money`, and declaring one
 * would mean writing an amount — a FABRICATED ZERO, in the one place a
 * declaration is supposed to be authoritative. `ResidueEntry.settlement`
 * (`model/reconciliation.ts:2168`) records what a fabricated zero cost this
 * codebase once already.
 *
 * 🛑 WHAT IT DOES NOT DO, AND THIS IS A REFUSAL AND NOT AN OMISSION. It asserts
 * NOTHING about ISO 4217 membership. There is no currency table anywhere in
 * `model/` — `Money.currency` (`model/domain.ts:533`) and `MoneyAmount.currency`
 * (`model/policy.ts:167`) are both bare strings — and `model/policy.ts` already
 * refuses to derive an exponent from a currency code rather than invent one, on
 * §5.7. Membership belongs to the ingestion codec and, under G111, to the money
 * codec that owns the representation. A currency list minted here would be a
 * second catalogue in a module that is not authoritative for it.
 */
export interface MoneyUnit {
  /** ISO 4217, e.g. 'SGD'. Checked as STATED, never as a member. */
  readonly currency: string
  /** Minor units per major unit as a power of ten. 2 for SGD, 0 for JPY. */
  readonly exponent: number
}

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
 * to `Money` and this must report TS2344; the negative twin belongs in the commit
 * message, run by hand, exactly as `_ReaderVerdictHoldsNoTextDeep` asks.
 */
export type _MoneyIsAMoneyUnitPlusAnAmount = Assert<
  [Exclude<keyof Money, 'amountMinor'>] extends [keyof MoneyUnit]
    ? [keyof MoneyUnit] extends [Exclude<keyof Money, 'amountMinor'>]
      ? true
      : false
    : false
>
```

**(b) `model/reconciliation.ts:631` — `sameUnit` widens. The body is unchanged; every existing caller
passes `Money` and still compiles.**

```ts
function sameUnit(a: MoneyUnit, b: MoneyUnit): MoneyRefusal | null {
```

**(c) `model/reconciliation.ts:332` — `MoneyRefusal` gains two arms.** 🛑 **One kind for three
operator errors is §5.2. And a negative exponent is *stated and invalid*, not *not stated*.**

```ts
  /** C16. A declared unit whose currency is the empty string — a declaration
   *  that declares nothing. Carries no value: the rejected string would be
   *  configuration, but the arm's siblings carry none and consistency here is
   *  cheaper than an exception (§1). */
  | { kind: 'currency_not_stated' }
  /** C16. Stated and invalid — negative, or not an integer. Distinct from
   *  `currency_not_stated` because they are different operator errors with
   *  different fixes, and one kind for both is the shape §5.2 catalogues. */
  | { kind: 'exponent_not_a_non_negative_integer' }
```

**(d) `model/reconciliation.ts` — `guardUnit()`, immediately after `guardMoney` at `:678`.**

🛑 **IT LIVES IN §3 AND THAT IS THE WHOLE POINT OF WHERE IT LIVES.** The obvious placement is the
per-side loop in `runSetReconciliation`, which is **below `_MoneySectionEndsHere`**
(`model/reconciliation.ts:830`) whose own sentence is *"below this line nothing may name the money
representation."* The `money-sentinel` control (`tests/model/reconciliation-controls.test.ts:309`) bans
the literal `amountMinor` **only**, so a gate reading `unit.currency` and `unit.exponent` down there
would leave the control **green while the property it protects is breached** — §5.6, inside the file
whose header is nine negative controls.

```ts
/**
 * Is a declared unit STATED? Not: is it a currency. See `MoneyUnit`.
 *
 * ⚠️ NO UPPER BOUND ON `exponent`, DELIBERATELY. This engine only ADDS, SUBTRACTS
 * and COMPARES — it never multiplies, never divides and never rounds — so a large
 * exponent has no arithmetic consequence here, and `sameUnit` refuses a mismatch
 * so it cannot be mixed. A ceiling would be a number nobody in this repository is
 * authoritative for (`PRODUCT.md`), and it belongs to the codec that parses a
 * wire currency under G111.
 */
export function guardUnit(unit: MoneyUnit): MoneyRefusal | null {
  if (unit.currency.length === 0) return { kind: 'currency_not_stated' }
  if (!Number.isInteger(unit.exponent) || unit.exponent < 0) {
    return { kind: 'exponent_not_a_non_negative_integer' }
  }
  return null
}
```

**(e) `model/reconciliation.ts:1019` — `PopulationBinding` gains the declaration, immediately after
`readonly spec: PopulationSpec`.**

```ts
  /**
   * → `PopulationSpec.declaredUnit` under DP-2. Required, NON-NULL.
   *
   * 🛑 C16 — CURRENCY IS DECLARED, NEVER INFERRED, AND THIS FIELD IS THE WHOLE
   * RULING. `admitPopulation` seeded the population's currency from WHICHEVER ROW
   * WAS ADMITTED FIRST and checked every later row against that seed. A CSV cell
   * carries no currency, so whoever controlled row one denominated the entire
   * side — and nothing refused, because row one is compared against `null` and
   * always agrees.
   *
   * NULLABLE WOULD REINTRODUCE THE DEFECT WEARING A NULL. `null` reads as "not
   * stated", and not-stated takes the permissive branch at the first call site
   * somebody writes in a hurry — §5.5, and `docs/access-and-agency.md` §8.6's
   * `neverExport → exportable` inversion is this record's own precedent for a
   * null that fails OPEN. Required and non-null; an unstated unit is a REFUSAL,
   * in the same gate as the three bounds this engine already refuses to default.
   *
   * WHERE THE VALUE COMES FROM, AND IT IS NEVER THIS ENGINE: source configuration
   * set by an FDE, or a column bound as a currency field by a promoted mapping
   * whose codec validated it against a closed set. This module consumes a
   * declaration; it does not resolve one.
   */
  readonly declaredUnit: MoneyUnit
```

**(f) `model/reconciliation.ts:922` — replace the single-line arm with:**

```ts
  /**
   * C16. The row's money unit disagrees with the population's DECLARED unit —
   * currency or exponent, and `sameUnit()` (§3) is the only thing that decides
   * which. The name no longer says "population" because the population is no
   * longer the authority: a DECLARATION is, and a row that disagrees with it is
   * refused rather than allowed to redefine it.
   *
   * ⚠️ IT CATCHES A CASE THE OLD ARM COULD NOT SEE. The old check compared
   * `gross.currency` alone, so SGD-exponent-0 against SGD-exponent-2 was ADMITTED
   * and failed later, inside a pass, as a `MoneyRefusal` from `addMoney` — a
   * hundredfold unit error surfacing as a tolerance artefact instead of an
   * admission refusal. §5.7 exactly.
   */
  | { kind: 'money_unit_disagrees_with_declared'; refusal: MoneyRefusal }
```

**(g) `model/reconciliation.ts:1065-1092` — `admitOne` stops taking a seed.** Delete the
`expectedCurrency: string | null` parameter and replace the comparison with:

```ts
  const gross = amountScalar.value
  const disagreement = sameUnit(gross, binding.declaredUnit)
  if (disagreement !== null) {
    return refuse(amountPath, { kind: 'money_unit_disagrees_with_declared', refusal: disagreement })
  }
```

**(h) `model/reconciliation.ts:1181-1219` — `admitPopulation` stops carrying one.** Delete
`let currency: string | null = null` (`:1190`), **both seeding lines** (`:1200`, `:1212`) and the
trailing argument from both `admitOne` calls. ⚠️ **The seeding lines are the actual defect and neither
prior document cited them.** The docblock gains:

```
 * ⚠️ THIS FUNCTION NO LONGER INFERS A DENOMINATION. The unit is
 * `binding.declaredUnit` and every row is checked against it, INCLUDING THE
 * FIRST — C16. There is no order-dependent state left in this fold, which makes
 * the admission result INDEPENDENT of row order rather than merely deterministic
 * in it.
```

**(i) `model/reconciliation.ts:2697` — `SetReconciliationRefusal` gains two arms.**

🛑 **THE SECOND ONE IS THE ONE A PER-SIDE DECLARATION FORGETS, AND IT IS THE DANGEROUS ONE.** Declaring
a unit per side and never reading one against the other moves the error **from the file into
configuration**, where it is systematic and silent: an FDE configuring `{SGD, 0}` against `{SGD, 2}`
admits **every row on both sides**, allocates nothing, lands the whole population in the residue as
`no_strategy_paired` — *"nothing matched it"*, which is false — and `postconditions` is **empty**,
because conservation over zero allocations is trivially sound.

```ts
  /** C16. A population whose denomination was not stated, or stated invalidly.
   *  Same posture as the three bound arms above: an absent bound is a refusal,
   *  never a default. Carries the reasoned refusal rather than one flat kind. */
  | { kind: 'declared_unit_invalid'; side: PopulationSide; refusal: MoneyRefusal }
  /** C16. The two sides, or a side and the amount tolerance, name different
   *  denominations. Not a row-level finding: it is a configuration error that
   *  would otherwise present as a 100%-unmatched close reported SOUND. */
  | {
      kind: 'declared_units_disagree'
      against: 'other_side' | 'amount_tolerance'
      refusal: MoneyRefusal
    }
```

**(j) `model/reconciliation.ts:2877` — the gate. It replaces the per-side loop's opening rather than
folding into it, because two of the three comparisons need both sides in scope at once.**

```ts
  for (const side of ['left', 'right'] as const) {
    const binding = side === 'left' ? input.left : input.right
    const unstated = guardUnit(binding.declaredUnit)
    if (unstated !== null) {
      return { ok: false, refusal: { kind: 'declared_unit_invalid', side, refusal: unstated } }
    }
    const defects = validateNormalisation(binding.normalisation)
    if (defects.length > 0) {
      return { ok: false, refusal: { kind: 'normalisation_invalid', side, defects } }
    }
  }

  /* C16, and the comparison a per-side declaration cannot make. `sameUnit` is the
   * function widened for exactly this; using it on one pair out of three would be
   * widening it and then declining to use it. */
  const sidesAgree = sameUnit(input.left.declaredUnit, input.right.declaredUnit)
  if (sidesAgree !== null) {
    return {
      ok: false,
      refusal: { kind: 'declared_units_disagree', against: 'other_side', refusal: sidesAgree },
    }
  }
  const amountTolerance = input.pairing.amountTolerance
  if (amountTolerance.kind === 'money') {
    /* `rounding` is minor units and unit-free, so it is admitted against any
     * declaration — the same reasoning `toleranceAdmits` already applies. */
    const toleranceAgrees = sameUnit(amountTolerance.value, input.left.declaredUnit)
    if (toleranceAgrees !== null) {
      return {
        ok: false,
        refusal: {
          kind: 'declared_units_disagree',
          against: 'amount_tolerance',
          refusal: toleranceAgrees,
        },
      }
    }
  }
```

### 3.4 What it refuses, and what fails closed

| Condition | Outcome | Fails closed? |
|---|---|---|
| `declaredUnit.currency === ''` | run refusal `declared_unit_invalid` / `currency_not_stated` | ✅ no run at all |
| `declaredUnit.exponent` negative or non-integer | run refusal `declared_unit_invalid` / `exponent_not_a_non_negative_integer` | ✅ |
| left `{SGD,0}` vs right `{SGD,2}` | run refusal `declared_units_disagree` / `other_side` / `exponent_mismatch` | ✅ **and this is the arm that stops a silent 100%-unmatched close** |
| `amountTolerance` money in USD, declaration SGD | run refusal `declared_units_disagree` / `amount_tolerance` | ✅ |
| a row in a currency other than the declaration | **row** refusal → residue with its reason | ✅ the residue survives — the row is never dropped |
| a row at a different exponent | **row** refusal (new; admitted today) | ✅ |

**Nothing here fails open.** The type carries no nullable arm, so "not stated" is not representable.

✅ **VERIFIED: every declaration above survives the newly-inverted containment proof.** I re-declared
`NoTextField` verbatim from `model/reconciliation.ts:310-326` into a scratch file outside the
repository together with every arm on this page, and compiled it with the tree's own compiler. The
**only** error was the deliberate negative control (`{ unit: MoneyUnit }`, which must fail because
`MoneyUnit.currency` is a free `string`). Reproduce:

```bash
node_modules/.bin/tsc --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess \
  --erasableSyntaxOnly --noEmit --target ES2022 --lib ES2022 <scratch>.ts
```

⚠️ **`MoneyUnit` may never appear on a text-proofed union** for that reason. It does not, anywhere
below.

### 3.5 The fixture that witnesses it

🛑 **§5.10: nothing in `model/` constructs a `PopulationBinding`, so `tsc` staying green after this
change tells nobody anything.** The construction sites are all in `tests/`, and they are few:

| Site | Change |
|---|---|
| `tests/scenarios/recon-corpus.ts:312` (`ledgerBinding`) · `:331` (`bankBinding`) | `declaredUnit: { currency: 'SGD', exponent: 2 }`, overridable per scenario. **2 sites → 22 scenarios.** |
| `tests/model/reconciliation-conservation.test.ts` · `tests/model/reconciliation-passes.test.ts` | each has its own private `population()` builder — both go red at `npm run typecheck:tests` |

**New scenarios in `tests/scenarios/recon-corpus.ts`:**

- **F1 `declaredUnitSurvivesRowOrder`** — 🛑 **the one that makes C16 legible.** `twoCurrenciesNeverMatchAcross`
  with the ledger's two lines **swapped** so the USD row is index 0, `declaredUnit` SGD on both sides.
  Expectation **identical to F2 in every dimension.** Under the seeding rule the SGD rows would be
  refused and the USD pair would match — *the file would have chosen the denomination.* **Same file,
  two row orders, two different answers** is the defect stated as a fixture.
- **F2 `twoCurrenciesNeverMatchAcross` REWRITTEN** (`tests/scenarios/recon-corpus.ts:1645`) — the
  refusal becomes `{ kind: 'money_unit_disagrees_with_declared', refusal: { kind: 'currency_mismatch' } }`
  at four sites. ⚠️ **Its `summary` and `derivedFrom[0]` currently state the seeding rule as the
  specification and must be rewritten to cite C16** — an expectation change on a hand-derived scenario
  is exactly what the corpus header forbids doing casually, so the citation is what distinguishes it.
- **F3 `mixedExponentIsRefusedAtAdmission`** — closes the gap `tests/scenarios/recon-corpus.ts:3558`
  already names. One SGD-exponent-0 row against a declared exponent 2. **Admitted at HEAD.**
- **F4 `unstatedDeclaredUnitRefusesTheRun`** — a `RefusalScenario` (`tests/scenarios/recon-corpus.ts:2250`),
  `declaredUnit.currency: ''` → `declared_unit_invalid`.
- **F4b `declaredUnitsDisagreeRefusesTheRun`** — 🛑 **owed and written nowhere.** SERIOUS 7 was ruled
  and no document wrote the declaration or the fixture. `{SGD,0}` left against `{SGD,2}` right.
  **Without this fixture the arm in (i) has no witness at all.**

`tests/scenarios/export-surface.test.ts` — `guardUnit` under `used(…)`; the refusal-kind table gains
`money_unit_disagrees_with_declared` and drops `currency_disagrees_with_population`.

### 3.6 The mutation that proves it bites

| Mutation (one line in `model/`) | Expected red |
|---|---|
| **(a) Restore the inference** — reinstate the seed and compare against it | **F1 and F2 give different answers over the same rows.** ≈ 8 `it`s across allocations, `refusedAtAdmission` and residue. This is the mutation to record. |
| **(b) Compare currency only** — `gross.currency === binding.declaredUnit.currency` | F3 only. ≈ 2. **This is the mutation that shows why `sameUnit` and not a hand-rolled comparison** — `model/access.ts` hand-rolls it in three places and `model/reconciliation.ts:624` names that as a live §5.3 risk. |
| **(c) Make the unit nullable** and skip the check when null | F4. ≈ 1. Small, and the point is §5.5: the *type* change is what makes the defect possible again. |
| **(d) Delete the cross-side comparison** | F4b only. ≈ 1. ⚠️ **If F4b is not written, this mutation turns NOTHING red — and a control whose mutation turns nothing red is not a control.** |

⚠️ **A mutation counts only if the control's error is the ONLY error.** A `TS6133` beside it means
`noUnusedLocals` produced the red, not the control.

### 3.7 Commit boundary

**Commit ①** — `model/reconciliation.ts`, `tests/scenarios/recon-corpus.ts`,
`tests/scenarios/engine-behaviour.test.ts`, `tests/scenarios/export-surface.test.ts`,
`tests/model/reconciliation-passes.test.ts`. **5 files — at the cap.**
`tests/model/reconciliation-conservation.test.ts` also holds a `population()` builder; if it must
change too, this splits. Gate: `npm run check && npm test`. **Highest blast radius in the wave.**

---

## 4. STEP ② — C17, the duplicate address

### 4.1 What is true at the tree today

`model/reconciliation.ts:2902-2903`:

```ts
  const items = new Map<string, AdmittedItem>()
  for (const item of [...left.admitted, ...right.admitted]) items.set(item.key, item)
```

`checkPostconditions` then computes the admitted total by iterating **the same map that just ate the
row** (`model/reconciliation.ts:2770-2771`):

```ts
  for (const item of state.items.values()) {
    admittedMinor += minorUnitsOf(item.gross)
```

So `admittedMinor` and `accountedMinor` are **both short by the same amount** and `gross_not_partitioned`
(`model/reconciliation.ts:2714`) **cannot fire.** There is a **third copy of the same lossy fold** in
the fixtures — `admittedStateFor` (`tests/scenarios/recon-corpus.ts:3165`).

🛑 **THE SHARPENING THE BRIEF CARRIES, AND IT CHANGES WHAT C17 IS.** `itemKey`
(`model/reconciliation.ts:877`) is `${side}:${len}:${id}:${line}` — an **ADDRESS**. Two rows collide
**iff they share an address**, not iff they share a value. ✅ **Verified in the corpus:**
`duplicateIdentifierIsAnAmbiguity` (`tests/scenarios/recon-corpus.ts:1329`) keys `INV-3050` at
`line(0)` and `line(1)` of one document (`tests/scenarios/recon-corpus.ts:1315`) — **two addresses, two
keys, no collision** — and it is already correct today as an `AmbiguityFinding` with all three rows in
the residue. **C17 is NOT duplicate-invoice detection.** Conflating them is §5.1 — a rule keyed on the
word *"duplicate"* instead of on the property each protects.

The overwrite is reachable exactly three ways, and each is an ingestion defect: the same
`SourceDocument` listed twice; two `ExtractedLine`s carrying the same `index`; the same document id
twice header-grain.

### 4.2 The exact declarations

**(a) `model/reconciliation.ts` — a new §4a immediately after `admitPopulation` closes at `:1219`.**

```ts
export type PopulationDefect =
  /**
   * C17, and the reason it is a REFUSAL rather than a residue entry. Two rows
   * share one `itemKey` — the same `(side, sourceDocumentId, lineIndex)`. The
   * fold at §9 would silently `Map.set` the second over the first, the row would
   * VANISH, and `checkPostconditions` computes the admitted total by iterating
   * that same map — so conservation would hold over a population one row short.
   *
   * THE ENGINE CANNOT PICK ONE. They are the same row by every identity it has,
   * and *"nothing is ever dropped"* forbids choosing. This is the one place where
   * refusing beats residue: there is no ROW to put in the residue — there are two
   * rows claiming to be one.
   *
   * 🛑 IT REQUIRES AT LEAST ONE ADMITTED COPY, and that narrowing is not
   * cosmetic. Two REFUSED copies of one address already produce a named outcome
   * today — two residue entries at one key, raised as `item_in_residue_twice`
   * (`model/reconciliation.ts:2711`), with both rows and both reasons visible and
   * `postconditions` non-empty. Refusing the run there would REPLACE a named
   * outcome with nothing at all, which is a regression. Only an admitted copy
   * reaches the fold, and only the fold loses money.
   *
   * ⚠️ THIS IS NOT DUPLICATE-INVOICE DETECTION. The same invoice number at two
   * DIFFERENT addresses is a different finding with its own mechanism —
   * `passIdentifierJoin`'s multimap, an `AmbiguityFinding`, and
   * `identifier_ambiguous` on every named ref — witnessed by
   * `duplicateIdentifierIsAnAmbiguity` (`tests/scenarios/recon-corpus.ts:1329`).
   */
  | { kind: 'duplicate_item_address'; ref: ItemRef; occurrences: number }

/**
 * 🟢 THE CONTAINMENT PROOF, ON A UNION THAT NAMES DOCUMENTS.
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN, and `Assert<never>` compiles, so a
 * vacuous proof is indistinguishable from a real one by reading. Add
 * `filename: string` to any arm and `tsc` must report TS2344. A branded
 * `SourceDocumentId` passes (`model/kernel.ts:43`; the `T extends string ? T` arm
 * at `model/reconciliation.ts:312` exists precisely for it) while a raw filename
 * cannot — which is the distinction that matters, because a filename is
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
}

/**
 * Every population-grain defect, in a fixed order. Pure, total, no clock, no
 * throw — the same contract as `checkPostconditions()`, whose shape this copies
 * rather than inventing a second integrity idiom.
 *
 * 🛑 ORDER IS PART OF THE CONTRACT AND THE EARLY RETURN IS WHAT MAKES IT TRUE.
 * C17 first, and it RETURNS: an address collision makes every later count wrong.
 * A document listed twice with a declared trailer would otherwise report
 * `duplicate_item_address` PLUS a false `declared_line_count_disagrees` (2N vs N)
 * PLUS a false `declared_control_total_disagrees` (the sum doubled) — two of
 * three false, beside one true. A fixture asserts the sequence.
 */
export function checkPopulationIntegrity(
  input: PopulationIntegrityInput,
): readonly PopulationDefect[] {
  const defects: PopulationDefect[] = []

  /* --- C17: one address, one row, and at least one copy ADMITTED. --- */
  const admittedAt = new Set<string>()
  for (const item of input.admitted) admittedAt.add(itemKey(input.side, item.ref))
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
    if (!admittedAt.has(key)) continue
    const ref = firstRef.get(key)
    if (ref === undefined) continue
    defects.push({ kind: 'duplicate_item_address', ref, occurrences: count })
  }
  if (defects.length > 0) return defects

  return defects
}
```

**(b) `model/reconciliation.ts:2697` — one new refusal arm, plus the fold's negative control.**

```ts
  /** C17 (and C18 and C13 at later steps). ONE arm carrying MANY named defects —
   *  the exact shape of `normalisation_invalid` above, chosen so a population
   *  reports every defect it has rather than the first, and so no second refusal
   *  vocabulary appears. */
  | { kind: 'population_integrity_refused'; side: PopulationSide; defects: readonly PopulationDefect[] }
  /** C17's second site. UNREACHABLE while the arm above runs first; its only
   *  witness is a mutation, and that is stated rather than implied. */
  | { kind: 'admitted_item_key_collision'; side: PopulationSide; ref: ItemRef }
```

**(c) `model/reconciliation.ts:2902-2903` — the fold itself must not be able to swallow one.**

```ts
  const items = new Map<string, AdmittedItem>()
  for (const item of [...left.admitted, ...right.admitted]) {
    /* A NAMED NEGATIVE CONTROL, NOT A REVIEW CONVENTION — the posture G99 demands
     * of `withTenantScope()`. §4a refuses this case before the fold is reached, so
     * this arm is UNREACHABLE TODAY and I am saying so rather than implying
     * coverage. It stays because THIS is the line that loses the row, and a
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

**(d) The call site**, between the two `admitPopulation` calls (`model/reconciliation.ts:2899-2900`)
and the fold.

```ts
  for (const side of ['left', 'right'] as const) {
    const outcome = side === 'left' ? left : right
    const defects = checkPopulationIntegrity({
      side,
      documents: side === 'left' ? input.leftDocuments : input.rightDocuments,
      admitted: outcome.admitted,
      refused: outcome.refused,
    })
    if (defects.length > 0) {
      return { ok: false, refusal: { kind: 'population_integrity_refused', side, defects } }
    }
  }
```

⚠️ **`admittedStateFor` (`tests/scenarios/recon-corpus.ts:3165`) is the third copy of the lossy fold
and must gain the same guard, or a comment saying why not.**

### 4.3 What it refuses, and what fails closed

| Case | Outcome |
|---|---|
| both copies **admitted** | `population_integrity_refused` / `duplicate_item_address` — ✅ the run stops before an allocation exists |
| both copies **refused** | 🛑 **no C17 refusal.** Stays where the tree already puts it: `item_in_residue_twice`, `ok: true`, both rows and both reasons in the residue |
| **mixed** — one admitted, one refused | C17 refuses (≥1 admitted). **The underlying conservation defect is fixed separately at ②b** |
| same invoice number, two addresses | **untouched** — `AmbiguityFinding`, exactly as today |

### 4.4 The fixture

- **F5 `duplicateLineIndexRefusesThePopulation`** — one document with `line(0, …)` twice.
- **F6 `redeliveredDocumentRefusesThePopulation`** — the same `SourceDocument` twice in `leftDocuments`;
  `lineIndex: null` on the header-grain ref. ⚠️ **Restate F6 with a declared trailer once C18 lands, or
  the early return is masked rather than witnessed** — at this step there is no trailer to disagree, so
  the early-return assertion is owed to step ③.
- **F5b `bothCopiesRefusedIsStillTheNamedOutcome`** — 🛑 **owed, and it is the regression guard.** A
  doubled address whose copies **both** refuse must stay `ok: true` with `item_in_residue_twice`.
  Without it, the next reader "simplifies" the walk by dropping the `admittedAt` check and nothing
  turns red.
- `tests/scenarios/export-surface.test.ts` — `checkPopulationIntegrity` under `used(…)`; a totality
  list for `PopulationDefect` in the shape of `EXTRACTION_OP_KINDS_COVERED`; the defect-order contract;
  a direct-call vector asserting **`[]` on an empty input**.

### 4.5 The mutation

| Mutation | Expected red |
|---|---|
| **(a) Delete the `duplicate_item_address` block** | F5 and F6 go red **with the wrong refusal** (`admitted_item_key_collision`), not with a pass — watch for that, it looks like a success. ≈ 2–4. |
| **(b) Delete BOTH the block and the fold guard** | 🛑 **THE MOST IMPORTANT MUTATION IN THE WAVE.** F5 and F6 flip to `ok: true` and fail on allocations, residue and post-conditions — **and `gross_not_partitioned` stays SILENT.** That silence is the finding: a *green* conservation check over a population one row short. ≈ 6–8. |
| **(c) Drop the `admittedAt` narrowing** | F5b refuses where it should report. ≈ 1–2. |

### 4.6 Commit boundary

**Commit ②** — `model/reconciliation.ts`, `tests/scenarios/recon-corpus.ts`,
`tests/scenarios/export-surface.test.ts`. **3 files.**

⚠️ **Two riders that arrive with this commit or not at all.** The adjudication settles `unique_within`
UNBUILT with a dated drop note, which moves `grep -rho '@dropped-for-v1' model/*.ts | wc -l` from 235
to 236 and makes `node tools/check-doc-counts.mjs` report `CLAUDE.md:90` STALE **in the same commit**.
`CLAUDE.md:90` already says 230 and is **already stale at 235**. **Neither is wave two's defect.** This
plan does **not** fold `unique_within` in — it is not one of the six — but whoever takes commit ② owns
fixing the count line, because the gate is red until someone does.

---

## 5. STEP ②b — the mixed-address conservation fix

🛑 **THIS IS A LIVE DEFECT IN THE EXISTING TREE THAT NO DOCUMENT NAMES, AND IT IS C17's STRONGEST
JUSTIFICATION.** It is owed on its own commit because **C17 masks it rather than fixes it.**

### 5.1 What is true at the tree today — walked at `77d7277d`, not quoted from a document

`checkPostconditions` builds `seen` over **residue** itemKeys (`model/reconciliation.ts:2754-2758`),
then at `:2774`:

```ts
    const inResidue = (seen.get(item.key) ?? 0) > 0
```

Take copy **B** refused at admission — it lands in the residue with `settlement: null`, so
`seen[key] = 1`. Take copy **A** admitted — it survives the fold and sits in `state.items` **at the
same key**. Then `inResidue` is **TRUE for A**, while the residue entry is **B's**. Therefore:

- `accountedMinor += allocated + (inResidue ? minorUnitsOf(residual) : 0)` (`:2785`) credits **A's**
  residual as residue-carried;
- `if (!inResidue) missing += 1` (`:2786`) **never fires**;
- `open_item_missing_from_residue` (`:2710`) **cannot fire**;
- `gross_not_partitioned` (`:2795`) **balances** — over a ledger missing a transaction, with
  `postconditions` **EMPTY**.

**The residue and the ledger share one key space and the check assumes they do not.**

### 5.2 The exact change

```ts
  const seen = new Map<string, number>()
  for (const entry of residue) {
    /* 🛑 ONLY SETTLED ENTRIES SHARE A KEY SPACE WITH `state.items`. An
     * admission-refused entry carries `settlement: null` — it has no amount and
     * it is not in the ledger — yet `itemKey` is an ADDRESS, so a refused copy of
     * a duplicated address produces the SAME key as its admitted twin. Counting
     * it here made `inResidue` true for a row whose residue entry was the other
     * row's, so `open_item_missing_from_residue` could not fire and
     * `gross_not_partitioned` balanced over a ledger missing a transaction.
     * Found by walking the two maps against each other, not by a failing test —
     * no fixture in the corpus reaches it. */
    if (entry.settlement === null) continue
    const key = itemKey(entry.side, entry.ref)
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
```

⚠️ **`item_in_residue_twice` must keep counting BOTH.** Two refused copies of one address are exactly
what that arm exists to report (§4.3), so the duplicate count is taken over the **unfiltered** residue
and only `inResidue` reads the filtered map. **Two maps, two questions — folding them is §5.1.**

### 5.3 The fixture, and why it cannot go through the engine

🛑 **After ②, `runSetReconciliation` refuses the mixed case, so this defect is unreachable end-to-end.**
The witness is therefore a **direct `checkPostconditions()` call** — a hand-built `MatchingState` plus a
hand-built residue, which is precisely what `tests/model/reconciliation-conservation.test.ts` already
does at five sites, including one that builds a foreign-currency allocation by hand.

**New test in `tests/model/reconciliation-conservation.test.ts`:** one admitted item and one
admission-refused residue entry **at the same address**; assert `open_item_missing_from_residue`
fires. **It fails at HEAD.**

### 5.4 The mutation

Revert the `if (entry.settlement === null) continue`. The new test goes red **alone** — no other
conservation test moves, which is what proves the change is narrow. ≈ 1 test.

⚠️ **A second mutation is owed and it is the ordering guard:** delete the filter *and* delete C17's
`admittedAt` narrowing together. If the suite stays green, the fixture is going through the engine and
is being masked. It must be a direct call.

### 5.5 Commit boundary

**Commit ②b** — `model/reconciliation.ts`, `tests/model/reconciliation-conservation.test.ts`.
**2 files.**

---

## 6. STEP ③ — C18, control-total admission

### 6.1 What is true at the tree today

**Nothing.** `grep -n 'controlTotal\|ControlTotal' model/domain.ts` returns **0**. `SourceDocument`
(`model/domain.ts:1840`) carries `extracted`, `lines`, `ingestedAt`, `synthetic`, `purgeAfter`,
`purgedAt` — and **no record of what the file said about itself.** A trailer row shredded as a
transaction is admitted as a transaction, and nothing anywhere can tell.

### 6.2 The exact declarations

**(a) `model/domain.ts` — after `ExtractedLine` closes at `:1838`, before `SourceDocument` at `:1840`.**

```ts
/**
 * WHAT A FILE SAID ABOUT ITSELF — its own trailer, admitted as a first-class fact
 * rather than shredded as a transaction.
 *
 * 🛑 C18, AND THE THREE ARMS EXIST BECAUSE A NULLABLE FIELD CANNOT SAY THIS. The
 * obvious shape is `expectedLineCount: number | null` plus
 * `declaredControlTotal: Money | null`, and its null is AMBIGUOUS in the one way
 * that matters: it cannot distinguish *"this format has no trailer"* from *"the
 * trailer should have been there and was not"*. The second is a truncated or
 * tampered file, and a null that reads as "unchecked" is scope failing OPEN —
 * `docs/access-and-agency.md` §8.6's `neverExport → exportable` inversion is this
 * record's own precedent, and `docs/HANDOFF.md` §5.5 records this codebase
 * already fixing the shape once.
 *
 * AND IT IS WHAT CATCHES THE TRAILER SHREDDED AS A TRANSACTION. If the trailer
 * row is spent as a phantom receipt, the presented row count is one greater than
 * `lineCount` AND the summed amount is double the declared total — so the two
 * comparisons detect it INDEPENDENTLY, which is why the count is not redundant
 * with the total.
 */
export type ControlTotal =
  /**
   * The parser found a trailer. `lineCount` and `total` may each be null — inside
   * THIS arm a null means *"the trailer declared this one and not that one"*,
   * which cannot be read as "unchecked" because the arm itself is the assertion
   * that a trailer was found. A trailer declaring NEITHER is a defect, not a
   * silent pass.
   */
  | { kind: 'declared'; lineCount: number | null; total: Money | null }
  /** This format carries no trailer at all. An API payload, a bare CSV. */
  | { kind: 'not_declared_by_format' }
  /**
   * The parser EXPECTED a trailer for this format and did not find one. A
   * truncated file presents exactly like this, so it REFUSES — never a document
   * admitted with an unchecked total.
   */
  | { kind: 'expected_but_absent' }
```

**(b) `model/domain.ts:1853` — inside `SourceDocument`, immediately after `lines`.**

```ts
  /**
   * C18. What the file said about itself. Required and NON-OPTIONAL: the `TS2741`
   * at every construction site is the only evidence the field landed (§5.10, and
   * the same argument `ResidueEntry.settlement` makes about itself).
   */
  controlTotal: ControlTotal
```

**(c) `model/domain.ts:1807` — `DocumentType` gains the declaration, beside `expectedFidelity`.**

🛑 **THIS IS THE AMENDMENT THAT KEEPS C18 FROM BEING SWITCHED OFF BY THE COMPONENT IT CHECKS.** If the
**parser** alone decides which arm applies, then a refactored shredder that stops reading trailers
makes C18 inert **for every production file, with `npm run check` green.** The declaration belongs where
invariant 4 already puts this class of thing — on `DocumentType`, which declares `expectedFidelity`
beside `ACQUISITION_FIDELITY` (`model/domain.ts:1782`) for exactly the same reason.

```ts
  /**
   * C18. Whether this format carries a control total, declared on the TYPE and
   * not decided by the parser that produces the rows.
   *
   * 🛑 THE PARSER MAY NOT BE THE ONLY VOICE HERE. `ControlTotal` records what the
   * parser FOUND; this records what the format is SUPPOSED to carry. A parser
   * reporting `not_declared_by_format` for a type declared `always` is itself a
   * defect — which is the whole difference between a control and a control the
   * checked component can turn off.
   */
  carriesControlTotal: 'always' | 'never'
```

⚠️ **`SetReconciliationInput` carries no `DocumentType`.** Under the existing stopgap idiom,
`PopulationBinding` carries it beside the model type until DP-2 folds it in:

```ts
  /** → `DocumentType.carriesControlTotal` under DP-2. Required. */
  readonly carriesControlTotal: 'always' | 'never'
```

**(d) `model/reconciliation.ts:332` — `MoneyRefusal` gains the arm NOTED 15 asks for.**

```ts
  /** `sumGross` over an empty list. It returned `currency_mismatch`, which is
   *  simply FALSE — there is no second currency to mismatch. C18 is the first
   *  caller that can pass an empty array. */
  | { kind: 'no_items' }
```

**(e) `model/reconciliation.ts` — one shared row counter, exported, called by BOTH
`admitPopulation` and `checkPopulationIntegrity`.**

🛑 **Keeping the two COUNTS independent is the whole argument for C18; duplicating the RULE is not.**
And the rule has a hole `tests/scenarios/recon-corpus.ts:3559` already records: a document carrying
**both** header fields and lines is header-blind under `lines.length === 0`, so the header transaction
is presented by neither admission nor the C18 count — and a trailer declaring `lines.length` **passes
while a transaction was dropped.**

```ts
/** Rows a document PRESENTS. One rule, two callers — never two branches. */
export function presentedRowCount(document: SourceDocument): number {
  return document.lines.length === 0 ? 1 : document.lines.length
}
```

**(f) `model/reconciliation.ts` — five `PopulationDefect` arms.** Note `documentRowCount`, **not**
`presentedCount`: the C13 arm at step ④ counts rows on the whole **side**, and one field name over two
denominators inside one union is §5.3 inverted.

```ts
  /** A trailer that declared neither a count nor a total. Degenerate; admitting
   *  it would make the `declared` arm meaningless. */
  | { kind: 'control_total_declared_nothing'; sourceDocumentId: SourceDocumentId }
  /** THE TRUNCATED-SHRED DETECTOR, and the trailer-as-transaction detector.
   *  Compared against rows PRESENTED, never rows admitted — a truncated file and
   *  an unreadable row are different defects and keying one check on both is
   *  §5.1. */
  | {
      kind: 'declared_line_count_disagrees'
      sourceDocumentId: SourceDocumentId
      declaredCount: number
      documentRowCount: number
    }
  /** ⚠️ THE ARM THAT MAKES THE TOTAL CHECK HONEST. A refused row has no readable
   *  amount, so a sum over the admitted rows of a partially-refused document is
   *  NOT the file's total, and comparing it produces a wrong verdict in either
   *  direction. The engine says it cannot verify. Silently skipping the
   *  comparison here is the C13 defect at document grain. */
  | {
      kind: 'control_total_unverifiable_rows_refused'
      sourceDocumentId: SourceDocumentId
      documentRowCount: number
      admittedCount: number
    }
  /** `sumGross`/`compareMoney` refused. The reachable case is a trailer
   *  denominated differently from the declared unit — a real finding that must
   *  not be reported as a mismatch. */
  | { kind: 'control_total_not_evaluable'; sourceDocumentId: SourceDocumentId; refusal: MoneyRefusal }
  /** The file's own arithmetic disagrees with the file's own rows.
   *  🛑 THE EXPONENT IS CARRIED, in the one control whose entire subject is a
   *  hundredfold error. `gross_not_partitioned` can omit it because one run is
   *  one unit by construction; this arm is emitted PER DOCUMENT into a
   *  multi-document array, where that is not true. Minor units and never a
   *  `Money`: `Money.currency` is a `string`, so the containment proof forbids
   *  it — the same reason `MoneyRefusal` carries no currency. */
  | {
      kind: 'declared_control_total_disagrees'
      sourceDocumentId: SourceDocumentId
      declaredMinor: number
      declaredExponent: number
      admittedMinor: number
      admittedExponent: number
    }
  /** The parser's arm disagrees with the type's declaration. The control the
   *  checked component would otherwise be able to switch off. */
  | { kind: 'control_total_arm_disagrees_with_document_type'; sourceDocumentId: SourceDocumentId }
```

**(g) `model/reconciliation.ts:2697` — ONE new refusal arm, and only one.**

🛑 **THE FIVE COMPARISON ARMS ARE POST-CONDITIONS, NOT REFUSALS, AND THIS IS THE RULING THAT MOST
CHANGES THE DESIGN.** `SetReconciliationOutcome`'s `ok: false` arm carries **no residue, no
`refusedAtAdmission`, no ambiguities, no reader requests, no post-conditions** — in the module whose §6
banner is literally `RESIDUE — the product` (`model/reconciliation.ts:2148` region). Both operands
(`lineCount`, `total`) are **counterparty-controlled content parsed from the file's last row.** A
supplier writing `lineCount: 41` for a 40-row file would discard the **other side's** admitted rows
too. That is a one-cell kill switch on the whole close, handed to the party being reconciled against.

```ts
  /** C18, and the ONE arm that may refuse. A format declared to carry a trailer
   *  arrived without one, which is exactly what truncation looks like — so there
   *  is no sound ledger to produce and no residue worth preserving. Argued for
   *  ITSELF; the five comparison arms are post-conditions, because a wrong number
   *  in a trailer must not delete a correct residue. */
  | { kind: 'control_total_expected_but_absent'; side: PopulationSide; sourceDocumentId: SourceDocumentId }
```

**(h) `model/reconciliation.ts:2708` — `PostconditionFailure` gains the five**, and
`ResidueCause` (`model/reconciliation.ts:2148`) gains `{ kind: 'control_total_unverified' }` so the
affected document's rows carry the reason on the row an operator reads.

**(i) The body.** C18 runs after the C17 early return; per document in supplied order; line count
against **presented** rows; the total compared **only** when no row of that document refused; the
`sumGross` empty case now returns `no_items` rather than a false `currency_mismatch`.

### 6.3 What it refuses, and what fails closed

| Condition | Outcome |
|---|---|
| type says `always`, parser found none | 🛑 **run refusal** `control_total_expected_but_absent` |
| parser arm disagrees with the type | post-condition + `ResidueCause` — the checked component cannot switch the check off |
| declared count ≠ presented rows | post-condition + `ResidueCause` — **the residue survives** |
| a row of that document refused | `control_total_unverifiable_rows_refused` — **and NOT** a disagreement verdict |
| trailer in another currency | `control_total_not_evaluable` — a named refusal, never a wrong verdict |
| declared total ≠ summed | post-condition, carrying **both exponents** |

### 6.4 The fixture

🛑 **A required field on `SourceDocument` goes RED at four construction sites immediately** — and at
`npm test` / `typecheck:tests`, **not** at `npm run typecheck`, because `model/` constructs none:
`tests/scenarios/recon-corpus.ts:250` (`doc()` — **one site, 22 scenarios**),
`tests/model/reconciliation-conservation.test.ts:145`, `tests/model/reconciliation-passes.test.ts:120`,
`tests/model/learned-dispositions.test.ts:151`.

⚠️ **Setting `{ kind: 'not_declared_by_format' }` in `doc()` puts 22 of 24 scenarios on the OFF arm.**
That is truthful — these synthetic files carry no trailer — and it is also why the DocumentType binding
in (c) is load-bearing: without it, the corpus would be exercising the disabled path almost
exclusively.

New scenarios: **F7** `truncatedShredIsCaughtByTheTrailer` · **F8**
`trailerShreddedAsATransactionIsCaughtTwice` (**two** defects, in order — the witness that the array
carries many) · **F9** `controlTotalDisagreesIsAPostcondition` · **F10**
`missingTrailerOnAFormatThatCarriesOneRefuses` · **F11** `controlTotalUnverifiableWhenARowRefused` ·
**F12** `trailerInAnotherCurrencyIsNotAMismatch` · **F6 restated with a declared trailer**, so the C17
early return is **witnessed** rather than masked · **F12b** `headerAndLinesTogetherIsCounted`, closing
the gap `tests/scenarios/recon-corpus.ts:3559` names.

### 6.5 The mutation

| Mutation | Expected red |
|---|---|
| **(a) Compare the count against ADMITTED instead of PRESENTED** | F11 reports `declared_line_count_disagrees` instead of `control_total_unverifiable_rows_refused`. ≈ 2. **Distinguishes truncation from unreadability — §5.1 in one line.** |
| **(b) Skip the total when a row refused** (`continue`) | F11 passes with an unverified total. ≈ 3–4. |
| **(c) Treat `expected_but_absent` as `not_declared_by_format`** | F10 passes. ≈ 3–4. **The §8.6 fail-open shape restored by a single `continue`** — which is the argument for the three-arm union. |
| **(d) Collapse the union to the nullable pair** | 🛑 **F10 becomes INEXPRESSIBLE — the fixture cannot be written and the suite fails to COMPILE.** A control whose counter-example you cannot write is the strongest form. |
| **(e) Drop the count check, keep the total** | F7 passes; F8 reports one defect instead of two. ≈ 3. Witnesses that the two comparisons are independent. |
| **(f) Route the five comparison arms back into the refusal** | F9 and F11 lose their residue entirely. ≈ 4–6. **This mutation protects a DECISION, not a mechanism.** |

### 6.6 Commit boundary — split, on the five-file cap

**Commit ③a (types only)** — `model/domain.ts`, `tests/scenarios/recon-corpus.ts`,
`tests/model/reconciliation-conservation.test.ts`, `tests/model/reconciliation-passes.test.ts`,
`tests/model/learned-dispositions.test.ts`. **5 files — at the cap.**
🛑 **Say out loud in the commit message that a green run here proves NOTHING** (§5.10). The four
`TS2741`s are the only evidence the field landed.

**Commit ③b (the checks)** — `model/reconciliation.ts`, `tests/scenarios/recon-corpus.ts`,
`tests/scenarios/export-surface.test.ts`. **3 files.**

---

## 7. STEP ④ — C13, the conformance floor, which must SPLIT

### 7.1 What is true at the tree today

`admitPopulation` (`model/reconciliation.ts:1181`) accumulates `RefusedItem`s and **carries on**, then
returns `{ admitted, refused }`. **A run in which most rows refused returns `ok: true` with a ledger
that is internally perfect over the minority that parsed.** Nothing in §9 can see it: every
`PostconditionFailure` arm (`model/reconciliation.ts:2708-2714`) is a count or comparison **within**
the admitted set.

✅ **The corpus already contains the case, reported SOUND.** `unclassifiedFieldFailsClosed`
(`tests/scenarios/recon-corpus.ts:1946`) refuses **the whole right population** — one row, one refusal
— and expects `postconditions: SOUND`.

### 7.2 The split, and both halves of it are corrections

🛑 **(a) THE CONFIGURABLE RATE CEILING IS A REFUSAL — AND THE GATE MUST REFUSE THE OFF-SWITCH.** The
obvious gate admits `[0, 10_000]`. At `10_000` the test `refused × 10000 > 10000 × (admitted + refused)`
reduces algebraically to `admitted < 0`, **unsatisfiable for a `.length`** — so a gate that exists to
require a bound would **certify *off* as *stated*.** That is §5.2 wearing a required-field costume, and
the tree's posture one bound above is the opposite: `SIMILARITY_MAX_CHARS_CEILING = 512`
(`model/reconciliation.ts:2840`) with a gate that **refuses above it**.

🛑 **AND THE REMEDIATION MUST NOT BE "SWITCH IT OFF".** A prior plan documented *"re-run with the
ceiling at 10000 and read the refusals"* as the operator's procedure. **That sentence is refused and
must not reappear.** What replaces it: the observed rate becomes a **recorded fact, unconditionally** —
`exhaustedBuckets`' posture under G114, where a bound that was hit is recorded and never silently
absorbed. **A permissive ceiling can then suppress the REFUSAL and can never suppress the EVIDENCE**,
which makes the remediation *read the rate*, not *disable the control*. **This needs no number from
anybody.**

🛑 **(b) THE WHOLLY-REFUSED CASE IS A POST-CONDITION, NOT A REFUSAL.** Refusing **deletes the residue**,
and `unclassifiedFieldFailsClosed` is the corpus scenario **whose entire point** is that a G106 refusal
lands in the residue *with its reason attached*. A refusal there would delete the only useful output of
the run. **The rejected alternative is recorded rather than dropped:** a third result channel
(`SetReconciliationResult.populationFindings`) was considered and refused, because a channel with no
caller obligation is C13 one layer up — whereas `postconditions` already carries the stated obligation.

### 7.3 The exact declarations

**(a) `model/reconciliation.ts:2694` — `SetReconciliationInput` gains the ceiling.**

```ts
  /**
   * C13 — THE ADMISSION FLOOR, AS A CEILING ON THE REFUSAL RATE. Required, no
   * default, integer basis points in [0, 10000).
   *
   * 🛑 THE UPPER BOUND IS EXCLUSIVE AND THAT IS THE WHOLE CONTROL. At 10000 the
   * comparison reduces to `admitted < 0`, which is unsatisfiable — so a gate
   * admitting it would certify OFF as STATED, which is §5.2 wearing a
   * required-field costume. `SIMILARITY_MAX_CHARS_CEILING` is the tree's own
   * precedent for a gate that refuses ABOVE a bound and not only below it.
   *
   * BASIS POINTS BECAUSE THIS MODULE ALREADY COUNTS IN THEM —
   * `levenshteinBasisPoints` and `ReaderVerdict.confidenceBasisPoints`. A second
   * rate unit would be §5.3.
   *
   * THE VALUE IS THE OWNER'S (O-8) and is FDE-set pack configuration in the
   * `FieldSpec.confidenceFloor` posture — never a constant here (`PRODUCT.md`).
   *
   * ⚠️ THE REMEDIATION IS "READ THE RATE", NEVER "RAISE THE CEILING".
   * `admissionRates` below is recorded UNCONDITIONALLY, so a permissive ceiling
   * suppresses the refusal and never the evidence.
   */
  readonly admissionRefusalCeilingBasisPoints: number
```

**(b) `model/reconciliation.ts:2718` — `SetReconciliationResult` gains the unconditional fact.**

```ts
  /**
   * C13. What admission actually did, per side, ALWAYS — whether or not the
   * ceiling was breached, and whether or not one was set permissively. G114's
   * posture: a bound that was hit is recorded, never silently absorbed.
   */
  readonly admissionRates: readonly {
    readonly side: PopulationSide
    readonly presented: number
    readonly admitted: number
    readonly refused: number
  }[]
```

**(c) The gate**, appended to the bounds block — immediately after the `subset_sum_bound_not_stated`
return at `model/reconciliation.ts:2874`, and before the per-side loop at `model/reconciliation.ts:2877`:

```ts
  const ceiling = input.admissionRefusalCeilingBasisPoints
  if (!Number.isInteger(ceiling) || ceiling < 0 || ceiling >= 10_000) {
    return { ok: false, refusal: { kind: 'admission_refusal_ceiling_not_stated' } }
  }
```

with `| { kind: 'admission_refusal_ceiling_not_stated' }` on `SetReconciliationRefusal`.

**(d) The `PopulationDefect` arm** — note `sideRowCount`, a different denominator from C18's
`documentRowCount`, and the docblock sentence that forbids aggregating across arms:

```ts
  /**
   * C13's configurable half. CROSS-MULTIPLIED, NEVER DIVIDED:
   * `refused × 10000 > ceiling × presented` is exact integer arithmetic, and this
   * module never divides. Strictly `>`, so a rate AT the stated ceiling is
   * admitted.
   *
   * ⚠️ `sideRowCount` COUNTS ROWS ON THE WHOLE SIDE. C18's arms carry
   * `documentRowCount`, which counts rows in ONE DOCUMENT. Nothing may sum, max,
   * average or render "rows presented" across arms of this union: they are
   * different denominators and one field name for both would be §5.3 inverted.
   */
  | {
      kind: 'admission_refusal_rate_above_ceiling'
      refusedCount: number
      sideRowCount: number
      ceilingBasisPoints: number
    }
```

**(e) `checkPostconditions` gains its missing operand.** 🛑 **The wholly-refused property has no
operand today.** `checkPostconditions(state, residue)` receives a `state.items` that holds **only
admitted items**, so the property is reverse-engineerable from the residue alone — which is §5.1
(keying on the residue's *happening* to hold refused rows) and **cannot distinguish a wholly-refused
side from an empty one.** The counts already exist; `admitPopulation` computes them.

```ts
export function checkPostconditions(
  state: MatchingState,
  residue: readonly ResidueEntry[],
  admission: readonly {
    readonly side: PopulationSide
    readonly presented: number
    readonly admitted: number
    readonly refused: number
  }[],
): readonly PostconditionFailure[]
```

```ts
  /**
   * C13's non-configurable half. Every row on this side was presented and none
   * was admitted, so the ledger is sound over NOTHING. Not a refusal: refusing
   * would delete the residue, and the residue with its per-row reasons IS the
   * output an operator needs here.
   */
  | { kind: 'population_wholly_refused'; side: PopulationSide; sideRowCount: number }
```

**(f) 🛑 `SetReconciliationResult.postconditions`' own sentence must widen IN THE SAME COMMIT.**
`model/reconciliation.ts:2729` reads *"Non-empty means the run produced an unsound ledger. Do not
persist it."* With `population_wholly_refused` on the union that is **no longer true** — the ledger is
sound, over less than everything. It becomes:

```
 * Non-empty means EITHER the ledger is unsound OR the population it was computed
 * over is not the population. Two properties on one channel, argued here rather
 * than done quietly: a third result channel was refused because a channel with no
 * caller obligation is C13 one layer up. Step ⑥ is what makes the second property
 * actionable rather than merely visible.
```

**Leaving that sentence unchanged files the new arm under a claim it does not make.**

### 7.4 What it refuses, and what fails closed

| Condition | Outcome |
|---|---|
| ceiling unset, non-integer, negative, **or ≥ 10000** | 🛑 run refusal `admission_refusal_ceiling_not_stated` |
| refusal rate **above** the stated ceiling | run refusal via `population_integrity_refused` |
| refusal rate **at** the ceiling | admitted — the comparison is `>`, not `>=` |
| **every** row on a side refused | ✅ **`ok: true`, post-condition `population_wholly_refused`, residue intact with every reason** |
| `presented === 0` | 🛑 **no rate arm fires** — no denominator, no rate. That case is step ⑤'s. |
| any run at all | `admissionRates` recorded, unconditionally |

### 7.5 The fixture

**F13** `refusalRateAboveTheStatedCeilingRefuses` (four rows, two unclassified, ceiling 2500) ·
**F14** `refusalRateAtTheCeilingIsAdmitted` (same fixture, ceiling 5000 — the `>` vs `>=` boundary) ·
**F14b** `ceilingOfTenThousandIsRefused` — 🛑 **the off-switch guard; without it the exclusive bound has
no witness** · **F15** `unclassifiedFieldFailsClosed` **amended** (`tests/scenarios/recon-corpus.ts:1946`):
`postconditions` moves from `SOUND` to `[{ kind: 'population_wholly_refused', side: 'right', sideRowCount: 1 }]`.
⚠️ **An expectation change on a hand-derived scenario — its `derivedFrom` must cite C13, or it is
indistinguishable from the thing the corpus header bans.** · **F16**
`wholeRunRefusedStillProducesTheResidue` — `ok: true`, non-empty residue, every reason present.
**This is the scenario that goes red if somebody "hardens" C13 into a refusal.**

⚠️ **`RunSpec` (`tests/scenarios/recon-corpus.ts:370`) and `runInput` (`:389`) gain the ceiling.** The
corpus constant **may not be 10000** — that value is now illegal at the gate. Pick a value that admits
the 22 existing scenarios and carries the corpus's standing disclaimer verbatim: *fixture choices sized
to make the scenarios legible; not a recommendation, and no document may cite one as one.*

### 7.6 The mutation

| Mutation | Expected red |
|---|---|
| **(a) Default the ceiling** (`?? 10_000`) | F14b and F4-shaped refusal pass. ≈ 1–2. |
| **(b) `>=` instead of `>`** | F14 refuses. ≈ 1. An off-by-one on a threshold that decides whether a close runs. |
| **(c) Admit `10_000` at the gate** | F14b passes. ≈ 1. **The off-switch, restored.** |
| **(d) Make `admissionRates` conditional** on the breach | a fixture asserting the rate on a clean run goes red. ≈ 1–2. **This is what keeps the evidence unsuppressable.** |
| **(e) Delete `population_wholly_refused`** | F15. ≈ 1. |
| **(f) Promote `population_wholly_refused` to a refusal** | 🛑 F16 fails — no residue is produced. ≈ 3–4. **This mutation protects a DECISION, not a mechanism: it is what stops the next reader "hardening" C13 into something that deletes the product.** |
| **(g) Divide instead of cross-multiplying** | ⚠️ **may well stay GREEN, and I am saying so.** The reason to cross-multiply is that this module never divides — a robustness argument, not a witnessed one at these fixture sizes. **Do not record it as a passing mutation.** |

### 7.7 Commit boundary

**Commit ④** — `model/reconciliation.ts`, `tests/scenarios/recon-corpus.ts`,
`tests/scenarios/engine-behaviour.test.ts`, `tests/model/reconciliation-conservation.test.ts` (the
third `checkPostconditions` parameter reaches its five direct call sites). **4 files.**

---

## 8. STEP ⑤ — O-15, an empty population REFUSES

### 8.1 What is true at the tree today

✅ **Verified by reading, and it is worse than it sounds.** `admitPopulation`
(`model/reconciliation.ts:1181`) iterates `documents`; an empty array means the loop body never runs.
`SetReconciliationRefusal` (`model/reconciliation.ts:2697`) has **seven arms** and none is this.
`checkPostconditions` iterates `state.items.values()` (`model/reconciliation.ts:2770`) accumulating
from **zero**, so `admittedMinor !== accountedMinor` (`:2794`) compares `0 !== 0` and **every
conservation check passes trivially over an empty set.** All five `PostconditionFailure` arms are
`count > 0` tests.

🛑 **So a statement that failed to parse, an endpoint that returned nothing, or a mapping that refused
every row currently reports a clean, fully-reconciled close over nothing.** The load-bearing arm's own
comment says *"See §5's note on why conservation is a tautology"* — over an empty set it is a tautology
in the strongest sense.

⚠️ **AND THE ADJUDICATION RECOMMENDED THE OPPOSITE.** It recommended a `population_empty`
**post-condition**, on the same argument as `population_wholly_refused` — *the residue must survive.*
🛑 **The owner ruled a REFUSAL.** This plan builds the refusal. The recommendation is preserved here
rather than dropped, because a reader who finds the adjudication first will otherwise think this step
contradicts the record. **It does not; it follows the later and higher authority.** The counter-argument
is real and is answered by the fact that an empty side has **no residue to survive**: there are no rows
to carry a reason. That is exactly what distinguishes it from `population_wholly_refused`, where there
are.

### 8.2 The exact declarations

🛑 **THE ESCAPE MUST BE A DECLARED EXPECTATION, NOT A CALLER-SUPPLIED FLAG.** A new tenant's first run,
or a dormant account, genuinely needs a way to say *"zero is expected here"* — and a boolean parameter
on the call is §5.2 exactly: **an off-switch on the check, reachable by anyone who finds the refusal
inconvenient.** It is declared on configuration, where it is FDE-set and auditable.

**(a) `model/reconciliation.ts:1018` — `PopulationBinding`.**

```ts
  /**
   * → `PopulationSpec.emptyExpectation` under DP-2. Required.
   *
   * O-15. Whether a side that presents ZERO rows is expected to. `refuses` is the
   * posture; `permitted` is a DECLARATION an FDE makes in advance about a source
   * genuinely capable of being empty — a dormant account, a new tenant's first
   * close.
   *
   * 🛑 IT IS A DECLARATION AND NOT A PARAMETER, AND THE DIFFERENCE IS THE WHOLE
   * CONTROL. A boolean argument on `runSetReconciliation` would be §5.2 — an
   * off-switch on the check, reachable by whoever finds the refusal inconvenient
   * at 2am on close day. Declared on the binding it is FDE-set, auditable, and
   * attached to the SOURCE rather than to the call.
   *
   * ⚠️ NOT A BOOLEAN, for the same reason `ToleranceDirection` is not: the
   * literal union reads at the call site and a third posture is addable without
   * inverting a flag's meaning.
   */
  readonly emptyExpectation: 'refuses' | 'permitted'
```

**(b) `model/reconciliation.ts:2697` — the eighth refusal arm.** The `_not_stated` family is the
naming precedent — `grep -n '_not_stated' model/reconciliation.ts | wc -l` → 8, four declared arms and
four refusal sites, each a bound that refuses on absence with a named arm.

```ts
  /**
   * O-15. A population presented ZERO rows and its binding did not declare that
   * zero is expected.
   *
   * 🛑 IT REFUSES RATHER THAN REPORTING, AND THE ASYMMETRY WITH
   * `population_wholly_refused` IS DELIBERATE. A wholly-refused side has rows,
   * each carrying its own reason, and the residue is the product — so refusing
   * there would delete the output. An EMPTY side has no rows and therefore no
   * residue to preserve: there is nothing to carry a reason and nothing to
   * operate on. Every conservation post-condition accumulates from zero, so a
   * clean close over nothing is today indistinguishable from a clean close.
   */
  | { kind: 'population_empty_and_not_expected'; side: PopulationSide }
```

**(c) The gate**, in the same per-side loop as C16's:

```ts
    const documents = side === 'left' ? input.leftDocuments : input.rightDocuments
    let presented = 0
    for (const document of documents) presented += presentedRowCount(document)
    if (presented === 0 && binding.emptyExpectation === 'refuses') {
      return { ok: false, refusal: { kind: 'population_empty_and_not_expected', side } }
    }
```

⚠️ **It reuses `presentedRowCount` from step ③.** Counting documents rather than rows would report a
side holding one document of zero lines as non-empty.

### 8.3 What it refuses

| Condition | Outcome |
|---|---|
| zero rows presented, `emptyExpectation: 'refuses'` | 🛑 run refusal `population_empty_and_not_expected` |
| zero rows presented, `emptyExpectation: 'permitted'` | run proceeds; `admissionRates` records `presented: 0` |
| rows presented, all refused | **not this arm** — C13's `population_wholly_refused` |

**The cost accepted:** onboarding a genuinely empty source now requires a declaration before the first
run succeeds. Real friction, and the same friction the other declared bounds already accepted.

### 8.4 The fixture

**F17** `emptyPopulationRefusesTheRun` — a `RefusalScenario`, `leftDocuments: []` ·
**F18** `emptyPopulationIsAdmittedWhenDeclaredPermitted` — the same input with
`emptyExpectation: 'permitted'`; assert `ok: true`, `admissionRates[].presented === 0`, and 🛑 **that
`population_wholly_refused` is ABSENT** — which is what proves the two arms partition rather than
overlap · **F19** `documentWithZeroLinesIsNotAnEmptyPopulation` — one header-grain document, the
`presentedRowCount` guard.

`ledgerBinding` / `bankBinding` (`tests/scenarios/recon-corpus.ts:312`, `:331`) gain
`emptyExpectation: 'refuses'` — truthful for all 22 scenarios and it is the posture, not a default.

### 8.5 The mutation

| Mutation | Expected red |
|---|---|
| **(a) Delete the gate** | F17 passes with a clean close over nothing. ≈ 1–2. |
| **(b) Make `emptyExpectation` a parameter on `runSetReconciliation`** | ⚠️ **turns nothing red — and that is the finding.** §5.2 is not a mechanical defect; it is a *reachability* defect, and no fixture can witness it. **Say so rather than claiming coverage.** The control against it is the type's location, not a test. |
| **(c) Count documents instead of rows** | F19 refuses. ≈ 1. |
| **(d) Fire `population_wholly_refused` at `presented === 0`** | F18. ≈ 1. Keeps the two arms disjoint. |

### 8.6 Commit boundary

**Commit ⑤** — `model/reconciliation.ts`, `tests/scenarios/recon-corpus.ts`. **2 files.**

---

## 9. STEP ⑥ — O-16, INCOMPLETE as an outcome distinct from inconsistent

### 9.1 What is true at the tree today

✅ Every post-condition is an **internal-consistency check over the admitted set**, and none compares
that set against the outside world: `checkPostconditions` (`model/reconciliation.ts:2749`) iterates
`state.items.values()` (`:2770`) and all five arms (`:2708-2714`) count within that map. **So the
engine can say *"what I was given balances"* and never *"I was given everything"*** — which is how a
partial load reports a clean close. Steps ③ and ⑤ both now produce completeness facts with nowhere to
go.

Run status is **four states** — `model/domain.ts:2717`:

```ts
  status: 'queued' | 'running' | 'completed' | 'failed'
```

and `incomplete` is neither `completed` nor `failed`, which is why it needs its own state rather than a
flag on `completed`.

> ✅ **SHIPPED 16 Aug 2026 — the block above is this plan's PREMISE and is left standing as the
> observation it was.** Both of its claims are now false of the tree: the union is **five** states,
> `queued | running | completed | failed | incomplete`, and it is no longer inline on
> `ReconciliationRun.status` but named `RunStatus` (`7ed3966d`), which is what made it pinnable.
> ⚠️ The citation `model/domain.ts:2717` is dead **and still resolves** — to a doc-comment line about
> `disabled`/`retired` in a different declaration. Derive it:
> `grep -n 'export type RunStatus' model/domain.ts`. §9.3's proposed placement —
> `SetReconciliationResult.completeness` — is what landed, with `POSTCONDITION_PROPERTY` and
> `terminalRunStatus()` beside it. §9.3's OTHER proposal, collapsing the two wire copies into one
> minted `RunStatus` schema, **did not land**: it moves the pinned pair's target and belongs in a
> `tools/` commit that re-witnesses the pair RED.

### 9.2 🛑 The sequencing constraint, and a tree finding that changes how it is met

The wire pair for run status is **NOT** among the checker's five pinned pairs — `subject_location`,
`live_policy_kind`, `service_notice_kinds`, `meters`, `retention_classes`. **So it must be pinned
BEFORE the third state ships**, or model and wire drift silently while `npm run check` stays green.

⚠️ **The precedent is `policy_subject`, recorded at `docs/HANDOFF.md:2201`. It is NOT G75** — G75 is
the `secret`-into-`PERMITTED_RESOURCES.delivery` ruling and has nothing to do with the wire mirror. The
finding is real; the attribution that has been circulating is not.

The owner has ruled the checker is **EXTENDED with a `literal_union` source kind** rather than replaced
with a real YAML parser for now — an amendment to G109 — and that the new kind must be **verified RED
first**.

🛑 **AND HERE IS THE TREE FINDING THAT CONTRADICTS THE BRIEF AS STATED.** The checker's existing source
kinds are addressed **by type name**. ✅ Verified: `grep -nE "RunStatus|RunState|RunOutcome" model/*.ts`
returns **nothing** — `ReconciliationRun.status` is an **inline literal union on a property**, with no
named type alias and no `as const` object anywhere. **A `literal_union` kind keyed on a type name has
no name to key on and cannot reach it.**

There are two ways out and they are not equivalent:

- ❌ **Mint `export const RUN_STATUSES = {…} as const`.** This needs **no checker change at all** — the
  existing `const` kind already handles it. Tempting, and it is **not what the owner ruled.**
- ✅ **Mint `export type RunStatus = …` and point `ReconciliationRun.status` at it.** The
  `literal_union` kind then has a name, the owner's ruling stands as taken, and the vocabulary stops
  living in **three** unjoined places — `model/domain.ts:2717`,
  `docs/contracts/capability.openapi.yaml:2592` and `docs/contracts/capability.openapi.yaml:312`, which
  is §5.3 and exactly the class this checker exists to catch.

**This plan takes the second.** It honours the ruling rather than routing around it, and it is the one
that closes the §5.3 hole. ⚠️ **Note the second wire occurrence at
`docs/contracts/capability.openapi.yaml:312` — a query parameter, not the `Run` schema. Neither
occurrence is a named schema, so the pair needs a `RunStatus` schema minted on the wire too, or the
checker pins one copy and the other drifts.**

### 9.3 The exact declarations

**Commit ⑥a — `tools/check-wire-mirror.mjs`, verified RED first.** A `literal_union` extractor
(`unionKinds` cannot be reused: it matches `kind: '…'` only, so a bare literal union yields an empty
array and the checker would **compare `[]` against the wire and report "extra" while asserting
nothing** — §5.6, inside the tool written to catch it); a `case 'literal_union':` in the dispatch; the
source-kind docblock; and the `PAIRS` entry. Plus `RunStatus` minted as a **named schema** in
`docs/contracts/capability.openapi.yaml`, `$ref`'d from both occurrences.

🛑 **RED FIRST, AND THE ORDER IS THE POINT.** Pin the pair while the model still says four and the wire
still says four → **green**. Then add `incomplete` to the model **only** → the checker must go **RED**.
Only then move the wire. **A pair that has never been seen red is a pair that may be asserting
nothing.**

**Commit ⑥b — `model/domain.ts:2717`.**

```ts
/**
 * O-16. A run's lifecycle, and the third terminal state.
 *
 * 🛑 `incomplete` MEANS SOUND OVER LESS THAN EVERYTHING, AND IT IS NOT
 * `completed` AND NOT `failed`. *Inconsistent* — `SetReconciliationResult
 * .postconditions` non-empty on a soundness arm — means the ledger must not be
 * persisted. *Incomplete* means the ledger is sound but the population it was
 * computed over is not the population. Collapsing them would either DISCARD a
 * sound partial result or PERSIST an unsound one, and they are different acts for
 * different people.
 *
 * ⚠️ NAMED, NOT INLINE, AND THAT IS WHAT MAKES IT CHECKABLE. As an inline union
 * on a property this vocabulary lived in three unjoined places — here and twice
 * in `docs/contracts/capability.openapi.yaml` — with nothing comparing them
 * (§5.3). A named type is what `tools/check-wire-mirror.mjs`'s `literal_union`
 * source kind can address.
 */
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'incomplete'
```

```ts
  status: RunStatus
```

**And the producer**, on `SetReconciliationResult` — 🛑 **distinct from `postconditions`, because O-16's
whole ruling is that the outcome is DISTINCT:**

```ts
  /**
   * O-16. What the engine could not establish about COMPLETENESS, as opposed to
   * about soundness. Non-empty maps to `RunStatus.incomplete`; it does NOT mean
   * do-not-persist.
   *
   * 🛑 A THIRD CHANNEL WAS REFUSED ONCE, ON THE GROUND THAT A CHANNEL WITH NO
   * CALLER OBLIGATION IS C13 ONE LAYER UP. That objection is answered rather than
   * ignored: this channel HAS an obligation and it is stated — it terminates in
   * `RunStatus.incomplete`, which is a different act for a different person.
   * Folding it into `postconditions` would make the outcome indistinguishable
   * from unsoundness, which is precisely what O-16 rules against.
   */
  readonly completeness: readonly CompletenessFinding[]
```

⚠️ **`SetReconciliationResult` and `ReconciliationRun` are different objects and only the caller joins
them.** The engine has no clock and no identity; it reports the finding and the caller sets the status.
**Anything claiming the engine sets a run status would be claiming enforcement over zero call sites.**

⚠️ **The owner explicitly left open whether this lands on `status` or beside `postconditions`.** This
plan proposes **both, with different jobs** — the finding beside `postconditions`, the state on
`status` — and flags it at §12 as the one placement decision that is the owner's, not this plan's.

### 9.4 The fixture and the mutation

`tests/tools/check-wire-mirror.test.mjs` **already exists** and is where the new source kind is
witnessed — including a fixture whose model side is a bare literal union and whose wire side differs,
asserting the checker **reports** rather than silently comparing an empty list.
`tests/contracts/g75-wire.test.ts` is the shape for a model↔wire enum test.

**Mutation:** remove `incomplete` from the wire enum only. `npm run check:wire` must go red. If it stays
green, the pair is pinned at the wrong path and asserts nothing.
**Second mutation:** make the `literal_union` extractor return `[]`. Every pair using it must go red;
if any stays green, it is comparing nothing against nothing.

### 9.5 Commit boundary

**Commit ⑥a** — `tools/check-wire-mirror.mjs`, `tests/tools/check-wire-mirror.test.mjs`,
`docs/contracts/capability.openapi.yaml`. **3 files.**
**Commit ⑥b** — `model/domain.ts`, `model/reconciliation.ts`, `docs/contracts/capability.openapi.yaml`,
`tests/scenarios/recon-corpus.ts`, `tests/scenarios/engine-behaviour.test.ts`. **5 files — at the cap.**

---

## 10. What this wave does NOT do

Stated plainly, so nobody reads it as more than it is.

- **It builds no application.** There is still no database, no schema, no migration, no endpoint and no
  CI. These are types and total functions in `model/`, plus fixtures.
- **It does not implement cross-run duplicate detection.** C17 is an **address** control.
  `unique_within` remains without an evaluator, and whether the product ships without cross-run
  duplicate-invoice detection is the owner's, not this plan's — `docs/domain-model.md` currently says
  it ships.
- **It does not validate that a currency is a currency.** `MoneyUnit` checks *stated*, never *member*.
  There is no ISO 4217 table anywhere and this wave does not mint one (`PRODUCT.md`).
- **It does not land the money codec.** G65 and G111 stay unapplied; `amountMinor` stays `number`. This
  wave adds **no new read** of the representation outside §3. ⚠️ `model/canonical.ts:66` will still
  assert a `bigint` world that does not exist.
- **It does not parse a trailer.** C18 consumes a `ControlTotal` the parser produced. Producing one is
  ingestion's, and nothing in this repository produces one today — so **every C18 arm ships with zero
  production producers**, and the fixtures are the only thing exercising them.
- **It does not set a run's status.** The engine reports a completeness finding; the caller joins it.
- **It sets no number.** Every bound is FDE-set configuration that refuses on absence. The corpus
  constants are fixture choices and no document may cite one as a recommendation.
- **It closes no G row.** Neither O-15 nor O-16 has a number, and G132–G166 are drafted and unapplied.
  **Only the product owner places a G row.**
- **It does not add `model/` and `tests/` to `tools/check-citations.mjs`'s `TARGETS`.** That widening
  was accepted as cheap and honest — and explicitly **not** as closing the class, because it catches a
  deleted line and cannot catch a moved declaration, which is the whole class. It is its own commit,
  outside this wave. ⚠️ **Every same-file citation written into a docblock in this wave is invalidated
  by the next insertion above it, in the one file class no checker scans. Cite by DECLARATION NAME in
  new docblocks, not by line.**

---

## 11. What could go wrong

### 11.1 The proof inversion landing underneath — ✅ RESOLVED, and here is what it cost

It landed at `77d7277d` **during this investigation**, and moved `admitPopulation` from `:1113` to
`:1181`. **Every citation on this page was re-derived after it.** Had this plan been written against the
earlier tree, roughly forty `file:line` references would have silently pointed at real but wrong lines
— resolving, and therefore invisible to `tools/check-citations.mjs`.

**What would need re-deriving if a comparable commit lands under this plan:** every `file:line` in §3
through §9, and every insertion point. **Nothing structural.** The inverted proof is *stricter*, and
✅ **I verified by compilation that every declaration on this page survives it** (§3.4) — so the risk
was to citations, not to design.

⚠️ **The residual risk is the reverse of the one people expect.** The inverted proof now rejects
`ReadonlySet<string>`, `ReadonlyMap<K, string>`, `Uint8Array`, `() => string` and **any object with no
readable member**. It also rejects `ReadonlyMap<number, number>` — an accepted cost. **So a future arm
that wants to carry a per-document map of counts cannot**, and the C18 arms are per-document *members
of an array* for exactly that reason. Anyone "simplifying" them into a map will find the proof refuses,
and should read this paragraph rather than weakening the proof.

### 11.2 The other concurrent session

`model/observability.ts`, `docs/contracts/control-plane.openapi.yaml` and an untracked
`docs/contracts/data-plane-local.openapi.yaml` are held uncommitted by another session. **None is
touched by this wave** — except that step ⑥a touches `docs/contracts/capability.openapi.yaml`, a
*different* contract file. ⚠️ **`npm test` rewrites `docs/model-graph.json`.** Leave it alone; it is
already modified by that session.

### 11.3 The gate is red before this wave starts, for reasons that are not this wave's

`node tools/check-doc-counts.mjs` reports STALE lines (`CLAUDE.md:90` says **230** drop markers; the
tree says **235**) and there is a wire-mirror test failing. **Neither is wave two's.** The hazard is
that a red gate becomes background noise and a *real* regression from this wave hides in it.
🛑 **Record the exact failing set before commit ①, and compare after every commit.** A red gate whose
red set has not changed is not a green gate.

### 11.4 The corpus is a specification, not a snapshot

`tests/scenarios/recon-corpus.ts` states that every expectation was hand-derived from the spec and that
a failing scenario is *"an open question, not a verdict."* **Three scenarios change their expectations
in this wave** — F2, F6 and F15 — and each is exactly the move the corpus header forbids doing
casually. **Each must cite the new rule in `derivedFrom`, or it is indistinguishable from fixing a test
by running the code.**

### 11.5 The one that would be worst, and it is quiet

🛑 **A control that ships without its witness.** Three arms on this page have **no fixture written
anywhere in the record**: SERIOUS 7's cross-side/tolerance comparison (F4b), C17's both-refused
regression guard (F5b), and C13's off-switch guard (F14b). **All three were ruled and none was
written.** An arm with no fixture is an arm whose mutation turns nothing red — and this wave's whole
argument is that a control whose mutation turns nothing red is not a control. **If a step ships short
of files, drop scope, never the witness.**

### 11.6 Estimate honesty

The red-count estimates in §3.6, §4.5, §6.5, §7.6 and §8.5 are **derived from fixture arithmetic**
(22 scenarios × 10 `it`s in the sweep; 367 tests and 45 suites in `engine-behaviour.test.ts` at HEAD),
**not from a run.** Nobody has executed the suite against these changes because these changes do not
exist. **Whoever applies a step records the real numbers and corrects this page in the same commit.**

---

## 12. What is still the owner's

1. **The placement of O-16's third state.** The owner explicitly did not decide whether *incomplete*
   lands on `status` or beside `postconditions`. §9.3 proposes **both, with different jobs**, and
   argues it — but it is a proposal.
2. **Every number.** The C13 ceiling and the empty-expectation posture per source are FDE-set
   configuration under O-8. This plan sets none and refuses on absence.
3. **The G numbers.** O-15 and O-16 have none. §3.1–§3.12 of the owner rulings need G167 onward, and
   these two sit outside even that range. **A G number is an identity and only the owner places one.**
4. **Whether `unique_within` ships unbuilt**, and with it whether the product ships without cross-run
   duplicate-invoice detection.

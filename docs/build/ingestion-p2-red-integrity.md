# RED — attacking the three integrity changes inside `model/reconciliation.ts`

**Target:** `/private/tmp/.../ingest2/green-integrity.md` (C16 · C17 · C18 · C13)

> *Analysis only. No file in `/Users/jrkphani/Projects/Reconcile` was created, edited or deleted; no
> git command was run.*
>
> **Every `file:line` in this report was opened in this session.** Where I state a control's
> behaviour I state the line the behaviour is on. Counts are derived with the command shown.
>
> ```bash
> git log --oneline -1                                  # f988f2a4
> wc -l model/reconciliation.ts model/domain.ts          # 3405 / 4335
> grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md              # 131
> grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅' # 35  (green is right; the adjudication's 33 is stale)
> ```
>
> **First, the premise-check, because this record strikes attacks that rest on false premises and I
> went looking for one.** I tried to break green's §2.2(c) instruction *"replace `:1024-1026`"* on the
> theory that it deletes a G106 refusal, since the adjudication puts `field_not_classified`'s call
> sites at `:977 / :992 / :1006 / :1024`. **The attack is struck.** At HEAD the G106 sites are
> `model/reconciliation.ts:1015`, `:1030`, `:1044`, `:1062` and `:1024-1025` is the currency check
> (`if (expectedCurrency !== null && gross.currency !== expectedCurrency)`). Green's numbers are
> right and the adjudication's are stale. I re-derived **every** citation green makes in §1 and §2 and
> found no dead one. That matters for how the rest of this report should be read: the defects below
> are design defects, not citation defects.

---

## BLOCKER 1 — C13's ceiling is a caller-supplied off-switch, and the plan documents switching it off as the operator's remediation procedure

**The claim.** `admissionRefusalCeilingBasisPoints` admits a legal, gate-passing value at which the
control it exists to be can never fire. That is §5.2 in its exact form, and G79's ruling —
*"a caller-supplied off-switch on a residency check is §5.2"* — is the standing precedent.

**The evidence.** Green's gate (§2.5, *"The gate"*) accepts `[0, 10_000]`. Green's test is
`input.refused.length * 10_000 > ceiling * presented`, where
`presented = input.admitted.length + input.refused.length`. Substituting `ceiling = 10_000`:

```
refused × 10000 > 10000 × (admitted + refused)   ⟺   refused > admitted + refused   ⟺   admitted < 0
```

`admitted.length` is a length. **The condition is unsatisfiable.** 10 000 is not "the loosest
setting"; it is *off*, and the required-bound gate certifies it as **stated**.

**The tree's own posture is the opposite, on the bound immediately above it.**
`SIMILARITY_MAX_CHARS_CEILING = 512` (`model/reconciliation.ts:2772`) and the gate at `:2786-2792`
**refuses above it** — the existing rule is that a bound's gate refuses the value that makes the
bound meaningless, and its docblock says why: *"a matching-policy decision with money on it, which is
why it is a NUMBER IN A REFUSAL and not a silent clamp."* The corpus follows suit:
`CORPUS_SIMILARITY_MAX_CHARS = 128` (`tests/scenarios/recon-corpus.ts:183`) is strictly inside the
range. Green's §4.1 proposes `CORPUS_ADMISSION_REFUSAL_CEILING_BASIS_POINTS = 10_000` — the
permissive extreme — for **all 22 scenarios**.

**And the plan prints the off-switch as procedure.** Green's own docblock for the field:

> *"⚠️ AND THE COST, STATED. A run refused on this ceiling produces NO residue, so the diagnostic path
> is to re-run with the ceiling at 10000 and read the refusals."*

The documented way to see what a C13 refusal was about is to disable C13. That is not a cost note; it
is an operational instruction to turn the control off, and it will be followed, because it is the only
way to get the residue back.

**Concrete failure.** A pack template for a new bank export states `10_000` — the value green's own
docblock recommends and the value the corpus normalises. 4 000 statement lines arrive; one column was
never classified, so 3 900 rows refuse on `field_not_classified` (`:1015`).
`checkPopulationIntegrity` returns `[]`. `runSetReconciliation` returns `ok: true`.
`checkPostconditions` iterates `state.items` (`:2701`) — 100 rows — and conservation holds exactly.
`postconditions` is empty, which the result type documents as *"Non-empty means the run produced an
unsound ledger"* (`:2661`), so an empty one reads as sound. **The close is signed off over 2.5% of the
file, which is the precise defect C13 was minted to end.**

**The control that closes it, inventing no number.** Split *visibility* from *refusal*. The observed
refusal rate becomes a **recorded fact on `SetReconciliationResult`**, unconditionally — the
`exhaustedBuckets` posture (`:2657-2658`, G114: a bound that was hit is recorded, never silently
absorbed) — so a permissive ceiling can suppress the *refusal* and cannot suppress the *evidence*.
Then C13's remediation is to read the recorded rate, not to disable the control. This needs no number
from the owner and no ruling; O-8 still governs the ceiling itself. **And it needs BLOCKER 2 fixed,
because the floor green calls "cannot be tuned off" is the half with no code.**

---

## BLOCKER 2 — C13's non-configurable half is specified in eleven places and declared in none, and `checkPostconditions` has no operand for it

**The claim.** `population_wholly_refused` — the half green describes as *"No configuration, so it
needs no owner ruling and cannot be tuned off"* (§3b) — is named in green's §1 row 12, §2.5's banner,
§3a step 12, §3b twice, §4's list, F15, F16, mutations 5.4(d) and 5.4(e), §6.3, O-10, O-11 and commit
4. **It is not declared anywhere in §2, the section titled "the design — exact declarations, with file
and insertion point."** There is no new `PostconditionFailure` arm and no change to
`checkPostconditions`'s signature in the plan.

**The evidence.** `export function checkPostconditions(state: MatchingState, residue: readonly
ResidueEntry[])` — `model/reconciliation.ts:2681-2683`. Two arguments. `MatchingState` is
`{ items, allocations }`. `state.items` holds **only admitted items** (`:2705`, the fold at `:2834`).
`PostconditionFailure` (`:2640-2646`) has five arms and none is this one. Mutation 5.4(d) instructs
*"Delete `population_wholly_refused`"* — there is nothing to delete.

**Why it is not merely an omission.** From `(state, residue)` the property is derivable only one way:
count residue entries whose `cause.kind === 'admission_refused'` per side (`:2911-2922`) and observe
that no item in `state.items` carries that side. That is **§5.1** — keying on the fact that the
residue *happens* to hold refused rows, instead of on the property the control protects (admission
presented N rows on this side and admitted 0 of them). And it is decisively incomplete: **it cannot
distinguish a wholly-refused side from an EMPTY side**, which is green's own §6.3 hazard, deferred to
O-10. One missing operand, two open holes, and green files them as two unrelated items.

**Concrete failure.** An implementer follows §2 literally — §2 is the section the plan tells them to
follow — and ships C16, C17, C18 and C13's *refusal*. C13's floor never lands. Combined with
BLOCKER 1, **both halves of C13 are inert on the day the commit is recorded as applied.** That is the
G75 shape exactly: a ruling recorded as applied while a constant nobody named makes it a no-op — here
the constant is `10_000` and the un-named thing is a function signature.

**The control.** `checkPostconditions` takes a third argument — a per-side
`{ presented; admitted; refused }` produced by `admitPopulation`, which already computes all three
(`:1118-1149`). Declare it and the arm in §2 with the rest. Then `population_wholly_refused` and
`population_empty` (O-10) are both computed from admission's own counts rather than reverse-engineered
from the residue, and 5.4(d) has something to delete.

---

## BLOCKER 3 — C18 hands a counterparty a one-cell kill switch on the whole close, and it deletes the residue this module calls the product

**The claim.** Green routes every C18 defect into `population_integrity_refused`, a refusal. A
refusal returns no result at all, so a single wrong number in a supplier's trailer discards the entire
run — including the other side's admitted rows and every per-row reason. **Green refuses exactly this
cost for C13's floor and pays it for C18 without arguing it.**

**The evidence.**
- `SetReconciliationOutcome = { ok: true; result } | { ok: false; refusal }`
  (`model/reconciliation.ts:2666-2668`). On the `ok: false` arm there is no `residue`, no
  `refusedAtAdmission`, no `ambiguities`, no `readerRequests`, no `postconditions`.
- §6's banner is literally **`RESIDUE — the product`** (`:2075-2077`), and `ResidueEntry.settlement`'s
  docblock (`:2100-2119`) is a page-long argument that a row which could not be read must still
  appear with its reason.
- `ControlTotal.declared.total` is a `Money` (green §2.4(a)) and `Money.currency` is a free `string`
  (`model/domain.ts:531-537`). Green's §6.4 states there is no codec: *"the trailer total must be
  constructed by the caller with no shared parser."* So both operands of the comparison —
  `lineCount` and `total` — are **counterparty-controlled content**, parsed from the file's last row.
- Green's call site returns on the **first side with any defect**, so a left-side defect discards the
  right side's diagnostics too.
- Green's own contrary argument, in the §4a banner: *"A refusal there would delete the only useful
  output of the run."*

**Concrete failure.** A supplier's docket generator writes `lineCount: 41` for a 40-row file — or a
trailer total denominated `EUR` against an SGD population. `checkPopulationIntegrity` pushes
`declared_line_count_disagrees` (or `control_total_not_evaluable { currency_mismatch }`). The run
returns `{ ok: false }`. The other side's 4 000 admitted rows, the identifier ambiguities, the reader
requests and every `field_not_classified` reason are gone. The operator's entire artefact for a
month-end close is one refusal naming one document id. **A counterparty who wants a close delayed only
has to be off by one, and the trailer is the cell they control most cheaply.** No authorisation, no
prompt, no injection — just a number.

**The control.** Apply green's own C13 argument to C18. The five *comparison* arms
(`declared_line_count_disagrees`, `declared_control_total_disagrees`,
`control_total_unverifiable_rows_refused`, `control_total_not_evaluable`,
`control_total_declared_nothing`) become **post-conditions** — `postconditions` already carries the
stated obligation *"Non-empty means the run produced an unsound ledger. Do not persist it."*
(`:2661`) — plus a `ResidueCause` on the affected document's rows. The population stays computable
and unpersistable, which is the same safety outcome with the diagnostics intact.
`expected_but_absent` is the one arm with a case for refusing, because there the artefact is
incomplete before any row is read — and that case should be **argued for one arm**, not assumed for
six.

---

## SERIOUS 4 — C17 refuses where the tree already has a named outcome, and the both-refused case is a regression

**The claim.** For a duplicated address whose two copies both refuse at admission, the tree **already**
produces a named outcome with the residue intact. C17 replaces it with a whole-run refusal.

**The evidence.** Every refused row is pushed into the residue (`:2911-2922`).
`checkPostconditions` builds `seen` over **residue** itemKeys (`:2686-2690`) and raises
`item_in_residue_twice { count }` (`:2643`, `:2694`) when any key appears twice. Two refused copies of
one address ⇒ two residue entries ⇒ one and the same itemKey ⇒ `item_in_residue_twice {count: 1}`,
today, with both rows and both reasons in the residue and `postconditions` non-empty. Green's
mutation 5.2(c) explicitly requires `input.refused` in the collision walk, so C17 fires here.

**Concrete failure.** 400 dockets, one re-delivered, both copies refused because a column is
unclassified. **Today:** `ok: true`; residue holds both rows with `admission_refused`;
`postconditions` says do not persist; the shred gets fixed. **Under C17:** `ok: false`; nothing at
all; the operator cannot see which document, which column, or that the *rest of the file* was fine.

**The control.** Refuse only when **at least one copy of a duplicated address was ADMITTED** — that
is the only case that reaches `items.set(item.key, item)` (`:2835`) and loses money. The
both-refused case stays a post-condition, where the tree already puts it. This narrows C17 to the
property it protects instead of to the word "duplicate", which is green's own §5.1 argument turned on
green's own arm.

---

## SERIOUS 5 — the MIXED duplicate-address case is a live conservation defect in the existing tree that neither document names, and it is C17's strongest justification

**The claim.** Where a duplicated address has one copy admitted and one refused, conservation holds
falsely **today**, and an open transaction becomes invisible. This is A9(b) surviving through the fact
that admitted and refused rows share one itemKey namespace.

**The evidence, walked line by line.** Copy B refuses ⇒ residue gets B (`:2911-2922`) ⇒
`seen[itemKey] = 1` (`:2686-2690`). Copy A is admitted ⇒ it is in `state.items`. In
`checkPostconditions`'s loop, `const inResidue = (seen.get(item.key) ?? 0) > 0` (`:2705`) is
**TRUE for A** — but the residue entry is B's, not A's. Therefore:
`accountedMinor += allocated + (inResidue ? minorUnitsOf(residual) : 0)` (`:2716`) credits A's
residual as residue-carried, and `if (!inResidue) missing += 1` (`:2718`) never fires.
`open_item_missing_from_residue` cannot fire and `gross_not_partitioned` balances.

**Concrete failure.** A shredder mints `lineIndex` from insertion order and puts two rows at index 7.
Row 7a parses (SGD 43 000 open receivable); row 7b hits the unclassified column. A finance user opens
the residue, sees **one** row saying *"field not classified"*, and the real open 43 000 is in neither
the residue nor any match group, with `postconditions` empty — a green conservation proof over a
ledger missing a transaction.

**The control, and it is owed independently of C17.** `checkPostconditions`'s `seen` map must not
share a key space between admission-refused entries and settled entries: build it only from residue
entries whose `settlement !== null`, or namespace `itemKey` by disposition. This is its own commit
with its own mutation, because **C17 as designed would mask this rather than fix it** — refusing the
run makes the defect unreachable without making it wrong-proof, and the day somebody narrows C17
(SERIOUS 4 asks them to) it comes straight back.

---

## SERIOUS 6 — `declared_unit_not_stated` is one kind for three causes, and the check reads the money representation below the sentinel that forbids it

**Three defects in three lines.** Green's C16 statedness gate:

```ts
if (unit.currency.length === 0 || !Number.isInteger(unit.exponent) || unit.exponent < 0) {
  return { ok: false, refusal: { kind: 'declared_unit_not_stated', side } }
}
```

**(a) It does not say which.** Every other refusal in this module names the cause: `MoneyRefusal` has
four arms (`:264-268`), `normalisation_invalid` carries a `defects` array (`:2633`),
`strategy_binding_kind_mismatch` carries the index. §5.2's rule is that a gate returns a reasoned
union; this one returns a union with one arm standing in for three distinct operator errors.

**(b) The kind name is false for two of the three.** A negative exponent is **stated and invalid**,
not *not stated*. An operator reading `declared_unit_not_stated` will go looking for a missing pack
field and find a present one.

**(c) It names the money representation below `_MoneySectionEndsHere`.** That declaration
(`:753-762`) states: *"End of §3. Below this line nothing may name the money representation."* The
gate sits at ~`:2809` and reads `unit.currency` and `unit.exponent` — two of `Money`'s three fields —
and does integer validation on one of them. The `money-sentinel` control
(`tests/model/reconciliation-controls.test.ts:308-326`) bans only the literal `amountMinor`, so it
**stays green while the property it protects is breached**, and green's §4 explicitly reassures the
reader that it stays green. §5.1 (keyed on a convenient landmark — one field name — instead of the
property) and §5.6 (a control that passes while asserting nothing) in the same three lines.

**Concrete failure.** G111's codec lands. The migration surface is found by grepping `amountMinor`
and by reading §3, exactly as `:583-595` promises. `binding.declaredUnit.exponent` at the gate is in
neither, so the one place that validates a denomination outside §3 is the one place the migration
misses.

**The control.** `export function guardUnit(unit: MoneyUnit): MoneyRefusal | null` in §3, beside
`guardMoney` (`:594-596`), with two new `MoneyRefusal` arms (`currency_not_stated`,
`exponent_not_a_non_negative_integer`); the gate becomes
`{ kind: 'declared_unit_invalid', side, refusal }`. The sentinel's property holds, the refusal says
which, and G111 finds one more site *inside* §3 instead of one outside it.

---

## SERIOUS 7 — C16 declares a unit per side and never compares the two, nor the tolerance's

**The claim.** C16 creates the operand that makes cross-side denomination checkable for the first
time, and then does not read it. The statedness gate loops per side; nothing compares
`input.left.declaredUnit` with `input.right.declaredUnit`, and nothing compares either with the
tolerance's `Money`.

**The evidence.** Green folds the gate into the existing per-side loop at `:2809-2815` — that loop's
body is per-`binding`, so there is no place in it where both sides are in scope. Downstream,
`toleranceAdmits` (`:713-750`) calls `subtractMoney` → `sameUnit` and returns
`{ ok: false, refusal: { kind: 'money', refusal } }` (`:719`), which is collected into
`toleranceRefusals` and surfaced on the result (`:2960`). **No post-condition inspects
`toleranceRefusals`** — `checkPostconditions` receives only `(state, residue)` (`:2681`). And
`tolerance.value`'s unit is checked against the *delta* (`:736-737`) and against nothing declared.

**Concrete failure.** An FDE configures the bank side as `{ currency: 'SGD', exponent: 0 }` — the
statement reports whole dollars — and the ledger side as `{ currency: 'SGD', exponent: 2 }`. **Every
row on both sides is admitted**, because C16 checks each row against its *own* side's declaration and
that is all it checks. `passIdentifierJoin` joins `INV-1001` on both sides; `toleranceAdmits` refuses
`exponent_mismatch`; nothing allocates; all 8 000 rows land in the residue as `no_strategy_paired` —
*"nothing matched it"*, which is false — and `postconditions` is **empty**, because conservation over
zero allocations is trivially sound. A 100%-fail close reports SOUND with an untrue reason on every
row.

**Why C16 makes this worse rather than neutral.** Today the same error must be in the **file**, where
it shows up in one run and is covered by `twoCurrenciesNeverMatchAcross`
(`tests/scenarios/recon-corpus.ts:1645`). C16 moves the denomination into **configuration**, where the
error is systematic, silent, and repeats on every run of that pack until someone notices the residue
is 100%.

**The control.** Two lines in the gate green already writes: `sameUnit(input.left.declaredUnit,
input.right.declaredUnit)` → `declared_units_disagree { refusal }`, and the same against
`input.pairing.amountTolerance` on its `money` arm. `sameUnit` is the function green widened for
exactly this comparison; C16 widens it and then uses it on one pair out of three.

---

## SERIOUS 8 — the plan writes ~20 same-file line citations that its own insertions invalidate, into the one file class the citation checker does not scan

**The claim.** `tools/check-citations.mjs` does not scan `model/`. Green's new docblocks are dense
with same-file `:NNNN` citations computed against HEAD, and §4a alone inserts ~190 lines at `:1153`,
moving every target below it. The gate cannot see the result.

**The evidence.** `tools/check-citations.mjs:39-57` — `TARGETS` is `CLAUDE.md`, `PRODUCT.md`,
`README.md`, `docs/*.md`, `docs/build/*.md`, `docs/contracts/README.md`. **No `model/*.ts`. No
`tests/`.** Its own header states the limit it cannot exceed: *"It cannot tell whether a citation
points at the RIGHT declaration — only whether it points at anything at all."* The module already
carries three dead-but-resolving citations, two of which green itself found: `:537` and `:542` cite
`model/domain.ts:401` for `Money`, which is declared at `model/domain.ts:531-537` (`:401` is inside
the `ExtractionInSetOutcome` docblock — verified); `:935` cites `model/domain.ts:1931` for
`PopulationSpec`, which opens at `model/domain.ts:2065` — verified.

**Concrete failure.** After commits 1-4, green's `duplicate_item_address` docblock reads *"The fold at
`:2835` would silently `Map.set` the second over the first"*. The fold is then near `:3040` and
`:2835` resolves to a line inside the passes. `npm run check` is green. The next engineer debugging a
lost row follows the citation into the wrong function — the class CLAUDE.md records for
`model/catalog.ts:168` and the adjudication records as the fourth instance. **Green's own §8 lists
four instances of this class as findings and then writes ~20 more.**

**The control.** (a) Add `model/*.ts` and `tests/**/*.ts` to `check-citations.mjs`'s `TARGETS`, as its
own isolated commit — it will go RED on the three existing dead ones, which is the point, and G108
says a checker joins `npm run check` rather than standing beside it. (b) In the new docblocks, cite by
**declaration name**, not by line: *"the fold in `runSetReconciliation`"*, *"`itemKey()`"*,
*"`checkPostconditions`'s admitted-total loop"*. A name survives an insertion; a line does not, and
this plan's whole content is insertions.

---

## SERIOUS 9 — one field name, `presentedCount`, carries three different denominators inside one union

**The claim.** §5.3 — two vocabularies for one concept — inverted: one vocabulary for three concepts,
inside a single `defects` array, in a plan that cites §5.3 nine times.

**The evidence, from green's own code.**
- `declared_line_count_disagrees.presentedCount` = `document.lines.length === 0 ? 1 :
  document.lines.length` — rows in **one document**.
- `control_total_unverifiable_rows_refused.presentedCount` = the same.
- `admission_refusal_rate_above_ceiling.presentedCount` = `input.admitted.length +
  input.refused.length` — rows on the **whole side**.
- F15's `population_wholly_refused.presentedCount` — a third per-side count, in a different union.

**Concrete failure.** `population_integrity_refused.defects` reaches a screen or a checker holding
`declared_line_count_disagrees { presentedCount: 2 }` and
`admission_refusal_rate_above_ceiling { presentedCount: 4000 }`. Anything that sums, maxes, averages
or renders "rows presented" across the array is mixing rows-in-a-document with rows-on-a-side. The
plan's §2.5 says *"ORDER IS PART OF THE CONTRACT"* and says nothing about the field names meaning
different things.

**The control.** Name the grain: `documentRowCount` on the two C18 arms, `sideRowCount` on the C13
arm, and one sentence in `PopulationDefect`'s docblock stating that no numeric field in this union may
be aggregated across arms.

---

## SERIOUS 10 — `not_declared_by_format` is decided by the same actor that produced the rows, and green's fixture plan puts every existing scenario on the OFF arm

**The claim.** C18's entire control is skipped by one arm, and the arm is chosen by the parser — the
same component whose output the control exists to check. Green names the residual (§6.1) and blocks it
on the ingestion module; there is an operand in `model/` today.

**The evidence.** Green's checker opens with
`if (control.kind === 'not_declared_by_format') continue`. Green's §2.4(a): *"The PARSER declares
which arm applies, in the pass that reads the file."* Green's §4.1 sets
`controlTotal: { kind: 'not_declared_by_format' }` in `doc()` (`tests/scenarios/recon-corpus.ts:250-274`)
— **one site, 22 scenarios** — so after the commit the gate exercises C18's OFF arm in 22 of 24
scenarios and its ON arms only in green's six new fixtures.

**And the alternative green rejects is a straw man.** §2.4(a) argues that a per-format registry
*"inside the engine would be a rule keyed on a filename instead of on what the parser actually
found (§5.1)"*. Nobody proposed a filename registry. The declaration belongs on `DocumentType`, which
already declares what kind of artefact this is: `ACQUISITION_FIDELITY` (`model/domain.ts:1782`) and
`DocumentType.expectedFidelity` (`:1801-1807`). Invariant 4's posture — *"Classification is declared
once, on `FieldSpec`, and everything derives from it"* — is the posture green says C16 copies for
denomination. C18 declines it for the trailer, in the same document.

**Concrete failure.** The tier-2 CSV shredder is refactored and stops reading the trailer; it emits
`not_declared_by_format` for every document. **`npm run check` is green** — 22 of 24 scenarios assert
exactly that arm. C18 is inert for every file in production, the G row is ticked applied, and no
control anywhere notices. That is the G75 shape: applied and no-op.

**The control.** `DocumentType` declares whether its format carries a control total;
`checkPopulationIntegrity` raises `control_total_arm_disagrees_with_document_type` when the parser
says `not_declared_by_format` for a type declared to carry one. The parser can then no longer switch
C18 off unilaterally, and the corpus must state which arm it means instead of inheriting the OFF one
from a shared builder.

---

## NOTED 11 — `_MoneyIsAMoneyUnitPlusAnAmount` passes in the direction that matters

`Assert<Money extends MoneyUnit ? true : false>` (`Assert` is at `model/reconciliation.ts:165`,
non-exported, so the alias compiles). It catches `MoneyUnit` gaining a field, and `Money.currency` or
`Money.exponent` changing type. It does **not** catch `Money` gaining a **third** denomination field —
a `scale`, an fx marker, anything G65/G111 might add: `Money extends MoneyUnit` stays true, the
assertion stays green, `MoneyUnit` silently under-specifies a denomination, `sameUnit` compares an
incomplete pair, and `declaredUnit` becomes a declaration that cannot express the population's unit.
Green's docblock claims the line makes drift *"a compile error rather than a silently divergent second
spelling"*; it makes drift in one of the two types a compile error and drift in the other invisible.

**Control:** assert over keys, both directions —
`Assert<[Exclude<keyof Money, 'amountMinor'>] extends [keyof MoneyUnit] ? ([keyof MoneyUnit] extends [Exclude<keyof Money, 'amountMinor'>] ? true : false) : false>`.
One line, same place, and it is the version whose failure mode is the one that matters.

---

## NOTED 12 — the C18 arms carry minor units with no exponent, in the one control whose whole subject is a hundredfold error

`declared_control_total_disagrees { declaredMinor, admittedMinor }` — two numbers, no exponent, no
currency. The currency is forced out by `AssertNoTextDeep` and that is correct (`:275-284`).
`exponent` is a `number` and passes the proof freely. `gross_not_partitioned` (`:2646`) is the
precedent green cites, and it is a *conservation* diagnostic whose two operands are the same unit by
construction and whose consumer is one run. C18's arm is emitted **per document** into a `defects`
array that may hold several documents, and the failure it exists to expose is exactly the exponent
error C16's own docblock calls *"a hundredfold unit error surfacing as a tolerance artefact"*. A human
comparing `1234567` with `12345670` by eye is that failure with an extra step.

**Control:** add `exponent: number` to the two minor-unit arms. Free, passes the containment proof,
and makes the two numbers renderable.

---

## NOTED 13 — the checker keeps counting after C17, and its own docblock says why it must not

Green's `checkPopulationIntegrity` docblock: *"ORDER IS PART OF THE CONTRACT: C17 first (an address
collision makes every later count wrong)"*. The code then falls through to C18 and C13 with **no
early return**. A document listed twice with a declared trailer yields `duplicate_item_address` **plus**
`declared_line_count_disagrees` (presented = 2N against declared N) **plus**
`declared_control_total_disagrees` (the sum doubled) — two of the three false, all three in one
refusal. Green's F6 expectation says *"Same defect"*, singular, and it passes only because the corpus
`doc()` builder sets C18's OFF arm (SERIOUS 10) — the fixture is green for the wrong reason.

**Control:** `if (defects.length > 0) return defects` after the C17 walk, and restate F6 with a
declared trailer so the early return is witnessed rather than masked by a disabled control.

---

## NOTED 14 — C18's row count re-implements admission's branch, and the header-blind drop is the one truncation it cannot see

`document.lines.length === 0 ? 1 : document.lines.length` duplicates `admitPopulation`'s branch at
`:1124`. Keeping the count **independent** of admission is right — it is the
two-independent-sources argument `gross_not_partitioned`'s docblock makes (`:2676-2679`) — but
duplicating the **rule** is not: `KNOWN_GAPS` (`tests/scenarios/recon-corpus.ts:3560`) records that
*"Nothing here reaches a `SourceDocument` with both header fields AND lines. `admitPopulation`
branches on `lines.length === 0`, and a document carrying both is header-blind by that branch."* For
such a document the header transaction is presented by neither admission nor C18's count, so a
trailer declaring `lines.length` **passes** while a transaction was dropped — the exact thing C18 is
sold as the only detector of.

**Control:** one exported `presentedRowCount(document): number` in §4, called by both
`admitPopulation` and `checkPopulationIntegrity` — two independent counts, one rule — plus the
both-header-and-lines scenario `KNOWN_GAPS` already asks for.

---

## NOTED 15 — `sumGross([])` refuses with `currency_mismatch`, and C18 is the first caller that can pass it an empty array

`sumGross` (`model/reconciliation.ts:1463-1465`) returns
`{ ok: false, refusal: { kind: 'currency_mismatch' } }` for an empty list — a reason arm that is
simply false, in a module whose §1 rule is that every failure is a *named* value. `MoneyRefusal` has
no empty arm. In green's code the empty case is unreachable today (`presentedCount` is always ≥ 1, so
`rows.length !== presentedCount` catches it first), and green's own mutation 5.3(b) is one edit from
making it reachable: delete the `control_total_unverifiable_rows_refused` block and a
fully-refused document forwards `control_total_not_evaluable { currency_mismatch }` to an operator
whose actual problem is that no row could be read.

**Control:** `{ kind: 'no_items' }` on `MoneyRefusal`, or `sumGross` returning
`MoneyResult<Money | null>`. Existing-tree fix, cheap, and C18 is the reason it now matters.

---

## NOTED 16 — §1 row 14 claims a reuse the §2 code refutes

Green's §1 row 14: *"`indexBy(items, on)` — the multimap that fixed A9(a) … The grouping idiom I
reuse verbatim to bucket admitted items **by document** for C18."* `indexBy`
(`model/reconciliation.ts:1418-1431`) keys on `item.identifiers.get(on)` where `on: FieldPath` — it
**cannot** bucket by document, and green's §2.5 code correctly hand-rolls a `Map` instead. So the code
is right and the claim is wrong, which matters because §1's stated purpose is *"Nothing below is new
machinery"* — this row is new machinery presented as reuse, and it is the row a reviewer would skip.

**Control:** delete the row or restate it as new.

---

## Where the green team is RIGHT and I could not break it

A red report that attacks everything adjudicates nothing. Six places I attacked and failed, and one
where green corrects the adjudication in a way that changes the build.

1. **Every citation.** I re-derived all of §1 and §2 and found no dead one, including the four where
   green corrects the adjudication and the adjudication is the stale document:
   `_ReaderVerdictHoldsNoTextDeep` is at `:2246` (not `:2208`); the G106 call sites are
   `:1015/:1030/:1044/:1062` (not `:977/:992/:1006/:1024`); `FieldSpec.confidenceFloor` is at
   `model/domain.ts:1764`; applied G rows are **35**, derived. My best attack — that *"replace
   `:1024-1026`"* deletes a G106 refusal — is **struck on its premise**, and I am recording that
   because this record strikes attacks by name.

2. **The C17 sharpening is the most important correction in either document and it holds.** `itemKey`
   is `side:len:id:line` (`:809-813`), so a collision is an **address** collision. The corpus's
   duplicate-invoice scenario keys `INV-3050` at `line(0)` and `line(1)`
   (`tests/scenarios/recon-corpus.ts:1315-1320`) — two addresses, no collision — and is already
   correctly an `AmbiguityFinding`. The adjudication's C17 as written would have had somebody build
   duplicate-invoice detection out of a `Map.set` guard. My SERIOUS 4 and SERIOUS 5 narrow C17; they
   do not touch this.

3. **The three-arm `ControlTotal`, and mutation 5.3(d) is the strongest form of proof in the plan.**
   Collapsing to `lineCount: number | null; total: Money | null` makes F10 **inexpressible** — the
   counter-example fails to compile. I looked for a fourth state the union cannot express (a trailer
   found but unparseable; a trailer whose count is present and non-numeric) and both collapse cleanly
   into `expected_but_absent` or `declared` with a null. It holds.

4. **The money discipline.** No new `Money` literal, no new arithmetic, no new read of `amountMinor`;
   every touch routes through `sameUnit` / `sumGross` / `compareMoney` / `minorUnitsOf`. The
   `money-sentinel` analysis is right — `declaredMinor` / `admittedMinor` do not contain the banned
   literal, exactly as `gross_not_partitioned` already does not (`:2646`). And green is right that the
   brief's `bigint` premise is false: `Money.amountMinor` is `number` (`model/domain.ts:531-537`),
   which the module itself states at `:541-542`.

5. **C13's split is the right *shape*, and I attack both halves' mechanics without touching the
   shape.** The argument that refusing would delete `unclassifiedFieldFailsClosed`'s entire point
   (`tests/scenarios/recon-corpus.ts:1946-1952`) is correct, and the adjudication's C13-as-written
   would have deleted it. **My BLOCKER 3 is green's own argument applied to C18** — the argument green
   made and then did not carry across the page.

6. **`unique_within` ruled unbuilt.** I tried hard to break this and could not. `:80-87`'s *"no
   authority, no clock, no identity and no network"* is real; `period` and `tenant_lifetime` need
   reads outside the run; the `run` case is genuinely covered end to end (`:1418-1431`, `:1379-1386`,
   `:2903-2907`, witnessed at `tests/scenarios/recon-corpus.ts:1329-1396`); and the product
   consequence is escalated as O-9 rather than buried. `docs/domain-model.md:755` does claim the
   capability — verified — and green marks rather than deletes it.

7. **Reversing the build order within row 3 (C16 → C17 → C18 → C13) is correct for the stated
   reason.** `sumGross` folds `addMoney` (`:1463-1472`), which refuses across units (`:614-616`), so
   until C16 lands a control total is compared against a sum whose denomination row one chose.
   `docs/build/ingestion-pipeline.md:426` should follow green, not the reverse.

8. **§6 is the part of this plan I would keep verbatim.** 6.1 (*"C18 makes the trailer load-bearing;
   it does not make the parser trustworthy"*), 6.3 (the empty population, stated rather than left as
   silence), 6.5 (`guardMoney` at admission, named as deferred rather than missed), 6.7 (the return
   type, recorded as a choice) — and the **third copy of the lossy fold** at
   `tests/scenarios/recon-corpus.ts:3165-3175`, which I verified and which neither the adjudication
   nor `docs/build/ingestion-pipeline.md` names.

---

## What must change before this is built, in order

1. **BLOCKER 2 first** — declare `population_wholly_refused` and widen `checkPostconditions` to take
   admission's own per-side counts. Everything else in C13 rests on an operand that does not exist.
2. **BLOCKER 1** — the observed refusal rate becomes a recorded fact unconditionally, so a permissive
   ceiling suppresses a refusal and not the evidence. Delete the "re-run with the ceiling at 10000"
   sentence; it is the off-switch as procedure.
3. **BLOCKER 3** — C18's five comparison arms become post-conditions plus residue causes.
   `expected_but_absent` may refuse, argued for itself.
4. **SERIOUS 4 + 5** — narrow C17 to duplicated addresses with at least one admitted copy, and fix
   `checkPostconditions`'s shared key space as its own commit with its own mutation.
5. **SERIOUS 6 + 7** — `guardUnit()` in §3; the cross-side and tolerance unit comparisons in the gate
   C16 already writes.
6. **SERIOUS 8** — widen `check-citations.mjs` to `model/` and `tests/` as an isolated commit; cite by
   declaration name in every new docblock.
7. **SERIOUS 9 + 10 + NOTED 13** — rename the three `presentedCount`s; bind `not_declared_by_format`
   to a `DocumentType` declaration; early-return after C17.

# Ingestion, pass two — adjudicated

> **STATUS: WORKING MATERIAL · V1 AUTHORITY: NO.** An input to decisions, never a decision.
> **Nothing in it is applied.** No line of this exists in the tree, no `G` number has been taken on any
> of it, and where this page and a row in `docs/HANDOFF.md` §3 disagree, **the G row wins**.
> `docs/HANDOFF.md` §3 outranks it on every subject.
>
> **Written 10 Aug 2026 at `ece079d2`, from the eight pass-two reports.** The four green designs and
> the four red attacks are the inputs; `docs/build/ingestion-pipeline.md` (the first adjudication) is
> also an input, and its §11 is **evidence, not a ruling** — this page rules on it.
>
> ⚠️ **Every `file:line` below was opened in this session at `ece079d2`, and every count carries the
> command that derived it.** `tools/check-citations.mjs` scans `docs/build/*.md` (`TARGETS`,
> `tools/check-citations.mjs:40`), so a dead citation here fails the gate. It cannot tell whether a
> citation points at the **right** declaration — three of the corrections in §9 are that class.
>
> 🛑 **Four things below are OWNER INPUTS and are not open:** the containment proof is being inverted;
> G120's persistence key becomes content-addressed; the statelessness rule is read operationally; audit
> chains are partitioned. They arrived after the reports were written and every report must be re-read
> against the first of them — §3 does that.

---

## 0. The verdict in one paragraph

**All four objects are the right objects and not one of the four is buildable as written**, and the
reason is the same in every case: each design was written at the type layer, and in each case a
load-bearing control lives somewhere the type layer cannot reach — a `jsonb` column, a migration
`CHECK`, a function signature, a caller that does not exist, or a constant whose permissive extreme is
an off-switch. The single most important finding of the pass is not in any of the four areas: **the
containment proof every design rests on forbids the *type* `string` and is blind to
`ReadonlySet<string>`, `ReadonlyMap<number, string>`, `Uint8Array`, `ArrayBuffer`, a method returning
`string`, a function-valued property and a class holding text privately** — which I re-established by
compiling the tree's own machinery (`model/reconciliation.ts:248-258`) against a fourteen-case battery,
and which makes *"a value cannot reach the mapper — compile error, not review"* a control that passes
while asserting nothing at thirteen live assertion sites as well as in the proposal. So the proof
inversion is step 1 and nothing containment-dependent precedes it. Beyond that: the three namespace
collisions are resolved below (a convention for migration numbers, one module and one `IngestBound`
with a canonical declaration that is neither green's, one canonical O-list from O-9 to O-22); eight of
the first adjudication's twenty-one controls are amended and two more are re-scoped; three red findings
are struck on their premises; and I rule against a named team on twenty-seven contested points, with
the losing reasoning preserved verbatim under the team that argued it. **What no agent designed is the
probe** — the deterministic pass that reads bytes and produces an `ObservedSchema` — and **what
nothing in this repository can check** is whether the parser told the truth about the trailer, whether
a pack is poisoned, or whether a `jsonb` column holds the text the compiler forbade.

### Reproduce the four claims that carry this page

```bash
# 1. The proof machinery whose inversion is step 1.
sed -n '248,258p' model/reconciliation.ts

# 2. C2 is inert as ruled: the discriminant differs and no wire pair compares the two lists.
grep -n 'export type PolicySubject' model/policy.ts            # :890 — discriminant `type`
sed -n '891,899p' docs/contracts/foundation.openapi.yaml       # discriminant `kind`, five members
grep -c "name: '" tools/check-wire-mirror.mjs                  # five pairs; policy_subject absent

# 3. The collision no tool here can see: ONE gap for the name, not three for the clash.
node tools/planner/extract.mjs                                 # module_specified_not_written = 7

# 4. `npm run check` DOES run the tests. CLAUDE.md says it does not.
grep -n '"check":' package.json
```

⚠️ **DERIVE EVERY COUNT AGAINST HEAD, NOT AGAINST THE WORKING TREE, AND THIS PAGE IS THE REASON.**
When this was written the working tree carried three uncommitted changes and one untracked contract
file from a **concurrent session**, which moved seven governed counts and made `npm run check` exit 1
for reasons that have nothing to do with ingestion. §9's last two rows carry the detail. The form that
survives it:

```bash
for f in $(git ls-files 'model/*.ts'); do git show HEAD:$f; done | grep -c '^export '   # 832
```

---

## 1. Where I rule against a team

**An adjudication that agrees with everything adjudicates nothing.** Twenty-seven contested points.
The losing reasoning is quoted **verbatim** under the name of the team that argued it, because when
somebody reopens one of these, the argument and not the summary is what has to be answered.

### 1.1 Against **red-mapper-seam** — B1's diagnosis is adopted whole and its ENCODING is refused

Red-mapper-seam is right about the hole and right that it is a blocker. It is wrong about the fix, and
I established that by compiling both candidates rather than by reading them.

> **red-mapper-seam, B1, verbatim:** *"Invert the proof from a **deny-list on `string`** to an
> **allow-list of leaves**. A value-free leaf is: `number`, `boolean`, `null`, a branded string, a
> closed literal union of platform-authored tokens, or a readonly array/object of those. Anything else
> — including every collection type, every typed array and every nominal class — is `never`"*, with
> the encoding
> `: T extends { readonly size: number } | { readonly byteLength: number } ? never`.

**RULED AGAINST, on the encoding only.** `{ readonly size: number }` is a **landmark**, not the
property. Compiled at `ece079d2` against the tree's own compiler: red's encoding **falsely rejects**
`interface Nested { readonly n: number; readonly window: { readonly size: number; readonly offset:
number } }` — a nested numeric window, which is `SampleSelection`'s own shape (`stride`, `offset`,
`rowCount`). That is §5.1 in the control written to fix §5.6, and it is worse than an omission:
`model/reconciliation.ts:9-14` records that *a control that fails while the property holds teaches
people to ignore controls.* The property is **callability**, not the presence of a field named `size`.
§3 carries the encoding I rule for and the compiled evidence for both.

### 1.2 Against **green-residue** — nine points

| | Ruling | Losing reasoning, verbatim |
|---|---|---|
| **1.2a** | `IngestBound` is **not** `Record<IngestBoundKey, number>`. Adopt red-residue S9's units. | *"THIS IS A CONTRIBUTION TO C4, NOT A DUPLICATE OF IT, AND THE DIFFERENCE IS TOTALITY. C4 as adjudicated is eight named fields; eight fields are eight things somebody can forget to set."* **The totality argument is accepted in full and is why §2 keeps a derived key set. The numeric type is refused:** seven counts and one dimensionless ratio in one `number` makes `checkBound('max_compression_ratio', bounds, observedBytes)` compile. |
| **1.2b** | `sanitisedAt` and `sniffedKind` become **required-and-nullable** (G102). | *"NON-NULL, AND THAT IS DERIVED FROM C20 RATHER THAN ASSUMED. F12 runs with no credentials, no database reach and no network egress, so it cannot write a row; the orchestrator writes one only after the sniff returns. 'Not sanitised yet' is therefore not a state a row can be in, and a nullable field would invent one."* **The derivation is sound and the arm `sanitiser_did_not_complete` is the counter-example to its own premise.** Writing `unrecognised` for an artefact F12 died on collapses the distinction that member's own declaration states in capitals — *"F12 RAN AND COULD NOT TELL. Not 'we did not look'"* — on the routing key. |
| **1.2c** | The content-key unique index becomes **partial**, so `duplicate_of_earlier_arrival` has a writer. | Green states the duplicate as *"THE DUPLICATE AS A NAMED OUTCOME, AT THE FILE GRAIN, POINTING AT THE FIRST ARRIVAL"* and then declares an index under which the second delivery cannot be inserted. R5(v)'s silent `Map.set` (`model/reconciliation.ts:2835`) returns as a silent `ON CONFLICT DO NOTHING`. |
| **1.2d** | The pipeline order is **stated as a decision** and the null rule derived from it; the refusal becomes a **stage-ordered list**; the flagship fixture is replaced. | Green asserts both *"`endpointId` … NULL ON EXACTLY ONE REFUSAL ARM"* and *"every F12 arm, **because F12 runs before routing**"*. Both cannot hold, and green's own quarantine fixture violates green's own `CHECK`. §5.10 inverted: the fixture is green and the constraint is red. |
| **1.2e** | `arrivalBlobLocation()` is **deleted**; `storageBucket`/`storageKey` survive for the purge job. | Green: *"A CONSTRUCTION AND NOT A PARSE. This is only writable because the row carries `storageBucket` and `storageKey` separately."* The construction is correct and there is **no caller**: `registerSubjectLocation` requires a `subjectRef`, and green's own §2.5 proves a non-admitted arrival has no subject to HMAC. The function's only reachable effect is putting a counterparty filename into a wire schema. |
| **1.2f** | `ARRIVAL_MAY_BE_REPROCESSED` becomes a **trigger union**, not a boolean, and the row gains an attempt counter. | Green: *"this table is the executable form of adjudication I7 … `needs_configuration` is the only arm a configuration change may re-admit, and it is exactly the arm whose refusals name a missing human decision rather than a hostile or broken artefact."* **`encrypted` is not a missing human decision on our side, and none of the six arms says anything about cost.** 10,000 raster TIFFs made ambiguous by a sender are auto-escalated to tier 4 by an unrelated FDE act — I7 verbatim, through the table written to enforce it. |
| **1.2g** | `arrivalErasureDisposition()` gains a third reach — `indexed_if_registered`, resolving to `out_of_reach` until a registration is observed. | Green keys the reach on `ARRIVAL_ERASURE_REACH[disposition]`, i.e. on **admittedness**. `SubjectIndexEntry` is *"Written at CREATION time, not discovered by scanning"* — admittedness does not imply that any writer ran, and `registerSubjectLocation` has no implementation anywhere in this repository. It fails **open** in the one direction `DENY_ALL` and G100 both point away from. |
| **1.2h** | The `Coverage` figure is **struck as the answer to C19**. Where the residue renders is O-9 and stays O-9. | Green: *"it is the register's own third figure … coverage needs a denominator and the denominator is arrivals."* Two objections, both green's own: §6 item 3 records that **nothing joins an `Endpoint` to a `ReconciliationDefinition`**, and §6 item 8 records that `arrivalCoverage()` **has no notion of a period** — so it cannot compute a per-run figure, and the figure on the mockup is per-run. `PRODUCT.md` forbids treating an in-product figure as a result, which green says itself and then makes a structural decision rest on. |
| **1.2i** | `MODULE_COUNT` is at **`tests/model/runtime-importability.test.ts:45`** and there are **two** literals, `:45` and `:135`. | Green: *"one line moved: `MODULE_COUNT = 18` → `19` in … `:44`"*. Verified: `:45` is the declaration and `:135` is `assert.equal(MODULE_COUNT, 18)`. A one-line fix that leaves the gate red. |

### 1.3 Against **green-integrity** — six points

| | Ruling | Losing reasoning, verbatim |
|---|---|---|
| **1.3a** | The C13 ceiling gate **refuses `10_000`**, and the observed refusal rate becomes a **recorded fact** on the result, unconditionally. | Green: *"10000 IS NOT AN INVENTED THRESHOLD; it is 100%, by definition of the unit."* True of the unit and false of the control: at `10_000` the test `refused × 10000 > 10000 × (admitted + refused)` reduces to `admitted < 0`, which is unsatisfiable. The tree's posture one bound above is the opposite — `SIMILARITY_MAX_CHARS_CEILING = 512` (`model/reconciliation.ts:2772`) and the gate at `:2796` **refuses above it**. And green's own docblock prints the off-switch as procedure: *"the diagnostic path is to re-run with the ceiling at 10000 and read the refusals."* **Delete that sentence.** |
| **1.3b** | C18's five **comparison** arms become **post-conditions** plus a `ResidueCause` on the affected rows. `expected_but_absent` may refuse and must be argued for itself. | Green makes the argument and then does not carry it: *"A refusal there would delete the only useful output of the run"* (of C13's floor) beside routing every C18 defect to `population_integrity_refused`. `SetReconciliationOutcome`'s `ok: false` arm carries no residue, no `refusedAtAdmission`, no ambiguities and no post-conditions, in the module whose §6 banner is `RESIDUE — the product` (`model/reconciliation.ts:2080` region). A supplier writing `lineCount: 41` for a 40-row file discards the other side's admitted rows. |
| **1.3c** | C17 refuses only when **at least one copy of a duplicated address was ADMITTED**. The both-refused case stays where the tree already puts it. | Green's mutation 5.2(c) *"deliberately includes `input.refused` in the collision walk"*. Two refused copies of one address already produce `item_in_residue_twice` (`model/reconciliation.ts:2643`, raised at `:2694`) with both rows and both reasons in the residue and `postconditions` non-empty. Replacing that with a whole-run refusal is a regression. |
| **1.3d** | `not_declared_by_format` is bound to a **`DocumentType` declaration**; a parser disagreeing with it is itself a defect. | Green: *"WHO SETS IT, AND IT IS NEVER THE ENGINE. The PARSER declares which arm applies … deciding whether a `.csv` 'should' carry a trailer needs a per-format registry, and putting one inside the engine would be a rule keyed on a filename instead of on what the parser actually found (§5.1)."* **Nobody proposed a filename registry.** The declaration belongs on `DocumentType`, which already declares `expectedFidelity` beside `ACQUISITION_FIDELITY` (`model/domain.ts:1782`) — invariant 4's posture, which green adopts for denomination and declines for the trailer in the same document. As written the component whose output C18 checks can switch C18 off, and green's fixture plan puts 22 of 24 scenarios on the OFF arm. |
| **1.3e** | The C16 statedness gate becomes `guardUnit()` **inside §3**, with two named `MoneyRefusal` arms. | Green folds the gate into the per-side loop and reads `unit.currency` and `unit.exponent` — two of `Money`'s three fields (`model/domain.ts:531-537`) — below `_MoneySectionEndsHere`, whose own sentence is *"below this line nothing may name the money representation."* The `money-sentinel` control (`tests/model/reconciliation-controls.test.ts:309`) bans the literal `amountMinor` only, so it stays green while the property it protects is breached — and green's §4 reassures the reader that it stays green. |
| **1.3f** | C16 must compare the **two sides' declared units** and the tolerance's, in the gate it already writes. | Green declares a unit per side and reads neither against the other. An FDE configuring `{SGD,0}` against `{SGD,2}` admits every row on both sides, allocates nothing, lands 8,000 rows in the residue as `no_strategy_paired` — *"nothing matched it"*, which is false — and `postconditions` is empty because conservation over zero allocations is trivially sound. C16 moves the error from the file into configuration, where it is systematic and silent. |

### 1.4 Against **green-correction** — six points

| | Ruling | Losing reasoning, verbatim |
|---|---|---|
| **1.4a** | `ExceptionStatus` does **NOT** gain `'superseded'`. Carry *"replaced by a corrected rerun"* on the run / `MatchGroup` side, where `supersededByRunId` already lives. | Green: *"AN OPEN EXCEPTION HAD NOWHERE TO GO UNTIL THIS MEMBER … `tsc` will stay green on this member and tell you nothing (§5.10); **`check:wire` is the only thing that bites**."* The stated gate does not exist: `tools/check-wire-mirror.mjs:72` declares five pairs (`:74`, `:79`, `:89`, `:94`, `:99`) and `ExceptionStatus` is not one; `ExceptionStatus` (`model/domain.ts:648`) is a bare string-literal union with no `kind` discriminant, so a sixth pair needs **a new source kind in the engine** — the one thing the registry's own comment says adding a pair is not. And the member widens a hole rather than closing one: `ExceptionReversal.newStatus` is unconstrained, so any holder of `reverse_resolution` (`tenant_data`, `model/access.ts:556`) could stamp it on a finding with no rerun in existence while the correction path is gated at `authority`. |
| **1.4b** | `DocumentCapture` lands with a `RetentionClass`, `purgeAfter`/`purgedAt`, and a `SubjectLocation` variant — **or it does not land**. | Green quotes `ErasurePlan`'s *"a plan that admits what it cannot reach … is worth more than one that silently misses it and reports success"* eight times and then declares a store of `ExtractedValue`s with no window and no variant that can name it. `RetentionPolicy.days` is `Record<RetentionClass, number>` and the totality bites on the **class list** (`model/domain.ts:1086`), so a row type that declares no class has no window and breaks no proof. |
| **1.4c** | `mayRecapture()` takes a `ManagedServiceResolution` — the **result** — and refuses on `ok: false`. | Green §1 row 47: *"Exists as of `f988f2a4`; **no production caller**. Recapture of a `scanned` document is a caller."* The gate takes no managed-service parameter, so two of its twelve arms are unreachable and §3 states that one of them *"Refuses on: any `resolveManagedService()` rejection"*. `resolveManagedService()` is at `model/policy.ts:1781` and still has no caller. Invariant 7 on the recapture path is prose over zero call sites. |
| **1.4d** | `captureLedgerIsAppendOnly: boolean` is **deleted from the gate**; the property is a schema test plus the post-condition green already has. | Green passes it as an input and refuses on it. It is a caller-asserted claim about a **database invariant**, asserted by the code that assumes it — §5.2, and the standing refusal is one module away: `ManagedServiceUseConfig`'s banner refuses a caller-supplied opt-out because *"a caller-supplied parameter that switches a check off is the defect shape this codebase catalogues."* |
| **1.4e** | *"Nothing. It is already safe"* is **false for `Exception`.** The prior resolution is pinned on the reversal, or a post-condition counts what was discarded. | Green: *"**Nothing. It is already safe.** The wrong finding stays readable as the wrong finding — which is what an auditor needs."* Half true: `explanation.observed[].scalar` is a copy and survives. `Exception.resolution` is documented *"cleared on reversal"*, and `correctedDispositionKey` is null on a plain reopen — so a 12,000-row mass reversal erases what the agent decided, which is the one thing `LearningRetraction`'s docblock names as what an auditor asks. |
| **1.4f** | `mayRecapture()` reads `mode` and refuses `capture_and_rerun` without `trigger_run`; the bound is compared against **executed** recaptures inside the same transaction. | Green's own act table classes the corrected rerun `trigger_run` / `configuration` and its gate checks only `holdsPromoteFieldMapping`; `mode` is never read. And `plan: { maxDocuments; plannedDocuments }` is checked per document against a caller-supplied count, so 40,000 calls with `plannedDocuments: 1` each all pass a bound of 500. |

### 1.5 Against **green-mapper-seam** — six points

| | Ruling | Losing reasoning, verbatim |
|---|---|---|
| **1.5a** | `buildMapperRequests` calls `validateObservedSchema` **first** and a non-empty result produces **no requests** — the polarity `boundDefects` already has. | Green: *"`validateObservedSchema()` still checks ordinals are contiguous and agree, because the type cannot."* `MapperRequestBuild` has no field for the answer and the builder's docblock never names the function. `key_and_header_ordinal_disagree` is the arm that guards the index-mismatch attack, and it has **zero call sites** — together with `header_not_truncated_within_cap`, the only enforcement of the only bound on the only counterparty string in the module. |
| **1.5b** | `buildMapperRequests` and `validateSchemaMappingProposal` take a **`DocumentType`**, not a free `fields` array, and refuse when its id disagrees with the schema's. | Green: *"`candidateMaxDataClass` IS THE OPERAND, NOT THE CHECK … The caller checks it against `maxDataClassInPrompt`."* **The refusal to rank two `DataClass` values is correct and is upheld** — `model/policy.ts` records four copies of that ladder and `DATA_CLASS_RANK` is at `model/learning.ts:1773`. What is refused is deriving the operand *and* the candidate list from parameters the same caller supplies: `target_not_declared_by_document_type` then cannot fire for the case it is named for, and A4's running-balance-to-`amount` binding passes a validator that certifies it as internally consistent. A **membership** check needs only `===` and no ladder. |
| **1.5c** | `MapperApplication.unresolved` carries a `MapperUnresolved` union; `several`, `no_field` and `unreadable` are **reported, not discarded**. | Green: *"`several`, `no_field` and `unreadable` produce NO ENTRY. The mapper's job is to confirm one field or to say it cannot; anything else is a finding for a human."* The finding is then thrown away inside a pure function: `unresolved` is typed `refusal: MapperRefusal` and no arm of that union can express any of the three. The copied original keeps it — `applyReaderVerdicts` pushes `{ ref, cause: ResidueCause }` (`model/reconciliation.ts:2451`). The design copied the enforcement point and dropped the reporting channel, recreating the indistinguishability `notImplementedMapper` exists to prevent. |
| **1.5d** | `seedFromDigest` reads a **fixed 13 hex digits** (52 bits, safe) and `stride === 1` becomes a named degenerate case. | Green's docblock names the exact failure it then produces: *"a silent 0 makes every file's offset identical and turns a spread sample back into a head sample — a control that passes while asserting nothing (§5.6)."* `Number.parseInt('f'.repeat(64), 16)` is `1.157920892373162e+77`, not a safe integer, and an exact multiple of a large power of two — so `seed % stride` is **0 for every power-of-two stride**. A8's head sample walks back in through the arithmetic, not through the error path mutation B3 guards. |
| **1.5e** | Suppression below the k-anonymity floor suppresses the **profile**, not one field. `ColumnProfile` becomes a union so the determining fields are structurally absent. | Green: *"A shape projection of a LOW-CARDINALITY column IS the value. A `Y`/`N` flag has a one-character skeleton that is the datum."* **The insight is the best original idea in the four designs and it stands.** Its application does not: `ColumnShapeDisclosure` is the type of one field, so `distinctCount`, `minLength`, `maxLength` and `matchesThreeLetterUpperCase` remain — and a grade column of `A`…`H` above the floor discloses the alphabet modulo eight letters. Keyed on `distinctCount`, a landmark, rather than on *does length × class determine the value set*. |
| **1.5f** | `IngestBound` gains `maxCodecCandidates` and `maxUntrustedHeaderChars`, both required. | Green caps the candidate list and not the codec list, and length-caps the one counterparty string with `maxCellChars` — a bound chosen so a long free-text notes column parses. An FDE raising it to accommodate a 4,000-character description column raises the prompt-injection surface of every header by the same amount, with no indication. Green's own rule for the other list — *"a cap is a ceiling, and silently truncating the candidate set would make an arbitrary subset look like the whole one"* — is stated for one of two index-bearing lists. |

### 1.6 Where a red finding is STRUCK on its premise

Three, and they are struck by name because this record strikes attacks the way it strikes claims.

| | Struck | The premise, and why it fails |
|---|---|---|
| **S-1** | **red-mapper-seam B1's encoding** — see §1.1. | *"`: T extends { readonly size: number } | { readonly byteLength: number } ? never`"*. Compiled: it rejects a nested `{ size: number; offset: number }`, which is `SampleSelection`'s own shape. The diagnosis is adopted; the encoding is refused. |
| **S-2** | **red-residue S2's third leg** — *"the `blob` variant exists for artefacts **no row addresses**. A `SourceDocument`'s blob is reached through the row; so is an arrival's, because the arrival **is** a row with a storage reference. So the two-field split is not required for erasure."* | The conclusion is right and this leg of the argument is wrong, and the difference matters because green found a real defect. `SubjectLocation.blob` is `{ bucket; key }` and `SourceDocument.storageRef` is one opaque string that `Endpoint.address`'s standing rule forbids parsing — so *"reached through the row"* is true of a **purge job that reads the row**, and false of the **erasure index**, which is keyed on a `SubjectLocation` somebody must construct. Green's §0(b) finding stands as a real defect on `SourceDocument`; only its consequence for the arrival is struck (§1.2e deletes the function on legs 1 and 2, which do hold: `docs/contracts/capability.openapi.yaml:155` rules the adjacent case in the record's own words — *"it owes no SubjectLocation. This is the one case where an unregistered blob is correct, and it is correct only because it is unread"*). |
| **S-3** | **red-integrity SERIOUS 8's remedy, in part** — *"Add `model/*.ts` and `tests/**/*.ts` to `check-citations.mjs`'s `TARGETS`"*, on the premise that the checker's blindness is what let this class through. | The **finding** stands: `TARGETS` (`tools/check-citations.mjs:40`) does not include `model/` or `tests/`. The premise that widening it fixes the class does not: the checker's own header states it *"cannot tell whether a citation points at the RIGHT declaration — only whether it points at anything at all"*, and **every instance in §9 below resolves**. Widening `TARGETS` catches a deleted line and cannot catch a moved declaration — which is the whole class. Adopt the widening as cheap and honest, and **do not record it as closing the class**; the second half of red's control, *cite by declaration name*, is the part that actually holds. |

---

## 2. The three namespace collisions, resolved

### 2.1 Migration numbers — RULED AS A CONVENTION, which removes the class

**No design document may claim a migration NUMBER.** A migration is named by its **SUBJECT** —
`session`, `ingest_arrival`, `document_capture`, `held_work`, `run_execution` — and the number is
allocated **only at the moment the file is written**, by looking at `db/migrations/` and taking the
next one. A number in a proposal is a collision waiting to happen, and the collision is invisible
until two branches merge.

**Derived, not asserted** — four distinct subjects currently claim the number `0002`:

```bash
grep -rn '0002_[a-z_]*' docs/build/*.md docs/*.md | sed 's/:.*\(0002_[a-z_]*\).*/ -> \1/' | sort -u
#  0002_held_work · 0002_run_execution_and_reader_work · 0002_session
#  plus the arrival ledger, which claims `0002` in prose rather than in a filename
```

Six documents carry one of them, and **`docs/INDEX.md` has already absorbed two** — which is the worst
case, because `docs/INDEX.md` is a map people trust rather than a proposal they weigh. `db/migrations/`
holds exactly one file (`0001_tenancy_and_rls.sql`), so **not one of the four claims is even
consistent with the tree**, and whichever lands first makes the other three wrong in a way that
`node tools/check-doc-counts.mjs` cannot see because there is no governed total for it.

**This is a convention and not an allocation on purpose.** Allocating `0002` to one of the four would
settle the instance and leave the class: the fifth design would claim `0003`, and two of the four would
then claim it. Naming by subject removes the class — a subject is unique because it describes what the
migration does, and G88's forward-only expand/contract rule already means the number carries no
meaning beyond order.

⚠️ **The cost, stated:** a document that cannot say `0002` also cannot state a dependency as *"after
0002"*. Say it as *"after the `session` migration"* — which is what the dependency actually is, and
which survives renumbering.

### 2.2 `model/ingestion.ts` and `IngestBound` — one module, one bound record, and the canonical declaration is NEITHER green's

**This is §5.3 live** — two vocabularies for one concept — inside the pass that was told §5.3 is the
shape this record has seen recur most. ⚠️ **And one premise of the brief needs correcting before the
ruling: THREE designs mint the module and TWO mint `IngestBound`.** Derived:

```bash
grep -rn 'export interface IngestBound\|INGEST_BOUND_KEYS' docs/build/ingestion-p2-green-*.md
#  green-residue:433 lines earlier → INGEST_BOUND_KEYS (8 snake_case values, Record<K, number>)
#  green-mapper-seam            → export interface IngestBound (13 camelCase fields, plain number)
#  green-correction             → declares none; it appends `§C` to the module and cites C4's discipline
```

**No tool here can see the collision.** `node tools/planner/extract.mjs` at `ece079d2` reports
`module_specified_not_written` **7**, of which exactly **one** is `model/ingestion.ts` — *"Named in the
documentation 20 time(s); no file exists in `model/`"*. One gap for the name, not three for the clash.
That is why this is mine.

**RULED — ONE module, sectioned.** `model/ingestion.ts`, the nineteenth module, with three numbered
sections in one file and one header:

```
§A  OBSERVATION AND THE SEAM   green-mapper-seam's §2, minus the corrections in §1.5
§B  THE ARRIVAL LEDGER          green-residue's §2, minus the corrections in §1.2
§C  CORRECTION                  green-correction's §C, gated on O-20
```

Three reasons, in order of force. **(1)** Green-correction's own argument is the decisive one and it
was made against itself: *"a `MappingRetraction` that lived apart from `SchemaMapping` would be two
vocabularies for one lifecycle."* The same sentence applies to an arrival ledger that lives apart from
the bounds that refuse an arrival. **(2)** The standing header controls the first adjudication requires
— `grep -c 'new RegExp' → 0`, `grep -c 'throw ' → 0`, R1's sentence — are **module-header** controls;
three modules means three headers and three places to forget one. **(3)** A fourth and fifth module
would move `MODULE_COUNT` (`tests/model/runtime-importability.test.ts:45`, `:135`) and every governed
count twice more. **Cost, stated:** one file will be large, and `CLAUDE.md`'s working practice requires
a plan before touching a large module — which each section already has, in its own green report.

**RULED — ONE `IngestBound`, and the canonical declaration is a THIRD shape.** Neither green's
survives, and the losing reasoning for both is at §1.2a and §1.5f.

```ts
/* model/ingestion.ts §A. The dimension brands are module-private: the only way to
 * obtain one is a deliberate cast at the configuration seam, which is where a
 * reviewer looks. Precedent: NormalisedDescriptionValue (model/learning.ts:1773's
 * neighbourhood) — a branded VALUE, not an Id<>, because no table holds it. */
declare const bytes: unique symbol
declare const rows: unique symbol
declare const chars: unique symbol
declare const depth: unique symbol
declare const ratio: unique symbol
declare const columns: unique symbol
export type Bytes = number & { readonly [bytes]: 'Bytes' }
export type Rows = number & { readonly [rows]: 'Rows' }
export type Chars = number & { readonly [chars]: 'Chars' }
export type Depth = number & { readonly [depth]: 'Depth' }
export type Ratio = number & { readonly [ratio]: 'Ratio' }
export type Columns = number & { readonly [columns]: 'Columns' }

export interface IngestBound {
  /* --- file grain (C4) --- */
  readonly maxObjectBytes: Bytes
  readonly maxDecompressedBytes: Bytes
  readonly maxCompressionRatio: Ratio
  readonly maxPages: Rows
  readonly maxRows: Rows
  readonly maxCellChars: Chars
  readonly maxArchiveDepth: Depth
  readonly maxRowsPerTransaction: Rows
  /* --- observation and seam grain (C9/C10/C12) --- */
  readonly maxObservedColumns: Columns
  readonly maxCandidateFields: Columns
  readonly maxCodecCandidates: Columns        // §1.5f
  readonly maxUntrustedHeaderChars: Chars     // §1.5f — NOT maxCellChars
  readonly maxSkeletonRuns: Rows
  readonly maxDistinctSkeletons: Rows
  readonly minDistinctValuesToProfile: Rows
}

/** DERIVED, so the key set cannot drift from the record — green-residue's totality
 *  argument, with no second declaration to keep agreed. */
export type IngestBoundKey = keyof IngestBound

/** The dimension of each bound, TOTAL — so a sixteenth field is a compile error
 *  here, and this declaration is its own construction site (§5.10 does not apply). */
export const BOUND_DIMENSION: Record<IngestBoundKey, 'bytes' | 'rows' | 'chars' | 'depth' | 'ratio' | 'columns'> = {
  /* … sixteen entries … */
}

/** ⚠️ TEXT-FREE, and `keyof IngestBound` is a closed literal union so it passes. */
export type BoundDefect =
  | { readonly kind: 'bound_not_stated'; readonly field: IngestBoundKey }
  /** §1.2 / red-residue B1: the fail-closed state the arrival ledger could not record. */
  | { readonly kind: 'bound_not_configured'; readonly field: IngestBoundKey }
```

**What this buys that neither green's does.** `checkBound('max_compression_ratio', bounds,
observedBytes)` no longer compiles — red-residue's zip-bomb scenario becomes a type error. The key set
is **derived** rather than declared twice, so green-residue's totality is kept with nothing to keep
agreed. And `bound_exceeded { bound, limit, observed }` cannot report a ratio as a byte breach, because
`limit` and `observed` are the same brand as the bound.

⚠️ **`bound_not_configured` is the arm red-residue B1 found missing and it is not cosmetic.** Without
it, an arrival that landed before O-8 was answered has three representable outcomes and all three are
defects: fabricate `limit: 0` (invented data on the row a finance user reads — the precise thing
`ResidueEntry.settlement`'s docblock records this codebase already doing once), throw (banned by the
module's own control), or write no row (the second inbox with no door, produced by the object built to
close it). It maps to `needs_configuration`, which is what it is: *a refusal that names a missing human
decision.*

### 2.3 The O-numbers — one canonical list, and a mapping table so no reader is stranded

**Nine questions wore three numbers across three documents, and two more were unique to one.** The
canonical list is §8, running **O-9 to O-22**. The mapping table is §8's first table.

**Standing rule, added here:** *do not cite an O-number without the document it came from unless it is
this page's.* O-1 to O-8 and T-1 to T-3 are the first adjudication's and are unchanged; **O-9 upward
means this page** from now on. A local `O-9` in a green report is a **draft** and must be read through
§8's table.

---

## 3. What the proof inversion changes — every containment claim, re-read

**The owner's ruling is the input:** invert `AssertNoTextDeep` to an allow-list of value-free leaves,
as its own commit, verified RED against every known escape, **before the mapper seam is built.**

### 3.1 What I compiled, and what the tree's own machinery actually does

I re-declared `NoTextField` / `NoTextDeep` / `AssertNoTextDeep` **verbatim** from
`model/reconciliation.ts:248-258` into a scratch file outside the repository and ran the tree's own
compiler (`node_modules/.bin/tsc --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess
--noEmit --target ES2022 --lib ES2022`) over a fourteen-case battery. **Reproducible; the result is
not what any of the four designs believes.**

| field added to an otherwise text-free interface | HEAD's proof | candidate B (ruled) |
|---|---|---|
| `readonly set: ReadonlySet<string>` | ✅ **PASSES** | ❌ TS2344 |
| `readonly map: ReadonlyMap<number, string>` | ✅ **PASSES** | ❌ TS2344 |
| `readonly counts: ReadonlyMap<number, number>` | ✅ PASSES | ❌ TS2344 *(accepted cost)* |
| `readonly bytes: Uint8Array` | ✅ **PASSES** | ❌ TS2344 |
| `readonly buf: ArrayBuffer` | ✅ **PASSES** | ❌ TS2344 |
| `readonly cell: { describe(): string }` | ✅ **PASSES** | ❌ TS2344 |
| `readonly fn: () => string` | ✅ **PASSES** *(named by nobody)* | ❌ TS2344 |
| a class instance with `private readonly raw: string` | ✅ **PASSES** | ✅ **STILL PASSES** — §3.4 |
| `readonly s: string` | ❌ TS2344 | ❌ TS2344 |
| `readonly r: Record<string, string>` | ❌ TS2344 | ❌ TS2344 |
| `readonly pair: readonly [number, string]` | ❌ TS2344 | ❌ TS2344 |
| `readonly arr: readonly string[]` | ❌ TS2344 | ❌ TS2344 |
| `readonly j: unknown` (i.e. `Json`, `model/kernel.ts:423` region) | ❌ TS2344 | ❌ TS2344 |
| a branded `Id<'X'>`, a closed literal union, `number \| null`, a nested `{ classIndex: 0\|1\|2; length: number }`, `ItemRef \| null` | ✅ passes (correct) | ✅ passes (correct) |

**Seven escapes, of which the reports named five.** `() => string` and `ReadonlyMap<number, number>`
were named by nobody: the first is a real escape, the second is the accepted cost of the fix.

### 3.2 The encoding I rule for, and why it is not red's

```ts
/* model/reconciliation.ts:248-258 — REPLACES NoTextField. Its own commit, DP-8's
 * shape, with its own red run against every row of the table above. */
type ValueFreeLeaf<T> = string extends T
  ? never
  : T extends string | number | boolean | null | undefined
    ? T
    : T extends Function                                  // ← the PROPERTY: callability
      ? never
      : T extends readonly (infer U)[]
        ? readonly ValueFreeLeaf<U>[]
        : T extends object
          ? { [K in keyof T]: ValueFreeLeaf<T[K]> }
          : never
type NoTextDeep<T> = { [K in keyof T]: ValueFreeLeaf<T[K]> }
export type AssertNoTextDeep<T extends NoTextDeep<T>> = T
```

**One arm does the work.** `T extends Function ? never` reaches every collection and every typed array
**through their own methods**: a `ReadonlySet` has `has` and `forEach`, a `ReadonlyMap` has `get`, a
`Uint8Array` has `subarray`, an `ArrayBuffer` has `slice`, and `{ describe(): string }` has
`describe` — so the mapped type turns each method into `never` and the original type is no longer
assignable. It keys on the **property** (a value-free leaf has no behaviour) rather than on a landmark,
which is why it admits `{ size: number; offset: number }` and red's encoding does not. **Verified by
compiling both, not by reading them.**

**Cost, stated rather than implied.** No asserted type may hold a `Map`, a `Set`, a typed array or any
object with a method — including a legitimate `ReadonlyMap<number, number>`. That is the intended
trade: an asserted type is a **wire shape**, and a wire shape has no behaviour. Any existing asserted
type that needs one is a design error the inversion surfaces, which is the point of running it red.

### 3.3 Every containment claim across the eight reports, re-read

**Survives the inversion unchanged** — the claim was about a closed literal union, a branded id, a
number or a nested object of those, and candidate B admits all four:

| Claim | Where | Verdict |
|---|---|---|
| `_ArrivalRefusalHoldsNoTextDeep` over the fourteen-arm union | green-residue §2.3(iii) | ✅ **Survives.** Every arm carries a literal union, a `readonly DocumentTypeId[]`, a branded `IngestArrivalId` or a number. Red-residue verified the proof directly and *"could not break it"* at the type level; the inversion strengthens it and changes nothing about the union. |
| `_ArrivalOutcomeHoldsNoTextDeep` | green-residue §2.3(iv) | ✅ Survives. |
| `_RecaptureRefusalHoldsNoText`, incl. carrying `ManagedServiceRejection['reason']` and not the rejection | green-correction §2.6 | ✅ **Survives, and it is the best-argued proof in the four designs.** The five-member literal union passes; `feature_not_permitted.permitted: readonly string[]` would fail under **both** encodings. |
| `_CorrectionPostconditionHoldsNoText` (counts only) | green-correction §2.7 | ✅ Survives. |
| `_PopulationDefectHoldsNoTextDeep` (branded `SourceDocumentId`, `ItemRef`, numbers, `MoneyRefusal`) | green-integrity §2.5 | ✅ Survives. |
| `_MapperVerdictHoldsNoTextDeep` (two indices and a number per arm) | green-mapper-seam §2.9 | ✅ Survives. |
| `_MapperRefusalHoldsNoText`, `_SampleRefusalHoldsNoText`, `_ObservedSchemaDefectHoldsNoText`, `_SchemaMappingDefectHoldsNoText` | green-mapper-seam | ✅ Survive. |
| `_SampleSelectionHoldsNoTextDeep` | green-mapper-seam §2.4 | ✅ **Survives, and it is the case red's encoding would have broken** — `{ stride; offset; rowCount }` plus two `readonly number[]`. |
| `BoundDefect.field: keyof IngestBound` | green-mapper-seam §2.3 | ✅ Survives. |

**Was resting on a proof that did not hold** — the claim is about the *absence of a value*, and the
type it names admits a collection, a typed array or a method today:

| Claim | Where | Verdict |
|---|---|---|
| *"a value cannot reach the mapper — **compile error, not review**"* | green-mapper-seam §3, row 1 | 🛑 **FALSE as written until step 1 lands.** `readonly distinctValues: ReadonlySet<string>`, `readonly cells: ReadonlyMap<number, string>` and `readonly sample: Uint8Array` on `ColumnProfile` all compile, `_ColumnProfileHoldsNoTextDeep` stays green, `npm run check` stays green, and every mutation in green's §5 still passes. **Restored by the inversion, and only by it.** |
| `_ColumnProfileHoldsNoTextDeep` as *"THE CONTAINMENT PROOF THAT MATTERS MOST"* | green-mapper-seam §2.6 | 🛑 **The type is right and the proof was not.** Post-inversion the claim is true. Say *"true as of the inversion commit"*, never *"true"*, in any document written before it. |
| `_UntrustedHeaderCarriesNothingButTheHeaderText` — *"`firstValue: string` is a compile error"* | green-mapper-seam §2.6 | 🟠 **Half held.** `firstValue: string` did fail; `firstValues: ReadonlySet<string>` did not. Post-inversion both fail. |
| `_MapperRequestQuarantinedHalfHoldsNoTextDeep` — *"the exemption cannot grow silently"* | green-mapper-seam §2.8 | 🟠 **Held for `string`, failed for everything else, and there is a second hole the inversion does NOT close** — §1.5's S5: `candidates` is exempted **wholesale**, so a sixth text field on `MapperCandidateField` needs no diff on the `Omit` line. Adopt red-mapper-seam's one-line fix: `_MapperCandidateFieldCarriesNothingButLabelAndPath = AssertNoTextDeep<Omit<MapperCandidateField, 'label' \| 'fieldPath'>>`. |
| R1's *"Then 'the mapper never sees a value' is a compile error"* (the first adjudication) | `docs/build/ingestion-pipeline.md:172` | 🛑 **This is the sentence the whole R1 ruling rests on and it was not true when written.** It becomes true at step 1. C9's amendment (§5) carries it. |
| C9's *"the containment proof on the REQUEST path, **which nothing in the tree has today**"* | `docs/build/ingestion-pipeline.md:404` | ⚠️ **Two corrections, and green-mapper-seam found the first.** (a) The word **deep** is missing: `_CarriedTurnHoldsNoText = AssertNoPlainText<CarriedTurn>` (`model/identity.ts:1189`) is a shallow request-path proof and `NoPlainText` (`:1139`) does not recurse. (b) Post-inversion the sentence is about a **different** proof, so a document repeating C9's phrasing after step 1 is describing machinery that no longer exists. |
| `AssertNoTextDeep` at **thirteen live assertion sites** in applied code | red-mapper-seam B1 | 🛑 **Every one of them accepts a `ReadonlyMap<number, string>` today** — `_MoneyRefusalHoldsNoText` (`model/reconciliation.ts:284` region) through `_LearnedProposalOutcomeHoldsNoTextDeep`. Derived: `grep -rn 'AssertNoTextDeep\|AssertNoPlainText' model/*.ts \| grep -v '^\S*: \*' \| wc -l` → **17** (13 deep uses, 2 shallow uses, 2 declarations). The inversion is a change to applied code and must go red against the battery in §3.1 before it goes green. |
| R1's redacted-skeleton encoding — *"Encode the profile as bounded character-class **enum indices** plus lengths and assert `AssertNoTextDeep` over it"* | `docs/build/ingestion-pipeline.md:170` | ✅ **Survives, and it was the right call for the right reason.** `CHARACTER_CLASS_INDEX`'s docblock states the residual honestly: a literal union of the observed **characters** also passes, under both encodings. That residual is closable only outside the type system — §7. |
| T-2's refusal of `"detectedShape": "REGEX_MATCH: …"` **on the containment proof rather than on G124** | `docs/build/ingestion-pipeline.md` §12 | ✅ **Survives and is strengthened.** The refusal was correct and its stated ground was *"a `string` field on the request type is a field the next engineer fills from counterparty data."* Post-inversion the same sentence covers the `ReadonlySet` the next engineer would reach for **instead**, which red-mapper-seam identifies as the likelier edit precisely because it looks innocent. |
| green-integrity's *"`AssertNoTextDeep` mechanically forbids putting a `Money` in an asserted union"* | green-integrity §1 row 3 | ✅ Survives — `Money.currency` is a free `string` (`model/domain.ts:531-537`). |
| green-correction's *"`Timestamp = string` … so a timestamp on a post-condition is a text leak"* | green-correction §1(b) | ✅ Survives, and mutation M2 remains valid. |

### 3.4 What the inversion does NOT close, said plainly

1. **A nominal class holding text privately.** Compiled: **passes both encodings**, because `keyof`
   excludes private members while `JSON.stringify` does not. Closable only by a source-text control —
   `code | grep -c 'class ' → 0` over `model/`, in `tests/model/reconciliation-controls.test.ts`'s
   existing stripper harness (the `money-sentinel` control at `:309` is the shape).
2. **A literal union of the observed characters.** `'A' | '7' | …` is a closed literal union and passes
   both. Closable only by the test green-mapper-seam already proposes: assert every value of
   `CHARACTER_CLASS_INDEX` is `typeof === 'number'`.
3. **`FieldPath` and `Timestamp`.** `export type FieldPath = string` (`model/kernel.ts:423`) is a naked
   alias, so no proof can distinguish a JSONB path from a pasted paragraph. Every exemption stays
   **named in an `Omit<>`**. Branding `FieldPath` is G106's unapplied JSONB half and is owed as its own
   commit.
4. **A `jsonb` column.** The proof constrains the TypeScript type and nothing else — red-residue S5,
   and it is the sharpest limit of the whole pass. §7 carries it.

---

## 4. The four areas, adjudicated

Exact declarations with insertion points where the design is settled; **OPEN** where it is not.

### 4.1 The ingestion residue

**SETTLED.** The object, the denominator argument, the text-free refusal union, the derived disposition,
and the retention answer. Red-residue could not break any of the five and I did not try to: *"a table
holding only failures IS the second inbox C19 exists to refuse"* is the best single insight of the
pass, and `ARRIVAL_RETENTION_CLASS`'s deciding ground — *the same bytes must not get two purge dates* —
survives every attack made on it.

**SETTLED, amended.** Six changes, all at `model/ingestion.ts` §B, all argued at §1.2:

```ts
/* §B, in ArrivalRefusal — the fail-closed arm the design advertised and could not record.
 * Insertion point: after the `bound_exceeded` arm. Text-free, no number. */
  | { readonly kind: 'bound_not_configured'; readonly bound: IngestBoundKey }

/* §B, on IngestArrival — required-and-nullable, G102, never optional.
 * The null arm means "F12 did not return", and a migration CHECK ties it to the two
 * arms that permit it: `sanitiser_did_not_complete` and a pre-sniff `bound_exceeded`. */
  sanitisedAt: Timestamp | null
  sniffedKind: SniffedContentKind | null

/* §B — the reprocessing gate returns a TRIGGER, not a boolean. §5.2, and I7's property
 * rather than I7's landmark: a reprocess is triggered by the specific configuration act
 * that removes the specific reason, never by "a configuration changed". */
export type ReprocessTrigger =
  | 'never'
  | 'on_endpoint_registration'
  | 'on_document_type_resolution'
  | 'on_mapping_promotion'
export const REPROCESS_TRIGGER_FOR: Record<ArrivalRefusal['kind'], ReprocessTrigger> = { /* 15 arms */ }

/* §B, on IngestArrival — nothing bounded the loop and nothing showed an operator it was
 * looping. The BOUND is O-8's; this field only makes its absence visible. */
  attempts: number
  lastAttemptedAt: Timestamp | null

/* §B — the erasure reach gains a third member and fails closed until a registration is
 * observed. `registerSubjectLocation` has no implementation anywhere in this repository. */
export type ArrivalErasureReach =
  | 'indexed_if_registered'          // ← NEW. Resolves to `out_of_reach` until observed.
  | 'addressable_subject_unknown'
```

Plus: `arrivalBlobLocation()` **deleted** (§1.2e); the content-key index made **partial** on
`refusal_kind IS DISTINCT FROM 'duplicate_of_earlier_arrival'` (§1.2c), with a `superseded` row
inheriting the earlier arrival's `purgeAfter` so the two-clocks argument is not reintroduced by a
redrive (red-residue N3); the disposition and refusal-kind columns become
`GENERATED ALWAYS AS … STORED` so the database derives the duplicates the module header forbids storing
(red-residue S5); and `tenantId` becomes `readonly` (red-residue N4 — `TenantScoped`'s own comment is
*"it does not select one"*, and a mutable field is a field something can select).

**RULED — capability 39.** `view_arrival`, classed `tenant_data`, in the landing commit, taking the
`CAPABILITY_RESOURCE_CLASS` (`model/access.ts:556`) and `DELEGABLE_TO_AGENT` compile errors as G128
records them biting. Derived: `awk '/^export const CAPABILITIES = \{/,/^\} as const/' model/access.ts |
grep -cE '^  [a-zA-Z]+:'` → **37**, and **none** names an arrival, an artefact or a residue. Without it
green's own invariant-10 claim has no grant to carry, and the first engineer reaches for
`view_document` — which lets every document reader enumerate every unrouted counterparty filename in
the tenant's landing prefix. ⚠️ **The owner may veto this**: minting a capability is a platform release,
and C14 already mints one. Two is not three, and I am recording the count rather than letting it drift.

🛑 **OPEN.** Where the residue renders (**O-9**) — and it is not the `Coverage` figure (§1.2h). The
un-attributable arrival (no resolvable tenant) still gets **no row anywhere**, which is invariant 1
working and is the argument for R5(iv)'s checker. The PostgreSQL major version (**O-13**) gates
`NULLS NOT DISTINCT`.

### 4.2 Correction / re-parse

**SETTLED — the argument, which is the most valuable thing in either report.** Only two streams in the
whole model are hash-chained (`grep -rn 'chain: RecordChain' model/*.ts` → 2), so **an in-place
recapture leaves every chain valid and every anchor matching while silently changing what every
recorded finding means.** Nobody in six prior reports said this. It is the correct ground for a
compensating shape and it is not an aesthetic one. The append-only capture ledger, the
one-live-capture partial unique index on `ProcedureStepExecution`'s verbatim rule, `run_input_document`
as a projection rather than an entity, and *"there must be no cross-run money conservation
post-condition"* all survive every attack made on them.

**SETTLED, amended.** `DocumentCapture` gains a fourteenth `RetentionClass` (`document_capture`, kind
`content`), `purgeAfter`/`purgedAt` computed at capture time, and a twelfth `SubjectLocation` variant
`{ kind: 'document_capture'; sourceDocumentId; version }` — **three simultaneous failures**
(`RETENTION_RECORD_KIND`, `PLACEHOLDER_RETENTION_POLICY`, and `check:wire` on both
`tools/check-wire-mirror.mjs:74` and `:99`) which is the totality biting and is why it must land in the
same commit. `mayRecapture()` takes a `ManagedServiceResolution` and refuses on `ok: false`; loses
`captureLedgerIsAppendOnly`; gains `holdsTriggerRun` read against `mode`; splits `erasure_requested`
from `retention_window_elapsed`; and compares its bound against `SELECT count(*) FROM recapture WHERE
plan_id = $1` inside the same `withTenantScope()` transaction as the insert. `RecapturePlanItem.location`
narrows to `Extract<SubjectLocation, { kind: 'source_document' | 'match_group_key' |
'explanation_observed' }>`, which makes green's own three-variant claim a compile error to violate.

**SETTLED — the replay key, on the owner's ruling.** G120's persistence key becomes
**content-addressed**, and the fix green proposed reproduced the defect it removed because
`requestOrdinal` is field one of `ReaderRequest` (`model/reconciliation.ts:2194`) and `canonicalise()`
walks every own key at every depth. Declare the hashed body **as a type**, not as a sentence:

```ts
/* model/reconciliation.ts, beside ReaderRequest. The hashed projection is a TYPE, so a
 * sixth field on ReaderRequest is a compile error at the replay key rather than a silent
 * 100% cache miss — and two writers cannot disagree about cache identity, which is the
 * class G20's RFC 8785 ruling exists to prevent. */
export type ReaderReplayBody = Omit<ReaderRequest, 'requestOrdinal'>
export type _ReplayBodyIsTheRequestMinusItsPosition = Assert<
  [Exclude<keyof ReaderRequest, 'requestOrdinal'>] extends [keyof ReaderReplayBody] ? true : false
>
```

🛑 **AND THE SEQUENCING CONSEQUENCE THE OWNER'S RULING CARRIES.** `canonicalise()` **refuses `bigint`**
(`model/canonical.ts:66`), so **G111's money codec is sequenced BEFORE the reader executor** — because
the day G65 retypes `Money.amountMinor` to `bigint`, every content-addressed key over a body that ever
touches money stops computing. Today `Money.amountMinor` is `number` (`model/domain.ts:535`), so
nothing is broken and nothing is safe either. §6 places it.

🛑 **OPEN, and it is the largest open item in the pass.** **O-20 — does v1 build correction at all?**
Every structural precedent this design copies is `@dropped-for-v1`, and one of the six markers reads
*"retraction is unbuilt in v1; a wrong promotion is undone by hand."* Building an automated retract →
plan → recapture → rerun path for mappings while the analogous learning path is deliberately manual
**may well be right** — a mapping binds the amount path and a learned rule moves a disposition — but it
is a scope decision with a G number, not a derivation, and green presents it as the latter. Also open:
**O-21** (does a correction of our own error meter — `Exception.carriedForwardFrom`'s docblock says the
field exists partly to stop `exceptions_raised` inflating on a re-run, and no arm enforces the
carry-forward) and **O-22** (may a platform principal suspend a mapping she promoted — red-correction S1
is G60's shape in miniature). **No reference in the model can name a superseded capture**
(red-correction S4), so the preserved old capture is unreachable and a finding computed over v1 is
drawn over v2's document; the ledger's value is preservation, not retrieval, and the design must **say
so** or add `ObservedValue.capturedVersion`. That is a `domain.ts` change with its own plan.

### 4.3 The mapper seam

**SETTLED.** Three mechanisms are better than the applied code they were copied from and all three hold:
the singular untrusted header with `_MapperRequestCarriesExactlyOneHeader` (an assertion where the
reader has a comment — `model/reconciliation.ts:2194` region states the property in prose and nothing
checks it), the two-sided pin on the shared refusal vocabulary, and the closed `ValueCodec` that cannot
carry an op list (`_NoCodecArmCarriesOps`, which red-mapper-seam compiled in both directions).
Refusing to mint `SchemaMappingId` before the interface exists is the 9 Aug dangling-brand lesson
applied prospectively. Refusing to rank two `DataClass` values is upheld: four copies of that ladder
already exist and `DATA_CLASS_RANK` is at `model/learning.ts:1773`.

**SETTLED, amended.** Six changes, all argued at §1.5:

```ts
/* §A — the builder calls the validator FIRST and a non-empty result produces NO requests. */
export interface MapperRequestBuild {
  readonly requests: readonly MapperRequest[]
  readonly skipped: readonly { readonly ordinal: number; readonly reason: MapperSkipReason }[]
  readonly boundDefects: readonly BoundDefect[]
  readonly schemaDefects: readonly ObservedSchemaDefect[]     // ← NEW, §1.5a
}
export function buildMapperRequests(
  schema: ObservedSchema,
  documentType: DocumentType,          // ← was `fields: readonly FieldSpec[]`, §1.5b
  candidateMaxDataClass: DataClass,
  bound: IngestBound,
): MapperRequestBuild

/* §A — three of four verdict arms are REPORTED, not discarded. `applyReaderVerdicts`
 * (model/reconciliation.ts:2451) keeps its finding as a ResidueCause; this keeps its own. */
export type MapperUnresolved =
  | { readonly kind: 'refused'; readonly refusal: MapperRefusal }
  | { readonly kind: 'several'; readonly candidateIndices: readonly number[] }
  | { readonly kind: 'no_field' }
  | { readonly kind: 'unreadable' }
export type _MapperUnresolvedHoldsNoTextDeep = AssertNoTextDeep<MapperUnresolved>

/* §A — the arm the design could not express, and B2's honest answer. `dmy` versus `mdy`
 * is not model-decidable under O-4; a guess is not G124's accepted cost. */
  | { kind: 'field_codec_ambiguous'; candidateIndex: number; codecIndices: readonly number[]
    ; confidenceBasisPoints: number }

/* §A — the punctuation class SPLITS, so DateSeparator and GroupSeparator become DERIVABLE
 * rather than guessable. Five integers and five labels. Platform-authored, closed. */
export const CHARACTER_CLASS_INDEX = {
  digit: 0, upperLetter: 1, lowerLetter: 2, space: 3,
  dash: 4, slash: 5, dot: 6, colon: 7, otherPunctuation: 8,
  signMark: 9, currencyMark: 10, other: 11,
} as const

/* §A — the candidate exemption gets its own narrow proof, so a sixth text field on the
 * widest channel in the request needs a diff somebody must justify. */
export type _MapperCandidateFieldCarriesNothingButLabelAndPath =
  AssertNoTextDeep<Omit<MapperCandidateField, 'label' | 'fieldPath'>>

/* §A — ColumnProfile becomes a union so the determining fields are STRUCTURALLY ABSENT
 * below the k-anonymity floor. G44's technique; suppression of a field left six behind. */
export type ColumnProfile =
  | { readonly kind: 'profiled'; readonly ordinal: number; /* … */ }
  | { readonly kind: 'suppressed'; readonly ordinal: number }
```

Plus: `MapperRefusal` splits into `MapperSkipReason` (never sent) and `MapperRefusal` (an interaction
happened) — §5.5, red-mapper-seam S9; `seedFromDigest` reads 13 hex digits and `stride === 1` becomes
`row_count_below_spread_demand`; the held-out set is **redrawn at promotion** with the promoted
mapping's id in the seed, which is the one mitigation a sender cannot grind because the id does not
exist when the file is authored; `requestOrdinal` is stated as **privileged-side, copied from the
request sent, and a response body carrying one is ignored**, with `outcome_names_no_request` as a
reported arm rather than a silent `continue`; and every `Assert<>` gets a `@ts-expect-error` negative
twin in `tests/model/mapper-seam.test.ts`, because `Assert<never>` compiles — **verified in the same
battery: `export type _Never = Assert<never>` produced no error.**

**SETTLED — two new `RetentionClass` members** for `ObservedSchema` and `SchemaMappingProposal`
(red-mapper-seam S4). Both are persisted rows holding a derived projection of keys G106 declares
unreadable; neither had a window, and the totality that would have caught it is keyed on the class list.

🛑 **OPEN.** **O-17** (what goes into the structural fingerprint — T-3 generalised `headerSetHash`, and
C13's drift refusal is *"exactly equal"*, so if the hash normalises anything the refusal is weaker than
it reads); **O-18** (the `ValueCodec`'s initial membership — the owner should see the inexpressible
list); **O-19** (how an agent proposer is recorded, since `ProposalActor`'s agent arm requires a
`ProcedureStepId` and there is no procedure at onboarding). **And the probe does not exist** — §7.

### 4.4 The integrity trio inside `model/reconciliation.ts`

**SETTLED.** `MoneyUnit` with `_MoneyIsAMoneyUnitPlusAnAmount` (extended to assert over keys **in both
directions**, red-integrity NOTED 11 — as written it catches drift in one type and not the other);
`checkPopulationIntegrity()` as one exported pure pass in `bindingsAgree`'s idiom;
`ControlTotal` as a **three-arm union** because a nullable pair cannot distinguish *"no trailer"* from
*"trailer missing"* — red-integrity looked for a fourth state the union cannot express and found none,
and mutation 5.3(d) makes the counter-example **inexpressible**, which is the strongest form of proof
in the four designs.

**SETTLED — the order, against the first adjudication.** `docs/build/ingestion-pipeline.md:429` lists
*"C18 + C17 + C16"*. **C16 lands FIRST**: C18's comparison sums a document's admitted gross through
`sumGross` (`model/reconciliation.ts:1463`), which folds `addMoney` and refuses across units, so under
HEAD's seeding a control total is compared against a quantity **the file chose the denomination of**.
Order: **C16 → C17 → the mixed-address fix → C18 → C13.** Both integrity reports agree and I agree with
both.

**SETTLED, amended.** All six changes are argued at §1.3, plus three the reds found and neither green
named:

```ts
/* §3, beside guardMoney — so the sentinel's property holds and G111 finds one more site
 * INSIDE §3 instead of one outside it. Two new MoneyRefusal arms, because one kind for
 * three operator errors is §5.2. */
export function guardUnit(unit: MoneyUnit): MoneyRefusal | null
//  MoneyRefusal gains: currency_not_stated | exponent_not_a_non_negative_integer

/* §4a — the ceiling gate REFUSES the off-switch, and the observed rate is recorded
 * UNCONDITIONALLY. `exhaustedBuckets`' posture (G114): a bound that was hit is recorded,
 * never silently absorbed. A permissive ceiling can then suppress the REFUSAL and cannot
 * suppress the EVIDENCE — which is what makes the remediation "read the rate" rather than
 * "disable the control". This needs NO number from the owner. */
  if (ceiling < 0 || ceiling >= 10_000 || !Number.isInteger(ceiling)) {
    return { ok: false, refusal: { kind: 'admission_refusal_ceiling_not_stated' } }
  }
//  and on SetReconciliationResult:  readonly admissionRates: readonly { side; presented; admitted; refused }[]

/* §9 — the operand C13's non-configurable half never had. checkPostconditions takes
 * admission's OWN per-side counts, which admitPopulation already computes, so
 * `population_wholly_refused` and `population_empty` are COMPUTED rather than
 * reverse-engineered from the residue — which cannot distinguish them. */
export function checkPostconditions(
  state: MatchingState,
  residue: readonly ResidueEntry[],
  admission: readonly { side: PopulationSide; presented: number; admitted: number; refused: number }[],
): readonly PostconditionFailure[]
//  PostconditionFailure gains: population_wholly_refused { side; presentedCount }
//                              and the five C18 comparison arms (§1.3b)

/* §9 — the LIVE conservation defect in the existing tree that neither document named,
 * and it is owed on its OWN commit because C17 would MASK it rather than fix it.
 * Walked at ece079d2: `seen` is built over RESIDUE itemKeys (:2686); the admitted copy of
 * a duplicated address shares that key, so `const inResidue = (seen.get(item.key) ?? 0) > 0`
 * (:2706) is TRUE for the admitted row while the residue entry is the OTHER row's.
 * Therefore `accountedMinor` credits the admitted row's residual as residue-carried and
 * `if (!inResidue) missing += 1` (:2718) never fires — so
 * `open_item_missing_from_residue` (:2721) cannot fire and `gross_not_partitioned` (:2727)
 * balances over a ledger missing a transaction, with `postconditions` EMPTY. */
//  FIX: build `seen` only from residue entries whose `settlement !== null`,
//       or namespace itemKey by disposition. Its own commit, its own mutation.
```

Plus: `presentedCount` is renamed by grain (`documentRowCount` on the C18 arms, `sideRowCount` on the
C13 arm) with a docblock sentence forbidding aggregation across arms — red-integrity SERIOUS 9, one
vocabulary for three concepts inside a plan that cites §5.3 nine times; `exponent: number` is added to
the two minor-unit arms (NOTED 12) in the one control whose whole subject is a hundredfold error; an
**early return** after the C17 walk (NOTED 13), because the checker's own docblock says order is part of
the contract and the code then falls through and reports two false defects beside one true one; one
exported `presentedRowCount(document)` called by both `admitPopulation` and `checkPopulationIntegrity`
(NOTED 14 — two independent counts, one rule); `MoneyRefusal` gains `{ kind: 'no_items' }` because
`sumGross([])` returns `currency_mismatch` today (`model/reconciliation.ts:1463-1465`), a reason arm
that is simply false; and §1 row 14's claimed reuse of `indexBy` is **deleted** (NOTED 16 — the code
correctly hand-rolls a `Map`, and new machinery presented as reuse is the row a reviewer skips).

**SETTLED — `unique_within` is ruled UNBUILT with a dated drop note**, on all three of green's grounds.
Red tried hard to break it and could not, and I agree: `period` and `tenant_lifetime` need reads
outside the run, and the engine *"has no authority, no clock, no identity and no network"*. ⚠️ The
marker moves a governed count — `grep -rho '@dropped-for-v1' model/*.ts | wc -l` is **235** at
`ece079d2` and becomes 236, so `node tools/check-doc-counts.mjs` reports `CLAUDE.md:90` (which still
says 230) STALE **in the same commit**. Fix it there. 🛑 **But whether the PRODUCT ships without cross-run duplicate-invoice
detection is O-14, not mine** — `docs/domain-model.md:755` currently says it ships.

🛑 **OPEN.** **O-15** (is an empty population a defect); **O-16** (may `postconditions` mean *"the
population is incomplete"* as well as *"the ledger is unsound"* — adding the arm widens what
`SetReconciliationResult.postconditions` claims, and the sentence must widen in the same commit or the
arm is filed under a claim it does not make). **A2 is still open and neither pass closes it**: the
document array handed to `runSetReconciliation` is ordered by nothing stated, and a corrected rerun that
hands documents in a different order produces a different audit over the same facts — which is the one
property correction exists to establish.

---

## 5. Amendments to the first adjudication's control set

Control by control, with what was wrong. **C2, C4, C7/C8, C9, C13, C16, C17 and C18 all need
amendment, and I checked each myself** — the report was right about all eight, and three more need it.

| | As `docs/build/ingestion-pipeline.md` §5 states it | The amendment, and what was wrong |
|---|---|---|
| **C1** | `resolveManagedService()` — *"✅ written `model/policy.ts:1781` · 🛑 no caller"* | **Unchanged and still true at `ece079d2`.** `grep -n 'export function resolveManagedService' model/policy.ts` → `:1781`; no production caller. What changes is who the first caller is: §6 step 4, not the recapture gate (§1.4c). |
| **C2** | *"`PolicySubject` gains a `managed_service_call` arm. Today it has four (`model/policy.ts:890`)"* | 🛑 **AMENDED — and this is the most important amendment of the pass, because C2 would be recorded as APPLIED while being INERT.** Verified at `ece079d2`: the model union at `model/policy.ts:890` is discriminated on **`type`**; the wire schema at `docs/contracts/foundation.openapi.yaml:891` is discriminated on **`kind`**, declares `additionalProperties: true` and `required: [kind]`, carries a five-member enum at `:899` — `[exception, run, document, correspondence, procedure_step]` — and asserts of itself at `:893` *"Mirrors PolicySubject in model/policy.ts."* Three wire members exist in no model arm; two model arms exist nowhere on the wire; and `tools/check-wire-mirror.mjs:72` pins five pairs of which `policy_subject` is not one. **The amendment: add the sixth pair BEFORE the arm, so C2's landing commit goes red until both sides move; then decide the discriminant once and set `additionalProperties: false` as every other request schema on that file does.** The G75 shape exactly — a third list nobody named makes a ruling a no-op. |
| **C3** | *"ONE gateway, TWO checks, NO third way"* | Unchanged. |
| **C4** | *"`IngestBound` — eight named bounds. Required, no defaults, refusing on absence"* | ⚠️ **AMENDED twice.** (a) The units: a `Record<K, number>` makes a ratio and a byte count interchangeable — §1.2a, and the fix is §2.2's mapped record with a branded numeric per dimension. (b) **The declaration: one record, in `model/ingestion.ts`, sixteen fields** — two greens declared it incompatibly and no adjudicator saw it (§2.2). (c) It also needs a **`bound_not_configured`** arm, because the fail-closed state C4 advertises had nowhere to be recorded. |
| **C5** | `NativeTextOutcome`, four arms | Unchanged. Note `AssertNoTextDeep<NativeTextRefusal>` becomes meaningful only after step 1. |
| **C6** | `admitTextLayer()`, four tests | Unchanged. Its clause (d) — extracted line amounts reconcile with the extracted total — now routes through `guardUnit`/`sumGross` per §4.4 rather than through a hand comparison. |
| **C7 / C8** | *"nothing in `model/` constructs a `SourceDocument`, so `tsc` stays green"* | ⚠️ **AMENDED, and the truth is better than the claim.** Verified: three live construction sites in `tests/`, each supplying every field explicitly — `documentOf()` at `tests/model/reconciliation-conservation.test.ts:145`, `doc()` at `tests/model/reconciliation-passes.test.ts:120`, `documentOf()` at `tests/model/learned-dispositions.test.ts:151`. So adding a required `SourceDocument` field goes **RED at three sites immediately**, at `npm test` rather than at `typecheck`. **What was wrong:** the stated conclusion *"`tsc` will tell you nothing"* leads an implementer to expect a green run and write the fixture as an afterthought. §5.10's lesson still holds for `DocumentCapture`, `RecapturePlan`, `MappingRetraction`, `Recapture`, `IngestArrival`, `MapperRequest`, `ObservedSchema` and `SchemaMappingProposal`, which genuinely have none. |
| **C9** | *"`AssertNoTextDeep<ColumnProfile>` — the containment proof on the REQUEST path, **which nothing in the tree has today**"* | ⚠️ **AMENDED twice.** (a) The word **deep** is missing: `_CarriedTurnHoldsNoText = AssertNoPlainText<CarriedTurn>` (`model/identity.ts:1189`) is a shallow request-path proof and `NoPlainText` (`:1139`) does not recurse. (b) 🛑 **The proof C9 names does not hold** — §3. Post-inversion C9's control is real; pre-inversion it is §5.6 in the summary table a reader trusts most. |
| **C10** | The mapper seam, `MapperVerdict` four arms, *"verify it RED before trusting it green"* | ⚠️ **AMENDED.** The *"verify it RED"* instruction is upheld and is the reason this pass has an answer at all — but it must be verified red against **the seven escapes in §3.1**, not against `columnName: string`. And the fold must not discard three of four arms (§1.5c). |
| **C11** | `SchemaMappingProposal` / entries / codec unions; *"the model may not propose an `IdentifierNormalisation`"* | ⚠️ **AMENDED.** The R3 half holds and `_NoCodecArmCarriesOps` makes it total. Add: the codec list needs a **cap** (`maxCodecCandidates`), the entry's `observedOn` needs a **stated derivation** (the skeleton with the highest `occurrences` — the shape the codec was chosen for), and the codec vocabulary must gain the `field_codec_ambiguous` verdict or it requires a guess where G124 accepted a refusal. |
| **C12** | *"Deterministic SPREAD sampling seeded from the content hash"* | ⚠️ **AMENDED.** The idea is right and free; the **arithmetic** walks A8's head sample back in (`seed % stride === 0` for every power-of-two stride, because a 256-bit digest read as a double is an exact multiple of a large power of two). And the seed is **adversarially grindable** — the held-out set C13's floor is computed over must be redrawn at **promotion** with the mapping id mixed in. |
| **C13** | *"a conformance floor … adding `mapping_conformance_below_floor` to `SetReconciliationRefusal`"* | 🛑 **AMENDED four times, and it is the most-corrected control in the set.** (a) It **splits**: the configurable rate → a refusal; a wholly-refused population → a **post-condition**, because refusing deletes the residue and `unclassifiedFieldFailsClosed` (`tests/scenarios/recon-corpus.ts:1946`) is the corpus scenario whose entire point is that a G106 refusal lands in the residue with its reason. (b) The ceiling's permissive extreme is an **off-switch**, so the gate must refuse it and the rate must be **recorded unconditionally**. (c) The non-configurable half **has no operand** — `checkPostconditions` is `(state, residue)` (`model/reconciliation.ts:2681`) and `state.items` holds only admitted items, so the property is reverse-engineerable from the residue only, which cannot distinguish a wholly-refused side from an empty one. (d) `mapping_conformance_below_floor` is the ingestion team's arm and belongs on the same union; **the two must not be collapsed** — one says the mapping did not fit the held-out sample, the other says this run's rows did not parse. |
| **C14** | `promote_field_mapping`, `authority`, never in the partner mask | Unchanged, and reinforced: `CONTRACT_ONLY_RESOURCES` (`model/governance.ts:512`) is what keeps a standing G75 delivery grant out of it. **Add `view_arrival` as capability 39** (§4.1). |
| **C15** | The probe is an enumerated, authorised, audited act under `REQUIRES_ENUMERATION` (`model/governance.ts:497`) | Unchanged. `ObservedSchema.sourceDocumentId` is the field that makes the enumeration expressible; keep it required. |
| **C16** | *"Currency is DECLARED, never inferred"* | ⚠️ **AMENDED three times.** (a) It lands **first** in build row 3, not last. (b) The statedness gate must be `guardUnit()` **inside §3**, not three lines below `_MoneySectionEndsHere` where the `money-sentinel` control cannot see them. (c) It must **compare the two sides** and the tolerance, or a per-side declaration admits every row on both sides and reports a 100%-fail close as SOUND. Also: the citations. The parameter is `expectedCurrency` at `model/reconciliation.ts:1004` and the comparison at `:1024` — **neither document cites the seeding lines, which are the actual defect.** |
| **C17** | *"The duplicate becomes a named outcome; the `Map.set` at `model/reconciliation.ts:2835` must not be the dedup mechanism"* | 🛑 **AMENDED, and the amendment changes what C17 IS.** `itemKey(side, ref)` is `${side}:${len}:${id}:${line}` (`model/reconciliation.ts:809`) — an **ADDRESS**. So the overwrite needs a repeated *address*: a re-delivered file, or a `lineIndex` minted from insertion order — **not a repeated invoice number.** The corpus's own duplicate-invoice scenario (`tests/scenarios/recon-corpus.ts:1329`) keys `INV-3050` at two line indices, does not collide, and is already correctly an `AmbiguityFinding`. **Therefore C17 is NOT duplicate-invoice detection**, it is narrowed to duplicated addresses with **at least one admitted copy**, and the **mixed** case is a live conservation defect in the existing tree owed on its own commit (§4.4). As written, C17 *"would have had somebody build duplicate-invoice detection out of a `Map.set` guard."* |
| **C18** | *"`expectedLineCount` and `declaredControlTotal` … plus a `population_control_total_mismatch` refusal"* | 🛑 **AMENDED twice.** (a) A **refusal hands a counterparty a one-cell kill switch on the whole close, and it deletes the residue** — both operands are counterparty-controlled content parsed from the file's last row, and `ok: false` carries no residue, no per-row reasons and no post-conditions. The five comparison arms become post-conditions plus a `ResidueCause`; `expected_but_absent` may refuse and must be argued for **one** arm rather than assumed for six. (b) `not_declared_by_format` is **decided by the same actor that produced the rows** — bind it to a `DocumentType` declaration, or a refactored shredder makes C18 inert for every file in production with `npm run check` green. |
| **C19** | *"The ingestion RESIDUE as a first-class population … the object is undesigned"* | ✅ **The object is now designed** — and it needs the six amendments at §4.1 plus capability 39. **The control is not closed**: where it renders is O-9, and nothing in the model authorises reading it today. |
| **C20** | Process and plane — no credentials, no database, no egress | Unchanged, and it is the premise green-residue derived `sanitisedAt`'s non-nullability from. The derivation was refused; the control was not. |
| **C21** | No DLQ as a separate store | Unchanged. |
| **R5(ii)** | Three idempotency keys | ⚠️ **AMENDED.** The file-grain key needs a **partial** unique index or the named duplicate has no writer (§1.2c). |
| **R5(v)** | *"a duplicate must be a NAMED OUTCOME"* and `unique_within` gets an evaluator or a drop note | ⚠️ **AMENDED.** Drop note, not evaluator (§4.4), and the named outcome is a **refusal at an address**, not a finding about a value. |
| **build row 3** | *"C18 + C17 + C16"* (`docs/build/ingestion-pipeline.md:429`) | ⚠️ **REVERSED: C16 → C17 → mixed-address fix → C18 → C13.** |

---

## 6. The ordered build — phase one, disposable Postgres, in-process `pg.Pool`, NO AWS resource

**G101 is deliberate.** Every step is a pure function, a type with a compile-time proof, or a
transaction against local Postgres. **The proof inversion is step 1 and nothing containment-dependent
precedes it.** Each row names the existing test file it extends.

| # | Step | Extends | Why here |
|---|---|---|---|
| **1** | 🛑 **THE PROOF INVERSION.** `model/reconciliation.ts:248-258` → §3.2's `ValueFreeLeaf`. Own commit. Verified RED against **every row of §3.1** before it is trusted green. Plus the `grep -c 'class ' → 0` source-text control for the one escape the type cannot close, and the `CHARACTER_CLASS_INDEX`-is-numeric assertion for the other. | `tests/model/reconciliation-controls.test.ts` (the comment-stripping harness and the `money-sentinel` control at `:309` are the shape) | **Everything else in this pass is downstream of this proof.** Thirteen live assertion sites accept a `ReadonlyMap<number, string>` today. Building the mapper seam first ships a module whose entire argument for existing is a control that passes while asserting nothing. |
| **2** | The **`policy_subject` wire pair** — a sixth entry in `tools/check-wire-mirror.mjs:72`'s `PAIRS`, which needs a `literal_union` source kind because `PolicySubject`'s wire enum has no `kind` discriminant. Then the discriminant decision and `additionalProperties: false`. | `tests/tools/check-wire-mirror.test.mjs` | It must go red **before** C2's arm lands, or C2 is recorded as applied while inert. This is engine work in `tools/`, not a one-liner, and saying so is part of the estimate. |
| **3** | **C16.** `MoneyUnit` + the two-directional key assertion; `guardUnit()` in §3 with two new `MoneyRefusal` arms; `PopulationBinding.declaredUnit`; the renamed `AdmissionRefusal` arm; `admitOne`/`admitPopulation` stop seeding; the cross-side and tolerance comparisons. | `tests/scenarios/recon-corpus.ts` (one `ledgerBinding`/`bankBinding` change reaches 22 scenarios) · `tests/scenarios/engine-behaviour.test.ts` · `tests/scenarios/export-surface.test.ts` | First inside build row 3, per §5. Highest blast radius in the repository — **plan before implementing**, per `CLAUDE.md`. |
| **4** | **C1's caller + C2's arm + C3's gateway.** `resolveManagedService()` gets a production caller; `PolicySubject` gains `managed_service_call`; the two-checks-one-gateway shape. | `tests/model/managed-service.test.ts` · `tests/contracts/g75-wire.test.ts` | The tier the proposal spends most on still has no executable residency check in any call path. Step 2 makes this commit red on both sides until both move. |
| **5** | **C17**, narrowed. `PopulationDefect` with its first arm and its containment proof; `checkPopulationIntegrity`; the fold guard. Then **the mixed-address `seen`-map fix as its own commit with its own mutation**, because C17 would mask it. Plus the `unique_within` drop note and the `CLAUDE.md` marker count. | `tests/scenarios/recon-corpus.ts` (F5, F6) · `tests/model/reconciliation-conservation.test.ts` (the `seen`-map defect is a conservation test) | Mutation 5.2(b) — delete both the walk and the fold guard — is the one mutation to run and record: it demonstrates the defect by showing a **green** conservation check over a population one row short. |
| **6** | **C18.** `ControlTotal` three-arm union + `SourceDocument.controlTotal` + the `DocumentType` trailer declaration (type-only commit, then the checks). The five comparison arms are **post-conditions**; `expected_but_absent` refuses. `presentedRowCount()` shared. | `tests/model/reconciliation-conservation.test.ts:145` · `tests/model/reconciliation-passes.test.ts:120` · `tests/model/learned-dispositions.test.ts:151` (all three go red on the new required field — C7/C8 amended) · `tests/scenarios/recon-corpus.ts` | The type-only half is mechanical and **a green run here proves nothing** (§5.10). Say so in the commit message. |
| **7** | **C13.** The input field, the gate that refuses `10_000`, the recorded `admissionRates` fact, the widened `checkPostconditions` signature, `population_wholly_refused`, the widened `postconditions` sentence. | `tests/scenarios/recon-corpus.ts` (F13–F16) · `tests/scenarios/engine-behaviour.test.ts` | Needs step 3's units and step 6's counts. Blocked on **O-16** for the widened claim, not for the code. |
| **8** | **`model/ingestion.ts` §A** — `IngestBound` (§2.2), `BOUND_DIMENSION`, `validateIngestBound`, `selectSample` with the fixed-width seed, the split character classes, `ColumnProfile` as a union, `UntrustedHeader`, `ObservedSchema`, `validateObservedSchema` **called first**, the codecs, `MapperRequest`, `MapperVerdict` with `field_codec_ambiguous`, `MapperUnresolved`, `notImplementedMapper`, the two new ids and their two `identity.ts` entries. **All containment proofs are candidate B's.** | `tests/model/mapper-seam.test.ts` (new) · `tests/model/ingest-sampling.test.ts` (new) · `tests/model/runtime-importability.test.ts:45` and `:135` (`MODULE_COUNT` → 19) · `tests/scenarios/export-surface.test.ts` (every new export needs a call site, in both directions) | The seam is safe to build only after step 1. `export-surface.test.ts` makes the fixture obligation mechanical rather than moral. |
| **9** | **`model/ingestion.ts` §B** — the arrival ledger with all six amendments, `REPROCESS_TRIGGER_FOR`, the erasure reach's third member, capability 39 and its `CAPABILITY_RESOURCE_CLASS`/`DELEGABLE_TO_AGENT` compile errors. | `tests/model/ingest-arrival.test.ts` (new) · `tests/model/access-decide.test.ts` (capability 39) · `model/examples.ts` fixtures in the same commit | `IngestArrival` is an interface nothing constructs — the fixture is the only witness, exactly `SubjectLocation`'s position on 8 Aug. |
| **10** | **The migration named `ingest_arrival`** (number allocated when the file is written, §2.1) — RLS, `FORCE ROW LEVEL SECURITY`, the deny-on-NULL predicate, the partial content-key index, the generated `disposition`/`refusal_kind` columns, the per-kind `CHECK` on `refusal`'s key set, and the shred in **one** transaction inside `withTenantScope()`. | `tests/db/tenant-isolation.test.ts` (the G98 two-tenant leak test already asserts same-`pg_backend_pid()`; extend it to this table) · `db/migrations/` | The one step that needs a database and needs **no cloud**. It is also the only place four of the design's controls actually live. |
| **11** | **C14** — `promote_field_mapping`, `authority`, nominate-then-promote, the three second-person triggers, expiry, firing count. | `tests/model/access-decide.test.ts` · `tests/model/learning-promotion.test.ts` (the promotion ordering idiom) | Breaks two total records as compile errors. That is the totality biting. |
| **12** | **`model/ingestion.ts` §C — correction. 🛑 GATED ON O-20** and, for `DocumentCapture`, on the fourteenth `RetentionClass` and the twelfth `SubjectLocation` variant landing with it. | `tests/model/ingest-correction.test.ts` (new) · `tests/contracts/g75-wire.test.ts` (`check:wire` goes red on both new pairs) | Last, because it is the only step whose *existence* is an owner ruling rather than a derivation. |

**Named prerequisites of the reader executor, which is NOT in phase one:** **G111's money codec**
(because `canonicalise()` refuses `bigint`, `model/canonical.ts:66`, and the content-addressed replay
key stops computing the day G65 lands); `ReaderReplayBody` with its key-set assertion; and G118's
standing rule that **no document may describe the seam as having an executor.**

**V1 deployment target, not now:** S3 landing buckets and the prefix→tenant registry, the arrival
trigger, per-tier IAM-isolated functions, Textract, the vision fallback, and the PDF library once its
licence has been read. **A checker joins `npm run check`; it does not stand beside it (G108).**

---

## 7. The verification plan

### What `tsc` can prove
Absent-versus-nullable arms (`ArrivalOutcome`'s `sourceDocumentId` is a `TS2339` at the first read, not
a comment); totality at a construction site (`BOUND_DIMENSION`, `REPROCESS_TRIGGER_FOR`,
`ARRIVAL_DISPOSITION_FOR`, `CODEC_TARGET_FOR_DATA_TYPE`, and `arrivalCoverage`'s `byDisposition`
literal — each is its own construction site, so §5.10 does not apply to any of them); brand mismatch,
through `model/identity.ts`'s two hand-maintained maps; dimension mismatch, after §2.2; the no-plural
arm; the shared-vocabulary pin in both directions; and — **only after step 1** — that a value cannot
reach the mapper.

### What only a fixture can witness (§5.10)
**`tsc` staying green tells nobody anything** for `IngestArrival`, `DocumentCapture`, `RecapturePlan`,
`MappingRetraction`, `Recapture`, `MapperRequest`, `ObservedSchema` and `SchemaMappingProposal` —
nothing in `model/` constructs any of them, and a green run after adding a field to one is not
evidence. ⚠️ **The exception is `SourceDocument`, and it is the amendment at C7/C8:** three live
construction sites in `tests/` supply every field explicitly, so `controlTotal`, `mappingVersionId` and
`captureVersion` go **red at `tests/model/reconciliation-conservation.test.ts:145`,
`tests/model/reconciliation-passes.test.ts:120` and `tests/model/learned-dispositions.test.ts:151`** the
moment they land — at `npm test`, not at `typecheck`. A fixture is also the only thing that
distinguishes *"the proof holds"* from *"the union is unsatisfiable"*: `Assert<never>` compiles, which I
verified in the same battery, so every `Assert<>` needs a `@ts-expect-error` negative twin.

### What only a mutation can prove
The fold guard fires; `sameUnit(gross, declaredUnit)` compares the right two things (arguments of the
right type compile whichever way round they go); the C18 line count is compared against **presented**
and not **admitted** (both are `number`); the C13 rate is `>` and not `>=`; the seed spreads and does
not collapse to offset 0; `population_wholly_refused` is pushed **after** `gross_not_partitioned`
(order is not a type); the `seen`-map key space no longer conflates admitted and refused rows; and
every containment proof goes **red** against §3.1's battery. ⚠️ **A mutation counts only if the
control's error is the ONLY error** — a `TS6133` alongside means `noUnusedLocals` produced the red.

### What NOTHING in this repository can check
1. **Whether the parser told the truth about the trailer.** C18 makes the trailer load-bearing; it does
   not make the parser trustworthy. A parser that emits `not_declared_by_format` for everything defeats
   the control, which is why §1.3d binds the arm to a `DocumentType` declaration — that narrows it and
   does not close it.
2. **Whether a pack is poisoned.** `MapperCandidateField.label` and `.fieldPath` come from
   `DocumentType.fields`, which arrives in a pack, and G110's publication validators have **no call
   site**. Every containment proof in §4.3 holds perfectly while pointing at the wrong fields.
3. **Whether a `jsonb` column holds the text the compiler forbade.** `_ArrivalRefusalHoldsNoTextDeep`
   constrains the TypeScript type; `refusal jsonb` accepts
   `{"kind":"sanitiser_did_not_complete","detail":"zlib: invalid distance too far back"}`. Invariant 6's
   containment ends at the ORM. The per-kind `CHECK` in step 10 is the only mechanism that reaches it,
   and it is a checker nobody has written.
4. **A class instance carrying text privately, and a literal union of observed characters.** §3.4.
5. **Any figure.** No latency, no cost, no page price, no text-layer prevalence, no licence. `PRODUCT.md`
   forbids inventing one and this page asserts none.
6. **Whether a control named here sits on the right declaration**, whether a stated reason is true, or
   whether a rung records the evidence it owes. That remains a person reading this against the tree.
   `tools/check-citations.mjs` scans `docs/build/*.md` and **cannot tell whether a citation points at
   the right declaration** — §1.6 S-3, and every correction in §9 resolves.

**The verification command is one command:** `npm run check` (typecheck, four checkers, and `npm test`).
⚠️ Running the gate rewrites `docs/model-graph.json`, because a test runs the extractor and asserts on
its output. That is the gate working; leave the file alone.

---

## 8. OWNER RULINGS STILL REQUIRED — the canonical O-list

### 8.1 The mapping table, so no reader is stranded

**Nine questions wore three numbers across three green reports, plus two that were unique.** Cite the
canonical number from here on; a local `O-9` in a green report is a draft.

| Canonical | Local number and document | Question, in one line |
|---|---|---|
| **O-9** | `ingestion-p2-green-residue.md` **O-9** | Where the residue renders |
| **O-10** | `ingestion-p2-green-residue.md` **O-10** | A separate retention window for a quarantined artefact |
| **O-11** | `ingestion-p2-green-residue.md` **O-11** | `UsageRecord.arrivalId` |
| **O-12** | `ingestion-p2-green-residue.md` **O-12** | The subject ACCESS answer over a non-admitted arrival |
| **O-13** | `ingestion-p2-green-residue.md` **O-13** | The PostgreSQL major version |
| **O-14** | `ingestion-p2-green-integrity.md` **O-9** | Cross-run duplicate-invoice detection in v1 |
| **O-15** | `ingestion-p2-green-integrity.md` **O-10** | Is an EMPTY population a defect |
| **O-16** | `ingestion-p2-green-integrity.md` **O-11** | May `postconditions` also mean "incomplete" |
| **O-17** | `ingestion-p2-green-mapper-seam.md` **O-9** | What goes into the structural fingerprint |
| **O-18** | `ingestion-p2-green-mapper-seam.md` **O-10** | The `ValueCodec`'s initial membership |
| **O-19** | `ingestion-p2-green-mapper-seam.md` **O-11** | How an AGENT proposer is recorded at onboarding |
| **O-20** | new — `ingestion-p2-red-correction.md` B5 | Does v1 build correction at all |
| **O-21** | new — `ingestion-p2-red-correction.md` S3 | Does a correction of OUR error meter |
| **O-22** | new — `ingestion-p2-red-correction.md` S1 | May a platform principal SUSPEND a mapping |

### 8.2 The rulings, each a question, a recommendation and a cost

**None of these was mine to take.** A threshold, a price, a licence, a scope reopening, a topology
choice and any figure are all the owner's.

| | Question | Recommendation | Cost, stated |
|---|---|---|---|
| **O-9** | **Where does the residue render?** The `Coverage` figure is struck as the answer (§1.2h): `arrivalCoverage()` has no notion of a period and nothing joins an `Endpoint` to a `ReconciliationDefinition`, so it cannot compute the per-run figure drawn on the mockup — and that figure has no definition anywhere. Band D is per-document extraction confidence inside a run, verified. Candidates: a **solution-grain register** nobody drew; a **tenant-wide unrouted list**; or a Coverage figure whose definition is stated as a product decision | **A solution-grain arrival register, and state the Coverage figure's definition separately or drop it.** `Solution.endpointIds` is the only endpoint→configuration join that exists, and `AssignmentScope.solutionIds` already narrows to it | A screen nobody has drawn, so a screen-pack addition. And `no_endpoint_resolved` arrivals have **no owner at any grain** — `endpointId` and `solutionId` are both null — so they are visible only to an unnarrowed assignment. `presentation.ts` is `@dropped-for-v1` whole, so no presentation type may be minted for this |
| **O-10** | **Does a quarantined artefact get its own retention window?** For a non-admitted arrival the window is the **only** erasure control that reaches the bytes | **NO — reuse `source_document`**, on the two-clocks argument: an admitted arrival's bytes *are* the document's blob, so a different window gives one artefact two purge dates depending on whether a parse succeeded | A possibly hostile artefact is kept as long as a good invoice, and nothing can shorten it. If YES: a fourteenth `RetentionClass`, three compile errors, one `check:wire` failure, and a fourteenth window for counsel |
| **O-11** | **Does `UsageRecord` gain `arrivalId: IngestArrivalId \| null`?** Without it, *"which arrivals did we spend the paid-tier bill on"* is unanswerable — and the arrival most likely to have cost the most is the one that never became a document | **YES.** The precedent is favourable: `runId` is already an opaque data-plane scalar the control plane holds and cannot resolve | It is a field on the **one** record class that crosses the plane boundary (invariant 3), so the precondition is absolute: **the arrival slug must be opaque**, minted from the content hash and a counter, never from `filename` |
| **O-12** | **What is disclosed for a subject ACCESS request over a non-admitted arrival?** Finding the subject in the bytes requires reading them, and G106 says they are unreadable | **The metadata only** — `arrivedAt`, `filename`, disposition — **and the content is not searched** | A product and possibly a counsel statement. It means a truthful *"we hold an artefact we cannot read and cannot search"*, which is a harder sentence to write than a technical one |
| **O-13** | **The PostgreSQL major version.** `NULLS NOT DISTINCT` needs 15+, and nothing in this repository records a version | **State it, and pin it in `db/env.ts` or the provisioning script** | Without it the file-grain dedup key silently does not apply where `endpoint_id IS NULL` — the case a person is least likely to notice. The portable alternative reintroduces the empty string as a sentinel, which `0001` argues against |
| **O-14** | **May v1 ship without cross-run duplicate-invoice detection?** `unique_within`'s two load-bearing scopes cannot be evaluated inside `model/` at all, and `docs/domain-model.md:755` currently says the capability ships | **YES for v1**, with the detection ruled as a query owned by whatever owns the database, and `:755` **marked rather than deleted** | A resubmitted invoice from a prior period is not flagged. **C17 does not cover it** and must not be described as covering it — that is exactly the misreading C17-as-written invited |
| **O-15** | **Is an EMPTY population a defect?** A side that arrived as zero documents reconciles against nothing and every row on the other side lands in the residue as `no_strategy_paired` — *"nothing matched it"*, which is untrue | **A `population_empty` post-condition**, on the same argument as `population_wholly_refused`: the residue must survive | A legitimately empty side — no bank activity in the period — reports UNSOUND, which is arguably correct and arguably noisy. Nobody can settle which without a real close |
| **O-16** | **May a `PostconditionFailure` mean "the population is incomplete" as well as "the ledger is unsound"?** Adding the arm widens what `SetReconciliationResult.postconditions` claims | **YES, and the sentence widens in the same commit.** The alternative — a third result channel — is refused because a channel with no caller obligation is C13 one layer up | One channel carries two properties. That is §5.3-adjacent and must be argued in the docblock rather than done quietly |
| **O-17** | **What goes into the structural fingerprint — order, case, whitespace?** T-3 generalises `headerSetHash` to `structuralFingerprintHash`; C13's drift refusal is *"exactly equal"*, so if the hash normalises anything the refusal is weaker than it reads, and if it normalises nothing a cosmetic template change forces a fresh FDE promotion | **Order-insensitive, case-folded, whitespace-collapsed, using the closed `IdentifierNormalisation` op vocabulary and nothing else** — T-3's own mandatory constraint (a) | The normalisation bounds how often a re-nomination fires; a weaker one means more re-nominations and a **second** normaliser means nobody can predict how many. Fold too much and the refusal stops being "exactly equal" while still reading as if it were |
| **O-18** | **The `ValueCodec`'s initial membership.** Named-month dates, non-Gregorian calendars and two-token separators are inexpressible in the design as drawn | **Ship the drawn set, and see the inexpressible list before agreeing.** A codec member with no decoder must not ship — that is why `monthForm` is absent | G124's cost clause, arriving a fourth time: *"the vocabulary must grow to express what regex expresses, and some patterns will be inexpressible. Those stay manual, and that is the correct failure."* Those files go to the FDE by hand |
| **O-19** | **How is an AGENT proposer recorded at onboarding?** `ProposalActor`'s agent arm requires a `ProcedureStepId`, a procedure is walked per exception, and there is no exception at onboarding — so R2's *proposer ≠ promoter* is unverifiable from the row for the agent case | **A new `ProposalActor` arm** rather than a synthetic procedure step. 🛑 **Do NOT launder it into `{ kind: 'user' }` with the FDE's id** — that attributes a model's nomination to a person | It gates the **executor**, not the seam. Until it is taken, only a human-authored mapping is recordable — which is coincidentally the only kind that exists while the seam has no executor. A new arm is a wire change and a `check:wire` pair |
| **O-20** | 🛑 **Does v1 build correction at all?** Every structural precedent it copies is `@dropped-for-v1`, and one marker reads *"retraction is unbuilt in v1; **a wrong promotion is undone by hand**."* Building automated retract → plan → recapture → rerun for mappings **diverges from a standing v1 scope decision** | **YES for mappings, NO for anything else** — because a mapping binds the amount path and a learned rule moves a disposition, which is a real asymmetry rather than a convenient one. **But it is a scope decision with a G number, not a derivation** | A net-new v1 subsystem whose precedents are drawings: a capture ledger, a plan, a per-document gate, eight post-conditions, a fourteenth `RetentionClass` and a twelfth `SubjectLocation` variant. If NO: `MAPPING_RETRACTION_UNMAKES_DOWNSTREAM = false` is the whole answer, a wrong mapping is undone by hand, and C8's `mappingVersionId` makes the blast radius **enumerable without making it fixable** — which is the state the first adjudication already recorded as nobody's |
| **O-21** | **Does a correction of OUR OWN mapping error meter?** `Exception.carriedForwardFrom`'s docblock says the field exists partly to *"stop the billable `exceptions_raised` meter inflating on every re-run"*, and no arm of the correction design enforces the carry-forward | **NO for a platform-caused correction**, and the mechanism is the carry-forward rather than a discount: the corrected run's exceptions carry `carriedForwardFrom` wherever `(ruleId, keyValues, lineKey)` matches, so the meter is derivable both ways | Without a ruling, a 40,000-document correction of our own error can add ~39,600 fresh billable exceptions to a customer's invoice. Invariant 5 holds formally — `UsageRecord` stays immutable and unpriced — and the volume in the clear is wrong |
| **O-22** | **May a platform principal SUSPEND a mapping she promoted?** `mayRetractMapping()` refuses every non-customer principal, so the FDE who bound a running-balance column to `amount` under a signed `SupportAuthorisation` cannot stop it. That is G60's shape in miniature — the invariant as written makes the FDE's own job structurally impossible | **YES for `suspend`, NEVER for `retract` or recapture**, with a reserved reason (`binding_suspected_by_platform`) refused to tenant principals — the mirror of `mayRetractLearning()`'s applied `contamination_suspected` arm | It is a **scope** question and that is why it is here rather than ruled: `authority` and `CONTRACT_ONLY_RESOURCES` exist precisely to admit a contract-authorised staff principal, and green's org gate refuses all of them **before** the class is consulted, which makes the whole `authority` argument decorative. If NO: a live wrong mapping keeps parsing incoming files until a customer-org principal is woken |

⚠️ **O-8's numbers are still the blocker they were, and pass two added two consequences the row must
carry:** the refusal needs an arm that can record an unconfigured bound **with no number in it**
(§2.2), and **a ceiling whose permissive extreme is *off* is an off-switch, not a bound** (§1.3a).
Neither is a new number. And O-8 now covers sixteen bounds rather than eight, including
`minDistinctValuesToProfile` — whose cost nobody stated: **a currency column holding one value is
suppressed, so it is the one column the mapper can never help bind**, and C16 is the control that
requires currency to be explicitly bound. Every status column and every flag is the same. That is a
real number in an onboarding budget and it is uncosted.

---

## 9. Record corrections found while adjudicating

**Not applied here** — logged for whoever writes next. ⚠️ **`tools/check-doc-counts.mjs` governs three
of these and nothing governs the rest**: most have no number in them, and several of the numeric ones
sit in Markdown tables, which it cannot see.

| Claim | Where | Reality, verified at `ece079d2` |
|---|---|---|
| *"`grep -rn bigint model/*.ts` returns 0"* | `model/reconciliation.ts:542` | 🛑 **It returns 9, and that very line is one of them.** All nine are comments and no declaration uses `bigint`, so the *property* holds — but the **control as written is self-falsifying**, and it is quoted as evidence by two of the four green designs. Restate it as a comment-stripped control, which is the discipline that module's own header requires. |
| *"`npm run check` does NOT run the tests"* | `CLAUDE.md`, twice | **False.** `package.json`'s `check` is `typecheck && check:counts && check:citations && check:wire && check:packs && test`. G108 is applied. Two checkers `CLAUDE.md` never mentions exist (`check:wire`, `check:packs`), and a third file class it never mentions is scanned (`docs/build/*.md`). |
| *"All **sixteen** modules compile under `strict`"* | `CLAUDE.md`, verification surface | **Eighteen.** `ls model/*.ts \| wc -l` → 18. The same section says *"three of the sixteen modules"* twice more. |
| **230** dropped markers | `CLAUDE.md:90` | **235** at `ece079d2`. `for f in $(git ls-files 'model/*.ts'); do git show HEAD:$f; done \| grep -o '@dropped-for-v1' \| wc -l` → 235. Genuinely stale, and `check-doc-counts.mjs` classifies it HISTORICAL, so nothing fails on it. It becomes 236 when §4.4's drop note lands. |
| **832** exports · **65 operations across 62 paths** | the four green reports · `CLAUDE.md:66` · `docs/HANDOFF.md:278` and four more | 🛑 **NOT STALE — both are CORRECT at `ece079d2`, and `node tools/check-doc-counts.mjs` reports ten lines STALE anyway.** Derived against HEAD rather than against the working tree: exports **832**, operations **65**. See the row below for why they disagree, and **do not "fix" any of the ten lines.** |
| 140 nodes · 249 edges · 154 gaps · 36 capabilities | `CLAUDE.md`, the model graph | ⚠️ **I cannot give you the replacement numbers honestly, and saying so is the correction.** `tools/planner/extract.mjs` reads the **working tree**, and this session's working tree is not `ece079d2` — see the row below. The run I made reports 142 nodes · 250 typed edges (250 resolving, 0 dangling) · 15 bare id-shaped fields · 165 gaps · 37 capabilities · 13 resource classes · 70 contract operations, and **at least two of those are artefacts of uncommitted work that is not this adjudication's.** `36 capabilities` is genuinely stale — `model/access.ts` is untouched and the `awk` gives **37**. **Re-run the extractor on a clean tree and report edges by kind and gaps by kind before quoting any of the rest.** These are the counts no tool here checks: `check-doc-counts.mjs` reads the tree, not the graph. |
| 🛑 **`npm run check` exits 1 at `ece079d2` + this file, and NONE of the ten STALE lines is caused by this adjudication** | the working tree, 10 Aug 2026 | **A concurrent session has three uncommitted changes and one untracked file in the tree**: `model/observability.ts` (+53 lines, +2 exports → the 832→834 STALE line), `docs/contracts/control-plane.openapi.yaml` (+57 lines), and a **new fourth contract file `docs/contracts/data-plane-local.openapi.yaml`** (→ every contract-operations and contract-paths STALE line, 65→70 and 62→67). That fourth file also fails `npm test` at `tests/tools/check-wire-mirror.test.mjs:328`, which asserts the **exact** list of contract files. ✅ **This file's own contribution to the gate is clean**: `check:citations` → `EXIT: 0`, `DEAD 0` over 2,490 citations; `check:wire` → 0; `check:packs` → 0; and `check-doc-counts.mjs` names this file **zero** times. **Whoever lands the fourth contract file owns those ten lines and that test** — and the fact that a fourth contract file can move seven governed counts in five documents and break one test is itself the argument for G108's condition that every checker be deterministic and fast. |
| *"33 applied"* / *"26 applied"* G rows | the first adjudication's lineage · `CLAUDE.md` | **131 rows, 35 applied.** `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md` → 131; `\| grep -c '✅'` → 35. |
| `AcquisitionFidelity` alias at `model/domain.ts:1793` | `ingestion-p2-green-residue.md` §1 | **`:1792`.** `:1793` resolves — to the second line of the alias. The class `check-citations.mjs` structurally cannot catch. |
| `MODULE_COUNT` at `tests/model/runtime-importability.test.ts:44` | `ingestion-p2-green-residue.md` §1 and §4 | **`:45`, and there are TWO literals** — `:135` is `assert.equal(MODULE_COUNT, 18)`. A one-line fix leaves the gate red. |
| `Money` cited at `model/domain.ts:401` | `model/reconciliation.ts:537`, `:542` | **`:531-537`.** `:401` is inside the `ExtractionInSetOutcome` docblock. Two dead-but-resolving citations in the §3 banner, one of them in the same sentence as the `bigint` control above. |
| `DATA_CLASS_RANK` at `model/learning.ts:1721` | `model/policy.ts:1695` | **`:1773`.** `:1721` is blank. Inside the comment whose whole subject is that the ladder is duplicated and that the duplicates must be found. |
| `PopulationSpec` *"opens `:1931`"* | `model/reconciliation.ts:935`, `docs/build/reconciliation-engine.md` DP-2 | **`model/domain.ts:2065`.** DP-2's insertion point is stale in the diff plan. |
| *"See §5.12"* | `docs/HANDOFF.md:129` | **There is no §5.12.** `grep -c '^### 5\.' docs/HANDOFF.md` stops at §5.11. |
| `unique_within` *"gains `period` and `tenant_lifetime`"* for duplicate-invoice detection | `docs/domain-model.md:755` | **Describes something v1 will not do** under §4.4's drop note. **Mark it, do not delete it** — and it is O-14, so do not mark it before the owner rules. |
| Four distinct migration subjects claim the number `0002`; `docs/INDEX.md` has absorbed two of them | `docs/INDEX.md`, five `docs/build/` documents | **`db/migrations/` holds exactly one file.** Not one of the four claims is consistent with the tree. §2.1 rules the class. |
| *"three green designs each mint `model/ingestion.ts` with a DIFFERENT `IngestBound`"* | the brief for this adjudication | **Three mint the module; TWO mint `IngestBound`.** `green-correction` declares none — it appends `§C` and cites C4's discipline. The collision is real and one narrower than stated. |
| `tools/check-citations.mjs` *"does not scan `docs/build/`"* | superseded by `f1bdc0d4`'s neighbourhood | **It does now** (`TARGETS`, `tools/check-citations.mjs:40`, with the reason written at the point of the fix). It still does not scan `model/` or `tests/` — red-integrity SERIOUS 8's finding stands and its remedy is narrowed at §1.6 S-3. |
| The pass-two summary's *"the mapper-seam design has NOT been attacked"* | `docs/build/ingestion-pipeline.md` §11.1 | **It has, and the report exists** — `docs/build/ingestion-p2-red-mapper-seam.md`, 763 lines, written late and after its three siblings. It found the finding that reorders this whole build. §11.1's table needs its fourth row. |

⚠️ **One correction that is a lesson rather than a line.** The single most consequential finding of pass
two was produced by **compiling the machinery instead of reading it** — and the design whose central
claim it falsified had said so about itself: *"NOTHING BELOW HAS BEEN COMPILED … I did not run `tsc`."*
Every other report read the same eleven lines and believed them, including three that quoted the
`T extends string ? T` arm correctly while missing what the object arm does. **A compile-time claim is
testable in a scratch file in ten minutes, and this record has now paid twice for not doing it.**

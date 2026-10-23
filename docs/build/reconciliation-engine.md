# The reconciliation engine — what was decided, what was rejected, and the model diff-plan

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO for the model — every change to `model/` in §7 is a PROPOSAL nobody has applied.
> **V1 AUTHORITY:** YES for `model/reconciliation.ts` — that file is written, it compiles, and its behaviour was exercised. This document is its design record and is the only place its rulings are argued.
> Written 8 August 2026, against `main` with the concurrent build's `G96–G113` in the working tree. Every `file:line` was opened and resolves. Every count was derived by the command beside it.

---

## 0. What was built, and the evidence

**`model/reconciliation.ts` — 2,779 lines, one new module in `model/`.**

```bash
wc -l < model/reconciliation.ts                             # 2779
npx tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"    # EXIT: 0
npx tsc -p model/tsconfig.json --noEmit --listFiles | grep -c model/reconciliation.ts   # 1
node tools/planner/extract.mjs                              # 140 nodes · 249 edges · 0 dangling
```

The graph is **unchanged** by this module — 140 nodes, 249 typed edges, 249 resolving,
0 dangling, 13 bare id-shaped fields, 155 gaps. That is expected and it is also a
finding: `tools/planner/extract.mjs` indexes id-shaped field names and branded
`Id<'…'>` aliases and **nothing else**, so a module of functions and value objects is
invisible to it. `ItemRef.sourceDocumentId` *is* id-shaped and still produced no node,
because `ItemRef` is not reachable from any indexed entity. **The extractor's silence
about this module is not evidence of anything** — `CLAUDE.md` says so, and this is a
worked instance of it.

⚠️ **A green `tsc` is weak evidence here and I am not offering it as strong.** This is
the first thing in `model/` that *executes*, so it was **exercised** as well as compiled.
Seven runs are recorded in §8; **three were seen red before green**, and the reds are
the deliverable.

### The three defects found by RUNNING the module, none findable by reading it

All three are recorded in the module's own header rather than quietly fixed, because
each is an instance of a shape this record already catalogues.

1. **`itemKey()` joined on a NUL byte.** Unambiguous, and it made the whole source file
   **binary to `grep`**. In a repository whose entire verification surface is greps —
   `tools/check-doc-counts.mjs`, the E5 sweep, this module's own negative controls — a
   source file `grep` silently skips is a far larger defect than the ambiguity it
   solved. Replaced with a length-prefixed encoding, injective for any content, needing
   no assumption about id shape.
2. **Six of the module's own nine negative controls reported non-zero on their first
   run**, and every hit was the header quoting the thing it bans. **A control that fails
   while the property holds teaches people to ignore controls** — §5.6 read from the
   other side. Every control now strips comments first. One was *separately* wrong:
   `grep -c $'\x00'` expands to the empty string in bash, so grep matches every line and
   reports 2,755 NUL bytes in a file containing none.
3. 🛑 **The money-confinement control was SELF-REFERENTIAL.** It read
   `awk '/\* §4  ADMISSION/,0' … | grep -c amountMinor` — and `awk` matched **the
   control's own line in the header**, started the range there, swallowed §3 and
   reported 20 for a property that holds. It now anchors on
   `export type _MoneySectionEndsHere = true`, a **declaration** rather than a heading,
   because comments are stripped before the range is applied and a declaration is the
   only marker that survives both. **This is §5.6 three times in one file header**, and
   every instance was found by running the control, never by reading it.

### And the property that control protects cost something to make true

`amountMinor` was read at **20 code sites** across five passes and the post-conditions.
Every one now goes through `minorUnitsOf()` / `isPositiveMoney()` / `isNegativeMoney()`
/ `guardMoney()`, so the whole engine presents **one surface** to G111's codec and G65's
`bigint` retype is a single loud compile error in §3 rather than twenty silent
`number`/`bigint` mixings. ⚠️ It is **honour-system** — no linter is configured.

⚠️ **A fabricated value was removed in the same pass.** `ResidueEntry.settlement` was
non-null, and an item refused at admission carried
`{ currency: '', amountMinor: 0, exponent: 0 }` — a fabricated zero in a fabricated
currency, on the one row a finance user reads to find out what went wrong. It is now
`ItemSettlement | null`, because an item whose amount could not be read **has** no
settlement.

### ⚠️ A COLLISION WARNING THE ORCHESTRATOR MUST READ

**`model/reconciliation.ts` was deleted twice during this session by the concurrent
build**, because it is an untracked file in a tree where another agent is cleaning. It
was restored from a scratchpad canonical copy both times and every fix re-applied
deterministically; the file verified here is the file on disk. **Commit it, or the next
clean removes it again.**

**And `model/domain.ts` moved under this session.** `MatchGroup` was at `:2618` when the
three designs ran and is at **`:2631`** now; `ProcedureStepExecution` moved `:3144` →
**`:3157`**. Every citation in this document and in the module was re-derived after the
shift. **§7's insertion points are stated as TEXT ANCHORS for exactly this reason — the
line numbers beside them are hints and must be re-derived at apply time.**

---

## 1. 🛑 THE CORRECTION THAT INVALIDATES PART OF THE RED TEAM, AND MORE OF TWO DESIGNS

The red team's ruling order opens with **F4 — "G96–G102 do not exist"**, verified at
`c080a22e` where the decision table held 95 rows. **That is no longer true of the
working tree**, and it must be re-derived before anything else here is read:

```bash
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                                    # 113
grep -oE '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -oE '[0-9]+' | sort -n | tail -1   # 113
grep -cE '^\| G(9[6-9]|1[0-1][0-9]) \|' docs/HANDOFF.md                      # 18
```

**The concurrent build landed G96–G113 while the three designs and the red team were
running.** Eighteen build rulings, none applied. Five of them land directly on this
work and **none of the four prior documents could have seen them**:

| | | What it settles here |
|---|---|---|
| **G103** | No Redis — the extraction-rule cache is a **tenant-scoped Postgres table** | Settles S2 in a direction *no design proposed*. See §2.2 |
| **G104** | **No model identifier as a literal in engine code** — the catalogue is the only source | Settles S6 structurally. `docs/build-conventions.md` §3 now BANS it |
| **G105** | N:M is **bounded subset sum FIRST, FIFO waterfall as a recorded fallback** | Settles Design 1's OR-2 **against** its own recommendation. See §2.5 |
| **G106** | `FieldSpec` gains a JSONB path; **a key with no `FieldSpec` is UNREADABLE** | Settles how admission reads a payload. Fail-closed |
| **G107** | The whole reconciliation pipeline is **data-plane**; the control plane only publishes | Where the caller runs |

**And the red team is still right about G102, in a worse way than it said.** G102 does
exist — it is *"`palette: null` — G90 reserves the KEY, not the SHAPE"*. It has nothing
to do with required-and-nullable field shape. Designs 1 and 2 both cited it as the
authority for that, independently. **Citing a decision that does not exist is a missing
argument; citing a real decision that says something else is a false one**, and
`tools/check-citations.mjs` cannot catch it because the row resolves.

> **Ruling.** Every G96–G102 citation in Designs 1 and 2 is struck. The *substance* of
> the required-and-nullable argument survives on its own merits — it is Design 1's own
> point that `TS2741` at each construction site is the only evidence a field landed —
> but it is argued here, not cited to G102.

---

## 2. The rulings, and where each one goes against a design or against the red team

### 2.1 S1 — the LLM-written regex. **Both halves of (a), a stronger (b), (c) rejected as primary.**

**Ruled.** The quarantined reader returns **an index into a candidate set the
privileged side supplied** — never a pattern and never a free string. A reusable
extraction may be *proposed* by a model and lands only as an approved
`IdentifierNormalisation`: a closed, parameterised op list (`trim`,
`strip_leading_zeros`, `strip_literal`, `split_take`) terminating in the existing
`Normaliser` (`model/domain.ts:441`).

**Against the brief's option (b).** *"The LLM returns only the extracted ID"* still lets
an attacker-composed string enter the engine, and that string then flows into a
`MatchGroup`, an `Explanation`, an `AuditEvent` and a later prompt. Design 2 found this
and it is right. The privileged side supplies the vocabulary; the quarantined side
chooses from it.

**(c) rejected as a primary control, and the reason is not performance.** A step budget
bounds the denial of service and does nothing whatever about invariant 6 — executing a
program written from counterparty text is the violation whether it finishes in 10 ms or
never. There is also no linear-time engine in the dependency set, so RE2 would be a
dependency proposal under `docs/build-conventions.md` §4, which is not this pass's to
take.

**🛑 AGAINST DESIGN 1, and this is the sharpest disagreement in the adjudication.**
Design 1 claims S1 and S2 are *"structurally unreachable"* because *"nothing generated
is ever executed — the only thing executed is a member of a closed union"*. **That claim
is false the moment any extraction is parameterised**, and Design 1 needs parameterised
extraction as badly as anyone: its own OR-3 concedes that the draft's motivating string
`BR001-TXN99823-SG` **is reachable by none of the four `Normaliser` members**. So
Design 1 either ships a fifth member per bank format — a platform release per customer,
which is *"packs parameterise, never extend"* inverted into the worst possible release
cadence — or it parameterises and its absolute claim collapses. The red team found this
(F6) and is correct.

The honest claim, which the module makes instead, is narrower and survives: **every op
is total, allocates no backtracking state, and has no quantifier, so catastrophic
backtracking is not a risk to be bounded — it is a property that cannot arise.**

**F6's three unspecified edges are closed, each as a refusal rather than a silent
result** (`validateNormalisation()`):

| Edge | What it does silently | Ruling |
|---|---|---|
| `separator: ''` | `split('')` explodes to characters; `index` addresses a letter | refuse `empty_separator` |
| `literal: ''` | `replaceAll('', x)` inserts between every character — corruption, not a hang | refuse `empty_literal` |
| `index` negative / fractional / out of range | `T \| undefined` under `noUncheckedIndexedAccess` → undefined key. **A9(d) one layer down** | refuse `negative_index` / `non_integer_index` at validation, `segment_index_out_of_range` at execution |
| `maxInputChars` unset | unbounded op list over `SourceDocument` content | **required field, no default**, refused if not a positive integer |

**What it costs, stated.** `ExtractionOp` is strictly less expressive than a regex; the
draft's own `(?<=BR\d{3}-)TXN\d+(?=-SG)` is expressible (`split_take` on `-`, index 1)
and arbitrary lookaround is not, so some real bank formats will never normalise
deterministically and will sit in residue permanently. Until a human approves one,
every residue record costs one inference call — O(residue), not O(distinct formats).
And **nothing in this repository can report "this definition has paid for inference on
the same format for six months and nobody nominated it"**; that is a product surface
nobody has drawn.

### 2.2 S2 — the cross-tenant regex cache. **Closed, and G103 closes it differently from every design.**

All three designs converge on "there is no module-level cache", by two routes: Design 1
dissolves it (no module state), Design 2 rules it *"the wrong object"*. The red team
calls that convergence, correctly.

**But G103 has since ruled that a cache DOES exist — as a tenant-scoped Postgres
table.** So the answer is not "no cache", it is "the cache is a row under RLS", and the
reason is not preference: `docs/persistence-design.md` §0 records that **four of the
model's invariants are enforced BY THE STORE**, and a cache of tenant-derived rules
sits outside RLS, outside the retention table, outside the erasure plan and outside
`SubjectLocation`.

**In the module:** there is no module-level state of any kind, and an approved
`IdentifierNormalisation` arrives as an argument. `ReconciliationDefinition extends
TenantScoped` (`model/domain.ts:2010`), so under DP-2 it lands on a tenant-scoped row
and G103's table is where it is cached.

**A NEVER nobody wrote, and the red team is right that it is the most obvious feature
someone will ask for next week** (F14). `ReconciliationDefinition` is bound to a pack.
The path where a tenant-approved extraction is promoted **back into a pack template and
published downward to other tenants** violates invariant 3 and G4/G5 at once. **No
design forbade it.** It is written as a NEVER in §6, OR-6, and it needs the owner's tick
because it is a product decision, not an engineering one.

### 2.3 S3 — money. **Design 1's correction to the brief is adopted; F11 is adopted against Design 1.**

**Design 1 is right about the mechanism and I verified it.** The draft's float defect is
NOT that a minor-unit waterfall accumulates error — JS `number` is exact on integers
under `+`/`−` up to 2^53, so a minor-unit waterfall accumulates exactly zero error. The
defect is that `payload: Record<string, any>` feeds `residualAmount` a **major-unit
float straight out of JSON**. That matters because it means the engine is correct
**before** G65, not after. Verified: `Money.amountMinor` is `number`
(`model/domain.ts:401`); `grep -rn bigint model/*.ts` → 0.

**🛑 AGAINST DESIGN 1 on the residue, and the red team's F11 is right.** Design 1 binds
`withinTolerance(Money, Tolerance)` and simultaneously claims *"the engine only ADDS and
SUBTRACTS, never divides and never rounds"*. `Tolerance` (`model/domain.ts:1766`)
carries `{ kind: 'absolute'; value: number }` and `{ kind: 'percentage'; value: number }`
— **both are floating-point money the moment they touch an amount**, and `percentage`
*requires* a multiply and a rounding decision. `docs/build-conventions.md` §3 lists *"a
floating-point money type, anywhere"* as a **ban**. Design 1 never says whether its
function refuses these arms or implements them.

**Ruling: `toleranceAdmits()` REFUSES both arms**, with `float_money_tolerance` naming
which. Only `{ kind: 'money' }` and `{ kind: 'rounding' }` are legal on an amount
comparison. That is a real cost — a pack author who writes `{ kind: 'percentage', value:
2 }` gets a refusal, not a match — and it is the correct cost, because the alternative
is a silent float multiply on money in the one function every allocation passes through.

**Against Design 1's negative control as scoped.** Its greppable control was
`grep -c amountMinor model/matching.ts` → 0, which passes **while the float multiply
sits in `model/money.ts`**, because that is where the arithmetic was moved — the control
is scoped to the file defined not to contain the thing (§5.1). The module's control is
scoped to the **property**: no read of the representation after §3, and the run is
recorded in §0. It was **20 code sites across five passes and the post-conditions**
until every one was routed through `minorUnitsOf()` / `isPositiveMoney()` /
`isNegativeMoney()` / `guardMoney()`. That is what G111 asks for, and it makes G65's
retype one loud compile error in §3 instead of twenty silent `number`/`bigint` mixings.

⚠️ **Design 1's own §5.3 risk is real and I am creating a fourth instance.**
`model/access.ts` compares `amountMinor` inline in three places, none checking
`exponent`. When G111's codec lands, §3 collapses into it and those three should migrate
in the same commit.

### 2.4 S4 — the parallel vocabulary. **Deleted, not ported.**

`MatchRuleConfig`, `MatchResult` and `GenericRecord` do not exist in the module.

`MatchResult.status` conflated two orthogonal facts. **HOW a pair formed** is
`PairingEvidence` (seven arms, closed). **WHAT it means** is `MatchGroup.outcome`
(`model/domain.ts:2639`) and, for the residue, a `DispositionFamily` from
`DISPOSITION_FAMILIES.set_reconciliation` (`model/domain.ts:1866`). `EXCEPTION` as a
status was a straight duplicate of `MatchGroup.outcome`; `SEMANTIC_LLM` was a provenance
wearing a status's clothes.

**The passes ARE `PairingSpec.strategies` in declared order.** The draft's five passes
map onto the four existing strategy kinds:

| Draft | Strategy | Module |
|---|---|---|
| Step 0 | `IdentifierNormalisation` | applied at admission; closed op list |
| Pass 1 exact | `exact_identifier`, `amountTolerance: { kind: 'rounding', minorUnits: 0 }` | multimap join; >1 candidate ⇒ ambiguity |
| Pass 2 tolerance | `exact_identifier`, `amountTolerance: { kind: 'money' }` | signed variance always recorded |
| Pass 2.5 fuzzy | `fuzzy_reference`, exact amount bucket first | similarity only inside a bucket |
| Pass 3 N:M | `amount_sum` + counterparty partition | G105's two stages |
| Pass 4 LLM | **not a strategy, and must never become one** | §7 seam, emitted not called |

**Agreeing with Design 1 and stating the reason it gave:** the strategy kinds are a
closed union, so a pack **orders and tunes** them and can never add one. That is *packs
parameterise, never extend* made true of the engine rather than asserted about it.

⚠️ **Three fields the engine needs do not exist on the model types yet**, so
`PopulationBinding` and `StrategyBinding` carry them beside the model type until §7's
diff-plan lands. Each binding **names the exact declaration it collapses into**. A
binding that names its end state is a stopgap; a binding that redefines the concept is
§5.3, and the difference is written into both doc comments.

**F3 — the two-normaliser collision — is resolved by merging, not by choosing.** Design
1 and Design 2 both claim `PopulationSpec:1937` with two vocabularies, and the
orchestrator cannot apply both. Ruling: **Design 2's shape, Design 1's nullability.**
Design 2's `{ ops, then: Normaliser }` is strictly more expressive and Design 1's bare
`normaliser: Normaliser` is its degenerate case (`{ ops: [], then }`); Design 1's
*required, no safe default* is right and Design 2's `| null` is a fail-open (§5.5) —
"unspecified" takes the permissive branch at the first call site somebody writes in a
hurry. **One field, required, non-null, identity spelled out.**

### 2.5 A9 — eight bugs, eight verdicts, and **F2 and F15 are upheld against Design 1**

| | Bug | Verdict | What actually catches it |
|---|---|---|---|
| a | duplicate normalised ids collapse, last wins | **FIXED** | `Map<key, AdmittedItem[]>`, never `Map<key, item>` |
| b | pass 3 consumes every payment; leftover cash becomes `variance` | **FIXED** | obligation-driven pour that **stops**; leftover stays `partially_allocated` and lands in residue |
| c | partial and full indistinguishable | **FIXED** | derived `ItemSettlement` with **no `over_allocated` member** — over-allocation is a refusal carrying both numbers, not a state |
| d | `groupBy` drops absent keys | **FIXED** | partition is total; `null` is a named `counterparty_unattributed` bucket, and `counterparty: null` on the spec means pass 3 does not run at all |
| e | engine mutates its input arrays | **FIXED** | `readonly` / `ReadonlyMap` throughout; witnessed with `Object.freeze` (§8) |
| f | `new Date(payload[k])`, NaN sorts | **FIXED** | typed `date` scalar, `YYYY-MM-DD` validated at admission, integer days-from-civil, `grep -c 'new Date'` → 0 |
| g | symmetric tolerance is an unchosen policy | **NOT TAKEN — made impossible to leave unstated** | `toleranceDirection` is a required run input with no default; signed variance recorded on every tolerant pairing |
| **h** | **FIFO with no tie-break is non-deterministic** — Design 1's, not the brief's | **FIXED** | total comparator on `(dayNumber, admission ordinal)`; `RunTrigger.rerun` (`model/domain.ts:2629`) makes it non-theoretical |

**🛑 AGAINST DESIGN 1 — F2 is upheld and it is the red team's best finding.** Design 1
names conservation *"the one property that no type can hold and that catches A9(b),
A9(c) and A9(e) simultaneously"* and makes it the first failing test. But it also rules
that residual is **derived** by folding allocations. So `gross = residual + Σ
allocations` reduces to `gross = gross` — **it cannot fail, on any input, ever**, and it
does not catch A9(b): under an append-only ledger "the payments are marked spent" means
the item was dropped from the **residue** without an allocation, and the identity still
holds because the money is lost from the residue and not from the ledger.

**The post-condition in the module is RESIDUE COMPLETENESS**, a partition check over the
item set, plus a gross partition computed **from two independent sources** — the
admitted items' gross, and the sum of settled-plus-residue-carried. A dropped item
changes the second and not the first. It was **seen red** (§8, run 4): dropping one open
item produces `open_item_missing_from_residue: 1` and `gross_not_partitioned: {admitted
30000, accounted 20000}`.

**F15 is upheld too.** Design 1's A9 table attributes (b), (c) and (e) to conservation.
The *fixes* are real; the *evidence* is misattributed. Restated above: (b) is residue
completeness, (c) is the derived `ItemSettlement`, (e) is `readonly` plus a frozen-input
run.

**F9 is upheld and closed.** Design 1 rules the duplicate-key disposition only for
`one_to_one`, and its own worked test uses `many_to_many`. The module rules all four,
and the one that matters is the one nobody had ruled: **under `many_to_many` the
identifier join pairs only where at least one side is a singleton.** An identifier
repeating on both sides names no unique pair, so the identifier join declines it and
`amount_sum` — which exists to resolve N:M **by value rather than by name** — gets it.
An identifier strategy that guessed there would be moving money on a name collision.

**G105 supersedes Design 1's OR-2 and rules against its recommendation.** Design 1
recommends the FIFO waterfall and asks that the model's `amount_sum` comment be
corrected. G105 ships **both, in that order**, and the argument is one Design 1 did not
make: *an exact combination of open obligations summing to the payment is what the
counterparty INTENDED to pay, and it is a MATCH; the waterfall is a JUDGEMENT the firm
makes about cash it cannot attribute, and the audit trail must not confuse the two.*
The module carries that distinction **in the evidence type** — `amount_sum_exact` versus
`amount_sum_waterfall { fellThroughFrom }` — so G105's *"silently truncating the search
would make an allocation look like a match"* is structurally impossible. Design 1's
tractability objection survives as the **second** bound: `maxMembers` bounds
**termination**, not **cost** (C(400,8) ≈ 2×10^15), so `SubsetSumBound` carries a step
budget and a max bucket size, both required, both refused if unstated.

### 2.6 S5 / S6 / S7 / S8 — satisfied by subtraction, and F7 is upheld

**The engine has no authority, no clock, no identity and no network.** It mints no id,
reads no clock, calls no model and writes no record. `runSetReconciliation()` **emits**
`ReaderRequest`s; the caller resolves them; `applyReaderVerdicts()` folds them back.
Both phases pure.

That is not asceticism. Invariant 10 says an act with no authorisation is unrecordable
and `authorize()` (`model/access.ts:1610`) is the only thing that mints an
`AuthorizationGrant` — **so a function that could make a model call from inside a fold
would be a function that could make an unrecordable one.** S6 and S8 become
unrepresentable rather than merely forbidden: `grep -c 'anthropic\.\|claude-'` → 0,
`grep -c 'console\.'` → 0.

**F7 is upheld and it is a genuine three-way contradiction.** Design 1 says the engine
calls nothing, Design 2 calls mid-run, Design 3 calls post-exception. **Only Design 3's
position is model-legal today**, and Design 3 proved it where the others did not look:
`AuditActor`'s `agent` variant requires `stepId` + `stepExecutionId`
(`model/governance.ts:1058`); `ProcedureStepExecution` (`model/domain.ts:3157`) is keyed
on `exceptionId`; `AUTHORIZATION_MAY_BE_ABSENT` (`model/governance.ts:1232`) has
`agent: false`. Verified: `grep -c 'AuthorizationGrantId\|authorizationId'
model/agents.ts` → **0**, and `grep -rc authorizationId docs/contracts/*.yaml` → **0, 0,
0, 0**. So a mid-run model call has **no constructible `AuditActor`**, and the tempting
fix `{ kind: 'system' }` is laundering an agent read into the machinery variant — which
typechecks, and which that constant's own comment forbids.

**Ruling: I do not take Design 3's position, and I do not take Design 2's.** Where the
pass runs changes the product surface (exceptions that appear and clear within seconds,
and a register that must not present them as findings) — that is the owner's, OR-1. What
engineering can settle is that **the module compiles and is correct under either
ruling**, because it emits a request instead of making a call. Design 1 is right that
the engine should not call; Design 3 is right that a mid-run call is illegal today; the
module takes both without needing the third.

**S7 — this module is the missing producer, and Design 3's finding is the best single
item in the three designs.** `docs/HANDOFF.md` §4.1 records that
`input_tokens`/`output_tokens` *"have no producer — found independently by three
agents"*. `tokenMeterFacts()` is that producer. It emits **facts, not records** — a
`UsageRecord` needs `dataPlaneId`, `sequence`, `at`, `recordedAt` and `authorizationId`,
and this module has no plane, no clock and no authority.

🛑 **The idempotency key is meter-qualified and the live recommendation is wrong.**
`UsageRecord` carries one `meter` and one `quantity` (`model/billing.ts:182`), so a call
produces two rows. `docs/build/event-architecture-recommendation.md` §5.4 recommends
*"idempotencyKey = the provider's own request id"* for **both**. `/metering/record` is
*"Idempotent on `idempotencyKey`"* and answers **`409 IdempotencyConflict`**, so the
second row is rejected and **output tokens are never counted, in production, silently.**
`${providerRequestId}#${meter}` fixes it — DP-7 amends the field's doc comment so the
derivation sits where an implementer reads it.

**Quantities are provider-reported and never estimated.** `ReaderTokenUsage | null`; a
null usage emits **no** token fact. An estimate written into an append-only table with
no compensating instrument (`model/billing.ts:133`) is fabricated revenue data.

**Nothing reads a price.** No `MeterPrice`, `PriceTier`, `RateCard`, `RatedTotal`, and
`ModelCatalogEntry.cost` is never consulted. Controls in §0 verified at 0.

**Adopting Design 3's refusal to mint `record_usage`**, grounded verbatim in
`model/governance.ts:388`: the metering class has no write mode, and *"the missing write
mode above is what makes a companion `record_usage` wrong rather than merely absent"*.
The `authorizationId` on every emitted fact is the grant for the **underlying act**.

### 2.7 🛑 F1 — batched context. **I rule against Design 3, and adopt the shape the red team says nobody proposed.**

Design 2 rules the reader sees *"the untrusted description for **ONE** record"*. Design
3 rules, for three independently good reasons, *"one model call per batch of N rows"*
and mints `METERED_BATCH_FLOOR` to **force** N > 1. **Composed, one prompt carries N
counterparty-controlled descriptions and a shared candidate list, and description #1 is
in a position to instruct the reader about the verdict for description #7.**

**The index-only contract does not close it.** Containment is an argument about the
**alphabet** of the output; this attack needs no new symbol, it needs `candidateIndex:
3` on a row that should have been `no_candidate`.

**Ruling: batch the TRANSPORT, not the CONTEXT.** One `AuthorizationGrant` covers a
batch; the requests are N independent single-record calls; the meters are summed per
call and shipped together. `MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1468`) bounds
**grant lifetime**, not context width — it never required a shared prompt, and Design 3
was routing around the wrong constraint. `ReaderRequest` carries **exactly one**
description and there is **no plural arm**, so the shape is not available to be chosen
later in a hurry.

⚠️ **The cost, stated rather than traded silently.** Design 3's third reason was the
token-count side channel, and per-record calls make it **sharper**. `UsageRecord`'s
claim to be *"PII-free BY CONSTRUCTION"* is weaker than it reads: a token quantity is a
monotone function of prompt length, which is a function of content. On a residue of one
row, `input_tokens` measures one counterparty description. The security argument wins
the trade; the trade is real and is recorded in the module's §8.

### 2.8 F8 — the authorable opt-out from containment. **Upheld, and split into two bounds.**

Design 2 promotes *"anchor the amount, blur the string"* from a false-positive control
to **the security bound on the quarantined model's output alphabet**. Design 1 then
mints `AmountAnchor = 'exact' | 'within_tolerance'`, so a pack author plus a wide
`amountTolerance` **widens containment as a configuration change**. Neither knew about
the other.

**Ruling: two bounds, and only one is authorable.** `amountAnchor` tunes **pairing**.
The reader's candidate set is built under an **exact** anchor **always**, whatever the
binding says, plus a hard `readerCandidateCap`. **The cap is a required run input with
no default**, refused if not a positive integer — because "a bound with no number is not
a bound" (§5.6) and any number written here would be invented, which `PRODUCT.md`
forbids. Absence is a refusal, never a permissive default.

### 2.9 F5 and F12 — the deep no-text assertion. **Mechanism adopted; Design 2's own types fixed.**

**F12 is right and the hole matters.** `AssertNoPlainText` (`model/identity.ts:1139`) is
shallow: `readonly string[]`, a nested `{ v: string }` **and `Record<string, string>`**
all pass G47's applied proof. Verified in this session against a live probe compiled
under the model's own tsconfig — the shallow form returned **no error** on all three
(§8, run 3).

**F5 is right and Design 2's DP4 fails Design 2's DP5.** `NormalizationCandidate.recordId:
string`, `NormalizationReading.readAt: Timestamp` (`model/kernel.ts:422 export type
Timestamp = string`) and `Money.currency: string` (`model/domain.ts:399`) all go red
under its own deep assert. Design 2 ran its probes on **examples**, not on its own
declarations — §5.10 one level up, a witness never pointed at the thing it witnesses.

**Ruling.** The deep form is adopted **locally in `model/reconciliation.ts`** and
asserted over seven types that are green under it — `ReaderVerdict`, `ReaderRefusal`,
`ResidueCause`, `MoneyRefusal`, `ToleranceRefusal`, `AdmissionRefusal`,
`AllocationRefusal`, `NormalisationDefect`, `ExtractionRefusal`,
`SetReconciliationRefusal`, `PostconditionFailure`. It is **not** asserted over
`ReaderTokenUsage`, which carries `providerRequestId: string` and would correctly fail —
that is transport metadata read from the SDK, not quarantined output, and asserting it
would be asserting the wrong thing about the wrong type.

**A finding neither design nor the red team named, and it is why F5 happens at all.**

```bash
grep -n 'export type FieldPath\|export type SlotName\|export type Timestamp' model/kernel.ts
# 422: export type Timestamp = string
# 423: export type FieldPath  = string
# 424: export type SlotName   = string
```

**Three bare `string` aliases in the kernel.** `FieldPath` and `SlotName` are not in
`BareByRule` (`model/identity.ts:842`) — that list is about id-shaped fields. So **any
type that names a field or a slot is unassertable by G47's proof, shallow or deep.**
That is not a Design 2 defect; it is why Design 2's types could not pass. DP-8 proposes
branding all three; until then, the module keeps `FieldPath` off every asserted type and
says so where it does.

⚠️ **Re-pointing `_CarriedTurnHoldsNoText` at the deep form is an amendment to G47, an
APPLIED decision, and is not smuggled in here.** DP-9, with its own red run.

---

## 3. What survived from the draft, intact

The owner's algorithmic instincts are right and every one of them ships:

- **Multi-pass ordering, cheapest and most certain first** — and it is now a
  *monotonicity property of the fold*: `fully_allocated` is absorbing, so
  `model/domain.ts:1948`'s *"the first that pairs wins"* cannot be broken by a later pass.
- **Anchor the amount, blur the string** — mechanised as an exact minor-unit bucket
  before any string maths, which is also what keeps the pass inside a serverless
  compute budget.
- **LLM last, on residue only** — and demoted further: it is not a `PairingStrategy` and
  an `{ kind: 'llm' }` arm must never be added.
- **The Output Contract with an explicit exception flag rather than a guess** — kept,
  narrowed to four arms and an index.
- **FIFO for N:M** — kept, as G105's second stage, with the fall-through recorded.
- **The residue is the product** — it is the module's return value.

**Rejected outright: the `try/catch` that regex-scrapes `\{[\s\S]*\}` out of the
response.** Two grounds. It is a second greedy regex over attacker-influenced text — the
S1 bug one layer down, inside the code written to handle S1's failure. And a model that
ignored the *format* instruction is a model that may have ignored the *other*
instructions; the correct inference is "this call is untrustworthy", not "let me go and
find the JSON". Zero retries on a contract failure — retrying with a different prompt is
negotiating with the input.

**Corrected: `temperature: 0` is not determinism.** No vendor guarantees bitwise
reproducibility across replicas or model versions; the honest claim is "no sampling
diversity". `recon-spec.md:105` is wrong as written. The reproducibility property that
matters for invariant 10 is that the verdict is **written to a row** and the rest of the
engine reads the row — a re-run does not re-ask.

**Deleted from the contract: `vendor_name`, `currency`, `invoice_numbers`,
`extraction_regex`, `canonical_id`.** Each is a text channel across the boundary with no
consumer that is not a display, and `currency` must come from `Money.currency` on our
side — taking it from a bank description is letting the counterparty choose the units.

**`confidence` kept, ruled NON-LOAD-BEARING**: it may order a queue, it may never gate a
disposition, because it is a model's self-report about attacker-influenced input and is
therefore itself attacker-influenceable. ⚠️ **That ruling lives in a comment and nothing
enforces it** — §5.1's shape, recorded as a deliberate choice of expressiveness over
enforceability, once, following Design 2.

---

## 4. Two stubs, both marked, neither fabricating a value

`CLAUDE.md` forbids inventing data or mocking an API. The draft's failure here was
`return []` — a fabricated empty result indistinguishable from "the model found
nothing", so a broken integration reads as a clean reconciliation.

| Stub | Why it is a stub, not a gap | What it returns |
|---|---|---|
| `notImplementedReader()` | The Bedrock `InvokeModel` call needs authority, a clock and a plane. It belongs in the data-plane worker (G107), behind `NormalisationReader` | `{ kind: 'refused', refusal: { kind: 'not_implemented' } }` |
| `similarityBasisPoints('jaro_winkler', …)` | Jaro-Winkler has a prefix scale and a prefix cap; choosing them **changes which records pair**. That is matching policy with money on it, not a coding detail | `null` → the strategy declines |
| `applyNormaliser(…, 'name_normalise')` | `name_normalise` is a member of the closed union at `model/domain.ts:441` and **nothing in this repository defines what it does**. Suffix stripping? Diacritics? Punctuation? Each changes which records pair | refusal `normaliser_not_implemented` |

The Jaro-Winkler case is already served deterministically: `PO-998` versus `998` is
`strip_literal { literal: 'PO-', at: 'prefix' }` applied at admission by a
human-approved normalisation — and a deterministic normalisation is **strictly better
evidence** than a similarity score.

---

## 5. The caller's obligations — enumerable, and none of them enforceable from inside

The module cannot do any of these wrongly because it cannot do them at all. Saying so is
part of the deliverable.

1. `authorize()` (`model/access.ts:1610`) mints an `AuthorizationGrant`; nothing else
   does. Its id lands on the `AuditEvent`, the `DataAccessEvent` and the `UsageRecord`.
2. `FieldSpec.modelProcessingAllowed` (`model/domain.ts:1597`) is true **and**
   `untrustedDescriptionClass` ≤ `ModelUseConfig.maxDataClassInPrompt`. ⚠️
   **`resolveModel()` DOES NOT CHECK CLASSIFICATION and people will assume it does.**
   These two are invariant 4's own mechanism, so they are derived from `FieldSpec`,
   never re-invented as a gate.
3. `resolveModel()` (`model/catalog.ts:184`) with `allowedModels`, `allowedRegions`,
   `requireZeroRetention` from `EffectivePolicySet.modelUse`. The `ModelCatalogEntryId`
   comes from a catalogue row the FDE published downward (G49, G104).
4. On `{ ok: false }`: **refuse. No fallback.** `ModelFallbackChain` is
   `@dropped-for-v1` (`model/catalog.ts:150`).
5. Refuse **before** parsing on a byte cap or a truncated stop reason — truncated JSON
   that happens to parse is the worst case, because it parses.
6. 🛑 **Nothing may write a chained row until JCS lands.** `AuditEvent.chain` and
   `DataAccessEvent.chain` are `RecordChain` over a *"canonical body"*, and G20 chose
   RFC 8785/JCS while `docs/build-conventions.md` §2 marks it *"not applied, and
   irreversible after the first hash"*. **This is the first work item, before any caller
   code.** Adopted from Design 3.
7. One `withTenantScope()` transaction per run, `SET LOCAL` from the session's
   principal, under G100's deny-on-NULL and G101's transaction-mode assumption.
   ⚠️ The module's `cross_tenant_documents` refusal is the **weaker** of two lines and
   must be described as one: `model/access.ts` concedes the same limit about itself.

⚠️ **`costCenter` must be populated only from `TagPolicy` resolution.** Design 3's
finding: it is the one customer-authored free-text field on the one record class that
ships upward, so a single line of convenience code putting a vendor name into it
exfiltrates counterparty identity across the plane boundary through the field designed
to be safe.

---

## 6. Open rulings — none of these is engineering's

| | | Recommendation |
|---|---|---|
| **OR-1** | **Where the LLM pass runs** — post-exception as a procedure step (legal today, changes the product surface: exceptions that appear and clear within seconds) or mid-run (needs DP-6). The module works under either | Post-exception for v1; it is the only one with a legal actor |
| **OR-2** | **Tolerance polarity** — `symmetric`, `left_greater_only`, or `right_greater_only`. Writing off SGD 20 the counterparty underpaid is not the same act as writing off SGD 20 they overpaid | Directional, required, no default. Already required in the module; only the VALUE is open |
| **OR-3** | **What `name_normalise` means.** A member of a closed union with no definition anywhere | Define it or drop it. A union member nothing implements is §5.6 in a type |
| **OR-4** | **The three unset numbers** — `readerCandidateCap`, `maxInputChars`, `subsetSumBound`. Each is load-bearing; the first is the containment bound | Derive from the first real dataset and record the derivation beside the number. The module refuses if any is unstated, so no default can leak in |
| **OR-5** | **Does the waterfall ever cross a counterparty?** `PairingCardinality` describes **arity** and says nothing about **partition** | No. A payment from ACME clearing a BETA obligation is a finding. Confirm, because the type does not say so |
| **OR-6** | 🛑 **A NEVER nobody has written.** May a tenant-approved `IdentifierNormalisation` be promoted **back into a pack template** and published downward to other tenants? | **NO** — invariant 3 and G4/G5 at once. It is the most obvious feature someone will request the week after this ships and it needs a written NEVER, not an absence |
| **OR-7** | **A seventh `CORRECTION_KIND`.** `CORRECTION_KINDS` (`model/learning.ts:108`) has no member for "a human corrected an identifier extraction", so G5's promotion act has no kind. `PERMITTED_DESTINATIONS` is total over it, so a seventh member is a compile error until someone decides its destinations — the mechanism working, not a bug | Owner's |
| **OR-8** | **Which capability does the reader's grant carry?** `authorize()` refuses when `CAPABILITY_RESOURCE_CLASS[capability] !== resource.resourceClass`, so it is load-bearing. G49's own row already records this as open | `view_document` (`tenant_data`), on the precedent that `TOOL_CAPABILITY.endpoint_read = 'view_document'` for the structurally identical act |
| **OR-9** | **Does a scheduled run reach the LLM pass at all in v1?** Four of five `RunTrigger` kinds carry no principal, and the `schedule` resource class deliberately holds no capability | Manual/rerun only in v1. ⚠️ **Widening `AUTHORIZATION_MAY_BE_ABSENT` must not be taken** — it would make invariant 10 optional for exactly the actor kind its own comment says it must not be optional for |

---

## 7. THE MODEL DIFF-PLAN — ordered, exact, and applied by somebody else

**None of this is applied.** `model/reconciliation.ts` compiles **without** every one of
these. Nothing here is required to keep the tree green.

⚠️ **§5.10 governs the whole plan and it is the largest risk in it.** Nothing in
`model/` constructs a `PopulationSpec`, a `PairingSpec` or a `MatchGroup` — verified.
So **DP-2, DP-3 and DP-4 each add a required field to a type with zero construction
sites, and `tsc` will stay green after every one of them.** That is not evidence. **DP-10
must land in the same commit as DP-2/3/4 or those three are decorative.**

---

### DP-1 — `model/domain.ts` · `ExtractionOp` and `IdentifierNormalisation`
**Insertion point.** Immediately **before** line 1930, the doc comment `/** One side of
a set reconciliation. Transactions, not documents. */` that precedes `export interface
PopulationSpec` at `:1931` — i.e. inside the `Set reconciliation` banner block opening
at `:1926`.
**Change.** Move `EXTRACTION_OP_KINDS`, `ExtractionOp` and `IdentifierNormalisation`
verbatim from `model/reconciliation.ts` §2 (const object plus derived union, per
`erasableSyntaxOnly`). Keep the declaration comment's three sentences: **no regex,
ever**; every op is total and linear-time; a human approving these ops can evaluate
them and a human approving a regex cannot.
**Why.** `MatchKey.normaliser` (`:1754`) and `LineMatchKey.normaliser` (`:1763`) both
exist and `PopulationSpec` has none, so `set_reconciliation` — the archetype bank
reconciliation uses — has **no normalisation surface at all**. That is the model gap the
owner's draft was routing around, and it is real rather than a draft defect.
`Normaliser` cannot absorb this directly: its members are unparameterised whole-value
transforms and `split_take` needs a separator and an index. Composing (`ops` then
`then: Normaliser`) **reuses** it rather than rivalling it.
**Breaking.** No.
**Then.** Delete §2's declarations from `model/reconciliation.ts` and `import type` them.

### DP-2 — `model/domain.ts` · `PopulationSpec` gains three required fields
**Insertion point.** Inside `export interface PopulationSpec` (opens `:1931`),
immediately after `identifiers: FieldPath[]` at `:1937` and before the closing `}` at
`:1938`.
**Change.**
```ts
  /** How an identifier is canonicalised before ANY strategy keys on it.
   *  Required and NON-NULL; the identity is `{ ops: [], then: 'exact' }`.
   *  Nullable would read as "unspecified", and unspecified takes the permissive
   *  branch at the first call site somebody writes in a hurry — §5.5. */
  normalisation: IdentifierNormalisation
  /** Partition key for N:M. NULL means this definition has NOT asked for N:M and
   *  `amount_sum` does not run — rather than running over one bucket holding
   *  every transaction in the period. NOT a member of `identifiers`: those are
   *  PAIRING keys and this is a PARTITION key, and folding them is §5.1. */
  counterparty: FieldPath | null
  /** The path holding counterparty prose, if any. A path here is NOT sufficient
   *  to reach a prompt: `FieldSpec.modelProcessingAllowed` (:1597) and
   *  `ModelUseConfig.maxDataClassInPrompt` both gate it, and both fail closed. */
  description: FieldPath | null
```
**Why.** ⚠️ **THIS IS F3, AND IT IS THE ONE EDIT THE ORCHESTRATOR MUST NOT APPLY
TWICE.** Design 1's DP-2 and Design 2's DP3 both claim this exact slot with two
vocabularies. Applied together, `PopulationSpec` carries two normalisers with no stated
precedence — §5.3 verbatim, and this record documents every prior instance diverging
within hours. **This is the merged form: Design 2's shape, Design 1's nullability.**
Apply this and neither of theirs.
**Breaking.** Yes — three required fields.
**Then.** `PopulationBinding` in `model/reconciliation.ts` collapses to `{ spec }`.

### DP-3 — `model/domain.ts` · per-strategy tolerance and the anchor
**Insertion point.** Replace the union body of `export type PairingStrategy` at
`:1952-1957`.
**Change.** Add `amountTolerance: Tolerance | null` to all four arms, and
`amountAnchor: AmountAnchor` to `fuzzy_reference`. `null` **inherits**
`PairingSpec.amountTolerance` — the same shape and the same reading as `MatchRule.when:
RulePredicate | null` (`:1796`), a guard whose null means unguarded.
**Why.** `PairingSpec` carries **one** `amountTolerance`, so an ordered strategy list
cannot express *"exact first, then tolerant"* — the draft's pass 1 and pass 2 are the
same strategy KIND differing only in tolerance. Without this the multi-pass certainty
ordering the whole design rests on **collapses into one tolerant pass**, and the engine
can no longer say an exact match is stronger evidence than a tolerant one.
⚠️ **`amountAnchor` is a FALSE-POSITIVE control and must be documented as one.** It is
**not** the containment bound — §2.8. The declaration comment must say so, or F8
reappears the first time somebody reads the field name and infers a security property.
**Breaking.** Yes.

### DP-4 — `model/domain.ts` · `MatchGroup` gains line-grain membership
**Insertion point.** Inside `export interface MatchGroup extends TenantScoped` (opens
`:2618`), immediately after `members: Record<SlotName, SourceDocumentId[]>` at `:2623`.
**Change.** `lineMembers: ItemRef[] | null` — required-and-nullable, never
`lineMembers?:`. Null for every archetype except `set_reconciliation`.
**Why.** `members` addresses **documents**. A bank statement is one document with four
hundred lines, so a set reconciliation's `MatchGroup` can record that the statement
participated and **can never record which line did** — the audit trail for a FIFO
waterfall is unrecoverable. Required rather than optional because the `TS2741` at each
construction site is the only compile-time evidence the field landed, and optional makes
every one of them vanish silently. ⚠️ **That argument is made here on its merits.
Designs 1 and 2 both attributed it to "G102"; G102 is `palette: null` (§1).**
**Breaking.** Yes. Free today — there is no schema — and a migration after the first row.
**Depends on.** DP-1 (needs `ItemRef` moved to `domain.ts` beside it).

### DP-5 — `model/domain.ts` · document the `date` scalar's format
**Insertion point.** The `date` arm of `ExtractedScalar` at `:1690`. **Doc comment only,
no shape change.**
**Change.** State: ISO-8601 calendar date `YYYY-MM-DD`, or an RFC 3339 instant whose
first ten characters are one. **Nothing may parse this with `new Date`** — `YYYY-MM-DD`
compares lexicographically and that IS the chronological order.
**Why.** The engine orders on this field and the draft it replaces ordered on
`new Date(payload[k])` — an unvalidated parse whose failure value is `NaN`, which
compares false against everything and puts the wrong invoice first in the queue.
Leaving the format unstated makes *"trust the extractor"* the only alternative, and that
is §5.2 — a caller-supplied assumption that switches a check off.
**Breaking.** No.

### DP-6 — `model/agents.ts` · `DerivedAgentGrant` gains an authorisation join key
**Insertion point.** Inside `export interface DerivedAgentGrant extends TenantScoped`,
after `stepExecutionId`; plus the field in `mintAgentGrant()`'s return and an
`authorizationId` on its `input`.
**Change.** `authorizationId: AuthorizationGrantId` (non-null), minted by `authorize()`
at step entry.
**Why.** **The agent path and the authorisation spine do not join today.**
`AUTHORIZATION_MAY_BE_ABSENT.agent = false` (`model/governance.ts:1232`) requires every
agent-authored `AuditEvent`, `DataAccessEvent` and `UsageRecord` to name a grant, and
`grep -c 'AuthorizationGrantId\|authorizationId' model/agents.ts` → **0**. There is
nothing for an agent act to name. Design 3's finding, verified.
**Breaking.** Yes. ⚠️ `model/agents.ts` is owned by the concurrent build — coordinate.
**Blocks.** OR-1's mid-run option. Not needed for the post-exception option.

### DP-7 — `model/billing.ts` · the idempotency key derivation
**Insertion point.** The `idempotencyKey` doc comment at `:133-138`.
**Change.** State the derivation: `${providerRequestId}#${meter}` where one call
produces rows on more than one meter; `${subjectId}#${meter}` where there is no provider
request id.
**Why.** The bare request id is **not unique per row**; `/metering/record` is idempotent
on this field and answers `409 IdempotencyConflict`, so output tokens are silently never
counted. `docs/build/event-architecture-recommendation.md` §5.4 currently recommends the
defective form. Design 3's finding, and its first failing test.
**Breaking.** No — comment only.

### DP-8 — `model/kernel.ts` · brand `FieldPath`, `SlotName`, `Timestamp`
**Insertion point.** Lines 422-424.
**Change.** `Id<'FieldPath'>` / `Id<'SlotName'>` / a branded `Timestamp`.
**Why.** ⚠️ **THIS IS WHY F5 HAPPENS AT ALL, and no design or red-team finding named
it.** Three bare `string` aliases in the kernel mean **any type naming a field, a slot
or a time is unassertable by G47's proof — shallow or deep.** They are not in
`BareByRule` (`model/identity.ts:842`); that list is about id-shaped fields. Design 2's
DP4 types failed its own DP5 for exactly this reason and it read the symptom as its own
mistake.
**Breaking.** Yes, and the blast radius is large — this is a slice, not a line.
**Recommendation.** Its own pass. Until then the module keeps `FieldPath` off every
asserted type and says so at each assertion.

### DP-9 — `model/identity.ts` · the deep no-text assertion
**Insertion point.** After `_CarriedReadingHoldsNoText` at `:1126`.
**Change.** Add `NoTextField` / `NoTextDeep` / `AssertNoTextDeep`, verbatim from
`model/reconciliation.ts` §0. **Do NOT re-point `_CarriedTurnHoldsNoText` in the same
change.**
**Why.** ⚠️ **A VERIFIED FINDING ABOUT AN APPLIED DECISION.** `AssertNoPlainText`
(`:1101`) is shallow and G47's proof therefore passes `readonly string[]`, a nested
`{ v: string }` and `Record<string, string>` — verified red/green in this session (§8,
run 3). `CarriedTurn` is safe today only because `CarriedReading` was asserted
**separately by hand** at `:1126`, which is discipline rather than structure: a third
nested type nobody remembers to assert is a silent hole.
Re-pointing is an amendment to an **applied** decision and is taken as one, with its own
red run.
**Breaking.** No.
⚠️ **The `T extends string ? T` arm before the object arm is load-bearing** — without it
a branded `Id<'X'>` recurses into `String`'s own methods and the SAFE case fails.
⚠️ TypeScript has an instantiation depth limit; verified to depth 3, untested beyond. A
deeply nested type could hit TS2589 rather than TS2344, and a `tsc` that fails for the
wrong reason is a control nobody trusts.

### DP-10 — `model/examples.ts` · 🛑 THE FIXTURE, AND WITHOUT IT DP-2/3/4 ARE DECORATIVE
**Insertion point.** The `FIXTURES` section (opens `:467`).
**Change.** One `set_reconciliation` fixture: a `ReconciliationDefinition` whose config
carries two `PopulationSpec`s with non-null `normalisation` and `counterparty`, one
`PairingSpec` with per-strategy tolerances, and one `MatchGroup` with `lineMembers`
populated.
**Why.** **Nothing in `model/` constructs any of these three types**, so DP-2, DP-3 and
DP-4 each produce `EXIT: 0` and the compiler tells you nothing. §5.10 exactly, on a day
§0a already records §5.10 recurring **within hours** on a type added the same morning.
The fixture is the only artefact that witnesses **content**.
**Breaking.** No.
⚠️ `model/examples.ts` is owned by the concurrent build — the orchestrator applies this.

### DP-11 — the E5 brandings, applied ONCE
**Change.** `UsageRecord.model: string | null` → `ModelCatalogEntryId | null`
(`model/billing.ts:238`); `PolicySubject` `model_call.model: string` →
`ModelCatalogEntryId` (`model/policy.ts:852`).
**Why.** The two remaining **live** invariant-7 bypasses. This engine is
`UsageRecord.model`'s first writer and every reader call is a `model_call`
`PolicySubject`, so branding now costs one line and later costs a backfill of an
append-only table.
⚠️ **Designs 2 and 3 both propose both edits, consistently. APPLY EACH ONCE.**
⚠️ **No document may claim this closes E5** — `Scorer.model` (`model/evaluation.ts:158`)
is still bare, though `@dropped-for-v1`. Verified: the sweep still returns exactly five
lines.
⚠️ **`tsc` will stay green either way** — nothing constructs a `UsageRecord` — so per
§5.10 this lands with a fixture or it is not verified.
**Breaking.** Yes.

### DP-12 — `CLAUDE.md` · one drifted citation
**Change.** The E5 table cites the `resolveModel()` parameter at `model/catalog.ts:168`;
it is at **`:185`** (`export function resolveModel(` is at `:184`). Verified.
**Why.** `tools/check-citations.mjs` cannot catch this class — the file exists and the
line exists, it just holds something else. Design 2 caught it; Designs 1 and 3 did not.
**Breaking.** No.

---

## 8. The first failing test for each pass — and whether it is genuinely test-first drivable

**The honest answer is: for the passes, yes; for the model types, no, and §5.10 is
exactly why.** Adding a field to `PopulationSpec` cannot fail a test that does not
construct one, so the type work is fixture-driven (DP-10) and the *behaviour* work is
test-driven. Those are different methods and conflating them is how five total records
landed on 7 Aug with no construction site.

`docs/build-conventions.md` §2 names `node --test` (G95, G96). `tests/**` is owned by
another agent this minute, so the runs below were executed as scratchpad probes against
the real module under Node's native type stripping. **Every one is reproducible; three
were seen red before green.**

| | Test | First failure, and it is not "file not found" |
|---|---|---|
| **1** | **A cash pool larger than its obligations returns the remainder as residue.** Obligations SGD 100.00 + 50.00; one credit SGD 200.00; `many_to_many`; `[{ amount_sum }]` | 🟢 **PASSES**: both obligations `fully_allocated`; the payment `partially_allocated` with residual **5000**, in residue once, cause `cash_exceeded_obligations`, postconditions empty. ⚠️ **Implemented with the draft's own pass-3 termination it fails on assertion 2 with `residual = 0` and on assertion 4 with the payment absent from the residue — SGD 50.00 has vanished, and no type in this repository could have caught it.** That red is the deliverable, not the green |
| **2** | **G105's two stages are distinguishable.** Obligations 100.00 + 50.00 + 70.00; one credit 120.00 | 🟢 Two allocations, evidence **`amount_sum_exact`**, `memberCount 2` (50 + 70 = 120). The 100.00 stays open. ⚠️ Under a waterfall-only implementation this pairs 100.00 + 20.00 of the second and records it as a match — **the allocation looks like a match, which is precisely what G105 forbids** |
| **3** | **Two ledger rows sharing a normalised id are not silently collapsed.** `one_to_one`, both `INV-1`, both SGD 100.00, one payment | 🟢 **0 allocations**, one ambiguity `L2×R1`, all three items in residue as `identifier_ambiguous`/`unidentified`. Under the draft this pairs one and loses the other |
| **4** | 🔴 **THE POST-CONDITION, SEEN RED.** Take run 3's sound result and drop one open item from the residue | 🔴 `[{"kind":"open_item_missing_from_residue","count":1},{"kind":"gross_not_partitioned","admittedMinor":30000,"accountedMinor":20000}]`. ⚠️ **Design 1's conservation identity reports nothing on this input, on any input** (§2.5). 10,000 minor units are visibly unaccounted |
| **5** | **The engine does not mutate its input.** `Object.freeze` every document, every `extracted` record, every `lines` array | 🟢 Completes. Under strict mode a mutating implementation throws on assignment — it fails loudly rather than passing |
| **6** | 🔴 **CONTAINMENT, SEEN RED.** Add `canonicalId: string` to `ReaderVerdict`'s `candidate` arm | 🔴 `TS2344: Type 'ReaderVerdict' does not satisfy the constraint 'NoTextDeep<ReaderVerdict>' … Type 'string' is not assignable to type 'never'.` Remove it → `EXIT: 0` |
| **7** | 🔴 **THE DEEP ASSERT CATCHES WHAT G47's PROOF MISSES.** Add `invoiceNumbers: readonly string[]`, `entities: { vendorName: string }` and `m: Record<string, string>` — the draft's own Output Contract fields — and assert the arm under **both** forms | 🔴 The deep form: `TS2344 … Types of property 'invoiceNumbers' are incompatible.` 🟢 **The shallow `AssertNoPlainText` returns NO ERROR on all three.** That is the F12 finding, reproduced against the model's own tsconfig |

**Still owed, and named rather than implied:** a test that two runs over the same input
produce identical allocation *sequences* (A9(h)); a two-tenant pooled-connection test
asserting the second request sees zero rows of the first (adopted verbatim from
red-buildability B5 — *"without this test the failure is undetectable by construction,
which is the whole point of it"*); and Design 3's meter test, which fails on a **live
recommendation being wrong** rather than on a missing file and is the best test in the
three designs.

---

## 9. Risks, each one named rather than routed around

- **⚠️ The three unset numbers are the largest.** `readerCandidateCap` is the
  containment bound and it has no value. The module **refuses** rather than defaulting,
  so no permissive number can leak in — but a refusal is not a bound either, and until
  OR-4 is closed the reader cannot run at all.
- **⚠️ On a definition with a wide `amountTolerance`, the reader may never be called.**
  The candidate set is small only because the amount narrows it. Refusals become residue,
  which is defensible — but on such a definition it may be *most* of the residue, and
  the feature looks broken to a customer while every control reports healthy.
- **⚠️ The audit chain is a per-`(tenant, stream)` serialisation lock on the hot path.**
  `RecordChain.sequence` gaps are the detection mechanism, so it cannot be a cached
  allocator. Per-record model calls (§2.7) make this worse than batching would have.
  Named, not solved.
- **⚠️ `amount_sum` is bounded for termination and expensive for tractability.** The
  model's comment at `:1955` overstates `maxMembers`. `maxBucketSize` refuses an
  oversized bucket to the residue rather than attempting it — which means a large
  counterparty silently gets no N:M matching and appears in the residue for a reason
  that is a *bound*, not a *finding*. `bucket_exceeded_bound` is a distinct residue cause
  for exactly that reason, and a product surface must distinguish them.
- **⚠️ The `confidence` ruling lives in a comment.** §5.1's shape, chosen deliberately.
- **⚠️ The money confinement is honour-system.** No linter is configured and
  `docs/build-conventions.md` §4 still lists the validation library as undecided. Say
  "honour-system", never "enforced".
- **⚠️ The tenant refusal has nothing forcing a caller to read it.** Same shape as
  `MAX_GRANT_HOURS` having zero call sites while its comment claimed enforcement. The
  real enforcement is G100 + G101.
- **⚠️ G9 is unapplied, so the trifecta validator cannot see this seam.**
  `TOOL_ADMITS_UNTRUSTED_TEXT` exists nowhere in `model/` and
  `validateAgentToolBindings()` still tests a landmark. Containment here does not depend
  on it — it is by what the reader may **emit** — but **no document may claim the
  trifecta check covers this path. It does not.**
- **⚠️ The reader is called by a worker, not bound as a tool**, so it is a model call
  `validateAgentToolBindings()` never examines. `TOOL_KEYS` is closed and adding a member
  is a platform release, so none was added. Design 2's recommendation — model the reader
  as an `AgentDefinition` with an empty `AgentToolBinding[]`, reusing
  `admittingAgentMayCarryTools: false` (`model/policy.ts:1006`) — keeps it inside the
  existing validator's reach and needs the owner's tick.
- **⚠️ Invariant 5 is enforced by nobody.** The three-line CI grep (no import of
  `MeterPrice` / `PriceTier` / `RateCard` / `RatedTotal`, no read of
  `ModelCatalogEntry.cost`) is a candidate for G108's one gate. Design 3's proposal,
  adopted as a recommendation.

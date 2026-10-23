# Owner rulings, 9–10 Aug 2026 — the ones recorded nowhere else

> **STATUS:** **WORKING MATERIAL · V1 AUTHORITY: NO** — like everything in `docs/build/`.
> 🛑 **These are RULINGS TAKEN, not work done, and NOT ONE is applied.** No line below exists in the
> tree. Where this document and a row in `docs/HANDOFF.md` §3 disagree, the G row wins.
>
> **Why this file exists.** Thirteen rulings were taken by the product owner in conversation on
> 9–10 Aug 2026. Some are already recorded — `docs/build/ingestion-pipeline.md` §7 carries O-1 to O-8,
> §12 carries T-1 to T-3, and the two adjudications carry the four cross-track rulings. **The twelve
> in §3 below are recorded NOWHERE, and would have been lost.** This is the durable record of them.
>
> ⚠️ **NINETEEN MORE were taken after this file was first written, in two later batches** — §3.13 to
> §3.20 (eight) and §3.21 to §3.24 (eleven, of which **eight were ruled on the written recommendation
> in one act** and are recorded as a group in §3.24 for that reason). **They are appended rather than
> merged into the original twelve, because the order rulings were taken is load-bearing** — it is the
> whole argument of §1 — and re-sorting them would destroy the only record of it.
> **Derive the section count, do not trust a sentence:** `grep -c '^### 3\.' docs/build/owner-rulings-10-aug.md`.
>
> ⚠️ **The nineteen consumed no numbers from §1's allocation, because §1's allocation was already fully
> spent** — sixteen numbers, sixteen rows. They take **G148–G166**, and §4.3–§4.6 say so explicitly at
> each extension rather than reusing a number. **The full drafted range is G132–G166: thirty-five rows,
> twenty ingestion and fifteen cross-track** (§4.6). **§3.1–§3.12 are still unnumbered** and need G167
> onward.
>
> 🛑 **Four later rulings arrived with a premise that does not hold at the tree as stated.** Each is
> corrected at the point of use, never silently: §3.15 (`cannot_determine` — the recorded arm is
> `field_codec_ambiguous`), §3.18 (`policy_subject` attributed to G75 — it is `docs/HANDOFF.md:2201`),
> §3.20 (*"which G38 demands"* — G38 carries the claim, not the rule), and §3.2 (O-20's *"against the
> recommendation"* framing — the written recommendation was **YES for mappings**). **None of the four
> changes a ruling**; all four change a citation somebody would otherwise have copied.
>
> **What this file is not.** It is not a decision. A G number is an identity and **only the product
> owner places a G row** (§4). It does not edit `docs/build/ingestion-pipeline.md` or
> `docs/build/stateless-adjudication.md`; §1 records an instruction for whoever does.
>
> ⚠️ **No count on this page is checked by any tool.** `tools/check-doc-counts.mjs` reads
> `CLAUDE.md`, `PRODUCT.md`, `README.md`, `docs/*.md` and `docs/contracts/README.md` — **its `TARGETS`
> array (`tools/check-doc-counts.mjs:224-232`) does not descend into `docs/build/`.** Every count here
> ships with the command that derives it for exactly that reason. `tools/check-citations.mjs` **does**
> scan this directory (`tools/check-citations.mjs:51-55`), so every `file:line` here is resolved by the
> gate — but that checker cannot tell whether a resolving line is the *right* line, which is why each
> one below was opened by hand.

---

## 0. Reproduce every claim on this page

Nothing here should be believed because it is written down. All five were run at the working tree of
10 Aug 2026, against a tree where a **concurrent session holds uncommitted work** in
`model/observability.ts`, `docs/contracts/control-plane.openapi.yaml`, `docs/model-graph.json` and an
untracked `docs/contracts/data-plane-local.openapi.yaml`. ⚠️ **Nothing below reads any of those four**,
which is deliberate: an export count, a contract-operation count and a contract-path count all move
under that work, so **this page states none of them.**

```bash
# 1. The G-number collision §1 resolves. Both adjudications derived 131 and both drafted G132.
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                              # 131 rows
grep -oE '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -oE '[0-9]+' \
  | sort -n | tail -1                                                  # 131 — rows equal maximum,
                                                                       # so no gaps, next free is 132
grep -n '^| G132 ' docs/build/ingestion-pipeline.md \
                   docs/build/stateless-adjudication.md                # BOTH files. The collision.

# 2. S-18's capability count, and the totality that will bite when a 38th lands.
awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts \
  | grep -cE '^  [a-zA-Z]+:'                                           # 37
grep -n 'Record<Capability' model/access.ts model/agents.ts            # access.ts:556 · agents.ts:393

# 3. O-15's premise: NOTHING refuses a population of zero, and conservation is vacuous over one.
grep -n 'export type PostconditionFailure' model/reconciliation.ts     # :2640 — five arms, none empty
grep -n 'export type SetReconciliationRefusal' model/reconciliation.ts # :2629 — seven arms, none empty

# 4. O-21's premise: the field exists, the meter exists, and NOTHING joins them.
grep -n 'carriedForwardFrom' model/*.ts                                # domain.ts:2952 — one line
grep -n 'exceptions_raised' model/billing.ts                           # :81 (meter) · :109 ('sum')

# 5. O-14's premise: cross-run uniqueness is DECLARED and has no evaluator.
grep -rn 'unique_within' model/*.ts                                    # 2 lines: domain.ts:367 is the
                                                                       # declaration; reconciliation.ts:1413
                                                                       # is prose. No evaluator anywhere.
grep -rn 'SubjectLedger\|knownUniquenessConflicts\|RunPlan\|selectTenantForSession' \
  model/*.ts db/*.ts                                                   # 0 — all four are PROPOSALS
```

**The five that carry §3.13–§3.20, added with the eight later rulings:**

```bash
# 6. O-22's asymmetry is ALREADY ARGUED IN THE TREE, for learning rather than for mappings.
sed -n '1176,1181p' model/learning.ts        # "Promotion WIDENS … retraction NARROWS it"
grep -n "RetractionMode = " model/learning.ts                # :1222 — 'suspend' | 'retract'

# 7. O-16's premise: the run status enum is FOUR states and the wire pair is NOT pinned.
grep -n "status: 'queued' | 'running'" model/domain.ts       # :2717 — four states, no 'incomplete'
grep -c "name: '" tools/check-wire-mirror.mjs                # 5 pinned pairs; run status absent

# 8. O-11's premise: the field does not exist, and the record it would join crosses the plane.
grep -rn 'arrivalId' model/*.ts                              # 0 — a proposal only
grep -n 'export interface UsageRecord' model/billing.ts      # :122
grep -n 'PARTNER_CAPABILITY_MASK: Record<' model/access.ts   # :950 — the allow-list to check it against

# 9. O-9's premise: the figure is on a drawn screen and is ILLUSTRATIVE.
grep -n "label: 'Coverage'" Mockups/rec/Close.dc.html        # :196 — value: '99.2%'

# 10. O-18's premise: NONE of the types it rules on exists yet.
grep -rn 'ValueCodec\|MapperVerdict\|cannot_determine' model/*.ts   # 0 — all three are PROPOSALS
```

⚠️ **The last command matters more than it looks.** `SubjectLedger`, `knownUniquenessConflicts`,
`RunPlan` and `selectTenantForSession()` are named throughout this document and **none of them exists
in the tree.** Every ruling below that names one is a ruling about a thing to be built, and no reader
should mistake a named type for a present one.

---

## 1. THE G-NUMBER ALLOCATION — this comes first because it unblocks two other documents

🛑 **A live collision.** Both adjudications independently and correctly derived 131 as the last used
number, and **both drafted `G132`**:

- `docs/build/ingestion-pipeline.md:931` — `| G132 | **A POSTGRES WORK QUEUE …** (O-1) |`
- `docs/build/stateless-adjudication.md:1217` — `| **G132** *(draft)* | **THE APPLICATION IS STATELESS…**`

Neither is at fault. `docs/build/stateless-adjudication.md:1209-1211` names the hazard in advance —
*"a concurrent pass is writing `docs/build/ingestion-p2-adjudication.md` and may take numbers first,
in which case renumber these and keep the order"* — and `docs/build/ingestion-pipeline.md:915-919`
states the principle: *"A G number is an **identity**: two documents minting the same number is worse
than a gap, because a gap is visible and a collision is not."*

### RULED

| Track | Rows | Numbers |
|---|---|---|
| **Ingestion** — O-1…O-8 plus T-1…T-3 | **eleven** | **G132–G142** |
| **Statelessness** — the five cross-track rulings | **five** | **G143–G147** |

**The reasoning the owner accepted, and it is a rule rather than a coin-toss.** `docs/HANDOFF.md` §3's
own convention numbers rows *in the order they were taken, because several depend on earlier ones*.
The ingestion rulings were taken first — O-1 to O-8 on 9 Aug evening, per
`docs/build/ingestion-pipeline.md:445`. And the dependency actually runs that way: the statelessness
track's rulings **reference ingestion controls** and not the reverse — the stateless draft at
`docs/build/stateless-adjudication.md:1218` names *"O-1's shape"* as the argument the in-Postgres
reader queue must now stand on, and `:1221` sequences G111's money codec against the reader executor
that O-1's queue feeds. Numbering the earlier track first therefore makes the dependency arrows point
forward, which is the only property the convention exists to buy.

### 🛑 The instruction, for whoever places these

**`docs/build/stateless-adjudication.md` §9's five draft rows are SUPERSEDED by this allocation.**
Their drafted numbers `G132`–`G136` must be renumbered **`G143`–`G147`**, in the same order, by
whoever places them. **This document does not edit that file** — the instruction is recorded here so
that the renumber is a deliberate act with a reason attached, not a silent fix.

✅ **The ingestion set needs no renumber.** `docs/build/ingestion-pipeline.md` §13 already drafts
exactly `G132`–`G142`, contiguous, eleven rows, in the order O-1…O-8, T-1…T-3. This allocation ratifies
what is already written there.

⚠️ **Re-derive before placing anything.** `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md` was **131** when
this was written and `tools/check-doc-counts.mjs` does **not** govern that count. If the tree has moved,
shift **both blocks together** and keep the relative order — the order is the part that carries the
dependency argument, not the absolute numbers.

🛑 **The twelve rulings in §3.1–§3.12 have NO draft rows anywhere, including here.** They need numbers
beyond G147. This document deliberately does not mint them: extending the allocation past what the
owner ruled would be the precise defect §1 exists to close, one iteration later.

> ⚠️ **UPDATE, and it is a numbering fact rather than an opinion. BOTH RANGES IN THE TABLE ABOVE ARE
> FULLY SPENT.** G132–G142 is eleven rows and the ingestion set is eleven; G143–G147 is five rows and
> the statelessness set is five. **Sixteen numbers, sixteen rows, zero spare.** So the eight rulings
> added later (§3.13–§3.20) **cannot be allocated inside either range**, and this document says so
> rather than squeezing them in: they take **G148–G155** (§4.3). **Reusing a number to stay inside a
> range would be exactly the collision §1 exists to resolve**, and a range is a convenience whereas a
> number is an identity.
>
> **They are numbered in the order they were taken, not grouped by track**, which continues §1's own
> convention rather than inventing a second one. Seven are ingestion controls and one (S-16) is
> cross-track; §4.3 labels each. ⚠️ **A reader who expects tracks to be contiguous will be wrong from
> G148 onward** — that expectation was never the rule, and G132–G147 being contiguous by track is a
> coincidence of those two sets having been adjudicated separately.

---

## 2. The four cross-track architectural rulings — restated so this file stands alone

All four were taken by the owner and are already argued at length in the two adjudications. They are
restated compactly here because a reader who has only this file must not have to reconstruct them.
**Full reasoning, and every losing argument, stays in the source sections cited.**

**(i) The statelessness rule is read OPERATIONALLY.** Source: `docs/build/stateless-adjudication.md`
§1 and §3.1. The rule is *"no node-local state that another node or a retry cannot reconstruct from
durable storage"* (`:97`) — **not** *"every byte physically in PostgreSQL"*. Reconstructible is defined
in three required parts at `:111-128`: **(a)** a durable anchor — a committed tenant row, or a
version-addressed artefact published downward by the control plane; **(b)** a rebuild that is a pure,
total function of those values plus a **named, enumerated** set of boundary inputs written down at the
rebuild site; **(c)** if the rebuild can re-perform an **effect**, the effect's durable key is over the
**CONTENT of the act, never a position in a derived array**, and the suppressed repeat **increments
something a person can query**. **Consequence:** G120's distributed map survives, which the literal
reading would have killed, and G107 stays intact.

**(ii) Audit chains are PARTITIONED, with the partition named in `ChainAnchor`.** Source: §3.2.
One chain per `(tenant, stream, partition)`. Under statelessness no node may hold a chain head in
memory, so N nodes appending to one chain serialise on a locked head row **inside the request
transaction** — and under G101 that lock is held for the whole transaction, making per-tenant audit
write throughput that tenant's request-concurrency ceiling. `ChainAnchor` (`model/governance.ts:1138`)
gains a field. 🛑 **IRREVERSIBLE, and the window is open now:** `RecordChain`
(`model/governance.ts:1110`) chains `previousHash` over canonical bodies, there is no migration that
rewrites a hash-chained stream, and **only two streams in the whole model are chained** —
`grep -rn 'chain: RecordChain' model/*.ts` → 2 (`model/domain.ts:3939`, `model/governance.ts:1158`).
This must land before the first chain row exists.

**(iii) The containment proof `AssertNoTextDeep` is INVERTED** to an allow-list of value-free leaves,
in **its own commit**, with **each leaf written RED first**. Source: §3.3 and
`docs/build/ingestion-p2-adjudication.md` §3.1–§3.2. The mechanism today bans the **type `string` at a
property position**, not string-bearing **values**: `NoTextField<T>` is `string extends T ? never : …`
(`model/reconciliation.ts:248-258`). So it is a **deny-list of one shape** read as a guarantee of
containment. Inverting it makes the guarantee the one people already believe it gives.
🛑 **Sequenced BEFORE any new containment assertion**, or the next surface writes assertions against a
proof that is about to change shape.

**(iv) G120's replay key becomes CONTENT-ADDRESSED.** Source: §3.4 and
`docs/build/ingestion-p2-adjudication.md:528-548`. G120's `(runId, requestOrdinal)` is *a position in a
derived array*; `(tenantId, subjectKey, candidateWitness)` identifies the **verdict** and
`requestOrdinal` **labels** the act, which still satisfies G121 verbatim.

> 🛑 **THE SEQUENCING CONSEQUENCE THIS CARRIES, AND IT IS THE ONE PEOPLE WILL DROP.**
> `canonicalise()` **refuses `bigint` rather than serialising it** — `model/canonical.ts:66-71` states
> the reason: *"A canonicaliser that invented a bigint encoding would be a SECOND answer to how money
> is represented, on the bytes an audit chain signs."* **So G111's money codec is sequenced BEFORE the
> reader executor.** ⚠️ **And the trap is that nothing is broken today:** `Money.amountMinor` is
> `number` (`model/domain.ts:535`), so every content-addressed key over a money-bearing body computes
> fine — **until the day G65 retypes it to `bigint`, at which point they all stop.** Nothing is broken
> and nothing is safe either. Note also that `model/canonical.ts` exports **no hasher** and says why
> (`model/canonical.ts:59-64`): *"The hasher lives with the writer, outside `model/`."* Canonicalise in `model/`, hash
> outside it.

---

## 3. THE TWELVE NEW RULINGS — recorded nowhere else

Each is **the question · what was ruled · the cost accepted · what it makes necessary next**. Every
`file:line` was opened. Every rejected alternative is preserved.

---

### 3.1 S-21 — D1 includes BOTH session arms

**The question.** Does the tenant-selection step of the session design include the **staff** arm, or
only the customer one? Raised by red-session S8 and by no green as a question
(`docs/build/stateless-adjudication.md:1195`).

**RULED.** `selectTenantForSession()` returns a **reasoned union** and accepts **EITHER**:

- a `Membership` (`model/domain.ts:1440`) — the customer arm; or
- a live `TenantAccessGrant` (`model/governance.ts:854`) — the staff arm,

with the resource class checked against **all THREE constants, not two**:
`PERMITTED_RESOURCES` (`model/governance.ts:432`), `CONTRACT_ONLY_RESOURCES`
(`model/governance.ts:512`) and `NON_DELEGABLE_RESOURCES` (`model/governance.ts:544`).

**Why all three, and it is not belt-and-braces.** `CLAUDE.md` invariant 8 records that **G75 existed
because a third list nobody had named made a whole ruling inert**: *"`secret` also sat in
`NON_DELEGABLE_RESOURCES`, which `authorisationPermits()` checks **first — before the null check,
before withdrawal, before anything**. G60 as written would have been **inert**."* ✅ Verified in the
tree: `authorisationPermits()` (`model/governance.ts:697`) tests `NON_DELEGABLE_RESOURCES` at `:703`,
`CONTRACT_ONLY_RESOURCES` at `:709`, `PERMITTED_RESOURCES` at `:712`, and the withdrawal check does not
arrive until `:715`. A picker that consults two of the three reproduces G60's defect exactly.

**Why it was necessary.** A picker built only on `Membership` is **EMPTY for a platform FDE**, so
`Session.tenantId` could never be set for staff and **invariant 8's permitted path would be
structurally unreachable** — G60's inertness one layer up. Copy the invariant, never paraphrase it:
*"Being staff is not access. Reaching a tenant requires a `TenantAccessGrant`."* A path that cannot be
reached is not a narrower access model; it is a broken one, and nobody would notice until an
engagement.

**The cost accepted.** D1 grows: the session surface now contains grant checking, which is
access-model logic rather than session logic. The adjudication's own note on the alternative is kept:
*"Excluding it is defensible staging **only if D1 says so out loud**"* (`:1195`) — the owner declined
the staging option rather than taking it silently.

**What it makes necessary.** A reasoned refusal union for the staff arm (there is no
`selectTenantForSession` in the tree to extend). The three-list check must be **one helper with one
call site**, not three inline `includes()` calls in the session path — a second implementation of the
three-list order is `docs/HANDOFF.md` §5.3, and the order is load-bearing.

---

### 3.2 O-20 — v1 BUILDS the correction / re-parse path

**The question.** *"Does v1 build correction at all?"* Every structural precedent the design copies is
`@dropped-for-v1` (`docs/build/ingestion-p2-adjudication.md:550-555`).

**RULED: v1 builds it.**

> 🛑 **TAKEN ON A DECISION THE RECORD MUST NOT FLATTEN, AND THERE IS A DISCREPANCY IN THE BRIEF FOR
> THIS RULING THAT IS RECORDED RATHER THAN RESOLVED.** This ruling was handed to me as *"chosen
> against the written recommendation"*, with the rejected advice given as **"enumerable now, fixable
> later"**. ⚠️ **That phrase appears verbatim nowhere in the tree** —
> `grep -rn 'enumerable' docs/build/*.md` returns ten lines and none of them is it. **And the written
> recommendation was not against building.** `docs/build/ingestion-p2-adjudication.md:904`'s
> Recommendation column reads, verbatim:
>
> > *"**YES for mappings, NO for anything else** — because a mapping binds the amount path and a
> > learned rule moves a disposition, which is a real asymmetry rather than a convenient one. **But it
> > is a scope decision with a G number, not a derivation**"*
>
> **So the owner's choice to build agrees with the adjudicator's recommendation.** What the
> adjudicator refused was green's *presentation* of it as a derivation rather than as a scope
> decision — `:555`: *"it is a scope decision with a G number, not a derivation, and green presents it
> as the latter."* This ruling supplies exactly the thing that was missing: an owner's decision.
>
> **The advice for the NO branch is preserved verbatim anyway**, because it is the argument a later
> reader will use to reopen this, and it is the closest thing in the tree to what the brief quoted
> (`:904`, Cost column):
>
> > *"If NO: `MAPPING_RETRACTION_UNMAKES_DOWNSTREAM = false` is the whole answer, a wrong mapping is
> > undone by hand, and C8's `mappingVersionId` makes the blast radius **enumerable without making it
> > fixable** — which is the state the first adjudication already recorded as nobody's"*
>
> ⚠️ **Whoever places the G row for this must resolve which of the two framings is the owner's own.**
> The framings differ in what is preserved: *taken against advice* obliges the record to keep the
> refused option alive under G75/G60 discipline; *taken in agreement* obliges it only to name the
> scope decision. **Both obligations are discharged above**, so nothing is lost either way — but the
> row should not assert the against-advice framing until the owner confirms it.

**The cost accepted, in two parts.**

**(a) It un-drops a family.** Every structural precedent for correction in `model/learning.ts` is
`@dropped-for-v1` — six markers carry one note verbatim
(`grep -c 'retraction is unbuilt in v1' model/learning.ts` → **6**):

> `/** @dropped-for-v1 7 Aug 2026 — retraction is unbuilt in v1; a wrong promotion is undone by hand. Declared, not built. */`

at `model/learning.ts:1188` (`LearningRetractionReason`), `:1206` (`RetractionRefusal`), `:1221`
(`RetractionMode`), `:1239` (`RETRACTION_UNMAKES_DOWNSTREAM = false`), `:1248`
(`LearningRetraction`) and `:1285` (`mayRetractLearning()`). **Building the mapping analogue makes
this asymmetric on purpose** — mappings get correction, learning does not — and `CLAUDE.md` requires
that every dropped declaration carry a dated note saying why. The asymmetry must be written on **both**
sides or the next reader reads the learning drop as an oversight.

**(b) It cannot be an in-place edit, and the ground is mechanical rather than aesthetic.** It touches
`MatchGroup` (`model/domain.ts:2765`), `Allocation`s and `Exception` (`model/domain.ts:2936`) that are
already recorded, against hash-chained streams. `docs/build/ingestion-p2-adjudication.md:507-510`
supplies the argument and it is the most valuable sentence in either report:

> *"Only two streams in the whole model are hash-chained (`grep -rn 'chain: RecordChain' model/*.ts`
> → 2), so **an in-place recapture leaves every chain valid and every anchor matching while silently
> changing what every recorded finding means.** Nobody in six prior reports said this."*

**So the shape must be a COMPENSATING act, never an in-place edit.** ✅ Verified: two chained streams,
`model/domain.ts:3939` (`AuditEvent`) and `model/governance.ts:1158` (`DataAccessEvent`).

**What it makes necessary.** `mappingVersionId` (nowhere in `model/` — `grep` → 0), an append-only
capture ledger, a plan, a per-document gate, and the retention and `SubjectLocation` consequences the
adjudication enumerates at `:516-518`. ⚠️ **`RetentionPolicy` is a total `Record` over 13 classes**
(`model/domain.ts:1179`, keyed on `RetentionClass` at `:1103`, asserted total by
`AssertAnswersEveryRetentionClass` at `:1197`;
`node tools/check-doc-counts.mjs --derive | grep retention` → **13**), so a fourteenth is a compile
error at the construction site — **the totality forcing the decision rather than letting it slide.**

---

### 3.3 O-21 — a correction of OUR OWN error is NEVER metered

**The question.** When we correct our own bad mapping, does the customer pay for the re-run?

**The premise, verified.** `Exception.carriedForwardFrom` (`model/domain.ts:2952`) already exists for
exactly this, and its docblock (`model/domain.ts:2944-2951`) says so:

> *"Cross-run identity. MatchGroup is minted per run, so without this March's exception stays open
> forever after April's run resolves it, and resolved-then-recurred is indistinguishable from
> never-resolved. **Also stops the billable exceptions_raised meter inflating on every re-run.**"*

And `exceptions_raised` is a real, summed, billable meter: `METERS.exceptionsRaised`
(`model/billing.ts:81`) and `METER_AGGREGATION.exceptions_raised = 'sum'` (`model/billing.ts:109`).
🛑 **Nothing sets the field and no post-condition checks it** — `grep -n 'carriedForwardFrom' model/*.ts`
returns **one line**, the declaration. So **today a 40,000-document correction of our own bad mapping
bills the customer for it**, and the field that exists to prevent that is inert.

**RULED.** The field is **set on every derived exception**, **AND** a **post-condition asserts it** —
so the meter cannot inflate even if a caller forgets. Both halves, deliberately: `CLAUDE.md` records
that *"a rule keyed on a convenient landmark instead of the property it protects is the most common
defect in this codebase"*, and a field whose correctness depends on every future caller remembering it
is that shape.

**⚠️ The cost accepted, and it is a design constraint rather than a price.** *"Our own error"* must be
a **recorded FACT on the correction**, not a judgement made at billing time. If billing infers it, the
distinction is **unauditable and disputable** — a customer who believes a re-run was our fault has
nothing to point at, and neither do we.

**Recommendation, NOT part of the ruling.** Make it an **arm of the correction's own cause type**, so
the fact is minted where the correction is minted and the type system carries it forward. This is
offered as a shape, not decided: the owner ruled *that the fact must be recorded*, not *where*.

**What it makes necessary.** A place for the fact; a setter on the derivation path; and a
post-condition. ⚠️ The post-condition family in `model/reconciliation.ts` is the wrong home —
`PostconditionFailure` (`:2640`) is asserted contentless by
`_PostconditionFailureHoldsNoText = AssertNoTextDeep<PostconditionFailure>` (`:2648`), and correction
post-conditions live on a surface that does not exist yet.

---

### 3.4 S-7 — a RESUME mints a NEW `AuthorizationGrant`, chained to the original

**The question.** May a resume mint a new grant for a map, making it one grant per *attempt* rather
than per map? (`docs/build/stateless-adjudication.md:1181` — *"No recommendation offered. G121's stated
cost is withdrawal, not expiry; this is new ground"*.)

**The premise, verified.** `MAX_AUTHORIZATION_SECONDS.tenant_data` is **900**
(`model/access.ts:1517` is the declaration; the `tenant_data: 900` entry is at `:1529`), and
`authorize()` refuses outright above the ceiling — `authorization_ttl_out_of_bounds`
(`model/access.ts:1685`). A node death plus a requeue can resume long after 900 seconds, so **G121's
one-grant-per-map cannot span a resume.** Nothing in the model is wrong; the grant simply expires.

**RULED.** Each resume **authorises itself afresh** and **records the grant it continues**, so the
audit trail joins the attempts rather than showing two unrelated authorities over one run.

**🛑 The condition the owner accepted, and it is the whole safety of the ruling.** **The mint must
RE-CHECK WITHDRAWAL.** Without it, an automatic retry **re-mints an authority a human revoked** — the
retry becomes a mechanism for undoing a revocation, which is strictly worse than the expiry it was
meant to survive.

**Also ruled, as an omission rather than a choice.** The executor calls `redeemAuthorization()`
(`model/access.ts:1753`) **on every attempt**, so an expired grant is **refused rather than assumed
live**. The adjudication records this as *"an omission, not a decision"* (`:1181`), and the model
already argues for it at `model/access.ts:1536-1543`: the grant is *"A REFERENCE, NOT A BEARER
TOKEN … possession of the id is not possession of the authority, and `redeemAuthorization()`
re-derives the authority every time."*

**The cost accepted.** One authorisation round-trip per attempt instead of per run, and a chain field
on the grant. G121's *"one `AuthorizationGrant` per map execution"* is **narrowed to one per attempt**,
which means the G121 row must be amended rather than merely cited.

**What it makes necessary.** A field recording the continued grant. ⚠️ **`authorize()` mints and
nothing else does** (invariant 10), so the chain field is a field on the minted grant, not a second
minting path — a second minter would break invariant 10 outright.

---

### 3.5 S-20 — the queue ROW is the only retry authority

**The question.** How do the distributed map's retry and the queue row's `attempts` compose?
(`docs/build/stateless-adjudication.md:1194`.)

**RULED, three parts.**

1. The Step Functions map is configured to **ONE attempt** and never retries.
2. **Every** retry decision belongs to the row's `attempts`.
3. The executor **reads the persisted `ReaderOutcome` before invoking**, so a completed-but-requeued
   item costs nothing.

**Why.** Two independent retry layers over **one PAID Bedrock invocation multiply** — `docs/HANDOFF.md`
§5.3 is the shape, and the adjudication names it at `:1194`: *"Two retry mechanisms over one paid act
is §5.3."* The lease floor (§3.10 below) bounds **one** layer, not their product. Part (3) is §1.1(c)
applied: the suppressed repeat must be a real no-op, not a cheaper repeat.

⚠️ **Note that the owner's ruling is STRICTER than the adjudicator's recommendation, which was**
*"the map's retry is bounded BELOW `maxAttempts` so the row is the arbiter"* (`:1194`) — a bounded map
retry, not zero. The owner took zero. **That is preserved because the weaker form will look like a
reasonable simplification to somebody later**, and it is not: a map retry bounded below `maxAttempts`
still multiplies, just by a smaller factor.

**The cost accepted, stated plainly.** **Step Functions' built-in backoff and jitter are given up** and
must be implemented in the queue. That is **real work** — and then it is **visible in a table rather
than in a state-machine definition**, which is a durable gain rather than a consolation: a backoff
policy in a row is readable, queryable and testable by the same two-row negative tests every migration
here already lands with.

**What it makes necessary.** A backoff and jitter column set on the queue row, and a read of the
persisted outcome ahead of every invocation. ⚠️ **`NormalisationReader` is a synchronous function type**
— `export type NormalisationReader = (request: ReaderRequest) => ReaderOutcome`
(`model/reconciliation.ts:2350`) — and the stub beside it *"returns a REFUSAL, not a fabricated
value"* (`:2353-2358`), specifically because *"the draft's own failure mode here was `return []` — a
fabricated empty result that is indistinguishable from 'the model found nothing'."* The pre-read must
refuse in that same shape, never return an empty outcome.

---

### 3.6 O-15 — an EMPTY population REFUSES, with its own named arm

**The question.** What happens when a population admits zero items?

**The premise, verified in the tree, and it is worse than it sounds.** ✅ **Nothing in
`model/reconciliation.ts` refuses a population admitting zero items.** `admitPopulation()` (`:1113`)
returns `{ admitted, refused }` and simply iterates `documents` — an empty array means the loop body
never runs. `SetReconciliationRefusal` (`:2629`) has **seven arms** and none of them is an empty
population. And `checkPostconditions()` (`:2681`) iterates `state.items.values()` at **`:2702`**,
accumulating `admittedMinor` and `accountedMinor` from **zero**, so the conservation check at `:2726`
compares `0 !== 0` — **every conservation check passes trivially over an empty set.**
`PostconditionFailure` (`:2640`) has five arms and every one is a `count > 0` test.

**So a statement that failed to parse, an endpoint that returned nothing, or a mapping that refused
every row currently reports a clean, fully-reconciled close over nothing.** The load-bearing arm's own
comment (`:2641`) reads *"THE load-bearing one. See §5's note on why conservation is a tautology"* —
and over an empty set it is a tautology in the strongest sense.

**RULED.** An empty population **REFUSES**, with **its own named arm**.

**🛑 The escape the owner accepted must be a DECLARED EXPECTATION, not a caller-supplied flag.** A new
tenant's first run, or a dormant account, genuinely needs a way to say *"zero is expected here"* — but
`docs/HANDOFF.md` §5.2 is the shape a boolean parameter would take: **a boolean parameter on the call
is an off-switch on the check**, reachable by anyone who finds the refusal inconvenient. The expectation
is **declared** on configuration, where it is FDE-set and auditable, exactly as O-8 rules for every
other bound.

**The cost accepted.** Onboarding a genuinely empty source now requires a declaration before the first
run succeeds. Real friction, and the same friction O-3 and O-8 both already accepted.

**What it makes necessary.** An eighth `SetReconciliationRefusal` arm and a declared expectation on
configuration. ✅ **The precedent to copy is in the same file and it is exact:**
`grep -n '_not_stated' model/reconciliation.ts` returns **eight** lines — four declared arms
(`:391`, `:2634`, `:2635`, `:2636`) and four refusal sites (`:420`, `:2777`, `:2798`, `:2806`). Each is
a bound that **refuses on absence with a named arm**. ⚠️ **A new arm must hold no text** —
`_SetReconciliationRefusalHoldsNoText = AssertNoTextDeep<SetReconciliationRefusal>` (`:2638`) will
make a `string` field on it a compile error, which is the cross-track ruling (iii) already working.

---

### 3.7 S-18 — the reader act gets its OWN capability, classed `tenant_data`

**The question.** Which capability does a reader act redeem? None of the current set names it
(`docs/build/stateless-adjudication.md:1192`).

**The premise, verified.** `trigger_run` is classed **`configuration`** —
`trigger_run: 'configuration'` at `model/access.ts:611`, and the docblock immediately above it
(`:606-610`) states the reason: *"Running a configured job is an act on configuration, not a read of
the result. What the run produces is `tenant_data` and is gated by the capability that reads it."*
The reader act **reads tenant data**. And `authorize()` refuses that mismatch outright
(`model/access.ts:1675`):

```
if (CAPABILITY_RESOURCE_CLASS[capability] !== request.resource.resourceClass) {
  return refuse(DECISION_REASONS.authorization_resource_class_mismatch)
}
```

with the docblock above it (`:1669-1674`) explaining that a capability aimed at the wrong class *"is
either a caller bug or an attempt to launder a class past `PERMITTED_RESOURCES`, and nothing here can
tell which — so both refuse."* **So reusing `trigger_run` for the reader act does not merely read
oddly; it refuses at runtime.**

**RULED.** The reader act gets its **OWN capability**, classed against what it actually reads —
**`tenant_data`**.

**The count, derived not remembered.**
`awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'` → **37**.
So this is **capability 38**.

**⚠️ It will break two total records as compile errors, and that is the intended behaviour.**
`CAPABILITY_RESOURCE_CLASS: Record<Capability, AccessResourceClass>` (`model/access.ts:556`) and
`DELEGABLE_TO_AGENT`'s backing record — `} as const satisfies Record<Capability, boolean>`
(`model/agents.ts:393`, list at `model/agents.ts:407`). **G128 records this exact pair firing and
records it as a win**, `docs/HANDOFF.md:995`: *"THE TOTALITY BIT, LOUDLY, AND THAT IS WORTH RECORDING
BECAUSE FIVE TOTAL RECORDS HERE DO NOT: adding the member alone gave `TS2741` on
`CAPABILITY_RESOURCE_CLASS` **and** `TS1360` on `DELEGABLE_TO_AGENT` in `model/agents.ts` — a second
total record nobody had remembered."*

**The cost accepted.** A capability is a **platform release**: it moves a governed count that
`tools/check-doc-counts.mjs` checks in five documents, and it must be decided **against** the partner
mask as well as for the class. G128's rejected alternative applies here unchanged and is preserved:
classing it `configuration` would be cheaper to grant and is refused because
`PERMITTED_RESOURCES.delivery` reaches `configuration` (`model/governance.ts:437`), so a standing
90-day FDE grant would acquire it.

**What it makes necessary.** The member, its class, its `DELEGABLE_TO_AGENT` verdict, and an explicit
decision on `PARTNER_CAPABILITY_MASK` — G87 records that mask as *"an allow-list"*
(`docs/HANDOFF.md:954`), so absence is the default and silence is safe. ⚠️ **Assert it by name, not by
a length** — G128's applied row records that discipline explicitly.

---

### 3.8 S-19 — the statelessness rule binds the SERVER; browser state must be DISPOSABLE

**The question.** Does the statelessness rule bind the browser?
(`docs/build/stateless-adjudication.md:1193`.)

**Why the question existed, and it is the interesting part.** The green designs **quietly exempted the
browser for themselves while refusing the same exemption for G120's orchestration.** The adjudication
records it at `:1193`: green assumed *"the SERVER, not the browser"* and said that line *"is the
difference between eleven durable artifacts and four"* — and at `:1193` again, *"green chose for
itself what it refused to choose for G120."* An unstated exemption that happens to shrink your own
deliverable by seven items is not a reading of the rule.

**RULED.** The rule **binds the SERVER**. Browser state must be **DISPOSABLE** — and **anything a user
would be upset to lose is a durable row**, which is what the held-work design exists for.

**The cost accepted.** *"Disposable"* is a **per-screen judgement** and **no tool can check it.** The
adjudication already records the class: *"Browser state. There is no frontend root. `Mockups/rec/` is
drawn screens and no code"* (`:171`). So there is nothing to grep, no assertion to write, and a clean
`npm run check` says nothing whatsoever about this ruling. It is held by review or not at all.

**What it makes necessary.** A per-screen pass over the drawn surfaces asking, of each piece of
client-side state, *would a user be upset to lose this?* — with the answer written down beside the
screen. `docs/screen-pack-ledger.md` is where that joins the model.

---

### 3.9 S-11 — held-work autosave is metered at a COARSE grain

**The question.** Is autosave a metered act? (`docs/build/stateless-adjudication.md:1185` — *"You
decide. Either typing has a unit price, or something marks an act non-metered"*.)

**RULED.** Metered at a **COARSE grain**: **one row per draft, never per keystroke-batch.**

**⚠️ The cost, recorded honestly, because it is a PRIVACY consequence and not a technical one.** Even
at draft grain, this is **a per-person count of how many drafts each named finance operator opened** —
and metering is partner-visible. G87 (`docs/HANDOFF.md:954`) rules *"Partners read AGGREGATES, never
raw rows"*, so the exposure is at aggregate grain rather than row grain, but the aggregate of a
per-person count is still a per-person count once the population is one named operator. **Nothing on
any drawn screen discloses this**, and the adjudication flagged it as the unpriced half at `:1185`:
*"the metering table becomes a per-person count of typing cadence that no screen discloses."*

**The rejected alternative, and why it lost.** **Full metering** — a row per keystroke-batch — was
refused because it would make **the metering table a per-person typing-cadence record of a regulated
customer's staff.** That is not a billing artefact; it is behavioural telemetry about named
individuals, produced as a side effect of a save button.

**What it makes necessary.** A grain decision written on the meter itself, and a disclosure decision on
the screen. ⚠️ **`METERS` (`model/billing.ts:75`) and `METER_AGGREGATION` (`model/billing.ts:103`) are
a paired total record** — `Record<Meter, MeterAggregation>` — so a new meter is a compile error until
its aggregation is stated. ⚠️ **And the stock-versus-flow trap is live:** the docblock at
`model/billing.ts:90-93` records that summing a **stock** meter *"over-bills 30x; hourly, 720x."*
A draft count is a **flow** and sums; a count of *open* drafts is a **stock** and does not.

---

### 3.10 S-4 addendum — the work-queue lease FLOOR is required configuration that refuses on absence

**The question.** Every bound on the session and queue surfaces is being stated as required
configuration (S-4). Does the **lease floor** join them?

**RULED.** It joins them, alongside the O-8 bounds: **required configuration that REFUSES on absence.**

**Why.** Without a minimum, **any call slower than the lease is double-paid by construction** — the
lease expires, a second worker claims, and one paid model invocation is billed twice with nothing
anywhere recording that it happened. The adjudication states it at `:1178`: *"Without the floor, every
model call slower than the lease is double-paid by construction."* This is not a tuning parameter; it
is the difference between a queue and a duplicate-billing machine.

**⚠️ There is an upper-bound precedent and no lower one anywhere.** The shape to copy is
`MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1517`) — a total `Record<AccessResourceClass, number>`
whose docblock (`model/access.ts:1506-1508`) states the polarity: *"TOTAL BY CONSTRUCTION, like
`CAPABILITY_RESOURCE_CLASS`. A fourteenth resource class that nobody bounds is a COMPILE ERROR rather
than a class that inherits whichever default was written first."* **Every bound in the tree is a
ceiling.** A floor is a new direction, and the refusal arm matters more for a floor than for a ceiling:
a missing ceiling is unbounded and loud; a missing floor is a default of zero and silent.

**🛑 NO NUMBER IS STATED HERE.** `PRODUCT.md` forbids inventing one, and it must be set **above the
slowest expected model call, which nobody has measured.** The discipline is already written in the
tree, at `IdentifierNormalisation.maxInputChars` (`model/reconciliation.ts:381-386`): *"a bound with no
number is not a bound … It is never silently unbounded, which is the outcome a default would produce."*

**The cost accepted.** Onboarding cannot be completed by leaving the field blank — the identical cost
O-8 accepted. **What it makes necessary:** the config field, a named refusal arm (the
`_not_stated` family at `model/reconciliation.ts:391`, `:2634-2636` is the shape), and a measurement
nobody has taken.

---

### 3.11 O-13 — PostgreSQL 17

**The question.** Which PostgreSQL major version?

**RULED. PostgreSQL 17**, pinned **now**.

**Why now.** Phase one runs against a disposable Postgres with an in-process `pg.Pool` and **no AWS
resource** — G101 (`docs/HANDOFF.md:968`). ✅ The tree already has the phase-one substrate:
`db/provision.ts`, `db/tenant-scope.ts`, `db/migrate.ts`, `db/env.ts`, `db/pg.ts` and
`db/migrations/`. **Pinning is free today and expensive later**: every migration written against an
unpinned major is a migration nobody can prove ran on the version production will use.

**The cost accepted.** A version commitment taken before any hosted-fleet decision, and therefore
taken without the constraint that decision will impose.

**⚠️ STANDING VERIFICATION, NOT DONE.** **Confirm the Aurora Serverless v2 engine version before the
hosted fleet depends on it.** This document asserts nothing about what Aurora Serverless v2 offers —
no version was fetched, and O-6's precedent in `docs/build/ingestion-pipeline.md:466` is the right
posture: a standing verification is recorded as **not done** rather than assumed.

---

### 3.12 O-14 — cross-run uniqueness by PRE-FLIGHT INJECTION, the owner's own design, ADOPTED with four amendments

**The question.** How is cross-run uniqueness — the duplicate-invoice control — evaluated?

**The premise, verified, and it is a real hole.** `RulePredicate` declares
`{ kind: 'unique_within'; subject: Expr; scope: 'group' | 'run' | 'period' | 'tenant_lifetime' }`
(`model/domain.ts:367`), and its docblock (`model/domain.ts:363-366`) says what it is for:
*"`tenant_lifetime` is what duplicate-invoice detection actually needs: the same invoice number from
the same vendor, resubmitted months later, is not detectable within a group or a run."*
✅ **`grep -rn 'unique_within' model/*.ts` returns exactly two lines** — that declaration, and a prose
note at `model/reconciliation.ts:1413`. **There is no evaluator.** The control is declared and does
nothing.

**The owner's proposal.** A `SubjectLedger` table; a **pure pre-flight extraction** of subject values;
**one batched query** for collisions; **injection of a `knownUniquenessConflicts` map** into the
evaluation context; and a **post-flight insert whose `UNIQUE` constraint is the race guard.**

**✅ ADOPTED. It aligns with the engine's established pattern, and the precedents must be named
because they are what make this a small change rather than a new mechanism.**

- **A caller-supplied map injected into the evaluation context already exists.**
  `AdmissionContext.fieldClassification: ReadonlyMap<FieldPath, DataClass>`
  (`model/reconciliation.ts:993`, inside the interface declared at `:992`) is exactly that shape.
- **And an absent entry already REFUSES rather than passing.**
  `{ kind: 'field_not_classified' }` (`model/reconciliation.ts:847`) is refused at **four** call
  sites — `:1015` (amount), `:1030` (date), `:1044` and `:1062`.
  `grep -c 'field_not_classified' model/reconciliation.ts` → **5**: the declaration plus four refusals.
  The docblock above it (`:845`) states the polarity: *"`DENY_ALL` and G100's deny-on-NULL are the same
  posture."*
- **The reader seam already emits-and-consumes without awaiting.** `buildReaderRequests()`
  (`model/reconciliation.ts:2392`) emits requests into `SetReconciliationResult.readerRequests`, and
  `applyReaderVerdicts()` (`:2451`) consumes outcomes in a separate pass — and
  `NormalisationReader` (`:2350`) is a **synchronous** function type. The pre-flight/post-flight split
  is the same seam, one surface over.

**The four amendments, all of which the owner accepted.**

**(a) 🛑 An absent or unsupplied conflict map must REFUSE, not pass.** `conflicts.get(id)?.has(v)`
yields `undefined` when the map is missing, and `undefined` is falsy, so **the rule would SILENTLY
PASS** — **fail-open on a duplicate-payment control.** `field_not_classified` is the precedent for
refusing instead, and it is the precedent for a reason: `CLAUDE.md` invariant 4 records that
*"readable-by-default-with-a-high-bar is scope failing OPEN, which `docs/HANDOFF.md` §5.5 records this
codebase already fixing once."* ⚠️ Note the mechanical trap: under `noUncheckedIndexedAccess` a `Map`
lookup is already `T | undefined`, so **the compiler will not catch this one for you** — the optional
chain is legal and the fail-open is the natural way to write it.

**(b) Store a CANONICAL HASH, not the raw `subject_value`.** Raw invoice numbers are
**counterparty-controlled text in a permanently-retained, queryable column** — and `tenant_lifetime`
means the ledger remembers a value **a data subject may have a PDPA right to erase.** Hash via
`model/canonical.ts` (**G20, ✅ applied** — `docs/HANDOFF.md:806`), then hash outside `model/`, because
`model/canonical.ts` deliberately exports no hasher (`model/canonical.ts:59-64`).
**Cost, stated:** the ledger alone can no longer show **WHICH** prior invoice collided — only that one
did. The current run's own record has the value; the ledger is a membership test, not an index.
⚠️ **And two further consequences of (b) must be carried:** `canonicalise()` **refuses `bigint`**
(`model/canonical.ts:66-71`), so a subject value that is ever money must go through G111's codec first
— the same sequencing as §2(iv); and the ledger table needs a **`RetentionClass`**, where
`RetentionPolicy['days']` is a total `Record<RetentionClass, number>` (`model/domain.ts:1179`) over the
13 classes declared at `model/domain.ts:1086-1102` and asserted total at `:1197-1203`. **A fourteenth
class is a compile error at the construction site** (`PLACEHOLDER_RETENTION_POLICY`,
`model/examples.ts:534`) — **the totality forcing that decision rather than letting it slide**, which is
the same mechanism §3.7 relies on.

**(c) `knownUniquenessConflicts` must be pinned in the `RunPlan` and in the content key.** It is a
**new thing the fold reads**, and under §2(iv)'s content-addressed key **two resumes against different
ledger states would otherwise produce two different ledgers from identical input** — the key would be
stable while the answer was not. ⚠️ **`RunPlan` does not exist** (`grep` → 0); it is the pinning
vehicle §2(iv) requires, and it must pin `pairing`, `strategyBindings` and both `PopulationBinding`s
already (`docs/build/stateless-adjudication.md:1221`). This adds a fourth thing to pin.

**(d) Bound the retry and count the suppression.** A full reconciliation re-run on one collision is
**expensive and unbounded under concurrent runs** — the `UNIQUE` constraint fires, the run restarts, and
under concurrency it can fire again. The conflict must **increment a queryable counter**, which is
**clause (c) of the statelessness rule** verbatim (`docs/build/stateless-adjudication.md:132-134`):
*"An effectful act may be made retryable only when its durable key is over the CONTENT of the act …
and only when that same key makes the second attempt a no-op that is COUNTABLE."*

**The cost accepted overall.** A new table, a new retention decision, a fourth pinned input, a bounded
retry loop and a counter — to make executable a predicate the model has declared since before this
pass began.

---

> ## §3.13–§3.20 — THE EIGHT LATER RULINGS
>
> Taken **after** §3.1–§3.12 and appended in the order taken. Same format. **Seven are ingestion
> controls; one — §3.14, S-16 — is cross-track.** All eight are drafted as G rows in **§4.3**, and the
> reason they are not inside §1's two ranges is stated there and in §1.

---

### 3.13 O-22 — a platform principal MAY SUSPEND a mapping she promoted. ONE person suspends; TWO to re-promote

**The question.** May a platform principal suspend a mapping she promoted? Raised as
`docs/build/ingestion-p2-adjudication.md:558` — *"O-22 (may a platform principal suspend a mapping she
promoted — red-correction S1 is G60's shape in miniature)"*.

**Why it was needed.** The only expressible acts were **promote** and **let-it-expire**. So a mapping
**known to be wrong kept parsing incoming files for as long as the correction took** — and under O-20
(§3.2) a correction is now a compensating, multi-step act, which means that window is not short.

**RULED. Suspension exists, and the asymmetry IS the ruling: one person suspends and it bites
immediately; restoring it is a WIDENING and needs the full two-person promotion again.**

**✅ This is not a new rule — it is the rule the tree already argues, moved one noun over, and the
argument is already written.** `model/learning.ts:1176-1183`:

> *"WHY UNDOING TAKES ONE PERSON WHERE PROMOTING TAKES TWO. Not an oversight and not a convenience.
> Promotion WIDENS what the system does unattended; retraction NARROWS it. The rule this codebase
> already holds twice — `recommendAutonomyCeiling()` and `purgeVerdict()` — is that narrowing is
> automatic and widening is an act. Requiring a second approver to STOP a learning would invert it,
> and would do so at the worst moment: the hour somebody notices the system is behaving on a claim
> that is wrong."*

The rule itself is `docs/HANDOFF.md:611` row A — *"Narrowing is automatic; widening is an act"* — and
`docs/access-and-agency.md:37` states it as a heading. It is already applied to **autonomy ceilings**
(`recommendAutonomyCeiling()`) and to **role reversion on rollback** (`docs/HANDOFF.md:632` row D:
*"Behaviour reverts on an automated safety rollback; authority stays at `min(v_n, v_n+1)`"*, which
`CLAUDE.md` invariant 9 restates as *"a rollback reverts behaviour, never authority"*). ✅ **And the
two-state vocabulary already exists**: `export type RetractionMode = 'suspend' | 'retract'`
(`model/learning.ts:1222`) — ⚠️ **`@dropped-for-v1`**, like its five siblings, so O-20's un-drop
(§3.2(a)) and this ruling touch the same family.

**The cost accepted.** Files arriving while a mapping is suspended **have no valid mapping and refuse
to the residue** — visible and unprocessed rather than parsed wrongly. **That is the correct failure,
and it is still a stopped pipeline somebody must notice.** Suspension therefore buys correctness at
the price of an operational obligation that nothing in the model can discharge.

**🛑 REJECTED: automatic suspension on conformance failure. The reasoning is preserved because it will
be proposed again, and it sounds obviously right.** Refused on two independent grounds: it is an
**unattended authority change**, which is the polarity this whole rule protects; and **a noisy period
of legitimate data could suspend a good mapping mid-close** — the precise shape G129's autonomy gate
exists to prevent. G129 (`docs/HANDOFF.md:996`) rules that *"`mayAutoResolve()` MUST EXIST AND PASS
BEFORE ANY LEARNED RULE EXECUTES"* on the finding that *"there is no executable autonomy gate anywhere
in `model/`."* An auto-suspension would be a second unattended actor arriving before the first gate
exists.

**What it makes necessary.** A suspended state on the mapping, a one-person act that reaches it, and a
re-promotion path that routes back through the **two-person** gate. ⚠️ **The two-person gate is
`promote_learning`, capability 37, classed `authority` under G128** (`docs/HANDOFF.md:995`) — a mapping
promotion is not that capability, so **either a mapping promotion needs its own capability or it must
argue for reusing one.** That decision is not taken here and §3.7's capability 38 is a different act
(reading), not this one.

---

### 3.14 S-16 — an in-process cache is PERMITTED for version-addressed control-plane artefacts, under an explicit ALLOW-LIST, and ONLY where nothing can revoke the artefact

**The question.** Does the statelessness rule forbid an in-process cache of a control-plane-published,
**tenant-independent, version-addressed** artefact — the model catalogue, a pack, a policy bundle?
(`docs/build/stateless-adjudication.md:1190`.)

**RULED. Permitted, keyed by version — so a new version is a new key — under an explicit ALLOW-LIST,
and ONLY for artefacts nothing can revoke.**

The first half was already reconstructible under §2(i)(a): a version-addressed artefact published
downward by the control plane is an admitted durable anchor
(`docs/build/stateless-adjudication.md:111-116`), and the worked test grants it —
*"A model-catalogue cache keyed on artefact version … RECONSTRUCTIBLE — and still an owner call"*
(`:148`). G89 supplies the addressability (`docs/HANDOFF.md:956`): *"The control-plane → data-plane seam
is ARTEFACT-VERSIONED, not endpoint-versioned … Each published artefact — pack, policy bundle, model
catalogue, grant list — carries **its own** format version."*

**🛑 THE SECOND HALF IS THE RULING, AND IT MUST BE WRITTEN OUT BECAUSE IT IS THE HALF THAT IS EASY TO
LOSE: IMMUTABILITY DOES NOT COVER REVOCATION.** A signed bundle that has been **revoked** is still
version-addressed, still immutable, still a perfectly legal cache key — and would still be **cached**.
That is a **stale AUTHORITY cache: a privilege escalation with a timer**, and it is the single thing
this rule most exists to prevent. **So the allow-list admits only artefacts with no revocation
semantics; anything revocable is read every time.** Note that G89's own list includes **`grant list`**,
which is exactly the revocable kind — so the allow-list must not be derived from G89's enumeration.

**The cost accepted.** The allow-list is **a list somebody must maintain honestly, and adding to it
wrongly is silent.** No compiler and no checker can tell whether an artefact has revocation semantics;
`docs/build/stateless-adjudication.md:172-173` already records the general form of this limit —
*"§5 rules the waiver into a counted allow-list precisely because shape is all a checker can read."*
The adjudication also names the specific failure at `:1190`: *"a version-keyed cache is one careless
key away from tenant-keyed."*

**Context that must be recorded with it, because it is the thing readers will get wrong.**
**The session read remains UNAMORTISABLE.** It is forbidden **twice** — by this rule and by **G116**,
whose reason is not performance: `docs/HANDOFF.md:983` records that the module's design history carries
**`S2`, a module-level cache that leaked inferred structure ACROSS A TENANT BOUNDARY**, and that *"no
module-level mutable state is one of the module's eleven header controls."* And **G103 closed Redis**
(`docs/HANDOFF.md:970`) on the ground that *"four of the model's invariants are enforced BY THE
STORE"*, so **there is no third store to cache into.** A signed session token is refused **by name** at
`model/access.ts:1536-1543` — *"A REFERENCE, NOT A BEARER TOKEN … That is a deliberate refusal of the
JWT shape."* **S-16 permits a cache of a downward-published artefact and permits nothing about the
session.** Three uncacheable reads therefore stay in one latency budget
(`docs/build/stateless-adjudication.md:1217`).

**What it makes necessary.** The allow-list itself, with a revocation verdict written beside each
entry; and a rule that the cache key is the artefact **version**, never a tenant.

---

### 3.15 O-18 — the `ValueCodec` carries BOTH date orders, and which one applies is DECLARED per source

**The question.** How does the mapper resolve date order? Recorded as O-18 at
`docs/build/ingestion-p2-adjudication.md:902` — *"The `ValueCodec`'s initial membership"*, mapped from
`ingestion-p2-green-mapper-seam.md` O-10 (`:880`).

**Why the question is unanswerable by inference, and the reason is arithmetic rather than design
taste.** **`09/03/2026` parses under both orders** — 9 March and 3 September are both valid dates — so
**no shape profile can resolve it.** And the trap underneath: **C13's conformance floor would AGREE with
the wrong guess, because it uses the same codec.** A conformance check that shares the defect it is
meant to catch is `docs/HANDOFF.md` §5.6 — a checker that passes while asserting nothing.

**RULED. The `ValueCodec` carries BOTH date orders, and which one applies is DECLARED per source. The
mapper never guesses; it selects within a convention already stated at source onboarding.**

**✅ Record this as REUSING an existing ruling, not as a new one.** It is **C16's rule — *declared,
never inferred* — applied to dates instead of currency.** The currency form is already executable:
`admitOne()` takes `expectedCurrency: string | null` (`model/reconciliation.ts:1004`) and refuses
`{ kind: 'currency_disagrees_with_population' }` when the observed value disagrees
(`model/reconciliation.ts:1024-1026`). **The date form is the same control on a different field.**
Recording it as a new ruling would produce two vocabularies for one concept, which is
`docs/HANDOFF.md` §5.3.

**Ambiguity outside the declaration refuses to the FDE**, which requires a refusal arm the red pass
found missing.

> ⚠️ **A PREMISE CORRECTION, AND IT IS A NAME RATHER THAN A SUBSTANCE.** This ruling was handed over
> naming a **`cannot_determine`** arm on `MapperVerdict.field`. **`grep -rn 'cannot_determine' model/*.ts
> docs/build/*.md` returns ZERO** — that name exists nowhere. **The arm the red pass actually specified
> is `field_codec_ambiguous`**, and it is written out twice:
> `docs/build/ingestion-p2-red-mapper-seam.md:190` — *"Add the missing verdict arm:
> `{ kind: 'field_codec_ambiguous'; candidateIndex: number; …`"* — and adopted at
> `docs/build/ingestion-p2-adjudication.md:754` (C11): *"the codec vocabulary must gain the
> `field_codec_ambiguous` verdict or it requires a guess where G124 accepted a refusal."*
> **Use the recorded name.** ⚠️ And note the wider fact: **`ValueCodec`, `MapperVerdict` and the arm all
> exist only in `docs/build/`** — `grep -rn 'ValueCodec\|MapperVerdict' model/*.ts` → **0**. This ruling
> constrains a type nobody has written.

**The cost accepted.** **One more required field at source onboarding that refuses on absence** — the
O-8 posture again (G139) — and **a source genuinely mixing conventions cannot be mapped at all.** That
is the correct failure: a source that mixes date orders within one schema has no single convention to
declare, and a codec that guessed per-row would be inferring exactly what this ruling forbids.

**What it makes necessary.** Two date-order codec members with real decoders (the adjudication's own
constraint at `:902` binds here: *"A codec member with no decoder must not ship"*), a declared order on
the source, and the `field_codec_ambiguous` arm. ⚠️ **The declaration is O-8 configuration**, so it
inherits `IdentifierNormalisation.maxInputChars`'s polarity (`model/reconciliation.ts:381-386`): never
silently defaulted.

---

### 3.16 O-17 — the structural fingerprint is ORDER-SENSITIVE for tabular and ORDER-INSENSITIVE for PDF anchors

> 🛑 **RULED BY THE ADJUDICATING SESSION, NOT BY THE PRODUCT OWNER, AND IT IS RECORDED AS SUCH.**
> Every other ruling in §3 is the owner's. This one is not, and **it is flagged as available for the
> owner to overturn.** The distinction matters because `docs/HANDOFF.md` §3 rows are decisions and this
> is a derivation; a reader must be able to tell which they are relying on.

**The question.** Is the structural fingerprint of G142/T-3 order-sensitive?

**RULED. ORDER-SENSITIVE for tabular sources; ORDER-INSENSITIVE for PDF text anchors.**

**Two computations for one concept, which normally would be `docs/HANDOFF.md` §5.3 — so the
justification has to carry the weight, and it is that the SELECTION mechanism differs.**

- **Tabular selection is POSITIONAL** — the mapper returns *an index into the observed key set*, which
  is the containment design's whole shape (`docs/build/ingestion-pipeline.md:169-172`: the profile is
  *"bounded character-class enum indices plus lengths"*, and `ReaderCandidate.index`
  (`model/reconciliation.ts:2189`) is the same trick already in the tree). **So an order-insensitive
  hash would let a REORDERED file match a promoted mapping and silently map the wrong columns —
  including the amount column.** That is money moved on a column swap.
- **PDF anchor extraction order varies between runs**, so order-sensitivity there would **churn a new
  fingerprint and a fresh nomination on every file** — which destroys T-3's entire purpose (G142's
  stated cost is already that a cosmetic template change forces a re-nomination; per-run churn makes
  every file cosmetic). **And anchor-keyed selection does not need order**, because nothing indexes
  into an anchor list.

✅ **Consistent with C13's drift refusal**, which already refuses on a reorder for tabular — G136's row
records the open question directly (`docs/build/ingestion-pipeline.md:935`): *"What goes INTO the hash —
order, case, whitespace — is not settled, and C13's refusal is 'exactly equal', so if the hash
normalises anything the refusal is weaker than it reads."* **This ruling answers the order half of that
question and leaves case and whitespace open.**

**The cost accepted.** Two hash computations to implement, test and keep in step, and a rule that a
reader must know the rung to predict the behaviour. **Mitigation, and it is a requirement rather than a
suggestion:** the order-sensitivity must be a property of the **declared rung**, not of the call site —
otherwise the two computations are two conventions and §5.3 arrives after all.

**What it makes necessary.** A rung-keyed fingerprint function, and a test per rung. ⚠️ **T-3's
constraint (b) still binds both** (`docs/build/ingestion-pipeline.md:896-900`): the anchors are
counterparty-controlled text, so **only the hash may travel.**

---

### 3.17 O-11 — `UsageRecord` GAINS `arrivalId`, nullable, set only where an arrival caused the usage

**The question.** Does `UsageRecord` gain `arrivalId`?
(`docs/build/ingestion-p2-adjudication.md:895`.)

**RULED. YES — `arrivalId`, nullable**, set only where an arrival caused the usage.

**Why, and it is a measurement obligation rather than a nicety.** This is the instrument that makes
the cascade's saving **DERIVABLE instead of asserted** — which is what **A8 leaves owing**. A8
(`docs/build/ingestion-pipeline.md:380`) refused the `70–90%` claim, verbatim:

> *"🛑 **AGAINST THE OWNER:** … **"70–90%" must not be quoted anywhere.** Its denominator silently
> includes CSVs and API payloads that were never Textract candidates; against the only intake this
> record describes — warehouse dockets, handwritten, scanned to SharePoint — the cascade saves
> approximately nothing, because every one of those is a flat scan that reaches tier 4 anyway."*

`docs/build/ingestion-pipeline.md:512` adds that **no figure in the proposal was fetched at all.** The
honest replacement for a refused vendor figure is **our own measurement** — and that is **impossible
while per-arrival paid-tier cost is unattributable.** ✅ **`grep -rn 'arrivalId' model/*.ts` → 0**: the
field does not exist, so the question *"which arrivals did we spend the paid-tier bill on"* has no
answer today.

**Nullable because most usage has no arrival behind it.** ✅ **Invariant 5 is untouched** — copy it,
never paraphrase it: *"Money is always derived. `UsageRecord` is immutable and unpriced."* An
attribution key is neither a price nor a mutation.

**⚠️ THE COST ACCEPTED, AND IT NEEDS CHECKING BEFORE THE FIELD LANDS.** It **joins the metering stream
to a document**, and `UsageRecord` (`model/billing.ts:122`) is **the one record class that crosses the
plane boundary** — the adjudication states the precondition that follows (`:895`): *"the arrival slug
must be opaque, minted from the content hash and a counter, never from `filename`."* And metering is
partner-visible: G87 (`docs/HANDOFF.md:954`) rules *"Partners read AGGREGATES, never raw rows"* and adds
`view_commercial` **only**, *"and never `view_metering`, `view_audit` or `view_access_log`"*. **So on
G87's own terms a partner cannot reach a raw `UsageRecord` at all** — which is the answer, and it is an
answer that depends on a mask staying as it is.

**🛑 VERIFY AGAINST `PARTNER_CAPABILITY_MASK` AND RECORD THE RESULT.** The constant is at
`model/access.ts:950`, and G87 records it as *"an allow-list and this is the first addition to it."*
✅ **Verified at the tree, and stated as the current fact rather than as a guarantee:** the mask is an
allow-list, so a capability absent from it is unreachable by a partner by default, and
`model/access.ts:284`, `:420` and `:487` each carry an explicit *"THIS CAPABILITY APPEARS IN NO
`PARTNER_CAPABILITY_MASK` SCOPE, EVER"* for capabilities that must never enter it. **`view_metering`
carries no such sentence.** So the protection for this field is G87's prose plus the mask's current
contents, **not a named negative control on the capability itself** — and that is the gap this ruling
should close: **add the EVER sentence to `view_metering`, in the same commit as `arrivalId`.**

**What it makes necessary.** The field, an opaque arrival slug, and the mask sentence. ⚠️ **The wire
mirror will not catch a drift here** — the five pinned pairs (`tools/check-wire-mirror.mjs:72`) include
`meters` but no `UsageRecord` shape pair.

---

### 3.18 O-16 — a run may report INCOMPLETE as an outcome DISTINCT from inconsistent

**The question.** May a `PostconditionFailure` mean *"incomplete"* as well as *"unsound"*?
(`docs/build/ingestion-pipeline.md:597`.)

**The premise, verified, and it is the same hole §3.6 found from the other side.** ✅ **Every
post-condition is an internal-consistency check over the ADMITTED set, and none compares that set
against the outside world.** `checkPostconditions()` (`model/reconciliation.ts:2681`) iterates
`state.items.values()` (`:2702`) and every one of `PostconditionFailure`'s five arms (`:2640-2646`) is a
count or a comparison **within** that map. **So the engine can say *"what I was given balances"* and can
never say *"I was given everything"* — which is how a partial load reports a clean close.** The
control-total check and O-15's empty-population refusal (§3.6) both **produce completeness facts with
nowhere to go.**

**RULED. A run may report INCOMPLETE as an outcome DISTINCT from inconsistent.**

The distinction is load-bearing: *inconsistent* means the ledger we produced is unsound and must not be
persisted — `SetReconciliationResult.postconditions`' own comment
(`model/reconciliation.ts:2661`): *"Non-empty means the run produced an unsound ledger. Do not persist
it."* *Incomplete* means the ledger is sound **over less than everything**, which is a different act for
a different person. Collapsing them would either discard a sound partial result or persist an unsound
one.

**The cost accepted.** **Every consumer of a run's status gains a third case, and the contracts' run
status enum changes.** ✅ Today `ReconciliationRun.status` is **four states** —
`status: 'queued' | 'running' | 'completed' | 'failed'` (`model/domain.ts:2717`) — and *incomplete* is
neither `completed` nor `failed`, which is precisely why it needs its own state rather than a flag on
`completed`.

**🛑 THE SEQUENCING CONSEQUENCE, AND IT MUST BE STATED BECAUSE THE CHECKER'S SILENCE WILL LOOK LIKE
SAFETY.** ✅ **The wire-mirror pair for run status is NOT among the checker's five pinned pairs.**
`tools/check-wire-mirror.mjs:72-104` pins exactly `subject_location`, `live_policy_kind`,
`service_notice_kinds`, `meters` and `retention_classes` (`grep -c "name: '" tools/check-wire-mirror.mjs`
→ **5**). **So this enum must be PINNED BEFORE the third state ships**, or the model and the wire drift
silently and `npm run check` stays green throughout.

> ⚠️ **A PREMISE CORRECTION.** This was handed over as *"the same G75 shape already recorded for
> `policy_subject`"*. **G75 is the `secret`-into-`PERMITTED_RESOURCES.delivery` ruling** and has nothing
> to do with the wire mirror. **The `policy_subject` finding is real and is recorded elsewhere** —
> `docs/HANDOFF.md:2201-2206`: *"🛑 **WHAT IS STILL OWED, AND IT IS NOW THE LIVE FINDING — the checker
> pins FIVE pairs and `policy_subject` is not among them.** … Model `PolicySubject` discriminates on
> **`type`** (`model/policy.ts:890`) while the wire uses **`kind`**."* **The precedent is right; the
> attribution is not.** Cite `docs/HANDOFF.md:2201` and not G75.

**What it makes necessary.** A third outcome in the model, a new wire pair in the checker **added
first**, and a decision about what `ReconciliationRun.status` becomes. ⚠️ **Whether this belongs on
`status` or beside `postconditions` is NOT decided here** — the two carry different meanings (one is the
run's lifecycle, one is the ledger's soundness) and conflating them is how the hole got here.

---

### 3.19 O-12 — a subject ACCESS request over an UNREADABLE arrival discloses EXISTENCE, never content

**The question.** What does a data subject's access request return over an arrival that is
**unreadable** under G106 — stored, but with no `FieldSpec`, therefore unaddressable?

**RULED. Existence, never content.** The response **may** name the source, the receipt date and the
**unread state**; the artefact **may be erased on request**; and **no classified read happens anywhere.**

**✅ G106 is untouched, and that is the point rather than a caveat.** Copy invariant 4, never paraphrase
it: *"Classification is declared once, on `FieldSpec`, and everything derives from it"* — with G106
ruling that *"a key with no `FieldSpec` is UNREADABLE … stored, but unaddressable by any agent, prompt,
export or dashboard. Fail-closed, matching `DENY_ALL`"* (`CLAUDE.md` invariant 4;
`docs/HANDOFF.md:973`). **Existence metadata is not an `ExtractedValue`** (`model/domain.ts:1829`) —
which is **the same distinction R1 already draws** between the NAME of a slot and the VALUE of a field,
stated verbatim at `docs/build/ingestion-pipeline.md:145-147`:

> *"An unmapped key's NAME, POSITION and locally-derived SHAPE are readable. Its VALUE is not, and no
> authorisation makes it so for this purpose. A column header is the name of a slot, not an
> `ExtractedValue`."*

**The cost accepted.** **The person is told we hold something we cannot describe** — truthful, and
unsatisfying. There is no way to make that answer better without reading the thing, which is the
refusal.

**⚖️ THE OBLIGATION ITSELF REMAINS COUNSEL'S, AND THIS RULING MUST NOT BE WRITTEN AS DISCHARGING IT.**
S-15 is open and counsel-adjacent (`docs/build/stateless-adjudication.md:1189`): *"does unsubmitted work
fall inside PDPA access and correction, not only erasure?"* **This ruling decides what our answer
CONTAINS if the obligation applies. It does not decide that it applies.** A reader who cites this as
legal cover has misread it.

**🛑 Two rejected alternatives, both preserved.**

1. **Classify-on-demand** — classify the arrival in order to answer the request. **Refused: it creates
   the read path G106 exists to refuse, with a trigger originating OUTSIDE the tenant.** A control that
   an external party can cause to open is not fail-closed.
2. **Treating unreadable as undisclosable** — answer that we hold nothing. **Refused: we would hold a
   person's data and tell them we did not.** That is not a conservative reading of a privacy
   obligation; it is a false statement.

**What it makes necessary.** An existence-only response shape that carries no `ExtractedValue`, and an
erasure path over the artefact. ⚠️ **The response type must be provably content-free**, and the tree
already has the mechanism: `AssertNoTextDeep` (`model/reconciliation.ts:258`) — **under §2(iii)'s
inversion** (G146), which is why that inversion is sequenced first.

---

### 3.20 O-9 — the ingestion residue renders IN THE SAME LIST as everything else

**The question.** Where does the ingestion residue appear? Recorded as the first of the undesigned
three (`docs/build/ingestion-pipeline.md:495-497`): *"There is no type for an artefact that arrived, was
stored, was billed, and never became a `SourceDocument`."*

**RULED. In the SAME LIST as everything else, carrying a state and its refusal reason.**

**Why: one place to look.** ✅ **The claim is in the tree and it is a structural claim rather than a
preference** — `model/domain.ts:1762` reads *"as everything else, so capture never becomes a second
inbox"*, and G38's own row (`docs/HANDOFF.md:824`) names it: *"Unblocks `Close.dc.html` band D, **the
pack's single structural claim that capture never becomes a second inbox**."*
`model/examples.ts:944` states the failure mode: *"threshold is what turns capture into a second inbox
— the failure…"*.

> ⚠️ **A PREMISE CORRECTION, small but worth making.** This was handed over as *"one place to look,
> which is what G38 demands"*. **G38's decision is the confidence floor shipping in a pack template,
> rendered read-only** — not a rule about lists. What G38 carries is the **consequence** quoted above:
> the pack's single structural claim that capture never becomes a second inbox. **The claim is real and
> G38 is the right row to cite for it; G38 does not "demand" the list.** Cite it as G38's structural
> claim, not as G38's rule.

**🛑 REJECTED: a dedicated quarantine screen.** Refused on two grounds and the reasoning is preserved:
it is **a second inbox by construction** — the precise thing the claim above refuses — and **it works
only while somebody remembers to open it.** A surface whose correctness depends on being remembered is
not a control.

**The cost accepted.** **The list's items stop being homogeneous**, so **every filter, sort and count on
that surface must mean something for a thing that is not a document.** That is real work spread across
a screen rather than concentrated in a type, and it is the price of not building the second inbox.

**⚠️ AND THE BLOCKER THIS LEAVES, RECORDED RATHER THAN IMPLIED.** ✅ The close screen's **Coverage
figure is ILLUSTRATIVE** — `Mockups/rec/Close.dc.html:196` is literally
`{ label: 'Coverage', value: '99.2%', tone: INK }` — and **its denominator would have to be ARRIVALS**,
a number **nothing in `model/` can compute until the arrival ledger exists.**
`docs/build/ingestion-p2-green-residue.md:84` records the same finding independently: the figure
*"**nothing in `model/` can**"* compute. **🛑 NO DOCUMENT MAY PRESENT THAT FIGURE AS COMPUTABLE TODAY**,
and `PRODUCT.md` already forbids presenting in-product figures as customer results: *"NEVER — present
in-product figures as customer results. The data is illustrative."*

**What it makes necessary.** A residue type with a state and a refusal reason; the arrival ledger; and a
per-column decision on the shared list surface. **It BLOCKS** the Coverage figure becoming real, which
**blocks** any claim about coverage at all.

---

> ## §3.21–§3.24 — THE FINAL BATCH, AND IT CLOSES THE RULING SET FOR THIS SESSION
>
> Eleven more, taken after §3.13–§3.20. **Three were walked through individually and are §3.21–§3.23.
> Eight were taken on the written recommendation in ONE act, and are §3.24 — recorded as a group,
> with that fact stated, because the depth of consideration each received is itself something a later
> reader needs.** They take **G156–G166** (§4.4 and §4.5).

---

### 3.21 S-22 — an open draft carries an ABSOLUTE CAP FROM CREATION, alongside idle expiry. TWO independent clocks

**The question.** *"What is the absolute maximum age of an open draft, independent of idle expiry?"*
(`docs/build/stateless-adjudication.md:1196`.)

**RULED. Two independent clocks. Both FDE-set configuration refusing on absence, per the O-8 posture
(G139). And touching the draft CANNOT extend the cap.**

**Why, and the mechanism is the argument.** `purgeAfter` recomputed from a last-touched timestamp means
**an actively-touched draft NEVER expires** — which makes the retention class **decorative** and
destroys the PDPA argument that justified creating it. *"I'll come back to it"* is not a lawful basis
for holding personal data indefinitely. ✅ The tree's own precedent for the polarity:
`SourceDocument.purgeAfter` is *"computed AT INGEST from this policy"* (`model/domain.ts:1065`,
field at `:1861`) — **at ingest, not at touch** — because, as `model/domain.ts:2994` records, read-time
resolution would let a later edit move an already-fixed window.

**⚠️ The design's author had FORECLOSED an absolute cap as §5.3, the red disputed that, and THE RED IS
UPHELD.** This is already adjudicated and the owner's ruling confirms it. RULED 26
(`docs/build/stateless-adjudication.md:664-671`), verbatim:

> *"Recomputing `purgeAfter` from `lastHeldAt` makes the retention window unreachable for any client
> with a heartbeat autosave, which reintroduces through the back door the unbounded window the
> fourteenth retention class was minted to avoid — green's own PDPA Retention Limitation argument.
> Green then forecloses the fix by calling a second bound **"two answers to one question — §5.3"**.
> **They are two different questions: idle expiry and absolute lifetime.** **RULED:**
> `purge_after = least(held_at + maxOpenDraftAgeDays, last_held_at + days.held_edit)` — two numbers,
> two questions, one column. **Both numbers are the owner's or counsel's and neither is invented
> here.**"*

**Two clocks measuring two different things is not two vocabularies for one concept.** That distinction
is the whole of why `docs/HANDOFF.md` §5.3 does not apply, and it is worth stating explicitly because
§5.3 is the most-cited shape in this record and is therefore the easiest to over-apply.

**🛑 NO NUMBER IS STATED ANYWHERE.** `PRODUCT.md` forbids inventing one, and RULED 26 says both numbers
are the owner's or counsel's. **The absolute cap is the owner's; the idle window is entangled with
S-15, which is counsel's** (`docs/build/stateless-adjudication.md:1189`).

**The cost accepted.** **A genuinely long-running investigation loses its draft at the ceiling.** So
two obligations follow rather than one: **the operator must be warned well before the ceiling**, and
**the work must be promotable into something durable that is not a draft.** Without the second, the cap
is a data-loss feature; with it, the cap is a retention control and the durable object is where long
work belongs anyway.

**What it makes necessary.** Two configured numbers, both refusing on absence; the `least(…)` column
RULED 26 specifies; a warning surface; and a promotion target. ⚠️ **The promotion target is S-12, which
is OPEN** — *"Is the confirmed-field act in v1? If no, do not declare the arm at all — a draft with no
promotion path is a promise the product cannot keep"* (`:1186`). **So this ruling's second obligation
depends on an open ruling, and that dependency must be carried rather than discovered.**

---

### 3.22 O-19 — `ProposalActor`'s agent arm gains a nullable `stepId` plus a NAMED, CLOSED occasion

**The question.** How is an agent-authored mapping proposal recorded?

**The premise, verified, and it is an unconstructible-type finding rather than a modelling preference.**
✅ `ProposalActor`'s agent arm **requires** `stepId: ProcedureStepId` — `model/domain.ts:3375`, inside
the union declared at `:3371`. **Source onboarding has no procedure and no exception**, so there is no
`ProcedureStepId` to supply and **an agent-authored mapping proposal is literally unconstructible.**
Which means **R2's proposer ≠ promoter safeguard is UNRECORDABLE for the case it was written for** —
R2 is *"nominate, then promote"* (`docs/build/ingestion-pipeline.md:174`), and the whole point of the
split is that the nominator and the promoter are different actors.

**RULED. A nullable `stepId`, plus a NAMED, CLOSED occasion.** The occasion is **a closed union, never a
free string**, so **the set of places an agent may propose stays enumerable.** That is the same
discipline `erasableSyntaxOnly` forces everywhere here — a const object plus a union type, per
`CLAUDE.md` — and the same reason `EXTRACTION_OP_KINDS` and `TOOL_EFFECT` are closed rather than open.

**The cost accepted.** It touches **`model/domain.ts`, the most contended file** — `CLAUDE.md` requires
a plan before touching it — and **every existing reader of the agent arm must handle the new case.**
✅ **Which the compiler names, so the change cannot be half-applied**: narrowing on
`kind: 'agent'` with `stepId` nullable makes every unconditional use of `stepId` an error under
`strict`. ⚠️ **But note the standing limit:** `CLAUDE.md` records that a total `Record` only bites
where something constructs one and that **nothing in `model/` constructs most of these types**
(§5.10) — so the compiler catches *readers*, and only a fixture witnesses that the occasion set is
right.

**🛑 Two rejected alternatives, both preserved with their reasoning.**

1. **Modelling onboarding as a `Procedure`** so a `stepId` exists. **Refused as FAR LARGER than the
   field:** it makes every onboarding a run-like object with its own execution records, versioning and
   audit surface. A type-shaped problem answered with a new entity class is how a nullable field becomes
   a subsystem.
2. **Recording the FDE as proposer of record.** **Refused because the trail could then not distinguish
   a mapping a human REASONED OUT from one a model GENERATED and a human CLICKED.** ✅ **G125's argument
   is exactly this** and it is why the refusal is principled rather than fastidious: an audit trail
   which is **technically complete and practically misleading is worse than a missing one**, because a
   missing record is visibly missing.

**⚠️ THIS IS THE SAME HOLE THE READER SEAM HAS ONE ACT EARLIER, AND IT MUST BE RECORDED AS ONE DEFECT
AND NOT TWO.** S-18 (§3.7) found that **no capability names the reader act**, so the act cannot be
authorised; O-19 finds that **no `ProposalActor` shape fits the mapping proposal**, so the act cannot be
attributed. **Both are the same shape: a new act on a surface whose actor and authority vocabularies
were built for the surfaces that existed.** Recording them separately invites two separate one-off
fixes; recording them as one defect invites the question *"what else does an ingestion act need that
`model/` has only for reconciliation acts?"* — which is the question that finds the third instance.

**What it makes necessary.** The nullable field, the closed occasion union, and a fixture that
constructs the agent arm on the onboarding occasion. **BLOCKS** R2's safeguard being recordable at all.

---

### 3.23 O-10 — a QUARANTINED artefact gets its OWN retention window, shorter than a document's

**The question.** How long is a quarantined artefact retained?

**RULED. Its own retention window, SHORTER than a document's.**

**Why. It is EVIDENCE OF A FAILURE, not a business record — and the record's own rule is that record
KIND determines retention.** ✅ **Verbatim in the tree, `model/domain.ts:1051`:**

> *"Retention — keyed by RECORD KIND, never by storage tier"*

and the taxonomy that implements it: `RETENTION_RECORD_KINDS` (`model/domain.ts:1117`) has five members
— `business`, `operational`, `derived`, `content`, `telemetry` — mapped by
`RETENTION_RECORD_KIND: Record<RetentionClass, RetentionRecordKind>` (`model/domain.ts:1135`), whose
docblock (`:1128`) reads *"Which kind each class is. TOTAL, so a fourteenth class must declare one."*
**A quarantined artefact and a `source_document` sit in the same storage tier and are not the same
kind of record**, which is precisely the confusion that line exists to forbid.

**The cost accepted, in two parts.**

**(a) A new retention class**, which **the total `RetentionPolicy` `Record` turns into a compile error at
every construction site** — `RetentionPolicy['days']` is `Record<RetentionClass, number>`
(`model/domain.ts:1179`), asserted total by `AssertAnswersEveryRetentionClass` (`:1197-1203`), and
`PLACEHOLDER_RETENTION_POLICY` (`model/examples.ts:534`) is the site that goes red. **The totality
forcing the decision rather than letting it slide** — and `RETENTION_RECORD_KIND` goes red in the same
commit, so the *kind* must be declared too, which is the ruling's own argument arriving as a compiler
error. ⚠️ **`RetentionClass` is also a pinned wire pair** — `retention_classes`
(`tools/check-wire-mirror.mjs:72-104`) — so `check:wire` goes red as well. **Three simultaneous
failures, which is why it must land in one commit.**

**(b) The window is a number that must be FDE-set and refuse on absence** — the O-8 posture again
(G139). 🛑 **No number is stated here**, per `PRODUCT.md`.

**🛑 Two rejected alternatives, both preserved.**

1. **Inheriting the document window.** **Refused because a possibly-malicious file would be retained
   for a business-records period under a classification nobody could compute** — **the fields were
   never classified, which is why it quarantined.** That is G106's unreadable state
   (`CLAUDE.md` invariant 4) used as a retention basis, which it cannot be: you cannot apply a
   business-record window to a record whose business meaning is unknown by construction.
2. **Purge-on-triage with no window.** **Refused because an unwatched queue then retains
   indefinitely**, putting the retention obligation on **somebody remembering to look** — the same
   ground O-9 (§3.20) rejects the quarantine screen on, arriving a second time.

**What it makes necessary.** The class, its kind, its window, the wire enum, and a fixture. ⚠️ **It
collides with O-20's own fourteenth class** — `docs/build/ingestion-p2-adjudication.md:516` already
allocates *"a fourteenth `RetentionClass` (`document_capture`, kind `content`)"* for
`DocumentCapture`. **So one of these two is the fourteenth and the other is the fifteenth, and whoever
lands first must say which.** Neither document knows about the other; this line is the only place the
collision is recorded.

---

### 3.24 EIGHT TAKEN ON THE WRITTEN RECOMMENDATION, IN ONE ACT

> 🛑 **RECORDED AS A GROUP, AND THE GROUPING IS THE INFORMATION.** These eight were **ruled on the
> written recommendation without a separate walkthrough** — one act, eight answers. **Every one of them
> takes the recommendation as written**, from the table at
> `docs/build/stateless-adjudication.md:1173-1197`. **A later reader must know this**: each of these
> received the consideration of *"the recommendation is sound"*, not the consideration §3.1–§3.23
> record. **That is not a criticism of the decision — it is a fact about its depth, and a decision
> whose depth is undocumented is a decision nobody can revisit proportionately.**
>
> **Where a row below quotes, the quote is from that table and is verbatim.** The Cost column here is
> **what was accepted**, which is the part a ruling recorded without it cannot be revisited on.

| | Decision | The cost accepted | The rejected alternative |
|---|---|---|---|
| **S-1** | **G99's negative control gains a SECOND NAMED HELPER** for the pre-tenant session read (`:1175`) | The named negative control acquires a member, so *"no query outside `withTenantScope()`"* becomes *"no query outside these two"* — **weaker as a sentence, and it must stay a CLOSED list.** The adjudication's own warning: *"The negative control has two members and somebody will propose a third"* | A **nullable tenant** on the existing helper. 🛑 Either way the standing instruction holds verbatim: *"**do not add `query` to `TenantPool`**"* — a general escape hatch defeats both options at once |
| **S-2** | **The session RLS predicate keys on the handle DIGEST in a GUC** (`app.session_ref`), not a row id via `SECURITY DEFINER` (`:1176`) | **A digest travels in a session variable** on every request. Accepted because the alternative is worse, not because this is free | A **row id via a `SECURITY DEFINER` lookup**. Refused on the adjudication's ground — *"it needs no privileged function; a `SECURITY DEFINER` lookup becomes the most security-relevant object in the schema"* — and **a `SECURITY DEFINER` is a standing widening**, plus *"its own two-row negative test"* |
| **S-5** | **"Sign me out everywhere" is NOT v1** (`:1179`) | **No session enumeration exists in the request plane**, so **a compromised credential is contained per-session until expiry.** Incident response cannot list live sessions | Building enumeration in v1. The adjudication records the fallback lever rather than leaving the gap unowned: *"the lever is `User.status`"* |
| **S-9** | **`model/execution.ts` and `model/held-work.ts` are NEW MODULES**, not more of `model/domain.ts` (`:1183`) | ⚠️ **The governed module count moves and every count in the record goes STALE the day they land — say so, because `node tools/check-doc-counts.mjs` will report it and a reader must know it is expected.** The adjudication's own framing: *"That is the tool working"* | Putting the types in `model/domain.ts`. Refused on the recommendation's reasoning: *"`ReconciliationRun` is on the wire and is the business record; a lease is neither, and a held draft is neither"* — plus `CLAUDE.md`'s plan-first requirement on `domain.ts` |
| **S-10** | **An O(tenants) REGISTRY SWEEP**, not a lease table outside RLS (`:1184`) | **The sweep's cost grows with tenant count** — *"O(tenants) per sweep in the hosted topology"* — and ⚠️ *"**fairness and starvation are unaddressed and no fairness rule is invented**"* | **A lease table outside RLS.** Refused on **G103**, *"which refused a table outside RLS on the ground that four invariants are enforced by the store"* — the alternative would have put a table outside the isolation boundary |
| **S-13** | **NO audit row per individual hold** (`:1187`) | **Individual autosaves are not independently attributable** — the adjudication states it plainly: *"a write of personal data with a capability check and no record"* | A row per hold. **The fallback if this proves unacceptable is a COARSER record, not a finer one** — *"one row per draft lifetime"* — which is the same grain S-11 (§3.9) rules for metering, and the two must agree |
| **S-14** | **The D6 threat-model gate lands BEFORE the first unauthenticated endpoint** (`:1188`) | **It blocks shipping a public surface until the threat model exists** — the intended failure. *"Delays the session wire by whatever D6 costs"* | Shipping first. Refused because **this would be the first unauthenticated public endpoint** in the system, so there is no precedent to lean on and no second chance to set the posture |
| **S-17** | **The outcome table's PRIMARY KEY IS the content key**; `requestOrdinal` becomes a labelled column (`:1191`) | **It makes the content addressing STRUCTURAL rather than conventional** — §1.1(c) enforced by the schema instead of by discipline. 🛑 **Irreversible from the first stored verdict either way.** And **G111's money codec must land FIRST, because `canonicalise()` refuses `bigint`** (`model/canonical.ts:66-71`) | **`requestOrdinal` as PK with a unique index on the content key.** Its merit is preserved: it *"keeps `requestOrdinal`'s ordering cheap in the queue index"* |

---

## 4. DRAFT G ROWS — G132 to G166

> 🛑 **THESE ARE DRAFTS. NOBODY MAY COPY ONE INTO `docs/HANDOFF.md` WITHOUT THE PRODUCT OWNER PLACING
> IT.** A G number is an **identity**, and two documents minting the same number is worse than a gap
> because a gap is visible and a collision is not — §1 exists because that happened.
>
> **The next free number was DERIVED:** `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md` → **131** rows, and
> `grep -oE '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -oE '[0-9]+' | sort -n | tail -1` → **131**. Rows
> equal maximum, so there are no gaps and the next free number is **G132**. ⚠️ **Re-derive before
> placing; `tools/check-doc-counts.mjs` does not govern this count.**
>
> **The four columns are `docs/HANDOFF.md` §3's own: number · Decision · Consequence · State.**
> Every row's State is `not applied`, because not one of them is.
>
> 🛑 **The twelve rulings in §3 have NO rows here.** They need **G148** onward. §1 allocated sixteen
> numbers and this section places sixteen rows; minting more would be the §1 defect repeating.

### 4.1 G132–G142 — the ingestion set (O-1…O-8, T-1…T-3)

✅ **These eleven rows are already drafted in full at `docs/build/ingestion-pipeline.md:929-942`,
contiguous and in this exact order, and §1 ratifies that numbering unchanged.** They are **not
restated here**: a second copy of a G row's text is a second thing to keep in step, and
`docs/HANDOFF.md` §5.3 is the shape. **Take the text from that table.**

| | Decision (short form — full text at `docs/build/ingestion-pipeline.md:929-942`) | Consequence, in one line | State |
|---|---|---|---|
| G132 | **A Postgres work queue (`FOR UPDATE SKIP LOCKED`) for the ingestion data path; EventBridge for the arrival trigger only** (O-1) | The shred and the enqueue must share one transaction and SQS cannot. First narrowing of *"no broker in the data plane"*; settles the **ingestion path only** | not applied |
| G133 | **Both ceilings must pass for a page image handed to a multimodal model** (O-2) | `maxDataClassToService` **and** `maxDataClassInPrompt`; neither has a reader, so both need writing | not applied |
| G134 | **The document-level ceiling is the maximum `dataClass` across the `DocumentType`'s fields; a `DocumentType` declaring no fields crosses no managed-service boundary** (O-3) | Fail-closed, matching `DENY_ALL` and G100. First onboarding of an unknown type cannot use tier 4 | not applied |
| G135 | **No real cell values reach the mapper in v1** (O-4) | Refused on **invariant 6**, not G106. Headerless files go to the FDE by hand — the cost G124 accepted | not applied |
| G136 | **A mapping is pinned to `(sourceEndpointId, headerSetHash)`** (O-5) | Restates the economy: one inference per distinct **schema** per source, not per source | not applied |
| G137 | **`pdfjs-dist`, pinned exact; PyMuPDF is out** (O-6) | Two independent grounds. **This document asserts no licence.** Standing verification on `@napi-rs/canvas`, not done | not applied |
| G138 | **G85 is not reopened for v1** (O-7) | Reopen only with a measured, priced Mandarin docket run — the discipline G53 got | not applied |
| G139 | **Every `IngestBound`, C6 threshold and C13 floor is FDE-set pack configuration, refusing on absence** (O-8) | The `confidenceFloor` posture. An unset bound refuses the run. No figure invented, per `PRODUCT.md` | not applied |
| G140 | **Outbox rows are written in chunked batches inside the same single transaction; runtime `CREATE INDEX` is not available and must not be planned for** (T-1) | The DDL half is refused on G100 — the data-plane role has no CREATE. Resolve at migration time | not applied |
| G141 | **A column's shape reaches the mapper as a closed, platform-authored shape token chosen by index — never as a pattern string** (T-2) | Refused **on the containment proof, not on G124**; recording it as a G124 refusal mis-applies G124 next time | not applied |
| G142 | **`headerSetHash` generalises to `structuralFingerprintHash`; for a digital PDF it is computed from the sorted, normalised page-one text anchors** (T-3) | Reuses the closed `IdentifierNormalisation` op vocabulary; **only the hash may travel** | not applied |

### 4.2 G143–G147 — the statelessness set, RENUMBERED from `docs/build/stateless-adjudication.md` §9

🛑 **These five supersede that document's drafted `G132`–`G136`.** Same order, same text, new numbers.
**Full text at `docs/build/stateless-adjudication.md:1217-1221`** — again not duplicated here.

| | Decision (short form — full text at `docs/build/stateless-adjudication.md:1217-1221`) | Consequence, in one line | State |
|---|---|---|---|
| G143 *(was draft G132)* | **The application is stateless in the OPERATIONAL form: no node-local state another node or a retry cannot reconstruct from durable storage** | Reconstructible defined in three required parts — durable anchor · pure total rebuild · **countable repeat over a CONTENT key**. Ratifies G116 and G103. Costs the tree almost nothing today; costs the session read any amortisation, permanently | not applied |
| G144 *(was draft G133)* | **S-8: the operational reading governs, so G120's distributed map SURVIVES** | Resolves a live conflict — two green designs applied opposite readings. Keeps G107 intact. 🛑 The in-Postgres reader queue is **no longer required by the ruling** and must stand on the transaction argument alone | not applied |
| G145 *(was draft G134)* | **S-6: partition the chains NOW — one chain per `(tenant, stream, partition)`, with the partition named in `ChainAnchor`** | Removes a per-tenant audit-write throughput ceiling that is a **request-concurrency** ceiling under G101. 🛑 **IRREVERSIBLE; the window closes at the first chain row.** `ChainAnchor` (`model/governance.ts:1138`) gains a field; verification becomes per-partition | not applied |
| G146 *(was draft G135)* | **The containment proof inverts to an allow-list of value-free leaves — its own commit, verified RED** | `NoTextField<T>` bans the **type** `string` at a property position (`model/reconciliation.ts:248-258`), so it is a deny-list of one shape read as a containment guarantee. 🛑 **Sequenced before any new containment assertion** | not applied |
| G147 *(was draft G136)* | **G120's replay key becomes content-addressed, and G111's money codec is sequenced BEFORE the reader executor** | `(tenantId, subjectKey, candidateWitness)` identifies the verdict; `requestOrdinal` labels the act. Dissolves five frozen iteration orders. 🛑 `canonicalise()` refuses `bigint` (`model/canonical.ts:66-71`), so **no document may say the plan is hashed until the codec exists** | not applied |

⚠️ **`Money.amountMinor` is `number` today** (`model/domain.ts:535`), so G147's sequencing trap is
**latent, not active** — it fires the day G65 lands. A row that reads as satisfied today is a row that
will break silently.

### 4.3 G148–G155 — the eight later rulings (§3.13–§3.20)

🛑 **These take numbers OUTSIDE §1's two ranges because BOTH RANGES ARE FULLY SPENT** — sixteen numbers,
sixteen rows, zero spare. **Reusing a number to stay inside a range would be the collision §1 exists to
resolve.** Numbered in the order taken, **not grouped by track**; the Track column carries what the
numbering no longer does.

| | Track | Decision | Consequence | State |
|---|---|---|---|---|
| G148 | ingestion | **A PLATFORM PRINCIPAL MAY SUSPEND A MAPPING SHE PROMOTED. ONE PERSON SUSPENDS; TWO TO RE-PROMOTE** (O-22) | The asymmetry **is** the ruling: suspension NARROWS and bites immediately; restoring is a WIDENING and re-enters the two-person gate. **Not a new rule — `model/learning.ts:1176-1183` already argues it for learning** (*"Promotion WIDENS what the system does unattended; retraction NARROWS it … Requiring a second approver to STOP a learning would invert it, and would do so at the worst moment"*), and `docs/HANDOFF.md:611` row A is the rule. Needed because the only expressible acts were promote and let-it-expire, so **a mapping known to be wrong kept parsing files for as long as the correction took.** ✅ `RetractionMode = 'suspend' \| 'retract'` (`model/learning.ts:1222`) already exists — ⚠️ `@dropped-for-v1`, so this shares O-20's un-drop. Cost accepted: files arriving while suspended **refuse to the residue** — visible and unprocessed rather than parsed wrongly, **and still a stopped pipeline somebody must notice.** 🛑 **Rejected: automatic suspension on conformance failure** — an unattended authority change, and a noisy period of legitimate data could suspend a good mapping mid-close, which is the shape **G129** exists to prevent. ⚠️ Whether a mapping promotion reuses `promote_learning` (capability 37, G128) or needs its own is **not decided** | not applied |
| G149 | **cross-track** | **AN IN-PROCESS CACHE IS PERMITTED FOR VERSION-ADDRESSED CONTROL-PLANE ARTEFACTS, UNDER AN EXPLICIT ALLOW-LIST, AND ONLY WHERE NOTHING CAN REVOKE THE ARTEFACT** (S-16) | Keyed by version, so a new version is a new key. Already reconstructible under G143(a) and admitted by the worked test (`docs/build/stateless-adjudication.md:148`); **G89** supplies the addressability. 🛑 **THE RULING IS THE SECOND HALF: IMMUTABILITY DOES NOT COVER REVOCATION.** A revoked bundle is still version-addressed and would still be cached — **a stale AUTHORITY cache, a privilege escalation with a timer.** So the allow-list admits only artefacts with **no revocation semantics**; anything revocable is read every time. ⚠️ **G89's own enumeration includes `grant list`, which is exactly the revocable kind — do not derive the allow-list from it.** Cost accepted: **a list somebody must maintain honestly, and adding to it wrongly is silent.** 🛑 **Permits nothing about the session read**, which stays unamortisable — forbidden by this row, by **G116** (whose reason is `S2`, a module-level cache that leaked inferred structure across a tenant boundary), and by **G103** closing the third store; a signed token is refused by name at `model/access.ts:1536-1543` | not applied |
| G150 | ingestion | **THE `ValueCodec` CARRIES BOTH DATE ORDERS; WHICH ONE APPLIES IS DECLARED PER SOURCE** (O-18) | **`09/03/2026` parses under both orders**, so no shape profile can resolve it — **and C13's conformance floor would AGREE with the wrong guess, because it uses the same codec** (§5.6: a checker that passes while asserting nothing). ✅ **Record as REUSING C16 — *declared, never inferred* — applied to dates instead of currency**, not as a new ruling; the currency form is already executable at `model/reconciliation.ts:1004` and refuses `currency_disagrees_with_population` at `:1024-1026`. Ambiguity outside the declaration refuses to the FDE, which needs the arm the red pass specified: ⚠️ **`field_codec_ambiguous`** (`docs/build/ingestion-p2-red-mapper-seam.md:190`, adopted at `docs/build/ingestion-p2-adjudication.md:754`) — **NOT `cannot_determine`, which exists nowhere.** Cost accepted: one more required onboarding field refusing on absence (O-8 posture), and **a source genuinely mixing conventions cannot be mapped at all** — the correct failure. ⚠️ A codec member with no decoder must not ship | not applied |
| G151 | ingestion | 🛑 **THE STRUCTURAL FINGERPRINT IS ORDER-SENSITIVE FOR TABULAR AND ORDER-INSENSITIVE FOR PDF TEXT ANCHORS** (O-17) | 🛑 **RULED BY THE ADJUDICATING SESSION, NOT BY THE OWNER, AND FLAGGED AS AVAILABLE TO OVERTURN** — every other row here is the owner's. Two computations for one concept, which is normally §5.3, so the justification carries the weight: **the SELECTION MECHANISM DIFFERS.** Tabular selection is **positional** (an index into the observed key set), so an order-insensitive hash would let a **reordered file match a promoted mapping and silently map the wrong columns — including the amount column.** PDF anchor extraction order **varies between runs**, so order-sensitivity there churns a fresh nomination per file and destroys T-3's purpose, and anchor-keyed selection does not need order. ✅ Consistent with C13, and it answers the **order** half of G136's open question (`docs/build/ingestion-pipeline.md:935`) while leaving **case and whitespace open.** Cost accepted: two hashes to keep in step. **Mitigation required, not optional: the order-sensitivity is a property of the declared RUNG, never of the call site** | not applied |
| G152 | ingestion | **`UsageRecord` GAINS `arrivalId`, NULLABLE, SET ONLY WHERE AN ARRIVAL CAUSED THE USAGE** (O-11) | The instrument that makes the cascade's saving **DERIVABLE rather than asserted**, which is what **A8** leaves owing: A8 refused `70–90%` because *"its denominator silently includes CSVs and API payloads that were never Textract candidates"* (`docs/build/ingestion-pipeline.md:380`) and **no figure in the proposal was fetched at all** (`:512`). The honest replacement is our own measurement, impossible while per-arrival paid-tier cost is unattributable — ✅ `grep -rn 'arrivalId' model/*.ts` → **0**. ✅ **Invariant 5 untouched:** `UsageRecord` (`model/billing.ts:122`) stays immutable and unpriced; an attribution key is neither a price nor a mutation. 🛑 **Precondition absolute: the arrival slug must be OPAQUE**, minted from the content hash and a counter, never from `filename`. ⚠️ **Cost accepted and it needs checking BEFORE the field lands:** it joins the metering stream to a document on **the one record class that crosses the plane boundary** (invariant 3), and metering is partner-visible under **G87**. **VERIFY AGAINST `PARTNER_CAPABILITY_MASK` (`model/access.ts:950`) AND RECORD THE RESULT** — it is an allow-list, so absence protects by default, but **`view_metering` carries no *"appears in NO scope, EVER"* sentence where `model/access.ts:284`, `:420` and `:487` do. Add it in the same commit** | not applied |
| G153 | ingestion | **A RUN MAY REPORT INCOMPLETE AS AN OUTCOME DISTINCT FROM INCONSISTENT** (O-16) | ✅ **Every post-condition is an internal-consistency check over the ADMITTED set and none compares it against the outside world** — `checkPostconditions()` (`model/reconciliation.ts:2681`) iterates `state.items.values()` (`:2702`) and all five arms (`:2640-2646`) count within that map. **So the engine can say *"what I was given balances"* and never *"I was given everything"*, which is how a partial load reports a clean close.** *Inconsistent* means do-not-persist (`:2661`); *incomplete* means sound over less than everything — a different act for a different person. Cost accepted: **every consumer gains a third case and the contracts' run-status enum changes** — today `status: 'queued' \| 'running' \| 'completed' \| 'failed'` (`model/domain.ts:2717`), and *incomplete* is neither. 🛑 **SEQUENCING: the run-status wire pair is NOT among the checker's five pinned pairs** (`tools/check-wire-mirror.mjs:72-104`), **so it must be pinned BEFORE the third state ships** or model and wire drift while `npm run check` stays green. ⚠️ The precedent is `policy_subject`, recorded at **`docs/HANDOFF.md:2201`** — **not** at G75. Whether this lands on `status` or beside `postconditions` is **not decided** | not applied |
| G154 | ingestion | **A SUBJECT ACCESS REQUEST OVER AN UNREADABLE ARRIVAL DISCLOSES EXISTENCE, NEVER CONTENT** (O-12) | The response may name the source, the receipt date and the **unread state**; the artefact may be **erased** on request; **no classified read happens anywhere.** ✅ **G106 is untouched and that is the point:** existence metadata is not an `ExtractedValue` (`model/domain.ts:1829`) — the same distinction **R1** already draws (`docs/build/ingestion-pipeline.md:145-147`: *"An unmapped key's NAME, POSITION and locally-derived SHAPE are readable. Its VALUE is not … A column header is the name of a slot, not an `ExtractedValue`."*). Cost accepted: **the person is told we hold something we cannot describe** — truthful, unsatisfying, and unimprovable without the read that is refused. ⚖️ **THE OBLIGATION REMAINS COUNSEL'S (S-15) AND THIS ROW MUST NOT BE READ AS DISCHARGING IT** — it decides what the answer CONTAINS if the obligation applies, not that it applies. 🛑 **Rejected: classify-on-demand** — it creates the read path G106 refuses, **with a trigger originating outside the tenant.** 🛑 **Rejected: treating unreadable as undisclosable** — we would hold a person's data and tell them we did not | not applied |
| G155 | ingestion | **THE INGESTION RESIDUE RENDERS IN THE SAME LIST AS EVERYTHING ELSE, CARRYING A STATE AND ITS REFUSAL REASON** (O-9) | One place to look. ✅ The claim is structural and in the tree — `model/domain.ts:1762` (*"as everything else, so capture never becomes a second inbox"*) and **G38's** consequence column (`docs/HANDOFF.md:824`: *"the pack's single structural claim that capture never becomes a second inbox"*). ⚠️ **G38's DECISION is the confidence floor in a pack template; it does not "demand" the list — cite it for the claim, not for a rule.** 🛑 **Rejected: a dedicated quarantine screen** — **a second inbox by construction**, the precise thing the claim refuses, and **it works only while somebody remembers to open it.** Cost accepted: **the list's items stop being homogeneous, so every filter, sort and count must mean something for a thing that is not a document.** ⚠️ **Blocker this leaves:** the close screen's Coverage figure is ILLUSTRATIVE (`Mockups/rec/Close.dc.html:196` — `{ label: 'Coverage', value: '99.2%', tone: INK }`) and **its denominator would have to be ARRIVALS, which nothing in `model/` can compute until the arrival ledger exists.** **NO DOCUMENT MAY PRESENT IT AS COMPUTABLE TODAY** — `PRODUCT.md` already forbids presenting in-product figures as customer results | not applied |

### 4.4 G156–G158 — the three walked-through rulings of the final batch (§3.21–§3.23)

| | Track | Decision | Consequence | State |
|---|---|---|---|---|
| G156 | **cross-track** | **AN OPEN DRAFT CARRIES AN ABSOLUTE CAP FROM CREATION ALONGSIDE IDLE EXPIRY — TWO INDEPENDENT CLOCKS, AND TOUCHING THE DRAFT CANNOT EXTEND THE CAP** (S-22) | Both bounds are FDE-set configuration refusing on absence (O-8 posture, G139). **`purgeAfter` recomputed from a last-touched timestamp means an actively-touched draft NEVER expires**, making the retention class decorative and destroying the PDPA argument that justified minting it — *"I'll come back to it"* is not a lawful basis for holding personal data indefinitely. ✅ The tree's polarity: `SourceDocument.purgeAfter` is computed **at ingest** (`model/domain.ts:1065`, field `:1861`), never at read (`:2994`). ⚠️ **The design's author foreclosed the cap as §5.3 and the red disputed it; THE RED IS UPHELD** — RULED 26 (`docs/build/stateless-adjudication.md:664-671`): *"**They are two different questions: idle expiry and absolute lifetime.** RULED: `purge_after = least(held_at + maxOpenDraftAgeDays, last_held_at + days.held_edit)` — two numbers, two questions, one column."* **Two clocks measuring two different things is not two vocabularies for one concept.** 🛑 **No number is stated anywhere** (`PRODUCT.md`); the cap is the owner's, the idle window entangles S-15. Cost accepted: **a genuinely long-running investigation loses its draft at the ceiling**, so **the operator must be warned well before it AND the work must be promotable into something durable that is not a draft** — ⚠️ that target is **S-12, still OPEN** | not applied |
| G157 | ingestion | **`ProposalActor`'S AGENT ARM GAINS A NULLABLE `stepId` PLUS A NAMED, CLOSED OCCASION** (O-19) | ✅ **The agent arm requires `stepId: ProcedureStepId` (`model/domain.ts:3375`) and source onboarding has no procedure and no exception, so an agent-authored mapping proposal is LITERALLY UNCONSTRUCTIBLE** — which makes **R2's proposer ≠ promoter safeguard unrecordable for the case it was written for.** The occasion is a **closed union, never a free string**, so the set of places an agent may propose stays **enumerable**. Cost accepted: it touches **`model/domain.ts`, the most contended file** (`CLAUDE.md` requires a plan), and every existing reader of the agent arm must handle the new case — ✅ **which the compiler names, so the change cannot be half-applied**; ⚠️ but only a fixture witnesses that the occasion SET is right (§5.10). 🛑 **Rejected: modelling onboarding as a `Procedure`** so a `stepId` exists — **far larger than the field**: it makes every onboarding a run-like object with its own execution records, versioning and audit surface. 🛑 **Rejected: recording the FDE as proposer of record** — the trail could then **not distinguish a mapping a human REASONED OUT from one a model GENERATED and a human CLICKED**, and **G125**'s argument is that a trail which is technically complete and practically misleading is worse than a missing one. ⚠️ **SAME DEFECT AS S-18 ONE ACT EARLIER — record it as ONE, not two:** a new act on a surface whose actor and authority vocabularies were built for the surfaces that already existed | not applied |
| G158 | ingestion | **A QUARANTINED ARTEFACT GETS ITS OWN RETENTION WINDOW, SHORTER THAN A DOCUMENT'S** (O-10) | It is **evidence of a failure, not a business record**, and the record's own rule is verbatim in the tree — `model/domain.ts:1051`: *"Retention — keyed by RECORD KIND, never by storage tier."* Five kinds (`RETENTION_RECORD_KINDS`, `model/domain.ts:1117`) mapped totally by `RETENTION_RECORD_KIND` (`:1135`, docblock `:1128`: *"TOTAL, so a fourteenth class must declare one"*). **A quarantined artefact and a `source_document` share a storage tier and are not the same kind of record** — the exact confusion that line forbids. Cost accepted: **a new retention class, which the total `RetentionPolicy` `Record` (`model/domain.ts:1179`, asserted `:1197-1203`) turns into a compile error at `PLACEHOLDER_RETENTION_POLICY` (`model/examples.ts:534`)**, plus `RETENTION_RECORD_KIND` red in the same commit **and `check:wire` red on the pinned `retention_classes` pair** — **three simultaneous failures, so it lands in ONE commit.** The window is FDE-set and refuses on absence; 🛑 **no number stated.** 🛑 **Rejected: inheriting the document window** — a possibly-malicious file retained for a business-records period **under a classification nobody could compute, because the fields were never classified, which is why it quarantined.** 🛑 **Rejected: purge-on-triage with no window** — an unwatched queue retains indefinitely, putting the obligation on somebody remembering to look. ⚠️ **COLLIDES WITH O-20's OWN FOURTEENTH CLASS** (`docs/build/ingestion-p2-adjudication.md:516` allocates `document_capture`): one of the two is the fourteenth and the other the fifteenth, and **whoever lands first must say which.** This line is the only place that collision is recorded | not applied |

### 4.5 G159–G166 — the eight taken on the written recommendation (§3.24)

> 🛑 **Mark the group when placing it.** These eight were **ruled on the written recommendation in one
> act, without a separate walkthrough** — the fact belongs in the rows, because a decision whose depth
> is undocumented cannot be revisited proportionately. **All eight are cross-track (session, queue and
> held-work surfaces).** Full reasoning and every rejected alternative: `docs/build/stateless-adjudication.md:1173-1197`
> and §3.24 above.

| | Track | Decision | Consequence | State |
|---|---|---|---|---|
| G159 | cross-track | **G99's NEGATIVE CONTROL GAINS A SECOND NAMED HELPER FOR THE PRE-TENANT SESSION READ** (S-1) | *"No query outside `withTenantScope()`"* becomes *"no query outside these two"* — **weaker as a sentence, and it must stay a CLOSED list**; the adjudication warns *"somebody will propose a third."* Rejected: a nullable tenant on the existing helper. 🛑 **Either way: do not add `query` to `TenantPool`** — a general escape hatch defeats both options. **Ruled on the recommendation, in one act** | not applied |
| G160 | cross-track | **THE SESSION RLS PREDICATE KEYS ON THE HANDLE DIGEST IN A GUC, NOT A ROW ID VIA `SECURITY DEFINER`** (S-2) | A digest travels in a session variable on every request. Rejected: a `SECURITY DEFINER` lookup — *"becomes the most security-relevant object in the schema"*, **a standing widening**, plus its own two-row negative test. **Ruled on the recommendation, in one act** | not applied |
| G161 | cross-track | **"SIGN ME OUT EVERYWHERE" IS NOT V1** (S-5) | **No session enumeration exists in the request plane, so a compromised credential is contained per-session until expiry** and incident response cannot list live sessions. The fallback lever is recorded rather than left unowned: `User.status`. **Ruled on the recommendation, in one act** | not applied |
| G162 | cross-track | **`model/execution.ts` AND `model/held-work.ts` ARE NEW MODULES, NOT MORE OF `model/domain.ts`** (S-9) | *"`ReconciliationRun` is on the wire and is the business record; a lease is neither, and a held draft is neither"*, and `CLAUDE.md` requires a plan before touching `domain.ts`. ⚠️ **The governed module count moves and every count in the record goes STALE the day they land — say so, because `node tools/check-doc-counts.mjs` will report it and a reader must know it is expected.** *"That is the tool working."* **Ruled on the recommendation, in one act** | not applied |
| G163 | cross-track | **AN O(TENANTS) REGISTRY SWEEP, NOT A LEASE TABLE OUTSIDE RLS** (S-10) | Refused the alternative on **G103**, *"which refused a table outside RLS on the ground that four invariants are enforced by the store"*. Cost accepted: **the sweep's cost grows with tenant count**, and ⚠️ **fairness and starvation are unaddressed and no fairness rule is invented.** **Ruled on the recommendation, in one act** | not applied |
| G164 | cross-track | **NO AUDIT ROW PER INDIVIDUAL HOLD** (S-13) | **Individual autosaves are not independently attributable** — plainly, *"a write of personal data with a capability check and no record."* ⚠️ **The fallback if unacceptable is a COARSER record, not a finer one** — one row per draft lifetime — **which is the grain S-11 (G-row pending, §3.9) rules for metering, and the two must agree.** **Ruled on the recommendation, in one act** | not applied |
| G165 | cross-track | **THE D6 THREAT-MODEL GATE LANDS BEFORE THE FIRST UNAUTHENTICATED ENDPOINT** (S-14) | **It blocks shipping a public surface until the threat model exists** — the intended failure — and *"delays the session wire by whatever D6 costs."* Refused shipping first because **this would be the first unauthenticated public endpoint**, so there is no precedent to lean on and no second chance to set the posture. **Ruled on the recommendation, in one act** | not applied |
| G166 | cross-track | **THE OUTCOME TABLE'S PRIMARY KEY IS THE CONTENT KEY; `requestOrdinal` BECOMES A LABELLED COLUMN** (S-17) | **Makes G143(c)'s content addressing STRUCTURAL rather than conventional.** 🛑 **Irreversible from the first stored verdict either way**, and **G111's money codec must land FIRST because `canonicalise()` refuses `bigint`** (`model/canonical.ts:66-71`). Rejected: `requestOrdinal` as PK with a unique index on the content key — its merit preserved, *"keeps `requestOrdinal`'s ordering cheap in the queue index."* **Ruled on the recommendation, in one act** | not applied |

### 4.6 The full range, and what is still unnumbered

**G132 to G166 — thirty-five draft rows.** Split by track:

| Track | Numbers | Rows |
|---|---|---|
| **Ingestion** | G132–G142 · G148 · G150–G155 · G157 · G158 | **twenty** |
| **Cross-track** (statelessness, session, queue, held work) | G143–G147 · G149 · G156 · G159–G166 | **fifteen** |

**Derive it rather than trusting the table:**
`grep -cE '^\| G1[0-9][0-9] \| ' docs/build/owner-rulings-10-aug.md` → **30**. ⚠️ **That is 30 and not 35
for a reason worth knowing:** it matches §4.1's eleven rows and §4.3–§4.5's nineteen, and **misses
§4.2's five**, whose number cell carries a `*(was draft G13n)*` suffix — the suffix §1's renumber
instruction requires. **Thirty plus five is thirty-five.** A grep that looked right and undercounted by
five is this record's own §5.1 in miniature: a rule keyed on a convenient pattern instead of the
property it protects.

🛑 **STILL UNNUMBERED: §3.1–§3.12, the twelve rulings recorded nowhere else.** They need **G167**
onward. This document has never minted a number for them and does not now: **§1's allocation was the
owner's**, and every extension since has been forced by rulings arriving after it — each stated as a
forced extension at the point it happened. **Minting twelve more on my own initiative would be a
different act.**

---

## 5. What these rulings make necessary, in dependency order — and what each BLOCKS

**Read this as a sequence of gates, not a backlog.** Each item names what cannot start until it lands.

1. **G146 — invert the containment proof.** Its own commit, each leaf RED first.
   **BLOCKS:** every new containment assertion, therefore T-2's shape tokens (G141), therefore the
   mapper seam, therefore **O-15's new refusal arm** (§3.6), which must hold no text.
   *Why first:* an assertion written against a proof that is about to change shape is rework, and it is
   rework that looks correct.
2. **G145 — partition the chains.** 🛑 **Time-boxed, not merely ordered.** The window closes at the
   **first chain row**, and only two streams are chained (`model/domain.ts:3939`,
   `model/governance.ts:1158`). **BLOCKS:** nothing. **Is blocked by:** nothing. **Is destroyed by:**
   any other work that writes a chained row first. That asymmetry is why it goes second and not tenth.
3. **G111 — the money codec** (already ruled, `docs/HANDOFF.md:978`).
   **BLOCKS:** G147's content-addressed key over any money-bearing body; O-14's canonical subject hash
   (§3.12(b)) if a subject value can ever be money. *Latent today* (`model/domain.ts:535`), which is
   the trap.
4. **G147 — the content-addressed replay key**, and with it the `RunPlan` that pins `pairing`,
   `strategyBindings`, both `PopulationBinding`s **and** `knownUniquenessConflicts` (§3.12(c)).
   **BLOCKS:** the reader executor; S-20's pre-read (§3.5); O-14's post-flight insert.
5. **S-18's capability 38** (§3.7). Cheap, and it is a **platform release**.
   **BLOCKS:** any reader act that calls `authorize()` — which, given
   `model/access.ts:1675`, is every reader act. *Nothing else can be tested end-to-end without it.*
6. **S-7's resume grant chain and `redeemAuthorization()` on every attempt** (§3.4), **with the
   withdrawal re-check.** **BLOCKS:** any resume path. **Amends:** G121, which must be edited rather
   than cited.
7. **S-4's lease floor and O-8's bounds** (§3.10, G139). Config plus named refusal arms.
   **BLOCKS:** the work queue running at all — every bound refuses on absence by design.
   **Is blocked by:** a measurement nobody has taken.
8. **S-20's single retry authority** (§3.5): map at one attempt, backoff and jitter in the queue, the
   persisted `ReaderOutcome` read before invoking. **BLOCKS:** paying for anything twice.
9. **O-15's empty-population refusal and its declared expectation** (§3.6).
   **BLOCKS:** trusting any run's postconditions — today a clean close over nothing is
   indistinguishable from a clean close.
10. **O-13's PostgreSQL 17 pin** (§3.11). **BLOCKS:** nothing in phase one; **unblocks** every
    migration being written against a known major.
11. **O-14's `SubjectLedger`** (§3.12) — table, canonical hash, retention class, injected map with a
    **refusing** absent case, bounded retry, counter.
    **BLOCKS:** duplicate-invoice detection, which is declared and inert today.
    **Is blocked by:** 3 (if money), 4 (the pinning), and a `RetentionClass` decision.
12. **O-21's non-metered correction** (§3.3) and **O-20's compensating correction path** (§3.2).
    **BLOCKS:** shipping correction at all. **Is blocked by:** O-20's own scope framing being settled
    (§3.2's discrepancy box).
13. **S-21's two-armed session picker** (§3.1). **BLOCKS:** an FDE reaching any tenant, therefore every
    FDE act G56 assigns. **Is blocked by:** S-1 and S-2, which are still **OPEN**
    (`docs/build/stateless-adjudication.md:1175-1176`).
14. **S-19's per-screen disposability pass** (§3.8) and **S-11's meter grain** (§3.9).
    **BLOCKS:** the held-work surface. **Checked by:** nobody — §3.8 is held by review or not at all.

**Where the nineteen later rulings insert into that sequence.** Not re-sorted — placed, so the sequence
above stays readable:

- **Before 1 (G146):** nothing. **Alongside 1:** **G154's** existence-only response shape (§3.19), which
  must be provably content-free and therefore waits on the inversion.
- **Alongside 3 (G111):** **G166** (S-17, §3.24) — the content key as primary key is irreversible from
  the first stored verdict and `canonicalise()` refuses `bigint`, so the codec is a hard predecessor,
  not a preference.
- **Alongside 4 (G147):** **G166** again, since the PK *is* the content key.
- **Alongside 5 (capability 38):** **G157** (O-19, §3.22). ⚠️ **These are ONE defect, not two** — a new
  act whose actor and authority vocabularies were built for other surfaces. Plan them together or the
  third instance goes unnoticed.
- **Before any migration:** **G158** (O-10, §3.23) and O-20's `document_capture` — **one of the two is
  the fourteenth `RetentionClass` and the other the fifteenth**, and both go red at
  `PLACEHOLDER_RETENTION_POLICY`, `RETENTION_RECORD_KIND` and `check:wire` simultaneously. **Whoever
  lands first must say which.**
- **Before the third run state (G153, §3.18):** the run-status **wire pair must be pinned in
  `tools/check-wire-mirror.mjs` FIRST.** **BLOCKS:** the enum change. *If skipped, `npm run check` stays
  green while model and wire drift.*
- **Before `arrivalId` (G152, §3.17):** the **`PARTNER_CAPABILITY_MASK` check** and the *"appears in NO
  scope, EVER"* sentence on `view_metering`. **BLOCKS:** the field landing safely.
- **Alongside 7 (the bounds):** **G150**'s declared date order (§3.15), **G151**'s rung-keyed
  fingerprint (§3.16), **G156**'s two draft clocks (§3.21), **G158**'s quarantine window — **all four
  are O-8 configuration refusing on absence**, so they land as one configuration surface rather than
  four. *One refusal vocabulary, not four.*
- **Alongside 12 (correction):** **G148** (O-22, §3.13) — suspension is the act that makes the
  correction window survivable, so it lands **with** correction, not after it.
- **Alongside 14 (held work):** **G156** (S-22), **G164** (S-13) and **G161** (S-5).
  ⚠️ **G164's fallback grain and S-11's meter grain must agree** — both are *per draft lifetime*.
- **Anywhere, cheap, and it unblocks reading:** **G149** (S-16, §3.14), **G159** (S-1), **G160** (S-2),
  **G162** (S-9), **G163** (S-10), **G165** (S-14). ⚠️ **G162 moves the module count**, so it lands with
  the doc-count updates in the same commit or the gate goes red for a correct change.
- **Blocked on an open ruling:** **G156's** promotion target is **S-12**, which is still OPEN. A cap
  with no promotable destination is a data-loss feature.

---

## 6. What nobody has verified

**Stated so that a clean `npm run check` is not misread as evidence for any of it.**

**The two standing verifications, both carried forward as NOT DONE:**

1. 🛑 **The Aurora Serverless v2 engine version** (§3.11). O-13 pins PostgreSQL 17 for a disposable
   phase-one database. **Nobody has confirmed what the hosted fleet can run.** No version was fetched
   and none is asserted here.
2. 🛑 **Whether a partition axis preserves `ChainAnchor.id`'s dispute-evidence property** (§2(ii),
   G145). `ChainAnchor.id`'s own docblock (`model/governance.ts:1140-1145`) argues that
   `(tenantId, stream, throughSequence)` *"is not an answer once an anchor can be re-taken"* — and a
   partition axis **changes what an anchor covers.** `docs/build/stateless-adjudication.md:1180` and
   `:1219` both record this as unverified, and it must be checked **before the field is added**,
   because G145 is irreversible.

**Also unverified, and each is load-bearing somewhere above:**

- **The lease floor's number** (§3.10). It must sit above the slowest expected model call. **Nobody has
  measured one.** `PRODUCT.md` forbids inventing it, so the bound refuses until somebody does.
- **O-20's framing** (§3.2). Whether the owner takes this as *against* the written recommendation or
  *in agreement with* it. The tree's recommendation was **YES for mappings**; the brief said the
  opposite. **Both readings are preserved; neither is asserted.**
- **Whether `unique_within` was ever intended to be evaluated in v1** (§3.12). The predicate is
  declared (`model/domain.ts:367`) and carries **no `@dropped-for-v1` marker** — so it is neither built
  nor dropped, and no document in the record says which it is meant to be.
- **Whether metering a draft count is disclosable** (§3.9). G87 governs partner visibility; **no drawn
  screen discloses a per-person draft count**, and whether it may be metered at all without disclosure
  is a question for counsel, joining S-15.
- **Whether any browser state is disposable** (§3.8). There is **no frontend root** —
  `docs/build/stateless-adjudication.md:171` — so there is nothing to check and no checker that could.
- **Every count on this page.** `tools/check-doc-counts.mjs` does not scan `docs/build/`
  (`tools/check-doc-counts.mjs:224-232`). The commands in §0 are the only verification, and they were
  run against a tree carrying another session's uncommitted work.
- **Nothing on this page is applied.** Thirty-five draft G rows exist and **zero G rows have been
  placed.** A reader who takes any statement here as a decision of the record has misread the banner.

### 6a. What remains OPEN after all twenty-three-plus rulings — each verified still open at the tree

**Verified against `docs/build/stateless-adjudication.md` §8's status column, which is the register.**

| | Status verified | What is open | Why it cannot be closed here |
|---|---|---|---|
| **S-12** | ✅ **OPEN** (`docs/build/stateless-adjudication.md:1186`) | **Is the confirmed-field act in v1?** | 🛑 **If NO, do not declare the arm at all** — *"a draft with no promotion path is a promise the product cannot keep."* If YES: *"a capability, an operation, a home for the value, and a distinct event type. Four absences."* ⚠️ **G156 (S-22, §3.21) DEPENDS ON THIS**: its accepted cost includes *"the work must be promotable into something durable that is not a draft"*, and S-12 is that destination |
| **S-23** | ✅ **OPEN** (`:1197`) | **Does G39's SOP amendment read held prose?** | *"No recommendation. It trades a drawn interaction against a fail-closed invariant, and both are yours."* If YES: **an argued exception on the most fail-closed rule in the model** — G106's unreadable-by-default. If NO: *"the sharpest interaction in the screen pack loses its input and the screen needs redrawing."* G39 is *"one narrow write, text and thresholds only"* (`docs/HANDOFF.md:825`) |
| **S-15** | ✅ **OPEN ⚖️ COUNSEL** (`:1189`) | **Does unsubmitted work fall inside PDPA access and correction, not only erasure? And what is the held-work retention window?** | *"Not answerable here."* **Without the window, every hold refuses.** ⚠️ **Two rulings lean on it: G154 (§3.19) decides what an access answer CONTAINS but not that the obligation applies; G156 (§3.21) needs the idle number, which is counsel's half.** RULED 21 adds a second counsel question: *"what `subjectRef` an author-typed sentence is indexed under"* |
| **Standing 1** | 🛑 **NOT DONE** | **The Aurora Serverless v2 engine version**, against O-13's PostgreSQL 17 pin (§3.11) | No version fetched, none asserted. Must be confirmed **before the hosted fleet depends on it** |
| **Standing 2** | 🛑 **NOT DONE** | **Whether a partition axis preserves `ChainAnchor.id`'s dispute-evidence property** (§2(ii), G145) | `ChainAnchor.id`'s docblock (`model/governance.ts:1140-1145`) argues `(tenantId, stream, throughSequence)` *"is not an answer once an anchor can be re-taken"*, and a partition axis changes what an anchor covers. **G145 is irreversible, so this is checked before the field is added or not at all** |
| **Standing 3** | 🛑 **NOT DONE** | **The `PARTNER_CAPABILITY_MASK` check O-11 requires before `arrivalId` lands** (§3.17, G152) | The mask is at `model/access.ts:950` and is an allow-list, so absence protects by default — **but `view_metering` carries no *"appears in NO `PARTNER_CAPABILITY_MASK` scope, EVER"* sentence where `model/access.ts:284`, `:420` and `:487` do.** The protection is prose plus current contents, not a named negative control. **Verify and record the result** |

⚠️ **And two open items that are not on anyone's list because they were created by these rulings:**

- **Which retention class is the fourteenth** — G158's quarantine window versus O-20's
  `document_capture` (`docs/build/ingestion-p2-adjudication.md:516`). **Two documents each claim it and
  neither knows about the other.** §4.4's G158 row is the only place the collision is written down.
- **What goes into the structural fingerprint besides order** — G151 (§3.16) settles **order** and
  leaves **case and whitespace** exactly as open as G136 found them
  (`docs/build/ingestion-pipeline.md:935`).

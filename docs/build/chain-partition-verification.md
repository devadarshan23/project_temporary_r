# Does a partitioned audit chain still settle a dispute?

> **WORKING MATERIAL · V1 AUTHORITY: NO · a verification, not a decision.**
> Written 10 Aug 2026 against the working tree. This closes — or rather, answers —
> **Standing 2** of `docs/build/owner-rulings-10-aug.md` §6: *"whether a partition
> axis preserves `ChainAnchor.id`'s dispute-evidence property"*, the verification
> that **G145** requires **before the field is added**, because G145 is irreversible.
> Nothing here is a ruling. The verdict in §5 is a recommendation to the owner and
> the control it names has to be placed by the owner or it does not exist.

---

## 0. What was read, and the facts every conclusion below rests on

Every `file:line` in this document was opened. The counts were derived, not copied.

```bash
grep -rn 'chain: RecordChain' model/*.ts | wc -l     # 2 — the whole chained surface
grep -rho 'ChainAnchor' docs/contracts/ | wc -l      # 0 — the anchor is on no wire
grep -rnE 'function .*[Cc]hain|function .*[Aa]nchor' model/*.ts | wc -l   # 0 — no verifier
grep -rn '\.sequence' model/*.ts                     # 1 — a doc comment, not a reader
```

**Four facts that shape everything that follows.**

1. ✅ **Exactly two streams are chained** — `AuditEvent.chain` (`model/domain.ts:3939`)
   and `DataAccessEvent.chain` (`model/governance.ts:1158`). Both are `RecordChain`
   (`model/governance.ts:1110`).
2. ✅ **The chain has no executable form anywhere.** No function in `model/` verifies
   a chain, computes a head, or reads `RecordChain.sequence` — the single `.sequence`
   hit is prose inside `RecordChain`'s own docblock (`model/governance.ts:1086`). So
   **nothing in the tree consumes any of the properties tested below.** They exist as
   an argument in a docblock and as three fields. That cuts both ways: the argument is
   the specification, and there is no implementation whose behaviour could contradict
   it.
3. ✅ **`ChainAnchor` appears on no contract.** `grep` over all of `docs/contracts/`
   returns zero. The type calls itself *"the periodic anchor"*
   (`model/governance.ts:1123` neighbourhood) and **the mechanism by which it reaches
   the control plane does not exist** — no endpoint, no schema, no cadence. Contrast
   `UsageAttestation`, which has both a submission path and a
   `/usage/attestations/chain-head` resume endpoint
   (`docs/contracts/control-plane.openapi.yaml:381`). ⚠️ **This matters to the verdict**:
   several properties below depend on the anchor set being held by a party the
   database's root holder cannot reach, and nothing yet puts it there.
4. ✅ **Adding a field to `ChainAnchor` is compile-time free.** `model/identity.ts:516`
   and `:1062` pin `ChainAnchor: ChainAnchor` and `model/identity.ts:238` pins its id
   brand — those catch a *deleted* field or a *re-branded* id
   (`model/identity.ts:472-478` works the case). **None of them constrains a field
   that is added.** So the partition axis will be chosen by whoever types it, and
   `tsc` will be green whatever they choose. `CLAUDE.md`'s own warning applies
   verbatim: *"If you add a field and `tsc` stays green without you changing anything
   else, the compiler told you nothing."*

---

## 1. What the chain is evidence OF — read off the tree, not assumed

The specification is `RecordChain`'s docblock (`model/governance.ts:1084-1109`) and
`ChainAnchor`'s (`:1123-1137`), plus the one place outside `governance.ts` that
**relies** on the chain to carry a claim: `model/access.ts:1450`.

| | The property | Where the tree states it |
|---|---|---|
| **P1** | **A deleted row is detectable.** *"Gaps are the detection; absence of a row is invisible without it"* | `model/governance.ts:1115` (the field), `:1099` (the claim) |
| **P2** | **An edited row is detectable** — the chain breaks | `model/governance.ts:1117`, `:1119` |
| **P3** | **A wholesale rewrite is detectable** — *"once we hold it, a rewritten history no longer matches an anchor we recorded before the rewrite"* | `model/governance.ts:1151` (`headHash`) and the docblock above it |
| **P4** | **The anchor carries no tenant data**, so invariant 3 holds — *"It is a scalar. It carries no subject, no actor, no action and no field value"* | `model/governance.ts:1123-1137` |
| **P5** | **An unauthorised act is at least detectable** — *"absent from the stream entirely (detectable, because all three streams are hash-chained and sequence gaps break the chain)"* | `model/access.ts:1450` |
| **P6** | **The evidence row is citable** — the surrogate `id` exists because *"`(tenantId, stream, throughSequence)` is not an answer once an anchor can be re-taken"* | `model/governance.ts:1140-1146` |

Two properties the tree **explicitly disclaims**, and I will not test partitioning
against something it never had:

- It does **not** defend against a root holder who rewrites the whole chain
  (`model/governance.ts:1099-1101`). That is P3's job and P3 is *"one property
  weaker: we can prove the chain changed, not what it used to say."*
- The anchor is **periodic**, so a **head truncation inside the unanchored tail** is
  undetectable today. That is a limit of every hash chain and is not a partitioning
  defect. **It becomes one below, quantitatively.**

---

## 2. Property by property, adversarially

### 2.1 P1 and P2 within a partition — ✅ PRESERVED, exactly and without qualification

`RecordChain` is `sequence` + `previousHash` + `bodyHash`. Re-key its uniqueness from
`(tenant, stream)` to `(tenant, stream, partition)` and every one of the three fields
means the same thing over the narrower domain. Delete a row from partition P: its
successor's `previousHash` no longer matches its predecessor's `bodyHash`, and the
sequence gaps. Edit a row: its `bodyHash` changes and its successor's `previousHash`
stops matching. **Identical detection, identical proof, identical cost.**

G20's canonicalisation is untouched. `canonicalise()` (`model/canonical.ts`) hashes a
*body*; nothing in RFC 8785 or in this module's contract knows or cares which chain
the body belongs to. Partitioning does not reopen G20 and nothing below suggests it
does.

**This is the half everybody checks, and it is fine. The verdict does not turn on it.**

### 2.2 P1 at PARTITION granularity — 🛑 **NOT PRESERVED.** This is the finding.

Here is the argument, and it is mechanical.

**Under a single chain, gap detection is INTRINSIC.** Delete rows 500–510 of a
tenant's audit stream and the detection needs no external register, no anchor and no
second party: rows 499 and 511 survive **in the same chain** and bracket the hole.
`previousHash` mismatches and the sequence jumps. The customer can find it alone, on
their own copy, with nothing but `model/canonical.ts` and a hash function. The chain
is *self-describing about its own extent* because the set of chains is closed and
declared in the type: `stream: 'audit' | 'data_access'`
(`model/governance.ts:1148`) is a two-member union, so a verifier knows a priori
exactly which chains must exist for a tenant and can demand both.

**Under partitioning, delete a whole partition and there is no bracket.** Every row
of partition P is gone, so no surviving row's `previousHash` points into the hole and
no surviving sequence skips a number. The remaining N−1 chains verify perfectly. The
detection that survives is not *"a row is missing"* — it is *"a chain is missing"*,
and **that is a different kind of claim, answerable only by something that enumerates
the partitions.**

**Nothing enumerates them.** `ChainAnchor` today carries `tenantId`, `stream`,
`throughSequence`, `headHash`, `anchoredAt` (`model/governance.ts:1146-1152`). The
ruling adds *a* partition field. A set of anchors tells you which partitions **were
anchored**; it cannot tell you which partitions **existed**, unless the set of
possible partitions is knowable independently of the database being audited. And
under BYOA the database being audited is held by the party whose behaviour is in
dispute — the whole premise of `ChainAnchor`'s docblock.

**The concrete attack, stated so it can be argued with.** A root holder wishing to
erase a class of audit rows no longer needs to touch a chain at all. They arrange
that the rows land in a partition of their choosing, and they drop the partition and
its anchors. What is left is a set of internally valid chains and a set of internally
consistent anchors. Under the single chain this attack **does not exist**: there is
one chain, it is named by a closed union, and the rows cannot be routed away from it.

**⚠️ The accepted cost was understated in every document that recorded it.** Four
places state the cost as *"a missing row becomes a per-partition claim"* — the
adjudication (`docs/build/stateless-adjudication.md:780`), the draft G row (`:1219`),
`docs/HANDOFF.md:1307`, and `docs/build/stateless-application.md:1475`, which calls
it *"a slightly weaker claim"*. **A missing row does become a per-partition claim,
and that part is benign — §2.1 shows it is the same claim over a narrower domain.**
The cost nobody wrote down is that **a missing PARTITION becomes an unclaimable
one**, and that is not a weaker version of the old claim, it is a new hole where
there was none. `RecordChain`'s own sentence is the right one to hold it against:
*"absence of a row is invisible without it"* (`model/governance.ts:1112-1114`).
Partitioning re-creates invisible absence one level up.

**The quantitative half, which is derivable and worth having.** Even with the fix in
§5, partitioning multiplies the **head-truncation surface**. Today a tenant has two
truncatable heads — audit and data_access — and each is bounded by the last anchor.
With N partitions per stream a tenant has **2N** truncatable heads, each with its own
unanchored tail. Truncating the tail of one quiet partition is materially easier to
hide than truncating the tail of a busy single chain, because in a busy single chain
concurrent writes keep extending past the rows you wanted to remove and bracket them
within milliseconds. **The mitigation for that is anchoring cadence, not the axis** —
and no cadence is written down anywhere in the record.

### 2.3 P-ordering across partitions — the property existed, it is LOST, and I am not inflating it

Be precise, because it would be easy to invent a requirement here.

**Did the unpartitioned design have a total order?** Yes. `sequence` is *"Monotonic
per tenant per stream"*, so the audit stream of one tenant is totally ordered and
that order is **tamper-evident** — you cannot restate it without re-hashing forward
and breaking the head against an anchor.

**Did anything rely on it?** ✅ **No.** `grep -rn '\.sequence' model/*.ts` returns one
line and it is a doc comment. There is no verifier, no reader, no contract, no
screen. Nowhere in the record does any document claim cross-event ordering as a
purpose of the chain — P1 through P6 in §1 are about *presence* and *integrity*, not
*order*. **So this is not a blocker and I will not dress it as one.**

**What is genuinely lost.** After partitioning, for two events in different
partitions the only ordering evidence is `AuditEvent.at` (`model/domain.ts:3994`) — a
timestamp, which the chain protects from *editing* (it is inside the hashed body) but
which nothing forces to be *monotonic* or *honest at write time*. So *"A happened
before B"* degrades from a structural property to a clock assertion. **An auditor
reconstructing a sequence of events across a tenant's whole audit stream is the
obvious consumer, and it is exactly the reader the two streams exist for**
(`docs/access-and-agency.md` §11.7: *"the record an auditor actually asks for"*).

**Recommendation: accept it, but accept it in writing.** The honest sentence for the
G row is *"cross-stream ordering was a property of `sequence`, nothing consumed it,
and after partitioning ordering across partitions is by `AuditEvent.at` alone."* If
that sentence is unacceptable when read aloud, the axis choice in §5 should be one
whose partitions are **time-disjoint**, because then partition order plus in-partition
sequence reconstructs the total order. That is a real reason to prefer one axis over
another and it belongs in the ruling.

### 2.4 P4 — the anchor's tenant-data-free property is a property of the AXIS, and 🛑 **NOBODY HAS NAMED THE AXIS**

This is the second blocker and it is the more embarrassing one, because it is not a
subtle interaction — it is a missing noun.

Every statement of G145 says *"one chain per `(tenant, stream, partition)`, with the
partition named in `ChainAnchor`"* and **not one of them says what `partition` is.**
Checked at: `docs/HANDOFF.md:1307`, `docs/build/owner-rulings-10-aug.md:199-207` and
`:1399`, `docs/build/stateless-adjudication.md:776-793` and `:1219`,
`docs/build/stateless-application.md:1308` and `:1475`,
`docs/build/stateless-green-state-audit.md:729` and `:881-887`. Nine files mention
`ChainAnchor`; none proposes an axis.

**P4 cannot be verified without it, and the answers differ sharply by candidate:**

| Candidate axis | Does the anchor still carry no tenant data? |
|---|---|
| A fixed-cardinality bucket, `0..N-1`, N a published constant | ✅ **Yes.** A small integer from a closed set is as scalar as `stream` already is |
| A time bucket (month, day) | 🟠 Probably — a period label is not tenant content, but the **set** of anchored periods leaks the tenant's activity calendar. The plane already holds `throughSequence` and `anchoredAt`, so this leaks little that is new. Argue it, do not assume it |
| The writing node / task id | ⚠️ **No, in a different direction** — it makes the partition set unbounded and unknowable, which destroys §2.2's fix outright, and it leaks the platform's own topology into a record produced for a customer dispute |
| Anything derived from the record's content — actor, subject, resource class | 🛑 **No.** `subjectRef` or an actor identity in a field the control plane holds is invariant 3 broken on its face, and it is precisely the leak `ChainAnchor` was built to avoid: *"no subject, no actor, no action and no field value"* |

**So P4's status is not "preserved" and not "broken" — it is UNDECIDABLE at the
tree**, and it becomes decidable the moment the owner names the axis. Any G row that
lands the field without naming the axis ships an unverified invariant-3 exposure
under an irreversible decision.

### 2.5 P6 — `ChainAnchor.id` survives untouched, and **Standing 2 is aimed at the wrong field**

The standing question, as recorded three times
(`docs/build/owner-rulings-10-aug.md:1572` and `:1610`,
`docs/build/stateless-adjudication.md:1180`), is *"whether a partition axis preserves
`ChainAnchor.id`'s dispute-evidence property."*

✅ **It does, and the argument is short.** `id`'s docblock
(`model/governance.ts:1140-1145`) exists because the natural key `(tenantId, stream,
throughSequence)` *"is not an answer once an anchor can be re-taken"* — two anchors
can share a natural key, so evidence needs a stable address. **A partition axis makes
the natural key WIDER, not the surrogate weaker.** `(tenantId, stream, partition,
throughSequence)` is still not unique under re-take, for exactly the same reason, and
the surrogate still answers *"which anchor did we rely on."* Nothing about `id`
changes. The same argument that minted it re-derives it.

🛑 **But the question was mis-aimed, and answering it as asked would have closed
Standing 2 with a false all-clear.** The dispute-evidence property at risk is not
carried by `ChainAnchor.id` — it is carried by **the completeness of the anchor
SET** (§2.2) and by **the content of the new field** (§2.4). An agent that checked
only what Standing 2 literally asks would have written *"✅ preserved"* and been
right about the field and wrong about the decision. **Whoever amends the standing
row should restate the question, not just tick it.**

### 2.6 P-cost — *"verification must walk every partition"* is true and is **not the cost that matters**

The adjudication accepts as a cost that *"verification must walk every partition"*
(`docs/build/stateless-adjudication.md:780`). Tested:

- **Work:** unchanged. Verifying one chain of L rows is L−1 hash comparisons.
  Verifying N chains totalling L rows is L−N. Plus N head comparisons instead of one.
  **Partitioning is very slightly cheaper in hashing and trivially more expensive in
  bookkeeping.** It is not a cost.
- **Parallelism:** N independent chains verify concurrently where one chain is
  strictly serial. **Partitioning makes verification faster, not slower.**
- **Who can verify:** unchanged *by the walk*. Under BYOA the customer holds every
  row and can check links and gaps unaided in both designs; only the platform holds
  anchors, so only a two-party comparison detects a wholesale rewrite. That asymmetry
  is P3's stated limit and predates partitioning.

**The real cost is not walking the partitions — it is KNOWING WHICH ONES TO WALK**,
which is §2.2. The stated cost is a distraction from the unstated one. ⚠️ And it
degrades **self-verification symmetrically**: under partitioning neither party can
detect a missing partition alone, because both derive the partition list from the
same database.

---

## 3. The dispute, side by side

**The scenario.** A customer's compliance officer asserts that an audit record
existed — someone opened a data subject's file on 3 March — and that it has been
removed. Or, the other direction: the customer asserts a record shown to them was
fabricated. In both, the holder of the chain must answer.

### 3a. Unpartitioned

**What the holder produces.** The audit chain for that tenant from sequence 1 to
head; the `ChainAnchor` rows the control plane holds, each with `throughSequence` and
`headHash` (`model/governance.ts:1150-1151`); and the canonicalisation spec, RFC 8785,
which is a **published** spec — G20 chose it over a hand-rolled serialiser precisely
so that *"two implementations agreeing is evidence"* (`model/canonical.ts:47-49`).

**What the customer verifies for themselves.** Everything except the anchors' own
authenticity. They re-canonicalise each body with their own RFC 8785 implementation,
recompute each `bodyHash`, check each `previousHash` link, and check that the
sequence runs 1..head with no gap. If it does, **no row was removed and none was
edited** — over the whole stream, because there is one stream and its extent is
declared in the type. They then check the head at the last anchor against the
platform's `headHash`; a match means the history they hold is the history the
platform saw at that time, so nothing before it was rewritten. **The residual is
named and small: rows written after the last anchor could have been truncated.**

**Removal claim:** answered — an unbroken 1..head with a matching anchor is proof of
non-removal up to the anchor. **Fabrication claim:** answered — inserting a record
retrospectively renumbers and re-hashes everything after it, so the head at the last
anchor would no longer match.

### 3b. Partitioned, as G145 stands today

**What the holder produces.** *Some* set of chains, each internally valid, and *some*
set of anchors.

**What the customer verifies for themselves.** Each chain's links and gaps, exactly
as before. Then they ask the question the whole dispute turns on — *"is this all of
them?"* — and **nothing in the design answers it.** The partition set is enumerated
from the same database whose contents are in dispute. The customer's own copy cannot
help, because their copy is a copy of that database.

**Removal claim:** 🛑 **not answered.** *"There is no record of a 3 March access"* and
*"the partition holding the 3 March accesses was dropped, with its anchors"* produce
**byte-identical evidence.** The customer cannot distinguish them, and neither can
the platform. **Fabrication claim:** answered, and no weaker than 3a — insertion
still renumbers and re-hashes its own partition and still breaks that partition's
anchored head.

**The one-sentence difference.** Unpartitioned, the customer walks away able to say
*"the stream is complete"*; partitioned, the strongest thing they can say is *"every
stream I was shown is complete"* — and in a dispute about a removed record, the
holder chooses what they are shown.

---

## 4. What the throughput argument is worth, so the trade is a trade

I did not re-derive the throughput case and I do not dispute it. It is stated at
`docs/build/stateless-green-state-audit.md:709-738` and it is correct on its own
terms: under G101 a `FOR UPDATE` on a per-`(tenant, stream)` head row is held for the
**whole** request transaction, so per-tenant audit write throughput becomes that
tenant's request-concurrency ceiling, and the record's own *"under 1 row/sec average.
Unremarkable"* is rightly called out as not a lock-contention argument.

**Two observations that belong in the trade and are not in it.**

- **N does not have to be large.** The contention argument is satisfied by a handful
  of partitions — it removes a serialisation point, and going from 1 to 8 does almost
  all of the work that going from 1 to 8,000 does. **A small, fixed N is what §5's
  control needs, and it is also what the throughput argument actually asks for.** The
  two requirements do not conflict; they point at the same answer.
- **The evidence cost is not proportional to the throughput benefit.** Doubling N
  doubles the truncation surface (§2.2) and buys progressively less contention
  relief. **There is no reason to choose a large N and two reasons not to.**

---

## 5. VERDICT — **PRESERVED ONLY IF**

Partitioning preserves P2 (edit detection), P3 (rewrite detection), P5 (unrecordable
acts) and P6 (`ChainAnchor.id`) unconditionally. It preserves P1 **within** a
partition unconditionally and **destroys P1 at partition granularity** unless the
partition set is closed. It leaves P4 undecidable until the axis is named. It costs a
cross-partition total order that existed and that nothing consumes.

**The control that must land in the same commit as the field — three parts, all
required, and part (a) is the load-bearing one.**

> **(a) THE PARTITION AXIS IS A CLOSED, FIXED-CARDINALITY SET DECLARED IN `model/`,
> EXACTLY AS `stream` ALREADY IS** — a union or const object of N members at
> `model/governance.ts`, N small, with the routing from a record to its partition
> being a total function. **It must not be data-derived, not open-ended, not a node
> id, not a growing time series, and not derived from record content.** The test the
> axis must pass is one sentence: *a verifier who has never seen this tenant's
> database must be able to state how many chains exist for it.* That is true of
> `stream: 'audit' | 'data_access'` today and it is the property partitioning
> otherwise destroys.
>
> **(b) EVERY PARTITION OF THAT SET IS ANCHORED EVERY CYCLE, INCLUDING EMPTY ONES.**
> An empty partition anchors at `throughSequence: 0`. This makes *"partition k has no
> anchor for period P"* an anomaly rather than a normal state, which is what turns
> the anchor set into a completeness witness instead of a list of whatever was
> offered. Without (b), (a) buys nothing: knowing N chains should exist does not
> help if the absence of one is indistinguishable from silence.
>
> **(c) THE ANCHORING CADENCE IS WRITTEN DOWN, AND SO IS THE DELIVERY PATH.** ✅ The
> anchor is on no contract today (`grep -rho 'ChainAnchor' docs/contracts/` → 0) and
> the cadence appears in no document. The unanchored tail is the residual hole in
> both designs and partitioning multiplies it by N; the cadence is the only thing
> that bounds it, and an anchor the control plane never receives bounds nothing.

**With (a), (b) and (c), the answer to §3's dispute returns to 3a's strength**, with
one honest residual: the truncation window is per-partition rather than per-stream,
so the tail exposure is N times wider at any given cadence. That is a real, stated,
bounded cost — unlike the current position, where a dropped partition is not a cost
but a silence.

**Without (a), the answer is NOT PRESERVED, and I would say so to the owner in those
words.** The throughput argument that motivated G145 is sound and I am not asking for
it to be reversed. I am saying that G145 as currently written — *"the partition named
in `ChainAnchor`"*, with no axis — is **not yet a decision that can be applied
safely**, because the axis carries the entire evidence question and the field carries
none of it. 🛑 **The irreversibility runs the wrong way for optimism**: if the axis
turns out to be open-ended, there is no migration, for the same reason G20 gives —
re-chaining means rewriting the records the chain exists to prove were not rewritten
(`model/canonical.ts:27-35`).

**One sequencing consequence.** (c) requires an anchor delivery path, and there is
none. That is not a reason to delay the field — (a) and (b) are decisions, not code,
and the field must land in this window — but a G row that claims the anchor set is a
completeness witness while the anchor reaches nobody is a control that exists only on
paper. **State (c) as owed work with a named blocker, or the row overclaims.**

---

## 6. What I could not verify

- 🛑 **Whether any candidate axis is operationally adequate.** I can state what an
  axis must *not* be (§2.4, §5a). I cannot state which one the write path can
  actually route on, because **there is no write path** — no audit writer, no
  chain-head table, no migration for either stream. Whoever writes it must confirm
  that the routing function is total and that it does not itself need the head row it
  was introduced to avoid locking.
- 🛑 **The right value of N.** It is a contention measurement and nobody has taken
  one. `PRODUCT.md`'s discipline applies: I will not invent the number. §4 argues
  only that small beats large, which is a direction, not a value.
- 🛑 **The anchoring cadence.** Same reason. It trades tail exposure against
  control-plane write volume and neither has been measured.
- ⚠️ **Whether the two chained streams should share an axis.** `AuditEvent` and
  `DataAccessEvent` have different write shapes and a partitioning that suits one may
  not suit the other. I did not analyse this and no document does.
- ⚠️ **`docs/access-and-agency.md` §11.7 carries three stale citations** —
  `governance.ts:906`, `:934`, `:946` and `domain.ts:2625` for `RecordChain`,
  `ChainAnchor`, `DataAccessEvent.chain` and `AuditEvent.chain`, which are at
  `model/governance.ts:1110`, `:1138`, `:1158` and `model/domain.ts:3939`.
  `docs/HANDOFF.md:872` carries the same pair. **Recorded, not fixed** — that file is
  not this document's to edit and a concurrent session is editing both.

## 7. What needs somebody other than an engineer

- ⚖️ **A cryptographer, and only if (a) is refused.** If the owner needs an
  open-ended partition axis for reasons this verification cannot see, then closing
  §2.2 requires binding the set of partitions together with a **single per-cycle
  commitment over all partition heads** — the accumulator / Merkle-root class of
  construction. **I am naming the class and stopping there.** This repository has
  chosen no such construction, `ChainAnchor` is a flat row with one `headHash`, and
  designing one here would be inventing a guarantee, which is the same failure
  `PRODUCT.md` forbids for figures. If that road is taken it is a decision with its
  own G number and its own review, not a field on an existing type.
- ⚖️ **Counsel, on one narrow question.** Whether an audit trail offered as evidence
  of compliance carries an implied representation of **completeness** — because §3b's
  gap is precisely a completeness gap, and if the answer is yes, then (a) is not a
  design preference but an obligation. I have no view and the record has no material
  on it.
- **Nothing here needs a cryptographer if (a) holds.** That is worth saying plainly:
  the fix is a type-level enumeration and a discipline about anchoring empties. It is
  the cheapest possible answer and it is available only inside this window.

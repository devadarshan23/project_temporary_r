# RED — the attack on `stateless-green-resumable-work.md`

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY: NO.** Nothing here is a decision. `docs/HANDOFF.md` §3 outranks every line.
> **Written 9 Aug 2026 evening, AFTER its green counterpart, with NO ADJUDICATION BETWEEN THEM.**
> The green document had no red pass when it was written (`docs/INDEX.md:403` — *"🛑 NO RED PASS AND
> NO ADJUDICATION"*) and it still has none: **this file is one half of a disagreement, not its
> resolution.** Where green and red conflict, neither wins until the owner rules.
>
> **The owner's ruling is an INPUT and is not attacked here:** *"I want the application stateless so
> it can scale without a node dependence and for ease of retry in case a node fails. That means
> everything that carries state, including session data or other user artifacts, must be committed to
> the database."* Every finding below attacks the DESIGN — a cost it hides, or a property it claims
> and does not have.

**Discipline.** Every `file:line` below was opened in this session. Where I could not verify
something I say **not verified**. **No number is invented.** Two attacks I had drafted are recorded
as **STRUCK** at the end, by name, because their premises were false at the tree — that section is
not decoration, it is the standard this document asks to be held to.

---

## 0. The one-line verdict

**The green design is right about what to make durable and wrong about what to key it on.** Its
central insight — the durable artefact is the pinned input plus the stored verdicts, never the folded
state — survives every attack I could mount. Its central mechanism does not: it diagnoses that
`(runId, requestOrdinal)` is a **position in a derived array**, stores the two content witnesses that
would fix it, and then **keeps the position as the only lookup key** and uses the witnesses solely to
make the failure loud. Five things it claims to have, it does not have.

| # | Rank | One line |
|---|---|---|
| 1 | 🛑 BLOCKER | `RunPlan` pins the scalars and omits every *value* that decides the fold — `pairing`, `strategyBindings`, both `PopulationBinding`s |
| 2 | 🛑 BLOCKER | The applied order of stored verdicts is load-bearing and the design leaves it to the row order |
| 3 | 🛑 BLOCKER | The row counter and the idempotency `UNIQUE` are mutually destructive: a **deduped** replay leaves exactly the gap the counter exists to prevent, and the design's own fixture cannot see it |
| 4 | 🛑 BLOCKER | A lapsed lease is not a death. No fence, no renewal, and the settle does not check the lease — so a slow call is double-paid **by construction**, not by crash |
| 5 | 🛑 BLOCKER | `attempts_exhausted` has no path to the residue: the new arm is a control over zero call sites |
| 6 | ⚠️ SERIOUS | The witness is over `ItemRef`s, and an `ItemRef` is stable under exactly the change the design fears; the reason given for rejecting the stronger witness is false |
| 7 | ⚠️ SERIOUS | Nothing redeems the grant on the resume path. `redeemAuthorization()`'s expiry refusal exists and gets zero call sites |
| 8 | ⚠️ SERIOUS | The CLAIM has no actor, and it is the statement that writes the money counter |
| 9 | ⚠️ SERIOUS | The per-plane counter is priced with a per-**tenant** number, on an inherited citation that does not resolve to the table |
| 10 | ⚠️ SERIOUS | The reaper has no tenant, and its no-op is indistinguishable from its success |
| 11 | ⚠️ SERIOUS | *"Crash-resume and `RunTrigger.rerun` are the same code path"* is false, and the difference is money |
| 12 | ⚠️ SERIOUS | §4.3's precedent is imported with its stated precondition inverted |
| 13 | 📄 NOTED | `_WorkBoundDefectHoldsNoText = never` is an assertion-shaped alias that holds vacuously |
| 14 | 📄 NOTED | The POISON statement is scoped to neither a run nor a bound |
| 15 | 📄 NOTED | T-1 governs this surface and **is not in the tree**; and the shape it is reported to ask for is unavailable to the data-plane role by design |

---

## 1. 🛑 BLOCKER 1 — `RunPlan` does not pin what the fold reads

**The claim under attack.** `RunPlan`'s own header: *"EVERYTHING THE FOLD READS, PINNED AT RUN
ADMISSION AND READ BACK VERBATIM ON EVERY ATTEMPT"*, and R-1's precondition 2: *"Everything the fold
reads pinned to the run."*

**The premise, at the tree.** `SetReconciliationInput` (`model/reconciliation.ts:2589`) carries
**four** members that are neither scalars nor classification collections:

| Member | | What it decides |
|---|---|---|
| `left` / `right: PopulationBinding` | `model/reconciliation.ts:950` | `normalisation: IdentifierNormalisation` (`:953`), `counterparty: FieldPath \| null` (`:968`), `description: FieldPath \| null` (`:980`) |
| `pairing: PairingSpec` | `model/reconciliation.ts:2610` | the strategies and their declared order — the fold itself |
| `strategyBindings: readonly StrategyBinding[]` | `model/reconciliation.ts:1372` | `amountTolerance: Tolerance \| null` (`:1374`), `amountAnchor` (`:1376`) |

`RunPlan` pins **none of the four.** It pins `definitionId`, `definitionVersion`, the document id
arrays, `obligationSide`, `toleranceDirection`, `readerCandidateCap`, `similarityMaxChars`,
`similarityMetric`, `subsetSumBound`, `fieldClassification`, `modelPromptEligible`. Those are the
eight bounds and the two collections its own argument enumerates — **and the argument was
enumerated from the wrong list.** It reads `SetReconciliationInput` for *"eight bounds and two
classification collections FROM THE CALLER"* and stops there, so the members that decide the
strategies are invisible to it.

**This is §5.1 in its exact shape:** a rule keyed on a convenient landmark (the scalar bounds,
because they are easy to store and easy to canonicalise) instead of the property it protects (the
fold's total input). And the green document **knows** the tolerances exist — §2.2's blocked-digest
note says *"The per-strategy tolerances the fold reads carry `Money`"* — it uses that fact to explain
why the plan cannot be hashed and then does not put the tolerances in the plan. The `Money` obstacle
is why they are missing; it is not a reason they may be missing.

**The node-death sequence.**

1. Node A admits run `run_x`. `RunPlan` is written: document ids, bounds, classification.
2. Node A folds. 400 left items reach the residue; `buildReaderRequests`
   (`model/reconciliation.ts:2392`) emits 37 requests, ordinals 0–36. The rows are inserted, the run
   moves to `awaiting_readers`.
3. Node A dies. 12 verdicts are settled, 25 outstanding.
4. An FDE widens `strategyBindings[2].amountTolerance` from exact to a band — a normal act, in the
   pack, on the seam G56 puts with the FDE, with **no `definitionVersion` bump anywhere in the
   design's control set**.
5. Node B claims the run, reads the plan back, **compares it structurally and it MATCHES** — the plan
   never held the tolerance.
6. Node B re-folds. The wider band closes 60 more pairs in pass 3. The residue is now 340 items and
   the request array is 31 entries. Ordinals 0–36 renumber against a different array.
7. `bindStoredOutcomes` fires. Best case: 12 `subject_moved` defects, `ok: false`, and by §3's own
   rule *"the CALLER MUST NOT RESUME"* — the run fails, and **12 paid model calls are stranded on
   rows nothing can ever bind again.** Worst case, and it is the reason this is a BLOCKER rather than
   a SERIOUS: see BLOCKER 6 for the ordering under which the witnesses match anyway.

**What it costs.** R-1's whole resume story is *"re-running the pure fold over the same input"*. If
the plan is not the input, the sentence is not true, and the run's own `definitionVersion` cannot
save it — D2 is gated and unbuilt, which the green document itself records (*"what a pinned version
resolves to is undefined today"*, its §6 collision table, citing
`docs/build/phase-one-plan.md:130-131`).

**The closing control.** `RunPlan` carries `pairing`, `strategyBindings` and both
`PopulationBinding`s **verbatim**, or the design must say in one sentence that the fold's strategies
are unpinned and that a resume may fold differently from its first attempt. There is no third
option. The `Money` inside `Tolerance` makes this harder — it blocks the digest under G111 — and
**"hard to canonicalise" is not "safe to omit"**: a stored value nobody can hash is still a stored
value that can be compared field by field, which is the weaker control §2.2 already accepts for the
plan as a whole.

---

## 2. 🛑 BLOCKER 2 — the applied order of stored verdicts is load-bearing, and nothing states it

**The premise, at the tree, and it is the load-bearing one.** `applyReaderVerdicts`
(`model/reconciliation.ts:2451`) is a **sequential fold with a moving state**:

- `let current = state` (`:2456`)
- per outcome: `const subjectResidual = residualOf(current, subjectKey)` (`:2489`) and the candidate's
  residual on the next line
- `if (applied.ok) current = applied.state` (`:2507`)

So the residuals are re-derived from the **partially updated** ledger on every iteration. Two
outcomes may legitimately name the same right-hand candidate — `buildReaderRequests` selects
candidates by `residualOf(...)` equal to the subject's `gross` (`:2413-2414`) and nothing prevents
one right item from being an amount-identical candidate for two different left subjects. Whichever
outcome is applied **first** consumes the residual; the second finds it changed and does not
allocate. **The order of the `outcomes` array changes the ledger.**

**Where the design loses control of that order.** `bindStoredOutcomes` builds `outcomes` by iterating
**`stored`**, not `requests`:

```ts
  for (const row of stored) {          // ← the order of the DB rows
    …
    outcomes.push(row.outcome)
  }
```

and `SetReconciliationInput.storedReaderOutcomes` is `readonly StoredReaderOutcome[]` — a
caller-supplied array with no stated ordering. The design writes an `ORDER BY run_id,
request_ordinal` into the **CLAIM** statement, with the comment *"deterministic, reproducible"* — and
writes **no `SELECT` for the stored rows at all**, so the one statement whose order is semantically
load-bearing is the one statement that was never written. A Postgres `SELECT` with no `ORDER BY`
returns rows in whatever order the plan produces; a partial-index scan, a seq scan after a vacuum,
and a parallel scan need not agree.

**This is A2's hazard reproduced one layer in, inside the fix for A2's hazard.** The green document
correctly identifies that the DOCUMENT array needs a stated total key
(`docs/build/ingestion-pipeline.md:326`, `:374`) and stores `leftDocumentIds` / `rightDocumentIds` to
supply one. It then hands the VERDICT array to an unordered read.

**The node-death sequence.**

1. Two left subjects, `L1` and `L2`, both with an amount-identical right candidate `R9`. Requests
   ordinal 4 (`L1`) and ordinal 9 (`L2`).
2. Both settle. Both verdicts name `R9`.
3. Node A resumes, reads rows in physical order 4, 9. `L1` takes `R9`. `L2` goes to the residue.
4. Node A dies before the terminal write. Node B resumes, reads rows in physical order 9, 4 — same
   rows, same run, same plan. `L2` takes `R9`. `L1` goes to the residue.
5. **Two different ledgers and two different audits from one set of stored verdicts.** Nothing
   refuses; `bindStoredOutcomes` returns `ok: true` both times; `checkPostconditions`
   (`model/reconciliation.ts:2681`) passes both, because both are internally consistent partitions.

**And it silently defeats the design's own headline fixture.**
`tests/scenarios/resume-determinism.test.ts` is specified as *"fold twice with
`storedReaderOutcomes: []`"* — an empty array, which is trivially order-stable — *"then fold with a
synthetic stored outcome"*, singular. **Neither case has two stored outcomes**, so the fixture the
design says *"R-1's entire resume story rests on"* cannot observe this at all. §5.6: a control that
passes while asserting nothing.

**The closing control.** `bindStoredOutcomes` must iterate `requests` and pull from a
`Map<number, StoredReaderOutcome>` — never iterate `stored` — so the applied order is the request
order by construction and the row order cannot reach the ledger. Add a third case to the fixture:
two stored outcomes contending for one candidate, shuffled, deep-equal results.

---

## 3. 🛑 BLOCKER 3 — the sequence counter and the dedup key destroy each other

**The green document is right about `nextval` and I am not attacking that.** `model/billing.ts:158`
— *"a gap in this sequence is detectable rather than merely absent"* — is the exact sentence that
makes a non-transactional sequence wrong, and refusing the obvious implementation is the best call in
its §2.10.

**The replacement does not hold, and the reason is the OTHER control in the same table.** §2.10
specifies both:

- `UsageRecord.sequence` from a counter row:
  `UPDATE dp_usage_sequence SET next_sequence = next_sequence + $n … RETURNING next_sequence - $n`,
  *"inside the same transaction as the insert"*;
- and, one row above, `UNIQUE (tenant_id, idempotency_key)` with **`ON CONFLICT DO NOTHING`** —
  *"a repeat is a no-op, not a second charge"* (§3's refusal table).

**A conflict is not an abort.** `ON CONFLICT DO NOTHING` inserts zero rows and the transaction
commits normally. So the block of sequence numbers is allocated and committed with **no rows against
it** — a permanent hole in a monotonic per-plane sequence, indistinguishable from a lost record, which
is precisely and only the thing the field exists to make detectable. The two controls in adjacent rows
of one table each defeat the other's purpose, and **a replay is not the exception on this surface —
at-least-once is the design's stated default** (§2.10: *"At-least-once is the default everywhere"*).

**The design's own fixture cannot see it.** `tests/db/reader-queue.test.ts` is specified to assert
*"an **aborted** insert leaves **no gap**"*, and the mutation table's matching row is *"replace the
counter row with `nextval` → the aborted-insert test finds a gap."* An **abort** rolls the counter
`UPDATE` back with everything else, so the fixture passes under both the correct and the broken
implementation of the case that actually occurs. §5.6, inside the control written to close §5.6, in
the one place the green document says *"is the one that proves the counter is a ROW and not a
`SEQUENCE`"*.

**The node-death sequence.**

1. Worker A claims ordinal 12. Model call succeeds, `providerRequestId = pr_abc`. Settle transaction
   opens: it updates the attempt row **and** inserts two `dp_usage_record` rows keyed
   `pr_abc#input_tokens` and `pr_abc#output_tokens` (`tokenMeterFacts`, `model/reconciliation.ts:2558`),
   allocating sequences 5000 and 5001.
2. Commit succeeds. Node A dies immediately after, before acknowledging anything upstream.
3. The fan-in re-runs on node B. The fold calls `applyReaderVerdicts`, which pushes
   `...tokenMeterFacts(outcome.usage)` for **every** bound outcome (`:2463`) — including the one
   already metered, because the idempotency key is what deduplicates it and not the fold.
4. Node B's transaction allocates sequences 5002 and 5003 from the counter row, then inserts, then
   hits both unique keys and does nothing. **Commit.**
5. The plane's sequence now reads 5000, 5001, **[5002 missing], [5003 missing]**, 5004…
6. The gap check — the only reason `sequence` exists — reports two lost billable events. There were
   none. The number of false alarms scales with the number of resumes, so the check becomes noise and
   is turned off, and then a real loss is invisible. **The control degrades into its own opposite.**

**The closing control.** Never allocate a sequence for a row that may not insert. Either
`INSERT … ON CONFLICT DO NOTHING RETURNING id` first, count what actually landed, and allocate
exactly that many; or drop `sequence` from the insert and fill it with a second statement over the
returned ids, in the same transaction. Then the fixture must be **conflict**, not abort: insert the
same `idempotencyKey` twice across two transactions and assert `max(sequence) - min(sequence) + 1 =
count(*)` for the plane.

---

## 4. 🛑 BLOCKER 4 — a lapsed lease is not a death, and there is no fence

**What the design has.** A CLAIM that takes a row when
`(lease_expires_at IS NULL OR lease_expires_at < now())`; a SETTLE guarded by
`AND outcome_kind IS NULL`; a lease clock that is the database's.

**What the design does not have, and I searched for each.**

1. **No renewal.** There is no `UPDATE … SET lease_expires_at = now() + …` for a live holder anywhere
   in §2.8. A worker whose model call outlives `WorkBound.leaseSeconds` cannot extend it.
2. **No fence.** There is no claim token, epoch or attempt id on the row, and the SETTLE names
   neither: `WHERE run_id = $1 AND request_ordinal = $2 AND outcome_kind IS NULL`. A worker whose
   lease lapsed **is still permitted to settle** — the guard tests whether *someone* has settled, not
   whether *this* worker still holds the claim.
3. **No liveness check.** `lease_expires_at < now()` is the design's entire definition of "the holder
   is gone". A GC pause, a slow provider, a retried transport hop (`model/reconciliation.ts:2260` —
   *"At most one retry on a TRANSPORT failure"*, which doubles the wall clock of one attempt) all
   produce a lapsed lease held by a living worker.

**So a double-paid model call is not a crash path. It is the normal path for any call slower than
`leaseSeconds`,** and which of the two verdicts becomes durable is decided by arrival order rather
than by authority. That is fatal to R-1's *"byte-identical to a rerun"*: the fold is deterministic
given the stored verdicts, and **which verdicts get stored is a race.**

**And the window the design must fit into may be empty.** `validateWorkBound` ceilings
`leaseSeconds` at `MAX_AUTHORIZATION_SECONDS[resourceClass]` — `tenant_data: 900`
(`model/access.ts:1517`, `:1530`). Correctness against duplicate calls requires
`leaseSeconds > (provider timeout × 2 for the permitted transport retry) + settle latency`. The
design states the upper bound, derives it beautifully, and **never states that the lower bound
exists** — so an FDE setting `leaseSeconds: 60` under O-8's *"FDE-set configuration, refusing on
absence"* posture passes `validateWorkBound` with zero defects and duplicates every call that takes
61 seconds. `validateWorkBound` returns *every* defect rather than the first, which is right; it has
no arm for the only defect that costs money.

**The node-death sequence — and note that no node dies.**

1. `leaseSeconds = 60`. Worker A claims ordinal 12 at T+0. `attempts` → 1.
2. Model call is slow: a transport failure at T+45, one permitted retry, second call returns at T+95.
3. At T+61 worker B claims ordinal 12 — the row is unsettled and the lease lapsed. `attempts` → 2.
   Worker B calls the model. **Two paid calls, two distinct `providerRequestId`s.**
4. B settles at T+80. A settles at T+95 and gets `rowCount 0`, so A's transaction rolls back —
   including A's meter inserts. **A's tokens are never metered.** The design's discrepancy counter
   catches it (`attempts` 2 minus 1 settled = 1 spent-and-unmetered), which is the design working.
5. But the durable verdict is **B's**, not A's, and if the two models disagreed — `candidate` versus
   `several` — the ledger the tenant sees was chosen by network latency. Nothing anywhere records
   that a second opinion existed and was discarded.

**The closing control.** Three things, none optional: a `claim_id` (or `attempts` value) written at
claim and required by the settle, so a lapsed holder's write is refused rather than merely losing a
race; a renewal statement for a live holder; and a `WorkBoundDefect` arm asserting
`leaseSeconds > providerTimeoutSeconds × (1 + permittedTransportRetries)`, with the provider timeout
becoming a stated, refusing bound on `WorkBound`. **The lower bound cannot be derived from anything
in `model/` and must not be invented** — it is a Q4 line, and Q4 as written does not ask for it.

---

## 5. 🛑 BLOCKER 5 — `attempts_exhausted` has no path to the residue

**The claim under attack.** §2.3: *"It reaches the residue through the arm that already exists:
`ResidueCause.reader_refused` (`model/reconciliation.ts:2095`). **No new residue vocabulary.**"* And
§3's refusal table: *"the subject stays in the residue under `ResidueCause.reader_refused`. It is
never dropped."*

**The premise, at the tree.** The residue is built from **state alone**. In
`runSetReconciliation`'s residue block the cause is derived at `model/reconciliation.ts:2928` —
`let cause: ResidueCause = { kind: 'no_strategy_paired' }` — and then narrowed by
`ambiguousKeys`, `oversized`, `exhausted` and the settlement kind, across `:2924-2952`. **No reader
cause is reachable from that code at all.** The reader causes live only on
`ReaderApplication.unresolved` (`model/reconciliation.ts:2436`), the third member
`applyReaderVerdicts` returns, and **nothing in the tree reads it** — consistent with G118, which
records that `applyReaderVerdicts` has zero production callers (`docs/HANDOFF.md:844`).

**The design's stated call order does not close it.** §2.4: *"passes → `buildResidue` →
`buildReaderRequests` → `bindStoredOutcomes` → `applyReaderVerdicts` → `buildResidue` again →
`checkPostconditions`."* The second `buildResidue` runs over the post-verdict state, so an item the
reader refused is re-derived as `no_strategy_paired` or `obligation_not_fully_settled` — **the
truthful cause is computed and thrown away**, and the new `attempts_exhausted` arm is a declaration
no row will ever carry. That is §5.6 in the arm's own commit.

**And the obvious repair breaks a postcondition.** Merge `unresolved` into the second residue and the
same item is present twice — once from `buildResidue` over state, once from the merge — so
`checkPostconditions` counts it in `seen` twice and raises `item_in_residue_twice`
(`model/reconciliation.ts:2694`), which §3's own table makes a run-failing condition. **The design
must state which of the two it is doing, and it states neither.** This is the sharpest instance of a
general problem with §2.4: it specifies an extraction (`buildResidue`) and a call order, and does not
specify how the two independent sources of a residue entry are reconciled — which is the whole
difficulty of putting `applyReaderVerdicts` into the fold, and the reason G118 calls the seam a gap.

**The node-death sequence.** Ordinal 12 is claimed `maxAttempts` times across four node deaths and
never settles. The POISON statement writes `refusal_kind = 'attempts_exhausted'`. The run resumes,
`bindStoredOutcomes` binds it as a stored refusal, `applyReaderVerdicts` pushes it to `unresolved`,
`buildResidue` re-derives the item as `obligation_not_fully_settled`, and the residue row a finance
user opens says **"this obligation was not fully settled"** where the truth is **"we tried to read
this four times and gave up."** G105's own distinction — a match and a judgement must not be recorded
as the same kind of event — inverted by the plumbing rather than by a decision.

**The closing control.** `buildResidue` must take the reader dispositions as a parameter and **own the
precedence**, so a residue entry has exactly one source and the reader cause wins where it exists.
Then a fixture: an item with a stored `attempts_exhausted` refusal appears exactly once in the
residue, with `cause.kind === 'reader_refused'`, and `checkPostconditions` returns empty.

---

## 6. ⚠️ SERIOUS 6 — the witness is over refs, and refs survive the change it fears

**The premise, at the tree.** `itemKey(side, ref)` is
`` `${side}:${id.length}:${id}:${line}` `` (`model/reconciliation.ts:809`) over an `ItemRef` of
`sourceDocumentId` and `lineIndex`. Both witnesses — `subjectKey` and `candidateWitnessOf`, which
length-prefixes `itemKey('right', c.ref)` — are therefore functions of **position in a document** and
of nothing else. They witness no amount, no residual, no identifier and no description.

**The design's argument for stopping there, quoted, because it is the part that fails.** §2.3's
rejected alternative: *"a witness over the prompt strings would also catch a changed identifier under
an unchanged ref. It was refused because it would put a customer identifier in a new table to detect
a case R5(ii)'s content-hash keying already prevents."*

**R5(ii) does not prevent that case.** Content-hash keying on a `SourceDocument`
(`docs/build/ingestion-pipeline.md:310-312`) makes re-delivered **bytes** mint a new id. But
`identifierForPrompt` is not bytes: `buildReaderRequests` takes it from the admitted item's
normalised `identifiers` (`model/reconciliation.ts:2417`), and normalisation is
`PopulationBinding.normalisation: IdentifierNormalisation` (`:953`) — **caller-supplied
configuration, which BLOCKER 1 establishes `RunPlan` does not pin.** Change the normalisation and
every byte in every document is unchanged, every `sourceDocumentId` is unchanged, every `lineIndex`
is unchanged, every `itemKey` is unchanged — **and the string the model was shown is different.** The
refused alternative was refused on a premise about document bytes, applied to a value produced by
configuration.

**When the candidate witness matches anyway.** Candidate selection is an **equality** test:
`compareMoney(residual, item.gross) === 0` (`model/reconciliation.ts:2413-2414`). Any change that
scales or shifts both populations identically — a currency exponent correction, a normalisation
applied to both sides, a `toleranceDirection` that alters both residuals in step — preserves the
equality, preserves the candidate refs, preserves their order, and therefore **preserves the
witness**. `bindStoredOutcomes` returns `ok: true`, the stored verdict binds, and `applyAllocation`
moves an amount the reader never saw against a pairing described to it by a string that no longer
exists. **That is the sentence §2.3 opens with, produced by §2.3's own control.**

**The closing control, and it preserves the privacy instinct.** The privacy argument for keeping
`identifierForPrompt` out of the table is correct and I am not attacking it — `MatchGroup.keyValues`
carries a purge date for exactly this reason (`model/domain.ts:2774-2776`). Two ways to keep it and
close the hole: pin `normalisation` in `RunPlan` (BLOCKER 1 requires this anyway), so the identifier
is a function of pinned inputs and the ref witness becomes sufficient **for a stated reason**; or
witness a keyed digest of the prompt strings, which is not a customer identifier and needs no purge
date. Do one, and say which. Do not leave the witness resting on a premise about a different subsystem.

---

## 7. ⚠️ SERIOUS 7 — nothing redeems the grant, and the refusal already exists

**The refusal is in the tree and it is total.** `redeemAuthorization()` (`model/access.ts:1753`)
denies `authorization_expired` on `grant.expiresAt <= principal.now` (`:1792`), with the comment
noting `<=` rather than `<` so *"a grant expiring exactly now is expired"*. `expiresAt` is *"Required,
never null"* (`:1593`). This is the control that would answer Q1 mechanically.

**The design gives it zero call sites.** `reader_request_attempt.authorization_id` is `text NOT NULL`
(§2.7), stamped once, in the `running → awaiting_readers` transition. The CLAIM statement returns
`a.authorization_id` and **nothing in §2.8, §2.10 or §2.11 redeems it**; there is no step between
CLAIM and the model call that reads the grant row at all. So a resume an hour later executes a paid
call on tenant data under an expired authorisation and **nothing refuses**.

**And it undercuts a property the design claims for free.** §1.2(a): *"a fired employee's in-flight
acts stop on the next call, not at the next expiry … The worker carries one opaque id, re-derives the
authority against the row, and a withdrawal lands on the next hop."* **There is no next hop in this
design.** The re-derivation is a property of `redeemAuthorization()`, not of carrying an id, and the
design carries the id without calling the function. `docs/HANDOFF.md:847` — G121 — records its cost as
*"withdrawal stops future draws, not live ones"*; that limit is about acts **already dispatched**, and
a claim made an hour after arming is not already dispatched. **The design inherits a stated limit to
cover a case the limit does not cover.**

**The node-death sequence.** Arm at 09:00, `tenant_data` grant expires 09:15. Node A dies at 09:04
with 25 ordinals outstanding. The queue is drained; nothing is claimable until a worker sweeps at
10:30. Node B claims 25 rows, reads `authorization_id`, makes 25 paid model calls, settles 25 rows
with that grant id on every `dp_usage_record` (`model/billing.ts:223`). **Twenty-five acts and
twenty-five billable events attributed to an authorisation that expired 75 minutes earlier**, and the
audit trail says they were authorised.

**The closing control.** The executor calls `redeemAuthorization()` before the model call and refuses
**the item**, not the run, on `authorization_expired` — the queue row stays unsettled and claimable,
so re-arming a grant makes it drainable. Q1 then stops being a blocker on the fan-out: whichever way
the owner rules on minting-per-attempt versus refusing, the mechanical check is the same and it
already exists.

---

## 8. ⚠️ SERIOUS 8 — the CLAIM has no actor, and it writes the money counter

§1.2(b) names the reaper's actor with care: `AUTHORIZATION_MAY_BE_ABSENT` (`model/governance.ts:1232`)
has `system: true` (`:1237`), and `authorizationIsWellFormed()` (`:1254`) admits a null
`authorizationId` for it. **The claimer is never named.** And the CLAIM is the statement that
increments `attempts`, which §2.11 then elevates into the design's only instrument for lost money:
*"`attempts` minus settled-outcomes on a finished run is a countable, queryable number of
spent-and-unmetered calls."*

So the number that stands in for a compensating instrument on an append-only table is written by an
actor the design does not identify, on a path where `AUTHORIZATION_MAY_BE_ABSENT.agent` is `false`
(`model/governance.ts:1236`) and where `model/reconciliation.ts:2145-2147` already records that *"a
model call made mid-run, before any exception exists, has NO CONSTRUCTIBLE AuditActor today"* — with
the tempting fix, `{ kind: 'system' }`, named there as *"laundering an agent read into the machinery
variant."*

The design is honest that the act is unrecordable (§7 item 2: *"a durable queue for an unrecordable
act is a durable queue for an unrecordable act"*). What it does not notice is that it then **builds a
financial control on top of the unrecordable act**, so the gap is no longer only an audit gap: the
discrepancy counter is a row written by nobody in particular. **This is not a new gap and must not be
presented as one** — it is the DP-6 question the record already parks — but §2.11 should say that its
counter inherits it, and Q2 should name the claim as well as the read.

---

## 9. ⚠️ SERIOUS 9 — the counter is priced with a per-tenant number, on an inherited citation

**The design's pricing, quoted.** §2.10: *"Cost: it serialises meter writes per plane.
`docs/build/event-architecture-recommendation.md:320` puts the volume at 'under 1 row/sec average.
Unremarkable' — quoted from that document, which sources `persistence-design.md:213-217`; I did not
measure it."*

**Two things are wrong and one of them is arithmetic.**

1. **The inherited citation does not resolve to the table.** `docs/persistence-design.md:213-217` is
   about a unique index on `idempotencyKey` and the start of §2.6 Evaluation. The volume table is at
   `docs/persistence-design.md:295-296`: *"`PolicyEvaluation` | ~1.41M"*, *"`UsageRecord` | ~944k |
   One row per metered event"*. The green document re-quoted a citation from another document instead
   of resolving it — exactly the class `docs/HANDOFF.md` §7 records as invisible to
   `tools/check-citations.mjs`, because a drifted citation still resolves (`tools/check-citations.mjs:17-19`).
2. **The unit is wrong, and this is §5.7.** The table's figures are **per tenant-month**. The counter
   row is **plane-scoped** — the design says so itself: *"The counter table is plane-scoped, not
   tenant-scoped, so it is not under RLS."* In the hosted topology one plane serves many tenants, so
   the contended rate is the **sum over tenants on the plane**, and a per-tenant rate cannot bound
   it. The figure also predates G120: the volume table counts *one row per metered event* against a
   world with no reader fan-out, and G120's distributed map produces **two token meters per residue
   row read** (`tokenMeterFacts`, `model/reconciliation.ts:2558`) plus the run meter (`:2576`). The
   design multiplies the load and prices it with the number from before the multiplication.

**What it costs a tenant, stated without inventing a figure.** Under G101's transaction-mode pooling
every query sits inside an explicit transaction, and a row lock is held to COMMIT. The design puts
the counter `UPDATE` and the **terminal ledger write** in the same transaction (§2.10, row 6: *"one
transaction: insert the rows, then `UPDATE run_execution …`"*). Therefore:

- **Concurrency on the counter row is exactly one transaction per plane at a time.**
- **The duration of that exclusive hold is set by the largest terminal write any tenant on the plane
  produces** — bounded only by `WorkBound.maxResultRowsPerTransaction`, whose number is Q4 and
  unstated.
- **So one tenant's largest reconciliation blocks every other tenant on that plane from recording any
  metered event for the duration of that write.** A tenant's metering latency is a function of its
  noisiest neighbour, in a design whose stated purpose is that a node's failure is nobody's problem.

**The closing control.** Take the counter lock **last and alone**: allocate sequences in a short
transaction that touches nothing else, or move `sequence` assignment to the shipper, which already
reads `ORDER BY sequence` (`docs/build/event-architecture-recommendation.md:297`) and is one process
per plane by construction. Either way, re-derive the volume from `docs/persistence-design.md:295-296`
**times the plane's tenant count times G120's per-row meter multiplier**, and cite that line rather
than the one it inherited.

---

## 10. ⚠️ SERIOUS 10 — the reaper has no tenant, and its no-op looks like success

The reaper is the **only** mechanism in the design that recovers a run whose node died mid-fold:
`UPDATE run_execution SET status = CASE … WHERE status = 'running' AND lease_expires_at < now()`. It
carries no tenant predicate, and §2.9's R-3(d) — *"the worker sweeps tenants from the
downward-published registry, and every queue read happens inside `withTenantScope()`"* — is argued for
the **worker**, never for the reaper.

Both readings fail differently and neither is stated:

- **Outside `withTenantScope()`:** `app.tenant_id` is unset, the policy denies on NULL
  (`db/migrations/0001_tenancy_and_rls.sql:158-162`), and the statement updates **zero rows —
  permanently, silently, while reporting success.** Every dead run stays `running` forever, its rows
  unclaimable because the run never returns to `queued`. The design's entire node-death story becomes
  inert and no statement anywhere errors. This is G100's deny-on-NULL working exactly as designed and
  turning a recovery mechanism into a no-op — the same trap the record already names for a forgotten
  transaction, arriving through a component that has no session by nature.
- **Inside `withTenantScope()`:** it inherits the O(tenants) sweep, and the design's §6 cost 4 prices
  the *worker's* sweep without mentioning that the reaper needs the same one, at the same cadence,
  with a fairness rule §7 item 6 says nobody has written.

**And the two outcomes are the same value.** `rowCount 0` means *"nothing needed reaping"* and *"I am
scoped to nobody"*, and the design's whole control vocabulary is `rowCount`. A control whose success
and whose total failure emit the identical signal is not a control.

**The closing control.** The reaper is an enumerated sweep over the registry with a per-tenant
`withTenantScope()`, and it reports *"swept N tenants, reaped M runs"* — two numbers, so N = 0 is
distinguishable from M = 0. Add the mutation: run the reaper with the registry empty and assert the
sweep reports zero **tenants**, not zero rows.

---

## 11. ⚠️ SERIOUS 11 — crash-resume and `RunTrigger.rerun` are not the same code path

**The claim, twice.** R-1: *"it makes crash-resume and `RunTrigger.rerun` (`model/domain.ts:2763`)
the same code path instead of two."* §9 repeats it.

**The premise, at the tree, and it refutes the claim.** `RunTrigger` is *"What DID start a run.
Recorded on the run"* (`model/domain.ts:2756`), and the rerun arm is
`{ kind: 'rerun'; ofRunId: RunId; reason: 'definition_changed' | 'rule_changed' | 'data_corrected' }`
(`:2763`). It carries `ofRunId` **because a rerun is a different run with its own `id: RunId`**
(`model/domain.ts:2700-2701`). A crash-resume is the **same** `runId`.

Since every stored verdict is keyed `(tenant_id, run_id, request_ordinal)`, a rerun's
`storedReaderOutcomes` is empty **by construction**, and therefore:

- every reader request in a rerun is **asked again and paid for again**;
- including under `reason: 'rule_changed'`, which is the single case where most verdicts are still
  perfectly valid for their pair — the model was asked "does this description mean this
  counterparty", and a tolerance change does not alter the answer;
- and the rows that would let a rerun reuse them **already exist**: `subject_key` and
  `candidate_witness` are the content key. The design stores the content key and then keys the table
  on the position, so the reuse it enables is unreachable.

**This is where G120's key costs real money, and I am challenging it in writing with the quote rather
than relitigating it.** G120 requires *"`ReaderOutcome` persisted keyed by `(runId,
requestOrdinal)`"* (`docs/HANDOFF.md:846`). G121 requires *"every reader act carrying it plus its
`requestOrdinal`"* (`:847`) — which asks the ordinal to be an **addressable label on an act in the
audit trail**, and says nothing about primary keys. The two are separable: `(tenantId, subjectKey,
candidateWitness)` can be the identity of a **verdict** while `requestOrdinal` remains the label on
the **act**. That reading satisfies G121 verbatim, satisfies G120's purpose (a rerun replays stored
verdicts rather than re-asking) better than G120's letter does, and dissolves BLOCKERs 1, 2 and 6
together with cost 5's irreversibility. **It is not mine to take.** It is one G-row amendment with a
quote attached, and the green document should have asked for it as Q9 instead of accepting the
positional key and building two witness columns to survive it.

**The closing control, if the key does not move.** Delete the claim. Say instead: *a crash-resume
replays stored verdicts; a rerun pays for every reader call again, and `reason: 'rule_changed'` is
the expensive case.* Then price it, because a rerun after a rule change is the ordinary operator act
— `model/domain.ts:2734-2736` records that *"you need manual to re-run after a rule change"*.

---

## 12. ⚠️ SERIOUS 12 — §4.3's precedent is imported with its precondition inverted

§1.1's fourth row leans on `docs/build/event-architecture-recommendation.md:356-364` for the whole
claim/lease/retry shape: *"a SECOND INSTANCE of a pattern the record has already chosen, not new
machinery."*

Read what that section licenses. It is scoped to **notification delivery**, and the ground it states
is: *"I/O-bound, retryable, externally rate-limited, **no durability obligation past 'deliver or
surface the failure'**"* (`:358-360`). The reader queue's work item is a **paid model call** feeding
an append-only table that has *"no compensating instrument"* (`model/billing.ts:136`). **The sentence
that licenses the precedent is the sentence that excludes this surface from it.** §5.1: keyed on the
convenient landmark (an existing `FOR UPDATE SKIP LOCKED` in the record) rather than on the property
that made it safe there.

This does not make the queue wrong. The decisive argument in the same document — the settle and the
meter insert must share a transaction and **SQS cannot** (`:363`) — is sound and is genuinely the
argument, and O-1 already took exactly this shape for the ingestion path
(`docs/build/ingestion-pipeline.md:457`). Q3 is the right question. But it must be asked on the
argument that is available, not on a precedent whose stated precondition is false here — because the
next reader will inherit "the record already chose this" and skip the transaction argument, which is
the only one that holds.

---

## 13. 📄 NOTED

**13.1 `_WorkBoundDefectHoldsNoText = never /* see note */`.** The design ships a line whose own
comment concedes it may not bite, in a repository whose §5.6 is *a control that passes while
asserting nothing*. `export type X = never` typechecks, asserts nothing about `WorkBoundDefect`, and
reads exactly like the eight real `AssertNoTextDeep` aliases beside it
(`model/reconciliation.ts:258` is the constraint; `:2281` and `:2638` are real instances). **Ship the
absence as a comment or ship the assertion RED first.** The design says as much and then writes the
line anyway.

**13.2 The POISON statement is scoped to neither a run nor a bound.**
`UPDATE reader_request_attempt SET … WHERE outcome_kind IS NULL AND attempts >= $1` names no
`run_id` and no `LIMIT`. Under RLS it is every exhausted row of the current tenant across every run
that ever ran — an unbounded write inside a pooled transaction under G101, and the only statement in
§2.8 whose blast radius is not one row. It is also **redundant**: the CLAIM already excludes
`attempts >= maxAttempts`, so a row at the cap is already unclaimable, and the poison pass exists
only to make the disposition visible. Scope it to the run being resumed, where the disposition is
actually needed.

**13.3 T-1 governs this surface, is not in the tree, and asks for something the role cannot do.**
T-1 is referenced twice — `docs/build/ingestion-pipeline.md:457` (*"Refined by **T-1**"*, on the
work-queue ruling) and `:460` — and **defined nowhere in the repository**:
`grep -rni "unindexed|COPY into|batch insert" docs` returns nothing, and `docs/INDEX.md:387` records
that the file *"is being extended by a concurrent pass"*. So the refinement that governs the queue's
insert strategy cannot be read, and the green document — correctly — does not cite it.

On the merits of the shape it is reported to ask for (chunked batch inserts or `COPY` into an
unindexed staging table, indexes applied on pickup): **the data-plane role cannot apply an index at
runtime.** `db/migrations/0001_tenancy_and_rls.sql:41` — *"`reconcile_app` LOGIN, no BYPASSRLS, owns
nothing. DML only"* — and `:186` — *"DML only, and no `CREATE` on the schema. `reconcile_app` cannot
create a"* table. That is G100's design, not an oversight: ownership carries DDL rights alongside the
read exemption. So *"apply indexes only on pickup"* is a migration-role act, and a migration role in
the request path is the thing G100 exists to prevent. **The green design does not walk into this** —
it chose bound-and-refuse for the terminal write instead (§2.12(b), Q8), mirroring R5(vi) — but it
also never states that the alternative is unavailable, so a reader following O-1's *"Refined by
T-1"* will try. One sentence in §2.12 would close it: *a runtime `CREATE INDEX` is not available to
`reconcile_app` by G100's design; a staging-table strategy is a migration, not a runtime choice.*
`COPY` itself is fine — it is DML — and a partial index created **in the migration**, which §2.7
already does (`reader_request_attempt_ready`), is the available half of the idea.

---

## 14. WHERE THE GREEN TEAM IS RIGHT AND I COULD NOT BREAK IT

Seven things. I attacked each and failed, and two attacks I had drafted are struck below because
their premises were false.

1. **R-1's refusal to serialise `MatchingState` is correct on two independent grounds, and both
   verified.** `canonicalise()` refuses `bigint` — `typeof v` falls through to
   `unsupported_type` (`model/canonical.ts:152-154`) and the stated reason at `:66-71` is that
   inventing an encoding would be *"a SECOND answer to how money is represented, on the bytes an
   audit chain signs."* And `AdmittedItem.untrustedDescription` (`model/reconciliation.ts:833`) is
   counterparty prose, while `SubjectLocation` (`model/governance.ts:1772`) has eleven variants and
   none for folded state. **Re-deriving the fold creates no new erasure surface and needs no format.**
   I could not find a cheaper correct resume, and the monotonicity argument holds:
   `fully_allocated` is absorbing because *"nothing here removes an allocation"*
   (`model/reconciliation.ts:1287-1291`), which makes replay idempotent by a property rather than by
   a flag.
2. **The `nextval` refusal.** Against the obvious implementation, for the right reason, citing the
   exact sentence that makes the field meaningful (`model/billing.ts:158`). BLOCKER 3 attacks the
   replacement, not this call, and the call is the harder half to get right.
3. **Deriving the lease ceiling instead of choosing a number.** `MAX_AUTHORIZATION_SECONDS`
   (`model/access.ts:1517`) is `Record<AccessResourceClass, number>` — total, so a fourteenth class
   is a compile error — and `tenant_data: 900` is at `:1530`. Verified both. A worker holding a
   longer lease than its authority is invariant 10 failing through a scheduling parameter, and I
   could not find another design document in `docs/build/` that noticed the collision at all.
4. **`storedReaderOutcomes` required and non-nullable.** Under `exactOptionalPropertyTypes` the
   optional form makes *"none yet"* and *"the caller forgot"* one value, and the `TS2741` sweep at
   every construction site is the only evidence the field landed — the argument
   `ResidueEntry.settlement` already carries (`model/reconciliation.ts:2113`). Right, and right for
   a reason already in the file.
5. **The guarded conditional `UPDATE` as the single transition primitive**, with `rowCount 0` as how
   the losing node learns it lost, and the loser's work **discarded rather than merged**. I tried to
   construct a double-advance and could not: every transition naming its expected prior status makes
   the state machine a compare-and-swap.
6. **Refusing to put a lease table outside RLS, and stating the O(tenants) cost rather than hiding
   it.** The rejected alternative is preserved with its own argument and its own price, and the
   refusal cites G103's ground that four invariants are enforced by the store. That is the harder and
   the correct call, and §6 cost 4 prices it honestly.
7. **Naming the irreversibility rather than claiming it away.** §6 cost 5 states that the first
   stored verdict freezes `buildReaderRequests`'s iteration order into the persisted contract, and
   compares it to *"irreversible after the first hash"* (`model/canonical.ts:27-34`). **Verified and
   I can sharpen it rather than dispute it — see §15.**

### Two attacks I drafted and STRUCK, by name

- **STRUCK: "`ReconciliationRun.status` is at `:2716`, so the design's edit instruction points at
  `inputs`."** False. `grep -n "  status: 'queued'" model/domain.ts` → **2717**. The green
  document's citation is exact, in all three places it appears.
- **STRUCK: "a rerun shares the run's id, so `runMeterFact`'s `${runId}#${meter}` key silently
  dedups a rerun's run-level meters to the first attempt's values."** False, and the reason is the
  same line that produced SERIOUS 11: a rerun is a new run carrying `ofRunId`
  (`model/domain.ts:2763`), so its run-level idempotency key differs. The finding inverted into the
  double-payment cost instead.

---

## 15. The irreversibility, sharpened

The green document is right that the irreversibility arrives with G120's key and not with its design.
It stops one step short of naming what invalidates the stored verdicts. **Any of these five, and
each is a routine act:**

| Change | Why every stored verdict dies |
|---|---|
| The residue's construction order | `buildReaderRequests` iterates `residue` (`model/reconciliation.ts:2401`), which is built refused-items-first then `state.items.values()` (`:2912`, `:2924`) — a **`Map` insertion order**, i.e. the admission order. Any change to admission order renumbers every ordinal |
| `openItems`' order | the candidate array is built by iterating `rightOpen` from `openItems` (`model/reconciliation.ts:1445`), so a change there reorders **every** `candidateWitness` and invalidates every stored row even where the subject is untouched |
| The candidate filter | `residualOf` positive **and** `compareMoney(residual, gross) === 0` (`:2412-2414`). Any widening — a tolerance band on candidacy, a near-amount rule — changes both the membership and the order |
| `readerCandidateCap` | it bounds the array, and `buildReaderRequests` **drops a subject entirely** when `candidates.length > candidateCap` (`:2420`). Lowering it removes requests; raising it adds candidates to every witness |
| Any of BLOCKER 1's unpinned values | a tolerance or normalisation edit changes the residue, which changes the ordinals, with **nothing in the plan recording that anything changed** |

**So the irreversible surface is not one iteration order. It is five, three of them internal to
functions no document flags as frozen**, and none of the five carries a comment saying *"this order is
part of a persisted contract."* That is the cheapest available control and the green design does not
include it: a banner on `buildReaderRequests` and on `openItems` stating that their iteration order is
durable the moment one `ReaderOutcome` is stored. `docs/HANDOFF.md` §7 records that a stale visual is
the artefact class that has already misled a reader here; an unmarked frozen iteration order is the
same defect in code.

---

## 16. The one property that must hold before any work is made resumable

> **An effectful act may be made retryable only when its durable key is over the CONTENT of the act
> — never over a position in a derived array — and only when that same key makes the second attempt a
> no-op that is COUNTABLE.**

Both halves are load-bearing and the green design has neither in full.

**Content, not position.** A key over a position is only as stable as the derivation that produced
the position, and this design's derivation reads four values nobody pinned (BLOCKER 1) through five
iteration orders nobody froze (§15). The witnesses are the right data in the wrong role: they are
stored and then used only to make the failure loud, when they are the key. `(tenantId, subjectKey,
candidateWitness)` identifies the verdict; `requestOrdinal` labels the act, which is all G121's
*"every reader act carrying it plus its `requestOrdinal`"* (`docs/HANDOFF.md:847`) asks of it. **That
is a G120 amendment with a quote attached and it is the owner's to take.**

**Countable, not merely idempotent.** A no-op that leaves no trace is indistinguishable from work
that never happened, which is how BLOCKER 3 turns a dedup into a phantom lost record and how
BLOCKER 4 turns a duplicate paid call into silence. Every suppressed repeat must increment something
a person can query. The green design gets this right in exactly one place — `attempts` minus settled
outcomes, §2.11 — and that instinct is the best thing in the document. It belongs on **every** durable
key, not on one.

Until both halves hold, the honest description of this surface is the one G118 already requires of
the seam: **the shape is right, the executor does not exist, and the durability designed around it
keys money to a position.**

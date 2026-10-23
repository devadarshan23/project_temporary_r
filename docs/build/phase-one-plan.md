# Phase one — the adjudicated plan

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** PARTIAL — **ratified as the plan of record by G92**, and authoritative for phase-one **SEQUENCING** only. `docs/HANDOFF.md` §3 outranks it on **every** decision, including every decision its own gate table names. *(The label is a derivation from G92's ratification, not a new decision — `LIVING CONTROL` is the label this record already uses for a maintained control. If the owner prefers `PARTIALLY APPLIED`, that is a one-word change with no other consequence. The five legal values are `DATED SNAPSHOT`, `LIVING CONTROL`, `PARTIALLY APPLIED`, `SUPERSEDED`, `WORKING MATERIAL`.)*
> ✅ **Gate D4 is CLOSED, and re-adding it is the specific mistake to avoid.** ~~This banner used to warn that D4 was stale.~~ That warning became the stale thing: all four of D4's items are decided and the gates below are re-cut accordingly. **Why it matters more here than in any of the five source reports:** this file adjudicates rather than proposes, so one stale edge is inherited rather than read — **sixteen phase-two issues in the green set reached D4 transitively through this single edge**, and every one of them was gated on a decision already taken.
> ⚠️ **The re-cut obligation is STANDING, which is why this is a LIVING CONTROL and not a dated snapshot.** §3 keeps moving. Before working any gate below, re-derive its status from `docs/HANDOFF.md` §3 rather than trusting this table — `grep -nE '^\| G[0-9]+ ' docs/HANDOFF.md`.
> *Banner added 8 Aug 2026. Gates re-cut against pass H the same day; §1, §2 and §5 are as ratified and are not re-adjudicated.*

> **An ADJUDICATION of five agent reports, 7–8 August 2026.** Three green teams
> proposed twenty-two vertical slices; two red teams attacked the decision set and
> the buildability. This file rules between them and produces **one ordered plan**.
> It follows the precedent of `docs/salvage-ledger.md`, which adjudicates a
> green/red pair rather than publishing both and leaving the reader to referee.
>
> **The five sources, each of which outranks this file on its own subject:**
> `green-platform-slices.md` (7 slices) · `green-reconciliation-slices.md` (8) ·
> `green-agent-bi-slices.md` (7) · `red-decisions.md` (20 findings: 4 BLOCKER,
> 11 SERIOUS, 5 NOTED) · `red-buildability.md` (24 findings: 6 BLOCKER, 10
> SERIOUS, 8 NOTED).
>
> ~~🟡 **NOTHING HERE IS APPLIED.** No file in `model/` has changed.~~ **FALSE
> since 8 Aug 2026, and struck rather than deleted.** G92 ratified this plan;
> §4A items 1 and 2 are done; and the decisions that closed gates D3 and D4
> changed `model/` on the way. **What survives of the sentence:** §4A items 3–9
> and all of §4B are still unbuilt, and §3's six remaining decisions gate part
> of §4B. Do not read this file as a description of the tree — verify against
> the tree.

---

## 1. The ruling, in one paragraph

**No vertical slice can go first, and phase one is a foundation phase with no
user-visible outcome.** Red-buildability tested six candidate slices and found each
blocked by four or more substrate items; green-platform reached the same
conclusion from the opposite direction, finding that three of its seven slices have
**no capability that fits and none of the thirty-six can be made to fit**. Two
teams that could not see each other's work converged on it, and `docs/HANDOFF.md`
§5.8 records that convergence has *without exception* been the signal worth acting
on here. **Estimate three to four weeks, and plan it as a foundation phase rather
than discovering halfway through that it is one.**

**The twenty-two green slices are not wasted and are not phase one.** They are the
build contracts for phase two, and they are better than what phase two would
otherwise have started from.

---

## 2. Where I ruled against a report

An adjudication that agrees with everything adjudicates nothing.

| # | Ruling | Against |
|---|---|---|
| **A1** | **Sequencing goes to red.** The green slices are correct in *content* and wrong in *availability* — every one of them assumes substrate that does not exist. They become the phase-two backlog unchanged | all three green reports |
| **A2** | **RD-11 defeats my own recommendation and I accept it.** I wrote that G67's decimal-string FX rate needs *"exactly one parse-and-convert function, landed in the same commit."* Red is right that **it cannot be written yet**: rounding mode and the rate's scale are undecided, and both are finance judgements rather than implementation details. **The function moves from a phase-one derivation to a phase-one DECISION** — §3, D8 | my own advice, and G67's row |
| **A3** | **RD-9 is upheld but does not move G71.** After G65 and G71 both apply, `Money.amountMinor` is `bigint` in the model and `string` on the wire, so *"one TypeScript vocabulary spanning the wire"* needs an explicit codec at the boundary and money is **not** literally a shared type. That weakens G71's *second* argument. It does not touch the first and load-bearing one — `model/` already **is** the domain model, with ten compile-time proofs no port preserves. **Stack decision stands; the claim gets a caveat** | my own G71 row |
| **A4** | **Green-BI's slice 5 does NOT override G68, and I checked before ruling.** Its title reads as a reversal; its content answers the three consequences G68 itself records as unsolved. No conflict | an apparent conflict that was not one |
| **A5** | **G68 stands as decided — and two teams independently found it leaves intra-tenant viewer scope unenforced** (RD-3, RD-7, and green-BI slice 5). That is a **reopen candidate for the owner, flagged not taken.** See §5 | nobody; recorded because convergence |

---

## 3. Phase 0 — decisions, and none is engineering's to take

**Eight items were stated; SIX are open.** Six from red-buildability, one from
RD-11, one from counsel. ~~Everything in §4 waits on these.~~ **D3 and D4 are
closed**, so §4 no longer waits on them and the items they gated are released
below.

> **The fifth column is a MIRROR of `docs/HANDOFF.md` §3, never a restatement of
> it.** It names the G-number that moved each gate and nothing else — no cell
> here says in its own words what any of those decisions decided, because a
> second vocabulary for a settled decision is §5.3 and this file adjudicates,
> so its paraphrase would propagate. **Re-derive the lines**, which move
> whenever §3 grows: `grep -nE '^\| G(28|75|78|80|85|92|100|101) ' docs/HANDOFF.md`
> → `797 910 913 915 920 927 935 936` at the time of this re-cut.

| # | Decision | Blocks | Source | Status at the pass-H re-cut, 8 Aug 2026 |
|---|---|---|---|---|
| **D1** | **Where session establishment terminates** — an IdP-fronted edge, or an operation in this API surface | *everything*. All three tiers require `X-Session`; no path issues one, and `TenantContext` is named seven times in the contracts and **does not exist in `model/`** (verified: 0 hits) | B1 | 🔴 **OPEN.** Re-verified against the whole of §3 on 8 Aug 2026: no row closes it. **The oldest gate and still the widest** |
| **D2** | **Definition version storage shape** — versioned rows, append-only version table, or event-sourced | The schema, and G58's central promise. `definitionVersion` is a bare `number` and **no snapshot or history type exists** (verified) | B3 | 🔴 **OPEN.** Re-verified against the whole of §3 on 8 Aug 2026: no row closes it |
| ~~**D3**~~ | ~~**The pooler and its mode**, and whether the RLS policy denies on NULL~~ — **re-cut into its two halves, and both are now taken** | ~~🛑 Invariant 1 in production~~. The finding that opened it stands as history: **zero hits** anywhere for `SET LOCAL`, `current_setting`, pooler or connection pool at the time it was written | B5 | ✅ **CLOSED, both halves.** The pooler and its mode: **G101**. The RLS null polarity: **G100**. *Pointers, not restatements — read the two rows in `docs/HANDOFF.md` §3 for what they decided, so this cell stays true if either is amended.* ⚠️ **G98 and G99 were taken AHEAD of this gate and G98's own row records that the ordering was wrong** |
| ~~**D4**~~ | ~~**Sign-off on `docs/v1-trim-proposal.md` §5** — at minimum items 1 (`secret` → `CONTRACT_ONLY_RESOURCES`), 3 (money retype), 6 (close `provider`), 7 (`DocumentType` variants)~~ | ~~Items 1 and 7 gate contract operations~~ | B2 | ✅ **CLOSED — all four items, one G-number each.** Item 1: **G75**, which decided it **the opposite way** to the recommendation quoted in this row, and applied it. Item 3: **G78**. Item 6: **G80**, applied. Item 7: **G85**. *Each is a pointer into `docs/HANDOFF.md` §3 and none of them is restated here.* 🛑 **Do not re-add this row.** It is struck rather than deleted because sixteen phase-two issues inherited it, and a reader who finds it missing must be able to see that it was closed rather than lost |
| **D5** | **Does the FDE get a designed surface, or a runbook plus an internal API?** | The platform tier has no taxonomy, no screen, no contract, and in places no capability | S3, G28 | 🔴 **OPEN.** Re-verified against the whole of §3 on 8 Aug 2026: no row closes it — and **G28** (`docs/HANDOFF.md` §3) still pauses screen design over the same hole, so the two move together |
| **D6** | **Where the runtime validation boundary lives** — generated from OpenAPI, or declared from `model/` | 🛑 **Types erase. Nothing validates today**, and G71's payoff is compile-time only | S10 | 🔴 **OPEN.** Re-verified against the whole of §3 on 8 Aug 2026: no row closes it. G109 and G111 each land *near* it and neither takes it |
| **D7** | ⚖️ **The thirteen retention windows and the per-jurisdiction statutory floor map** | The schema, not merely the retention table | counsel | 🔴 **OPEN.** Re-verified against the whole of §3 on 8 Aug 2026: no row closes it. Not engineering's to take at all |
| **D8** | 🆕 **FX rounding mode and the rate's scale** — half-up, half-even or truncate; and how many decimal places are honoured | G67's single conversion function, which cannot be written without them. **A finance judgement, not an implementation detail** | RD-11 / A2 | 🔴 **OPEN.** Re-verified against the whole of §3 on 8 Aug 2026: no row closes it. G67 fixes the STORAGE (a decimal string, parsed at use) and G111 fixes WHERE the parsing lives; neither states a rounding mode or a scale, which is what D8 asks for |

⚠️ **D1, D2, D3 and D6 are the four that decide whether this codebase is correct
rather than merely complete.** Each has a silent failure mode: a session that
carries a request-supplied tenant, a version pin that resolves to nothing, a
pooled connection that leaks a tenant, and a type that erased at compile time and
validates nothing at runtime.

**Three of those four are still open. D3 is taken** — G100 and G101 — **and its
silent failure mode is the one that is now guarded rather than merely named.**
The other three are unchanged and unclosed, and they are the reason this section
still exists after the re-cut.

---

## 4. Phase one — the ordered plan

### 4A · Derivations — no decision needed, and none is deferrable

**These can start immediately and several run in parallel.**

| # | Item | Why it cannot wait |
|---|---|---|
| ~~1~~ | ~~**`package.json` with a pinned TypeScript**~~ ✅ **DONE.** `package.json` exists at the repo root with `typescript` pinned exact. ⚠️ It is no longer the *only* devDependency — **G96** added `@types/node`, also pinned exact, and its row records that as a correction to a claim made the same day | ~~🛑 The working compiler is an **untracked leftover**~~; a clean clone now typechecks. Verify rather than trust this cell: `npm ci && npm run check` |
| ~~2~~ | ~~**The fixtures pass in `model/examples.ts`** — one fixture per total record~~ ✅ **DONE.** `model/examples.ts:466` opens the `FIXTURES` section, and `docs/HANDOFF.md` §5.10 records it as closed for all five instances | ~~§5.10: five total records have **no construction site anywhere**~~ — they have one now, so `tsc` can fail on a field chosen. ⚠️ **This does not retire §5.10 as a defect shape**: a total record minted tomorrow with no construction site is the same defect again |
| 3 | **Apply G20 (RFC 8785 / JCS)** | 🛑 **Irreversible after the first `AuditEvent` is written.** Oldest item with a hard deadline; four days old |
| 4 | **The money retype as ONE commit** — `MoneyAmount` deleted, `bigint`, both contract files | Cheap now, a migration **plus a wire break** later. ⚠️ G67's conversion function is **excluded** — it waits on D8 |
| 5 | **`Capability` as an enumerated schema + an `x-` extension naming the required capability per operation** | Zero of the 36 capabilities has any wire representation, and there is no convention for one |
| 6 | **`Session` / `TenantContext` in `model/`**, with `IdentityConnection` → `OrgClass`, feeding `PrincipalContext` | The type the whole contract surface presumes and nobody wrote |
| 7 | **The scoped-transaction helper, and the rule that no query may be issued outside it** | The only mechanical defence against B5. ~~Shape is decidable now; D3 decides its configuration~~ — **D3 is now taken, so the configuration is decided too**: see `docs/HANDOFF.md` §3 rows **G101** and **G100**, and **G99**, whose row names the ORM's autocommit-outside-a-transaction behaviour by name. Nothing here restates them |
| 8 | **`tools/`: the model-versus-wire mirror checker and a capability-coverage checker** | §8 item 5, and it would catch `CapabilityRequirement`'s two money schemas today |
| 9 | **A test runner and exactly one test: two tenants, one pooled connection, assert isolation** | 🛑 The single highest-value test in the repository. It is the only thing that can catch B5 before a customer does |

> ⚠️ **Item 9 is also the answer to CLAUDE.md's standing CI position.** *"Add CI when
> application code lands, or when a second person is committing."* Both are about to
> be true, and invariant 6 already has one enforcement running instead of two.

### 4B · Gated — starts when its decision lands

| # | Item | Gate |
|---|---|---|
| 10 | **`administration.openapi.yaml`, Group A only** — the twelve operations derivable today | ✅ **RELEASED** — ~~D4~~, closed. No gate remains on this item |
| 11 | **Session establishment, end to end** (green P1, P2) | D1, D6 |
| 12 | **Definition versioning with resolvable content** (green R4, P3) | D2 |
| 13 | **RLS policy and the pooler configuration** | ✅ **RELEASED** — ~~D3~~, closed by G101 and G100. No gate remains on this item |
| 14 | **The FDE path** — tenant provisioning, grant issuance, source and credential binding (green P3–P5) | ⚠️ **NARROWED, NOT RELEASED** — ~~D4~~, **D5**. G92's row says D4's closure *"releases plan items 10 and 14"*; item 10 is gated on D4 alone and is released, and **item 14 is not**, because its second gate D5 is open and no §3 row touches it. **This item's gate is now D5 alone** |
| 15 | **G67's single parse-and-convert function** | D8 |

---

## 5. What is NOT in phase one — and one reopen candidate

**Deferred with reasons, so nobody reads the omission as an oversight:**

- **All twenty-two green slices.** Phase two. They are the best-specified backlog
  this project has had.
- **`Ask` and G45.** G62 makes both v1; **neither is phase one.** `Ask` has zero
  contract operations and G45 is *"not specifiable against the model as it
  stands"* (RD-12) — the only candidate boundary type is text by design.
- **Quick Suite integration.** Gated on D5 and on the reopen below.

✅ **~~The reopen candidate, and it is the owner's call, not mine.~~ RULED
8 Aug 2026 — G94: G68 STANDS, and the cost is recorded rather than re-argued.**
The reopen was put to the owner with the convergence stated, alongside two
alternatives — restore the scope spine for the dimensions RLS cannot express, or
narrow what v1 BI shows — and **neither was taken**. In v1 the BI layer enforces
**two of six** scope dimensions; `valueCeiling` is unenforceable there because
Quick Suite RLS is text-only. `docs/HANDOFF.md` §4.1 carries the full cost and
the condition for reopening. **The paragraph below is preserved as written,
because the argument it makes is still the argument, and it is what someone
reopening this will need.**

**G68 (rely on
Quick Suite RLS) leaves intra-tenant viewer scope unenforced**, and three
independent sources landed on it: RD-3 (an account boundary restores *inter*-tenant
isolation; G68 gave up *intra*-tenant scope — a category error I made and have
corrected), RD-7 (**classification is lost at the BI boundary — invariant 4, and
nobody noticed**), and green-BI slice 5. `presentation.ts`'s own worked example is
exactly the unhandled case: two users in **one tenant** with different cost centres,
one reading the other's group figure. **Nothing was hacked. The tool worked as
documented.** Reported, not reversed.

---

## 6. What this plan cannot verify

**Stated plainly, because a plan that hides its blind spots is worse than none:**

- **A green `tsc` after phase 1A proves almost nothing.** Adding or removing a
  `@dropped-for-v1` note changes no type. Only item 4 (the money retype) and item 6
  (`TenantContext`) will genuinely be checked by the compiler.
- **`tools/check-citations.mjs` reports ~~31~~ 131 SUSPECT citations** that resolve
  to a brace or a comment marker. They resolve, so they are not dead; whether they
  point at the *right* declaration is unchecked and unautomatable. ⚠️ **The figure
  moved because the TOOL'S SCOPE moved, not because the record rotted.** Until
  8 Aug 2026 its `TARGETS` enumerated `docs/` with a **non-recursive**
  `readdirSync`, so the directory entry `build` was dropped and **every file in
  `docs/build/` — this one included — had no citation control at all.** That is
  the blind spot gate D4 rotted inside while `npm run check` stayed green.
  Widening it to `docs/build/` took the run from `Citations resolved: 268 (OK 230 ·
  SUSPECT 38 · DEAD 0)` to `956 (OK 825 · SUSPECT 131 · DEAD 0)`, measured across
  the change and still exit 0 — the tool fails on DEAD only. **Do not copy any of
  those numbers — derive them:** `node tools/check-citations.mjs`. Within the hour
  the same command already read `965 (OK 833 · SUSPECT 132 · DEAD 0)` as concurrent
  work landed elsewhere in the record, which is the argument for deriving rather
  than quoting, made by the figure itself.
- 🛑 **AND NEITHER CHECKER READS THIS FILE'S PROSE.** `tools/check-doc-counts.mjs`
  still enumerates `docs/` non-recursively, and `check-citations.mjs` matches
  `.ts` and `.yaml` paths only — this file contains **zero** citations of either
  kind (`grep -cE '[a-zA-Z0-9._/-]+\.(ts|yaml):[0-9]+' docs/build/phase-one-plan.md`
  → 0). **A green `npm run check` is not evidence that any gate below was re-cut.**
- **No tool here checks that a `@dropped-for-v1` note is on the right declaration
  or that its stated reason is true.** The only verification of the trim's content
  is a human reading the ledger against the model.
- **Nothing verifies the eleven invariants hold.** Four have an executable
  enforcement; the rest are prose. Invariant 8 was amended on 7 Aug, invariant 2 is
  about to become declared-and-unexercised, and invariant 4 has a hole at the BI
  boundary nobody had noticed until this exercise.

---

## 7. One sentence for whoever schedules this

**Phase one is three to four weeks of substrate with nothing to demonstrate at the
end of it, eight decisions must land before most of it can start, three of those
eight are not engineering's to take, and the single most valuable artefact it
produces is one test that opens two tenants on one pooled connection and asserts
they cannot see each other.**

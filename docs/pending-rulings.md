# Pending rulings — the batch, ordered by what each unblocks

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** NONE. This file decides nothing and owns nothing. It **rules
> on nothing and recommends nothing** — it is a collection of open questions with
> their costs priced, produced on one day by one sweep, and every authority it
> names outranks it.
> A snapshot under **G32** — *"an unowned document that looks like a control is
> worse than none; one that says it is a snapshot is just evidence."* It is not
> maintained, and it must not be edited into currency. When a ruling below is
> taken, **the G row in `docs/HANDOFF.md` §3 is the record**; this file will go
> stale and is supposed to.
> *Written 16 August 2026. Derived against `HEAD` at `305c9557` — see §1 for the
> measurement base and what was dirty in the tree at the time.*

> 🛑 **LANDED 16 August 2026, LATE, AGAINST A TREE THAT HAD ALREADY MOVED — AND
> THE DRIFT IS NARRATED HERE RATHER THAN EDITED AWAY, BECAUSE THIS FILE'S OWN
> BANNER FORBIDS THE ALTERNATIVE.** This document existed **only as an untracked
> file on one machine** for the whole of the day it describes. Between `305c9557`
> and the commit that lands it, **eighteen pull requests merged**
> (`git log --oneline origin/main --since="16 hours ago" | grep -c 'Merge pull
> request'` → **18**), and the following is what moved. **Nothing below §1 is
> rewritten to match** — *"it must not be edited into currency"* is the rule, and
> a snapshot swept into agreement with a later tree is no longer evidence of
> anything.
>
> **What is edited, and it is the minimum:** three rulings in §3 were **ANSWERED**
> while this file sat untracked, and leaving them listed as pending would not be
> staleness — it would be an instruction to re-rule a decided question. They are
> **moved to §2** with their G numbers and their §3 bodies are kept in place,
> struck at the heading, so the costs that were priced for the owner remain
> readable beside the answer. **§3 therefore now lists 14 pending rulings, not
> 17.** Everything else — every count, every `file:line`, every command output —
> **is left exactly as measured at `305c9557`**, and the deltas are here:
>
> | Stated below, at `305c9557` | At `origin/main`, late 16 Aug | Derive |
> |---|---|---|
> | 190 G rows · high-water `G190` | **208 rows · `G208`** | `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md` |
> | 39 applied | **39 naive · 38 by the status cell** | `grep -E '^\| G[0-9]+ \|' docs/HANDOFF.md \| grep -c '✅'` |
> | 18 modules (§4.11, S-9) | **19** — `model/connectors.ts` landed with #185 | `ls model/*.ts \| wc -l` |
> | 37 capabilities (§3.5) | **39** — `view_endpoint` (#194) **and** `admit_source` (G173, #261), which were minted independently and each recorded as "the thirty-eighth" | `awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts \| grep -cE '^  [a-zA-Z]+:'` |
> | 53 `needs-g-decision` issues (§1) | **56** | `gh issue list --state open --label needs-g-decision --limit 60 --json number --jq 'length'` |
> | — | **72 declared operations · 4 served** | `grep -rh 'operationId:' docs/contracts/*.openapi.yaml \| wc -l` · `grep -n 'handlers: {' server/*/start.ts` |
>
> 🛑 **AND EVERY `docs/HANDOFF.md:NNNN` CITATION IN THIS FILE IS NOW WRONG, AS A
> CLASS, WITHOUT ONE OF THEM FAILING TO RESOLVE.** Two ruling passes — Pass L
> (G198–G201) and Pass J (G202–G208, arriving from PR #175) — were **inserted**
> into §3, so every line number after them shifted. `docs/HANDOFF.md:2169` was
> cited in §2 for **G173**; it is now **G4**. `:2039` and `:1997` were cited for
> **G118** and **G76**; both are now **blank lines**. **This is the
> resolving-but-wrong class `CLAUDE.md` narrates six times about `model/`
> citations, arriving on a document that warned about it in its own §0.** The
> line numbers re-derived at `origin/main` are: **G76 `:2322` · G111 `:2357` ·
> G118 `:2364` · G128 `:2374` · G153 `:2461` · G173 `:2494` · G178 `:2499` ·
> G184 `:2505` · G189 `:2603` · G190 `:2604` · G30 `:2195` · G58 `:2223` ·
> P12 `:3418`** — and they will be wrong again at the next pass, which is the
> argument for `grep -nE "^\| G173 \|" docs/HANDOFF.md` rather than for a number.
> `tools/check-citations.mjs` cannot catch any of this, because every one of them
> resolves.
>
> **One `model/` citation also moved and is recorded the same way:**
> `CAPABILITY_RESOURCE_CLASS` is at `model/access.ts:558`, not `:556` as §3.5
> states — `view_endpoint` was inserted above it.
> `CAPABILITIES` at `:251`, `AdmissionRefusal` at `model/reconciliation.ts:1066`,
> `SetReconciliationResult` at `:4033` and `SolutionPack.palette` at
> `model/domain.ts:2450` were **re-grepped and all four still hold.**

> ⚠️ **DATED SNAPSHOT, 16 August 2026. NOT A LIVING CONTROL, and not maintained.**
>
> **Why this is one document rather than a queue.** The product owner has ruled
> that the pending decisions are batched and answered in one sitting rather than
> one slice at a time, and the reasoning is on the record twice over: **a decision
> taken without its neighbours gets taken badly.** `CLAUDE.md`'s invariant 8
> narrates the worked instance. **G60** let the FDE reach `secret` on the ground
> that *"G56 puts source configuration with the FDE and a source has a
> credential"* — and **G75** then found a third constant nobody had checked:
>
> > ⚠️ **A THIRD LIST GOVERNS THIS AND NO DOCUMENT NAMED IT UNTIL 8 Aug 2026.**
> > `secret` also sat in **`NON_DELEGABLE_RESOURCES`**, which
> > `authorisationPermits()` checks **first — before the null check, before
> > withdrawal, before anything**. G60 as written would have been **inert**:
> > recorded as applied, with the FDE still unable to bind a credential.
>
> A ruling recorded as applied, with the thing it authorised still impossible.
> That is the failure this batch exists to avoid, and it is why every row below
> carries a **what either option must preserve** line: the constraint that binds
> both answers is the half a single-issue ruling loses.
>
> **The same shape is live right now and is not history.** #157's S-21 records the
> adjudicator saying of a membership-only tenant picker that it is *"exactly the
> inertness `CLAUDE.md` records G60 would have had"* — invariant 8's permitted
> staff path surviving on paper by refusing everyone.
>
> 🛑 **THIS FILE DOES NOT RECOMMEND, AND WHERE AN ISSUE OR A DESIGN ARTEFACT
> ALREADY CARRIES A RECOMMENDATION IT IS QUOTED AS THE SOURCE'S, NOT ADOPTED.**
> Several open issues do state a preference — #226's *"Recommendation on record"*,
> #216's *"Recommended: A"*, #152's *"Recommendation: (b)"*. Those are reported as
> facts about the issue. Nothing here endorses one.
>
> **The authorities this file reads, each of which outranks it:**
> `docs/HANDOFF.md` §3 for the decisions and §4.2–§4.5 for the open items ·
> `model/*.ts` for what is declared, with `@dropped-for-v1` **on the declaration**
> deciding what is built · `docs/contracts/*.openapi.yaml` for what has an
> operation · `docs/model-gaps.md` for MG1–MG30 · `docs/screen-pack-ledger.md` §5
> for the screen-versus-decision conflicts · the open GitHub issues labelled
> `needs-g-decision` for the slice-level questions · `design/routes/*.html` and
> `Mockups/rec/*.dc.html` for what is drawn. **Where this file and any of those
> disagree, they are right and this is stale.**
>
> ⚠️ **No figure, duration, threshold, price, customer or benchmark is invented
> anywhere below.** Where a ruling requires a number, the row says **the owner
> supplies it** and states nothing further — `PRODUCT.md` forbids the alternative,
> and #226 and MG20 are the two rows where that constraint bites hardest.

---

## 0. How to read a row

Each entry carries six things, in this order:

1. **The decision** — stated as a question, with its scope.
2. **Why it cannot be deferred** — what is blocked, named by issue number and slice.
3. **The options** — two or three, each with **what it costs**. Costs, not preferences.
4. **What either option must preserve** — the invariant or property that binds
   both answers. This is the line a single-issue ruling loses, and it is usually
   the most useful one in the row.
5. **What the record already says** — G rows, prior arguments, preserved rejected
   alternatives. **Every `file:line` below was re-derived by grep for the
   declaration immediately before this file was written**, not copied from an
   existing citation. `CLAUDE.md` narrates the resolving-but-wrong class six times
   on its own page and `docs/model-gaps.md` reproduced it four times in the file
   written to avoid it; re-grep before quoting any of them.
6. **Who else is affected** — surfaces, screens, contracts.

**Ordering is by how much each unblocks**, most first, with the deriving command
printed beside each count. Ties are broken by whether the blocked work is a whole
track or a single route.

---

## 1. What was swept, and against what

**Measurement base: `HEAD` at `305c9557`**, 16 August 2026. `git rev-parse --short
HEAD` → `305c9557`.

🛑 **THE TREE WAS DIRTY AND THIS IS NAMED RATHER THAN GLOSSED**, because
`docs/model-gaps.md`'s own banner records that mixing two measurement bases without
saying so is what put `checkPostconditions()` at two different lines in one file.
Three other passes were writing this tree concurrently. `git status --porcelain |
wc -l` → **39** entries. **None of them was in `model/`, `design/`, `Mockups/`,
`docs/HANDOFF.md`, `docs/model-gaps.md` or `docs/screen-pack-ledger.md`** — the
dirt was in `db/`, `README.md`, and `docs/c4-data.json` / `docs/c4.html`. Verify:

```bash
git status --porcelain | grep -E 'model/|design/|Mockups/'    # no output
```

**So every `model/*.ts` and `docs/*.md` citation below is measured at `305c9557`
and at the working tree simultaneously, because those paths were identical in
both.** The `db/` and c4 figures are not cited here at all.

### The four sources, and what each contributed

| Source | Command | Count |
|---|---|---|
| Open issues labelled `needs-g-decision` | `gh issue list --repo 1CloudHub/Reconcile --state open --label needs-g-decision --limit 60 --json number --jq 'length'` | **53** |
| `docs/model-gaps.md` MG rows | `grep -cE '^\*\*MG[0-9]+ · ' docs/model-gaps.md` | **30** |
| `docs/screen-pack-ledger.md` §5 conflicts | `grep -cE '^### 5\.[0-9]' docs/screen-pack-ledger.md` | **7** |
| `docs/HANDOFF.md` §4.2 product questions | `grep -cE '^\| P[0-9]+ \|' docs/HANDOFF.md` | **13** |

And the decision surface those sit inside:

```bash
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                          # 190 G rows
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'           #  39 applied
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c 'not applied'  # 110 not applied
grep -oE '^\| G[0-9]+ ' docs/HANDOFF.md | grep -oE '[0-9]+' | sort -n | tail -1   # G190
```

⚠️ **110 rows read `not applied` and this file lists nowhere near 110 rulings.**
That is the point of the sweep: **the overwhelming majority of unapplied G rows
are blocked on WORK, not on a decision.** Only the rows where the blocker is
somebody's call are below. A row like G76 (the administration tier is one file) is
decided and unbuilt; it does not appear as pending, it appears in §2.

### The unblocking counts, and how each was derived

Every "unblocks N issues" figure below comes from one of these two forms. **Both
count ISSUES, not matches**, and the second is deliberately looser than the first
because a slice can be gated by a ruling it does not name in a `Blocked on` line:

```bash
# strict — issues whose Depends-on / Blocked-on line names the blocker
gh issue list --repo 1CloudHub/Reconcile --state open --label needs-g-decision \
  --limit 60 --json number,body \
  --jq '[.[] | select(.body | test("(Blocked on|Depends on)[^\n]*#188")) | .number] | length'

# loose — issues that name the blocker anywhere in the body or title
gh issue list --repo 1CloudHub/Reconcile --state open --label needs-g-decision \
  --limit 60 --json number,title,body \
  --jq '[.[] | select((.body + .title) | test("#157")) | .number] | length'
```

⚠️ **Both forms are lower bounds.** An issue that has not been written yet cannot
name a blocker, and seven of the ten `/setup/*` routes are undrawn and unfiled.
**Do not read a low number as low impact** — read §3's *why it cannot be deferred*
line, which names the surface rather than the issue.

---

## 2. Already ruled — recorded here and deliberately NOT in the pending list

**Recording these is as useful as listing a live one.** Each was reached during the
sweep and looked open; each has a G row. If somebody asks for a ruling on one of
these, the answer is a citation, not a decision.

| Looked open | Actually ruled | Row |
|---|---|---|
| Which capability authorises the **reader act** (MG22) | **G173** — *"THE READER ACT GETS ITS OWN CAPABILITY, CLASSED `tenant_data`"*, on the verified ground that reusing `trigger_run` *"does not merely read oddly — it REFUSES AT RUNTIME"*, because `trigger_run` is classed `configuration` and `authorize()` refuses a class mismatch outright | `docs/HANDOFF.md:2169` · not applied |
| Whether the **reader executor's absence** is a staging choice or a gap | **G118** — *"THE READER SEAM IS A GAP, NOT A STAGING DECISION, AND IT MUST BE LABELLED AS ONE"* | `:2039` · not applied |
| Whether `unique_within` gets an evaluator (MG19) | **G178** — cross-run uniqueness by pre-flight injection, the owner's own design with four amendments | `:2174` · MG19 says **Ruled: G178** |
| Whether a run may report **`incomplete`** (MG10) | **G153** — a run may report incomplete as an outcome distinct from inconsistent. ✅ applied for the member | `:2136` |
| The **intake vocabulary** — four channels versus three origins | **G184** — *"ONE INTAKE VOCABULARY: THE OPERATOR'S FOUR CHANNELS WIN, `SourceDocument.origin` IS DELETED, AND `api` IS DROPPED RATHER THAN FOLDED"* | `:2180` |
| Whether administration is **one contract file or a platform/tenant split** | **G76** — one file, with enforced plane tags, and `tools/check-plane-tags.mjs` lands in the same commit. It settles a contradiction that *"had sat unnoticed across six documents"* | `:1997` · not applied |
| Whether a **disabled control may explain itself in a tooltip** | **G189** — tooltips are allowed including for a disabled reason, reachable by focus *and* tap, never hover-only. Reverses a stated policy, deliberately | `:2278` |
| Whether `--agent` may mean *the machine* generally | **G190** — no; it means *the machine measured something* and nothing else. ⚠️ **Derived, explicitly NOT an owner ruling** — the row says so | `:2279` |
| Whether the **`/reports` module drop** is decided | The module drop **is** ruled; `model/presentation.ts` is `@dropped-for-v1` whole. **The destination is not** — `docs/model-gaps.md` MG28 says exactly this: *"the module drop is ruled; the destination is not."* The live question is in §3.16 |  |
| **P12 — which branch becomes the trunk** (`docs/HANDOFF.md:2863`) | Closed in fact, and the P row is stale rather than open. `CLAUDE.md`: *"`main` is the trunk. `origin/HEAD` points at it."* The P table still reads *"Decided in principle … and not created"* | §4.2 |

⚠️ **`not applied` on four of these rows is not the same as open.** G118, G173,
G76 and G165 are decided and unbuilt. **Do not re-rule them; schedule them.**

### 2a. Answered while this file sat untracked — moved out of §3, 16 August 2026

🛑 **THREE OF THE SEVENTEEN PENDING RULINGS WERE TAKEN BY THE OWNER ON THE DAY
THIS FILE WAS WRITTEN, AFTER IT WAS WRITTEN AND BEFORE IT WAS COMMITTED.** They
are Pass L in `docs/HANDOFF.md` §3, placed by PR **#260**. **Their §3 bodies are
kept below rather than deleted** — a ruling's cost table is worth as much after
the ruling as before it, and this record's practice is that the superseded thing
stays visible. **Read the G row for the answer; read §3 for what it cost.**

| Was pending, as | Ruled | Row | Where the pricing still is |
|---|---|---|---|
| **The frontend root, the styling authority, the money boundary — #188** | **G198** — *"THE FRONTEND ROOT IS REACT + VITE + TAILWIND, AND `design/system/tokens.css` BECOMES A THEME LAYER RATHER THAN THE SOLE AUTHORITY"* (owner ruling 1 of 16 Aug 2026). ⚠️ **It takes the option §3.1 did not list**, and its row states the accepted cost this file only gestured at: *"A UTILITY FRAMEWORK IS A GENERATOR OF EXACTLY THE RULE THAT KILLED [`.nb`], EMITTED BY THE THOUSAND AND LATE IN THE CASCADE."* The binding constraint is §3.1's own: **one set of values with two spellings, never two sets of values** | `grep -nE '^\| G198 \|' docs/HANDOFF.md` · `not applied` — there is no frontend root of any kind | §3.1 |
| **What keys the session policy, and whether the staff arm exists — #157 (S-2, S-21)** | **G199** — *"THE SESSION SLICE SPLITS: THE CUSTOMER ARM SHIPS NOW ON `Membership` ALONE, AND THE STAFF ARM BECOMES ITS OWN SLICE WITH ITS OWN RED TEST"*. 🛑 **This answers S-21 ONLY, and it is a REVERSAL of G167 rather than a fresh decision** — G167 ruled both arms in and recorded that *"the owner declined the staging option rather than taking it silently."* ~~⚠️ **S-2 — the RLS key — IS UNTOUCHED AND STILL OPEN**, so §3.2's S-2 half is *not* moved by this row and the gate cost of option B stands exactly as priced~~ 🛑 **THAT SENTENCE WAS FALSE WHEN WRITTEN AND IS STRUCK RATHER THAN DELETED, 19 Sep 2026.** S-2 is **G160**, which carries `(S-2)` in its own title and takes option (A) — the handle digest in `app.session_ref`. It is right that G199 does not move S-2; it is wrong that nothing else had. Derive: `grep -nE '^\| G160 \|' docs/HANDOFF.md`. **Both are now applied** — `db/migrations/0005_session_and_membership.sql` and `model/access.ts` §7a, one commit, per #157's *"either alone is a defeat"* | `grep -nE '^\| G(160\|199) \|' docs/HANDOFF.md` · **applied 19 Sep 2026** | §3.2 |
| **Which capability authorises reading a run's engine account — #192** | **G200** — *"NO FURTHER OPERATION IS MOUNTED UNTIL AUTHORISATION EXISTS, AND THE GATE IS DESIGNED ONCE AS A SINGLE PASS OVER EVERY OPERATION"*, and it is **broader than the question**. ⚠️ **It rules the TIMING and refuses the SHAPE of a per-slice answer; it does not pick A, B or C.** Options B and C are refused outright; **option A — mint `view_run` — is neither taken nor rejected but SUBSUMED** into the pass. ⚠️ **#192 stays OPEN.** So §3.5's three options are still the options; what has changed is that **they may only be answered all at once, for all 72 operations** | `grep -nE '^\| G200 \|' docs/HANDOFF.md` · `not applied` | §3.5 |

⚠️ **§3.5's cost line for option A — *"a 38th capability, and every stated
capability count in the record moves"* — HAS ALREADY BEEN PAID BY SOMETHING
ELSE.** `view_endpoint` landed with PR **#194** on 16 Aug 2026, closing #174,
which is **§4.9 of this file**. The roster is **38**
(`awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'`),
so a `view_run` would be the **39th**. 🛑 **G200's own status cell says the
roster is *"closed at 37"*, which was true when it was written at 08:46 UTC and
false by 09:26 UTC when #194 merged. Neither figure is wrong; they are forty
minutes apart, and nothing in `tools/` reads a G row's status cell.**

🛑 **A FOURTH ROW WAS ANSWERED BY CODE RATHER THAN BY A RULING, WHICH IS A
DIFFERENT AND LESS VISIBLE THING.** §4.9 asked *"who holds `view_endpoint`, and
does `endpoint` need a resource-level read/write split"* (#174, E-3-A/B). **#174
is CLOSED and the capability is minted**, so the first half is answered in the
tree. **The second half — the read/write split on the `endpoint` resource class —
is answered by nothing**, and there is no G row to point at. Verify:
`gh issue view 174 --json state` and `grep -n 'viewEndpoint' model/access.ts`.

---

## 3. The pending rulings

### ~~3.1~~ · ANSWERED — G198 · The frontend root, the styling authority, and the money boundary — #188

> ✅ **RULED 16 Aug 2026 as G198 — see §2a.** The body below is the pricing as it
> stood before the ruling and is kept for that reason. 🛑 **Its unblock figure is
> WRONG and the error is this file's own**, so it is corrected here rather than
> in the line: **12 counts CITATIONS, not dependencies.** The regex
> `test("(Blocked on|Depends on)[^\n]*#188")` matches the whole of a one-line
> metadata row, and every F-track issue ends that same row with *"**Landing
> slot** the frontend root #188 rules"* — so an issue that merely says where it
> will land is counted as blocked. **The dependency figure is 7** (#204 #206
> #207 #208 #218 #243 #244) and **16 cite it**. G198's own row states both and
> says why: *"a citation is not a dependency, and the smaller figure is the one
> that means blocked."* ⚠️ **The inflated number is the one that was put to the
> owner.** Re-derive over ALL open issues, not just the labelled ones:
>
> ```bash
> for n in $(gh issue list --state open --limit 200 --json number -q '.[].number'); do \
>   gh issue view $n --json body -q .body | grep -m1 -o '\*\*Depends on\*\*[^·]*'; done | grep -c 188
> ```

**Unblocks 12 open issues** — the largest single unblock on the board.
`… test("(Blocked on|Depends on)[^\n]*#188")` → **12** (#204 #206 #207 #208 #209
#210 #211 #212 #213 #214 #217 #218).

**The decision.** Four questions that must be answered together, because three of
them collide: **(a)** where the frontend root lives and how it reaches `model/`;
**(b)** which styling authority wins; **(c)** how money crosses to the browser;
**(d)** whether `design/` joins `npm run check` at all.

**Why it cannot be deferred.** Every F-track slice is *"Blocked on #188's root
ruling"* by its own text, including #206 (the navigation shell, which every route
sits inside) and #204 (the three route-level states). #206's own Decisions section
reads in full: *"Blocked on #188's root ruling — there is no place to build the
shell in. Nothing else."* **Twelve slices are waiting on one ruling and none of
them is waiting on anything else.**

**The options — (b) is the one that collides, and #188 states it as such.**

| | Cost |
|---|---|
| **Workspace with `app/package.json`** | *"`model/tsconfig.json` is deliberately standalone with no `package.json`, no `node_modules` and no `extends`, verified to compile with none of the three present. A workspace changes a documented property of this repository."* |
| **A second standalone tsconfig under `app/`**, importing `../model/*.ts` with `allowImportingTsExtensions` | a third tsconfig project in the gate, and **no dependency resolution for React** |
| **No bundler — plain ESM with an import map, served static** | no JSX, *"and every typed-component ergonomic goes with it"* |

On **(b)**, the two authorities are both on the record and they rule opposite
shapes. **G71**'s third argument cites the team's demonstrated stack as React 19 +
TS 5.9 + Vite + Tailwind. **G186–G190** and `design/system/tokens.css` rule an
explicit CSS custom-property kernel — 40 declared tokens, eleven numbered rules.
#188 prices the collision: *"Adopting Tailwind mints a second spelling of every
token, which is §5.3 — the record's most-recurring defect class, and the class G71
chose TypeScript end-to-end in order to collapse structurally rather than
procedurally."*

**What either option must preserve.** **One spelling per token, and one
representation of money.** §5.3 (*"Two vocabularies for one concept, diverging"*)
is the shape both halves of this ruling can produce. On money the constraint is
already ruled: **G111** — *"ONE money codec module, and it is the only thing
permitted to touch the representation … correctness that lives at call sites is
correctness that drifts"* (`docs/HANDOFF.md:2032`, **not applied**). G65 makes
`Money.amountMinor` a `bigint` in the model and a decimal string on the wire;
**the client either calls that module or invents a second representation on its
first render.** Whatever the root looks like, it must make the codec the only
door.

**What the record already says.** G71 (language, TypeScript end to end), G65
(`bigint` money), G111 (one codec, not applied), G186–G190 (the token kernel,
`design/system/tokens.css`), G108 (*a new checker joins `npm run check`; it does
not stand beside it*, and must be deterministic and fast — this binds answer (d)
either way).

**Who else is affected.** All eleven drawn routes under `design/routes/`; the
navigation shell and its sixteen tab stops; #208's four primitives (*"four
primitives one file already built five ways"*); #187's static checker over the
HTML; `npm run check`'s stage count.

---

### ~~3.2~~ · ✅ ANSWERED IN FULL — G199 answers S-21 · **G160 answers S-2** — #157

> ✅ **19 Sep 2026 — BOTH HALVES ARE RULED AND BOTH ARE NOW APPLIED. THIS
> SECTION'S OWN HEADING AND BANNER WERE STALE AND ARE CORRECTED RATHER THAN
> DELETED**, because they are the sentences a reader deciding whether the
> session slice was blocked would have trusted. They read:
>
> > ### ~~3.2~~ · HALF ANSWERED — G199 answers S-21 · S-2 IS STILL OPEN — #157
> >
> > 🟠 **S-21 RULED 16 Aug 2026 as G199 — see §2a — and it is a REVERSAL of G167,
> > not a fresh decision.** **S-2, the RLS key, is untouched**: nobody has ruled
> > between the handle digest in `app.session_ref` and the row id via a
> > `SECURITY DEFINER` function, and the gate cost priced below — `CREATE FUNCTION`
> > is not in `RECOGNISED_DDL`, so option B fails at `check:counts`, four stages
> > before the checker whose scanner raises it — **stands exactly as written.**
>
> 🛑 **S-2 WAS NOT UNTOUCHED. IT IS `G160` IN `docs/HANDOFF.md` §3, WHICH
> CARRIES `(S-2)` IN ITS OWN TITLE** — *"THE SESSION RLS PREDICATE KEYS ON THE
> HANDLE DIGEST IN A GUC, NOT A ROW ID VIA `SECURITY DEFINER`"*, taking option
> (A), with the rejected alternative preserved (*"becomes the most
> security-relevant object in the schema"*, a standing widening) and the cost
> accepted (*"the digest must be computed and carried on every request"*).
> Derive it: `grep -nE '^\| G160 \|' docs/HANDOFF.md`.
>
> ⚠️ **THIS IS THE CLASS `CLAUDE.md` NAMES AS WORSE THAN A ROTTED LINE NUMBER —
> a stale CHARACTERISATION rather than a stale citation.** *"A stale citation
> misplaces a fact, a stale characterisation invents one."* Two sections of this
> file reported an open owner question that had been closed, and nothing in
> `npm run check` could see it: the gate reads numbers in prose and cannot read
> the word *untouched*. **G199's own row records the same gap from the other
> side** — *"this row is S-21's and S-2 is untouched and still open"* — and that
> sentence is left standing there as the history it is.
>
> ✅ **AND BOTH HALVES ARE NOW BUILT, IN ONE COMMIT, WHICH IS #157's GOVERNING
> PRINCIPLE RATHER THAN A CONVENIENCE.** `db/migrations/0005_session_and_membership.sql`
> creates `tenant.session` and `tenant.membership`, keys the session policy on
> `handle_digest` in `app.session_ref` (G160, no `CREATE FUNCTION` anywhere —
> so the gate cost priced below was never paid), and carries G199's customer
> arm as an `AS RESTRICTIVE` `WITH CHECK`. `selectTenantForSession()` lands in
> `model/access.ts` §7a in the same commit. **The split is customer-versus-staff,
> never model-versus-database**; the staff arm is still owed and
> `tests/db/session-membership-selection.test.ts` asserts its unreachability by
> name so that the declared temporary cannot become permanent by silence.
>
> ⚠️ **ONE THING BELOW IS STILL EXACTLY TRUE AND IS THE REASON THE PRICING IS
> LEFT IN PLACE:** option (B)'s gate cost was never tested against the tree,
> because option (A) was taken. If anybody reopens S-2, the `CREATE FUNCTION`
> paragraph is the one to re-derive first — ⚠️ **and re-derive it rather than
> read it: `CREATE FUNCTION` IS in `RECOGNISED_DDL` at this commit**
> (`grep -n "create\\\\s+(?:or\\\\s+replace\\\\s+)?function" tools/planner/extract-c4-data.mjs`),
> so the sentence below has ALSO gone false since it was written.
> ⚠️ **The unblock figure below is right in form and stale in value:** 11 loose /
> 7 strict at `305c9557`; **6 by dependency and 12 by citation** at
> `origin/main` — #222 #223 #224 #226 #228 #235. G199's row states **6** and
> *"cited by 13"*.

**Unblocks 11 open issues** (loose form, `test("#157")` → **11**), of which
**7** state it as a hard dependency
(`test("(Blocked on|Depends on)[^\n]*#157")` → **7**: #216 #222 #223 #224 #226
#228 #235). **The whole A-track.**

**The decision. Two questions, and they are independent.**

**S-2 — does the `session` table's permissive RLS policy key on (A) the handle
digest in `app.session_ref`, or (B) the row id in `app.session_id`, resolved by a
`SECURITY DEFINER` function `session_id_for_token()`?**

**S-21 — does `TenantSelectionInput` carry `staffGrant: TenantAccessGrant | null`,
or does D1's scope exclude staff and say so?**

**Why it cannot be deferred.** #157 states the consequence of delay exactly: *"the
`session` table denies all access to `reconcile_app` until S-2 lands, which is
fail-closed and matches G100's polarity, but it means no session can be minted
from application code until then."* Six A-track slices sit behind it. **The
migration is forward-only under G88, so this is decided before the file is written
or never** (#228).

**The options — and S-2's two are NOT symmetric, which is a gate fact rather than
a design preference.**

- **(A) the handle digest in `app.session_ref`.** *Cost:* the digest becomes a GUC
  value on every request. **Adds nothing to the gate** — `set_config` plus a
  `CREATE POLICY`, both already inside the vocabulary.
- **(B) the row id via a `SECURITY DEFINER` function.** *Cost, stated so it is
  paid knowingly rather than discovered:* **`CREATE FUNCTION` is not in
  `RECOGNISED_DDL`**, the closed six-entry list at
  `tools/planner/extract-c4-data.mjs`. `refuseUnrecognisedDdl()` **throws**, and
  the failure lands at **`check:counts`, stage 2 of 7**, with an error naming
  `check:c4`'s scanner **four stages before `check:c4` runs**. #157: *"Choosing B
  adds a `blocking: true` GateCoupling with `mitigation: upstream_slice`,
  `mitigatedBy: M0-0`, to EVERY session slice that follows."* #169 is the slice
  that widens that list. #157 is explicit that **this is not an argument for A** —
  *"A `SECURITY DEFINER` lookup may well be the better security posture, and the
  gate is a tool we control."*

S-21's two, quoted from #157:

- **(i) The staff arm is specified.** *Cost:* one field on `TenantSelectionInput`,
  one arm in `selectTenantForSession()`, one additional `OR EXISTS (…
  tenant_access_grant …)` disjunct in the `WITH CHECK`, a seventh `it` in the
  model RED file and a fifth in the database one — **and the owner must also say
  what liveness terms admit it**, because *"a grant has its own revocation and
  expiry, and reusing the membership terms by analogy is a Builder inventing
  policy."*
- **(ii) D1's scope excludes staff, and says so.** *Cost:* one sentence in Not In
  This Slice, and a named gap in the record rather than an accident of a picker's
  input type.

**What either option must preserve.** **Invariant 8's permitted path must be
reachable.** A platform FDE holds **no `Membership`** — that is what being platform
staff means in this model. #157: *"a membership-only picker makes invariant 8's
PERMITTED path unreachable … A prohibition that is enforced by making the
permission unreachable is not an enforced invariant; it is an unbuilt feature
wearing an invariant's badge."* And for S-2, whichever key is chosen, **a session
read cannot run inside the tenant scope** (#228) — the scoped-helper count moves
from one to two, and #228 records the standing risk that *"somebody will propose a
third."*

**What the record already says.** G100 (RLS denies on NULL), G88 (forward-only
migrations, a number is an identity), G167 (`selectTenantForSession()` returns a
reasoned union accepting **either** a `Membership` **or** a live
`TenantAccessGrant`, with the class checked against **all three** constants — and
G167 exists *because* G75 found a third list nobody had named). Both options are
argued in `docs/build/stateless-adjudication.md` and **the adjudicator explicitly
declines to rule.**

**Who else is affected.** #222 (the `Session` row), #223 (the federated callback),
#224 (the resolver split), #226 (`SessionBounds`), #228 (the second scoped
helper), #235 (`/invite`), #216 (the dev token that is deleted when Session
lands), and every `/setup/admin/people` surface that is undrawn.

---

### 3.3 · G165 — does the threat-model gate hold the first unauthenticated endpoint?

**Unblocks 5 open issues** — `test("G165")` → **5** (#218 #230 #231 #232 #235).

**The decision.** G165 is **ruled and not applied**. The question is not whether it
is right; it is whether the A-9 session tier **ships behind it or in front of it**,
and #230 is the file the gate was written about.

**Why it cannot be deferred.** #230 states it as a hard gate on itself: *"This file
IS that endpoint: document-level `security: []` on a public surface, no precedent
to lean on and no second chance to set the posture."* Two costs, both real: *"Cost
of proceeding without it: the posture for every unauthenticated surface in the
product is set by whoever writes this file first. Cost of waiting: the whole
A-track wire waits."* #235's `/invite` acceptance is a **second** unauthenticated
operation and inherits the same gate.

**The options.**

- **(a) Hold — produce the D6 threat model first.** *Cost:* the entire A-track wire
  waits on a document nobody has scheduled. G165's own row calls the block *"the
  intended failure."*
- **(b) Ship the session tier and produce the threat model against it.** *Cost:*
  the posture for every future unauthenticated surface is set by the first file
  written, which is what G165 refused: *"Refused shipping first because this would
  be the first unauthenticated public endpoint, so there is no precedent to lean
  on."*
- **(c) Narrow G165 to a stated subset of the tier.** *Cost:* a gate with an
  exception in it is a gate whose next exception is cheaper, and the record has no
  precedent for narrowing a ruling taken *"on the written recommendation, in one
  act."*

**What either option must preserve.** **The realm lookup must return no
user-existence signal** (#231). That property is independent of the gate's timing
and must not be traded for it — a public realm-lookup operation that distinguishes
*no such user* from *wrong credential* is an enumeration oracle regardless of what
document exists.

**What the record already says.** **G165** — *"THE D6 THREAT-MODEL GATE LANDS
BEFORE THE FIRST UNAUTHENTICATED ENDPOINT"* (`docs/HANDOFF.md:2148`, **not
applied**).

**Who else is affected.** The four entry routes in `design/routes/entry.html`; the
six operations in #231; whichever contract tier ends up owning session
establishment (see §3.17).

---

### 3.4 · Does a tenant selector exist at all — G167 versus G179 — #219, #232

**Unblocks 5 issues naming G167** (`test("G167")` → **5**: #207 #218 #219 #231
#232) **and 7 naming G179** (`test("G179")` → **7**: #172 #207 #219 #221 #229
#231 #232). **#219's own title: one ruling closes three surfaces.**

**The decision.** **Does `POST /session/tenant` exist, and is
`selectTenantForSession()` a CHECK or a CHOOSER?** #232 restates it in one line so
the slice stands alone: *"the owner says which; the record currently asserts
both."*

**Why it cannot be deferred.** Two ruled G rows contradict each other in the tree
right now. **G167** mints a reasoned-union selector; **G179** rules the host binds
the tenant before application code runs, so there is nothing to select. #232 is
gated entirely on it, #207's entity switcher is one of four chrome controls that
*"stay hatched indefinitely"* on this collision, and #231's six door operations
cannot be counted until it lands.

**The options, quoted from #219 with their costs.**

- **Option A — the function is the CHECK.** The host binds the tenant (G179); the
  function validates that this principal may be scoped to *that* tenant, over all
  three resource-class constants, for both arms. *Cost:* `GET /session/tenants`
  and `POST /session/tenant` are dropped; *"a person who belongs to two tenants
  uses two hostnames, and the entity switcher in #207 is **deleted, not
  hatched**."*
- **Option B — the function is the CHOOSER.** *Cost:* G179's *no selector to
  defeat* is narrowed, and *"the surface it warns about — a login page that lets a
  caller name a tenant — has to be argued safe by some other mechanism, on the one
  invariant the record calls defeated **by relocation**."*
- **Option C — both, at different layers.** The host binds; the selector exists
  only **after** authentication. *Cost:* *"two mechanisms doing one job, and a
  second place where a tenant identity can arrive from a request — which is the
  shape invariant 1 exists to forbid, so this option must state what stops the
  post-auth selector widening scope."*

**What either option must preserve.** **Invariant 1, verbatim and unchanged:**
*"Tenant scope is derived from the session, never read from a request."* Option C
in particular must state its own defeat condition rather than inherit one.
Separately, whichever answer lands, **G179's DO-NOT-OVERLOAD clause survives it**:
*"DO NOT OVERLOAD `IdentityConnection.domains` … Which identity provider to try
and which tenant is being served are two different questions, and one field
answering both is one field that can disagree with itself."*

**What the record already says.** G167 (`docs/HANDOFF.md:2163`), G179 (`:2175`),
G182 and G183 — both ruled, both unbuilt, and **G182's timing is one-way**: *"It
must be decided before the first tenant hostname is published."*

**Who else is affected.** `design/routes/entry.html`'s route 1; the chrome bar's
entity switcher (#207); `dataPlaneHost` resolution (#229); `GET /session/tenants`
and `POST /session/tenant` in #232.

---

### ~~3.5~~ · SUBSUMED — G200 · Which capability authorises reading a run's engine account — #192

> 🟠 **RULED 16 Aug 2026 as G200 — see §2a — and the ruling is BROADER than the
> question.** **Options B and C below are refused outright. Option A is neither
> taken nor rejected: it is subsumed** into a single authorisation pass over
> every operation, and *"a slice that mints it alone has taken the accretion this
> row refuses."* **#192 stays OPEN.** So the three options below are still the
> options and the costs still hold — what changed is that **they may only be
> answered all at once.** ⚠️ **Option A's stated cost is already partly spent by
> something else:** the roster is **38**, not 37 — `view_endpoint` landed with
> #194 — so `view_run` would be the **39th**. ⚠️ **And
> `CAPABILITY_RESOURCE_CLASS` is at `model/access.ts:558`, not `:556`** as the
> body below says; the new capability was inserted above it, and the old citation
> still resolves.

**Unblocks the whole W-track by its own text** — every operation that track mints
*"would be gated by a capability that does not exist"* — and #202 is
`Blocked on #192` outright. It also sits on top of **MG9**, which
`docs/model-gaps.md` calls *"the largest single finding in this file"* and which
accounts for **14 of `close.html`'s 26 hatched regions**.

**The decision.** **Which capability authorises reading a run's engine account** —
the admission evidence, the post-conditions, the completeness findings, the residue
and the meters?

**Why it cannot be deferred.** MG9: *"Thirteen commits of engine work and no
operation exposes any of it."* The engine is **built** — `AdmissionRefusal`
(`model/reconciliation.ts:1066`), `SetReconciliationResult` (`:4033`),
`checkPostconditions()`, a scenario corpus behind all of it — and *"the work
cannot be reached from outside the process."* Every operation the W-track would
mint is gated by a verb that does not exist, so **no wire can be drawn until this
lands.**

**The options, quoted from #192.**

- **Option A — mint `view_run`**, a run-shaped noun, classed `tenant_data`. *Cost:*
  a 38th capability, and every stated capability count in the record moves.
  *"`promote_learning`, `view_metering` and `view_commercial` are the precedent
  that minting rather than overloading is the house move."*
- **Option B — rule that `view_summary` already covers it.** *Cost:* *"one
  capability now names two nouns, and the next reader re-opens the question unless
  the ruling is written on that capability's own declaration."*
- **Option C — split it: `view_run` for the account and `view_metering` for the
  meter facts.** *Cost:* two capabilities — **and it is the only option under
  which the meter facts need their own operation** rather than a property on the
  account, which is the trade-off #202 inherits: *"a property is one round trip
  and one schema, and it places metering behind a tenant-data verb; a separate
  operation honours invariant 5's resource-class separation and costs a path, an
  operation and a second read."*

**What either option must preserve.** **Invariant 5** — *"Money is always derived.
`UsageRecord` is immutable and unpriced — which is why `metering` is its own
resource class: it has no write mode, and it cannot live in `commercial`, whose
defining rule is that a partner may read it. A raw usage record is volume in the
clear."* Option B must state how a `tenant_data` verb reaches a `metering`-class
fact without laundering the class, because `authorize()` **refuses a class
mismatch outright** (`model/access.ts`, the `CAPABILITY_RESOURCE_CLASS` record at
`:556`) on the ground that a capability aimed at the wrong class *"is either a
caller bug or an attempt to launder a class past `PERMITTED_RESOURCES`, and
nothing here can tell which — so both refuse."*

**What the record already says.** G128 is the minting precedent, verbatim:
*"`promote_learning` BECOMES CAPABILITY 37, CLASSED `authority`, AND NEVER ENTERS
THE PARTNER MASK"* (`docs/HANDOFF.md:2049`). The roster today:

```bash
awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'   # 37
```

`CAPABILITIES` is at `model/access.ts:251` and `CAPABILITY_RESOURCE_CLASS` at
`:556` — a `Record<Capability, …>`, so an unclassified capability is a compile
error.

**Who else is affected.** #198, #201, #202 (all W-track); `/close` and
`/close/run/:runId` and their refused variant; **fourteen** of `close.html`'s
hatches; every count line in the record that states 37 capabilities.
⚠️ **That last clause is now self-referential: this line said 37 and the tree says 38**, because `view_endpoint` landed with #194 after this file was written. **The count it warns about moved before the ruling it prices was taken.**

---

### 3.6 · The session bounds — two integers and one yes/no — #226 (S-4)

**Unblocks nothing by issue count and blocks EVERY session that will ever be
minted.** This is the clearest case in the file of a low issue count meaning the
opposite of low impact.

**The decision.** **What are `maxLifetimeSeconds` and `maxIdleSeconds`, and does
`lastUsedAt` stay on the session row at all?**

**Why it cannot be deferred.** #226's own title: *"`SessionBounds` refuses on
absence, so every session refuses until somebody states the numbers."* The shape
does not wait on the answer — the type can land — but *"the tree stays unusable
until they exist."* Two drafted greens differ on the third question: *"Green A
takes `lastUsedAt` off the row; green B keeps it with idle expiry."*

**The options.**

- **(a) State them all as required configuration that refuses on absence.**
  *Cost, stated plainly by the issue:* *"with no numbers, session resolution
  refuses every session and none can be minted — the intended failure."*
- **(b) Ship a default.** *Cost:* **this is what G139 exists to refuse.** *"A
  silently-unbounded session is the outcome a default produces, and nobody would
  ever discover the number was never chosen."*

⚠️ **This file states no number.** `PRODUCT.md` forbids inventing one and #226
names the owner as the source: *"The owner supplies two integers and one yes/no."*

**What either option must preserve.** **Refuse-on-absence is how the absence stays
loud.** Whatever numbers arrive, the mechanism that refuses without them is the
control; replacing it with a default removes the only thing that would ever
surface the omission.

**What the record already says.** G139 (defaults refused for exactly this class);
`docs/build/stateless-green-session.md` for the two drafted greens; MG5 — *"No idle
timeout and no session lifetime."*

**Who else is affected.** #222 (the `Session` row's field set), #228 (the session
scope), `design/routes/entry.html`'s `/signin/lapsed` route, which draws a lapse
whose duration nothing states.

---

### 3.7 · The passkey shape — a credential in the pool, or a fourth protocol — #233

**Blocks the drawn PRIMARY action on `/signin`.** #234 names it as the same hole.
The passkey is modelled nowhere:

```bash
grep -rniE 'passkey|webauthn|fido' model/*.ts docs/contracts/*.yaml | wc -l   # 0
grep -rci 'passkey' docs/HANDOFF.md CLAUDE.md docs/access-and-agency.md       # 0 0 0
```

**The decision.** The product owner asked for passkey sign-in. **Where does a
passkey live?** The Microsoft-365 half of the same request needs **no model change
at all** — Entra ID is OIDC and `IDENTITY_PROTOCOLS` (`model/domain.ts:1337`)
already closes over `saml · oidc · cognito_pool`. **Only the passkey half is
open.**

**Why it cannot be deferred.** `design/routes/entry.html` draws the passkey button
**first and hatched**, and says why in its own words: *"the strongest credential is
drawn first, where a reader cannot miss it, and hatched, because putting it last
would have hidden a decision nobody has taken yet."* The primary action on the
sign-in screen refuses until this lands. It also gates #234's second-factor
recovery path — *"there is no password to fall back to by design and the passkey
question (#233) is the same hole."*

**The options, quoted from #233 and the drawn route.**

- **(a) A credential inside the `cognito_pool` connection.** The pool exists per
  account already, **org derivation is untouched**, and a passkey becomes one more
  way that one directory authenticates. *Cost:* *"a customer whose people sign in
  through their own directory **cannot hold a passkey without ALSO holding a pool
  connection** — and then **one person has two doors**."*
- **(b) A fourth `IdentityProtocol`.** *Cost:* *"`protocol` stops meaning *which
  kind of directory* and starts carrying a credential; and since every connection
  needs an `owner`, somebody must then say **whose connection owns a passkey
  registered on the platform's own sign-in page**."*

**What either option must preserve — and this is the line the row exists for.**
**A passkey must resolve to exactly one `IdentityConnection`, or org derivation
stops being total.** The `cognito_pool` declaration is explicit about why
(`model/domain.ts:1340-1345`):

> The managed fallback pool — PER ACCOUNT, never shared. A customer with no
> directory of its own still has an OWNED connection, so org derivation stays
> total and no exception is carved into it.

A credential belonging to no connection **carves precisely that exception**,
leaving `orgClass` underived for whoever used it — the one exception `cognitoPool`
was minted to prevent.

**What the record already says.** The federation block at `model/domain.ts:1311-1335`
records why the type shifted from kind to instance: *"A kind cannot do that,
because every customer shares `cognito`: partner staff and customer users came out
identical, and the derivation collapsed the two org classes it exists to
separate."* `IdentityConnection.owner` (`:1368`) is *"server-set and immutable
after creation: whoever could edit this could mint principals of any organisation
at will."* Nothing in `docs/HANDOFF.md` §3 mentions a passkey at all.

**Who else is affected.** `design/routes/entry.html` routes 1 and 2; #234
(second-factor recovery); #235 (enrolment has *"no surface, and no invitation type
to enrol against"*); the session tier's operation list in #231.

---

### 3.8 · Is `/invite` in v1, and is a member provisioned or invited — #235

**Blocks passkey enrolment and one of the four drawn entry routes.** MG7:

```bash
grep -rniE 'export (interface|type|const) [A-Za-z]*Invit' model/*.ts | wc -l   # 0
grep -rniE 'just-in-time|jit provision|provisionUser|firstSignIn' model/*.ts docs/*.md docs/build/*.md | wc -l   # 0
```

**The decision. Two halves, and only the first is in #235.**

**(i) Is `/invite` in v1, and does acceptance mint a `Membership` directly or an
`AuthorizationGrant` that a separate act redeems?**

**(ii) — NOT IN ANY ISSUE, AND IT IS THE HALF WITH NO WRITING ANYWHERE: is
membership JIT-provisioned on first federated sign-in, or invitation-only?** A
person authenticates successfully against a verified `IdentityConnection` and has
no `Membership`. **Nothing in the tree says what happens.** The grep above returns
**0** for every JIT spelling, and **0** for any invitation type — so today the
answer is *neither*, which is not a decision.

**Why it cannot be deferred.** #235: *"passkey enrolment has nothing to enrol
against."* And #235 places itself last deliberately, for a reason that binds
whichever way (ii) is answered: *"an invitation mints a `Membership`, and a
`Membership` is the input the tenant-selection check reads, so building the mint
before the gate is building the write path before the check."* Under JIT the
identical sentence applies to the directory.

**The options.**

For (i), quoted from #235:

- **(a) Accept mints a `Membership` directly.** *Cost:* *"an authority widening
  with no `AuthorizationGrant`, which invariant 10 forbids — so this option
  requires amending invariant 10 or adding the invitee to
  `AUTHORIZATION_MAY_BE_ABSENT`, and both are larger decisions than the feature."*
- **(b) The INVITER's act carries the authorisation**, acceptance redeems it.
  *Cost:* *"the grant exists before the invitee does, so it must be revocable and
  time-boxed independently of the invitation."*
- **(c) `/invite` is out of v1.** *Cost:* *"passkey enrolment has nothing to enrol
  against, and the drawn route is withdrawn rather than hatched."*

For (ii):

- **JIT — a successful federated authentication provisions a `User` and a
  `Membership`.** *Cost:* the authority-widening act has **no human actor at all**,
  so `AUTHORIZATION_MAY_BE_ABSENT`'s single admitted kind (`system`) is either
  stretched to cover it or a new kind is minted; and the customer's directory
  becomes the grant surface, which makes an IdP group misconfiguration an
  authorisation change nobody at 1CloudHub sees. The record already accepts a
  weaker form of this cost — `model/domain.ts:1333-1334`: *"the directory becomes
  load-bearing for an authorisation decision, so an IdP misconfiguration is an
  authorisation bug."* JIT widens it from *which org* to *whether a member exists
  at all*.
- **Invitation-only.** *Cost:* every customer onboarding needs an inviter with a
  session before anyone else can have one, so the **first** member of a tenant is
  provisioned by a path that is not `/invite`, and that path is undrawn and
  unfiled.

**What either option must preserve.** **Invariant 10 — *"An act with no
authorisation is unrecordable."*** `authorize()` mints an `AuthorizationGrant` and
nothing else does; `AUTHORIZATION_MAY_BE_ABSENT` (`model/governance.ts:1232`) is a
`Record<AuditActor['kind'], boolean>` admitting exactly one kind, `system`, **and
neither an invitee nor a first-time federated arrival is `system`.** #235 states
the property in the form that survives any answer: *"narrowing is automatic;
widening is an act."*

**What the record already says.** MG7; invariant 10 in `CLAUDE.md`;
`docs/access-and-agency.md` **(d) Guests are refused and sent to their home realm**
— *"An IdP asserts directory membership, not employment"* — which is the nearest
the record comes to ruling on directory-driven membership and rules the opposite
direction for one specific case. `docs/access-and-agency.md` **(c) SCIM push for
deprovisioning** records that *"Connections without SCIM — the managed pool,
smaller IdPs — still need a manual disable path. Stated rather than assumed
away."*

**Who else is affected.** `/invite` in `design/routes/entry.html`; the
`membership` table (*"whichever slice mints it, it is minted once, and #157 is the
current claimant"*); `/setup/admin/people`, which is undrawn; #157's S-21, because
a staff grant and a membership are two different provisioning stories.

---

### 3.9 · Is a second factor in v1, and is a lockout — #234

**Blocks one conditional operation in #231** and two declared fields that would
otherwise have no producer.

**The decision. Two questions, neither in any existing S-number.**

**(i) Is a second factor in v1?** **(ii) Is a lockout in v1?**

**Why it cannot be deferred.** #234's title: *"`Session.secondFactorAt` will have
no producer, and nothing counts a failed attempt."* #231 carries the wire
consequence: *"`POST /session/second-factor` ships only if a second factor is ruled
into v1."*

**The options, with costs quoted.**

- **(i) No.** *"`Session.secondFactorAt` and `resolveSubject()`'s
  `secondFactorRequired` **should not be declared** — a field with no promotion
  path is a promise the product cannot keep."*
- **(i) Yes.** *"a factor type, a challenge with replay refusal, an enrolment
  surface, **and a recovery path — and recovery is the hard half, because there is
  no password to fall back to by design and the passkey question (#233) is the
  same hole**."*
- **(ii) Yes.** *"the threshold and the duration are **numbers the owner
  states**"* — this file invents neither.
- **(ii) No.** *"the record should say so, because an unbounded credential-guessing
  surface is a decision either way."*

**What either option must preserve.** **A declared field must have a producer, or
it must not be declared.** That is #234's whole argument and it is the property
both answers have to respect: shipping the wire shape now *"puts a wire on a
mechanism with no model — the shape the record calls a control that exists as a
declaration"* (#231).

**What the record already says.** MG3 (*no second factor anywhere*), MG4 (*no
lockout policy, attempt counter or lock state*). ⚠️ **A related item is ruled out
by RECOMMENDATION rather than by the owner and should be confirmed or reversed in
the same sitting: S-5, *sign me out everywhere*.** #234 records the
recommendation as **no** for v1, *"the lever is `User.status`, and incident
response cannot list live sessions."* **That is an issue's recommendation, not a
ruling.**

**Who else is affected.** #231 (one operation and an `ErrorCode` pair minted in
#230 that has no operation until then); `design/routes/entry.html`; #233.

---

### 3.10 · The arrivals denominator — MG11

**`docs/model-gaps.md` pulls this out of the list of thirty as one of two that are
*"different in kind"*.** It is named by #211 and #212.

**The decision.** **Does a source-side control total enter the system at the point
of arrival — and if so, from where?** The engine knows what it was **PRESENTED**.
Nothing in the tree knows what **ARRIVED**.

```bash
grep -rniE 'arrivedRows|expectedRows|arrivalManifest|declaredRowCount' model/*.ts | wc -l   # 0
grep -n 'presentedRowsOnSide' model/reconciliation.ts    # 1527 (declaration) · 1926 · 4423 · 4436 · 4461 · 4467
```

**Why it cannot be deferred — and why it is not merely unbuilt.** MG11: *"Every
other gap is **unbuilt**: someone writes a type, an evaluator, an operation, and it
closes. This one is **uncomputable from anything the tree holds.** No amount of
code written against the current model produces the number, because the fact —
*what was sent* — enters the system nowhere. Closing it requires a **source-side
control total** at the point of arrival, which is an ingestion decision and a
counterparty conversation before it is a type."*

🛑 **And it got sharper rather than softer.** G153's third outcome `incomplete`
landed in `RunStatus` and on the wire while `docs/model-gaps.md` was being written,
so *"`incomplete` is now a **declarable outcome with no producer**"*.
`checkPostconditions()` is an internal-consistency check over the **admitted** set,
*"so the engine can say *what I was given balances* and can never say *I was given
everything*."* MG11: **"A representable state that nothing can compute is a worse
position than an absent one, because a reader of the union will reasonably assume
something sets it."**

**The options.**

- **(a) A source-side control total is required at arrival**, declared by the
  sender or by the intake channel's configuration. *Cost:* it is *"an ingestion
  decision and a counterparty conversation before it is a type"* — a counterparty
  that will not supply one blocks its own reconciliation, and the intake
  vocabulary (G184's four channels) has to say what a missing total does per
  channel.
- **(b) No denominator; coverage is withdrawn as a claim.** *Cost:* every *"N of
  M"* on `/close`, every coverage meter, and every completeness sentence on
  `/reports` is redrawn or removed — and `RunStatus.incomplete` becomes an
  outcome with no producer that the wire nevertheless carries.
- **(c) A per-document trailer stands in for the run-level total.** *Cost:* this is
  the same object #198 is about, and it answers a **document** question rather
  than a **population** one — a run over a complete document set that was missing
  a whole document still reports clean.

**What either option must preserve.** **`presentedRowsOnSide` must keep folding
rather than reading `documents.length`** — its own docblock says so in capitals at
`model/reconciliation.ts:4423`, and it is correct behaviour for what it is. **The
denominator is a new fact from outside, not a repair to an existing fold.**
Whatever lands, a coverage figure must not be computed from the population the
engine already holds, because that number is a tautology.

**What the record already says.** **G153** rules the outcome and is ✅ applied for
the member; **the denominator is ruled by nothing** — MG11 says exactly that.
**G155**'s consequence column: the Coverage denominator *"would have to be ARRIVALS,
which nothing in `model/` can compute until the arrival ledger exists."*
**G184**'s: *"`model/ingestion.ts` does not exist (`module_specified_not_written`,
affects 20)."*

⚠️ **A ruling-shaped gap rides along and #177 raises it as G-Q1: no G row rules the
arrival ledger into existence, and four rows already depend on it** — G152, G154,
G155 and G184 all presuppose `IngestArrival` and `model/ingestion.ts`.

**Who else is affected.** `/close` and `/reports`; #211 (*"the count line has to
state a denominator the tree cannot compute"*); #176 and #177 (the intake slices);
the fourteen `close.html` hatches that MG9 already claims.

---

### 3.11 · The register's noun — *finding* or `Exception` — #212

**Costs differ by an order of magnitude across three options and #212 says so:
*"none is free."***

**The decision.** **Does the wire noun become *finding*, does the drawing become
*exception*, or does a mapping layer carry both?** The drawn bundle says *finding*;
the model and all four contract tiers say `Exception`; **no `Finding` type
exists.**

```bash
grep -n 'export interface Exception ' model/domain.ts        # 3060
grep -rn 'export interface Finding\b' model/*.ts | wc -l     # 0
grep -c 'Exception' docs/contracts/capability.openapi.yaml   # 53 matching lines
grep -roi 'finding' Mockups/rec/*.dc.html | wc -l            # 42 occurrences in the screen pack
```

**Why it cannot be deferred.** #212 is *"the only drawn route whose register has
live operations behind it"* — it is the one F-track slice that can actually be
built, and it cannot be built until the register knows what it is called.

**The options, quoted with costs.**

- **(i) Rename the wire noun across four tiers.** *Cost:* *"67 paths in scope,
  (⚠️ **this said 67 and the tree says 69** — #259 declared two more after this was written; the cost is larger, not different)
  `tools/check-wire-mirror.mjs` gains pairs, and every `model/domain.ts:NNN`
  citation downstream of the edit shifts — which `tools/check-citations.mjs`
  **structurally cannot catch, because the citations still resolve**."*
- **(ii) Map at the client boundary.** *Cost:* *"one place, but **two vocabularies
  survive** — §5.3, and precisely what G71 chose one TypeScript vocabulary to
  collapse."*
- **(iii) Redraw the screens to say *exception*.** *Cost:* *"12 files, 186
  occurrences, and it discards the word every drawn screen and the screen-pack
  ledger already use."*

**What either option must preserve.** **One vocabulary, or a mapping with exactly
one home.** §5.3 (*"Two vocabularies for one concept, diverging"*) is the record's
most-recurring defect shape, and option (ii) accepts it knowingly rather than by
accident — which is a different thing, and must be written as such on the mapping
module if it is chosen.

**What the record already says.** G71 chose one TypeScript vocabulary end to end
*"in order to collapse [§5.3] structurally rather than procedurally"* (#188's
phrasing of the same argument). `docs/HANDOFF.md` §5.3 is the catalogue entry.

**Who else is affected.** All four contract tiers; `tools/check-wire-mirror.mjs`;
`docs/screen-pack-ledger.md`'s join rows; twelve drawn screens; every downstream
`model/domain.ts:NNN` citation in the record.

---

### 3.12 · The confirm capability and the quantity floor — #214 (MG21, MG24)

**The decision. Two, and they land on the same route.**

**(i) Is capability 38 minted for confirming or correcting an extracted value, and
against which of the thirteen resource classes?** *(Sixteen since R10, 1 Oct 2026 — none of the three new ones is a candidate: they are a partner firm's own surface.)*

**(ii) Does a quantity floor exist at all, and is it a third field or a
derivation?**

**Why it cannot be deferred.** #214's title: *"The confirm act is a write drawn
over a read-only authority."* MG21: *"`/close/finding/:ref/confirm` is a write
drawn over a read-only authority, and under invariant 10 an act with no
authorisation is unrecordable."* MG24: *"The inventory floor the blocked posting is
measured against has no home, no owner and no version."*

```bash
awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'   # 37
grep -rniE 'operationId: .*(confirm|correct)' docs/contracts/*.yaml | wc -l                 # 0
grep -rniE 'quantityFloor|minQuantity|quantityCeiling|onHandQuantity' model/*.ts | wc -l    # 0
```

**The options for (i), quoted.**

- **Option A — mint it, classed `tenant_data`.** *Cost:* *"a 38th capability, an
  operation, a wire pair, and every stated capability count moves."*
- **Option B — rule the act out of v1.** *Cost:* *"the confirm route is withdrawn
  from the drawing, not merely hatched, because a route that can never be built is
  not a hatch."*
- **Option C — fold it into an existing verb.** *Cost:* *"one capability names two
  acts, and correcting an extracted value is a **write over data an agent
  produced** — folding it into a read verb widens what that verb authorises without
  anyone deciding to."*

For (ii): a third field on the relevant type, or a derivation from existing
ceilings. ⚠️ **`AssignmentScope.valueCeiling` is `Money | null`
(`model/access.ts:722`, the interface at `:679`) and
`AutonomyConfig.autoResolveValueCeiling` is `MoneyAmount | null`
(`model/policy.ts:155`, the interface at `:138`) — MG24: *"No function converts
between them and neither is a quantity."*** **No number may be invented for the
floor either way; `PRODUCT.md` forbids it.**

**What either option must preserve.** **Invariant 10 — an act with no
authorisation is unrecordable.** Options B and C both have to say what records the
confirm act, not merely what permits it. And **capability 38 is contended**: #192
(§3.5) and #214 and G173 (already ruled, §2) each want a thirty-eighth capability.
**Whichever lands first moves every stated count in the record**, so the batch
should state the order rather than let three slices each discover it.

**What the record already says.** G128 is the minting precedent
(`docs/HANDOFF.md:2049`). MG21 and MG24 both read **Ruled: —**.
`ACCESS_RESOURCE_CLASSES` is at `model/governance.ts:141`.

**Who else is affected.** `/close/finding/:ref/confirm` and `…/post`;
`Finding.dc.html`; #213, which *"renders each as refused rather than waiting on
them"*.

---

### 3.13 · The undo / reversal window — MG20

**The decision.** **Does a reversal window exist at all, and what bounds it?**

**Why it cannot be deferred.** MG20: `ExceptionReversal` (`model/domain.ts:3048`)
records that a reversal **happened**; `Reversibility` classifies how hard a
disposition is to undo; **no field bounds when.**

```bash
grep -rniE 'reversalWindow|undoWindow|withinMinutes|gracePeriod' model/*.ts | wc -l   # 0
```

🛑 **And the drawn product already states a duration the model cannot hold.** MG20:
*"The pack's *four-minute reversal* and every drawn countdown are therefore
**invented durations**, which `PRODUCT.md` forbids."* The only *"undo window"* in
the tree is `model/governance.ts:1369`, where `undo_window_expiring` is discussed
as a drawn **screen event name** and **explicitly ruled not a `ServiceNoticeKind`.**

**The options.**

- **(a) A bounded window exists**, expressed as a field on the disposition or its
  config. *Cost:* **the owner supplies the duration** — this file states none — and
  the countdown becomes a real clock with a real expiry event, which reopens the
  `ServiceNoticeKind` question `model/governance.ts:1369` closed.
- **(b) No window; reversibility is classified but not time-boxed.** *Cost:* every
  drawn countdown is removed from the screens rather than hatched, because a
  countdown with no bound is not a hatch — it is a false statement.
- **(c) The window is per-disposition, derived from `Reversibility`.** *Cost:* the
  derivation needs a duration per class, which is *n* numbers instead of one, and
  each is still the owner's to state.

**What either option must preserve.** **No invented duration reaches a screen.**
`PRODUCT.md` is the authority and MG20 already flags the pack's four-minute figure
as a violation. Option (b) is not the cheap escape it looks like: it requires the
drawn countdowns to be **withdrawn**, not left grey.

**What the record already says.** MG20 reads **Ruled: —**.
`model/governance.ts:1369` is the one place the concept appears and it is a
negative ruling on the notice kind, not on the window.

**Who else is affected.** `/close/finding/:ref/post`, `/reports`, `Finding.dc.html`
and every drawn countdown in the pack; #213, which renders it refused.

---

### 3.14 · Segregation of duties against an agent proposer — MG23 and `screen-pack-ledger` §5.6

**`docs/screen-pack-ledger.md` §5.6 states the stakes in one sentence: *"The
product's most-referenced control is, against the actor the product is built
around, an assertion of nothing."***

**The decision.** **What does `ApprovalConfig.segregationOfDuties`
(`model/policy.ts:231`, the interface at `:172`) mean when the proposer is an
agent, and which of the two candidate fixes lands?**

**Why it cannot be deferred.** MG23: *"The preparer/reviewer strip on the drawn
screen cannot claim a separation the field does not enforce, and **both candidate
fixes are decisions rather than edits**."* §5.6: *"`Finding.dc.html` makes the
preparer/reviewer strip the one place the rule is drawn in full, and says **every
greyed control elsewhere refers back to it**."* So the control is referenced by the
whole pack and satisfied trivially by the actor the product is built around.

⚠️ **MG23 is counted OUT of `docs/model-gaps.md` §4's shape** — *"the field is
present; what is missing is an evaluator with a meaning against a non-human
proposer."* It is a semantics ruling, not a missing type.

**The options.**

- **(a) An agent proposer never satisfies the reviewer role**, so an agent-proposed
  disposition always requires a human reviewer distinct from any human who
  configured the agent. *Cost:* the autonomy dials become narrower than
  `AutonomyConfig` currently permits, and every auto-resolution path has to state
  whether it is exempt or blocked — which reopens what `autoResolveValueCeiling`
  (`model/policy.ts:155`) is for.
- **(b) The separation is between the agent's *operator* and the reviewer**, so the
  check compares the human behind the proposal against the approver. *Cost:* it
  requires a producer for *"the human behind the proposal"* that
  `ProposalActor`'s agent arm does not carry as an authority, and it makes a
  configuration fact (who set the agent up) load-bearing for an approval decision.
- **(c) Rule the field vacuous against an agent and say so on the declaration.**
  *Cost:* §5.6 stands as written and the drawn preparer/reviewer strip is redrawn
  to stop claiming a separation — twelve screens refer back to it.

**What either option must preserve.** **The drawn control must not claim a
separation the evaluator does not enforce.** That is the property §5.6 names and it
binds all three options, including (c) — a vacuous field that stays silent is
§5.6's own defect class, *"a control that reads as asserting something and asserts
nothing"*.

**What the record already says.** MG23 reads **Ruled: —**.
`docs/screen-pack-ledger.md` §5.6. Adjacent and unmitigated: **G43**'s consequence
**(1) the structuring bypass** — *"A post above the ceiling splits into two below
it and both pass"* — whose recommended mitigation (a shared correlation id making
the split visible to an approver) is **not taken and blocked by nothing**
(`docs/HANDOFF.md:1883`). **These two should be ruled together**: both are about an
approval control that a determined or automated proposer walks around.

**Who else is affected.** `Finding.dc.html` and every greyed control referring back
to it; `/close/finding/:ref/post`; #213; `PostingCheck.dc.html` via §5.5.

---

### 3.15 · Domain claims — how the challenge is stored, whether verification lapses, and whether two owners may claim one domain — #221

**The decision. Three, and the third is in no issue.**

**(i) How is the DNS-TXT challenge stored?** **(ii) Does a verification expire, and
does a lapse BLOCK or WARN?** **(iii) — NOT IN #221 — may two `IdentityConnection`s
with DIFFERENT owners verify the same domain?**

**Why it cannot be deferred.** #221: *"`IdentityConnection.domains` is `string[]`.
**No token, no timestamp, no verified flag, nothing.**"* The declaration
(`model/domain.ts:1383`, interface at `:1355`) calls the missing control by name:

> **VERIFICATION IS THE CONTROL, NOT A NICETY.** Unverified claiming is a takeover
> vector: a partner that registers a customer's domain captures those logins AND
> the organisation those users resolve to.

**So an unverified claim does not merely misroute — it decides `orgClass`, which is
the axis invariants 2 and 8 are built on.** And (iii) is unanswered anywhere:

```bash
grep -rniE 'domainUnique|uniqueDomain|domain.*already claimed|one connection per domain' model/*.ts docs/*.md | wc -l   # 0
```

**The options.**

For (i), quoted from #221:

- **(a) Store a digest** of a platform-minted token, compare on verification, never
  re-derive. *Cost:* *"a stored secret-adjacent value, and a verification that
  cannot be re-checked against DNS without a fresh challenge."*
- **(b) Store nothing and re-query DNS on every route.** *Cost:* *"no secret at
  rest, but **a DNS lookup on the hot path** … and a resolver failure then becomes
  an authentication outage."*

For (ii): **block on lapse** *"closes the takeover window and can lock a tenant out
of its own IdP on a clerical failure"*; **warn on lapse** *"keeps them in and
leaves the window open."* ⚠️ #221 argues the **opposite polarity** to
`TenantContact.verificationExpiresAt`, which warns — *"The owner should confirm the
reversal rather than let a test assert it silently."*

For (iii):

- **Refuse a second claim.** *Cost:* a customer that legitimately runs two
  directories over one domain during a migration cannot, and the record explicitly
  contemplates estates like this — `model/domain.ts:1363-1366`: *"many connections
  per one owner is fine, because a group with subsidiaries or a post-acquisition
  estate legitimately runs two directories."*
- **Permit it across owners, resolved by the realm override.** *Cost:* home-realm
  routing has two candidates for one domain and something must break the tie
  deterministically — and the tie-breaker becomes the thing that decides `orgClass`
  for that login. The record's own sentence is the constraint and not the answer:
  *"A realm-URL override may select which connection TRIES — dual affiliation is
  real — but it never widens … Routing chooses the door; the door decides."*
- **Permit it within one owner only.** *Cost:* it makes the cross-owner case a
  refusal that somebody must be told about, and #220's absent connection label
  (§4) is then the only thing distinguishing the two rows on a support console.

**What either option must preserve.** **A domain claim must never be able to widen
an org.** `model/domain.ts:1378-1381`, verbatim: *"it never widens: arriving at the
platform realm cannot make anyone `platform`, only the platform connection
authenticating them can."* And **the challenge preimage is never stored in
clear** — #221: *"`Session.handleDigest` and `SubjectIndexEntry.subjectRef` both
establish that this repository stores a **digest** and never the preimage."*

**What the record already says.** The four live `verifiedAt: Timestamp | null`
precedents — `Endpoint` (`model/domain.ts:754`), `TenantContact`, `model/billing.ts`,
`model/correspondence.ts` — and **`Endpoint`'s own docblock points AT this gap**:
*"the same takeover vector DNS verification closes for an IdentityConnection's
domains."* `docs/access-and-agency.md`: *"Domain verification (DNS TXT) is the
control, not a nicety."* **G179's DO-NOT-OVERLOAD clause** binds the shape.

**Who else is affected.** `design/routes/entry.html`'s five annotated panels, which
*"printed `verified` as an ordinary scope fact while the FINDINGS list conceded the
type could not hold it"*; #220 (the connection label); the identity migration's
child table; `errors.yaml`, where `domain_not_verified` does not yet exist.

---

### 3.16 · Is `/reports` in v1 at all — #203

**The decision.** **Building the route means reversing a whole-module drop —
`model/presentation.ts` is `@dropped-for-v1` whole.** That is *"a scope decision
under G32, not a build one"*.

**Why it cannot be deferred.** #203's title: *"six nouns return zero exports between
them"*. A drawn route stands over nothing, and a drop reversal is the largest
category of scope change the record has.

**The options, quoted with costs.**

- **(a) Leave it dropped** and remove the drawn route from the v1 target. *Cost:*
  *"the drawn screen. Cheapest and honest."*
- **(b) Mint the six nouns** plus a retention schedule, an `FxRate` and an
  `ExportApproval`. *Cost:* *"the largest single scope addition on the board, and
  it reopens a module dropped whole."*
- **(c) Build only the export request and its status** over the three live
  operations, placed on `/close`, and drop the destination. *Cost:* *"smallest, and
  it discards the period hand-off the screen was drawn for."*

**What either option must preserve.** **A drop is reversed on the declaration or
not at all.** `CLAUDE.md`: *"`drop_for_v1` — the type stays declared, carries a
dated note, and gets no table, no endpoint, no code."* Building against a dropped
type without moving its marker is the failure mode the marker exists to prevent.

**What the record already says.** MG28: *"the module drop is ruled; the destination
is not."* MG30 (no retention schedule, no export approval); MG29 (no FX rate
anywhere) — and **G67** already demands exactly one `parseFxRate()`, so option (b)
inherits a shape rather than choosing one. **§5.4 of `docs/screen-pack-ledger.md` is
a worked warning here**: pinned answers were resolved into v1 on 7 Aug evening and
**cancelled hours later by G57 and G68**, with the ledger recording the
cancellation *"including the scope machinery, which is the part that must not be
left behind."*

**Who else is affected.** `design/routes/reports.html`; `Reports.dc.html`;
`Ask.dc.html`'s pin-to-report hand-off; `docs/v1-scope-ledger.md` §10.

---

### 3.17 · One name for the setup region — `Setup`, `Definitions`, or `Administration`

**The decision.** **The drawn world, the route namespace and the contract tier use
three nouns for one region, and nothing rules which is canonical.**

```bash
for w in setup definitions administration; do \
  echo "$w: $(grep -oiE "\\b$w\\b" design/system/wayfinding.html | wc -l)"; done
#   setup: 45 · definitions: 9 · administration: 10   (occurrences, not lines)
grep -oE '/setup[a-z/:]*' design/routes/index.html | sort -u
#   /setup · /setup/admin/notifications · /setup/admin/people · /setup/admin/support
#   /setup/definitions/document · /setup/definitions/posting · /setup/definitions/reconciliations
ls docs/contracts/administration.openapi.yaml     # No such file or directory
```

So: the **door** is `Setup`; its **two columns** are `Definitions` and
`Administration`; the **route namespace** is `/setup/definitions/*` and
`/setup/admin/*`; the **contract tier** is `administration.openapi.yaml`; and
`docs/screen-pack-ledger.md`'s tier table calls the whole thing **Tier 2 ·
Definitions** while `Setup.dc.html` is *"the Definitions hub, and the Tier 3
door"*.

**Why it cannot be deferred.** The contract file has not been written yet. **G76
already ruled it is one file** — so the name is settled for the file and unsettled
for everything that points at it. `docs/screen-pack-ledger.md` §5 and
`docs/HANDOFF.md` §5.3 both treat a divergent vocabulary as a defect shape rather
than a cosmetic; §5.3 is *"Two vocabularies for one concept, diverging"*, and this
is three. #209 has to enumerate *"every Setup item by name"* in a test, so the test
encodes whichever name is chosen.

**The options.**

- **(a) `Setup` is the door and `Definitions`/`Administration` are its two columns
  — the drawn arrangement, made canonical.** *Cost:* the contract tier is named
  `administration` for one of two columns, so the file name under-describes the
  file. G76's ruling is on **one file**, not on the name, so this costs a note on
  the contract rather than a re-ruling.
- **(b) `Administration` is canonical throughout**, and the drawn `Setup` door is
  renamed. *Cost:* **45 occurrences in `design/system/wayfinding.html` alone**, the
  `/setup/*` route namespace across seven routes (three drawn as cards, seven
  undrawn), and the drawn argument that the door exists *"for the person who does
  not yet know what the thing is called"* — which is an argument for the plainer
  word.
- **(c) Two tiers rather than one — `definitions` and `administration` as separate
  contract files.** *Cost:* **this reopens G76**, which settled a contradiction
  *"that had sat unnoticed across six documents"*, and G76's own reasoning is that
  the boundary becomes **mechanical** via plane tags *"instead of structural"*. It
  also doubles the surface `tools/check-plane-tags.mjs` — which does not exist —
  must cover.

**What either option must preserve.** **One noun per concept in the built product,
and a mapping with exactly one home if two survive.** §5.3 is the shape; the same
constraint that binds §3.11's *finding* / `Exception` question binds this one, and
they are the same defect class appearing twice.

**What the record already says.** **G76** — one file, enforced plane tags, and
*"THE CHECKER LANDS IN THE SAME COMMIT AS THE FILE"* (`docs/HANDOFF.md:1997`).
**G58** — *"`administration.openapi.yaml` becomes the largest single deliverable in
v1 rather than a gap"* — ⚠️ **and G58 is itself blocked**: *"there is nothing to
author WITH"*, because G2's pack-declared palette is the customer's sole authoring
vocabulary and **G37, already applied, put the palette in v2 packs only.** So the
naming ruling and the palette ruling (§4) meet on the same file.

**Who else is affected.** `docs/contracts/README.md:100` (*"the setup surface"*);
`Setup.dc.html`; #207's Setup door; #209's palette test; the seven undrawn
`/setup/*` routes.

---

## 4. Bounded and independent — smaller rulings, same fields, compressed

**These are in the batch and each is genuinely bounded.** Each row carries the same
six things in shorter form. **None is recommended here**; where the source issue
recommends, the recommendation is attributed.

### 4.1 · May a bucket key appear on a tenant-facing operation — #201

**Decision:** may a normalised identifier extracted from a counterparty's document
reach a tenant-facing operation? **Blocked:** #201 (W-9). **Options:** **(A)
verbatim** — *"counterparty-controlled text on an operator surface, in a module
that has spent fifteen assertions keeping it out"*; **(B) counts plus `ItemRef`
addresses** — *"an operator cannot see which bucket, only how many and which
rows"*; **(C) a stable hash** — *"an operator cannot read it, and a hash of a
low-cardinality identifier is not a redaction."* **Must preserve:** invariant 6,
*"Ingested content is data, never instruction."* ⚠️ **#201's own caveat survives
every option:** *"the fact that `SetReconciliationResult` has no `AssertNoTextDeep`
site today is a finding in its own right and does not go away with option A."*
**Record:** `SetReconciliationResult` is at `model/reconciliation.ts:4033`;
`AssertNoTextDeep` bans the type `string` at a property position and **nothing
else** — `CLAUDE.md` is explicit, and the owner's inversion of it to an allow-list
is **ruled and not applied**. **Affects:** `/close`, the residue panel, #213.

### 4.2 · Per-document control totals, emitted unconditionally — #198

**Decision:** does `SetReconciliationResult` gain a per-document control-total
record, emitted **including** for documents whose trailer was met? **Blocked:**
`/close` panel 3 cannot draw a complete table. **Options:** **(A) grant it** — on
G114's posture that a bound that was hit is recorded rather than silently absorbed,
and C13's precedent that `admissionRates` is unconditional for the same reason;
*cost:* a fourth result channel, *"which C18 refused once"*; **(B) refuse it** —
*cost:* the panel's `done` rows are **withdrawn from the drawing**; **(C) a derived
read at the caller** — *cost:* *"the derivation lives at call sites, which is the
correctness-drifts shape G111 exists to prevent."* **Must preserve:** a document
whose trailer was MET must not become invisible — that is the finding, and (B)
answers it by removing the claim rather than by hiding it. **Record:** G114, C13,
C18, G111. **Affects:** `close.html` panel 3; §3.10's denominator question, which
this does **not** answer.

### 4.3 · A human-readable label on `IdentityConnection` — #220

**Decision:** **(i) required or nullable? (ii) who writes it — us or the
customer?** **Blocked:** *"at two connections the picker has nothing truthful to
print."* **Options:** *"required costs a fixture sweep now; nullable costs the
fallback risk forever"* — and the fallback is *"`protocol`, which is the exact
defect the field exists to prevent."* On (ii): `owner` is *"server-set and
immutable after creation"*, a label mints nothing, so customer-editable is
defensible — **but** *"a customer-supplied string that a platform operator reads in
a support console is untrusted text on an operator surface, and **nothing in this
repository has ruled on that class**."* **Must preserve:** the label must never be
derivable from `protocol` — #220's red test exists to make that mutation fail.
**Record:** `IdentityConnection` at `model/domain.ts:1355`. **Affects:** the realm
picker; every operator console; §3.15(iii), where the label is the only
distinguisher between two rows claiming one domain.

### 4.4 · May the repository take an AWS SDK dependency — M4-1-B (#156)

**Decision:** may this repository take an AWS SDK, and which one? **Blocked:**
*"Every SDK-backed thing — a signed `HeadObject`, an EventBridge rule, an S3 client
— waits on this."* **Options:** take one (a dependency and a supply-chain surface,
and TS-6 makes any new dependency a ruling) versus stay dependency-free (every
AWS-touching slice ships an unsigned probe or nothing). **Must preserve:** `npm ci
&& npm run check` must stay green on a clean checkout — the property `db/pg.ts`'s
dynamic `import('pg')` exists to protect, and which `CLAUDE.md` records costs the
tenant-isolation test its manifest-reproducible evidence. **Record:**
`devDependencies` is two packages; **G109** already shows the cost of the opposite
choice — it ruled a real YAML parser, pinned exact, and *"was not followed"*.
**Affects:** #156, #155, #158, and every M-track slice with an AWS noun in it.

### 4.5 · Is the OUTER reconciliation run driven by G120's state machine — M3-1-A (#152)

**Decision:** is the outer run — what `orchestrateRun()` stands in for — driven by
the same Step Functions state machine as the reader fan-out, or is its driver a
separate and still-open choice? **Blocked:** nothing in #152; it is raised because
*"open is itself a claim about the record, and round 4 made the opposite claim
without checking."* **Options:** **(a)** same machine — no new G row is owed and
*"the orchestration technology is undecided"* must not be written anywhere;
**(b)** separate and open — *cost:* the outer driver needs its own row when built;
**(c)** open, with the row minted now so the next slice does not re-derive it.
⚠️ **#152 recommends (b) with (c) as the action** — that is the issue's
recommendation, not this file's. **Must preserve:** *"'No Step Functions' is false
against G171 under every candidate"*, and *"'Temporal is a candidate' elevates a
document that is not a ruling."* **Record:** G107 (**`docs/HANDOFF.md:2028`**),
G120 (**`:2041`**), G144 (**`:2127`**), G171 (**`:2167`**) — 🛑 **#152 cites these
four at `:1412`, `:1425`, `:1511` and `:1551`, and ALL FOUR ARE WRONG at this
tree.** The §3 table grew and every one of them now resolves to a different row.
Re-derive: `for n in 107 120 144 171; do grep -n "^| G$n |" docs/HANDOFF.md; done`.
`grep -c 'Temporal' docs/HANDOFF.md CLAUDE.md` → `0`, `0`. **Affects:** #152, #156,
the C4 page's badges.

### 4.6 · Invariant 4's two declaration sites — M8-1 (#158)

**Decision:** when a span attribute corresponds to a `FieldPath`, is
`FieldSpec.dataClass` (`model/domain.ts:1726`, interface at `:1717`) or
`SpanAttributePolicy.dataClass` (`model/observability.ts:464`, interface at `:458`)
authoritative — **and is a divergence a refusal, a silent preference for the
stricter, or a defect to be removed by deleting the field?** **Blocked:** #158 does
not need it (it keeps the two populations disjoint) *"but that is a reading."*
**Must preserve:** **invariant 4, verbatim** — *"Classification is declared once, on
`FieldSpec`, and everything derives from it."* A second declaration site is a
second thing that can be wrong, and *"the two can disagree with nothing detecting
it."* **Record:** invariant 4 and its G106 addendum. **Affects:**
`model/observability.ts`, the telemetry slice, and #173's E-2-A below, which is the
same question on the outbound path.

### 4.7 · What derives the `DataClass` of an outbound payload — E-2-A (#173)

**Decision:** what computes the class `mayDiscloseToEndpoint()` is asked about, and
who is trusted to supply it? *"Nothing in `model/` computes it."* **Options:**
**(a)** the caller derives it and a wrong derivation is out of scope — *"honest,
and weaker than the comment implies"*; **(b)** a `maxDataClass(fields)` lands beside
the ceiling — *"that is the un-dropped `classifyLearning()` under a different name,
moves `exports` again, and re-opens what `@dropped-for-v1` meant on 7 Aug"*;
**(c)** G106's unreadable rule reaches the outbound path — a field with no
`FieldSpec` is unsendable as well as unreadable. **Must preserve:** G106's
polarity — **fail closed.** *"The rejected alternative is preserved: defaulting
unmapped keys to the most sensitive class was refused, because
readable-by-default-with-a-high-bar is scope failing OPEN."* **Record:** G106;
`classifyLearning()` (`model/learning.ts:1798`, `grep -n 'export function
classifyLearning' model/learning.ts`) carries *"@dropped-for-v1 7 Aug 2026 — the
learning-path derivation of invariant 4; R5's compensating control is owed"*.
**Affects:** #172, #173, #174, every egress connector.

### 4.8 · Is `RegionKey` the right type for someone else's system — E-1-A (#172)

**Decision:** `RegionKey` (`model/domain.ts:476`) enumerates **our five deployment
regions**. `Endpoint.region` (`Endpoint` at `:754`) is the first use where the
region belongs to the customer's counterparty. **Options:** **(a)** it is the right
type and the field means *which of our residency regions this endpoint is inside*
— *cost:* a foreign system outside all five is **unrepresentable**, so such an
endpoint cannot be configured at all, *"a fail-closed posture that is defensible
and severe, and that nobody has agreed to"*; **(b)** it is the wrong type and a
wider one is needed — *cost:* a second region vocabulary, and §5.3 again.
**Must preserve:** **invariant 7** — *"Residency survives inference"* — an endpoint
whose region cannot be named records no residency event, which is #172's whole
finding. **Record:** G82 widened `RegionKey` once, for Sydney. **Affects:** #172,
#173, `Endpoint`, every outbound reach.

### ~~4.9~~ · HALF ANSWERED BY CODE, WITH NO G ROW — E-3-A/B (#174)

> 🛑 **E-3-A WAS CLOSED BY A MERGED PR RATHER THAN BY A RULING, AND THAT IS THE
> part worth recording.** PR **#194** — *"Add a read capability for endpoints"* —
> minted `view_endpoint` on 16 Aug 2026 and closed #174. The roster moved **37 →
> 38**. **There is no G row for it**, so the question *who holds it* has an
> answer in `model/access.ts` and no answer in `docs/HANDOFF.md` §3. **E-3-B —
> the resource-level read/write split on `endpoint` — is answered by nothing at
> all.** Verify: `gh issue view 174 --json state` and
> `grep -n 'viewEndpoint' model/access.ts`. ⚠️ **G203 has since reopened G59
> from the other direction** (Pass J, `grep -nE '^\| G203 \|' docs/HANDOFF.md`),
> so the *"current text is not final"* warning below is discharged and the row
> below it is stale in its citation, not in its point.

**Decision:** the slice mints the verb and grants it to nobody. **Who holds it?**
⚠️ **The owner has REOPENED G59** — the row in the tree (**`docs/HANDOFF.md:1899`**,
*"Sources and connections are FDE-only — platform surfaces, not customer ones"*,
`grep -n '^| G59 |' docs/HANDOFF.md`) **is being amended and its current text is
not final.** 🛑 **#174 cites that row at `:1283` and it is wrong at this tree** —
the table moved and the citation followed nothing; re-grep rather than copying it.
*"The tree's current G59 text says connections come OFF the customer surface,
which — read literally today — is an argument that `view_endpoint` should not exist
yet."* **E-3-B:** does `endpoint` need a read/write split at the **resource** level,
as `secret` has (*"its own class with no read mode"*, `model/domain.ts:777-780`)?
**Must preserve:** read-implied-by-write is a §5.6 defect *"and is wrong even for an
FDE-only surface"* — the grant question and the minting question are separable and
should not be collapsed. **Affects:** #172, #173, #174, `PERMITTED_RESOURCES`, the
seeded roles.

### 4.10 · The pack-key vocabulary and hosted attestation signing — M7-0-A, M7-1-A (#170, #155)

**M7-0-A:** `SolutionPack.authoredBy: PartnerId | null` means a pack key *"can be
somebody's customer-facing vocabulary"*. **The crack is closed three ways in v1** —
every pack carries `authoredBy: null`, `signature` is `null` on all four, and the
partner block is out of v1 — **but it is *"a decision, not a derivation."***
⚠️ **It is free today and non-free after the first signature**, which is G13's
timing argument (`SolutionPack` at `model/domain.ts:2385`). **M7-1-A:** **G36 drops
self-attestation** — *"a hosted plane does not attest to itself"* — but the contract
wants a KMS signature from a key minted in the customer's account, **which under
hosting is ours**. *"Integrity without non-repudiation, and it should be written
down rather than implied by a `signature` field."* **Must preserve:** the stated
compensating control survives either answer — *"`packVersionsInForce` appears in
every heartbeat and every attestation, so what actually ran is attributable"*, and
dropping the map *"leaves the pack-integrity argument with nothing behind it."*

### 4.11 · The rest — one line each, with their source

| Ruling | Question | Source |
|---|---|---|
| **G30** | is the outbox dedup key `(idempotencyKey)` or `(idempotencyKey, meter)`? *One inference produces four meters and the table has no compensating instrument.* | `docs/HANDOFF.md:1870` · #202 |
| **T-1-A/B/C** | how the dev token's RED is witnessed (**A** two commits, one containing an open door; **B** fence-first, so *"a fence never seen refusing is a fence nobody has tested"*); which controls may skip; which routes it may reach. ⚠️ #216 recommends **A** and read-only-by-allow-list — the issue's recommendation | #216 |
| **ESC-3** | does a sixth `check:*` step require **G108 amended in the record before** the wiring commit lands? | #150 · #162 |
| **M4-1-A** | the C4 page badges EventBridge `UNDECIDED` while its sub-label states G132's ruling. *"Is the badge stale, or is UNDECIDED narrower than unchosen?"* | #156 · #162 |
| **M0-5-A/B** | when does an empty pack corpus become a **hard** failure — *"soft forever is how a known gap becomes furniture"* — and does `validateAgentDefinition()` get a CI call site? | #161 · #162 |
| **M0-9-A/B** | should the C4 page depict `SECURITY DEFINER` (a page-design decision, and *"page design is not a Builder's"*)? What is the admission rule for a new extension? | #169 |
| **R-1** | does the citation ruling widen `CITE` to `.md` / `.sql` / `.mjs` targets, or is that a separate slice? ⚠️ **The figures are #180's own and are not re-derived here** — it reports **795** such citations, **713** of them into Markdown, **1** already dead. #180's position is *separate*, on the ground that widening *"turns the gate red on the one genuine DEAD … which is precisely the property this slice was arranged to avoid"* | #180 |
| **S-9** | may new modules exist, or do the new types go into `model/domain.ts`? *Cost:* *"the governed module count moves off 18 and every document stating it goes STALE — which is that tool working."* `ls model/*.ts \| wc -l` → **18** | #229 |
| **Q9** | which tier owns session establishment — a fifth contract file, or a section of the not-yet-existing `administration.openapi.yaml`? **Ties directly to §3.17** | #230 |
| **`TenantContext`** | does it land in #157 or #224? *"The record says both … Either is defensible; minting it twice is not."* | #224 |
| **G2 / G37 / G58** | **G58 is not buildable until the palette question is reopened** — G2 makes a pack-declared palette the customer's sole authoring vocabulary and **G37, applied, put the palette in v2 packs only.** ⚠️ **G58's own evidence has moved and the substance has not.** Its row asserts *"`SolutionPack` carries zero `palette` today"* with `awk '/^export interface SolutionPack \{/,/^\}/' model/domain.ts \| grep -ci palette` → **0**; that command now returns **2** (a doc line plus the field), because `SolutionPack.palette` landed as a **field-level `@dropped-for-v1`** at `model/domain.ts:2450`, typed `palette: null` — *a reserved key with no reader in v1*. **So the field exists and there is still nothing to author with.** Derive: `grep -n 'palette' model/domain.ts` | `docs/HANDOFF.md:1898` |
| **§5.1 — the confidence floor** | G22 put it with an FDE and off the tenant surface; G38 resolved it as read-only rendering; **the surface half is not built and there is no screen**, while `DocumentTypes.dc.html` draws per-field floors as an editable customer surface | `docs/screen-pack-ledger.md` §5.1 |
| **§5.3 — the support consent record** | G41 shipped *"the mechanism without the assurance"*, knowingly and against the recommendation; `Support.dc.html` draws the consent record in detail, and **pass F says the first non-demo customer is a regulated enterprise** | §5.3 |
| **§5.7 — Textract versus the Mandarin handwritten docket** | G53 binds IDP to AWS Textract; two screens rest their argument on CJK handwriting. *"This is checkable against current AWS documentation for `ap-southeast-1` in an afternoon and has not been checked."* **This one is a verification, not a ruling — until it is checked, it is not the owner's to answer** | §5.7 |
| **P1–P11, P13** | the product and commercial questions, unchanged and unanswered. **P4 blocks V9; P8 determines whether inference can be bundled into a per-reconciliation price** | `docs/HANDOFF.md` §4.2 |

---

## 5. What this file cannot do

- **It cannot tell you which ruling is right.** Every entry states costs and
  refuses to weigh them. Where an issue or an artefact carries a recommendation, it
  is quoted and attributed, never adopted.
- **It cannot see a decision nobody has written down.** Three of the rows above —
  §3.8(ii) JIT versus invitation-only, §3.15(iii) two owners one domain, and §3.17
  the setup naming — **are in no issue and no ledger**, and were found by reading
  the declarations rather than the backlog. **There are almost certainly others.**
- **It cannot be checked by any tool here.** `tools/check-doc-counts.mjs` derives
  fourteen governed totals and *"checks numbers only: it cannot see a stale claim
  with no number in it, a wrong `file:line` citation, a drop note on the wrong
  declaration, a graph count, or a contract enum drifted from the model."* Almost
  every claim in this file is of exactly those kinds.
- **It cannot stay true.** Three passes were writing this tree while it was
  written. Re-derive every count and re-grep every citation before quoting one;
  `docs/model-gaps.md`'s banner records four instances of a citation that still
  resolved and pointed at nothing, in a file written specifically to avoid that.

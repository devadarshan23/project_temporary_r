# The pack and the tree, joined row by row

> **STATUS:** MEASUREMENT. Not an authority, and not a plan.
> **V1 AUTHORITY:** NO. `docs/HANDOFF.md` §3 outranks every sentence here, and
> `CLAUDE.md`'s numbered list of eleven is the only place the invariants are
> numbered. Where this page and either of those disagree, they win and this page
> is wrong.
> *Written 21 Sep 2026 against `integrate/all-sixteen` @ `d5c16098` — a
> SIXTEEN-WAY MERGE. `docs/HANDOFF.md` §5.11: a count is a fact about a tree,
> and a merge makes a new tree. Every count below carries the command that
> reproduces it. Run them.*

> 🛑 **THIS PAGE DOES NOT RESTATUS ANYTHING IN THE PACK, AND MUST NOT.** PR #467
> annotated rather than restatused, and the reason binds here: moving a word in
> `docs/handoff-pack/` on tree evidence MERGES THE TWO VOCABULARIES, after which
> nobody can tell a drawn claim from a built one. **This is a join table. The
> pack's status column is untouched** — derive that:
> `git diff --stat origin/integrate/all-sixteen -- docs/handoff-pack/` → empty.

This page answers `docs/build/completion-plan.md` §10 item 4:

> **"Which of the 242 `built` pack rows are also built in this repository's
> sense.** `CLAUDE.md` estimates ~12; the aggregate ratios make that plausible
> (26/136 operations, 3/12 routes) but nobody has joined them row by row."

---

## 0 · The headline, first

| | | how to read it |
|---|---:|---|
| pack rows carrying `built` | **242** | the population |
| **fully built in this repository's sense** | **5** | the chain is complete end to end |
| **partially built, gap named** | **41** | at least one real link, at least one missing |
| **drawn only** | **196** | nothing in `model/`, `db/`, `server/` or `frontend/` |

**Derive the population** — the four-word `grep` is §5.1 and G1345 retired it; this
is the `<table>`→`<tr>` walk:

```bash
# THE PACK SIDE — a <table> → <tr> walk, comments stripped first.
#   → rows 386 | with status 363 | built 242 · not built 59 · specified 50
#                                  · partial 7 · refused 5
#   ⚠️ SINCE 1 Oct 2026 (R16, G2442) THE SAME WALK ANSWERS
#     built 242 · not built 58 · specified 40 · partial 7 · refused 16
#   — rows and with-status unchanged; the two lines above are kept as they stood.
node -e '
const s=require("fs").readFileSync("docs/handoff-pack/Functional Specification.dc.html","utf8").replace(/<!--[\s\S]*?-->/g,"");
const S=["built","specified","partial","not built","refused"],d={};let rows=0,ws=0;
for(const t of s.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)){
 const b=t[1].replace(/<thead[^>]*>[\s\S]*?<\/thead>/,"");
 for(const r of b.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
  const c=[...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(m=>m[1].replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim());
  if(!c.length)continue;rows++;const f=c.filter(x=>S.includes(x.toLowerCase()));
  if(f.length){ws++;for(const x of f)d[x.toLowerCase()]=(d[x.toLowerCase()]||0)+1;}}}
console.log("rows",rows,"| with status",ws,"|",d);'

# THE TREE SIDE
node tools/check-doc-counts.mjs --derive    # 136 operations · 125 paths · 44 capabilities · 30 modules
```

⚠️ **THE WALK MUST STRIP HTML COMMENTS FIRST.** G1333 repaired the line-87
malformation by preserving the orphan **inside a comment**, tags HTML-escaped. A
walk that does not strip comments still counts the phantom and answers 364.

> ⚠️ **`CLAUDE.md` SAYS *"242 rows carry it and roughly 230 of them are NOT
> built in this repository's sense"* — i.e. **~12 built — AND THE ESTIMATE IS
> CORRECTED HERE RATHER THAN DELETED, because it is the sentence this item was
> opened against and the one a reader would have quoted onward.** The estimate
> is **not reproducible at any bar, and that is the finding rather than the
> arithmetic**: it never said which bar it used. At the strict bar the answer is
> **5**; at the loosest defensible bar — *any real link in the tree at all* — it
> is **46**. **~12 matches neither and sits between them.** The sentence was a
> reasonable guess and it was never checkable; **what replaces it is two numbers
> and the rule that separates them**, below.

🛑 **ALL FIVE FULLY-BUILT ROWS ARE ONBOARDING, AND ALL FIVE BECAME BUILT IN THIS
WAVE.** Before `1799e111` (C-1/C-2/C-3) and `bb366e42`, the answer to this
question was **zero**. That is the most useful single sentence on this page:
**the join's answer is not a slowly-accumulating fraction — it moved from 0 to 5
in one wave, because one slice mounted three operations over a table that
already existed.**

---

## 1 · What "built in this repository's sense" means

`CLAUDE.md` states the problem and does not resolve it:

> **`built` THERE MEANS *drawn and operable in these HTML files* — 242 rows
> carry it and roughly 230 of them are NOT built in this repository's sense.**

It never says what the repository's sense *is*. This page defines it, because a
join cannot be run against an undefined predicate.

### The definition

> **A pack row is BUILT IN THIS REPOSITORY'S SENSE when the behaviour it
> describes can be produced by running this repository's own code against a real
> PostgreSQL, with every artefact on the path a PRODUCTION artefact — no fixture
> standing in for a table, no test standing in for a caller, and no hand-run SQL
> standing in for a writer.**

That is not new. It is **G300's test** — *"a table AND a model AND a
capability"* — plus the one thing G300 does not need to say because it only ever
judged operations: **a caller**. `server/data-plane/console-roster.ts` derives
G300's three parts per operation and this page derives the same three plus the
fourth.

Operationally it is a **reachability chain**, and the chain differs by what kind
of claim the row makes:

| row kind | the chain that must close |
|---|---|
| **surface row** — what a person sees or does | a DRAWN ROUTE in `frontend/src/main.tsx` → a caller in `frontend/src/api/` → a SERVED operation → a TABLE → a MODEL evaluator. **Five links.** |
| **served-behaviour row** — a property of an answer, claiming no surface | SERVED operation → TABLE → MODEL. G300 verbatim. |
| **substrate row** — a governance or data property with no surface and no operation | a TABLE plus a MODEL evaluator **with a production caller**, which is the link that is almost never there |

### What it excludes, and the repository's own precedent for each

1. **A drawn HTML prototype behaviour.** `docs/handoff-pack/*.dc.html` are
   documents. Nothing under `frontend/`, `server/`, `db/` or `model/` renders
   one, and `docs/handoff-pack/table.js` — which implements sort, filter and
   paging for those documents — is imported by nothing the product ships.
   **Derive the narrow thing, not the wide one:**

   ```bash
   # every LOAD of anything in the pack, from anything the product ships:
   grep -rnE "(@import|from |require\(|fetch\()[^\n]*handoff-pack" \
     frontend/src server model db
   #   → TWO lines, and ONE OF THEM IS PROSE. Read them, do not count them:
   #     bridge.css:179          @import ".../handoff-pack/tokens.css"   ← the load
   #     ExceptionRegister.tsx:16  a COMMENT reading "verbatim from …"    ← not a load
   ```

   🛑 **KEY IT ON THE LOAD, NEVER ON THE NAME — AND THE COMMAND ABOVE STILL
   CANNOT FULLY DO IT, WHICH IS WHY ITS OWN FALSE POSITIVE IS PRINTED BESIDE
   IT.** `from ` appears in English as well as in an import statement. Keying on
   the name instead is worse: `grep -rn 'handoff-pack/…\.dc\.html'` over the same
   directories returns **three lines and all three are PROSE** — `bridge.css`,
   `shell.css` and `ExceptionRegister.tsx` each citing a pack document as their
   authority. **A command counting MENTIONS answers a question about citations,
   not about dependencies.** G978, twice, inside one exclusion. **The claim this
   page makes is the READ one: exactly one file in the pack is loaded by
   anything the product ships, and it is `tokens.css`.**

   > ⚠️ **AND THE WIDE COMMAND IS WRONG TOO — THIS PAGE CARRIED IT FOR ONE DRAFT.**
   > It read *"Derive it: `grep -rn 'handoff-pack' frontend/src server/ model/`
   > → nothing."* **It returns five lines**, and one of them is a REAL
   > dependency rather than prose: `frontend/src/bridge.css` carries
   > `@import "../../docs/handoff-pack/tokens.css"`, because **G274 moved the
   > design kernel INTO the pack and the frontend consumes it**. So the pack is
   > not inert with respect to the product — **exactly one file in it ships**,
   > and it is the one that holds no feature row. **The exclusion is about the
   > `.dc.html` DOCUMENTS and about `table.js`, never about the directory**, and
   > keying it on the directory was §5.1 inside the exclusion list written to
   > state §5.1. *Corrected in the commit it was written in — G1736.*
2. **A declaration with no producer.** `0004`'s *"a write privilege ahead of its
   writer"*; G289's `platformHeld`, which is `[]` for every principal the
   substrate can produce.
3. **A table with no route.** `0007`'s own precedent — a column set proven by a
   test instead of by a route.
4. **A reader whose only caller is `tests/`.** `server/control-plane/roster-store.ts`
   and `server/data-plane/token-verify.ts` both say so in their own headers.
5. **A capability no principal can hold.** G601's five platform verbs were minted
   and nobody has ever written a `platform_role_assignment` row outside the dev
   seed.
6. **Anything the frontend's own `NotBuilt` hatch refuses.** G216 as amended and
   G245: a hatch means REFUSED, and G245 minted a separate ink step so it could
   keep meaning only that. **The hatch is the repository's own verdict and this
   page defers to it** rather than second-guessing it from a grep.

### The one blocker that is named ONCE rather than per row

🛑 **NOTHING MINTS A SESSION ON ANY REQUEST PATH.**
`docs/contracts/session.openapi.yaml` declares **four** operations —
`resolveHomeRealm`, `completeFederatedSignIn`, `getSession`, `signOut` — and
**not one of them is served**. Derive it:
`grep -n 'operationId' docs/contracts/session.openapi.yaml` against the served
set below. The only session rows that exist were written by
`server/dev/identity-seed.ts` behind `RECONCILE_LOCAL_TEST_AUTH=1`.

**So every one of the 22 gated capability-tier operations is reachable only by a
seeded session.** Folded into each row, that blocker would make the answer **0**
and hide the 46 rows that differ from one another. This page therefore counts a
row as built **given a session**, and states the blocker here, once — which is
exactly what `CLAUDE.md` does with *"no AWS resource has been created"*.

⚠️ **A reader quoting a number off this page owes that sentence with it.**

---

## 2 · The two sides, derived

### The tree side

```bash
grep -rn 'handlers:' server/*/start.ts          # 7 LINES, of which ONE IS PROSE
node tools/check-doc-counts.mjs --derive        # 136 operations across 125 paths
grep -cE "^    '/[^']*': \(" frontend/src/main.tsx              # 3 routes drawn
awk '/^export const ROUTE_PATHS = \[/,/^\] as const/' \
  frontend/src/routes/table.ts | grep -cE "^  '/"               # 12 declared
ls db/migrations/*.sql db/migrations-control/*.sql | wc -l      # 39
```

🛑 **`grep -rn 'handlers:' server/*/start.ts` IS A NEW G978 INSTANCE AND IT IS
THE DERIVATION `CLAUDE.md` AND `completion-plan.md` §1 BOTH NAME FOR THE SERVED
SET — G1731.** It returns **7 lines**, of which **one is PROSE quoting the
command itself**, in a comment that then explains why it had to be written
without the glob:

> *"Derive the served set rather than reading it — `grep -rn 'handlers:' server`
> over the two `start.ts` files. (Written without the glob on purpose: a `*`
> followed by a `/` inside a block comment CLOSES THE COMMENT …)"*
> — `server/data-plane/start.ts`, grep anchor: `grep -n "served set rather than reading it" server/data-plane/start.ts`

**And the count it returns is not the number anyway.** Six real `handlers:`
blocks carry **29** operations between them, so a reader counting lines gets 7,
a reader counting blocks gets 6, and the answer is 29. *A derivation measuring
its own argument*, exactly G978, and this time inside the command two governing
documents tell every reader to run. **The honest derivation is to parse the
blocks and intersect with the declared `operationId`s** — there is no one-liner,
which is why this page prints the set instead.

**The served set is 29 of 136:**

| tier | count | operations |
|---|---:|---|
| `capability` | 22 | `admitRun` · `assignException` · `decideApproval` · `executeProposal` · `getDispositionMix` · `getException` · `getExceptionFacets` · `getMessage` · `getProposal` · `getRun` · `getRunAccount` · `getThread` · `grantRoleAssignment` · `listAvailableDispositions` · `listExceptions` · `listIntakeChannels` · `listProposals` · `listRunResidue` · `listRuns` · `listThreads` · `proposeResolution` · `reverseResolution` |
| `administration` | 3 | `listOnboardingSteps` · `completeOnboardingStep` · `forceOnboardingStep` |
| `platformConsole` | 1 | `listTenants` |
| `controlPlane` | 1 | `listEntitledPacks` |
| `foundation` | 1 | `resolveTenantContext` |
| `dataPlaneLocal` | 1 | `checkLocalHealth` |

🛑 **AND THE NUMBER THAT ACTUALLY BOUNDS THIS JOIN IS NEITHER 136 NOR 29. IT IS
SEVEN** — the operations a browser can reach, because a surface row needs a
caller and there are only seven:

```bash
grep -n 'planeEndpoint(' frontend/src/api/*.ts
```

`listRuns` · `getRun` · `getRunAccount` · `listRunResidue` · `listExceptions` ·
`getException` · `assignException`. **Twenty-two served operations have no
frontend caller at all**, including every one of the three onboarding
operations that this page's only five fully-built rows rest on.

### The pack side

**Identify every row BY NAME. The plan's `#N` numbers do not reproduce** —
G1345 measured that early references land correctly and later ones land **two
short, on different rows**, with no consistent rule. Every row below is named.

---

## 3 · Fully built — **5 rows**

**What it would cost to finish: nothing. These are done.**
**What it would cost to make them REACHABLE BY A PERSON: a staff console, which
does not exist — no route, no component, no frontend caller.**

All five rest on the same three operations, the same two tables and the same
module. They are grouped together because **finishing or breaking them is one
commit, not five.**

| pack row (by name) | section | the chain, closed |
|---|---|---|
| **The sequence, with one step open** | H2 · Run customer onboarding | `model/onboarding.ts` `ONBOARDING_STEPS` (six, ordered) → exactly-one-`next` → `completeOnboardingStep` refuses any but the next → served |
| **Whose hands each step is in** | H2 | `STEP_HANDS` total over the six → `whoseHands` is `required` on the `OnboardingStep` wire schema, not prose → served |
| **Forcing a gate** | H2 | `forceOnboardingStep` served; a typed reason; marks every step below; `migrations-control/0030` stores the mark APPEND-ONLY behind two triggers |
| **What the mark is for** | H2 | the reason is stored and published as `forcedReason` — a reviewer reads the words of the person who decided |
| **Move an onboarding step** | The staff console (`Write \| Guard \| Status`) | the row claims a WRITE with the GUARD *"only the next open step … or forced with a reason"*. Both operations are served and the guard is the model's |

**Derive the chain:**

```bash
grep -n 'ONBOARDING_STEPS\|whoseHands\|forcedReason' model/onboarding.ts
grep -n 'whoseHands\|forcedReason\|required:' docs/contracts/administration.openapi.yaml
grep -n 'CREATE TABLE\|CREATE TRIGGER' db/migrations-control/0030_onboarding_record.sql
```

🛑 **AND ONE OF THE FIVE IS THE PACK CONTRADICTING ITSELF.** The pack carries a
SEPARATE row, `not built`, reading *"Onboarding state in the model — **Nothing
persists the sequence, the force or the mark.** All of it is state on this
surface."* **All three persist**, in the same section, four rows away from the
four `built` rows above. See §5.

---

## 4 · Partially built — **41 rows**, grouped by what would finish them

Each group is led by **the cost to close it**, because that is what a planner
needs and the measurement is only how it was found.

### 4a · Needs a FRONTEND and nothing else — **11 rows**
**Cost: one or more screens. The server side is done and served.**
Every row here has a served operation, a real table and a model evaluator. What
is missing is a component, a route, and a caller in `frontend/src/api/`.

| row | section | what is there | what is missing |
|---|---|---|---|
| **Who reaches it** | C5 | `propose_resolution` / `approve_resolution` / `execute_resolution` are three distinct capabilities, masked apart in `decide()` | no passkey, no sign-in, no approver screen |
| **Review the proposal** | C5 | `getProposal` + `listProposals` served over `tenant.resolution_proposal` and `proposal_evidence` | no screen |
| **Refuse** | C5 | `decideApproval` served, reason from a closed list, `tenant.approval_decision` append-only | no screen |
| **One decision per proposal** | C5 | `superseded_by_proposal_id` plus `0059`'s `BEFORE UPDATE` trigger | no screen; "the controls go" is a surface claim |
| **What was ruled out** | C4 | `proposal_evidence` served on `getProposal` | `Finding.tsx` hatches the evidence panel |
| **Reject with a reason** | C4 | `decideApproval` with a required reason | no screen |
| **Triage · facets** | C2 | `getExceptionFacets` served | `ExceptionRegister.tsx` hatches *"Filter by facet, sort, and the keyboard path"* |
| **The registry** | H11 | `listTenants` served over `tenancy_roster` | the row means the PARTNER registry; no partner surface at all |
| **Stated where it bites** | P7 | `PARTNER_CAPABILITY_MASK` enforces the refusal in `decide()` | no partner surface to state it on |
| **What it leaves open** | P7 | `tenant.correspondence_*` exists and three reads are served | no case surface |
| **Pagination** | Table controls | cursor paging + `LIMIT` in `exception-store.ts`, `nextCursor` on the wire | no pager control renders |

### 4b · The number agreed and the SETS DID NOT — **2 rows**
**Cost: a ruling about which set is right, then a commit. Not effort.**

🛑 **THIS IS THE 16 Aug 2026 CAPABILITY ROW'S EXACT SHAPE, TWICE, INSIDE
SINGLE PACK ROWS — G1732.** In both cases a cardinality check passes and the
membership check fails, so any control counting members is green.

| row | pack says | tree says | overlap |
|---|---|---|---|
| **The register** (C3) | *"reference, line, value, variance, confidence, status, action"* — **7 columns** | `Reference · Rule · Severity · Value at risk · Status · Assigned · Action` — **7 columns** | **3 of 7.** `line`, `variance` and `confidence` are absent; `Rule`, `Severity` and `Assigned` are not drawn |
| **Triage · order** (C2) | *"A closed enum of four — line order, value, variance, status"* | `severity_then_value · value_at_risk_desc · raised_at_desc · raised_at_asc` — **four, a total `Record` in the store** | **1 of 4.** Only *value* survives |

```bash
grep -n '<th' frontend/src/components/ExceptionRegister.tsx     # the seven rendered
sed -n '/const ORDER_BY/,/^}/p' server/data-plane/exception-store.ts
```

⚠️ **The `confidence` column is not merely unbuilt, it is REFUSED**, and the
refusal is on the component in its own voice: *"a number a list can be sorted by
is a ranking signal that invites bulk approval, and there is no bulk operation
for it to feed."* **A planner must not close that gap by building the column.**

### 4c · The behaviour holds at the API and no page renders it — **8 rows**
**Cost: an error surface and a chrome that is not hatched.**

| row | section | note |
|---|---|---|
| **The code is on the page** | Error pages | `errors.yaml` carries **88** members and every served refusal emits one from that closed set. No page. Derive: `node tools/check-doc-counts.mjs --derive \| grep error` |
| **404 answers identically for three cases** | Error pages | holds **by construction**: RLS makes another tenant's row invisible, so purged · unreachable · never-existed are one answer. No page renders it |
| **Figures** | C1 | `Completeness` and `Exceptions` render from `getRunAccount`; *"money prints its unit"* holds — `Value at risk` is right-aligned. The arrival claim sentence does not exist |
| **Run strip** | C1 | `Register.tsx` renders every run most-recent-first from `listRuns`. It is a **table**, not a strip of equal-width cells, and selecting one does not reload work below it |
| **Row actions** | C4 | an `Action` column renders and `assignException` works. `Accept` and `Attach` do not exist |
| **Evidence, inline** | C4 | `/close/finding/:ref` resolves and `getException` is served. `Finding.tsx` **hatches the evidence panel** |
| **Empty states** | Table controls | `ExceptionRegister` and `Register` both distinguish the two empties | — |
| **Exceptions judged** | C2 | predicates and `severity_rank` are real; **the explanation half is REFUSED by ruling** — R-D/G1127 widened `explanation_summary` to nullable and *"the sentence is composed where it is displayed"* |

### 4d · The column exists and the surface that would set it does not — **6 rows**
**Cost: a staff surface plus, in two cases, a ruling.**

| row | section | what is there |
|---|---|---|
| **The confidence floor** | Onboarding sequence | `0160` gives `document_field_spec` a `confidence_floor`, **per tenant, per document type, per field path** — FINER than the row's own claim |
| **The tenant cannot see the number** | H4 | holds: no operation on any of the seven tiers publishes a floor |
| **Segregation of duties** | C13 | `tenant.approval_config.segregation_of_duties boolean NOT NULL` + `model/approval.ts` + `decideApproval` served. ⚠️ **the pack row OVERSTATES** — see §5 |
| **Deployment mode and residency are frozen** | H1 | `0006` stores both; **frozen holds BY PRIVILEGE** — no role holds `UPDATE` |
| **Document types, identified by source × pattern** | H3 | `tenant.document_type` exists (R11) with three arms for what a file said about itself |
| **Draft and published versions** | H3 | `pack_catalogue` is keyed `(pack_key, pack_version)` |

### 4e · Accessibility — **7 rows**, each true of a primitive and false of the page
**Cost: wiring the primitives that already exist into `Shell.tsx`, plus a real audit.**

🛑 **THE SHARPEST ONE IS A COMPONENT THAT EXISTS AND IS NEVER USED.**
`frontend/src/components/SkipLink.tsx` is imported by **`Specimen.tsx` and
nothing else** — so *"the first thing in the tab order is Skip to the work"* is
true of a specimen page and false of the application. Derive it:
`grep -rn 'SkipLink' frontend/src`.

| row | holds | does not hold |
|---|---|---|
| **Language** | `lang=` on the prerendered document | the pack's claim is about its own fifteen documents |
| **A heading, and a way past the chrome** | `<h1>` in `Shell`, `RunAccount`, `Finding` | the `h1` is **visible, not visually-hidden**; `SkipLink` is unused |
| **Landmarks** | `<header>`, `<nav>` in `ChromeBar`, destinations as real buttons | no status bar |
| **Tables announce themselves** | `scope` on all three tables; `<caption>` on `Register` | **no `aria-sort` anywhere**; no caption on `ExceptionRegister` |
| **State is in the attribute** | `aria-current` ✓ · `aria-disabled` ✓ | **`aria-pressed` and `aria-expanded` appear nowhere** |
| **Dialogs behave like dialogs** | `overlays/Surface.tsx` + `behaviour.ts` carry **all five**: `role="dialog"`, `aria-modal`, `aria-labelledby`, `trapFocus`, `returnFocus`, Escape | its three named subjects — the palette, the tray, the account menu — **are all hatched in `ChromeBar`** |
| **Results and counts are announced** | `role="status"` in `Toast`, `Modal`, `Luminous` | not on every computed count or narrowing line |

```bash
for t in aria-sort aria-pressed aria-expanded sr-only; do
  printf '%-16s ' "$t"; grep -rl -- "$t" frontend/src | tr '\n' ' '; echo; done
```

⚠️ **DO NOT WRITE THAT LOOP WITH `grep -E 'a\|b'`.** Under `-E` a backslashed
pipe is a **literal pipe character**, so the pattern matches nothing and the
absence reads as a finding. **This page's own first audit reported `sr-only` as
absent for exactly that reason and it is present in three files.** Recorded as
G1734 rather than quietly fixed — it is §5.1 committed by the page written to
catalogue §5.1.

### 4f · The remaining **7**
**Who uses it** ×4 (`User`, `Approver`, `Partner administrator`, `Partner user`
— `decide()`'s four `OrgClass` arms and `CAPABILITY_STAKEHOLDER_CLASSES` are
real; **no role is provisioned outside `server/dev/identity-seed.ts`**);
**Matching** (C2 — `runSetReconciliation()` executes through
`server/data-plane/run-executor.ts` against a real PostgreSQL, and its output IS
`tenant.exception`; **but no process drains the queue** — `compose.yaml` has
seven services and none is a worker, and `sqs:ReceiveMessage` is granted to
nobody);
**Where the subject appears** (Governance — `tenant.subject_index_entry` exists;
**one of `SubjectLocation`'s ELEVEN variants has columns**, G322);
**Search across the row** (Table controls — 13 server-side query parameters,
none of them a row-wide search box).

---

## 5 · The sharpest disagreements, in both directions

### 5a · `built` in the pack, NOTHING in the tree

The 196 drawn-only rows are all technically this, so these are the ones where
the gap is **largest relative to how finished the row reads** — a row a planner
would most likely mistake for done.

| row | section | the tree |
|---|---|---|
| **Reverse, inside the window** and **Post** | C5 | 🛑 **`reverseResolution` IS SERVED AND THE 24-HOUR WINDOW DOES NOT EXIST ANYWHERE — G1733.** No constant, no column, no check, no contract field. Derive it: `grep -rn 'reversalWindow\|reversal_window\|REVERSAL_WINDOW' model/ server/ db/ docs/contracts/` → **nothing**; the only `24 hour` strings in the corpus are on `control-plane.openapi.yaml`'s break-glass grant, a different object. **So a reversal is UNBOUNDED IN TIME on a served, mounted operation**, and the pack row that says otherwise is `built`. This is the one row on this page where `built` is not merely optimistic — **the tree does the opposite of what it claims**, and `0140`'s trigger deliberately permits the clear |
| **Ask**, and 17 more | C6 · Ask a question | **eighteen rows**, and there is no Ask operation on any of the seven tiers. `ChromeBar.tsx` hatches the destination. The largest single block of `built` rows in the pack, and the emptiest |
| **Two trays and a canvas**, and 18 more | C7 (both sections) | **nineteen rows**; `Reports` is hatched in the chrome; no export operation exists |
| **The meter is the door**, and 5 more | C8 | the chrome's token meter is hatched **`illustrative`** in its own markup |
| **A door, not a destination**, and 7 more | C11 · Read the audit trail | `view_audit` is named by **no operation at all**, and all three of invariant 10's event-stream tables have **no request-path writer** — so a trail surface would render an empty table |
| **C1 · the close**, and 2 more | The command palette | hatched; *"Find, go, do or ask"* is inside a `NotBuilt` |
| **One affordance, named in words**, and 4 more | Notifications | hatched **`not counted`** |

### 5b · `not built` or `specified` in the pack, BUILT in the tree

PR #467 found six. **Three of the six still hold and are now STRONGER; three
more are new here.**

| row | pack status | the tree | new? |
|---|---|---|---|
| **Onboarding state in the model** | `not built` — *"Nothing persists the sequence, the force or the mark"* | **all three persist AND all three are now SERVED.** `migrations-control/0030` + `model/onboarding.ts` + three mounted operations. #467 found the tables; **this wave mounted the operations**, so the row is further from true than when it was last measured | stronger |
| **Nothing behind them** | `not built` — *"No error taxonomy is written"* | `errors.yaml` carries **88** members. ⚠️ the row's **other two clauses still stand**: no reference resolves, and `errors.yaml` names no HTTP status | stands |
| **Everything behind it** | `not built` — *"No subject index, no erasure plan, no request record, no sweep"* | `tenant.subject_index_entry` exists (`0012`). ⚠️ **the other three clauses stand** | stands |
| **Server-side anything** | `not built` — *"Sorting, filtering and paging happen over rows already in the browser"* | 🛑 **FALSE FOR THE REGISTER.** `listExceptions` declares **13 query parameters plus a four-member `sort` enum**, and `exception-store.ts` applies every one in **SQL with bound parameters**, `ORDER BY` from a total `Record`, and `LIMIT` with a cursor | **NEW** |
| **Facets that do not exist** | `not built` — *"Assigned to me, older than 30 days, above my authority, touched by a person"* | 🛑 **TWO OF THE FOUR ARE NOW EXPRESSIBLE ON THE SERVED QUERY**: *assigned to me* is `assignedTo`, *older than 30 days* is `raisedTo`. **Above my authority** and **touched by a person** have no parameter | **NEW** |
| **Waived knowingly** | `not built` — *"A tenant too small to staff two people may switch it off"* | `tenant.approval_config.segregation_of_duties boolean NOT NULL` exists (`0059`) and `model/approval.ts` reads it. ⚠️ **what is missing is the trail half** — *"every approval the waiver permits is recorded as self-approved"* — and any surface to switch it | **NEW** |

### 5c · And one `built` row that OVERSTATES rather than misses

**Segregation of duties** (C13) claims *"the check no longer passes
vacuously."* `model/approval.ts` says the **agent arm IS vacuous** and the
caller must read a `vacuous` flag. `completion-plan.md` §7 already recorded this
and it still holds: **the row is more than half built and its last clause is
wrong**, which is the worst combination for a reader skimming for done.

### 5d · The pack's TEXT moved and its status did not — G2408, THE OWNER'S (1 Oct 2026)

**"Ruling wins."** G2408 recorded that C9's `built` row *"The credential is
theirs"* — *"Written by the customer's cloud engineer into their Secrets
Manager. We never hold one"* — contradicted G2401 (THE OWNER'S custody ruling),
and left it **RECORDED, NOT RESTATUSED** under PR #467's rule. The owner has
now ruled that the ruling wins, so the row is **rewritten in the pack**, as
*"We custody the credential, and never read it back"*: held in our Secrets
Manager under the tenant's own KMS key, one secret per source, only a reference
in Postgres, **never readable by a request path**. Three sentences carrying the
same claim moved with it — *Waiting on a source*, *Declare a source*, and the
*No credentials on our side* refusal — and the pack's own change log carries a
row saying so.

⚠️ **THIS IS THE FIRST TIME THIS PAGE'S OPENING BANNER HAS A STATED EXCEPTION**:
`git diff --stat … -- docs/handoff-pack/` is no longer empty across this
change. **What did not move is every status word**, which is the property the
banner protects — derive it with §0's walk: `built 242 · not built 58 ·
specified 40 · partial 7 · refused 16`, unchanged (`rows` is 388, +1 for the
change-log row). In this repository's sense the row is **partially built**:
custody, the write path and its fences are built and witnessed
(`tests/http/credential-binding-served.test.ts`), an FDE under a live delivery
grant binds since G2591 (`tests/http/staff-grant-arm-served.test.ts`), and
nothing is deployed. The drawn copy in `C1 Close.dc.html` (*"We never hold
one"*) moved in the same change. ⚠️ **OWED:** `S1 Staff.dc.html`'s onboarding
step note (*"the credential is theirs"*) still carries the old sentence — it is
TRANSCRIBED into `model/onboarding.ts` and asserted by
`tests/model/onboarding.test.ts`, so it moves with the model rather than alone.
### 5e · C9's sources — `not built` or `specified` in the pack, BUILT in the tree since 1 Oct 2026

⚠️ **ADDED 1 Oct 2026 BY THE W5-C9-2 SLICE (G2681–G2692) AND THE PACK IS NOT
TOUCHED (G2691)** — this page's own bar. Every row below is joined to a mounted
operation that mints invariant 10's record, a table and a model function, and
is asserted over a real PostgreSQL at `tests/http/sources-served.test.ts`. The
headline counts in §0 are a measurement of `d5c16098` and are **not** swept
here — this is a different population (rows that are NOT `built` in the pack).

| C9 row | pack status | the tree |
|---|---|---|
| **Declare a source** | `partial` | `declareEndpoint`. ⚠️ the pack's *"credentials that live in the tenant's own Secrets Manager"* is G2408's collision, unchanged |
| **Connection configuration** | `not built` | SFTP and S3 halves, typed (`0340` §2). Email and SAP are `refused` (R16); the S3 trust/read policy drafts are not produced (G2685) |
| **Source × document type** | `not built` | `declareEndpointDocumentType`, a literal pattern per pair (`0341`) |
| **OCR is the pack's declaration** | `specified` | an ABSENCE: no fidelity on a pair, every pair reads the type's (G2690) |
| **Field mapping** | `not built` | complete-or-refused, onto declared fields only (G2687) |
| **Changing or stopping a source** (both rows) | `not built` | the dated, reversible stop is built; **rebinding is not** (G2689) |
| **The handoff has no state** | `specified` | `sourceState()`, derived — with a fourth state the pack does not draw (G2688) |

🛑 **AND THE ROWS THE SAME SLICE COULD NOT BUILD ARE NOT A BACKLOG**: the parked
pile, the sample, the drain and the register line need an `Arrival` that carries
a filename and a third verdict, and both are rulings (G2692).

✅ **THE OWNER RULED G2692 ON 2 Oct 2026 AND THOSE ROWS ARE WIRE-BUILT —
G2831–G2844, `0380`, `server/data-plane/parked.ts`.** ⚠️ The paragraph above is
kept rather than deleted, because it was true for one day and is what the next
slice was commissioned against. **The pack is again NOT TOUCHED (G2844)**, and
every row below is built on the WIRE and absent from the UI — the frontend draws
no Setup surface and no register line. ⚠️ **THE *"draws no Setup surface"* CLAUSE WENT FALSE WHEN #519
MERGED (G2925) and is corrected rather than deleted: `frontend/src/components/Setup.tsx`
is now the Setup surface at `/setup`, wired to the six endpoint operations.
**What survives is exactly true — it draws no parked pile, no sample, no raise
and no register line**, and nothing in `frontend/src/` calls
`listParkedArrivals`, `getParkedArrival` or `raiseParkedArrival`. Asserted at
`tests/http/parked-pile-served.test.ts`, `tests/db/arrival-parking.test.ts` and
`tests/model/arrival-parking.test.ts`.

| C9 row | pack status | the tree |
|---|---|---|
| **#7 Unmatched deliveries** | `specified` | `parked` verdict; no pair, two pairs, or a pre-declaration delivery are one bucket; the reason is DERIVED (G2833) |
| **#9 The sample is their first delivery** | `specified` | the held artefact (`0380` §2); the pane publishes its KEYS, never a value (G106) |
| **#13 Raising it with the FDE** | `not built` | `raiseParkedArrival` — the sample and the type, **not the pack** (G2839), counted separately |
| **#16 The drain** | `specified` | inside `declareEndpointDocumentType`, under the declaring act's record (G2835); **the meter does not move** (G2837) |
| **#18 Where the parked pile shows** | `not built` | `listParkedArrivals`, counted apart from exceptions; **the unblocker is a capability, not a person** (G2840); no UI |
| **#19 The register's line always links** | `specified` | `getParkedArrival`, gated `view_exception` so a person who cannot act can follow it; no UI |
| **#8 Declared up front** | `specified` | the mapping is now APPLIED per pair (`projectThroughMapping()`); a pair still cannot be declared incomplete |

---

## 6 · What I could not determine

1. **Whether any of the 196 drawn-only rows is built in a way no grep of mine
   would find.** The join is name-by-name and evidence-driven, but the
   negative half is an ABSENCE, and this repository catalogues absence-proofs
   failing twenty times over. **A row I called drawn-only because no operation
   names it could be satisfied by a table under a name I did not guess** —
   which is exactly the escape `tests/contracts/customer-surface-reach.test.mjs`
   names about itself: *"a catalogue table under an unguessed name passes."*
2. **Where the B/C boundary belongs.** 41 and 196 are not derived, they are
   **judged**, one row at a time, against the chain in §1. The **5** is derived
   and I would defend it against anybody; **the 41 is a considered reading and
   a careful person could land within a few rows either side of it.** No control
   in `npm run check` governs any of the three figures.
3. **Whether the drawn prototypes and the frontend agree on anything I called
   built.** I compared the pack's PROSE against the tree. I did not open
   `S1 Staff.dc.html` or `C1 Close.dc.html` in a browser and compare rendered
   behaviour, and §4b shows that the prose can agree on a cardinality while the
   sets differ — **so there may be more §4b-shaped rows than the two I found,
   and they are invisible to a reader of prose.**
4. **Whether `Matching` (C2) would survive a real corpus.** It executes against
   fixtures. That is `completion-plan.md` §10 item 5, unchanged by this page.
5. **Whether the six pack surfaces claim behaviours their own files do not
   perform.** `§Surfaces`' eight rows assert that a named `.dc.html` covers a
   list of things. I verified every file exists and its byte size; **I did not
   verify any file covers what its row says it covers.**
6. **The pack's own `refused` status — 5 rows — is outside this join entirely.**
   Item 4 asked about the 242 `built`. The 5 `refused` and the 7 `partial` were
   not examined, and `refused` in the pack is a different predicate again from
   the frontend's `NotBuilt` hatch.
   ⚠️ **AND IT IS 16 ROWS SINCE 1 Oct 2026, NOT 5 — R16, THE OWNER'S
   (`docs/HANDOFF.md` G2442, G2448). THE SENTENCE ABOVE IS KEPT AS IT STOOD.**
   Eleven rows moved: ten from `specified` and one, `Waived knowingly`, from
   `not built`. **None of the 242 `built` rows moved**, so every figure in §0–§5
   stands. 🛑 **AND THIS IS NOT THE RESTATUS THIS PAGE FORBIDS**: the banner at
   the top forbids moving a pack word *on tree evidence*, because that merges
   the drawn and built vocabularies. An owner declining a decision is a ruling,
   and `refused` is the pack's own word for one.

---

## 7 · The one thing a planner should take from this page

**The pack's `built` column and this repository's notion of built are not the
same measurement at different completeness — they are measurements of different
objects**, and the ratio between them is not a progress bar. 196 of 242 rows
describe behaviour of documents in `docs/handoff-pack/`, and building the
product will never move those rows, because nothing in `frontend/`, `server/`,
`db/` or `model/` renders those documents.

**What DID move the number was one slice mounting three operations over a table
that already existed.** The fully-built count went 0 → 5 in this wave. The
cheapest next increment is §4a: **eleven rows whose server side is finished and
served, waiting on screens.**

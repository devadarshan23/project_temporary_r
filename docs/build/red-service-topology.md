# Red team — service topology, API count, and how the components talk

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — an adversarial pass. It gives bounds rather than a number and it decides nothing; nothing in it is applied.
> ⚠️ **Written against a tree that was moving underneath it, and it says so** — see its own header, which records seven files modified concurrently against `0aba16f0` and warns that `model/` line numbers are approximate while *"the quoted text is the durable citation."*
> ✅ **Its two most useful outputs are the ones to act on first:** it names `docs/component-architecture.html` as an artefact that reads as having settled the service count when it has not, and it is the source of the finding that `docs/build/` was missing from `docs/INDEX.md` entirely — now added.
> ✅ **BODY ANNOTATED 8 Aug 2026 — analysis untouched.** Row 1 of *"what cannot be estimated yet"* is **closed** (G90 + G102: the v1 pack carries `palette: null`, so pass D's `~16` holds and the administration tier is small); **six of the seven remain open DECISIONS**, so this document's core finding — *"the service count is under-decided, not under-derived"* — stands. ⚠️ **G107 does NOT close row 4**: it rules the reconciliation pipeline data-plane and says nothing about the BI/SPICE pipeline, and it is recorded as adjacent, not as a closure. RS-15's five STALE lines are **all fixed** — re-run gives `EXIT: 0` — and its own counts are now stale in turn, which is the finding.
> *Banner added 8 Aug 2026; body annotated the same day.*
> 🛑 **SUPERSEDED ON THE DEPLOYABLE COUNT, 18 Sep 2026 — successor
> `docs/tech-stack.md` §7.** ✅ **And this file was RIGHT about the thing it
> insisted on:** it argued the question *"cannot be answered with a number at
> all"* from the model, and the successor answers it from `compose.yaml`
> instead — a different question, with a checkable answer. G253 maps that file
> one-to-one onto ECS. **Its warning about `docs/component-architecture.html`
> reading as settled when it is not still stands and is not superseded.**

> **8 August 2026.** Adversarial pass on the question a parallel green team is
> answering: *"the count, size and shape of the APIs we will need in our build.
> How many component services will we have and how do they talk to each other?"*
>
> **This document does not answer that question.** It attacks the artefacts that
> claim to answer it already, and it gives bounds rather than a number.
>
> **Primary target:** `docs/component-architecture.html` — fourteen foundation,
> thirteen capability, eight control-plane services, a dependency matrix and two
> traced flows. Secondary: `docs/service-stacks.html`, `docs/contracts/`,
> `docs/v1-trim-proposal.md`, `docs/v1-scope-ledger.md`,
> `docs/screen-pack-ledger.md`, and G45 · G48 · G50 · G55 · G58 · G62 · G76 ·
> G82 · G84 · G86.
>
> **Verified at the tree, not read from prose.** Every count below carries the
> command that reproduces it (`HANDOFF` §5.11). ⚠️ **The working tree was being
> edited concurrently while this ran** — `model/governance.ts`, `model/policy.ts`,
> `model/examples.ts`, `model/catalog.ts`, `docs/HANDOFF.md`,
> `docs/v1-scope-ledger.md` and `docs/v1-trim-proposal.md` are all modified
> against `0aba16f0`. Line numbers in `model/` are approximate; **the quoted text
> is the durable citation.**
>
> **Findings: 5 BLOCKER · 8 SERIOUS · 5 NOTED.** IDs are `RS-1 … RS-18`,
> continuous across bands. `B*`/`S*`/`N*` (red-buildability), `RD-*`
> (red-decisions) and `RI-*` (red-indicator-model) are already consumed.

---

## Reproduction — run these before trusting anything below

```bash
# the 35 and its split — count the CARDS, not the prose
python3 -c "import re;h=open('docs/component-architecture.html').read();\
import collections;print(collections.Counter(m[0] for m in re.findall(r'class=\"svc s-(fnd|cap|ctl)\">.*?svc-id\">(.*?)<',h,re.S)))"
                                                        # fnd 14 · cap 13 · ctl 8 = 35

grep -c 'operationId:' docs/contracts/*.openapi.yaml     # 36 + 12 + 17 = 65
for f in docs/contracts/*.openapi.yaml; do grep -cE '^  /' $f; done  # 33 + 12 + 17 = 62
grep -h '^      tags: \[' docs/contracts/*.openapi.yaml | sort | uniq -c
                                                        # 30 tags over 35 services
ls tools/                                               # check-citations · check-doc-counts · planner
ls tools/check-plane-tags.mjs                            # No such file
ls -a | grep -c github                                   # 0
node tools/check-doc-counts.mjs; echo "EXIT: $?"         # EXIT: 1 — 5 STALE
node tools/planner/extract.mjs                           # 140 nodes · 249 edges · 154 gaps
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                # 86
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅' # 24
```

---

# BLOCKER

## RS-1 · BLOCKER · "Thirty-five services" counts function calls as deployments, and the repository's own transport table refutes it

`docs/component-architecture.html:176-178` is the claim:

> **Foundation** — 14 services, built once, in the data plane ·
> **Capability** — 13 services, the product surfaces ·
> **Control plane** — 8 services, publish down, never read up

`docs/contracts/README.md:21-28` — written the *next day*, by the same
record — assigns a transport to each foundation service:

| Transport | Services | Count |
|---|---|---:|
| **In-process** | F1 F3 F4 F5 F11 F13 F14 | 7 |
| **Out-of-process, same account** | F12 | 1 |
| **Network, AWS SDK** | F7 F8 F9 F10 | 4 |
| **Async, fire-and-forget** | F6 | 1 |

And it says why, in its own words (`:10-13`): *"Several of these services are
**not HTTP APIs and must not become them.** F4 Classification is called once per
extracted field; F1 Tenant Context once per request. Putting either on a network
would be a latency disaster and would add a failure mode where none needs to
exist."*

**So of the fourteen "foundation services": seven are function calls, four are
AWS SDK wrappers around services AWS already runs, one (F6) is a queue write, and
exactly ONE — F12 Sanitisation — is a deployment.** F12 is out-of-process for a
security reason (*"no credentials and no network egress, which is only enforceable
across a process boundary"*), not an architectural one.

**G71 removes the last defence.** The stack is *"Node backend consuming `model/`
**directly**"*. An in-process foundation service in a Node monolith is a module
with an exported function. Calling fourteen of those "services" and then planning
fourteen deployments, fourteen auth boundaries, fourteen version streams and
fourteen failure modes is the exact trade G55 forbids: *"when two readings are
both defensible, take the one with fewer knobs."*

**What goes wrong if it ships.** The build plan provisions 14 runtimes for 7
function calls, and the boundary property the foundation tier exists to
hold — *"a capability service may not reach a store, a model, or the outside world
directly"* (`:168-172`) — becomes 14 network hops to defend instead of 7 module
imports the compiler can enforce under G71.

**Nothing in the record has re-tested 35 against G55.** G55 is 7 Aug; the
architecture is 4 Aug; the banner at `:143` re-asserts *"Thirty-five services
across three tiers still holds"* on 6 Aug, a day before G55 existed.

**DECISION** — how many of the fourteen become deployments. **DERIVATION** — the
transport table already answers it and nobody has read the two documents against
each other.

---

## RS-2 · BLOCKER · G82 + G86 require the arrow `component-architecture.html` says must not exist, and nothing owns the SPICE pipeline

`docs/component-architecture.html:430-439`, the only red-boxed note in the
control-plane section:

> **The edge that must not exist.** There is no arrow from any control-plane
> service into a data-plane store. X4 receives what F6 pushes; X6 receives what
> the plane beats; X3 signs something the plane verifies offline. Every one is a
> push from below or a publish from above. **A single query downward would
> collapse the account boundary that the whole topology is built on.**

Now put three 8 Aug decisions beside it:

- **G86** (`docs/HANDOFF.md:707`) — *"BI workspaces are provisioned by the
  CONTROL PLANE, as NEW types"* (`BiWorkspace`, `BiWorkspaceProvisioning`).
- **G82** (`:703`) — the BI layer is full Quick Suite in `ap-southeast-2`; the
  data plane is `ap-southeast-1`; **"SPICE ingestion moves tenant data across the
  boundary on every refresh"**.
- **G84** (`:705`) — customers are Authors, never dataset Owners; scope is carried
  by an **RLS rules dataset**, and *"nothing in AWS prevents provisioning granting
  Owner by mistake — that check is ours and does not exist."*

**Three things follow and no artefact names an owner for any of them:**

1. **Who initiates the SPICE refresh.** If the control plane pulls, it reads
   tenant data and invariant 3 breaks. If the data plane pushes, the data plane
   gains a standing cross-region, cross-account egress path to a bought tool —
   which no service in the 35 has, and which F8 Object Store Gateway (*"the only
   path to a blob"*) does not cover because the destination is a SPICE dataset,
   not a blob. **The record states the pipeline exists and never states its
   direction.**
2. **Who writes the RLS rules dataset.** That dataset is the entire mechanism
   carrying invariant 1's tenant scope and `AssignmentScope`'s `costCentres` /
   `legalEntities` into the vendor. It is per-tenant, per-user, and derived from
   `model/access.ts`. It is written by nobody. `HANDOFF` §4.1 records that
   `valueCeiling` is unenforceable there because *"Row-level security works only
   for fields containing textual data"* — **so the BI layer enforces two of six
   scope dimensions and no component is named as compensating.**
3. **Who provisions the per-tenant AWS account.** G70's account-per-tenant means
   *"a fleet of per-tenant things to provision, monitor, patch, bill and
   decommission"* (`docs/v1-trim-proposal.md:325-333`, which explicitly
   **declines** to propose an owner: *"it depends on an answer nobody has given"*).
   G86 answers it — and G86 is `not applied`, `BiWorkspace` does not exist
   (`grep -rn 'BiWorkspace' model/*.ts` → 0), and `deployment.ts` stays 0 live / 12
   dropped.

**C11 Reporting & BI is drawn as one box** (`:370-374`: *"Six role dashboards,
the builder canvas, and exports"*). Under G57/G68 the dashboards and the canvas
are bought. Under G82/G84/G86 what remains is: an export path in the data plane,
a provisioning service in the control plane, an RLS-rules writer with no home, and
a vendor in a second region. **One box has become at least three owners across two
planes, two AWS accounts per tenant and two regions**, and the only artefact that
draws component boundaries draws none of it.

**What goes wrong if it ships.** Either invariant 3 is breached by a query nobody
reviewed as a query, or the residency boundary is crossed by an egress nobody
reviewed as an egress — and in both cases the code that does it belongs to a
service that appears in no inventory, so no reviewer is assigned to it.

**DECISION** — refresh direction and RLS-rules ownership. Both are one sentence
each and neither has been written.

---

## RS-3 · BLOCKER · `RegionKey` cannot express `ap-southeast-2`. The BI erasure record cannot name where the copy rests, and `tsc` is green

`model/domain.ts:322`:

```ts
export type RegionKey = 'ap-southeast-1' | 'us-west-2' | 'ap-south-1' | 'eu-west-1'
```

`model/governance.ts` — the eleventh `SubjectLocation` variant, added 8 Aug under
G80a, carries `region: RegionKey` with this comment immediately above it:

> ⚠️ G82 MAKES IT SHARPER RATHER THAN SOFTER: the BI layer runs in
> `ap-southeast-2` while the data plane is `ap-southeast-1` … `region` is carried
> on the variant for exactly that reason: **a dataset outside the tenant's
> residency region is a finding, not a note.**

**The field cannot hold the value its own comment says it exists to hold.** Red
run, against a copy of `model/` (nothing written into `model/`):

```bash
# baseline
tsc -p <copy>/tsconfig.json --noEmit; echo "EXIT: $?"          # EXIT: 0

# add one line: export const biRegion: RegionKey = 'ap-southeast-2'
tsc -p <copy>/tsconfig.json --noEmit
# rktest.ts(2,14): error TS2820: Type '"ap-southeast-2"' is not assignable
#                  to type 'RegionKey'. Did you mean '"ap-southeast-1"'?
```

**This is §5.10 exactly, live, on the highest-stakes open decision in the
record.** Nothing constructs a `bi_dataset` location — so the compiler is green,
the variant looks landed, and the first thing that ever writes one fails. G80a was
added *"or PDPA erasure is incomplete"* (`docs/v1-trim-proposal.md:107`), and as
shipped the erasure plan can name the dataset and cannot name where it is.

**Why it belongs in a service-topology document.** `RegionKey` is also
`Tenant.residency`, `InferenceRouting`'s regional order and `DataPlane.region`.
The moment a second region enters the topology it enters this union, and the
BI decision has entered it without it. **Any service that touches the BI copy is a
service whose region the model cannot represent.**

**DERIVATION.** One union member, plus a fixture that constructs a `bi_dataset`
location in the same commit (§5.10, and G86's own note: *"it needs its own
fixtures in the same commit"*).

---

## RS-4 · BLOCKER · G76's plane tag cannot express invariant 3, and the only predicate available to the checker is §5.1

**G76** (`docs/HANDOFF.md:697`) settles one file versus two:

> One file wins, and the boundary becomes **mechanical instead of structural**:
> every operation carries a plane tag, and `tools/check-plane-tags.mjs` refuses
> tenant business data on a `[platform]`-tagged operation. ⚠️ **THE CHECKER LANDS
> IN THE SAME COMMIT AS THE FILE.** A tag with nothing reading it is §5.6 exactly.

Three things are wrong with this as a service boundary.

**(a) The checker does not exist and has nowhere to run.**

```bash
ls tools/check-plane-tags.mjs   # No such file or directory
ls -a | grep github             # nothing — there is still no .github/
```

G76 is `not applied`. Today the tag would assert nothing — which G76 itself names
as §5.6 and then proposes anyway.

**(b) A tag constrains a schema; invariant 3 constrains a read.** Invariant 3 is
*"the control plane publishes downward and never reads tenant data."* That is a
statement about what a **service queries**, not about what an **operation's
response body is shaped like**. A `[platform]`-tagged operation returning
`{ tenantId, status }` passes any schema check and can be implemented as a
`SELECT` against `tenant_rw`. The existing structural signal — *two PostgreSQL
schemas with two connection roles and no grant between them*
(`docs/deployment-topology.html`) — is the thing that actually holds invariant 3,
and a YAML tag is not connected to it. `docs/v1-trim-proposal.md:128-136` gets
this right and then loses the point: *"a YAML file is a document, not a plane …
**What makes it real is that file layout is how this repository has expressed
plane boundaries so far**, so a single combined admin file removes the only
structural signal there is, and leaves the boundary to reviewer attention."*
**G76 removes that signal and replaces it with a checker that does not exist.**

**(c) The checker's predicate is forced into the repository's most common defect
shape.** To refuse "tenant business data" a checker must decide what tenant
business data *is*. The model has the answer — `FieldSpec.dataClass`, invariant 4,
*"classification is declared once and everything derives from it"*. **The wire does
not carry it:**

```bash
grep -c 'x-' docs/contracts/*.yaml | grep -v ':0'   # nothing — no x- extension anywhere
```

`red-buildability.md:234` (B4) already records that there is no `x-` convention.
So `check-plane-tags.mjs` has exactly two options: key on a **schema name**
(`*Definition`, `*Exception`) — which is **§5.1, a rule keyed on a convenient
landmark instead of the property it protects**, the defect this record calls its
most common — or hand-maintain a list, which is §5.2's shape one level out. The
citation G76 rests on shows the trap: `control-plane.openapi.yaml:52-63` forbids
tenant business data and names *"a definition name"* **as an example**, not as an
enumeration.

**What goes wrong if it ships.** The administration tier — the largest single
deliverable in v1 — gets its plane boundary from a comment. When the checker
lands, it will pass on the operations that matter and fail on ones that do not,
and the first person it inconveniences will widen the name list, which is how
`validateProcedureInjectionSafety()`'s entry-set rule got switched off
(`HANDOFF` §5.1).

**DECISION** — does the wire gain a machine-readable classification
(`x-data-class` derived from `FieldSpec`) before the administration file is
written? **DERIVATION** — everything after that answer.

---

## RS-5 · BLOCKER · The number that carries an invariant verdict is `~25`, and it has never been derived from anything

RD-2 records the `~16`-versus-*"largest single deliverable"* contradiction. **There
is a third number, it is in neither document RD-2 cites, and it is the one doing
load-bearing work.**

`docs/v1-scope-ledger.md:587`, the invariant-1 row of the post-trim invariant
table:

> | 1 | **Enforceable** *(conditional)* | `decide()` reads
> `PrincipalContext.tenantId`. **Condition: the ~25 new administration operations
> take a grant id, never a `tenantId`** |

and again at `:608`: *"every one of the **~25** new administration operations
authorises through it."*

Four live sizings of one tier:

| Figure | Source | Basis given |
|---:|---|---|
| ~120 | `HANDOFF:472` (pass D), pre-collapse | none |
| **~16** | `HANDOFF:472`, `:658` | *"customers author values, never expressions"* |
| **~25** | `v1-scope-ledger.md:587`, `:608` | **none anywhere** |
| *"the largest single deliverable in v1"* | G58, `v1-trim-proposal.md:102` | none |

**16 and 25 differ by 56% and no document reconciles them.** Neither
`v1-trim-proposal.md` nor `v1-scope-ledger.md` contains `~16` at all; `HANDOFF`
does not contain `~25`. And the `~25` is not an aside — **invariant 1's verdict
after the trim is conditional on it.** A count nobody derived is currently the
antecedent of an invariant's enforceability.

**It cannot be derived today, and that is the real finding.** The tier's size is a
function of G58, and G58 is blocked (RD-2): a customer authors from a
pack-declared palette (G2), and G37 — **applied, as an absence** — put the palette
in v2 packs only. So the administration tier is `~16` if pass D's rule holds and
unbounded if G58 does. **This is a decision wearing a derivation's clothes**, and
under `HANDOFF` §7's rule — *"when you defer a finding, write down whether it needs
a decision or a derivation"* — it must be recorded as the former.

**Two independent derivable floors exist and neither is the estimate.** The green
slice documents propose **57 distinct `METHOD /path` pairs**
(`grep -rhoE '\b(GET|POST|PUT|PATCH|DELETE) /[A-Za-z0-9_{}/.-]+' docs/build/green-*.md | sort -u | wc -l`
→ 57), of which 18 are under `/admin/` or are plainly administration.
`red-buildability.md:130-171` (B2) enumerates **22 rows — Group A 12 derivable,
Group B 10 blocked**. Neither 57 nor 22 has ever been set against 16 or 25.

**What goes wrong if it ships.** A build is scheduled against `~16`, the tier
lands at three times that, and the schedule absorbs it as slippage rather than as
the decision it was.

**DECISION** — reopen G2/G37 (the palette), which fixes the tier's size. Nothing
else does.

---

# SERIOUS

## RS-6 · SERIOUS · Five of the thirty-five services have zero operations; eleven of the fourteen foundation services have exactly one

Derived from the operation tags in the contracts:

```bash
grep -h '^      tags: \[' docs/contracts/*.openapi.yaml | sort | uniq -c
```

| Tier | Services | Operations | Services with 0 ops |
|---|---:|---:|---|
| Foundation | 14 | 17 | — |
| Capability | 13 | 36 | **C3 Rule Evaluator · C4 Archetype Engine · C8 Agent Runtime** |
| Control plane | 8 | 12 | **X5 Billing · X7 Evaluation** |

**Foundation, per service:** F4, F5 and F6 have two operations each; **the other
eleven have exactly one.** A service with one operation is a function, and the
transport table (RS-1) already says seven of them are.

**The three capability services with no operation describe themselves as
libraries.** C3: *"Shared by every archetype rather than reimplemented per
matcher"* (`:324`). C4: *"Four matchers behind one interface"* (`:330`), and its
only stated dependency is C3. C8: *"Mastra"* (`:354`) — a third-party library, and
F13 Tool Broker exists precisely because *"a component must not enforce its own
limits"* (`:275`). **C3, C4 and C8 are a library, a strategy table and a vendor
dependency.** Counting them as services inflates the tier by 23%.

X5 Billing's absence is already explained (`docs/contracts/README.md:95`: *"X5 was
correctly declared to have no plane-facing operation; it has no admin-facing one
either"*). X7 Evaluation's is not explained anywhere.

**Across all three tiers: 65 operations over 35 services = 1.9 operations per
service.** That is not a service decomposition; it is a call graph with boxes
drawn round its nodes.

**DERIVATION.**

---

## RS-7 · SERIOUS · The cards and the dependency matrix in `component-architecture.html` are two vocabularies for one dependency graph, and they disagree on every capability service

§5's matrix (`:450-476`) and each capability card's `uses` line are two statements
of the same fact. **They disagree on all thirteen rows**, always in the same
direction — the matrix is a superset:

| Service | card `uses` | in the matrix and not on the card |
|---|---|---|
| C1 Intake | F1 F4 F5 F6 F8 F11 | **F3 F9 F10 F12** |
| C2 Extraction | F1 F4 F5 F6 F7 F8 | **F3 F10** |
| C3 Rule Evaluator | F1 | **F10** |
| C4 Archetype | F1 F6 | **F10** |
| C5 Run Admission | F1 F3 F6 | **F2 F9 F10 F11** |
| C6 Exception | F1 F4 F5 F6 F9 | **F3 F10 F11** |
| C7 Procedure Runtime | F1 F3 F6 F9 | **F2 F10 F14** |
| C8 Agent Runtime | F1 F3 F4 F6 F7 F10 | **F8 F9 F13** |
| C9 Correspondence | F1 F3 F4 F5 F6 F8 F9 | **F2 F10 F12** |
| C10 Resolution | F1 F3 F5 F6 F9 | **F2 F4 F10** |
| C11 Reporting & BI | F1 F4 F5 F8 F9 F11 | **F2 F3 F6 F10** |
| C13 Autonomy Advisor | F1 F3 F9 | **F10** |
| C12 Pack Install | F1 F3 F9 | **F2 F10 F14** |

**F10 Telemetry appears in all thirteen matrix rows and in not one card.** F2
appears in six matrix rows and in zero cards. F14's own card names its callers as
*"X1 Pack Authoring · tenant agent builder"* (`:281`) while the matrix marks **C7
and C12** as using it — neither of which is X1 or a builder.

**And the prose miscounts its own matrix.** `:482`: *"F1 is used by all thirteen.
F3 by twelve. F6 by ten."* Derived column totals: F1 **13** ✅ · F3 **11** ✗ ·
F6 **10** ✅.

This is **§5.3 — two vocabularies for one concept, diverging** — inside a single
file, on the artefact whose entire subject is *how the components talk to each
other*. The build-order argument at `:479-491` rests on the column densities, i.e.
on the matrix; the reader's mental model comes from the cards, because that is
what is read first.

**What goes wrong if it ships.** A team building C1 from its card wires six
dependencies and misses telemetry, policy, audit and sanitisation — and F12
Sanitisation is invariant 6's cheap deterministic control.

**DERIVATION.** One of the two is authoritative; delete the other.

---

## RS-8 · SERIOUS · `docs/service-stacks.html` already answers the question with eleven, and no decision cites it

Drawn 5 Aug, one day after the 35, and checked 6 Aug — the banner calls it *"the
most current of the nine visuals"*. It regroups **the same thirty-five services
into eleven stacks by function**:

| | Stack | Services | Ops |
|---|---|---:|---:|
| A | Spine | F1 F2 F3 F6 F9 | 6 |
| B | Governance & data protection | F4 F5 F8 F11 | 6 |
| C | Security & trust boundary | F12 F13 F14 | 3 |
| D | Core reconciliation | C1 C2 C3 C4 C5 C6 | 13 |
| E | Agency | C7 C8 C10 F7 | 9 |
| F | Correspondence & endpoints | C9 | 7 |
| G | Presentation / BI | C11 | 3 |
| H | Catalog | X1 X2 C12 | 6 |
| I | Commercial | X3 X4 X5 | 5 |
| J | Observability & support | F10 X6 X7 X8 | 4 |
| K | Autonomy governance | C13 | 3 |

Verified internally consistent: services sum to **35**, operations to **65**.

**Eleven is a strictly coarser partition of the same boxes and it is a better
answer.** It groups by what a thing does rather than by which invariant it
enforces, its stacks have 3–13 operations each rather than 1–2, and it is the
artefact that found *"two stacks named in the brief have no service at all"* —
the agent builder and endpoint management.

**No decision, no green slice, no red finding and no plan cites it.** All eight
files in `docs/build/` are silent on both this and the 35 (grep for
`service-stacks`, `component-architecture`, `thirty-five` across
`docs/build/*.md` → 0 hits). **The record contains a defensible service partition
that nobody has used, alongside an indefensible one that everybody quotes.**

Its banner also states *"34 capabilities"*; the tree says 36. See RS-10 for why no
tool can see that.

**DECISION** — which partition is the build's. **DERIVATION** — the eleven, if
somebody says so.

---

## RS-9 · SERIOUS · The counts checker reads neither the visuals nor `docs/build/`, which is exactly where the service count lives and where the answer will be written

`tools/check-doc-counts.mjs:225-231` defines its file set:

```js
'CLAUDE.md', 'PRODUCT.md', 'README.md',
...readdirSync(join(ROOT,'docs')).filter(f => f.endsWith('.md')),
'docs/contracts/README.md',
```

```bash
node -e "const{readdirSync:r}=require('fs');\
console.log('docs/*.md scanned:',r('docs').filter(f=>f.endsWith('.md')).length);\
console.log('docs/*.html NOT scanned:',r('docs').filter(f=>f.endsWith('.html')).length);\
console.log('docs/build/*.md NOT scanned:',r('docs/build').length)"
# docs/*.md scanned: 26 · docs/*.html NOT scanned: 9 · docs/build/*.md NOT scanned: 8
```

**Two blind spots, and both are load-bearing for this question:**

- **The nine HTML visuals.** Every service count in the repository lives in
  exactly two of them. `component-architecture.html` states *"thirty-five"*,
  *"fourteen"*, *"thirteen"*, *"eight"*, *"eleven"* (`:294`), *"eleven, twelve,
  eight"* (`:608-611`), *"thirty-one"* (`:171-173`) and *"ten TypeScript
  modules"* (`:605`). `service-stacks.html` states *"34 capabilities"*. **Not one
  is checkable, and every one is wrong or stale.**
- **`docs/build/`.** The green team's answer and this document both land in a
  directory the checker does not read — `readdirSync(join(ROOT,'docs'))` is
  top-level only. **The single artefact whose entire content is counts about the
  build is written where §5.11's own control cannot reach it.**

`HANDOFF` §4.1 already records two limits of this tool and calls the
Markdown-table blindness *"the worst of them"*. This is a third, it is not
recorded, and it is larger: the table blindness misses a form; this misses two
whole directories.

**DERIVATION.** `.html` needs tag-stripping before the matcher, and `docs/build`
needs one recursive `readdir`. Both are small; neither is made.

---

## RS-10 · SERIOUS · Nine of sixteen modules have no contract operation at all, and six of the nine are live in v1

`node tools/planner/extract.mjs`, gap kind `types_without_operations`:

| Module | Interfaces | Lines | Live exports (v1) |
|---|---:|---:|---:|
| `agents.ts` | 9 | 1386 | **31** |
| `learning.ts` | 12 | 1765 | **29** |
| `correspondence.ts` | 5 | 278 | **12** |
| `evaluation.ts` | 12 | 568 | **11** |
| `catalog.ts` | 5 | 253 | **10** |
| `observability.ts` | 8 | 465 | **7** |
| `kernel.ts` | 1 | 440 | 72 (primitives — correctly no surface) |
| `presentation.ts` | 10 | 1243 | 2 (dropped) |
| `deployment.ts` | 4 | 443 | 0 (dropped) |

Live/dropped derived per module with:

```bash
for f in model/*.ts; do e=$(grep -c '^export ' $f); \
 d=$(awk '/@dropped-for-v1/{f=1;next} f&&/^export /{c++;f=0;next} f&&NF{f=0} END{print c+0}' $f); \
 echo "$(basename $f) live=$((e-d)) dropped=$d"; done
```

`presentation.ts` and `deployment.ts` are dropped, so no service is owed. **The
other six are live and owe one.** `correspondence.ts` is invariant 6's own
subject and `v1-trim-proposal.md:287` keeps all twelve exports; `agents.ts` keeps
31 under G52; `catalog.ts` gains authority under G49.

**Consequence for the estimate.** A service count derived from the contracts
undercuts by six live modules' worth of surface. A service count derived from
`model/` overcounts by whatever is dropped. **The two available derivations
disagree and nothing reconciles them** — which is why RS-17 matters.

**DERIVATION.**

---

## RS-11 · SERIOUS · Whether G45's Dual LLM split is a service boundary or a process boundary has never been asked, and if it is answered wrongly nothing in the tree can tell

RD-12 establishes that G45 is not specifiable against the model — no type exists at
the reader→proposer boundary. **This is the topology half of it, and it is not
recorded.**

G45 requires *"the summary crossing from reader to proposer carries symbolic
references, never text — that is the pattern's definition, not a parameter of
it."* The 35-service inventory contains **one** C8 Agent Runtime. G62 makes `Ask`
v1 and G45 a prerequisite. So the inventory is short by one principal at minimum,
and the question nobody has asked is what kind of boundary separates them:

| Shape | What holds the property |
|---|---|
| Two functions in one service | A code-review convention |
| Two agent definitions, one runtime | `AgentDefinition` — which has **no field pairing two agents** and **no input contract** |
| Two processes | The OS |

```bash
grep -rn 'readerAgent\|proposerAgent\|InputContract' model/*.ts   # nothing
grep -n 'export type OutputContract' model/agents.ts               # :606
```

**`OutputContract` exists and constrains what an agent EMITS. G45 constrains what
the proposer RECEIVES, and there is no `InputContract`.** The compile-time proofs
`_CarriedTurnHoldsNoText` / `_CarriedReadingHoldsNoText`
(`model/identity.ts:1189-1190`) hold the property across a **turn**. Nothing holds
it across an **agent** — which is precisely the distinction G62 draws (*"G47
stopped text crossing a TURN boundary; G45 is what stops it crossing the AGENT
boundary within one turn"*).

**If it is built as two functions in one service, nothing fails.** `tsc` stays
green, the extractor moves zero edges, and the property becomes a comment — **§5.10
and §5.6 at once**. And `Ask.dc.html` ships a status bar that *"keeps saying it
reads the ledger and cannot post"* (`docs/screen-pack-ledger.md:331`), which
`PRODUCT.md` would then make a claim the product cannot support.

**DECISION** — process, service or convention. Nobody has been asked. Note the
sequencing consequence RD-12 already records: G45's two agent definitions are
pack-minted under G52, and pack publication has no operation, so **the boundary
lands inside the unmodelled control-plane surface whichever shape is chosen.**

---

## RS-12 · SERIOUS · Invariant 6's two enforcements are in different states, "both have zero call sites" is imprecise, and the CI call site would validate the wrong artefact

**The precision matters, so derive it:**

```bash
grep -rn 'validateAgentToolBindings\|validateProcedureInjectionSafety' model/*.ts \
  | grep -v '^\S*:[0-9]*: *\*'
# model/agents.ts:903 :export function validateAgentToolBindings(
# model/agents.ts:1126:  const out: AgentViolation[] = [...validateAgentToolBindings(def, bindings)]
# model/domain.ts:1363:export function validateProcedureInjectionSafety(
```

**Three lines. Two of them are the same function.**

- `validateAgentToolBindings()` (`model/agents.ts:903`) **has a caller** —
  `model/agents.ts:1126`, inside `validateAgentDefinition()`. It is an in-model
  call, not a runtime one, but it is not zero.
- `validateProcedureInjectionSafety()` (`model/domain.ts:1363`) has **zero
  callers anywhere** — every other occurrence in `model/` is a doc comment, and
  the only other references are prose in `docs/`.

**`HANDOFF` §8 item 8 asks for "a CI call site for the two pack-publication
validators". For the second one, CI is the wrong site, and the record already says
so.** `component-architecture.html:555-564`:

> Validation ran at pack signing, in the control plane. But the agent builder's
> tenant-scoped half authors procedures that are **never packed and never
> signed** — so they would have reached production having crossed no gate at all.
> That is why F14 is a foundation service **deployed in both planes** rather than
> a step in the pack pipeline.

CI validates artefacts in this repository. The procedures F14 exists for are
authored **in a tenant, at runtime, through an API**. So:

- F14 has exactly **one** contract operation (`foundation.openapi.yaml`, tag
  `F14 Authoring Validator`), and `docs/screen-pack-ledger.md:453` records that it
  *"validates a `Procedure` that no operation can create."*
- The operation that would create one lives in `administration.openapi.yaml`,
  which does not exist (B2).

**So the enforcement has no call site because the service that would call it has
no input.** Adding CI closes the pack half and leaves the tenant half — the half
F14 was invented for — exactly as open as it is today, while making the item look
closed.

**What goes wrong if it ships.** §8 item 8 gets ticked, invariant 6 still has one
enforcement running in the place it matters, and the next reader sees a green
check.

**DERIVATION** for the CI site. **DECISION** for the runtime site, because it is
gated on the administration file's shape (RS-4, RS-5).

---

## RS-13 · SERIOUS · F2 Identity & Session is the one foundation service with no declared transport, and it is the service invariant 1 depends on

`docs/contracts/README.md:21-28` assigns a transport to **F1 F3 F4 F5 F11 F13 F14
· F12 · F7 F8 F9 F10 · F6** — thirteen of the fourteen. **F2 appears in no row.**

That omission lands on the only foundation service whose transport is not a free
choice. F2 is *"Cognito for sandbox and hosted; the customer's own IdP over
OIDC/SAML for BYOA"* (`:203`) — a browser redirect to a third party, i.e. a network
boundary in every topology. And it is the service that produces the thing invariant
1 derives from: *"tenant scope is derived from the session, never read from a
request."*

The record already knows the consequence and files it elsewhere.
`docs/service-stacks.html`, the spine table: *"Authenticate · F2 Identity ·
**Nothing. No session type, nothing mints a `PrincipalContext`.**"*
`docs/screen-pack-ledger.md:132`: *"**none of the 62 paths** signs in, exchanges a
token, takes a second factor, selects a tenant or signs out."* B1 makes it a
BLOCKER on buildability. **Nobody has connected it back to the topology: the
service that has no transport is the service that has no operations, and it is the
first hop of every request.**

`green-platform-slices.md:127-131` proposes a **fifth** contract file,
`session.openapi.yaml`, because all three existing files declare
`security: [sessionContext]` at document level. `red-buildability.md:90` records
that *"nobody has said which"* file session operations belong in. **That is a
service-boundary question — does F2 become an addressable service or stay a
library over Cognito — and it is filed as a contract-file question.**

**DECISION.**

---

# NOTED

## RS-14 · NOTED · `component-architecture.html` contradicts its own legend twice in its own footer

- `:176-178` legend: **14 · 13 · 8**.
- `:294` note title: *"Why these **eleven** and not a framework"* — over a grid of
  fourteen cards.
- `:171-173`: *"enforced in one place instead of **thirty-one**"* — over a set of
  thirteen capability services.
- `:605`: *"Types in `model/` — **ten** TypeScript modules."* Tree: **16**.
- `:608-611`: *"the counts — **eleven, twelve, eight** — are of proposed services,
  not of anything running."*

Eleven+twelve+eight is 31, which is where `:171-173` comes from — **so the file
was written at 31, updated to 35 in three places, and left at 31 in three
others.** The staleness banner at `:143` re-asserts *"Thirty-five services across
three tiers still holds"* without noticing that the file it banners does not.

Invisible to `check-doc-counts.mjs` (RS-9). **DERIVATION.**

## RS-15 · NOTED · Prose counts that disagree with the tree at time of writing

```bash
node tools/check-doc-counts.mjs; echo "EXIT: $?"     # EXIT: 1
```

~~Five STALE lines: `CLAUDE.md:45` exports 683 vs 684 · `CLAUDE.md:69` markers 228
vs 229 · `HANDOFF:257`, `INDEX.md:105`, `domain-model.md:666` policy kinds
*"seven"* vs **8** (G79 landed the eighth on 8 Aug; three documents did not
follow).~~

> ✅ **ALL FIVE ARE FIXED. RE-RUN 8 Aug 2026: `EXIT: 0`, zero STALE lines**, 19
> HISTORICAL (reported, never failing, and each one narrates a correction on
> purpose — **do not bulk-edit that list**). ⚠️ **The tree moved again in the same
> direction this finding warned about, so do not copy these either** — derive them:
> `node tools/check-doc-counts.mjs --derive` returned **689** exports, **230**
> dropped markers and **8** policy kinds on 8 Aug 2026, against the 684 / 229 / 8
> this finding recorded hours earlier. **The finding was right and its own numbers
> are stale, which is the finding.**

Not caught by the tool, derived here:

```bash
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md                 # 86
grep -E  '^\| G[0-9]+ \|' docs/HANDOFF.md | grep -c '✅'  # 24
```

`HANDOFF` §3 states *"APPLIED: twenty of eighty-six, counted 8 Aug 2026, not
estimated"* against **24**. The same paragraph says *"Derive it; this line has now
moved five times."* It has moved six.

⚠️ `docs/HANDOFF.md` is modified in the working tree; a concurrent editor may own
this. **DERIVATION.**

## RS-16 · NOTED · `AgentToolBinding.scope` documents five scope dimensions; there are six

`model/agents.ts:842`, on `AgentToolBinding.scope`: *"Narrows what this tool may
touch, in the **SAME five dimensions** an assignment uses."*

```bash
awk '/^export interface AssignmentScope/,/^}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'
# 6 — domains · definitionIds · solutionIds · costCentres · legalEntities · valueCeiling
```

`solutionIds` was the sixth, added in pass E (`docs/access-and-agency.md` §11.8).
The comment predates it. Small, but it is the comment a reader consults when
deciding what an agent's tool binding may narrow — and `v1-scope-ledger.md:609`
records that all six were deliberately kept because *"adding a dimension later is a
breaking change to `scopeIsNarrowerOrEqual`, `narrowestScope`, `UNSCOPED` and
`DENY_ALL`."* **DERIVATION.**

## RS-17 · NOTED · The green slices name zero services and the architecture names zero operations. Nobody has joined the two halves of the answer

The three green slice documents propose model types, contract operations,
capabilities and error codes. **They name no service, no deployable, no runtime and
no process boundary** — the word "service" occurs only as `managed_service_use`,
`SERVICE_NOTICE_KINDS` and "an AWS service".

`docs/component-architecture.html` names 35 services and **not one
`operationId`**. `docs/contracts/` names 65 operations and assigns each to a
service by tag — which is the only join that exists, and it covers 30 of the 35.

So four counts of the same system's size are live and no two are reconciled:
**35 services · 65 operations · 22 vertical slices (`phase-one-plan.md:4`) ·
57 proposed `METHOD /path` pairs.** Any answer to *"how many services and how do
they talk"* that does not state which of these four it is derived from is
unfalsifiable. **DERIVATION**, and it is one table.

## RS-18 · NOTED · The strongest service partition the record actually supports is three, and it is already written down

`docs/contracts/README.md:21-28` does not only assign transports; it draws the
only boundaries in the repository that are forced rather than chosen:

- **Public HTTP — the capability tier.** *"What the browser calls. The only tier a
  customer sees."*
- **Cross-plane HTTP — the control tier.** *"Crosses an account boundary between
  two parties. **The only tier where OpenAPI is load-bearing rather than
  descriptive.**"*
- **Out-of-process — F12 alone.** Forced by *"no credentials and no network
  egress"*.

Everything else in the file is in-process, an AWS SDK call, or a queue write.
**Three deployables plus a sanitiser sandbox is what the contracts actually
argue for**, and it is what G55 would pick. It is recorded nowhere as a topology.

---

# The number is wrong because —

**Thirty-five is not a count of services. It is a count of boundaries at which an
invariant is enforced**, which is what `component-architecture.html:293-301` says
it is: *"Each is a boundary that an invariant is enforced at… They are small. Their
value is that there is exactly one of each."* That is a good reason to have
thirty-five **modules**. It is not a reason to have thirty-five deployments, and
the file never claims it is — the claim was manufactured by everyone who quoted the
headline.

Four independent reductions apply, and none has been taken:

| Reduction | From | Removes |
|---|---|---:|
| The transport table — 7 in-process, 4 AWS SDK wrappers | `contracts/README.md:21-28` | 11 |
| Zero-operation libraries — C3, C4, C8 | derived, RS-6 | 3 |
| G55 — *fewer knobs wins*, never applied to this artefact | `HANDOFF:651` | — |
| G71 — one TypeScript process consuming `model/` directly | `HANDOFF:667` | — |

Four additions apply that the 35 does not contain:

| Addition | From |
|---|---|
| A session/identity surface — F2 has no transport and no operation | RS-13, B1 |
| An administration tier — 6 absent surfaces, sized at 16, 25 or "largest" | RS-5 |
| An `Ask` tier — **zero contract operations today** | G62 |
| BI provisioning + the SPICE pipeline + the RLS-rules writer, in a second region | RS-2, G82/G84/G86 |

## Defensible bounds

**Lower bound — 4 deployables.** Data-plane application (all foundation and
capability modules in one Node process under G71) · F12 sanitiser sandbox
(forced) · control plane (forced — a different AWS account) · the bought BI tool
(not ours). This is the only bound with a written argument behind it, and it is
the one G55 selects.

**Working bound — 6 to 9 deployables.** The four above, plus: an identity/session
edge if F2 becomes addressable rather than a library (RS-13); an `Ask` runtime,
which G45 may force into **two** (RS-11); and a BI-provisioning worker if G86
lands as a separate process rather than a control-plane module. **The spread from 6
to 9 is entirely accounted for by three unanswered decisions**, not by unfinished
analysis.

**Upper bound — 11 stacks.** `docs/service-stacks.html`'s partition, which already
exists, is internally consistent, groups by function, and gives every unit 3–13
operations. **Anything above eleven requires an argument nobody has made.**

**Thirty-five is above the upper bound of the only defensible partition in the
record, and the record contains that partition.**

## What the API count is, and is not

- **Runtime operations today: 65 across 62 paths**, all three tiers, all runtime.
  Derivable, stable through the 7 and 8 August sequences, and reproduced above.
- **Administration: unknown.** 16, 25, 120 and "the largest single deliverable" are
  all live. See RS-5.
- **`Ask`: zero today, a whole tier tomorrow.** `AskSession` exists
  (`model/domain.ts:4057`); no operation names it.
- **Session: zero.** *"None of the 62 paths signs in."*
- **Platform/FDE: zero.** `docs/screen-pack-ledger.md:696` — *"0/18"*, and *"there
  is no platform tier and no FDE surface anywhere in the pack."*

**A defensible statement of the API surface today is: 65 runtime operations, plus
four tiers whose sizes are 0 by construction rather than by measurement.** Anyone
adding those four to reach a total is adding one derived number to three guesses.

---

# What cannot be estimated yet, and the single answer that unblocks each

| # | Not estimable | The one answer that unblocks it | Owner |
|---|---|---|---|
| 1 | ~~**The administration tier's size**~~ **✅ ANSWERED — G90, then G102 on 8 Aug 2026, and the answer is NO.** ~~Reopen G2/G37: does a v1 pack carry an authoring palette? If no, pass D's `~16` holds and the tier is small. If yes, G58 holds and the tier is unbounded until the palette is specified.~~ **G90 reserves a nullable `palette` on `SolutionPack` and keeps v1 authoring ARCHETYPE-DRIVEN; G102 settles the shape — the field admits only `null` in v1, so G90 reserves the KEY, not the SHAPE.** That reserves the key in the signed pack body (the G13 property) while inventing none of G2's v2 vocabulary, and widening to `PackPalette \| null` later is a non-breaking type widening leaving every v1 signed body byte-identical (`"palette":null` either way). **So pass D's `~16` holds and the tier is small.** ⚠️ **G102 requires it be REQUIRED-and-nullable, never `palette?:`** — the four `TS2741` errors across the fixture packs are the whole compile-time evidence the field landed, and optional makes all four vanish silently, which is §5.6 inside the issue whose own negative control forbids it. ✅ **AND THIS ONE IS APPLIED, unusually among 8 Aug's rulings: `palette: null` is in the tree at `model/domain.ts:2250`**, required-and-nullable as required, carrying an `@dropped-for-v1` note and the G90 reservation argument at the declaration | ~~Product owner~~ **Answered, and applied** |
| 2 | **Whether the administration tier is one deployable or two** | G76 says one file with plane tags. Does the wire gain a machine-readable classification (`x-data-class` from `FieldSpec`) so `check-plane-tags.mjs` has a predicate that is not a name? If no, the tag is §5.6 and the split must be structural. | Engineering |
| 3 | **How many agent runtimes `Ask` needs** | Is G45's reader/proposer separation a process boundary or a code boundary? One sentence. Everything downstream — deployables, IAM roles, the `Ask` contract's shape — follows. | Product owner + engineering |
| 4 | **Who owns the BI pipeline, and how many services it is** | Does the SPICE refresh pull from the control plane or push from the data plane? The answer decides whether invariant 3 or the residency boundary is the one being crossed, and which plane gains a new service. | Engineering, then ⚖️ counsel (L7) |
| 5 | **Whether F2 is a service or a library** | Does session minting land in `administration.openapi.yaml`, in a fifth `session.openapi.yaml`, or nowhere because it is Cognito's hosted UI? Green proposes the fifth file; nobody has ruled. | Engineering |
| 6 | **The control plane's operation count** | All 12 existing control-plane operations are data-plane-initiated pulls. G50 puts provisioning, publication and grant issuance in v1, and `contracts/README.md:59-65` states the pull convention as a rule. Do platform-initiated pushes go in `control-plane.openapi.yaml` (retiring the convention silently) or elsewhere? | Engineering |
| 7 | **Whether the six live modules with no operation need a service each** | Re-run the trim under G81 against the product test, module by module. Until that lands, `agents.ts`, `learning.ts`, `evaluation.ts`, `observability.ts`, `catalog.ts` and `correspondence.ts` are 100 live exports with no surface and no verdict. | Product owner (G81, not applied) |

**Every one of the seven is a DECISION.** Not one is blocked on analysis. That is
the finding underneath this whole document: **the service count is not
under-derived, it is under-decided**, and producing a number before these seven are
answered produces a number with a 2× error bar and no way to say so.

> ✅ **ONE OF THE SEVEN IS ANSWERED, AND THE FINDING ABOVE SURVIVES INTACT.**
> Row 1 closed on 8 Aug 2026 (G90 + G102). **Six remain, all still DECISIONS**, so
> *"under-decided, not under-derived"* stands as written and the 2× error bar with
> it. **Do not read eighteen rulings taken that day as six answers.**
>
> **What the other rulings do and do not touch.** **G107** rules that the whole
> reconciliation pipeline is **data-plane** — Step Function, Lambdas, Fargate task,
> S3 landing bucket, EventBridge, logs, all under the data-plane DB role, because a
> reconciliation batch *is* tenant data. ⚠️ **That is not an answer to row 4.** Row 4
> asks who owns the **BI** pipeline and which way the SPICE refresh moves; G107
> rules on the reconciliation pipeline and says nothing about SPICE. **Recorded
> deliberately as an adjacent ruling, not a closure** — treating it as one would be
> §5.1's shape, a rule keyed on a convenient landmark. Row 4 is still open, still
> engineering's, and still ends at counsel (L7).
>
> ⚠️ **Row 7 is untouched and is now the largest of the six.** G81's re-run has not
> happened; `agents.ts`, `learning.ts`, `evaluation.ts`, `observability.ts`,
> `catalog.ts` and `correspondence.ts` remain 100 live exports with no surface and
> no verdict. ⚠️ **G104 adds weight to `catalog.ts` specifically** — no model id may
> appear in engine code, the catalogue is the only source, so `resolveModel()` is
> on the extraction path by ruling. **A module the trim might have cut now has a
> named runtime role.**

---

# Real defect versus decision somebody has to take

**Real defects — a derivation, not deferrable** (`HANDOFF` §7: *"If it is a
derivation, it is not deferrable — you are just choosing to ship it wrong"*):

| # | Defect | Fix |
|---|---|---|
| RS-3 | `RegionKey` cannot express `ap-southeast-2` | one union member + a `bi_dataset` fixture, same commit |
| RS-6 | five services with zero operations; eleven with exactly one | delete them from the inventory or say why a function is a service |
| RS-7 | cards and matrix disagree on all thirteen rows; F10 absent from every card; *"F3 by twelve"* is 11 | pick one, delete the other |
| RS-9 | the counts checker reads neither `docs/*.html` nor `docs/build/*.md` | one recursive `readdir` + tag-strip |
| RS-10 | nine modules with no operation, six of them live | reconcile against the contracts |
| RS-14 | `component-architecture.html` states 31 and 35 in the same file | edit |
| RS-15 | five STALE lines; *"twenty of eighty-six"* is 24 | edit, with the command beside it |
| RS-16 | *"five dimensions"* against six | edit |
| RS-17 | four unreconciled counts of one system | one table |
| RS-12 (CI half) | `validateProcedureInjectionSafety()` has no caller | a CI call site — closes the pack half only |

**Decisions — somebody has to take them, and none is engineering's to assume:**

| # | Decision |
|---|---|
| RS-1 | how many of the fourteen foundation boundaries become deployments under G55 + G71 |
| RS-2 | SPICE refresh direction; who writes the RLS rules dataset; whether `BiWorkspace` provisioning is a process |
| RS-4 | does the wire carry classification, or does the plane split stay structural |
| RS-5 | reopen G2/G37 — the palette, which is the administration tier's size |
| RS-8 | which partition is the build's: 35, 11, or the transport table's 3–4 |
| RS-11 | G45 — process boundary, service boundary, or convention |
| RS-13 | is F2 addressable |
| RS-12 (runtime half) | where tenant-authored procedures are validated, given F14 has no create operation |

---

# What this pass attacked and could not break

Listed because a short honest list is worth more than a padded one.

- **The three-tier split itself.** Foundation / capability / control-plane is
  sound. It maps onto a real transport difference, onto the plane boundary held by
  database grants, and onto who calls what. It is the *cardinality inside the
  tiers* that fails, not the tiers.
- **"The edge that must not exist."** The no-downward-query rule is correct, well
  argued, and enforced by something real (two schemas, two roles, no grant). RS-2
  is an attack on decisions that violate it, not on the rule.
- **The build order at `:569-586`.** Foundation before capability, F5 and F6
  undeferrable, F13 ships with C8 or not at all, F14 before the first authored
  procedure. Every one of those survives every reduction in this document — they
  are statements about *sequence*, which do not depend on whether a boundary is a
  process or a function.
- **`docs/contracts/README.md`'s two conventions.** `tenantId` in no request body,
  and one shared closed `ErrorCode`. Both are invariants expressed as absences,
  both hold across all three files, and both survive any repartition.
- **The 65-operation figure.** Derived four ways during this pass and stable every
  time. It is the only count in this problem space that is not in dispute.

---

# What this document does not cover

- **RD-2** owns the `~16`-versus-*"largest deliverable"* contradiction. RS-5 adds
  the third figure (`~25`) and its invariant condition; it does not re-litigate
  RD-2.
- **RD-12** owns G45's unspecifiability against the model. RS-11 is the topology
  question only.
- **RD-3 · RD-7 · RD-15 · RD-16 · RD-17 · S3 · N4 · N7** own the Quick Suite
  decisions. RS-2 and RS-3 are the ownership and representability questions those
  decisions leave behind.
- **B1 · B2 · B4** own session-minting, the missing administration file and
  capabilities-on-the-wire as *buildability* findings. RS-13, RS-5 and RS-4 are
  the *topology* consequences.
- **No screenshot round ran** and no visual was rendered. Every claim about the
  HTML artefacts is derived from their source, not from a render.
- **`Mockups/rec/` was read only through `docs/screen-pack-ledger.md`.** The
  ledger's own banner disclaims itself as *"a dated snapshot, not a living
  control"*, and its §0 note applies here too: *"a green join proves nothing"* —
  the nouns line up; the behaviour is not thereby expressible.

---

**One sentence for whoever schedules this.** The service count is not a
measurement problem — it is seven unanswered decisions wearing a number, and the
only defensible thing to publish today is *"four deployables forced, eleven the
upper bound, thirty-five refuted, and here are the seven questions that close the
gap."*

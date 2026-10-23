# Documentation Index

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** NO — it is the map. Every row points at an authority; no row is one.
> Maintained, and the first file to update when a document is added, retired or
> re-labelled. **It has gone stale on four separate days and `docs/build/` was
> missing from it entirely until 8 Aug 2026** — a whole directory, absent while
> this file claimed to inventory the trunk, and found by a red team rather than by
> a tool. `tools/check-doc-counts.mjs` **cannot catch that class**: an omission has
> no number in it.
>
> **Every row now carries two labels.** Read them before you act on a document:
>
> | STATUS | Means |
> |---|---|
> | **LIVING CONTROL** | maintained, expected to be current. Trust it; update it when you change what it describes |
> | **DATED SNAPSHOT** | true as of a stated date, deliberately not maintained. Evidence, not a control — G32's posture. Do not edit it into currency |
> | **PARTIALLY APPLIED** | a proposal or plan, some of which has landed. The row says which parts |
> | **SUPERSEDED** | replaced. The row names the successor |
> | **WORKING MATERIAL** | an input to a decision, not a decision. Adversarial passes, green-team proposals, explorations |
> | **STALE** | known wrong and not yet corrected. The row says what is wrong |
>
> **V1 AUTHORITY** is a separate axis: **YES** · **PARTIAL** · **NO**, with one
> clause saying *for what*. A document can be a living control and still have no
> authority over v1 scope — `docs/infrastructure-risk-register.md` is exactly that.
>
> *Two-axis labelling pass, 8 Aug 2026. Labels only; no document's body was
> corrected, and several rows point at body errors left deliberately in place.*

> Everything on the trunk (`main`), with what each document is for and how much
> to trust it.
> **Last updated:** 12 Aug 2026 — `docs/c4.html` registered (it was in **neither**
> this index nor `README.md`, while `ls docs/*.html | wc -l` had already moved
> 9 → **10**), every count in this file re-swept against
> `node tools/check-doc-counts.mjs --derive`, and the rows describing the plane
> split and the database topology brought into agreement with **G185**.
> ⚠️ **Nothing in this pass is a build claim; G185 is ruled and not applied.**
> *Previous pass:* 9 Aug 2026 evening — the eleven files that landed in
> `docs/build/` that evening, plus `reconciliation-engine.md`, which had been
> missing since 8 Aug. **Eighteen** model modules, **thirty-eight** capabilities,
> and the v1 trim that made roughly a third of `model/` deliberately inert.
> ⚠️ **This line said *"thirty-six"* until 9 Aug 2026, three lines above the
> command that derives 37** — the §5.11 shape with the reproduction sitting next to
> it. Re-derived by hand for this pass:
> `awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'`
> → **37**. `tools/check-doc-counts.mjs` never flagged it, because the number was
> spelled as a word.
>
> ⚠️ **This file has gone stale three times — 5, 6 and 7 August — and every count
> in it now carries the command that reproduces it.** That is the fix for the
> recurrence, not for the instance: `docs/HANDOFF.md` §5.11 records a count
> written as a word in prose, with no command beside it, as a defect shape rather
> than an accident. **Derive, do not copy.**
>
> ```bash
> ls model/*.ts | wc -l                                  # 20 modules
> ls docs/*.html | wc -l                                 # 1 visual — see below; NINE were deleted 18 Sep 2026 under G264
> awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts \
>   | grep -cE '^  [a-zA-Z]+:'                           # 50 capabilities — 44
>   #                                     until 1 Oct 2026 (R10), 39 until 19 Sep 2026 (G601)
> awk '/^export const ACCESS_RESOURCE_CLASSES = \{/,/^\}/' model/governance.ts \
>   | grep -cE '^  [a-zA-Z]+:'                           # 16 resource classes — 13 until 1 Oct 2026 (R10)
> ```

> **Global note on paths — read this before following any citation.**
> The application this repository used to hold is no longer on the trunk. Unless
> a line says otherwise, **every `src/…` path in this repository refers to
> `archive/sap-line:src/…`**. Read one with:
>
> ```bash
> git show archive/sap-line:src/pages/Drilldown.tsx
> ```
>
> Three annotated tags, all pushed and verified on `origin`:
>
> | Tag | What is in it |
> |---|---|
> | `archive/sap-line` | the SAP-line application — `src/`, `public/`, and the root build configuration |
> | `archive/design-record` | the design record and the model, **including every document deleted in the cut** |
> | `archive/trunk-pre-rebuild` | the trunk exactly as it stood immediately before the cut |
>
> A citation with no branch or tag qualifier is a dead citation. If you add one,
> qualify it.

> 🛑 **Global note on the 8 August 2026 rulings — read this before you act on any
> row below.** **Eighteen rulings were TAKEN on 8 Aug 2026 — G96 through G113 —
> and almost none of them is APPLIED.** They decide the first build phase: the
> database client and the ORM, the id column type, the RLS null polarity, the
> pooling posture, the extraction-rule cache, the model catalogue, the N:M
> algorithm, the JSONB classification path, which plane runs the pipeline, the
> single gate, a YAML parser for `tools/`, both call sites for the pack
> validators, the money codec and the money retype's blast radius, and one
> undefended `tenantRef` that comes off the wire. **`docs/HANDOFF.md` §3 is the
> authority on every one of them; this index is not.** Where a row below
> describes something a ruling changes, the row says so and says *not applied*.
> **A ruling taken is not a change made** — check `model/`, `docs/contracts/` and
> `package.json` before assuming any of it has landed.

> ⚠️ **Global note on scope — read this before building against any type.**
> Since 7 Aug 2026 the scope of v1 is a **decision**. `drop_for_v1` means a type
> **stays declared**, carries a dated note, and gets **no table, no endpoint, no
> code**; it is **not deleted**. **196** top-level exports carry
> `@dropped-for-v1` — 🛑 **this read 198, derived by an awk that arms on any line
> CONTAINING the marker including prose about a neighbouring declaration's drop; it
> is the same false-positive class that made the C4 page render seven live exports as
> dropped. Both figures now come from one derivation, the TypeScript parser:**
> `node tools/check-doc-counts.mjs --derive | grep exports`. ⚠️ **This line read
> *"out of 675"* until 8 Aug 2026 and the denominator was wrong** — and then read
> ***"the tree says 832"* until 12 Aug 2026, which was wrong too.** The tree says
> **849** (`grep -h '^export ' model/*.ts | wc -l`, or
> `node tools/check-doc-counts.mjs --derive`). **That is the third value this one
> denominator has carried**, and the numerator — 198 — has been right throughout:
> the denominator was copied rather than derived every time, which is
> `docs/HANDOFF.md` §5.11 exactly. ⚠️ **No checker caught either wrong value
> here**, because the number sits before a parenthesis rather than before the
> word `exports`. Two modules are dropped whole. **`docs/HANDOFF.md` §0 is how you tell declared from built**,
> and `docs/v1-scope-ledger.md` carries the per-module reasoning.

---

## Read these first

| Document | STATUS · V1 AUTHORITY | What it is |
|---|---|---|
| **`docs/HANDOFF.md`** | **LIVING CONTROL** · **YES** — §3 is the authority on every decision, §0 on declared versus built | **Start here on a cold start, at §0** — what v1 is, declared versus built. Then state of play, the G decisions and which of them are applied — **derive both, never copy** (this row said *seventy-one* and *eighteen* until 8 Aug 2026, which is why the commands are here and the words are not): `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md` and `grep -E '^\| G[0-9]+ \|' docs/HANDOFF.md \| grep -c '✅'`. On 8 Aug 2026 the first returned **95** before G96–G113 were written into §3 and **113** after; the second returned **26** both times, **which is the point — eighteen rulings were taken that day and the applied count did not move.** Then **§3a for G48 — v1 is a product, not a demo, and what that re-opens** — open items grouped by who can close them, the nine recurring defect shapes in §5, and the traps in §7. |
| **`docs/data-architecture.md`** | **DATED SNAPSHOT** · **PARTIAL** — the plane split, storage tiers and record kinds; **not** where v1 runs. Its BYOA-in-v1 premise is reversed by G36, and G82 amends residency. 🛑 **AND G185, 12 Aug 2026, AMENDS ITS DECISION F — read the row before quoting §4.** This cell said only *"the plane split, storage tiers and record kinds"* until then, which would have sent a reader to two sentences that are now false. **What survives, and it is the load-bearing half:** the plane split stays enforced by **separate schemas and separate database roles** (`docs/data-architecture.md:114`), because a grant is a positive control the database evaluates on every statement. **What changes:** *"one cluster"* (`:106`, `:683`) becomes **one cluster per residency region** — decision F is coherent at N=1 region only and never addressed the axis. **What is retired: `control_ro`** — the justification at `:127`, that writing the hosted plane against it *"means hosted and BYOA are the same code path"*, was **false**, since a BYOA plane has no `control` schema to grant against and must already pull over `/catalogue/packs` and `/policy/bundle`; the replacement is a **signed HTTPS pull** into a data-plane-local projection. **And the `tenant` row is control-owned** with a narrow data-plane projection of `id`, `status`, `residency`. **None of it is built** | **The decided data shape** — planes, topologies, storage tiers, record kinds. Closes seven prior open questions; supersedes the open questions in `persistence-design.md` §10 and `byoa-topology.md` §8. |
| **`PRODUCT.md`** | **LIVING CONTROL** · **YES** — the authority on what may be claimed, and on confirmed product truth | Confirmed product record. Positioning, partner motion, domain strategy, and **what may not be claimed**. Read before writing anything customer-facing. |
| **`docs/model-change-ledger.md`** | **DATED SNAPSHOT** · **PARTIAL** — its rulings stand; it predates the v1 trim, so it says nothing about what is built. Two of its rows carry actions never taken | Adjudicated decision record from the adversarial review. Supersedes the swarm reports where they conflict. |
| **`docs/v1-scope-ledger.md`** | **DATED SNAPSHOT** · **PARTIAL** — accurate about *what was cut*; its reasoning column answers a question G48 replaced, and **G81 orders a full re-run producing a NEW ledger** | **What is declared and not built.** One row per `@dropped-for-v1` type, with the ruling that makes the trim safe — dropped means the declaration STAYS, with no table, no endpoint and no code. Dated snapshot, 7 Aug 2026, per G32. |
| **`docs/domain-model.md`** | **LIVING CONTROL** · **PARTIAL** — the authority for entity *shape*; `model/*.ts` and its `@dropped-for-v1` notes decide what is BUILT. Its "backend stack undecided" line was settled by G71 | The design record for the entity model, with a full changelog in §11. |
| **`docs/contracts/README.md`** | **LIVING CONTROL** · **PARTIAL** — the runtime wire, and **the status block for all five YAML files**, which carry none of their own | **The four OpenAPI tiers** (a fourth, `data-plane-local.openapi.yaml`, landed 10 Aug 2026 — ⚠️ *this cell said "all four YAML files" and "The three OpenAPI tiers" until then*), the two conventions that carry invariants, and the **administration** file that does not exist and should. |
| **`docs/build/deploy-handoff.md`** | **LIVING CONTROL** · **NO** — it decides nothing; it records what is deployed, what is authorised, what is owed, and what will waste a day | **THE DEPLOY HANDOFF, 18 Sep 2026.** For an agent with rights to deploy, run `aws ssm` and run migrations. Six stacks deployed and both planes healthy; eight traps that survived a green synth and a green gate; the operations gap (76 declared, **4** handled, G200 freezing the rest); and the properties that must not break, each with the mechanism holding it |
| **`docs/tech-stack.md`** | **LIVING CONTROL** · **YES** — language, runtime, framework, database, compute, region, CI/CD, IaC, tagging, observability, hardening | **THE STACK AND DEPLOYMENT AUTHORITY, added 18 Sep 2026.** The readable projection of G71, G97–G101, G108, G177, G191, G193, G198, G211, G226 and **G252–G263**; `docs/HANDOFF.md` §3 outranks it on any row. **ARM64 everywhere, ECS on Fargate, Aurora Serverless v2, S3 + CloudFront, `us-west-2`, CodePipeline + CodeBuild on ARM, CDK in `infra/`.** 🛑 **Nothing in its §7–§13 is built** — it records decisions so the infrastructure slice builds one thing instead of guessing, and it names the commit that ends G212 |
| **`docs/build-conventions.md`** | **LIVING CONTROL** · **YES** — dependencies, type conventions, accessibility, devices | **THE ANTI-DRIFT CONTROL — read before adding a dependency or writing a component.** Dependencies (decided, banned, and undecided-with-owner), the non-negotiable type conventions, and the WCAG 2.2 AA rules this product specifically gets wrong. **A LIVING CONTROL, deliberately unbannered** — a stale dependency policy is worse than none because people follow it anyway. ⚠️ **Its undecided-with-owner list shrank on 8 Aug 2026** — the Postgres client (G98), the ORM (G99) and the pooling mode (G101, which closes decision D3) are decided, and G96 and G109 add two more pinned-exact devDependencies. **Decided is not installed**; the file says which is which, and it is being renumbered by a concurrent pass, so cite it by row rather than by line today. |
| **`docs/build/phase-one-plan.md`** | **LIVING CONTROL** · **PARTIAL** — **ratified as the plan of record by G92**, 8 Aug 2026, and authoritative for phase-one **sequencing** only; `docs/HANDOFF.md` §3 outranks it on every decision. ✅ **Its gate D4 is CLOSED** — all four items are decided (G75, G78, G80b, G85) — and **D3 is closed too** (G100, G101). ⚠️ The re-cut obligation is standing: re-derive any gate from §3 rather than trusting the table | **THE ADJUDICATED PLAN FOR THE FIRST BUILD PHASE.** Rules between five agent reports — three green (22 vertical slices) and two red (44 findings) — and produces one ordered plan. **The ruling: no vertical slice can go first; phase one is a foundation phase with no user-visible outcome**, and eight decisions gate most of it. The five source reports are alongside it in `docs/build/`. |
| **`docs/v1-trim-proposal.md`** | **PARTIALLY APPLIED** · **PARTIAL** — the sign-off sheet; `docs/HANDOFF.md` §3 pass H outranks it on every row. **Its "nothing applied" banner went false on 8 Aug** and is corrected in place | **The per-module trim proposal, rewritten against G49–G71.** Each module is a separate sign-off. Four items are applied to `model/`; the rest are ruled, narrowed or still open — see its banner. |
| **`docs/screen-pack-ledger.md`** | **DATED SNAPSHOT** · **PARTIAL** — the nearest thing to a v1 build scope. The screens are superseded as a *visual* world by `DESIGN.md` (G72) and remain authoritative as **product truth** | **The join between the drawn product and the model** — one entry per screen, with the model types, capabilities and contract operations behind it, and the gaps where there are none. The nearest thing to a v1 build scope, and the ingredient a PRD is written from. Dated snapshot, 7 Aug 2026, per G32. |
| **`docs/model-gaps.md`** | **DATED SNAPSHOT** · **NONE** — it decides nothing and owns nothing; every authority it names outranks it. Dated snapshot, 16 Aug 2026, per G32 | **The thirty model gaps found while drawing the eleven route screens** under `design/routes/` — the negative image of `docs/screen-pack-ledger.md`. Each row carries the reproducing command and its output, the route it blocks, and the §3 ruling that already governs it where one does (eleven of the thirty do). 🛑 **Numbered MG1–MG30, NOT G1–G30** — the reporting pass's local numbering collides totally with `docs/HANDOFF.md` §3, which runs to **G190** (`grep -oE '^\| G[0-9]+ ' docs/HANDOFF.md \| grep -oE '[0-9]+' \| sort -n \| tail -1`) — ⚠️ **this said G183 until 16 Aug 2026, and it moved by MERGE rather than by a ruling: `origin/main`'s G179–G185 arrived, and five design rulings drafted as G179–G183 were renumbered to G186–G190 after the two sessions minted the same identifiers; `docs/HANDOFF.md` §3's Pass J banner holds the mapping**; do not reuse it. Two findings are different in kind: the **arrivals denominator** (uncomputable from the current model, so every completeness claim on every screen bottoms out there) and **the engine being on no contract tier** — the largest finding in the file, and the only one sitting over a **built** engine rather than an absent type. ⚠️ **The command that row prints, `grep -rniE 'admission_refusal\|residue\|control_total\|postcondition' docs/contracts/`, returned ZERO when the ledger was written and returns THREE matching lines from 16 Aug 2026; this cell said *"→ zero"* until then.** Two of the three are comments that restate the finding inside the contract itself; **the third is a real enum member** — `docs/contracts/control-plane.openapi.yaml` carries `admission_refused, postcondition_failed` in `findings[].kind` — so the ledger's *"not one operation, schema, enum member or description"* is now false for the **control-plane** tier. **The finding survives with a narrower claim**, which §3.2 states and re-derives: that enum is a telemetry rollup of kind plus counts and latencies, carrying no reason, no side and no document id, on the plane that never reads tenant data — so the platform can COUNT that admissions were refused, while `capability`, `foundation` and `data-plane-local` still expose the engine's conclusions in **zero** operations, schemas and enum members. ⚠️ It corrects its own source's shape count from twenty-one to **twenty-six** and prints the rule it counted by. |
| **`docs/pending-rulings.md`** | **DATED SNAPSHOT** · **NONE** — it decides nothing, owns nothing, and **recommends nothing**; every authority it names outranks it. Dated snapshot, 16 Aug 2026, per G32 | **The batch of open owner decisions, ordered by how many issues each unblocks** — the negative image of `docs/HANDOFF.md` §3. Seventeen rulings in §3 and eleven bounded ones in §4, each carrying its options **with what each costs**, a **what either option must preserve** line, and the deriving command beside every count. Swept from four sources: the `needs-g-decision` issues, `docs/model-gaps.md`'s MG rows, `docs/screen-pack-ledger.md` §5 and §4.2's P questions. 🛑 **It existed only as an untracked file on one machine for the whole day it describes, and it landed against a tree that had already moved.** Its landing banner does the arithmetic: **three of the seventeen were ruled the same day** — §3.1 → **G198**, §3.2's S-21 half → **G199**, §3.5 → **G200** — and are moved to its **§2a**, with their §3 pricing kept in place rather than deleted. A fourth, §4.9, was **closed by a merged PR with no G row at all**. ⚠️ **Every `docs/HANDOFF.md:NNNN` citation in it is now wrong as a class and not one of them fails to resolve** — two ruling passes were inserted above them, so `:2169` was G173 and is now G4, while `:2039` and `:1997` are blank lines. The banner re-derives all thirteen and says to grep instead. ⚠️ **It states 12 issues blocked on #188 and the true dependency figure is 7**; the larger number counts citations, and the larger number is the one that was put to the owner. **Read it for the costs, never for a count.** |
| **`CLAUDE.md`** | **LIVING CONTROL** · **YES** — the only numbered enumeration of the invariants, and the entry point for the verification surface | Agent configuration, and **the only place the eleven invariants are numbered**. Copy them, never paraphrase — a paraphrased invariant is a changed invariant. Leads with a branch warning for good reason. |

---

## The model

**Twenty-three** TypeScript modules under `model/` — `ls model/*.ts | wc -l` — ⚠️ **this
said nineteen until 22 Aug 2026, then twenty on two branches at once**: `session.ts`
landed under G225 and `field-path.ts` as G214's one parse seam, and **each branch
said twenty while the merged tree is twenty-one** —
typechecking clean under `strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax`,
`noUnusedLocals` and `noUnusedParameters`, governed by `model/tsconfig.json`,
which is stricter than the deleted application's own settings ever were.
`model/` is the whole of the code on this trunk; the application it replaces is
at `archive/sap-line:src/`.

> ⚠️ **A green `tsc` is weak evidence here** and this table's list is not the
> verification surface. The model is types only — nothing assigns values, so most
> changes *cannot* fail to compile. Run `node tools/planner/extract.mjs` as
> independent evidence and compare edges and gaps by kind against the previous
> run. `docs/HANDOFF.md` §2 and §5.10.

The **⚠️ dropped** column is the count of `@dropped-for-v1` markers in that file —
`grep -c '@dropped-for-v1' model/<file>` — not a judgement about the module.
A zero means nothing in it was trimmed; it does not mean the module is finished.

| File | ⚠️ dropped | Concern |
|---|---:|---|
| `kernel.ts` | 0 | the branded-id primitives every other module imports, and **no imports of its own** (`grep -c '^import' model/kernel.ts` → 0). Never in this table before 7 Aug |
| `identity.ts` | 0 | the totality proofs: every entity carries its own id, every brand argument names its entity, no id-shaped reference is a bare string. **It must compile unchanged through a trim.** Never in this table before 7 Aug |
| `canonical.ts` | 0 | **RFC 8785 (JCS) canonicalisation — G20, applied 9 Aug 2026.** It states WHICH BYTES represent a record, which `RecordChain` and `UsageAttestation.bodyHash` both assumed and nothing defined. Read its header before touching it: the scheme is **irreversible after the first hash**, because re-hashing history means rewriting the records the chain exists to prove were not rewritten. Never in this table before 23 Aug |
| `domain.ts` | 29 | tenancy, documents, archetypes, reconciliation, `Procedure`, money, periods, solution packs, the `Endpoint` registry, `Solution` — the tenant-side operating assembly — and the operator-initiated proposal (G42–G44) |
| `reconciliation.ts` | 1 | **the engine, as types and total functions** — the executable half of the `set_reconciliation` archetype. It admits two transaction populations, folds `PairingSpec.strategies` in declared order and returns the residue; the residue is the product. Home of `AssertNoTextDeep` and of invariant 4's fail-closed half, where `admitPopulation()` refuses a declared path absent from `fieldClassification` (G106). Its header carries nine greps that must return zero and each strips comments first. Never in this table before 23 Aug |
| `access.ts` | 0 | stakeholder classes, capabilities, roles, scope — replaces the deleted `RoleKey` enum. The `OrgClass` axis belongs here too, as does `CAPABILITY_RESOURCE_CLASS` — the fourth axis — and the `authorize()` / `redeemAuthorization()` spine |
| `governance.ts` | 4 | tenant access grants, partner-role clamping, erasure, the **thirteen** resource classes, and hash-chained audit and data-access streams |
| `agents.ts` | 16 | **the agent composition model** — closed tool vocabulary with an effect per tool, harness documents under four-eyes approval, model binding through the catalogue rather than by string, a platform eval floor no pack can subtract from, and `DerivedAgentGrant` minted per step execution |
| `presentation.ts` | 52 | ⚠️ **WHOLLY `@dropped-for-v1` — declared, not built.** The Gen BI layer: dashboards, cards and bindings. The canvas is `configuration`; every card binding is a `tenant_data` read resolved under the **viewer's** scope, so opening a dashboard never confers its contents. Carries a banner at the top of the file |
| `deployment.ts` | 13 | ⚠️ **WHOLLY `@dropped-for-v1` under G36, which slips BYOA to v1+1.** The fleet: data planes, liveness, engine and schema versions, heartbeat. Carries a banner at the top of the file |
| `correspondence.ts` | 0 | counterparties, threads, the inbound trust boundary, disclosure |
| `connectors.ts` | 0 | **connector configuration: closed over the security-relevant parameter KINDS, open over their names.** `CONNECTOR_PARAMETER_ENFORCEMENT` is total over the four kinds, so a fifth cannot be added without an enforcement row saying which capability sets it and whether it clears verification. `validateConnectorParameters()` is the third validator `tools/check-pack-safety.mjs` calls. Landed 16 Aug; never in this table before 23 Aug |
| `policy.ts` | 15 | **eight** policy kinds — **six live** — admission, autonomy dials, versioned and audited. `spend` and `content_guardrail` are excluded from `LivePolicyKind` for v1, which is why `PolicyDefaults` is total over the live set and not over all eight. *(Seven declared / five live until 8 Aug 2026, when G79 added `managed_service_use` to carry Textract's residency — Textract cannot be a `ModelCatalogEntry` and never passes `resolveModel()`.)* |
| `billing.ts` | 32 | metering, rating, budgets, entitlement lease, attestations, provider cost capture |
| `evaluation.ts` | 21 | scorers, three levels, gates, labels, and the injection corpus |
| `observability.ts` | 12 | three telemetry planes |
| `catalog.ts` | 1 | model garden, with residency enforced at routing level — `resolveModel()` is the **only executable enforcement of residency** in the codebase |
| `examples.ts` | 0 | finance and KYC expressed as data against one core. ⚠️ Named in `docs/HANDOFF.md` §8 as the home of the fixtures pass that five total records are waiting on |
| `learning.ts` | 33 | **added 6 Aug — a proposal, not a decision.** Corrections derived rather than stored, a nomination gate, and a learning record with no free-text field. Zero call sites; read the recommendation in its header before the types |
| `session.ts` | 0 | **added 22 Aug 2026 under G225.** `SessionBounds`, the platform ceiling G220 supplies, the closed refusal union and `validateSessionBounds()` — required configuration that REFUSES on absence, never a default (G139). **Zero imports**, deliberately: `MAX_AUTHORIZATION_SECONDS` in `access.ts` is a GRANT ceiling keyed by resource class and reading it as a session clock is §5.1's landmark substitution, so there is no path here by which it could be read |
| `field-path.ts` | 0 | **added 22 Aug 2026, G214 — the ONE parse seam.** `FieldPath` is a branded token list, not a string: key and zero-based index segments, and **no wildcard** under **G243**, because a `FieldSpec` must name one thing for G222's maximum-over-classes to be computable. Imports nothing but `kernel.ts` |
| `serving-host.ts` | 0 | **added 23 Aug 2026 under G225 — the module G179's circularity needed.** `dataPlaneHost` was *"Resolved at sign-in, never guessed"* with nothing anywhere saying how. Holds the host→tenant registry and `resolveServingHost()` (a LOOKUP, never a parse — `tenant = subdomain(host)` breaks silently under BYOA), the one host normalisation, G180's `checkHostBinding()` with its revocation instruction as a VALUE, the reserved-label mint-time rule and the region-versus-`Tenant.residency` agreement. **Imports only types**, and touches `IdentityConnection.domains` nowhere — G179 forbids one field answering both questions |
| `ingestion.ts` | 0 | **added 24 Aug 2026 under G225, and it is the twenty-third module.** Carries three rulings at once: **G184**'s ONE intake vocabulary (`INTAKE_CHANNEL_KINDS` — four channels, `SourceDocument.origin` DELETED, `api` DROPPED rather than folded), **G205**'s `Arrival` — the durable row that records what was decided about one artefact, because a channel that has seen forty thousand files has one row and one timestamp — and **G206**'s `admitArrival()`, a fixed cascade of total functions rather than an authored graph. Also holds the pack classification vocabulary and `validatePackClassificationRules()`, whose rules are a declared `IdentifierNormalisation` plus enumerated values because **G130** forbids a compiled pattern over counterparty-adjacent content. **Every import is `import type`**, so it has no runtime edge at all |
| `held-work.ts` | 0 | **added 24 Aug 2026, G225.** The fourteenth `RetentionClass` (`held_work`, G233), shared by #238 and #239 so the question is answered once. `latestPossiblePurge()` is the abandonment rule — a function, so a test holds it |
| `money.ts` | 0 | **added 19 Sep 2026 under G286, and it is G111's CODEC — the module that ruling has been asking for since 8 Aug 2026.** `Money.amountMinor` is `bigint` here and a decimal STRING on the wire, and this is the only thing permitted to convert between them: `parseMinorUnits` / `formatMinorUnits` / `parseMoneyWire` / `toMoneyWire`, plus `minorUnitsFromCount` for the one configured `number` (`Tolerance.rounding.minorUnits`) that still has to become money. It also holds the arithmetic, the guards and `MoneyRefusal`, all moved verbatim from `model/reconciliation.ts` §3, which predicted the move in its own words — *"when it lands, this section collapses into a call to it."* **Two refusal arms changed MEANING without changing name:** `not_integer_minor_units` is unreachable from a constructed `Money` and survives at the two edges where a non-integer can still arrive; `exceeds_exact_integer_range` is now the `int8` COLUMN G65 names, −2^63 … 2^63−1, a bound 1024× the old one. Imports one type and nothing else |
| `onboarding.ts` | 0 | **added 19 Sep 2026 under G535, and it is the twenty-sixth module and H2's SEQUENCE.** The pack's own row read *"Onboarding state in the model: nothing persists the sequence, the force or the mark. All of it is state on this surface. **NOT BUILT**"*, and this closes it in the MODEL sense and no other. Six ordered steps transcribed from `S1 Staff.dc.html`'s `STEPS` array, `STEP_HANDS` and `STEP_TITLE` total over them, `onboardingSteps()` with **exactly one step `next`**, and two transitions and only two — `completeStep()` (the next one, never another) and `forceStep()` (a BLOCKED gate, marking it and everything above it, with a seven-character reason floor). 🛑 **The state is a PREFIX LENGTH and not a set**, so a non-prefix onboarding is unrepresentable (§5.5), and the count union is DERIVED from the step tuple. 🛑 **`forced` is APPEND-ONLY, which is a deliberate divergence from the prototype**: `S1` keeps one slot and a second force overwrites it, and the contract calls the reason *"PERMANENT, AND THE ONLY RECORD OF WHY THE SEQUENCE WAS BROKEN"*. ⚠️ **No table, no handler, no clock** — there is no `stalled` stage though `S1` draws one, because it needs a timestamp with no producer and a threshold nobody has ruled on. Imports nothing |
| `approval.ts` | 0 | **added 19 Sep 2026 under G658, and it is the twenty-seventh module and the FIRST EVALUATOR `ApprovalConfig.quorum` AND `segregationOfDuties` HAVE EVER HAD.** Measured before it was written: `grep -rn distinctHolders model/ server/ tests/` returned the declaration, three literal `2`s and two equality assertions — **zero evaluators** — and `model/policy.ts` says what a boolean nothing reads is worth: *"A control that always passes is a false assurance, and a false assurance is the one thing worse than a missing control."* Holds `approvalState()` (the contract's five execution states, the blockers, and `count(DISTINCT)` over approvers so one person approving twice is one person), `segregationViolated()`, and `approvalRequiredFor()` — TWO independent thresholds, severity and money, either of which arms the gate. Also `SEVERITY_ORDER`, the first place the severity ladder is declared as DATA, which **ascends where `Exception.severityRank` descends**. 🛑 **IT IS NOT A SECOND EVALUATOR BESIDE `decide()`:** it never answers *"may this principal do X"*, it takes no argument that is a principal, and it is asked strictly AFTER the gate — a refusal here is a 409, never a 403. ⚠️ **`ApprovalConfig.approvers` and `CapabilityRequirement.distinctHolders` are STILL unevaluated and the blocker is measured**: `db/migrations/0009`'s `user_visible_to_session` keys on the SESSION, so a request path reads exactly one person — itself — and cannot ask what another holds. Imports one value (`compareMoney`) and four types |
| `run-admission.ts` | 0 | **added 19 Sep 2026 under G692, and it is the twenty-seventh module — the executable form of *"run admission must be idempotent on (period, definition, slot-fill state)"*, which `RUN_TRIGGER_KINDS` has stated in prose since 5 Aug 2026 with nothing anywhere doing it.** Three total `Record`s — `DEFINITION_ADMITS_A_RUN`, `PERIOD_ADMITS_A_RUN` (two of four members admit: `reopened` does, because the contract's own remedy for `period_closed` is *"Reopen the period first"*) and `CARDINALITY_REQUIRES_A_DOCUMENT` — and a NINE-ARM refusal union carrying branded ids only, so `AssertNoTextDeep` holds on it. 🛑 **IT DOES NOT HASH AND IT DOES NOT READ A ROW.** `slotFillBasis()` returns the RFC 8785 canonical form and stops; the digest lives with the writer outside `model/`, which is `0012` §6's rule for `subject_ref`. 🛑 **THE UNFILLED SLOT NAMES TRAVEL OUTSIDE THE CONTAINMENT PROOF**, on `RunAdmissionVerdict.unfilledSlots`, because `SlotName` is a bare `string` — *"the union carrying the REASON holds the proof; the record carrying the declared path does not"*. ⚠️ **`trigger_not_enabled` IS NOT AN ARM AND CANNOT BE**: `manual` is deliberately absent from `RUN_TRIGGER_KINDS`, so it cannot fail a test against a set it is not in — the arm belongs to the `scheduled` admitter nobody has written. ⚠️ **NOTHING BINDS A `SourceDocument` TO A SLOT anywhere in the repository**, so the fill is empty on every served request and a definition declaring an `exactly_one` slot is a 422 forever. That is the correct answer and it is stated on the declaration so nobody reads `[]` as *all slots satisfied* |
| `extraction.ts` | 0 | **added 21 Sep 2026 under G1451–G1459 (E2), and it is the TWENTY-NINTH module — one below `check-doc-counts`'s ceiling of 30.** THE ONE CONVERSION SEAM between a stored payload position and an `ExtractedValue`: `addressableToExtracted()`, pure, total, never throws. **It dispatches on `FieldSpec.dataType` and NEVER on the value** — invariant 4, measured rather than argued, because a `typeof`-dispatching converter disagreed with the operator's declaration on FOUR of FOUR of E1's fixture rows. Carries `EXTRACTED_KIND_FOR_DATA_TYPE`, a total `Record<DataType, ExtractedScalar['kind']>` whose image excludes `absent` deliberately (absence is a property of the VALUE, never of the declaration), and **the first total `Record` in `model/` with a real construction site** — a sixth `DataType` is `TS2741` at the record AND `TS2322` at the exhaustive switch. **Money goes through `model/money.ts` and nothing else (G111)**, so a JSON number at a `money` position is REFUSED rather than given an invented currency. The refusal union carries a branded `FieldPathKey` and a closed `JsonShape`, never the path and never the value, under `AssertNoTextDeep`. **R12, the owner's: `structured` and `tabular` only**, fenced on `FIDELITY_CROSSES_MANAGED_SERVICE`, which is IMPORTED from `model/ingestion.ts` rather than restated. Mounts nothing; no caller outside `tests/` |
| `session-mint.ts` | 0 | **added 21 Sep 2026 under G1601–G1612 — the twenty-ninth module, and the TYPE-LEVEL HALF OF INVARIANT 1 at the one act most exposed to it.** `MintSessionInput` has **no `tenantId` field at all — absent, not `null`** — because G315 puts the tenant in the OIDC `state` deliberately, so a mint writer that carries it forward makes tenant scope a thing conferred by AUTHENTICATION *with a ruling apparently endorsing it*. 🛑 **A KEY CHECK ALONE LEAKS AND THE GAP IS ONE FIELD AWAY, MEASURED:** adding `surface: ServedSurface` leaves the shallow proof GREEN and fails only `AssertNoTenantDeep`, which refuses a `TenantId` at ANY property position — its leaf test is `Extract` and never `extends`, because `TenantId \| null extends TenantId` is FALSE. ⚠️ **THE OUTPUT `Omit` IS THE LOAD-BEARING HALF**: excess-property checking is a check on LITERALS, so a spread passes a tenant with no error and `MintedSessionFacts` simply has nowhere to put it. **No writer, no route, no migration, and NO CLOCK** — `expires_at` is `now() + interval` in SQL and the mint returns the validated bounds instead. ⚠️ **R7 IS NOT TAKEN** and one half of it is decided by invariant 1 rather than preference: at mint time there is no tenant, so a PER-TENANT bound is UNREADABLE |
| `partner-portal.ts` | 0 | **added 1 Oct 2026 under W5 (G2633–G2640) — the THIRTY-FIRST module, and the partner portal's THINGS where R10's `model/access.ts` §6c gave it a PRINCIPAL.** Invitations, the roster state, deal registrations, the sandbox and trial requests — G300's MODEL third for the five operations mounted the same day. 🛑 **NOTHING IN IT NAMES A TENANT**, and `_PartnerPortalRecordsNameNoTenant` makes adding one a compile error: invariant 2's single path stays the only one. ⚠️ `checkDealRegistrationShape()` holds the rule the wire cannot (every shape-specific field is optional there), and `normaliseCompany()` is ASCII-only because `0322`'s generated key is `COLLATE "C"` — G2636, found by evaluating the column's own expression |
| `publication.ts` | 0 | **added 4 Oct 2026 under U-29 (G4201–G4207) — the THIRTY-SECOND module, and G110's publication seam's REFUSAL LOGIC for document types, as a pure function.** `validateDocumentTypeTemplates()` — six refusals, a const so `tools/check-pack-safety.mjs` derives its inventory (G4202) — and `admitDocumentTypeDeclaration()`, which also runs G206's `validatePackClassificationRules()` and refuses an EMPTY declaration (§5.6). 🛑 **IT IS NOT A WRITER**: no grant, no route, no migration — which operation, verb and principal may author a document type is **G4204, ⛔ PUT TO THE OWNER**. ⚠️ It does not run the procedure validator, because that would forge a tenant (G4203); and `key_shipped_twice` exists because the classification validator resolves a duplicated key last-wins, silently (G4205) |
| `tsconfig.json` | — | standalone: no `extends`, no `references`, `include: ["*.ts"]`. Do not give it an `extends` |


> 🛑 **THE TWO ROWS FOR `extraction.ts` AND `session-mint.ts` BOTH SAY *"the
> twenty-ninth module"* AND NEITHER IS CORRECT ABOUT THIS TREE: IT HOLDS
> THIRTY.** §5.11 with a second parent — *the number agreed and the sets did
> not.* One branch added `extraction.ts` (G1451–G1459) to twenty-eight, the
> other added `session-mint.ts` (G1601–G1612) to the same twenty-eight, and
> each was right about its own branch. **Both rows are kept; the ordinal in
> each is what is wrong, not the module.** Derive it, never read it:
> `ls model/*.ts | wc -l` → 30, against `check-doc-counts`'s `modules` band
> of `[8, 60]` — **30 of headroom**, the ceiling having been raised from 30
> to 60 by G1479 on a measurement one slice earlier.
> *Derived 21 Sep 2026 — integrate/all-sixteen.*

> 🛑 **THIS TABLE LISTED SIXTEEN MODULES WHILE THE SENTENCE ABOVE IT CORRECTLY
> SAID NINETEEN, AND IT DID SO UNTIL 23 Aug 2026.** `canonical.ts` (9 Aug),
> `reconciliation.ts` (8 Aug) and `connectors.ts` (16 Aug) had **never** been in
> it. The same three were missing from `docs/domain-model.md` §12 and from
> `docs/HANDOFF.md` §2, and all three tables were corrected together.
>
> ⚠️ **`node tools/check-doc-counts.mjs` was EXIT 0 on this page throughout, and
> it was right to be.** The count above the table is derived and correct; the
> rows under it are a second, separate claim, and **only one of the two has a
> number in it.** A count control cannot see the gap between a total and the
> enumeration beneath it. That is the blind spot **G242** was ruled for, and
> `tools/check-absent-rows.mjs` now compares this table against `ls model/*.ts`
> inside `npm run check`. **A module added to `model/` and not added here is now
> a red gate, not a reader's lucky catch** — which is how all four previous
> instances of this defect were found.

`model/connections.ts` is **specified and unwritten** (`docs/tenancy-topology.md`
§4; shape constrained by `docs/day-2-operations.md` §9 delta 22).

---

## The screen pack

⚠️ **`Mockups/rec/` was absent from this index, from `README.md` and from
`CLAUDE.md` until 7 Aug 2026**, while all three purported to inventory the trunk.
It is **22 tracked files** — `git ls-files Mockups | wc -l` — and the largest
product-specification artefact in the repository.

**Eighteen drawn screens** (`ls Mockups/rec/*.dc.html | wc -l`): twelve product
surfaces and six design-system files. The taxonomy is **v2**, in
`Mockups/rec/Sitemap.dc.html`, sorting by who authors a thing and how often —
Entry, Tier 0 (ambient), Tier 1 Work, Tier 2 Definitions, Tier 3 Administration.

**Read `docs/screen-pack-ledger.md` alongside them.** It joins each screen to the
model types, capabilities and contract operations behind it, and it is where the
gaps are named.

> ⚠️ **Screen design is PAUSED by G28** until the tier taxonomy gains a fourth
> axis — which organisation. The premise still holds:
> `grep -ril "partner" Mockups/rec/*.dc.html` returns **0 of 18**, while the
> partner motion is confirmed product truth in `PRODUCT.md`. G28 is action on the
> design team and has not moved.
>
> ⚠️ **`PRODUCT.md` records that no typography or palette constraint has been
> established as binding**, so `Palette.dc.html` is a proposal rather than a
> commitment.

**One visual** — `ls docs/*.html | wc -l` — ⚠️ **this said TEN until 18 Sep 2026; nine were deleted under G264, retrievable at `git show archive/pre-handoff-pack:<path>`**, or
`node tools/check-doc-counts.mjs --derive`, and count the file listing rather
than this heading: it read *"Two visuals"* while the list was three long, then
*"Eight"* while it was nine.

> ⚠️ **THIS HEADING SAID *"Nine visuals"* UNTIL 12 Aug 2026, AND THE LIST BELOW
> WAS NINE ITEMS LONG WHILE TEN FILES WERE ON DISK.** The tenth is
> **`docs/c4.html`**, added below. It is the **third** time this heading has
> undercounted the directory, which is why the command sits beside it. 🛑 **The
> defect was worse than a count: `docs/c4.html` appeared in NEITHER this index
> NOR `README.md`** — `grep -c c4 docs/INDEX.md README.md` returned zero from
> both — so the newest visual in the repository was navigationally invisible for
> as long as it existed. ⚠️ **And the gate stayed green through it, twice over.**
> `tools/check-doc-counts.mjs` governs the **count** of HTML visuals, and it did
> report this line — but as **HISTORICAL**, not STALE, because the retrospective
> cues in the sentence beside the number are exactly what its classifier reads as
> *"already narrating its own correction"*; HISTORICAL never fails a run. And
> **nothing whatever governs a document's PRESENCE in this list**. Same class as
> `Mockups/rec/` (7 Aug 2026) and `docs/build/` (8 Aug 2026) — **an omission has
> no number in it** — with a new wrinkle: a wrong count sitting next to the words
> that explain a *previous* wrong count is a count the checker will not fail on.

> ⚠️ **Nine of the ten predate `agents.ts`, `presentation.ts`, `learning.ts` and
> the resource axis** — every one below except `docs/c4.html`, which landed
> 12 Aug 2026 and is the one visual here that is generated rather than drawn.
> **This sentence said *"All nine"* until 12 Aug 2026 and is narrowed rather than
> deleted, because the property it states is still true of the nine.**
> `model-topology.html` draws about ten of the **eighteen** modules and mentions
> `agents.ts`, `presentation.ts` and `access.ts` **zero**
> times (⚠️ *this read "ten of the **sixteen**" until 12 Aug 2026 — the numerator
> is what the diagram draws, the denominator is the tree, and only the
> denominator moved:* `ls model/*.ts | wc -l` → 18); `access-matrix.html` draws
> the 3×5 organisation × stakeholder grid with
> no resource term, against six scope dimensions and thirteen resource classes (sixteen since R10, 1 Oct 2026).
> Accurate to 5 Aug afternoon, and no further. **Each of the nine carries its own
> staleness banner at the top of the rendered page** — read that banner before
> trusting the diagram under it. 🛑 **`docs/c4.html` carries NO staleness banner**,
> which is a gap and not an exemption: its hand-authored half can rot exactly as
> theirs did, and nothing on the page warns of it. `docs/HANDOFF.md` §7 records a
> stale visual as the one artefact class that has already misled a reader.
>
> ⚠️ **None of the nine shows the v1 trim, so every one of them overstates what v1
> contains** — `presentation.ts`'s dashboards are drawn as present and are
> dropped whole. **None distinguishes a declared-and-unbuilt type from a live
> one.** `docs/c4.html` is the exception on both counts, for its generated half
> only: it flags a module carrying the whole-file `@dropped-for-v1` banner rather
> than drawing it live. `docs/access-matrix.html` additionally gained a dated
> correction block on
> 7 Aug, because two of its claims about `RoleKey` went false when the enum was
> deleted.

- **`docs/c4.html`** — **PARTIALLY APPLIED · NO.** **the C4 record, four levels of
  zoom — and the only visual here that is GENERATED rather than drawn.** Landed
  12 Aug 2026 on branch `docs/c4-model-and-plane-rulings`; **not on `main`.**
  **Levels 3 and 4 and the built database schema are re-derived from source** —
  `model/*.ts` through the TypeScript compiler API, `db/migrations/*.sql` through
  a scoped SQL scanner — by
  `tools/planner/{extract-c4-data,render-c4-components,render-c4-page}.mjs`, and
  `tools/check-c4-freshness.mjs` **fails `npm run check`** (as `check:c4`, the
  fifth checker) when the committed artefacts disagree with the tree. The other
  two artefacts are `docs/c4-data.json` and `docs/c4-components.mmd`. ⚠️ **Levels
  1 and 2 are HAND-AUTHORED and carry exactly the staleness risk every other
  visual in this list carries** — a container diagram cannot be derived from a
  tree with no deployed containers. The page states on its face which half is
  which; **read that block before trusting the picture.** ✅ Its Level 1–2
  database topology is current with **G185** — `control` and `tenant` schemas in
  **one cluster per residency region**, roles `control_rw` · `tenant_rw` ·
  `tenant_migrate` with `control_ro` **retired**, the `tenant` row control-owned
  with a narrow data-plane projection — and says on its face that **none of that
  is built**. 🛑 **Three caveats on the generated half**, all from
  `docs/HANDOFF.md` §0a: its export figures (`docs/c4-data.json` → 849 statements / 913 names / 196 dropped)
  **disagree with `node tools/check-doc-counts.mjs --derive`** (849 / 198),
  because the AST walker has no branch for `export type { … }` re-exports, and
  **no checker governs a number inside the page** — `check:counts` reads `*.md`
  only; the generators **no-op with exit 0 on any path containing a space**; and
  the SQL scanner cannot see `ALTER`, `DROP POLICY`, `REVOKE` or
  `SECURITY DEFINER`, so from migration `0002` onward a later
  `DISABLE ROW LEVEL SECURITY` would leave the page printing `RLS ENABLED ·
  FORCED`. **Generated is not the same as trustworthy, and the gap is
  safety-directional.**
- **`docs/model-topology.html`** — **STALE · NO.** the **logical** model: control plane,
  governance membrane, per-tenant data planes, module boundaries.
- **`docs/deployment-topology.html`** — **SUPERSEDED · NO.** 🛑 **Superseded on placement
  18 Sep 2026 — successor `docs/tech-stack.md` §7–§8** (G252–G256: ARM64, ECS on
  Fargate, Aurora Serverless v2, S3 + CloudFront, `us-west-2`). Every placement it
  draws predates all five. It remains the **physical** placement: two planes,
  two topologies, three stores, every entity overlaid onto where it lives, and
  the day-2 fleet layer. 🛑 **Newly stale in one more way since 12 Aug 2026:
  G185 splits the database by residency region**, so the store layer it draws is
  one cluster where the ruling now puts one per region, and it predates the
  retirement of `control_ro`. **`docs/c4.html` is the only visual here that
  reflects G185.**
- **`docs/systems-end-to-end.html`** — **SUPERSEDED · NO.** 🛑 **Superseded on the STACK
  18 Sep 2026 — successor `docs/tech-stack.md` §1**, which is the single table for
  language, runtime, framework, database, compute, region, CI/CD, IaC, tagging,
  observability and hardening, each naming its G row. **Its build/buy verdicts are
  NOT superseded** — a different question. the **systems inventory**: every system
  needed to run it, by plane, with build/buy status and the open licence
  questions.
- **`docs/value-layers.html`** — **STALE · NO.** **code vs configuration vs what accumulates**:
  why the two layers usually rebuilt per deal are configuration here, and the
  archetype layer that makes that true.
- **`docs/component-architecture.html`** — **STALE · NO.** **the services**: fourteen foundation
  services everything depends on, thirteen capability services, eight in the
  control plane, a dependency matrix and two traced flows.
- **`docs/service-stacks.html`** — **SUPERSEDED · NO** (it read **STALE**). **the system grouped by function, not by
  plane**: eleven stacks over 35 services and 65 operations, the two stacks with
  no service behind them, the spine assessed as recordability rather than
  reachability, and the ranked gaps.
  🛑 **Superseded 18 Sep 2026 — successor `docs/tech-stack.md` §1 and §7**, whose
  service mapping is DERIVED from `compose.yaml` rather than grouped by function,
  which is why it can be checked and this one cannot. ⚠️ **`65 operations` is what the diagram
  draws, not what the tree holds** — the tree holds **154** operations across
  **142** paths (⚠️ *154 across 142 since 5 Oct 2026 — G4301 declared the control plane's four internal operations on four new paths; it was 150 across 138 until then.* ⚠️ *150 across 138 since 4 Oct 2026 — G3941 declared `listDocumentTypes`, one
  operation on one new path, `GET /document-types`; it was 149 across 137 until then.* ⚠️ *149 across 137 since 3 Oct 2026 — G3354 declared `getSessionPrincipal`, one
  operation on one new path; it was 148 across 136 until then.* 🛑 *148 across 136 is a third answer neither parent computed — G2931, integrate/2oct-d:
  #518 read 147 across 135 after G2831 declared the parked pile’s three operations, and #520 read 145
  across 133 after G2762 declared `relayBrokerReturn` (the owner’s G2549), each from 144 across 132;
  144 + 3 + 1 is 148 and 132 + 3 + 1 is 136, derived with `node tools/check-doc-counts.mjs --derive`.
  It read 144 across 132 before that, a third answer neither parent computed —
  G2743, integrate/1oct-c: one branch read 139 across 128 after G2541 declared
  `beginFederatedSignIn`, the other 143 across 131 after G2681 declared C9's five
  source operations, each from 138 across 127, on 1 Oct 2026; and it read 136 across 125 until 1 Oct 2026, when R13 declared
  `listRunAllocations` and G2401 declared `bindEndpointCredential` on two
  branches, EACH saying 137 across 126 — 138 is the merged tree's, G2532; and
  135 across 124 until G512 mounted
  `grantRoleAssignment` on the capability tier later on 19 Sep 2026, 76 across
  72 earlier that day, before the
  administration tier, and 72 across 69 until 23 Aug 2026, before the session
  tier*; derive with `node tools/check-doc-counts.mjs --derive`, and note that
  both totals are now ABOVE that tool's `[40, 120]` band, so a line stating
  either is skipped rather than checked), and the diagram
  has not been regenerated. The figure is left as the diagram's own, and qualified here,
  because editing it would make this row disagree with the file it describes.
- **`docs/access-matrix.html`** — **STALE · NO.** **the organisation axis**: the 3×5
  Organisation × StakeholderClass matrix with a verdict per cell, what enforces
  the boundary today (nothing — four controls with zero call sites), and the
  mandatory attributes of a permission document.
- **`docs/decision-defects.html`** — **STALE · NO.** **three decisions that cannot hold**, drawn
  rather than described: the identity provider that cannot distinguish a partner
  from a customer (**resolved since it was drawn**, by
  `docs/access-and-agency.md` §9 — the bare "§9" here pointed at no document for
  two reviews), notifications-as-reads deadlocking support access, and self-issue
  forbidden by the type it draws against. On the trunk; stale where it presents
  the first defect as open.
- **`docs/user-journeys.html`** — **STALE · NO.** **three journeys**: the customer's finance
  team, a forward deployment engineer, and support. It draws **five gaps as
  open**; `docs/HANDOFF.md` §2 records all five as closed and §7 names this file
  as the visual that has actually misled a reader. On the trunk, and read only
  with that correction in hand.

---

## The contracts

**Five files under `docs/contracts/`** — four written 5 Aug, two of those changed on
7 Aug without either gaining an operation, and a **fifth added 10 Aug**,
`data-plane-local.openapi.yaml`. **This section did not exist in this
index until 7 Aug**, while `docs/HANDOFF.md` §1 named the contracts as the fourth
thing to read.

> ⚠️ **THIS SECTION SAID *"Four files"*, *"the three tiers"*, *"65 operations
> across 62 paths"* AND *"All 62 paths"* UNTIL 10 Aug 2026, and the arithmetic
> `17 + 33 + 12 = 62` beside it read as checkable and true.** A **fourth OpenAPI
> tier** landed — `data-plane-local.openapi.yaml`, 3 paths / 3 operations,
> customer-facing liveness and telemetry served strictly inside the Data Plane
> VPC — and `control-plane.openapi.yaml` gained two X8 operations. Corrected
> rather than deleted. 🛑 **The new tier is NOT the administration tier**; the
> gap described below is unchanged and still the largest one. *One note per file;
> every swept count in this section has this same cause.*

> ⚠️ **The five YAML files carry NO banner of their own, deliberately.** A header
> inserted at the top of a `.yaml` shifts every line beneath it, and this record
> addresses those files by line in roughly sixty places — shifting them would
> produce the exact defect `tools/check-citations.mjs` exists to catch: a citation
> that still resolves, to the wrong line, and reads valid. **`docs/contracts/README.md`
> carries the status block for all five.**

| File | STATUS · V1 AUTHORITY | Tier | Paths | What it is |
|---|---|---|---:|---|
| `docs/contracts/README.md` | **LIVING CONTROL** · **PARTIAL** — the runtime wire; the status block for the five YAML files | — | — | **Read this first.** The four tiers, the two conventions that carry invariants, and **"The tier that is missing"** — the fourth file that does not exist and should. ⚠️ **Corrected 8 Aug 2026 under G113**: it asserted *"one deviation exists"* from the no-tenant-in-a-request-body rule and the contracts refute it — there are **two**. The false sentence is struck through in place, not deleted, and the removal it orders is a **breaking wire change that has not landed** |
| `foundation.openapi.yaml` | **LIVING CONTROL** · **PARTIAL** — the foundation-tier boundary | F1–F14 | 17 | the foundation services everything depends on |
| `administration.openapi.yaml` | **LIVING CONTROL** · **PARTIAL** — the two control-plane consoles, added 19 Sep 2026 (G288) | P1–P9 partner · S1–S6 staff | 52 | The partner portal (`deals` `sold` `comm` `cases` `sbx` `arr` `cards` `cat` `people`; **`arr` `cards` `people` are administrator-only**) and the staff console (`ten` `cat` `build` `bill` `ptnr` `sup` over three roles), derived from `docs/handoff-pack/` under G264. **ONE file with `x-plane` on every operation — G76** — and its reader is `tests/contracts/administration-wire.test.mjs`, because `tools/check-plane-tags.mjs` still does not exist. 🛑 **DECLARED AND UNMOUNTED under G200, and NOT REGISTERED IN `TIERS`** — so `loadTier()` cannot read it and `check:annotations` sees none of its 59 operations. 🛑 **NOT ONE OPERATION NAMES A CAPABILITY**, and that is derived rather than chosen: `decide()` denies every platform principal at `platform_org_holds_no_assignment` before reading one, and a partner holds no `PartnerAccessGrant` over its own record. `x-admin-authority` names what does govern each — and **two of its four evaluators do not exist in `model/`** |
| `capability.openapi.yaml` | **LIVING CONTROL** · **PARTIAL** — the only tier a customer's browser meets | C1–C13 | 35 | the capability services (⚠️ *this cell said 33 until 16 Aug 2026; `/runs/{runId}/account` and `/runs/{runId}/residue` landed under C5, the first paths anywhere carrying the reconciliation engine's vocabulary — and both are DECLARED AND NOT MOUNTED, because nothing persists a `SetReconciliationResult`*) |
| `control-plane.openapi.yaml` | ✅ **LIVING CONTROL** · **PARTIAL** — the cross-plane wire. ~~🛑 **STALE** — **except the policy-bundle shape**; G79 landed a policy arm in the model and not here; drifted in nine places, and `ManagedServiceUseConfig` is absent entirely.~~ **That drift CLOSED on 8 Aug 2026** and the label is corrected rather than removed — verify element-for-element rather than trusting this cell: `python3 -c "import yaml;print(yaml.safe_load(open('docs/contracts/control-plane.openapi.yaml'))['components']['schemas']['PolicyDefaults']['required'])"` returns all six live kinds including `managed_service_use`. ⚠️ **A different defect is now open on it: its prose at `:67` says *"One deviation exists"* from the no-tenant-in-a-request-body rule and there are TWO** — `PlaneUsageEvent.tenantRef` (`:1186`, argued at `:1188-1201`) and `InstallationReport.tenantRef` (`:1612`, argued nowhere). **G113 rules the second one off the wire; not applied** | X1–X8 | 14 | the control plane, which publishes downward and never reads tenant data (⚠️ *this cell said 12 until 10 Aug 2026; two X8 diagnostic operations landed*) |
| `data-plane-local.openapi.yaml` | **LIVING CONTROL** · **PARTIAL** — the Data Plane's local surface, added 10 Aug 2026 | local — no service number | 3 | liveness, deep status and metrics, served by the Data Plane **inside the customer's own account** for the customer's own load balancers and metric scrapers. Never exposed to the public internet; the control plane never calls it |
| `session.openapi.yaml` | **LIVING CONTROL** · **PARTIAL** — the way in, added 23 Aug 2026 (#230/#231) | A1–A4 | 4 | `resolveHomeRealm` · `completeFederatedSignIn` · `getSession` · `signOut`. The tier that finally ISSUES the `X-Session` the three above demand and none of them produces. **`security: []` at document level**, with a per-operation override on the two that carry a session — it cannot live in any of the others precisely because each declares a REQUIRED scheme at document level. **DECLARED AND UNMOUNTED** under G200, and it declares no capability on any operation: `decide()` needs a `tenantId` and pre-session there is none |
| `errors.yaml` | **LIVING CONTROL** · **YES** — the single error vocabulary for every tier | shared | — | one `ErrorCode` vocabulary — **88** codes (⚠️ *71 until 23 Aug 2026; the session tier mirrored sixteen model refusal arms by exact name. 87 until 19 Sep 2026; `capability_not_held` is the eighty-eighth, minted with G200's request-time gate rather than reusing `policy_denied`, which means something else*), one RFC 9457 `Problem`. Referenced, never copied, because two copies of it diverged by thirteen members within one afternoon |

**135 operations across 124 paths.** ⚠️ *Read "76 across 72" until 19 Sep 2026,
when `administration.openapi.yaml` landed under G288 — the SIXTH tier, 59
operations over 52 paths. Read "70 across 67", and the capability
cell above read 33, until 16 Aug 2026; `getRunAccount` and `listRunResidue`
landed on the capability tier. Read "72 across 69" until 23 Aug 2026, when the
session tier added four operations across three paths — `GET` and `DELETE` share
`/session`, which is why its two figures differ.* Reproduce the paths with
`for f in docs/contracts/*.openapi.yaml; do grep -cE '^  /' $f; done` → 52 + 35 +
14 + 3 + 17 + 3 = 124; the operation count is the extractor's. The codes with
`awk 'NR>68 && /^        - /' docs/contracts/errors.yaml | wc -l` → 87.
🛑 **NOTHING CHECKS EITHER FIGURE ANY MORE.** `tools/check-doc-counts.mjs` bands
`contract operations` and `contract paths` at `[40, 120]` and skips a claim
outside it, so both totals walked past the top of the band in the same commit.
Widening the band is owed.

> ✅ **THE ADMINISTRATION GAP IS HALF CLOSED — G288, 19 Sep 2026.** ⚠️ **This
> read *"All 72 paths are runtime and none is administration"* and is corrected
> rather than deleted.** 52 of the 124 are administration: the partner portal
> and the staff console, one file with `x-plane` tags under G76. **The half that
> is still open is the customer-plane one** — a tenant admin still has no path
> to a user, an invoice, a definition or a telemetry policy. `docs/contracts/README.md`
> carries the row-by-row verdict. *(69 until 23 Aug
> 2026.)*
> `administration.openapi.yaml` does not exist and should: authoring, commercial,
> tenancy admin, governance, telemetry configuration and evaluation have **no
> operation anywhere** — the FDE's entire engagement and everything a tenant admin
> touches. ~~**Zero of the thirty-seven capabilities appears in any contract
> file**~~ — ⚠️ **that sentence went half-false on 16 Aug 2026**: all 72
> operations now carry an `x-capability` annotation and 16 of the 39 capabilities
> are named by one. **No contract file publishes the capability ENUM**, which is
> the half that was actually the gap and is unchanged. `docs/HANDOFF.md` §8
> item 3.
>
> ⚠️ **BOTH SIDES OF THE 16 Aug MERGE SWEPT THIS SENTENCE AND NEITHER IS QUOTED
> HERE.** The `main` side read *"Zero of the thirty-eight capabilities appears in
> any contract file"* — the pre-annotation claim, with `view_endpoint` counted;
> this side read *"16 of the 38"* — the post-annotation claim, with `admit_source`
> counted and `view_endpoint` not yet merged. **Neither denominator survived the
> merge**, so the pair above is DERIVED from the merged tree rather than picked:
>
> ```bash
> grep -rhoE 'x-capability: *[a-z_]+' docs/contracts/*.yaml \
>   | sed 's/.*: *//' | sort -u | wc -l          # 16 named
> awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts \
>   | grep -cE '^  [a-zA-Z]+:'                   # 39 declared
> ```

> 🛑 **Four of the 8 Aug 2026 rulings govern this directory, and NOT ONE has
> touched a byte of YAML.** Read `docs/contracts/README.md` for each in full.
>
> | Ruling | What it does here | State |
> |---|---|---|
> | **G113** | `InstallationReport.tenantRef` comes off `control-plane.openapi.yaml` — schema and `required` — and the `:67` narrative is corrected from *"one deviation"* to one that is true | **not applied**; breaking wire change, with a precondition (confirm no batching case) |
> | **G112** | The money retype follows the **type**: `amountMinor` and everything reachable through `Money`. `valueAtRiskAtLeastMinor` becomes `type: string` with a numeric pattern (⚠️ **the `capability.openapi.yaml:550` citation is dropped rather than re-pointed — the declaration has moved and a line number is the class this record catalogues twenty times over; `grep -n 'valueAtRiskAtLeastMinor' docs/contracts/capability.openapi.yaml`**) | ✅ **applied 19 Sep 2026, G286** — and the SURVIVORS are named on the row in `docs/HANDOFF.md`, because a sweep whose leftovers are unnamed reads as total |
> | **G111** | One money codec module; every contract boundary calls it and nothing else touches the representation | **not applied** |
> | **G110** | The two pack-publication validators get **both** call sites — CI, and a publication seam that refuses. The seam is partly blocked on the file that does not exist | **not applied**; CI lands first |
>
> ⚠️ **`administration.openapi.yaml` therefore now blocks two things, not one** —
> the missing tier, and the publication seam that would give **invariant 6** its
> second enforcement. `CLAUDE.md` records that it has one running instead of two.

---

## `docs/build/` — the build passes

⚠️ **This section did not exist until 8 August 2026**, while `docs/build/` held
the largest and newest body of thinking in the repository. A whole directory was
absent from the file that claims to inventory the trunk. It was found by
`docs/build/red-service-topology.md`, not by a tool: `tools/check-doc-counts.mjs`
reads numbers, and **an omission has no number in it.**

**Every file here is WORKING MATERIAL with V1 AUTHORITY: NO.** They are green-team
proposals, red-team adversarial passes, **two** adjudications (`phase-one-plan.md`
and `ingestion-pipeline.md`) and one design record — inputs to decisions,
never decisions. **Nothing in this directory is applied to `model/` or to
`docs/contracts/`.** Where one contradicts `docs/HANDOFF.md` §3, §3 wins.
⚠️ **One row is the exception and it says so on itself** —
`reconciliation-engine.md` has V1 AUTHORITY **YES for `model/reconciliation.ts`**,
because that file is written and compiles.

> 🛑 **The `secret` reversal cuts through this directory.** G75, 8 Aug 2026, put
> `secret` into `PERMITTED_RESOURCES.delivery` and took it out of
> `NON_DELEGABLE_RESOURCES` — **the broad shape, chosen against the written
> recommendation.** Several files here still assert the opposite, and one
> prescribes the rejected edit as a diff. Check any `secret` claim against
> `model/governance.ts` before acting on it.

> ⚠️ **The 8 August rulings cut through this directory too, and they close gates
> rather than open them.** **G96–G102** settle the build substrate every file
> here reasons about and none of them decides: `@types/node` and `pg` as
> pinned-exact dependencies (G96, G98); **Drizzle** as the ORM, which
> `docs/build-conventions.md` listed **undecided** until this morning (G99);
> every branded id as `text` with the slug stored verbatim and no `uuid`
> anywhere (G97); RLS denying on NULL with a separate `BYPASSRLS` role for
> migrations, never the table owner (G100); transaction-mode semantics assumed
> from day one (G101); and `palette: null` as **required-and-nullable** on
> `SolutionPack` (G102). **G103–G107** rule on a reconciliation deployment
> architecture and the engine behind it: no Redis, no model id in engine code,
> bounded subset sum before the FIFO waterfall, a JSONB path on `FieldSpec`, and
> the whole pipeline in the **data** plane. **G108–G110** settle the single gate,
> a real YAML parser for `tools/`, and both call sites for the pack validators.
> **`docs/HANDOFF.md` §3 is the authority. Every one of them is a ruling and not
> a change** — and `docs/build-conventions.md` is being renumbered by a
> concurrent pass, so cite it by row heading rather than by line today.

> 🛑 **ELEVEN FILES LANDED HERE ON 9 AUGUST 2026 EVENING AND NOT ONE WAS IN THIS
> INDEX UNTIL THIS PASS.** Same defect class as the directory's own absence, one
> level down: `tools/check-doc-counts.mjs` reads numbers, and **an omission has no
> number in it**, so nothing but a person catches it. **The eleven are NOT
> symmetrical and must not be read as if they were:**
>
> - **Pass two of the ingestion review — four green designs, THREE red attacks.**
>   `residue`, `correction` and `integrity` were each attacked, and each attack
>   returned blockers. 🛑 **`ingestion-p2-green-mapper-seam.md` WAS NEVER
>   ATTACKED** — there is no `ingestion-p2-red-mapper-seam.md`, its red team died
>   on a session limit, and it is the **largest file in this directory**. **Do not
>   read the missing report as a clean bill.** Its three attacked siblings drew
>   thirteen blockers between them; the presumption for an unattacked design of
>   the same size is that it has them too and nobody looked.
> - **The stateless pass — four green designs, NO red pass and NO adjudication.**
>   All four reds *and* the adjudicator died on the same session limit. **Every
>   one of the four is an unreviewed proposal against an owner ruling
>   (9 Aug 2026: no process-local state another node or a retry cannot
>   reconstruct from durable storage), and no G number has been taken on any of
>   it.**
>
> 🛑 **AND THE ELEVEN COLLIDE WITH EACH OTHER, WITH NOBODY ADJUDICATING THE
> COLLISIONS.** Four separate designs each claim migration **`0002`** — the
> arrival table (`ingestion-p2-green-residue.md`), `0002_session.sql`,
> `0002_run_execution_and_reader_work.sql` and `0002_held_work.sql`; only
> `db/migrations/0001_tenancy_and_rls.sql` exists. **Two designs each mint
> `model/ingestion.ts` as the nineteenth module and each declares a DIFFERENT
> `IngestBound`** — a `Record<IngestBoundKey, number>` over eight snake_case keys
> in the residue design, an `interface` of camelCase fields in the mapper seam.
> That is `docs/HANDOFF.md` §5.3 — two vocabularies for one concept — live inside
> one proposed module, and `ingestion-p2-red-residue.md`'s S9 attacks the `Record`
> form independently. A third pair collides on `Session`: see the state-audit row.

| Document | What it is | Read it knowing |
|---|---|---|
| `phase-one-plan.md` | **The adjudication, and since G92 the ratified plan of record.** Rules between the five reports below and produces one ordered plan | ✅ **Gates D3 AND D4 are both CLOSED** and the plan is re-cut accordingly. D4's four items were decided by **G75** (against the recommendation), **G78**, **G80b** and **G85**; D3 — the pooler, its mode and the RLS null polarity — by **G101** (assume transaction-mode semantics from day one, in-process `pg.Pool`, no external pooler and no AWS resource in phase one) and **G100** (the policy **denies** on NULL; migrations run as a named `BYPASSRLS` role, never as the table owner). ⚠️ **Being the adjudication, its staleness propagates furthest** — sixteen phase-two issues reached D4 transitively through one stale edge — so the re-cut obligation is STANDING. Re-derive any gate from `docs/HANDOFF.md` §3, never from its table |
| `green-platform-slices.md` | Green team — platform and tenancy slices | 🛑 **The most misleading file here.** Its P5 rests on the reversed premise and prescribes the `CONTRACT_ONLY_RESOURCES` diff the owner rejected. **Do not apply it.** Its verification greps would now fail against a correct tree |
| `green-reconciliation-slices.md` | Green team — the reconciliation spine | ⚠️ Two dependency gates are closed: `managed_service_use` **exists** (G79), and the `secret` shape is settled |
| `green-agent-bi-slices.md` | Green team — agent, chatbot, reporting | ⚠️ Predates G79, G82, G83 and G84, each of which changes what these slices build |
| `red-decisions.md` | Red team — the decision set, G49–G71 | ⚠️ Its scope **ends at G71**. RD-5 quotes a `model/governance.ts` comment G75 deleted — **but its core warning went unheeded**, and a false restatement survives in `model/domain.ts` |
| `red-buildability.md` | Red team — can phase one be built? | ⚠️ Finding **B-f is closed** by G75. Its sibling RD-6 got **stronger** under a standing reach and was never re-scored. ✅ **Its B5 sequence is now answered rather than open.** `:347` names the autocommit footgun — *"`SET LOCAL` outside a transaction block applies to the current statement only and is silently discarded. Every ORM/driver that autocommits (`pg` by default, Drizzle and Prisma outside `$transaction`) produces exactly this"* — and `:349-351` says whether NULL denies or permits *"depends on how the policy was written, which nobody has written."* **G99 takes Drizzle knowing this; G100 writes the policy to DENY on NULL, which is what makes a forgotten transaction loud instead of a silent cross-tenant read; G101 answers `:353`'s transaction-pooling case by assuming it from day one.** All three are rulings, not code |
| `green-indicator-model.md` | Green team — the indicator model behind the built design surface | Its shapes were adjudicated in **G74, which is not applied**. None of its four creates exists in `model/` |
| `red-indicator-model.md` | Red team — the same surface, adversarially | Ruled two of five surface claims **unbuildable as designed**. ⚠️ It had **no status banner at all** until 8 Aug, and one of its blocking gates is already met |
| `green-service-topology.md` | Green team — service count, size, call graph | ⚠️ **The tree moved underneath it and it says so.** Re-run every command in its §0. Builds on two visuals that are banner-marked STALE |
| `red-service-topology.md` | Red team — the same question, adversarially | ⚠️ Same concurrent-edit caveat. **Gives bounds rather than a number, deliberately.** It is the source of the finding that fixed this section |
| `event-architecture-recommendation.md` | Recommendation — the cross-cutting event streams | ✅ Unaffected by G75; treats G79 correctly. ⚠️ G87 and G89 landed after it. 🛑 **ITS VERDICT HAS BEEN NARROWED, ON 9 Aug 2026, AND THIS ROW SAID THE QUESTION WAS STILL WITH THE OWNER.** The verdict is *"outbox, for every stream. No broker in the data plane, in either topology"*, with one signed-off carve-out for control-plane-internal fan-out. `ingestion-pipeline.md`'s **O-1 — ruled by the product owner** — narrows it **for the INGESTION PATH ONLY**: a **Postgres work queue** using `FOR UPDATE SKIP LOCKED`, with **EventBridge surviving only for the S3 arrival trigger**, which carries no tenant row. The decisive ground is this document's own — the shred and the enqueue must share one transaction and SQS cannot. 🛑 **O-1 IS A RULING WITH NO G NUMBER YET and it is not applied.** **The general question stays open and stays nobody's**, and this document's *"somebody must reconcile the two; this document does not"* still stands for every stream except ingestion |
| `reconciliation-engine.md` | **The design record for `model/reconciliation.ts`** — what was decided, what was rejected, and the model diff-plan | ⚠️ **THIS ROW DID NOT EXIST UNTIL 9 Aug 2026.** The file landed on 8 August and was never mapped — this section's own recurring defect one level down, a file missing from the map rather than a directory. 🛑 **It is the one file here with a SPLIT authority, and it says so on itself: NO for `model/`, where every change in its diff-plan is a proposal nobody has applied — YES for `model/reconciliation.ts`, which is written, compiles, and whose rulings are argued nowhere else.** ⚠️ Its own opening section records that `tools/planner/extract.mjs` is **blind** to a module of functions and value objects, so the extractor's silence about it is evidence of nothing — a worked instance of `CLAUDE.md`'s warning. 🛑 **Its DP-2 has already diverged from the tree**: `docs/HANDOFF.md` G117 records the module naming **two** missing `PopulationSpec` fields against DP-2's **three**, one day apart, and `ingestion-p2-green-integrity.md` additionally finds DP-2's insertion point stale — the drift class `tools/check-citations.mjs` cannot catch, because the citation resolves |
| `ingestion-pipeline.md` | **The adjudication of the multi-tiered ingestion proposal**, 9 Aug 2026 — the product owner's cascade, four independent green/red reports, and one ordered design. Its opening section reproduces the four claims that carry it; the next draws the whole cascade on one page — arrival, a mandatory isolated sanitise before any tier, then the **absorbing one-way ladder** (structured · tabular · digital_text · scanned) | 🛑 **NOT ONE LINE OF IT IS APPLIED, and no G number has been taken on any of it.** The four tiers are already declared as `ACQUISITION_FIDELITY` (`model/domain.ts:1782`) and never implemented, so the ruling is *whether this is the right implementation of a cascade the record already declared*. **Two of five steps were refused as drawn** (the per-row queue and the per-file LLM mapping), and **one economic claim is refused outright — the 70–90% Textract reduction must not be quoted anywhere.** ✅ **CORRECTED 9 Aug 2026 evening — this row said *"eight owner rulings (O-1…O-8) are open"* and that has gone false. ALL EIGHT ARE TAKEN**, the owner adopting the recommendation in every case; the original question / recommendation / **cost** table is preserved beneath them unedited, because a ruling recorded without the cost it bought cannot be revisited honestly. **Three technical refinements — T-1, T-2, T-3 — were added with them**, T-2 being what makes O-4 affordable rather than merely safe. 🛑 **A ruling taken is still not a change made:** all eight need G numbers before anything is built, and O-6's standing `@napi-rs/canvas` verification is **not done**. ⚠️ Its citations were re-derived at `f988f2a4` because eight of the adjudication's own had drifted within six hours — and the file **is being extended by a concurrent pass, so cite it by heading rather than by section number** |
| `ingestion-p2-green-residue.md` | **Pass two, green** — the ingestion residue as a first-class object. Answers the adjudication's *"there is no type for an artefact that arrived, was stored, was billed, and never became a `SourceDocument`"* | **Its three declarations:** `IngestArrival` in a new `model/ingestion.ts`; a closed **fourteen-arm** `ArrivalRefusal` proven text-free by `AssertNoTextDeep`, so a parser's message cannot reach a log, an audit row or a screen; and four **total records** that DERIVE triage class, retention window, meter eligibility and reprocessability instead of storing them. ✅ **Attacked — see the row below, which returned five blockers.** ⚠️ **It reports three things at the tree that contradict `CLAUDE.md` and this index, and two of them are true**: `db/` exists (`db/migrations/0001_tenancy_and_rls.sql`, `db/tenant-scope.ts`, `tests/db/tenant-isolation.test.ts`), so *"there is no database, no schema, no migration"* is false — while **`pg` is genuinely absent from `package.json`**, which makes the leak test's evidence machine-local and not reproducible from the manifest. **Nothing in the design is applied** |
| `ingestion-p2-red-residue.md` | **Pass two, red** — the residue design, adversarially | **5 BLOCKER · 10 SERIOUS · 5 NOTED.** Sharpest: **B1 — the design's own headline fail-closed state has no arm to record it.** With O-8 unstated `IngestBound` cannot be constructed, so the design says every arrival refuses — and the nearest `ArrivalRefusal` arm *requires a `limit`* whose absence is the whole premise of the state, leaving fabricate, throw, or write no row: all three forbidden, and the third is the vanishing-artefact defect the object exists to close. Its verdict: **the object is right and the ledger argument unbreakable; it is not yet buildable**, because three load-bearing controls were written at the type layer and do not live there. ⚠️ **B5 attacks the EXISTING TREE, not the proposal** — `PolicySubject` is a different union in the model and on the wire with no `check:wire` pair, so the adjudication's C2 could be recorded applied while inert |
| `ingestion-p2-green-correction.md` | **Pass two, green** — the correction / re-parse path. Answers the adjudication's *"nobody designed correction"* | **Its three declarations:** correction is **not a new subsystem** — it is `LearningRetraction` + `ErasurePlan` + `ExceptionReversal` + `RunTrigger.rerun` composed in that order, all four already declared with their arguments already written; a **capture ledger**, so a re-parse never overwrites the extraction a recorded finding was made against; and a replay key that is **not** `requestOrdinal`. ✅ **Attacked — five blockers.** 🛑 **It reports a defect in G120 AS RULED**: the stated persistence key mis-attributes a stored verdict to the wrong item after any change to the residue, which correction guarantees. Its strongest argument, which the red team verified and could not break, is that an in-place recapture silently changes what every recorded finding MEANS while leaving every hash chain valid and every anchor matching |
| `ingestion-p2-red-correction.md` | **Pass two, red** — the correction design, adversarially | **5 BLOCKER · 8 SERIOUS · 7 NOTED.** Sharpest: **B1 — `DocumentCapture` is a new store of extracted personal data with no `RetentionClass`, no purge fields and no `SubjectLocation` variant**, so purging the source document stops purging the extraction — in a design that quotes `ErasurePlan`'s *"a plan that admits what it cannot reach … is worth more than one that silently misses it and reports success"* eight times and then builds a store the plan can neither reach nor disclose that it cannot. **B4:** the stated blast-radius control does not exist in `tools/` and cannot be added the way the checker's own registry says pairs are added. **B5:** every structural precedent the design copies is `@dropped-for-v1` and the report never says so. ✅ It lists seven of green's claims it tried to break and could not |
| `ingestion-p2-green-integrity.md` | **Pass two, green** — the three integrity changes inside `model/reconciliation.ts` (declared currency · the named duplicate · control-total admission · the admission floor). **This document is the plan `CLAUDE.md` requires before that file is touched** | **Its three declarations:** `MoneyUnit` — currency and exponent without an amount — so admission stops **inferring** a unit; the duplicate row that is silently overwritten today becomes a **named outcome at both sites**; and one new checker feeding one new refusal arm, with `unique_within` **ruled UNBUILT under a dated drop note** rather than half-built. ✅ **Attacked — three blockers.** ⚠️ **It corrects a false premise in its own brief and the design changes because of it:** `Money.amountMinor` is **`number`** at the tree, not `bigint`, and G65, G78, G111 and G112 are all unapplied — so nothing here may assume the money codec exists |
| `ingestion-p2-red-integrity.md` | **Pass two, red** — the three integrity changes, adversarially | **3 BLOCKER · 7 SERIOUS · 6 NOTED**, and it opens by **striking one of its own attacks** for resting on a false premise — which is why its remaining findings are design defects rather than citation defects. Sharpest: **BLOCKER 1 — the admission floor's ceiling is a caller-supplied OFF-SWITCH.** At the legal maximum the test reduces to `admitted < 0` and can never fire, the required-bound gate certifies that value as *stated*, and **the plan prints "re-run with the ceiling at 10000" as the operator's remediation procedure** — §5.2 in its exact form, with G79 as the standing precedent. **BLOCKER 3:** control-total admission hands a counterparty a one-cell kill switch on the whole close, and deletes the residue this module calls the product. ⚠️ **SERIOUS 8 is about the record, not the design** — the plan writes ~20 same-file citations that its own insertions invalidate, in the one file class `tools/check-citations.mjs` does not scan. It ends with an ordered *what must change before this is built* |
| `ingestion-p2-green-mapper-seam.md` | **Pass two, green** — the mapper seam, and the containment proof on the **request** path | 🛑 **THE ONE PASS-TWO DESIGN THAT WAS NEVER ATTACKED. There is no `ingestion-p2-red-mapper-seam.md`** — its red team died on a session limit — **and the absence is not a clean bill.** It is the largest file in this directory and its three attacked siblings drew thirteen blockers between them. **Its three declarations:** a mapping proposal reads **KEYS and SHAPE, never a VALUE**; one request carries **exactly one** untrusted column header with **no plural arm**, so the type enforces what the fan-out enforces at runtime; and what crosses back is an **index into a vocabulary we supplied**, bounds-checked into a *refusal* rather than a lookup. ⚠️ **NOTHING IN IT COMPILES and it says so at the top** — no file was written and `tsc` was never run, so every expected error code is evidence about the mechanism and not about its code. Its own closing section lists ten unsolved items: `ObservedSchema` has **no producer**, no decoder exists behind the codec vocabulary, the header-set hash's definition is unruled, and **the pack seam is the ceiling on every proof in it** — a poisoned `DocumentType.fields` satisfies the whole design while pointing at the wrong fields |
| `stateless-green-session.md` | **The stateless pass, green** — **D1**: session establishment and the durable session record, under the owner's 9 Aug 2026 stateless ruling | 🛑 **NO RED PASS AND NO ADJUDICATION** — see the note above this table; this is an unreviewed proposal. **Its three declarations:** the session header is the same shape as an `AuthorizationGrantId` — **it addresses a row and asserts nothing**, so every node resolves it identically and none needs memory of the last request; `orgClass` is **re-derived per request** and never stored on the session record; and mid-flight authentication state becomes a durable record rather than a process-local challenge map. Its strongest move is to read `model/access.ts`'s *"a reference, not a bearer token"* refusal of the JWT shape as the stateless ruling one layer down — **so the performance cost was already accepted in writing and the ruling inherits rather than adds it.** ⚠️ Read its *what must NOT be on the session record* section before adopting any of it, and its cost section: one uncacheable durable read before any work on every request, and `lastUsedAt` turning every read request into a write |
| `stateless-green-resumable-work.md` | **The stateless pass, green** — long-running work made resumable: runs, the reader seam, ingestion, the fan-out | 🛑 **NO RED PASS AND NO ADJUDICATION.** **Its three declarations:** the durable artefact is the **PINNED INPUT plus the STORED VERDICTS — never the folded state**; a new `model/execution.ts` carrying the pinned plan and the run execution, because nothing existing carries them; and a claim / lease / settle work queue **in Postgres**, which is the **second** instance of the `FOR UPDATE SKIP LOCKED` shape the record already chose for the `UsageRecord` outbox rather than new machinery. It leans on two properties already banked: the engine is a pure total fold, so re-running it over the same input is a correct resume with no serialisation at all; and `fully_allocated` is absorbing, so replay is idempotent **by monotonicity** rather than by a flag someone can forget. ⚠️ Its baseline includes `npm test` fully passing **with a reachable local Postgres** — machine-local evidence, since `pg` is not in `package.json` |
| `stateless-green-state-audit.md` | **The stateless pass, green** — where process-local state hides, in the tree and in what has been ruled but not built, plus the checker that keeps it out | 🛑 **NO RED PASS AND NO ADJUDICATION.** **Its three declarations:** **`model/` is already clean, and that is the finding** — no mutable module-level binding, no clock read, no random source, across eighteen modules; **exactly two** mutable module-level bindings exist in the whole repository and neither is in a request path (the memoised dynamic `pg` import, permitted; a dev graph server's write serialiser, out of scope); and a new `tools/check-stateless.mjs` whose allow-list marker reuses `@dropped-for-v1`'s discipline. ⚠️ **The checker's own honest report is that it proves almost nothing today, because the request path it exists to police does not exist** — it carries a field to say exactly that. 🛑 **It also re-declares `Session`, `SessionId` and the resolver after telling the reader to ADOPT `stateless-green-session.md`'s and not re-mint them** — two spellings of one noun across two unreviewed documents, §5.3's shape. It names the ruling's one irreversible cost: the hash chain becomes a per-tenant serialisation point |
| `ui-audit/red-visual-tokens.md` | **Red UI audit, 3 Oct 2026 (#541)** — the built tenant shell against the pack, on tokens, type, colour and light, with its own screenshots under `ui-audit/screens/` | Docs only; **a finding here is a report, not a ruling and not a repair.** It audits the tree as of its own branch, so it predates the staff console and partner portal merged beside it in `integrate/3oct-f` (G3375) |
| `ui-audit/red-copy-components.md` | **Red UI audit, 3 Oct 2026 (#540)** — copy and component behaviour across the tenant shell's states and widths | Docs only; same caveat as the row above — it never saw S1 or P1 |
| `ui-audit/red-motion-mark.md` | **Red UI audit, 3 Oct 2026 (#539)** — motion and the mark, against the pack's motion inventory, with recorded frames and a probe dump under `ui-audit/screens/red-motion-mark/` | Docs only; same caveat. ⚠️ `probe.json` is a ~53k-line raw capture, evidence rather than a reading |
| `ui-audit/reaudit-visual-tokens.md` | **Re-audit, 3 Oct 2026 (#550)** — colour, tokens, type, theme and responsive, measured at `5dae45af` after #545–#547 | Docs only, a report. Its *Top 5 still open* (N-01, N-02, RV-17, RV-14, RV-08/RV-16) were answered by #552 and #553. N-02 and NC-08/RV-16 were answered by **owner rulings** (G3478, G3473). N-06 (`--lh-solid`) is still put to the owner |
| `ui-audit/reaudit-copy-components.md` | **Re-audit, 3 Oct 2026 (#549)** — microcopy, the 14 primitives, layout and states | Docs only. Its top five were answered by #551 (NC-01 → `resolution_not_configured`, G3441; RC-10, NC-02/NC-03, RC-02) and #552 (RC-18/RC-19). ⚠️ The register is **still scoped to the definition, not the run** (G954) |
| `ui-audit/reaudit-motion-mark.md` | **Re-audit, 3 Oct 2026 (#548)** — motion, the luminous touch, the mark: *11 of 17 CLOSED, 1 PARTIAL, 2 OPEN, 3 Info; 9 new* | Docs only. RMR-01..RMR-08 answered by #552 (G3471–G3480). RMR-01 and RMR-04 are **owner rulings**. ⚠️ The dark-theme lit hot spot (2.70:1) is new and put to the owner |
| `ui-audit/red-partner-staff-apex.md` | **Red audit, 3 Oct 2026 (#554, merged via #558)** — the P1 partner portal, the S1 staff console and the apex site, which the three earlier red rounds never saw | Docs only. RP-* answered by #560 (G3561–G3570, deal currency **the owner's**). RS-*/RA-* answered by #559 (G3581–G3592, per-host E1 and apex light-only **the owner's**). Of its six *Owner rulings needed*, four were answered by the owner (G3581, G3588 under NC-08/RV-16's ruling, G3561, G3582). RA-03 and RA-04 were taken as **derived**, on the default *"pack wins"* (G3592, G3591), and the owner may still reverse either. ⚠️ **It has no re-audit yet**, and its *Not covered* list (the sandbox `live` state, hand-back/reset/trial, keyboard order) is the next round's scope. The wave is summarised at `docs/HANDOFF.md` §0a, 3 Oct 2026, and in `completion-plan.md` §5 W6 |
| `stateless-green-user-artifacts.md` | **The stateless pass, green** — drafts, in-progress work, and everything a person would lose on a node death | 🛑 **NO RED PASS AND NO ADJUDICATION.** **Its three declarations:** the ruling **binds the SERVER, not the browser** — asserted before anything else, and it is the line that takes the count of durable artifacts from eleven to four; a new `model/held-work.ts` with one new brand, so a held draft is **not constructible** where a `ProposalId` is required and therefore can never become a money effect — the whole ruling for one brand; and a fourteenth `RetentionClass` plus a twelfth `SubjectLocation` variant, so held work is reachable by an erasure plan instead of being the store the plan cannot name. ⚠️ It records two costs plainly: **the ruling turns typing into billable volume**, and **D1 blocks all of it** |

---

## Design records

| Document | STATUS · V1 AUTHORITY | Subject |
|---|---|---|
| `docs/data-governance.md` | **DATED SNAPSHOT** · **PARTIAL** — the PDPA control mapping and the classification/retention posture. 🛑 **§3 residency is out of date and carries a correction ordered on 4 Aug and never made**; G82 makes the same sentence worse | PDPA, classification, retention, residency, partner sub-processor line |
| `docs/policy-and-billing.md` | **DATED SNAPSHOT** · **PARTIAL** — the metering/rating/billing separation stands. ⚠️ **Its policy-kind table is short** — G79 added one and two are dropped; derive rather than read | Policy engine, autonomy, metering/rating/billing separation |
| `docs/tenancy-topology.md` | **PARTIALLY APPLIED** · **PARTIAL** — its demo-placement conclusion stands. ⚠️ **Three "specified, deferred" items are done, deleted or renamed** and the file still reads as an instruction | Demo site placement, `Account`, M365 identity, agent catalogue |
| `docs/platform-adoption.md` | **DATED SNAPSHOT** · **PARTIAL** — "standalone platform" is unreversed. ⚠️ Its identity section predates federation; read `access-and-agency.md` §8–§10 first | What ReconcileAI takes from AiVolvex, and what it declines |
| `docs/framework-practices.md` | **WORKING MATERIAL** · **NO** — practices to learn from. Its own open questions were answered elsewhere (G71, the licence pass) and it does not say so | Practices worth adopting from Mastra, independent of using it |
| `docs/aivolvex-concept-assessment.md` | **WORKING MATERIAL** · **NO** — an assessment of somebody else’s draft; the input to `platform-adoption.md` | Assessment of the 2026 Blueprint architecture draft |
| `docs/persistence-design.md` | **SUPERSEDED** · **NO** — successor `docs/data-architecture.md`. Several §10 questions are answered and still posed as open. ⚠️ **Two parts of it outrank that label and this cell did not say so until 12 Aug 2026.** Its **§0 is exempted by its own SUPERSEDED banner and was reconfirmed 8 Aug 2026** — a second database means *"re-implementing all four [invariants] in a second place, with a second set of failure modes and no transactional relationship between them"* — and **G185 rests on it** to refuse two instances split by plane, the same reasoning G103 used to refuse Redis. **G185 also promotes two of its lines from recommendation to ruling:** `:345`'s *"regional instance"* and `:331`'s tenant-data-never-crosses-a-region become the region axis, and `:328`'s one-writer-plus-read-replica becomes the control-plane shape. **Superseded is not the same as wrong here** | Where every entity lives — relational, JSONB, blob, telemetry. **Reasoning; the answer is in `data-architecture.md`.** |
| `docs/byoa-topology.md` | **SUPERSEDED** · **NO** — successor `docs/data-architecture.md`, and **G36 puts BYOA in v1+1** entirely | Customer-owned data plane: what it solves, what it costs. **Reasoning; §3's three modes are corrected to two in `data-architecture.md` §3.** |
| `docs/data-architecture.md` | **DATED SNAPSHOT** · **PARTIAL** — the shape, not where v1 runs. BYOA-in-v1 reversed by G36; residency amended by G82 (⚖️ blocked on counsel); 🛑 **decision F amended by G185, 12 Aug 2026** — the database splits **by residency region, not by plane**: the schema-and-role grant survives, *"one cluster"* becomes one per region, `control_ro` is retired for a signed HTTPS pull, and the `tenant` row is control-owned with a narrow data-plane projection. **Not applied.** See the fuller note on this file under *Read these first* | **The decision.** Four axes, the shape, and what closes. |
| `docs/access-and-agency.md` | **PARTIALLY APPLIED** · **PARTIAL** — the authority for the access model’s *shape*. §11 applied; the `OrgClass` axis and federation are not. ⚠️ Invariant 8 amended twice since (G60, G75) | **The access record, and the longest document in the set (§1–§12).** Hierarchies collapse to two mechanisms; agents hold no roles; §7 is an industry study sourced against primary documents; **§8 the organisation axis and the permission document, §9 federation, §10 the stress-test decisions, §11 the resource axis — the fourth leg — the authorisation spine, and `Solution` as a scope that may never be granted; **§12 the services regrouped by function** — eleven stacks, the two with no service behind them, and the spine assessed as *recordability rather than reachability*.** Two supersessions are marked in place: §2 by §8.6 (*deny is not representable* is true of the capability read path and false of the system), and §8.7 / §10.6 by §11 (**thirteen** resource classes, **thirty-seven** capabilities — thirty-four until 7 Aug 2026, when `view_metering` and `view_commercial` were minted for two classes that were reachable and empty, and **thirty-six on this line until 9 Aug 2026**, when it was re-derived at **37** by `awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'` — **six** scope dimensions). ⚠️ **Read §11 before touching `model/access.ts` or `model/governance.ts`.** |
| `docs/prompt-injection-posture.md` | **LIVING CONTROL** · **PARTIAL** — the injection posture and its control set. ⚠️ **Not actually maintained as one** — R6 is closed by G47 and still reads open. Needs an owner’s ruling | **Security posture.** Why there is no fix, what the field converged on, our controls mapped to it, the trifecta gap and the rule that closes it, and why clean data helps the document path and not the correspondence one. |
| `docs/day-2-operations.md` | **DATED SNAPSHOT** · **NO** — **its stated premise is out of v1.** It follows from a customer-owned data plane, which G36 moved to v1+1 | **Running it.** Observability, troubleshooting, releases, metering integrity, inference economics, heartbeat, and where the harness lives. Fifteen further model deltas. |
| `docs/design-tokens.md` | **SUPERSEDED** · **NO** — successor `DESIGN.md` (G72); G34 settled typography. 🛑 Its most confident claim — red/amber/green — is the one G72 removed | The measured colour, type and spacing vocabulary of the application being replaced, extracted from `DESIGN.md` before it left the trunk. **Reusable, and binding on nothing** — `PRODUCT.md` records that no palette or typography constraint has been established. |
| `docs/identity-classification.md` | **DATED SNAPSHOT** · **NO** — self-declared, and drifted: the extractor now reads more value objects than it classifies | **The input to the G21 identity sweep.** All 55 interfaces that carry branded references with no `id` of their own, classified under G35 into **15 entities and 40 value objects**, with the four-step test written out so the sweep is executable rather than re-derived. **A dated snapshot against `156ababf`, not maintained** — the extractor's live value-object count is higher; see the note under Open items. |
| `docs/salvage-ledger.md` | **DATED SNAPSHOT** · **NO** — its verdicts stand; its subject is deleted. 🛑 One live item: the fabricated customer names in the public website repo | **What is salvageable from the replaced application**, adjudicating the green- and red-team reports (both now at `archive/design-record:docs/`). Read before porting any pattern out of `archive/sap-line:src/`. |

---

## Research

| Document | STATUS · V1 AUTHORITY | Subject | Caveat |
|---|---|---|---|
| `docs/integration-options.md` | **DATED SNAPSHOT** · **NO** — a licence assessment, not a stack decision | ERP, orchestration, connections, observability — with licence verdicts for a **partner-resold SaaS**. ⚠️ **Gained a dated addendum on 8 Aug 2026** for G104 (the model catalogue is seeded with `claude-haiku-4-5-20251001`, and no model id lives in engine code) and G109 (`tools/` takes a real YAML parser). **No new licence verdict was written**: nothing was read against a primary source, so every new dependency's licence position is recorded **UNVERIFIED** and none was added to the Tier 1 table | Licences change. Re-verify before committing. **Nothing dated 8 Aug in it is a licence verification.** |
| `docs/notifications-channels.md` | **DATED SNAPSHOT** · **NO** — vendor research, unverified since 4 Aug | Teams and Slack | Teams connectors are dead; app-only channel posting is impossible |
| `docs/infrastructure-risk-register.md` | **LIVING CONTROL** · **NO** — it governs the inherited AWS account, not v1 scope | Live AWS account `000000000000` — **six** findings, K1–K6 (⚠️ *this cell said five and K1–K5 until 16 Aug 2026*) | Observed 4 Aug 2026; a transplant, not a re-audit — **except K6**, filed 16 Aug 2026 from live read-only IAM calls: a role named `ReconcileaiNoSapCdkStack-…EC2Role…` carrying `AdministratorAccess`, attached to no instance profile. **It is the only row in the file verified against AWS since 4 August.** Replaces the inventory and audit sections of `archive/design-record:docs/architecture-deployment.md` and `archive/design-record:docs/compliance-checklist.md` |
| `archive/design-record:docs/api-reference.md` | **DATED SNAPSHOT** · **NO** — it documents the deleted application | ~184 `event_type` operations | Reverse-engineered from the client. **Off the trunk** — `git show archive/design-record:docs/api-reference.md` |

---

## What left the trunk on 6 August 2026

The old application and every document written about it were deleted from the
trunk in one cut. **Nothing was lost.** They are readable in full at three
annotated tags, all pushed and verified on `origin` — `archive/sap-line` for the
SAP-line application (`src/`, `public/`, the root build configuration),
`archive/design-record` for the design record and every deleted document, and
`archive/trunk-pre-rebuild` for the trunk exactly as it stood before the cut. The
documents that went are the old product's requirements and design inventory
(`brd-summary` · `srs-summary` · `tech-stack` · `compliance-checklist` ·
`wireframe-decisions` · `wireframe-decisions-admin` · `brand-style-guide` ·
`design-brief` · `implementation-guide` · `api-reference` ·
`architecture-deployment` · `DESIGN.md`), the six adversarial swarm reviews under
`docs/swarm/` (~9,500 lines, carrying the evidence and the file:line citations
behind `docs/model-change-ledger.md`), and the two salvage team reports
(`salvage-green-team.md` · `salvage-red-team.md`) that `docs/salvage-ledger.md`
adjudicates. Read any of them with
`git show archive/design-record:docs/<name>.md`. Two facts were carried onto the
trunk rather than archived, because they are live rather than historical: the AWS
findings, in `docs/infrastructure-risk-register.md`, and the measured visual
vocabulary, in `docs/design-tokens.md`.

---

## Open items

Carried forward, none blocking:

1. **Verify OASF and A2A governance** before adopting either as a schema commitment. Asserted as settled in a May 2026 draft; today's licensing work showed how quietly such assumptions expire.
2. **SAP API Policy §2.2.2(a)** prohibits API use by autonomous systems that plan or execute sequences of API calls — which describes this product. Needs an answer from SAP in writing.
3. **The IAM key in `sap_erp_website_lambda`** is live and deferred by decision. Recorded as **K1** in `docs/infrastructure-risk-register.md` §1 — which is where it moved when `docs/compliance-checklist.md` left the trunk, because the risk is a property of AWS account `000000000000` and not of the deleted code.
4. **`model/connections.ts`** is unwritten; the licensing assessment has unblocked it, and **delta 22 constrains its shape** — credentials referenced, never held — which is cheapest to apply before the file exists.
5. **Remaining P1 items** in the change ledger: `PolicyEvaluation` retention, and invoicing and GST. ~~`retentionWindowValid()`~~ **landed 7 Aug 2026** (`model/domain.ts:1101`).
6. **Legal review** — ten ⚖️ items in `docs/data-governance.md` §9.
7. **Six findings from the resource-axis pass**, open by decision rather than
   oversight — `docs/HANDOFF.md` §4.1 (E1–E6), argued in
   `docs/access-and-agency.md` §11.9–§11.11. **Two moved on 7 Aug and neither
   moved to closed:** E2 is **applied but not enforced** — `Exception` gained
   `costCentre` and `legalEntity`, so the two scope dimensions are now
   *representable*, while nothing reads either column; and E1 is **partly
   settled** — `metering` and `commercial` got capabilities, `substrate` joined
   `catalogue` as a deliberate statement, and `schedule` and `telemetry` remain
   open gaps. **E4 is the oldest item with a hard deadline and it is still open:**
   G20 chose RFC 8785 / JCS and **it is not applied**, while two hashed streams
   already rest on it. It is irreversible after the first hash is computed.
8. **`docs/identity-classification.md` names 40 value objects; the extractor now
   reads 47** — `node tools/planner/extract.mjs`, gap kind
   `entity_without_identity`. The seven beyond the snapshot are `CarriedReading`
   and `CarriedTurn` (G47), `PackBinding` and `TokenUsage` (branded 7 Aug — the
   two fields no tool could see because they were not id-shaped),
   `ProcedureEdge` and `ProcedureViolation` (the slice-6 sweep), and
   `ProposedTransaction` (G42). **The sweep surfacing new candidates is the sweep
   working**, not a defect — but none of the seven has been classified, and none
   should be folded into the 40 without someone deciding.

---

## How to trust these documents

Four conventions used throughout:

- **Verified claims cite a file and line, or an API call.** Where something was inferred, it says so.
- **Absences are recorded as absences.** There is no test framework, no CI, no performance budget — the documents say that rather than inventing one.
- **⚖️ marks a legal question.** Those are for counsel, not for engineers, and none is asserted as settled.
- **A count carries the command that reproduces it** — added 7 Aug 2026, after
  three counts in three days were wrong because they were prose. Where you cannot
  write the command, write the uncertainty instead. `docs/HANDOFF.md` §5.11.

Where a document was **wrong and later corrected**, the correction is left
visible rather than quietly edited — see `PRODUCT.md` on the admin gate, and
`docs/domain-model.md` §7 on the domain-neutrality claim.

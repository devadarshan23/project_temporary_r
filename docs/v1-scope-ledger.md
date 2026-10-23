# v1 scope ledger — what is declared and not built

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** PARTIAL — accurate about **what was cut**; **its reasoning column answers a question no longer being asked.**
> A snapshot under G32 — *"an unowned document that looks like a control is worse than none; one that says it is a snapshot is just evidence."* It is not maintained and must not be edited into currency. **The authority on what is dropped is the `@dropped-for-v1` note on the declaration itself**, because that travels with the code. 🛑 **G81, 8 Aug 2026, orders a full re-run across every module against the product test — producing a NEW dated ledger, not an edit to this one.** Rewriting a snapshot's reasoning destroys the only thing a snapshot is for. Read the banner below for why the test was already superseded on the day.
> *Banner added 8 Aug 2026.*

> 🛑 **THE ACCEPTANCE TEST IN THIS FILE WAS SUPERSEDED THE DAY IT WAS WRITTEN —
> G48, 7 August 2026. READ THIS BEFORE ACTING ON ANY ROW.**
>
> Every module below is adjudicated on **"what the demo loses"**, and for
> `deployment.ts`, `observability.ts`, `evaluation.ts`, `learning.ts` and the
> partner half of `billing.ts` the recorded answer is **"nothing drawn"**.
>
> **G48 ruled that v1 is a product, not a demo.** *"Nothing drawn"* is a valid test
> against a screen pack and an invalid one against a product: it asks what a
> prospect would fail to **see**, never what a customer would fail to **get** or
> what obligation would go **unmet**.
>
> **This does not reverse a single drop, and it does not make this file wrong about
> what was cut.** The inventory is accurate; the *reasoning column* is answering a
> question that is no longer the one being asked. Several drops will survive the
> re-test — `deployment.ts` is dropped under G36 on a separate argument that G48
> does not touch. **Re-running the trim against a product test is the owner's next
> call and it has NOT been done.** `docs/HANDOFF.md` §3a carries the consequences
> already worked out, including the two drops that stop being acceptable
> immediately.

> ⚠️ **DATED SNAPSHOT, 7 August 2026. NOT A LIVING CONTROL, and not maintained.**
>
> This posture is deliberate and follows G32. This repository has already been
> misled once by a stale visual, and it has since banner-marked nine files for the
> same reason: an unowned document that *looks* like a control is worse than none,
> while one that says it is a snapshot is just evidence. The authority is the
> `@dropped-for-v1` note **on the declaration in `model/`**, which travels with the
> code and cannot go stale separately from it. This file explains the reasoning the
> one-line notes cannot carry.
>
> To regenerate the inventory below from source:
> `grep -rn '@dropped-for-v1' model/*.ts`

---

## The ruling, stated in full, because everything here depends on it

**`drop_for_v1` means the type STAYS DECLARED in `model/`, with a dated note, and
gets NO table, NO endpoint, and NO code. It is not deleted.**

**`delete` means removed from the tree.** In this whole trim there is exactly
**one** deletion — `ROLE_KEYS` and the `RoleKey` type — and it does **not** happen
in this pass. It is step 4 of the plan, separately reviewed, because it touches two
contract files as well as three model modules.

> **✅ 7 Aug 2026 — the deletion landed, in its own commit.** The tombstone
> carrying the full reasoning is in `model/domain.ts` after `DOMAIN_KEYS`; the
> derived per-site table is `docs/domain-model.md` §15.6. It touched **two
> contract files and one model module**, not three — the `policy.ts` and
> `governance.ts` holders this ledger inherited from the plan had already
> migrated on 5 Aug, and the recorded count (fourteen, then fifteen) was wrong
> in both revisions. The live set was six. Exports in `model/` go 657 → 655.

This is not caution. It is the mechanism that makes the trim safe, and it has three
consequences worth stating rather than assuming:

1. **`model/identity.ts` compiles unchanged.** It names **17 dropped types across
   60 sites** — `Solution` alone appears 9 times, `ModelFallbackChain` 5,
   `EvaluationGate` / `LearningRetraction` / `DataPlaneHealth` / `LegalHold` /
   `CommissionAttestation` 4 each. Under a deletion reading, every one of those is
   a compile break and the totality proof — the thing that makes a *fourteenth*
   bare-reference exception a reviewed edit rather than a silent omission — stops
   compiling. **The acceptance test for this pass was `tsc` exiting 0 with
   `identity.ts` included and unchanged. It does.** If a future drop requires
   editing `identity.ts`, the drop is wrong.
2. **Two of the three invariants a survival pass marked BROKEN come back as
   merely UNENFORCED.** A rule that is still expressed in the type system, with
   nothing running it, is a different and much cheaper state than a rule that has
   been deleted. Invariants 9 and 11 are in that state; see §6.
3. **Restoring any of this is one commit per group**, because nothing was
   destroyed — including, in most cases, the several hundred lines of reasoning
   attached to it, which is the genuinely expensive artefact.

**The ruling costs nothing to hold.** `model/` has no tables and no runtime; it
typechecks, it does not execute. A declared-and-unbuilt type is inert.

---

## What the numbers are

| | |
|---|---|
| Exports in `model/` after the pass | **638** across 16 modules (was 636; +2 added, see §4) |
| Top-level exports marked `@dropped-for-v1` | **199** |
| Field- and union-member-level drops | **23** |
| Declarations deleted | **0** |
| Modules dropped whole | **2** — `presentation.ts` (51 exports), `deployment.ts` (12) |
| Restorations against the proposed cut | **2** — `modelUse` / `ModelUseConfig`, and `LegalHold` |
| Exports added | **2** — `SAVED_VIEWS_EXIST`, `AUTOMATED_ROLLBACK_EXISTS` |
| Fields added | **1** — `FieldSpec.confidenceFloor` |
| Fields branded | **4** model-identity fields |

> ⚠️ **EVERY NUMBER IN THIS SECTION IS A SNAPSHOT OF 7 AUGUST 2026 AND IS LEFT
> UNCHANGED ON PURPOSE.** It records what the trim pass found; rewriting it would
> destroy the only thing a dated snapshot is good for. **It is not the tree, and
> by 8 Aug it was already a long way from it** — exports 638 → **683**, nodes
> 132 → **140**, edges 233 → **249**, and the dropped-export count 199 → **198**.
> The movement is later work (G42–G47, the retention re-key, the 8 Aug fixtures
> pass), not a correction to what is written here.
>
> **Derive the current values; never quote this block for them:**
> `node tools/check-doc-counts.mjs --derive` and `node tools/planner/extract.mjs`.
>
> ⚠️ **`tools/check-doc-counts.mjs` DOES NOT CATCH THIS BLOCK, and that is a tool
> gap rather than a licence.** Its matcher wants the number immediately before the
> noun — `683 exports` — so it reads prose and is blind to a table cell where the
> noun comes first (`| Exports in `model/` … | **638** |`). Found 8 Aug 2026;
> `docs/HANDOFF.md` §4.1 carries it. Two documents are known to be affected: this
> one and `HANDOFF`'s own two counts tables.

Extractor delta (`node tools/planner/extract.mjs`), before → after:

```
nodes                     130 → 132     (value objects 42 → 44)
typed edges               231 → 233     (233 resolving, 0 dangling)
bare id-shaped fields      13 → 13      unchanged
gaps                      147 → 149
  entity_without_identity  42 → 44
  reference_without_type   13 → 13      unchanged
  brand_without_interface   0 → 0
```

Every part of that delta is the branding in §5 and nothing else: `TokenUsage` and
`PackBinding` previously carried no reference the extractor could see (`model:
string`, `modelOverride: string | null` are not id-shaped names), so neither was a
graph node. Branding them makes both value objects carrying one typed edge each —
hence +2 nodes, +2 edges, and +2 `entity_without_identity`, which is the extractor
correctly observing that a value object has no `id`. **No edge dangles. The bare
count did not move, and that is the honest result:** none of the four branded
fields was in the extractor's bare-13 to begin with, which is precisely why they
had gone unnoticed.

---

## 1. Modules dropped whole

### 1.1 `presentation.ts` — all 51 exports, 1,154 lines

**What the demo loses:** the dashboard builder, build-a-card-by-chatting, and the
"Panels" screen that `Reports.dc.html`'s own bet promises and that was never drawn.

**Why it is safe, and why that argument expires.** The standing objection to
cutting `resolveCard()` / `ViewerScopedFilter` is that a saved panel becomes a
standing scope bypass — the author's reach frozen into an artefact that everyone
who can open it inherits. That is the default behaviour of the whole BI category
and this module exists to refuse it. **But in v1 there is no builder, so nothing is
saved, so nothing is shared, so the bypass has no vector.** The four panels
`Reports.dc.html` renders are fetched by capability operations —
`getDispositionMix`, `listExceptions`, `getExceptionFacets` — that already run
`decide()` on the caller. The scope property lives in the API layer, not the card
resolver.

**Guard, and it is mandatory rather than advisory:** `export const
SAVED_VIEWS_EXIST = false` now sits at the top of the module. Flipping it is the
trigger to restore the resolver — a real event, not "later". The engineer who
builds saved views has to edit a reviewed line in the same diff.

**Restore cost: one commit.** Declarations and reasoning are intact. `Reports.dc.html`
renders four objects of `{name, icon, fg, pinned}` — a sidebar of four strings and
two booleans — so nothing in the v1 screen pack depends on this module at all.

| Type | Why (all identical) |
|---|---|
| `DashboardCardId` · `DashboardCardDraft` · `DashboardCard` · `CARD_KINDS` · `CardKind` · `CHART_KINDS` · `ChartKind` · `CardLayout` · `DashboardCanvas` · `CARD_TONES` · `CardTone` · `CARD_EMPHASIS` · `CardEmphasis` · `CardPresentation` · `CARD_METRICS` · `CardMetric` · `CONTENT_CAPABILITY_UNDEFINED` · `ContentCapabilityUndefined` · `METRIC_CAPABILITY` · `CardAggregate` · `METRIC_AGGREGATES` · `CARD_DIMENSIONS` · `CardDimension` · `CardFilter` · `UNFILTERED` · `CardWindow` · `TimeBucket` · `SortDirection` · `EXCEPTION_COLUMNS` · `ExceptionColumn` · `RUN_COLUMNS` · `RunColumn` · `CARD_BINDING_KINDS` · `CardBindingKind` · `CardBinding` · `CARD_KIND_BINDINGS` · `DashboardOrigin` · `Dashboard` · `ViewerScopedFilter` · `BindingDimension` · `BINDING_REFUSALS` · `BindingRefusal` · `CardResolution` · `ResolvedCard` · `DashboardResolution` · `ScopeResolver` · `bindingVisibleUnder` · `contentCapabilityFor` · `resolveCard` · `resolveDashboard` · `dashboardReadsTenantData` | No dashboard builder, no saved views, no Panels screen in v1. |

Three of those carry a sharper restore trigger than the rest — `ViewerScopedFilter`,
`resolveCard` and `ScopeResolver` are the scope-bypass refusal itself, and they must
be back **before the first view is saved and shared**, not after.

### 1.2 `deployment.ts` — all 12 exports, under G36

**G36 reverses a pass-F decision knowingly: BYOA slips to v1+1, 1CloudHub-hosted
only.** Pass F made BYOA a v1 target because the first non-demo customer is a
regulated enterprise sold direct; that reasoning still stands. What changed is that
ASAP was not a constraint when it was taken.

**What the demo loses:** nothing drawn. Zero screens render a data plane.

**What the *product* loses:** the ability to sell to a customer who requires the
software to run in their own AWS account, until v1+1.

**What it buys, and this part is genuine:** the hashed-stream problem shrinks from
three streams to two, two administration operations are never written
(`registerDataPlane`, `issueEntitlementLease`), and pass C's *"adopt expand/contract
migrations here or never"* stops being irreversible — that was only true because
BYOA planes sit in AWS accounts we cannot reach. On a hosted fleet a bad migration
is recoverable. It also defers staffing the named fleet-operations function that
pass C required before the first BYOA customer.

| Type | Why | Restore note |
|---|---|---|
| `DataPlaneHealthId, DataPlaneHeartbeatId` (re-export) | G36 | — |
| `DATA_PLANE_LIVENESS` · `DataPlaneLiveness` | G36 | — |
| `VERSION_POSTURES` · `VersionPosture` | G36 | — |
| `SupportedVersionWindow` · `SECURITY_PATCH_HOURS_DEFAULT` | G36 | Carries pass C's 72-hour pre-authorised security-patch window; counsel's wording is still outstanding either way |
| `DataPlane` | Nothing registers a plane, so nothing reads this | **Comes back first.** `sendHeartbeat` derives `dataPlaneId` from the SigV4 principal, so it presupposes a row with `attestationPublicKey` that nothing else creates |
| `DataPlaneHeartbeat` | A hosted fleet does not heartbeat to itself | — |
| `DataPlaneHealth` | With no remote planes there is no fleet to roll up | — |
| `livenessFor` · `versionPostureFor` | Read heartbeats nothing emits, and a version window nothing sets | — |

**Restore cost: one commit for the module**, plus the two administration operations
and a named fleet-operations function before the first BYOA customer.

---

## 2. Partial drops, module by module

### 2.1 `agents.ts` — the authoring half (8 exports + 8 fields/members)

**The line: a pack ships an agent; a tenant may not author one.** Agents *run* in
v1 — `PRODUCT.md` positions this as an agentic layer that detects, explains and
resolves — so invariants 6, 9 and 11 bind and the machinery enforcing them is not on
the table. `TOOL_EFFECT`, `validateAgentToolBindings`, `mintAgentGrant`,
`resolveAgentModel`, `InjectionProbe` / `InjectionGate` and the whole runtime-safety
set stay live.

**What the demo loses:** you cannot show a customer creating or editing an agent.
Ever, in v1. If a prospect asks *"can we teach it our own agent?"*, the answer is no.

**Restore cost:** one commit for the declarations; the expensive part is the F14
Authoring Validator service, which is a real build and not a model change.

| Type / field | Why |
|---|---|
| `HARNESS_APPROVAL_REQUIREMENT` | Four-eyes harness approval needs a tenant authoring path, and v1 has none |
| `harnessMayActivate` | Gates a tenant harness lifecycle v1 does not ship |
| `agentIsASeparateObjectToSecure` | Answers a question only tenant-authored agents raise |
| `provenanceAfterHarnessEdit` | No tenant may edit a harness in v1, so the conversion never fires |
| `AgentEvalBinding` | Per-tenant eval binding presupposes tenant authoring; the pack floor stands alone |
| `requiredGateIds` · `agentGatesFrom` | Read `AgentEvalBinding`, which v1 does not create |
| `gateMayBeWaivedInSandbox` | A waiver needs an authored gate set to waive |
| `AgentProvenance` → `tenant_authored` arm | A pack ships an agent and a tenant may not author one, so the arm is unreachable |
| `HarnessDocument.status` · `.approvedBy` · `.approvedAt` · `.archivedAt` | The harness tenant lifecycle; a v1 harness is approved by pack signing |
| `AgentModelBinding.fallbackChainId` | v1 routes to one entry per binding; `ModelFallbackChain` has no resolver |
| `PlatformAgentEvalFloor.gateIds` · `.byToolEffect` | The gates they key are quality gates, which v1 does not run. The `injectionGate` field stays — `waivable: false`, and it is the floor in v1 |

**One structural choice worth defending.** `AgentProvenance` stays a **union with
one live arm**, not a flattened struct. While it is a union, re-admitting tenant
authoring is a compile error at every discriminant site. Flattening it would make
the same change a silent widening.

### 2.2 `evaluation.ts` — the quality half (21 exports)

**What the demo loses: nothing.** No labelled corpus exists to score against, so
none of this could have run.

**Invariant cost:** invariant 9 — *only outcome-level scorers may trigger a
rollback* — becomes **declared and unexercised**. It is not broken, because nothing
in v1 can revert a fleet at all. `AUTOMATED_ROLLBACK_EXISTS = false` in `domain.ts`
is the compensating record; see §4.

**What stays and is load-bearing:** `InjectionProbe`, `InjectionGate`
(`waivable: false`, literally), `SAFETY_ASSERTIONS`, `probesApplicableTo`,
`INJECTION_VECTORS`, `INJECTION_ENTRY_POINTS`, `InjectionProbeResult`. **A probe
asserts an absence, and that is a different kind of test from a score.**

**Restore cost:** one commit for the declarations. The real cost is building the
labelled corpus, which is people-time and cannot be commit-sized.

| Type | Why |
|---|---|
| `ScorerId` (re-export) · `GateResultId, PackQualityReportId` (re-export) | Aliases of dropped types |
| `SCORE_TARGETS` · `ScoreTarget` · `SCORE_LEVELS` · `ScoreLevel` · `SCORER_METHODS` · `ScorerMethod` | Quality scoring has no corpus and no rollout to feed |
| `Scorer` | No labelled corpus exists to score against |
| `canTriggerRollback` | No automated rollback exists in v1 |
| `EvaluationGate` · `GateResult` | Quality gates need scorers and a corpus; the injection gate is separate and stays |
| `ScoreSubject` · `ScoreResult` | Nothing is scored in v1 |
| `LabelledExample` · `SeededExample` · `ObservedExample` · `HumanFeedback` | No labelled corpus is built for v1 |
| `QualityWindow` · `PackQualityReport` | Aggregate scores v1 does not produce |
| `rollbackTriggerForFailedProbe` | Invariant 9's deliberate exception has no rollout to trigger. **The probe still refuses** — what is dropped is the fleet revert it would have caused, not the refusal |

### 2.3 `learning.ts` — retraction, and §§4–9 (33 exports)

**Kept, and this is the point of G39:** `Correction`, `classifyCorrection`,
`LearningNomination`, `NominationReview`, `LearningEntry`, `validateNomination`,
`mayPromoteLearning`, `LEARNING_PROMOTION_REQUIREMENT`, `PERMITTED_DESTINATIONS`,
`NominationEvidence` and the scope vocabulary. Those are what `amendProcedure`
needs — one narrow write, text and thresholds only, from an approved
`NominationReview` — which demos G5 and G24 in full: `Finding.dc.html`'s 400-character
rejection reason feeding `Setup.dc.html`'s three-rejections-to-one-amendment.

**What the demo loses: nothing drawn.**

**What it costs:** a wrong promoted learning cannot be un-promoted except by hand.
That is a real operational hole and it is accepted, not solved.

**Restore cost:** one commit per group. The knowledge graph would additionally need
the timestamp `docs/identity-classification.md` flags as probably its own defect —
a learned graph edge that cannot be aged, audited or retracted by date.

| Group | Types | Why |
|---|---|---|
| Retraction (6) | `LearningRetractionReason` · `RetractionRefusal` · `RetractionMode` · `RETRACTION_UNMAKES_DOWNSTREAM` · `LearningRetraction` · `mayRetractLearning` | Retraction is unbuilt in v1; a wrong promotion is undone by hand |
| Knowledge graph (5) | `GraphNodeRef` · `EdgeKind` · `KnowledgeEdge` · `AGENT_MAY_DISTIL` · `distil` | Zero call sites and no screen |
| Cross-boundary, §5 (9) | `CrossBoundaryScalar` · `AssertContentless` · `SignalKey` · `SignalMeasure` · `_SignalKeyIsContentless` · `_SignalMeasureIsContentless` · `CrossBoundarySignal` · `AGGREGATE_INFORMS_INFERENCE` · `NON_NOMINATED_CORRECTIONS_CONTRIBUTE_STATISTICS` | Nothing crosses the tenant boundary in v1 — the platform learns nothing |
| Classification, §6 (3) | `DATA_CLASS_RANK` · `classifyLearning` · `LEARNING_CLASS_MAY_BE_LOWERED` | ⚠️ This is the learning-path derivation of **invariant 4**. See §6 — a compensating control is owed and is not written |
| Retention, §7 (4) | `LearningRecordKind` · ~~`RETENTION_FIELD_FOR`~~ **`RETENTION_CLASS_FOR`** · `LearningSubjectLocation` · `erasureDispositionFor` | Learning retention and erasure are unbuilt in v1. ⚠️ **Renamed 7 Aug 2026** with the `RetentionPolicy` re-key: it was typed `'auditDays' \| 'exceptionDays'`, two field names that stopped existing, and is now `Record<LearningRecordKind, RetentionClass>`. A dropped type still has to be *true* — a dropped type pointing at a field that no longer exists is how a restoration later ships something broken |
| Metering, §8 (4) | `PROPOSED_METERS` · `ProposedMeter` · `PROPOSED_METER_AGGREGATION` · `PROPOSED_METER_PRICED_IN_V1` | Proposed, never priced — and v1 prices nothing |
| Contamination, §9 (2) | `MAX_LEARNING_INFLUENCE_TO_WIDEN` · `widenIsBlockedByContamination` | Read a learning-influence figure v1 does not compute |

### 2.4 `billing.ts` — partner, margin, invoicing, BYOA (32 exports)

**Kept — the six the meter actually needs:** `METERS`, `METER_AGGREGATION`,
`UsageRecord`, `Plan`, `Entitlement`, `ENTITLEMENT_KEYS`, `Subscription`, `Budget`,
`BudgetScope`, `BudgetAlert`. The token meter renders on every page of the screen
pack.

**Why invoicing goes, against the earlier proposal to keep it:** `PRODUCT.md:197`
lists **pricing** among the things that must not be fabricated. A populated
`RateCard` in v1 could only be fabricated. The invariant that survives is
invariant 5 — *money is always derived* — and it survives by there being no
derivation at all rather than a fake one.

**Why the partner block goes:** **P4 is open** (`HANDOFF` §4.2) — does 1CloudHub
invoice end customers on partner-sold tenants. You cannot build a decision nobody
has taken. Zero partner screens are drawn anywhere in the pack.

**What the demo loses:** no partner portal, no partner login, no margin view. The
entire partner go-to-market is deferred to a named human and a spreadsheet.

**Restore cost:** one commit for the declarations, gated on P2 and P4 being
answered. `PartnerBillingSummary` still cannot express the commission-only arm
(V9), so restoring it unchanged would restore a known gap.

| Group | Types | Why |
|---|---|---|
| Invoicing (5) | `MeterPrice` · `PriceTier` · `RateCard` · `BillingPeriod` · `RatedTotal` | `PRODUCT.md:197` forbids fabricating pricing |
| Cost rollup (1) | `CostAttribution` | No screen, no operation. Filed on its own merits — it is the cost-centre rollup, **not** part of the partner block |
| Partner commercial (10) | `PartnerBillingSummary` · `PartnerCommercialVisibility` · `PartnerCommercialTerms` · `partnerCommercialVisibility` · `PartnerTenantLine` · `PartnerTenantLineBase` · `PartnerTenantResaleLine` · `PartnerTenantRosterLine` · `PartnerTenantBandedLine` · `PartnerTenantBaseSpendLine` | No partner portal; P4 undecided |
| Partner facts / shaping (2) | `PartnerTenantFacts` · `shapePartnerTenantLine` | No partner portal; P4 undecided |
| Commission (3) | `CommissionBand` · `CommissionAttestation` · `COMMISSION_BASIS_DISCLOSES_VOLUME` | No partner commission in v1; P4 undecided |
| Cohort floor (2) | `AGGREGATE_COHORT_FLOOR` · `aggregateIsDisclosable` | The partner and platform aggregate views it protects are both dropped |
| Platform margin (3) | `ProviderCostRecord` · `CostReconciliation` · `PlatformMarginLine` | Platform margin has no surface in v1 |
| BYOA, G36 (6) | `EntitlementLease` · `UsageAttestation` · `LEASE_WINDOW_DAYS` · `LEASE_GRACE_DAYS` · `LEASE_CEILING_MULTIPLE_DEFAULT` · `CommissionAttestationId, UsageAttestationId` (re-export) | 1CloudHub-hosted only; there is no lease to issue and a hosted plane does not attest to itself |

### 2.5 `observability.ts` — partner and platform views (11 exports)

**Kept:** `TraceRef`, `TelemetryPolicy`, `TelemetryExport`, `SpanAttributePolicy`.
A telemetry policy must exist even where no UI sets it, or the default becomes
whatever the code happens to do. FDE defaults at install.

**A correction that belongs in the record:** `TelemetryPlane` is a **bare alias** —
`export type TelemetryPlane = OrgClass`. There are not "three telemetry planes"
independent of the org axis; there is one axis with three values. With two of the
three org classes unsurfaced in v1, `SpanAttributePolicy.visibleTo` is in practice a
**one-valued array**, `['customer']`. The type is unchanged and correct; what is
missing is any consumer of the other two values.

**What the demo loses:** nothing drawn. `PlatformHealthWindow` nulls every figure
below `AGGREGATE_COHORT_FLOOR = 5`; v1 has one to three tenants, so it would have
nulled everything anyway.

**Restore cost:** one commit, gated on the same P2/P4 answers as §2.4.

| Type | Why |
|---|---|
| `PARTNER_HEALTH_WINDOW_DAYS` · `PartnerHealthWindowDays` · `PARTNER_HEALTH_MIN_WINDOW_DAYS` · `TenantActivityBand` · `SupportLoadBand` · `PartnerHealthView` · `partnerHealthWindowEnd` · `PartnerTelemetryAccess` | No partner portal in v1 — zero partner screens are drawn |
| `PlatformHealthWindow` · `platformWindowAggregateIsDisclosable` | At one to three tenants the k-anonymity floor of 5 nulls every figure anyway |
| `PlatformTenantInspection` | No platform inspection surface in v1; support access runs by grant and runbook |

### 2.6 `domain.ts` — 15 exports + 14 fields/members

**What the demo loses:** currency conversion (every figure on every screen is in one
currency), rollout and canary, automatic escalation on a finding, and the typed
domain projections. **`examples.ts` keeps both worked domains** — `PRODUCT.md:62,67`
names KYC as worked example #2, demonstrated — so the domain-neutrality *claim*
survives in full even though `project()` is unbuilt.

**Restore cost:** one commit each. The projections are the cheapest thing in this
document to bring back and the most expensive thing to have got wrong, because
`docs/data-architecture.md` §12 delta on cost centre and legal entity is a column
addition today and a backfill-from-a-changed-policy later.

| Type / field | Why |
|---|---|
| `FxConversion` · `FxPolicy` | Every figure on every v1 screen is in one currency |
| `EvaluationTerms` · `acceptsNonSyntheticIngest` | The `evaluation` environment posture ships no operation in v1 |
| `PackLifecycleState` → `'draft'` `'validated'` `'tested'` `'staged'` `'approved'` `'promoted'` | Six of eight members. **The type stays whole** — narrowing a union `SolutionPack` already carries would be a shape change, and this pass changes no shapes. v1 runs `active` and `deprecated` |
| `PackPosture` · `RolloutStrategy` · `PackRollout` | No rollout or canary in v1 |
| `RollbackTrigger` | No automated rollback exists in v1 |
| `Solution` | No operating-assembly surface in v1. ⚠️ **`AssignmentScope` keeps all six dimensions including `solutionIds`** — see §7 |
| `AwaitTarget` → `{ kind: 'timer' }` | Every v1 advance is caused by an act; nothing advances because time passed |
| `ProcedureStep` `await.timeoutHours` | A per-execution durable timer with resume-after-crash semantics is out of scope |
| `ProcedureEdge.when` → `'timeout'` | No procedure clock fires, so no edge is ever taken on one |
| `Procedure.defaultEscalationCapability` | Names a destination no v1 clock ever reaches |
| `STEP_EXECUTION_OUTCOMES` → `timedOut` `escalated` | No walk can reach these outcomes |
| `ProcedureStepExecution.timesOutAt` | Materialises `await.timeoutHours`, which v1 does not set, and nothing sweeps it |
| `BreachRecord` | Breach notification is a runbook in v1, not a stored record |
| `FinanceThreeWayView` · `KycIdentityView` · `project` · `asFinanceThreeWay` · `asKycIdentity` | A positioning property, not a v1 function |

**Why the procedure clock goes while service-notice escalation stays**, since it
reads as a contradiction. `Mockups/rec/Notifications.dc.html:236-243` was re-checked:
every escalation clock in the entire pack belongs to a **service notice** —
*Reconciliation failed* 30 min, *Posting rejected by the ERP* 30 min, *Connection
lost* 1 hr — and the four work-level rows, including *"Finding assigned to you for
review"*, carry `escalates: '—'`. Mechanically the two are two orders of magnitude
apart: a procedure timeout is a durable per-execution timer with resume-after-crash
semantics, one clock per live walk, plus an escalation router that re-enters the
graph. A service notice is one periodic sweep over one table of unacknowledged rows.

**What is deliberately NOT dropped from the procedure runtime:**
`ProcedureStepExecution` stays **whole**. Uniqueness of `(tenantId, exceptionId)`
with `endedAt === null` is the concurrency control that makes `step_not_current`
(409) real, and two operators opening the same exception is a demo failure mode. It
is also the row `DerivedAgentGrant.stepExecutionId` names, so dropping it would drop
invariant 11's enforcement.

### 2.7 `policy.ts` — the autonomy dials and two policy kinds (12 exports + 2 members)

**`POLICY_KINDS` goes 7 → 5, not 7 → 4.** See §3.1.

**What the demo loses:** the measured-autonomy loop. `recommendAutonomyCeiling()`
**structurally cannot recommend at onboarding** — `sampleSize` is zero, and every
v1 tenant is at onboarding. Dropping it loses nothing that could have run.

**What stays and is load-bearing:** `AutonomyConfig`, `ApprovalConfig`, `mayAdmit`,
`CorrespondenceConfig`, `DEFAULT_AUTONOMY_BY_DOMAIN`, and the whole
`AutonomyProposal` propose-and-approve path. That last one moved from *recorded* to
**blocking** in pass D: `docs/access-and-agency.md` §10.3 is safe only if an FDE is
never a policy author. Without the proposal path, either the FDE authors the policy
(unsafe by decision) or nobody does and the agent cannot act.

**Restore cost:** one commit, but it is worthless until there is enough traffic to
measure — 200 decisions per `MIN_SAMPLE_TO_WIDEN`.

| Type / member | Why |
|---|---|
| `POLICY_KINDS.spend` · `SpendConfig` | v1 prices nothing, so there is no billing layer to enforce a ceiling through |
| `POLICY_KINDS.contentGuardrail` · `ContentGuardrailConfig` | No provider guardrail is provisioned; the injection gate and `mayAdmit()` carry the admission side |
| `AutonomyDials` · `RecommendationBasis` · `AutonomyRecommendation` · `AutonomyDecision` · `recommendAutonomyCeiling` | The measured-autonomy loop is unbuilt; it cannot recommend at sample size zero |
| `MIN_SAMPLE_TO_WIDEN` · `MAX_REVERSAL_RATE_TO_WIDEN` · `MIN_EVIDENCE_RATE_TO_WIDEN` · `MIN_DECISION_SECONDS` · `REVERSAL_RATE_TO_NARROW` | Thresholds for a measurement v1 never takes |

### 2.8 `catalog.ts` and `governance.ts` — four exports

| Module | Type | Why | Restore |
|---|---|---|---|
| `catalog.ts` | `ModelFallbackChain` | v1 routes to one model per binding; no resolver, no screen | One commit. `AgentModelBinding.fallbackChainId` comes back with it |
| `governance.ts` | `BreakGlassPreservation` · `BreakGlassRefusal` · `breakGlassPermits` | Break glass has no operation and no approver in v1 | One commit. It was decided against the recorded advice in the first place (§10.7), scoped to preservation only — restoring it should re-read that argument |

---

## 3. The two restorations, made against the proposed cut

Both were proposed for the drop and both are **kept deliberately**. Each is
documented at its declaration in `model/`, not only here, because a ledger entry is
not where a future engineer looks before re-cutting something.

### 3.1 `modelUse` / `ModelUseConfig` — restored, because invariant 7 has no other input

`resolveModel()` (`model/catalog.ts`) is **invariant 7's only executable
enforcement**: residency survives inference, `global.*` model routing is rejected
outright. It takes three inputs — `allowedModels`, `allowedRegions`,
`requireZeroRetention`.

`grep -rn "allowedRegions" model/` returns **only**:
- `policy.ts` — the declaration on `ModelUseConfig`
- `catalog.ts` — the parameter and the check
- `agents.ts` — the forward

**There is no other tenant-scoped source.** Dropping `modelUse` would leave
`resolveModel()` with nothing to read.

The argument for cutting it was that it re-encodes
`FieldSpec.modelProcessingAllowed`. That argument is contradicted at the
declaration of `HarnessDocument.maxDataClassInPrompt` in `agents.ts`, in the
model's own words: *"Distinct from `FieldSpec.modelProcessingAllowed`, which
governs a single extracted value. This governs the ASSEMBLED context."*

**Cost of the restoration: four fields, no new types.** `POLICY_KINDS` is 7
declared, **5 live**.

### 3.2 `LegalHold` — restored, because `purgeVerdict()` reads it

`purgeVerdict()` (`model/governance.ts`) takes `hold: LegalHold | null` and reads
`releasedAt`, `until` and `reason` **in its first branch**. Dropping the type while
keeping the function silently rewrites the stated precedence from
**HOLD > MINIMUM > ERASURE > MAXIMUM** to **MINIMUM > ERASURE > MAXIMUM** — which is
a change to what the system does with a deletion request during litigation.

Only the break-glass **path** is dropped. The hold itself is live.

**Cost of the restoration: one interface, six fields.**

---

## 4. What was added

| Addition | Module | Why |
|---|---|---|
| `FieldSpec.confidenceFloor: number \| null` | `domain.ts` | **G38.** Resolves a live contradiction: G22 put the floor with an FDE and off the customer surface; G25 recorded that **no mechanism for customer-invisible configuration exists or is being added**. They could not both ship. The floor travels in a pack template and is rendered **read-only**, which satisfies G22's substance — an FDE sets it, a customer cannot change it — and needs none of G25's missing mechanism, **because read-only is not invisible.** It sits on `FieldSpec` and not `DocumentType` because the floor is per-field, which is the same grain `dataClass` and `modelProcessingAllowed` already use under invariant 4. Unblocks `Close.dc.html` band D |
| `SAVED_VIEWS_EXIST = false` | `presentation.ts` | The trigger to restore the scope-bypass refusal, expressed as a reviewed line rather than a hope |
| `AUTOMATED_ROLLBACK_EXISTS = false` | `domain.ts` | Invariant 9's compensating record. The first engineer to build a rollout deletes a line in a diff somebody reviews, instead of quietly shipping a fleet revert a quality scorer can fire |

**There is deliberately no `editableByTenant` flag beside `confidenceFloor`.**
Adding one would *be* the mechanism G25 says does not exist — a visibility term
smuggled onto a field instead of decided as a platform property. Read-only is
enforced by no v1 write operation accepting the field.

~~⚠️ **`confidenceFloor` is currently unexercised.** No `FieldSpec` object literal
exists anywhere in `model/` — `examples.ts` seeds definitions, not document types —
so the field typechecks and nothing constructs it. The first `DocumentType` example
or fixture must set it.~~

✅ **CLOSED 8 Aug 2026 — the fixture this asked for exists.** `invoiceFieldSpecs`
in `model/examples.ts` constructs two `FieldSpec`s, and it constructs them as the
**pair** the field's own comment argues for: an invoice total at `0.95` and a
free-text description at `null`, because *"a total on an invoice and a free-text
description do not deserve the same threshold"* — the per-field grain made as data
rather than as prose. `docs/HANDOFF.md` §5.10 carries the whole fixtures pass and
its two red runs.

---

## 5. The four model-identity brandings

CLAUDE.md's invariant 7 carries a ⚠️ naming three bare model-identity fields.
**That note is stale and both prior passes inherited the error** — CLAUDE.md's own
"On invariant 7" paragraph puts the inventory at nine. The six that survive to this
pass are `TokenUsage.model`, `AuditActor.agent.modelId`,
`ProposalActor.agent.modelId`, `PackBinding.modelOverride`, ~~`MeterPrice.model`~~
**`UsageRecord.model`** and `PolicySubject.model_call`.

> 🛑 **CORRECTED 8 Aug 2026, AND THE CORRECTION CHANGES THE VERDICT BELOW.** This
> section named **`MeterPrice.model`** and called it *"dropped with the invoicing
> chain"* — safe, therefore. **`MeterPrice` has no `model` field at all.**
> `billing.ts:238` sits inside **`UsageRecord`** (declared `:122`), which carries
> **no `@dropped-for-v1` marker**: it is **live**, and it is invariant 5's own
> record — *"money is always derived; `UsageRecord` is immutable and unpriced."*
>
> **So one of the two "remaining" bypasses is not inert, and this file said it
> was.** `CLAUDE.md` records the same slip against itself — *"it previously listed
> `MeterPrice.model`… and that line is `UsageRecord.model`, a different and more
> important field"* — and this ledger carried the uncorrected version. **Do not
> conclude from §5 that the residue of E5 is harmless.**
>
> **Derive the live set, do not read it here:**
> `grep -rnE "\b(model|modelId|modelOverride)\s*\??:\s*string\b" model/*.ts | grep -v '^\S*:[0-9]*: *\*'`
> → five lines, of which `catalog.ts:118` and `:168` are correctly bare under R1.

| Field | Module | Was | Now |
|---|---|---|---|
| `TokenUsage.model` | `domain.ts` | `string` | `ModelCatalogEntryId` |
| `PackBinding.modelOverride` | `domain.ts` | `string \| null` | `ModelCatalogEntryId \| null` |
| `ProposalActor` agent arm `.modelId` | `domain.ts` | `string` | `ModelCatalogEntryId` |
| `AuditActor` agent arm `.modelId` | `governance.ts` | `string` | `ModelCatalogEntryId` |

**Two bare ones are correct and are NOT branded**, under rule **R1** in
`model/identity.ts`: `ModelCatalogEntry.modelId` and `resolveModel()`'s own
parameter are **the string AWS mints**. The catalogue *row* is ours; the model
identifier is not. One letter apart, opposite answers.

~~The remaining two are inside dropped surface: `MeterPrice.model` (dropped with
the invoicing chain) and `PolicySubject.model_call` (a union arm on a subject
descriptor rather than a stored reference).~~

**Corrected 8 Aug 2026 — see the block above. Neither remaining field is inside
dropped surface:** `UsageRecord.model` (`billing.ts:238`) is **live**, and
`PolicySubject` `model_call.model` (`policy.ts:747`) is **live** too — it was
invisible to the earlier grep only because it sits inside a **union type alias**
rather than an interface body. A third, `Scorer.model` (`evaluation.ts:158`), is
bare *and* `@dropped-for-v1`, which is the only one this sentence was ever right
about.

> ⚠️ **NO DOCUMENT MAY CLAIM THIS TRIM CLOSES E5.** Four of six branded is
> progress, not closure.

**One consequential side effect, recorded because it changed a fixture.**
`model/examples.ts` was assigning the literal
`'apac.anthropic.claude-haiku-4-5-20251001-v1:0'` to `PackBinding.modelOverride` —
a provider string reaching a persisted row without passing `resolveModel()`, which
is exactly the shape invariant 7 warns about. It is now a catalogue-row id,
`'mce_claude_haiku_4_5_apac'`, cast in the same house style as
`'proc_kyc_review' as ProcedureId`. The provider string still exists; it belongs on
`ModelCatalogEntry.modelId`, where R1 says a bare string is right.

---

## 6. Invariant status after the trim

**Zero broken.** Without the declaration ruling and the two restorations: three.

| # | Verdict | Basis |
|---|---|---|
| 1 | **Enforceable** *(conditional)* | `decide()` reads `PrincipalContext.tenantId`. **Condition: the ~25 new administration operations take a grant id, never a `tenantId`** |
| 2 | **Enforceable, unexercised** | Partner arm intact; `PARTNER_CAPABILITY_MASK` and `effectivePartnerCapabilities` kept. Clamp stays, portal does not |
| 3 | **Enforceable** *(the addition is the hazard)* | Holds only if the administration surface is split into `platform-administration.openapi.yaml` and `tenant-administration.openapi.yaml`. One combined file mixing `createTenant` with `updateReconciliationDefinition` **violates invariant 3** — `control-plane.openapi.yaml:52-63` names *"a definition name"* explicitly among the forbidden fields |
| 4 | **Enforceable; one derivation unenforced** | `FieldSpec.dataClass` survives, `confidenceFloor` lands on the right object, `maxDataClassInPrompt` survives twice. ⚠️ **The learning-path derivation (`classifyLearning`, `DATA_CLASS_RANK`) is dropped and a compensating control is OWED and NOT WRITTEN** |
| 5 | **Enforceable; metering clause ~~unenforced~~ representable and unenforced** | `UsageRecord` immutable and unpriced. ~~⚠️ Counted by value: 34 capabilities over 7 of the 13 classes — `metering` and `commercial` have **no capability at all**.~~ **Superseded the same day this ledger was written:** `view_metering` (35) and `view_commercial` (36) were minted on 7 Aug 2026, so it is **36 capabilities over 9 of the 13 classes** and both named classes now have one. Corrected in place rather than rewritten, because the row records what the trim pass found and the correction is a *later* pass's result. ⚠️ **Still not enforcement** — nothing calls either capability, there is no meter endpoint and no administration tier. `docs/access-and-agency.md` §11.9a |
| 6 | **Enforceable — strongest survivor** | Every dependency of `validateProcedureInjectionSafety()` survives, as do `mayAdmit()`, `TOOL_EFFECT`, `validateAgentToolBindings`, `InjectionGate(waivable: false)`. ⚠️ Two weakenings: **the CI call site must actually exist**, and the harness gate is safe only while the harness ships signed and uneditable |
| 7 | **Enforceable** | Only because `modelUse` was restored (§3.1). Four fields branded (§5); E5 not closed |
| 8 | **Enforceable, improved** | `decide()` refuses `ORG_CLASSES.platform` categorically. `issueTenantAccessGrant` is what finally makes `MAX_GRANT_HOURS` get read |
| 9 | **Unenforced, not broken** | `Scorer`, `canTriggerRollback`, `PackRollout` stay **declared**, so the rule is still expressed; nothing runs it because no rollback exists. `AUTOMATED_ROLLBACK_EXISTS = false` is the marker |
| 10 | **Enforceable; detectability unenforced pending E4** | All three `authorizationId` carriers verified present — `AuditEvent`, `DataAccessEvent`, `UsageRecord`. `RecordChain` blocked on canonicalisation, irreversible after the first hash |
| 11 | **Enforceable, unexercised** | Under the ruling `Solution` stays declared, so `SOLUTION_IS_GRANTABLE` keeps its subject and `InstalledPack.mintedSolutionId` and `ResourceRef.solutionId` do not dangle |

---

## 7. What was kept that a reader might expect to be cut

Recorded because "why is this still here" is the question this ledger will be
opened to answer.

| Kept | Why cutting it is a rebuild, not a saving |
|---|---|
| `access.ts`, ~45 of 49 exports | No screen owns it, and every one of the ~25 new administration operations authorises through it. `CAPABILITY_RESOURCE_CLASS` is a total `Record<Capability, …>`, so an unclassified capability is a compile error |
| **All six `AssignmentScope` dimensions**, including `solutionIds`, even though `Solution` is dropped | Adding a dimension later is a breaking change to `scopeIsNarrowerOrEqual`, `narrowestScope`, `UNSCOPED` and `DENY_ALL` — **all four already populate `solutionIds`**, and none needs a row to exist |
| `PARTNER_CAPABILITY_MASK` · `effectivePartnerCapabilities` · `PartnerGrantTerms` · `PartnerAccessScopeKey` | Four exports, zero screens, **invariant 2's entire enforcement**. The masks contain neither `approve_resolution` nor `execute_resolution` nor `view_summary` — the invariant expressed as an absence |
| `SubjectIndexEntry` · `SubjectKeyScheme` · `SubjectLocation` | A **write-side** obligation. Skip it and erasure later needs a full-store backfill over rows whose subjects must be reconstructed |
| `AuditEvent` · `DataAccessEvent` · `UsageRecord` chains | Invariant 10 says an act with no authorisation is unrecordable. **There is no retrofitting an audit trail for acts never recorded** |
| `validateProcedureInjectionSafety()` | Zero call sites today and the most load-bearing function in the model. It moves from a would-be HTTP operation to a **CI check on pack publication**. If CI does not call it, invariant 6 has one enforcement instead of two |
| `model/identity.ts`, all 14 exports, imported by nothing | Under the declaration ruling it needs **zero edits**, and it is where invariant 2's compensating assertion belongs |
| `correspondence.ts` whole, 12 exports | `Finding.dc.html` `evidence[2]` is a vendor reply tagged *"unsupported"* being weighed as evidence — the inbound trust boundary, drawn, as one row |
| `ProcedureStepExecution` whole | See §2.6 |
| `examples.ts` both worked domains | `PRODUCT.md:62,67` names KYC as worked example #2, demonstrated |

---

## 8. What becomes expensive to add back, ranked

1. **Anything hashed.** E4 canonicalisation is irreversible after the first hash —
   re-canonicalising means re-chaining the history the chain exists to protect.
   G20 picks RFC 8785 / JCS; it is **not applied**.
2. **The signed pack body's field set.** Adding a field after the first signature
   invalidates every prior signature. The trigger is **the first signature**, not
   the first canvas — so dropping the builder defers this by **zero days**. G37
   forks the schema instead; do **not** reserve a palette field now.
3. **The subject index and the cost-centre projection.** Column additions today,
   backfills-from-a-changed-policy tomorrow.
4. **Org derivation.** Retrofitting `OrgClass` after sessions exist is
   `docs/access-and-agency.md` §9.4d's failure mode with real users in it.
5. **Capabilities.** Each one is a platform release. `view_metering` and
   `view_commercial` should be minted in step 2 of the plan or pay for a
   re-release.
6. **Cheap, by contrast:** `presentation.ts`, the quality scorers, the partner
   billing block, `deployment.ts` — one commit each, because nothing was deleted.

---

## 9. Counts asserted elsewhere that this pass makes stale

Marked here rather than rewritten in place, per the repository's standing posture.

- **`POLICY_KINDS` is 7 declared, 5 live.** Any statement of "four kinds" is wrong;
  `modelUse` is restored.
- ~~**`model/` has 16 `.ts` files, not fourteen.** `HANDOFF` §9 and the
  verification block both say fourteen.~~ ✅ **CLOSED 7 Aug 2026.** Both now say
  sixteen, and `tools/check-doc-counts.mjs` derives the number rather than
  leaving it re-typed — which was the actual finding, since this had gone stale
  on three separate days.
- **CLAUDE.md invariant 7's ⚠️ names three bare model-identity fields.** The
  inventory was nine; six survived to this pass; four are branded here. Neither
  three nor "closed" is accurate.
- **CLAUDE.md invariant 5's middle clause** — *"which is why `metering` is its own
  resource class"* — reads as though a capability routes through it. **None does,
  and none did before the trim.**
- ~~**CLAUDE.md's fourth-axis paragraph** says thirty-four capabilities.~~
  ✅ **CLOSED 7 Aug 2026** — it was corrected to **thirty-six** with the E1 mint,
  and it will read thirty-seven when G26's `arm_connection` lands. Six
  `AssignmentScope` dimensions stays true, for a reason unrelated to `Solution`
  existing.
- **Invariant 9 needs a ⚠️**: no automated rollback exists in v1; the rule is
  declared and unexercised. `AUTOMATED_ROLLBACK_EXISTS` is the marker.
- **`TelemetryPlane` is not a third axis.** It is a bare alias of `OrgClass`, and
  `SpanAttributePolicy.visibleTo` is one-valued in v1.

---

## 10. What the demo loses, in one list

> 🛑 **G48, 7 Aug 2026 — this list is the trim's acceptance test and v1 is a
> product.** Two of the ten stop being acceptable under a product reading, and
> `docs/HANDOFF.md` §3a argues both:
>
> - **Item 5 (no Save on Tier 2).** Tier 2 is the firm's business logic — owned by
>   finance, versioned, audited. A demo can show a greyed Save; a product whose
>   premise is that a tolerance is a signed judgement cannot ship without one.
>   Traces to the missing `administration.openapi.yaml`, which is now **the thing
>   v1 is blocked on** rather than the top of a list.
> - **Item 4 (no partner anything).** *"Zero drawn screens lost"* is the demo test
>   passing. The partner-resell motion is confirmed product truth in `PRODUCT.md`,
>   and **0 of 18 screens mention a partner** — the same hole G28 names as the
>   taxonomy's missing fourth axis.
>
> **Item 10 keeps its reasoning intact.** No rate card because `PRODUCT.md` forbids
> fabricating pricing is an evidence argument, not a demo argument, and G48 supplies
> no pricing. The other seven are unre-tested.

1. No dashboard builder and no Panels screen — including build-a-card-by-chatting,
   which nothing else replaces.
2. No agent authoring, and no four-eyes harness approval on screen. If a prospect
   asks *"can we teach it our own agent?"*, v1's answer is no.
3. No automatic escalation on a finding.
4. No partner portal and no partner login — **zero drawn screens lost**, the entire
   partner go-to-market deferred to a named human and a spreadsheet.
5. Customers cannot save on Reconciliations or Document Types; every Save button is
   hidden or greyed with a reason.
6. One currency.
7. No rollout or canary.
8. No knowledge graph.
9. No BYOA — the software runs in 1CloudHub's account only.
10. No invoicing surface, and no rate card. This one is a feature: `PRODUCT.md`
    forbids fabricating pricing, and a populated rate card in v1 could only be a
    fabrication.

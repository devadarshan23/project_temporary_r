# Identity classification — the input to the G21 sweep

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** NO — it classifies identity; it decides no scope.
> Deliberately not maintained, and it has drifted: **the extractor now reads more value objects than this file classifies** — run `node tools/planner/extract.mjs` and compare the `entity_without_identity` gaps. `docs/INDEX.md` open items names the ones beyond this snapshot. **New candidates surfacing is the sweep working, not a defect** — but none of them has been classified, and none should be folded into this file's list without someone deciding.
> *Banner added 8 Aug 2026; the line below already said "a snapshot, not maintained".*

> Generated 2026-08-07 against `156ababf`. **A snapshot, not maintained.**
> Regenerate the graph with `node tools/planner/extract.mjs` and re-derive if `model/` moves.

Decision **G35**: a machine-produced timed record gets its own identity by default.
Combined with the containment rule, that classifies all 55 interfaces that carry
branded references without an `id` of their own.

## The test, in order

1. **Is it held as a field type by something else?** Containment is the definition of a value object. → value object.
2. **Does it record an act** — a timestamp *and* an actor? → entity.
3. **Does it carry a timestamp at all?** → entity, per G35.
4. **Otherwise** it is a computed view. → value object.

## Entities — need an `id` and a branded `Id<'X'>` (15)

| Type | Module | Why |
|---|---|---|
| `ApprovalDecision` | `domain` | records an act (timestamp + actor) |
| `ChainAnchor` | `governance` | timed record — G35 |
| `CommissionAttestation` | `billing` | timed record — G35 |
| `DataPlaneHealth` | `deployment` | timed record — G35 |
| `DataPlaneHeartbeat` | `deployment` | timed record — G35 |
| `ErasurePlan` | `governance` | timed record — G35 |
| `GateResult` | `evaluation` | timed record — G35 |
| `InstalledPack` | `domain` | records an act (timestamp + actor) |
| `LearningRetraction` | `learning` | records an act (timestamp + actor) |
| `Membership` | `domain` | records an act (timestamp + actor) |
| `NominationReview` | `learning` | timed record — G35 |
| `PackQualityReport` | `evaluation` | timed record — G35 |
| `PartnerTelemetryAccess` | `observability` | timed record — G35 |
| `TraceRef` | `observability` | timed record — G35 |
| `UsageAttestation` | `billing` | timed record — G35 |

## Value objects — no `id`, held by containment or computed (40)

| Type | Module | Why |
|---|---|---|
| `AccessExtension` | `governance` | held as a field type |
| `AccessResourceGrant` | `governance` | held as a field type |
| `AgentEvalBinding` | `agents` | held as a field type |
| `AgentModelBinding` | `agents` | held as a field type |
| `AgentViolation` | `agents` | held as a field type |
| `AssignmentScope` | `access` | held as a field type |
| `AutonomyDecision` | `policy` | held as a field type |
| `AutonomyProposalOutcome` | `policy` | held as a field type |
| `CardFilter` | `presentation` | held as a field type |
| `ContentGuardrailConfig` | `policy` | held as a field type |
| `Correction` | `learning` | held as a field type |
| `CostAttribution` | `billing` | computed view, no timestamp |
| `CostReconciliation` | `billing` | computed view, no timestamp |
| `DecisionVia` | `access` | held as a field type |
| `DerivedAgentGrant` | `agents` | held as a field type |
| `DisclosureRecord` | `correspondence` | held as a field type |
| `EffectivePolicySet` | `policy` | computed view, no timestamp |
| `EvaluationTerms` | `domain` | held as a field type |
| `ExceptionReversal` | `domain` | held as a field type |
| `InjectionProbeResult` | `evaluation` | computed view, no timestamp |
| `KnowledgeEdge` | `learning` | computed view, no timestamp |
| `LearningNominationOutcome` | `learning` | held as a field type |
| `LearningScope` | `learning` | held as a field type |
| `NominationEvidence` | `learning` | held as a field type |
| `ObservedValue` | `domain` | held as a field type |
| `PartnerBillingSummary` | `billing` | computed view, no timestamp |
| `PartnerGrantTerms` | `access` | held as a field type |
| `PartnerHealthView` | `observability` | computed view, no timestamp |
| `PartnerTenantFacts` | `billing` | held as a field type |
| `PartnerTenantLineBase` | `billing` | held as a field type |
| `PlatformAgentEvalFloor` | `agents` | held as a field type |
| `PlatformMarginLine` | `billing` | computed view, no timestamp |
| `PopulationSpec` | `domain` | held as a field type |
| `PrincipalContext` | `access` | held as a field type |
| `QualityWindow` | `evaluation` | computed view, no timestamp |
| `RatedTotal` | `billing` | held as a field type |
| `ResolvedCard` | `presentation` | held as a field type |
| `ResourceRef` | `access` | held as a field type |
| `SourceSlot` | `domain` | held as a field type |
| `SpendConfig` | `policy` | held as a field type |

## The two worth arguing with later

- **`DataPlaneHeartbeat`** takes an id under G35 and is the one that costs: a
  high-frequency time series across a fleet, where nothing points at an individual
  row. If the schema pass wants to revisit one entry, it is this one.
- **`KnowledgeEdge`** classified as a *computed view* only because it carries no
  timestamp. It is `TenantScoped` and it is a learned graph edge. **The missing
  timestamp is probably itself the defect** — a learned edge that cannot be aged,
  audited or retracted by date. Raised here rather than silently classified.

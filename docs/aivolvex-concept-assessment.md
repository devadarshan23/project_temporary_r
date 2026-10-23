# AIVolveX Architecture — Concept Assessment for ReconcileAI

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — an assessment of somebody else's architecture draft, read once and never re-read.
> It is an input to a decision, not a decision: the decision it fed is `docs/platform-adoption.md` (ReconcileAI is a standalone platform). The source PDF has left the trunk and is retrievable only from a tag. It cites `SupportAccessGrant`, a type since renamed `TenantAccessGrant`.
> *Banner added 8 Aug 2026.*

> **Source:** `archive/design-record:docs/aivolvex_architecture_document.pdf` —
> v0.3 working draft, May 2026, 28 pages, read in full. The PDF left the trunk on
> 6 Aug 2026; retrieve it with
> `git show archive/design-record:docs/aivolvex_architecture_document.pdf > /tmp/aivolvex.pdf`.
> It is a binary, so `git show` must be redirected to a file rather than read in
> the terminal.
> **Status:** never implemented. Reason given by the product owner: **lack of
> funding**, not a structural failure. The ideas were untested, not rejected.
> **Date of assessment:** 4 Aug 2026

---

## Verdict

**Adopt the artefact model. Do not adopt the tenancy substrate. Rework one facet.**

The document is describing a different product — a control plane for *arbitrary*
enterprise agents, where ReconcileAI is a reconciliation application. But its
central abstraction transfers almost intact, and in several places it is
**ahead of where we landed independently today**.

The most useful signal: this document and our model converged on the same
concerns without contact. Residency-as-declaration, model pinning with
fallbacks, cost attribution by cost centre, HITL thresholds, eval suites gating
promotion, compliance scope as a field. Two independent designs reaching the
same list is evidence the list is right.

---

## 1. What it proposes, in brief

**Seven-facet Agent Card.** The A2A standard declares *callability*; AIVolveX
adds five facets and enriches two so the artefact declares *deployability* —
Identity, Interface Contract, Behaviour, Dependencies, Constraints, Operations,
Governance. Extensions live under an `x-aivolvex` namespace so the underlying
card stays spec-valid. **Extension over replacement.**

**Blueprint.** The same seven-facet shape one level up, describing a business
process rather than a worker: Identity, Composition, Dependencies, Parameters,
Posture, Evaluation, Rollout. *"Blueprints are to Agent Cards what Helm charts
are to Kubernetes Pods."*

**Declaration versus deployment.** One artefact, N environment bindings. The dev
binding runs a cheap model on synthetic data with HITL off; production runs the
real model with full HITL and audit. **No re-authoring between environments.**

**Lifecycle with gates and a return path.** Eight states, every transition
gated, plus an auto-rollback arc keyed to declared triggers. Six rollout
strategies — canary, branch-wise, customer-segment, regional, blue-green,
time-based.

**Three-layer evaluation.** Component (does each agent meet its own contract),
composition (do they hand off correctly), outcome (does the business process
produce correct results).

**TypeScript SDK compiling to a canonical JSON/YAML IR**, with `plan / stage /
deploy` — the CDK pattern applied to agents.

---

## 2. What we should take

### 2.1 Blueprint ≅ SolutionPack, one level up — **the single best idea**

Our `SolutionPack` is a bundle of templates. Their Blueprint is a bundle that
also carries **rollout strategy, SLA posture, eval gates and auto-rollback
triggers**.

That gap matters precisely because of the partner motion. When finance pack v2
ships to forty tenants across six partners, we currently have no answer to:

- which tenants get it first, and in what order
- what has to pass before it moves on
- what happens automatically when it degrades on tenant nine

Their worked example rolls a Blueprint across 247 bank branches over 50 weeks.
**Substitute "tenants" for "branches" and it is our problem exactly.**

### 2.2 Three-layer evaluation — better structured than ours

Our `ScoreTarget` is flat: extraction, matching, explanation, resolution. Those
are *targets*, not *levels*. Theirs separates:

| Layer | Question |
|---|---|
| Component | Does each agent meet its own contract on golden inputs? |
| Composition | Do they hand off correctly once wired together? |
| Outcome | Does the business process produce correct business outcomes? |

And the accompanying insight is the valuable part:

> **Linear properties propagate. Quality properties do not.** Cost and latency
> sum across a chain. Accuracy does not compose into Blueprint accuracy by any
> clean maths — composition can amplify errors, dampen them, or make them
> irrelevant. Blueprint accuracy must be measured directly against Blueprint-level
> golden journeys.

We have no equivalent. Our `QualityWindow` would happily average component
scores and present a number that means nothing.

### 2.3 `rollbackTrigger: outcomeBreach` — a discipline we lack

> Auto-rollback is keyed **only** on outcome breaches. Component-only alerts
> route to the agent owner, not the rollback trigger. Otherwise every minor
> agent drift would page the Blueprint owner and signal-to-noise collapses.

Our `Scorer.alertBelow` has no such discipline. Any scorer can alert, and
nothing distinguishes "tell someone" from "stop the line."

### 2.4 Period-locked tags

> Periods are locked at close so historical tags cannot be retroactively altered.

Our `UsageRecord` is append-only, but `costCenter` is a free string with nothing
preventing a re-tag after a period closes. That silently rewrites a customer's
chargeback history. One field fixes it; we hadn't thought of it.

### 2.5 Declaration/deployment binding

We have `Tenant.environment: 'sandbox' | 'production'` — an attribute of the
*tenant*. They bind the *artefact* per environment. That is how one pack
definition serves a sandbox demo and a production tenant without divergence,
which is precisely the failure the current product has, where demo surfaces
drifted from real ones.

### 2.6 Cryptographic artefact identity

Facet 1 includes a DID and signature so the platform can verify a card is
authentic and unmodified. We have nothing for pack authenticity. For a partner
marketplace where partners author packs, that is a real gap.

---

## 3. What we should NOT take — and this is the important part

### 3.1 The "Tenancy & Tagging Substrate" is tagging, not tenancy

> Every artefact carries mandatory inherited tags: Group → Business Unit → Cost
> Centre → Team → Project. No untagged invocations are permitted.

This is an excellent **FinOps attribution** model. It is **not an isolation
model**, and the document's own framing conflates the two by naming it
"Tenancy".

Tags answer *who should be billed*. They do not answer *who may read this row*.
A tag is metadata on a record; isolation is a property enforced against a query.
Adopting this as our tenancy design would be a serious regression from what we
have — `TenantScoped`, row-level security, `effectivePartnerRole()` clamping,
`SupportAccessGrant`, and a single audited cross-tenant predicate.

**Take the hierarchy as an attribution dimension inside a tenant. Never as the
isolation boundary.** Our `costCenter` already does a simpler version of this;
their five-level inherited hierarchy is the richer form.

Related: the document has no data-subject rights, no erasure, no legal hold, no
support-access model, and no partner sub-processor concept. In a
partner-resold, PDPA-bound platform those are not optional. **We are ahead here,
and should not let the document's polish suggest otherwise.**

### 3.2 Facet 4 is built on MCP — which is out of scope

Dependencies declares "MCP servers with their own data classification", and MCP
sits in the protocols row as a foundation adoption. You removed MCP from scope
earlier today.

The *shape* of Facet 4 survives — declared dependencies, each carrying a data
classification, resolved at deployment. Only the protocol changes. Our
connections layer will carry ERP-over-OData, S3, SharePoint, Slack and Teams
instead.

### 3.3 The standards bets need re-verification before they are load-bearing

The document asserts OASF, A2A and MCP are all Linux Foundation governed under
the Agentic AI Foundation, with "150+ organisations supporting A2A as of April
2026". Written May 2026, presented as settled.

Our own licensing research today found that assumptions of exactly this kind
expire quietly — Airbyte connectors stopped being MIT on a specific date and any
plan resting on it expired that day. **Verify current governance and adoption
before adopting A2A or OASF as a schema commitment.**

### 3.4 Blueprints describe precisely what SAP's API policy prohibits

SAP API Policy v.4.2026a §2.2.2(a) prohibits API use by *"(semi-) autonomous or
generative AI systems that plan, select, or execute sequences of API calls."*

A Blueprint is a declared sequence of agent and connector calls. If SAP data
ever enters a Blueprint-driven flow, that is the clause. This is not a reason to
abandon the concept — it is a reason to keep the SAP adapter out of autonomous
composition until it is resolved in writing, and another argument for the
no-SAP direction.

---

## 4. Where the two designs already agree

Independent convergence, listed because it is the strongest evidence both are
sound:

| AIVolveX facet | Our equivalent |
|---|---|
| Constraints: region, data classification | `Tenant.residency`, `FieldSpec.dataClass` |
| Behaviour: model pin + fallback | `ModelCatalogEntry`, `ModelFallbackChain` |
| Operations: HITL trigger rules, kill switch | `AutonomyConfig`, `ApprovalConfig` |
| Governance: eval suite, audit retention, compliance scope | `Scorer`, `RetentionPolicy`, `processingPurpose` |
| Interface: per-skill cost, latency, data class | `ModelCost`, `FieldSpec` |
| Cost & Procurement: show-back, charge-back, budgets, anomalies | `CostAttribution`, `Budget`, `BudgetAlert` |
| Foundation: adopt runtimes, don't reinvent | Temporal, OTel, Langfuse per `integration-options.md` |

Their worked example even specifies `region: ap-southeast-1 . data class:
confidential (PDPA)` — the region we selected this afternoon, on the same
reasoning, without having read this.

---

## 5. Recommendation

**Extend `SolutionPack` toward Blueprint. Leave tenancy alone.**

| Change | Priority | Notes |
|---|---|---|
| `SolutionPack` gains rollout strategy, posture (SLA/cost), eval gate, rollback triggers | P1 | The partner-resold pack-update problem has no current answer |
| Three-layer eval: add `ScoreLevel` (component/composition/outcome) alongside `ScoreTarget` | P1 | And forbid aggregating component scores into an outcome number |
| `rollbackTrigger: outcomeBreach` discipline on scorers | P1 | Separate "alert the owner" from "stop the line" |
| Lifecycle state machine on packs and definitions, gated | P1 | We have three states; eight gated ones is the right shape |
| Environment binding on the artefact, not just the tenant | P2 | Prevents demo/production divergence structurally |
| Period-locked cost tags | P2 | One field; prevents silent chargeback rewriting |
| Cryptographic pack identity | P2 | Needed before partners author packs |
| Five-level attribution hierarchy inside a tenant | P2 | Richer `costCenter`. **Attribution only** |
| TypeScript SDK → canonical IR for pack authoring | P3 | Right pattern; premature until packs are numerous |
| A2A / OASF schema alignment | **Verify first** | Re-check governance and adoption before committing |

**Do not adopt:** tagging as the isolation boundary; MCP; the four-surface
product structure (that is AIVolveX's product, not ours).

---

## 6. What this document does better than ours

Recorded honestly, because the point of reading it was not to confirm our work:

1. **It thinks in artefacts.** We modelled entities and relationships; it
   modelled a *deployable thing* with a lifecycle. That framing is why rollout,
   rollback and promotion fell out naturally for them and are absent from ours.
2. **It designed for change.** Our model handles a pack existing. Theirs handles
   a pack being *updated across a fleet* — which is the harder and more common
   operational problem.
3. **The eval non-propagation insight** is genuinely subtle and correct, and we
   would probably have built the naive averaging version.
4. **"Extension over replacement"** as an explicit architectural stance, applied
   consistently. We adopted patterns from AiVolvex earlier today; this document
   articulates *why* that is the cheaper path better than our own adoption note
   does.

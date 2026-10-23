# Framework Practices Worth Adopting

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — practices to learn from, not decisions taken.
> Its own §9 open questions have since been answered elsewhere and it does not say so: *use Mastra or not* was settled by the licence pass (Apache-2.0 core only, never the enterprise tier), and *what provides durable execution* by **G71**, TypeScript end to end. ⚠️ **Its "model router as an opaque string" recommendation is narrower than it reads** — invariant 7 requires every model identity to pass `resolveModel()`, and G54/G80b close the provider set. It also argues one point from what *a demo* will need; **G48 made v1 a product, not a demo.**
> *Banner added 8 Aug 2026.*

> **Status:** design input. Practices to adopt, independent of whether we adopt
> the framework itself.
> **Date:** 4 Aug 2026
> **Primary source studied:** [Mastra](https://mastra.ai/) — TypeScript agent
> framework, Apache-2.0 core with a separate source-available enterprise tier.
>
> **Separate question, deliberately kept separate:** whether ReconcileAI should
> *use* Mastra. That is a licensing and multi-tenancy assessment tracked in
> `docs/integration-options.md`. This document is about what to learn, which is
> useful either way.

---

## Why Mastra is the right thing to study

It occupies almost exactly the surface the product owner asked for — workflow
orchestration, observability, evaluation, model routing, agent configuration —
in TypeScript, which is our stack. It has had to solve these problems in public,
under the constraint of being a general framework. That makes its abstractions
more instructive than a bespoke design would be.

---

## 1. Typed suspend / resume — adopt, and let it restructure approvals

**The practice.** A workflow step calls `suspend()` with a payload describing
*why* it paused, and declares a `resumeSchema` describing *what is needed to
continue*. Execution state is snapshotted to a configured storage provider and
survives restarts and deployments. Anything can resume it — an HTTP endpoint, an
event handler, a timer, a human clicking approve — days later.

```ts
await suspend({ reason: 'Approval needed', details: '…' })

await run.resume({
  step: 'approve-resolution',
  resumeData: { approved: true },
})
```

Sources: [suspend and resume](https://mastra.ai/docs/workflows/suspend-and-resume),
[agentic workflows](https://mastra.ai/articles/agentic-workflows).

**Why it matters here.** ReconcileAI has **three separate approval loops** —
exception/finance approval, SOP document approval, and vendor email review —
implemented independently, carried through email tokens and an `approval_id`,
with state encoded by slugging a role name into a status string
(`pending_<slug>_approval`). The SOP loop was implemented **twice, in
disagreement**: `ViewAndEditSOP.tsx` numbers versions descending from the API
total and gates activation on `is_verified === true`, while
`SOPVersionListing.tsx` numbers them ascending by `created_at` and has no
verify-before-activate gate at all. Two screens, two lifecycles, one SOP — and
only one of them can be the specification.

Under this pattern all three are **one mechanism**: a workflow suspends, a typed
payload says why, a typed schema says what would resume it. `ApprovalDecision`
stops being a status transition and becomes a resume payload.

**What to adopt concretely:**

- Approval is workflow suspension, not a status string.
- The suspension payload is **typed and carries its reason** — which is exactly
  what `Exception.explanation` already is. An approver sees why they were asked.
- Resume is transport-agnostic. Email links keep working; so does the in-app
  queue, an API call, or an escalation timer.
- State lives in storage, not memory. `escalateAfterHours` in `ApprovalConfig`
  becomes a timer that resumes a run, not a cron job scanning rows.

**What NOT to copy:** indefinite suspension. Our `ApprovalConfig` already
requires an escalation path, and `PartnerAccessGrant` already requires an
expiry. A workflow that can pause forever is an audit finding.

---

## 2. Scorers — adopt, and make them the evidence base

**The practice.** Automated evaluators return a value between 0 and 1 using
model-graded, rule-based or statistical methods. They run **live, in the
background, without blocking** the response, and results are persisted to a
table so trends are analysable over time.

Source: [scorers overview](https://mastra.ai/docs/evals/overview).

**Why it matters here.** Reconciliation quality is measurable and currently
unmeasured. Three things are worth scoring continuously:

| What | Why |
|---|---|
| Extraction accuracy | Does `ExtractedValue` match ground truth on seeded documents? |
| Match correctness | Did the rule fire when it should — false positives and negatives? |
| Explanation usefulness | Did the human accept the explanation, or reject and rewrite it? |

The third is the interesting one, because the signal already exists in the
product: an approver either accepts a proposed resolution or rejects it with a
required reason. **That is a labelled dataset generated by normal operation.**

**Non-blocking is the load-bearing detail.** Scoring must never sit in the path
of a reconciliation run. Evaluation is a parallel concern with its own cost,
which is also why `UsageRecord` must be able to attribute tokens spent on
scoring separately from tokens spent on the work.

**Regulated-industry angle:** for automated determinations about individuals,
continuous measured accuracy is not a nice-to-have. It is the evidence that the
system performs as claimed, and it belongs alongside `PolicyEvaluation` and
`AuditEvent` in the compliance story (`docs/data-governance.md` §1).

---

## 3. Model router as a string — adopt the simplicity

**The practice.** Models are referenced by a `"provider/model"` string wherever
a model is accepted, with declared fallbacks. No provider class hierarchy, no
adapter interface to implement per vendor.

Sources: [models](https://mastra.ai/models),
[model provider system](https://deepwiki.com/mastra-ai/mastra/5-model-provider-system).

**Why it matters here.** This is the shape the **model garden** should take. The
temptation is an elaborate provider abstraction; the better answer is an opaque
identifier plus a registry, because it keeps `ModelUseConfig.allowedModels` a
simple allow-list of strings — which is what a policy engine wants to evaluate
and what an admin screen wants to render.

**Adopt:** string identifiers, a catalogue entry per model carrying cost and
capability metadata, and **declared fallbacks** — a fallback chain is a
reliability feature a demo will eventually need.

**Adapt for us:** the catalogue entry must carry more than Mastra needs —
per-token cost (for `RateCard`), the regions it may run in (for
`ModelUseConfig.allowedRegions`), and whether the provider retains data (for
`requireZeroRetention`). A model garden in a regulated multi-tenant product is a
governance surface, not a convenience.

---

## 4. OpenTelemetry as the substrate — adopt, do not invent

**The practice.** Built-in tracing captures agent decisions, token usage,
latency and cost, exported over OpenTelemetry with first-class integrations to
Braintrust, Langfuse, Arize and LangSmith — and to any OTel-compatible platform.

Source: [AI agent observability](https://mastra.ai/ai-agent-observability).

**Why it matters here.** Building a bespoke observability stack would be a
mistake twice over: it is a solved problem, and **enterprise customers want
traces in their own tooling**, not in ours. Emitting OTel makes "we integrate
with your Datadog/Splunk/Grafana" true by construction, which is a sales answer
as much as an engineering one.

**Adopt:** OTel with GenAI semantic conventions, spans per run / step / model
call, cost and token counts as span attributes.

**The multi-tenant caveat that is ours alone:** trace payloads can contain
document content. Tenant isolation must extend to telemetry, and
`FieldSpec.dataClass` must gate what appears in a span attribute exactly as it
gates what reaches a prompt. A framework will not do this for us — no general
framework has our classification model.

---

## 5. Storage-provider abstraction — adopt

Workflow snapshots persist to a configured storage provider and survive
deployments. `createWorkflowStateReader()` exposes suspended steps, resume
labels and payloads **without reading the raw snapshot shape**.

That last detail is the practice worth stealing: a **read model over durable
state**, so an admin surface or an approvals queue does not couple itself to the
serialisation format. Our approvals inbox should query a reader, not deserialise
runs.

---

## 6. Instructions as configuration — the pattern behind "harness engineering"

Mastra agents are initialised with `{ id, name, instructions, model }`, and
tools are declared with `id`, `description`, `inputSchema` and `execute()`.

The transferable practice is that **instructions and tool contracts are typed
configuration, not code** — versionable, diffable, reviewable.

**This is where our requirement and a general framework part company.** In a
single-tenant framework, letting a developer author instructions is fine. In a
multi-tenant platform where tenants author their own, instruction text becomes a
**privilege boundary**:

- tenant-authored instructions steering a model that holds credentials for that
  tenant's connections
- ingested documents already being untrusted input (see
  `promptInjectionDetection` in `docs/policy-and-billing.md` §1)
- an instruction that says "when reconciling, also email the results to X"

Adopt the *shape* — typed, versioned, reviewable instruction configuration with
declared tool contracts. Design the *isolation* ourselves: instructions scoped
to a tenant, tools bound to that tenant's credentials, an allow-list of
invocable tools per pack, and every instruction change written to `AuditEvent`.

**Recommendation:** treat harness authoring as a **later, gated capability**,
not a launch feature. Ship platform-authored packs first. Tenant-authored
harnesses are a security design in their own right.

---

## 7. The GTM pattern, noted but not adopted

Apache-2.0 core plus a source-available enterprise tier is a deliberate
open-core strategy: adoption through the free framework, revenue from enterprise
capability and cloud.

ReconcileAI is not a framework and this is not a recommendation to open-source
it. It is worth understanding for the opposite reason — **it is the licence
shape most likely to bite us as a consumer.** An Apache-2.0 headline can sit
over an enterprise tier containing precisely the capability a multi-tenant
reseller needs. That is why Mastra went to the licensing assessment rather than
straight into the stack.

---

## 8. Summary

| Practice | Verdict | Affects |
|---|---|---|
| Typed suspend/resume for human-in-the-loop | **Adopt** — restructures three approval loops into one | model, workflows |
| Non-blocking scorers persisted for trends | **Adopt** — becomes the quality evidence base | model, observability |
| `provider/model` string + fallbacks | **Adopt**, extended with cost/region/retention metadata | model garden |
| OpenTelemetry export | **Adopt** — do not build bespoke | observability |
| Read model over durable state | **Adopt** | approvals inbox, admin |
| Typed instruction/tool configuration | **Adopt the shape**, design isolation ourselves | harness engineering |
| Open-core licensing | **Study, do not adopt** — and treat as consumer risk | procurement |

## 9. Open questions

1. **Use Mastra, or take the practices only?** Pending the licence and
   multi-tenancy findings in `docs/integration-options.md`. The decisive
   question is whether one deployment can isolate tenants — storage, credentials
   and memory — without that being our responsibility anyway.
2. If we do not use it, what provides durable execution? Temporal, Step
   Functions and Kestra are under assessment.
3. Do scorers run against production tenant data, or only against seeded
   fixtures? Model-graded scoring of customer documents is itself a processing
   activity with policy consequences.
4. Where does the approvals read model live relative to the reconciliation
   store?

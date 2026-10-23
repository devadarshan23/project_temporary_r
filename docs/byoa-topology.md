# Customer-Owned Data Plane (BYOA)

> **STATUS:** SUPERSEDED
> **V1 AUTHORITY:** NO — **BYOA is out of v1 entirely.**
> **Successor:** `docs/data-architecture.md` — it supersedes this file's §8 open questions, and corrects §3's three deployment modes to two. **And the premise itself moved: G36 slips BYOA to v1+1**, which is why `model/deployment.ts` is `@dropped-for-v1` whole. G86 then ruled that per-tenant BI workspaces get new types rather than a restore of that module, so nothing here returns by that route either. Read this for the reasoning — it is good reasoning — not for what v1 does.
> *Banner added 8 Aug 2026.*

> **Status:** architectural exploration, 4 Aug 2026.
> **Proposition:** the data plane runs in the **customer's** AWS account. The
> control plane and governance mechanisms stay in **1CloudHub-owned** accounts.

---

## 0. Why this is worth taking seriously

It dissolves four problems we have been working *around* rather than solving,
and it does so by moving a boundary rather than adding machinery.

Precedent exists and is not exotic: Snowflake's early architecture, Databricks,
Confluent BYOC, and most enterprise data platforms sold into regulated sectors
offer a customer-hosted plane. The pattern is well understood by the buyers we
are targeting — which is itself a sales advantage.

---

## 1. What it solves

### 1.1 Residency stops being our problem

`Tenant.residency`, the `apac.*` versus `global.*` inference-routing trap, the
PDPA Transfer Limitation Obligation, the whole `ap-southeast-1` argument —
these become **the customer's configuration in the customer's account**. Their
region, their choice, their compliance posture. Data never crosses a boundary we
control because it never enters one.

### 1.2 Erasure becomes tractable

This is the biggest win. The red team's most confident finding was that purging
a `SourceDocument` does not remove the personal data, because `Explanation`
stores a copy and is retained longer. We modelled `SubjectIndexEntry`,
`LegalHold` and `purgeVerdict()` to make erasure *executable* — and still could
not solve backups, where a 35-day PITR window outlives a deletion request.

Under BYOA, **the customer holds their own backups**. We supply the mechanism;
they hold the data and the retention decision. "Delete everything" becomes a
stack deletion in an account they own — an operation with an unambiguous
completion state, which is exactly what the current design lacks.

### 1.3 The controller/processor question changes shape ⚖️

If personal data never enters a 1CloudHub account, our role looks materially
more like **supplying software** than **processing data**. That is a different
contractual position with a different liability profile.

This is precisely the kind of legal determination I should not assert. But it is
the single most consequential consequence of the proposal, and it is worth
putting in front of counsel early rather than late.

### 1.4 Isolation becomes an AWS account boundary

Today isolation rests on row-level security, `effectivePartnerRole()` clamping,
and a single audited cross-tenant predicate — all correct, all ours to get right,
all capable of being broken by one bad query.

An **account boundary is the strongest isolation primitive AWS offers.** No RLS
bug leaks across it. The red team's entire §1 line of attack largely evaporates,
because there is no shared table to leak from.

### 1.5 The volume question you raised evaporates

~94M rows a month was an aggregate across forty tenants in one database. Under
BYOA it is ~2.4M a month in each customer's own instance — an unremarkable
PostgreSQL workload with no partitioning strategy required and no argument for a
second engine.

### 1.6 The COGS problem inverts

Green team 3's biggest commercial finding was that the platform could price a
rate card but had no type recording what anything **cost** it — with a failure
mode of negative contribution per token discovered when someone reads the AWS
bill.

Under BYOA, **inference and storage land on the customer's bill.** We sell
software and charge for it. `ProviderCostRecord` and `PlatformMarginLine` stop
being existential and become a much smaller concern confined to the control
plane's own footprint.

---

## 2. What it costs

Honest accounting. These are not minor.

### 2.1 Fleet operations become the core engineering problem

Shipping pack v2 stops being a deployment and becomes **N deployments into
accounts we do not control**, each of which may be a different version, may have
drifted, and may fail independently.

This is the reason most vendors quietly retreat from BYOC after a few years.

**But note:** this is *exactly* what the Blueprint concepts we folded in this
morning solve. `PackLifecycleState`, `PackRollout`, `RolloutStrategy`,
`RollbackTrigger` and `PackBinding` were adopted as good practice. Under BYOA
they stop being good practice and become **the load-bearing mechanism**. A
`tenant_wise` rollout with `autoRollback` armed is not a nice-to-have when the
target is 40 customer accounts.

That the model already carries them is fortunate rather than clever.

### 2.2 Metering integrity — the hard one

We would meter usage in an account we do not control. A customer could
under-report; more likely, agents fail, clocks skew, and records are lost.

`UsageRecord.idempotencyKey` helps with duplication but not with trust.

Two viable approaches:
- **Meter at the control plane's own surface.** Anything requiring a
  control-plane call — pack activation, policy fetch, model resolution — is
  countable by us directly.
- **Signed attestation.** The data plane signs periodic usage attestations with
  a per-deployment key; the control plane verifies and stores them. Tamper is
  detectable, not impossible.

Neither is free. **This is the sharpest engineering cost of the proposal.**

### 2.3 Observability inverts

We cannot see into their account by default. Telemetry must be **pushed out**,
and that push is a data egress crossing an account boundary.

`TelemetryPolicy`, `SpanAttributePolicy` and `TelemetryExport` already model
this — but under BYOA `SpanAttributePolicy` stops being an internal hygiene
control and becomes **the contract boundary**. What we are permitted to see is
the customer's decision, declared in policy, enforced at their edge.

That is a better design than the one we have. It is also more work.

### 2.4 Support access becomes cross-account — and improves

`SupportAccessGrant` becomes an IAM role assumption into the customer's account,
with an external ID, time-boxed by session policy.

**This is strictly better than what we designed.** Their CloudTrail records
every action we take, in their account, outside our control. Two-person approval
plus a customer-visible trail they own is a stronger claim than any audit table
we maintain about ourselves.

### 2.5 It excludes small customers

BYOA requires the customer to have an AWS account, cloud competence, and
appetite for operating infrastructure. Most SME buyers have none of these, and
demo prospects certainly do not.

**So BYOA cannot be the only model.**

---

## 3. The recommendation — three deployment modes, not one

```
┌──────────────────────────────────────────────────────────────┐
│  1CloudHub CONTROL PLANE  (ap-southeast-1)                   │
│                                                               │
│  packs · templates · model catalogue · rate cards            │
│  policy authoring · rollout orchestration · attestation       │
│  partner views · billing aggregation · admin                  │
│                                                               │
│  Holds NO customer reconciliation data in BYOA mode.          │
└──────────────────────────────────────────────────────────────┘
     │ distributes packs + policy      ▲ telemetry + attestation
     ▼ assumes support role            │ (classified, allow-listed)
┌───────────────┐ ┌───────────────┐ ┌───────────────────────────┐
│ SANDBOX       │ │ HOSTED        │ │ BYOA                      │
│ 1CH account   │ │ 1CH account   │ │ CUSTOMER account          │
│ multi-tenant  │ │ multi-tenant  │ │ single-tenant             │
│ synthetic     │ │ RLS isolation │ │ account isolation         │
│ only          │ │               │ │                           │
│               │ │ for SMEs and  │ │ for regulated, large, or  │
│ demos, POCs   │ │ partner-sold  │ │ residency-bound customers │
└───────────────┘ └───────────────┘ └───────────────────────────┘
```

**All three run the same packs, the same policy engine, the same model.** The
difference is *where the data plane sits* and *who owns the account*.

That is the point. `PackBinding` already expresses per-environment deployment of
one declaration; this extends the same idea to per-*topology* deployment.

### Why three rather than two

- **Sandbox** must stay in our account — a demo prospect will not provision AWS.
- **Hosted** is required for SMEs and most partner-sold customers, and is the only mode where the partner motion works simply.
- **BYOA** is what wins regulated enterprise deals and is the answer to every hard question in §1.

It is also a natural **pricing ladder**, which is commercially convenient rather
than accidental.

---

## 4. Where policy is evaluated — the key design question

If policy evaluation happens in the control plane, every reconciliation
round-trips to us: latency, an availability dependency, and we see request
metadata we claimed not to hold.

If it happens in the data plane, we ship the engine — and must then trust it.

**Answer: author centrally, distribute, evaluate locally, attest back.**

| Stage | Where |
|---|---|
| Policy authored and versioned | control plane |
| Policy distributed, signed | control plane → data plane |
| Policy **evaluated and enforced** | **data plane** |
| `PolicyEvaluation` written | data plane |
| Signed summary attested | data plane → control plane |

This is the OPA model, and the AWS Config model. It keeps the hot path local, it
keeps the customer's data local, and it gives us a verifiable claim that policy
v4 was in force at a given time without us seeing what it decided about.

It also **resolves the volume argument entirely**: `PolicyEvaluation` at 1.41M
rows a month stays in the customer's own database, and only a signed periodic
summary crosses to us.

---

## 5. What changes in the model

Smaller than expected, because the layering already anticipated it.

```ts
/** Where a tenant's data plane physically runs. */
export type DeploymentMode = 'sandbox' | 'hosted' | 'byoa'

/** A customer-owned data plane the control plane addresses but does not hold. */
export interface DataPlane {
  id: string
  tenantId: TenantId
  mode: DeploymentMode
  /** Null for sandbox and hosted — those run in 1CloudHub accounts. */
  awsAccountId: string | null
  region: RegionKey
  /** Cross-account role we assume, with an external id. Never a static key. */
  supportRoleArn: string | null
  externalId: string | null
  /** Deployed pack versions, so drift across the fleet is visible. */
  installedVersions: Record<string, number>
  /** Verifies signed attestations from this plane. */
  attestationPublicKey: string
  lastAttestationAt: Timestamp | null
  health: 'healthy' | 'degraded' | 'unreachable' | 'drifted'
}

/** A signed claim from a data plane about what it did. */
export interface UsageAttestation {
  dataPlaneId: string
  periodFrom: Timestamp
  periodTo: Timestamp
  /** Aggregate counts only. No content, no identifiers. */
  totals: Record<Meter, number>
  policyVersionInForce: number
  packVersionsInForce: Record<string, number>
  signature: string
  verifiedAt: Timestamp | null
}
```

`Tenant` gains `deploymentMode` and a `dataPlaneId`. Everything else — packs,
policies, rollouts, bindings, support grants, telemetry policy — already works,
because they were designed against a control-plane/data-plane split that was
logical and now becomes physical.

**That the logical layering maps cleanly onto an account boundary is the
strongest available evidence the layering was right.**

---

## 6. What gets harder for the partner motion

Three-party account topology is genuinely awkward and needs a decision:

| Question | Options |
|---|---|
| Whose account hosts a partner-sold BYOA customer? | End customer's (cleanest) · partner's (partner becomes an infrastructure provider, and unambiguously a sub-processor) |
| Can a partner see across its customers' data planes? | Only via `PartnerAccessGrant` **and** a cross-account role in each — which the customer must grant |
| Who operates the deployment? | 1CloudHub, with the partner reselling · or partner-operated, which raises support and SLA questions |

**Recommendation: partner-sold customers default to `hosted`.** BYOA is a
direct-sale motion, or a deliberate escalation for a large partner-sourced
customer with its own cloud team. Trying to make BYOA the default for the
partner channel imports the operational cost of BYOA into the motion least
equipped to carry it.

---

## 7. Honest verdict

**Adopt as a mode, not as the architecture.**

BYOA answers the hardest questions in this design — residency, erasure,
isolation, controller/processor posture, and the volume concern — by moving a
boundary rather than adding machinery. For regulated enterprise buyers it is
also the single most persuasive thing on a security review.

It costs fleet operations, metering trust, and inverted observability. Two of
the three are already largely modelled; the metering-trust problem is new and
real.

The three-mode topology is the shape that survives contact with all the
constraints: sandbox because demos must be frictionless, hosted because SMEs and
the partner channel need it, BYOA because it wins the deals that justify the
platform.

---

## 8. Open questions

1. ⚖️ **Does a customer-owned data plane change our controller/processor status?** The most consequential question here, and squarely for counsel.
2. **Metering trust model** — control-plane-observed, signed attestation, or both. Sharpest engineering cost.
3. **Who pays for inference in BYOA?** Their Bedrock bill is the natural answer and inverts the COGS problem — but it also means we cannot bundle inference into a per-reconciliation price.
4. **Upgrade consent.** Can we push pack v2 into a customer account, or must they approve each rollout? Regulated customers will want approval; that makes `PackRollout` a negotiation rather than a schedule.
5. **What happens when a data plane goes dark?** Billing, support obligations, and whether the customer's data is recoverable by us at all (it should not be).
6. **Minimum viable BYOA footprint** — Aurora + S3 + Lambda + Bedrock in a CDK stack. Cost floor per customer determines the smallest deal BYOA makes sense for.

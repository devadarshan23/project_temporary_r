# Day 2 — Operating the Fleet

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** NO — **its stated premise is out of v1.**
> The file says in its own header that *"the first non-demo customer is a regulated enterprise on a customer-owned data plane. Everything hard below follows from that."* **G36 slips BYOA to v1+1**, so the premise the whole document follows from does not hold for v1: the fleet, the heartbeat, liveness, engine and schema versions are `model/deployment.ts`, `@dropped-for-v1` whole. Its non-BYOA halves — observability, releases, metering integrity, inference economics, and the model deltas in §9 — are the parts that survive, and delta 22 still constrains the unwritten `model/connections.ts`. Read for the reasoning; do not read it as v1 operations.
> *Banner added 8 Aug 2026.*
> ⚠️ **PARTLY ANSWERED, 18 Sep 2026 — `docs/tech-stack.md` §12–§13.** Three of
> the things this file asks for now have rulings: observability (**G261** —
> logs, metrics, alarms and X-Ray declared in CDK, and a log line carrying ids,
> codes, counts and durations only), image hardening (**G262**) and secrets
> (**G263**). **What this file raises and the successor does NOT answer is the
> largest day-2 gap and is unchanged: engine releases are still unmodelled**
> (§3.1), and forward-only expand/contract migrations (§3.2) must be adopted
> before the first deployment or not at all — which the `infra/` slice makes
> imminent rather than theoretical.

> **Status:** design record. 4 Aug 2026.
> **Follows** `docs/data-architecture.md`, which decided the shape. This asks
> what it costs to run once customers are on it.
> **Premise:** the first non-demo customer is a regulated enterprise on a
> customer-owned data plane. Everything hard below follows from that.

---

## 0. The one-sentence version

Day 1 asks where the data lives. **Day 2 asks what you can see, what you can
change, and what you can prove** — and in a customer-owned account the honest
answers are *less than you expect*, *only with permission*, and *only if you
designed for it before you shipped*.

Four areas. Observability and troubleshooting are **survivable with discipline**.
Releases have a **structural gap in the model**. Metering has **one idea that
solves three problems at once**, and it needs to be built in from the start
because it cannot be retrofitted into deployed customer accounts.

---

## 1. Observability — you see shape, not content

### 1.1 What inverts

| | Hosted | Customer-owned |
|---|---|---|
| Telemetry backend | Ours | Theirs, pushed to us |
| What we see | Everything, minus `TelemetryPolicy` redaction | Whatever `SpanAttributePolicy` permits |
| Who decides | Us, with a policy the customer can tighten | **The customer.** It is the contract boundary |
| Silence means | The system is idle or down | Idle, down, firewalled, or the exporter broke |

`SpanAttributePolicy` was designed as internal hygiene — an allow-list so a
`vendor` or `cost_center` attribute does not leak across tenants. Under BYOA it
becomes **the interface through which we operate the service**. That is a
promotion it was not designed for.

### 1.2 The floor problem ⚠️

**`SpanAttributePolicy` has no minimum.** A customer can set it so restrictively
that we cannot diagnose anything, and then raise a P1. Observability permission
and support obligation are currently independent, which means we can owe a
service we are structurally unable to deliver.

**Fix: named telemetry profiles, not per-attribute negotiation.**

| Profile | Contains | Support level it sustains |
|---|---|---|
| `minimum` | trace/span ids · error class · step name · pack id + version · engine version · duration · outcome · retry count | Fleet health and error-class triage only |
| `standard` | + definition id (hashed) · slot names · model id · token counts · queue depths | Root-cause on most failures |
| `full` | + `Explanation` attached to spans, per `TelemetryPolicy.includeExplanations` | Everything, and almost nobody will grant it |

Nothing in `minimum` is customer content. It is the smallest set from which a
failure can be *classified*, and it should be a **condition of the support SLA**
rather than a request. Negotiating forty individual attribute policies across a
fleet is not an operable position; negotiating which of three profiles applies
is.

### 1.3 Debugging from shape forces a closed error vocabulary

If content is redacted, the only diagnostic channel that survives is the
**structure** of the trace and the **class** of the error. So:

> **Every failure path emits a code from a closed vocabulary. Free text is never
> the diagnostic channel.**

The same rule governs `PolicyEvaluation.reason`. **Correction, 5 Aug:** this
document previously said that rule was already applied there; it was not, and the
field was free text until a contract review found it. It is now
`PolicyReasonCode`. One rule, two places — but one of them had to be built, not
merely cited.

The practical consequence is unglamorous and load-bearing. An error taxonomy has
to be **exhaustive before launch**, because adding a code later means shipping an
engine release to a customer account before you can diagnose the thing you just
learned about.

### 1.4 Silence must be unambiguous

`DataPlane.health` distinguishes `healthy | degraded | unreachable | drifted`.
But a customer who reconciles monthly is legitimately silent for twenty-nine
days, and an exporter that broke looks exactly the same as an idle tenant.

**Fix: heartbeat on the attestation cadence.** A data plane attests every 24
hours *whether or not it did any work*, with:

- a **monotonic sequence number**, so a missing period is detectable rather than
  merely absent;
- **zero totals** as a legitimate value, so idle is a positive statement.

The heartbeat and the meter are then the same mechanism, which is one fewer
thing to operate. See §4.

### 1.5 There is no fleet operations surface, and there needs to be

`PlatformHealthWindow` is aggregate-only, and its comment is explicit: *"never a
per-tenant breakdown on this surface."* That is the correct privacy rule and it
makes the type **useless for running a fleet.** You cannot patch, diagnose or
page against an average.

The resolution is that these are two different facts:

- **A tenant's business activity** — run counts, exception rates, volumes. Not
  ours. Aggregate freely, identify never. `PlatformHealthWindow` is right.
- **A deployment's infrastructure state** — engine version, schema version, last
  attestation, drift, error band, region. **This is our operational fact about
  our own software**, and it does not become the customer's business data by
  living in their account.

A `DataPlaneHealth` view keyed on `DataPlane` — never on `Tenant` — carries the
second without touching the first. Missing from the model; delta 8 in §9.

---

## 2. Troubleshooting — four levels, and the customer owns the ladder

### 2.1 The escalation path

| Level | Mechanism | Needs | Model support |
|---|---|---|---|
| **L0** | Telemetry and error classes | Nothing | `TraceRef`, `SpanAttributePolicy` |
| **L1** | **Customer-run diagnostic bundle** | Customer runs a command | **Missing** — delta 9 |
| **L2** | `TenantAccessGrant`, resource class `telemetry` or `configuration` | Two-person approval; customer notified; often customer approval | Modelled |
| **L3** | `TenantAccessGrant`, resource class `tenant_data` | All of L2, plus a very good reason | Modelled |

**L1 is the workhorse and it is not in the model.** In every customer-hosted
product, the bulk of diagnosis happens through a bundle the customer generates
and sends: engine and schema versions, applied migrations, pack versions in
force, configuration with secrets elided, recent error codes with counts, queue
depths, and infrastructure facts. No document content, no extracted values.

The important property is that **the customer inspects it before sending.** That
is what makes it acceptable to a security team, and it is why it beats a
persistent tap for most of what actually goes wrong.

Under BYOA, L2 and L3 are cross-account role assumptions with an external id,
time-boxed by session policy — and every action lands in **their** CloudTrail.
That is a stronger accountability claim than any audit table we keep about
ourselves.

### 2.2 The customer who cannot be supported

`Tenant.supportAccessMode: 'never'` is honoured absolutely — the comment says
support then works from telemetry alone. Combine it with a `minimum` telemetry
profile and you have a customer we can support at L0 and L1 only.

That is a legitimate posture for a bank. It is **not** a posture that should be
discovered during an incident. It has to be **priced and contracted at signing**:
a named support tier with a stated ceiling on what can be diagnosed. Today it is
a field with no commercial consequence attached to it.

### 2.3 We cannot reproduce a customer's bug — by design

We do not have their data and must not want it. So the reproduction loop cannot
be "get the failing document."

```
capture failure SHAPE (error class, span topology, rule + versions in force)
      ↓
reconstruct as a SeededExample — synthetic data, same structure
      ↓
reproduce in the sandbox (synthetic-only, enforced)
      ↓
fix; prove with a scorer; ship as a pack or engine version
```

This explains why `SeededExample` is control-plane rather than tenant-scoped: it
is the vehicle by which a customer's failure becomes a permanent regression test
for every customer without their data ever leaving their account.

> **The bug report format is a seeded example, not a log excerpt.** Support
> engineers who cannot write one will escalate everything, and the loop stops
> working.

### 2.4 Time-to-resolution is not ours to promise ⚠️

L2 and above require customer approval. Their approval latency is inside our
resolution time and outside our control.

> **The SLA commits to time-to-first-response and a documented escalation path.
> It must not commit to time-to-resolution.**

Offering a resolution SLA on a data plane you can only enter with permission is
a promise that will be broken by the customer's own change-control process, and
then argued about. State it correctly at signing and it is a non-issue.

---

## 3. Releases and patching — the structural gap

### 3.1 Two release trains are being treated as one

`PackRollout`, `PackLifecycleState`, `RolloutStrategy` and `RollbackTrigger` are
well modelled. **They cover content** — document types, definitions, match rules,
SOPs. They are the AiVolvex Blueprint concepts folded in, and under BYOA they
become load-bearing rather than good practice.

**They do not cover the engine.** The container or Lambda that runs
reconciliation, the API surface, the migrations. `DataPlane.installedVersions`
as drafted is a map of *pack* versions. There is no `engineVersion`, no
`schemaVersion`, no supported-version window, and no answer to what happens when
a customer falls outside it.

That is the largest day-2 gap in the model, and it is invisible while nothing is
deployed.

| | Pack release | Engine release |
|---|---|---|
| What ships | Declarative content | Code and schema |
| Blast radius | One domain's behaviour | The deployment |
| Rollback | `revertsTo` a prior version | Forward-only (§3.2) |
| Cadence | Frequent | Deliberate |
| Consent | Per rollout | Per version, within a supported window |
| Modelled? | Yes | **No** — deltas 10 and 11 |

### 3.2 Schema migrations must be forward-only, expand/contract

You cannot roll back a schema change in an account you cannot reach, whose
backups you do not hold, and whose PITR window is the customer's decision.

> **Every migration is additive. A column is deprecated for one full release
> before it is dropped. Engine version N runs against schema N and N−1.**

Free to adopt now; impossible to retrofit once forty deployments exist. This is
the single cheapest decision in this document and the most expensive one to
delay.

### 3.3 Security patches need a different track from features

A regulated customer's change window is measured in weeks. A critical CVE is not.
If the only upgrade path is the one that requires their approval, the answer to
"when will this be patched" is "when their change board next meets."

Two tracks, both negotiated **at signing**:

| Track | Consent model | Window |
|---|---|---|
| Feature / pack | Customer accepts each rollout | Their schedule |
| **Security patch** | **Pre-authorised, notification not approval** | **72 hours for critical**, decided 4 Aug |

Without the second, a fleet-wide vulnerability becomes forty separate
negotiations conducted under disclosure pressure. This is the clause that is
cheap to include at signing and unobtainable afterwards.

### 3.4 Auto-rollback versus upgrade consent

`PackRollout.autoRollback` reverting inside a customer's account is an unapproved
change to their production system. That collides with the upgrade-consent posture
a regulated customer will insist on.

**Resolution: consent to an upgrade includes consent to its automatic
reversion.** A rollback returns them to a version they were already running,
which is the weakest possible change — but the argument only works if it is
stated in the contract rather than assumed in the code.

Note the existing constraint holds and helps here: only **outcome-level** scorers
may trigger a rollback (`canTriggerRollback()`). Component drift notifies and
never reverts. Automatic changes in someone else's account should be rare, and
the model already makes them rare.

### 3.5 Hosted is the canary for BYOA

Re-read `RolloutStrategy` under a customer-owned plane and most of it stops
meaning anything:

- `canary` at percentages — **meaningless.** You cannot roll out to 10% of one
  single-tenant deployment.
- `blue_green` — the customer's infrastructure decision, not ours.
- `time_based` ramp — a schedule they did not agree to.
- `regional` — still meaningful, and essential where residency differs.
- `tenant_wise` with `order`, `batchSize` and `pauseHours` — **the only strategy
  that fully survives.**

Which gives the actual release pipeline:

```
our sandbox  →  our hosted fleet  →  BYOA customers, tenant_wise, in declared order
 synthetic       real workloads,        one at a time, with pause windows
 only            our account,           and per-customer acceptance
                 our blast radius
```

**This is the strongest operational argument for keeping the hosted topology.**
It was adopted for SMEs and the partner channel — commercial reasons. It turns
out to be the only place a release can be proven against real workloads before
it enters an account we do not control. Without it, the first customer to run any
engine version is a regulated enterprise, which is exactly backwards.

---

## 4. Metering, and getting paid

### 4.1 The tension nobody has stated

A control-plane-observed floor only bounds usage **if the control plane is called
in proportion to billable volume.** But constraint C1 forbids a synchronous
control-plane call on the reconciliation hot path — for good reasons: latency, an
availability dependency the customer did not buy, and request metadata we claimed
not to hold.

If policy is fetched once a day and cached, the floor tells you nothing about how
many reconciliations ran. **The floor and C1 are in direct conflict,** and the
BYOA document proposed both without noticing.

### 4.2 The resolution — an offline-verifiable entitlement lease

The control plane issues a **signed, time-boxed entitlement**: this deployment
may perform N reconciliations (or process N documents) before date D. The data
plane draws it down locally, runs entirely offline, and presents its consumption
at renewal.

This is a licence lease, and it is the standard answer because it solves four
problems with one mechanism:

| Problem | How the lease solves it |
|---|---|
| **Metering integrity** | Usage cannot exceed the lease. A hard upper bound we issue, independent of anything they report |
| **C1 / availability** | No hot-path call. The plane works through a control-plane outage until the lease expires |
| **Non-payment** | Renewal is the lever. Nothing covert — the customer knows the lease exists because they signed for it |
| **Graceful degradation** | Expiry enters a grace period, not a stop |

**Decided 4 Aug — the parameters:**

| Parameter | Value | Why |
|---|---|---|
| Lease window | **30 days** | Aligns to the billing period; a revoked lease bites within a month rather than a quarter |
| Grace after expiry | **7 days** | Survives a long weekend plus a slow accounts-payable department |
| **Ceiling** | **A multiple of the contracted tier** | The ceiling is a *runaway guard*, not the commercial limit |

The last row is the one worth reading twice. **The tier and the ceiling are two
different numbers.** Exceeding the tier warns and bills overage; exceeding the
ceiling means something is wrong and stops. Setting them equal would block a
regulated customer's month-end close over a commercial limit, and would
contradict the rule that in-flight work always completes.

The bound is one-sided and that is fine: the lease proves they did **not more
than** N, and the attestation claims how much of it they used. Two figures that
constrain each other from opposite directions are worth far more than either
alone.

> ⚠️ **A kill switch in a customer's account is a trust catastrophe if it is
> discovered rather than disclosed.** The lease must be in the contract, in the
> documentation, and visible in the product — with expiry warnings well ahead of
> the date. Disclosed, it is a licence. Undisclosed, it is the story that ends
> the partnership.

### 4.3 Attestations must chain

Aggregate totals with a signature prove only that we received what they sent.
Two fields make the series checkable:

```ts
sequence: number                    // monotonic per data plane
previousAttestationHash: string     // chains to the prior period
```

Then a missing period is **detectable** rather than merely absent, back-dating
breaks the chain, and a plane that resets its counters is visible. This is cheap
to add now and cannot be added retroactively to a series that has already been
signed.

### 4.4 Three independent estimates, and the variance record

| Estimate | Source | Property |
|---|---|---|
| **Entitled** | The lease we issued | Hard ceiling. Cannot be exceeded |
| **Attested** | Signed totals from the data plane | Detailed, self-reported, chained |
| **Observed** | Control-plane events + telemetry-derived counts | Independent, incomplete, ours |

Divergence beyond a threshold is a commercial conversation, not a silent
adjustment. `CostReconciliation` already does exactly this for *provider* cost
versus recorded cost — the same instrument is needed for **attested versus
entitled versus observed usage**, and it does not exist. Delta 13.

### 4.5 Make the invoice reproducible from the customer's own database

Under BYOA the customer holds `UsageRecord` in their own PostgreSQL. So:

> **Publish the exact query that produces the attested totals.**

The customer can then verify our invoice against their own data, in their own
account, without asking us for anything. A dispute stops being *"do we trust
their meter"* and becomes *"does your database match your signature"* — which is
checkable by both parties from the same rows.

This converts the weakest property of BYOA billing into the strongest. It is also
the sort of thing that wins a procurement review outright, and it costs a
documented query.

### 4.6 `exceptions_raised` is an adverse meter ⚠️

`METERS` includes `exceptions_raised`. Pricing on it means **we are paid more
when the product performs worse** — in a product whose entire thesis is that
fewer exceptions survive to a human.

The mechanical risk was already seen: `Exception.carriedForwardFrom` exists
specifically so a re-run does not inflate the meter. But the mechanical fix does
not touch the incentive, and a customer's procurement team will spot the
incentive before they spot the mechanism.

**Bill on units of work the customer agrees are units of work** —
`documents_processed`, `reconciliations_run`. Keep `exceptions_raised` as a
reported metric. Never price it.

### 4.7 BYOA needs a differently shaped rate card

Inference lands on the customer's Bedrock bill. Storage is their S3. So:

| Meter | Hosted | Customer-owned |
|---|---|---|
| `input_tokens` / `output_tokens` | Priced — and our COGS | **Reported only.** Their bill. Useful for their cost attribution, worthless as revenue |
| `storage_gb_month` | Priced | **Reported only** |
| `documents_processed` · `pages_extracted` · `reconciliations_run` | Priced | **Priced** |
| `exceptions_raised` | Reported | Reported |
| `api_calls` | Priced | Priced |

Hosted prices **consumption**. BYOA prices **entitlement** — decided 4 Aug as a
**subscription plus volume tier**, because our marginal cost is close to zero and
the value is the software. `Plan` and `RateCard` must express both shapes, and
`PlatformMarginLine` means something quite different on each.

This also inverts the COGS problem in a way worth stating plainly: under BYOA our
gross margin is high and predictable, and the commercial risk moves from *cost
per token* to *whether the entitlement was sized correctly*.

### 4.8 The non-payment ladder

```
current  →  warn (in-product, ahead of expiry)
         →  block NEW runs; in-flight runs complete
         →  read-only
```

Two absolutes:

1. **In-flight runs always complete.** Stopping mid-run wastes spend already
   incurred and, under a lease, entitlement already drawn.
2. **Export and audit access are never blocked.** In BYOA it is their account and
   their database — blocking it would be both wrong and largely impossible. In
   hosted it would be indefensible.

This also settles handoff open item #16 — *does a budget `block` stop in-flight
runs?* **No.** The lease makes the answer forced rather than a preference.

---

## 5. Model inference — whose account, whose bill, whose problem

### 5.1 Inference in the customer's account is forced, not chosen

The prompt contains the extracted document content. In KYC that content *is* the
passport name. So if inference is called from our account, personal data enters a
1CloudHub boundary on every run and **the entire BYOA argument collapses** —
residency, erasure, the controller/processor posture, all of it.

This is the same logic that forced local policy evaluation (C2), applied to a
bigger surface:

> **Under BYOA, inference runs against the customer's own Bedrock in the
> customer's account and region. Not a preference — a consequence.**

Which makes the answer to "are the costs entirely in the customer-owned data
plane" **yes, and more completely than is comfortable.**

### 5.2 What we gain

**COGS approaches zero.** Green team 3's finding was that the platform could
price a rate card but had no type recording what anything *cost* it, with a
failure mode of negative contribution per token discovered when someone reads the
AWS bill. Under BYOA that failure mode does not exist, because there is no bill.
Gross margin becomes software margin.

**Connector credentials never reach us.** Their SAP or bank credentials sit in
their Secrets Manager, referenced by the data plane, never transiting a
1CloudHub account. This is a materially better answer than the hosted one and it
changes the shape of the unwritten `model/connections.ts`: credentials are
**referenced, never held**, and in BYOA the reference resolves entirely within
their account.

### 5.3 What we lose, and it is more than it first appears

**We cannot see their cost.** `ProviderCostRecord` captures what a provider
charged — in BYOA it is unpopulated, because their Bedrock pricing may carry
provisioned-throughput commitments, private pricing or enterprise discounts we
have no visibility into. We hold token *counts* through attestation and telemetry;
we do not hold their unit price.

Consequence: **`CostAttribution` and `PlatformMarginLine` mean nothing in BYOA.**
Cost reporting stops being an internal margin instrument and becomes a
**customer-facing feature** — we report their token consumption by run, pack,
model and cost centre, priced at a rate table they supply or a public-pricing
default, and we label it *estimated* because it is.

**The cheap-model incentive flips.** In hosted, we pay for tokens, so we are
incentivised toward cheaper models. In BYOA, they pay, so the incentive is
theirs. `PackPosture.costCeilingPerRun` is a pack-declared ceiling — under BYOA
it is being enforced against **someone else's money**, which means the number has
to be overridable per deployment. A pack author in Chennai should not be setting
a Singapore bank's spend ceiling. Delta 17.

**Model availability is not ours to assume.** Bedrock model access is granted per
account and per region, and quotas are per account. A customer in `eu-west-1`
with access to a different model set than ours is the normal case, not the edge
case. `ModelResolution` today resolves against a catalogue that describes what
*we* can reach.

> **`ModelCatalogEntry` must become a claim about a model, verified per
> deployment.** Each data plane needs an availability probe at install and at
> upgrade, and `ModelFallbackChain` must be resolvable against what that account
> actually has — not against the catalogue's optimism.

**Throttling becomes a customer-side problem we get blamed for.** Their account
quota is not ours to raise. Two requirements fall out: a distinct error class —
`provider_throttled_customer_account`, not a generic retry-exhausted — and a
documented **pre-flight at onboarding** covering which models, which region,
which quotas, and whether provisioned throughput is needed for their latency
expectation.

**Residency must be enforced in the engine, not the console.** Invariant 7
rejects `global.*` inference routing outright. In their account, the
configuration is theirs to get wrong and we cannot audit their console. So the
engine refuses a global inference profile regardless of what it is told — defence
in depth, because the audit path we relied on does not exist.

**Their bill makes our inefficiency visible in dollars.** A retry loop that costs
us nothing in hosted shows up on their invoice. That is a healthy forcing
function and a new support surface: *"why did my Bedrock bill spike"* is now a
ticket, and per-run token accounting has to be exposed to them to answer it.

---

## 6. Heartbeat — how a plane we cannot reach tells us it is alive

### 6.1 The constraint that determines the design

**No inbound access.** A regulated customer's security team will not open a path
into their VPC for a vendor, and asking is a bad opening move. Therefore:

> **Every channel is outbound-only and data-plane-initiated. We never call them.**

The one exception is the audited `TenantAccessGrant` role assumption, which is a
different path with a different consent model and lands in their CloudTrail.

For customers who forbid internet egress entirely, publish a **VPC endpoint
service**; they create an interface endpoint and the traffic never traverses the
internet. Same protocol, different plumbing.

### 6.2 Two channels, two frequencies, two purposes

Conflating these is the mistake to avoid — they answer different questions and
tolerate very different failure modes.

| | **Heartbeat** | **Attestation** |
|---|---|---|
| Question | Is the deployment alive and current? | What did it do, and what do we bill? |
| Cadence | ~5 minutes | 24 hours, including zero-activity days |
| Authentication | SigV4 — AWS authenticates the caller | SigV4 **and** a KMS signature over the content |
| Payload | Versions, migration state, error counts by class, queue depth, sequence | Per-meter totals, versions in force, sequence, previous-hash |
| If lost | Replayed from a local buffer; gaps tolerable | Replayed with original sequence; gaps **not** tolerable |
| Feeds | `DataPlaneHealth`, fleet ops, paging | Billing, `UsageReconciliation` |

### 6.3 Authenticate the channel and the content separately

Using one mechanism for both is the classic error.

- **Channel — SigV4.** The data plane assumes a narrow role in our account,
  scoped to a per-deployment prefix or queue. AWS authenticates who is calling
  and we manage no shared secrets. This stops spoofing.
- **Content — KMS asymmetric signature.** A key pair generated **in the
  customer's account** at install; the private key never leaves their KMS and the
  application never holds key material. The public half is
  `DataPlane.attestationPublicKey`. This gives non-repudiation for billing.

Channel auth answers *who sent this*. Content signing answers *can they later
deny it*. Billing disputes need the second.

### 6.4 Liveness and activity are orthogonal — this is the whole trick

A customer who reconciles monthly is legitimately silent for twenty-nine days. If
"no work" and "no signal" share a field, that customer looks broken every month
and the alert gets muted, and then a genuinely dead plane is muted too.

> **`health` describes the channel. `lastWorkAt` describes the workload. They are
> separate fields and neither is derivable from the other.**

The heartbeat carries zero-activity beats as a positive statement, so idle is
something the plane *says*, not something we infer from silence.

### 6.5 The missed-beat state machine

| State | Trigger | Response |
|---|---|---|
| `healthy` | Beats current | — |
| `stale` | 3 missed intervals (~15 min) | Watch. Usually transient network |
| `unreachable` | 1 hour | Page fleet ops; notify the customer's named contact |
| `dark` | 72 hours | Commercial process. Entitlement renewal does not proceed blind |
| `drifted` | Beating, but versions outside the supported window | Upgrade conversation, not an incident |

`drifted` is deliberately not an availability state. A plane can be perfectly
healthy and two versions behind, and treating that as an outage trains everyone
to ignore the signal.

### 6.6 When *we* are the ones who are down

The data plane buffers heartbeats and attestations locally and replays them with
**original timestamps and sequence numbers**. Combined with the entitlement lease
(§4.2), which lets the plane keep working through a control-plane outage:

> **A control-plane outage is invisible to the customer.** That is the payoff of
> constraint C1, and it is worth stating as a selling point rather than leaving
> as an implementation detail.

### 6.7 Their clock is not our clock

Period assignment must use **our receipt time**, never the timestamp the data
plane asserts. The model already got this right once —
`UsageRecord.recordedAt` exists precisely because *"period assignment uses this,
never `at`"* under retry and clock skew. The same rule governs attestation
periods, and the sequence number is what makes a late arrival attributable to the
period it belongs to rather than the period it landed in.

---

## 7. The harness — where does it live, and what is actually protected

### 7.1 The question

The harness is the agentic runtime: the orchestration loop, the system prompts,
the tool definitions, the extraction and matching and explanation logic. Under
BYOA it runs **in the customer's account**, because it is the thing that touches
the data. There is no split that keeps it central — a harness that cannot see the
document cannot run.

So the prompts and the orchestration are readable by anyone with access to that
account. That is not a risk to mitigate; it is a property to design around.

### 7.2 What you can actually protect

| Property | Achievable? | Mechanism |
|---|---|---|
| **Confidentiality** of prompts and orchestration | **No** | It runs in their account. Obfuscation buys annoyance and costs trust with their security team |
| **Integrity** — they cannot silently modify it | **Yes** | Signed packs, signature verified at load, `packVersionsInForce` in every attestation |
| **Attribution** — we know what version ran | **Yes** | Same mechanism |
| **Licence** — they may not extract and resell it | **Contractual** | Not technical, and that is fine |

Stating which guarantee you get is more useful than implying both. **Integrity
without confidentiality** is the honest position, and it is the same one every
customer-hosted product occupies.

### 7.3 Where the durable value actually sits

The instinct is to protect the prompts. The prompts are not the asset.

```
CONTROL PLANE — accumulates, never ships
  SeededExample        the corpus every customer failure has contributed to
  Scorer               how quality is measured
  PackQualityReport    what this pack scores, across the fleet
  EvaluationGate       what is allowed to ship
  ModelCatalogEntry    what routes where, and why
  the operating record fleet-wide behaviour of every version ever shipped

DATA PLANE — ships, and is readable
  the harness          orchestration, prompts, tools
  the pack content     document types, definitions, rules, SOPs
```

A customer who reads every prompt still cannot reproduce the evaluation corpus
that made those prompts good, the scorers that keep them good, or the fleet-wide
evidence about which model routing works for which domain. **That asset grows
with every deployment and is the one thing that never leaves the control plane.**

This is not a rationalisation after the fact — it is where the model already put
things. `SeededExample` and `PackQualityReport` are control-plane and
`ObservedExample` is tenant-scoped, which is exactly the right line. §2.3's
reproduction loop is the mechanism by which a customer's failure becomes a
permanent fleet-wide asset without their data ever leaving their account.

### 7.4 The consequence for how packs are built

If the harness is readable, **the pack has to carry the value that is worth
buying** — and a pack is declarative content, which is even more readable.

That points at where effort belongs: not in clever prompting, which is copyable
in an afternoon, but in the **evaluation loop** — the seeded corpus, the scorers,
the gates, the accumulated evidence that pack v7 outperforms v6 on a KYC identity
mismatch. That is the moat, it is central by construction, and it is the thing a
prospect's security review cannot object to because it never enters their
account.

---

## 8. What this implies about the operating model

Not a technical section, but the technical decisions above only work if these
hold.

- **Fleet operations is a distinct function** from product engineering. Its
  object is `DataPlane`, not `Tenant`. Its job is versions, drift, attestation
  continuity and upgrade scheduling. **Decided 4 Aug: staffed as a named function
  before the first BYOA customer, not product engineers on rotation.**
- **On-call cannot page into a customer account.** Every runbook step is either
  telemetry-derived, an L1 bundle request, or an escalation that waits on a
  human at the customer.
- **The support tier is a product decision, not a discount.** `supportAccessMode`
  and the telemetry profile together determine what can be diagnosed, and
  therefore what may be promised.
- **The release calendar is the customer's, not ours** — except for the security
  track carved out at signing.
- **Two rate-card shapes, two support models, one codebase.** The moment either
  the schema or the engine forks per topology, the operating cost roughly
  doubles.

---

## 9. Model deltas this analysis requires

Continuing the numbering in `docs/data-architecture.md` §12.

| # | Change | Where | Status |
|---|---|---|---|
| 8 | `DataPlaneHealth` — fleet operations view keyed on `DataPlane`, never on `Tenant` | `model/deployment.ts` | **Applied** |
| 9 | `DiagnosticBundle` — what an L1 bundle contains, and what it must never contain | `model/governance.ts` | Outstanding — L1 is where most diagnosis happens and it is unmodelled |
| 10 | `DataPlane.engineVersion` and `.schemaVersion`, distinct from pack versions | `model/deployment.ts` | **Applied** — three version axes, kept separate |
| 11 | `SupportedVersionWindow` + the out-of-window policy | `model/deployment.ts` | **Applied** — schema version is the gate; engine version gates nothing |
| 12 | `EntitlementLease` — signed, time-boxed, offline-verifiable, drawn down locally | `model/billing.ts` | **Applied** |
| 13 | `UsageReconciliation` — entitled vs attested vs observed, with a variance disposition | `model/billing.ts` | Outstanding — purely ours, addable any time |
| 14 | `UsageAttestation.sequence` and `.previousAttestationHash` | `model/billing.ts` | **Applied** |
| 15 | `TelemetryProfile` — `minimum` / `standard` / `full`, referenced by the SLA | `model/observability.ts` | Outstanding |
| 16 | Meter classification: `priced` vs `reported`, per deployment mode | `model/billing.ts` | Token and storage meters are revenue in one topology and noise in the other |
| 17 | `PackPosture.costCeilingPerRun` overridable per deployment | `model/domain.ts` | In BYOA the pack is setting a ceiling on someone else's money |
| 18 | Per-deployment model availability — probe at install and upgrade; `ModelFallbackChain` resolved against what the account actually has | `model/catalog.ts` | Bedrock model access and quotas are per account and per region |
| 19 | `DataPlaneHeartbeat` — distinct from `UsageAttestation`; different cadence, different auth | `model/deployment.ts` | **Applied** |
| 20 | `DataPlane.lastWorkAt`, separate from `liveness` | `model/deployment.ts` | **Applied** — plus `livenessFor()`, which takes no workload argument at all |
| 21 | `ProviderCostRecord` optional per topology; estimated-cost rate table supplied per deployment | `model/billing.ts` | We cannot see the customer's Bedrock pricing, and reporting it as fact would be a fabrication |
| 22 | Credentials referenced, never held — and in BYOA resolved entirely in the customer's account | `model/connections.ts` (unwritten) | Changes the shape of a module before it is written, which is the cheapest possible moment |

**Applied 4 Aug 2026:** 8, 10, 11, 12, 14, 19, 20 — plus data-architecture
deltas 4 and 5, which are their prerequisites. `model/` typechecks clean under
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and
`erasableSyntaxOnly`.

The urgent three were 12, 14 and 19: an entitlement lease cannot be introduced
into an account already running without one, a signed attestation series cannot
acquire a hash chain retroactively, and a heartbeat that never distinguished
liveness from activity trains every operator to ignore it before anyone notices
the design was wrong. 8, 10, 11 and 20 were applied alongside them because they
are fields and types on the same new module — free now, a fleet-wide change
later.

Everything else remains outstanding by choice: those are changes we can make in
our own control plane at any time.

---

## 10. What is still open

| Item | Note |
|---|---|
| **Error taxonomy** | Must be exhaustive before launch, because adding a code later means an engine release into a customer account. Not started. |
| **Emergency-patch window** | **Decided: 72h.** Still needs counsel's wording and a design partner's reaction to the clause |
| ⚖️ **Does a disclosed entitlement lease create any consumer-protection or contractual exposure?** | Counsel. The mechanism is standard; the disclosure language matters |
| **L1 bundle transport** | Customer uploads to a portal, or emails it? Affects what may be in it |
| **Onboarding pre-flight** | Which models, which region, which quotas, provisioned throughput or on-demand. Needs to exist before the first deployment, and does not |
| **Crypto-shredding design** | Direction decided; the design is not done, and the naive form fails. `docs/data-architecture.md` §10.3 |
| **Harness licence terms** | Integrity is technical, confidentiality is not achievable, licence is contractual. The clause does not exist yet |

---

## 11. The honest summary

Observability and troubleshooting are **survivable**, but only if the error
taxonomy is closed, the telemetry floor is contractual rather than negotiated,
and the SLA promises response rather than resolution. None of that is expensive;
all of it is hard to add later.

Releases have a **real gap**: the model ships content beautifully and has no
concept of shipping itself. Engine version, schema version, a supported-version
window and a forward-only migration discipline are missing, and the migration
discipline in particular must be adopted before the first deployment or not at
all.

Metering has **one good idea** — a disclosed, offline-verifiable entitlement
lease — that resolves the metering-integrity problem, the hot-path availability
constraint, the non-payment lever and the degradation ladder simultaneously.
Combined with chained attestations and a published verification query, it turns
billing in someone else's account from the weakest part of the proposition into
a procurement advantage.

**Inference lands entirely on the customer**, which is forced rather than chosen
— the prompt carries the personal data, so a call from our account would collapse
the whole argument. That is excellent for margin and awkward for everything else:
we cannot see their unit cost, their model access and quotas are not ours to
assume, their throttling becomes our support ticket, and a pack-declared spend
ceiling is now a claim on someone else's money.

**The heartbeat is outbound-only, twice, at two cadences** — a cheap 5-minute
liveness beat authenticated by SigV4, and a daily signed attestation chained by
sequence and hash. The trick that makes it work is keeping liveness and activity
in separate fields, so a customer who reconciles monthly does not look broken for
twenty-nine days and train everyone to mute the alarm.

**The harness ships and is readable.** Integrity is protectable; confidentiality
is not, and pretending otherwise costs credibility with the security team whose
approval you need. The durable asset was never the prompts — it is the evaluation
corpus, the scorers and the fleet-wide operating record, all of which the model
already keeps in the control plane and none of which ever enters a customer
account.

And the hosted topology, adopted for commercial reasons, turns out to be the only
place an engine release can be proven under real load before it reaches an
account we cannot enter. **That, not SME revenue, is why it has to exist.**

# Event architecture — the eight cross-cutting streams, their producers and their consumers

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — a recommendation answering one question. Nothing adjudicates it and nothing in it is applied.
> ✅ **The newest and least stale document in `docs/build/`** — it treats G79 as applied-in-model-not-on-the-wire, which is correct, and it carries no `secret` claim, so G75 does not touch it. ⚠️ **But pass H did not stop where this file stops reading.** Later rows bear directly on it: G87 (partners read aggregates only, and **token usage has no producer at all**) and G89 (the control-plane seam is **artefact-versioned**, each published artefact carrying its own format version and refusal) both constrain the streams designed here. Derive pass H's range from `docs/HANDOFF.md` §3 rather than quoting one.
> ⚠️ It records the tree moving underneath it too: its export count disagrees with both `docs/build/green-service-topology.md` and `docs/HANDOFF.md` §0. **Derive counts; do not copy them from any of the three** — `node tools/check-doc-counts.mjs --derive`.
> ✅ **BODY ANNOTATED 8 Aug 2026 — no factual correction was needed, which is why this file was left last.** Three additions, none of them a rewrite: §4.2's verdict gains G103 and G107 (⚠️ **G107 puts EventBridge in the data plane, which this document's verdict forbids — the contradiction is recorded, not resolved**), §10 gains a table of the four rulings that constrain this document without closing any of its ten rows, and §12's *"no test framework"* clause is struck, because that went false hours after this was written.
> *Banner added 8 Aug 2026; body annotated the same day.*

> 🟡 **A PROPOSAL. NOTHING HERE IS APPLIED.** No file in `model/`, `docs/contracts/`
> or `Mockups/` is changed by this document. Written 8 August 2026 at `0aba16f0`,
> against **G1–G86** (`docs/HANDOFF.md` §3 and pass H), the four OpenAPI documents,
> the sixteen `model/` modules, and `docs/build/green-service-topology.md`.
>
> **Answering, verbatim:** *"Assuming this is a world-class SaaS product that will
> need to scale to BYOA in v2, what best practices should we follow for the
> producers and consumers of each of these? Notifications, audit generating events,
> token usage — all of them originate from an action in the system. Should it be
> based on a pub/sub pattern, or should we have a probe in each service, or should
> each service share telemetry that a central service resolves, etc.?"*
>
> ⚠️ **THE TREE MOVED WHILE THIS WAS BEING WRITTEN, AGAIN.** Exports read **685**
> here; `green-service-topology.md` §0 says 684 and `HANDOFF` §0 says 683, both
> written in the last twenty-four hours. Drop markers read **229**. Re-run §0.
>
> ⚠️ **Where I am reasoning from general engineering practice rather than from this
> repository, the paragraph says so in bold.** That distinction matters more here
> than completeness, and the record's most-repeated defect (§5.11) is a claim
> asserted in prose that nobody re-derived.

---

## 0. Reproduce every claim on this page

```bash
git rev-parse --short HEAD                                   # 0aba16f0
ls model/*.ts | wc -l                                        # 16 modules
grep -h '^export ' model/*.ts | wc -l                        # 685 exports
grep -rho '@dropped-for-v1' model/*.ts | wc -l               # 229 markers
grep -c 'operationId:' docs/contracts/*.openapi.yaml         # 36 + 12 + 17 = 65

# THE FOUR CLAIMS THIS DOCUMENT RESTS ON — run all four.

# 1. There is no broker, bus, outbox or queue decision anywhere in the record.
grep -rniE "outbox|event.?bus|pub/?sub|kafka|kinesis|eventbridge|\bSNS\b|\bSQS\b" \
  docs/*.md docs/build/*.md model/*.ts CLAUDE.md PRODUCT.md \
  | grep -v event-architecture-recommendation                  # 3 hits, none a decision
#   access-and-agency.md:204  — "`producer` collides with Kafka's producer/consumer
#                               idiom", a NAMING argument against a word
#   integration-options.md:175, :278 — `kafka-connect-sap` judged "AVOID", and it is
#                               an SAP source connector, not a bus
#   The only "broker" in the record is F13/DP6, the TOOL Broker — a policy
#   component, not a message broker: HANDOFF:444, green §5.3

# 2. TokenUsage has no producer and no wire representation.
grep -rc "TokenUsage\|tokenUsage" docs/contracts/*.yaml        # 0, 0, 0, 0
grep -rn "TokenUsage" model/*.ts                               # 4 hits: 1 decl,
                                                               # 1 field, 2 comments

# 3. The authorisation spine reaches five types — and PolicyEvaluation is not one.
grep -rnE "authorizationId\??:" model/*.ts | grep -v examples  # 6 lines, 5 types
awk '/^export interface PolicyEvaluation \{/,/^\}/' model/policy.ts \
  | grep -c authorizationId                                    # 0

# 4. UsageRecord already IS a transactional outbox; nothing else in the model is.
awk '/^export interface UsageRecord \{/,/^\}/' model/billing.ts \
  | grep -E "sequence|shippedAt|idempotencyKey|dataPlaneId"    # 4 fields
grep -rn "shippedAt" model/*.ts                                # 1 — only UsageRecord
```

---

## 1. The answer, on one page

**There is no single pattern, and proposing one is the error.** Eight streams, five
different producer patterns, and **exactly one of the eight may cross the plane
boundary.**

| # | Stream | Producer pattern | Transport | Guarantee | Ordering | Consumer down | Crosses plane? |
|---|---|---|---|---|---|---|---|
| **1** | **Authorisation spine** `authorize()` / `AuthorizationGrant` | **synchronous, in the act's transaction** | none — a row | transactional | none needed | the act does not happen | 🛑 **never** (only its opaque id travels, on `UsageRecord`) |
| **2** | **RBAC / policy evaluation** `decide()` / `PolicyEvaluation` | `decide()` emits **nothing**. `PolicyEvaluation` is written **sampled**: 100% of denials in-transaction, ~1% of allows via outbox | outbox row | denials transactional · allows best-effort | none | allows are dropped, denials never | 🛑 **never** — C2: evaluated locally, only a signed summary crosses |
| **3** | **Metering** `UsageRecord` | **in the act's transaction**, never blocking | **transactional outbox in Postgres** — `shippedAt IS NULL` | at-least-once, deduped on `idempotencyKey` | **required** — `sequence` per `dataPlaneId` | buffers indefinitely; replay preserves `sequence` and `recordedAt` | ✅ **the only one.** Push up (U1) |
| **4** | **Token usage** `TokenUsage` | **has no producer today.** DP7 Inference Gateway must become it | two `UsageRecord`s (`input_tokens`, `output_tokens`) — stream 3's transport | as stream 3 | as stream 3 | as stream 3 | ✅ only as `UsageRecord` — never the prompt, never the completion |
| **5** | **Notifications** | **two-phase.** Intent row in the act's transaction; **materialise per recipient at send time**, under a fresh `authorize()` | outbox row → in-Postgres worker queue → channel API | at-least-once to the channel, idempotency key per (digest, recipient) | per-recipient digest window only | coalesce into the next window — **never drop, never unbounded** | 🛑 **never**. It is an egress, and email crosses a border |
| **6** | **Audit** `AuditEvent` · `DataAccessEvent` | **synchronous, in the act's transaction, chain-serialised per (tenant, stream)** | none — a row | exactly-once by transaction | 🛑 **strictly required**, and it is a lock | the write fails and **the act fails** | 🛑 **never** — only `ChainAnchor`'s head hash, a scalar |
| **7** | **Diagnostic bundle** `DiagnosticBundle` | **not a stream.** A user-initiated, authorised export | `createExport` + the evidence chain | one act | none | n/a | ➡️ leaves the tenant as a **disclosure**, not a plane crossing |
| **8** | **Endpoint connection status** `EndpointHealth` | **derived from authorised attempts. NEVER polled** | last-writer-wins rollup row beside `Endpoint` | best-effort | none | stale, and `unknown ≠ unreachable` | 🛑 **never**. No `sequence`, no `shippedAt`, no `dataPlaneId` |

**The one-sentence shape.** *Records go in the act's PostgreSQL transaction;
telemetry goes to Langfuse through an allow-list; exactly one record class — the
meter — is shipped upward, and it ships out of a table that is already a
transactional outbox and does not need a broker to become one.*

**The one number that should change a plan.** **Two of the eight streams have no
producer at all today.** `TokenUsage` (V2 in `HANDOFF` §4.1, *"found independently
by three agents"*) and `EndpointHealth` (G74, adjudicated and not applied). A
transport design that does not say where the numbers come from is a diagram.

**The test that decides every row above, and it is the only test you need:**

> **If losing it costs money, breaks an audit, or makes an act unattributable, it
> is a RECORD and it belongs in the act's transaction in PostgreSQL. If losing it
> costs you a slower debugging session, it is TELEMETRY and it belongs in
> Langfuse.**

Seven of the eight are records. `SpanAttributePolicy` and `TraceRef` are the
telemetry, and they are already designed.

---

## 2. The central tension — and yes, one bus violates invariant 3 by construction

The brief asks me to evaluate the claim rather than assume it. **The claim is
right, and it is right for a stronger reason than the obvious one.**

### 2.1 The obvious reason

`UsageRecord` must travel up; `AuditEvent` and `DataAccessEvent` must not. The
model states both, at the field:

`model/billing.ts:160-163` — *"This is safe precisely because UsageRecord is
PII-free BY CONSTRUCTION — tenant, meter, quantity, model, cost centre, and no
content field at all. Business records (runs, exceptions, documents) do NOT ship;
what crosses is that they happened, never what they contain."*

`model/governance.ts:1125-1133` — *"A chain the customer holds entirely is a chain
the customer can rewrite entirely. The fix is NOT to ship audit content upward —
that would break invariant 3, and the audit trail is precisely the tenant data the
control plane must never read. So ship the HEAD HASH ONLY. It is a scalar."*

A bus that carries both is a bus one subscription away from carrying audit content
upward. That is enough on its own.

### 2.2 The stronger reason — a bus flattens the fourth access axis

`CLAUDE.md` records that the model has just gained a **fourth access axis: resource
class**, thirteen classes (`model/governance.ts:141`), joined to the thirty-six
capabilities by `CAPABILITY_RESOURCE_CLASS` (`model/access.ts:517`) as a
`Record<Capability, …>` so an unclassified capability is a compile error. Invariant
5's own text explains why `metering` is a class of its own:

> *"which is why `metering` is its own resource class: it has **no write mode**, and
> it cannot live in `commercial`, whose defining rule is that a partner may read
> it. A raw usage record is volume in the clear."*

`MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1468`) gives each class a different
TTL — `secret` 60s, `authority` 300s, `tenant_data` 900s, `metering` 3600s. A
message bus has **one** access model: topic ACLs. Putting eight streams whose
classes carry eight different reach rules onto one substrate replaces a
compiler-enforced total `Record` with an IAM policy nobody re-derives. That is
§5.6 exactly — *a control that reads as asserting something and asserts nothing.*

### 2.3 The reason nobody has written down — a bus has no transaction

This is the one that actually kills it, and it kills the broker option for reasons
that have nothing to do with planes.

`docs/component-architecture.html`, quoted approvingly in
`green-service-topology.md:752`:

> *"A billable event that happened before metering existed is revenue you cannot
> invoice and cannot prove."*

The same sentence generalises. If the meter row and the run row commit separately,
one of the two orderings loses money and the other invents it. If the audit row and
the act commit separately, the chain acquires a gap that is **indistinguishable
from tampering** — which is the one thing the chain exists to distinguish.

A broker cannot participate in a PostgreSQL transaction. The standard fix for that
is a transactional outbox. **So a broker design contains an outbox design, plus a
broker.** The outbox is doing the work; the broker is doing the fan-out. And this
system has almost no fan-out: §1's table has **one** consumer per stream, except
notifications, which fan out to recipients rather than to services.

### 2.4 Therefore: per-stream, not one pattern

**And the record already made this mistake once in the other direction.** The
retracted metering "floor" was exactly a design that assumed one mechanism could
cover several sources. `docs/HANDOFF.md:1546-1560`:

> *"§11.1 built the metering trust model on three layers and called the first a
> floor of control-plane-observed events that 'cannot be under-reported', sourced
> from pack activation, policy fetch and model resolution. Traced against the
> contracts, **none of the three is observable by the control plane** … The layered
> model was one mechanism — self-report. … The correction is **not** a better floor;
> nothing in the design is both proportional to volume and outside the customer's
> account."*

**Read that as a general result, not a metering result:** *the control plane cannot
observe anything proportional to work, because nothing proportional to work is
permitted to call it.* Constraint C1 forbids it (`docs/data-architecture.md:146`).
Every design below that would need the control plane to see per-act traffic is
therefore already refuted, and I have not proposed one.

---

## 3. The three options the owner named, scored

Scored against the four criteria in the brief. **Winner is stated per stream, and
where a loser is still defensible it is named with the stream it wins.**

### 3.1 Option A — a pub/sub bus carrying domain events

| Criterion | Verdict |
|---|---|
| **Invariant 3** | 🛑 **FAILS by construction** if it spans planes (§2.1). **FAILS on a second count even inside one plane** (§2.2): it flattens the thirteen-class resource axis onto topic ACLs |
| **BYOA** | 🛑 **FAILS operationally.** The customer runs the broker, patches it, pays for it and pages on it — for a component that exists only for our internal decoupling. It is also a **second thing to make residency-correct** and a second thing `ErasurePlan` must reach |
| **No second engine** | 🛑 **FAILS.** `HANDOFF:412` — *"Two stores plus a telemetry backend, not three databases. No second engine"*; `docs/persistence-design.md:415-420` — *"The cost of a second store is not the store. It is that four invariants stop being enforced by one mechanism … erasure spans two engines with no shared transaction"* |
| **Operability in someone else's account** | 🛑 **FAILS.** Also fails `docs/day-2-operations.md:543` — *"Every channel is outbound-only and data-plane-initiated. We never call them"* — for any broker we would want to reach |
| **Still defensible for** | **Nothing in the data plane.** ✅ **One narrow carve-out: control-plane-internal fan-out.** CP4's BI workspace provisioning (G86) is a long-running, multi-step, retryable workflow over **control-plane data with no tenant content**, in our account, never in a customer's. EventBridge or Step Functions there costs a customer nothing and crosses no boundary. That is the only place I would sign one off |

### 3.2 Option B — a probe in each service

The word carries two designs and they score oppositely.

**B(i) — an external prober that polls services and endpoints.**

| Criterion | Verdict |
|---|---|
| **Invariant 3** | fails for anything reading tenant state |
| **BYOA** | 🛑 **DEAD ON ARRIVAL.** `docs/day-2-operations.md:539-543` — *"No inbound access. A regulated customer's security team will not open a path into their VPC for a vendor, and asking is a bad opening move."* |
| **Endpoint status specifically** | 🛑 **Forbidden by invariant 10, not by BYOA — and this is the sharper prohibition because it also binds in v1's hosted topology.** G74: *"no health poll may exist: it would be a `system` act on a customer credential that `EndpointReading.authorizationId` refuses (invariant 10, not 3)"* |
| **Still defensible for** | nothing here |

**B(ii) — in-process instrumentation that pushes (OpenTelemetry-shaped).**

| Criterion | Verdict |
|---|---|
| **Invariant 3** | ✅ passes — it pushes, it never reads |
| **BYOA** | ✅ passes, and it is already the design: `docs/day-2-operations.md:31` — under BYOA the telemetry backend is *"Theirs, pushed to us"* |
| **No second engine** | ✅ passes — telemetry is the third leg of the decided shape, and it is *"never enters our database"* (`docs/persistence-design.md:37`) |
| **Verdict** | ✅ **WINS the telemetry plane, and only the telemetry plane.** `TraceRef`, `SpanAttributePolicy`, `emitSpan`, sampling-as-policy |
| **Loses everywhere else because** | all eight streams are **records**. A dropped span is a slower debug; a dropped meter is unbillable revenue and a dropped audit row is a chain gap |

### 3.3 Option C — every service ships telemetry, a central service resolves it

| Criterion | Verdict |
|---|---|
| **Invariant 3** | 🛑 **FAILS, and this is the retracted floor with a new name.** §6 of `HANDOFF` traced three claimed control-plane-observable sources and found none was observable. Deriving business records centrally requires the same thing and fails for the same reason |
| **Invariant 10** | 🛑 **FAILS independently, and this is the one nobody has stated.** An audit row derived from telemetry has no `authorizationId` — and `SpanAttributePolicy` is *"An allow-list, never a deny-list. Anything not named here is dropped"* (`model/observability.ts:456`), designed specifically to strip principal-shaped attributes. **You would be reconstructing the authority spine out of the one channel built not to carry it** |
| **Erasure** | 🛑 **FAILS the record-kind taxonomy.** `docs/data-architecture.md:213` — *"Volume does not determine kind; erasability does."* Telemetry is `out_of_reach` in `ErasurePlan` by design (`docs/persistence-design.md:276-278`, *"We cannot delete from their Datadog"*). A business record sourced from a store you cannot erase from is an erasure obligation you cannot meet |
| **BYOA** | fails at the same point as A — telemetry crosses under `SpanAttributePolicy`, and *"A customer can set it so restrictively that we cannot diagnose anything"* (`docs/day-2-operations.md:43`). Billing on a channel the customer can turn down is not a billing design |
| **Still defensible for** | ✅ **exactly one role, and the record already names it.** `docs/day-2-operations.md:371` — the **Observed** estimate, *"Control-plane events + telemetry-derived counts \| Independent, incomplete, ours"*, cross-checked against Entitled and Attested. **A corroborator, never a source of record.** ⚠️ Note that row still cites "control-plane events" and `docs/data-architecture.md:410-428` retracted that source a day later; the telemetry half survives, the control-plane half does not |

> ⚠️ **`docs/integration-options.md:1003` says Langfuse's Metrics API is
> "explicitly for 'billing'".** It is, for other people. **Do not use it as one
> here.** It fails invariant 10 (no `authorizationId`), fails the erasure taxonomy,
> and under BYOA it is a figure the customer's own `SpanAttributePolicy` controls.
> It is a legitimate **Observed** cross-check and nothing more.

### 3.4 The winner, per stream

| Stream | Winner | Loser that was closest |
|---|---|---|
| 1 authorisation | in-transaction row | — nothing else was ever plausible |
| 2 RBAC / policy | in-transaction (denials) + outbox (sampled allows) | B(ii) — but a sampled *record* is not a sampled *span* |
| 3 metering | **outbox in Postgres**, push up | A — and A needs an outbox anyway (§2.3) |
| 4 token usage | stream 3's transport, produced at DP7 | C — Langfuse genuinely counts tokens; §3.3 says why not |
| 5 notifications | intent row → per-recipient authorised materialisation → in-Postgres worker queue | A — **the only stream where a bus is a real contender, and it loses on §8.4** (§5.5) |
| 6 audit | in-transaction, chain-serialised | none. A bus here is a chain gap generator |
| 7 diagnostic bundle | not a stream — an authorised export | — |
| 8 endpoint status | derived rollup from authorised attempts | B(i), and it is forbidden by invariant 10 |

---

## 4. The transport decision, head to head: outbox-in-Postgres versus a broker

**First, the honest framing.** `grep` over `docs/`, `model/`, `CLAUDE.md` and
`PRODUCT.md` for `outbox|event.?bus|pub/?sub|kafka|kinesis|eventbridge|SNS|SQS`
returns **nothing substantive**. There is no prior decision here to relitigate and
none to defer to. What binds is pass F (`HANDOFF:412`) and G55 — *"simplify the
backend; trade flexibility for simplicity; less choice"*.

### 4.1 The outbox is already built and nobody has said so

**`UsageRecord` is a transactional outbox. It has been one since it was written.**

```
model/billing.ts:138   idempotencyKey: string        the dedup key
model/billing.ts:165   sequence: number              monotonic per dataPlaneId
model/billing.ts:181   shippedAt: Timestamp | null   ← THE OUTBOX PREDICATE
model/billing.ts:132   dataPlaneId: DataPlaneId      the shipper's identity
```

`shippedAt` is null *"while still buffered in a data plane that is offline"*, and
*"The control plane's copy is the BILLING record. The data plane's is the buffer."*
`grep -rn "shippedAt" model/*.ts` returns **one** line — this is the only stream in
the model with an outbox shape, and it is the only stream that needs one.

The shipper is nine lines of SQL:

```sql
-- one shipper per data plane; ORDER BY sequence preserves the gap-detection property
SELECT * FROM dp_usage_record
 WHERE shipped_at IS NULL
 ORDER BY sequence
 LIMIT 500
   FOR UPDATE SKIP LOCKED;
-- POST to shipUsageEvents, then:
UPDATE dp_usage_record SET shipped_at = $receivedAt WHERE id = ANY($accepted);
```

Wake it with `LISTEN`/`NOTIFY` for latency and poll every few seconds for
correctness. **`NOTIFY` is not durable — the poll is the correctness mechanism and
`NOTIFY` is the optimisation. Getting that backwards is the classic bug in this
pattern** *(general engineering practice, not from this record)*.

### 4.2 Head to head

| | **Transactional outbox in PostgreSQL** | **A broker (MSK · Kinesis · EventBridge · SNS/SQS)** |
|---|---|---|
| **Commits with the act** | ✅ **yes — one transaction.** The property every record stream here requires | 🛑 **no.** Needs an outbox in front of it, so you ship both |
| **Second engine** | ✅ none. It is the database they already run | 🛑 yes. Directly against `HANDOFF:412` |
| **Invariant 3** | ✅ the plane boundary is one HTTP operation (`shipUsageEvents`), auditable, enumerable — it is edge U1 in green §6.3 | ⚠️ a topic is not a boundary; it is a configuration |
| **BYOA operability** | ✅ **zero incremental customer burden.** `docs/data-architecture.md:438-443` puts the BYOA footprint at *"Aurora + S3 + Lambda + Bedrock in a CDK stack"* — a broker adds a fifth item to a list whose *"cost floor determines the smallest deal BYOA makes sense for"* | 🛑 the customer runs it. **MSK bills a per-cluster-hour floor; Kinesis on-demand bills per stream-hour; EventBridge and SQS bill per request.** Only SQS has no idle floor. ⚠️ **Figures not fetched — do not budget without them** (`docs/notifications-channels.md:176` sets the precedent for saying so) |
| **Erasure** | ✅ one `SubjectIndexEntry` lookup, one engine | 🛑 `docs/persistence-design.md:418` — *"erasure spans two engines with no shared transaction"* |
| **Residency** | ✅ same instance, same region as the tenant | 🛑 a second thing to configure regionally, and `docs/persistence-design.md:417` — *"residency becomes two configurations that can drift"* |
| **Retention** | ✅ monthly partitions, detach and drop — *"retention becomes a metadata operation instead of a mass delete"* (`persistence-design.md:220`) | 🛑 broker retention is a third retention setting beside `RetentionPolicy` and the S3 lifecycle rule — and §10.2 already records that two settings for one obligation *"will drift"* |
| **Throughput ceiling** | the volume table says ~944k `UsageRecord` + ~1.41M `PolicyEvaluation` per tenant-month (`persistence-design.md:213-217`) — under 1 row/sec average. **Unremarkable.** BYOA is ~2.4M/month total (`byoa-topology.md:65-69`) | not the binding constraint at this volume |
| **What it genuinely cannot do** | fan-out to many independent consumers; cross-service replay from an arbitrary offset; multi-hour buffering under a Postgres outage | those are real, and **this system needs none of them** — §1 shows one consumer per stream |

**Verdict: outbox, for every stream. No broker in the data plane, in either
topology.** The single carve-out is §3.1's last row — control-plane-internal
provisioning workflow, our account only.

> ✅ **TWO RULINGS ON 8 Aug 2026 BEAR ON THIS VERDICT, AND BOTH GO WITH IT.
> TAKEN, NOT APPLIED.**
>
> **G103 — no Redis; the extraction-rule cache is a tenant-scoped Postgres table.**
> This is the same "adds no engine" argument as §4.3, reached independently for a
> different subsystem, and its reasoning is stronger than preference: a cache of
> tenant-derived rules would sit **outside RLS, outside the retention table, outside
> the erasure plan and outside `SubjectLocation`** — so tenant data would live
> somewhere the erasure machinery cannot name. **Preserved rejected alternative:** a
> tenant-partitioned Redis with a TTL inside the retention window plus a new
> `SubjectLocation` variant would have worked and was refused. ⚠️ **The
> sub-millisecond claim behind it was never measured** — if latency genuinely binds
> under fan-out, reopen with a measurement, not an assumption. ⚠️ **This does not
> settle the Langfuse question in §12**, which is a different engine arriving by a
> different route; that item stands unverified.
>
> **G107 — the whole reconciliation pipeline is DATA-PLANE.** Step Function,
> Lambdas, Fargate task, S3 landing bucket, EventBridge and every log they write run
> under the **data-plane DB role**, because a reconciliation batch *is* tenant data
> and invariant 3 says the control plane never reads it. ⚠️ **Read against §3.1's
> carve-out carefully: G107 does NOT widen it.** The carve-out signs off a broker
> only for control-plane-internal fan-out over data with no tenant content; G107
> places the pipeline's EventBridge usage firmly on the *other* side of that line,
> in the data plane. `docs/data-architecture.md` §4 makes the plane split separate
> schemas and DB roles — **a grant, not a convention** — so this must be explicit in
> the deployment. **If the pipeline ships EventBridge in the data plane, that is a
> broker in the data plane and it contradicts the verdict above. Somebody must
> reconcile the two; this document does not.**

### 4.3 Where a queue is still the right shape — and it is still not a broker

Notification **delivery** is genuinely queue-shaped: I/O-bound, retryable,
externally rate-limited, no durability obligation past "deliver or surface the
failure". **Use an in-Postgres job queue** (`pg-boss`, `graphile-worker`, or a
hand-rolled `FOR UPDATE SKIP LOCKED` table — the shipper in §4.1 is already one).
It enqueues **in the same transaction** as the digest's `DataAccessEvent`, which
SQS cannot, and it adds no engine. *(The library choice is general practice; the
constraint that it be in-Postgres is this record's.)*

---

## 5. The eight streams, one at a time

### 5.1 The authorisation spine — `authorize()` / `AuthorizationGrant`

**This is not an event and must never become one.**

| | |
|---|---|
| **Producer** | `authorize()` in DP1, **synchronously, in the same transaction as the act**. `model/access.ts:1485` — *"minted by `authorize()` and by nothing else"* |
| **Consumer** | `redeemAuthorization()`, and the three streams that carry its id |
| **Transport** | none. A row in `dp_authorization_grant` |
| **Guarantee** | transactional. Not "exactly once" — *the same* once |
| **Ordering** | none required |
| **Back-pressure** | **refuse the act.** This is the only stream where failing the request is correct |
| **Consumer down** | not applicable — there is no asynchronous consumer, and that is the point |
| **Crosses the plane** | 🛑 never. Only the opaque `AuthorizationGrantId` scalar, on `UsageRecord` |

**Why asynchrony is fatal here.** `model/access.ts:1487-1499` refuses the JWT shape
outright:

> *"A REFERENCE, NOT A BEARER TOKEN … There is no signature, no claims blob and no
> encoding, because there is nothing here a caller is trusted to carry … That is a
> deliberate refusal of the JWT shape. A signed self-describing token is fast
> precisely because nobody loads the row — and a revoked assignment, a disabled
> user or a lapsed partner grant then stays effective until the token expires."*

`redeemAuthorization()` **loads the row**. If the row is written asynchronously,
redeem races the writer. `AuditEvent.authorizationId` would reference a row that
may not exist yet, or ever — and invariant 10 becomes a foreign key that sometimes
resolves.

**Two operational facts this creates, both under-specified today.**

1. **The grant table cannot be purged on TTL.** TTLs are 60–3600 seconds
   (`MAX_AUTHORIZATION_SECONDS`), but `AuditEvent`, `DataAccessEvent`,
   `EndpointReading`, `OperatorProposalDecision` and `UsageRecord` reference the id
   **for the life of the audit window**. `RETENTION_CLASSES` has thirteen members
   and **none of them is `authorization_grant`** — verify:
   `awk '/^export const RETENTION_RECORD_KIND/,/^\}/' model/domain.ts` lists
   `audit_event`, `policy_evaluation`, `usage_record`, `data_access_event` and nine
   others; no grant class. **A fourteenth `RetentionClass` is needed, and
   `RETENTION_RECORD_KIND` is a total `Record` so adding one is a compile error
   until it is classified.** It must be `business` under `AUDIT_MUST_OUTLIVE`, or
   the join key expires before the row it authorises. 🔴 **DECISION — it adds a
   member to a closed set.**
2. **`telemetry` is reachable by a grant and `authorize()` can never mint for it.**
   `HANDOFF` §4.1 E1: *"it sits in both `PERMITTED_RESOURCES` entries and is bounded
   in `MAX_AUTHORIZATION_SECONDS`, so a grant reaches it and `authorize()` can never
   mint for it (§11.9)."* Four of thirteen classes have no capability. **Any
   telemetry read is therefore off the spine today** — which is a live hole in the
   stream this whole document is about.

### 5.2 RBAC permission evaluation — `decide()` / `PolicyEvaluation`

| | |
|---|---|
| **Producer** | `decide()` produces **no record at all** and must stay that way. `PolicyEvaluation` (`model/policy.ts:827`) is the policy engine's record |
| **Transport** | denials: in the refusal's transaction. Allows: sampled, via the outbox |
| **Guarantee** | denials durable; sampled allows best-effort |
| **Ordering** | none |
| **Back-pressure** | drop sampled allows before dropping anything else. **Never drop a denial** |
| **Consumer down** | no consumer. It is read by admin surfaces and by a dispute |
| **Crosses the plane** | 🛑 never. C2 — *"1.41M rows a month stay in the customer's own database and only a signed summary crosses"* (`data-architecture.md:152`) |

**Why `decide()` must not mint.** `model/access.ts:1581-1587` — *"`canGrant()` loops
`effectiveScopeFor()` over EVERY capability of the target role — a role with twelve
capabilities would mint twelve authorisations for a permission check that performs
no act at all. The three streams would fill with grants nobody ever redeemed."* The
same argument forbids emitting an event per evaluation.

**Sampling is a policy, not a constant** (`data-architecture.md:171-180`): 100% of
denials, `requires_approval` and `redacted`; ~1% of plain allows plus a per-window
count so the total is still provable. *"A regulated customer whose auditor demands
every allow individually evidenced sets the rate to 100% in their own deployment,
where they also pay for the storage."* Status: **Outstanding, delta 6.**

🛑 **A finding, and I have not seen it stated: `PolicyEvaluation` is NOT on the
authorisation spine.**

```bash
awk '/^export interface PolicyEvaluation \{/,/^\}/' model/policy.ts | grep -c authorizationId   # 0
```

Pass E's own sentence is *"`authorizationId` now joins `AuditEvent`,
`DataAccessEvent` and `UsageRecord` — three streams that previously could not be
joined at all."* Three, not four. So *"under what authority was this policy
decision taken"* is answerable for a read, a write and a charge, and **not for a
policy refusal** — which is the row a dispute reaches for first. Whether that is
deliberate (a policy evaluation may precede the mint) or an omission is a
**DECISION**, and the argument for adding it is identical to the one
`model/governance.ts:1160-1174` makes for `DataAccessEvent`.

⚠️ **`PolicySubject.model_call.model: string` is a live invariant-7 bypass** — one
of the two `CLAUDE.md` names. **Its citation there is `model/policy.ts:747` and that
line is now a comment about `errors.yaml`; the field is at `model/policy.ts:852`,
verified `grep -n "model_call" model/policy.ts`.** If a `PolicyEvaluation` is ever
shipped, summarised or exported, that bare string travels with it — and it sits
inside a union type alias, which is why the earlier grep could not see it.

### 5.3 Metering — `UsageRecord`

| | |
|---|---|
| **Producer** | DP4, called in-process by DP10/11/12/13/15/17. **In the act's transaction. Never blocks a run** (`foundation.openapi.yaml:382`) |
| **Consumer** | CP5 Metering Ingest, two operations, one of them gap detection |
| **Transport** | **transactional outbox** (§4.1) → `shipUsageEvents` → CP5 |
| **Guarantee** | **at-least-once**, deduped at CP5 on `idempotencyKey` (unique index — `persistence-design.md:130`) |
| **Ordering** | **required.** `sequence` monotonic per `dataPlaneId`, *"so a gap in this sequence is detectable rather than merely absent"* |
| **Back-pressure** | **none, deliberately.** The buffer grows in Postgres. Bounded by disk, and under BYOA by the customer's disk |
| **Consumer down** | *"BUFFERED REPLAY IS THE NORMAL CASE, not the exception"* (`control-plane.openapi.yaml:265`). Replay preserves `sequence` and `recordedAt`; `receivedAt` is authoritative for the period |
| **Crosses the plane** | ✅ **the only stream that does.** Edge U1 |

**Three things the design already decides and an implementer will get wrong.**

1. **`recordedAt` is not the billing key; `receivedAt` is.** `model/billing.ts:145-150`
   — the field's comment records that this *"said 'period assignment uses this'
   until 5 Aug, when a slice review noticed that on a customer-owned plane
   `recordedAt` is the CUSTOMER'S clock — so a plane three days slow shifted revenue
   across a period boundary, into an append-only table with no compensating
   instrument."*
2. **Our downtime must not bill the customer.** `model/billing.ts:175-179` —
   *"rating allocates against the period the sequence belongs to, bounded by a
   replay horizon, and selects the rate card by event time."* **The replay horizon
   is a number nobody has picked.**
3. **A partial batch is a normal outcome** (`control-plane.openapi.yaml:273-277`) —
   *"accepted events are durable regardless of what else in the batch was rejected,
   because a whole-batch failure would make one bad event block a month of revenue
   behind it."* ⚠️ **But this collides with gap detection**: once a batch may be
   partially rejected, a hole in `sequence` no longer distinguishes *lost* from
   *refused*. CP5's gap detector must consult its own rejection log, and no
   operation returns one. **DERIVATION** — `UsageIngestAck` needs a rejected-sequence
   list, or the one operation CP5 exists for asserts nothing (§5.6's shape).

**G30 is open and it is a transport question, not a billing one.** *"Still to
settle: whether the dedup key is `(idempotencyKey)` or `(idempotencyKey, meter)`,
because one inference produces four meters and `billing.ts:100-104` records that
the table has no compensating instrument."* **The answer follows from §5.4 below:
one Bedrock call produces `input_tokens` and `output_tokens` from one provider
request id, so `(idempotencyKey)` alone collapses two rows into one and undercounts
by design.** The key must be `(idempotencyKey, meter)`. I state that as a derivation;
G30 records it as undecided.

**`authorizationId` is NOT BACKFILLABLE** (`model/billing.ts:219-221`) — *"Every
record written before this field existed carries null and is indistinguishable from
a legitimate machine sample."* It must be populated by DP4 **from the first metered
event of the first customer**. See §7.

**Who may consume it — G73 and `agents.ts:364`.** `DELEGABLE_TO_AGENT.view_metering
= false`. The token/meter stream must be unreachable from DP14, and no spend
forecast may appear on reverse, reopen, dispute or escalate — *"a behaviour nobody
authored, nobody scored and no rollback would revert."* **This is a consumer
restriction on a transport, and it is the reason a general-purpose bus is wrong
even inside the data plane: a topic that DP14 can subscribe to has already lost
this property.**

### 5.4 Token usage per model call — `TokenUsage`

**🛑 This stream has no producer, and three independent reviewers found it.**
`HANDOFF` §4.1 V2: *"`input_tokens` / `output_tokens` have no producer \| F7 resolves
a model and does not invoke one, so nothing counts tokens. Found independently by
three agents."* §5.8 lists it as a convergence signal.

Verify: `grep -rc "TokenUsage" docs/contracts/*.yaml` → **0, 0, 0, 0**.
`grep -rn "TokenUsage" model/*.ts` → one declaration (`domain.ts:2500`), one field
(`ReconciliationRun.tokenUsage`, `:2560`), two comments.

**And there are already two vocabularies for it** — §5.3's shape, live:

| | Where | Grain |
|---|---|---|
| `TokenUsage { inputTokens, outputTokens, model }` | `domain.ts:2500`, on `ReconciliationRun` | per run, rolled up |
| `METERS.inputTokens` / `.outputTokens` | `billing.ts:76-77`, on `UsageRecord` | per call, billable |

Nothing joins them. §5.3's tell is *"the same noun appearing in two modules with two
spellings of its value set"*, and *"Every instance found so far diverged within
hours."*

**Recommendation.**

| | |
|---|---|
| **Producer** | **DP7 Inference Gateway, and only DP7.** It is *"the only path to a model or a managed AI service"* (green §5.3). Nothing else can count what nothing else invokes |
| **What it emits** | **two `UsageRecord`s per call** — `input_tokens` and `output_tokens` — with `authorizationId` = the calling act's grant, `model` = the `ModelCatalogEntryId`, `runId`, `costCenter`. Written in the **caller's transaction** |
| **`idempotencyKey`** | **the provider's own request id.** `model/billing.ts:134-138` — *"Deduplication key, taken from the provider's own request id where one exists"*. For Bedrock that is `x-amzn-RequestId` on the InvokeModel response. **Name it in the contract** rather than leaving "where one exists" to an implementer |
| **Transport / guarantee / ordering** | stream 5.3's, unchanged |
| **Crosses the plane** | ✅ only as `UsageRecord`. **Never the prompt, never the completion, never a span.** `TelemetryPolicy.maxDataClassInSpanAttributes` governs the trace of the call; the meter carries no content at all |

**Two decisions this forces.**

🔴 **DECISION 1 — `ReconciliationRun.tokenUsage` should be a DERIVATION over
`UsageRecord`, not a stored column.** This is G74's ruling applied to a second type:
*"a stored copy is §5.3's two-vocabularies defect and it diverged within hours every
previous time."* A stored rollup and a summed meter will disagree the first time a
retry is deduped. I am not proposing the model edit; I am proposing the ruling.

🔴 **DECISION 2 — the extraction path is not a token path, and G69/RD-1 says so.**
Textract *"cannot be a `ModelCatalogEntry`"* and *"never passes `resolveModel()`"*.
It produces **pages, not tokens**: the meter is `pages_extracted`, and residency
comes from `managed_service_use.allowedRegions` (G79, model applied, contract not).
**A single "model call" event type covering both paths would put v1's primary IDP
engine behind a token counter that cannot count it.** DP7 has two paths, two meters,
two residency checks — and green §5.3 already argues it must still be **one
component**, *"because if they are two components, the second one is the one nobody
remembers to check."*

**Delta 16 is open and it changes the shape of this stream under BYOA.** `HANDOFF`
§4.1: *"meter classification `priced` vs `reported`, per deployment mode \| Revenue
in one topology, noise in the other."* `docs/day-2-operations.md:413-418`: under
customer-owned, `input_tokens`/`output_tokens`/`storage_gb_month` become *"Reported
only. Their bill."* **So in v2 the token stream still ships, still sequences, still
chains — and is not priced.** Build it as if it were priced; that is what makes the
switch a configuration rather than a migration.

### 5.5 Notifications

**This is the stream where a pub/sub bus is a genuine contender, and it loses for a
reason that is easy to miss.**

The intuitive design is: raise an exception → publish `ExceptionRaised` → a
notification service subscribes → fan out to recipients. **That evaluates authority
at publish time, or not at all.** Pass D §8.4 requires it evaluated **per recipient,
at send time**:

> `docs/access-and-agency.md:310-312` — *"The digest is a read, so it acquires
> everything a read has: masked by org, scoped on all six dimensions, classified per
> channel, audited as a `DataAccessEvent`, and residency-checked."*

A publisher does not know the recipients and cannot compute their scope. A
subscriber that computes it is not a subscriber; it is a read path with a queue in
front of it. **So build the read path and put the queue where it belongs.**

**The two-phase design.**

| Phase | What happens | Where |
|---|---|---|
| **A — intent** | the domain act writes a `notification_intent` row: subject id, subject type, notice kind, tenant. **No content. No recipients. No text.** In the act's transaction | DP11/DP12/DP10 |
| **B — materialise and deliver** | a worker, **per recipient**: `authorize()` for the digest capability → `effectiveScopeFor()` → build the digest through DP2's classification ceiling → **check the channel's `DataClass` ceiling** → write `DataAccessEvent` → enqueue delivery | DP13 |

Phase A carries no content precisely so that the intent row is not itself a
disclosure. Phase B is a read, and it is audited as one.

| | |
|---|---|
| **Guarantee** | at-least-once to the channel, with an idempotency key per `(digestId, recipientId)`. **Slack `chat.postMessage` returns a `ts`; store it, and a retry updates rather than re-sends** |
| **Ordering** | none across recipients. Within a recipient, digest windows are ordered by construction |
| **Back-pressure** | **coalesce into the next digest window. Never drop, never queue unbounded.** Slack is 1 msg/s per channel; Teams is ≤4 req/s per channel and **≤3,000 messages per app per day per channel** (`notifications-channels.md:130`) |
| **Consumer down** | `403 MessageWritesBlocked` (Teams) and `app_uninstalled` (Slack) are **first-class tenant states**, not retryable errors (`:133`) |
| **Crosses the plane** | 🛑 never. And email is an egress that crosses a **border**: *"a digest to a CFO's mailbox is a sink with a `DataClass` ceiling. Nobody has costed that"* (`access-and-agency.md:324-326`) |

**A fan-out bus is also a terms-of-service violation here, independently.**
`notifications-channels.md:135-139`: *"'It's a violation of the terms of use to use
Microsoft Teams as a log file. Only send messages that people will read.' A
per-exception firehose is a **terms violation**, not merely poor UX. **Aggregate
into digest cards.**"* The transport must **aggregate**, which is the opposite of
what a per-event bus makes natural.

**🛑 The carve-out, and it is blocking the whole product.**

`model/governance.ts:1398` blocks every `TenantAccessGrant` on
`customerNotifiedAt !== null`. §10.1 carves operational notices out of §8.4 so the
field can be set — but *"Without that list this decision is a hole rather than a
carve-out"*, and `docs/screen-pack-ledger.md:564` marks it **blocking**: *without it
every support grant fails forever.*

`docs/build/green-agent-bi-slices.md:583-600` already drafts `SERVICE_NOTICE_KINDS`
with nine members and `NOTICE_CARRIES_TENANT_DATA` beside it. **It is a DERIVATION,
not a decision** — *"the screen has already enumerated the vocabulary"*, and
`Notifications.dc.html`'s own rule is the gate: *"An event that is not in this table
cannot notify anyone, by any channel."*

**My architectural addition, and it is the one thing I would insist on:** the
service-notice path and the digest path must be **two entry points in two modules,
not one function with a `isServiceNotice` parameter.** That parameter is §5.2
exactly — *a caller-supplied parameter that switches a check off* — and green §12
item 2 already names this risk in DP13: *"the kind of exemption that, once both paths
live in one service, becomes a way to send a content-bearing digest without the
ceiling."* Make the service-notice sender structurally unable to reach the digest
builder — no import — and the exemption cannot widen by accident. **Green would not
argue hard against splitting DP13; this is the argument for it.**

### 5.6 The audit trail — `AuditEvent`, `DataAccessEvent`

| | |
|---|---|
| **Producer** | DP3, **synchronously, in the act's transaction.** CG2: *"Every public operation calls DP1 before it acts and DP3 after"* |
| **Consumer** | nobody, asynchronously. It is read back by an auditor and by a `DataSubjectRequest` |
| **Transport** | none. A row. It never leaves the tenant's database |
| **Guarantee** | exactly-once by transaction |
| **Ordering** | 🛑 **strictly required per (tenant, stream), and this is the expensive part** |
| **Back-pressure** | 🛑 **fail the act.** `authorizationIsWellFormed()` is *"a WRITE-TIME GATE on an append-only stream and the answer to a malformed audit row is to refuse the write"* (`governance.ts:1250-1252`). An act whose audit row cannot be written did not happen |
| **Crosses the plane** | 🛑 **never.** Only `ChainAnchor` — `{tenantId, stream, throughSequence, headHash, anchoredAt}` |

**🛑 The chain is a serialisation point and nothing in the record says so.**
`RecordChain.sequence` is *"Monotonic per tenant per stream"* and `previousHash`
chains to the prior body. **You cannot compute `previousHash` concurrently.** Every
mutating request in a tenant therefore contends on one lock per (tenant, stream).

Two implementations, and I recommend the first:

- **(a) A head row, `SELECT … FOR UPDATE` inside the act's transaction.** Correct,
  simple, and the contention is *per tenant*, not global — which at a hosted fleet
  of tens of tenants and a single-tenant BYOA plane is fine. **Cost, stated plainly:
  audit chaining puts a per-tenant write lock on every mutating request, and that is
  the throughput ceiling of the whole product.**
- **(b) Write unchained, chain asynchronously.** 🛑 **Rejected.** It creates a window
  in which a row exists and is unchained, and a crash in that window is
  indistinguishable from the tampering the chain exists to detect.

**A third option worth naming because it is the only lever on (a)'s cost:** chain at
the granularity of a **transaction** rather than a **row** — one chain entry per
commit, covering N events under a Merkle root. It cuts the lock rate by the events-
per-transaction factor. **It changes `RecordChain`, so it is a model change and a
DECISION, and I am naming it rather than smuggling it in.**

**🛑 E4/G20 is a hard prerequisite and it is not applied.** `HANDOFF` §8 item 6:

> *"⚠️ **G20 chose RFC 8785 / JCS and it is NOT APPLIED.** Two hashed streams now
> rest on a definition that does not exist (`AuditEvent.chain`,
> `DataAccessEvent.chain`; `UsageAttestation` is dropped under G36, which is the one
> relief). **Irreversible after the first hash**, because re-canonicalising means
> re-chaining the history the chain exists to protect. … It has been the oldest item
> with a hard deadline for three days."*

Three implementation constraints follow, all of them derivations:

1. **One canonicaliser, imported at all three sites** — DP3's two streams and CP3's
   pack signing. G20's own argument is *"under BYOA two implementations agreeing is
   evidence; the same code agreeing is not"* — that argues for a **standard**, and
   for **one implementation of that standard on our side**, verified against
   published JCS test vectors. Two of ours agreeing proves nothing.
2. **`JSON.stringify` throws on `bigint`** (G71). G65 puts `amountMinor` on the wire
   as a **string**. **The canonical body must therefore see the string form**, and
   that is a property of the canonicaliser's input, not of the serialiser.
3. 🛑 **The erasure-versus-chain question, which I believe is unstated anywhere and
   is irreversible with the canonicalisation.** `AuditEvent.before` and `.after` are
   `Json | null` and carry personal data — which is why
   `RETENTION_RECORD_KIND.audit_event = 'business'` and the row is in the
   **erasable** set (`data-architecture.md:213-217`). **But erasing a field that is
   inside the hashed body breaks the chain from that row forward, permanently.** So
   the canonical body must be defined to **exclude** `before`/`after`, with those
   two fields covered by a separate content hash that may be nulled on erasure — or
   PDPA erasure and tamper evidence are mutually exclusive for the life of the
   product. **This must be settled in the same commit as G20. It cannot be settled
   after the first hash.**

**On `ChainAnchor`, and a gap in green's edge list.** Green §6.3 enumerates nine
cross-plane edges — four up, five down — and **`ChainAnchor` is not among them**.
That is defensible under G36: hosted-only means *we* hold root over the database, so
the customer-rewrites-the-chain threat the anchor exists for does not arise. **It
becomes necessary at the first BYOA customer, and it is a tenth edge** — one upward
push of a scalar. **Design it in v1; do not ship it.** And note the anchor's own
recorded limit: *"we can prove the chain changed, not what it used to say"*, plus
V10 — *"an honest chain re-anchor is indistinguishable from a laundered counter
reset."*

**One more consumer-side hole, from G68:** *"a dashboard read cannot be recorded as
a `DataAccessEvent` by us, so invariant 10 does not reach it."* Under G82 the BI
dataset also crosses into `ap-southeast-2` on **every SPICE refresh**, and green
§6.4 derives that `SubjectLocation.bi_dataset` must be registered **at refresh, in
the data plane** — not once at provisioning. **That is a per-refresh event with a
producer nobody has assigned.** It belongs to DP17, and it is the ninth stream this
brief did not list.

### 5.7 Raising a defect / support — `DiagnosticBundle`

**Not a stream. One act, human frequency, one artefact.** Any transport pattern
applied here is over-engineering.

| | |
|---|---|
| **Producer** | a user act on the support surface → `authorize()` → DP2 applies the classification ceiling → DP8 stores → DP3 writes a `DataAccessEvent` **and** a `DisclosureRecord`, because the artefact leaves the tenant |
| **Shape** | G64's precedent for compliance submission applies exactly: *"a filtered, signed **export** reusing `createExport` and the evidence chain rather than a new subsystem"* |
| **Guarantee / ordering / back-pressure** | n/a |
| **Crosses the plane** | it leaves the **tenant**, which is a disclosure. Under BYOA it leaves the customer's **account** — which is why the consent record matters |

**Three things a transport cannot fix and this document will not pretend to.**

1. **`DiagnosticBundle` is unmodelled.** Delta 9, *"Outstanding — L1 is where most
   diagnosis happens and it is unmodelled"* (`day-2-operations.md:726`).
2. **G41 shipped the mechanism without the assurance, knowingly.** *"a product that
   can send screenshots outward, without the record that says the customer agreed"*
   — and `Support.dc.html`'s own words: *"an app that can silently ship screenshots
   to a third party fails procurement."* Pass F's first non-demo customer is a
   regulated enterprise.
3. **It is un-buildable today** because **P10 is open** — portal upload or email —
   and P10 *"Affects what may be in it."*

**The one architectural rule I would add:** the bundle's contents must be composed
from the **same closed error vocabulary** and the **same `SpanAttributePolicy`
allow-list** as telemetry. `model/observability.ts:8-11` opens with the failure this
prevents: *"Telemetry gets built later, by a different team, under incident
pressure, and nobody classifies span attributes. By the time anyone checks, document
content is sitting in a trace store that half the company can query."* **A diagnostic
bundle assembled by a different path is that failure with a friendlier name.**

### 5.8 Endpoint connection status

**The stream the owner most likely imagines needs a probe — and a probe is
forbidden. Not by BYOA. By invariant 10.**

> G74 (`HANDOFF:674`): *"`EndpointHealth` as a row **beside** `Endpoint`, because
> `Endpoint.verifiedAt` is address **ownership**, not reachability — reading one as
> the other is §5.1 exactly — and because **no health poll may exist**: it would be
> a `system` act on a customer credential that `EndpointReading.authorizationId`
> refuses (invariant 10, not 3)."*

`EndpointReading.authorizationId` is `AuthorizationGrantId`, **non-nullable**
(`model/domain.ts:3439`), and `AUTHORIZATION_MAY_BE_ABSENT` admits only `system` —
which a credentialled reach is not. **This binds in v1's hosted topology exactly as
hard as it will in v2.**

| | |
|---|---|
| **Producer** | **DP9 Connector Gateway, on every authorised attempt.** Success or failure, the attempt updates the rollup |
| **Consumer** | the front-door screen. Reading it needs `endpoint` in the grant's resource set |
| **Transport** | none. A last-writer-wins rollup row, **not a time series and not a field on `Endpoint`** |
| **Guarantee** | best-effort. A lost update costs a stale light |
| **Ordering** | none |
| **Back-pressure** | none — one row per endpoint |
| **Consumer down** | the light goes stale. **`unknown` is not `unreachable`**, and that distinction is the fixture that catches §5.5's polarity bug |
| **Crosses the plane** | 🛑 **never.** Verify: `awk '/^export interface EndpointHealth/,/^\}/' model/domain.ts \| grep -cE 'sequence\|shippedAt\|dataPlaneId'` → expect 0 |

**Why not fields on `Endpoint`**, in green-indicator's own words: *"Writing
reachability through that row means a machine mutates a configuration record
continuously, and an audit of `configure_endpoint` — the capability that governs
where the platform reaches — fills with liveness noise."*

**The failure reason is a CLOSED CLASS, never the foreign system's message.**
Invariant 6 — *"a remote error string is ingested content, and rendering it on the
front door is an injection surface on the one screen everybody opens."*

**Do not confuse this with the plane heartbeat.** `docs/day-2-operations.md:551-563`
defines a **different** channel: `DataPlaneHeartbeat`, ~5 minutes, SigV4, *"Versions,
migration state, error counts by class, queue depth, sequence"*, gaps **tolerable**.
That is `deployment.ts`, **dropped whole under G36**, and `sendHeartbeat` is one of
the five contract operations that die with it. **A plane's liveness and an
endpoint's reachability are two facts with two owners and two failure modes**, and
`day-2` §6.4 names conflation as *"the mistake to avoid"*. Reusing the heartbeat
shape for endpoints would be §5.1 — a rule keyed on a convenient landmark.

🔴 **DECISION: there is no `view_endpoint` capability.** Today the only way to read
an endpoint is to hold the capability that **configures** one — read implied by
write, §5.6's shape. Minting it adds a member to a closed set and moves the
capability count from 36 to 37. `CAPABILITY_RESOURCE_CLASS` is a
`Record<Capability, …>`, so the compiler forces the classification.

---

## 6. The two rules that make all of this checkable

Everything above is assertion unless something can refuse a violation. Two rules do
the work, and both are cheap.

**R1 — the plane grant.** `cp_rw` holds **no `SELECT` on any `dp_*` relation**.
Green §13 item 1 calls this *"invariant 3's entire v1 enforcement"* and a
**DERIVATION**, not a decision. **Write that migration first.** With BYOA deferred,
the account boundary the prior architecture leaned on no longer exists —
*"In v1 invariant 3 is a database grant, not a network fact. If nobody writes that
grant, invariant 3 is a comment."*

**R2 — one lint rule over imports.** Green's CG1: no product service reaches a
store, a model, a tool, a blob or a foreign system directly. Extend it by three
edges specific to this document:

| | Forbidden import | Protects |
|---|---|---|
| a | anything outside DP7 importing a Bedrock or Textract client | stream 4's single producer, and invariant 7 |
| b | DP14 (agent runtime) importing the metering or token module at all | G73 + `DELEGABLE_TO_AGENT.view_metering = false` |
| c | the service-notice sender importing the digest builder | §5.5's exemption, structurally |

Green §14 is right that *"No tool here can check a service boundary"* today. These
two are the exception: a SQL grant and an import lint are both checkable the day
code exists, and neither needs an application to be running.

---

## 7. v1 → v2 (BYOA): what must be true, and what becomes irreversible

G36 slipped BYOA to v1+1 and its own row says the restore is *"a commit, not a
redesign"*. That is true **only if v1 holds ten properties it currently has no
reason to hold.** Every one of them is free now and expensive later.

### 7.1 The ten properties

| # | Property | Why it stops being cheap |
|---|---|---|
| **1** | **Every upward edge is a push; every downward edge is a pull initiated below.** Green §6.3's nine edges, no tenth of the wrong shape | With both planes in one account the temptation to `SELECT` across schemas is enormous. R1 is the enforcement |
| **2** | **The plane channel is authenticated as if it were already remote.** SigV4 to an HTTP endpoint, not an in-VPC call, not a shared connection pool | `docs/contracts/README.md:61-63` — *"`dataPlaneId` appears in no request body either — it is derived from the SigV4 principal"*. Deriving it from a body in v1 is a wire-breaking change in v2 |
| **3** | **`dataPlaneId` is populated on every `UsageRecord` from day one** | Its own comment: without it *"the gap check could not be run"*. *"Free now; a fleet-wide backfill later"* |
| **4** | **`UsageRecord.authorizationId` is populated from the first metered event** | *"NOT BACKFILLABLE … indistinguishable from a legitimate machine sample. The cut-over date is the only thing separating them, and it is not on the row"* |
| **5** | **`sequence` starts at 1 per plane and never re-bases** | A reset is exactly what the chain exists to expose. V10: *"an honest chain re-anchor is indistinguishable from a laundered counter reset"* |
| **6** | **C1 holds in v1: no synchronous control-plane call on the hot path**, even though the control plane is one hop away | Otherwise v2's latency and availability profile is a redesign, not a deployment |
| **7** | **RLS on and monthly partitioning retained**, even in a single-tenant plane | `data-architecture.md:134-136` — *"Redundant DDL is cheap; a forked schema is not"* |
| **8** | **Forward-only expand/contract migrations, adopted now or never** | `HANDOFF` §8 item 10: *"both become impossible after the first customer account exists"*. G36's one genuine relief — *"on a hosted fleet a bad migration is recoverable"* — expires at the first BYOA customer |
| **9** | **`EntitlementLease` and `UsageAttestation` stay declared and unbuilt** | They are `@dropped-for-v1`, not deleted. G36's restore path depends on them still being there. **Do not delete; do not build** |
| **10** | **Meters are emitted as if priced, even for meters BYOA will only report** | Delta 16 is open. `day-2:413-418` makes tokens and storage *"Reported only. Their bill"* under BYOA. A stream built only for meters we price will not exist for meters we do not |

### 7.2 What becomes irreversible once the first customer's data exists

**Ordered by how little time is left, not by size.**

| # | Irreversible thing | Deadline |
|---|---|---|
| **1** | 🛑 **The canonicalisation scheme (G20/E4).** *"Irreversible after the first hash, because re-canonicalising means re-chaining the history the chain exists to protect"* | **before the first `AuditEvent`** — i.e. before the first request the application serves |
| **2** | 🛑 **What is inside the canonical body — specifically whether `before`/`after` are hashed** (§5.6 item 3). Get it wrong and PDPA erasure permanently breaks the chain | same commit as (1) |
| **3** | **The chain itself.** *"Cannot be retrofitted. A series already signed without a chain cannot acquire one retroactively"* | first row of each stream |
| **4** | **`idempotencyKey` derivation.** If v1 mints a UUID and v2 uses the provider request id, a replay across the change double-counts into a table with *"no compensating instrument"* | first metered event |
| **5** | **The dedup key's arity — G30's `(idempotencyKey)` vs `(idempotencyKey, meter)`** | first metered event; it is a unique index |
| **6** | **Period-assignment semantics — `receivedAt` authoritative, never `recordedAt`** | first billing period. Changing it rewrites invoices |
| **7** | **Expand/contract migration discipline** | first customer account |
| **8** | **`RetentionPolicy`'s thirteen windows** — *"The thirteen windows have no values anywhere"*, and they are **counsel's**, not engineering's. §3a puts them on the critical path *"because a product stores a real customer's records under a real regime"* | first stored record |

⚠️ **Items 1, 2 and 3 are all one commit and it has not been written.** It has no
dependency on anything else in the plan. **It is the single highest-leverage thing in
this document.**

---

## 8. Failure modes

| Failure | Which streams | What happens today | What must be built |
|---|---|---|---|
| **Silent under-reporting** | 3, 4 | 🛑 **Nothing detects it in v1.** The floor was retracted; `UsageAttestation.drawdownHighWater` is the replacement and it is **`@dropped-for-v1` under G36**. In hosted we hold root, so the threat is ours to create, not the customer's — which is why it is tolerable now and not in v2 | v2: restore `UsageAttestation` + `EntitlementLease`. **Do not reinvent a floor** — `HANDOFF` §6 |
| **Duplicate delivery** | 3, 4 | **Solved by design.** Unique index on `idempotencyKey` (`persistence-design.md:130` — *"that is the mechanism, not the comment"*) | ⚠️ **G30's arity is unsettled and one inference produces two meters.** §5.3 |
| **Duplicate delivery** | 5 | not solved. A retried digest sends twice | idempotency key per `(digestId, recipientId)`; store Slack's `ts` and `chat.update` on retry |
| **Out-of-order arrival** | 3 | tolerated. Gap detection is by `sequence`, not by arrival order; period assignment is by `receivedAt` | ⚠️ **partial-batch rejection makes a gap ambiguous** — §5.3's derivation. `UsageIngestAck` needs a rejected list |
| **Out-of-order arrival** | 6 | **cannot happen** — the chain is serialised, and if it could, it would be a chain break | — |
| **Clock skew** | 3 | **Solved.** *"Their clock is theirs, our period"* — `receivedAt` authoritative | the **replay horizon** is a number nobody has picked |
| **Clock skew** | all | ⚠️ **`Timestamp = string` in `model/kernel.ts:422` is a naked alias.** *"a field typed `Timestamp` reads as checked and accepts any string."* **Anything ordering by timestamp inherits this** | the `Timestamp` branding sweep, already recorded and unowned |
| **A chain gap** | 6 | the chain breaks and **that is the feature** — *"It makes a deleted row and an edited row detectable"*. It does **not** defend against a root holder rewriting the whole chain | `ChainAnchor`, and in v1 it does not ship (§5.6). ⚠️ **A gap caused by an application bug is indistinguishable from tampering** — which is why the audit write must be in-transaction and must fail the act |
| **A notification never sends** | 5 | 🛑 **Today `customerNotifiedAt` is never set, so `evaluateTenantAccess` refuses every grant, forever.** Not a delivery failure — a missing closed list | `SERVICE_NOTICE_KINDS`. **DERIVATION**, drafted in `green-agent-bi-slices.md:583` |
| **A notification never sends** | 5 | channel-side: `403 MessageWritesBlocked` / `app_uninstalled` | first-class tenant states + `app_uninstalled` → purge tokens and derived data in 14 business days **including backups** — ⚠️ *"`RetentionPolicy` currently has no concept of purging from backups"* |
| **Consumer permanently behind** | 3 | the buffer grows in Postgres. **Under BYOA it grows on the customer's disk** | a buffer-depth alarm on the plane, surfaced to the customer. **Not modelled.** Nearest existing shape is `DataPlaneHeartbeat.queueDepth`, dropped with `deployment.ts` |
| **Consumer permanently behind** | 5 | digests coalesce, then the window is meaningless | a max-window rule and a "digest suppressed, N items" notice |
| **The outbox shipper dies mid-batch** | 3 | rows stay `shipped_at IS NULL`; the next shipper re-sends; CP5 dedups | ✅ correct by construction. **This is the argument for at-least-once over exactly-once** |
| **Postgres is down** | all | nothing happens, which is the correct behaviour for a system whose records are its product | — |
| **The canonicaliser changes** | 6 | 🛑 **every stored chain is invalidated and cannot be revalidated** | pin the library version; commit golden vectors; treat a bump as a breaking change |

---

## 9. What I am NOT recommending, and which constraint kills each

Industry-standard patterns first, because those are the ones somebody will propose
next month.

| Not recommended | Killed by |
|---|---|
| **A domain-event bus (Kafka/MSK, Kinesis, EventBridge, SNS/SQS) in the data plane** | Three separately: **no second engine** (`HANDOFF:412`); **BYOA operability** — the customer runs and pays for it, on a footprint whose *"cost floor determines the smallest deal BYOA makes sense for"*; and **no shared transaction**, which is the only property every record stream here needs (§2.3) |
| **CDC / logical replication (Debezium) of the data-plane DB into a central store** | 🛑 **Invariant 3 with extra steps, and nobody has named it.** It is a continuous upward read of tenant data with no authorisation, no `DataAccessEvent`, and no resource-class check. It is the most seductive answer available and it is the worst one |
| **A central telemetry resolver deriving audit or billing records** | The **retracted floor** (`HANDOFF` §6); **invariant 10** — `SpanAttributePolicy` strips the principal by design; and the **erasure taxonomy** — telemetry is `out_of_reach` |
| **Langfuse's Metrics API as a billing source** | Same three. It is a legitimate **Observed** cross-check (`day-2:371`) and nothing more |
| **A health prober polling endpoints** | 🛑 **Invariant 10**, via `EndpointReading.authorizationId` being non-nullable (G74). And under BYOA, *"No inbound access"* |
| **A central collector pulling from data planes** | Invariant 3 (C3 — *"never a query into a data plane"*) and *"a push needs inbound access to a customer account and a security team will not grant it"* |
| **A JWT / signed-claims authorisation token to avoid the DB read** | `model/access.ts:1495-1499` refuses it explicitly: *"A signed self-describing token is fast precisely because nobody loads the row — and a revoked assignment, a disabled user or a lapsed partner grant then stays effective until the token expires"* |
| **Kinesis Firehose → S3 → Athena for the audit trail** | `RETENTION_RECORD_KIND.audit_event = 'business'` — it must be **erasable**, and S3+Athena makes an erasure a file rewrite. Also `data-architecture.md:213` — *"Volume does not determine kind; erasability does"* |
| **OpenTelemetry logs as the audit trail** | Same, plus the allow-list strips exactly the fields an audit needs |
| **A separate analytics/OLAP store for `AuditEvent` or `PolicyEvaluation`** | Not forbidden, but **premature**: `persistence-design.md:226-229` — *"Only then consider a separate store, and only for `PolicyEvaluation` and `AuditEvent`, and only once partitioning demonstrably fails."* The three conditions that keep that door open — no FK into business data, PII-free by construction, an idempotency key on every row — must hold from day one |
| **Publishing `ExceptionRaised` and letting a notifier fan out** | §8.4 — authority is evaluated **per recipient at send time**, which a publisher cannot compute. Independently, a per-exception firehose is a **Teams terms violation** |
| **A DLQ that silently absorbs metering failures** | *"revenue you cannot invoice and cannot prove"*. The contract's partial-batch semantics are the correct shape; a DLQ that nobody reads is not |
| **A `TelemetryService`** | Green §9 already refused it: under G36 telemetry is internal hygiene, and `SpanAttributePolicy` binds in **DP2**, where the ceilings live |
| **A CQRS read-model projection service** | Green §9: *"`Exception` already carries denormalised queue columns by design. A projection service is a second write path to the product's home screen"* |
| **Exactly-once delivery anywhere** | It does not exist over a network. **At-least-once plus a unique index is exactly-once where it matters**, and the model already chose it |
| **Sampling the audit stream the way `PolicyEvaluation` is sampled** | `AUDIT_MUST_OUTLIVE` and the PDPA obligation. Sampling is legitimate for an **operational** record and never for a **business** one — the taxonomy is doing real work here |

---

## 10. What this document needs somebody to decide

Ten items. Per the standing rule — *if it is a derivation it is not deferrable, you
are just choosing to ship it wrong.*

| # | Item | Kind | Who |
|---|---|---|---|
| **1** | 🛑 **Apply G20 — one JCS canonicaliser, one commit, golden vectors** | **DERIVATION** | engineering, before the first request |
| **2** | 🛑 **What is inside the canonical body — are `before`/`after` hashed?** Erasure and tamper evidence are otherwise mutually exclusive (§5.6) | 🔴 **DECISION** | owner + counsel, same commit as 1 |
| **3** | **`SERVICE_NOTICE_KINDS` + `NOTICE_CARRIES_TENANT_DATA`.** Without them every support grant fails forever. Drafted in `green-agent-bi-slices.md:583` | **DERIVATION** | engineering |
| **4** | **The chain serialisation mechanism** — head row + `FOR UPDATE` (recommended), or per-commit Merkle batching (a model change) | 🔴 **DECISION** | engineering + owner |
| **5** | **G30's dedup arity** — `(idempotencyKey)` or `(idempotencyKey, meter)`. §5.3 derives the second | **DERIVATION** | engineering, before the first meter |
| **6** | **A fourteenth `RetentionClass` for `AuthorizationGrant`**, classified `business` | 🔴 **DECISION** — it adds a member to a closed set | owner |
| **7** | **Does `PolicyEvaluation` join the spine?** It carries no `authorizationId` today (§5.2) | 🔴 **DECISION** | owner |
| **8** | **Is `ReconciliationRun.tokenUsage` a stored column or a derivation over `UsageRecord`?** G74's ruling applied to a second type | 🔴 **DECISION** | owner |
| **9** | **`view_endpoint`** — capability 37, so endpoint status is not read-implied-by-write | 🔴 **DECISION** | owner |
| **10** | **The replay horizon** — how far back a buffered meter may be allocated to its own period | 🔴 **DECISION** | owner (it is a commercial number) |

> ✅ **NONE OF THE TEN WAS CLOSED ON 8 Aug 2026 — say so plainly rather than let a
> long ruling list imply otherwise. Four of the eighteen rulings taken that day
> constrain this document without answering a single row above.** Recorded here
> with G-numbers so the next reader does not re-derive them:
>
> | Ruling | What it settles for this document |
> |---|---|
> | **G103** | **No Redis.** The extraction-rule cache is a tenant-scoped Postgres table, on the erasure/RLS argument, not on preference. Confirms §4.2's "adds no engine" line for a subsystem this document never covered |
> | **G104** | **No model id in engine code.** The catalogue is the only source, seeded with `claude-haiku-4-5-20251001`; the engine calls `resolveModel()`, so **invariant 7 keeps its only executable enforcement** and this does not become a sixth instance of E5. Bears on §5.4 `TokenUsage`: the model identity a token-usage event carries comes from a published `ModelCatalogEntry`, not a literal |
> | **G105** | **N:M matching is bounded subset sum first, FIFO waterfall as fallback**, with a hard bound and a **stated, logged fall-through**. An exact combination is a MATCH; the waterfall is a JUDGEMENT. Bears on the audit stream in §5.6: the two must not be recorded as the same kind of event |
> | **G107** | **The reconciliation pipeline is DATA-PLANE.** See the block under §4.2's verdict — ⚠️ it puts EventBridge in the data plane, which this document's verdict forbids, and **the two are not reconciled here** |
>
> **Taken is not applied.** No `model/` file, no contract and no code changed for any
> of the four.

---

## 11. My three least-confident calls

**1. The audit chain as a per-tenant serialisation point on every mutating
request (§5.6).** I am confident it is *correct*; I have no evidence it is
*affordable*. There is no application, no benchmark, and `PRODUCT.md` forbids
inventing one. The per-commit-Merkle alternative would cut the lock rate by the
events-per-transaction factor and changes `RecordChain`, which is a model edit I was
not asked to make. **What would settle it:** a load test at the target write rate
against Aurora Serverless v2 at the minimum ACU — which is **P9, already open** in
`HANDOFF` §4.2 and framed there as *"A cost-floor question, not a load question."*
**It is now both.**

**2. That notification materialisation-per-recipient is affordable at all
(§5.5).** §8.4 makes a digest to N recipients cost N `authorize()` calls, N scope
intersections and N `DataAccessEvent` rows — every one of which is a chain-serialised
write under call 1 above. On a timer. For every tenant. **If the digest is nightly
across a large finance team, notifications become the single largest source of audit
chain contention in the system, and nobody has counted it.** I still recommend it,
because the alternative is publishing content-bearing digests without the ceiling,
which §8.4 exists to forbid. **What would settle it:** recipient counts and digest
cadence per tenant — which do not exist, because there are no customers.

**3. That `ChainAnchor` is safe to defer to v2 (§5.6).** My argument is that under
G36 we hold root over the database, so the customer-rewrites-history threat does not
arise. **The counter-argument is that the anchor also defends against *us*, and pass
F's first non-demo customer is a regulated enterprise that may reasonably ask who
guards the guard.** An anchor is one scalar and one endpoint; deferring it saves
almost nothing and the property cannot be acquired retroactively for the period it
did not cover. **I would not argue hard against shipping it in v1.** **What would
settle it:** whether the first customer's security review asks for third-party
attestation of the audit trail — a question a procurement questionnaire answers and
this repository cannot.

---

## 12. What this document cannot verify

Said plainly, because `CLAUDE.md` requires it.

- **No tool here can check a transport.** `tsc` compiles types; `extract.mjs` sees
  id-shaped fields and branded aliases; `check-doc-counts.mjs` reads Markdown counts.
  **None of the three can tell whether a meter row was written outside its
  transaction.** §6's two rules are the only checkable things in this document, and
  both need code that does not exist.
- **Every AWS cost claim in §4.2 is a cost *shape*, not a figure.** No pricing page
  was fetched. `docs/notifications-channels.md:176` — *"Azure Bot Service pricing —
  not fetched. Do not budget without it"* — is the standing precedent, and §3c is the
  precedent for verifying rather than reasoning.
- ⚠️ **Langfuse self-hosted carries its own infrastructure and this record does not
  discuss it.** *(General knowledge, flagged as such: Langfuse v3+ self-hosted
  requires ClickHouse, Redis and S3 alongside PostgreSQL.)* If that is current,
  then **"no second engine" is already breached by the telemetry backend under
  BYOA**, where the customer would run all of it. `docs/integration-options.md:1195`
  chose Langfuse self-hosted on licensing and cost-attribution grounds and says
  nothing about its dependencies. **This must be verified against Langfuse's current
  self-hosting documentation before BYOA is costed, and it may change the telemetry
  answer entirely** — the alternative being Langfuse Cloud, which is a cross-border
  transfer, or OTLP to the customer's own backend, which `TelemetryExport` already
  models and which makes the erasure gap explicit rather than ours.
- **Two documents in the record contradict each other on material this rests on.**
  (a) `day-2-operations.md:371` still names *"Control-plane events"* as an Observed
  source; `data-architecture.md:410-428` retracted exactly that a day later. (b)
  `byoa-topology.md:231` carries a three-value `DeploymentMode` and `:249` a
  four-value `health` enum; both are superseded (`data-architecture.md:476`,
  `day-2:592-605`). I have followed the later document in both cases and flagged it
  rather than smoothing it.
- **`docs/notifications-channels.md` is not the notification channel model.** It is
  Teams/Slack vendor research. The model is `docs/access-and-agency.md` §8.4, §10.1
  and §10.6. Anyone reading the filename and stopping there will build the wrong
  thing.
- **Nothing here has been executed against anything.** There is no application, ~~no
  test framework,~~ no CI, and no `.github/` on this branch. ⚠️ **The test-framework
  clause went false on 8 Aug 2026**, hours after this was written: `package.json`
  now carries `"test": "npm run typecheck:tests && node --test …"` and `tests/model/`
  holds two files, one of which asserts every `model/` module is runtime-importable.
  **Nothing in this document is executed by them** — the rest of the sentence stands,
  and §6's two rules still need code that does not exist. ⚠️ **G108 rules that every
  checker and `npm test` join a single `npm run check` gate and that CI runs only
  that**, so when CI arrives it will run the same command a contributor runs. Taken,
  not applied — there is still no `.github/`.
- **The tree moved during this pass.** Exports read 685 here against 684 and 683 in
  two documents written in the last day. Re-run §0.

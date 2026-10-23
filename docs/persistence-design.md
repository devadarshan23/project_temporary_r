# Persistence Design — Relational, Non-Relational, Blob

> **STATUS:** SUPERSEDED
> **V1 AUTHORITY:** NO — read it for the reasoning; the answer is elsewhere.
> **Successor:** `docs/data-architecture.md`, which explicitly supersedes this file's §10 open questions and is the decided shape. Several of those questions have since been answered and are still posed here as open — Aurora Serverless v2 versus provisioned, and row-level security versus schema-per-tenant, were both settled. Its §11.5 is the one place in the record that stated the `PolicyEvaluation.reason` closed-vocabulary rule correctly, which `docs/HANDOFF.md` §6 credits — that part is worth reading. ⚠️ One question argues from what *a demo* needs; **G48 made v1 a product, not a demo.**
> *Banner added 8 Aug 2026.*
> ✅ **But §0 is the part of this file that is NOT superseded, and it was CONFIRMED on 8 Aug 2026 rather than amended.** G103 refused Redis using §0's argument, unchanged, as the reason. See the block at the end of §0 — including the rejected alternative, preserved so a reopening starts from the argument rather than from scratch. **Nothing else on this page moved.**
> ✅ **§0 WAS CONFIRMED A SECOND TIME ON 12 Aug 2026 — G185 used it, unchanged, to REFUSE two database instances split by plane. Read §0.2 before concluding from G185 that §0 lost; it did not.** 🛑 **But *"nothing else on this page moved"* is a sentence about 8 Aug and it is FALSE as of 12 Aug, so it is corrected here rather than deleted.** Three things on this page moved the same day, all under G185 and all recorded in place: **§7's recommendation became the APPLIED shape** and gained the region axis; **§8's *"regional instance"* residency row became a decided cluster boundary**; and **§10 question 3 is answered** — on a different axis from the one it asks about. §2.1's placement of the `Tenant` row moved too: it is **control-owned**, with a narrow data-plane projection. **None of it is built.**

> **Status:** design record.
> **Date:** 4 Aug 2026
> **Scope:** where each entity in `model/` physically lives, and what must hold
> across the boundaries.

---

## 0. One qualification before the classification

The three-way split is the right question. But **"non-relational" should mostly
mean a JSONB column inside PostgreSQL, not a second database.**

The reason is not preference. Four of the model's invariants are enforced *by
the store*:

| Invariant | Mechanism |
|---|---|
| Tenant scope is derived, never asserted | row-level security |
| Exactly one cross-tenant read path | a single RLS predicate |
| Erasure reaches every copy | `SubjectIndexEntry` → deletable rows |
| Money is derived, never stored twice | transactional consistency |

A second database means **re-implementing all four in a second place**, with a
second set of failure modes and no transactional relationship between them. The
erasure contradiction the red team found — purging a document leaves the values
in `Explanation` — becomes materially harder to fix when those two rows are in
different engines with no shared transaction.

> ⚠️ **The left column of that table is shorthand, not the invariants themselves.**
> The numbered enumeration lives **only** in `CLAUDE.md`; copy from there, never
> from here. Noted 8 Aug 2026 because the table is now being cited from elsewhere
> — reproduce the citing set with:
>
> ```bash
> grep -rln "persistence-design.md.* §0" docs/*.md docs/build/*.md CLAUDE.md README.md
> ```

So the recommended shape is **two stores and a telemetry backend**, not three
databases:

```
PostgreSQL      relational + semi-structured (JSONB) — one isolation boundary
S3              blobs, and only blobs
Telemetry       traces and spans — never enters our database
```

Where a genuine non-relational need exists — high-volume append-only tables —
the first answer is **declarative partitioning inside PostgreSQL**, not a
different engine. §6 covers when that stops being true.

### 0.1 CONFIRMED 8 Aug 2026 — G103 tested this argument and it held

**This is recorded as evidence FOR the position above, not as a change to it.**
Nothing in §0 moved; a proposal arrived that §0 already answered, and the answer
was the one §0 gives.

**The proposal.** A reconciliation deployment architecture named **ElastiCache
(Redis)**, "optional but recommended", caching LLM-derived extraction rules for
sub-millisecond retrieval during normalisation.

**The ruling — G103: no Redis. The extraction-rule cache is a tenant-scoped
PostgreSQL table.**

**And the reason was this section's, verbatim in its shape:** the cached object is
**tenant-derived**, so a cache would put a tenant's data **outside RLS, outside
`RetentionPolicy`, outside the erasure plan and outside `SubjectLocation`** — a
place the erasure machinery cannot name. That is the **first and third rows** of
the table above — row-level security, and `SubjectIndexEntry` reaching every copy
— and it is §11.6's *"four invariants stop being enforced by one mechanism"*
arriving as a live decision rather than as a hypothetical. Pass F's rule is intact:
*"Two stores plus a telemetry backend, not three databases … No second engine"*.

> ⚠️ **That quote is cited without a line number on purpose.**
> `grep -n 'Two stores plus a telemetry' docs/HANDOFF.md` returned **436** on the
> morning of 8 Aug 2026 and **577** the same afternoon, while three workflows were
> editing the record concurrently. `docs/HANDOFF.md` §7 records that *a citation
> with no branch qualifier is a dead citation*; **a citation with a stale line is
> equally dead and reads equally valid**, and `tools/check-citations.mjs` resolves
> `.ts` and `.yaml` targets only — a Markdown line citation rots unchecked. **Cite
> the quote and the grep.**

**A second problem §0 does not cover and which is recorded here so it is not
lost:** the object proposed for caching is a **cross-tenant regex cache** — a
pattern inferred from tenant A's strings, applied to tenant B's. That is an
inference-time tenancy question, not only a storage one, and it would need
answering even if the cache were a Postgres table. It is not answered anywhere.

#### The rejected alternative, preserved

**It would have worked. It was refused, and this is what to start from if it is
reopened:**

> A **tenant-partitioned Redis**, keyed so that a tenant's entries are separable;
> a **TTL bounded inside the retention window**, so the cache cannot outlive the
> policy; and a **new `SubjectLocation` variant** so an erasure plan can name the
> copy — the same move `docs/data-architecture.md` §10.1 already made to reach a
> blob and a trace, and the shape **G80a** needed for the BI dataset.

**Why it was refused anyway, with the cost on both sides stated:**

1. It **reverses a pass-F decision** — the two-store rule — for a performance claim
   that has **never been measured**.
2. It adds **an engine to operate, patch, bill and teach the erasure machinery
   about**, and §11.6 prices that: not the store, but four invariants enforced in
   two places instead of one.
3. `docs/integration-options.md` separately flags Redis among the products that
   *"have all relicensed in recent years"* (`grep -n 'relicensed in recent years'
   docs/integration-options.md`), so the licence would need re-verifying at the
   version adopted.

⚠️ **Reopen it with a measurement, not an assumption.** If sub-millisecond
retrieval genuinely binds under fan-out, that is a real argument and the shape
above is the one to argue it with. A Postgres table on a warm index is not
sub-millisecond, and nobody has shown that it needs to be.

### 0.2 CONFIRMED 12 Aug 2026 — G185 refused a second database instance, and §0 is the reason

**This is recorded as evidence FOR §0, not as a change to it — and it is written
out because a reader who meets G185 first could easily conclude the opposite.**
G185 splits the database **by residency region**, so the record now says *more
than one PostgreSQL instance* in the same breath as §0 says *not a second
database*. **Both are true, and the distinction is the whole of §0's argument.**

**What was put to the owner:** two database instances, **one per plane** — control
in one, tenant in the other. **It was refused**, and one of the two reasons given
is this section, quoted in the ruling:

> re-implementing all four [invariants] in a second place, with a second set of
> failure modes and no transactional relationship between them

That is the same reasoning **G103 used to refuse Redis four days earlier** (§0.1),
applied to a proposal that was not a cache. The other reason is
`docs/data-architecture.md` §4: the plane boundary is already held by a **grant**,
a positive control the database evaluates on every statement, where two instances
would give only the **absence of a route**.

**Why a per-region instance is NOT the thing §0 argues against.** §0's cost is
four invariants enforced in **two places for one tenant's data**, with no shared
transaction between them. A residency instance does not do that: it holds the
**same schema** and the same four mechanisms, and **no tenant's data spans two of
them** — `Tenant.residency: RegionKey` (`model/domain.ts:882`) picks exactly one,
and §7 below says tenant data never crosses a region. Splitting by **plane** would
have put the `control` and `tenant` schemas of the *same* tenant's execution in
two engines; splitting by **region** partitions tenants, not invariants. *(This
paragraph is the distinction G185 turns on, stated here because §0 predates the
axis.)*

⚠️ **What §0 does NOT dissolve, and G185 accepted it explicitly.** Per-region
instances still cost: **migration timelines multiply with no skew detector** —
each instance carries its own `schema_migration` ledger (`db/migrate.ts:28`) and
nothing compares them, while the always-deployed-first rule at
`docs/contracts/control-plane.openapi.yaml:107` governs the **wire** and has no
schema equivalent — and there is **no consistent restore point across regions**.
⚠️ **And one new copy lands where §0 is most sensitive:** retiring `control_ro`
puts a **data-plane-local projection** of published packs, policy and the narrow
`tenant` row beside tenant execution, which **must be named in `SubjectLocation`
or erasure cannot address it**. That is §0's third row — `SubjectIndexEntry`
reaching every copy — and it is the hole G103 refused Redis to avoid.

🛑 **Nothing is built.** No second instance of any kind, no projection, no
`control` or `tenant` schema: `db/migrations/` holds one file.

---

## 1. Blob — S3

Unambiguous. Content, not records.

| What | Notes |
|---|---|
| Source document files (PDF, images, spreadsheets) | Addressed by `SourceDocument.storageRef` |
| Extraction artefacts (page renders, crops for provenance display) | Derived; regenerable |
| Exported reports and CSVs | `export_csv` and equivalents |
| Signed solution-pack bundles | `SolutionPack.signature` covers these |

**Layout must encode the isolation boundary, because S3 has no RLS:**

```
s3://reconcileai-{region}-tenant-data/
  tenant={tenantId}/
    documents/{sourceDocumentId}/original.pdf
    documents/{sourceDocumentId}/page-{n}.webp
    exports/{exportId}.csv
```

- **Tenant prefix is the first path segment**, so an IAM condition on
  `s3:prefix` is expressible. A tenant id buried mid-path cannot be constrained.
- **Per-tenant KMS keys** where a customer asks for customer-managed keys — a
  standard enterprise requirement and the reason the prefix matters.
- **Bucket per region**, never a global bucket with regional prefixes.
  `Tenant.residency` must be satisfiable by bucket selection alone.
- **Object lifecycle rules** implement retention; they are the S3 equivalent of
  `purgeAfter`, and they must be reconciled against `RetentionPolicy` rather
  than configured independently.

**Never in S3:** anything queried by content. If it needs a `WHERE`, it is not a
blob.

---

## 2. Relational — PostgreSQL

Everything with an identity, a relationship, or a query pattern.

### 2.1 Tenancy and identity

`Account` · `Tenant` · `Partner` · `User` · `Membership` · `RetentionPolicy`

Small, read-constantly, and the root of every authorization decision. `Membership`
is the hot path for every request and needs a composite index on
`(user_id, tenant_id)`.

⚠️ **AMENDED 12 Aug 2026 — G185: the `Tenant` row in that list is CONTROL-OWNED,
and this line said nothing about which plane it lives in.** The list is left as
written because the storage answer — relational, PostgreSQL — is unchanged; what
G185 adds is the **plane**. G50 makes tenant provisioning a control-plane act, so
the row belongs to the `control` schema, and the data plane holds a **narrow
projection of `id`, `status`, `residency`** — the columns the RLS predicate
(`db/migrations/0001_tenancy_and_rls.sql:174-176`) and the residency check
actually read. `tenant_contact.tenant_id` (`:96`) re-points at that projection.
**Rejected: data-plane ownership**, because provisioning would then need a
`BYPASSRLS` credential reaching across the plane boundary, voiding what
`tests/db/tenant-isolation.test.ts` exists to assert. ⚠️ **Not built, and the built
table is narrower than the projection G185 names:** `tenant`
(`db/migrations/0001_tenancy_and_rls.sql:70-76`) has `id`, `name`, `account_id`,
`status`, `created_at` and **no `residency` column at all**.

### 2.2 Configuration

`DocumentType` · `FieldSpec` · `ReconciliationDefinition` · `MatchRule` ·
`MatchKey` · `LineMatchKey` · `SourceSlot` · `Sop` · `SopStep` ·
`InstalledPack` · `Policy`

Low volume, versioned, read on every run. Versioning means these are
**append-only in practice** — a new version is a new row, never an update.

### 2.3 Reconciliation

`ReconciliationPeriod` · `ReconciliationRun` · `MatchGroup` · `Exception` ·
`ResolutionProposal` · `ApprovalDecision`

`Exception` is the primary read surface and carries the denormalised queue
columns added in P1-3 — `domain`, `definitionId`, `ruleLabel`, `severityRank`,
`valueAtRisk`. Without them the queue is a three-join query at 100k open rows.

**`severityRank` exists because `ORDER BY severity` on the string union sorts
`critical, high, low, medium`.**

### 2.4 Governance

`AuditEvent` · `DataAccessEvent` · `TenantAccessGrant` · `AccessSession` ·
`PartnerAccessGrant` · `SubjectIndexEntry` · `SubjectKeyScheme` · `LegalHold` ·
`DataSubjectRequest` · `ErasurePlan` · `BreachRecord`

`SubjectIndexEntry` is the most important index in the system. It is what makes
erasure executable, and it must be indexed on `(tenant_id, subject_ref)`.

### 2.5 Commercial

`UsageRecord` · `RateCard` · `Subscription` · `BillingPeriod` · `RatedTotal` ·
`Budget` · `BudgetAlert` · `ProviderCostRecord` · `CostReconciliation` ·
`PlatformMarginLine`

`UsageRecord` needs a **unique index on `idempotencyKey`** — that is the
mechanism, not the comment.

### 2.6 Evaluation

`Scorer` · `ScoreResult` · `SeededExample` · `ObservedExample` ·
`HumanFeedback` · `EvaluationGate` · `GateResult`

Note the split: `SeededExample` is control-plane, `ObservedExample` is
tenant-scoped. They are different tables, not one table with a nullable tenant.

---

## 3. Semi-structured — JSONB columns, inside PostgreSQL

Variable shape, addressed by parent id rather than searched by content.

| Column | On | Why JSONB |
|---|---|---|
| `extracted` | `SourceDocument` | Shape is defined per `DocumentType`; there is no fixed schema |
| `lines` | `SourceDocument` | `ExtractedLine[]`, variable length and shape |
| `explanation` | `Exception` | Nested with `observed[]`, read whole, never searched |
| `spec` | `Policy` | Discriminated union across six kinds |
| `predicate` / `when` | `MatchRule` | Recursive `Expr` tree — relational modelling of this is a mistake |
| `members` / `keyValues` | `MatchGroup` | N slots, variable |
| `before` / `after` | `AuditEvent` | Arbitrary entity shapes |
| `trigger` | `ReconciliationRun` | Discriminated union |
| `rollout` / `posture` / `bindings` | `SolutionPack` | Nested config |
| `subject` | `ScoreResult`, `PolicyEvaluation` | Discriminated union |
| `scope` | `Budget` | Discriminated union |
| `actor` | `AuditEvent`, `DataAccessEvent` | Discriminated union |
| `location` | `SubjectIndexEntry` | Discriminated union |

**The rule:** a discriminated union or a recursive structure goes in JSONB. A
foreign key does not.

**Two things must be extracted to real columns** even though they live inside
JSON structures, because they are queried:

1. **`Exception.valueAtRisk`** — sorting the queue by exposure
2. **`SubjectIndexEntry.subjectRef`** — the erasure lookup

Anything else that turns out to need a `WHERE` gets promoted to a column with a
generated-column expression rather than being searched inside JSON.

---

## 4. Telemetry — neither, and deliberately outside

`TraceRef` · `TelemetryPolicy` · `TelemetryExport` · `SpanAttributePolicy` ·
`PartnerTelemetryAccess` · `PlatformTenantInspection`

These **policy and pointer** rows live in PostgreSQL. The traces themselves
never do — they go to the telemetry backend (Langfuse per
`docs/integration-options.md`), which has its own retention and its own
residency requirement.

`TraceRef.region` must equal `Tenant.residency`. A trace store in a different
region is a cross-border transfer of whatever the span attributes carry — which
is why `SpanAttributePolicy` is an allow-list.

---

## 5. Derived — materialised, never primary

`QualityWindow` · `CostAttribution` · `PartnerBillingSummary` ·
`PartnerHealthView` · `PlatformHealthWindow` · `EffectivePolicySet` ·
`ModelResolution`

Computed from primary data. Cache them as materialised views or summary tables
with an explicit refresh, but **never treat them as the source of truth** — and
never let a write path update them directly.

`EffectivePolicySet` in particular is computed per request and must never be
stored, or it will disagree with what was actually enforced.

---

## 6. The high-volume problem

Three tables dominate by row count. Estimates from the red-team operability
review, per mid-size tenant per month:

| Table | Est. rows/month | Note |
|---|---|---|
| `PolicyEvaluation` | ~1.41M | Written on allows as well as denials |
| `UsageRecord` | ~944k | One row per metered event |
| `AuditEvent` | high | Append-only, retained longest |

**First answer: declarative partitioning by month, inside PostgreSQL.** Detach
and drop old partitions rather than deleting rows — retention becomes a
metadata operation instead of a mass delete.

**Second: partial indexes.** `PolicyEvaluation` denials are roughly 1 in 1,000.
An index on denials alone is small and covers the query anyone actually runs.

**Only then consider a separate store**, and only for `PolicyEvaluation` and
`AuditEvent`, and only once partitioning demonstrably fails. The cost is real:
erasure would then span two engines with no shared transaction, and
`SubjectIndexEntry` would need locations in both.

> **`RetentionPolicy` currently covers three classes** — source documents,
> exceptions, audit. It needs at least five more: policy evaluations, usage
> records, scores, observed labels, traces. Flagged as P1 in the change ledger
> and still outstanding.

---

## 7. Control plane versus tenant data — the second axis

Physical placement has a second dimension the three-way split misses.

**Control-plane data has no `tenantId`** and must be readable in every region:

`SolutionPack` · `PolicyTemplate` · `RateCard` (wholesale) · `Plan` ·
`ModelCatalogEntry` · `ModelFallbackChain` · `SubProcessor` · `SeededExample` ·
`PackQualityReport`

**Recommendation: a separate schema, replicated per region, read-only in the
regional replica.** Writes go to a primary; regions read.

This matters because it is the *only* data permitted to cross regions. Tenant
data never does. Keeping the two in separate schemas makes that rule
checkable — a query joining across the schema boundary is visible in review,
where a query joining two tables in one schema is not.

### 🛑 RULED, NOT APPLIED — 12 Aug 2026, G185: this recommendation is now the DECIDED shape, and the REGION is the axis the database splits on. NOTHING IS BUILT

> ⚠️ **This heading read *"✅ APPLIED"* for the length of one editing pass and is
> corrected here rather than deleted, because in a record whose entire discipline is
> declared-versus-built, the heading is what a skimmer and a table of contents read.**
> `docs/HANDOFF.md` §3 marks G185 **`not applied`**, and §3 outranks this file. The
> ruling decides a shape; no migration, no projection, no per-region instance and no
> replica exists. The body below was always explicit that nothing is built — the
> heading contradicted its own paragraph.

🛑 **§7 IS SUPERSEDED BY G185, NOT PROMOTED BY IT — and this block said the
opposite for the length of one editing pass.** The recommendation is left exactly as
written above; what follows is what actually became of it. The original sentence,
preserved so the change is visible:

> **Recommendation: a separate schema, replicated per region, read-only in the
> regional replica.** Writes go to a primary; regions read.

**The half that survives** is the premise: control-plane data has no `tenantId`, must
be readable in every region, and is the only data permitted to cross one. G185 rests
on that and it is why the region became the split axis at all.

**The half that does not survive is the replica.** This block first recorded G185 as
ruling **ONE WRITER plus a READ-ONLY REPLICA PER RESIDENCY REGION**; the replica was
**withdrawn the same day**. Two reasons, the second decisive:

1. **Unbuildable as ruled.** G185 puts one cluster per residency region, and that
   cluster holds the writable `tenant` schema. A whole-cluster physical read replica
   is read-only cluster-wide, so it cannot also be the region's writable tenant
   database. The two halves of the ruling were mutually exclusive.
2. **No reader.** G185 also retires `control_ro`. Once the plane reads packs, policy
   and the model catalogue from its own **pulled, data-plane-local projection**,
   nothing in-region queries a control table over SQL at all. A replica would have
   been a second mechanism serving no query.

**The decided shape is therefore: ONE WRITER, NO REGIONAL REPLICA, and the regional
read path IS the projection built by the signed HTTPS pull.** It is a ruling, not a
deployment — **nothing is built**, and `docs/HANDOFF.md` §3 marks G185 `not applied`.

🛑 **And the sentence after it — *"it is the only data permitted to cross regions.
Tenant data never does"* — is the sentence G185 turned into a cluster boundary.**
`Tenant.residency: RegionKey` (`model/domain.ts:882`) is a live per-tenant field
over five values (`model/domain.ts:476-481`), §8 below already calls PostgreSQL
residency a *"regional instance"*, and G179 exists because an EU tenant misrouted
to a US plane fails open and is invisible. So the tenant side is **one cluster per
residency region**, not one cluster: `docs/data-architecture.md` §4 read *"Two
schemas in one Aurora cluster"* and **that half of decision F is amended there,
in place.**

⚠️ **What did NOT survive from this section's reasoning, and it is this file's
own sentence:** *"a query joining across the schema boundary is visible in
review."* `docs/data-architecture.md` §4 already answered that **review is not a
mechanism** and replaced visibility with a **grant** — and G185 keeps the grant as
the load-bearing half, refusing to replace it with two instances split by plane. A
grant is a positive control the database evaluates on every statement; two
instances are only the absence of a route.

⚠️ **One change to how the data plane READS this schema.** The role `control_ro`
— `SELECT` on `control`, added by `docs/data-architecture.md` §4 for exactly the
reads §7 is about — is **RETIRED**. A data plane does not read the `control`
schema at all; it **pulls published packs and policy over signed HTTPS** —
`/catalogue/packs` (`docs/contracts/control-plane.openapi.yaml:509`) and
`/policy/bundle` (`:660`) — **into a data-plane-local projection**, which is what a
BYOA plane in a customer's own AWS account has always had to do, there being no
`control` schema there to grant against. ⚠️ **That projection is derived
control-plane data sitting beside tenant execution, and it must be named in
`SubjectLocation` or erasure cannot address it** (§0.2;
`docs/data-architecture.md` §10.1).

---

## 8. What must hold across all three stores

The invariants do not weaken at a storage boundary.

| Invariant | PostgreSQL | S3 | Telemetry |
|---|---|---|---|
| **Tenant isolation** | RLS on `tenant_id` | prefix + IAM condition | per-tenant project/scope |
| **Residency** | regional instance — ⚠️ **as of 12 Aug 2026 this cell is a CLUSTER BOUNDARY, not a deployment detail: G185 makes it one PostgreSQL cluster per residency region, control-plane data on one writer with a read-only replica in each. See §7** | regional bucket | regional backend |
| **Retention** | partition drop / delete | lifecycle rule | backend retention |
| **Erasure** | `SubjectIndexEntry` → delete | delete by key | ⚠️ see below |
| **Encryption** | at rest, per-tenant CMK optional | SSE-KMS, per-tenant key | backend-dependent |
| **Audit** | `DataAccessEvent` | CloudTrail data events | access log |

### The erasure gap that remains

`ErasurePlan` has an `out_of_reach` disposition for a reason. Two cases are
genuinely hard:

1. **A trace already exported to a customer's own telemetry endpoint.** We
   cannot delete from their Datadog. `TelemetryExport.acknowledgedTransfer`
   exists so this is a disclosed consequence rather than a surprise.
2. **Backups.** Slack's terms require purging derived data from backups within
   14 business days; PDPA is less explicit. `RetentionPolicy` has no concept of
   backup purge at all, and PITR windows will outlive a deletion request.

Neither is solved. Both are recorded rather than glossed.

---

## 9. Recommended shape

```
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL (Aurora), ap-southeast-1                    │
│                                                          │
│  schema: control     replicated, read-only in region     │
│    packs · templates · rate cards · model catalogue      │
│                                                          │
│  schema: tenant      RLS on every table                  │
│    relational rows + JSONB columns                       │
│    partitioned: policy_evaluation, usage_record, audit   │
└─────────────────────────────────────────────────────────┘
        │                          │
        │ storageRef               │ traceId
        ▼                          ▼
┌──────────────────┐    ┌──────────────────────────────┐
│ S3, same region  │    │ Telemetry backend, same region│
│ tenant={id}/...  │    │ per-tenant scope              │
│ SSE-KMS          │    │ span allow-list enforced      │
└──────────────────┘    └──────────────────────────────┘
```

**One database engine. One isolation mechanism. Two satellites, each with a
narrow, well-defined contract.**

⚠️ **AMENDED 12 Aug 2026 — G185. The picture above is drawn at ONE REGION and the
caption under it is still true, which is the easy thing to get wrong here.** *One
database **engine*** stands — this is not a second store, and §0.2 records G185
refusing one. *One **instance*** was never claimed and is no longer implied: the
box labelled `PostgreSQL (Aurora), ap-southeast-1` is **one of N, one per
residency region**, each running the same schema and the same four mechanisms,
with no tenant's data spanning two. ⚠️ **This read *"Inside each, `schema: control`
is a read-only replica of a single writer (§7)"* until the replica was withdrawn the
same day. There is NO regional control replica:** the control schema has one writer,
and each plane reads published control artefacts from its own **pulled local
projection** — see the superseded-not-promoted block in §7.

⚠️ **And one line in the box has been retired.** `schema: control  replicated,
read-only in region` describes the replica correctly, but the data plane no longer
**reads** it: the role `control_ro` is gone and published packs and policy arrive
by **signed HTTPS pull into a data-plane-local projection**
(`docs/data-architecture.md` §4). The diagram is left as drawn rather than
redrawn, because it is what a reader would have trusted. **Nothing here is
built.**

---

## 10. Open questions

1. **Aurora Serverless v2 or provisioned?** Serverless suits uneven demo load; provisioned suits predictable production. Affects cost modelling, not the schema.
2. **Per-tenant CMK from the start, or on request?** Retrofitting customer-managed keys onto existing objects is a re-encryption exercise.
3. **Does the control-plane schema live in the same cluster or a separate one?** Same cluster is simpler; separate makes the cross-region replication story cleaner.
   > ✅ **ANSWERED 12 Aug 2026 — G185, and the question is left standing because the answer arrived on a DIFFERENT AXIS from the one it asks about.** `docs/data-architecture.md` §4 closed it as *"same cluster"* on 4 Aug. G185 keeps the control and tenant **schemas** in the same cluster — the plane split stays a **grant**, and two instances split by plane were **refused** — and splits the cluster on **residency** instead: **one cluster per region**, with control-plane data on **one writer and a read-only replica in each region**. So the second clause of this question turned out to be the live one: the cross-region replication story is exactly what decided it, just not in the direction the question offers. **Not built.**
4. **PITR window versus erasure obligation.** A 35-day PITR window means a deleted subject remains recoverable for 35 days. Needs a documented position. ⚖️
5. **`RetentionPolicy` needs five more classes** before any of this is implementable as specified.
6. **Schema-per-tenant versus RLS?** RLS is recommended — schema-per-tenant does not scale past a few hundred tenants and makes migrations combinatorial. Recording the choice so it is not silently revisited.

---

## 11. Addendum — "keep PII out of transactions and put volume in NoSQL"

A proposal raised 4 Aug 2026: avoid PII in transactional data so the
high-volume tables can live in a NoSQL store, leaving PDPA obligations confined
to a smaller relational core.

**Half of this is right. The half that is wrong is load-bearing.**

### 11.1 The reconciliation transactions *are* the personal data

The premise assumes PII is incidental to transaction rows and can be factored
out. In this product it is not incidental — it is the payload.

| Entity | Carries personal data? | Why it cannot be factored out |
|---|---|---|
| `Exception` → `Explanation` → `ObservedValue.scalar` | **Yes, by design** | The observed value *is* the passport name or the DOB. Removing it removes the explanation, which is the product thesis. |
| `MatchGroup.keyValues` | **Yes** | In the shipped KYC pack the match key is a national identifier. |
| `SourceDocument.extracted` | **Yes** | The extraction is the personal data. |
| `AuditEvent.before` / `after` | **Yes** | Auditing a correction to an extracted value means storing that value. |
| `ScoreResult.rationale` | **Likely** | A model-graded rationale quotes the content it judged. |

A KYC verification exception without a name and a date of birth is not a
redacted exception; it is not an exception. **You cannot move "the transactions"
to a store that holds no PII, because in KYC the transaction is the PII.**

### 11.2 Where the proposal *is* right

Two tables genuinely are PII-free and genuinely have NoSQL-shaped volume:

| Table | Est. rows/month/tenant | Personal data |
|---|---|---|
| `UsageRecord` | ~944k | None. Tenant, meter, quantity, model, cost centre. |
| `PolicyEvaluation` | ~1.41M | None **if** `reason` is constrained to policy vocabulary. |

At 40 tenants that is roughly **94M rows per month**, over 1.1 billion a year.
That is a real number and the concern behind it is legitimate.

These are **operational events**, not business records. They have no foreign key
pointing *into* business data that anyone traverses, they are append-only, they
are queried by time range and tenant, and nothing joins them to an `Exception`
in a transaction.

### 11.3 So the split is by record kind, not by PII

**Business records** — documents, runs, match groups, exceptions, approvals,
SOPs, subject index, grants. Transactional, joined, RLS-protected,
PII-bearing by nature. **PostgreSQL, not negotiable.**

**Operational events** — usage, policy evaluations, data-access events.
Append-only, time-ranged, PII-free by construction. **Movable.**

That is a cleaner line than PII-versus-not, and it survives contact with the
domain.

### 11.4 Reduce the volume before scaling the store

Before adding an engine, note where the 1.41M comes from: `PolicyEvaluation` is
written on **every** evaluation including allows, and denials are roughly 1 in
1,000.

The reason for writing allows is real — an allow nobody can evidence is
indistinguishable from an absent control. But that argument justifies
*evidencing* allows, not *storing every one individually*.

**Sample them.** Retain 100% of denials, `requires_approval` and `redacted`
outcomes; retain a 1% sample of plain allows, plus a per-window count of the
rest so the total is still provable. That is a ~95% reduction with the audit
property intact — and it is a smaller change than a second database.

Do this first. It may remove the problem entirely.

### 11.5 Recommendation

**Start single-store. Design the operational-event tables so they can leave.**

Three constraints that keep the option open at no cost:

1. **No foreign key from an operational event into business data.** Store ids as opaque values, never as enforced references.
2. **PII-free by construction**, not by convention — `PolicyEvaluation.reason` drawn from a closed vocabulary, not free text; `UsageRecord` carrying no content field at all.
3. **Idempotency key on every row**, so a replay into a different store is safe.

Then partition by month in PostgreSQL and measure. If the working set genuinely
outgrows it, those two tables move to DynamoDB or Timestream **as a migration of
append-only data with no referential integrity to preserve** — which is about as
cheap as a store migration ever gets.

### 11.6 Why not to split now

The cost of a second store is not the store. It is that **four invariants stop
being enforced by one mechanism**:

- tenant isolation becomes RLS *and* partition-key discipline *and* IAM conditions
- residency becomes two configurations that can drift
- erasure spans two engines with no shared transaction
- `SubjectIndexEntry` needs locations in both

For a platform with no production tenants yet, paying that today buys nothing.
Postgres with monthly partitioning handles this workload; the wall is further
away than it looks, and sampling moves it further still.

> ✅ **This paragraph was applied as a decision on 8 Aug 2026 — G103, §0.1.** The
> four bullets above are exactly the cost that refused an ElastiCache Redis for
> the extraction-rule cache. ⚠️ **Note the difference in the two cases**, because
> it matters if either is reopened: §11 argues about moving **PII-free operational
> events** to a second store, where the erasure argument is weakest. G103 was
> asked about **tenant-derived rules**, where it is strongest. **A future
> proposal must say which of the two it is.**

⚠️ **The PDPA argument does not survive either.** Even if the operational tables
hold no PII, they hold tenant-correlatable behaviour — volumes, timings, failure
rates. That is the same inversion `PartnerHealthView` exists to prevent
(`model/observability.ts`). Moving it to a store with weaker isolation would
reopen a hole we deliberately closed.

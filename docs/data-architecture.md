# Data Architecture — the decided shape

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** PARTIAL — authoritative for the plane split, the storage tiers and the record kinds; **not** for where v1 runs.
> **Its first stated premise is reversed.** The file opens on *"BYOA is therefore a **v1 target**, not a later packaging exercise"* — **G36 slips BYOA to v1+1**, and `model/deployment.ts` is `@dropped-for-v1` whole. The plane/schema/role split, the three storage tiers and the record-kind taxonomy all stand. ⚠️ **Residency is amended too:** G82 (8 Aug 2026) puts the BI layer in `ap-southeast-2` as a **standing** cross-region pipeline, which nothing on this page reflects — and it is **⚖️ not a commitment until counsel answers**. Still the blocker document for the schema. Not maintained; evidence, not a control.
> *Banner added 8 Aug 2026.*
> 🛑 **Amended 8 Aug 2026 by five rulings, each recorded in place beside the section it touches — G107 (§4a), G100 (§4b), G97 (§5a), G103 (§7), G106 (§9a).** None is applied to `model/` or to any DDL; **there is still no schema.** The amendments narrow what the schema must be, they do not report that it exists. 🛑 **AMENDED AGAIN 12 Aug 2026 — G185, and it is a sixth ruling, recorded in place in §4, §5, §10.1, §13 and §14.** It splits the database by **residency region, not by plane**: decision F's **grant SURVIVES**, its *"one cluster"* does not, `control_ro` is **RETIRED**, and the `tenant` row becomes **control-owned** with a narrow data-plane projection. **Nothing in G185 is built either** — no per-region instance, no projection, no `control` or `tenant` schema.

> **Status:** decision record. 4 Aug 2026.
> **Supersedes** the open questions in `docs/persistence-design.md` §10 and
> `docs/byoa-topology.md` §8 that are marked closed in §13 below. Both documents
> remain valid as the reasoning behind these decisions; this one is the answer.

Two inputs were supplied by the product owner and everything here follows from
them:

1. **The first non-demo customer is a regulated enterprise, sold directly.**
   BYOA is therefore a **v1 target**, not a later packaging exercise.
2. **The control-plane / data-plane split is enforced by separate schemas and
   separate database roles** in one cluster, not by a second cluster. ⚠️ **The words *"in one cluster"* went false on 12 Aug 2026 — G185 makes it ONE CLUSTER PER RESIDENCY REGION. Everything else in this premise SURVIVES and is the load-bearing half. The correction is written out in §4; do not read this line without it.**

---

## 1. Why no shape emerged before this

Four independent axes were being debated as if they were one. Two of them had a
value on the wrong axis.

| Axis | Values | Determined by |
|---|---|---|
| **Plane** | control · data | Architecture — fixed, not per customer |
| **Topology** | 1CH-hosted · customer-owned | Commercial, per customer |
| **Storage tier** | relational · JSONB · blob · telemetry | Shape of the record |
| **Record kind** | business · operational · derived · content · telemetry | Retention and movability |

**Stray 1 — sandbox was on the topology axis.** `byoa-topology.md` §3 draws
sandbox beside hosted and BYOA. But `Tenant.environment: 'sandbox' | 'production'`
already exists (`model/domain.ts:136`), and `data-governance.md` §2 states that
*"sandbox tenants are ordinary tenants; isolation is the same mechanism, not a
weaker one."* Sandbox is a tenant flag inside the hosted topology.

**Stray 2 — "NoSQL" was on the storage-tier axis.** The real question was record
kind. `persistence-design.md` §11.3 found the correct line — business records
versus operational events — and then filed the conclusion under storage engines,
where it reads as a database choice rather than a taxonomy.

Put each value on its own axis and the engine question answers itself.

---

## 2. The shape

```
┌──────────────────────────────────────────────────────────────────┐
│  CONTROL PLANE — 1CloudHub, ap-southeast-1                       │
│  schema: control · role: control_rw · NO grant into tenant       │
│                                                                   │
│  solution packs · policy templates · model catalogue             │
│  wholesale rate cards · plans · seeded examples · sub-processors  │
│                                                                   │
│  Publishes downward. Never reads tenant data — enforced by grant. │
└──────────────────────────────────────────────────────────────────┘
      │  signed packs, policy, model catalogue  ↓
      ↑  signed periodic aggregates only — never a query

┌───────────────────────────────┐   ┌───────────────────────────────┐
│  DATA PLANE — 1CH-hosted      │   │  DATA PLANE — customer-owned  │
│  1CloudHub account            │   │  customer AWS account         │
│  multi-tenant · RLS           │   │  single-tenant · RLS retained │
│  Tenant.environment           │   │                               │
│    = sandbox | production     │   │  regulated · residency-bound  │
│  SMEs · partner-sold · demos  │   │  large direct deals           │
└───────────────────────────────┘   └───────────────────────────────┘
      │                                     │
      └──────────── identical schema ───────┘
                          │
   ┌──────────────────────┼──────────────────────┐
   ▼                      ▼                      ▼
 PostgreSQL            S3, same region      Telemetry backend
 relational + JSONB    tenant={id}/…        per-tenant scope
 RLS on every table    SSE-KMS per tenant   span allow-list
 partitioned by month
```

**One schema. One isolation mechanism. Two satellites. Two topologies. Two
planes.** ⚠️ **AND, SINCE 12 Aug 2026, N REGIONAL INSTANCES OF THAT ONE SCHEMA — G185.** The picture above is drawn at **N=1 region** and shows neither the residency axis nor the retirement of `control_ro`: the data plane no longer reads the `control` schema at all, it **pulls published packs and policy over signed HTTPS into a local projection**. The `control_rw` role in the box survives; `control_ro` does not. Corrected in §4 rather than redrawn here, because the diagram is what a reader would have trusted.

---

## 3. Decision — two topologies, not three

Sandbox is `Tenant.environment`, already modelled and already enforced. It is not
a deployment topology and requires no separate infrastructure.

This is not a cosmetic correction. `byoa-topology.md` §2.1 charges fleet
operations as BYOA's largest cost by counting three deployment targets. There are
two, and only one of them is remote.

**No model change required.** `Tenant.environment` and `SourceDocument.synthetic`
already carry it.

---

## 4. Decision — the plane split is enforced by database grants

Two schemas in ~~one Aurora cluster~~ **one Aurora cluster PER RESIDENCY REGION** — ⚠️ **the struck words are what this line said until 12 Aug 2026; G185 moved them and the block at the end of this section says why** — and two connection roles:

| Role | Grants | Used by |
|---|---|---|
| `control_rw` | `control` schema only | Pack authoring, catalogue, rate cards, admin |
| `tenant_rw` | `tenant` schema only, RLS active | Every reconciliation path |
| ~~`control_ro`~~ | ~~`SELECT` on `control` only~~ | 🛑 **RETIRED 12 Aug 2026 — G185.** It read *"Data-plane reads of published packs and policy"*; those reads become a **signed HTTPS pull into a data-plane-local projection**. Struck rather than deleted, because the justification printed two paragraphs below this table was **false** — see the block at the end of this section |

**No role holds grants on both schemas.** A query that joins across the plane
boundary fails at the database rather than passing review.

This matters more than it looks. `persistence-design.md` §7 recommended separate
schemas so that a cross-plane join is *visible in review*. Review is not a
mechanism. **Invariant 3 — "the control plane publishes downward and never reads
tenant data" — had no enforcement until now.** A grant is enforcement.

It also makes the cluster question a cost line rather than an architectural one.
Splitting `control` onto its own cluster later changes a connection string; it
does not change a query, because no query could have spanned them.

Under BYOA the split is physical by construction — different AWS accounts. Writing
the hosted data plane against `control_ro` from day one means the hosted and BYOA
code paths are the same code path.

### AMENDED 12 Aug 2026 — G185: the cluster axis is RESIDENCY, the GRANT survives, and `control_ro` is RETIRED

**This section's argument is not overturned. Two of its sentences are, and both
are quoted here rather than edited away, because they are the sentences a reader
would have trusted.** `docs/HANDOFF.md` §3 row **G185**, ruled 12 Aug 2026 on a
proposition of *two database instances, one per plane* — **refused on the plane
axis and granted on the region axis.** The three parts must not be collapsed into
one.

🛑 **WHAT SURVIVES, and it is the load-bearing half: the GRANT.** Separate schemas
and separate database roles stay, and the sentence above them is unchanged —
*"No role holds grants on both schemas. A query that joins across the plane
boundary fails at the database rather than passing review."* A grant is a
**positive** control the database evaluates on every statement, and it is still
**invariant 3's only positive enforcement**. G185 refuses to weaken it. Two
instances split by plane were refused precisely here: two instances give only the
**absence of a route**, which the first connection string, foreign data wrapper,
nightly ETL or shared BI replica restores — and **G82 shows that pressure is
already live**, since it would put the BI layer in `ap-southeast-2`.

⚠️ **WHAT CHANGED, sentence one — the cluster count. It read:**

> Two schemas in one Aurora cluster, and two connection roles:

**It is one cluster PER RESIDENCY REGION.** `Tenant.residency: RegionKey`
(`model/domain.ts:882`) is a live per-tenant field over **five** values —
`ap-southeast-1`, `ap-southeast-2`, `us-west-2`, `ap-south-1`, `eu-west-1`
(`model/domain.ts:476-481`) — while `docs/persistence-design.md` §8 already makes
residency a *"regional instance"* and §7 says *"it is the only data permitted to
cross regions. Tenant data never does."* **§4 is coherent at N=1 region only, and
never addressed the axis.** Control-plane data keeps **one writer and NO regional
replica**. 🛑 **This read *"with a read-only replica per region, which is §7's
'a separate schema, replicated per region, read-only in the regional replica'
APPLIED rather than recommended"* and the replica was WITHDRAWN the same day —
struck rather than deleted, because it reached four documents first.** It was
unbuildable as ruled (a whole-cluster physical replica cannot co-exist with a
writable `tenant` schema in the same regional cluster) and, more decisively, it had
**no reader**: with `control_ro` retired, the plane reads packs, policy and the
catalogue from its own pulled projection and nothing in-region queries a control
table over SQL. **The regional read path is the projection.** `docs/persistence-design.md`
§7 is therefore **SUPERSEDED on this point, not applied.** ⚠️ **Those three are cited here BY SECTION AND QUOTE, not by line,
and deliberately: they have already moved twice in one day. They began the day at
`docs/persistence-design.md:328`, `:331` and `:345`; recording G185 in that file
pushed them to `:391`, `:394` and `:451`; correcting a heading in the same file
pushed the third again to `:459`. A stale line is a dead citation that reads valid
(`docs/HANDOFF.md` §7), and `tools/check-citations.mjs` resolves `.ts` and `.yaml`
targets only — a Markdown line citation rots unchecked. ⚠️ An earlier draft of THIS
note stated the numbers the other way round and was itself wrong; it is corrected
rather than deleted, which is the whole argument for quoting instead of numbering.**

⚠️ **A consequence for the paragraph above about a later cluster split: the split
it contemplates has been REFUSED.** *"Splitting `control` onto its own cluster
later changes a connection string"* remains a true statement about what the grant
bought, and it is no longer an option on the table. The split that was **granted**
is on a different axis and is **not** a connection-string change — it is N
instances, N migration runs and N restore points.

🛑 **WHAT CHANGED, sentence two — and this one was FALSE, which is why the first
one moved. It read:**

> Under BYOA the split is physical by construction — different AWS accounts. Writing
> the hosted data plane against `control_ro` from day one means the hosted and BYOA
> code paths are the same code path.

**A BYOA data plane runs in the customer's own AWS account, where there is no
`control` schema to hold a grant against.** It must therefore already fetch
published packs and policy over the wire — `/catalogue/packs`
(`docs/contracts/control-plane.openapi.yaml:509`) and `/policy/bundle` (`:660`).
**There were always two code paths while this section said there was one.**

**So `control_ro` is retired**, and the read becomes a **signed HTTPS pull into a
data-plane-local projection** in both topologies — the shape that genuinely
unifies them. The role vocabulary after G185 is **`control_rw` · `tenant_rw` ·
`tenant_migrate`** (the third from §4b): **three roles, not four.**

⚠️ **AND THE `tenant` ROW IS CONTROL-OWNED.** G50 makes tenant provisioning a
control-plane act, so the row lives on the control side, with a **narrow
data-plane projection of `id`, `status`, `residency`** — the columns the RLS
predicate (`db/migrations/0001_tenancy_and_rls.sql:174-176`) and the residency
check actually read. `tenant_contact.tenant_id` (`:96`) re-points at that
projection. **Rejected: data-plane ownership**, because provisioning would then
need a **`BYPASSRLS` credential reaching across the plane boundary**, voiding what
`tests/db/tenant-isolation.test.ts` exists to assert.

⚠️ **THE COSTS, ACCEPTED AND STATED PLAINLY RATHER THAN DISCOVERED LATER.**

- **Per-region clusters multiply migration timelines, and there is NO SKEW
  DETECTOR.** Each instance carries its own `schema_migration` ledger
  (`db/migrate.ts:28`) and **nothing compares them.** The always-deployed-first
  rule at `docs/contracts/control-plane.openapi.yaml:107` governs the **WIRE** and
  has no schema equivalent.
- **There is no consistent restore point across regions.**
- **The local projection is derived control-plane data sitting beside tenant
  execution**, so **it must be named in `SubjectLocation` or erasure cannot address
  it** — the hole G103 refused Redis to avoid (§7). §10.1 carries it as a gap.

🛑 **NOTHING IN G185 IS BUILT, and neither is §4 itself.** No per-region instance,
no projection, no `control` schema, no `tenant` schema, no second migration
directory: `grep -rn 'control_rw\|tenant_rw\|control_ro\|tenant_migrate' db/ model/`
returns nothing, and `db/migrations/` holds one file. ⚠️ **This command named
`tools/ tests/` too until it was run: it returns 10 hits there, every one of them in
`tools/planner/c4-template.html`, which NAMES the roles in a diagram rather than
implementing them. The scope is narrowed to the two directories where an
implementation would have to live, because a negative control that its own author
never executed is worse than none.** The built
`tenant` table (`db/migrations/0001_tenancy_and_rls.sql:70-76`) carries **no
`residency` column at all**, so the projection G185 names does not exist even in
the one schema that does.

---

## 4a. AMENDED 8 Aug 2026 — G107: the plane split reaches the WHOLE reconciliation pipeline

**§4 above decided that the plane boundary is a database grant. G107 decides what
sits on which side of it, for the reconciliation pipeline specifically** — because
a deployment architecture arrived that did not say, and §4's own argument is that
review is not a mechanism.

**The invariant, copied not paraphrased** (`CLAUDE.md`, invariant 3):

> **The control plane publishes downward and never reads tenant data.**

**A reconciliation batch IS tenant data.** Therefore every one of these is a
**DATA-plane object**, running under `tenant_rw` with RLS active:

| Component | Plane | Why |
|---|---|---|
| The Step Functions state machine orchestrating the passes | **data** | Its execution history carries batch identifiers and counts — tenant data |
| Every Lambda in it (normalisation, exact match, tolerance, amount-anchored fuzzy) | **data** | They read and write tenant rows |
| The Fargate task running N:M | **data** | Same |
| The S3 landing bucket for flat files | **data** | `docs/persistence-design.md` §1: `tenant={tenantId}/` is the **first** path segment, so an IAM condition on `s3:prefix` is expressible |
| The EventBridge event raised on upload, and the rule that starts the state machine | **data** | The event payload names an object under a tenant prefix |
| **Every log, metric and trace any of them writes** | **data** | This is the one people miss. A CloudWatch log group holding tenant record identifiers is tenant data in a place with its own retention, its own IAM and no RLS |

**The control plane's ONLY involvement in reconciliation is publication and
attestation:**

- **downward** — the model catalogue (G104), the solution pack, the policy bundle;
- **upward** — signed periodic aggregates only, which is constraint **C3** in §6,
  and which is what `UsageAttestation` exists for.

**Nothing else crosses.** No synchronous control-plane call on the hot path (C1),
and no query from control into tenant, because `control_rw` holds no grant on the
`tenant` schema and cannot be given one without reversing §4.

⚠️ **What this costs, stated rather than discovered later:** per-plane
orchestration infrastructure to provision, observe and pay for — two sets of
state machines, two log destinations, two alarm surfaces. **This is the
operational shape G36 deferred and G70 has already reintroduced once, for the BI
layer.** It is the second time; that is a pattern worth noticing rather than a
coincidence.

⚠️ **SCOPE — do not let the target become a phase-one dependency.** G101 puts
phase one on a disposable Postgres with an in-process `pg.Pool` and **no AWS
resource on the critical path**. The architecture above is the **v1 deployment
target**. Both are true at once.

⚠️ **Not applied.** No Step Function, Lambda, Fargate task, bucket or rule exists.
`ls -a` in the repository root returns no `.github` and no infrastructure
directory; there is nothing deployed to tag with a plane.

---

## 4b. AMENDED 8 Aug 2026 — G100: RLS DENIES on NULL, and migrations get their own role

**`docs/build/red-buildability.md:349` records the hole:** the policy evaluates
`current_setting('app.tenant_id', true)` as NULL *"and whether NULL denies or
permits depends on how the policy was written, which nobody has written."*

**It is written now: NULL DENIES.**

**Why this is the load-bearing half of the database decisions.** G99 chose Drizzle,
and `red-buildability.md:347` names Drizzle among the drivers that autocommit
outside an explicit transaction, silently discarding `SET LOCAL`. Deny-on-NULL is
what makes that survivable: **a forgotten transaction yields an empty result set**
— loud, immediate, caught by the first test that expects a row — instead of a
cross-tenant read that RLS reports as success.

**It also matches this codebase's polarity everywhere else.** `DENY_ALL` is the
failure value; `grantAllows` treats an empty nomination list as granting nothing;
and `docs/HANDOFF.md` §5.5 records scope failing **open** as a defect this
codebase has already had once and fixed.

**Migrations run as a named `BYPASSRLS` role — NOT as the table owner.** This adds
a fourth role to §4's table:

| Role | Grants | Used by |
|---|---|---|
| `tenant_migrate` | DDL on `tenant`, **`BYPASSRLS`** | Migrations only. Never an application connection |

**Why not simply run migrations as the owner, which is exempt anyway:** ownership
carries DDL rights *alongside* the read exemption, and **there is no way to grant
one without the other.** A named role makes the exemption a thing you can see in
`pg_roles`, revoke, and audit — rather than a property that comes free with owning
a table.

⚠️ **Not applied. There is no policy, no role and no migration** — this states
what the first one must do.

---

## 5. Decision — one schema in both topologies

A BYOA data plane runs the **identical schema**, including:

- **RLS still enabled**, though a single-tenant deployment does not need it.
- **Monthly partitioning retained** on the high-volume tables, though per-customer
  volume does not require it.

Both are redundant in BYOA and both are kept. The alternative is two schemas, two
migration paths, and a permanent question of which one a given customer is on.
Redundant DDL is cheap; a forked schema is not.

⚠️ **AMENDED 12 Aug 2026 — G185 does not fork the schema; it multiplies the number
of places this one schema has to be applied.** One cluster per residency region
means **one migration run per region**, each with its own `schema_migration`
ledger (`db/migrate.ts:28`), and **nothing in the tree compares two ledgers.**
§5's argument is untouched — it is still one schema, not two — which is exactly
why the cost lands as **timeline skew** rather than as a fork. Stated in full in
the G185 block in §4. **Not applied; there is still one migration directory.**

### 5a. AMENDED 8 Aug 2026 — G97: every branded id is `text`, and the slug is stored verbatim

**No `uuid` column anywhere.** `Id<TName>` is `string & { readonly [brand]: TName }`
(`model/kernel.ts:43`) and every fixture id in the record is a readable prefixed
slug — `ten_acme`, `def_fin_3way`. **There is no uuid anywhere in the model**, so
choosing `uuid` would not change how an id is *stored*; it would change what an id
**is**. Every fixture breaks, and a conversion appears on the hottest path in the
system — directly under invariant 1, *"Tenant scope is derived from the session,
never read from a request."*

**The decisive property is that the RLS predicate is a comparison.** `text`
compares like-for-like against `current_setting('app.tenant_id')` with **no cast**,
and that comparison **is** the predicate §4b was written about. A cast on both
sides of the hot predicate is a place for a plan to change and for a subtle
inequality to hide.

⚠️ **Cost accepted, not overlooked: the database enforces no format.** `ten_acme`
and `ten_ACME` are both storable, and preventing that is a **mint-time rule in
`model/`**, not a column constraint. **`citext` was rejected** — it needs an
extension present on every plane including a customer's own BYOA account, to solve
a problem the model can prevent where ids are minted.

⚠️ **Not applied.** There is no column of any type; this decides the type the first
one takes.

---

## 6. Decision — three constraints, now hard requirements

BYOA as a v1 target converts these from cheap insurance into build requirements.

| # | Constraint | Consequence if violated |
|---|---|---|
| C1 | **No synchronous control-plane call on the reconciliation hot path.** | Every customer reconciliation round-trips to 1CloudHub: latency, an availability dependency they did not buy, and we hold request metadata we claimed not to. |
| C2 | **Policy is authored centrally, distributed signed, and evaluated locally.** | Either the hot path leaves their account, or policy is unenforceable in BYOA. |
| | **Clarified 5 Aug.** Two words in C2 were loose. *Distributed* describes the logical direction; the **connection is always a pull by the plane**, because a push needs inbound access to a customer account and a security team will not grant it. And *policy authored centrally* means platform defaults, templates and the model catalogue — a tenant's own `Policy` rows are tenant-scoped, adopted by a tenant admin, and in BYOA already sit in the customer's own database with nothing to distribute. Reading C2 as us setting a customer's autonomy ceiling remotely would be wrong. | |
| C3 | **The control plane receives signed periodic aggregates, never a query into a data plane.** | The account boundary stops being a boundary. |

C2 resolves handoff item #10 and is forced, not chosen. It also disposes of the
`PolicyEvaluation` volume argument entirely for BYOA customers: 1.41M rows a month
stay in the customer's own database and only a signed summary crosses.

C3 is what `UsageAttestation` exists for (`byoa-topology.md` §5).

---

## 7. Decision — storage tiers as designed, no second engine

**PostgreSQL (relational + JSONB) · S3 · telemetry backend.** Unchanged from
`persistence-design.md` §9.

The NoSQL argument fails under both topologies, for different reasons:

- **BYOA** — ~94M rows/month was an aggregate across forty tenants in one
  database. Per customer it is ~2.4M/month. Unremarkable.
- **Hosted** — sampling `PolicyEvaluation` allows removes ~95% before monthly
  partitioning is stressed at all.

### Sampling becomes a policy, not a constant

`persistence-design.md` §11.4 proposed retaining 100% of denials,
`requires_approval` and `redacted` outcomes, plus a 1% sample of plain allows and
a per-window count of the rest.

**Adopt it as the default, expressed as policy rather than code.** A regulated
customer whose auditor demands every allow individually evidenced sets the rate to
100% in their own deployment, where they also pay for the storage. Hard-coding
either rate would be wrong.

### The escape hatch stays open at no cost

The three constraints from §11.5 hold regardless: no foreign key from an
operational event into business data; PII-free by construction, not convention;
an idempotency key on every row. If a hosted deployment ever outgrows Postgres,
those two tables move as append-only data with no referential integrity to
preserve.

### Confirmed 8 Aug 2026 — G103 refused a third store, and this is where the refusal was tested

A deployment draft proposed **ElastiCache (Redis)**, "optional but recommended",
caching LLM-derived extraction rules for sub-millisecond retrieval during
normalisation. **It was refused. The extraction-rule cache is a tenant-scoped
Postgres table.**

The argument is the one this section already makes and it did not need
strengthening: a cache holding **tenant-derived** rules sits outside RLS, outside
`RetentionPolicy`, outside the erasure plan and outside `SubjectLocation` — so a
tenant's data would live somewhere the erasure machinery **cannot name**. Pass F's
line holds: *"Two stores plus a telemetry backend, not three databases … No second
engine"* — cited by quote rather than by line, because
`grep -n 'Two stores plus a telemetry' docs/HANDOFF.md` moved from 436 to 577
within 8 Aug 2026 and a stale line is a dead citation.

**Rejected alternative, preserved so a reopening starts from the argument rather
than from scratch:** a **tenant-partitioned Redis** with a TTL bounded inside the
retention window and a **new `SubjectLocation` variant** to make the copy
addressable — the same shape §10.1 already used to reach a blob and a trace, and
the shape G80a needed for the BI dataset. **That would have worked.** It was
refused because it reverses a pass-F decision and adds an engine to operate,
patch, bill and teach the erasure machinery about.

⚠️ **The performance claim behind the proposal was never measured.** If
sub-millisecond retrieval genuinely binds under fan-out, **this is the ruling to
reopen — with a measurement, not an assumption.**

---

## 8. Decision — record kind is the primary taxonomy

Five kinds. Placement, retention, erasability and movability all derive from this,
not from the storage tier.

| Kind | Members | Store | Erasable | Movable |
|---|---|---|---|---|
| **Business** | tenancy · config · reconciliation · governance · commercial · evaluation | Postgres | **Yes — must be** | No |
| **Operational** | `UsageRecord` · `PolicyEvaluation` · `DataAccessEvent` | Postgres, partitioned | N/A — PII-free by construction † | **Yes** |
| **Derived** | `QualityWindow` · `CostAttribution` · `PartnerBillingSummary` · `PlatformHealthWindow` · `ModelResolution` | Postgres, materialised | By recomputation | Recreatable |
| **Content** | source documents · page renders · exports · signed pack bundles | S3 | Yes — **see the gap in §10** | No |
| **Telemetry** | traces and spans | External backend | Sometimes not — disclosed | Already external |

† **Corrected 5 Aug.** This said "PII-free by construction" as a statement of
fact. It was a statement of *requirement*: `PolicyEvaluation.reason` was
`string`, documented as human-readable and shown to users, so the row was PII-free
only by good intentions. `persistence-design.md` §11.5 had it right — it listed
the closed vocabulary as a **condition** for keeping the movability option open,
not as something already done. The model now carries `PolicyReasonCode` and the
condition holds.

**Volume does not determine kind; erasability does.** `AuditEvent` has operational
volume but carries `before` / `after` values that are personal data
(`persistence-design.md` §11.1). It is a **business record** and stays in the
erasable set. Getting this backwards is how an erasure obligation quietly becomes
unmeetable.

### `RetentionPolicy` is keyed by record kind

> **✅ APPLIED 7 Aug 2026.** Deltas 2, 3 and 7 below all landed together, in
> `model/domain.ts`. The tense of the paragraph that follows is left as written
> because it is the argument, not the status. What shipped differs from the
> sketch in three ways, each stated where it occurs.

It **carried** three entity-named fields — `sourceDocumentDays`,
`exceptionDays`, `auditDays` — and handoff item #6 asked for
five more. Adding five more fields repeats the mistake. Key it on retention class
instead, so the set is extensible and every class is forced to have an answer:

```ts
export type RetentionClass =
  | 'source_document' | 'export' | 'page_render'          // content
  | 'exception' | 'match_group' | 'approval' | 'audit_event'  // business
  | 'policy_evaluation' | 'usage_record' | 'data_access_event' // operational
  | 'score_result' | 'observed_label'                     // evaluation
  | 'trace'                                                // telemetry

export interface RetentionPolicy {
  /** Days from the class's triggering event. Every class must have a value. */
  days: Record<RetentionClass, number>
}
```

`Record<RetentionClass, number>` makes the compiler demand a value for each class,
which is the property the three-field version lacked. The existing rule — audit
never shorter than the longest business class — becomes a validator
(`retentionWindowValid()`, handoff item #8) rather than a comment.

**S3 lifecycle rules are generated from this, not configured beside it.** §10
covers why that is not optional.

#### Three differences between the sketch above and what shipped

**One.** `RetentionClass` shipped as a `const` object plus a derived union
(`RETENTION_CLASSES`), not a bare union — house style, and it gives the member
list a runtime value the validator iterates.

**Two.** The comment labels above (`// content`, `// business`, …) became a
TOTAL table, `RETENTION_RECORD_KIND: Record<RetentionClass, RetentionRecordKind>`.
A comment cannot tell `retentionWindowValid()` which classes are business
records; a total record can, and it makes a fourteenth class a compile error in
two places rather than one. `score_result` and `observed_label` are classified
`business` rather than as a fifth kind, because §8's business row lists
*evaluation* among its members — the conservative reading, since it pulls them
under the audit floor.

**Three — the audit floor is business AND content, not business alone.** Item #8
is phrased "audit never shorter than the longest **business** class", but the
rule it generalises (`data-governance.md`) names `exceptionDays` **and**
`sourceDocumentDays` — one business class and one content class. Narrowing to
business alone would have let the source-document window exceed the audit window,
which is the case the original rule was written about. `AUDIT_MUST_OUTLIVE` is
therefore keyed on record kind with `business: true, content: true`.

**And one weakness that did not close.** Nothing in `model/` constructs a
`RetentionPolicy`, so `Record` totality — the entire point of the re-key — is
enforced at no site. Two compile-time assertions
(`_RetentionPolicyAnswersEveryClass`, `_RetentionKindTableAnswersEveryClass`)
hold the property in the interim; the first fixture or migration that builds a
real policy is the stronger witness and should retire them.

---

## 9. The rule that resolves performance against compliance

This is the real tension in the data model, and it is worth naming because it
recurs on every future table.

Compliance wants **one copy** of every personal value, so erasure is executable.
Performance wants **denormalised copies**, so the exception queue is not a
three-join query at 100k open rows. The red team's most confident finding — purging
a `SourceDocument` leaves the values in `Explanation` — is this tension surfacing
once.

> **Rule: a denormalised copy of a *classified* value must register a
> `SubjectIndexEntry` location. Copies of unclassified values are unconstrained.**

Applied to what exists today:

| Copy | Classified? | Verdict |
|---|---|---|
| `Exception.severityRank`, `domain`, `definitionId`, `ruleLabel` | No | Free. Denormalise freely. |
| `Exception.valueAtRisk` | No — an amount, not an attribute of a person | Free. |
| `ObservedValue.scalar` in `Explanation` | **Yes** | Legal **because** it carries `dataClass` (`model/domain.ts:763`) and is indexed at `explanation_observed`. |
| `MatchGroup.keyValues` | **Yes** in KYC — the key is a national identifier | Legal; indexed at `match_group_key`. |
| `AuditEvent.before` / `after` | **Yes** | Legal; indexed at `audit_event`. |

The rule is already half-implemented — `ObservedValue.dataClass` exists for exactly
this reason. Stating it makes every *future* denormalisation self-policing instead
of a case-by-case argument, and it extends invariant 4 ("classification is declared
once, on `FieldSpec`, and everything derives from it") from declaration to
propagation.

## 9a. AMENDED 8 Aug 2026 — G106: `FieldSpec` classification maps onto a JSONB path, and an unmapped key is UNREADABLE

**§9 extended invariant 4 from declaration to propagation. G106 extends it one step
further back — to ADDRESSING — because §1's storage-tier axis puts JSONB in the
design and a schema-agnostic payload has no per-field classification at all unless
the mapping is real.**

**The invariant, copied not paraphrased** (`CLAUDE.md`, invariant 4):

> **Classification is declared once**, on `FieldSpec`, and everything derives from
> it.

**The gap this closes.** `SourceDocument.extracted` is
`Record<FieldPath, ExtractedValue>` (`model/domain.ts:1717`) and lands in a JSONB
column (§3 of `docs/persistence-design.md`). `FieldSpec` already carries both
`path: FieldPath` (`model/domain.ts:1584`) and `dataClass`
(`model/domain.ts:1592`) — but **`FieldPath` is `export type FieldPath = string`**
(`model/kernel.ts:423`) with no stated semantics, so **nothing in the record says
what a `FieldPath` addresses inside the payload.** Until it does, `dataClass`,
redaction and `modelProcessingAllowed` are declared against keys that may not
exist, and all three **silently address nothing**.

**The ruling: `FieldSpec.path` is the JSONB path**, and the mapping is the thing
that makes classification reach the payload.

🛑 **The load-bearing half is the DEFAULT, not the mapping.** A key present in the
payload with **no `FieldSpec`** is:

- **stored** — extraction is not lossy, and the raw payload is evidence;
- **UNREADABLE by anything that reasons about it** — no agent, no prompt, no
  export, no dashboard, no screen.

**Fail closed.** It matches `DENY_ALL`, it matches G100's deny-on-NULL in §4b, and
it is the same polarity §5 of `docs/persistence-design.md` relies on everywhere
else.

**Rejected, and preserved:** defaulting an unmapped key to the **most sensitive
class**. It sounds equivalent and is not — it is readable-by-default with a high
bar, which is **scope failing OPEN**, the defect shape `docs/HANDOFF.md` §5.5
records this codebase having already fixed once. A high bar can be cleared by a
grant; an unmapped key must not be reachable at any price until somebody declares
it.

⚠️ **Not applied, and the model change is not this file's to make.** `FieldPath`
is still a bare `string` alias; nothing enforces that an extracted key has a
`FieldSpec`, and no validator exists. Recorded here as the decided shape.

---

## 10. Three gaps this shape exposes

### 10.1 `SubjectLocation` cannot reach a blob or a trace

All six variants of `SubjectLocation` (`model/governance.ts:191`) point at
PostgreSQL rows. `persistence-design.md` §8 claims the erasure invariant holds in
S3 by "delete by key" — **but no key exists in the index.**

Purging a `SourceDocument` row can cascade to its object via `storageRef`. Nothing
reaches:

- **exported CSVs**, which contain whatever the export contained;
- **derived page renders and crops**, which are images of the source document;
- **traces**, where the correct outcome is `out_of_reach` — but `ErasurePlanItem`
  needs a location to attach that disposition to, or the plan silently omits the
  copy rather than disclosing it.

Two variants close it:

```ts
| { kind: 'blob'; bucket: string; key: string }
| { kind: 'trace'; traceId: string; region: RegionKey }
```

Until then the S3 column of the §8 invariant table is aspirational.

⚠️ **AMENDED 12 Aug 2026 — G185 adds something else the index cannot reach, and
it is a new copy rather than a restatement of the three above.** Retiring
`control_ro` (§4) puts a
**data-plane-local projection** — published packs, policy, and the narrow `tenant`
row of `id`, `status`, `residency` — **inside** a data plane, beside tenant
execution. G185 states the condition on it in this section's own terms: **it must
be named in `SubjectLocation` or erasure cannot address it**, which is precisely
the hole G103 refused Redis to avoid (§7). **No variant names it today** — the ten
that exist are listed against §12 delta 1 — and **nothing is built**, so this is a
gap recorded at the moment it was created rather than after somebody hit it.

### 10.2 Retention is configured twice across the boundary

S3 object lifecycle rules and `RetentionPolicy` are independent configurations.
`persistence-design.md` §1 flags that they "must be reconciled" and nothing
reconciles them. Two settings expressing one obligation will drift, and the
direction of drift that matters — S3 retaining longer than the policy claims — is
the one nobody notices.

Record-kind keying fixes this: the lifecycle rule for `exports/` is **generated
from** `days['export']`, and a drift check compares deployed rules against the
policy. One declaration, two enforcement points.

---

### 10.3 Backup erasure — crypto-shredding is the right direction and needs a design pass ⚠️

**Decided 4 Aug:** answer the backup-erasure problem with crypto-shredding rather
than by shortening the PITR window or disclosing a 35-day residual. Per-subject
data key, wrapped by the tenant CMK; erasure destroys the key and the ciphertext
in every backup becomes unrecoverable without touching the backups.

That is the correct direction and it is **not yet a design.** The naive form does
not work, and the failure is easy to miss:

> If the wrapped key row lives in the same database as the ciphertext, it lands
> in the **same backup**. Restoring that backup restores the key alongside the
> data it unlocks, and nothing has been shredded.

So the key material has to sit somewhere with a **different backup and retention
regime** from the data it protects. Three shapes, none free:

| Shape | Erases | Cost |
|---|---|---|
| Per-**tenant** CMK in KMS | The whole tenant, on CMK deletion. Clean and cheap | Does not reach a single subject — useless for a DSAR |
| Per-**subject** key in KMS | A single subject, properly | KMS key counts and cost do not survive millions of subjects |
| Per-**subject** data key in a separate store with short retention | A single subject | A second store to isolate, back up differently, and keep consistent with the first |

The third is the workable one and it reintroduces exactly what §7 argued against
— a second place holding something the first place depends on. The difference is
that it holds *keys*, not records, so none of the four invariants move with it.

`SubjectKeyScheme` already exists but is the **HMAC pseudonymisation** key for
`subjectRef` — a different key for a different purpose. Do not overload it.

**Open until designed:** key store choice, key lifecycle and rotation, what
happens to a subject whose key is destroyed while a `LegalHold` is active, and
whether per-tenant CMK deletion is offered as a separate coarse instrument for
tenant offboarding. Until then, `ErasurePlan` still has no clean disposition for
a copy that exists only in a backup.

## 11. What BYOA-as-v1 now forces

Three items move from "open question" to "on the critical path."

### 11.1 Metering trust — the sharpest cost

We meter usage in an account we do not control. `UsageRecord.idempotencyKey`
handles duplication, not trust.

**Recommendation: both mechanisms, layered.**

| Layer | Mechanism | Property |
|---|---|---|
| Floor | ~~Control-plane-observed events~~ | ⚠️ **Retracted 5 Aug.** See below. |
| Detail | Signed `UsageAttestation` per period, verified against `DataPlane.attestationPublicKey` | Tamper is detectable, not impossible |
| Check | Attested totals reconciled against the control-plane floor | A data plane reporting fewer runs than it fetched policy for is visible |

> ⚠️ **The floor does not exist, and this section claimed it did.**
>
> A vertical-slice review traced all three named sources against the contracts.
> **Model resolution** is an in-plane foundation service — the control plane
> never sees it. **Policy fetch** is daily and deliberately volume-independent,
> which is the whole point of constraint C1. **Pack activation** is the plane
> reporting its own installations. None is proportional to billable volume and
> outside the customer's account, so the "layered, both mechanisms" model was
> one mechanism: self-report.
>
> §4.1 states the floor-versus-C1 conflict correctly and this section then
> re-asserted the floor anyway. The correction is not to find a better floor —
> nothing in the design is both proportional and observable — but to move the
> bound into the signed artefact: `UsageAttestation.drawdownHighWater`, added
> the same day, is the lease counter inside the body a KMS key signs.
>
> The floor alone under-counts; attestation alone is unverified. That sentence
> was right about the shape and wrong about which two things. This is
still the single largest engineering cost of BYOA and it is now v1 scope.

### 11.2 Upgrade consent

A regulated customer will not accept an unannounced push of pack v2 into their
account. `PackRollout` becomes a **proposal requiring acceptance**, not a schedule.
`DataPlane.installedVersions` already makes fleet drift visible; what it does not
yet model is a customer who declines and stays on v1 indefinitely, with the support
and evaluation consequences that implies.

### 11.3 Minimum viable footprint sets the smallest viable deal

Aurora + S3 + Lambda + Bedrock in a CDK stack, per customer. That cost floor
determines the smallest deal BYOA makes sense for, and it is the input that decides
Aurora Serverless v2 versus provisioned — a question that is about the **BYOA cost
floor**, not about hosted demo load as `persistence-design.md` §10 framed it.

---

## 12. Model deltas this decision requires

| # | Change | File | Status |
|---|---|---|---|
| 1 | `SubjectLocation` gains `blob` and `trace` variants | `model/governance.ts` | **Applied** 5 Aug — see below |
| 2 | `RetentionPolicy` re-keyed to `Record<RetentionClass, number>` | `model/domain.ts` | **Applied** 7 Aug — **breaking**, as expected |
| 3 | `RetentionClass` added | `model/domain.ts` | **Applied** 7 Aug — 13 classes |
| 4 | `DeploymentMode` and `DataPlane`; `Tenant` gains `deploymentMode` and `dataPlaneId` | `model/domain.ts`, `model/deployment.ts` | **Applied** 4 Aug |
| 5 | `UsageAttestation` | `model/billing.ts` | **Applied** 4 Aug — see also day-2 delta 14 |
| 6 | `PolicyEvaluation` sampling rate expressed as policy | `model/policy.ts` | Outstanding |
| 7 | `retentionWindowValid()` — audit never shorter than the longest business class | `model/domain.ts` | **Applied** 7 Aug — floor is business **and content** |

**Delta 1 was already applied and this table said otherwise for two days.**
Verified 7 Aug: `SubjectLocation` has carried `blob` and `trace` since 5 Aug and
has since gained `correspondence_message` and `notification` — ten variants, not
the seven this row implied. Recorded rather than quietly corrected, because an
open delta standing against a *closed union* is an active hazard: the next person
to work the list adds a variant that already exists under a second name, and the
union stops being closed. **The wire was stale in the other direction** —
`foundation.openapi.yaml` enumerated nine of the ten, omitting `notification`, so
a value carried out in an approval mail could be registered in the model and
refused at the boundary. Fixed in the same pass; model and wire now match
element-for-element and in order.

Deltas 8–22 are in `docs/day-2-operations.md` §9. Applied so far: 4, 5, 8,
10, 11, 12, 14, 19, 20 — the set that becomes impossible or fleet-wide once a
customer account is deployed and signing.

Note that #4 is smaller than `byoa-topology.md` §5 anticipated, because sandbox
turned out not to be a topology: `DeploymentMode` is `'hosted' | 'byoa'`.

---

## 13. Status of prior open questions

**Closed by this record:**

| Item | Where it was open | Resolution |
|---|---|---|
| Three-mode topology? | Handoff #1 | Two topologies. Sandbox is a tenant flag. BYOA is a v1 target. |
| Control-plane cluster: same or separate? | Handoff #4 · persistence §10.3 | ~~Same cluster, separate schema, separate roles. Cluster split is a later cost decision.~~ 🛑 **AMENDED 12 Aug 2026 — G185; struck, not deleted. See the note below this table.** Separate schema and separate roles **STAND**. *"Same cluster"* does not: it is **one cluster per residency region**, and a split into two instances **by plane** was **refused**. The cluster split is no longer a later cost decision on the plane axis; it is a **taken** decision on the region axis |
| `RetentionPolicy` needs five more classes | Handoff #6 · persistence §6 | Re-keyed on `RetentionClass`. Structural, not additive. **Applied 7 Aug 2026** — 13 classes, and the compiler now demands an answer for each. |
| Sample `PolicyEvaluation` allows? | Handoff #7 · persistence §11.4 | Yes, as the default. Expressed as policy so a customer can raise it. |
| Where is policy evaluated? | Handoff #10 · BYOA §4 | Data plane. Forced by C2. |
| Per-tenant CMK from the start? | Handoff #5 · persistence §10.2 | Hosted: yes, from the start — retrofitting is a re-encryption exercise and the key cost is trivial at this tenant count. BYOA: the customer owns the key; the question does not arise. |
| Schema-per-tenant vs RLS | persistence §10.6 | RLS. Recorded again so it is not revisited. |

> 🛑 **AMENDED 12 Aug 2026 — G185. The cluster row above closed on the WRONG AXIS,
> and the answer it gave is preserved verbatim rather than overwritten.** It read:
>
> > Same cluster, separate schema, separate roles. Cluster split is a later cost
> > decision.
>
> **The half that is still right is the half that carries invariant 3** — separate
> schema and separate roles, enforced by a grant the database evaluates on every
> statement (§4). **The half that went false is *"same cluster"***: the question
> was posed on the PLANE axis, was answered on the plane axis, and the axis that
> actually forces a second instance is **RESIDENCY**. `Tenant.residency: RegionKey`
> (`model/domain.ts:882`) is a live per-tenant field over five values, and
> `docs/persistence-design.md` §7 says tenant data never crosses a region. **One
> cluster per residency region**, with control-plane data on **one writer and no
> regional replica** — ⚠️ **a replica was ruled and withdrawn the same day; it had no
> reader once `control_ro` was retired, and the pulled data-plane-local projection is
> the regional read path. That file's §7 recommendation is SUPERSEDED, not applied.**
>
> **Two instances split by PLANE were refused** — a grant is a positive control, two
> instances are only the absence of a route. The full reasoning, the rejected
> alternative and the accepted costs are in the G185 block in §4. ⚠️ **This also
> re-opens the shape of the Aurora Serverless-versus-provisioned row below**, which
> is now a question asked N times rather than once. **Nothing is built.**

**Still open, and now sharper:**

| Item | Why it did not close |
|---|---|
| **Metering trust** (handoff #2) | §11.1 recommends a layered answer; the reconciliation rules between floor and attestation are unspecified. Critical path. |
| **Aurora Serverless v2 vs provisioned** (handoff #3) | Now a BYOA cost-floor question (§11.3), not a demo-load question. Needs the footprint costed. |
| **Upgrade consent** (BYOA §4) | §11.2. A declining customer is unmodelled. |
| ⚖️ **Controller/processor status under BYOA** (handoff #20) | Counsel. Unchanged and unchanged in importance. |
| **PITR versus erasure** (handoff #27) | BYOA moves it into the customer's account, which makes it their decision — for BYOA customers only. Hosted still needs a documented position. |
| **Who pays for inference in BYOA** (BYOA §8.3) | Their Bedrock bill is the natural answer, and it means inference cannot be bundled into a per-reconciliation price. Commercial. |

---

## 14. One paragraph

The data architecture is **two planes, two topologies, one schema, three storage
tiers, five record kinds.** The plane boundary is enforced by PostgreSQL grants
rather than review, which gives invariant 3 a mechanism it previously lacked and
makes a later cluster split a connection-string change. The topology boundary is an
AWS account: hosted for SMEs, partner-sold customers and demos; customer-owned for
the regulated enterprises that are the v1 target. Both run identical DDL, including
RLS and partitioning that BYOA does not need, because a forked schema costs more
than redundant DDL. Storage stays PostgreSQL plus S3 plus an external telemetry
backend — no second engine, because per-customer volume under BYOA and sampling
under hosted both remove the argument for one. Record kind, not storage tier, is
what determines retention and erasability, and `RetentionPolicy` is re-keyed on it.
The tension between denormalising for queue performance and holding one copy for
erasure is resolved by a single rule: a copy of a classified value must register a
subject-index location; a copy of an unclassified value is free. Two gaps remain
open in the model — the subject index cannot address a blob or a trace, and S3
retention is configured twice — and one engineering problem is now on the critical
path, which is metering usage in an account we do not control.

> 🛑 **AMENDED 12 Aug 2026 — G185. One clause of the paragraph above is false and
> is quoted here rather than rewritten**, because a one-paragraph summary is the
> thing people copy:
>
> > The plane boundary is enforced by PostgreSQL grants rather than review, which
> > gives invariant 3 a mechanism it previously lacked and makes a later cluster
> > split a connection-string change.
>
> **The first two clauses stand and are the load-bearing ones.** The third does
> not: the plane split into two instances was **refused**, so there is no later
> connection-string change to make on that axis. **The database splits on the
> RESIDENCY axis instead — one cluster per residency region**, control-plane data
> on one writer with **no regional replica** (a replica was ruled and withdrawn the
> same day — it had no reader), and **`control_ro` retired**
> in favour of a signed HTTPS pull into a data-plane-local projection. The `tenant`
> row is **control-owned**, with a narrow data-plane projection of `id`, `status`,
> `residency`. So the one-paragraph version now reads: **two planes, two
> topologies, one schema, N regional instances of it, three storage tiers, five
> record kinds.** §4 carries the argument, the rejected alternative and the costs —
> multiplied migration timelines with no skew detector, no consistent restore point
> across regions, and a projection that must be named in `SubjectLocation`.
> **None of it is built.**

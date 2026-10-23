# Domain Model

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** PARTIAL — the authority for entity *shape* and why it is shaped that way; **`model/*.ts` and its `@dropped-for-v1` notes decide what v1 BUILDS**, not this file.
> Maintained: §11 is the changelog to 4 Aug, §13–§17 everything since, §16 is the resource axis. Update it in the same pass as the model change it describes. ⚠️ **One claim on this page is known false and is load-bearing elsewhere:** the line below saying the backend stack is *undecided by design* was settled by **G71 — TypeScript end to end**, recorded in `PRODUCT.md`. ⚠️ **`model/domain.ts` itself carries a stale comment that G75 falsified** — it still states that `secret` appears in neither `PERMITTED_RESOURCES` list, which is invariant 11's stated justification and is now untrue; the invariant's conclusion survives on the atomicity argument, not that one.
> *Banner added 8 Aug 2026.*

> **Status:** design record, pre-implementation. Backend stack undecided by
> design — this model is language-neutral, with TypeScript given as the reference
> encoding.
> **Date:** 4 Aug 2026
> **Supersedes:** nothing. There was no domain model. `archive/sap-line:src/types/`
> is ~617 lines of view-shaped payloads with no `Invoice`, `PurchaseOrder`,
> `Vendor` or `MatchResult` interface anywhere — the measurement that is this
> document's whole reason for existing. Read it with
> `git show archive/sap-line:src/types/`; the application it belongs to left the
> trunk on 6 Aug 2026. See `docs/salvage-ledger.md` §2.2.

---

## Decisions this model encodes

Confirmed with the product owner, 4 Aug 2026.

| Decision | Choice | Consequence |
|---|---|---|
| Reconciliation shape | **Generic core + typed projections** | One config-driven engine; per-domain typed views at the UI edge only |
| Tenancy | **Flat tenants, partner as attribute** | Every row carries one `tenant_id`; partner is metadata on the tenant |
| Target | **Stack-undecided** | Entities are language-neutral; persistence implications noted, not assumed |
| Worked examples | **Finance and KYC** | Both must run through the identical core, or the model has failed |

### The test this model must pass

> Finance reconciles **records against records** (invoice ↔ PO ↔ goods receipt).
> KYC reconciles **documents against a registry** (passport ↔ national ID ↔
> registry record).
>
> If both express in one core without a `kind` switch in the engine, the
> domain-neutrality claim is demonstrated. If either needs a special case, the
> model is wrong.

§7 works both examples end to end against the same types. That section is the
proof obligation, not an illustration.

---

## 1. Non-negotiables

Four rules the model exists to enforce, each traceable to a finding.

**1. Arity is data, never a type name.** "Three-way match" was a `'yes'|'no'`
string and a button backed by a `setTimeout`. Sources are a list. Two-way,
three-way and n-way are the same code path.

**2. An exception without its explanation is invalid.** `PRODUCT.md` Principle 1:
*"Any surface that shows an exception without its explanation has lost the
product's point."* `explanation` is therefore **non-optional** on `Exception`.
The type system enforces the product thesis.

**3. Every row is tenant-scoped, and scope is not client-asserted.** `userid`
came from a non-`httpOnly` cookie, was sent in the request body, and the app
shipped a UI to overwrite it. `tenant_id` is derived server-side from an
authenticated session and never read from a request payload.

**4. No finance noun in the core.** `invoice`, `po`, `vendor`, `three_way`,
`ap_processor` do not appear in any core entity. They are values in a tenant's
configuration, or fields in a typed projection.

---

## 2. Tenancy

Flat tenants. A `Partner` is an attribute of a `Tenant`, not a level above it.
1CloudHub-direct customers and partner-sold customers are structurally identical
— the only difference is whether `partner_id` is null.

```
Partner (reseller org)
   │ 0..1
   ▼
Tenant (end customer)  ── partner_id: PartnerId | null
   │ 1..n
   ▼
Membership (user ↔ tenant, with role)
   │
   ▼
User (identity, may hold memberships in many tenants)
```

**Why flat.** A strict `Partner → Customer → User` tree cannot express a
1CloudHub-direct customer without a synthetic partner, and cannot express a
customer transferred between partners without moving every row. Flat tenants
make both a single-column update.

**How a partner sees its customers.** Not by traversing a hierarchy — by an
authorization rule:

```
partner_admin(P) may read tenant T  ⟺  T.partner_id = P
```

That is one indexed predicate, evaluated server-side. It is deliberately the
*only* cross-tenant read path in the system.

### Entities

**`Partner`** — a reselling organisation.

| Field | Type | Notes |
|---|---|---|
| `id` | `PartnerId` | |
| `name` | `string` | |
| `status` | `'active' \| 'suspended'` | |
| `created_at` | `Timestamp` | |

**`Tenant`** — an end customer. The unit of data isolation.

| Field | Type | Notes |
|---|---|---|
| `id` | `TenantId` | Present on every other row in the system |
| `name` | `string` | |
| `partner_id` | `PartnerId \| null` | **null = 1CloudHub direct** |
| `enabled_domains` | `DomainKey[]` | Which reconciliation domains this tenant sees |
| `status` | `'active' \| 'suspended'` | |

**`User`** — an identity. Not scoped to a tenant; reaches tenants via memberships.

| Field | Type | Notes |
|---|---|---|
| `id` | `UserId` | |
| `email` | `string` | |
| `status` | `'active' \| 'disabled'` | |

> **No password field.** The current `list_users` operation returns other users'
> passwords and the client writes the whole object into a cookie
> (`archive/sap-line:src/types/reconcileLanding.types.ts:28,35`). Credentials live in the identity provider
> and never enter this model. A user record that can carry a password is a user
> record that will leak one.

**`Membership`** — the join, and the authorization primitive.

| Field | Type | Notes |
|---|---|---|
| `user_id` | `UserId` | |
| `tenant_id` | `TenantId` | |
| ~~`role`~~ `role_id` | ~~`RoleKey`~~ `RoleId` | **Migrated 7 Aug 2026 — §15.6.** A pointer to one `Role` row, not the authority record; `RoleAssignment` is. Scoped to this tenant only |
| ~~`partner_scope`~~ | ~~`PartnerId \| null`~~ | **Deleted 5 Aug 2026.** A second door: the clamp reading it opened on the null case, so a membership that omitted the field was returned unclamped. Partner scope now derives from the session's `IdentityConnection.owner` |

A user may hold `reviewer` in one tenant and `approver` in another. Roles are
per-membership, never global.

### Roles

Domain-neutral, replacing `AP Processor` / `AP Supervisor` / `Admin`:

| Role | Capability |
|---|---|
| `viewer` | Read reconciliations and exceptions |
| `operator` | Run reconciliations, propose resolutions |
| `approver` | Approve or reject proposed resolutions |
| `tenant_admin` | Manage users, definitions and configuration within one tenant |
| `partner_admin` | The above, across all tenants where `tenant.partner_id` matches |

`AP Processor` and `AP Supervisor` become **finance-domain labels** for `operator`
and `approver`, rendered in the UI. They are not identities in the model.

---

## 3. Documents and sources

**`DocumentType`** — a tenant-defined class of input. This concept already exists
in the live no-SAP application (41 records) and survives largely intact.

| Field | Type | Notes |
|---|---|---|
| `id` | `DocumentTypeId` | |
| `tenant_id` | `TenantId` | |
| `key` | `string` | e.g. `invoice`, `passport`, `bank_statement` |
| `label` | `string` | Display name |
| `domain` | `DomainKey` | `finance`, `kyc`, … |
| `fields` | `FieldSpec[]` | The extraction contract |

**`FieldSpec`** — one extractable field.

| Field | Type | Notes |
|---|---|---|
| `path` | `FieldPath` | Dotted path, the join and rule vocabulary |
| `label` | `string` | |
| `data_type` | `'string' \| 'number' \| 'date' \| 'money' \| 'identifier'` | |
| `required` | `boolean` | |

**`SourceDocument`** — one ingested artifact plus its extraction.

| Field | Type | Notes |
|---|---|---|
| `id` | `SourceDocumentId` | |
| `tenant_id` | `TenantId` | |
| `document_type_id` | `DocumentTypeId` | |
| `origin` | `'upload' \| 'connector' \| 'api'` | An ERP connector is one origin among several |
| `extracted` | `Record<FieldPath, ExtractedValue>` | |
| `provenance` | `Provenance` | Page, bounding box, confidence |

> `Provenance` is where the salvaged bounding-box geometry lands
> (`documentBoundingBoxUtils.ts`, 382 LOC, zero imports). It is worth more here
> than it ever was for invoices: a KYC reviewer needs to see *where on the
> passport* a value came from.

---

## 4. The generic core

### `ReconciliationDefinition`

The configuration that makes a domain. Finance and KYC differ only in instances
of this type.

| Field | Type | Notes |
|---|---|---|
| `id` | `DefinitionId` | |
| `tenant_id` | `TenantId` | |
| `name` | `string` | |
| `domain` | `DomainKey` | Labelling and filtering only — **never branches engine logic** |
| `sources` | `SourceSlot[]` | **N slots. Arity lives here.** |
| `match_keys` | `MatchKey[]` | How records across slots are grouped |
| `rules` | `MatchRule[]` | What must agree once grouped |
| `sop_id` | `SopId \| null` | Resolution procedure |

**`SourceSlot`**

| Field | Type | Notes |
|---|---|---|
| `slot` | `string` | Stable name, e.g. `invoice`, `identity_document` |
| `document_type_id` | `DocumentTypeId` | |
| `cardinality` | `'exactly_one' \| 'at_least_one' \| 'optional'` | Lets a slot be absent without special-casing |

**`MatchKey`** — how candidates are grouped across slots.

| Field | Type |
|---|---|
| `slot_paths` | `Record<SlotName, FieldPath>` |
| `normaliser` | `'exact' \| 'casefold' \| 'digits_only' \| 'name_normalise'` |

**`MatchRule`** — what must agree, once grouped. This is the whole rules engine.

| Field | Type | Notes |
|---|---|---|
| `id` | `RuleId` | |
| `label` | `string` | Human-readable; becomes explanation text |
| `comparator` | `Comparator` | See below |
| `operands` | `Operand[]` | Slot + field path pairs |
| `tolerance` | `Tolerance \| null` | Absolute, percentage or day-window |
| `severity` | `'critical' \| 'high' \| 'medium' \| 'low'` | |

**`Comparator`** — a closed set, deliberately small:

```
'equals' | 'sum_equals' | 'within_tolerance' | 'within_days'
| 'present' | 'absent' | 'matches_pattern' | 'fuzzy_name'
```

A three-way price match is `sum_equals` with three operands and a money
tolerance. A passport-to-registry name check is `fuzzy_name` with two operands.
**Same comparator table, same engine.**

### `ReconciliationRun`

| Field | Type | Notes |
|---|---|---|
| `id` | `RunId` | |
| `tenant_id` | `TenantId` | |
| `definition_id` | `DefinitionId` | |
| `status` | `'queued' \| 'running' \| 'completed' \| 'failed' \| 'incomplete'` | ⚠️ **This cell read four members until 16 Aug 2026 and is corrected rather than rewritten silently, because a reader building a consumer from THIS table is exactly who G153 says gains a third terminal case.** `incomplete` (O-16 / G153) means **sound over less than everything** — the ledger is persistable, the population it was computed over is not the population. It is neither `completed` nor `failed`; folding it into either one chooses between discarding a sound partial result and persisting an unsound one without telling the consumer that a choice was made. The named union is `RunStatus` (`model/domain.ts`, derive the line: `grep -n 'export type RunStatus' model/domain.ts`), and it is the pinned half of `tools/check-wire-mirror.mjs`'s `run_status` pair. 🛑 **The boundary, and do not read past it:** *incomplete* is sound over less than what the engine was **HANDED**, never less than what was **SENT** — there is no arrivals denominator anywhere in this repository, and §9a of `model/reconciliation.ts` states that at the declarations |
| `inputs` | `Record<SlotName, SourceDocumentId[]>` | |
| `started_at` / `finished_at` | `Timestamp` | |
| `token_usage` | `TokenUsage \| null` | Carried over from the live app's Token Usage surface |

### `MatchGroup`

One candidate set drawn across slots — the unit a reviewer looks at.

| Field | Type | Notes |
|---|---|---|
| `id` | `MatchGroupId` | |
| `run_id` | `RunId` | |
| `key_values` | `Record<string, string>` | The resolved match key |
| `members` | `Record<SlotName, SourceDocumentId[]>` | Missing slot = empty array, not an error |
| `outcome` | `'matched' \| 'exception'` | |

### `Exception`

The product. Note `explanation` is **not optional**.

| Field | Type | Notes |
|---|---|---|
| `id` | `ExceptionId` | |
| `tenant_id` | `TenantId` | |
| `match_group_id` | `MatchGroupId` | |
| `rule_id` | `RuleId` | The rule that failed |
| `severity` | `Severity` | Inherited from the rule |
| `explanation` | `Explanation` | **Required. Non-nullable. Enforced at the type level.** |
| `status` | `ExceptionStatus` | |
| `assigned_to` | `UserId \| null` | |

**`Explanation`** — structured, not a rendered string.

| Field | Type | Notes |
|---|---|---|
| `summary` | `string` | One sentence, human-readable |
| `observed` | `ObservedValue[]` | Each slot's contributing value, **with provenance** |
| `expected` | `string` | What the rule required |
| `delta` | `Delta \| null` | Quantified difference where meaningful |
| `confidence` | `number \| null` | Present when extraction confidence bears on the finding |

Structured rather than prose so the UI can render provenance links, the delta can
be sorted and aggregated, and the same explanation can be re-rendered in a
partner's language or a customer's terminology without re-generating text.

**`ExceptionStatus`** — domain-neutral, replacing the finance-specific slugged
statuses (`pending_<slug>_approval`):

```
'open' | 'investigating' | 'resolution_proposed'
| 'pending_approval' | 'resolved' | 'rejected' | 'dismissed'
```

---

## 5. Resolution

**`Sop`** — versioned resolution procedure. Shape salvaged from the existing SOP
subsystem, which both review teams rated the best-formed business logic present.

| Field | Type | Notes |
|---|---|---|
| `id` | `SopId` | |
| `tenant_id` | `TenantId` | |
| `name` | `string` | |
| `version` | `number` | |
| `status` | `'draft' \| 'active' \| 'archived'` | |
| `derived_from` | `SopId \| null` | **Partner template → customer instantiation** |
| `steps` | `SopStep[]` | |

> `derived_from` is the salvaged clone-to-scope flow. A partner authors a
> template SOP in its own tenant; each customer tenant instantiates a derived
> copy. This was the single most directly reusable concept found in the review.

**`ResolutionProposal`** and **`ApprovalDecision`** carry the workflow. The
existing configurable-approver concept survives, but as a role reference rather
than a string slugged into status values.

---

## 6. Cross-cutting

**`AuditEvent`** — new. The current Admin UI advertises "Audit Logs" while no
route, surface or API exists.

| Field | Type |
|---|---|
| `id` / `tenant_id` / `actor_user_id` / `at` | — |
| `action` | `string` |
| `subject_type` / `subject_id` | `string` |
| `before` / `after` | `Json \| null` |

**`TokenUsage`** — carried over from the live no-SAP app (412 rows), re-scoped
per tenant so partners can see their customers' consumption.

---

## 7. Proof: both domains through one core

The obligation from §0. No engine branching; only different `ReconciliationDefinition` rows.

### Finance — three-way match

```ts
const financeThreeWay: ReconciliationDefinition = {
  id: 'def_fin_3way', tenantId: 'ten_acme', domain: 'finance',
  name: 'Invoice / PO / Goods Receipt',
  sources: [
    { slot: 'invoice',       documentTypeId: 'dt_invoice', cardinality: 'exactly_one' },
    { slot: 'purchase_order',documentTypeId: 'dt_po',      cardinality: 'exactly_one' },
    { slot: 'goods_receipt', documentTypeId: 'dt_grn',     cardinality: 'at_least_one' },
  ],
  matchKeys: [{
    slotPaths: {
      invoice: 'header.po_number',
      purchase_order: 'header.po_number',
      goods_receipt: 'header.po_number',
    },
    normaliser: 'digits_only',
  }],
  rules: [
    { id: 'r_qty', label: 'Received quantity must equal invoiced quantity',
      comparator: 'sum_equals', severity: 'high',
      operands: [
        { slot: 'goods_receipt', path: 'lines[].qty_received' },
        { slot: 'invoice',       path: 'lines[].qty_billed' },
      ], tolerance: null },
    { id: 'r_price', label: 'Invoiced unit price must match the PO within 2%',
      comparator: 'within_tolerance', severity: 'critical',
      operands: [
        { slot: 'invoice',        path: 'lines[].unit_price' },
        { slot: 'purchase_order', path: 'lines[].unit_price' },
      ], tolerance: { kind: 'percentage', value: 2 } },
  ],
  sopId: 'sop_ap_exceptions',
}
```

### KYC — document against registry

```ts
const kycIdentity: ReconciliationDefinition = {
  id: 'def_kyc_identity', tenantId: 'ten_acme', domain: 'kyc',
  name: 'Identity document vs registry record',
  sources: [
    { slot: 'identity_document', documentTypeId: 'dt_passport',  cardinality: 'exactly_one' },
    { slot: 'registry_record',   documentTypeId: 'dt_registry',  cardinality: 'exactly_one' },
    { slot: 'address_proof',     documentTypeId: 'dt_utility',   cardinality: 'optional' },
  ],
  matchKeys: [{
    slotPaths: {
      identity_document: 'holder.national_id',
      registry_record:   'subject.national_id',
      address_proof:     'account.national_id',
    },
    normaliser: 'digits_only',
  }],
  rules: [
    { id: 'r_name', label: 'Document holder name must match the registry',
      comparator: 'fuzzy_name', severity: 'critical',
      operands: [
        { slot: 'identity_document', path: 'holder.full_name' },
        { slot: 'registry_record',   path: 'subject.full_name' },
      ], tolerance: { kind: 'similarity', value: 0.92 } },
    { id: 'r_dob', label: 'Date of birth must match exactly',
      comparator: 'equals', severity: 'critical',
      operands: [
        { slot: 'identity_document', path: 'holder.dob' },
        { slot: 'registry_record',   path: 'subject.dob' },
      ], tolerance: null },
    { id: 'r_expiry', label: 'Document must not expire within 30 days',
      comparator: 'within_days', severity: 'medium',
      operands: [{ slot: 'identity_document', path: 'document.expiry_date' }],
      tolerance: { kind: 'days', value: 30 } },
  ],
  sopId: 'sop_kyc_review',
}
```

### What this actually demonstrates

**Corrected 4 Aug 2026 after adversarial review.** An earlier revision called
this section "the proof obligation" and presented it as proof of domain
neutrality. It is not, and the overclaim was the most consequential thing the
review found.

| | Finance | KYC |
|---|---|---|
| Slots | 3 | 3 (one optional) |
| Arity handling | identical | identical |
| Engine code path | identical | identical |
| New types required | **none** | **none** |

That much is true and worth having. But both examples are **the same
topology**: N documents → equi-join on one normalised identifier → pairwise
field comparison. What differs between them is vocabulary.

**The demonstrated property is therefore vocabulary neutrality within a fixed
matching topology.** That is real, useful, and narrower than "domain-neutral".

What it does **not** establish:

- That a domain needing a different *topology* fits. Sanctions screening needs
  fuzzy *find* rather than fuzzy *compare* — the grouping step must be
  approximate, which this pipeline runs in the wrong order. It also needs a
  shared list that is not tenant-scoped, and evidence of a *negative* result,
  which a model that only emits `Exception` cannot produce.
- That the engine behaves correctly, because there is no engine. This compiles;
  it does not run.
- Anything about the announced domains. `credit_underwriting` and
  `medical_records` ship as `availability: 'announced'` with empty templates —
  the proof is computed over exactly the two samples the model was designed
  against.

**Why the design still stands.** Arity-as-data, `SlotRole` and non-optional
`Explanation` were each attacked directly and survived. The topology is a
legitimate choice for the domains in scope. It simply needs to be stated as a
choice, so the next person to add a domain checks whether it fits rather than
assuming it must.

---

## 8. Persistence implications (stack-neutral)

Not a schema — the constraints any stack must satisfy.

1. **`tenant_id` on every table**, indexed, leading column of every composite index. Isolation enforced at the data layer (row-level security or equivalent), not in application code.
2. **The cross-tenant predicate is exactly one rule**: `tenant.partner_id = :partner_id`, for `partner_admin` only. Any second cross-tenant path is a design regression.
3. **`Explanation` is stored, not derived at read time.** It must survive a rule change — an exception raised under v1 rules keeps its v1 explanation.
4. **`SourceDocument.extracted` is semi-structured** (JSON column or document store). `FieldSpec` is the contract; the storage engine does not need to know it.
5. **`MatchGroup.members` is a set per slot**, so an n-way group is not an n-column table.
6. **Append-only `AuditEvent`.** No update path.
7. **No credential storage.** `User` has no password column, by design.

---

## 9. What this replaces

| Old | New |
|---|---|
| `ExceptionDetailsPayload = Record<string, unknown>` | `Exception` + typed `Explanation` |
| 8 finance substring checks duplicated across two 4,800-line files | `MatchRule[]` as data |
| `threeway_status: 'yes' \| 'no'` | `MatchGroup.outcome` over N slots |
| `tenantUserId` (a copy of `userid`) | `Tenant.id`, server-derived |
| `userRole` cookie, client-writable | `Membership.role`, server-enforced |
| `pending_<slug>_approval` status slugging | `ExceptionStatus` + `ApprovalDecision` |
| `SopContext = 'company' \| 'vendor'` | `Sop.derived_from` |
| Vendor keyed by name string in `localStorage` | Tenant-scoped entity with an id |

---

## 10. Open questions

1. **Partner staff memberships.** `Membership.partner_scope` is modelled, but whether a partner admin gets implicit membership in every customer tenant or explicit per-tenant grants is unresolved. Implicit is easier to operate; explicit is easier to audit.
2. **Cross-tenant SOP templates.** `derived_from` currently points within a tenant. Partner-authored templates need it to cross tenants — the one place the flat model may need a documented exception.
3. **Match key discovery.** Whether `MatchKey` is always tenant-configured or whether the system proposes keys from extraction. Affects onboarding effort per customer.
4. **Rule versioning.** `Explanation` is stored to survive rule changes, but whether `MatchRule` is itself versioned like `Sop` is undecided.
5. **`fuzzy_name` implementation** and whether its threshold is tenant-tunable. Materially affects KYC demo credibility.
6. ~~**Domain packs.**~~ **Closed 4 Aug 2026.** Resolved as `SolutionPack` +
   `InstalledPack`, adopted from AiVolvex's COTS-solutions concept. Finance and
   KYC ship as `available` packs; credit underwriting and medical records are
   `announced`. A partner onboards a customer by installing a pack. See
   `docs/platform-adoption.md` §5.


---

## 11. Model evolution — everything added since this document was first drafted

This section is the changelog. Each entry records what changed and **why**,
because the reasoning is the part that does not survive in a type signature.

### 11.1 From the adversarial swarm (six agents, ~9,500 lines)

Adjudicated in `docs/model-change-ledger.md`. Four findings changed the shape of
the model rather than adding to it:

| Finding | Change |
|---|---|
| `MatchGroup` was the only reconciliation row without a tenant, while carrying a national identifier in `keyValues` | `extends TenantScoped`. Row-level security cannot be written against a table with no tenant column, so the *stated primary control* was structurally inapplicable and the failure would have been silent. |
| A customer-derived evaluation label could be typed as a platform asset | `LabelledExample` split into `SeededExample \| ObservedExample`. `{tenantId: null, provenance: 'observed'}` is now unrepresentable. |
| `Membership.partnerScope` bypassed `PartnerAccessGrant` entirely | `effectivePartnerRole()` clamps membership against the live grant. No scope ever yields `approver` — approval is the customer's control. |
| Purging a document did not remove the personal data | `SubjectIndexEntry` records locations **at creation time**; `LegalHold` and `purgeVerdict()` implement `HOLD > MINIMUM > ERASURE > MAXIMUM`. A scan cannot find a value inside a stored `Explanation`. |

### 11.2 Expressiveness

- **`Expr` + `RulePredicate`** replaced `comparator` + positional `operands[]`.
  The old form encoded `invoice.total − credit_note = payment` as three field
  references and one word, with two readings giving opposite answers.
- **`MatchRule.when`** — conditional rules. "2% domestic, 5% international" had
  no encoding, and the two-rule workaround false-criticalled every international
  invoice.
- **`RuleScope` + `LineMatchKey`** — line grain was undefined while §7's own
  finance example depended on it.
- **`Money`, `FxPolicy`, `FxConversion`** — `currency` appeared exactly once in
  the entire model, which made `autoResolveValueCeiling` unenforceable.
- **`ReconciliationPeriod` + `RunTrigger`** — reconciliation is period-bound,
  and a re-run must be distinguishable from a first run.

### 11.3 Governance (`model/governance.ts`)

Three doors closed: platform support access (the only cross-tenant path
*guaranteed* to be exercised — a customer files a ticket and someone looks), the
partner second door, and erasure.

`SupportAccessGrant` carries `visibleToTenant: true` as a **literal type**, so a
support session the customer cannot see is unrepresentable.

### 11.4 Residency survives inference (`model/catalog.ts`)

Exposed by surveying `ap-southeast-1`. Bedrock offers the same model as
`apac.*` (stays in APAC) or `global.*` (routed anywhere). **A global profile
passes an `allowedModels` check and an `allowedRegions` check separately while
satisfying neither together** — Singapore-resident storage, inference anywhere,
and a deployment diagram that looks compliant. `resolveModel()` rejects global
routing unconditionally.

### 11.5 Observability as three planes (`model/observability.ts`)

Prompt redaction existed; trace redaction did not. Adopting OpenTelemetry as
planned would have shipped a redaction bypass.

The sharper finding is that **counts leak as badly as content**. A partner holds
the wholesale rate card — it is the party billed — so per-tenant money divides
back into document, reconciliation and exception counts. `PartnerHealthView`
therefore reports an error *band* and a boolean for activity, never a number.

### 11.6 Blueprint concepts (from `docs/aivolvex-concept-assessment.md`)

`SolutionPack` was a bundle that could *exist*. It had no account of being
**changed across a fleet**.

- **Eight-state gated lifecycle**, replacing three values that could not express
  "passed evals, not yet approved" or "rolling out".
- **`PackPosture`** — the latency, cost and outcome commitments a rollout is
  measured against.
- **`PackRollout`** — strategy plus rollback triggers.
- **`PackBinding`** — one declaration, per-environment deployments. This is the
  structural fix for demo-versus-production drift, which the current product
  suffers from and which we had been treating as a discipline problem.
- **`ScoreLevel`** — component / composition / outcome, distinct from
  `ScoreTarget`. Cost and latency propagate linearly; **quality does not**.
  Composition can amplify an error, dampen it, or moot it. An outcome score is
  therefore measured directly and never averaged up from components.
- **`canTriggerRollback()`** — only an outcome-level scorer may revert a live
  rollout. The rule most likely to erode one exception at a time, so it lives in
  the type system.

### 11.7 Commercial integrity

- **`UsageRecord.idempotencyKey`** — at-least-once delivery was double-counting
  tokens into an append-only table with no compensating instrument.
- **`ProviderCostRecord` / `CostReconciliation` / `PlatformMarginLine`** — the
  platform could price a rate card but had **no type recording what anything
  cost it**. A provider bill never captured against a period is not
  reconstructable.
- **`METER_AGGREGATION`** — `storage_gb_month` is a stock, not a flow. Summing
  daily samples over-bills 30×.
- **Period-locked cost tags** — re-tagging after close silently rewrites a
  customer's chargeback history.

### 11.8 Tenancy refinement

`Account` sits above `Tenant` for commercial grouping and holds the partner
relationship. **Isolation stays flat** — no tenant nests inside another. A
customer running finance *and* KYC gets two tenants under one account: separate
data, separate users, separate policy, one invoice.

The distinction that made this necessary: *data isolation* and *commercial
grouping* are different problems, and the original flat-tenant decision
conflated them.

---

## 12. Module map

**Twenty-three** TypeScript modules under `model/` — `ls model/*.ts | wc -l` — ⚠️ **this said
nineteen until 22 Aug 2026, then TWENTY on two branches at once**: `session.ts` landed
under G225 and `field-path.ts` as G214's one parse seam, **each branch wrote twenty, and
the merged tree is twenty-one — a figure neither side ever computed** —
typechecking under `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and
`erasableSyntaxOnly`. (This section said *ten* and listed ten; `access.ts` landed
5 Aug morning, `agents.ts` and `presentation.ts` that evening. It then said
*thirteen* and listed thirteen until 7 Aug 2026, while sixteen files were on
disk: `learning.ts` landed 6 Aug and was never added, and `kernel.ts` and
`identity.ts` had never been in this table at all. **Derive it; do not read it.**)

⚠️ **Two of these modules are wholly `@dropped-for-v1` — declared, not built.**
See `docs/HANDOFF.md` §0 and `docs/v1-scope-ledger.md`.

| Module | Concern |
|---|---|
| `kernel.ts` | the branded-id primitives every other module imports, and no imports of its own |
| `identity.ts` | the totality proofs — every entity carries its own id, every brand argument names its entity, no id-shaped reference is a bare string |
| `canonical.ts` | **RFC 8785 (JCS) canonicalisation — G20.** Which bytes represent a record, which `RecordChain` and `UsageAttestation.bodyHash` both assumed and nothing defined. Irreversible after the first hash |
| `domain.ts` | tenancy, documents, archetypes, reconciliation, procedures, dispositions, tagging, money, packs, endpoints, `Solution`, and the operator-initiated proposal |
| `reconciliation.ts` | **the engine, as types and total functions** — the executable half of the `set_reconciliation` archetype: two populations in, `PairingSpec.strategies` folded in declared order, the residue out. Carries `AssertNoTextDeep` and invariant 4's fail-closed refusal of an unclassified field (G106) |
| `access.ts` | stakeholder classes, capabilities, roles, scope, `OrgClass`, `CAPABILITY_RESOURCE_CLASS`, and the `authorize()` / `redeemAuthorization()` spine |
| `agents.ts` | the agent composition model — tools with effects, harness documents, model binding through the catalogue, the platform eval floor, `DerivedAgentGrant` |
| `presentation.ts` | ⚠️ **wholly dropped for v1.** Dashboards, cards and bindings; every binding resolved under the viewer's own scope |
| `deployment.ts` | ⚠️ **wholly dropped for v1 under G36.** The fleet — data planes, liveness, versions, heartbeat, supported-version window |
| `correspondence.ts` | counterparties, threads, the inbound trust boundary, outbound disclosure |
| `connectors.ts` | connector configuration — closed over the security-relevant parameter kinds, open over their names. `CONNECTOR_PARAMETER_ENFORCEMENT` is total, so a fifth kind cannot arrive without a row saying who may set it and whether it clears verification |
| `governance.ts` | tenant access grants, partner-role clamping, the subject index, erasure |
| `policy.ts` | eight policy kinds (six live), the admission gate, measured autonomy |
| `catalog.ts` | model garden, with residency enforced at routing level |
| `billing.ts` | metering, rating, budgets, entitlement leases, attestation |
| `evaluation.ts` | scorers, gates, labels, and the adversarial injection corpus |
| `observability.ts` | three telemetry planes |
| `examples.ts` | finance and KYC expressed as data against one core |
| `learning.ts` | **added 6 Aug — a proposal, not a decision.** Corrections derived rather than stored, a nomination gate, and a learning record with no free-text field. Zero call sites |
| `session.ts` | **added 22 Aug 2026, G225.** `SessionBounds` and `validateSessionBounds()` — the two numbers a deployment must state before any session can be minted, refusing on absence under G139, with G220's twelve hours and thirty minutes as a platform CEILING and never as a default. **Imports nothing**, which is what keeps `MAX_AUTHORIZATION_SECONDS` — a grant ceiling, not a session clock — structurally out of reach |
| `field-path.ts` | **added 22 Aug 2026, G214.** The one parse seam for `FieldPath`, now a branded token list rather than a string. No wildcard, per **G243**: a `FieldSpec` must name ONE thing, because G222 makes an outbound `DataClass` the maximum over the `FieldSpec` classes carried, and a maximum over a set is computable only if each path names one field |
| `serving-host.ts` | **added 23 Aug 2026 under G225, closing G179's circularity.** The capability contract said `dataPlaneHost` is *"Resolved at sign-in, never guessed"* and nothing said how — you need the host to sign in, and the host is resolved at sign-in. Holds `ServingHost` and `resolveServingHost()`, which is a **registry lookup and never a parse** (`tenant = subdomain(host)` breaks silently the moment a customer serves from its own domain under BYOA); the one host normalisation, folding case and nothing else; G180's `checkHostBinding()`, which returns the revocation as a VALUE because a refusal without it leaves a tossed session live; the reserved-label list as a mint-time rule on the tenant slug, where G97 puts id-format rules; and the region-versus-`Tenant.residency` agreement, which is a second executable residency check and does **not** substitute for `resolveModel()`. Reaches `IdentityConnection.domains` nowhere — G179: *"one field answering both is one field that can disagree with itself"* |
| `ingestion.ts` | **added 24 Aug 2026 under G225, carrying G184, G205 and G206 together.** `IntakeChannel` is the LANE — four kinds, and `lastArrivalAt` is *"liveness, not health"*, defined as the `arrivedAt` of the newest `Arrival` row so a landing notification the cascade could not resolve does not advance it. `Arrival` is ONE ARTEFACT on a lane, and it exists because nothing anywhere recorded that file 39,998 was refused or why. `admitArrival()` is a **fixed cascade of total functions** — identity, liveness, wiring, authority, singularity, substance — copying `admitPopulation()` rather than inventing beside it, because the set of ways an arrival can be refused is then enumerable, which an authored graph structurally cannot promise. `ArrivalFacts` carries **no filename, no bytes and no tenantId**, and `AssertNoTextDeep` makes a bare `string` a compile error on both the input and the refusal — invariant 6 as the absence of a place to put content. `guardAuthorisation()` is the first thing in the repository that ever EVALUATES `Endpoint.boundUntil`. §3 holds G206's pack classification vocabulary and its publication-time validator, declared and **not evaluated** — G118 |
| `held-work.ts` | **added 24 Aug 2026, G225/G233.** Held work — a lapsed session's draft and an unresolved uniqueness conflict — under one fourteenth `RetentionClass`, `held_work`, with `latestPossiblePurge()` as the abandonment rule rather than a bare retention period |
| `money.ts` | **added 19 Sep 2026 under G286 — G111's one money codec, and the direction of the correction is the point.** `CLAUDE.md` said `bigint` from 8 Aug 2026 and the tree said `number`; the owner ruled that **the record was right and the code was wrong**, refusing the cheap direction because it *"ratifies a ceiling nobody chose by writing down what drifted."* The deciding fact is a CEILING and not an arithmetic defect: `number` is exact on integers to 2^53, which is ample for one close and not ample for a cumulative total. Holds the representation, the arithmetic, the guards, `MoneyRefusal` and the four wire functions; `model/reconciliation.ts` re-exports the surface so no caller learned a new name. **The two guard arms were re-homed rather than retired** — read the module header before quoting either |
| `onboarding.ts` | **added 19 Sep 2026 under G535 — H2's sequence, and it is the MODEL third of G300 and deliberately not the other two.** Six ordered steps, whose hands each is in, the gate rule *"the first step that is not done is the only one that can be done"*, and the permanent forced mark. The state is a prefix length rather than a set, so *"step four done, step two not"* cannot be written down. **`forced` is append-only**, against the prototype's single slot, because the contract calls the reason permanent and a record a second write can overwrite is not one. **No table lands with it** — G511: *"the fence and the writer are one commit or neither"* — and there is no `stalled` stage, because a clock has no producer here |
| `approval.ts` | **added 19 Sep 2026 under G658 — the twenty-seventh module, and the first evaluator `ApprovalConfig.quorum` and `segregationOfDuties` have ever had.** Both fields were declared and read by nothing; `model/policy.ts` already said what that costs — *"A control that always passes is a false assurance."* Holds `approvalState()`, `segregationViolated()`, `approvalRequiredFor()` and the severity ladder. 🛑 **It is not a second `decide()`** — it takes no principal, answers only whether a PROPOSAL is ready, and runs after the gate; a refusal here is a 409. ⚠️ **`approvers: CapabilityRequirement[]` stays unevaluated**, because a request path can read exactly one person's assignments — its own |
| `run-admission.ts` | **added 19 Sep 2026 under G692, and it is the twenty-seventh module — the executable form of *"run admission must be idempotent on (period, definition, slot-fill state)"*, which `RUN_TRIGGER_KINDS` has stated in prose since 5 Aug 2026 with nothing anywhere doing it.** Three total `Record`s — `DEFINITION_ADMITS_A_RUN`, `PERIOD_ADMITS_A_RUN` (two of four members admit: `reopened` does, because the contract's own remedy for `period_closed` is *"Reopen the period first"*) and `CARDINALITY_REQUIRES_A_DOCUMENT` — and a NINE-ARM refusal union carrying branded ids only, so `AssertNoTextDeep` holds on it. 🛑 **IT DOES NOT HASH AND IT DOES NOT READ A ROW.** `slotFillBasis()` returns the RFC 8785 canonical form and stops; the digest lives with the writer outside `model/`, which is `0012` §6's rule for `subject_ref`. 🛑 **THE UNFILLED SLOT NAMES TRAVEL OUTSIDE THE CONTAINMENT PROOF**, on `RunAdmissionVerdict.unfilledSlots`, because `SlotName` is a bare `string` — *"the union carrying the REASON holds the proof; the record carrying the declared path does not"*. ⚠️ **`trigger_not_enabled` IS NOT AN ARM AND CANNOT BE**: `manual` is deliberately absent from `RUN_TRIGGER_KINDS`, so it cannot fail a test against a set it is not in — the arm belongs to the `scheduled` admitter nobody has written. ⚠️ **NOTHING BINDS A `SourceDocument` TO A SLOT anywhere in the repository**, so the fill is empty on every served request and a definition declaring an `exactly_one` slot is a 422 forever. That is the correct answer and it is stated on the declaration so nobody reads `[]` as *all slots satisfied* |
| `extraction.ts` | **added 21 Sep 2026 under G1451–G1459 — the ONE conversion seam, and it is where invariant 4 stops being a rule about storage and becomes a rule about reading.** `addressableToExtracted()` turns a stored position into an `ExtractedValue` by reading `FieldSpec.dataType` — the operator's declaration — and consults the value only to decide whether the value can BE what was declared, which is the opposite direction and is a refusal. **The alternative was measured before the module was written**: a converter dispatching on `typeof value` disagreed with the declaration on four of four of E1's fixture rows, `1000` declared `money` sniffing as `number` among them. **R12 (the owner's) builds `structured` and `tabular` only**; `digital_text` and `scanned` put OCR and a model in the path, which invariant 7 governs, and G7 and G8 are both unapplied so invariant 7 has nothing to enforce against there. The fence is keyed on `FIDELITY_CROSSES_MANAGED_SERVICE` — `model/ingestion.ts`'s existing total record, imported — never on a list of fidelity names. **Money is `model/money.ts`'s alone (G111)** and a number at a `money` position is refused, because a number carries no currency. ⚠️ **The fail-closed confidence hold it leans on is INERT** — `heldReadsFor()` holds only where a floor was declared and G139 records that no authoring surface for floors exists |
| `session-mint.ts` | **added 21 Sep 2026 under G1601–G1612 — the twenty-ninth module, and the TYPE-LEVEL HALF OF INVARIANT 1 at the mint.** Copy it, never paraphrase it: *"Tenant scope is derived from the session, never read from a request."* `MintSessionInput` has **no `tenantId` field at all — absent, not `null`**, so passing one is a `tsc` error and not a review comment. 🛑 **THE BREACH IT GUARDS AGAINST ARRIVES CARRYING A RULING'S ENDORSEMENT**: G315 puts the tenant in the OIDC `state` DELIBERATELY as a routing fact for the 302, and a writer that carries it forward makes tenant scope a thing conferred by authentication, with a decision behind it that really was deliberate — about a different act. The shape is `model/identity.ts`'s `_InvitationRedemptionCarriesNoTenantId` and `ResolvedSubject`'s, not a third one. 🛑 **A KEY CHECK ALONE LEAKS, MEASURED BY MUTATION:** `surface: ServedSurface` — the value a caller at a mint is already holding — leaves `_MintSessionInputCarriesNoTenantId` GREEN and fails only `_MintSessionInputReachesNoTenantDeep`. **`AssertNoTenantDeep` is `NoTextField`'s idiom pointed at a different leaf and is a different ORDER rather than a second implementation of one**; its leaf test is `Extract`, never `extends`, because `TenantId \| null extends TenantId` is FALSE and would wave through exactly the shape `Session.tenantId` has. ⚠️ **`MintedSessionFacts` IS AN `Omit` OF `Session` AND THAT IS THE LOAD-BEARING HALF** — excess-property checking is a check on LITERALS, so a spread carries a tenant past the compiler and the output has nowhere to put it; it is also why a thirteenth field on `Session` is a `TS2739` at the mint (G1122's shape). **THE TENANT IS STILL BOUND LATER AND SEPARATELY** by `selectTenantForSession()`, a CHECK and never a CHOOSER, with `session_selection_restrictive` as the other half — G160 and G199, *"either alone is a defeat"* — and this module touches neither. ⚠️ **NO CLOCK**: `Timestamp` is a string alias and G111's codec is not started, so the mint produces no `expiresAt` and returns the VALIDATED bounds for the writer to spend as `now() + interval`. ⚠️ **NO WRITER, NO ROUTE, NO MIGRATION, AND NONE OF R1–R7 IS TAKEN** |
| `partner-portal.ts` | **added 1 Oct 2026 under W5 (G2633–G2640) — the THIRTY-FIRST module, and the partner portal's THINGS where R10's `model/access.ts` §6c gave it a PRINCIPAL.** Invitations, the roster state, deal registrations, the sandbox and trial requests — G300's MODEL third for the five operations mounted the same day. 🛑 **NOTHING IN IT NAMES A TENANT**, and `_PartnerPortalRecordsNameNoTenant` makes adding one a compile error: invariant 2's single path stays the only one. ⚠️ `checkDealRegistrationShape()` holds the rule the wire cannot (every shape-specific field is optional there), and `normaliseCompany()` is ASCII-only because `0322`'s generated key is `COLLATE "C"` — G2636, found by evaluating the column's own expression |
| `publication.ts` | **added 4 Oct 2026 under U-29 (G4201–G4207) — the THIRTY-SECOND module, and G110's publication seam's REFUSAL LOGIC for document types, as a pure function.** `validateDocumentTypeTemplates()` — six refusals, a const so `tools/check-pack-safety.mjs` derives its inventory (G4202) — and `admitDocumentTypeDeclaration()`, which also runs G206's `validatePackClassificationRules()` and refuses an EMPTY declaration (§5.6). 🛑 **IT IS NOT A WRITER**: no grant, no route, no migration — which operation, verb and principal may author a document type is **G4204, ⛔ PUT TO THE OWNER**. ⚠️ It does not run the procedure validator, because that would forge a tenant (G4203); and `key_shipped_twice` exists because the classification validator resolves a duplicated key last-wins, silently (G4205) |


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

⚠️ **THE COUNT ABOVE AND THIS TABLE DO NOT AGREE, AND THE TABLE IS THE SHORT
ONE.** Seventeen rows against twenty modules. `canonical.ts`, `connectors.ts` and
`reconciliation.ts` have never been in it — an omission has no number in it, so
`tools/check-doc-counts.mjs` sweeps the count and cannot see the missing rows.
Recorded on 22 Aug 2026 rather than fixed silently; adding three rows this slice
did not write is not this slice's to do.

> 🛑 **AND IT HAPPENED A FOURTH TIME. THIS TABLE LISTED SIXTEEN WHILE THE
> SENTENCE ABOVE IT CORRECTLY SAID NINETEEN, UNTIL 23 Aug 2026.** The paragraph
> above already narrates two earlier rounds of exactly this — *ten*, then
> *thirteen* while sixteen were on disk — and ends *"Derive it; do not read it."*
> **A reader who followed that instruction still got the wrong list**, because
> the instruction governs the NUMBER and the defect was in the ROWS.
> `canonical.ts`, `reconciliation.ts` and `connectors.ts` had never appeared
> here. The same three were missing from `docs/INDEX.md` and `docs/HANDOFF.md`
> §2; all three tables were corrected together.
>
> ⚠️ **`node tools/check-doc-counts.mjs` was EXIT 0 throughout and was right to
> be** — the total is derived and correct, and the enumeration under it is a
> separate claim with no number in it. **G242** rules that this class gets a
> control: `tools/check-absent-rows.mjs` compares this table against
> `ls model/*.ts` inside `npm run check`, in both directions — a module with no
> row, and a row naming a module that no longer exists.

## 13. The archetype axis and the procedure harness — 4 Aug 2026

Two corrections from a product-direction review, both structural.

### 13.1 "Finance is an instance" was an oversimplification

A controller's month is three-way match, bank reconciliation, intercompany, GL
account rec, accrual completeness and vendor master — six structurally different
problems wearing one label. `DomainKey` was carrying both *context* and
*structure*, and `SolutionPack` was scoped to the label, so pack granularity was
wrong too.

**Domain** is now context: vocabulary, classification defaults, regulator,
naming. **Archetype** is structure: how sources relate and what a break
physically is. They vary independently — bank rec and three-way match share a
domain and differ in archetype; KYC identity and healthcare eligibility differ in
domain and share one.

| Archetype | Shape | v1 |
|---|---|---|
| `n_way_document_match` | 2..N documents per subject, keyed, field-compared | yes — existed |
| `attribute_verification` | one subject, N corroborators, attributes must agree | yes — existed |
| `set_reconciliation` | two populations, many-to-many pairing, residue is the output | yes — **new** |
| `existence_completeness` | every X needs a Y within a window; absence is the exception | yes — **new** |
| `balance_rollforward` | opening + movements = closing | modelled, not built |

**Bank reconciliation was unrepresentable.** `MatchGroup` holds named slots of
documents; bank rec is two transaction populations with 1:N and N:1 pairings
where the *unmatched residue on both sides* is the product. `PopulationSpec`,
`PairingSpec` and ordered `PairingStrategy` express it. The strategies are
ordered because the first that pairs wins, and "matched on reference" is an
explanation where a similarity score is not.

### 13.2 The guard against over-generalisation

Four layers, each a closed set defined by the one above:

```
ARCHETYPE  fixed, five. Determines legal config shape, predicates,
           and which disposition FAMILIES exist
DOMAIN     vocabulary, classification defaults, regulator
PACK       document types, definitions, procedures, concrete dispositions
TENANT     tolerances, thresholds, roles, tags — never new structure
```

A tenant tunes a tolerance and cannot add a predicate. A pack names dispositions
and cannot invent a family. Adding an archetype, a predicate or a step kind is a
platform release. The guard is mechanical rather than cultural.

Disposition **families** sit on the archetype deliberately. Set reconciliation
always yields timing differences and in-transit items; N-way match always yields
quantity and price variance. Put families on the domain and every vertical
reinvents them.

### 13.3 SOP was a stand-in for a harness

`SopStep` was `{ order, instruction: string, requiresEvidence: boolean }` — prose
with a number. It could not express a condition, a role, a threshold, a timeout,
a branch or an escalation, which left the approval chain, the autonomy envelope
and the agent-builder workflow as three mechanisms that should have been one.

`Procedure` is a graph with six step kinds — `agent`, `human`, `branch`,
`await`, `notify`, `terminate` — and conditional edges. `branch` reuses
`RulePredicate`, so one expression language governs both matching and procedure
flow rather than the DSL bifurcating. `await` has a `counterparty_reply` target,
which is where the resolution loop actually turns.

The written SOP is now **rendered from the graph**, so the document and the
behaviour cannot drift.

### 13.4 Three DSL gaps closed alongside

- **`Expr` gains `aggregate`** — `sum(goods_receipt.lines[].qty_received)`.
  Partial goods receipt, the most common three-way-match exception, was not
  expressible: `field` resolved one document from a slot that permitted many.
- **`unique_within` gains `period` and `tenant_lifetime`** — duplicate-invoice
  detection needs "same number, same vendor, ever", not "within this run".
- **`ResolutionProposal.action: string` becomes `dispositionKey`** plus a
  `ProposalActor` union so an agent can propose, and `ProposalEvidence[]` for
  why *this disposition* as distinct from why it broke. `policy.ts` listed
  `propose_resolution` as an agent action while `domain.ts` typed the proposer
  as a `UserId`; the two contradicted each other on the core act of an agentic
  product.


---

## 14. Trust, access and measured autonomy — 5 Aug 2026

Nine changes. The through-line is that several things the model *asserted* in
comments became mechanisms, and two accountability chains that terminated at an
agent now terminate at a person.

### 14.1 Correspondence — the resolution loop has vocabulary

`Procedure.await` named a `counterparty_reply` target and `EvidenceKind` named
`correspondence`. Both pointed at nothing, which meant the layer the product's
value actually sits in — chase the counterparty, read the reply, propose with
evidence — was unmodelled.

`Counterparty`, `CorrespondenceThread` and `CorrespondenceMessage` supply it.
Three properties are load-bearing:

- **Inbound is untrusted.** A message is not evidence until admitted.
  `admittedAsEvidenceAt` null means it may be stored, displayed and audited, but
  never cited in a proposal, fed to an agent as grounds, or used to resume a
  parked step. Attachments become `SourceDocument`s only after admission.
- **Outbound is disclosure.** `DisclosureRecord` answers *which fields went to
  whom* without reading bodies. PDPA treats third-party disclosure as a distinct
  act from collection or use.
- **A counterparty is not a vendor.** Deliberately thin and domain-neutral. It
  exists so *"this counterparty has disputed freight three times"* is a query —
  the evidence that makes an agentic proposal beat a deterministic one.

### 14.2 One access grant, for delivery and support

`SupportAccessGrant` was built for incidents — *hours, not weeks* — and delivery
work runs for weeks, so there was no third option between re-requesting a grant
daily and quietly granting a membership. The second erases the audit story the
first exists to provide.

`TenantAccessGrant` separates three things the old type conflated: **duration**,
**resource class**, and **consent basis**. The middle one is what makes a long
grant safe:

> ⚠️ **The table below is superseded by §16.2 — read that before quoting it.**
> There are **thirteen** resource classes, and `sample_data` is **not one of
> them**. Current, from `model/governance.ts:328`:
>
> | Purpose | May reach | Enumeration required | Max |
> |---|---|---|---|
> | `delivery` | `telemetry`, `configuration`, `identity`, `endpoint`, `tenant_data` | **`tenant_data`** | 90 days |
> | `incident` | `telemetry`, `configuration`, `endpoint`, `tenant_data` | — | 24 hours |
>
> The reasoning below is unchanged and is what §16 generalises. The one claim
> that flipped is *"delivery cannot reach `tenant_data` at all"*: it now reaches
> it **only instance by instance, on a customer nomination** — which is a
> stronger property, not a weaker one, and it also gives an FDE debugging a field
> mapping a delivery path they previously lacked (they were raising *incident*
> grants instead, defeating the split).

| Purpose | May reach | Max |
|---|---|---|
| `delivery` | `telemetry`, `configuration`, `sample_data` | 90 days |
| `incident` | `telemetry`, `configuration`, `tenant_data` | 24 hours |

**Delivery cannot reach `tenant_data` at all**, whatever a grant asks for —
`PERMITTED_RESOURCES` enforces it. That single constraint is why weeks is
acceptable.

Not overclaimed: configuration is *low* risk, not zero. A `fuzzy_name` constant
could name an individual and cost-centre vocabularies are customer-authored and
revealing, so it is still recorded as a data access — it simply does not need the
same approval weight.

`sample_data` is its own class because field mapping needs real documents the
engineer cannot otherwise see. The customer nominates a bounded set; an empty
list grants nothing rather than everything.

Grants are bounded by the engagement, lapse on inactivity, and extend under
1CloudHub's control with two staff and a notification. **Customer approval
defaults off** — recorded rather than removed, because a regulated buyer may
contract for it, and because under BYOA it is only half ours anyway: the
cross-account role trust policy lives in the customer's account.

The grant relaxes; the session does not. `AccessSession` still records each
period of use, and now which resource classes were actually touched.

### 14.3 The admission gate

Admission is the single act separating reading a vendor email from obeying one,
and nothing governed *which human* could do it.

`CorrespondenceConfig` — renamed from `OutboundCorrespondenceConfig`, because it
now governs both directions of the same trust boundary — gains
`minimumRoleToAdmit` (default `operator`), an agent ceiling by data class, a
second person above a class, and `admittingAgentMayCarryTools: false`.

`mayAdmit()` decides. The tool-scope rule is the important one: **an agent may
admit only from a step with an empty tool scope**, so the agent that admits is
never the agent that acts. Without it, injected text can induce its own
admission and the checkpoint has a hole in the middle.

Default `operator` rather than `approver` deliberately — routing admission to an
approver makes a security decision into a queue, and queues get cleared in bulk
without reading.

### 14.4 Erasure reaches blobs, traces and correspondence

`SubjectLocation` had six variants, all pointing at PostgreSQL rows. Purging a
`SourceDocument` cascades to its own object, but nothing reached an **exported
CSV**, a **page render**, or a **correspondence body** — and a trace had nowhere
to attach an `out_of_reach` disposition, so the plan omitted the copy silently
rather than disclosing it.

Three variants close it: `blob`, `correspondence_message`, `trace`. Correspondence
forced the issue; the gap had been open since the persistence design.

### 14.5 Acquisition fidelity

`DocumentType.expectedFidelity` and `SourceDocument.actualFidelity`, over four
tiers: `structured` · `tabular` · `digital_text` · `scanned`.

Distinct from `origin`, which records the *channel*. A connector can deliver a
scan and an upload can be structured XML.

The point is that the cheapest document to extract is the one never extracted: a
Peppol invoice or a source-system pull is **parsed**, with no model in the path
and no possible extraction error. And **the gap between expected and actual** is
the useful signal — invoices structured last quarter and scanned this one are a
supplier problem, not a model-tuning problem, and nothing previously told them
apart.

### 14.6 The trifecta rule, and the injection corpus

`validateProcedureInjectionSafety()` requires that **every path from untrusted
content to an outbound notification passes through a human step**, and that no
admitting agent carries tools. Checked by graph reachability **when a pack is
signed**, not at runtime — a rule that only fires in production is a rule that
ships broken.

Scoped to `counterparty_reply`. Extracted values also come from outside but are
constrained by `FieldSpec` and typed as scalars; a reply is unbounded prose
written by someone who may want something. Widening it to all extracted data
would make it unsatisfiable, and an unsatisfiable rule gets switched off.

`InjectionProbe` is deliberately **not** a `SeededExample`. A seeded example
asserts a *result*; a probe asserts an *absence*. Scoring absences 0..1 invites
partial credit where none exists — a probe that mostly held is a probe that
failed. Eight vectors, four entry points, six safety assertions, all closed sets.
`InjectionGate.waivable: false` in every environment, because the graph that
fails in a sandbox is the graph that promotes to production.

A live failure returns `compliance_violation`, deliberately bypassing
`canTriggerRollback()` — that rule governs *scorers*, and exists so component
quality drift cannot revert a rollout. A safety regression is not quality drift.

### 14.7 Measured autonomy

`AutonomyConfig` asked a human to pick a severity ceiling once, at onboarding,
and it was never right again.

**The four dials are not the same kind of thing**, which is why this is a loop
rather than a form:

| Dial | Kind |
|---|---|
| Reversibility | **Declared** on `Disposition`. Unmeasurable by nature |
| Blast radius | **Observed** — value at risk over the window |
| Frequency | **Observed** — exception count over the window |
| Verifiability | **Inferred** — reversal rate, evidence rate, median decision time |

`Reversibility` has three levels, not two: *post a credit note* and *amend a
filed return* are both irreversible in a boolean and are not the same bet.

In `AutonomyDials`, **fast decisions are a warning rather than a reassurance**. A
median of four seconds across a queue means nobody opened the evidence — the
green-checkmark failure, made measurable.

`recommendAutonomyCeiling()` has one property that matters more than its
thresholds: **narrowing is easier than widening.** Evidence of harm narrows on a
thin sample; evidence of safety widens only on a thick one. A symmetric rule
would let a quiet fortnight argue for more autonomy, and absence of observed harm
is not evidence of safety at small *n*. An irreversible disposition returns
`none` unconditionally, before any other check.

The output is a **recommendation, never an applied change**. A system that
silently widens its own autonomy is the failure this layer exists to prevent, and
measurement would only be its disguise.

`AutonomyDecision.decidedBy` is a **tenant** user. Risk appetite belongs to the
party that answers for an auto-resolved exception — a controller, never a
delivery engineer. An FDE may propose the initial setting; only a tenant role may
own it thereafter. That is a correction to the delivery journey as much as to the
model.

### 14.8 Resolution and reversal on `Exception`

Two gaps that turned out to be one.

**Accountability.** An exception resolved autonomously has no `ApprovalDecision`,
so nothing carried a human name and the chain terminated at the agent.
`ExceptionResolution` records the mode and, when autonomous, the **policy and
version that authorised it** — moving the chain to whoever authored that policy.

**Measurement.** `AutonomyDials.reversalRate` was inert because nothing marked
that an auto-resolved exception had been undone. `ExceptionReversal` supplies it,
always signed by a human.

The distinction inside `ReversalReason` is load-bearing. **Not every reversal
indicts the autonomy**: a disposition undone because the source data was later
corrected, or because the rule should never have fired, was the right judgement
on what was known. Counting those would narrow autonomy for reasons unrelated to
the agent's judgement, and the loop would strangle itself on its own data
corrections while producing a chart that looked like evidence.
`reversalIndictsAutonomy()` is a function rather than a comment because every
call site computing a rate has to agree.

Reversals are an array — an exception can be resolved, reversed, re-resolved and
reversed again, and a disposition needing two goes is a signal in itself.

### 14.9 Tagging — governance and chargeback (4 Aug, recorded late)

`CostAttribution` could already report by cost centre and `Budget` could be
scoped to one. Nothing said where a cost centre *came from*.

`TagPolicy` declares per-tenant keys, closed vocabularies, required-ness,
permitted origins **in precedence order**, and which single key drives chargeback.
`Tags` sit on `ReconciliationDefinition` and `SourceDocument` — the two origins —
and resolve to `UsageRecord.costCenter`, frozen at period close.

**And, since 7 Aug 2026, a second named key: `legalEntityKey`.** It is separate
from `chargebackKey` deliberately, and reusing the one key for both is the error
worth naming. They answer different questions — *who pays for this* and *whose
books this belongs to* — and they diverge in exactly the cases that matter: one
legal entity routinely charges several cost centres, and a shared-services cost
centre routinely spans several legal entities. Collapsing them makes a statutory
boundary follow an internal accounting convention that finance may re-cut at any
time, with nobody reviewing it as an access change. The two keys resolve onto
`Exception.costCentre` and `Exception.legalEntity`, which is what makes
`AssignmentScope`'s last two dimensions bind on anything at all (§16, open item 2).

**Free-form tags do not roll up.** One typo becomes a new cost centre, and a
chargeback report nobody trusts is worse than none.

`DataPlane.infrastructureTags` covers the AWS side, where in BYOA the customer's
own mandatory tag policy applies and an untagged stack simply will not deploy.


### 14.10 Contacts, and the evaluation posture — 5 Aug, second pass

**`TenantContact`** closes the last structural assumption in the operations
story. Liveness escalation, support-grant approval and four onboarding steps all
assumed a reachable counterpart; no type held one.

The split that keeps it small: only support-grant approval is an *authenticated*
act, and that stays a `Membership` with a role — exactly as
`AutonomyDecision.decidedBy` is a `UserId`. Everything else is **reach**, and
forcing the engineer who performs one key exchange into a membership is friction
at the worst possible moment.

Contacts name a **duty**, not a person, because people leave and a named
individual who has left makes escalation fail silently at three in the morning.
The current holder is recorded when known so there is someone to hold to a
response time, but the duty survives them. Ordered within a duty, because a plane
dark for three days needs somewhere to go after the primary. Same shape as
`CounterpartyEndpoint` — classified, verified, outside the request path — and
deliberately not the same type.

An unverified address blocks **outbound notification to it and nothing else**. A
lapsed verification must never stop us reaching a customer during an incident,
which is the moment they most want us to.

**`TenantEnvironment` gains `evaluation`.** See `docs/data-governance.md` §2.1.
Behaves as production for every invariant, and adds a processing-agreement
reference that gates non-synthetic ingest, a purge date agreed up front, and no
entitlement lease.

`bindingFor()` exists because adding the third value left every pack with no
binding for it — a hole that typechecks perfectly and misbehaves at runtime. It
falls back to the **production** binding, never the sandbox one.


---

## 15. Stakeholders, capabilities and scope — 5 Aug 2026

`RoleKey` was five members and two jobs. It described **a stakeholder's
relationship to the work** and **a capability in the system** at the same time,
so it did neither: a KYC reviewer and an accounts-payable approver were both
`approver`, and a pack could not express what it actually needed. Worse, the
stakeholders every real deployment has — a sponsor kept in the loop, a security
officer who must see the audit trail, an infrastructure team that owns the AWS
account — fitted none of the five, because none of them is an operating role.

`model/access.ts` replaces it with four layers, each a closed set defined by the
one above. Same discipline as archetype → domain → pack → tenant, and for the
same reason.

### 15.1 Stakeholder class — relationship, never permission

> **Renamed 5 Aug by `docs/access-and-agency.md` §8.1** to
> `author · administrator · user · sponsor · assurance`, after testing the set
> against ITIL 4, COBIT 2019, TOGAF, NIST SP 800-37r2 and the IIA Three Lines
> Model. `maintainer` scored zero across all five; `operator` was rejected
> outright. **Recorded and unresolved:** ITIL nests `sponsor` *inside*
> service-consumer alongside `user`, so the set may still be mis-factored.
> **And a third axis was added** — `OrgClass` (platform · partner · customer),
> which is what the old `RoleKey` enum's `partner_admin` member really was.

`creator` · `maintainer` · `consumer` · `sponsor` · `oversight` *(pre-rename)*

Deliberately not a permission. Two people in one class may hold entirely
different capabilities.

**A role carrying zero capabilities is legitimate**, and the `sponsor` class is
why. A CFO who owns the close and never opens an exception needs to be kept in
the loop, not granted access — so a sponsor role resolves to a notification
binding. That is `TenantContact`'s shape attached to *the work* rather than to
the tenant, which is the distinction contacts alone could not make.

`oversight` exists for the secondary stakeholders. They are frequently not
finance people at all, and putting a customer's security officer in the same
class as the engineer who tunes tolerances would have said they want the same
things from the system.

### 15.2 Capability — the closed set policy gates on

> ⚠️ **Thirty-four, and each now names a resource class.** See §16.2. The count
> below was accurate when written.

Roughly thirty atomic verbs. Adding one is a platform release, exactly as adding
a predicate or a procedure step kind is. `admit_correspondence` is deliberately
its own capability: it is the prompt-injection checkpoint and should never be
implied by a broader operating permission.

### 15.3 Role — composed by a pack or a tenant, never invented

A pack ships the roles its use case needs; a tenant may compose additional ones
from the same closed set to match an org chart the pack did not predict.
**Neither can introduce a capability**, which is what stops role authoring
becoming a second, unreviewable authorisation system beside the policy engine.

### 15.4 Scope — five fixed dimensions

> ⚠️ **Six since 5 Aug evening**, with `solutionIds` (`model/access.ts:553`).
> ~~⚠️ **And two of the six bind on nothing** — `Exception` carries neither a cost
> centre nor a legal entity, so that narrowing typechecks and does not narrow.~~
> **✅ 7 Aug 2026: all six now bind on something.** `Exception.costCentre` and
> `Exception.legalEntity` exist, resolved from `TagPolicy.chargebackKey` and the
> new `TagPolicy.legalEntityKey`. ⚠️ **Binding on something is not being
> enforced** — nothing reads either column yet.
> Both are §16.5.

`domains` · `definitionIds` · **`solutionIds`** · `costCentres` ·
`legalEntities` · `valueCeiling`

Not arbitrary key/value. Without scope, every distinction becomes another role —
*AP Approver SG*, *AP Approver MY* — and role counts grow multiplicatively with
the org. With arbitrary attributes we would have built a second policy engine
with its own evaluation order and its own ways of being wrong.

Dimensions conjoin and never disjoin: a scope that widens by adding a clause is
a scope nobody can read.

### 15.5 What this improves, not merely relocates

**`ProcedureStep.human.role: RoleKey` asked for the wrong thing.** It said "an
approver". What it meant is *"someone who may approve, on this domain, above
this amount"* — expressible as a `CapabilityRequirement` and not expressible as
a role name. A pack whose customer names the role differently still satisfies the
step.

**The partner clamp becomes a capability mask.** `effectivePartnerRole()`
clamped one enum value to another, which only worked because the five roles were
totally ordered — and they stop being ordered the moment a pack ships *KYC
Reviewer* and *Warehouse Supervisor* side by side. A mask intersects, so it
composes with any role a pack invents. The invariant is unchanged and is the one
that matters: a partner may operate on a customer's exceptions and may never be
the approving authority for them.

**`distinctHolders` states what four-eyes always meant.** Two signatures means
two names, and saying so in the requirement is what stops the second being the
first person signing twice.

### 15.6 ~~Outstanding — the fifteen references~~ **DONE, 7 Aug 2026**

> ~~`ROLE_KEYS` is retained as the seeded platform role set and the fourteen
> `RoleKey` references are **not yet migrated**. They are, by file:~~
>
> - ~~`model/policy.ts` — `ApprovalConfig.approverRoles`, `CorrespondenceConfig.minimumRoleToAdmit`, the role ladder inside `mayAdmit()`~~
> - ~~`model/governance.ts` — `effectivePartnerRole()`, `roleCeilingForScope()`~~
> - ~~`model/domain.ts` — `Membership.role`, `ProcedureStep.human.role`, `Procedure.defaultEscalationRole`~~
>
> ~~Deliberately left as one deliberate change rather than done blind across three
> modules and four contract files today. Recorded here so the two systems do not
> quietly diverge — which is precisely what happened to `ErrorCode` earlier the
> same afternoon, and was caught only by a mechanical check.~~

**`ROLE_KEYS` and `RoleKey` are DELETED.** The tombstone carrying the full
reasoning is in `model/domain.ts`, immediately after `DOMAIN_KEYS`. This is the
only type deleted in the v1 pass; everything else out of scope was marked
`@dropped-for-v1` and left standing.

**THE RECORDED LIST WAS STALE AND THE COUNT WAS WRONG.** It said fifteen, then
fourteen, and it named holders in `policy.ts` and `governance.ts` that had
already gone. Derived rather than trusted, on 7 Aug, the live set was **six
sites, of which two were schema declarations** — one in `model/`, five across two
contract files:

| # | Site | Migrated to | Why that target |
|---|---|---|---|
| 1 | `model/domain.ts` — `Membership.role` | `roleId: RoleId` | A membership names *which role*, so a namespaced address is the right shape. **Retyped in place and renamed**; see the caveat below |
| 2 | `foundation.openapi.yaml` — `resolveMembership.role` | `roleId: string` | Mirrors 1. Opaque, not enumerated — composed roles are per tenant and per pack |
| 3 | `foundation.openapi.yaml` — the `RoleKey` schema | **deleted**, tombstoned in a comment | — |
| 4 | `capability.openapi.yaml` — `NodeAwaitingHuman.role` | `requires: CapabilityRequirement` | The step asks *what must be held*, not *who*. Mirrors `ProcedureStep.human.requires`, migrated 5 Aug. A new local `CapabilityRequirement` schema came with it |
| 5 | `capability.openapi.yaml` — `decidableBy.minimumRoleToAdmit` | `capabilityToAdmit: string` | The admission gate asks for `'admit_correspondence'`. Mirrors `CorrespondenceConfig.capabilityToAdmit`, migrated 5 Aug |
| 6 | `capability.openapi.yaml` — the `RoleKey` schema | **deleted**, tombstoned in a comment | — |

Nine further model-side references had already migrated and were recorded as
outstanding for two days: `ApprovalConfig.approverRoles` → `approvers`,
`CorrespondenceConfig.minimumRoleToAdmit` → `capabilityToAdmit` +
`orgClassesThatMayAdmit`, `mayAdmit()`'s ladder → gone with it,
`ProcedureStep.human.role` → `requires`, `Procedure.defaultEscalationRole` →
`defaultEscalationCapability`, and `effectivePartnerRole()` /
`roleCeilingForScope()` **removed rather than migrated** (governance.ts §2 — two
live defects, and neither survived a rewrite).

**What the deletion bought, verified rather than asserted.** `RoleId` is
`Id<'Role'>`, a branded type; `'approver'` is not assignable to it, checked by a
red run. So the risk the whole migration existed to close — a bare key satisfied
by *any* pack's role keyed `approver`, one string comparison from a KYC reviewer
approving an AP write-off — is no longer expressible, on the wire or in the
model. And `+1 typed edge` in `tools/planner/extract.mjs` (233 → 234) is the
independent evidence that the reference is now a real, resolving one.

**⚠️ TWO THINGS THIS DID NOT CLOSE, both live.**

1. **`Membership.roleId` was retyped in place, which `domain.ts` had argued
   against.** Its comment said the field "goes when `Membership` gives way to
   the assignment model in access.ts rather than by being retyped in place".
   Deleting the *field* is a different decision from deleting the *enum*, and
   only the second was in scope, so the field survives as a pointer. Two rows
   now name a role for a user and **only `RoleAssignment` is the authority
   record** — it pins `roleVersion` and carries an `AssignmentScope`; the
   membership row carries neither. A resolver reading `Membership.roleId`
   silently discards both. Retiring `Membership` is the fix and is its own
   decision.
2. **Key collision across packs is unenforced.** Role identity is
   `(packId, key)`, and nothing in `model/` can constrain uniqueness. The first
   migration must, and `packId` is nullable for platform- and tenant-origin
   roles, so the constraint has to treat null as a distinct namespace rather
   than as a wildcard.

---

## 16. The resource axis — 5 Aug 2026, evening

> Full argument in `docs/access-and-agency.md` §11. This section records what
> changed in the **entity model** and what it corrects in §14 and §15.
>
> **Two new modules:** `model/agents.ts` and `model/presentation.ts`. Thirteen in
> total.

### 16.1 What the axis is, and why three of §15's four layers lacked it

§15 gave the model four layers — stakeholder class, capability, role, assignment
— and §8 of `docs/access-and-agency.md` added the organisation axis crossing all
four. A fifth term was present in exactly one place and missing everywhere else:
**which class of thing is being acted on**.

`TenantAccessGrant.resources` had it, because a support grant has to be able to
say *"configuration, and provably not the customer's rows"*. A `RoleAssignment`
had nothing, and neither did a `PartnerAccessGrant`. So the delivery grant's
safety property and the role handed to the same person **had no vocabulary in
common**, and nothing could tell that `manage_roles` sat outside *"no tenant
data"*.

The join is one table with no logic in it — `CAPABILITY_RESOURCE_CLASS`
(`model/access.ts:517`), keyed `Record<Capability, AccessResourceClass>` so an
unclassified capability is a **compile error** rather than a capability that
reaches everything or nothing depending on which lookup ran first.

### 16.2 Thirteen classes; forty-four capabilities — sixteen and fifty since R10, 1 Oct 2026

> ⚠️ **SIXTEEN CLASSES AND FIFTY CAPABILITIES SINCE 1 Oct 2026 — R10, THE
> OWNER'S.** `deal`, `sandbox` and `partner_staff` carry six verbs answered on
> `decide()`'s fifth arm alone (`model/access.ts` §6c). The heading is kept as
> the section's name; the counts below it are history.

> ⚠️ **THIS HEADING SAID *thirty-nine* UNTIL 19 Sep 2026 — G601.** The five
> added are `view_substrate`, `provision_substrate`, `view_catalogue`,
> `author_catalogue` and `publish_catalogue`, and they are the first
> capabilities in this model that **no tenant principal may hold at all**:
> `PLATFORM_ONLY_RESOURCE_CLASSES` names their two classes and `decide()`
> refuses them on the customer and partner arms before any role is read.
> **Two of the four empty classes below are therefore no longer empty** —
> `substrate` and `catalogue` — and the two that remain, `schedule` and
> `telemetry`, are the two this document records as GAPS rather than as
> statements, which is why G601 left them alone. Derive the count; do not read
> the heading.

> **THIRTY-SIX FROM 7 Aug 2026.** `view_metering` (35) and `view_commercial`
> (36) were minted against the two classes named as gaps below, taking the
> classes with a capability from seven to nine of thirteen.
> `docs/access-and-agency.md` §11.9a carries the argument for each, and for the
> four that were deliberately left empty.

`ACCESS_RESOURCE_CLASSES` (`model/governance.ts:141`) went from four to
thirteen. Each member had to carry **a rule true of it and false of its nearest
neighbour**, because a taxonomy built on resemblance drifts and the drift cannot
be falsified. The classes and their rules are tabulated in
`docs/access-and-agency.md` §11.2; the two sharpest are worth repeating here
because they are the test working:

- **`secret` has no read mode.** No field in this model may hold key material,
  so the reference *is* the resource, and reading a reference is not a thing
  anyone needs to do.
- **`metering` has no write mode**, and cannot be folded into `commercial`
  because `commercial`'s defining rule is *a partner may read it* — and a raw
  `UsageRecord` is volume in the clear, the exact quantity the partner-visibility
  argument protects.

`CAPABILITIES` went from thirty to thirty-four: `view_summary` (31),
`configure_identity` (32), `bind_secret` (33), `enable_endpoint_writeback` (34)
— and to thirty-six on 7 Aug with `view_metering` (35) and `view_commercial`
(36).
`configure_connection` became `configure_endpoint`. **33 closed a live hole** —
`configure_connection` mapped to `configuration`, and a delivery grant reaches
`configuration`, so a ninety-day delivery grant could bind the customer's ERP
credentials.

**`sample_data` was removed and is not a loss.** It was `tenant_data` under a
different *selector*, proved by the single special-case `if` `grantAllows()`
carried for it, and it mixed *what kind of thing* with *how much of it* — the
`RoleKey` failure at smaller scale. `REQUIRES_ENUMERATION`
(`model/governance.ts:354`) replaces it and the safety property **strengthens**:
delivery cannot reach tenant data it has not been handed, instance by instance,
by the customer.

### 16.3 Three entities the axis made necessary

**`Endpoint`** (`model/domain.ts:519`) — one registry replacing four unrelated
destination lists (`DataEgressConfig.allowedDestinations`,
`CounterpartyEndpoint`, `TenantContact.address`, `TelemetryExport.endpoint`), so
the same verification rule stops being enforced twice and unenforced twice.
**Direction is a flag, not a class**: a mailbox you send to and a mailbox you
poll are the same mailbox. What differs is the gate — inbound is a trust
boundary needing admission, outbound a disclosure surface needing a
classification ceiling and a residency check. Three separations are structural:
the address is `configure_endpoint`, the credential is `bind_secret`, write-back
is `enable_endpoint_writeback` and therefore `authority`.

> 🛑 **THREE SEPARATIONS, AND A FOURTH THAT IS MISSING — ADDED 14 Aug 2026, G203.
> The sentence above is correct and incomplete, and the omission is the one that
> matters now that connections are customer-facing.** The three separations are
> all **write** verbs. **There is no read verb for an endpoint at all**:
> `configure_endpoint` is the only capability that names one, so **reading an
> endpoint means holding the capability that configures it** — read implied by
> write, §5.6's shape, on the object that reaches a `credentialRef`. It was a
> tidy recommendation while G59 kept this surface FDE-only; **G203 reopens G59 and
> makes it a blocker.** There is no `view_endpoint` and G203 does not mint one —
> minting a capability is a platform release, and `CAPABILITY_RESOURCE_CLASS` is a
> `Record<Capability, …>`, so the compiler forces the classification the moment
> anyone does.
>
> ⚠️ **And this paragraph's *"residency check"* is not a check over one
> vocabulary. G207 gives `Endpoint` a `region` typed `ForeignRegion`, NOT
> `RegionKey`** — `RegionKey` enumerates *our deployment regions*, and a
> customer's SAP in Frankfurt is not one of them. **The check compares across the
> two enums deliberately, so the crossing is visible in the type** rather than
> hidden by a shared one. The trap it avoids is in this record already: the
> `bi_dataset` variant of `SubjectLocation` carried `region: RegionKey` naming
> Sydney while `RegionKey` did not admit Sydney, and `tsc` stayed green **because
> nothing constructed the type**. ⚠️ **Nothing constructs an `Endpoint` either** —
> `grep -rn ': Endpoint\b' model/ tests/` returns one line and it is a type-map
> entry — **so the fixture obligation lands with the field, in the same commit.**

**`Solution`** (`model/domain.ts:1860`) — the third level of a hierarchy that had
only two. `SolutionPack` is the catalogue entry, `InstalledPack` is the minting
record, and **what is actually running had no object at all**: nothing to
disable, nothing to hand a partner, nothing to scope an assignment to, nothing
for a rollback to name. It holds references and never embeds, so the assembly
cannot become a stale copy of its own parts. `InstalledPack.mintedSolutionId`
(`model/domain.ts:1822`) closes two of four rollback blind spots transitively —
agents and dashboards hang off the solution. The other two, endpoints and
secrets, are **not** blind spots and must never be filled: an automated
reversion firing at 04:00 must not un-bind the customer's connection to their own
ERP.

**`AuthorizationGrant`** (`model/access.ts:1361`) — see §16.4.

### 16.4 The spine, and tamper evidence

`authorize()` (`model/access.ts:1461`) mints; `redeemAuthorization()`
(`model/access.ts:1555`) re-derives on presentation. `authorizationId` now sits
on `AuditEvent` (`model/domain.ts:2665`), `DataAccessEvent`
(`model/governance.ts:964`) and `UsageRecord` (`model/billing.ts:189`).

Those were **three streams with no shared key, and the middle one was not stored
at all** — `Decision` was computed and discarded. *"Who read this, under what
authority, and what did the inference cost"* was three queries that could not be
combined; on the read stream, the authorisation that permitted a
`sensitive_personal` read was thrown away entirely.

On `UsageRecord` it is a **join key and never a `UserId`**, and that is a
constraint rather than a preference: `UsageRecord` is the one record class that
ships to the control plane, and it ships safely because it is PII-free by
construction. A principal identifier there would cross the plane boundary on
every metered event and break invariant 3. An `AuthorizationGrantId` is an opaque
scalar that identifies nobody; the row it points at stays in the data plane.

**`RecordChain` and `ChainAnchor`** (`model/governance.ts:906`, `:934`) put the
audit and data-access streams on the same footing metering already had.
`UsageRecord.sequence` was monotonic and `UsageAttestation` was hash-chained and
signed, both because a customer-owned plane could under-report — while the record
of **who touched a data subject's data**, in the same database under the same
root, carried no sequence, no hash and no signature. `ChainAnchor` ships the head
hash only: a scalar with no subject, no actor, no action and no field value, so
it crosses the plane boundary without carrying tenant data.

> ⚠️ **No canonicalisation scheme exists** for any hash in this repository.
> `UsageAttestation.bodyHash` says *"canonical body"* and nothing defines
> canonical (`model/governance.ts:899`). Pick one before the first hash is
> computed.

### 16.5 What this corrects in §14 and §15, and what it leaves open

| Claim | Where | Status |
|---|---|---|
| `sample_data` is a resource class | §14.2 | **Reversed.** It was a selector, not a class — §16.2 |
| Roughly thirty capabilities | §15.2 | **Thirty-four** — **thirty-six** from 7 Aug 2026 |
| Scope is five fixed dimensions | §15.4 | **Six**, with `solutionIds` |
| Four resource classes | §14.2 | **Thirteen** |

Three things are recorded as **open**, and none is a bug to be swept:

1. ~~**Six of thirteen classes have no capability pointing at them**~~ —
   **partly settled 7 Aug 2026; two of six remain.** The original entry:
   `telemetry`, `substrate`, `commercial`, `catalogue`, `schedule`, `metering`.
   `Budget`, `Invoice`, `RateCard` and `UsageRecord` all exist in `billing.ts`
   and **no verb reaches any of them, so a tenant admin cannot see what they
   owe.** `catalogue` proves an empty class can legitimately be a *statement*
   (authoring is a platform act, not a tenant capability), so the question is
   gap-or-statement per class rather than five capabilities to add. `telemetry`
   is the live inconsistency: a grant reaches it and `authorize()` never can.

   **The verdict, per class.** `metering` and `commercial` were **gaps** and are
   closed by `view_metering` (35) and `view_commercial` (36) — the commercial
   consequence quoted above is answered, and the meter, which renders in the
   chrome of every screen, is no longer the most frequent read in the product
   that no capability permits. `substrate` joins `catalogue` as a **statement**:
   a platform release reaches it and a grant does not, and a capability is the
   currency of grants. `schedule` and `telemetry` **stay open**, for different
   reasons — `schedule` because an armed schedule must pin a scope where every
   other capability resolves one, so the undecided part is the scope semantics
   rather than the verb's name; `telemetry` because reading a trace may
   legitimately be grant-gated rather than capability-gated, which is a genuinely
   different question. `docs/access-and-agency.md` §11.9a.
2. ~~**Two of six scope dimensions bind on nothing.**~~ **Applied 7 Aug 2026.**
   `Exception` carries `domain`, `definitionId` and `valueAtRisk` —
   so three dimensions bind, and `solutionIds` binds transitively through
   `Solution.definitionIds`. It carried **no cost centre and no legal entity**,
   and neither field existed on any entity in the model. A role scoped to two cost
   centres was unscoped on the exception queue, and the narrowing typechecked,
   read correctly in an access review and did nothing. `TagPolicy`
   already declared the vocabulary; what was missing was
   the projection of a resolved tag onto `Exception` — the same denormalisation
   `domain`, `definitionId` and `severityRank` already received, for the same
   surface and the same reason. That projection now exists:
   `TagPolicy.legalEntityKey`, `Exception.costCentre`, `Exception.legalEntity`.
   Taken before the queue existed, because afterwards it is a backfill whose
   values must be reconstructed from a policy that may have changed.
   ⚠️ **Representable is not enforced.** Nothing reads either column, the
   at-raise-time resolver is unwritten, and the rule that a null value must not
   satisfy a narrowing is carried by SQL's `NULL IN (…)` semantics rather than by
   any function in the model. `docs/access-and-agency.md` §11.10.
3. **One capability does install, upgrade and disable.**
   `SOLUTION_CONTAINER_CAPABILITY` (`model/access.ts:2008`) maps all three to
   `install_pack`, so switching off a live reconciliation costs what installing
   one costs. Left as one verb deliberately, and recorded so that whoever makes
   the argument properly finds the table rather than three call sites.

`docs/access-and-agency.md` §11.11 carries three more: the missing
canonicalisation scheme, three model identities that still skip `resolveModel()`,
and the absence of an `author_harness` verb.

---

## 17. The operator-initiated proposal — 7 Aug 2026

Decisions **G42**, **G43** and **G44**. `model/domain.ts`, four new exports plus
three ids in `model/kernel.ts`.

### 17.1 The shape the model could not express

An operator asks the assistant whether it is safe to post a production order.
The agent reads the ERP **live, over the same connection that would write
back**, and proposes a transaction. If there is not enough stock it proposes
something different — a **partial** production order, and **separately** a
procurement order for the raw material.

Nothing about this is a reconciliation exception. Nothing broke. Nobody is
disputing a number. And the model had no shape for it, because
`ResolutionProposal.exceptionId` is required and non-nullable: **every** proposal
in the model hangs off an exception, and an operator's question mints none.

The *trigger* was never the gap. `RunTrigger` has carried
`{ kind: 'manual', byUserId }` from the beginning. It was the **outcome** shape
that did not exist — which is G42's observation, and the reason the fix is one
new record rather than a new pathway.

### 17.2 G44 — the boundary is structural, not a convention

The obvious fix is to make `exceptionId` nullable. It was refused, and the
argument is the one this repository keeps rediscovering:

> A nullable field puts the boundary in a **convention**. Every reader has to
> remember which shape it is holding, every writer can set the field on either,
> and the distinction erodes in the direction it always erodes — *towards the
> older type*, because that is the one the queue, the approval config and the
> disposition vocabulary already understand.

So:

**`OperatorProposal` carries no `exceptionId` field at all. Not nullable — absent.**

Three consequences, each mechanical rather than cultural:

1. **Which type you are holding is answered by the type system.** Attaching an
   operator proposal to an exception is a compile error.
2. **The brands differ.** `OperatorProposalId = Id<'OperatorProposal'>` against
   `ProposalId = Id<'ResolutionProposal'>`, so the two cannot be interchanged
   even by id. Verified red: `TS2322 … Type '"OperatorProposal"' is not
   assignable to type '"ResolutionProposal"'`.
3. **The absence is asserted, not merely present.**
   `_OperatorProposalIsNotExceptionAnchored` maps `exceptionId` to `never`, so
   *adding* the field later is a compile error rather than a quiet widening. It
   is mapped rather than conditional because the conditional form is
   `TS2313: circular constraint` — the same trap `identity.ts` records on
   `AssertBranded`.

**The stated rule for which type applies** — G42 owes one, or this is
`HANDOFF` §5.3 for the fifth time:

> **Does an `Exception` exist to anchor it?**
> **yes** → `ResolutionProposal`. It disposes of something that broke, from the
> pack's disposition list, inside a family the archetype allows.
> **no** → `OperatorProposal`. It proposes a write into a foreign system in
> answer to a question a person asked.

That is a fact about the world at the moment of proposing, not a judgement about
intent, which is why it survives contact with a queue.

`ApprovalDecision` could not be reused for the same reason: it carries a
required `exceptionId`, so reusing it would put an exception back into this path
through the decision record having kept it out of the proposal. The boundary has
to hold on both halves or it holds on neither — hence
`OperatorProposalDecision`.

### 17.3 The ERP read — one path, reused, and one product claim

`EndpointReading` records one live read. **`endpoint_read` was reused, not
reinvented**: it already exists in the closed tool vocabulary with
`TOOL_EFFECT.endpoint_read = 'reach_endpoint'` and
`TOOL_CAPABILITY.endpoint_read = 'view_document'`, and a second
reaching-a-foreign-system tool would fork `validateAgentToolBindings()`,
`derivedGrantFor()` and the trifecta rule, each of which is total over `ToolKey`
and would then be total over the wrong set. The field is typed as the **literal**
`typeof TOOL_KEYS.endpointRead` rather than as `ToolKey`, so a second read path
is a compile error.

**The product claim lives in two fields.** `readAt` plus `endpointId` are what
carry *"read live, over the connection that will post"*, and nothing else in the
model evaluates a foreign-system read as a gate on a decision.

**There is no `PostingPrecondition` type and none should be created.** G40
proposed one; **G42 superseded it**. The screen's own binding is generic —
`{{ k.label }} {{ k.value }}`, captioned *"read from SAP · 4s ago"* — and the
panel's contents are sample data: inventory today, shipment status next time. A
typed precondition would have fixed a vocabulary the product does not have.

### 17.4 What the invariants get, and where they stop

| Invariant | What it gets | Where it stops |
|---|---|---|
| **10** — an act with no authorisation is unrecordable | `EndpointReading.authorizationId` (the **read**) and `OperatorProposalDecision.authorizationId` (the **write**). Both **non-nullable** — unlike `AuditEvent.authorizationId`, which admits null for three shapes of which the only actor kind is `system`. Reaching a customer's ERP on a credential is never a system act with nobody behind it. ⚠️ **AMENDED 13 Aug 2026 — G202. The sentence is still true and a reader was drawing a stronger conclusion from it than it supports.** G74 read it as forbidding every unattended read, which made `connector_pull` and `watched_drop` — two of G184's four intake channels, both of which name an `Endpoint` and therefore reach a `credentialRef` — unimplementable. **G202 mints a standing authorisation for scheduled reads, taken when the connection is configured and expiring with it, so the pull carries an `authorizationId` and is attributable to the person who configured it.** *"Never a system act with nobody behind it"* is exactly what that preserves. 🛑 **And the shape does not fit `AuthorizationGrant` as declared** — `subjectUserId` is required and `MAX_AUTHORIZATION_SECONDS.endpoint` is fifteen minutes — **which is recorded on G202 and is not settled** | Nothing calls `authorize()` on this path because there is no path — see §17.6 |
| **6** — ingested content is data, never instruction | The untrusted-ness of `label` and `value` is stated at the type, with the reason | **Unenforced, and three reasons are named at the declaration rather than assumed.** R5 is open by record: *connector payloads are untrusted too; the trifecta rule is scoped to counterparty replies only*. `TOOL_ADMITS_UNTRUSTED_TEXT` **does not exist** — G9 decided the rewrite and it is not applied. And concretely, `validateAgentToolBindings()` tests `b.tool === TOOL_KEYS.readCorrespondenceThread` to decide whether an agent reads untrusted text, so **an agent bound to `endpoint_read` + `send_correspondence` passes the trifecta check today** — §5.1's landmark defect, exactly |
| **1** — tenant scope from the session | All three records extend `TenantScoped` | — |

### 17.5 Two things recorded rather than solved, by decision

**The structuring bypass (G43).** A post above a ceiling **splits into two below
it and both pass**. `AutonomyConfig.autoResolveValueCeiling` (`policy.ts:137`)
and `AssignmentScope.valueCeiling` (`access.ts:673`) are each a single amount
compared against a single proposal, both written when a proposal carried one
adjustment against one exception. Neither has an operand for a total, and
**there is no object in the model representing "the *n* proposals emitted from
one ask"**, so there is nothing for a total to be computed over. Recorded at
`ProposedTransaction.value`.

> A shared **correlation id** across proposals from one ask is the recommended
> mitigation and **is not taken**. It would make the split *visible* to an
> approver and an auditor without blocking it — the argument invariant 10 makes
> for itself, that detectable beats impossible. It remains open.

> ⚠️ **And the two ceilings do not share a type.** `AssignmentScope.valueCeiling`
> is `Money`; `AutonomyConfig.autoResolveValueCeiling` is `MoneyAmount`, a
> different interface in a different module. Any check wanting both must convert,
> and no function in the model does. Pre-existing; surfaced here because this is
> the first field that must be compared against both.

**Partial acceptance (G43).** The partial production order is accepted, the
procurement order is not, and the business is left **committed to build with no
material inbound — a state nobody chose**. Neither half is wrong on its own,
which is why no per-proposal check can catch it. Preventing it means either a
composite proposal (refused by G43) or a dependency edge between proposals,
which is a plan object and a second execution order beside the procedure graph.
Recorded on `OperatorProposalDecision`.

### 17.6 What is deliberately absent

- **No execution record and no payload.** `decision: 'accepted'` means the write
  is *authorised*, not that it *happened*. The field set the connector would send
  is not modelled, because `model/connections.ts` is unwritten and delta 22
  (*credentials referenced, never held*) constrains its shape — fixing a payload
  shape now is fixing the wrong shape at the cheapest possible moment to get it
  right.
  > ⚠️ **A SECOND CONSTRAINT ON THAT FILE'S SHAPE LANDED 14 Aug 2026 — G204, and
  > it is not about the payload but about the CONFIGURATION.** A connector
  > declares its options freely, and **any option whose value can move a security
  > answer carries a KIND from a closed, platform-owned vocabulary**. Default-deny
  > is the load-bearing half: **every parameter carries a kind, `descriptive` is
  > an explicit kind, and an untagged parameter is a LOAD FAILURE** — fail-closed,
  > matching `DENY_ALL` and G106's unmapped-key rule. 🛑 **A denylist of dangerous
  > parameter NAMES was explicitly refused** as §5.1 — a rule keyed on a landmark
  > a foreign vendor chose. ⚠️ **The ruling assumes platform-authored connectors
  > only**; if partner authoring ever lands, that is the first assumption to
  > revisit, because an untrusted author choosing their own kinds turns
  > default-deny into self-certification.
- **No autonomous execution.** `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE =
  false`, literal, in the style of `AGENTS_HOLD_ROLES` and
  `SOLUTION_IS_GRANTABLE`, so changing it is a reviewed diff. The reason is not
  caution: `AutonomyConfig` gates on `Disposition.reversibility`, **declared** by
  a pack author because whether posting a production order can be undone is a
  fact about the customer's process and the world. `ProposedTransaction.actionKey`
  has **no pack-side declaration**, so there is no declared reversibility and
  nothing for the dials to apply to.
- **No contract operation.** Nothing in `docs/contracts/` can create, read or
  decide one of these. It joins the `types_without_operations` gap and is part of
  the missing administration and runtime surface, not a separate omission.

### 17.7 The two authorising projections, present from day one

`OperatorProposal` carries `costCentre` and `legalEntity`.

This is E2 applied *before* the defect rather than after it. `Exception` gained
those two columns on 7 Aug having been without them since the model began, and
the finding was that `AssignmentScope.costCentres` and `.legalEntities` narrowed
an assignment, typechecked, rendered in an admin UI, read correctly in an access
review — **and matched every row**, because no exception carried either
attribute. `OperatorProposal` is a **new anchor for the same six-dimension
scope**, and a new one authorising a write into the customer's ledger. Omitting
them would have recreated the defect on the worst possible type.

Every rule from `Exception.costCentre` applies unchanged: bare `string` because
the dimension is opaque customer text; resolved at write time from the tenant's
`TagPolicy`; British spelling because the join is an authorisation decision; and
⚠️ **null must never satisfy a `these` narrowing**. The same limit applies too —
**representable, not enforced**: the at-write resolver does not exist for
`Exception` and does not exist here.

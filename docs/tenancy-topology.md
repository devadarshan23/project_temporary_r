# Tenancy Topology — Accounts, Demo, Identity and the Agent Layer

> **STATUS:** PARTIALLY APPLIED
> **V1 AUTHORITY:** PARTIAL — its demo-placement conclusion stands; **its "specified, deferred" list is wrong in three places and reads as an instruction.**
> **Applied since it was written, and not marked here:** `Account` **is** in `model/domain.ts` — the header note below saying it is *"specified here but not yet applied"* is false, as is the matching §5 row; and `model/agents.ts` **is written**. **Deleted, not deferred:** `User.identityProvider` and `User.isStaff` were removed on 5 Aug and the tombstones are in `model/domain.ts` — §5 still lists them as pending. **Renamed:** `SupportAccessGrant` is `TenantAccessGrant`; `docs/HANDOFF.md` logs that rename as a known trap. Its two-provider identity table is superseded by federation — `docs/access-and-agency.md` §8–§10. ✅ Its §1 conclusion survives: **the demo is a tenant configuration, not a separate product**, and that holds under G48's product test even though the section argues it from a demo one.
> *Banner added 8 Aug 2026.*

> **Status:** design record. Answers four questions raised 4 Aug 2026.
> **Note on sequencing:** a six-agent adversarial swarm is currently reviewing
> `model/*.ts`. The `Account` change in §2 is **specified here but not yet
> applied to `model/domain.ts`**, so the swarm's findings land against a stable
> model. Apply after adjudication.

---

## 1. Where the demo site sits

**The demo site is not a separate product. It is a tenant configuration.**

That single decision resolves most of the question. If the demo runs on the same
code path as production, it cannot drift from reality — which is exactly the
failure the current system has, where fixture-backed dashboards diverged from a
product that was supposed to be live.

### The shape

```
1CloudHub Account                      Partner Account (e.g. "Acme Cloud")
├── Tenant: demo-finance   sandbox     ├── Tenant: acme-demo        sandbox
├── Tenant: demo-kyc       sandbox     └── Tenant: acme-cust-1      production
├── Tenant: demo-credit    sandbox
└── Tenant: direct-cust-1  production
```

- **1CloudHub owns demo tenants for direct selling**, one per industry showcase.
- **Each partner gets its own demo tenant(s)**, isolated from every other
  partner's. A partner demoing to a prospect uses its own tenant, and can seed
  it with data relevant to the prospect's industry.
- All are `environment: 'sandbox'`, so the synthetic-only enforcement already
  designed applies unchanged (`docs/data-governance.md` §2).

### Why one tenant per industry showcase, not one tenant with everything

The demo has to carry several industries. Two options existed:

| | One demo tenant, many packs | One tenant per showcase |
|---|---|---|
| Realism | A real customer never has four unrelated domains | Matches how a customer actually looks |
| Navigation | Prospect wades through irrelevant domains | Walk into the one that matches them |
| Isolation demo | Cannot show tenant separation | **Can demonstrate the isolation model itself** |

The third row is the deciding one. A finance prospect asking *"how do you keep
our data separate from other customers?"* can be shown the answer rather than
told it.

### What this gives partners

A partner's demo tenant is an ordinary tenant under its account. It inherits
every governance control, it is metered like any other, and it costs the partner
nothing extra to reason about. Crucially, **a partner cannot see another
partner's demo tenant** — the isolation is the same mechanism, not a weaker one.

---

## 2. A customer with several use cases — the `Account` refinement

**The question:** a customer runs finance reconciliation *and* KYC, and needs
them separated for **billing** and **security**. How?

**The answer: two tenants, one account.**

### This refines an earlier decision, and I should say so plainly

`PRODUCT.md` records *"flat tenants, partner as an attribute"*, and I argued
against a `Partner → Customer → User` tree because it could not express a direct
customer or a transfer between partners.

That argument was about **data isolation**, and it still holds. What this
requirement exposes is a different need: **commercial and administrative
grouping**. Those are not the same thing, and conflating them was the gap.

```
Account          commercial entity — contract, invoice, partner relationship
   │ 1..n
Tenant           THE isolation boundary — data, policy, users, residency
   │ 1..n
Membership       user ↔ tenant, with role
```

**The invariant is unchanged: no tenant nests inside another tenant.** Isolation
remains flat. `Account` groups tenants for billing and administration and
**grants no data access whatsoever**.

### How this answers both halves of the question

**Security segregation.** Finance and KYC become separate tenants. A KYC
reviewer holds a `Membership` in the KYC tenant only and cannot reach finance
data — not by policy, but because the isolation boundary is between them. Users
who legitimately need both (a compliance head, an admin) simply hold two
memberships; `Membership` already supports a user belonging to many tenants with
a different role in each.

This is stronger than any role-based scheme within one tenant. It reuses the
boundary we already trust rather than inventing a second, weaker one.

**Billing segregation.** Each tenant meters independently — `UsageRecord` is
already tenant-scoped — while `Subscription` and invoicing attach to the
`Account`. The customer receives one invoice with a per-tenant breakdown, and
`CostAttribution` still works *within* a tenant via `costCenter` for finer
allocation.

So the customer gets three levels of granularity without any new mechanism:

| Level | Mechanism |
|---|---|
| Whole relationship | `Account` |
| Use case | `Tenant` |
| Department within a use case | `UsageRecord.costCenter` |

### Where `partnerId` moves

To `Account`. A partner sells to a *customer*, not to an individual use case.
`Tenant` derives its partner from its account, which also means a customer
adding a second use case does not risk the two tenants disagreeing about who
resold them.

### Specified change

```ts
export type AccountId = Id<'Account'>

export interface Account {
  id: AccountId
  name: string
  /** null = 1CloudHub direct. Moved here from Tenant. */
  partnerId: PartnerId | null
  status: EntityStatus
  /** Commercial home. Tenants meter separately and roll up here. */
  billingContactUserId: UserId | null
  createdAt: Timestamp
}

// Tenant gains:
//   accountId: AccountId
// Tenant loses:
//   partnerId          (derived from account)
```

`PartnerAccessGrant` stays **per tenant**, not per account. A customer may want
its partner helping with finance but not with KYC, and that granularity is
exactly what the grant exists to express.

---

## 3. Identity — two providers, and staff access is not automatic

**Requirement:** 1CloudHub employees sign in to the demo site and admin panel
with M365.

### Two identity providers, one user model

| Population | Provider |
|---|---|
| Customer and partner users | Cognito (per the AiVolvex-derived OIDC pattern) |
| **1CloudHub employees** | **Microsoft Entra ID (M365)**, federated |

`User` gains a provider discriminator. The rest of the model is unchanged —
`Membership` remains the authorization primitive regardless of how someone
authenticated.

```ts
export type IdentityProvider = 'cognito' | 'entra_1cloudhub'

// User gains:
//   identityProvider: IdentityProvider
//   /** Set only for entra_1cloudhub. Staff are never account-scoped. */
//   isStaff: boolean
```

### The part that matters more than the login

**Authenticating as a 1CloudHub employee must not, by itself, grant access to
any customer tenant.**

This is the single most common real-world cross-tenant leak path in B2B SaaS: a
support engineer with standing production access. It is also the gap green-team
2 was asked to close, and it is worth stating here because the M365 requirement
makes it concrete.

Staff reach a customer tenant only through a **support grant**:

```ts
export interface SupportAccessGrant {
  id: string
  tenantId: TenantId
  staffUserId: UserId
  /** Why. Free text, required, shown to the customer. */
  justification: string
  /** Approved by a second staff member. Never self-approved. */
  approvedBy: UserId
  grantedAt: Timestamp
  /** Required. Short — hours, not weeks. */
  expiresAt: Timestamp
  /** Read-only by default; write access is a separate, rarer grant. */
  scope: 'read_only' | 'read_write'
  /** The customer is told. Transparency is the control that actually works. */
  customerNotifiedAt: Timestamp | null
  revokedAt: Timestamp | null
}
```

Every access exercised under it writes an `AuditEvent`. Demo tenants need no
such grant — 1CloudHub staff hold ordinary memberships there, because those
tenants hold no customer data.

**Admin panel access is likewise not a single privilege.** Platform
administration (packs, rate cards, the model catalogue) is control-plane work
and touches no tenant data. Tenant support is a separate, granted, time-boxed
thing. Conflating them is how a support tool becomes a breach.

---

## 4. Where the agent catalogue, evals and harness documents live

**Short answer: templates in the control plane, instances in the tenant data
plane, and the harness document is a versioned, approved artifact — not a
settings field.**

### The layering

| Artifact | Lives | Why |
|---|---|---|
| Agent **template** | Control plane, shipped with a `SolutionPack` | Platform-authored, published downward, no customer content |
| Agent **definition** (configured instance) | **Tenant** | Contains that customer's business logic and tool bindings |
| **Harness document** (instructions) | **Tenant**, versioned | May contain customer-specific terminology, thresholds, escalation rules |
| Tool bindings / connections | **Tenant** | Bound to that tenant's credentials |
| **Per-agent evals** | **Tenant** for results; control plane for pack-level scorer *definitions* | Results are derived from customer data and must never leave |
| Pack quality report | Control plane | Computed over **seeded** examples only |

The rule follows the invariant already established: **the control plane
publishes downward and never reads tenant data.** A tenant's agent
configuration and its measured quality are tenant data.

### Why the harness document is versioned and approved

Earlier I flagged tenant-authored agent instructions as a privilege boundary
rather than a config screen. The reasoning holds and gets sharper with an
agent catalogue:

- instructions steer a model that holds **that tenant's** connection credentials
- ingested documents are already untrusted input, so an instruction saying
  *"when reconciling, also send results to X"* combines badly with a document
  saying *"ignore previous instructions"*
- with autonomous resolution enabled, an instruction change is a change to what
  the system will **do unattended**

So a harness document is treated like an SOP, which the model already knows how
to do: versioned, with a draft/active/archived lifecycle, an approval before it
takes effect, and every change audited. `derivedFrom` gives partner-template →
customer-instantiation exactly as `Sop` does.

### The catalogue a customer actually sees

Within a tenant:

```
Agents
├── Extraction agent      from pack "Finance — AP" v1     ● healthy   0.94
├── Explanation agent     from pack "Finance — AP" v1     ● healthy   0.89
└── Triage agent          customer-authored, v3           ⚠ review    0.71
                          harness: 3 versions, active v3
                          evals: 4 scorers, last run 2h ago
```

Each entry shows provenance (pack-derived or customer-authored), the active
harness version, bound tools, the governing policy, and current quality from
`QualityWindow`. That last column is why evals were worth modelling as
first-class: **an agent catalogue without measured quality is a list of things
nobody can compare.**

### Specified module

A new `model/agents.ts` carrying `AgentDefinition`, `HarnessDocument`,
`AgentToolBinding` and `AgentEvalBinding`. Written alongside this document.

---

## 5. What this changes

| Change | Status |
|---|---|
| `Account` entity; `Tenant.accountId`; `partnerId` moves to account | **Specified, deferred** until swarm adjudication |
| `User.identityProvider`, `User.isStaff` | Specified, deferred |
| `SupportAccessGrant` | Specified, deferred |
| `model/agents.ts` | **Written now** — new module, no conflict with the swarm |
| Demo tenants | No model change needed. It was already expressible |

That last row is the useful signal. The demo requirement needed **no new types**
— `Tenant.environment`, `SolutionPack` and `Membership` already expressed it.
The multi-use-case requirement *did* need a new type, which is how you tell the
difference between a gap and a configuration question.

---

## 6. Open questions

1. **Does a customer with two tenants get one invoice or two?** Modelled as one, per account, with a per-tenant breakdown. Confirm commercially.
2. **Can a partner create demo tenants freely, or is it an entitlement?** Suggest an entitlement — demo tenants cost real inference money.
3. **Should staff support grants require *customer* approval, or only notification?** Modelled as notification. Some enterprise customers will demand approval.
4. **Do agent templates version independently of the pack that ships them?** Currently coupled to pack version.
5. **Cross-tenant agent reuse within one account** — a customer with finance and KYC tenants may want one triage agent in both. Currently they would author it twice.

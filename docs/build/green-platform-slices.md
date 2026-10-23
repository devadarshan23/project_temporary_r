# Green team — platform and tenancy build slices, first phase

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — a green-team input to a plan, not a decision; `docs/build/phase-one-plan.md` adjudicates it.
> 🛑 **Its P5 slice rests on a premise that REVERSED on 8 Aug 2026, and it prescribes the edit the owner rejected.** G75 put `secret` into `PERMITTED_RESOURCES.delivery` and took it OUT of `NON_DELEGABLE_RESOURCES`; this file's §P5 recommends `CONTRACT_ONLY_RESOURCES` instead, and that recommendation was put in front of the product owner and **overruled** — `docs/HANDOFF.md` §3 pass H, G75: *"Do not relitigate it; do not quietly narrow it back."* **Do not apply P5's diff.** Roughly ten lines are affected, including the claim that `NON_DELEGABLE_RESOURCES` is `['statutory', 'secret']` (it is `['statutory']`), the claim that the FDE cannot bind a credential (they can, since 8 Aug), and P5's own verification greps, which would now fail against a correct tree. Its `POLICY_KINDS` enumeration also omits `managed_service_use`, which G79 landed on 8 Aug.
> ✅ **BODY CORRECTED 8 Aug 2026 — the banner above no longer outruns the text beneath it.** It was added earlier the same day and the body was left uncorrected, which is worse than plain staleness: a reader who trusts a banner assumes the body was fixed. **Sixteen passages** were corrected, not the "roughly ten" estimated above — the X3 prerequisite row, the P4 model-type table (all fifteen `governance.ts` line numbers had drifted), P4's `secret` out-of-scope bullet, P5's issue paragraph, P5's reachability row, P5's two-line diff (now marked **⛔ DO NOT APPLY** at the diff itself), P5's two invariant-8 rows, invariant 11's wording, the verification table's rows 1 and 2, the published grep, the dependency line, P6's `POLICY_KINDS` and `ManagedServiceUseConfig` rows, and adjudication row C5. **Nothing was deleted.** Every superseded claim is struck through with the correction beside it, and P5's `CONTRACT_ONLY_RESOURCES` recommendation is preserved verbatim as the **overruled** case — it was put to the product owner and lost, which is history, not error.
> *Banner added 8 Aug 2026; body corrected the same day. This record narrates its corrections rather than erasing them.*

> **Status: a proposal.** Nothing here is applied. No file in `model/` and no
> contract file has been changed by this document.
>
> Written 7 August 2026 against **G49–G71** (`docs/HANDOFF.md` §3, lines 574–596),
> which are the current spec, and against `docs/v1-trim-proposal.md`, which is
> **not applied**. Where a slice depends on an unapplied proposal, it says so and
> names the sign-off item.
>
> **Scope of this file: the platform and tenancy half only** — session, tenant
> provisioning, staff access, FDE source configuration, model publication, and
> per-tenant BI provisioning. The reconciliation, IDP and Ask halves are somebody
> else's slices.

---

## 0. The seven slices, and why this order

| # | Slice | Unblocks | Depends on |
|---:|---|---|---|
| **P1** | **Sign in — mint a session** | every operation in every tier | nothing |
| **P2** | **Tenant selection and `TenantContext` resolution** | every tenant-scoped read and write | P1 |
| **P3** | **Tenant provisioning — the control plane creates a tenant** | P4, P5, P7, and the data half | P2 |
| **P4** | **`TenantAccessGrant` issuance and the FDE's door** | P5, P6, support generally | P3 |
| **P5** | ~~**Connections and sources, FDE-only, with the credential**~~ → **Connections and sources, CUSTOMER-FACING, with the credential still FDE-bound** — 🛑 **G203, 14 Aug 2026** | ingest, the ambient connection light | P4 · ~~G60 applied~~ → **G60+G75 ARE applied in the tree as of 8 Aug 2026**; this dependency is discharged. ⚠️ **G203 adds a NEW dependency this slice did not have: there is no `view_endpoint` capability**, so the customer half cannot be built without minting one |
| **P6** | **Model catalogue published downward, and the change path** | every inference and every extraction | P3 |
| **P7** | **Per-tenant Quick Suite account provisioning** | the BI dashboard | P3 |

**Why P1 and P2 are separate and not one slice.** They have different threat
models and different transports. P1 is **unauthenticated public HTTP**; P2 is on
the **hot path, in-process** — `docs/contracts/README.md:23` puts F1 Tenant Context
in the in-process row precisely because it is called once per request. Merging
them would put an unauthenticated surface and a per-request function in one
deliverable with one review.

**One fact governs the whole list.** `docs/screen-pack-ledger.md:696` and §6a.1
(`:703–722`): **there is no platform tier in the screen pack — 0 of 18 screens.**
Every slice below except P1 and P2 is an FDE surface with no drawn screen. That is
G28 arriving with a bill, and it is **not this document's to close**: these slices
specify contracts and model shapes, not screens. Where a slice needs a surface, it
says *runbook or console* and marks it a DECISION.

---

## 1. Cross-cutting prerequisites — not slices, but nothing lands without them

| # | Item | Kind | Note |
|---|---|---|---|
| X1 | **A fourth and fifth contract file.** `administration.openapi.yaml` does not exist (`docs/contracts/README.md:101`). Every operation proposed below has nowhere to live | **DERIVATION** | The gap is one coherent file, already argued at `docs/contracts/README.md:92–105` |
| X2 | **Where session establishment terminates** — inside this API surface or outside it | 🔴 **DECISION** | `docs/screen-pack-ledger.md:134–135` states it as a decision. P1 recommends a shape and the reasoning is there |
| X3 | ~~**G60 applied to `model/governance.ts`** — `'secret'` out of `NON_DELEGABLE_RESOURCES` (`governance.ts:449`), into `CONTRACT_ONLY_RESOURCES` (`governance.ts:438`)~~ **✅ CLOSED 8 Aug 2026 — G75, AND NOT IN THE SHAPE THIS ROW NAMES.** `'secret'` came out of `NON_DELEGABLE_RESOURCES` (now `['statutory']`, `governance.ts:544`) and went into **`PERMITTED_RESOURCES.delivery`** (`governance.ts:474`) — **not** into `CONTRACT_ONLY_RESOURCES`, which still reads `['authority']` (`governance.ts:512`). The `CONTRACT_ONLY_RESOURCES` shape this row prescribes is the one the product owner was shown and **overruled**; it is kept above, struck, as the losing case | ✅ **APPLIED to `model/governance.ts`** | `docs/v1-trim-proposal.md` §5 item 1 recommended the narrow shape and was overruled. **P5 is no longer blocked on this** — but P5's own diff is now the wrong diff; see the ⛔ block in §P5 |
| X4 | **`model/` becomes a workspace package** under G71 | 🔴 **DECISION** | `CLAUDE.md`: `model/tsconfig.json` is deliberately standalone, no `extends`, no `package.json`. G71 makes the Node backend consume it directly. Reconcile the two before the first `import`; do **not** add an `extends` |
| X5 | **`ErrorCode` is 71 members (`docs/contracts/errors.yaml:68–139`) and covers none of the refusals these slices raise.** `AuthorisationRefusal` has 7 members (`governance.ts:650–670`) and **zero appear in `ErrorCode`**; `DECISION_REASONS` (`access.ts:996`) likewise | **DERIVATION** | This is §5.3's shape — two vocabularies for one concept — caught before it diverges rather than after. `errors.yaml:22–27` already says ~23 members are owed. Each slice below lists the codes it needs |
| X6 | **The `authorize()` gap on pre-tenant and control-plane acts** | 🔴 **DECISION** | Detailed under P1 → invariant 10 and P3 → invariant 10. It recurs in three slices and should be settled once |

---

## P1 — Sign in: mint a session

### Issue
**Nothing in this repository issues a session, and everything requires one.** All
three contract tiers declare a `sessionContext` security scheme — an `X-Session`
header (`docs/contracts/capability.openapi.yaml:2160–2163`) — and **none of the 65
operations across the three files mints, refreshes or revokes one**.
`resolveTenantContext` (`docs/contracts/foundation.openapi.yaml:54`) takes a
`sessionToken` in its request body that no operation in the system can produce.
`Login.dc.html` draws five acts — SSO with the provider named, an email-and-passphrase
fallback, a six-digit second factor, a tenant picker that states the role per entity
set, and a re-auth card — **and none of the five has an operation**
(`docs/screen-pack-ledger.md:123–135`).

**Why first phase:** it is ranked gap 3 in `docs/screen-pack-ledger.md:561` and it
is the only gap that blocks 100 % of surfaces rather than a tier of them. Every
other slice in this document, and every slice in the data half, is dead code until
a session exists.

### Build contract

**Model types**

| Type | Where | Status |
|---|---|---|
| `User` | `model/domain.ts:1236` | **live** |
| `IdentityConnection` | `model/domain.ts:1196` | **live** — `owner` (`:1209–1212`) is a three-arm union and **is where `OrgClass` derives** |
| `IdentityProtocol` | `model/domain.ts:1188` | **live** — includes `cognito_pool`, the per-account managed fallback pool, which is what the passphrase path authenticates against |
| `ORG_CLASSES` / `OrgClass` | `model/access.ts:207` / `:216` | **live** |
| `Membership` | `model/domain.ts:1281` | **live** — ⚠️ a **pointer, not the authority record** (`:1288–1310`); `RoleAssignment` (`access.ts:804`) is |
| `Role` | `model/access.ts:735` | **live** |
| `Tenant` | `model/domain.ts:689` | **live** |
| `PrincipalContext` | `model/access.ts:954` | **live** — what a resolved session becomes; it takes `orgClass` **already derived** (`:969`) |
| `AskSession` · `AccessSession` | `domain.ts:4057` · `governance.ts:807` | **live, and NEITHER is this.** `docs/screen-pack-ledger.md:136–139`: *"the nouns collide and the concepts do not"* |

**`Session` does not exist and must be created.** Proposed shape, to sit in
`model/domain.ts` beside `IdentityConnection` (it joins `User` and
`IdentityConnection`, both of which live there — **DERIVATION**), with
`SessionId` added to `model/kernel.ts` beside `TenantId` (`kernel.ts:100`):

```ts
export type SessionId = Id<'Session'>            // model/kernel.ts

export interface Session {                        // model/domain.ts, NOT TenantScoped
  id: SessionId
  userId: UserId
  /** The directory that authenticated. Org derives from its owner at every
   *  resolve and is NEVER stored here — a stored org is a second door that
   *  outlives the directory membership it was copied from (domain.ts:1249-1255). */
  connectionId: IdentityConnectionId
  /** Selected AFTER authentication, server-set only. Null until selection. */
  tenantId: TenantId | null
  authenticatedAt: Timestamp
  /** Null = not yet presented. A session with null here selects no tenant. */
  secondFactorAt: Timestamp | null
  /** Required, never null. "An open-ended grant is not a grant" (access.ts:1540). */
  expiresAt: Timestamp
  lastUsedAt: Timestamp
  revokedAt: Timestamp | null
}
```

Two properties are load-bearing and both are absences: **no `orgClass` field** and
**no role, capability or scope field**. The first is stated above. The second is
because `AuthorizationGrant.scope` is *"pinned, and intersected again at redeem"*
(`access.ts:1531–1533`) — a session carrying a scope would be a third copy that
can disagree with both.

**Operations — all new.** They cannot go in any existing file: all three declare
`security: [sessionContext]` at document level, and these run before that header
exists. Proposed **`docs/contracts/session.openapi.yaml`**, document-level
`security: []`.

| Method | Path | operationId | Note |
|---|---|---|---|
| POST | `/session/realm` | `resolveHomeRealm` | Email or realm hint → which `IdentityConnection` will try. **Returns no user-existence signal.** `IdentityConnection.domains` (`domain.ts:1224`) is DNS-verified and *"routing chooses the door; the door decides"* (`:1216–1222`) |
| POST | `/session/federated` | `completeFederatedSignIn` | Exchange an IdP assertion for a `Session` |
| POST | `/session/password` | `signInWithPassword` | The labelled fallback. Permitted **only** where `IdentityConnection.protocol === 'cognito_pool'` |
| POST | `/session/second-factor` | `presentSecondFactor` | The six digits |
| GET | `/session` | `getSession` | What the re-auth card renders |
| DELETE | `/session` | `signOut` | |

**Capabilities: none, and that is correct.** `docs/screen-pack-ledger.md:121–122`.
`decide()` (`access.ts:1128`) requires a `PrincipalContext` carrying a `tenantId`
(`:967`); pre-session there is none, so there is nothing for a capability to gate.
A capability here would be a verb with no noun.

**`ErrorCode` members needed** (X5): `session_invalid` exists (`errors.yaml:126`).
**Missing and must be added:** `second_factor_required`, `second_factor_invalid`,
`realm_not_verified`, `connection_disabled`, `subject_not_active`
(mirrors `DECISION_REASONS.subject_not_active`, `access.ts:998`).

### Invariant obligations

| Inv | Obligation | Enforcement — named |
|---|---|---|
| **1** | Tenant scope is derived from the session, never read from a request | `Session.tenantId` is written by **exactly one** code path, P2's `selectTenant`. Wire-level: every schema in `session.openapi.yaml` carries `additionalProperties: false` and no `tenantId` property — the same convention as the other three files (`docs/contracts/README.md:34–37`) |
| **8** | Being staff is not access | A `platform`-owned connection mints a session exactly like any other. The refusal is `decide()` at `access.ts:1145–1152`, returning `DECISION_REASONS.platform_org_holds_no_assignment`. **Sign-in must not special-case staff** — the refusal belongs where the model already put it |
| **10** | An act with no authorisation is unrecordable | ⚠️ **This slice cannot satisfy it and must say so.** `authorize()` (`access.ts:1610`) mints the only `AuthorizationGrant` and needs a `PrincipalContext` with a `tenantId`. `AUTHORIZATION_MAY_BE_ABSENT` (`governance.ts:1124`) admits exactly one actor kind — `system` — and a sign-in is a `user` act with no tenant. **🔴 DECISION (X6):** record sign-in on a non-tenant-scoped event stream, or widen `AUTHORIZATION_MAY_BE_ABSENT`. **Recommend the first.** Widening a totality record to accommodate a call site is §5.1's shape — a rule keyed on a convenient landmark instead of the property it protects |

### Verification — what "done" is

```bash
# 1. No session operation may name a tenant. Must print 0.
grep -c 'tenantId' docs/contracts/session.openapi.yaml

# 2. Every schema in the new file refuses unknown properties.
#    Count of `type: object` must equal count of `additionalProperties: false`.
grep -c 'type: object' docs/contracts/session.openapi.yaml
grep -c 'additionalProperties: false' docs/contracts/session.openapi.yaml

# 3. The model still compiles, standalone, with the new type.
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"

# 4. Edges by kind, compared against the previous run.
node tools/planner/extract.mjs
```

**Compile-time assertion**, in `model/identity.ts` beside the existing proofs
(`identity.ts:13`: *"`type _X = Assert<…>` either compiles or it does not"*):

```ts
/** A session is not tenant-scoped at mint. The tenant is SELECTED, not asserted. */
export type _SessionIsNotTenantScoped =
  Session extends TenantScoped ? never : Session
```

⚠️ **Write it red first** — `identity.ts:21–23` requires it: temporarily declare
`Session extends TenantScoped` and watch the assertion fail. An assertion that has
never failed is `docs/HANDOFF.md` §5.6, a control that passes while asserting
nothing.

**Runtime test case, with expected output:** `POST /session/second-factor` against
a session whose `secondFactorAt !== null` returns `409` with
`{ code: 'second_factor_invalid' }` — not `200`, and not a fresh factor window.
Replay is the failure mode this operation exists to have.

### Dependencies
X1 (a file to put it in) · X2 (where session establishment terminates) · X4
(workspace wiring, since the backend imports `Session` from `model/`).

### Explicitly out of scope
- **Tenant selection** — P2. This slice mints a session with `tenantId: null`.
- **Lockout, attempt counting, the fifteen-minute lock.** Unmodelled;
  `docs/screen-pack-ledger.md:140–141` marks it a **DECISION**. `Login.dc.html`
  draws *"two attempts remaining"* and nothing in `model/` counts attempts.
- **The preserved unsubmitted rejection reason.** `Login.dc.html`'s re-auth card
  names a specific held decision; **the model has no draft or unsubmitted state**
  (`docs/screen-pack-ledger.md:142–144`) — **DECISION**.
- **User provisioning, SCIM, invitation.** `docs/screen-pack-ledger.md:149–153`:
  invitation *"has no screen, no model type and no operation"*. `manage_users`
  (`access.ts:331` → `authority`, `access.ts:576`) gates it and it is a Tier 3
  slice, not this one.
- **Password reset and passphrase policy.** Credentials live in the directory —
  `IdentityConnection`'s own comment, `domain.ts:1191–1194`: *"No password field
  anywhere near it, by design."*

---

## P2 — Tenant selection and `TenantContext` resolution

### Issue
`resolveTenantContext` and `resolveMembership` are written
(`foundation.openapi.yaml:54`, `:88`) and both *"consume a session that no
operation mints"* (`docs/screen-pack-ledger.md:123–124`). Once P1 mints one, the
remaining act is **selecting which tenant this session is operating in** — which
`Login.dc.html` draws as a picker that states the role per entity set before the
register opens — and **pinning that selection for the request**, which is what sets
the row-level-security session variable (`foundation.openapi.yaml:58–62`). G23
ruled the picker is **two visually distinct controls**: a session act here, a
filter inside the tenant; only the session act is in this slice.

**Why first phase:** `resolveTenantContext` is described as *"Every other operation
in every tier receives the result of this call"* (`foundation.openapi.yaml:57`).
It is invariant 1's single point of enforcement.

### Build contract

**Model types**

| Type | Where | Status |
|---|---|---|
| `Session` | new, from P1 | — |
| `Membership` | `model/domain.ts:1281` | **live** |
| `RoleAssignment` | `model/access.ts:804` | **live** — ⚠️ **the authority record.** `Membership.roleId` pins no version and carries no scope (`domain.ts:1300–1309`) |
| `HeldAssignment` | `model/access.ts:856` | **live** — what `PrincipalContext.held` carries |
| `PrincipalContext` | `model/access.ts:954` | **live** |
| `AssignmentScope` | `model/access.ts:630` | **live** — **six** dimensions, not five (`:630–676`) |
| `DENY_ALL` | `model/access.ts:692` | **live** — the failure value. ⚠️ its `valueCeiling` literal (`:698`) is `amountMinor: 0` and becomes `0n` under G65 |
| `decide()` | `model/access.ts:1128` | **live** |
| `PARTNER_CAPABILITY_MASK` · `effectivePartnerCapabilities()` | `access.ts:901` · `:926` | **live today; `docs/v1-trim-proposal.md` §4.2 proposes dropping both under G51.** ⚠️ `resolveMembership`'s description (`foundation.openapi.yaml:96–120`) names both by name and **becomes false if the drop is approved** |

**`TenantContext` does not exist in `model/`.** `grep -rn "TenantContext" model/*.ts`
returns nothing; it exists only as an OpenAPI schema. Under G71 (one TypeScript
vocabulary spanning the wire) that is exactly the §5.3 shape and **it must be
created**, as the narrow projection `PrincipalContext` already implies:

```ts
export interface TenantContext {          // model/domain.ts or model/access.ts
  sessionId: SessionId
  tenantId: TenantId
  subject: { userId: UserId; status: 'active' | 'disabled' }
  /** DERIVED from IdentityConnection.owner at this resolve. Never stored. */
  orgClass: OrgClass
  partnerId: PartnerId | null
  residency: RegionKey        // Tenant.residency, domain.ts:723 — carried, not looked up
}
```
Placement is a **DERIVATION** (it is the input `PrincipalContext` is built from);
the shape above is a **DECISION** only in whether `residency` rides along.

**Operations**

| Method | Path | operationId | Reuse or new |
|---|---|---|---|
| GET | `/session/tenants` | `listSelectableTenants` | **NEW** — the picker's contents: tenant name plus the role, per `Membership`. `docs/screen-pack-ledger.md:117` — *"a tenant picker that states the role per entity set"* |
| POST | `/session/tenant` | `selectTenant` | **NEW** — the only writer of `Session.tenantId` |
| POST | `/context/resolve` | `resolveTenantContext` | **REUSE** — `foundation.openapi.yaml:54` |
| GET | `/identity/membership` | `resolveMembership` | **REUSE** — `foundation.openapi.yaml:88` |

**Capabilities: none on selection.** Selecting a tenant you hold a `Membership` in
is not a capability act; it is the precondition for every capability act.
`listSelectableTenants` returns only tenants with a live, unrevoked `Membership` —
which is `Membership.revokedAt === null` and `expiresAt` in the future
(`domain.ts:1323–1325`).

**`ErrorCode`:** `tenant_context_missing` (`errors.yaml:133`), `membership_absent`
(`:100`), `tenant_suspended` (`:134`) all exist. **Missing:** none identified.

### Invariant obligations

| Inv | Obligation | Enforcement — named |
|---|---|---|
| **1** | Tenant scope derived from the session | `resolveTenantContext` sets the RLS session variable as a **side effect** (`foundation.openapi.yaml:58–62`), so *"a caller that reaches PostgreSQL without having called this sees nothing."* The enforcement is the RLS policy, not the handler |
| **8** | Being staff is not access | `listSelectableTenants` must be built on `Membership`, **not** on `TenantAccessGrant`. A platform user has no `Membership` and therefore an **empty picker** — correct, and it is `decide()`'s `platform_org_holds_no_assignment` (`access.ts:1145–1152`) expressed one layer earlier. The FDE's door is P4 and it is a different door |
| **11** | A container is never granted | `AssignmentScope.solutionIds` (`access.ts:655`) **intersects**; it never widens. `SOLUTION_IS_GRANTABLE = false` (`access.ts:2120`). ⚠️ `Solution` itself is `@dropped-for-v1` (`domain.ts:2371`), so in v1 this dimension is present and unexercised — the scope machinery must still carry all six dimensions or `UNSCOPED`/`DENY_ALL` stop compiling |

### Verification

**Compile-time assertion**, `model/identity.ts`:

```ts
/** `decide()` never reads a tenant from anywhere but the principal. */
export type _DecideTakesTenantOnlyFromPrincipal =
  Parameters<typeof decide>[0] extends { tenantId: TenantId } ? true : never
```

**Runtime test cases, with expected output** — three, and each was a real defect
shape in this record:

1. `decide()` with `subject.status: 'disabled'` returns
   `{ allowed: false, reason: 'subject_not_active' }`. §8.6 records that
   `User.status` *"was consulted by NOTHING"* (`access.ts:958–962`).
2. `grantAllows()` (`governance.ts:950`) with a grant for tenant A and
   `tenantId` = B returns `false`. `governance.ts:855–859` records that it
   previously *"never compared `grant.tenantId` to anything."*
3. `decide()` for an `orgClass: 'platform'` principal holding a durable
   `RoleAssignment` returns `platform_org_holds_no_assignment` —
   `DURABLE_ASSIGNMENT_PERMITTED` (`access.ts:232`) says `platform: false`.

```bash
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"
node tools/planner/extract.mjs   # report edges by kind AND gaps by kind
```

⚠️ **A green `tsc` is weak evidence here** and this slice is where that bites
hardest: `TenantContext` is a new interface nothing constructs, so the compiler
will not check a single field. `docs/HANDOFF.md` §5.10. **The three runtime cases
above are the verification; the compile is a floor.**

### Dependencies
P1.

### Explicitly out of scope
- **The in-tenant entity-set filter.** G23's second control, *"not drawn anywhere"*
  (`docs/screen-pack-ledger.md:145–147`).
- **The partner clamp.** `PARTNER_CAPABILITY_MASK` is under a drop proposal
  (`docs/v1-trim-proposal.md` §4.2). Build `resolveMembership` so the clamp is a
  branch that **currently never fires** rather than a branch that does not exist —
  the drop is `drop_for_v1`, not `delete`.
- **Role authoring, `RoleAssignment` creation.** `manage_roles` → `authority`
  (`access.ts:577`). Tier 3.
- **⚠️ `(packId, key)` uniqueness on `Role`.** It *"has no enforcer in `model/`"*
  and the first migration must impose it, treating a null `packId` as a distinct
  namespace rather than a wildcard (`docs/HANDOFF.md` §8 item 2). That is the
  schema slice's, not this one's — but it must not be forgotten, because
  `Membership.roleId` resolves against it.

---

## P3 — Tenant provisioning: the control plane creates a tenant

### Issue
**Nothing in the system creates a tenant.** A 7 Aug audit found that **all 12
existing control-plane operations are data-plane-initiated** — fetch, pull, report
(`docs/HANDOFF.md:575`, G50) — and
`docs/contracts/control-plane.openapi.yaml`'s twelve `operationId`s confirm it:
`sendHeartbeat`, `shipUsageEvents`, `submitUsageAttestation`,
`getAttestationChainHead`, `fetchEntitlementLeases`, `listSigningKeys`,
`listEntitledPacks`, `fetchPackVersion`, `reportPackInstallation`,
`fetchPolicyBundle`, `fetchTenantAccessGrants`, `reportAccessSessions`. Every one
is a *pull*. **G50 puts the control plane in v1** and the first thing it must do —
create an `Account` and a `Tenant`, register an `IdentityConnection`, set residency
and retention — has no operation, no capability and no file.

**Why first phase:** P4, P5, P6 and P7 all operate *on* a tenant, and so does every
slice in the data half. A demo tenant created by hand-written SQL is a tenant whose
residency, retention and `supportAccessMode` were never validated by the code that
is supposed to validate them.

### Build contract

**Model types**

| Type | Where | Status |
|---|---|---|
| `Tenant` | `model/domain.ts:689` | **live** |
| `Account` | `model/domain.ts:678` | **live** |
| `Partner` | `model/domain.ts:646` | **live** — G51 keeps it as a **commercial record**; no partner user signs in |
| `IdentityConnection` | `model/domain.ts:1196` | **live** — `owner` is *"server-set and immutable after creation"* (`:1203–1207`) |
| `RetentionPolicy` | `model/domain.ts:1015` | **live** — `days: Record<RetentionClass, number>` over **13** classes, total by construction |
| `RegionKey` | `model/domain.ts:322` | **live** — four values; v1 is `ap-southeast-1` |
| `TenantEnvironment` | `model/domain.ts:345` | **live** |
| `DeploymentMode` | `model/domain.ts:361` | **live** — v1 is `hosted` only; G36 defers BYOA |
| `TenantContact` | `model/domain.ts:792` | **live** — *"an address with a duty attached. It authorises nothing"* (`:760`) |
| `EvaluationTerms` | `model/domain.ts:845` | ⚠️ **`@dropped-for-v1`** (`:844`) — so `Tenant.evaluation` is a **live field of a dropped type** and must be `null` in v1, and `environment: 'evaluation'` is therefore unreachable |
| `Solution` | `model/domain.ts:2372` | **`@dropped-for-v1`** (`:2371`) |
| `PlatformTenantInspection` | `model/observability.ts:427` | **`@dropped-for-v1`** (`:426`) — *"support access runs by grant and runbook"* |

**Operations — all new**, in `administration.openapi.yaml`. These are the first
**platform-initiated** control-plane operations in the system, which is a
directional change the existing file's own convention forbids
(`docs/contracts/README.md:59–65`: *"Every operation is data-plane-initiated"*).
**They belong in the new file, not in `control-plane.openapi.yaml`** — putting a
push into a document whose stated convention is pull would silently retire the
convention. **DERIVATION.**

| Method | Path | operationId |
|---|---|---|
| POST | `/admin/accounts` | `createAccount` |
| POST | `/admin/tenants` | `provisionTenant` |
| GET | `/admin/tenants/{tenantId}` | `getTenantProvisioning` |
| PATCH | `/admin/tenants/{tenantId}/retention` | `setTenantRetentionPolicy` |
| POST | `/admin/identity-connections` | `registerIdentityConnection` |
| POST | `/admin/identity-connections/{connectionId}/verify` | `verifyConnectionDomain` |
| POST | `/admin/tenants/{tenantId}/contacts` | `addTenantContact` |

⚠️ **`tenantId` appears in a path here, and that is not a violation of the
`tenantId`-in-no-request-body convention — it is a different act.** The convention
(`docs/contracts/README.md:34–37`) says a *tenant-scoped* request must not state
its tenant, because scope derives from the session. These operations are
**platform-scoped**: the tenant is the *object*, not the *scope*. **That
distinction must be written into the new file's preamble**, or the next reader
will read the path parameter as the defect the convention forbids. **DERIVATION.**

**Capabilities: none of the 36 fits, and that is a finding.**

| Candidate | Class | Verdict |
|---|---|---|
| `configure_identity` (`access.ts:361`) | `identity` (`access.ts:564`) | Fits `registerIdentityConnection` **inside an existing tenant**. Does **not** fit creating one |
| `manage_users` (`:331`) · `manage_roles` (`:332`) | `authority` (`:576`, `:577`) | Tenant-scoped. A tenant that does not exist has no authority to manage |

🔴 **DECISION: creating a tenant has no capability, and it may be right that it
never does.** Every one of the 36 is evaluated by `decide()` against a
`PrincipalContext` that already carries a `tenantId` (`access.ts:967`). Provisioning
happens **before** there is one. The honest options are (a) platform provisioning is
gated by AWS IAM and a runbook, outside the capability system entirely, and the
audit record is an `AuditActor` of kind `platform_staff`; or (b) a new
platform-scoped authority axis. **Recommend (a) for v1** — it is G55's tie-breaker
(*fewer knobs*) and it matches `docs/screen-pack-ledger.md:717`: *"an FDE is a
1CloudHub employee with a runbook."* **Record it as a decision, not as an
oversight**, because the record already contains one class — `substrate` — whose
emptiness is a deliberate statement of exactly this shape (`access.ts:503–512`).

**`ErrorCode` members needed:** `residency_not_permitted`, `retention_class_unknown`
exists (`errors.yaml:121`); **missing:** `connection_owner_immutable`,
`domain_not_verified`, `tenant_already_provisioned`.

### Invariant obligations

| Inv | Obligation | Enforcement — named |
|---|---|---|
| **3** | The control plane publishes downward and never reads tenant data | `provisionTenant` **writes** tenant configuration and returns no row from inside the tenant. Enforced structurally by which file the operation lives in and by the response schema: `getTenantProvisioning` returns `Tenant` fields only — never an `Exception`, `SourceDocument` or `ReconciliationRun` |
| **1** | Tenant scope derived from the session | See the path-parameter note above. The enforcement is that **no operation in this file returns tenant-scoped rows**, so there is no scope to get wrong |
| **8** | Being staff is not access | Provisioning creates the tenant; it **does not** create a way into it. `provisionTenant` must not mint a `TenantAccessGrant` as a side effect — that is P4, it needs `approvedByStaffUserId !== staffUserId` (`governance.ts:872`), and a provisioning act has one actor |
| **10** | An act with no authorisation is unrecordable | ⚠️ **Same hole as P1, X6.** `AuditActor` (`governance.ts:886`) can name platform staff; `AuthorizationGrant` (`access.ts:1510`) is `TenantScoped` and cannot exist before the tenant does. **🔴 DECISION** — recommend the same non-tenant-scoped platform event stream P1 needs. **One decision, two slices** |

### Verification

```bash
# 1. The new file must not return a tenant-scoped row anywhere.
#    Must print 0 for each.
for t in Exception SourceDocument ReconciliationRun MatchGroup OperatorProposal; do
  echo -n "$t: "; grep -c "$t" docs/contracts/administration.openapi.yaml
done
```

**Compile-time assertion**, `model/identity.ts`:

```ts
/** Provisioning input carries no field a tenant-scoped read could hang off. */
export type _ProvisionTenantInputIsPlatformScoped =
  ProvisionTenantInput extends TenantScoped ? never : ProvisionTenantInput
```

**Fixture, and this is the load-bearing half.** `RetentionPolicy.days` is
`Record<RetentionClass, number>` over 13 classes and **nothing in `model/`
constructs one** (`domain.ts:1024–1031` says so explicitly). `provisionTenant` is
the **first construction site in the system**, which means it is the first thing
that can make the totality bite. Land a fixture in `model/examples.ts` in the same
commit:

```
# Expected: adding a 14th RetentionClass breaks the build at the fixture,
# not silently at runtime six months later.
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"
```

⚠️ **The thirteen window values do not exist and must not be invented.**
`docs/HANDOFF.md` §8 item 2: they are *"a counsel question, not an engineering
one — raise it before writing the table, not after"*, plus a per-jurisdiction
statutory floor map for `retentionWindowValid()`. **This slice is blocked on
counsel for the values and not for the shape.** Build the shape; leave the numbers
as a required input the operation refuses without.

### Dependencies
P2 (a platform user needs a session too) · X1 · counsel for the 13 retention
windows (values only).

### Explicitly out of scope
- **Data-plane registration.** `deployment.ts` is dropped whole under G36
  (`docs/v1-trim-proposal.md` §4.10). `Tenant.dataPlaneId` (`domain.ts:720`) is
  `null` for a `hosted` tenant and stays null in v1.
- **Pack and policy publication.** G50 names them; they are the data half's
  publication slice and they carry invariant 6's missing CI enforcement
  (`docs/HANDOFF.md:575`).
- **`EvaluationTerms` and the evaluation environment.** Dropped (`domain.ts:844`).
- **Commercial setup** — `RateCard`, `Plan`, `Subscription`, `Budget`. No
  admin-facing operation exists (`docs/contracts/README.md:95`) and
  `view_commercial` (`access.ts:462` → `commercial`, `:592`) was minted 7 Aug for
  a surface that does not exist yet. Its own slice.
- **User invitation.** P1's out-of-scope list.

---

## P4 — `TenantAccessGrant` issuance: the FDE's door

### Issue
G50 puts **`TenantAccessGrant` issuance** in v1. The control plane can already
**fetch** grants (`fetchTenantAccessGrants`,
`control-plane.openapi.yaml:731`) and **report** sessions against them
(`reportAccessSessions`, `:787`) — and **nothing issues one**. Invariant 8 says
reaching a tenant requires one of these rows; in the current system no row can be
created, so **the FDE cannot reach any tenant at all**, and P5 and P6 are
unbuildable without this.

**Why first phase:** it is the mechanism invariant 8 names. Every FDE act in every
later slice draws against a grant, and `grantAllows()` (`governance.ts:950`) and
`evaluateTenantAccess()` (`governance.ts:1435`) are already written and already
enforce the hard parts — this slice is mostly **wiring existing enforcement to an
operation**, which is the cheapest security work available.

### Build contract

**Model types — all live, and unusually complete**

> ⚠️ **Every `model/governance.ts` line number in the table below was re-derived
> on 8 Aug 2026 and all fifteen had drifted** — the G75 edit and the comments it
> brought with it moved the file. The old numbers are not struck through
> individually because a wrong line number is not an argument, it is a broken
> pointer; there is nothing to preserve. Re-derive rather than trusting these:
> `grep -n '^export \(interface\|type\|const\|function\) ' model/governance.ts`

| Type / function | Where | Status |
|---|---|---|
| `TenantAccessGrant` | `model/governance.ts:854` | **live** |
| `AccessResourceGrant` | `model/governance.ts:777` | **live** |
| `AccessExtension` · `AccessRevocation` | `:814` · `:824` | **live** |
| `AccessSession` | `model/governance.ts:915` | **live** — *"the grant permits; the session records"* |
| `SupportAuthorisation` | `model/governance.ts:602` | **live** |
| `AuthorisationRefusal` · `AuthorisationVerdict` | `:650` · `:672` | **live** |
| `authorisationPermits()` | `model/governance.ts:697` | **live** — order is load-bearing (`:684–695`), and `:688–695` now records **why**: a first-position refusal makes every later list a no-op for the classes it names, which is why G60 alone would have been inert |
| `grantAllows()` | `model/governance.ts:950` | **live** |
| `evaluateTenantAccess()` | `model/governance.ts:1435` | **live** |
| `maxGrantHours()` · `MAX_GRANT_HOURS` | `:749` · `:563` | **live** — `MAX_GRANT_HOURS` had *"zero call sites while its comment claimed a control"* until `maxGrantHours()`. ⚠️ `delivery` is `24 * 90`, and that is what makes membership of `PERMITTED_RESOURCES.delivery` a **standing 90-day reach** rather than a per-engagement one |
| `PERMITTED_RESOURCES` | `model/governance.ts:432` | **live** — `delivery` now includes **`'secret'`** (`:474`) under G75 |
| `REQUIRES_ENUMERATION` | `model/governance.ts:497` | **live** |
| `CONTRACT_ONLY_RESOURCES` | `model/governance.ts:512` | **live** — `['authority']` today, and **`secret` is NOT in it**. That was the recommended shape and it was overruled |
| `NON_DELEGABLE_RESOURCES` | `model/governance.ts:544` | **live** — ~~`['statutory', 'secret']` today. **G60 changes this; see P5**~~ → **`['statutory']`, a list of one.** G75 removed `'secret'` on 8 Aug 2026. The constant's own comment (`:527–541`) narrates the removal and quotes the deleted entry |
| `DataAccessEvent` | `model/governance.ts:1155` | **live** |

**Operations — all new**, `administration.openapi.yaml`.

| Method | Path | operationId |
|---|---|---|
| POST | `/admin/tenants/{tenantId}/support-authorisations` | `recordSupportAuthorisation` |
| DELETE | `/admin/support-authorisations/{id}` | `withdrawSupportAuthorisation` |
| POST | `/admin/tenants/{tenantId}/access-grants` | `requestTenantAccessGrant` |
| POST | `/admin/access-grants/{grantId}/approve` | `approveTenantAccessGrant` |
| POST | `/admin/access-grants/{grantId}/extend` | `extendTenantAccessGrant` |
| DELETE | `/admin/access-grants/{grantId}` | `revokeTenantAccessGrant` |
| POST | `/admin/access-grants/{grantId}/sessions` | `openAccessSession` |
| GET | `/tenant/access-grants` | `listMyTenantAccessGrants` — **customer-facing**, and required: `visibleToTenant: true` is a literal (`governance.ts:781–785`), so *"an access the customer cannot see is unrepresentable"* |

**Capabilities gating**

| Operation | Capability | Class |
|---|---|---|
| `listMyTenantAccessGrants` | `view_access_log` (`access.ts:336`) | `tenant_data` (`access.ts:540`) |
| `recordSupportAuthorisation` | **none of the 36 fits** — it is signed by a **customer** principal (`SupportAuthorisation.authorisedBy`, `governance.ts:553–556`) and is a contract act. 🔴 **DECISION**: gate on `manage_roles` → `authority` (`:577`) as the nearest true fit, or mint a 37th. **Recommend gating on `manage_roles`** — G55's tie-breaker; minting a capability changes a closed set and is a platform release (`access.ts:245–249`) |
| every grant operation | **none.** Grant issuance is a platform act evaluated by `evaluateTenantAccess()`, not by `decide()` | — |

**`ErrorCode` — the largest gap in this slice.** `access_grant_absent` exists
(`errors.yaml:69`). **All seven `AuthorisationRefusal` members are missing**
(`governance.ts:650–670`): `statutory_never_delegable`, `no_authorisation`,
`authorisation_withdrawn`, `purpose_not_authorised`, `resource_not_authorised`,
`beyond_purpose`, `staff_not_nominated`. **DERIVATION** — the union is closed and
already written; transcribing it is not a choice. Do it in one commit with the
operations, or the two vocabularies diverge exactly as `ErrorCode` already did
once by thirteen members (`errors.yaml:10–15`).

### Invariant obligations

| Inv | Obligation | Enforcement — named |
|---|---|---|
| **8** | Being staff is not access; reaching a **class** requires it in `PERMITTED_RESOURCES` or a signed `SupportAuthorisation` | `authorisationPermits()` (`governance.ts:697`), called by both `grantAllows()` (`governance.ts:961`) and `evaluateTenantAccess()` (`governance.ts:1523`) so the roster and the contract-only classes are decided in **one** place. **The API must not re-implement the check** — that is §5.1's shape. ⚠️ **And read all THREE constants, not two**: `NON_DELEGABLE_RESOURCES` is tested *first*, before the null check (`governance.ts:703`), so a class named there is unreachable no matter what the other two lists say. That is exactly how G60 would have been inert |
| **8** | Two people | `approvedByStaffUserId !== staffUserId`, *"enforced at issue AND re-checked in `evaluateTenantAccess`, deliberately, so a grant written around the issue path still fails when it is used"* (`governance.ts:872` and `evaluateTenantAccess`, `:1473`). **Build both.** One is not enough and the comment says why |
| **10** | An act with no authorisation is unrecordable | Every read under a grant writes a `DataAccessEvent` (`governance.ts:1155`) carrying the authorisation id. `AccessSession.resourcesTouched` (`governance.ts:926`) is *"usually narrower than what the grant permits and is the number worth reporting"* |
| **2** | Exactly one cross-tenant read path | ⚠️ **Declared and unexercised in v1.** G51 (`docs/HANDOFF.md:576`): no partner user signs in, so `PartnerAccessGrant` — invariant 2's mechanism — is exercised by nothing. `docs/v1-trim-proposal.md` §4.2: *"take it knowingly."* **This slice must not accidentally become a second cross-tenant path**: a platform grant reaches **one** tenant (`grantAllows` compares `grant.tenantId` to the tenant, `governance.ts:957`) |

### Verification

**Runtime test cases with expected output** — six, and every one guards a defect
this record already caught:

| # | Input | Expected |
|---|---|---|
| 1 | `authorisationPermits(null, 'delivery', 'statutory', staff)` | `{ permitted: false, refusal: 'statutory_never_delegable' }` — refused **before** the null check (`governance.ts:703`; the ordering comment is `:684–695`) |
| 2 | `authorisationPermits(auth, 'delivery', 'authority', staff)` where `auth.resourceClasses` omits `authority` | `resource_not_authorised` — *"signing a narrow authorisation narrows"* (`:524–526`) |
| 3 | `authorisationPermits(auth, 'delivery', 'tenant_data', staff)` where `auth` moves it across purposes | refused — a contract may **open** a contract-only class, never **move** an ordinary one (`governance.ts:617–620`) |
| 4 | `grantAllows(grantForA, tenantB, …)` | `false` (`governance.ts:849`) |
| 5 | `grantAllows(grant, t, auth, 'tenant_data', 'read')` with `nominatedSubjectIds: []` under `delivery` | `false` — *"an empty list grants nothing rather than everything"* (`governance.ts:869–878`) |
| 6 | `SupportAuthorisation.mayInvokeStaffUserIds: []` | authorises **nobody**, not everybody (`governance.ts:534–540`) |

```bash
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"
# ErrorCode must cover every AuthorisationRefusal member. Must print 7.
awk '/^export type AuthorisationRefusal/,/staff_not_nominated/' model/governance.ts \
  | grep -o "'[a-z_]*'" | tr -d "'" \
  | while read c; do grep -q "^        - $c$" docs/contracts/errors.yaml && echo "$c"; done | wc -l
```

### Dependencies
P3 (a tenant to grant against) · X1 · X5 (the seven error codes).

### Explicitly out of scope
- **The `secret` class.** ~~Today `NON_DELEGABLE_RESOURCES` (`governance.ts:449`)
  refuses it absolutely. **G60 changes that and it is P5's** — keeping the change
  out of this slice means P4 can land against the model as it stands.~~
  **FALSE SINCE 8 Aug 2026.** `NON_DELEGABLE_RESOURCES` is `['statutory']`
  (`governance.ts:544`) and `secret` is in `PERMITTED_RESOURCES.delivery`
  (`governance.ts:474`), so a delivery grant reaches it with **no**
  `SupportAuthorisation` at all. The scope boundary still holds — P4 need not
  make the change, because **the change is already made** — but P4's reviewer
  must know that a delivery grant issued here now carries a credential reach it
  did not carry when this slice was written.
- **The service-notice catalogue.** ⚠️ **This is a blocking dependency somebody
  must own.** `TenantAccessGrant.customerNotifiedAt` (`governance.ts:896`) has no
  notice kind to carry it, and `docs/screen-pack-ledger.md:493–499` records that
  without the closed list *"`customerNotifiedAt` is never set and **every support
  grant fails forever**."* **DERIVATION** — `Notifications.dc.html` has already
  enumerated the vocabulary. It is not in this slice and P4 does not work without it.
- **Reading the audit trail.** `view_audit` and `view_access_log` exist and
  *"nothing reads the audit trail"* (`docs/screen-pack-ledger.md:179–181`).
  `recordAudit` (`foundation.openapi.yaml:552`) writes only.
- **Break-glass.** `breakGlassPermits()` (`governance.ts:1714`) and
  `BreakGlassPreservation` (`:1647`) are live and are their own slice.

---

## P5 — Connections and sources, ~~FDE-only~~ **customer-facing**, with the credential

> 🛑 **THIS SLICE'S TITLE SAID *"FDE-only"* UNTIL 14 Aug 2026 AND G203 REVERSED IT.
> The old title is struck rather than replaced, because the whole Issue section
> below was written against it and reads as an argument for it.**
>
> **G203 reopens G59: connections are customer-facing.** The reason is inside G59
> itself — it needed a platform tier the taxonomy does not have, that tier was
> never built, and `PRODUCT.md:65` records that **no screen in the pack is a
> platform surface**. So the cards came off the customer surface and were never
> given another one.
>
> ⚠️ **WHAT DOES NOT MOVE, AND IT IS MOST OF THE SECURITY ARGUMENT BELOW.**
> `bind_secret` still maps to `secret` — the class with no read mode — and
> `enable_endpoint_writeback` still maps to `authority`, still the only member of
> `CONTRACT_ONLY_RESOURCES`. **The capability-and-class table further down is
> unchanged by G203 and stays correct.**
>
> 🛑 **WHAT G203 ADDS THAT THIS SLICE CANNOT BUILD WITHOUT: `view_endpoint`.**
> There is no read verb for an endpoint — `configure_endpoint` is the only
> capability that names one, so **read is implied by write** on the object that
> reaches a `credentialRef`. This file already carried that as an open owner
> DECISION (`docs/build/green-indicator-model.md:956`, U7). Under G203 it is a
> **blocker**: whoever builds the customer half either mints the capability or
> ships read-implied-by-write onto a customer screen.
>
> ⚠️ **And `Endpoint` gains `region: ForeignRegion` under G207** — a separate
> vocabulary from `RegionKey`, which enumerates only our deployment regions. The
> model types table below does not carry it because nothing is built.

### Issue
~~G59 takes `Setup.dc.html`'s **Connections** and **Sources** cards off the customer
surface and gives them to the FDE.~~ **Reversed by G203 — read the banner above
before taking anything in this paragraph as current.** G60 then reverses invariant 8
to make that possible: ~~today `bind_secret` maps to `secret` (`access.ts:565`) and `secret` sits
in `NON_DELEGABLE_RESOURCES` (`governance.ts:449`), so **the FDE cannot bind the
credential G59 requires them to bind** — the invariant made the FDE's own job
structurally impossible.~~

> ⛔ **CORRECTED 8 Aug 2026. THE SENTENCE ABOVE IS NO LONGER TRUE OF THE TREE.**
> `bind_secret` still maps to `secret` (`access.ts:565`, unchanged), but `secret`
> is **out of `NON_DELEGABLE_RESOURCES`** — which now reads `['statutory']`
> (`governance.ts:544`) — and **into `PERMITTED_RESOURCES.delivery`**
> (`governance.ts:474`). **The FDE can bind the credential today, under an
> ordinary delivery grant, with no `SupportAuthorisation`.** The diagnosis is
> preserved above because it is the reasoning G60 was taken on, and it was
> correct when written.

Meanwhile the four cards *"all author, and none has an
operation"* (`docs/screen-pack-ledger.md:530–533`), and the connection status light
in the chrome has *"no operation exposing endpoint health"* (`:169–172`).

**Why first phase:** nothing arrives without it. Every document in the product
enters through a connection or a watched location, and the credential is the first
thing an FDE binds on day one of an engagement.

### Build contract

**Model types**

| Type | Where | Status |
|---|---|---|
| `Endpoint` | `model/domain.ts:595` | **live** — carries `credentialRef: string \| null` (`:622`), *"a REFERENCE — no field in this model may hold key material"* |
| `ENDPOINT_DIRECTIONS` / `EndpointDirection` | `model/domain.ts:584` / `:592` | **live** — `inbound` · `outbound` · `bidirectional`; *"reaching this state is an act"* |
| `EndpointReading` | `model/domain.ts:3368` | **live** — ⚠️ carries text a foreign system returned; **G45 governs it**, and that is the data half's |
| `SourceDocument` | `model/domain.ts:1681` | **live** — `origin: 'upload' \| 'connector' \| 'api'` (`:1684`) |
| `CAPABILITY_RESOURCE_CLASS` | `model/access.ts:517` | **live**, total by construction |
| `MAX_AUTHORIZATION_SECONDS` | `model/access.ts:1468` | **live** — `secret: 60` seconds, and the reasoning (`:1461–1466`) is that binding a credential *"is one act and there is no second act it enables"* |
| `authorize()` | `model/access.ts:1610` | **live** — refuses when `CAPABILITY_RESOURCE_CLASS[capability] !== request.resource.resourceClass` (`:1621–1626`) |

**No `Source`, `IntakeChannel` or watched-location type exists.**
`grep -n "IntakeChannel" model/*.ts` returns nothing, while
`listIntakeChannels` (`capability.openapi.yaml:103`) returns
`IntakeChannelStatus` with a **four-member** channel enum —
`upload · watched_drop · connector_pull · mailbox`
(`capability.openapi.yaml:2439`) — and the schema's own description
(`:2440–2446`) records the divergence: **`SourceDocument.origin` has three
values and nothing states how `watched_drop` and `mailbox` are recorded.**

🔴 **This is §5.3's shape — two vocabularies for one concept, already diverging,
already written down, and not yet resolved.** It must be closed in this slice, not
carried. ~~**DECISION** on which vocabulary wins~~ — **SETTLED by G184, 12 Aug 2026:
the four-member operator vocabulary wins, `SourceDocument.origin` is deleted, and
`api` is dropped rather than folded.** **DERIVATION** that one must.
Proposed shape, now the ruled one:

> ⚠️ **THE SHAPE BELOW IS NO LONGER THE WHOLE OF IT — G205, 14 Aug 2026 SPLITS
> THIS INTO TWO ENTITIES AND THE SPLIT IS THE POINT.** `IntakeChannel` is the
> **lane**; `Arrival` is **one artefact coming down it**, carrying the
> pre-admission verdicts. A channel that has seen forty thousand files has **one
> row and one timestamp** in the shape below, and nothing anywhere records that a
> particular file was refused or why — `lastArrivalAt` is *"liveness, not health"*
> and cannot be made to carry it.
>
> 🛑 **AND `Procedure` IS NOT THE ROUTING ENGINE. G205 refuses that reuse** on
> five structural grounds — a `human` step in an arrival path, an `archetype` on
> the wrong axis, `ProcedureStepExecution.exceptionId` as a required instance key
> for something with no exception, `terminate.dispositionKey` naming a
> reconciliation disposition for a routing outcome, and decisively **pack
> authorship over the admission path**. **G206 rules the cascade instead: total
> functions and a closed refusal union, no steps and no edges** — and a
> pack-declared classification rule **must not express a compiled pattern**,
> because G130's removal of `matches_pattern` binds here and binds harder.

```ts
export type IntakeChannelKind =
  | 'upload' | 'watched_drop' | 'connector_pull' | 'mailbox'

export interface IntakeChannel extends TenantScoped {
  id: IntakeChannelId              // new Id<'IntakeChannel'> in kernel.ts
  kind: IntakeChannelKind
  /** The connection this channel draws through. Null for `upload`. */
  endpointId: EndpointId | null
  /** Opaque location: a SharePoint path, an S3 prefix, a mailbox address. */
  location: string
  /** Liveness, not health. capability.openapi.yaml:112-115. */
  lastArrivalAt: Timestamp | null
  /** Retention for files landing here, resolved against RetentionPolicy. */
  retentionClass: RetentionClass
  disabledAt: Timestamp | null
}
```
⚠️ **Name the reference field `endpointId`, id-shaped**, or
`tools/planner/extract.mjs` cannot see the edge — `CLAUDE.md` and
`docs/HANDOFF.md` §7. Two of the four fields branded on 7 Aug went unnoticed for
exactly this reason.

**Operations**

| Method | Path | operationId | Reuse or new |
|---|---|---|---|
| GET | `/intake/channels` | `listIntakeChannels` | **REUSE** (`capability.openapi.yaml:103`) — customer-facing, read-only, stays where it is |
| POST | `/admin/tenants/{tenantId}/endpoints` | `configureEndpoint` | **NEW** |
| PATCH | `/admin/endpoints/{endpointId}` | `updateEndpoint` | **NEW** |
| POST | `/admin/endpoints/{endpointId}/verify` | `verifyEndpoint` | **NEW** — `Endpoint.verifiedAt` (`domain.ts:628`): *"verification is the control, not hygiene"* |
| PUT | `/admin/endpoints/{endpointId}/credential` | `bindEndpointCredential` | **NEW** — the `secret` act |
| POST | `/admin/endpoints/{endpointId}/writeback` | `enableEndpointWriteback` | **NEW** — separate operation because it is a separate class |
| GET | `/admin/endpoints/{endpointId}/health` | `getEndpointHealth` | **NEW** — closes `docs/screen-pack-ledger.md:169–172`, a **DERIVATION**: `Endpoint` already carries the state. ⚠️ **G74 then ruled that no health POLL may exist, and G202 (13 Aug 2026) narrows that rather than lifting it.** A read of derived state is fine; a scheduled liveness ping with no requester and no artefact coming back is still refused. **What G202 permits is a scheduled READ down a declared channel under a standing authorisation** — so health here stays a **derivation over recorded pulls**, never a poll of its own |
| POST | `/admin/tenants/{tenantId}/intake-channels` | `configureIntakeChannel` | **NEW** |

**Capabilities and their classes — this is the whole security argument of the slice**

| Operation | Capability | Class | Reachable by a delivery grant? |
|---|---|---|---|
| `configureEndpoint` · `updateEndpoint` · `verifyEndpoint` | `configure_endpoint` (`access.ts:329`) | `endpoint` (`access.ts:548`) | ✅ yes — `PERMITTED_RESOURCES.delivery` includes `endpoint` (`governance.ts:440`) |
| `bindEndpointCredential` | `bind_secret` (`access.ts:377`) | `secret` (`access.ts:565`) | ~~❌ **no today.** Only after G60 is applied, and then **only under a signed `SupportAuthorisation`**~~ → ✅ **YES, since 8 Aug 2026 (G75), and by purpose alone.** `secret` is in `PERMITTED_RESOURCES.delivery` (`governance.ts:474`), so an ordinary delivery grant reaches it with `authorisation === null`. **No `SupportAuthorisation` is required.** This row is the single largest security delta in the file: the whole slice was written assuming a contract gate that does not exist |
| `enableEndpointWriteback` | `enable_endpoint_writeback` (`access.ts:392`) | `authority` (`access.ts:566`) | ❌ **never by purpose alone** — `authority` is in `CONTRACT_ONLY_RESOURCES` (`governance.ts:512`), and it is now the **only** member. *"An FDE may declare a read-only pull during delivery and may not flip the same object to write on day 60"* (`access.ts:389`) |
| `configureIntakeChannel` | `configure_endpoint` | `endpoint` | ✅ |

**The G60 change, precisely.** Two lines in `model/governance.ts`:

> ⛔ **DO NOT APPLY THIS DIFF. Line two is the edit the product owner rejected,
> and line one is already applied.** Marked here, at the diff, and not only in
> the file banner — a reader who scrolls to a code fence does not scroll back up.
>
> **What the tree actually holds, 8 Aug 2026, G75:**
>
> ```
> governance.ts:544  NON_DELEGABLE_RESOURCES = ['statutory']              ← line 1 APPLIED
> governance.ts:512  CONTRACT_ONLY_RESOURCES = ['authority']              ← line 2 REJECTED, unchanged
> governance.ts:474  PERMITTED_RESOURCES.delivery includes 'secret'       ← what was done INSTEAD
> ```
>
> Applying line two as written would put `secret` in **two** lists at once and
> quietly re-narrow a decision `docs/HANDOFF.md` §3 pass H, G75 closes with
> *"Do not relitigate it; do not quietly narrow it back."*

```
DO NOT APPLY — superseded by G75, see the block above.
governance.ts:449  NON_DELEGABLE_RESOURCES  = ['statutory', 'secret']  →  ['statutory']
governance.ts:438  CONTRACT_ONLY_RESOURCES  = ['authority']           →  ['authority', 'secret']
```

**~~Take the second shape, not `PERMITTED_RESOURCES.delivery`.~~ OVERRULED
8 Aug 2026 — G75 took `PERMITTED_RESOURCES.delivery`, the broader shape, against
this recommendation. The argument is kept verbatim below because it was put to the
product owner and lost; it is the record's losing case, not an error.**

> `docs/v1-trim-proposal.md` §4.4 argues it: adding `secret` to
> `PERMITTED_RESOURCES.delivery` is *"a standing 90-day reach to every customer
> credential"*, and pass A's whole argument is that `PERMITTED_RESOURCES` is *"the
> single constraint that makes a weeks-long grant acceptable."* Under
> `CONTRACT_ONLY_RESOURCES` the FDE has the **same capability** and a far narrower
> blast radius: reachable only under a `SupportAuthorisation` the customer signed at
> contract time, naming purpose, max hours and who may invoke.

**What the decision gave up, recorded so the slice's reviewer knows what they are
building against.** `MAX_GRANT_HOURS.delivery` is `24 * 90` (`governance.ts:565`),
so membership of `PERMITTED_RESOURCES.delivery` is a standing 90-day reach to every
customer credential rather than a per-engagement one, and a customer who withholds
`authority` cannot withhold this. **What survives:** `secret` still has no read
mode, every reach is still a grant, still authorised, still audited, and
`statutory` is still reachable by nothing. The decision-site comment
(`governance.ts:457–472`) records both halves at the line that does it.

⚠️ ~~**`NON_DELEGABLE_RESOURCES`'s own comment (`governance.ts:444–448`) says it is
*"the constant a future reader has to edit — visibly, in a diff — to take that
word away."* This slice is that edit.**~~ **That edit has been made, by G75, not by
this slice** (`governance.ts:527–541`), and the comment was updated in the same
change — it now narrates the removal and quotes the deleted entry verbatim. **The
instruction survives as a rule for the next person**: a constant whose comment
still argues for the value it no longer holds is worse than no comment.

⚠️ **G75 also had to touch a list this slice never named.** `secret` sat in
`NON_DELEGABLE_RESOURCES`, which `authorisationPermits()` tests **first, before
the null check** (`governance.ts:703`) — so the `CONTRACT_ONLY_RESOURCES` edit on
its own would have been **inert**, recorded as applied with the FDE still unable
to bind. `governance.ts:688–695` records the lesson. **If you are checking whether
a class is reachable, read all three constants.**

**`ErrorCode` needed:** `outbound_endpoint_unverified` exists (`errors.yaml:107`).
**Missing:** `credential_binding_not_authorised`, `endpoint_writeback_not_authorised`,
`intake_channel_kind_unsupported`.

### Invariant obligations

| Inv | Obligation | Enforcement — named |
|---|---|---|
| **8** (amended) | Reaching a class requires it in `PERMITTED_RESOURCES` **or** a signed `SupportAuthorisation` | `authorisationPermits()` (`governance.ts:697`). ~~After the two-line change, a `secret` draw with `authorisation === null` returns `no_authorisation` — the same branch that already guards `authority` (`governance.ts:601–606`). **No new code path.** That is the argument for this shape: it reuses an enforcement that already exists rather than adding one~~ **OVERRULED — and the prediction is now wrong about the tree.** Under G75 a `secret` draw with `authorisation === null` falls through the `CONTRACT_ONLY_RESOURCES` branch (`governance.ts:708–710`) to the `PERMITTED_RESOURCES` test (`:711–713`) and returns **`{ permitted: true }`**, not `no_authorisation`. The "no new code path" argument held and still holds — it is the *outcome* that changed, not the mechanism |
| **8** | `statutory` is untouched | ✅ **Still true, and verified after G75.** `NON_DELEGABLE_RESOURCES` keeps `'statutory'` — it is now the list's **only** member (`governance.ts:544`) — and `authorisationPermits()` checks it **first, before the null check** (`governance.ts:703`). ⚠️ The ordering **did** survive the edit; the comment at `:684–695` says the order is load-bearing and now also records that this ordering is why G60 alone would have been inert |
| **10** | The credential act is recordable | `authorize()` (`access.ts:1610`) with `resource.resourceClass: 'secret'` and `ttlSeconds <= 60` (`MAX_AUTHORIZATION_SECONDS.secret`, `access.ts:1475`). A 61-second request is refused with `authorization_ttl_out_of_bounds` |
| **4** | Classification declared once, on `FieldSpec` | Not this slice's subject, but its trap: an endpoint's `address` is *"opaque here… never parsed for authorisation, and never pattern-matched"* (`domain.ts:611–613`). **Do not classify a source by its URL** |
| **11** | A container is never granted | The reason `secret` was non-delegable in the first place is that `Solution`'s assembly reaches a `credentialRef` (`domain.ts:2367–2369`), and `SOLUTION_IS_GRANTABLE = false` (`access.ts:2120`) still holds. ⚠️ **Neither G60 nor G75 weakens invariant 11** — ~~it opens `secret` to a contract-authorised draw~~ G75 opens `secret` to a **purpose-authorised** draw, not to a grantable container. `Solution` is dropped for v1 anyway (`domain.ts:2371`) |

### Verification

**The compile-time half is the strong one here**, because `CAPABILITY_RESOURCE_CLASS`
and `MAX_AUTHORIZATION_SECONDS` are both `Record<K, V>` and the change touches
neither key set — so `tsc` will tell you nothing about the two-line edit. **Say so.**
The verification is runtime:

> ✅ **"The verification is runtime" stopped being an aspiration on 8 Aug 2026.**
> This file was written when the repository had no test runner and it assumed the
> table below could only be reasoned about. It can now be **executed**:
> `package.json` carries `"test": "npm run typecheck:tests && node --test …"`, and
> `tests/model/access-decide.test.ts` is the first behavioural assertion against
> `model/`. `tests/model/runtime-importability.test.ts` asserts every module on
> disk loads under node. ⚠️ Read that file's own warning before trusting a green
> run: `node --test` alone passes while `tsc` fails, which is why `npm test` runs
> the typecheck first.

| # | Input | Expected |
|---|---|---|
| 1 | ~~`authorisationPermits(null, 'delivery', 'secret', staff)` **before** the change → `statutory_never_delegable`~~ | **Historical only.** True 5–8 Aug 2026; `secret` is no longer in `NON_DELEGABLE_RESOURCES`, so this input can never produce this refusal again |
| 2 | ~~same call **after** the change → `no_authorisation` — *not* `permitted: true`~~ | ⛔ **WRONG AGAINST THE TREE, AND WRONG IN THE DIRECTION THAT MATTERS.** Under G75 the same call returns **`{ permitted: true }`** — exactly the outcome this row was written to forbid. A test asserting `no_authorisation` here would fail, and fixing it by narrowing the model would be the quiet re-narrowing G75 forbids |
| 3 | `authorisationPermits(auth, 'delivery', 'secret', staff)` with `'secret'` in `auth.resourceClasses` and staff nominated | `{ permitted: true }` — ✅ still true, though no longer the *only* way to reach it |
| 4 | same, staff **not** in `mayInvokeStaffUserIds` | `staff_not_nominated` — ✅ still true |
| 5 | `authorisationPermits(null, 'delivery', 'statutory', staff)` | `statutory_never_delegable` — ✅ **still true, and this is the row that survived the reversal intact** |
| 6 | `authorize(principal, 'bind_secret', { …, resource: { resourceClass: 'endpoint', …} })` | `authorization_resource_class_mismatch` (`access.ts:1621–1626`) |
| 7 | `authorize(principal, 'bind_secret', { …, ttlSeconds: 61 })` | `authorization_ttl_out_of_bounds` |

⛔ **THE GREP BELOW WAS PUBLISHED AS A CHECK AND WOULD NOW FAIL A CORRECT TREE.**
It asserted `'secret'` **present** in `CONTRACT_ONLY_RESOURCES`. The tree is
correct and the check was wrong — the sharpest instance in this file of a stale
verification, because a verification that fails against a correct tree teaches its
reader to "fix" the code. Replaced, not deleted:

```bash
# ⛔ DO NOT RUN AS WRITTEN — superseded 8 Aug 2026 by G75.
#   grep -n "NON_DELEGABLE_RESOURCES\|CONTRACT_ONLY_RESOURCES" model/governance.ts
#   # Expect: 'secret' present in CONTRACT_ONLY_RESOURCES, absent from NON_DELEGABLE.
#
# CORRECT CHECK. All THREE lists, because authorisationPermits() reads all three
# and NON_DELEGABLE is tested first. Expect exactly: secret in PERMITTED_RESOURCES
# .delivery; secret in NEITHER of the other two; statutory alone in NON_DELEGABLE.
grep -n "PERMITTED_RESOURCES\|CONTRACT_ONLY_RESOURCES\|NON_DELEGABLE_RESOURCES" model/governance.ts
awk "/^export const NON_DELEGABLE_RESOURCES/,/^]/" model/governance.ts   # ['statutory']
awk "/^export const CONTRACT_ONLY_RESOURCES/,/^]/" model/governance.ts   # ['authority']

npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"
npm test                          # runner landed 8 Aug 2026; typechecks tests, then runs them
node tools/planner/extract.mjs    # IntakeChannel.endpointId must appear as a resolving edge
```

⚠️ **Test 5 is the one that matters, and it is now the only row of this table that
still reads as written.** G60 and G75 between them reverse one clause of invariant
8; a change that also loosened `statutory` would be the reversal nobody agreed to,
and it is one keystroke away in the same array. ⚠️ **G75 moved a second list this
table never checked** — see the three-list grep above.

### Dependencies
~~**X3 (G60 applied) — hard blocker**~~ **X3 is DISCHARGED — G75 applied it to the
tree on 8 Aug 2026, in the broader shape.** · P4 (the grant and the authorisation) · P3 ·
the source-vocabulary decision above.

### Explicitly out of scope
- **Ingest itself.** `createUpload` / `completeUpload`
  (`capability.openapi.yaml:133`, `:214`) exist and are the data half's.
- **The confidence floor and document types.** G22/G38 put the floor with the FDE
  and `FieldSpec.confidenceFloor` is applied, but *"the surface half is not built
  and cannot be verified, because there is no screen"*
  (`docs/screen-pack-ledger.md:590–591`). Separate slice, and it carries the
  unsolved *customer-invisible configuration* problem (`docs/HANDOFF.md:681–687`).
- **Secret storage.** `credentialRef` is a reference; where the material lives is
  an infrastructure decision, not a model one. **DECISION**, and read
  `docs/infrastructure-risk-register.md` before taking it.
- **Credential expiry notification.** `Setup.dc.html`'s Connections card promises
  *"administrators are told a week out"* — that needs the service-notice catalogue
  P4 is also blocked on.
- **The customer-invisible-configuration mechanism.** ~~`Endpoint` becoming FDE-only
  raises the same question G25 left open and G59 re-raises~~ — **G203 reverses the
  premise and the question gets HARDER, not easier: `Endpoint` is customer-facing
  now, so the surface must express the difference between seeing a connection and
  holding authority over it, and the model has**
  `TenantAccessGrant.visibleToTenant` (`governance.ts:895`) and nothing else.
  ⚠️ **This citation read `governance.ts:781` until 14 Aug 2026, and `:781` still
  resolves — to a doc-comment line inside `GrantLine.instanceIds`, a different
  declaration.** `tools/check-citations.mjs` structurally cannot catch this class,
  because the citation *resolves*. Reproduce:
  `grep -n 'visibleToTenant' model/governance.ts`.
  **Open engineering question, not settled** (`docs/HANDOFF.md:681–687`).

---

## P6 — The model catalogue, published downward, and the change path

### Issue
G49: **a customer never chooses a model.** The FDE sets it at implementation time
and a change is a **support ticket**, not a setting. That makes
`ModelCatalogEntry` (`catalog.ts:107`) and `resolveModel()` (`catalog.ts:167`)
*gain* authority — the catalogue becomes something the control plane publishes
downward, which is invariant 3's own shape. Today the catalogue has **one
operation** (`resolveModel`, `foundation.openapi.yaml:456`, in-process) and
**nothing publishes it**; `ModelUseConfig.allowedModels` (`policy.ts:259`) is a
per-tenant policy field with no operation that sets it.

**Why first phase:** `resolveModel()` is the **only executable enforcement of
invariant 7** (`CLAUDE.md`, `docs/v1-trim-proposal.md` §0 override 1), and G69
widens it — an extraction model resolves through it too, so residency now covers
extraction as well as inference. Every inference and every Textract/SageMaker call
in the product passes through this slice or bypasses the invariant.

### Build contract

**Model types**

| Type | Where | Status |
|---|---|---|
| `ModelCatalogEntry` | `model/catalog.ts:107` | **live** — ⚠️ `provider: 'bedrock' \| 'other'` (`:120`); G54 says close it to `'bedrock' \| 'sagemaker'`. `'other'` is **unreachable**, which is §5.6's shape. **DERIVATION**, `docs/v1-trim-proposal.md` §5 item 6 |
| `resolveModel()` | `model/catalog.ts:167` | **live** — 🛑 never drop |
| `InferenceRouting` · `ModelRejection` · `ModelResolution` · `RetentionPosture` · `ModelCapabilities` · `ModelCost` | `model/catalog.ts` | **live** — ⚠️ `{ kind: 'global' }` **stays** in `InferenceRouting`; it is the arm `resolveModel()` exists to reject (`docs/v1-trim-proposal.md` §4.5) |
| `ModelFallbackChain` | `model/catalog.ts:133` | **`@dropped-for-v1`** — v1 routes to one model per binding |
| `ModelUseConfig` | `model/policy.ts:240` | **live** — `allowedModels: ScopeDimension<string>` (`:259`). ⚠️ `:256–258`: *"`resolveModel()` in catalog.ts still takes `allowedModels: string[]`… the two must be landed together or the fix is cosmetic."* **Verify which shape is live before writing the caller** |
| `Policy` · `POLICY_KINDS` · `LivePolicyKind` | `policy.ts:506` · `:78` · `:602` | **live** — `modelUse` is live (`:84`); `spend` and `content_guardrail` are dropped (`:96`, `:99`). ⚠️ **The three line numbers had drifted and the membership implied here was short by one.** G79 landed **`managedServiceUse: 'managed_service_use'`** (`policy.ts:91`) on 8 Aug 2026. Do not read a count off this row: `awk '/^export const POLICY_KINDS = \{/,/^\}/' model/policy.ts \| grep -cE '^  [a-zA-Z]+:'` returned **8** on 8 Aug 2026, of which **6 are live** — `LivePolicyKind` (`policy.ts:602`) excludes `spend` and `content_guardrail` only |
| `ManagedServiceUseConfig` | `model/policy.ts:327` | ~~**does not exist, must be created.** `docs/v1-trim-proposal.md` §4.8: G7's design, made live by G53/G69 — `allowedFeatures`, `allowedRegions`, `maxDataClassToService`, `maxProviderRetentionDays`.~~ ⛔ **FALSE SINCE 8 Aug 2026 — DO NOT CREATE IT.** G79 landed the interface **and** the `POLICY_KINDS` member **and** the `managed_service_use` arm of the config union (`policy.ts:441`). All four fields named above are present, in that shape. **Following this row as written would produce a duplicate declaration.** ⚠️ **Deliberately no `requireImprovementOptOut` boolean** — a caller-supplied off-switch on a residency check is §5.2 — and that held: `maxProviderRetentionDays` is a **number, not a flag** (`policy.ts:372`), and `allowedRegions` (`:350`) carries a banner calling itself *"the only residency constraint on extraction in the whole model"* |
| `SupportAuthorisation` | `governance.ts:602` | **live** — the change path draws against P4 |

**Operations — all new**, `administration.openapi.yaml`, except one reuse.

| Method | Path | operationId | Note |
|---|---|---|---|
| POST | `/admin/catalogue/models` | `publishModelCatalogEntry` | Platform-scoped. The **publish** half of invariant 3 |
| PATCH | `/admin/catalogue/models/{entryId}` | `updateModelCatalogEntry` | Deprecation sets `succeededBy` (`catalog.ts:126`) |
| GET | `/admin/catalogue/models` | `listModelCatalogue` | |
| PUT | `/admin/tenants/{tenantId}/policies/model-use` | `setTenantModelUse` | **The G49 act: the FDE sets the model on behalf of the customer** |
| PUT | `/admin/tenants/{tenantId}/policies/managed-service-use` | `setTenantManagedServiceUse` | G7/G53/G69 — Textract's posture |
| GET | `/tenant/policies/model-use` | `getTenantModelUse` | **Read-only, customer-facing.** G38's shape: an FDE sets it, a customer cannot change it, **and read-only is not invisible** |
| POST | `/model/resolve` | `resolveModel` | **REUSE** (`foundation.openapi.yaml:456`) — in-process |

**Capabilities: 🔴 no capability names "set the model", and it is not a
`configuration` verb.** `docs/v1-trim-proposal.md` §4.5 states the gap and the
argument: setting a model carries a **residency consequence** (invariant 7), and
`PERMITTED_RESOURCES.delivery` reaches `configuration` (`governance.ts:438`) — so
classifying it as `configuration` would let a standing 90-day delivery grant move
a tenant's inference into another region. It should be **`authority`**.

| Option | Verdict |
|---|---|
| Reuse `configure_telemetry` (`access.ts:337` → `authority`, `:563`) | ✗ wrong noun |
| Reuse `set_autonomy` (`access.ts:319` → `authority`, `:575`) | ✗ wrong noun |
| Mint a 37th, `set_model_policy` → `authority` | 🔴 **DECISION.** `CAPABILITY_RESOURCE_CLASS` is `Record<Capability, …>` so a 37th unclassified capability is a **compile error** (`access.ts:503–507`) — the change is safe and mechanical. Adding one is a platform release (`access.ts:245–249`) |
| Platform-scoped, outside the capability system, like P3 | 🔴 **DECISION** — consistent with P3's recommendation |

**Recommend: mint `set_model_policy` → `authority`.** Unlike P3's provisioning act,
this one operates **inside an existing tenant** on that tenant's policy, so a
`PrincipalContext` with a `tenantId` exists and `decide()` can evaluate it. That is
the difference that makes a capability the right instrument here and the wrong one
in P3. `catalogue` stays capability-free — a platform release reaches it, not a
grant (`access.ts:503–512`), and `publishModelCatalogEntry` is a release act.

**`ErrorCode`:** `model_residency_violation` (`errors.yaml:103`),
`model_unavailable_in_account` (`:104`), `model_provider_throttled` (`:102`) all
exist. **Missing:** `model_not_in_catalogue`, `model_status_unavailable`,
`model_retention_not_zero` — three of `ModelRejection`'s seven arms
(`catalog.ts:146–153`) have no code. **DERIVATION**, same shape as P4's seven.

### Invariant obligations

| Inv | Obligation | Enforcement — named |
|---|---|---|
| **7** | Residency survives inference; `global.*` routing rejected outright | `resolveModel()` (`catalog.ts:167`), returning `{ reason: 'routing_defeats_residency' }`. **Every model call in the backend must route through it.** ⚠️ **Two LIVE bypasses remain and this slice must not claim to close them**: `UsageRecord.model` (`billing.ts:238`) and `PolicySubject` `model_call.model` (`policy.ts:747`) are bare strings. `CLAUDE.md`: *"No document may claim the sweep closed E5."* |
| **7** | The empty-list bug stays closed | `allowedModels` is a `ScopeDimension<string>`; `{ kind: 'these', values: [] }` permits **nothing** (`catalog.ts:174–190`). ⚠️ Verify `resolveModel()`'s parameter type actually matches `ModelUseConfig`'s before wiring — `policy.ts:256–258` warns the two may still disagree |
| **3** | The control plane publishes downward and never reads tenant data | `publishModelCatalogEntry` writes the catalogue; `getTenantModelUse` reads a **policy**, not tenant data. `ModelUseConfig` is `configuration`-class by content and the operation that **sets** it is `authority` — the asymmetry is deliberate |
| **5** | Money is always derived | `ModelCost` (`catalog.ts:97`) is `*PerMillionMinor: number`. ⚠️ **G65 makes these `bigint`** and G66 collapses `MoneyAmount` into `Money`. **Do not land this slice's catalogue write path before the money retype, or land it after** — `docs/v1-trim-proposal.md` §4.12: *"a partial money retype is worse than none"* |

### Verification

**Runtime test cases with expected output:**

| # | Input to `resolveModel()` | Expected |
|---|---|---|
| 1 | `routing: { kind: 'global' }`, everything else valid | `{ ok: false, rejection: { reason: 'routing_defeats_residency' } }` |
| 2 | `allowedModels: { kind: 'these', values: [] }` | rejected — **not** permitted. This is §8.6's inverted-polarity bug and it must stay closed |
| 3 | `allowedModels: { kind: 'all' }`, entry outside `allowedRegions` | `region_not_permitted` |
| 4 | `requireZeroRetention: true`, entry with retention | `retention_not_zero` |
| 5 | a SageMaker extraction model, per G69 | resolves — **residency now covers extraction** |

```bash
# The G54 closure, verified rather than claimed.
grep -n "provider: 'bedrock'" model/catalog.ts     # expect: 'bedrock' | 'sagemaker'
# The bare-model-identity survey. CLAUDE.md says run it; do not trust the table.
grep -rnE "\b(model|modelId|modelOverride)\s*\??:\s*string\b" model/*.ts \
  | grep -v '^\S*:[0-9]*: *\*'
# Must still return exactly the 5 known lines — 2 live bypasses, 1 dropped, 2 bare-by-rule.
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"
```

### Dependencies
P3 · P4 (the change path draws against a grant) · the money retype ordering
decision · G54's `provider` closure (cheap, **DERIVATION**).

### Explicitly out of scope
- **Closing the two live invariant-7 bypasses.** `UsageRecord.model`
  (`billing.ts:238`) and `PolicySubject` `model_call.model` (`policy.ts:747`).
  Named here so the next reader does not assume this slice closed them. **Their own
  slice, and `policy.ts:747` sits inside a union type alias, invisible to the
  extractor** (`CLAUDE.md`).
- **The support-ticket change path's *screen*.** ⚠️ G49 makes `Support.dc.html` a
  change-request channel and **it is drawn as defect-only** — one triage question,
  *"Is this stopping you working?"* (`docs/screen-pack-ledger.md:698`). **A change
  request is not a defect and the screen has no state for one.** 🔴 **DECISION**,
  and it is the design team's. This slice builds the *operation*
  (`setTenantModelUse`); the *request* that triggers it has no surface.
- **`DiagnosticBundle`.** Delta 9, unwritten, G41 blocked on P10
  (`docs/screen-pack-ledger.md:517–527`).
- **Textract's coverage boundary.** G53/G69 carry a verification item:
  handwriting and CJK in `ap-southeast-1`, against
  `DocumentTypes.dc.html`'s four-language argument
  (`docs/screen-pack-ledger.md:726–732`). **Confirm before the IDP slice is a
  commitment.** Not this slice's, but it is upstream of it.
- **`DocumentType` variants.** G69 needs a per-variant engine binding and
  `DocumentType` has no variant concept (`docs/v1-trim-proposal.md` §4.3).
  **DECISION — a product judgement.**

---

## P7 — Per-tenant Quick Suite account provisioning

### Issue
G57 buys the BI layer; G68 accepts that scope enforcement becomes Quick Suite
row-level security; **G70 makes it an account per tenant**, which *"restores
structurally what G68 gave up procedurally"* — a viewer in tenant A cannot address
tenant B's data at all, so **invariant 1 holds by construction for the BI layer**
rather than by a row filter. The cost is stated plainly in G70's own row: **this
reintroduces per-tenant infrastructure provisioning, the operational shape G36
deferred**, and it lands in the control plane G50 just put in scope.

**Why first phase:** G55 names the BI dashboard as one of three things v1 must
have, and a Quick Suite account cannot be retrofitted per tenant after tenants
exist without a migration of every one of them. It rides on P3 — provision the BI
account **in the same act** that provisions the tenant, or the two records drift.

### Build contract

**Model types**

| Type | Where | Status |
|---|---|---|
| `Tenant` | `model/domain.ts:689` | **live** |
| `SubjectLocation` | `model/governance.ts:1501` | **live** — **ten variants**, and **none covers a copy of tenant data inside a BI tool** |
| `SubjectIndexEntry` | `model/governance.ts:1555` | **live** |
| `ErasurePlan` · `ErasurePlanItem` | `governance.ts:1646` · `:1662` | **live** |
| `RetentionPolicy` | `model/domain.ts:1015` | **live** |
| everything in `model/presentation.ts` | — | **dropped whole**, 51 of 53. G57/G68 **cancel** the proposed restore (`docs/v1-trim-proposal.md` §4.11). **Do not restore it** |
| everything in `model/deployment.ts` | — | **dropped whole.** ⚠️ G70 is the reason a partial restore is on the table (`docs/v1-trim-proposal.md` §4.10) and **it is unresolved**: *"who operates the per-tenant BI accounts, and with what"* |

**An eleventh `SubjectLocation` variant does not exist and must be created**
(`docs/v1-trim-proposal.md` §4.4, sign-off item 5 — **DERIVATION**, because the
union is closed and the gap is demonstrable):

```ts
  /**
   * A dataset inside the tenant's Quick Suite account (G70). A SPICE dataset is
   * a COPY of tenant data outside our storage, and without this variant PDPA
   * erasure is incomplete — PRODUCT.md names PDPA as the primary regime.
   */
  | { kind: 'bi_dataset'; accountRef: string; datasetRef: string }
```

**Operations — new**, `administration.openapi.yaml`.

| Method | Path | operationId |
|---|---|---|
| POST | `/admin/tenants/{tenantId}/bi-account` | `provisionBiAccount` |
| GET | `/admin/tenants/{tenantId}/bi-account` | `getBiAccountStatus` |
| DELETE | `/admin/tenants/{tenantId}/bi-account` | `decommissionBiAccount` |
| POST | `/subjects/locations` | `registerSubjectLocation` — **REUSE** (`foundation.openapi.yaml:305`), extended with the new variant |
| POST | `/subjects/erasure-plan` | `planErasure` — **REUSE** (`foundation.openapi.yaml:338`) |

**Capabilities**

| Operation | Capability | Class |
|---|---|---|
| `provisionBiAccount` · `decommissionBiAccount` | **none of the 36 fits** — platform provisioning, same shape as P3. 🔴 **DECISION**, and it should be answered **once, with P3** |
| the customer reading a dashboard | `view_dashboard` (`access.ts:255`) | `tenant_data` (`access.ts:521`) |

⚠️ **`view_dashboard` and `view_summary` go back to being verbs with no noun** —
`docs/v1-trim-proposal.md` §4.11 item 1, quoting `model/presentation.ts:6–13`: *"A
verb with no noun cannot be scoped, cannot be masked, cannot be audited as a
`DataAccessEvent`, and cannot appear in an erasure plan."* **Recorded, not solved,
and not this slice's to solve** — G68 was reaffirmed after the concern was put in
writing (`docs/HANDOFF.md:593`). Do not relitigate it; do not paper over it either.

### Invariant obligations

| Inv | Obligation | Enforcement — named |
|---|---|---|
| **1** | Tenant scope derived from the session | **Structural, by G70.** One AWS account per tenant means tenant B's data is not addressable from tenant A's account at all. The enforcement is the account boundary, not a row filter — which is why G70 is worth its cost |
| **10** | An act with no authorisation is unrecordable | ⚠️ **DOES NOT HOLD, and this slice must say so rather than imply otherwise.** *"A dashboard read cannot be recorded as a `DataAccessEvent` by us"* (`docs/v1-trim-proposal.md` §4.11 item 2). Quick Suite has its own audit trail, outside our chain. **Recorded as an accepted consequence of G68** |
| **PDPA / erasure** | A copy of tenant data must be nameable in an erasure plan | The new `bi_dataset` variant plus `registerSubjectLocation` (`foundation.openapi.yaml:305`). Without it, `planErasure` silently omits the copy — and `SubjectLocation`'s own comment on `trace` (`governance.ts:1520–1523`) already establishes the principle: *"an erasure plan that admits what it cannot reach is worth more than one that reports success"* |

### Verification

**Compile-time assertion.** `SubjectLocation` is a closed union with no total
`Record` over it, so **`tsc` will not force any handler to address the new variant
unless one exhausts it.** Add the exhaustiveness anchor in the same commit:

```ts
/** Every SubjectLocation kind has a disposition. Red before `bi_dataset` landed. */
export type _ErasureAnswersEverySubjectLocation =
  Record<SubjectLocation['kind'], ErasureDisposition> extends infer R ? R : never
```
Then a fixture in `model/examples.ts` constructing it — because a total `Record`
*"only bites where something CONSTRUCTS one, and in a types-only model nothing
does"* (`CLAUDE.md`, `docs/HANDOFF.md` §5.10).

**Runtime test case:** `planErasure` for a subject with a registered `bi_dataset`
location returns a plan item for it — with disposition `out_of_reach` if that is
the truth. **Expected output is a plan that names the dataset, not a plan that
succeeds.**

```bash
# The union must have 11 arms after this slice.
grep -c "^  | {" model/governance.ts   # compare against the pre-change count
npx -y typescript@5.9.3 tsc -p model/tsconfig.json --noEmit; echo "EXIT: $?"
```

### Dependencies
P3 (provision in the same act) · 🔴 **the two open verifications**: Quick Suite's
namespace and RLS model, and `ap-southeast-1` availability
(`docs/HANDOFF.md:582`, `docs/v1-trim-proposal.md` §5). **This slice is not a
commitment until both are confirmed.**

### Explicitly out of scope
- **Restoring `presentation.ts`.** Cancelled by G57/G68. The module needs **no
  edit at all** (`docs/v1-trim-proposal.md` §4.11).
- **Dashboard authoring and composition.** *"v1 ships pack-carried dashboards…
  and nobody composes one"* (`docs/HANDOFF.md:580`). `SAVED_VIEWS_EXIST = false`
  stays.
- **The seam between Quick Suite's own natural-language querying and `Ask`.**
  G62: *"Overlaps Quick Suite's own natural-language querying — **seam not
  settled**"* (`docs/HANDOFF.md:587`). 🔴 **DECISION**, and it is the product
  owner's.
- **Restoring `deployment.ts`.** 🔴 **DECISION** — depends on who operates the
  per-tenant BI accounts (`docs/v1-trim-proposal.md` §4.10). **Do not restore it
  as a side effect of this slice.**
- **Cost.** G70's own row: *"Cost floor per tenant rises materially and is
  uncosted."* Not engineering's to close alone.

---

## 3. The gap register for this half — DERIVATION versus DECISION

`docs/HANDOFF.md` §7: *"If it is a derivation, it is not deferrable — you are just
choosing to ship it wrong."*

### DERIVATIONS — the answer follows from something already decided

| # | Gap | Slice | Follows from |
|---:|---|---|---|
| D1 | `administration.openapi.yaml` does not exist | all | `docs/contracts/README.md:101` |
| D2 | Seven `AuthorisationRefusal` members missing from `ErrorCode` | P4 | `governance.ts:650`; the union is written |
| D3 | Three `ModelRejection` arms missing from `ErrorCode` | P6 | `catalog.ts:146` |
| D4 | Eleventh `SubjectLocation` variant for BI datasets | P7 | `governance.ts:1501`; the union is closed, the gap demonstrable |
| D5 | `provider: 'other'` is unreachable under G54 | P6 | §5.6's shape; close to `'bedrock' \| 'sagemaker'` |
| D6 | Endpoint health has no operation | P5 | `Endpoint` already carries the state (`domain.ts:626–636`) |
| D7 | The service-notice catalogue | P4 (blocker) | `Notifications.dc.html` has enumerated it; without it every support grant fails forever |
| D8 | Platform-scoped operations belong in the new file, not `control-plane.openapi.yaml` | P3 | that file's convention is *every operation is data-plane-initiated* (`README.md:59–65`) |
| D9 | `TenantContext` exists on the wire and not in `model/` | P2 | G71 — one TypeScript vocabulary spanning the wire |

### DECISIONS — a human must choose

| # | Decision | Slice | Owner |
|---:|---|---|---|
| C1 | Where session establishment terminates; a fifth contract file or not | P1 | engineering + product |
| C2 | How a pre-tenant / platform act satisfies invariant 10 (new event stream vs widening `AUTHORIZATION_MAY_BE_ABSENT`) — **recurs in P1, P3, P7; settle once** | P1 | engineering |
| C3 | Does creating a tenant get a capability, or is platform provisioning outside the capability system? | P3 | engineering |
| C4 | Mint a 37th capability `set_model_policy` → `authority`, or not | P6 | engineering |
| C5 | ~~G60's implementation shape — `CONTRACT_ONLY_RESOURCES`, recommended~~ **✅ CLOSED 8 Aug 2026 by G75 — and the recommendation was OVERRULED.** The shape is `PERMITTED_RESOURCES.delivery` (`governance.ts:474`), a standing 90-day reach; `CONTRACT_ONLY_RESOURCES` remains `['authority']`. The recommendation is left standing above as the losing case | P5 | ~~product owner; recorded as G60, not applied~~ **product owner; decided as G75; APPLIED to `model/governance.ts`.** *"Do not relitigate it; do not quietly narrow it back."* |
| C6 | The intake-channel vocabulary: four channels or three origins | P5 | engineering |
| C7 | `Support.dc.html` has no state for a change request | P6 | design |
| C8 | Lockout policy, attempt counting | P1 | product |
| C9 | The preserved unsubmitted decision (no draft state exists) | P1 | product |
| C10 | Partial restore of `deployment.ts` for BI account operations | P7 | product owner |
| C11 | `model/` as a workspace package without an `extends` | all | engineering |
| C12 | Where credential material lives | P5 | engineering + infrastructure |

---

## 4. Three things this document asserts and cannot prove

1. **Every count and citation above was derived, not carried.** Line numbers were
   read at `571e7c26`+working tree on 7 Aug 2026. `docs/HANDOFF.md` §5.11 records
   a count stated in prose and believed instead of derived as a defect shape; if
   you are reading this later, **re-run the greps** rather than trusting the
   numbers.
2. **A green `tsc` proves almost nothing about most of this.** The model is types
   only; five total records already have no construction site
   (`docs/HANDOFF.md` §5.10). The verification sections above deliberately lead
   with runtime cases and fixtures, and the compile is a floor.
3. **No slice here has a screen.** Six of the seven are platform surfaces and the
   screen pack has none (`docs/screen-pack-ledger.md:696`). These contracts are
   buildable against a runbook; whether that is the right product answer is C3's
   sibling and it has not been taken.

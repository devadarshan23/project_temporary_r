# Red team — can the first build phase actually be built?

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — an adversarial pass. It finds defects; it decides nothing, and nothing in it is applied.
> ⚠️ **One finding is closed and two moved in opposite directions on 8 Aug 2026.** Finding **B-f** — *"the `secret` implementation shape is explicitly open… not signed off"* — **is signed off**, by G75, in the broader of the two directions. Its sibling in `red-decisions.md` (RD-6, the 60-second TTL) got **stronger**, not weaker, because a standing 90-day reach is not a per-authorisation one, and nobody has re-scored it. Read `docs/HANDOFF.md` §3 pass H before treating any finding here as live.
> ✅ **BODY CORRECTED 8 Aug 2026** (banner added earlier the same day and the body then left uncorrected — worse than plain staleness, because a reader who trusts a banner assumes the body was fixed). B-f is closed in place; B5 gains the four rulings that close it (G98–G101) and B6 the two facts that changed today. Nothing deleted; every superseded claim is struck through with the correction beside it. ⚠️ **Line-count discipline:** edits above line 356 are in-place, because `HANDOFF` G-rows G99/G100/G101 cite `:347`, `:349-351` and `:353` — the three RLS leak modes — and those citations must keep resolving.

> **Adversarial review, 7 Aug 2026.** Scope: buildability of phase one under
> G49–G71. Not a design review — every finding below is something that stops a
> build, not something that offends taste.
>
> **Verified at the tree, not read from prose.** Every count and every citation
> in this document was reproduced against the working tree on 7 Aug 2026. Where
> a claim in the record turned out to be wrong, it is contradicted here with the
> command that contradicts it.
>
> **The short answer to the sequencing question is in §S — and it is no.** There
> is no vertical slice that can be built first without at least four other things
> landing. That is the most useful sentence in this file.

**Findings: 6 BLOCKER · 10 SERIOUS · 8 NOTED.**

---

## Reproduction — run these before trusting anything below

```bash
/Users/jrkphani/Projects/Reconcile/node_modules/.bin/tsc \
  -p /Users/jrkphani/Projects/Reconcile/model/tsconfig.json --noEmit; echo "EXIT: $?"
node /Users/jrkphani/Projects/Reconcile/tools/planner/extract.mjs
grep -rn 'bigint' model/*.ts | wc -l                    # 0
grep -rn 'TenantContext' model/*.ts | wc -l             # 0
grep -rni 'set local\|current_setting\|pgbouncer\|rds proxy\|connection pool' docs/*.md model/*.ts  # 0 hits
grep -rn 'view_summary\|manage_roles\|author_definition' docs/contracts/  # 0 hits
```

Extractor at the time of writing: **140 nodes · 249 typed edges (249 resolving,
0 dangling) · 154 gaps**, of which `capability_without_contract` **36** and
`no_administration_tier` **1**.

---

# BLOCKERS

## B1 · BLOCKER · Nothing mints a session, and every operation in every tier requires one

**What cannot be built, and why.** Not one line of application code can run
before a session exists, because tenant scope is derived from the session
(invariant 1) and the RLS design derives from that. There is no operation that
signs a user in, exchanges a credential, takes a second factor, selects a tenant,
or signs out. There is also **no type in `model/` that represents a session or a
resolved tenant context.** The contracts name `TenantContext` as F1's output;
`grep -rn 'TenantContext' model/*.ts` returns **zero**. So the first thing a
build must do has neither a wire contract nor a domain type.

**Evidence.**

- `docs/contracts/capability.openapi.yaml:2159-2171` — the only auth scheme is
  `sessionContext`, `type: apiKey`, `in: header`, `name: X-Session`. Its
  description asserts a side effect nothing implements: *"Resolved by F1 into a
  TenantContext, **which sets the row-level-security session variable as a side
  effect**."*
- `docs/contracts/foundation.openapi.yaml:815-822` — same scheme, same claim,
  shorter. `docs/contracts/foundation.openapi.yaml:45-46` and
  `docs/contracts/capability.openapi.yaml:94-95` apply it globally.
- `docs/contracts/foundation.openapi.yaml:51-54` — `resolveTenantContext`
  **consumes** the header. Nothing produces it.
- `docs/screen-pack-ledger.md:126-135` — *"none of the 62 paths signs in,
  exchanges a token, takes a second factor, selects a tenant or signs out.
  `Login.dc.html` draws all five."* Ranked gap **3** at
  `docs/screen-pack-ledger.md:561`.
- `docs/screen-pack-ledger.md:136-139` — the near-miss trap: `/access/sessions`
  (`docs/contracts/control-plane.openapi.yaml:784`) is **staff** access reporting
  under a `TenantAccessGrant`, not a user session. Nouns collide, concepts do not.
- `model/access.ts:954` — `PrincipalContext` is the *evaluation input*, and its
  own doc comment (`model/access.ts:945-953`) says the quiet part: *"`tenantId`
  and `orgClass` are DERIVED SERVER-SIDE at session establishment… a caller that
  lifts either out of a payload has broken the invariant before this function is
  reached, **and no check here can detect it**."* The model explicitly delegates
  invariant 1 to a component that does not exist.
- Federation was decided (pass D, `docs/HANDOFF.md:408`) — customers and partners
  bring their own IdP, and `OrgClass` derives from `connection.owner`. There is
  no SAML/OIDC/SCIM anywhere in the repository; the same line records that.

**What must land first.**

1. A decision on where session establishment terminates — is it in this API
   surface at all, or is it an IdP-fronted edge (Cognito / Entra) that hands the
   application an already-federated principal? `docs/screen-pack-ledger.md:134`
   marks this *(decision)* and it has not been taken.
2. A `Session` / `TenantContext` type in `model/` with the `IdentityConnection`
   → `OrgClass` derivation on it, because `PrincipalContext` requires
   `orgClass`, `partnerId` and `partnerGrant` already resolved.
3. Session-mint, tenant-select and sign-out operations in a contract file.
   These belong in the administration tier (B2) or in a fifth file; nobody has
   said which.

**DECISION.** Where the session boundary sits is a decision nobody has taken.
Everything downstream of it is derivation.

---

## B2 · BLOCKER · `administration.openapi.yaml` does not exist, and G58 makes it the gate on v1

**What cannot be built, and why.** G58 rules that finance authors reconciliation
definitions **in full**, so Tier 2 Save is mandatory
(`docs/HANDOFF.md:583`). There is no authoring operation anywhere. Worse than
"missing file": the **only** mechanism in the entire contract set that brings a
`ReconciliationDefinition`, `DocumentType` or `Procedure` into existence is
`installPack` (`docs/contracts/capability.openapi.yaml:1954-2000`), whose request
body is `{packId, packVersion}` and which returns `mintedDefinitionIds`
(`:3809-3815`), `mintedDocumentTypeIds` (`:3816-3818`) and `mintedProcedureIds`
(`:3819-3821`). **You install a signed pack or you get nothing.** That is
architecturally opposed to G58, not merely short of it.

**Evidence.**

- `docs/contracts/README.md:79-80` — *"All 65 operations are runtime. None is
  administration."* Table of six absent surfaces at `:92-99`; row 1 (`:94`) is
  exactly the G58 set, and records that `/authoring/validate` *"validates a
  procedure that no operation can create"* (the validator is
  `docs/contracts/foundation.openapi.yaml:747-773`).
- `docs/screen-pack-ledger.md:386-390` — *"Every screen in this tier authors
  something, and the authoring tier of the API does not exist."* Per-screen
  **Operations: none** at `:404`, `:423`, `:453`, `:491`, `:520`.
- `docs/screen-pack-ledger.md:559` — ranked gap 1, blocking *"all 4 of Tier 2,
  all 5 of Tier 3, and both authoring halves of Tier 1."*
- `docs/HANDOFF.md:604-612` (§3a) — under a product reading Tier 2 cannot ship
  read-only; the file *"moves from top of the list to the thing v1 is blocked on."*
- `docs/v1-trim-proposal.md:102` — *"The largest single deliverable in v1."*
- No `PATCH`, no `DELETE` in any contract file; exactly one `PUT`
  (`docs/contracts/capability.openapi.yaml:737`, `assignException`). The mutation
  vocabulary the tier needs does not exist as a precedent anywhere in the set.

### What the first phase must contain — enumerated

Derived from `docs/contracts/README.md:92-99`, `docs/screen-pack-ledger.md`
§3.4–§3.5, and G49/G50/G58/G59/G61. Grouped by whether it is derivable now or
blocked.

**Group A — derivable now (write these):**

| # | Operation | Why phase one |
|---|---|---|
| A1 | `createDefinition` / `getDefinition` / `listDefinitions` | G58 Tier 2 Save |
| A2 | `saveDefinitionVersion` (produces v_n+1, never mutates v_n) | G58's versioning promise — **but see B3, the shape is undecided** |
| A3 | `setDefinitionStatus` (`draft`→`active`→`archived`) | `ReconciliationDefinition.status`, `model/domain.ts:2000` |
| A4 | `createMatchRule` / `saveMatchRuleVersion` | `MatchRule.version`, `model/domain.ts:1758` |
| A5 | `createDocumentType` / `saveDocumentTypeVersion` | Tier 2 `DocumentTypes.dc.html` |
| A6 | `createProcedure` / `saveProcedureVersion` / `amendProcedure` | G39; `Procedure.version`, `model/domain.ts:3027` |
| A7 | `listUsers` / `inviteUser` / `createMembership` / `revokeMembership` | `docs/contracts/README.md:96` — *"the contacts added to fix escalation cannot be created"* |
| A8 | `listRoles` / `createRoleAssignment` / `revokeRoleAssignment` | `RoleAssignment` is the only thing pinning `roleVersion` + `AssignmentScope` (`docs/HANDOFF.md:841-846`) |
| A9 | `getAuditTrail` / `getAccessLog` | `view_audit` and `view_access_log` gate a read **no operation performs** — `docs/screen-pack-ledger.md:179-181`, ranked gap 7 at `:565` |
| A10 | `closePeriod` | `close_period` has no operation — ranked gap 8, `docs/screen-pack-ledger.md:566` |
| A11 | `setFxRate` (per period, decimal string, as-at date, owner) | G61 (`docs/HANDOFF.md:586`) — the rate is customer-entered and versioned |
| A12 | `registerServiceNoticeKind` / the closed catalogue read | Without the closed list **every support grant fails forever** — `docs/screen-pack-ledger.md:493-499`, `docs/HANDOFF.md:425-426` |

**Group B — CANNOT be specified, because a prior decision is missing:**

| # | Operation | The missing decision |
|---|---|---|
| B-a | Anything that **mints a session** | B1. Where session establishment terminates. `docs/screen-pack-ledger.md:134` *(decision)* |
| B-b | `saveDefinitionVersion`'s response and storage shape | B3. Whether a version is a row or a diff, and where v4's *content* lives. Nothing in `model/` answers it |
| B-c | Every operation's `requiredCapability` | B4. There is no wire representation for a capability, and no `x-` extension convention (`grep -rnE "^\s*x-[a-zA-Z-]+:" docs/contracts/*.yaml` → **zero**) |
| B-d | `setConfidenceFloor` | G22 put it with the FDE and off the customer surface; G25 records that **no mechanism for customer-invisible configuration exists or is being added** (`docs/HANDOFF.md:550`, `:681-689`). G38 resolved it as *read-only rendering* and `docs/HANDOFF.md:563` records the surface half as *"not built and cannot be verified"*. Which tier owns the write is undecided |
| B-e | Any FDE / platform operation — provision tenant, publish pack version, publish policy bundle, set model, issue `TenantAccessGrant` | G50 puts all five in v1; **the taxonomy has no platform tier** (`docs/screen-pack-ledger.md:703-722`), G28 is *"action on the design team"* and *"has not moved"* (`docs/HANDOFF.md:553`) |
| B-f | `bindSecret` on a source connection | ~~G60 reverses invariant 8 and the **implementation shape is explicitly open**: `CONTRACT_ONLY_RESOURCES` versus `PERMITTED_RESOURCES.delivery` (`docs/HANDOFF.md:585`; sign-off item 1, `docs/v1-trim-proposal.md:347`). Not signed off~~ **✅ CLOSED 8 Aug 2026 — G75, and it went to `PERMITTED_RESOURCES.delivery`, the broader of the two.** `secret` is in `PERMITTED_RESOURCES.delivery` (`model/governance.ts:474`), out of `NON_DELEGABLE_RESOURCES` (now `['statutory']`, `:544`), and **not** in `CONTRACT_ONLY_RESOURCES` (still `['authority']`, `:512`) — so an ordinary delivery grant reaches it with no `SupportAuthorisation` and `bindSecret` is buildable. ⚠️ **This finding closing does not make its sibling smaller: `red-decisions.md` RD-6 (the 60-second `secret` TTL) got STRONGER**, because a standing 90-day reach is not a per-authorisation one, and nobody has re-scored it |
| B-g | `createDocumentTypeVariant` | `DocumentType` has no variant concept at all (`docs/screen-pack-ledger.md:425-428`, ranked gap 9 at `:567`); G69 needs it and `docs/v1-trim-proposal.md:353` marks it *"a product judgement"*, unsigned |
| B-h | `authorHarness` | E6 — no `author_harness` verb; harness authoring borrows `author_procedure` (`model/agents.ts:514`, `docs/HANDOFF.md:873`) |
| B-i | Anything under `Ask` | G62 — zero contract operations exist and it is *"a whole contract tier"* (`docs/v1-trim-proposal.md:103`) |
| B-j | `createLegalHold` / `handleSubjectRequest` | `docs/contracts/README.md:97` — erasure can be *planned* and not executed; PDPA access and correction have no path. Also blocked on the thirteen retention windows, which are counsel's (`docs/HANDOFF.md:1513-1518`) |

**DERIVATION for Group A. DECISION for Group B.** Ten of the twenty-two rows
need somebody to choose. `docs/HANDOFF.md:1415-1422` is the standing rule: *"When
you defer a finding, write down whether it needs a decision or a derivation. If
it is a derivation, it is not deferrable."* Group A is not deferrable.

---

## B3 · BLOCKER · Definition versioning pins a NUMBER and stores no version content — G58's central promise is unbuildable as modelled

**What cannot be built, and why.** `Reconciliations.dc.html` promises *"saving
produces v5 and runs that used v4 keep pointing at v4, so a February finding is
still explicable by February's rules."* `docs/screen-pack-ledger.md:405-407`
calls this *"the cleanest model-to-screen agreement in the pack."* **It is not.**
`ReconciliationRun.definitionVersion` is a bare `number`
(`model/domain.ts:2518`), `Exception.definitionVersion` likewise
(`model/domain.ts:2757`), and `ReconciliationDefinition.version` is a `number`
on a single mutable row (`model/domain.ts:1999`). **There is no entity anywhere
in `model/` that holds the content of version 4.**

```bash
grep -rn 'Snapshot\|History\|previousVersion\|supersedes' model/domain.ts   # 0 hits
grep -rn 'export interface .*Version\b\|DefinitionVersion' model/*.ts       # 0 hits
```

The same defect is present twice more: `MatchRule.version`
(`model/domain.ts:1758`) carries a doc comment asserting the property —
*"an exception raised under v1 must remain explicable when the rule moves on.
`Exception.ruleVersion` pins it"* — and pins an integer against content that
nothing retains. `Procedure.version` (`model/domain.ts:3027`) is the third.

This is `docs/HANDOFF.md` §5.6 exactly — a control that passes while asserting
nothing — and it is invisible to `tsc` because nothing constructs a
`ReconciliationDefinition` (§5.10, `docs/HANDOFF.md:1216-1251`).

**It is worse than one missing snapshot: a run is not reproducible from its own
row at all.** `ReconciliationRun` (`model/domain.ts:2514-2535`) pins
`definitionVersion` and **nothing else version-shaped** — no `packVersion`, no
`policyVersion`, no `procedureVersion`, no `ruleVersion`, no `engineVersion`, and
no `installedPackId`. The other pins are scattered downstream onto records that
may not exist for a clean run: `Exception.ruleVersion` (`model/domain.ts:2755`),
`ExceptionResolution.authorisedByPolicyVersion` (`model/domain.ts:2676`),
`ProcedureStepExecution.procedureVersion` (`model/domain.ts:3129`),
`PolicyEvaluation.policyVersion` (`model/policy.ts:729`). The only place anything
snapshots what was in force wholesale is `UsageAttestation.packVersionsInForce`
(`model/billing.ts:695`) — **a billing record, and `@dropped-for-v1` under G36.**
So *"a February finding is still explicable by February's rules"* is not
answerable even in principle for a run that produced no exception.

Also absent: `DocumentType` (`model/domain.ts:1636`) and `FieldSpec`
(`model/domain.ts:1558`) carry **no `version` field at all**, and both are Tier 2
authoring surfaces under G58. `DocumentTypes.dc.html` is tagged *v2*.

**Why it is a BLOCKER rather than a defect.** It decides the schema. Versioned
rows, an append-only version table, or event-sourced definitions are three
different databases, and `docs/HANDOFF.md:944` records that forward-only
expand/contract migrations *"must be adopted before the first deployment or not
at all."* Choose wrong and the fix is a backfill of content that was never
written down.

**What must land first.** A decision on version storage shape, then the model
type, then A2 in B2's table. In that order.

**DECISION.**

---

## B4 · BLOCKER · Zero of the 36 capabilities has any wire representation, and there is no convention for one

**What cannot be built, and why.** Every operation in phase one has to gate on a
capability, and there is no place on the wire to say which. The authorisation
model in `model/access.ts` and `model/governance.ts` — 36 capabilities, 13
resource classes, the `CAPABILITY_RESOURCE_CLASS` join — is entirely invisible
to the contract layer.

**Evidence.**

- Extractor gap kind `capability_without_contract` = **36**, one per capability.
  The gap text is the finding: *"Named in `CAPABILITIES` and gated on by
  `decide()`, but no contract declares it as a requirement — there is no
  `x-capability`, `requiredCapability` or `capabilities` key in any of the three
  specs, and `security:` names an authentication scheme."*
- Every capability name greps to zero across `docs/contracts/`. The only
  capability *value* appearing anywhere is `admit_correspondence` as a `const` at
  `docs/contracts/control-plane.openapi.yaml:2031`.
- The contracts admit it in their own prose, twice:
  `docs/contracts/capability.openapi.yaml:2305-2306` and
  `docs/contracts/control-plane.openapi.yaml:2063-2064` — *"not one of the
  thirty-six capabilities appears in any contract file yet."*
- `CapabilityRequirement.capability` is `{ type: string }` in both copies —
  `docs/contracts/capability.openapi.yaml:2314`,
  `docs/contracts/control-plane.openapi.yaml:2071`.
- No OpenAPI specification extensions exist at all:
  `grep -rnE "^\s*x-[a-zA-Z-]+:" docs/contracts/*.yaml` → zero.
- `docs/HANDOFF.md:1489-1494` — *"a bundle naming `approve_resolutionn`
  validates and then matches no holder — failing closed, but silently."*

**What breaks first when a build starts.** In this order:

1. **The very first handler.** A developer writing `GET /exceptions`
   (`docs/contracts/capability.openapi.yaml:474`) has to decide what to check.
   The contract says nothing, so they read `model/access.ts` and hand-write
   `decide(ctx, 'view_exception')` at the call site. There are 65 such
   handlers. The capability-to-operation map is then **65 independent human
   judgements, recorded nowhere and checkable by nothing** — which is
   `docs/HANDOFF.md` §5.2's shape (an argument the callee could compute itself)
   scaled to the whole API.
   **And they have to pick between two different functions with nothing to guide
   them.** `decide(principal, capability): Decision` (`model/access.ts:1128`) is
   capability-only — it takes **no resource and no scope**. Reaching a specific
   record needs `authorize(principal, capability, request)`
   (`model/access.ts:1610`) plus `redeemAuthorization(grant, principal,
   capability, resource)` (`model/access.ts:1704`), which is the spine invariant
   10 rests on. **Nothing states which of the 65 operations needs which path**,
   and the cheap wrong answer — `decide()` everywhere — silently drops invariant
   10, because `authorize()` is the only thing that mints an
   `AuthorizationGrant` and `AuditEvent`/`DataAccessEvent`/`UsageRecord` all
   carry its id.
2. **The generated client.** Under G71 the frontend shares the types. It will
   generate from OpenAPI, get `capability: string`, and every capability check in
   the UI becomes a string literal that no compiler relates to `Capability`.
   G71's stated payoff — *"one TypeScript vocabulary spanning the wire collapses
   [§5.3] structurally rather than procedurally"* (`docs/HANDOFF.md:596`) — does
   not arrive for the one vocabulary that decides access.
3. **The access review.** Nobody can answer *"which operations can a role with
   `view_summary` reach?"* without reading 65 handlers.

**What must land first.** Two things, both derivations, neither deferrable:
publish `Capability` as an enumerated schema in the shared vocabulary (the
`errors.yaml` precedent — one file, referenced, never copied,
`docs/contracts/errors.yaml:14-15`), and adopt one `x-` extension naming the
required capability per operation. Then a checker (see B6) that fails when an
operation names a capability not in `CAPABILITIES`.

**DERIVATION.** The capability set is closed and already exists. Nothing here
needs a decision beyond the extension's name.

---

## B5 · BLOCKER · RLS is decided and its enforcement mechanism is specified nowhere — under G71 plus pooling it fails open

**What cannot be built, and why.** RLS was chosen over schema-per-tenant
(`docs/persistence-design.md:322`, re-recorded at
`docs/data-architecture.md:492`), with tenant scope from the session
(`docs/HANDOFF.md:348`). PostgreSQL RLS requires a per-transaction session
variable — `SET LOCAL app.tenant_id`, read by a policy via `current_setting()`.
**That mechanism appears nowhere in this repository.**

```bash
grep -rni 'set local\|current_setting\|pgbouncer\|rds proxy\|connection pool\|SET ROLE' \
  docs/*.md model/*.ts        # zero hits
```

The only place the mechanism is even alluded to is a **prose description in an
OpenAPI security scheme** — `docs/contracts/capability.openapi.yaml:2165-2166`:
*"Resolved by F1 into a TenantContext, which sets the row-level-security session
variable as a side effect."* The type it names does not exist
(`grep -rn 'TenantContext' model/*.ts` → 0), the function that would set it does
not exist, the variable is unnamed, and the pooling posture is undecided.

**Name the failure mode — it is specific and it is silent.**

Under G71 (`docs/HANDOFF.md:596`) the backend is Node. A Node service holds a
connection pool. RLS session variables are **connection state**, not request
state. Three concrete ways this fails, in descending likelihood:

1. **`SET` instead of `SET LOCAL`.** `SET app.tenant_id` persists for the life of
   the connection. Request A for tenant T sets it, finishes, returns the
   connection to the pool. Request B for tenant U is served on the same
   connection, and if any code path fails to set the variable — an error path, a
   read outside the request middleware, a background job — **it reads tenant T's
   rows under tenant U's session and RLS reports success.** Cross-tenant leak,
   no error, no audit anomaly, invariant 1 broken with a green test suite.
2. **`SET LOCAL` without an explicit transaction.** `SET LOCAL` outside a
   transaction block applies to the current statement only and is silently
   discarded. Every ORM/driver that autocommits (`pg` by default, Drizzle and
   Prisma outside `$transaction`) produces exactly this. The policy then
   evaluates `current_setting('app.tenant_id', true)` as NULL — and whether NULL
   denies or permits depends on how the policy was written, which nobody has
   written.
3. **Transaction pooling in front of the database.** If RDS Proxy or PgBouncer is
   configured in transaction mode — the default anyone reaches for with Aurora
   Serverless v2 (`docs/HANDOFF.md:371`) and Lambda — session-level state is not
   preserved between statements at all, and mode 1 and mode 2 both become
   guaranteed rather than probable.

> ✅ **ALL THREE LEAK MODES WERE ANSWERED ON 8 Aug 2026 — G98, G99, G100, G101.
> TAKEN, NOT APPLIED: there is still no schema, no migration and no connection
> string in this tree.** This finding's diagnosis is unchanged and is what the
> rulings were taken against; the three modes above are quoted verbatim in the
> G-rows, so **do not renumber or reflow lines 345–356.**
>
> | Leak mode | What closes it |
> |---|---|
> | **1 — `SET` instead of `SET LOCAL`** | **G101.** Every query sits inside an explicit `db.transaction()` carrying `SET LOCAL`, enforced by one function, `withTenantScope()`. Connection-lifetime state is never written |
> | **2 — `SET LOCAL` without an explicit transaction** | **G100 makes it survivable and G99 makes it guarded.** The policy **denies on NULL**, so a forgotten transaction yields an *empty result set* — loud, immediate, caught by the first test expecting a row — rather than a cross-tenant read RLS reports as success. ⚠️ G99 picks **Drizzle**, which this very paragraph names as an autocommit footgun; G99 quotes line 347 back and makes `withTenantScope()`'s explicit transaction **a named negative control, not a review convention** |
> | **3 — transaction pooling in front of the database** | **G101 assumes transaction-mode semantics from day one**, and phase one runs against a disposable Postgres with an in-process `pg.Pool` — **no AWS resource on the critical path**. The deciding argument is that `SET LOCAL` inside an explicit transaction is correct under **both** pooling modes, so it is the only posture the later deployment decision cannot invalidate. Session-mode was refused precisely because it lets the codebase pass under the forgiving configuration while the discipline rots |
>
> **The client is `pg` (G98)** — chosen because it exposes the backend PID, which
> is what lets item 4 below assert both queries ran on the **same** pooled
> connection rather than assuming it. ⚠️ **G98 and G99 were taken ahead of their
> own gate** — `docs/build-conventions.md:118` puts the client downstream of the
> pooler decision, which was still open — and G101 was taken afterwards to close
> it. Recorded as an ordering defect rather than smoothed over.
>
> **What this finding still owes, unchanged:** items 1–4 below are decided in
> shape and **written in none of them**. The negative test in item 4 remains the
> only artefact that can detect this class of failure at all.

The model itself concedes it cannot help: `model/access.ts:945-953` — *"a caller
that lifts either out of a payload has broken the invariant before this function
is reached, **and no check here can detect it**."*

**Aggravating factor.** The same design puts the plane split on database
**grants** (`docs/data-architecture.md:100-114`), which is genuinely strong. That
strength is likely to be read as covering the tenant boundary too. It does not:
`tenant_rw` reaches every tenant's rows and only RLS narrows it.

**What must land first.**

1. A written RLS contract: the exact variable name, `SET LOCAL` inside an
   explicit transaction, and a policy that **denies on NULL** rather than
   permitting. — ✅ **DECIDED by G100 (deny on NULL, plus a separate BYPASSRLS
   role for migrations rather than the table owner, because ownership carries
   DDL rights alongside the read exemption and there is no way to grant one
   without the other). NOT WRITTEN — no policy exists in this tree.**
2. A decision on the pooler and its mode, recorded, before the first connection
   string exists. — ✅ **DECIDED by G101: transaction-mode semantics from day
   one, no external pooler in phase one.** The requirement *"before the first
   connection string exists"* was met — there is still no connection string.
3. One function in application code that opens a scoped transaction, and a lint
   or architecture rule that no query may be issued outside it. This is the
   `PrincipalContext` argument (`model/access.ts:945`) applied at the driver.
4. A **negative** integration test: two tenants, one pooled connection, assert
   the second request sees zero rows of the first. Without this test the failure
   is undetectable by construction — which is the whole point of it.
   — ⚠️ **STILL OWED, and it is now the last thing standing between this
   finding and closure.** `pg` was chosen (G98) specifically so this test can
   assert both queries ran on the same backend PID. The runner it needs landed on
   8 Aug 2026 (`npm test`); the test has not been written.

~~**DECISION** on the pooler and the policy polarity; **DERIVATION** thereafter.~~
**Both DECISIONS are taken — G100 (polarity) and G101 (pooler and mode), 8 Aug
2026 — so this finding is now DERIVATION throughout. It is not closed: taken is
not applied, and item 4 is unwritten.**

---

## B6 · BLOCKER · There is no verification apparatus, and the toolchain that appears to exist is an untracked leftover

**What cannot be built, and why.** `docs/HANDOFF.md:271-276` states it plainly —
no test framework, no CI, nothing deployed. What is worse than that is what looks
like the opposite.

**Evidence.**

- ~~There is **no `package.json`** and **no `.github/`** at the repository root
  (`ls package.json` → no such file; `ls .github` → no such directory;
  `docs/HANDOFF.md:1570` confirms the second).~~

  > ⚠️ **HALF FALSE SINCE 8 Aug 2026, AND THE FALSE HALF IS THE ONE THIS FINDING
  > RESTED ON.** `package.json` **exists** and pins the toolchain exactly —
  > `typescript` 5.9.3 and `@types/node` 22.20.1 as devDependencies (G96), with
  > `typecheck`, `typecheck:tests`, `test`, `graph`, `check:counts`,
  > `check:citations` and an aggregate `check` script. **A fresh clone can now
  > typecheck this repository**, which was this finding's sharpest claim and is
  > no longer true. **`.github/` still does not exist** — the CI half stands.

  > ✅ **AND THE TEST RUNNER LANDED THE SAME DAY.** `npm test` is
  > `typecheck:tests && node --test`, and `tests/model/` holds two files:
  > `access-decide.test.ts`, the first behavioural assertion against `model/`,
  > and `runtime-importability.test.ts`, which asserts every module on disk loads
  > under node. **`model/` is runtime-importable** — three modules carried
  > extensionless value imports and could not be loaded at all before that
  > landed. ⚠️ **This does not soften B6's argument, it sharpens it**: that test
  > file records `CAPABILITIES.view_summary` (there is no such key) passing
  > `node --test` while failing `tsc`, which is exactly why `npm test` runs the
  > typecheck first. **A runner that only runs `node --test` is not a control.**
- ⚠️ **`docs/HANDOFF.md:280-283` is wrong.** It says *"There is no local `tsc` in
  this repository — again."* There is:
  `/Users/jrkphani/Projects/Reconcile/node_modules/.bin/tsc` reports
  **5.9.3** and typechecks `model/tsconfig.json` to `EXIT: 0` in place. The
  finding is not the correction — it is that **`node_modules/` is gitignored**
  (`.gitignore:6`, whose comment says it is *"a leftover tree from before the
  cut"*). So the only working compiler in this repository is 421 packages of a
  deleted application's dependency tree, present on exactly one machine.
  **A fresh `git clone` cannot typecheck this repository at all.** That is the
  entire verification surface resting on an artefact the repository disowns.
- A green `tsc` proves close to nothing here: `docs/HANDOFF.md:1216-1251` (§5.10)
  — five total records landed 7 Aug with **no construction site anywhere**;
  `docs/v1-trim-proposal.md:336` — *"a green `tsc` after applying any of this
  tells you nothing."*
- The extractor is blind by construction: `docs/HANDOFF.md:1398-1410` — it cannot
  see a union member, a `Record` re-key, a non-id-shaped column, a drop note, an
  exported type alias, an OpenAPI schema or an enum member.
- The strongest checks this project produces are thrown away every time:
  `docs/HANDOFF.md:1423-1430` — five steps, sixteen to twenty-two mechanical
  checks each, none committed.

**What a team would be unable to verify in phase one — concretely.**

| Cannot verify | Because |
|---|---|
| That an operation gates on the right capability | No capability on the wire (B4), no map, no checker |
| That tenant isolation holds | No RLS mechanism, no pooled negative test (B5) |
| That a wire schema still mirrors its model interface | The mirror checker is *"still owed"* — `docs/HANDOFF.md:952`, `:1538-1545`. It would catch `CapabilityRequirement`'s two money schemas **today** |
| That a `@dropped-for-v1` note is on the right declaration | Nothing can — `docs/HANDOFF.md:1431-1438` |
| That any total `Record` has correct **content** | No fixture constructs one — §5.10 |
| That a definition version is reconstructible | B3 — the content is not stored |
| That an invariant survived a change | Nine of the eleven have no executable enforcement at all; `resolveModel()` is the only one for invariant 7 and **two live fields bypass it** (`model/billing.ts:238` — ✅ correct; ~~`model/policy.ts:747`~~ → **`model/policy.ts:852`**, the `model_call` arm of `PolicySubject`, re-derived 8 Aug 2026 with `grep -rnE "\b(model\|modelId\|modelOverride)\s*\??:\s*string\b" model/*.ts \| grep -v '^\S*:[0-9]*: *\*'`, which returns five lines) |

**The minimum verification apparatus that must exist BEFORE code lands** — six
items, in order, and none is large:

1. ~~**A `package.json` and a pinned toolchain in the tree**, so the typecheck is
   reproducible on a clean clone.~~ ✅ **DONE 8 Aug 2026 — and in the shape this
   item asked for.** `package.json` pins `typescript` 5.9.3 and `@types/node`
   22.20.1 exactly, and `model/tsconfig.json` is untouched: it still has no
   `extends`, exactly as this item predicted was possible (`CLAUDE.md`: do not
   give it an `extends`). ⚠️ **G96 is the ruling that ended the one-dependency
   property, deliberately rather than by accident** — `node --test` strips types
   natively, but `tsc` over `tests/` emits `TS2307: Cannot find module
   'node:test'` without `@types/node`. The rejected alternative — a hand-written
   ambient `.d.ts` to keep the count at one — is preserved in G96: it asserts a
   shape of someone else's API nobody verified against their source.
2. **The fixtures pass in `model/examples.ts`** — `docs/HANDOFF.md:1526-1530`
   calls it *"the highest-value small item on this list"*. One fixture per total
   record witnesses all five at once. Cost: hours. Do it before the retype (S1),
   because the retype is the one change `tsc` will genuinely check and fixtures
   make it check harder.
3. **The model-versus-wire mirror checker in `tools/`** — the half of §8 item 5
   that is still owed. It fails the build when a model interface and its OpenAPI
   schema disagree, when a `$ref` dangles, or when an enum drifts.
4. **A capability-coverage checker** — every operation names a capability; every
   named capability is in `CAPABILITIES`; report operations with none. Depends
   on B4's convention.
5. **A test runner and one integration test: the pooled cross-tenant RLS test**
   from B5. This is the only test in phase one that can fail in a way nothing
   else can detect. — 🟡 **HALF DONE 8 Aug 2026. The runner exists; the test does
   not.** `npm test` runs `node --test` over `tests/`, and `tests/model/` holds
   two model-level tests. **The pooled cross-tenant RLS test — the half this item
   called irreplaceable — is still unwritten**, and G98 chose `pg` specifically
   so it can assert both queries ran on the same backend PID.
6. **CI, with a call site for `validateProcedureInjectionSafety()` and
   `validateAgentToolBindings()`.** Invariant 6 currently has one enforcement
   running instead of two (`docs/HANDOFF.md:1566-1572`). `CLAUDE.md`'s standing
   position — CI when application code lands — fires here by its own terms.
   — ✅ **DECIDED 8 Aug 2026 by G110, and it went FURTHER than this item asked.**
   This item asks for CI. G110 rules **both** call sites: CI validates every pack
   in the tree, **and** the control-plane publication path calls the same two
   functions and **refuses to publish** on violation. The argument: CI catches a
   pack an engineer commits, and only the publication seam catches a pack minted
   any other way — a control that exists only in CI stops existing the moment a
   pack arrives by another route, which is §5.1's shape. ⚠️ **The seam is partly
   blocked on `administration.openapi.yaml`, so CI lands first.** **TAKEN, NOT
   APPLIED — there is still no `.github/` on this branch.** ⚠️ Related: **G109**
   rules that `tools/` takes a real YAML parser, pinned exact, because a
   hand-parser that is subtly wrong yields *a checker that passes while asserting
   nothing* — §5.6 inside the tools written to catch it. That governs items 3
   and 4 above.

~~**DERIVATION.** All six. Not one of them needs a decision.~~ **Still DERIVATION,
and item 1 is now DONE while items 5 and 6 have rulings behind them (G96, G109,
G110). Four remain unbuilt.**

---

# SERIOUS

## S1 · SERIOUS · The money retype (G65/G66/G67) is cheap now and a migration + wire break later

**What breaks if it lands after application code.** Four things, and the third is
the expensive one.

1. **A database migration on every money column.** PostgreSQL `integer`/`bigint`
   is a table rewrite on 16 columns across the commercial and metering tables —
   the highest-volume tables in the design (`docs/persistence-design.md:208`).
   Landed before the first migration, it is a column type in a `CREATE TABLE`.
2. **A breaking wire change** on both existing contract files:
   `amountMinor: {type: integer}` → `{type: string, pattern: '^-?[0-9]+$'}`
   (`docs/HANDOFF.md:590`, `docs/v1-trim-proposal.md:321`). After a client
   exists, that is a versioned API break for a product with no versioning story.
3. **`JSON.stringify` throws on `bigint`.** G71 records this as *a feature*
   (`docs/HANDOFF.md:596`) — it forces the string-on-wire decision at the
   boundary. It is a feature **before** there are serialisation sites and a
   crash-on-first-invoice **after**. Every handler, every log line, every test
   fixture that stringifies a money-bearing object is a site.
4. **G67's parse-and-convert function.** `docs/HANDOFF.md:592` is explicit:
   *"unless **exactly one** function parses and converts… Land that function in
   the same commit or this becomes the defect it resembles."* Once *n* call sites
   parse the decimal string themselves, consolidating them is a hunt, not a
   commit.

**The current state is worse than "not done" — the two wire copies are mutually
invalid today.**

| | Schema | Required | Exponent |
|---|---|---|---|
| `docs/contracts/capability.openapi.yaml:2370-2384` | `Money` | `[currency, amountMinor, exponent]` (`:2378`) | **yes**, `:2382` |
| `docs/contracts/control-plane.openapi.yaml:2085-2093` | `MoneyAmount` | `[currency, amountMinor]` (`:2088`) | **no** |

Both are `additionalProperties: false`. The **same logical field** —
`CapabilityRequirement.appliesAtOrAboveValue` — points at `Money` in one file
(`:2324`) and `MoneyAmount` in the other (`:2081`). A payload valid against one
is **rejected** by the other. The control-plane copy, the only contract crossing
an account boundary, cannot distinguish JPY from SGD.

In the model: `Money` at `model/domain.ts:372` (currency + `amountMinor` +
**`exponent`**), `MoneyAmount` at `model/policy.ts:148` (currency +
`amountMinor`, **no exponent**), `grep -rn bigint model/*.ts` → **0**.

⚠️ **The record's "~40 sites" is prose, and the derived number is much smaller —
which makes the case for doing it now stronger, not weaker.**
`docs/v1-trim-proposal.md:106` says *"~40 sites, 2 contract files"*. Derived
against the tree: **17 minor-unit declaration sites**, of which **10 sit on
`@dropped-for-v1` types**, leaving **7 live declarations** —
`model/domain.ts:376`, `model/domain.ts:1749` (`Tolerance.minorUnits`),
`model/policy.ts:151`, `model/billing.ts:329`,
`model/catalog.ts:100,101,103,104` — plus **3 literal construction sites**
(`model/access.ts:698` in `DENY_ALL`, `model/examples.ts:310`, `:351`) and **4
comparison sites** (`model/access.ts:1314,1368,2022`, `model/learning.ts:365`).
Ten edits in `model/`, four lines in the contracts. `model/tsconfig.json` targets
**ES2022**, so `bigint` literals need no compiler-option change.

⚠️ **Those same three literals are the ENTIRE compile-time witness surface for
the retype.** Nothing else in `model/` constructs a money value. §5.10 again: the
compiler will confirm the shape and nothing will confirm the content. Do the
fixtures pass (B6 item 2) **before** the retype so the retype is actually checked.

⚠️ **`Money` and `MoneyAmount` have disjoint consumer sets, which is why the
divergence has survived.** `Money` is the *authorisation* currency —
`AssignmentScope.valueCeiling` (`model/access.ts:673`),
`CapabilityRequirement.appliesAtOrAboveValue` (`model/access.ts:845`),
`Exception.valueAtRisk` (`model/domain.ts:2780`),
`ProposedTransaction.value` (`model/domain.ts:3492`). `MoneyAmount` is the
*billing* currency — `AutonomyConfig.autoResolveValueCeiling`
(`model/policy.ts:137`), `ApprovalConfig.mandatoryAtOrAboveValue`
(`model/policy.ts:196`), `Budget.limit` (`model/billing.ts:388`). They **never
meet in a signature**, so no compiler error has ever forced the question — and
`model/learning.ts:365` compares `a.exponent !== b.exponent`, a comparison the
billing side structurally cannot make. The operator-proposal path is the first
thing that must satisfy both (`docs/HANDOFF.md:1077-1086`), and it is in v1.

**What must land first.** The retype as **one commit**, before any handler, per
`docs/v1-trim-proposal.md:314` — *"a partial money retype is worse than none"* —
and with G67's single conversion function in the same commit. It is sign-off item
3 (`docs/v1-trim-proposal.md:349`) and **is not signed off**.

**DECISION** (sign-off), then **DERIVATION**.

---

## S2 · SERIOUS · No canonicalisation scheme is applied, and the first audit write is irreversible

`AuditEvent` and `DataAccessEvent` are hash-chained
(`model/governance.ts:906,934`). Invariant 10 makes an act with no authorisation
*unrecordable*, so **the first write path in phase one produces a chained
record**. G20 chose RFC 8785 / JCS and it is **not applied**
(`docs/HANDOFF.md:545`, `:1547-1553`). E4 is *"the oldest item in the record with
a hard deadline"* (`docs/HANDOFF.md:1654-1656`) because re-canonicalising means
re-chaining the history the chain exists to protect.

**What must land first.** Apply G20 before the first `AuditEvent` is written.
Blocked by nothing. **DERIVATION.**

---

## S3 · SERIOUS · G50/G59/G70 put a platform tier in v1 and it has no taxonomy, no screen, no contract and in places no capability

G50 puts the control plane in v1 — model catalogue, pack and policy publication,
tenant provisioning, grant issuance (`docs/HANDOFF.md:575`). All 12 existing
control-plane operations are **data-plane-initiated pulls**
(`docs/contracts/control-plane.openapi.yaml:198-787`); nothing creates a tenant,
publishes a pack version or issues a grant. G59 moves sources and connections to
the FDE (`:584`); G70 makes Quick Suite account-per-tenant and thereby
reintroduces per-tenant provisioning — *"the operational shape G36 deferred to
v1+1"* (`:595`).

`docs/screen-pack-ledger.md:696-722` — **0/18 screens are a platform surface**,
and G28 (the fourth axis) is *"action on the design team"* that *"has not moved"*
(`docs/HANDOFF.md:553`). G49 additionally records that **no capability names the
act of setting a model**, and argues it is `authority`, not `configuration`
(`docs/HANDOFF.md:574`).

**What must land first.** A decision on whether the FDE gets a designed surface
or a runbook plus an internal API (`docs/screen-pack-ledger.md:717-722` — *"it is
a decision, and it has not been taken"*), and a capability for FDE model
selection. **DECISION.**

---

## S4 · SERIOUS · G62 makes `Ask` v1 and G45 a prerequisite; both are unbuilt and one is a whole contract tier

`Ask` ships as drawn — persistent sessions with citations, ad-hoc query, pin-to-
report, four actions — and has **zero contract operations today**
(`docs/HANDOFF.md:587`). It also moves G45 (the Dual LLM reader/proposer split)
from later hardening to a **v1 prerequisite**, because the chatbot reads live
foreign-system text and proposes ledger writes in the same turn. G45 is *"the
only decided-but-unbuilt control"* (`docs/HANDOFF.md:1472-1482`) and R1/R5 remain
open (`docs/HANDOFF.md:903,906`). `Ask.dc.html`'s status bar asserts the
containment property G45 would provide — `docs/screen-pack-ledger.md:598-601`.

The seam with Quick Suite's own natural-language querying is **not settled**
(`docs/HANDOFF.md:587`).

**What must land first.** The Quick Suite / `Ask` seam decision, then G45's
second agent definition and emit rule, then the tier. **DECISION** then
**DERIVATION**.

---

## S5 · SERIOUS · The error taxonomy is incomplete by its own admission, and one member still names a deleted concept

`docs/contracts/errors.yaml` holds **87** codes. ⚠️ **THIS READ *"`:61-139` holds
71 codes"* UNTIL 23 Aug 2026 AND BOTH HALVES WENT WRONG IN THE SAME COMMIT** —
the session tier (#230/#231) inserted sixteen members alphabetically, so the
count moved AND the range now ends at `:155`, while `:61-139` still resolves and
`npm run check:citations` stayed EXIT 0 across it. That is the resolving-but-wrong
class, produced here by the very edit that invalidated it, and it is why the
range is replaced with a derivation:
`awk 'NR>68 && /^        - /' docs/contracts/errors.yaml | wc -l`.
The file itself records at
`:22-27` that roughly **23 further members** are required — org resolution,
notification, support authorisation, the inverted egress polarity, the two new
resource classes, the commercial floors — plus one rename,
`export_class_excluded` → `export_class_not_permitted`, whose current
name encodes the polarity pass D inverted. ⚠️ **That rename's `(:95)` citation is
removed rather than re-pointed for the same reason**; derive it with
`grep -n 'export_class_excluded' docs/contracts/errors.yaml`. **The sixteen the
session tier added are NOT part of the 23 this paragraph forecasts** — they
mirror three model refusal vocabularies by exact name, and the forecast's
subjects are untouched. `docs/HANDOFF.md:934-937` records that
adding a code later means shipping an engine release before a newly-learned
failure can be diagnosed.

`errors.yaml:73` is `admission_role_insufficient` — **it still names a role**,
after `RoleKey` was deleted and `minimumRoleToAdmit` became `capabilityToAdmit`
(`docs/HANDOFF.md:818-834`). That is §5.3's shape surviving the migration that
was supposed to close it.

**And there is no capability-denied code at all.** The nearest members are
`policy_denied` (`:112`) and the export-scoped `export_forbidden_by_policy`
(`:97`). Phase one's most common failure — *you hold no capability for this* —
has no code, which under a restrictive `SpanAttributePolicy` means it has no
diagnostic channel (`errors.yaml:29-33`).

**What must land first.** Extend the enum before the first handler returns a
`Problem`. **DERIVATION** for the capability code and the rename; **DECISION**
for exhaustiveness sign-off.

---

## S6 · SERIOUS · `costCentre` versus `costCenter`, on an authorisation join

`UsageRecord.costCenter` is American; `AssignmentScope.costCentres`,
`CardFilter.costCentres` and `Exception.costCentre` are British
(`docs/HANDOFF.md:927-933`). The join is an **authorisation decision**. The
rename spans two model modules and two contract files and *"needs its own
commit"* — explicitly **not folded into** the money retype
(`docs/v1-trim-proposal.md:325-327`).

Cheap now; after the schema it is a column rename with data in it. **DERIVATION.**

---

## S7 · SERIOUS · The scope dimension that decides who sees an exception is representable and unenforced

E2 landed the columns — `TagPolicy.legalEntityKey` (`model/domain.ts:1542`),
`Exception.costCentre` / `.legalEntity` — but `docs/HANDOFF.md:869` and `:916-926`
record that **nothing reads either column**, the at-raise-time resolver from
`TagPolicy` is unwritten, and the null-excludes rule rests on SQL's
`NULL IN (…)` semantics rather than on any function. The warning is specific:
*"A hand-built matcher in application code that reads null as 'unscoped'
reverses it and would look entirely reasonable doing so."*

The exception queue is Tier 1 and is in the first slice. This is the exact place
that reversal gets written.

**What must land first.** The resolver, plus a fixture that asserts a null does
**not** satisfy a narrowing. **DERIVATION.**

---

## S8 · SERIOUS · `docs/persistence-design.md` is stale in a way that will mislead the schema author

It is the document `docs/HANDOFF.md:1503-1504` sends the schema author to, and
`docs/persistence-design.md:321` still says *"`RetentionPolicy` needs five more
classes **before any of this is implementable as specified**"* — a blocker that
was closed on 7 Aug when deltas 2 and 3 landed (`docs/HANDOFF.md:781-782`,
`:945`). It carries no staleness banner, unlike the nine HTML visuals. A schema
author reading it top-to-bottom will conclude the work is blocked when it is not,
or trust its other unrevised statements.

**What must land first.** A dated banner, per the standing practice
(`docs/HANDOFF.md:1367-1373`). **DERIVATION.**

---

## S9 · SERIOUS · The tolerance a finance owner authors admits a float for money, guarded by a comment

`Tolerance` is a union (`model/domain.ts:1741`) whose members include
`{ kind: 'absolute'; value: number }` (`:1742`) and
`{ kind: 'money'; value: Money }` (`:1747`). `model/domain.ts:1746` says
*"Currency-aware absolute tolerance. Use instead of 'absolute' for money."* —
**a comment, not a constraint.**
Nothing in the type system stops `{ kind: 'absolute', value: 0.1 }` landing on a
monetary tolerance.

This is not hypothetical scope. G58 puts tolerance authoring in the hands of
finance, monthly (`docs/HANDOFF.md:583`;
`docs/screen-pack-ledger.md:395`, `:402` — `configure_tolerance`), and a
tolerance is the number that decides whether a mismatch becomes an exception.
It is the same class as `docs/HANDOFF.md` §5.7 (arithmetic that silently assumes
one unit) sitting on the one field the product's premise rests on.

`Tolerance` also carries a third minor-unit field the retype must not miss —
`{ kind: 'rounding'; minorUnits: number }` at `model/domain.ts:1749`.

**What must land first.** Either the authoring operation rejects `absolute` for a
monetary field, or `Tolerance` loses the free `absolute` arm for money-typed
columns. Cheapest before the authoring contract is written. **DERIVATION.**

---

## S10 · SERIOUS · G71's payoff is compile-time only — there is no runtime validation boundary and nothing derives one

G71's argument is that one TypeScript vocabulary spanning the wire *"collapses
[the two-vocabularies defect class] structurally rather than procedurally"*
(`docs/HANDOFF.md:596`). **At runtime it collapses nothing**, because everything
in `model/` erases.

The model carries **zero** persistence or serialisation mapping — no decorators
(`erasableSyntaxOnly` forbids them, `model/tsconfig.json`), no ORM import, no
`zod`/`io-ts`/`superstruct`, no `toJSON`/`fromJSON`, no schema derivation. The
only structural discipline is `interface TenantScoped { tenantId: TenantId }`
(`model/kernel.ts:438`) and the branded `Id<'…'>` aliases, **both fully erased**.
A branded id is a `string` at runtime; a request body claiming
`{"definitionId": "anything"}` satisfies every type in the model.

So every one of the 65 operations needs a hand-written request validator, and
nothing derives it from either the model or the OpenAPI schema. That is the
`ErrorCode` divergence (`docs/HANDOFF.md:1063-1068`) waiting to happen a third
time, one layer lower — three vocabularies now: the TypeScript interface, the
OpenAPI schema, and the validator.

**What must land first.** A decision on where the runtime boundary lives —
generate validators from OpenAPI, or declare them from `model/` — taken once,
before the first handler. Then the mirror checker (B6 item 3) has two artefacts
to compare instead of three. **DECISION**, then **DERIVATION**.

---

# NOTED

- **N1 · `ModelCatalogEntry.provider` admits `'other'`, which G54 makes
  unreachable** — `model/catalog.ts:120`, `docs/HANDOFF.md:579`. Closing it to
  `'bedrock' | 'sagemaker'` is *"a derivation, not a decision"* and is sign-off
  item 6 (`docs/v1-trim-proposal.md:352`). A value set admitting something no
  decision permits is §5.6's shape.
- **N2 · G53/G69 bind IDP to Textract (plus SageMaker) against screens built on
  handwritten Mandarin dockets**, unverified in `ap-southeast-1`
  (`docs/screen-pack-ledger.md:644-654`, `docs/HANDOFF.md:578,594`). *"Checkable
  in an afternoon and has not been checked."* A screen premise the chosen service
  cannot meet is the most expensive gap there is, and this one is cheap either
  way.
- **N3 · `Timestamp = string` is a naked alias in `model/kernel.ts`**
  (`docs/HANDOFF.md:701-710`). Every audit and chain record carries one. Branding
  it is a sweep with its own call-site audit and is cheapest before there are
  call sites.
- **N4 · G70's account-per-tenant Quick Suite reintroduces per-tenant
  provisioning into a v1 that dropped `deployment.ts` whole**
  (`docs/HANDOFF.md:595`) — *"cost floor per tenant rises materially and is
  uncosted"*, and the module that models fleets and liveness is dropped. Sign-off
  item 8 (`docs/v1-trim-proposal.md:354`) asks whether `deployment.ts` needs a
  partial restore, and it is unanswered. Also unverified: Quick Suite's RLS and
  namespace model, and `ap-southeast-1` availability
  (`docs/v1-trim-proposal.md:361-363`).
- **N5 · Invariant 7 has two live bypasses and phase one will write to both.**
  `UsageRecord.model` (`model/billing.ts:238`) — invariant 5's own record — and
  `PolicySubject` `model_call.model` (`model/policy.ts:747`) reach a model
  without passing `resolveModel()`, the only executable residency check in the
  codebase (`CLAUDE.md`, "On invariant 7"; `docs/HANDOFF.md:872`). Metering is in
  the first slice by construction.
- **N6 · `CLAUDE.md`'s own landmark citations are stale, and this costs
  navigation time on day one.** `CAPABILITY_RESOURCE_CLASS` is at
  **`model/access.ts:517`**, not `:426` as `CLAUDE.md` states twice.
  `ACCESS_RESOURCE_CLASSES` is at **`model/governance.ts:141`**, not `:113`.
  `CLAUDE.md`'s reproduce-block is dated at `571e7c26`; `HEAD` is `fe19f95b`.
  This is `docs/HANDOFF.md` §5.11 recurring in the file that catalogues it — the
  counts are derived and the **line numbers are not**, and
  `tools/check-doc-counts.mjs` explicitly *"checks numbers only — it cannot
  see… a wrong `file:line` citation"* (`docs/HANDOFF.md:752-754`). A citation
  checker is a small extension of a tool that already exists.
- **N7 · `view_dashboard` and `view_summary` are live capabilities whose entire
  noun is dropped.** `model/access.ts:255` and `:290` versus `presentation.ts`,
  dropped whole. G68 records the consequences and does not fix them
  (`docs/HANDOFF.md:593`) — *"verbs with no noun, the exact problem the module
  was written to fix"*, a dashboard read that cannot be recorded as a
  `DataAccessEvent` so invariant 10 does not reach it, and a QuickSight SPICE
  dataset that is a copy of tenant data **outside our erasure plan**. The third
  is a v1 compliance gap, not a v1+1 one, and it is sign-off item 5
  (`docs/v1-trim-proposal.md:351`), unsigned.
- **N8 · `AccessSession.id` is an unbranded `string`**
  (`model/governance.ts:808`) while every peer entity carries an `Id<'…'>`. It is
  the record of staff access to a tenant. Cheapest to brand before there are rows.

---

# §S · Sequencing — is there ANY vertical slice that can go first?

**No. Not one.**

This is the most useful finding in this document, so it is stated without
hedging. Every candidate first slice requires **at least four** of the six
blockers to land before its first line of code compiles into something that can
be run and judged.

**Test the candidates.**

| Candidate slice | Blocked by |
|---|---|
| **"Just render the exception queue"** — `listExceptions`, `getException` | B1 (no session → no tenant scope → no query), B4 (no capability on `view_exception`, and `decide()` versus `authorize()` unstated), B5 (no RLS mechanism → the query is unsafe or unwritten), B6 (nothing can verify either), S7 (the scope dimensions the queue must honour are unenforced), S10 (no validation boundary) |
| **"Just author one definition"** — G58's Tier 2 Save | B1, B2 (no operation exists), B3 (version storage undecided), B4, B5, B6, S9 (the tolerance type admits a float for money), S10 |
| **"Just ingest a document and run a reconciliation"** | B1, B4, B5, B6, plus S2 (the run writes `AuditEvent`, which is chained, and canonicalisation is unpicked) and N5 (the run meters, and metering is a residency bypass) |
| **"Just the FDE control plane"** — G50 | S3 (no taxonomy, no screen, no contract, no capability for model selection), B2 (the operations belong in a file that does not exist), B1 (an FDE also needs a session) |
| **"Just `Ask`"** — G62 | S4 (whole tier absent, G45 unbuilt), B1, B4, B5 |
| **"Just the schema"** | B3 (version storage shape decides the tables), B5 (RLS policy shape decides every table), S1 (money column types), plus counsel on thirteen retention windows (`docs/HANDOFF.md:1513-1518`) |

**Why there is no honest way around this.** The blockers are not features that a
slice can stub — they are the substrate every slice sits on. Session establishes
tenant scope; tenant scope is what RLS enforces; capability is what every
operation gates on; the money type is in the wire schema of both existing
contracts; the version shape decides the schema. A slice that stubs any of them
is a slice whose main risk is untested, which makes it a demo of the parts that
were never in doubt.

**What the first phase actually is, if the answer is no.** It is a **foundation
phase with no user-visible slice in it**, and it should be planned and sold as
one. Three to four weeks of work that produces: a session, a scoped transaction,
a capability convention on the wire, a validation boundary, one money type, a
versioning decision, a fixtures pass and two checkers. Then — and only then — the
first vertical slice, which should be **the exception queue read path**, because
it exercises session → RLS → capability → scope in one request and has the
narrowest surface of any candidate.

Planning it as "we'll do the queue first and fix the rest as we go" produces the
outcome this repository has already catalogued twice: a rule keyed on a
convenient landmark (§5.1), and 65 handlers each reasoning independently about
authorisation (§5.2).

---

# The minimum that must exist before the first line of application code

Hard, ordered. Each item is blocked by the ones above it and by nothing else.

**Decisions — these are not engineering's to take, and everything waits on them.**

1. **Where session establishment terminates** — IdP-fronted edge or an operation
   in this API surface. (B1)
2. **Definition version storage shape** — versioned rows, append-only version
   table, or event-sourced. Decides the schema. (B3)
3. ~~**The pooler and its mode**, and whether the RLS policy denies on NULL. (B5)~~
   ✅ **TAKEN 8 Aug 2026 — G101** (transaction-mode semantics from day one, no
   external pooler in phase one, in-process `pg.Pool` against a disposable
   Postgres) **and G100** (the policy denies on NULL; migrations run as a named
   BYPASSRLS role, not the table owner). **Taken, not applied.**
4. **Sign-off on `docs/v1-trim-proposal.md` §5**, at minimum items ~~1 (`secret`
   into `CONTRACT_ONLY_RESOURCES`)~~, 3 (the money retype), 6 (close `provider`)
   and 7 (`DocumentType` variants). ~~Items 1 and 7 gate contract operations.~~
   ✅ **Item 1 is SIGNED OFF — G75, 8 Aug 2026 — and NOT as written here.** The
   owner took `PERMITTED_RESOURCES.delivery` (`model/governance.ts:474`), not
   `CONTRACT_ONLY_RESOURCES`, which remains `['authority']` (`:512`). The
   `CONTRACT_ONLY_RESOURCES` shape was the written recommendation and was
   **overruled**; it is left above, struck, as the losing case. **Item 1 no
   longer gates a contract operation. Item 7 still does**, and items 3 and 6
   remain unsigned. ⚠️ **G111 rules one money codec** and **G112 rules that a
   retype follows the TYPE** — both bear on item 3 and neither is applied.
5. **Whether the FDE gets a designed surface or a runbook plus an internal API.**
   (S3, G28)
5a. **Where the runtime validation boundary lives** — generated from OpenAPI, or
   declared from `model/`. Types erase; nothing validates today. (S10)
6. **The thirteen retention windows and the per-jurisdiction statutory floor
   map** — counsel's, and they block the schema, not merely the retention table.
   (`docs/HANDOFF.md:1513-1518`)

**Derivations — no decision needed, and none is deferrable.**

7. ~~**A `package.json` with a pinned TypeScript**, so a clean clone can typecheck.
   The current compiler is an untracked leftover.~~ ✅ **DONE 8 Aug 2026.** (B6)
   `package.json` pins `typescript` 5.9.3 and `@types/node` 22.20.1 (G96) and
   carries the `check` aggregate. `model/tsconfig.json` still has no `extends`.
8. **The fixtures pass in `model/examples.ts`** — one fixture per total record.
   (B6, §5.10)
9. **Apply G20 (RFC 8785 / JCS)** before the first `AuditEvent` is written.
   Irreversible after. (S2)
10. **The money retype as one commit** — `MoneyAmount` deleted, `bigint`, both
    contract files, and G67's single parse-and-convert function in the same
    commit. (S1)
11. **`Capability` published as an enumerated schema in the shared vocabulary,
    plus an `x-` extension naming the required capability per operation.** (B4)
12. **A `Session` / `TenantContext` type in `model/`**, with the
    `IdentityConnection` → `OrgClass` derivation, feeding `PrincipalContext`.
    (B1)
13. **The scoped-transaction helper and the rule that no query may be issued
    outside it.** (B5) — ✅ **SHAPE DECIDED 8 Aug 2026: `withTenantScope()`,
    opening an explicit `db.transaction()` carrying `SET LOCAL` (G99, G101).**
    ⚠️ G99 picks **Drizzle**, which B5 names as an autocommit footgun, so the
    explicit transaction is **a named negative control, not a review
    convention**. **Not written.**
14. **`administration.openapi.yaml`, Group A only** — the twelve operations in
    B2 that are derivable today. Group B waits on items 1–6. (B2)
15. **The model-versus-wire mirror checker and the capability-coverage checker in
    `tools/`.** (B6)
16. **A test runner and exactly one test: two tenants, one pooled connection,
    assert isolation.** (B5, B6) — 🟡 **HALF DONE 8 Aug 2026: the runner landed
    (`npm test`), the pooled two-tenant test did not.** `pg` was chosen (G98)
    so this test can assert both queries ran on the same backend PID.
17. **CI, with a call site for `validateProcedureInjectionSafety()` and
    `validateAgentToolBindings()`.** (B6) — ✅ **RULED BY G110, and BROADER than
    this item: CI *and* a publication seam that refuses.** CI lands first; the
    seam is partly blocked on `administration.openapi.yaml`. **Taken, not
    applied — there is still no `.github/`.**
18. **`costCentre` / `costCenter` rename, its own commit.** (S6)
19. **Extend `errors.yaml`** with a capability-denied code and the
    `export_class_excluded` rename. (S5)
20. **Close the monetary `Tolerance` hole** before the authoring contract is
    written. (S9)

Items 7–10 can run in parallel with the decisions. Items 11–20 cannot start
until 1–5a are answered.

> ⚠️ **THAT LAST SENTENCE IS THE ONE TO RE-READ AFTER 8 Aug 2026.** Decisions 3
> and 4-item-1 are taken (G100/G101, G75) and item 7 is done, so the gate has
> moved — but **decisions 1, 2, 5, 5a and 6 are still open**, and item 16's test,
> the only artefact that can detect B5's failure class, is still unwritten.
> **Taken is not applied.** Eighteen rulings were taken on 8 Aug 2026 and almost
> none of them is applied to `model/` or to any code, because there is no code.

---

## One sentence for whoever schedules this

**The first phase is not a feature; it is a foundation, and it should be planned
as three to four weeks that produce nothing a customer can see.** Six decisions
are outstanding, three of them not engineering's to take, and every candidate
first slice sits on at least four unbuilt substrate pieces. A plan that opens
with "build the exception queue" will produce a queue whose session, isolation,
authorisation and money handling were each decided by whoever happened to write
that handler.

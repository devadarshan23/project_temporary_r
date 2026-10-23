# Hierarchies, Cross-Pack Access, and Agents as Principals

> **STATUS:** PARTIALLY APPLIED
> **V1 AUTHORITY:** PARTIAL — the authority for the access model's *shape*; not a statement of what v1 builds.
> **Applied:** the resource-class axis and the capability-to-class map (§11), the `authorize()` / `redeemAuthorization()` spine, `AssignmentScope`'s sixth dimension, and `Solution` as a scope that may never be granted. **Not applied:** the `OrgClass` axis and federation (§8–§10) — the file's own header says the proposals below are *"recorded and not yet implemented"*, and that is still true of most of §8–§10. ⚠️ **Read §11 before touching `model/access.ts` or `model/governance.ts`.** Its counts are corrected in place rather than rewritten — derive them with `node tools/check-doc-counts.mjs --derive` rather than reading one from the prose. ⚠️ **Invariant 8 has been amended TWICE since this was written** (G60, then G75 on 8 Aug): a staff grant now reaches `secret`. Any sentence here that says otherwise is superseded by `docs/HANDOFF.md` §3 pass H.
> *Banner added 8 Aug 2026.*

> **Status:** design record. 5 Aug 2026.
> **Provenance:** four agents — one red team on the access model, one green team
> on hierarchy and pack policy, one green team on agent principals, one industry
> study (§7, returned last and sourced against primary documents). Applied fixes
> are in the commits; the proposals below are recorded and **not yet
> implemented**.
>
> **§11 (5 Aug, evening) adds the fourth axis — resource class.** It changes
> three counts asserted throughout §1–§10: **thirteen** resource classes, not
> four *(**sixteen from 1 Oct 2026** — R10, the owner's: `deal`, `sandbox` and
> `partner_staff`, a partner firm's own surface)*; **fifty-one** capabilities —
> ⚠️ *it said **forty-four** until 4 Oct 2026, correct for its day; the fifty-first
> is `view_run` (G3881, the owner's G3802 ruling: run reads carried by
> `view_exception`, in no partner scope)* — not thirty-one *(**fifty from 1 Oct 2026** — R10's six partner-only verbs, answered
> on `decide()`'s fifth arm; thirty-seven from 7 Aug —
> §11.9a; **thirty-nine from 16 Aug 2026** — G173's `admit_source` and PR #194's
> `view_endpoint`, which arrived on different branches and were each recorded as
> "the thirty-eighth" before either could see the other; **forty-four from
> 19 Sep 2026** — G601's five for the PLATFORM's own surface, which widen the
> ROSTER and widen no tenant's reach, because `decide()` refuses every one of
> them on the customer and partner arms at their first line)*; **six** scope
> dimensions,
> not five. Superseded claims are marked in place rather than rewritten.

---

## 1. Six hierarchies collapse to two mechanisms

The green team and an independent prior reached the same conclusion.

| Called "hierarchy" | Verdict |
|---|---|
| Cost-centre tree · legal-entity tree | **Real. One mechanism**, a `ScopeHierarchy` over an existing scope dimension — because these are the only two of the six dimensions whose *values the platform does not define* — and, per §11.10, the only two that bind on **nothing**. `domains` is a closed four; `definitionIds` are peers; `valueCeiling` is a scalar that carries its own order. |
| Approval chains by threshold | **Real, and not a tree.** An ordered ladder of `CapabilityRequirement`s. Threshold selects which rungs *bind*; dwell time selects which rung is *notified*. One list, two readers. |
| Account → Tenant | **Exists, unchanged.** Cascades commercial identity and never capability. |
| Org / reporting lines | **Collapsed.** No source of truth — it comes from an HRIS we do not integrate with and goes stale between reorgs. It resolves to a *person* who may not hold the capability, so it must be intersected with capability anyway, which means the `CapabilityRequirement` was doing the work. Its only real use is *who to nag*, and that is `TenantContact` and the `sponsor` class. |
| Role inheritance | **Refused.** See §4. |

### The rule the whole design is an instance of

> **Narrowing is automatic. Widening is an act.**

It already governs `recommendAutonomyCeiling()` (narrow on thin evidence, widen only on thick) and `purgeVerdict()` (hold > minimum > erasure). Hierarchy produces three more instances, and all three fail identically without it — **someone gains authority as a side effect of an administrative act nobody reviewed as a grant**:

- a subsidiary incorporated in September falls under a group approver granted in March;
- an administrator re-parents a node *under* a node someone already holds;
- a pack upgrade adds a capability to a live role.

The mechanism is a version pin. `ScopeNode.coveredFromVersion` records the version at which a node's **current position** was established — set on insert *and* on re-parent, which is what makes the second case land in the same net as the first. `RoleAssignment.hierarchyPins` records what the grant was made against. Cascade covers a descendant only where the node's position predates the pin.

### A hole this exposed

~~**`AssignmentScope.legalEntities` is unenforceable today.** Verified: no subject in the model carries a legal entity, and `TagPolicy` names only `chargebackKey`. The dimension has nothing to match against. `TagPolicy.legalEntityKey` is the prerequisite, not an extra.~~

**✅ CLOSED 7 Aug 2026, and the prerequisite reading was right.** `TagPolicy.legalEntityKey` was added first, then `Exception.legalEntity` and `Exception.costCentre` alongside it — see §11.10. Left struck through rather than deleted because the *shape* of the finding is the reusable part: a scope dimension whose values the platform does not define is unenforceable until something projects those values onto the row being scoped, and that is true of any future dimension of the same kind. **Representable is not enforced** — nothing yet reads either column.

---

## 2. Deny is not representable — the load-bearing refusal

> **Superseded by §8.6 — read that first.** This section is true of the capability
> read path and false of the system: twelve negative predicates exist across four
> layers, three of them explicit deny lists. §8.6 records the decision (invert the
> three, document the nine) and the replacement claim. Left in place because the
> reasoning below is still the reason the *replacement* holds.

The read path is a **pure existential over positive authorities**, which makes it monotone: adding an authority never removes access.

That single property removes allow-versus-deny precedence from the system entirely — there is nothing to specify, get wrong, or explain to an auditor. Everything prohibitive lives on the **write** path (`canGrant`, separation constraints) or is expressed by narrowing a scope. Nothing is enforced by a rule the read path must remember to consult.

---

## 3. Agents hold no roles

Three agents converged on this from different mandates. The argument that settles it is **lifetime**.

A role is *standing and per-principal*. A `ProcedureStep.toolScope` is *per-step, per-run, and signed inside a pack that `validateProcedureInjectionSafety` gated*. Granting an agent a role converts a bounded capability into an unbounded one — while touching none of the four controls the posture record names as the answer, because **the injection validator tests procedures, not principals.** A role-holding agent is never probed.

It would also be a **second autonomy engine**: `AutonomyConfig.permittedActions` is `AgentAction[]`, `Role.capabilities` is `Capability[]` — two vocabularies, partially overlapping, different owners, no stated precedence.

### What replaces it

A **derived, non-durable grant**, minted per step execution and dying with it. Named by `(tenantId, runId, procedureId@version, stepId, stepExecutionId, modelId)`. Never a row anyone administers.

```
capabilities = DELEGABLE_TO_AGENT            platform clamp, not tenant-negotiable
             ∩ step.requiredCapabilities     what the authored step declares it NEEDS
             ∩ delegator.capabilities        what the invoker actually holds, now

scope        = narrowest(delegator.scope, step.scope)
```

`effectivePartnerCapabilities()` generalises exactly, and for the reason it generalises: **a mask composes with any role a pack invents, where a ceiling only works on a totally ordered set.** Agent authority has the partner shape — a principal operating inside someone else's authority, under a bounded grant, that must never become the deciding authority.

Three properties beyond the intersection:

- **A reference, not a bearer token.** The runtime presents a grant *id*; F13 loads the row and evaluates that. Nothing the runtime asserts about its own authority is read — which is the entire reason F13 exists as a separate component.
- **Siblings mint independently from the root**, not from each other. Chaining peers would ratchet authority down a long procedure for no security reason, and would let step *n* poison step *n+1*.
- **Validity is evaluated, never asserted.** A revoked assignment or a disabled policy stops live grants on the next call. A fired employee's in-flight agents stop.

### The delegator is usually not a person

`RunTrigger` is `manual | scheduled | ingest | source_signal | rerun` — four of five have no human at the moment of action. So `DelegationSource = user | policy`, and the policy case reuses the chain that already exists: `ExceptionResolution.mode: 'autonomous'` terminates accountability in `authorisedByPolicyId` and thus in `Policy.createdBy`.

---

## 4. What was deliberately refused

| Refused | Why |
|---|---|
| **Role inheritance** | Buys a shorter capability list; costs diamond resolution, invisible widening by editing a distant parent, and an intractable upgrade story when pack A's role extends pack B's. And "senior" almost always means **scope** — a higher ceiling, a wider entity set — which is already expressible and is the truer model. Roles are cheap rows; an inheritance graph is a permanent tax. |
| **A durable agent registry** | Every durable agent identity is a standing credential and a second surface authority is composed on. An agent is a step in a graph, so creating one already crosses all six authoring gates; a registry gives it a second creation path that crosses none. **⚠️ Partly overtaken — `model/agents.ts:713` is a durable, tenant-scoped `AgentDefinition`.** The refusal held on the premise that *durable ⇒ principal*, and `agents.ts` separates the two: a definition is a **configured artefact**, never a principal, and `AGENTS_HOLD_ROLES = false` is unchanged. The second creation path the refusal feared is real and is closed explicitly — `AgentProvenance` discriminates pack-shipped (the signed step, a read-only projection) from tenant-authored (crossed no gate, so `validateAgentDefinition()` demands a validator stamp and a passed injection gate). Editing a pack agent's harness **converts it to tenant-authored** (`agents.ts:628`). Read `agents.ts:29–75` before reinstating this row. |
| **`RoleAssignment` rows for agents** | Puts agents in the table humans are administered from, making `manage_roles` a path to widening an agent — the confused deputy pointed the other way. |
| **A general delegation graph** | The three delegation cases are distinguishable *because* the procedure graph is authored and signed ahead of time. A runtime graph replaces "the plan cannot change" — the strongest property the architecture has — with "the plan can change, but only in ways we hope are narrowing." |
| **Deny rules** | See §2. |
| **A dimension registry** | A blank-canvas relationship engine with a respectable name. |
| **DAGs / multi-parent trees** | With two parents, expansion order becomes observable and *"why does she have access"* becomes a path-finding answer rather than a lookup — the one shape an auditor cannot use. A matrix org gets two assignments. |
| **An account-level access role** | It would be a **second cross-tenant read path**, and worse than the partner one: `PartnerAccessGrant` is explicit, expiring and customer-granted, while an account node has no grant type and no `AuditActor` variant — it would record as an ordinary tenant user. |
| **Agent trust levels as a runtime authority input** | Measured good behaviour becoming permission is the shape `recommendAutonomyCeiling()` already refuses on purpose. |
| **"Auto-approve unless a human objects"** | Approval by an agent wearing a timeout. `MIN_DECISION_SECONDS` exists because the model already knows a fast decision is a warning, not a reassurance. |

---

## 5. Applied 5 Aug

- `execute_resolution` and `close_exception` added to `CAPABILITIES`. `AgentAction` named both and neither had a verb, so `AutonomyConfig.permittedActions` could permit the two acts that change the ledger while the capability layer had nothing to gate them with.
- `AuditActor` gains an `agent` variant carrying step, execution, model and delegator inline. Agent reads audited as `{ kind: 'system' }` and could not be attributed to a delegation.
- `ApprovalConfig.segregationOfDuties` flagged as **vacuous against an agent proposer** — `approver !== proposer` is trivially true against `ProposalActor.agent`, so the flag reads satisfied while asserting nothing. A control that always passes is a false assurance, which is worse than a missing one. Not fixed: both candidate fixes (bind to the delegating user, or to the autonomy policy's author) are decisions rather than edits.
- Earlier the same day: scope polarity inverted to fail closed, `effectiveScopeFor()`, `canGrant()`, role versioning, pack-namespaced role keys, `ProposalActor.agent.onBehalfOf`.

## 6. Recorded, not implemented

`ScopeHierarchy` · `ApprovalLadder` · `SeparationConfig` as an eighth policy kind · `PolicyApplicability` with a closed floor-rule list · `RoleTemplate` on `SolutionPack` · `AgentGrant` · `ProcedureStepExecution` · `ResolutionExecutor`.

Three more from §7, all of which stop being free once a pack ships to a tenant: a **re-consent gate** on pack upgrades that widen a role (§7.4a), a **tenant-side capability mask** over pack roles (§7.4b), and folding scope into a single `decide()` (§7.4c).

> **Three of these landed on 5 Aug and are no longer recorded-only:**
> `ProcedureStepExecution` (`model/domain.ts:2451`), `AgentGrant` — shipped as
> `DerivedAgentGrant` with `mintAgentGrant()` (`model/agents.ts:1223`,
> `model/agents.ts:1268`) — and the fold into a single `decide()`
> (`model/access.ts:985`), which §7.4c asked for. The remainder of this list
> stands.

**`ProcedureStepExecution` is the one to build first.** Two independent reviews found it separately: the exception-slice green team ("nothing holds where an exception is inside a procedure") and the agency green team ("nothing records that a procedure step ran"). Without it, `step_not_current`, every timeout, `awaitingReply`, and the entire delegation chain are unimplementable — and the only place the answer might live is `TraceRef`, which points into a store `TelemetryPolicy` is explicitly designed to strip.

---

## 7. The industry study

Sourced against primary documents — RFCs and IETF drafts, NIST and IIA publications, and vendor documentation — rather than summaries. Where a claim could not be traced to a primary source it is marked *not established* below and should not be repeated as fact.

### 7.1 The scope invariant has a name and a 2010 citation

`AssignmentScope` narrowing and never widening is **role-centric RBAC-A**, named in Kuhn, Coyne & Weil, *Adding Attributes to Role-Based Access Control*, IEEE Computer 43(6), June 2010: attribute constraints "can only reduce permissions available to the user, not expand them", giving "the intersection of P and R". The same rule is visible in shipping products, in their own words:

| System | Wording |
|---|---|
| Azure RBAC + conditions | a condition "filters down permissions… **You cannot explicitly deny** access to specific resources using conditions" |
| AWS SCPs | "**No permissions are granted by an SCP**… the logical intersection" |
| SpiceDB, OpenFGA | caveats / conditions gate a relationship; they never add one |
| Snowflake | row and masking policies filter *inside* objects roles already reach |

Two things follow. **The design's shape is orthodox and now citable** — worth stating in `access.ts` as a named position rather than a local invention. And **a "deny" scope dimension should be refused permanently**: §2 already refuses it on the monotonicity argument, and Azure independently refuses to let customers author deny assignments at all.

### 7.2 Two closed sets — keep them, and the vendors say why

`Capability` closed and the scope dimensions closed (five when this was written; six since §11.8) is the call the ReBAC vendors defend in their own docs. AuthZed: "**Static attribute data should always be modeled in the schema**", caveats only for request-time data, and using them for static data "can have negative performance impacts". OpenFGA caps CEL evaluation cost at 100 — and, decisively for reviewability, "**the Expand API does not consider conditions**", meaning *who can reach this* stops being answerable. NIST SP 800-162 warns enterprise ABAC "can become complex".

Worth making explicit in the model: **five of the six dimensions are static** (`domains`, `definitionIds`, `solutionIds`, `costCentres`, `legalEntities`) and correctly live in the grant; only `valueCeiling` is request-time. That is exactly the split AuthZed prescribes, arrived at independently.

### 7.3 Having no role hierarchy is a position, not a gap

Every system surveyed caps inheritance depth at a small integer — AWS 5 OU levels, Azure 6 management-group levels, SpiceDB 50 hops with **no cycle detector** (the same error fires for a cycle and for merely-deep nesting), OpenFGA a configurable node limit. Zanzibar's own answer to deep graphs was to build Leopard, a second, *eventually consistent* index that "cannot do so at a fresh and consistent snapshot".

Salesforce is the empirical case for the other road: hierarchy, materialised into sharing rows, and the documented failure family that follows — ownership data skew past 10,000 records, group-membership table locking during role changes, asynchronous recalculation that emails you when it finishes.

§4 refused role inheritance on cost-of-ownership grounds. The study does not add an argument; it adds evidence that nobody who took the other road got it cheaply.

### 7.4 Three findings that contradict the current model

**(a) No re-consent gate when a pack upgrade widens a role.** `Role.capabilities` is mutable across pack versions and `RoleAssignment` holds only a `roleId` — so a pack upgrade silently widens live authority. That is the *one* platform in six that does not hold: Salesforce, which needed to invent muting permission sets afterwards to make it survivable. The other five hold. Atlassian: "a new major version won't be applied to a site until its admin consents", and **adding a scope forces a major version**. GitHub: unapproved widening means "their installation will continue to use the old permissions". Shopify prompts on next open; Slack requires re-running OAuth; Entra re-prompts per permission. **Narrowing is gated nowhere, by anyone.**

This is *"narrowing is automatic, widening is an act"* — §1's own rule — applied to the one case §1 lists third and the model does not yet implement. The gate belongs on the pack install record, held until a tenant admin with `manage_roles` approves.

**(b) No subtraction primitive for pack-shipped roles.** `Role.origin: 'pack'` is not tenant-editable, and `RoleAssignment.scope` narrows *scope*, not *capabilities*. A tenant objecting to one capability inside a pack role has no move short of not assigning the role. This is precisely the pre-muting Salesforce state, and Salesforce is the only surveyed platform that unions vendor-authored permission objects into a customer's RBAC — so it is the only one that hit this, and it did. A tenant-side capability mask composes with `effectivePartnerCapabilities()`'s existing intersect discipline.

**(c) `assignmentGrants()` deliberately answers half the question.** "Scope is checked by the caller against the subject at hand" splits one decision across two components, which is the structural precondition for a confused deputy. AuthZEN's framing is the sharpest statement of the risk: "a non-deterministic system acting on a user's behalf, with implicitly delegated access, is exactly the setup that produces confused-deputy failures." MCP's response to the same shape was to make audience validation a **MUST** on the server rather than a caller responsibility. A single `decide(subject, capability, resource)` that takes scope cannot be forgotten at a call site; the two-halves API will be, once.

### 7.5 Agents — the model is right, and the reason is stronger than the one recorded

§3 refuses agent roles on a **lifetime** argument. The industry adds two independent confirmations and one sharpening.

AWS names the alternative as an anti-pattern in its Well-Architected Agentic AI Lens (AGENTSEC03): delegated access implemented "by having the agent **assume a user's role** rather than carrying user context as signed token claims… **collapses the audit trail** and gives the agent the user's full permission set for the duration of the session." That is `RoleAssignment.userId` for an agent, described exactly.

The standards line is RFC 8693 §1.1: under impersonation the agent "is indistinguishable from B"; under delegation "principal A still has its own identity separate from B". One rule from it is routinely got wrong and worth writing down — **a delegation chain is an audit artefact, not a permission source**: "the consumer of a token MUST only consider the token's top-level claims and the party identified as the current actor… Prior actors identified by any nested `act` claims are informational only and are not to be considered in access control decisions." §3's "siblings mint independently from the root" is the same rule.

The **dominant industry answer is "both, structurally separated"** — a distinct agent principal *and* a recorded human it acts for. Microsoft Entra Agent ID (GA April 2026) documents autonomous and delegated access as separate modes and records the agent's creator as its **sponsor**; IETF `draft-klrc-aiagent-auth` requires exactly one WIMSE identifier per agent plus the delegated subject in `sub`. §3's derived grant is named by a tuple including `modelId` and carries `DelegationSource` — the same shape, minted per step rather than standing, which is the *stricter* choice.

Two drafts argue for per-task, expiring, cascade-revocable authority and are worth tracking because the model already has both ingredients (`definitionIds` is an instance binding, `expiresAt` is the expiry): `draft-sato-soos-mjwt` — "A Child Mandate **MUST be a strict subset** of its parent Mandate in every authorization dimension", and revoking a parent revokes children — and `draft-ietf-oauth-transaction-tokens`, where the TTS "MUST ensure that the requested `scope`… is equal or less than" the original. Both are the narrowing law, arrived at independently, in a different community.

**Genuinely unsettled, and not to be presented otherwise:** whether an agent identity is a distinct principal *type* or a flavour of workload identity — sources split, and the IETF WIMSE charter does not mention AI agents at all — and whether standing agent authority or per-task mandates win. The OpenID Foundation's October 2025 whitepaper lists agent-centric identity among open problems rather than settling it.

One empirical note against trusting the model layer to hold any of this: NIST CAISI, using an enhanced AgentDojo, reports agent-hijacking success rising from an 11% baseline to **81%** under novel red-team attacks, and from 57% on a single attempt to **80%** across 25 attempts. Enforcement outside the model is the only thing that holds.

### 7.6 Naming — take two of the three renames, drop the third

The proposal pending since the naming discussion was `creator → author`, `maintainer → administrator`, `consumer → operator`, `oversight → assurance`. Tested against the ITIL 4 Foundation Glossary, COBIT 2019, TOGAF's 22 stakeholder types, NIST SP 800-37r2's 22 roles, and the IIA Three Lines Model:

| Change | Verdict | Evidence |
|---|---|---|
| `maintainer → administrator` | **Adopt** | NIST SP 800-37r2 defines System Administrator as "setting up and **maintaining** a system" — the exact job. `maintainer` scores **zero** across all five frameworks; it is open-source vocabulary. Gloss it so it does not read as root. |
| `oversight → assurance` | **Adopt**, for a financial-services audience | IIA, Basel, OCC, MAS and ISACA all use it for independent non-operating verification, and COBIT names an objective **MEA04 Managed Assurance**. Conditional: only if the class means *verifies without operating*. If it ever means *the body that accepts accountability*, the IIA's word is `oversight`. |
| `creator → author` | **Adopt**, weakly | No candidate is framework vocabulary — `creator`, `author`, `producer` and `steward` all score zero. `author` wins on having no collision: `producer` collides with Kafka's producer/consumer idiom, `creator` with Tableau's paid-seat site role, and `steward` is well-defined (NIST, DAMA) but means *accountable for content quality over time*, not *the person who made this* — a category error. |
| `consumer → operator` | **Reject** | `operator` has **zero** presence in ITIL 4, COBIT 2019, TOGAF's stakeholder taxonomy or NIST's 22 roles, and in any technical room means a Kubernetes controller — "Operators are **software** extensions to Kubernetes". The word with two framework definitions is **`user`**: ITIL 4 "A person who uses services", NIST "System User". The doc comment "the exception queue is their screen" describes a user. |

Two structural problems the study surfaced that no rename fixes:

- **`consumer` and `sponsor` cannot be peers if ITIL is the reference.** ITIL 4 makes *service consumer* the umbrella that splits into **customer / user / sponsor** — so `consumer` **contains** `sponsor`. An ITIL-literate reviewer reads the five-class set as mis-nested. Renaming `consumer → user` happens to resolve this, which is a second reason to prefer it.
- **`sponsor` does not mean "accountable, not operating" in any framework checked.** ITIL: "authorizes **budget**". COBIT: sign-off. TOGAF: project executive. ICH-GCP: owner of the entire trial. The framework words for outcome-accountability are ITIL's **customer** ("takes responsibility for the outcomes") and RACI's **Accountable**. The doc comment "the CFO who owns the close" describes an ITIL *customer*, not a sponsor. Worth noting on the other side: Microsoft already uses `sponsor` for exactly the accountable-human-behind-an-agent role in Copilot Studio, which argues for keeping the word in that narrower sense.

**Not established:** `distinctHolders` — four-eyes expressed as a count of distinct holders on a capability requirement — has **no standard, framework or platform precedent** that the study could find. The nearest live work is AuthZEN's ARAP profile, still a Working Group Draft. It is a good idea; claim it as a design decision, never as industry practice.

### 7.7 The standards-versus-vendor line — *(§8 records the decisions taken against all of this)*

Worth keeping straight, because it determines what can be cited in a customer conversation. **Standards:** ANSI/INCITS 359 (RBAC), NIST SP 800-162 (ABAC), XACML's PDP/PEP architecture, RFC 8693 (delegation), RFC 6749 §3.3 — which blesses *clamping* a granted scope below what was requested. **Vendor product decisions, not standards:** userset rewrites, guardrail-not-grant SCPs, Azure's 4,000-assignment ceiling, materialised sharing rows, Kubernetes' purely-additive-no-deny. And **holding-until-re-consent — the §7.4(a) recommendation — is invention**, not standardised: "incremental authorization" appears nowhere in RFC 6749. It is near-universal practice and still a design choice we would be making.

---

## 8. Decisions, 5 Aug 2026

Eight open questions, put to the product owner one at a time after the org-axis
and policy-document work (four agents: two building, two attacking). Recorded
with what *follows* from each, including the parts that are not free. **Decided,
not yet implemented.**

### 8.1 Stakeholder classes are renamed

`author · administrator · user · sponsor · assurance`

Three of the four renames carry framework backing: NIST SP 800-37r2 defines
System Administrator as "setting up and **maintaining** a system"; ITIL 4 and NIST
both define `user`; the IIA, Basel, OCC, MAS and ISACA all use `assurance` for
independent non-operating verification, and COBIT names an objective **MEA04
Managed Assurance**. `author` wins on absence of collisions rather than on
backing — no candidate is framework vocabulary, and `producer`, `creator` and
`steward` each collide.

**`operator` was rejected outright.** Zero presence across ITIL 4, COBIT 2019,
TOGAF's 22 stakeholder types and NIST's 22 roles — and in any technical room an
Operator is a Kubernetes controller.

**Left open deliberately.** `sponsor` means *budget authority* in every framework
checked, not accountability, and ITIL nests it **inside** service consumer
alongside `user`. So `sponsor` and `user` are still peers in a set where the
reference standard says one contains the other. Not resolved; recorded so nobody
later mistakes it for an oversight.

### 8.2 Customers author values, never expressions

The permission document is a **serialised projection** — generated, signed,
versioned; types remain the source of truth; there is no parser that admits a
hand-written document as an authority. Customer authoring is a **form over the
closed schema**: they fill slots a pack defined, and never write a condition, a
rule or a document.

This follows the two designs in the research corpus that avoid the vendor/tenant
merge rather than solving it — AVP's frozen template skeleton (*effect, principal
and resource cannot change once instances exist*) and Kubernetes'
definition/parameters/binding split, where **vendor and tenant never write the
same object**. The value vocabulary already exists: `CapabilityRequirement`,
`AssignmentScope`'s five closed dimensions, `Money` ceilings, `distinctHolders`.

**Consequence.** This closes the red team's strongest counter-argument — that a
projection defers the authoring question and gets retrofitted badly — by
answering it now rather than deferring it. The administration tier the contracts
review found missing (*"none is administration"*)
is a **form surface**, not a policy-authoring surface.

> **Correction, 5 Aug.** That review is quoted elsewhere as *"all 62 operations
> are runtime"*, and I repeated it. The count is wrong: verified by
> `grep -c 'operationId:'` it is **65 operations across 62 paths** — three
> capability paths carry two methods. `docs/HANDOFF.md:69` has it right;
> `docs/contracts/README.md:79` conflates paths with operations. The finding is
> unaffected — none of the 65 is administration — but the number should not
> propagate further.

### 8.3 Organisation is derived from the identity provider

> **Revised by §8.9, and it is the revision that makes this decision work.**
> As taken, this could not be implemented: `IdentityProvider` was a two-member
> union (`'cognito' | 'entra_1cloudhub'`), so partner and customer users were
> both `cognito` and the derivation collapsed the two org classes it exists to
> separate. §8.9 replaces the *kind* of provider with a registered *connection*
> that has an owner, and org derives from `connection.owner`. Read §8.9 first.

No `UserAffiliation` entity. `User.identityProvider` already implies the
employer, and `entra_1cloudhub` is what `isStaff: boolean` currently stands in
for. Someone who leaves the partner loses the directory and therefore loses the
org, with nobody remembering to update a row.

**The cost, and how it is paid.** An IdP knows who someone is *now*; an audit
needs who they were *then*. Left alone, every historic approval would be
retrospectively attributed to the actor's current employer — wrong in exactly the
cases that matter. It closes **without a new entity** because
`AuditActor.partner_staff` already carries `partnerId` **inline**, on the stated
principle that a row must reach its authority without traversing a mutable table.
Stamp the org onto the event at write time and March's approval stays attributed
to who she was in March.

> **This promotes `AuditEvent.actorUserId → AuditActor` from tidy to
> load-bearing.** Without it, 8.3 genuinely loses history. With it, reads *and*
> writes become attributable to an organisation — today only reads are.

Second consequence: the IdP becomes load-bearing for an authorisation decision,
so an IdP misconfiguration is an authorisation bug. Named, accepted.

### 8.4 Notifications carry content, and become a first-class read

The digest is a read, so it acquires everything a read has: masked by org, scoped
on all six dimensions, classified per channel, audited as a `DataAccessEvent`,
and residency-checked.

**This falsifies a claim currently in `access.ts`** — that a sponsor
"legitimately holds zero capabilities and resolves to a notification binding
instead." Once the binding is authorised like any other read, a recipient holding
zero capabilities receives nothing. The sponsor class needs at least one read
capability or the digest is empty. **The notification stops being an alternative
to capability and becomes governed by it.**

Two things this closes that were not the question asked. The partner × sponsor
hole: an account manager under `commercial_only` has mask `[]`, holds nothing,
passes everything, and could have been put on an exception digest carrying
counterparty names and amounts. And **email is an egress that crosses a border** —
invariant 7 says residency survives inference, and a digest to a CFO's mailbox is
a sink with a `DataClass` ceiling. Nobody has costed that.

### 8.5 Support access is pre-authorised at contract time

The customer authorises incident access **once, at signing** — purpose, resource
classes, max hours, who may invoke, notification path. Each incident self-issues
against that entitlement. Nobody is woken at 03:00.

This is the standing constraint stated in July — *"I do not want to be waiting on
a customer internal process to have access to the environment either for
troubleshooting or completing delivery work"* — reconciled with *being staff is
not access*, by moving consent to the moment the customer is actually reading. A
per-incident approval at 3am is theatre: nobody reads it, they click yes. And a
control people route around is worse than a looser one they use, because it moves
the activity somewhere unobservable — under BYOA, to the customer's own console,
where the model never sees it.

**The shape already exists in the model.** A standing authorisation that
per-incident grants draw against, where withdrawal stops future draws without
killing live ones, is `EntitlementLease` — which states its own limit in the same
terms: *"the guarantee is 'no more than the ceiling, and not past expiry', not
'stops on command'."* Reuse, not a new mechanism.

**`MAX_GRANT_HOURS` becomes a negotiated per-customer value**, not a platform
constant — and it has to start being *read*, since it currently has zero call
sites, as does the cap on cumulative `AccessExtension`.

### 8.6 Invert three deny lists; document the nine that remain

`neverExport` → `exportable`. `neverAutonomousIn` → `autonomousIn`.
`blockInOutput` → `permitInOutput`. (`redactInInput` is unaffected — redaction
transforms, it does not prohibit.)

The polarity change is the prize, not the tidiness: `neverExport: []` denies
nothing and is **permissive**; `exportable: []` allows nothing and is
**restrictive**. A freshly constructed config, a failed lookup and a defensive
`catch` currently all fail *open*. This repo already made exactly this fix once —
`AssignmentScope` went from `T[] | null` (null meaning unrestricted) to
`{kind:'all'} | {kind:'these'}` — and the policy config never got the same
treatment.

The other nine are **liveness, not prohibition**: status fields, `expiresAt`,
`revokedAt`. They are the absence of a live authority, which is the distinction
the design record already draws for break-glass revocation.

So §2's claim is replaced, and gets sharper rather than longer:

> **Every prohibition is either a narrowing or the removal of an authority. There
> are no rules that subtract from a live grant.**

Defensible, checkable, and true once the inversion lands — where *"deny is not
representable"* was true of one function and false of the system.

Writing this down surfaces one bug immediately: **`User.status: 'disabled'` is
consulted by nothing.** `assignmentGrants()` takes no `User`, so a disabled
user's assignments still evaluate as granted, and `canGrant()` will accept a
disabled granter. That bug was invisible *because* the claim was stated loosely —
"deny is not representable" tells a reader there is nothing to check.

### 8.7 `authority` splits out of `configuration` — and then splits again

> ⚠️ **The count here is superseded — read §11.2 before quoting it.**
> `ACCESS_RESOURCE_CLASSES` is now **thirteen** members
> (`model/governance.ts:141`), `sample_data` has been **removed** as a class
> (§11.3), and `configure_telemetry` — cited below as a `configuration`
> capability — was moved to `authority` on the same argument this section makes
> (`model/access.ts:472`). The reasoning in this section is unchanged and is what
> §11 generalises; only the arithmetic is stale.

`ACCESS_RESOURCE_CLASSES` gains **two** members, not one.

**`authority`** — the autonomy envelope, roles, user administration.
Reachable **only where the contract pre-authorises it**, consistent with 8.5: the
standing entitlement already names resource classes, so this is one more line in
it, negotiated per customer and visible in the paperwork rather than hard-coded.
A lean customer who wants 1CloudHub to run it authorises it; a regulated customer
with its own security function withholds it.

**`statutory`** — `place_legal_hold`, `handle_subject_request`. In **neither**
permitted list, ever, at any price. These are not the customer's to delegate: the
obligation sits with the controller regardless of what a contract says, so a
customer purporting to authorise 1CloudHub to answer their data-subject requests
may simply lack the standing to do it.

What this closes: the verified contradiction where `governance.ts:89` defines
`configuration` as including "policies" and `PERMITTED_RESOURCES.delivery`
includes `configuration` — so a 90-day delivery grant that provably cannot read
tenant data could rewrite `AutonomyConfig`, `DataEgressConfig.allowedDestinations`
and `CorrespondenceConfig`, the rules deciding who reaches tenant data and where
it is sent. And `manage_roles` under a delivery grant, which lets an FDE mint a
role and leave the grant model entirely.

**Cost:** onboarding needs a propose-and-approve path that does not exist. §14.7
already says an FDE may *propose* the initial autonomy setting and only a tenant
role may *own* it — the doc and the code disagreed, and until now the code won.

### 8.8 Partner commercial visibility, split by arrangement

**Decided:** drop the blanket restriction — a partner may see wholesale.
**Revised on inspection:** the decision means opposite things in the two billing
arrangements, and applying it uniformly is what produced the contradiction
between `billing.ts` and `observability.ts` in the first place.

#### The leak is the pair, not either half

    spend  =  Σ_meters  price(volume_m)

Three quantities; any two give the third.

| Disclosed alone | Reveals |
|---|---|
| **Rate** | A price list. 1CloudHub's commercial posture, this customer's discount. Nothing about the customer's operations. |
| **Spend** | A scalar. Nearly inert. |
| **Volume** | Invoice counts, close cadence, exception rates — *how bad their data is*. **The actual sensitive quantity.** |
| **Spend + Rate** | → volume. The inversion. |

So "may they see the rate" is close to a red herring. The customer's exposure is
**volume**; spend is a lossy encoding of it that becomes lossless once you hold
the rate card. The rule that follows is sharper than either module's:

> **Disclose at most one of {spend, rate} at any given granularity.**

#### The premise `observability.ts` rests on is false for the case it matters in

Its stated rationale: *"given a wholesale rate card **(which the partner
necessarily holds, being the party billed)**, per-tenant money divides back into
document counts…"*

That parenthesis carries the argument, and it is only true for a **reseller**.
`RateCard`'s own comment: *"the WHOLESALE card 1CloudHub charges the partner, and
the RETAIL card the partner charges its customer."* Under
`invoice_end_customer` — the commission case, the one `commission_only` exists
for — **1CloudHub bills the customer directly and the partner is not the party
billed.** They do not hold the card by necessity.

| | Reseller (`invoice_partner`) | Commission (`invoice_end_customer`) |
|---|---|---|
| Holds the wholesale card | **Necessarily** — it is their invoice | **No** |
| Volume visibility | **Inherent** to reselling | **A choice we make** |
| Stripping counts | Theatre | Actually protects something |

`PartnerHealthView` strips counts uniformly. For a reseller that is pointless —
they can already invert. For a commission partner it was load-bearing, and
disclosing wholesale is exactly what unlocks the inversion.

**So the two modules were never simply unreconciled. Each is right about a
different arrangement.**

#### What follows

1. **Split the verdict by `PartnerBillingArrangement`,** not by a single
   `commission_only` value. For a reseller, volume visibility is **inherent** and
   belongs in the *customer's* contract as a disclosure — not in the model as a
   control it cannot enforce. For a commission partner it is ours to set.
2. **The commission basis is the lever, and it is commercial rather than
   technical.** A fixed per-tenant fee needs only tenant count and active status
   — *no spend at all*. A banded fee needs the band. Only a revenue share needs
   the base, and therefore the volume. **Choosing the basis before terms harden
   removes the problem instead of mitigating it.** Afterwards it is not a design
   choice any more.
3. **Attestation is the middle path, and the machinery exists.**
   `UsageAttestation` is already signed and hash-chained. The same shape gives a
   partner a *verifiable* commission figure without the underlying detail —
   1CloudHub signs "your commission for period P is X"; a dispute opens the base
   under a grant. Verify without seeing.
4. **Set a granularity floor.** `PartnerHealthView` carries `windowFrom` /
   `windowTo` with **no floor**. The type says of `active`: *"Whether the tenant
   is transacting at all — a boolean, never a number."* But **a boolean sampled
   hourly for a month is a 720-bit volume proxy.** The carefully-excluded counts
   walk back in through time resolution. Either a minimum window, or `active`
   becomes a band over the period rather than a sampled boolean.
5. **Set a cohort floor.** `PartnerBillingSummary` carries `tenantCount` and a
   partner-level `wholesale`. At `tenantCount: 1` the aggregate **is** the
   per-tenant line. Aggregation is not a control below a cohort size, and the
   field to test is already in the type.
6. **`openSupportItems: number` breaks its own type's rule.** A raw count inside
   a type whose comment says counts are excluded on purpose. Its justification —
   *"the partner is often the actor"* — holds when the partner raised the ticket
   and fails when 1CloudHub or the customer did. Support volume correlates with
   usage volume.

#### Two things that must change with the decision

- **The comment is now false.** `partnerCommercialVisibility()` documents
  `commission_only` as *"commission only, **never the customer's rate**."* A
  reader trusts a comment. Rewrite it, and rename or re-specify the verdict —
  with wholesale visible it no longer names what distinguishes it from
  `wholesale_and_own_retail`.
- **Keep spend and rate distinct on any revisit.** Whether a partner sees
  *spend* is not the same question as whether they see the *rate*. Volume is
  arguably the account manager's to know. A customer's negotiated price is a
  different thing, and the two got conflated because one field carries both.

---

### What these eight change about the build order

§6's order stands, with three promotions:

- **`AuditEvent.actorUserId → AuditActor`** moves up. 8.3 depends on it for
  history; without it, deriving org from the IdP silently rewrites the past.
- **The `SignedPolicyBundle` typing** is unaffected and still first — it is a
  current bug, independent of every decision here.
- **`User.status` into `decide()`** is new, surfaced by 8.6.

And three new pieces of work that did not exist before: the contract-time
**support entitlement** (8.5), the **notification read path** with its five
obligations (8.4), and the **propose-and-approve** path for autonomy that 8.7
makes necessary.


---

## 9. Federation — bringing the customer's and the partner's own IdP

> **Status:** decided 5 Aug 2026, after the stress test. Not implemented.
> **Supersedes the mechanism of §8.3**, not its intent.

### 9.1 Why this is not a feature request

Verified across `model/` and `docs/contracts/`: **zero occurrences of SAML, OIDC,
SSO, federation or SCIM.** `identityProvider` is referenced exactly once — its
own declaration. There is no federation story at all.

For a product sold to finance, KYC and credit teams that is not a gap in the
model; it is the first question procurement asks. Nobody in that market accepts a
vendor-hosted password pool for their own staff.

### 9.2 The type shift is kind → instance

This is why the old shape could not carry an organisation:

```ts
IdentityProvider = 'cognito' | 'entra_1cloudhub'   // a KIND of provider
```

A kind cannot identify an organisation, because every customer shares `cognito`.
What is needed is a registered **connection** — an instance, owned by somebody:

```ts
export interface IdentityConnection {
  id: string
  protocol: 'saml' | 'oidc' | 'cognito_pool'
  /**
   * WHO THIS DIRECTORY BELONGS TO. The org axis derives from here.
   * Server-set and immutable after creation: whoever could edit this could
   * mint principals of any organisation.
   */
  owner:
    | { kind: 'platform' }
    | { kind: 'partner';  partnerId: PartnerId }
    | { kind: 'customer'; accountId: AccountId }
  /** Verified (DNS TXT) and used for home-realm routing. */
  domains: string[]
  status: 'active' | 'disabled'
}
```

`User.identityProvider` becomes `User.connectionId`. **`User.isStaff` is deleted**
— it is `connection.owner.kind === 'platform'`, derived.

`orgClassFor()` then becomes **total**, with all three answers, which is what §8.3
wanted and could not have.

**This is not opening a closed set.** The *protocol* stays closed; the *owner*
stays closed at three variants. Only the instance list is open, and instances are
data rather than vocabulary — the same relationship `Tenant` has to
`TenantEnvironment`.

**Why this beats the affiliation record §8.3 declined.** It is self-maintaining:
leave the company, lose the directory, lose the org, with no row for anyone to
remember to update. And it makes org a property of *how you authenticated* rather
than of who you are — matching the axis's own framing, *"a property of an
evaluation, computed from (principal, tenant) at session establishment."*

### 9.3 Resolved without a decision

- **Cardinality.** One owner per connection — that is what makes derivation sound.
  Many connections per owner, because a group with subsidiaries or a
  post-acquisition estate legitimately runs two directories. **Two orgs may never
  share one connection.**
- **Customers with no IdP.** The managed fallback pool is **per account**, not
  shared. So even a customer with no directory has an owned connection, and org
  derivation stays total with no exception carved into it.

### 9.4 Decided

**(a) The FDE configures the connection during onboarding.**

Honest about how it actually happens: the customer's IT team and our engineer do
it together on a call, and a process that pretends otherwise is one nobody
follows.

**With one correction, or the decision inverts against itself.** §8.7 makes
`authority` the class a regulated customer *withholds* — so if connection
configuration sits inside `authority`, the customers most likely to withhold it
are exactly the ones who most need federation. So **`configure_identity` splits
out of `authority` into its own resource class** that a delivery grant may reach.
A connection is an account-level fact and does not belong in a class defined by
tenant-scoped risk appetite. A regulated customer can then withhold `authority`
— autonomy, roles, users — and still have SSO configured.

**(b) Home-realm routing: verified domain by default, realm URL as override.**

Domain routing gets the common case right with no user effort. The URL override
exists because dual affiliation is real, and is precisely the case the org axis
was built for: a consultant at a firm that both resells and buys may legitimately
appear as `partner` on Monday and `customer` on Tuesday, and each session should
record which.

Two rules that are not optional:

- **Domain verification (DNS TXT) is the control, not a nicety.** Unverified
  claiming is a takeover vector — a partner registering a customer's domain
  captures those logins *and* the organisation those users resolve to.
- **The override selects which connection TRIES. It never widens.** Arriving at
  the platform realm cannot make anyone `platform`; only the platform connection
  authenticating them can. Routing chooses the door; the door decides.

**(c) SCIM push for deprovisioning.**

Federation stops a departed person logging in. It does not remove them, and the
model's derived state stays wrong until something does:

- `distinctHolders > 1` is satisfied by someone who left in March — the count is
  of names on assignments, not of people who could act;
- an approval ladder rung nobody can fill stalls, with no clock, because
  `escalateAfterHours` is read by nothing and `ApprovalDecision` has no
  `requestedAt`;
- `Budget.notifyUserIds` keeps sending to a mailbox that may now forward
  elsewhere.

Connections without SCIM — the managed pool, smaller IdPs — still need a manual
disable path. Stated rather than assumed away.

**(d) Guests are refused and sent to their home realm.**

An IdP asserts **directory membership, not employment**. A partner engineer
invited as a B2B guest into the customer's Entra would otherwise authenticate on
the customer's connection and resolve to `customer` — with
`PARTNER_CAPABILITY_MASK` never applying and `AuditActor` recording them as an
ordinary tenant user. That is the "second partner door" `governance.ts` claims to
have closed, reopened through the directory instead of through a nullable field.

Both Entra and Okta emit the signal (`userType: Member | Guest`), so this is a
claim check rather than an inference. A refused guest is told to use their own
sign-in, arrives at their own realm, and resolves correctly — which composes with
(b): the URL override exists so a person can choose which hat they wear, and this
makes the wrong hat unavailable rather than merely discouraged.

**The cost lands on the customer and should be said out loud:** some
organisations run contractors entirely on guest accounts, and those people
genuinely work for the customer. Refusing them means the customer must issue real
accounts. That is the right answer and it is still a conversation to have.

### 9.5 What this does not fix

- **`TenantContext` still has no slot for org.** Independent of federation, still
  required — the session-establishment result type is
  `{tenantId, environment, residency, deploymentMode}`.
- **`Membership.partnerScope` still needs deleting**, and `decide()` must check a
  partner grant's `partnerId` against the derived org, or a partner who moved to
  the customer keeps grant-derived assignments evaluated under the wrong org.
- **The 1CloudHub-directory guest case** narrows but does not vanish: guests are
  now refused, which is the fix — but it depends on the claim being read, and
  nothing reads it yet.

---

## 10. Decisions from the stress test

> **Status:** decided 5 Aug 2026. Not implemented.
> **Provenance:** four agents — east-west by contract/service/model layer,
> north-south across six vertical slices, and two red teams. Roughly forty
> findings; these are the seven that were decisions rather than bugs.

### 10.1 Service communication is carved out of §8.4

**The deadlock.** `evaluateTenantAccess` blocks unconditionally on
`customerNotifiedAt`; the recipient is the security-duty `TenantContact`, which
is *"an address with a duty attached. It authorises nothing."* Under §8.4 that
notification is an unauthorised read, so the field is never set, so **every
`TenantAccessGrant` evaluates to `allowed: false` permanently** — incident and
delivery alike. §8.5 exists so nobody waits on a customer process; §8.4, taken
minutes earlier, made support access impossible outright.

**Decided.** §8.4 governs **content-bearing digests only**. An operational notice
— *"1CloudHub opened a support grant on your tenant"* — carries no tenant data
and is not a read. The line already exists in the model and was simply not
carried across: `mayNotifyContact()` gates a contact on *verification*, never on
capability, because `TenantContact` was built as reach-without-authority on
purpose.

> **The risk, named at the time of deciding: "service communication" is a
> category someone will widen.** It needs a **closed list of notice kinds**, not
> a judgement call at each call site. Without that list this decision is a hole
> rather than a carve-out.

### 10.2 Self-issue means two staff

**The contradiction.** `TenantAccessGrant` enforces
`approvedByStaffUserId !== staffUserId` at issue **and re-checks it at
evaluation** — deliberately, so a grant written around the issue path still fails
when used. §8.5's "each incident self-issues" is forbidden by the type's central
invariant, and the standing authorisation has no field that could supply a second
party.

**Decided.** The two-person rule holds. The on-call engineer raises, a second
1CloudHub person approves. This satisfies what §8.5 actually asked for — *"I do
not want to be waiting on a **customer internal process**"* — because nobody
waits on the customer. A second engineer is a rota problem, and it is ours.

The runner-up was to treat the customer's contract-time signature as the second
party. Rejected because it would make `approvedByStaffUserId` hold a customer
principal: a different control wearing the same field, and every reader of that
row currently assumes two 1CloudHub people looked at it.

**Cost, stated:** at 03:00 on a Sunday you need two people. The mitigation is a
rota, not a model change — but it is an operational commitment and should be
priced before it is promised.

### 10.3 A policy's author is provenance, not a live authority

**The hole.** Four of five `RunTrigger` kinds have no human at the moment of
action, so accountability terminates in `Policy.createdBy` — a bare `UserId`,
never checked at authoring, never re-checked at execution. An FDE authors an
`AutonomyConfig` under a 90-day delivery grant; on day 91 the grant expires and
**scheduled runs keep auto-executing indefinitely**, under an author with no
authority in that tenant. §3's stated property — *"validity is evaluated, never
asserted; a fired employee's in-flight agents stop"* — holds for the `user`
delegation branch and is false for the `policy` branch, which is the branch four
of five triggers take.

**Decided.** Once a tenant accepts an autonomy setting it is the tenant's policy.
The author records who wrote it and nothing more. Organisations outlive
employees, and requiring a live author would halt a business every time a
controller resigned.

> **This makes the propose-and-approve path load-bearing rather than
> nice-to-have.** The decision is only safe if the FDE is *never* the author —
> which requires §14.7's rule to be mechanical: an FDE proposes, acceptance mints
> a `Policy` whose `createdBy` is the **tenant** user. `AutonomyProposal` does not
> exist, and `recommendAutonomyCeiling()` structurally cannot recommend at
> onboarding because `sampleSize` is zero. Until that path is built, this
> decision rests on a rule enforced by a comment.

### 10.4 Consent requires the delta, not the whole role

**The deadlock.** `canGrant` loops **every** capability of the target role and
refuses if the granter lacks any. So on a widening pack upgrade, the tenant admin
holding `manage_roles` but not `approve_resolution` cannot consent to the role
that now carries it — and `self_grant_forbidden` stops them re-consenting their
own assignment. The person administratively responsible is, by construction, the
one least likely to hold the new capability.

**Decided.** `canGrant` asks the right question for a *grant* and the wrong one
for a *consent*. A grant confers a whole role on someone who had nothing; a
consent accepts a redefinition of a role someone already holds, so only the
**delta** is new authority:

```
hold manage_roles
∧ hold every capability in (v_n+1 − v_n)
∧ at a scope no narrower than the assignment's
```

The delta check is what closes the **proxy escalation** — without it, hold
`install_pack` + `manage_roles`, install a pack widening a role a *colleague*
holds, consent to it (not a self-grant, so unblocked), and the colleague gains
`approve_resolution` with nobody who holds it ever agreeing.

**Open, and it should be visible rather than silent:** a tenant where nobody yet
holds the new capability has no eligible consenter, so the upgrade holds
indefinitely. That is *narrowing automatic, widening an act* working correctly —
but a permanently-pending upgrade with no notification is indistinguishable from
one nobody looked at.

### 10.5 Roles do not revert with the pack

**The collision, where neither side is wrong.** `canTriggerRollback` confines
scorers to outcome level — *"the single most important discipline in the eval
design."* And `rollbackTriggerForFailedProbe()` is **deliberately** routed around
it, with a good argument: *"A safety regression is not quality drift."* Together:
a failed prompt-injection probe auto-reverts a pack, and if the reverted-to
version had a **wider** role, live authority widens unattended at 04:00, with no
human in the path. *Narrowing is automatic, widening is an act* — inverted by the
safety machinery.

**Decided.** Separate the two things a pack version carries.

| | on rollback |
|---|---|
| **Behaviour** — definitions, procedures, prompts | reverts immediately. This is what the safety trigger is *for*. |
| **Authority** — role capabilities | stays at `min(v_n, v_n+1)`. Never widens on an automated path. |

`Role.version` is already independent of `packVersion`, so this is expressible.
**It needs `mintedRoleIds` on `InstalledPack`**, which does not exist — today an
installation cannot record what a pack minted, so a rollback could not un-mint it
either.

**Cost:** a role composition that matches no pack version. That divergence must
be visible, not merely tolerated.

### 10.6 A distinct digest capability — the thirty-first

**The gap §8.4 opened.** A zero-capability recipient receives nothing, so
`sponsor` — the class documented as legitimately holding none — gets an empty
digest. It needs a floor. But `view_dashboard` sits inside
`PARTNER_CAPABILITY_MASK.exceptions_read`, so using it would let a partner
receive the same digest **through** the mask rather than around it.

**Decided.** A distinct capability, in no partner mask scope. One capability was
being asked to mean two things with different sinks, different classification
ceilings and different org rules:

- *may open the dashboard screen* — an operating act
- *may receive figures by email* — a delivery act

A partner supporting a customer's queue may legitimately need the first and must
not have the second. The channel is not incidental: a dashboard is pulled inside
a session we authorise; a digest is pushed to a mailbox we do not control,
retained indefinitely, forwarded freely, and crossing a residency boundary on the
way.

> Capability **31**, in a set whose closedness is a standing constraint. The
> reason here is structural rather than convenient — but the set should not grow
> this way twice.

> ⚠️ **It grew this way three more times the same evening.** `configure_identity`
> (32), `bind_secret` (33) and `enable_endpoint_writeback` (34) landed with §11 —
> each with its own argument, and one of them (33) closing a hole where a
> ninety-day delivery grant could bind the customer's ERP credentials. The set is
> **thirty-four** — **thirty-six** from 7 Aug 2026, with `view_metering` (35)
> and `view_commercial` (36); see §11.9a. See §11.2.

### 10.7 A break-glass path for legal hold

**The case §8.7 could not answer.** `statutory` is unreachable to platform staff
at any price. But a regulator or court may order **1CloudHub, as processor**, to
preserve data inside a tenant — and an abandoned or insolvent tenant has nobody
left to place a hold while the retention sweep keeps running, purging under
`AuditActor.system`.

**Decided: a narrow break-glass path** — exceptional, time-boxed, named
approvers, heavily audited.

> **The argument against was made and overruled, and is recorded rather than
> dropped.** Standing is not something an emergency confers: if the obligation
> runs to the controller, no procedure of ours transfers it. And a class with one
> exception acquires a second — the value of *"in neither list, ever"* is
> entirely in the word *ever*. The counter-argument that carried it: a rule with
> no exception grows one informally, and an informal one is unaudited.

**Scope, recorded unless overridden: `place_legal_hold` only.** The two statutory
acts differ in kind. Preserving is an act defensible under an order. Answering a
data-subject request on the controller's behalf is one where standing genuinely
cannot be conferred by an emergency — making both break-glass would concede the
point §8.7 rests on.

The safer shape remains available and is worth building even alongside this: a
platform-side **preservation order** that suspends the sweep, is visible to the
tenant, and grants **no read**. Preservation is not access, and separating them
is what makes the emergency defensible.

### 10.8 Floors: weekly window, cohort of five

`cohort` and `granularity` have zero occurrences in the repo; §8.8 called for
both and left the values as placeholders.

**Decided.** `PartnerHealthView` refuses windows finer than **7 days**;
partner-level aggregates suppress below **5 tenants**.

The defence is specific: `active` sampled hourly for a month is a 720-bit volume
proxy carrying close cadence, weekend idleness, month-end spike and outage
correlation. At weekly granularity that collapses to roughly four points a month
— enough to see an account go quiet, which is what an account manager
legitimately needs, and not enough to reconstruct a run schedule.

**Cost, and where the pressure will come from:** a partner's first four customers
show no partner-level aggregate at all. That lands hardest on new partners,
exactly when they most want to show their book growing — so expect pressure to
lower the cohort floor, and expect it from sales rather than from the partner.

---

### What these seven change about the build order

Three items move from *recorded* to *blocking*, because a decision now rests on
each:

- **`AutonomyProposal` and the propose-approve path** — 10.3 is only safe if the
  FDE is never a policy author.
- **`mintedRoleIds` on `InstalledPack`** — 10.5 is not expressible without it.
- **A closed list of service-notice kinds** — 10.1 is a hole rather than a
  carve-out until it exists.

And two additions that are small but land in closed sets, so they are cheapest
now: **capability 31** (10.6), and the **`configure_identity`** resource class
from §9.4(a).

> **§11 supersedes the arithmetic of this paragraph, not its reasoning.**
> Capabilities **32, 33 and 34** landed the same evening (§11.2), each with its
> own argument, and one of them closing a hole where a ninety-day delivery grant
> could bind the customer's ERP credentials. The warning in §10.6 — *"the set
> should not grow this way twice"* — stands as a warning and has been overrun as
> a prediction.

---

## 11. The resource axis — the fourth leg

> **Status:** applied 5 Aug 2026, evening. In `model/`, typechecking clean.
> **Nothing is built.** This section describes a model, not a running system.
>
> **What it changes about §1–§10:** three counts. `ACCESS_RESOURCE_CLASSES` is
> **thirteen**, not four (§8.7 said two were being added to two). `CAPABILITIES`
> is **thirty-four**, not thirty-one (§10.6) — and **thirty-six** from 7 Aug
> (§11.9a). `AssignmentScope` has **six**
> dimensions, not five (§1, §7.1, §7.3, §8.4 and `docs/domain-model.md` §15.4 all
> said five). Superseded claims are marked where they sit rather than the older
> text being rewritten; only the bare counts were corrected inline, because a
> stale number in a sentence about something else is a trap rather than a record.

### 11.1 The axis existed for one organisation class out of three

§8 established the organisation axis and called it the third. It is not the
last one. Read the three ways authority is conferred in this model side by
side and one term is present in exactly one row:

| Conferred by | Names an org | Names a capability | Names a scope | **Names a resource class** |
|---|---|---|---|---|
| `RoleAssignment` (customer) | derived | ✅ `Role.capabilities` | ✅ `AssignmentScope` | ❌ **nothing** |
| `PartnerAccessGrant` (partner) | ✅ | ✅ via `PARTNER_CAPABILITY_MASK` | ✅ | ❌ **nothing** |
| `TenantAccessGrant` (platform) | ✅ | ❌ *none at all* | ❌ | ✅ `AccessResourceGrant.resource` |

`TenantAccessGrant` had a resource term because a support grant had to be able
to say *"configuration, and provably not the customer's rows"* — that sentence
is the entire safety property of a ninety-day delivery grant. A customer's own
role had no such term because nobody needed to say it: a tenant admin reaches
the tenant.

**That asymmetry is what made §8.7 a hole rather than a nuance.** The delivery
grant said *"no `tenant_data`"*, the role the FDE was handed said
*"`manage_roles`"*, and **the two statements had no vocabulary in common**, so
nothing could tell that the second sat outside the first. Two closed sets had
been sitting next to each other since both were written —
`Capability` in `access.ts:251`, `AccessResourceClass` in `governance.ts:141` —
with `PERMITTED_RESOURCES` deciding what a *purpose* may ever reach and nothing
at all connecting a *capability* to a class.

The join is one table with zero logic in it:

```ts
// model/access.ts:517
export const CAPABILITY_RESOURCE_CLASS: Record<Capability, AccessResourceClass>
```

`Record<Capability, …>` is the whole mechanism. A thirty-fifth capability that
nobody classifies is a **compile error**, not a capability that silently reaches
everything or nothing depending on which lookup found it first. Same discipline
as `PERMITTED_RESOURCES` keying on `AccessPurpose`, and as
`AUTHORIZATION_MAY_BE_ABSENT` keying on `AuditActor['kind']`
(`governance.ts:1013`).

> **The fourth leg completes a shape rather than adding to it.** *Who is asking*
> (org, §8) × *what verb* (capability) × *how narrowed* (scope) × **on what
> class of thing** (resource). Every prior gap in this document was a missing
> term in that product, and each was found the same way: two rules that were
> each correct about a different half, with no operand joining them.

### 11.2 Thirteen classes, and the test each one had to pass

A class earns its place by carrying **a rule that is true of it and false of its
nearest neighbour**. Not "these things feel similar" — a taxonomy built on
resemblance drifts, and the drift is unfalsifiable. Every member below is stated
as the rule, with the neighbour it is being distinguished from.

| Class | The rule that is true here and false next door | Source |
|---|---|---|
| `tenant_data` | The customer's business. Rows, documents, money, correspondence, and the audit trail *about* them. | `governance.ts:131` |
| `configuration` | What the system **does**. Definitions, rules, procedures, document types, tag policy. Low risk, not zero — a `when` guard can name an individual. | `governance.ts:129` |
| `authority` | Who may **decide**. Autonomy envelope, roles, user administration. In no `PERMITTED_RESOURCES` entry; a signed `SupportAuthorisation` is the only way in. | `governance.ts:148` |
| `statutory` | **Not the customer's to delegate.** The obligation runs to the controller whatever a contract says. In neither list, ever, and refused before any other check. | `governance.ts:163` |
| `identity` | The **door**, not what is behind it. A connection is an *account*-level fact, so it does not belong in a class defined by tenant-scoped risk appetite — and a delivery grant may reach it **on purpose** (§9.4a). | `governance.ts:178` |
| `endpoint` | **Where the platform reaches**, in either direction. Direction is a flag on the object, not a class — see §11.4. | `governance.ts:203` |
| `secret` | **There is no read mode.** Bind and rotate only. See §11.5. | `governance.ts:218` |
| `substrate` | **Authority is shared with someone else's root**, and revocation is asynchronous and best-effort *by construction*. Every other class in the set revokes synchronously. | `governance.ts:236` |
| `commercial` | **A partner is a legitimate reader here and nowhere else.** That is the whole of `partnerCommercialVisibility()`. | `governance.ts:248` |
| `catalogue` | **No tenant principal may write it**, and a platform principal writing it needs no tenant grant at all. Gated by release, blast radius is the fleet. | `governance.ts:260` |
| `schedule` | **There is no principal at the moment of action.** Four of five `RunTrigger` kinds have no human, so the agent-authority intersection has no operand for its third term. A schedule must *pin* its scope at arming. | `governance.ts:275` |
| `metering` | **There is no write mode.** `UsageRecord` is immutable and unpriced. See §11.5. | `governance.ts:295` |
| `telemetry` | Traces and spans. **No rows at all** — which is why both purposes reach it and why §11.9 records what happened to it. | `governance.ts:115` |

Four capabilities were added to make the classification total and honest, and
each had to earn a number against a closed set:

| # | Capability | Class | Why it is not an existing verb |
|---|---|---|---|
| 31 | `view_summary` | `tenant_data` | §10.6. A pushed digest is a different sink from a pulled screen, and `view_dashboard` sits inside a partner mask. `access.ts:290` |
| 32 | `configure_identity` | `identity` | §9.4a split the class out and there was **no verb to put in it** — `PERMITTED_RESOURCES.delivery` already admitted `identity` while nothing mapped to it. The class was reachable and empty. `access.ts:361` |
| 33 | `bind_secret` | `secret` | Split out of `configure_connection`, which was doing three jobs at three blast radii. `configure_connection → configuration`, and delivery reaches `configuration`, so **a ninety-day delivery grant could bind the customer's ERP credentials.** `access.ts:377` |
| 34 | `enable_endpoint_writeback` | `authority` | Reading from SAP and posting to SAP are **a cliff, not a slope** — one clearing document is a Financial Document in the customer's ledger. `access.ts:392` |

`configure_connection` is gone, replaced by `configure_endpoint`
(`access.ts:329`), which maps to `endpoint` and reaches neither the credential
nor write-back. And `configure_telemetry` moved from `configuration` to
`authority` (`access.ts:472`) on a specific finding:
`TelemetryPolicy.maxDataClassInSpanAttributes` is a **classification ceiling**,
and a delivery grant that set it to `sensitive_personal` alongside
`includeExplanations: true` — which carries verbatim extracted values — turned
the one class delivery is allowed to read into a full exfiltration path.
Delivery reaches `telemetry` by design; it must not set what lands there.

> **The decomposition is general, which is the evidence it is right.** A
> connector and a telemetry exporter decompose identically: the *destination* is
> `configure_endpoint`, the *credential* is `bind_secret`, the *ceiling* is
> `authority`. Nothing was special-cased for ERPs.

### 11.3 `sample_data` was not a class — it was a selector

`sample_data` is **removed**. It was `tenant_data` under a different selector,
and `grantAllows()` proved it by carrying one special-case `if` for one class.
Keeping it made the class axis mix *what kind of thing* with *how much of it* —
two questions in one enum, which is the `RoleKey` failure at a smaller scale.

What replaces it is one line, total over `AccessPurpose`:

```ts
// model/governance.ts:354
export const REQUIRES_ENUMERATION: Record<AccessPurpose, readonly AccessResourceClass[]> = {
  delivery: ['tenant_data'],
  incident: [],
}
```

**The safety property got stronger, not weaker.** It was *"delivery cannot reach
tenant data"*. It is now *"delivery cannot reach tenant data it has not been
handed, instance by instance, by the customer"* — and the nomination remains the
customer's auditable act. An empty list grants nothing rather than everything
(`governance.ts:786`), the same polarity the whole model was corrected to.

It also fixes an operational failure the old shape caused, and this is the part
worth remembering because it is how a control gets routed around: **an FDE who
needed one `Exception` to debug a field mapping had no delivery path at all**,
because `sample_data` enumerated `SourceDocumentId` only. They would raise an
*incident* grant instead — defeating the delivery/incident split entirely. The
nomination field is now `nominatedSubjectIds: string[]` (`governance.ts:618`),
because a delivery enumeration may legitimately name a document, an exception or
a run.

> **⚠️ THE WIRE DID NOT FOLLOW FOR TWO DAYS, AND THAT IS THE FINDING.** Added
> 7 Aug 2026. `docs/contracts/control-plane.openapi.yaml` carried
> `enum: [telemetry, configuration, sample_data, tenant_data]` on **both**
> `AccessResourceGrant.resource` and `AccessSessionReport.touched[].resource`,
> and `nominatedDocumentIds` with the description *"`sample_data` ONLY, and
> required there"* — three days after the class stopped existing and two days
> after the field was renamed. This is the **access path**, on the one contract
> that crosses an AWS account boundary, and it was wrong in both directions at
> once: it named a class `grantAllows()` can no longer be handed, and it omitted
> `identity`, `endpoint` and `authority`, three classes a grant genuinely
> reaches. A plane validating against it would have **refused a well-formed
> `authority` grant** — the one class a `SupportAuthorisation` exists to open —
> while accepting a `sample_data` line no function in the model can evaluate.
>
> Both enums are now the derived six: `PERMITTED_RESOURCES.delivery ∪
> PERMITTED_RESOURCES.incident ∪ CONTRACT_ONLY_RESOURCES`. Nothing was chosen;
> the set is read off `model/governance.ts`, which is why it can be re-derived
> rather than re-argued.
>
> It was carried, correctly identified and **not fixed** in three consecutive
> passes on 7 Aug because closing it looked like a decision ("which of thirteen
> classes belong in a grant enum") rather than a transcription. It was a
> transcription: the model already answers it, totally, in three exported
> constants. **The general lesson is the one delta 1 taught about the delta
> tables** — a claim about the model that nothing checks will be stale before
> anyone reads it, and here BOTH the model-to-wire mirror and the "is this a
> decision or a transcription" judgement were unchecked. A committed
> model-versus-wire checker in `tools/` would have found this on 5 Aug. There
> still is not one.

It stays a **finite enumeration and never a pattern**. `id = ANY($1)` is a
`SELECT`; `id LIKE '01J%'` is not, and *"who can reach this"* has to stay a
relational question. Same constraint as `AssignmentScope`, same reason.

> ⚠️ **Half of the check still lives in the caller.** `grantAllows()` verifies
> that *an* enumeration exists, not that the subject being reached is *in* it —
> it takes no subject (`governance.ts:786`). This is the
> caller-checks-the-other-half shape that folding everything into `decide()` was
> supposed to end, surviving because the fix is a signature change with a caller
> audit behind it. Recorded, not fixed.

### 11.4 `endpoint` takes a direction flag, not a second class

Four unrelated lists named an outside address —
`DataEgressConfig.allowedDestinations`, `CounterpartyEndpoint`,
`TenantContact.address`, `TelemetryExport.endpoint` — so **the same verification
rule was enforced twice and not enforced at all twice**, and Slack and Teams
installs were modelled nowhere. One registry replaces all four
(`domain.ts:519`).

The live question was whether *connector* and *destination* are two classes. They
are not:

> **A mailbox you send to and a mailbox you poll are the same mailbox.**
> Direction is a property of the binding, not of the object.

Splitting the taxonomy would split one thing in two and then need the halves to
share a registry anyway — which is exactly the duplication that produced
`RoleKey` vs `Capability` and `PolicyReasonCode` vs `ErrorCode`. What genuinely
differs is **which gate applies**, and a gate keys off a flag perfectly well:

| Direction | What it is | The gate |
|---|---|---|
| `inbound` | A **trust boundary**. Ingested content is data, never instruction. | Admission |
| `outbound` | A **disclosure surface**. | Classification ceiling, residency check, verified address |
| `bidirectional` | Both, and therefore both gates. | Reaching this state is an act |

Adding `inbound` to an outbound endpoint is a **widening**, and widening is an
act — the existing law, not a new rule invented for this type.

> ⚠️ **The inbound gate is a live gap, not a solved one, and the model says so.**
> The trifecta rule is scoped to counterparty replies; **a connector-pulled
> document reaches extraction with no admission act at all** (`domain.ts:495`).
> The class exists; the gate behind one of its two directions does not.

Three fields carry the separation the class was created to make:
`credentialRef` is `bind_secret` and never `configure_endpoint`
(`domain.ts:535`); `writebackEnabled` is `enable_endpoint_writeback` and
therefore `authority` (`domain.ts:549`); `boundUntil` must never outlive the
authority that created it, because **an endpoint keeps pulling after the grant
that declared it lapses** — which is precisely what distinguishes it from inert
configuration.

### 11.5 Two classes earned entry on a missing mode

`AccessMode` is `'read' | 'write'` (`governance.ts:598`) and every other class
has both. Two do not, and the *absence* is the defining rule:

**`secret` has no read mode.** Modes are bind and rotate. `read` is
unrepresentable, because three modules independently state that no field in this
model may hold key material — so **the reference *is* the resource**, and
reading a reference is not a thing anyone needs to do. It is in neither
`PERMITTED_RESOURCES` entry and it is the second member of
`NON_DELEGABLE_RESOURCES` (`governance.ts:380`), alongside `statutory` and
unlike it in one respect: **there is no break-glass**, because preservation has
an analogue under `statutory` (§10.7) and reading a credential does not.

**`metering` has no write mode.** `UsageRecord` is immutable and unpriced
(invariant 5, money is always derived), so nobody edits a meter reading — not
the customer, not a partner, not us.

The load-bearing part is why `metering` could not simply live in `commercial`:

> `commercial`'s defining rule is **that a partner may read it**. A raw
> `UsageRecord` is **volume in the clear**, which is the exact quantity §8.8
> spent the entire partner-visibility argument protecting — spend and rate
> together invert to volume, and volume is the customer's real exposure. One
> class containing both a partner-readable summary and a partner-forbidden
> record **has no defining rule left**.

That is the test in §11.2 doing work rather than decorating a table. `commercial`
and `metering` resemble each other; their rules contradict each other.

### 11.6 The spine — one identifier, three streams

**Why a set of evaluators was not enough.** AWS's IAM works not because IAM
exists but because *there is no path to a resource that bypasses the API call*.
This model had evaluators — `decide()`, `grantAllows()`, `resolveModel()` — and
nothing forced the call. Under a customer-owned data plane the choke point
cannot be network-level, because **the customer holds root and can reach the
database directly**.

So the choke point is: **authorisation mints an artefact, and the artefact is the
only thing an act can be recorded under.**

```
authorize(principal, capability, request)  →  AuthorizationGrant   access.ts:1461
redeemAuthorization(grant, principal, …)   →  Decision             access.ts:1555
```

Be precise about what this buys, because overclaiming is how a control becomes
decorative. **It does not make an unauthorised act impossible** — nothing in a
type system can, against root. It makes an unauthorised act **unrecordable**:

| Stream | Field | Source |
|---|---|---|
| `AuditEvent` — who wrote | `authorizationId` | `domain.ts:2665` |
| `DataAccessEvent` — who read | `authorizationId` | `governance.ts:964` |
| `UsageRecord` — what it cost | `authorizationId` | `billing.ts:189` |

Before this, those were three streams with no shared key, **and the middle one
was not stored at all** — `Decision` was computed, used and discarded. *"Who read
this, under what authority, and what did the inference cost"* was three queries
that could not be combined. On the read stream the absence was worst: `actor`
recorded **who** and `maxDataClass` recorded **how sensitive**, and the
authorisation that permitted a `sensitive_personal` read was thrown away — so
the first question a regulator asks, *under what authority was this person's
record opened*, was answerable only by reconstructing the principal's
assignments as they stood at the time, from a table that has since changed.

Four design choices are worth not relitigating:

1. **A reference, not a bearer token.** Every field is server-written and
   server-read; there is no signature, no claims blob, no encoding. Possession
   of the id is not possession of the authority, and `redeemAuthorization()`
   re-derives it every time. That is a deliberate refusal of the JWT shape: a
   signed self-describing token is fast *precisely because nobody loads the
   row*, and a revoked assignment then stays effective until expiry. **A fired
   employee's in-flight acts stop on the next call, not at the next expiry.**
2. **`decide()` does not mint; `authorize()` does.** `canGrant()` loops
   `effectiveScopeFor()` over every capability of a target role — a minting
   `decide()` would issue twelve live authorisations for a permission check that
   performs no act, and *"issued and never redeemed"*, a genuinely useful anomaly
   query, would be pure noise. `PrincipalContext.now` is a parameter so a
   decision is reproducible in an audit; a minting `decide()` would issue live
   authority every time an auditor replayed a historic one.
3. **`resourceClass` is denormalised onto `ResourceRef`** (`access.ts:1279`),
   not derived at read time — for the reason `AuditActor` stamps `orgClass` at
   write time. **A platform release may move a capability between classes**, and
   `configure_telemetry` did exactly that on 5 Aug. An auditor reading a March
   grant needs March's classification.
4. **Lifetime is bounded per class, total by construction**
   (`MAX_AUTHORIZATION_SECONDS`, `access.ts:1319`). A fourteenth class that
   nobody bounds is a compile error. The three short ones are the argument:
   `secret` is **60 seconds** because binding a credential is one act and there
   is no second act it enables; `authority` and `statutory` are **five minutes**,
   because a long-lived artefact reaching `statutory` would be the only durable
   form that refusal could take.

`authorize()` also refuses a **class mismatch** before evaluating any authority:
a `view_document` grant aimed at a `secret` is either a caller bug or an attempt
to launder a class past `PERMITTED_RESOURCES`, and nothing can tell which
(`access.ts:1477`). And `redeemAuthorization()` re-binds four things — tenant,
principal, capability, resource — each closing a distinct way a live artefact
goes wrong; without the principal binding the id **is** a bearer token in
everything but name.

The scope returned is the **intersection** of what was pinned at mint and what is
true now. Narrowing is automatic; widening is an act and does not reach an
artefact already in flight.

### 11.7 Tamper evidence, argued once and not carried across

`UsageRecord.sequence` is monotonic per plane so *"a gap is detectable rather
than merely absent"*, and `UsageAttestation` is hash-chained and signed because —
in its own words — *"the lease was an honour system without this"*. Both were
built because a customer-owned data plane could under-report.

`AuditEvent` and `DataAccessEvent` live in the **same database, under the same
customer root**, and carried no sequence, no hash and no signature.

> **The thing that costs us money was tamper-evident. The thing that proves who
> touched a data subject's record was not.** The argument was made once, for the
> meter, and never carried across to the record an auditor actually asks for.

`RecordChain` (`governance.ts:906`) is now on both streams —
`AuditEvent.chain` (`domain.ts:2625`) and `DataAccessEvent.chain`
(`governance.ts:946`). It makes a deleted row and an edited row detectable,
because the chain breaks. **It does not defend against a root holder who rewrites
the whole chain**, and under BYOA that is exactly who holds the database.

Which is why `ChainAnchor` (`governance.ts:934`) ships the **head hash only** to
the control plane. Shipping audit content upward would break invariant 3 — the
audit trail is precisely the tenant data the control plane must never read. A
head hash is a scalar: no subject, no actor, no action, no field value. Once we
hold it, a rewritten history no longer matches an anchor recorded before the
rewrite. Same shape as `UsageAttestation`, **one property weaker: we can prove
the chain changed, not what it used to say.**

`AUTHORIZATION_MAY_BE_ABSENT` (`governance.ts:1013`) makes the null rule
executable rather than commented — total over `AuditActor['kind']`, so a sixth
actor variant is a compile error until someone decides whether it acts under an
authorisation. **One kind may be null: `system`**, genuine machinery with no
principal to evaluate. **`agent` may not**, and that is the one worth saying out
loud: an agent looks like machinery and is not — it acts under a delegation, and
an agent read with no authorisation is the exact gap §3 closed.

### 11.8 `Solution` is a scope, never a grant

Three levels existed conceptually and two were modelled:

| Level | What it is | Source |
|---|---|---|
| `SolutionPack` | The **catalogue** entry. Authored, versioned, signed, portable, and a control-plane asset that may not point at a tenant row. | `domain.ts:1671` |
| `InstalledPack` | The **minting record**. What an install created, and when. | `domain.ts:1748` |
| `Solution` | **What is actually running.** ← this was missing. | `domain.ts:1860` |

The gap was not cosmetic. Everything an operator calls *"the AP
reconciliation"* — the connector it pulls from, the mailbox it answers on, the
agents that read, the procedure that routes, the dashboards the controller opens
— had no object. Each part was modelled and **the assembly was not**, so there
was nothing to disable, nothing to hand to a partner, nothing to scope an
assignment to, and nothing for a rollback to name.

It holds **references, never embeds** — an assembly that copied its parts would
be the copy a rollback reverted and an auditor read, while the live rows drifted
away underneath.

Then the question everyone will ask, and the answer is a permanent refusal:

```ts
// model/access.ts:1971
export const SOLUTION_IS_GRANTABLE = false
```

*"Grant Priya the AP reconciliation solution"* is the sentence a customer will
say, an admin UI will offer, and a pack author will try to ship as a role. Same
shape as `AGENTS_HOLD_ROLES` (`access.ts:1930`) and for the same purpose: **a
refusal a future reader has to delete, visibly, in a diff, rather than quietly
not implement.**

The argument is decisive rather than stylistic, and it is the resource axis that
makes it decisive:

> **A solution contains a secret.** The assembly reaches an `Endpoint`, an
> endpoint carries a `credentialRef`, and `bind_secret` maps to `secret` — which
> is in **neither** `PERMITTED_RESOURCES` list and is one of the two members of
> `NON_DELEGABLE_RESOURCES`. Granting the container atomically would confer, in
> one act, **something no grant in this model may confer at any price, to
> anyone, under any purpose.**

A container is not a bundle of comparable things; this one spans classes the
model deliberately keeps apart. It would also be a **third authority
vocabulary** beside `Capability` and `AgentAction` — with membership defined by
an editable list, so widening someone's authority would mean *adding a definition
to a solution*, an act nobody would recognise as an authority change and which no
consent path covers.

What replaces it is strictly more expressive:

| Want | Mechanism |
|---|---|
| Narrow someone **to** a solution | `AssignmentScope.solutionIds` (`access.ts:553`) — the **sixth** dimension. Intersects; can only take authority away |
| Act **within** a solution | The capability each act already needs. Unchanged |
| Act **on** the container | `SOLUTION_CONTAINER_ACTS` (`access.ts:1981`) |
| The credential | `bind_secret`. Tenant principals only, at any grant length. Reachable from nowhere else |

The sixth dimension is the one `definitionIds` was already doing one level down.
*"This team runs the AP three-way match and nothing else"* was expressible only
by enumerating every definition that assembly happened to contain — **a copy of
the solution's membership list, maintained by hand, in a table nobody updates
when the solution gains a definition.** The narrowing silently widened, one
install at a time. It is a `ScopeDimension<SolutionId>` like the other five: no
wildcards, no patterns, no membership predicate resolved at evaluation time.

`ResourceRef.solutionId` (`access.ts:1296`) carries the same polarity on the
authorisation: **its presence narrows; its absence never widens.**

And `InstalledPack.mintedSolutionId` (`domain.ts:1822`) closes two of the four
rollback blind spots with one reference — agents and dashboards hang off the
`Solution`, so naming the solution reaches them transitively. The other two are
**not** blind spots and must never be filled: endpoints and secrets are not
minted by an install, and recording them would invite an automated reversion,
firing at 04:00 with no human in the path, to **un-bind a customer's connection
to their own ERP**. Reverting behaviour must not sever a connection.

---

### 11.9 Partly settled — six classes had no capability; two closed, four stand

> **SETTLED IN PART, 7 Aug 2026.** `view_metering` (35) and `view_commercial`
> (36) were minted, taking `CAPABILITIES` from thirty-four to **thirty-six** and
> the classes with a capability from seven to **nine of thirteen**. The other
> four were answered rather than deferred: `catalogue` and `substrate` are
> **statements**, `schedule` and `telemetry` are still **gaps**, for reasons
> recorded at each class in `model/governance.ts` and summarised below. The
> analysis that follows is preserved as written — it is the argument the
> decisions were taken against, not a description of today.

| Class | Capabilities pointing at it | Status |
|---|---|---|
| `tenant_data` | 17 | |
| `configuration` | 7 | |
| `authority` | 5 | |
| `statutory` | 2 | |
| `identity` · `endpoint` · `secret` | 1 each | |
| `substrate` | **0** | ⚠️ flagged, `governance.ts:234` → **statement, 7 Aug**: a release reaches it, a grant does not, and a capability is the currency of grants |
| `commercial` | ~~**0**~~ → **1** | ✅ **closed 7 Aug** — `view_commercial` (36) |
| `schedule` | **0** | ⚠️ flagged, `governance.ts:271` → **still a gap, 7 Aug**: the verb's SCOPE semantics are undecided, not its name |
| `metering` | ~~**0**~~ → **1** | ✅ **closed 7 Aug** — `view_metering` (35), a read verb and only a read verb |
| `catalogue` | **0** | Deliberate — authoring is a platform act, not a tenant capability (`governance.ts:256`) |
| `telemetry` | **0** | ❗ **not flagged anywhere** → flagged at the class 7 Aug; **still a gap**, deliberately not folded into the minting pass |

**The commercial consequence, stated plainly: nothing in `CAPABILITIES` names a
budget, an invoice, a plan, a schedule or a usage record, so a tenant admin
cannot see what they owe.** `Budget`, `Invoice`, `RateCard` and `UsageRecord` all
exist in `billing.ts`; no verb reaches them. This is not a modelling nicety — it
is a missing product surface that the access model currently makes
unimplementable, because there is no capability to gate the screen on.

**`telemetry` is the sharper one, because it is new.** It was reachable and
non-empty until `configure_telemetry` moved to `authority` (§11.2). It is now:

- in **both** `PERMITTED_RESOURCES` entries (`governance.ts:397`), so a grant
  reaches it;
- bounded at 3600s in `MAX_AUTHORIZATION_SECONDS` (`access.ts:1320`);
- **the target of no capability at all**, so `authorize()` refuses every request
  naming it — the class-mismatch check at `access.ts:1477` can never pass.

That is precisely the shape §9.4a diagnosed for `identity` — *"the class was
reachable and empty"* — reintroduced elsewhere by a fix for a different problem.
It is not obviously wrong (reading a trace may legitimately be a grant-gated act
rather than a capability-gated one), but **nobody decided it**, and the whole
point of a total `Record` is that decisions are forced rather than defaulted.

> **Do not close this by inventing five capabilities.** Adding one is a platform
> release; `view_summary` and `bind_secret` each took a documented argument to
> earn a number. The question to answer first is whether a class with no
> capability is a **gap** or a **statement** — `catalogue` proves it can
> legitimately be a statement.

#### 11.9a The two that were minted, and the four that were not — 7 Aug 2026

Two, not five. The instruction above was followed literally.

**`view_metering` (35) → `metering`.** The token meter renders in the chrome of
every screen, which made this the most frequently performed read in the product
and the one read no capability permitted. A read with no capability is a read
`decide()` cannot evaluate and `authorize()` cannot mint a grant for, so under
invariant 10 it was **unrecordable** — rendering outside the audit surface
entirely. It is **not** folded into `view_dashboard`, for two independent
reasons either of which suffices: `view_dashboard` maps to `tenant_data`, so an
incident grant would reach the meter on the strength of the purpose alone; and
it sits inside `PARTNER_CAPABILITY_MASK.exceptions_read`, so a partner
supporting a customer's queue would read that customer's **volume in the clear**
through the mask. That is §10.6's `view_summary` argument applied at the other
end of the product, and like `view_summary` this capability **appears in no
partner mask scope, ever**. There is deliberately no companion `record_usage`:
`metering` is the class defined by a missing WRITE mode, `UsageRecord` is
immutable and unpriced under invariant 5, and it is written by the `system`
actor kind — the one kind `AUTHORIZATION_MAY_BE_ABSENT` admits.

> 🛑 **THIS PARAGRAPH'S ARGUMENT WAS PUT TO THE OWNER AS THE MIRROR IMAGE OF A
> DIFFERENT QUESTION ON 16 Aug 2026 AND WAS OVERRIDDEN — G209.**
> `view_endpoint` (#194) is now in **both** partner operating scopes,
> `exceptions_read` and `exceptions_operate`. The argument against it was this
> one, applied to endpoints rather than to the meter: an endpoint is where data
> **leaves** a tenant, so the list of them is the customer's integration topology
> and its export destinations, and a partner would read **where a customer's data
> goes** without reading any of it — the same shape as reading volume in the clear
> through the mask. **The owner was shown the conflict, including the same-day
> test asserting the absence, and reaffirmed the widening. Do not relitigate it
> here.** ⚠️ **Nothing in this paragraph is weakened for `view_metering` itself**:
> it is still in no partner mask scope, ever, and G209 does not reach it. What
> changed is that §11.9a's reasoning is no longer a general rule about
> partner-visible topology — it is an argument that won for the meter and lost for
> the endpoint, and a later reader must cite G209 alongside it. Read the row for
> the two rejected alternatives and the cost accepted.

**`view_commercial` (36) → `commercial`.** Closes the consequence stated plainly
above: a tenant admin can now be shown what they owe. It is **not** added to
`PARTNER_CAPABILITY_MASK` despite `commercial` being the one class a partner may
legitimately read, and that is not an oversight — the partner path here is
`partnerCommercialVisibility()`, a derivation keyed on the billing
**arrangement** that yields one of four verdicts per tenant. A mask intersects
capabilities; it cannot express *"the band and nothing inside it"*. Putting the
verb in the mask would hand a partner the tenant's own view and route around the
verdict. No write verb was minted with it: setting a ceiling is a write,
`SpendConfig` is dropped for v1, and a spend ceiling with `enforcement: 'block'`
refuses new work — a risk-appetite setting closer to `set_autonomy` on
`authority` than to reading an invoice. That is a separate decision.

**`catalogue` — statement.** Unchanged, and it remains the worked example.

**`substrate` — statement.** Same shape as `catalogue`, now written down at the
class. The class's own rule already said a platform RELEASE reaches it and a
grant does not; a capability is the currency of grants, so a verb here would be
one no tenant principal could ever legitimately hold. Under BYOA the customer
holds root on the account anyway, which makes a grant a request rather than a
control — and G36 slips BYOA to v1+1, so there is no surface to be wrong about.

**`schedule` — still a gap, and the reason is scope, not naming.** `trigger_run`
is not the missing verb: triggering a run is an act with a principal present,
and **arming** a schedule is the act that has none. An armed schedule must
therefore PIN a scope at arming, where every other capability in
`CAPABILITY_RESOURCE_CLASS` resolves one at use. Minting `arm_schedule` before
deciding how a pinned scope is represented ships a capability that behaves
unlike all thirty-six others while looking identical to them, which is worse
than the empty class.

**`telemetry` — still a gap, and deliberately not folded in.** The diagnosis
above stands unaltered: reachable by both purposes, bounded in
`MAX_AUTHORIZATION_SECONDS`, and the target of no capability, so the
class-mismatch check can never pass. It is now at least **flagged at the class**
in `model/governance.ts`, which it was not. It was left open because the
question is genuinely different from the other five — reading a trace may
legitimately be a grant-gated act rather than a capability-gated one — and
HANDOFF §8 item 1g already says to settle it on its own.

### 11.10 ~~Open —~~ **Applied 7 Aug 2026** — two of six scope dimensions bound on nothing

> **✅ CLOSED IN THE MODEL, AND ONLY IN THE MODEL.** `Exception` gained
> `costCentre: string | null` and `legalEntity: string | null`, and `TagPolicy`
> gained `legalEntityKey`. The section below is left exactly as written because
> it is the argument for the change and the argument is what has to survive; the
> table's two `**nothing**` rows now read `Exception.costCentre` and
> `Exception.legalEntity` (`domain.ts`).
>
> **Four things this did NOT do, stated so nobody reads the tick as more than it is.**
>
> 1. **Nothing reads the columns.** There is no queue, no SQL, no filter. The
>    dimensions moved from *unenforceable by construction* to *representable and
>    unenforced* — the same distance `view_metering` moved on 7 Aug, and the same
>    caution applies. A control that is representable and unwired still looks
>    present in an access review.
> 2. **The null rule is carried by SQL semantics, not by a function.** An
>    untagged exception must be OUTSIDE every narrowed assignment, never inside
>    all of them. `NULL IN ('CC-1100')` is NULL and `WHERE` drops the row, which
>    is the right direction and is the *only* reason it holds. A hand-built
>    matcher in application code that reads null as "unscoped" reverses it and
>    would look reasonable doing so. Written down at the field for that reason.
> 3. **The resolver does not exist.** Both values are specified as resolved at
>    raise time from `TagPolicy` through `TagKeySpec.settableAt` precedence, the
>    same at-write discipline as `SourceDocument.purgeAfter`. Nothing implements
>    that. Read-time resolution would let a policy edit silently re-scope who can
>    see an already-open exception, so the discipline matters more than usual.
> 4. **The spelling divergence is now load-bearing and is still unresolved.**
>    `UsageRecord.costCenter` is American; `AssignmentScope.costCentres`,
>    `CardFilter.costCentres` and `Exception.costCentre` are British. The new
>    field takes the spelling of the dimension it must join against, because that
>    join is an authorisation decision. One spelling should win; it is a rename
>    across two modules and two contract files and belongs in its own commit.
>
> `ScopeHierarchy` (§1, row 3) was already the intended cascade over these two
> dimensions and was blocked on exactly this. It is now unblocked.

`AssignmentScope` has six dimensions. Against the exception queue — **the primary
read surface of the product** — two of them are inert.

| Dimension | Binds on `Exception` via | Verified |
|---|---|---|
| `domains` | `Exception.domain` | `domain.ts:2204` |
| `definitionIds` | `Exception.definitionId` | `domain.ts:2205` |
| `valueCeiling` | `Exception.valueAtRisk` | `domain.ts:2209` |
| `solutionIds` | transitively, via `Solution.definitionIds` | `domain.ts:1917` |
| `costCentres` | ~~**nothing**~~ `Exception.costCentre` | added 7 Aug 2026 |
| `legalEntities` | ~~**nothing**~~ `Exception.legalEntity` | added 7 Aug 2026 |

`Exception` (`domain.ts:2179`) carries no cost centre and no legal entity, and a
repository-wide search finds neither field on any entity: `costCentre` and
`legalEntity` appear only as *scope dimension names* in `access.ts` and
`presentation.ts`. The nearest thing that exists is `UsageRecord.costCenter`
(`billing.ts:200`) — a different spelling, on a billing record, resolved from
`TagPolicy.chargebackKey` (`domain.ts:1129`).

**So a role scoped to two cost centres is, on the exception queue, unscoped.**
The narrowing typechecks, reads correctly in an access review, renders in an
admin UI, and does nothing. That is worse than an absent control, because it
looks like a present one — the same failure class as
`ApprovalConfig.segregationOfDuties` being vacuous against an agent proposer
(§5), and as `MAX_GRANT_HOURS` having zero call sites while its comment claimed
enforcement (§8.5).

It reaches further than the queue. `presentation.ts` intersects **both**
dimensions on every card binding (`presentation.ts:1042`, `presentation.ts:1050`)
and its own header uses two users with different `costCentres` as the worked
example of why a dashboard does not confer its contents
(`presentation.ts:36`). The mechanism is correct end to end; **the attribute it
filters on does not exist on the row.**

The machinery to fix it is already built and unwired: `TagPolicy`
(`domain.ts:1126`) declares a closed vocabulary with `settableAt` origins
including `definition`, `document_type`, `intake` and `run`. What is missing is
the **projection of a resolved tag onto `Exception`** — the same denormalisation
`domain`, `definitionId` and `severityRank` already received for exactly this
surface, and for exactly this reason.

> **Decide before building the queue, not after.** A denormalised column added
> later needs a backfill over every open exception, and the value has to be
> reconstructed from a `TagPolicy` that may have changed in the interim.

**This paragraph is why the change was taken on 7 Aug rather than with the
queue.** It was the cheapest it will ever be: two nullable columns on a table
with no rows and no reader. The alternative was a backfill in which every value
is a *guess about who was allowed to see what*, reconstructed from a policy that
had since moved — and a guessed authorisation attribute is not one an auditor can
be shown.

### 11.11 Recorded, not solved

Four more, none of which is a decision anyone has taken.

**One capability does install, upgrade *and* disable.**
`SOLUTION_CONTAINER_CAPABILITY` (`access.ts:2008`) maps all three
`SOLUTION_CONTAINER_ACTS` to `install_pack`, so **switching off a live
reconciliation costs exactly what installing one costs.** Defensible on one
reading (both are configuration acts of similar blast radius) and uncomfortable
on another (an install is additive and reviewable; a disable is an outage). Left
as one verb *deliberately* — *"disable feels like it should be separate"* is not
the kind of argument that earns a capability number. Recorded so that when
someone makes the argument properly they find the table, rather than discovering
the collapse by reading three call sites.

**No canonicalisation scheme exists for any hash in this repository.**
`UsageAttestation.bodyHash` says *"canonical body"* and **nothing anywhere
defines canonical** — no JCS, no RFC 8785. `RecordChain` now adds two more hashed
streams on top of that undefined base (`governance.ts:899`). A hash over JSON
whose serialisation two implementations disagree about is the CVE-2017-12635
shape: one document, two parsers, two authorisation answers. **Pick a scheme
before the first hash is computed** — afterwards every stored chain is bound to
it, and re-canonicalising means re-chaining history you were relying on not being
able to rewrite.

**Three model identities are still bare strings that skip `resolveModel()`.**
`Scorer.model` (`evaluation.ts:125`), `PackBinding.modelOverride`
(`domain.ts:1654`) and `ProposalActor.agent.modelId` (`domain.ts:2532`).
`resolveModel()` (`catalog.ts:124`) is **the only executable enforcement of
residency in the codebase** and rejects `global.*` routing unconditionally;
invariant 7 says residency survives inference, and a bare string is how it stops
surviving — silently, while the deployment diagram still looks compliant.
`agents.ts` closed this for agents by binding a `ModelCatalogEntryId` and
deliberately shipping **no denormalised `modelId` field** (`agents.ts:681`),
which is the pattern the other three should follow. Note the count moved: the
module header says eight such fields (`agents.ts:668`); three are named and the
full inventory has not been taken.

**There is no `author_harness` verb**, so harness authoring borrows
`author_procedure` (`agents.ts:514`). Not invented locally, and correctly so —
`CAPABILITIES` is platform-defined and a new module does not help itself to a
member. `author_procedure` is the nearest true verb and is already outside every
`PARTNER_CAPABILITY_MASK`, which is the property that matters most: **a partner
supporting a customer must not be able to rewrite what that customer's agents are
told.** Worth revisiting if the verb is ever split — but the borrowing means a
harness edit and a procedure edit are indistinguishable in an access review.

---

### What §11 changes about the build order

**Two items move from *recorded* to *done*, and §8 of `docs/HANDOFF.md` is
updated accordingly:** `ProcedureStepExecution` (`domain.ts:2451`) and the
`decide()` fold (`access.ts:985`) both landed, as did `CAPABILITY_RESOURCE_CLASS`
(`access.ts:517`).

**Three become blocking, because something now rests on each:**

- **A canonicalisation scheme.** Three hashed streams now depend on a definition
  that does not exist. This is cheapest before the first hash and irreversible
  after.
- **A cost-centre projection onto `Exception`.** Two scope dimensions are inert
  until it lands, and a backfill is the cost of deferring it past the queue.
- **A decision on the six empty classes** — gap or statement, per class. The
  `telemetry` case is a live inconsistency rather than an open question.

**One thing is now cheaper than it will ever be again:** `Endpoint.id` is
`string`, deliberately, because branding it is a separate change with a call-site
audit behind it (`domain.ts:1891`). Every solution assembly written before that
change is another call site.

---

## 12. The services, regrouped by function

> **Status:** analysis, 5 Aug 2026. Visual: `docs/service-stacks.html`.
> **Provenance:** one agent, read-only, against the four contract files and the
> thirteen model modules. Counts re-verified independently before recording.

### 12.1 Why regroup at all

The service map has always been organised by **plane** — F1–F14 foundation,
C1–C13 capability, X1–X8 control plane. That grouping answers *"where does this
run and what may it read"*, which is the question the isolation model asks.

It does not answer *"is this a complete system"*, because a plane is not a
function. Regrouping by what a service **does** was the only way to see that two
whole capabilities are named everywhere and built nowhere.

**Eleven stacks, 35 services, and 67 of the tree's 70 contract operations** — the
other three belong to no F/C/X service, see the note — **and the totals reconcile
exactly**, which is the first evidence the grouping is sound rather than
convenient:

> ⚠️ **This line said *"65 operations"* until 10 Aug 2026, and the table below
> summed to 65.** Two operations landed on `X8 Onboarding & Support Access`
> (`fetchDiagnosticJobs`, `uploadDiagnosticBundle`), so **stack J goes 4 → 6**
> and the plane-numbered total goes 65 → 67. The tree derives **70** contract
> operations, not 67: the other three are `data-plane-local.openapi.yaml`, a
> fourth OpenAPI tier added the same day whose operations belong to **no F/C/X
> service** and so appear in no stack here. `35` services is unchanged.
> 🛑 **That tier is not the administration surface** — §12.2's "every operation
> is runtime, none is administration" finding below is untouched.

| | Stack | Services | Ops |
|---|---|---|---|
| A | Spine — authenticate, authorise, meter, log | F1 F2 F3 F6 F9 | 6 |
| B | Governance & data protection | F4 F5 F8 F11 | 6 |
| C | Security & trust boundary | F12 F13 F14 | 3 |
| D | Core reconciliation | C1 C2 C3 C4 C5 C6 | 13 |
| E | Agency — procedure, agent, resolution | C7 C8 C10 F7 | 9 |
| F | Correspondence & endpoints | C9 | 7 |
| G | Presentation / BI | C11 | 3 |
| H | Catalog — packs, templates, blueprints | X1 X2 C12 | 6 |
| I | Commercial | X3 X4 X5 | 5 |
| J | Observability, evaluation & support | F10 X6 X7 X8 | 6 |
| K | Autonomy governance | C13 | 3 |

Seven services could argue for a second home. Each is placed with its runner-up
named — the two that matter are **F14 in security rather than agency** (it must
not be the builder's own gate, which is precisely why the agent-builder stack has
no service left) and **C9 in endpoints rather than core** (it is a trust boundary
and a disclosure surface, not a reconciliation step).

### 12.2 The completeness answer, and it is one gap rather than many

**Two stacks have no service at all.**

- **Agent builder.** `model/agents.ts` is 1,309 lines of types and ten pure
  functions with **zero CRUD**. `harnessMayActivate()` tests eligibility; nothing
  activates. No `author_agent` capability exists.
- **Endpoints management.** A fully designed noun — direction, verification
  expiry, `writebackEnabled`, `boundUntil`, `credentialRef` — with **three
  capabilities aimed at it** and no service in any tier that owns it. Nobody
  creates, verifies, rotates or disables one, and `Endpoint.verifiedAt` gates the
  outbound disclosure control while nothing sets it.

Both are symptoms of the same thing, already recorded in
`docs/contracts/README.md` and still true: **every operation is runtime, none is
administration.** The reason it stayed invisible is worth repeating because it
generalises — *every review so far has followed a reconciliation through the
system; nothing has followed a customer through onboarding.*

### 12.3 The spine: present as design, absent as enforcement

The framing that produced this section is explicitly AWS-shaped — IAM, metering
and audit before the action, on every verb. The distance from that is the most
important thing the regrouping surfaced, and the model states it in its own
words rather than needing to be caught:

> AWS's IAM works not because IAM exists but because **there is no path to a
> resource that bypasses the API call.** This model had evaluators and **nothing
> forced the call.**

> It does not make an unauthorised act impossible. It makes one **unrecordable.**

That is **recordability, not reachability**, and against a BYOA root holder it
may be the only property available. It should not be described as the AWS
property, and `docs/systems-end-to-end.html` currently does — *"Nothing happens
that is not metered, and nothing is metered that cannot be seen centrally"* is
contradicted by `byoa-topology.md` and already retracted in `HANDOFF.md`. **It is
the most load-bearing false claim in the document set.**

Four findings sharpen it, all verified:

1. ~~**Zero of the 37 capabilities appears in any of the three contract
   files.**~~ *(36 from 7 Aug 2026 — §11.9a.)* ⚠️ **THIS FINDING WAS CLOSED ON
   16 Aug 2026 AND IS LEFT HERE RATHER THAN DELETED, BECAUSE IT IS THE FINDING
   THE WHOLE SECTION RESTS ON.** All 72 declared operations across FOUR files now
   carry `x-capability` — 38 of them a real capability, 34 a stated `exempt:`
   with its reason on the operation. So the authorisation axis and the API
   surface ARE connected, at the level of a declaration.
   🛑 **WHAT IS NOT YET TRUE, AND DO NOT READ THE ANNOTATION AS MORE THAN IT
   IS: NOTHING EVALUATES IT.** `TenantSession` carries one field, `tenantId`, so
   no handler can build a `PrincipalContext`, and `decide()` and `authorize()`
   are called from no served path. The map exists; the evaluator does not.
2. ~~**Thirteen of 36 capability-tier operations declare no denial at all**~~ —
   ⚠️ **CLOSED 16 Aug 2026, AND THE COUNT HELD AT A LARGER DENOMINATOR: it was
   thirteen of THIRTY-EIGHT.** They were exactly the reads, as this line said,
   and `listRuns` and `getRun` were two of them while both were already SERVED.
   All thirty-eight now declare `403` — derive it, do not read it:
   `node --test tests/contracts/capability-annotation.test.mjs` (assertion 3d).
   That was a contract change to live behaviour, not a document edit, because
   `server/contract/routes.ts` makes the document the validator and a handler
   returning an undeclared code is a contract violation.

   > ⚠️ **THE `origin/main` SIDE OF THE 16 Aug 2026 MERGE STILL READ THESE TWO AS
   > OPEN, AND IS QUOTED HERE RATHER THAN DISCARDED**, because a reader who
   > pulled `main` that morning read exactly this and would have believed the
   > findings were live: *"Zero of the 38 capabilities appears in any of the
   > three contract files … The authorisation axis and the API surface are not
   > connected"*, and *"Thirteen of 36 capability-tier operations declare no
   > denial at all — and they are exactly the reads."* Both were true of `main`
   > and neither is true of the merge. ⚠️ **Its `38` is also not this record's
   > `38`**: `main`'s thirty-eighth was `view_endpoint` and this branch's was
   > `admit_source`. The merged roster is **thirty-nine** and the two counts above
   > are the operation counts, which the merge did not move.

3. **`redeemAuthorization()` takes a fully materialised grant.** The caller has
   already loaded the row and can as easily skip the call. There is no branded
   proof-carrier a data-access function could demand.
4. **`resolveDashboard()` and `purgeVerdict()` have zero call sites.** A
   carefully built evaluator with no consumer is this codebase's recurring
   defect, and it now has four named instances.

> **The one place enforcement is structural** is `presentation.ts`, where
> `ViewerScopedFilter` is branded with a module-private `unique symbol` so
> `resolveCard()` is its only producer. A query layer typed to it **cannot** be
> handed the author's filter — not by shortcut, not by a later refactor. **That
> is the pattern the rest of the spine needs and does not have.**

### 12.4 An invariant that quietly stopped holding

**"Exactly one cross-tenant read path"** now has three shapes:

1. Partner, via a live `PartnerAccessGrant` intersected with the capability mask
   — the intended path.
2. Platform staff, via `TenantAccessGrant` — invariant 8's separate mechanism,
   correctly refused categorically inside `decide()`.
3. **Cross-tenant aggregates** — partner health, platform health, partner billing
   — bounded by a five-tenant cohort floor and a seven-day window floor, but
   reads across tenants nonetheless.

Each is individually argued. None is listed. Either restate the invariant as
*"exactly one cross-tenant path to tenant **row** data"*, or name the third shape
as an exception — because **an invariant with three unlisted carve-outs stops
being checkable**, which is the only property an invariant has.

### 12.5 Interaction, and three inversions

Every capability service depends downward on the spine, and all twelve
control-plane operations are data-plane-initiated with `dataPlaneId` derived from
the SigV4 principal rather than a request body. **Invariant 3 holds in the
contract.** Three edges do not run the expected way:

| Edge | Verdict |
|---|---|
| **C1 Intake ↔ C9 Correspondence** | A real cycle, benign — the two directions carry different artefacts. But *"an attachment from an unadmitted message never reaches extraction"* is true only if the C9→C1 direction is the **only** one producing a `SourceDocument`. It should be drawn rather than assumed. |
| **F14 → X7** | **A foundation service depending on a control-plane service.** Under BYOA that is a foundation service in the customer's account depending on an asset in ours. Addressed nowhere. |
| **C13 → F3** | A capability service producing a foundation service's configuration. Deliberate and correct — *recommends, never applies* — but the loop has no closure: nothing writes the resulting `Policy` row. |

### 12.6 Two absences that are unargued rather than deliberate

**C3 Rule Evaluator and C4 Archetype Engine appear in no contract** — not as a
path, not as a tag, not in prose. They may be legitimately internal, with no
browser surface. But C8, X5 and X7 each have their absence *argued in the specs*,
and these two do not. **They are the only unargued absences in the set**, and an
unargued absence is indistinguishable from an oversight.

### 12.7 What this changes about the build order

Nothing here is a new decision; it is a map of what the decisions already imply.
Three things move:

- **The administration tier stops being one item and becomes the precondition for
  four stacks.** Agent builder, endpoints, pack authoring and commercial all wait
  on it.
- **The capability↔contract disconnection is now the largest single gap.** Thirty-four
  capabilities that no operation names cannot gate anything, whatever the model says.
- **A branded proof-carrier is the cheapest structural fix available**, and
  `presentation.ts` already demonstrates it working on one path.

# Model Change Ledger — Adjudicated

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** PARTIAL — its rulings stand; it predates the v1 trim entirely, so it says nothing about what is built.
> Adjudicated 4 Aug 2026 and not maintained since. The rulings are still the rulings — this file supersedes the swarm reports where they conflict, and those are off the trunk at `archive/design-record`. ⚠️ **Two of its rows carry actions that were never taken:** it ordered a correction to `docs/data-governance.md` §3's residency claim, and that correction has not been made — **G82 has since made the same sentence worse**; and it gates the `Account` / `SupportAccessGrant` work on something that has since happened, `Account` being applied and `SupportAccessGrant` renamed `TenantAccessGrant`. Neither row was updated.
> *Banner added 8 Aug 2026.*

> **Status:** decision record. Supersedes the six swarm reports where they
> conflict; those remain the evidence base (~9,500 lines) and carry the file:line
> citations behind every ruling here. **They left the trunk on 6 Aug 2026** and
> are at `archive/design-record:docs/swarm/` — list them with
> `git ls-tree archive/design-record docs/swarm/`, read one with
> `git show archive/design-record:docs/swarm/red-1-isolation.md`.
> **Date:** 4 Aug 2026
> **Method:** six independent agents — three strengthening, three attacking —
> then adjudication. Every proposal in the reports was compile-verified against
> the real model by its author. Findings below are ruled on, not merely listed.

---

## Verdict

**The model is well-made within the topology it chose. The problem is that the
topology was never identified as a choice.**

That is red-2's sentence and it is the most useful thing to come out of the
review. `docs/domain-model.md` §7 presents finance-and-KYC-in-one-core as a
*proof* of domain neutrality. It is not. Both examples are the same shape — N
documents, equi-join on one identifier, pairwise field comparison — differing
only in vocabulary. What was demonstrated is **vocabulary neutrality within a
fixed matching topology**: real, useful, and worth keeping. What was claimed is
broader.

Everything below follows from taking that seriously.

**Convergence is the strongest signal.** Where a green agent and a red agent
reached the same finding independently, from opposite mandates, it is treated as
settled: line-item grain, currency, the partner-scope bypass, and `MatchGroup`'s
missing tenant were each found twice.

---

## 0. Already applied

| Fix | Finding | Why it went in immediately |
|---|---|---|
| `MatchGroup extends TenantScoped` | red-1 R1-01 | Only row in the reconciliation chain without a tenant, carrying a national identifier in `keyValues`. RLS cannot be written against a table with no tenant column, so the *stated primary control* was structurally inapplicable and the failure silent. |
| `LabelledExample` → discriminated union | red-1 R1-06a | `{tenantId: null, provenance: 'observed'}` typechecked — customer data as a platform asset. Now unrepresentable; `ObservedExample` carries `dataClass` and `purgeAfter`. |
| `model/observability.ts` | green-3 #5, red-1 R1-05 | Prompt redaction existed; trace redaction did not. Three planes with distinct content **and cardinality** rules. |
| `export TenantScoped` | prerequisite | Was private; no other module could express tenant scoping. |

All four are in `2968a8bc`. Model typechecks clean.

---

## 1. P0 — before any code is written

Ranked by consequence, not by discovery order.

### P0-1 · Purging a document does not erase the personal data

**red-3 F1. The contradiction I am most confident about, and it is compliance-critical.**

Three decisions, each correct alone:

- `ObservedValue.value` stores a **copy** of the extracted value
- `exceptionDays` is deliberately **longer** than `sourceDocumentDays`
  (now `days.exception` and `days.source_document` — re-keyed 7 Aug 2026, same
  two windows; the four locations named below that had *no retention field at
  all* now each have a `RetentionClass`, which is a place to put an answer and
  not yet an answer)
- `Explanation` is **stored, not derived**, so it survives rule changes

Together: purge a passport at day 30, and the holder's name and date of birth
remain in plaintext inside `Exception` for seven years. Four further locations
have **no retention field and no purge path at all** — `MatchGroup.keyValues`,
`AuditEvent.before/after` (retained longest), `ObservedExample.expected`,
`ScoreResult.rationale`.

`DataSubjectRequest.kind: 'erasure'` is therefore a status field over an
operation the system cannot perform.

**Ruling — adopt green-2's design, with one change.** Introduce
`SubjectIndexEntry` + a `SubjectLocation` union written **at creation time**
(not discovered by scanning), `LegalHold`, and `purgeVerdict()` with precedence
`HOLD > MINIMUM > ERASURE > MAXIMUM`. Keep green-2's `out_of_reach` disposition —
an honest erasure plan that admits what it cannot reach is worth more than one
that silently misses.

**The change:** green-2 proposed a per-tenant HMAC for `subjectRef`. Adopt it,
and make the reason explicit in the model — a *global* subject key would turn
the privacy index into a cross-tenant correlation surface, which is the failure
this whole design exists to prevent.

**Why P0 and not later:** the synthetic-only sandbox — correct on its own terms —
guarantees this stays invisible until the first production KYC tenant, by which
point stored explanations are immutable by design and there are millions of rows.

### P0-2 · Platform support access is unmodelled

**green-2's top finding.**

The only cross-tenant path *guaranteed* to be exercised in production: a
customer files a ticket, someone at 1CloudHub looks. Today that happens through
a shared credential, a quietly-inserted `Membership`, or a console session — no
expiry, no second approver, no tenant-visible trace.

We built a rigorous front door for **partners**, who have strictly less access
than the operator, and left the operator's door unlocked.

**Ruling — adopt in full.** `SupportAccessGrant`, `SupportSession`, `AuditActor`,
`Tenant.supportAccessMode`, `evaluateSupportAccess()`. Two-person approval with
`approvedByStaffUserId !== staffUserId`, hours not weeks, tenant notified, and
green-2's neat device kept: `visibleToTenant: true` as a **literal type**, so a
support session the customer cannot see is unrepresentable.

**Compounding effect that seals it:** without support-access modelling and read
audit, `BreachRecord.affectedTenants` is unpopulatable. After a staff-credential
incident the only defensible response would be to notify *every* tenant.

### P0-3 · `Membership.partnerScope` bypasses `PartnerAccessGrant`

**Found by green-2 and red-1 independently.**

`PartnerAccessGrant` is the designed door. `Membership.partnerScope` is a second
one: a free `PartnerId | null` with no invariant tying it to `Tenant.partnerId`,
and `ApprovalConfig.approverRoles` admits `'partner_admin'` — so partner staff
can be granted approval rights on customer exceptions **with no grant anywhere
in the path.** The policy layer never references the grant type at all.

Red-1 adds that `PartnerAccessGrant.grantedBy` is self-issuable: `User` has no
partner affiliation, and during onboarding the partner is often the only actor
present. A partner-issued grant is indistinguishable from customer consent.

**Ruling — adopt green-2's `effectivePartnerRole()` + `roleCeilingForScope()`.**
Grant scope becomes a **ceiling** on role: `commercial_only` yields `null`, and
no partner scope ever yields `approver` or `tenant_admin`. Add
`Membership.grantedBy / expiresAt / revokedAt / viaGrantId` — red-1 correctly
noted that a tenant transferred between partners currently leaves the old
partner's memberships intact, which falsifies the "single-column update" the
flat design was sold on.

### P0-4 · `Policy` is mutable and unversioned

**red-3 F4.** `PolicyEvaluation` records `policyId`; `Policy` has no version and
every field is editable. An auditor following the pointer reads *today's* spec,
not the one that decided.

This defeats the engine's stated purpose — *"the question is never what did the
agent do, but why was it allowed to."* The model already solved exactly this for
`Explanation` ("stored, not derived… survives a rule change") and did not
transfer the lesson.

**Ruling — adopt.** Version `Policy`; `PolicyEvaluation` pins
`policyId + policyVersion`. Same treatment for `MatchRule`, which red-2 F1 shows
has the identical defect: `Exception.ruleId` points at a mutable rule, so a
stored v1 explanation contradicts any UI rendering the current rule.

### P0-5 · Line-item grain is undefined — and §7's own example depends on it

**green-1 #1 and red-2 F3, independently.**

`matchKeys` joins on `header.po_number` (document grain). `r_price` compares
`lines[].unit_price` across slots (line grain). Nothing pairs invoice line 3
with PO line 3. Worse: `ExtractedValue.value` is `string | number | null` — **an
array of line items does not fit the type.** `model/examples.ts` is not
executable as specified.

Line-order mismatch is the dominant case in real accounts payable, not an edge
case. The engine could zip by position (five wrong exceptions when a vendor
sorts differently) or aggregate (masking a real overcharge offset by an
undercharge), and the model does not say which.

**Ruling — adopt green-1's `LineMatchKey`, `RuleScope: 'group' | 'line'`,
`Exception.lineKey`.** Enters the core as nullable so KYC leaves it null — the
same neutrality mechanism `cardinality: 'optional'` already established.

### P0-6 · Money has no currency

**green-1 #4 and red-2 F4.** `currency` appears exactly once in all of `model/`,
in `policy.ts`. A USD invoice against an SGD PO reports a 35% critical variance
on a correct invoice.

The sharpest consequence: `AutonomyConfig.autoResolveValueCeiling` — *the
motivating example in `policy-and-billing.md`* — is unenforceable, because
`Delta.numeric.absolute` is a bare currency-less number.

**Ruling — adopt green-1's `ExtractedScalar` union with `Money` (currency +
minor units + exponent), `FxConversion`, `FxPolicy`, and money/rounding
tolerance arms.** A governance control that cannot be evaluated is not a control.

### P0-7 · `UsageRecord` has no idempotency key

**green-3 #1.** At-least-once delivery double-counts tokens into an append-only
table with no compensating instrument. This is a billing defect that corrupts
the immutable record.

**Ruling — adopt,** keyed off the provider request id so the meter counts what
the provider bills.

### P0-8 · The platform can price but cannot cost

**green-3's biggest commercial risk.** No type anywhere records what anything
costs 1CloudHub. `PartnerBillingSummary.margin` is the *partner's* margin, shown
to the partner. `wholesale − AWS` appears nowhere.

Three compounding factors: metering is self-reported and never reconciled
against the Bedrock bill (system-prompt overhead, retries, cache writes, scorer
spend all unmetered); the reseller structure inverts the incentive, so a
below-cost wholesale card loses money *in proportion to the partner's success*;
and `commitmentMinor` locks a mispriced rate for a year.

**Ruling — adopt `ProviderCostRecord` + `CostReconciliation` + `PlatformMarginLine`.**
Not retroactively reconstructable: `UsageRecord` is recoverable, an AWS bill
never captured against a period is not.

### P0-9 · `Id<T>` is private

**green-2.** A one-word fix that blocks nearly every other proposal. Export it.

---

## 2. P1 — before finance and KYC ship

| # | Change | Source | Note |
|---|---|---|---|
| P1-1 | `RulePredicate` discriminated union + one-sided comparators; real arithmetic with operators and grouping | green-1 #2, red-2 F2 | `operands[]` + `sum_equals` has two plausible readings giving opposite answers. Blocks tax, retention, returns. |
| P1-2 | Definition versioning + run lineage; `Exception.carriedForwardFrom` | green-1 #3, red-2 F1 | March's exception stays open forever after April's run resolves it. Also inflates the billable `exceptions_raised` meter on every re-run. |
| P1-3 | Exception queue denormalisation — 5 columns | red-3 F10 | 3 joins to reach `domain`; ~150–250 ms warm vs ~2–5 ms. Also: `ORDER BY severity` on the string union sorts `critical, high, low, medium`. |
| P1-4 | `PolicyEvaluation` retention + partial index on denials | red-3 F8 | ~1.41M rows/month/tenant — larger than the metering table. `RetentionPolicy` covers 3 of at least 8 retained classes. |
| P1-5 | `Meter` aggregation rule (stock vs flow) | red-3 F9 | `SUM(storage_gb_month)` over daily samples over-bills **30×**. |
| P1-6 | `ModelCatalogEntry` + `resolveModel()` | green-3 #4 | `requireZeroRetention` currently has no data to evaluate against — a claimed control the system cannot enforce. |
| P1-7 | `Invoice`, `InvoiceNumberSeries`, `TaxLine`, `CreditNote` | green-3 #3 | Gapless numbering; per-line tax treatment (one invoice legitimately mixes SG 9% standard-rated and zero-rated export); `taxRateVersion` because GST moved 8%→9%. |
| P1-8 | `ReconciliationPeriod` + cut-off | green-1, red-2 F7 | Zero grep hits for `period`/`fiscal`/`asAt`. Goods received 31 Mar, invoiced 2 Apr — which period owns the exception? |
| P1-9 | `SolutionPack` must not point at tenant-scoped rows | red-3 F5 | Demonstrated by our own proof file: the platform Finance pack references Acme's definition. |
| P1-10 | `EffectivePolicySet` type defect | green-2 | `provenance` requires a `spend` key the interface lacks. Six kinds, five configs. |
| P1-11 | `SourceDocument` storage pointer | green-2 | `filename` only. `purgeAfter`/`purgedAt` describe a lifecycle for a blob the model cannot address. |
| P1-12 | ~~`retentionWindowValid()`~~ **Applied 7 Aug 2026** | green-2 | A plan downgrade via `Entitlement.retentionDaysMax` can silently undercut a regulatory floor. The billing layer can execute a compliance breach and never know. **Shipped with all three bounds** — the audit floor, the entitled ceiling this row names, and a caller-supplied statutory minimum per class. Returns **every** violation rather than the first: an admin told about one number at a time takes four attempts to save a policy, and the fourth rejection is where people start choosing numbers that pass over numbers they meant. |
| P1-13 | `ApprovalDecision` keyed to `ProposalId`; typed `ResolutionAction` | green-1 #5 | `ApprovalConfig.quorum` and `segregationOfDuties` are unimplementable against current keys — a defect, not a gap. |

---

## 3. Where I ruled against a team

| Claim | Ruling |
|---|---|
| **red-2: the domain-neutrality proof "does not hold"** | **Partially upheld.** The *claim* overreaches and §7 will be rewritten to state what was actually demonstrated — vocabulary neutrality within a fixed matching topology. But the design is not abandoned: arity-as-data, `SlotRole` and non-optional `Explanation` all survived attack, and red-2 says so. Fix the sentence, keep the model. |
| **red-3 F4: "the design forbids its own fix" for `Budget.enforcement: 'block'`** | **Overruled.** A rated money counter maintained atomically is a **cache**, not a collapse of metering into billing. The invariant is that `UsageRecord` stays immutable and unpriced and totals remain recomputable from it — a derived counter violates neither. The finding is right that a hard cap is a distributed-counter problem and the latency estimate stands; the framing that the architecture prohibits solving it does not. |
| **green-3: `PublishGate` versus "scoring never blocks"** | **Upheld as proposed.** The stance is about the *runtime path* — a run must never wait on a scorer. A gate blocks a *release*. No conflict. |
| **red-3 F14: global `User` falsifies the SG residency claim** | **Upheld, and the doc is wrong.** `docs/data-governance.md` §3 says SG residency avoids the Transfer Limitation Obligation "entirely". With a global `User` table carrying email and display name, that is overstated. Correct the doc; decide separately whether `User` shards by region. |
| **red-1: `BreachRecord` readable by nobody the model describes** | **Upheld — and it generalises.** `ROLE_KEYS` has no platform-operator role at all. The most privileged access path in the system is the one that was never written down. Folded into P0-2. |

---

## 4. Deferred, with reasons

| Item | Why not now |
|---|---|
| Sanctions / PEP screening (red-2 F11) | Breaks the model four ways — needs fuzzy *find* not fuzzy *compare*, a shared list that is not tenant-scoped, evidence of a *negative* result, and hit disposition. That is a distinct product capability, not a gap in this one. Revisit when KYC goes beyond document-vs-registry. |
| Conditional rules (red-2 F5) | Real — "2% domestic, 5% international" has no encoding and the two-rule workaround false-criticals every international invoice. Lands naturally with P1-1's predicate union. |
| Medical-records topology | Needs an output artifact the model does not have — only `Exception` exists — plus ontology-backed comparators. The pack is `announced`, not built. Correctly out of scope. |
| Cross-tenant agent reuse within one `Account` | Noted in `docs/tenancy-topology.md` §6. Wait for real demand. |
| `Account` / `SupportAccessGrant` application | Specified in `docs/tenancy-topology.md`; apply with P0-2, not before. |

---

## 5. Sequence

Dependency order, not a schedule.

1. **P0-9** (`Id<T>` export) — unblocks everything else.
2. **P0-1, P0-2, P0-3** — the isolation and erasure set. Nothing may touch production data before these exist.
3. **P0-5, P0-6** — line grain and money. Both are prerequisites for the finance pack being *correct* rather than merely compiling.
4. **P0-4** — policy and rule versioning.
5. **P0-7, P0-8** — metering integrity and cost capture. P0-8 is the one that cannot be reconstructed later.
6. **P1** in table order.
7. Rewrite `docs/domain-model.md` §7 to claim what was proven.

---

## 6. What survived attack

Recorded because a review that only finds fault is not calibrated:

- **Arity as data.** `SourceSlot[]` + `Cardinality` genuinely works; one-invoice-to-three-GRNs reconciles today.
- **`SlotRole`.** Load-bearing, observation-derived, and the thing that gives explanations their direction.
- **Non-optional `Explanation`.** Both teams defended it. An orphan belongs on `MatchGroup` with `outcome: 'unmatched'`, never as an `Exception` with a null explanation.
- **The metering / rating / billing separation.** Attacked directly and held.
- **Tenancy, once `MatchGroup` was fixed.** red-1 lists ten boundaries that genuinely hold.
- **Flat tenants with `Account` above for commercial rollup.** No agent proposed nesting tenants.

# Data Governance and Compliance

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** PARTIAL — authoritative for the PDPA control mapping and the classification and retention posture; **its residency section is out of date and carries an unactioned correction.**
> 🛑 **§3 has TWO outstanding corrections, neither made.** (1) `docs/model-change-ledger.md` upheld a red-team finding on 4 Aug 2026 that §3 **overstates** the Singapore residency claim, and ordered *"correct the doc"* — it was never corrected. (2) **G82, 8 Aug 2026**, puts the BI layer in `ap-southeast-2`: tenant data leaves the residency region on **every SPICE refresh**, a standing pipeline rather than a one-off transfer. §3 still reads as a closed decision that keeps everything in region. ⚖️ **G82 is not a commitment until counsel answers L7** — `docs/HANDOFF.md` §4.3. The ⚖️ items in §9 are live and none is asserted as settled.
> *Banner added 8 Aug 2026.*

> **Status:** design record.
> **Date:** 4 Aug 2026
> **Primary regime:** Singapore PDPA, structured so a second regime is an
> addition rather than a rewrite.
>
> **This is architecture, not legal advice.** Controller/processor
> determination, DPA drafting, breach-notification judgement calls and which
> regimes bind 1CloudHub are legal determinations requiring counsel. Items
> needing that review are marked ⚖️ and collected in §9.

---

## 0. Baseline: there is nothing

Before design, the honest starting point. A scan of the application being
replaced — `archive/sap-line:src/`, 349 files — for retention, consent,
classification, residency, encryption, anonymisation and PII handling returns
**zero matches on every term**. Re-runnable:
`git grep -iE 'retention|consent|classification|residency|anonymis' archive/sap-line -- src/`.

The eight `delete_*` operations in the API surface (`delete_user_by_admin`,
`delete_vendor`, `delete_sop_version`, …) are configuration-entity deletes.
**None purges a document or erases a data subject.**

So this is not a gap analysis against a partial implementation. It is a
greenfield control set.

---

## 1. Why this is sharper than typical SaaS

Two of the four named domains carry the heaviest data classes that exist.

| Domain | Data | Weight |
|---|---|---|
| Finance | commercial records, some bank details | lightest |
| **KYC** | identity documents, DOB, national identifiers | personal + AML/CFT recordkeeping |
| Credit underwriting | financial + personal | adds automated-decision exposure |
| **Medical records** | health data | heaviest in every regime |

**The data subject is usually not a user.** In KYC, the person whose passport is
verified has no account, never authenticates, and cannot be identified by
`UserId`. Access and correction requests arrive *through the tenant* and are
keyed by a subject reference. This is why `DataSubjectRequest.subjectRef` is a
tenant-scoped opaque reference and explicitly not a `UserId`.

**The product thesis is already the right compliance architecture.** Automated
determinations about individuals attract explainability and human-review
expectations. ReconcileAI's `Exception.explanation` — non-optional, structured,
carrying provenance to the source field and page — plus a required approval step
before resolution, is close to what a regulator asks for. Worth making
deliberate rather than leaving incidental.

---

## 2. Demo posture — synthetic only, enforced

**Decision (4 Aug 2026): the sandbox accepts synthetic data only.**

This is the cheapest and largest liability reduction available. A KYC demo
invites a prospect to upload an identity document; today that document would
land in S3 in a US region, be processed by Bedrock, sit in a database whose
password is a trivial default inside a VPC with SSH open to `0.0.0.0/0`, be
readable by any authenticated user, leave no audit trail, and have no deletion
path. **Both infrastructure facts in that sentence are live and tracked** —
`docs/infrastructure-risk-register.md` **K2** (PostgreSQL 5432 and SSH 22 open to
`0.0.0.0/0` across sixteen ports) and **K1** (the database credentials in a
Lambda environment variable, alongside the IAM key). They are properties of AWS
account `000000000000`, which the rebuild inherits by decision, not of the code
deleted from the trunk on 6 Aug 2026.

### Controls

| Control | Mechanism |
|---|---|
| Enforcement | `Tenant.environment = 'sandbox'` rejects ingest unless `SourceDocument.synthetic = true` |
| Provenance | `synthetic` is stored on the row, so "was real data ever in the sandbox?" is a query, not an investigation |
| Notice | Upload surfaces state plainly that real personal data must not be uploaded |
| Retention | Short automatic purge — sandbox documents do not persist |
| Separation | Sandbox tenants are ordinary tenants; isolation is the same mechanism, not a weaker one |

**Real data belongs in a contracted environment**, under a signed agreement,
never in the sales sandbox. ⚖️ The demo terms of use should say this explicitly.

---


### 2.1 Evaluation — added 5 Aug 2026

The synthetic-only rule stands and is unchanged. It also blocked the first thing
any finance team wants to do in an evaluation: upload last month's actual
invoice.

**The answer is a third posture, not a looser sandbox.**
`TenantEnvironment` becomes `sandbox | evaluation | production`, and an
evaluation tenant **behaves as production for every invariant** — real
classification, real retention, real erasure, real policy. It adds three things
production does not have:

| | Why |
|---|---|
| A recorded **processing agreement** | Processing a prospect's real invoice makes us a processor, and invoices routinely name people. `EvaluationTerms.processingAgreementRef` **null blocks non-synthetic ingest** — the same enforcement point as the synthetic flag, asking a different question. The legal precondition becomes checkable rather than promised. |
| A **purge date agreed up front** | Everything ingested is deleted on a stated date unless the tenant converts. The purge obligation is what makes accepting real data defensible at all, and a date agreed at the start is one nobody argues about later. |
| **No entitlement lease** | An evaluation is not metered against a commercial tier. |

**Conversion is deliberate and never automatic.** Data collected under an
evaluation agreement silently continuing under no agreement is the outcome
counsel objects to, so `convertedAt` is set by an act rather than by a date
passing.

⚖️ The evaluation agreement itself — scope, duration, deletion warranty — is for
counsel. The model holds the reference; it does not hold the terms.

**One consequence worth naming.** Adding a third environment value left every
existing `SolutionPack` with no `PackBinding` for it — a hole that typechecks
perfectly and misbehaves at runtime. `bindingFor()` falls back to the
**production** binding, never the sandbox one: falling back to sandbox would run
a prospect's real data through a cheaper model with autonomy disabled, which is
both the wrong behaviour and the wrong impression.

## 3. Residency — a recommendation with an infrastructure consequence

**Decision: single region now, `Tenant.residency` modelled from day one.**

### The current region is the wrong one

Every ReconcileAI resource today is in **`us-west-2`**: Lambdas, RDS, S3,
Bedrock, Cognito. 1CloudHub is Singapore-based, and the primary regime is PDPA.

PDPA's **Transfer Limitation Obligation** requires that personal data
transferred outside Singapore receives a standard of protection comparable to
the PDPA. Keeping Singapore customers' data in Oregon makes every deployment a
cross-border transfer requiring assessment and contractual cover.

**Recommendation: build the new deployment in `ap-southeast-1` (Singapore).**

This is the moment to do it — a fresh environment is being stood up anyway, and
the alternative is migrating data later, which is materially harder than
choosing a region now. It also puts data nearer the users and simplifies
customer diligence.

⚖️ Confirm with counsel whether SG residency is required or merely prudent for
the customers in view. The architectural recommendation stands either way, since
`RegionKey` makes a second region configuration rather than migration.

### Model processing

Bedrock inference is a processing location too. If documents are processed in a
region other than where they are stored, that is a second transfer. Keep
inference in the residency region, and record model providers in the
`SubProcessor` register with `processesContent: true` — because they see
document content.

`FieldSpec.modelProcessingAllowed` exists so a national identifier can be
excluded from a prompt while a line-item description is not. Classification
drives it; screens do not each decide for themselves.

---

## 4. PDPA obligations mapped to controls

| Obligation | Control | Model support |
|---|---|---|
| **Consent** | Obtained by the tenant from its data subjects; we are not the consent surface | ⚖️ contractual |
| **Purpose limitation** | `Tenant.processingPurpose` recorded and shown | ✅ |
| **Notification** | Tenant-facing privacy notice; sub-processor register published | ✅ `SubProcessor` |
| **Access & correction** | `DataSubjectRequest` with `kind: 'access' \| 'correction'`, keyed by `subjectRef` | ✅ |
| **Accuracy** | Correction flow writes through to source records; `AuditEvent` records the change | ✅ |
| **Protection** | Encryption at rest and in transit, per-tenant isolation, no static credentials, gateway-side authorizer | design |
| **Retention limitation** | `RetentionPolicy` per tenant; `SourceDocument.purgeAfter` set **at ingest**, not evaluated at read | ✅ |
| **Transfer limitation** | `Tenant.residency` + `SubProcessor.region` | ✅ |
| **Breach notification** | `BreachRecord`; `assessedAt` distinct from `detectedAt` because the clock runs from assessment | ✅ |
| **Accountability** | DPO appointment, documented policies, `AuditEvent` as the evidence trail | ⚖️ organisational |

### Retention design notes

- `purgeAfter` is computed at ingest from the tenant's policy. Read-time
  evaluation means a policy change silently rewrites history.
- Purged documents leave a **tombstone** — `purgedAt` set, content gone. The
  audit trail must survive the data it describes.
- `days.audit_event` may never be shorter than any **business** or **content**
  class, or the record of a deletion outlives nothing.
  **Enforced since 7 Aug 2026** by `retentionWindowValid()` (`model/domain.ts`),
  which was this comment until then. It also checks the two bounds the comment
  never named: a caller-supplied statutory floor per class, and the ceiling from
  `Entitlement.retentionDaysMax` — a plan downgrade silently undercutting a
  regulatory minimum is `model-change-ledger.md` P1-12, where the billing layer
  can execute a compliance breach and never know it did.
  (Written `auditDays` / `exceptionDays` / `sourceDocumentDays` until
  `RetentionPolicy` was re-keyed on `RetentionClass`. Same rule, generalised from
  two named windows to every class of its two kinds.)
  ⚠️ It **validates** a policy; it does not enforce one. Enforcement is
  `purgeVerdict()` at sweep time and `SourceDocument.purgeAfter` at ingest, and a
  policy that never passes through the validator is caught by neither.

### Breach notification

PDPA requires assessment of whether a breach is notifiable and, where it is,
notification to the PDPC within **3 calendar days**, with affected individuals
notified where significant harm is likely. ⚖️ Verify current thresholds and
timelines with counsel — they have been amended before and I have not verified
them against the current statute.

Practical consequence: **you cannot assess a breach without an audit trail.**
`AuditEvent` is not a nice-to-have; it is the thing that makes the notification
obligation dischargeable.

---

## 5. Partner access — the sub-processor line

**Decision: per-customer opt-in.**

This is the most consequential governance decision in the partner motion, and it
sits on a field I had already modelled without noting the consequence.

| Posture | Legal position |
|---|---|
| Partner sees commercial metadata only — usage, billing, tenant health, deal registration | Partner is a **reseller**. Not in the data-processing chain. |
| Partner staff can read or operate customer exceptions | Partner is a **sub-processor**. Needs its own agreement with the end customer. ⚖️ |

`PartnerAccessGrant` implements the opt-in:

- **Default is no access.** Absence of a grant means commercial metadata only.
- **Granted by the customer** — `grantedBy` is a customer user, never a partner user and never 1CloudHub.
- **Time-bounded.** `expiresAt` is required; an open-ended grant is not a grant.
- **Revocable**, with `revokedAt` / `revokedBy` retained rather than deleted.
- **Audited.** Every access exercised under a grant writes an `AuditEvent`.
- **Scoped.** `commercial_only` → `exceptions_read` → `exceptions_operate`.

⚖️ Where a grant exists, the partner almost certainly becomes a sub-processor and
the customer contract must permit it. That is a contractual question, not a
technical one — but the technical design makes the boundary explicit and
provable, which is what a customer's diligence will ask for.

---

## 6. Separation of concerns

Three layers, with governance sitting in the platform layer so no solution pack
implements its own rules.

```
Solution layer      finance pack, KYC pack
                    knows document types and match rules
                    knows NOTHING about retention or residency
                    ─────────────────────────────────────────
Platform layer      identity · tenancy · authorization ·
                    classification · retention · residency ·
                    audit · subject requests · sub-processors
                    ─────────────────────────────────────────
Infrastructure      encryption, key custody, network isolation,
                    backup, regional placement
```

**The rule with teeth:** classification is declared once on `FieldSpec`, inside a
pack, and every masking, export, retention and model-processing decision is
derived from it. A screen that decides for itself whether to mask a field is a
defect, not a variation.

---

## 7. What this changes in the model

Additions, all typechecked (`tsc` exit 0):

| Entity / field | Purpose |
|---|---|
| `DataClass`, `FieldSpec.dataClass` | Classification travels with the field definition |
| `FieldSpec.modelProcessingAllowed` | Explicit control over what reaches a model provider |
| `Tenant.environment` | Sandbox enforcement |
| `Tenant.residency`, `RegionKey` | Residency now, multi-region later without migration |
| `Tenant.retention`, `RetentionPolicy` | Retention Limitation Obligation |
| `Tenant.processingPurpose` | Purpose Limitation Obligation |
| `SourceDocument.synthetic` | Proves the sandbox stayed synthetic |
| `SourceDocument.purgeAfter` / `purgedAt` | Retention with an audit tombstone |
| `PartnerAccessGrant`, `PartnerAccessScope` | Per-customer opt-in; the sub-processor line |
| `DataSubjectRequest` | Access and correction, keyed by subject not user |
| `SubProcessor` | Accountability and transfer assessment |
| `BreachRecord` | Notification clock from assessment |

---

## 8. Liability posture, plainly

The current system could not hold regulated data. Not as a matter of degree —
there is no authorization, identity is a client-writable cookie, an endpoint
returns other users' passwords, credentials sit in a Lambda environment
variable, and SSH and PostgreSQL are open to the internet. Any of those alone
would fail a customer security review.

The rebuild's controls are therefore not polish. **Authentication and
authorization must land before any real data does**, which is why the
dependency order in `docs/salvage-ledger.md` puts identity second, immediately
after the model.

The synthetic-only sandbox decision means the *demo* can proceed ahead of the
full control set — which is the practical reason it was the right call.

---

## 9. ⚖️ Needs legal review

1. Controller/processor determination for 1CloudHub across direct and partner-sold tenants.
2. Whether a `PartnerAccessGrant` makes the partner a sub-processor, and what the customer contract must say.
3. Whether Singapore residency is required or prudent for the customers in view.
4. Current PDPA breach thresholds and timelines — asserted here from general knowledge, **not verified against the current statute**.
5. Status of the PDPA Data Portability Obligation — passed in amendment but commencement should be checked; not modelled.
6. Demo terms of use prohibiting real personal data in the sandbox.
7. AML/CFT recordkeeping duties for KYC, which may impose *minimum* retention that conflicts with deletion requests.
8. Whether medical-records work can proceed at all without a regime beyond PDPA — this is named as capability but not built, which currently limits exposure.

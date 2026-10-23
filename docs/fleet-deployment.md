# Fleet deployment — one control plane, many data planes

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** PARTIAL — authoritative for **how a data plane is released,
> placed, versioned and applied**, and for the CI/CD shape that follows. It does
> **not** decide product scope, and it does not decide what a data plane *does*.
> `docs/HANDOFF.md` §3 outranks it on any decision; `docs/tech-stack.md` remains
> the authority for the stack itself.
> **Written 18 Sep 2026**, from the product owner's answers of the same day,
> against `origin/docs/tech-stack-authority`.

> 🛑 **NOTHING HERE IS BUILT, AND THE ONE SENTENCE `CLAUDE.md` GUARDS IS STILL
> TRUE: no AWS resource has been created.** A `reconcile-ci-image` stack was
> attempted twice on 18 Sep 2026 and failed both times; both were rolled back and
> the orphan deleted. This page is a design, written **before** the CI/CD split it
> describes, because that split is expensive to make twice.

---

## 0 · Reproduce before you trust

```bash
grep -c '@dropped-for-v1' model/deployment.ts            # 13 — the module is dropped WHOLE
grep -nE '^export (interface|const|function)' model/deployment.ts
grep -n 'LEASE_WINDOW_DAYS\|LEASE_GRACE_DAYS' model/billing.ts
grep -E '^\| G(36|88|276) \|' docs/HANDOFF.md | cut -c1-160
sed -n '1,30p' model/deployment.ts                       # the three properties
```

---

## 1 · What the owner asked for, in their words

> *"Control plane does not hold any customer data, it's mainly for configuration,
> governance and providing support to the customer. The data plane which may be on
> a customer's own account with BYOA needs a separate deployment which is separate
> from control plane. In fact it may even be segregated by customer (meaning
> different AWS customer accounts maybe on a different config or version of the
> data plane software). Also I need to be able to onboard new customers with a
> config change in the control plane, i.e. add a new AWS account and its data plane
> with a fresh deployment."*

**Four decisions were taken the same day and they are the frame for everything
below:**

| | Decision |
|---|---|
| **Update path** | **Customer-applied** — we publish a versioned artefact; the customer's own change process applies it |
| **Org boundary** | **Both** — some tenants hosted in a 1CloudHub account, some BYOA in the customer's own |
| **Version policy** | **We decide**, within a supported window |
| **Sequencing** | Design first, build after |

---

## 2 · The model already describes this fleet, and it is switched off

**`model/deployment.ts` is the fleet module. It is dropped WHOLE** — 13
`@dropped-for-v1` notes on 12 exports — under **G36**, which slipped BYOA to
v1+1. **G276 reversed G36 on 18 Sep 2026.**

⚠️ **THIS SAID THE MODULE *"returns"*, PRESENT TENSE. IT HAS NOT.** G276's own
status cell reads **NOT APPLIED**, and the drop notes are all still there —
derive it, do not read this line: `grep -c '@dropped-for-v1' model/deployment.ts`
→ 13. The types are **available to design against and not yet available to build
against**, and this section is the one that tells a reader otherwise.

**Read it before designing anything, because it already answers most of this
page's questions.** `DataPlane` carries, and the names are its own:

```
tenantId · mode · awsAccountId · region        which customer, whose account, where
supportRoleArn · externalId                    how we reach it, WHEN PERMITTED
attestationPublicKey                           how we verify what it says
engineVersion        informational, gates nothing
schemaVersion        THE GATE — monotonic, compared against SupportedVersionWindow
installedPackVersions  content, not code: "pack releases and engine releases
                       are different trains"
liveness · lastHeartbeatAt · lastAttestationAt
```

**Three version axes, deliberately separate.** A customer on an older engine with
newer packs is representable rather than a special case — which is precisely the
*"different config or version"* the owner asked for, already typed.

`SupportedVersionWindow` carries `currentSchemaVersion`,
`minimumSupportedSchemaVersion` and `securityPatchHours`
(`SECURITY_PATCH_HOURS_DEFAULT = 72`); `VERSION_POSTURES` names the three states
a plane can be in — `current · behind · unsupported`.

### 2.1 The three properties that constrain every option below

Quoted from the module's own header, because a paraphrase would lose the
argument:

1. **"Every channel is OUTBOUND, data-plane-initiated.** A regulated customer's
   security team will not open an inbound path, and asking is a bad opening move.
   The only exception is the audited `TenantAccessGrant` role assumption, which
   lands in their CloudTrail."
2. **"LIVENESS AND ACTIVITY ARE DIFFERENT FACTS.** A customer who reconciles
   monthly is silent for twenty-nine days. If 'no work' and 'no signal' share a
   field, that customer looks broken every month, the alert gets muted, and a
   genuinely dead plane is muted with it."
3. **"The plane's clock is theirs.** Everything ordered or billed uses OUR receipt
   time."

**Property 1 is the one that decides the CI/CD shape**, and the owner's
"customer-applied" answer honours it exactly: nothing we run reaches into a
customer account on a schedule.

---

## 3 · The split: release, registry, apply

The pipeline built on 18 Sep 2026 is `gate → build → deploy` in one line. **That
is correct for one environment and wrong for a fleet**, because it fuses three
things that move at different rates and are owned by different parties.

```
  ┌─ 1 · RELEASE ─────────── ours, once per commit ───────────────────────┐
  │  gate (npm run check)  →  build  →  PUBLISH an immutable release      │
  │  Produces: image by DIGEST · a CloudFormation template · schemaVersion │
  │  Deploys to NOBODY.                                                    │
  └────────────────────────────────────────────────────────────────────────┘
                                   │  a release is a fact, not an event
                                   ▼
  ┌─ 2 · REGISTRY ────────── the control plane, `DataPlane` rows ─────────┐
  │  DESIRED state: account, region, mode, target schemaVersion.           │
  │  ONBOARDING IS AN INSERT — of a `DataPlanePlacement`, NOT a `DataPlane`.│
  │  See §3.1: the distinction is the difference between a design that      │
  │  compiles and one that does not.                                        │
  └────────────────────────────────────────────────────────────────────────┘
                                   │  published DOWNWARD, never pushed
                                   ▼
  ┌─ 3 · APPLY ─────────────────────────────────── the customer, or us ───┐
  │  BYOA   : the customer's change process applies the published template │
  │  HOSTED : our own pipeline applies it — same artefact, same version    │
  └────────────────────────────────────────────────────────────────────────┘
```

**The load-bearing property of this shape: a release is published once and
applied N times, and the artefact is identical every time.** That is the same
guarantee G257 already demands within one environment — *"the prod pipeline
RESOLVES the staging image digest … and fails if it cannot find them — it does
not rebuild"* — carried across the fleet instead of across two environments.

### 3.1 🛑 `DataPlane` CANNOT BE INSERTED, AND THE MODULE FOUND THIS BEFORE THIS PAGE DID

> ⚠️ **THIS SECTION SAID *"ONBOARDING A CUSTOMER IS AN INSERT"* OF A `DataPlane`
> ROW, AND §5 SAID *"insert a `DataPlane`: `tenantId`, `mode: 'byoa'`, …"*. **THE
> TYPE REFUSES IT.** Six required, non-nullable fields are unknowable before the
> plane exists: `attestationPublicKey`, `engineVersion`, `schemaVersion`,
> `installedPackVersions`, `infrastructureTags`, `installedAt`.
> `attestationPublicKey`'s own docblock says why: *"Public half of a key pair
> **generated IN THE CUSTOMER'S ACCOUNT at install**."*
>
> **So §5's onboarding had a circular dependency: the INSERT needs the public
> key, the key needs the install, the install needs the bootstrap, and the
> registration step exists to deliver the key that step 1 already required.**
>
> **And `model/deployment.ts` had already written this down**, in the header this
> page quotes three properties from: *"**WHAT COMES BACK FIRST when BYOA
> returns:** `DataPlane` itself, because `sendHeartbeat` derives `dataPlaneId`
> from the SigV4 principal and therefore **presupposes a row carrying
> `attestationPublicKey` that nothing else creates**."*
> *Corrected 18 Sep 2026.*

✅ **APPLIED 18 Sep 2026 — `model/deployment.ts` now declares
`DataPlanePlacement` and `DataPlane` carries `placementId`.** The placement is
the **decision**; the plane is the **installation**. Every field on the
placement is knowable at the moment a human says *"this customer gets a
plane"*, and **nothing on it is reported BY a plane** — which is the test for
which type a field belongs to. Derive it:
`grep -n 'export interface DataPlanePlacement' model/deployment.ts`.

**It carries `targetSchemaVersion` where `DataPlane` carries `schemaVersion`,
and that pair is the point of the split:** a reconciler compares them, and a
design storing one number could not express *"should be on 7, is on 5"*, which
is the only interesting state. It also carries `installedDataPlaneId`, null
until registration — **a placement that has been null for a long time is the
onboarding that stalled**, which the build pack's H2 journey asks for and
nothing else answers.

⚠️ **`DataPlanePlacement` is NOT `@dropped-for-v1`**, though every other export
in that module still is. G276 reversed G36 and the drops have not been swept;
this type arrives on the correct side of that sweep rather than waiting for it.

### 3.2 🛑 AND FOR HOSTED THERE IS NO PER-CUSTOMER ROW AT ALL

**`DataPlane.tenantId` is `TenantId | null`, and the null case is hosted**, whose
docblock reads: *"**Null for a hosted plane, which is multi-tenant** — hosted
tenants point AT a plane, not the reverse."* `model/domain.ts` agrees —
*"`hosted`: 1CloudHub account, **multi-tenant**, isolated by row-level
security"* — and so does `docs/byoa-topology.md`.

> ⚠️ **§6's table said hosted is *"one account per tenant, in our
> Organization"*. That is false**, and it made §6's *"the `DataPlane` row is
> identical in both"* false with it. **Onboarding a HOSTED customer is not a
> plane INSERT at all** — it is a `Tenant` row pointing at an existing plane,
> which is a materially cheaper operation and a materially different one.
> *Corrected 18 Sep 2026.*

---

## 4 · 🛑 The conflict the owner's two answers create — and the first draft of this section INVENTED the answer

**Customer-applied + we-decide-the-version has no forcing function.** If the
customer applies and we decide, a customer who does not apply is running a
version we decided against, and `SECURITY_PATCH_HOURS_DEFAULT = 72` is an
aspiration rather than a control. **A push would be a forcing function and is
refused by property 1.** That conflict is real.

> 🛑 **THIS SECTION SAID THE ENTITLEMENT LEASE RESOLVED IT, THAT *"a customer
> who does not apply a release eventually **stops reconciling**"*, and THAT THE
> MECHANISM WAS *"already the design, not an invention for this page."* **THE
> STOP WAS THE INVENTION, AND THE MODEL SAYS THE OPPOSITE IN ITS OWN VOICE.**
> `model/billing.ts`, on `graceHours`:
>
> > *"Hours after expiry during which in-flight work completes and new work
> > warns. **Expiry is a grace period, never a stop**: halting mid-run wastes
> > spend already incurred and entitlement already drawn."*
>
> and `docs/day-2-operations.md` §4.2 repeats it as a table row — *"**Graceful
> degradation** | Expiry enters a grace period, **not a stop**"*. The one place
> in `model/` where a plane stops is the **runaway guard** on `ceilings`, which
> is a different mechanism for a different reason.
> **Corrected 18 Sep 2026, by an adversarial read, on the same day it was
> written.**

### 4.1 What the lease actually gives, and it is a ladder rather than a switch

`docs/day-2-operations.md` §4.8, **the non-payment ladder**, already specifies
the terminal state and it is not a stop:

```
current  →  warn (in-product, ahead of expiry)
         →  block NEW runs; in-flight runs complete
         →  read-only
```

with **two absolutes**: *"1. **In-flight runs always complete.** 2. **Export and
audit access are never blocked.**"*

**`read-only` is the answer, and it is better than the stop this page invented**
— it still forces the conversation, and it never takes a customer's evidence
away from them.

### 4.2 🛑 The lease was disclosed for NON-PAYMENT. Using it for version compliance changes the disclosure

`EntitlementLease`'s own docblock makes this load-bearing:

> *"⚠️ **DISCLOSURE IS LOAD-BEARING.** … **Disclosed** in the contract, in the
> documentation and in the product … it is unremarkable commercial machinery.
> **Discovered** rather than disclosed, it is the story that ends the
> partnership."*

`day-2` §4.2 names the lease's four jobs — metering integrity, availability,
**non-payment** (*"Renewal is the lever"*), graceful degradation. **Version
compliance is not among them.** A customer signs a clause disclosing a *payment*
lever; using the same lever to enforce a *version* decision they declined is
precisely the "discovered rather than disclosed" failure. **The contract must
disclose the version condition explicitly, or the mechanism may not be used for
it.** That is an owner decision and a legal one, and it is not this page's.

### 4.3 Four defects in the mechanism as it stands, all cheap now

1. **`sequence` is a rollback defence, not a replay defence.** *"The plane
   refuses a lease older than its current"* — replaying the **current** lease is
   not older, it is equal, and it is accepted. Worse, the counter lives in the
   customer's own database in the customer's own account. **A customer does not
   need to forge a lease; they need only keep a genuine one and refuse to
   advance.** Offline verification defeats *forgery* and is irrelevant to
   *retention*.
2. **Revocation is best-effort and this page omitted it.** `model/billing.ts`:
   *"An offline-verifiable lease cannot learn it was revoked while offline …
   **the guarantee is 'no more than the ceiling, and not past expiry', not
   'stops on command'**."* Maximum containment for a compromised plane is
   therefore `LEASE_WINDOW_DAYS + graceHours` — **up to 37 days** — and that is a
   property to state, not to discover during an incident.
3. **The grace is specified twice, in two units, joined by nothing.**
   `graceHours: number` on the lease; `LEASE_GRACE_DAYS = 7` as a module
   constant; **no derivation ties them**. A lease minted with `graceHours: 0` is
   type-valid and the ladder collapses to a cliff. Bind them at the one mint
   site.
4. 🛑 **THE GATE IS AN UNSIGNED SELF-REPORT, WHICH IS THE DEFECT
   `drawdownHighWater` EXISTS TO FIX, ONE FIELD OVER.** `schemaVersion` — the
   axis `model/deployment.ts` calls *"The gate"* — travels **only** on
   `DataPlaneHeartbeat`, which the module's own header says is **"SigV4 only"**,
   where an attestation is **"SigV4 AND a content signature"** because *"content
   signing answers a different question: **can they later deny it**."*
   `UsageAttestation` carries `engineVersion`, the axis that *"gates nothing"*,
   and **not** `schemaVersion`. **So a customer who wants to stay on an old
   plane reports a version they do not run; SigV4 proves who sent it, which was
   never in doubt.** `docs/data-architecture.md` §11.1 records the identical
   discovery about the lease counter — *"THE LEASE WAS AN HONOUR SYSTEM WITHOUT
   THIS"*. **Fix: `schemaVersion` goes inside the signed attestation body,
   beside `engineVersion`, and it must land before the first attestation is
   signed** (§8).
5. **Non-renewal is not an act, so invariant 10 does not cover the most
   consequential thing the control plane can do.** Renewal is withheld by *not
   happening*: the plane pulls and gets nothing. No `AuthorizationGrant`, no
   `AuditEvent`. A single edit advancing `minimumSupportedSchemaVersion` past a
   customer's version silently condemns their close 30 days later, with no alarm
   on our side because `livenessFor()` reads `healthy` throughout. **Make the
   refusal an act.** Cheap now, impossible to backfill once a customer disputes
   a stoppage.

## 5 · Bootstrap is not update, and only one of them can be pulled

| | **Bootstrap** | **Update** |
|---|---|---|
| Account state | empty — no role, no bucket, no plane | a plane exists |
| Can the control plane initiate it? | **No.** There is nothing there to receive an instruction | Yes — publish, and the plane or the customer applies |
| Who acts | the customer, or an FDE with a one-time credential | the customer's change process |
| What we supply | a **bootstrap template** + the account's registration details | a versioned template + a lease |

**The owner's sentence — *"onboard new customers with a config change in the
control plane"* — is true of everything EXCEPT the first apply.** The config
change creates the `DataPlane` row, mints the registration secret and authorises
the account. **Something with credentials in the new account must still run the
first template once.** That is not a gap in the design; it is what "their
account" means.

**Onboarding, end to end:**

1. **Control plane, config change** — insert a `DataPlane`: `tenantId`,
   `mode: 'byoa'`, `awsAccountId`, `region`, target `schemaVersion`. Mint a
   one-time **registration token** and an `externalId`.
2. **We hand over** a bootstrap template and that token. Nothing else.
3. **Customer applies the bootstrap template** in their account. It creates the
   CDK bootstrap resources, an execution role scoped to this product's stacks,
   the `supportRoleArn` trust (with the `externalId`), and a first plane.
4. **The plane registers OUTBOUND**, presenting the token, and posts its
   `attestationPublicKey`. The control plane records it on the `DataPlane` row.
   **The token is single-use and is the only inbound-shaped moment in the
   lifecycle.**
5. **The plane fetches its lease** and starts. From here everything is pull.

⚠️ **Step 4 is where the third hashed stream must already exist — see §8.**

---

## 6 · Hosted and BYOA are one artefact and two apply mechanisms

`DeploymentMode` already models both. **The artefact must not fork** — a fleet
with two build outputs is a fleet where "which version is this customer on" has
two answers.

| | **Hosted** (1CloudHub account) | **BYOA** (customer's account) |
|---|---|---|
| Account | one per tenant, in our Organization | theirs, a different Organization |
| Apply | our pipeline, automatically | the customer's change process |
| Mechanism available | **CloudFormation StackSets** — see §6.1 on why the reason matters | **not** StackSets — **but not for the reason this page first gave.** §6.1 |
| Version | we decide **and** we apply | we decide; they apply |
| Forcing function | direct | the lease (§4) |

**So the reconciler has two mechanisms and one desired state.** The `DataPlane`
row is identical in both; only the apply step differs, and it differs because the
org boundary is a real thing and not a preference.

⚠️ **This is the first time a StackSets dependency enters the record.**
Designing the whole fleet around it would produce a mechanism that silently does
not work for the customers the product was sold to.

### 6.1 🛑 THE REASON THIS PAGE FIRST GAVE FOR REFUSING StackSets IS FACTUALLY WRONG

> ⚠️ **THIS SECTION SAID: *"not StackSets: **it cannot cross an Organization**"*.
> **THAT IS FALSE, AND IT IS THE KIND OF FALSE THAT GETS CORRECTED BY THE FIRST
> AWS SA IN THE ROOM — TAKING THE CONCLUSION WITH IT.** StackSets has two
> permission models and only one is org-bounded. AWS's own documentation, on
> **self-managed** permissions: *"Using this permissions model, **StackSets can
> deploy to any AWS account in which you have permissions to create an IAM
> role**."* The org restriction belongs to **service-managed**.
> *Corrected 18 Sep 2026.*

**The conclusion survives and the true reason is stronger.** Self-managed
StackSets works by the customer creating a role that trusts our account —
AWS's own template grants `"Action": "*", "Resource": "*"` — with **no
expiry, no `TenantAccessGrant`, and no two-person approval**. That is a
**standing inbound reach into their account, held by us**, which is exactly what
property 1 forbids and whose only named exception is *"the audited
`TenantAccessGrant` role assumption, which lands in their CloudTrail."*

**And it dissolves G253's fence.** G253 makes the migrator/app-role split *"a
property of the **account** rather than a property of a file"*; a StackSet
execution role is a **single** role per target account holding `cloudformation:*`
— it can create, update and delete every resource the template names, both task
roles and both secrets included.

**Three further facts to carry rather than rediscover:**

- **Drift detection cannot see a competent divergence.** *"Changes made through
  CloudFormation to a stack directly, rather than at the StackSet level, aren't
  considered drift."* So §3's reconciler cannot verify the hosted half either.
- **The target's refusal mechanism fails OPEN.** *"If you don't have an account
  gating Lambda function configured, CloudFormation skips the check, and
  continues."* Opposite polarity to **G100**'s deny-on-NULL, chosen deliberately.
- **Delegated admin changes who may initiate, not what can be reached.**

🛑 **AND THE HOSTED PATH ASSUMES AN AWS ORGANIZATION THE RECORD HAS NEVER
NAMED.** `grep -rniE 'aws organization|management account|delegated admin'
docs/tech-stack.md docs/HANDOFF.md infra/` returns **nothing**, and **G279** —
taken four commits ago — puts everything in **one shared account**. §9 carries
this as a ruling that must be taken before §6's hosted column means anything.

### 6.2 The artefact does not survive one synth, and `infra/` says why

`infra/lib/config.ts`: *"the account and the region are **LITERALS** rather than
`Stack.of(this).account` resolved"*, taken to meet G108's determinism condition.
**A CDK-synthesised, asset-bearing template points at
`cdk-…-assets-<account>-<region>` in OUR account**, which a target-account role
cannot read without a cross-account bucket policy. **And G260's tag Aspect
stamps OUR `Owner` and `CostCentre` — `phani@1cloudhub.com`, `ReconcileAI`,
fixed by G280 — onto resources inside a customer's account**, while
`DataPlane.infrastructureTags` says the constraint runs the other way: *"in BYOA
the **CUSTOMER'S mandatory tag policy applies and is an onboarding input** …
their Config rules or service control policies will **reject an untagged
resource, and the stack simply will not deploy**."*

**So "one artefact, applied N times" is not achievable from the CDK app as it
stands.** Either the published artefact is **environment-agnostic CloudFormation
with tags and account as parameters**, or the artefact forks per customer.
**§9 carries it; this page does not choose.**

---

## 7 · What changes in `infra/`

**Nothing already built is wasted.** The `CiImage` stack and the gate are
unchanged; the `Pipeline` stack splits.

| Piece | State | Change |
|---|---|---|
| `CiImage` stack | built | none |
| Gate stage (`npm ci && npm run check`) | built | none — **G108 is not amended by any of this** |
| `Pipeline` stack | built, staging only | becomes the **release** pipeline: gate → build → publish. It stops deploying anything to a customer |
| **`Release` construct** | **new** | publishes an immutable set: image by digest, template, `schemaVersion`, signature. A release is addressed by version, never by `latest` |
| **`Bootstrap` template** | **new** | the one-time template a customer applies. Small, readable, and **reviewable by their security team** — that is a design constraint, not a nicety |
| **`FleetReconciler`** | **new** | reads `DataPlane` rows; applies via StackSets for hosted, and for BYOA **publishes and records** rather than applies |
| **`Planes` stack** | not written | becomes the per-tenant data-plane stack, parameterised by tenant and version — instantiated once per plane rather than once per environment |
| `Network`/`Data`/`Edge` | not written | per data plane, not per environment. **G277's console-host question is still open and still blocks `Edge`** |

### 7.1 Two properties the release pipeline must hold

- **Immutable and addressed by version.** The ECR repository is already
  `IMMUTABLE`-tagged in the `CiImage` stack; the release artefact inherits that
  rule. **A fleet that can be pointed at `latest` is a fleet where two customers
  running "the same version" are not.**
- **Signed, and verified offline.** `DataPlane.attestationPublicKey` and
  `EntitlementLease.signature` both already assume this. **G262's signing half is
  currently NOT built** — named in `infra/README.md` as an account-level action —
  and it stops being optional the moment an artefact is applied in an account we
  do not control.
- **Carrying a format version and a refusal.** **G88's second clause:** *"every
  downward-published artefact carries a format version and a refusal."*
  `grep -rniE 'formatVersion' model/ db/ server/ docs/contracts/` → **nothing**.
  The release artefact and `EntitlementLease` are both downward-published and
  neither has one, so a future shape cannot be introduced to a fleet of planes
  that will not refuse an unrecognised one.

---

## 8 · 🛑 The one thing that cannot be retrofitted — and it is NARROWER and EARLIER than "attestation"

`UsageAttestation`'s own docblock: **"Cannot be retrofitted. A series already
signed without a chain cannot acquire one retroactively."** G276 restates it as
the immovable item, and the reading is correct.

**But "design the attestation chain" is too coarse to act on.** The thing that
cannot be retrofitted is **the canonical body serialisation**, and it is due
before `Bootstrap` ships — not before the first customer.

If a plane emits a week of attestations whose `bodyHash` is computed over a
**non-deterministic** serialisation — key order, number formatting, timestamp
precision — then every hash that week is unreproducible, the chain does not
verify, and **the signatures cannot be recomputed**, because the private half
lives in the customer's KMS and will not re-sign a past body and the original
bytes were not retained. **A wrong canonicalisation produces attestations that
look fine until the first dispute.**

**What must exist before the first plane starts:**

1. A **KMS asymmetric key pair generated in the customer's account at install** —
   *"the private half never leaves their KMS and the application never holds key
   material"*. A `Bootstrap` artefact.
2. **The canonical body specification** — `bodyHash` is *"Hash of this
   attestation's canonical body; the next one chains to it"*, and **"canonical"
   is named nowhere in this repository.** ⚠️ Note `model/canonical.ts` exists
   (RFC 8785 / JCS, G20) and **`canonicalise()` refuses `bigint`** — money-bearing
   bodies need an encoding decision this page does not take.
3. `sequence` *"monotonic per plane, from 1"* and `previousAttestationHash`
   *"null ONLY at sequence 1"*.
4. **`drawdownHighWater` inside the signed body** — `data-architecture` §11.1:
   without it *"**the lease was an honour system**"*. §4.3(4) adds `schemaVersion`
   to the same body for the same reason.
5. Verification, with **failures RETAINED**: *"a failed attestation is retained,
   never discarded — it is evidence."*
6. A **fixed 24-hour cadence including zero-activity days** — *"zero totals are a
   legitimate, meaningful value."*

### 8.1 What is billable without it, so nobody discounts the deadline

**Billing does not stop, and saying it does would be wrong.** `day-2` §4.7 rules
that **BYOA prices ENTITLEMENT, not consumption** — a subscription plus a volume
tier. So:

- **Subscription and contracted tier are derivable from the lease alone.** The
  lease is ours and signed by us.
- **Overage is not derivable** — it is actual-against-tier and actuals arrive
  only by attestation.
- 🛑 **Dispute is not defensible, and this is the real loss.** `day-2` §4.4's
  three independent estimates collapse to one, because the *Observed* leg was
  retracted — `data-architecture` §11.1: *"the 'layered, both mechanisms' model
  was **one mechanism: self-report**"* — and `UsageReconciliation` (delta 13) is
  unbuilt. **One number, it is the customer's, and nothing compares it to
  anything.** Invariant 5 says money is always derived; without the chain it is
  derived from an unverifiable input.

## 8a · 🛑 What this design did not mention at all, found by an adversarial read

Each of these is a week-one problem for whoever builds this. **None was in the
first draft**; a coverage scan found `migrat`, `rollback`, `observab`, `log`,
`telemetry`, `compromis`, `drain`, `in-flight` and `dispos` at **zero
occurrences** in 325 lines about releasing software across a fleet.

**(a) MIGRATIONS — zero mentions, and this is the last moment.** `day-2` §3.2:
forward-only expand/contract *"must be adopted **before the first deployment or
not at all**"*. Three concrete gaps: `db/migrate.ts` records **filenames**, not
the monotonic integer `schemaVersion` is typed as, so **the gate has no
producer**; *monotonic* is not the property needed — the model states a
**runtime** compatibility window of two (*"engine N runs against schema N and
N−1"*) and a **support** window of three (*"typically current − 2"*), **so a
plane labelled `behind` — "an upgrade conversation, not an incident" — can sit
outside the compatibility window the same file declares**; and
`db/migrations/0003_tenant_schema.sql` contains three `DROP COLUMN`s whose own
comment says *"acceptable HERE and only here … **no deployment exists** … It is
NOT a precedent"* — §7's `Planes` row is the commit that ends that exemption.
**And G88's second clause is unmet**: *"every downward-published artefact carries
a **format version and a refusal**"* — `grep -rniE 'formatVersion' model/ db/
server/ docs/contracts/` returns nothing, and the lease is itself a
downward-published artefact.

**(b) ROLLBACK — and the design lost the control that makes it survivable.**
`day-2` §3.2: *"**You cannot roll back a schema change in an account you cannot
reach**, whose backups you do not hold, and whose PITR window is the customer's
decision."* §3.4 has the partial answer — *"consent to an upgrade includes
consent to its automatic reversion … but the argument only works if it is
**stated in the contract**"*. 🛑 **And §6's table places hosted and BYOA as
parallel siblings of one version with NO ORDERING**, which loses `day-2` §3.5:
*"our sandbox → our hosted fleet → BYOA customers, in declared order … **This is
the strongest operational argument for keeping the hosted topology** … Without
it, the first customer to run any engine version is a regulated enterprise,
**which is exactly backwards**."* **Fix: a release is not eligible for BYOA
publication until it has held on the hosted fleet for a stated soak.** One arrow
in §3's diagram, free now.

**(c) A COMPROMISED PLANE.** Containment is bounded by `LEASE_WINDOW_DAYS +
graceHours` — **up to 37 days** — because revocation is best-effort (§4.3.2).
The plane holds a signing key, tenant data and connector references throughout.

**(d) OFFBOARDING AND DATA DISPOSITION.** §10 concedes it. The record has a
start: `byoa-topology` §1.2 — *"'delete everything' becomes a **stack deletion in
an account they own** — an operation with an **unambiguous completion state**,
which is exactly what the current design lacks"* — against
`data-architecture` §10.3's open question on per-tenant CMK deletion.
`DataPlane.decommissionedAt` exists and nothing reads it.

**(e) SECRETS INSIDE A CUSTOMER ACCOUNT.** G263 requires Secrets Manager **with
rotation** and one task role per plane. In a customer account every one of those
is **theirs** — their Secrets Manager, their rotation Lambda, their KMS, their
IAM — and a rotation Lambda is unattended infrastructure we ship that holds the
master credential, **with no named owner for its failure**. ✅ The good news this
page should claim: `day-2` §5.2 — *"**Connector credentials never reach us.**
Their SAP or bank credentials sit in **their** Secrets Manager, referenced by the
data plane, never transiting a 1CloudHub account"*. `model/connections.ts` is
still one of the seven `module_specified_not_written` gaps.

**(f) OBSERVABILITY FROM AN ACCOUNT WE CANNOT READ.** G261's allow-list
serializer ships with our code and works; **the log group is theirs and its
alarms fire into their SNS topic.** G261 is an observability design for an
account we own, applied to a fleet we do not. And **`Tenant.telemetryProfile`
does not exist** — `grep -rn 'telemetryProfile' model/` returns nothing — while
the build pack draws `minimum`/`standard`/`full` as **`built`** and `day-2` §1.2
makes the floor *"a condition of the support SLA"*, the answer to *"we can owe a
service we are structurally unable to deliver"*.

**(g) COST ATTRIBUTION — and for BYOA it is not ours to attribute.** For BYOA the
spend is on the **customer's** bill under **their** tags, and `day-2` §5.3
already rules what we may say: *"cost reporting … becomes a **customer-facing
feature** … priced at a rate table they supply or a public-pricing default, and
we **label it estimated** because it is."* For hosted, G260 forbids a `TenantId`
tag **and** `tenantId` is null on a hosted plane — **so hosted per-tenant COGS is
not derivable from tags by design.** A deliberate consequence, previously
unstated.

**(h) THE FDE PATH, AND IT REACHES INVARIANT 8.** `supportRoleArn` and
`externalId` exist and **nothing in `model/access.ts` or `model/governance.ts`
knows they do** — the binding between "a grant was issued" and "this ARN may be
assumed" is a convention, not a mechanism. 🛑 **And G75 put `secret` into
`PERMITTED_RESOURCES.delivery` as a STANDING 90-DAY REACH, argued against a
HOSTED fleet. Under BYOA that reach is into the customer's own AWS account** —
materially larger than what was argued. G60's rule is *"do not quietly narrow it
back"*, which cuts both ways: **the question must be asked, not assumed either
way.**

, none of which are taken

| | What must be ruled |
|---|---|
| **G88 reversal** | G88 says *"Version DISCIPLINE in v1; the fleet TYPES stay in v2."* This page needs the types in v1. G276 already implies it; it has not been written |
| **The lease as the forcing function** | §4 — including the renewal policy, the grace count, the notice, and who may override. **A customer's reconciliation stopping is a contractual event** |
| **StackSets for hosted** | §6 — a new vendor mechanism, hosted only |
| **The registration token** | §5 step 4 — the single inbound-shaped moment; its lifetime, its single-use property, and what a replay does |
| **Signing** | §7.1 — G262's unbuilt half becomes mandatory |
| **Attestation chain first** | §8 — a sequencing ruling with a hard deadline |
| **The post-grace behaviour** | §4.1 — `read-only`, per `day-2` §4.8's ladder, with its two absolutes intact. **The first draft invented a stop the model forbids** |
| **The lease's disclosure** | §4.2 — it was disclosed for NON-PAYMENT. Using it for version compliance changes what the contract must say, and that is a legal decision |
| **`schemaVersion` in the signed body** | §4.3(4) — the gate is currently an unsigned self-report. **Must land before the first attestation is signed** |
| **Non-renewal as an act** | §4.3(5) — invariant 10 does not currently cover the most consequential thing the control plane can do |
| **The `DataPlanePlacement` split** | §3.1 — without it "onboarding is a config change" does not compile |
| **An AWS Organization, or not** | §6.1 — the hosted column assumes a management account and delegated admin; **G279 established one shared account four commits ago** |
| **The artefact's shape** | §6.2 — CDK-with-literals cannot be applied in another account. Environment-agnostic CloudFormation, or the artefact forks per customer |
| **The hosted→BYOA soak order** | §8a(b) — `day-2` §3.5 calls this *"the strongest operational argument for keeping the hosted topology"*, and §6 lost it |
| **The migration chain property** | §8a(a) — and G88's format-version clause with it |
| **The canonical body specification** | §8 — **the thing that cannot be retrofitted, due before `Bootstrap` ships** |
| **G75's 90-day reach across an account boundary** | §8a(h) — argued against a hosted fleet; BYOA is new information |
| **Fleet operations staffing** | `docs/day-2-operations.md` requires it *"staffed as a named function before the first BYOA customer, not product engineers on rotation"*, and **G88 records it as unstaffed** |

---

## 10 · What this page does not decide

- **What a data plane contains.** `Planes`, `Network`, `Data`, `Edge` are
  blocked on G277 (the console host) and are not this page's to write.
- **Per-customer configuration beyond version.** The owner said *"a different
  config or version"*; this page handles **version** and treats config as the
  `DataPlane` row's other fields. A general per-customer configuration surface is
  undesigned.
- **How a customer is offboarded.** Revocation exists on the lease
  (`revokedAt`, `revocationReason`); what happens to their data does not.
- **Residency across seven regions.** G267 **rules** `RegionKey` to seven and
  G185 splits the database by residency region. ⚠️ **THIS SAID "took it to
  seven" AS IF IT WERE A FACT ABOUT THE TREE. IT IS NOT APPLIED** — `grep -c
  "ap-southeast-3" model/domain.ts` → **0**, and the tree holds **five**. Stating
  an unapplied ruling as a fact about the tree is the exact failure `CLAUDE.md`'s
  banner warns about. The point survives: **a fleet across seven regions is a
  different shape from a fleet in one**, and `docs/tech-stack.md` still deploys
  to one.

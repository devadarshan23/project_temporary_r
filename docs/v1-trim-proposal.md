# v1 trim proposal — rewritten against G49–G70

> **STATUS:** PARTIALLY APPLIED
> **V1 AUTHORITY:** PARTIAL — it is the sign-off sheet for the trim; **`docs/HANDOFF.md` §3 pass H outranks it on every row.**
> ⚠️ Note the direction of the reversals as well as the fact of them: item 1 was decided **against** this file's own recommendation — G75 took `PERMITTED_RESOURCES.delivery`, the broad shape, not `CONTRACT_ONLY_RESOURCES`.
> ✅ **G75's owed doc sweep is CLOSED in §4.4, 8 Aug 2026 (evening).** This line read *"**§4.4 still asserts `secret` is unreachable, which is false in the tree**"* — and it stayed true all day, because **the banner was added and the body was never corrected**. That is the shape, not the accident: a file that announces its own defect and then commits it underneath is worse than one that is plainly stale. The body is corrected; the overruled recommendation stays where it was, marked.
> ⚠️ **The sweep found a second half nobody had:** the wire never moved. §4.4 has the greps.
> *Two-axis label added 8 Aug 2026; the state table below is the detail and was written the same day.*

> 🟠 **PARTIALLY APPLIED. THIS BANNER SAID THE OPPOSITE UNTIL 8 August 2026 AND
> IS CORRECTED IN PLACE RATHER THAN REPLACED.**
>
> It read: *"A PROPOSAL. NOTHING HERE HAS BEEN APPLIED. NO FILE IN `model/` HAS
> BEEN CHANGED."* That was true when written and went false the moment the first
> ruling landed — which is the exact failure mode G32 describes, a document that
> still *looks* like a control after it has stopped being one.
>
> **State as of 8 August 2026:**
>
> | | |
> |---|---|
> | ✅ **Applied to `model/`** | G75 (`secret` — **model only; the wire is NOT applied**, §4.4) · G79 (`managed_service_use`) · G80a (`SubjectLocation` variant) · G80b (`provider` closed) |
> | ✅ **Ruled, not yet applied** | G77 (drop 2, not 5) · G78 (money, two commits) · G81 (re-run the trim) · G85 (no `DocumentType` variants) · G86 · G88 · G89 — **plus the evening's build rulings that land on rows here:** G104 (no model id in engine code, §4.5) · G106 (`FieldSpec` JSONB path, unmapped keys unreadable, §4.3) · G111 (one money codec, §4.12) · G112 (the retype follows the type, §4.12) |
> | 🟡 **Still a proposal** | everything in §4 not named above |
>
> ⚠️ **G102 settles no row in this document.** It reserves a `palette` key on
> `SolutionPack` admitting only `null`; `model/presentation.ts` (§4.11) is a
> different subject and stays **2 live / 51 dropped** (§2's command, re-run
> 8 Aug 2026). Recorded because *palette* is used in unrelated senses across this
> record — a pack field, and a visual-identity constraint `PRODUCT.md` says has
> never been established.
>
> **`docs/HANDOFF.md` §3 pass H (G75–G89) is the authority.** Where this document
> and that table disagree, the table wins: it carries the reasoning, this carries
> the summary.
>
> Written 7 August 2026 at the product owner's direction: *"propose per module,
> you decide."* Each module in §4 was a separate sign-off, and **all nine of §5's
> items were ruled on, one at a time, on 8 August.**
>
> **The ruling is unchanged and I am not proposing to change it.** `drop_for_v1`
> means the declaration **stays**, carries a dated note, and gets no table, no
> endpoint, no code. Nothing is deleted. `model/identity.ts`'s totality proofs
> depend on that, and it is what makes every row here a commit to reverse rather
> than a redesign.

> ⚠️ **THIS IS A REWRITE. The first draft was written against six decisions and
> there are now twenty-two.** Two items reversed direction between drafts and both
> are called out where they sit, because a reader who saw the first version will
> otherwise carry a stale conclusion:
>
> - **`presentation.ts`** — the first draft proposed **restoring ~46 exports** under
>   G55 (*"the business intelligence dashboard"*). **G57 and G68 cancel that
>   entirely**: Quick Suite renders the dashboard. §4.11.
> - **`managed_service_use`** — the first draft said *"restore from dropped."*
>   **It was never there.** G7 is unapplied and `POLICY_KINDS` has seven members,
>   none of them this. It is a **create**, not a restore. §4.8.
>
> **Two corrections in one rewrite is the §5.11 shape**, and the lesson is the same:
> derive it, do not carry it forward.

---

## 0. The test

For each export: **does a v1 screen, or an FDE / control-plane task that G50 and
G59 put in scope, need this?**

Three overrides sit above that test, in order:

1. 🛑 **Never drop the last executable enforcement of an invariant.**
   `resolveModel()` (`catalog.ts`) is the **only** enforcement of invariant 7 —
   and G69 widens it, since an extraction model now resolves through it too.
   `validateAgentToolBindings()` (`agents.ts`) is one of invariant 6's two.
2. 🛑 **Never drop something `model/identity.ts` pins.**
3. 🛑 **A decision outranks a screen.** G50 and G59 put control-plane and source
   configuration in v1 and **no screen in the pack is a platform surface**.

---

## 1. Five kinds of change, and only the first is a trim

The question was *"trim the model to fit the spec."* The answer, after twenty-two
decisions, is that **trimming is the smallest part of it**:

| Kind | Count | Where |
|---|---:|---|
| **Drops** — declared, not built | 5 exports | G51 partner reach · §4.2, §4.3 |
| **Creates** — types that do not exist | 4 areas | G53/G7, G61, G68, G69 · §4.8, §4.3, §4.4 |
| **Retypes** — same concept, safer type | ~40 sites | G65 bigint · G66 one `Money` · G54 provider · §4.12 |
| **An invariant change** | 1 | 🛑 G60 · §4.4 |
| **Cancelled from the first draft** | ~46 exports | G57/G68 · §4.11 |

**Net on the model: five exports leave, nothing is deleted, and the retype is the
big one** — it touches four modules and both contract files.

---

## 2. Where the model stands today

```bash
for f in model/*.ts; do awk -v F="$(basename $f)" \
  '/@dropped-for-v1/{d=1;next} /^export /{if(d)dr++; else lv++; d=0; next} NF==0{d=0} \
   END{printf "%-18s live=%-4d dropped=%-4d\n", F, lv, dr}' "$f"; done
```

| Module | live | dropped | Proposal | § |
|---|---:|---:|---|---|
| `kernel.ts` | 72 | 0 | no change | 4.1 |
| `identity.ts` | 17 | 0 | no change, and it must stay that way | 4.1 |
| `access.ts` | 49 | 0 | **drop 3** · retype `valueCeiling` | 4.2 |
| `domain.ts` | 144 | 17 | **drop 2** · retype `Money` · **create** an FX slice | 4.3 |
| `governance.ts` | 38 | 4 | 🛑 **invariant 8 change** · **create** a `SubjectLocation` variant | 4.4 |
| `catalog.ts` | 10 | 1 | no drops; **close `provider`** | 4.5 |
| `agents.ts` | 31 | 8 | no change — G52 | 4.6 |
| `observability.ts` · `billing.ts` · `evaluation.ts` · `correspondence.ts` | — | — | no change; **reasoning corrected** | 4.7 |
| `policy.ts` | 32 | 14 | **create** `managed_service_use` · delete `MoneyAmount` | 4.8 |
| `learning.ts` | 28 | 33 | no change, flagged | 4.9 |
| `deployment.ts` | 0 | 12 | ⚠️ **may need a partial restore — G70** | 4.10 |
| `presentation.ts` | 2 | 51 | **no change — the restore is CANCELLED** | 4.11 |
| `examples.ts` | 12 | 0 | no change; **the fixtures debt is PAID** — 8 Aug 2026 | 4.13 |

---

## 3. What is NOT a trim, and is larger than the trim

**Recorded here so the sign-off below is not mistaken for the whole job.** Six
decisions create work that no amount of trimming addresses:

| From | Work | Size |
|---|---|---|
| **G58** | **Finance authors reconciliation definitions in full** → Tier 2 Save, versioning, and `administration.openapi.yaml` | **The largest single deliverable in v1** |
| **G62** | **`Ask` ships as drawn**, and it has **zero contract operations** today | A whole contract tier |
| **G62** | **G45 (Dual LLM) becomes a v1 prerequisite** — two agent definitions plus a rule for what the reader may emit | Was "later hardening", now blocking |
| **G50 · G59 · G70** | **A platform surface for the FDE** — provisioning, publication, grants, per-tenant BI accounts. **No screen in the pack is a platform surface** | G28's fourth axis, now load-bearing |
| **G65 · G66 · G67** | **One money type, bigint, and exactly one FX conversion function** | ~40 sites, 2 contract files |
| **G68** | **A `SubjectLocation` variant for Quick Suite datasets**, or PDPA erasure is incomplete | Small, and a compliance gap |

🛑 **ONE FILE OR TWO? THE RECORD CONTRADICTS ITSELF ON THE LARGEST DELIVERABLE IN
v1, AND THIS IS THE CHEAPEST MOMENT TO SETTLE IT — found 8 Aug 2026.**

This row, `docs/HANDOFF.md` §8, `docs/INDEX.md`, `docs/contracts/README.md` and
`docs/screen-pack-ledger.md` all name **one** file, `administration.openapi.yaml`.
**`docs/v1-scope-ledger.md` §6 says one file will not do**, in its invariant-3
row:

> Holds only if the administration surface is split into
> `platform-administration.openapi.yaml` and `tenant-administration.openapi.yaml`.
> One combined file mixing `createTenant` with `updateReconciliationDefinition`
> **violates invariant 3** — `control-plane.openapi.yaml:52-63` names *"a
> definition name"* explicitly among the forbidden fields.

**The citation resolves and is accurate.** That block forbids tenant business
data from every control-plane schema and names *"a definition name"* among its
examples. **G50 (control plane in v1) and G58 (finance authors definitions) put
both kinds of operation in scope at once**, so the question fires now rather than
later.

⚠️ **State the counter-argument too, because the ledger overstates the
mechanism:** a YAML file is a document, not a plane, and invariant 3 constrains
*which plane serves what*, not how many files the operations are written in. Two
operations in one file is not by itself a violation. **What makes it real is that
file layout is how this repository has expressed plane boundaries so far** —
`control-plane.openapi.yaml` exists as a separate file for exactly this reason —
so a single combined admin file removes the only structural signal there is, and
leaves the boundary to reviewer attention.

~~**This is a DECISION, not a derivation, and nothing here should be built until it
is taken.**~~ ✅ **TAKEN 8 Aug 2026 — G76, and neither option won.**

**ONE file, with enforced plane TAGS**, plus `tools/check-plane-tags.mjs`
refusing tenant business data on a `[platform]`-tagged operation. That keeps a
single document — as five of the six sources assumed — while making the boundary
**mechanical rather than cultural**, which is what the ledger's objection was
actually about.

🛑 **THE CHECKER LANDS IN THE SAME COMMIT AS THE FILE.** A plane tag with nothing
reading it is §5.6 exactly: a control that reads as asserting something and
asserts nothing. This is now the **second** standing trigger for CI, beside §8
item 8's pack-publication validators — and there is still no `.github/`.

⚠️ **The red team's objection to this shape stands and is not answered by
choosing it:** a tag constrains a *schema*, invariant 3 constrains a *read*, and
the contracts carry **no machine-readable classification** today (`x-` extensions:
zero). So the checker's only available predicate is a schema **name**, which is
§5.1 — a rule keyed on a convenient landmark — structurally forced rather than
carelessly chosen. **Adding an explicit classification to the contracts is the
fix, and it is not designed.**

---

## 4. Module by module

### 4.1 `kernel.ts` · `identity.ts` — no change

`identity.ts` must compile unchanged through any trim; every drop below was
checked against it. ⚠️ `PartnerId`, `PartnerAccessGrantId` and
`PartnerTelemetryAccessId` **stay in `kernel.ts`** even though §4.2 and §4.3 drop
what uses them — dropping an id alias is how the proofs break.

---

### 4.2 `access.ts` — drop 3, retype 1

**G51: partner is a commercial record; no partner user signs in.**

| Export | Proposal |
|---|---|
| `PARTNER_CAPABILITY_MASK` (`:901`) | **drop** |
| `effectivePartnerCapabilities()` (`:926`) | **drop** |
| `PartnerAccessScopeKey` (`:882`) | **drop** — `keyof` the mask |
| `PartnerGrantTerms` | **KEEP** — commercial terms, which G51 retains |
| `AssignmentScope.valueCeiling` | **retype** — G66 collapses `MoneyAmount` into `Money`; G65 makes `amountMinor` a `bigint`. Also fixes `DENY_ALL`'s literal at `:698` |

🛑 **The consequence you accept by approving this — SHARPENED 8 Aug 2026, because
this paragraph understated it.** It read *"invariant 2 becomes declared and
unexercised."* **Unexercised was ALREADY true.** What this drop changes is
`enforceable` → `not enforceable`: the three exports above are the mechanism, so
dropping them puts invariant 2 in the same state as invariant 9 — expressed in
the type system with nothing able to run it.

**`docs/v1-scope-ledger.md` argues the other way and it must be read before this
is approved.** Its §7 lists these same exports under *"What was kept that a
reader might expect to be cut"*:

> `PARTNER_CAPABILITY_MASK` · `effectivePartnerCapabilities` · `PartnerGrantTerms`
> · `PartnerAccessScopeKey` | Four exports, zero screens, **invariant 2's entire
> enforcement**. The masks contain neither `approve_resolution` nor
> `execute_resolution` nor `view_summary` — the invariant expressed as an absence.

and its §6 rates invariant 2 **"Enforceable, unexercised"** *because* they were
kept. All four are live today — `access.ts` has zero drops. **So the trade is
four exports against zero screens, on one of the eleven.** Permitted under the
drop ruling; take it knowingly, against that framing rather than the softer one
this paragraph carried first. The richer options all needed **P2 answered
first**, and P2 is still open.

---

### 4.3 `domain.ts` — drop 2, retype, create

| Change | Detail |
|---|---|
| `PartnerAccessGrant` (~~`:3826`~~ **`:3878`**) · `PartnerAccessScope` (**`:3902`**) | **drop** — G51. `Partner` and `PartnerBillingArrangement` **stay**. ⚠️ **`domain.ts` line numbers drifted twice while this sweep was running** — re-derive with `grep -n "^export.*PartnerAccess" model/domain.ts` rather than trusting the numbers |
| `Money` (~~`:372`~~ **`:397`**) | **retype** — `amountMinor: bigint` (G65). Keeps `exponent`, which G66 makes universal. ⚠️ G112 bounds the sweep to what is *typed* `Money` — step 6 of §4.12 |
| 🆕 `FieldSpec` (`:1583`) gains a **JSONB path** | **create a field** — ✅ **RULED 8 Aug 2026 — G106, not applied.** A schema-agnostic JSONB payload has no per-field classification unless the mapping is real, and invariant 4 puts classification on `FieldSpec` and derives everything from it. **The load-bearing half is the default: a key with no `FieldSpec` is stored but UNREADABLE** — unaddressable by any agent, prompt, export or dashboard. Fail-closed, matching `DENY_ALL` and G100's deny-on-NULL. **Rejected, and preserved:** defaulting an unmapped key to the most sensitive class — readable-by-default-with-a-high-bar is scope failing OPEN, which §5.5 records this codebase already fixing once |
| 🆕 **an FX slice** | **create** — G61: a customer-entered, per-period rate with an as-at date and an owner, used **for presentation only**. `FxPolicy` and `FxConversion` are both currently dropped and **conversion must NOT return for matching or ceilings** — §5.7's refusal stands |
| everything else | **stays.** `ReconciliationRun`, `Exception`, `OperatorProposal`, `AskSession`, `Endpoint`, `DocumentType`, `FieldSpec` — the whole Tier 1 spine, and G58 and G62 make more of it load-bearing, not less |

⚠️ **`DocumentType` has no variant concept** and G69 needs one — four warehouses,
four languages, a per-variant engine binding (Textract vs a SageMaker custom
model) and per-variant confidence. **Create, not restore.** *(decision — the
shape is a product judgement)*

---

### 4.4 `governance.ts` — 🛑 the invariant change, plus one create

🛑 **G60 reverses invariant 8; G75 settled its shape. This was the highest-stakes
item in this document, and it is DECIDED and APPLIED.**

⚠️ **THE PARAGRAPH BELOW WAS FALSE FOR MOST OF 8 Aug 2026 WHILE THIS FILE'S OWN
BANNER SAID SO. The banner was added and the body was left** — which is worse
than plain staleness, because a reader who trusts a banner assumes the body was
fixed. It is struck rather than deleted, because the quote is the evidence for
what the shape used to be:

> ~~Today: `PERMITTED_RESOURCES.delivery` = telemetry, configuration, identity,
> endpoint, tenant_data. `CONTRACT_ONLY_RESOURCES` = authority. **`secret` is in
> neither** — and `bind_secret` maps to `secret`, so an FDE cannot bind the
> credential G59 requires them to bind.~~

**What the tree says. Derive it; do not trust the struck paragraph and do not
trust this one either:**

```bash
grep -n "^export const \(PERMITTED\|CONTRACT_ONLY\|NON_DELEGABLE\)_RESOURCES" model/governance.ts
grep -n "^ *'secret',$" model/governance.ts
```

| List | `model/governance.ts` | Holds today | `secret`? |
|---|---|---|---|
| `PERMITTED_RESOURCES.delivery` | `:436` | telemetry · configuration · identity · endpoint · tenant_data · **`secret`** (`:474`) | ✅ **IN** |
| `PERMITTED_RESOURCES.incident` | `:476` | telemetry · configuration · endpoint · tenant_data | not in |
| `CONTRACT_ONLY_RESOURCES` | `:512` | `authority`, alone | **not in** |
| `NON_DELEGABLE_RESOURCES` | `:544` | `statutory`, alone | **not in** |

**The consequence sentence inverts with it: an FDE CAN bind the credential G59
requires them to bind, and has been able to since 8 Aug 2026.** `bind_secret`
still maps to `secret` (`model/access.ts:565`) — that half of the sentence was
always right; what moved is the class, not the capability. And the reach is a
**standing 90-day** one, not a per-engagement one: `MAX_GRANT_HOURS.delivery` is
`24 * 90` (`model/governance.ts:565`).

> 🛑 **SETTLED AND APPLIED 8 Aug 2026 — G75, AND THIS SECTION WAS INCOMPLETE.**
> The owner chose the **first** shape below, not the recommended second: `secret`
> went into `PERMITTED_RESOURCES.delivery`, a standing 90-day reach. The
> recommendation and its argument are left standing beneath — **marked overruled
> rather than deleted**, because the decision was taken against them and this
> record keeps the losing case.
>
> ⚠️ **What this section MISSED, and it would have made either shape inert:**
> the sentence *"`secret` is in neither"* is true of the two lists it names and
> **omits a third**. `secret` also sat in **`NON_DELEGABLE_RESOURCES`**
> (`model/governance.ts`), which `authorisationPermits()` checks **first —
> before the null check, before withdrawal, before anything**. Moving `secret`
> into either permitted list without removing it there would have been recorded
> as applied and changed nothing. **The generalisation is the useful part:
> widening a permitted list means checking the non-delegable list too**, and no
> document in this record made that connection before it was hit.

**Two shapes were on the table. This document recommended the second. THE OWNER
CHOSE THE FIRST.** The recommendation and its argument are kept below exactly as
written — that losing case is what a future reopening needs, and deleting it
would leave a reversal with no record of what it reversed.

| Shape | Effect | Outcome |
|---|---|---|
| `secret` → `PERMITTED_RESOURCES.delivery` | A **standing 90-day reach** to every customer credential. Pass A: `PERMITTED_RESOURCES` is *"the single constraint that makes a weeks-long grant acceptable"* | 🛑 **CHOSEN — G75. Applied 8 Aug 2026**, `model/governance.ts:474`, with the decision and its rejected alternative written at the line that does it |
| ~~✅~~ `secret` → **`CONTRACT_ONLY_RESOURCES`** | Reachable **only under a signed `SupportAuthorisation`** the customer pre-authorises at contract time, naming purpose, max hours and who may invoke. Same capability for the FDE; far narrower blast radius. Pass F: the first non-demo customer is a regulated enterprise | ❌ **RECOMMENDED AND OVERRULED.** The argument was in front of the owner when the decision was taken. **Do not relitigate it, and do not quietly narrow it back** — G75 |

**What was given up, and what was not.** Given up: the customer's per-contract
say over whether a credential is reachable at all — the platform decides it now,
and a customer who withholds `authority` still cannot withhold this. Not given
up: every reach is still a grant, still authorised, still audited; `secret` still
has no read mode; and `statutory` is still reachable by nothing, at any price.

🛑 **If this is ever reopened, it is FOUR edits and not one** — the three lists
above plus the refusal code `'statutory_never_delegable'`
(`model/governance.ts:662`, returned at `:704`), which is named for one member and
was wrong for the three days the list had two (§5.1) — plus the wire, below.

⚠️ **AND THE WIRE HAS NOT MOVED. Found closing this sweep, 8 Aug 2026, by reading
the contract rather than the row that describes it.** The resource enum on
`control-plane.openapi.yaml` is still **six** values in **both** places it
appears — `:2397` and `:2516`, `[telemetry, configuration, identity, endpoint,
tenant_data, authority]` — and `:2413` still tells the world that *"`statutory`
and `secret` are in `NON_DELEGABLE_RESOURCES` and no authorisation opens them at
any price"*, which the tree contradicts at `model/governance.ts:474` and `:544`.

```bash
grep -rn "enum: \[.*tenant_data" docs/contracts/*.yaml   # → two lines, six values each
```

**This is the invariant-8 half of G75 unapplied on the wire, not a documentation
lag**, and it fails in the strict direction: a grant line naming `secret` is
rejected by the contract while the model permits it, so an FDE binding a
credential is refused by the schema. ⚠️ **`docs/HANDOFF.md`'s G75 row states the
opposite** — *"the access-path enum went **six values to seven**"* — and that
claim does not survive the grep above. **`docs/contracts/` is not this document's
to edit; the correction is owed there and is recorded here so it is not lost.**

🆕 **Create: an eleventh `SubjectLocation` variant for Quick Suite datasets.**
`SubjectLocation` has ten variants (`source_document`, `blob`, `trace`,
`notification`, …) and **none covers a copy of tenant data inside a BI tool.**
G70 puts a Quick Suite account per tenant; a SPICE dataset is tenant data we must
be able to name in an erasure plan. **Without this, PDPA erasure is incomplete** —
and `PRODUCT.md` names PDPA as the primary regime. *(derivation — the union is
closed and the gap is demonstrable)*

**Everything else in `governance.ts` stays and G50 makes it more load-bearing**:
tenant provisioning and `TenantAccessGrant` issuance are this module's subject.

---

### 4.5 `catalog.ts` — no drops; one closure

**G49 makes this module *more* important, not less.** A customer never chooses a
model; the FDE does, and **the catalogue is what the control plane publishes
downward** — invariant 3's own shape.

| Export | Proposal |
|---|---|
| `resolveModel()` | 🛑 **KEEP — override 1.** The only enforcement of invariant 7, and **G69 widens its remit**: an extraction model resolves through it, so residency now covers extraction as well as inference. ✅ **G104 widens it again and makes the KEEP structural** — no model identity may appear in engine code at all; the catalogue is the only source, the engine calls `resolveModel()`, and **changing a model becomes a catalogue publication rather than a code deploy**, which is what G49 says it should be. The catalogue is seeded with `claude-haiku-4-5-20251001`. Ruled 8 Aug 2026, **not applied** |
| `ModelCatalogEntry` · `ModelCapabilities` · `RetentionPosture` · `InferenceRouting` · `ModelRejection` · `ModelResolution` | **KEEP** |
| `ModelCost` | **KEEP, flagged** — customers do not choose, so cost is a platform concern; metering still reads it |
| ~~`provider: 'bedrock' \| 'other'` (`:120`)~~ | ✅ **DONE — G80b, applied 8 Aug 2026.** The field reads `provider: 'bedrock' \| 'sagemaker'` at **`model/catalog.ts:137`** today; the citation and the union above are both pre-application and are struck rather than deleted. `'other'` was unreachable, which is §5.6's shape. **A derivation, not a decision.** ⚠️ Nothing constructs a `ModelCatalogEntry`, so `tsc` could not have failed on it — §5.10 — and `ProviderCostRecord.provider` carries the identical defect, untouched: `'bedrock' \| 'aws_other' \| 'third_party'` at **`model/billing.ts:505`**, where G54 makes `third_party` unreachable |

⚠️ `{ kind: 'global' }` **stays** in `InferenceRouting`. It is the arm
`resolveModel()` exists to reject; deleting it deletes the test.

🆕 **Two gaps G49 opens, unchanged from the first draft and still unanswered:**
**no capability names "set the model"** (and it should be `authority`, not
`configuration`, because `delivery` reaches `configuration` — G26's hole); and
**a model-change support ticket is not a defect report**, which is the only thing
`Support.dc.html` can express.

---

### 4.6 `agents.ts` — no change (G52), but it acquires a build item

31 live, 8 dropped, and the 8 are the authoring half. `TOOL_EFFECT`,
`DELEGABLE_TO_AGENT`, `DerivedAgentGrant`, `mintAgentGrant()` and
`validateAgentToolBindings()` all survive — **invariant 6 keeps an enforcement and
invariant 11 keeps its per-step expiry.**

⚠️ `HarnessDocument`, `AgentDefinition` and `AgentToolBinding` stay `TenantScoped`
**because a pack MINTS them into a tenant.** Do not read `TenantScoped` as *"the
tenant edits this."*

🆕 **G62 makes G45 a v1 prerequisite** — two agent definitions and a rule for what
the reader may emit. **Not a trim; a build.** §3.

---

### 4.7 `observability.ts` · `billing.ts` · `evaluation.ts` · `correspondence.ts` — no model change; **correct the reasoning**

G48 bites hardest here. `docs/v1-scope-ledger.md` justifies these drops with
**"what the demo loses: nothing drawn"** — a statement about a screen pack, not a
product.

| Module | Under a product test |
|---|---|
| `observability.ts` | ⚠️ **Drops stand, reason does not.** A product needs operational visibility whether a screen renders it or not. G51 removes the *partner views* by decision — that is the valid argument |
| `billing.ts` | ✅ **Survives on better grounds than it was given** — G51 (partner), G36 (BYOA), and `PRODUCT.md` forbidding fabricated pricing, which is an **evidence** argument. ⚠️ **Retype: `MoneyAmount` → `Money`, `bigint`** |
| `evaluation.ts` | ✅ Survives — *"no labelled corpus exists"* was never demo-shaped. ⚠️ **Check the 21 drops did not take the injection corpus** — invariant 9's carve-out depends on probes existing |
| `correspondence.ts` | ✅ Zero drops, correct — it is invariant 6's subject |

---

### 4.8 `policy.ts` — one **create** (not a restore), one deletion

⚠️ **Correction to the first draft.** It said *"restore `managed_service_use` from
dropped."* **It does not exist.** `POLICY_KINDS` has seven members —
`autonomy · approval · modelUse · dataEgress · spend · contentGuardrail ·
correspondence` — and G7 is recorded **not applied**.

| Change | Detail |
|---|---|
| 🆕 `managed_service_use` + `ManagedServiceUseConfig` | **CREATE** — G7's design, made live by **G53/G69**: Textract is an AWS AI service and needs `allowedFeatures`, `allowedRegions`, `maxDataClassToService`, `maxProviderRetentionDays`. ⚠️ **Deliberately no `requireImprovementOptOut` boolean** — that is a caller-supplied off-switch on a residency check (§5.2) |
| `MoneyAmount` (~~`:148`~~ **`:164`**) | **DELETE** — G66. **27** references — `billing.ts` 17, `policy.ts` 3, `examples.ts` 2, `domain.ts` 1, `control-plane.openapi.yaml` 4 *(said 24 until 8 Aug 2026; derive it — `grep -rho MoneyAmount model/*.ts docs/contracts/*.yaml \| wc -l`)*. `AutonomyConfig.autoResolveValueCeiling` becomes `Money`, which is what makes it comparable with `AssignmentScope.valueCeiling` for the first time |
| `spend` · `contentGuardrail` | **stay dropped.** Adding a live kind means re-deriving `LivePolicyKind` — one edit by construction |

🛑 **G8 comes with G53 and is not a model change:** the AI-services opt-out is
contractual **and** attested, and needs
`organizations:DescribeEffectivePolicy` granted by **every v1 customer at
onboarding**. ⚠️ **G69 splits the posture** — the opt-out applies to Textract and
**not** to a self-hosted SageMaker endpoint. Two postures in one pipeline.

---

### 4.9 `learning.ts` — no change, flagged

28 live, 33 dropped. **G39 `amendProcedure` keeps ~18 learning exports alive** and
is drawn on `Finding.dc.html` and `Setup.dc.html`, both *in the demo*. G39 is
**not applied**. **If G39 is in v1, some of the 33 come back** — that is G39's
decision, not this trim's.

---

### 4.10 `deployment.ts` — ⚠️ may need a partial restore

**G36 stays: BYOA slips, and G50 does not reach this module** — a control plane is
not a data plane.

⚠️ **But G70 does.** Account-per-tenant Quick Suite means **a fleet of per-tenant
things to provision, monitor, patch, bill and decommission** — which is the
operational shape this module models (liveness, versions, heartbeat) and which
G36 deferred. **The object differs; the operational problem does not.**

**I am not proposing a restore, because it depends on an answer nobody has given:
who operates the per-tenant BI accounts, and with what.** If the answer is "the
control plane, with a runbook", some of these 12 exports come back. *(decision)*

---

### 4.11 `presentation.ts` — **no change. The first draft's restore is CANCELLED.**

The first draft proposed restoring ~46 exports under G55. **G57 (BI is Amazon
Quick Suite) and G68 (rely on Quick Suite RLS) cancel it.** Quick Suite renders
the dashboard; `presentation.ts` stays 51-of-53 dropped and **needs no edit at
all** — the cleanest outcome available, since the restore was never applied.

🛑 **Three consequences of G68, none of them solved, recorded so they are not
lost:**

1. **`view_dashboard` and `view_summary` go back to being verbs with no noun** —
   precisely the problem `model/presentation.ts:6-13` was written to fix. *"A verb
   with no noun cannot be scoped, cannot be masked, cannot be audited as a
   `DataAccessEvent`, and cannot appear in an erasure plan."*
2. **A dashboard read cannot be recorded by us**, so invariant 10 does not reach
   it. Quick Suite has its own audit trail; it is outside our chain.
3. **A SPICE dataset is tenant data outside our erasure plan** — §4.4 proposes the
   `SubjectLocation` variant that closes it.

🟢 **G70 buys back most of what G68 gave up:** account-per-tenant makes isolation
structural again, so **invariant 1 holds by construction for the BI layer** rather
than by a row filter.

---

### 4.12 The retype, across four modules and two contract files

~~**The largest mechanical change here, and it should be ONE commit** — a partial
money retype is worse than none.~~ ⚠️ **AMENDED — G78, 8 Aug 2026, and the
original stands above because the amendment is narrow.** *"A partial money retype
is worse than none"* holds **within** a step and not **across** them: two
complete commits are not a partial retype. It is still the largest mechanical
change here.

**Three of today's rulings bound this section, and none is applied:** G78 splits
it in two (step 3), **G112 decides what the sweep REACHES** (step 6), and **G111
decides what may touch the representation at the boundary** (step 7).

⚠️ **This table's header said `| Step | Detail |` while every row after the first
carried four cells** — so steps 2–5 rendered with two cells silently dropped from
8 Aug 2026 until this sweep. Header corrected; no row content was changed.

| Step | Change | § | Ruling and state |
|---|---|---|---|
| 1 | `MoneyAmount` **deleted**; every site takes `Money` | 4.8 | G66 — **commit 1** of G78's two, and the one that pays immediately. Not applied |
| 2 | `access.ts` + `domain.ts` — ~~**drop 5**~~ **DROP 2** | 4.2, 4.3 | ✅ **RULED 8 Aug — G77, NARROWED.** Drop only `PartnerAccessGrant` and `PartnerAccessScope` (`domain.ts`). **KEEP the `access.ts` mask and function** — `v1-scope-ledger.md` §7 calls them *"invariant 2's entire enforcement"*, and this document's own §0 **override 1** forbids dropping the last enforcement of an invariant. **Invariant 2 stays ENFORCEABLE.** Not applied — sequenced after G81's trim re-run |
| 3 | ~~**The money retype, as one commit**~~ **TWO commits** | 4.12 | ✅ **RULED 8 Aug — G78.** Commit 1 is G66 (one `Money`, no wire change) and pays immediately: it makes the two value ceilings comparable for the first time. Commit 2 is G65 + G67 (`bigint`, string on the wire, **breaking**, plus exactly one `parseFxRate()`). ⚠️ **27 references, not 24.** 🟢 The 8 Aug fixtures construct `Money` in three places, so the compiler now checks this. Not applied |
| 4 | `policy.ts` — **create `managed_service_use`** | 4.8 | ✅ **RULED AND APPLIED 8 Aug — G79**, full four-field G7 shape, no `requireImprovementOptOut`. `POLICY_KINDS` is now eight declared / six live. 🟢 **The fixture caught it**: `TS2741` on `PLACEHOLDER_POLICY_DEFAULTS` before anyone touched it. ⚠️ **The contract is drifted by one arm in nine places** and `ManagedServiceUseConfig` does not exist on the wire |
| 5 | `governance.ts` — **`SubjectLocation` variant for BI datasets** | 4.4 | ✅ **RULED AND APPLIED 8 Aug — G80a.** Eleventh variant `bi_dataset`, named vendor-neutrally so the union does not pin a supplier. ⚠️ **G82 makes it sharper, not softer** — the copy is in another region, and green found it must be registered **at every SPICE refresh**, not once at provisioning |
| 6 | **The retype follows the TYPE, not the NAME** | 4.12 | ✅ **RULED 8 Aug — G112.** Anything typed `Money` converts, and everything reachable through it; a field whose name merely ends in `Minor` does **not**, until somebody argues it is money. Narrowest defensible blast radius, which is the point of G78 giving it its own commit. **`valueAtRiskAtLeastMinor` becomes `type: string` with a numeric pattern** — it is `{ type: integer }` today at `docs/contracts/capability.openapi.yaml:550` (verified), and a query string carries text anyway, so `integer` there was always a fiction. ⚠️ **The commit must NAME the fields that are money-in-fact but not typed `Money`**, as known survivors, or the next reader believes the sweep was total. Not applied |
| 7 | **ONE money codec, and nothing else touches the representation** | 4.12 | ✅ **RULED 8 Aug — G111.** After G65 and G71 both apply, `amountMinor` is `bigint` in the model and a decimal **string** on the wire — so money is **not literally a shared type**, which is the caveat `PRODUCT.md`'s Stack section already carries against G71's second argument. Every boundary calls the codec; nothing else constructs a `Money` from a string or a string from a `Money`. **Same shape G67 demands of `parseFxRate()` — exactly one function — for the same reason: correctness that lives at call sites is correctness that drifts**, and a checker can enforce one module mechanically. **Rejected, and preserved: a `toJSON()` on `Money`** — `erasableSyntaxOnly` leaves an interface with nothing to hang a method on, and it would suppress the `JSON.stringify` throw G71 names as a **feature**, because that throw is what forces the boundary decision instead of letting it drift. Not applied |

⚠️ **`costCentre` vs `costCenter`** is still divergent and load-bearing on an
authorisation join. **Not folded in** — it needs its own commit, per the standing
practice.

---

### 4.13 `examples.ts` — no change to propose; ✅ the debt is PAID

✅ **The fixtures pass landed 8 Aug 2026**, after this document was written. All
five total records now have a construction site — `PLACEHOLDER_RETENTION_POLICY`,
`PLACEHOLDER_POLICY_DEFAULTS`, `fourEyesAboveThreshold`, `invoiceFieldSpecs` and
the operator-proposal path — under the `FIXTURES` banner in `model/examples.ts`.
`docs/HANDOFF.md` §5.10 carries the table and the two red runs.

⚠️ **THE WARNING THIS SECTION EXISTED TO GIVE IS UNCHANGED, and applying this
proposal is exactly when it bites.** Adding or removing a `@dropped-for-v1` note
changes no type, so **a green `tsc` after applying any row above still tells you
nothing.** The fixtures witness the five records that existed on 7 Aug; they
witness nothing about a drop, and nothing about a type this proposal would
CREATE.

**So the rule for applying this document is:** every 🆕 create in §4 — the FX
slice (§4.3), the `SubjectLocation` variant (§4.4), `managed_service_use`
(§4.8), `DocumentType` variants (§4.3) — **needs its fixture in the same commit
as the type**, not afterwards. That is cheap while the type is being written and
becomes a separate archaeology exercise later. §4.12's retype is still the one
exception where the compiler genuinely checks the work on its own.

---

## 5. What I need from you

> ✅ **ALL NINE WERE RULED ON, 8 August 2026** — one at a time, at the owner's
> direction. **This section is now a RECORD, not a request.** Four are applied in
> `model/`; the rest are decided and unapplied. `docs/HANDOFF.md` §3 pass H
> (G75–G89) is the authority, and where this table and that one disagree, **the
> decision table wins** — it carries the reasoning and this carries the summary.
>
> ⚠️ **Three of the nine did NOT go the way this document recommended**, and the
> rejected arguments are preserved where they sit rather than deleted: item 1
> (§4.4), item 7 (§4.3) and item 9 (§4.7).

**Sign off per module.** Nine items needed a real decision:

| # | Item | § | What you are accepting |
|---|---|---|---|
| ~~1~~ | 🛑 ~~`governance.ts` — **`secret` into `CONTRACT_ONLY_RESOURCES`**~~ **DECIDED 8 Aug 2026 — G75 chose `PERMITTED_RESOURCES.delivery`, the BROAD shape, against this recommendation. ✅ Applied.** A standing 90-day reach, not contract-time authorisation. ⚠️ **And applying it found a third list this section never named:** `secret` also sat in `NON_DELEGABLE_RESOURCES`, checked FIRST in `authorisationPermits()` — so either shape would have been **inert** without removing it there. ⚠️ ~~The wire moved too: the access-path enum went six values to seven~~ **IT DID NOT — corrected 8 Aug 2026 (evening) by reading the file.** Both resource enums in `control-plane.openapi.yaml` (`:2397`, `:2516`) are still six values, and `:2413` still asserts `secret` is non-delegable. **The model half of G75 is applied; the wire half is not**, and it fails strict — the schema refuses a grant line the model permits. §4.4 | 4.4 | — |
| 2 | `access.ts` + `domain.ts` — **drop 5** | 4.2, 4.3 | 🛑 **Invariant 2 stops being ENFORCEABLE** — not merely unexercised, which it already was. Four exports against zero screens, and `v1-scope-ledger.md` §7 argues for keeping them by name |
| 3 | **The money retype, as one commit** | 4.12 | ~40 sites, both contract files, **breaking on the wire** |
| 4 | `policy.ts` — **create `managed_service_use`** | 4.8 | Brings G8's onboarding dependency for every v1 customer |
| 5 | `governance.ts` — **`SubjectLocation` variant for BI datasets** | 4.4 | Without it, PDPA erasure is incomplete |
| 6 | `catalog.ts` — **close `provider`** | 4.5 | ✅ **RULED AND APPLIED 8 Aug — G80b.** `'bedrock' \| 'sagemaker'`. ⚠️ Nothing constructs a `ModelCatalogEntry`, so `tsc` could not have failed on it — §5.10, still unwitnessed. ⚠️ `ProviderCostRecord.provider` carries the identical defect and was left alone |
| 7 | `domain.ts` — **`DocumentType` variants** | 4.3 | ✅ **RULED 8 Aug — G85, AGAINST this recommendation. NO variant concept is created.** The Textract verification (§3c) found **no CJK coverage at all**, printed or handwritten — so the four-language premise was unbuildable, and the owner narrowed `DocumentTypes.dc.html` to Latin script rather than training a SageMaker model against labelled Mandarin data that does not exist. 🟢 Handwriting survives (Latin). 🟢 G53 stands: IDP is Textract |
| 8 | `deployment.ts` — **partial restore?** | 4.10 | ✅ **RULED TWICE 8 Aug.** **G86:** BI provisioning gets **new** `BiWorkspace` types rather than restoring data-plane-shaped ones — reusing `DataPlane` for a BI account is §5.1. **G88:** the version **discipline** lands in v1 (expand/contract + per-artefact format versions) while the fleet **types** stay dropped until BYOA. **`deployment.ts` stays 0 live / 12 dropped; G36 intact** |
| 9 | `v1-scope-ledger.md` — ~~**correct the reasoning on 4 modules**~~ **RE-RUN ALL SIXTEEN** | 4.7 | ✅ **RULED 8 Aug — G81, LARGER than proposed.** The owner took G48's full question rather than this document's four-module slice: every module is re-adjudicated against *what a customer would fail to GET* instead of *what the demo loses*. ⚠️ **It produces a NEW dated ledger, not an edit** — `v1-scope-ledger.md` is banner-marked a snapshot under G32, and rewriting a snapshot's reasoning destroys the only thing a snapshot is for |

**And three that are builds, not trims, and dwarf the list above:** the
authoring surface (G58), the `Ask` contract tier plus G45 (G62), and a platform
surface for the FDE (G50/G59/G70).

**Two verifications still open:** Quick Suite's namespace and RLS model with
`ap-southeast-1` availability, and Textract's coverage boundary — the latter now
softened by G69, since a SageMaker custom model catches what Textract cannot.

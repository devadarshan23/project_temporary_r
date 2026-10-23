# Green team — reconciliation spine, first build phase

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — a green-team input to a plan, not a decision; `docs/build/phase-one-plan.md` adjudicates it.
> ⚠️ **Two of its dependency gates were closed on 8 Aug 2026 and it still lists them as open.** `managed_service_use` **exists** — G79 landed it in `model/policy.ts` with the full four-field shape, so this file's instruction to create it would produce a duplicate; its stated `POLICY_KINDS` membership is short by one. And the `secret` implementation shape it calls *"G60's open question"* is **closed** by G75, in the broader direction. Derive the kinds rather than reading the number here: `node tools/check-doc-counts.mjs --derive`.
> ✅ **BODY CORRECTED 8 Aug 2026** — the banner was added earlier the same day and the body was left untouched, which is worse than plain staleness because a reader who trusts a banner assumes the body was fixed. Four passages corrected, none deleted: the `POLICY_KINDS` row in **R1**'s model-type table, the `managed_service_use` line in **R1**'s out-of-scope list, **R3**'s `credentialRef` note (G60's shape is closed by G75, in the broader direction), and **§0**'s evidence table, which now records the test runner that landed today. Every superseded claim is struck through with the correction beside it.
> *Banner added 8 Aug 2026; body corrected the same day.*

> 🟡 **A PROPOSAL. NOTHING HERE IS APPLIED.** No file in `model/`, `docs/contracts/`
> or `Mockups/` is changed by this document. Written 7 August 2026 against
> **G49–G71** (`docs/HANDOFF.md` §3, all taken 7 Aug), `docs/v1-trim-proposal.md`
> (itself unapplied), and `docs/screen-pack-ledger.md` §3.3 / §4 / §5.
>
> **Scope: the reconciliation spine only** — arrival → extraction → confirmation →
> definition → run → exception → proposal → decision → post. Ask, Reports, BI,
> Notifications, Support, Login, the platform/FDE tier and everything partner- or
> billing-shaped are named in §6 as out of scope and not designed here.
>
> **Every claim about `model/` or `docs/contracts/` carries `file:line`.** Every
> gap is marked **DERIVATION** (follows from something already decided — not
> deferrable, per `docs/HANDOFF.md` §7) or **DECISION** (somebody must choose).

---

## 0. The method, and the one thing that makes it verifiable

`CLAUDE.md` requires *"done"* to be defined before code. In this repository the
usual definition is unavailable and saying so is part of the deliverable:

| Evidence | Strength here | Why |
|---|---|---|
| `tsc -p model/tsconfig.json --noEmit` → `EXIT: 0` | ⚠️ **weak** | The model is types only. Most changes *cannot* fail to compile — `CLAUDE.md`, "Writing model code" |
| `node tools/planner/extract.mjs` — edges and gaps **by kind** | medium | Catches dangling references `tsc` cannot. Blind to union members, `Record` re-keys, non-id-shaped columns, drop notes, every OpenAPI schema |
| **A fixture in `model/examples.ts` that CONSTRUCTS the shape** | 🟢 **strong** | The only artefact that witnesses *content*. `model/examples.ts:48,152,253,298` already construct `ReconciliationDefinition` and `SolutionPack` — `examples.ts:310` constructs a live `Money` — so a retype there is genuinely compiler-checked |
| A grep assertion over the OpenAPI text | strong for absences | The only mechanical check on a contract in this repo |
| A runtime assertion naming a code from `docs/contracts/errors.yaml` | strong, once code exists | 71 closed codes; the error class is the only diagnostic that survives redaction |
| **`npm test` — `node --test` over `tests/`** | 🟢 **strong, and it did not exist when this table was written** | ✅ **Added 8 Aug 2026.** The table above assumed the only executable evidence was `tsc` plus a fixture. There is now a test runner and `model/` is runtime-importable: `tests/model/access-decide.test.ts` is the first behavioural assertion against `model/`, and `tests/model/runtime-importability.test.ts` asserts every module on disk loads under node. ⚠️ **A green `node --test` alone is not a control** — that file records `CAPABILITIES.view_summary` (no such key) passing the runner while failing `tsc`, which is why `npm test` is `typecheck:tests && node --test` |

⚠️ **`model/examples.ts:329` carries `documentTypeTemplates: []`.** No fixture in
this repository constructs a `DocumentType`, a `SourceDocument`, an `Exception`, a
`ResolutionProposal` or an `OperatorProposal`. **Every slice below therefore owes a
fixture**, and that owing is the single largest reason a green `tsc` after a model
change here tells you nothing (`docs/HANDOFF.md` §5.10).

**Every slice's Verification section names a fixture. That is the "done" definition.**

---

## 1. The eight slices, and the order

| # | Slice | Screens | Blocks |
|---|---|---|---|
| **R0** | One `Money`, `bigint`, and the FX rate finance signs for | all | R4 · R6 · R7 |
| **R1** | Arrival to extracted values — the IDP path | Close band D · Confirm · DocumentTypes | R2 · R5 |
| **R2** | Band D — a person reads what the machine could not | Confirm | R5 (the pile drains into a run) |
| **R3** | Document types finance owns — versions, variants, engines | DocumentTypes | R1's engine binding |
| **R4** | Reconciliation definitions finance authors — Tier 2 Save, and a version you can resolve | Reconciliations | R5 · R6 |
| **R5** | The run — trigger, admission, and the fifth cell that is not a status | Close run strip | R6 |
| **R6** | Exception to posting — proposal, approval, write-back, four minutes | Close · Finding | — |
| **R7** | The operator's question — `OperatorProposal` reaches the wire | PostingCheck | — |

```
R0 ──┬─────────────────────────────► R4 ──► R5 ──► R6
     └──► R1 ──► R2 ──► R5              ▲
          ▲                             │
     R3 ──┘                             └── R7 (needs R0 + R6's Endpoint write path only)
```

**R0 first, and as ONE commit.** `docs/v1-trim-proposal.md` §4.12: *"a partial money
retype is worse than none."* It is also the only change in this phase the compiler
genuinely checks.

**Three slices are net-new contract surface, not edits:** R3 and R4 need
`administration.openapi.yaml`, which **does not exist** (`docs/contracts/README.md`
§"The tier that is missing"); R7 needs new paths in `capability.openapi.yaml`.

---

## R0 — One `Money`, `bigint`, and the FX rate finance signs for

### Issue

**Title:** Collapse `MoneyAmount` into `Money`, make `amountMinor` a `bigint`,
serialise as a string, and land exactly one FX parse-and-convert function.

**Problem.** Two money vocabularies exist and diverge. `Money`
(`model/domain.ts:372`) carries `currency · amountMinor · exponent`; `MoneyAmount`
(`model/policy.ts:148`) carries no exponent. **The two ceilings a proposal must
satisfy are one of each** — `AssignmentScope.valueCeiling: Money | null`
(`model/access.ts:673`) and `AutonomyConfig.autoResolveValueCeiling: MoneyAmount |
null` (`model/policy.ts:137`) — **and no function converts between them**
(G43's third obstacle). `amountMinor` is `number` at every one of the 16 money
fields and `bigint` appears nowhere in `model/`.

**Why first phase.** Every later slice writes or compares money: R4 saves
tolerances (`Tolerance` has a `{ kind: 'money'; value: Money }` arm,
`model/domain.ts:1747`), R6 posts a journal, R7 compares
`ProposedTransaction.value` against a ceiling. Retyping after those land is a
migration of stored integers; retyping now is a compile error in one commit. G65,
G66, G67.

### Build contract

| Model type | `file:line` | Status | Change |
|---|---|---|---|
| `Money` | `model/domain.ts:372` | **live** | `amountMinor: number` → **`bigint`**. `exponent` kept and becomes universal |
| `MoneyAmount` | `model/policy.ts:148` | **live** | **delete** — G66. 24 references across `billing.ts`, `domain.ts`, `policy.ts`, `control-plane.openapi.yaml` |
| `AutonomyConfig.autoResolveValueCeiling` | `model/policy.ts:137` | live | becomes `Money \| null` — comparable with `AssignmentScope.valueCeiling` for the first time |
| `AssignmentScope.valueCeiling` | `model/access.ts:673` | live | unchanged shape; `DENY_ALL`'s literal at `model/access.ts:698` takes `0n` |
| `FxPolicy` | `model/domain.ts:394` | **`@dropped-for-v1`** | stays dropped for matching |
| `FxConversion` | `model/domain.ts:383` | **`@dropped-for-v1`** | stays dropped for matching — §5.7's refusal stands |
| `FxRate` | — | **does not exist, must be created** | see shape below |
| `parseFxRate()` / `convertForDisplay()` | — | **do not exist, must be created** | G67. Exactly one of each, in the same commit |

```ts
/** G61/G67 — customer-entered, per period, PRESENTATION ONLY. */
export interface FxRate extends TenantScoped {
  id: FxRateId                    // new brand in kernel.ts
  periodId: ReconciliationPeriodId
  from: string                    // ISO 4217
  to: string
  /** Stored VERBATIM as typed. A decimal string is what a controller signs for. */
  rate: string
  asAt: Timestamp
  /** A judgement with an owner, like a tolerance. */
  enteredByUserId: UserId
  version: number
}
```

**Contract operations.** No new operation. **Both** contract files change:
`amountMinor: { type: integer }` → `{ type: string, pattern: '^-?[0-9]+$' }`, and
`control-plane.openapi.yaml`'s `MoneyAmount` schema is **deleted** in favour of one
referenced `Money`. **Breaking on the wire** (G65). Authoring an `FxRate` is an
`administration.openapi.yaml` operation and lands with R4.

**Capabilities.** `configure_tolerance` → `configuration` (`model/access.ts:517`
join). ⚠️ **No capability names "enter the period FX rate."** Recommend reuse of
`configure_tolerance` rather than minting a 37th — a rate is a signed finance number
with a version and an owner, which is what that capability already governs.
**DECISION**, and G55 (*fewer knobs*) is the argument for reuse.

### Invariant obligations

| Invariant | Enforced by | Status after this slice |
|---|---|---|
| **5 — money is always derived** | `UsageRecord` is unpriced by shape (`model/billing.ts:122`); `MeterPrice.unitPriceMinor` (`billing.ts`) is the only price | Holds; `unitPriceMinor` takes `bigint` with the rest |
| **1 — tenant from session** | `FxRate extends TenantScoped`; `tenantId` appears in no request body (`docs/contracts/README.md:34`) | Holds |
| **§5.7's refusal (not an invariant, load-bearing)** | `FxConversion` stays `@dropped-for-v1` at `model/domain.ts:383`; **no matching or ceiling code may import `convertForDisplay()`** | ⚠️ Enforced by convention only — see Verification |

### Verification

1. **Fixture, and it already half exists.** `model/examples.ts:310` constructs
   `costCeilingPerRun: { currency: 'SGD', amountMinor: 42, exponent: 2 }`. After the
   retype that line **must** be `42n` or `tsc` fails. Add a second fixture
   constructing an `FxRate` and an `AutonomyConfig` so the ceiling collapse is
   witnessed.
   ```bash
   /tmp/tscheck/node_modules/.bin/tsc -p /Users/jrkphani/Projects/Reconcile/model/tsconfig.json --noEmit; echo "EXIT: $?"
   ```
   ⚠️ Run as **its own command**, never chained, never piped (`CLAUDE.md`).
2. **No money field is still a `number`:**
   ```bash
   grep -rnE '(amountMinor|[a-zA-Z]+Minor)\s*\??:\s*number' model/*.ts   # expect 0 lines
   grep -rn 'MoneyAmount' model/ docs/contracts/                          # expect 0 lines
   ```
3. **No integer money on the wire:**
   ```bash
   grep -n -A2 'amountMinor' docs/contracts/*.yaml | grep -c 'type: integer'   # expect 0
   ```
4. **Exactly one converter:**
   ```bash
   grep -rn 'parseFxRate\|convertForDisplay' model/*.ts | grep -c 'export function'   # expect 2
   ```
   and the refusal, asserted as an absence: no file matching
   `access.ts|policy.ts|<matching engine>` may reference `convertForDisplay`.
5. **`JSON.stringify` throws on `bigint`** — G71 records this as a feature. A
   one-line Node assertion at the serialisation boundary that a `Money` round-trips
   as `{"amountMinor":"42"}` is the runtime "done".

### Dependencies

None. This is the phase's root.

### Explicitly out of scope

Conversion during **matching** or **ceiling comparison** (G61, §5.7 — refused, not
deferred). Market rate feeds (`PRODUCT.md` honesty rule). The
`costCentre`/`costCenter` spelling divergence — `docs/v1-trim-proposal.md` §4.12
requires its own commit. `billing.ts` rating and invoicing.

---

## R1 — Arrival to extracted values: the IDP path

### Issue

**Title:** A document lands, is sanitised, is extracted by Textract or a SageMaker
custom model chosen per document-type variant, and every field is scored against
its own floor.

**Problem.** **Nothing in `model/` binds an extraction service.** `extract` is an
`AgentAction` (`model/domain.ts:466`) and `extraction` is an evaluation type; no
provider is named anywhere (G53). `FieldSpec.confidenceFloor`
(`model/domain.ts:1605`) exists and **nothing reads it** — the model half of G38 is
applied and the behaviour half is not. `SourceDocument.extracted`
(`model/domain.ts:1692`) holds one `ExtractedValue` per path with a single
`Provenance.confidence` (`model/domain.ts:1652`), and no field records **which
engine produced it**.

**Why first phase.** Band D is drawn on `Close.dc.html` as a register band, not a
second inbox — *"Unreadable dockets sit as band D, in the same list."* Every screen
in the pack downstream of arrival assumes a document has a confidence and a floor.
Nothing else in the spine can be demonstrated without it.

### Build contract

| Model type | `file:line` | Status |
|---|---|---|
| `SourceDocument` | `model/domain.ts:1681` | **live** |
| `ExtractedValue` · `ExtractedScalar` · `ExtractedLine` · `Provenance` | `1670` · `1662` · `1676` · `1652` | **live** |
| `FieldSpec` (`.confidenceFloor`, `.dataClass`, `.modelProcessingAllowed`) | `1558` · `1605` · `1567` · `1572` | **live** |
| `AcquisitionFidelity` | `1623` / `1633` | **live** |
| `acceptsNonSyntheticIngest()` | `model/domain.ts:881` | **live** |
| `resolveModel()` | `model/catalog.ts:167` | **live** — 🛑 override 1 in `v1-trim-proposal.md` §0 |
| `ModelCatalogEntry.provider: 'bedrock' \| 'other'` | `model/catalog.ts:120` | live — **close to `'bedrock' \| 'sagemaker'`** (G54, a derivation) |
| ~~`POLICY_KINDS` — 7 members~~ **8 members** | `model/policy.ts:78` | ⛔ ~~live — **`managed_service_use` does not exist and must be created** (G7, made live by G53/G69)~~ **FALSE SINCE 8 Aug 2026 — DO NOT CREATE IT.** G79 landed `managedServiceUse: 'managed_service_use'` (`policy.ts:91`), `ManagedServiceUseConfig` with all four fields (`policy.ts:327`) and the `managed_service_use` arm of the config union (`policy.ts:441`). **Following this row as written would produce a duplicate declaration.** Do not read the count here either — derive it: `awk '/^export const POLICY_KINDS = \{/,/^\}/' model/policy.ts \| grep -cE '^  [a-zA-Z]+:'` returned **8** on 8 Aug 2026, of which **6 are live** (`LivePolicyKind`, `policy.ts:602`, excludes `spend` and `content_guardrail`) |
| `ExtractionEngineBinding` | — | **does not exist, must be created** |
| `ExtractedValue.engineRef` | — | **does not exist, must be created** |

```ts
/** G69. The variant→engine binding. Textract, or a custom model in the catalogue. */
export type ExtractionEngineBinding =
  | { kind: 'textract'; features: readonly TextractFeature[] }
  /** 🛑 BRANDED, NOT A STRING. A bare string skips resolveModel() and skips
   *  invariant 7 — CLAUDE.md's "On invariant 7" block names exactly this defect. */
  | { kind: 'sagemaker'; modelCatalogEntryId: ModelCatalogEntryId }

/** Which engine read this value. Named id-shaped so the extractor can see it. */
// on ExtractedValue:  engineModelCatalogEntryId: ModelCatalogEntryId | null
```

⚠️ **`engineRef` must be named id-shaped or no tool in this repository can count
it.** `TokenUsage.model` and `PackBinding.modelOverride` went unnoticed for exactly
this reason (`CLAUDE.md`, the ⚠️ block; `docs/HANDOFF.md` §7).

**Contract operations.**

| Op | Path | Status |
|---|---|---|
| `listIntakeChannels` | `GET /intake/channels` | **reuse** — `capability.openapi.yaml:103` |
| `createUpload` | `POST /intake/uploads` | **reuse** — `:133` |
| `completeUpload` | `POST /intake/uploads/{uploadId}/complete` | **reuse** — `:214` |
| `getDocument` | `GET /documents/{documentId}` | **reuse** — `:265`. Response gains per-field floor breach flags |
| `listDocuments` | `GET /documents` — **propose** | The parked pile and the run-strip badge (`19`, `4`) have no operation. **DERIVATION** |

⚠️ **A divergence is recorded in the contract and unresolved:**
`IntakeChannelStatus.channel` is a four-member enum
(`upload · watched_drop · connector_pull · mailbox`,
`capability.openapi.yaml:2439`) and `SourceDocument.origin` is three
(`upload · connector · api`, `model/domain.ts:1684`). `DocumentTypes.dc.html` binds
SharePoint paths, an `s3://` prefix and a mailbox. **Four channels do not map onto
three origins.** **DERIVATION** — the mapping must be stated before a row is
written.

**Capabilities.** `view_document` → `tenant_data`; `trigger_run` → `configuration`
(`model/access.ts:517`). No new capability. ⚠️ **No capability names "set the
extraction model"** (G49) — it belongs with the FDE platform tier, out of scope
here, and G49 argues it should be `authority` rather than `configuration` because
delivery reaches `configuration`.

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **7 — residency survives inference** | `resolveModel()` (`model/catalog.ts:167`) — **the only executable enforcement in the codebase**, and G69 widens it to extraction. The enforcement in this slice is the **type**: `ExtractionEngineBinding.sagemaker.modelCatalogEntryId` is `ModelCatalogEntryId`, so an unresolvable engine is a compile error, not a runtime hope |
| **4 — classification declared once** | `FieldSpec.dataClass` (`model/domain.ts:1567`) and `.modelProcessingAllowed` (`:1572`). `modelProcessingAllowed: false` **must block the field's bytes reaching Textract**, not merely mask the result |
| **6 — ingested content is data, never instruction** | `validateProcedureInjectionSafety()` (`model/domain.ts:1363`) and `validateAgentToolBindings()` (`model/agents.ts:903`) — ⚠️ the second is keyed on `TOOL_KEYS.readCorrespondenceThread` and **an agent reading an extracted docket is not that landmark**. `model/domain.ts:3360-3366` records this as `HANDOFF` §5.1 exactly. **DERIVATION: the check must key on the property, not the tool** |
| **1 — tenant scope from session** | `createUpload` places the tenant prefix as the first S3 path segment (`capability.openapi.yaml:135-141`); the client never chooses the key |
| **Sandbox is synthetic-only** | `acceptsNonSyntheticIngest()` (`model/domain.ts:881`), called at presign, refusing with `non_synthetic_ingest_refused` |

### Verification

1. **Fixture:** construct a `SourceDocument` in `model/examples.ts` whose
   `extracted` map has one value under its floor and one above, against a
   `DocumentType` with a populated `fields: FieldSpec[]`. Today
   `model/examples.ts:329` is `documentTypeTemplates: []` — **nothing constructs a
   `DocumentType` anywhere in the repository**, so no field addition is currently
   witnessed by anything.
2. **The bare-model-string sweep must still return five lines and no more:**
   ```bash
   grep -rnE "\b(model|modelId|modelOverride)\s*\??:\s*string\b" model/*.ts | grep -v '^\S*:[0-9]*: *\*'
   ```
   Adding a `kind: 'sagemaker'` arm with a bare string would make it six. **That
   grep is the slice's residency gate.**
3. **The floor is read, not merely stored** — a fixture-driven assertion that a
   value at `0.61` against `confidenceFloor: 0.90` yields band D and a value at
   `0.94` does not. Expected error/behaviour is a *status*, never a 4xx.
4. **Extractor delta:** `node tools/planner/extract.mjs`, reporting **edges by kind
   and gaps by kind** against the run before the change (`CLAUDE.md`: at `571e7c26`,
   136 nodes · 242 edges · 242 resolving · 0 dangling · 151 gaps). A new engine edge
   that does not appear means the field was not named id-shaped.
5. ⚠️ **The G53/G69 verification item is still open and is not closeable by code.**
   Textract handwriting and CJK coverage in `ap-southeast-1`, against
   `Reconciliations.dc.html`'s *"warehouse dockets · handwritten … read at 94% mean
   confidence"* and `DocumentTypes.dc.html`'s Mandarin variant reading **86% mean**.
   `docs/screen-pack-ledger.md` §5.7 calls it *"checkable in an afternoon and has
   not been checked."* **Check it before R3 binds an engine.**

### Dependencies

R0 (`ExtractedScalar` has a `{ kind: 'money'; value: Money }` arm,
`model/domain.ts:1666`). R3 supplies the variant→engine binding; until it lands,
bind the engine at `DocumentType` grain and accept that the Mandarin case is
unrepresentable.

### Explicitly out of scope

The FDE console that sets a model (G49/G50 — no screen exists, §6a.1). Learning
from a correction (G39, `model/learning.ts`, unapplied). Page renders and
`page_render` retention. ~~The `managed_service_use` policy kind is **named as a
dependency here and built in the platform slice**, not this one~~ — **the
`managed_service_use` kind is BUILT, in `model/policy.ts`, under G79 on 8 Aug 2026;
neither this slice nor the platform slice owes it** — but G8's
`organizations:DescribeEffectivePolicy` grant is owed by **every v1 customer at
onboarding** and that is a contract-time item, not an engineering one.

---

## R2 — Band D: a person reads what the machine could not

### Issue

**Title:** Name the act of a human confirming an extracted field, give it a
capability, an operation, a stored record and an audit event kind.

**Problem.** `docs/screen-pack-ledger.md` §3.3 calls `Confirm.dc.html` **"the
least-supported screen in the demo tier"**: capabilities `view_document` *"and
nothing else"*, operations `getDocument` *only*. **A person changes a figure that
enters a ledger and no verb in the 36-member closed set names it**
(`model/access.ts:251`). The confirmed value has no home: name + time + **image
region** + the machine's original reading retained side by side is a shape the
model does not carry.

**Why first phase.** `Close.dc.html` draws band D as one of six bands on the front
door. `Finding.dc.html` states the payoff — *"Confirm it and the receipt posts,
closing band C as well"* — so band D is not a leaf, it feeds the match. Without
this slice the demo's most-cited sentence (*"an auditor can ask which figures in a
close were read by a person"*) is unaskable.

### Build contract

| Model type | `file:line` | Status |
|---|---|---|
| `SourceDocument` · `ExtractedValue` · `Provenance` | `1681` · `1670` · `1652` | **live** |
| `FieldSpec.confidenceFloor` | `model/domain.ts:1605` | **live** (G38, model half) |
| `AuditEvent` (`action: string`, `subjectType`/`subjectId` bare by rule) | `model/domain.ts:3744`, `:3794`, `:3805` | **live** |
| `UsageRecord` · `METERS` (8 meters) | `model/billing.ts:122` · `:75` | **live** |
| `authorize()` → `AuthorizationGrant` | `model/access.ts:1610` | **live** |
| `FieldConfirmation` | — | **does not exist, must be created** |
| `CAPABILITIES.confirmExtraction` | — | **does not exist, must be created** — a 37th capability |

```ts
export interface FieldConfirmation extends TenantScoped {
  id: FieldConfirmationId                 // new brand in kernel.ts
  sourceDocumentId: SourceDocumentId
  /** Header-grain when lineIndex is null; line-grain otherwise. */
  path: FieldPath
  lineIndex: number | null
  /** 🛑 KEPT, NEVER REPLACED. The screen's own promise, at the type. */
  machineReading: ExtractedValue
  confirmed: ExtractedScalar
  /** "The region you pick is stored with the answer." Not derived at read time. */
  region: Provenance
  confirmedByUserId: UserId
  confirmedAt: Timestamp
  /** INVARIANT 10. Non-nullable — a confirmation is never a `system` act. */
  authorizationId: AuthorizationGrantId
}
```

**Contract operations** — all new, all in `capability.openapi.yaml`.

| Method + path | operationId | Notes |
|---|---|---|
| `POST /documents/{documentId}/confirmations` | `confirmExtractedField` | Body: `path`, `lineIndex`, `confirmed`, `region`. **No `tenantId`** |
| `GET /documents/{documentId}` | `getDocument` — **reuse**, `:265` | Response gains `confirmations[]` so machine + human read arrive together. **Do not add a second read op** (G55) |
| `POST /documents/{documentId}/assignment` | `assignDocument` | *"Pass it on … It leaves your pile by name"* |
| `POST /documents/{documentId}/rejection` | `rejectDocument` | *"illegible or wrong document type. The run records why"* — reuse `sanitisation_rejected`? **No**: propose a distinct code, that one is F12's structural verdict |

**Capabilities.**

| Capability | Resource class | Status |
|---|---|---|
| `view_document` | `tenant_data` | existing (`model/access.ts:517`) |
| **`confirm_extraction`** | **`tenant_data`** | **mint — a platform release.** Covers confirm, pass-on and reject: all three are the same seat answering *"the machine could not read this"* |

⚠️ **Minting a capability adds a key to `CAPABILITY_RESOURCE_CLASS`
(`model/access.ts:517`), which is `Record<Capability, AccessResourceClass>` — an
unclassified capability is a compile error.** That is the one place in this slice
where the compiler helps.

**DECISION, and it is the sharp one:** one capability for all three acts, or three.
Recommend **one**, under G55 (*fewer knobs*) and because splitting produces two
capabilities nothing distinguishes at the resource-class level. The counter-argument
is real: *reject* destroys a document's path into the close and *confirm* does not.
Record the choice; do not let it be inferred.

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **10 — an act with no authorisation is unrecordable** | `FieldConfirmation.authorizationId: AuthorizationGrantId` **non-nullable**, minted only by `authorize()` (`model/access.ts:1610`). Precedent and reason are `EndpointReading.authorizationId` (`model/domain.ts:3414`) and `OperatorProposalDecision.authorizationId` (`:3646`), both non-nullable for the same argument: `AUTHORIZATION_MAY_BE_ABSENT` admits only `system` |
| **5 — money is derived; `UsageRecord` is immutable and unpriced** | *"Confirming spends nothing"* is enforced as an **absence**: no member of `METERS` (`model/billing.ts:75`) names confirmation, so no row can be minted. **DERIVATION** — and the grep in Verification is the enforcement |
| **4 — classification declared once** | The confirmed scalar is redacted on read under the same `FieldSpec.dataClass` as the machine value; `getDocument`'s `redactedPaths` (`capability.openapi.yaml:2543`) already carries the mechanism |
| **A confirmed value never becomes training** | `model/learning.ts` requires a **nominated** promotion (G5) and a learning record has no free-text field. Enforcement is that **no write path from `FieldConfirmation` into `learning.ts` exists**, and none may be added in this slice |

⚠️ **`AuditEvent.action` is a bare `string` (`model/domain.ts:3794`).** The screen
promises *"a human-confirmed field is a distinct event type."* A bare string cannot
make it distinct. **DERIVATION** once the capability is minted: the audit action
vocabulary needs to become a closed set, or the auditor's question is answered by a
`LIKE` query.

### Verification

1. **Fixture:** construct a `FieldConfirmation` in `model/examples.ts` whose
   `machineReading.scalar` is `{ kind: 'money', value: … }` at `confidence: 0.61`
   and whose `confirmed` differs. **`tsc` fails if `machineReading` is dropped from
   the shape** — that is the "kept, not replaced" promise made mechanical.
2. **Capability totality:** adding `confirm_extraction` to `CAPABILITIES` without
   adding it to `CAPABILITY_RESOURCE_CLASS` **must** fail the typecheck. Verify by
   doing it, reading the error, and reverting — the discipline `model/identity.ts`
   uses for its assertions ("verified RED, reverted").
3. **"Confirming spends nothing", as an absence:**
   ```bash
   awk '/^export const METERS = \{/,/^\} as const/' model/billing.ts | grep -ci confirm   # expect 0
   grep -rn 'confirmExtractedField' docs/contracts/*.yaml | grep -i 'usage\|meter'        # expect 0
   ```
4. **No `tenantId` in any new body:**
   ```bash
   grep -n -A25 'operationId: confirmExtractedField' docs/contracts/capability.openapi.yaml | grep -c tenantId   # expect 0
   ```
5. **Runtime:** confirming a field on a `purged` document returns
   `resource_not_found`; confirming without the capability returns `policy_denied`
   — both already in `docs/contracts/errors.yaml`.

### Dependencies

R1 (a document must have a scored field before anyone confirms one). R0 for the
money-valued case.

### Explicitly out of scope

**Alternative candidate values.** `Confirm.dc.html` draws three clickable candidate
chips (`140,250.00` sum-of-page, `146,250.00` second read, `140,250.00` from PO
4500219). `ExtractedValue` holds **one** scalar (`model/domain.ts:1670`). Whether
candidates are persisted or recomputed on open is a **DECISION** and it is not
taken. Building the drawer without them is possible; drawing them is not.

The per-value token cost (`340 tok`) rendered in the drawer — `view_metering` is
`metering`-class and **nothing calls it** (`docs/screen-pack-ledger.md` §6).

---

## R3 — Document types finance owns: versions, variants, engines

### Issue

**Title:** Give `DocumentType` a version, an owner, language variants bound to
arrival locations, per-variant confidence reporting, and a per-variant engine
binding.

**Problem.** `DocumentType` (`model/domain.ts:1636`) is
`id · key · label · domain · fields · expectedFidelity`. **It has no variant list,
no per-variant arrival binding, no per-variant confidence — and no version and no
owner at all**, while `DocumentTypes.dc.html` renders *"v2 · in force since 12 Feb ·
owner A. Cruz · 4 language variants · 63 read today"* and a **Save as v3** button.
`docs/screen-pack-ledger.md` §3.3 records the variant gap; **the missing version is
not recorded anywhere and is the larger of the two.**

**Why first phase.** G69 needs somewhere to put the Textract-versus-SageMaker
binding, and the screen's central argument — *"a type-level average of 92% would
look healthy while one warehouse quietly fails"* — is unrepresentable without it.

### Build contract

| Model type | `file:line` | Status |
|---|---|---|
| `DocumentType` | `model/domain.ts:1636` | **live** — gains `version`, `status`, `ownerUserId`, `variants` |
| `FieldSpec` | `model/domain.ts:1558` | **live** — unchanged. Floors stay **per field, shared across variants**, which is what the screen states |
| `DocumentTypeTemplate` | `model/domain.ts:2243` | **live** — `Omit<DocumentType,'id'|'tenantId'>`, so it inherits every addition |
| `DocumentTypeVariant` | — | **does not exist, must be created** |
| `DocumentTypeVersion` | — | **does not exist, must be created** (see R4 — same shape of problem, same answer) |

```ts
export interface DocumentTypeVariant {
  /** BCP-47 subtag: 'en' | 'id' | 'zh' | 'fr'. */
  key: string
  label: string
  /** "The source decides the variant." Language is DECLARED by arrival location,
   *  never detected from content — the screen's own rule. */
  arrivalEndpointId: EndpointId
  /** Match rule against the arrival location, e.g. 'GR-*.pdf'. */
  filenamePattern: string
  /** The ONLY column a variant may change is the printed label per field. */
  labels: Record<FieldPath, string>
  /** G69 — Textract, or a custom model that MUST resolve through resolveModel(). */
  engine: ExtractionEngineBinding
}
```

**Contract operations** — `administration.openapi.yaml`, **which does not exist and
must be created**. Gap #1 in `docs/screen-pack-ledger.md` §4.

| Method + path | operationId |
|---|---|
| `GET /admin/document-types` | `listDocumentTypes` |
| `POST /admin/document-types` | `createDocumentType` |
| `PUT /admin/document-types/{documentTypeId}` | `saveDocumentTypeVersion` — **produces v3; v2 stays resolvable** |
| `GET /admin/document-types/{documentTypeId}/versions` | `listDocumentTypeVersions` |
| `POST /admin/document-types/{documentTypeId}/dry-run` | `dryRunDocumentType` — *"Test on last month"* |

**Capabilities.** `author_definition` → `configuration` (`model/access.ts:517`).

🛑 **The G22/G38 constraint, and it is this slice's sharpest rule.**
`FieldSpec.confidenceFloor` is FDE-set and customer-**read-only**, and
`model/domain.ts:1596-1600` states the enforcement in terms this slice must honour
verbatim: *"There is no `editableByTenant` flag … The enforcement is that **no v1
write operation accepts this field**."* `DocumentTypes.dc.html` draws the Floor
column as an editable customer surface. **`docs/screen-pack-ledger.md` §5.1 calls
this the sharpest screen-versus-decision conflict in the pack and it is not
resolved.** The build contract here is: **`saveDocumentTypeVersion`'s request body
must not contain `confidenceFloor`**, and the screen must render it read-only.
**DECISION** — the alternative is reopening G22, which is the owner's call, not
this document's.

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **7 — residency survives inference** | `DocumentTypeVariant.engine.sagemaker.modelCatalogEntryId` is `ModelCatalogEntryId`, so `resolveModel()` (`model/catalog.ts:167`) is on the path. A bare string here is the exact defect `CLAUDE.md`'s invariant-7 block catalogues |
| **4 — classification declared once, on `FieldSpec`** | `DocumentTypeVariant.labels` may change **only the printed label**. It carries no `dataClass`, no `confidenceFloor`, no `dataType` — the type is the enforcement |
| **8 — being staff is not access** | Authoring is `configuration`, which `PERMITTED_RESOURCES.delivery` reaches (`model/governance.ts:397`). ⚠️ **That is G26's hole restated:** a 90-day delivery grant can change a document type. Recorded, not solved here |
| **1** | `DocumentType extends TenantScoped`; no `tenantId` in any admin request body |

### Verification

1. **Fixture, and it does not exist today:** `model/examples.ts:329` is
   `documentTypeTemplates: []`. Populate it with the goods-receipt docket **and its
   four variants** (`en`, `id`, `zh`, `fr`) against the seven fields the screen
   draws with floors `95/95/90/92/90/85/60`. Until that fixture exists, adding a
   field to `DocumentType` **cannot fail any check in this repository**.
2. **The floor is not writable:**
   ```bash
   # once administration.openapi.yaml exists
   grep -n -A60 'operationId: saveDocumentTypeVersion' docs/contracts/administration.openapi.yaml \
     | grep -c confidenceFloor      # expect 0
   ```
   This grep **is** G38's enforcement. There is no other.
3. **A key in use cannot be removed** — the screen's stated refusal. Runtime
   assertion: removing `qty_received` while `Three-way match` binds it returns
   `validation_failed` with a `detail` naming the binding. Reuses an existing code;
   no new one needed.
4. **Per-variant confidence is computable:** an assertion over the fixture that mean
   confidence for `zh` is reportable **separately** and differs from the type mean —
   the screen's `86%` versus `92%` argument, made checkable.
5. **Extractor:** the new `arrivalEndpointId` and `modelCatalogEntryId` fields must
   appear as **resolving edges**. If either does not, the field is not id-shaped.

### Dependencies

R1 (extraction must exist before a variant can bind an engine). Blocks R1's
Mandarin case. Needs `administration.openapi.yaml` created — shared with R4, and it
should be created **once**, in whichever slice lands first.

### Explicitly out of scope

Sources and connections themselves — **G59 puts them with the FDE**, off the
customer surface, and `docs/screen-pack-ledger.md` §6a.1 records that **no screen in
the pack is a platform surface**. This slice *binds* an existing `Endpoint`
(`model/domain.ts:595`); it does not create one, and it never touches
`credentialRef` (`:622`, `bind_secret`, `secret` class — ~~G60's open implementation
shape~~ **CLOSED 8 Aug 2026 by G75, in the broader direction**: `secret` is in
`PERMITTED_RESOURCES.delivery` (`model/governance.ts:474`) and out of
`NON_DELEGABLE_RESOURCES`, which now reads `['statutory']` (`:544`). It is **not**
in `CONTRACT_ONLY_RESOURCES` — that was the recommended shape and it was overruled.
**The scope boundary is unaffected**; only the reason it was open has gone).

---

## R4 — Reconciliation definitions finance authors: Tier 2 Save, and a version you can resolve

### Issue

**Title:** Finance authors reconciliation definitions in full (G58) — and the
version a run pins must resolve to a stored configuration.

**Problem, and it is bigger than "no Save button".** `ReconciliationRun
.definitionVersion` (`model/domain.ts:2518`) and `Exception.definitionVersion`
(`:2757`) pin *"the definition as it stood"*. `Exception.ruleVersion` (`:2755`) pins
a rule version. **Nothing stores what v4 was.** `ReconciliationDefinition`
(`model/domain.ts:1985`) is a single mutable row carrying `version: number`
(`:1999`); `MatchRule[]` lives inside `ArchetypeConfig` (`:1950`) inside that row.
Saving v5 overwrites v4.

> `docs/screen-pack-ledger.md` §3.4 calls the versioning *"the cleanest
> model-to-screen agreement in the pack"* because `definitionVersion` exists. **The
> pin exists and its referent does not.** That is `docs/HANDOFF.md` §5.1 — a rule
> keyed on a convenient landmark instead of the property it protects.

`Reconciliations.dc.html`'s central promise — *"Saving produces v5 and the runs that
used v4 keep pointing at v4, so a finding from February can still be explained by
the rules in force when it was raised"* — is **false today** and the screen makes it
the reason the product is trustworthy.

**Why first phase.** G58 is recorded as *"the largest single deliverable in v1"* and
`docs/HANDOFF.md` §3a says Tier 2 read-only *"cannot ship"* under G48. Nothing
downstream is explicable without it.

### Build contract

| Model type | `file:line` | Status |
|---|---|---|
| `ReconciliationDefinition` | `model/domain.ts:1985` | **live** — gains `ownerUserId`, `amendedAt`, `amendedByUserId` |
| `ArchetypeConfig` (4 v1 arms + `set_reconciliation` residue) | `model/domain.ts:1950` | **live** |
| `RECONCILIATION_ARCHETYPES` · `V1_ARCHETYPES` | `:1801` · `:1817` | **live** — all four stay (G63) |
| `MatchRule` · `Tolerance` · `MatchKey` · `LineMatchKey` | `:1751` · `:1741` · `:1727` · `:1736` | **live** |
| `PopulationSpec` · `PairingSpec` · `PairingStrategy` | `:1906` · `:1934` · `:1927` | **live** |
| `Disposition` · `DISPOSITION_FAMILIES` | `:1885` · `:1833` | **live** |
| `RUN_TRIGGER_KINDS` (3: `scheduled`/`ingest`/`source_signal`) | `:2558` | **live** |
| `Procedure` | `:3024` | **live** |
| `FxPolicy` on `.fx` | `:1994` → `:394` | ⚠️ **the field is live and its type is `@dropped-for-v1`** — under G61 it stays null in v1 |
| `DefinitionVersion` | — | **does not exist, must be created** |

```ts
/** The immutable referent of ReconciliationRun.definitionVersion. */
export interface DefinitionVersion extends TenantScoped {
  id: DefinitionVersionId               // new brand in kernel.ts
  definitionId: DefinitionId
  version: number
  /** The whole authored shape, frozen. Rules live inside it, so ruleVersion resolves too. */
  config: ArchetypeConfig
  enabledTriggers: RunTriggerKind[]
  tags: Tags
  /** A judgement with an owner — the screen's "amended 21 Feb by A. Cruz". */
  savedByUserId: UserId
  savedAt: Timestamp
  status: 'active' | 'superseded'
}
```

**Contract operations** — `administration.openapi.yaml`, **does not exist, must be
created**.

| Method + path | operationId | Notes |
|---|---|---|
| `GET /admin/definitions` | `listDefinitions` | |
| `POST /admin/definitions` | `createDefinition` | |
| `PUT /admin/definitions/{definitionId}` | `saveDefinitionVersion` | **Mints v5. v4 becomes `superseded` and stays readable** |
| `GET /admin/definitions/{definitionId}/versions` | `listDefinitionVersions` | |
| `GET /admin/definitions/{definitionId}/versions/{version}` | `getDefinitionVersion` | **The op that makes February explicable** |
| `POST /admin/definitions/{definitionId}/dry-run` | `dryRunDefinition` | *"Test on February"* — runs the draft against a closed period, writes nothing |
| `POST /admin/fx-rates` | `saveFxRate` | R0's `FxRate`, per period, versioned |

**Capabilities.** `author_definition` · `author_rule` · `configure_tolerance` — all
`configuration`; `trigger_run` — `configuration`; `author_procedure` —
`configuration` (`model/access.ts:517`). **No new capability.**

⚠️ **`dryRunDefinition` writes nothing but reads a closed period's tenant data.**
It must be gated by `view_exception`/`view_document` (`tenant_data`) **in addition
to** `author_definition`, or an author with configuration-only authority reads
business data through a preview. **DERIVATION.**

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **A pack parameterises, never extends** (pass B; not numbered but load-bearing) | `ArchetypeConfig` is a closed discriminated union (`model/domain.ts:1950`) and `DISPOSITION_FAMILIES` (`:1833`) belong to the archetype. **A save operation that accepts a new `kind` is a platform release, not a save.** The union is the enforcement |
| **1 — tenant scope from session** | `DefinitionVersion extends TenantScoped`; no `tenantId` in any body |
| **8 — being staff is not access** | `author_definition` is `configuration` and delivery reaches it. Same G26 hole as R3; recorded |
| **10** | Every save mints an `AuditEvent` (`model/domain.ts:3744`) with `before`/`after` — the fields exist (`:3806`) and nothing populates them today |
| **5 / §5.7's refusal** | `ReconciliationDefinition.fx` stays `null` in v1 (G61). Tolerances of `{ kind: 'money' }` (`:1746`) compare within one currency only |

### Verification

1. **Fixture:** `model/examples.ts:48` already constructs `financeThreeWay:
   ReconciliationDefinition`. Add a `DefinitionVersion` fixture that freezes it as
   v4 and a second as v5 with a changed tolerance, so **`tsc` proves the two are
   independently addressable.**
2. **The explicability assertion — this is the slice's "done":**
   > Given an `Exception` with `definitionVersion: 4`, `getDefinitionVersion(defId,
   > 4)` returns the tolerance **that was in force**, after v5 has been saved.

   Runnable as a fixture-level assertion before any HTTP exists.
3. **No orphan pin:**
   ```bash
   grep -rn 'definitionVersion\|ruleVersion' model/*.ts
   # every occurrence must have a resolving edge in the extractor output
   node tools/planner/extract.mjs   # report edges/gaps BY KIND against the prior run
   ```
4. **Archetype closure:**
   ```bash
   grep -n -A80 'operationId: saveDefinitionVersion' docs/contracts/administration.openapi.yaml \
     | grep -A5 'archetype' | grep -c 'enum'   # expect >=1 — the wire enum must be closed too
   ```
5. **Runtime:** saving a definition whose `archetype` and `config.kind` disagree
   returns `validation_failed`; running a `draft` returns `definition_not_active`
   (both already in `errors.yaml`).

### Dependencies

R0 (tolerances and ceilings carry `Money`). Shares
`administration.openapi.yaml` with R3.

### Explicitly out of scope

The visual builder (G2, unapplied). `amendProcedure` and the SOP-amendment flow
(G39, unapplied, `docs/screen-pack-ledger.md` §4 gap 14) — the pack calls it *"the
sharpest interaction"* and it keeps ~18 `learning.ts` exports alive, 33 of which
carry drop markers. `balance_rollforward` — modelled, not built (pass B, G63).

---

## R5 — The run: trigger, admission, and the fifth cell that is not a status

### Issue

**Title:** Wire the run strip — trigger, idempotent admission, and the
*waiting-on-an-arrival* cell, **without widening a closed union**.

**Problem.** `ReconciliationRun.status` is `queued | running | completed | failed`
(`model/domain.ts:2531`) and the run strip draws a fifth cell state —
`waiting on email · on arrival`. `docs/screen-pack-ledger.md` §4 gap 10 records it
as a **derivation** and §3.3 as *"not representable"*.

🟢 **It does not need a fifth status, and this is the slice's main finding.**
`DocumentTypes.dc.html` states the opposite rule explicitly: *"The reconciliation
runs anyway and reports the missing leg as a band, rather than waiting quietly for
the file … A missing leg is reported, never waited for."* A run therefore **never**
waits. The strip cell that says *"waiting on email"* is a **definition** whose
`enabledTriggers` contains `ingest` (`model/domain.ts:2561`) and for which **no run
exists in the open period**. That is a property of the *board*, derivable from
`ReconciliationDefinition.enabledTriggers` + the absence of a `ReconciliationRun`
row — **not a member of a closed union whose widening is a platform release**.
**DERIVATION**, and it resolves gap 10 without a model change.

⚠️ **The two screens disagree and the disagreement should be recorded rather than
absorbed:** `Close.dc.html` draws *waiting* as a run-strip state;
`DocumentTypes.dc.html` forbids waiting. Under the reading above both are true. If
the owner intends a run that genuinely blocks on an arrival, that is a **DECISION**
and it widens `ReconciliationRun.status`.

**Why first phase.** *"A scheduled run that finds nothing still reports in, so
silence never means the job failed"* is the screen's stated reason the product is
trustworthy, and `docs/screen-pack-ledger.md` §3.3 records that **nothing
distinguishes did-not-run from ran-and-found-nothing.**

### Build contract

| Model type | `file:line` | Status |
|---|---|---|
| `ReconciliationRun` | `model/domain.ts:2514` | **live** — status union **unchanged** |
| `RunTrigger` (5 arms incl. `manual`/`rerun`) · `RUN_TRIGGER_KINDS` (3) | `:2570` · `:2558` | **live** |
| `ReconciliationPeriod` | `:2501` | **live** |
| `MatchGroup` (`outcome: matched \| exception \| unmatched`) | `:2579` | **live** |
| `Exception` | `:2750` | **live** |
| `TokenUsage` on `.tokenUsage` | `:2535` | **live** — the `418K` meter |
| A board projection | — | **does not exist** — derived, **not stored**. No new type |

**Contract operations.**

| Op | Path | Status |
|---|---|---|
| `listRuns` | `GET /runs` | **reuse** — `capability.openapi.yaml:299` |
| `admitRun` | `POST /runs` | **reuse** — `:332`. Admission must be **idempotent on (period, definition, slot-fill state)** — `model/domain.ts:2544` states the rule; nothing enforces it |
| `getRun` | `GET /runs/{runId}` | **reuse** — `:413` |
| `rerunRun` | `POST /runs/{runId}/rerun` | **reuse** — `:428` |
| `listExceptions` · `getExceptionFacets` | `GET /exceptions`, `/exceptions/facets` | **reuse** — `:477` · `:625` |
| `getRunBoard` | `GET /runs/board` — **propose** | One cell per definition: latest run, its status **or** `awaiting_arrival` derived, exception count, parked-document count. **DERIVATION** |

**Capabilities.** `trigger_run` → `configuration`; `view_exception`,
`view_document` → `tenant_data` (`model/access.ts:517`). No new capability.

⚠️ **`trigger_run` is `configuration` and the run's output is `tenant_data`** —
the join comment at `model/access.ts` says so explicitly. A board that returns
exception **counts** is therefore a `tenant_data` read and must be gated as one, not
as `trigger_run`. **DERIVATION.**

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **1 — tenant scope from session** | `ReconciliationRun extends TenantScoped`; `tenantId` in no request body (`docs/contracts/README.md:34`) |
| **4** | Band composition reads `Exception.severity`/`severityRank` (`model/domain.ts:2767`,`:2778`), never re-derives classification |
| **10** | `AuditEvent.authorizationId` may be null for a `{ kind: 'system' }` actor (`model/domain.ts:3784-3792`) — a scheduler tick is exactly that shape, and `authorizationIsWellFormed()` in `governance.ts` is the executable rule |
| **6** | An `ingest`-triggered run is started by a document arriving. The document's **content** must not select the definition — the arrival **location** does (R3's rule). Enforced by `DocumentTypeVariant.arrivalEndpointId`, not by a parser |

### Verification

1. **Fixture:** three `ReconciliationRun` values — `completed` with zero exceptions,
   `failed`, and a definition with `enabledTriggers: ['ingest']` and **no run**.
   The board projection over those three must produce `clean`, `failed` and
   `awaiting_arrival` **without any change to `ReconciliationRun.status`**. That
   compile-plus-assert pair is the slice's "done".
2. **The union stayed closed:**
   ```bash
   grep -n -A6 "status: 'queued' | 'running'" model/domain.ts   # expect exactly 4 members
   ```
3. **Admission idempotency:** two `admitRun` calls with the same
   `Idempotency-Key` and the same (period, definition, slot-fill) produce **one**
   `RunId`. Second call returns the first run, not `idempotency_conflict` — that
   code means a *different* body under the same key.
4. **Runtime:** admitting against a definition whose enabled triggers exclude the
   requested one returns `trigger_not_enabled`; a run over a closed period returns
   `period_closed`; incomplete slots return `slot_fill_incomplete`. All three exist
   in `errors.yaml`.
5. **Extractor delta** on `periodId`/`definitionId` edges — a board that joins them
   must not introduce a dangling edge.

### Dependencies

R1 (documents), R4 (a resolvable definition version). R2 drains into it — the
parked badge counts down and *"the run reports as if extraction had been clean."*

### Explicitly out of scope

The four-minute undo (R6). Scheduling as a first-class object — `schedule` is one of
the **four resource classes with no capability**, and `docs/access-and-agency.md`
§11.9a leaves it open **deliberately**, because an armed schedule must pin a scope
where every other capability resolves one. Do not mint a scheduling capability in
this slice.

---

## R6 — Exception to posting: proposal, approval, write-back, four minutes

### Issue

**Title:** Close the loop from a banded exception to six journal lines in SAP, a
document number, and a reversal window.

**Problem.** The read half is the best-covered area in the repository — nine
operations on `Close.dc.html` alone. **The write half does not exist.**
`executeProposal` (`capability.openapi.yaml:1668`) *"executes an approved proposal
and closes the exception"*; **nothing writes back to a foreign ledger, returns a
document number, or records the write** (`docs/screen-pack-ledger.md` §3.3).
`ExceptionResolution` (`model/domain.ts:2669`) has three modes and none carries a
foreign document reference. `Finding.dc.html` draws *"Six lines written to SAP.
Document 51004902. Written at 09:12:04"* and a live **3:41** countdown labelled
*"Reversible without a credit note."* **No field time-boxes an undo**
(`docs/screen-pack-ledger.md` §4 gap 11).

**Why first phase.** This is the product's stated outcome. G56 names three
outcomes — post to the ERP, pay invoices, submit for compliance — and G64 puts the
third in v1+1. Posting is the one that must work.

### Build contract

| Model type | `file:line` | Status |
|---|---|---|
| `Exception` · `ExceptionStatus` (7 members) | `model/domain.ts:2750` · `:489` | **live** |
| `ExceptionResolution` (3 modes) | `:2669` | **live** |
| `ExceptionReversal` · `ReversalReason` · `reversalIndictsAutonomy()` | `:2738` · `:2714` · `:2734` | **live** |
| `ResolutionProposal` · `ProposalActor` · `ProposalEvidence` | `:3225` · `:3185` · `:3218` | **live** |
| `ApprovalDecision` (`.requestedAt`, `.decidedAt`) | `:3250`, `:3279` | **live** |
| `Disposition` (`.reversibility`, `.terminal`, `.requiresAdjustment`) | `:1885` | **live** |
| `Procedure` · `ProcedureStepExecution` | `:3024` · `:3105` | **live** |
| `Endpoint` (`.writebackEnabled`, `.credentialRef`) | `:595`, `:636`, `:622` | **live** |
| `LedgerPosting` | — | **does not exist, must be created** |
| `Disposition.reversalWindowSeconds` | — | **does not exist, must be created** |

```ts
/** The write into the customer's ledger, and the only record it happened. */
export interface LedgerPosting extends TenantScoped {
  id: LedgerPostingId                   // new brand in kernel.ts
  /** Exactly one of these two is set — the two proposal paths G44 keeps apart. */
  proposalId: ProposalId | null
  operatorProposalId: OperatorProposalId | null
  endpointId: EndpointId
  /** What the foreign system called it. "51004902". Rendered, never parsed. */
  foreignDocumentRef: string
  lineCount: number
  value: Money
  writtenAt: Timestamp
  /** The four minutes, resolved from Disposition.reversalWindowSeconds AT WRITE TIME. */
  reversibleUntil: Timestamp | null
  /** INVARIANT 10. Non-nullable — posting is never a `system` act. */
  authorizationId: AuthorizationGrantId
}
```

⚠️ **`reversibleUntil` must be stamped at write time, not computed at read time.**
Same discipline as `SourceDocument.purgeAfter` (`model/domain.ts:1702`) and
`Exception.costCentre` (`:2805`): a policy edit must not silently extend or shorten
a window somebody already relied on.

**Contract operations.**

| Op | Path | Status |
|---|---|---|
| `getException` · `assignException` · `listAvailableDispositions` | `:671` · `:739` · `:1380` | **reuse** |
| `listProposals` · `proposeResolution` · `getProposal` | `:1446` · `:1477` · `:1570` | **reuse** |
| `decideApproval` | `POST /proposals/{proposalId}/approvals` `:1589` | **reuse** |
| `executeProposal` | `POST /proposals/{proposalId}/execution` `:1668` | **reuse, widen** — `ExecutionResult` gains the `LedgerPosting` |
| `getProcedureState` · `advanceProcedureStep` | `:842` · `:893` | **reuse** |
| `reverseResolution` | `POST /exceptions/{exceptionId}/reversals` `:773` | **reuse, widen** — it compensates the posting. 🛑 **ONE reversal path, not two** (G55). Recommended; the alternative — a separate `reversePosting` — creates two vocabularies for one concept, `docs/HANDOFF.md` §5.3 |
| `getPosting` | `GET /postings/{postingId}` — **propose** | The countdown needs a server-authoritative `reversibleUntil` |

**Capabilities.** `propose_resolution` · `approve_resolution` · `execute_resolution`
· `close_exception` · `reverse_resolution` · `view_document` — all `tenant_data`;
`enable_endpoint_writeback` → **`authority`** (`model/access.ts:517`), and it is a
**configuration-time** act (turning an ERP from readable into writable), never the
act of posting. No new capability.

### Invariant obligations

| Invariant | Enforced by | State |
|---|---|---|
| **10 — an act with no authorisation is unrecordable** | `LedgerPosting.authorizationId` non-nullable; minted only by `authorize()` (`model/access.ts:1610`) | to build |
| **11 — a container is never granted** | Posting reaches `Endpoint.credentialRef` (`model/domain.ts:622`). `SOLUTION_IS_GRANTABLE = false` and `AGENTS_HOLD_ROLES = false` (`model/access.ts`) hold; the per-step grant is `DerivedAgentGrant` (`model/agents.ts:1300`) via `mintAgentGrant()` (`:1345`) | live |
| **6 — ingested content is data, never instruction** | `validateProcedureInjectionSafety()` (`model/domain.ts:1363`) at pack signing; `validateAgentToolBindings()` (`model/agents.ts:903`) refuses `egress` beside untrusted reads | ⚠️ **one enforcement running instead of two** — neither validator has a call site, `docs/HANDOFF.md` §8 item 8 |
| **9 — only outcome-level scorers roll back** | `canTriggerRollback()` (`model/evaluation.ts:183`), `rollbackTriggerForFailedProbe()` (`:566`) | **declared and unexercised in v1** — `RollbackTrigger` is `@dropped-for-v1` (`model/domain.ts:2088`). Say so; do not claim it |
| **5 — money is derived** | `ExceptionResolution` carries no price; `UsageRecord` (`model/billing.ts:122`) is unpriced | live |
| **Segregation of duties** | `ApprovalConfig.segregationOfDuties` tests `approver !== proposer` and is **trivially true against `ProposalActor.agent`** (`model/domain.ts:3185`) | 🛑 **VACUOUS.** `docs/screen-pack-ledger.md` §5.6: *"The product's most-referenced control is, against the actor the product is built around, an assertion of nothing."* `Finding.dc.html` makes the preparer/reviewer strip the rule **every greyed control elsewhere refers back to**. **DECISION, unresolved, and this slice ships the control it indicts** |

🛑 **`AssignmentScope.valueCeiling` has no checker.** `model/domain.ts:3471` says it
is *"intersected by `narrowestScope()` and checked by `scopeContains()`"*.
`narrowestScope()` exists (`model/access.ts:1344`). **`scopeContains()` does not
exist anywhere in the repository** — `grep -rn 'scopeContains' model/ docs/` returns
exactly one hit, the comment that names it. **The value ceiling is intersected and
never compared against anything.** DERIVATION, and it must be closed in this slice
or the money threshold the screens draw is decorative.

### Verification

1. **Fixture:** an `Exception` → `ResolutionProposal` → `ApprovalDecision` →
   `ExceptionResolution{mode:'approved'}` → `LedgerPosting` chain in
   `model/examples.ts`, using `financeThreeWay` (`:48`) and the `price_error`
   disposition already declared at `model/examples.ts:335`
   (`requiresAdjustment: true`, `reversibility: 'reversible_with_cost'`). `tsc`
   then proves `adjustment: Money | null` (`model/domain.ts:3239`) is populated
   where the disposition demands it.
2. **The ceiling check exists and is called:**
   ```bash
   grep -rn 'export function scopeContains' model/access.ts   # expect 1 — currently 0
   grep -rn 'scopeContains(' model/ | grep -v 'export function' | wc -l   # expect >=1 call site
   ```
3. **One reversal path:**
   ```bash
   grep -c 'operationId: reverse' docs/contracts/capability.openapi.yaml   # expect 1
   ```
4. **The window is stamped, not computed:** an assertion that changing
   `Disposition.reversalWindowSeconds` after a posting does **not** move that
   posting's `reversibleUntil`.
5. **Runtime, against `errors.yaml`:** executing below quorum →
   `proposal_not_executable`; a second execute → `exception_already_resolved`;
   posting to an endpoint with `writebackEnabled: false` →
   `outbound_endpoint_unverified` **or a new code — DECISION**, because the existing
   one names verification, not write-back authority.

### Dependencies

R0 (`Money` everywhere), R4 (a resolvable definition version so a February finding
is explicable), R5 (runs raise exceptions).

### Explicitly out of scope

`close_period` — no operation, `docs/screen-pack-ledger.md` §4 gap 8; it belongs
with Reports. The Prepared / Reviewed / Acknowledged chain (Reports; explicitly
**not** an approval). `amendProcedure` / G39. Compliance submission — **G64, v1+1,
named so the posting path does not exclude it**: the likely shape is a filtered,
signed export reusing `createExport` (`capability.openapi.yaml:1733`), so do not
model posting in a way that forecloses it.

---

## R7 — The operator's question: `OperatorProposal` reaches the wire

### Issue

**Title:** Give G42–G44 a contract surface — mint an operator proposal from a
question, record the live readings, decide it, and make the split visible.

**Problem.** `OperatorProposal` (`model/domain.ts:3517`), `OperatorProposalDecision`
(`:3628`), `EndpointReading` (`:3368`) and `ProposedTransaction` (`:3432`) are all
**live**, landed 7 Aug, with three compile-time enforcements and a brand each — and
**zero contract operations**. `docs/screen-pack-ledger.md` §4 ranks it gap 2 and
§3.3 calls it *"the largest applied-but-unreachable area in the repository."*

**Why first phase.** The model work is done. This is the cheapest large win
available, and `PostingCheck.dc.html` is a demo-tier screen with **no operations at
all**.

### Build contract

| Model type | `file:line` | Status |
|---|---|---|
| `OperatorProposal` (`askedByUserId`, `question`, `readingIds`, `action`, `costCentre`, `legalEntity`) | `model/domain.ts:3517`, `:3533`, `:3550`, `:3566`, `:3576`, `:3603` | **live** |
| `ProposedTransaction` (`endpointId`, `actionKey`, `summary`, `value`) | `:3432`, `:3439`, `:3457`, `:3462` | **live** |
| `EndpointReading` (`tool: typeof TOOL_KEYS.endpointRead`, `authorizationId`) | `:3368`, `:3392`, `:3414` | **live** |
| `OperatorProposalDecision` | `:3628` | **live** |
| `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false` | `:3678` | **live** — literal `false`, so flipping it is a reviewed diff |
| `_OperatorProposalIsNotExceptionAnchored` | `:3736` | **live** — mapped, not conditional; verified RED twice |
| `Endpoint` | `:595` | **live** |
| `askCorrelationId` on `OperatorProposal` | — | **does not exist, must be created** — G43's recommended mitigation, *"not taken and blocked by nothing"* |
| `LedgerPosting.operatorProposalId` | — | R6's new type, already shaped for it |

**Contract operations** — all new, `capability.openapi.yaml`.

| Method + path | operationId | Notes |
|---|---|---|
| `POST /operator-proposals` | `askOperatorProposal` | Body: `question`, `endpointId`, context. Returns **n proposals** sharing one `askCorrelationId` |
| `GET /operator-proposals` | `listOperatorProposals` | |
| `GET /operator-proposals/{operatorProposalId}` | `getOperatorProposal` | Inlines the `EndpointReading`s the card renders — *"read from SAP · 4s ago"* |
| `POST /operator-proposals/{operatorProposalId}/decision` | `decideOperatorProposal` | `accepted \| rejected` + reason |
| `POST /operator-proposals/{operatorProposalId}/execution` | `executeOperatorProposal` | Mints the `LedgerPosting`. **Requires an accepted decision** — `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false` |
| `GET /endpoint-readings/{endpointReadingId}` | `getEndpointReading` | Each reading is an **act** with its own `authorizationId`, so it is addressable |

**Capabilities.**

| Capability | Class | Status |
|---|---|---|
| `view_document` | `tenant_data` | existing — **and already forced**: `TOOL_CAPABILITY.endpoint_read = 'view_document'` (`model/agents.ts:419`). Reusing it is not a choice, it is the model's |
| `propose_resolution` | `tenant_data` | existing — mints the ask |
| **`decide_operator_proposal`** | **`tenant_data`** | **mint — a platform release.** `approve_resolution` cannot be reused: `ApprovalDecision` is keyed to `(proposalId, exceptionId)` (`model/domain.ts:3259-3260`) and G44 refuses the shape change. **The capability must follow the type split or the split holds on one half only** |
| `enable_endpoint_writeback` | `authority` | existing — configuration-time, not per post |

### Invariant obligations

| Invariant | Enforced by | State |
|---|---|---|
| **10 — an act with no authorisation is unrecordable** | `EndpointReading.authorizationId` (`:3414`) and `OperatorProposalDecision.authorizationId` (`:3646`), **both non-nullable**, minted only by `authorize()` (`model/access.ts:1610`) | live — the strongest coverage in the model |
| **G44's boundary** | `_OperatorProposalIsNotExceptionAnchored` (`model/domain.ts:3736`); brands differ (`Id<'OperatorProposal'>` vs `Id<'ResolutionProposal'>`, `model/kernel.ts:145`,`:128`); pinned in `model/identity.ts` | live — **the contract must not reintroduce `exceptionId` on any operator-proposal schema** |
| **6 — ingested content is data, never instruction** | `OperatorProposal.question` is **tenant-authored free text that reaches a prompt** (`:3537-3543`), and G46/G47 stop text crossing a **turn** boundary (`CarriedTurn`, `model/domain.ts:4110`; `_CarriedTurnHoldsNoText`). 🛑 **G45 — the reader/proposer split — stops it crossing the AGENT boundary within one turn, and G45 is NOT BUILT.** G62 makes it a v1 prerequisite | ⚠️ **held by argument, not construction** |
| **7 — residency** | The proposer's model must resolve through `resolveModel()` (`model/catalog.ts:167`). ⚠️ `PolicySubject` `model_call.model` is a **LIVE bypass** at `model/policy.ts:747` | ⚠️ open |
| **11 — a container is never granted** | The read and the write reach the same `Endpoint` and therefore a `credentialRef`; `SOLUTION_IS_GRANTABLE = false` | live |
| **The endpoint identity** | 🛑 **Not enforceable in the model and said so at the type** (`model/domain.ts:3371-3377`): `EndpointReading.endpointId` and `ProposedTransaction.endpointId` are separate fields and **nothing compares them**, so a reading from a stale replica supporting a write to the live ledger is representable. *"The check belongs where the write is executed, and there is no execution path yet."* **This slice builds that execution path, so the check becomes owed here.** DERIVATION |

🛑 **The structuring bypass, and the screen makes it a button.**
`PostingCheck.dc.html` offers *"split the order across two periods"* as a one-click
way out of a breach, *"without leaving the row or asking anyone"* and **with no
approval step**. G43 records exactly that split as an open, unmitigated bypass:
neither `AutonomyConfig.autoResolveValueCeiling` (`model/policy.ts:137`) nor
`AssignmentScope.valueCeiling` (`model/access.ts:673`) can see a total.
**`askCorrelationId` is the recommended mitigation, it is blocked by nothing, and
this slice should land it** — it makes the split **visible** to an approver and an
auditor without blocking it, which is the argument invariant 10 makes for itself.

### Verification

1. **Fixture:** two `OperatorProposal` values sharing one `askCorrelationId` — the
   partial production order and the separate procurement order, the case
   `model/domain.ts:3423-3426` names. `tsc` then proves partial acceptance is
   representable, which is what `OperatorProposalDecision`'s header says it is.
2. **The boundary held on the wire:**
   ```bash
   grep -n -A40 'operator-proposals' docs/contracts/capability.openapi.yaml | grep -c exceptionId   # expect 0
   ```
   That grep is G44 extended past the type system, which is where it currently stops.
3. **Both endpoint ids agree at execution:** an assertion that
   `executeOperatorProposal` refuses when
   `reading.endpointId !== action.endpointId`. New `ErrorCode` required —
   **DECISION**, and `errors.yaml` is a closed 71-member enum.
4. **The correlation is visible:** `getOperatorProposal` returns siblings sharing
   the `askCorrelationId`, and `listOperatorProposals` can filter on it. The "done"
   test is a human-readable one: **an approver looking at proposal 1 of 2 can see
   that there are 2.**
5. **Extractor:** `askCorrelationId` is **not id-shaped in the entity sense** —
   it names a correlation, not a row. Decide deliberately whether it should be
   `Id<'OperatorProposalAsk'>` so the extractor can see it. `CLAUDE.md`'s ⚠️ block
   and `docs/HANDOFF.md` §7 argue for the branded form. **DECISION.**

### Dependencies

R0 (`ProposedTransaction.value: Money`). R6's `LedgerPosting` (shared execution
record — build it once). **Does not depend on R4 or R5** — an operator proposal is
not exception-anchored, which is the point of it.

### Explicitly out of scope

The `Ask` session surface (G62 — `AskSession` `model/domain.ts:4057`, `CarriedTurn`
`:4110`, `CarriedReading` `:4146`; **zero operations**, a whole tier). **G45's Dual
LLM split** — decided, unbuilt, and a v1 prerequisite under G62; it is named as an
obligation above and must not be claimed as delivered by this slice. Autonomous
execution — `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false` and flipping it
needs a pack-declared operator-action vocabulary carrying `reversibility`, which
does not exist (`model/domain.ts:3448-3455`).

---

## 6. Explicitly out of scope for the whole phase

| Area | Why | Where it belongs |
|---|---|---|
| `Ask.dc.html` — sessions, citations, pin-to-report, the four actions | G62; zero operations today; needs G45 first | Its own phase, alongside G45 |
| `Reports.dc.html` — period handoff, `close_period`, export-row citations, the Prepared/Reviewed/Acknowledged chain | `close_period` has no operation (§4 gap 8); the chain is unmodelled | Reporting phase |
| BI dashboard | G57/G68 — **bought**, Quick Suite; `presentation.ts` stays 51-of-53 dropped; G70 account-per-tenant | Platform phase |
| The FDE / platform tier — provisioning, publication, model selection, grants | G49/G50/G59/G70. **No screen in the pack is a platform surface** (§6a.1); G28's fourth axis | Platform phase — and it is a *decision* whether it is a console or a runbook |
| Partner anything | G51 — commercial record only, no partner user signs in. ⚠️ **Invariant 2 becomes declared and unexercised** | v1+1 |
| Billing, metering surfaces, invoicing | G36, G51; `PRODUCT.md` forbids fabricated pricing | v1+1 |
| Notifications, Support, Login/session minting | Gap 3 (nothing mints a session) blocks **all** of this — including everything above. ⚠️ **Named here because it blocks the phase and is not in it** | Entry-tier phase |
| Learning / `amendProcedure` | G39 unapplied; `learning.ts` is 33-of-61 dropped | After the spine |
| `deployment.ts`, BYOA, the fleet | G36; ⚠️ G70 may force a partial restore — `docs/v1-trim-proposal.md` §4.10, unresolved | v1+1 |

⚠️ **Gap 3 is a phase-level blocker, not a slice.** All three contract tiers require
an `X-Session` header and **no operation issues one**
(`docs/screen-pack-ledger.md` §4). Every slice above assumes a session exists.

---

## 7. What this phase cannot resolve — carried forward, marked

| # | Item | Kind | Owner |
|---|---|---|---|
| 1 | **`ApprovalConfig.segregationOfDuties` is vacuous against an agent proposer.** R6 ships the control the pack calls its central rule, and the control asserts nothing | **DECISION** | Owner — both candidate fixes are decisions, `docs/HANDOFF.md` §5.6 |
| 2 | **The confidence floor: editable (screen) or read-only (G22/G38)?** R3 is written to G38 and the screen contradicts it | **DECISION** | Owner — §5.1, *"the sharpest screen-versus-decision conflict in the pack"* |
| 3 | **Textract's handwriting and CJK coverage in `ap-southeast-1`** against a Mandarin handwritten docket at 86% mean | verification | Engineering, one afternoon — §5.7, G53/G69 |
| 4 | **G45 (Dual LLM) is a v1 prerequisite and is not built.** R7 ships a path whose containment is held by argument | **DECISION, taken** (G62) | Engineering — it is a build |
| 5 | **`scopeContains()` is cited at `model/domain.ts:3471` and exists nowhere.** The value ceiling has no checker | **DERIVATION** | R6 |
| 6 | **`DocumentType` and `ReconciliationDefinition` have version *numbers* with no version *store*.** `definitionVersion` and `ruleVersion` pin nothing | **DERIVATION** | R3, R4 |
| 7 | **Four intake channels versus three `SourceDocument.origin` values** (`capability.openapi.yaml:2439` vs `model/domain.ts:1684`) — recorded in the contract, unresolved | **DERIVATION** | R1 |
| 8 | **`AuditEvent.action` is a bare string**, so *"a distinct event type"* is unenforceable | **DERIVATION** | R2 |
| 9 | **Alternative extraction candidates** are drawn on `Confirm.dc.html` and unrepresentable | **DECISION** | Owner |
| 10 | **The reversal-window duration** — the screens say four minutes; *"the duration is a policy number nobody has set"* | **DECISION** | Owner |
| 11 | **`askCorrelationId`: branded or bare?** Bare is invisible to `tools/planner/extract.mjs` | **DECISION** | R7 — recommend branded |
| 12 | **A confirmation capability: one or three?** | **DECISION** | R2 — recommend one, under G55 |

**Nine of the twelve are derivations.** `docs/HANDOFF.md` §7: *"If it is a
derivation, it is not deferrable — you are just choosing to ship it wrong."*

---

## 8. Stale citations found while writing this

Recorded here rather than corrected, because `CLAUDE.md` and `docs/HANDOFF.md` are
not this document's to edit — and because the repository's own practice is to mark
staleness in place rather than rewrite it.

| Cited as | Actually | Where the stale citation is |
|---|---|---|
| `CAPABILITY_RESOURCE_CLASS` at `model/access.ts:426` | **`model/access.ts:517`** | `CLAUDE.md` (twice), `docs/HANDOFF.md` §3 pass E |
| `ACCESS_RESOURCE_CLASSES` at `model/governance.ts:113` | **`model/governance.ts:141`** | `CLAUDE.md` |
| `AssignmentScope.valueCeiling` at `model/access.ts:571` | **`model/access.ts:673`** | `docs/v1-trim-proposal.md` §4.2 |
| `AutonomyConfig.autoResolveValueCeiling` at `model/policy.ts:122` | **`model/policy.ts:137`** | `docs/v1-trim-proposal.md` §4.2 |
| `scopeContains()` — named as the ceiling's checker | **does not exist** | `model/domain.ts:3471` |
| `MoneyAmount` at `model/policy.ts:148` | ✅ correct | — |
| `resolveModel()` at `model/catalog.ts:167` | ✅ correct (`CLAUDE.md` says `:168` for the parameter) | — |

⚠️ **Four of the five wrong ones are line numbers on the exact constants the
invariants turn on.** That is `docs/HANDOFF.md` §5.11's shape — a count or a
citation carried in prose rather than derived — and it argues for the same fix the
repository already applied to counts: a tool that derives them.

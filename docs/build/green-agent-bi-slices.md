# Green team — vertical slices for the FIRST BUILD PHASE: the agent, the chatbot, reporting

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — a green-team input to a plan, not a decision; `docs/build/phase-one-plan.md` adjudicates it.
> ⚠️ **Written 7 Aug, before pass H.** It records `managed_service_use` as *"recorded, not applied"*; G79 **applied it to `model/` on 8 Aug** (the contract still lags). Its BI slices also predate G82 (BI moves to `ap-southeast-2`, a standing cross-region pipeline, ⚖️ blocked on counsel), G83 (Q in Quick is OFF — the natural-language layer is ours) and G84 (customers are Authors, never dataset Owners), each of which changes what these slices build.
> ✅ **BODY CORRECTED 8 Aug 2026 — one passage.** The out-of-scope note under the extraction slice said `managed_service_use` was *"recorded, not applied"*; **G79 applied the `PolicyKind` to `model/`** and the note is corrected in place, with G8's four-arm opt-out verdict left standing as the half that genuinely is still unapplied. Nothing else in this file makes a false statement about the tree; its remaining staleness is the pass-H gap the banner above already names, and that is context a reader needs, not an error to fix.
> *Banner added 8 Aug 2026; body corrected the same day.*

> **Status: a proposal. Nothing here is a decision.** Written 7 Aug 2026 against
> `main`. Every gap is marked **DERIVATION** (the answer follows from something
> already decided — per `docs/HANDOFF.md` §7, *not deferrable, you are just
> choosing to ship it wrong*) or **DECISION** (somebody must choose).
>
> **Scope taken from G62, G45, G49, G57/G68/G70, G69, and the Notifications
> blocker in `docs/HANDOFF.md` §3.** Stack is TypeScript end-to-end (G71); money
> is `bigint`, string on the wire (G65).
>
> **This document states counts. Derive them; do not copy them** — §5.11.

---

## 0. What already exists, so nothing below reinvents it

Checked at `HEAD`, not assumed. **All eight types the Ask path stands on are LIVE
— none carries `@dropped-for-v1`:**

| Type | Where | Status |
|---|---|---|
| `AskSession` | `model/domain.ts:4057` | ✅ live |
| `AskTurn` | `model/domain.ts:4024` | ✅ live — **the TRANSCRIPT, not the context** |
| `CarriedTurn` | `model/domain.ts:4110` | ✅ live — holds **no `string` field**, asserted by `_CarriedTurnHoldsNoText` (`model/identity.ts:1189`) |
| `CarriedReading` | `model/domain.ts:4146` | ✅ live — `{ readingId, numericValue }`, asserted by `_CarriedReadingHoldsNoText` (`model/identity.ts:1190`) |
| `EndpointReading` | `model/domain.ts:3368` | ✅ live — `label`/`value` are foreign-system text; `authorizationId` **non-nullable** (`:3414`) |
| `OperatorProposal` | `model/domain.ts:3517` | ✅ live — **no `exceptionId` field**, asserted by `_OperatorProposalIsNotExceptionAnchored` (`:3736`) |
| `ProposedTransaction` | `model/domain.ts:3432` | ✅ live — one write, `value: Money \| null` (`:3492`) |
| `OperatorProposalDecision` | `model/domain.ts:3628` | ✅ live — `authorizationId` non-nullable (`:3646`) |
| `CONTEXT_WINDOW_TURNS = 3` | `model/domain.ts:4006` | ✅ live |
| `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false` | `model/domain.ts:3678` | ✅ live |

**Contract operations for any of it: zero.** Reproduce:
`grep -c 'operationId:' docs/contracts/*.openapi.yaml` → 36 + 12 + 17 = 65, and
`grep -rin 'ask\|operatorProposal\|endpointReading' docs/contracts/*.openapi.yaml`
returns nothing on those nouns.

**Reusable, do not re-mint:** `authorize()` (`model/access.ts:1610`) — the only
minter of `AuthorizationGrant` (`:1510`); `resolveModel()`
(`model/catalog.ts:167`) — the only executable residency check;
`AUTHORIZATION_MAY_BE_ABSENT` (`model/governance.ts:1124`) and
`authorizationIsWellFormed()` (`:1146`); `TOOL_EFFECT` /
`TOOL_CAPABILITY` / `DELEGABLE_TO_AGENT` (`model/agents.ts:213,401,386`);
`mintAgentGrant()` (`:1345`); `SubjectLocation` (`model/governance.ts:1501`, ten
variants); 71 error codes in `docs/contracts/errors.yaml`.

---

## Slice 1 — G45: the reader/proposer split, and the one type that crosses

### Issue
**Title:** Split the ERP reader from the proposer; make the boundary a compile error, not a convention.

**Problem.** `Ask.dc.html`'s status bar promises *"reads the ledger, cannot
post"*. Today one agent does both. `EndpointReading.label` and `.value` are text
a foreign system returned (`model/domain.ts:3393-3401`), and the declaration
itself says invariant 6 **is unenforced here** (`:3345`). `docs/screen-pack-ledger.md`
§5.2: *"The screen is not wrong about the intent; it is ahead of the
construction."*

**Why first phase.** G62 moves G45 from *decided-but-unbuilt* to a **v1
prerequisite**. `docs/HANDOFF.md:1472` makes it item 1 of the two things that
unblock everything else. Every other slice here writes into a customer ledger
behind it.

### Build contract

| Model type | Status | Action |
|---|---|---|
| `CarriedReading` (`domain.ts:4146`) | ✅ live | **REUSE as the agent-boundary payload.** It is already `{ readingId, numericValue }` with a no-text proof. Minting a second symbolic-reference type is §5.3 — two vocabularies for one concept — in the file that catalogues it |
| `ReaderEmission` | **does not exist, must be created** | The closed union of everything the reader may hand the proposer. See shape below |
| `AgentAction` (`domain.ts:466`) | ✅ live, 8 members | Gains `'read_endpoint'`. `ACTION_CAPABILITY` (`agents.ts:435`) is `Record<AgentAction, …>` so this is a **compile error until classified** → `'view_document'`, matching `TOOL_CAPABILITY.endpoint_read` (`agents.ts:419`) |
| `validateDualLlmSplit()` | **does not exist, must be created** | See obligations |
| `AGENT_VIOLATIONS` (`agents.ts:860`) | ✅ live | Gains `proposerReachesEndpoint` and `readerHoldsWriteTool` |
| `TOOL_ADMITS_UNTRUSTED_TEXT` | **does not exist** — G9, three sites | ⚠️ **Out of scope here, but read the dependency note** |

```ts
/** Everything the reader may hand the proposer. No string, ever. */
export type ReaderEmission =
  | { kind: 'reading'; reading: CarriedReading }
  | { kind: 'absent'; readingId: EndpointReadingId }   // asked, no value
  | { kind: 'refusal'; code: ReaderRefusal }           // closed union, not text
```

`ReaderRefusal` is a closed union (`endpoint_unreachable`,
`not_found_in_source`, `value_not_numeric`, `scope_excluded`). **No free-text
field anywhere in this union.** That absence *is* the control, and it is the same
mechanism `CrossBoundaryScalar` uses for the tenant boundary
(`model/learning.ts`, cited at `domain.ts:4088`).

**Contract operations.** None of its own. It is an internal seam. It constrains
what Slice 2's `askQuestion` may put in a proposer prompt, and it reuses
`invokeTool` (`foundation.openapi.yaml:711`, F13 Tool Broker) as the reader's
only reach — a component must not enforce its own limits
(`docs/prompt-injection-posture.md:217`).

**Capabilities.** None new. Reader draws `view_document` (`tenant_data`);
proposer draws `propose_resolution` (`tenant_data`).

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **6 — ingested content is data, never instruction** | `_ReaderEmissionHoldsNoText = AssertNoPlainText<ReaderEmission>` in `model/identity.ts`, beside `_CarriedTurnHoldsNoText` (`:1189`). Adding `label: string` to the emission becomes a compile error |
| **6, second half** | `validateDualLlmSplit(def, bindings)`: the proposer's bindings contain **no** tool whose `TOOL_EFFECT` is `'reach_endpoint'`; the reader's contain **no** tool whose effect is `'write_tenant'` or `'egress'`. Both keyed on `TOOL_EFFECT` (`agents.ts:213`), **not on a tool name** — §5.1 is the defect this repo names most often, and `validateAgentToolBindings()` at `agents.ts:949` is a live instance of it |
| **11 — a container is never granted** | Unchanged. Both agents get a per-step `DerivedAgentGrant` from `mintAgentGrant()` (`agents.ts:1345`), expiring with the step execution (`:1323`) |
| **10** | Each reader call still mints an `EndpointReading` with a non-nullable `authorizationId` (`domain.ts:3414`) |

### Verification (runnable, not "tests pass")

1. **Red run, then revert** — the repo's established proof method (G44 used it three times):
   ```bash
   # add `label: string` to a ReaderEmission member, then:
   /tmp/tscheck/node_modules/.bin/tsc -p /Users/jrkphani/Projects/Reconcile/model/tsconfig.json --noEmit; echo "EXIT: $?"
   ```
   Must print a non-zero `EXIT` naming `_ReaderEmissionHoldsNoText`. Revert. **Run the compiler as its own command** — `cd` in a compound command swallows it (`CLAUDE.md`), and piping returns the pipe's status.
2. **`ACTION_CAPABILITY` totality bites.** Add `'read_endpoint'` to `AgentAction` and *do not* add the row. `tsc` must fail. That is the only compile-time evidence this slice produces for free.
3. **Fixture, because a total `Record` with no construction site proves nothing** — §5.10, and five such records landed on 7 Aug with no construction site anywhere. Add to `model/examples.ts`: one reader `AgentDefinition` + bindings and one proposer, and assert `validateDualLlmSplit()` returns `[]` for the pair and a `proposerReachesEndpoint` violation when `endpoint_read` is moved onto the proposer.
4. **Graph delta.** `node tools/planner/extract.mjs`; report **edges by kind** and **gaps by kind** against the previous run. `ReaderEmission` carries `readingId`, so it should appear as a new resolving edge — if it does not, the field is not id-shaped and no tool here can count it (`docs/HANDOFF.md` §7).

### Dependencies
None blocking. ⚠️ **G9 is adjacent and is NOT this slice.**
`validateAgentToolBindings()` still decides "reads untrusted text" by testing
`b.tool === TOOL_KEYS.readCorrespondenceThread` (`model/agents.ts:949-951`), so
an agent bound to `endpoint_read + send_correspondence` passes the trifecta check
today. G45 makes the *reader/proposer* boundary structural; it does **not** fix
the trifecta landmark. **Land G9 as one change at three sites or none**
(`docs/HANDOFF.md:1555`).

### Explicitly out of scope
G9 · prompt-assembly framing (R2, still comments) · R4 branch steering (accepted)
· any claim that R5 is closed. **After this slice R5 is narrowed, not closed** —
`docs/prompt-injection-posture.md:253` records that R5 got a typed landing place
and no gate.

---

## Slice 2 — Ask: sessions, turns, citations, and the transcript/context boundary on the wire

### Issue
**Title:** Give Ask its contract surface, and make the transcript-versus-context distinction survive the HTTP boundary.

**Problem.** Ask ships as drawn (G62) and has **zero operations**
(`docs/screen-pack-ledger.md` §3.3, *"Operations: none."*). The model already
holds the hard part. What is missing is every operation, and one specific trap:
`AskTurn` is the transcript and `CarriedTurn` is the context
(`domain.ts:4009-4022`), and *"a reader who takes `AskSession.turns` and hands it
to a model has replayed every untrusted string the session ever saw."* A single
`GET /ask/sessions/{id}` returning `turns[]` with no second shape is exactly how
that happens.

**Why first phase.** It is the chatbot. G55 names *"the business intelligence
dashboard with the chat bot"* as one of three things v1 must do.

### Build contract

| Model type | Status |
|---|---|
| `AskSession`, `AskTurn`, `CarriedTurn`, `CarriedReading`, `EndpointReading` | ✅ all live |
| `AssignmentScope` (`access.ts:630`) | ✅ live — six dimensions |
| `AskCitation` | **does not exist. DECISION** — see gaps |

**Contract operations — all NEW.** ⚠️ **DECISION: which file.** G62 calls Ask
*"a whole new tier alongside `administration.openapi.yaml`"*; the existing tiers
split by **plane** (F / C / X), not by feature, and Ask is tenant-runtime like
every other C operation. Both are defensible. Written below as C-tier; a separate
`ask.openapi.yaml` costs one file and one `$ref` set.

| Method + path | operationId | Capability (class) | Returns |
|---|---|---|---|
| `POST /ask/sessions` | `startAskSession` | none — starting a session performs no read | `AskSession` |
| `GET /ask/sessions` | `listAskSessions` | none | own sessions only; `askedByUserId` from the session, **never a query parameter** (invariant 1) |
| `POST /ask/sessions/{sessionId}/turns` | `askQuestion` | `view_document` (`tenant_data`) + whatever the answer path draws | `AskTurn` **plus** the `EndpointReading[]` in full |
| `GET /ask/sessions/{sessionId}` | `getAskSession` | `view_exception` (`tenant_data`) | the **transcript** — `AskTurn[]` |
| `GET /ask/sessions/{sessionId}/context` | `getAskContext` | `view_exception` | the **context** — `CarriedTurn[]`, at most `CONTEXT_WINDOW_TURNS` |
| `POST /ask/sessions/{sessionId}/attachment` | `attachAskSessionToException` | `view_exception` | sets `attachedToExceptionId`, nulls `purgeAfter` (`domain.ts:4067-4072`) |
| `GET /readings/{readingId}` | `getEndpointReading` | `view_document` | the full `label`/`value` — **for the human, never for the proposer** |

**Two operations for one session is the point, not duplication.** The context
endpoint exists so that no implementation has to remember which shape it holds.
If only one ships, ship `/context` and make the transcript the exception.

**The four screen actions reuse existing operations, and none needs a new
capability:** release a document → `getDocument`; re-run a match → `rerunRun`;
chase a vendor → `sendOutboundMessage` (already behind `checkOutboundDisclosure`);
draft a journal for approval → Slice 3's `createOperatorProposal`.

**Error codes — reuse:** `session_invalid`, `tenant_context_missing`,
`policy_denied`, `tool_out_of_scope`, `upstream_unavailable`,
`outbound_endpoint_unverified`, `resource_not_found`. **New, needed:**
`ask_session_purged`, `reader_emission_rejected`. ⚠️ Adding a code post-launch
means shipping an engine release before the thing you learned about can be
diagnosed (`docs/HANDOFF.md` §4.1).

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **1 — tenant scope from the session** | `AskSession extends TenantScoped`; `askedByUserId` is set from `PrincipalContext` (`access.ts:954`), never from the body |
| **6** | Slice 1's `ReaderEmission`; and `askQuestion` must assemble the proposer prompt from `getAskContext`'s shape only. ⚠️ **The model cannot check this** — it is an application-code rule, and it is the single most likely place this slice ships wrong |
| **10** | Every `EndpointReading` carries a non-nullable `authorizationId` (`domain.ts:3414`), minted by `authorize()` and by nothing else (`access.ts:1610`). `askQuestion` writes one `DataAccessEvent` (`governance.ts:1047`) per read |

### Verification

1. **Wire-versus-model mirror, by hand until the tool exists.** For each new
   schema, diff field names and order against the interface. This is the check
   `docs/HANDOFF.md` §8 item 5 calls *"the strongest evidence this workflow
   produces"* and records as evaporating every time. It would catch, today,
   `CapabilityRequirement` carrying two different money schemas in two files.
2. **A negative wire assertion, and it is the one that matters:**
   ```bash
   # the context response must contain no text-bearing field
   python3 - <<'EOF'
   import yaml,sys
   s=yaml.safe_load(open('docs/contracts/capability.openapi.yaml'))
   c=s['components']['schemas']['CarriedTurn']
   assert 'question' not in str(c) and 'answer' not in str(c) and 'label' not in str(c), c
   print('OK')
   EOF
   ```
   A `CarriedTurn` schema with a `question` field re-opens R6 on the wire while
   the model-side proof stays green — the model proof cannot see YAML.
3. `node tools/check-doc-counts.mjs` — must exit 0 after any count in this file
   or `docs/INDEX.md` moves.
4. Graph: contract operations should read **65 + n**. Report the number, do not
   assert it.

### Dependencies
Slice 1 (hard). Slice 3 for the proposal actions.

### Explicitly out of scope
Pin-to-report (Slice 7) · the scope statement *"sees 3 of 4 entity sets"*, which
`docs/screen-pack-ledger.md` §3.3 records as **drawn as enforced and
representable-only** — nothing reads `Exception.costCentre` or `.legalEntity`,
the `TagPolicy` resolver is unwritten, and the null-excludes rule rests on SQL
semantics. **DERIVATION, and it is not deferrable if the header renders.** Either
build the resolver or do not draw the sentence.

---

## Slice 3 — The operator proposal write path, and the correlation id

### Issue
**Title:** Mint, decide and record an `OperatorProposal`; add the correlation id G43 left recommended.

**Problem.** `docs/screen-pack-ledger.md` §4 gap 2: *"G42–G44 have zero contract
surface — nothing mints an `OperatorProposal` or performs an `EndpointReading`,
though all four types are live."* And G43's structuring bypass is live and
invisible: a post above a ceiling splits into two below it and **both pass**
(`domain.ts:3466-3483`).

**Why first phase.** It is the half of Ask that writes into the customer's
ledger. `docs/HANDOFF.md:1574` lists the correlation id as **blocked by nothing**.

### Build contract

| Model type | Status | Action |
|---|---|---|
| `OperatorProposal` | ✅ live | Gains `askCorrelationId: AskCorrelationId` — **the field does not exist** |
| `AskCorrelationId` | **does not exist, must be created** in `model/kernel.ts` as `Id<'AskCorrelation'>` |
| `OperatorProposalDecision`, `ProposedTransaction` | ✅ live | unchanged |
| `Money` (`domain.ts:372`) | ✅ live | ⚠️ G65/G66 land here: `amountMinor` → `bigint`, string on wire; `MoneyAmount` collapses into `Money`. **Both are recorded, not applied** |

**Why a branded id and not a nullable string:** the same argument G44 made. An
id-shaped, branded field is visible to `tools/planner/extract.mjs`; `askCorrelation`
carrying a branded id would be an edge no tool here can see
(`CLAUDE.md`, and `TokenUsage.model` is the worked instance).

| Method + path | operationId | Capability (class) |
|---|---|---|
| `POST /operator-proposals` | `createOperatorProposal` | `propose_resolution` (`tenant_data`) |
| `GET /operator-proposals` | `listOperatorProposals` | `view_exception` (`tenant_data`) — filterable by `askCorrelationId` |
| `GET /operator-proposals/{id}` | `getOperatorProposal` | `view_exception` |
| `POST /operator-proposals/{id}/decision` | `decideOperatorProposal` | `approve_resolution` (`authority`) |

⚠️ **`decideOperatorProposal` is deliberately NOT `decideApproval`.**
`ApprovalDecision` is keyed to `(proposalId: ProposalId, exceptionId: ExceptionId)`
(`domain.ts:3505`); reusing it would put an exception back into this path through
the decision record. G44's boundary holds on both halves or on neither.

⚠️ **No execution operation, and that is the decision.**
`OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false` (`domain.ts:3678`) and
`ProposedTransaction.actionKey` has **no pack-side declaration site**
(`:3448`), so there is no declared `reversibility` for `AutonomyConfig` to act
on. Building an execute endpoint before that vocabulary exists ships a write with
no autonomy operand.

**Error codes — reuse:** `proposal_not_executable`, `proposal_superseded`,
`approval_rejection_reason_required`, `approval_segregation_violation`,
`policy_requires_approval`, `period_closed`. **New:**
`operator_action_key_undeclared`.

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **10** | `authorizationId` non-nullable on both the reading (`:3414`) and the decision (`:3646`); `authorizationIsWellFormed()` (`governance.ts:1146`) is the write-time gate on the audit stream |
| **11** | `SOLUTION_IS_GRANTABLE = false`. `enable_endpoint_writeback` is `authority` and undelegable (`CAPABILITY_DELEGABLE.enable_endpoint_writeback = false`, `agents.ts:346`), so turning an ERP writable stays a human act |
| **5 — money is derived** | `ProposedTransaction.value` is `Money`, not a rated figure |
| **9** | Untouched — nothing here rolls back |

⚠️ **`ApprovalConfig.segregationOfDuties` is vacuous against an agent proposer**
(`docs/HANDOFF.md` §4.1) — `approver !== proposer` is trivially true against
`ProposalActor.agent`. **DECISION**, and it fires on this path the moment an
agent proposes.

### Verification

1. **The correlation id must make the split visible.** Fixture in
   `model/examples.ts`: two `OperatorProposal`s from one ask, each with
   `value.amountMinor` under `AssignmentScope.valueCeiling`, sharing an
   `askCorrelationId`. Assert `listOperatorProposals` groups them. **This does
   not block the bypass and must not be described as if it does** — G43 says
   detectable beats impossible.
2. **Red run:** add `exceptionId: ExceptionId` to `OperatorProposal`. Must fail
   with `TS2344 … does not satisfy the constraint
   'CarriesNoExceptionAnchor<OperatorProposal>'` (`domain.ts:3717` states the
   expected message). Revert.
3. **The two ceilings still do not share a type.** Derive it:
   ```bash
   grep -n 'valueCeiling' model/access.ts model/policy.ts
   ```
   `AssignmentScope.valueCeiling` is `Money`; `AutonomyConfig.autoResolveValueCeiling`
   is `MoneyAmount`; **no function converts** (`domain.ts:3484`). If this slice
   ships without G66, say so rather than claiming the ceiling is enforced.
4. Graph: new node `OperatorProposal → AskCorrelation` edge must resolve.

### Dependencies
Slices 1 and 2. ⚠️ **G66 (collapse `MoneyAmount` into `Money`) and G65 (`bigint`)
are recorded and unapplied**; this slice is the first path that compares against
both ceilings.

### Explicitly out of scope
Execution · autonomous execution · a pack-declared operator-action vocabulary
with `reversibility` (**DECISION**, and it is the prerequisite for both).

---

## Slice 4 — Model selection as a control-plane act (G49, G54, G69)

### Issue
**Title:** Give the FDE's model choice a capability, an operation and a residency check that also covers extraction.

**Problem.** G49: an FDE sets the model on behalf of all customers; a change is a
support ticket. **No capability names the act** and no operation performs it.
`docs/screen-pack-ledger.md` §6a rows 1–3: **0/18 screens**, and the FDE has
nowhere to stand. G69 extends `resolveModel()` to extraction models, which is the
first time invariant 7 covers IDP rather than only inference.

**Why first phase.** The agent cannot run without a model binding, and
`resolveModel()` is the **only executable enforcement of invariant 7** in the
codebase.

### Build contract

| Model type | Status | Action |
|---|---|---|
| `ModelCatalogEntry` (`catalog.ts:107`) | ✅ live | `provider: 'bedrock' \| 'other'` (`:120`) — **`'other'` is unreachable under G54**. Closing it to `'bedrock' \| 'sagemaker'` is a **DERIVATION**, not a decision (G54 says so in terms) |
| `resolveModel()` (`catalog.ts:167`) | ✅ live | Unchanged in shape. G69 is satisfied by *routing extraction through it*, not by editing it |
| `ModelCapabilities` | ✅ live | ⚠️ **DECISION:** does it need an `extraction` / `handwriting` / `cjk` flag? `requiresVision()` (`agents.ts:1209`) is the existing precedent. G53/G69 and §5.7 make this concrete: four warehouse variants, one Mandarin, handwritten dockets |
| `set_model_binding` (capability 37) | **does not exist. DECISION** | G49: *"Setting a model carries a residency consequence, so it is arguably `authority`, not `configuration`."* **Recommend `authority`** — `PERMITTED_RESOURCES.delivery` reaches `configuration` (`model/governance.ts:401` — ⚠️ `docs/HANDOFF.md` §3a and G22 both cite `:332` and that citation no longer resolves), which is exactly the hole G26 records for `compose_procedure`. `CAPABILITY_RESOURCE_CLASS` is `Record<Capability, …>` (`access.ts:426`), so adding the capability without the class is a compile error |
| `DocumentType` variant → engine binding | **does not exist** | G69: *"`DocumentType` still has no variant concept, so the variant→engine binding has nowhere to live."* **DECISION** |

| Method + path | File | operationId | Capability (class) |
|---|---|---|---|
| `PUT /catalogue/model-bindings/{tenantId}` | `administration.openapi.yaml` (does not exist) | `setModelBinding` | `set_model_binding` (`authority`) |
| `GET /catalogue/models` | `control-plane.openapi.yaml` | `listCatalogueModels` | published downward — invariant 3 |

`resolveModel` already exists on the wire (`foundation.openapi.yaml:456`). **Do
not add a second resolver.**

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **7 — residency survives inference** | `resolveModel()` and only it. `{ kind: 'global' }` stays in `InferenceRouting` **precisely so there is something to reject** (G54) |
| **7, and this is the live defect** | **Two fields still reach a model without passing it**: `UsageRecord.model` (`billing.ts:238`) and `PolicySubject` `model_call.model` (`policy.ts:747`). Both **live, not dropped**. `Scorer.model` (`evaluation.ts:158`) is bare but dropped. **No document may claim E5 closed** |
| **3 — control plane publishes downward, never reads tenant data** | The catalogue is published; the binding is set in the control plane and fetched by the data plane |

### Verification

1. **Derive the bypass list — do not trust any table, including this one:**
   ```bash
   grep -rnE "\b(model|modelId|modelOverride)\s*\??:\s*string\b" model/*.ts \
     | grep -v '^\S*:[0-9]*: *\*'
   ```
   Five lines at `571e7c26`, of which two are correctly bare under R1
   (`ModelCatalogEntry.modelId`, `resolveModel()`'s parameter). **If this slice
   does not reduce the count from 5, say so.**
2. **Extraction actually passes the check.** Fixture: a Textract-backed and a
   SageMaker-backed `ModelCatalogEntry`, one with `routing.kind = 'global'`.
   Assert `resolveModel()` returns `{ ok: false, rejection: { reason:
   'routing_defeats_residency' } }` for the third. Reuse error code
   `model_residency_violation`.
3. **`provider: 'other'` closure:** after narrowing the union, `tsc` must fail on
   any fixture constructing `'other'`. If nothing constructs one, the compiler
   told you nothing — §5.10.

### Dependencies
`administration.openapi.yaml`, which does not exist and which
`docs/HANDOFF.md:1460` makes **the blocker** for v1. This slice can land its
model half without it.

### Explicitly out of scope
G7's `managed_service_use` `PolicyKind` and G8's four-arm opt-out verdict —
~~**both recorded, not applied**~~ **⚠️ HALF FALSE SINCE 8 Aug 2026: G79 APPLIED
the `PolicyKind` to `model/`.** `managedServiceUse: 'managed_service_use'`
(`model/policy.ts:91`), `ManagedServiceUseConfig` with all four fields
(`model/policy.ts:327`) and the `managed_service_use` arm of the config union
(`:441`) are all in the tree. **G8's four-arm opt-out verdict is still recorded and
not applied**, and the contract still lags the model. Derive the kind count rather
than reading one: `awk '/^export const POLICY_KINDS = \{/,/^\}/' model/policy.ts |
grep -cE '^  [a-zA-Z]+:'` returned **8** on 8 Aug 2026, of which **6 are live** —
**both become load-bearing the moment Textract is
called** (G53). ⚠️ G8's opt-out applies to Textract and **not** to a self-hosted
SageMaker endpoint: two postures in one pipeline.
⚠️ **G53 carries an unverified premise** (§5.7): Textract's handwriting and CJK
coverage in `ap-southeast-1`, against four language variants including Mandarin.
**Checkable in an afternoon and not checked.**

---

## Slice 5 — Quick Suite BI: keep the scope spine, buy only the rendering

### Issue
**Title:** Make the BI layer answer three questions G68 left open — what noun `view_dashboard` gates, how invariant 10 is satisfied, and how a dataset is erased.

**Problem.** G57/G68/G70 buy the renderer. `model/presentation.ts` stays dropped
whole (51 of 53 exports). G68 records **three consequences, none solved**:

1. `view_dashboard` and `view_summary` go back to being **verbs with no noun** —
   the exact problem `presentation.ts` was written to fix.
2. **A dashboard read cannot be recorded as a `DataAccessEvent` by us**, so
   invariant 10 does not reach it.
3. **A SPICE dataset is a copy of tenant data outside our erasure plan** — it
   needs a `SubjectLocation` variant or PDPA erasure is incomplete.

**Why first phase.** G70 (account per tenant) puts per-tenant provisioning in the
control plane G50 just put in scope. Every one of these three gets more expensive
after the first tenant account exists.

### Build contract — the three answers

**(a) The noun.** New type, does not exist:

```ts
/** What `view_dashboard` gates. NOT a restoration of presentation.ts. */
export interface BiDashboardBinding extends TenantScoped {
  id: BiDashboardBindingId          // Id<'BiDashboardBinding'>, kernel.ts
  /** Quick Suite's own id. ⚠️ STAYS BARE under R1 — AWS mints it. */
  quickSuiteDashboardId: string
  /** G70: account per tenant. Bare under R1. */
  quickSuiteAccountId: string
  region: RegionKey
  label: string
  /** The pack that shipped it. v1 renders; nobody composes (G55). */
  packId: SolutionPackId | null
  enabled: boolean
}
```

This restores a noun for `view_dashboard` **without** restoring the rendering
vocabulary. G55's seam is render-versus-compose; this is on the render side.
`SAVED_VIEWS_EXIST = false` stays.

**(b) Invariant 10.** The honest answer, and it must be written down as such:

> **We authorise the SESSION, not the query.** `authorize(principal,
> 'view_dashboard', { resourceClass: 'tenant_data', resourceType:
> 'BiDashboardBinding', resourceId })` mints an `AuthorizationGrant`
> (`access.ts:1610`) whose `expiresAt` bounds the embed URL, capped by
> `MAX_AUTHORIZATION_SECONDS['tenant_data']` (`access.ts:1468`). One
> `DataAccessEvent` (`governance.ts:1047`) is written at embed issuance carrying
> that `authorizationId`. **Every row read inside the embed is invisible to us.**

That is invariant 10 at **session granularity, not row granularity**, and the
model already concedes the frame: invariant 10 makes an unauthorised act
*visible or detectable*, not impossible. ⚠️ **No document may claim invariant 10
reaches a Quick Suite read.** It reaches the door, not the room.

| Method + path | operationId | Capability (class) |
|---|---|---|
| `POST /bi/dashboards/{bindingId}/embed` | `issueBiEmbedSession` | `view_dashboard` (`tenant_data`) |
| `GET /bi/dashboards` | `listBiDashboards` | `view_dashboard` |

**(c) The `SubjectLocation` variant.** `SubjectLocation` (`governance.ts:1501`)
is a **closed union of ten**. The eleventh, and what it must carry:

```ts
| {
    kind: 'bi_dataset'
    /** Quick Suite's dataset id. Bare under R1. */
    datasetId: string
    /** G70 — account per tenant. WITHOUT THIS THE PLAN CANNOT REACH IT. */
    quickSuiteAccountId: string
    /** Residency. A dataset outside the tenant's region is a finding, not a note. */
    region: RegionKey
    /**
     * SPICE (a materialised COPY, erasable, with its own retention) versus
     * direct query (no copy; correct disposition is "no copy exists").
     * These are different erasure obligations and one boolean separates them.
     */
    materialised: boolean
    /** A copy refreshed BEFORE an erasure request is still a copy. */
    refreshedAt: Timestamp | null
  }
```

⚠️ **Two things ride with it, and both are the delta-1 lesson**
(`docs/HANDOFF.md` §4.1: the model had ten variants while the wire had nine, so a
name carried out in an approval mail could be registered in the model and refused
at the boundary):

- `foundation.openapi.yaml`'s `SubjectLocation` schema must gain it **in the same
  commit** — `registerSubjectLocation` (`:305`) and `planErasure` (`:338`).
- **DECISION:** does a BI dataset get its own `RetentionClass`?
  `RETENTION_CLASSES` has 13 members and `RetentionPolicy` is
  `Record<RetentionClass, number>`, so adding one is a **compile error until every
  policy answers it**. Recommend yes — a SPICE copy outlives its source rows,
  which is the whole reason the variant is needed.

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **1 — tenant scope from the session** | ✅ **By construction, and this is G70's genuine win.** Account per tenant: a viewer in tenant A cannot address tenant B's data at all. Not a row filter |
| **10** | Session granularity only. Stated above. Do not overclaim |
| **4 — classification declared once** | ⚠️ **Unenforced across the boundary.** `FieldSpec.dataClass` does not travel into a Quick Suite dataset. A `sensitive_personal` column landing in SPICE is a `DataClass` ceiling nothing checks. **DECISION** |
| **3** | The control plane provisions the account; it does not read the dataset |

### Verification

1. **The union must be closed on both sides. Derive both counts:**
   ```bash
   grep -c "^  | {" model/governance.ts   # scope by hand to SubjectLocation
   python3 -c "import yaml;s=yaml.safe_load(open('docs/contracts/foundation.openapi.yaml'));print(len(s['components']['schemas']['SubjectLocation']['oneOf']))"
   ```
   **They must be equal and in the same order.** They were not, twice.
2. **`RetentionPolicy` totality bites.** Add the retention class, run `tsc`, and
   confirm `_RetentionPolicyAnswersEveryClass` (named in G71's list of ten
   compile-time proofs) goes red. Then answer it. ⚠️ **If `tsc` stays green you
   have learned nothing** — nothing in `model/` constructs a `RetentionPolicy`
   (§5.10). Add the fixture.
3. **An erasure plan that admits what it cannot reach.** Fixture: a
   `SubjectIndexEntry` with `kind: 'bi_dataset'`, `materialised: true`, and a
   `planErasure` response whose disposition for it is **not** `deleted`.
4. `ap-southeast-1` availability and the Quick Suite RLS/namespace model —
   **G57 carries this as an explicit verification item and it is not done.**

### Dependencies
G50's control plane (per-tenant account provisioning) · `administration.openapi.yaml`.

### Explicitly out of scope
Restoring `model/presentation.ts` — G68 cancels G55's restore rather than
reversing it, and *"`presentation.ts` needs no change."* ·
Quick Suite's own natural-language querying, which **overlaps Ask and G62 records
the seam as not settled — DECISION**.

---

## Slice 6 — The closed list of service-notice kinds (unblocks every support grant)

### Issue
**Title:** Turn the §10.1 carve-out from a comment into a closed set.

**Problem.** `model/governance.ts:1290` blocks every `TenantAccessGrant` on
`customerNotifiedAt !== null`. The carve-out that makes that settable — that an
operational notice is service communication, not a content-bearing read — is
**held open by a comment** (`:1276-1288`):

> *"'service communication' is a category someone will widen, and it needs a
> CLOSED LIST OF NOTICE KINDS rather than a judgement call per call site. Until
> that list exists this is a carve-out held open by a comment."*

`docs/HANDOFF.md` §3 moves it from *recorded* to **blocking**; without it
`customerNotifiedAt` is never set and **every support grant fails forever**.

**Why first phase.** It is marked **DERIVATION** in
`docs/screen-pack-ledger.md` §3.5 — *"the screen has already enumerated the
vocabulary."* `Notifications.dc.html` draws the event catalogue, and its own rule
is the gate: *"An event that is not in this table cannot notify anyone, by any
channel."*

### Build contract

| Model type | Status |
|---|---|
| `TenantContact` (`domain.ts:792`), `CONTACT_DUTIES` (`:763`), `mayNotifyContact()` (`:826`) | ✅ all live |
| `SupportAuthorisation.notificationPath` (`governance.ts:546`) | ✅ live |
| `SERVICE_NOTICE_KINDS` | **does not exist, must be created** |
| `NOTICE_CARRIES_TENANT_DATA` | **does not exist, must be created** |

```ts
/** Closed. A notice not in here is a content-bearing read and needs §8.4. */
export const SERVICE_NOTICE_KINDS = {
  supportGrantIssued: 'support_grant_issued',
  supportGrantExtended: 'support_grant_extended',
  supportGrantClosed: 'support_grant_closed',
  securityPatchApplied: 'security_patch_applied',   // 72h, pre-authorised
  scheduledMaintenance: 'scheduled_maintenance',
  runFailed: 'run_failed',                          // Notifications.dc.html interrupt 1
  connectionUnreachable: 'connection_unreachable',
  postingFailed: 'posting_failed',
  workAssigned: 'work_assigned',
} as const

/**
 * THE WHOLE CONTROL. Total over the kind, so a tenth kind is a compile error
 * until somebody says whether it carries tenant data.
 * TRUE here means it is NOT a service notice — it is a §8.4 read and needs
 * `view_summary`, a mask, a classification ceiling and a residency check.
 */
export const NOTICE_CARRIES_TENANT_DATA: Record<ServiceNoticeKind, false> = { … }
```

⚠️ **Typed `Record<ServiceNoticeKind, false>`, not `<…, boolean>`.** The literal
type is what makes widening a compile error rather than a config change. A kind
that carries tenant data does not belong in this map at all — it belongs in the
digest path behind `view_summary` (capability 31, `access.ts:258`).

| Method + path | File | operationId | Capability (class) |
|---|---|---|---|
| `POST /notices` | `foundation.openapi.yaml` | `sendServiceNotice` | **none** — that is the carve-out. `mayNotifyContact()` gates on **verification**, never on capability (`governance.ts:1283`) |
| `GET /notifications` | `capability.openapi.yaml` | `listNotifications` | `view_summary` (`tenant_data`) |
| `POST /notifications/{id}/acknowledgement` | `capability.openapi.yaml` | `acknowledgeNotification` | `view_summary` |

**Error code, new:** `notice_kind_unknown`. Reuse `outbound_channel_not_permitted`,
`outbound_endpoint_unverified`.

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **8 — being staff is not access** | ✅ **This is the slice that makes invariant 8 operable.** `grantAllows()` / the notification check at `governance.ts:1290` currently cannot pass |
| **4 — classification declared once** | `NOTICE_CARRIES_TENANT_DATA` totality. A notice carrying tenant data is a `DataAccessEvent`, not a notice |
| **10** | A service notice is a `system` act — the **one** kind `AUTHORIZATION_MAY_BE_ABSENT` admits (`governance.ts:1129`). A notice with a `user` actor and a null `authorizationId` fails `authorizationIsWellFormed()` |

### Verification

1. **The deadlock must actually clear.** Fixture in `model/examples.ts`: a
   `TenantAccessGrant` with `customerNotifiedAt` set from a
   `support_grant_issued` notice. Assert the grant check at `governance.ts:1290`
   returns `{ allowed: true }`. **Today no fixture can produce this**, which is
   why the item is blocking.
2. **Red run:** add a tenth kind without a `NOTICE_CARRIES_TENANT_DATA` row →
   `tsc` fails. Add it with `true` → `tsc` fails on the `false` literal. Both,
   then revert.
3. **The screen's catalogue must be a superset check, not a vibe.** Derive the
   drawn events from `Mockups/rec/Notifications.dc.html` and diff against
   `SERVICE_NOTICE_KINDS`. Any drawn event that is *not* a service notice must
   route through `view_summary`, and **findings, proposals and cleared runs are
   deliberately absent from the bell** — the screen says so.

### Dependencies
None. Blocked by nothing, blocking everything support-shaped.

### Explicitly out of scope
Quiet hours, per-event channel routing, the override set — **all unmodelled,
DECISION** · escalation, which is `ApprovalLadder`, recorded and not implemented
(`grep -l "^export .* ApprovalLadder" model/*.ts` returns nothing) · `DiagnosticBundle`
(delta 9) and G41, which is **blocked on P10** and therefore un-buildable.

---

## Slice 7 — Reports: pin-to-report and the period handoff

### Issue
**Title:** Give pinned answers a home that is not `presentation.ts`, and give `close_period` an operation.

**Problem.** Two gaps from `docs/screen-pack-ledger.md` §3.3:
- *"`close_period` has no operation, so the act the screen is built around —
  handing a period to the CFO — cannot be performed. **(derivation)**"*
- *"Pinned answers and panels are `presentation.ts`, wholly `@dropped-for-v1`
  (52 markers) — while Reports is tagged in the demo."* And G68 keeps
  `presentation.ts` dropped, so **pin-to-report currently has nowhere to land.**

**Why first phase.** `close_period` is a derivation and derivations are not
deferrable. Pin-to-report is the hand-off between the two screens in this brief's
scope.

### Build contract

| Model type | Status | Action |
|---|---|---|
| `ReconciliationPeriod` (`domain.ts:2501`) | ✅ live | unchanged |
| `Exception` | ✅ live | unchanged |
| `RatedTotal` (`billing.ts:355`) | ⚠️ **`@dropped-for-v1`** — *"no invoicing in v1"* | ⚠️ **`docs/screen-pack-ledger.md:363` lists it as ✅ live for Reports. It is not** — the drop note is `model/billing.ts:354`. Reports must derive its figures from run output, not from a rated total |
| `PinnedAnswer` | **does not exist, must be created** | A tenant-scoped row: `{ id, askSessionId, askTurnId, periodId, label, pinnedByUserId, pinnedAt }`. **It carries no answer text** — it points at the transcript. Pinning a string would copy an agent answer derived from untrusted content into a signed pack |
| `PeriodHandoff` | **does not exist. DECISION** | The screen's Prepared / Reviewed / Acknowledged chain is *"deliberately not signed, because calling it a signature would imply assurance nobody in the chain is giving."* `ApprovalDecision` covers a proposal, not a period |
| Export-row citation | **does not exist. DECISION** | The mapping from a rendered figure to sheet and rows has no representation |

| Method + path | operationId | Capability (class) |
|---|---|---|
| `POST /periods/{periodId}/closure` | `closePeriod` | `close_period` (`tenant_data`) |
| `POST /periods/{periodId}/pins` | `pinAnswerToReport` | `close_period` — **DECISION**: or `view_exception`. Pinning shapes what the CFO reads |
| `GET /periods/{periodId}/pins` | `listPinnedAnswers` | `view_summary` |

Reuse `createExport`, `getExport`, `getDispositionMix` — all three already exist.

### Invariant obligations

| Invariant | Enforced by |
|---|---|
| **6** | `PinnedAnswer` holds **no text**. Same argument as `CarriedTurn`. An `AssertNoPlainText<PinnedAnswer>` in `identity.ts` is one line and makes it structural |
| **10** | `closePeriod` mints an `AuthorizationGrant` and writes an `AuditEvent`; reuse `recordAudit` (`foundation.openapi.yaml:552`) |
| **5** | The consolidated group total (G61) is converted, **stamped with the rate and its as-at date**, and the rate is customer-entered per period — not from a market feed and **not invented** (`PRODUCT.md`) |

⚠️ **G61 and G67 land here or the consolidated total is wrong.** The FX rate is a
**decimal string parsed at use** (G67), and G67's own condition is that **exactly
one function** parses and converts. *"Land that function in the same commit or
this becomes the defect it resembles"* — §5.2, a caller-supplied parameter that
switches a check off.

### Verification

1. **Scheduling has no capability, so `Schedule` must not appear in this slice.**
   `schedule` is one of four resource classes with no capability, and E1 leaves it
   open **deliberately** — the undecided part is scope semantics, not the verb's
   name. Derive: `awk '/^export const ACCESS_RESOURCE_CLASSES = \{/,/^\}/'
   model/governance.ts | grep -cE '^  [a-zA-Z]+:'` → 13, and count how many
   appear in `CAPABILITY_RESOURCE_CLASS`.
2. **One FX conversion function, and only one:**
   ```bash
   grep -rn 'parseFloat\|Number(' model/*.ts | grep -i 'rate\|fx'
   ```
   Must return exactly the one converter. Anything else touching the string is
   the defect G67 names.
3. **`RatedTotal` is dropped — prove Reports does not reach it:**
   `grep -n 'RatedTotal' model/billing.ts` → the `@dropped-for-v1` note is at
   `:354`. Any new code path importing it contradicts §0.
4. Fixture: a `PinnedAnswer` whose `askTurnId` resolves and whose text fields are
   absent by type.

### Dependencies
Slice 2 (Ask sessions must exist before anything pins from one).

### Explicitly out of scope
Panels, dashboards, the composition surface — `presentation.ts` stays dropped
(G68) · scheduling to a distribution list · signature semantics.

---

## Cross-slice: the three things most likely to be got wrong

| | Risk | Why it is likely |
|---|---|---|
| 1 | **`AskSession.turns` handed to a model.** | It is the path of least resistance in every SDK (`domain.ts:4020`). The model-side proof cannot see application code and cannot see the OpenAPI schema. Slice 2 verification step 2 is the only check that catches it |
| 2 | **A green `tsc` reported as verification.** | §5.10: five total records landed on 7 Aug with no construction site, so the compiler could not have failed on a single field chosen. **Every slice here adds a total `Record` or a compile-time proof, and none of them bites without a fixture in `model/examples.ts`** |
| 3 | **A claim that invariant 10 covers the BI layer, or that E5/R5 is closed.** | Both are one sentence away from being written by accident. Invariant 10 reaches the embed session, not the row; E5 has **two live bare fields** and R5 is **narrowed by G45, not closed** |

## Ordering

```
6  ─────────────────────────────────────────────  (blocks nothing; unblocks support entirely)
1  ──▶ 2 ──▶ 3
       └──▶ 7
4  ─────────────────────────────────────────────  (model half independent)
5  ─────────────────────────────────────────────  (needs G50's control plane)
```

Slice 6 first because it is a derivation, it is blocking, and it depends on
nothing. Slice 1 before anything that reads an ERP.

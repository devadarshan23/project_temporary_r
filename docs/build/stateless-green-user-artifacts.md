# GREEN TEAM — User artifacts: drafts, in-progress work, and everything a person would lose on a node death

> **Surface:** the state a PERSON is holding when a node dies.
> **Input, not a question:** the owner's 9 Aug 2026 ruling — no process-local state another
> node or a retry cannot reconstruct from durable storage. Costs are recorded, never argued.
> **Baseline verified at HEAD, 9 Aug 2026:** `npx tsc -p model/tsconfig.json --noEmit` → `EXIT: 0`.
> `ls model/*.ts | wc -l` → 18 · `grep -h '^export ' model/*.ts | wc -l` → 832 ·
> `node tools/check-doc-counts.mjs --derive` → 37 capabilities, 13 resource classes,
> 13 retention classes, 11 invariants, 71 error codes, 65 contract operations.
> Every `file:line` below was opened. Where I did not open something I say **not verified**.

---

## 0. Scope boundary I am asserting before anything else

**The ruling binds the SERVER, not the browser.** "No process-local state that another node or a
retry cannot reconstruct from durable storage" is a statement about nodes. A value that lives only
in a browser tab and is never sent to a node cannot be lost by a node death — only by a tab
closing, which is a different failure with a different owner.

That line matters because it is the difference between eleven durable artifacts and four. I apply it
below, and where a drawn screen makes a **promise across a re-authentication** (`Login.dc.html:173`)
the artifact crosses to the server side regardless of where it started, because a re-auth may land
on a different node and may be in a different tab.

---

## 1. What already exists that this reuses — and what the ruling gets FOR FREE

### 1.1 FOR FREE, from decisions already taken

| What the ruling gets | Where it already is | Why it is free |
|---|---|---|
| **Authority re-derived on every call, nothing carried in process memory** | `model/access.ts:1533-1548` — `AuthorizationGrant` is *"A REFERENCE, NOT A BEARER TOKEN … possession of the id is not possession of the authority, and `redeemAuthorization()` re-derives the authority every time"*; *"a fired employee's in-flight acts stop on the next call, not at the next expiry"* | **The authorisation model is already stateless.** A draft resumed on a different node re-derives authority at submit time. A draft held by someone who has since lost the capability, the role, or the membership **cannot be submitted** — and nobody has to write that check. This is the single largest free win on this surface. |
| **A forgotten transaction on a retry reads nothing, never another tenant's draft** | `db/migrations/0001_tenancy_and_rls.sql` — `USING (tenant_id = nullif(current_setting('app.tenant_id', true), ''))`, G100 deny-on-NULL; `db/tenant-scope.ts:123` `SELECT set_config($1, $2, true)` | Retry safety against the worst failure (cross-tenant draft read) is already mechanical. |
| **No node-local cache is even permitted** | G103 (`docs/HANDOFF.md:829`) — no Redis, the rule cache is a tenant-scoped Postgres table, because *"a cache of tenant-derived rules would sit outside RLS, outside the retention table, outside the erasure plan and outside `SubjectLocation`"* | The ruling is not a new posture; it is G103 generalised. |
| **No module-level mutable state** | G116 (`docs/HANDOFF.md:842`) — refuses a shared scratch buffer because S2 leaked inferred structure across a tenant boundary; `model/reconciliation.ts:1-110` header controls | The engine already cannot hold a person's work in process memory. Nothing to undo. |
| **The Ask session is already durable, already retained, already erasable** | `AskSession` `model/domain.ts:4243`, with `attachedToExceptionId` and `purgeAfter`; the screen commits to it (`Mockups/rec/Ask.dc.html`, quoted at `model/domain.ts:4239`: *"The session is a document"*) | One of the largest user artifacts in the product is already a row. |
| **A draft cannot become a money effect, today, with no new code** | Every arm of `ExceptionResolution` (`model/domain.ts:2855-2888`) requires `proposalId: ProposalId`. `ProposalId = Id<'ResolutionProposal'>` (`model/kernel.ts:128`), branded via `model/kernel.ts:43`. | **A held draft that carries a `HeldEditId` instead is not constructible as an effect.** `const x: ProposalId = 'he_1' as HeldEditId` is `TS2322 … Type '"HeldEdit"' is not assignable to type '"ResolutionProposal"'`. This is the whole of §2's ruling and it costs one brand. |
| **A draft may not carry an authorisation, and there is a mechanical reason** | `MAX_AUTHORIZATION_SECONDS.tenant_data = 900` (`model/access.ts:1517-1531`) | A draft lives for days. A grant covering it would be the first long-lived grant in the system. So the draft carries none — which is also invariant 10's answer (§3). |
| **The draft/act boundary has a named precedent in this tree** | `DashboardCardDraft` / `DashboardCard extends DashboardCardDraft`, `model/presentation.ts:197-215`: *"Expressed as an absent field rather than a comment saying 'server-set', because a comment does not stop `{ ...draft, id: myId }` from compiling. What a client sends is a `DashboardCardDraft`; only the server widens it."* | The pattern is house style, not invention — even though the module is wholly `@dropped-for-v1`. |
| **Optimistic concurrency has exactly one house pattern and it is not a version integer** | `ProcedureStepExecution` (`model/domain.ts:3291`), whose instance-key comment at `:3297-3302` reads *"at most one row per (tenantId, exceptionId) may have `endedAt === null`. That uniqueness IS the concurrency control — enforce it in the store, not in the caller"*; the wire half is `step_not_current` (`docs/contracts/errors.yaml:130`) described at `docs/contracts/capability.openapi.yaml:903-908`: *"Optimistic concurrency on a workflow is not optional when the workflow disburses money."* | §4 reuses it verbatim rather than minting a version column. |
| **A refusal that carries no text has a house assertion** | `AssertNoTextDeep` (`model/reconciliation.ts:258`), applied at eight sites including `_AdmissionRefusalHoldsNoText` (`:856`) | §3's refusal union inherits it. |
| **Turning an absence into a compile error has a house assertion** | `CarriesNoExceptionAnchor` / `AssertNotExceptionAnchored` (`model/domain.ts:3918-3924`), with the TS2313 circular-constraint trap and the two verified red runs written out at `:3872-3906` | §2's `AssertNoCommittedId` is that shape, re-keyed. |
| **Free text belonging to a person is already ruled ADMISSIBLE, twice, in writing** | `OperatorProposal.question` (`model/domain.ts:3728-3737`): *"`model/learning.ts` shows the alternative and why it is not available here: a learning record has NO free-text field at all … A question the operator asked cannot be structured away — the question IS the content."* Same for `AskTurn.question` (`model/domain.ts:4210`). | §3's classification answer cites this rather than re-deciding it. |

### 1.2 What already exists that I reuse by name

- `TenantScoped` (`model/kernel.ts:438`) — every held row extends it.
- `Id<T>` (`model/kernel.ts:43`) — one new brand, `HeldEditId`.
- `DataClass` / `DATA_CLASSES` (`model/domain.ts:441-447`); `DataAccessEvent.maxDataClass`
  (`model/governance.ts:1188`) — I reuse the **name** `maxDataClass`, not a new one.
- `RETENTION_CLASSES` (`model/domain.ts:1086`), `RETENTION_RECORD_KIND` (`:1135`),
  `AUDIT_MUST_OUTLIVE` (`:1165`), `RetentionPolicy` (`:1174`),
  `AssertAnswersEveryRetentionClass` (`:1197`), `retentionWindowValid()` (`:1260`) with
  `regulatoryMinimumDays` as a **parameter, never a constant** (`:1266`).
- `SubjectLocation` (`model/governance.ts:1772`, eleven variants), `SubjectIndexEntry` (`:1868`),
  `DataSubjectRequest` (`model/domain.ts:4052`).
- `ResolutionProposal` (`model/domain.ts:3411`), `ApprovalDecision` (`:3436`),
  `OperatorProposal` (`:3703`), `ExtractedScalar` (`:1821`), `Provenance` (`:1811`).
- `METERS` (`model/billing.ts:75`) with `api_calls` (`:83`) — **no new meter**.
- `CAPABILITY_RESOURCE_CLASS` (`model/access.ts:556`) — `propose_resolution`,
  `approve_resolution`, `execute_resolution` are all `tenant_data`. **No new capability**, with one
  named exception (§7).
- `withTenantScope()` (`db/tenant-scope.ts`) and the `(tenant_id, id)` composite-key rule from
  `db/migrations/0001_tenancy_and_rls.sql`.
- `docs/persistence-design.md:223-256` — *"a discriminated union or a recursive structure goes in
  JSONB. A foreign key does not"*, and *"Anything else that turns out to need a `WHERE` gets
  promoted to a column."*

---

## 2. The artifacts, enumerated from the drawn product

Derived from `Mockups/rec/*.dc.html` and `docs/screen-pack-ledger.md`, not from imagination.
Disposition is one of **durable** (must be a row), **derivable** (recompute on any node from
committed rows), **may be lost** (never reaches a node, so a node cannot lose it).

| # | Artifact | Drawn at | Disposition | Defence |
|---|---|---|---|---|
| 1 | **A held, unsubmitted rejection reason** | `Mockups/rec/Login.dc.html:173` — *"Your rejection reason on C.4 is held, unsubmitted. Nothing was posted while you were away."* and `:278` — *"Timeout on a financial system is the moment people assume they have lost work; saying otherwise, specifically, is worth more than any amount of reassuring copy."* | **DURABLE** | The product makes an explicit promise across a re-authentication, and `docs/screen-pack-ledger.md` already records the gap: *"The preserved unsubmitted rejection reason has nowhere to live … the model has no draft or unsubmitted-decision state. (decision)"*. This is the flagship artifact. |
| 2 | **A drafted journal** | `Mockups/rec/Close.dc.html:200` — *"journal drafted, balanced"*; `Mockups/rec/Finding.dc.html:132` — *"Drafted journal · balanced"*; `Mockups/rec/Ask.dc.html:252` — *"draft a journal for approval"* | **DURABLE** | This is the money-moving draft and it is §3's whole subject. Losing it loses judgement a person exercised over a figure. |
| 3 | **A confirmed low-confidence field, before submit** | `Mockups/rec/Confirm.dc.html:272` — *"the whole page opens instead and you point at where the value is. The region you pick is stored with the answer"*; `:281` — *"written with your name, the time, and the region … The machine's reading is kept beside it, not replaced by it."* | **DURABLE** — and its committed counterpart **does not exist** | `docs/screen-pack-ledger.md` §3.3: *"The confirmed value has no home"*, *"No capability covers the act"*, *"No operation confirms or corrects a field"*, *"The distinct event type does not exist"*. So I can hold this draft and there is nothing to submit it into. Named as blocked, not designed around. |
| 4 | **A draft operator transaction** (post above a floor, split an order) | `Mockups/rec/PostingCheck.dc.html` via `docs/screen-pack-ledger.md` §3.3 — *"both takeable without leaving the row or asking anyone"* | **DURABLE** | `OperatorProposal` (`model/domain.ts:3703`) is live; the pre-submit state is not. Note G43's structuring bypass and the un-taken correlation id — a **draft** makes the split easier to assemble unobserved, which sharpens G43 rather than softening it. |
| 5 | **A partially-triaged exception queue** | `Mockups/rec/Close.dc.html:198-204` (the banded register); `assign_exception` capability | **ALREADY DURABLE** | Triage *acts* are committed: `Exception.status` (`model/domain.ts:648`), `Exception.assignedTo` (`:3021`). Nothing to add. |
| 6 | **A multi-row selection in flight** (14 of 60 rows ticked, no act taken) | the register's row affordances | **MAY BE LOST** | It never reaches a node under §0, it encodes no judgement (the rows are re-findable because the register order is deterministic), and no screen promises it. If a future design sends it to a node to survive a tab close, it becomes artifact #1's shape and takes artifact #1's machinery. |
| 7 | **A filter or saved view** | `Mockups/rec/Close.dc.html`, `Finding.dc.html`, `Setup.dc.html:335` (*"The filter also exports"*) | **MAY BE LOST** for the filter; **DURABLE** for the export | `model/presentation.ts:180` — the drop note says in terms: *"no dashboard builder, **no saved views**, no Panels screen"*. That is the authority and it says v1 has none. A filter is derivable from the URL the browser holds. The *export* the filter produces is `createExport` and already an act. |
| 8 | **Return-to-where-you-were after re-auth** | `Mockups/rec/Login.dc.html:170` — *"You will return to exactly where you were."* | **DERIVABLE** | A route is in the browser's URL. Only the *work* in it (artifact #1) is durable. |
| 9 | **An in-flight Ask turn** (question sent, answer not yet produced) | `AskTurn` (`model/domain.ts:4210`) requires `answer: string` | **DURABLE — and it is NOT a draft** | The person has committed to asking; this is an in-flight ACT, and it belongs to the two-phase intent-row pattern already ruled for notifications (`docs/build/event-architecture-recommendation.md:83`, stream 5 — *"Intent row in the act's transaction; materialise per recipient at send time"*). ⚠️ **Left out of my design deliberately** and flagged in §7: if a node dies after the model call and before the turn row, tokens were metered and the transcript has no turn — `UsageRecord` and `AskSession.turns` then disagree, which is an invariant 5 problem, not a draft problem. |
| 10 | **An uploaded file not yet admitted** | `SourceDocument.origin: 'upload'` (`model/domain.ts:1843`) | **DURABLE — and the row shape is wrong for it** | `SourceDocument` has `ingestedAt`, `extracted` and `lines` and **no status field**: the row is written *after* extraction. Bytes interrupted mid-upload have no row at all. That is the ingestion surface, not this one — named in §7. |
| 11 | **A mapping / definition / procedure being authored** | `Mockups/rec/Reconciliations.dc.html`, `Setup.dc.html` | **ALREADY DURABLE, and the existing shape is CORRECT here** | `ReconciliationDefinition.status: 'draft' \| 'active' \| 'archived'` (`model/domain.ts:2159`), `Procedure.status` (`:3214`), `Solution.status` (`:2655`), `HarnessDocument.status` (`model/agents.ts:527`). §3 argues **why a status field is right for a definition and wrong for an act**. ⚠️ **But nothing reads any of them:** `grep -rn "status === \|status !== " model/*.ts` returns five readers and not one is a definition or a procedure. So a draft definition is refused by nothing today. |
| 12 | **An SOP amendment drafted as a redline** | `Mockups/rec/Setup.dc.html:332` — *"drafted as a clause, not as a suggestion box … what the text currently says, what it would say, and the three rejections that produced it"* | **DURABLE when it exists** | G39 `amendProcedure` is not applied; `docs/screen-pack-ledger.md` §4 ranks it 14. Out of scope, and it is the collision in §6.4. |
| 13 | **A defect report being composed** | `Mockups/rec/Support.dc.html` | **out of scope** | `DiagnosticBundle` does not exist (delta 9); G41 is blocked on P10. |
| 14 | **A draft reversal note** | `ExceptionReversal.note` (`model/domain.ts:2930`) | **DELIBERATELY EXCLUDED** | A reversal is a four-minute undo (`Close.dc.html`) and `docs/screen-pack-ledger.md` §4 row 11 records that *"no field time-boxes an undo"*. A **draft** reversal would outlive a window that does not exist. Excluding it is the honest answer until the window is a number. |

**Four artifacts get machinery: #1, #2, #3, #4.** #3's promotion path is blocked; #5, #9, #10, #11
are already durable or belong elsewhere; #6, #7, #8 may be lost and I have defended each.

---

## 3. The design

### 3.0 The ruling on drafts of money-moving acts

> **A draft is a DISTINCT TYPE. It is never a status field on the committed act.**

Four arguments, each mapped to something already in the record:

1. **§5.5 — invalid states the type made legal.** `ExceptionResolution` was a flat record until
   5 Aug and `{ mode: 'autonomous', authorisedByPolicyId: null }` was a legal value —
   *"the exact state it was created to prevent, legal in the type meant to prevent it"*
   (`model/domain.ts:2843-2851`). `ResolutionProposal.status: 'draft' | 'submitted'` recreates that
   precisely: the pair *(a proposal whose status is `draft`, an `ExceptionResolution` naming its
   `proposalId`)* would be two individually legal values composing an illegal state, and nothing in
   the type would say so.
2. **Invariant 10.** An act with no authorisation is unrecordable, and `authorize()`
   (`model/access.ts:1659`) mints the grant and nothing else does. A draft has no authorisation and
   must have no field for one — §3.4's assertion makes adding one a compile error.
3. **G127's own words** (`docs/HANDOFF.md:853`): *"The boundary must be expressed in the TYPE, not
   in prose, or `AUTO_WRITE_OFF` reappears the first time somebody finds suspense tedious."*
   Identical argument, different boundary.
4. **It is already true and costs one brand.** See §1.1's last-but-two row.

**Why a status field IS right for a definition (#11) and wrong for an act.** A definition is
inert until a run pins it: `ReconciliationRun.definitionVersion` is the gate, and
`Mockups/rec/Reconciliations.dc.html` builds the versioning promise on it (*"saving produces v5 and
runs that used v4 keep pointing at v4"*). An act has no such pin — the effect is the row. So the
distinction is not stylistic: **a status field is safe exactly where something else already refuses
to execute the draft.** ⚠️ And today nothing reads `ReconciliationDefinition.status`, so even there
the refusal is missing (see §2 row 11).

### 3.1 `model/kernel.ts` — one new brand

**Insertion point:** after `AskTurnId` (`model/kernel.ts:159`), inside the consolidated id block.

```ts
/**
 * ADDED <date> — the custody row for work a person has not submitted.
 *
 * ⚠️ IT IS DELIBERATELY NOT A `ProposalId`, AN `ApprovalDecisionId` OR AN
 * `OperatorProposalId`, AND THAT ABSENCE IS THE WHOLE CONTROL. Every arm of
 * `ExceptionResolution` (`model/domain.ts:2855`) requires `proposalId:
 * ProposalId`, so a held draft carrying this brand instead is NOT
 * CONSTRUCTIBLE as an effect:
 *
 *     const x: ProposalId = 'he_1' as HeldEditId
 *     // TS2322 … Type '"HeldEdit"' is not assignable to type
 *     //          '"ResolutionProposal"'
 *
 * That is the third guard `AssertNotExceptionAnchored` relies on
 * (`model/domain.ts:3908-3913`), reused rather than reasoned out again.
 */
export type HeldEditId = Id<'HeldEdit'>
```

### 3.2 A new module — `model/held-work.ts`

**Why a new module rather than `model/domain.ts`.** `domain.ts` is the largest module and
`CLAUDE.md` requires a plan before touching it; the concern here — *custody of unsubmitted work* —
is distinct and imports only types. Acyclic: `held-work.ts` imports `type` from `kernel`, `domain`
and `reconciliation`; nothing imports it back. **Cost:** the module count moves 18 → 19 and
`node tools/check-doc-counts.mjs` will report every Markdown line stating 18 as STALE. That is the
tool working, and the fix is mechanical.

All imports are `import type`, so **no `.ts` extension** — matching `model/billing.ts`'s
`from './kernel'` and the rule at `model/reconciliation.ts:36-38` (*"Both specifiers carry `.ts`;
the `import type` twins do not"*). This module adds **no value import**, so the runtime-importability
control (`tests/model/runtime-importability.test.ts`) cannot be broken by it.

```ts
/* ==================================================================== *
 * HELD WORK — what a person is holding when a node dies.
 *
 * THE RULING THIS MODULE APPLIES (owner, 9 Aug 2026): no process-local state
 * another node or a retry cannot reconstruct from durable storage. Session data
 * and user artifacts are committed to the database.
 *
 * WHAT THIS MODULE IS NOT, and each is structural:
 *   - It is NOT an act. Nothing here carries an `AuthorizationGrantId`, and
 *     `AssertUnauthorised` below makes adding one a compile error. Invariant 10:
 *     `authorize()` (`model/access.ts:1659`) mints a grant for an ACT, and a
 *     held draft is not one.
 *   - It is NOT a second vocabulary for a proposal (§5.3). Every draft body is
 *     DERIVED from its committed interface by `Omit` + `Partial`, so a field
 *     added to `ResolutionProposal` appears here and a field removed disappears.
 *     Exactly one arm is not derivable and says so at the point of declaration.
 *   - It mints no id, reads no clock and writes no record. Failures are values.
 * ==================================================================== */

import type {
  ApprovalDecision,
  DataClass,
  ExtractedScalar,
  OperatorProposal,
  Provenance,
  ResolutionProposal,
} from './domain'
import type { AssertNoTextDeep } from './reconciliation'
import type {
  AuthorizationGrantId,
  ExceptionId,
  FieldPath,
  HeldEditId,
  ProposalId,
  SourceDocumentId,
  TenantScoped,
  Timestamp,
  UserId,
} from './kernel'
```

#### 3.2.1 The subject — anchor and body in ONE union

```ts
/**
 * WHAT THE WORK IS ABOUT, AND THE WORK ITSELF, IN ONE DISCRIMINATED UNION.
 *
 * ⚠️ THEY ARE NOT TWO FIELDS, AND THAT IS §5.5 APPLIED BEFORE THE DEFECT
 * RATHER THAN AFTER IT. An `anchor` field beside a separate `body` field makes
 * *(a field-confirmation body against an approval-decision anchor)* a legal
 * value, which is the shape `ExceptionResolution` was rewritten to eliminate
 * (`model/domain.ts:2843`). One union, and the mismatch is unrepresentable.
 *
 * `anchorId` IS UNIFORMLY NAMED, per arm, WITH A DIFFERENT BRAND. Two reasons:
 *   1. `ResourceRef` (`model/access.ts:1471`) already sets the house pattern for
 *      a reference whose target type varies — `(resourceType, resourceId)` IS
 *      the identifier and the class closes instead. This is that, strictly
 *      stronger, because each arm's id is branded rather than a bare string.
 *   2. The store needs ONE generated column to index on (§3.5). Three different
 *      key names would force `coalesce(subject->>'exceptionId', …)`, which is
 *      a rule keyed on a convenient landmark instead of the property it
 *      protects — §5.1, the most common defect here.
 *
 * ⚠️ `tools/planner/extract.mjs` CANNOT SEE ANY OF THESE EDGES. It is blind to
 * union members (`CLAUDE.md`, "The model graph"), so `HeldEdit → Exception` and
 * `HeldEdit → ResolutionProposal` will not appear in the graph however the
 * fields are named. Stated rather than worked around: renaming to
 * `exceptionId`/`proposalId` would not buy the edge either.
 *
 * `draft` IS A NESTED KEY AND NOT INLINE FIELDS. It is what retention deletes:
 * `subject - 'draft'` (§3.5) removes every personal value and leaves the anchor,
 * so the row survives as a tombstone the way `SourceDocument.purgedAt`
 * (`model/domain.ts:1862`) does, and the generated columns stay valid.
 */
export type HeldEditSubject =
  /**
   * A drafted disposition and its journal — `Mockups/rec/Close.dc.html:200`
   * ("journal drafted, balanced"), `Finding.dc.html:132`.
   */
  | {
      readonly kind: 'exception_disposition'
      readonly anchorId: ExceptionId
      readonly draft: HeldDisposition
    }
  /**
   * THE ARTIFACT `Login.dc.html:173` PROMISES — a held, unsubmitted rejection
   * reason. Anchored on the PROPOSAL, not the exception, for the reason
   * `ApprovalDecision` is (`model/domain.ts:3427-3435`): quorum counts distinct
   * approvers of ONE proposal, so the proposal is the key.
   */
  | {
      readonly kind: 'approval_decision'
      readonly anchorId: ProposalId
      /** Carried because `ApprovalDecision` carries both. Not the anchor. */
      readonly exceptionId: ExceptionId
      readonly draft: HeldApprovalDecision
    }
  /**
   * A person's reading of a low-confidence field, before submit —
   * `Mockups/rec/Confirm.dc.html:272,281`.
   *
   * 🛑 THIS ARM HAS NO COMMITTED COUNTERPART AND CANNOT BE SUBMITTED.
   * `docs/screen-pack-ledger.md` §3.3 records four independent absences: no
   * capability names the act, no operation performs it, the confirmed value has
   * no home, and the distinct event type does not exist. The arm is declared so
   * the work is not LOST while those are decided; `submitAdmissible()` refuses
   * it unconditionally (§4).
   */
  | {
      readonly kind: 'field_confirmation'
      readonly anchorId: SourceDocumentId
      /** Part of the anchor identity: one draft per (document, path). */
      readonly path: FieldPath
      readonly draft: HeldFieldConfirmation
    }
  /**
   * A draft operator transaction — `Mockups/rec/PostingCheck.dc.html`, G42–G44.
   * No anchor: `OperatorProposal` deliberately carries no `exceptionId` (G44,
   * proved at `model/domain.ts:3921-3924`), so nothing here may reintroduce one.
   */
  | {
      readonly kind: 'operator_transaction'
      readonly draft: HeldOperatorTransaction
    }
```

#### 3.2.2 The bodies — derived, never retyped

```ts
/**
 * DERIVED FROM THE COMMITTED INTERFACE, NEVER RETYPED. §5.3 says two
 * vocabularies for one concept is the shape that recurs most, and every instance
 * found so far diverged within HOURS. `Omit` + `Partial` makes divergence
 * impossible: a field added to `ResolutionProposal` is a field a draft may hold,
 * automatically.
 *
 * WHAT IS OMITTED AND WHY EACH:
 *   id           server-minted. Its absence is what stops promotion by spread —
 *                the `DashboardCardDraft` argument (`model/presentation.ts:197`).
 *   tenantId     invariant 1. Derived from the session, never from a request.
 *   exceptionId  the anchor carries it; two copies would disagree.
 *   proposedBy   the SESSION principal at submit time, not at hold time. A draft
 *                held on Monday and submitted on Wednesday by someone whose
 *                assignments changed must be attributed to Wednesday's
 *                authority — which is what `redeemAuthorization()` already
 *                re-derives (`model/access.ts:1545`).
 *   proposedAt   server clock.
 *
 * `Partial` IS NOT LAXITY. A half-finished draft has holes by definition; the
 * completeness check belongs at SUBMIT, in `submitAdmissible()`, where a
 * missing `dispositionKey` is a refusal with a reason. Modelling it as required
 * here would make the honest state unrepresentable.
 *
 * ⚠️ `adjustment: Money | null` SURVIVES THE `Omit` AND THAT IS DELIBERATE.
 * `Money.amountMinor` is still `number` (`model/domain.ts:535`) — G65's `bigint`
 * retype is ruled and not applied. Because the body is DERIVED, G112's rule
 * ("the retype follows the TYPE") reaches this draft for free, and G111's codec
 * owns the wire representation at the boundary. Nothing here touches money.
 */
export type HeldDisposition = Partial<
  Omit<
    ResolutionProposal,
    'id' | 'tenantId' | 'exceptionId' | 'proposedBy' | 'proposedAt'
  >
>

/** Remaining fields: `decision`, `reason`. The reason is the held prose. */
export type HeldApprovalDecision = Partial<
  Omit<
    ApprovalDecision,
    | 'id'
    | 'tenantId'
    | 'proposalId'
    | 'exceptionId'
    | 'decidedBy'
    | 'requestedAt'
    | 'decidedAt'
  >
>

/**
 * `readingIds` IS NOT OMITTED. An `EndpointReading` is an ACT with its own
 * `authorizationId` and its own timestamp (`model/domain.ts:3554`); readings
 * already taken are legitimately referenced by a draft. Omitting them would
 * lose the grounding the screen's caption asserts.
 */
export type HeldOperatorTransaction = Partial<
  Omit<
    OperatorProposal,
    'id' | 'tenantId' | 'askedByUserId' | 'askedAt' | 'proposedBy' | 'proposedAt'
  >
>

/**
 * 🛑 THE ONE BODY THAT IS NOT DERIVED, BECAUSE THERE IS NOTHING TO DERIVE IT
 * FROM. `docs/screen-pack-ledger.md` §3.3: *"The confirmed value has no home.
 * Name + time + the image region + the machine's original reading, retained side
 * by side, is a shape the model does not carry."*
 *
 * THIS IS §5.3 RISK AND IT IS DECLARED RATHER THAN HIDDEN. The mitigation is
 * that both fields reuse existing types verbatim — `ExtractedScalar`
 * (`model/domain.ts:1821`) and `Provenance` (`:1811`) — so this is the SAME
 * vocabulary at a new anchor, not a second one. The moment the confirmed-field
 * act is modelled, this becomes `Partial<Omit<…>>` like its three siblings and
 * the divergence window closes.
 *
 * The machine's original reading is NOT copied here. It is already on
 * `SourceDocument.extracted[path]` and `Confirm.dc.html:281` requires it be
 * *"kept beside it, not replaced by it"* — copying it would create the second
 * copy that later disagrees.
 */
export interface HeldFieldConfirmation {
  readonly scalar: ExtractedScalar | null
  /** Where the person pointed. `Confirm.dc.html:272`. */
  readonly region: Provenance | null
}
```

#### 3.2.3 The row

```ts
/**
 * Closure, as a union rather than two nullable timestamps.
 *
 * ⚠️ `submittedAt: Timestamp | null` BESIDE `discardedAt: Timestamp | null`
 * makes *both non-null* a legal value, which is §5.5 exactly. A union makes it
 * unrepresentable.
 *
 * NOTE WHERE `authorizationId` SITS. It is on the `submitted` arm ONLY.
 * The SUBMISSION is an act and invariant 10 requires the grant; the OPEN draft
 * is not an act and must not carry one. Putting it here rather than on `HeldEdit`
 * is what makes "an open draft has no authorisation" unrepresentable-otherwise
 * instead of a comment.
 *
 * `superseded` borrows its name and its meaning from
 * `STEP_EXECUTION_OUTCOMES.superseded` (`model/domain.ts:3283`): *"Abandoned
 * because the walk was restarted … distinct from `advanced` because nothing
 * chose an edge, and distinct from `failed` because nothing broke."* The anchor
 * moved under the draft — the exception was resolved, reversed, or the proposal
 * decided by someone else — and neither the author nor the system did anything
 * wrong. One vocabulary, not a second.
 */
export type HeldEditClosure =
  | { readonly kind: 'open' }
  | {
      readonly kind: 'submitted'
      readonly at: Timestamp
      /** INVARIANT 10, the write half. The ACT carries the grant; the draft did not. */
      readonly authorizationId: AuthorizationGrantId
    }
  | { readonly kind: 'discarded'; readonly at: Timestamp }
  | { readonly kind: 'superseded'; readonly at: Timestamp }

export interface HeldEdit extends TenantScoped {
  readonly id: HeldEditId
  /**
   * WHOSE WORK. Id-shaped for the reason `OperatorProposal.askedByUserId` is
   * (`model/domain.ts:3706-3716`) — a field called `author` carrying a branded
   * id is an edge no tool here can see.
   *
   * IT IS PART OF THE OPEN-DRAFT KEY, and that is a product fact rather than a
   * technical one: `ApprovalConfig.quorum` counts DISTINCT approvers of one
   * proposal, so two people holding two rejection reasons against the same
   * proposal is the normal case, not a conflict.
   */
  readonly authorUserId: UserId
  readonly subject: HeldEditSubject
  /**
   * MONOTONIC WITHIN (tenantId, id). Optimistic concurrency — §3.4.
   *
   * SPELLED `sequence`, NOT `version` OR `revision`. Two things in this model
   * already mean "monotonic within a key": `ProcedureStepExecution.sequence`
   * (`model/domain.ts:3327`) and `UsageRecord.sequence` (`model/billing.ts:165`).
   * A third spelling of one concept is §5.3, in the module that cites it.
   */
  readonly sequence: number
  /**
   * THE HIGHEST `DataClass` ANYTHING IN `subject` CARRIES.
   *
   * Same name and same job as `DataAccessEvent.maxDataClass`
   * (`model/governance.ts:1188`). It is stored rather than computed at read time
   * for the reason `AuthorizationGrant.resourceClass` is denormalised
   * (`model/access.ts:1451-1457`): the classification is a platform artefact and
   * a release may move it, so a row must reach its own classification without a
   * join to today's table.
   *
   * 🛑 COMPUTING IT REQUIRES THE ONE `DataClass` LADDER, WHICH DOES NOT EXIST.
   * `model/policy.ts:1692-1704` records FOUR copies of the ordering —
   * `DATA_CLASS_LADDER` (`:1709`, module-private), `DATA_CLASS_RANK`
   * (`model/learning.ts:1773`, `@dropped-for-v1`), a function-local `order`
   * inside `mayAdmit()` (`model/policy.ts:1088`) — and says the unification *"is
   * owed, as its own commit, with `mayAdmit()` under test first."* THIS MODULE
   * ADDS NO FIFTH COPY. That unification is a hard prerequisite (§7).
   */
  readonly maxDataClass: DataClass
  readonly heldAt: Timestamp
  /** Updated on every accepted hold. `purgeAfter` is recomputed from it. */
  readonly lastHeldAt: Timestamp
  /**
   * Derived from `RetentionPolicy.days.held_edit` at every hold, and recomputed
   * from `lastHeldAt` rather than fixed at `heldAt`.
   *
   * ⚠️ THAT DIFFERS FROM `SourceDocument.purgeAfter` (`model/domain.ts:1861`),
   * which is computed ONCE at ingest, and the difference is defensible: a
   * document does not change, so its window runs from arrival; a draft under
   * active edit has not reached the end of its purpose, and
   * `RETENTION_CLASSES`'s own rule is *"Days from the class's own triggering
   * event"* (`model/domain.ts:1176`). For a draft that event is the last hold.
   */
  readonly purgeAfter: Timestamp
  /** Non-null once the body has been redacted by the retention sweep. */
  readonly purgedAt: Timestamp | null
  readonly closure: HeldEditClosure
}
```

#### 3.2.4 The compile-time assertions

```ts
/**
 * A DRAFT MAY NOT CARRY THE COMMITTED ACT'S IDENTITY.
 *
 * MAPPED, NOT CONDITIONAL, for the reason recorded on
 * `AssertNotExceptionAnchored` (`model/domain.ts:3872-3878`): written the
 * obvious way — `'id' extends keyof T ? never : T` — this is
 * `TS2313: Type parameter 'T' has a circular constraint`, because the check
 * needs `T` before `T` is bound. A mapped type over `keyof M` is deferred.
 *
 * CONSTRAINT-SHAPED rather than a conditional return type for the second reason
 * recorded there: written as a return type it would resolve to `never` and
 * report NOTHING, because `never` is assignable to everything.
 *
 * ⚠️ THE RED RUNS THIS MUST BE VERIFIED AGAINST BEFORE IT IS BELIEVED, and each
 * must be the ONLY error in the run — a TS6133 or TS6196 alongside means
 * `noUnusedLocals` produced the red:
 *
 *   1. SUBSTITUTING THE COMMITTED TYPE — `AssertNoCommittedId<ResolutionProposal>`:
 *
 *        error TS2344: Type 'ResolutionProposal' does not satisfy the
 *        constraint 'CarriesNoCommittedId<ResolutionProposal>'.
 *          Types of property 'id' are incompatible.
 *            Type 'ProposalId' is not assignable to type 'never'.
 *
 *   2. THE CASE THIS EXISTS TO CATCH — somebody drops `'id'` from the `Omit`
 *      in `HeldDisposition`, in good faith, because a queue wanted one join.
 *      Same TS2344, naming `HeldDisposition`.
 *
 * The three draft bodies are the PASSING cases, which this needs: a proof with
 * no passing case does not distinguish "the rule holds" from "the rule is
 * unsatisfiable".
 */
type CarriesNoCommittedId<M> = {
  [K in keyof M]: K extends 'id' | 'proposalId' | 'exceptionId' ? never : M[K]
}
export type AssertNoCommittedId<M extends CarriesNoCommittedId<M>> = M

export type _HeldDispositionCarriesNoCommittedId = AssertNoCommittedId<HeldDisposition>
export type _HeldApprovalCarriesNoCommittedId = AssertNoCommittedId<HeldApprovalDecision>
export type _HeldOperatorTxCarriesNoCommittedId = AssertNoCommittedId<HeldOperatorTransaction>

/**
 * A HELD BODY MAY NOT CARRY AN AUTHORISATION — invariant 10, from the other side.
 *
 * Both spellings are checked because this codebase mixes them deliberately:
 * the function is `authorize()` and the field is `authorizationId`, while every
 * sentence about it says "authorisation". A future field could arrive either way.
 */
type CarriesNoAuthorisation<M> = {
  [K in keyof M]: K extends 'authorizationId' | 'authorisationId' ? never : M[K]
}
export type AssertUnauthorised<M extends CarriesNoAuthorisation<M>> = M

export type _HeldDispositionIsUnauthorised = AssertUnauthorised<HeldDisposition>
export type _HeldApprovalIsUnauthorised = AssertUnauthorised<HeldApprovalDecision>
export type _HeldOperatorTxIsUnauthorised = AssertUnauthorised<HeldOperatorTransaction>
export type _HeldFieldConfirmationIsUnauthorised = AssertUnauthorised<HeldFieldConfirmation>
```

#### 3.2.5 The refusals and the two gates

```ts
/**
 * Why a hold, a replacement or a submission is refused.
 *
 * A REASONED UNION AND NEVER A BOOLEAN — §5.2, and the shape `ModelResolution`
 * (`model/catalog.ts:172`) and `Decision` (`model/access.ts`) already set.
 *
 * ⚠️ NO ARM CARRIES A STRING, AND `FieldPath` IS THEREFORE NOT ON THE REFUSAL.
 * A refusal is the value most likely to be put in a log, and
 * `TelemetryPolicy.maxDataClassInSpanAttributes` governs what may be a span
 * attribute. `AdmissionRefusal` (`model/reconciliation.ts:839`) solves this the
 * same way: the refusal arm carries no path, and `RefusedItem` (`:860`) carries
 * the path beside it. `RefusedHold` below is that shape.
 */
export type HeldEditRefusal =
  /**
   * G106, FAIL-CLOSED, AND IT RUNS AT HOLD TIME RATHER THAN AT SUBMIT TIME.
   * The subject names a payload path with no `FieldSpec`, so it has no
   * classification, so it is UNREADABLE. Spelled identically to
   * `AdmissionRefusal`'s arm (`model/reconciliation.ts:847`) on purpose: it is
   * the same G106 refusal at a different seam, and one reason code beats two.
   */
  | { readonly kind: 'field_not_classified' }
  /**
   * Optimistic concurrency. The direct analogue of `step_not_current`
   * (`docs/contracts/errors.yaml:130`), whose own description is the argument:
   * *"Optimistic concurrency on a workflow is not optional when the workflow
   * disburses money"* (`docs/contracts/capability.openapi.yaml:907`).
   */
  | { readonly kind: 'not_current'; readonly currentSequence: number }
  /** The row is submitted, discarded or superseded. A closed draft never reopens. */
  | { readonly kind: 'not_open' }
  /** The body was redacted by the retention sweep. Never loaded as a `HeldEdit`. */
  | { readonly kind: 'purged' }
  /** The anchor moved: the exception resolved, the proposal decided elsewhere. */
  | { readonly kind: 'anchor_no_longer_open' }
  /** No `HoldPolicy` was supplied. A bound with no number is not a bound. */
  | { readonly kind: 'hold_policy_absent' }
  /** Holds arrived faster than `minimumHoldIntervalSeconds`. */
  | { readonly kind: 'hold_too_frequent' }
  /**
   * 🛑 `field_confirmation` HAS NO COMMITTED COUNTERPART. Unconditional, and it
   * is the refusal that makes an un-buildable promotion path visible instead of
   * silently absent.
   */
  | { readonly kind: 'no_committed_counterpart' }
  /** Submission attempted with a hole the committed type requires. */
  | { readonly kind: 'draft_incomplete' }

export type _HeldEditRefusalHoldsNoText = AssertNoTextDeep<HeldEditRefusal>

/** The refusal, and the path it is about. `RefusedItem`'s shape. */
export interface RefusedHold {
  readonly refusal: HeldEditRefusal
  /** Null where the refusal is not about a field. */
  readonly path: FieldPath | null
}

export type HeldEditOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refused: RefusedHold }

/**
 * ⚠️ NO NUMBER, AND THIS IS NOT AN OVERSIGHT. `PRODUCT.md` forbids inventing
 * one, and the interval is a genuine trade the owner must make: it prices a
 * person's lost keystrokes against metered write volume
 * (`METERS.api_calls`, `model/billing.ts:83`) and against audit volume (§6.5).
 *
 * REQUIRED CONFIGURATION THAT REFUSES ON ABSENCE — the shape
 * `retentionWindowValid()` uses for `regulatoryMinimumDays`
 * (`model/domain.ts:1266`): the bound is a PARAMETER, never a model constant,
 * because a constant would be wrong for the second customer and stale for the
 * first. A null policy is `hold_policy_absent`, not a default.
 *
 * THERE IS EXACTLY ONE WINDOW AND IT IS NOT HERE. How long an abandoned draft
 * survives is `RetentionPolicy.days.held_edit` (§3.3). A second
 * `maximumOpenDraftAgeDays` on this interface would be two answers to one
 * question — §5.3.
 */
export interface HoldPolicy {
  readonly minimumHoldIntervalSeconds: number
}

/**
 * MAY THIS BODY BE HELD AT ALL?
 *
 * ⚠️ IT DOES NOT COMPARE CLASSES AND MUST NOT UNTIL THE LADDER IS UNIFIED.
 * It returns the set of classes the subject touches; the CEILING comparison
 * belongs to whoever holds the ceiling, using the one ladder that
 * `model/policy.ts:1692` owes. Comparing here would create a fifth copy of the
 * `DataClass` ordering inside the commit that exists to prevent divergence.
 *
 * `fieldClassification` IS SUPPLIED BY THE CALLER, exactly as
 * `AdmissionContext.fieldClassification` is (`model/reconciliation.ts:1010`) —
 * this module cannot see `FieldSpec`. ⚠️ AND THAT IS §5.2's SHAPE: a
 * caller-supplied parameter that could switch a check off by being empty. It is
 * safe HERE only because an EMPTY MAP REFUSES EVERY CLASSIFIED PATH rather than
 * admitting it — fail-closed, matching G100's deny-on-NULL and `DENY_ALL`. A
 * caller with a motive to weaken the check gains nothing by passing nothing.
 */
export function holdAdmissible(
  subject: HeldEditSubject,
  fieldClassification: ReadonlyMap<FieldPath, DataClass>,
): HeldEditOutcome<readonly DataClass[]>

/**
 * MAY THIS HELD EDIT BE REPLACED BY A NEWER BODY?
 *
 * A PRECONDITION CHECK, NEVER A MERGE. `advanceProcedureStep` names the stepId
 * it believes is current and is refused if it moved
 * (`docs/contracts/capability.openapi.yaml:903`); this names the sequence it
 * believes is current. There is no three-way merge and there will not be one:
 * merging two drafts of a journal produces a journal nobody wrote.
 *
 * ⚠️ THE STORE, NOT THIS FUNCTION, IS THE ENFORCEMENT. `ProcedureStepExecution`
 * records the rule verbatim (`model/domain.ts:3300`): *"enforce it in the store,
 * not in the caller, or `step_not_current` becomes a race against itself."*
 * This function exists so the REASON is a typed value; the guarantee is the
 * `AND sequence = $n` in §3.5.
 */
export function replaceAdmissible(
  held: HeldEdit,
  expectedSequence: number,
  policy: HoldPolicy | null,
  now: Timestamp,
): HeldEditOutcome<number>

/**
 * MAY THIS HELD EDIT BECOME AN ACT?
 *
 * It answers COMPLETENESS and COUNTERPART only. It does not authorise: that is
 * `decide()` then `authorize()`, at the seam, with the SESSION's principal — so
 * a draft held by someone who has since lost `approve_resolution` fails there,
 * for free (§1.1).
 */
export function submitAdmissible(
  held: HeldEdit,
): HeldEditOutcome<HeldEditSubject['kind']>
```

### 3.3 `model/domain.ts` — a fourteenth `RetentionClass`

**Insertion point:** inside `RETENTION_CLASSES` (`model/domain.ts:1086`), appended **after**
`trace` — appended, not inserted, because `tools/check-wire-mirror.mjs` compares the model list
against the wire enum **as sequences** (`tools/check-wire-mirror.mjs:12-17`).

```ts
  /**
   * Work a person held and never submitted — a drafted journal, an unsubmitted
   * rejection reason. ADDED <date> under the 9 Aug 2026 statelessness ruling.
   *
   * WHY A CLASS OF ITS OWN, WITH THE THREE REJECTED ALTERNATIVES PRESERVED:
   *
   *   `exception` — the tempting one, because the draft hangs off an exception.
   *   Refused: it keys the rule on a convenient landmark instead of the property
   *   it protects (§5.1). A draft is not a business record; it is work that was
   *   never a decision, and filing it as `business` retains a person's abandoned
   *   prose for the whole exception window. PDPA Retention Limitation is the
   *   cost, and it is the wrong direction to be wrong in.
   *
   *   `operational` — refused by that kind's own definition. `AUDIT_MUST_OUTLIVE`
   *   (`model/domain.ts:1165`) exempts operational rows because they are
   *   *"PII-free by construction (`PolicyReasonCode`, not prose)"*. A held
   *   rejection reason is prose. That sentence is the disqualifier.
   *
   *   `trace` — refused: telemetry lives in a backend with its own retention
   *   that we do not set, and this row lives in our database.
   *
   * `content` is the kind (see `RETENTION_RECORD_KIND` below): it holds prose
   * and values copied out of a document, which is what `source_document`,
   * `export` and `page_render` are. That places it UNDER the audit floor, which
   * is the conservative direction — a misclassification there lengthens the
   * audit window rather than shortening it.
   *
   * ⚠️ THIS MUST LAND BEFORE THE FIRST HELD ROW IS WRITTEN. `purgeAfter` is
   * computed from this policy at hold time and *"no migration can recompute what
   * the policy said at the time"* (`model/domain.ts:1062-1067`, on the same breaking
   * change made deliberately early for the same reason).
   */
  heldEdit: 'held_edit',
```

Plus, in `RETENTION_RECORD_KIND` (`model/domain.ts:1135`) — **required, or `tsc` fails**, because
that table is a total `Record<RetentionClass, RetentionRecordKind>`:

```ts
  held_edit: 'content',
```

Plus `docs/contracts/foundation.openapi.yaml`, `RetentionClass.enum`
(`:947-962`, `trace` currently last at `:962`) gains `- held_edit` **at the end**, or
`npm run check:wire` fails on the `retention_classes` pair (`tools/check-wire-mirror.mjs:99`).

⚠️ **The model already predicted this exact commit.** `model/domain.ts:1069-1071`:
*"`Record<RetentionClass, number>` is the whole point: the compiler demands a value for every class,
so **a fourteenth class is a compile error at every construction site** rather than a silently
unretained table."* That sentence is what makes §5's fixture the witness rather than a formality.

### 3.4 `model/governance.ts` — a twelfth `SubjectLocation` variant

**Insertion point:** end of the union (`model/governance.ts:1772`), after `bi_dataset`.

```ts
  /**
   * WORK A PERSON HELD AND NEVER SUBMITTED. THE TWELFTH VARIANT.
   *
   * WHY IT HAD TO EXIST, and it is the same hole three times over. This union's
   * own header says locations are *"Written at CREATION time, not discovered by
   * scanning. A scan cannot find a value inside a stored Explanation, and an
   * erasure design that depends on finding it later will quietly miss it"*
   * (`:1741-1744`). `blob`, `correspondence_message`, `notification` and
   * `bi_dataset` were each added because a copy of personal data was resting in
   * a channel nobody was indexing. A held rejection reason naming a
   * counterparty's employee is exactly that, in our own database, in a row this
   * union could not address.
   *
   * ⚠️ THE WIRE MUST MOVE IN THE SAME COMMIT. `foundation.openapi.yaml:901-933`
   * mirrors this union, and `:911-917` records what happens when it lags:
   * `notification` was missing there until 7 Aug, so a subject's name carried
   * out in an approval mail *"could be registered in the model and rejected at
   * the boundary — an erasure index the API will not accept a write to is an
   * erasure index with a hole in it."* `tools/check-wire-mirror.mjs:74` now
   * fails the gate on this pair, which is the difference between then and now.
   *
   * THE DISPOSITION IS NEVER `out_of_reach`. Unlike `notification`, `trace` and
   * a direct-query `bi_dataset`, this copy is ours, in our store, deletable — so
   * the plan must reach it and an honest plan cannot excuse it.
   */
  | { kind: 'held_edit'; heldEditId: HeldEditId }
```

`docs/contracts/foundation.openapi.yaml:923-933` gains `- held_edit` at the end of the enum.

### 3.5 The migration — `db/migrations/0002_held_work.sql`

Forward-only under G88; `0001` is never edited. Predicate copied verbatim from
`0001_tenancy_and_rls.sql` so there is one polarity, not two.

```sql
-- =====================================================================
-- 0002 — HELD WORK. The custody table for unsubmitted work.
--
-- RULINGS THIS APPLIES:
--   owner 9 Aug 2026  no process-local state a retry cannot reconstruct
--   G97   every branded id is `text`; the slug is stored VERBATIM
--   G100  the policy DENIES on NULL; migrations run as reconcile_migrator
--   G101  every query sits inside an explicit transaction carrying SET LOCAL
--   G88   forward-only. This file is never edited once applied.
--
-- 🛑 WHAT IS DELIBERATELY NOT HERE: an outbox column. A hold ships nowhere.
--    `UsageRecord` is the only stream in the model with an outbox shape
--    (docs/build/event-architecture-recommendation.md:275-289) and it is the
--    only one that needs one.
-- =====================================================================

CREATE TABLE held_edit (
  tenant_id       text        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  id              text        NOT NULL,
  author_user_id  text        NOT NULL,

  -- The subject, as JSONB. docs/persistence-design.md:252 — "a discriminated
  -- union or a recursive structure goes in JSONB. A foreign key does not."
  subject         jsonb       NOT NULL,

  -- GENERATED, NOT WRITTEN BY THE APPLICATION. Two columns the queue and the
  -- unique index need a WHERE on — the promotion §3 of that same document
  -- prescribes for `Exception.valueAtRisk` and `SubjectIndexEntry.subjectRef`.
  -- Generated rather than duplicated, so the column and the body CANNOT
  -- diverge; a CHECK asserting agreement would be a second place to be wrong.
  subject_kind    text        GENERATED ALWAYS AS (subject ->> 'kind')     STORED NOT NULL,
  anchor_id       text        GENERATED ALWAYS AS (subject ->> 'anchorId') STORED,
  anchor_path     text        GENERATED ALWAYS AS (subject ->> 'path')     STORED,

  sequence        integer     NOT NULL,
  max_data_class  text        NOT NULL,
  held_at         timestamptz NOT NULL,
  last_held_at    timestamptz NOT NULL,
  purge_after     timestamptz NOT NULL,
  purged_at       timestamptz,

  closure         jsonb       NOT NULL,
  closure_kind    text        GENERATED ALWAYS AS (closure ->> 'kind')     STORED NOT NULL,

  -- COMPOSITE, for the reason 0001 gives on `tenant_contact`: a bare `Id[]`
  -- cannot check that a reference is the SAME TENANT's.
  PRIMARY KEY (tenant_id, id)
);

-- ---------------------------------------------------------------------
-- ONE OPEN DRAFT PER (TENANT, AUTHOR, ANCHOR). This is the concurrency
-- control, and it is in the store because `ProcedureStepExecution`
-- (model/domain.ts:3300) says it must be: "enforce it in the store, not in
-- the caller, or `step_not_current` becomes a race against itself."
--
-- TWO TABS, ONE ARTIFACT: the second tab does not create a second row. It
-- finds the same row and therefore hits the `sequence` check below, which is
-- what turns a silent last-write-wins into a refusal with a reason.
--
-- `author_user_id` IS IN THE KEY DELIBERATELY. Two people holding two
-- rejection reasons against one proposal is `ApprovalConfig.quorum`'s normal
-- case, not a conflict.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX held_edit_one_open
  ON held_edit (
    tenant_id, author_user_id, subject_kind,
    coalesce(anchor_id, ''), coalesce(anchor_path, '')
  )
  WHERE closure_kind = 'open';

-- The retention sweep's driving index.
CREATE INDEX held_edit_purge ON held_edit (tenant_id, purge_after)
  WHERE purged_at IS NULL;

ALTER TABLE held_edit ENABLE ROW LEVEL SECURITY;
ALTER TABLE held_edit FORCE  ROW LEVEL SECURITY;

-- Predicate copied verbatim from 0001. One polarity, not two.
CREATE POLICY held_edit_rls ON held_edit
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON held_edit TO reconcile_app;
```

**The replace statement — the only way a body is ever changed:**

```sql
UPDATE held_edit
   SET subject        = $3::jsonb,
       sequence       = sequence + 1,
       last_held_at   = $4,
       purge_after    = $5,
       max_data_class = $6
 WHERE id             = $1
   AND sequence       = $2
   AND closure_kind   = 'open'
   AND purged_at IS NULL
RETURNING sequence;
```

- **No `tenant_id = …` term.** RLS is the enforcement; a second copy of invariant 1 in every
  statement is §5.3's shape, and G100's deny-on-NULL already makes a forgotten transaction empty.
- **Zero rows is ambiguous and must be disambiguated** — see §6.6, which is a finding, not a
  design note.

**The retention sweep — redact, do not delete:**

```sql
UPDATE held_edit
   SET subject   = subject - 'draft',
       purged_at = $now
 WHERE purge_after <= $now
   AND purged_at IS NULL;
```

`subject - 'draft'` removes every personal value and leaves `kind`, `anchorId` and `path`, so
the generated columns stay valid and the row survives as a tombstone — the
`SourceDocument.purgedAt` discipline (`model/domain.ts:1862`: *"the row survives as a tombstone for
audit"*). **This is why `draft` is a nested key rather than inline fields.** A purged row no longer
satisfies `HeldEditSubject`, which is correct and intended: the reader returns
`{ ok: false, refused: { refusal: { kind: 'purged' }, path: null } }`, never a `HeldEdit` with a
null body — a nullable body would make *(open, body null)* legal, which is §5.5.

---

## 4. What each declaration REFUSES, and what fails closed

| Declaration | Refuses | Fails closed because |
|---|---|---|
| `HeldEditId` brand | A held draft named where a `ProposalId` is required | `Id<T>` brands are nominal (`model/kernel.ts:43`). Every `ExceptionResolution` arm needs a `ProposalId`, so **an unapproved draft is not constructible as an effect** — no runtime check involved. |
| `HeldEditSubject` (one union) | A body against the wrong anchor | Unrepresentable. §5.5 applied before the defect. |
| `HeldDisposition` etc. (`Omit` + `Partial`) | A draft that carries `id`, `tenantId`, `proposedBy` or `proposedAt` | The fields do not exist. Promotion by `{ ...draft, id: myId }` does not compile — `model/presentation.ts:197`'s argument. |
| `AssertNoCommittedId` | Somebody re-adding `id` to the `Omit` list | TS2344 at build time, in `npm run check`'s first step. |
| `AssertUnauthorised` | An `authorizationId` on a held body | TS2344. Invariant 10 expressed as an absence that is checked. |
| `HeldEditClosure` | *(submitted AND discarded)*; an open draft carrying an authorisation | Unrepresentable — the grant is on the `submitted` arm only. |
| `holdAdmissible` | A subject naming a path with **no `FieldSpec`** | G106 fail-closed, matching `admitPopulation`'s four refusal sites (`model/reconciliation.ts:1015,1030,1044,1062`). An **empty** classification map refuses everything rather than admitting everything — the §5.2 escape hatch is shut by polarity. |
| `holdAdmissible` | Comparing a class against a ceiling | It **refuses to do it**, because doing it would be the fifth copy of an ordering `model/policy.ts:1692` already owes a unification for. A refusal to build the wrong thing is a control. |
| `replaceAdmissible` + `AND sequence = $2` | A stale write clobbering a concurrent edit | Zero rows updated → `not_current` with `currentSequence`. **Never a merge, never last-write-wins.** |
| `held_edit_one_open` | Two open drafts by one author on one anchor | A unique constraint, in the store, per `ProcedureStepExecution`'s rule. |
| `submitAdmissible` | Submitting a `field_confirmation` | `no_committed_counterpart`, unconditionally — the un-buildable path is loud instead of absent. |
| `submitAdmissible` | Submitting an incomplete draft | `draft_incomplete`. `Partial` moved the completeness check to the seam where it can name what is missing. |
| `HoldPolicy \| null` | A hold with no configured interval | `hold_policy_absent`. A bound with no number is not a bound. |
| `RetentionPolicy.days.held_edit` | A tenant policy that has no answer for held work | **Compile error at the construction site** — `PLACEHOLDER_RETENTION_POLICY` (`model/examples.ts:534`) fails to compile, which is the difference between this and the §5.10 shape. |
| `SubjectLocation.held_edit` | An erasure plan that cannot reach held work | The variant exists, so the plan can name it; `tools/check-wire-mirror.mjs:74` fails the gate if the wire does not accept a write to it. |
| `HeldEditRefusal` + `AssertNoTextDeep` | A refusal carrying a counterparty string into a log or a span | TS2344. `RefusedHold` carries the path beside the refusal, as `RefusedItem` does. |
| RLS policy on `held_edit` | A retry on another node reading another tenant's draft | G100 deny-on-NULL: an empty result set, not a cross-tenant read. |

---

## 5. The fixtures, and why `tsc` alone would tell nobody anything

§5.10 is explicit: *"a total record only bites where something CONSTRUCTS one. In a types-only
model nothing does."* Five total records landed on 7 Aug with no construction site and the compiler
could not have failed on a single field chosen. Every declaration above therefore ships with a
value in the **same commit**.

**In `model/examples.ts`:**

1. **`PLACEHOLDER_RETENTION_POLICY` (`:534`) gains `held_edit: PLACEHOLDER_RETENTION_DAYS`.**
   This is the witness that matters and it goes **RED before it goes green**: adding the fourteenth
   class without this line is `TS2741: Property 'held_edit' is missing in type …`. Unlike 7 Aug,
   this construction site now exists — which is exactly why the fourteenth class is checkable at
   all. `retentionWindowValid()` must still accept the result: uniform windows satisfy the audit
   floor for all nine business and content classes, and `held_edit` is `content`, so the fixture
   stays a *valid* policy and not merely a compiling one (the property `:527-531` argues for).

2. **`acmeHeldRejectionReason: HeldEdit`** — the `approval_decision` arm, every field populated,
   with `closure: { kind: 'open' }`. It is the artifact `Login.dc.html:173` promises, as a value.
   Without it, adding a required field to `HeldEdit` fails nothing.

3. **`acmeHeldDraftJournal: HeldEdit`** — the `exception_disposition` arm with
   `draft.adjustment` a real `Money`. This is the fixture that will go red when G65's `bigint`
   retype lands, which is the point: it proves the retype reaches held work through the `Omit`.

4. **`acmeHeldEditLocation: SubjectLocation`** — beside `acmeBiDatasetLocation` (`:1168`), which
   exists precisely because *"nothing in `model/` constructs a `SubjectLocation`, so the compiler
   had nothing to check it against"* and `RegionKey` could not name Sydney for an hour with `tsc`
   green (`model/domain.ts:466-471`).

5. **`PLACEHOLDER_HOLD_POLICY: HoldPolicy`** — named `PLACEHOLDER_` for the reason
   `model/examples.ts:500-504` gives: *"Two fixtures carry governed numbers this repository is
   explicitly not the authority for; both are named `PLACEHOLDER_` so no reader and no call site
   can mistake one for a position."* This is a third.

**In `tests/model/held-work.test.ts`** (new; `node --test`, per `package.json`'s `test` script):
constructed subjects for all four arms, a classification map both with and without the path, and
the sequence-precondition cases.

**In `tests/db/held-work-concurrency.test.ts`** (new): the two-tab test, against the disposable
Postgres `db/provision.ts` sets up, in the shape of `tests/db/tenant-isolation.test.ts`.

**Why `tsc` alone proves nothing here, concretely.** Every declaration in §3.2 is a type. Nothing
assigns to `HeldEdit`, nothing calls `holdAdmissible()`, nothing constructs a `HeldEditSubject`.
A green `tsc` after adding all of it would mean the syntax parsed. The four assertions
(`AssertNoCommittedId`, `AssertUnauthorised`, `_HeldEditRefusalHoldsNoText`, and
`AssertAnswersEveryRetentionClass` via the fixture) are the only things a compiler can check, and
three of the four are shape-only. **The fixtures are the content.**

---

## 6. The mutations that prove each control bites

Each is a one-line change, its expected failure, and the command that surfaces it. Run each, then
revert. Accept a red run only when the named error is the **only** error — a TS6133 or TS6196
alongside means `noUnusedLocals` produced it, which is the trap `model/domain.ts:3886` records.

| # | Mutation | Expected failure | Surfaced by |
|---|---|---|---|
| 1 | `AssertNoCommittedId<ResolutionProposal>` substituted for `<HeldDisposition>` | `TS2344: Type 'ResolutionProposal' does not satisfy the constraint 'CarriesNoCommittedId<ResolutionProposal>'. Types of property 'id' are incompatible. Type 'ProposalId' is not assignable to type 'never'.` | `npm run typecheck` |
| 2 | Drop `'id'` from `HeldDisposition`'s `Omit` list | Same TS2344, naming `HeldDisposition`. **This is the mutation the assertion exists for** — nobody retypes an assertion; somebody adds a field. | `npm run typecheck` |
| 3 | Add `authorizationId: AuthorizationGrantId` to `HeldFieldConfirmation` | `TS2344 … Types of property 'authorizationId' are incompatible. Type 'AuthorizationGrantId' is not assignable to type 'never'.` | `npm run typecheck` |
| 4 | Delete `held_edit: …` from `PLACEHOLDER_RETENTION_POLICY` | `TS2741: Property 'held_edit' is missing in type … but required in type 'Record<RetentionClass, number>'` | `npm run typecheck` |
| 5 | Delete `held_edit: 'content'` from `RETENTION_RECORD_KIND` | Same TS2741 against `Record<RetentionClass, RetentionRecordKind>` | `npm run typecheck` |
| 6 | Add `{ kind: 'field_not_classified'; path: FieldPath }` (a string) to `HeldEditRefusal` | `TS2344 … does not satisfy the constraint 'NoTextDeep<HeldEditRefusal>' … Type 'string' is not assignable to type 'never'` | `npm run typecheck` |
| 7 | Add `- held_edit` to `RetentionClass` in the model but **not** to `foundation.openapi.yaml` | `check:wire` reports `drift` on the `retention_classes` pair and **exits 1** | `npm run check:wire` |
| 8 | Add the `SubjectLocation` variant but not the wire enum | `drift` on `subject_location`, **exit 1** | `npm run check:wire` |
| 9 | Insert `held_edit` in the **middle** of either enum instead of appending | `drift`, because the checker compares as sequences: *"Equal sets in a different order are still reported"* (`tools/check-wire-mirror.mjs:14-17`) | `npm run check:wire` |
| 10 | Add the 19th module and leave `docs/HANDOFF.md:225` at 18 | `STALE` on the modules line, **exit 1** | `npm run check:counts` |
| 11 | Pass an **empty** `fieldClassification` map to `holdAdmissible()` with a subject naming a path | `{ ok: false, refused: { refusal: { kind: 'field_not_classified' }, path } }`. **If it returns `ok: true`, the G106 gate has inverted.** | `tests/model/held-work.test.ts` |
| 12 | Remove `AND sequence = $2` from the replace statement | Two-tab test: the second write must return `not_current`. Without the term it returns `ok` and the first tab's journal is silently gone. | `tests/db/held-work-concurrency.test.ts` |
| 13 | Drop `held_edit_one_open` | Two concurrent inserts by one author on one anchor both succeed; the test asserting one open row fails. | same |
| 14 | Change `closure_kind = 'open'` to `closure_kind <> 'submitted'` in the index predicate | A discarded draft blocks a new one; the "discard then start again" test fails. | same |
| 15 | Run the replace statement outside `withTenantScope()` | Zero rows (G100 deny-on-NULL). ⚠️ **Indistinguishable from `not_current`** — see §7.6. The test must assert the *distinguisher*, not the row count. | same |
| 16 | Call `submitAdmissible()` on a `field_confirmation` | `no_committed_counterpart`. If it returns `ok`, a person's reading is about to enter a ledger through a path with no capability and no event type. | `tests/model/held-work.test.ts` |
| 17 | Pass `policy: null` to `replaceAdmissible()` | `hold_policy_absent`. If it defaults to any number, a number has been invented. | same |
| 18 | Populate `subject.draft` and run the purge sweep | `subject - 'draft'` leaves `kind`/`anchorId`; `subject_kind` and `anchor_id` are unchanged; the reader returns `{ kind: 'purged' }` and never a `HeldEdit`. | `tests/db/held-work-concurrency.test.ts` |

⚠️ **Rows 12–15 and 18 need a live PostgreSQL. There is none in this repository** — G101 puts phase
one on a disposable one, `db/provision.ts` creates it, and I did not run it (analysis only). **The
generated-column and partial-index syntax above is therefore NOT VERIFIED against a running
server.** If PostgreSQL refuses a partial-index predicate on a generated column, the fallback is an
`is_open boolean NOT NULL` column written by the application with
`CHECK (is_open = (closure_kind = 'open'))` — one extra column and one extra place to be wrong,
which is why it is the fallback and not the design.

---

## 7. The COST of the ruling on this surface, stated plainly

### 7.1 Reads and writes added per request

Derived from `db/tenant-scope.ts`, not estimated. Every scoped transaction is
`BEGIN` → `SELECT set_config(...)` → the work → `COMMIT`. So **one autosave is four round trips
minimum, of which three are overhead**, and a debounced editor makes that per debounce interval.
A draft-bearing screen also adds **one read** on open (load the held row) that it does not make
today. On a conflict the replace costs **two** statements, not one, because zero rows is ambiguous
(§7.6).

### 7.2 Latency

`subject` is JSONB read whole, keyed by `(tenant_id, id)` — the persistence-design shape, so no
scan. The cost is not query time; it is that **the interactive path now has a database write in it**
where before it had none, inside a transaction, on a pooled connection under G101's
transaction-mode assumption. That is the shape the ruling asks for and it is not free.

### 7.3 A decision it makes irreversible

**The fourteenth `RetentionClass` must land before the first held row is written.** `purgeAfter` is
computed at hold time and `model/domain.ts:1062-1067` records why that cannot be fixed later: *"every row
already written carries a date derived from the old shape and no migration can recompute what the
policy said at the time."* Same for the twelfth `SubjectLocation` variant: locations are *"Written at
CREATION time, not discovered by scanning"* (`:1741`), so a held row created before the variant
exists is **permanently outside the erasure index**. Both are cheap now and unrecoverable later.

### 7.4 It needs a number nobody has, and a window counsel owns

`RetentionPolicy.days.held_edit` is the fourteenth of thirteen windows that `docs/HANDOFF.md:2139`
already records as *"counsel's"*. The autosave interval is the owner's. **Neither is inventable
here** and both are expressed as configuration that refuses on absence.

### 7.5 Metering — the ruling turns typing into billable volume

`METERS` (`model/billing.ts:75`) is eight members and its own comment says *"Deliberately few: every
meter is something a customer can verify independently."* A hold is an API call, so **it meters as
`api_calls` and needs no new meter.** But:

- `Mockups/rec/Confirm.dc.html` promises *"confirming spends nothing — only the machine's work is
  counted"*, and `docs/screen-pack-ledger.md` §3.3 records that as *"a metering rule with no
  representation — `UsageRecord` is immutable and unpriced by invariant 5, and **nothing marks an act
  as non-metered**."*
- So under the ruling, **a person typing a 400-character rejection reason generates however many
  `api_calls` the debounce produces**, and there is no way to mark them non-metered. That is a
  commercial consequence of a technical ruling and it is the owner's to accept or refuse.

**A hold does NOT mint an `AuthorizationGrant`, and it is NOT audited.** Both are deliberate and
both are costs:
- Not a grant, because `MAX_AUTHORIZATION_SECONDS.tenant_data = 900` (`model/access.ts:1530`) and a
  draft lives for days; a grant covering it would be the first long-lived grant in the system, which
  is the exposure G75's argument is about.
- Not audited, because `AuditEvent` is `business` kind under `AUDIT_MUST_OUTLIVE`
  (`model/domain.ts:1165-1172`) and therefore the longest-retained class in the system. An audit row
  per keystroke-debounce makes the audit trail unreadable, which is §5.6 read from the other side.
- **The accepted cost:** a hold is a write of personal data into the tenant's database that no audit
  row records. The capability is still checked (`propose_resolution` / `approve_resolution`, both
  `tenant_data` at `model/access.ts:568,572`); only the *record* is absent.

### 7.6 A defect the ruling creates, and its fix is free

**G100's deny-on-NULL and optimistic concurrency produce the SAME observable — zero rows.** A
forgotten transaction (leak MODE 2, `db/tenant-scope.ts:20-27`) yields an empty result set; so does a
stale `sequence`. So a tenancy bug would be reported to a user as *"someone else edited this"*, which
is the most misleading possible presentation of the most serious possible bug.

**The fix costs nothing and is one line in a built file.** `db/tenant-scope.ts:123` discards the
result of `SELECT set_config($1, $2, true)` — and `set_config` **returns the value it set**. Read it
back and refuse if it does not equal `tenantId`. Zero extra round trips, and the two failures become
distinguishable at the only place that can distinguish them. I am not applying it (analysis only);
it belongs in its own commit.

### 7.7 G-row collisions — the owner's to resolve, not mine

**7.7a — G120, and it is the big one.** `docs/HANDOFF.md:846` puts the reader orchestration in *"a
data-plane state machine, a DISTRIBUTED-MAP fan-out of single-record readers, and a fan-in that folds
through `applyReaderVerdicts()`"*. **A Step Functions execution holds its state in AWS, not in
PostgreSQL.** Under a literal reading of the ruling — *"everything that carries state … must be
committed to the database"* — that is a violation. Under the reading in the task framing — *"no
process-local state another node or a retry cannot reconstruct from durable storage"* — Step
Functions is durable and G120 complies. **The two readings differ on the largest piece of
architecture in the phase-one plan**, and only the owner can say which governs. Nothing in §3
depends on the answer; G120 does entirely.

**7.7b — G39 versus G106.** `Mockups/rec/Finding.dc.html:347`: the rejection reason *"is captured as
prose … and the agent immediately offers to amend the SOP clause it contradicts."* That is G39
`amendProcedure`, and it **reads a held prose field into a prompt**. G106 rules that a key with no
`FieldSpec` is UNREADABLE — *"stored, but unaddressable by any agent, prompt, export or dashboard"* —
and a user-typed rejection reason has no `FieldSpec`. So the sharpest interaction in the screen pack
requires a read that the classification ruling forbids. ⚠️ **This is pre-existing, not created by
me**: the same is true of the *submitted* `ApprovalDecision.reason`. Held work is simply where it
bites first, because the draft is what the amendment reads.

**7.7c — G43, sharpened.** A draft makes it easier to assemble a split order across two proposals
before either is visible to an approver. G43's recommended mitigation — a shared correlation id —
is recorded as *"still NOT taken and remains the first thing to reach for"* and blocked by nothing.
Drafts do not create the bypass; they lower its cost.

**7.7d — G41.** A held draft of a diagnostic bundle would be the consent record G41 knowingly
skipped, held in our database before the tenancy approved anything. Out of scope here; do not build
arm five without reopening G41.

### 7.8 D1 blocks all of it

Every declaration above needs a session: `tenantId` (invariant 1, derived from the session, never
from a request) and `authorUserId`. `docs/HANDOFF.md:0a` names D1 *"the widest open gate by some
distance"* and nothing issues a session. **This surface cannot be reached before D1**, exactly like
everything else with a wire.

### 7.9 An owed cleanup becomes a prerequisite

`HeldEdit.maxDataClass` cannot be computed without the single `DataClass` ladder, and
`model/policy.ts:1692-1704` already records four copies of it and the conditions for unifying them
(*"as its own commit, with `mayAdmit()` under test first"*). **That commit is now a blocker for a
feature**, which is a real cost of this ruling: it converts an owed tidy-up into a dependency.

---

## 8. What I did NOT solve, and what it is blocked on

| # | Not solved | Blocked on |
|---|---|---|
| 1 | **The confirmed-field arm cannot be submitted.** Four absences: no capability names the act, no operation performs it, the value has no committed home, the event type does not exist (`docs/screen-pack-ledger.md` §3.3, §4 row 4). Minting a capability is a platform release. | An owner decision (§9 Q4). The draft is held; the promotion refuses. |
| 2 | **The in-flight Ask turn.** `AskTurn.answer` is `string`, non-nullable, so a turn that was asked and not answered has no representation — and if a node dies after the model call, the tokens are metered and the transcript has no turn. This is an **in-flight act**, not held work, and it belongs to the two-phase intent-row pattern already ruled for notifications. | A different surface. Named so it is not lost. |
| 3 | **The uploaded-but-not-admitted file.** `SourceDocument` has no status field and is written after extraction. Bytes interrupted mid-upload have no row. | The ingestion-pipeline surface, and G120's control set. |
| 4 | **`ReconciliationDefinition.status` has no reader.** `grep -rn "status === \|status !== " model/*.ts` returns five readers, none of them a definition or a procedure — so nothing refuses to execute a draft definition. My §3.0 argument (a status field is safe where something else refuses) is therefore true of the *design* and not yet of the *tree*. | Its own finding; not mine to fix here. |
| 5 | **The single `DataClass` ladder.** §7.9. | `model/policy.ts:1692`, as its own commit, with `mayAdmit()` under test first. |
| 6 | **Whether zero rows means "conflict" or "no tenant scope".** §7.6 has the free fix; I did not apply it. | A one-line commit to `db/tenant-scope.ts`. |
| 7 | **Verification against a live PostgreSQL.** Generated columns and the partial index are unverified; §6 names the fallback. | G101's disposable Postgres, which is not provisioned in this repository. |
| 8 | **The wire.** No operation holds, replaces, submits or discards a draft, and there is no `administration.openapi.yaml`. A new `ErrorCode` — `held_edit_not_current`, beside `step_not_current` at `docs/contracts/errors.yaml:130` — moves the governed error-code count 71 → 72. | `docs/HANDOFF.md` §8 item 3, and D1. |
| 9 | **Whether a draft is inside the PDPA access and correction obligations.** I can make it *reachable* (`SubjectLocation.held_edit`, and `DataSubjectRequest` exists at `model/domain.ts:4052`); I cannot rule on whether unsubmitted work is *in scope* for access and correction as against erasure. That is a ⚖️ counsel question and I will not answer it. | Counsel (§9 Q5). |

---

## 9. Owner rulings this needs before it can be built, as questions

1. **Which reading of the statelessness ruling governs — "in PostgreSQL" or "durable somewhere a
   retry can reach"?** G120 puts the reader fan-out's state in a Step Functions execution, which is
   durable and is not our database. The literal reading forbids it; the operational reading permits
   it. Nothing else in the phase-one plan turns on the difference and G120 turns on it entirely.
2. **Is autosave a metered act?** A hold is an API call, so today it is `api_calls`. Nothing marks an
   act as non-metered, and `Confirm.dc.html` already promises *"confirming spends nothing."* Either
   holds are metered and typing has a unit price, or something must mark an act non-metered — which
   is a new field on the metering path and therefore invariant 5's business.
3. **What is `minimumHoldIntervalSeconds`?** It prices lost keystrokes against write volume, audit
   volume and metered volume. I will not invent it; without it every hold refuses.
4. **Is the confirmed-field act in v1?** If yes, it needs a capability (a platform release — the
   38th), an operation, a home for name + time + region + the machine's reading, and a distinct
   event type. If no, arm three of `HeldEditSubject` should not be declared at all, because a draft
   with no promotion path is a promise the product cannot keep.
5. ⚖️ **Counsel: does unsubmitted work fall inside PDPA access and correction, and not only
   erasure?** And **what is `days.held_edit`** — the fourteenth of the thirteen windows
   `docs/HANDOFF.md:2139` already assigns to counsel.
6. **Does an audit row per hold exist?** I have ruled it does not, on volume grounds, which leaves a
   write of personal data with a capability check and no record. If that is unacceptable, the answer
   is not "audit every hold" but a coarser record — one row per draft lifetime rather than per hold,
   which is G121's *"one grant per RUN, ordinals throughout"* argument transplanted, and it is the
   owner's to take.
7. **Does G39's SOP amendment read held prose?** If yes, G106's unreadable-by-default rule needs an
   explicit exception for user-authored prose, argued at the point of use the way the usage-event
   stream's `tenantRef` argues its exception to invariant 1. If no, the sharpest interaction in the
   screen pack loses its input and the screen needs redrawing.

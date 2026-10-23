# GREEN — the correction / re-parse path

*Answers §8 item 3 of `ingest-review-4-ac48b9a12e86f27db.md`: "Nobody designed correction."*

> **Analysis and design only.** No file in `/Users/jrkphani/Projects/Reconcile` was edited, created or
> deleted; no git command was run. **Every `file:line` below was opened in this session at
> `f988f2a4`.** Where a citation in the adjudication has moved, the new line is given and the old one
> is named — the adjudication's own §9 discipline.
>
> **Inputs I do not relitigate:** R1–R5, A1–A8, C1–C21, O-1–O-8, and every G row in
> `docs/HANDOFF.md` §3.

---

## 0. The verdict in one paragraph

**Correction is not a new subsystem. It is `LearningRetraction` + `ErasurePlan` + `ExceptionReversal`
+ `RunTrigger.rerun` composed in that order, and all four already exist with their arguments already
written.** The record has decided every hard question this problem asks, in four separate places, for
four other objects: *undoing a promotion takes one person because narrowing is automatic*
(`model/learning.ts:1176-1186`); *the undoing is a RECORD, not a mutation*
(`model/learning.ts:1243-1247`); *it does not reach what the entry already caused*
(`RETRACTION_UNMAKES_DOWNSTREAM = false`, `model/learning.ts:1240`); *a plan that admits what it
cannot reach is worth more than one that reports success* (`model/governance.ts:1954-1957`); and *a
reversal because the underlying data was corrected does not indict the autonomy that produced it*
(`reversalIndictsAutonomy`, `model/domain.ts:2920-2922`, with `'data_corrected'` already a member of
`ReversalReason` at `:2906` **and already a member of `RunTrigger.rerun.reason` at `:2763`**).
**Nobody joined them.** What is genuinely missing is four things: a capture ledger so the old
extraction is not overwritten, one field on `ReconciliationRun`'s inputs projection so the blast
radius is enumerable at the RUN grain (C8 gives only the DOCUMENT grain), one member on
`ExceptionStatus`, and a replay key that is not `requestOrdinal` — because **G120's stated persistence
key mis-attributes a stored verdict to the wrong item after any change to the residue, which
correction guarantees.**

---

## 1. What already exists that this reuses

Every row was opened. The right-hand column is the sentence the design leans on, quoted.

| # | Existing thing | `file:line` | What it already decides for me |
|---|---|---|---|
| 1 | `ReversalReason` incl. `'data_corrected'` | `model/domain.ts:2900-2910` | *"The underlying data changed afterwards. Does not indict."* — the correction vocabulary is closed and already has its arm |
| 2 | `reversalIndictsAutonomy()` | `model/domain.ts:2920-2922` | Returns `false` for `data_corrected`. **A mass correction cannot strangle the autonomy loop** — the failure mode nobody costed |
| 3 | `ExceptionReversal.reversedBy: UserId` | `model/domain.ts:2924-2928` | *"Always a human. A reversal is a correction, and corrections are signed."* The signing rule is already written for this exact act |
| 4 | `Exception.reversals: ExceptionReversal[]` | `model/domain.ts:3028-3033` | Array not flag — *"resolved, reversed, re-resolved and reversed again"*. A twice-corrected exception is already representable |
| 5 | `RunTrigger.rerun` `reason: 'data_corrected'` | `model/domain.ts:2763` | The terminal act of the correction path **already exists with the right literal.** No new trigger arm |
| 6 | `ReconciliationRun.definitionVersion` | `model/domain.ts:2703-2704` | *"Pins the definition as it stood, so a re-run is distinguishable."* The pin-the-version-on-the-record precedent |
| 7 | `Exception.ruleVersion` / `definitionVersion` | `model/domain.ts:2940-2943` | Same precedent, twice more |
| 8 | `Exception.carriedForwardFrom` | `model/domain.ts:2946-2952` | Cross-run exception identity already exists, *"so resolved-then-recurred is indistinguishable from never-resolved"* is already solved |
| 9 | `LearningRetraction` | `model/learning.ts:1249-1273` | *"A retraction is a RECORD, not a mutation. The entry keeps its row and its provenance."* — the whole shape of undoing a promotion |
| 10 | `RETRACTION_UNMAKES_DOWNSTREAM = false` | `model/learning.ts:1240` | *"Retraction stops FUTURE reads of the entry. It does not reach what the entry already caused."* The honest limit, already named |
| 11 | `RetractionMode = 'suspend' \| 'retract'` | `model/learning.ts:1222` | *"stop this now, decide later"* — the two-speed shape a mapping correction needs at 3 a.m. |
| 12 | `mayRetractLearning()` | `model/learning.ts:1286-1313` | One actor, **same capability as promotion**, org-class gate, refuses on a non-live entry. Copied structure, not copied code |
| 13 | The one-person-to-undo argument | `model/learning.ts:1176-1186` | *"Promotion WIDENS what the system does unattended; retraction NARROWS it… narrowing is automatic and widening is an act."* Cites `recommendAutonomyCeiling()` and `purgeVerdict()` as the two prior holdings |
| 14 | `ErasurePlan` / `ErasurePlanItem` | `model/governance.ts:1959-1979` | An enumerated plan over located subjects, `status: … \| 'partially_completed'`, per-item disposition **including `out_of_reach`** |
| 15 | `ErasurePlan`'s docblock | `model/governance.ts:1951-1958` | *"an erasure plan that admits what it cannot reach … is worth more than one that silently misses it and reports success."* This is the correction plan's whole design principle, already written |
| 16 | `SubjectLocation`, 11 variants | `model/governance.ts:1772-1806` | `source_document`, `match_group_key`, `explanation_observed`, `blob`. **The blast radius of a wrong mapping is the erasure index's own location set.** Reused UNCHANGED |
| 17 | `purgeVerdict()` | `model/governance.ts:1923-1949` | HOLD > MINIMUM > ERASURE > MAXIMUM, executable. The retention/erasure gate on correction is this function, called, not a second ladder |
| 18 | `LegalHold` | `model/governance.ts:1900-1911` | Kept in v1 deliberately (`:1891-1899`) precisely so `purgeVerdict()`'s first branch is real |
| 19 | `RecordChain` | `model/governance.ts:1110-1120` | `sequence` / `previousHash` / `bodyHash` |
| 20 | `ChainAnchor` | `model/governance.ts:1138-1153` | *"we can prove the chain changed, not what it used to say"* |
| 21 | `chain: RecordChain` appears **twice in `model/`** | `model/domain.ts:3939`, `model/governance.ts:1158` | **Verified by `grep -rn "chain: RecordChain" model/*.ts`.** Only `AuditEvent` and `DataAccessEvent` are chained. §2.1 turns on this |
| 22 | `AuditEvent.before / after: Json \| null` | `model/domain.ts:3992-3993` | A mutation *can* be recorded — but nothing forces it, and §2.1 shows why that is not enough |
| 23 | `AUTHORIZATION_MAY_BE_ABSENT` | `model/governance.ts:1232-1238` | One kind may leave `authorizationId` null: `system`. A recapture is not `system` |
| 24 | `authorizationIsWellFormed()` | `model/governance.ts:1254` | Write-time gate, returns false rather than throwing |
| 25 | `checkPostconditions()` | `model/reconciliation.ts:2681-2730` | The partition-over-the-item-set shape my correction post-conditions copy |
| 26 | `PostconditionFailure` — counts only, no text | `model/reconciliation.ts:2640-2648` | Every arm is `{ kind; count }` or two numbers. Copied exactly |
| 27 | *"The load-bearing post-condition is RESIDUE COMPLETENESS, not conservation"* | `model/reconciliation.ts:1164-1172` | The lesson I apply one layer up: for correction it is **POPULATION IDENTITY, not conservation** |
| 28 | G123's pre-engine-filter argument | `model/reconciliation.ts:2981-2990` | *"A record removed before admission is in neither total, so removing it breaks nothing and is caught by nothing."* This is why the unit of correction is the RUN |
| 29 | The append-only-ledger lesson | `model/reconciliation.ts:1156-1163` | *"ALLOCATION STATE LIVES IN AN APPEND-ONLY LEDGER, NEVER AS A MUTABLE FIELD ON AN INPUT RECORD."* Applied to `SourceDocument.extracted` |
| 30 | `ObservedValue.scalar` + its docblock | `model/domain.ts:2788-2807` | *"Explanation outlives the document it was drawn from … so purging the source does not remove this copy."* **This is why `Exception` survives a recapture intact** |
| 31 | `MatchGroup.keyValues` / `.members` | `model/domain.ts:2768-2770` | `keyValues` is a copy; `members` is `Record<SlotName, SourceDocumentId[]>` — references only, at DOCUMENT grain |
| 32 | `ReconciliationRun.inputs` | `model/domain.ts:2718` | `Record<SlotName, SourceDocumentId[]>` — the run→document edge, **as a map of arrays** |
| 33 | `ItemRef` / `itemKey()` | `model/reconciliation.ts:785-813` | `(sourceDocumentId, lineIndex)`. Why a recapture must NOT mint a new `SourceDocumentId` |
| 34 | `Allocation`, `MatchingState` | `model/reconciliation.ts:1198-1211` | No `id`, no `TenantScoped`, no writer. §2.2 |
| 35 | `buildReaderRequests()` | `model/reconciliation.ts:2392-2431` | `requestOrdinal: requests.length` at `:2423` — a **position** in an iteration over the residue |
| 36 | `ReaderRequest` | `model/reconciliation.ts:2194-2202` | Carries no `Money`, therefore canonicalisable |
| 37 | `canonicalise()` | `model/canonical.ts:137` | G20, applied 9 Aug. **REFUSES `bigint`** — which is why §5 checks `ReaderRequest` for `Money` first |
| 38 | `AssertNoTextDeep` / `NoTextField` | `model/reconciliation.ts:248-258` | `string extends T ? never` — plain `string` banned, literal unions pass. §3 turns on this |
| 39 | `ProcedureStepExecution`'s currency rule | `model/domain.ts:3294-3300` | *"at most one row per (tenantId, exceptionId) may have `endedAt === null`. That uniqueness IS the concurrency control — enforce it in the store, not in the caller."* The exact precedent for one live capture per document |
| 40 | `Exception.costCentre` / `legalEntity` | `model/domain.ts:2968-3019` | The E2 projection precedent: *"A control that looks present and is absent is worse than an absent one"*, and *"DONE NOW BECAUSE IT IS CHEAPEST NOW"* — the argument for the run→document projection |
| 41 | `CAPABILITIES` — 37 members | `model/access.ts:251` (`trigger_run` at `:49` of the block, `reverse_resolution` at `:66`) | Derived: `awk '/^export const CAPABILITIES = \{/,/^\} as const/' model/access.ts \| grep -cE '^  [a-zA-Z]+:'` → **37** |
| 42 | `CAPABILITY_RESOURCE_CLASS.trigger_run = 'configuration'` | `model/access.ts:611` with the argument at `:606-610` | *"Running a configured job is an act on configuration, not a read of the result."* The corrected rerun needs no new verb |
| 43 | `CAPABILITY_RESOURCE_CLASS.reverse_resolution = 'tenant_data'` | `model/access.ts:576` | Reversing a resolution needs no new verb either |
| 44 | `CONTRACT_ONLY_RESOURCES = ['authority']` | `model/governance.ts:~515` (block read at `490-520`) | Why `authority` is the class that keeps a standing FDE delivery grant out of recapture |
| 45 | `REQUIRES_ENUMERATION = { delivery: ['tenant_data'], incident: [] }` | `model/governance.ts:497-503` | C15's mechanism, reused for the recapture READ with no new machinery |
| 46 | `mayPromoteLearning()` | `model/learning.ts:1142-1164` | Capability first, then org class, then self-approval. Ordering argued at `:1128-1133`. Copied ordering |
| 47 | `resolveManagedService()` | `model/policy.ts:1781` | Exists as of `f988f2a4`; **no production caller**. Recapture of a `scanned` document is a caller |
| 48 | `ManagedServiceRejection` | `model/policy.ts:1726-1748` | Discriminant is **`reason`**, not `kind`, and `feature_not_permitted.permitted` is `readonly string[]` |
| 49 | `ACQUISITION_FIDELITY` | `model/domain.ts:1782-1793` | `tabular` = *"CSV or spreadsheet against a known column mapping. Parsed."* — the tier a mapping correction affects, and the only one that is free to redo |
| 50 | `SourceDocument` | `model/domain.ts:1840-1864` | `storageRef`, `purgeAfter`, `purgedAt`. The three fields the plan reads to decide `out_of_reach` |
| 51 | The word **capture** | `model/domain.ts:1761-1762` | *"so capture never becomes a second inbox."* The product's own noun for producing `SourceDocument.extracted` |
| 52 | `identity.ts` totality proofs | `model/identity.ts:213`, `:502`, `:958`, `:962` | Every new `Id<'X'>` needs an `interface X` with `id: XId`, or these go red |
| 53 | `ExceptionStatus` — **7 members, no `superseded`** | `model/domain.ts:648-656` | Verified. §2.3 |
| 54 | `ExceptionStatus` on the wire | `docs/contracts/capability.openapi.yaml:2344-2353` | The second half of §2.3's blast radius; `check:wire` is the gate |
| 55 | Three live `SourceDocument` construction sites | `tests/model/reconciliation-conservation.test.ts:145`, `tests/model/reconciliation-passes.test.ts:120`, `tests/model/learned-dispositions.test.ts:151` | **Contradicts the adjudication's C7 note** — see §7c |

### Two pre-existing hazards this design must route around, both verified

**(a) `extraction` is already two concepts in `model/`.** `applyExtraction()` / `ExtractionOp` /
`ExtractionRefusal` (`model/reconciliation.ts:339`, `:437`, `:483`) are **identifier normalisation
ops**, nothing to do with reading a document. `SourceDocument.extracted` / `ExtractedValue` /
`ExtractedLine` (`model/domain.ts:1829-1853`) are **document capture**. Naming my type
`ReExtractionRefusal` would put a homonym forty lines from `ExtractionRefusal` — §5.3 at the smallest
possible scale. **I therefore use the product's own word: `Recapture`,** on the authority of
`model/domain.ts:1761-1762`. Stated because the temptation to write "re-extract" is strong and the
adjudication's §8 item 3 uses that word.

**(b) `Timestamp = string` (`model/kernel.ts:422`) and `NoTextField<string> = never`.** Any type
asserted with `AssertNoTextDeep` may carry **no `Timestamp` and no plain `string`**. That is why
every refusal and post-condition arm below carries counts, literals and branded ids only, and why
`{ kind: 'managed_service_refused' }` carries `ManagedServiceRejection['reason']` (a literal union)
and **not** `ManagedServiceRejection` itself (whose `permitted: readonly string[]` would make the
assertion red).

---

## 2. The design

**Placement.** All of §C below goes into **`model/ingestion.ts`**, appended as **`§C  CORRECTION`**
after the mapping sections the other green teams own. It is one module and not a second, because a
`MappingRetraction` that lived apart from `SchemaMapping` would be two vocabularies for one
lifecycle. Field additions go where the interfaces are. **If `model/ingestion.ts` does not yet exist,
this section is a reason it must exist as ONE module.**

The header sentence this section owes, in the module header from the first commit:

```
 * §C. A CORRECTION IS A COMPENSATING ACT. Nothing here overwrites a capture, a
 *     MatchGroup, an Allocation or an Exception. The old capture is superseded and
 *     kept; the old run is superseded and kept; the corrected run is a NEW run under
 *     RunTrigger.rerun{reason:'data_corrected'} (model/domain.ts:2763). The reason is
 *     not fastidiousness: AuditEvent and DataAccessEvent are the ONLY two chained
 *     streams (grep -rn 'chain: RecordChain' model/*.ts → 2), so an in-place rewrite
 *     of the rows they POINT AT leaves every chain valid while every recorded finding
 *     silently means something else.
 *
 *     Negative controls, comments stripped first:
 *       code | grep -c 'throw '                    → 0
 *       code | grep -c 'new RegExp'                 → 0   G124/G130
 *       code | grep -c 'DATA_CLASS'                 → 0   §2.7: no fifth ladder
```

### 2.1 Why in-place is refused, and the argument is stronger than "provenance"

`RecordChain` is carried by exactly two interfaces — `AuditEvent.chain` (`model/domain.ts:3939`) and
`DataAccessEvent.chain` (`model/governance.ts:1158`). `MatchGroup`, `Exception`, `SourceDocument` and
`ReconciliationRun` carry **no chain at all**.

`AuditEvent.subjectId` is bare `string` and `subjectType` names the row type
(`model/domain.ts:3980-3991`), and `bodyHash` is *"Hash of this record's canonical body"*
(`model/governance.ts:1119`) — **the audit row's own body, not its referent's.** Therefore:

> **An in-place recapture rewrites what every recorded finding MEANS while leaving every hash chain
> valid and every anchor matching.** The tamper evidence covers the two record streams; it does not
> cover the business rows those streams point at. `ChainAnchor` proves *"the chain changed, not what
> it used to say"* (`model/governance.ts:1135-1136`) — and here the chain would not have changed at
> all.

That is the whole argument for a compensating shape, and it is not an aesthetic one. Two corollaries:

- **A new `SourceDocumentId` is equally refused,** for R5(i)'s reason at the item grain: `itemKey()`
  is `(side, sourceDocumentId, lineIndex)` (`model/reconciliation.ts:809-813`) and
  `MatchGroup.members` addresses `SourceDocumentId[]` (`model/domain.ts:2770`). A new id makes a
  second item that matches separately and a `MatchGroup` that no longer names the document it
  matched. **And purge-and-re-ingest is refused by the ingestion design's own file-grain idempotency
  key** — R5(ii)'s `(tenantId, sourceEndpointId, sha256(bytes))` — so re-uploading the same bytes is
  a no-op by construction. The adjudication says purge-and-re-ingest "collides with retention"; it
  also collides with C-idempotency, which is a cheaper and more certain refusal.
- **The identity that is stable is `SourceDocumentId`; the thing that versions is the CAPTURE.**

### 2.2 What happens to MatchGroups, Allocations and Exceptions — three objects, three answers, and one of them does not exist

| Object | What it stores | What a recapture does to it |
|---|---|---|
| `Exception` | `explanation.observed[].scalar` is a **COPY** (`model/domain.ts:2791`), and `:2796-2807` says so explicitly: *"Explanation outlives the document it was drawn from … purging the source does not remove this copy."* | **Nothing. It is already safe.** The wrong finding stays readable as the wrong finding — which is what an auditor needs. It is REVERSED (if resolved) or SUPERSEDED (if open), never edited |
| `MatchGroup` | `keyValues` is a copy; `members` is references at **document** grain | **Nothing.** "Doc D matched doc E" is still true of doc D. It gains `supersededByRunId` and is otherwise untouched |
| `Allocation` | `{ ordinal, fromKey, toKey, amount, evidence }` — **no `id`, no `extends TenantScoped`, and no writer anywhere in `model/`** (`model/reconciliation.ts:1198-1206`) | **Nothing, because nothing is recorded.** `MatchingState` is per-run in-memory state. `grep -rn "PairingEvidence" model/*.ts` outside `reconciliation.ts` returns **zero** |

> ⚠️ **The question as posed presupposes persistence the model does not declare.** There is no
> allocation table and no persistent home for `PairingEvidence` — so `MatchGroup.outcome`
> (`'matched' \| 'exception' \| 'unmatched'`) is the only durable trace of a pairing, and **HOW a pair
> formed is not stored at all.** That is a separate, pre-existing gap, and it makes correction
> *easier* (nothing to compensate) and audit *worse* (a superseded run cannot explain itself). I do
> not solve it here — §6, item 3.

### 2.3 The three model changes

**(i) `SourceDocument` — two fields.** Insert inside `export interface SourceDocument`
(`model/domain.ts:1840-1864`), after `lines` at `:1853`:

```ts
  /**
   * C8. The promoted mapping this capture was parsed under. NULL means the tier
   * needed no mapping — `structured`, `digital_text` and `scanned` all park here.
   *
   * ⚠️ NULL IS "NO MAPPING WAS USED", NEVER "UNKNOWN". That polarity is C18's
   * own rule and `docs/access-and-agency.md` §8.6's inversion is the precedent
   * for getting it wrong. A capture whose mapping cannot be named is not written.
   *
   * THIS FIELD IS THE ENUMERATION KEY FOR THE WHOLE CORRECTION PATH. It carries
   * a database index — `(tenant_id, mapping_version_id)` — because the query it
   * exists for is "every document parsed under mapping M", run at the moment
   * somebody has discovered that M is wrong.
   */
  mappingVersionId: SchemaMappingId | null
  /**
   * Which capture of this document `extracted` and `lines` currently hold. 1 at
   * first capture, strictly increasing, and the pin `DocumentCapture.version`
   * joins on.
   *
   * `ReconciliationRun.definitionVersion` (`:2703`) and `Exception.ruleVersion`
   * (`:2941`) are the same device for the same reason: a re-run must be
   * distinguishable from a first run.
   */
  captureVersion: number
```

**(ii) `DocumentCapture` — the append-only capture ledger.** New interface in `model/domain.ts`,
inserted immediately after `SourceDocument` closes at `:1864`:

```ts
/**
 * THE CAPTURE LEDGER. One row per attempt at reading one document; append-only.
 *
 * `SourceDocument.extracted` and `.lines` are the LIVE capture, denormalised onto
 * the row for the read path — DERIVED, NEVER AUTHORITATIVE, the same posture
 * `Exception`'s four queue fields carry (`:2956`). This ledger is authoritative.
 *
 * WHY A LEDGER AND NOT A VERSIONED COLUMN. `model/reconciliation.ts:1156-1163`
 * already argues it for allocations: *"ALLOCATION STATE LIVES IN AN APPEND-ONLY
 * LEDGER, NEVER AS A MUTABLE FIELD ON AN INPUT RECORD."* A capture is the same
 * kind of thing one layer earlier — and the consequence is larger here, because
 * only `AuditEvent` and `DataAccessEvent` are hash-chained (2 hits for
 * `grep -rn 'chain: RecordChain' model/*.ts`), so overwriting `extracted` changes
 * what every recorded MatchGroup means without breaking a single chain or anchor.
 *
 * 🛑 EXACTLY ONE LIVE CAPTURE PER DOCUMENT, ENFORCED IN THE STORE. At most one
 * row per `(tenantId, sourceDocumentId)` may have `supersededAt === null`, as a
 * partial unique index. That is `ProcedureStepExecution`'s rule verbatim
 * (`:3294-3300`): *"That uniqueness IS the concurrency control — enforce it in the
 * store, not in the caller"*, or two concurrent recaptures race and the loser's
 * values are what the next run reads.
 */
export interface DocumentCapture extends TenantScoped {
  id: DocumentCaptureId
  sourceDocumentId: SourceDocumentId
  /** 1 for the first capture. Strictly increasing per document. */
  version: number
  /** C8, pinned per capture rather than only on the document. */
  mappingVersionId: SchemaMappingId | null
  /** C7. What the document turned out to BE, for this capture. */
  fidelity: AcquisitionFidelity
  extracted: Record<FieldPath, ExtractedValue>
  lines: ExtractedLine[]
  capturedAt: Timestamp
  /**
   * Null for version 1, which no correction produced — and that null is the
   * distinction between "first read" and "read again", which an auditor asks
   * first.
   */
  recaptureId: RecaptureId | null
  /** Null while live. Set when a later capture supersedes this one. */
  supersededAt: Timestamp | null
}
```

**(iii) `MatchGroup` — one field, and `ExceptionStatus` — one member.**

```ts
// model/domain.ts, inside MatchGroup (:2765-2778), after `outcome` at :2773:
  /**
   * Set when a corrected rerun replaced this group. The group is KEPT: its
   * `keyValues` are a copy and its `members` name documents that really did
   * pair under the capture then live, so deleting it would destroy the only
   * durable evidence of what the wrong mapping produced.
   *
   * `MatchRule.supersededBy` (`:2357`) and `STEP_EXECUTION_OUTCOMES.superseded`
   * (`:3284`) are the same word for the same act, and `:3280-3282` already names
   * *"a rerun, a reversal reopening a resolved exception"* as its causes.
   */
  supersededByRunId: RunId | null
```

```ts
// model/domain.ts:648-656 — ExceptionStatus gains ONE member
export type ExceptionStatus =
  | 'open'
  | 'investigating'
  | 'resolution_proposed'
  | 'pending_approval'
  | 'resolved'
  | 'rejected'
  | 'dismissed'
  /**
   * A corrected rerun replaced the finding. NOT `dismissed` — dismissal is a
   * human judgement that the finding did not matter; this is a statement that
   * the finding was computed over a capture that is no longer live. Collapsing
   * them would make "how many exceptions did the team dismiss" a number that
   * silently includes every mass correction.
   *
   * ⚠️ AN OPEN EXCEPTION HAD NOWHERE TO GO UNTIL THIS MEMBER. `ExceptionReversal`
   * (`:2924`) only reaches a RESOLVED one — its docblock at `:2889` is *"Why a
   * resolution was undone"* — so the corrected rerun could reverse the resolved
   * half of its blast radius and had no verb for the open half.
   */
  | 'superseded'
```

> 🛑 **Blast radius of that one member, in order, and it is the totality biting.**
> `model/domain.ts:648-656` → `docs/contracts/capability.openapi.yaml:2344-2353` (the wire enum) →
> `npm run check`'s `check:wire`, which compares enum **order** against the model. `model/presentation.ts:576` and `:880` hold
> `ScopeDimension<ExceptionStatus>` and are `@dropped-for-v1`, so they widen and assert nothing.
> **There is no total `Record<ExceptionStatus, …>` anywhere** — verified by
> `grep -rn "ExceptionStatus" model/*.ts`, which returns only `domain.ts` and the two
> `presentation.ts` lines. So `tsc` will stay green on this member and **tell you nothing** (§5.10);
> `check:wire` is the only thing that bites, and the fixture in §4 is the only thing that witnesses
> the new state being reachable.

### 2.4 The enumeration — how C8 is used, and what query shape it implies

Three queries, in this order, **all inside one `withTenantScope()` transaction** under G99/G101, with
G100's deny-on-NULL RLS as the containment.

```sql
-- Q1  DOCUMENT GRAIN. This is the whole of C8's value, and it is exact.
--     Index: (tenant_id, mapping_version_id).
SELECT sd.id, sd.capture_version, sd.purge_after, sd.purged_at, sd.storage_ref
  FROM source_document sd
 WHERE sd.tenant_id = current_setting('app.tenant_id')
   AND sd.mapping_version_id = $1
 ORDER BY sd.id;                      -- A2: a STATED total key, not arrival order
```

```sql
-- Q2  RUN GRAIN. THE GRAIN THAT MATTERS, AND C8 DOES NOT GIVE IT.
--     Requires the projection table in §2.5 — without it this query does not exist.
SELECT DISTINCT rid.run_id
  FROM run_input_document rid
 WHERE rid.tenant_id = current_setting('app.tenant_id')
   AND rid.source_document_id = ANY($2)   -- Q1's ids
 ORDER BY rid.run_id;
```

```sql
-- Q3  RETENTION GRAIN, per document from Q1. Feeds purgeVerdict() —
--     model/governance.ts:1923. Not a new ladder; the existing function.
SELECT lh.* FROM legal_hold lh
 WHERE lh.tenant_id = current_setting('app.tenant_id')
   AND lh.released_at IS NULL
   AND (lh.subject_ref IS NULL OR lh.subject_ref = $3);
```

> 🛑 **THE FINDING THAT MATTERS MOST IN THIS SECTION.** C8 makes the blast radius enumerable at the
> **document** grain and **not** at the **run** grain — and the run grain is the one that decides what
> must be re-run, because §2.6 makes the unit of correction the run.
> `ReconciliationRun.inputs: Record<SlotName, SourceDocumentId[]>` (`model/domain.ts:2718`) and
> `MatchGroup.members: Record<SlotName, SourceDocumentId[]>` (`:2770`) are **maps of arrays**, which
> under G106's decided storage shape is JSONB. *"Which runs consumed document D"* is therefore not a
> foreign key, is not indexable without a GIN index over a JSONB value, and is not expressible in a
> query a person can read. **C8's own sentence — *"without the version on the row you cannot enumerate
> the blast radius"* — is true one grain up as well, and nobody said so.**

### 2.5 `run_input_document` — a projection, deliberately not an entity

```
run_input_document (tenant_id, run_id, slot_name, source_document_id)
  PRIMARY KEY (tenant_id, run_id, slot_name, source_document_id)
  INDEX       (tenant_id, source_document_id)          -- Q2's access path
  written in the SAME transaction that writes ReconciliationRun
```

**This is a schema obligation and NOT a new model interface, and the distinction is load-bearing.**
G35's rule is that *a machine-produced **timed** record gets its own identity by default*
(`docs/HANDOFF.md:689`). A join projection carries no timestamp, no actor and no independent
lifecycle — it is `ReconciliationRun.inputs` in normal form. Giving it an `Id<'RunInputDocument'>`
would put a fifteenth entity in `_EntitiesCarryTheirOwnIdentity` for a row nothing will ever cite.

Its precedent is `Exception.costCentre` / `legalEntity` (`model/domain.ts:2968-3019`), and both halves
of that docblock apply verbatim: *"A control that looks present and is absent is worse than an absent
one"* — the correction path is exactly that control today — and **"DONE NOW BECAUSE IT IS CHEAPEST
NOW"**: after runs exist, this is a backfill from JSONB over every historic run.

### 2.6 The three acts, and the shape

```
   promote_field_mapping (R2/C14, authority) ─── the mapping is found WRONG
                     │
   ①  MappingRetraction         ONE person, immediate, narrowing.
                     │          mode: 'suspend' | 'retract'   (RetractionMode's shape)
                     │          MAPPING_RETRACTION_UNMAKES_DOWNSTREAM = false
                     │          → future files re-nominate. Nothing downstream moves.
                     ▼
   ②  RecapturePlan             ErasurePlan's twin. Enumerates, does not act.
                     │          items: { location: SubjectLocation, disposition, reason }
                     │          status: planned|executing|completed|partially_completed
                     │          maxDocuments REQUIRED, refuses on absence (O-8 posture)
                     ▼
   ③  Recapture (per document)  A NEW DocumentCapture. Never an overwrite.
                     │          Refuses on purge / erasure / hold-without-preservation /
                     │          resolveManagedService()
                     ▼
   ④  the corrected rerun       RunTrigger.rerun{ ofRunId, reason: 'data_corrected' }
                                trigger_run [configuration] — NO new capability
                                whole run, never a delta (G123's argument, §2.8)
                     │
                     ├── resolved Exception  → ExceptionReversal{ reason:'data_corrected' }
                     │                         reverse_resolution [tenant_data]
                     │                         reversalIndictsAutonomy() → false
                     ├── open Exception      → status 'superseded', carriedForwardFrom set
                     └── MatchGroup          → supersededByRunId = the new run
```

**Who may perform each act, under which capability and resource class, and whether it needs the
second person:**

| Act | Capability | Class | Second person? |
|---|---|---|---|
| ① `MappingRetraction` | `promote_field_mapping` | `authority` | **No.** `model/learning.ts:1176-1186` verbatim: *"narrowing is automatic and widening is an act"*, and *"Requiring a second approver to STOP a learning would invert it, and would do so at the worst moment"* |
| ② `RecapturePlan` (plan only, inert) | `promote_field_mapping` | `authority` | **No.** A plan that has executed nothing is inert, and A6's test applies: minting authority for an inert artefact buys nothing |
| ③ `Recapture` | `promote_field_mapping` | `authority` | **No — and the reason is that the second person already happened.** R2's triggers (a)/(b)/(c) fire on the **replacement mapping's promotion**; `mayRecapture()` refuses unless that mapping is live and, where a trigger fired, countersigned. **One ladder, not two** |
| ③ the READ of the blob | `view_document` + `REQUIRES_ENUMERATION.delivery = ['tenant_data']` | `tenant_data` | n/a — C15's mechanism unchanged. Mints an `AuthorizationGrant` and a `DataAccessEvent` |
| ④ the corrected rerun | `trigger_run` | `configuration` | **No.** `model/access.ts:606-611` already argues it |
| ④ reversing a resolved exception | `reverse_resolution` | `tenant_data` | **No.** `ExceptionReversal.reversedBy` is *"Always a human"* (`:2926-2927`) and that is the whole control |

> **No 39th capability. Capabilities stay at 38** (37 today + `promote_field_mapping` from C14).
> The argument is `mayRetractLearning()`'s own, quoted: *"A separate `retract_learning` member was
> considered and refused: adding a capability is a platform release … If an access review ever needs
> to distinguish them, `RetractionMode` is on the record"* (`model/learning.ts:1275-1284`).
> `RecaptureMode` is on the record here for the identical purpose.
> **And the class matters:** `authority` appears in neither entry of `PERMITTED_RESOURCES` and only a
> signed `SupportAuthorisation` reaches it (`CONTRACT_ONLY_RESOURCES = ['authority']`,
> `model/governance.ts:~515`) — so **a standing 90-day FDE delivery grant (G75) cannot recapture a
> tenant's documents.** Classing recapture `configuration` would hand it to that grant, which is
> A5/G128's refusal exactly. ⚠️ **Note the asymmetry this creates and do not read it as an
> oversight:** `trigger_run` **is** `configuration`, so an FDE can trigger the corrected rerun and
> cannot authorise the recapture that makes it worth running. That is the correct split — the FDE
> operates, the customer decides what its numbers are.

**Declarations, ready to paste, `model/ingestion.ts` §C:**

```ts
/* ==================================================================== *
 * §C  CORRECTION — a compensating act, never an in-place fix
 * ==================================================================== */

/**
 * The two speeds, and the vocabulary is `RetractionMode`'s
 * (`model/learning.ts:1222`) rather than a second spelling of it: *"stop this
 * now, decide later" is the act somebody actually needs at three in the
 * morning, and a single terminal verb makes the cautious choice the expensive
 * one.*
 *
 * `suspend` stops the mapping being SELECTED for future files and leaves it
 * eligible for reinstatement. `retract` is terminal.
 */
export type MappingRetractionMode = 'suspend' | 'retract'

/**
 * Why a promoted mapping stopped. A closed vocabulary, and the distinction
 * inside it is load-bearing for the same reason `ReversalReason`'s is
 * (`model/domain.ts:2889-2899`): only some of these say the promoter was wrong.
 */
export type MappingRetractionReason =
  /** The binding was wrong. The ordinary case, and the money case. */
  | 'binding_falsified'
  /** True once, no longer — the supplier changed its export. */
  | 'no_longer_holds'
  /** C13's header-set drift refused so often the mapping is not the schema's. */
  | 'header_set_drifted'
  /** Superseded by a later promotion over the same header set. */
  | 'superseded'
  /** Withdrawn during review, before any file was parsed under it. */
  | 'withdrawn_before_use'

export type MappingRetractionRefusal =
  /** Already retracted, or never promoted. Nothing to stop. */
  | { kind: 'mapping_not_live' }
  | { kind: 'actor_not_customer_org' }
  | { kind: 'actor_lacks_capability' }

export type _MappingRetractionRefusalHoldsNoText =
  AssertNoTextDeep<MappingRetractionRefusal>

/**
 * A retraction is a RECORD, not a mutation — `model/learning.ts:1243-1247`, and
 * the sentence transfers without amendment: *"An entry that reverted by having
 * its status overwritten would lose the one thing an auditor asks after a bad
 * learning: who caught it, and how long it ran."* Substitute "mapping" for
 * "learning" and every clause holds, including the reason it is REPEATABLE
 * against one mapping — `suspend` then `retract`.
 */
export interface MappingRetraction extends TenantScoped {
  id: MappingRetractionId
  mappingId: SchemaMappingId
  mode: MappingRetractionMode
  reason: MappingRetractionReason
  retractedBy: UserId
  retractedAt: Timestamp
  /** Set only where a later promotion replaced this mapping. */
  supersededBy: SchemaMappingId | null
  /**
   * Invariant 10: an act with no authorisation is unrecordable. NEVER NULL —
   * `AUTHORIZATION_MAY_BE_ABSENT` (`model/governance.ts:1232`) permits null for
   * `system` alone and there is no system path here, exactly as
   * `LearningRetraction.authorizationId` records (`model/learning.ts:1266-1272`).
   */
  authorizationId: AuthorizationGrantId
}

/**
 * 🛑 THE HONEST LIMIT, STATED RATHER THAN IMPLIED — and it is
 * `RETRACTION_UNMAKES_DOWNSTREAM`'s (`model/learning.ts:1240`) sentence, kept:
 * *"Retraction stops FUTURE reads of the entry. It does not reach what the entry
 * already caused."*
 *
 * ⚠️ AND HERE THAT IS NOT ENOUGH, WHICH IS WHY §C CONTINUES. A learned rule that
 * fired wrongly produced a DISPOSITION a human can reverse one row at a time. A
 * mapping that bound the wrong column produced the AMOUNT every downstream row
 * was computed from — thousands of them, none individually wrong-looking. So
 * `RecapturePlan` exists to make the downstream reachable, and this constant
 * stays `false` to say that RETRACTION ALONE does not reach it.
 */
export const MAPPING_RETRACTION_UNMAKES_DOWNSTREAM = false

export function mayRetractMapping(input: {
  actor: UserId
  actorOrgClass: OrgClass
  /** Obtained from `decide()`, never asserted — `mayRetractLearning()`'s rule. */
  holdsPromoteFieldMapping: boolean
  mappingIsLive: boolean
}): { permitted: true } | { permitted: false; refusal: MappingRetractionRefusal } {
  if (!input.mappingIsLive) return { permitted: false, refusal: { kind: 'mapping_not_live' } }
  if (input.actorOrgClass !== 'customer') {
    return { permitted: false, refusal: { kind: 'actor_not_customer_org' } }
  }
  if (!input.holdsPromoteFieldMapping) {
    return { permitted: false, refusal: { kind: 'actor_lacks_capability' } }
  }
  return { permitted: true }
}
```

```ts
/* -------------------------------------------------------------------- *
 * §C.2  THE PLAN — ErasurePlan's twin, and the reuse is the design
 * -------------------------------------------------------------------- */

/**
 * What will actually happen to one located thing.
 *
 * ⚠️ TWO LITERALS ARE SPELLED IDENTICALLY TO `ErasurePlanItem.disposition`
 * (`model/governance.ts:1977`) ON PURPOSE — `retain_under_hold` and
 * `out_of_reach` — so a reader joins the two plans by eye. They are NOT one
 * union, because `purge` on a recapture plan and `recapture` on an erasure plan
 * are both states the type must not make legal (§5.5).
 */
export type RecaptureDisposition =
  /** The bytes are reachable and nothing forbids re-reading them. */
  | 'recapture'
  /** A MatchGroup or an Exception a corrected rerun will replace. */
  | 'supersede'
  /**
   * `purgeVerdict()` returned `retain` on a live hold. The old capture may not
   * be overwritten — which the ledger already guarantees — so recapture
   * proceeds ONLY as a new capture, and this disposition records that the
   * append-only shape is load-bearing rather than tidy for this item.
   */
  | 'retain_under_hold'
  /**
   * `purgeVerdict()` returned `purge` on `erasureRequested`. RE-DERIVING A
   * SUBJECT'S DATA AFTER AN ERASURE REQUEST IS THE ONE THING THIS PLAN MUST NOT
   * DO, and it is a refusal rather than a skip.
   */
  | 'blocked_by_erasure'
  /**
   * `purgedAt !== null`, the blob is gone, or the superseded run's input set
   * cannot be reconstructed. `ErasurePlan`'s own argument, quoted
   * (`model/governance.ts:1954-1957`): *"a plan that admits what it cannot reach
   * … is worth more than one that silently misses it and reports success."*
   */
  | 'out_of_reach'

export interface RecapturePlanItem {
  /**
   * REUSED UNCHANGED (`model/governance.ts:1772`). ⚠️ AND THE REUSE IS THE
   * FINDING: the places an extracted value comes to rest are already
   * enumerated, by the erasure index, for exactly this reason. The three
   * variants this plan uses are `source_document`, `match_group_key` and
   * `explanation_observed`. Minting a parallel location union would be §5.3 on
   * the one type whose whole job is to enumerate where a value went.
   */
  location: SubjectLocation
  disposition: RecaptureDisposition
  reason: string
  executedAt: Timestamp | null
}

/**
 * An enumeration, not an act. Producing one changes nothing.
 *
 * SHAPE AND STATUS VOCABULARY COPIED FROM `ErasurePlan`
 * (`model/governance.ts:1959-1973`), INCLUDING `partially_completed` AND
 * INCLUDING THE `id`/`requestId` SPLIT ARGUMENT: a plan that leaves
 * `out_of_reach` items is RE-PLANNED, so `retractionId` names the trigger and
 * cannot be the plan's key — *"A regulator asking which plan was executed needs
 * to be able to name one."*
 */
export interface RecapturePlan extends TenantScoped {
  id: RecapturePlanId
  /** The act that started this. Not a key — one retraction, many plans. */
  retractionId: MappingRetractionId
  /** C8's key, restated on the plan so the plan is self-describing. */
  mappingVersionId: SchemaMappingId
  /** The mapping the recapture will parse under. Must be live at execution. */
  replacementMappingId: SchemaMappingId | null
  plannedAt: Timestamp
  plannedBy: UserId
  items: RecapturePlanItem[]
  /**
   * REQUIRED, NO DEFAULT, REFUSES ON ABSENCE — C4's discipline and
   * `IdentifierNormalisation.maxInputChars`'s own sentence: *a bound with no
   * number is not a bound*.
   *
   * 🛑 THE REASON IS COST, AND IT IS AN ATTACKER-ADJACENT COST. A plan over a
   * `scanned` population re-invokes a managed service once per document, so an
   * unbounded plan is an unbounded bill authored by one click. The NUMBER is the
   * owner's (O-8); this field only makes its absence a refusal.
   */
  maxDocuments: number
  status: 'planned' | 'executing' | 'completed' | 'partially_completed'
  /** Set when a corrected rerun has consumed this plan's captures. */
  correctedByRunIds: RunId[]
  authorizationId: AuthorizationGrantId
}
```

```ts
/* -------------------------------------------------------------------- *
 * §C.3  THE ACT
 * -------------------------------------------------------------------- */

/** `RetractionMode`'s two-speed shape, on the other side of the correction. */
export type RecaptureMode =
  /** Re-read and store a new capture, leaving the run to a later act. */
  | 'capture_only'
  /** Re-read and enqueue the corrected rerun in the same transaction. */
  | 'capture_and_rerun'

export type RecaptureRefusal =
  /** The wrong mapping is still live. Correct the mapping before the documents. */
  | { kind: 'mapping_not_retracted' }
  | { kind: 'replacement_mapping_not_live' }
  /**
   * R2's trigger (a), (b) or (c) fired on the replacement promotion and no
   * second person countersigned. THE SECOND PERSON ATTACHES THERE, AND THIS ARM
   * IS WHAT MAKES THAT ATTACHMENT REACH THE RECAPTURE — without it the
   * countersignature governs future files and not the thousands of past ones.
   */
  | { kind: 'replacement_mapping_second_person_absent' }
  | { kind: 'actor_not_customer_org' }
  | { kind: 'actor_lacks_capability' }
  | { kind: 'plan_bound_not_stated' }
  | { kind: 'plan_exceeds_bound'; bound: number; planned: number }
  /** `SourceDocument.purgedAt !== null`. The bytes are gone. */
  | { kind: 'document_purged' }
  /** `purgeVerdict()` → `purge` on an erasure request. Fail-closed. */
  | { kind: 'erasure_requested' }
  /**
   * The store cannot prove one-live-capture-per-document, so a recapture under
   * a live hold might overwrite held data. Refuse rather than risk it.
   */
  | { kind: 'capture_ledger_not_append_only' }
  /**
   * ⚠️ CARRIES `ManagedServiceRejection['reason']`, NOT THE REJECTION. The
   * rejection's `feature_not_permitted.permitted` is `readonly string[]`
   * (`model/policy.ts:1727`) and `NoTextField<string>` is `never`
   * (`model/reconciliation.ts:248`), so embedding it makes the assertion below
   * RED. The literal union passes.
   */
  | { kind: 'managed_service_refused'; reason: ManagedServiceRejection['reason'] }
  /** A2. The superseded run's document set cannot be reconstructed in order. */
  | { kind: 'run_input_set_unreconstructable' }

export type _RecaptureRefusalHoldsNoText = AssertNoTextDeep<RecaptureRefusal>

/**
 * ONE recapture of ONE document. A record of an act, never a mutation.
 */
export interface Recapture extends TenantScoped {
  id: RecaptureId
  planId: RecapturePlanId
  sourceDocumentId: SourceDocumentId
  mode: RecaptureMode
  /** The capture this produced. Strictly greater than the one it superseded. */
  producedCaptureVersion: number
  supersededCaptureVersion: number
  underMappingId: SchemaMappingId | null
  capturedBy: UserId
  capturedAt: Timestamp
  /** Never null. `LearningRetraction.authorizationId`'s argument, unchanged. */
  authorizationId: AuthorizationGrantId
}

/**
 * MAY THIS RECAPTURE PROCEED? A reasoned union, never a boolean (§5.2).
 *
 * ORDER OF THE ARMS, and it is a ruling in `mayAutoResolve()`'s sense rather
 * than a convenience: CAPABILITY, then ORG, then the MAPPING lifecycle, then the
 * BOUND, then RETENTION. Capability first for `mayPromoteLearning()`'s stated
 * reason (`model/learning.ts:1128-1133`) — *"the capability answers whether this
 * is an act they may perform at all"*. **Retention LAST and never bought past**:
 * no earlier arm can be satisfied in a way that skips it, because it is the arm
 * with no downstream recourse — once a subject's data has been re-derived after
 * an erasure request, there is no un-deriving it.
 *
 * ⚠️ THIS FUNCTION RANKS NO `DataClass`, DELIBERATELY. `model/policy.ts:1691-1704`
 * already calls the ladder *"THE THIRD COPY IN `model/`"* and names a fourth; a
 * fifth in an ingestion module would be §5.3 with a documented precedent sitting
 * beside it. The class comparison belongs to the promotion (R2 trigger (b)), and
 * this function consumes its ANSWER as `replacementSecondPersonPresent`.
 */
export function mayRecapture(input: {
  actor: UserId
  actorOrgClass: OrgClass
  holdsPromoteFieldMapping: boolean
  retractedMappingIsLive: boolean
  replacementMappingIsLive: boolean
  /** True when R2 (a)/(b)/(c) fired on the replacement promotion. */
  replacementRequiredSecondPerson: boolean
  replacementSecondPersonPresent: boolean
  plan: { maxDocuments: number; plannedDocuments: number }
  document: { purged: boolean }
  /** `purgeVerdict()`'s verdict for this document. Computed by the caller. */
  purge: PurgeVerdict
  captureLedgerIsAppendOnly: boolean
}): { permitted: true } | { permitted: false; refusal: RecaptureRefusal } {
  if (!input.holdsPromoteFieldMapping) {
    return { permitted: false, refusal: { kind: 'actor_lacks_capability' } }
  }
  if (input.actorOrgClass !== 'customer') {
    return { permitted: false, refusal: { kind: 'actor_not_customer_org' } }
  }
  if (input.retractedMappingIsLive) {
    return { permitted: false, refusal: { kind: 'mapping_not_retracted' } }
  }
  if (!input.replacementMappingIsLive) {
    return { permitted: false, refusal: { kind: 'replacement_mapping_not_live' } }
  }
  if (input.replacementRequiredSecondPerson && !input.replacementSecondPersonPresent) {
    return { permitted: false, refusal: { kind: 'replacement_mapping_second_person_absent' } }
  }
  if (!Number.isInteger(input.plan.maxDocuments) || input.plan.maxDocuments < 1) {
    return { permitted: false, refusal: { kind: 'plan_bound_not_stated' } }
  }
  if (input.plan.plannedDocuments > input.plan.maxDocuments) {
    return {
      permitted: false,
      refusal: {
        kind: 'plan_exceeds_bound',
        bound: input.plan.maxDocuments,
        planned: input.plan.plannedDocuments,
      },
    }
  }
  if (!input.captureLedgerIsAppendOnly) {
    return { permitted: false, refusal: { kind: 'capture_ledger_not_append_only' } }
  }
  if (input.document.purged) {
    return { permitted: false, refusal: { kind: 'document_purged' } }
  }
  /* RETENTION LAST. `purgeVerdict()` (model/governance.ts:1923) owns the
   * precedence HOLD > MINIMUM > ERASURE > MAXIMUM; this reads its answer and
   * does not re-derive it. A `purge` decision means the subject asked to be
   * forgotten or the window elapsed — either way, re-deriving is refused. */
  if (input.purge.decision === 'purge') {
    return { permitted: false, refusal: { kind: 'erasure_requested' } }
  }
  return { permitted: true }
}
```

### 2.7 The correction post-conditions — POPULATION IDENTITY, not conservation

```ts
/* -------------------------------------------------------------------- *
 * §C.4  POST-CONDITIONS
 *
 * 🛑 THERE IS NO CROSS-RUN MONEY CONSERVATION CHECK HERE AND THERE MUST NOT BE
 * ONE. The superseded run and the corrected run are computed over DIFFERENT
 * captures — the whole point is that the amounts were wrong — so their gross
 * totals legitimately differ, and a check asserting they agree would be a
 * control that fails while the property holds, which
 * `model/reconciliation.ts:9-14` names as teaching people to ignore controls.
 *
 * WHAT IS CONSERVED IS THE POPULATION, NOT THE MONEY. That is the same
 * correction the red team made one layer down — *"The load-bearing post-condition
 * is RESIDUE COMPLETENESS, not conservation"* (`:1170-1172`) — restated for the
 * layer above: THE LOAD-BEARING CORRECTION POST-CONDITION IS POPULATION
 * IDENTITY. Every arm below carries counts and literals only, for
 * `PostconditionFailure`'s stated reason (`:2640-2648`).
 * -------------------------------------------------------------------- */
export type CorrectionPostconditionFailure =
  /** THE load-bearing one. The store's partial unique index has failed. */
  | { kind: 'document_has_two_live_captures'; count: number }
  | { kind: 'document_has_no_live_capture'; count: number }
  /** G123's shape one layer up: a document silently left out of the rerun. */
  | { kind: 'corrected_run_omits_planned_document'; count: number }
  /** …and its mirror, which is the arm that catches a widened rerun. */
  | { kind: 'corrected_run_admits_unplanned_document'; count: number }
  /** An open finding over a dead capture. The reason `superseded` was minted. */
  | { kind: 'superseded_run_retains_live_exception'; count: number }
  /** A MatchGroup of the superseded run still presented as current. */
  | { kind: 'superseded_run_retains_current_match_group'; count: number }
  | { kind: 'plan_item_executed_with_no_disposition'; count: number }
  /** A capture written under a mapping that was retracted before it ran. */
  | { kind: 'capture_under_retracted_mapping'; count: number }

export type _CorrectionPostconditionHoldsNoText =
  AssertNoTextDeep<CorrectionPostconditionFailure>
```

### 2.8 Why the unit of correction is the RUN, not the document

`checkPostconditions()` walks `state.items` and sums the admitted gross
(`model/reconciliation.ts:2699-2719`) — **both halves are scoped to what the engine was given.** G123's
own note, at `model/reconciliation.ts:2981-2990`, is the argument:

> *"A record removed before admission is in neither total, so removing it breaks nothing and is
> caught by nothing. That is the A9(b) shape sitting one layer ABOVE the check written to catch
> A9(b)."*

**A delta rerun over only the affected documents is exactly that shape, one layer higher again.** The
new run's ledger would be internally sound over its subset while the superseded run's MatchGroups
still assert pairings over items absent from it — two ledgers over one period, each passing every
post-condition, disagreeing. So:

- **the corrected run consumes the superseded run's ENTIRE document set**, with the recaptured
  documents at their new capture version and the untouched ones at their existing one;
- **a run one of whose documents is `out_of_reach` is NOT re-run.** Its MatchGroups keep
  `supersededByRunId = null` and its plan item records `out_of_reach` with a reason. Silently
  re-running a partial population is the failure `ErasurePlan` refuses in its own domain;
- and **A2 is a hard dependency, not a nicety.** `admitPopulation`'s ordinal is *"document order as
  supplied, then line index"* (`model/reconciliation.ts:1106-1107`) and nothing states what supplies
  it. A corrected rerun that hands documents in a different order produces a different FIFO audit over
  the same facts, which destroys the one property correction exists to establish. Q1 and Q2 above are
  therefore `ORDER BY`-ed on a stated total key, and `run_input_document` is what makes that
  reproducible.

### 2.9 G120 — the replay key, and a defect in G120 as stated

G120 requires (`docs/HANDOFF.md:846`, quoted): *"`ReaderOutcome` must be **persisted keyed by
`(runId, requestOrdinal)`**, which is what makes a retry granular AND makes a rerun REPLAY stored
verdicts rather than re-ask — so the reconciliation stays deterministic."*

**`requestOrdinal` is a position, not an identity.** `buildReaderRequests()` assigns
`requestOrdinal: requests.length` (`model/reconciliation.ts:2423`) while iterating the residue and
`continue`-ing past every entry that is right-side, has no description, or has an empty or oversized
candidate set (`:2401-2420`). So the ordinal depends on the **membership and order of the residue**,
which depends on the admitted set, which depends on the capture.

> 🛑 **Therefore: after a recapture, replaying by `(runId, requestOrdinal)` attaches a stored verdict
> about item A to item B.** The verdict is `{ kind: 'candidate'; candidateIndex }`
> (`model/reconciliation.ts:2228`) and `applyReaderVerdicts()` re-derives both residuals and
> re-compares the money before folding (`:2439-2451` and G120's own defence of it) — so this cannot
> produce an over-allocation. **It can produce a confidently wrong allocation between two
> amount-identical candidates, with `PairingEvidence.reader_confirmed` recorded as the evidence**
> (`:1196`). That is the worst available failure: an audit trail that names a model's confirmation of a
> pairing the model was never asked about.
>
> ⚠️ **And this is not specific to correction.** Any rerun whose residue differs — a rule change, a
> tolerance change, `RunTrigger.rerun{reason:'rule_changed'}` — has the same exposure. **It is a defect
> in G120's stated key, found by designing correction against it.** I do not relitigate G120's
> architecture; I record that its persistence key does not carry the property its own sentence claims.

**The fix, and it costs one column:**

```ts
/**
 * The key a STORED reader verdict is replayed under, across runs.
 *
 * 🛑 `(runId, requestOrdinal)` IS KEPT AS THE PRIMARY KEY — it is G120's RETRY
 * key within one run and it is correct for that. This is the REPLAY key, and the
 * two are different questions: *which request is this a retry of* versus *have we
 * already asked this exact question*.
 *
 * WHY CONTENT AND NOT POSITION. `buildReaderRequests()` assigns
 * `requestOrdinal: requests.length` (`model/reconciliation.ts:2423`) over a
 * residue whose membership changes whenever the capture, the rules or the
 * tolerances change. Ordinal 7 of the corrected run is not ordinal 7 of the
 * original.
 *
 * ⚠️ THE INVALIDATION IS FREE, AND THAT IS THE POINT. Nothing has to be purged
 * after a recapture: a request whose subject, description or candidate set moved
 * simply does not match a stored key, so it is RE-ASKED, and everything genuinely
 * unchanged replays. Fail-closed with no sweep.
 *
 * ⚠️ `canonicalise()` (`model/canonical.ts:137`, G20) REFUSES `bigint`, and
 * `ReaderRequest` (`model/reconciliation.ts:2194-2202`) carries no `Money` — only
 * a number, two `ItemRef`s' worth of branded ids and nullable line indices, two
 * strings and a candidate array. VERIFIED BY READING THE DECLARATION. If a
 * `Money` is ever added to `ReaderRequest`, this stops working and must go
 * through G111's codec, not around it.
 *
 * 🛑 IT DOES NOT HASH. `model/` is standalone with no `node:crypto`, exactly as
 * G20 records for the same reason — the hasher lives with the writer, outside
 * `model/`. This type is the SHAPE of the key; the writer computes it.
 */
export interface ReaderReplayKey {
  readonly runIdOfOrigin: RunId
  /** The RFC 8785 canonical form of the request, hashed by the writer. */
  readonly requestBodyHash: string
}
```

**Rerun determinism, stated as the property it now is:** the corrected run is deterministic given
(the document set in stated order, the capture version of each, the pinned definition version, the
pinned rule versions, and the replayed verdicts whose `requestBodyHash` matched). **Four of those five
are already pinned by fields that exist** — `ReconciliationRun.definitionVersion` (`:2704`),
`Exception.ruleVersion` (`:2941`), `SourceDocument.captureVersion` (§2.3), `run_input_document`'s
order (§2.5). The fifth is this key.

---

## 3. What each declaration REFUSES, and what fails closed

| Declaration | Refuses on | Fails closed because |
|---|---|---|
| `mayRetractMapping()` | non-live mapping · non-customer org · missing capability | Returns a reasoned union; a caller with `false` cannot proceed by accident (§5.2) |
| `MAPPING_RETRACTION_UNMAKES_DOWNSTREAM = false` | — | A constant that **states a limit** rather than implying a reach. `RETRACTION_UNMAKES_DOWNSTREAM`'s precedent: the alternative *"would be worse than no verb at all"* |
| `RecapturePlan.maxDocuments` | absent, non-integer, `< 1`, or exceeded | O-8's posture: an unset bound refuses the plan. **Breach never falls through to a paid tier** — C4's rule, and here the paid tier is per document |
| `RecapturePlanItem.disposition` | — | `out_of_reach` and `blocked_by_erasure` exist so the plan can **admit** what it cannot do. A plan with no vocabulary for failure reports success |
| `mayRecapture()` arm 1 | `actor_lacks_capability` | `promote_field_mapping` is `authority`, in `CONTRACT_ONLY_RESOURCES` — a standing G75 delivery grant is refused **structurally**, not by a check |
| `mayRecapture()` arm 3 | `mapping_not_retracted` | You cannot recapture under a mapping still live for new files: that would produce two populations parsed two ways, concurrently |
| `mayRecapture()` arm 5 | `replacement_mapping_second_person_absent` | **This is what makes R2's countersignature reach the past.** Without it, two people approve the mapping for future files and one person applies it to every historic amount |
| `mayRecapture()` arm 9 | `capture_ledger_not_append_only` | If the store cannot prove one-live-capture-per-document, a recapture under a legal hold may overwrite held data. Refuse rather than test-and-hope |
| `mayRecapture()` arm 10 | `document_purged` | The bytes are gone. `out_of_reach`, disclosed, never a silent skip |
| `mayRecapture()` arm 11 | `erasure_requested` | **Evaluated LAST and unbuyable.** `purgeVerdict()` owns the precedence; re-deriving a subject's data after an erasure request is the one act with no undo |
| `{ kind: 'managed_service_refused' }` | any `resolveManagedService()` rejection | A recapture of a `scanned` document is a **new** managed-service call under **today's** config. A tenant that narrowed `allowedRegions` since first capture gets a refusal where the original succeeded — **correct, and it must be `out_of_reach`, not a skip** |
| `_RecaptureRefusalHoldsNoText` | a `string` anywhere at any depth | A refusal is what an engineer logs. A parser's error text, a filename and a header name are all counterparty-derived |
| `_CorrectionPostconditionHoldsNoText` | same | Same reason, and `PostconditionFailure`'s precedent |
| `DocumentCapture` one-live-per-document | two concurrent recaptures | A **partial unique index**, per `ProcedureStepExecution`: *"enforce it in the store, not in the caller, or `step_not_current` becomes a race against itself"* |
| `SourceDocument.mappingVersionId` | — | `null` means **"no mapping was used"**. A capture whose mapping cannot be named is not written; there is no "unknown" |
| `ExceptionStatus.'superseded'` | — | Gives an open finding over a dead capture somewhere to go, so it cannot be silently left `open` or mis-filed as `dismissed` |

---

## 4. The fixtures that witness it, and why `tsc` alone tells nobody anything

**§5.10, stated for each new declaration.** Every type below is inert until something constructs it:

- `MappingRetraction`, `RecapturePlan`, `Recapture`, `DocumentCapture` — **nothing in `model/`
  constructs any of them.** A total `Record`, a compile-time assertion and a green `tsc` after adding
  a field to any of them prove **nothing**.
- `AssertNoTextDeep<…>` proves the SHAPE holds today. It does not prove the shape is reachable, and it
  goes green if the union is unsatisfiable.
- `ExceptionStatus.'superseded'` — **no total `Record<ExceptionStatus, …>` exists in the tree**
  (verified: `grep -rn "ExceptionStatus" model/*.ts` → `domain.ts` plus two `@dropped-for-v1`
  `presentation.ts` lines). Adding the member is green on `tsc` and red only on `check:wire`.

**Fixtures owed, in the same commit.**

| Fixture | Where | What it witnesses that nothing else can |
|---|---|---|
| `documentOf()` gains `mappingVersionId` and `captureVersion` | `tests/model/reconciliation-conservation.test.ts:145`, `tests/model/reconciliation-passes.test.ts:120`, `tests/model/learned-dispositions.test.ts:151` | **These three sites go RED on `tsc` the moment §2.3(i) lands** — which is the one place the compiler does bite, and it is in `tests/`, not `model/` (§7c) |
| `captureOf(row, version)` → `DocumentCapture` | `tests/model/ingest-correction.test.ts` (new) | That a capture can be constructed at all, and that v1 and v2 of one document differ only in `extracted` |
| `twoLiveCaptures()` — v1 and v2 both with `supersededAt: null` | same | Constructs the state the partial unique index forbids, so `document_has_two_live_captures` has a witnessed positive case |
| A `RecapturePlan` whose items span all five dispositions | same | That the disposition vocabulary is **satisfiable** — a proof with no passing case does not distinguish "the rule holds" from "the rule is unsatisfiable" (`model/identity.ts:498-500`) |
| One `RecapturePlanItem` per `SubjectLocation` variant used (`source_document`, `match_group_key`, `explanation_observed`) | same | That the reuse compiles against the real union and not against a remembered one |
| A `MappingRetraction` with `mode: 'suspend'` then a second with `'retract'`, same `mappingId` | same | That the record is REPEATABLE against one mapping — `LearningRetraction`'s stated reason `entryId` is not a key |
| `ExceptionReversal{ reason: 'data_corrected' }` + `reversalIndictsAutonomy()` asserted `false` | same | **The property nobody costed: a 40,000-document correction does not narrow the tenant's autonomy** |
| An `Exception` at `status: 'superseded'` with `carriedForwardFrom` set | same | That the new member is reachable and that the corrected exception can name its predecessor |
| Two `SetReconciliationResult`s over capture v1 and v2 of one fixture population, both `postconditions: []` | same | That correction produces **two internally sound ledgers with different money** — the reason there is no cross-run conservation arm |
| A residue whose membership differs between v1 and v2, with `buildReaderRequests()` called on both | same | **THE G120 WITNESS.** Assert that `requests[3].subjectRef` differs between the two runs while `requestOrdinal` is `3` in both |
| `resolveManagedService()` called with the fixture config (`allowedFeatures: []`, `model/examples.ts:706`) | same | That a `scanned` recapture is refused by the **existing** fixture, which is fail-closed and must stay so (C1's rule) |

---

## 5. The mutations that prove each control bites, with the expected failure

The discipline is `tests/model/managed-service.test.ts`'s (M5b is cited at `model/policy.ts:1848-1849`)
and G20's *"Three mutations verified, each caught by exactly one test and reverted."*

| # | Mutation | Expected failure, and where |
|---|---|---|
| **M1** | Add `columnName: string` to `RecaptureRefusal`'s `managed_service_refused` arm | `TS2344: Type 'RecaptureRefusal' does not satisfy the constraint 'NoTextDeep<RecaptureRefusal>' … Type 'string' is not assignable to type 'never'` — **VERIFY RED BEFORE TRUSTING GREEN**, per `model/reconciliation.ts:2237-2244` |
| **M1b** | Replace `reason: ManagedServiceRejection['reason']` with `rejection: ManagedServiceRejection` | Same `TS2344`, reached through `feature_not_permitted.permitted: readonly string[]` (`model/policy.ts:1727`). **This is the mutation that proves the arm was designed and not guessed** |
| **M2** | Add `capturedAt: Timestamp` to `CorrectionPostconditionFailure` | Same `TS2344`. `Timestamp = string` (`model/kernel.ts:422`), so a timestamp on a post-condition is a text leak |
| **M3** | Move the `purge.decision === 'purge'` arm of `mayRecapture()` to the top | Test `"erasure refusal cannot be reached before capability"` goes red: an actor with no capability now receives `erasure_requested`, disclosing a data-subject fact to a principal who may not act at all. Mirrors G129's ordering ruling |
| **M4** | Delete the `purge.decision === 'purge'` arm entirely | Test `"a recapture after an erasure request refuses"` goes red. ⚠️ **`tsc` stays green** — the function still returns a valid union. This is the mutation that shows why the fixture is the only evidence |
| **M5** | Change `mayRecapture()`'s `retractedMappingIsLive` guard to `if (false)` | Test `"a live wrong mapping blocks recapture"` goes red. `tsc` green |
| **M6** | Delete the `replacementRequiredSecondPerson` arm | Test `"a countersigned promotion is required to recapture past documents"` goes red. **This is the mutation that proves R2 reaches the past**, and nothing else catches it |
| **M7** | Set `maxDocuments` to a default of `1000` instead of refusing on absence | Test `"an unstated plan bound refuses"` goes red. ⚠️ It also violates `PRODUCT.md` — 1000 is a number I would have invented |
| **M8** | Drop `supersededAt` from `DocumentCapture` and add `isLive: boolean` | The one-live-capture partial unique index becomes unexpressible (`WHERE is_live` is not a uniqueness constraint over a boolean without a second predicate). Caught by the **schema** test, not by `tsc` — stated so nobody "simplifies" it |
| **M9** | Construct a second `DocumentCapture` with `supersededAt: null` for one document | Test `"two live captures is a post-condition failure"` asserts `document_has_two_live_captures` with `count: 1`. **And the Postgres test asserts the INSERT itself fails** — two independent mechanisms, per G120's own "two independent mechanisms holding one property" |
| **M10** | Replay a stored `ReaderOutcome` by `(runId, requestOrdinal)` across capture v1→v2 | Test `"a replayed verdict must not change subject across a recapture"` goes red: `requests[3].subjectRef` differs while the ordinal matches. **This is the G120 mutation, and it is red against the tree as it stands today** |
| **M11** | Re-run the corrected run over only the recaptured documents (a delta) | Test `"a delta rerun leaves two live ledgers"` asserts `corrected_run_omits_planned_document` with a non-zero count. Note that **`checkPostconditions()` on the delta run returns `[]`** — G123's blindness, demonstrated rather than asserted, exactly as `tests/model/learned-dispositions.test.ts` does for the pre-engine filter |
| **M12** | Mutate `SourceDocument.extracted` in place instead of writing a capture | Test `"an in-place capture leaves every chain valid"` asserts that the `AuditEvent` chain over the same fixture verifies **before and after** while a recorded `MatchGroup`'s referenced amount changed. **The test that makes §2.1's argument executable** |
| **M13** | Mark the corrected exception `dismissed` instead of `superseded` | Test `"a correction is not a dismissal"` goes red on a count of dismissals. Cheap, and it is the mutation somebody will actually make to avoid the wire change |
| **M14** | Widen `MappingRetractionReason` with a free-text arm | No compile failure, and that is the finding: the union is closed only by review. Recorded as a known limit, `ReaderVerdict.confidenceBasisPoints`'s precedent (`model/reconciliation.ts:2223-2225`) |

---

## 6. What I did NOT solve, and what it is blocked on

1. **`PairingEvidence` has no persistent home, so a superseded run cannot explain itself.** Verified:
   `grep -rn "PairingEvidence" model/*.ts` outside `reconciliation.ts` returns **zero**, and
   `Allocation` (`:1198`) has no id and no `TenantScoped`. So after a correction an auditor can see
   *that* doc D matched doc E under the wrong mapping and can never see *how*. **Blocked on:** a
   decision about persisting `Allocation` / `PairingEvidence`, which is a schema ruling with its own
   blast radius and is not mine.
2. **`ReconciliationRun` has no field pinning per-document capture versions**, and I deliberately did
   not add `Record<SourceDocumentId, number>`. §2.2 shows the exposure is narrower than it looks
   (`Exception` copies its scalars, `MatchGroup` copies its keys), and `run_input_document` can carry
   a `capture_version` column instead. **Blocked on:** whether that column belongs on the projection —
   a schema call.
3. **`unique_within` still has no evaluator** (`model/domain.ts:367`, confirmed at HEAD). A correction
   whose cause was a duplicate rather than a mapping is out of scope here and is R5(v)'s and C17's.
4. **Nothing computes a document-level `DataClass`** (O-3, unowned), so a `scanned` recapture cannot
   evaluate `maxDataClassToService` any better than a first capture can. My design routes the call
   through `resolveManagedService()`; it does not supply the operand.
5. **The cost of a correction is unmodelled.** `maxDocuments` refuses an unbounded plan; nobody has
   priced a bounded one, and `PRODUCT.md` forbids me guessing. A `tabular` recapture is free (no
   managed service, no model — `ACQUISITION_FIDELITY.tabular` is *"Parsed"*), which is the common case
   for a mapping correction; a `scanned` recapture is the whole Textract bill again.
6. **No reinstatement path for a `suspend`ed mapping.** `MappingRetractionMode` admits `'suspend'` and
   nothing un-suspends. That is `LearningEntry`'s own original defect — *"a `status` field with four
   values and NO VERB TO MOVE IT"* (`model/learning.ts:1171-1174`) — and I am naming it rather than
   shipping it, because reinstatement is a WIDENING and would need R2's second person again.
7. **`RecapturePlanItem.reason: string` is plain text on a persisted row.** Deliberate (it mirrors
   `ErasurePlanItem.reason`, `model/governance.ts:1978`) and therefore **outside**
   `AssertNoTextDeep` — a plan is read by a human and a coded reason would be unreadable. It must
   never be built by interpolating a filename or a header. Stated once, enforced by nothing.
8. **`SourceDocument.actualFidelity` still does not exist** (`grep -rn actualFidelity model/` → **0**,
   re-verified). §2.3(ii) puts `fidelity` on `DocumentCapture` because a recapture can change it, and
   that is a **different placement from C7's**. Whoever lands C7 and whoever lands this must land
   them together or there will be two fidelity fields — §5.3, on the field the whole cascade is
   instrumented by.

---

## 7. Dependencies — G rulings, invariants, and the owner rulings this needs

### 7a. G rulings and invariants this design depends on

| Depends on | For what | State |
|---|---|---|
| **Invariant 1** — *"Tenant scope is derived from the session, never read from a request."* | Every query in §2.4 reads `current_setting('app.tenant_id')`; no plan, retraction or recapture carries a tenant | live |
| **Invariant 4** — *"Classification is declared once, on `FieldSpec`, and everything derives from it."* | `admitPopulation`'s `field_not_classified` still refuses over a recaptured document, so a recapture cannot smuggle in an unclassified path | 🟠 partly applied |
| **Invariant 5** — *"Money is always derived."* | The corrected rerun emits `MeterFact`s; `UsageRecord` stays immutable and unpriced. **A recapture is a metered event and must not be a priced one** | live |
| **Invariant 7** — residency survives inference | A `scanned` recapture calls `resolveManagedService()` under **today's** config | C1 written, no caller |
| **Invariant 10** — *"An act with no authorisation is unrecordable."* | `MappingRetraction.authorizationId` and `Recapture.authorizationId` are both non-null | live |
| **G5 / G126** | Nominate-then-promote; the second person on the replacement mapping is what `mayRecapture()` arm 5 reads | G126 not applied |
| **G20** (applied) | `canonicalise()` is the `ReaderReplayKey` body; RFC 8785 or two writers disagree | ✅ applied |
| **G35** | Why `run_input_document` is a projection and not an entity | classification written |
| **G99 / G100 / G101** | §2.4's three queries in one `withTenantScope()` transaction; deny-on-NULL RLS; the plan bound exists partly because a long transaction holds a pooled connection (R5(vi)) | not applied |
| **G106** | A recapture under the replacement mapping is what finally supplies a real path, per R1 finding 3 | 🟠 partly |
| **G108** | The correction checker joins `npm run check`; it does not stand beside it | ✅ in `package.json` |
| **G111** | If a `Money` ever enters `ReaderRequest`, the replay key goes through the codec | not applied |
| **G118** | **No document may say the reader seam has an executor.** §2.9 designs the replay key and builds no executor | not applied |
| **G120** | Reader outcome persistence. **§2.9 records that its stated key does not carry the property its sentence claims** — challenged in writing with the quote, per working practice, not relitigated | not applied |
| **G123** | The pre-engine-filter blindness argument, reused one layer up as §2.8 | applied in `model/reconciliation.ts` §10 |
| **G125** | C13's header-set drift is why `header_set_drifted` is a retraction reason | not applied |
| **G128** | The `authority`-not-`configuration` argument, reused for recapture | ✅ applied |
| **G131** | Provenance on the replacement mapping's entries — the recapture inherits it | ✅ applied |
| **R2 / A5 / C14** | `promote_field_mapping`, `authority`, 38 capabilities. **This design mints none** | ruled, unbuilt |
| **C8** | `SourceDocument.mappingVersionId` — §2.4 Q1 is what it is for | ruled, unbuilt |
| **A2** | The document array's stated total key. **Hard dependency**: without it a corrected rerun is not deterministic | ruled, unbuilt |

### 7b. Owner rulings (O-1 … O-8) this needs answered before it can be built

| | Why correction needs it | If unanswered |
|---|---|---|
| **O-8** *(hard blocker)* | `RecapturePlan.maxDocuments` has no number, and `PRODUCT.md` forbids me inventing one | The plan type ships and **every plan refuses**. That is the intended failure and it is unusable in production |
| **O-5** *(hard blocker)* | The mapping grain. If a mapping pins to `(sourceEndpointId, headerSetHash)` then §2.4 Q1's result set is *that schema's documents*, not the endpoint's — a different and much smaller blast radius. **The recommended answer makes correction cheaper and I cannot assume it** | Q1's cardinality is unknown, so `maxDocuments` cannot be sized even once O-8 gives a number |
| **O-3** | A `scanned` recapture cannot evaluate `maxDataClassToService` | Every `scanned` item becomes `out_of_reach`. `tabular` correction — the common case — is unaffected |
| **O-2** | Only if a recapture uses the Bedrock vision fallback | Fallback unavailable; primary path unaffected |
| **O-1** | Whether the recapture work queue is Postgres `FOR UPDATE SKIP LOCKED` or a broker. §2.8 needs the capture and the enqueue in **one transaction**, which SQS cannot do — so the recommended answer is the one correction requires | Plan execution cannot be transactional; a partially-executed plan becomes possible, which `partially_completed` records but does not prevent |
| **O-6 / O-7** | Not reached. Correction re-uses whatever tier the first capture used | — |
| **O-4** | Not reached. A recapture reads no values into any prompt | — |

### 7c. One thing at the tree that contradicts the adjudication

> **C7 and C8 both say *"nothing in `model/` constructs a `SourceDocument`, so `tsc` stays green;
> land a fixture in the same commit."* The premise is true of `model/` and false of the repository.**
> Three live construction sites exist in `tests/`: `documentOf()` at
> `tests/model/reconciliation-conservation.test.ts:145`, `doc()` at
> `tests/model/reconciliation-passes.test.ts:120`, and `documentOf()` at
> `tests/model/learned-dispositions.test.ts:151`. Each supplies all eleven fields explicitly
> (`tenantId … purgedAt`), so **adding a required field to `SourceDocument` goes RED at three sites
> immediately** and `npm run check` fails at `npm test`, not at `typecheck`.
>
> **Why this matters and is not pedantry.** C7's and C8's stated conclusion — *"`tsc` will tell you
> nothing"* — leads an implementer to expect a green run and to write the fixture as an afterthought.
> The truth is the opposite and better: **the compiler already has a witness for `SourceDocument`, it
> just lives in `tests/`.** §5.10's lesson holds for `DocumentCapture`, `RecapturePlan`,
> `MappingRetraction` and `Recapture`, which genuinely have none — and it does **not** hold for the
> two `SourceDocument` fields in §2.3(i).

### 7d. One record correction found while designing (not mine to apply)

> **`model/policy.ts:1695` cites `learning.ts:1721` for `DATA_CLASS_RANK`. The declaration is at
> `model/learning.ts:1773`; line 1721 is BLANK**, in the whitespace after
> `CrossBoundarySignal` and before an unrelated docblock. Verified by opening both.
>
> The citation **resolves** — the file has a line 1721 — so `tools/check-citations.mjs` is
> structurally blind to it. This is the same class the adjudication's §9 records twice
> (`CLAUDE.md`'s `FieldSpec.path` at `:1584`, `HANDOFF:623`'s `model/domain.ts:876`) and the
> ingestion design record calls its ninth instance. **Here it is inside the comment whose whole
> subject is that the ladder is duplicated and that the duplicates must be found** — a §5.3 warning
> whose own pointer to one of the duplicates does not resolve to it.

---

## 8. Reproduce every claim on this page

```bash
grep -rn 'chain: RecordChain' model/*.ts                       # 2 — AuditEvent, DataAccessEvent
grep -rn 'actualFidelity' model/ | wc -l                       # 0
grep -rn 'PairingEvidence' model/*.ts | grep -v reconciliation # (empty)
grep -rn 'ExceptionStatus' model/*.ts                          # domain.ts + 2 dropped presentation.ts
grep -n 'data_corrected' model/domain.ts                       # 2763 (RunTrigger), 2906 (ReversalReason)
grep -rn 'DATA_CLASS_LADDER\|DATA_CLASS_RANK' model/*.ts       # 7 lines / 3 declarations
                                                               # learning.ts:1773 (exported, @dropped-for-v1)
                                                               # policy.ts:1705 (un-exported const)
                                                               # policy.ts:1088 (function-local in mayAdmit)
sed -n '1721p' model/learning.ts                               # blank — see §7d
awk '/^export const CAPABILITIES = \{/,/^\} as const/' model/access.ts \
  | grep -cE '^  [a-zA-Z]+:'                                   # 37
ls model/*.ts | wc -l ; grep -h '^export ' model/*.ts | wc -l  # 18 ; 832
grep -n 'requestOrdinal: requests.length' model/reconciliation.ts  # 2423
grep -n 'export function resolveManagedService' model/policy.ts    # 1781
grep -n 'unique_within' model/domain.ts                        # 367
```

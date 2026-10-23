# GREEN — long-running work made resumable: runs, the reader seam, ingestion, the fan-out

**Surface:** what must be durable so a node may die mid-run and another node finishes with no loss
and no double effect.
**Ruling this serves (input, not question):** *"everything that carries state, including session data
or other user artifacts, must be committed to the database."* Read as: **no process-local state a
retry or another node cannot reconstruct from durable storage.**

**Ground truth re-derived 9 Aug 2026 evening, by me, with the commands:**
`ls model/*.ts | wc -l` → **18** · `grep -h '^export ' model/*.ts | wc -l` → **832** ·
capabilities → **37** · resource classes → **13** · `npm test` → **tests 666 · pass 666 · fail 0 ·
skipped 0** (so the Postgres was reachable and `tests/db/tenant-isolation.test.ts` actually ran).

**Discipline note on this document.** Every `file:line` below was opened in this session. Where I
could not verify something I say *not verified*. No number in this document is invented: every bound
I introduce is required configuration that REFUSES on absence, and the one numeric ceiling I state is
**derived from `MAX_AUTHORIZATION_SECONDS`**, not chosen.

---

## 1. What already exists that this reuses — and what the ruling gets FOR FREE

### 1.1 The four things that make this surface cheap, all already in the tree

| | Where | What it gives the ruling |
|---|---|---|
| **The engine is a pure, total fold** | `model/reconciliation.ts:80-87` — *"THE ENGINE HAS NO AUTHORITY, NO CLOCK, NO IDENTITY AND NO NETWORK. … It is a pure, total fold."* | Re-running it over the same input is a **correct resume with no serialisation at all.** G120 says this in as many words: *"a pure fold can pause, hand out work and be resumed by a state machine"* (`docs/HANDOFF.md:846`) |
| **`fully_allocated` is ABSORBING** | `model/reconciliation.ts:1287-1291` — *"residual is monotonically non-increasing … it is what makes a re-run replayable"* | Replaying allocations is **idempotent by monotonicity**, not by a flag someone can forget to set. A second application of the same allocation set converges to the same ledger |
| **The verdict-to-a-row rule is already written** | `model/reconciliation.ts:2266-2267` — *"the verdict is WRITTEN TO A ROW and the rest of the engine reads the row — a re-run does not re-ask"* | The central persistence ruling of this surface is **already in the module header**. G120's *"`ReaderOutcome` must be persisted keyed by `(runId, requestOrdinal)`"* (`docs/HANDOFF.md:846`) is that sentence promoted to a requirement. I am implementing an existing sentence, not proposing one |
| **The outbox already exists and the record already noticed** | `model/billing.ts:181` `shippedAt: Timestamp \| null`; `docs/build/event-architecture-recommendation.md:275-289` — *"`UsageRecord` is a transactional outbox. It has been one since it was written"*, with the nine-line shipper SQL at `:291-302` using `FOR UPDATE SKIP LOCKED` | **The claim/lease/retry shape is a SECOND INSTANCE of a pattern the record has already chosen**, not new machinery. §4.3 (`:356-364`) already rules an in-Postgres job queue and states the reason SQS cannot substitute: *"It enqueues in the same transaction as the digest's `DataAccessEvent`, which SQS cannot"* |

### 1.2 What the ruling gets FOR FREE from decisions already taken

**(a) `AuthorizationGrant` is a reference, not a bearer token — so a resumed act on another node
needs to carry NOTHING.** `model/access.ts:1536-1548`: *"possession of the id is not possession of
the authority, and `redeemAuthorization()` re-derives the authority every time … a fired employee's
in-flight acts stop on the next call, not at the next expiry."* Under a bearer-token design a
stateless worker would have to carry a signed blob and the ruling would force a token cache. Here the
worker carries **one opaque id**, re-derives the authority against the row, and a withdrawal lands on
the next hop. **The statelessness the owner asked for is the design `model/access.ts` already
chose.**

**(b) The lease reaper needs no new access machinery.** `AUTHORIZATION_MAY_BE_ABSENT`
(`model/governance.ts:1232`) has `system: true`, and the comment above it names the exact act:
*"`system` is genuine machinery — a retention sweep, a scheduler tick, **the timeout clock that ends
a parked `await`**."* A lease reaper is that clock. `authorizationIsWellFormed()`
(`model/governance.ts:1254`) already admits it with a null `authorizationId`.

**(c) Idempotency of run admission is already ruled.** `model/domain.ts:2729-2731`: *"run admission
must be idempotent on (period, definition, slot-fill state); the trigger is then ATTRIBUTION, and
never identity."* So the *entry* to the whole surface is already required to be a no-op on repeat.

**(d) The retry rule for the seam is already ruled, including the meter hazard.**
`model/reconciliation.ts:2258-2261`: *"ZERO retries on `contract_violation` — retrying with a
different prompt is negotiating with the input. At most one retry on a TRANSPORT failure, and it must
reuse the same idempotency key or it double-meters."*

**(e) No DLQ is needed.** C21, `docs/build/ingestion-pipeline.md:416`: *"No DLQ as a separate store.
Failed files stay in the tenant's own landing bucket with a failure row in Postgres: one erasure
story, one residency configuration, RLS-scoped retry state."* Poison state is a column.

**(f) The transaction discipline and its only door already exist.** `withTenantScope()`
(`db/tenant-scope.ts:101`) is the only place `BEGIN` and `set_config(..., true)` are issued
(`:108`, `:123`), and `TenantPool` deliberately has **no `query` method** (`db/tenant-scope.ts:56-68`)
so a pool-level autocommitted statement is a compile error. `db/migrations/0001_tenancy_and_rls.sql:174-180`
is the RLS predicate and `:88-92` is the composite-`(tenant_id, id)`-key rule every new table must
follow.

**(g) The clock convention is already set and it keeps the engine clockless.**
`model/access.ts:979` and `:1031` take `now: Timestamp` **as a parameter**, and the reason is at
`:1637-1640`: *"`PrincipalContext.now` is a parameter rather than a clock read 'so a decision is
reproducible in an audit'."* Nothing in `model/` reads a clock. My design reads exactly one clock and
it is the **database's**.

### 1.3 What does NOT exist and that this surface needs

- **No table for a run.** `db/migrations/` has one file and it is tenancy + RLS (`ls db/migrations/*.sql | wc -l` → 1).
- **No reader executor.** G118, `docs/HANDOFF.md:844`: *"`applyReaderVerdicts` has zero production callers, `notImplementedReader` has zero callers anywhere."* I designed the durability **around** the executor, not the executor.
- **No `RunStatus` const and no wire mirror for it.** `ReconciliationRun.status` is an inline union at `model/domain.ts:2717`, restated on the wire at `docs/contracts/capability.openapi.yaml:312` and `:2592`, and it is **not** one of the five pairs in `tools/check-wire-mirror.mjs:73` — because that checker reads `export type X =` unions (`unionKinds`, `:111`) and `export const X = {} as const` values (`constValues`, `:126`), and an inline field union is neither. **This enum drifts unwatched, in two places.**
- **No lease, claim, attempt or poison vocabulary anywhere.** `grep -n "SKIP LOCKED\|lease\|claim"` across `docs/data-architecture.md`, `docs/build/green-service-topology.md`, `docs/build/red-service-topology.md` and `docs/build/event-architecture-recommendation.md` returns the shipper SQL at `:299` and §4.3 at `:361`, and nothing else on point. This is the genuinely new part and §2.5 argues it.
- **No queue-message variant on `SubjectLocation`.** Eleven variants, `model/governance.ts:1772-1819`; A3 (`docs/build/ingestion-pipeline.md:375`) already found this: *"The real gap is that no variant names a queue message."* §2.2 shows why my design needs no new variant.

---

## 2. The design

### R-1 — RULING: the durable artefact is the PINNED INPUT plus the STORED VERDICTS. Never the folded state.

**Is the engine's state serialisable? Not today, and the obstacle is load-bearing rather than
incidental.** `MatchingState` (`model/reconciliation.ts:1208`) holds `AdmittedItem`s whose `gross` is
`Money`, and after G65 `Money.amountMinor` is `bigint`. `canonicalise()` **refuses `bigint` rather
than serialising it** (`model/canonical.ts:66-71`), on the stated ground that inventing an encoding
would be *"a SECOND answer to how money is represented, on the bytes an audit chain signs … §5.3 with
the worst possible blast radius."* So serialising the fold's internals would require either the G111
money codec (not built — `docs/HANDOFF.md:837`) or a second money representation. **Rule: no.**

**Second, independent reason not to persist the state.** `AdmittedItem.untrustedDescription`
(`model/reconciliation.ts:833`) is counterparty prose. A table holding folded state holds a new
at-rest copy of personal data, and `SubjectLocation` (`model/governance.ts:1772`) has no variant for
it. Re-deriving the state from `SourceDocument` / `ExtractedLine` (`model/domain.ts:1840`, `:1835`) —
already registered — creates **no new erasure surface at all.**

**So: re-running the pure fold over the same input is the resume.** It needs zero serialisation of
internals, it is byte-identical to a rerun, and it makes crash-resume and `RunTrigger.rerun`
(`model/domain.ts:2763`) **the same code path** instead of two.

**What it costs, plainly.** A resume recomputes the WHOLE fold, not the remainder. Cost is
O(admitted items × strategies) of CPU per attempt with zero I/O. The crossover at which serialising
the state would be cheaper is **unmeasured** and I am not inventing a threshold for it.

**What it requires, and NEITHER precondition holds today.** Determinism of the fold given the same
input, which needs:

1. **A stated total order over the document arrays.** `docs/build/ingestion-pipeline.md:326`: *"the
   DOCUMENT array handed to `runSetReconciliation` is ordered by a **stated total key** — today
   unspecified anywhere, and a rerun hazard"*, and A2 at `:374` — *"Two reruns handing documents in
   different orders produce two different audits."* **This is a precondition of my design and it is
   already an open defect.**
2. **Everything the fold reads pinned to the run.** `ReconciliationRun.definitionVersion`
   (`model/domain.ts:2704`) pins the definition. **Nothing pins** `readerCandidateCap`,
   `similarityMaxChars`, `similarityMetric`, `subsetSumBound`, `toleranceDirection`, `obligationSide`,
   `fieldClassification` or `modelPromptEligible` — all of them caller-supplied per call on
   `SetReconciliationInput` (`model/reconciliation.ts:2589-2627`). **A policy edit between attempt 1
   and attempt 2 silently changes the fold, and nothing anywhere would notice.** That is the sharpest
   finding on this surface, and `RunPlan` below is the answer.

### 2.1 `model/execution.ts` — a NEW module. Why nothing existing carries it

**The standard: this is genuinely new and it is NOT §5.3, because —**

- `model/domain.ts`'s `ReconciliationRun` (`:2700`) is the **business record** of a run: trigger,
  period, inputs, status. It expresses whether work FINISHED. It says nothing about **who is
  currently responsible for it and until when**, and it is on the wire
  (`docs/contracts/capability.openapi.yaml:2580`), where execution state has no business being.
- `model/observability.ts` is telemetry, and telemetry is by its own rule the thing you are allowed
  to lose (`docs/build/event-architecture-recommendation.md:102-105`). A lease is not.
- `model/agents.ts` carries `DerivedAgentGrant` and step execution — an **agent's authority**, not a
  work item's deadline. And `grep -c 'AuthorizationGrantId\|authorizationId' model/agents.ts` → 0
  (recorded at `model/reconciliation.ts:2149-2151`), so it has no join key to the spine anyway.
- `model/deployment.ts` is **wholly `@dropped-for-v1`** (`docs/HANDOFF.md:87`).

**Cost of a nineteenth module, stated:** `node tools/check-doc-counts.mjs` will report every line
stating **18** modules STALE. That is the tool working, and it is the cheapest possible signal.
Whether the module may exist is Q6 below.

```ts
/* ==================================================================== *
 * model/execution.ts — WHO IS RESPONSIBLE FOR A UNIT OF WORK, AND UNTIL WHEN
 *
 * WHAT THIS MODULE IS. The types the owner's 9 Aug 2026 ruling needs: no
 * process-local state a retry or another node cannot reconstruct from durable
 * storage. It is the vocabulary of a CLAIM, a LEASE, an ATTEMPT and a PINNED
 * INPUT — none of which `ReconciliationRun` (`model/domain.ts:2700`) expresses,
 * because that type records whether work FINISHED and this one records who
 * holds it now.
 *
 * WHAT THIS MODULE MUST NEVER DO.
 *   code() { grep -vE '^[[:space:]]*(\*|/\*|//)' model/execution.ts; }
 *   code | grep -c 'new Date\|Date\.now'   → 0   the DB owns the lease clock
 *   code | grep -c 'throw '                → 0   failures are values
 *   code | grep -c ': any'                 → 0
 *   code | grep -c 'crypto\|createHash'    → 0   §2.3 — the hasher is the writer's
 *
 * 🛑 THERE IS EXACTLY ONE CLOCK FOR A LEASE AND IT IS THE DATABASE'S. Every
 * `Timestamp` here is a value READ BACK from a row, never a value this module
 * produced. That is the `PrincipalContext.now` posture (`model/access.ts:979`,
 * and the reason at `:1637-1640`) applied to a deadline: a node's own clock
 * skew must never be able to steal another node's work.
 * ==================================================================== */

import type {
  AuthorizationGrantId,
  DataClass,
  DefinitionId,
  FieldPath,
  RunId,
  SourceDocumentId,
  TenantId,
  Timestamp,
} from './kernel'
import type { AccessResourceClass } from './governance'
import { MAX_AUTHORIZATION_SECONDS } from './access.ts'
import type {
  PopulationSide,
  SimilarityMetric,
  SubsetSumBound,
  ToleranceDirection,
} from './reconciliation'
```

### 2.2 `RunPlan` — everything the fold reads, pinned

**Insertion point:** `model/execution.ts`, §1, first declaration.

```ts
/**
 * EVERYTHING THE FOLD READS, PINNED AT RUN ADMISSION AND READ BACK VERBATIM ON
 * EVERY ATTEMPT.
 *
 * 🛑 WHY THIS EXISTS. `SetReconciliationInput` (`model/reconciliation.ts:2589`)
 * takes eight bounds and two classification collections FROM THE CALLER, and
 * `ReconciliationRun` pins only `definitionVersion` (`model/domain.ts:2704`).
 * So a policy edit between two attempts at the same run silently changes the
 * fold, and R-1's whole resume story — re-run the pure fold over the same input
 * — is only true if "the same input" is a stored artefact rather than whatever
 * the caller happened to pass this time.
 *
 * ⚠️ ORDERED ARRAYS, NOT `ReadonlyMap` / `ReadonlySet`, AND THE REASON IS
 * MECHANICAL. `canonicalise()` REFUSES a `Map` outright (`model/canonical.ts:94-97`
 * — anything that is not the JSON data model is refused rather than silently
 * transformed). A plan that cannot canonicalise cannot be digested, and a plan
 * that cannot be digested cannot be witnessed. The caller builds the Map and the
 * Set at fold time; the PLAN stores the ordered pairs.
 *
 * ⚠️ `leftDocumentIds` / `rightDocumentIds` ARE THE TOTAL ORDER A2 SAYS NOBODY
 * STATED (`docs/build/ingestion-pipeline.md:326`, `:374`). Storing the array IS
 * the total key: the order the run was admitted with is the order every attempt
 * folds in.
 *
 * ⚠️ THIS IS SOUND ONLY BECAUSE A DOCUMENT ID MOVES WITH ITS CONTENT. R5(ii)
 * keys a document on `(tenantId, sourceEndpointId, sha256(bytes))`
 * (`docs/build/ingestion-pipeline.md:310-312`), so re-delivered bytes mint a new
 * id. If any path ever updates a `SourceDocument` in place, this plan stops
 * witnessing the fold's inputs and nothing here would detect it.
 */
export interface RunPlan {
  readonly runId: RunId
  readonly tenantId: TenantId
  readonly definitionId: DefinitionId
  /** Pins the definition as it stood — `model/domain.ts:2703`. */
  readonly definitionVersion: number
  readonly leftDocumentIds: readonly SourceDocumentId[]
  readonly rightDocumentIds: readonly SourceDocumentId[]
  readonly obligationSide: PopulationSide
  readonly toleranceDirection: ToleranceDirection
  readonly readerCandidateCap: number
  readonly similarityMaxChars: number
  readonly similarityMetric: SimilarityMetric
  readonly subsetSumBound: SubsetSumBound
  /** G106. Ordered by path so the plan canonicalises identically every time. */
  readonly fieldClassification: readonly (readonly [FieldPath, DataClass])[]
  readonly modelPromptEligible: readonly FieldPath[]
}
```

🛑 **THE DIGEST HALF OF THIS CONTROL IS BLOCKED, AND NO DOCUMENT MAY SAY THE PLAN IS HASHED.**
The per-strategy tolerances the fold reads carry `Money`, and `canonicalise()` refuses `bigint`
(`model/canonical.ts:66-71`). So **`runPlanDigest` cannot exist until G111's money codec exists**
(`docs/HANDOFF.md:837`). Until then the control is *read the plan row back and compare structurally*
— which detects an honest change and does **not** detect tampering. That is a weaker control and it
must be labelled as one, exactly as G118 requires of the seam.

### 2.3 `StoredReaderOutcome` and the two witnesses — `model/reconciliation.ts` §7

**Insertion point:** `model/reconciliation.ts`, immediately after `ReaderOutcome` (`:2307-2309`).

🛑 **THE HAZARD THIS CLOSES, VERIFIED AT THE TREE.** `buildReaderRequests` assigns
`requestOrdinal: requests.length` (`model/reconciliation.ts:2423`) — a **position in an array derived
from residue order × `openItems` order** (`openItems` at `:1445`). `applyReaderVerdicts` looks the
request up by ordinal (`:2464`) and, on a miss, does `continue` — a **silent skip** (`:2465`). On a
*hit against a different subject* it allocates money against the wrong pair with **no check anywhere
in the function**. G120 mandates `(runId, requestOrdinal)` as the persistence key. So the key the
ruling requires is positional over a derived array, and replaying a stored verdict is only correct if
that array is identical. **My design does not assume it. It witnesses it.**

```ts
/**
 * The candidate set at an ordinal, as a canonical injective STRING.
 *
 * NOT A HASH. Hashing needs `node:crypto` and `model/canonical.ts:60-64` rules
 * the hasher lives with the writer so `model/tsconfig.json` keeps compiling
 * standalone with no `package.json` and no `node_modules`. The writer may hash
 * this if it wants a fixed width; the model does not.
 *
 * LENGTH-PREFIXED, for the reason `itemKey` is (`:794-800`): `${a}-${b}` is
 * ambiguous the moment an id contains the delimiter, and a branded id is a
 * `string` with nothing at runtime enforcing a slug shape.
 *
 * 🛑 OVER `candidate.ref` ONLY — NEVER OVER `identifierForPrompt`. The ref is
 * what resolves the returned index; the identifier is a VALUE, and
 * `MatchGroup.keyValues` records why that matters — *"keyValues may hold
 * identifiers (a national id, in the KYC pack), so it carries a purge date like
 * any other personal-data-bearing row"* (`model/domain.ts:2774-2776`). A witness
 * over refs carries no personal data, so the column needs no purge date and
 * `SubjectLocation` needs no twelfth variant.
 * REJECTED ALTERNATIVE, PRESERVED: a witness over the prompt strings would also
 * catch a changed identifier under an unchanged ref. It was refused because it
 * would put a customer identifier in a new table to detect a case R5(ii)'s
 * content-hash keying already prevents.
 *
 * Bounded: the candidate list is capped by `readerCandidateCap`, which
 * `runSetReconciliation` refuses to default (`:2776-2778`).
 */
export function candidateWitnessOf(candidates: readonly ReaderCandidate[]): string {
  const parts: string[] = []
  for (const c of candidates) {
    const key = itemKey('right', c.ref)
    parts.push(`${key.length}:${key}`)
  }
  return parts.join('|')
}

/**
 * A `ReaderOutcome` AT REST — G120's *"persisted keyed by `(runId,
 * requestOrdinal)`"* — plus the two witnesses that make replaying it safe.
 *
 * ⚠️ DELIBERATELY NOT ASSERTED WITH `AssertNoTextDeep`, and the omission is the
 * same one `ReaderTokenUsage` already argues (`:2292-2298`):
 * `providerRequestId` IS a plain string, and it is transport metadata the
 * privileged side reads from the SDK — never the model's generated content.
 * `_ReaderVerdictHoldsNoTextDeep` (`:2246`) still holds over the VERDICT, which
 * is the half that came back from the quarantined side. Do not add the
 * assertion here and then delete the field to make it pass.
 */
export interface StoredReaderOutcome {
  readonly requestOrdinal: number
  /** `itemKey('left', request.subjectRef)` at settle time. */
  readonly subjectKey: string
  /** `candidateWitnessOf(request.candidates)` at settle time. */
  readonly candidateWitness: string
  readonly outcome: ReaderOutcome
}

export type OutcomeBindingDefect =
  | { kind: 'no_request_at_ordinal'; requestOrdinal: number }
  | { kind: 'subject_moved'; requestOrdinal: number }
  | { kind: 'candidate_set_moved'; requestOrdinal: number }
  | { kind: 'duplicate_stored_ordinal'; requestOrdinal: number }

export type _OutcomeBindingDefectHoldsNoText = AssertNoTextDeep<OutcomeBindingDefect>

/**
 * `missingOrdinals` is G120's *"a retry is granular"*, as a value: the ordinals
 * with no stored verdict are exactly the work still to do.
 */
export type OutcomeBinding =
  | {
      ok: true
      readonly outcomes: readonly ReaderOutcome[]
      readonly missingOrdinals: readonly number[]
    }
  | { ok: false; readonly defects: readonly OutcomeBindingDefect[] }

/**
 * Bind stored verdicts to a FRESHLY RE-DERIVED request array, or refuse.
 *
 * 🛑 IT REFUSES THE WHOLE FOLD ON ANY DEFECT, AND PARTIAL APPLICATION IS THE
 * BUG THIS EXISTS TO PREVENT. A moved subject means the stored verdict answers a
 * question about a DIFFERENT ROW, and applying any of the rest would be moving
 * money on the strength of an ordinal that no longer means what it meant. This
 * is `applyReaderVerdicts`'s own index-bounds argument (`:2442-2446`) one layer
 * out: *"an undefined candidate silently skipped is A9(d) reintroduced at the
 * seam."* An ordinal silently rebound is A9(d) reintroduced at the ROW.
 *
 * A gate returns a reasoned union and never a boolean (§5.2).
 */
export function bindStoredOutcomes(
  requests: readonly ReaderRequest[],
  stored: readonly StoredReaderOutcome[],
): OutcomeBinding {
  const byOrdinal = new Map<number, ReaderRequest>()
  for (const request of requests) byOrdinal.set(request.requestOrdinal, request)

  const defects: OutcomeBindingDefect[] = []
  const seen = new Set<number>()
  const outcomes: ReaderOutcome[] = []
  const bound = new Set<number>()

  for (const row of stored) {
    if (seen.has(row.requestOrdinal)) {
      defects.push({ kind: 'duplicate_stored_ordinal', requestOrdinal: row.requestOrdinal })
      continue
    }
    seen.add(row.requestOrdinal)

    const request = byOrdinal.get(row.requestOrdinal)
    if (request === undefined) {
      defects.push({ kind: 'no_request_at_ordinal', requestOrdinal: row.requestOrdinal })
      continue
    }
    if (itemKey('left', request.subjectRef) !== row.subjectKey) {
      defects.push({ kind: 'subject_moved', requestOrdinal: row.requestOrdinal })
      continue
    }
    if (candidateWitnessOf(request.candidates) !== row.candidateWitness) {
      defects.push({ kind: 'candidate_set_moved', requestOrdinal: row.requestOrdinal })
      continue
    }
    outcomes.push(row.outcome)
    bound.add(row.requestOrdinal)
  }

  if (defects.length > 0) return { ok: false, defects }

  const missingOrdinals: number[] = []
  for (const request of requests) {
    if (!bound.has(request.requestOrdinal)) missingOrdinals.push(request.requestOrdinal)
  }
  return { ok: true, outcomes, missingOrdinals }
}
```

**One new arm on `ReaderRefusal`** (`model/reconciliation.ts:2269-2279`), inserted after
`transport_failed` (`:2274`):

```ts
  /**
   * The request was claimed `WorkBound.maxAttempts` times and never settled.
   * A DISPOSITION, NOT A TRANSPORT RESULT.
   *
   * ⚠️ NOT §5.3. The eight arms above each describe the outcome of ONE call.
   * This describes the disposition of a REQUEST after N of them. Recording it
   * as `transport_failed` would launder *"we gave up"* into *"the network
   * failed once"*, which is G105's own distinction — a match and a judgement
   * must not be recorded as the same kind of event — applied to the seam.
   * Text-free, so `_ReaderRefusalHoldsNoText` (`:2281`) still holds.
   */
  | { kind: 'attempts_exhausted' }
```
It reaches the residue through the arm that already exists: `ResidueCause.reader_refused`
(`model/reconciliation.ts:2095`). **No new residue vocabulary.**

### 2.4 The three fields `SetReconciliationInput` / `SetReconciliationResult` gain

**Insertion point:** `model/reconciliation.ts:2623`, after `readerCandidateCap`.

```ts
  /**
   * Verdicts already stored for THIS run, keyed by `requestOrdinal`. G120: *a
   * rerun REPLAYS stored verdicts rather than re-asking.*
   *
   * REQUIRED, NOT OPTIONAL, and an EMPTY ARRAY is the first attempt. Under
   * `exactOptionalPropertyTypes` an optional field would make "no verdicts yet"
   * and "the caller forgot" the same value — which is the null-that-fails-open
   * shape C18 names (`docs/build/ingestion-pipeline.md:413`). The `TS2741` at
   * every existing construction site is the only evidence the field landed
   * (`ResidueEntry.settlement`'s own argument, `:2113`).
   */
  readonly storedReaderOutcomes: readonly StoredReaderOutcome[]
```

**Insertion point:** `model/reconciliation.ts:2660`, on `SetReconciliationResult`.

```ts
  /** Ordinals with no stored verdict — the granular retry set (G120). */
  readonly readerRequestsOutstanding: readonly number[]
  /**
   * Non-empty means a stored verdict did not bind to the re-derived request
   * array. 🛑 THE RUN MUST NOT BE RESUMED and its ledger must not be persisted
   * — the same posture `postconditions` already carries (`:2661-2662`).
   */
  readonly outcomeBindingDefects: readonly OutcomeBindingDefect[]
```

🛑 **This is a `model/reconciliation.ts` change and `CLAUDE.md` says plan before implementing it.**
It is not a small diff: the residue must be built **twice** — once to feed `buildReaderRequests`
(`:2954`), once after the verdicts fold — so the residue block at `:2911-2952` must be extracted into
a named pure `buildResidue(...)` called from both places. Duplicating it would be §5.3 inside one
file. Order in the fold becomes: passes → `buildResidue` → `buildReaderRequests` →
`bindStoredOutcomes` → `applyReaderVerdicts` → `buildResidue` again → `checkPostconditions`.

### 2.5 `WorkBound` — required, refusing, and with ONE ceiling I did not invent

**Insertion point:** `model/execution.ts`, §2.

```ts
/**
 * THE BOUNDS THE WORK LOOP REFUSES TO DEFAULT.
 *
 * A bound with no number is not a bound. Same posture as `IngestBound`
 * (`docs/build/ingestion-pipeline.md:399`) and O-8 (`:459`): FDE-set
 * configuration in a pack template, never a constant, and an unset bound
 * refuses the run. NONE OF THESE NUMBERS IS MINE — `PRODUCT.md` forbids
 * inventing one and this module invents none.
 */
export interface WorkBound {
  /** Claims of one request before it is refused `attempts_exhausted`. */
  readonly maxAttempts: number
  /** Seconds a claim is held. Ceiling DERIVED — see `validateWorkBound`. */
  readonly leaseSeconds: number
  readonly maxItemsPerClaim: number
  readonly maxRunAttempts: number
  /** Seconds before a run holding no live lease is reclaimable. */
  readonly staleRunSeconds: number
  /** R5(vi)'s conditional, mirrored: above this a run REFUSES, never chunks. */
  readonly maxResultRowsPerTransaction: number
}

export type WorkBoundDefect =
  | { kind: 'max_attempts_not_stated' }
  | { kind: 'lease_seconds_not_stated' }
  | { kind: 'max_items_per_claim_not_stated' }
  | { kind: 'max_run_attempts_not_stated' }
  | { kind: 'stale_run_seconds_not_stated' }
  | { kind: 'max_result_rows_not_stated' }
  /**
   * 🛑 THE ONE CONTROL IN THIS MODULE WORTH MORE THAN THE REST COMBINED, AND
   * ITS NUMBER IS DERIVED RATHER THAN CHOSEN.
   *
   * A lease may not outlive the authority the work runs under. G121 rules ONE
   * `AuthorizationGrant` per map execution (`docs/HANDOFF.md:847`); grants are
   * bounded by `MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1517`), which is
   * total over `AccessResourceClass` so a fourteenth class is a compile error.
   * A worker holding a 30-minute lease on a `tenant_data` act whose grant lives
   * 900 seconds (`model/access.ts:1530`) would be a worker acting for
   * twenty-one minutes under an expired authorisation — invariant 10's exact
   * failure, arrived at through a scheduling parameter.
   */
  | { kind: 'lease_exceeds_authorization_ceiling'; resourceClass: AccessResourceClass; ceilingSeconds: number }

export type _WorkBoundDefectHoldsNoText = never /* see note */

/**
 * Total, pure, no clock. Returns every defect rather than the first — a caller
 * fixing configuration wants the whole list.
 */
export function validateWorkBound(
  bound: WorkBound,
  resourceClass: AccessResourceClass,
): readonly WorkBoundDefect[] {
  const defects: WorkBoundDefect[] = []
  const positive = (n: number): boolean => Number.isInteger(n) && n >= 1
  if (!positive(bound.maxAttempts)) defects.push({ kind: 'max_attempts_not_stated' })
  if (!positive(bound.leaseSeconds)) defects.push({ kind: 'lease_seconds_not_stated' })
  if (!positive(bound.maxItemsPerClaim)) defects.push({ kind: 'max_items_per_claim_not_stated' })
  if (!positive(bound.maxRunAttempts)) defects.push({ kind: 'max_run_attempts_not_stated' })
  if (!positive(bound.staleRunSeconds)) defects.push({ kind: 'stale_run_seconds_not_stated' })
  if (!positive(bound.maxResultRowsPerTransaction)) {
    defects.push({ kind: 'max_result_rows_not_stated' })
  }
  const ceiling = MAX_AUTHORIZATION_SECONDS[resourceClass]
  if (positive(bound.leaseSeconds) && bound.leaseSeconds > ceiling) {
    defects.push({
      kind: 'lease_exceeds_authorization_ceiling',
      resourceClass,
      ceilingSeconds: ceiling,
    })
  }
  return defects
}
```

⚠️ **`_WorkBoundDefectHoldsNoText` cannot be written as an `AssertNoTextDeep`** because
`resourceClass` is a string union, and `AssertNoTextDeep`'s constraint (`model/reconciliation.ts:258`)
maps a *widened* `string` to `never`. A closed union of literals is not a widened `string`; whether
that assertion admits it is **not verified** and must be checked by writing it RED before trusting it
green, per the discipline at `:2237-2244`. Do not ship the line if it does not bite.

### 2.6 `RunExecution` and `RUN_STATUSES`

**Insertion point:** `model/execution.ts`, §3 — deliberately NOT on `ReconciliationRun`.

```ts
/**
 * A RUN'S EXECUTION STATE. Separate from `ReconciliationRun`
 * (`model/domain.ts:2700`) on purpose: that type is on the wire
 * (`docs/contracts/capability.openapi.yaml:2580`) and is the BUSINESS record of
 * a run. Who currently holds it, and how many times we have tried, is nobody's
 * business outside the plane and must not become a contract surface.
 *
 * Every `Timestamp` here is READ BACK from a row. This module reads no clock.
 */
export interface RunExecution {
  readonly tenantId: TenantId
  readonly runId: RunId
  readonly attempts: number
  readonly leaseExpiresAt: Timestamp | null
  /** G121: the ONE grant the reader map runs under. Null before the map arms. */
  readonly authorizationId: AuthorizationGrantId | null
  /** Non-null means the terminal ledger write committed. Guards double effect. */
  readonly resultsWrittenAt: Timestamp | null
}
```

**Insertion point:** `model/domain.ts`, replacing the inline union at `:2717`.

```ts
/**
 * A RUN'S LIFECYCLE, EXTRACTED FROM AN INLINE FIELD UNION FOR TWO REASONS.
 *
 * 1. `awaiting_readers` is the state the owner's statelessness ruling turns on
 *    and the four-arm union could not express: the fold is done, N verdicts are
 *    outstanding, and NO NODE NEEDS TO HOLD ANYTHING. Folding it into `running`
 *    makes a legitimately parked run indistinguishable from a dead node's run,
 *    and the lease reaper cannot tell them apart — which is precisely the
 *    distinction the reaper exists to make.
 * 2. ⚠️ THE INLINE UNION DRIFTS UNWATCHED, IN TWO PLACES.
 *    `docs/contracts/capability.openapi.yaml:312` and `:2592` both restate it,
 *    and it is NOT one of the five pairs in `tools/check-wire-mirror.mjs:73` —
 *    that checker reads `export type X =` unions (`:111`) and
 *    `export const X = {} as const` values (`:126`), and an inline field union
 *    is neither. Naming it makes a SIXTH PAIR possible, which is a line in
 *    `PAIRS` plus a test.
 *
 * `awaiting_readers` is NOT a second spelling of `running` (§5.3): `queued`
 * means no node has started, `running` means a node holds a live lease,
 * `awaiting_readers` means nobody needs to. Three different facts about who is
 * responsible.
 */
export const RUN_STATUSES = {
  queued: 'queued',
  running: 'running',
  awaitingReaders: 'awaiting_readers',
  completed: 'completed',
  failed: 'failed',
} as const
export type RunStatus = (typeof RUN_STATUSES)[keyof typeof RUN_STATUSES]
```

**Then three more edits, none optional:**
- `model/domain.ts:2717` → `status: RunStatus`.
- `docs/contracts/capability.openapi.yaml:312` and `:2592` → `enum: [queued, running, awaiting_readers, completed, failed]`. *Fixing the model does not fix the contract* (`docs/HANDOFF.md:1855-1858`).
- `tools/check-wire-mirror.mjs:73` gains a sixth pair. The wire path is an inline enum inside a property, so verify the checker's `path` resolver reaches `['properties','status','enum']` on a flow-mapping line — **not verified**; if it cannot, that is a checker change, not a reason to skip the mirror.

### 2.7 The migration — `db/migrations/0002_run_execution_and_reader_work.sql`

**One table for the queue AND the outcomes, because they share G120's key.** This is the
`shippedAt IS NULL` trick, second instance: `docs/build/event-architecture-recommendation.md:275-289`
records that `UsageRecord` is already an outbox because the outbox predicate is a **column on the
record table**, not a second table. `outcome_kind IS NULL` is the same predicate on the same shape.
No second store, no DLQ (C21, `docs/build/ingestion-pipeline.md:416`), no second vocabulary.

```sql
-- =====================================================================
-- 0002 — RUN EXECUTION AND THE READER WORK QUEUE.
--
-- RULINGS THIS APPLIES: G97 (text ids) · G100 (deny on NULL, FORCE RLS) ·
-- G101 (every query inside an explicit transaction) · G88 (forward-only) ·
-- G120 (ReaderOutcome persisted keyed by (runId, requestOrdinal)) ·
-- G121 (one AuthorizationGrant per map execution) ·
-- event-architecture §4.3 (an in-Postgres job queue, no broker).
--
-- 🛑 THE QUEUE IS A PREDICATE ON THE OUTCOME TABLE, NOT A SECOND TABLE.
--    `outcome_kind IS NULL` is `shippedAt IS NULL` again — the shape
--    event-architecture-recommendation.md:275-289 says the model already had.
--
-- 🛑 WHAT IS DELIBERATELY NOT HERE — the meter outbox columns. 0001 withheld
--    them pending G30 (0001:18-23) and they belong in their own migration with
--    the per-plane sequence counter, which is plane-scoped and not
--    tenant-scoped. Keeping this file what its name says it is is 0001's own
--    stated discipline.
-- =====================================================================

CREATE TABLE run_execution (
  tenant_id         text        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  run_id            text        NOT NULL,
  status            text        NOT NULL,
  -- R-1: the pinned input. jsonb, canonicalised by the WRITER (model/canonical.ts).
  plan              jsonb       NOT NULL,
  attempts          integer     NOT NULL DEFAULT 0,
  lease_expires_at  timestamptz,
  authorization_id  text,
  results_written_at timestamptz,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  -- 0001:88-92 — every scoped table is keyed (tenant_id, id), so a
  -- cross-tenant reference is unrepresentable rather than merely unlikely.
  PRIMARY KEY (tenant_id, run_id)
);

CREATE TABLE reader_request_attempt (
  tenant_id           text        NOT NULL,
  run_id              text        NOT NULL,
  request_ordinal     integer     NOT NULL,

  -- R-2, the re-derivation witnesses. Over ItemRefs only; no VALUE, so no
  -- purge date and no twelfth SubjectLocation variant.
  subject_key         text        NOT NULL,
  candidate_witness   text        NOT NULL,

  attempts            integer     NOT NULL DEFAULT 0,
  lease_expires_at    timestamptz,
  -- G121: ONE grant per map execution, carried on every act with its ordinal.
  authorization_id    text        NOT NULL,

  -- the outcome. NULL until settled; NULL IS the queue predicate.
  outcome_kind        text,       -- 'verdict' | 'refused'
  verdict_kind        text,       -- 'candidate'|'several'|'no_candidate'|'unreadable'
  candidate_index     integer,
  confidence_bp       integer,
  refusal_kind        text,
  input_tokens        integer,
  output_tokens       integer,
  model_entry_id      text,
  provider_request_id text,
  settled_at          timestamptz,

  PRIMARY KEY (tenant_id, run_id, request_ordinal),
  FOREIGN KEY (tenant_id, run_id)
    REFERENCES run_execution (tenant_id, run_id) ON DELETE CASCADE,

  -- A settled row is settled COMPLETELY. Half a verdict is not a state.
  CONSTRAINT settled_together CHECK (
    (outcome_kind IS NULL AND settled_at IS NULL) OR
    (outcome_kind IS NOT NULL AND settled_at IS NOT NULL)
  ),
  -- §5.5: do not make the invalid state legal.
  CONSTRAINT candidate_carries_index CHECK (
    verdict_kind IS DISTINCT FROM 'candidate' OR candidate_index IS NOT NULL
  )
);

-- The queue's own index. Partial, so it is the size of the OUTSTANDING work.
CREATE INDEX reader_request_attempt_ready
  ON reader_request_attempt (tenant_id, run_id, request_ordinal)
  WHERE outcome_kind IS NULL;

ALTER TABLE run_execution           ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_execution           FORCE  ROW LEVEL SECURITY;
ALTER TABLE reader_request_attempt  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reader_request_attempt  FORCE  ROW LEVEL SECURITY;

-- THE PREDICATE, VERBATIM FROM 0001:174-180 AND ITS ARGUMENT AT :138-171.
-- `current_setting(..., true)` so an unset variable returns NULL, `nullif(...,'')`
-- because a reverted GUC reads back as the empty string, and `tenant_id = NULL`
-- is not TRUE — so THE POLICY DENIES ON NULL and a forgotten transaction yields
-- an empty result set rather than another tenant's rows.
-- WITH CHECK is stated explicitly so a later FOR SELECT / FOR ALL edit cannot
-- silently drop the write half.
CREATE POLICY run_execution_rls ON run_execution
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

CREATE POLICY reader_request_attempt_rls ON reader_request_attempt
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

GRANT SELECT, INSERT, UPDATE ON run_execution          TO reconcile_app;
GRANT SELECT, INSERT, UPDATE ON reader_request_attempt TO reconcile_app;
-- No DELETE. Retention is a separate act under a separate authority; a worker
-- that could delete a work item could delete the evidence a call was made.
```

### 2.8 The claim / lease / settle SQL — `db/work-queue.ts`

Every function takes a `ScopedClient` (`db/tenant-scope.ts:50`), so **it is unissuable outside
`withTenantScope()`** — a type-level version of G99's rule rather than a review convention, in the
shape `TenantPool`'s missing `query` already sets (`db/tenant-scope.ts:56-68`).

```sql
-- CLAIM. One transaction. No network call inside it.
--
-- ⚠️ NO TENANT PREDICATE. RLS supplies it. That is the property
-- tests/db/tenant-isolation.test.ts:12-16 asserts by reading the statement TEXT
-- that reached the server, and the new test does the same for this statement.
--
-- ⚠️ `now()` IS TRANSACTION TIME (`transaction_timestamp()`), SO EVERY ROW IN
-- ONE CLAIM GETS THE SAME DEADLINE. `clock_timestamp()` would give each row a
-- different one and a worker could hold half a batch past its lease.
WITH candidate AS (
  SELECT run_id, request_ordinal
    FROM reader_request_attempt
   WHERE outcome_kind IS NULL
     AND (lease_expires_at IS NULL OR lease_expires_at < now())
     AND attempts < $1                       -- WorkBound.maxAttempts
   ORDER BY run_id, request_ordinal          -- deterministic, reproducible
   LIMIT $2                                  -- WorkBound.maxItemsPerClaim
     FOR UPDATE SKIP LOCKED
)
UPDATE reader_request_attempt a
   SET attempts = a.attempts + 1,
       lease_expires_at = now() + make_interval(secs => $3)   -- leaseSeconds
  FROM candidate c
 WHERE a.run_id = c.run_id AND a.request_ordinal = c.request_ordinal
RETURNING a.run_id, a.request_ordinal, a.subject_key, a.candidate_witness,
          a.attempts, a.authorization_id, a.lease_expires_at;
```

```sql
-- SETTLE. One transaction, and it carries the meter rows with it.
-- ON CONFLICT DO NOTHING is the durable no-op: a second node that made the same
-- call writes nothing and learns it lost.
UPDATE reader_request_attempt
   SET outcome_kind = $3, verdict_kind = $4, candidate_index = $5,
       confidence_bp = $6, refusal_kind = $7,
       input_tokens = $8, output_tokens = $9,
       model_entry_id = $10, provider_request_id = $11,
       settled_at = now(), lease_expires_at = NULL
 WHERE run_id = $1 AND request_ordinal = $2
   AND outcome_kind IS NULL;      -- ← THE GUARD. rowCount 0 means: already settled.
```

```sql
-- POISON. No DLQ (C21). The row stays where it is and stops being claimable.
UPDATE reader_request_attempt
   SET outcome_kind = 'refused', refusal_kind = 'attempts_exhausted',
       settled_at = now(), lease_expires_at = NULL
 WHERE outcome_kind IS NULL AND attempts >= $1
```

```sql
-- THE GUARDED STATUS TRANSITION — the control that makes double effect impossible.
UPDATE run_execution
   SET status = $2, lease_expires_at = NULL
 WHERE run_id = $1 AND status = $3       -- the EXPECTED prior status
```
`rowCount === 0` means another node already advanced it, and the losing node's work is **discarded,
not merged**. Every transition in the machine goes through this one statement.

```sql
-- THE REAPER. A `system` act with a null authorizationId, which
-- AUTHORIZATION_MAY_BE_ABSENT (model/governance.ts:1232) permits and whose
-- comment names "the timeout clock that ends a parked await" as the example.
UPDATE run_execution
   SET status = CASE WHEN attempts >= $1 THEN 'failed' ELSE 'queued' END,
       lease_expires_at = NULL
 WHERE status = 'running' AND lease_expires_at < now()
```

**The state machine, and it is a table not a diagram:**

| from | to | who | guard |
|---|---|---|---|
| — | `queued` | run admission | idempotent on `(period, definition, slot-fill state)` — `model/domain.ts:2729-2731` |
| `queued` | `running` | a worker | guarded transition + `attempts < maxRunAttempts` |
| `running` | `awaiting_readers` | the folding worker | guarded; the reader rows are INSERTed in the SAME transaction as this transition |
| `running` | `queued` \| `failed` | the reaper | `lease_expires_at < now()` |
| `awaiting_readers` | `running` | any worker, when `missingOrdinals` is empty | guarded |
| `running` | `completed` | the terminal write | guarded, `results_written_at` set in the same transaction |
| any | `failed` | postconditions non-empty, or `outcomeBindingDefects` non-empty | `:2661-2662` — *"Do not persist it"* |

### 2.9 Where a worker gets a tenant — and it is not from the message

**RULING R-3(d): the worker sweeps tenants from the downward-published registry, and every queue
read happens inside `withTenantScope()`.**

The problem is real: `withTenantScope()` needs a `tenantId` from an authenticated session
(`db/tenant-scope.ts:98-99`) and a worker has none. R5(iv)
(`docs/build/ingestion-pipeline.md:328-336`) answers the identical question for ingestion —
*"A queue message is a request … the consumer takes bucket and key only and resolves the tenant from
the control-plane-provisioned prefix registry under the data-plane role"* — and invariant 1, copied
not paraphrased, forbids the alternative. **Reuse that registry.** It is provisioning configuration
published downward, which is invariant 3's own direction of travel, and it is not tenant data.

`LISTEN`/`NOTIFY` may **wake** the sweep and may **not select** the tenant: a NOTIFY payload naming a
tenant is a tenant on a message, and R5(iv) says a tenant on a message is *"a hint that is
re-derived and compared, refusing on mismatch."* And per
`docs/build/event-architecture-recommendation.md:304-307`, **the poll is the correctness mechanism and
`NOTIFY` is the optimisation; getting that backwards is the classic bug in this pattern.**

**Rejected alternative, preserved with its reason.** A small lease table outside RLS carrying only
`(tenant_id, run_id, request_ordinal, lease_expires_at, attempts)` — no tenant content — claimed in
one statement across all tenants. It is defensible on the same argument `UsageRecord` makes for
shipping an opaque `AuthorizationGrantId` rather than a `UserId` (`model/billing.ts:198-211`), and it
is O(1) per sweep instead of O(tenants). **Refused because it puts a table outside RLS**, which is
exactly what G103 refused for the extraction-rule cache (`docs/HANDOFF.md:829`) on the ground that
*"four of the model's invariants are enforced BY THE STORE."* The cost of the refusal is real and
stated in §6: an O(tenants) sweep in the hosted topology, free under BYOA. Q5 puts it to the owner.

### 2.10 Idempotent versus effectful, and the durable key for each

**At-least-once is the default everywhere.** The table below is the whole answer.

| Work | Repeat-safe? | The durable key that makes a repeat a no-op |
|---|---|---|
| the fold (`runSetReconciliation`) | ✅ **pure, total, deterministic** (`:80-87`) | **none needed.** This is the cheapest resume in the system |
| `buildReaderRequests`, `buildResidue`, `checkPostconditions`, `bindStoredOutcomes` | ✅ pure | none needed |
| a **model call** | 🛑 costs money | `reader_request_attempt (tenant_id, run_id, request_ordinal)` PK, settled under `AND outcome_kind IS NULL`. A second settle writes nothing |
| a **`MeterFact` → `UsageRecord`** | 🛑 append-only, *"no compensating instrument"* (`model/billing.ts:136`) | `UNIQUE (tenant_id, idempotency_key)`, where the key **already embeds the meter**: `${providerRequestId}#${meter}` (`model/reconciliation.ts:2564`, `:2570`) and `${runId}#${meter}` (`:2580`) |
| **`UsageRecord.sequence`** | 🛑 a gap must be *detectable* (`model/billing.ts:156-158`) | a **counter ROW** updated in the same transaction. See the warning below |
| the **terminal ledger write** (allocations, `MatchGroup`) | 🛑 | one transaction: insert the rows, then `UPDATE run_execution … WHERE status='running'`. `rowCount 0` → ROLLBACK everything |
| an **outbound correspondence** | 🛑 an egress | **not this surface.** §5.5's two-phase shape: intent row in the act's transaction, materialise per recipient at send time under a fresh `authorize()` (`docs/build/event-architecture-recommendation.md:85`) |

🛑 **DO NOT USE A POSTGRES `SEQUENCE` FOR `UsageRecord.sequence`, AND THE OBVIOUS IMPLEMENTATION IS
THE WRONG ONE.** `nextval` is **non-transactional**: it does not roll back. Any aborted metering
transaction therefore leaves a permanent hole, and `model/billing.ts:156-158` says the field exists so
that *"a gap in this sequence is detectable rather than merely absent."* **The obvious implementation
destroys the single property the field was added for.** The counter must be a row —
`UPDATE dp_usage_sequence SET next_sequence = next_sequence + $n WHERE data_plane_id = $1 RETURNING
next_sequence - $n` — inside the same transaction as the insert. Cost: it serialises meter writes per
plane. `docs/build/event-architecture-recommendation.md:320` puts the volume at *"under 1 row/sec
average. Unremarkable"* — quoted from that document, which sources `persistence-design.md:213-217`;
I did not measure it.

⚠️ **The counter table is plane-scoped, not tenant-scoped, so it is not under RLS.** That is what
`UsageRecord.sequence`'s per-plane monotonicity requires — it is a cost of an existing field, not of
this design — and it must be stated in the migration that adds it.

### 2.11 Invariant 5 — what must be durable so metering survives a node death

**The fan-in is the first token producer in the system** (G120, `docs/HANDOFF.md:846`; V2 in
`docs/HANDOFF.md` §4.1). Four things must be durable, and **the asymmetry is the finding:**

1. **The token counts, in the settle transaction, on the `reader_request_attempt` row.**
   `ReaderTokenUsage` counts are provider-reported and **NEVER ESTIMATED** — *"If the provider
   response omits them, the caller passes `null` and NO TOKEN METER IS EMITTED"*, because an estimate
   in an append-only table with no compensating instrument *"is fabricated revenue data"*
   (`model/reconciliation.ts:2284-2290`). The row is the only record of them.
2. **The `dp_usage_record` rows, `shipped_at IS NULL`** — the outbox that `model/billing.ts:181`
   already is, with the nine-line shipper at `docs/build/event-architecture-recommendation.md:291-302`.
3. **The per-plane sequence counter row** (§2.10).
4. **`authorizationId` on every row** (`model/billing.ts:223`) — G121's one grant per map.

🛑 **THE HONEST FAILURE MODE IS UNDER-REPORTING, NOT DOUBLE-BILLING, AND THAT INVERTS THE NAIVE
EXPECTATION.** Two orderings:

- **Die before the call.** Nothing spent. Retry is free.
- **Die after the provider answered, before the settle commits.** Money spent, no outcome row, no
  meter. The retry makes a **second** call with a **new** `providerRequestId`, so `tokenMeterFacts`
  (`:2558`) mints a second pair of idempotency keys and both calls are metered — which is **truthful,
  because both calls happened.** The loss is the FIRST call: spent and unbilled.

So the risk on this surface is **a spent call with no meter**, and the compensating instrument
`model/billing.ts:136` says the meter table lacks lives **beside the queue instead**: `attempts` is
incremented in the CLAIM transaction, before the call. **`attempts` minus settled-outcomes on a
finished run is a countable, queryable number of spent-and-unmetered calls.** It is not a correction
and it does not touch the append-only table; it is a visible discrepancy where today there would be
silence. **I did not invent a reconciliation against any provider usage API** — none is verified to
exist and PRODUCT.md forbids the figure.

⚠️ And the double-metering hazard the module already names is a *different* one and my design does not
reopen it: *"At most one retry on a TRANSPORT failure, and it must reuse the same idempotency key or
it double-meters"* (`:2260-2261`). A retry **inside** one attempt reuses the key; a retry **across**
attempts is a new call with a new key. Those are two acts and the record must show two.

**And this closes G30 by DERIVATION, not by decision.** G30's open half is *"whether the dedup key is
`(idempotencyKey)` or `(idempotencyKey, meter)`"* (`docs/HANDOFF.md:684`), and
`db/migrations/0001_tenancy_and_rls.sql:18-23` withheld the outbox columns waiting for it.
`tokenMeterFacts` **already appends `#${meter}`** (`:2564`, `:2570`), `runMeterFact` does the same
(`:2580`), and §8's header rules that the live recommendation to use the bare provider id **was wrong
and would silently drop output tokens** (`:2521-2530`). So the key is already meter-qualified in the
only producer that exists, and `UNIQUE (tenant_id, idempotency_key)` is correct;
`(idempotencyKey, meter)` would be a **second answer to a question the producer has already closed**.
Per the trap at `docs/HANDOFF.md:1915-1922` — *"When you defer a finding, write down whether it needs
a decision or a derivation. If it is a derivation, it is not deferrable"* — I put this as Q7 with the
quote rather than acting on a §3 row.

### 2.12 The transaction collision, and the bound that refuses

**The collision, stated.** G99 (`docs/HANDOFF.md:825`) requires every query inside an explicit
transaction and `withTenantScope()` opens it (`db/tenant-scope.ts:101`). G101 (`:827`) assumes
**transaction-mode pooling from day one**, so a held transaction holds a server-side backend out of
the pool. A reader map is N model calls at network latency. **If the map ran inside one
`withTenantScope()`, one run would pin one backend for the duration of N inference calls — and under
transaction-mode pooling that is the pool, not a connection.**

**The resolution has two halves and neither is silent chunking.**

**(a) A STRUCTURAL RULE: no transaction spans a network call.** Three transactions per request, never
one — CLAIM, then (no transaction) the model call, then SETTLE. This is the same shape R5(vi) chose
for the shred and for the same reason, and R5's own conditional applies verbatim
(`docs/build/ingestion-pipeline.md:352-358`): *"a very large file in one transaction is a long
transaction holding a server connection under transaction-mode pooling (G101). So the bound must be
stated and refused on, not defaulted."*

**(b) A STATED BOUND THAT REFUSES.** `WorkBound.maxResultRowsPerTransaction`: a run whose terminal
result exceeds it **REFUSES, loudly** — a new `SetReconciliationRefusal` arm
`{ kind: 'result_rows_exceed_transaction_bound'; rows: number; bound: number }` at
`model/reconciliation.ts:2629`, text-free so `_SetReconciliationRefusalHoldsNoText` (`:2638`) holds.
And R5(vi)'s closing sentence is the ruling for later too: *"If chunking is later ruled in, the
durable cursor returns with it"* — and with it the requirement that `MatchGroupId` be **derived** from
`(runId, side, ref-set)` rather than minted, because an at-least-once terminal write with randomly
minted ids can never be idempotent. Q8 puts that to the owner rather than deciding it.

**Where time enters the system, and how it is kept out of the pure core.** Exactly two places, and
neither is in `model/`:
- **the database**, via `now()` in the claim, settle, poison and reaper statements. It is the only
  clock a lease consults, so no node's skew can steal another node's work.
- **the writer**, when it stamps `AuditEvent`, `DataAccessEvent` and `UsageRecord`.

`model/execution.ts` reads no clock and its header carries the grep to prove it.
`model/reconciliation.ts`'s existing control — `code | grep -c 'new Date\|Date.now'` → 0 (`:19`) —
is untouched by every declaration in this document. Where a model function needs a time it takes one
as a parameter, which is `PrincipalContext.now`'s own posture (`model/access.ts:979`, `:1637-1640`).

---

## 3. What each declaration REFUSES, and what fails closed

| Declaration | Refuses | Fails closed how |
|---|---|---|
| `bindStoredOutcomes()` | a stored ordinal with no request, a **moved subject**, a **moved candidate set**, a duplicate ordinal | `ok: false` with every defect, and the CALLER MUST NOT RESUME. Partial application is refused, so a rebound ordinal can never move money |
| `validateWorkBound()` | every absent or non-positive bound, **and a lease longer than the authorisation ceiling** | an unset bound refuses the run. The ceiling comes from `MAX_AUTHORIZATION_SECONDS` (`model/access.ts:1517`), which is total over `AccessResourceClass`, so a fourteenth class is a compile error rather than an unbounded lease |
| `ReaderRefusal.attempts_exhausted` | nothing; it RECORDS a refusal | the subject stays in the residue under `ResidueCause.reader_refused` (`:2095`). It is never dropped and never re-dispositioned as a match |
| `SetReconciliationResult.outcomeBindingDefects` | — | non-empty ⇒ the run's ledger is not persisted, the same posture `postconditions` carries (`:2661-2662`) |
| `SetReconciliationInput.storedReaderOutcomes` | — | REQUIRED and non-nullable, so *"none stored"* and *"the caller forgot"* cannot be the same value |
| `run_execution` RLS policy | a read with `app.tenant_id` unset | **empty result set**, per G100's deny-on-NULL (`0001:158-162`). A worker that forgot `withTenantScope()` claims nothing rather than claiming another tenant's work |
| the CLAIM statement | a row already leased, already settled, or at `maxAttempts` | `FOR UPDATE SKIP LOCKED` — two nodes cannot both hold one request |
| the SETTLE statement | a second settle of the same ordinal | `AND outcome_kind IS NULL` ⇒ `rowCount 0`. The losing node learns it lost |
| the guarded transition | a transition from an unexpected prior status | `rowCount 0` ⇒ the losing node's work is DISCARDED, never merged |
| `settled_together` / `candidate_carries_index` CHECKs | half a settled outcome; a `candidate` verdict with no index | the invalid state is not legal (§5.5) |
| no `DELETE` grant | a worker deleting a work item | it cannot delete the evidence a paid call was made |
| `UNIQUE (tenant_id, idempotency_key)` | a replayed meter | `ON CONFLICT DO NOTHING` — a repeat is a no-op, not a second charge |

---

## 4. The fixtures that witness it — and why `tsc` alone tells nobody anything

**§5.10, stated for these declarations specifically.** `WorkBound` is a plain interface;
`validateWorkBound` is total; `StoredReaderOutcome` is four fields. **Adding a field, choosing a
wrong ceiling, or deleting the `subjectKey` comparison inside `bindStoredOutcomes` all keep `tsc`
green.** `MAX_AUTHORIZATION_SECONDS` is a total `Record` and it bites only where something INDEXES it
with a wrong class — and nothing in a types-only model does. So every declaration above ships with a
fixture **in the same commit** or the compiler has told nobody anything.

| Fixture | What it witnesses that a type cannot |
|---|---|
| `tests/model/reader-outcome-binding.test.ts` — six cases over hand-built `ReaderRequest[]` + `StoredReaderOutcome[]`: all-bound · granular (3 requests, 1 stored ⇒ `missingOrdinals: [1,2]`) · **subject moved ⇒ `ok:false`** · candidate set moved · duplicate ordinal · ordinal past the array | that the **positional key is actually checked.** This is the fixture the whole design rests on |
| `tests/model/work-bound.test.ts` — all-absent ⇒ six defects · `leaseSeconds = MAX_AUTHORIZATION_SECONDS.tenant_data + 1` ⇒ `lease_exceeds_authorization_ceiling` with the class and the ceiling as operands · `leaseSeconds = ceiling` ⇒ admitted | that the ceiling is **derived from the access module** rather than a number somebody typed. It also indexes the total `Record`, which is the only way that totality bites (§5.10) |
| `tests/model/run-plan.test.ts` — construct a `RunPlan`, `canonicalise()` it, assert the money-free plan canonicalises and that a plan carrying a `Money` **is REFUSED** | it pins the **G111 dependency as an executable fact** instead of a comment. The day the codec lands, the refusing assertion is the thing that turns red and tells someone to revisit the digest |
| `tests/scenarios/resume-determinism.test.ts` — over every scenario in `tests/scenarios/recon-corpus.ts` (3,561 lines, already built): fold twice with `storedReaderOutcomes: []` and assert the two `SetReconciliationResult`s are **deep-equal including residue ORDER**; then fold with a synthetic stored outcome and assert equality with `applyReaderVerdicts` applied by hand | **that the fold is deterministic at all.** R-1's entire resume story rests on this and NOTHING tests it today. The corpus already treats residue order as part of the expectation (`tests/scenarios/recon-corpus.ts` header) |
| `tests/db/reader-queue.test.ts` — against the real Postgres, in the shape of `tests/db/tenant-isolation.test.ts` and **skipping LOUDLY** when none is reachable (`:66-83`): two concurrent claims of one row ⇒ exactly one winner · a lapsed lease is re-claimable, a live one is not · **the claim SQL contains no tenant predicate**, asserted by reading the statement text (`:12-16`) · a settle under tenant A cannot touch tenant B's row · `attempts >= maxAttempts` ⇒ unclaimable and **still present** · two nodes race the guarded transition ⇒ the second gets `rowCount 0` · two concurrent meter inserts get distinct sequences and an **aborted** insert leaves **no gap** | that `SKIP LOCKED`, the lease, the guard and the counter behave as claimed against a real server. The last case is the one that proves the counter is a ROW and not a `SEQUENCE` |

⚠️ Every existing construction site of `SetReconciliationInput` — throughout `tests/scenarios/recon-corpus.ts` and
`tests/scenarios/engine-behaviour.test.ts` — must gain `storedReaderOutcomes: []`. **That `TS2741`
sweep is the only evidence the field landed**, per `ResidueEntry.settlement`'s own argument (`:2113`).

---

## 5. The mutations that prove each control bites

Each row is a change you make on purpose, and the test that must go red. A control whose mutation
leaves the suite green is §5.6 — *a control that passes while asserting nothing*.

| Mutation | Expected failure |
|---|---|
| delete the `itemKey('left', request.subjectRef) !== row.subjectKey` comparison in `bindStoredOutcomes` | `reader-outcome-binding` **subject moved** returns `ok: true` and the fold allocates against the wrong item. The test asserting `ok:false` goes red |
| delete the `candidateWitnessOf(...) !== row.candidateWitness` comparison | **candidate set moved** goes red |
| make `bindStoredOutcomes` return `ok: true` with the defect-free subset instead of refusing | the partial-application case goes red — proving refusal is total rather than best-effort |
| build the witness over `identifierForPrompt` instead of `ItemRef` | a test asserting the witness string contains **no** admitted identifier goes red — the control that keeps a value out of the table |
| remove the ceiling check from `validateWorkBound` | `leaseSeconds = tenant_data + 1` is admitted; the test goes red. **This is the mutation that shows the G121 collision is real** |
| change `MAX_AUTHORIZATION_SECONDS.tenant_data` | the ceiling test's expected operand changes with it — proving the number is derived, not duplicated |
| drop `FOR UPDATE SKIP LOCKED` from the claim | two concurrent claims both win (or one blocks); the exactly-one-winner test goes red |
| change `now()` to `clock_timestamp()` in the claim | a test asserting **one deadline per claim batch** goes red |
| drop `AND outcome_kind IS NULL` from the settle | a replayed settle overwrites a stored verdict; the second-settle test's `rowCount 0` assertion goes red |
| drop `AND status = $3` from the guarded transition | the two-node race sees `rowCount 1` twice; the double-advance test goes red |
| replace the counter row with `nextval` | the aborted-insert test finds a **gap**, which is the whole point of `model/billing.ts:156-158` |
| drop `UNIQUE (tenant_id, idempotency_key)` | the replayed-meter test finds two rows |
| use `providerRequestId` bare as the idempotency key (§8's named wrong answer, `:2521-2530`) | the two-meters-one-call test finds **one** row and output tokens are silently uncounted |
| reorder `RunPlan.leftDocumentIds` and re-fold | `resume-determinism` goes red — which **witnesses A2's hazard as a live defect** rather than a note in a document |
| `Object.freeze` the plan and the stored outcomes before the fold | a mutating implementation throws under strict mode — the A9(e) technique the module already uses (`:2764-2767`) |
| drop the RLS policy on `reader_request_attempt` | the cross-tenant settle test leaks, proving isolation comes from the policy and nothing else (`tests/db/tenant-isolation.test.ts:17-19`) |
| omit `set_config` (call the queue outside `withTenantScope`) | the claim returns **zero rows** — G100's deny-on-NULL, not another tenant's work |

**Two negative controls that are HONOUR-SYSTEM until somebody writes them, and I will not call them
enforced.** (1) *No `await` on a network client inside a `withTenantScope()` callback.* (2) *No queue
payload schema declares a tenant field* — R5(iv) asks for exactly this checker
(`docs/build/ingestion-pipeline.md:334-336`). Both are greppable; neither is written; a new checker
joins `npm run check` and does not stand beside it (G108, `docs/HANDOFF.md:834`).

---

## 6. The COST of the ruling on this surface, stated plainly

1. **Reads and round trips.** Per reader request: **2 transactions** (claim, settle). Per run:
   1 admission + 1 fold claim + 1 arm + 1 resume claim + 1 terminal write, plus 2N for the fan-out.
   Every one is a pooled round trip. **I have not measured any of this and I am not stating a number
   for it.**
2. **A resume recomputes the WHOLE fold.** That is the price of not inventing a state serialisation
   format, and the crossover where serialising would be cheaper is unmeasured.
3. **Latency.** A poll-driven queue adds up to one poll interval per hop. The interval is required
   configuration with no default. `NOTIFY` reduces it and is not durable, so the poll stays the
   correctness mechanism (`docs/build/event-architecture-recommendation.md:304-307`).
4. **An O(tenants) sweep in the hosted topology**, where one plane serves many tenants. Free under
   BYOA, where a plane serves one. The tenant count at which this stops being acceptable is
   **unmeasured**, and §2.9's rejected alternative is the escape hatch with its own cost.
5. 🛑 **THE ONE IRREVERSIBLE DECISION, AND IT IS THE BIGGEST COST ON THIS SURFACE.** Once a single
   `ReaderOutcome` is stored under `(runId, requestOrdinal)`, **`buildReaderRequests`'s iteration
   order becomes part of the persisted contract.** Changing the residue order, `openItems`' order or
   the candidate filter later invalidates every stored verdict in the system. That irreversibility
   **arrives with G120, not with my design** — it is what *"persisted keyed by `(runId,
   requestOrdinal)`"* means — and the witness columns are the most that can be done about it: they
   make the invalidation **loud** instead of silent. **It is irreversible from the first stored
   verdict, which is the same shape as G20's *"irreversible after the first hash"*.**
6. **Metering gets a discrepancy counter, not a correction.** `attempts` minus settled outcomes is a
   number somebody has to look at. Nothing here bills for a lost call and nothing here should.
7. **A nineteenth module** makes every stated module count STALE under `check-doc-counts.mjs`.

### G rows and open gates this collides with — every one is the owner's, not mine

| Collision | Where | Why it is the owner's |
|---|---|---|
| 🛑 **G121 × `MAX_AUTHORIZATION_SECONDS`** | `docs/HANDOFF.md:847` × `model/access.ts:1517`, `:1530` | *"ONE `AuthorizationGrant` per map execution"* against a **900-second** ceiling for `tenant_data` and a resume that may happen an hour later. `AuthorizationGrant.expiresAt` is *"Required, never null"* (`:1593`). **G121's recorded cost is withdrawal, not expiry**, so this is not a cost it already priced. Q1 |
| 🛑 **G120 × the seam's own AuditActor gap** | `model/reconciliation.ts:2140-2155` | *"a model call made mid-run, before any exception exists, has NO CONSTRUCTIBLE AuditActor today"*, and `AUTHORIZATION_MAY_BE_ABSENT.agent` is `false`. **So the reader act is unrecordable under invariant 10 and my durability design cannot fix it.** The header already says the ruling is the owner's |
| 🛑 **The broker verdict × G107** | `docs/build/event-architecture-recommendation.md:323` and `:352-354` × `docs/HANDOFF.md:833` | The document records the collision itself and closes *"somebody must reconcile the two; this document does not."* O-1 (`docs/build/ingestion-pipeline.md:452`) recommends the Postgres queue and asks for a G number. **This design is the second concrete artefact forcing that answer.** Q3 |
| 🛑 **G111 × the plan digest** | `docs/HANDOFF.md:837` × `model/canonical.ts:66-71` | No canonical form for `Money`, so no plan digest, so the pinning control detects an honest change and not tampering |
| 🛑 **D2 × `RunPlan`** | `docs/build/phase-one-plan.md:130-131` (item 12, gated on D2) | The plan pins `(definitionId, definitionVersion)`; *"definition versioning with resolvable content"* is gated and unbuilt, so **what a pinned version resolves to is undefined today** |
| 🛑 **A2 × determinism** | `docs/build/ingestion-pipeline.md:326`, `:374` | The document array's total key is *"unspecified anywhere, and a rerun hazard."* `RunPlan` states it — and that IS a decision about ordering that somebody has to bless |
| ⚠️ **G30** | `docs/HANDOFF.md:684`, `db/migrations/0001_tenancy_and_rls.sql:18-23` | Answerable by derivation from `tokenMeterFacts`. Q7 puts it with the quote rather than acting on a §3 row |
| ⚠️ **G88 × the wire** | `docs/HANDOFF.md:814` | A `RunStatus` arm is a wire change in two YAML sites and a sixth `check-wire-mirror.mjs` pair, and *"every downward-published artefact carries a format version and a refusal"* |

---

## 7. What I did NOT solve, and what it is blocked on

1. **The reader executor itself.** G118. I designed the durability *around* the Bedrock call. No
   document may say the LLM half runs.
2. **The `AuditActor` for a mid-run model call.** `model/reconciliation.ts:2140-2155` says it is the
   owner's, between moving the pass behind exception-raising and giving `DerivedAgentGrant` an
   authorisation join key (DP-6). Until then the reader act is **unrecordable**, and a durable queue
   for an unrecordable act is a durable queue for an unrecordable act.
3. **Which capability the reader map redeems.** None of the 37 names it. `trigger_run` is
   `configuration` (`model/access.ts:611`) — *"Running a configured job is an act on configuration,
   not a read of the result"* — and the reader act **reads `tenant_data` and sends it to a model**.
   `authorize()` refuses a class mismatch outright (`:1675`). Q2.
4. **A `scheduled` run cannot mint a grant at all.** `RunTrigger.scheduled` has no principal, the
   `schedule` resource class carries **no capability**, and `model/governance.ts:357-367` says the
   verb is missing because *"an armed schedule must PIN a scope at arming rather than resolve one at
   firing"*. So under G121 a nightly reconciliation **cannot run the reader map**. Blocked on the
   `arm_schedule` question the record already parks.
5. **The plan digest.** Blocked on G111.
6. **Fair scheduling and starvation** across tenants in the O(tenants) sweep. Unbounded until
   somebody states a fairness rule; I did not invent one.
7. **Ingestion's own resumability.** R5(vi) says a one-transaction shred makes it *"stop existing as
   a problem"* **conditionally** on a stated, refusing bound
   (`docs/build/ingestion-pipeline.md:352-358`). I mirrored the conditional; I did not set the
   numbers.
8. **Derived `MatchGroupId`s.** Needed the moment the terminal write is chunked. Q8.
9. **Session establishment (D1).** Everything above assumes a session exists somewhere upstream to
   admit a run. **Nothing issues one** (`docs/HANDOFF.md:145-147`). Worker paths take their tenant
   from the registry, not a session, so **the fan-out is one of the few surfaces that can be built
   before D1 closes** — but the run cannot be *admitted* without it.
10. **The two honour-system checkers** in §5.

---

## 8. Owner rulings this needs, phrased as questions

**Q1 (blocks the fan-out).** G121 rules one `AuthorizationGrant` per map execution.
`MAX_AUTHORIZATION_SECONDS.tenant_data` is 900 seconds and `AuthorizationGrant.expiresAt` is required
and never null. When a node dies and another resumes the map after the grant has expired: does the
resume **mint a new grant** — making it one grant per map *attempt*, so the audit trail carries N
grants for one map and G121's row needs amending — or does the map **refuse to resume** and the run
fail? *(No recommendation offered: G121's stated cost is withdrawal, not expiry, so this is new
ground.)*

**Q2 (blocks the fan-out).** Which of the 37 capabilities does a reader act redeem? None names it,
`trigger_run` is `configuration`, and the act reads `tenant_data` — and `authorize()` refuses the
mismatch. *(If the answer is a 38th capability, `CAPABILITY_RESOURCE_CLASS` makes it a compile error
until it is classed, which is the totality biting.)*

**Q3 (blocks the queue).** O-1, narrowed to this surface: may the reader work queue be a Postgres
table claimed with `FOR UPDATE SKIP LOCKED`, with **no broker anywhere in the run path**?
*Recommended: yes, per §4.3 — the settle and the meter insert must share a transaction and SQS
cannot. It needs its own G number, and it settles the reader path only.*

**Q4 (blocks the build).** Every number in `WorkBound` — `maxAttempts`, `leaseSeconds`,
`maxItemsPerClaim`, `maxRunAttempts`, `staleRunSeconds`, `maxResultRowsPerTransaction`.
*Recommended: FDE-set configuration in a pack template, per O-8's posture, refusing on absence.
None may come from me.* Note that `leaseSeconds` has a **derived** ceiling and needs no invented one.

**Q5.** Does a worker sweep tenants from the downward-published registry — every queue read inside
`withTenantScope()`, cost O(tenants) per sweep — or does a lease table **outside RLS** carry
identifiers only, at the price of a table where one tenant's row ids are visible to a query that saw
another's? *Recommended: the sweep, because G103 refused a table outside RLS for the rule cache on
the ground that four invariants are enforced by the store.*

**Q6.** May `model/execution.ts` exist as a nineteenth module, or do these types go into
`model/domain.ts` beside `ReconciliationRun`? *Recommended: a new module. `ReconciliationRun` is on
the wire and is the business record; a lease is neither.*

**Q7.** G30: close it as **DERIVED** rather than ruled? `tokenMeterFacts` already meter-qualifies the
idempotency key, so `UNIQUE (tenant_id, idempotency_key)` is correct and `(idempotencyKey, meter)`
would be a second answer to a question the only producer has closed. *If yes, the outbox columns
0001 withheld are unblocked.*

**Q8.** May a run's terminal result write be **bounded and REFUSE above the bound** (mirroring
R5(vi)), or must chunking be ruled in now — in which case the durable cursor **and** deterministic
`MatchGroupId`s return with it? *Recommended: bound and refuse, exactly as R5(vi) chose.*

---

## 9. One paragraph

**The owner's ruling is nearly free on this surface, and the reason is that the engine was written
clockless and pure before anybody asked for statelessness.** The durable artefact is the **pinned
input plus the stored verdicts**, never the folded state: re-running a pure fold is the cheapest
correct resume, it needs no serialisation format, it creates no new personal-data location, and it
makes crash-resume and `RunTrigger.rerun` the same code path. The queue is a **predicate on the
outcome table** — the `shippedAt IS NULL` shape the record already has — claimed with
`FOR UPDATE SKIP LOCKED`, leased by the **database's** clock so no node's skew can steal work, and
guarded by conditional `UPDATE`s whose `rowCount 0` is how a losing node learns it lost. Three things
are genuinely new and each is argued: `RunPlan`, because nothing pins what the fold reads;
the **subject and candidate witnesses**, because G120's `(runId, requestOrdinal)` is a positional key
over a derived array and `applyReaderVerdicts` checks nothing; and `WorkBound`, whose lease ceiling is
**derived from `MAX_AUTHORIZATION_SECONDS` rather than invented**. That derivation is also what
surfaces the one collision the owner has to resolve: **G121's single grant per map cannot survive a
resume past its own 900-second ceiling.**

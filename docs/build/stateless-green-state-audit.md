# GREEN — the state audit, and the checker that keeps process-local state out

**Surface:** every place process-local state hides, in the tree and in what has been RULED
but not built; plus the mechanical control that keeps it out.
**Input, not a question — the owner's ruling, 9 Aug 2026:** *"I want the application stateless so
it can scale without a node dependence and for ease of retry in case a node fails. That means
everything that carries state, including session data or other user artifacts, must be committed
to the database."* Read as: **no process-local state that another node or a retry cannot
reconstruct from durable storage.**

Every citation below was opened. Every count below was derived with the command shown. Where I
could not verify, it says **not verified**.

---

## 0. The headline, before the detail

**`model/` is already clean, and that is the finding.** Derived at HEAD, 9 Aug 2026:

```bash
grep -rnE '^(export )?(let|var) ' --include='*.ts' model            # 0
grep -rnE '^(export )?const [A-Za-z_$]+ *(:[^=]*)?= *(new (Map|Set|WeakMap|WeakSet)|\[\]|\{\})' \
  --include='*.ts' model                                            # 0
grep -rn 'Date\.now()'   model/*.ts                                 # 0
grep -rn 'Math\.random'  model/*.ts | grep -v '^\S*: *\*'           # 0
grep -rn 'randomUUID\|crypto\.' model/*.ts | grep -v '^\S*: *\*'    # 0
grep -rn 'globalThis' model/*.ts                                    # 0
grep -rn 'setTimeout\|setInterval' model/*.ts                       # 0
grep -rn 'writeFileSync\|tmpdir\|mkdtemp' model/*.ts                # 0
```

Eighteen modules, 832 exports, and **not one mutable module-level binding, not one clock read,
not one random source.** Every `new Date(...)` in `model/` is arithmetic over a **supplied**
`Timestamp` — `authorize()` at `model/access.ts:1715` derives `expiresAt` from
`Date.parse(principal.now)`, and `partnerHealthWindowEnd()` at `model/observability.ts:330` from
its `windowFrom` parameter. Neither reads a clock.

**Two mutable module-level bindings exist in the whole repository, and neither is in a request
path:**

| | | Verdict |
|---|---|---|
| `db/pg.ts:25` — `let cached: Promise<PgModule> \| undefined` | the dynamic `pg` import, memoised | **Permitted, and it needs the marker §2.4 defines.** It caches an *immutable module handle*, holds no tenant data, and a second node reconstructs it by importing again. It is the allow-list's first and only member in shipped code |
| `tools/planner/serve.mjs:457` — `let queue = Promise.resolve()` | a dev graph server's write serialiser | **Out of scope.** `tools/` are one-shot CLI processes; §2.5 argues why the checker must not scan them |

One test-scope accumulator: `tests/scenarios/export-surface.test.ts:166`,
`const TOUCHED = new Set<string>()`. Correct for a test, and §2.5 excludes `tests/`.

**Why a clean result is the important result.** The rule is cheap to adopt *today* and expensive
to adopt later. There is nothing to fix, so the entire cost of the ruling on this surface is the
checker plus the discipline — and the checker's honest report today is that it proves almost
nothing, because **the request path it exists to police does not exist** (no HTTP surface, no
session, `docs/HANDOFF.md:145` and `:157-166`). §2.5's `vacuous` field is how it says so.

---

## 1. What already exists that this reuses — and what the ruling gets FOR FREE

### 1.1 The ruling and invariant 10 are the same decision from two directions

`model/access.ts:1536-1554` refuses the JWT shape for `AuthorizationGrant`, in its own words:

> *"A REFERENCE, NOT A BEARER TOKEN … Every field below is therefore SERVER-WRITTEN AND
> SERVER-READ. There is no signature, no claims blob and no encoding, because there is nothing
> here a caller is trusted to carry … A signed self-describing token is fast precisely because
> nobody loads the row — and a revoked assignment, a disabled user or a lapsed partner grant then
> stays effective until the token expires. 'Validity is evaluated, never asserted': a fired
> employee's in-flight acts stop on the next call, not at the next expiry."*

`redeemAuthorization()` (`model/access.ts:1753`) then re-derives the authority on **every** call
and re-runs `decide()` at the end. **This is exactly what the owner's ruling demands, already
decided, for the hardest object in the system.** Nothing in the authorisation spine can be node-
local, because nothing in it is *carried* at all. The ruling extends an existing posture; it does
not introduce one.

🛑 **And it closes the escape hatch in advance.** The standard remedy for "load the row on every
request is slow under scale-out" is a signed self-describing token or an in-process session cache.
`access.ts:1547-1550` refuses the first *by name*, and the ruling refuses the second. **The owner
should know that the two decisions jointly forbid the usual mitigation** — §6 prices it.

### 1.2 Determinism, already banked, and why retry needs exactly it

A stateless retry is only safe if the second attempt produces the same answer as the first. Two
attempts that disagree are worse than one that failed: the ledger now depends on which node won.

`model/reconciliation.ts:80` — *"THE ENGINE HAS NO AUTHORITY, NO CLOCK, NO IDENTITY AND NO
NETWORK."* Its header carries nine standing greps; four are the ones this surface needs, and I ran
them at HEAD:

```bash
code() { grep -vE '^[[:space:]]*(\*|/\*|//)' model/reconciliation.ts; }
code | grep -c 'new Date\|Date\.now'   # 0   model/reconciliation.ts:19
code | grep -c 'Math\.random'          # 0   model/reconciliation.ts:21
code | grep -c 'new RegExp'            # 0   S1
code | grep -c 'throw '                # 0   failures are values
```

`model/reconciliation.ts:108` states the property in the ruling's own terms:
*"G103 no third store — nothing here is cached in module state."*
`docs/build/reconciliation-engine.md:201` says it of the module: *"there is no module-level state
of any kind, and an approved `IdentifierNormalisation` arrives as an argument."*

**G116** refused a shared scratch buffer across iterations in `levenshteinBasisPoints` because
*"reusing a single set of typed arrays across iterations is shared mutable state"* and this
module's history includes **S2**, a module-level cache that leaked inferred structure across a
tenant boundary (`docs/HANDOFF.md:842`). **The ruling ratifies G116.** It does not need a new
argument; G116 already made it, on a narrower case, against a performance request.

`PrincipalContext.now` (`model/access.ts:1031`) is a *parameter*, with the reason stated on it:
*"Evaluation time, supplied rather than read from a clock so a decision is reproducible in an
audit."* Every access decision is therefore replayable. That is the same property retry needs.

### 1.3 The retry/replay identity is already ruled, twice

- **G120** (`docs/HANDOFF.md:846`): `ReaderOutcome` must be **persisted keyed by
  `(runId, requestOrdinal)`**, *"which is what makes a retry granular AND makes a rerun REPLAY
  stored verdicts rather than re-ask."* The keys already exist in the tree:
  `ReaderRequest.requestOrdinal` (`model/reconciliation.ts:2195`) and both arms of `ReaderOutcome`
  (`model/reconciliation.ts:2308-2309`). **No new type is needed for reader retry.**
- **Ingestion R5(ii)** (`docs/build/ingestion-pipeline.md:307-317`) gives three idempotency keys,
  each catching what the others cannot: file grain `(tenantId, sourceEndpointId, sha256(bytes))` —
  **content hash, explicitly not the S3 key and not a message id**, because *"S3 event
  notifications are themselves at-least-once, and a redrive changes the message id while the file
  is the same file"*; row grain `(tenant_id, source_document_id, line_index)` with `ON CONFLICT DO
  NOTHING`; content grain the file's own trailer.
- **C12** (`docs/build/ingestion-pipeline.md`, control set): *"Deterministic SPREAD sampling seeded
  from the content hash"*, refusing the owner's *"first 5 rows"* partly because a head sample is
  **"not reproducible for audit"**. That is the sampling-seed half of retry determinism, already
  ruled, for exactly this reason.
- **R5(iii)**: `admitPopulation` *derives* the ordinal over documents as supplied
  (`model/reconciliation.ts:1113`) and never observes arrival — *"Do not buy a FIFO queue; you
  would be paying for a property the design already has."*

### 1.4 The lease is the transaction — so no lease type is needed, and adding one is a defect

`db/tenant-scope.ts:101` — `withTenantScope()` opens an explicit `BEGIN`, sets
`set_config('app.tenant_id', $1, true)` and commits. Under **G101** that transaction is mandatory.
`docs/build/event-architecture-recommendation.md:376` rules the work queue is an in-Postgres
`FOR UPDATE SKIP LOCKED` table that *"enqueues in the same transaction as the digest's
`DataAccessEvent`, which SQS cannot"*.

**Read those two together and the worker lease disappears.** `SKIP LOCKED` inside a transaction
*is* the lease: a node that dies aborts its transaction and the row unlocks with no expiry, no
sweeper and no clock. A `leased_until` column would re-introduce a wall-clock read, a timer, and a
node-dependent sweeper — three things the ruling forbids — to solve a problem the transaction
already solved.

The only case that needs a visible lease is a job outliving one transaction, and
**ingestion R5(vi) already refuses that**: *"the shred and the `SourceDocument` insert are ONE
transaction inside `withTenantScope()` … resumability stops existing as a problem rather than
needing a durable cursor"*, with the bound *"stated and refused on, not defaulted"* and
*"If chunking is later ruled in, the durable cursor returns with it."*

⚠️ `EntitlementLease` (`model/billing.ts:580`) is **not** this and must not be reached for. It is a
signed, offline-verifiable **entitlement** for a BYOA data plane, dropped with `deployment.ts`
(`model/deployment.ts:42-44`). Using it as a worker lease would be `docs/HANDOFF.md` §5.3 — two
vocabularies for one concept — with the added defect that it carries a signature and a clock.

### 1.5 Optimistic concurrency — what the model has, verified, and what it does not

Asked directly: **is there any `etag`, `If-Match`, `rowVersion` or general version token? No.**

```bash
grep -rniE 'etag|if-match|optimistic|rowVersion' model/*.ts   # 3 hits, all prose
grep -rn 'etag\|If-Match' docs/contracts/*.yaml               # 0
```

`model/agents.ts:513` refuses `updatedAt` outright: *"IMMUTABLE ON WRITE. There is no `updatedAt`
and no mutable body."* What exists instead, and each is reusable:

| Mechanism | Where | What it gives the ruling |
|---|---|---|
| **Currency by store uniqueness** | `ProcedureStepExecution` (`model/domain.ts:3291`): *"at most one row per (tenantId, exceptionId) may have `endedAt === null`. That uniqueness IS the concurrency control — enforce it in the store, not in the caller, or `step_not_current` becomes a race against itself"* | The wizard/multi-step answer. A **partial unique index**, not an in-memory lock. `step_not_current` (409) is the refusal, named at `model/domain.ts:3249` |
| **A monotonic sequence per stream** | `RecordChain.sequence` (`model/governance.ts:1110-1112`) | Gap detection — and §6's biggest cost |
| **Client idempotency key** | `Idempotency-Key` (`docs/contracts/capability.openapi.yaml:2230`) + `IdempotencyConflict` 409 (`:2260`), *"Deliberately NOT present on run admission, where the key is computed by the server"* | Double-submit under retry, already on the wire |
| **A version on the editable artefact** | `ReconciliationDefinition.version: number` + `status: 'draft' \| 'active' \| 'archived'` (`model/domain.ts:2144`, fields at `:2158-2159`) | G58's mandatory Tier-2 Save gets compare-and-swap **from a field that already exists**. No etag needs minting |
| **Pinned versions** | `ProcedureStepExecution.procedureVersion`, `role_version_moved` (`DECISION_REASONS`) | A retry re-reads the pinned version and cannot drift onto a newer graph |

### 1.6 Multi-turn conversation is already reconstructible — G47 paid for this in advance

`AskSession` (`model/domain.ts:4243`) is a durable row with `turns: AskTurn[]`, and the type
comment cites the screen committing to it: *"The session is a document."* What re-enters the
prompt is **not** the transcript but `CarriedTurn` (`model/domain.ts:4296`), bounded by
`CONTEXT_WINDOW_TURNS = 3` (`model/domain.ts:4192`), and `CarriedTurn` **has no string field at
all** — asserted by `_CarriedTurnHoldsNoText` in `model/identity.ts`.

**Consequence for this ruling, and it is free:** the next turn's context is *derived* from
durable rows by a pure fold over at most three prior turns. There is nothing to keep warm, so the
Ask surface needs **no node affinity and no conversation cache**. G47 was taken for containment
(`docs/HANDOFF.md:701`); it happens to be the strongest statelessness result in the model.

### 1.7 The store already denies on absence, and the pool already refuses the leaky call

- `db/migrations/0001_tenancy_and_rls.sql` — the predicate
  `tenant_id = nullif(current_setting('app.tenant_id', true), '')`, **deny on NULL** under G100, so
  a forgotten transaction on any node yields an empty result set rather than a cross-tenant read.
  `FORCE ROW LEVEL SECURITY` is applied so ownership does not confer exemption.
- `db/tenant-scope.ts:56-69` — `TenantPool` **has no `query` method**, so `pool.query(...)` is a
  **compile error at every call site** rather than a review catch, with no runtime wrapper. This is
  the pattern §2.4's checker rule 8 defends, and the pattern the frontend/session work should copy.
- `db/pg.ts:17-20` — the LOUD SKIP convention: *"THE SKIP IS ONLY HONEST WHILE IT IS LOUD."* §2.5's
  `vacuous` field is the same idea in a checker.

### 1.8 No third store, and the outbox

**G103** — no Redis; the extraction-rule cache is a **tenant-scoped Postgres table**, because a
cache of tenant-derived rules *"would sit outside RLS, outside the retention table, outside the
erasure plan and outside `SubjectLocation`"* (`docs/HANDOFF.md:829`). **G103 is the ruling applied
to a cache, eight days early.** `docs/build/event-architecture-recommendation.md:323` — *"outbox,
for every stream. No broker in the data plane, in either topology."* An outbox row **is** the
retry; there is no in-flight in-process buffer to lose. **C21** — *"No DLQ as a separate store.
Failed files stay in the tenant's own landing bucket with a failure row in Postgres."*

### 1.9 The `Session` type is already proposed — adopt it, do not re-mint it

`docs/build/green-platform-slices.md:105-124` proposes `Session` (not `TenantScoped`) with
`SessionId` added to `model/kernel.ts`, plus a `docs/contracts/session.openapi.yaml` carrying
`security: []`, six operations, and the compile-time assertion `_SessionIsNotTenantScoped`. Its two
load-bearing properties are **absences**: no `orgClass` field (org derives from the connection's
owner at every resolve) and no role/capability/scope field (*"a session carrying a scope would be a
third copy that can disagree with both"*).

**Every field on that proposal is already a durable column.** The ruling adds **nothing** to its
shape. What it does is *close an option nobody had ruled out*: there is no in-memory session store,
no sticky node, and no signed session cookie carrying claims. §2 gives it the table.

⚠️ **A correction the gate cannot catch, found while reading it.** Five of P1's citations have
drifted:

| P1 says | Actually at | Line P1's number now hits |
|---|---|---|
| `IdentityConnection` — `domain.ts:1196` | `model/domain.ts:1355` | `*/` (would read SUSPECT) |
| `User` — `domain.ts:1236` | `model/domain.ts:1395` | a `RetentionRefusal` union arm |
| `AskSession` — `domain.ts:4057` | `model/domain.ts:4243` | a `subjectRef` doc comment |
| `AccessSession` — `governance.ts:807` | `model/governance.ts:915` | *"An extension to a delivery grant."* |
| `PrincipalContext` — `access.ts:954` | `model/access.ts:1003` | `commercial_only: []` |

Four of the five **resolve to substantive but wrong lines**, so `tools/check-citations.mjs` is
silent on them by its own stated design (`tools/check-citations.mjs:17-19`, `:152-156`). Anyone
building P1 from its citations lands in the wrong declaration four times out of five.

---

## 2. The design

### 2.1 `SessionId` — `model/kernel.ts`, beside `TenantId`

Insertion point: `model/kernel.ts:101`, immediately after `export type UserId = Id<'User'>`.

```ts
/**
 * A SESSION IS ADDRESSED, NEVER CARRIED. G97 stores it as `text` verbatim.
 *
 * The id is a LOOKUP KEY, not a credential: the row is loaded and re-evaluated on
 * every request, which is `AuthorizationGrant`'s posture one layer earlier
 * (`model/access.ts:1536` — "a reference, not a bearer token"). The bearer secret is
 * NOT this id and is not a field in `model/`: it is a hash column on the table (§2.6),
 * because no field in this model may hold key material — the rule
 * `SubjectKeyScheme.keyRef` already states (`model/governance.ts:1880`).
 */
export type SessionId = Id<'Session'>
```

### 2.2 `Session` — `model/domain.ts`, beside `IdentityConnection`

Insertion point: `model/domain.ts`, immediately after the `IdentityConnection` block that begins at
`:1355`. **Adopt `docs/build/green-platform-slices.md:107-124` verbatim.** I am deliberately not
restating it here field-by-field: re-typing a proposed declaration is how two versions of one type
appear, which is §5.3, and P1's version is the one with the argument attached to each absence.

**The one thing the ruling adds — and it is a comment, not a field:**

```ts
/**
 * ⚠️ THIS ROW IS THE ONLY SESSION STATE THERE IS — owner's ruling, 9 Aug 2026.
 *
 * "everything that carries state, including session data or other user artifacts,
 * must be committed to the database." There is no in-process session map, no signed
 * cookie carrying claims, and no node affinity. A second node serving the next
 * request reconstructs everything it needs from this row plus `IdentityConnection`,
 * `User` and `RoleAssignment`.
 *
 * WHAT THAT COSTS, STATED ON THE DECLARATION SO NOBODY HAS TO GO LOOKING: one
 * indexed read before any work on every request, and it may not be cached, because
 * `model/access.ts:1547` refuses the token shape that would make caching safe. See
 * `lastUsedAt` — the write side of the same cost, and an OPEN owner question.
 */
```

### 2.3 `resolveSession()` — `model/access.ts`, and it is a reasoned union

Placement: `model/access.ts`, immediately before `authorize()` (`model/access.ts:1659`), so the
three functions that turn a presented artefact into authority sit together. Import is type-only —
`import type { Session } from './domain'` joins the existing block at `model/access.ts:46-57`, with
**no `.ts` specifier** because `verbatimModuleSyntax` erases it and `model/domain.ts` must not gain
a runtime edge back (the one-direction property recorded at `model/reconciliation.ts:44-47`).

```ts
/**
 * SESSION BOUNDS — required configuration, refusing on absence.
 *
 * `IngestBound` (docs/build/ingestion-pipeline.md, C4) is the precedent and its
 * sentence is the rule: "Required, no defaults, refusing on absence — a bound with
 * no number is not a bound." PRODUCT.md forbids inventing a figure, so THERE IS NO
 * DEFAULT TTL ANYWHERE HERE. The numbers are the owner's; until they exist,
 * `resolveSession()` refuses every session.
 */
export interface SessionBounds {
  /** Absolute lifetime. A session older than this is dead however recently used. */
  maxLifetimeSeconds: number
  /** Idle lapse, independent of the absolute lifetime. */
  maxIdleSeconds: number
  /** Whether this connection's sessions must present a second factor at all. */
  secondFactorRequired: boolean
}

export type SessionRejection =
  | { reason: 'session_not_found' }
  | { reason: 'session_revoked'; revokedAt: Timestamp }
  | { reason: 'session_expired'; expiresAt: Timestamp }
  | { reason: 'session_lifetime_exceeded'; authenticatedAt: Timestamp }
  | { reason: 'session_idle_lapsed'; lastUsedAt: Timestamp }
  | { reason: 'second_factor_required' }
  | { reason: 'tenant_not_selected' }
  | { reason: 'connection_disabled'; connectionId: IdentityConnectionId }
  | { reason: 'subject_not_active' }
  /** A bound was absent or not a positive finite number. Fail closed. */
  | { reason: 'bounds_not_configured'; field: keyof SessionBounds }
  /** `now` did not parse. The clock is a PARAMETER; a bad one refuses. */
  | { reason: 'evaluation_time_unparseable' }

export type SessionResolution =
  | { ok: true; principal: PrincipalContext }
  | { ok: false; rejection: SessionRejection }

/**
 * TURN A LOADED SESSION ROW INTO A `PrincipalContext`. TOTAL, PURE, NO CLOCK, NO I/O.
 *
 * SHAPE COPIED FROM `resolveModel()` (`model/catalog.ts:184`) DELIBERATELY: a reasoned
 * union, never a boolean (§5.2), with one arm per control that would otherwise live in
 * prose. Every input is supplied — the row, the connection, the user, the bounds and
 * `now` — so the same inputs give the same answer on any node, on any attempt. THAT is
 * what makes a stateless retry safe rather than merely possible.
 *
 * ⚠️ IT TAKES NO CALLER-SUPPLIED OVERRIDE OF ANY KIND. G79 refused exactly that on a
 * residency check, and this is the same object: a `skipSecondFactor` or
 * `allowExpired` parameter would be §5.2 on the one gate every request passes.
 *
 * ⚠️ `orgClass` IS DERIVED FROM `connection.owner` HERE AND IS NOT READ FROM THE ROW.
 * `Session` carries no `orgClass` for the reason P1 states: "a stored org is a second
 * door that outlives the directory membership it was copied from." Deriving it on every
 * resolve is what the ruling forces anyway, since nothing may be cached.
 *
 * WHAT IT DOES NOT DO: it does not authorise anything. `decide()` and
 * `redeemAuthorization()` still run. This function's whole job is to establish that the
 * principal handed to them was reconstructed from durable rows and not from memory.
 */
export function resolveSession(input: {
  session: Session
  connection: { id: IdentityConnectionId; enabled: boolean; owner: IdentityConnectionOwner }
  subject: { userId: UserId; status: 'active' | 'disabled' }
  held: readonly HeldAssignment[]
  partnerId: PartnerId | null
  partnerGrant: PartnerGrantTerms | null
  bounds: SessionBounds
  now: Timestamp
}): SessionResolution
```

⚠️ **`IdentityConnectionOwner` may not be the live name.** `docs/build/green-platform-slices.md:75`
cites the three-arm owner union at `domain.ts:1209-1212`, which has drifted (§1.9). **Derive the
exported name before pasting** — `grep -n 'owner' model/domain.ts` around `:1355` — rather than
trusting this line. Everything else above is checked against declarations I opened.

### 2.4 The marker — one annotation, one shape, reusing `@dropped-for-v1`'s discipline

The checker needs a waiver, and a waiver that lives in the checker rots the moment the checker's
author leaves. `docs/HANDOFF.md:63` states the principle for the drop notes: *"The note **on the
declaration** is the authority, because it travels with the code and cannot go stale separately
from it."* The same mechanism, one axis over:

```
/** @node-local 9 Aug 2026 — <why no tenant datum, no request datum and no decision
    can reach this binding>. Reconstructible: <how a cold node rebuilds it>. */
```

**Three clauses, all three required, and the checker checks the SHAPE not the prose:** a date, a
`—` reason, and a `Reconstructible:` clause. A marker missing any clause **does not waive** — it
becomes a `malformed_waiver` finding and exits 1. That is the point: the annotation costs an
argument to write, which is the only thing that keeps a waiver honest.

**Is this new machinery, i.e. is it §5.3?** It is genuinely new, and nothing existing expresses it.
`@dropped-for-v1` says *this declaration is not built*; `SubjectLocation`
(`model/governance.ts:1772`, eleven variants) says *where a data subject's data lives, for
erasure* — and `docs/build/ingestion-pipeline.md` A3 already records that **no variant names a
queue message**, so it does not reach transient locations either. Neither expresses *this binding
outlives a request inside one process*. What I have deliberately **not** minted is a `model/` type
for state residence: a taxonomy of durability would be a total `Record` with no construction site
(§5.10) and a claim over zero call sites (the four-times-stacked shape at `docs/HANDOFF.md:130`).
**The enforcement here is a source checker, a migration and tests — not a type.** Say that plainly
rather than shipping a type that witnesses nothing.

Today the marker has **exactly one call site**: `db/pg.ts:25`.

```ts
/** @node-local 9 Aug 2026 — caches the dynamic `pg` module handle only; it holds no
    tenant datum, no request datum and no decision, and every caller passes its own
    pool. Reconstructible: a cold node re-imports `pg` on first `loadPg()`. */
let cached: Promise<PgModule> | undefined
```

### 2.5 THE CHECKER — `tools/check-stateless.mjs`

Registration, per **G108** (*"a new checker joins `npm run check`; it does not stand beside it"*),
and `tests/ci/gate.test.ts` already asserts this class of property:

```json
"check:stateless": "node tools/check-stateless.mjs",
"check": "npm run typecheck && npm run check:counts && npm run check:citations && npm run check:wire && npm run check:packs && npm run check:stateless && npm test"
```

`.github/workflows/check.yml` is **not** touched — `tests/ci/gate.test.ts:60-70` fails if the
workflow names an individual checker, and `check:stateless` must be added to that file's
`CHECKERS_THE_WORKFLOW_MAY_NOT_NAME` list.

**Roots, and why each is in or out.**

| Root | Scanned | Why |
|---|---|---|
| `model/` | ✅ | the model is types-first but `reconciliation.ts`, `canonical.ts`, `policy.ts` and `access.ts` are executable |
| `db/` | ✅ | the pool and the scope function live here |
| `api/` `server/` `worker/` `app/` `web/` | ✅ **when they exist** | the request path, which does not exist yet — and their absence is REPORTED, see `vacuous` |
| `tools/` | 🛑 out | one-shot CLI processes with no request and no second caller. Scanning them would flag `check-citations.mjs:73`'s `fileCache`, `check-doc-counts.mjs:241`'s `findings` and this checker's own accumulators — a control that fails while the property holds, which `model/reconciliation.ts:10-14` records as *"§5.6 read from the other side"* |
| `tests/` | 🛑 out | a test process is one process by definition |
| `Mockups/` `docs/` `design/` | 🛑 out | not code |

**Comments are stripped before any rule runs.** This is not an optimisation; it is the lesson at
`model/reconciliation.ts:10-14` — the first version of that header's controls reported non-zero on
six of nine, and *"every hit was this header quoting the thing it bans."* The `@node-local` marker
is itself a doc comment, so the scanner reads comments **once** to harvest markers and then matches
rules against the comment-stripped text.

**Rules. Each has a name, findings are violations only, and any unwaived finding exits 1** — the
polarity `tools/check-pack-safety.mjs:38-41` argues for, because a module-level cache in a request
path is not a gap in anything.

| | Rule | Matches | Rationale |
|---|---|---|---|
| 1 | `module_scope_mutable_binding` | top-level `let` / `var` at column 0 (optionally after `export `) | the direct form. Today: 1 hit, waived (`db/pg.ts:25`) |
| 2 | `module_scope_mutable_container` | top-level `const X = new Map()/new Set()/new WeakMap()/new WeakSet()/[]/{}` **AND** the same file contains `X.set(` / `X.add(` / `X.push(` / `X.delete(` / `X.clear(` / `X[` on an assignment LHS | **two-part on purpose.** A frozen lookup table (`METHODS`, `EXCLUDED_DIR_NAMES`) is not state; flagging it would teach people to ignore the checker |
| 3 | `wall_clock_read` | `Date.now()`, `new Date()` with **zero** arguments, `performance.now()`, `process.hrtime` | a retry that reads a clock cannot replay. `new Date(x)` is arithmetic and is NOT matched — that distinction is the whole reason `model/` is clean today |
| 4 | `unseeded_randomness` | `Math.random(`, `crypto.randomUUID(`, `getRandomValues(`, `randomBytes(`, `randomInt(` | a hash, an ordinal, a sampling seed or an idempotency key derived from randomness is not reproducible. C12 already rules sampling is seeded from `sha256(bytes)` |
| 5 | `process_local_filesystem` | `os.tmpdir(`, `mkdtemp`, `createWriteStream(`, `writeFileSync(`, a string literal starting `/tmp` or `/var/tmp` | a container's temp directory is process-local state. §4 of this report and §6 price it |
| 6 | `timer_as_durable_state` | `setInterval(`, `setTimeout(` outside a waived site | an in-process retry timer or sweeper dies with the node. The outbox poll is a loop in a worker whose *position* is a row, not a timer holding work |
| 7 | `global_assignment` | `globalThis.` or `global.` on an assignment LHS | the module-scope rules' escape hatch |
| 8 | `tenant_pool_exposes_query` | `db/tenant-scope.ts`'s `TenantPool` interface body containing `query` | **the highest-value rule in the list and the cheapest.** `db/tenant-scope.ts:56-68` makes `pool.query()` a compile error *by omission*; an omission is one autocomplete away from being undone, and undoing it silently restores leak MODE 2. A structural property defended by nothing but a comment is defended by nothing |
| 9 | `malformed_waiver` | a `@node-local` marker missing a date, a `—` reason or a `Reconstructible:` clause | a waiver with no argument is a comment, and it must fail rather than waive |

**`vacuous` — the field that makes today's clean run honest.** Modelled on
`tools/check-pack-safety.mjs`'s `vacuous` and the reasoning at `tools/check-pack-safety.mjs:19-27`
(*"a checker over an empty set … so the state is reported rather than mistaken for a clean pass"*).
Every root that does not exist is listed. **The request path is where process-local state actually
hides, and there is no request path**, so the checker's own report must say that on every run.

**Determinism and speed (G108's condition).** One `readdirSync` walk, one pass per file, no YAML,
no `import` of any `model/` module, no network, no clock in the checker's own output. Findings
sorted by `(file, line, rule)` so two runs on one tree are byte-identical.

**Output.**

```
$ node tools/check-stateless.mjs
Stateless audit: 4 root(s) present · 24 file(s) scanned · 0 finding(s) · 1 waived

WAIVED — 1 declaration carries a @node-local marker. Read these; none is checked
for TRUTH, only for SHAPE:
  db/pg.ts:25   module_scope_mutable_binding
      let cached: Promise<PgModule> | undefined
      — caches the dynamic `pg` module handle only … Reconstructible: a cold node
        re-imports `pg` on first `loadPg()`.

VACUOUS — 5 root(s) do not exist, so nothing in them was scanned:
  api/  server/  worker/  app/  web/
  ⚠️ THE REQUEST PATH IS WHERE THIS DEFECT LIVES AND THERE IS NO REQUEST PATH.
     A clean run today is not evidence that the application is stateless. It is
     evidence that there is no application. docs/HANDOFF.md §0a.

⚠️ WHAT THIS CANNOT SEE — read this before quoting a clean run:
  · a container built by a FACTORY CALL. `const reg = makeRegistry()` is a const
    holding mutable state and rule 2 cannot match it.
  · state inside a DEPENDENCY — `pg.Pool`'s own queue, an https.Agent keep-alive
    pool, any library LRU. It scans our source, not node_modules.
  · a transaction or a cursor held open ACROSS requests.
  · state that is durable but still NODE-LOCAL — a local volume, an EFS mount, a
    file written by a spawned binary, a Lambda /tmp reused on a warm invocation.
  · STICKY ROUTING. ALB stickiness, a WebSocket server, an SSE connection pinned
    to a node: none of it is in source. There is no IaC in this repository for a
    checker to read.
  · whether a durable write COMMITTED BEFORE THE RESPONSE WAS SENT. A write-behind
    passes every rule here.
  · a `class` field on a singleton constructed at module scope by a call.
  · BROWSER state — localStorage, sessionStorage, an in-tab wizard object. A
    different node dependence, and there is no frontend root to scan.
  · WHETHER A WAIVER IS TRUE. It checks the marker's SHAPE. The same shape covers
    db/pg.ts:25 and a tenant-keyed schema cache, and only a person can tell them
    apart. Its silence is not evidence of correctness.
EXIT: 0
```

`--json` mirrors `check-pack-safety.mjs` so a test can assert rule names without parsing prose:
`{ rootsPresent, rootsMissing, filesScanned, findings: [{rule, file, line, source, detail}], waived: [...], vacuous: [...] }`.

### 2.6 Where the surface needs a table: `session`, and its predicate is NOT the tenant predicate

🛑 **This is the one real schema problem the ruling creates, and it must not be solved by putting
`session` under `tenant_rls`.** `Session` is deliberately **not** `TenantScoped`
(`docs/build/green-platform-slices.md:107`, and its `_SessionIsNotTenantScoped` assertion), and
`tenantId` is **null until selection**. Under the existing predicate
`tenant_id = nullif(current_setting('app.tenant_id', true), '')`, a row with a null tenant is
invisible to `reconcile_app` — G100's deny-on-NULL, working correctly, against the one table that
must be readable *before* a tenant exists.

The answer is the same predicate one variable over. Migration `0002_session.sql`:

```sql
-- The bearer secret is NOT the id. `token_hash` holds a hash of the presented
-- secret and the secret is never stored — the discipline SubjectKeyScheme states
-- (model/governance.ts:1880): "No field in this model may hold key material."
-- G97: every id is `text`, the slug stored verbatim, no uuid, no cast.
CREATE TABLE session (
  id                 text        PRIMARY KEY,
  token_hash         text        NOT NULL UNIQUE,
  user_id            text        NOT NULL,
  connection_id      text        NOT NULL,
  -- NULL until the picker runs. Written by exactly ONE code path (P2 selectTenant).
  tenant_id          text        NULL REFERENCES tenant (id) ON DELETE CASCADE,
  authenticated_at   timestamptz NOT NULL,
  second_factor_at   timestamptz NULL,
  expires_at         timestamptz NOT NULL,
  last_used_at       timestamptz NOT NULL,
  revoked_at         timestamptz NULL
);

ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE session FORCE  ROW LEVEL SECURITY;

-- THE PREDICATE. Same three-part reading as tenant_rls, same NULL polarity, one
-- variable over: `app.session_id` instead of `app.tenant_id`.
--   current_setting(..., true) — missing_ok, so an unset variable returns NULL
--                                rather than raising. We want the empty read.
--   nullif(..., '')            — a reverted GUC reads back as '' and would make
--                                the predicate `id = ''`, which denies by accident.
--   id = NULL                  — NULL is not TRUE, so the row is filtered.
--                                DENIES ON NULL, exactly like G100.
-- A request that reaches this table without having opened a session scope sees
-- NOTHING. That is why a stateless node cannot "remember" a session: it has to set
-- the variable, which means it has to have been handed the token, every time.
CREATE POLICY session_rls ON session
  USING      (id = nullif(current_setting('app.session_id', true), ''))
  WITH CHECK (id = nullif(current_setting('app.session_id', true), ''));

GRANT SELECT, INSERT, UPDATE ON session TO reconcile_app;
-- No DELETE: a session ends by `revoked_at`, not by vanishing. The audit trail is
-- the customer-facing surface (model/governance.ts:891 makes the same argument of
-- TenantAccessGrant.visibleToTenant).
```

🛑 **The bootstrap problem, stated rather than glossed.** The predicate needs `app.session_id`,
which the request path only knows *after* it has looked the token up — and it cannot look the token
up under this predicate, because the predicate wants the id it is trying to find. The lookup is
therefore `token_hash → id`, and it must happen where the predicate does not apply:

- **Recommended:** a `SECURITY DEFINER` function owned by `reconcile_owner`,
  `session_id_for_token(text) returns text`, `EXECUTE` granted only to `reconcile_app`, returning
  **only the id** — no user, no tenant, no timestamps. The app then sets
  `set_config('app.session_id', id, true)` and reads the row under the policy, so exactly one
  scalar crosses the boundary and everything else is policed. `session_id_for_token` becomes the
  single most security-relevant function in the schema and needs its own two-row negative test.
- **Rejected:** granting `reconcile_app` a `BYPASSRLS`-style exemption, or leaving `session`
  without RLS. Both make the table's protection a property of application code, which is what
  0001's own header says the migration exists to stop.

The companion is `withSessionScope()` in `db/`, in `withTenantScope()`'s exact shape — `BEGIN`,
`set_config('app.session_id', $1, true)`, run, `COMMIT` — and the same negative control: **no query
outside it.** Whether `withSessionScope` and `withTenantScope` nest or compose is a design call for
the session/persistence green team, not this one; the constraint from here is that the pre-tenant
read and the tenant-scoped read must not share one GUC, because a request that set both would give
`session` a second door.

**What I am NOT proposing a table for:**

- **A cursor table.** §4 below.
- **A lease table.** §1.4 — the transaction is the lease.
- **A locks table.** `ProcedureStepExecution`'s currency is a **partial unique index**, which the
  model already specifies: `CREATE UNIQUE INDEX ... ON procedure_step_execution (tenant_id,
  exception_id) WHERE ended_at IS NULL`. That is `model/domain.ts:3296` transcribed, not a new
  idea.

---

## 3. What each declaration REFUSES, and what fails closed

| Declaration | Refuses | Fails closed because |
|---|---|---|
| `SessionBounds` | nothing on its own — it is data | `resolveSession` returns `bounds_not_configured` naming the field, so **an unset bound refuses every session**. C4's sentence: *"a bound with no number is not a bound."* No default appears anywhere, so PRODUCT.md's ban on invented figures is honoured by construction rather than by review |
| `resolveSession()` | eleven named arms, §2.3 | it returns `{ ok: false, rejection }` for every path that is not fully positive, in `resolveModel()`'s shape. There is no boolean and no default-allow branch. `resolveModel`'s own history is the argument: `model/catalog.ts:188-201` records an **empty allow-list permitting the entire catalogue** on the control carrying invariant 7 |
| `resolveSession()` — `now` | `evaluation_time_unparseable` | the clock is a parameter, so a caller cannot omit it and cannot get a silent `NaN` comparison. `model/reconciliation.ts:868` records the `new Date(payload[dateKey])` NaN-sort hazard for exactly this reason |
| `resolveSession()` — no override parameter | any `skipSecondFactor` / `allowExpired` | §5.2, and G79 refused precisely this on `managed_service_use` |
| `session_rls` predicate | any read without `app.session_id` set | deny on NULL, G100's polarity. A forgotten `withSessionScope()` returns **zero rows**, so the failure is "not signed in", never "signed in as someone else" |
| `session_id_for_token()` | returns one scalar or nothing | it cannot leak a user, a tenant or a timestamp even if the token is wrong, because those columns are not in its result |
| `session` table — no `DELETE` grant | erasing evidence of a session | revocation is a column |
| `@node-local` marker | a waiver with no argument | `malformed_waiver` exits 1. A missing `Reconstructible:` clause does **not** waive |
| `tools/check-stateless.mjs` | any unwaived finding | exit 1, no soft arm. `tools/check-pack-safety.mjs:38-41` argues the polarity: a soft finding is for a known gap, and a cache in a request path is not a gap |

---

## 4. The fixtures that witness it, and why `tsc` alone tells nobody anything

`docs/HANDOFF.md` §5.10: a total `Record` binds the shape and only a fixture witnesses the content;
five total records landed on 7 Aug 2026 with no construction site, so `tsc` could not have failed
on a single field chosen. Every declaration in §2 is in that position.

**Specifically: `tsc` is green today, and every single rule in §2.5 would still be green after I
paste all of §2 in.** `SessionRejection` is eleven union arms nothing constructs; `SessionBounds` is
three numbers nothing supplies; `resolveSession` is a signature. A green typecheck after this
change is not evidence of anything and must not be reported as verification.

**`tests/model/session-resolution.test.ts`** — one positive control and one per rejection arm, in
`tests/model/managed-service.test.ts`'s shape (the newest reasoned-union suite in the tree):

1. `test_a_live_session_resolves_to_a_principal_whose_org_derives_from_the_connection` — the
   positive control, and it must assert `principal.orgClass` came from `connection.owner` **by
   passing a connection whose owner disagrees with any plausible stored value**. Without that, the
   "no stored org" property is asserted by a comment.
2. Eleven rejection tests, one per arm, each mutating **one** field of the positive fixture.
   `session_idle_lapsed` and `session_lifetime_exceeded` must be **separately** reachable — a
   fixture where both fire proves neither.
3. `test_bounds_absent_refuses_and_names_the_field` — set `maxIdleSeconds` to `0`, `-1` and
   `Number.NaN` and assert `bounds_not_configured` each time with `field: 'maxIdleSeconds'`.
   **This is the test that stops a default appearing.**
4. `test_the_same_inputs_produce_the_same_resolution_on_a_second_call` — call it twice, deep-equal
   the results. Trivial today and it is the regression test for the ruling: it goes red the day
   someone reaches for a clock or a counter inside.
5. `test_resolve_session_reads_no_clock` — the standing grep, in the shape
   `tests/model/reconciliation-controls.test.ts:251` already uses for `Math.random`: strip comments
   from the `resolveSession` region and assert `Date.now`/`new Date()` count is 0.

**`tests/tools/check-stateless.test.mjs`** — every rule needs a **paired** fixture, because
`tests/ci/gate.test.ts:20-26` states the standard: *"Every rejection test below is PAIRED with a
positive control on a fixture differing only in the defect: a checker that exits 1 unconditionally
fails the pair, and a checker that exits 0 unconditionally fails it from the other side."*
Fixtures under `tests/tools/fixtures/stateless/`, and the checker gains `--root` so a test can aim
it at a fixture directory (the `--corpus` precedent, `tools/check-pack-safety.mjs:43-46`):

| Fixture | Expect |
|---|---|
| `clean.ts` | exit 0, `findings: []`, and **`filesScanned >= 1`** — without that assertion a checker that scanned nothing passes |
| `module-let.ts` | exit 1, rule `module_scope_mutable_binding` |
| `mutated-map.ts` | exit 1, rule `module_scope_mutable_container` |
| `frozen-lookup.ts` — a module-level `new Set([...])` never mutated | **exit 0.** The half that proves rule 2's two-part test bites in both directions |
| `clock.ts` — `Date.now()` | exit 1, `wall_clock_read` |
| `derived-date.ts` — `new Date(supplied)` only | **exit 0.** Or `model/` itself fails and the checker is useless here |
| `tmpdir.ts` | exit 1, `process_local_filesystem` |
| `waived-good.ts` — a full three-clause marker | exit 0, and the finding appears in `waived`, **not** absent from the report |
| `waived-missing-reconstructible.ts` | exit 1, rule `malformed_waiver` |
| `comment-quoting-the-ban.ts` — a doc comment containing `let cached = new Map()` and `Date.now()` and no code | **exit 0.** This is `model/reconciliation.ts:10-14`'s lesson as a test |

Plus, against the real tree: `test_the_checker_is_green_on_trunk_and_reports_the_one_waiver`
(exit 0, `waived` length 1, naming `db/pg.ts`), and
`test_the_checker_reports_the_absent_request_path_roots_as_vacuous` — asserting `vacuous` is
non-empty **today**, which is the assertion that will legitimately need changing the day the API
lands, and that is the right time to notice.

**`tests/ci/gate.test.ts`** gains two: `check:stateless` is in `check`, and `check:stateless` is in
`CHECKERS_THE_WORKFLOW_MAY_NOT_NAME`.

**`tests/db/session-isolation.test.ts`** — the `session` table's negative control, in
`tests/db/tenant-isolation.test.ts`'s shape with its LOUD SKIP: a `SELECT` with `app.session_id`
unset returns **zero rows** (not an error, not another session), and a `SELECT` with session A's id
set returns nothing for session B's id, **both on the same `pg_backend_pid()`** — the assertion
`docs/build/ingestion-pipeline.md` names as *"the test G98 exists for"*.

---

## 5. The mutations that prove each control bites

Each is a one-line edit to the tree; each expected result was checked against a rule in §2.5 or a
declaration in §2.

| # | Mutation | Expected failure |
|---|---|---|
| M1 | Add to a new `api/context.ts`: `const sessions = new Map<string, PrincipalContext>()` plus one `sessions.set(...)` | `check:stateless` exit 1 · `module_scope_mutable_container` at that file's first line. **This is the ruling's central case** and it is exactly the shape the brief names in the ingestion proposal |
| M2 | Re-add the same as `const schemaMappingCache = new Map<string, SchemaMapping>()` in the extraction path | exit 1 · `module_scope_mutable_container`. **Two independent controls now fire on one line**: the ruling, and G103's tenant-scoped-table ruling. §7 records that this binding is **not in the tree** |
| M3 | In `model/reconciliation.ts` §6, replace a supplied timestamp with `Date.now()` | exit 1 · `wall_clock_read`, **and** the module header's own control at `model/reconciliation.ts:19` goes non-zero, **and** `test_the_same_inputs_produce_the_same_resolution_on_a_second_call`-style determinism tests in the 666-test suite go red |
| M4 | `const tie = Math.random()` as a tie-break in `passFuzzyReference` | exit 1 · `unseeded_randomness`, and `tests/model/reconciliation-controls.test.ts:251` already fails independently — **two mechanisms, one property**, which is the posture G120 praises |
| M5 | Add `query(text: string): Promise<QueryResultLike>` to `TenantPool` (`db/tenant-scope.ts:69`) | exit 1 · `tenant_pool_exposes_query`. **`tsc` stays green** — the field is additive and nothing calls it — so this mutation is invisible to every other control in the repository. It is the reason rule 8 exists |
| M6 | In a parser, `const dir = os.tmpdir()` and write the sanitised page there | exit 1 · `process_local_filesystem`. Also contradicts C20's *"no credentials, no database, no network egress"* posture by adding a fourth resource nobody granted |
| M7 | `setInterval(shipOutbox, 5000)` at module scope in the outbox shipper | exit 1 · `timer_as_durable_state` **and** `module_scope_mutable_binding` if its handle is stored. The outbox's correctness mechanism is the poll's *position in a row*, not a timer — `docs/build/event-architecture-recommendation.md:305-307`: *"`NOTIFY` is not durable — the poll is the correctness mechanism"* |
| M8 | Weaken `db/pg.ts:25`'s marker by deleting the `Reconstructible:` clause | exit 1 · `malformed_waiver`. **The waiver must be un-weakenable**, or every other rule is one lazy comment away from off |
| M9 | Put a `/** @node-local … Reconstructible: … */` marker on M1's session Map | exit 0, and the row appears under `WAIVED` in the report with its reason quoted. **The control's honest limit, demonstrated:** shape is checked, truth is not. That is why the report says so on every run and why §8 Q2 asks the owner who may sign one |
| M10 | Change the `session_rls` predicate to `USING (true)` | `tests/db/session-isolation.test.ts` red: session B's row is visible under session A's scope. No source checker sees this — the migration is SQL, and **that is a stated blind spot**, defended by the test alone |
| M11 | Give `resolveSession` a `bounds: SessionBounds \| null` parameter that skips the checks when null | `test_bounds_absent_refuses_and_names_the_field` red. §5.2 in one parameter, and it is the mutation a performance complaint will actually produce |
| M12 | Set `Session.tenantId` from a request body field instead of `selectTenant` | **nothing in §2 catches this** — it is invariant 1, and the control is `additionalProperties: false` plus zero `tenantId` properties in `session.openapi.yaml`, asserted by P1's own verification block. Recorded here because a reader would assume the stateless checker covers it. It does not |

---

## 6. The COST of the ruling on this surface, plainly

### 6.1 The biggest one: the hash chain becomes a per-tenant serialisation point, and the choice is irreversible

`RecordChain` (`model/governance.ts:1110-1120`): `sequence` is *"Monotonic per tenant per stream.
Gaps are the detection; absence of a row is invisible without it"*, with `previousHash` chaining to
the prior record's canonical body. `AuditEvent`, `DataAccessEvent` and `UsageAttestation` all carry
it (`model/billing.ts:669`, `model/governance.ts:1117`, `:1151`).

**Under statelessness, N nodes appending to one chain must serialise on the chain head.** No node
may hold the head in memory — that is precisely the state the ruling forbids — so each append
reads the head row, and to be correct it must read it under a lock: `SELECT ... FOR UPDATE` on a
per-`(tenant, stream)` head row, inside the request's transaction. Consequences:

- **Every audited act takes a per-tenant exclusive lock.** Under **G101**'s transaction-mode
  pooling that lock is held for the whole request transaction, not just the insert, so unrelated
  concurrent requests in one tenant queue behind each other's *slowest* statement.
- **Per-tenant audit write throughput becomes the tenant's request-concurrency ceiling.**
  `docs/build/event-architecture-recommendation.md:4.2` puts volume at ~944k `UsageRecord` +
  ~1.41M `PolicyEvaluation` per tenant-month — *"under 1 row/sec average. Unremarkable."* **An
  average is not a lock-contention argument**, and a month-end close is not the average.
- 🛑 **And the mitigation is irreversible in the direction that matters.** The fix is to partition
  the chain — one chain per `(tenant, stream, partition)` with the partition named in
  `ChainAnchor` (`model/governance.ts:1138`). **That must be decided before the first chain row
  exists**, for the reason the type comment already gives about canonicalisation
  (`model/governance.ts:1103-1109`): *"Pick a scheme before the first hash is computed, because
  afterwards every stored chain is bound to it."* G20 closed the canonicalisation half on 9 Aug
  (`model/canonical.ts`, RFC 8785) — *"Applied before the first hash, which was the only window in
  which it cost nothing"* (`docs/HANDOFF.md:128`). **The partitioning half is the same window and
  it is still open.**

This is the collision between *"scale without a node dependence"* and *"the chain breaks if a row
is deleted or edited"*. Both are the owner's decisions and only the owner can trade them. §8 Q4.

### 6.2 One uncacheable durable read before any work, on every request

§1.1's two decisions jointly forbid every standard mitigation. The read is one primary-key lookup
inside a transaction the request was opening anyway, so it is cheap — **but it is not zero and it
cannot be amortised**, and the record has now stacked three uncacheable reads in the same budget:
the session row (this), the extraction-rule cache table (**G103**, whose own row records
*"⚠️ The sub-millisecond claim was never measured — if it genuinely binds under fan-out, reopen
this with a measurement, not an assumption"*), and `redeemAuthorization()`'s grant row. If latency
is ever reopened, it must be reopened **once, with a measurement**, against all three — not
per-subsystem, or the answer will be a cache in the least-defended one.

### 6.3 `Session.lastUsedAt` turns every read request into a write

P1's `Session` carries `lastUsedAt: Timestamp` (`docs/build/green-platform-slices.md:120`), and
`TenantAccessGrant` carries the same field plus `idleRevokeDays`
(`model/governance.ts:886-887`) — *"Lapses after this many idle days regardless of expiry."*
Under the ruling that timestamp cannot live in memory, so **a page view becomes an UPDATE**, and
under G101 it is an UPDATE inside the request transaction: a row lock on the session row for the
request's duration, so two concurrent requests from one browser serialise. Three ways out, all with
costs, all the owner's: write every request (simplest, worst); write at most once per configured
interval (a bound with a number, so **the number is the owner's** under C4/O-8); or drop the field
and derive idleness from the audit stream (correct, and it makes idle-revoke a query rather than a
column). §8 Q3.

### 6.4 What it takes away: the temp file, and therefore a whole class of parser

Rule 5 forbids `os.tmpdir()`. The ingestion cascade's tier 3 wants a PDF text layer, and **O-6**
already ruled the path is `pdfjs-dist` in TypeScript rather than a second language runtime — a
library that streams in memory. **The ruling reinforces O-6 and closes the reopening argument**: a
CLI parser invoked with a temp file (pdftotext, LibreOffice, a shelled-out converter) is now
forbidden on two grounds instead of one. The cost is real: some formats have no in-memory
TypeScript parser, and those documents go to residue. That is the same cost G124 accepted, and
`docs/build/ingestion-pipeline.md` O-4 already accepted its twin.

Corollary rule the checker cannot see: with an in-memory parser, `IngestBound.maxObjectBytes` and
`maxDecompressedBytes` (C4) stop being merely prudent and become the **memory** bound of the
worker. An unset bound was already a refusal; now it is also an OOM.

### 6.5 The retry that re-dispatches under a withdrawn grant — G121, made worse

**G121** records its inherited limit: *"withdrawal stops future draws, not live ones, so a grant
withdrawn mid-map does not halt invocations already dispatched."* **Statelessness makes this
sharper rather than softer:** *"ease of retry"* means a failed map iteration is re-dispatched, and a
retry is a *new* dispatch of an act whose authority may have been withdrawn since the first
attempt. If the retry replays a cached decision, a withdrawn grant executes. **The correct posture
is that every retry attempt re-runs `redeemAuthorization()`** — which is free in design terms
because §1.1 already forbids caching the decision, and costs N redeems per N attempts. It needs a
ruling because it changes what G121's *"one grant per map execution"* means under retry. §8 Q5.

### 6.6 What it does NOT collide with

Checked, honestly: **G103** (aligned — no Redis), **G116** (ratified), **G101** (aligned — the
transaction is the lease), **G120** (aligned — `(runId, requestOrdinal)` persistence is the retry
key), **G100** (aligned — deny on NULL is what makes a forgotten scope safe on any node),
**G99** (aligned — Drizzle's autocommit footgun is already answered by `withTenantScope()`).
**O-1 is not resolved by the ruling, and the ruling does not resolve it** — but it removes one
argument *against* the in-Postgres work queue, because a broker's in-flight message is durable
while the consumer's in-memory partial work is not, and the outbox row **is** the retry. That
remains the owner's, and it remains one G number short.

---

## 7. What I did NOT solve, and what it is blocked on

1. 🛑 **`schemaMappingCache` IS NOT IN THIS REPOSITORY, and I must say so rather than report a
   finding I could not reproduce.**
   `grep -rn 'schemaMappingCache' .` (excluding `.git/` and `node_modules/`) returns **zero**. The
   multi-tiered ingestion proposal *as committed* — `docs/build/ingestion-pipeline.md` — contains
   no module-level cache; it was **adjudicated out before it landed**, and the adjudication is at
   `docs/build/reconciliation-engine.md:187-207` (S2, *"the cross-tenant regex cache"*): *"All
   three designs converge on 'there is no module-level cache' … But G103 has since ruled that a
   cache DOES exist — as a tenant-scoped Postgres table."* So: the violation named in my brief is
   real as a *proposal*, and the tree's committed answer already refuses it on two independent
   grounds (S2/G116's shared-mutable-state argument and G103's outside-RLS argument). **What is
   missing is not the ruling; it is the mechanical control that catches the next one.** That is
   §2.5, and M2 is its test.
2. **D1 itself.** Where session establishment terminates is the owner's (`docs/HANDOFF.md:145`,
   `docs/build/phase-one-plan.md:80`). §2 is deliberately written to be correct under **either**
   answer: an IdP-fronted edge still needs a durable `session` row for `lastUsedAt`, revocation and
   the tenant selection, and an in-API surface needs the same row plus P1's six operations.
3. **The bootstrap of `app.session_id`.** §2.6 recommends a `SECURITY DEFINER` lookup returning one
   scalar. I did not write the function, and it would become the single most security-relevant
   object in the schema. Blocked on: the session/persistence team's decision on whether
   `withSessionScope` nests inside `withTenantScope` or precedes it.
4. **The pagination cursor.** `docs/contracts/capability.openapi.yaml:2222-2224` justifies opacity:
   *"A cursor a client can construct is a cursor a client can point at another tenant's ordering
   key."* That sentence predates **G100**: under the RLS predicate a forged cursor **cannot** cross
   a tenant, because the predicate is the tenant GUC and not the cursor. So the cheapest stateless
   cursor is a plain keyset tuple over `(tenant_id, ordering_key, id)`, base64url-encoded and
   opaque by convention rather than by secrecy — **and no cursor store is needed at all**. What
   survives the correction is the *within-tenant* case: nothing stops a forged cursor pointing at
   another **user's** ordering key inside one tenant, and there is no per-user RLS. I did not take
   this decision. It corrects a sentence in a shipped contract and needs the owner's tick. §8 Q6.
   ⚠️ There is **no** cursor concept in `model/` — `grep -rniE 'cursor|pageSize|keyset' model/*.ts`
   → 0 — so whichever way it goes, it is a new declaration and belongs in one place.
5. **Sticky transports.** No WebSocket or SSE surface exists anywhere in the contracts — verified:
   `grep -rn 'websocket\|WebSocket\|event-stream\|EventSource' docs/contracts/*.yaml` → **0**. The one long-poll
   shape the record describes is the outbox poll, which is a worker loop over rows. The moment an
   SSE surface is drawn, sticky-node affinity arrives and **no source checker can see it** — it is
   an ALB/infrastructure property, and there is no IaC in this repository to check.
6. **Browser state.** There is no frontend. `Mockups/rec/` is 22 tracked drawn screens and no
   code. The ruling's words *"or other user artifacts"* plainly reach a half-finished definition in
   a wizard, and §8 Q7 asks how far. The checker gains a `web/` root when one exists; today it
   reports that root as vacuous, which is the honest state.
7. **The waiver's truth.** §2.5 rule 9 checks a marker's shape. Nothing can check that a
   `@node-local` reason is true — the same limit `docs/HANDOFF.md:104-108` records for
   `@dropped-for-v1`: *"No tool in this repository can tell whether a `@dropped-for-v1` note is on
   the right declaration or whether its stated reason is true."* Inherited deliberately, stated
   loudly, and §8 Q2 asks who may sign one.
8. **`RecordChain` partitioning** — §6.1. Owner's, and the window is open now.
9. **Whether `resolveSession`'s eleven arms need `ErrorCode` members.** `X5`
   (`docs/build/green-platform-slices.md:63`) records that `ErrorCode` is 71 members and **zero**
   of `AuthorisationRefusal`'s seven appear in it. `SessionRejection` will land in the same gap. Not
   my surface, but it is the §5.3 shape and it will diverge if nobody claims it.

---

## 8. Owner rulings needed, phrased as questions

**Q1 — Does the ruling forbid an in-process cache of a control-plane-published, tenant-independent
artefact?** The model catalogue, a pack, a policy bundle — each is artefact-versioned under **G89**,
carries no tenant data, and is reconstructible from a published document on any cold node.
*Recommendation:* permit it, with a `@node-local` marker naming the artefact version as the cache
key, because the literal reading of the ruling forbids something that costs nothing and leaks
nothing. *Cost of permitting:* the marker becomes the only thing separating this from M2, and a
version-keyed cache is one careless key away from being tenant-keyed.

**Q2 — Who may sign a `@node-local` marker, and does it need a second person?** `@dropped-for-v1`
needed none. This one is a waiver on a control, and **G126**'s *"nomination and promotion are two
acts"* is the record's own posture on exactly that shape. *Recommendation:* one author, but the
marker's reason must name the tenant-leak argument explicitly, and the checker's report lists every
waiver on every run so the set stays visible. *Cost:* one more review step on a rare edit.

**Q3 — `Session.lastUsedAt`: a write on every request, a write at most once per interval, or drop
the field?** Under the ruling it cannot be a memory counter, so it is a row lock on a read path
(§6.3). *Recommendation:* the interval, with **the number stated as required configuration that
refuses on absence** — the C4/O-8 posture — because it is the only option that keeps
`idleRevokeDays` meaningful without turning every page view into a serialised write. *Cost:* idle
revocation is accurate only to the interval, and that must be written on the field.

**Q4 — 🛑 `RecordChain`: one chain per `(tenant, stream)` with a serialised head, or partitioned
chains with the partition named in `ChainAnchor`?** This must be answered **before the first chain
row is written**, for the reason `model/governance.ts:1103-1109` gives about canonicalisation.
*Recommendation:* decide it now, and if throughput is genuinely unremarkable choose the single
chain **deliberately and record the ceiling**, rather than choosing it by default. *Cost of the
single chain:* a per-tenant write ceiling. *Cost of partitioning:* `ChainAnchor` grows a field, and
gap detection becomes per-partition, so *"a missing row"* becomes a slightly weaker claim.

**Q5 — Does every retry attempt re-run `redeemAuthorization()`?** G121's stated limit is that
withdrawal does not stop live acts; a retry is arguably a new act. *Recommendation:* yes, every
attempt. *Cost:* N redeems per N attempts, on the fan-out path G121 chose one-grant-per-run
specifically to keep off. This narrows G121 rather than reversing it, and it needs your word.

**Q6 — May the pagination cursor become a plain keyset tuple, with tenant isolation resting on the
G100 RLS predicate rather than on cursor opacity?** This corrects
`docs/contracts/capability.openapi.yaml:2222-2224`, which was written before RLS existed.
*Recommendation:* yes, and record the correction rather than editing the sentence away — but note
that it leaves the **within-tenant, cross-user** case unaddressed and there is no per-user RLS.
*Cost of refusing:* a cursor store, which is state, which is either a table nobody has designed or
exactly the process-local map the ruling forbids.

**Q7 — How far does *"other user artifacts"* reach into the browser?** Is a half-authored
`ReconciliationDefinition` durable from the first keystroke (an autosaved `status: 'draft'` row,
which `model/domain.ts:2158-2159` already supports), or only on explicit Save under **G58**?
*Recommendation:* explicit Save, plus a durable draft row on navigation away — because a keystroke
autosave puts an unvalidated money-column binding in the store, and **A4** records that *"a column
mapping IS a money-moving act."* *Cost:* a closed laptop loses in-flight typing, which is a node
dependence in the browser rather than the server, and you should decide whether that counts.

**Q8 — Is `tools/` in scope for the checker?** *Recommendation:* out — one-shot CLI processes with
no request, no second caller and no tenant. *Cost:* four existing accumulators stay unmarked, and
if a `tools/` script ever becomes a service the exclusion becomes wrong silently. It is listed in
the checker's "cannot see" block for that reason.

---

## Appendix — every command in this report, in one block

```bash
# the audit
grep -rnE '^(export )?(let|var) ' --include='*.ts' --include='*.mjs' model db tools tests
grep -rnE '^(export )?const [A-Za-z_$]+ *(:[^=]*)?= *(new (Map|Set|WeakMap|WeakSet)|\[\]|\{\})' \
  --include='*.ts' --include='*.mjs' model db tools tests
grep -rn 'Date\.now()' model/*.ts
grep -rn 'randomUUID\|crypto\.' model/*.ts | grep -v '^\S*: *\*'
grep -rn 'globalThis\|setTimeout\|setInterval' model/*.ts
grep -rn 'writeFileSync\|mkdtemp\|tmpdir\|/tmp' model/*.ts
grep -rn 'schemaMappingCache' .            # 0 — see §7 item 1

# the engine's own controls, re-run
code() { grep -vE '^[[:space:]]*(\*|/\*|//)' model/reconciliation.ts; }
code | grep -c 'new Date\|Date\.now'; code | grep -c 'Math\.random'
code | grep -c 'new RegExp';          code | grep -c 'throw '

# concurrency vocabulary — what does NOT exist
grep -rniE 'etag|if-match|optimistic|rowVersion' model/*.ts
grep -rn 'etag\|If-Match' docs/contracts/*.yaml
grep -rniE 'cursor|pageSize|keyset' model/*.ts
grep -rn 'websocket\|WebSocket\|event-stream\|EventSource' docs/contracts/*.yaml   # 0

# ground truth
ls model/*.ts | wc -l ; grep -h '^export ' model/*.ts | wc -l
grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md
```

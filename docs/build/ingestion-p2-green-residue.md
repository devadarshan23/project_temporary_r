# GREEN — the ingestion residue as a first-class object

*Design only. No file in `/Users/jrkphani/Projects/Reconcile` was created, edited or deleted; no git
command was run. Every `file:line` below was opened in this session. Every count carries the command
that derives it.*

**The brief:** adjudication §8 item 1 — *"The ingestion RESIDUE has no model object and nobody
proposed one. There is no type for an artefact that arrived, was stored, was billed, and never became
a `SourceDocument`."* C19 names the control and says the object is undesigned. This is the object.

**Counts re-derived 9 Aug 2026, in this session:**

```bash
ls model/*.ts | wc -l                                  # 18
grep -h '^export ' model/*.ts | wc -l                  # 832
awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'   # 37
awk '/^export const ACCESS_RESOURCE_CLASSES = \{/,/^\}/' model/governance.ts | grep -cE '^  [a-zA-Z]+:'  # 13
grep -rn actualFidelity model/ | wc -l                 # 0
```

---

## 0. Three things at the tree that contradict the adjudication, found while designing this

Reported first because two of them change the build order.

**(a) `db/` EXISTS. The two-tenant leak test is written, and migration 0001 is applied-shaped.**
The adjudication's ordered build lists item 8 as *"Shred-in-one-transaction against local Postgres +
the **G98 two-tenant leak test** (same-PID assertion; a query outside the transaction returns zero
rows)"* — as work to do. It is **done**, for the tenancy tables:

- `db/migrations/0001_tenancy_and_rls.sql` — `CREATE TABLE tenant` (`:70`), `CREATE TABLE
  tenant_contact` (`:95`), `ENABLE`/`FORCE ROW LEVEL SECURITY` on both (`:133-136`), and the
  deny-on-NULL predicate `nullif(current_setting('app.tenant_id', true), '')` (`:174-181`).
- `db/tenant-scope.ts:1-40` — `withTenantScope()`, with the three leak modes named and answered.
- `tests/db/tenant-isolation.test.ts:9-27` — all four assertions the adjudication asks for,
  including `(d) both tenant reads ran on the SAME pooled backend, asserted by pg_backend_pid()`.

So `CLAUDE.md`'s heading *"Writing code that touches the database — ruled 8 Aug 2026, NONE of it
applied"* and its sentence *"There is no database, no schema, no migration and no client dependency
in this repository"* are **both false**. What is still true: `pg` is **not** in `package.json`
(`devDependencies` are `@types/node` and `typescript` only) — `db/pg.ts:1-30` loads it dynamically
and degrades to a loud skip precisely so a clean `npm ci` does not take the gate down, and that file
says so in its own words: *"G98 rules `pg`, pinned exact, as a devDependency. **It is not in
`package.json` yet.**"* `node_modules/pg` is present on this machine, so the leak test's evidence is
machine-local and not reproducible from the manifest. **That is the honest state, and it is not the
state either document describes.**

**Consequence for this design:** the arrival table is **migration 0002**, written in 0001's idiom
under G88's forward-only expand/contract, and it can be tested against local Postgres today. It is
not blocked on a database that does not exist.

**(b) `SubjectLocation`'s `blob` variant is `{ bucket; key }` and `SourceDocument.storageRef` is ONE
opaque string — so no `SourceDocument` blob can be registered in the erasure index without parsing
an address the model says is never parsed.** Verified:

- `model/governance.ts:1784` — `| { kind: 'blob'; bucket: string; key: string }`, whose own comment
  (`:1780-1783`) says it exists because *"purging a SourceDocument row cascades to its own object
  through storageRef, but an export contains whatever the export contained and no row addressed
  it."*
- `model/domain.ts:1849` — `storageRef: string`, one field.
- `grep -rn "bucket\|storageRef" model/*.ts` returns those two and nothing that splits one into the
  other.

The adjudication's A3 struck Green 2's premise on the ground that `blob` already exists. **It does,
and it is not constructible from the field it was added for.** The record's own rule forbids the
obvious fix: `Endpoint.address` (`model/domain.ts:770-772`) states *"Opaque here — a URL, a mailbox,
a queue ARN, a workspace install id. Never parsed for authorisation, and never pattern-matched."*
So the arrival below carries **`storageBucket` and `storageKey` as two fields**, and the same
correction is owed on `SourceDocument.storageRef` — reported, not applied.

**(c) `Close.dc.html` band D is confirmed as per-document extraction confidence, exactly as the
adjudication says, and the mockup's own row is the proof.** `Mockups/rec/Close.dc.html:203`:

```
{ ref: 'D', name: 'Could not read · 3 dockets', amt: '11,420.00', variance: '—',
  status: 'Below the 90% floor', sub: 'handwritten, warehouse 118', … action: 'You classify' }
```

It carries an **amount** and a **floor**, so the dockets were read; it sits in a register headed
*"Three-way match · run 09 Mar 03:12 · v4"* (`:82`), so it is inside a run. A never-routed artefact
has no amount, no confidence, no field and no run. **Band D is not where the residue goes**, and the
answer to "how does it become visible" is §2.7 below — it is the register's third figure,
`{ label: 'Coverage', value: '99.2%' }` (`Close.dc.html:196`), which **nothing in `model/` can
compute today** because coverage needs a denominator and the denominator is arrivals.

---

## 1. What already exists that this reuses

Nothing below is minted. Each row is a verified declaration this design binds to rather than
duplicating.

| # | Existing thing | Where | What it carries for the residue |
|---|---|---|---|
| 1 | `AcquisitionFidelity` — `structured · tabular · digital_text · scanned` | `model/domain.ts:1782-1793` | **The tier vocabulary.** `tier_refused` names a rung with this union, so no fifth tiering is coined (§5.3, adjudication §4) |
| 2 | `SourceDocument` | `model/domain.ts:1840-1864` | The thing the arrival is explicitly **not**. Field-for-field the arrival borrows `filename`, `synthetic`, `purgeAfter`, `purgedAt` **by name**, so one vocabulary covers both |
| 3 | `TenantScoped` | `model/kernel.ts:438-440` | Invariant 1. Its own comment: *"this field records the scope an authenticated session already established, it does not select one"* |
| 4 | `Id<TName>` + the kernel id block | `model/kernel.ts:43`, `:98-128` | The brand. `IngestArrivalId` goes here, not in `domain.ts` — `kernel.ts:177-181` records the standing reason: *"a NEW id has no such history to preserve… they import it from a module with no imports of its own"* |
| 5 | `AssertBrandsMatchNames` / `AssertEntityIdentities` | `model/identity.ts:185`, `:448` | The two maps that make the brand mechanical. `IngestArrival` gets an entry in each, **in the landing commit** — `identity.ts:502-510` records that registering on arrival rather than in a later sweep is *"the whole lesson of the fourteen below"* |
| 6 | `AssertNoTextDeep` | `model/reconciliation.ts:258` | The containment proof for the refusal union. Deep, unlike `AssertNoPlainText` (`:234-239`) |
| 7 | `ResidueCause` / `ResidueEntry` / `dispositionFor()` | `model/reconciliation.ts:2080-2127` | **The shape being copied**: a closed text-free cause union, `AssertNoTextDeep` over it (`:2098`), and a disposition **derived from the cause by a function** rather than settable beside it |
| 8 | `RETENTION_CLASSES` (13) + `RetentionPolicy.days` + `_RetentionPolicyAnswersEveryClass` | `model/domain.ts:1086-1102`, `:1179`, `:1201` | The retention answer. **No fourteenth class** — §2.4 |
| 9 | `RETENTION_CLASS_FOR: Record<LearningRecordKind, RetentionClass>` | `model/learning.ts:1862-1865` | **The exact precedent for §2.4's table**, with its own stated reason at `:1826-1827`: *"Two kinds here, and NO new `RetentionPolicy` field — which is the point, because both already exist"*, and at `:1857-1860` the reason it is typed `RetentionClass` and not a local union |
| 10 | `SubjectLocation.blob` | `model/governance.ts:1784` | The erasure location. No twelfth variant is needed — see §0(b) for what does need fixing |
| 11 | `SubjectIndexEntry` | `model/governance.ts:1868-1874` | `subjectRef` is *"a PER-TENANT HMAC of the natural identifier"* — and §2.5 is about the case where **there is no natural identifier to HMAC** |
| 12 | `ErasurePlanItem.disposition` incl. `out_of_reach` | `model/governance.ts:1975-1980`, argued at `:1954-1957` | *"An erasure plan that admits what it cannot reach… is worth more than one that silently misses it and reports success."* The residue is the sharpest case that exists for that arm |
| 13 | `purgeVerdict()` — HOLD > MINIMUM > ERASURE > MAXIMUM | `model/governance.ts:1923-1949` | Runs over the arrival unchanged; it takes `retainUntil: Timestamp`, which is the arrival's `purgeAfter` |
| 14 | `AuditEvent.subjectType/subjectId` and `DataAccessEvent.subjectType/subjectId`, **bare by rule** | `model/domain.ts:3981-3986`, `model/governance.ts:1178-1188`, exempted at `model/identity.ts:860-862` | *"an audit row names a row of ANY type"* — so auditing and access-logging an arrival needs **zero** new machinery |
| 15 | `METERS` (8) + `METER_AGGREGATION` | `model/billing.ts:75-113` | `pages_extracted`, `documents_processed`, `storage_gb_month`. **No new meter** — §2.6 |
| 16 | `UsageRecord`, immutable and unpriced | `model/billing.ts:122-239` | Invariant 5. The arrival is the **subject** of meters, never the carrier of money |
| 17 | `AUTHORIZATION_MAY_BE_ABSENT: Record<AuditActor['kind'], boolean>` | `model/governance.ts:1232-1238` | **The shape of §2.6's boolean table** — its docblock calls it *"THE LAW, EXECUTABLE RATHER THAN COMMENTED"*, against *"a nullable join key with a paragraph explaining when null is acceptable"* |
| 18 | `Endpoint` + `ENDPOINT_DIRECTIONS.inbound` | `model/domain.ts:743-803`, and the gap stated at `:730-734` | *"inbound a TRUST BOUNDARY… Note this is a live gap rather than a solved one: the trifecta rule is scoped to counterparty replies, and a connector-pulled document reaches extraction with no admission act at all."* **The arrival row is the record of that admission act, and it is the first thing in the tree to be one** |
| 19 | `Solution.endpointIds` / `definitionIds` / `documentTypeIds` | `model/domain.ts:2624`, `:2647-2648` | The only endpoint→configuration join that exists. §2.7 states exactly what it does and does not buy |
| 20 | `Exception.costCentre` / `legalEntity`, and the null rule | `model/domain.ts:3018-3019`, argued `:2968-3008` | *"⚠️ NULL MUST NEVER SATISFY A `these` NARROWING."* Copied verbatim to the arrival, for the same two `AssignmentScope` dimensions |
| 21 | `FieldSpec.confidenceFloor` and G38 | `model/domain.ts:1764`, `:1736-1762` | *"Unblocks `Close.dc.html` band D — unreadable dockets sit in the same list as everything else, so capture never becomes a second inbox."* This is the sentence C19 extends one layer earlier |
| 22 | `field_not_classified` and `admitPopulation()`'s four refusals | `model/reconciliation.ts:847` (declaration), refusals at `:1015`, `:1030`, `:1044`, `:1062` | G106's fail-closed half, already executable. An arrival has **no `FieldSpec` at all**, which is G106 at its widest — §3 |
| 23 | `resolveManagedService()` + `ManagedServiceRejection` | `model/policy.ts:1781`, union `:1726-1748` | The gate a quarantined arrival must never reach. Its refusal union is the naming family the arrival's joins: reasoned arms, never a boolean (`:1715-1719`) |
| 24 | `db/migrations/0001_tenancy_and_rls.sql` composite PK rule (`:88-93`) and the RLS predicate (`:174-181`) | | Migration 0002 copies both verbatim |
| 25 | `notImplementedReader()` | `model/reconciliation.ts:2364-2371` | The G118 shape for an unbuilt seam: a function that **refuses**, not a stub that pretends |
| 26 | `MODULE_COUNT = 18` | `tests/model/runtime-importability.test.ts:44` | The literal that must move to 19. It is *"written here as a literal on purpose: a sweep over a mis-globbed or empty list passes while asserting nothing"* |

**Two things I looked for and did not find, which is why parts of §2 are new:**

- No content-type vocabulary anywhere. `grep -rni "mime\|content.type\|\.pdf\|csv\|xlsx" model/*.ts`
  returns four prose mentions in comments and `SourceDocument.filename`. Nothing enumerates what an
  arriving artefact *is*.
- No arrival, no ledger, no denominator. `grep -rn "arriv" model/*.ts` finds only prose. The
  register's `Coverage` figure has no computable definition.

---

## 2. The design

### 2.1 Which module, and why

**A new module: `model/ingestion.ts`. Module 19.**

Four reasons, in order of force:

1. **The adjudication already presumes one, three times, and puts standing controls in its header.**
   R1: *"it must be written into the ingestion module header as its own sentence."* R3: *"Standing
   control, in the ingestion module header from the first commit: `grep -c 'new RegExp' → 0`."* C11:
   *"Standing header controls from the first commit."* There is no such file. Writing the residue into
   an existing module puts those controls in a file whose header already governs something else.
2. **Not `model/reconciliation.ts`.** That module's header states the property this row breaks:
   *"THE ENGINE HAS NO AUTHORITY, NO CLOCK, NO IDENTITY AND NO NETWORK. It mints no id, reads no
   clock, calls no model and writes no record"* (`:80-82`). An arrival row **has** an id and three
   timestamps. Putting it there costs that module its stated property, and the property is
   load-bearing for invariant 10's argument two lines later.
3. **Not `model/domain.ts`.** It is the largest module; `kernel.ts:177-181` records the standing
   objection to routing a new declaration through it, and `CLAUDE.md`'s working practice requires a
   plan before touching it *"because the blast radius is the whole model."* Three fields on
   `SourceDocument` (C7/C8) are a `domain.ts` change and should be their own commit; the arrival is
   not.
4. **Not `model/governance.ts`.** The arrival is a data-plane content row. Governance holds the index
   that **points at** it (`SubjectLocation`), which is the correct direction of dependency.

**Cost, stated because it is mechanical and it will fail the gate:** `tools/check-doc-counts.mjs:139`
derives `modules` from the tree with `band: [8, 30]` and nouns `(?:TypeScript|model) modules` /
`modules under`. Every document line saying **18 modules** goes `STALE` the moment the file lands and
`npm run check` exits 1 until they are updated — `CLAUDE.md`, `docs/HANDOFF.md` §1 and §2,
`docs/INDEX.md`. Same for `exports` (`:146`, currently 832). **That is the checker biting, not a
problem to route around**, and the fix is in the landing commit.

**Imports.** All type-only except the two `Record` tables and the four functions, which are values
declared **in this file** — so the module has **zero value imports** and cannot acquire the
extensionless-specifier defect that stopped three modules loading on 8 Aug. Control in the header:
`grep -cE '^import \{' model/ingestion.ts → 0`.

```ts
import type {
  DocumentTypeId, EndpointId, IngestArrivalId, SolutionId, SourceDocumentId,
  TenantScoped, Timestamp,
} from './kernel'
import type { AcquisitionFidelity, RetentionClass } from './domain'
import type { SubjectLocation } from './governance'
import type { AssertNoTextDeep } from './reconciliation'
```

`domain.ts` already carries `import type { IdentifierNormalisation } from './reconciliation'`
(recorded at `model/reconciliation.ts:40-44`), so a type-only edge into `reconciliation.ts` is
precedented and erased before the loader sees it — no cycle.

### 2.2 Identity and brand

**Insertion point:** `model/kernel.ts`, immediately after `export type SourceDocumentId =
Id<'SourceDocument'>` at `:103`, because the two ids are read together and the neighbour is the type
this one exists to be distinguished from.

```ts
/**
 * AN ARTEFACT THAT ARRIVED. NOT A DOCUMENT — and the brand is what makes the
 * distinction survive a call site.
 *
 * G35: a machine-produced timed record gets its own identity by default. This one
 * earns it three times over. It is the row a `DataAccessEvent` names when someone
 * opens a file that never parsed (`AuditEvent.subjectId` is bare by rule, so the
 * pair `(subjectType, subjectId)` needs an addressable id on the other side); it
 * is the row a `duplicate_of_earlier_arrival` refusal points AT; and it is the only
 * handle on a stored blob that no `SourceDocument` addresses.
 *
 * ⚠️ THE SLUG MUST BE OPAQUE, AND THIS IS THE ONE ID IN THE MODEL WHERE THAT IS A
 * RULE RATHER THAN A STYLE. G97 stores every id verbatim as `text` and every
 * fixture id is a READABLE prefixed slug — `ten_acme`, `def_fin_3way`. An arrival
 * slug minted from the filename would put counterparty-controlled text into a
 * primary key, into a log line, and into whatever crosses the plane boundary
 * (invariant 3, and `UsageRecord.runId` is the precedent for an opaque data-plane
 * scalar the control plane holds and cannot resolve). Mint it from the content
 * hash and a counter, never from `filename`.
 */
export type IngestArrivalId = Id<'IngestArrival'>
```

**And two registry entries in `model/identity.ts`, in the same commit** — `:502-510` records why
"same commit" and not "a sweep later":

```ts
// in _BrandArgumentsNameTheirEntities (model/identity.ts:213), after the slice-6 block
  IngestArrival: IngestArrivalId

// in _EntitiesCarryTheirOwnIdentity (model/identity.ts:502)
  IngestArrival: IngestArrival

// in _NoIdShapedReferenceIsABareString (model/identity.ts:962), under a new `/* ingestion.ts */`
  IngestArrival: IngestArrival
  ArrivalRefusal: ArrivalRefusal        // carries ofArrivalId and candidates: DocumentTypeId[]
```

`BareByRule` gains **nothing**: `contentSha256`, `storageBucket`, `storageKey` and `filename` are not
id-shaped names, so `NoBareIdReferences` does not see them and no exemption is needed. That is
deliberate — `identity.ts:842-865` calls the list *"an exception… rather than a hole"*, and a
fourteenth entry should cost an argument.

### 2.3 The declarations, ready to paste

**File: `model/ingestion.ts` (new). Order below is the file order.**

```ts
/* ==================================================================== *
 * INGESTION — the arrival ledger, as types and total functions
 *
 * WHAT THIS MODULE IS. One row per ARRIVING ARTEFACT, whether or not it became a
 * `SourceDocument`. It is the object adjudication §8 item 1 says nobody designed:
 * *"There is no type for an artefact that arrived, was stored, was billed, and
 * never became a `SourceDocument`."*
 *
 * 🛑 THE ROW EXISTS FOR EVERY ARRIVAL, INCLUDING THE SUCCESSFUL ONES, AND THAT IS
 * THE WHOLE DESIGN. A table holding only failures IS the second inbox C19 exists
 * to refuse: it cannot produce the DENOMINATOR, so *"3 dockets could not be read"*
 * has no *"out of how many"*, and `Close.dc.html`'s own third figure —
 * `{ label: 'Coverage', value: '99.2%' }` — stays uncomputable. The residue is
 * visible in the same list because THE LIST IS THE ARRIVAL LEDGER.
 *
 * WHAT THIS MODULE IS NOT. It is not an extraction pipeline, not a tier, not a
 * parser and not a queue. It mints no id, reads no clock, opens no transaction,
 * calls no service and reaches no network. Every function here is a pure total
 * fold over values the caller supplies.
 *
 * G106 AT ITS WIDEST, AND IT MUST BE THE FIRST SENTENCE ANY READER TAKES AWAY.
 * An arrival that never became a `SourceDocument` has NO `FieldSpec` for any key in
 * it, because it was never mapped to a `DocumentType`. Under G106 a key with no
 * `FieldSpec` is UNREADABLE — stored, but unaddressable by any agent, prompt,
 * export or dashboard. So:
 *
 *   THE BYTES OF A NON-ADMITTED ARRIVAL ARE UNREADABLE BY ANYTHING. No agent, no
 *   prompt, no export, no dashboard, no dispute view, no "let me just look at
 *   what came in". The row below is metadata ABOUT an artefact nobody may read,
 *   and that is the fail-closed direction G106 chose over the alternative it
 *   rejected — defaulting unmapped keys to the most sensitive class, which is
 *   scope failing OPEN.
 *
 * ⚠️ EVERY CONTROL BELOW STRIPS COMMENTS FIRST, for the reason
 * `model/reconciliation.ts:10-14` gives — a control that FAILS WHILE THE PROPERTY
 * HOLDS teaches people to ignore controls. Define `code` once:
 *
 *   code() { grep -vE '^[[:space:]]*(\*|/\*|//)' model/ingestion.ts; }
 *
 *   code | grep -c 'new RegExp'                      → 0   R3 / G124 / G130
 *   code | grep -c 'throw '                          → 0   failures are values
 *   code | grep -c 'new Date\|Date\.now'             → 0   no clock
 *   code | grep -c 'Math\.random'                    → 0   determinism
 *   code | grep -c ': any'                           → 0
 *   code | grep -ci 'price\|rateCard\|unitPrice'     → 0   invariant 5
 *   code | grep -c '\.cost\|amountMinor\|Money'      → 0   invariant 5
 *   code | grep -c 'anthropic\.\|claude-\|amazon\.'  → 0   G104
 *   grep -cE '^import \{' model/ingestion.ts         → 0   no value import at all
 *
 * 🛑 THE THIRD CONTROL FROM THE BOTTOM IS THE ONE THAT COSTS SOMETHING, AND IT IS
 * INVARIANT 5. The brief for this object says the artefact *"was billed"*. There
 * is NO field on this row for what it cost, and there must not be one. A raw
 * usage record is volume in the clear; money is derived; `UsageRecord` is
 * immutable and unpriced. `billedAt`, `chargedMinor` or `textractCost` on this row
 * would put a derived figure on a content row and make a pricing change rewrite
 * history. What this row carries instead is §5's `ARRIVAL_IS_A_PROCESSED_DOCUMENT`
 * — which meter may fire, never what it was worth.
 *
 * DECISIONS THIS MODULE IMPLEMENTS AND MAY NOT RELITIGATE
 *   G35   a machine-produced timed record gets its own identity
 *   G88   the table is a new migration, never an edit to 0001
 *   G97   ids are `text`, stored verbatim — and THIS id is opaque (kernel.ts)
 *   G100  RLS denies on NULL; a forgotten transaction returns zero rows
 *   G106  a key with no `FieldSpec` is UNREADABLE — see the banner above
 *   G107  this is data-plane code; nothing here ships upward
 *   G118  an unbuilt seam REFUSES and says so; it does not stub
 * ==================================================================== */
```

#### (i) What the bytes are — `SniffedContentKind`

```ts
/**
 * What F12 decided the BYTES are. Closed, and grown only by a platform release —
 * exactly like a `PairingStrategy` kind, and for the same reason.
 *
 * ⚠️ GENUINELY NEW, AND THAT IS NOT §5.3, BECAUSE `AcquisitionFidelity` EXPRESSES
 * A DIFFERENT AXIS. Fidelity (`model/domain.ts:1782-1793`) is how much STRUCTURE
 * an artefact arrived with, which selects an extraction path: `tabular` covers a
 * CSV and a spreadsheet together. Those two are not the same bytes — one is text
 * with a delimiter and the other is a ZIP container — and `maxDecompressedBytes`
 * and `maxCompressionRatio` apply to the second and are meaningless on the first.
 * A rule that routed on fidelity and then applied a decompression bound would be
 * §5.1: keyed on a convenient landmark instead of the property it protects.
 * Verified before minting: `grep -rni "mime\|content.type\|\.pdf\|csv\|xlsx"
 * model/*.ts` returns four prose mentions in comments and
 * `SourceDocument.filename`. Nothing in the model names what an artefact IS.
 *
 * 🛑 `unrecognised` IS A MEMBER AND THERE IS NO NULL. C18's rule, applied one
 * layer earlier: *"`null` must mean 'the file declared none', NOT 'unchecked'"*.
 * Here there is no third state to express — F12 runs with no database reach
 * (C20), so the orchestrator writes the row only AFTER the sniff returns, and
 * "not sniffed yet" is not a state a row can be in. A nullable field would invent
 * one, and the first reader would take the permissive branch on it (§5.5).
 *
 * ⚠️ THIS IS THE ROUTING KEY AND IT IS DELIBERATELY NOT A MIME STRING. The
 * owner's proposal routes on `IF extension == .csv`; an extension is
 * counterparty-controlled and an open string. This union is ours, closed, and
 * decided from the bytes — the extension survives only as `declaredKind`, a HINT
 * that is recorded and COMPARED.
 */
export const SNIFFED_CONTENT_KINDS = {
  /** Text with a record separator. CSV, TSV. Fidelity `tabular`. */
  delimitedText: 'delimited_text',
  /** A ZIP container of parts. XLSX, ODS. THE ONE WITH A COMPRESSION RATIO. */
  spreadsheet: 'spreadsheet',
  /** PDF. May or may not carry a text layer; that is C6's question, not this one. */
  portableDocument: 'portable_document',
  /** A flat image. JPEG, PNG, TIFF. Fidelity `scanned`, always. */
  rasterImage: 'raster_image',
  /** XML. Peppol, UBL, EDI-over-XML. Fidelity `structured`. */
  markupDocument: 'markup_document',
  /** JSON. An API payload landed as a file. Fidelity `structured`. */
  objectNotation: 'object_notation',
  /** A container that is not a spreadsheet. `maxArchiveDepth` applies. */
  archive: 'archive',
  /**
   * F12 RAN AND COULD NOT TELL. Not "we did not look" — see the banner.
   *
   * This member is what makes the routing table total without a default arm, and
   * a default arm on a routing table over counterparty bytes is how an unknown
   * format reaches the most expensive tier.
   */
  unrecognised: 'unrecognised',
} as const
export type SniffedContentKind =
  (typeof SNIFFED_CONTENT_KINDS)[keyof typeof SNIFFED_CONTENT_KINDS]
```

#### (ii) The bound keys — `IngestBoundKey`

```ts
/**
 * THE EIGHT BOUNDS OF C4, AS A KEY SET RATHER THAN AS EIGHT FIELDS.
 *
 * ⚠️ THIS IS A CONTRIBUTION TO C4, NOT A DUPLICATE OF IT, AND THE DIFFERENCE IS
 * TOTALITY. C4 as adjudicated is eight named fields; eight fields are eight
 * things somebody can forget to set, and the ninth bound added next year is a
 * field nobody has to answer. Declared as a key set, `IngestBound` becomes
 * `Record<IngestBoundKey, number>` and is TOTAL BY CONSTRUCTION — a ninth bound
 * is then a compile error at every construction site, which is the same argument
 * `RetentionPolicy.days` makes for `Record<RetentionClass, number>`
 * (`model/domain.ts:1069-1071`).
 *
 * 🛑 NO NUMBER APPEARS HERE OR ANYWHERE IN THIS MODULE. `PRODUCT.md` forbids
 * inventing a figure and `IdentifierNormalisation.maxInputChars`
 * (`model/reconciliation.ts:381-386`) states the discipline: *"a bound with no
 * number is not a bound (§5.6)… It is never silently unbounded, which is the
 * outcome a default would produce."* The numbers are O-8, the owner's. Until they
 * are stated, EVERY ARRIVAL REFUSES — which is the intended failure and is also
 * the reason O-8 is a blocker rather than a nicety (§7).
 */
export const INGEST_BOUND_KEYS = {
  maxObjectBytes: 'max_object_bytes',
  maxDecompressedBytes: 'max_decompressed_bytes',
  maxCompressionRatio: 'max_compression_ratio',
  maxPages: 'max_pages',
  maxRows: 'max_rows',
  maxCellChars: 'max_cell_chars',
  maxArchiveDepth: 'max_archive_depth',
  maxRowsPerTransaction: 'max_rows_per_transaction',
} as const
export type IngestBoundKey =
  (typeof INGEST_BOUND_KEYS)[keyof typeof INGEST_BOUND_KEYS]
```

#### (iii) The closed, text-free union of reasons — `ArrivalRefusal`

```ts
/**
 * WHY AN ARTEFACT IS NOT A `SourceDocument`. Closed, and TEXT-FREE BY PROOF.
 *
 * The naming is the house family, not a new one: `MoneyRefusal`,
 * `NormalisationDefect`, `ExtractionRefusal`, `AdmissionRefusal`,
 * `AllocationRefusal`, `ToleranceRefusal`, `ReaderRefusal` — `<Object>Refusal`,
 * every one of them a reasoned union and never a boolean (§5.2).
 *
 * 🛑 A PARSER'S ERROR MESSAGE IS DERIVED FROM COUNTERPARTY BYTES, AND THERE IS NO
 * ARM THAT CAN CARRY ONE. That is the point of the assertion below rather than a
 * side effect of it: a refusal is the value most likely to be put in a log, an
 * `AuditEvent` and a screen by the first engineer who debugs this — and
 * `MoneyRefusal`'s own comment (`model/reconciliation.ts:274-283`) says the
 * cheapest way to make the harmful case impossible is for the type not to admit
 * it. `zlib: invalid distance too far back`, a PDF `Producer` string and an XLSX
 * sheet name are all counterparty-influenced text, and all three are unrepresentable
 * here.
 *
 * ⚠️ NUMBERS ARE PERMITTED AND STRINGS ARE NOT, AND THE ASYMMETRY IS THE
 * CONTAINMENT ARGUMENT RATHER THAN AN OVERSIGHT. `model/reconciliation.ts:2163-2164`
 * states it: containment *"is about the ALPHABET of the output"*. An observed byte
 * count is a scalar the privileged side measured; a parser message is an alphabet
 * the counterparty chose.
 */
export type ArrivalRefusal =
  /* --- F12, before any tier. C20: no credentials, no database, no egress. --- */
  /**
   * The sanitiser did not return. THIS ARM IS AN ATTACKER-CONTROLLED COST
   * AMPLIFIER AND IT MUST NOT ESCALATE — adjudication I7. A malformed artefact
   * that reliably OOMs the cheap stage would otherwise route deterministically to
   * the most expensive tier at the sender's choosing, and a systematic memory
   * misconfiguration would present as a Textract bill rather than an error.
   * `ARRIVAL_MAY_BE_REPROCESSED` is `false` for its disposition, which is where
   * that is enforced rather than asserted.
   */
  | { readonly kind: 'sanitiser_did_not_complete' }
  | { readonly kind: 'active_content_present' }
  | { readonly kind: 'structurally_rejected' }
  /** Encrypted with a key we do not hold. Not dangerous; not ours to open either. */
  | { readonly kind: 'encrypted' }
  /**
   * The extension said one thing and the bytes said another. The adjudication:
   * *"The extension is a HINT that is recorded and COMPARED; disagreement
   * quarantines."*
   */
  | {
      readonly kind: 'declared_kind_disagrees_with_content'
      readonly declared: SniffedContentKind
      readonly sniffed: SniffedContentKind
    }
  /**
   * C4. `limit` is the CONFIGURED bound and `observed` is what was measured, so
   * the refusal is actionable without the reader re-deriving the comparison — the
   * property `ManagedServiceRejection` states for itself
   * (`model/policy.ts:1721-1724`).
   */
  | {
      readonly kind: 'bound_exceeded'
      readonly bound: IngestBoundKey
      readonly limit: number
      readonly observed: number
    }

  /* --- routing: nothing claimed it. Red 1's "a file no rule matched simply
   *     disappears", given a row. --- */
  /**
   * The object was inside the tenant's prefix and matched no registered endpoint —
   * a file dropped in the wrong folder. `IngestArrival.endpointId` is null on this
   * arm and on no other.
   */
  | { readonly kind: 'no_endpoint_resolved' }
  | { readonly kind: 'no_document_type_resolved' }
  /**
   * More than one `DocumentType` matched. The candidates are BRANDED IDS, which
   * pass the text-free proof; a label would not, and a label is what a hurried
   * engineer would reach for.
   */
  | {
      readonly kind: 'document_type_ambiguous'
      readonly candidates: readonly DocumentTypeId[]
    }

  /* --- the `tabular` tier's own precondition. Adjudication I3: the mapping is a
   *     PRECONDITION of the tier, not a product of it. --- */
  /**
   * THE MOST COMMON NON-ERROR RESIDUE AT ONBOARDING, AND IT IS NOT A FAILURE.
   * `ACQUISITION_FIDELITY.tabular` is *"CSV or spreadsheet against a known column
   * mapping"* (`model/domain.ts:1785-1786`) and none has been promoted for this
   * header set. A person removes this reason; nothing else can.
   */
  | { readonly kind: 'no_promoted_mapping' }
  /**
   * C13 / G125 applied to ingestion: a promoted mapping applies only when the
   * incoming header set is EXACTLY EQUAL to the promoted set. Carries nothing,
   * deliberately — the header set is counterparty text and naming which column
   * appeared would put it in this union.
   */
  | { readonly kind: 'promoted_mapping_header_set_drift' }

  /* --- the ladder. C5's detail belongs to C5. --- */
  /**
   * One rung refused, named with the EXISTING tier vocabulary so no fifth tiering
   * is coined (§5.3).
   *
   * 🛑 WHEN C5 LANDS THIS ARM GAINS `refusal: NativeTextRefusal` AND THAT WIDENING
   * IS A COMPILE ERROR AT EVERY CONSTRUCTION SITE. That is the correct way to
   * leave a seam: the arm exists so routing can be written now, and the field is
   * absent rather than optional so adding it cannot be silent. Do NOT pre-declare
   * `NativeTextRefusal` here — two declarations of one union is §5.3 at the
   * smallest possible scale.
   */
  | { readonly kind: 'tier_refused'; readonly tier: AcquisitionFidelity }
  /** The ladder is absorbing and one-way, and it ended. */
  | { readonly kind: 'every_tier_refused' }

  /* --- idempotency, file grain. R5(ii) and C17. --- */
  /**
   * THE DUPLICATE AS A NAMED OUTCOME, AT THE FILE GRAIN, POINTING AT THE FIRST
   * ARRIVAL.
   *
   * C17 requires this at the row grain, where `model/reconciliation.ts`'s fold
   * silently overwrites an item carrying the same key. The same requirement at the
   * FILE grain has a cheaper answer and this is it: a re-delivered file is neither
   * an error nor work — it is a row that says which arrival is the work. Content
   * hash, never the S3 key and never a message id: *"S3 event notifications are
   * themselves at-least-once, and a redrive changes the message id while the file
   * is the same file."*
   */
  | {
      readonly kind: 'duplicate_of_earlier_arrival'
      readonly ofArrivalId: IngestArrivalId
    }

/**
 * THE CONTAINMENT PROOF, ON A TYPE THAT WOULD OTHERWISE BE THE EASIEST PLACE IN
 * THE PIPELINE TO LEAK COUNTERPARTY TEXT.
 *
 * ⚠️ VERIFY IT RED BEFORE TRUSTING IT GREEN — C10 says so about the mapper verdict
 * and it applies identically here. Add `readonly parserMessage: string` to
 * `sanitiser_did_not_complete` and confirm `TS2344`. A proof that has never failed
 * is indistinguishable from a proof that is unsatisfiable.
 */
export type _ArrivalRefusalHoldsNoTextDeep = AssertNoTextDeep<ArrivalRefusal>
```

#### (iv) The outcome, and the disposition derived from it

```ts
/**
 * ADMITTED, OR REFUSED WITH A REASON. Two arms, and the admitted arm NAMES THE
 * DOCUMENT.
 *
 * `sourceDocumentId` is required on the admitted arm and ABSENT — not nullable —
 * from the other, which is G44's structural-boundary technique applied here
 * (`model/domain.ts:3491-3502`): *"Then which type you are holding is answered by
 * the type system rather than by a comment."* A single nullable field would let
 * every reader decide for itself which shape it held, and it would erode towards
 * the arm the queue already understands.
 *
 * ⚠️ THIS FIELD IS WHAT MAKES THE ARRIVAL LEDGER A LEDGER RATHER THAN A LIST. The
 * join `arrival → document` is what answers *"which of the fourteen artefacts we
 * were sent are in this run"*, and it is the only place that question is
 * answerable — `ReconciliationRun.inputs` is `Record<SlotName, SourceDocumentId[]>`
 * (`model/domain.ts:2718`) and names only what made it through.
 */
export type ArrivalOutcome =
  | { readonly kind: 'admitted'; readonly sourceDocumentId: SourceDocumentId }
  | { readonly kind: 'refused'; readonly refusal: ArrivalRefusal }

export type _ArrivalOutcomeHoldsNoTextDeep = AssertNoTextDeep<ArrivalOutcome>

/**
 * THE TRIAGE CLASS. Five members, and each one earns its place by a DIFFERENT
 * MACHINE CONSEQUENCE — which is the test a union member has to pass here, not
 * whether it reads well on a screen.
 *
 * The three tables below are keyed on this union and are total, so a sixth member
 * cannot be added without answering all three questions.
 */
export const ARRIVAL_DISPOSITIONS = {
  /** A `SourceDocument` exists. Nothing to do, and it is IN the denominator. */
  admitted: 'admitted',
  /**
   * A person or a promotion removes the reason, and then it is re-admissible
   * AUTOMATICALLY. The only disposition for which `ARRIVAL_MAY_BE_REPROCESSED` is
   * true.
   */
  needsConfiguration: 'needs_configuration',
  /**
   * A rung refused it, or the sanitiser did not finish. It must NOT escalate to a
   * paid tier and must NOT be retried automatically — adjudication I7: *"Cost must
   * never be the escalation trigger for an error."* Distinct from
   * `needs_configuration` in exactly that: no configuration change re-admits it.
   */
  needsInvestigation: 'needs_investigation',
  /**
   * F12 refused it. It reaches no tier, no engine, no prompt and no managed
   * service, ever, without a human act — `docs/prompt-injection-posture.md`'s
   * quarantine requirement, and the reason `structurally_rejected` may not be
   * folded into the arm above.
   */
  quarantined: 'quarantined',
  /**
   * A duplicate of an earlier arrival. NOT an error and NOT work: the earlier
   * arrival is the work. It must be excluded from any shortfall a person is asked
   * to clear, and it must NOT be counted as a processed document.
   */
  superseded: 'superseded',
} as const
export type ArrivalDisposition =
  (typeof ARRIVAL_DISPOSITIONS)[keyof typeof ARRIVAL_DISPOSITIONS]

/**
 * WHICH DISPOSITION EACH REFUSAL PRODUCES. Total over `ArrivalRefusal['kind']`, so
 * a fifteenth refusal is a COMPILE ERROR until somebody decides whether it may be
 * retried, whether it may reach a paid tier, and how long it is kept.
 *
 * ⚠️ THE DISPOSITION IS NOT A FIELD ON THE ROW, AND THAT IS DELIBERATE. It is
 * derived from the refusal and from nothing else, so storing it beside the refusal
 * would be two copies of one fact with nothing keeping them agreed — §5.3 at the
 * smallest scale. `ResidueEntry.disposition` (`model/reconciliation.ts:2117`) IS a
 * field, and the difference is real rather than an inconsistency: `dispositionFor()`
 * there takes `(side, cause)`, so it is not a function of the cause alone.
 * The database column is written from `arrivalDisposition()` at INSERT and never by
 * hand — the same at-write discipline as `SourceDocument.purgeAfter` and
 * `Exception.costCentre`.
 */
export const ARRIVAL_DISPOSITION_FOR: Record<
  ArrivalRefusal['kind'],
  ArrivalDisposition
> = {
  sanitiser_did_not_complete: 'needs_investigation',
  active_content_present: 'quarantined',
  structurally_rejected: 'quarantined',
  encrypted: 'needs_configuration',
  declared_kind_disagrees_with_content: 'quarantined',
  bound_exceeded: 'quarantined',
  no_endpoint_resolved: 'needs_configuration',
  no_document_type_resolved: 'needs_configuration',
  document_type_ambiguous: 'needs_configuration',
  no_promoted_mapping: 'needs_configuration',
  promoted_mapping_header_set_drift: 'needs_configuration',
  tier_refused: 'needs_investigation',
  every_tier_refused: 'needs_investigation',
  duplicate_of_earlier_arrival: 'superseded',
}

/** Total; never throws; the only thing permitted to answer this question. */
export function arrivalDisposition(outcome: ArrivalOutcome): ArrivalDisposition {
  return outcome.kind === 'admitted'
    ? 'admitted'
    : ARRIVAL_DISPOSITION_FOR[outcome.refusal.kind]
}
```

#### (v) The row

```ts
/**
 * ONE ARRIVING ARTEFACT. Not a `SourceDocument`, and the grain is R5(i)'s: *"one
 * work item per ARRIVING ARTEFACT, never per row."*
 *
 * ⚠️ FIELDS ARE NOT `readonly`, UNLIKE EVERY VALUE UNION ABOVE, AND THE SPLIT IS
 * ARGUED. A persisted row is updated — `purgedAt` is set by the sweep, and
 * `outcome` moves from `refused{no_promoted_mapping}` to `admitted` when a mapping
 * is promoted and the artefact is re-processed. `SourceDocument`
 * (`model/domain.ts:1840-1864`) is not readonly for the same reason;
 * `ResidueEntry` (`model/reconciliation.ts:2100-2119`) is, because it is a value
 * the engine emits and nobody stores. Marking a mutable row readonly is a claim
 * the repository layer would spend its life defeating.
 *
 * ⚠️ THIS TYPE IS NOT ASSERTED WITH `AssertNoTextDeep`, DELIBERATELY, AND SAYING
 * SO IS BETTER THAN IMPLYING IT IS. `filename` IS a plain string, so the assertion
 * would fail — correctly. The distinction is `ReaderTokenUsage`'s
 * (`model/reconciliation.ts:2292-2299`): the proof belongs on what crosses OUT of
 * the quarantined side, and this row is not that. What crosses out is
 * `ArrivalRefusal`, and that is proven.
 *
 * ONE TRANSITION IS PERMITTED AND ALL OTHERS ARE NOT. `refused` → `admitted`,
 * where the disposition was `needs_configuration` and the reason was removed by a
 * human act. `admitted` never becomes `refused` — a document already exists and
 * `MatchGroup`s may already reference it. That is a schema obligation, not a type
 * one; the type cannot express it and the migration's `CHECK` can.
 */
export interface IngestArrival extends TenantScoped {
  id: IngestArrivalId

  /* --- where it came from --- */
  /**
   * NULL ON EXACTLY ONE REFUSAL ARM — `no_endpoint_resolved` — and on no other.
   * The object was inside the tenant's prefix and matched no registered endpoint.
   *
   * ⚠️ NULL MUST NEVER SATISFY A `these` NARROWING, and this is the field where it
   * would silently do so. `Exception.costCentre`'s comment
   * (`model/domain.ts:3002-3008`) states the mechanism and the trap: SQL gives it
   * for free because `NULL IN ('e_1')` is NULL, *"and that accident is the
   * enforcement, which is exactly why it is written down here: a hand-built
   * matcher in application code that treats null as 'unscoped' would reverse it,
   * and would look reasonable while doing so."*
   */
  endpointId: EndpointId | null
  /**
   * Resolved AT ARRIVAL from the endpoint's owning `Solution`
   * (`Solution.endpointIds`, `model/domain.ts:2624`), never at read time — a
   * policy edit must not silently re-scope who could already see an arrival, which
   * is the argument `Exception.costCentre` makes at `model/domain.ts:2991-2995`.
   *
   * ⚠️ NULL WHERE ZERO **OR SEVERAL** SOLUTIONS CLAIM THE ENDPOINT, and the second
   * case is a MISCONFIGURATION rather than a permission. Nothing in the model
   * stops an `EndpointId` appearing in two `Solution.endpointIds` arrays, so the
   * resolution is not total; admin should refuse the second binding at the point
   * it is set, exactly as `TagPolicy.legalEntityKey` says of its own null
   * (`model/domain.ts:1695-1701`).
   *
   * ⚠️ IT IS NOT DERIVABLE AT ALL FOR `no_endpoint_resolved`, WHICH IS THE ARRIVAL
   * MOST IN NEED OF AN OWNER. Reported, not solved — §6.
   */
  solutionId: SolutionId | null

  /* --- what arrived --- */
  /**
   * SHA-256 of the bytes, lowercase hex. THE FILE-GRAIN IDEMPOTENCY KEY, with
   * `(tenantId, endpointId)` — R5(ii).
   *
   * Not id-shaped, so `NoBareIdReferences` does not see it and no `BareByRule`
   * exemption is needed. Not branded either: it is a digest of counterparty bytes
   * and nothing in this repository mints it as an identity.
   */
  contentSha256: string
  objectBytes: number
  /**
   * ⚠️ COUNTERPARTY-CONTROLLED. Rendered, quoted as data, never interpolated as a
   * directive and never parsed for authorisation — invariant 6. Same name and same
   * type as `SourceDocument.filename` (`model/domain.ts:1844`) so that one
   * vocabulary covers both, and it is the reason this interface carries no
   * text-free proof.
   */
  filename: string
  /** What the EXTENSION claimed. A hint, recorded so it can be COMPARED. */
  declaredKind: SniffedContentKind
  /** What the BYTES said. The routing key. `unrecognised` is a member; see the type. */
  sniffedKind: SniffedContentKind

  /* --- where the bytes rest --- */
  /**
   * TWO FIELDS AND NOT ONE `storageRef`, AND THIS IS A CORRECTION OF AN EXISTING
   * DEFECT RATHER THAN A STYLE CHOICE.
   *
   * `SubjectLocation`'s blob variant is `{ kind: 'blob'; bucket: string; key:
   * string }` (`model/governance.ts:1784`). `SourceDocument.storageRef`
   * (`model/domain.ts:1849`) is ONE opaque string, so constructing that variant
   * from it requires PARSING an address — and `Endpoint.address`
   * (`model/domain.ts:770-772`) states the standing rule that an address is
   * *"Never parsed for authorisation, and never pattern-matched."* The consequence
   * is that **no `SourceDocument` blob can be registered in the erasure index
   * today**, which is precisely the hole the blob variant was added to close. Two
   * fields here makes `arrivalBlobLocation()` below a construction rather than a
   * parse. The same fix is owed on `SourceDocument`; it is a `domain.ts` change and
   * a separate commit.
   */
  storageBucket: string
  storageKey: string

  /* --- when --- */
  arrivedAt: Timestamp
  /**
   * NON-NULL, AND THAT IS DERIVED FROM C20 RATHER THAN ASSUMED. F12 runs with no
   * credentials, no database reach and no network egress, so it cannot write a row;
   * the orchestrator writes one only after the sniff returns. "Not sanitised yet"
   * is therefore not a state a row can be in, and a nullable field would invent one.
   */
  sanitisedAt: Timestamp

  /* --- what became of it --- */
  outcome: ArrivalOutcome
  /**
   * Which type it was routed to, where one was resolved. NULL where routing itself
   * refused — `no_document_type_resolved`, `document_type_ambiguous`, and every
   * F12 arm, because F12 runs before routing.
   */
  documentTypeId: DocumentTypeId | null

  /* --- the two authorising projections. Copied from `Exception`, for the reason
   *     `model/domain.ts:2968-2979` gives: two `AssignmentScope` dimensions bound
   *     on nothing until the attribute existed on the row, and *"a control that
   *     looks present and is absent is worse than an absent one."* The arrival
   *     queue is a work queue; the same defect recurs here one layer earlier.
   *
   *     ⚠️ AND THERE IS A COST THE EXCEPTION DOES NOT HAVE. `Exception` resolves
   *     these from the tenant's `TagPolicy` at raise time, from data it has read.
   *     A non-admitted arrival has been read by NOTHING, so these can only come
   *     from the SOURCE — and `Endpoint` carries no tag fields at all
   *     (`model/domain.ts:754-803`). So they are null for most arrivals today, and
   *     a tenant that scopes every assignment by cost centre sees an EMPTY residue
   *     list. Failing closed is the right direction and a silent empty queue is
   *     still a support call: admin must refuse the narrowing at the point it is
   *     set. Bare `string` deliberately, never branded — both dimensions are
   *     documented as opaque customer text. --- */
  costCentre: string | null
  legalEntity: string | null

  /* --- lifecycle --- */
  /**
   * Set at arrival. Sandbox tenants accept only `true`. Same field, same name and
   * same reason as `SourceDocument.synthetic` (`model/domain.ts:1859`): so an audit
   * can answer *"was any real data ever in the sandbox?"* directly — and an
   * arrival that never parsed is the case that question is least able to answer any
   * other way.
   */
  synthetic: boolean
  /**
   * Derived from the tenant's `RetentionPolicy` AT ARRIVAL, not at read time —
   * identical discipline to `SourceDocument.purgeAfter` (`model/domain.ts:1861`),
   * and identical window, from `days.source_document`. See
   * `ARRIVAL_RETENTION_CLASS` for why the window must be the same one.
   *
   * 🛑 FOR A NON-ADMITTED ARRIVAL THIS IS THE ONLY ERASURE CONTROL THAT REACHES THE
   * BYTES. §2.5 argues it; it is not a detail.
   */
  purgeAfter: Timestamp
  /** Present once purged; the row survives as a tombstone for audit. */
  purgedAt: Timestamp | null
}
```

#### (vi) Retention, metering and reprocessing — the three total tables

```ts
/**
 * WHICH RETENTION CLASS GOVERNS AN ARRIVAL. All five answer `source_document`, and
 * THE UNIFORMITY IS THE ARGUMENT RATHER THAN AN OMISSION.
 *
 * NO FOURTEENTH `RetentionClass`. `RetentionPolicy.days` is
 * `Record<RetentionClass, number>` (`model/domain.ts:1179`) and stays total over
 * thirteen; `_RetentionPolicyAnswersEveryClass` (`:1201`) is untouched;
 * `PLACEHOLDER_RETENTION_POLICY` (`model/examples.ts:534`) keeps compiling; and
 * `tools/check-wire-mirror.mjs:99-100` pins `RETENTION_CLASSES` against the wire,
 * so a fourteenth class is a coordinated model-plus-contract change. This is
 * `RETENTION_CLASS_FOR`'s move exactly (`model/learning.ts:1862`), whose own
 * header says *"NO new `RetentionPolicy` field — which is the point, because both
 * already exist."*
 *
 * 🛑 THE DECIDING ARGUMENT IS NOT ECONOMY, IT IS THAT THE SAME BYTES MUST NOT GET
 * TWO PURGE DATES. An admitted arrival's bytes ARE the document's blob. If an
 * arrival carried a different window from `days.source_document`, one artefact
 * would have two clocks and which one applied would depend on whether a parse
 * succeeded — a retention discontinuity produced by a parser, which is not a
 * retention decision anybody made.
 *
 * ⚠️ WHAT IT COSTS, STATED. A quarantined artefact — possibly a hostile one — is
 * kept for the same window as a good invoice, and nothing here can shorten it. The
 * alternative needs a number, and `PRODUCT.md` forbids inventing one. If the owner
 * rules a separate window (§7, O-10), the change is: a fourteenth
 * `RETENTION_CLASSES` member → `RETENTION_RECORD_KIND` red
 * (`model/domain.ts:1135`), `PLACEHOLDER_RETENTION_POLICY` red, this table red,
 * `check:wire` red. **Four failures naming every site**, which is what this table
 * buys and is why it is not deleted for being uniform.
 *
 * Typed as `RetentionClass` and not a local union, for the reason
 * `model/learning.ts:1857-1860` records: a future RENAME of a class reaches this
 * table instead of leaving it pointing at a member that no longer exists.
 */
export const ARRIVAL_RETENTION_CLASS: Record<ArrivalDisposition, RetentionClass> = {
  admitted: 'source_document',
  needs_configuration: 'source_document',
  needs_investigation: 'source_document',
  quarantined: 'source_document',
  superseded: 'source_document',
}

/**
 * MAY THE `documents_processed` METER FIRE FOR THIS ARRIVAL? Exactly one `true`.
 *
 * THE LAW, EXECUTABLE RATHER THAN COMMENTED — `AUTHORIZATION_MAY_BE_ABSENT`'s
 * shape and its stated reason (`model/governance.ts:1198-1203`): a rule left as a
 * paragraph *"is a rule that nothing enforces and every writer interprets for
 * itself."*
 *
 * 🛑 WHY IT MATTERS, AND IT IS INVARIANT 5's OWN GROUND. `METERS`' docblock
 * (`model/billing.ts:71-74`) says *"every meter is something a customer can verify
 * independently, and something we would defend in a dispute."* An arrival that
 * produced no document is not a processed document, in any sense a customer could
 * check. Firing the meter on it makes the meter's NAME false and puts the
 * falsehood into an append-only table that `model/billing.ts:133-138` says has no
 * compensating instrument.
 *
 * ⚠️ WHAT IS STILL METERED, AND THIS IS NOT A LOOPHOLE. `pages_extracted` and
 * `storage_gb_month` are facts about work actually done and stay true of a
 * non-admitted arrival — the artefact was stored, and it may have reached a paid
 * tier before refusing. Adjudication I7 is the reason that matters: the arrival
 * most likely to have cost the most is precisely the one that never became a
 * document. **What invariant 5 requires is that those facts are `UsageRecord`s —
 * unpriced, immutable, tenant-scoped — and that no field on the arrival row says
 * what any of it was worth.** See §6 for the attribution gap this leaves.
 */
export const ARRIVAL_IS_A_PROCESSED_DOCUMENT: Record<ArrivalDisposition, boolean> = {
  admitted: true,
  needs_configuration: false,
  needs_investigation: false,
  quarantined: false,
  superseded: false,
}

/**
 * MAY THIS ARRIVAL BE RE-PROCESSED AUTOMATICALLY, WITHOUT A HUMAN ACT? Exactly one
 * `true`, and this table is the executable form of adjudication I7.
 *
 * *"A malformed PDF that reliably OOMs the cheap Lambda routes deterministically
 * to the expensive tier at the sender's choosing… Cost must never be the
 * escalation trigger for an error."* A retry loop over a refused arrival is that
 * amplifier with a scheduler attached. `needs_configuration` is the only arm a
 * configuration change may re-admit, and it is exactly the arm whose refusals name
 * a missing human decision rather than a hostile or broken artefact.
 *
 * ⚠️ THIS IS ALSO THE QUARANTINE GATE, AND IT IS WHY `quarantined` MUST NOT FOLD
 * INTO `needs_investigation`. A quarantined artefact reaching a managed service is
 * `resolveManagedService()` being asked a question it cannot answer — the config
 * ceiling is compared against a `DataClass` declared per `FieldSpec`
 * (`model/domain.ts:1726`) and a quarantined artefact has no `FieldSpec` at all,
 * which is §7's O-3 unowned. `false` here is what makes that unreachable rather
 * than merely unlikely.
 */
export const ARRIVAL_MAY_BE_REPROCESSED: Record<ArrivalDisposition, boolean> = {
  admitted: false,
  needs_configuration: true,
  needs_investigation: false,
  quarantined: false,
  superseded: false,
}
```

#### (vii) Erasure reach — the honest half

```ts
/**
 * WHERE THE BYTES OF AN ARRIVAL ARE, IN THE ONE VOCABULARY ERASURE UNDERSTANDS.
 *
 * NO TWELFTH `SubjectLocation` VARIANT. Adjudication A3 struck the premise that
 * `blob` was missing; it exists at `model/governance.ts:1784` and was added for
 * *"Object storage. Exported CSVs and page renders were unreachable"*. An arrival's
 * blob is the same class of thing. `tools/check-wire-mirror.mjs:74-75` pins the
 * whole union against the wire, so a new variant is a coordinated model-plus-
 * contract change — and this one buys nothing over `blob`.
 *
 * ⚠️ NO VARIANT NAMES A QUEUE MESSAGE, WHICH IS THE ACTUAL GAP A3 IDENTIFIED, AND
 * THIS DESIGN DOES NOT NEED ONE — C21: the artefact stays in the tenant's own
 * landing bucket with a failure row in Postgres. One erasure story, one residency
 * configuration, RLS-scoped retry state. That is the whole reason the row exists
 * rather than a DLQ.
 *
 * A CONSTRUCTION AND NOT A PARSE. This is only writable because the row carries
 * `storageBucket` and `storageKey` separately — see the note on those fields.
 */
export function arrivalBlobLocation(arrival: IngestArrival): SubjectLocation {
  return { kind: 'blob', bucket: arrival.storageBucket, key: arrival.storageKey }
}

/**
 * WHETHER ERASURE CAN REACH THIS ARRIVAL AT ALL — and for four of the five
 * dispositions the honest answer is NO.
 *
 * 🛑 THIS IS THE DEEPEST THING IN THIS DESIGN AND IT IS A LIMIT, NOT A FEATURE.
 * `SubjectIndexEntry` (`model/governance.ts:1868-1874`) is keyed on `subjectRef`,
 * *"a PER-TENANT HMAC of the natural identifier"*, and the union it indexes is
 * *"Written at CREATION time, not discovered by scanning. A scan cannot find a
 * value inside a stored Explanation, and an erasure design that depends on finding
 * it later will quietly miss it"* (`:1744-1746`).
 *
 * A NON-ADMITTED ARRIVAL HAS NO KNOWN SUBJECT. Nothing read it — G106 forbids
 * reading it — so there is no natural identifier to HMAC, and therefore no
 * `SubjectIndexEntry` can be written for it at creation time. An `ErasurePlan`
 * built from the index cannot name it. Inventing an `UNKNOWN_SUBJECT` sentinel
 * would be fabricating data, and scanning the blob to find subjects is the design
 * that comment refuses AND a G106 violation in one act.
 *
 * WHAT FOLLOWS, AND IT IS TWO THINGS RATHER THAN A SHRUG:
 *
 *   1. THE RETENTION WINDOW IS THE ONLY ERASURE CONTROL THAT REACHES THESE BYTES.
 *      `purgeAfter` is therefore load-bearing in a way it is not on a
 *      `SourceDocument`, where the subject index reaches the row as well.
 *      `purgeVerdict()` (`model/governance.ts:1923`) runs over it unchanged.
 *   2. AN ERASURE PLAN MUST DISCLOSE THIS RATHER THAN REPORT SUCCESS.
 *      `ErasurePlanItem.disposition` already has the arm, and its docblock
 *      (`:1954-1957`) is written for exactly this case: *"`out_of_reach` is
 *      deliberate. An erasure plan that admits what it cannot reach… is worth more
 *      than one that silently misses it and reports success."* The residue is the
 *      sharpest instance of that arm in the model.
 *
 * Total over the disposition, so a sixth member must answer this question too.
 */
export type ArrivalErasureReach =
  /** Admitted: the `SourceDocument` is indexed, and the blob is reached through it. */
  | 'indexed_via_source_document'
  /**
   * Not admitted: the blob is ADDRESSABLE (`arrivalBlobLocation`) and the subject
   * is UNKNOWN. Addressable is not the same as findable, and conflating the two is
   * how an erasure report becomes false.
   */
  | 'addressable_subject_unknown'

export const ARRIVAL_ERASURE_REACH: Record<ArrivalDisposition, ArrivalErasureReach> = {
  admitted: 'indexed_via_source_document',
  needs_configuration: 'addressable_subject_unknown',
  needs_investigation: 'addressable_subject_unknown',
  quarantined: 'addressable_subject_unknown',
  superseded: 'addressable_subject_unknown',
}

/**
 * THE DISPOSITION AN `ErasurePlanItem` MUST CARRY FOR THIS ARRIVAL, given what the
 * plan already knows about holds and minima.
 *
 * A NARROWED RETURN TYPE AND NOT A BOOLEAN (§5.2), and deliberately the EXISTING
 * union member set rather than a parallel one. It returns `out_of_reach` where the
 * subject is unknown, and defers to the caller's own verdict where it is not —
 * because whether an indexed document is purged is `purgeVerdict()`'s answer and
 * not this module's.
 */
export function arrivalErasureDisposition(
  arrival: IngestArrival,
): 'out_of_reach' | 'defer_to_purge_verdict' {
  return ARRIVAL_ERASURE_REACH[arrivalDisposition(arrival.outcome)] ===
    'addressable_subject_unknown'
    ? 'out_of_reach'
    : 'defer_to_purge_verdict'
}
```

#### (viii) Visibility — the register's own figure

```ts
/**
 * THE REGISTER'S THIRD FIGURE, COMPUTED. THIS IS HOW THE RESIDUE BECOMES VISIBLE
 * IN THE SAME LIST, AND IT IS NOT BAND D.
 *
 * 🛑 BAND D IS PER-DOCUMENT EXTRACTION CONFIDENCE AND THIS IS NOT THAT.
 * `Mockups/rec/Close.dc.html:203` draws band D as *"Could not read · 3 dockets"*
 * carrying an AMOUNT of `11,420.00`, a status of *"Below the 90% floor"* and an
 * action of *"You classify"*, inside a register headed *"Three-way match · run
 * 09 Mar 03:12 · v4"* (`:82`). So the dockets were READ, at a confidence, against
 * `FieldSpec.confidenceFloor` (G38, `model/domain.ts:1764`), inside a RUN. A
 * never-routed artefact has no amount, no confidence, no field and no run. Putting
 * it in band D would make one band mean two things, which is §5.3.
 *
 * ✅ WHAT IT IS INSTEAD. `Close.dc.html:196` draws
 * `{ label: 'Coverage', value: '99.2%' }` beside `Matched` and `In variance`, and
 * **nothing in `model/` can compute it**, because coverage needs a denominator and
 * the denominator is arrivals. `ReconciliationRun.inputs`
 * (`model/domain.ts:2718`) names only what made it through. So the arrival ledger
 * is not a new surface asking for a new band — it is the missing input to a figure
 * already drawn on the same screen. `Close.dc.html:230`'s claim, which G38 exists
 * to keep, is *"Capture never becomes a second inbox to remember"*; a file that
 * vanished between EventBridge rules is a second inbox with no door, and the door
 * is this figure.
 *
 * 🛑 IT RETURNS COUNTS AND NEVER A RATIO, AND `no_arrivals` IS A REAL ARM. A
 * percentage over an empty period is a division by zero, and the two plausible
 * fixes are both fabrications: `NaN` on a screen, or `100%` asserted about a
 * period in which nothing was checked. `PRODUCT.md` forbids presenting in-product
 * figures as results, and `99.2%` on the mockup is illustrative data. The caller
 * chooses the denominator explicitly — and MUST, because `superseded` belongs in
 * *"how many arrived"* and not in *"what is short"*.
 *
 * `byDisposition` is a total `Record`, CONSTRUCTED HERE — so a sixth disposition
 * is a compile error at this fold and §5.10 does not apply to it. That is the
 * difference between this table and `RetentionPolicy.days`, which had no
 * construction site for a month.
 */
export type ArrivalCoverage =
  | { readonly kind: 'no_arrivals' }
  | {
      readonly kind: 'counted'
      readonly byDisposition: Record<ArrivalDisposition, number>
    }

/**
 * Pure, total, no clock. Counts by disposition over the arrivals the caller
 * selected — this function does not know what a period is and must not.
 */
export function arrivalCoverage(
  arrivals: readonly IngestArrival[],
): ArrivalCoverage {
  if (arrivals.length === 0) return { kind: 'no_arrivals' }
  const byDisposition: Record<ArrivalDisposition, number> = {
    admitted: 0,
    needs_configuration: 0,
    needs_investigation: 0,
    quarantined: 0,
    superseded: 0,
  }
  for (const arrival of arrivals) {
    const disposition = arrivalDisposition(arrival.outcome)
    byDisposition[disposition] += 1
  }
  return { kind: 'counted', byDisposition }
}
```

### 2.4 Retention — how `RetentionPolicy`'s totality over 13 is satisfied

It is satisfied **by not touching it.** `ARRIVAL_RETENTION_CLASS` answers `source_document` for all
five dispositions, so:

- `RetentionPolicy.days: Record<RetentionClass, number>` (`model/domain.ts:1179`) stays total over
  thirteen; `_RetentionPolicyAnswersEveryClass` (`:1201`) and
  `_RetentionKindTableAnswersEveryClass` (`:1204`) are unchanged.
- `PLACEHOLDER_RETENTION_POLICY` (`model/examples.ts:534`) keeps compiling — no fourteenth key.
- `RETENTION_RECORD_KIND.source_document = 'content'` (`model/domain.ts:1136`) and
  `AUDIT_MUST_OUTLIVE.content = true` (`:1167`) already mean the audit window must outlive it, and
  `retentionWindowValid()` (`:1260`) already checks that. **No new validation.**
- `tools/check-wire-mirror.mjs:99-100` keeps its `retention_classes` pair mirrored with no contract
  edit.
- The counsel question — `docs/HANDOFF.md` §8 item 2's thirteen unanswered windows — **does not become
  fourteen.**

The decisive argument is the two-clocks one on the declaration: an admitted arrival's bytes are the
document's blob, so a different window would give one artefact two purge dates depending on whether
a parse succeeded. The cost — a quarantined artefact kept as long as a good invoice — is stated on
the table and raised as **O-10**.

### 2.5 `SubjectLocation`, erasure, and PDPA access

**Does it register a `SubjectLocation`?** Yes, and **no new variant** — the existing
`{ kind: 'blob'; bucket; key }` (`model/governance.ts:1784`), constructed by
`arrivalBlobLocation()`. A3 is right that the union already has eleven variants and that none names a
queue message; C21 removes the need for one by keeping the artefact in the tenant's own bucket with a
row in Postgres.

**And here is the part that is a limit rather than a design.** `SubjectIndexEntry` needs a
`subjectRef` — a per-tenant HMAC of a natural identifier — written **at creation time**
(`model/governance.ts:1744-1746`, `:1870`). A non-admitted arrival was read by nothing, and G106
forbids reading it. **So there is no subject to index, and an `ErasurePlan` built from the index
cannot name the artefact.** Two consequences, both executable above:

1. `purgeAfter` is the **only** erasure control that reaches those bytes, which makes O-10 a real
   question rather than a tidy one.
2. `arrivalErasureDisposition()` returns `out_of_reach`, the arm
   `model/governance.ts:1954-1957` exists for. A plan that reported `purge` here would be reporting
   success about bytes it cannot find a subject in.

**The PDPA access story is the same shape and worse, and it should be said out loud.** A data-subject
*access* request cannot be answered over a non-admitted arrival either — not because the bytes are
gone, but because finding the subject in them requires reading them, and G106 says they are
unreadable. **The honest answer to a subject access request is that the artefact is disclosed as an
unreadable arrival with its `arrivedAt`, `filename` and disposition, and its content is not
searched.** That is a product statement, not an engineering one, and it is **O-12** in §7.

### 2.6 Metering, and what invariant 5 requires

**Is an arrival that never became a `SourceDocument` metered? Yes — and it is the arrival most likely
to have cost the most** (adjudication I7: the malformed artefact that OOMs the cheap stage routes to
the expensive one at the sender's choosing).

**What invariant 5 requires, in three parts:**

1. **No money on the row.** No `billedAt`, no `chargedMinor`, no `cost`. The header control
   `code | grep -c '\.cost\|amountMinor\|Money' → 0` makes it mechanical. The brief's phrase *"was
   billed"* must not become a field: money is derived, `UsageRecord` is immutable and unpriced, and a
   derived figure on a content row makes a pricing change rewrite history.
2. **`documents_processed` must not fire.** `ARRIVAL_IS_A_PROCESSED_DOCUMENT` is the executable form,
   in `AUTHORIZATION_MAY_BE_ABSENT`'s shape. The ground is `METERS`' own docblock
   (`model/billing.ts:71-74`): every meter must be independently verifiable by the customer, and an
   arrival that produced no document is not a processed document in any sense a customer could check.
3. **No new meter.** `pages_extracted` and `storage_gb_month` already carry the true facts, and
   `tools/check-wire-mirror.mjs:94-95` pins `METERS` against the wire — so a ninth meter is a
   coordinated model-plus-contract change that buys nothing here.

**The gap this leaves, stated rather than closed:** `UsageRecord`'s attribution fields are
`authorizationId`, `runId`, `domain`, `packId`, `costCenter`, `model` (`model/billing.ts:223-238`).
**None of them can name an arrival.** So a paid-tier call spent on an artefact that never became a
document is attributable to the tenant and to nothing inside it, and *"which arrivals did we spend
the Textract bill on"* is unanswerable. The fix is one nullable field —
`arrivalId: IngestArrivalId | null` — and it is **O-11**, not mine, because `UsageRecord` is the one
record class that crosses the plane boundary. The precedent is favourable and should be put in front
of the owner with it: `runId` is already an opaque data-plane scalar the control plane holds and
cannot resolve, which is the argument `authorizationId` makes for itself at
`model/billing.ts:198-211`. The precondition is the one on `IngestArrivalId` in §2.2 — **the slug
must be opaque**, because a slug minted from a filename would ship counterparty text upward and break
invariant 3.

### 2.7 Why it is one list and not a second inbox — and what still blocks the screen

Three claims, separated by how well each is supported:

**Supported by the model.** The residue is queryable in the same table as every admitted arrival,
scoped by RLS on `tenant_id`, narrowable by the same `AssignmentScope` dimensions as an exception
(`costCentre`, `legalEntity`, `solutionId`), auditable through `AuditEvent`/`DataAccessEvent` with no
new machinery, and it computes the register's own `Coverage` figure through `arrivalCoverage()`.

**Supported, with a named limit.** An arrival can be attributed to a `SolutionId` through
`Solution.endpointIds` (`model/domain.ts:2624`) — which matters, because `AssignmentScope.solutionIds`
exists and invariant 11 permits narrowing **to** a solution. It **cannot** be attributed to a
`ReconciliationDefinition` or a `ReconciliationRun`: `Solution` holds `endpointIds`,
`definitionIds` and `documentTypeIds` as three flat arrays (`:2624`, `:2647-2648`) with **no join
between them**, and `SourceSlot` (`:1872-1884`) keys on `documentTypeId`, never on an endpoint. So
the residue can sit beside the run register at **solution grain** and cannot be placed **inside** a
specific run's band list.

**Not supported, and it is an owner ruling.** Where it renders. A sixth band letter under a run that
does not exist is not available; the register's `Coverage` figure is; a solution-grain band is a
screen nobody drew. `presentation.ts` is `@dropped-for-v1` whole, so **no presentation type should be
minted for this** — which is why nothing above declares one. **O-9** in §7.

### 2.8 Migration 0002 — the table, in 0001's idiom

```sql
-- 0002 — THE ARRIVAL LEDGER.
-- G88 forward-only: 0001 is never edited. G97 ids are text, verbatim.
-- G100 the policy DENIES on NULL. The composite PK is (tenant_id, id) for the
-- reason 0001:88-93 gives — a cross-tenant reference is unrepresentable rather
-- than merely unlikely.

CREATE TABLE ingest_arrival (
  tenant_id          text        NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  id                 text        NOT NULL,
  endpoint_id        text,
  solution_id        text,
  content_sha256     text        NOT NULL,
  object_bytes       bigint      NOT NULL,
  filename           text        NOT NULL,
  declared_kind      text        NOT NULL,
  sniffed_kind       text        NOT NULL,
  storage_bucket     text        NOT NULL,
  storage_key        text        NOT NULL,
  arrived_at         timestamptz NOT NULL,
  sanitised_at       timestamptz NOT NULL,
  outcome_kind       text        NOT NULL,   -- 'admitted' | 'refused'
  source_document_id text,                   -- non-null iff outcome_kind='admitted'
  refusal            jsonb,                  -- non-null iff outcome_kind='refused'
  refusal_kind       text,                   -- the discriminant, lifted for indexing
  disposition        text        NOT NULL,   -- written from arrivalDisposition(), never by hand
  document_type_id   text,
  synthetic          boolean     NOT NULL,
  cost_centre        text,
  legal_entity       text,
  purge_after        timestamptz NOT NULL,
  purged_at          timestamptz,

  PRIMARY KEY (tenant_id, id),

  -- The outcome union, as a constraint. Without it the two arms are one nullable
  -- pair and every reader decides for itself which shape it holds — the erosion
  -- G44 refuses at `model/domain.ts:3491-3502`.
  CONSTRAINT ingest_arrival_outcome CHECK (
    (outcome_kind = 'admitted' AND source_document_id IS NOT NULL AND refusal IS NULL)
    OR
    (outcome_kind = 'refused'  AND source_document_id IS NULL AND refusal IS NOT NULL
                                AND refusal_kind IS NOT NULL)
  ),
  -- endpoint_id is null on exactly one refusal arm and on no other.
  CONSTRAINT ingest_arrival_endpoint CHECK (
    endpoint_id IS NOT NULL OR refusal_kind = 'no_endpoint_resolved'
  )
);

-- R5(ii), FILE GRAIN. Content hash, not the S3 key and not a message id.
--
-- ⚠️ `NULLS NOT DISTINCT` IS LOAD-BEARING AND IT IS A VERSION DEPENDENCY.
-- endpoint_id is nullable, and a plain UNIQUE index treats NULLs as distinct — so
-- the same file dropped twice into an UNREGISTERED folder would mint two rows and
-- the dedup key would silently not apply to the one case where a person is least
-- likely to notice. `NULLS NOT DISTINCT` requires PostgreSQL 15+. NOTHING IN THIS
-- REPOSITORY RECORDS A POSTGRES VERSION — verified — so this is a stated
-- prerequisite, not an assumption. The alternative that works everywhere is a
-- unique index over `coalesce(endpoint_id, '')`, which reintroduces the empty
-- string as a sentinel and is the shape 0001:150-158 argues against.
CREATE UNIQUE INDEX ingest_arrival_content_key
  ON ingest_arrival (tenant_id, endpoint_id, content_sha256) NULLS NOT DISTINCT;

-- The register query: one tenant, one solution, ordered, filtered by disposition.
CREATE INDEX ingest_arrival_register
  ON ingest_arrival (tenant_id, solution_id, arrived_at DESC, disposition);

ALTER TABLE ingest_arrival ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_arrival FORCE  ROW LEVEL SECURITY;

CREATE POLICY ingest_arrival_rls ON ingest_arrival
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON ingest_arrival TO reconcile_app;
```

---

## 3. What each declaration REFUSES, and what fails closed

| Declaration | It refuses | Fails closed because |
|---|---|---|
| `SniffedContentKind` with `unrecognised` as a **member** and no null | An unknown format silently taking a default routing branch | `unrecognised` has to be routed explicitly. A nullable field would be read as "unspecified" and take the permissive branch at the first call site written in a hurry — §5.5's shape, stated on `IdentifierNormalisation` at `model/reconciliation.ts:369-372` |
| `INGEST_BOUND_KEYS` with **no number anywhere** | A silently unbounded parse | O-8 unstated ⇒ `IngestBound` cannot be constructed ⇒ every arrival refuses. *"A bound with no number is not a bound"* |
| `ArrivalRefusal` + `_ArrivalRefusalHoldsNoTextDeep` | A parser message, a PDF `Producer`, an XLSX sheet name, a header cell, a MIME string — reaching a log, an `AuditEvent` or a screen | The type does not admit a `string` field. Invariant 6, proven at compile time rather than reviewed |
| `ArrivalOutcome` — `sourceDocumentId` **absent** from the refused arm | A refused arrival claiming a document | `TS2339` at the first read. G44's technique, `model/domain.ts:3491-3502` |
| `ARRIVAL_DISPOSITION_FOR`, total over 14 refusal kinds | A fifteenth refusal with no decided retention, meter or retry answer | `TS2741` at the const. Then the same for the three tables keyed on disposition |
| `arrivalDisposition()` as the **only** answer, disposition not a row field | Two copies of one fact drifting | There is nowhere else to write it. §5.3 at the smallest scale |
| `ARRIVAL_RETENTION_CLASS` typed `RetentionClass` | A local retention vocabulary; a fourteenth window nobody can answer; two purge dates on one artefact | A rename of a class is a compile error here; a fourteenth class is four simultaneous failures |
| `ARRIVAL_IS_A_PROCESSED_DOCUMENT` | `documents_processed` firing on an artefact that produced no document | The metering writer reads the table instead of deciding per call site. Invariant 5's verifiability ground |
| `ARRIVAL_MAY_BE_REPROCESSED` | A retry loop feeding a malformed artefact back into a paid tier at the sender's choosing; a quarantined artefact reaching `resolveManagedService()` | One `true`, and it is the arm whose refusals name a missing human decision. I7 made executable |
| `ARRIVAL_ERASURE_REACH` + `arrivalErasureDisposition()` | An erasure plan reporting `purge` over bytes whose subject is unknown | `out_of_reach` is returned, not a boolean. The arm `model/governance.ts:1954-1957` exists for |
| `arrivalBlobLocation()` | Parsing an opaque storage address to build a `SubjectLocation` | Two fields on the row make it a construction. And it exposes the same defect on `SourceDocument.storageRef` |
| `ArrivalCoverage` with a `no_arrivals` arm and **no ratio** | `100%` coverage asserted over a period in which nothing was checked; `NaN` on a screen; a hidden denominator choice | The empty case is a different arm, and the caller must pick a denominator explicitly |
| `endpointId`/`solutionId`/`costCentre`/`legalEntity` nullable, with the `these` rule copied verbatim | A null being read as "unscoped" and matching every assignment | SQL drops the row; the rule is written at the field so a hand-built matcher cannot quietly reverse it |
| `IngestArrivalId`'s opaque-slug rule | A filename in a primary key, a log line, and whatever crosses the plane boundary | Stated at the declaration, where the next person mints one. Invariant 3 |
| The module header's G106 banner | *"let me just look at what came in"* | The bytes of a non-admitted arrival have no `FieldSpec`, so nothing may read them |
| `migration 0002`'s two `CHECK`s and the RLS policy | A row representing both arms at once; a cross-tenant read | The check rejects the insert; the policy denies on NULL, so a forgotten transaction returns zero rows |

**What deliberately does NOT fail closed, said out loud:** an arrival whose **tenant** cannot be
resolved from the prefix has **no row anywhere**, because `IngestArrival extends TenantScoped` and
inventing a tenant is worse than the gap. Under invariant 3 the control plane cannot hold it either
— the bytes are tenant data. So the object is refused at the boundary, the artefact stays where it
landed, and the only signal is operational. **That is invariant 1 doing its job, and it is the one
case this design cannot cover.** It is the argument for R5(iv)'s checker — *no queue payload schema
declares a tenant field* — because the alternative anyone will reach for is putting the tenant on the
message.

---

## 4. The fixtures, and why `tsc` alone would tell nobody anything

**§5.10 applies to `IngestArrival` and to nothing else in this design.** The three
`Record<ArrivalDisposition, …>` tables and `ARRIVAL_DISPOSITION_FOR` are **const object literals in
the module where they are declared**, so each is its own construction site and totality bites the day
it lands. `arrivalCoverage()` constructs a fourth. **`IngestArrival` is an interface nothing
constructs** — exactly `SubjectLocation`'s position on 8 Aug, when the `bi_dataset` variant carried a
`region` the `RegionKey` union did not admit and `tsc` was green through the whole thing
(`model/examples.ts:1141-1161`). *"A type added in the same commit as its fixture cannot have this
defect, and a type added without one is unverified no matter how green the run is."*

**Insertion point:** `model/examples.ts`, new section **7**, after `notifiedDeliveryGrant` (the file
ends at `:1247`).

```ts
/* ---------------- 7. IngestArrival — the residue, as values ---------------- */

/**
 * THREE ARRIVALS FROM ONE FOLDER, AND THE THIRD IS THE ONE THIS OBJECT EXISTS FOR.
 *
 * Grounded in the drawn product rather than invented: `Reconciliations.dc.html:216`
 * describes the goods-receipt source as *"Warehouse dockets · handwritten, scanned
 * to SharePoint, read at 94% mean confidence"*, and `Close.dc.html:203` shows band
 * D as *"Could not read · 3 dockets … handwritten, warehouse 118"*. Every value
 * below is illustrative; no number here is a product position.
 *
 * WHY THREE AND NOT ONE. A fixture of only the failing arm cannot distinguish "the
 * type works" from "the type only expresses failure" — the argument
 * `permittedManagedServiceUse` makes for itself (`model/examples.ts:862-866`). One
 * admitted, one awaiting a human act, one quarantined: three dispositions out of
 * five, and the two absent ones are covered by the coverage test below.
 *
 * ⚠️ WHAT THESE WITNESS. That a value satisfying `IngestArrival` exists; that the
 * admitted arm requires a `SourceDocumentId` and the refused arm cannot carry one;
 * that `endpointId`, `solutionId`, `costCentre` and `legalEntity` have real NULL
 * arms; and that `arrivalDisposition()` returns three different answers over them.
 * ⚠️ WHAT THEY DO NOT WITNESS. Any behaviour of a pipeline that does not exist,
 * and no bound, floor or window — those are O-8's and O-10's.
 */
export const warehouse118Arrivals: IngestArrival[] = [
  {
    tenantId: 'ten_acme' as TenantId,
    id: 'arr_01j9f2q7' as IngestArrivalId,          // opaque, per kernel.ts
    endpointId: 'ep_sharepoint_gr' as EndpointId,
    solutionId: 'sol_fin_3way' as SolutionId,
    contentSha256: '3b1f…'.padEnd(64, '0'),
    objectBytes: 184_320,
    filename: 'GR-118-20260309-0041.pdf',           // ⚠️ counterparty-controlled
    declaredKind: 'portable_document',
    sniffedKind: 'portable_document',
    storageBucket: 'acme-landing-ap-southeast-1',
    storageKey: 'ten_acme/ep_sharepoint_gr/2026/03/09/GR-118-20260309-0041.pdf',
    arrivedAt: '2026-03-09T02:41:00Z',
    sanitisedAt: '2026-03-09T02:41:02Z',
    /* THE ADMITTED ARM. Deleting `sourceDocumentId` here is a compile error, which
     * is the join that makes the ledger a ledger. */
    outcome: { kind: 'admitted', sourceDocumentId: 'doc_gr_0041' as SourceDocumentId },
    documentTypeId: 'dt_goods_receipt' as DocumentTypeId,
    costCentre: 'CC-1100',
    legalEntity: 'ACME-SG',
    synthetic: false,
    purgeAfter: '2027-03-09T02:41:00Z',   // days.source_document, at arrival
    purgedAt: null,
  },
  {
    tenantId: 'ten_acme' as TenantId,
    id: 'arr_01j9f2q8' as IngestArrivalId,
    endpointId: 'ep_sharepoint_gr' as EndpointId,
    solutionId: 'sol_fin_3way' as SolutionId,
    contentSha256: '9c04…'.padEnd(64, '0'),
    objectBytes: 12_004,
    filename: 'supplier_lines_march.csv',
    declaredKind: 'delimited_text',
    sniffedKind: 'delimited_text',
    storageBucket: 'acme-landing-ap-southeast-1',
    storageKey: 'ten_acme/ep_sharepoint_gr/2026/03/09/supplier_lines_march.csv',
    arrivedAt: '2026-03-09T02:44:00Z',
    sanitisedAt: '2026-03-09T02:44:01Z',
    /* THE MOST COMMON RESIDUE AT ONBOARDING, AND IT IS NOT A FAILURE. `tabular` is
     * *"CSV or spreadsheet against a known column mapping"* and none is promoted.
     * `arrivalDisposition()` → 'needs_configuration' → the one disposition
     * `ARRIVAL_MAY_BE_REPROCESSED` admits. */
    outcome: { kind: 'refused', refusal: { kind: 'no_promoted_mapping' } },
    documentTypeId: 'dt_supplier_lines' as DocumentTypeId,
    /* NULL IS A REAL ARM, and the reason is on the field: `Endpoint` carries no tag
     * fields, so a non-admitted arrival has nowhere to get these from. A tenant
     * that scopes every assignment by cost centre does not see this row. */
    costCentre: null,
    legalEntity: null,
    synthetic: false,
    purgeAfter: '2027-03-09T02:44:00Z',
    purgedAt: null,
  },
  {
    tenantId: 'ten_acme' as TenantId,
    id: 'arr_01j9f2q9' as IngestArrivalId,
    /* NULL — the file landed in the tenant's prefix and matched no registered
     * endpoint. The one refusal arm on which this field may be null, and the
     * arrival that has no owner (§6). */
    endpointId: null,
    solutionId: null,
    contentSha256: 'f7a2…'.padEnd(64, '0'),
    objectBytes: 2_048_576,
    /* ⚠️ THE POINT OF THIS ROW. The extension says spreadsheet and the bytes are a
     * PDF. Under the adjudication, disagreement QUARANTINES — and the refusal
     * carries both KINDS and neither STRING. */
    filename: 'march_totals.xlsx',
    declaredKind: 'spreadsheet',
    sniffedKind: 'portable_document',
    storageBucket: 'acme-landing-ap-southeast-1',
    storageKey: 'ten_acme/_unrouted/2026/03/09/march_totals.xlsx',
    arrivedAt: '2026-03-09T03:02:00Z',
    sanitisedAt: '2026-03-09T03:02:04Z',
    outcome: {
      kind: 'refused',
      refusal: {
        kind: 'declared_kind_disagrees_with_content',
        declared: 'spreadsheet',
        sniffed: 'portable_document',
      },
    },
    documentTypeId: null,
    costCentre: null,
    legalEntity: null,
    synthetic: false,
    purgeAfter: '2027-03-09T03:02:00Z',
    purgedAt: null,
  },
]
```

**Test file: `tests/model/ingest-arrival.test.ts` (new).** Every expected value a literal typed into
the file, per `tests/model/managed-service.test.ts:33-36` — *"comparing a constant to itself passes
forever and witnesses nothing."*

```
test_an_admitted_arrival_reports_the_admitted_disposition
test_an_arrival_awaiting_a_promoted_mapping_reports_needs_configuration
test_a_declared_kind_disagreeing_with_content_is_quarantined
test_a_duplicate_arrival_is_superseded_and_not_an_error
test_every_refusal_kind_has_a_disposition          // Object.keys over the union's members
test_only_an_admitted_arrival_may_fire_documents_processed
test_only_needs_configuration_may_be_reprocessed
test_a_quarantined_arrival_may_never_be_reprocessed
test_every_disposition_retains_under_the_source_document_window
test_erasure_reach_is_addressable_subject_unknown_for_every_non_admitted_arrival
test_an_erasure_plan_over_a_quarantined_arrival_is_out_of_reach
test_the_blob_location_is_constructed_from_two_fields_and_never_parsed
test_coverage_over_no_arrivals_is_not_a_percentage
test_coverage_counts_every_disposition_including_superseded
test_the_module_declares_no_regexp_and_no_throw    // source-text control, comments stripped
```

Plus **one line moved**: `MODULE_COUNT = 18` → `19` in
`tests/model/runtime-importability.test.ts:44`, which puts the new module into the loadability sweep.

---

## 5. The mutations that prove each control bites

Each was run in **isolation**, and a run counts only if the control's error is the **only** error — a
`TS6133`/`TS6196` alongside means `noUnusedLocals` produced the red, which is the trap
`model/identity.ts:488-496` records slice 5 falling into.

| | Mutation | Expected failure |
|---|---|---|
| **M1** | Delete `id` from `IngestArrival` | `TS2344` at `_EntitiesCarryTheirOwnIdentity` — `Property 'id' is missing in type 'IngestArrival' but required in type '{ id: Id<"IngestArrival">; }'`. **The missing-field case.** |
| **M2** | Re-declare `IngestArrivalId = Id<'IngestArrivalRow'>` in `kernel.ts` | **TWO** reds and neither is in the file edited: `Type '"IngestArrivalRow"' is not assignable to type '"IngestArrival"'` at `_BrandArgumentsNameTheirEntities` **and** at `_EntitiesCarryTheirOwnIdentity`. The wrong-brand case — the one `tsc` cannot see without these maps, and the class that left 18 of 172 edges pointing at nothing |
| **M3** | Add a fifteenth `ArrivalRefusal` arm, no table entry | `TS2741` at `ARRIVAL_DISPOSITION_FOR` — the new key missing from `Record<ArrivalRefusal['kind'], ArrivalDisposition>`. **A refusal cannot exist without a decided retention, meter and retry answer** |
| **M4** | Add `readonly parserMessage: string` to the `sanitiser_did_not_complete` arm | `TS2344` at `_ArrivalRefusalHoldsNoTextDeep`. ⚠️ **Run this one FIRST, before trusting the proof green** — C10's discipline. A proof that has never failed is indistinguishable from an unsatisfiable one |
| **M4b** | Replace `declared: SniffedContentKind` with `declared: string` | Same `TS2344`. This is the realistic version of M4: the engineer who reaches for a MIME string rather than for a message |
| **M5** | Flip `ARRIVAL_IS_A_PROCESSED_DOCUMENT.quarantined` to `true` | `test_only_an_admitted_arrival_may_fire_documents_processed` red, **alone**. Nothing else moves — which is the proof that this table and not a review convention is what stops the meter lying |
| **M6** | Flip `ARRIVAL_MAY_BE_REPROCESSED.quarantined` to `true` | Two red: `test_only_needs_configuration_may_be_reprocessed` and `test_a_quarantined_arrival_may_never_be_reprocessed`. Two tests deliberately, because this is I7's cost amplifier and the second names the property rather than the table |
| **M7** | Change `ARRIVAL_RETENTION_CLASS.quarantined` to `'ingest_quarantine'` | `TS2322` — *not assignable to type `RetentionClass`*. **The reason the table is typed `RetentionClass` and not a local union** (`model/learning.ts:1857-1860`) |
| **M8** | Add a fourteenth member to `RETENTION_CLASSES` | **FOUR** simultaneous reds: `RETENTION_RECORD_KIND` (`model/domain.ts:1135`), `PLACEHOLDER_RETENTION_POLICY` (`model/examples.ts:534`), `ARRIVAL_RETENTION_CLASS` is unaffected — ⚠️ **correction: three reds, and the third is `check:wire` failing on the `retention_classes` pair, not a `tsc` error.** Recorded this way because a mutation report that overstates its own reds is §5.6 |
| **M9** | Delete `sourceDocumentId` from the `admitted` arm | `TS2353` at the first fixture and `TS2339` in the test. **The arrival→document join is what makes the ledger a ledger** |
| **M10** | Make the refused arm `{ kind: 'refused'; sourceDocumentId: SourceDocumentId \| null; refusal }` | `test_an_admitted_arrival_reports_the_admitted_disposition` stays **green** — ⚠️ **so `tsc` alone does NOT catch this and the migration's `CHECK` is what does.** The `CHECK ingest_arrival_outcome` insert is rejected. **Recorded because it is the mutation this design is weakest against at the type level**, and the honest answer is that the constraint lives in the database |
| **M11** | Remove `NULLS NOT DISTINCT` from `ingest_arrival_content_key` | A DB test inserting the same `content_sha256` twice with `endpoint_id IS NULL` succeeds where it must conflict. **R5(ii) silently not applying to exactly the case a person is least likely to notice** |
| **M12** | Drop the `ingest_arrival_rls` policy | The two-tenant leak test's pattern extended to this table: the read LEAKS. Which is the proof that isolation comes from the policy and not from the query — `tests/db/tenant-isolation.test.ts:16-18` |
| **M13** | Omit `SET LOCAL` (call outside `withTenantScope()`) | **Zero rows**, not another tenant's — G100's deny-on-NULL, `db/migrations/0001…:150-165` |
| **M14** | `costCentre: string` (non-nullable) | The second and third fixtures fail to compile. **Proves null is a real arm and not an omission** — and the failure names the exact rows that have no source-side tag to inherit |
| **M15** | Give `arrivalCoverage()` a `ratio: number` field and delete the `no_arrivals` arm | `test_coverage_over_no_arrivals_is_not_a_percentage` red. Under the mutant an empty period reports `NaN` or a fabricated `100%` — a figure `PRODUCT.md` forbids |
| **M16** | Add a sixth `ARRIVAL_DISPOSITIONS` member | **FIVE** reds: the three tables, `ARRIVAL_ERASURE_REACH`, and the `byDisposition` literal inside `arrivalCoverage()`. The last is the one that matters: the fold has a construction site, so §5.10 does not apply to it |
| **M17** | Write a value import in `model/ingestion.ts` without `.ts` | `tsc` **green**; `test_every_model_module_on_disk_loads_under_node_without_a_module_resolution_error` red with `ERR_MODULE_NOT_FOUND`. The class that stopped three modules loading on 8 Aug while `tsc` was green |
| **M18** | Revert `MODULE_COUNT` to 18 | `tests/model/runtime-importability.test.ts` red. Proves the new module is actually swept |
| **M19** | Add `chargedMinor: bigint` to `IngestArrival` | **Nothing goes red** — ⚠️ **and that is recorded rather than tidied away.** The header control `code \| grep -c '\.cost\|amountMinor\|Money' → 0` catches it, and that control is **honour-system**: no linter is configured, exactly as `model/reconciliation.ts:70-72` says of its own. Say "honour-system", never "enforced". **Turning it into a checker under `npm run check` (G108) is the fix, and it is not this design's** |

---

## 6. What I did NOT solve, and what it is blocked on

1. **The un-attributable arrival has no home, and this is structural.** `IngestArrival extends
   TenantScoped`, so an object whose tenant cannot be resolved from the prefix cannot be a row.
   Invariant 3 forbids the control plane holding it. So the artefact stays where it landed with only
   an operational signal. **Blocked on nothing — it is invariant 1 working**, and it is the reason
   R5(iv)'s checker (*no queue payload schema declares a tenant field*) should be written.
2. **`no_endpoint_resolved` produces an arrival with no owner.** `endpointId` and `solutionId` are
   both null, so no `AssignmentScope` narrowing reaches it and no solution-grain register can show
   it. It is visible only to an unnarrowed assignment. **Blocked on O-9** (where the residue renders)
   and on the absence of any tenant-wide "unrouted" surface.
3. **Nothing joins an `Endpoint` to a `ReconciliationDefinition`.** Verified: `Solution` holds
   `endpointIds`, `definitionIds` and `documentTypeIds` as three flat arrays with no join
   (`model/domain.ts:2624`, `:2647-2648`), and `SourceSlot` keys on `documentTypeId` (`:1872-1884`).
   So the residue cannot be placed inside a specific run's band list — only at solution grain.
   **Not solved. A join is a `domain.ts` change with its own plan.**
4. **Per-arrival cost attribution is unavailable.** `UsageRecord` has no field that can name an
   arrival. **Blocked on O-11.**
5. **The PDPA *access* answer over a non-admitted arrival is a product statement I did not take.**
   **Blocked on O-12.**
6. **The `refused`→`admitted` transition rule is a schema obligation, not a type one.** The type
   admits any transition; the `CHECK` in 0002 does not express the direction either, because it has
   no access to the previous row. A trigger or an append-only outcome table would; **I did not design
   one**, and M10 is the mutation that shows the type layer is weakest here.
7. **`SourceDocument.storageRef` is still unsplittable into a `blob` location.** The fix is the same
   two fields; it is a `domain.ts` change and a separate commit. **Reported (§0b), not applied.**
8. **`arrivalCoverage()` has no notion of a period.** It counts what it is given. Which arrivals
   belong to a close is `ReconciliationPeriod.cutOffAt` (`model/domain.ts:2694`) applied by the
   caller, and **A2 is unresolved one layer up** — the document array handed to
   `runSetReconciliation` is ordered by nothing stated. **Not mine, and it is the same defect.**
9. **`RulePredicate.unique_within` still has no evaluator** (`model/domain.ts:367`, verified). My
   `duplicate_of_earlier_arrival` closes the **file** grain only. C17's row grain is untouched, and
   the `Map.set` overwrite in the engine is still the dedup mechanism there.
10. **No contract operation, and therefore no `check:wire` coverage.** `tools/planner/extract.mjs`
    will report `IngestArrival` under `types_without_operations`. That gap is correct as reported and
    closes when the surface exists — which, per §0a of `docs/HANDOFF.md`, waits on **D1**, session
    establishment.

---

## 7. What this depends on, and which owner rulings it needs

**G rulings this design depends on, by name**

| | Where it bites |
|---|---|
| **G35** | The id at all — a machine-produced timed record gets one by default |
| **G38** | The sentence being extended: *"unreadable dockets sit in the same list as everything else, so capture never becomes a second inbox"* |
| **G44** | The technique that makes `admitted` and `refused` structurally distinct — a field ABSENT, not nullable |
| **G88** | The table is migration 0002; 0001 is never edited |
| **G97** | Ids are `text`, verbatim — plus the opaque-slug rule this design adds on top |
| **G99 / G100 / G101** | Every insert inside `withTenantScope()`; deny-on-NULL; transaction-mode from day one |
| **G102** | Required-and-nullable, **never** `field?:` — the `TS2741` at each construction site is the only evidence a field landed |
| **G104** | No model identifier in this module; grep is 0 |
| **G105** | *A match and a judgement must not be recorded as the same kind of event*, one layer earlier: which rung refused is on the row |
| **G106** | The module's own banner. A non-admitted arrival has no `FieldSpec` for any key, so its bytes are unreadable by anything |
| **G107** | Data-plane code; nothing here ships upward |
| **G108** | Every new checker joins `npm run check`; the module-count STALE lines are part of the landing commit |
| **G110** | The `DocumentType` candidate set arrives in a pack, and the publication seam does not exist — adjudication §8 item 2, and it is upstream of `document_type_ambiguous` |
| **G111** | Why no `Money` appears here at all |
| **G113** | *A bare field with no argument at the point of use is REMOVED, not documented* — the precedent for refusing a tenant on a queue message |
| **G118** | Label the gap. `tier_refused` deliberately lacks C5's detail rather than stubbing it |
| **G120** | Containment: the privileged side supplies the vocabulary. `SniffedContentKind` is ours, closed, and decided from bytes we measured |
| **G125 / G126** | `promoted_mapping_header_set_drift` is *enumerated, never widened* applied to ingestion |
| **G129** | The gate-before-execution shape, and the lesson that a control over zero call sites is not a control |
| **G130 / G131** | No pattern is compiled; provenance is required. The header control `grep -c 'new RegExp' → 0` |

**Invariants** — 1 (tenant derived from the session; the un-attributable object gets no row), 3 (the
arrival never ships upward; the id must be opaque if any scalar ever does), 4 (classification is
declared once on `FieldSpec` — an arrival has none, which is G106 at its widest), 5 (money is always
derived; no cost field, and `documents_processed` must not lie), 6 (ingested content is data, never
instruction; the refusal union is text-free by proof), 10 (reading an arrival is a `DataAccessEvent`
carrying an `AuthorizationGrantId`), 11 (narrowing **to** a solution is why `solutionId` is on the
row).

**Owner rulings needed before this can be built**

| | Question | Why it blocks |
|---|---|---|
| **O-8** *(existing)* | Every `IngestBound` number | Until they exist `IngestBound` cannot be constructed, so **every arrival refuses**. The intended failure — and it means the ledger works and the pipeline does not |
| **O-5** *(existing)* | The grain a mapping is pinned at | Decides whether `no_promoted_mapping` is per-endpoint or per-`headerSetHash`, and therefore whether the row must carry a header-set hash. **A field I did not add because the answer would decide its type** |
| **O-3** *(existing)* | Whether a document-level `DataClass` is the max over the `DocumentType`'s fields | Decides whether a `needs_configuration` arrival may ever reach tier 4. `ARRIVAL_MAY_BE_REPROCESSED` is written so the answer changes one table entry |
| **O-1** *(existing)* | Broker in the data plane, or a Postgres work queue | If the queue is Postgres, `ingest_arrival` **is** the queue (`FOR UPDATE SKIP LOCKED` over `disposition`) and needs a claim column. If it is SQS, it does not. **One column, decided by O-1** |
| **O-9** 🆕 | **Where the residue renders.** Band D is per-document confidence inside a run (verified). A run-grain band is unavailable because nothing joins an endpoint to a definition. The candidates are: the register's `Coverage` figure (computable today), a solution-grain band nobody drew, or a tenant-wide unrouted list | Decides whether any presentation type is needed — and `presentation.ts` is `@dropped-for-v1` whole, which is why I minted none |
| **O-10** 🆕 | **Does a quarantined artefact get its own retention window?** Recommended **no** — reuse `source_document`, on the two-clocks argument. Cost: a possibly hostile artefact is kept as long as a good invoice, and for a non-admitted arrival the window is the **only** erasure control | If yes: a fourteenth `RetentionClass`, three compile errors, one `check:wire` failure, and a fourteenth number for counsel |
| **O-11** 🆕 | **Does `UsageRecord` gain `arrivalId: IngestArrivalId \| null`?** Without it, *"which arrivals did we spend the paid-tier bill on"* is unanswerable. Precedent is favourable (`runId` is already an opaque data-plane scalar the control plane cannot resolve, `model/billing.ts:198-211`) and the precondition is the opaque-slug rule | It is a field on the one record class that crosses the plane boundary. Invariant 3 |
| **O-12** 🆕 | **What is disclosed in answer to a subject ACCESS request over a non-admitted arrival?** Recommended: the metadata — `arrivedAt`, `filename`, disposition — and **the content is not searched**, because searching it means reading it and G106 forbids that | A product and possibly a counsel statement. Not engineering's |
| **O-13** 🆕 | **The PostgreSQL major version.** `NULLS NOT DISTINCT` needs 15+, and **nothing in this repository records a version** (verified) | Without it the file-grain dedup key silently does not apply to `endpoint_id IS NULL` — the case a person is least likely to notice |

---

## 8. The one-paragraph version

The residue is not a new inbox; it is **the ledger the inbox was always a view over**. One row per
arriving artefact — `IngestArrival` in a new `model/ingestion.ts`, branded `Id<'IngestArrival'>` in
`kernel.ts` with an **opaque** slug, registered in both `identity.ts` maps in the landing commit. Its
outcome is `admitted{sourceDocumentId}` or `refused{ArrivalRefusal}`, where `ArrivalRefusal` is a
closed fourteen-arm union proven text-free by `AssertNoTextDeep` so a parser's message cannot reach
a log, an audit row or a screen. Its triage class is **derived** from the refusal by a total record,
never stored twice, and three further total records answer the only three questions a new refusal can
raise: which retention window (`source_document`, always, so one artefact never has two purge dates),
which meter may fire (`documents_processed` only for `admitted`, because a meter a customer cannot
verify is not a meter), and whether it may be re-processed automatically (`needs_configuration` only,
because cost must never be the escalation trigger for an error). It registers no new
`SubjectLocation` — the existing `blob` variant, constructed from two fields rather than parsed out of
one, which is how it surfaced that no `SourceDocument` can be registered in the erasure index today.
And it admits the thing the erasure index cannot do: a non-admitted arrival has no subject to HMAC,
so `out_of_reach` is the honest disposition and the retention window is the only control that reaches
the bytes. It becomes visible in the same list not as a sixth band but as the register's own third
figure — `Coverage`, drawn on `Close.dc.html:196` and computable by nothing in the tree until this
object exists.

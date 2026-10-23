# RED — attacking the correction / re-parse path

*9 Aug 2026, at `f988f2a4`. **Analysis only:** no file in `/Users/jrkphani/Projects/Reconcile` was
edited, created or deleted; no git command was run. **Every `file:line` below was opened in this
session.** Counts derived with the command shown, never quoted from prose.*

> **Inputs I do not relitigate:** R1–R5, A1–A8, C1–C21, O-1–O-8 of
> `ingest-review-4-ac48b9a12e86f27db.md`, and every G row in `docs/HANDOFF.md` §3. Where I contradict
> the adjudication I quote it and say so.

**Target:** `scratchpad/ingest2/green-correction.md`.

**Headline.** The green report's central *argument* — §2.1, that an in-place recapture leaves every
hash chain valid while silently changing what every recorded finding means — is correct, verified, and
the best thing in the document. Its *design* does not deliver that argument, and five of its stated
controls are inert at the tree. Two findings are the record's own recurring shapes: a persisted store
of extracted content with **no retention class, no purge fields and no `SubjectLocation` variant** (the
hole `blob`, `notification` and the QuickSight variant were each added to close), and a blast-radius
control — `check:wire` over `ExceptionStatus` — **that does not exist in `tools/check-wire-mirror.mjs`
and cannot be added the way its registry says pairs are added.**

---

## BLOCKER

### B1 · `DocumentCapture` is a new store of extracted personal data with no retention window, no purge fields, and no way for an erasure plan to name it — so purging the source stops purging the extraction

**Claim.** §2.3(ii) declares `DocumentCapture` holding `extracted: Record<FieldPath, ExtractedValue>`
and `lines: ExtractedLine[]`, append-only, one row per capture attempt. It declares **no
`purgeAfter`, no `purgedAt`, no `RetentionClass`, and no `SubjectLocation` variant.** Green quotes
`ErasurePlan`'s *"a plan that admits what it cannot reach … is worth more than one that silently
misses it and reports success"* eight times and then creates a store the plan cannot enumerate,
cannot reach, and cannot disclose that it cannot reach.

**Evidence, all opened.**

- `export const RETENTION_CLASSES` — **13 members**, `model/domain.ts:1086-1102`. Derived:
  `awk '/^export const RETENTION_CLASSES = \{/,/^\} as const/' model/domain.ts | grep -cE '^  [a-zA-Z]+:'`.
  `source_document` is one of them (`:1087`); there is nothing for a capture.
- `RetentionPolicy.days: Record<RetentionClass, number>` (`model/domain.ts:1179`), with the
  compile-time proof `_RetentionPolicyAnswersEveryClass` (`:1201-1202`) and
  `RETENTION_RECORD_KIND: Record<RetentionClass, RetentionRecordKind>` (`:1135`), whose own comment is
  *"TOTAL, so a fourteenth class must declare one"* (`:1128`). **A row type that declares no class has
  no window and breaks no proof** — the totality bites only on the class list, and green does not
  touch it.
- `SubjectLocation` — **11 variants**, `model/governance.ts:1772-1830`. The `source_document` variant
  is `{ kind: 'source_document'; sourceDocumentId: SourceDocumentId }` (`:1773`) — **the row id and
  nothing else.** No variant can name a capture version. The 11th variant's own docblock
  (`:1818-1830`) states the test green failed: *"no row here addresses it, so before this variant an
  erasure plan could not reach it and could not disclose that it had not."*
- `SourceDocument.purgeAfter` (`model/domain.ts:1861`) and `.purgedAt` (`:1863`) exist, and the field
  they guard is described at `:1846-1849` as the retention lifecycle *"for an object the model
  previously could not address."* `MatchGroup` carries the same pair (`:2776-2777`). `DocumentCapture`
  carries neither.

**Concrete failure, with inputs.** Tenant `ten_acme`, retention `days.source_document = 90`. Docket
`sd_1001` captured 1 Jan (v1), recaptured 1 Feb after a mapping retraction (v2), recaptured again 3
Feb (v3). On 1 Apr the retention sweep sets `SourceDocument.purgedAt` and deletes the blob at
`storageRef` — the row survives as the stated tombstone. **`document_capture` rows v1, v2 and v3 still
hold every `ExtractedValue` of the purged document**, including any path whose `FieldSpec.dataClass`
(`model/domain.ts:1726`) is `sensitive_personal`. No sweep addresses them, because no `RetentionClass`
names them and `RetentionPolicy.days` has no key for them. On 15 Apr a data subject files an erasure
request: `purgeVerdict()` (`model/governance.ts:1923`) returns `{decision:'purge'}`, the plan
enumerates `SubjectLocation` variants, and **the three captures appear in no item at any disposition —
not even `out_of_reach`.** The plan reports `completed`.

**Why this is worse than the pre-existing state.** Before this design there was exactly one copy of
the extraction (`SourceDocument.extracted`) on a row with a purge lifecycle, plus one *deliberate*
copy on `ObservedValue.scalar` whose second-copy reasoning is written out at `model/domain.ts:2796-2807`
(*"Explanation outlives the document it was drawn from — `days.exception` is deliberately longer than
`days.source_document`"*). Green adds an unbounded number of undeliberate copies with no window at all.

**Control that would close it.** `RETENTION_CLASSES` gains `documentCapture: 'document_capture'`
(kind `content`) — which is a compile error at `RETENTION_RECORD_KIND` and a real
`check-wire-mirror.mjs` failure, because `retention_classes` **is** in the registry
(`tools/check-wire-mirror.mjs:98-101`); `DocumentCapture` gains `purgeAfter` and `purgedAt` computed
at capture time under the same at-write discipline as `SourceDocument.purgeAfter`; `SubjectLocation`
gains `{ kind: 'document_capture'; sourceDocumentId; version }`, which is also a real wire-mirror
failure (`subject_location` is registry pair 1, `:73-77`). All three failures are the totality biting,
and all three are absent from green's §2.3 and §4.

---

### B2 · `mayRecapture()` never calls `resolveManagedService()`, two of its twelve refusal arms are unreachable, and §3 claims one of them refuses on a rejection it can never see

**Claim.** Green presents recapture as `resolveManagedService()`'s first production caller. Its gate
function does not call it, takes no managed-service parameter, and cannot return the arm. Invariant 7
on the recapture path is prose over zero call sites — the shape the prompt names as having been found
*four times stacked under one feature*. This is the fifth.

**Evidence.**

- `resolveManagedService()` is at `model/policy.ts:1781`; `ManagedServiceRejection`'s five arms are at
  `:1727-1748`. Ground truth for this session: **no production caller.**
- Green §1 row 47 (line 89): *"Exists as of `f988f2a4`; **no production caller**. Recapture of a
  `scanned` document is a caller."*
- Green §7a (line 1052) contradicts it in the same document: *"Invariant 7 … A `scanned` recapture
  calls `resolveManagedService()` under **today's** config | **C1 written, no caller**."*
- The function body (green lines 739-781) has exactly ten `return` statements. Enumerating the
  declared arms (green lines 651-684) against them: `mapping_not_retracted` ✓ · `replacement_mapping_not_live` ✓ ·
  `replacement_mapping_second_person_absent` ✓ · `actor_not_customer_org` ✓ · `actor_lacks_capability` ✓ ·
  `plan_bound_not_stated` ✓ · `plan_exceeds_bound` ✓ · `document_purged` ✓ · `erasure_requested` ✓ ·
  `capture_ledger_not_append_only` ✓ · **`managed_service_refused` ✗** · **`run_input_set_unreconstructable` ✗**.
- Green §3 (line 940) nevertheless states: *"`{ kind: 'managed_service_refused' }` | Refuses on: any
  `resolveManagedService()` rejection."* The gate cannot produce it.

**Concrete failure, with inputs.** Tenant narrows `ManagedServiceUseConfig.allowedRegions` to
`['ap-southeast-1']` in March. A `RecapturePlan` over 3,000 `scanned` dockets executes in April from a
worker in `ap-southeast-2`. `mayRecapture()` returns `{permitted:true}` for every item — capability
held, mapping retracted, replacement live and countersigned, bound respected, not purged, retention
`retain`. Nothing in the design's only gate consults the residency config, and `resolveManagedService()`
is still uncalled. 3,000 page images cross a boundary the tenant closed. The arm exists; nothing
reaches it. `AssertNoTextDeep` on the union stays green, because an unreachable arm still holds no
text — §5.6 exactly, and green's own §4 note says as much about `AssertNoTextDeep` going green on an
unsatisfiable union (line 957) without applying it to its own two arms.

**Control.** `mayRecapture()` takes `managedService: ManagedServiceResolution` — the *result*, not the
config — and refuses on `ok: false`, mapping `rejection.reason` onto the arm; and the resolution is
computed inside the same transaction as the capture write. Better: the arm's presence is witnessed by
a fixture calling `resolveManagedService()` with `model/examples.ts`'s fail-closed
`allowedFeatures: []` config, which green's §4 lists (line 976) and its function makes unreachable.
Also delete `run_input_set_unreconstructable` or give it an operand.

---

### B3 · The `ReaderReplayKey` fix reproduces the exact positional dependence it was invented to remove, because `requestOrdinal` is a FIELD of `ReaderRequest`

**Claim.** Green's §2.9 diagnosis of G120 is correct (credited below). Its fix is inert. The key is
`requestBodyHash: string`, documented as *"The RFC 8785 canonical form of the request, hashed by the
writer"* (green line 912). `requestOrdinal` **is part of the request.**

**Evidence.**

```
model/reconciliation.ts:2194  export interface ReaderRequest {
model/reconciliation.ts:2195    readonly requestOrdinal: number
model/reconciliation.ts:2196    readonly subjectRef: ItemRef
model/reconciliation.ts:2197    readonly untrustedDescription: string        // ⚠️ COUNTERPARTY-CONTROLLED
model/reconciliation.ts:2198    readonly untrustedDescriptionClass: DataClass
model/reconciliation.ts:2199    readonly candidates: readonly ReaderCandidate[]
```

`canonicalise(request)` (`model/canonical.ts:137`) walks every own key at every depth —
`jcsSortedKeys` at `:123-125` — so the canonical form of a `ReaderRequest` **includes
`requestOrdinal`**. Green's own §2.9 establishes that this number is `requests.length` inside a loop
with five `continue`s (`model/reconciliation.ts:2402`, `:2404`, `:2406`, `:2419-2420`, emitted at
`:2423`). So the content-addressed replay key varies with position, which is the defect.

**And nothing at the tree can catch it**, by green's own construction: *"IT DOES NOT HASH. `model/` is
standalone with no `node:crypto` … This type is the SHAPE of the key; the writer computes it"* (green
lines 906-908). There is no type naming the hashed projection, so a writer that canonicalises the
whole request typechecks, passes every `AssertNoTextDeep`, passes `npm run check`, and produces a key
that is 100% miss on any rerun — or, if a second writer omits the ordinal and a first includes it, two
writers silently disagree about cache identity, which is the exact class G20's RFC 8785 ruling exists
to prevent.

**Concrete failure, with inputs.** Run `R1`, residue of 900 entries, 40 requests emitted with ordinals
0…39. Recapture changes nothing about item `(sd_1001, 7)`'s description or candidate set, but removes
one earlier left-side entry from the residue, so its ordinal becomes 6. The replay lookup misses. All
40 requests re-ask the model, at cost, non-deterministically. **The property G120 bought — *"makes a
rerun REPLAY stored verdicts rather than re-ask — so the reconciliation stays deterministic"*
(`docs/HANDOFF.md:846`, quoted verbatim) — is delivered by neither the original key nor the fix.**
This is the G75 shape: recorded as applied, inert, because nobody named the third thing.

**Control.** Declare the hashed body **in `model/`** as a type, not as a sentence:

```ts
export type ReaderReplayBody = Omit<ReaderRequest, 'requestOrdinal'>
```

plus a compile-time assertion that the body's key set is the request's minus that one field, so adding
a sixth field to `ReaderRequest` is a compile error at the replay key rather than a silent cache miss.
And state, as an owner cost rather than a free lunch, that a corrected rerun re-asks by construction
(see N7).

---

### B4 · The stated blast-radius control for the eighth `ExceptionStatus` member does not exist in `tools/`, and cannot be added the way the checker's registry says pairs are added

**Claim.** Green mints `ExceptionStatus.'superseded'` and states the control precisely (lines 311-319,
960): *"`tsc` will stay green on this member and tell you nothing (§5.10); **`check:wire` is the only
thing that bites**."* `check:wire` does not cover `ExceptionStatus`.

**Evidence.**

- `tools/check-wire-mirror.mjs:71-102` — `export const PAIRS = [ … ]` has **five** entries:
  `subject_location`, `live_policy_kind`, `service_notice_kinds`, `meters`, `retention_classes`.
  **`ExceptionStatus` is not one of them.** Derived: `grep -n "name: '" tools/check-wire-mirror.mjs`.
- The registry's own comment (`:58-60`): *"The five pairs. This array is the extension point; adding a
  sixth is a line here plus a test, not a change to the engine."* But `unionKinds()` (`:108-115`)
  extracts *"the `kind: '…'` literals of a discriminated union"*, and `ExceptionStatus`
  (`model/domain.ts:648-655`) is a **bare string-literal union with no discriminant**. So the pair
  needs a **new `model.source` kind**, i.e. a change to the engine — the one thing the registry says
  adding a pair is not.
- The checker's non-covered class is reported as `UNMIRRORED` and **does not fail the run**
  (`tools/check-wire-mirror.mjs:389`, `:398`).
- `tools/check-doc-counts.mjs` governs fourteen named totals (`CLAUDE.md`, "The document counts");
  `ExceptionStatus` is not one.
- The wire enum, opened: `docs/contracts/capability.openapi.yaml:2344-2352` — **seven members**, and
  it is `$ref`-ed at `:542`, `:644`, `:807`, `:2708`, `:2871`, `:2938` (derived:
  `grep -c "ExceptionStatus" docs/contracts/capability.openapi.yaml` → 7).
- Model side: `grep -rn "ExceptionStatus" model/*.ts` returns `domain.ts:648, 2931, 3020` plus
  `presentation.ts:154, 576, 880` (the last two `@dropped-for-v1`). Green's claim that no total
  `Record<ExceptionStatus, …>` exists is **true**.

**Concrete failure.** The member lands. `npx tsc -p model/tsconfig.json --noEmit` → `EXIT: 0`.
`npm run check` → green, all six scripts. The wire keeps seven values while the model has eight, and
`GET /exceptions?status=superseded` is rejected by request validation while the row exists in the
database — an exception that is invisible to the only surface that can list it. **The change green
declares as "red only on `check:wire`" is red on nothing.**

**Control.** Either (a) add a `literal_union` source kind to `check-wire-mirror.mjs` plus the sixth
registry pair plus its test *in the same commit as the member* — and note that this is engine work,
not a one-liner; or (b) do not widen `ExceptionStatus` at all and carry "replaced by a corrected
rerun" on the run/`MatchGroup` side, where `supersededByRunId` already lives and no wire enum moves.
See also N2 and N3, which argue (b).

---

### B5 · Every structural precedent this design copies is `@dropped-for-v1`, and the report never says so — including the one whose drop note reads "a wrong promotion is undone by hand"

**Claim.** §0's verdict is *"Correction is not a new subsystem … all four already exist with their
arguments already written."* Four of the five things it leans on hardest are declared-and-not-built for
v1. `CLAUDE.md` is explicit: **"Before you build against a type, check whether it is dropped."** The
green report's only four uses of the word "dropped" are about `presentation.ts` and `DATA_CLASS_RANK`
(lines 314, 959, 1122, 1125).

**Evidence — opened, with the marker line for each.**

| Green §1 row | Thing | Marker |
|---|---|---|
| 9 | `LearningRetraction` | `model/learning.ts:1248` |
| 10 | `RETRACTION_UNMAKES_DOWNSTREAM` | `model/learning.ts:1239` |
| 11 | `RetractionMode` | `model/learning.ts:1221` |
| 12 | `mayRetractLearning()` | `model/learning.ts:1285` |
| — | `LearningRetractionReason` | `model/learning.ts:1188` |
| — | `RetractionRefusal` | `model/learning.ts:1206` |

Every marker reads: `/** @dropped-for-v1 7 Aug 2026 — **retraction is unbuilt in v1; a wrong
promotion is undone by hand.** Declared, not built. */`

**Why this is substantive and not pedantry.** Three consequences.

1. **The cost framing inverts.** "It already exists, nobody joined them" reads as composition of built
   machinery. Nothing here is built, one whole limb of it is *decided against* for v1, and the two
   layers underneath it — R2/C14's `promote_field_mapping` (ruled, unapplied) and C8's
   `mappingVersionId` (ruled, unapplied) — are also unbuilt. The honest statement is: this is a
   net-new v1 subsystem whose precedents are drawings.
2. **It contradicts a standing v1 scope decision.** v1's decided answer to *"a promotion turned out
   wrong"* is **by hand**. Green builds an automated retract → plan → recapture → rerun path for
   mappings while the analogous learning path is deliberately manual. That may well be right — a
   mapping error moves money and a learned rule moves a disposition — but it is an **owner ruling with
   a G number**, not a derivation, and the report presents it as the latter.
3. **The one-person argument green quotes as settled was written for a control v1 does not run.**
   `model/learning.ts:1176-1186` is real and quoted correctly, but it sits above six dropped
   declarations. Inheriting its conclusion (§2.6 row ①, "**No.** narrowing is automatic") inherits a
   holding nothing in v1 exercises — and S1 below shows the copy also dropped the one arm that
   holding needed.

**Control.** A dated line in the design: *"This section builds in v1 what `model/learning.ts`'s
retraction block is `@dropped-for-v1` for; the six markers are at `learning.ts:1188, 1206, 1221, 1239,
1248, 1285`, and the divergence is deliberate because a mapping binds the amount path."* Then take it
to the owner as a numbered decision. `tools/check-doc-counts.mjs` governs the dropped-marker **count**
(230) and cannot see a design that builds against one.

---

## SERIOUS

### S1 · `actorOrgClass !== 'customer'` locks out the principal R2 puts the mapping with, and makes the whole `authority` / `CONTRACT_ONLY_RESOURCES` argument inert

**Claim.** Both gates refuse every non-customer principal. R2 places mapping authorship with the FDE,
and A5/C14 class the capability `authority` **specifically so that a signed `SupportAuthorisation`,
and not a standing grant, is what reaches it**. Green's org arm refuses the contract-authorised FDE
before the class is ever consulted. So (a) the person who promoted the wrong mapping cannot suspend
it, and (b) the paragraph green spends on `CONTRACT_ONLY_RESOURCES` buys nothing.

**Evidence.**

- Green `mayRetractMapping()` (lines 535-537) and `mayRecapture()` (lines 742-744):
  `if (input.actorOrgClass !== 'customer') return { permitted: false, refusal: { kind: 'actor_not_customer_org' } }`.
- The adjudication R2, line 68: *"**Placement:** G56/G59 put source configuration with the FDE; G22/G38
  already give this exact posture to `FieldSpec.confidenceFloor` … FDE-set, rendered read-only."*
- `CONTRACT_ONLY_RESOURCES: readonly AccessResourceClass[] = ['authority']`
  (`model/governance.ts:512-514`), whose docblock (`:506-511`) is *"Classes a purpose never opens by
  itself, and a `SupportAuthorisation` may … `PERMITTED_RESOURCES` is what the platform decides, this
  is what the customer decides."* **That list exists to admit a contract-authorised staff principal.**
  Green's org arm refuses all of them first, so the class argument at green lines 432-439 is
  unreachable reasoning.
- The precedent green copied **has the arm green dropped.** `mayRetractLearning()`
  (`model/learning.ts:1286-1313`) carries an explicit platform arm:
  `if (input.reason === 'contamination_suspected') { if (input.actorOrgClass !== 'platform') return …
  'reason_reserved_to_platform'; return { permitted: true } }` (`:1300-1310`), argued at `:1301-1306`.
  Green's `MappingRetractionReason` has five arms and no platform-raisable one.

**Concrete failure, with inputs.** 03:10. An FDE promoted mapping `map_88` for `ten_acme` under a
signed `SupportAuthorisation` naming `authority`, and discovers she bound a running-balance column to
`amount` — the adjudication's A4/R2(c) act exactly. She holds `promote_field_mapping` under the
contract. `mayRetractMapping({actorOrgClass:'platform', …})` → `actor_not_customer_org`. **The mapping
stays live and keeps parsing incoming files** until a customer-org principal with an `authority`-class
capability is woken. This is G60's shape in miniature — *"the invariant as written made the FDE's own
job structurally impossible"* — and G60 is the record's only invariant reversal.

**Control.** Give `MappingRetractionMode: 'suspend'` a platform arm on `mayRetractMapping()`, on
`mayRetractLearning()`'s own reasoning: a platform principal may `suspend` (pure narrowing, reversible,
one act) and may never `retract` (terminal) nor recapture. Add
`MappingRetractionReason.'binding_suspected_by_platform'` as the reserved reason, and refuse it to
tenant principals — the mirror of `contamination_suspected`. Then the `authority` /
`CONTRACT_ONLY_RESOURCES` argument becomes load-bearing instead of decorative.

### S2 · A mass `data_corrected` reversal erases the disposition the agent chose under the wrong mapping — falsifying "Nothing. It is already safe."

**Claim.** §2.2's first row says of `Exception`: *"**Nothing. It is already safe.** The wrong finding
stays readable as the wrong finding — which is what an auditor needs."* The field's own docblock says
the reversal clears the resolution.

**Evidence.** `model/domain.ts:3026-3027`: *"**The current resolution. Null while unresolved, and
cleared on reversal.**"* / `resolution: ExceptionResolution | null`. `ExceptionReversal`
(`:2924-2932`) carries `reason`, `note: string | null`, `newStatus`, and
`correctedDispositionKey: string | null` — the last *"Set when the reverser chose a different
disposition rather than reopening"* (`:2930-2931`), i.e. **null on a plain reopen.**
`Exception.reversals: ExceptionReversal[]` (`:3033`).

**Concrete failure, with inputs.** 12,000 exceptions were auto-resolved under mapping `map_88` with
`ExceptionResolution.mode = 'agent'`. The correction reverses all 12,000 with
`{reason:'data_corrected', newStatus:'open', correctedDispositionKey:null}`. Every `resolution` goes
null. Six weeks later an auditor asks *"what did the agent decide, and on what evidence, before we
found the mapping wrong?"* — `Explanation.observed[].scalar` still holds the wrong amounts (that copy
**is** safe, correctly), and the **disposition** is gone from all 12,000 rows. `reversalIndictsAutonomy()`
returns `false`, correctly, so autonomy is not narrowed — and there is now no record of what the
autonomy did. The one thing `LearningRetraction`'s docblock names as *"the one thing an auditor asks"*
is what this loses, on the path green built by copying that docblock.

**Control.** Either pin the prior resolution on the reversal (`revokedResolution: ExceptionResolution`,
non-null when `newStatus !== 'resolved'`), or add a correction post-condition arm
`{ kind: 'reversal_discarded_resolution'; count: number }` and require the correction path to write
the resolution into the reversal before clearing. Both are cheaper than the alternative green implies,
which is that nothing was lost.

### S3 · Nothing in the design carries `carriedForwardFrom` onto the corrected run's exceptions, and that field exists partly to stop the `exceptions_raised` meter inflating on a re-run

**Claim.** A mass correction is a metered event on a path green never gates. The field's docblock names
the failure, green cites the field twice (§1 row 8, §4) for *identity* only, and the eight-arm
post-condition union has no arm for it.

**Evidence.**

- `Exception.carriedForwardFrom: ExceptionId | null` (`model/domain.ts:2952`), docblock `:2946-2951`:
  *"Cross-run identity … **Also stops the billable `exceptions_raised` meter inflating on every
  re-run.**"*
- `METERS.exceptionsRaised: 'exceptions_raised'` (`model/billing.ts:81`) with aggregation `sum`
  (`:109`).
- Green's `CorrectionPostconditionFailure` (lines 804-818) has eight arms: two capture-currency, two
  run-membership, two supersession, one plan-item, one retracted-mapping. **None is
  `corrected_run_exception_without_carry_forward`.**
- Green §7a row for invariant 5 (line 1051) states the right rule — *"A recapture is a metered event
  and must not be a priced one"* — and no declaration enforces the carry-forward.

**Concrete failure, with inputs.** `RecapturePlan` over 40,000 dockets; the corrected run raises
39,600 exceptions, of which 38,900 are the same findings the superseded run raised. Without
`carriedForwardFrom` set, `exceptions_raised` sums 39,600 fresh billable exceptions **for a correction
of our own mapping error**. Invariant 5 holds formally (`UsageRecord` is immutable and unpriced) and
the volume in the clear is wrong by 38,900. Green's own §6 item 5 says *"the cost of a correction is
unmodelled"* — this is not the modelling gap; it is a control gap on the customer's invoice.

**Control.** A ninth post-condition arm, plus the rule stated in the module header: **the corrected
run's exceptions carry `carriedForwardFrom` to the superseded run's exception wherever
`(ruleId, matchGroup keyValues, lineKey)` matches**, and a `MeterFact` emitted for a corrected rerun
is tagged so the sum is derivable both ways. Owner ruling owed: does a correction of a platform error
meter at all.

### S4 · No reference anywhere in the model can name a capture, so the preserved old capture is unreachable and §2.1's own argument survives green's design

**Claim.** The ledger keeps v1. Nothing can point at v1. Every reference resolves through
`SourceDocumentId` to whatever is live, so an in-place-equivalent semantic rewrite still happens — the
mutation is just relocated from `extracted` to *which capture `extracted` is a projection of.*

**Evidence — four reference types, all opened, none carrying a version.**

- `ItemRef { readonly sourceDocumentId: SourceDocumentId; readonly lineIndex: number | null }`
  (`model/reconciliation.ts:785-789`); `itemKey()` at `:809-813` is
  `${side}:${id.length}:${id}:${line}`.
- `ObservedValue` (`model/domain.ts:2788-2808`): `sourceDocumentId`, `lineIndex: number | null`,
  `provenance: Provenance`.
- `MatchGroup.members: Record<SlotName, SourceDocumentId[]>` (`:2770`);
  `ReconciliationRun.inputs: Record<SlotName, SourceDocumentId[]>` (`:2718`).
- `SubjectLocation` `source_document` variant: id only (`model/governance.ts:1773`).
- `Provenance` is `{ page; boundingBox; confidence }` (`model/domain.ts:1812-1816`) under the docblock
  *"Where an extracted value came from. **Renders as a highlight over the source.**"*

**Concrete failure, with inputs.** Docket `sd_1001`, 40 lines. Capture v1 parsed under `map_88`
dropped a header row, so line 12 of v1 is line 13 of v2. Exception `exc_77` cites
`ObservedValue{sourceDocumentId:'sd_1001', lineIndex:12, scalar:{money 1,234.56}, provenance:{page:2,
box:…}}`. After the recapture the exception's **stated value is v1's** (correctly preserved, per
`:2796-2807`) and its **pointer resolves into v2** — a different row, a different page box. The screen
draws v1's finding over v2's document. No post-condition can see it: green's eight arms are counts over
captures, runs and plan items, and none compares a reference against the capture it was computed under.

**Control.** One field on the two references that are pointers rather than copies —
`ObservedValue.capturedVersion: number` and `SubjectLocation.source_document.version` — or the
alternative green did not consider: keep the ledger **write-only for audit** and say so, i.e. state
that no reference can name a superseded capture and that the ledger's value is preservation, not
retrieval. Either is honest; silence is not, because §2.1's whole argument is that a semantic rewrite
under a valid chain is the failure.

### S5 · `captureLedgerIsAppendOnly: boolean` is a caller-asserted claim about a database invariant, used as a gate

**Claim.** §5.2 in its purest form. `mayAdmit()`'s `secondPersonPresent: boolean` is a precedented
caller-supplied **fact about the act**; this is a caller-supplied **fact about the schema**, asserted
by the very code that assumes it. And `document: { purged: boolean }` keys on a landmark rather than
the property it protects.

**Evidence.**

- Green `mayRecapture()` input (line 737) `captureLedgerIsAppendOnly: boolean`, consumed at lines
  767-769 → `capture_ledger_not_append_only`. No runtime value can witness "the partial unique index
  exists".
- Precedent that does *not* transfer: `mayAdmit(cfg, actor, messageClass, secondPersonPresent: boolean)`
  (`model/policy.ts:1085-1087`) — a fact about an act somebody performed. And the standing refusal it
  sits beside: `ManagedServiceUseConfig`'s banner refuses a `requireImprovementOptOut` because *"a
  caller-supplied parameter that switches a check off is the defect shape this codebase catalogues"*
  (`model/policy.ts:1685-1688`).
- `document: { purged: boolean }` (green line 734) is `SourceDocument.purgedAt !== null`
  (`model/domain.ts:1863`). The property it protects is *the bytes are reachable*, which is
  `storageRef` (`:1849`). An `ErasurePlanItem` with `location.kind === 'blob'`
  (`model/governance.ts:1773+`, `ErasurePlanItem` at `:1975`) executed against the object leaves
  `purgedAt` null and the object gone.

**Concrete failure.** Phase-one Postgres is created from a migration that ships the table without the
`WHERE superseded_at IS NULL` partial unique index (M8's scenario, which green predicts). The worker
passes `captureLedgerIsAppendOnly: true` because the worker is the code that believes it. Two
concurrent plan executions recapture `sd_1001`; both write `supersededAt: null`; the next run reads
whichever the projection update landed last. `mayRecapture()` returned `permitted: true` both times.
Separately: an erasure plan purged `sd_2002`'s blob last month with `purgedAt` untouched;
`mayRecapture()` permits, the fetch 404s, and the refusal is a thrown error rather than an
`out_of_reach` disposition.

**Control.** Delete `captureLedgerIsAppendOnly` from the gate and make it a **schema test plus a
post-condition** — green already has `document_has_two_live_captures`, which is the right mechanism;
the boolean adds a false sense that the gate checks it. Replace `purged: boolean` with
`storage: { purgedAt: Timestamp | null; blobReachable: boolean }`, or take the whole
`SourceDocument` row and derive both, so the gate keys on the property.

### S6 · `RecaptureMode: 'capture_and_rerun'` performs the `trigger_run` act, and `mayRecapture()` checks only `promote_field_mapping`

**Claim.** A caller-supplied mode parameter reaches an act whose capability the design's own table
gates separately.

**Evidence.** Green's `RecaptureMode` (lines 645-649): `'capture_and_rerun'` = *"Re-read and enqueue
the corrected rerun in the same transaction."* Green's own act table (line 424): *"④ the corrected
rerun | `trigger_run` | `configuration`."* `CAPABILITY_RESOURCE_CLASS.trigger_run = 'configuration'`
(`model/access.ts:611`). `mayRecapture()`'s only capability input is `holdsPromoteFieldMapping`
(green line 727); `mode` is on the `Recapture` record (line 695) and is **never read by the gate.**

**Concrete failure.** A customer-org principal holds `promote_field_mapping` (`authority`) and is
deliberately not granted `trigger_run` — a plausible separation, since `trigger_run` is the FDE's
operational verb by green's own asymmetry note (lines 436-439). She submits a plan with
`mode: 'capture_and_rerun'` over 40,000 documents. 40,000 recaptures and one run enqueue, with no
`trigger_run` evaluation anywhere. Invariant 10 is satisfied — the act carries an
`AuthorizationGrantId` — for a capability that was never checked.

**Control.** `mayRecapture()` takes `holdsTriggerRun: boolean` and refuses
`{ kind: 'actor_lacks_trigger_run' }` when `mode === 'capture_and_rerun'`; or delete the mode and make
the rerun always a separate authorised act, which is what green's table already describes.

### S7 · The cost bound is checked against a caller-declared plan size in a per-document gate, and nothing ties the document to the plan or to the retracted mapping

**Claim.** The bound green calls the answer to *"an unbounded bill authored by one click"* is
enforceable only by a caller that already has the answer, and the gate cannot tell whether this
document belongs in this plan at all.

**Evidence.** `mayRecapture()` is *"ONE recapture of ONE document"* (green line 689) and takes
`plan: { maxDocuments: number; plannedDocuments: number }` (line 733), compared at lines 757-766.
Nothing counts **executed** recaptures. `Recapture.planId` exists (line 693) but the gate receives no
plan item set, no `RecapturePlan.items`, and no `SourceDocument.mappingVersionId` — the field C8 exists
to supply and green restates on the plan (line 615).

**Concrete failure, with inputs.** `maxDocuments: 500`. The executor calls `mayRecapture()` 40,000
times with `plannedDocuments: 1` each. Every call returns `permitted: true`; 40,000 `scanned`
recaptures re-invoke the managed service. Separately, a caller passes `sd_9999`, whose
`mappingVersionId` is `null` (a `digital_text` document that never used the mapping): permitted, and
its capture is replaced under a mapping it was never parsed under — a *new* wrong parse manufactured
by the correction.

**Control.** Two arms and one query. `{ kind: 'document_not_in_plan' }` and
`{ kind: 'document_not_under_retracted_mapping'; }`, the second reading
`SourceDocument.mappingVersionId === plan.mappingVersionId`; and the bound compared against
`SELECT count(*) FROM recapture WHERE plan_id = $1` inside the same `withTenantScope()` transaction as
the insert, so the count cannot be stale by construction (G99/G101).

### S8 · `erasure_requested` is returned for both `purge` decisions, so an elapsed retention window is recorded as a data-subject erasure request

**Claim.** Two concepts, one refusal literal — and the tree's own precedent refuses exactly this
collapse.

**Evidence.** `purgeVerdict()` returns `{ decision: 'purge', reason: 'Data subject erasure request' }`
at `model/governance.ts:1943` **and** `{ decision: 'purge', reason: 'Retention period elapsed' }` at
`:1946`. Green's gate (lines 777-779) tests `input.purge.decision === 'purge'` and returns
`{ kind: 'erasure_requested' }` for both. The counter-precedent is in the module green copies most:
`ManagedServiceRejection` splits `provider_retention_unevaluable` from
`provider_retention_exceeds_tolerance` and argues it at `model/policy.ts:1740-1748` — *"Collapsing
them would report a verified breach where there is an unverified window, and `docs/HANDOFF.md` §5.5
records this codebase already fixing scope that failed OPEN once."*

**Concrete failure.** A `RecapturePlan` over 40,000 dockets, of which 6,300 are past their retention
window and none has an erasure request. The plan persists 6,300 items whose recorded refusal asserts a
data-subject erasure request. `RecapturePlanItem.reason` is free text and `disposition` would be
`blocked_by_erasure` — whose docblock (green lines 572-576) states the fact as *"`purgeVerdict()`
returned `purge` on `erasureRequested`."* An auditor reading the plan concludes 6,300 subjects asked
to be forgotten. The refusal union carries no text by design, so **the false statement is the only
statement.**

**Control.** Two arms: `{ kind: 'erasure_requested' }` and `{ kind: 'retention_window_elapsed' }`,
distinguished by the caller passing `purgeVerdict`'s inputs (`erasureRequested: boolean`) alongside its
answer — or better, `PurgeVerdict` gains a machine-readable cause literal beside its human `reason`
string, which is a one-line change to `model/governance.ts:1913-1915` and closes the same hole for
every future reader of that verdict.

---

## NOTED

### N1 · The live projection is still an in-place update, and no post-condition sees it diverge
`SourceDocument.captureVersion` (green line 217) duplicates `DocumentCapture.version` (line 250).
Writing a capture requires an `UPDATE source_document SET extracted = …, capture_version = …` — the
in-place mutation §2.1 forbids, now with a ledger row beside it. The eight post-condition arms cover
two-live and no-live captures but not *the projection disagrees with the live capture*. Add
`{ kind: 'projection_disagrees_with_live_capture'; count: number }`, or drop `captureVersion` from
`SourceDocument` and derive it, since two writable copies of one number is §5.3 at the smallest scale.

### N2 · The eighth `ExceptionStatus` member lets a `tenant_data` capability produce the `authority`-gated outcome, and the premise for minting it is prose
`ExceptionReversal.newStatus: ExceptionStatus` (`model/domain.ts:2929-2930`) is unconstrained — *"Where
the exception went. Usually back to `open`."* Adding `'superseded'` makes it legal for any holder of
`reverse_resolution` (`CAPABILITY_RESOURCE_CLASS.reverse_resolution = 'tenant_data'`,
`model/access.ts:576`) to stamp *"replaced by a corrected rerun"* on a finding with no rerun in
existence — while the correction path itself is gated at `authority`. And green's stated premise —
*"`ExceptionReversal` only reaches a RESOLVED one"* (lines 303-306) — is a **docblock**, not a type
constraint: `ExceptionReversal` has no `exceptionId`, no status precondition, and
`Exception.reversals` is a bare array (`:3033`), so a reversal on a never-resolved exception is already
legal today. The type-level gap green cites as the reason for the new member is a gap the new member
widens.

### N3 · G74's unapplied ruling owns the space this member lands in, and green never mentions it
`docs/HANDOFF.md:728` (G74, *adjudicated, NOT applied*) rules `FINDING_STANDINGS` plus
`standingFor(FindingBasis)` as a **derivation beside** `ExceptionStatus`, and
`docs/build/red-indicator-model.md:93` was a BLOCKER titled *"Four of seven `ExceptionStatus` members
map to none of the five."* Both that document (`:96`) and
`docs/build/green-indicator-model.md:257` carry reproduction commands stating **expect 7**. An eighth
member staleifies two stated reproductions in an adjudicated design and lands inside an unapplied
ruling's blast radius. `tools/check-doc-counts.mjs` governs neither number.

### N4 · `actor: UserId` is declared and never read, in both gates
Green's `mayRetractMapping()` (line 528) and `mayRecapture()` (line 725) both take `actor: UserId` and
neither body references it. `mayPromoteLearning()` does read its actor — the self-approval arm at
`model/learning.ts:1160-1163`. A declared input that asserts nothing is the parameter-level form of
§5.6; either use it (there is a case: the recapturer should not be the person who promoted the wrong
mapping, which would make R2's second person reach one step further) or drop it.

### N5 · `plan_bound_not_stated` names a state the type forbids
`RecapturePlan.maxDocuments: number` (green line 631) is required and non-nullable, so "not stated" is
unrepresentable; the check (lines 754-756) actually catches non-integer and `< 1`. Either type it
`number | null` and refuse on null — which is what O-8's *"an unset bound refuses"* posture requires —
or rename the arm `plan_bound_not_positive_integer`. As written it is a refusal whose name describes a
different failure, which is how a closed vocabulary acquires two meanings.

### N6 · Two counterparty-derived text paths on the one artefact a human reads
`RecapturePlanItem.reason: string` (green line 596) is persisted, human-read, and outside
`AssertNoTextDeep` — green names this in §6 item 7 and says *"Stated once, enforced by nothing."*
Accepted as a mirror of `ErasurePlanItem.reason` (`model/governance.ts:1978`). But
`RecapturePlanItem.location: SubjectLocation` also admits `{ kind: 'blob'; bucket: string; key: string }`
(`model/governance.ts:1781`), and an S3 key derived from `SourceDocument.filename` — an uploaded,
counterparty-supplied name (`model/domain.ts:1845`) — is counterparty text reaching a screen, a log and
an `AuditEvent` body. Green states the plan uses only three variants; the **type** permits eleven.
Narrow the field: `location: Extract<SubjectLocation, { kind: 'source_document' | 'match_group_key' |
'explanation_observed' }>`, which makes the three-variant claim a compile error to violate and costs
one line.

### N7 · The corrected rerun's determinism claim is empty in exactly the case it was designed for
Green states the corrected run is deterministic given *"…and the replayed verdicts whose
`requestBodyHash` matched"* (lines 917-922) and calls the invalidation *"free, and that is the point"*
(lines 894-897). Correction exists because the capture changed; the capture changes the admitted set,
which changes the residue, which changes every request body downstream of the change. So essentially
nothing replays and the corrected run's determinism rests on a fresh non-deterministic model call —
the property `docs/HANDOFF.md:846` bought replay to avoid. This is a **cost and an owner ruling**
(re-ask volume on every correction, and whether a corrected run is reproducible at all), not a free
lunch. It should be stated the way R5(vi)'s long-transaction cost was: as the tradeoff that makes the
ruling conditional.

---

## Where the green team is RIGHT and I could not break it

Seven things. I tried to break each and could not.

1. **§2.1 is correct and it is the strongest argument in either report.** `grep -rn "chain: RecordChain"
   model/*.ts` → **2**: `model/domain.ts:3939` and `model/governance.ts:1158`. `AuditEvent.subjectType`
   and `subjectId` are both bare `string` (`model/domain.ts:3981`, `:3987`) with the "the pair IS the
   identifier" argument at `:3982-3989`, and `bodyHash` is *"Hash of this record's canonical body"*
   (`model/governance.ts:1119`). So an in-place recapture really does rewrite what every recorded
   finding means while leaving every chain valid and every `ChainAnchor` matching. **The tamper
   evidence covers the two streams, not the business rows they point at.** Nobody in four prior
   reports said this. It is the correct reason for a compensating shape, and it is not an aesthetic
   one.
2. **The autonomy-strangling failure mode really is already answered, and green found it.**
   `RunTrigger.rerun` carries `reason: 'definition_changed' | 'rule_changed' | 'data_corrected'`
   (`model/domain.ts:2763`); `ReversalReason` carries `'data_corrected'` (`:2906`) documented *"The
   underlying data changed afterwards. Does not indict."*; `reversalIndictsAutonomy()` (`:2920-2922`)
   returns true only for `wrong_disposition` and `insufficient_evidence`, with the argument at
   `:2890-2898` — *"the loop would slowly strangle itself on its own data corrections."* A 40,000-document
   correction structurally cannot narrow the tenant's autonomy. Verified; unbreakable.
3. **§7c is right and the adjudication's C7/C8 note is wrong.** C7 and C8 both say *"nothing in `model/`
   constructs a `SourceDocument`, so `tsc` stays green."* True of `model/` — `grep -rn "SourceDocument"
   model/examples.ts` returns **zero**, and `model/domain.ts:4127-4139`'s `project()` only reads from a
   `ReadonlyMap` — and false of the repository. Three live construction sites, opened and each
   supplying every field explicitly: `tests/model/reconciliation-conservation.test.ts:144`,
   `tests/model/reconciliation-passes.test.ts:120`, `tests/model/learned-dispositions.test.ts:151`. So
   adding a required `SourceDocument` field goes red at three sites, at `npm test` rather than at
   `typecheck`. Green's correction of the adjudication is correct and better than the thing it
   corrects.
4. **§2.9's diagnosis of G120 is right, verified, and challenged in writing with the quote rather than
   relitigated.** `requestOrdinal: requests.length` at `model/reconciliation.ts:2423`, inside a loop
   over the residue with `continue`s at `:2402`, `:2404`, `:2406` and `:2419-2420`. It is a position in
   an iteration whose membership depends on the admitted set, which depends on the capture. The
   consequence green names — a `PairingEvidence.reader_confirmed` recording a model's confirmation of a
   pairing the model was never asked about — follows, and it is not correction-specific. **The
   diagnosis stands; only the fix is broken (B3).**
5. **The no-text discipline on the refusal arms is right and non-obvious.** `NoTextField` maps arrays —
   `T extends readonly (infer U)[] ? readonly NoTextField<U>[]` (`model/reconciliation.ts:248-256`) —
   so embedding `ManagedServiceRejection` would go red through
   `feature_not_permitted.permitted: readonly string[]` (`model/policy.ts:1727`), and
   `ManagedServiceRejection['reason']` is a five-member literal union (`:1727-1748`) that passes. M1b
   is a correctly designed mutation and it proves the arm was designed rather than guessed. Same for
   the `Timestamp = string` (`model/kernel.ts:422`) observation behind M2.
6. **No 39th capability, on the right argument.** `mayRetractLearning()`'s own quoted refusal at
   `model/learning.ts:1275-1284`, and every capability the design leans on exists: `view_document`
   (`model/access.ts:4` of the block), `trigger_run` (`:49`), `reverse_resolution` (`:66`),
   `promote_learning` (`:250`); derived total **37** by
   `awk '/^export const CAPABILITIES = \{/,/^\} as const/' model/access.ts | grep -cE '^  [a-zA-Z]+:'`.
   `CAPABILITY_RESOURCE_CLASS.trigger_run = 'configuration'` (`:611`) and `reverse_resolution =
   'tenant_data'` (`:576`), both as cited.
7. **§7d's record correction is real, and so is the ledger duplication behind it.**
   `model/policy.ts:1695` cites `learning.ts:1721` for `DATA_CLASS_RANK`; the declaration is at
   `model/learning.ts:1773` (`grep -n "DATA_CLASS_RANK" model/*.ts`), and `sed -n '1721p'
   model/learning.ts` is blank. The citation resolves, so `check-citations.mjs` is structurally blind —
   inside the comment whose own subject is *"THIS IS THE THIRD COPY IN `model/` AND SAYING SO IS THE
   POINT"* (`model/policy.ts:1693-1704`), and the fourth copy is `mayAdmit()`'s function-local `order`
   at `model/policy.ts:1091`. Green's refusal to add a fifth ladder in `mayRecapture()` is correct and
   is the right call.

Also correct and unbroken, briefly: `ProcedureStepExecution`'s one-live-row rule is quoted verbatim and
correctly (`model/domain.ts:3290-3300`) and a partial unique index is the right mechanism; `ErasurePlan`'s
status vocabulary including `partially_completed` and its `id`/`requestId` split argument transfer
exactly (`model/governance.ts:1959-1979`); and **there must be no cross-run money conservation
post-condition** — the amounts legitimately differ, and a control that fails while the property holds
is the thing `model/reconciliation.ts:9-14` says teaches people to ignore controls.

---

## Reproduce every claim on this page

```bash
# B1
awk '/^export const RETENTION_CLASSES = \{/,/^\} as const/' model/domain.ts | grep -cE '^  [a-zA-Z]+:'   # 13
grep -n "days: Record<RetentionClass, number>" model/domain.ts                                            # 1179
grep -n "kind: 'source_document'" model/governance.ts                                                     # 1773
grep -n "purgeAfter: Timestamp" model/domain.ts                                                           # 1861, 2776

# B2
grep -n "export function resolveManagedService" model/policy.ts                                           # 1781
grep -n "reason: 'feature_not_permitted'" model/policy.ts                                                 # 1727

# B3
sed -n '2194,2200p' model/reconciliation.ts     # requestOrdinal is FIELD 1 of ReaderRequest
grep -n "requestOrdinal: requests.length" model/reconciliation.ts                                         # 2423
grep -n "function jcsSortedKeys" model/canonical.ts                                                       # 123

# B4
grep -n "name: '" tools/check-wire-mirror.mjs                       # five pairs, no ExceptionStatus
grep -c "ExceptionStatus" docs/contracts/capability.openapi.yaml    # 7 refs; enum of 7 at :2344
grep -rn "ExceptionStatus" model/*.ts                               # domain.ts:648,2931,3020 + 2 dropped

# B5
sed -n '1188p;1206p;1221p;1239p;1248p;1285p' model/learning.ts      # six @dropped-for-v1 markers

# S1 · S2 · S3 · S8
grep -n "reason_reserved_to_platform" model/learning.ts
grep -n "cleared on reversal" model/domain.ts
grep -n "carriedForwardFrom" model/domain.ts ; grep -n "exceptionsRaised" model/billing.ts
sed -n '1943p;1946p' model/governance.ts                            # both 'purge' decisions

# green's own claims I verified true
grep -rn "chain: RecordChain" model/*.ts                            # 2
grep -rn "SourceDocument" model/examples.ts | wc -l                 # 0
grep -n "SourceDocument {" tests/model/*.test.ts                    # three construction sites
sed -n '1721p' model/learning.ts                                    # blank
```

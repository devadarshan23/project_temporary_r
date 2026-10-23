# RED — attacking the ingestion residue as a first-class object

*9 Aug 2026. Analysis only: no file in `/Users/jrkphani/Projects/Reconcile` was created, edited or
deleted; no git command was run. Every `file:line` below was opened in this session. Every count
carries the command that derived it.*

**Target:** `/private/tmp/claude-501/.../ingest2/green-residue.md` — `IngestArrival`, `ArrivalRefusal`,
the four total records, migration 0002, the fixtures and the mutation table.

**Counts re-derived in this session, not quoted:**

```bash
ls model/*.ts | wc -l                                   # 18
awk '/^export const CAPABILITIES = \{/,/^\}/' model/access.ts | grep -cE '^  [a-zA-Z]+:'          # 37
awk '/^export const ACCESS_RESOURCE_CLASSES = \{/,/^\}/' model/governance.ts | grep -cE '^  [a-zA-Z]+:'  # 13
grep -n "MODULE_COUNT" tests/model/runtime-importability.test.ts   # :45 :134 :135 :154 :190
```

**Method note.** Two of my attacks are on the **existing tree**, not on the proposal, because this
record's own reviews find defects there and one of them makes an adjudicated control inert. They are
marked *(existing tree)*.

---

## BLOCKER

### B1 — The design's headline fail-closed state has NO ARM. `IngestBound` unconfigured is unrepresentable, and the nearest arm makes the whole pre-configuration backlog permanently dead.

**The claim.** Green's own §3 states the fail-closed property as *"O-8 unstated ⇒ `IngestBound` cannot
be constructed ⇒ **every arrival refuses**"*, and §2.3(ii) repeats it: *"Until they are stated, EVERY
ARRIVAL REFUSES — which is the intended failure."* **`ArrivalRefusal` has no arm that can record that
refusal.** Fourteen arms; the closest is `bound_exceeded { bound: IngestBoundKey; limit: number;
observed: number }`, which **requires a `limit`** — and the whole premise of the state is that no limit
exists.

**Evidence.** The fourteen arms are enumerated in green-residue.md §2.3(iii); the totality of
`ARRIVAL_DISPOSITION_FOR` over `ArrivalRefusal['kind']` (§2.3(iv)) pins the arm count at fourteen.
The discipline being invoked is real and I opened it: `IdentifierNormalisation.maxInputChars`
(`model/reconciliation.ts:381`-ish region, quoted in the adjudication as *"a bound with no number is
not a bound"*), and `PRODUCT.md`'s prohibition on inventing one. The insert path is
`db/migrations/…` shaped: `outcome_kind text NOT NULL` + `CONSTRAINT ingest_arrival_outcome` requires
`refusal IS NOT NULL AND refusal_kind IS NOT NULL` on the refused arm (green §2.8), so there is no
representable third state either.

**Failure scenario, with inputs.** Day one. The owner has not answered O-8, so
`Record<IngestBoundKey, number>` cannot be constructed. `GR-118-20260309-0041.pdf` lands. The worker
must write a row. Three options and all three are defects:
1. **Fabricate** `{ kind: 'bound_exceeded', bound: 'max_object_bytes', limit: 0, observed: 184320 }` —
   invented data on the ledger row a finance user reads, which `CLAUDE.md`'s baseline rule forbids and
   which `ResidueEntry.settlement`'s own docblock (`model/reconciliation.ts:2103-2114`) records this
   codebase already doing once: *"a FABRICATED zero in a fabricated currency, sitting on the one row a
   finance user reads to find out what went wrong."*
2. **Throw** — forbidden by the module's own control `code | grep -c 'throw ' → 0`.
3. **Write no row** — the artefact vanishes. That is Red 1's *"a file no rule matched simply
   disappears"*, i.e. **the exact second inbox with no door this object exists to close**, produced by
   the object's own unconfigured state.

**And option 1 is worse than it looks.** `ARRIVAL_DISPOSITION_FOR.bound_exceeded = 'quarantined'`, and
`ARRIVAL_MAY_BE_REPROCESSED.quarantined = false`. So every artefact that arrived before O-8 was
answered is `quarantined` **forever**: answering O-8 later re-admits none of them, because the one
disposition a configuration change may re-admit is `needs_configuration`. A tenant onboarded before
the bounds are set loses its entire backlog to a table recorded as a safety control.

**The control that closes it.** Add `{ kind: 'bound_not_configured'; bound: IngestBoundKey }` —
text-free, no number, passes `AssertNoTextDeep` — and map it to `needs_configuration`, which is
literally what it is: *a refusal that names a missing human decision*. That is green's own stated test
for the arm. Second, split `bound_exceeded`'s disposition: a breach of a **configured** bound on a
well-formed artefact is `needs_configuration` (the operator may raise the bound), not `quarantined`.
As drawn, one operator typo in `maxObjectBytes` quarantines a month of invoices irreversibly.

---

### B2 — The unique index makes `duplicate_of_earlier_arrival` and `superseded` unrepresentable. C17's silent-overwrite defect is reintroduced as an `ON CONFLICT`.

**The claim.** Green's §2.3(iii) makes the duplicate *"THE DUPLICATE AS A NAMED OUTCOME, AT THE FILE
GRAIN, POINTING AT THE FIRST ARRIVAL"*, and `ARRIVAL_DISPOSITIONS.superseded` exists for it. Migration
0002 then declares:

```sql
CREATE UNIQUE INDEX ingest_arrival_content_key
  ON ingest_arrival (tenant_id, endpoint_id, content_sha256) NULLS NOT DISTINCT;
```

**The second arrival of the same bytes cannot be inserted.** So the `duplicate_of_earlier_arrival` arm
has no writer, `superseded` has no producer, `ARRIVAL_IS_A_PROCESSED_DOCUMENT.superseded` and
`ARRIVAL_MAY_BE_REPROCESSED.superseded` answer a question nothing asks, and
`arrivalCoverage()`'s `superseded` count is structurally always zero — which destroys the one
denominator argument green makes for it: *"`superseded` belongs in 'how many arrived' and not in 'what
is short'"*.

**Evidence.** The index is green §2.8. The requirement it defeats is the adjudication's C17
(`ingest-review-4:265`) and R5(v) (`:126`): *"a duplicate must be a **NAMED OUTCOME** — a refusal or a
finding — never a silent `Map.set` overwrite"*. R5(ii) (`:118`) specifies `INSERT … ON CONFLICT DO
NOTHING` for the row grain.

**Failure scenario, with inputs.** S3 event notifications are at-least-once — green quotes this
itself. `supplier_lines_march.csv`, sha `9c04…`, is delivered twice by the same notification redrive.
Insert 1 succeeds. Insert 2 violates `ingest_arrival_content_key`. The writer does `ON CONFLICT DO
NOTHING` (the only sane thing) and **the second delivery leaves no trace at all**. The engine's
`items.set(item.key, item)` overwrite at `model/reconciliation.ts:2796-2797` — the defect R5(v) calls
the sharpest finding in four reports — has been moved from a `Map` to a unique index and is still
silent. Worse: nobody can now answer *"was this file sent twice?"*, which is the question
`duplicate_of_earlier_arrival` was minted to answer.

**The control that closes it.** Make the index **partial**, so the dedup key constrains only the work
rows and the duplicate row is representable:

```sql
CREATE UNIQUE INDEX ingest_arrival_content_key
  ON ingest_arrival (tenant_id, endpoint_id, content_sha256) NULLS NOT DISTINCT
  WHERE refusal_kind IS DISTINCT FROM 'duplicate_of_earlier_arrival';
```

plus a test asserting the second delivery **inserts a `superseded` row** rather than conflicting —
because the whole point is that `arrivalCoverage()` can distinguish *"fourteen arrived, two of them
twice"* from *"twelve arrived"*.

---

### B3 — The `endpointId` rule is prose the type does not hold, the migration `CHECK` contradicts the pipeline order, and the report's own flagship fixture is rejected by its own schema.

**The claim.** Three statements in green-residue.md cannot all be true:

1. `endpointId` is *"NULL ON EXACTLY ONE REFUSAL ARM — `no_endpoint_resolved` — and on no other"*
   (§2.3(v)).
2. `documentTypeId` is null for *"every F12 arm, **because F12 runs before routing**"* (§2.3(v)).
3. Fixture 3 (§4) carries `endpointId: null`, `storageKey: 'ten_acme/_unrouted/…'`, and
   `outcome.refusal.kind = 'declared_kind_disagrees_with_content'` — an **F12** arm.

If F12 runs before routing (2), then **no** F12 arm can have an endpoint, so (1) is false for six of
the fourteen arms. And the migration enforces (1):

```sql
CONSTRAINT ingest_arrival_endpoint CHECK (
  endpoint_id IS NOT NULL OR refusal_kind = 'no_endpoint_resolved'
)
```

**Fixture 3 — the row this whole object exists for, the quarantined artefact — is rejected by
migration 0002.** It compiles under `tsc` (the type is `EndpointId | null`, unconditionally) and the
INSERT fails. That is the §5.10 shape inverted: the fixture is green, the constraint is red, and the
only witness the design has is the one that violates it.

**Evidence.** Constraint and fixture as quoted above, both in green-residue.md. The type-level hole is
real: `endpointId: EndpointId | null` is a flat field with no correlation to `outcome`, so
`{ endpointId: null, outcome: { kind: 'admitted', sourceDocumentId } }` — an **admitted document with
no endpoint** — is a legal `IngestArrival`. §5.5, in the type the design's own §3 table claims fails
closed.

**Failure scenario, with inputs.** `march_totals.xlsx` (extension says spreadsheet, bytes are a PDF)
lands in a folder no endpoint claims. F12 sniffs, disagrees, quarantines. The writer has one refusal
slot and two true facts. It picks `declared_kind_disagrees_with_content` → the CHECK rejects the row →
the artefact vanishes, which is B1's failure again. Or it picks `no_endpoint_resolved` → the row
inserts and **the content disagreement is lost**, so `ARRIVAL_DISPOSITION_FOR` returns
`needs_configuration`, `ARRIVAL_MAY_BE_REPROCESSED` returns **true**, and a PDF wearing an `.xlsx`
extension is queued for automatic reprocessing the moment someone registers the folder. **The
quarantine inverts to a retry.**

**The control that closes it.** (a) State the pipeline order as a decision — endpoint resolution
happens **before or after** F12 — and derive the null rule from it instead of asserting it. (b) Make
the refusal a **list, ordered by stage**, or make `endpointId` structurally absent on the arms that
cannot have one (G44's own technique, `model/domain.ts:3491-3502`, which green cites for `outcome` and
declines to apply here). (c) Whichever is chosen, the fixture must be the one that would have caught
this: a row that violates the CHECK is not a witness.

---

### B4 — Two of fourteen arms force INVENTED data onto the ledger row, and one of them destroys the distinction `SniffedContentKind` was minted to preserve.

**The claim.** `sanitisedAt: Timestamp` and `sniffedKind: SniffedContentKind` are both non-null, and
green argues the non-nullability *"is DERIVED FROM C20 rather than assumed"*: F12 has no database
reach, so *"the orchestrator writes the row only AFTER the sniff returns"* and *"'Not sanitised yet' is
therefore not a state a row can be in."*

**The arm `sanitiser_did_not_complete` is the state that argument says cannot exist.** The sniff never
returned. There is no `sanitisedAt` and no `sniffedKind`. The same is true of a byte-budget breach: you
measure `objectBytes` before you open the file, so `bound_exceeded { bound: 'max_object_bytes' }`
refuses before any sniff.

**And the fabrication is not cosmetic.** The only value available for `sniffedKind` is `unrecognised`,
whose declaration says in capitals: *"F12 RAN AND COULD NOT TELL. **Not 'we did not look'** — see the
banner."* Writing `unrecognised` for an artefact F12 **died on** collapses exactly the distinction the
member was minted to hold, and `sniffedKind` is *"THE ROUTING KEY"*. The two artefacts that most
deserve to be told apart — the one F12 examined and could not classify, and the one that killed F12 —
become the same row.

**Evidence.** All quotations from green-residue.md §2.3(i) and §2.3(v). The precedent against
fabricating a field to satisfy a non-null: `ResidueEntry.settlement`
(`model/reconciliation.ts:2103-2114`), verified — *"`CLAUDE.md` forbids inventing data; a hand-written
money literal is how it got invented."* Required-and-nullable, never optional, is the stated house
form there.

**Failure scenario, with inputs.** An attacker sends a 40 MB PDF with a recursive object graph that
OOMs the sanitiser. Row written with `sanitisedAt` = the orchestrator's timeout instant (a time
nothing happened at) and `sniffedKind: 'unrecognised'`. A month later somebody asks *"how many
artefacts did F12 fail to classify?"* — the count includes every crash, and the crash population,
which is I7's cost amplifier and the one worth alerting on, is invisible.

**The control that closes it.** `sanitisedAt: Timestamp | null` and `sniffedKind: SniffedContentKind |
null`, required-and-nullable (G102), with the null arm meaning *"F12 did not return"* and a `CHECK`
tying null to the two arms that permit it. That is strictly more honest than a member doing double
duty, and it costs one nullable field each.

---

### B5 *(existing tree)* — `PolicySubject` on the wire and in the model are different unions with different discriminants, `check:wire` does not pin the pair, and the contract claims to mirror the model. Adjudication **C2 would be recorded as applied while being inert.**

**The claim.** The model:

```
model/policy.ts:890  export type PolicySubject =
model/policy.ts:891    | { type: 'run'; runId: RunId }
model/policy.ts:892    | { type: 'exception'; exceptionId: ExceptionId }
model/policy.ts:893    | { type: 'export'; description: string }
model/policy.ts:894    | { type: 'model_call'; model: string }
```

The wire:

```
docs/contracts/foundation.openapi.yaml:891    PolicySubject:
docs/contracts/foundation.openapi.yaml:893      description: Discriminated union. Mirrors PolicySubject in model/policy.ts.
docs/contracts/foundation.openapi.yaml:894      additionalProperties: true
docs/contracts/foundation.openapi.yaml:895      required: [kind]
docs/contracts/foundation.openapi.yaml:899          enum: [exception, run, document, correspondence, procedure_step]
```

**The discriminant is `type` in the model and `kind` on the wire. Three wire members
(`document`, `correspondence`, `procedure_step`) exist in no model arm; two model arms (`export`,
`model_call`) exist nowhere on the wire.** The description asserts a mirror that the model refutes —
§5.4 and §5.6 in one line. And `tools/check-wire-mirror.mjs` pins exactly five pairs —
`subject_location` (`:74`), `live_policy_kind` (`:79`), `service_notice_kinds` (`:89`), `meters`
(`:94`), `retention_classes` (`:99`) — **`policy_subject` is not among them**, so nothing has ever
compared these two lists.

**Why it is a BLOCKER for this feature and not a footnote.** The adjudication's **C2**
(`ingest-review-4:210`) rules: *"`PolicySubject` gains a managed-service arm… Add `{ type:
'managed_service_call'; service: string; feature: string }`. Red 1 alone found this and it is a real
hole."* Adding a fifth arm to the model union leaves the wire — where `additionalProperties: true` and
`required: [kind]` mean **anything with one of five wrong `kind` values is accepted** — untouched and
unchecked. C2 gets ticked, and a Textract call still cannot produce a `PolicyEvaluation` through the
documented API. **This is the G75 shape exactly: a third list nobody named makes a ruling a no-op.**

**Failure scenario, with inputs.** A data-plane client POSTs `/policy/evaluate` (op at
`docs/contracts/foundation.openapi.yaml:160-181`, `required: [action, subject]`) with
`subject: { kind: 'document', documentId: 'doc_1' }`. The contract accepts it. The model cannot
represent it, so the server either coerces it to some arm or 500s. Conversely the shape the model
expects — `{ type: 'model_call', model: '…' }` — **fails the contract's `required: [kind]`**. The one
`PolicySubject` arm that carries the live invariant-7 bypass (`model_call.model`, named in
`CLAUDE.md`'s own table) is unreachable through the documented API.

**The control that closes it.** Add a sixth pair to `tools/check-wire-mirror.mjs` — `policy_subject`,
`{ source: 'union', name: 'PolicySubject' }` against `['properties','kind','enum']` — **before** C2 is
implemented, so C2's landing commit goes red until both sides move. Then decide the discriminant
once (`kind` or `type`, not both — §5.3) and set `additionalProperties: false` as every other request
schema on that file does.

---

## SERIOUS

### S1 — `arrivalErasureDisposition()` is keyed on admittedness, which is a landmark, not on the existence of a `SubjectIndexEntry`, which is the property. It fails OPEN — and green's own §0(b) argues the proxy is false.

**Evidence.** `ARRIVAL_ERASURE_REACH.admitted = 'indexed_via_source_document'`, and
`arrivalErasureDisposition()` returns `defer_to_purge_verdict` for it. But `SubjectIndexEntry`
(`model/governance.ts:1868-1874`: `id`, `subjectRef`, `location`, `dataClass`, `recordedAt`) is
*"Written at CREATION time, not discovered by scanning"* (`:1743-1746`) — **per classified value**, by
a writer. Admittedness does not imply that any writer ran. And green's own §0(b) asserts that no
`SourceDocument` blob is registerable at all today.

**Failure scenario.** Arrival `arr_01j9f2q7` is admitted; the extraction writer never calls
`POST /subject-index/register` (`docs/contracts/foundation.openapi.yaml:305`, `operationId:
registerSubjectLocation` — an operation with no implementation anywhere in this repository). A subject
request arrives. `arrivalErasureDisposition()` returns `defer_to_purge_verdict`; the plan reports a
purge over a blob nothing addresses. The residue's honest arm — `out_of_reach`, which
`model/governance.ts:1954-1957` exists for and which green quotes correctly — fires for the four
dispositions where it is least needed and never for the one where the reach is unproven.

**The control.** Key the function on the property: `arrivalErasureReach(arrival, indexEntryExists:
boolean)` is the wrong shape (§5.2, a caller-supplied switch). The right shape is a third union member
— `'indexed_if_registered'` — that resolves to `out_of_reach` **until a registration is observed**,
i.e. fail-closed in the direction `DENY_ALL` and G100 already point.

### S2 — `arrivalBlobLocation()` has no reachable call site, is refuted by the capability contract's own ruling, and is the single place this design constructs counterparty text into a wire schema.

**Evidence, three parts.**
1. **No caller for the non-admitted case.** `registerSubjectLocation` requires `subjectRef`
   (`docs/contracts/foundation.openapi.yaml:325-331`, `required: [subjectRef, location, dataClass]`),
   and green's own §2.5 proves there is no subject to HMAC for a non-admitted arrival. So the function
   cannot be called for the rows it was written for.
2. **The contract has already ruled the admitted-adjacent case.** `docs/contracts/capability.openapi.yaml:155-159`:
   *"An upload that is never completed leaves a blob with a lifecycle rule and no row; that blob
   carries no classified value because nothing has extracted it, so **it owes no SubjectLocation. This
   is the one case where an unregistered blob is correct, and it is correct only because it is
   unread.**"* An unread arrival is that case. Green's §0(b) presents this as an unowned defect and
   **does not cite the paragraph that rules it** — §5.4, in the report rather than the tree.
3. **The `blob` variant's own comment strikes the §0(b) premise.** `model/governance.ts:1780-1784`:
   *"purging a SourceDocument row **cascades to its own object through storageRef**, but an export
   contains whatever the export contained and no row addressed it."* The variant exists for artefacts
   **no row addresses**. A `SourceDocument`'s blob is reached through the row; so is an arrival's,
   because the arrival **is** a row with a storage reference. So the two-field split is not required
   for erasure — it is required only to construct a variant nothing needs to construct.

**Failure scenario.** `arrivalBlobLocation()` gets a caller anyway (a function that exists gets
called). It emits `{ kind: 'blob', bucket: 'acme-landing-ap-southeast-1', key:
'ten_acme/ep_sharepoint_gr/2026/03/09/GR-118-20260309-0041.pdf' }` — **the counterparty filename,
inside a wire schema declared `additionalProperties: true` with only `kind` required**
(`docs/contracts/foundation.openapi.yaml:917-920`). The design proved `ArrivalRefusal` text-free at
compile time and then shipped the filename across an API boundary in the one function that leaves the
module.

**The control.** Delete the function, keep `storageBucket`/`storageKey` (they are still the right
shape for a purge job), and record §0(b) as **struck** with the two citations above. If the function
survives, `AssertNoTextDeep` must be applied to whatever crosses out and `storageKey` must be a
content-addressed path that contains no filename — the same argument green makes for
`IngestArrivalId`, applied to the field that actually carries the text.

### S3 — `ARRIVAL_MAY_BE_REPROCESSED` is keyed on the disposition, not on whether reprocessing crosses a paid boundary. I7's cost amplifier survives the table claimed to make it executable — and there is no attempt counter anywhere.

**Evidence.** `needs_configuration` is the one `true`, and `ARRIVAL_DISPOSITION_FOR` maps **six** arms
to it: `encrypted`, `no_endpoint_resolved`, `no_document_type_resolved`, `document_type_ambiguous`,
`no_promoted_mapping`, `promoted_mapping_header_set_drift`. Green's justification is that this arm's
refusals *"name a missing human decision rather than a hostile or broken artefact."* `encrypted` is not
a missing human decision on our side, and none of the six says anything about **cost**.

**Failure scenario, with inputs.** A sender drops 10,000 raster TIFFs into a registered SharePoint
folder whose `DocumentType` is ambiguous between two installed packs.
`document_type_ambiguous` → `needs_configuration` → reprocessable. An FDE resolves the ambiguity three
days later. All 10,000 are automatically reprocessed and, being `raster_image`
(*"Fidelity `scanned`, always"*), every one goes straight to tier 4 Textract. The escalation to the
most expensive tier was chosen by the sender and triggered by an unrelated configuration change. That
is I7 verbatim — *"Cost must never be the escalation trigger for an error"* — and the table green
calls *"the executable form of adjudication I7"* returned `true` for all of it.

Second half: `encrypted` → reprocessable → **it will refuse again, identically, forever**. The row
carries no `attemptCount` and no `lastAttemptedAt`, so nothing bounds the loop and nothing shows an
operator that it is looping.

**The control.** Key the gate on the property. `MAY_REPROCESS_FOR: Record<ArrivalRefusal['kind'],
ReprocessTrigger>` where `ReprocessTrigger` is a reasoned union — `'never'` |
`'on_mapping_promotion'` | `'on_endpoint_registration'` | `'on_document_type_resolution'` — so a
reprocess is triggered by **the specific configuration act that removes the specific reason**, never
by "a configuration changed". Then add `attempts: number` to the row and refuse above a stated bound
(O-8's discipline). And return the trigger, not a boolean: a `false` that cannot say why is §5.2, and
this row's whole job is telling a person what to do.

### S4 — `ARRIVAL_MAY_BE_REPROCESSED.admitted = false` plus the one-way transition rule makes the correction path — adjudication §8 item 3 — structurally forbidden rather than merely undesigned.

**Evidence.** `ARRIVAL_MAY_BE_REPROCESSED.admitted = false`; §2.3(v): *"ONE TRANSITION IS PERMITTED AND
ALL OTHERS ARE NOT. `refused` → `admitted` … `admitted` never becomes `refused`."* The adjudication
(`ingest-review-4:346`): *"A mapping found wrong after the fact means every document parsed under it
is wrong… C8 makes the blast radius **enumerable**; nothing makes it **fixable**, and nobody
noticed."*

**Failure scenario, with inputs.** A promoted mapping binds a **running-balance** column to
`binding.spec.amount` — A4's scenario, verified live at `model/reconciliation.ts:976` per the
adjudication. 4,000 arrivals admit under it and match. Someone notices. There is now **no
representable state** for those 4,000: they are `admitted`, they may not be reprocessed, and the type
rule forbids returning them to `refused`. The ledger's answer to *"which arrivals are wrong"* is
*"none, they all succeeded."*

**The control.** Either a third outcome arm — `{ kind: 'withdrawn'; supersededByArrivalId }`, keeping
the original row as a tombstone and admitting a **new** arrival row for the re-parse — or an explicit
`ARRIVAL_MAY_BE_REPROCESSED.admitted = 'only_under_mapping_withdrawal'` in the reasoned-union form S3
asks for. The row already carries no `mappingVersionId` (C8 puts it on `SourceDocument`), so the blast
radius is not even enumerable from the arrival side; adding it here is one nullable field.

### S5 — The migration stores `disposition` and `refusal_kind` as columns, which the module header calls a defect in capitals; and `refusal jsonb` defeats `AssertNoTextDeep` at the exact layer where a parser message lands.

**Evidence.** §2.3(iv), on `ARRIVAL_DISPOSITION_FOR`: *"⚠️ **THE DISPOSITION IS NOT A FIELD ON THE ROW,
AND THAT IS DELIBERATE.** It is derived from the refusal and from nothing else, so storing it beside
the refusal would be two copies of one fact with nothing keeping them agreed — §5.3 at the smallest
scale."* §2.8, sixteen lines later: `disposition text NOT NULL, -- written from arrivalDisposition(),
never by hand`, plus `refusal_kind text, -- the discriminant, lifted for indexing`, and
`CREATE INDEX ingest_arrival_register ON ingest_arrival (tenant_id, solution_id, arrived_at DESC,
disposition)`. **Both duplicates exist, both are indexed, and "never by hand" is a review
convention** — the thing `AUTHORIZATION_MAY_BE_ABSENT`'s docblock (`model/governance.ts:1198-1203`,
which green cites approvingly) says is *"a rule that nothing enforces and every writer interprets for
itself."*

**Failure scenario.** A repair script updates `refusal` (say, re-classifying a batch of
`no_document_type_resolved` after a pack fix) and forgets `disposition`. The register query reads
`disposition`; `arrivalDisposition()` reads `refusal`. The screen says `needs_investigation`, the code
says `needs_configuration`, and the reprocessing loop and the operator disagree about the same row
with no error anywhere.

**Second half, and it is the more serious one.** `refusal jsonb` means the containment proof
`_ArrivalRefusalHoldsNoTextDeep` constrains the **TypeScript type** and nothing else. The column
accepts `{"kind":"sanitiser_did_not_complete","detail":"zlib: invalid distance too far back"}`. M4
proves the type bites; **nothing proves the column does**, and the row is what a log line, a screen and
a support ticket are rendered from. Invariant 6's containment ends at the ORM.

**The control.** `refusal_kind text GENERATED ALWAYS AS (refusal->>'kind') STORED` and
`disposition text GENERATED ALWAYS AS (…CASE over the fourteen…) STORED` — then the duplicates cannot
drift because the database derives them. For the jsonb: a `CHECK` restricting
`(SELECT array_agg(k) FROM jsonb_object_keys(refusal) k)` to the permitted key set **per kind**, plus a
sixth `check-wire-mirror` pair mirroring `ArrivalRefusal`'s arms against that CHECK — G108 says a new
checker joins `npm run check`, and this is the checker that makes the compile-time proof reach the
storage layer.

### S6 — There is no declared `Record<SniffedContentKind, AcquisitionFidelity>`, so the routing correspondence — the one place the counterparty extension could sneak back in — lives only in doc comments. And `spreadsheet` defined as "a ZIP container of parts" cannot be sniffed apart from DOCX, ODT or a plain ZIP.

**Evidence.** `SNIFFED_CONTENT_KINDS`' members carry their tier in **prose**: *"Fidelity `tabular`"*,
*"Fidelity `scanned`, always"*, *"Fidelity `structured`"*. `unrecognised` and `archive` carry none.
`AcquisitionFidelity` is verified at `model/domain.ts:1782` (`ACQUISITION_FIDELITY`, alias at `:1793`).
Green's own §5.3 defence is that the two unions are different axes — which is right, and which is
exactly why the **join** between them must be a total record. The design mints neither the record nor
a function.

**Failure scenario, two inputs.**
1. A `.docx` purchase order arrives. Its magic bytes are `PK\x03\x04` — identical to `.xlsx`, `.ods`,
   `.jar` and any zip. Distinguishing them requires reading the container's internal part names, which
   the design neither specifies nor forbids. So either every DOCX sniffs as `spreadsheet` and routes
   to `tabular` (a Word document handed to a CSV mapper), or the sniffer falls back to
   `declaredKind` — **the counterparty-controlled extension**, which §2.3(i) says in capitals it
   refuses to route on. §5.1: keyed on a convenient landmark (the container format) instead of the
   property (what the document is).
2. An `archive` arrives. No fidelity is declared for it anywhere, so the first engineer picks one, and
   the choice determines whether `maxArchiveDepth` or `maxRows` applies.

**The control.** `export const FIDELITY_FOR_SNIFFED_KIND: Record<SniffedContentKind,
AcquisitionFidelity | 'no_tier'>` constructed in the module — total, so `unrecognised` and `archive`
must be answered, and `'no_tier'` is the honest answer that routes to `quarantined`. Then split
`spreadsheet` into what the bytes can actually distinguish, or state the part-name inspection as part
of F12 and give the ambiguous ZIP its own member.

### S7 — No capability and no resource class names an arrival, so §7's invariant-10 claim is unsatisfiable — and the only capability that plausibly reaches it is `view_document`, which is the one thing the design insists an arrival is not.

**Evidence.** `awk` over `CAPABILITIES` returns **37** members (list opened in full); none names an
arrival, an artefact, an upload or a residue. `CAPABILITY_RESOURCE_CLASS` maps `view_document` →
`tenant_data` (`model/access.ts:559`). The thirteen resource classes are verified
(`ACCESS_RESOURCE_CLASSES`, `model/governance.ts`). Green's §7 asserts invariant 10 is honoured:
*"reading an arrival is a `DataAccessEvent` carrying an `AuthorizationGrantId`"*. A grant is minted by
`authorize()` against a **capability**; there is no capability, so there is no grant, so there is no
well-formed `DataAccessEvent` — `authorizationIsWellFormed()` (`model/governance.ts`, referenced at
`model/domain.ts:3977`) is the executable form of that rule and the actor kind here is not `system`
(`AUTHORIZATION_MAY_BE_ABSENT`, verified: `user:false, partner_staff:false, platform_staff:false,
agent:false, system:true`).

**Failure scenario.** The residue list ships. The engineer reaches for the nearest capability,
`view_document`. Now **every user who can view documents can enumerate every unrouted filename in the
tenant's landing prefix** — including files dropped in the wrong folder by another department, whose
`filename` is counterparty-controlled text and whose contents G106 declares unreadable. The design's
own banner says the bytes are unreadable by anything; nothing says the **metadata** is governed at all.

**The control.** Mint capability 39 — `view_arrival` — classed `tenant_data`, in the same commit, and
take the `CAPABILITY_RESOURCE_CLASS` / `DELEGABLE_TO_AGENT` compile errors as G128 records them
biting. The adjudication already minted 38 (`promote_field_mapping`) for the mapping act; reading the
residue is a second act and it was missed by both the adjudication and the green design.

### S8 — The visibility answer is not computable by this design, on the design's own findings. C19 remains open, and the argument rests on re-interpreting an illustrative mockup figure.

**Evidence.** `Mockups/rec/Close.dc.html:196` — opened — is
`{ label: 'Coverage', value: '99.2%', tone: INK }`, one of three `figures` beside
`{ label: 'Matched', value: '1,806' }` and `{ label: 'In variance', value: '₱112,204' }`, inside a
register whose header is a single run (`:82`, and the rows at `:198-204` are that run's bands A–E).
`grep -rn "Coverage\|coverage" Mockups/rec/Close.dc.html` returns **exactly that one line** — the
figure has no definition anywhere. Green asserts *"coverage needs a denominator and the denominator is
arrivals."* Two readings are at least as plausible and both are computable inside the existing model:
matched lines over admitted lines (1,806 over the run's population), or matched value over total
value.

**Then the design refutes itself.** §6 item 3, verified at the tree: *"Nothing joins an `Endpoint` to a
`ReconciliationDefinition`"* — `Solution` holds `endpointIds` (`model/domain.ts:2624`) and
`definitionIds` as flat arrays with no join. And §6 item 8: *"`arrivalCoverage()` has no notion of a
period."* So the function **cannot** compute a per-run figure, and the figure at `:196` is per-run.
The sole answer offered to C19 — *"it is the register's own third figure"* — is unavailable, O-9 is
open, and the object as specified has **no drawn surface at all**. A residue with a row and no reader
is still a second inbox; the door is what was missing.

**Also.** `PRODUCT.md` forbids presenting in-product figures as results and green says so itself
(*"`99.2%` on the mockup is illustrative data"*) — then makes a structural design decision rest on
what that illustrative figure means. §5.1 at the level of the whole design.

**The control.** Either take O-9 first and let the surface decide the shape, or state the coverage
figure's definition as a **product decision** (with the owner), and make `arrivalCoverage()` take the
selection it counts over as an explicit named window — which it already almost does — while dropping
the claim that it computes anything drawn.

### S9 — `Record<IngestBoundKey, number>` puts seven counts and one dimensionless ratio in one numeric type. That is §5.7, and it is a regression against C4 as adjudicated.

**Evidence.** `INGEST_BOUND_KEYS` = `max_object_bytes`, `max_decompressed_bytes`,
`max_compression_ratio`, `max_pages`, `max_rows`, `max_cell_chars`, `max_archive_depth`,
`max_rows_per_transaction`. Green argues the key-set form is *"a CONTRIBUTION to C4, not a duplicate
of it, and the difference is TOTALITY"*. It is, and it costs the units: C4's eight **named fields**
(`ingest-review-4:214`) let each carry its own type; one `Record<K, number>` makes every bound the
same type, and `bound_exceeded { bound, limit, observed }` carries `number` for both.

**Failure scenario.** `checkBound('max_compression_ratio', bounds, observedBytes)` compiles. A ratio of
`100` is compared against a decompressed byte count; the breach never fires and a zip bomb passes the
one bound written to stop it. Nothing in the type system objects, and `bound_exceeded` reports
`{ limit: 100, observed: 41943040 }` — a refusal that reads as a byte breach.

**The control.** Keep the totality and restore the units: `IngestBound = { [K in IngestBoundKey]:
BoundValue<K> }` with `BoundValue` mapping each key to a distinct branded numeric (`Bytes`, `Rows`,
`Ratio`, `Depth`, `Chars`), so a ratio and a byte count are not interchangeable. The precedent is
`Money.amountMinor` being `bigint` behind one codec (G111) for exactly this reason.

### S10 — Nine header greps are presented as controls over zero call sites, and the one green calls load-bearing does not match its own mutant.

**Evidence.** §2.3's header lists nine `code | grep -c …` controls. §5's M19 says of adding
`chargedMinor: bigint`: *"**Nothing goes red** … The header control `code | grep -c
'\.cost\|amountMinor\|Money' → 0` catches it, and that control is **honour-system**."*

**The mitigation is factually wrong.** The string `chargedMinor: bigint` contains no `.cost`, no
`amountMinor` and no `Money`. **The control does not catch M19's own mutant.** So the invariant-5
protection green describes as the one that *"costs something"* is a grep that fails on the first
example given for it — a control that passes while asserting nothing (§5.6), inside a mutation table
written to prove the controls bite.

**Failure scenario.** An engineer adds `feeMinor`, `textractCents` or `chargedMinor` to the row. Nine
greps stay 0, `tsc` stays green, `npm run check` stays green, and a derived money figure is now on a
content row — which green's own header says would *"make a pricing change rewrite history."*

**The control.** One checker, `tools/check-ingestion-controls.mjs`, joined to `npm run check` per
G108, asserting all nine properties over the comment-stripped source — and for invariant 5 assert the
**property**, not three spellings: no field name matching `/(minor|cents|cost|price|charge|fee|amount)/i`
on `IngestArrival`. A grep over a hand-picked vocabulary is §5.1 in a shell one-liner.

---

## NOTED

### N1 — `MODULE_COUNT` is two literals, not one, and the citation is off by one.
`grep -n MODULE_COUNT tests/model/runtime-importability.test.ts` → `:45` (the declaration, **not
`:44`** as green states), `:134`, **`:135` — `assert.equal(MODULE_COUNT, 18)`**, `:154`, `:190`.
Green's *"one line moved: `MODULE_COUNT = 18` → `19` in … `:44`"* leaves `:135` red. Trivial to fix,
and it is the class of miss this record punishes by name.

### N2 — `object_bytes bigint` read into `objectBytes: number`, with no codec named.
Migration 0002 declares `object_bytes bigint NOT NULL`; the model field is `number`. `pg`'s default
`int8` handling returns a **string** unless a type parser is configured, which nothing here does — so
the value that reaches `bound_exceeded`'s comparison is of an unstated type. This is the shape **G111**
took a whole module for on `Money`; the ruling was one codec per boundary, and the same boundary is
crossed here with none. Verify the driver behaviour before writing the reader; do not assume either way.

### N3 — A re-delivered file would carry its own `purgeAfter`, which is the two-clocks defect the retention argument was built to prevent.
`ARRIVAL_RETENTION_CLASS`'s deciding argument is *"THE SAME BYTES MUST NOT GET TWO PURGE DATES."* A
`superseded` row for the same `content_sha256` is minted at its own `arrivedAt` and derives its own
`purgeAfter`, so identical bytes get two dates — produced by a redrive rather than by a parser, which
is the same class of accident. Moot only while **B2** stands (the row cannot be inserted at all); if
B2 is fixed as recommended, this must be fixed with it — a `superseded` row inherits the earlier
arrival's `purgeAfter`.

### N4 — `IngestArrival` is fully mutable, including `tenantId`.
`interface IngestArrival extends TenantScoped` with no `readonly` anywhere, argued from
`SourceDocument`'s precedent (`model/domain.ts:1840-1864`, verified — also mutable). Accepted for the
lifecycle fields. But `tenantId` on a row whose entire isolation story is invariant 1 and an RLS
predicate should be `readonly` regardless of the rest; `TenantScoped`'s own comment
(`model/kernel.ts:436-440`) is *"this field records the scope an authenticated session already
established, it does not select one"*, and a mutable field is a field something can select.

### N5 — a third table over `documents_processed` semantics already exists, in a dropped module.
`model/presentation.ts:403` declares `documentsProcessed: 'documents_processed'`, `:460` maps
`documents_processed → 'view_document'` (the capability that governs reading it) and `:492` gives it
aggregations `['count','sum']` where `METER_AGGREGATION` (`model/billing.ts:106`) says `'sum'`.
`presentation.ts` is `@dropped-for-v1` whole so nothing is live, but if O-9 produces a surface, the
capability governing a residue figure is `view_document` — see **S7**.

---

## WHERE THE GREEN TEAM IS RIGHT AND I COULD NOT BREAK IT

1. **The denominator argument is the design, and it is correct.** *"THE ROW EXISTS FOR EVERY ARRIVAL,
   INCLUDING THE SUCCESSFUL ONES… A table holding only failures IS the second inbox C19 exists to
   refuse."* I tried to argue a failures-only table is cheaper and it is not: without the successes
   there is no *"out of how many"*, and every question a person asks of a residue is a ratio. This is
   the insight the adjudication asked for and nobody else produced.

2. **`AssertNoTextDeep<ArrivalRefusal>` genuinely compiles and genuinely bites. I attacked the proof
   and could not break it.** I opened the implementation
   (`model/reconciliation.ts:247-258`): `NoTextField<T> = string extends T ? never : T extends string ?
   T : T extends readonly (infer U)[] ? … : T extends object ? … : T`. So `string` is rejected;
   branded `Id<'X'>` passes through the second arm (the comment at `:241-243` says that arm is
   load-bearing for exactly this); a closed literal union passes; `readonly DocumentTypeId[]` recurses
   through the array arm. And the mapped type is homomorphic, so it distributes over the union — which
   the existing `_MoneyRefusalHoldsNoText` and `_ResidueCauseHoldsNoText` (`:2098`) already witness. So
   `document_type_ambiguous { candidates: readonly DocumentTypeId[] }` and
   `declared_kind_disagrees_with_content { declared, sniffed }` both pass, and M4/M4b would both go
   `TS2344`. **The claim "no parser message is representable" is true at the type level.** My attack
   is only that the type is not the storage (S5).

3. **Deriving the disposition from the refusal alone, and the contrast drawn with `ResidueEntry`, is
   exactly right.** I checked the counter-example: `dispositionFor(side, cause)`
   (`model/reconciliation.ts:2121-2127`) does take two arguments, so `ResidueEntry.disposition` being a
   stored field genuinely is not an inconsistency. That is a careful reading, not a convenient one.

4. **The retention answer survives every attack I made on it.** No fourteenth `RetentionClass`;
   `source_document` verified as a member (`model/domain.ts:1087`); `RETENTION_RECORD_KIND.source_document
   = 'content'` (`:1136`); the wire pair pinned at `tools/check-wire-mirror.mjs:99-100`; and
   `RETENTION_CLASS_FOR` in `learning.ts` is a real precedent for the shape. The two-clocks argument —
   *"one artefact would have two purge dates depending on whether a parse succeeded"* — is the correct
   deciding ground, and typing the table `RetentionClass` rather than a local union is right for the
   reason cited. My only residue is N3.

5. **"Zero new audit machinery" is correct, and I tried hard to refute it.** I suspected the wire closed
   `subjectType` to an enum. It does not: `AuditEvent.subjectType: string` (`model/domain.ts:3982`) and
   `DataAccessEvent.subjectType: string` (`model/governance.ts:1178`) are both bare with the argument
   stated at both sites, and the five-member enum I found nearby
   (`docs/contracts/foundation.openapi.yaml:899`) is `PolicySubject`, not a subject type. So the
   **row shape** for auditing an arrival needs nothing new. The authorisation half is S7, which is a
   different gap.

6. **Invariant 5 is handled correctly and the reasoning is the record's own.** No money field; the
   `METERS` docblock says what green quotes (`model/billing.ts:70-74`, verified: *"every meter is
   something a customer can verify independently, and something we would defend in a dispute"*); and
   `EngineMeter` (`model/reconciliation.ts:220-224`) excludes `documents_processed`, so
   `ARRIVAL_IS_A_PROCESSED_DOCUMENT` is genuinely new territory rather than a second vocabulary. My
   attack is on the grep that guards it (S10), not on the position.

7. **§0(a) is correct, materially useful and honestly stated.** `ls db/` returns `env.ts migrate.ts
   migrations pg.d.ts pg.ts provision.ts tenant-scope.ts`; `db/pg.ts:1-30` says in its own words *"G98
   rules `pg`, pinned exact, as a devDependency. **It is not in `package.json` yet**"*; and
   `package.json` `devDependencies` are `@types/node` and `typescript` only. So `CLAUDE.md`'s *"There is
   no database, no schema, no migration"* is false and the adjudication's build-order item 8 is partly
   done. Green found this while designing and reported it first, which is the behaviour this record asks
   for.

8. **The band D reading is right, and the mockup proves it.** `Mockups/rec/Close.dc.html:203` carries
   `amt: '11,420.00'`, `status: 'Below the 90% floor'`, `action: 'You classify'`, inside the run
   register. Dockets that were read, at a confidence, inside a run. Band D is not where a never-routed
   artefact goes. (Where it *does* go is S8.)

9. **The self-correction in M8 — "three reds, and the third is `check:wire`, not a `tsc` error" — is
   the discipline.** A mutation report that overstates its own reds is §5.6, and green caught itself
   mid-table. I found the opposite defect in M19 (S10), which is why the M8 correction matters: the
   habit is there, it just did not run everywhere.

---

## THE ONE-PARAGRAPH VERDICT

The object is right and the ledger argument is the best thing in either report: one row per arrival
including the successes, a text-free refusal union with a proof I could not break, a disposition
derived rather than stored, and a retention answer that costs the record nothing. What it is not yet is
**buildable**, and for a specific reason that recurs in five of my findings: the design was written at
the type layer and the type layer is not where three of its load-bearing controls live. The fail-closed
state it advertises has no arm to record it (B1); the named duplicate outcome it requires cannot be
inserted (B2); the null rule it states is prose the type does not hold and the migration contradicts
(B3); two arms force invented data (B4); and the containment proof stops at a `jsonb` column (S5). Add
one adjacent defect in the existing tree that would make the adjudication's own C2 inert (B5), and the
honest build order is: answer O-8 and O-9 **first**, fix the four representability holes, add the
`policy_subject` wire pair, and only then land the module — with capability 39, because right now
nothing in the model authorises reading the thing at all.

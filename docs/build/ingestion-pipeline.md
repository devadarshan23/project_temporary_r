# Ingestion — the multi-tiered pipeline, adjudicated

> **STATUS:** AN ADJUDICATION, dated. **WORKING MATERIAL · V1 AUTHORITY: NO**, like everything else
> in `docs/build/` — an input to decisions, never a decision. **Nothing in it is applied**: at the
> time of writing **no line of this exists in the tree** beyond the two pieces named in §2, and
> **no G number has been taken on any of it.** Where this document and a G row disagree, the G row
> wins; `docs/HANDOFF.md` §3 outranks it on every subject.
> 🛑 **§7 lists eight rulings that are the owner's, and the pipeline should not be built past step 2
> of §6 without O-1 and O-5.**
> **Written 9 Aug 2026, evening, from the adjudication of that morning.** The proposal is the
> product owner's; the review is four independent agents; the rulings below are the adjudicator's
> except where marked **OWNER**.
>
> ⚠️ **Every `file:line` here was RE-DERIVED at commit `f988f2a4`, and that mattered.** The
> adjudication was six hours old and **eight of its citations had already moved** — the tree took
> G123, G127, G128, G130, G131 and `resolveManagedService()` underneath it. The old numbers are
> recorded beside the new ones in §9 rather than quietly replaced, because *a citation that drifted
> from one real line to another real line is invisible to `tools/check-citations.mjs`* — the class
> `docs/HANDOFF.md` §7 records, now with a ninth instance.

---

## 0. Reproduce every claim on this page

Nothing below should be believed because it is written down. The four that carry the argument:

```bash
# 1. The four tiers are already declared. They are not this proposal's idea.
grep -n 'ACQUISITION_FIDELITY' model/domain.ts                    # :1782

# 2. The residency check for the expensive tier exists and NOTHING CALLS IT.
grep -rn 'resolveManagedService' model/*.ts                       # policy.ts:1781 — declaration only
grep -rn 'allowedFeatures\|maxDataClassToService' model/*.ts \
  | grep -v examples.ts                                           # policy.ts only: no reader

# 3. The field three documents assert does not exist.
grep -rn 'actualFidelity' model/*.ts                              # zero

# 4. A duplicate row is silently eaten, and conservation cannot see it.
sed -n '2835p' model/reconciliation.ts                             # items.set(item.key, item)
sed -n '2699,2703p' model/reconciliation.ts                        # admittedMinor over that same map
```

---

## 1. The design, on one page

Named with the vocabulary that already exists. **Do not coin a fifth tiering** — §5.3 is the defect
shape this record has seen recur most.

```
ARRIVAL          S3 landing object, tenant prefix as the FIRST path segment
                 (so an IAM condition on s3:prefix is expressible)
                 → tenant RESOLVED from the prefix registry, never carried
   ↓
F12 SANITISE     mandatory, BEFORE any tier. Isolated: no credentials, no network
                 egress, no database reach. Strip active content · normalise
                 encoding · strip metadata · structural rejection · size and
                 nesting limits (IngestBound, required, refusing on absence)
                 → content-SNIFFED type. The extension is a HINT that is recorded
                   and COMPARED; disagreement quarantines.
   ↓
THE LADDER — absorbing, one-way. The first tier that yields an ADMISSIBLE parse wins.
   structured    API · Peppol · EDI                     parsed, no model
   tabular       CSV · spreadsheet, against a PROMOTED MAPPING   parsed, no model
   digital_text  native text layer      + admitTextLayer() gate
   scanned       Textract (primary)  |  Bedrock vision (fallback)
                 ↑ ONE gateway, TWO checks, NO third way:
                   resolveManagedService()  |  resolveModel({requireVision:true})
   ↓
OBSERVE          FidelityObservation → SourceDocument.actualFidelity
                 + fidelityBasis + fidelityDowngrade + mappingVersionId
   ↓
SHRED            inside the worker, in file order, ONE transaction under
                 withTenantScope(). One SourceDocument; lines[] with a MINTED
                 index. ON CONFLICT DO NOTHING.
   ↓
RESIDUE          quarantine population, visible in the same list as everything
                 else — never a second inbox

OFF THE DATA PATH, AT SOURCE ONBOARDING, ONCE PER DISTINCT SCHEMA:
   probe (deterministic, no model) → ObservedSchema + ColumnProfile
   → MapperRequest, ONE PER COLUMN → MapperVerdict (indices only)
   → SchemaMappingProposal (inert)
   → promote_field_mapping  [authority]  → the mapping that makes `tabular` real
```

**Two properties inherited from the reconciliation engine, and naming the rhyme is not decoration —
it is what makes a wrong text layer detectable at all.**

1. **The ladder is absorbing and one-way**, like `fully_allocated` in the match ladder. No later
   tier reopens a document that already parsed.
2. **Every rung records WHICH RUNG produced the value, and a lower rung's output is never presented
   as a higher rung's.** That is G105's *"a match and a judgement must not be recorded as the same
   kind of event"* one layer earlier. Today a document that passed at tier 2 and one that reached
   tier 4 are **indistinguishable downstream**, while the reconciliation ladder by contrast records
   `PairingEvidence`, `ResidueCause` (`model/reconciliation.ts:2080`) and a logged fall-through.
   The ingestion cascade owes the same and has not paid it.

**And the mapper is NOT a tier. It is a SEAM the caller fills** — exactly as the reader is not a
`PairingStrategy`. Ship `notImplementedMapper` as the honest default, in the shape of
`notImplementedReader` (`model/reconciliation.ts:2364`), with a header sentence saying the seam is
unbuilt. **G118 is the standing warning:** a typed seam plus a compile-time proof reads to a
newcomer as a shipped feature, which is why *no document may describe the reconciliation engine as
having an LLM path until an executor exists*. The same sentence now governs this module.

---

## 2. What already existed — the cascade is not a new idea here

**The four steps are `ACQUISITION_FIDELITY` (`model/domain.ts:1782`)**, declared 5 Aug and never
implemented: `structured` / `tabular` / `digital_text` / `scanned`, one for one with the proposal.
`docs/prompt-injection-posture.md:191` had already drawn the operational consequence in nearly the
proposal's own words — *"Extraction should branch on fidelity, not run one pipeline … Building one
pipeline that always calls a model is the expensive mistake."*

So the question was never whether to build a cascade. **It is whether this is the right
implementation of one the record already declared.** Two of the five steps are unsafe as drawn —
the per-row queue and the per-file LLM mapping — one economic claim must not be quoted, and the
single highest-value control in the design is not in the proposal at all.

**Two pieces are in the tree, and exactly two:**

| | Where | State |
|---|---|---|
| `ACQUISITION_FIDELITY` and `SourceDocument.expectedFidelity` | `model/domain.ts:1782`, `:1807` | declared; `actualFidelity` **does not exist**, so *"the gap is the signal"* has one operand |
| `resolveManagedService()` | `model/policy.ts:1781` | ✅ written 9 Aug with tests · 🛑 **no production caller**, and `ManagedServiceUseConfig`'s four fields still have no reader anywhere outside `model/examples.ts` |

⚠️ **Read that second row as the state of the whole feature.** `model/policy.ts:356` says of these
fields that theirs is *"the crossing with the least downstream recourse: once the page is sent,
redaction after the fact is not available."* The honest statement today: **the two tiers the
proposal spends the most money on have no executable residency or classification ceiling in the
call path at all.**

---

## 3. The five rulings

### R1 — What may be read in order to decide what a field is

**RULED: the value/structure distinction. It is not an exception to G106 — it is a statement of
what G106 was always about.**

> **An unmapped key's NAME, POSITION and locally-derived SHAPE are readable. Its VALUE is not, and
> no authorisation makes it so for this purpose.**

A column header is the name of a slot, not an `ExtractedValue`. Reading the header row of a CSV is
not reading the field. G106's rejected alternative — *defaulting unmapped keys to the most sensitive
class* — stays rejected, because nothing here makes any key readable by default. **This sentence
goes in the module header**, or the first engineer to hit it grants the mapper a G106 exemption and
the fail-closed default becomes fail-open-during-onboarding: §5.5 reintroduced at the one place
every row passes through.

**REJECTED, with the reasoning preserved** — a green team argued that a bounded sample of real
**values** be permitted under `REQUIRES_ENUMERATION` (`model/governance.ts:497`), as an FDE act
against one named `SourceDocumentId`, minting an `AuthorizationGrant` and a `DataAccessEvent`:

> *"That is not an exception to G106 — it is the difference between an AMBIENT read and an
> enumerated, authorised, audited one, and it leaves G106's rejected alternative untouched because
> no key becomes readable by default."*

**That argument is correct about G106 and is accepted in full. It is refused on a different
invariant — 6, ingested content is data, never instruction.** An authorised read is still a read of
counterparty-controlled text into a prompt, and the profile-only path makes it unnecessary. It
remains available to the owner as a stated decision — **O-4**.

**And the encoding is what makes this enforceable rather than a convention.** A redacted skeleton
(`NNNN-AAA-NN`) is the right idea and the wrong type: it is a `string`, so it defeats containment on
the way **in**. Encode the profile as bounded character-class **enum indices** plus lengths and
assert `AssertNoTextDeep` over it (`model/reconciliation.ts:258`) — the proof the return path
already has (`_ReaderVerdictHoldsNoTextDeep`, `:2246`) applied to the **request** path, which
nothing in the tree does today. Then *"the mapper never sees a value"* is a compile error.

### R2 — The schema-mapping act: nominate, then promote

**RULED: G126's shape. The model NOMINATES; a human PROMOTES; the promoter is never the proposer
and never an agent.** Zero approvals is not defensible at any staffing level.

**A second person is required iff the promotion does any of:**

- **(a)** sets `modelProcessingAllowed: true` on any field — invariant 4's one declaration, wrong
  once and that column reaches a model forever, silently, on every run;
- **(b)** assigns a `dataClass` at or above the tenant's `secondPersonToAdmitAboveClass`
  (`model/policy.ts:1038`), reusing `mayAdmit()`'s existing ordering (`:1064`) rather than minting a
  second ladder;
- **(c)** **binds the population's `amount` or `currency` path.** This is the money-moving act:
  mapping a running-balance column to `amount` manufactures exact subset-sum matches that are
  recorded as MATCHES, not judgements. G126's stated asymmetry is *"a rule that MOVES MONEY
  unattended on every future run"* — trigger (c) is that sentence exactly.

Everything else is **one FDE**, which preserves the cost objection a green team put in writing —
*"two FDEs per column would price onboarding out of the product for no marginal safety"* — while
refusing its premise that a mapping is a parse rather than a judgement.

**Capability: `promote_field_mapping`, classed `authority`, never in `PARTNER_CAPABILITY_MASK`
(`model/access.ts:211`).** Not `configuration`, and this is ruled **against two teams** on **G128's
own reasoning**: `PERMITTED_RESOURCES.delivery` (`model/governance.ts:432`) reaches `configuration`
under a standing 90-day grant (G75), so a `configuration` class means a standing FDE grant binds
amount paths unattended. That is precisely what G128 refused for `promote_learning`. Adding the
member will break `CAPABILITY_RESOURCE_CLASS` (`model/access.ts:556`) and `DELEGABLE_TO_AGENT` as
compile errors — **that is the totality biting, exactly as G128 records it doing.**

**Three controls transfer from G126 at near-zero cost:** an **expiry**; a **firing count** surfaced
on review; and the important one, a **header-set drift refusal** — a promoted mapping applies only
when the incoming header set is **exactly equal** to the promoted set, and any addition, removal or
reorder refuses and re-nominates. That is G125's *enumerated, never widened* applied to ingestion,
and it is what stops a supplier silently adding a column and every subsequent amount coming from
the wrong place. Per G131, every proposed entry carries the id of the sample row its evidence was
observed on, and one unprovenanced entry refuses the whole proposal.

**Placement:** G56/G59 put source configuration with the FDE, and `FieldSpec.confidenceFloor`
(`model/domain.ts:1764`) already has this exact posture — FDE-set, rendered read-only,
**deliberately no `editableByTenant` flag**, because that would be G25's missing mechanism. A
mapping is the same class of object and inherits it with nothing new invented.

### R3 — No generated pattern is ever compiled

**RULED: G124's reasoning binds here VERBATIM, and binds harder than at the layer it was written
for.** G124's deciding argument was never ReDoS: *"a finance operator cannot audit
`^STRIPE\s(?:UK|US|EU)\sPAYOUT.*` and CAN audit 'starts with STRIPE, then one of these three
tokens' — and an approval nobody can read is not an approval."* Under R2 a mapping requires FDE
approval; an FDE approving a regex column-splitter is performing §5.6. And G124's *"worse than the
original"* clause describes the proposal literally: a persisted mapping is applied to **every future
file forever**, with **no validator behind it** the way `applyReaderVerdicts()`
(`model/reconciliation.ts:2451`) sits behind the reader.

This is the **third** appearance of the shape (S1 → G124 → G130) and the second inside 24 hours:
G130 removed `matches_pattern` from `RulePredicate` on 9 Aug precisely because *"the first engineer
to implement `residueRules` writes `new RegExp(predicate.pattern)` over counterparty-controlled
text."* Step 3 would restore it one layer **earlier**, through a door the record had just closed.

**A closed op vocabulary carries column mapping with room to spare, because a mapping is a
SELECTION, not a program.** Three parts:

1. **Selection** — for each `FieldSpec.path` the pack requires (`model/domain.ts:1717`): an
   **index** into the observed key set, or `absent`. Never a key name, never a path, never a
   literal, never a pattern. This reuses G120's containment rather than reinventing it: *the
   privileged side supplies the VOCABULARY and the quarantined side CHOOSES FROM IT.*
2. **Codec** — closed enumerated unions chosen **by index**: `DateFormat`, `DecimalConvention`
   (decimal separator, thousands separator, sign convention, currency-symbol placement). ⚠️ These
   are genuinely new and that is **not** §5.3: `IdentifierNormalisation`
   (`model/reconciliation.ts:374`) canonicalises identifiers and expresses neither. A format outside
   the list is a **platform release**, exactly like a `PairingStrategy` kind.
3. **Normalisation** — reuse `IdentifierNormalisation` **unchanged**, with its required
   non-defaulted `maxInputChars`. Do not mint a parallel ingestion vocabulary.

**One ruling stricter than every team, which follows from the module's own honest disclaimer.**
`model/reconciliation.ts:483` is `applyExtraction()`, a small interpreter whose `strip_literal`
literal and `split_take` separator are **data that may have been derived from counterparty text** —
which is why the module declines to claim *"nothing generated is ever executed."* Therefore: **the
mapper may NOT propose an `IdentifierNormalisation`.** It proposes a selection index and a codec
index, nothing else; op lists are authored by the FDE at promotion. That closes the one seam through
which counterparty-derived data would still reach an interpreter.

**Standing header controls from the first commit** (comments stripped first, per the reconciliation
module's own lesson): `grep -c 'new RegExp' → 0` · `grep -cE 'anthropic\.|claude-|amazon\.' → 0`
(G104) · `grep -c 'throw ' → 0`.

**G124's cost clause is inherited verbatim and must be written into the header, not quietly
dropped:** *"the vocabulary must grow to express what regex expresses, and some patterns will be
inexpressible. Those stay manual, and that is the correct failure."*

### R4 — Textract versus a Bedrock multimodal model at tier 4

**RULED: Textract stays tier-4 PRIMARY for v1; the Bedrock vision arm ships as a tier-4 FALLBACK;
NEITHER is built until `resolveManagedService()` has a caller. G85 is not reopened.**

The governance asymmetry is real and verified: `ModelCatalogEntry.provider` is closed to
`'bedrock' | 'sagemaker'` (`model/catalog.ts:137`) and says Textract *cannot be added here*, while
`resolveModel()` (`:184`) runs the refusals that include invariant 7's only executable enforcement.
Textract passes none of it.

**It does not follow that the multimodal path is the safer one, and reading it that way is §5.1 in
the large.** Choosing a tier by *which path happens to have a resolver today* is keying on a
convenient landmark instead of the property it protects. Three grounds:

1. The gap is a **missing function**, not a property of Textract. Write the resolver — now written —
   give it a caller, and the asymmetry disappears.
2. **The multimodal arm relocates the classification problem to a ceiling that also cannot be
   computed.** A page image is invariant 6 at its widest, and `maxDataClassToService`
   (`model/policy.ts:363`) is compared against a `DataClass` declared **per field** on `FieldSpec`,
   so for a document of unknown schema **no document-level class can be computed at all** and
   nothing in the tree computes one. It also puts a whole page into a **prompt**, governed by
   `maxDataClassInPrompt` (`:284`), which has zero readers too, and `:356` makes the two
   deliberately different fields *because a single ceiling would force one of the three to be
   wrong*. **Nothing says which one a picture crosses** — **O-2**, **O-3**.
3. **The cost claim is unsourced.** *"Often cheaper and more flexible"* carries no page and no date,
   and the proposal collapses two Textract tiers at very different prices into one:
   `allowedFeatures`' own comment names the v1 population as *"`AnalyzeDocument` and
   `DetectDocumentText`"* (`model/policy.ts:343`). **Price that split before adopting anything** —
   it may capture much of the saving with zero new dependencies and zero new licence exposure.

**Reopen G85 only with a measured, priced Mandarin docket run** — never with an assumption. The
premise for reopening is a vendor-capability claim of exactly the shape §3c exists to punish.

### R5 — The minimum integrity bar before a shredded row enters reconciliation

**RULED, six clauses. All six are required; each catches what the others cannot.**

**(i) GRAIN — one work item per ARRIVING ARTEFACT, never per row.** A shredded row is
`ExtractedLine` at index *i* of exactly **one** `SourceDocument` (`model/domain.ts:1835`, `:1840`),
addressed by `ItemRef` (`model/reconciliation.ts:785`). It has no independent identity, no lifecycle
and no retention of its own. If the shredder mints a `SourceDocument` per row, four things break at
once: the line grain is lost to `MatchGroup.members`, which addresses documents; a duplicate mints a
second id and therefore a second `itemKey`, so it matches **separately**; `SubjectLocation`
registration multiplies; and retention becomes per-row. **Shredding happens inside the worker, in
file order.**

**(ii) IDEMPOTENCY — three keys, each catching what the others cannot.**
- **File grain:** `(tenantId, sourceEndpointId, sha256(bytes))`. **Content hash — not the S3 key and
  not a message id.** S3 event notifications are themselves at-least-once, and a redrive changes the
  message id while the file is the same file.
- **Row grain:** unique `(tenant_id, source_document_id, line_index)` with
  `INSERT … ON CONFLICT DO NOTHING`. `lineIndex` is **minted once** from the parser's own row
  ordinal, in the pass that reads the file — never from insertion order, arrival order or a
  `ROW_NUMBER()` over an unordered read.
- **Content grain:** the file's own control total or trailer row, admitted as a first-class fact.
  **This is the only one that catches a truncated shred**, which neither unique index can see.

**(iii) ORDERING — no delivery-order guarantee is needed, claimed, or bought.** `admitPopulation`
(`model/reconciliation.ts:1113`) increments `ordinal` over documents **as supplied**, then
`line.index`; both are derived, not observed. Lines stored with a file-position `index` and read
back sorted reproduce the ordinal under any delivery order. **Do not buy a FIFO queue; you would be
paying for a property the design already has.** Two preconditions must be stated as such: lines are
read back **sorted by `index`**, and the DOCUMENT array handed to `runSetReconciliation` is ordered
by a **stated total key** — today unspecified anywhere, and a rerun hazard.

**(iv) TENANCY — resolved server-side, never carried.** Unanimous across four teams, and it is
invariant 1, copied not paraphrased: **"Tenant scope is derived from the session, never read from a
request."** A queue message is a request. The consumer takes bucket and key only and resolves the
tenant from the control-plane-provisioned prefix registry under the data-plane role; an unresolvable
object is quarantined, never processed. Any tenant on a message is a **hint that is re-derived and
compared, refusing on mismatch** — G113's standing precedent is that a bare `{type: string}` with no
argument at the point of use is *removed, not documented*. **Add a checker asserting no queue
payload schema declares a tenant field**; that is exactly how the two wire deviations survived until
a `$ref` scan found them.

**(v) WHAT CATCHES A DUPLICATE — and the answer today is nothing, in a way worse than any team's
framing.** `runSetReconciliation` folds the admitted arrays into a Map —
`for (const item of [...left.admitted, ...right.admitted]) items.set(item.key, item)`
(`model/reconciliation.ts:2835`) — so a duplicate carrying the **same** key silently **overwrites**,
the item **vanishes**, and `checkPostconditions()` (`:2681`) computes `admittedMinor` by iterating
`state.items.values()` (`:2699`) — **the same map that just ate the row.** Conservation therefore
holds over a population already one row short and `gross_not_partitioned` (`:2646`) cannot fire. The
other arm — a duplicate re-shredded to a new key — produces two admissible items, both eligible to
match, with every post-condition passing, because every post-condition is an **internal-consistency
check over the admitted set** and not one of them compares that set against the source artefact. So:
a duplicate must be a **NAMED OUTCOME**, never a silent `Map.set`; and `RulePredicate.unique_within`
(`model/domain.ts:367`) **has no evaluator** — duplicate-invoice detection, the record's own stated
reason for the `tenant_lifetime` scope, does not run. Write it or mark it unbuilt.

**(vi) TRANSACTION — the shred and the `SourceDocument` insert are ONE transaction inside
`withTenantScope()`**, under G99/G100/G101. Then a partial shred is impossible and resumability
**stops existing as a problem** rather than needing a durable cursor. ⚠️ **The cost that makes this
ruling conditional:** a very large file in one transaction is a long transaction holding a server
connection under transaction-mode pooling (G101). **So the bound must be stated and refused on, not
defaulted** — a file above the stated row or byte bound **refuses, loudly**, rather than being
silently chunked. If chunking is later ruled in, the durable cursor returns with it.

**The test G98 exists for:** a two-tenant leak assertion via `pg_backend_pid()` that both queries
ran on the **same** pooled connection, and that a query issued **outside** the transaction returns
zero rows rather than another tenant's.

---

## 4. Where the review ruled against a team — or against the owner

An adjudication that agrees with everything adjudicates nothing. The losing reasoning is preserved
in each case.

| | Ruling | Against |
|---|---|---|
| **A1** | **Arrival order does not break the admission ordinal.** `admitPopulation` derives it (`model/reconciliation.ts:1113`); it never observes arrival. The conclusion *do not queue rows* is right; this argument for it is not — **do not buy FIFO** | a green team |
| **A2** | **But the DOCUMENT array order is unspecified and nobody named it.** *"Document order as supplied"* — and nothing anywhere states what supplies it. Two reruns handing documents in different orders produce two different audits | all four teams |
| **A3** | **`SubjectLocation` already has `blob` and `trace`** — eleven variants (`model/governance.ts:1772`). The premise *"do not build a DLQ until it gains a blob variant"* is struck; the preferred fix survives. The real gap is that **no variant names a queue message** | a green team |
| **A4** | **A column mapping IS a money-moving act.** Whoever authors it chooses which column is the money; a running-balance column bound to `amount` manufactures exact subset-sum matches recorded as MATCHES. The *cost* argument against two approvers is accepted, and is why R2's second person is scoped to three triggers rather than every column | two teams |
| **A5** | **`promote_field_mapping` is `authority`, not `configuration`** — G128's reasoning verbatim | two teams |
| **A6** | **One new capability, not two.** A nomination is inert; minting a capability for an inert artefact buys a compile-error surface for nothing. The act needing authorisation is the **probe**, and `REQUIRES_ENUMERATION` already covers it | a green team |
| **A7** | **"Textract has no resolver" does not argue for the Bedrock path.** Letting a missing function choose an architecture is §5.1. The observation is correct and important; the inference is not | two teams |
| **A8** | 🛑 **AGAINST THE OWNER: "output a deterministic JSON mapping or regex configuration" and "send only the first 5 rows" are both refused, and "70–90%" must not be quoted anywhere.** Its denominator silently includes CSVs and API payloads that were never Textract candidates; against the only intake this record describes — warehouse dockets, handwritten, scanned to SharePoint — the cascade saves approximately nothing, because every one of those is a flat scan that reaches tier 4 anyway | the owner |

⚠️ **A8 does not weaken the proposal's economics — it strengthens them by removing an
unsourceable number.** The cascade's floor is two cheap Lambda invocations and its ceiling is the
whole Textract bill. That argument needs no percentage, and `PRODUCT.md` forbids inventing one.
`$65 per 1,000 pages` is likewise unfetched and must carry a source and a date or be dropped.

---

## 5. The control set

Ordered by build order, not severity. Every one is a pure function, a type with a compile-time
proof, or a transaction against local Postgres.

| | Control | The property it holds |
|---|---|---|
| **C1** | `resolveManagedService()` — total, pure, in `resolveModel()`'s shape, rejection arms `feature_not_permitted` · `region_not_permitted` · `class_above_ceiling` · `provider_retention_exceeds_ceiling`, **never a boolean** (§5.2), **no caller-supplied override of any kind** (G79 refused exactly that) | ✅ written `model/policy.ts:1781` · 🛑 **no caller** |
| **C2** | `PolicySubject` gains a `managed_service_call` arm. Today it has four (`model/policy.ts:890`) and **a Textract call has no subject shape, so it cannot produce a `PolicyEvaluation` at all** | one team alone found this |
| **C3** | **ONE gateway, TWO checks, NO third way.** `resolveModel()` for catalogue entries, `resolveManagedService()` for AWS AI services. **A cost optimisation must be structurally unable to move traffic from a checked boundary to an unchecked one** |
| **C4** | `IngestBound` — `maxObjectBytes` · `maxDecompressedBytes` · `maxCompressionRatio` · `maxPages` · `maxRows` · `maxCellChars` · `maxArchiveDepth` · `maxRowsPerTransaction`. **Required, no defaults, refusing on absence** — *a bound with no number is not a bound*. **The numbers are the owner's (O-8).** Breach = quarantine, never fall-through to a paid tier |
| **C5** | `NativeTextOutcome`, a closed four-arm union replacing `IF NativePdfLambda == FAILED`: `text` · `no_text_layer` · `text_layer_suspect` · `refused`, with `NativeTextRefusal` naming `encrypted` · `malformed_xref` · `page_budget_exceeded` · `byte_budget_exceeded` · `timed_out` · `oom` · `structurally_rejected`. **Only `no_text_layer` and `text_layer_suspect` escalate a tier. `refused` holds and alarms — it never reaches a paid tier.** Assert `AssertNoTextDeep<NativeTextRefusal>`: a parser's error message is derived from counterparty bytes and would flow into a log, an `AuditEvent` and a screen. Do not carry the PDF's `Producer`/`Creator` forward for the same reason. **Failures are values, never throws** |
| **C6** | `admitTextLayer()` — deterministic, no model. Four tests, every threshold FDE-set configuration and never a constant: (a) glyph coverage; (b) U+FFFD replacement and unmapped-glyph rate; (c) **how many of the document type's REQUIRED `FieldSpec`s were located** — a text layer that is present and wrong presents as `digital_text` with zero required fields found; (d) **the load-bearing one: extracted line amounts must reconcile with the extracted total** through the G111 money codec. *A text layer that disagrees with its own arithmetic is not a cheaper parse — it is a different document.* Failure **downgrades** and records the reason |
| **C7** | Three fields on `SourceDocument` (`model/domain.ts:1840`) plus one type: `actualFidelity` · `fidelityBasis: 'declared' \| 'parsed' \| 'derived_from_extraction_tier'` · `fidelityDowngrade` (closed, text-free), and `FidelityObservation` — **the evidence for the tier, not just the tier**. ⚠️ `fidelityBasis` is the load-bearing half: without it the field records **what the pipeline did, not what the document is** |
| **C8** | `SourceDocument.mappingVersionId` — **no team proposed it and it is what makes a bad mapping survivable.** A mapping later found wrong means every document parsed under it is wrong, and `RunTrigger.rerun` re-runs the **engine**, not the extraction. Without the version on the row **you cannot enumerate the blast radius** |
| **C9** | `ObservedSchema` / `ObservedKey` / `ColumnProfile` from a **deterministic pass with no model in it**, with the character-class skeleton as bounded enum indices. `AssertNoTextDeep<ColumnProfile>` — **the containment proof on the REQUEST path, which nothing in the tree has today.** Header rule in the module header as its own sentence: *a mapping proposal reads KEYS and SHAPE; it never reads a VALUE* |
| **C10** | The mapper seam, copied from the reader seam: `MapperRequest` with a **SINGULAR** untrusted header and **no plural arm**, one request per column, so the TYPE enforces what a fan-out enforces at runtime. `MapperVerdict` = `field{candidateIndex, codecIndex}` · `several` · `no_field` · `unreadable`, with `AssertNoTextDeep` over it — **verify it RED before trusting it green.** `confidenceBasisPoints` may order a queue; it may never gate a promotion |
| **C11** | `SchemaMappingProposal` / `SchemaMappingEntry` and the codec unions. Never a format string, never a regex. **The model may not propose an `IdentifierNormalisation`** (R3). Per G131, an entry with no observation provenance is refused, and one unprovenanced entry refuses the whole proposal |
| **C12** | **Deterministic SPREAD sampling seeded from the content hash** — no team proposed this. *"First 5 rows"* is a head sample, systematically unrepresentative of a file sorted by anything, and **not reproducible for audit** once a file is re-delivered. A seeded spread sample is free, representative and reproducible; the held-out conformance sample draws from the same seed with a disjoint index set |
| **C13** | Conformance and drift, both after promotion: the **header-set drift refusal** (exact set equality), and a **conformance floor** applied to the held-out sample, adding `mapping_conformance_below_floor` to `SetReconciliationRefusal` (`model/reconciliation.ts:2629`) — **because today `admitPopulation` accumulates per-row refusals and carries on, so a run where most rows refused still returns `ok: true` with a sound ledger over the rest.** The floor is FDE-set, never a constant |
| **C14** | `promote_field_mapping`, classed `authority`, never in the partner mask. Nominate-then-promote; proposer ≠ promoter; an agent may never promote. Second person on R2's three triggers. Expiry and firing count. Tenant-read-only, no `editableByTenant` flag |
| **C15** | **The probe is an enumerated, authorised, audited act** — `REQUIRES_ENUMERATION` (`model/governance.ts:497`) against one named `SourceDocumentId`, minting an `AuthorizationGrant` under invariant 10 and a `DataAccessEvent`. **No new access machinery** |
| **C16** | **Currency is DECLARED, never inferred.** Today `expectedCurrency` is a parameter seeded from the first admitted row (`model/reconciliation.ts:1004`, compared at `:1024`). **A CSV cell carries no currency**; control row one and you denominate the whole side with nothing refusing. It comes from source configuration or from a column explicitly bound as a currency field validated against a closed ISO set, so a poisoned first row **refuses** instead of redefining the population |
| **C17** | The duplicate becomes a named outcome; `unique_within` gets an evaluator or a dated drop note. **The `Map.set` at `model/reconciliation.ts:2835` must not be the dedup mechanism** |
| **C18** | **Control-total admission.** `expectedLineCount` and `declaredControlTotal` from the file's own trailer, plus a `population_control_total_mismatch` refusal. ⚠️ **`null` must mean "the file declared none", NOT "unchecked"** — the `neverExport → exportable` inversion is this record's own precedent for a null that fails open. A file type known to carry a trailer whose trailer is missing is a **refusal**. **And the trailer row is consumed as this fact, never shredded as a transaction** — otherwise the single most valuable line in the file is spent as a phantom receipt |
| **C19** | **The ingestion RESIDUE as a first-class population** — an artefact that no rule matched, that F12 quarantined, or that `refused` at every tier is visible in the same list as everything else. **A file that vanished between EventBridge rules is a second inbox with no door.** 🛑 The control is named; **the object is undesigned** (§8) |
| **C20** | **Process and plane.** The parser runs with **no credentials, no database, no network egress** — a parser over counterparty bytes is an attack surface whether or not a model is downstream. Under G107 every component runs under the **data-plane DB role**, which is a grant, not a convention. Tenant prefix is the first S3 path segment |
| **C21** | **No DLQ as a separate store.** Failed files stay in the tenant's own landing bucket with a failure row in Postgres: one erasure story, one residency configuration, RLS-scoped retry state |

---

## 6. The ordered build — phase one, no AWS resource

**G101 is deliberate: a disposable Postgres and an in-process `pg.Pool`.** Every step below is a
pure function, a type with a compile-time proof, or a transaction against local Postgres.

| Order | Items | Why here |
|---|---|---|
| 1 | **C1 + C2 + C3** | The tier the proposal spends most on has no executable residency check **in any call path**. Building the cost optimisation before the control means the cheapest path and the most-governed path are different paths, with nothing stopping traffic moving between them. C1 exists as of `f988f2a4`; **this step is now its caller, C2 and the gateway** |
| 2 | **C7 + C8** | Makes *"the gap is the signal"* true for the first time, and is **the instrument that would let anyone DERIVE the cascade's saving instead of quoting it** (A8). Fixtures in the same commit |
| 3 | **C18 + C17 + C16** | The three integrity changes inside `model/reconciliation.ts`. Highest blast radius in the repository — **plan before implementing**, per `CLAUDE.md` |
| 4 | **C5 + C6 + C4** | Pure functions over parsed structures |
| 5 | **C9 + C10 + C11 + C12** | Types plus compile-time containment proofs **in both directions**. `notImplementedMapper` and the G118 header sentence ship with them |
| 6 | **C14 + C15** | Breaks `CAPABILITY_RESOURCE_CLASS` and `DELEGABLE_TO_AGENT` as compile errors. That is the totality biting |
| 7 | **C13 + C19** | Drift refusal, conformance floor, and the ingestion residue |
| 8 | Shred-in-one-transaction against local Postgres, plus the **G98 two-tenant leak test** | The one step that needs a database and needs no cloud |

**V1 DEPLOYMENT TARGET, NOT NOW:** the S3 landing buckets and the prefix→tenant registry; the
arrival trigger; per-tier IAM-isolated functions (G120's proven shape — a narrow per-function role is
a **containment improvement**, not only a routing convenience); Textract; the vision fallback; and
the PDF library once its licence has been read.

**A checker joins `npm run check`; it does not stand beside it (G108).**

---

## 7. Owner rulings — ALL EIGHT TAKEN, 9 Aug 2026 evening

> ✅ **The product owner ruled O-1 to O-8 in one sitting and took the recommendation in every case.**
> The original table is left below **unedited** — question, recommendation, cost — because **the cost
> column is what was accepted**, and a ruling recorded without the cost it bought is a ruling nobody
> can revisit honestly.
>
> 🛑 **These are RULINGS, not code. Not one is applied**, and they need G numbers in
> `docs/HANDOFF.md` §3 before anything here is built. ⚠️ **This line said *"§12 carries the draft
> rows"* until 9 Aug 2026 evening and the pointer is corrected rather than deleted:** §12 became the
> owner's three technical refinements T-1 to T-3, and **§13 carries the draft G rows** — for O-1 to
> O-8 *and* for T-1 to T-3. A pointer that resolves to the wrong section is the §9 defect class in
> miniature, and no checker here can see it.

| | Ruled | The consequence that binds the build |
|---|---|---|
| **O-1** | **Postgres work queue (`FOR UPDATE SKIP LOCKED`); EventBridge for the arrival trigger ONLY** | The shred and the enqueue share one transaction, which SQS cannot do. **This is the first narrowing of `event-architecture-recommendation.md`'s "no broker in the data plane" and it settles the INGESTION path only** — the general question stays open and stays nobody's. Refined by **T-1** |
| **O-2** | **BOTH ceilings must pass for a page image** | `maxDataClassToService` **and** `maxDataClassInPrompt`. Neither has a reader today, so *both* need writing. The fallback becomes unavailable to a tenant whose prompt ceiling is the lower of the two — the accepted failure |
| **O-3** | **The ceiling is the maximum `dataClass` across the `DocumentType`'s fields, and a `DocumentType` declaring no fields may cross NO managed-service boundary** | Fail-closed, matching `DENY_ALL` and G100. **First onboarding of an unknown document type cannot use tier 4 until a `DocumentType` exists** — accepted friction, and it forces the FDE act G56 already assigns |
| **O-4** | **NO real cell values to the mapper for v1** | Headers and shape only, refused on **invariant 6** rather than on G106 — the enumerated-grant argument was accepted as correct *about G106* and refused anyway. Headerless and `col1..col9` files go to the FDE by hand: **the identical cost G124 accepted.** ⚠️ **Refined by T-1's sibling T-2, which is what makes this affordable rather than merely safe** |
| **O-5** | **Pin a mapping to `(sourceEndpointId, headerSetHash)`** | One endpoint carries many mappings; C13's drift check becomes the **selector** rather than a refusal in the multi-schema case. 🛑 **This ruling RESTATES the headline economy**: not *"one inference per source, forever"* but *"one per distinct schema per source"*. Generalised by **T-3** |
| **O-6** | **`pdfjs-dist`, pinned exact. PyMuPDF is OUT** | Two independent sufficient grounds against PyMuPDF: a second language runtime inside the plane G107 puts under one DB role, and a licence primary sources indicate is AGPL-3.0 — **under BYOA a distribution event, not a footnote.** ⚠️ **Standing verification, NOT DONE:** `@napi-rs/canvas` is an optional native dependency of `pdfjs-dist@5`; confirm text extraction does not pull it, because a native binary in a Lambda is a deployment cost and a supply-chain surface |
| **O-7** | **G85 is NOT reopened for v1** | Reopen only with a **measured, priced Mandarin docket run** — the discipline G53 got, which changed the answer. Non-Latin dockets stay out of scope and `DocumentTypes.dc.html` stays as G85 redrew it |
| **O-8** | **Every bound, threshold and floor is FDE-set configuration in a pack template, refusing on absence** | The `confidenceFloor` posture (G38): FDE-set, rendered read-only, **no `editableByTenant` flag**. **An unset bound refuses the run** — the intended failure, and it means onboarding cannot be completed by leaving a field blank. No figure is invented anywhere, per `PRODUCT.md` |

**The original table follows, unedited.** Read it for the reasoning and the rejected alternatives —
that is the part which stops a later reader re-opening a settled question badly.

Each is a question, a recommended answer, and its cost. **None was the adjudicator's to take**, and
the pipeline should not be built past step 2 without O-1 and O-5 — **both now ruled.**

| | Question | Recommendation | Cost |
|---|---|---|---|
| **O-1** | **May a broker sit in the data plane, for the arrival trigger only?** `docs/build/event-architecture-recommendation.md:323` rules *"outbox, for every stream. No broker in the data plane, in either topology"*; G107 puts this whole pipeline in the data plane. That document records the collision itself and closes *"somebody must reconcile the two; this document does not."* **This proposal is the first concrete artefact that forces the answer** | **The WORK QUEUE goes in Postgres (`FOR UPDATE SKIP LOCKED`); EventBridge survives ONLY for the arrival trigger, which carries no tenant row.** The decisive ground is that the shred and the enqueue must share a transaction and **SQS cannot** (`:363`). ⚠️ This is still narrower than the signed-off carve-out at `:211`, so it needs its own G number and **settles only the ingestion path** | One more table and one more shipper loop; long-poll latency becomes poll latency. Reconciliation is periodic, so that is free here and would not be everywhere |
| **O-2** | **Which ceiling governs a PAGE IMAGE handed to a multimodal model?** `maxDataClassToService` and `maxDataClassInPrompt` are deliberately different fields | **BOTH must pass.** A page image crosses a provider boundary **and** enters a prompt; it is not one crossing wearing two names. Folding them is §5.3 | The fallback is unavailable to tenants whose prompt ceiling is lower than their service ceiling — the correct failure, and it makes the fallback less useful than the proposal assumes |
| **O-3** | **There is no document-level `DataClass` and nothing computes one.** For an unknown schema there are no `FieldSpec`s, so `maxDataClassToService` **cannot be evaluated at all** — and the page crosses an account boundary before anyone knows what is on it | **Evaluate against the maximum `dataClass` declared across the `DocumentType`'s fields, and a `DocumentType` declaring no fields may not cross ANY managed-service boundary.** Fail-closed, matching `DENY_ALL` and G100 | First onboarding of a genuinely unknown document type cannot use tier 4 until a `DocumentType` exists. Real friction, and the correct one: it forces the FDE act G56 already assigns |
| **O-4** | **May a bounded sample of real VALUES ever be shown to the mapper, under an enumerated FDE grant?** The argument for it is preserved in full at R1 and it is a good one | **NO for v1**, refused on invariant 6 rather than on G106 | Headerless and `col1..col9` files cannot be mapped by a model at all and go to the FDE by hand — **the identical cost G124 accepted** |
| **O-5** | **At what GRAIN is a mapping pinned?** ⚠️ **No team defined this and it may be the biggest unexamined assumption in the design.** *"One mapping per source"* presupposes one schema per source — and the drawn product shows **two SharePoint folders receiving dockets from many suppliers.** If a mapping is per-source, **a folder is not a source** | **Pin to `(sourceEndpointId, headerSetHash)`**, so one endpoint carries many mappings and C13's drift refusal becomes the *selector* in the multi-schema case rather than a refusal | The *"one inference per source, forever"* economy becomes *"one per distinct schema per source"* — still vastly better than per-file, but **the headline claim must be restated** |
| **O-6** | **PyMuPDF: a G71 carve-out, or out?** | **OUT**, on two independent sufficient grounds: a second language runtime inside the plane G107 puts under one DB role, and a licence that primary sources indicate is AGPL-3.0 — **under BYOA a distribution event, not a footnote.** `pdfjs-dist` pinned exact is the TypeScript path | `pdf-parse` is a wrapper whose licence **changed between majors**, and *a permissive badge on a wrapper is not a permissive licence on what it wraps*. ⚠️ `@napi-rs/canvas` is an optional native dependency of `pdfjs-dist@5`: **verify text extraction does not pull it.** That verification is not done |
| **O-7** | **G85: reopen the Latin-script narrowing?** | **NO for v1** (R4) | Non-Latin dockets stay out of scope. Reopening later costs a screen-pack redraw and the variant→engine binding the record warns has nowhere to live |
| **O-8** | **Every `IngestBound` number, every C6 threshold, every C13 floor** | **State them as FDE-set configuration in a pack template** — the `confidenceFloor` posture (G38) — not as constants. `PRODUCT.md` forbids inventing a figure | An unset bound refuses the run. That is the intended failure |

---

## 8. What no team designed and no team attacked

Four independent teams converged on a great deal; these are the places the convergence is silence
rather than agreement. **A second green/red pass was launched against the first three on 9 Aug
evening; until its output lands here, they are open.**

1. **The ingestion residue has no model object.** There is no type for *an artefact that arrived,
   was stored, was billed, and never became a `SourceDocument`*. C19 names the control; the object
   is undesigned.
2. **Nobody attacked the mapper's own supply chain.** Every containment proposal reduces to *the
   model chooses an index into a candidate set the privileged side built* — and **nobody asked who
   builds that set.** It is `DocumentType.fields`, which arrives in a pack, and G110 puts the
   pack-publication validators at a seam that **does not exist**. A poisoned pack is a poisoned
   candidate set, and every downstream containment proof holds perfectly while pointing at the wrong
   fields.
3. **Nobody designed correction.** C8 makes the blast radius **enumerable**; nothing makes it
   **fixable**, and `RunTrigger.rerun` re-runs the engine rather than the extraction.
4. **Nobody attacked the sampling as a statistical act** — C12 is free and no team proposed it.
5. **Nobody stated the long-transaction cost** of the one-transaction shred three teams converge on.
6. **Nobody costed latency.** One team alone noted the saving can be net negative at a low
   text-layer fraction; nobody modelled the cascade's added latency at all. Probably because
   reconciliation is batch and it is genuinely cheap here — **but nobody checked, which means nobody
   knows.**
7. **Nobody verified a single figure in the proposal.** `$65 per 1,000 pages`, `70–90%`, and *"often
   cheaper than `AnalyzeDocument`"* are all unfetched. One team searched for a text-layer-prevalence
   study and reported finding none, which is the right behaviour.
8. **On licences, one team fetched primary sources and two explicitly declined to state a licence
   from memory** — which is **correct behaviour** under `docs/integration-options.md`, not a
   failure. **This document asserts no licence.** Whoever adopts one re-reads it, records the URL
   and the date, and adds the row.

---

## 9. Record corrections this work found

**Not applied here** — logged for whoever writes next. ⚠️ **`tools/check-doc-counts.mjs` governs
none of them**: most have no number in them, and the numeric ones sit in Markdown tables, which it
cannot see.

| Claim | Where | Reality, verified at `f988f2a4` |
|---|---|---|
| *"the unreadable-by-default rule has no executable form anywhere in `model/`"* | `CLAUDE.md`, invariant 4 | ⚠️ **already corrected in `CLAUDE.md` since the adjudication was written** — `field_not_classified` (`model/reconciliation.ts:847`) refuses at four sites (`:1015`, `:1030`, `:1044`, `:1062`). The **JSONB-path** half is still missing |
| `FieldSpec` at `model/domain.ts:1584` | `CLAUDE.md`, invariant 4 | Declaration is at **`:1717`**. The citation *resolves* and points at nothing — the class `check-citations.mjs` structurally cannot catch |
| `CAPABILITY_RESOURCE_CLASS` at `model/access.ts:517` | `CLAUDE.md` twice | **`:556`**. Same class again |
| `SourceDocument.actualFidelity` exists | three documents, including `docs/HANDOFF.md` | **It does not** — `grep` returns zero. And `HANDOFF`'s citation for it resolves to a different field entirely |
| *"all six variants of `SubjectLocation`"* | `docs/data-architecture.md` | **Eleven** (`model/governance.ts:1772`), as that document's own later line says |
| *"`npm run check` does NOT run the tests"*, and 113 G rows / 26 applied / 36 capabilities | `CLAUDE.md` | **Stale.** G108 is applied in `package.json`; two checkers `CLAUDE.md` never mentions (`check:wire`, `check:packs`) exist. Derive the rest: `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md` · `\| grep -c '✅'` · the capabilities `awk` |
| *"document values are safe because `FieldSpec` constrains them"* — the stated reason the injection validator is scoped to `counterparty_reply` alone | `docs/prompt-injection-posture.md` | **Falsified by any unmapped-schema ingestion path, including this one.** Under the design ruled here the premise is **restored** (the mapper sees no values) — **but it stands because of a control that does not exist yet**, and that dependency was nowhere written down until this line |
| Eight `file:line` citations in the adjudication itself | the 9 Aug morning adjudication | Drifted within six hours as G123/G127/G128/G130/G131 landed: the duplicate-overwrite site, the four `field_not_classified` call sites, the `classified` helper, `expectedCurrency`, `checkPostconditions`, `SetReconciliationRefusal`, `IdentifierNormalisation`, and `_ReaderVerdictHoldsNoTextDeep`. **All are re-derived above** |

---

## 10. What this document cannot verify

- **No figure in the proposal was fetched**, and none may be quoted from here.
- **No licence is asserted.** O-6 is a recommendation resting on primary sources one agent read and
  this document did not.
- **Nothing here has been built**, so no claim below the type level has been observed. The
  reconciliation engine's own history on 9 Aug is the argument for distrusting this: it was executed
  for the first time and a corpus written to the SPECIFICATION found a real audit-trail defect
  within hours. **Expect this design to be wrong somewhere that only execution will show.**
- **Nothing in this repository can check** whether a control named here is on the right declaration,
  whether a stated reason is true, or whether a rung of the ladder records the evidence §1 says it
  owes. That remains a person reading this against the tree.

---

## 11. Pass two: the undesigned three, designed and attacked — 9 Aug 2026, evening

> 🛑 **THERE IS NO ADJUDICATION OF PASS TWO. NOTHING BELOW IS RULED.**
> A second green/red pass was launched against §8 items 1, 2 and 3 — the ingestion residue, the
> mapper seam, correction — plus the integrity trio C16/C17/C18 inside `model/reconciliation.ts`.
> **Four green designs landed. Three of the four red attacks landed. The mapper-seam red team and
> BOTH adjudicators died on a session limit.** So this section is **EVIDENCE, not adjudication**:
> it records what each team declared and what each attack found, and **where two reports disagree
> it names both and stops.** Whoever adjudicates this owns the decisions; nobody may read a row
> below as a ruling, and no G number may be minted from it without the owner (§13).
>
> ⚠️ **§1–§7 above are now PARTLY WRONG and §11.5 says exactly where.** Eight controls this
> document committed to are corrected by pass two, one of them — **C2** — in a way that would have
> let a G row be recorded as applied while being inert. The corrections are **not applied to the
> text above**, because correcting a control is an adjudication and this pass has none. Read §11.5
> before building anything from §5 or §6.

### 11.1 What landed, and the one thing that did not

| Area | Green | Red | Adjudication |
|---|---|---|---|
| **The ingestion residue** (§8 item 1) | `docs/build/ingestion-p2-green-residue.md` | `docs/build/ingestion-p2-red-residue.md` — 5 BLOCKER · 10 SERIOUS · 5 NOTED | 🛑 **none — died** |
| **Correction / re-parse** (§8 item 3) | `docs/build/ingestion-p2-green-correction.md` | `docs/build/ingestion-p2-red-correction.md` — 5 BLOCKER · 8 SERIOUS · 7 NOTED | 🛑 **none — died** |
| **The integrity trio** (build row 3) | `docs/build/ingestion-p2-green-integrity.md` | `docs/build/ingestion-p2-red-integrity.md` — 3 BLOCKER · 7 SERIOUS · 6 NOTED | 🛑 **none — died** |
| **The mapper seam** (§8 item 2's neighbourhood: C9–C12) | `docs/build/ingestion-p2-green-mapper-seam.md` | 🛑 **NO RED REPORT EXISTS.** There is no `ingestion-p2-red-mapper-seam.md` | 🛑 **none — died** |

🛑 **The mapper-seam design has NOT been attacked, and no sentence anywhere may imply that it has.**
It is the largest of the four documents (1,816 lines), it carries the containment proof the whole R1
ruling rests on, and **it is the only one of the four whose containment claims nobody tried to
break.** The three red teams that did run broke a BLOCKER-grade hole in every design they touched;
the base rate says the mapper seam has some too, and the honest statement is that we do not know
which. Its own §5 is a *self-written* red plan — which is a design artefact, not an adversarial
result, and its author says so: *"NOTHING BELOW HAS BEEN COMPILED… I did not run `tsc`."*

⚠️ **One consequence of the missing adjudicator, visible before anyone reads a finding: three teams
minted the SAME owner-ruling numbers for three DIFFERENT questions.**

| | green-residue §7 | green-integrity §7.3 | green-mapper-seam §7 |
|---|---|---|---|
| **O-9** | where the residue renders | may v1 ship without cross-run duplicate-invoice detection | what goes into `HeaderSetHash` |
| **O-10** | does a quarantined artefact get its own retention window | is an EMPTY population a defect | the `ValueCodec`'s initial membership |
| **O-11** | does `UsageRecord` gain `arrivalId` | may a `PostconditionFailure` mean "incomplete" as well as "unsound" | how an AGENT proposer is recorded |

**Nine open questions wearing three numbers.** This is the identity hazard §13 exists to prevent,
arriving from the other direction, and it is the first thing an adjudicator must renumber. **Do not
cite "O-9" in this record without naming the document it came from.**

### 11.2 The ingestion residue — designed, and five blockers

**Green's three load-bearing declarations.** (1) **`IngestArrival`** in a new `model/ingestion.ts`,
**one row per arriving artefact including the successful ones** — the denominator argument, and the
red team could not break it: *"a table holding only failures IS the second inbox C19 exists to
refuse."* (2) **`ArrivalRefusal`**, a closed fourteen-arm union with
`_ArrivalRefusalHoldsNoTextDeep` over it, so a parser's message cannot reach a log, an audit row or
a screen — `AssertNoTextDeep` at `model/reconciliation.ts:258`, whose implementation the red team
attacked directly and reports it **holds** at the type level. (3) **`ARRIVAL_DISPOSITION_FOR`**, a
total `Record<ArrivalRefusal['kind'], ArrivalDisposition>` that **derives** the triage class from the
refusal rather than storing it beside it — the `dispositionFor()` posture, and the red team verified
the contrast drawn with `ResidueEntry.disposition` is a careful reading rather than a convenient one.

**What red broke — BLOCKERs first.**

- 🛑 **B1 — the design's own headline fail-closed state has no arm.** Green states *"until the O-8
  numbers exist, EVERY ARRIVAL REFUSES — which is the intended failure."* None of the fourteen arms
  can record that: the nearest is `bound_exceeded { bound; limit; observed }`, which **requires a
  `limit`**, and the premise of the state is that no limit exists. All three available behaviours are
  defects — fabricate a `limit: 0` (invented data on the one row a finance user reads, the precise
  thing `ResidueEntry`'s own docblock records this codebase already doing once,
  `model/reconciliation.ts:2100-2104`), throw (banned by the module's own `grep -c 'throw ' → 0`), or
  write no row (the second inbox with no door, produced by the object built to close it). And
  `ARRIVAL_MAY_BE_REPROCESSED.quarantined = false`, so **every artefact that arrived before O-8 was
  answered is quarantined forever** — answering O-8 re-admits none of them.
- 🛑 **B2 — the named duplicate cannot be inserted.** Migration 0002's
  `CREATE UNIQUE INDEX ingest_arrival_content_key ON ingest_arrival (tenant_id, endpoint_id,
  content_sha256) NULLS NOT DISTINCT` means the second delivery of the same bytes conflicts, so
  `duplicate_of_earlier_arrival` has no writer and `superseded` has no producer. **R5(v)'s silent
  `Map.set` (`model/reconciliation.ts:2835`) is reintroduced as a silent `ON CONFLICT DO NOTHING`.**
- 🛑 **B3 — the `endpointId` null rule is prose the type does not hold, and the migration `CHECK`
  contradicts the pipeline order.** Green says `endpointId` is null on exactly one arm *and* that F12
  runs before routing; both cannot be true, and **green's own flagship quarantine fixture is rejected
  by green's own `CHECK`.** §5.10 inverted: the fixture is green, the constraint is red.
- 🛑 **B4 — two arms force invented data.** `sanitisedAt: Timestamp` and
  `sniffedKind: SniffedContentKind` are non-null, and the arm `sanitiser_did_not_complete` is
  precisely the state where the sniff never returned. The only available value, `unrecognised`, is
  declared *"F12 RAN AND COULD NOT TELL. **Not 'we did not look'**"* — so the artefact F12 examined
  and the artefact that killed F12 become the same row, on **the routing key**.
- 🛑 **B5 — `PolicySubject` on the wire and in the model are different unions.** See §11.5; this is
  the most important finding of the pass and it is not about the residue at all.

**Still open after both reports:** where the residue renders (green's O-9 — the coverage figure
green proposes is *not computable*, on green's own §6 items 3 and 8, and red's S8 shows the argument
rests on re-reading an illustrative mockup figure `PRODUCT.md` forbids treating as a result);
whether reading an arrival is authorisable at all (red S7 — **no capability and no resource class
names an arrival**, so green's own invariant-10 claim has no grant to carry); and the PostgreSQL
major version, which `NULLS NOT DISTINCT` needs and **nothing in this repository records**.

### 11.3 Correction / re-parse — designed, and five blockers

**Green's three load-bearing declarations.** (1) **`DocumentCapture`**, an append-only capture
ledger with **exactly one live capture per document enforced as a partial unique index**, on
`ProcedureStepExecution`'s verbatim rule that *"that uniqueness IS the concurrency control — enforce
it in the store, not in the caller."* (2) **`SourceDocument.mappingVersionId` + `.captureVersion`**,
which is C8 finally given a query shape. (3) **`ReaderReplayKey`**, replacing G120's
`(runId, requestOrdinal)` for the *replay* question — see §11.5.

**And green's central ARGUMENT is the best thing in either report, verified by the red team:** only
**two** streams in the whole model are hash-chained — `grep -rn 'chain: RecordChain' model/*.ts`
returns `model/domain.ts:3939` and `model/governance.ts:1158` — so **an in-place recapture leaves
every chain valid and every anchor matching while silently changing what every recorded finding
means.** The tamper evidence covers the two streams, not the business rows they point at. Nobody in
four prior reports said this.

**What red broke — BLOCKERs first.**

- 🛑 **B1 — `DocumentCapture` is a new store of extracted personal data with no retention window, no
  purge fields and no `SubjectLocation` variant that can name it.** `RetentionPolicy.days` is
  `Record<RetentionClass, number>` and the totality bites only on the *class list*, so a row type
  that declares no class **has no window and breaks no proof**. Purging the `SourceDocument` then
  stops purging the extraction, and an erasure plan reports `completed` with the captures appearing
  in no item at any disposition — *not even `out_of_reach`*, the arm green quotes eight times.
- 🛑 **B2 — `mayRecapture()` never calls `resolveManagedService()`.** Green presents recapture as
  C1's first production caller; the gate takes no managed-service parameter, and two of its twelve
  refusal arms (`managed_service_refused`, `run_input_set_unreconstructable`) are **unreachable** —
  while green's §3 states the first one refuses on a rejection it can never see. Invariant 7 on the
  recapture path is prose over zero call sites.
- 🛑 **B3 — the `ReaderReplayKey` fix reproduces the defect it removes.** See §11.5.
- 🛑 **B4 — the stated blast-radius control for the eighth `ExceptionStatus` member does not exist.**
  Green mints `'superseded'` and says *"`check:wire` is the only thing that bites."*
  `tools/check-wire-mirror.mjs` pins **five** pairs — `:74`, `:79`, `:89`, `:94`, `:99` — and
  `ExceptionStatus` is not one; worse, `unionKinds()` extracts `kind: '…'` literals and
  `ExceptionStatus` is a bare string-literal union, so the sixth pair needs **a new source kind in
  the engine**, which is the one thing the registry's own comment says adding a pair is not.
- 🛑 **B5 — every structural precedent this design copies is `@dropped-for-v1`, and the report never
  says so** — six markers in `model/learning.ts`, one of which reads *"retraction is unbuilt in v1;
  **a wrong promotion is undone by hand**."* So the cost framing inverts: this is a net-new v1
  subsystem whose precedents are drawings, and building it **diverges from a standing v1 scope
  decision** — which may well be right, since a mapping binds the amount path, but is then an owner
  ruling and not a derivation.

**Still open after both reports:** whether a correction of *our own* mapping error meters at all
(red S3 — nothing carries `carriedForwardFrom` onto the corrected run's exceptions, and that field's
own docblock says it exists partly to stop `exceptions_raised` inflating on a re-run); whether a
platform principal may `suspend` a mapping she promoted (red S1 — `actorOrgClass !== 'customer'`
locks out the FDE that R2 puts the mapping *with*, which is G60's shape in miniature); and whether
any reference in the model can name a superseded capture (red S4 — none can, so the preserved old
capture is unreachable and a finding computed over v1 is drawn over v2's document).

### 11.4 The integrity trio inside `model/reconciliation.ts` — designed, and three blockers

**Green's three load-bearing declarations.** (1) **`MoneyUnit`** — `Money` minus `amountMinor`, with
`_MoneyIsAMoneyUnitPlusAnAmount` asserting the two do not drift, so a denomination can be
**declared** without writing a fabricated zero. (2) **`checkPopulationIntegrity()`**, one exported
pure pass in `bindingsAgree`'s idiom holding C17, C18 and C13's rate check in a stated order.
(3) **`ControlTotal` as a three-arm union** — `declared` / `expected_but_absent` /
`not_declared_by_format` — because a nullable pair cannot distinguish *"no trailer"* from *"trailer
missing"*, and the red team looked for a fourth state the union cannot express and found none.

🛑 **Green also reverses this document's build row 3 order, and the red team confirms it:**
`docs/build/ingestion-pipeline.md:429` lists *"C18 + C17 + C16"*; **C16 must land FIRST**, because
C18's comparison sums a document's admitted gross through `sumGross`, which folds `addMoney` and
refuses across units — so under HEAD's seeding a control total is compared against a quantity **the
file chose the denomination of.** Order: **C16 → C17 → C18 → C13.**

⚠️ **And one brief premise the record supplied is false at the tree.** `Money.amountMinor` is
**`number`** (`model/domain.ts:535`), not `bigint`; `grep -rn bigint model/*.ts` returns nothing,
and G65/G78/G111/G112 are all **not applied**. Anything in §5 or §12 that reasons from a `bigint`
model representation is reasoning from a decision that has not landed.

**What red broke — BLOCKERs first: all three are C13 and C18, and all three are in §11.5.**
BLOCKER 1 (the rate ceiling is an off-switch), BLOCKER 2 (the non-configurable half has no operand),
BLOCKER 3 (C18 is a one-cell kill switch). Beyond those, the two that matter most:

- **SERIOUS 5 — a live conservation defect in the EXISTING tree that neither document names.** Where
  a duplicated address has one copy **admitted** and one **refused**, conservation holds *falsely*
  today. Walked line by line: the refused copy pushes a residue entry (`:2912-2923`);
  `checkPostconditions` builds `seen` over residue itemKeys (`:2686`); the admitted copy shares that
  key, so `const inResidue = (seen.get(item.key) ?? 0) > 0` (`:2706`) is **true for the admitted
  row** while the residue entry is the *other* row's. Therefore `accountedMinor` credits the
  admitted row's residual as residue-carried (`:2717`) and `if (!inResidue) missing += 1` (`:2718`)
  never fires — so `open_item_missing_from_residue` cannot fire and `gross_not_partitioned` balances
  over a ledger missing a transaction, with `postconditions` empty. **This is owed independently of
  C17, and C17 as written would MASK it rather than fix it.**
- **SERIOUS 6 — the C16 statedness gate reads `Money`'s representation below the sentinel that
  forbids it.** `_MoneySectionEndsHere` says *"below this line nothing may name the money
  representation"*; the gate reads `unit.currency` and `unit.exponent`, and the `money-sentinel`
  control bans only the literal `amountMinor` — so it **stays green while the property it protects is
  breached**, and green's §4 reassures the reader that it stays green. §5.1 and §5.6 in three lines.

**Still open after both reports:** whether an EMPTY population is a defect (green §6.3, red does not
contest it); whether v1 ships without cross-run duplicate-invoice detection at all, which is what
ruling `unique_within` unbuilt costs — `docs/domain-model.md:755` currently says it ships; and A2,
the document array's stated total key, which neither pass closes.

### 11.5 🛑 Findings that CORRECT A CONTROL THIS DOCUMENT ALREADY COMMITTED TO

**These matter most, because §1–§7 above are the part a reader trusts.** Every row was verified
against the tree in this session at `f988f2a4`. **None is applied**; each names the report that
found it, because when the adjudication is written the argument, not the summary, is what decides.

| | The control as §5/§7 above states it | The correction, and the evidence | Found by |
|---|---|---|---|
| **C13** | *"a **conformance floor** … adding `mapping_conformance_below_floor` to `SetReconciliationRefusal`"* — one refusal, one number, FDE-set | 🛑 **THREE corrections.** (a) **The rate ceiling as designed is a caller-supplied off-switch.** The gate admits `[0, 10_000]`, and at `10_000` the test `refused × 10000 > 10000 × (admitted + refused)` reduces to `admitted < 0` — **unsatisfiable**. 10 000 is not the loosest setting, it is *off*, and the required-bound gate certifies it as **stated**. That is §5.2 in its exact form, against the tree's own opposite posture one bound above it: `SIMILARITY_MAX_CHARS_CEILING = 512` (`model/reconciliation.ts:2772`) **refuses above the ceiling**, under the gate whose own comment is *"An absent bound is a refusal, never a default"* (`:2775`), and the corpus sits strictly inside it (`tests/scenarios/recon-corpus.ts:183`). ⚠️ **Worse, the plan prints the off-switch as PROCEDURE:** *"the diagnostic path is to re-run with the ceiling at 10000 and read the refusals."* The documented way to see what a C13 refusal was about is to disable C13, **and it will be followed, because it is the only way to get the residue back.** (b) **The non-configurable half is specified in eleven places and DECLARED IN NONE** — `population_wholly_refused` appears in green's §1, §2.5, §3a, §3b twice, §4, F15, F16, two mutations, §6.3, O-10, O-11 and commit 4, and **not once in §2, the section titled "the exact declarations"**. There is no new `PostconditionFailure` arm — the union has five (`model/reconciliation.ts:2642-2646`) — and **`checkPostconditions` has no operand for it**: its signature is `(state, residue)` (`:2681`) and `state.items` holds only *admitted* items, so the property is reverse-engineerable from the residue only, which cannot distinguish a wholly-refused side from an EMPTY one. (c) **Refusing DELETES the residue on a G106 refusal** — `unclassifiedFieldFailsClosed` (`tests/scenarios/recon-corpus.ts:1946`) is the one scenario whose entire point is that the refusal *lands in the residue with its reason*, and `{ ok: false }` carries no residue at all (`:2665-2667`). **So C13 must SPLIT: the configurable rate → a refusal; wholly-refused → a post-condition.** Green designs that split and the red team calls the *shape* right while breaking both halves' mechanics | green-integrity §3b + §7.2; red-integrity BLOCKER 1, BLOCKER 2 |
| **C17** | *"The duplicate becomes a named outcome; … the `Map.set` at `model/reconciliation.ts:2835` must not be the dedup mechanism"* | 🛑 **UNDER-SPECIFIED IN A WAY THAT CHANGES THE DESIGN, and both teams agree.** `itemKey(side, ref)` is `${side}:${id.length}:${id}:${line}` (`model/reconciliation.ts:809-813`) — **an ADDRESS.** So the `Map.set` overwrite needs a repeated *address*: a **re-delivered file**, or a `lineIndex` minted from insertion order — **not a repeated invoice number.** The corpus's own duplicate-invoice scenario keys `INV-3050` at `line(0)` and `line(1)` (`tests/scenarios/recon-corpus.ts:1316`, `:1319`) — **two addresses, no collision** — and is already correctly an `AmbiguityFinding`. **Therefore C17's named outcome is a REFUSAL (the engine cannot choose between two rows that are the same row) and C17 is NOT duplicate-invoice detection.** ⚠️ As written, C17 *"would have had somebody build duplicate-invoice detection out of a `Map.set` guard"* — red-integrity's own words, recorded as the most important correction in either document. **And the separate finding:** the MIXED case — one copy admitted, one refused — is a **live conservation defect in the existing tree that neither this document nor green named**; §11.4 walks it, and it is owed on its own commit because C17 would mask it | green-integrity §8 + §2.3; red-integrity "where green is right" #2, and SERIOUS 5 for the mixed case |
| **C18** | *"`expectedLineCount` and `declaredControlTotal` from the file's own trailer, plus a `population_control_total_mismatch` refusal"* | 🛑 **A REFUSAL HANDS A COUNTERPARTY A ONE-CELL KILL SWITCH ON THE WHOLE CLOSE, and it deletes the residue.** Both operands are counterparty-controlled content parsed from the file's last row, and `Money.currency` is a free `string` (`model/domain.ts:533`) with **no codec to parse a trailer total** (green §6.4). `SetReconciliationOutcome`'s `ok: false` arm (`:2665-2667`) carries no residue, no `refusedAtAdmission`, no ambiguities, no reader requests and no post-conditions — in the module whose §6 banner is literally **`RESIDUE — the product`** (`:2076`). So a supplier writing `lineCount: 41` for a 40-row file, or a trailer denominated `EUR` against an SGD population, **discards the other side's 4,000 admitted rows and every per-row reason**: a counterparty who wants a close delayed only has to be off by one, in the cell they control most cheaply. ⚠️ **Green refuses exactly this cost for C13's floor and pays it for C18 without arguing it.** The control: the five *comparison* arms become **post-conditions** — `postconditions`'s own obligation is *"Non-empty means the run produced an unsound ledger. Do not persist it."* (`:2661`) — plus a `ResidueCause` on the affected rows; the population stays computable and unpersistable. `expected_but_absent` is the one arm with a case for refusing and **that case should be argued for one arm, not assumed for six.** 🛑 **Second correction: `not_declared_by_format` is decided by the same actor that produced the rows.** The checker opens `if (control.kind === 'not_declared_by_format') continue` and *"the PARSER declares which arm applies"* — so the component whose output C18 checks can switch C18 off, and green's fixture plan sets that arm in **one** corpus builder for **22 of 24 scenarios**. A refactored shredder that stops reading trailers makes C18 inert for every file in production with `npm run check` green. **That is the G75 shape: applied and no-op.** The control red proposes: `DocumentType` declares whether its format carries a control total, and a parser disagreeing with it is itself a defect — invariant 4's posture, which green adopts for denomination and declines for the trailer in the same document | red-integrity BLOCKER 3, SERIOUS 10 |
| **C2** | *"`PolicySubject` gains a `managed_service_call` arm. Today it has four (`model/policy.ts:890`)"* | 🛑 **THE MOST IMPORTANT SINGLE FINDING OF THE PASS. C2 WOULD BE RECORDED AS APPLIED WHILE BEING INERT.** The model union is four arms discriminated on **`type`** (`model/policy.ts:890-894`). The wire schema is discriminated on **`kind`**, declares `additionalProperties: true` and `required: [kind]`, carries a five-member enum — `[exception, run, document, correspondence, procedure_step]` — and asserts of itself *"Discriminated union. Mirrors PolicySubject in model/policy.ts"* (`docs/contracts/foundation.openapi.yaml:891`, `:893`, `:894`, `:895`, `:899`). **Three wire members exist in no model arm; two model arms exist nowhere on the wire; the discriminant differs.** And `tools/check-wire-mirror.mjs` pins exactly five pairs (`:74`, `:79`, `:89`, `:94`, `:99`) — **`policy_subject` is not among them, so nothing has ever compared these two lists.** Adding a fifth arm to the model therefore leaves the wire untouched and unchecked: **C2 gets ticked, and a Textract call still cannot produce a `PolicyEvaluation` through the documented API.** Note also that the one model arm carrying `CLAUDE.md`'s named live invariant-7 bypass — `model_call.model` (`model/policy.ts:894`) — **fails the contract's own `required: [kind]`** and is unreachable through the documented API today. **This is the G75 shape exactly: a third list nobody named makes a ruling a no-op.** The control: add the sixth pair to `check-wire-mirror.mjs` **before** C2 is implemented, so C2's landing commit goes red until both sides move; then decide the discriminant once (§5.3) and set `additionalProperties: false` as every other request schema on that file does | red-residue B5 |
| **C4** | *"`IngestBound` — eight named bounds. Required, no defaults, refusing on absence"* | ⚠️ **Two corrections, and the first is a regression against C4 as adjudicated.** (a) Green-residue re-declares C4 as `Record<IngestBoundKey, number>` for the totality — which is a real gain and **costs the units**: `max_compression_ratio` and `max_object_bytes` become the same type, so `checkBound('max_compression_ratio', bounds, observedBytes)` compiles, a zip bomb passes the one bound written to stop it, and `bound_exceeded { limit: 100, observed: 41943040 }` reads as a byte breach. **That is §5.7** — seven counts and one dimensionless ratio in one numeric type — and C4's eight *named fields* did not have it. The fix keeps both: a mapped type over the key set with a distinct branded numeric per key (`Bytes`, `Rows`, `Ratio`, `Depth`, `Chars`), on `Money.amountMinor`-behind-one-codec's precedent (G111). (b) 🛑 **TWO GREEN TEAMS INDEPENDENTLY DECLARED `IngestBound` IN `model/ingestion.ts` WITH TWO INCOMPATIBLE SHAPES** — green-residue as `Record<IngestBoundKey, number>` over eight snake_case values, green-mapper-seam as a **thirteen-field interface** with camelCase field names, five extra mapper bounds and `BoundDefect { field: keyof IngestBound }`. Neither can be built without deleting the other. **§5.3 arriving inside the design that cites §5.3 most, and no adjudicator saw it** | red-residue S9; the collision derived here by reading both green §2.3s |
| **C9** | *"`AssertNoTextDeep<ColumnProfile>` — the containment proof on the REQUEST path, **which nothing in the tree has today**"* | ⚠️ **The claim as phrased is LOOSE and needs the word DEEP.** There is already a **shallow** request-path guard: `_CarriedTurnHoldsNoText = AssertNoPlainText<CarriedTurn>` (`model/identity.ts:1189`) over *"what the model sees of a prior turn"* (`:1147`), i.e. prompt input. It is insufficient here and the tree says why in its own words: `NoPlainText<T>` is `{ [K in keyof T]: string extends T[K] ? never : T[K] }` (`model/identity.ts:1139`) and **does not recurse**, so `readonly string[]`, a nested `{ v: string }` and a `Record<string, string>` all pass it (`model/reconciliation.ts:234-238`). A `ColumnProfile` is a nested structure, so shallow would not have caught green's own mutation R2. **The accurate sentence: the DEEP proof has never been applied to anything on the way IN; the shallow one has, once.** Do not repeat C9's phrasing without the word | green-mapper-seam §1a and F-2 |
| **C7 / C8** | *"nothing in `model/` constructs a `SourceDocument`, so `tsc` stays green; land a fixture in the same commit"* | ⚠️ **TRUE OF `model/` AND FALSE OF THE REPOSITORY, and the truth is better than the claim.** Three live construction sites exist in `tests/`, each supplying every field explicitly: `documentOf()` at `tests/model/reconciliation-conservation.test.ts:145`, `doc()` at `tests/model/reconciliation-passes.test.ts:120`, `documentOf()` at `tests/model/learned-dispositions.test.ts:151`. **So adding a required `SourceDocument` field goes RED at three sites immediately** — at `npm test`, not at `typecheck`. The stated conclusion *"`tsc` will tell you nothing"* leads an implementer to expect a green run and write the fixture as an afterthought; the compiler already has a witness, it just lives in `tests/`. §5.10's lesson still holds for `DocumentCapture`, `RecapturePlan` and `MappingRetraction`, which genuinely have none | green-correction §7c, verified independently by red-correction "where green is right" #3 |
| **G120** | *"`ReaderOutcome` must be **persisted keyed by `(runId, requestOrdinal)`**, which is what makes a retry granular AND makes a rerun REPLAY stored verdicts rather than re-ask — so the reconciliation stays deterministic"* (`docs/HANDOFF.md:846`, quoted verbatim) | 🛑 **CHALLENGED IN WRITING, WITH THE QUOTE — which is what `CLAUDE.md`'s working practice requires instead of relitigating. THIS IS NOT A DECISION AND MUST NOT BE READ AS ONE.** The challenge: **`requestOrdinal` is a POSITION, not an identity.** `buildReaderRequests()` assigns `requestOrdinal: requests.length` (`model/reconciliation.ts:2423`) while iterating the residue and `continue`-ing past every entry that is right-side, has no description, or has an empty or oversized candidate set. So the ordinal depends on the membership and order of the residue, which depends on the admitted set, which depends on the capture — so **a recapture, a rule change or a tolerance change mis-attributes a stored verdict to the wrong item.** The failure is not an over-allocation (`applyReaderVerdicts` re-derives both residuals and re-compares the money) but the worse one: **a confidently wrong allocation between two amount-identical candidates with `PairingEvidence.reader_confirmed` recorded as the evidence — an audit trail naming a model's confirmation of a pairing the model was never asked about.** **Two independent reports found this**, and the second also broke the first's fix: green's `ReaderReplayKey.requestBodyHash` is *"the RFC 8785 canonical form of the request, hashed by the writer"*, and **`requestOrdinal` is field one of `ReaderRequest` (`model/reconciliation.ts:2195`)** — `canonicalise()` (`model/canonical.ts:137`) walks every own key at every depth via `jcsSortedKeys` (`:123`), so the content-addressed key varies with position, which is the defect. Nothing at the tree can catch it: the hashed projection is a *sentence*, not a type. The control proposed: declare it — `ReaderReplayBody = Omit<ReaderRequest, 'requestOrdinal'>` — plus a key-set assertion, so a sixth field on `ReaderRequest` is a compile error at the replay key rather than a silent 100% cache miss. ⚠️ **And red-correction's N7 argues the property may be empty anyway in the case it was designed for:** correction exists because the capture changed, which changes the residue, which changes every downstream request body — so essentially nothing replays and the corrected run's determinism rests on a fresh non-deterministic call. **That is a cost and an owner ruling, not a free lunch** | green-correction §2.9; red-correction B3 and N7 |

### 11.6 Where the two reports DISAGREE — named, not resolved

An adjudication would settle these. There is none, so they are recorded as open with both sides.

| | Green says | Red says |
|---|---|---|
| **C17's scope** | Refuse on **any** duplicated address; mutation 5.2(c) deliberately includes `input.refused` in the collision walk | Narrow it: refuse only when **at least one copy was ADMITTED**, because that is the only case that reaches `items.set(item.key, item)` (`model/reconciliation.ts:2835`) and loses money. The both-refused case **already** has a named outcome today — `item_in_residue_twice` (`:2643`) fires with both rows and both reasons in the residue — and C17 as designed replaces that with a whole-run refusal, which is a regression (red-integrity SERIOUS 4) |
| **`ExceptionStatus` gains `'superseded'`** | Mint it; an open finding over a dead capture has nowhere else to go, and `check:wire` is the gate | Do not widen the enum at all; carry "replaced by a corrected rerun" on the run / `MatchGroup` side where `supersededByRunId` already lives and no wire enum moves — because the stated gate does not cover `ExceptionStatus`, and any holder of `reverse_resolution` (a `tenant_data` capability) could then stamp the new status on a finding with no rerun in existence while the correction path itself is gated at `authority` (red-correction B4, N2, N3) |
| **`sanitisedAt` / `sniffedKind` non-null** | Derived from C20 rather than assumed: F12 has no database reach, so the row is written only after the sniff returns, and *"not sanitised yet" is not a state a row can be in* | Both must be **required-and-nullable** (G102), because `sanitiser_did_not_complete` is exactly the state where the sniff never returned, and writing `unrecognised` collapses *"F12 could not tell"* into *"F12 died"* on the routing key (red-residue B4) |
| **Whether a `SourceDocument` blob is registerable in the erasure index** | §0(b): it is not — `SubjectLocation.blob` is `{ bucket; key }` and `storageRef` is one opaque string the record forbids parsing, so this is an unowned defect | Struck: `docs/contracts/capability.openapi.yaml:155-159` already rules the adjacent case — *"it owes no SubjectLocation … it is correct only because it is unread"* — and the `blob` variant exists for artefacts **no row addresses**, which an arrival is not (red-residue S2) |
| **`ARRIVAL_MAY_BE_REPROCESSED` as a boolean table** | The executable form of I7: only `needs_configuration` may be reprocessed | Keyed on the disposition rather than on **whether reprocessing crosses a paid boundary**, so 10,000 raster TIFFs made ambiguous by a sender are auto-escalated to tier 4 by an unrelated FDE configuration change — I7 verbatim, through the table written to enforce it. It must return a **trigger**, not a boolean, and the row needs an attempt counter (red-residue S3) |

⚠️ **One thing both integrity reports agree on that this document should act on regardless of the
adjudication:** `tools/check-citations.mjs` does not scan `model/` or `tests/`, and green-integrity's
plan writes ~20 same-file `:NNNN` citations into docblocks that its own ~190-line insertion at
`:1153` will move. Widening the checker's `TARGETS` is *its own isolated commit* — it will go RED on
three existing dead-but-resolving citations in `model/reconciliation.ts`, **which is the point** —
and every new docblock should cite by **declaration name**, because a name survives an insertion and
a line does not.

---

## 12. The owner's technical refinements — T-1 to T-3, taken 9 Aug 2026 evening

> ✅ **These came from the product owner AFTER O-1 to O-8, and all three are adopted.** They are
> refinements of ruled decisions rather than new questions, which is why they are numbered T and not
> O. **Two carry a correction or a constraint, and both are stated at the point of adoption rather
> than in a footnote** — a refinement adopted without its constraint is a refinement that will be
> implemented without it.
>
> 🛑 **Not applied. None has a G number.** §13 carries the draft rows.

### T-1 — Outbox write amplification: batch the inserts

**What it says.** Inserting outbox rows one at a time for a 50,000-row CSV causes WAL bloat and lock
pressure. Use **chunked batch inserts** — on the order of 1,000 rows per statement — or `COPY` into
an unindexed staging table, and apply indexes only when the rows are picked up.

**Why it is right.** ✅ **Fully compatible with R5(vi), and the atomicity argument is untouched.**
R5(vi) rules that the shred and the `SourceDocument` insert are **one transaction** inside
`withTenantScope()`; T-1 changes *how many statements* are issued inside that same transaction, not
how many transactions there are. Fewer statements for the same rows is purely an efficiency change:
a partial shred remains impossible, resumability still *stops existing as a problem* rather than
needing a durable cursor, and O-1's decisive ground — that the shred and the enqueue must share a
transaction and SQS cannot (`docs/build/event-architecture-recommendation.md:363`) — is unaffected.
It also *strengthens* R5(vi)'s stated cost, because the long transaction gets shorter.

**What it constrains, and this half must be resolved before it is planned.**
⚠️ 🛑 **"Apply indexes only on pickup" means DDL at runtime, and the data-plane role has no DDL
right by design.** **G100 deliberately separates the migration role from the data-plane role** — *"a
separate `BYPASSRLS` role runs migrations, **not** the table owner, because ownership carries DDL
rights alongside the read exemption"* — and that separation is already built: `db/provision.ts:64`
declares `reconcile_app` as *"LOGIN, NOBYPASSRLS, owns nothing, **no CREATE on the schema.** The
request path. It cannot bypass a policy and it cannot drop one."* `db/tenant-scope.ts:75-77` says
the same of the pool the request path uses. **Runtime `CREATE INDEX` is not available to the code
that would issue it, and must not be planned for.** Resolve it the way this record resolves this
class — at migration time, not at run time:

- a **permanently unindexed staging table** plus **one indexed queue table**, with the move between
  them being a `INSERT … SELECT` a data-plane role may issue; or
- a **partial or BRIN index chosen at migration time** on the queue table, which buys most of the
  write-amplification saving with no DDL anywhere near the request path.

**The cost, stated:** two tables instead of one, and one more place a row can be left behind. That
cost is smaller than the alternative, which is granting the request path a DDL right in order to
save write amplification — and a role that may `CREATE INDEX` is a role that may `DROP POLICY`.

### T-2 — Synthetic shape tokens instead of raw values

**What it says.** O-4 alone leaves the mapper unable to tell a date column from a reference string
when headers are vague (`Col_1`, `Col_2`), and the fix is to pass **SHAPE** rather than **VALUES**.

**Why it is right.** ✅ **Correct on both halves, and it is already what the green mapper-seam design
does** — which is the strongest possible confirmation, because the design was written before the
refinement and independently. `ColumnProfile` carries `parsesAsIso8601Date`, `parsesAsInteger`,
`parsesAsDecimal`, `minLength`, `maxLength`, `distinctCount`, `monotonic` and a character-class
skeleton expressed as **numeric indices** — `CHARACTER_CLASS_INDEX`, whose docblock states the
load-bearing reason: a union of class *names*, or of the observed *characters*, would pass
`AssertNoTextDeep` perfectly well, *"and it would defeat the entire proof WHILE THE PROOF STAYED
GREEN."* An alpha-presence flag is `matchesThreeLetterUpperCase`, deliberately named as **evidence
for a human and not a validation**, because no ISO 4217 set exists in this repository to validate
against. **Adopted in substance.**

🛑 **ONE CORRECTION, AND IT IS AN ENCODING CORRECTION RATHER THAN A DISAGREEMENT.** The owner's
example carries `"detectedShape": "REGEX_MATCH: ^\\d{4}-\\d{2}-\\d{2}$"`. **A regex STRING field on
the request type defeats the containment proof.** `AssertNoTextDeep<ColumnProfile>`
(`model/reconciliation.ts:258` is the assertion machinery) is what makes *"the mapper never sees a
value"* a **compile error** rather than a review convention; a `string` field called `detectedShape`
is a field the next engineer fills from counterparty data — `mostCommonValue`, `sampleValues`,
`rawRow`, all three named in the design as the edits somebody will want — and **no compiler can stop
them once a text field is legal on that type.** So express the identical intelligence as a
**closed, platform-authored enumerated SHAPE TOKEN chosen by INDEX**: the shape is *named by the
platform*, not *described by a pattern in the payload*. The model gets exactly the same type
information — "this column is ISO-8601-date-shaped" — and the proof survives.

⚠️ **This is NOT a G124 violation, and saying so precisely matters.** G124 forbids *compiling a
generated pattern*; a pattern **we** authored and never execute is not that, and the owner's example
would be our pattern rather than a model's. **It is refused on the containment proof — the pattern
is a `string` on a type whose whole purpose is to hold none.** A reader who records this as a G124
refusal will mis-apply G124 the next time a platform-authored pattern comes up, and will also miss
that the real objection survives even for a pattern nobody ever compiles.

**The cost, stated:** the token vocabulary must grow to express what a regex expresses, and some
shapes will be inexpressible. Those columns go to the FDE by hand — **the identical cost O-4 and
G124 both already accepted**, arriving a third time for the same reason.

### T-3 — Generalise `headerSetHash` to `structuralFingerprintHash`

**What it says.** O-5 pins a mapping to `(sourceEndpointId, headerSetHash)`. For a digital PDF with
no column grid there is no header set, so compute the fingerprint from the **sorted list of
normalised text anchors on page one** instead.

**Why it is right.** ✅ **It extends O-5's collision prevention to semi-structured documents with no
new machinery.** O-5's whole content is that *a folder is not a schema* — one endpoint receives
dockets from many suppliers — and that argument does not stop being true when the artefact is a PDF.
A fingerprint over page-one anchors is the same selector at the same grain, computed from a
different structural feature, and it makes C13's drift refusal available to the `digital_text` rung
rather than only to `tabular`. Nothing new is invented: the same hash field, the same selector, the
same refusal.

⚠️ **Two constraints, both mandatory.**

1. **The normalisation MUST reuse the existing closed `IdentifierNormalisation` op vocabulary
   (`model/reconciliation.ts:374`, `ops` at `:375`, `EXTRACTION_OP_KINDS` at `:339`), not a second
   normaliser.** §5.3 is the shape this record has seen recur most, and a "PDF anchor normaliser"
   beside an identifier normaliser is two vocabularies for one concept on the day it lands. Note
   `maxInputChars` is **required and non-defaulted** for a stated reason (`:381-386`): *"a bound with
   no number is not a bound … It is never silently unbounded, which is the outcome a default would
   produce."* An anchor normalisation inherits that polarity, so it is O-8 configuration and refuses
   on absence like everything else.
2. 🛑 **The anchors are counterparty-controlled TEXT, so ONLY THE HASH MAY TRAVEL.** An anchor list
   in a payload reopens exactly what T-2 just closed — it is `rawHeaderRow: string` wearing a
   different name, and `AssertNoTextDeep` over the request would reject it, correctly. The anchor
   strings exist on the privileged side, in the process that computes the hash, and nothing else
   sees them.

**The cost, stated rather than implied.** A cosmetic template change — `"DUE DATE"` to `"Due date"`,
a moved footer, one added label — yields a **new fingerprint**, therefore a drift refusal, therefore
a **re-nomination and a fresh FDE promotion.** The normalisation step is precisely what bounds how
often that happens, which is why constraint 1 is load-bearing rather than tidy: a weaker normaliser
means more re-nominations, and a *second* normaliser means nobody can predict how many. And the
opposite failure must be stated with it — **if the normalisation folds too much, C13's drift check
stops being "exactly equal" and the refusal is weaker than it reads.** What goes into the hash is
an open question that green-mapper-seam raised independently and nobody has answered.

---

## 13. Draft G rows, for a person to place

> 🛑 **THESE ARE DRAFTS AND NOBODY MAY COPY ONE INTO `docs/HANDOFF.md` WITHOUT THE OWNER PLACING
> IT.** A G number is an **identity**: two documents minting the same number is worse than a gap,
> because a gap is visible and a collision is not — and §11.1 records this pass producing exactly
> that collision three times over at O-9, O-10 and O-11 with no adjudicator to catch it. Nothing
> below is applied, and the `State` column says so on every row.
>
> **The next free number was DERIVED, not remembered:** `grep -cE '^\| G[0-9]+ \|' docs/HANDOFF.md`
> → **131** rows, the last of which is `G131`, so the **next free number is G132**. ⚠️ **Re-derive it
> before you place these** — the tree took G123, G127, G128, G130 and G131 in a single day, and
> `tools/check-doc-counts.mjs` does not govern this count. The numbering below is **provisional and
> contiguous**; if the tree has moved, shift the whole block rather than reusing a taken number.
>
> The four columns are `docs/HANDOFF.md` §3's own: **number · Decision · Consequence · State.**

| | Decision | Consequence | State |
|---|---|---|---|
| G132 | **A POSTGRES WORK QUEUE (`FOR UPDATE SKIP LOCKED`) FOR THE INGESTION DATA PATH; EVENTBRIDGE SURVIVES FOR THE ARRIVAL TRIGGER ONLY** (O-1) | The decisive ground is that the shred and the enqueue must share **one transaction** and SQS cannot (`docs/build/event-architecture-recommendation.md:363`). **This is the first narrowing of that document's *"outbox, for every stream. No broker in the data plane, in either topology"* (`:323`), and it settles the INGESTION path ONLY** — the general question stays open and stays nobody's. Cost accepted: one more table and one more shipper loop, and long-poll latency becomes poll latency, which is free here because reconciliation is periodic and would not be free everywhere. ⚠️ Narrower than the signed-off carve-out, so it needs its own number rather than riding on that one. **Refined by T-1** | not applied |
| G133 | **BOTH CEILINGS MUST PASS FOR A PAGE IMAGE HANDED TO A MULTIMODAL MODEL** (O-2) | `maxDataClassToService` (`model/policy.ts:363`) **and** `maxDataClassInPrompt` (`:284`). A page image crosses a provider boundary **and** enters a prompt; it is not one crossing wearing two names, and folding them is §5.3 — `model/policy.ts:356` makes the two deliberately different fields *because a single ceiling would force one of the three to be wrong*. 🛑 **Neither field has a reader anywhere, so BOTH need writing** — this ruling creates two obligations, not one gate. Cost accepted: the fallback is unavailable to a tenant whose prompt ceiling is the lower of the two, which makes it less useful than the proposal assumes | not applied |
| G134 | **THE DOCUMENT-LEVEL CEILING IS THE MAXIMUM `dataClass` ACROSS THE `DocumentType`'S FIELDS, AND A `DocumentType` DECLARING NO FIELDS MAY CROSS NO MANAGED-SERVICE BOUNDARY** (O-3) | Fail-closed, matching `DENY_ALL` and G100's deny-on-NULL. **There is no document-level `DataClass` anywhere and nothing computes one** — `dataClass` is declared per field on `FieldSpec` (invariant 4), so for a document of unknown schema the ceiling cannot be evaluated **at all**, and the page crosses an account boundary before anyone knows what is on it. Cost accepted: **first onboarding of a genuinely unknown document type cannot use tier 4 until a `DocumentType` exists** — real friction, and the correct one, because it forces the FDE act G56 already assigns | not applied |
| G135 | **NO REAL CELL VALUES REACH THE MAPPER IN V1** (O-4) | Headers and shape only. 🛑 **Refused on invariant 6 — *"Ingested content is data, never instruction"* — and NOT on G106**, and the distinction is load-bearing: the enumerated-grant argument (a bounded sample under `REQUIRES_ENUMERATION`, as an FDE act against one named `SourceDocumentId`, minting an `AuthorizationGrant` and a `DataAccessEvent`) was **accepted as correct about G106** and refused anyway, because an authorised read is still a read of counterparty text into a prompt and the profile-only path makes it unnecessary. **The losing argument is preserved at R1 and must stay there.** Cost accepted: headerless and `col1..col9` files cannot be mapped by a model at all and go to the FDE by hand — **the identical cost G124 accepted.** ⚠️ **Refined by T-2, which is what makes this affordable rather than merely safe** | not applied |
| G136 | **A MAPPING IS PINNED TO `(sourceEndpointId, headerSetHash)`** (O-5) | One endpoint carries many mappings, so C13's header-set drift check becomes the **selector** in the multi-schema case rather than a refusal. 🛑 **This RESTATES the headline economy:** not *"one inference per source, forever"* but *"one per distinct schema per source"* — still vastly better than per-file, and **the headline claim must be restated wherever it appears.** The premise it fixes: the drawn product shows two SharePoint folders receiving dockets from many suppliers, so **a folder is not a source.** ⚠️ **What goes INTO the hash — order, case, whitespace — is not settled, and C13's refusal is "exactly equal", so if the hash normalises anything the refusal is weaker than it reads.** Generalised by **T-3** | not applied |
| G137 | **`pdfjs-dist`, PINNED EXACT. PyMuPDF IS OUT** (O-6) | Two independent sufficient grounds against PyMuPDF: a second language runtime inside the plane G107 puts under one DB role, and a licence primary sources indicate is AGPL-3.0 — **under BYOA a distribution event, not a footnote.** `pdf-parse` is refused separately: it is a wrapper whose licence changed between majors, and **a permissive badge on a wrapper is not a permissive licence on what it wraps.** 🛑 **THIS DOCUMENT ASSERTS NO LICENCE** — whoever adopts one re-reads the primary source, records the URL and the date, and adds the row. ⚠️ **Standing verification, NOT DONE:** `@napi-rs/canvas` is an optional native dependency of `pdfjs-dist@5`; confirm text extraction does not pull it, because a native binary in a Lambda is a deployment cost and a supply-chain surface | not applied |
| G138 | **G85 IS NOT REOPENED FOR V1** (O-7) | Non-Latin dockets stay out of scope and `DocumentTypes.dc.html` stays as G85 redrew it. **Reopen only with a measured, priced Mandarin docket run** — the discipline G53 got, which changed the answer — never with a vendor-capability claim, which is the shape §3c exists to punish. Cost accepted: reopening later costs a screen-pack redraw and the variant→engine binding the record warns has nowhere to live | not applied |
| G139 | **EVERY `IngestBound` NUMBER, EVERY C6 THRESHOLD AND EVERY C13 FLOOR IS FDE-SET CONFIGURATION IN A PACK TEMPLATE, REFUSING ON ABSENCE** (O-8) | The `confidenceFloor` posture (G38/G22): FDE-set, rendered read-only, **no `editableByTenant` flag**, because that would be G25's missing mechanism. **An unset bound refuses the run** — the intended failure, and it means onboarding cannot be completed by leaving a field blank. `PRODUCT.md` forbids inventing a figure and `IdentifierNormalisation.maxInputChars` (`model/reconciliation.ts:381-386`) already states the discipline: *"a bound with no number is not a bound … It is never silently unbounded, which is the outcome a default would produce."* 🛑 **Two consequences pass two surfaced and this row must carry:** the refusal needs an **arm that can record an unconfigured bound with no number in it** (red-residue B1 — `bound_exceeded` requires a `limit`), and a ceiling whose permissive extreme is *off* is an off-switch, not a bound (red-integrity BLOCKER 1) | not applied |
| G140 | **OUTBOX ROWS ARE WRITTEN IN CHUNKED BATCHES INSIDE THE SAME SINGLE TRANSACTION; RUNTIME `CREATE INDEX` IS NOT AVAILABLE AND MUST NOT BE PLANNED FOR** (T-1) | Fewer statements for the same rows inside R5(vi)'s one transaction is purely an efficiency change and the atomicity argument is untouched — a partial shred stays impossible and resumability stays a non-problem. 🛑 **The "apply indexes only on pickup" half is refused on G100:** the data-plane role has **no DDL right by design** — `db/provision.ts:64` declares `reconcile_app` *"NOBYPASSRLS, owns nothing, no CREATE on the schema"*, and `db/tenant-scope.ts:75-77` says the same of the request pool — because ownership carries DDL rights alongside the read exemption. Resolve at migration time instead: a permanently unindexed staging table plus one indexed queue table, or a partial/BRIN index chosen in the migration. Cost accepted: two tables instead of one, and one more place a row can be left behind — smaller than granting the request path a right that also lets it `DROP POLICY` | not applied |
| G141 | **A COLUMN'S SHAPE REACHES THE MAPPER AS A CLOSED, PLATFORM-AUTHORED SHAPE TOKEN CHOSEN BY INDEX — NEVER AS A PATTERN STRING** (T-2) | The owner is right that O-4 alone leaves the mapper unable to tell a date column from a reference string under vague headers, and right that the fix is to pass SHAPE rather than VALUES. 🛑 **The `"detectedShape": "REGEX_MATCH: …"` encoding is refused ON THE CONTAINMENT PROOF, NOT ON G124** — and recording it as a G124 refusal will mis-apply G124 next time. A `string` field on the request type is a field the next engineer fills from counterparty data, and `AssertNoTextDeep` over that type is exactly what makes *"the mapper never sees a value"* a compile error instead of a review convention. An index into a platform-authored token set carries the identical type intelligence and keeps the proof. Cost accepted: the token vocabulary must grow to express what regex expresses and some shapes stay inexpressible — those columns go to the FDE by hand, **the third appearance of the cost G124 and O-4 both already accepted** | not applied |
| G142 | **`headerSetHash` GENERALISES TO `structuralFingerprintHash`; FOR A DIGITAL PDF IT IS COMPUTED FROM THE SORTED, NORMALISED PAGE-ONE TEXT ANCHORS** (T-3) | Extends O-5's collision prevention to semi-structured documents with **no new machinery** — same field, same selector, same drift refusal — and makes C13's drift check available to the `digital_text` rung rather than only to `tabular`. ⚠️ **Two constraints, both mandatory.** (a) The normalisation **reuses the closed `IdentifierNormalisation` op vocabulary** (`model/reconciliation.ts:374`, `EXTRACTION_OP_KINDS` at `:339`) rather than a second normaliser — §5.3 is the shape this record has seen recur most — and inherits `maxInputChars`'s required, non-defaulted polarity. (b) The anchors are counterparty-controlled TEXT, so **only the HASH may travel**; an anchor list in a payload reopens precisely what T-2 closed. Cost accepted and stated: a cosmetic template change yields a new fingerprint, therefore a re-nomination and a fresh FDE promotion — **the normalisation step is what bounds how often, which is why (a) is load-bearing rather than tidy.** ⚠️ Fold too much and the refusal stops being "exactly equal"; what goes into the hash is still open | not applied |

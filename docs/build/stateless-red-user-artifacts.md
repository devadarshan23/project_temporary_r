# RED TEAM — User artifacts: the draft-as-a-distinct-type design, attacked

> **STATUS:** WORKING MATERIAL · **V1 AUTHORITY: NO**
> **Target:** `docs/build/stateless-green-user-artifacts.md` (1,189 lines), read in full.
> **Written AFTER its green counterpart, with NO adjudication between them.** Nothing here is a
> decision. Where green and I disagree, both texts stand until the owner rules.
> **The owner's 9 Aug 2026 statelessness ruling is an INPUT and is not attacked** — *"everything
> that carries state, including session data or other user artifacts, must be committed to the
> database."* Green's **interpretation** of it (§0) is attacked, because an interpretation is not
> the ruling.
> **Baseline, re-derived by hand 9 Aug 2026:** `ls model/*.ts | wc -l` → 18 ·
> `node tools/check-doc-counts.mjs --derive` → 37 capabilities, 13 resource classes,
> **13 retention classes**, 11 invariants, 71 error codes, 65 contract operations ·
> `npm run check:citations` → `DEAD 0` (`2059 resolved · OK 1816 · SUSPECT 243` before this file
> existed; `2379 · OK 2125 · SUSPECT 254` with it — the added SUSPECTs are N1's, cited deliberately) ·
> `node tools/check-doc-counts.mjs` → **exit 0, 0 STALE**, and this file contributes no line to its
> report. ⚠️ Both totals move while other passes are editing `docs/` — **re-run them, do not quote
> these.**
> Every `file:line` below was opened. Where I did not open something I say **not verified**.

---

## 0. The chain green's headline rests on, verified link by link

The task set one test above the others: *"If the brand mismatch does NOT produce a compile error, or
if there is any path that reaches an effect without a `ProposalId`, the design's headline property is
false."*

| Link | Verdict |
|---|---|
| `Id<TName> = string & { readonly [brand]: TName }` over `declare const brand: unique symbol` | **HOLDS.** `model/kernel.ts:29`, `model/kernel.ts:43`. Nominal. |
| A brand mismatch is a `TS2322` | **HOLDS, and the tree already quotes the error.** `model/domain.ts:3910` records the sibling case verbatim: *"`const x: ProposalId = 'op_1' as OperatorProposalId` gives `TS2322 … Type '"OperatorProposal"' is not assignable to type '"ResolutionProposal"'`"*. |
| Every arm of `ExceptionResolution` requires `proposalId: ProposalId` | **HOLDS.** `model/domain.ts:2855` — three arms, `autonomous` / `approved` / `manual`, all three carry `proposalId: ProposalId`. |
| Therefore *"an unapproved draft is not constructible as an effect"* | **FALSE AS STATED.** SERIOUS 1. |
| Therefore no path reaches an effect without a `ProposalId` | **FALSE.** `ExceptionReversal` (`model/domain.ts:2924`) is one, and the operator arm's effect path is a different brand entirely. SERIOUS 2. |

So the mechanical core is sound and the sentence built on it is oversold. That distinction is the
shape of most of what follows: **green's types are better than green's claims about them.**

---

## BLOCKER

### B1 — Nothing writes the erasure index. The twelfth `SubjectLocation` variant is a control over zero call sites.

**Claim.** Green's §3.4 adds `| { kind: 'held_edit'; heldEditId: HeldEditId }` and §4 records it as
refusing *"an erasure plan that cannot reach held work"*, on the ground that *"the variant exists, so
the plan can name it."* A variant that can be named is not a variant that is written.

**Evidence.** `SubjectLocation` is an open union. `ErasurePlanItem` is
`{ location: SubjectLocation; disposition; reason; executedAt }` (`model/governance.ts:1975`) inside
`items: ErasurePlanItem[]` — an array, not a total `Record` over the kinds. There is **no exhaustive
switch on `SubjectLocation.kind` anywhere**: `purgeVerdict()` (`model/governance.ts:1923`) does not
read it, and the only construction site in the tree is `acmeBiDatasetLocation`
(`model/examples.ts:1168`), which constructs **one** variant and is unaffected by a twelfth. So
adding the variant is a compile error **nowhere**. Meanwhile green's own migration
(`0002_held_work.sql`, §3.5) inserts no `subject_index` row, and neither `holdAdmissible()` nor
`replaceAdmissible()` returns a `SubjectIndexEntry` (`model/governance.ts:1868`) for a caller to
write. The union's own header states the rule the design then does not follow:
*"Written at CREATION time, not discovered by scanning … an erasure design that depends on finding it
later will quietly miss it"* (`model/governance.ts:1744`).

**This is the G75 shape.** It would be recorded as applied — the variant is in the union, the wire
enum moves, `tools/check-wire-mirror.mjs` goes green — and be **inert**, because the list that
actually decides whether erasure reaches a row is the set of INSERT statements, and nobody named it.

**Failure scenario.** Tenant `ten_acme`. Operator R. Bautista types a rejection reason on exception
C.4: *"Spoke to Ms Tan (AP, Meridian Logistics, +65 9xxx) — she confirms the credit note was never
issued."* It autosaves; one `held_edit` row, `closure_kind='open'`. Nine days later Ms Tan files a
PDPA erasure request. `handleSubjectRequest` builds the plan from `subject_index`. There is no entry
for the draft. The plan enumerates documents, correspondence, blobs and the BI dataset, reports
`completed`, and the name is still in the database — **undisclosed**, which green's own §3.4 says an
honest plan cannot do (*"the disposition is never `out_of_reach` … this copy is ours, in our store,
deletable"*).

**Closing control.** The hold must write its `SubjectIndexEntry` in the **same transaction** as the
`held_edit` row, and the design must say so in the migration and in the function signature — not in
prose. A `SubjectLocation` variant with no writer is `docs/HANDOFF.md` §5.6 exactly.

### B2 — `HeldEdit.maxDataClass` is not computable for the flagship artifact, and the prerequisite green names does not unblock it.

**Claim.** Green makes `maxDataClass: DataClass` a **required** field (§3.2.3) — *"the highest
`DataClass` anything in `subject` carries"* — and defers it to §7.9, the single `DataClass` ladder.
That prerequisite is the wrong one, and the field is unanswerable for author-typed prose whatever
happens to the ladder.

**Evidence.** Invariant 4: *"Classification is declared once, on `FieldSpec`, and everything derives
from it."* `dataClass` and `modelProcessingAllowed` sit on `FieldSpec` (`model/domain.ts:1726`,
`model/domain.ts:1731`) and nowhere else that a draft could reach. A rejection reason is a sentence a
person typed; it corresponds to no payload key and therefore to no `FieldSpec`, so it has **no
class**. The ladder unification `model/policy.ts:1692` owes is about reconciling four copies of an
*ordering*; it does not assign a class to something that has none. Green's `holdAdmissible()` refuses
`field_not_classified` for *"a subject naming a payload path with no `FieldSpec`"* — mirroring
`admitPopulation()`'s four sites (`model/reconciliation.ts:1015`, `:1030`, `:1044`, `:1062`) — but a
prose field names no path, so the gate does not reach it.

The design is therefore caught either way:

- If prose IS in scope of the G106 gate, arm 2 — *the* artifact `Mockups/rec/Login.dc.html:173`
  promises, verified verbatim: *"Your rejection reason on C.4 is held, unsubmitted"* — **can never be
  held**, because it will always refuse.
- If prose is NOT in scope, the row stores counterparty-adjacent text with **no class, no redaction
  reader, and `modelProcessingAllowed` unreachable** — and `maxDataClass` is populated by a guess.

Green half-sees this in §7.7b and files it as *"pre-existing, not created by me"*, on the ground that
the submitted `ApprovalDecision.reason` has the same problem. That is true of the READ (G39's
amendment) and false of `maxDataClass`: green **invented** a required, stored classification field for
exactly the content that has no classification to store.

**Failure scenario.** Same draft as B1. `holdAdmissible()` returns `ok: true` (no path named), the
row is written with `max_data_class = 'internal'` because something had to be written, and a
subsequent export or dashboard reads it as `internal` while the sentence contains a name, an employer
and a mobile number. Fail-open, which `CLAUDE.md` invariant 4 records this codebase already fixing
once.

**Closing control.** A **declared** class for author-typed prose, on the arm, at the point of use —
the way the usage-event stream's `tenantRef` argues its exception to invariant 1 at
`docs/contracts/control-plane.openapi.yaml:1188`. Not derived from `FieldSpec`, because there is no
`FieldSpec` to derive from. Until that exists, `maxDataClass` should be absent rather than guessed.

### B3 — There is no idempotency key anywhere, in a design whose stated motive is retry.

**Claim.** `grep -ci idempot docs/build/stateless-green-user-artifacts.md` → **0**. The ruling's own
words are *"for ease of retry in case a node fails."* The design answers retry with a type-level
barrier, which says nothing about repeats.

**Evidence, and the house already has the pattern.** `MeterFact.idempotencyKey`
(`model/reconciliation.ts:2553`) is documented *"`${providerRequestId}#${meter}` or
`${runId}#${meter}`. **Never bare.**"*; the wire half is at `model/reconciliation.ts:2525` —
*"`/metering/record` is idempotent on `idempotencyKey` and answers `409 IdempotencyConflict`"*. G120
requires `ReaderOutcome` *"persisted keyed by `(runId, requestOrdinal)`, which is what makes a retry
granular"* (`docs/HANDOFF.md:846`). Green reuses none of it. `submitAdmissible()` (§3.2.5) *"answers
COMPLETENESS and COUNTERPART only"*, and the design never states that the effect write and the
closure UPDATE are one transaction.

**Failure scenario, approval arm.** R. Bautista submits a rejection. The node commits the
`ApprovalDecision` row, `authorize()` has minted its grant, and the node dies before the
`closure_kind='submitted'` UPDATE. The load balancer retries on another node; the draft still reads
`open`; `submitAdmissible()` returns `ok`; a **second** `ApprovalDecision` is written. The type
permits it explicitly — *"there are deliberately several of these rows per `proposalId`, and
`(proposalId, decidedBy)` is not a key either"* (`model/domain.ts:3436`). Quorum survives because it
counts distinct approvers, but the audit stream now carries two authorised human acts where one
occurred.

**Failure scenario, disposition arm, worse.** Same interruption on a drafted journal. The retry mints
a **second** `ResolutionProposal` with a second `ProposalId`, and `Exception.resolution` is a single
field — *"The current resolution. Null while unresolved"* (`model/domain.ts:3027`). The second write
replaces the first. Two proposals exist, one resolution points at the second, and the first is an
orphan with a `MeterFact` and an `AuditEvent` behind it.

**Closing control.** Submission takes a durable idempotency key; `(heldEditId, sequence)` is already
the natural one and needs no new field. The effect write, the grant, and
`UPDATE … SET closure = 'submitted' WHERE closure_kind = 'open'` are **one** transaction, and a
retry that finds `closure_kind='submitted'` returns the first effect's id rather than a refusal.

### B4 — The partial unique index conflates every anchorless draft, and its failure mode is silently overwriting a person's work.

**Claim.** `held_edit_one_open` (§3.5) keys on
`(tenant_id, author_user_id, subject_kind, coalesce(anchor_id,''), coalesce(anchor_path,''))`. Arm 4,
`operator_transaction`, has **no anchor** — green says so at §3.2.1: *"No anchor: `OperatorProposal`
deliberately carries no `exceptionId` (G44)."* So every draft operator transaction by one author in
one tenant collapses to the single key `(tenant, author, 'operator_transaction', '', '')`.

**Evidence.** `anchor_id` is `GENERATED ALWAYS AS (subject ->> 'anchorId')`, and arm 4's subject has
no `anchorId` key, so the generated column is NULL for every such row and `coalesce(…,'')` maps them
all together. The design's own §3.5 comment tells the client what to do on collision:
*"TWO TABS, ONE ARTIFACT: the second tab does not create a second row. It finds the same row."*
Applied to arm 4 that instruction is a data-loss instruction.

**Failure scenario.** An operator drafts a post above the floor for order `PO-4471`. Without
discarding it, they open `PO-4482` and start a second draft. Per §3.5 the client finds the existing
open row and issues the replace statement, which sets `subject = $3` and `sequence = sequence + 1`
and **returns success**. `PO-4471`'s draft is gone, no refusal was raised, and the ruling's whole
purpose — not losing a person's half-finished work — is defeated by the control written to serve it.
The alternative branch is no better: a raw `23505` unique violation with no arm in `HeldEditRefusal`
to carry it.

**And it collides with G43 in the opposite direction to green's §7.7c.** Green argues drafts *"lower
the cost"* of assembling a split unobserved. This index makes the legitimate multi-order case
impossible while doing nothing about the bypass, which is the worst of both.

**Closing control.** Arm 4 needs an anchor of its own identity, or the uniqueness for anchorless arms
must key on the `HeldEditId` the client already holds. One open draft per (author, anchor) is only a
sound rule where an anchor exists.

### B5 — The cold-start two-tab race produces a driver exception, not a refusal with a reason.

**Claim.** §3.5 gives the UPDATE and never gives the INSERT. `HeldEditRefusal` has nine arms and none
of them is *"an open draft already exists"*; `not_current` cannot serve, because it carries
`currentSequence` and a first-write client has no sequence to be stale against.

**Evidence.** The unique index is the enforcement (green's §4: *"A unique constraint, in the store"*),
and a unique-index violation surfaces from `pg` as an error, not a value. The design's stated
discipline is the opposite — §3.2.5: *"A REASONED UNION AND NEVER A BOOLEAN"*, and §3.2's header:
*"Failures are values."*

**Failure scenario.** One user opens exception C.4 in two tabs (the ordinary way people compare a
document against a register). Both tabs debounce at 800ms and both fire their **first** autosave
inside the same window. Neither row exists yet, so both INSERT. One commits; the other raises
`23505` and the tab shows a 500. The first thing a user experiences on the surface built to reassure
them that nothing was lost is an unexplained failure.

**Closing control.** `INSERT … ON CONFLICT DO NOTHING RETURNING sequence`, plus a
`{ kind: 'open_draft_exists'; currentSequence: number }` arm so the second tab can adopt the row
instead of failing. Zero extra round trips.

### B6 — `purgeAfter` recomputed from `lastHeldAt` makes the retention window unreachable, and green forecloses the fix.

**Claim.** Green sets `purgeAfter` from `RetentionPolicy.days.held_edit` *"at every hold, and
recomputed from `lastHeldAt` rather than fixed at `heldAt`"* (§3.2.3). The sweep is
`WHERE purge_after <= $now` (§3.5). A row that is touched keeps its expiry in the future forever.

**Evidence.** The whole argument for minting a fourteenth retention class rather than filing held
work under `exception` is PDPA Retention Limitation — green's own §3.3: *"filing it as `business`
retains a person's abandoned prose for the whole exception window. PDPA Retention Limitation is the
cost, and it is the wrong direction to be wrong in."* The chosen mechanism reintroduces an unbounded
window through the back door. Green then closes the exit: *"THERE IS EXACTLY ONE WINDOW AND IT IS NOT
HERE … A second `maximumOpenDraftAgeDays` on this interface would be two answers to one question —
§5.3."* Those are two different questions: **idle expiry** and **absolute lifetime**. `SourceDocument
.purgeAfter` computes once at ingest precisely because a document has an absolute lifetime.

**Failure scenario.** A dashboard-style tab left open on a shared workstation, or any client with a
heartbeat autosave, touches one `held_edit` row every few minutes. Ms Tan's name, mobile number and
employer sit in `subject.draft.reason` for eighteen months. The sweep never selects the row.
`purged_at` is never set. Combined with B1, nothing else can find it either.

**Closing control.** `purge_after = least(held_at + maxOpenDraftAgeDays, last_held_at +
days.held_edit)`. Two numbers, two questions, one column — and the second number is counsel's, which
green's §7.4 already has the machinery to refuse on absence.

---

## SERIOUS

### S1 — *"An unapproved draft is not constructible as an effect"* is false; only the brand substitution is impossible.

`ExceptionResolution`'s `manual` arm (`model/domain.ts:2855`) requires `dispositionKey`, `proposalId`,
`executedBy`, `at` — **no approver at all**, by design: *"The person who acted. A different fact from
proposer and from approver."* The `approved` arm's `approvedBy: UserId[]` admits the empty array, so
*(approved, approvedBy: [])* is a legal value. Once the submit seam mints the `ResolutionProposal`
that promotion requires, **nothing in the type distinguishes an approved effect from an unapproved
one.** Green's §4 row overclaims — *"an unapproved draft is not constructible as an effect — no
runtime check involved"*. §1.1's narrower sentence — *"a held draft that carries a `HeldEditId`
instead is not constructible as an effect"* — is the true one, and it forbids only a substitution
nobody attempts. **Closing control:** state the property as *"a `HeldEditId` is not a `ProposalId`"*,
delete the stronger sentence, and say plainly that approved-versus-unapproved is `ApprovalDecision`'s
job and is not in this design.

### S2 — Two effect paths bypass the headline chain, and the design never cites the control that does hold on one of them.

`ExceptionReversal` (`model/domain.ts:2924`) carries `reversedBy: UserId`, `note: string | null` and
`correctedDispositionKey: string | null`, has **no `proposalId`**, and lands in
`Exception.reversals[]` — so a reversal can substitute a different disposition on a resolved
exception with no proposal and no approval. Green's exclusion of draft reversals (artifact #14) is
honest and I accept its reason. The finding is that the headline property is scoped to
`ExceptionResolution` and must say so. Separately, arm 4's effect path is `OperatorProposalId`, a
different brand entirely (`model/kernel.ts:145`), and the control that actually governs it is
`OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false` (`model/domain.ts:3864`) — which the design
never cites for the arm it protects, while citing `ExceptionResolution` for an arm it does not reach.

### S3 — G127's argument is borrowed; G127's mechanism is not. A draft write-off is constructible and no query can see it.

G127 is **applied**, and `docs/HANDOFF.md:853` records the mechanism: *"`LearnedDisposition` is
narrower than `SetDisposition`, so a learned write-off is not constructible on this path."* A
narrowed union. Green quotes G127's sentence — *"the boundary must be expressed in the TYPE, not in
prose"* — and then derives `HeldDisposition` by `Partial<Omit<ResolutionProposal, …>>`, which inherits
`dispositionKey: string` (`model/domain.ts:3416`) and `adjustment: Money | null`
(`model/domain.ts:3425`) unchanged. A draft whose `dispositionKey` is `'write_off'` carrying
`adjustment` is fully constructible, and both live inside the `subject` JSONB column with **no
generated column**. Green cites `docs/persistence-design.md:223` (*"Anything else that turns out to
need a `WHERE` gets promoted to a column"*) to justify promoting `subject_kind` and `anchor_id`, and
does not apply it to the money. **Consequence:** *"list every open draft proposing a write-off above
50,000"* is not a query this schema can answer without a full JSONB scan, and an unapproved draft
write-off is indistinguishable from a draft suspense to anything but the application. **Closing
control:** promote `disposition_key`, `adjustment_minor` and `adjustment_currency` to generated
columns, and narrow the draft's disposition the way G127 narrows the learned one.

### S4 — `Money` inside JSONB with no codec. G65 will not fail the typecheck; it will throw on the autosave path.

`Money.amountMinor` is `number` (`model/domain.ts:535`) and G111's one-codec ruling is **not
applied**. `subject` is `jsonb`, so `subject.draft.adjustment` round-trips through
`JSON.stringify`/`JSON.parse` on every hold. Green's fixture 3 says it *"will go red when G65's
`bigint` retype lands, which is the point."* The typecheck going red is not the failure that matters:
`JSON.stringify({ amountMinor: 1n })` throws `TypeError: Do not know how to serialize a BigInt` — at
**runtime**, inside an interactive request, on the money-bearing arm. Nor is there any integrality
check on the way in, where `tokenMeterFacts()` guards its own quantities with `Number.isInteger`
before emitting (`model/reconciliation.ts:2558`). Green's *"Nothing here touches money"* (§3.2.2) is
the sentence to strike: the row **stores** money and the store is a serialisation boundary. **Closing
control:** the G111 codec is a prerequisite of this table, not a wire concern — a draft body is a
wire-shaped document that happens to be at rest.

### S5 — Both new assertions are keyed on field NAMES, and the house already has the type-keyed form.

`CarriesNoCommittedId<M>` maps `K extends 'id' | 'proposalId' | 'exceptionId'` to `never`;
`CarriesNoAuthorisation<M>` maps `K extends 'authorizationId' | 'authorisationId'`. A body that gains
`grantId: AuthorizationGrantId`, or `resolutionId: ProposalId`, or `decisionId: ApprovalDecisionId`,
passes **both** in silence. `model/identity.ts:1139` already does the stronger thing —
`{ [K in keyof T]: string extends T[K] ? never : T[K] }`, keyed on the TYPE, not the name — and
`AssertNoTextDeep` (`model/reconciliation.ts:258`) is the same discipline. So the design chose the
weaker of two available house forms while citing the house, and `CLAUDE.md` names this shape as
*"the most common defect in this codebase"* (§5.1). **Closing control:**
`[K in keyof M]: M[K] extends AuthorizationGrantId ? never : M[K]`, and the same over
`ProposalId | ExceptionId | ApprovalDecisionId | OperatorProposalId`. The name-keyed forms can stay
beside it; they are cheap.

### S6 — `model/identity.ts` is untouched, and it is the module whose entire job is to prove what this design's headline rests on.

`grep -n identity docs/build/stateless-green-user-artifacts.md` returns exactly one hit, and it is the
word *"identity"* inside an unrelated comment. `identity.ts` is the module that makes the brand
discipline mechanical, and three of its proofs are **hand-maintained maps** that a new entity and a
new brand must join: `_BrandArgumentsNameTheirEntities` (`model/identity.ts:213`),
`_EntitiesCarryTheirOwnIdentity` (`model/identity.ts:502`), `_NoIdShapedReferenceIsABareString`
(`model/identity.ts:962`), with `AssertIdentity` (`model/identity.ts:147`) as the per-entity form.
`HeldEditId = Id<'HeldEdit'>` would be the first brand in the model with no identity proof, `HeldEdit`
the first entity absent from the entity map, and the module's own header claim — *"THE LEAF. This
module imports everything"* — would become false the moment a nineteenth module exists that it does
not import. **This is B1's shape a second time and it is the G75 shape:** the design would be
recorded as applied while a list nobody named leaves its central mechanism unproven. **Closing
control:** three rows in `model/identity.ts` in the same commit as the brand, each written red first.

### S7 — The fourteenth retention class breaks `npm run check` on lines the design does not list, and the one governed line it does cite is the wrong one.

`node tools/check-doc-counts.mjs --derive` reports `13 retention classes` as a governed total.
`docs/HANDOFF.md:225` states **13** with its reproducing command, and
`docs/build/stateless-green-session.md:1327` states it as a digit too — both go **STALE**, exit 1, on
the commit that adds `heldEdit`. Green's mutation table row 10 names `docs/HANDOFF.md:225` as *"the
modules line"*; `:225` is the retention-classes row. So the design accounts for 18 → 19 modules and
not for 13 → 14 retention classes, which is the change it actually makes to a governed count.
Separately, `docs/contracts/foundation.openapi.yaml:903` carries the prose *"Mirrors SubjectLocation
in model/governance.ts — ELEVEN variants, checked against the union on 8 Aug 2026"*.
`tools/check-wire-mirror.mjs` compares the **enum**, not the description, and
`tools/check-doc-counts.mjs` reads Markdown, not YAML — so a twelfth variant leaves that sentence
wrong with nothing in the repository able to catch it.

### S8 — The reason given for an unauthorised write of personal data does not hold.

Green: a hold *"does NOT mint an `AuthorizationGrant`"* because
`MAX_AUTHORIZATION_SECONDS.tenant_data = 900` (`model/access.ts:1530`) *"and a draft lives for days; a
grant covering it would be the first long-lived grant in the system."* Nobody proposed a grant
spanning the draft's life. A hold is one API call; `authorize()` (`model/access.ts:1659`) mints a
grant **per act**, and 900 seconds is a ceiling on one authorisation's validity, not a statement about
how long the thing it touched survives. The honest reason is the **volume** reason green gives two
bullets later for declining the audit row, and it should be given once for both. As written, the
design has a durable write of personal data into a tenant's database with no grant and no audit row,
resting on a premise that misreads the constant it cites — and invariant 10's
`AUTHORIZATION_MAY_BE_ABSENT` names `system` as the only actor kind permitted to leave it null, which
a person typing is not. **Closing control:** one argument, volume, for both; and name the coarser
record green's own §9 Q6 proposes — one row per draft lifetime, not per hold.

### S9 — *"May legitimately be lost"* is decided by a scope carve-out the ruling does not contain, and the design applies one reading to itself and the opposite to G120.

Green's §0 asserts *"The ruling binds the SERVER, not the browser"* and states plainly that this line
*"is the difference between eleven durable artifacts and four."* The ruling names *"other user
artifacts"* and says nothing about tabs versus nodes. Green then, in §7.7a and §9 Q1, **refuses** to
choose between the literal and operational readings for G120 because *"only the owner can say which
governs"* — having already chosen, in its own favour, for artifacts #6, #7 and #8. On #6 concretely:
fourteen of sixty rows ticked is defended as encoding *"no judgement (the rows are re-findable because
the register order is deterministic)"*. **Which** fourteen a person selected after reading sixty is
not derivable from an ordering however deterministic, and nothing in the tree establishes that the
register order is deterministic — I could not verify that claim. On #7 the authority cited is
`model/presentation.ts:180`, whose drop note does say *"no saved views"* (verified verbatim) — that
one holds for v1; but the accompanying claim that *"a filter is derivable from the URL the browser
holds"* is an unstated implementation requirement on a client nobody has written, not a fact about
the tree. **Closing control:** §0 becomes owner question **Q0**, ranked above green's Q1, and #6, #7
and #8 are marked BLOCKED on it rather than disposed of.

---

## NOTED

### N1 — Citation drift, in the class `check:citations` cannot catch, plus six it did.

`npm run check:citations` exits 0 with `DEAD 0` and reports **six SUSPECT lines in the green file**:
`:34` → `model/access.ts:1533` (`/**`); `:258` → `model/domain.ts:3427` (`}`); `:406` →
`model/domain.ts:3283` (`*/`; `superseded: 'superseded'` is `:3284`); `:443` →
`model/domain.ts:3327` (the field is `sequence: number` at `model/domain.ts:3323`); `:644` →
`model/reconciliation.ts:1010` (blank); `:666` and `:842` → `model/domain.ts:3300` (`*/`; the quoted
sentence *"enforce it in the store, not in the caller"* is `model/domain.ts:3297`). Three more resolve
to real lines and so are invisible to the checker: `propose_resolution` and `approve_resolution` are
`model/access.ts:569` and `model/access.ts:575`, not `:568,572`; the denormalisation argument green
attributes to `AuthorizationGrant.resourceClass` at `:1451` is `ResourceRef.resourceClass` at
`model/access.ts:1466`, and `ResourceRef` itself declares at `model/access.ts:1471`; `api_calls` is
`model/billing.ts:82`, not `:83`. None changes an argument; all are the defect class `CLAUDE.md`
warns about, in a document whose banner says every line was opened.

### N2 — The refusal is textless; the wrapper it travels in is not.

`AssertNoTextDeep<HeldEditRefusal>` holds, but `RefusedHold` carries `path: FieldPath | null` and
`export type FieldPath = string` (`model/kernel.ts:423`). So the value a caller actually logs or
attaches to a span is text-bearing and unasserted. Green mirrors `RefusedItem`
(`model/reconciliation.ts:860`) knowingly, so this is house-consistent — but the property claimed for
`HeldEditRefusal` does not extend to what leaves the function, and §4's row implies it does.

### N3 — `draft_incomplete` would become the sole home of a rule the committed type does not carry.

`ApprovalDecision.reason` is `string | null` (`model/domain.ts:3450`) under the comment *"Rejection
always requires a reason."* The type does not enforce it. Green's `submitAdmissible()` must therefore
enforce *rejected ⇒ reason non-null* — a rule living in a caller, which is the shape §5.5 exists
against and which green invokes four times. **Closing control:** narrow the committed type
(`{ decision: 'approved' } | { decision: 'rejected'; reason: string }`) in its own commit; the draft
then inherits the rule for free through the `Omit`, which is the design's own best argument.

### N4 — The replace statement cannot use the primary key.

`PRIMARY KEY (tenant_id, id)` with `WHERE id = $1` omits the leading column, so every autosave scans
the RLS-visible slice rather than seeking. Green defends dropping the `tenant_id` term on §5.3
grounds and the argument is coherent for **correctness**; the **cost** belongs in §7.2, which already
says the interactive path now contains a write.

### N5 — The comment green relies on for its retention witness is itself stale.

`model/domain.ts:1185` reads *"⚠️ THIS EXISTS BECAUSE NOTHING IN `model/` CONSTRUCTS A
`RetentionPolicy`."* `PLACEHOLDER_RETENTION_POLICY` (`model/examples.ts:534`) constructs one, with
thirteen keys. Green's claim is **right** and its cited authority contradicts it. The correction
belongs in `model/domain.ts`, not in this design — recorded here so it is not lost.

### N6 — Metering: green answers it, and one consequence is undisclosed.

`METERS` is eight members (`model/billing.ts:75`) with `api_calls` among them
(`model/billing.ts:82`), so green is right that no new meter is needed, and right to escalate the
trade to the owner. The undisclosed part: `METER_AGGREGATION.api_calls = 'sum'`
(`model/billing.ts:112`), so under invariant 5 — *"a raw usage record is volume in the clear"* — the
metering table becomes a **per-person count of autosave debounces**, legible to anyone who may read
`metering`. That is a new observability of an individual's typing cadence that no screen discloses and
no consent covers. It belongs beside green's Q2, not inside it.

---

## STRUCK — attacks I tried and could not sustain

Named, because an attack on a false premise is worse than no attack.

1. **"The wire-mirror pinning claim is false."** STRUCK. `tools/check-wire-mirror.mjs:74` registers
   `subject_location` and `tools/check-wire-mirror.mjs:99` registers `retention_classes`; the header
   at `tools/check-wire-mirror.mjs:14` states the comparison is *"AS SEQUENCES. Equal sets in a
   different order are still reported"*, and `drift` exits 1. Green's claim is exactly right,
   including the append-not-insert requirement and mutation 9.
2. **"§5.10 applies — nothing constructs a `RetentionPolicy`, so `tsc` tells nobody anything."**
   STRUCK, twice over. `RETENTION_RECORD_KIND` is a real `Record<RetentionClass, RetentionRecordKind>`
   literal at `model/domain.ts:1135`, and `PLACEHOLDER_RETENTION_POLICY` at `model/examples.ts:534` is
   a second construction site. A fourteenth class is `TS2741` in both places. Green's mutations 4 and
   5 are sound.
3. **"A brand mismatch is not really `TS2322`."** STRUCK. `model/kernel.ts:29` and
   `model/kernel.ts:43`, and `model/domain.ts:3910` already quotes the error text for the sibling
   case.
4. **"The design invents a number."** STRUCK. `HoldPolicy.minimumHoldIntervalSeconds` has none and
   refuses on absence; `days.held_edit` has none; both are escalated. `PRODUCT.md` is honoured
   throughout.
5. **"`holdAdmissible`'s caller-supplied map is a §5.2 off-switch."** STRUCK on polarity. An empty
   `ReadonlyMap` refuses every classified path rather than admitting it, matching
   `admitPopulation()`'s four refusal sites (`model/reconciliation.ts:1015`, `:1030`, `:1044`,
   `:1062`) and G100's deny-on-NULL. A caller with a motive to weaken the check gains nothing. Green
   flags the shape itself and its answer holds. (The **separate** problem is that prose never reaches
   the gate at all — B2.)

---

## WHERE THE GREEN TEAM IS RIGHT AND I COULD NOT BREAK IT

- **The type-level core.** The brand is nominal, the mismatch is a compile error, and all three arms
  of `ExceptionResolution` really do require a `ProposalId` (`model/domain.ts:2855`). The mechanism is
  sound; only the sentence wrapped around it is oversold.
- **The retention-class choice, including all three rejected alternatives.** `content` over
  `exception`, `operational` and `trace` is argued from the tree, and `AUDIT_MUST_OUTLIVE.content =
  true` (`model/domain.ts:1167`) does make a misclassification lengthen the audit window rather than
  shorten it — the conservative direction, as claimed.
- **The wire-mirror discipline.** Both enums are genuinely pinned and the append-not-insert rule is
  real. This is the one part of the design that cannot be recorded as applied while inert.
- **Refusing to build the fifth `DataClass` ladder.** A refusal to build the wrong thing, stated as a
  control, with the owed commit named. That is the right call and it costs the design a feature it
  wanted.
- **`Omit` + `Partial` instead of a second vocabulary.** Derivation makes divergence structurally
  impossible, which is the correct answer to §5.3, and it is why S3's and S4's inherited fields are
  *findable at all*.
- **The free §7.6 fix.** Verified: `db/tenant-scope.ts:123` really does discard the return of
  `SELECT set_config($1, $2, true)`, and `set_config` returns the value it set. Zero round trips,
  and it disambiguates deny-on-NULL from optimistic-concurrency failure at the only place that can.
  This finding is worth more than several of mine.
- **The sourcing.** `Mockups/rec/Login.dc.html:173` carries the promise verbatim — *"Your rejection
  reason on C.4 is held, unsubmitted. Nothing was posted while you were away."* The artifact list is
  derived from the drawn product, not imagined, and the four excluded arms each carry a reason.
- **The honesty of §7 and §8.** Nine unsolved items, seven owner questions, the G120 reading conflict,
  the D1 dependency, the un-provisioned PostgreSQL, and the explicit *"NOT VERIFIED against a running
  server"* on the SQL. A design that names its own un-run verification is doing the thing this
  repository is for.

---

## THE ONE THING THAT MUST BE TRUE BEFORE ANY DRAFT IS PERSISTED

**A hold must write its `SubjectIndexEntry` in the same transaction as its `held_edit` row, and the
design must name the `subjectRef` for author-typed prose.**

Everything else on this surface is recoverable later. This is not. `SubjectLocation` is *"Written at
CREATION time, not discovered by scanning"* (`model/governance.ts:1744`), and green's own §7.3 states
the consequence correctly for the variant while omitting it for the write: a held row created before
its index entry exists is **permanently outside the erasure index**, and no migration can find a name
inside a sentence nobody parsed. The twelfth variant is necessary and is not sufficient — a
`SubjectLocation` arm with no INSERT behind it is the G75 shape, recorded as applied and doing
nothing.

Until that write exists, and until B2 says what class governs the prose it indexes, the correct number
of persisted drafts is zero.

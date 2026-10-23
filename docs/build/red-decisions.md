# Red team — the decision set, G49–G71

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — an adversarial pass over G49–G71. It finds defects; it decides nothing, and nothing in it is applied.
> ⚠️ **Its scope ENDS AT G71. Fifteen decisions have been taken since** — G72–G86, `docs/HANDOFF.md` §3 pass H — and several answer findings here.
> ⚠️ **Finding RD-5's evidence is dead and its prediction came true.** It quotes a comment in `model/governance.ts` that G75 deleted on 8 Aug, and it argues for the shape G75 rejected. **But its core warning went unheeded:** RD-5 asked that every restatement of `secret`'s non-delegability move in the same commit as `secret` itself, and `model/domain.ts` still carries one — invariant 11's own stated justification — that is now false in the tree.
> ✅ **BODY CORRECTED 8 Aug 2026, AND THE BANNER ABOVE UNDERCOUNTS.** RD-5 is corrected in place: the dead `governance.ts` quote is marked dead (it survives only as a quotation inside its replacement at `governance.ts:527-541`), the drifted `domain.ts` citation is repointed, and the *"why it fails"* paragraph is corrected — **G75 makes `secret` purpose-openable, not contract-openable, so RD-5 understated its own finding.** ⛔ **`model/domain.ts` carries TWO surviving false restatements, not one — `:2360-2361` and `:2484-2486`** — and the second is the stated justification for a schema obligation. Both are in `model/`, which this document may not edit; they are reported at RD-5.
> *Banner added 8 Aug 2026; body corrected the same day.*

> **ADVERSARIAL. This document exists to find what is wrong.** It is not a plan and
> it is not balanced. Twenty-three decisions were taken on the evening of
> 7 August 2026; several reverse earlier ones; none has been applied to `model/`.
> Everything below is a defect that would produce wrong software if built as
> stated.
>
> **Written 7 August 2026 against `main`.** Every finding cites `file:line` or a
> quoted decision row. Line numbers are as at the time of writing and will drift —
> the quoted text is the durable citation.
>
> **Scope of the read:** `CLAUDE.md` (the eleven invariants), `docs/HANDOFF.md` §3
> in full plus §5 and §7, `docs/v1-trim-proposal.md`, `docs/screen-pack-ledger.md`
> §5–§6a, and the declarations in `model/*.ts` and `docs/contracts/*.yaml` that
> each finding turns on.

**20 findings: 4 BLOCKER · 11 SERIOUS · 5 NOTED.** Ranked worst first within each
band. Every finding closes with **DERIVATION** (the answer follows mechanically
from things already decided — it is not deferrable, deferring it is choosing to
ship it wrong, per §7) or **DECISION** (somebody has to choose).

**Areas checked and found genuinely sound** are listed at the foot. That list is
short and it is honest; it is not padding in either direction.

---

## BLOCKER

### RD-1 · BLOCKER · G54 makes Textract unrepresentable, so G69's residency claim is false

**The claim.** G69 (`docs/HANDOFF.md:594`):

> 🟢 **And it extends invariant 7 usefully:** an extraction model resolved through
> the catalogue passes `resolveModel()`, so **residency now covers extraction, not
> just inference**.

Repeated as an override in `docs/v1-trim-proposal.md:42-43`:

> `resolveModel()` (`catalog.ts`) is the **only** enforcement of invariant 7 —
> and G69 widens it, since an extraction model now resolves through it too.

**Why it fails.** G54 (`docs/HANDOFF.md:579`) closes the provider set, and
`docs/v1-trim-proposal.md:197` records the closure as a derivation:

> `provider: 'bedrock' \| 'other'` (`:120`) | **CLOSE to `'bedrock' \| 'sagemaker'`**
> — G54. `'other'` is unreachable, which is §5.6's shape. **A derivation, not a
> decision**

Textract is neither Bedrock nor SageMaker. It is a distinct AWS service with its
own API, and after G54's closure there is **no `provider` value it can take**. It
therefore cannot be a `ModelCatalogEntry`, cannot appear in the catalogue map
`resolveModel()` reads, and cannot be resolved.

The shape is wrong even before the provider closure bites. `ModelCapabilities`
(`model/catalog.ts:87-95`) requires `contextWindowTokens`, `maxOutputTokens`,
`toolUse` and `structuredOutput` — four fields with no meaning for a document
analysis API — and `ModelCost` (`:97-105`) is denominated per million tokens while
Textract prices per page. Entering Textract as a catalogue row means writing four
fabricated numbers into the record invariant 7's only enforcement reads, which
`CLAUDE.md`'s no-invented-data rule forbids independently.

And the only extraction-relevant gate `resolveModel()` has is `requireVision:
boolean` (`model/catalog.ts:~168`), a **caller-supplied parameter** — §5.2's shape,
"an argument the callee could compute itself", on the control that carries
invariant 7.

So: the primary IDP engine of v1 sits **outside** the only executable enforcement
of invariant 7, while three separate documents state that it sits inside. Nothing
in the repository would fail if this were built as written; the first residency
audit would find it.

**What it would take to fix.** Either (a) add a third `provider` arm and make
`ModelCapabilities` a discriminated union with an extraction variant, so a Textract
row is representable without fabricated token numbers — which reopens G54's "no
third arm" as a *provider* question separate from the *model-provider* question it
actually answered; or (b) state plainly that Textract is outside `resolveModel()`
and give extraction residency a second, separately-named enforcement. **Until one
of those exists, G69's 🟢 line must be struck** — it is the most load-bearing false
sentence in the new decision set.

**DERIVATION** that the claim is false. **DECISION** on which repair.

---

### RD-2 · BLOCKER · G58 needs a palette that G37 put in v2, and reverses pass D's authoring rule

**The claims, all three live.**

G58 (`docs/HANDOFF.md:583`):

> **Finance AUTHORS reconciliation definitions in full** … **Tier 2 Save is
> MANDATORY** … **`administration.openapi.yaml` becomes the largest single
> deliverable in v1** rather than a gap.

Pass D (`docs/HANDOFF.md:407`):

> **Customers author values, never expressions** | The permission document is a
> **serialised projection** … Customer configuration is a form over a closed
> schema. **This is what collapses the missing administration tier from ~120 CRUD
> operations to ~16**

G2 (`docs/HANDOFF.md:527`):

> a customer administrator composes from a **pack-declared palette** and cannot add
> a step kind, tool or predicate

G37, and it is one of the eighteen **applied** (`docs/HANDOFF.md:562`):

> **Fork the pack schema later — v2 packs carry the palette, v1 packs do not** …
> ✅ **honoured as an ABSENCE** … `awk '/^export interface SolutionPack \{/,/^\}/'
> model/domain.ts \| grep -ci palette` → **0**.

**Why it fails.** Three ways, and they are independent.

1. **G58 has nothing to author against in v1.** G2 makes the pack-declared palette
   the sole vocabulary a customer may compose from. G37 — *applied* — puts the
   palette in v2 packs only, verified as a literal absence on `SolutionPack`. So
   the surface G58 calls the largest single deliverable in v1 has **no declared
   vocabulary** in v1. This is not a sequencing inconvenience; there is no object
   for the authoring form to be a form over.
2. **"In full" contradicts "values, never expressions".** A
   `ReconciliationDefinition` is not values: it reaches `PopulationSpec`,
   `PairingSpec`, ordered strategies and `RulePredicate`. G56 widens it further —
   "two-way, three-way, one-to-N … it is **NOT a fixed set**". If finance authors
   that in full, pass D is reversed and nobody recorded a reversal. If finance
   authors only values over a closed schema, "in full" is wrong.
3. **The two size claims cannot both hold.** Pass D's rule is what "collapses the
   administration tier … to ~16" operations. G58 says the same tier becomes "the
   largest single deliverable in v1". Sixteen CRUD operations over a closed schema
   is not the largest deliverable in a v1 that also contains a control plane, an
   `Ask` contract tier and a money retype. One of the two numbers is wrong and the
   record asserts both.

G58's own reconciliation with G55 — *"the flexibility is in configuration data, not
in backend code paths. Authoring definitions is one CRUD surface over a closed
archetype set"* — is exactly the **~16-operation** reading. It is a defensible
position. It is not the position the same row's headline states.

**What it would take to fix.** Choose one of three, in writing, before anyone opens
`administration.openapi.yaml`:

- **(a)** Reverse G37 for v1 packs — the palette ships in the v1 signed body, and
  G13's signature-invalidation argument is paid now rather than forked. Largest
  cost, and it makes G58 buildable as written.
- **(b)** Narrow G58 to values-only over a pack-declared archetype, drop "in full"
  and drop "largest single deliverable". Cheapest, consistent with G55 and pass D,
  and it makes G56's "not a fixed set" a claim about *how many definitions* rather
  than *how expressive each one is* — which is a real narrowing somebody must
  accept knowingly.
- **(c)** Mint a v1-only palette outside the signed pack body, and record that a
  v1 authoring vocabulary is unsigned — which G13 exists to prevent.

**DECISION.** Nothing here is derivable. This blocks the largest deliverable in v1.

---

### RD-3 · BLOCKER · G70 does not restore what G68 gave up — the claim is a category error, and it is repeated in two documents

**The claim.** G70 (`docs/HANDOFF.md:595`):

> it **restores structurally what G68 gave up procedurally**: a viewer in tenant A
> cannot address tenant B's data at all, so **invariant 1 holds by construction for
> the BI layer** rather than by a row filter.

And `docs/v1-trim-proposal.md:306-308`:

> 🟢 **G70 buys back most of what G68 gave up:** account-per-tenant makes isolation
> structural again, so **invariant 1 holds by construction for the BI layer** rather
> than by a row filter.

**Why it fails.** G68 quotes the pass-E decision it reverses, and the quote is the
refutation (`docs/HANDOFF.md:593`):

> *"A dashboard is a composition; the canvas is `configuration` and each binding is
> a `tenant_data` read under the **viewer's** scope… opening the canvas does not
> confer the contents."*

What was given up is **intra-tenant viewer scope**. What G70 restores is
**inter-tenant isolation**. These are different properties over different
boundaries. An AWS account boundary answers *which tenant*; it answers nothing at
all about two users **inside one tenant** with different `costCentres`,
`legalEntities`, `definitionIds` or `domains`.

The model says so at the field. `Exception.costCentre` and `.legalEntity` were
added on 7 August precisely because those two dimensions bound on nothing
(`model/domain.ts:2785-2800`):

> **TWO OF THE SIX `AssignmentScope` dimensions bound on nothing:** `costCentres`
> and `legalEntities` narrowed an assignment, typechecked, rendered in an admin UI,
> read correctly in an access review — and matched every row… It reaches past the
> queue: `presentation.ts` intersects BOTH dimensions on every card binding, and
> **its own header uses two users with different cost centres as the worked example
> of why a dashboard does not confer its contents.**

That worked example is the exact case G70 does not touch. Both users are in the
same tenant, therefore in the same AWS account, therefore in the same QuickSight
account, therefore see the same rows unless something filters them — which is G68's
RLS and nothing else.

A fourth dimension is worse than unenforced: `AssignmentScope.solutionIds` narrows
to a `Solution`, and `Solution` is `@dropped-for-v1` (`model/domain.ts:2371`). So of
six scope dimensions, the BI surface enforces **zero** structurally and one of the
six has no live subject at all.

The consequence of believing the claim is concrete: whoever builds the BI layer
reads "invariant 1 holds by construction" and does not build the RLS rule
generator, because the record told them it was bought back.

**What it would take to fix.** Three edits, none of them a decision:

1. Strike "restores structurally what G68 gave up" and "buys back most of what G68
   gave up" from both documents. Replace with: *G70 restores inter-tenant
   isolation. Intra-tenant viewer scope remains procedural and rests entirely on
   RLS.*
2. Name the function that computes the RLS rule set — it is `effectiveScopeFor()`
   (`model/access.ts:1291`; note `docs/HANDOFF.md` §5.2 cites `:1148`, which no
   longer resolves — §5.11 again), which already "travels with the answer" for exactly
   this reason — and record that the rule set is **generated, never authored**, or
   it becomes §5.2's shape at fleet scale.
3. Record that `solutionIds` binds on nothing in v1 because `Solution` is dropped.

**DERIVATION.** The falseness follows from G68's own quoted text.

---

### RD-4 · BLOCKER · G61 admits multi-currency and leaves both value ceilings unevaluable

**The claim.** G61 (`docs/HANDOFF.md:586`):

> Documents may be in any currency; **a reconciliation matches within one currency
> and nothing converts during matching or ceiling comparison** — which keeps §5.7's
> refusal … rather than approximating it.

Under G56 (`docs/HANDOFF.md:581`): "**Data sources**, mostly financial, **in
different languages and currencies**."

**Why it fails.** The only currency-aware comparison anywhere in `model/` is
`scopeIsNarrowerOrEqual()` (`model/access.ts:2014-2022`):

```
  if (outer.valueCeiling === null) return true
  if (inner.valueCeiling === null) return false
  if (inner.valueCeiling.currency !== outer.valueCeiling.currency) return false
  return inner.valueCeiling.amountMinor <= outer.valueCeiling.amountMinor
```

That compares **one ceiling to another ceiling** — a grant-to-grant check. It fails
closed and it is correct.

The comparison that matters for G61 — a `ProposedTransaction.value` against a
ceiling — **does not exist**. §5.3 records it in those words:

> Any check that must satisfy both — which is every check on the
> operator-proposal path — has to convert, and **no function in the model does**.

So with multi-currency now in scope, a proposal denominated in USD against
`AssignmentScope.valueCeiling` in SGD has **no defined answer**, and G61 forbids the
conversion that would produce one. The two available behaviours are: deny every
foreign-currency posting — which contradicts G56's premise — or pass it — which
makes the ceiling unbounded for exactly the transactions most likely to be large.
Nobody has chosen, and this repository has already shipped a scope check that failed
**open** once (§5.5: "Scope polarity was inverted and failed OPEN").

It compounds with G43, whose structuring bypass is recorded at the type and
explicitly **not mitigated** (`model/domain.ts:3466-3477`): "A post above a ceiling
splits into two below it and BOTH PASS." Split plus foreign currency is two open
holes on the same field, and the recommended mitigation (a shared correlation id) is
recorded as "still NOT taken" and blocked by nothing.

**What it would take to fix.** State the refusal semantics as a decision, then write
them as a function rather than a sentence: *a `ProposedTransaction` whose currency
differs from the applicable ceiling's currency is DENIED, and the denial reason is a
named member of `DECISION_REASONS`.* Then G61's "nothing converts for ceilings" is
enforceable rather than aspirational, and the tenant-visible consequence — you cannot
auto-execute across currencies — is a product statement somebody accepted.

**DECISION** on the semantics, then **DERIVATION** for the function.

---

## SERIOUS

### RD-5 · SERIOUS · G60 dissolves the only recorded argument for invariant 11, in `CLAUDE.md` and at the type

**The claims.** Invariant 11 (`CLAUDE.md`):

> **A container is never granted.** … you may not be granted one, because the
> assembly reaches a `credentialRef` and granting it atomically would confer
> something no grant may confer at any price.

The model states the same, and states the premise explicitly
(~~`model/domain.ts:2367-2369`~~ → **`model/domain.ts:2405-2415`; the citation
drifted and the text it named has been rewritten**):

> the assembly reaches a `credentialRef`, and `secret` appears in **neither**
> `PERMITTED_RESOURCES` list, so conferring "the solution" atomically would confer
> something no grant in this model may confer.

And ~~`model/governance.ts:449-456`~~ **— ⛔ THIS QUOTE IS DEAD. G75 DELETED THE
COMMENT ON 8 Aug 2026.** It survives only as a quotation inside the replacement at
`model/governance.ts:527-541`, kept there deliberately because it is the argument
G75 was taken *against*:

> **`NON_DELEGABLE_RESOURCES`** … Added 5 Aug. A credential binding is not the
> customer's to delegate to a processor either — and **unlike `statutory` there is
> no break-glass**, because preservation has an analogue here and reading a
> credential does not.

**Why it fails.** ~~G60 (`docs/HANDOFF.md:585`) makes `secret` contract-openable.~~
**G75 went further than G60 and further than this finding assumed: `secret` is not
contract-openable, it is PURPOSE-openable** — it is in `PERMITTED_RESOURCES.delivery`
(`model/governance.ts:474`) and **not** in `CONTRACT_ONLY_RESOURCES`
(`:512`, still `['authority']`). The premise *"appears in neither list"* becomes
false, and *"there is no break-glass"* becomes false — ~~a `SupportAuthorisation`
**is** the break-glass~~ **and not even that: no `SupportAuthorisation` is needed at
all. A delivery grant alone reaches it.** ⚠️ **This finding UNDERSTATED the problem
it found**, which is the rarer direction for an adversarial pass to be wrong in.

Invariant 11's conclusion may well still be right; its stated argument is gone.
`SOLUTION_IS_GRANTABLE = false` becomes a constant with no reason attached, in a
codebase whose whole discipline is that the reason sits at the declaration. The next
person to ask "why can't a solution be granted?" reads a sentence whose factual
predicate no longer holds and reasonably concludes the constant is stale.

Nothing in G60, in `docs/v1-trim-proposal.md` §4.4, or in `CLAUDE.md`'s amendment
touches either comment.

**What it would take to fix.** In the same commit that moves `secret`:

- Rewrite invariant 11's justification on **atomicity and lifetime** — a grant
  confers a standing reach; a `SupportAuthorisation` confers a bounded, purpose-named,
  60-second-per-act reach; conferring the container would confer the former — rather
  than on list membership, which is now a moving fact.
- Rewrite `model/domain.ts:2367-2369` and `model/governance.ts:449-456` to say what
  is now true.

Leaving them is §5.4 ("a claim asserted in a document that the contracts refute")
with the polarity reversed: the code will refute `CLAUDE.md`.

> 🟡 **PARTLY DONE 8 Aug 2026, AND THE PREDICTION WAS RIGHT ABOUT WHAT WOULD BE
> MISSED.** This finding's remedy was accepted in substance and applied to **one**
> of the three sites, and the recommendation to move every restatement *in the same
> commit* is exactly what did not happen.
>
> **Done.** `model/governance.ts:527-541` now narrates the removal and quotes the
> deleted entry rather than dropping it. `model/domain.ts:2405-2415` restates
> invariant 11's argument on the axis this finding named — its own words are that
> the premise *"went false"* and *"the conclusion needed a better argument rather
> than a quieter one."*
>
> ⛔ **NOT DONE — TWO SITES IN `model/` STILL ASSERT THE FALSE PREMISE**, verified
> at the tree on 8 Aug 2026. Both say `bind_secret` maps to a class in **neither**
> `PERMITTED_RESOURCES` list, and both are wrong:
>
> - **`model/domain.ts:2360-2361`** — *"`bind_secret` — the one capability mapped to
>   a resource class in NEITHER `PERMITTED_RESOURCES` list"*
> - **`model/domain.ts:2484-2486`** — *"`bind_secret` is the one capability mapped to
>   a resource class in neither `PERMITTED_RESOURCES` list, and
>   `SOLUTION_IS_GRANTABLE = false` is argued on exactly that reach"*
>
> The second is the more serious: it is the stated justification for a **schema
> obligation** (the composite `(tenantId, id)` foreign key on `Solution.endpointIds`),
> so a reader who checks the premise and finds it false may conclude the obligation
> is stale. **The obligation is not stale — the argument for it is.** ⚠️ These are
> `model/` files and are not this document's to edit; reported, not changed. This is
> §5.4 arriving exactly as predicted three paragraphs above, and the count is **two,
> not one**.

**DERIVATION.**

---

### RD-6 · SERIOUS · G60 + G27 — reaching `secret` reaches a write-capable ledger credential, and the 60-second bound rests on a sentence G27 already falsified

**The claim.** `model/access.ts`, `MAX_AUTHORIZATION_SECONDS`:

> The three short ones are the argument. `secret` is 60 seconds because **binding or
> rotating a credential is one act and there is no second act it enables**

**Why it fails.** G27 (`docs/HANDOFF.md:552`), taken against the recommendation:

> Delta 22 is satisfied in letter — the credential is referenced, never held — and
> the *separation* is not. `domain.ts:548` calls the current shape *"a cliff, not a
> slope"*: **one credential still serves both reading a system and posting to it**,
> so a read-only integration continues to hold the credential that can write to the
> ledger.

Binding a credential therefore enables **every subsequent write through that
endpoint, indefinitely, by anyone**. The 60-second bound bounds the *artefact*, not
the *consequence*, and the sentence justifying the number is false about this model.

There is a specific unconsidered path. `ProposedTransaction` requires an endpoint
with `writebackEnabled` (`model/domain.ts:3434-3438`), gated by
`enable_endpoint_writeback` which is `authority`-class and out of a delivery grant's
reach — a good control. But `bind_secret` is `secret`-class, and under G60 an FDE
reaches it. **Rebinding the credential behind an endpoint that already has writeback
enabled requires no `authority` capability at all.** The `authority` gate protects
the flag and not the credential the flag makes dangerous. That is §5.1's shape — a
rule keyed on a convenient landmark (the flag) instead of the property it protects
(what the credential can do).

**What it would take to fix.** `ServiceConnection` — G27's refused recommendation —
is the structural answer and it is still refused, so the achievable fix is a
conjunction: **rebinding a `credentialRef` on an endpoint with
`writebackEnabled === true` requires `enable_endpoint_writeback` in addition to
`bind_secret`**, checked in a function, not asserted in a comment. And correct the
`MAX_AUTHORIZATION_SECONDS` reason, which is now misleading in the direction of
comfort.

**DERIVATION** for the comment. **DECISION** for the conjunction.

> 🛑 **RE-SCORED 8 Aug 2026 — G75 MAKES THIS FINDING STRONGER, NOT WEAKER, AND IT
> IS THE ONLY FINDING HERE THAT MOVED IN THAT DIRECTION.** Nothing above is
> withdrawn; one word is corrected and the blast radius grows.
>
> **The correction.** The paragraph above says *"under G60 an FDE reaches it"* and
> assumed that reach ran through a signed `SupportAuthorisation`. It does not. G75
> put `secret` in **`PERMITTED_RESOURCES.delivery`** (`model/governance.ts:474`),
> not in `CONTRACT_ONLY_RESOURCES` (`:512`, still `['authority']`), so **an
> ordinary delivery grant reaches `bind_secret` with `authorisation === null`.**
>
> **Why that makes RD-6 worse, precisely.** `MAX_GRANT_HOURS.delivery` is `24 * 90`
> (`model/governance.ts:565`). The reach is therefore **standing, 90 days, every
> customer, without a per-engagement signature** — not the bounded, purpose-named,
> contract-scoped reach this finding was scored against. The 60-second
> `MAX_AUTHORIZATION_SECONDS.secret` bound is unchanged and now bounds an even
> smaller fraction of the consequence: it still bounds the *artefact* and not the
> *indefinite ledger write* the rebinding enables.
>
> **The unconsidered path this finding names gets strictly cheaper to walk.**
> Rebinding the credential behind an endpoint that already has
> `writebackEnabled === true` still requires no `authority` capability — and now
> requires no contract either. **The proposed conjunction is not weakened by G75;
> it is the main thing standing between a delivery grant and a ledger write.**
>
> ⚠️ **NOBODY HAS RE-SCORED THIS ELSEWHERE.** `red-buildability.md`'s sibling
> finding B-f closed on 8 Aug because `bindSecret` became buildable; this one did
> not close and did not shrink. **A finding closing next door is not evidence that
> this one did.** Its **DECISION** is open and is now more urgent than when it was
> written. G75's *"do not relitigate it; do not quietly narrow it back"* forbids
> re-narrowing `PERMITTED_RESOURCES` — **it does not forbid the conjunction, which
> constrains a different act at a different gate.**

---

### RD-7 · SERIOUS · G68 loses classification at the BI boundary — invariant 4, and nobody noticed

**The claim.** Invariant 4 (`CLAUDE.md`): "**Classification is declared once**, on
`FieldSpec`, and everything derives from it." At the field
(`model/domain.ts:1563-1567`):

> Classification travels with the field definition, so **masking and export rules
> are derived from the pack** rather than reimplemented per screen.

**Why it fails.** A SPICE dataset is a copy of extracted field values in a store
that carries no `dataClass` column and no link back to `FieldSpec`. Every control
derived from classification — masking, `permitInOutput`, the export gate, the
telemetry classification ceiling — stops at the copy. "Everything derives from it"
becomes "everything except the surface the product's BI story runs on".

The record catches the *erasure* consequence and misses this one entirely. G68's
three recorded consequences are: verbs with no noun, no `DataAccessEvent`, and
"a QuickSight SPICE dataset is a copy of tenant data outside our erasure plan".
`docs/v1-trim-proposal.md` §4.4 proposes an eleventh `SubjectLocation` variant to
close the erasure gap. **Erasure is not classification.** Knowing where a copy lives
so you can delete it says nothing about whether a `sensitive_personal` field should
have been copied there in the first place.

It also extends §5.6's open V7 — "A gate present on three paths and absent on the
fourth. Prompt, telemetry and outbound all carry a classification ceiling. **Screen
does not**". BI is now the fifth path and it has none either, and unlike the screen
it materialises a persistent copy.

**What it would take to fix.** The shape already exists: G7 specifies
`maxDataClassToService` for managed services. Apply the same shape to the dataset
build — **a `maxDataClassToBI` ceiling evaluated where the extract leaves the
plane**, so a field above the ceiling never reaches SPICE. If that is refused,
record in writing that the BI copy is unclassified tenant data, because a regulated
customer's first data-protection questionnaire asks exactly this.

**DECISION.**

---

### RD-8 · SERIOUS · G49, G50, G59 and G61 create act families that no capability names — invariant 10 cannot reach any of them

**The claims.** Invariant 10 (`CLAUDE.md`): "`authorize()` mints an
`AuthorizationGrant` and nothing else does." G50 (`docs/HANDOFF.md:575`) puts "model
catalogue, pack and policy publication, tenant provisioning, and `TenantAccessGrant`
issuance" in v1. G49 (`:574`) says so about itself: "⚠️ **No capability names the
act.**"

**Why it fails.** `authorize()` is keyed on `Capability`, and
`CAPABILITY_RESOURCE_CLASS` (`model/access.ts:426`) is total over **36**
capabilities. Reading the list, none of them is: publish a pack version, publish a
policy, provision a tenant, issue a `TenantAccessGrant`, set a model, or set an FX
rate. `install_pack` is the tenant-side install, not the control-plane publication.

So **every operation G50 puts in v1 is unauthorisable**, and by invariant 10's own
mechanism therefore unrecordable — the four acts with the largest blast radius in
the system produce no `AuthorizationGrant`, and so no joinable `AuditEvent`.

G26's answer to part of this is also not applied, and its numbering is now dead:

> G26 | **Capability 35 is `arm_connection`, alone** | The one act in the model
> conferring authority to act later with nobody present

`grep -rn 'arm_connection\|armConnection' model/ docs/contracts/` returns **zero
hits**, and capabilities 35 and 36 were spent on `view_metering` and
`view_commercial`. G59 makes `arm_connection` load-bearing — arming a source
connection *is* "the one act conferring authority to act later with nobody present"
— and it does not exist.

**What it would take to fix.** Mint the capabilities in **one commit before any
control-plane operation is written**. They land in a total `Record`, so the
mechanical cost is one edit and an unclassified capability is a compile error.
Classify model selection (G49) and the FX rate (G61, see RD-20) as **`authority`,
not `configuration`** — `PERMITTED_RESOURCES.delivery` includes `configuration`
(`model/governance.ts:401`), which is the hole G26 already records for
`compose_procedure`.

**DERIVATION** for the mint; **DECISION** only on `arm_connection`'s final scope.

---

### RD-9 · SERIOUS · G65 and G71 contradict each other on the exact type G66 exists to unify

**The claims.** G71 (`docs/HANDOFF.md:596`), second of three arguments:

> **§5.3 is the most-recurring defect class in this record** — two vocabularies for
> one concept, diverging: `ErrorCode` by thirteen members in one afternoon,
> **`Money`/`MoneyAmount`** … **One TypeScript vocabulary spanning the wire
> collapses that class structurally rather than procedurally.**

G65 (`:590`):

> **JSON has no bigint**, so both contract files change: `amountMinor: {type:
> integer}` → `{type: string, pattern: '^-?[0-9]+$'}`.

**Why it fails.** After both are applied, the model type of `Money.amountMinor` is
`bigint` and the wire type is `string` — **at precisely the field G71 cites as the
motivating instance of the defect it claims to close.** The vocabulary does not span
the wire; it stops at it, and the stopping point needs a hand-written codec that
nothing checks.

The parse direction is unprotected and G71 does not mention it. G71 says:

> `JSON.stringify` **throws** on `bigint`, which is a feature — it forces G65's
> string-on-wire decision at the boundary instead of letting it drift

True for **serialise**. `JSON.parse` returns `any`; there is no throw and no check.
A React frontend "sharing the same types" (G71's first sentence) receives
`{"amountMinor":"12345"}`, assigns it to a shared `Money`, and the compiler sees
`bigint` where a `string` sits. Every arithmetic and comparison on that value is
then wrong, silently, in the direction of appearing to work — `"12345" < "9"` is
`true`.

This is not hypothetical drift: the contracts already carry the divergence G66 is
meant to kill. `capability.openapi.yaml:2370` defines `Money` with `exponent`;
`control-plane.openapi.yaml:2085` defines `MoneyAmount` without it. G66 deletes one.
G65 then reintroduces a second representation of the survivor.

**What it would take to fix.** Declare the wire type separately and deliberately —
`MoneyWire { currency: string; amountMinor: string; exponent: number }` — with
**exactly one codec pair**, and make that codec the only place `BigInt(` appears in
the repository. That is checkable by grep and belongs in the same commit as
`docs/v1-trim-proposal.md` §4.12 step 5, beside G67's FX parser. It should be the
same discipline and probably the same file.

**DERIVATION.**

---

### RD-10 · SERIOUS · G66 universalises `exponent` beside `currency` with no derivation and no check — §5.5

**The claim.** G66 (`docs/HANDOFF.md:591`):

> **Collapse `MoneyAmount` into `Money`** … `Money` (`domain.ts:372`) has currency +
> amountMinor + **exponent** … Without the exponent you cannot compare BHD (3
> decimals) to USD (2) … **`bigint` does NOT fix this** — an exact integer of an
> unknown scale is still meaningless.

**Why it fails.** `Money` (`model/domain.ts:372-380`) declares `currency: string`
and `exponent: number` as **independent fields**. `{ currency: 'USD', exponent: 3 }`
typechecks. There is **no `CURRENCY_EXPONENT` record anywhere in `model/`** — the
exponent for a currency is nowhere derived and nowhere checked.

G66's own reasoning is that scale is what makes the number meaningful. It then makes
universal a field that can contradict the currency it qualifies, on the one path
where a wrong scale is a 10× error on a figure a controller signs for: G61's
rate-stamped consolidated total, arrived at by G67's parse-and-convert. §5.5's shape
exactly — "invalid states that the type made legal", in the type created to fix an
arithmetic defect.

`bigint` makes it worse, not better, and G66 says why in its own words: an exact
integer of an unknown scale is still meaningless. G65 gives exactness and G66 leaves
the scale caller-declared.

**What it would take to fix.** `exponent` derives from `currency` through a total
`Record<CurrencyCode, number>` over a **closed** currency set, or it comes off the
type entirely and lives only in the record. A closed currency set is needed anyway —
G61's per-period FX rate has to be keyed on something, and "any ISO-4217 string" is
not a key a total record can be built over. Note §5.10: a total record with no
construction site proves nothing, so this one needs a fixture in `model/examples.ts`
in the same pass.

**DECISION** on the closed set; **DERIVATION** thereafter.

---

### RD-11 · SERIOUS · G67's "exactly one function" cannot be written — three terms are undecided

**The claim.** G67 (`docs/HANDOFF.md:592`):

> The FX rate is stored as a **DECIMAL STRING, parsed at use** … **The cost, raised
> before the decision and accepted: correctness moves to the call site.** That is
> §5.2's shape … unless **exactly one function** parses and converts, and everything
> else is forbidden from touching the string. **Land that function in the same commit
> or this becomes the defect it resembles.**

**Why it fails.** The mitigation is correct and the function cannot be written from
what has been decided. Three terms are missing, and each is a judgement rather than
an implementation detail:

1. **Rounding mode.** Half-up, half-even, or truncate. For a consolidated total a
   controller signs and an auditor reconciles, this is a finance decision. It cannot
   be picked by whoever types the function.
2. **The rate's scale.** "A decimal string" is unbounded. `bigint` arithmetic
   requires a declared scale to multiply against, and the scale is what decides
   whether `0.1234567` is honoured or silently cut. G65 chose `bigint` specifically
   to avoid silent truncation; leaving the rate scale undeclared reintroduces it one
   operand over.
3. **Order of operations.** G61 says the group total is "shown, converted, stamped
   with the rate". Sum-then-convert and convert-then-sum give different answers under
   any rounding mode. Neither is named.

Without all three, the "exactly one function" mitigation is satisfied in form — there
is one function — while the thing it was meant to prevent has already happened: one
call site's guess promoted to a platform rule and stamped onto a figure with an owner
and a date.

**What it would take to fix.** State all three in the G67 row before the commit. They
are three short sentences. Then the function is a transcription.

**DECISION.**

---

### RD-12 · SERIOUS · G45 is not specifiable against the model as it stands — the only candidate boundary type is text by design

**The claim.** G62 (`docs/HANDOFF.md:587`) makes G45 a v1 prerequisite; G45 (`:570`):

> the summary crossing from reader to proposer carries **symbolic references, never
> text** — that is the pattern's definition, not a parameter of it.

`docs/v1-trim-proposal.md:221` sizes it: "two agent definitions plus a rule for what
the reader may emit."

**Why it fails.** There is no type at the reader→proposer boundary for a rule to be
written over, and the only candidate is text by construction. `EndpointReading`
(`model/domain.ts:3368`) is what an ERP read produces, and it carries:

> `label: string` — **What was read, in the source system's words. Rendered, never
> parsed.**
>
> `value: string` — The value, as a string, because the model does not know the
> foreign system's types and must not pretend to.

Two free-text fields sourced from the foreign system, deliberately. The machinery to
forbid that exists — `AssertNoPlainText` (`model/identity.ts:1139`) — and is applied
to **`CarriedTurn` and `CarriedReading` only** (`:1125-1126`). `identity.ts:1152-1153`
records that the proof's whole point is rejecting `label: string` on `CarriedReading`.
So the **across-turn** boundary is proven text-free and the **within-turn**
reader→proposer boundary has no type at all. G62 states the distinction correctly and
the model has only one half of it.

`AssertNoPlainText<EndpointReading>` would fail today by construction, which is the
proof that G45 needs a *new* type rather than a rule over an existing one.

A second obstacle sits behind it. G45 needs two `AgentDefinition`s with different
tool scopes. Under G52 those are **pack-minted**, packs are signed, and pack
publication has no operation and no capability (RD-8). So G45's build lands entirely
inside the unmodelled control-plane surface and is sequenced behind it.

**What it would take to fix.** Declare the reader→proposer boundary type in the same
pass that builds G45, assert `AssertNoPlainText` on it, and note that
`Timestamp = string` (§4.1, `model/kernel.ts`) weakens every such proof until it is
branded — G47 already hit this and dropped a field rather than weaken the assertion.
Sequence G45 after the control-plane capability mint, not before.

**DERIVATION** that it is unspecifiable today; **DECISION** on the boundary type's
shape.

---

### RD-13 · SERIOUS · `§3b` does not exist — two of four declared contradictions are recorded nowhere

**The claim.** G56 (`docs/HANDOFF.md:581`), the row the record says every scope
question resolves against:

> ⚠️ **Four things in this paragraph contradict the record and are listed in §3b** —
> chiefly that v1 dropped multi-currency, and that the screens put source
> configuration under the *customer* administrator while this puts it with the
> *FDE*

**Why it fails.**

```bash
grep -n '3b' docs/HANDOFF.md          # 1 hit — the sentence above
grep -n '^### 3' docs/HANDOFF.md      # 3a only
```

The file has §3 and §3a and stops. **§3b was never written.** The row names two of
the four inline. The other two exist only in whoever's head took the decision, and
the sentence that would have recovered them points at nothing.

This is §5.11's shape with a section number in place of a count: a claim about the
record that the record does not contain — and it landed in the one row designated as
the tie-breaker for everything below it.

**What it would take to fix.** Write §3b, or delete the pointer and inline all four
in the row. Do not leave a reference to a section that does not exist: §7 already
records that "a citation with no branch qualifier is a dead citation" and this is the
same failure one document in.

**DERIVATION** for the two named; the other two require whoever took G56.

---

### RD-14 · SERIOUS · `screen-pack-ledger.md` §5.4 is marked ✅ RESOLVED with a resolution reversed the same evening, and three rows cite a section that has never existed

**The claim.** `docs/screen-pack-ledger.md` §5.4:

> ✅ **RESOLVED by the product owner, 7 Aug evening.** … so **the dashboard is in and
> `presentation.ts` comes back.** … `docs/v1-trim-proposal.md` §2.11 proposes the
> restore — including the scope machinery, which is the part that must not be left
> behind

**Why it fails.** Two ways.

1. **The resolution was reversed within hours.** `docs/v1-trim-proposal.md` §4.11:
   "**no change. The first draft's restore is CANCELLED.** … **G57 (BI is Amazon
   Quick Suite) and G68 (rely on Quick Suite RLS) cancel it.**" So the single conflict
   in that file marked resolved is the one whose resolution was withdrawn, and the ✅
   still reads as settled. A reader who trusts the tick restores `presentation.ts`.
2. **`§2.11` does not exist.** `v1-trim-proposal.md` has §0, §1, §2, §3, §4.1–§4.13
   and §5. The correct citation is §4.11. Three separate rows carry the dead pointer:
   `docs/screen-pack-ledger.md` §5.4, and `docs/HANDOFF.md:580` (G55: "the restore is
   proposed in `docs/v1-trim-proposal.md` §2.11") and `:582` (G57: "See
   `docs/v1-trim-proposal.md` §2.11, rewritten"). Both HANDOFF rows were written
   against the *first draft* and were not re-pointed when the document was rewritten.

The file's banner says the authorities outrank it, which is the right posture and does
not help here: a ✅ is read as an answer, not as a snapshot.

**What it would take to fix.** Re-open §5.4 with G57/G68 as the answer, note the
reversal rather than editing over it (§6's standing practice), and correct all three
`§2.11` citations to `§4.11`.

**DERIVATION.** Nothing here needs a decision — §7's rule applies: a stale citation is
a transcription, and deferring it is choosing to ship it wrong.

---

### RD-15 · SERIOUS · "Quick Suite" and "QuickSight" are used as one product across G57, G68 and G70 — §5.3, on the decisions carrying a verification item

**The claim.** G57 (`docs/HANDOFF.md:582`): "**BI IS AMAZON QUICK SUITE** …
**QuickSight/Quick Suite renders the dashboard instead**". G68 (`:593`): "a
**QuickSight** SPICE dataset is a copy of tenant data outside our erasure plan".
G70 (`:595`): "**Quick Suite** tenancy is ACCOUNT PER TENANT". The verification item on
G57: "confirm **Quick Suite's** RLS and **namespace** model, and `ap-southeast-1`
availability".

**Why it fails.**

```bash
grep -co 'Quick Suite' docs/HANDOFF.md docs/v1-trim-proposal.md   # 7, 10
grep -co 'QuickSight'  docs/HANDOFF.md docs/v1-trim-proposal.md   # 2, 0
```

SPICE and namespaces are **Amazon QuickSight** concepts. Amazon Quick Suite is a
different product. The record treats them as one name for one thing, and slashes them
together once.

This is not pedantry, because three separate load-bearing claims turn on which is
meant: G68's entire scope-enforcement story is "its RLS"; G70's entire isolation story
is "account per tenant"; and `docs/v1-trim-proposal.md` §4.4 mints a `SubjectLocation`
variant for "a SPICE dataset" specifically. The tenancy, RLS and dataset models are not
identical between the two products, and neither is `ap-southeast-1` availability. §5.3's
tell applies exactly: **the same noun appearing in two places with two spellings of its
value set.**

Worst of all, the open verification item — the thing that would settle every one of
these — is written against the ambiguous noun. It will return an ambiguous answer.

**What it would take to fix.** One edit picking the product by name across all three
rows and the trim proposal, **before** the verification runs.

**DERIVATION.**

---

## NOTED

### RD-16 · NOTED · G50 + G70 push tenant identity and tenant data up into the control plane — invariant 3's bar is already set lower than that

Invariant 3 (`CLAUDE.md`): "The control plane publishes downward and never reads tenant
data." Pass E set the bar in a sentence (`docs/HANDOFF.md:453`): "`ChainAnchor` ships
**the head hash only** — a scalar carrying no tenant data, so invariant 3 holds."

G50 puts tenant provisioning in the control plane; G70 puts a per-tenant BI account
under it. Provisioning a QuickSight account with working RLS requires the control plane
to hold, at minimum, tenant user identities and their cost-centre and legal-entity scope
values. `Exception.costCentre` is documented as deliberately opaque
(`model/domain.ts:2812`): "a cost centre is the customer's org chart and **the platform
must not know anything about it beyond the key name**." An RLS rule set that filters on
cost-centre values is precisely the platform knowing them. And a SPICE dataset is tenant
data materialised in an account the control plane administers.

`docs/v1-trim-proposal.md` §4.10 leaves this open as an operational question — "who
operates the per-tenant BI accounts, and with what" — and it is an **invariant** question
as well. Answer it as both.

**DECISION.**

### RD-17 · NOTED · G70 creates a second identity store and a second visibility surface, which pass A refused by name

QuickSight users must exist inside each per-tenant account. Pass D deleted `User.isStaff`
because org "derives from `connection.owner`" and federation is the single identity path
(`docs/HANDOFF.md:408`). A parallel per-account user directory is a second place a person
exists and a second place their visibility is decided — the shape pass A named when it
said role composition must not become "a second, unreviewable authorisation system beside
the policy engine" (`:387`).

Record the QuickSight directory as a **generated projection** of `Membership` plus
`effectiveScopeFor()`, with one generator and no hand edits, or accept a second directory
in writing. Nothing currently says which.

**DECISION.**

### RD-18 · NOTED · G71 makes `@dropped-for-v1` load-bearing at build time, with zero enforcement

`CLAUDE.md` records 198 top-level `@dropped-for-v1` exports and §7 records that "**a drop
note is unverifiable by any tool**". Under G71 the Node backend imports `model/`
**directly**, so every dropped type is importable, autocompletes in the editor, and
compiles clean. Nothing distinguishes `Solution` (dropped, `model/domain.ts:2371`) from
`Exception` (live) to a developer or to `tsc`.

This is the cheapest CI check in the repository and G48 already fired the CI trigger
("Add CI when application code lands"). A script that fails when a symbol carrying a drop
note is imported outside `model/` is roughly the size of `tools/check-doc-counts.mjs`,
which already exists and already proved the pattern works.

**DERIVATION.**

### RD-19 · NOTED · `docs/domain-model.md` still records the stack as undecided

`docs/domain-model.md:4`: "this model is **language-neutral**, with TypeScript given as
the reference"; `:24`: "| Target | **Stack-undecided** |".

G71 decided it and says so in its own row. The document was not touched, so the file
`CLAUDE.md` names as the authority on the entity model contradicts the decision. §5.4's
shape, one document out. One line each.

**DERIVATION.**

### RD-20 · NOTED · G61's FX rate has no capability, and the tolerance it is modelled on is reachable by a delivery grant

G61 calls the customer-entered rate "a Tier 2 decision with a version and an owner, **like
a tolerance**". `configure_tolerance` maps to `configuration`
(`model/access.ts`, `CAPABILITY_RESOURCE_CLASS`), and `PERMITTED_RESOURCES.delivery`
includes `configuration` (`model/governance.ts:401`).

So modelling the FX rate on a tolerance puts the multiplier that scales a
controller-signed consolidated total inside an FDE's standing 90-day delivery reach —
the same shape as G22's third unsolved consequence ("A 90-day delivery grant can
therefore change a threshold that decides whether a human checks a number") and the
same hole G26 records for `compose_procedure`.

Fold into RD-8's capability mint and classify it `authority`.

**DERIVATION.**

---

## Checked and found genuinely sound

Listed because a short honest list is worth more than a padded one, and because
re-checking these is wasted effort.

- **G52 — agent runtime stays, tenant authoring goes.** Verified against the tree, not
  the prose: `agents.ts` is 31 live / 8 dropped, and `TOOL_EFFECT`, `DELEGABLE_TO_AGENT`,
  `DerivedAgentGrant`, `mintAgentGrant()` and `validateAgentToolBindings()` are all live.
  "Already true; no model change required" is accurate. Invariant 6 keeps an executable
  enforcement and invariant 11 keeps its per-step expiry, as claimed.
- **G44's boundary enforcement.** `_OperatorProposalIsNotExceptionAnchored`, distinct
  brands (`Id<'OperatorProposal'>` vs `Id<'ResolutionProposal'>`) and both pinned in
  `identity.ts`. This is structural and not a convention, exactly as the row claims. The
  related `OPERATOR_PROPOSAL_IS_AUTONOMOUSLY_EXECUTABLE = false` is a literal rather than
  a policy lookup, which is the right call given `ProposedTransaction.actionKey` has no
  declaration site — and the type says so at the field.
- **G51's honesty about invariant 2.** "Invariant 2 becomes DECLARED AND UNEXERCISED" is
  stated in the decision row, in `docs/v1-trim-proposal.md` §4.2 as a sign-off consequence,
  and in the §5 sign-off table. Three statements, no softening. This is how an invariant
  consequence should be handled and it is the model for how RD-5 should be repaired.
- **`scopeIsNarrowerOrEqual()`'s currency refusal** (`model/access.ts:2021`) fails
  **closed** and is correct. RD-4 is about the comparison that does not exist, not about
  this one.
- **G54's `'other'` closure** is a genuine derivation and is correctly labelled as one.
  RD-1 attacks what the closure *excludes*, not the closure itself.
- **G68's own three consequences** are recorded accurately and without softening, and G68
  correctly refuses to relitigate itself. RD-7 is a **fourth** consequence that was
  missed, not a dispute with the three.

---

## What this document does not cover

- **The screen pack.** `docs/screen-pack-ledger.md` §5 already lists seven
  screen-versus-decision conflicts and §6a lists six more things decided into v1 with zero
  screen coverage. Those are not re-derived here; RD-14 is the one place this document
  touches that file, and it is about the file's own ✅, not about a screen.
- **The infrastructure risk register** (`docs/infrastructure-risk-register.md`) — a
  different surface with a different owner.
- **Anything requiring an AWS documentation check.** Two verification items are open
  (Textract's coverage boundary; the BI product's RLS, namespace and region model) and
  both are checkable in an afternoon by someone with a console. RD-1 and RD-15 make them
  sharper; neither closes them.

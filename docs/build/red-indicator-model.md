# Red team — the indicator model behind `design/close-twomarks.html`

> **STATUS:** WORKING MATERIAL
> **V1 AUTHORITY:** NO — an adversarial pass over one design surface. It finds defects; it decides nothing, and nothing in it is applied.
> ⚠️ **This file had no status banner at all until 8 Aug 2026** — it opened on a bare Date · Target · Mandate line, which reads as a report of fact rather than as an input. It is an input. Its findings were adjudicated in **G74**, and G74 itself is **adjudicated and not applied** (`docs/HANDOFF.md` §0a): none of its four creates — whose-move, human attribution, `TokenForecast`, `EndpointHealth` — exists in `model/`.
> ⚠️ **One of its blocking gates is already met.** It tables *"G7 `managed_service_use` applied"* as an unmet precondition; **G79 applied it to `model/` on 8 Aug 2026.** The contract still lags, which is a different gate.
> ✅ **BODY CORRECTED 8 Aug 2026 — two passages, both the same gate.** RI-9's fix note and §8's blocking table both recorded `managed_service_use` as unapplied; **G79 applied it to `model/`** (`policy.ts:91`, `:327`, `:441`), so RI-9 is unblocked at the model and blocked only at the contract. ⚠️ **G104 sharpens RI-9 rather than softening it** — no model id in engine code, the catalogue the only source — and that is recorded at the finding. The findings themselves are untouched.
> *Banner added 8 Aug 2026; body corrected the same day.*

**Date** 8 Aug 2026 · **Target** `design/close-twomarks.html` and the model changes it
implies · **Mandate** adversarial. Nothing here is a suggestion.

**Scope.** The surface makes five claims the model does not currently produce: a
five-term status vocabulary, a "whose move is it" axis, human-in-the-loop
attribution per finding, a per-action token forecast, and connection liveness.
Plus the surface's own assertions. **Findings are ranked by severity within each
group and each carries a `file:line` or a quoted line from the artifact.**

**Verdict up front.** Two of the five claims are unbuildable as designed
(status vocabulary, token forecast). Two are buildable but the surface derives
them from the wrong thing (whose-move, liveness). One is buildable and creates an
unplanned obligation (human attribution). The artifact additionally carries three
defects that would ship wrong software regardless of the model.

Counts in this document carry the command that reproduces them (`HANDOFF` §5.11).

---

## Summary

| | BLOCKER | SERIOUS | NOTED |
|---|---|---|---|
| Status vocabulary | RI-1, RI-2 | RI-3 | RI-4 |
| Token forecast | RI-5, RI-6 | RI-7, RI-8, RI-9 | RI-10 |
| Whose move | — | RI-11, RI-12 | RI-13 |
| Human attribution | RI-14 | RI-15 | RI-16 |
| Connection liveness | RI-17 | RI-18, RI-19 | — |
| The surface itself | RI-20, RI-21 | RI-22, RI-23, RI-24 | RI-25, RI-26 |

**Sound, and stated plainly** — see §7. Four things this pass attacked and could
not break.

---

## 1. The status vocabulary — it is not closed, and it is not one axis

### RI-1 · BLOCKER · The five terms are a projection of THREE independent axes, so a finding maps to two of them routinely

> *"Every other state is a word ending in a character that says whose move it is"*
> — `close-twomarks.html:3-4`
>
> Rendered terms: `Cleared` (`:305`), `needs authority` (`:309`), `no recourse`
> (`:323`), `below floor` (`:330`), `waiting` (`:337`).

**Why it fails.** The five terms are drawn from three unrelated model axes that
vary independently:

| Term | Axis it actually reads | Model source |
|---|---|---|
| `Cleared` | lifecycle status | `Exception.status` (`model/domain.ts:2834`) |
| `needs authority` | lifecycle status | `Exception.status = 'pending_approval'` (`:493`) |
| `waiting` | correspondence state | `ThreadStatus = 'awaiting_reply'` (`model/correspondence.ts:233`) |
| `no recourse` | disposition family | `DispositionFamily` (`model/domain.ts:1853`) |
| `below floor` | extraction confidence | `Provenance.confidence` (`:1655`) vs `FieldSpec.confidenceFloor` (`:1605`) |

Nothing makes these mutually exclusive, and the artifact's own row D proves it.
Row D is drawn `below floor` (`:330`). Its journal, once drafted, would put
`Exception.status` at `resolution_proposed` or `pending_approval` — at which
point the same row is **simultaneously** `below floor` (the extraction was 61%,
which does not change) and `needs authority`. Both are true, neither is a
superset, and the surface has one slot.

Symmetrically, row E is drawn `waiting` (`:337`) *and* greyed with
`class="done"` (`:335`) *and* captioned *"Blocked on a credit note"* — three
states on one row, where the design's thesis is one word per row.

Worse in the other direction: `no recourse` and `waiting` are both a
`DispositionFamily` reading, and the two are one member apart.
`existence_completeness` carries `awaiting_counterpart` (waiting) and
`never_expected` (no recourse) in the same array (`model/domain.ts:1845-1847`).
The distinction is not observable from the exception; it is a pack author's
choice of disposition key, which is a `string` (`Disposition.key`, `:1886`).

**Fix.** Stop calling it a status vocabulary. It is **two** fields:
a lifecycle term derived totally from `ExceptionStatus`, and a **cause** term
derived from `DispositionFamily`. `below floor` is neither and belongs on the
figure, not the row (it already is — the meter). Then state which one wins the
row when both are non-trivial, in writing, before anyone builds a `Record`.

**DECISION** — the product owner picks the precedence order. This is not
derivable.

### RI-2 · BLOCKER · Four of seven `ExceptionStatus` members map to none of the five, and two map to the same one

```bash
awk '/^export type ExceptionStatus =/,/^$/' model/domain.ts | grep -c "^  | '"   # 7
```

`ExceptionStatus` (`model/domain.ts:489-496`) is
`open · investigating · resolution_proposed · pending_approval · resolved ·
rejected · dismissed`.

- **`open`** → none. Nothing has happened. It is not cleared, not below floor,
  not waiting on a counterparty, and nobody's authority is required yet.
- **`investigating`** → none. A human holds it (`Exception.assignedTo`,
  `:2835`). If the viewer is not that human the surface has no word: `waiting`
  means "still happening and not yours" per `:120`, but the design reserves the
  animated ellipsis for the *world*, not for a colleague.
- **`resolution_proposed`** → none. A proposal exists and approval has **not**
  been requested. `ApprovalDecision.requestedAt` (`:3279`) is the field that
  distinguishes proposed-from-requested, and it was added precisely because the
  two were indistinguishable. The surface re-collapses them.
- **`rejected`** → none. A proposal was rejected; the exception is live again.
- **`resolved` and `dismissed`** → **both** map to `Cleared`. They are not the
  same event. `resolved` means a disposition executed; `dismissed` means nobody
  will act. Collapsing them is exactly what `Disposition.terminal`
  (`:1896`) exists to keep apart.

So of seven members: two collapse into one term, four have no term, one maps
cleanly. **A five-term vocabulary that answers one of seven statuses is not
closed and is not total.**

**Fix.** Either widen the vocabulary to cover `ExceptionStatus` totally, or
declare it a *view* over a subset and say which statuses it refuses to render.
The second is legitimate and cheaper; it just has to be written down.

**DERIVATION** — the mapping is mechanical once RI-1's precedence is decided.

### RI-3 · SERIOUS · The vocabulary was designed against one archetype and v1 ships four

```bash
awk '/^export const DISPOSITION_FAMILIES = \{/,/^\} as const/' model/domain.ts \
  | grep -o "'[a-z_]*'" | sort -u | wc -l          # 23 distinct families
```

Every row on the surface is an `n_way_document_match` finding — price variance,
quantity variance, missing document, duplicate (`:301-340`). G63 keeps **all
four** v1 archetypes (`docs/HANDOFF.md:588`), and `DISPOSITION_FAMILIES`
(`model/domain.ts:1833-1851`) carries 24 entries / 23 distinct values across
five archetypes.

`set_reconciliation` yields `in_transit`, `error_left`, `error_right`,
`unidentified`, `write_off`. Which of the five words is `write_off`? It is not
cleared (a person must decide), not waiting, not below floor, and it is the
*opposite* of no-recourse — recourse is exactly what is being abandoned.
`attribute_verification` yields `identity_ambiguous` and `stale_source`;
neither has a word either.

This is `HANDOFF` §5.1 verbatim: *a rule keyed on a convenient landmark instead
of the property it cares about.* The landmark is the three-way match, which is
what the comps draw. The property is the archetype, which is what varies.

**Fix.** Derive the cause term from `DispositionFamily` per archetype, with
`DISPOSITION_FAMILIES` as the key set so an unmapped family is a compile error.
⚠️ **And read §5.10 first** — a `Record<DispositionFamily, Term>` with no
construction site proves nothing. Land it with a fixture in `model/examples.ts`
or you have added a sixth assertion that witnesses none of it.

**DERIVATION.**

### RI-4 · NOTED · `waiting` has no field to read and requires a reverse join that can return two answers

`Exception` carries no thread reference. The link is
`CorrespondenceThread.exceptionIds: ExceptionId[]` (`model/correspondence.ts:248`) —
**many-to-many, in the wrong direction**, and the type's own comment says *"one
exception can need two conversations."*

So `waiting` on an exception is `∃ thread ∈ threads(exception) :
thread.status = 'awaiting_reply'`. Two threads, one answered and one awaiting,
is a legal state with no defined answer. Also note the row is `class="done"`
(greyed) *and* `waiting` — the design greys finished work, and a row waiting on
a credit note is not finished.

**Fix.** Decide the aggregation rule (any/all) and write it beside the type.
**DECISION**, one line.

---

## 2. The token forecast — the softest claim, and it does not survive contact

### RI-5 · BLOCKER · Nothing in the model can compute a forecast, and the model has already refused to build the machinery once

> *"re-runs the match, about **~2.4k** tokens"* — `close-twomarks.html:340`

```bash
grep -rn "forecast\|estimate\|projected" model/*.ts   # zero matches on a spend estimate
```

There is no estimator type, no historical-cost aggregate, no per-disposition
cost model. The nearest thing is delta 21, *"`ProviderCostRecord` optional per
topology; **estimated-cost rate table**"* (`docs/HANDOFF.md:813`) — which is
**open** and which G36 **defers to v1+1** (`:816-822`, delta 21 is one of the
five named). So the one artefact that would produce this number is explicitly
out of v1 and the surface renders its output.

Building it means: a per-`(definitionId, definitionVersion, archetype,
documentCount)` cost history, joined to `ModelCatalogEntry` (`model/catalog.ts:118`)
for the model in force, projected forward. That is a new subsystem, and it is a
**new tenant-data read path** on a register that currently reads exceptions.

**Fix.** Delete the number, or fund the subsystem. There is no middle version —
a hard-coded 2.4k is `PRODUCT.md`'s invented-data rule broken in the one place
the user is told to trust a figure.

**DECISION** — it costs a subsystem.

### RI-6 · BLOCKER · The model refused to let an AGENT see its own consumption, for the exact reason this shows it to the operator

`model/agents.ts:350-364`, on `DELEGABLE_TO_AGENT.view_metering = false`:

> *"An agent that can read its own consumption is an agent whose reasoning can
> be conditioned on its own cost, and **'act differently when the budget looks
> tight' is a behaviour nobody authored, nobody scored and no rollback would
> revert.**"*

The surface applies that behaviour to the human, at the moment of decision, by
design — the direction contract says so: *"Sits **ON** the action, because that
is the moment the number changes a decision"* (`close-twomarks.html:178-179`).
**Changing the decision is the stated purpose.**

And the decision it is attached to is **`Reopen`** (`:340`) — the reversal path.
`model/learning.ts:1704-1726` sets out, step by step, why suppressed reversals
corrupt the system:

> *"`AutonomyDials.reversalRate` is 'the honest measure of verifiability'… Humans
> therefore reverse it less. `reversalRate` falls below
> `MAX_REVERSAL_RATE_TO_WIDEN = 0.02`… `recommendAutonomyCeiling()` widens the
> ceiling one rung… **Nothing in that chain is a bug. Every step is the code
> working. And the conclusion is false.**"*

That passage names *memory* as the suppressor. **A price tag on the Reopen
button is a second, cruder suppressor with the same output**, and it is
load-bearing on `policy.ts:1138` (`high_reversal_rate` narrows) and `:1151`
(`MAX_REVERSAL_RATE_TO_WIDEN` widens). The surface would widen agent autonomy by
making reversal feel expensive. Nobody authored that; no scorer measures it; and
per invariant 9 as qualified by `access-and-agency.md` §10.5, a rollback would
not revert it because it is not a behaviour change — it is a *measurement*
change.

**Fix.** If a forecast ships at all, it must not sit on a reversal, a rejection,
or an escalation. Those three must be free at the point of use, and the reason
must be written at the type.

**DECISION**, and it is the most consequential one in this document.

### RI-7 · SERIOUS · A pre-action quantity in the billing unit, with no rate card, is worse than a price — and `PRODUCT.md` forbids the class

The direction contract's defence: *"Tokens only. Never money: `UsageRecord` is
immutable and unpriced (invariant 5), and no price has been established
(PRODUCT.md)"* (`close-twomarks.html:185-186`).

The defence fails on its own terms. `input_tokens` and `output_tokens` are
**meters** — `METERS` (`model/billing.ts:75-84`), 8 members, tokens are two of
them. A token count is not an innocent technical figure; it is the billable
quantity. Quoting a quantity in the billing unit **before** an act, with no
`MeterPrice` (which is `@dropped-for-v1`, `model/billing.ts:245`), produces a
quote that is precise about volume and silent about cost. The customer can
neither price it nor ignore it.

Invariant 5 says *money is always derived*. A forecast is not derived from
anything — it is the one number in the product with no antecedent record. It is
the exact inverse of the invariant: an **underived quantity presented before the
fact**, where the invariant exists to guarantee **derived quantities after the
fact**.

`PRODUCT.md`'s NEVER list bans *a price* and *a benchmark*. A per-action token
forecast is a performance benchmark of the system, stated in-product, with no
provenance — `CLAUDE.md`'s stated test for the landing-page statistics
(*"Attach a source or drop them"*) applies unchanged.

**Fix.** If it ships: a range, not a tilde-point; sourced from observed history
with the sample size stated; and never as the only figure on a control.
**DECISION.**

### RI-8 · SERIOUS · Two competing token totals already exist in the model, and the surface renders both without reconciling them

`HANDOFF` §5.3, live instance, found by this pass:

- `ReconciliationRun.tokenUsage: TokenUsage | null` (`model/domain.ts:2535`) — a
  denormalised per-run total.
- `UsageRecord` with `meter: 'input_tokens' | 'output_tokens'` and
  `runId: RunId | null` (`model/billing.ts:182,224`) — the metering spine, which
  is what ships to the control plane and what an invoice is built from.

**Nothing reconciles them and no function converts.** The tile renders *"spent
`18.2k` so far"* (`:283`) — a live, mid-run figure, which only
`ReconciliationRun.tokenUsage` could carry, and that field is `| null` on a run
whose `status` is `'running'` (`:2531`). The footer renders *"This close has
spent `84.1k` tokens"* (`:370`) — a period aggregate, which only `UsageRecord`
can produce, via `runId → ReconciliationRun.periodId` (`:2528`).

So the two figures on one page come from two different tables with two different
freshness properties, and `UsageRecord.shippedAt` is `null` while buffered
(`model/billing.ts:181`), so the in-plane sum and the billed sum **differ at
every instant by construction**. A customer comparing the register to the
invoice finds a discrepancy that is correct in both places.

**Fix.** Pick one. `UsageRecord` is the spine; `ReconciliationRun.tokenUsage`
should be deleted or explicitly re-labelled as a non-authoritative cache with
the drift stated. This is `HANDOFF` §5.3's tell exactly — *the same noun in two
modules*. **DERIVATION**, then a one-line **DECISION** on which survives.

### RI-9 · SERIOUS · `TokenUsage` cannot represent a v1 run, so the run-level number cannot be typed

`TokenUsage` (`model/domain.ts:2475-2494`) is
`{ inputTokens, outputTokens, model: ModelCatalogEntryId }` — **one model per
run**.

G69 (`docs/HANDOFF.md:594`) makes v1's extraction **Textract plus SageMaker**,
and its own correction records that **Textract cannot be a `ModelCatalogEntry`
at all**: it has no `ModelCapabilities` analogue (`model/catalog.ts:87-95`) and
G54 closes `provider` to `bedrock | sagemaker`, *"which Textract is neither."*

So a three-way-match run that extracts with Textract, falls back to a SageMaker
custom model for the Mandarin dockets, and reasons with Bedrock, has **three
engines and one `model` field, one of which cannot be named**. The tile's
*"spent 18.2k so far"* on the extraction-heavy live run is not merely unmeasured
— it is **untypeable in the current shape**.

**Fix.** `TokenUsage` becomes a list keyed by engine, and the non-catalogue
engines need a home. That home is G7's `managed_service_use`, which G69 already
made load-bearing and which is ~~recorded **not applied**~~ **APPLIED to `model/`
on 8 Aug 2026 under G79** — the kind (`model/policy.ts:91`),
`ManagedServiceUseConfig` (`:327`) and the config-union arm (`:441`) all exist.
~~**DERIVATION**, blocked on G7.~~ **Still a DERIVATION and now unblocked at the
model: the home exists and `TokenUsage` has not moved into it.** ⚠️ The contract
half still lags — no OpenAPI schema mirrors the new kind. ⚠️ **G104 sharpens this
finding rather than softening it**: no model id may appear in engine code, the
catalogue is the only source and the engine calls `resolveModel()`, so a
per-engine `TokenUsage` must key off a published `ModelCatalogEntry` — which is
also why `TokenUsage.model` being branded to `ModelCatalogEntryId` (7 Aug) matters
here.

### RI-10 · NOTED · The forecast is a new metering read on a surface that gates one resource class

`view_metering` is capability 35 on resource class `metering`
(`model/access.ts:430`, `:591`). The register is an exception surface. The
footer total and the per-action forecast are both `metering` reads with no
separate gate drawn. A role holding `view_exception` and not `view_metering`
sees the register today and would see the spend tomorrow.

`model/access.ts:412-421` is explicit about why the class was split out: *"a raw
`UsageRecord` is volume in the clear, and spend and rate together invert to
volume."* The footer publishes volume in the clear at close granularity.

**Fix.** Two capabilities, one screen; the spend row renders or does not.
**DERIVATION.**

---

## 3. "Whose move is it" — derivable, but not from what the surface reads

### RI-11 · SERIOUS · The addressee of `needs authority` is a capability requirement, not a person, and resolving it to "you" needs four things the surface does not have

> *"journal drafted, balanced · **you** approve"* — `close-twomarks.html:308`

`ApprovalConfig.approvers` is `CapabilityRequirement[]` (`model/policy.ts:174`),
deliberately — the field was changed *from* `RoleKey[]` because a bare role key
let a partner approve a customer's disposition (`:159-167`). So the model
answers *"what must an approver hold"*, never *"who"*.

Turning that into `you` requires, in order:

1. resolve the `LivePolicySet.approval` in force (`model/policy.ts:758`);
2. evaluate the viewer against each `CapabilityRequirement`, including
   `appliesAtOrAboveValue` and `distinctHolders`;
3. intersect with `AssignmentScope` — **six dimensions**, of which
   `costCentres` and `legalEntities` bind on `Exception.costCentre` /
   `Exception.legalEntity` (`model/domain.ts:2832-2833`), added 7 Aug precisely
   because two dimensions previously *"matched every row"*;
4. subtract quorum already satisfied by other `ApprovalDecision` rows
   (`:3250-3281`) — because `quorum` counts **distinct** approvers and the
   viewer may already be one of them.

Step 4 is the one that will be skipped, and skipping it renders `your move ›` on
a row the viewer has already decided. `effectiveScopeFor()` (`model/access.ts:1148`)
exists so a call site cannot reason independently; a UI computing "yours" from
`assignedTo` alone is `HANDOFF` §5.2's shape — *the caller doing the callee's
job.*

**Fix.** One server-side derivation returning the turn, never a client
computation. Sign it to the viewer's session so it cannot be recomputed
optimistically. **DERIVATION.**

### RI-12 · SERIOUS · `segregationOfDuties` makes "whose move" wrong on exactly the rows the agent drafted

`ApprovalConfig.segregationOfDuties` (`model/policy.ts:213`) carries its own
warning:

> *"⚠️ VACUOUS WHEN THE PROPOSER IS AN AGENT… `approver !== proposer` is
> trivially true against `{ kind: 'agent' }`, so the flag reads as satisfied
> while asserting nothing at all."*

Row B.1 is `data-agent` (`:307`) — the agent drafted the journal — and reads
`needs authority ›`. Under the model as written, **every** agent-proposed row
satisfies SoD, so the surface will render `your move` to the person who set the
agent running, which is the one person SoD would exclude if it worked.
`ProposalActor.agent.onBehalfOf` (`model/domain.ts:3212`) is the field that
would exclude them, and nothing reads it.

The surface makes this worse than the model does: today the flag is a silent
false assurance; on this screen it becomes a **visible instruction to the wrong
person**. `HANDOFF` §5.6.

**Fix.** Bind SoD to `onBehalfOf.userId` for `{ kind: 'agent' }` proposals. The
choice between that and the policy author is recorded as open at
`model/policy.ts:206-211` and is the owner's. **DECISION**, then derivation.

### RI-13 · NOTED · `AutonomyConfig` cannot answer the question at all, and should not be asked

`AutonomyConfig` (`model/policy.ts:120-142`) answers *may the agent act
unattended* — severity ceiling, domain scope, value ceiling, permitted actions.
It says nothing about who acts when the agent may not. It is the wrong type for
this question and reaching for it will produce a second autonomy engine, which
`model/access.ts:2041-2055` already names as the failure mode.

**Sound as designed** — the surface does not appear to read it. Recorded so
nobody adds it.

---

## 4. Human attribution — buildable, and it creates an obligation nobody planned

### RI-14 · BLOCKER · A named person in a notification is a `SubjectLocation.notification`, and if the sender does not index it at send time it is unreachable forever

> *"Three-way match proposed `412,900.00` and it needs authority ›. **A. Cruz**
> drafted the journal at 08:04."* — `close-twomarks.html:357`, the
> *Notification · digest line* proof card.

`SubjectLocation` gained a `notification` variant for exactly this
(`model/governance.ts:1540-1546`):

> *"A notification that carried the value out — a digest, an approval mail, an
> alert… Once sent, it is at rest in a mail store we do not own, retained on
> someone else's schedule and forwarded freely. Without this variant the erasure
> plan has nowhere to attach it, so **a subject's name in a weekly exception
> digest is unreachable AND undisclosed**."*

And the index is *"Written at **CREATION** time, not discovered by scanning. A
scan cannot find a value inside a stored Explanation, and an erasure design that
depends on finding it later will quietly miss it"* (`:1475-1477`).

**The design's whole thesis is that the person gets named** (`:2-3`,
*"the PERSON is what gets named"*). So every digest line, every approval mail,
every alert that carries `A. Cruz` must write a `SubjectIndexEntry` with
`kind: 'notification'`, `destination`, `sentAt` and a `dataClass` — at send
time, synchronously, or the record is lost. **Nothing in the notification path
is designed to do this**, and `DATA_CLASSES.personal` (`model/domain.ts:308`)
plainly covers a natural person's name.

Second-order: staff are data subjects. The record has treated subjects as
counterparties and document contents throughout; naming employees on every
finding and in every digest widens the erasure surface to the workforce, and
`SubjectKeyScheme` is a per-tenant HMAC of *"the natural identifier"*
(`:1551-1553`) — nobody has decided what a staff member's natural identifier is.

**Fix.** The notification renderer writes the index entry in the same
transaction as the send, or the design names the person only on surfaces that do
not leave the tenant. **DECISION** on which, then derivation.

### RI-15 · SERIOUS · Three different referents share one visual vocabulary, and one of them is not addressable by the model

The `.hu` class (`close-twomarks.html:172`) renders three unlike things
identically:

- **`you`** (`:308`, `:330`) — the viewer, resolved per session.
- **`A. Cruz`** (`:322`) — a `UserId`.
- **`AP`** (`:336`) — a department. **The model has no department.** There is
  `Membership`, `Role`, `RoleAssignment` and `AssignmentScope.costCentres`
  (opaque customer text, `model/domain.ts:2811-2814` insists the platform *"must
  not know anything about it beyond the key name"*). *"`AP` notified"* is
  therefore either a cost-centre string being read as an org unit — which that
  comment forbids — or a fabrication.

This is `HANDOFF` §5.3 inverted: one vocabulary for three concepts, which
diverges the moment somebody tries to make `AP` clickable.

**Fix.** Two treatments minimum: a resolved principal, and a non-principal
recipient that is explicitly not addressable. **DERIVATION.**

### RI-16 · NOTED · No field records who chased a vendor

*"A. Cruz chased the vendor 07 Mar"* (`:322`) is not on `Exception`.
`Exception.assignedTo` (`model/domain.ts:2835`) is the current holder, not the
actor of a past act. The act is an `AuditEvent`, or `CorrespondenceThread` +
`admittedBy: ProposalActor | null` (`model/correspondence.ts:209`). Rendering it
on the register means a per-row audit join on the hot path — and
`docs/build-conventions.md:265` already flags the register query as *"the hot
path… the one every tenant runs at 08:00"* under RLS.

**Fix.** Denormalise deliberately, as `Exception` already does for `domain`,
`ruleLabel`, `severityRank` (`:2775-2778`), with the same *"derived, never
authoritative"* comment. **DERIVATION.**

---

## 5. Connection liveness — the field does not exist, and the one vocabulary for it is dropped

### RI-17 · BLOCKER · `Endpoint` carries verification, not reachability, and reading one as the other is §5.1 exactly

> `<span class="conn" data-state="up">… <b>ERP live</b> · read 08:04</span>`
> — `close-twomarks.html:261`
> `<span class="conn" data-state="down">… <b>Bank feed unreachable</b> since 03:15</span>`
> — `:368`

`Endpoint` (`model/domain.ts:595-644`) carries `verifiedAt`,
`verificationExpiresAt`, `boundUntil`, `disabledAt`. **There is no liveness
field, no `lastReachedAt`, no health.** And `verifiedAt` is emphatically not
reachability:

> *"Verification is the control, not hygiene. An unverified address is how an
> outbound gate becomes decorative, and it is the same takeover vector DNS
> verification closes"* — `:623-627`

A verified endpoint is one whose *owner* is proven. A live endpoint is one that
*answered*. Rendering the first as the second is `HANDOFF` §5.1's defect —
a rule keyed on the landmark that exists rather than the property it needs — and
it fails in the dangerous direction: a permanently-verified, permanently-dead
ERP renders `ERP live` forever.

**Fix.** A new field, and it must be a distinct name that cannot be confused
with verification. **DERIVATION**, but see RI-18 for what it costs.

### RI-18 · SERIOUS · The only liveness vocabulary in the repository is `@dropped-for-v1`, and re-inventing it on `Endpoint` mints §5.3 on the day it returns

`DataPlaneLiveness` and `DataPlaneHeartbeat` live in `model/deployment.ts`
(`:76-99`, `:217-231`), which is **wholly `@dropped-for-v1`** under G36
(`docs/HANDOFF.md:561`, `grep -c '@dropped-for-v1' model/deployment.ts` → 13).

That module already learned this exact lesson:

> *"SEPARATE FIELD ON PURPOSE. An idle plane is healthy. Deriving liveness from
> activity…"* — `model/deployment.ts:231`

A last-successful-read timestamp on `Endpoint` reproduces precisely the mistake
that comment prevents: a healthy ERP nobody has queried since 03:12 renders
`unreachable`, and the surface's footer does exactly this — *"Bank feed
unreachable **since 03:15**"* while the Bank-to-ERP run started 07:58 and is 62%
matched (`:280-284`). **The artifact contradicts itself**: a reconciliation
cannot be 62% through matching bank data against an ERP over a feed that has
been dead for five hours. That is what deriving liveness from activity looks
like in the wild.

And G70 (`docs/HANDOFF.md:595`) already warns *"`deployment.ts` is wholly
dropped and it is the module that models fleets, liveness and versions — some of
it may have to come back."* If `EndpointLiveness` is minted now and
`DataPlaneLiveness` returns later, that is two vocabularies for one concept,
which §5.3 records as diverging *within hours*.

**Fix.** Restore the `DataPlaneLiveness` value set as a shared type before
attaching it to `Endpoint`. **DECISION** — it partially un-drops a module.

### RI-19 · SERIOUS · A liveness poll cannot be recorded, because `EndpointReading.authorizationId` is non-nullable and a poll has no principal

The only existing record of reaching a foreign system is `EndpointReading`
(`model/domain.ts:3368-3410`), and its `authorizationId` is **non-nullable by
argument**:

> *"INVARIANT 10 — an act with no authorisation is unrecordable. The READ half.
> Non-nullable, unlike `AuditEvent.authorizationId`…"* — `:3405-3409`

A liveness probe is machine-originated. `AUTHORIZATION_MAY_BE_ABSENT` admits
exactly one actor kind, `system` (`CLAUDE.md`, invariant 10). So a probe either
(a) cannot be an `EndpointReading` at all, or (b) mints a synthetic
`AuthorizationGrant` per probe per endpoint per tenant — which floods the grant
table and, via `UsageRecord.meter = 'api_calls'` (`model/billing.ts:83`),
**bills the customer for the breathing dot**.

On **invariant 3**, precisely: in v1 hosted-only (G36 + G50) the poller and the
endpoint are both in the one data plane, so polling does **not** by itself
breach *the control plane never reads tenant data*. It breaches it the moment
the dot is rendered from a fleet-wide view — which is what
`PartnerHealthView` / `PlatformHealthWindow` were, and both are dropped
(`model/governance.ts:1496-1498` records the trim). **State it that way; do not
overclaim.** The invariant this actually touches first is **10**, not 3.

**Fix.** A liveness state on `Endpoint`, written by an in-plane prober, that is
**not** an `EndpointReading` and mints no grant. Say so at the type or somebody
will reuse `endpoint_read`, which `:3381-3391` deliberately typed as a literal
so a second read path is a compile error.

**DECISION.**

---

## 6. The surface itself

### RI-20 · BLOCKER · At ≤820px the register stops being a table, and `build-conventions.md` §8.1 forbids exactly this fix

```css
@media (max-width:820px){
  table{display:grid} thead{display:none} tbody{display:contents}
```
— `close-twomarks.html:236-241`

Three separate defects in four declarations:

1. **`table{display:grid}` removes the table role** in every major engine. §6.3
   is titled *"The tables are real tables"* and requires
   *"`<table>` with `<caption>`, `<th scope="col">` and `<th scope="row">"*
   (`docs/build-conventions.md:174-177`). Below 820px none of that reaches AT.
2. **`thead{display:none}` deletes the column headers from the accessibility
   tree**, and the replacement is `td.num::before{content:attr(data-l)}`
   (`:241`) — **CSS generated content, which is not reliably exposed to AT and
   is not selectable, translatable or searchable**. The label for a money column
   exists only in a pseudo-element.
3. §8.1 is unambiguous: *"'fully responsive' here means a second design, not a
   narrower first one. **Anyone reaching for `flex-wrap` and a `@media` query on
   the register has misunderstood the requirement.** That small-screen design
   does not exist and is owed"* (`docs/build-conventions.md:312-316`).

**Fix.** Remove the breakpoint and mark the surface desktop-only pending the
owed design, or draw the second design. Do not ship a reflowed table.
**DECISION.**

### RI-21 · BLOCKER · The confidence figure and the floor exist only in CSS, and the caption promises otherwise

> Caption: *"A figure the agent was unsure of is drawn less resolved **and states
> its confidence**."* — `close-twomarks.html:294`
>
> Row D: `<span class="meter" style="--score:61%;--floor:90%">…<span class="tick"
> data-t="90% floor"></span></span>` — `:330`

Row D **does not state its confidence**. The 61% exists only as a CSS custom
property. The floor label exists only as
`.meter .tick::after{content:attr(data-t)}` (`:115`) — generated content, at
**9px**, and the sole carrier of *"90% floor"*. `.meter > .v{opacity:.72}`
(`:111`) encodes uncertainty in the opacity of the **money amount itself**.

`docs/build-conventions.md:148-165` is the governing rule and its polarity is
the point: *"The status dot is decoration. The status word is the truth… Every
status must survive greyscale. A shape, a glyph, or a word — not a hue plus a
tooltip."* Here the design has put a **measurement** into opacity plus a
pseudo-element and asserted in the caption that it did the opposite. The proof
card at `:352` gets it right (*"read at 61%, below the floor"*); the register
does not, and the register is the surface people read for hours.

Note this is a **defect in the artifact, not in the model**: `FieldSpec
.confidenceFloor` (`model/domain.ts:1605`) and `Provenance.confidence` (`:1655`)
both exist, and G38 explicitly licenses rendering the floor read-only
(`docs/HANDOFF.md:563`). The data is available; the markup drops it.

**Fix.** Real text for the confidence and the floor, in the row. Keep the meter
as decoration beside it. **DERIVATION.**

⚠️ Separately: row D is *"3 dockets · Three values unread"* rendered with **one**
meter at one score against one floor. `confidenceFloor` is **per field**
(`:1605`, placed there *"because the floor is per-field and that is the grain
`dataClass` already uses under invariant 4"*). Three values have three
confidences and up to three floors. There is no aggregate-confidence type and
nothing defines min-vs-mean. **DECISION** before this renders.

### RI-22 · SERIOUS · "your reading spends nothing" is false against two of the eight meters, and unprovable in principle

> *"your reading spends nothing"* — `close-twomarks.html:333`
> *"Every figure a person confirmed was free."* — `:370`

```bash
awk '/^export const METERS = \{/,/^\} as const/' model/billing.ts \
  | grep -cE '^  [a-zA-Z]+:'        # 8 meters
```

`METERS` (`model/billing.ts:75-84`) includes `api_calls` and
`documents_processed`. A person confirming three values makes API calls; if the
confirmation re-runs the match — which the adjacent `Reopen` control explicitly
does (`:340`) — it makes inference calls too. The claim is true only of
`input_tokens` / `output_tokens`, which is **2 of 8**.

The deeper problem: **the claim is unprovable from an append-only table.**
`UsageRecord` is *"append-only; never updated, never priced"* (`:116`).
Demonstrating that an act was free requires enumerating records that do not
exist, and `UsageRecord.authorizationId` is explicitly *"NOT BACKFILLABLE"* with
null legitimate for machine origin (`:213-221`). There is no query that returns
"this human action cost nothing."

**Fix.** Say *"no model call"* — which is specific, true, and checkable against
`TokenUsage` — not *"spends nothing."* **DERIVATION.**

### RI-23 · SERIOUS · `MATCHING` fails contrast at 1.88:1 when the running tile is selected

`.t-live` sets `color:var(--agent-deep)` (`#43299f`) at specificity `0,1,0`
(`close-twomarks.html:92`). `.tile[aria-pressed="true"]` sets
`background:var(--ink)` (`#0d0f14`) at `0,2,0` (`:66`). The sibling rules
`.tile[aria-pressed="true"] .t-state, … .t-trigger` (`:67`) recolour those two
children to `#c3c9d2`; **`.t-live` is not in that list.**

The script (`:375-380`) sets `aria-pressed="true"` on any clicked tile. Click the
running one and `MATCHING` renders `#43299f` on `#0d0f14`:

- L(#43299f) = 0.0528, L(#0d0f14) = 0.00477 → **1.88:1**.

Required 4.5:1 (11px uppercase is not large text). It also loses the
`.tile--lit` background entirely, because `.tile[aria-pressed="true"]` at `0,2,0`
beats `.tile--lit` at `0,1,0` — **selecting the live run hides that it is
live**, which is the one tile whose state matters.

`docs/build-conventions.md:215-221` puts every ratio here under WCAG 2.2 AA once
a palette is adopted. The other ratios asserted in the CSS comments (`5.08:1`,
`4.74:1`) **verify correct**; this combination is simply not one anybody
computed.

**Fix.** Add `.t-live` to the pressed-state colour list and let `.tile--lit`
survive selection. **DERIVATION.**

### RI-24 · SERIOUS · The caption instructs a reading the markup no longer supports, and five CSS classes are dead

> *"Banded by cause. Amounts in PHP.&nbsp;&nbsp;the agent authored that finding, so
> scanning the column shows everything it touched."* — `:294`
> *"Scan the first column for the agent's work"* — `:267`

The authorship gutter was removed — `:145-149` records the removal and its
reasoning. The caption and the headline paragraph still instruct scanning it, and
the caption has a **dangling clause with no subject and a double space** where
the removed mark used to be described. The first column is `Band` (`A`, `B.1`,
`B.2`), which carries no authorship.

A `<caption>` is read first by a screen reader. This one tells that user to do
something impossible, then describes a confidence statement the row does not
make (RI-21).

Dead CSS confirming the removal was incomplete — `.gut` (`:243`), `.hatch`
(`:198`), `.wedge` (`:197`), `.m` (`:196`), `.reach` (`:209`, `:230`) — **none
appears in the document body.** `CLAUDE.md` Rule 1: dead code is a separate,
isolated cleanup commit *before* the real work.

**Fix.** Rewrite the caption to describe what is drawn; delete the five classes
in their own commit. **DERIVATION.**

### RI-25 · NOTED · The animated ellipsis carries the turn axis and is `aria-hidden`

`<span class="st" data-turn="world">waiting<span class="cue" aria-hidden="true">
<i>.</i><i>.</i><i>.</i></span></span>` — `:337`; the caret at `:309`, `:330`
likewise.

Hiding the glyph is correct per §6.1 — it *is* decoration. But the direction
contract says the turn is carried *by the character*: *"a word ending in a
character that says whose move it is"* (`:3-4`), enumerated at `:120-122`. With
the character hidden, **AT users receive five words and no turn axis.** The
words happen to be semantically suggestive, which is luck, not design — and it
breaks outright on `no recourse` versus `waiting`, where the difference is
"dead end" versus "not yours" and neither word says so.

Also: `@keyframes dot` at 4.2s `infinite` (`:135-138`) is content that moves for
longer than 5 seconds with no pause mechanism (WCAG 2.2.2). `prefers-reduced-motion`
is handled (`:250`) but that is a user-agent preference, not the *mechanism*
2.2.2 asks for. The 17s tile sweep is explicitly blessed as ambient by
`docs/build-conventions.md:272-278`; the 4.2s ellipsis is not — it is fast enough
to read as feedback, which §7.3 says would be *"a lie."*

**Fix.** Put the turn in the accessible name (`<span class="sr-only">your
move</span>`), and slow or remove the ellipsis animation. **DERIVATION.**

### RI-26 · NOTED · The failure is in the footer, politely, and `build-conventions.md` §7.1 says it takes the top of the page

> `<span class="conn" data-state="down" role="status">… Bank feed unreachable …`
> — `:368`, inside `<footer>`

`docs/build-conventions.md:257-259`: *"**A failure displaces everything.** It
takes the top of the page, states the **cause** rather than the symptom (*'the
ERP was unreachable at 03:15'*), and offers only the two actions that fix it."*
And §6.5 (`:194-199`): *"a run that fails is `role="alert"`"* — this is
`role="status"`, i.e. polite.

The wording is right (cause, with a time). The placement and the politeness are
both wrong, and the two actions that fix it are absent.

Also `:1` numeric consistency: the headline reads *"5 of 14 need you"* (`:266`)
while the register shows **two** rows carrying `data-turn="you"` and the
paragraph beneath says *"one needs you"* about the runs (`:267`). Three counts of
"need you" on one screen at three scopes. Illustrative data is marked (`:371`),
so this is not a claims violation — but it is the §5.11 shape rehearsed in
pixels, and a reviewer will read it as arithmetic.

**Fix.** Failure region above the masthead, `role="alert"`, with the two exits.
**DERIVATION.**

---

## 7. What this pass attacked and could not break

Short and honest, per the brief.

- **Refusing money and showing tokens is right, and the reasoning holds.**
  `:185-186` cites invariant 5 and `PRODUCT.md` correctly. `MeterPrice` is
  `@dropped-for-v1` (`model/billing.ts:245`) for exactly the stated reason. The
  *unit* choice is sound. RI-5 through RI-10 attack the **forecast**, not the
  unit.

- **Rendering the 90% floor to a finance operator is licensed.** G22 put the
  floor with the FDE and off the customer surface; G38 (`docs/HANDOFF.md:563`)
  resolved that against G25 and made it **read-only, not invisible**, explicitly
  to *"unblock `Close.dc.html` band D."* The surface is consistent with the live
  decision. No finding.

- **`Money` is never rendered as a partner-visible quantity anywhere on this
  surface**, and the amounts carry no cross-currency comparison — so §5.7's
  refusal and G61's display-only rule are not violated. The `PHP` in the caption
  is per §6.3 (*"Put the currency in the column header, once"*) rather than per
  cell. Correct.

- **The decision to make the register `<table>` / `<caption>` /
  `<th scope>` at desktop width is correct** and matches §6.3 exactly. The
  defect is only the breakpoint (RI-20), and the desktop markup should survive
  the fix unchanged.

---

## 8. What blocks what

| Cannot be built until | Blocks |
|---|---|
| RI-1 precedence decided | RI-2, RI-3, and any `Record<…, Term>` (see §5.10) |
| RI-6 answered | the forecast at all — RI-5, RI-7 |
| RI-8 resolved (one token total) | the tile figure and the footer figure |
| ~~G7 `managed_service_use` applied~~ **✅ MET — G79 applied it to `model/` on 8 Aug 2026** (`model/policy.ts:91`, `:327`, `:441`). ⚠️ **The contract half is a different gate and still lags** | RI-9, and therefore any per-run spend |
| RI-18 decided (un-drop or duplicate) | RI-17, RI-19 |
| The owed small-screen design (§8.1) | RI-20 |

**Thirteen of the twenty-six are DERIVATIONS and are therefore not deferrable** —
`HANDOFF` §7: *"When you defer a finding, write down whether it needs a decision
or a derivation. If it is a derivation, it is not deferrable — you are just
choosing to ship it wrong."*

Derivations: RI-2, RI-3, RI-10, RI-11, RI-15, RI-16, RI-17, RI-21, RI-22, RI-23,
RI-24, RI-25, RI-26. Decisions: RI-1, RI-4, RI-5, RI-6, RI-7, RI-12, RI-14,
RI-18, RI-19, RI-20. Mixed: RI-8, RI-9, RI-13.

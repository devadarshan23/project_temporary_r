# Product

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** YES — **the authority on what may be claimed about this product**, and on confirmed product truth: positioning, partner motion, stack, accessibility, terminology, voice.
> Maintained. Its NEVER list is binding on every surface a customer could see, and **G48 loosened nothing on it** — making v1 a product supplied no customer, no price, no SLA and no benchmark.
> *Banner added 8 Aug 2026.*

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

**TypeScript end to end — G71, 7 Aug 2026.** Node backend consuming `model/`
directly; React + TypeScript frontend sharing the same types.

`docs/domain-model.md` had recorded the backend stack as *undecided by design*
and the model as language-neutral. **That is now decided**, and the deciding
argument is specific to this repository rather than general preference:
`model/` **already is** the domain model — 16 modules, ~~683~~ **689** exports
(`grep -h '^export ' model/*.ts | wc -l`, re-derived 8 Aug 2026; 683 was true when
G71 was taken on 7 Aug and read as current until this run), zero external imports,
and **ten compile-time proofs in `model/identity.ts`** that no port to another
language preserves. The second argument is that *two vocabularies for one
concept, diverging* is the most-recurring defect class in this record, and one
TypeScript vocabulary spanning the wire collapses it structurally.

⚠️ **One caveat recorded with the decision:** after G65 (money as `bigint` minor
units, serialised as a string), money is **not** literally a shared type — the
boundary needs an explicit codec. That weakens the second argument, not the first.

✅ **The codec is decided — G111, 8 Aug 2026, and it is not built.** Exactly one
module owns the representation, and nothing else converts a `Money` to a string or
a string to a `Money` — the same *exactly one function* shape G67 requires of the
FX rate parser, for the same reason: correctness spread across call sites drifts.
**This changes nothing claimable about the product**; it is recorded here because
the caveat above is recorded here and would otherwise read as still open.

## Users

Three populations, and the third was unnamed here until 8 Aug 2026.

**The operator — confirmed as a design target, 8 Aug 2026.** Works exceptions
daily: the run strip, the findings register, band-D confirmations, and posting.
Tier 1 of the screen pack (`Mockups/rec/`) is drawn for this person and labelled
*"operators, daily"*.

**The CFO and finance controller — the stated focus, and the tie-breaker.**
Oversight rather than queue-work — exception volume, working-capital impact, and
process compliance. They own the definitions in Tier 2 (tolerances, document
types, procedure) at a monthly cadence, and they receive the period pack.

> **Resolved 8 Aug 2026 — this was open as P1 since 4 August.** Both are design
> targets; **where they compete, the controller's need for aggregate comprehension
> wins**, which keeps Product Principle 5 intact as the tie-breaker. The screen
> pack had already been drawn against an operator persona, so this ratifies an
> assumption the drawn work was resting on rather than introducing a new one.

**The forward deployment engineer (FDE) — a 1CloudHub employee, and a first-class
user of this product.** Configures the data sources at implementation, sets the
model on the customer's behalf, and provisions the tenant. Recorded here because
three decisions put them at the centre — G49 (model selection), G56 (source
configuration), G59 (sources are FDE-only) — and **no screen in the pack is a
platform surface**. Whether they get a designed surface or a runbook plus an
internal API is an open decision.

⚠️ **The surfaces named in earlier revisions of this section — Dashboard, SOP
Control Center, Exceptions, Drilldown — belong to the application being
replaced**, at `archive/sap-line:src/`. The v2 surfaces are in `Mockups/rec/` and
are organised by **who authors a thing and how often**, not by subject.

> **Correction (4 Aug 2026):** an earlier revision of this file described User
> Management as "admin-gated". It is not. `AdminProtectedRoute` exists but is
> imported by nothing, so every route is authentication-only and any signed-in
> user can reach the administrative surfaces. Evidence:
> `archive/design-record:docs/compliance-checklist.md` — that document left the
> trunk on 6 Aug 2026 with the application it audited. Its *live infrastructure*
> findings were carried onto the trunk as `docs/infrastructure-risk-register.md`;
> this one was not, because it is a property of deleted code rather than of the
> AWS account.

Beyond finance, the platform is being taken to other reconciliation-shaped audiences (see Positioning). The buyer profile for those domains has not been established.

## Product Purpose

ReconcileAI autonomously detects, explains, and resolves reconciliation exceptions, and gives users conversational access to the underlying source data instead of requiring them to query the system of record directly.

In the finance instance this means ERP exceptions — invoice/PO mismatches, duplicate payments, delayed receipts — surfaced as explained, actionable items rather than raw records.

⚠️ **Superseded as a statement of the BUILD TARGET, 7 Aug 2026 — G48. v1 is a
product, not a demo.** This line read *"success at the current stage is a
convincing demonstration, not production throughput"*, and it was true of the
application being replaced. It is not true of what is being built.

**What that does and does not change.** It changes the acceptance test for scope —
`docs/v1-scope-ledger.md` adjudicates the v1 trim on *"what the demo loses"*, which
asks what a prospect would fail to see rather than what a customer would fail to
get. It changes **nothing** in Evidence on Hand or in the NEVER list below: there
is still no customer, no price, no SLA, no benchmark and no production deployment.
**Building a product is not having one.** See Capabilities and Constraints.

## Go-to-Market — Partner Reselling Motion

**Confirmed 4 Aug 2026.** The platform is sold **through partners who resell it**,
on infrastructure **1CloudHub hosts**. Partners bring their own end-customers onto
shared infrastructure; there is no per-partner deployment and no white-labelling
commitment at this stage.

This is new product truth and has no counterpart in the existing codebase. It
implies, at minimum:

- **Tenant isolation** — an end-customer's data is visible only within its tenant.
- **Partner-scoped visibility** — a partner sees its own customers and no others.
- **Deal registration** — partners register opportunities against end-customers.

Nothing in the current application models a tenant, a partner, or a customer
scope. The field named `tenantUserId` is **not** a tenant identifier: it is a
verbatim copy of `userid` (`archive/sap-line:src/hooks/useLogin.ts:46` — read it
with `git show archive/sap-line:src/hooks/useLogin.ts`). Treat it as absent.

## Domain Strategy

**Confirmed 4 Aug 2026.** The platform presents as domain-neutral reconciliation.
Depth is deliberately uneven, and that unevenness is the plan, not a gap:

| Domain | Treatment |
|---|---|
| **Finance / ERP** | Worked example #1 — full demo data, walkable end-to-end flow |
| **KYC** | Worked example #2 — full demo data, walkable end-to-end flow |
| Credit underwriting | Named as delivered capability; not built out for the demo |
| Medical records | Named as delivered capability; not built out for the demo |

All four are real delivered client engagements (see Evidence on Hand), so all
four may be *named*. Only finance and KYC are *demonstrated*. Do not build a
shallow third or fourth flow — a half-built domain is worse evidence of a
general engine than an honestly scoped one.

Two worked examples in deliberately different shapes is the point: finance
reconciles structured records against each other, KYC reconciles identity
documents against registry data. If one entity model serves both, the
domain-neutrality claim is demonstrated rather than asserted.

## Platform Position

**Confirmed 4 Aug 2026.** ReconcileAI is a **standalone platform**. It does not
run on, and is not a solution within, 1CloudHub's AiVolvex Enterprise Agentic
Platform. It must be sellable and demonstrable without a dependency on another
platform's roadmap.

It does, however, **adopt proven components and patterns from AiVolvex** to
become well-rounded rather than reinventing them — most importantly its
authentication approach (Cognito + OIDC bearer tokens with a gateway-side
authorizer), its layered Solution / Platform / Infrastructure separation, and
its "COTS solutions" concept, which lands here as `SolutionPack`.

See `docs/platform-adoption.md` for what is adopted, what is deferred and what
is explicitly declined.

## Positioning

**A general reconciliation platform.** The durable claim is the reconciliation engine itself; ERP finance is one instance of it, not the whole product. This is a deliberate repositioning away from the ERP/SAP-only framing that the current landing page copy still carries.

The mechanism a neighbouring product could not truthfully copy: an agentic layer that detects, *explains*, and resolves exceptions across domains, rather than a rules engine that only flags them.

**Open decision:** the marketing surface has not yet been rewritten to match this positioning. Existing landing copy positions the product as "the AI layer on top of SAP" and leads with ERP-specific framing. Future work on that surface should reflect the platform positioning, not extend the SAP-only one.

## Operating Context

**The product in one paragraph — G56, 7 Aug 2026, and the statement every scope
question resolves against.** Data sources, mostly financial, arrive **in different
languages and currencies**. Finance teams perform **a variety of reconciliations**
before **posting to the ERP**, **paying invoices**, or **submitting documents for
compliance** — three outcomes, not one. **The FDE configures the sources.** **The
finance team decides which reconciliations run** — two-way, three-way, one-to-N —
**and it is not a fixed set**: many runs across many document varieties,
reconfigured as their needs change.

- The spine is **Capture → Close → Post**. Only two stages have a daily screen.
- Exception queues originate from a system of record; in the finance instance, an ERP.
- **Reconciliations are configured by the finance team, not fixed by us.** Worked
  examples: three-way match of invoice / purchase order / goods receipt, and bank
  statement to transaction settlement. Those are examples, **not the permitted set**.
- **Standard operating procedures are first-class** — numbered clauses in prose,
  quotable in an audit, versioned, and the artefact the definitions implement.
- **The chatbot's purpose is narrow: a lookup before a posting.** Check inventory
  before a production order; place a partial order when inventory is partial.
- Documents are part of the workflow, and **handwritten and non-Latin dockets are
  a normal case**, not an edge one.

⚠️ **Earlier revisions described the replaced application's flow** — *"users move
between an aggregate view (dashboard), an exception list, and a per-item
drilldown"* — and that application is at `archive/sap-line:src/`.

## Capabilities and Constraints

**Confirmed surfaces** (present in the application being replaced, now at `archive/sap-line:src/`): Login, Dashboard, Exceptions, Drilldown, SOP Control Center, User Management, and three assistant surfaces (SAP, ERP, RAG). Session handling is cookie-based.

**Authorization — there is none.** Every route is authentication-only. There is
no admin gate, no role enforcement at the route layer, and `/preview-dashboard`
is reachable with no authentication at all. Identity is asserted by the client:
`userid` is read from a non-`httpOnly` cookie and sent in the request body, and
`archive/sap-line:src/pages/ReconcileLanding.tsx` lets a signed-in user overwrite
that cookie with any other user's id. Do not describe this product as having
access control.

**Confirmed platform capabilities:** streaming responses over WebSocket; an agentic dashboard-builder that composes dashboards on request; TextOps; document upload and extraction.

**The v1 platform choices, decided 7 Aug 2026.** All are AWS, and the closure is
deliberate — the guiding principle is to simplify the backend and trade
flexibility for simplicity:

| Concern | Choice | Decision |
|---|---|---|
| Document extraction (IDP) | **AWS Textract**, plus **SageMaker custom models** where Textract's language or handwriting coverage falls short | G53, G69 |
| Inference | **Bedrock and SageMaker only** — no third-party model providers | G54 |
| Model selection | **Set by the FDE in the control plane, on behalf of all customers.** A customer never chooses one; a change is a support ticket. **No model identity appears in engine code at all** — the published catalogue is the only source, so changing a model is a catalogue publication rather than a code deploy | G49, **G104** |
| Business intelligence | **Amazon Quick Suite**, standard implementation, **one account per tenant** | G57, G70 |

⚠️ **Two of these carry an unclosed verification item** and must not be treated as
settled engineering: Textract's handwriting and non-Latin coverage in
`ap-southeast-1`, and Quick Suite's row-level-security and namespace model. Both
are checkable in an afternoon and neither has been checked.

⚠️ **Which model is seeded into the catalogue is recorded in `docs/HANDOFF.md`
(G104), deliberately not here.** A specific model identity in the document that
governs what may be claimed is an invitation to put it in copy, where it becomes a
commitment nobody made and a benchmark nobody ran.

**Cash application — a MATCH and an ALLOCATION are different outcomes, and the
record must not merge them. Ruled 8 Aug 2026 — G105. Nothing is built.** Where one
payment covers several open items, the engine looks first for an exact combination
of open items summing to the payment: that is what the payer **intended** to pay,
and it is a **match**. Where no such combination is found, the cash is poured down
an oldest-first (FIFO) **allocation** — which is a **judgement the firm makes about
money it cannot attribute**, not a match, and it is recorded as one.

> ⚠️ **The search bound is a product fact, not an implementation detail.** The
> exact-combination search is NP-hard, so it runs under a stated limit on group
> size and effort, and **the fall-through to allocation is stated and logged**.
> Silently truncating the search would dress an allocation as a match, which is
> the single thing this distinction exists to prevent. **Do not describe the
> product as matching what it in fact allocated** — that is the Principle 4 line
> (demonstration honesty) applied to the engine rather than to a demo.

**Classification before use — an unmapped source column is stored and unreadable.
Ruled 8 Aug 2026 — G106. Nothing is built.** Ingested payloads are
schema-agnostic, and classification is declared once per field. **A key with no
field mapping is retained but unaddressable — by any agent, prompt, export or
dashboard.** It fails closed.

> ⚠️ **This is user-visible friction and belongs in the product description
> rather than being discovered during an implementation.** Configuring a source
> is an FDE task (G56, G59), and it now includes classifying that source's
> columns; until a column is classified, it will not reach the assistant, an
> export or a dashboard. **The alternative — readable by default, with a high bar
> for the sensitive ones — was considered and rejected**, because a column nobody
> classified is a column whose sensitivity nobody has decided.

**Terminology — "exception" and "finding" are two grains, not two words.**
Confirmed 8 Aug 2026.

- An **exception** is the individual item. It is the modelled entity
  (`model/domain.ts`), and it is what gets assigned, decided and audited.
- A **finding** is the register's **banded row** — exceptions grouped by cause.
  `Close.dc.html` draws *"5 need you · 14 open"* as **six** rows (A, B.1, B.2, C,
  D, E), and `Finding.dc.html` opens one.

**A finding is PRESENTATION ONLY — derived at query time, never stored.** It gets
no id, no type and no operations.

> ⚠️ **The consequence, accepted when the decision was taken.** Assignment,
> decisions and audit all attach to **individual exceptions**. So *"assign this
> finding to me"* writes to six rows, and **nothing in the record says those six
> were one act.** An auditor reconstructing the decision sees six assignments, not
> one. If that becomes unacceptable, the fix is a correlation id — the same
> instrument G43 already owes for split proposals — not a new entity.

**Device support — fully responsive. Confirmed 8 Aug 2026.** Every surface adapts
down to phone.

> ⚠️ **This was taken against the recommendation, knowingly, and the cost is
> real.** The eighteen comps are drawn at **1300px with zero breakpoints**
> (`grep -oh "@media[^{]*" Mockups/rec/*.dc.html | wc -l` → 0). The register's
> central argument is that figures stay **comparable down a column** and sub-rows
> sit *"in the same columns at the same alignment, one indent deeper"* — **that
> argument does not survive a reflow to 375px.** Fully responsive therefore means
> a **genuinely different small-screen design for the register**, not a
> narrower version of the wide one. That design does not exist and is owed.

**Localisation — the interface is English; the documents are not.** Confirmed
8 Aug 2026. The extraction pipeline handles documents in any language, including
handwritten and non-Latin scripts; **the interface ships in English only**, and
nothing in the frontend is required to be locale-switchable. Recorded so nobody
assumes internationalisation is coming, and so nobody discovers late that it is
not.

**Currency — displayed, never converted for matching.** Documents may be in any
currency, and a reconciliation matches within one. Nothing converts during
matching or ceiling comparison. **One exception:** the consolidated group total in
the period pack is converted and **stamped with the rate and its as-at date**,
where the rate is **entered by the customer per period** — a versioned decision
with an owner, like a tolerance — and never taken from a market feed or invented.

**Stage — the asset that exists today is a sales demo and POC asset**, and it is used to win engagements. Data shown in it is illustrative rather than a live customer close cycle. **Future work must not describe it as production software serving paying customers, and must not present its figures as customer results.**

> ⚠️ **G48, 7 Aug 2026 — read the two halves of this separately, because they moved
> in opposite directions.** The **build target** is now a product, not a demo. The
> **evidence position is unchanged**: there are no paying customers, so describing
> this as production software serving them would be false today and would still be
> false the day the first line of application code lands. The sentence in bold above
> is not a statement about ambition — it is a statement about evidence we do not
> have, and G48 supplies none of it.

**Strategic direction — the no-SAP line is the product.** Removing the SAP dependency broadens the addressable market and is the direction of travel. The SAP-connected line is the earlier build. This matters for any work that assumes a SAP system of record: it should not be treated as a fixed requirement.

**Deployment reality (verified 4 Aug 2026, corrected after confirmation with
the team):** the live non-SAP application is the **AWS Amplify** build at
`dev.d1elsdj23rj8c7.amplifyapp.com`, deployed from `no_sap_reconcile_aws` and
calling API Gateway `24m9hiutid`. The Firebase host
(`reconcile-ai-502710.web.app`) is live but is the output of a **GCP port
attempt** from `no_sap_reconcile_gcp`, not the product direction. The public
marketing site at `reconcileai.1cloudhub.com` is a separate app on CloudFront +
S3, deployed from `reconcile_public_website`, and sits in a **different AWS
account**. The orphaned CloudFront/S3 tier in this account is empty and returns
403; the Azure Static Web Apps host returns 404. SAP-line backend services run
on AWS — API Gateway, Lambda, RDS PostgreSQL, Bedrock, Cognito.

**Repository constraint — branches are used as folders, not as versions.**
Confirmed with the team, 4 Aug 2026. The repository has 26 branches across
eight unrelated root commits because branches were used to separate *variants*,
not to track *history*. There is no trunk and no merge relationship between
most of them. Never assume the checked-out branch is current; the authoritative
branch depends on which artifact you mean.

| Branch | What it is |
|---|---|
| `no_sap_reconcile_aws` | **The live AWS deployment.** Latest non-SAP code. Source for `dev.d1elsdj23rj8c7.amplifyapp.com`. |
| `reconcile_public_website` | **The live marketing site**, `reconcileai.1cloudhub.com`. Separate app, Tailwind 4 + radix-ui. |
| `no_sap_reconcile_gcp` | A **port attempt** from AWS to GCP. Source for `reconcile-ai-502710.web.app`. Not the direction. |
| `no_sap_reconcile` | Azure-targeted variant. Calls `${BASE}/handler` with an APIM key — a route that does not exist on the AWS gateway. Superseded. |
| `Sandbox` | Most active **SAP-line** source. Earlier product. |

**Resolved: the two-frontend question.** An earlier revision of this file
recorded an unresolved discrepancy between a Firebase host and an Amplify host.
Both are real and neither was wrong — Amplify is the live deployment from
`no_sap_reconcile_aws`, and Firebase is the output of the GCP port attempt on
`no_sap_reconcile_gcp`. **Amplify is canonical.**

Verified against source: `no_sap_reconcile_aws` carries no `CONFIG_AZURE` and no
APIM key, and its login posts to `${BASE}/dev/config` — which matches the live
application's observed behaviour exactly.

## Brand Commitments

- **Name:** ReconcileAI.
- **Publisher:** 1CloudHub. The horizontal logo is on the trunk at `assets/1cloudhub-logo-horiz.jpg` (it shipped from `archive/sap-line:src/assets/1CloudHub-Logo-horiz-hires-RGB-copy-1.jpg`), and the product links to `1cloudhub.com` and the company LinkedIn.
- The product is presented as a 1CloudHub offering, not a white-label or standalone brand.
- **The "ReconcileAi" wordmark is an image, not type.** A single-word mixed-case
  logotype — capital R, capital A, lowercase i — in a geometric sans with rounded
  terminals. **It is not Inter and it is not Nunito**: it is a custom or licensed
  logotype delivered as an image, so it cannot be reproduced by setting the name
  in a font. Anyone rebuilding a surface must obtain the asset rather than
  re-typeset it, and the licence position on it has not been established.
  Measured 4 Aug 2026 from a browser capture of the live no-SAP build (§10.1 of
  `archive/design-record:docs/brand-style-guide.md`). This is the one fact in the
  documents deleted on 6 Aug that could not have been reconstructed by reasoning,
  which is why it is restated here.

**Voice — binding as an intent, and the standard is owed.** Confirmed
8 Aug 2026. The product speaks plainly and specifically, and **explains the
consequence rather than labelling the state**. The screen pack is the reference:
*"a silent folder and a broken watcher look identical until a close is late"*;
*"lowering a floor is the fastest way to put a wrong number in the ledger"*.

This is why the empty-state rule in `docs/build-conventions.md` §7.1 works — an
empty state that names what was checked and when is the same instinct as a voice
that explains consequence.

⚠️ **Recorded as a confirmed intent, not as a codified standard.** Neither the
comps nor an agent should be the author of a copy standard. **Whoever owns product
writing owes the actual guide**, and until it exists this paragraph is the whole
of the commitment.

No typography, palette, or visual-identity constraint has been established as
binding — the wordmark above is an observation about an existing asset, not a
constraint on the rebuild. The measured colour, type and spacing values of the
old application are kept at `docs/design-tokens.md`, and are likewise binding on
nothing.

> ⚠️ **Two unrelated things are called a "palette" in this record; do not read one
> as the other.** The sentence above is about **visual identity**, and it stands.
> Separately, G90 and G102 reserve a `palette` **key** on `SolutionPack` that
> **admits only `null` in v1**, has no reader, and exists so a field can be added
> later without invalidating pack signatures. Neither is applied to `model/`
> (`grep -rn palette model/*.ts` → no match, 8 Aug 2026). **Reserving a key is not
> a theming feature and is not a white-labelling commitment** — see Open
> Decisions, where white-labelling remains out of scope.

## Evidence on Hand

**Real, referenceable — delivered client engagements** in adjacent reconciliation domains, confirmed by the product owner:

- KYC
- Credit underwriting
- Medical records reconciliation
- **Accounts payable — a Philippine real estate conglomerate.** ⚠️ **ADDED 18 Sep 2026, and it is the fourth. It was absent from this list while its figures were already drawn on two public surfaces** (`docs/handoff-pack/V4 Success Story.dc.html`, `docs/handoff-pack/V1 Landing.dc.html`) — found by an adversarial read of the build pack, not by anybody maintaining this file. **Cleared for public use, unnamed, with marketing sign-off** — product owner, 18 Sep 2026, recorded under **G268**. The client is not named; the sector, scale and period are. See the release note below.

These are delivered work, not prototypes, and may be referenced as proof that the engine generalizes beyond finance. **Client names have not been cleared for public use** — confirm permission before any named reference appears on a public surface.

> ✅ **THE ONE CLEARED RELEASE, AND IT IS AN EXCEPTION THIS FILE NOW CARRIES RATHER THAN FORBIDS — 18 Sep 2026, G268.**
> ⚠️ **This paragraph exists because the sentence above it was, for four days, false in practice:** the fourth engagement's figures were on a drawn public surface with no entry here and no recorded clearance, and `V4 Success Story` asserted *"agreed for release"* against a repository that recorded no agreement. **The agreement is real; the record of it was missing. That is what is fixed here, and the fix is dated so the gap is visible rather than erased.**
>
> **What is cleared:** the accounts-payable engagement's outcome figures and scale description, **on the public marketing plane only** — V1 Landing and V4 Success Story. **Marketing sign-off held by the product owner, 18 Sep 2026.**
>
> 🛑 **THE BOUNDARY IS THE POINT, AND IT IS NARROW.** The clearance covers **the page that SELLS the product; it does not reach a single surface INSIDE it.** No figure from this engagement may appear in the console, in a fixture, in a demo tenant, in a dashboard, in a pack, or in any artefact a customer could mistake for their own data. **`PRODUCT.md`'s standing rule — *never present in-product figures as customer results* — is untouched, and this exception runs in the opposite direction: it permits a real customer result on a marketing page, and permits nothing at all in the product.**
>
> **What is still forbidden on that page and everywhere else, unchanged:** a named customer, a logo, a testimonial, **a price**, an SLA, and **a licensing or marketplace claim**. 🛑 **`V1 Landing` currently breaches the last of those** — it states ReconcileAI *"is listed on AWS Marketplace"* and can be *"billed against your committed spend."* `grep -rn -i "aws marketplace"` outside the pack returns **nothing**. That sentence is a transaction and licensing claim with no support anywhere in this repository and **is not covered by this clearance**; it is tracked as a correction to the surface, not as an exception to this list.
>
> **And the pack's own index is wrong about this and must be corrected rather than trusted:** it tells every reader *"the surfaces are illustrative — every tenant, partner, figure and case in them is synthetic."* **That is false about V4**, which says on its own face that its figures are the client's own. The pack's own conflict rule — *"where a status word disagrees with a surface, the surface wins"* — settles it against the index. **The blanket sentence is the dangerous half**, because it is the only place a reader is told the pack is synthetic, and it is wrong about the one surface where being wrong matters.

**Demonstration assets:** four product demo videos hosted at `reconcileai-demo-video.s3.us-west-2.amazonaws.com` (BIOps, TextOps, ReconcileOps, and a customer intro cut).

**Explicitly absent — do not fabricate:** named customer logos, testimonials, pricing, licensing terms, benchmark figures, SLAs, or deployment/scale claims. None have been established.
⚠️ **AMENDED 18 Sep 2026 — G268, and the amendment is ONE ENGAGEMENT WIDE.** The accounts-payable engagement above carries cleared outcome and scale figures **for the public marketing plane only**. Everything else in this sentence stands exactly as written, for every other engagement and every other surface. **Read the release note above before quoting a figure, and do not read this amendment as a general loosening — it is a single dated exception with a named holder.**

**Requires sourcing before reuse:** the current landing page carries market statistics on finance-leader sentiment, annual spend lost to mismatches, and manual-review rates per 1,000 invoices. Their provenance is not recorded anywhere in the repository. Do not propagate them to new surfaces until a source is attached, and do not invent one.

## Product Principles

1. **Explain, don't just flag.** The differentiator is that an exception arrives with its reasoning attached. Any surface that shows an exception without its explanation has lost the product's point.
2. **The engine is the product; finance is an instance.** Design decisions should not hard-code ERP or SAP vocabulary into shared surfaces when a domain-neutral term is truthful.
3. **No system of record is assumed.** The direction is standalone operation. Treat a specific ERP integration as one adapter, not as a prerequisite.
4. **Demonstration honesty.** Because the product is used to sell, illustrative data must never be dressed as customer results, and capability must never be dressed as track record.
5. **Oversight before execution.** The primary user is accountable for a process, not clearing a queue. Aggregate comprehension outranks per-item throughput when the two compete.


## Accessibility & Inclusion

**WCAG 2.2 AA. Confirmed 8 Aug 2026.** Nothing in this repository had established
a standard before that date, and the absence was itself unrecorded.

**Why it binds more than usual here.** The screen pack carries run and finding
state in **coloured dots** — red for exception, green for cleared, amber for held —
and status carried by colour alone is the most common way a dense financial table
fails an audit. Three consequences follow, and they are product facts rather than
visual preferences:

- **Every status needs a non-colour carrier** — a shape, a glyph, or a word — not
  a hue plus a tooltip.
- **The numeric tables need real structure**: header association and scope, so the
  consolidated block with entities as rows and reconciliations indented beneath is
  navigable by something other than sight.
- **The dimmed-register pattern needs a real focus story.** `Finding.dc.html`
  keeps the register present at 45% opacity rather than covering it, which is good
  for comprehension and says nothing yet about focus order or announcement.

⚠️ **Contrast is not a settled question either.** `PRODUCT.md` records that no
palette has been established as binding, and `docs/design-tokens.md` is explicitly
binding on nothing — so the ratios have never been checked against anything. Any
palette adopted later inherits this requirement.

**Not yet established:** whether a specific assistive technology, a procurement
questionnaire, or a jurisdiction's statute (Singapore, EU EN 301 549) sets a
higher bar. Record the answer here rather than inferring one.

## Open Decisions

- **Partner-facing roles.** The partner motion is confirmed, but the role model
  is not: what a partner admin sees versus an end-customer user, and whether
  partners administer their own customers' users.
- **Deal registration scope** — whether it lives in the product or in a separate
  partner portal.
- **White-labelling** — explicitly out of scope for now (shared platform,
  1CloudHub branding). Revisit only if a partner makes it a condition.
- Whether the adjacent-domain engagements (credit underwriting, medical records)
  can be **named publicly**, and whether client names can be attached.

**Resolved: the operator is a design target.** Open as P1 from 4 August until
8 August 2026. **Both the operator and the CFO/controller are design targets, and
where they compete the controller wins** — see Users. The screen pack had already
been drawn against an operator persona, so this ratified an assumption the drawn
work was resting on.

**Resolved: which branch becomes the trunk.** This was an open decision until
6 August 2026. It is **`main`** — a fresh orphan branch, sharing history with
none of the eight existing roots, re-rooted on the day the old application was
deleted from it. The cut removed 396 tracked files: `src/` (349), `public/`, the
root build configuration, and the twelve documents describing the old product.
Nothing was lost. Three annotated tags carry it, all pushed and verified on
`origin` — `archive/sap-line` (the SAP-line application), `archive/design-record`
(the design record, the model, every deleted document, and ~50 commits of
reasoning) and `archive/trunk-pre-rebuild` (the trunk as it stood immediately
before the cut, 446 tracked files).

The Repository constraint above still holds for the *other* 26 branches: they
remain folders rather than versions, and `main` does not merge with them. What
changed is that there is now one branch that is a trunk, and salvage from the
others runs through `docs/salvage-ledger.md`, which addresses every artifact by
tag.

## Superseded

The following are recorded because earlier revisions of this file asserted them
and downstream documents may still repeat them:

- ~~"Routes are auth-gated, with a separate admin-only gate."~~ There is no
  authorization of any kind. See Capabilities and Constraints.
- ~~The SAP / non-SAP split as the primary product axis.~~ Superseded by the
  partner motion and the domain strategy above. The SAP integration is one
  adapter among several, not a product line.

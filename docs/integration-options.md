# Integration Options — Licensing-Aware Assessment

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** NO — a licence assessment, not a stack decision. **Do not build the stack it recommends without re-deriving it.**
> **Licences verified 4 August 2026 and not since.** The file says itself that licences in these categories change often; `docs/HANDOFF.md` §3c records the same lesson learned the hard way — *re-verify before each becomes a contractual commitment, not once.* ⚠️ **Its recommended stack is overtaken in four places and says so nowhere:** **G71** decided TypeScript end to end; **G53/G69/G85** made Textract the IDP engine — the word does not appear in this file; **G57/G82** made Amazon Quick Suite the BI layer, which none of its observability rows contemplates; and **G54/G80b** closed model providers to Bedrock and SageMaker. ⚠️ Its whole framing is *"how we sell it"* as partner-resold SaaS, and **G51 narrowed partner to a commercial record** — no partner user ever signs in — so several disqualifications rest on a motion v1 no longer has.
> ⚠️ **Two rulings taken 8 Aug 2026 land on this file and neither is a licence verification** — **G104** seeds the model catalogue with `claude-haiku-4-5-20251001` and puts no model id in engine code; **G109** takes a real YAML parser for `tools/`. Both are recorded in the dated addendum immediately below, **outside the licence tables on purpose**: nothing was read against a primary source, so every new dependency's licence position is **UNVERIFIED** under this file's own rule.
> *Banner added 8 Aug 2026.*

> **Purpose.** ReconcileAI is being rebuilt. This document assesses the third-party
> components available for four areas — ERP integration, workflow orchestration,
> connections/notifications, and observability/evaluation — through the lens of the
> one constraint that decides everything: **how we sell it.**
>
> **Verification date: 4 August 2026.** Every licence claim carries the URL it was
> read from. Licences in these categories change often — Airbyte, HashiCorp,
> Elastic, Redis, Grafana and n8n have all relicensed in recent years — so nothing
> here is recalled from memory. Claims that could not be confirmed against a
> primary source are marked **unverified** and must not be relied on.
>
> **This is not legal advice.** Where a licence question is genuinely ambiguous for
> a resale model, it is flagged for counsel rather than guessed at. See
> [Open Questions](#open-questions--needs-legal-review).

---

## Addendum, 8 August 2026 — two rulings land on this document, and neither is a licence verification

🛑 **Read the rule this document sets for itself before reading this section.**
The purpose block above says every licence claim carries the URL it was read from,
and that claims which could not be confirmed against a primary source are marked
**unverified and must not be relied on**. **Nothing below was read against a
primary source.** No `LICENSE` file was fetched, no vendor page was retrieved, and
**no row was added to the Tier 1–4 tables**, because a verdict in those tables
means somebody read the text. These are *decisions taken elsewhere*, recorded here
because this is the file people search when they ask whether a component is safe
to ship.

### G104 — the model catalogue is the only source of a model id, and it is seeded with Claude Haiku 4.5

**Decided:** no model id appears in engine code. The FDE publishes a
`ModelCatalogEntry` downward (G49); the engine calls `resolveModel()`, which is
**the only executable enforcement of residency in the codebase** — invariant 7,
*"Residency survives inference"*. A bare literal in a Lambda skips it.

**The seeded entry is `claude-haiku-4-5-20251001`, not `claude-3-haiku-20240307`.**
The architecture draft this ruling answers named the March 2024 model; it is August
2026. Haiku is the right **tier** for structured extraction at temperature 0 — the
draft was right about that — but the version was inherited from a sample snippet
rather than chosen. **Changing models is henceforth a catalogue publication, not a
code deploy**, which is what G49 says it should be.

**Licence position — unchanged, and one open question gets sharper.** Bedrock is
already assessed here as Tier 4, permitted under the AWS Customer Agreement §12
End User definition — the **AWS (Step Functions, Bedrock, CloudWatch)** row in the
Tier 4 table, and §4.6. That is not disturbed. But **Open Question 3 — *"Resale of Anthropic
models subject to certain limitations"*, announced 14 Oct 2025 without the
limitations being enumerated — now names the model we are seeding.** It stays
**unverified** and it stays a question for an APN Partner Development Manager, in
writing. Seeding a catalogue entry is not clearance to resell what it points at.

### G109 — `tools/` takes a real YAML parser, pinned exact

**Decided:** the checkers stop hand-parsing YAML. Four of them parse the OpenAPI
files — wire-mirror, plane-tags, `tenantId`-in-body and the capability sweep — and
two of those need genuine recursive resolution: wire-mirror must follow `$ref`
chains and compare **enum order** against `model/`, and `tenantId`-in-body must
walk nested schemas. **A hand-parser that is subtly wrong produces a checker that
passes while asserting nothing**, which is the defect shape those tools exist to
catch, occurring inside the tools themselves. The ruling departs knowingly from
`tools/planner/extract.mjs`'s zero-dependency precedent.

⚠️ **No parser has been named, and this document must not be read as clearing
one.** Licence position: **UNVERIFIED — nothing read.** Whoever picks the package
does what this document did on 4 August for everything else: fetch the `LICENSE`
from `raw.githubusercontent.com`, quote the operative clause, record the URL. The
bar is low here — a build-time dev dependency that never ships to a tenant is a
long way from the ELv2 and SSPL problems this document exists to catch — **but
"the bar is low" is a reason to verify quickly, not a reason to skip it.**

### The other new dependencies, recorded so nobody assumes they were assessed

Three more pinned-exact dependencies were ruled on the same day. **None was
licence-verified, none appears in any table above, and this file is not their
control** — `docs/build-conventions.md` is, and it distinguishes *decided* from
*installed*.

| Dependency | Ruling | Licence position here |
|---|---|---|
| `@types/node` | **G96** — the first new devDependency. It corrects G95's *"zero new dependencies"*, which was true of **running** tests and false of **typechecking** them | **UNVERIFIED — nothing read** |
| `pg` | **G98** — the Postgres client, chosen because it exposes the backend PID, which is what lets a two-tenant leak test assert both queries ran on the *same* pooled connection | **UNVERIFIED — nothing read** |
| Drizzle | **G99** — the ORM. Generated types make model-versus-table drift a compile error. ⚠️ It autocommits outside `$transaction`, which is the `SET LOCAL` footgun `docs/build/red-buildability.md:347` names by product | **UNVERIFIED — nothing read** |

⚠️ **A licence check is not the only check these owe.** This document's whole
method is that a permissive badge on a wrapper is not a permissive licence on what
it wraps (§1b.5). The same discipline applies to a transitive tree nobody has
looked at yet.

---

## The Constraint

From `PRODUCT.md` (confirmed 4 Aug 2026): ReconcileAI is **sold through partners who
resell it**, on infrastructure **1CloudHub hosts**. Partners bring their own
end-customers onto **shared infrastructure**. There is no per-partner deployment and
no white-labelling commitment at this stage.

Translated into licence terms, that means:

| We are | Therefore |
|---|---|
| **Providing software to third parties as a hosted service** | Elastic Licence v2, SSPL, Commons Clause and n8n's Sustainable Use Licence are **disqualifying** without a paid commercial agreement |
| **Running one shared deployment for many tenants** | "Multi-tenancy is an Enterprise feature" is a **pricing decision disguised as a technical one** — check it for every candidate |
| **Distributing through resellers** | Some commercial agreements permit hosting but **forbid passing software to resellers** (SAP PartnerEdge ASP does exactly this) |
| **Running a network service** | AGPL-3.0 needs care — flagged explicitly, never silently passed |

The absence of a white-labelling commitment helps slightly with "value derives
substantially from" tests, but it does **not** cure ELv2's "substantial set of the
features or functionality" test. Do not rely on it.

---

## Licence-Risk Summary

The single most useful table in this document. Read this first.

### Tier 1 — Permissive. Safe to build on.

| Component | Licence | Area | Verified at |
|---|---|---|---|
| **Temporal** (server, UI, all SDKs) | MIT (sdk-java Apache-2.0) | Orchestration | `raw.githubusercontent.com/temporalio/temporal/main/LICENSE` |
| **OpenTelemetry** | Apache-2.0 | Observability | `raw.githubusercontent.com/open-telemetry/opentelemetry-specification/main/LICENSE` |
| **Langfuse** (core) | MIT (`ee/` dirs excepted) | Observability | `raw.githubusercontent.com/langfuse/langfuse/main/LICENSE` |
| **Debezium** | Apache-2.0 | ERP / CDC | `raw.githubusercontent.com/debezium/debezium/main/LICENSE.txt` |
| **Apache Camel** | Apache-2.0 | ERP | `raw.githubusercontent.com/apache/camel/main/LICENSE.txt` |
| **`pyodata`** (SAP OData client) | Apache-2.0 (dep: `lxml`, BSD) | SAP | `raw.githubusercontent.com/SAP/python-pyodata/master/LICENSE` |
| **Meltano** core | MIT | ERP | `raw.githubusercontent.com/meltano/meltano/main/LICENSE` |
| **Meltano SDK** (`singer-sdk`) | Apache-2.0 | ERP | `raw.githubusercontent.com/meltano/sdk/main/LICENSE` |
| **Airbyte Python CDK** | MIT | ERP | `raw.githubusercontent.com/airbytehq/airbyte-python-cdk/main/LICENSE.txt` |
| **OpenBao** | MPL-2.0 | Secrets | `raw.githubusercontent.com/openbao/openbao/main/LICENSE` |
| **Mastra** core | Apache-2.0 (`ee/` dirs excepted) | Orchestration | `github.com/mastra-ai/mastra/blob/main/LICENSE.md` |
| **LangGraph** | MIT | Orchestration | `github.com/langchain-ai/langgraph/blob/main/LICENSE` |
| **Vercel AI SDK** | Apache-2.0 | Model routing | `github.com/vercel/ai/blob/main/LICENSE` |
| **Trigger.dev** | Apache-2.0 (SDK pkgs MIT) | Orchestration | `github.com/triggerdotdev/trigger.dev` root LICENSE |
| **Prefect** · **Dagster** · **Airflow** | Apache-2.0 | Orchestration | respective repos |
| **OpenLLMetry** / `traceloop/hub` | Apache-2.0 | Observability | `raw.githubusercontent.com/traceloop/openllmetry/main/LICENSE` |
| **Slack SDKs** (node, python, bolt) | MIT | Connections | `raw.githubusercontent.com/slackapi/*/main/LICENSE` |
| **Microsoft Graph SDKs**, MSAL, Bot Builder, Adaptive Cards | MIT | Connections | `raw.githubusercontent.com/microsoftgraph/*`, `AzureAD/*`, `microsoft/*` |
| **AWS SDKs** (JS v3, boto3, Encryption SDK) | Apache-2.0 | Connections | `raw.githubusercontent.com/aws/aws-sdk-js-v3/main/LICENSE` |
| **Standard Webhooks** · **Svix** | Apache-2.0 · MIT | Connections | respective repos |
| **Stripe Smokescreen** (SSRF egress proxy) | MIT | Connections | `raw.githubusercontent.com/stripe/smokescreen/master/LICENSE.txt` |
| **OData protocol** | OASIS standard, royalty-free | SAP | `oasis-open.org/committees/odata/charter.php` |

### Tier 2 — Copyleft. Usable, but flag it.

| Component | Licence | The issue | Verdict |
|---|---|---|---|
| **Singer taps** (192 of 199 `singer-io` repos) | AGPL-3.0 | §13 network source disclosure. Taps run as separate OS processes over stdout JSON — a mere-aggregation argument — but any patch you make is unambiguously covered | **GO-WITH-LEGAL-REVIEW** |
| **Grafana / Loki / Tempo / Mimir** | AGPL-3.0 (since 20 Apr 2021) | Unmodified + internal = low risk. **Embedded in the tenant-facing UI = the risky middle ground.** Grafana Labs ships a **free proprietary Enterprise binary** as the intended escape hatch | **GO-WITH-CARE** — use the Enterprise binary |
| **OpenLogReplicator** (Oracle CDC) | AGPL-3.0 | Fine unmodified as a separate process. Must be kept away from Oracle Instant Client (anti-GPL clause) | **GO-WITH-CAUTION** |
| **Inngest JS SDK** (`inngest-js`) | GPL-3.0 | A strong-copyleft library imported **directly into our own code** — copyleft exposure on our application source, independent of the server licence | **AVOID** |
| **Helicone AI Gateway** | GPL-3.0 (not AGPL) | No network clause; fine as an unmodified separate proxy process. Do not link into our binary | **GO-WITH-CAUTION** |

### Tier 3 — Disqualifying without a commercial agreement.

| Component | Licence | The clause that kills it |
|---|---|---|
| **Airbyte** — platform **and all connectors** | **Elastic Licence 2.0 since 23 Jul 2025** | *"You may not provide the software to third parties as a hosted or managed service…"* |
| **Nango** | **Elastic Licence 2.0**, whole monorepo, no OSS edition | Same clause. Cloud ToS additionally *non-sublicensable* with no customers'-customers carve-out |
| **Arize Phoenix** | **Elastic Licence 2.0** | Same clause. This is precisely our model |
| **Inngest** server | **SSPL-1.0 since 27 May 2022** | §13: offering as a service requires publishing *all* Service Source Code |
| **Windmill** | AGPL-3.0 + proprietary CE overlay | *"…not to sell, resell, serve as a managed service, modify or wrap under any form without an explicit agreement"* |
| **n8n** | Sustainable Use Licence | *"only for your own internal business purposes."* Help Center: white-labelling and charging for hosted access are **not allowed** |
| **Kestra** multi-tenancy | Apache-2.0 core; EE closed | **Multi-tenancy is Enterprise-only.** The EE code is not even in the public repo |
| **Tray.ai** | Commercial MSA | Bars *"service bureau or time-sharing"*; grant is non-sublicenseable |
| **Confluent Community Licence** | CCL v1.0 | §1.4 forbids sublicensing; §2 terminates permanently on breach |
| **SAP NW RFC SDK / JCo / NCo** | SAP proprietary | *"The redistribution of any connector is not allowed."* |
| **SAP Business Accelerator Hub** | ToU | *"solely for Your internal, non-productive and non-commercial test and evaluation purposes"* |
| **HashiCorp Vault** namespaces | BUSL 1.1 (licensor now **IBM**) | Additional Use Grant permits our use, but **namespaces — the multi-tenancy feature — are Enterprise-only** |

### Tier 4 — Commercial, and whose *published standard terms already permit our model*.

| Vendor | The permission | Price |
|---|---|---|
| **Merge.dev** | MSA §1.2(c) restricts use *"to provide services to third parties **other than Customer's customers**"* — the negative phrasing is the permission | **$650/mo** up to 10 Linked Accounts, **$65** each after |
| **Paragon** | ToS: SDK licence *"to distribute and sublicense … **to Customer's customers and end users**"* | Contact sales — no published price |
| **AWS** (Step Functions, Bedrock, CloudWatch) | Customer Agreement §12 defines End Users as those accessing *"directly or indirectly through another user"* | Pay-per-use |
| **Theobald Xtract Core** | Purpose-built white-label OEM for ISVs | Not public |

---

## How to Read These Verdicts — Licence Family Primer

Verified verbatim, 4 Aug 2026. These are the clauses the verdicts above turn on.

**Elastic Licence 2.0** — three limitations, the first fatal for us:
> "You may not provide the software to third parties as a hosted or managed service, where the service provides users with access to any substantial set of the features or functionality of the software."

Also: no circumventing licence-key functionality; no removing notices.
[elastic.co/licensing/elastic-license](https://www.elastic.co/licensing/elastic-license)

**SSPL §13** — offering the Program as a service requires releasing the **Service Source Code**: the Corresponding Source of the Program *and* of all programs used to make it available as a service — management, UI, APIs, automation, monitoring, backup, storage, hosting software — free of charge, such that a user could run their own instance.
[mongodb.com/legal/licensing/server-side-public-license](https://www.mongodb.com/legal/licensing/server-side-public-license)

**Commons Clause** — removes the right to "Sell", where Sell means providing to third parties for a fee *"including hosting"* a product whose value derives substantially from the software. Its own FAQ confirms this is **not** open source.
[commonsclause.com](https://commonsclause.com/)

**BUSL / BSL 1.1** — grants non-production use; production use only via the vendor-set **Additional Use Grant** (which may be "None"). Converts to a Change Licence on the Change Date or the 4th anniversary of the version, whichever is earlier. **The Additional Use Grant is the whole ballgame — read it per vendor.**
[mariadb.com/bsl11](https://mariadb.com/bsl11/)

**n8n Sustainable Use Licence** —
> "You may use or modify the software only for your own internal business purposes or for non-commercial or personal use."

n8n's Help Center is explicit that white-labelling n8n and charging for it, or hosting n8n and charging for access, are **not allowed**; building with n8n in a product requires a separate commercial agreement.
[github.com/n8n-io/n8n/blob/master/LICENSE.md](https://github.com/n8n-io/n8n/blob/master/LICENSE.md) · [support.n8n.io](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case)

**AGPL-3.0 §13** —
> "if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network … an opportunity to receive the Corresponding Source of your version…"

The trigger is **modification** plus remote network interaction. Unmodified use as a network service does not trigger §13 — but "modification" is broader than it looks, and the boundary between "our app" and "a modified AGPL work" is where the risk lives.
[opensource.org/license/agpl-v3](https://opensource.org/license/agpl-v3)

---

## Area 1 — ERP / Business-System Integration

Highest priority. SAP first, then NetSuite, Dynamics, Oracle, Xero, QuickBooks, Sage.

### 1.1 Comparison

| Item | Licence (verified) | SaaS + resale? | Commercial path | Health | Verdict |
|---|---|---|---|---|---|
| **Apache Camel** core | Apache-2.0; 4.21.0 (Jul 2026) | **Yes, unrestricted** | none needed | ASF, ~monthly releases, 6,277★ | **GO** |
| `camel-sap-netweaver` | Apache-2.0, not deprecated | Yes — plain HTTP + basic auth | none | thin but alive | **GO** (limited) |
| `camel-olingo4` / `olingo2` | Apache-2.0, **`deprecated: true`** since Camel 4.18 | Yes | none | **Apache Olingo retired to the Attic** | **GO but do not build on it** |
| **`camel-sap`** (RFC/IDoc) | **Not in Apache Camel** — Red Hat-only `org.fusesource:camel-sap` | **No** — non-functional without SAP JCo | Red Hat App Foundations; price *unverified* | active | **AVOID** |
| **Airbyte** monorepo (platform **and all connectors**) | **ELv2 since 23 Jul 2025** | **NO — disqualifying** | Airbyte Embedded — contact sales | 21.8k★, daily commits; platform release stalled since v2.0.0 (15 Oct 2025) | **AVOID** / GO-WITH-COMMERCIAL |
| `airbyte-python-cdk` | **MIT** | Yes | n/a | v7.23.8, 28 Jul 2026 | **GO** |
| `airbyte-protocol` | **MIT** | Yes | n/a | stable | **GO** |
| **Singer spec** repo | **No licence file** (`license: null`) | Spec reimplementable; repo text carries no grant | none | dormant, Qlik-maintained | **AVOID copying repo content** |
| `singer-python` | Apache-2.0 | Yes | n/a | commits to Feb 2026 | **GO** |
| singer-io taps (org-wide) | **AGPL-3.0 × 192**, Apache-2.0 × 7 | Yes, with §13 | none | mostly bot churn | **GO-WITH-LEGAL-REVIEW** |
| **Meltano** core | **MIT** | **Yes, unrestricted** | none | v4.2.2 (22 Jul 2026) | **GO** |
| **Meltano SDK** | **Apache-2.0** | Yes | none | v0.54.5 (16 Jun 2026) | **GO** |
| MeltanoHub connectors | **Variable — Hub declares no licence field** | case-by-case | n/a | mixed | **AUDIT EACH** |
| **Nango** | **ELv2**, whole monorepo | **NO** | Free/$50/$500 per mo; Enterprise contact sales | YC W23, ~$8M raised | **GO-WITH-COMMERCIAL-LICENCE** |
| **Merge.dev** | Closed source | **YES under published MSA** | **$650/mo + $65/Linked Account** | Series B ~$75M | **GO** |
| **Paragon** | Closed source | **YES — ToS sublicences to "Customer's customers"** | contact sales | ~$21M raised, no Series B found | **GO** |
| **Tray.ai** | Closed source | **NO under standard MSA** | Tray Embedded — contact sales | $164M raised, **last round Sep 2022** | **GO-WITH-COMMERCIAL-LICENCE** |
| **Workato** | Closed source | Via OEM programme only | **no price published anywhere** | Series E at $5.7B (2021); secondaries now ~$2.1–2.4B | **GO-WITH-COMMERCIAL-LICENCE** |
| **Debezium** | **Apache-2.0**; 3.6.0.Final GA 1 Jul 2026 | **Yes, unrestricted** | optional Red Hat build | 12,980★, **Commonhaus Foundation**, **DCO not CLA** | **GO** |
| Debezium Oracle — **LogMiner** | Apache-2.0; needs `ojdbc11` (Oracle FUTC) | Debezium yes; FUTC wording needs counsel | none stated | active | **GO** (with legal sign-off) |
| Debezium Oracle — **XStream** | Apache-2.0 connector, **requires Oracle GoldenGate licence** | Only with paid GoldenGate | GoldenGate; price *unverified* | n/a | **AVOID** |
| **Oracle Instant Client** | OTN Dev & Distribution Licence | **Doubtful** — third-party use only *"for your business operations"* | contact Oracle | n/a | **AVOID unless cleared** |
| **Debezium SAP HANA connector** | **Does not exist**, not on roadmap | n/a | n/a | n/a | **N/A** |
| SAP `kafka-connect-sap` | Apache-2.0 | licence fine | n/a | **poll-based, not CDC**; no deletes; © stops 2022 | **AVOID for reconciliation** |
| **Confluent Community Licence** components | CCL v1.0 | **Disqualifying-risk** — §1.4 bars sublicensing | Confluent subscription | n/a | **AVOID — design out** |

### 1.2 The two findings most likely to be missed

**Airbyte connectors are no longer MIT.** On **23 July 2025**, commit
`chore: migrate licenses to elv2 (#63730)` deleted `airbyte-integrations/LICENSE` —
the single MIT file that made every connector MIT — along with `airbyte-cdk/LICENSE`
and `docs/LICENSE`, and rewrote the root LICENSE to ELv2 only. Airbyte's docs now
state: *"Airbyte Connectors and everything in our public repos excluding the
airbytehq/airbyte-protocol are open sourced and available under the Elastic License
2.0."* GitHub reports the monorepo as `NOASSERTION`.
[github.com/airbytehq/airbyte LICENSE](https://raw.githubusercontent.com/airbytehq/airbyte/master/LICENSE) ·
[docs.airbyte.com/community/licenses](https://docs.airbyte.com/community/licenses)

Two caveats worth recording. First, **MIT is irrevocable** — connector code as it
stood before 23 Jul 2025 remains MIT for anyone who obtained it, so forking a
pre-July-2025 connector is a real if unattractive option. Second, Airbyte's FAQ
offers a carve-out (*"You can sell access to applications built and run using
Airbyte"*) that ReconcileAI arguably fits, since tenants never touch Airbyte's UI or
API. **That is a judgement call for counsel, not an engineering decision** — the
phrase "any substantial set of the features or functionality" is doing a great deal
of work when the product's core value is moving ERP data.

There is also an unresolved contradiction: the docs say everything except
`airbyte-protocol` is ELv2, yet `airbyte-python-cdk` is a public repo whose own
LICENSE.txt and package metadata say MIT. Flag it; do not resolve it unilaterally.

**Nango is ELv2 across the entire monorepo**, with no OSS edition — despite having by
far the best ERP connector coverage of any vendor surveyed (934 providers, including
`netsuite`, `microsoft-dynamics-365-finance-and-operations`, `sap-odata-*`,
`sage-intacct`, `xero`, `quickbooks`). A full recursive tree walk of `master` returns
exactly two licence-bearing paths, `LICENSE` and `LICENSE_SHORT` ("all rights
reserved"). The cloud route does not rescue it: ToS §3.a grants a
*"non-transferable, non-sublicensable"* right with **no carve-out for the customer's
own customers**. Two clauses deserve separate legal attention: **§11**, under which
modifications you make to the platform *"shall be licensed to Nango pursuant to the
terms of the Elastic License 2.0"*, and **§12.a**, granting Nango a
multi-tier-sublicensable licence over Customer Data.
[github.com/NangoHQ/nango master/LICENSE](https://raw.githubusercontent.com/NangoHQ/nango/master/LICENSE)

### 1.3 The unified-API vendors, ranked by whether their terms already permit us

Only Nango ships source. For the rest the question is contractual, not licensing.

**Merge.dev** has the cleanest published permission and the only legible unit
economics: **$650/mo up to 10 Linked Accounts, $65 per Linked Account after** —
roughly $65/tenant/month, modellable without a sales call. Coverage: NetSuite, Xero,
Sage Intacct, Sage Business Cloud, D365 Business Central, Oracle Fusion Cloud ERP,
QuickBooks Online, Zoho Books, Workday. **No SAP. No D365 F&O.** Per-connector
GA-vs-Beta status is *unverified* — the catalogue marks several "Beta"/"coming soon"
while their blog claims shipped support.

**Paragon** has the most explicit grant, and the asymmetry is deliberate: the **SDK**
licence is sublicensable to "Customer's customers and end users", the **Cloud
Service** licence is not — which is exactly our architecture, since end customers
reach it through our app and never directly. It is also **the only vendor here with
an SAP S/4HANA connector**, plus D365 Finance and Oracle Financials Cloud — **all
three in Beta**. Risks: no published pricing at all, and a thin balance sheet
(~$21M raised, no Series B found).

**Tray.ai** is disqualified on standard terms (service-bureau clause,
non-sublicenseable grant). **Tray Embedded** is a real white-labelled product but the
required tier is *unverified*. Coverage is weaker than Paragon's — SAP Business One
and SuccessFactors, but no S/4HANA, no F&O, no Business Central.

**Workato** has the best OEM machinery — a genuine `/oem` documentation section with
partner-facing customer-provisioning APIs and three named models (Branded Access,
Managed Service, Fully Embedded) — the broadest ERP catalogue, and **zero price
transparency**. Confirmed on both `workato.com/pricing` and
`docs.workato.com/pricing.html`, the latter stating its tiers apply *"only to direct
customers"*.

### 1.4 Debezium — clean, and structurally protected

Apache-2.0 with no SaaS clause. Relicensing risk is **materially lower** than for
Elastic/HashiCorp/Redis for two structural reasons: Debezium moved to the
**Commonhaus Foundation** (Dec 2024), so governance is not solely Red Hat's; and
contributions use a **DCO sign-off, not a CLA**, so no single entity holds the
aggregated rights needed to flip the licence. One constraint: the *Debezium name and
logo are Red Hat trademarks* — that limits partner marketing collateral, not use.

**The risk is not Debezium. It is the two ERP databases.**

*Oracle.* Debezium's docs attach an explicit licence caveat to XStream (*"To use the
XStream API, you must have a license for the GoldenGate product"*) and **none at all**
to LogMiner. That asymmetry is the evidence for LogMiner being the viable path — but
Debezium never affirmatively says LogMiner is free, so **whether a given customer's
Oracle contract permits it is unverified; get it in writing per deal.**

The "LogMiner is deprecated" claim does not survive checking: what is deprecated is
`CONTINUOUS_MINE`, an *option* of `DBMS_LOGMNR.START_LOGMNR` that Debezium does not
use. Oracle's own 23ai/26ai *Deprecated and Desupported Features* page does not list
LogMiner or `DBMS_LOGMNR`.

**Practical mitigation: LogMiner + Thin driver only.** That needs `ojdbc11` (Oracle
FUTC — *"internal business operations"*, workable but still not an explicit SaaS
grant) and **not** Instant Client (OTN D&D — *"third party use is for your business
operations only"*, which reads badly for multi-tenancy, plus a redistribution
condition that *"you do not charge your end users"*). This removes the worse licence
entirely.

*SAP HANA is a dead end.* No Debezium connector, none on the roadmap. SAP's own
`kafka-connect-sap` is Apache-2.0 but **not CDC** — `mode` supports only `bulk` and
`incrementing`, polling at 60s default, **no deletes**. For reconciliation, where a
deleted or reversed document *is* the exception, that is not fit for purpose.

Two commercial-risk items that could **not** be verified and are asserted nowhere in
this document: the **SAP HANA runtime/ASL restriction** on third-party direct DB
access, and **Oracle EBS ASFU** terms. Every source reachable was a licensing
consultancy, not the vendor. Raise both with the customer's licensing owner before
any engagement; the exposure lands on the customer and therefore on the deal.

---

## Area 1b — SAP Data Access: The Answer, Plainly

> **There is no permissive, commercially resellable open-source route to SAP data
> *via RFC*. That road is closed at every exit.**
>
> **There *is* a clean open-source route *via OData* — but "clean" applies only to
> the software licence. Permission to actually call the customer's SAP system is a
> separate contractual question that never becomes open source.**

Two layers keep getting conflated. Separating them is the whole answer:

| Layer | RFC path | OData path |
|---|---|---|
| **Software we ship** | **Blocked.** Every RFC library is a thin wrapper over SAP's proprietary NW RFC SDK, and SAP states plainly: *"The redistribution of any connector is not allowed."* | **Clean.** `pyodata` is Apache-2.0 with one BSD dependency. Or plain `requests`/`axios` — we own the code. |
| **Permission to call SAP** | Customer's contract | Customer's contract — **plus SAP API Policy §2.2.2**, which is the new landmine |

### 1b.1 Verdicts

| Item | Type | Redistribution in vendor-hosted multi-tenant SaaS? | Health | Verdict |
|---|---|---|---|---|
| **SAP NetWeaver RFC SDK** | Proprietary | **No — explicitly prohibited** | Active (7.50 PL18, 3 Dec 2025) | **AVOID** |
| **PyRFC** | Apache-2.0 wrapper only | **No** | **ARCHIVED 28 May 2026** | **AVOID** |
| **node-rfc** | Apache-2.0 wrapper only | **No** | **ARCHIVED 28 May 2026** | **AVOID** |
| **SAP JCo** | Proprietary, free of charge | **No — "Redistribution is not allowed"** | Active (3.1.13, 11 Nov 2025) | **AVOID** for SaaS |
| **OData protocol** | OASIS standard, royalty-free | n/a | Stable (4.01) | **GO** |
| **SAP Gateway** | Included in S/4HANA (`SAP_GWFND`) | n/a | Embedded, recommended | **GO** with contract check |
| **Digital Access** | Licence metric | n/a | Current (SUR v.7-2026) | **GO read-only** / GO-WITH-LICENCE on write-back |
| **SAP Business Accelerator Hub** | ToU: internal, non-productive, non-commercial | **No** — and specs are *"SAP Confidential Information"* | Live | **AVOID** for productive use |
| **SAP Integration Suite / CPI** | Paid BTP subscription | Via PartnerEdge Build Cloud only | Active | **GO-WITH-COMMERCIAL** — USD 1,728–7,688/tenant/mo |
| **SAP Datasphere** | Paid; now only via SAP Business Data Cloud | Via SAP agreement | Active | **GO-WITH-COMMERCIAL** |
| **Apache Olingo** | Apache-2.0 | Yes | **RETIRED — Attic, Jun 2026** | **AVOID** |
| **`pyodata`** | **Apache-2.0**, dep = `lxml` (BSD) | **Yes — unrestricted** | **Healthy — 1.12.0, 21 Jul 2026** | **GO** — the cleanest option found |
| **SAP Cloud SDK for JS** | Apache-2.0 **but** transitively pulls `@sap/xssec` under *"SAP DEVELOPER LICENSE AGREEMENT"* | **Ambiguous / probably no** | Very active | **AVOID for production** pending legal |
| **Plain `requests` / `axios`** | Our own code | **Yes** | n/a | **GO** — the pragmatic default |
| **Theobald Xtract Core** | Commercial white-label OEM | **Yes — purpose-built for this** | Active | **GO-WITH-COMMERCIAL-LICENCE** |
| **ODP-RFC extraction** | — | **Closed by SAP** (Note 3255746) | — | **AVOID** |
| **`pysap`** (clean-room RFC) | **GPL-2.0** | No | Security research only; **no BAPI/function-module call** | **AVOID** |

### 1b.2 The blocker, in SAP's own words

The governing text is not in a EULA PDF. It is on SAP's connectors page, retrieved
4 Aug 2026 from [support.sap.com/en/product/connectors.html](https://support.sap.com/en/product/connectors.html):

> "All SAP Connectors are licensed without additional license fees **as part of the
> respective solution or component license**. However, please note that each
> connector may be used only for connecting external (non-SAP) applications to SAP
> Systems/SAP Solutions. **Scenarios, in which two external (non-SAP) applications
> are integrated via an SAP Connector, are not allowed.**
> **The redistribution of any connector is not allowed.**
> All SAP users accessing application functionality through the relevant connector
> are required to be licensed under a respective solution or component license."

Three consequences, each fatal alone:

1. **Redistribution is prohibited outright.** Shipping SDK binaries in a container
   image we operate for tenants is redistribution.
2. **The right belongs to the customer, not to us.** A customer's SAP licence does
   not license 1CloudHub.
3. **The "two external applications" clause.** Reconciliation inherently matches SAP
   data against a *second* non-SAP source — a bank feed, a second ERP. SAP →
   ReconcileAI is fine; SAP → ReconcileAI → second non-SAP system is **arguable both
   ways**. Get it in writing.

The full **SAP Software Use Rights v.7-2026** was searched and contains **no** NW RFC
SDK or connector-redistribution terms at all. The connectors page above is the
operative text.

**PyRFC and node-rfc were both archived by SAP on 28 May 2026.** SAP's stated reason:
*"We can no longer maintain this project due to changing priorities. The latest
version is built with an older RFC SDK, which is no longer supported by SAP."* SAP
sought volunteer maintainers; nobody took it; **no replacement was named.** SAP's own
PyRFC README restated the ban: pre-built wheels *"must not be distributed with
embedded SAP NWRFC SDK binaries, only private use permitted."*

**The route that would permit RFC — and why it conflicts with our GTM.** SAP
PartnerEdge Build §2.2(c) ASP License is purpose-built for hosted delivery, but
§2.2(d) reads: *"In case of an ASP License … the Software may not be distributed by
Partner to any of its resellers or distributors."* That collides head-on with the
reseller motion — resellers can resell the *service*, not receive the *software*. Note
also that the PE Build Software Use Rights grants redistribution component by
component and explicitly carves out HANA Client Software by name; **there is no
equivalent carve-out for the NetWeaver RFC SDK, and its absence is meaningful.**

⚠️ **ICC certification does not fix this.** It is optional and
commercial-credibility only. Do not let anyone conflate "we'll get ICC certified"
with "we're allowed to ship the SDK."

### 1b.3 Digital Access — better news than expected, with sharp edges

**Reads are free, and this is contractual.** SUR v.7-2026 §4.4.2: *"All Digital Access
of ERP will be licensed based **exclusively upon the number of Documents created
annually**."* Corroborated four ways from 2018 to 2026. Named users are not required
(§4.4), and §4.4.3 extends this to users two hops away — critical for multi-tenant
SaaS.

**The clause nobody cites — SUR §2.2.1, a genuine zero-licence safe harbour:**
> "Where data is exported … pursuant to a predefined query that: a) was created by an
> individual licensed to Use the Software…; and b) **runs automatically on a
> scheduled basis**, the use of such data by Non-SAP Application(s) … **does not
> require a license hereunder** provided such use **does not result in any updates to
> or trigger any processing capabilities of any licensed Software**."

This is architecturally directive: **fixed pre-registered extractors, defined by the
customer's own licensed admin, on a schedule, strictly read-only.** ⚠️ "trigger any
processing capabilities" is the weak point — a live OData call does execute a CDS
view. Strict reading says that fails the safe harbour; purposive reading says SAP
means business-transaction processing. **Genuinely ambiguous. This is where an
auditor pushes.**

Three traps worth designing around:

1. **Measurement over-reports.** SAP's own caveat: if the same technical users serve
   both SAP and non-SAP scenarios, counts inflate. → **Use a dedicated technical user
   per tenant, used by nothing else.** Cheapest, highest-value control available.
2. **The "User Interface" clause, SUR §4.4.1(c)** — *"User Interfaces for ERP shall be
   deemed part of ERP and therefore require human users … to have a 'Named User'
   license."* An aggressive auditor could argue a product rendering SAP line items in
   its own screens lands here. That would be commercially fatal. **Position
   ReconcileAI as an analytical/exception application consuming exported data —
   never as "a nicer front end for SAP."**
3. **Write-back is a cliff, not a slope.** Post one clearing document and you create a
   Financial Document. **Architect read and write as separately toggleable tiers.**

⚠️ **DAAP (Digital Access Adoption Program) status in 2026 is unverified** — the
product page now redirects and claims it is "extended indefinitely" come only from
consultancies. **Do not put DAAP in a sales deck.**

### 1b.4 The highest-priority finding in this entire document

**SAP API Policy v.4.2026a §2.2.2**, which *"forms part of the Documentation for the
SAP solution with which it is provided"* — contractually binding, not advisory:

> "Except through and within the limits of SAP-endorsed architectures … SAP prohibits
> API use for: (a) **interaction or integration with (semi-) autonomous or generative
> AI systems that plan, select, or execute sequences of API calls**, and (b) scraping,
> harvesting, or **systematic and/or large-scale data extraction or replication**."

[help.sap.com/doc/sap-api-policy/latest/en-US/API_Policy_latest.pdf](https://help.sap.com/doc/sap-api-policy/latest/en-US/API_Policy_latest.pdf)

**ReconcileAI — an agentic layer with a conversational assistant over SAP source data
— sits squarely inside §2.2.2(a).** SAP publishes no list of what counts as
"SAP-endorsed." This clause could invalidate the product's core design for SAP
customers and **must go to SAP in writing before more engineering.**

Relatedly, the **Business Accelerator Hub ToU** (updated 8 Oct 2025) §3 limits use to
*"internal, non-productive and non-commercial test and evaluation purposes"*,
prohibits operation of *"a service bureau, outsourcing or time-sharing service"*
(§3(f)) and use of *"bots, scrapers, spiders, crawlers … agent-frameworks"* (§3(m)),
and — the trap — **§15 declares API Information to be SAP Confidential Information**
and forbids using it to create derivative works. Read literally, a client generated
from Hub OpenAPI/EDMX and shipped in a product is such a derivative. §4 says a valid
product licence governs instead, but **the two clauses are not reconciled in the
text**, and 1CloudHub does not hold the S/4HANA licence — the customer does.

### 1b.5 The `@sap/xssec` trap

SAP Cloud SDK for JS carries an Apache-2.0 badge, and its own README says:

> "This project depends on libraries licensed under the SAP Developer license
> agreement. **This limits the use of those dependencies to development purposes
> only.**"

The chain is `@sap-cloud-sdk/odata-v4` → `@sap-cloud-sdk/connectivity` →
**`@sap/xssec`**, whose npm metadata declares `"license": "SAP DEVELOPER LICENSE
AGREEMENT"`. And that licence is hostile to this product specifically — §1 forbids
applications that *"permit mass data extraction from an SAP product to a non-SAP
product"*, and §2 forbids making the APIs available to any third party.

**The Apache-2.0 badge is misleading in exactly the same way as PyRFC's.** This is
the general lesson of Area 1: *a permissive licence on a wrapper is not a permissive
licence on what it wraps.*

### 1b.6 Commercial connectors do not transfer the SAP obligation

Theobald's **Xtract Core** is purpose-built for our case — *"a fully embedded,
white-label component … Built for containerized deployment"* — and their standard
partner terms forbid our model outright, which confirms Xtract Core is the intended
vehicle. But the decisive clause is §10.5 of their published terms:

> "**solely the Customer shall be responsible for procuring the relevant licenses from
> SAP** … The Customer shall **indemnify and defend the Partner** … from and against
> any and all third-party suit, claim, action or demand…"

That is not a disclaimer — it is an **indemnity flowing away from the connector
vendor**. Connector vendors have engineered themselves out of SAP licence liability.
An OEM agreement will not reverse that; it will more likely push the indemnity onto
1CloudHub. Theobald also **does not redistribute the RFC SDK** — customers fetch
`sapnwrfc.dll` from SAP themselves. Same for Boomi's JCo connector. Even the
commercial route inherits the per-tenant SDK dependency.

### 1b.7 Recommended SAP architecture

**Path 1 — OData-first. Recommended.** `pyodata` (Apache-2.0) or plain HTTP against
customer OData endpoints. No SDK binaries, no redistribution problem, no OEM
negotiation, no per-tenant SAP-side install, no reseller conflict. Read-only
reconciliation creates zero Digital Access documents. This aligns with SAP's own
direction of travel — **SAP has drawn the line clearly: OData is the open, supported,
redistributable surface; RFC is the closed legacy one** — and with ReconcileAI's own
positioning, where a specific ERP integration is one adapter, not a prerequisite.

Design to fit SUR §2.2.1: predefined extractors, defined by the customer's licensed
admin, scheduled, strictly read-only, dedicated technical user per tenant.

**Path 2 — Theobald Xtract Core OEM.** Genuinely fits embedding and resale. Customer
still supplies the SDK; SAP licensing stays with the customer; pricing non-public;
indemnity needs careful reading.

**Path 3 — Customer-installed agent.** Each tenant runs a small connector they install
under their own SAP licence, calling home to our SaaS. **The only architecture that
keeps RFC available *and* the reseller model intact without an OEM negotiation.**
Worth a serious design look now, not after legal comes back.

**Blocked, do not architect on:** bundling the RFC SDK/JCo into hosted images;
ODP-RFC (closed by SAP Note 3255746); direct database / HANA log / SLT / DB triggers;
Hub sandbox for anything productive; SAP Cloud SDK for JS in production pending legal.

> **One caution about scope.** All of the above concerns *legal permission to
> connect*. It does not address whether customers' SAP basis teams will grant network
> access, OData authorisations, and service users to a third-party hosted SaaS. In
> practice that is often the harder blocker, and no licence purchase solves it.

---

## Area 2 — Workflow Orchestration

For multi-step, long-running, retryable agent workflows — LLM calls, human approval
steps that can wait days, retries, compensation. Not classic nightly ETL DAGs.

### 2.1 Comparison

| Tool | Licence (verified) | SaaS + resale? | Paid tier | Category | Multi-tenancy in OSS | Health | Verdict |
|---|---|---|---|---|---|---|---|
| **Temporal** | **MIT** (server, UI, all SDKs; sdk-java Apache-2.0) | **Yes, unrestricted** | Cloud, $100/mo min | **Durable execution** | **Yes — Namespaces, OSS feature** | v1.31.2, 8 Jul 2026 · 22.1k★ | **GO** |
| **Mastra** | **Apache-2.0** core; `ee/` dirs under **Mastra Enterprise License** (source-available) | Core yes; EE terms **unverified** | Platform $0/$250/custom; self-host Enterprise custom | Durable-ish + agents/evals/model routing | **Application-level responsibility** — see below | v1 Beta track; TypeScript-native | **GO (core) / GO-WITH-COMMERCIAL for EE** |
| **Trigger.dev** | **Apache-2.0** (root, since Jun 2023); SDK pkgs MIT | **Yes, unrestricted** | Cloud $10–50/mo; Enterprise custom | **Durable execution** | Orgs/projects/envs in OSS; RBAC+SSO paid | v4.5.9, 30 Jul 2026 · 15.9k★ | **GO** |
| **LangGraph** | **MIT** | **Yes, unrestricted** | LangGraph Platform — pricing *unverified* | Graph/state-machine agent runtime | Application-level | Active, LangChain-backed | **GO** (core) |
| **Vercel AI SDK** | **Apache-2.0** | **Yes, unrestricted** | n/a | **Not orchestration** — model routing + streaming | n/a | Active | **GO** for what it is |
| **Prefect** | **Apache-2.0** | **Yes, unrestricted** | Cloud, Hobby→Enterprise | Durable-ish (Python) | **No** — workspaces/RBAC/SSO Cloud-only | 3.8.1, 30 Jul 2026 · 23.5k★ | **GO** (build own isolation) |
| **AWS Step Functions** | Proprietary managed | Yes — a service we consume | Pay-per-use | Durable execution | IAM/ABAC + per-tenant state machines | AWS-operated | **BASELINE TO BEAT** |
| **Dagster** | **Apache-2.0** (core + ~50 subpackages) | **Yes** — Dagster+ EULA binds only the hosted service | Dagster+ $10–100/mo | **DAG / asset scheduling** | RBAC is Dagster+ only | 1.13.16, 30 Jul 2026 | **AVOID** (licence fine, wrong shape) |
| **Apache Airflow** | **Apache-2.0** (ASF) | **Yes, unrestricted** | none (ASF) | **DAG scheduling** | **Weak** — one deployment per tenant | 3.3.0, 6 Jul 2026 · 46.4k★ | **AVOID** for this use case |
| **Kestra** | OSS core **Apache-2.0**; EE closed, **not in repo** | OSS yes — but OSS is effectively single-tenant | **EE "Contact Sales"** | Declarative DAG + event-driven | **No — multi-tenancy is Enterprise-only** | v1.3.30, 28 Jul 2026 | **GO-WITH-COMMERCIAL-LICENCE** |
| **Windmill** | **AGPL-3.0** core + **proprietary CE overlay** | **NO** — CE forbids "sell, resell, serve as a managed service" | Enterprise from $120/mo + per-seat | Durable-ish | 3 workspaces / 50 users free cap | v1.777.1, 3 Aug 2026 | **AVOID** without signed agreement |
| **Inngest** | **SSPL-1.0** (server); **inngest-js SDK is GPL-3.0** | **NO** — SSPL §13 | Enterprise contact-sales | Durable execution | Envs/apps | v1.41.0, 3 Aug 2026 | **AVOID** |

### 2.2 Disqualified — read these first

**Inngest — SSPL-1.0. Hard no.** The LICENSE path (note: `LICENSE.md`, not `LICENSE`)
moved to SSPL-1.0 on **27 May 2022**, with a later "Future license" commit adding a
rolling grant of Apache-2.0 **effective on the third anniversary of each release**.
Old versions eventually become Apache-2.0; every current release we would deploy is
SSPL. **A second, independent problem:** the JavaScript SDK `inngest/inngest-js` is
**GPL-3.0** — a strong-copyleft library we would import directly into ReconcileAI's
own code, creating copyleft exposure on our application source regardless of the
server licence.
[github.com/inngest/inngest LICENSE.md](https://raw.githubusercontent.com/inngest/inngest/main/LICENSE.md)

**Windmill — AGPL core plus an explicit anti-resale clause.** The governing root
`LICENSE`:
> "Windmill Labs, Inc. grants a right to use all the features of the 'Community
> Edition' for free without restrictions other than the limits and quotas set in the
> software and **a right to distribute the community edition as is but not to sell,
> resell, serve as a managed service, modify or wrap under any form without an
> explicit agreement.**"

This binds the Docker images and GitHub binary releases — the only artefacts anyone
actually runs — and hits all three red lines at once. There is a narrow escape hatch
(a from-source build with the enterprise feature flag off is pure AGPL-3.0 and
legally resellable), but it forfeits every EE feature and takes on full AGPL network
copyleft for a partner-resold product. Not worth it.
[github.com/windmill-labs/windmill LICENSE](https://raw.githubusercontent.com/windmill-labs/windmill/main/LICENSE)

### 2.3 Temporal — the strongest fit by a distance

**MIT** across the whole surface, not just the server: `temporalio/temporal` MIT,
`temporalio/ui` MIT, and `sdk-go` / `sdk-typescript` / `sdk-python` / `sdk-dotnet` /
`cli` all MIT, `sdk-java` Apache-2.0. The 2023 MPL-2.0 → MIT change is still in
effect. **No restriction of any kind on hosting, multi-tenancy, or resale.** Not even
an AGPL flag to manage.
[github.com/temporalio/temporal LICENSE](https://raw.githubusercontent.com/temporalio/temporal/main/LICENSE)

- **Category: durable execution** — exactly our shape. Workflows run for years,
  Signals handle human approval waits of arbitrary length, retry policies are
  first-class, and saga/compensation is a documented first-class pattern. Activities
  must be idempotent — that is on us.
- **Multi-tenancy: Namespaces, and they are an OSS feature, not Cloud-gated.**
  Traffic from one namespace does not impact others; retention/archival configured
  per namespace. Caveat from the docs: *"A single Namespace is still multi-tenant"* —
  we must deliberately map 1 namespace : 1 tenant; it is not automatic.
- **Temporal Cloud**, if we would rather not self-host: metered on Actions (~$50/M
  descending to ~$25/M at volume) plus storage ($0.042/GB-hour active); Essentials
  $100/mo min, Business $500/mo min.
- **Unverified:** no documented ceiling on namespace count for self-hosted OSS. If we
  plan namespace-per-tenant at high tenant counts, scale-test it or ask Temporal.

### 2.4 Mastra — TypeScript-native, and the licence split is real

Mastra matters because it is TypeScript-native (matching our stack) and bundles
orchestration, evals, observability and model routing, so it could displace several
candidates at once.

**The licence split, verified.** The repo uses an explicit dual-licence model: content
under any directory named `ee/` (e.g. `packages/core/src/auth/ee/`) is
source-available under the **Mastra Enterprise License**; everything else is
**Apache-2.0**. Mastra's own docs: *"These features require a valid enterprise license
for production use but can be freely used for development and testing."*
[github.com/mastra-ai/mastra/blob/main/LICENSE.md](https://github.com/mastra-ai/mastra/blob/main/LICENSE.md) ·
[mastra.ai/docs/community/licensing](https://mastra.ai/docs/community/licensing) ·
[mastra.ai/blog/apache-license](https://mastra.ai/blog/apache-license)

**What sits behind the enterprise licence**, per the pricing page: for self-hosted,
**"RBAC, SSO, IAM, and network policy integration"**; for the managed platform, RBAC,
audit logs, SLAs, SOC 2 documentation. Pricing: Platform Starter **$0**, Teams
**$250/mo**, Enterprise custom; self-hosted framework free under Apache-2.0, with
Enterprise custom-priced on a flat annual model.
[mastra.ai/pricing](https://mastra.ai/pricing)

✅ **RESOLVED 4 Aug 2026 — the Enterprise Edition licence text was retrieved** at
`ee/LICENSE` via the GitHub contents API, and it is decisive. Verbatim, in part:

> "This software … may only be used in production if you … have entered into, and
> remain in compliance with, a written agreement with Kepler Software, Inc. …
> Subject to the foregoing, **it is forbidden to copy, merge, publish, distribute,
> sublicense, and/or sell the Software.**"
>
> "For purposes of the foregoing, **'production' means any use of the Software
> beyond development and testing on your own systems.**"

**That definition settles the BYOA question.** Deploying into a *customer's* AWS
account is not "your own systems" — it is production **and** distribution, and both
are prohibited without a written agreement. So the rule is absolute rather than
negotiable at the margin:

> **Apache-2.0 core only. No `ee/` path may enter a data plane, in either topology.**

**What is actually under `ee/`** — 160 files across six roots, enumerated from the
repository tree (`git/trees/main?recursive=1`, not truncated):

| Root | Contents |
|---|---|
| `packages/core/src/agent-builder/ee` | **The entire agent builder** — allowlist, picker, policy, normalisation. 15 of 15 files |
| `packages/_internals/auth/src/ee` | RBAC, fine-grained authorisation, licence check, EE telemetry |
| `packages/core/src/auth/ee` | Auth surface |
| `packages/editor/src/ee` · `packages/playground-ui/src/ee` · `packages/playground/src/ee` | The visual authoring surfaces |

⚠️ **The agent builder collides with v1 scope.** "Agent builder and workflow
orchestration" was put in v1 on 4 Aug; Mastra's agent-builder module is
**100 % enterprise-licensed**. It cannot be used. This is survivable only because
the architecture already builds the authoring surface on our own `Procedure` graph
— six step kinds, conditional edges, declarative by decision — and uses Mastra
solely as the *runtime* behind `C8 Agent Runtime`. Nothing changes in the design;
what changes is that the boundary is now load-bearing.

**Required guard.** A dependency check in CI that fails the build on any import
resolving into an `ee/` path. Review will not hold this line — a single
`@mastra/core/agent-builder` import ships enterprise-licensed code into forty
customer accounts, and rights "terminate automatically, without notice". Same
pattern as the plane boundary: a mechanism, not a convention.

**Repository, verified 4 Aug 2026.** `github.com/mastra-ai/mastra` · latest release
`@mastra/core@1.55.0` (31 Jul 2026) · pushed 4 Aug 2026 · ~26.9k stars. GitHub
reports the repository licence as `NOASSERTION` because of the dual-licence split,
which means **any automated licence scanner a customer runs will flag it as
unclassified** — worth pre-empting in a security review rather than explaining
afterwards.

**Multi-tenancy — the decisive question, and the answer changes the build estimate.**
Nothing found describes tenant isolation as a framework capability. The enterprise
feature list is access control for *our team* (RBAC, SSO, IAM), not isolation between
*our customers' tenants*. **Treat per-tenant isolation — workflow storage/snapshot
separation, per-tenant credentials for tools and model providers, agent memory
scoping — as an application-level responsibility we build ourselves.** Plan
accordingly; this is materially more work than Temporal's namespaces, which are a
first-class primitive.

**Maturity.** Docs show a "v1 Beta" track. Precise current stable version, release
cadence and breaking-change history are **unverified**; whether the specific APIs we
would depend on (workflows, suspend/resume, scorers) are stable or still moving is
likewise **unverified**. For a product with a multi-year support commitment to
partners, that is a real risk on top of the licence ambiguity.

**Verdict: GO for the Apache-2.0 core, GO-WITH-COMMERCIAL-LICENCE for anything in
`ee/`, and do not commit to Mastra as the orchestration backbone until (a) counsel has
read the EE licence and (b) the v1 stability question is answered.**

### 2.5 Adjacent TypeScript-first options

**LangGraph** is **MIT** — permissive, no restrictions
([LICENSE](https://github.com/langchain-ai/langgraph/blob/main/LICENSE)). It is a
graph/state-machine agent runtime rather than a durable-execution engine; persistence
and tenant isolation are the application's job. **LangGraph Platform** licensing,
pricing and whether self-hosting is Enterprise-only are **unverified**.

**Vercel AI SDK** is **Apache-2.0**
([LICENSE](https://github.com/vercel/ai/blob/main/LICENSE)). Be clear about what it
is: a **model-routing and streaming SDK**. It does not provide durable execution,
retries across process restarts, human-approval waits, or compensation. It composes
*with* an orchestrator; it does not replace one.

### 2.6 Conditional and not-recommended

**Kestra — multi-tenancy is the paywall.** This is the direct answer to the key
question: `kestra.io/pricing` lists "Multi-Tenant" under Enterprise with no checkmark
for Open Source, and the docs state tenants are *"a single physical instance of
Kestra Cloud or Kestra Enterprise Edition."* RBAC, SSO/SCIM, audit logs and
secrets-manager backends are likewise Enterprise-only. The OSS core is clean
Apache-2.0 with no Commons Clause and no added terms — and it *does* ship tenant-aware
plumbing (`TenantService.java`, a `MAIN_TENANT` constant), so the data model knows
about tenants but hard-defaults to one.

**Correction worth recording:** unlike Windmill, **there is no EE licence file in
Kestra's public repo.** Root has exactly one licence file (Apache-2.0). The EE code
is not source-available at all, so **there is no proprietary licence text to review —
terms exist only in a signed contract, and resale rights cannot be assessed from
source. They must be obtained in writing.**

**Dagster** — Apache-2.0 throughout, and the Dagster+ EULA restrictions bind only the
hosted service, so we are legally free. But it is asset/DAG-oriented with **no
run-level durable pause/resume primitive** — sensors trigger runs; they do not let an
in-flight run wait days and resume with saga semantics. Wrong tool.

**Apache Airflow** — the cleanest licence of all (ASF, no vendor, no EULA), and
deferrable operators genuinely solve cheap multi-day waits. But it remains a DAG
scheduler with no saga/compensation primitive, and **multi-tenancy is still not
solved**: AIP-67 "Multi-team deployment" explicitly states it is *not* customer
multi-tenancy — it targets non-adversarial internal teams. The honest recommendation
for untrusted third-party tenants is still **one deployment per tenant**, which is a
bad cost story for partner-resold SaaS.

**Prefect** — Apache-2.0, no gated server component, and `suspend_flow_run(timeout=None)`
is a genuine durable primitive that **tears down infrastructure while waiting**, so
multi-day approvals cost nothing to hold. (Use `suspend`, not `pause` — `pause`
defaults to a 1-hour timeout and blocks a worker.) The catch, per Prefect's own
OSS-vs-Cloud page: **workspaces, SSO/SCIM and granular permissions are Cloud-only**.
Self-hosted OSS has no tenant isolation; we would build it.

### 2.7 The baseline to beat: AWS Step Functions

Managed, no licence question, governed by the AWS Customer Agreement. Verified at
[aws.amazon.com/step-functions/pricing](https://aws.amazon.com/step-functions/pricing/)
(us-east-1):

- **Standard:** $0.000025 per state transition; free tier 4,000 transitions/month
- **Express:** $1.00 per million requests + $0.00001667/GB-second

Quotas ([limits-overview](https://docs.aws.amazon.com/step-functions/latest/dg/limits-overview.html)):

| Limit | Value |
|---|---|
| Max execution duration | **1 year** (Standard) / 5 minutes (Express) |
| Max payload | **256 KiB** per state/task/execution (workaround: S3 claim-check pointer) |
| **Max execution history** | **25,000 events** (Standard) — **the ceiling that bites first on long agent workflows** |

Human approval via `.waitForTaskToken` is natively supported and documented, waiting
up to the one-year quota (Standard only). Multi-tenancy via IAM/ABAC tag-scoped
isolation or per-tenant state machines (quota 100,000, extendable to 150,000).

**The 25,000-event history cap is what Temporal beats**, alongside code-as-workflow
ergonomics and no per-transition billing on chatty agent loops.

---

## Area 3 — Connections and Notifications

Outbound to Microsoft Teams and Slack; lookup from S3 and SharePoint; generic
REST/webhook connections and the credential-isolation problem.

> **Scope note.** MCP (Model Context Protocol) was removed from this assessment by
> the product owner on 4 Aug 2026 and is not covered here.

### 3.1 Headline findings

1. **Microsoft Graph app-only CANNOT post Teams channel messages.** The only
   Application permission for `POST /teams/{id}/channels/{id}/messages` is
   `Teamwork.Migrate.All`, and the doc states *"Application permissions are only
   supported for migration."* **This kills the obvious design.** Use a Teams bot
   (proactive messaging) or the Power Automate Workflows webhook.
   [learn.microsoft.com/graph/api/channel-post-messages](https://learn.microsoft.com/en-us/graph/api/channel-post-messages)
2. **Slack's non-Marketplace rate-limit clamp is fully in force.** Since **3 March
   2026** it applies to *existing* installations too. It hits
   `conversations.history`/`conversations.replies` (1 req/min, 15 objects) —
   **read**, not send. Outbound notification is unaffected; any future "read the
   thread" feature is effectively gated behind Marketplace listing.
3. **HashiCorp Vault's licensor is now IBM** — BUSL 1.1, Licensed Work *"Vault 1.15.0
   or later, (c) 2024 IBM Corp"*. The Additional Use Grant permits our use case, but
   **namespaces — the actual multi-tenancy feature — are Enterprise-only**.
   **OpenBao (MPL-2.0, Linux Foundation/OpenSSF) ships namespaces and the transit
   engine in the OSS build** and is the stronger choice.
4. **`Sites.Selected` is no longer the finest grain.** Microsoft now ships
   `Lists.SelectedOperations.Selected`, `ListItems.SelectedOperations.Selected` and
   `Files.SelectedOperations.Selected`.

### 3.2 App model — the decision

| | Recommendation |
|---|---|
| **Slack** | **Single distributed app + OAuth v2 per workspace.** One app, "Activate Public Distribution", installed to any workspace, per-workspace bot token stored by us. Per-tenant Slack apps do not scale and break the reseller model. |
| **Teams** | **Single multi-tenant Entra app registration (`signInAudience: AzureADMultipleOrgs`) + per-tenant admin consent**, plus — because of finding #1 — **a single multi-tenant Teams bot app package** the customer installs. |

Both models mean **we hold N tenants' credentials in one hosted control plane** — see
§3.6.

### 3.3 Slack

| Item | Verified position |
|---|---|
| **Incoming Webhooks** | Still supported, no deprecation notice. One webhook per installation, **bound to a single channel**. Cannot update or delete messages afterwards. Full Block Kit support. |
| **`chat.postMessage`** | Preferred where we need message update/delete, threading, or channel choice at send time. **For an exception-notification product that will want to update/resolve a message in place, this is the right call.** |
| **Rate limits** | Tiers 1–4 (1/min → 100+/min). **Posting: no more than 1 message per second per channel**, applying to `chat.postMessage` *and* incoming webhooks. Events API: 30,000 events per workspace per app per 60 min. |
| **The clamp** | Effective 29 May 2025 for new apps/installs of commercially distributed non-Marketplace apps; **from 3 Mar 2026 also for existing installations**. Marketplace apps unaffected; internal customer-built apps exempt. |
| **Distribution** | Public distribution needs OAuth 2.0, SSL on all OAuth/interactive/Events endpoints. **Marketplace listing is not mandatory for commercial distribution** — but it is the only way out of the clamp. |

[docs.slack.dev/distribution](https://docs.slack.dev/distribution/) ·
[rate-limits](https://docs.slack.dev/apis/web-api/rate-limits) ·
[changelog 2025-05-29](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/)

**Implication:** ship outbound notifications on an unlisted distributed app — the
clamp does not touch sending. **If the product ever reads Slack conversation
history** (plausible for a product offering conversational access to source data),
we must get into the Slack Marketplace first, and that is a review gate a reseller
cannot shortcut.

*Unverified:* Block Kit hard limits; Slack API ToS language on resale and token
storage; Marketplace review criteria in detail.

### 3.4 Microsoft Teams

| Item | Verified position |
|---|---|
| **O365 connectors / Teams Incoming Webhooks** | Retirement announced Aug 2024, repeatedly extended. URL update deadline 31 Jan 2025; migration deadline extended to 31 Mar 2026; **final retirement reported as 30 April 2026** (*this precise date comes from a Microsoft Q&A thread, not the devblogs post — treat as partially verified*). Replacement is the **Power Automate "Workflows"** app. |
| **Workflows parity** | messageCard payload support and shared/private channel posting targeted Dec 2025; private-channel selection rolling out fully by 20 Apr 2026. |
| **Graph channel message** | Delegated least-privileged: `ChannelMessage.Send`. **Application: `Teamwork.Migrate.All` only — "Application permissions are only supported for migration."** Also: *"It's a violation of the terms of use to use Microsoft Teams as a log file. Only send messages that people will read."* |

**What to use today, in order:**

1. **Teams bot (Azure Bot Service) with proactive messaging** — the only first-class,
   ISV-shaped path. Multi-tenant bot registration; customer installs our Teams app
   package; we post Adaptive Cards into channels. **This is the design to plan for.**
2. **Power Automate Workflows webhook** — works, but it is a *user-created flow in the
   customer's tenant*. **Not programmatically provisionable by an ISV**: every
   customer/channel is a manual setup step, and it likely carries a Power Automate
   licensing dependency. Acceptable as a pilot fallback; not a product.
3. **Graph app-only** — **not available.** Do not design for it.
4. **Graph delegated** — needs a signed-in user and per-tenant refresh-token
   maintenance for a background notifier. Poor fit.

The "log file" ToU clause matters directly: a reconciliation exception firehose into
Teams is exactly what Microsoft is warning against. **Batch and threshold
notifications.**

⚠️ *Unverified and material:* whether **Bot Framework SDK is deprecated or
maintenance-mode in 2026** relative to the Microsoft 365 Agents SDK. The entire Teams
design depends on it. **Verify before committing.**

### 3.5 SharePoint / Microsoft Graph, and S3

**SharePoint.** `Sites.Read.All` / `.ReadWrite.All` / `.FullControl.All` are
**tenant-wide** — a third-party SaaS asking a customer's Entra admin for these should
expect refusal. The Selected scopes are the least-privilege pattern, now four levels
deep (site collection → list → list item → file), and *"all Selected scopes now
support delegated and application modes."*

A grant needs **all three** steps: admin consents the app to the Selected scope;
someone calls `POST /sites/{siteId}/permissions` with a role; the app presents a token
carrying that scope. Roles: `read`, `write`, `owner`, `fullcontrol`.

Two gotchas to design around:
- **Granting at list/item/file level breaks permission inheritance**, and SharePoint
  has a hard limit on unique security scopes per list. **Prefer `Sites.Selected` at
  site-collection grain** unless a customer demands narrower.
- Managing permissions is itself privileged — creating a site-level grant needs
  `Sites.FullControl.All`. So **the customer's admin does the grant, not our app.**
  Onboarding is a documented admin runbook, not a self-service button.

For a background reconciliation batch with no user present, **app-only +
`Sites.Selected`** is the honest answer.
[learn.microsoft.com/graph/permissions-selected-overview](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)

*Unverified:* SharePoint/Graph throttling numbers and the **decorated-token /
User-Agent requirement for ISVs** — undecorated traffic is throttled harder, and this
will surface as mysterious 429s in production. Verify before load-testing.

**S3.** SDKs are Apache-2.0. Recommended pattern: **per-tenant cross-account IAM role
assumption with `ExternalId`** — the canonical confused-deputy mitigation for
third-party SaaS. Constraints: STS is **600 req/s per account per Region** (shared
across `AssumeRole` etc., adjustable); cross-account `AssumeRole` consumes only the
calling account's quota; role sessions default 1 h, max 12 h. **Cache assumed-role
credentials per tenant** — AWS says the same in its multi-tenant guidance. Scope
within a session using session policies or session tags (ABAC).

*Unverified:* whether S3 Access Points and S3 Access Grants help a *third-party* SaaS
— they appear designed for intra-account/intra-org delegation rather than cross-org
ISV access.

### 3.6 Credential isolation — the highest-risk area

This is where a partner-resold, vendor-hosted design carries the most risk: **one
control plane holds every tenant's Slack bot tokens, Graph refresh tokens, AWS role
ARNs, and arbitrary tenant-supplied API credentials and webhook URLs.**

**Secrets storage**

| Option | Licence / price | SaaS/resale | Verdict |
|---|---|---|---|
| **HashiCorp Vault** | **BUSL 1.1**, licensor **IBM**; Change Date 4 years → MPL-2.0 | **Permitted for our use case** (we do not compete with Vault) — but **namespaces are Enterprise-only**, pricing not published | **GO-WITH-COMMERCIAL-LICENCE** |
| **OpenBao** | **MPL-2.0**; v2.6.1, 22 Jul 2026; Linux Foundation / OpenSSF | **Yes, unrestricted** — **namespaces and transit engine in the OSS build** | **GO** ⭐ |
| **AWS Secrets Manager** | $0.40/secret/month + $0.05/10k API calls | Managed | **GO** at modest scale |
| **AWS SSM Parameter Store** | Standard free; Advanced $0.05/param/month | Managed | **GO** — ~8× cheaper, no built-in rotation |
| **Infisical** | Root MIT **except** `ee/` under `ee/LICENSE` — **which could not be retrieved** | MIT core yes; EE **unknown** | **AVOID until the `ee/` terms are read** |

Vault's Additional Use Grant, verbatim from the LICENSE file:
> "You may make production use of the Licensed Work, provided Your use does not
> include offering the Licensed Work to third parties on a hosted or embedded basis
> **in order to compete with IBM Corp's paid version(s)** of the Licensed Work."

ReconcileAI does not significantly overlap with Vault Enterprise, so the grant
permits running Vault in our stack. **But the feature we actually need — namespaces —
is paywalled**, and pricing is contact-sales only. OpenBao gives us the same primitive
under MPL-2.0 with no restriction, plus the **transit secrets engine**
(encryption-as-a-service with named keys, derivation, rotation) — precisely the
per-tenant key-separation primitive, without a per-key AWS bill.
[github.com/hashicorp/vault LICENSE](https://raw.githubusercontent.com/hashicorp/vault/main/LICENSE) ·
[github.com/openbao/openbao LICENSE](https://raw.githubusercontent.com/openbao/openbao/main/LICENSE)

**Cost arithmetic, 100 tenants × 5 connections = 500 secrets:** Secrets Manager
**$200/mo** + API calls; Parameter Store Standard **$0**; Advanced **$25/mo**. At
1,000 tenants (5,000 secrets), Secrets Manager is **$2,000/month** before API calls.
If we are not using managed rotation, that is $2k/month for nothing.

**Per-tenant encryption keys.** AWS KMS is **$1/CMK/month** (capped at $3 with two or
more rotations) + $0.03/10k requests; quota 100,000 CMKs per Region per account. Cost
crosses over well before the quota: 1,000 tenants = $1,000–3,000/mo; 10,000 tenants =
$10k–30k/mo. AWS's own guidance recommends **one CMK per tenant shared across
services** — not per tenant per service — and data-key caching via the Encryption SDK.
**Recommendation: start with envelope encryption + per-tenant data keys +
encryption context, and reserve CMK-per-tenant for tenants who contractually demand
it.** That keeps cost linear in *demanding* tenants, not all tenants.

**Token refresh and revocation.** Microsoft **Continuous Access Evaluation** gives
near-real-time revocation (latency up to 15 min for critical events) across Exchange,
SharePoint, Teams and Graph. **CAE-aware clients must handle a `401` + claims
challenge and bypass their token cache**; doing so extends token lifetime to up to 28
hours. CAE does not support guest accounts. *Unverified:* whether CAE applies to
app-only (client-credentials) tokens.

Three requirements this imposes: handle `401 + claims challenge` explicitly, not as a
generic retry; **serialise refresh per tenant** (a distributed lock or single-writer
refresh service) because two workers refreshing concurrently will invalidate each
other; and treat revocation as a **first-class tenant state** with a re-consent flow,
not a retry loop generating alerts.

**Blast radius.** Be blunt with the partner channel about this — they will ask.

| Risk | Concrete failure |
|---|---|
| **Control-plane compromise** | An attacker with our secrets store gets *every* tenant's Slack workspace, SharePoint libraries and AWS role-assumption capability at once. The highest-value target in the architecture. |
| **Cross-tenant leakage** | A missing `WHERE tenant_id = ?`; a memoised API client keyed by connection type instead of `(tenant, connection)`; a shared HTTP pool carrying a per-request `Authorization` header. Ordinary bugs, catastrophic consequences. |
| **Confused deputy** | Tenant A's request causes us to act with tenant B's credentials. **Derive the credential from the authenticated tenant context, never from a request parameter.** |
| **Secret leakage into logs** | Redact at the serialiser, not the log call site. |
| **Audit** | Every credential *use*, not just every credential *change*, needs a tenant-attributed record. Every reseller security questionnaire will ask. |

**Compliance:** SOC 2 Type II and ISO 27001 will both be asked for; data residency
will come up because the credentials themselves are the regulated artefact.
**ReconcileAI holds none of these today — do not let a partner deck imply otherwise.**

**Outbound SSRF.** Tenant-configurable webhook URLs turn our service into an SSRF
proxy inside our VPC — `http://169.254.169.254/latest/meta-data/…` being the obvious
attack. Per the OWASP SSRF Prevention Cheat Sheet: **allowlist over blocklist**
(*"Deny-lists are bypass-prone"*); **do not hand-roll IP parsing** (octal, hex,
IPv4-mapped-IPv6 encodings defeat custom parsers); disable redirect following or
validate every hop; pin DNS between check and use to close the TOCTOU window; and do
not accept complete URLs from users where a host allowlist plus path template will do.

| Control | Licence / price | Verdict |
|---|---|---|
| **IMDSv2 enforcement** | Free | **Do this first.** Not a blanket global default — set the account-level default per Region explicitly |
| **VPC egress subnet + NAT + security groups** | NAT cost only | **Cheapest effective control** — run all tenant-URL outbound calls from a subnet with no route to internal ranges |
| **Stripe Smokescreen** | **MIT** | **GO** — purpose-built egress proxy; project health *unverified* |
| **AWS Network Firewall** | $0.395/endpoint/hour + $0.065/GB (~$290/mo per endpoint) | **GO if budget allows** — heavyweight for a POC, correct for production |

**Webhook patterns:** HMAC-SHA256 over timestamp + body with a per-tenant signing
secret and replay window — **follow the Standard Webhooks spec (Apache-2.0) rather
than inventing a scheme**. Client-supplied idempotency keys so retries never
double-post. Exponential backoff with jitter, capped attempts, then **dead-letter with
tenant-visible state** — a silently dropped exception notification is worse than a
failed one. **Per-tenant rate limiting is mandatory**: one tenant's exception storm
must not consume the shared Slack/Graph budget. **Svix** (MIT throughout, including
`server/`) is a credible self-hosted option.

---

## Area 4 — Observability and LLM/Agent Evaluation

Traces of agent runs; **per-tenant cost and token accounting**; output-quality
evaluation.

### 4.1 This category consolidated hard in 2026

Three of seven candidates changed owner in eight months. **This should weigh as
heavily as licence text.**

| Date | Event |
|---|---|
| **16 Jan 2026** | **ClickHouse acquired Langfuse** ($400M Series D, $15B valuation). MIT licence and self-hosting publicly committed as unchanged |
| **3 Mar 2026** | **Mintlify acquired Helicone.** Officially **maintenance mode** — security updates, new models, bug fixes only |
| **Mar 2026** | **ServiceNow acquired Traceloop** (OpenLLMetry's maintainer). OpenLLMetry still shipping |
| **12 Jun 2026** | **OpenTelemetry moved all GenAI semantic conventions** out of the main semconv repo into `semantic-conventions-genai`, which has **zero releases and zero tags** |

### 4.2 Comparison

| Tool | Licence (verified) | SaaS / resale / embed? | Paid tier | Per-tenant cost attribution | Health | Verdict |
|---|---|---|---|---|---|---|
| **OpenTelemetry** | **Apache-2.0** | **Yes, unconditionally** | none | ⚠️ **No standard** — no tenant convention, **no `gen_ai.usage.cost`** | CNCF **Graduated 11 May 2026** | **GO** |
| **Langfuse** core | **MIT** (`ee/`, `web/src/ee/`, `worker/src/ee/` proprietary) | **Yes** — *"fork it, extend it, ship it — even in commercial products"* | Cloud $29/$199/$2,499; self-host Enterprise custom | ✅ **Best in class** — projects, tags, `userId`, sessions, metadata, custom model pricing; **Metrics API explicitly for "billing"** | v4.3.1 (3 Aug 2026); ClickHouse-owned | **GO** |
| **Arize Phoenix** | **Elastic Licence v2.0** ⛔ | **NO** | Arize AX Free/$50 Pro/Enterprise | ✅ good — **but licence blocks the use case** | v19.15.0 (3 Aug 2026), very active | **AVOID** |
| **Arize AX** (commercial) | Proprietary SaaS | Yes (as a vendor service) | Free (25k spans) / **$50/mo** Pro / Enterprise | ✅ hosted | Active | **GO-WITH-COMMERCIAL-LICENCE** |
| **Helicone** | **Apache-2.0** (main); **GPL-3.0** for `ai-gateway` | Yes on licence | Free/$79/$799/Enterprise | ✅ `Helicone-Property-*` + `Helicone-User-Id` | ⛔ **Maintenance mode since Mar 2026** | **AVOID** (health, not licence) |
| **LangSmith** | Proprietary (SDK MIT) | Yes as a service; **self-hosting Enterprise-only** | Dev $0/seat · Plus **$39/seat** · Enterprise | ⚠️ **per-seat + per-trace punishes many tenants** | Active | **GO-WITH-COMMERCIAL-LICENCE** |
| **Braintrust** | Proprietary core; **SDKs Apache-2.0**, **autoevals MIT** | Yes as a service; self-host/BYOC at Enterprise | Starter $0 · **Pro $249/mo** · Enterprise | ⚠️ orgs/projects/metadata; priced on GB + scores. **All tiers unlimited users** | **$80M Series B Feb 2026**, $800M valuation | **GO-WITH-COMMERCIAL-LICENCE** |
| **AWS CloudWatch / X-Ray / Bedrock** | AWS Customer Agreement | Yes — SaaS-on-AWS is the standard model | Pay-per-use | ✅ **Yes** — `requestMetadata` (per-request tokens) + IAM session tags (invoice dollars, daily) | GA | **GO** |
| **OpenLLMetry / Traceloop** | **Apache-2.0** | **Yes, unconditionally** | Free (50k spans) / Enterprise | ✅ association properties (`user_id`, `org_id`, `team_id`) | v0.62.1 (28 Jun 2026); **ServiceNow-owned** | **GO** (SDK) |
| **Grafana / Tempo / Loki / Mimir** | **AGPL-3.0** ⚠️ | ⚠️ **Flagged.** Free **proprietary Enterprise binary** is the intended escape hatch | Cloud Free / Pro $19/mo + usage / Enterprise **$25k/yr min** | ✅ native multi-tenancy via **`X-Scope-OrgID`**, no documented tenant cap | Active, mature | **GO-WITH-CARE** |

### 4.3 OpenTelemetry GenAI conventions — not what pre-mid-2026 guidance says

- **The conventions moved repos on 12 Jun 2026.** Core semconv v1.42.0 deprecated all
  `gen_ai.*` content and relocated it to
  [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai).
- **The new repo has no releases and no tags.** There is nothing to pin.
- **Stability: everything is `Development`.** All ~75 `gen_ai.*` attributes carry the
  `development` badge — zero stable, zero release-candidate. Per the OTel versioning
  spec, Development means *"breaking changes and performance issues MAY occur."*
- **Token usage IS standardised by name** — `gen_ai.usage.input_tokens`,
  `.output_tokens`, `.reasoning.output_tokens`, `.cache_read.input_tokens`,
  `.cache_creation.input_tokens`; metrics `gen_ai.client.token.usage` and
  `gen_ai.client.operation.duration`. All Development.
- **Agent conventions are rich** — `gen_ai.operation.name` has 18 values including
  `invoke_agent`, `execute_tool`, `plan`, `invoke_workflow`, `search_memory`. Good
  fit for ReconcileAI's agent surfaces.
- **There is NO standard cost attribute.** No `gen_ai.usage.cost`, nothing for price,
  billing, currency or spend. **Cost computation is ours to own.**
- **There is NO tenant convention.** All 89 attribute namespaces were enumerated —
  nothing for tenant, tenancy, organization, account or customer.
- **Stabilisation timeline: none.** The 2026 roadmap lists "GenAI (core set)" under
  **unconfirmed** targets, with no dates.

**Practical guidance.** Isolate `gen_ai.*` emission behind one adapter module so a
rename is a one-file change. **Never let `gen_ai.*` names into our DB columns, API
contracts, or partner-facing reports.** Use a private namespace for what matters
commercially — `reconcileai.tenant.id`, `reconcileai.partner.id`,
`reconcileai.usage.cost_usd` — applied at **span/metric scope, not Resource scope**
(Resource is per-process and wrong when one process serves many tenants). Budget
metric cardinality: tenant × partner × model × operation × token type multiplies fast.

### 4.4 Langfuse — the strongest open-source option

Root `LICENSE` is **MIT (Expat)** with an explicit carve-out: `ee/`, `web/src/ee/`
and `worker/src/ee/` are governed by the proprietary Langfuse Enterprise License.
Langfuse's own open-source strategy page states you can *"fork it, extend it, ship it
— even in commercial products,"* and *"All core Langfuse features and APIs are
available in Langfuse OSS (MIT licensed) without any limits."*

Features requiring a paid key: project-level RBAC, protected prompt labels, data
retention policies, audit logs, server-side data masking, UI customisation, Org
Management API + SCIM. **Everything we actually need — tracing, evals, prompt
management, datasets, experiments, playground — is MIT.**

⚠️ **One caveat to flag rather than paper over.** `langfuse.com/terms` now redirects
to **ClickHouse's General Terms and Conditions**, which contain (§1.3.2) a
prohibition on *"sell, resell, rent, lease, offer any time sharing arrangement,
service bureau…"* On reading, those terms govern **paid Cloud/Enterprise
entitlements**, not the MIT-licensed source — and the MIT grant is not revocable by a
service ToS we never signed. **But if we take a Self-Hosted Enterprise agreement,
that ToS binds us. Get the resale carve-out written into the order form.**

**Per-tenant attribution is the best of any option here**: projects, tags, `userId`,
sessions, metadata; custom model definitions with our own pricing; and the **Metrics
API documented explicitly for "analytics, billing, and rate-limiting."** Cloud bills
in units (traces + observations + scores) with **unlimited seats from Core up**, so
tenant count does not inflate the bill — event volume does. **Self-hosted OSS has no
usage-based billing at all**, which is the obvious answer for a resold product.

### 4.5 Phoenix, Helicone, and the AGPL question

**Arize Phoenix is still ELv2** — the LICENSE file has not been modified since it was
added in Jan 2023. The clause is verbatim the disqualifying one. Arize's docs say
only that *"self-hosting on your own infrastructure or in your cloud account is free
and fully permitted"* — true for **internal** use and carefully silent on third-party
hosting. **Embedding Phoenix in ReconcileAI and exposing its traces to reselling
partners' tenants is exactly the prohibited pattern.** Note that
`Arize-ai/openinference` (the instrumentation layer) **is Apache-2.0** and is safe to
use independently.

**Helicone's licence is clean** (Apache-2.0, no riders, no Commons Clause) and its
per-tenant attribution is good. **Avoid it on health**: Mintlify acquired it on
3 March 2026 and it is officially in maintenance mode. For a product we intend to
sell to partners for years, betting the observability layer on a maintenance-mode
project in the fastest-moving category in software is a bad trade.

**Grafana / Loki / Tempo / Mimir are all AGPL-3.0** (relicensed 20 Apr 2021, unchanged
since). Three cases, materially different:

1. **Unmodified upstream, internal ops tool, not exposed to tenants** — lowest risk.
2. **Modified and offered over a network** — **triggers the obligation.** Grafana Labs
   says so directly and sells a commercial licence for it.
3. **Embedded or iframed into the tenant-facing product UI** — **the risky middle
   ground.** If unmodified and merely reached over HTTP as a separate program, the
   conventional reading is that ReconcileAI is not a derivative work. But
   "unmodified" is doing heavy lifting — custom panels, patched auth, or theme forks
   move us into case 2. **This needs a lawyer's sign-off before it ships to a
   reselling partner, not an engineer's judgement.**

**Grafana Labs provides a clean escape hatch:** *"Users who don't intend to modify
Grafana code can simply use our Enterprise download. This is a free-to-use,
proprietary-licensed, compiled binary."* If we want to embed Grafana in a resold
product without AGPL exposure, **use the Enterprise binary.** Separately, Tempo, Loki
and Mimir all support native multi-tenancy via **`X-Scope-OrgID`** with per-tenant
runtime overrides and no documented tenant cap — the best *isolation* story of any
option here, though it does not by itself compute LLM cost.

### 4.6 AWS — the only option producing invoice-accurate per-tenant dollars

AWS Customer Agreement §6.4 restricts reselling *AWS Services*, but §12 defines End
Users as anyone accessing *"directly or indirectly through another user."* **Hosting
ReconcileAI on 1CloudHub's account and having partners resell our product is squarely
permitted** — we sell our application, not AWS services.

⚠️ **Bedrock joined the Authorized Services List for partner resale on 14 Oct 2025**,
but that announcement says *"Resale of Anthropic models subject to certain
limitations"* **without enumerating them**. Since ReconcileAI's assistants are likely
Claude-based, **get those limitations in writing from an APN Partner Development
Manager before structuring the channel.** (*Specific Anthropic Bedrock resale terms:
unverified.*)

**Four attribution mechanisms, and application inference profiles are no longer the
recommended default:**

| Mechanism | Attributes by | Grain | → Cost Explorer / CUR |
|---|---|---|---|
| **`requestMetadata`** | anything, per call | **per request** | ❌ logs only |
| **IAM principal attribution** (session tags) | identity / tenant | per usage type per day | ✅ CUR 2.0 |
| **Application inference profiles** | application / workload | per usage type per day | ✅ classic CUR + CUR 2.0 |
| **Projects** *(AWS-recommended)* | application / workload | per usage type per day | ✅ CUR 2.0 — `bedrock-mantle` endpoint only |

- **`requestMetadata` is the primary token-attribution mechanism.** Max 16 entries,
  256-char keys/values. Lands in invocation logs beside token counts; filterable in
  Logs Insights and Athena. ⚠️ It must be in the SigV4 `SignedHeaders` list, and it is
  **not enforced server-side** — so **set it in a shared gateway wrapper, never at
  call sites.** A missed tag is unbilled usage. Use opaque tenant IDs, not PII.
- **Application inference profiles** carry cost allocation tags that flow to Cost
  Explorer and both CUR versions — but the finest grain is **per usage type per day**,
  tags take up to 24 hours and are not retroactive, and AWS itself documents the
  scaling problem. **Do not build one profile per tenant.** (Per-account quota is
  **absent from official AWS quotas tables — unverified.**)
- **IAM principal attribution is the sleeper feature for our topology.** Caller
  identity is captured automatically with no call-site code and flows to CUR 2.0; AWS
  explicitly names the use case as *"LLM gateways that proxy requests on behalf of
  multiple users or tenants."* Pass tenant ID as `RoleSessionName` and as session
  tags. ⚠️ Requires a **new** CUR 2.0 export with caller identity enabled — existing
  exports do not backfill.
- ❌ **Bedrock CloudWatch metrics cannot do per-tenant attribution.** Namespace
  `AWS/Bedrock` supports **only** `ModelId` (plus image-specific dimensions). No
  tenant dimension, no custom dimensions. Custom EMF metrics with a tenant dimension
  work but are a cardinality bomb against the $0.30/metric/month ladder.

**CloudWatch GenAI Observability is GA** (preview Jul 2025 → **GA 13 Oct 2025**), with
**no additional charge** beyond the underlying telemetry. It ingests OTel GenAI
semantic conventions and works with Strands, LangChain, LangGraph, OpenInference,
OpenLLMetry, OpenLIT and Traceloop instrumentation. ⚠️ The Model Invocations dashboard
needs Bedrock invocation logging enabled; agent-trace views need CloudWatch
Transaction Search. Note that enabling Transaction Search **converts trace billing
from per-trace to per-GB span-log pricing** — usually cheaper for agents, but full
prompt/response payloads then dominate the bill. **Sample and truncate from day one.**

**Evaluation is available, including for non-AWS agents.** Bedrock Evaluations lets
you **bring your own inference responses** (*"Amazon Bedrock skips the model invoke
step and directly evaluates the data you supply"*), at $0.21 per completed human task
with algorithmic scoring free. **AgentCore Evaluations went GA 31 Mar 2026** with 13
built-in evaluators, online sampling of live traces and CI/CD regression modes, and
works on agents **not** hosted on AgentCore (LangGraph, OpenAI Agents, LlamaIndex,
Claude Agent SDK, Strands) via OTel/OpenInference instrumentation. Priced at $0.0024
per 1k input / $0.012 per 1k output tokens; requires Transaction Search.

---

## Recommended Stack

Chosen so that **every load-bearing component is permissively licensed and needs no
commercial agreement to host multi-tenant and resell through partners.**

| Area | Recommendation | Why |
|---|---|---|
| **ERP — SAP** | **OData-first**: `pyodata` (Apache-2.0) or plain HTTP against SAP Gateway / S/4HANA OData v2/v4 | The only licence-clean vendor-hosted path. No SDK redistribution, no OEM negotiation, no reseller conflict. Read-only = zero Digital Access documents |
| **ERP — databases** | **Debezium** (Apache-2.0) + **Oracle LogMiner + Thin `ojdbc11`** | Apache-2.0, Commonhaus-governed, DCO-not-CLA so structurally hard to relicense. Thin driver avoids Oracle Instant Client's OTN licence entirely |
| **ERP — custom taps** | **Meltano SDK** (Apache-2.0) | Build our own SAP OData tap and others. Avoids AGPL Singer taps and the ELv2 Airbyte estate |
| **ERP — accounting SaaS long tail** | **Merge.dev** ($650/mo + $65/Linked Account) **or Paragon** | The only two vendors whose *published standard terms* already permit our model. Merge for legible economics; Paragon if SAP S/4HANA or D365 F&O matter |
| **Orchestration** | **Temporal**, self-hosted, **namespace-per-tenant** | The only candidate that is MIT across server, UI and every SDK, *and* whose multi-tenancy primitive is fully OSS, *and* in the right category (durable execution with native saga/compensation) |
| **Orchestration — second choice** | **Trigger.dev** (Apache-2.0) | Credible lighter-weight alternative if TypeScript-native matters more than namespace isolation |
| **Notifications — Slack** | Single **distributed app**, OAuth v2 per workspace, `chat.postMessage` | Lets us update/resolve messages in place. Stay unlisted until the product needs to *read* conversation history |
| **Notifications — Teams** | Single multi-tenant Entra app + **Teams bot with proactive messaging** | Graph app-only is **not available**; the Workflows webhook is a per-customer manual step, not a product |
| **SharePoint** | App-only + **`Sites.Selected`** at site-collection grain | Avoids tenant-wide scopes and the inheritance-breaking finer grains |
| **S3** | Per-tenant **cross-account role assumption with `ExternalId`**, credentials cached, session policies for scoping | Canonical confused-deputy mitigation; caching keeps us under the 600 req/s STS ceiling |
| **Secrets** | **OpenBao** (MPL-2.0) with per-tenant namespaces | Namespaces in the OSS build; Vault paywalls exactly that feature. Envelope encryption + per-tenant data keys, promoting to dedicated CMK only for tenants who demand it |
| **Egress safety** | **IMDSv2 enforced account-wide** + dedicated egress subnet + **Smokescreen** (MIT) | Cheapest effective SSRF controls; Network Firewall when budget allows |
| **Instrumentation** | **OpenTelemetry** + **OpenLLMetry** or **OpenInference** (all Apache-2.0) | Vendor-neutral OTLP export keeps the backend decision reversible — which matters when three vendors changed owner in eight months |
| **Traces + evals** | **Langfuse self-hosted** (MIT) | The only option simultaneously permissive, purpose-built for per-tenant cost attribution, and not priced to punish tenant count |
| **Money that must be right** | **AWS**: `requestMetadata` with `tenant_id` set centrally in a Bedrock gateway wrapper; **IAM session tags** for invoice-accurate CUR 2.0 dollars | Per-prompt tokens per tenant in near-real-time is what we show partners; daily-grain invoice dollars is what we reconcile margin against |
| **Cost layer** | **Own it.** `reconcileai.tenant.id`, `reconcileai.partner.id`, `reconcileai.usage.cost_usd` | There is no `gen_ai.usage.cost` and no tenant convention in any of OTel's 89 namespaces. This is ours to define and version |

### Explicitly deferred

These are **not** recommended against — they are deliberately out of scope for the
first build, and the reasons are recorded so the decision can be revisited.

- **MCP (Model Context Protocol).** Removed from scope by the product owner on
  4 Aug 2026. Not assessed. Revisit as a separate exercise.
- **Mastra as the orchestration backbone.** Attractive (TypeScript-native, bundles
  orchestration + evals + observability + model routing) but blocked on two
  unanswered questions: the **unread Enterprise Licence text** and the **v1 Beta
  stability** question. Its Apache-2.0 core is fine to prototype with.
- **RFC / IDoc access to SAP.** Blocked at the licence layer for a vendor-hosted
  model. If a customer genuinely requires it, the shape is **customer-deployed** —
  they hold the Red Hat subscription and install their own JCo, exposing HTTP to us.
  Design work deferred until a deal requires it.
- **SAP write-back.** Read-only keeps us in the Digital Access zero-document zone.
  Architect read and write as separately toggleable tiers so this stays a commercial
  choice, not a re-architecture.
- **Airbyte under any licence.** Deferred entirely rather than relying on the FAQ
  carve-out. Revisit only via a priced Airbyte Embedded agreement.
- **Grafana in the tenant-facing UI.** Deferred pending legal. Internal ops
  dashboards on the free proprietary Enterprise binary are fine now.
- **Kestra, Windmill, n8n, Inngest, Nango, Phoenix.** Each needs a commercial
  agreement we have not sought. Revisit only if a specific capability justifies the
  negotiation.
- **Debezium against SAP HANA.** Does not exist and is not on the roadmap. Nothing to
  defer *to* — this is a dead end, recorded so nobody re-investigates.
- **A fifth charting library, per `CLAUDE.md`.** Unchanged.

---

## Open Questions / Needs Legal Review

**I am not a lawyer.** Every item below is a genuine legal judgement call for a resale
model, not a research gap that more searching would close. They are ranked by how much
they could change the product.

### Tier 1 — could invalidate a core design decision

1. **SAP API Policy §2.2.2(a).** Does an agentic reconciliation product that plans and
   executes sequences of SAP API calls violate the prohibition on *"(semi-)
   autonomous or generative AI systems that plan, select, or execute sequences of API
   calls"*? What counts as an "SAP-endorsed architecture"? **This is the single
   highest-priority question in this document.** → SAP account team, in writing.
2. **SAP API Policy §2.2.2(b) + Hub ToU §3(f).** Is a vendor-hosted, partner-resold
   multi-tenant service a *"service bureau"*? Is continuous reconciliation polling
   *"systematic and/or large-scale data extraction"*? → SAP, in writing.
3. **AWS/Anthropic Bedrock resale limitations.** The Oct 2025 partner-resale
   announcement says *"Resale of Anthropic models subject to certain limitations"*
   without enumerating them. If our assistants are Claude-based, this shapes the
   channel. → APN Partner Development Manager.

### Tier 2 — determines whether a component is usable at all

4. **The Mastra Enterprise Licence text.** Not publicly retrievable at the paths
   tried. Do its terms permit use in a vendor-hosted multi-tenant SaaS that partners
   resell? → Mastra, then counsel.
5. **Infisical's `ee/` licence terms.** Same problem — root MIT with an unread `ee/`
   carve-out. → Only if Infisical stays on the shortlist.
6. **AGPL §13 exposure for Singer taps.** Taps run as separate OS processes over
   stdout JSON, which supports a mere-aggregation argument — but §13 has thin case
   law and any patch we make is unambiguously covered. → Counsel, before shipping any
   AGPL tap.
7. **Grafana embedded in the tenant-facing UI.** Case 3 of §4.5 — the middle ground
   between "unmodified separate program" and "modified network service". → Counsel,
   or sidestep entirely with the free proprietary Enterprise binary.
8. **Oracle FUTC "internal business operations"** as applied to `ojdbc11` in a hosted
   multi-tenant service. Not an explicit SaaS grant. → Counsel.
9. **`@sap/xssec` / SAP Developer Licence §1(d)** — the prohibition on applications
   that *"permit mass data extraction from an SAP product to a non-SAP product"* is
   aimed squarely at what a reconciliation product does. → Counsel, before SAP Cloud
   SDK for JS goes near production.

### Tier 3 — commercial structure and contract terms

10. **SAP connectors "two external applications" clause** as applied to
    reconciliation, which by definition involves a second non-SAP data source. → SAP.
11. **SAP PartnerEdge: Build Integrate vs Build Cloud.** Determines the entire
    commercial model, and §2.2(d)'s ASP reseller restriction conflicts with our GTM.
    **Decide before more engineering.** → SAP.
12. **A separate SAP Development Agreement** for 1CloudHub's own dev/test/demo access
    — the PartnerEdge models grant no development licence.
13. **Hub ToU §15 vs §4.** Can we ship a client generated from Hub specs when the
    *customer*, not us, holds the S/4HANA licence? The two clauses are not reconciled
    in the text. → SAP legal.
14. **Airbyte's FAQ carve-out** (*"You can sell access to applications built and run
    using Airbyte"*) if we ever reconsider Airbyte under ELv2. Currently moot because
    Airbyte is deferred.
15. **Langfuse Self-Hosted Enterprise order form** — if we ever take one, get the
    resale carve-out written in, because `langfuse.com/terms` now redirects to
    ClickHouse T&Cs containing a service-bureau prohibition.
16. **SUR §2.2.1 "trigger any processing capabilities"** — does a live OData query
    fail the zero-licence safe harbour? Determines *licence-free* vs merely
    *zero-document*. → SAP.

### Unverified — facts to confirm before they become load-bearing

**Blocking a design decision:**
- Whether **Bot Framework SDK** is deprecated or maintenance-mode in 2026 vs the
  Microsoft 365 Agents SDK. The entire Teams design depends on it.
- **SharePoint/Graph throttling limits** and the **decorated-token / User-Agent
  requirement for ISVs** — undecorated traffic is throttled harder and this surfaces
  as mysterious 429s in production.
- **Mastra**: current stable version, release cadence, breaking-change history, and
  whether workflows / suspend-resume / scorers are stable or moving.
- **Temporal**: any ceiling on namespace count for self-hosted OSS at
  namespace-per-tenant scale.

**Pricing and commercial:**
- Airbyte Embedded/Enterprise; Nango Enterprise; Workato (no price published
  anywhere); Tray Embedded tier; Paragon Pro/Enterprise; Merge Pro/Enterprise;
  Red Hat Application Foundations; Oracle GoldenGate; Vault Enterprise;
  Matatika/Meltano commercial; Braintrust self-host tier; LangGraph Platform.

**Technical facts:**
- Bedrock **application inference profile quota** per account/region (absent from
  official AWS quotas tables).
- Whether CloudWatch's `ModelId` dimension carries an application inference profile
  ARN (implied by AWS blogs, never stated in the metrics reference).
- Whether **CAE applies to app-only (client-credentials) tokens**.
- Whether **S3 Access Points / Access Grants** help a third-party cross-org SaaS.
- Whether **Grafana AI Observability** is available self-managed or Cloud-only.
- Merge's per-connector GA vs Beta status.
- Teams O365 connector **final retirement date of 30 Apr 2026** — from a Microsoft
  Q&A thread, not the devblogs post.
- Whether `semantic-conventions-genai` has any target date for a first tagged release.

**Explicitly not asserted anywhere in this document, and not to be repeated as fact:**
- The **SAP HANA runtime/ASL restriction** on third-party direct DB access — every
  reachable source was a licensing consultancy, not SAP.
- **Oracle EBS ASFU** restrictions on external extraction tools — consultancy sources
  only.
- **DAAP (Digital Access Adoption Program) availability in 2026** — the product page
  has been retired; "extended indefinitely" claims are unsourced. **Do not put DAAP
  in a sales deck.**

---

## Method

Five parallel research streams, each verifying licence claims against primary sources
— official `LICENSE` files (preferring `raw.githubusercontent.com` over rendered
pages), official licensing and pricing pages, and vendor legal documents — rather than
blog summaries or recalled knowledge. Release dates and repository metadata were taken
from the GitHub REST API where available; one stream noted that a WebFetch of a
rendered GitHub releases page produced a fabricated date and a fabricated CVE number,
which is why the API was preferred throughout.

Licence-family texts (ELv2, SSPL §13, Commons Clause, BUSL 1.1, AGPL §13, n8n SUL)
were read directly and quoted verbatim rather than paraphrased, because the exact
wording is what the verdicts turn on.

Where a primary source was unreachable — SAP Notes behind S-user authentication,
Red Hat documentation returning 403 to automated fetches, the Mastra and Infisical
`ee/` licence files — that is stated as `unverified` rather than filled in by
inference.

# Salvage Ledger — Adjudicated

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** NO — it rules on what may be carried out of the replaced application, not on what v1 contains.
> Adjudicated 4 Aug 2026, addressing requalified 6 Aug, and not maintained since. Its verdicts stand; the application it ranks left the trunk and is at `archive/sap-line`. ⚠️ **Its §3 ranks defects by "likelihood of being hit in a live demo" — a test G48 replaced** with *what would a customer fail to get*; the ranking costs nothing because its subject is deleted, but do not reuse the test. 🛑 **One item in it is live and is not about deleted code:** the fabricated customer names in the public website repository, which `PRODUCT.md` forbids and which are one line from rendering. ⚠️ Its §6 points at `docs/design-tokens.md` as the design-system source; **G34 and G72 make `DESIGN.md` the right pointer.**
> *Banner added 8 Aug 2026.*

> **Status:** decision record. Supersedes `salvage-green-team.md` and
> `salvage-red-team.md` where they conflict. **Both left the trunk on 6 August
> 2026** and are no longer in this repository; they remain the evidence base and
> are readable in full at the annotated tag `archive/design-record` —
> `git show archive/design-record:docs/salvage-green-team.md` and
> `git show archive/design-record:docs/salvage-red-team.md`.
> **Date:** 4 Aug 2026 · **Addressing requalified:** 6 Aug 2026
> **Method:** two independent reviews with opposing mandates, then adjudication.
> Every claim below that carries a verdict was re-verified against source before
> being ruled on. Where a team was wrong, that is recorded, including where the
> brief I gave them was wrong.

---

## How to read the evidence column — 6 Aug 2026

**Every verdict in this file stands unchanged.** Only the addressing was
rewritten, on the day the artifacts this ledger rules on left the trunk. This
document is the mechanism by which salvage from an archived branch works, so a
citation that no longer resolves is not a cosmetic defect — it is the ledger
failing at its one job.

Three annotated tags, all pushed and verified on `origin`:

| Prefix in the evidence column | What it is | Read a file with |
|---|---|---|
| `archive/sap-line:src/…` | the SAP-line application — 349 files, deleted from the trunk 6 Aug | `git show archive/sap-line:src/pages/Drilldown.tsx` |
| `archive/design-record:docs/…` | the design record, including every document deleted in the same cut | `git show archive/design-record:docs/api-reference.md` |
| `origin/reconcile_public_website` | the marketing site — a live branch, never on the trunk | `git show origin/reconcile_public_website:src/constants.ts` |

Two salvage claims were **acted on** rather than archived, and their addressing
changed accordingly: the AWS findings now live in
`docs/infrastructure-risk-register.md`, and the design tokens in
`docs/design-tokens.md`. Both are on the trunk.

---

## The test

Nothing is salvageable in the abstract. Every artifact was measured against the
target state confirmed with the product owner on 4 Aug 2026:

1. **Multi-tenant, partner-resold, 1CloudHub-hosted.** Partners bring their own
   end-customers onto shared infrastructure. Requires tenant isolation,
   partner-scoped visibility, deal registration.
2. **Domain-neutral, two worked examples.** Finance and KYC both built end to
   end; credit underwriting and medical records named but not demonstrated.
3. **New AWS deployment**, stood up fresh alongside the existing one.
4. **Sales demo asset** that must survive scrutiny from a technical prospect.

A component that works correctly today but cannot express a tenant, or cannot
describe a KYC reconciliation, fails the test regardless of code quality.

---

## Verdict

**The presentation layer, the identity layer and the domain model are rebuilt.
The algorithms, the operation catalogue, the design decisions and the
documentation carry forward.**

Both teams reached the same three rebuild calls independently, by different
routes. That convergence — not either team's rhetoric — is the strongest signal
in this review.

| Layer | Verdict | Basis |
|---|---|---|
| Identity, tenancy, authorization | **Rebuild in full** | Never existed; the one field that looks like tenancy is a decoy |
| Domain / entity model | **Rebuild in full** | Never written; nothing to generalise |
| Presentation layer | **Rebuild in full** | 66 files hardcode the brand colour, 0 import the token |
| Backend operation catalogue | **Port the catalogue, discard the mechanism** | ~184 operations encode real business behaviour |
| Algorithms (grid, geometry, SOP) | **Carry forward** | Verified free of finance vocabulary and tenancy |
| Design system + documentation | **Carry forward** | The only artifacts a rebuild does not invalidate |
| Public website | **Scaffold, not content** | Right stack, wrong copy, one dead landmine |

---

## 1. Carry forward

> **The set ranked first here no longer lives on `main`.** The documentation set
> was deleted from the trunk on 6 August 2026 along with the application it
> described. That is not a reversal of the verdict — it is the verdict being
> acted on: the knowledge was extracted onto the trunk where it is still live
> (`docs/infrastructure-risk-register.md`, `docs/design-tokens.md`), and the
> source documents were archived rather than maintained. Read any of them at
> `archive/design-record`.

| # | Artifact | Evidence | Cost | Confidence | Must change |
|---|---|---|---|---|---|
| 1 | **Documentation set** (~9,650 lines) — WF1–WF42 screen registry, `event_type` inventory, 24 severity-rated findings, AWS inventory read from the control plane | `archive/design-record:docs/*` — off the trunk since 6 Aug 2026 | S | HIGH | Correct the four omitted `event_type` values and the WebSocket client count (4, not 2) |
| 2 | **Dashboard grid engine** — 973 LOC | `archive/sap-line:src/pages/dashboardGridSnap.ts` + 4 siblings | S | HIGH | Nothing structural. Grep-verified: zero finance vocabulary, zero tenancy surface, one type-only external import |
| 3 | **Bounding-box geometry + extraction model** — 382 LOC, zero imports | `archive/sap-line:src/components/DocumentProcessing/documentBoundingBoxUtils.ts`, `archive/sap-line:src/services/TextOps/DocumentTypes/documentTypesService.ts:3-78` | S | HIGH | Nothing. Worth more for KYC and medical records than it ever was for invoices |
| 4 | **SOP versioning, approval, clone-to-scope** | `archive/sap-line:src/pages/SOPVersionListing.tsx`; SOP services at `archive/sap-line:src/services/ReconcileOps/Admin/CustomSOP/` | M | HIGH (shape) | Reimplement against a real model. Clone-to-scope maps directly onto partner-template → customer-instantiation |
| 5 | **Operation catalogue** — ~184 `event_type` verbs | `archive/design-record:docs/api-reference.md` | M | HIGH | Keep the catalogue as a requirements inventory. Discard RPC-over-POST and every identity assumption in it |
| 6 | **Design tokens + brand** — 11 real tokens, wave motif, logo | Extracted to **`docs/design-tokens.md`** (on the trunk). Sources: `archive/sap-line:src/theme/`, `archive/design-record:DESIGN.md`, `archive/design-record:docs/brand-style-guide.md` | S | HIGH | Tokens are a starting palette. The wave motif is the strongest through-line between both product lines |
| 7 | **Public website as build scaffold** — Vite + Tailwind 4.2 + radix-ui/shadcn, stricter TS than the product app | `origin/reconcile_public_website` | M | HIGH | Scaffold only. See §4 — the content fails PRODUCT.md |

**On the documentation being the top salvage claim.** It is not a consolation
prize. A rebuild invalidates code; it does not invalidate the knowledge of what
47 routes did, which of ~184 operations encode real business rules, or where the
infrastructure actually is. That is the most expensive thing to reacquire and the
only thing here that survives untouched.

---

## 2. Rebuild — ranked by consequence

### 2.1 Identity, tenancy and authorization — CRITICAL

Not a retrofit. There is nothing to retrofit onto.

| Finding | Evidence | Verified |
|---|---|---|
| `tenantUserId` is a verbatim copy of `userid` | `archive/sap-line:src/hooks/useLogin.ts:46` | ✅ read the line |
| ~100 references across 31 files carry the decoy field | both teams | ✅ |
| `Authorization` appears **13×** in all of `archive/sap-line:src/` against **224** `event_type` occurrences | grep | ✅ 13 / 224 |
| The one client that sends a token reads the wrong cookie name — `accessToken` vs the `access_token` actually written | `archive/sap-line:src/services/apiCallfunctions.tsx:13` vs `src/hooks/useLogin.ts:53` | ✅ **header is always empty** |
| A static `x-api-key` compiled into the browser bundle is the only real gate | `archive/sap-line:src/services/apiCallfunctions.tsx` | ✅ |
| The app ships user impersonation as a feature: overwrites `userid`/`userlogin` from a picked user | `archive/sap-line:src/pages/ReconcileLanding.tsx:68-89` | ✅ read it |
| User types carry `password` fields; the client writes the whole user object into a cookie | `archive/sap-line:src/types/reconcileLanding.types.ts:28,35` | ✅ |
| No `partner_id`, `org_id` or `tenant_id` exists anywhere | grep | ✅ |

**Why the decoy is worse than absence.** A reviewer skimming for tenancy finds
`tenantUserId` and a comment asserting a tenancy semantic, and concludes the
plumbing exists. Re-meaning that field would have to land atomically across the
frontend and 23 Lambdas with zero tests on either side.

**Disqualifying on its own:** an endpoint returning other users' passwords over
an unauthenticated POST cannot be placed on shared multi-tenant infrastructure
under any amount of subsequent hardening.

### 2.2 Domain model — CRITICAL

There is no model to generalise, which is the whole finding.

- `archive/sap-line:src/types/` is ~617 lines — roughly 1% of the TypeScript.
- **`Invoice`, `PurchaseOrder`, `Vendor` and `MatchResult` do not exist as interfaces.** ✅ verified
- `ExceptionDetailsPayload = Record<string, unknown>`; the real shape is property access on `details: any` inside a 4,906-line component.
- The exception taxonomy is 8 finance-only substring checks, duplicated near-verbatim across `archive/sap-line:src/components/ExceptionDetailsModal.tsx` (4,906 lines) and `archive/sap-line:src/components/ExceptionMonitorModal.tsx` (4,810 lines).
- "Three-way match" is `threeway_status?: string` (`'yes'|'no'`) plus a button whose handler is a 3-second `setTimeout` (`archive/sap-line:src/components/ViewDocumentModal.tsx:309-313`).

**Consequence for the KYC decision.** Adding KYC as a second worked example is
not "extend the model" — it is *write the model that was never written*, then
build both domains onto it. That is the correct order of work, and the two
domains being structurally different (records-vs-records for finance,
documents-vs-registry for KYC) is what makes the domain-neutrality claim
demonstrable rather than asserted.

**Arity matters.** Three-way match is a fixed label, not a structure. A general
engine needs n-way matching as a first-class concept from the start.

### 2.3 Presentation layer — HIGH

| Measure | Value |
|---|---|
| Files hardcoding `#1351cd` | 66 |
| Files importing the brand token | **0** |
| `!important` declarations | 458 |
| `.ant-*` selectors inside CSS modules | 745 |
| Unscoped `:global()` rules bleeding page-wide | 128 across 6 modules |
| Global CSS-variable contract | 11 vars consumed by 63 of 78 modules (81%) |
| KPI tile implementations | 6 |
| Table implementations | 6 |
| Bar chart implementations | 4, across 4 libraries |

**I was wrong in the brief.** I told the red team antd's runtime injection order
was the portability blocker. antd v5 wraps component styles in zero-specificity
`:where()`, so overrides win regardless of order. The real blockers are the 128
unscoped `:global()` rules and the silent-failure global variable contract —
when a `var()` doesn't resolve, borders simply vanish and neither `tsc` nor
ESLint can see it. That is worse than the thing I hypothesised, because the only
verification this project has is blind to it.

### 2.4 Vendor subsystem and AP role model — HIGH

Keyed by name string in the API *and* in per-origin `localStorage`, with a
`'GLOBAL'` fallback key. Browser-local state keyed by a non-unique string is a
direct multi-tenancy blocker.

---

## 3. Demo risk — ranked

Ranked by likelihood of being hit in a live demo, not by severity.

| # | Risk | Evidence |
|---|---|---|
| 1 | **`/drilldown` is a static prototype** — 202 lines, every value hardcoded (`EXC-2025-1047`, "Acme Industrial Supplies Ltd.", "12–14 Oct 2025"), and `Escalate` / `Re-run Check` / `Approve Resolution` have **no `onClick` handlers at all** | `archive/sap-line:src/pages/Drilldown.tsx:16,49,176,184,191` |
| 2 | **Refresh updates the timestamp and no data** — `// TODO: Implement actual data refresh logic` | `archive/sap-line:src/pages/DashboardPages/SalesDashboard.tsx:36-42` |
| 3 | 5 of 6 role dashboards are fixture-backed | `archive/design-record:docs/wireframe-decisions-admin.md` |
| 4 | `/preview-dashboard` renders dashboard content with **no authentication** | `archive/sap-line:src/App.tsx:108` |
| 5 | Forgot-password sends no OTP and calls no reset API | `archive/design-record:docs/brd-summary.md` |
| 6 | Uncited McKinsey / APQC / Gartner statistics **live now** on `reconcileai.1cloudhub.com` | ✅ confirmed in served bundle |

**#1 is the one to fix first.** It is the screen the entire product thesis rests
on — `PRODUCT.md` Principle 1 says a surface showing an exception without its
explanation has lost the product's point — and its hardcoded dates read ten
months stale against an August 2026 demo.

**A landmine, not a fire:** `PARTNERS` in the website's
`origin/reconcile_public_website:src/utils/constants.ts:16-22`
contains five fabricated customer names (Dreamure, SWITCH.WIN, Glow Sphere,
PinSpace, Visionix). ✅ Verified **not rendered** and **absent from the live
bundle** — but the component exists and is one JSX line from shipping.
`PRODUCT.md` forbids named customers outright. Delete the constant, don't just
leave it unrendered.

---

## 4. The public website

The cleanest asset in the estate, and the one most likely to be over-trusted
because of it.

**Keep:** the stack (Vite, React, Tailwind 4.2, radix-ui/shadcn — stricter TS
than the product app), the component decomposition, the routing shape, the
section rhythm.

**Discard:** the copy. It fails the confirmed positioning on three counts —
it still leads with ERP/finance framing rather than general reconciliation, it
models no partner motion at all, and it carries uncited analyst statistics.

**Fix regardless of redesign:** the `BookDemo` form posts unauthenticated,
unthrottled, to `agbmqz53j0.../dev/website` — the Lambda holding a live IAM
access key and plaintext RDS credentials. Any rebuilt form must not point at
that function.

---

## 5. Where I ruled against a team

| Claim | Ruling |
|---|---|
| Red: "the fake 5-minutes-ago timestamp is the top demo risk" | **Overruled.** `archive/sap-line:src/components/DashboardComponents/DashboardHeader.tsx:61-71` computes from page load and recomputes every 60s, so it counts up correctly. Real but rank ~10. Red corrected this itself. |
| My brief: "antd injection order blocks component portability" | **Wrong, and mine.** See §2.3. |
| My brief: "48 routes, 72 components, apexcharts unused" | **Wrong on all three.** 47 routes, 100 components; apexcharts is live via dynamic import — my grep missed `import()`. |
| Green: "the documentation set is the top salvage claim" | **Upheld**, and it is not a consolation prize. See §1. |
| Green: "public website is a scaffold AND its design tokens feed the system" | **Partially upheld.** Scaffold yes; the 27 named colours are a starting point, not a system — they were never reconciled against the 66 files hardcoding `#1351cd`. |

---

## 6. Sequence implied by this ledger

Not a plan — a dependency order. The plan comes next.

1. **Model first.** Entity model expressing n-way reconciliation across finance and KYC, with tenant and partner as first-class dimensions. Everything else depends on it.
2. **Identity and tenancy.** Real tokens, server-side authorization, tenant scoping. Nothing multi-tenant can be demoed before this exists.
3. **Design system.** Primitives — one KPI tile, one table, one chart wrapper — on the website's stack, fed by the tokens in **`docs/design-tokens.md`**, which is where those values were extracted to when `DESIGN.md` left the trunk on 6 Aug 2026 (`archive/design-record:DESIGN.md`).
4. **Two worked flows.** Finance and KYC end to end, on real fixtures that survive a refresh.
5. **Landing page.** Rebuilt copy on the existing scaffold, partner motion included.

Steps 1 and 2 have no reusable starting point. Steps 3–5 do.

---

## 7. What this review did not establish

- **Backend code was not reviewed.** All 23 Lambdas are outside this repository. Every backend claim here is inferred from the client and from live infrastructure inspection.
- **Server-side authorization is unknown.** The client sends no usable token, but whether the Lambdas enforce anything independently cannot be determined from here. If they do, some findings soften; if they do not, §2.1 is worse than stated.
- **No load, cost, or latency data.** No performance baseline exists for either the current system or the target.
- **The GCP backend was not enumerated** — no credentials.

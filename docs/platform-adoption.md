# Platform Adoption — What ReconcileAI Takes from AiVolvex

> **STATUS:** DATED SNAPSHOT
> **V1 AUTHORITY:** PARTIAL — its headline decision stands; its component list is a 4 Aug reading.
> **ReconcileAI is a standalone platform, not a solution on AiVolvex's control plane.** That decision is unreversed and everything in the record still rests on it. ⚠️ **Its identity section is narrowed and does not point at the successor:** Cognito plus OIDC was adopted before federation was designed — customers and partners bring their own identity provider, and org derives from which connection authenticated the session. Read `docs/access-and-agency.md` §8–§10 before implementing any of §2. Not maintained.
> *Banner added 8 Aug 2026.*

> **Status:** decision record.
> **Date:** 4 Aug 2026
> **Decision:** ReconcileAI is a **standalone platform**, not a solution running
> on AiVolvex's control plane. It adopts proven components and patterns from
> AiVolvex to become well-rounded, but owns its own stack and lifecycle.

---

## 1. Framing

AiVolvex is **1CloudHub's own product**, not a competitor — three Amplify apps
(`AIVolvex-Studio`, `AIVolvex`, `AIVolvex-Agent-Foundry`), repositories under
`github.com/1CloudHub/`, and a Next.js frontend at `~/Projects/AIVolveX`.

That makes this an internal-transfer exercise rather than competitive analysis.
The bar is different: we can read the source, we can copy code, and anything we
adopt is already supported by people in the building.

### What we are NOT doing

ReconcileAI does not run on AiVolvex's Enterprise Agentic Control Plane. Two
reasons, and the second matters more:

1. **Product independence.** ReconcileAI must be sellable and demonstrable
   without a dependency on another platform's roadmap.
2. **The control plane is not evidenced.** The architecture diagram claims
   Identity & Tenant Management, Policy & Guardrails, Audit & Compliance and
   Billing & Cost Management as shared platform services. The repository visible
   to us is `fullstack-agentcore-solution-template-frontend` — a frontend
   template. It contains **no tenant concept** in source. Those services may
   exist in backends we cannot see, but *this project has already been burned
   once today by trusting an architecture diagram over running code*
   (`docs/salvage-ledger.md`). We adopt what we can read.

---

## 2. Adoption 1 — Authentication. **Highest value, adopt wholesale.**

This is the single most valuable thing in the AiVolvex codebase for us, because
it is precisely what ReconcileAI does worst.

### Side by side

> **Two repositories, two path namespaces — this table never said so, and the
> "What to lift" list below is the part that misleads.** The **"ReconcileAI
> today"** column describes the application deleted from the trunk on 6 Aug 2026,
> read at `archive/sap-line:src/` (349 files); its behaviour is unchanged, but
> nothing in that column resolves against a path on `main`. The **AiVolvex**
> column and every path under "What to lift" belong to a **different
> repository** — `fullstack-agentcore-solution-template-frontend`, §1 above —
> which this repository has never contained. `src/lib/auth.ts`,
> `src/components/auth/AuthProvider.tsx` and `src/hooks/useAuth.ts` have never
> existed in ReconcileAI under any branch, including `archive/sap-line`. That was
> true before the cut too; it is labelled now because the surrounding text reads
> as though both columns share one tree.

| Concern | ReconcileAI today (`archive/sap-line:src/`) | AiVolvex (separate repository) | Adopt |
|---|---|---|---|
| Identity transport | `userid` in the **request body** | `Authorization: Bearer ${idToken}` | ✅ |
| Session store | non-`httpOnly` cookie, client-writable | OIDC session via `react-oidc-context` | ✅ |
| Server-side enforcement | **none** | **API Gateway Cognito authorizer** | ✅ |
| Token on requests | reads cookie `accessToken`, app writes `access_token` → header always empty | `id_token` from the auth context | ✅ |
| Shared secret | one static `x-api-key` compiled into the bundle, shared by every tenant | per-user token | ✅ |
| Impersonation | shipped as a UI feature | not possible | ✅ |
| Config | `ENV` hardcoded constant; module throws at import | runtime `aws-exports.json` + env fallback | ✅ |

### What to lift

**All five paths below are AiVolvex paths**, in
`fullstack-agentcore-solution-template-frontend` — not this repository, and not
`archive/sap-line`. Read them there.

- AiVolvex `src/lib/auth.ts` — the `CognitoAuthConfig` type and runtime loader.
- AiVolvex `src/components/auth/AuthProvider.tsx` and `AutoSignin.tsx`.
- AiVolvex `src/hooks/useAuth.ts` — the `{ isAuthenticated, user, token }` surface.
- The service-layer convention of taking a token argument explicitly
  (AiVolvex `feedbackService.ts:47` — **another product's repository, not on this trunk and not in any archive tag here**) rather than reaching for ambient state.

### Why the runtime-config pattern matters independently

AiVolvex loads configuration from `/aws-exports.json` **at runtime**, falling
back to env vars. ReconcileAI hardcodes `const ENV = 'uat'`, resolves
`STAGE.uat` to the string `'dev'`, throws at module-eval when vars are missing,
and ships no `.env.example`. The runtime pattern fixes all four, and lets one
build artifact serve multiple environments — which the partner motion will need.

> **Non-negotiable:** the Cognito authorizer at the API Gateway is the part that
> actually matters. Bearer tokens without server-side verification are theatre.
> ReconcileAI's rebuilt API must reject unauthenticated calls **at the gateway**,
> not in the client.

---

## 3. Adoption 2 — Layered architecture

AiVolvex separates **Solutions / Control Plane / AWS Services**. ReconcileAI has
no such separation, and that absence is causally related to its defects: four
styling layers, four chart libraries, 46% of network calls bypassing the service
layer, and zero authorization could all coexist because no boundary said
otherwise.

Adopted as three enforced layers:

```
Solution layer     domain packs — finance, KYC (see §5)
                   ────────────────────────────────
Platform layer     identity · tenancy · audit · policy ·
                   usage & cost · notifications · catalog
                   ────────────────────────────────
Infrastructure     AWS: Cognito, API Gateway, Lambda,
                   RDS, S3, Bedrock
```

**The rule that gives this teeth:** the solution layer may not reach past the
platform layer to infrastructure, and the platform layer contains no finance or
KYC vocabulary. This is checkable in review and, later, by a lint rule.

---

## 4. Adoption 3 — Platform services as named capabilities

AiVolvex's Platform Services row is a good checklist for "well-rounded", and it
maps onto what `docs/domain-model.md` already models or should:

| AiVolvex service | ReconcileAI status |
|---|---|
| Identity & Tenant Management | Modelled — `Tenant`, `Partner`, `Membership` |
| Audit & Compliance | Modelled — `AuditEvent`. Currently *advertised* in the old UI with no route, surface or API |
| Billing & Cost Management | Partly real — `TokenUsage` exists and works (412 rows live). Becomes partner chargeback |
| Service Catalog | **Gap** — closed by `SolutionPack`, §5 |
| Policy & Guardrails | **Gap** — deferred, §7 |
| Notifications & Events | **Gap** — deferred, §7 |

Naming these as first-class capabilities is itself the adoption. The old product
had approval emails, token metering and an "Audit Logs" menu entry with no
implementation — the capabilities existed as scattered features rather than as a
platform layer anyone could point at.

---

## 5. Adoption 4 — COTS solutions become `SolutionPack`

AiVolvex's **"COTS Agentic Solutions — pre-built, industry and domain solutions"**
names something ReconcileAI needed and had left as an open question.

Finance, KYC, credit underwriting and medical records are not four applications
and not four demos. They are four **solution packs**: seedable bundles of
`DocumentType` + `ReconciliationDefinition` + `Sop` that a tenant installs.

This closes `docs/domain-model.md` open question #6 and does useful work in three
directions at once:

- **Product** — "ship two, name four" becomes structural rather than a demo compromise.
- **Partner motion** — a partner onboards a customer by installing a pack, not by bespoke configuration.
- **Sales** — "pre-built industry solution" is language the buyer already has.

Added to the model as `SolutionPack`. See `model/domain.ts`.

---

## 6. Adoption 5 — The customer journey as product structure

LEARN → EXPERIENCE → ADOPT → EXPAND → SCALE, each tied to a surface.

The immediately useful one is **LEARN = Sandbox Environment**, because it
reframes the demo problem. ReconcileAI's demo currently has fixture-backed
dashboards presented as if live — `docs/salvage-ledger.md` ranks that a top demo
risk, and `PRODUCT.md` forbids presenting illustrative data as results.

A **sandbox is the honest form of the same thing**. Synthetic data in a surface
explicitly labelled as a sandbox is expected, not misleading. The fixtures stop
being a liability and become the design.

**Adopt:** an explicit sandbox mode in the rebuilt demo, labelled in the UI, with
seeded pack data. **Do not adopt:** the five-stage journey as literal navigation
— that is marketing structure, not product structure.

---

## 7. Deliberately deferred

Named so they are visible, not silently dropped:

| Capability | Why deferred |
|---|---|
| Policy & Guardrails | Needs a real authorization layer underneath it first. Sequence: authN → authZ → policy. |
| Notifications & Events | The old system's email approval flows partly cover this. Rebuild after the core. |
| Third-Party Marketplace | Meaningful only once `SolutionPack` exists and there is a second author. |
| Citizen / low-code builder | Out of scope. `ReconciliationDefinition` as data is the seed if it is ever wanted. |

---

## 8. What we do NOT take

- **Next.js.** AiVolvex is Next.js; ReconcileAI's landing page is Vite + React + Tailwind 4 + radix-ui and is the salvaged scaffold. Converging on Vite keeps one stack across marketing and product. The *component conventions* transfer; the framework does not.
- **The architecture diagram as a specification.** It describes an intended platform. We adopt patterns we read in source.
- **`aws-amplify` as a client SDK.** `react-oidc-context` alone covers what we need; the Amplify client pulls a large surface we would not otherwise use.

---

## 9. Consequences for work already done

| Artifact | Change |
|---|---|
| `model/domain.ts` | `SolutionPack` added |
| `docs/domain-model.md` | Open question #6 closed; §8 gains the Cognito-authorizer constraint |
| `PRODUCT.md` | Standalone-platform decision recorded |
| `docs/salvage-ledger.md` | Unchanged — nothing here alters a salvage verdict |

The tenancy model is **not** displaced. ReconcileAI owns `Tenant`, `Partner` and
`Membership` because it is standalone. What changes is that identity moves to
Cognito + OIDC, and `Membership.role` becomes the authorization decision made
server-side behind a gateway authorizer.

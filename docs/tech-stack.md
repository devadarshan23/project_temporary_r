# Tech stack and deployment architecture — the one authority

> **STATUS:** LIVING CONTROL
> **V1 AUTHORITY:** YES — for the language, runtime, frameworks, database,
> compute, region, CI/CD, infrastructure-as-code, tagging, observability and
> image-hardening posture. It does not decide product scope, and it does not
> decide the model.
> `docs/HANDOFF.md` §3 outranks it on any decision: **every choice on this page
> is a G-row there (G71, G97–G101, G108, G177, G191, G193, G198, G211, G226 and
> G252–G263), and this page is the readable projection of those rows, not a
> second source.** If this page and a G-row disagree, the row wins and this page
> is stale — fix it here, then.
> **Written 18 Sep 2026** against `origin/main` at `791425b0`, from the product
> owner's answers of the same day. It supersedes the documents listed in §15,
> each of which now carries a banner pointing here.

> 🛑 **NOTHING IN §7–§13 IS BUILT.** This page records decisions taken on
> 18 Sep 2026 so that the infrastructure slice that follows builds one thing
> instead of guessing. The sentence `CLAUDE.md` guards — *no AWS resource has
> been created* — is **still exactly true** at the commit that adds this page,
> and G212 (no AWS SDK while that is true) **still binds**. §16 says what ends
> both, and it is a commit, not this document.

---

## 0 · Reproduce before you trust

Every claim here about the tree has a command beside it. Run the command; the
number moves and the page does not.

```bash
node -e "const p=require('./package.json');console.log(p.engines,p.dependencies,p.devDependencies)"
git ls-files | grep tsconfig                       # the TypeScript projects the gate compiles
node -e "console.log(require('./package.json').scripts.check)"   # THE gate
grep -nE '^  [a-z-]+:$' compose.yaml               # the local services this page maps to AWS
grep -nE '^FROM' Dockerfile                        # the base image and its pin
grep -nA6 'export type RegionKey' model/domain.ts  # the residency regions — us-east-1 is not one
grep -E '^\| G(25[2-9]|26[0-3]) \|' docs/HANDOFF.md | cut -c1-120   # the rulings this page projects
```

---

## 1 · Decisions at a glance

| Layer | Decision | Ruling | Built? |
|---|---|---|---|
| Language | TypeScript end to end; Node 22, pinned; every dependency pinned exact | G71, G191 | ✅ |
| Backend | Fastify, schema-first — the OpenAPI tiers are the router **and** the validator | G191 | ✅ `server/` |
| Process topology | Two planes, two processes, two databases; one image | G193 | ✅ `compose.yaml`, `Dockerfile` |
| Frontend | React + Vite + Tailwind, `design/system/tokens.css` as theme layer; dev server proxies to the plane | G198, G226 | ✅ `frontend/` |
| Database | PostgreSQL 17; `pg`; RLS denies on NULL; transaction-mode posture; branded ids are `text` | G97–G101, G177 | ✅ `db/` (local) |
| Orchestration | AWS Step Functions for the outer run | G211 | ❌ |
| **Architecture** | **ARM64 everywhere — Graviton compute, ARM CodeBuild, `linux/arm64` images** | **G252** | ❌ |
| **Compute** | **ECS on Fargate (Graviton), one service per plane, migrations as one-shot tasks** | **G253** | ❌ |
| **Database hosting** | **Aurora Serverless v2, PostgreSQL 17, one cluster per plane** | **G254** | ❌ |
| **Frontend hosting** | **S3 + CloudFront; the plane is a second origin on the same distribution** | **G255** | ❌ |
| **Region and account** | **`us-west-2` in account `000000000000`** (1CH Internal-SNG) | **G256** region · **G279** account | ❌ |
| **CI/CD** | **CodePipeline + CodeBuild on ARM, GitHub via CodeConnections; the gate stage is `npm run check` and nothing else; `main` → staging, `v*` tag → prod, same artefacts** | **G257** | ❌ |
| **Build image** | **One custom `linux/arm64` CodeBuild image in ECR carrying Node 22, PostgreSQL 17 and chromium** | **G258** | ❌ |
| **IaC** | **AWS CDK in TypeScript, in `infra/`, with its own manifest** | **G259** | ❌ |
| **Tagging** | **Six tags on every resource; a CDK Aspect fails synth without them; AWS Config `required-tags` catches the rest** — ⛔ **the Config half is DECLINED, 1 Oct 2026 (R15, G2441, the owner's): no recorder, no Config rule, by decision. The Aspect plus its tests is the whole of tag enforcement.** | **G260** | ❌ |
| **Observability** | **Logs, metrics, alarms and X-Ray from day one, all declared in CDK; a log line carries ids, codes, counts and durations only** | **G261** | ❌ |
| **Hardening** | **Minimal non-root arm64 runtime image, read-only filesystem, ECR scan-on-push failing the pipeline, images signed and verified** | **G262** | ❌ |
| **Secrets and identity** | **Secrets Manager with rotation, one IAM task role per plane, no static keys anywhere** | **G263** | ❌ |

**The ❌ column is the honest part of the table.** Everything above the bold
rows is in the tree; everything in bold is a decision awaiting the `infra/`
slice (§16).

---

## 2 · Language and runtime

- **TypeScript end to end** (G71). The backend consumes `model/` directly; the
  frontend shares the same types. There is no second language runtime in any
  image — G137 refused PyMuPDF on exactly that ground.
- **Node 22**, pinned by `engines.node` in `package.json` and by the `FROM` line
  in `Dockerfile`. Node strips TypeScript types natively, so **there is no build
  step for the backend** — the container runs the reviewed source. The frontend
  is the one thing that is built (`build:frontend`: a Vite bundle plus an SSR
  prerender).
- **Every dependency is pinned exact** (G191). `npm ci --omit=dev` must produce
  a container holding the runtime packages and no compiler; the `Dockerfile`
  header states which packages survive it. Derive the current manifest with the
  first command in §0 rather than reading a list here.
- **Four TypeScript projects**, none `extends` another — `model/`, `server/`,
  `frontend/`, `tests/` — all under `strict`, `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax`.
  `infra/` will be the fifth, on the same options (§10).

---

## 3 · Backend — Fastify, driven by the contracts

Kept on 18 Sep 2026 with the choice explicitly reopened and closed: the owner
has no framework preference, G191 already chose, and it is built.

- The OpenAPI tiers under `docs/contracts/` **are** the router and the
  validator. `server/contract/document.ts` is the only place a contract is read;
  `server/contract/routes.ts` derives the route table from `paths` × methods;
  `mountTier()` refuses to boot if a handler names an operation the document
  does not declare. Nothing in `server/` writes a URL.
- AJV **rejects** rather than strips (`removeAdditional: false`) — an
  unexpected `tenantId` in a query string is a 400, not a silently served
  request. Invariant 1 held visibly.
- Authentication runs in `onRequest`, before validation. Whether a route is
  secured comes from the document, never from a list in code.
- **Two planes, two processes** (G193): `server/control-plane/` and
  `server/data-plane/`, one image, the command decides which. The control
  plane's config reads only `RECONCILE_CONTROL_*` and imports neither
  `db/env.ts` nor `db/tenant-scope.ts` — invariant 3 by construction.
- The migrate entry points (`server/*/migrate-main.ts`) are **one-shot** and
  hold the `BYPASSRLS` role; the listeners never do. §7 keeps that shape in
  AWS.

---

## 4 · Frontend — React + Vite + Tailwind

- G198: `frontend/` is React + Vite + TypeScript, Tailwind consuming
  `design/system/tokens.css` through `frontend/src/bridge.css` — the kernel
  is still the only place a token is declared.
- G226: the Vite dev server **proxies** to the plane. No CORS, no preflight.
  §8 preserves that in production by putting the API behind the same
  CloudFront distribution as the static bundle.
- `build:frontend` runs inside `npm run check`, so a frontend that does not
  build is a red gate, not a red deploy.

---

## 5 · Database — PostgreSQL 17, `pg`, RLS that denies on NULL

Unchanged from G97–G101 and G177; restated because the hosting decision in §7
must not be read as reopening any of it.

- **PostgreSQL 17, pinned** (G177). ⚠️ **Standing verification, still not
  done:** G177 says in its own row that no Aurora Serverless v2 engine-version
  was fetched. **G254 makes that verification a precondition of the `infra/`
  slice, not a thing it may assume** — the slice's first commit records the
  engine version string it targets and the AWS page it came from.
- **`pg`, pinned exact** (G98); it exposes the backend PID, which is what lets
  the two-tenant leak test assert both reads ran on the same pooled connection.
- **RLS denies on NULL** (G100), written as the predicate in
  `db/migrations/0001_tenancy_and_rls.sql`; a forgotten transaction yields an
  empty set, never a cross-tenant row. Migrations run as a separate
  `BYPASSRLS` role, never the owner.
- **Transaction-mode posture from day one** (G101): every query sits inside
  `withTenantScope()`, which issues `BEGIN` and a **bound** `set_config`. That
  posture is correct under both pooling modes, so Aurora's proxying options are
  a later decision that cannot invalidate it.
- **Every branded id is `text`** (G97). No `uuid` anywhere.
- **Drizzle** (G99) is ruled and **not used** — `db/tenant-scope.ts` uses `pg`
  directly. Nothing has revisited G99; this page does not either. Read the seam,
  not the ruling, before writing a query.
- **Two databases** (G193), and the split is by plane locally and **by residency
  region** in the hosted shape (G185): a tenant's data-plane cluster lives in
  the tenant's `RegionKey` region. Phase one has one region (§8) so the two
  statements coincide.

---

## 6 · Architecture — ARM64 everywhere (G252)

**Every compute resource this product runs on is 64-bit ARM: Graviton for
Fargate and Aurora, `ARM_CONTAINER` for CodeBuild, `linux/arm64` for every
image.** The ground is price-performance — Graviton Fargate is priced roughly a
fifth below x86 for the same vCPU-second, and the workload (Node, Postgres,
chromium in CI) has first-class arm64 builds.

What it costs, stated so nobody rediscovers it:

- **`Dockerfile` must declare the platform.** Today's `FROM node:22.20.0-alpine`
  resolves to the builder's architecture; the `infra/` slice pins
  `--platform=linux/arm64` and the image **digest**, so a build on a developer's
  x86 laptop and a build in CodeBuild produce the same bytes or fail loudly.
- **Every native dependency must have an arm64 build.** The runtime manifest
  today has none that compile (`pg` is pure JS; `pg-native` is not taken). The
  CI image adds PostgreSQL 17 and chromium, both of which ship arm64 packages.
  ⚠️ **Chromium on Amazon Linux 2023 arm64 is the one unproven piece** and §9
  says how it is proven before the pipeline depends on it.
- **The local stack stays honest.** `compose.yaml` runs whatever the developer's
  machine is; Apple-silicon machines are arm64 already. An x86 developer runs
  the image under emulation, which is slow and correct.

**Rejected:** x86 with an ARM migration "later". Refused because an
architecture migration after the first customer is a migration of a running
tenant, and a pinned architecture before the first resource is free.

---

## 7 · Compute and topology — ECS on Fargate, Graviton (G253)

`compose.yaml` is the specification. Each of its services maps to exactly one
AWS resource, and the mapping is the whole of the compute decision:

| `compose.yaml` service | AWS | Notes |
|---|---|---|
| `data-plane` | ECS service on Fargate, `ARM64`, behind an internal ALB | Task role: data-plane only. Never holds `BYPASSRLS` credentials |
| `control-plane` | ECS service on Fargate, `ARM64`, behind the same ALB on a separate listener rule | Task role: control-plane only. No route to the data-plane cluster's security group |
| `data-plane-migrate` | ECS **run-task**, invoked by the pipeline before the service deploys; exits | The only task that holds the migrator secret |
| `control-plane-migrate` | ECS run-task, same shape, against the control cluster | |
| `data-plane-db` | Aurora Serverless v2 cluster (§5) | Own subnet group and security group |
| `control-plane-db` | Aurora Serverless v2 cluster | Own subnet group and security group |
| `data-net` / `control-net` | Two security-group pairs; **no rule** admits control-plane tasks to the data cluster | G193's "topology, not review", in AWS terms |

- **One cluster, one VPC, per environment.** Two environments in phase one —
  `staging` and `prod` — are two CDK stacks with different parameters, not two
  codebases (§9).
- **The outer run is Step Functions** (G211); its map states invoke the data
  plane over the internal ALB. G171's one-attempt map configuration is carried
  into the state-machine definition unchanged.
- **The serving process does not hold the credentials that void its own
  fence.** The migrate run-tasks are the only tasks granted the migrator
  secret; the services are granted the app-role secret and nothing else. That
  is the property `server/*/migrate-main.ts` was split out to hold, and the IAM
  shape is what keeps it from being an intention.

**Rejected:** EC2 + ECS on Graviton (cheaper at steady load, but the AMI,
patching and scaling become ours before there is load to justify it); Lambda
arm64 (Fastify plus `pg` pooling and G101's explicit-transaction posture fit a
long-lived process, and a reconciliation run may outlive fifteen minutes); App
Runner (no ARM).

---

## 8 · Region and account (G256)

- **`us-west-2`**, account **`000000000000`** (1CH Internal-SNG).
  🛑 **THIS SAID `000000000000` UNTIL 18 Sep 2026 AND IT IS CORRECTED RATHER
  THAN OVERWRITTEN, BECAUSE THE WAY IT WAS WRONG IS WORTH KEEPING.** G256 named
  that account because it is what `aws sts get-caller-identity` returned from
  the CLI's `default` profile — **a fact about a shell, written into §3 as a
  decision.** Nobody asked the owner. It surfaced only when the owner went to
  complete the CodeConnections handshake and the connection was not in the
  account their browser was signed into. **Nothing caught it** — not synth, not
  the gate, not the tag Aspect — because an account id is a well-formed string
  whichever account it names. **G279** moves it, on the ground that
  `000000000000` is reached by FEDERATED identity where the old one is reached
  by a static IAM user key, which is G263 applied to the account.
- `us-east-1` was asked for and **refused on one ground**: it is not a member of
  `model/domain.ts#RegionKey`, and a tenant may not be placed in a region the
  residency vocabulary cannot name. `us-west-2` is a member and is priced
  identically for Fargate, Aurora and S3. The alternative — amending
  `RegionKey` — was refused because a residency vocabulary should change for a
  residency reason, not a hosting one.
- **The account is shared** with unrelated work (`changi_*` CodeBuild projects,
  Bedrock AgentCore builders) and `docs/infrastructure-risk-register.md` records
  live findings in it (K1, K6). The owner accepted that for phase one. What
  fences the product inside it: every resource is created by CDK, tagged
  `Project=reconcile` (§11), and the pipeline role can deploy only stacks with
  that tag. **A dedicated account for `prod` is the expected follow-on and is
  not ruled**; it is listed in §14.
- BI stays in `ap-southeast-2` under G82 — that is a Quick Suite constraint,
  already ruled, and this page changes nothing about it.

---

## 9 · CI/CD — CodePipeline and CodeBuild on ARM (G257, G258)

### 9.1 The shape

```
GitHub (1CloudHub/Reconcile)
   │  CodeConnections
   ├─ pull_request ──► CodeBuild ARM · `npm ci && npm run check` · status → GitHub
   │
   ├─ push main ─────► CodePipeline "reconcile-staging"
   │                    1  Source        (CodeConnections)
   │                    2  Gate          CodeBuild ARM · `npm ci && npm run check`
   │                    3  Build         CodeBuild ARM · docker build --platform linux/arm64
   │                                     · push to ECR by DIGEST · sign · `vite build` → S3 staging artefact
   │                    4  Migrate       ECS run-task ×2 (control, data) · waits for exit 0
   │                    5  Deploy        `cdk deploy` staging: ECS services by image digest,
   │                                     S3 sync + CloudFront invalidation
   │
   └─ tag v* ────────► CodePipeline "reconcile-prod"
                        1  Source        the tag
                        2  Promote       NO REBUILD — resolves the staging image digest and
                                         frontend artefact already built for that commit
                        3  Migrate       ECS run-task ×2 against prod
                        4  Deploy        `cdk deploy` prod
```

### 9.2 What G108 means here, and it is not amended

**G108 stands: the gate is `npm run check` and CI runs it and nothing else.**
Stage 2 of every pipeline and the pull-request build are that command,
verbatim, and nothing else may be added to them. The build, migrate and deploy
stages are **separate pipeline stages** that run *after* a green gate and are
never a step *inside* it — the same distinction `.github/workflows/check.yml`
draws when it says *"DO NOT ADD A STEP HERE"*. `tests/ci/gate.test.ts` keeps
enforcing the workflow's shape until the workflow is retired (§16).

### 9.3 The gate runs where it can execute every assertion

`docs/runner-image-provisioning.md` ruled *"the fix is the image, not the
workflow"* and §9.4 honours it: the CodeBuild image carries PostgreSQL 17 and
chromium, so `databaseRequiredUnderCi()` and `browserRequiredUnderCi()` in
`tests/reachability.ts` **fail** rather than skip when either is absent, and the
`skip-census` reporter prints the real skipped-assertion count at the end of
the gate output. **A green stage 2 is a green gate with every dependency
reachable, which the self-hosted runner never guaranteed** — PR #257 merged
a red trunk through that gap.

### 9.4 The build image (G258)

One `Dockerfile` under `infra/ci-image/`, built by a CodeBuild project on
`ARM_CONTAINER`, pushed to ECR by digest, and used by **every** CodeBuild
project in §9.1:

- base: Amazon Linux 2023 arm64 (the standard image's base, so CodeBuild's
  own agent requirements are met);
- Node 22 at the exact version `engines.node` names;
- PostgreSQL 17 server and client, started by the buildspec on `127.0.0.1`;
- chromium — ⚠️ **verified RED first**: the image is not pointed at the
  pipeline until `tests/ci/reachability-guards.test.ts` has been observed to
  fail inside it with chromium removed and pass with it present. That is the
  same condition G108 attached to every checker, applied to a machine.

**Rejected:** the standard `aws/codebuild/amazonlinux-aarch64-standard` image
with `docker run postgres` per build — no image to maintain, but chromium on
AL2023 arm64 would be installed at build time on every run, which is the
"per-build install" shape the runner ruling refused.

### 9.5 Branches and environments

| Event | Environment | Artefacts |
|---|---|---|
| pull request | none — gate only | none |
| push to `main` | **staging** | built once, by digest |
| tag `v<major>.<minor>.<patch>` on a commit already on `main` | **prod** | **the staging artefacts for that commit — no rebuild** |

- `main` stays the trunk. Nothing about branch naming changes.
- Promotion by tag was chosen over `release/*` branches because a tag names a
  commit and a branch names a moving line; "what is in prod" must be a hash.
- A prod pipeline that cannot find staging artefacts for the tagged commit
  **fails**; it does not build. That is the whole guarantee that prod runs
  bytes staging ran.

### 9.6 What retires

✅ **DONE, 18 Sep 2026.** `.github/workflows/check.yml` is deleted and the
`[self-hosted, reconcile]` runner is retired. The condition this section set —
*"in the commit that lands the pipeline and observes a green build from it"* —
was met and is recorded rather than asserted: `reconcile-gate-staging` ran the
branch on the ARM CI image under `CI=true` and returned **`tests 1857, pass
1855, fail 0, skipped 0, todo 2`**, with *"no suite stood down on this run."*
🛑 **AND THE WORKFLOW HAD ALREADY STOPPED BEING A GATE**, which this section did
not anticipate: zero runners were registered against its `runs-on` label, so
every push queued a job that never started. Its three G108 assertions moved to
`tests/infra/pipeline.test.mjs` rather than lapsing, and
`tests/ci/gate.test.ts` now asserts the workflow's **absence** plus the
existence of its successors. `docs/runner-image-provisioning.md`
governs the self-hosted host until that day and is banner-marked accordingly.
G239's runner-token defect closes by construction: there is no self-hosted
runner to register.

**Rejected:** GitHub Actions on CodeBuild-hosted ARM runners (two systems for
one pipeline); GitHub Actions with OIDC for everything (amends G108's "one
system" reading and keeps the runner-registration surface G239 records).

---

## 10 · Infrastructure as code — CDK in TypeScript (G259)

- `infra/` is a CDK app in TypeScript, the same compiler options as the other
  four projects, **with its own `package.json`** so that `aws-cdk-lib` and
  `constructs` never enter the root manifest — `npm ci --omit=dev` at the root
  keeps producing a container with the driver and no compiler, and the
  `Dockerfile` header's claim stays true.
- Stacks: `Network`, `Data` (the two Aurora clusters), `Planes` (cluster, ALB,
  two services, two run-task definitions), **`Storage`** (G287 — one object
  bucket per data plane, SSE-KMS, per-tenant key), `Edge` (S3, CloudFront,
  certificate — G183's one wildcard per region), `Pipeline`, `CiImage`,
  `Observability`.
  Two environments are two instantiations with a parameter, not two apps.
  > ⚠️ **`Storage` WAS ADDED TO THIS LIST ON 19 Sep 2026 AND IT IS AN ADDITION,
  > NOT A CORRECTION.** G287 was taken after this page was written, and §7–§13
  > name **no object storage on the data-plane path at all** — which is the
  > premise G287's own row opens with. 🛑 **DO NOT READ `Storage` AS A SECOND
  > `Edge`.** `Edge`'s bucket holds the frontend BUNDLE and is served to the
  > internet through CloudFront; `Storage`'s holds tenant payloads, blocks all
  > public access and is reachable by one IAM role. G277 blocks `Edge`; it never
  > blocked this. Derive the list, do not read it:
  > `ls infra/lib/*-stack.ts | wc -l` → 8.
  >
  > 🛑 **THAT DERIVATION SAID 10 UNTIL 22 Sep 2026 AND IT WAS ALREADY ONE
  > BEHIND BEFORE `Amplify` TOUCHED THE DIRECTORY: `RunQueue` LANDED ON
  > 20 Sep 2026 (R-B) AND THIS PAGE MOVED FOR NEITHER.** So the number is
  > **12**, the eleventh is `RunQueue` and the twelfth is **`Amplify` — S5,
  > 22 Sep 2026, the owner's ruling: the PUBLIC MARKETING PLANE at the apex
  > `reconcileai.app`**, honouring `docs/build/deploy-handoff.md` §5.4,
  > *"a different tool for a different job."* **The 11 was not this slice's to
  > make stale** and is named so this sweep is not read as accounting for
  > both. Run the command: `ls infra/lib/*-stack.ts | wc -l` → **12**.
  > ⚠️ **`Amplify` IS NOT A THIRD `Edge` AND MUST NOT BE READ AS ONE.** The
  > apex is on NEITHER edge certificate and NEITHER distribution — a wildcard
  > matches exactly one label, so `*.reconcileai.app` never covered it — and
  > Amplify issues a **third certificate** for that one name. It is a MANUAL
  > DEPLOY app: no repository and no token, because `AWS::Amplify::App` has no
  > CodeConnections property and AWS authorises a repository with a **personal
  > access token**, which G263 forbids — and because the marketing site is in
  > no repository yet. 🛑 **AND THE APEX A RECORD IS NOT IN ITS TEMPLATE
  > BECAUSE IT CANNOT BE**: `AWS::Amplify::Domain` publishes no distribution
  > domain and no hosted-zone id, so no ALIAS in this app can point at it;
  > Amplify writes the records into `Z04053259WLMQJTR30EU` itself, and a
  > second writer of one record name is the G297 race, measured.
  > ⚠️ **AND `PLANES` GAINS A SIXTH MEMBER, `public`** — §11's tag vocabulary
  > moves, for the reason the two `shared` values moved it before: `edge` and
  > `shared` would each be a FALSE statement in the one field §11 says
  > invariant 3 is audited from.
  >
  > 🛑 **THAT DERIVATION SAID 8 UNTIL 19 Sep 2026 AND 9 UNTIL 20 Sep 2026. IT
  > IS 10, AND `Observability` — THE LAST NAME IN THIS LIST THAT HAD NEVER
  > BEEN A FILE — IS WRITTEN (G1061).** One SNS topic, eight alarms, four
  > EventBridge rules and VPC flow logs. Run the command; and run
  > `grep -rln 'Alarm' infra/lib/`, which returned **nothing** until that
  > commit while this page had listed the stack for two days.
  > ⚠️ **THE TOPIC HAS NO SUBSCRIPTION AND THEREFORE PAGES NOBODY** — §14
  > carries `Owner` as a placeholder and this is the same ruling wearing a
  > second hat (G1062). ⚠️ **AND IT ADDS NO OUTPUT TO `Planes`**: a new
  > cross-stack export there is a `Planes` deploy, which G1012 measures as
  > rolling the fleet back to an image ECR has expired, so the alarms join by
  > NAMED export and by an ARN `Edge` already forces.
  >
  > 🛑 **THAT DERIVATION SAID 6 UNTIL 19 Sep 2026 AND `Edge` IS NO LONGER A
  > FUTURE ROW IN THIS LIST — IT IS TWO FILES AND IT IS DEPLOYED.** **G293**:
  > one CloudFront distribution, a wildcard certificate over
  > `*.reconcileai.app`, and the data plane as a SECOND ORIGIN behind the same
  > distribution, reached by a **CloudFront VPC origin** so that both ALBs stay
  > internal. ⚠️ **THE SENTENCE ABOVE — *"G277 blocks `Edge`"* — WENT FALSE THE
  > DAY THE OWNER NAMED THE HOSTS** (`console.` and `partners.reconcileai.app`,
  > 19 Sep 2026) and is corrected here rather than deleted, because it is the
  > sentence that told a reader this stack could not be written. ⚠️ **AND THE
  > PARENTHESIS IS STILL WRONG IN ONE HALF: it says *"G183's one wildcard per
  > region"* and G293 rules a FLAT wildcard, `*.reconcileai.app`, which covers
  > one label and therefore covers no `{tenant}.{region}.{domain}` host at all.**
  > That collision is real, it is named on `EDGE_WILDCARD_DOMAIN` in
  > `infra/lib/config.ts`, and it is the owner's to rule rather than this page's
  > to reconcile.
  >
  > ✅ **AND THE OWNER RULED THE SAME DAY — G297, APPLIED AND DEPLOYED
  > 19 Sep 2026. THE PARAGRAPH ABOVE IS HISTORY AND IS KEPT AS HISTORY**, both
  > because it named the defect correctly and because G293's flat decision was
  > taken deliberately: this reads as an AMENDMENT, not as a mistake erased.
  > **Tenants are `{tenant}.us-west-2.reconcileai.app` under
  > `*.us-west-2.reconcileai.app`; the CONSOLES STAY FLAT**, because a console
  > has no tenant and a region label on one would assert a residency invariant 3
  > says the control plane does not have. **Two certificates and two
  > distributions, and the second distribution is forced rather than chosen:
  > CloudFront reads exactly one viewer certificate per distribution.** The
  > constant is now `EDGE_TENANT_WILDCARD_DOMAIN`, derived from `AWS_REGION` so
  > the region is never typed twice. 🛑 **The property, witnessed from AWS:
  > `ten-acme.reconcileai.app` resolves, connects on 443 and is refused at the
  > TLS handshake with NO CERTIFICATE OFFERED AT ALL** — residency held at the
  > transport layer rather than by an application check. **TWO of the eight files are `Edge`** — the certificate lives
  > in its own stack because CloudFront reads viewer certificates from
  > `us-east-1` and from nowhere else, which is the one exception to G256's
  > refusal of that region and is argued as one.
- `infra/` joins the gate as `typecheck:infra` **and** `cdk synth` — a stack
  that does not synthesise is a red gate. Synth is deterministic and offline;
  it meets G108's condition.
- **G212 ends with `infra/`.** G212 forbids any AWS SDK *while phase one has no
  AWS resource*. The `infra/` slice is the commit that creates the first one,
  and G212's own wording makes it the commit that lifts the ban. Until that
  commit, G212 binds and this page does not loosen it.

**Rejected:** Terraform (the `changi_*` projects in the same account use it,
but it is a second language and toolchain in a repository whose one language
is a ruling); raw CloudFormation (no type checking over the one artefact that
most needs it).

---

## 11 · Tagging (G260)

Every resource carries all six, or `cdk synth` fails:

| Tag | Values | Why |
|---|---|---|
| `Project` | `reconcile` | Cost allocation and the pipeline role's deploy fence in a shared account |
| `Environment` | `staging` · `prod` | Cost by environment; alarms route by it |
| `Plane` | `control` · `data` · `edge` · `ci` · `shared` · `public` | Invariant 3 is auditable from a tag query — a `Plane=control` resource with a route to a `Plane=data` cluster is a finding |
| `ManagedBy` | `cdk` | Anything without it was made by hand and is a cleanup item |
| `Owner` | a team mailbox — ⚠️ **placeholder until the owner supplies it** | Who gets paged |
| `CostCentre` | ⚠️ **placeholder until the owner supplies it** | Finance's key, not ours |

> ⚠️ **THE `Plane` ROW LISTED FOUR VALUES UNTIL 22 Sep 2026 AND THE TREE HAD
> SIX, AND TWO SLICES ADDED THEM WITHOUT THIS PAGE MOVING.** `shared` arrived
> with the `Network` slice (a VPC belongs to neither plane) and `public`
> arrives with S5's `Amplify` (G1973 — the apex marketing plane, which the pack
> calls *"a third plane the architecture documents do not describe"*). **The
> `shared` one was not S5's to make stale** and is named so this sweep is not
> read as accounting for both. **Each was added rather than a false value
> reused, which is the point of this row**: `edge` on the apex would say it
> belongs to the `Edge` stack's CloudFront fleet, and `shared` would say it
> serves both planes — **and a false statement in the one field invariant 3 is
> audited from is worse than a value nobody expected.** Neither addition
> weakens the audit query, which is about SECURITY GROUPS and CLUSTERS.
> Derive it, never read it:
> `node -e "import('./infra/lib/config.ts').then(m=>console.log(m.PLANES))"`.

- **Enforced twice.** A CDK `Aspect` walks every construct at synth and throws
  on a missing tag; AWS Config's managed rule `required-tags` reports any
  resource in the account carrying `Project=reconcile` and lacking the rest,
  which catches the console and the CLI. The Config rule is itself declared in
  the `Observability` stack.
  > 🛑 **THE `Observability` STACK EXISTS SINCE 20 Sep 2026 AND THE CONFIG
  > RULE IS STILL NOT IN IT — G1068, REFUSED RATHER THAN FORGOTTEN.** *"Enforced
  > twice"* remains **aspirational**: an AWS Config rule evaluates **nothing**
  > without an account-wide configuration recorder and delivery channel, and
  > `000000000000` has none. Declared without one it costs money, reports
  > `NOT_APPLICABLE` for every resource and **reads in the console as though
  > tagging were enforced.** Creating a recorder is account-wide in a SHARED
  > account and is the owner's decision, not this product's.
  > **`tests/infra/observability.test.mjs` §8 asserts no Config rule exists
  > anywhere in the app**, so the commit that creates a recorder deletes an
  > assertion and argues the cost. Until then the CDK Aspect is the only half,
  > exactly as `infra/lib/tagging.ts` has always said.
  >
  > ⛔ **AND "UNTIL THEN" HAS NO END — R15, 1 Oct 2026, THE OWNER'S (G2441):
  > *"No account-wide AWS Config recorder."*** The bullet above and the banner
  > it carries are kept as they stood, and both are now history: **"enforced
  > twice" is RETIRED, not deferred. No AWS Config rule exists in this app by
  > decision**, and tag enforcement is the synth-time Aspect plus
  > `tests/infra/tag-aspect.test.mjs`. ⚠️ **Cost accepted:** a resource created
  > outside CDK — the console, the CLI — is checked by nothing. §8 of
  > `tests/infra/observability.test.mjs` now records the decision rather than
  > waiting for a recorder.
- **Deliberately absent:** no `TenantId` tag on anything. A tag is control-plane
  metadata readable by anyone with `tag:GetResources`; a per-tenant tag would
  be a tenant enumeration in the clear. The two rejected alternatives (tenant
  tags on data-plane resources; `DataClass`/`Residency` compliance tags) are
  recorded as rejected for phase one, and the second is the more likely to
  return when a second residency region exists.

---

## 12 · Observability — baked in, declared in CDK (G261)

> ✅ **PARTLY BUILT SINCE 20 Sep 2026 — `infra/lib/observability-stack.ts`,
> G1061–G1068. THIS SECTION WAS DECIDED-AND-NOT-BUILT FOR TWO DAYS AFTER THE
> STACK IT NAMES WAS LISTED IN §10, AND `grep -rln 'Alarm' infra/lib/` RETURNED
> NOTHING THE WHOLE TIME.** What this page asks for, row by row, and what
> actually landed:
>
> | §12 row | State |
> |---|---|
> | one SNS topic per environment | ✅ built — **and with ZERO subscriptions, so it pages NOBODY** (G1062). Who is paged is the same owner ruling §14 records for the `Owner` tag; the stack outputs the fact and a test pins it |
> | ALB 5xx rate · p99 latency | ✅ built, **on the DATA plane's ALB only.** The control plane's ALB has an ingress list of `[]`, so it emits no `RequestCount` at all and an alarm there would read OK for ever — G1066 |
> | ECS task restart count | 🟠 **NO SUCH METRIC EXISTS.** `ECS/ContainerInsights` has no restart counter, so this row is delivered as an EventBridge RULE on a serving task exiting non-zero, PLUS the running-below-desired alarm which is what a crash loop looks like in metrics. **Neither alone is the row** — G1064 |
> | Aurora ACU at ceiling · connection count | ✅ built, both clusters, joined by cluster identifier |
> | migrate run-task non-zero exit | 🟠 **an EventBridge rule, and TWO of them**: a task that failed to START carries no exit code at all, so a single exit-code rule would let a forward-only migration fail in silence — G1064 |
> | pipeline stage failure | ✅ built, on the STAGE and not the execution |
> | Aurora `cloudwatchLogsExports` | ✅ built — **with the four PostgreSQL parameters that keep a bound value out of that log, in the same commit** (G1065). §12.1 is a containment rule and the export without the parameters would have made it a property of the console |
> | VPC flow logs | ✅ built — the VPC had none since the day it was created |
> | deployment circuit breaker **with the alarm attached** | ⛔ **NOT BUILT.** Attaching an alarm to `deploymentAlarms` is a `Planes` change, and a `Planes` deploy rolls the fleet back to an image ECR has expired (G1012). Owed, and it is the reason to fix that drift first |
> | **Tracing** — X-Ray, ADOT sidecar, OpenTelemetry | ⛔ **NOT BUILT AND NOT STARTED.** No dependency is taken; a sidecar is a `Planes` change |
> | **Logs** — Fastify structured JSON | ✅ **BUILT 21 Sep 2026 — G1391–G1396, and G1067 is DISCHARGED.** ⚠️ **THIS ROW READ *"⛔ NOT BUILT: `server/http/app.ts` sets `logger: false` (G1067). An alarm on 5xx with no structured log to explain one is a pager without a diagnosis"* and is corrected rather than deleted**, because that sentence is the premise the repair was commissioned against. Both planes log through `loggerOptions(plane)` from `server/http/log-allow-list.ts` — three serializers, a formatter, and §12.1's allow-list as a CONJUNCTION of a name rule and a value grammar. 🛑 **THE TRIPWIRE THAT WAS SUPPOSED TO GOVERN THIS ROW PASSED AGAINST THE DEFECT — G1392** |
>
> 🛑 **EVERY THRESHOLD IS DERIVED FROM A CONSTANT ALREADY IN THE TREE AND THE
> DERIVATION IS WRITTEN BESIDE IT IN `infra/lib/config.ts`** — a threshold
> nobody argued is a threshold nobody will trust, and an untrusted pager is a
> muted pager (G1063). **None of them is an SLO**; `PRODUCT.md` forbids
> inventing one.

- **Logs.** Fastify's logger emits structured JSON to stdout; the ECS `awslogs`
  driver ships it to one CloudWatch log group per plane per environment, with
  retention set in CDK (staging short, prod at the retention class the record
  assigns to operational logs). No log agent in the image.
- **Metrics.** Container Insights on the cluster; ALB and Aurora metrics as
  emitted; one application namespace `Reconcile/<plane>` for run-level counters
  the plane publishes.
- **Alarms** — on **one** SNS topic per environment, all declared in the
  `Observability` stack: ALB 5xx rate, p99 latency, ECS task restart count,
  Aurora ACU at ceiling and connection count, migrate run-task non-zero exit,
  pipeline stage failure. A deploy that trips an alarm inside its bake window
  **rolls back** (ECS deployment circuit breaker with the alarm attached).
- **Tracing.** X-Ray through the ADOT collector as an arm64 sidecar; Fastify
  instrumented with OpenTelemetry, pinned exact. Trace ids are carried into the
  log line so a log and a trace join.

### 12.1 The log-content rule, and it is a containment rule

**A log line carries identifiers, codes, counts and durations. It never
carries a payload field value, counterparty text, a document body, a header
value or a query string.** This is invariant 6 and the `AssertNoTextDeep`
discipline applied to logs: a counterparty-authored string in a log is a
counterparty-authored string in a place nothing classified. `tenantId` is an
id and is allowed.

Enforced by an **allow-list serializer** on the logger — a field not in the
allow-list is dropped and counted, never printed — not by review. The
`infra/` slice lands the serializer beside the logger configuration, and a test
that logs a `SourceDocument`-shaped object and asserts the line holds its id
and nothing else.

> ✅ **THE SERIALIZER IS BUILT AND THE LOGGER IS ON — G1391–G1396,
> 21 Sep 2026. THE BANNER BELOW IS QUOTED RATHER THAN DELETED**, because its
> measurement is unchanged and is the whole reason this was a slice rather than
> a line. IT READ: *"🛑 THE SERIALIZER IS NOT BUILT AND THE LOGGER IS STILL
> OFF — G1067, 20 Sep 2026, AND THE SENTENCE ABOVE IS WRONG ABOUT WHOSE SLICE
> IT IS."*
>
> ⚠️ **AND THAT HALF OF IT WAS RIGHT AND IS NOW SETTLED: the paragraph above
> says *"the `infra/` slice lands the serializer"* and it does not.** The
> serializer is `server/http/log-allow-list.ts` and the logger configuration is
> `server/http/app.ts`; **no `infra/` slice may edit either**, which is why
> G1061's alarms could land while the thing that explains one could not.
>
> 🛑 **WHAT THE OLD BANNER MEASURED IS UNCHANGED AND IS WHY THE REPAIR HAS
> THREE PARTS: `logger: true` ALONE BREAKS THIS VERY RULE ON ITS FIRST REQUEST.**
> Fastify's DEFAULT serializers emit, for one ordinary request, `req.url` (the
> QUERY STRING, named in the paragraph above as a thing a log line never
> carries), `req.host` (which resolves to a TENANT through `model/serving-host.ts`'s
> registry under G179/G180) and, on a 500, `err.message` and `err.stack` — and
> a `pg` failure's `detail` is a ROW VALUE. **An application log that printed it
> would reintroduce, one layer up, exactly the thing G1065 spent a cluster
> parameter group on.**
>
> ⚠️ **THE ALLOW-LIST IS A CONJUNCTION AND NEITHER RULE ALONE WOULD DO**:
> the NAME must be in a closed set or be id-/count-shaped, **and** the VALUE must
> be a number, a boolean, or a string with no whitespace. A payload's keys are
> counterparty-chosen, so a key named `invoiceId` defeats the name rule on its
> own; a value rule alone is not the field-level allow-list this section asks
> for. `tests/http/log-allow-list.test.ts` asserts all of it over the BYTES a
> real plane emits — including this section's own named test, *"a test that
> logs a `SourceDocument`-shaped object and asserts the line holds its id and
> nothing else."*
>
> 🛑 **AND THE TRIPWIRE THIS SECTION INSTALLED DID NOT FIRE — G1392, AND
> IT IS THE FINDING WORTH CARRYING FORWARD.** The old banner said
> *"`tests/infra/observability.test.mjs` §9 is a tripwire on `logger: false`,
> so the commit that turns it on meets this paragraph at a red assertion rather
> than after the fact."* **It met no red.** That assertion was
> `assert.match(source, /logger:\s*false/)`, and it passed against the commit
> that turned the logger ON — satisfied by two PROSE COMMENTS narrating the
> history, with the live setting three hundred lines below. It also passed
> against a deliberately bad implementation keeping `headers`. **A grep cannot
> tell code from a sentence about code.** The replacement asks about the
> contract and reads the AST.
>
> ✅ **THE ONE PLACE THIS RULE IS ENFORCED TODAY IS THE DATABASE, AND IT WAS
> NOT ENFORCED AT ALL BEFORE 20 Sep 2026.** ⚠️ **THAT HEADING IS NOW
> WRONG IN ITS OWN TERMS AND IS KEPT AS THE HISTORY IT IS — the database is
> no longer the ONE place; it is one of two.** `db/migrations` bind every value,
> so a statement text carries `$1` — **unless
> `log_parameter_max_length_on_error` is non-zero, at which point PostgreSQL
> writes the bound values beside the statement on every error.**
> `infra/lib/data-stack.ts` pins that and three companions in a cluster
> parameter group, in the same commit as the log export (G1065), because the
> export without the parameters would make invariant 4 and invariant 6 a
> property of whatever the default parameter group happened to say.
>
> ⚠️ **AND ONE CHANNEL IS STILL UNGOVERNED, NAMED RATHER THAN LEFT TO BE
> FOUND (G1395): `console.error` IS NOT THE LOGGER.** Roughly twenty call sites
> under `server/data-plane/` reach the same CloudWatch stream through the
> `awslogs` driver and through no serializer at all, and one of them
> interpolates an error's own `message`. The 500 path in `server/http/app.ts`
> was one of them and is fixed here; the rest are a separate commit.

**Rejected:** unrestricted structured logging (relies on review, which the
record says is not a mechanism); logs-only observability (finds out about
failures from users).

---

## 13 · Hardening (G262, G263)

### 13.1 Images

- **Multi-stage build to a minimal arm64 runtime.** `npm ci --omit=dev` runs in
  a builder stage; the final stage is a minimal Node 22 runtime image with no
  package manager and no shell, pinned by **digest**, not tag.
- **`USER node`**, `readonlyRootFilesystem: true`, all Linux capabilities
  dropped, `/tmp` as an explicit tmpfs mount. A plane that needs to write to
  its own image is a defect.
- **ECR enhanced scanning (Inspector) on push**; the Build stage **fails** on
  any `CRITICAL` or `HIGH` finding. Base-image digest bumps arrive as
  pull requests, reviewed like any dependency under G191.
- **Signed and verified.** Images are signed with AWS Signer (Notation) in the
  Build stage; the ECS task definition references the digest the pipeline
  signed, and a Config rule reports any running task whose image lacks a valid
  signature. The CI image in §9.4 is signed the same way.
  > ⛔ **THE CONFIG-RULE HALF OF THAT SENTENCE IS DECLINED — R15, 1 Oct 2026,
  > THE OWNER'S (G2441).** A Config rule evaluates nothing without an
  > account-wide recorder, and the owner ruled there will be none, so **no
  > Config rule reports an unsigned running task, by decision.** The sentence
  > is kept as it stood. What it leaves is the pipeline referencing the digest
  > it built; whether a running-task signature check is wanted by some other
  > mechanism is **not ruled**, and nothing here invents one.
- The CI image is hardened to the same rules except that it **must** carry a
  shell, a package manager, PostgreSQL and chromium — it is a build machine,
  and the difference is stated rather than smuggled.

**Rejected:** non-root plus scanning without signing (the cheap 80%, and the
20% is "which image is actually running"); a full CIS benchmark posture in the
pipeline (the strongest audit story, deferred until a regulated customer asks
for the report, because it lengthens every build for an audience that does not
yet exist).

### 13.2 Secrets and identity

- **Aurora credentials live in Secrets Manager**, rotation enabled, injected
  as ECS task **secrets** — never baked into an image, never written to a
  `.env`, never in a task definition's plain environment.
- **One IAM task role per plane**, least privilege: the data plane may read
  its own secret and write its own log group; the control plane likewise; the
  migrate task definitions are the **only** principals granted the migrator
  secret. This is the credential fence §7 describes, in IAM.
- **The pipeline role** may push to its own ECR repositories, run its own task
  definitions and deploy stacks tagged `Project=reconcile` — and nothing in the
  rest of the shared account.
- **No IAM user access keys anywhere in the product.** `docs/infrastructure-risk-register.md`
  K1 is a live key in a Lambda in this same account; the product creates no
  successor to it.

**Rejected:** SSM Parameter Store `SecureString` (cheaper, no rotation; fine
for a staging-only world, and this page decides prod's shape too).

---

## 14 · Standing verifications and things deliberately not decided

| Item | State | Who closes it |
|---|---|---|
| Aurora Serverless v2 offers the PostgreSQL 17 minor the migrations were written against | ✅ **VERIFIED AND PINNED, 18 Sep 2026 — `17.9`.** `aws rds describe-db-engine-versions --engine aurora-postgresql --region us-west-2` offers `17.4 17.5 17.6 17.7 17.9 17.10` — note the ABSENCE of `17.8`, which is the argument for an exact literal over "the latest 17". `17.9` is the newest named by BOTH that API and `AuroraPostgresEngineVersion` in the pinned `aws-cdk-lib@2.270.0`, so it is checked by `tsc` rather than by CloudFormation minutes into a deploy. `infra/lib/config.ts#AURORA_POSTGRES_VERSION` carries the derivation; `tests/infra/data.test.mjs` stops it drifting, which a one-off verification cannot | **Closed** by `infra/lib/data-stack.ts` |
| Whether a `Plane=shared` tag value is acceptable | **Taken by this slice, not by the owner.** One VPC serves both planes (G253), so its subnets and NAT belong to neither; tagging them `data` or `control` would put a false statement in the field G260 says invariant 3 is audited from. The six SECURITY GROUPS — which are what the audit query is about — each carry their own plane, and `tests/infra/network.test.mjs` refuses a `shared` one | The owner, if they want it ruled away |
| What "working hours" means for the staging shutdown | **Assumed: `Asia/Singapore`, 07:00–20:00, Mon–Fri.** Nothing in the record says. The account is 1CH Internal-**SNG** (G279) and G185 puts the control writer in `ap-southeast-1`, so Singapore is the defensible guess. It is one constant, `SHUTDOWN_TIMEZONE` | The owner |
| chromium runs on the AL2023 arm64 CI image | **Not verified** — §9.4 | The `CiImage` stack, witnessed red first |
| `Owner` and `CostCentre` tag values | **Placeholders** | The owner |
| **Who is paged, and at what address** | ⛔ **UNDECIDED, and since 20 Sep 2026 it is a LIVE gap rather than a future one: eight alarms and four event rules publish to `reconcile-staging-alarms`, which has ZERO subscriptions and therefore pages nobody** (G1062). This is the `Owner` row above with a consequence attached. `tests/infra/observability.test.mjs` §2 pins the zero; the commit that subscribes deletes it. ⚠️ **TEN ALARMS SINCE 22 Sep 2026 — G2006 — AND THE TENTH IS THE FIRST ON A METRIC THIS PRODUCT MINTS RATHER THAN ONE AWS PUBLISHES.** `reconcile-staging-demo-intake-crm-delivery-failed` watches `Reconcile/DemoIntake:CrmDeliveryFailed`, because **the demo intake's `handler()` CATCHES: a dropped lead is a SUCCESSFUL invocation and `AWS/Lambda Errors` reads 0**, so not one of the other nine — every one of them on an AWS-published metric — can see it. 🛑 **THE ALARM IS HERE AND THE METRIC FILTER THAT MINTS IT IS IN `amplify-stack.ts`, WITH THE LOG GROUP IT READS**: G261 puts alarms in this stack and `tests/infra/observability.test.mjs` refused a draft that put this one elsewhere. **The join costs no coupling** — an alarm needs a namespace and a metric NAME, both constants, so neither stack references a construct in the other and neither mints an export. And it pages nobody, for exactly the reason this row gives. **Derive the count, never read it: `grep -rln 'Alarm' infra/lib/`** | The owner |
| An account-wide **AWS Config configuration recorder**, without which G260's `required-tags` rule evaluates nothing | ⛔ **NOT CREATED, and refused by this product rather than deferred** (G1068): it is account-wide in a SHARED account with a cost and a blast radius outside `Project=reconcile`. ⛔ **DECIDED 1 Oct 2026 — R15, G2441: the owner declined it. No recorder and no Config rule, by decision**; the Aspect plus its tests is the whole of tag enforcement | ~~The owner~~ — **decided: declined** |
| Whether Container Insights publishes `RunningTaskCount: 0` during the scheduled zero-desired window, or publishes nothing | ⚠️ **UNMEASURED**, which is why the running-below-desired alarm uses `treatMissingData: MISSING` and attaches **no** `insufficientDataActions`. `NOT_BREACHING` would be a nightly lie and `BREACHING` a nightly page | Whoever first watches a real shutdown window |
| `minHealthyPercent` on the two ECS services | ⚠️ **UNSET, so CDK's default 50% applies — and `floor(0.5 x 1)` is ZERO, so an ordinary deployment may take a one-task service to no running tasks at all.** Found by reading `cdk synth`'s own warning. Setting it to 100 is a `Planes` change and a `Planes` deploy is currently unsafe (G1012); until then the shortfall alarm's ten-minute window is what accommodates it | Whoever repairs the `Planes` image drift |
| A dedicated `prod` account | **Not ruled**; expected | The owner, before the first customer |
| Aurora proxying / connection pooling in front of the plane | **Not needed** under G101's posture; revisit at load | Nobody yet |
| Multi-region data planes (G185's hosted shape) | **Out of phase one**; one region | A second residency region's arrival |
| A WAF on the CloudFront distribution | **Not ruled** | The owner |
| **How a per-tenant KMS key comes to exist (G287)** | 🛑 **OPEN, AND IT IS THE HALF OF G287 THAT IS NOT BUILT.** The ruling says *"onboarding now mints one"*; `docs/fleet-deployment.md` §5 says a config change is a ROW INSERT in the control plane. **Nothing joins the two** — no `FleetReconciler`, no `administration.openapi.yaml` operation, no control-plane principal with `kms:CreateKey`, and no column on `DataPlanePlacement` for the opaque handle. Today the only way to mint one is appending to `TENANT_KEY_HANDLES` in `infra/lib/config.ts` and running `cdk deploy`. Three questions must be answered in order, and the third is the sharp one: **hosted onboarding is a `Tenant` row and NOT a plane insert** (`fleet-deployment` §3.2), so a per-tenant key makes hosted onboarding an AWS operation for the first time | The owner. `infra/lib/storage-stack.ts` states the gap in full |
| **An S3 gateway VPC endpoint** | **Not built, and the cost of the absence is exact rather than notional:** every object byte the data plane writes or reads crosses the single NAT gateway at NAT data-processing rates. A gateway endpoint is free. `infra/lib/network-stack.ts` states in its own header that it creates no VPC endpoints, deliberately, so this is one construct in THAT stack rather than a decision `Storage` may take | The `Network` slice |

---

## 15 · What this page supersedes

Each file below now carries a banner naming this page. None is deleted —
the record corrects, it does not erase.

| Document | Was | Now |
|---|---|---|
| `docs/deployment-topology.html` | STALE · physical placement, fleet layer | **SUPERSEDED** on placement by §7–§8 |
| `docs/service-stacks.html` | STALE · services grouped by function | **SUPERSEDED** by §1 and §7 |
| `docs/systems-end-to-end.html` | STALE · a systems inventory with build/buy | **SUPERSEDED** on the stack by §1 |
| `docs/build/green-service-topology.md`, `docs/build/red-service-topology.md` | WORKING MATERIAL · the deployable count argued both ways | **SUPERSEDED** by §7's mapping, which is derived from `compose.yaml` rather than argued |
| `docs/day-2-operations.md` | DATED SNAPSHOT · premise out of v1 | unchanged status; §12–§13 answer the parts of it that were still open |
| `docs/runner-image-provisioning.md` | LIVING CONTROL · the self-hosted host | **Still governs the host until §9.6's commit**; banner says so |
| `docs/build-conventions.md` | LIVING CONTROL · dependencies, types, accessibility | **Still authoritative for what it names**; it does not cover hosting and now points here for it |

`docs/persistence-design.md` and `docs/byoa-topology.md` were already
superseded and are unchanged.

---

## 16 · What changes in the tree, and in which commit

This page is documentation. The commits that make it true, in order:

1. **`infra/` lands** — CDK app, `CiImage` and `Pipeline` stacks first,
   `typecheck:infra` and `cdk synth` in the gate. **This is the commit that
   creates the first AWS resource and the commit that ends G212.** Its message
   says both. `CLAUDE.md`'s *"no AWS resource has been created"* is corrected
   in the same commit, in place, in the style the page uses for every other
   sentence that went false.
2. **`Dockerfile` pins `linux/arm64` and a digest**, gains the multi-stage
   minimal runtime, `USER node`. `compose.yaml` is unchanged in shape.
3. **The pipeline observes one green pull-request build**, then
   `.github/workflows/check.yml`, `tests/ci/gate.test.ts`'s workflow assertion
   and the self-hosted runner retire together, and
   `docs/runner-image-provisioning.md` is banner-marked SUPERSEDED.
4. **`Network`, `Data`, `Planes`, `Edge`, `Observability` deploy to staging**
   from a merge to `main`. The first `v0.1.0` tag exercises the prod pipeline
   against an empty prod.

Each step is its own PR; none of them is this one.

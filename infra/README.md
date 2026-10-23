# `infra/` — the CDK app

> **STATUS:** LIVING CONTROL for what this directory deploys.
> **AUTHORITY:** `docs/tech-stack.md` is the deployment authority and
> `docs/HANDOFF.md` §3 outranks both. This file describes what is HERE, which is
> a strict subset of what §10 names. If this file and a G-row disagree, the row
> wins and this file is stale.
> **Written 18 Sep 2026**, as `docs/tech-stack.md` §16 step 1.

**A CDK v2 app in TypeScript, with its own manifest (G259), pinned exact
(G191), ARM64 throughout (G252), in `us-west-2` / `000000000000` (G256).**

---

## What is deployed

> ⚠️ **THIS SECTION SAID *"Two stacks"* UNTIL 18 Sep 2026 AND IT IS FOUR.**
> `Network` and `Data` landed, and the correction is recorded rather than
> overwritten because the sentence below it — *"deployed in this order"* — is
> the one a reader acts on, and the order changed with them. Derive the list;
> the table is a convenience:
>
> ```bash
> npm run synth:infra && ls infra/cdk.out/*.template.json
> ```

Four stacks, and they are deployed **in this order** for reasons stated below.

| Stack | What it creates | Ruling |
|---|---|---|
| `reconcile-ci-image` | An ECR repository (`reconcile/ci-image`, scan-on-push, **immutable tags**) and one `ARM_CONTAINER` CodeBuild project that builds `infra/ci-image/Dockerfile` for `linux/arm64` and pushes it | G258, G262 |
| `reconcile-pipeline-staging` | An ECR repository for the planes' image, a CodePipeline (`Source` → `Gate` → `Build`), two `ARM_CONTAINER` CodeBuild projects, and the CloudFormation deploy fence role | G257, G252, G262, G263 |
| `reconcile-network-staging` | ONE VPC across two AZs, **one** NAT gateway (not one per AZ — the cost difference is real and the AZ-failure cost is stated in the file), public + private-with-egress subnets, and **six security groups**: a tasks/database pair per plane plus a rotation-function group per plane. **No rule admits one plane's group to the other plane's database group**, and every ingress rule in this product is in this stack | G253, G193, G260 |
| `reconcile-data-staging` | **TWO Aurora Serverless v2 PostgreSQL 17.9 clusters**, one per plane, writer only, 0.5–2 ACU, encrypted, each with a Secrets Manager secret on a **weekday** rotation schedule, plus four EventBridge schedules that **stop both clusters at 20:00 and start them at 06:30, Monday to Friday** | G254, G177, G263, G193 |
| `reconcile-pipeline-staging` | An ECR repository for the planes' image, a CodePipeline (`Source` → `Gate` → `Build` → `Migrate` → `Deploy`), **four** `ARM_CONTAINER` CodeBuild projects, the ECS run-task fence, **the `UpdateStack` fence on the one named `Planes` stack (G2041/G2045)**, and the unassumed CloudFormation deploy fence role. ⚠️ **THIS SAID *"the ECS run-task and update-service fences"* UNTIL 23 Sep 2026 AND IS CORRECTED RATHER THAN DELETED: the Deploy stage no longer holds `ecs:UpdateService` at all** — CloudFormation moves the services now, so the ECS fence there is `DescribeServices` and nothing more (G2046) | G257, G252, G253, G262, G263, G2041 |
| `reconcile-storage-staging` | **ONE object bucket for the data plane** — `BLOCK_ALL`, ACLs off, versioned, TLS 1.2 enforced in the bucket policy, `RETAIN`, and one lifecycle rule that aborts incomplete multipart uploads and **expires nothing** — plus the per-tenant KMS key factory, and **since 19 Sep 2026 the `reconcile-<env>-tenant-key-minter` Lambda (G290)**. 🛑 **ZERO KEYS EXIST, so the bucket policy DENIES `PutObject` OUTRIGHT**: with no tenant key there is no key an object could legitimately be written under, and a bucket that accepted the first upload anyway would put it under a shared key, which is the design G287 rejected | G287, **G290**, G260, G253, G263 |

| `reconcile-edge-certificate-staging` | **TWO ACM certificates, both DNS-validated** — `*.us-west-2.reconcileai.app` for TENANTS and `*.reconcileai.app` for the CONSOLES — and the only stack in this app outside `us-west-2`. CloudFront reads viewer certificates from `us-east-1` and from nowhere else. ⚠️ **THIS ROW SAID *"ONE ACM certificate, `*.reconcileai.app`"* UNTIL 19 Sep 2026**; G297 corrected G293's flat wildcard to one wildcard per region, restoring G179 and G183, and it is an AMENDMENT rather than a mistake erased. 🛑 **NO SUBJECT ALTERNATIVE NAME ON EITHER, EVER**: CT logs are public, append-only and indexed, so a per-tenant SAN is a tenant enumeration readable by the entire internet — **and CT is NOT the justification for the wildcard; G183 and G297 are both emphatic that any document saying so is wrong** | **G297**, G293, G179, G183, G260 |
| `reconcile-edge-staging` | **TWO CloudFront distributions.** The **TENANT** one carries `*.us-west-2.reconcileai.app` and two origins: the frontend bundle from a private S3 bucket over **OAC** (G263 — no static keys), and **the data plane through a CloudFront VPC ORIGIN**, so both ALBs stay internal and no security group ever admits a CIDR. The **CONSOLE** one carries `console.` and `partners.reconcileai.app` by name, the bundle only, **no plane origin at all** (invariant 3, G200). A behaviour-scoped SPA rewrite function shared by both, and **exactly one ingress rule**, whose source is the security group CloudFront itself creates. ⚠️ **THIS ROW SAID *"ONE CloudFront distribution … one wildcard alias, one wildcard Route 53 record"* UNTIL 19 Sep 2026.** G293's refusal of one distribution **per tenant** is untouched — creating a tenant still deploys nothing — and the second distribution is FORCED: **CloudFront reads exactly one viewer certificate per distribution**, so two grammars cannot share one. 🛑 **CACHING IS DISABLED ON `/v1` AND THAT IS A TENANT-ISOLATION CONTROL** — a cache key without `Host` would serve one tenant's response to another. 🛑 **`*.reconcileai.app` IS STILL A ROUTE 53 RECORD AND IT IS NOW A SINKHOLE**: it resolves, so DNS is not an enumeration oracle, and it points at the tenant distribution, whose certificate covers no flat host — so `ten-acme.reconcileai.app` fails at the TLS handshake with no certificate offered at all. **Do not delete it as dead; it is what makes the fail-closed property observable** | **G297**, G293, G226, G200, G179, G183, G263 |

| `reconcile-identity-staging` | **THE BROKER — G302, 19 Sep 2026.** One Cognito user pool for the whole fleet, one hosted-UI domain, one public app client, and **ZERO identity providers**. 🛑 **NOBODY CAN SIGN IN, AND THAT IS THE DEPLOYED STATE RATHER THAN AN UNFINISHED ONE**: `tenant.identity_connection` has no column for a Cognito provider name, so a door minted here would have no row behind it and `server/data-plane/identity.ts` would refuse everyone at `owner_unresolvable`. ⚠️ **NATIVE USERS ARE NOT IMPOSSIBLE — A USER POOL *IS* A DIRECTORY** — and the stack says so in capitals rather than claiming otherwise. They are unreachable at three fences: no self sign-up and no self-service recovery; an app client whose only `ExplicitAuthFlows` entry is `ALLOW_REFRESH_TOKEN_AUTH` and whose `SupportedIdentityProviders` is an empty list rather than an omitted property; and — the load-bearing one, **which is not in `infra/` at all** — a native user has no owning directory, so `orgFor()` has nothing to derive an `orgClass` from. 🛑 **`MfaConfiguration: OFF` IS AN ASSERTION, NOT A DEFAULT** (G223: *"no second factor in v1; federation owns it"*). **NO ORDERING CONSTRAINT**: this stack takes no construct reference and nothing reads its outputs — which is itself the gap, since no plane carries an issuer or a JWKS path | **G302**, G299, G289, G263, G260, G223 |

> 🛑 **THE TABLE NOW HAS NINE ROWS AND THE SENTENCE ABOVE IT STILL SAYS FOUR.**
> `Identity` landed 19 Sep 2026 under G302 and sits **nowhere** in the deploy
> order below, deliberately: it joins to nothing by construct reference and
> nothing joins to it, so it may be deployed at any point. **That freedom is
> the gap in one sentence** — a stack nothing depends on is a stack nothing
> uses, and the wiring that would use it is `server/`'s.
>
> 🛑 **AND THE SENTENCE BELOW THIS ONE SAID EIGHT ROWS, WHICH WAS TRUE WHEN
> WRITTEN.**
> The two `Edge` rows landed 19 Sep 2026 under G293; the sentence is left
> standing as the history it is and corrected here, which is what this record
> does with every claim that went false because work landed. **Where `Edge`
> sits: `Network` → `Data` → `Planes` → `Edge`, with `EdgeCertificate` before
> `Edge` and `Storage` ordered against `Planes` only.** ⚠️ **`Planes` AND
> `Network` MUST EACH BE DEPLOYED ONCE MORE BEFORE `Edge` CAN DEPLOY AT ALL** —
> `Edge` imports the ALB and its security group by construct reference, and an
> export does not exist until the stack that owns it publishes it. `Planes`
> carries a required `PlaneImageTag`; redeploy it with the value it already has.
>
> 🛑 **THAT LAST SENTENCE WAS THE MOST DANGEROUS LINE ON THIS PAGE AND IT IS
> CORRECTED RATHER THAN DELETED — G1012, 20 Sep 2026.** *"Redeploy it with the
> value it already has"* named the exact act that rolls the fleet backwards:
> `cdk deploy` re-applies a parameter it is not given, and the pipeline's Deploy
> stage registers a task definition **by digest** without ever writing the stack
> value — so the stack's value is as old as the last `cdk deploy` and applying it
> is silent. **Measured against AWS on 20 Sep 2026: the parameter named a tag
> pushed on the 18th, the service ran one pushed on the 20th, and the task
> definition CloudFormation owned was revision 1 against the service's revision
> 38.** `PlaneImageTag` is no longer a CloudFormation parameter; the tag is CDK
> **context**, and a context value that is not supplied throws at synth.
>
> ```bash
> # 1. ask AWS which bytes the fleet is actually running. NEVER guess this,
> #    and never use `latest`.
> AWS_PROFILE=crm-frontend node tests/e2e/probe-deployed-image.mjs
>
> # 2. deploy with the tag it printed. No --parameters: there is no parameter.
> cd infra
> AWS_PROFILE=crm-frontend npx cdk deploy reconcile-planes-staging \
>   -c planeImageTag=<the 40-hex commit sha from step 1>
> ```
>
> ⚠️ **AND AN ECR LIFECYCLE RULE MAKES THE OLD FAILURE MODE CHANGE SHAPE OVER
> TIME, WHICH IS WORTH KNOWING BEFORE READING A GREEN DEPLOY AS SAFE.**
> `reconcile/planes-staging` keeps the **fifty** most recent images, so a stale
> stack value inside the fifty rolls the fleet back SILENTLY and one outside it
> fails at the image pull. On 20 Sep 2026 the parameter's own image had already
> been expired — `describe-images` resolved it at 09:0x and refused it at 09:2x.
> **Loud, by luck.**
>
> ⚠️ **THAT TABLE SAID *"Four stacks"* ABOVE IT AND LISTED SIX ROWS, TWO OF THEM
> THE SAME `reconcile-pipeline-staging` WITH DIFFERENT CONTENTS, BEFORE THE
> `Storage` SLICE TOUCHED IT.** Neither is this slice's to account for and both
> are named so the addition is not read as the whole of what is wrong here.
> Derive the list; the table is a convenience:
> `npm run synth:infra && ls infra/cdk.out/*.template.json`.
>
> 🛑 **AND THE DEPLOY ORDER GREW A CONSTRAINT NOTHING ENFORCES.** `Storage`
> writes an `AWS::IAM::Policy` onto `reconcile-staging-data-service-task`, a role
> the `Planes` stack owns, reached **by name** — because a per-tenant KMS key
> policy must name that same role while `Planes` will one day want the bucket
> name, and construct references in both directions are a `«DependencyCycle»` at
> synth. A name in both directions is no CloudFormation dependency at all, which
> is the point and also the price: **deploy `Planes` BEFORE `Storage`**, or the
> policy fails with `Cannot find the role`. CloudFormation will not tell you.

> ⚠️ **THAT ROW READ *"(`Source` → `Gate` → `Build`), two `ARM_CONTAINER`
> CodeBuild projects"* UNTIL THE MIGRATE AND DEPLOY STAGES LANDED**, and it is
> corrected in place rather than rewritten, because it is the line a reader would
> have trusted when deciding whether stage 4 existed. Derive it, never read it:
>
> ```bash
> npm run synth:infra
> node -e "const t=require('./infra/cdk.out/reconcile-pipeline-staging.template.json');\
> for(const r of Object.values(t.Resources)) if(r.Type==='AWS::CodePipeline::Pipeline')\
> console.log(r.Properties.Stages.map(s=>s.Name))"
> ```

Derive the list rather than trusting the table:

```bash
npm run synth:infra                       # from the repository root
ls infra/cdk.out/*.template.json
```

## What is NOT deployed, and why

Every absence here is a blocked ruling, not an oversight.

> ⚠️ **THE TWELFTH STACK LANDED ON 22 Sep 2026 AND IS NOT DEPLOYED EITHER —
> `Amplify` (S5, G1961–G1979), THE OWNER'S RULING: the PUBLIC MARKETING PLANE
> at the apex `reconcileai.app`**, honouring `docs/build/deploy-handoff.md`
> §5.4, *"a different tool for a different job."* **It was never in the
> not-built table below, because until now no ruling had put it anywhere.**
> Derive the count, never read it: `ls infra/lib/*-stack.ts | wc -l` → **12**.
> ⚠️ **AND THE `→ 10` IN THE BANNER TWO PARAGRAPHS DOWN WAS ALREADY ONE BEHIND
> BEFORE THIS SLICE TOUCHED THE DIRECTORY**: `RunQueue` landed on 20 Sep 2026
> and this page moved for neither. **The 11 was not S5's to make stale** and is
> named so this sweep is not read as accounting for both.
>
> 🛑 **IT TAKES NO CONSTRUCT REFERENCE AND HAS NO DEPLOY-ORDER DEPENDENCY ON
> ANYTHING**, which `Storage`, `Observability` and `RunQueue` each pay for with
> an unenforced ordering and this one gets free: the only thing it reaches
> outside itself is a HOSTNAME. **MEASURED: all ELEVEN pre-existing staging
> templates are BYTE-IDENTICAL before and after it exists.**
> ⚠️ **TEN SINCE 22 Sep 2026 — G2006 — corrected rather than deleted,
> because this is the slice's own headline property.** `Observability` gains
> ONE alarm (`Reconcile/DemoIntake:CrmDeliveryFailed`), because G261 puts every
> alarm there and `tests/infra/observability.test.mjs` REFUSED the draft that
> put it in `Amplify`. 🛑 **NOT A COUPLING REGRESSION, MEASURED: one resource
> added to each of the two templates, ZERO exports in either direction, no new
> `Fn::ImportValue`** — an alarm needs a namespace and a metric NAME, both
> constants. **The other TEN are byte-identical.**
>
> ⚠️ **WHAT IT DELIBERATELY DOES NOT DO**, so none of it reads as unfinished:
> there is **no marketing site** (the content is in no repository — G1968);
> **no repository connection and no token**, because `AWS::Amplify::App` has no
> CodeConnections property and AWS authorises one with a *personal access
> token*, which G263 forbids (G1963); **no apex A record**, because
> `AWS::Amplify::Domain` publishes no alias target and Amplify writes the
> records itself (G1964); **no `www`**, which falls into the `Edge` flat
> sinkhole and fails at the TLS handshake (G1972); and **no WAF and no rate
> limit** on the first unauthenticated write this product has published
> (G1975 as amended by G2015 — **the bound is not the ~$44/month of compute;
> it is ≈4.3M junk CRM leads a day and an availability kill at about fifty
> concurrent connections from one host, answered with a raw AWS 429 that is
> in no `errors.yaml` enum**). `docs/build/deploy-handoff.md` §14 is the
> AWS-side sequence and the list of what must not be done.
>
> ✅ **AND THE LIST SAID *"no alarm on the demo intake (G1976)"* UNTIL LATER
> ON 22 Sep 2026. IT IS CORRECTED RATHER THAN DELETED — G2006.** There is one
> now: a `logs.MetricFilter` on the intake's own log group and an alarm on
> `Reconcile/DemoIntake:CrmDeliveryFailed`. 🛑 **AND THE EXPORT PROBLEM
> G1976 GAVE AS ITS REASON IS SOLVED RATHER THAN IGNORED** — the topic ARN is
> **SPELLED** from the account, the region and the name, never imported, so
> the paragraph above survives in substance and **not to the character: it is
> TEN**, because `Observability` gains the ALARM (G261's home) while `Amplify`
> keeps only the METRIC FILTER, which must sit with the log group it reads.
> **MEASURED: one resource added to each, ZERO exports in either direction, no
> new `Fn::ImportValue`.**
> ⚠️ **AND IT PAGES NOBODY, LIKE THE OTHER NINE** (G1062, R-F): zero
> subscriptions, asserted rather than assumed.

> ✅ **THREE ROWS BELOW NAME `Observability` AS NOT BUILT AND ALL THREE WENT
> FALSE ON 20 Sep 2026 — G1061. THEY ARE CORRECTED HERE RATHER THAN DELETED**,
> because they are what a reader looking for the alarms would have found.
> `infra/lib/observability-stack.ts` exists: one SNS topic, eight alarms, four
> EventBridge rules and VPC flow logs. Derive it:
> `ls infra/lib/*-stack.ts | wc -l` → **10**, and `grep -rln 'Alarm' infra/lib/`,
> which returned **nothing** until that commit.
>
> ⚠️ **AND IT WAS NEVER BLOCKED ON G277 OR G276.** Those two rows put five
> stacks under two blockers and only `Edge` ever belonged there; this is the
> fifth correction of the same sweep, and the last one it had left to make.
>
> 🛑 **TWO OF THE ROWS BELOW SURVIVE IN A NARROWER FORM AND ARE THE ONES TO
> READ:**
> · **the circuit breaker's alarm attachment is STILL NOT BUILT** — it is a
>   `Planes` change, and a `Planes` deploy currently rolls the fleet back to an
>   image ECR has expired (G1012), so the alarm exists and is not attached.
>   ⚠️ **G2041 NARROWS THAT BLOCKER RATHER THAN CLOSING IT, AND THE
>   DIFFERENCE MATTERS: once the pipeline has run once, the stack and the
>   fleet agree, so a `Planes` deploy no longer rolls the fleet ANYWHERE.**
>   Until then the sentence above is exactly true, and it is true again for
>   any `Planes` deploy carrying a tag the pipeline did not write. Check
>   before you deploy: `AWS_PROFILE=crm-frontend node tests/e2e/probe-deployed-image.mjs`;
> · **AWS Config's `required-tags` rule is STILL NOT BUILT, and is now
>   REFUSED rather than deferred** — G1068: a Config rule evaluates nothing
>   without an account-wide configuration recorder, and creating one in a
>   SHARED account is the owner's decision. `tests/infra/observability.test.mjs`
>   §8 pins its absence.

| Not built | Blocked on |
|---|---|
| `Planes`, `Edge`, `Observability` stacks | The console-host and BYOA questions **G277** and **G276** leave open. `docs/tech-stack.md` §16 step 4. ⚠️ **THIS ROW ALSO NAMED `Network` AND `Data` UNTIL 18 Sep 2026 AND NEITHER WAS EVER BLOCKED ON EITHER QUESTION** — they were swept under one blocker with three stacks that are. Both are built |
| The ECS half of the working-hours shutdown | The `Planes` stack. `AURORA_STOP_CRON`, `AURORA_START_CRON`, `ECS_SCALE_DOWN_CRON` and `ECS_SCALE_UP_CRON` in `lib/config.ts` are the interface it must read. **Until it exists, the staging tasks crash-loop overnight against a stopped database** — the Aurora saving is real and the alarm storm is real, and `lib/data-stack.ts` says so where a reader meets it |
| `Network`, `Data`, `Edge`, `Observability` stacks | The console-host and BYOA questions **G277** and **G276** leave open. `docs/tech-stack.md` §16 step 4 |
| `Planes` — ⚠️ **WRITTEN BUT NOT INSTANTIATED, and the two are different claims.** `lib/planes-stack.ts` is G253 in full: two Fargate services, two one-shot migrate task definitions, the internal ALB, and the credential fence that makes the migrate run-tasks the only principals granted the migrator secret. `tests/infra/planes.test.mjs` witnesses that fence green AND red against stub props. It is absent from `cdk synth` because `availablePlanesProps()` returns `undefined` | A VPC, two plane security groups and four Secrets Manager secrets — i.e. the `Network` and `Data` stacks above. The join is one function body; `lib/planes-stack.ts` documents every field it must return. A `Planes` stack instantiated on invented values would synthesise green and deploy into nothing, which is worse than an absent one because it looks finished |
| The pipeline's **Migrate** stage (two ECS run-tasks) | Needs the `Planes` stack's cluster and task definitions |
| The pipeline's **Deploy** stage | Same. Its IAM **fence** is built (`DeployRole`) and nothing assumes it yet |
| `Network`, `Data`, `Planes`, `Edge`, `Observability` stacks | The console-host and BYOA questions **G277** and **G276** leave open. `docs/tech-stack.md` §16 step 4. ⚠️ **`Network` and `Planes` are now a DEPLOY-TIME PRECONDITION of the pipeline stack** — see *The interface to `Network` and `Planes`*, below |
| The **frontend half** of the Deploy stage — S3 sync and CloudFront invalidation | The `Edge` stack. **G277** amended G255 the day it was taken and left the console host an open owner decision, so there is no bucket and no distribution to name. The bundle is still built and still carried in the Build stage's artefact |
| **G261's alarms**, and therefore the circuit breaker's alarm attachment | The `Observability` stack. What IS built is the Deploy stage **refusing** a service whose `deploymentCircuitBreaker` is not `{enable: true, rollback: true}` — the half of G261 this stack can decide |
| The **prod promotion pipeline** (`v*` tag → prod, no rebuild) | G257's guarantee is *resolve the staging artefacts or FAIL*. There is nowhere to resolve them from until `Planes` exists, and a "promotion" that rebuilt would falsify the one sentence the ruling is for. See `PROD_PROMOTION_PIPELINE_TODO` in `lib/pipeline-stack.ts` |
| AWS Config's `required-tags` rule — G260's **second** enforcement | Belongs to the `Observability` stack. Today the CDK Aspect is the only half, and `tests/infra/tag-aspect.test.mjs` is what proves it is real |
| ECR **enhanced** scanning (Inspector), image **signing** (AWS Signer) | Both are registry- and account-level actions in a SHARED account (G256), not a repository property. `docs/tech-stack.md` §13.1 still wants them |
| `infra/ci-image/Dockerfile` | Another slice's file. This app references it by path and does not write it |

## The interface to `Network` and `Planes`

The **Migrate** and **Deploy** stages act on resources this app does not create.
They do not invent names for them: every value is a **named CloudFormation
export**, declared once as `PLANES_EXPORT_KEYS` and `NETWORK_EXPORT_KEYS` in
`lib/config.ts`, and each is also available as a constructor prop (`planes`,
`network`) for the day those stacks are instantiated in the same app.

| Export | From | Why a NAME and not an ARN |
|---|---|---|
| `reconcile-planes-<env>-ClusterName` | `Planes` | The cluster ARN is derived beside the policy that fences on it |
| `reconcile-planes-<env>-ControlMigrateTaskFamily` · `-DataMigrateTaskFamily` | `Planes` | A task-definition ARN carries a **revision**, and a revision moves on every `Planes` deploy. `run-task` against a FAMILY takes the latest ACTIVE revision, and `arn:…:task-definition/<family>:*` is a fence that stays true |
| `reconcile-planes-<env>-ControlServiceTaskFamily` · `-DataServiceTaskFamily` | `Planes` | Same, for the revision the Deploy stage re-registers with the new digest |
| `reconcile-planes-<env>-ControlServiceName` · `-DataServiceName` | `Planes` | `ecs:UpdateService` is fenced to `service/<cluster>/<name>` — two named services, no wildcard |
| `reconcile-planes-<env>-ControlContainerName` · `-DataContainerName` | `Planes` | 🛑 **ONE AGREEMENT:** for each plane, the container carrying the plane's image must have the **same name** in the service task definition and in the migrate task definition. One export then serves both, and a mismatch is a loud failure rather than a silent re-register of the old image |
| `reconcile-network-<env>-PrivateSubnetIds` (comma-joined) | `Network` | `ecs run-task` on Fargate takes an `awsvpcConfiguration` |
| `reconcile-network-<env>-ControlPlaneSecurityGroupId` · `-DataPlaneSecurityGroupId` | `Network` | **Two, not one.** G193's plane boundary is topology; a migration running in the other plane's security group would be the first thing here to cross it |

🛑 **THE CONSEQUENCE, STATED RATHER THAN DISCOVERED AT A DEPLOY.**
`Fn::ImportValue` resolves at **deploy** time, not at synth. So `cdk synth` and
`npm run check` are unaffected — nothing reaches the network, no context lookup
is performed, and `tests/infra/manifest.test.mjs` still passes — **and
`cdk deploy reconcile-pipeline-staging` now fails with `No export named
reconcile-planes-staging-ClusterName found` until `Network` and `Planes` are
deployed.** That changes the deploy order of a stack that is live today, and it
is the honest direction: a Deploy stage pointed at invented names would deploy
cleanly and serve the same purpose as no stage at all.

## The things you must supply before a deploy

| | |
|---|---|
| **The CodeConnections connection** | It **cannot be created by CDK** — it is born `PENDING` and needs a console handshake to reach `AVAILABLE`. Create it once against `1CloudHub/Reconcile`, then pass its ARN as the `CodeConnectionArn` parameter. There is no default: a deploy without one stops and asks |
| **`Owner` and `CostCentre`** | ✅ **FILLED by the product owner, 18 Sep 2026** — `phani@1cloudhub.com` / `ReconcileAI`. ⚠️ **THIS ROW SAID they *"ship as placeholders"* and that `tests/infra/tag-aspect.test.mjs` *"asserts they are still unfilled"*. Both went false when they were filled**; that assertion was INVERTED in the same commit and now refuses a placeholder, which is what the old test asked for. Nothing is owed here before a deploy |

## Commands

```bash
# From the repository root. Both are inside `npm run check` (G259).
npm run typecheck:infra
npm run synth:infra

# Deploy, in this order. The CI image goes FIRST and is WITNESSED before the
# pipeline is pointed at it — G258 is explicit that a machine added to the gate
# without a demonstrated red is the same defect as a checker added without one.
npm --prefix infra exec cdk deploy reconcile-ci-image \
  --parameters CodeConnectionArn=arn:aws:codeconnections:us-west-2:000000000000:connection/<id>

#   ... then start the `reconcile-ci-image` build, and inside the resulting
#   image run `tests/ci/reachability-guards.test.ts` ONCE WITH CHROMIUM REMOVED
#   (expect RED) and once with it present (expect GREEN). Only then:

#   ... and then the `Network` and `Planes` stacks, which are ANOTHER SLICE'S
#   and are not in this app. The pipeline stack now IMPORTS their exports for
#   its Migrate and Deploy stages, so a deploy before they exist stops with
#   `No export named reconcile-planes-staging-ClusterName found`. That is the
#   correct failure and it is a change to this order, not a regression.

npm --prefix infra exec cdk deploy reconcile-pipeline-staging \
  --parameters CodeConnectionArn=arn:aws:codeconnections:us-west-2:000000000000:connection/<id>
```

`cdk bootstrap` against `aws://000000000000/us-west-2` is a precondition of the
first deploy and is not run by any script here.

## How `cdk synth` stays deterministic and offline

G108 requires everything in `npm run check` to be deterministic and fast, so
synth must not reach the network. Three things hold that, and each is checked:

1. **No construct performs a context lookup.** The account and the region are
   literals in `lib/config.ts`; nothing resolves a VPC, an AMI, a hosted zone or
   an existing repository from the account. `tests/infra/manifest.test.mjs`
   scans every `.ts` and `.mjs` under `infra/` for a lookup call — over source
   with comments stripped, because the first version of that scan fired on its
   own prose.
2. **`--no-lookups` is passed anyway**, so a lookup added later fails loudly
   instead of succeeding on a machine with credentials and failing on one
   without. The same test follows the script delegation and asserts the flag.
3. **`--no-notices`, `--no-version-reporting`, `--no-path-metadata` and
   `--no-asset-metadata`.** The first is the only one of the four that is about
   the network — the CLI otherwise fetches a notices document — and the other
   three keep the synthesised templates byte-stable across machines.

> ⚠️ **THIS PARAGRAPH READ *"No asset is staged: every buildspec is inline
> text, so there is no Docker build and no S3 upload at synth time."* THE
> FIRST CLAUSE WENT FALSE ON 19 Sep 2026 AND IS CORRECTED RATHER THAN DELETED**,
> because it is the sentence a reader would have trusted when deciding whether
> a deploy needs a bootstrap bucket.
>
> **ONE asset is staged: `infra/lambda/tenant-key-minter/`**, G290's key-minting
> function. It is a **directory** asset — two `.mjs` files, no bundler, no
> esbuild, no Docker — so the three properties above are untouched: the asset
> hash is a content hash, synth copies files and reaches no network, and the
> templates stay byte-stable across machines. **What DOES change is the
> deploy:** `cdk deploy` now uploads a zip to the `CDKToolkit-reconcile`
> bootstrap bucket, so the bootstrap in *Preconditions* item 3 stopped being a
> formality for this stack and became a dependency. It already exists.
>
> Every buildspec is still inline text and there is still no Docker build at
> synth time.

## Why the manifest is separate

`aws-cdk-lib` and `constructs` must never enter the ROOT `package.json`. The
root's property, stated in the `Dockerfile`'s own header, is that
`npm ci --omit=dev` produces a container holding the driver and no compiler —
and that is the same property **G212** refused `@aws-sdk/client-s3` to protect.
G259 makes the separation a rule rather than a habit.

The cost is that a root `npm ci` installs nothing here. `ensure-deps.mjs` closes
that, and its header records why a root `postinstall` — the obvious fix — was
refused: npm runs lifecycle scripts during `npm ci --omit=dev` too, so it would
fire **inside the Docker build**, where `infra/` is not even copied.

## Files

```
bin/app.ts            the cdk.json entry point — `node bin/app.ts`, no build step
lib/app.ts            buildApp(), the one tree bin/ and every test synthesise
lib/config.ts         account, region, tags, names. Literals, never lookups
lib/tagging.ts        G260's Aspect. Throws at synth. Witnessed red in tests/infra/
lib/buildspecs.ts     the buildspecs, as YAML TEXT so the comments survive
lib/connections.ts    CodeConnections: the ARN parameter and the one escape hatch
lib/ci-image-stack.ts G258
lib/pipeline-stack.ts G257 — Source, Gate, Build. G108 is not amended
lib/network-stack.ts  G253 — one VPC, one NAT, the plane boundary as SGs
lib/data-stack.ts     G254 — two Aurora clusters, rotation, the shutdown schedule
lib/planes-stack.ts   G253 — two services, two run-tasks, EIGHT roles, and the
                      credential fence written over EXECUTION roles, not only
                      task roles
lib/storage-stack.ts  G287 — one object bucket per data plane, SSE-KMS with a
                      PER-TENANT key. The object fence is the MIRROR IMAGE of
                      G253's: nobody fetches an object on the container's
                      behalf, so the key belongs to the TASK role and the
                      execution role must never hold it. Read the ONBOARDING
                      GAP block at its head before quoting G287 as applied —
                      🟠 G290 CLOSED ONE OF ITS THREE QUESTIONS AND OPENED A
                      FOURTH, and the block says which
lambda/tenant-key-minter/  G290 — the ONLY code this app deploys. Two .mjs
                      files: `guards.mjs` (the intake, which refuses a tenant
                      id and is executed by tests/infra/tenant-key-minter.test.mjs)
                      and `index.mjs` (three KMS calls). It holds kms:CreateKey
                      and NOT kms:ScheduleKeyDeletion, and the split is argued
                      on TENANT_KEY_MINTER_FORBIDDEN_ACTIONS in the stack
lib/pipeline-stack.ts G257 — Source, Gate, Build, Migrate, Deploy. G108 is not
                      amended: migrate and deploy are SEPARATE STAGES after a
                      green gate, never steps inside one
lib/edge-certificate-stack.ts  G293 — one wildcard, us-east-1, DNS-validated.
                      It is a separate stack for exactly one reason and the
                      reason is the region
lib/edge-stack.ts     G293 — ONE distribution, the bundle over OAC and the data
                      plane through a CloudFront VPC ORIGIN. Read the box at its
                      head: the ruling's argument is NEGATIVE — no preflight is
                      ever made, so no OPTIONS operation the wire does not
                      declare need ever exist (G200, G226). The reserved-label
                      guard is here and is witnessed RED by
                      test-fixtures/edge-reserved-label.ts; ⚠️ THE ENFORCEMENT
                      G179 ACTUALLY ASKS FOR IS A MINT-TIME RULE IN model/ AND
                      IT DOES NOT EXIST
lib/observability-stack.ts  G261 — the TENTH stack and the last of the ten to
                      be written. ONE SNS topic, EIGHT alarms, FOUR EventBridge
                      rules, VPC flow logs. 🛑 READ THE JOIN BEFORE CHANGING
                      ANYTHING: it adds NO OUTPUT to `Planes`, because CDK
                      mints a cross-stack export per ATTRIBUTE READ and a new
                      export there is a `Planes` DEPLOY — which G1012 measures
                      as rolling both planes back to an image ECR has expired.
                      The ECS names come from the NAMED exports; the ALB
                      dimension is derived from the already-exported ARN with
                      Fn::Select over Fn::Split, and `loadBalancerFullName` is
                      refused BY NAME. 🛑 THE TOPIC HAS NO SUBSCRIPTION AND
                      PAGES NOBODY (G1062) — an owner's ruling, output by the
                      stack and pinned by a test the subscribing commit must
                      delete. ⚠️ Two rows of tech-stack §12 are EventBridge
                      RULES and not alarms, because CloudWatch has no restart
                      counter and no exit-code metric (G1064)
ensure-deps.mjs       makes node_modules match the lockfile; no-op when it does
test-fixtures/        14 files — `ls infra/test-fixtures | wc -l`. ⚠️ THIS SAID
                      13 UNTIL G293 ADDED `edge-reserved-label.ts`, and
                      11 UNTIL G290 ADDED `storage-minter-forbidden-verb.ts`
                      and `storage-key-policy-lockout.ts`,
                      and before that "five one-difference-each fixtures, plus
                      a template dump" while the command already returned 9.
                      Two of the twelve are not fixtures at all —
                      `templates.ts` is the template dump and
                      `planes-stubs.ts` is a shared module
```

## 🛑 Preconditions that are NOT in the stack, and one that cost an afternoon

**1 · The account-level GitHub source credential, per region.** Run once, per
region, before `cdk deploy`:

```bash
aws codebuild import-source-credentials --server-type GITHUB \
  --auth-type CODECONNECTIONS --token <connection arn> --region us-west-2
```

**Why it is not in the CDK:** it is an account-level, region-scoped registration
rather than a stack resource, and `us-west-2` had none. `ap-southeast-1` has
carried one — a `PERSONAL_ACCESS_TOKEN` — since before this project, which is
how every other CodeBuild project in this account authenticates. **A deploy into
a fresh region will succeed and then fail at `DOWNLOAD_SOURCE` until this is
run there.**

**2 · INLINE source auth DOES NOT WORK IN THIS ACCOUNT, and the error is
actively misleading.** Setting `Source.Auth = {Type: CODECONNECTIONS, Resource:
arn}` on a project fails at **CreateProject** with:

```
OAuthProviderException: User is not authorized to access connection <arn>
```

**That sentence describes neither the user, nor authorization, nor really the
connection.** It is not IAM: CloudTrail records `OAuthProviderException` and
never `AccessDenied`; the calling principal holds `AdministratorAccess` and
`simulate-principal-policy` returns `allowed` for `PassConnection` and
`UseConnection`. It reproduces for a connection created seconds earlier, and for
two other connections in this account that have been `AVAILABLE` and **unused**
since before this project existed — three authorized connections, zero projects
using one, which is what a workaround looks like from the outside.

**Four wrong diagnoses were reached before the right one**, each consistent with
the error text: the connection is `PENDING`; an SCP blocks IAM users; the GitHub
App lacks the repository; the connection is bound to a personal-account
installation. **The thing that finally distinguished them was testing repos the
installation had ALWAYS had access to** — `QTransform-test` and `FivestarPE`
failed exactly as `Reconcile` did, which no repository-scope theory survives.

`infra/lib/connections.ts` carries the working shape, and
`codeConnectionsAuthOverride()` is now deliberately a no-op with that reasoning
on it.

**3 · A dedicated CDK bootstrap qualifier.** The account's default `CDKToolkit`
is from 2022 at version 15; this CDK needs 30+. Other projects here use their
own qualifiers (`atlas001`, `crmpp`), so this one does too rather than upgrading
a stack three teams share:

```bash
npx cdk bootstrap aws://000000000000/us-west-2 \
  --qualifier reconcile --toolkit-stack-name CDKToolkit-reconcile
```

`cdk.json` pins both, so no flag has to be remembered.

**4 · A rolled-back stack RETAINS the ECR repository.** `reconcile/ci-image`
survives a failed create and the next deploy then fails with *"already
exists"*. Delete it before retrying: `aws ecr delete-repository
--repository-name reconcile/ci-image --region us-west-2 --force`.

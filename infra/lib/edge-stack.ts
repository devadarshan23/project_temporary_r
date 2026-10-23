/**
 * `Edge` — G293, **AMENDED BY G297 ON 19 Sep 2026 AND BY G1011 ON 20 Sep 2026**.
 * TWO CLOUDFRONT DISTRIBUTIONS, TWO CERTIFICATES, TWO HOST GRAMMARS — AND THE
 * DATA PLANE AS A SECOND ORIGIN BEHIND THE TENANT ONE, REACHED BY **FOUR**
 * EXPLICIT PATH PATTERNS AND NEVER BY A CATCH-ALL.
 *
 * ⚠️ **THIS SAID THREE UNTIL 20 Sep 2026 AND `EDGE_PLANE_PATH_PATTERNS` HELD
 * FOUR WHEN IT WAS WRITTEN — G1092**, as did the deployed distribution and as
 * did `tests/infra/edge.test.mjs` §2, which asserts all four by name. It is
 * corrected rather than deleted because this is the first sentence of the file
 * that decides what this product publishes to the internet, and a reader
 * auditing that surface counts from here. Derive it, never read it:
 * `grep -oE "'/[^']*'" <(grep 'EDGE_PLANE_PATH_PATTERNS = \[' infra/lib/config.ts) | wc -l`
 *
 * This is the first thing in this repository a browser can reach.
 *
 * ┌─ 🛑 THIS HEADER READ *"ONE CLOUDFRONT DISTRIBUTION, A WILDCARD ────────────┐
 * │ CERTIFICATE"* AND THE FILE SERVED EVERY TENANT AT `{tenant}.reconcileai.   │
 * │ app`. IT IS CORRECTED RATHER THAN DELETED. G293's FLAT DECISION WAS TAKEN  │
 * │ DELIBERATELY AND BUILT DELIBERATELY — THE AGENT THAT BUILT IT FLAGGED THE  │
 * │ CONTRADICTION IN ITS REPORT RATHER THAN QUIETLY WIDENING. **THIS IS AN     │
 * │ AMENDMENT, NOT A MISTAKE ERASED.**                                        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * **WHAT WAS WRONG.** G293 ruled a flat `*.reconcileai.app`. **G179 and G183
 * both predate it and both rule otherwise** — `{tenant}.{region}.{domain}`, one
 * wildcard per region — and G179 states the cost of the flat form in its own
 * voice, a month before anybody built this:
 *
 * > *"A flat wildcard is cryptographically valid in EVERY region, so an EU
 * > tenant misrouted to a US plane FAILS OPEN AND IS INVISIBLE; a region label
 * > makes that misroute fail closed at TLS."*
 *
 * **WHAT G297 BUYS, AND IT IS THE REASON THE COST IS ACCEPTED.** A per-region
 * wildcard fails **CLOSED**: a misrouted tenant cannot complete the handshake.
 * **Residency — invariant 7 — becomes a TRANSPORT-layer property rather than an
 * application check**, which is the same posture invariant 7 already takes on
 * model routing and G287 takes on erasure: a property held by construction
 * rather than by a sweep somebody has to remember to run.
 *
 * ┌─ 🛑 TWO GRAMMARS, AND THEY DIFFER ON PURPOSE. DO NOT TIDY THEM INTO ONE. ──┐
 * │                                                                            │
 * │   TENANTS   {slug}.us-west-2.reconcileai.app   *.us-west-2.reconcileai.app │
 * │   CONSOLES  console.reconcileai.app            *.reconcileai.app           │
 * │             partners.reconcileai.app                                       │
 * │                                                                            │
 * │ **A REGION LABEL ON A CONSOLE HOST WOULD ASSERT A RESIDENCY THE CONTROL    │
 * │ PLANE DOES NOT HAVE.** The label binds a TENANT's data residency; a console │
 * │ has no tenant — which is why G277 was blocked at all — and invariant 3 says │
 * │ the control plane holds no tenant data. The label would be decorative **in  │
 * │ the one place decoration is most likely to be read as meaning something.**  │
 * │ `EDGE_CONSOLE_HOSTS` in `lib/config.ts` carries the long form.              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 **WHY TWO DISTRIBUTIONS, WHEN G293 SAID ONE AND MEANT IT.** G293's "one"
 * was a refusal of **one distribution PER TENANT** — *"onboarding a row insert
 * rather than a fifteen-minute CloudFront deploy"* — and that refusal is
 * untouched: tenants still share one distribution and creating a tenant still
 * touches no infrastructure. The second distribution here is **fixed, not
 * per-tenant**, and it is FORCED rather than chosen: **CloudFront reads exactly
 * one viewer certificate per distribution**, so two certificates cannot sit on
 * one distribution, and one certificate carrying both names would be valid for
 * `ten-acme.reconcileai.app` — which is the fail-open G297 exists to end.
 * **Two grammars → two certificates → two distributions. The arrow runs one
 * way and every step of it is AWS's, not ours.**
 *
 * ⚠️ **THE CONSOLE DISTRIBUTION PRESERVES A PROPERTY RATHER THAN ADDING ONE.**
 * `console.reconcileai.app` answered `200` on 19 Sep 2026 under G293's flat
 * wildcard. Narrowing the tenant distribution to the region grammar and
 * stopping there would have taken that away silently. It serves the BUNDLE
 * only: **the control plane is still not an origin anywhere in this file**, so
 * invariant 3 and G200 are exactly where G293 left them.
 *
 * ┌─ 🛑 THE RULING'S ARGUMENT IS THE DESIGN, AND IT IS A NEGATIVE ONE ─────────┐
 * │ G293: *"It DISSOLVES a G200 question rather than answering one.            │
 * │ `mountTier()` takes every route from the contract and THE CONTRACT         │
 * │ DECLARES NO `OPTIONS`, so answering a CORS preflight would be mounting an  │
 * │ operation the wire does not declare. A second origin behind one            │
 * │ distribution means NO PREFLIGHT IS EVER MADE, so no `OPTIONS` need ever    │
 * │ exist."*                                                                   │
 * │                                                                            │
 * │ Derive the premise, do not trust this comment:                             │
 * │   grep -rc '^\s*options:' docs/contracts/*.openapi.yaml    -> 0, all tiers │
 * │                                                                            │
 * │ And it is NOT a development convenience promoted to architecture. G226     │
 * │ already said so: *"under G179 one host serves one tenant, so production is │
 * │ same-origin regardless; the proxy makes dev match the shape production     │
 * │ already has."* `frontend/vite.config.ts` proxies `/v1`; this stack routes  │
 * │ `/v1/*`. Same shape, two deployments.                                      │
 * │                                                                            │
 * │ ⚠️ **AND "SAME SHAPE" WAS THE DEFECT RATHER THAN THE ASSURANCE — G1011.**   │
 * │ All three mirrors — this stack, the Vite proxy and                         │
 * │ `tests/e2e/single-origin.ts` — forwarded `/v1` and nothing else, so all    │
 * │ three agreed and all three were wrong in the same place, and the agreement │
 * │ is why nobody saw it. **Two of the three are repaired here**; the Vite     │
 * │ proxy is `frontend/`'s and is named in the commit rather than edited.      │
 * │                                                                            │
 * │ ✅ **AND THE THIRD IS CLOSED — G1093, 20 Sep 2026. THE TWO SENTENCES       │
 * │ ABOVE ARE KEPT RATHER THAN DELETED, because the second is what the         │
 * │ follow-up slice was commissioned against and the first is still exactly    │
 * │ right about why nobody saw it.** `frontend/vite.config.ts` no longer       │
 * │ SPELLS the list — it IMPORTS `EDGE_PLANE_PATH_PATTERNS`, as                │
 * │ `tests/e2e/single-origin.ts` already did — so **there is one statement of  │
 * │ which paths reach a plane and no mirror left to drift.** The sentence      │
 * │ above it, *"`frontend/vite.config.ts` proxies `/v1`; this stack routes     │
 * │ `/v1/*`. Same shape, two deployments"*, is therefore history: one          │
 * │ constant, two consumers. `tests/app/dev-proxy-mirrors-the-edge.test.mjs`   │
 * │ holds it, in both directions.                                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE PLANES STAY INTERNAL AND THAT IS HELD BY A VPC ORIGIN, NOT BY A CIDR.
 * `docs/build/deploy-handoff.md` §2: *"Neither ALB has an ingress rule. Nothing
 * can reach them, deliberately: only a CloudFront VPC origin should, and the
 * `Edge` stack is not written. AN ALB ADMITTING THE VPC CIDR 'FOR NOW' IS A
 * FENCE NOBODY REMOVES."* Both load balancers are `internetFacing: false` in
 * private subnets; this stack adds exactly ONE ingress rule to ONE of them,
 * whose source is the security group CLOUDFRONT ITSELF created — see
 * `AlbIngressFromVpcOrigin` below, which is the only genuinely awkward thing in
 * this file and says why in its own place.
 *
 * ⚠️ THE CONTROL PLANE IS NOT AN ORIGIN HERE. It has an ALB, it is healthy, and
 * it is deliberately unreachable from the internet: `administration.openapi.yaml`
 * declares 59 operations and `mountTier()` is never called for that tier, so an
 * origin pointed at it would route the public internet to a process that 404s
 * everything. G200 freezes the served set at four. **Adding the console's
 * origin is a slice that begins when an operation is mounted, not before.**
 *
 * ┌─ ✅ **THE CONSOLE DISTRIBUTION HAS A DATA-PLANE ORIGIN SINCE 22 Sep 2026 — ┐
 * │ G1949/G1950, UNDER THE OWNER'S S7 RULING — AND THE PARAGRAPH ABOVE IS     │
 * │ CORRECTED RATHER THAN DELETED, BECAUSE IT IS THE ONE THAT NAMES THE       │
 * │ CONDITION AND THE CONDITION IS EXACTLY WHAT WAS MET.**                    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * *"Adding the console's origin is a slice that begins when an operation is
 * mounted, not before."* **`resolveHomeRealm` is mounted** —
 * `server/data-plane/start.ts`, `session` tier — and this is that slice.
 *
 * 🛑 **AND THE PARAGRAPH'S ARGUMENT IS UNTOUCHED, BECAUSE IT IS ABOUT THE
 * CONTROL PLANE AND THIS ORIGIN IS THE DATA PLANE'S.** Read the two clauses
 * separately, because they are one sentence and two different facts:
 *
 *   · *"an origin pointed at IT would route the public internet to a process
 *     that 404s everything"* — the antecedent is the CONTROL plane's ALB, and
 *     it is still true of it: `server/control-plane/start.ts` mounts
 *     `listEntitledPacks` and nothing else, so 135 of 136 declared operations
 *     would 404 there. **The control plane is still not an origin anywhere in
 *     this file** — derive it, never read it:
 *     `grep -cE '^[^*]*controlLoadBalancer' infra/lib/edge-stack.ts` → 0.
 *     ⚠️ **THE `^[^*]*` IS NEW — G2173, 28 Sep 2026.** The bare form answered
 *     **1** against a stated **0**, and the one line it found was this
 *     sentence: a block-comment line opens ` *`, so excluding it is the
 *     whole repair. The false form is not restated, because restating it
 *     here would make the answer 2.
 *   · *"G200 freezes the served set at four"* — that clause was already stale
 *     when this slice arrived and is named rather than absorbed: the data
 *     plane serves twenty-six before this commit and twenty-seven after it.
 *     Derive it: `grep -rn 'handlers:' server --include start.ts`.
 *
 * ⚠️ **AND THIS ORIGIN IS ONE PATTERN, NOT FOUR.** The tenant distribution's
 * four publish `/v1/*` and `/context/*`; a console host carries no tenant
 * label, so `resolveServingHost()` resolves nothing. ⚠️ **THIS CLAUSE ENDED
 * *"and G180 revokes the session on a host mismatch"* AND THAT REASON IS WRONG
 * — G1991: the `__Host-` cookie is host-only, so the request arrives with no
 * session and is answered 401 before a host is read; a console session at its
 * own host matches and is not revoked. The decisive argument is the SPA
 * rewrite.** `EDGE_CONSOLE_PLANE_PATH_PATTERNS` in `lib/config.ts` carries the
 * full correction.
 *
 * ⚠️ **ONE `AWS::CloudFront::VpcOrigin`, SHARED — NOT A SECOND ONE.** The two
 * distributions bind the same `origins.VpcOrigin` instance, so the resource is
 * created once and referenced twice, and **`AlbIngressFromVpcOrigin` below
 * needs no second rule**: CloudFront's `CloudFront-VPCOrigins-Service-SG` is
 * per VPC rather than per distribution. A second VPC origin would be a second
 * set of ENIs and a second thing to keep in step for no property gained.
 *
 * 🛑 **AND SHARING IT CREATES AN ORDERING DEPENDENCY THAT IS INVISIBLE AT BOTH
 * CALL SITES — G1992, 22 Sep 2026, RECORDED RATHER THAN REMOVED.** CDK derives
 * the `AWS::CloudFront::VpcOrigin` logical id from the construct path of the
 * distribution that binds it **FIRST** — here the TENANT distribution, because
 * it is declared above. So:
 *
 *   · **Renaming or re-pathing the TENANT distribution construct changes the
 *     VpcOrigin's logical id**, which CloudFormation implements as a REPLACE:
 *     a new VPC origin is created and the old one deleted.
 *   · **That updates the CONSOLE distribution as a side effect**, because its
 *     behaviour points at the same resource — a change to a construct nobody
 *     touched, in a stack nobody was editing, on the path that serves
 *     `/session/realm`.
 *   · **And re-ORDERING the two declarations has the same effect** without any
 *     rename at all: bind the console distribution first and the id moves to
 *     its path.
 *
 * ⚠️ **IT IS NOT A REASON TO SPLIT THE ORIGIN** — a second VpcOrigin is a
 * second set of ENIs and a second thing to keep in step, which is the trade
 * the paragraph above already took. It is a reason to know that **the tenant
 * distribution's construct id is load-bearing for the console one**, and
 * `tests/infra/edge.test.mjs` pins the shared-origin shape so the replacement
 * shows up as a diff rather than as a surprise in a deploy.
 *
 * ⚠️ **THAT PARAGRAPH ENDED *"`CONSOLE_HOST` already resolves to this
 * distribution through the wildcard, so the day it is mounted the change is one
 * behaviour and no DNS"* AND G297 MAKES IT FALSE IN THE CHEAP DIRECTION.** The
 * console host now resolves to a distribution of its own, by a NAMED record —
 * so the day an administration operation is mounted the change is one behaviour
 * on `ConsoleDistribution` and still no DNS. **The claim survives; the
 * distribution it pointed at does not.** It is corrected rather than deleted
 * because it is the sentence that tells the next slice what it will and will
 * not have to touch.
 *
 * ┌─ 🛑 AMENDED AGAIN ON 20 Sep 2026 — G1011, DERIVED AND NOT THE OWNER'S. ────┐
 * │ **THE TENANT DISTRIBUTION ROUTED `/v1/*` AND NOTHING ELSE, SO THE          │
 * │ OPERATION THAT BINDS A SESSION TO A TENANT WAS UNREACHABLE FROM THE        │
 * │ INTERNET.** Measured against the deployed distribution, not reasoned:      │
 * │                                                                            │
 * │   POST /context/resolve -> 403 text/html                 (CloudFront)      │
 * │   POST /v1/runs         -> 401 application/problem+json   (the plane)      │
 * │   aws cloudfront get-distribution-config --id E37L34MTF5K0VB               │
 * │     -> CacheBehaviors: [ '/v1/*' ]   one behaviour, that is all            │
 * │                                                                            │
 * │ The cause is structural rather than a typo: `basePathOf()` reads a tier's  │
 * │ FIRST `servers[].url`, so `capability.openapi.yaml` serves under `/v1`     │
 * │ while `foundation.openapi.yaml` and `session.openapi.yaml` serve at the    │
 * │ ROOT. **A catch-all is the WRONG repair** — `data-plane-local.openapi.yaml`│
 * │ serves at the root too and `checkLocalHealth` is mounted — so the patterns │
 * │ are explicit and a synth-time guard refuses any that would publish one.    │
 * │ `EDGE_PLANE_PATH_PATTERNS` in `lib/config.ts` carries the whole argument.  │
 * │                                                                            │
 * │ ⚠️ **AND THE FOUR PATTERNS ARE ON THE TENANT DISTRIBUTION ONLY. THE        │
 * │ CONSOLE ONE REACHES NO PLANE AT ALL AND THIS SLICE DOES NOT CHANGE THAT**  │
 * │ — measured, not inferred: `get-distribution-config --id EPT1B88M3QIBB` →   │
 * │ `CacheBehaviors.Quantity: 0`, one origin, the bundle. **So the console     │
 * │ hosts are not merely unrouted, they are UNROUTABLE**, which is exactly     │
 * │ where G293 and G297 left them and is the honest state while                │
 * │ `administration.openapi.yaml` and `platform-console.openapi.yaml` mount    │
 * │ nothing. Adding a plane origin there is the slice that begins when an      │
 * │ operation is mounted, not before.                                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 🛑 WHAT THIS STACK DOES NOT DO, STATED SO IT IS A GAP AND NOT AN OVERSIGHT ┐
 * │ · ✅ **THE BUNDLE IS UPLOADED — BY THE PIPELINE, NOT BY THIS STACK        │
 * │   (G993, 20 Sep 2026).** ⚠️ THIS ENTRY READ *"NOTHING UPLOADS THE BUNDLE"* │
 * │   and is corrected rather than deleted, because the reasoning under it is  │
 * │   unchanged and is why the upload is somewhere else: there is still no     │
 * │   `BucketDeployment` here — it is a Lambda-backed custom resource that     │
 * │   would put a second copy of the bundle in a CDK asset bucket and make     │
 * │   `cdk synth` depend on `frontend/dist` existing, coupling the gate's      │
 * │   synth to the gate's build. **The Deploy stage of                         │
 * │   `reconcile-pipeline-staging` is where an upload belongs and it now does  │
 * │   it**, with `aws s3 sync … --delete` and an invalidation of BOTH          │
 * │   distributions. ⚠️ **AND IT COSTS THIS STACK A REDEPLOY**: the two        │
 * │   distribution ids are published as NAMED EXPORTS below, and the pipeline  │
 * │   imports them, so `reconcile-edge-staging` must be deployed once more     │
 * │   BEFORE `reconcile-pipeline-staging` can deploy against them.             │
 * │ · ✅ **THE FRONTEND TALKS TO ITS OWN ORIGIN — G991, 20 Sep 2026.**         │
 * │   ⚠️ THIS ENTRY READ *"THE FRONTEND CANNOT YET TALK TO ITS OWN ORIGIN …    │
 * │   `frontend/src/api/plane.ts` carries `DEFAULT_ORIGIN =                    │
 * │   'http://127.0.0.1:8080'` … the file is ANOTHER AGENT'S FENCE today, so   │
 * │   the gap is named rather than filled"*, and it is corrected rather than   │
 * │   deleted because the instruction inside it is still binding. That         │
 * │   constant is now the PAGE'S OWN ORIGIN in a browser and the local plane   │
 * │   only where there is no page. 🛑 **THE INSTRUCTION HELD: `https://*.      │
 * │   reconcileai.app` IS NOT IN THAT ALLOW-LIST** — derive it over the ARRAY  │
 * │   and not over the file, whose PROSE names hosts:                          │
 * │   `awk '/^export const PERMITTED_ORIGINS/,/^]/' frontend/src/api/plane.ts  │
 * │   | grep -c reconcileai` -> 0 — and                                        │
 * │   the point of G293 is exactly that no absolute origin is needed. ⚠️ ONE   │
 * │   DIVERGENCE FROM THE WORDS *"a relative `/v1`"*: a bare relative string   │
 * │   does not parse where `planeEndpoint()` builds its `URL`, so the page's   │
 * │   origin is spelled absolutely. `plane.ts`'s header measures it.           │
 * │ · **NO WAF, NO ACCESS LOGS, NO RESPONSE-HEADERS POLICY.** None is ruled.   │
 * │   A managed `SECURITY_HEADERS` policy ships a `Content-Security-Policy`    │
 * │   this application has never been loaded under, and shipping a CSP nobody  │
 * │   has tested is how a blank page reaches production. Owed, not done.       │
 * │ · **NO `us-east-1` OBSERVABILITY.** CloudFront's own metrics and the       │
 * │   function's logs land in `us-east-1`; `Observability` is unwritten.       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 WHERE `Edge` SITS IN THE DEPLOY ORDER, AND TWO OF THE FOUR EDGES ARE
 * ENFORCED BY CLOUDFORMATION WHILE TWO ARE NOT:
 *
 *     Network  ->  Data  ->  Planes  ->  Storage
 *                             |
 *                             +------->  EdgeCertificate  ->  Edge
 *
 *   · `Planes` BEFORE `Edge` — ENFORCED. This stack takes the data ALB by
 *     CONSTRUCT REFERENCE, so CloudFormation writes the `Fn::ImportValue` and
 *     refuses the deploy if the export is absent. ⚠️ THE PRICE IS THAT `Planes`
 *     MUST BE UPDATED FIRST to publish that export, and `Planes` carries a
 *     required `PlaneImageTag` parameter: deploy it with the previous value,
 *     never with a guess. 🛑 **THAT LAST CLAUSE WENT FALSE AND WAS DANGEROUS
 *     WHILE IT WAS TRUE — G1012, 20 Sep 2026.** *"The previous value"* is
 *     precisely what `cdk deploy` reuses when it is given nothing, and the
 *     pipeline moves the SERVICE without ever writing it: measured at
 *     CloudFormation's revision 1 against the service's revision 38. There is
 *     no parameter now — the tag is CDK context and synth throws without one:
 *     `cdk deploy reconcile-planes-staging -c planeImageTag=<commit sha>`,
 *     derived with `node tests/e2e/probe-deployed-image.mjs`.
 *   · `Network` BEFORE `Edge` — ENFORCED, same mechanism: the ALB security
 *     group is a construct reference and the ingress rule below imports it.
 *   · `EdgeCertificate` BEFORE `Edge` — ENFORCED BY CDK rather than by
 *     CloudFormation, through `crossRegionReferences`. The two stacks are in
 *     two regions, so there is no `Fn::ImportValue` to write; CDK publishes the
 *     ARN as an SSM parameter in `us-east-1` and reads it back with a custom
 *     resource here, and adds the stack dependency itself.
 *   · `Storage` and `Edge` DO NOT ORDER EACH OTHER. They share nothing. The
 *     `Planes` BEFORE `Storage` edge documented on `planeRoleName()` is
 *     unchanged and is still the one nothing enforces.
 */

import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as cr from 'aws-cdk-lib/custom-resources'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import type * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import * as s3 from 'aws-cdk-lib/aws-s3'
import type { Construct } from 'constructs'

import {
  AWS_REGION,
  CONSOLE_HOST,
  DATA_PLANE_PORT,
  EDGE_CONSOLE_PLANE_PATH_PATTERNS,
  EDGE_FLAT_WILDCARD_DOMAIN,
  EDGE_PLANE_PATH_PATTERNS,
  EDGE_TENANT_WILDCARD_DOMAIN,
  HOSTED_ZONE_ID,
  PARTNERS_HOST,
  ROOT_DOMAIN,
  RESERVED_HOST_LABELS,
  assertPublishesNoLocalOperation,
  edgeExportName,
  frontendBucketName,
  isReservedHostLabel,
  spaRewriteFunctionName,
} from './config.ts'
import type { Environment } from './config.ts'
import { applyRequiredTags } from './tagging.ts'

export interface EdgeStackProps extends StackProps {
  readonly environment: Environment
  /**
   * **THE TENANT VIEWER CERTIFICATE — `*.{region}.{domain}`, G297.**
   * `us-east-1`, always.
   *
   * 🛑 **IT MUST NOT BE THE CONSOLE ONE, AND THE WRONG ONE TYPE-CHECKS.** Both
   * are `acm.ICertificate`; only one of them is invalid for
   * `ten-acme.reconcileai.app`, and that invalidity IS the fail-closed
   * property. `tests/infra/edge.test.mjs` §1 asserts the two distributions
   * reference two different certificates because nothing else can.
   */
  readonly tenantCertificate: acm.ICertificate
  /**
   * **THE CONSOLE VIEWER CERTIFICATE — the flat `*.{domain}`, G293, kept by
   * G297.** It goes on the console distribution and on nothing else.
   */
  readonly consoleCertificate: acm.ICertificate
  /**
   * **D6-4, G1871.** The rate-limiting WebACL's ARN, from `EdgeCertificate`
   * (`us-east-1`, the same cross-region join the two certificates use). It
   * is a plain string rather than a typed construct reference because
   * `cloudfront.Distribution.webAclId` itself takes a bare `string` — CDK
   * has no `IWebAcl` interface for a CloudFront-scope WAF association.
   */
  readonly rateLimitWebAclArn: string
  /** The DATA plane's internal ALB. `Planes` owns it. */
  readonly dataLoadBalancer: elbv2.IApplicationLoadBalancer
  /** That ALB's security group. `Network` owns it. */
  readonly dataLoadBalancerSecurityGroup: ec2.ISecurityGroup
  /** The VPC the ALB is in - the search space for CloudFront's own group. */
  readonly vpc: ec2.IVpc
  /**
   * **Labels in the FLAT namespace** this stack should serve BY NAME, in
   * addition to the two the owner named.
   *
   * 🛑 IT IS EMPTY AND IT MUST STAY EMPTY FOR TENANTS. A named alias is a
   * public statement that a host exists; the wildcard is what keeps this
   * distribution from being a customer list. The prop exists so that
   * `assertNotAReservedLabel()` has a call site and so that
   * `infra/test-fixtures/edge-reserved-label.ts` can witness that refusal RED —
   * the same shape `StorageStackProps.tenantKeyHandles` uses for a factory
   * whose real list is also empty.
   *
   * ⚠️ **G297 CHANGED WHICH NAMESPACE THESE LABELS LIVE IN, AND THE PROP'S
   * DOCUMENTATION IS THE ONLY PLACE THAT CAN SAY SO.** Before G297 every label
   * was a tenant's possible host. Now a tenant is
   * `{slug}.us-west-2.reconcileai.app` and a label here is a **flat** host — a
   * platform surface, a marketing name, a redirect. See the guard below for
   * what that does to the reserved list's argument.
   */
  readonly extraHostLabels?: readonly string[]
  /**
   * Hosts the TENANT distribution should serve in addition to the per-region
   * wildcard.
   *
   * 🛑 IT IS EMPTY AND IT EXISTS FOR THE SAME REASON `extraHostLabels` DOES:
   * `assertCarriesRegionLabel()` is a guard over the real alias list, and a
   * guard that cannot be WITNESSED FAILING asserts nothing (`docs/HANDOFF.md`
   * §5.6). `infra/test-fixtures/edge-flat-tenant-host.ts` passes a flat host
   * through it and `tests/infra/edge.test.mjs` §4 requires synth to refuse.
   *
   * ⚠️ **IT IS VALIDATED AND NOT SERVED.** Nothing here reaches `domainNames` —
   * a prop that could quietly add an alias is a prop that could quietly add the
   * flat grammar back, which is the one thing this slice exists to prevent.
   */
  readonly extraTenantHosts?: readonly string[]
  /**
   * Path patterns this stack should route to the PLANE in addition to
   * `EDGE_PLANE_PATH_PATTERNS`.
   *
   * 🛑 IT IS EMPTY AND IT EXISTS FOR EXACTLY THE REASON `extraHostLabels` AND
   * `extraTenantHosts` DO: `assertPublishesNoLocalOperation()` is a guard, and
   * a guard that cannot be WITNESSED FAILING asserts nothing
   * (`docs/HANDOFF.md` §5.6). `infra/test-fixtures/edge-catch-all.ts` passes
   * `/*` through it and `tests/infra/edge.test.mjs` §2 requires synth to
   * refuse, naming `/health`, `/status` and `/metrics` in the message.
   *
   * ⚠️ **UNLIKE `extraTenantHosts`, THIS ONE IS SERVED AS WELL AS VALIDATED**,
   * and the difference is argued rather than accidental. A host prop that
   * reached `domainNames` could quietly restore the flat grammar G297 exists to
   * end; a path prop that reaches `additionalBehaviors` can only widen the
   * PLANE's public surface, which is precisely what the guard beside it reads
   * and refuses. A prop that validated and did not serve would put the guard on
   * a value nothing uses, which is a control pointed away from the thing it
   * protects.
   */
  readonly extraPlanePathPatterns?: readonly string[]
}

/**
 * 🛑 **THE REGION-LABEL GUARD, AND IT IS THE EXECUTABLE FORM OF G297.**
 *
 * A tenant host must carry the region label: `{slug}.us-west-2.reconcileai.app`.
 * A host without it is the G293 grammar, and **a certificate covering it is
 * cryptographically valid in every region** — G179: *"an EU tenant misrouted to
 * a US plane FAILS OPEN AND IS INVISIBLE."*
 *
 * ⚠️ **IT CHECKS THE SHAPE, NOT AN EQUALITY WITH THE CONSTANT THE STACK JUST
 * READ.** Comparing an alias to `EDGE_TENANT_WILDCARD_DOMAIN` would prove a
 * variable equals itself — the warning every `tests/infra/` suite carries at its
 * head, arriving inside production code. The property asserted is that the host
 * ends in `.{region}.{domain}`, which is true of every tenant host the grammar
 * can ever produce and false of every flat one.
 *
 * 🛑 **WHAT IT CANNOT SEE, SO NOBODY READS IT AS THE WHOLE CONTROL: THE
 * CERTIFICATE.** An alias carrying the region label with a FLAT certificate on
 * the distribution is still wrong — and it fails LOUDLY, because a one-label
 * wildcard cannot serve a two-label host, so the tenant host breaks outright
 * rather than failing open. **The silent direction is the flat alias, and that
 * is the direction this guard closes.** The certificate half is witnessed only
 * by `openssl s_client` against a live host.
 */
export function assertCarriesRegionLabel(host: string): void {
  const suffix = `.${AWS_REGION}.${ROOT_DOMAIN}`
  if (host.endsWith(suffix)) return
  throw new Error(
    `Edge: '${host}' is a TENANT host with no region label, which is the G293 grammar G297 ` +
      `corrected. G179: "A flat wildcard is cryptographically valid in EVERY region, so an EU ` +
      `tenant misrouted to a US plane FAILS OPEN AND IS INVISIBLE; a region label makes that ` +
      `misroute fail closed at TLS." A tenant host must end in ${suffix}. The consoles are the ` +
      'deliberate exception and they are served by a different distribution, a different ' +
      'certificate and a different grammar - see EDGE_CONSOLE_HOSTS in infra/lib/config.ts.',
  )
}

/**
 * 🛑 THE RESERVED-LABEL GUARD. It throws, at synth, on a label some other
 * surface already claims.
 *
 * `RESERVED_LABEL_CLAIMED_BY` in `lib/config.ts` carries the list and the claim
 * behind each entry, and says plainly what this function is NOT: **the
 * enforcement G179 asks for is a MINT-TIME RULE ON THE TENANT SLUG, in
 * `model/`, and it does not exist.** No tenant slug reaches this stack — that
 * is what the wildcard bought — so this guard can only refuse a label somebody
 * types HERE. It is the narrow half of the control, and the wide half is owed.
 *
 * ┌─ 🛑 G297: THE LIST STILL HOLDS, AND IT NOW GUARDS A DIFFERENT NAMESPACE. ──┐
 * │ **A reserved label protects the FLAT namespace, where the consoles and the │
 * │ marketing plane live. Tenants are no longer in it.**                       │
 * │                                                                            │
 * │ `console.us-west-2.reconcileai.app` collides with nothing: it is a          │
 * │ different host, under a different wildcard, on a different certificate. So  │
 * │ the specific defect this list was built for — a tenant slugged `console`    │
 * │ being handed the staff console's own host — **is now structurally           │
 * │ impossible through the host grammar, and the GRAMMAR is what prevents it,   │
 * │ not this list.**                                                           │
 * │                                                                            │
 * │ ⚠️ **THE MINT-TIME RULE G179 ASKS FOR IS THEREFORE WEAKER AND STILL OWED,  │
 * │ AND THOSE ARE TWO DIFFERENT STATEMENTS.** It was a correctness fence; it is │
 * │ now a hygiene fence with a dated fuse — G36/G276's BYOA and vanity domains  │
 * │ put a customer back into a flat namespace, and G180 makes whatever they get │
 * │ permanent. **Downgrading a control's severity is not discharging it.**      │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
export function assertNotAReservedLabel(label: string): void {
  if (!isReservedHostLabel(label)) return
  throw new Error(
    `Edge: '${label}' is a RESERVED host label and may not be served as a tenant or ` +
      'vanity host. G180 makes a host binding permanent and additive, so a collision ' +
      'has no migration path out of it - only a mass logout, a broken redirect_uri, a ' +
      'changed SAML entityID and every stored absolute URL orphaned. The reserved list ' +
      `and the claim behind each entry are in infra/lib/config.ts: ${RESERVED_HOST_LABELS.join(', ')}`,
  )
}

export class EdgeStack extends Stack {
  readonly bucket: s3.Bucket
  /** **THE TENANT DISTRIBUTION.** `*.{region}.{domain}`, bundle plus `/v1`. */
  readonly distribution: cloudfront.Distribution
  /** **THE CONSOLE DISTRIBUTION.** Flat, named hosts, bundle only. G297. */
  readonly consoleDistribution: cloudfront.Distribution

  constructor(scope: Construct, id: string, props: EdgeStackProps) {
    super(scope, id, props)

    const { environment, tenantCertificate, consoleCertificate, dataLoadBalancer } = props

    for (const label of props.extraHostLabels ?? []) assertNotAReservedLabel(label)

    /* 🛑 G297's GUARD, OVER THE REAL ALIAS LIST AND NOT OVER A COPY OF IT. The
     * wildcard itself goes through it, so the day somebody changes
     * `EDGE_TENANT_WILDCARD_DOMAIN` back to the flat form this throws at synth
     * and the gate is red before a deploy exists. */
    const tenantHosts = [EDGE_TENANT_WILDCARD_DOMAIN, ...(props.extraTenantHosts ?? [])]
    for (const host of tenantHosts) assertCarriesRegionLabel(host)

    /* 🛑 G1011's GUARD, OVER THE REAL PATTERN LIST AND NOT OVER A COPY OF IT —
     * the same shape as the line above, for the same reason. The three shipped
     * patterns go through it, so the day somebody "fixes" a 403 by widening
     * `EDGE_PLANE_PATH_PATTERNS` to `/*` the gate is red at `synth:infra`
     * before a deploy exists. */
    const planePathPatterns = [
      ...EDGE_PLANE_PATH_PATTERNS,
      ...(props.extraPlanePathPatterns ?? []),
    ]
    for (const pattern of planePathPatterns) assertPublishesNoLocalOperation(pattern)

    /* 🛑 THE SAME GUARD OVER THE CONSOLE LIST — G1949, 22 Sep 2026. One guard,
     * two call sites, and the second one is not decoration: `/health`,
     * `/status` and `/metrics` sit at the ROOT of the SAME process, so a
     * widening here publishes the plane's operational surface to the internet
     * exactly as a widening of the tenant list would. A guard applied to one
     * of two lists is a guard somebody will believe covers both. */
    for (const pattern of EDGE_CONSOLE_PLANE_PATH_PATTERNS) {
      assertPublishesNoLocalOperation(pattern)
    }

    // ------------------------------------------------- 1. the bundle bucket

    /**
     * The frontend bundle. `frontend/dist`, and nothing else, ever.
     *
     * ⚠️ `BLOCK_ALL` ON A BUCKET WHOSE CONTENTS ARE PUBLIC IS NOT A
     * CONTRADICTION — it is the difference between "the world may read these
     * bytes" and "the world may read this BUCKET". Under G263 there are no
     * static keys and no public ACLs: CloudFront reaches it with an ORIGIN
     * ACCESS CONTROL, a SigV4 signature from the CloudFront service principal
     * scoped to this one distribution. A direct `s3://` request is refused, so
     * there is exactly one path to these bytes and it is the one with the
     * certificate on it.
     *
     * ⚠️ SSE-S3, NOT A KMS KEY, AND THE CONTRAST WITH G287 IS THE ARGUMENT.
     * G287 puts a key PER TENANT on the object bucket so that *"residency and
     * erasure are properties of the key rather than of a delete loop"*. Neither
     * word applies here: this bucket holds the bytes we serve to the entire
     * internet, there is no tenant to erase, and a customer-managed key would
     * add a key policy, a grant for the CloudFront service principal and a
     * monthly cost in exchange for encrypting a public JavaScript bundle.
     */
    this.bucket = new s3.Bucket(this, 'Frontend', {
      bucketName: frontendBucketName(environment),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      /* ⚠️ NO VERSIONING, AND IT IS A DECISION RATHER THAN A DEFAULT. The
       * bundle's version is the COMMIT that built it; S3 versioning would be a
       * second history of the same artefact, with its own retention question
       * and its own cost, disagreeing with the first one the moment somebody
       * syncs by hand. A rollback is a re-sync of an older build. */
      versioned: false,
      /* 🛑 RETAIN, AND TRAP 3 OF deploy-handoff.md §3 IS THE CONSEQUENCE: *"A
       * rolled-back stack RETAINS resources and the next deploy fails with
       * already exists."* The bucket name is deterministic, so a failed first
       * deploy strands exactly this name. The recovery is one command and it is
       * written here so nobody has to work it out at the time:
       *   aws s3 rb s3://<name> --force --region us-west-2
       * DESTROY was refused: it needs an auto-delete custom resource holding
       * `s3:DeleteObject*` on a bucket, which is a Lambda with a delete verb
       * added to make a teardown convenient. */
      removalPolicy: RemovalPolicy.RETAIN,
    })

    // --------------------------------------------- 2. the SPA rewrite

    /**
     * 🛑 THE DEEP-LINK REWRITE, AND THE REASON IT IS A BEHAVIOUR-SCOPED
     * FUNCTION RATHER THAN A DISTRIBUTION-WIDE ERROR RESPONSE.
     *
     * `frontend/src/routes/` declares TWELVE routes and the bundle is
     * client-rendered, so `GET /runs` asks S3 for a key that does not exist and
     * S3 answers 403 through an OAC. The obvious repair — CloudFront
     * `errorResponses` mapping 403 and 404 to `/index.html` with a 200 — is
     * **wrong here and quietly so: custom error responses are
     * DISTRIBUTION-WIDE.** They would rewrite the data plane's 404s too, and
     * this product has **136** declared operations of which **four** are
     * mounted — ⚠️ `docs/build/deploy-handoff.md` §5.3 says 135 and was one
     * behind before this slice touched anything, which is named so this
     * sentence is not read as accounting for it. Derive both, never read them
     * (`grep -h 'operationId:' docs/contracts` against
     * `grep -rn 'handlers:' server`). ⚠️ NEITHER DERIVATION IS SPELLED WITH A
     * GLOB IN IT, AND THAT IS NOT FUSSINESS: a shell glob ending a path segment
     * closes a block comment, and the compiler then reports `TS2304: Cannot
     * find name` at a line of ordinary prose — the same misdirection
     * `tests/infra/manifest.test.mjs` records for a backtick inside a buildspec
     * template literal, arriving in a comment instead. Every one of the other 127
     * would stop being a 404 and start being an HTML page with status 200 — all
     * 132 of them —
     * G191's *"a declared operation with no handler 404s"* turned into a lie by
     * an edge setting, in the direction that hides it.
     *
     * A function attached to ONE BEHAVIOUR cannot do that. The `/v1/*`
     * behaviour below carries no function at all, so nothing between the
     * browser and the plane touches a plane response.
     *
     * The rule is the narrowest one that works: a final path segment with no
     * dot in it is a route, not a file. `/runs` rewrites; `/assets/app-a1b2.js`
     * does not; `/` rewrites, because its final segment is empty.
     */
    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      functionName: spaRewriteFunctionName(environment),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'G293 SPA deep links. Attached to the bundle behaviour only, never to /v1/*.',
      code: cloudfront.FunctionCode.fromInline(
        [
          'function handler(event) {',
          '  var request = event.request;',
          '  var uri = request.uri;',
          '  var last = uri.substring(uri.lastIndexOf("/") + 1);',
          '  if (last.indexOf(".") === -1) { request.uri = "/index.html"; }',
          '  return request;',
          '}',
        ].join('\n'),
      ),
    })

    // ------------------------------------------ 3. the plane as an origin

    /**
     * 🛑 A VPC ORIGIN. THE ALB STAYS INTERNAL AND NO SECURITY GROUP EVER ADMITS
     * A CIDR.
     *
     * CloudFront places elastic network interfaces inside this VPC and reaches
     * the private ALB through them, so the load balancer needs no public
     * address, no public subnet and no rule admitting the internet. The
     * alternative shapes were both refused before this file was written: an
     * internet-facing ALB (the planes stop being internal), and an internal ALB
     * admitting the VPC CIDR (*"a fence nobody removes"*).
     *
     * ⚠️ HTTP, NOT HTTPS, BETWEEN CLOUDFRONT AND THE ALB, AND IT IS NOT RULED.
     * `lib/planes-stack.ts` says the same thing from its end: *"The listeners
     * are plaintext inside the VPC … G183's certificate is the `Edge` stack's.
     * Stated so nobody reads `internetFacing: false` as encrypted."* TLS
     * terminates at CloudFront. The hop from a CloudFront ENI to the ALB is
     * inside one VPC and is plaintext. **That is a real property and not a
     * claim that it is fine** — making it HTTPS needs a certificate on the ALB
     * for a name that resolves inside the VPC, which is a ruling nobody has
     * taken.
     *
     * THE PORT IS THE PLANE'S, NOT 80. `DATA_PLANE_PORT` is the same constant
     * the listener, the target group and `compose.yaml` use; the listener has a
     * default action and no rules, so this port IS the routing.
     */
    const planeOrigin = origins.VpcOrigin.withApplicationLoadBalancer(dataLoadBalancer, {
      httpPort: DATA_PLANE_PORT,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      vpcOriginName: `reconcile-${environment}-data-plane`,
      readTimeout: Duration.seconds(30),
      keepaliveTimeout: Duration.seconds(5),
    })

    // ------------------------------------------------ 4. the distribution

    /**
     * ONE BEHAVIOUR PER PATTERN, AND EVERY ONE OF THEM IS THE SAME OBJECT.
     *
     * 🛑 **THE SETTINGS ARE STATED ONCE AND SPREAD**, rather than written out
     * four times. Four copies of `CACHING_DISABLED` + `ALL_VIEWER` is
     * `docs/HANDOFF.md` §5.3 — two implementations of one rule, and the one
     * that drifts is always the copy — and what would drift here is a
     * TENANT-ISOLATION control: a FIFTH pattern added with `CACHING_OPTIMIZED`
     * because somebody pasted the BUNDLE behaviour is a cross-tenant read
     * performed by a CDN. `tests/infra/edge.test.mjs` §2 asserts the four
     * settings on EVERY plane behaviour rather than on the first one.
     */
    const planeBehaviourSettings: cloudfront.BehaviorOptions = {
      origin: planeOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
    }

    const planeBehaviours: Record<string, cloudfront.BehaviorOptions> = Object.fromEntries(
      planePathPatterns.map((pattern) => [pattern, planeBehaviourSettings]),
    )

    /**
     * 🛑 THE CONSOLE DISTRIBUTION'S PLANE BEHAVIOURS — G1949, 22 Sep 2026 —
     * AND THEY ARE THE **SAME OBJECT** AS THE TENANT ONES RATHER THAN A COPY
     * OF THEM.
     *
     * The paragraph above says a fifth pattern pasted with `CACHING_OPTIMIZED`
     * would be a cross-tenant read performed by a CDN. **A second
     * distribution's behaviour map is the same risk with a longer fuse**: it
     * is out of sight of the assertion that reads the first one, so the drift
     * would be invisible to §2 of `tests/infra/edge.test.mjs` as it was
     * written. Spreading one object is what makes the two maps the same
     * decision; **the PATTERNS differ and the SETTINGS do not**, which is
     * exactly the split this slice wants.
     */
    const consolePlaneBehaviours: Record<string, cloudfront.BehaviorOptions> = Object.fromEntries(
      EDGE_CONSOLE_PLANE_PATH_PATTERNS.map((pattern) => [pattern, planeBehaviourSettings]),
    )

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `G293 reconcile ${environment}: the bundle and the data plane behind one distribution`,
      /**
       * 🛑 ONE ALIAS, AND IT IS A WILDCARD. That single line is what makes
       * onboarding a row insert rather than a fifteen-minute CloudFront deploy
       * — G293's own reason for refusing a distribution per tenant — and it is
       * what keeps every tenant name out of the public record. A named alias
       * per tenant would be readable through `cloudfront:ListDistributions`,
       * and the certificate SAN it would need would be readable by everybody.
       *
       * ⚠️ **THIS READ `[EDGE_WILDCARD_DOMAIN]` — `*.reconcileai.app` — UNTIL
       * 19 Sep 2026, AND THE CHANGE OF ONE CONSTANT IS THE WHOLE OF G297 AT
       * THIS LAYER.** The paragraph above is unchanged and still true: it is
       * still one alias, still a wildcard, still no customer in the public
       * record. **What changed is which hosts it is valid for.** The old alias
       * served `ten-acme.reconcileai.app`; this one serves
       * `ten-acme.us-west-2.reconcileai.app` and refuses the flat form at the
       * HANDSHAKE — a misrouted tenant never reaches a byte of application
       * code, which is invariant 7 held by the certificate instead of by a
       * check somebody has to write.
       */
      domainNames: [EDGE_TENANT_WILDCARD_DOMAIN],
      certificate: tenantCertificate,
      /* TLS 1.2 or nothing. The bucket already refuses below 1.2 for its own
       * traffic (`enforceSSL`), and a viewer policy weaker than the origin's
       * would make the public half the weakest link. */
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      /**
       * 🛑 D6-4, G1871 — THE TENANT DISTRIBUTION ONLY. `webAclId` TAKES AN
       * ARN DESPITE ITS NAME (AWS's own CloudFormation property, carried
       * through unchanged by the L2).
       *
       * ⚠️ **NOT ON `consoleDistribution` BELOW, AND THAT IS ARGUED RATHER
       * THAN AN OVERSIGHT.** The finding this rule closes is pool
       * exhaustion on the DATA plane's database connections
       * (`docs/build/d6-threat-model.md` §1.3/§4.5); the console
       * distribution has no plane origin at all — see its own header,
       * *"NO `/v1` behaviour, and the control plane is still not an
       * origin"* — so it cannot reach that pool through any request
       * shape. Adding a rate limit there would defend against a threat
       * this document never measured, under a G-row that did not rule
       * on it.
       */
      webAclId: props.rateLimitWebAclArn,
      defaultRootObject: 'index.html',

      /**
       * THE BUNDLE. Origin access control, never an origin access identity and
       * never a public bucket: OAC is SigV4, is scoped to this distribution,
       * and needs no key anywhere (G263).
       */
      defaultBehavior: {
        /* ⚠️ ONE `as IBucket`, AND IT IS THE `exactOptionalPropertyTypes` SEAM
         * `planes-stack.ts` already documents twice for `ICluster` and
         * `ISecret`. `Bucket` declares `isWebsite: boolean | undefined` while
         * `IBucket` declares it optional; under that flag those are different
         * types even though every concrete `Bucket` satisfies the interface.
         * Narrowed here, at one site, rather than by weakening the flag. */
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket as s3.IBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },

      additionalBehaviors: {
        /**
         * ┌─ 🛑 THE SECOND ORIGIN. READ ALL THREE OF THESE BEFORE CHANGING ONE ┐
         * │                                                                    │
         * │ **CACHING IS DISABLED, AND IT IS A TENANT-ISOLATION CONTROL RATHER │
         * │ THAN A PERFORMANCE SETTING.** A CloudFront cache key does not       │
         * │ include the `Host` header unless a cache policy says so. Under G179 │
         * │ one host serves one tenant and every tenant reaches THIS            │
         * │ distribution, so a cached `/v1/runs` keyed on path alone would      │
         * │ serve one tenant's response to another tenant's browser — a         │
         * │ cross-tenant read, performed by a CDN, invisible to every control   │
         * │ in `db/` and `model/` because no query ever runs. `CACHING_DISABLED`│
         * │ makes that unrepresentable rather than merely unlikely. **A future  │
         * │ slice that wants caching here must put `Host` in the cache key and  │
         * │ must say so out loud.**                                            │
         * │                                                                    │
         * │ **`ALL_VIEWER` FORWARDS THE `Host` HEADER, WHICH IS THE WHOLE       │
         * │ MECHANISM OF G179 AT THIS LAYER.** By default CloudFront replaces   │
         * │ `Host` with the ORIGIN's domain name, so the plane would see the    │
         * │ ALB and `resolveServingHost()` would resolve nothing. G293: *"Tenant│
         * │ identity comes from the `Host` header … the distribution forwards   │
         * │ it; it does not interpret it."* This policy is that sentence.       │
         * │                                                                    │
         * │ **EVERY METHOD IS ALLOWED**, because the capability tier declares   │
         * │ POST, PATCH and DELETE operations. `ALLOW_GET_HEAD` here would      │
         * │ answer a mounted write with a status no contract declares.          │
         * │ ⚠️ **THIS SAID `405` UNTIL 22 Sep 2026 AND THE NUMBER WAS NEVER     │
         * │ MEASURED — G2025.** CloudFront refuses a method outside             │
         * │ `AllowedMethods` with **403 `MethodNotAllowed`**, at the edge,       │
         * │ before the origin is asked and before a viewer-request function     │
         * │ runs. **The measurement is eleven lines below, in this same block:** │
         * │ *"`POST /context/resolve` answered 403 from CloudFront for the      │
         * │ whole life of this stack"* — a POST falling to the GET/HEAD-only    │
         * │ DEFAULT behaviour, which is the identical shape. The argument for   │
         * │ `ALLOW_ALL` is unchanged and is if anything stronger: a 403 on a    │
         * │ declared write is harder to tell from an authorisation refusal      │
         * │ than a 405 would be.                                                │
         * │                                                                    │
         * │ ⚠️ **THIS SAID "THE SECOND ORIGIN" AND DESCRIBED ONE BEHAVIOUR      │
         * │ UNTIL 20 Sep 2026 — G1011.** There is still exactly ONE plane       │
         * │ origin and the three paragraphs above are unchanged about it; what  │
         * │ moved is that FOUR PATTERNS reach it, because `/v1` is one tier's   │
         * │ base path and the foundation and session tiers serve at the ROOT.   │
         * │ ⚠️ **SAID THREE UNTIL 20 Sep 2026 WHILE THE CONSTANT HELD FOUR AND  │
         * │ LINE 4 OF THIS FILE SAID THREE TOO — G1092.** `/session` and        │
         * │ `/session/*` are two patterns because CloudFront's `/session/*`     │
         * │ does not match `/session`, exactly as `/v1/*` does not match `/v1`. │
         * │ `POST /context/resolve` answered **403 from CloudFront** for the    │
         * │ whole life of this stack. See `EDGE_PLANE_PATH_PATTERNS`.           │
         * └────────────────────────────────────────────────────────────────────┘
         */
        ...planeBehaviours,
      },
    })

    // ------------------------------- 4b. the console distribution (G297)

    /**
     * ┌─ 🛑 THE SECOND DISTRIBUTION. IT EXISTS BECAUSE OF ONE AWS FACT AND ────┐
     * │ NOT BECAUSE OF A DESIGN PREFERENCE: **CLOUDFRONT READS EXACTLY ONE     │
     * │ VIEWER CERTIFICATE PER DISTRIBUTION.**                                 │
     * └────────────────────────────────────────────────────────────────────────┘
     *
     * G297 rules two host grammars and two certificates. Two certificates
     * cannot sit on one distribution, and ONE certificate carrying both names
     * would be valid for `ten-acme.reconcileai.app` — **which is exactly the
     * fail-open the ruling exists to end.** So the second distribution is
     * forced by the first two decisions rather than added beside them.
     *
     * ⚠️ **G293's *"ONE DISTRIBUTION"* IS NOT OVERTURNED AND THE DIFFERENCE
     * MATTERS.** What G293 refused was a distribution **PER TENANT** —
     * *"onboarding a row insert rather than a fifteen-minute CloudFront
     * deploy"*. That refusal is untouched: this one is FIXED, it serves the two
     * hosts the owner named on 19 Sep 2026, and creating a tenant still writes
     * no DNS record, issues no certificate and deploys no distribution.
     *
     * 🛑 **NAMED ALIASES, NOT THE FLAT WILDCARD, AND THIS IS THE LINE THAT
     * CARRIES THE WHOLE RULING.** `*.reconcileai.app` would be the obvious
     * alias here — the certificate covers it and it is what G293 shipped. **It
     * would also make this distribution answer for
     * `ten-acme.reconcileai.app` with a VALID certificate**, handing the
     * fail-open straight back at a second resource while every other file in
     * this slice still claimed the property. Two names, spelled out, so the
     * flat namespace serves the two platform surfaces and **nothing else**.
     *
     * ⚠️ **NAMING THEM IN A CERTIFICATE SAN OR AN ALIAS DISCLOSES NOTHING THE
     * CT ARGUMENT CARES ABOUT.** `EDGE_CERTIFICATE_TRANSPARENCY` refuses a
     * per-TENANT name because a tenant is a CUSTOMER. `console` and `partners`
     * are ours, they are already in `administration.openapi.yaml` as declared
     * servers, and they name no customer at all.
     *
     * ⛔ **THIS READ *"🛑 NO `/v1` BEHAVIOUR, AND THE CONTROL PLANE IS STILL
     * NOT AN ORIGIN. This distribution has exactly one origin: the bundle"*
     * UNTIL 22 Sep 2026 AND IS CORRECTED RATHER THAN DELETED, because it is
     * the sentence `tests/infra/edge.test.mjs` selected this distribution BY
     * and the one a reader auditing the console surface would have trusted.**
     *
     * **It has TWO origins from G1949: the bundle and the DATA plane.** What
     * survives whole is every clause about the CONTROL plane — that ALB is
     * still not an origin anywhere in this file, `mountTier()` is still never
     * called for the administration tier, and **invariant 3 is still where
     * G293 left it.** ⚠️ **The clause *"G200 freezes the served set at four"*
     * was stale before this slice and is named rather than absorbed**: derive
     * it with `grep -rn 'handlers:' server --include start.ts`.
     *
     * 🛑 **AND THE SELECTOR THAT BROKE IS THE FINDING, NOT THE COST.**
     * `tests/infra/edge.test.mjs` told the two distributions apart by *"the
     * one with a `VpcOriginConfig`"* and *"the one where every origin has
     * none"*, which was a LANDMARK standing in for the property — §5.1, in the
     * suite that guards the internet-facing surface. Both selectors were
     * witnessed RED by this commit and both are re-keyed onto the thing that
     * actually distinguishes them: the ALIAS GRAMMAR.
     *
     * ⚠️ **THE SPA FUNCTION IS SHARED, NOT COPIED.** A CloudFront function may
     * be associated with many distributions; a second one would need a second
     * account-globally-unique name (trap 6) to do the identical thing. It stays
     * scoped to a BUNDLE behaviour on both distributions and is attached to no
     * `/v1` behaviour anywhere, which is the property `tests/infra/edge.test.mjs`
     * §2 asserts.
     */
    this.consoleDistribution = new cloudfront.Distribution(this, 'ConsoleDistribution', {
      comment: `G297 reconcile ${environment}: the FLAT console hosts. No region label, no tenant, no plane origin`,
      domainNames: [CONSOLE_HOST, PARTNERS_HOST],
      certificate: consoleCertificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket as s3.IBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },

      /**
       * ┌─ 🛑 THE CONSOLE DISTRIBUTION REACHES THE DATA PLANE — G1949/G1950, ─┐
       * │ 22 Sep 2026, UNDER THE OWNER'S S7 RULING. **ONE PATTERN.**          │
       * └─────────────────────────────────────────────────────────────────────┘
       *
       * The ruling: *"the marketing plane is on Amplify at the apex, and
       * `/lookup` proxies SAME-ORIGIN to the data plane through the CONSOLE
       * CloudFront distribution."* This is that origin.
       *
       * 🛑 **`EDGE_CONSOLE_PLANE_PATH_PATTERNS` IS A SEPARATE CONSTANT AND
       * REUSING `planePathPatterns` WOULD BE A DEFECT.** Those four publish
       * `/v1/*` and `/context/*` — every tenant-scoped operation — and a
       * console host carries no tenant label, so `resolveServingHost()`
       * resolves nothing (G179, a LOOKUP).
       *
       * ⚠️ **THIS ENDED *"and G180 revokes the session on a host mismatch on
       * every request. Pointing the tenant surface here would not merely 404;
       * it would sign people out."* THAT REASON IS WRONG — G1991, 22 Sep 2026
       * — and it is corrected here rather than deleted because it stood in
       * four places.** The `__Host-` prefix makes the session cookie
       * HOST-ONLY, so a tenant cookie is never sent to a console host: the
       * request arrives with no session, the `onRequest` hook answers **401
       * `session_invalid`** before a host is read, and G180 never runs. A
       * console session at its own console host MATCHES, so there is no
       * revoke there either. Past authentication the answer is **403
       * `tenant_context_missing`**. **Nobody is signed out.**
       *
       * 🛑 **THE DECISION STANDS ON THE SPA REWRITE INSTEAD, which is the
       * decisive argument and is in the paragraph below**: an unserved path
       * routed here is answered by the BUNDLE with a 200 and an HTML body
       * rather than a 404. `lib/config.ts`'s header carries the full
       * correction, including why it is the exact path `/session/realm`
       * rather than the `/session/*` prefix.
       *
       * 🛑 **AND THIS BEHAVIOUR IS PUBLISHED ON TWO HOSTS, NOT ONE — G1997,
       * 22 Sep 2026, AND EVERY DOCUMENT NAMED ONLY THE FIRST.** This
       * distribution's `domainNames` is `[CONSOLE_HOST, PARTNERS_HOST]`, so
       * `POST /session/realm` is reachable at **`console.reconcileai.app`
       * AND `partners.reconcileai.app`** — derive it, never read it:
       * `grep -n 'domainNames' infra/lib/edge-stack.ts`.
       *
       * ⚠️ **IT IS NOT A DEFECT AND IT IS NOT NOTHING.** `resolveHomeRealm`
       * reads NO host: it takes a domain from the body, resolves through
       * `withRealmScope()`, and `checkHostBinding()` is never reached
       * because there is no session to bind. **So the two hosts answer
       * identically, by construction rather than by coincidence** — there is
       * no per-host arm anywhere in `server/data-plane/realm.ts` for one to
       * diverge from. A partner and a customer asking about the same domain
       * get the same answer, which is what `routeToConnection()` already
       * says: *"Routing chooses the door; the door decides."*
       *
       * 🛑 **WHAT IT DOES MEAN IS THAT THE D6 REGISTER'S ORACLE HAS TWO FRONT
       * DOORS, AND A THROTTLE THAT COVERED ONE WOULD COVER HALF.** The
       * sweep cost in `server/data-plane/realm.ts` §(2) and the missing rate
       * limit in §(4) are both per-distribution facts, and this is one
       * distribution — so a WAF attached here covers both hosts, which is
       * the convenient direction. **Named so the next reader does not
       * discover the second host while writing the throttle.**
       *
       * ⚠️ **AND THE SETTINGS ARE THE TENANT BEHAVIOUR'S, SPREAD FROM ONE
       * OBJECT RATHER THAN RETYPED** — §5.3, and here the thing that would
       * drift is a tenant-isolation control. `CACHING_DISABLED` matters even
       * on a host with no tenant: `resolveHomeRealm` is a **POST**, and a
       * cache that answered one caller's domain lookup to another would be an
       * oracle with a memory. `ALL_VIEWER` forwards `Host`, which is what
       * `server/data-plane/serving-hosts.ts` reads.
       *
       * ⚠️ **THE SPA FUNCTION IS NOT ATTACHED TO THIS BEHAVIOUR**, exactly as
       * it is not attached to the four on the tenant distribution — and here
       * that is the whole reason the behaviour is needed. `SpaRewrite`
       * rewrites any URI whose last segment has no dot to `/index.html`, and
       * `realm` has no dot, so **without this entry a `POST /session/realm` on
       * a console host is answered by the BUNDLE with a 200 and an HTML
       * body.**
       */
      additionalBehaviors: consolePlaneBehaviours,
      /* G2770 — the owner's ruling: the console plane paths go "under the
       * existing WAF rate rule". The ⚠️ on the tenant distribution's
       * `webAclId` refused this while the console had no pool-reaching path;
       * it has four now. */
      webAclId: props.rateLimitWebAclArn,
    })

    // ------------------------------------- 5. the one ingress rule

    /**
     * ┌─ 🛑 THE AWKWARD PART, AND IT IS AWKWARD IN AWS RATHER THAN HERE ───────┐
     * │ Creating a VPC origin makes CloudFront create a security group in this │
     * │ VPC called `CloudFront-VPCOrigins-Service-SG`, and the ALB must admit  │
     * │ traffic FROM that group or every request is a 502. **CloudFormation    │
     * │ does not return its id** — `AWS::CloudFront::VpcOrigin` has no such    │
     * │ attribute — so there is nothing to reference and the group does not    │
     * │ exist until the deploy is already under way.                          │
     * │                                                                        │
     * │ THE THREE OPTIONS, AND WHY THIS ONE:                                   │
     * │  · `ec2.PrefixList.fromLookup(...)` for the CloudFront origin-facing   │
     * │    prefix list — REFUSED OUTRIGHT: it is a context lookup, it reaches  │
     * │    AWS at synth, and `tests/infra/manifest.test.mjs` fails the gate on │
     * │    that call form. It is also the wrong fence: those are CloudFront's  │
     * │    PUBLIC egress addresses, and a VPC origin's ENIs have private ones. │
     * │  · A rule admitting the VPC CIDR — refused by name in                  │
     * │    `deploy-handoff.md` §2.                                             │
     * │  · ASK `ec2:DescribeSecurityGroups` AT DEPLOY TIME for the group       │
     * │    CloudFront just made, and admit exactly it. That is this.           │
     * │                                                                        │
     * │ ⚠️ IT IS A CUSTOM RESOURCE, SO IT IS A LAMBDA, AND THE FIRST QUESTION  │
     * │ IS TRAP 6. `AwsCustomResource` does not set a `FunctionName`, so       │
     * │ CloudFormation generates one within its own limits rather than CDK     │
     * │ deriving a 76-character name from a construct path. Nothing to set.    │
     * │                                                                        │
     * │ ⚠️ THE DEPENDENCY IS ON THE DISTRIBUTION AND IT IS LOAD-BEARING. The   │
     * │ group is created when the VPC origin is, so asking before that is a    │
     * │ describe returning zero groups and a stack rolling back on             │
     * │ `SecurityGroups.0.GroupId`. **If this ever fails that way, the fix is  │
     * │ a retry of the same deploy, not a CIDR.**                              │
     * └────────────────────────────────────────────────────────────────────────┘
     */
    const vpcOriginGroup = new cr.AwsCustomResource(this, 'VpcOriginSecurityGroup', {
      onCreate: {
        service: 'ec2',
        action: 'describeSecurityGroups',
        parameters: {
          Filters: [
            { Name: 'vpc-id', Values: [props.vpc.vpcId] },
            { Name: 'group-name', Values: ['CloudFront-VPCOrigins-Service-SG'] },
          ],
        },
        physicalResourceId: cr.PhysicalResourceId.of('CloudFront-VPCOrigins-Service-SG'),
      },
      onUpdate: {
        service: 'ec2',
        action: 'describeSecurityGroups',
        parameters: {
          Filters: [
            { Name: 'vpc-id', Values: [props.vpc.vpcId] },
            { Name: 'group-name', Values: ['CloudFront-VPCOrigins-Service-SG'] },
          ],
        },
        physicalResourceId: cr.PhysicalResourceId.of('CloudFront-VPCOrigins-Service-SG'),
      },
      /* `ec2:DescribeSecurityGroups` takes no resource ARN - AWS supports no
       * resource-level permission for it, so a narrower Resource would be a
       * fence that reads as tighter than it is. It is a READ and it creates,
       * modifies and deletes nothing. */
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      installLatestAwsSdk: false,
    })
    vpcOriginGroup.node.addDependency(this.distribution)

    new ec2.CfnSecurityGroupIngress(this, 'AlbIngressFromVpcOrigin', {
      groupId: props.dataLoadBalancerSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: DATA_PLANE_PORT,
      toPort: DATA_PLANE_PORT,
      sourceSecurityGroupId: vpcOriginGroup.getResponseField('SecurityGroups.0.GroupId'),
      /* ⚠️ NO APOSTROPHE AND NO EM-DASH. Trap 2: EC2 validates this string
       * against a charset cdk synth does not check, and this record's house
       * style uses both characters everywhere else. */
      description: 'G293: CloudFront VPC origin only. Never a CIDR (deploy-handoff.md section 2).',
    })

    // ------------------------------------------------------- 6. the DNS

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: HOSTED_ZONE_ID,
      zoneName: ROOT_DOMAIN,
    })

    /**
     * 🛑 ONE WILDCARD RECORD PER GRAMMAR, AND IT REMOVES AN ORACLE RATHER THAN
     * SAVING WORK.
     *
     * With `*.us-west-2.reconcileai.app` pointed here,
     * `acme.us-west-2.reconcileai.app` and
     * `no-such-tenant.us-west-2.reconcileai.app` resolve identically, so a DNS
     * probe distinguishes a customer from a stranger not at all. Per-tenant A
     * records would put that distinction back — NXDOMAIN versus an answer is a
     * clean yes/no about whether a company is a customer — **even under a
     * wildcard certificate.** The certificate and the DNS have to agree or the
     * property is only half bought.
     *
     * It also means onboarding writes no DNS record, which is G183's actual
     * argument for a wildcard: *"provisioning a tenant WRITES NO DNS RECORD AND
     * ISSUES NO CERTIFICATE, so tenant creation stays a control-plane database
     * act with no infrastructure step and no propagation wait."*
     *
     * ⚠️ **THESE TWO RECORDS NAMED `*.reconcileai.app` UNTIL 19 Sep 2026.** The
     * construct ids are kept — a Route 53 alias record is replaced on a name
     * change either way, and renaming the construct as well would delete and
     * recreate two records for no gain.
     *
     * ┌─ 🛑 AND THAT RENAME COST A DNS RECORD IN STAGING. TRAP, MEASURED, NOT ─┐
     * │ REASONED — 19 Sep 2026, THE DEPLOY THAT APPLIED G297.                  │
     * │                                                                        │
     * │ **RENAMING A `Route53::RecordSet` WHILE ANOTHER CONSTRUCT TAKES OVER    │
     * │ ITS OLD NAME IS A CREATE AND A DELETE OF THE SAME DNS NAME IN ONE       │
     * │ CHANGESET, AND THE DELETE CAN LAND LAST.** `WildcardA` moved from       │
     * │ `*.reconcileai.app` to `*.us-west-2.reconcileai.app` — which            │
     * │ CloudFormation performs as CREATE-new then DELETE-old — while           │
     * │ `FlatSinkholeA` below was creating `*.reconcileai.app`. Both reported   │
     * │ success. **The A record was GONE afterwards; the AAAA survived, which   │
     * │ is the same race winning the other way and is why this reads as         │
     * │ nondeterministic rather than as a rule.** Measured:                     │
     * │   aws route53 list-resource-record-sets --hosted-zone-id Z04053259WLMQ… │
     * │ returned the AAAA and not the A, with both resources CREATE_COMPLETE.   │
     * │                                                                        │
     * │ **THE REPAIR IS AN UPDATE, NOT A RE-CREATE**: touching any mutable      │
     * │ property of the surviving construct makes CloudFormation re-issue an    │
     * │ UPSERT, and Route 53 upserts are idempotent. Deleting and re-adding the │
     * │ construct would ask CloudFormation to DELETE a record that is not       │
     * │ there.                                                                  │
     * │                                                                        │
     * │ ⚠️ **NOTHING IN `npm run check` CAN SEE THIS.** The template was right, │
     * │ the synth was right, the deploy reported success, and the only witness  │
     * │ was `dig`. It is trap 10 of `deploy-handoff.md` §3 — *"a synthesised    │
     * │ policy is not a policy the service has accepted"* — arriving at         │
     * │ Route 53, where the service accepted BOTH calls and the ORDER was the   │
     * │ defect.                                                                 │
     * └────────────────────────────────────────────────────────────────────────┘
     */
    new route53.ARecord(this, 'WildcardA', {
      zone,
      recordName: EDGE_TENANT_WILDCARD_DOMAIN,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      comment: 'G297 per-region tenant wildcard. One record for every tenant, so DNS enumerates nobody.',
    })
    new route53.AaaaRecord(this, 'WildcardAaaa', {
      zone,
      recordName: EDGE_TENANT_WILDCARD_DOMAIN,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      comment: 'G297 per-region tenant wildcard, IPv6. The distribution answers on both.',
    })

    /**
     * ┌─ 🛑 THE FLAT WILDCARD IS KEPT AND IT IS NOW A SINKHOLE. READ THIS ─────┐
     * │ BEFORE DELETING IT AS DEAD, BECAUSE IT LOOKS LIKE DEAD WEIGHT AND IT   │
     * │ IS THE THING THAT MAKES THE FAIL-CLOSED PROPERTY OBSERVABLE.           │
     * └────────────────────────────────────────────────────────────────────────┘
     *
     * `*.reconcileai.app` still points at the TENANT distribution, whose
     * certificate is `*.us-west-2.reconcileai.app` and which claims no flat
     * alias at all. So a request to `ten-acme.reconcileai.app`:
     *
     *   · **RESOLVES** — no NXDOMAIN, so DNS still answers nothing about who is
     *     a customer. `EDGE_CERTIFICATE_TRANSPARENCY` argues that at length and
     *     it survives G297 unchanged.
     *   · **FAILS AT THE TLS HANDSHAKE** — CloudFront finds no distribution
     *     claiming that name, presents a certificate that does not match, and
     *     the client refuses before a single byte of HTTP is written.
     *
     * **That is G179's fail-closed property, and keeping this record is what
     * makes it a TLS failure rather than a DNS failure.** Both are refusals;
     * only one of them is the refusal the ruling describes, and only one of
     * them can be demonstrated without also proving the host does not exist.
     *
     * ⚠️ **THE NAMED CONSOLE RECORDS BELOW WIN OVER THIS WILDCARD**, because
     * DNS resolves the most specific match first. The sinkhole therefore covers
     * every flat label EXCEPT the two that are genuinely served — which is
     * exactly the set that should fail.
     */
    new route53.ARecord(this, 'FlatSinkholeA', {
      zone,
      recordName: EDGE_FLAT_WILDCARD_DOMAIN,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      comment: 'G297 sinkhole: resolves so DNS is not an oracle, fails at TLS so a flat tenant host cannot be served.',
    })
    new route53.AaaaRecord(this, 'FlatSinkholeAaaa', {
      zone,
      recordName: EDGE_FLAT_WILDCARD_DOMAIN,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      comment: 'G297 sinkhole, IPv6. Same refusal on both address families.',
    })

    /**
     * 🛑 THE TWO CONSOLE HOSTS, BY NAME, AT THE CONSOLE DISTRIBUTION.
     *
     * **They are named rather than wildcarded for the same reason their alias
     * is**: a flat wildcard record pointed at a distribution holding a flat
     * wildcard certificate would serve `ten-acme.reconcileai.app` with a valid
     * handshake. The flat namespace has exactly two served hosts and they are
     * both written down.
     *
     * ⚠️ **NO REGION LABEL, AND THAT IS THE ASSERTION RATHER THAN THE
     * SHORTCUT.** A console has no tenant; a region label on it would claim a
     * residency invariant 3 says the control plane does not have. G297 states
     * it and `EDGE_CONSOLE_HOSTS` in `lib/config.ts` carries the long form.
     */
    for (const [id, host] of [
      ['Console', CONSOLE_HOST],
      ['Partners', PARTNERS_HOST],
    ] as const) {
      new route53.ARecord(this, `${id}A`, {
        zone,
        recordName: host,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(this.consoleDistribution),
        ),
        comment: 'G297 flat console host. No region label: a console has no tenant to place.',
      })
      new route53.AaaaRecord(this, `${id}Aaaa`, {
        zone,
        recordName: host,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(this.consoleDistribution),
        ),
        comment: 'G297 flat console host, IPv6.',
      })
    }

    applyRequiredTags(this, environment, 'edge')

    // --------------------------------------------------------- 7. outputs

    new CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'The TENANT CloudFront domain. Every *.us-west-2 host is an alias of it. G297.',
    })
    new CfnOutput(this, 'ConsoleDistributionDomainName', {
      value: this.consoleDistribution.distributionDomainName,
      description: 'The FLAT console CloudFront domain. console. and partners. only. G297.',
    })
    /**
     * 🛑 G992, 20 Sep 2026 — THE TWO IDs THE DEPLOY STAGE INVALIDATES, PUBLISHED
     * AS **NAMED** EXPORTS.
     *
     * ⚠️ AN `exportName` IS A COMMITMENT AND NOT A LABEL: once another stack
     * imports one, CloudFormation refuses to delete or rename it while the
     * import stands, and `reconcile-pipeline-staging` imports both. That is the
     * intended direction — the pipeline's frontend half must fail LOUDLY if the
     * edge is torn down, rather than invalidate a distribution that no longer
     * exists — and it is stated here because the next person to rename an output
     * in this file will meet it as a failed `cdk deploy` of a stack they were
     * not editing.
     *
     * ⚠️ AND THE ORDER IS REAL: this stack must be deployed once to publish
     * these before the pipeline stack can deploy against them.
     * `infra/lib/config.ts`'s `EDGE_EXPORT_KEYS` carries the argument; the
     * bucket deliberately needs no export at all, because its name is a pure
     * function of the environment.
     */
    new CfnOutput(this, 'TenantDistributionId', {
      value: this.distribution.distributionId,
      exportName: edgeExportName(environment, 'TenantDistributionId'),
      description:
        'The TENANT distribution. The Deploy stage invalidates it after syncing the bundle.',
    })
    new CfnOutput(this, 'ConsoleDistributionId', {
      value: this.consoleDistribution.distributionId,
      exportName: edgeExportName(environment, 'ConsoleDistributionId'),
      description:
        'The CONSOLE distribution. It serves the SAME bucket, so invalidating only the ' +
        'tenant one leaves the consoles on the previous index.html.',
    })
    /**
     * ⚠️ THIS DESCRIPTION READ *"Empty until somebody syncs frontend/dist into
     * it. Nothing here does."* AND ITS SECOND SENTENCE IS STILL EXACTLY TRUE OF
     * THIS STACK — nothing here uploads anything, and `BucketDeployment` is
     * still refused for the reason this file's header gives. What changed on
     * 20 Sep 2026 is that something ELSE does it: `reconcile-pipeline-staging`'s
     * Deploy stage, under G993. The first sentence is therefore no longer a
     * statement about the product, only about this template.
     */
    new CfnOutput(this, 'FrontendBucketName', {
      value: this.bucket.bucketName,
      description:
        'Nothing in THIS stack syncs into it; the pipeline Deploy stage does (G993). ' +
        'No export: the name is a pure function of the environment, in config.ts.',
    })
    new CfnOutput(this, 'TenantHostGrammar', {
      value: `{tenant}.${EDGE_TENANT_WILDCARD_DOMAIN.slice(2)}`,
      description:
        'G179 and G297. A misrouted tenant fails at the TLS handshake, not at an application check.',
    })
    new CfnOutput(this, 'ConsoleHost', { value: CONSOLE_HOST, description: 'G277 named, unbuilt.' })
    new CfnOutput(this, 'PartnersHost', {
      value: PARTNERS_HOST,
      description: 'G277 named, unbuilt.',
    })
    new CfnOutput(this, 'PlanePathPatterns', {
      value: planePathPatterns.join(' '),
      description:
        'The only paths that leave this distribution for a plane. Everything else is the ' +
        'bundle - including /health, /status and /metrics, which are the plane process own ' +
        'and must never be published (G1011).',
    })
  }
}

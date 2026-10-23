/**
 * The app. One function, so that `bin/app.ts`, `cdk synth` and every test
 * synthesise the SAME tree — a test that builds its own app is a test of a
 * second app.
 *
 * ⚠️ WHAT IS HERE AND WHAT IS NOT. THIS COMMENT READ *"This pass is CI/CD only:
 * `CiImage` and `Pipeline`"* AND LISTED `Network` AND `Data` AMONG FIVE STACKS
 * THAT WERE *"absent because they are blocked on rulings that are not taken
 * (G277's organisation-scoped console host; G276's BYOA shape)"*. **Two of the
 * five landed on 18 Sep 2026 and the sentence is corrected here rather than
 * deleted**, because it is the sentence that tells a reader which stacks exist.
 *
 * **FOUR STACKS:** `CiImage` (G258), `Pipeline` (G257), **`Network` (G253) and
 * `Data` (G254)**. `docs/tech-stack.md` §10 names three that are still absent —
 * `Planes`, `Edge` and `Observability` — and the two blockers above are
 * unchanged for those. **Neither `Network` nor `Data` was ever blocked on
 * either of them**, which is the more useful half of the correction: the old
 * sentence swept five stacks under one blocker and two of them did not belong
 * there.
 *
 * 🛑 **AND THAT PARAGRAPH IS NOW FOUR STACKS OUT OF DATE. THERE ARE EIGHT.**
 * `Planes` and `Storage` landed and the sentence above went on saying `Planes`
 * was absent; **`Edge` and `EdgeCertificate` land here, 19 Sep 2026, under
 * G293** — so the only name left in that "still absent" list is
 * `Observability`. Derive it, never read it: `ls infra/lib/*-stack.ts | wc -l`
 * → 8.
 *
 * 🛑 **AND THAT SENTENCE WENT STALE THE SAME DAY: THERE ARE NINE.** `Identity`
 * — **G302's BROKER** — lands here, and it is the first stack in this app whose
 * whole subject is a PERSON rather than a process, a network or a byte.
 * `Observability` is still the only name left in the "still absent" list, and
 * the count above is corrected rather than deleted because this file's entire
 * history is a paragraph that stopped being true when work landed. Re-run the
 * command: it returns **9**. ⚠️ **`Edge` WAS GENUINELY BLOCKED AND IS THE ONE STACK THE OLD SENTENCE
 * WAS RIGHT ABOUT** — G277's *"the consoles have no host at all"* — and the
 * block was lifted by the owner naming `console.reconcileai.app` and
 * `partners.reconcileai.app` on 19 Sep 2026, not by anybody deciding it did not
 * matter. G276's BYOA shape is untouched and still blocks nothing here, because
 * `Edge` serves the hosted fleet only.
 *
 * 🛑 `Data` TAKES `Network` BY CONSTRUCT REFERENCE, NOT BY NAME AND NOT BY
 * EXPORT STRING. Both are instantiated below, in one function, so `tsc` checks
 * the join and CDK writes the `Fn::ImportValue`s itself. The DEPLOY ORDER is
 * therefore implicit and real — `Network` before `Data`, enforced by
 * CloudFormation's own dependency rather than by a step in a runbook.
 * ⚠️ WHAT IS HERE AND WHAT IS NOT. This pass is CI/CD only: `CiImage` and
 * `Pipeline`. `docs/tech-stack.md` §10 names five more — `Network`, `Data`,
 * `Planes`, `Edge`, `Observability` — and they are absent because they are
 * blocked on rulings that are not taken (G277's organisation-scoped console
 * host; G276's BYOA shape), not because they were forgotten. `infra/README.md`
 * says the same thing where a reader will meet it.
 *
 * ⚠️ AND THAT PARAGRAPH IS NOW ONE STACK OUT OF DATE IN A PARTICULAR WAY, SO IT
 * IS CORRECTED HERE RATHER THAN REWRITTEN. `lib/planes-stack.ts` IS WRITTEN —
 * G253's two services, two run-tasks and the credential fence, witnessed green
 * and red by `tests/infra/planes.test.mjs` against stub props. It is still not
 * INSTANTIATED, because it cannot be: it needs a VPC, two security groups and
 * four secrets that the `Network` and `Data` stacks own and that nothing in
 * this tree creates yet. The guard below is what keeps those two facts apart —
 * a written stack and an instantiated one are different claims, and a stack
 * instantiated on invented values would synthesise green and deploy into
 * nothing, which is worse than an absent one because it looks finished.
 */

import { App } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

import {
  ACM_CERTIFICATE_REGION,
  AWS_ACCOUNT,
  CDK_ENV,
  STACK_AMPLIFY_STAGING,
  DATA_PLANE_DATABASE_NAME,
  STACK_CI_IMAGE,
  STACK_DATA_STAGING,
  STACK_EDGE_CERTIFICATE_STAGING,
  STACK_EDGE_STAGING,
  STACK_IDENTITY_STAGING,
  STACK_NETWORK_STAGING,
  STACK_OBSERVABILITY_STAGING,
  STACK_PIPELINE_STAGING,
  STACK_PLANES_STAGING,
  STACK_RUN_QUEUE_STAGING,
  STACK_STORAGE_STAGING,
} from './config.ts'
import { AmplifyStack } from './amplify-stack.ts'
import { CiImageStack } from './ci-image-stack.ts'
import { DataStack } from './data-stack.ts'
import { EdgeCertificateStack } from './edge-certificate-stack.ts'
import { EdgeStack } from './edge-stack.ts'
import { IdentityStack } from './identity-stack.ts'
import {
  STACK_MOCK_IDP_STAGING,
  entraConnectionFromContext,
  mockIdpConnectionsFromContext,
  mockSignInFromContext,
} from './config.ts'
import { MockIdpStack } from './mock-idp-stack.ts'
import { MOCK_DOORS } from './mock-personas.ts'
import { NetworkStack } from './network-stack.ts'
import { ObservabilityStack } from './observability-stack.ts'
import { PipelineStack } from './pipeline-stack.ts'
import { PlanesStack, availablePlanesProps } from './planes-stack.ts'
import { RunQueueStack } from './run-queue-stack.ts'
import { StorageStack } from './storage-stack.ts'

export function buildApp(): App {
  const app = new App()

  new CiImageStack(app, STACK_CI_IMAGE, {
    env: CDK_ENV,
    description: 'G258 - the linux/arm64 CI image and its ECR repository.',
  })

  new PipelineStack(app, STACK_PIPELINE_STAGING, {
    env: CDK_ENV,
    environment: 'staging',
    description: 'G257 - main -> staging. Source, Gate, Build. G108 is not amended.',
  })

  const network = new NetworkStack(app, STACK_NETWORK_STAGING, {
    env: CDK_ENV,
    environment: 'staging',
    description:
      'G253 - one VPC, one NAT, and the plane boundary as two security-group pairs. ' +
      'No rule admits control-plane tasks to the data cluster.',
  })

  const data = new DataStack(app, STACK_DATA_STAGING, {
    env: CDK_ENV,
    environment: 'staging',
    network,
    description:
      'G254 - two Aurora Serverless v2 PostgreSQL 17.9 clusters, one per plane, ' +
      'with G263 rotation and a working-hours stop/start schedule.',
  })
  /**
   * `Planes` — instantiated only when its props exist.
   *
   * `availablePlanesProps()` returns `undefined` until the `Network` and `Data`
   * stacks land; that one function body is the whole of the join, and
   * `lib/planes-stack.ts` documents every field it must return. When it returns
   * props this becomes a stack in `cdk synth` and in the templates every
   * `tests/infra/` suite reads — including the tag Aspect's derived sweep,
   * which is why no environment name or plane value is invented here.
   */
  const planes = new PlanesStack(
    app,
    STACK_PLANES_STAGING,
    availablePlanesProps(network, data, 'staging'),
  )

  /**
   * `EdgeCertificate` and `Edge` — G293, 19 Sep 2026. The first thing here a
   * browser can reach.
   *
   * 🛑 TWO STACKS FOR ONE IDEA, AND THE SPLIT IS A REGION RATHER THAN A
   * DESIGN. CloudFront reads its viewer certificate from `us-east-1` and from
   * nowhere else, so the certificate cannot live beside the distribution that
   * uses it. `ACM_CERTIFICATE_REGION` in `lib/config.ts` argues why that does
   * not reopen G256's refusal of that region: a certificate is not a tenant
   * placement.
   *
   * ⚠️ `crossRegionReferences` IS WHAT JOINS THEM, AND IT IS A REAL MECHANISM
   * RATHER THAN A FLAG. Two stacks in two regions have no `Fn::ImportValue`
   * between them — CloudFormation exports are region-scoped — so CDK writes the
   * certificate ARN into an SSM parameter in `us-east-1` and reads it back with
   * a custom resource in `us-west-2`, and orders the two deploys itself. The
   * alternative was a certificate ARN pasted into `lib/config.ts` as a literal,
   * which is the shape this app refuses for the same reason `data-stack.ts`
   * refuses `AuroraPostgresEngineVersion.of('17.10', '17')`: *"a raw string
   * escape hatch that accepts a typo in silence and synthesises a template that
   * fails at deploy."* A construct reference is checked by `tsc`.
   *
   * 🛑 **G297, 19 Sep 2026: THIS STACK NOW HOLDS TWO CERTIFICATES AND `Edge`
   * HOLDS TWO DISTRIBUTIONS.** G293 ruled a FLAT `*.reconcileai.app`; G179 and
   * G183 both predate it and rule `{tenant}.{region}.{domain}` with one
   * wildcard per region. **The flat form is cryptographically valid in every
   * region, so a misrouted tenant FAILS OPEN**; the per-region form fails
   * closed at the handshake. The consoles stay flat because a console has no
   * tenant and a region label on one would assert a residency invariant 3 says
   * the control plane does not have. **Two certificates because CloudFront
   * reads exactly one viewer certificate per distribution** — the stacks argue
   * all of it in their own headers, and `lib/config.ts` argues the grammars.
   */
  const edgeCertificate = new EdgeCertificateStack(app, STACK_EDGE_CERTIFICATE_STAGING, {
    env: { account: AWS_ACCOUNT, region: ACM_CERTIFICATE_REGION },
    crossRegionReferences: true,
    environment: 'staging',
    description:
      'G293 and G297 - TWO viewer certificates: the per-region tenant wildcard and the flat ' +
      'console wildcard. us-east-1 because CloudFront reads them from no other region.',
  })

  /**
   * 🛑 `Edge` TAKES `Planes` AND `Network` BY CONSTRUCT REFERENCE, WHICH BUYS A
   * DEPLOY ORDER CLOUDFORMATION ENFORCES — AND COSTS AN UPDATE TO BOTH.
   *
   * The data ALB has no name this app can spell: a load balancer ARN carries a
   * generated suffix, so the by-NAME join `Storage` uses for a role
   * (`planeRoleName()`) is not available here at any price. A construct
   * reference is therefore the only join, and it means `Planes` and `Network`
   * must each be deployed once more to publish their exports before `Edge` can
   * deploy at all. ⚠️ `Planes` carries a REQUIRED `PlaneImageTag` parameter;
   * redeploy it with the value it already has, never with a guess.
   * 🛑 **THE SENTENCE ABOVE IS THE ONE G1012 REPAIRS AND IT IS KEPT BECAUSE IT
   * IS WHAT A READER ACTED ON: *"the value it already has"* is what `cdk
   * deploy` reuses when given nothing, and it is two days older than the fleet
   * the moment the pipeline runs — CloudFormation's revision 1 against the
   * service's revision 38, measured 20 Sep 2026.** There is no parameter now:
   * `cdk deploy reconcile-planes-staging -c planeImageTag=<commit sha>`, and
   * `node tests/e2e/probe-deployed-image.mjs` prints the sha to use.
   *
   * There is no cycle risk in either direction: nothing in `Planes` or
   * `Network` reads anything from `Edge`, and `Edge` and `Storage` share
   * nothing at all.
   */
  new EdgeStack(app, STACK_EDGE_STAGING, {
    env: CDK_ENV,
    crossRegionReferences: true,
    environment: 'staging',
    tenantCertificate: edgeCertificate.tenantCertificate,
    consoleCertificate: edgeCertificate.consoleCertificate,
    /* D6-4, G1871 - same cross-region join as the two certificates above. */
    rateLimitWebAclArn: edgeCertificate.rateLimitWebAcl.attrArn,
    dataLoadBalancer: planes.loadBalancer,
    dataLoadBalancerSecurityGroup: network.dataPlaneAlbSg,
    vpc: network.vpc,
    description:
      'G293 and G297 - the TENANT distribution (bundle over OAC, data plane through a VPC origin, ' +
      'per-region wildcard, D6-4 rate limit on the plane paths) and the FLAT console distribution. ' +
      'No CORS, no preflight, no OPTIONS.',
  })

  /**
   * `Storage` — G287, 19 Sep 2026. The data plane's object bucket and its
   * per-tenant KMS keys.
   *
   * 🛑 IT TAKES NO CONSTRUCT REFERENCE AT ALL, AND THAT IS NOT AN OVERSIGHT —
   * IT IS THE ONLY SHAPE THAT DOES NOT CYCLE. `Storage` must write an identity
   * policy onto a role `Planes` owns, and a per-tenant KMS key policy must NAME
   * that same role; while `Planes`, the day it injects the bucket name, will
   * want a value `Storage` produces. Joined by construct reference in both
   * directions that is a `«DependencyCycle»` at synth. Joined by NAME in both
   * directions it is no CloudFormation dependency at all — the argument
   * `PLANES_EXPORT_KEYS` in `lib/config.ts` already makes for the pipeline,
   * arriving a second time between two different stacks.
   *
   * ⚠️ THE PRICE IS A DEPLOY ORDER NOTHING ENFORCES: `Planes` BEFORE `Storage`,
   * or the `AWS::IAM::Policy` fails with `Cannot find the role`. Written here,
   * on `planeRoleName()`, and in `infra/README.md`. CloudFormation will not
   * tell you.
   */
  new StorageStack(app, STACK_STORAGE_STAGING, {
    env: CDK_ENV,
    environment: 'staging',
    description:
      'G287 - one object bucket for the data plane, SSE-KMS with a per-tenant key. ' +
      'ZERO tenant keys exist, so PutObject is denied outright.',
  })

  /**
   * `Identity` — G302, 19 Sep 2026. **THE BROKER.**
   *
   * 🛑 IT TAKES NO CONSTRUCT REFERENCE AND HAS NO DEPLOY-ORDER DEPENDENCY ON
   * ANYTHING, WHICH IS UNUSUAL HERE AND IS WORTH SAYING. `Storage`'s
   * independence is bought at the cost of an unenforced ordering; this one is
   * genuinely free-standing. It reaches `Edge` only through two STRINGS — the
   * console hosts, which are its callback URLs — and a string that is already a
   * `ReservedHostLabel` is checked by `tsc` at the place `lib/config.ts`
   * declares it, so there is nothing for CloudFormation to order.
   *
   * ⚠️ AND THE ONE JOIN THAT WOULD MATTER DOES NOT EXIST YET: no plane reads a
   * user pool id, an issuer or a JWKS document, so nothing consumes this
   * stack's outputs. That is named on the `Issuer` output rather than fixed
   * here — `server/` is not this slice's.
   *
   * 🛑 ZERO IDENTITY PROVIDERS, SO NOBODY CAN SIGN IN. `FEDERATED_CONNECTIONS`
   * is empty, and `lib/identity-stack.ts` argues at length why that is the
   * honest state rather than an unfinished one: `tenant.identity_connection`
   * has no column for a provider name, so a door minted here would have no row
   * behind it and every person walking through it would be refused.
   */
  new IdentityStack(app, STACK_IDENTITY_STAGING, {
    env: CDK_ENV,
    environment: 'staging',
    /* G2767 — the owner's Entra ruling. `null` (no context given) renders no
     * OIDC provider and leaves the template as it was; the empty client-secret
     * secret is rendered either way so a person can fill it first. */
    entra: entraConnectionFromContext((key) => app.node.tryGetContext(key), 'staging'),
    /* G2996 — the staging mock doors. `null` (no `-c mockIdpIssuer`) renders
     * none and leaves the template as it was. */
    mockIdp: mockIdpConnectionsFromContext(
      (key) => app.node.tryGetContext(key),
      'staging',
      Object.values(MOCK_DOORS),
    ),
    description:
      'G302 - Cognito as a BROKER for external IdPs. No native sign-in flow, no MFA (G223), ' +
      'ZERO identity providers: nobody can sign in, and orgClass has one producer.',
  })

  /**
   * `Observability` — G261, 20 Sep 2026. **THE TENTH STACK, AND THE ONE THE
   * PARAGRAPHS AT THE HEAD OF THIS FILE HAVE CALLED "still absent" SINCE
   * 18 Sep 2026.** ⚠️ The sentence *"`Observability` is still the only name left
   * in the still-absent list"* is now FALSE and is corrected rather than
   * deleted, because it is what four files carried. Derive the count, never
   * read it: `ls infra/lib/*-stack.ts | wc -l` → 10.
   *
   * 🛑 IT TAKES `network` AND ONE ARN, AND THE ARN IS WHY. `Edge` already
   * forces `Planes` to export `Ref DataAlb`, and `Data` already forces
   * `Network` to export `Ref Vpc` — so BOTH joins below are attributes the
   * deployed templates already publish, and this stack adds NO output to
   * either. **That is a hard constraint rather than tidiness**: `Planes`'
   * stack and the running fleet disagree about which image runs and the
   * image CloudFormation owns has been expired out of ECR (G1012, G1013), so
   * any change forcing a `Planes` deploy inherits that. Reading
   * `loadBalancer.loadBalancerFullName` would mint a second export and be
   * exactly that change; `observability-stack.ts` derives the metric
   * dimension from the ARN instead and says so at length.
   *
   * ⚠️ IT IS INSTANTIATED LAST AND NOTHING DEPENDS ON IT, so it can be
   * deployed at any time and deploying it moves nothing else.
   */
  new ObservabilityStack(app, STACK_OBSERVABILITY_STAGING, {
    env: CDK_ENV,
    environment: 'staging',
    network,
    dataLoadBalancerArn: planes.loadBalancer.loadBalancerArn,
    description:
      'G261 - one SNS topic per environment, eight alarms, four event rules and VPC flow logs. ' +
      'The topic is subscribed to a PLACEHOLDER email address (G1811) that must be replaced ' +
      'before production; the subscription is unconfirmed, so it still pages nobody today.',
  })

  /**
   * `RunQueue` — THE ELEVENTH STACK, 20 Sep 2026, THE OWNER'S RULING **R-B**:
   * *"A worker claims runs from a REAL QUEUE (SQS), never by scanning."*
   *
   * 🛑 IT TAKES NO CONSTRUCT REFERENCE AT ALL, AND THAT IS THE SAME
   * CONSTRAINT `Observability` AND `Storage` BOTH RECORD RATHER THAN A
   * PREFERENCE. It must attach an identity policy to a role `Planes` owns, and
   * CDK mints a cross-stack export per attribute READ — so a construct
   * reference here would add an export to `Planes`, and an export on `Planes`
   * is a `Planes` DEPLOY, which G1012 and G1013 measure as rolling both planes
   * back to an image ECR has EXPIRED. The join is `iam.Role.fromRoleName()`,
   * exactly as `Storage`'s is, and `tests/infra/run-queue.test.mjs` §5 asserts
   * the synthesised `Planes` template is BYTE-IDENTICAL before and after.
   *
   * ⚠️ THE PRICE IS THE SAME UNENFORCED DEPLOY ORDER `Storage` PAYS: `Planes`
   * BEFORE `RunQueue`, or the `AWS::IAM::Policy` fails with `Cannot find the
   * role`. `Planes` is already deployed, so it costs nothing today.
   *
   * 🛑 AND IT HAS A PRODUCER AND NO CONSUMER: nothing is granted
   * `sqs:ReceiveMessage`, because nothing in this account runs the worker.
   * Where `server/data-plane/run-worker-main.ts` runs is a PERSON'S decision —
   * the stack's header names the three shapes and their costs — and the
   * receive grant lands in the commit that deploys one.
   *
   * ⚠️ IT IS INSTANTIATED LAST AND NOTHING DEPENDS ON IT.
   */
  /**
   * ⚠️ **IT TAKES `network` AND `data` SINCE 21 Sep 2026 — R-W, G1544 — AND
   * THE SENTENCE ABOVE THAT SAID "NOTHING DEPENDS ON IT" IS STILL TRUE IN THE
   * DIRECTION THAT MATTERS: nothing depends on `RunQueue`.** `RunQueue` now
   * depends on `Network` and `Data`, which is the opposite edge and is free.
   *
   * 🛑 **EVERY FIELD BELOW IS A CONSTRUCT REFERENCE AND NONE MINTS A NEW
   * EXPORT, WHICH IS MEASURED RATHER THAN HOPED.** CDK mints one export per
   * attribute READ and deduplicates: `Planes` already reads the VPC, the
   * private subnets, `dataPlaneSg`, the data cluster's endpoint address and
   * port, and the app secret — **every value here.** So `Network` and `Data`
   * are BYTE-IDENTICAL before and after, and
   * `tests/infra/run-queue.test.mjs` §8 pins that on every gate run.
   *
   * ⚠️ **AND `Planes` IS STILL JOINED BY NAME AND IS NOT PASSED HERE AT ALL.**
   * A construct reference to `planes.cluster` would mint a NEW export on
   * `Planes`, and an export on `Planes` is a `Planes` deploy (G1012) —
   * `ecsClusterName()` is what replaces it.
   */
  new RunQueueStack(app, STACK_RUN_QUEUE_STAGING, {
    env: CDK_ENV,
    environment: 'staging',
    network: {
      vpc: network.vpc,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      dataPlaneSecurityGroup: network.dataPlaneSg,
    },
    data: {
      host: data.dataPlaneCluster.clusterEndpoint.hostname,
      port: data.dataPlaneCluster.clusterEndpoint.port,
      databaseName: DATA_PLANE_DATABASE_NAME,
      /* One `as ISecret`, the same `exactOptionalPropertyTypes` seam
       * `availablePlanesProps()` documents: `Secret` declares
       * `secretFullArn: string | undefined` and `ISecret` declares it
       * `string`, so under that flag the class is not assignable to the
       * interface every concrete `Secret` satisfies at run time. */
      /* G3861 — the run worker's own credential, `reconcile_engine`. The
       * `Data` export it reads is the SAME one `Planes` reads for the data
       * migrate task (CDK deduplicates one export per attribute), so this
       * edge mints nothing `Planes` does not already import. */
      engineSecret: {
        secret: data.dataPlaneEngineSecret as secretsmanager.ISecret,
        passwordField: 'password',
      },
    },
    description:
      'R-B + R-W - the run-admitted queue, its dead-letter queue, and the SCHEDULED ECS TASK ' +
      'that consumes it. The data plane may SEND; only the worker`s own role may RECEIVE.',
  })

  /**
   * `Amplify` — **THE TWELFTH STACK, 22 Sep 2026, THE OWNER'S RULING**: the
   * public marketing plane lives on AWS Amplify at the apex `reconcileai.app`,
   * honouring `docs/build/deploy-handoff.md` §5.4 — *"a different tool for a
   * different job"*.
   *
   * 🛑 IT TAKES NO CONSTRUCT REFERENCE AND HAS NO DEPLOY-ORDER DEPENDENCY ON
   * ANYTHING, AND UNLIKE `Storage` THAT INDEPENDENCE COSTS NOTHING. `Storage`
   * buys its independence with an unenforced `Planes`-before-`Storage`
   * ordering; `RunQueue` and `Observability` both record the same constraint
   * and pay it with `fromRoleName()`. **This one genuinely needs nothing from
   * any of them.** The only thing it reaches outside itself is a HOSTNAME —
   * `CONSOLE_HOST`, a string in `lib/config.ts` that `Edge` reads too — so
   * there is no export to mint and nothing for CloudFormation to order.
   *
   * ⚠️ **THE APEX IS ON NEITHER EDGE CERTIFICATE AND NEITHER DISTRIBUTION, AND
   * THAT IS UNCHANGED BY THIS STACK EXISTING.** `EDGE_APEX_IS_SERVED_ELSEWHERE`
   * stays `true`; a wildcard matches exactly one label, so
   * `*.reconcileai.app` never covered the apex and the `Edge` sinkhole never
   * answered for it. Amplify issues a THIRD certificate, for one name.
   *
   * 🛑 **AND THE APEX A RECORD IS NOT IN ITS TEMPLATE BECAUSE IT CANNOT BE.**
   * `AWS::Amplify::Domain` publishes no distribution domain and no hosted-zone
   * id, so an ALIAS has nothing to point at; Amplify writes the records into
   * `Z04053259WLMQJTR30EU` itself, and a second writer of one record name is
   * the G297 Route 53 race this product has already paid for once. The stack's
   * header carries the attribute list it was derived from.
   *
   * ⚠️ IT IS INSTANTIATED LAST AND NOTHING DEPENDS ON IT.
   */
  new AmplifyStack(app, STACK_AMPLIFY_STAGING, {
    env: CDK_ENV,
    environment: 'staging',
    description:
      'S5 - the public marketing plane at the apex, on Amplify. Manual deploy, two rewrites, ' +
      'and a demo intake that never evaluates a referral code.',
  })

  /**
   * `MockIdp` — G2996, THE OWNER'S RULING G2771: a STAGING-ONLY mock OIDC
   * identity provider, so a browser can sign in to staging as a mock persona
   * without a passkey. 🛑 A PUBLIC TEST LOGIN, ACCEPTED IN WRITING FOR
   * STAGING ALONE. **It is not in the app unless `-c mockSignIn=on` is
   * passed**, and `mockSignInFromContext()` throws for any other environment.
   * Nothing depends on it by construct reference: `Identity` reaches it by
   * `-c mockIdpIssuer`, so neither stack's deploy waits on the other's.
   */
  if (mockSignInFromContext((key) => app.node.tryGetContext(key), 'staging')) {
    new MockIdpStack(app, STACK_MOCK_IDP_STAGING, {
      env: CDK_ENV,
      environment: 'staging',
      description:
        'G2771 - STAGING MOCK OIDC IdP: a public TEST login for mock personas on *.mock.reconcileai.app. ' +
        'KMS-held key, password secret created EMPTY, refused outside staging.',
    })
  }

  /* 🛑 THE PROD PIPELINE IS NOT INSTANTIATED. See
   * `PROD_PROMOTION_PIPELINE_TODO` in `lib/pipeline-stack.ts`: a promotion
   * pipeline that rebuilds falsifies the one sentence G257 exists for, and the
   * resolve-or-fail step it needs is blocked on the `Planes` stack. */

  return app
}

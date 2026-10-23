/**
 * `Pipeline` — G257. `main` → staging on merge. CodePipeline + CodeBuild on
 * ARM, GitHub through CodeConnections, and **G108 is not amended by any of it**.
 *
 * 🛑 THE STAGE BOUNDARY IS THE RULING. The Gate stage is `npm ci` then
 * `npm run check` and NOTHING ELSE. Build, migrate and deploy are SEPARATE
 * STAGES that run after a green gate — never steps inside it. That is the same
 * line `.github/workflows/check.yml` draws with *"DO NOT ADD A STEP HERE"*, and
 * `infra/lib/buildspecs.ts` carries the sentence into the deployed artefact so
 * that the person editing the buildspec reads it rather than the person editing
 * the generator.
 *
 * ✅ **THE MIGRATE AND DEPLOY STAGES ARE BUILT.** ⚠️ **THIS HEADER SAID THEY WERE
 * NOT, AND THE OLD TEXT IS QUOTED RATHER THAN DELETED, because it is the
 * sentence a reader would have trusted before deciding whether to write one:**
 * *"· **The Migrate stage.** … A run-task action needs a cluster and two task
 * definitions, and those live in the `Planes` stack, which is not in this pass …
 * Writing half of it against invented resource names would be a stage that
 * deploys and migrates nothing. · **The Deploy stage.** Same blocker, same
 * reason. The IAM FENCE it will need is built below and is the one part of it
 * that is decidable today."*
 *
 * **What changed is not the blocker — it is where the join is made.** The
 * `Planes` and `Network` stacks are still not in this app. The stages below do
 * not invent resource names: they read **NAMED CLOUDFORMATION EXPORTS**, listed
 * once in `infra/lib/config.ts` as `PLANES_EXPORT_KEYS` and
 * `NETWORK_EXPORT_KEYS`, and they take a `planes` / `network` prop for the day
 * those stacks are instantiated in the same app and can be wired directly.
 *
 * 🛑 THE COST OF THAT CHOICE, STATED PLAINLY RATHER THAN DISCOVERED AT A
 * DEPLOY. `Fn::ImportValue` is resolved by CloudFormation at DEPLOY time, so
 * `cdk synth` stays green and offline — G108's condition on anything in
 * `npm run check` is untouched — and **`cdk deploy reconcile-pipeline-staging`
 * now FAILS with `No export named reconcile-planes-staging-ClusterName found`
 * until the `Network` and `Planes` stacks are deployed.** That is a change to
 * the deploy ORDER of a stack that is live today, and it is the honest
 * direction: a Deploy stage pointed at nothing would deploy cleanly and serve
 * the same purpose as no stage at all. `infra/README.md` carries the order.
 *
 *   · **The prod promotion pipeline** is still absent. See
 *     `PROD_PROMOTION_PIPELINE_TODO`.
 *   · ✅ **The frontend half of stage 5 IS BUILT — G993, 20 Sep 2026.**
 *     ⚠️ This bullet read *"— S3 sync and CloudFront invalidation — is still
 *     absent, because the `Edge` stack is genuinely undecided under G277"*, and
 *     it is corrected rather than deleted because that blocker was real and was
 *     lifted by somebody else: `Edge` landed 19 Sep 2026 (G293, G297).
 *     `DEPLOY_BUILDSPEC_YAML` still says so at the point a reader would look.
 *     🛑 **AND IT EXTENDS THE DEPLOY-ORDER CONSTRAINT ABOVE BY ONE STACK**:
 *     this stack now also imports `reconcile-edge-<env>-TenantDistributionId`
 *     and `…-ConsoleDistributionId`, so **`Edge` must be deployed before this
 *     one** — see `EDGE_EXPORT_KEYS` in `infra/lib/config.ts` for why a
 *     distribution id is the one value this app cannot spell.
 *   · ✅ **AND THE GATE NOW RUNS BEFORE A MERGE AS WELL AS AFTER ONE — G995.**
 *     `reconcile-gate-pr-<env>` is a second CodeBuild project on the SAME
 *     image running the SAME `GATE_BUILDSPEC_YAML` with the same `CI` value,
 *     triggered by pull-request webhook events only. **G108 is not amended:
 *     one gate, two moments**, and `tests/infra/pipeline.test.mjs` holds every
 *     G108 assertion over EVERY project that runs it rather than over the
 *     first one `.find()` returns.
 *   · **G261's alarms** are the `Observability` stack's and are not here. What
 *     IS here is the deploy stage REFUSING a service that carries no deployment
 *     circuit breaker, which is the half of G261 this stack can decide.
 */

import { CfnOutput, CfnParameter, Duration, Fn, RemovalPolicy, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline'
import * as actions from 'aws-cdk-lib/aws-codepipeline-actions'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import type { Construct } from 'constructs'

import {
  DEPLOY_BUILDSPEC_YAML,
  GATE_BUILDSPEC_YAML,
  MIGRATE_BUILDSPEC_YAML,
  PLANE_BUILD_BUILDSPEC_YAML,
  PUBLISH_SITE_BUILDSPEC_YAML,
  RETAG_RUN_WORKER_BUILDSPEC_YAML,
  WAKE_FLEET_BUILDSPEC_YAML,
  attachBuildSpecYaml,
} from './buildspecs.ts'
import {
  CI_IMAGE_REPOSITORY_NAME,
  CI_IMAGE_TAG,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_TRUNK_BRANCH,
  PLANE_IMAGE_REPOSITORY_NAME,
  PULL_REQUEST_GATE_CONTEXT_KEY,
  SERVING_TASKS_WHEN_UP,
  edgeExportName,
  frontendBucketName,
  networkExportName,
  planesExportName,
  planesStackName,
  pullRequestGateEnabled,
  runQueueStackName,
  runWorkerScheduleRuleName,
  runWorkerTaskFamily,
  testPersonasBuildFlag,
} from './config.ts'
import type { Environment } from './config.ts'
import { codeConnectionsAuthOverride, connectionUsePolicy } from './connections.ts'
import { applyRequiredTags } from './tagging.ts'

/**
 * 🛑 TODO — THE PROD PROMOTION PIPELINE (G257), DELIBERATELY NOT HALF-WRITTEN.
 *
 * G257: *"a `v*` tag → prod with NO REBUILD"*. The prod pipeline RESOLVES the
 * staging image digest and frontend artefact already built for the tagged
 * commit and **fails if it cannot find them**. That guarantee — *"prod runs the
 * bytes staging ran"* — is the entire value of the second pipeline, and it is
 * unbuildable today for one concrete reason rather than for a vague one:
 *
 *   the resolve step must look the tagged commit's artefacts up somewhere, and
 *   the place they will live is the `Planes` stack's ECS task definitions plus
 *   this pipeline's artefact bucket — and the first of those does not exist.
 *
 * A pipeline that "promotes" by rebuilding would look identical in the console
 * and would falsify the one sentence the ruling is for. So it is absent, and
 * absent loudly. When the `Planes` stack lands, this is a second
 * `PipelineStack` instantiation with `environment: 'prod'`, a
 * `trigger` on `tags: ['v*']` (pipeline type V2), and a Promote stage in place
 * of Gate and Build.
 */
export const PROD_PROMOTION_PIPELINE_TODO =
  'G257 prod promotion pipeline: NOT BUILT. Blocked on the Planes stack. ' +
  'It must resolve the staging artefacts for the tagged commit and FAIL rather ' +
  'than rebuild.'

/**
 * What the Migrate and Deploy stages need from the `Planes` stack.
 *
 * 🛑 NAMES, NEVER ARNs, AND `infra/lib/config.ts` CARRIES THE ARGUMENT. In
 * short: a task-definition ARN carries a revision, a revision moves every time
 * the other stack deploys, and an IAM policy fenced to one goes stale silently.
 * A family name is stable and `arn:…:task-definition/<family>:*` stays true.
 *
 * ⚠️ ONE AGREEMENT THIS PLACES ON THE OTHER STACK: for each plane, the container
 * carrying the plane's image must have the SAME NAME in the service task
 * definition and in the migrate task definition. If it ever does not, both
 * stages fail loudly on the name rather than silently re-registering the old
 * image — `RETAG_TASK_DEFINITION_JS` in `buildspecs.ts` is where that is held.
 */
export interface PlanesRefs {
  readonly clusterName: string
  readonly controlMigrateTaskFamily: string
  readonly dataMigrateTaskFamily: string
  readonly controlServiceTaskFamily: string
  readonly dataServiceTaskFamily: string
  readonly controlServiceName: string
  readonly dataServiceName: string
  readonly controlContainerName: string
  readonly dataContainerName: string
  /**
   * 🛑 FOUR CONTAINER NAMES, NOT TWO, AND THE FIRST REAL MIGRATE RUN FAILED ON
   * THE DIFFERENCE.
   *
   * A migrate task's container is `control-plane-migrate`, not `control-plane`.
   * The names are deliberately distinct because
   * `tests/infra/planes.test.mjs` tells the migrate container from the service
   * container BY NAME to check WHICH credentials each holds — the migrate task
   * gets the migrator secret and the service must never see it. They were
   * briefly collapsed to one name per plane for this stage's convenience and
   * that test went red immediately, so the names stayed and this stage has to
   * ask for the right one.
   *
   * The failure was loud and named its own cause, which is the guard working:
   *   FATAL: task definition family ...ControlPlaneMigrateTask... has no
   *   container named control-plane. The Planes stack and infra/lib/config.ts
   *   disagree about the container name.
   */
  readonly controlMigrateContainerName: string
  readonly dataMigrateContainerName: string
}

/**
 * What the Migrate stage needs from the `Network` stack.
 *
 * `ecs run-task` on Fargate takes an `awsvpcConfiguration`, so a one-shot task
 * needs subnets and a security group of its own. TWO security groups, not one:
 * G193's plane boundary is topology, and a migration that ran in the other
 * plane's security group would be the first thing in this system to cross it.
 */
export interface NetworkRefs {
  /** Comma-joined, because the `ecs run-task` shorthand takes a list. */
  readonly privateSubnetIds: string
  readonly controlPlaneSecurityGroupId: string
  readonly dataPlaneSecurityGroupId: string
}

/**
 * What the Deploy stage's FRONTEND half needs from the `Edge` stack — G993.
 *
 * 🛑 TWO IDs AND NO BUCKET, AND THE ASYMMETRY IS THE ARGUMENT. The bucket name
 * is `frontendBucketName(environment)`, a pure function spelled once in
 * `infra/lib/config.ts` and read by the stack that creates it and the stage
 * that fills it — the by-NAME join `planeRoleName()` already makes between
 * `Storage` and `Planes`, which costs no CloudFormation dependency at all.
 *
 * A CloudFront distribution id is minted by CloudFront and appears in no name
 * this app controls, so it is the one value that must be exported. Both
 * alternatives — a `cloudfront:ListDistributions` lookup on `*`, and a
 * construct reference — are refused on `EDGE_EXPORT_KEYS` in `config.ts`.
 */
export interface EdgeRefs {
  readonly tenantDistributionId: string
  readonly consoleDistributionId: string
}

export interface PipelineStackProps extends StackProps {
  readonly environment: Environment
  /** Omitted: every field is read from the `Planes` stack's named exports. */
  readonly planes?: PlanesRefs
  /** Omitted: every field is read from the `Network` stack's named exports. */
  readonly network?: NetworkRefs
  /** Omitted: both fields are read from the `Edge` stack's named exports. */
  readonly edge?: EdgeRefs
}

export class PipelineStack extends Stack {
  readonly pipeline: codepipeline.Pipeline
  readonly gateProject: codebuild.PipelineProject
  /**
   * G995 — the same gate, on a pull request.
   *
   * ⚠️ **`undefined` UNLESS `-c pullRequestGate=on` — G1094, 20 Sep 2026.** The
   * type is the fence: `off` does not mean a dormant project, it means there is
   * no project, so nothing downstream can attach a buildspec or a policy to one
   * that is not there. See its construction below.
   */
  readonly prGateProject: codebuild.Project | undefined
  readonly buildProject: codebuild.PipelineProject
  readonly migrateProject: codebuild.PipelineProject
  /**
   * G2301 — the Deploy stage's FIRST action, at `runOrder: 1`. It raises a
   * fleet the cost schedule scaled to zero and refuses to finish until tasks
   * are RUNNING, so `UpdateServices` always has something to deploy onto.
   */
  readonly wakeProject: codebuild.PipelineProject
  readonly deployProject: codebuild.PipelineProject
  /**
   * G2221 — the Deploy stage's SECOND action. It publishes the frontend bundle
   * and invalidates both distributions, at `runOrder: 2`, so a plane that fails
   * to settle means this never starts.
   */
  readonly publishSiteProject: codebuild.PipelineProject
  /**
   * G2961 — the Deploy stage's RUN-WORKER action, at `runOrder: 3` beside
   * `PublishSite`. The same narrow retag G2041 applies to `Planes`, applied to
   * `RunQueue`, so the worker cannot fall behind the planes it shares an image
   * with.
   */
  readonly retagRunWorkerProject: codebuild.PipelineProject
  readonly planeRepository: ecr.Repository
  readonly deployRole: iam.Role

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props)

    const environment = props.environment

    const connectionArn = new CfnParameter(this, 'CodeConnectionArn', {
      type: 'String',
      description:
        `ARN of the CodeConnections connection to github.com/${GITHUB_OWNER}/${GITHUB_REPO}. ` +
        'A connection needs a console handshake and CANNOT be created by CDK.',
      minLength: 1,
    })

    /**
     * The machine every stage runs on — G258's image, by its IMMUTABLE tag, so
     * the tag names bytes (see `infra/lib/config.ts`).
     *
     * ⚠️ `fromRepositoryName` IS NOT A LOOKUP. It builds an ARN from the account
     * and region this stack already knows; it reaches no API, which is what
     * keeps `cdk synth` offline and therefore keeps it eligible for the gate
     * under G108. The cost is that the repository's EXISTENCE is not checked at
     * synth — the deploy fails instead, which is the right place for it.
     */
    const ciImageRepository = ecr.Repository.fromRepositoryName(
      this,
      'CiImageRepository',
      CI_IMAGE_REPOSITORY_NAME,
    )
    const ciImage = codebuild.LinuxArmBuildImage.fromEcrRepository(
      ciImageRepository,
      CI_IMAGE_TAG,
    )

    this.planeRepository = new ecr.Repository(this, 'PlaneRepository', {
      repositoryName: `${PLANE_IMAGE_REPOSITORY_NAME}-${environment}`,
      // G262 — scan on push. See the CiImage stack's note on basic vs enhanced.
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: RemovalPolicy.RETAIN,
      emptyOnDelete: false,
      lifecycleRules: [{ description: 'Keep the fifty most recent plane images.', maxImageCount: 50 }],
    })

    // -------------------------------------------------------------- the gate

    /**
     * 🛑 `CI: '1'` IS THE ONE PIECE OF CONFIGURATION THAT MAKES THE GATE MEAN
     * ANYTHING, AND IT ADDS NO COMMAND.
     *
     * `tests/reachability.ts` conditions `databaseRequiredUnderCi()` and
     * `browserRequiredUnderCi()` on `CI`, deliberately: a contributor with
     * neither dependency still gets a runnable suite, and what is defended is
     * the claim CI makes. CodeBuild does NOT set `CI` of its own accord — only
     * `CODEBUILD_*` — so without this line the gate would SKIP the suites that
     * carry invariants 1 and 3 and report green, which is precisely how PR #257
     * merged a red trunk (run 31961439743: `success`, seven test databases
     * unreachable, no chromium).
     *
     * It is project configuration rather than a buildspec command, so G108's
     * two-command gate is untouched — the same reasoning
     * `.github/workflows/check.yml` gives for adding `fetch-depth: 0` to an
     * existing `uses:` step.
     */
    this.gateProject = new codebuild.PipelineProject(this, 'Gate', {
      projectName: `reconcile-gate-${environment}`,
      description: 'G108: npm ci && npm run check. Nothing else, ever.',
      environment: {
        buildImage: ciImage,
        computeType: codebuild.ComputeType.LARGE,
        // NOT privileged. The gate builds no image and needs no docker daemon;
        // a gate holding the daemon is a gate that could push one.
        privileged: false,
      },
      environmentVariables: {
        CI: { value: '1' },
      },
      timeout: Duration.minutes(60),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'GateLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * 🛑 G995, 20 Sep 2026 — THE SAME GATE, BEFORE THE MERGE INSTEAD OF AFTER
     *    IT. **NOT A SECOND DEFINITION OF GREEN.**
     * ═══════════════════════════════════════════════════════════════════════
     *
     * The gate above runs on `main`, in the pipeline, AFTER a merge. Until this
     * project existed **nothing ran anything on a pull request at all** —
     * derive it against the tree this landed on:
     * `grep -rn -i 'webhook\\|pull_request' infra/lib/*.ts` returned exactly one
     * line, `ci-image-stack.ts`'s `webhook: false`. So every red trunk this
     * repository has had was findable only after it was trunk, which is the
     * expensive half of PR #257: *"`main` was red from the moment it was
     * merged."*
     *
     * 🛑 G108 IS NOT AMENDED AND THIS IS THE ONE PARAGRAPH TO READ BEFORE
     * EDITING EITHER PROJECT. G108 rules ONE GATE — *"CI runs the command a
     * contributor runs, so nobody is green locally and red in CI"* — and a
     * second project is only compatible with that if it is the SAME GATE at a
     * different MOMENT rather than a second opinion about what green is.
     * Everything that decides the verdict is therefore shared rather than
     * copied:
     *
     *   · **the same buildspec** — `GATE_BUILDSPEC_YAML`, one variable, read
     *     from `infra/ci-image/buildspec-gate.yml`, attached to both;
     *   · **the same image** — G258's ARM CI image, by its immutable tag, so
     *     both run on a machine carrying PostgreSQL 17 and chromium;
     *   · **the same `CI` value** — `'1'`, so `tests/reachability.ts`'s guards
     *     are ARMED here too. Without it a PR gate is the 17 Aug 2026 hole
     *     rebuilt: a green check that stood eleven database-dependent suites and
     *     nine browser-dependent ones down in silence.
     *
     * **`tests/infra/pipeline.test.mjs` holds that sharing over EVERY project
     * that runs the gate rather than over the first one it finds**, which is
     * the assertion this slice had to change before it could add a project at
     * all: a `.find()` reads one project, and a second carrying a different
     * buildspec would have been invisible to it.
     *
     * ⚠️ IT IS A `codebuild.Project` AND NOT A `PipelineProject`, BECAUSE IT
     * HAS A SOURCE OF ITS OWN. A `PipelineProject` takes its input from a
     * CodePipeline artefact and cannot be webhook-triggered; a pull request is
     * not a pipeline execution and must not become one — the pipeline's Build,
     * Migrate and Deploy stages push an image and touch a live service, and
     * running those on a stranger's branch is the thing a fork pull request
     * would do.
     *
     * 🛑 THE WEBHOOK FILTER IS THE FENCE AND IT IS NARROW ON PURPOSE. Three
     * events, all of them pull-request events; **no `PUSH`**, because a push
     * filter on this project would run a second gate on every merge to `main`
     * beside the pipeline's own — two runs, two verdicts, one commit, which is
     * precisely the shape G108 forbids.
     *
     * ⚠️ WHAT A DEPLOY OF THIS STILL NEEDS FROM A HUMAN, STATED HERE RATHER
     * THAN DISCOVERED IN CLOUDFORMATION. `infra/lib/connections.ts` records
     * that INLINE `Source.Auth` fails in this account with
     * `OAuthProviderException` and that the working arrangement is an
     * ACCOUNT-LEVEL credential — `aws codebuild import-source-credentials
     * --server-type GITHUB --auth-type CODECONNECTIONS --token <arn>` — which
     * is region-scoped and already imported in `us-west-2`. **Creating a
     * webhook additionally asks GitHub for one**, through that same stored
     * credential, and this repository has never created one, so the first
     * `cdk deploy` of this project is where that is found out. It is named as a
     * risk rather than asserted as a fact.
     *
     * ┌─ 🛑 THAT RISK CAME TRUE THE SAME DAY, AND THE PARAGRAPH ABOVE IS ──────┐
     * │ CORRECTED RATHER THAN DELETED BECAUSE IT PREDICTED IT EXACTLY —       │
     * │ **G1094, 20 Sep 2026**. From CloudFormation, not from reasoning:      │
     * │                                                                       │
     * │   CREATE_FAILED  AWS::CodeBuild::Project  GatePullRequest             │
     * │   Failed to call CreateWebhook, reason: Access denied to connection   │
     * │   arn:aws:codeconnections:us-west-2:000000000000:connection/309314ad… │
     * │                                                                       │
     * │ The connection is `AVAILABLE`, `GitHub`, owned by this account. What  │
     * │ is missing is a **GitHub App permission** that lets CodeBuild mint a  │
     * │ webhook through it. **That is not a code defect and no CDK change     │
     * │ fixes it** — an owner grants it in GitHub.                            │
     * │                                                                       │
     * │ 🛑 **THE DEFECT WAS THE COUPLING.** One resource blocked on a human   │
     * │ rolled the WHOLE stack back, taking the Deploy stage's frontend sync  │
     * │ — which works, and which is wanted — with it. So this project is now  │
     * │ behind `-c pullRequestGate=on`, DEFAULT OFF, and **off means there is │
     * │ no project here at all**: `PULL_REQUEST_GATE_CONTEXT_KEY` in          │
     * │ `lib/config.ts` carries the reasoning and the exact deploy command.   │
     * │                                                                       │
     * │ ⚠️ **AND OFF IS A REAL COST, STATED RATHER THAN SOFTENED: WITH THE    │
     * │ FLAG OFF NOTHING CHECKS A PULL REQUEST.** The trunk gate still runs   │
     * │ after the merge, which is exactly the position PR #257 was merged     │
     * │ from. What is NOT true of the off state is the worse thing — there is │
     * │ no project reporting nothing, because **a gate that exists and never  │
     * │ fires reads from the merge button exactly like a gate that passed**,  │
     * │ which is PR #257's own failure in a new place. Absent is honest;      │
     * │ present-and-silent is not. `tests/infra/pipeline.test.mjs` asserts    │
     * │ the absence by resource type, and the stack says so in a `CfnOutput`. │
     * └───────────────────────────────────────────────────────────────────────┘
     */
    const prGateEnabled = pullRequestGateEnabled(
      this.node.tryGetContext(PULL_REQUEST_GATE_CONTEXT_KEY),
    )

    /* ⚠️ A THUNK AND NOT AN OBJECT, AND THE REASON IS THE LOG GROUP. The
     * `logging` block below CONSTRUCTS `GatePullRequestLogs`; evaluating these
     * props with the flag off would leave that log group in the template with
     * no project attached to it, which is precisely the "off but not absent"
     * shape this slice exists to refuse. Nothing here is built unless it is
     * called. */
    /**
     * 🛑 THE PR GATE GETS AN EXPLICIT ROLE THAT HOLDS THE CONNECTION GRANT
     * FROM BIRTH — G1286, 20 Sep 2026. MEASURED, NOT REASONED.
     *
     * A project carrying `Triggers.Webhook: true` calls `CreateWebhook` AS
     * PART OF ITS OWN CREATE, and that call is made **as the project's service
     * role** — not as the deployer. With `addToRolePolicy()` the statement
     * lands in the role's `DefaultPolicy`, which CloudFormation creates in
     * PARALLEL with the project, so the webhook is minted in the window before
     * the role holds `UseConnection` and the create fails:
     *
     *     CREATE_FAILED AWS::CodeBuild::Project GatePullRequest
     *     Failed to call CreateWebhook, reason: Access denied to connection
     *
     * ⚠️ THE ERROR NAMES THE CONNECTION AND THE CAUSE IS AN IAM RACE, which is
     * why it cost a GitHub App audit, a second connection and a throwaway
     * project to find. The three things it reads like were each measured and
     * each ruled out: the App holds `repository_hooks: write`,
     * `1CloudHub/Reconcile` is in its selected set, and a BRAND-NEW connection
     * failed identically. The deciding measurement was that the role the probe
     * borrowed simulated `implicitDeny` on `UseConnection` while the CALLER
     * simulated `allowed` — the "User" in the message is the SERVICE ROLE.
     *
     * 🛑 AND IT CANNOT BE A SEPARATE `iam.Policy` THE PROJECT DEPENDS ON:
     * CloudFormation reports a cycle across the role, its DefaultPolicy and
     * the project, because the DefaultPolicy's report-group ARN interpolates
     * the project's own name. An INLINE policy on a role the project merely
     * REFERENCES has no such edge — the role is complete before the project
     * begins.
     */
    const prGateRole = new iam.Role(this, 'GatePullRequestServiceRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description:
        'The PR gate\'s service role. It holds the CodeConnections grant INLINE so the ' +
        'role is complete before CreateWebhook runs as it (G1286).',
      inlinePolicies: {
        ConnectionUse: new iam.PolicyDocument({
          statements: [connectionUsePolicy(connectionArn.valueAsString)],
        }),
      },
    })

    const prGateProps = (): codebuild.ProjectProps => ({
      projectName: `reconcile-gate-pr-${environment}`,
      role: prGateRole,
      description:
        'G108 and G995: npm ci && npm run check on a PULL REQUEST. The same buildspec, ' +
        'the same image and the same CI value as reconcile-gate-' +
        environment +
        '. One gate, two moments.',
      source: codebuild.Source.gitHub({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        webhook: true,
        /* 🛑 A FULL CLONE. `tools/check-g-numbers.mjs` asks whether a G number
         * is absent at `git merge-base origin/main HEAD`, and without history
         * that half prints "trunk collision check unavailable (non-fatal)" —
         * green by unavailability, on the one check a pull request is the right
         * place to run. The pipeline's Source action buys the same thing with
         * `codeBuildCloneOutput: true`; here it is `cloneDepth: 0`. */
        cloneDepth: 0,
        /* The verdict goes back to the pull request. A gate nobody can see from
         * the merge button is a gate people merge past. */
        reportBuildStatus: true,
        webhookFilters: [
          codebuild.FilterGroup.inEventOf(
            codebuild.EventAction.PULL_REQUEST_CREATED,
            codebuild.EventAction.PULL_REQUEST_UPDATED,
            codebuild.EventAction.PULL_REQUEST_REOPENED,
          ),
        ],
      }),
      environment: {
        buildImage: ciImage,
        computeType: codebuild.ComputeType.LARGE,
        /* NOT privileged, for the reason the post-merge gate is not: a gate
         * holding the Docker daemon is a gate that could push an image. */
        privileged: false,
      },
      environmentVariables: {
        /* THE SAME VALUE AS THE GATE ABOVE. Read that project's comment: this
         * is the one piece of configuration that makes either gate mean
         * anything, and two gates disagreeing about it would be worse than one
         * gate without it. */
        CI: { value: '1' },
      },
      timeout: Duration.minutes(60),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'GatePullRequestLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    this.prGateProject = prGateEnabled
      ? new codebuild.Project(this, 'GatePullRequest', prGateProps())
      : undefined

    /**
     * 🛑 THE OFF STATE IS ANNOUNCED RATHER THAN SILENT, AND THAT IS G1094's
     * OTHER HALF. A stack that quietly stops checking pull requests is a stack
     * whose absence of a gate has to be DISCOVERED; this output puts the state,
     * the flag and the blocker on the deploy's own output and on the console's
     * Outputs tab. `tests/infra/pipeline.test.mjs` asserts the value in BOTH
     * states, so the announcement cannot drift from the resource.
     */
    new CfnOutput(this, 'PullRequestGate', {
      value: prGateEnabled
        ? `ON - reconcile-gate-pr-${environment} runs npm run check on every pull request`
        : `OFF - NO pull request is checked. Nothing runs npm run check before a merge; ` +
          `only the post-merge pipeline gate does. Turn it on with ` +
          `-c ${PULL_REQUEST_GATE_CONTEXT_KEY}=on, which first needs a GitHub App ` +
          `permission letting CodeBuild create a webhook through the CodeConnections ` +
          `connection - without it the project fails CREATE with "Access denied to ` +
          `connection" and rolls this whole stack back.`,
      description:
        'Whether anything checks a pull request before it is merged (G995, G1094). ' +
        'OFF is the default and is a real gap, not a tidy state.',
    })

    // ------------------------------------------------------------- the build

    this.buildProject = new codebuild.PipelineProject(this, 'Build', {
      projectName: `reconcile-build-${environment}`,
      description:
        'The image and the frontend bundle, from one commit, AFTER a green gate (G257).',
      environment: {
        /**
         * 🛑 THE STANDARD ARM IMAGE, NOT THE CI IMAGE, AND THE FIRST REAL
         * PIPELINE RUN IS WHAT ESTABLISHED THE DIFFERENCE.
         *
         * This used to be `ciImage` — the same machine as the gate — on the
         * reasonable-sounding ground that one image is simpler than two. The
         * Build stage failed in PRE_BUILD with `exit status 127`:
         *
         *     aws: command not found
         *     docker: command not found
         *
         * THE TWO STAGES NEED OPPOSITE MACHINES AND THE CI IMAGE IS BUILT FOR
         * THE OTHER ONE. G258's image exists so that the GATE can execute every
         * assertion — it carries PostgreSQL 17 and chromium and deliberately
         * nothing else, because `docs/runner-image-provisioning.md` rules that
         * the gate's dependencies belong in the image rather than in the
         * workflow. The BUILD stage needs neither of those and needs a Docker
         * daemon and the AWS CLI, which the curated image has and ours does not.
         *
         * ⚠️ RESIST PUTTING DOCKER IN THE CI IMAGE TO UNIFY THEM. The gate
         * project is deliberately NOT privileged — `tests/infra/pipeline.test.mjs`
         * asserts it, on the ground that a gate holding the Docker daemon could
         * push an image. Adding a daemon to the image the gate runs in would
         * make that assertion a formality.
         *
         * 🛑 G3273 — AMAZON LINUX 2023, NOT AMAZON LINUX 2, BECAUSE OF NODE.
         * This was `AMAZON_LINUX_2_STANDARD_3_0`, whose default Node is 18 and
         * whose runtime list stops short of 22, while the gate's image carries
         * Node 22 (`infra/ci-image/Dockerfile`). On 2 Oct 2026 the Build stage
         * died in `npm run build:frontend` on `import.meta.dirname` — green at
         * the gate, red here, on the same commit. The AL2023 aarch64 3.0 image
         * offers `nodejs: 22` and still carries Docker and the AWS CLI, which
         * is the whole reason this project is not the CI image. The buildspec
         * pins the major and an INSTALL guard refuses any other one.
         * ⚠️ UNMEASURED PREMISE, NAMED: that this image's runtime list carries
         * 22 is from AWS's runtime table, not from a run — if it does not,
         * INSTALL fails in seconds on `runtime-versions`, before any push.
         */
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
        computeType: codebuild.ComputeType.LARGE,
        // `docker build` needs the daemon; this project is the only one here
        // that does, and the gate above deliberately does not.
        privileged: true,
      },
      environmentVariables: {
        ECR_REGISTRY: { value: `${this.account}.dkr.ecr.${this.region}.amazonaws.com` },
        PLANE_REPOSITORY_NAME: { value: this.planeRepository.repositoryName },
        /**
         * G3003 — WHETHER THE BUNDLE THIS STAGE BUILDS CARRIES THE STAGING
         * PROFILE SWITCHER (THE OWNER'S RULING G2771). `npm run build:frontend`
         * inherits it, `frontend/vite.config.ts` turns exactly `on` into a
         * compile-time `true`, and `testPersonasBuildFlag()` answers `on` for
         * staging ALONE — so a pipeline instantiated for any other environment
         * builds a bundle with no persona in it. The buildspec is NOT edited:
         * it is shared, and trap 12's inline ceiling is near.
         */
        RECONCILE_TEST_PERSONAS: { value: testPersonasBuildFlag(environment) },
      },
      timeout: Duration.minutes(60),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'BuildLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    // ------------------------------------- stage 4 · Migrate, stage 5 · Deploy

    /**
     * The other two stacks, resolved. A prop wins; otherwise the named export.
     *
     * ⚠️ `Fn.importValue` IS NOT A LOOKUP AND `infra/README.md`'s three
     * offline-synth guarantees survive it. It renders an `Fn::ImportValue`
     * intrinsic into the template and reaches no API at synth, exactly as
     * `ecr.Repository.fromRepositoryName` reaches none above. The existence of
     * the export is checked at DEPLOY, which is the right place for it.
     */
    const planes: PlanesRefs = props.planes ?? {
      clusterName: Fn.importValue(planesExportName(environment, 'ClusterName')),
      controlMigrateTaskFamily: Fn.importValue(
        planesExportName(environment, 'ControlMigrateTaskFamily'),
      ),
      dataMigrateTaskFamily: Fn.importValue(
        planesExportName(environment, 'DataMigrateTaskFamily'),
      ),
      controlServiceTaskFamily: Fn.importValue(
        planesExportName(environment, 'ControlServiceTaskFamily'),
      ),
      dataServiceTaskFamily: Fn.importValue(
        planesExportName(environment, 'DataServiceTaskFamily'),
      ),
      controlServiceName: Fn.importValue(planesExportName(environment, 'ControlServiceName')),
      dataServiceName: Fn.importValue(planesExportName(environment, 'DataServiceName')),
      controlContainerName: Fn.importValue(planesExportName(environment, 'ControlContainerName')),
      dataContainerName: Fn.importValue(planesExportName(environment, 'DataContainerName')),
      controlMigrateContainerName: Fn.importValue(
        planesExportName(environment, 'ControlMigrateContainerName'),
      ),
      dataMigrateContainerName: Fn.importValue(
        planesExportName(environment, 'DataMigrateContainerName'),
      ),
    }

    /**
     * The `Edge` stack's two distribution ids — a prop wins; otherwise the
     * named export. G993.
     *
     * ⚠️ `Edge` IS INSTANTIATED IN THE SAME APP AS THIS STACK, so a construct
     * reference would type-check. It is refused for the reason
     * `EDGE_EXPORT_KEYS` gives: CDK would mint the same export under a
     * generated name nobody can read in the console, and a pipeline taking a
     * code dependency on an edge is a join in the wrong direction. The prop
     * exists so a test can synthesise this stack against known values without
     * building the whole app.
     */
    const edge: EdgeRefs = props.edge ?? {
      tenantDistributionId: Fn.importValue(edgeExportName(environment, 'TenantDistributionId')),
      consoleDistributionId: Fn.importValue(edgeExportName(environment, 'ConsoleDistributionId')),
    }

    const network: NetworkRefs = props.network ?? {
      privateSubnetIds: Fn.importValue(networkExportName(environment, 'PrivateSubnetIds')),
      controlPlaneSecurityGroupId: Fn.importValue(
        networkExportName(environment, 'ControlPlaneSecurityGroupId'),
      ),
      dataPlaneSecurityGroupId: Fn.importValue(
        networkExportName(environment, 'DataPlaneSecurityGroupId'),
      ),
    }

    const ecsArn = (resource: string): string =>
      `arn:${this.partition}:ecs:${this.region}:${this.account}:${resource}`

    /**
     * ⚠️ NEITHER OF THESE IS PRIVILEGED AND NEITHER IS THE CI IMAGE.
     *
     * The CI image (G258) carries PostgreSQL and chromium so the GATE can
     * execute every assertion; these two stages need the AWS CLI and nothing
     * else, which is the standard ARM image's business — the same split the
     * Build project's own comment records having learned from `exit status 127`.
     * No Docker daemon is needed by either, so neither asks for one.
     */
    const stageEnvironment = {
      buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
      computeType: codebuild.ComputeType.SMALL,
      privileged: false,
    } as const

    this.migrateProject = new codebuild.PipelineProject(this, 'Migrate', {
      projectName: `reconcile-migrate-${environment}`,
      description:
        'G253: the two one-shot migration tasks, control then data, waited for. ' +
        'A non-zero container exit code stops the pipeline before Deploy runs.',
      environment: stageEnvironment,
      environmentVariables: {
        ECR_REGISTRY: { value: `${this.account}.dkr.ecr.${this.region}.amazonaws.com` },
        PLANE_REPOSITORY_NAME: { value: this.planeRepository.repositoryName },
        ECS_CLUSTER_NAME: { value: planes.clusterName },
        CONTROL_MIGRATE_TASK_FAMILY: { value: planes.controlMigrateTaskFamily },
        DATA_MIGRATE_TASK_FAMILY: { value: planes.dataMigrateTaskFamily },
        /* The MIGRATE task's containers, not the services'. See the props. */
        CONTROL_CONTAINER_NAME: { value: planes.controlMigrateContainerName },
        DATA_CONTAINER_NAME: { value: planes.dataMigrateContainerName },
        PRIVATE_SUBNET_IDS: { value: network.privateSubnetIds },
        CONTROL_SECURITY_GROUP_ID: { value: network.controlPlaneSecurityGroupId },
        DATA_SECURITY_GROUP_ID: { value: network.dataPlaneSecurityGroupId },
        /* Six rounds of the CLI's own ten-minute waiter. An hour is a budget,
         * not a timeout: the stage fails at the end of it rather than killing
         * a forward-only migration mid-file. */
        MIGRATE_WAIT_ROUNDS: { value: '6' },
      },
      /* Longer than the waiter budget, deliberately. If CodeBuild's own timeout
       * fired first the stage would be killed mid-wait and the failure would
       * read as an infrastructure error rather than as a slow migration.
       *
       * 🛑 AND IT WAS NOT LONGER. W0-d, G1306 — THIS SAID 90 AGAINST A BUDGET
       * OF 120, AND THE COMMENT ABOVE IS THE REASON WHY: it reasons about the
       * budget of ONE `migrate_plane` call and the stage makes TWO. §5.1, in a
       * comment rather than in a rule.
       *
       *   tasks-stopped waiter   6s × 100 attempts        = 10 min
       *   MIGRATE_WAIT_ROUNDS    6                        = 60 min per plane
       *   migrate_plane calls    2 (control, then data)   = 120 min
       *   headroom                                        = 15 min
       *                                                     ───────
       *                                                     135 min floor
       *
       * ⚠️ AND THE FAILURE THIS BOUGHT WAS THE ONE THE COMMENT ABOVE EXISTS TO
       * PREVENT, ARRIVING BETWEEN THE TWO CALLS RATHER THAN INSIDE ONE: killed
       * at 90 minutes, the control migration has applied and the data one is
       * still running — and CodeBuild's timeout kills the BUILD, not the ECS
       * task, so a forward-only migration goes on applying with nothing left
       * watching it and no stage to report what it did.
       *
       * `tests/infra/pipeline.test.mjs` derives this arithmetic from the
       * synthesised template and fails if the two numbers ever cross. */
      timeout: Duration.minutes(150),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'MigrateLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    this.deployProject = new codebuild.PipelineProject(this, 'Deploy', {
      projectName: `reconcile-deploy-${environment}`,
      description:
        'G2041: the image tag written into the Planes stack\'s OWN template, so ' +
        'CloudFormation registers the revision and moves the services. The stack ' +
        'and the fleet cannot come apart.',
      environment: stageEnvironment,
      environmentVariables: {
        PLANE_REPOSITORY_NAME: { value: this.planeRepository.repositoryName },
        ECS_CLUSTER_NAME: { value: planes.clusterName },
        CONTROL_SERVICE_NAME: { value: planes.controlServiceName },
        DATA_SERVICE_NAME: { value: planes.dataServiceName },
        CONTROL_SERVICE_TASK_FAMILY: { value: planes.controlServiceTaskFamily },
        DATA_SERVICE_TASK_FAMILY: { value: planes.dataServiceTaskFamily },
        /**
         * 🛑 G2041 — THE ONE STACK THIS STAGE MAY WRITE, BY NAME.
         *
         * A NAME and not an ARN, and not a construct reference: `Planes` is in
         * this app, so a reference would type-check — and it is refused for
         * the reason `EDGE_EXPORT_KEYS` gives one stack over. A pipeline
         * taking a code dependency on the thing it deploys is a join in the
         * wrong direction, and CDK would mint a cross-stack export for it,
         * which `Planes` must not gain (G1012, G1013). `planesStackName()` in
         * `lib/config.ts` is the ONE spelling; the IAM fence below is built
         * from the same call, so the grant and the target cannot drift.
         */
        PLANES_STACK_NAME: { value: planesStackName(environment) },
        /* One round of the CLI's own SIXTY-minute stack-update-complete waiter
         * (30s x 120 attempts, botocore's). Re-entered rather than believed,
         * exactly as the Migrate stage re-enters its own — but once, because a
         * two-service ECS update that outlives an hour is a fact somebody needs
         * to look at rather than one to wait longer for. Exhausting it FAILS
         * the stage and CANCELS NOTHING: `cancel-update-stack` starts a
         * rollback nobody watched begin, which is the Migrate stage's argument
         * about a half-applied migration wearing a different hat. */
        STACK_UPDATE_WAIT_ROUNDS: { value: '1' },
        /* W0-b, G1305 — the ROLLOUT poll, which is a different thing from the
         * waiter above and is bounded separately because it is waiting for a
         * different event. `services-stable` never reads `rolloutState`; AWS
         * documents that field as reaching COMPLETED AFTER steady state, so
         * the gap between the two is what this budget covers. Twenty polls at
         * fifteen seconds is five minutes, which is generous for a field that
         * normally flips within seconds of the waiter returning — and when it
         * is exhausted the stage FAILS rather than passing, because a rollout
         * still IN_PROGRESS five minutes after steady state is a fact somebody
         * needs to look at. The SLEEP is spelled in the buildspec beside the
         * loop that uses it. */
        ROLLOUT_POLL_ROUNDS: { value: '20' },
        /* ⚠️ G993's THREE FRONTEND VARIABLES ARE NO LONGER HERE — G2221. They
         * are on `PublishSite` below, with the buildspec that reads them, the
         * grants that need them and nothing else. This project cannot name the
         * site bucket at all now, which is the point rather than a side
         * effect. */
      },
      /* 🛑 W0-d, G1306, AS RE-DERIVED UNDER G2041 — AND THE BUDGET WENT DOWN,
       * WHICH IS WORTH A LINE BECAUSE IT IS THE OPPOSITE OF WHAT A BIGGER
       * DEPLOY STAGE LOOKS LIKE. Every term is a number in this tree except
       * the AWS waiter ceilings, which are botocore's and are named as such:
       *
       *   ECS ServicesStable       15s × 40 attempts        = 10 min
       *   CloudFront InvalidationCompleted
       *                            20s × 30 attempts        = 10 min
       *   CFN StackUpdateComplete  30s × 120 attempts       = 60 min
       *
       *   STACK_UPDATE_WAIT_ROUNDS 1 × 60 min               =  60 min
       *   ROLLOUT_POLL_ROUNDS 20 × 15s × 2 planes           =  10 min
       *                                                       ───────
       *                                                        70 min budget
       *   headroom                                          =  15 min
       *                                                       ───────
       *                                                        85 min floor
       *
       * ⚠️ **THE TWO INVALIDATION WAITERS LEFT THIS SUM ON 28 Sep 2026 — G2221
       * — AND THE OLD LINE IS QUOTED RATHER THAN DELETED, because the
       * arithmetic is the artefact:** `invalidation waiters 10 min × 2
       * distributions = 20 min`, for a 90-minute budget and a 105-minute
       * floor. They are now `PublishSite`'s, and that project carries its own
       * derivation. **The timeout is NOT lowered to match**, for the same
       * reason it was not lowered when the budget last fell: a ceiling costs
       * nothing when a deploy takes eight minutes, and spending headroom buys
       * nothing. ⚠️ **AND THE TWO PROJECTS' TIMEOUTS DO NOT ADD UP TO THE OLD
       * ONE ON PURPOSE** — they are two CodeBuild builds now, each with its own
       * ceiling, and a stage that runs long in one half no longer eats the
       * other half's budget.
       *
       * ⚠️ THE OLD BUDGET WAS 110 AND IS QUOTED HERE RATHER THAN DELETED,
       * because the arithmetic is the artefact: `DEPLOY_WAIT_ROUNDS 4 × 10 min
       * × 2 planes = 80` was the ECS waiter loop this stage no longer runs.
       * **One CloudFormation update replaces two per-plane ECS rollouts**, so
       * the worst case fell from 110 to 90 and the timeout of 150 covers both.
       * It is NOT lowered: a ceiling costs nothing when a deploy takes eight
       * minutes, and lowering it would spend headroom to buy nothing.
       *
       * 🛑 AND THE SPLIT-FLEET PATH THE OLD ARITHMETIC EXISTED FOR IS NARROWER
       * NOW, WHICH IS A REAL PROPERTY AND NOT A SIDE EFFECT. CodeBuild used to
       * be able to kill this stage BETWEEN the two `deploy_plane` calls, with
       * the control plane moved and the data plane not — one fleet, two
       * images, reported as a timeout. Both services now move inside ONE
       * CloudFormation update, which rolls BOTH back together when it fails.
       * `tests/e2e/fleet-image-verdict.mjs`'s split arm is not retired by
       * that — a `--force-new-deployment` by hand can still split a fleet —
       * but the pipeline is no longer the thing most likely to do it.
       *
       * ⚠️ THE HEADROOM IS WHAT THE STAGE DOES WHILE NOT WAITING, ENUMERATED
       * RATHER THAN ROUNDED: CodeBuild provisioning and artefact download
       * (≤5), the fixed calls — two describe-services, describe-stacks,
       * get-template, update-stack, describe-stack-resources, two more
       * describe-services (≤2) — and `aws s3 sync` of the bundle (≤5).
       * Twelve, rounded to fifteen.
       *
       * `tests/infra/pipeline.test.mjs` derives all of this from the
       * synthesised template and from the buildspec, so the next person to
       * change either number meets a red test rather than a cliff. */
      timeout: Duration.minutes(150),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'DeployLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    /**
     * 🛑 G2301 — THE OWNER'S RULING, 1 Oct 2026: *"Scale up in Deploy — the
     * Deploy stage raises desiredCount to the 'up' value before rolling out,
     * and the next scheduled scale-down returns it to 0."*
     *
     * `WAKE_FLEET_BUILDSPEC_YAML`'s block in `infra/lib/buildspecs.ts` argues
     * the mechanism and the order of its two writes. What is decided HERE is
     * the shape, and it is a third PROJECT in the Deploy stage rather than a
     * block in `UpdateServices`, for the reason G2046 recorded when it took
     * `ecs:UpdateService` away from that role: *"a stage that could still call
     * `UpdateService` could put the fleet back out of step with the stack by
     * hand."* **This project may call it and holds no CloudFormation verb; the
     * Deploy project holds CloudFormation and still no ECS write.** Neither
     * role gained the other's reach (G2303).
     *
     * ⚠️ **THE UP VALUE IS `SERVING_TASKS_WHEN_UP`, READ AND NEVER TYPED.** A
     * concurrent slice may move that constant; this project moves with it, and
     * the plan script refuses at run time if the DEPLOYED `Planes` schedule
     * disagrees (G2305), because `UpdateStack` would otherwise reset the count
     * to the stack's own `DesiredCount` one action later.
     */
    this.wakeProject = new codebuild.PipelineProject(this, 'WakeFleet', {
      projectName: `reconcile-wake-${environment}`,
      description:
        'G2301: raise a fleet the cost schedule scaled to zero to its up value, ' +
        'and refuse to finish until tasks are RUNNING. Never waits on ' +
        'services-stable, which is vacuous at zero.',
      environment: stageEnvironment,
      environmentVariables: {
        ECS_CLUSTER_NAME: { value: planes.clusterName },
        CONTROL_SERVICE_NAME: { value: planes.controlServiceName },
        DATA_SERVICE_NAME: { value: planes.dataServiceName },
        /* PER PLANE — G2461. `SERVING_TASKS_WHEN_UP[env]` is a `{ data,
         * control }` record since R-POOL (G2261–G2268), and each service's
         * Planes `DesiredCount` and `…MorningUp` are built from its OWN
         * member, so the wake must raise each to its own. */
        WAKE_DESIRED_COUNT_CONTROL: { value: String(SERVING_TASKS_WHEN_UP[environment].control) },
        WAKE_DESIRED_COUNT_DATA: { value: String(SERVING_TASKS_WHEN_UP[environment].data) },
        /* Forty polls at fifteen seconds is ten minutes PER PLANE — a Fargate
         * cold start plus an image pull plus the ALB's first health checks is
         * a few minutes, and a fleet still not running after ten is a fact for
         * a person, not a reason to wait longer. */
        WAKE_POLL_ROUNDS: { value: '40' },
      },
      /* 🛑 W0-d's ARITHMETIC FOR THIS PROJECT — G2306:
       *
       *   WAKE_POLL_ROUNDS 40 × 15s × 2 planes              =  20 min budget
       *   headroom (provisioning ≤5, six describe/write calls ≤2) = 10 min
       *                                                       ───────
       *                                                        30 min floor
       *
       * Forty-five, so a slow cold start fails as a TIMEOUT NAMED BY THE
       * SCRIPT rather than as CodeBuild killing a build mid-poll.
       * `tests/infra/pipeline.test.mjs` derives this from the template. */
      timeout: Duration.minutes(45),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'WakeFleetLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    /**
     * 🛑 G2221 — THE DEPLOY STAGE'S SECOND ACTION, AND IT EXISTS BECAUSE ONE
     * PROJECT COULD NOT HOLD BOTH HALVES ANY MORE.
     *
     * G2041 took `DEPLOY_BUILDSPEC_YAML` from 14,661 characters to **28,180**
     * against CodeBuild's inline ceiling of **25,600**. `cdk synth` rendered
     * it, `cdk diff` showed it, `npm run check` was EXIT 0 — and
     * `UpdateProject` refused it, which CloudFormation reports by rolling the
     * whole stack back:
     *
     *     UPDATE_FAILED | AWS::CodeBuild::Project | Deploy
     *     "Failed to call UpdateProject, reason: Max buildspec length is 25600"
     *
     * `CODEBUILD_INLINE_BUILDSPEC_BYTES` in `infra/lib/buildspecs.ts` carries
     * the measurement and the three shapes that were refused — **including the
     * obvious one**, a buildspec read from the artefact, which removes the
     * ceiling and removes the DEPLOY GATE with it.
     *
     * ✅ **THE SEAM IS THE ONE G993 ALREADY ARGUED FOR IN PROSE**, so this is a
     * shape the pipeline wanted anyway rather than a byte trick: *"THE FRONTEND
     * GOES LAST, AFTER BOTH PLANES ARE STABLE, AND THE ORDER IS THE SAME
     * ARGUMENT `Migrate` MAKES IN FRONT OF `Deploy`"* — and `Migrate` is a
     * separate stage for exactly that reason. Two things get strictly better:
     *
     *   · **THE ORDER BECOMES STRUCTURAL.** It was `set -eu` in one shell; it
     *     is `runOrder: 2` now, which no edit to a command list can rearrange,
     *     and a failed `UpdateServices` means this action is never started.
     *   · **THE IAM SPLITS (G2223).** One role held
     *     `cloudformation:UpdateStack` on the `Planes` stack AND
     *     `s3:DeleteObject` on the site bucket AND
     *     `cloudfront:CreateInvalidation`, for the whole ninety minutes. They
     *     are two roles now: the thing that can empty the site bucket cannot
     *     reach CloudFormation, and the thing that writes the stack value holds
     *     no S3 write at all. That is G263's *"and nothing else"* sharpened,
     *     and it is the dividend rather than the cost.
     *
     * ⚠️ **NO NEW GRANT IS MINTED HERE AND NO GRANT IS WIDENED.** G994's four
     * actions and two resource shapes are MOVED, verbatim, from
     * `this.deployProject` to this project; read their block below, which is
     * unchanged and still names everything it refuses.
     */
    this.publishSiteProject = new codebuild.PipelineProject(this, 'PublishSite', {
      projectName: `reconcile-publish-${environment}`,
      description:
        'G993: the frontend bundle published to the site bucket and both ' +
        'distributions invalidated, after both planes have settled on the ' +
        'revision CloudFormation owns.',
      environment: stageEnvironment,
      environmentVariables: {
        /* G993 — the frontend half. The BUCKET is a pure function of the
         * environment and needs no export; the two DISTRIBUTION IDs are the one
         * value this app cannot spell, so they are named exports. Both
         * arguments are on `EDGE_EXPORT_KEYS` in `infra/lib/config.ts`.
         *
         * ⚠️ THESE THREE WERE ON THE `Deploy` PROJECT UNTIL 28 Sep 2026 AND
         * MOVED WHOLE (G2221). Nothing else came with them: this project holds
         * NO cluster name, NO service name, NO task family and NO stack name,
         * so the half that publishes a bundle cannot name the fleet at all. */
        FRONTEND_BUCKET_NAME: { value: frontendBucketName(environment) },
        TENANT_DISTRIBUTION_ID: { value: edge.tenantDistributionId },
        CONSOLE_DISTRIBUTION_ID: { value: edge.consoleDistributionId },
      },
      /* 🛑 W0-d's ARITHMETIC, RE-DERIVED FOR THIS HALF ALONE — G2224. Every
       * term is a number in this tree except the AWS waiter ceiling, which is
       * botocore's and is named as such:
       *
       *   CloudFront InvalidationCompleted
       *                            20s × 30 attempts        = 10 min
       *
       *   invalidation waiters 10 min × 2 distributions     =  20 min
       *                                                       ───────
       *                                                        20 min budget
       *   headroom                                          =  15 min
       *                                                       ───────
       *                                                        35 min floor
       *
       * ⚠️ THE HEADROOM IS WHAT THIS PROJECT DOES WHILE NOT WAITING, AND IT IS
       * THE SAME FIFTEEN THE `Deploy` PROJECT ENUMERATES RATHER THAN A ROUNDED
       * GUESS: CodeBuild provisioning and artefact download (≤5), `aws s3
       * sync` of the bundle (≤5), and two `create-invalidation` calls (≤2).
       * Twelve, rounded to fifteen.
       *
       * 🛑 SIXTY AND NOT THIRTY-FIVE, AND THE GAP IS DELIBERATE. An
       * invalidation that outlives botocore's own waiter is a CloudFront fact
       * nobody here controls, and the failure this timeout exists to avoid is
       * the stage being killed BETWEEN the two distributions — the tenant edge
       * invalidated and the consoles left on an index.html naming hashed
       * assets the sync has already deleted. That is the split-fleet shape one
       * project over, wearing a CDN.
       *
       * `tests/infra/pipeline.test.mjs` §7 derives this from the synthesised
       * template and from the buildspec, so the next person to change either
       * number meets a red test rather than a cliff. */
      timeout: Duration.minutes(60),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'PublishSiteLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    /**
     * 🛑 G2961 — THE RUN WORKER IS RETAGGED BY THE PIPELINE TOO, AND THIS IS
     * A FOURTH PROJECT IN THE DEPLOY STAGE RATHER THAN A BLOCK IN `Deploy`.
     *
     * The live audit of 2 Oct 2026 found `reconcile-run-queue-staging`'s
     * worker task definition on `cc58f357` — nine days behind both planes —
     * because G2041 retagged `Planes` ALONE and `RunQueue` bakes the same
     * image tag into its own template. `RETAG_RUN_WORKER_BUILDSPEC_YAML`
     * carries the argument and the order (G2963); what is decided HERE is the
     * shape, and it is a separate project for two reasons that are each
     * sufficient:
     *
     *   · **TRAP 12 (G2221).** `DEPLOY_BUILDSPEC_YAML` sits at ~24,400 of
     *     CodeBuild's 25,600 inline characters and this action is ~15,900.
     *     The repair trap 12 recorded is *split, never cull*.
     *   · **G2223's ROLE SPLIT, KEPT.** The role that writes `Planes` cannot
     *     name `RunQueue`, and this one cannot name `Planes`, the fleet's two
     *     services, the site bucket or a distribution.
     */
    this.retagRunWorkerProject = new codebuild.PipelineProject(this, 'RetagRunWorker', {
      projectName: `reconcile-retag-run-worker-${environment}`,
      description:
        'G2961: the image tag written into the RunQueue stack\'s OWN template, after ' +
        'both planes settled on it, so the run worker cannot lag the planes.',
      environment: stageEnvironment,
      environmentVariables: {
        PLANE_REPOSITORY_NAME: { value: this.planeRepository.repositoryName },
        /* 🛑 THE ONE STACK THIS PROJECT MAY WRITE, BY NAME — and the IAM
         * fence below is built from the SAME call, so the grant and the
         * target cannot drift. A NAME and not a construct reference, for
         * `PLANES_STACK_NAME`'s reason: a pipeline taking a code dependency
         * on the thing it deploys would mint an export on `RunQueue`. */
        RUN_QUEUE_STACK_NAME: { value: runQueueStackName(environment) },
        RUN_WORKER_TASK_FAMILY: { value: runWorkerTaskFamily(environment) },
        RUN_WORKER_RULE_NAME: { value: runWorkerScheduleRuleName(environment) },
        /* One round of the CLI's own sixty-minute stack-update-complete
         * waiter, exactly as `Deploy` carries it and for the same reason. */
        STACK_UPDATE_WAIT_ROUNDS: { value: '1' },
      },
      /* 🛑 W0-d's ARITHMETIC FOR THIS PROJECT — G2966:
       *
       *   CFN StackUpdateComplete  30s × 120 attempts       = 60 min
       *   STACK_UPDATE_WAIT_ROUNDS 1 × 60 min               = 60 min budget
       *   headroom (provisioning ≤5, nine describe/read calls ≤2,
       *             rounded)                                = 15 min
       *                                                       ───────
       *                                                        75 min floor
       *
       * Ninety, so a slow update fails as the SCRIPT's named timeout rather
       * than as CodeBuild killing a build mid-wait. Derived from the template
       * by `tests/infra/pipeline-retags-run-worker.test.mjs`. */
      timeout: Duration.minutes(90),
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, 'RetagRunWorkerLogs', {
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
    })

    /* 🛑 ONE VARIABLE, TWO PROJECTS. This is the whole of "one gate, two
     * moments": if these two lines ever name different constants, the pull
     * request and the trunk are answering different questions and G108 is
     * broken in the least visible way possible. `tests/infra/pipeline.test.mjs`
     * compares the two synthesised buildspecs BYTE FOR BYTE for that reason. */
    attachBuildSpecYaml(this.gateProject, GATE_BUILDSPEC_YAML)
    if (this.prGateProject !== undefined) {
      attachBuildSpecYaml(this.prGateProject, GATE_BUILDSPEC_YAML)
      /* The account-level credential is what authenticates the clone; this call
       * is deliberately a no-op and marks where source authentication is
       * decided. `infra/lib/connections.ts` carries the measurement. */
      codeConnectionsAuthOverride(this.prGateProject, connectionArn.valueAsString)
    }
    attachBuildSpecYaml(this.buildProject, PLANE_BUILD_BUILDSPEC_YAML)
    attachBuildSpecYaml(this.migrateProject, MIGRATE_BUILDSPEC_YAML)
    attachBuildSpecYaml(this.wakeProject, WAKE_FLEET_BUILDSPEC_YAML)
    attachBuildSpecYaml(this.deployProject, DEPLOY_BUILDSPEC_YAML)
    attachBuildSpecYaml(this.publishSiteProject, PUBLISH_SITE_BUILDSPEC_YAML)
    attachBuildSpecYaml(this.retagRunWorkerProject, RETAG_RUN_WORKER_BUILDSPEC_YAML)

    // ------------------------------------------------- G263: the ECS fences

    /**
     * G263: *"the pipeline role may push to its own ECR repositories, **run its
     * own task definitions and deploy stacks tagged `Project=reconcile`** — and
     * nothing else in a SHARED account."*
     *
     * 🛑 EVERY STATEMENT BELOW NAMES A RESOURCE. There is no `ecs:*` and no
     * `Resource: '*'` on any action that CHANGES something — with the two
     * exceptions AWS itself forces, which are named where they occur rather
     * than left for a reviewer to notice.
     */

    /* `RegisterTaskDefinition` and `DescribeTaskDefinition` take NO resource in
     * IAM — AWS's own design; a task definition family does not exist until the
     * first revision is registered, so there is nothing to name. The fence on
     * what those revisions can BE is `iam:PassRole` below: a task definition is
     * only dangerous in proportion to the role it carries, and this principal
     * may pass only `reconcile-*` roles and only to ECS. */
    /**
     * 🛑 THE MIGRATE STAGE ALONE, SINCE G2041 — AND THE DEPLOY STAGE LOSING
     * THESE TWO GRANTS IS A NARROWING, NOT AN OVERSIGHT.
     *
     * ⚠️ THIS LOOP READ `[this.migrateProject, this.deployProject]` AND IS
     * CORRECTED RATHER THAN QUIETLY REWRITTEN, because a reader comparing this
     * file to `docs/build/deploy-handoff.md` would otherwise conclude a grant
     * had been dropped by accident. **The Deploy stage no longer registers a
     * task definition at all**: CloudFormation registers the revision, as the
     * role already associated with the `Planes` stack, so a `RegisterTaskDefinition`
     * or a `PassRole` on this project would be a privilege that OUTLIVED the
     * absence of its writer — `0004`'s rule in the direction G510 used it,
     * where `DELETE ON tenant.session` was taken away because nothing deleted
     * a session.
     *
     * 🟢 AND IT IS THE HALF OF THIS SLICE THAT MAKES THE ACCOUNT SAFER RATHER
     * THAN WIDER: `iam:PassRole` on `reconcile-*` was the broadest grant this
     * pipeline held, and the Deploy stage — the one stage that runs on every
     * merge to `main` and touches live services — no longer holds it.
     */
    this.migrateProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'RegisterRevisionsOfTaskDefinitions',
        actions: ['ecs:DescribeTaskDefinition', 'ecs:RegisterTaskDefinition'],
        resources: ['*'],
      }),
    )
    this.migrateProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'PassOnlyReconcileTaskRolesAndOnlyToEcs',
        actions: ['iam:PassRole'],
        resources: [`arn:${this.partition}:iam::${this.account}:role/reconcile-*`],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'ecs-tasks.amazonaws.com' },
        },
      }),
    )

    /* 🛑 RUN ONLY ITS OWN TASK DEFINITIONS, AND ONLY IN ITS OWN CLUSTER. The
     * `:*` suffix is the REVISION wildcard and is the point: a family is fenced,
     * a revision is not pinned, so the other stack may redeploy without
     * silently narrowing this policy to a revision that no longer exists. */
    this.migrateProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'RunOnlyItsOwnMigrationTaskDefinitions',
        actions: ['ecs:RunTask'],
        resources: [
          ecsArn(`task-definition/${planes.controlMigrateTaskFamily}:*`),
          ecsArn(`task-definition/${planes.dataMigrateTaskFamily}:*`),
        ],
        conditions: { ArnEquals: { 'ecs:cluster': ecsArn(`cluster/${planes.clusterName}`) } },
      }),
    )
    this.migrateProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ReadOnlyTheTasksItStarted',
        actions: ['ecs:DescribeTasks'],
        resources: [ecsArn(`task/${planes.clusterName}/*`)],
      }),
    )
    /* The early digest probe in the Migrate buildspec — one second here instead
     * of four minutes inside ECS with a task that cannot pull. */
    this.migrateProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ProveTheDigestExistsBeforeStartingAnything',
        actions: ['ecr:DescribeImages'],
        resources: [this.planeRepository.repositoryArn],
      }),
    )

    /* 🛑 READ ONLY ITS OWN SERVICES — AND SINCE G2041 IT MAY NO LONGER WRITE
     * THEM. Two named service ARNs; no wildcard on the service name, so a
     * second service appearing in this cluster is not something this pipeline
     * can touch.
     *
     * ⚠️ THIS CARRIED `ecs:UpdateService` AND IS CORRECTED RATHER THAN QUIETLY
     * REWRITTEN. CloudFormation moves the services now, as the role already
     * associated with the `Planes` stack; this stage reads them to refuse a
     * fleet scaled to zero before the update and to settle the rollout after
     * it. **A stage that could still call `UpdateService` could put the fleet
     * back out of step with the stack by hand** — which is the entire defect
     * this slice ends, left reachable by a privilege nothing uses. */
    this.deployProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ReadOnlyItsOwnServices',
        actions: ['ecs:DescribeServices'],
        resources: [
          ecsArn(`service/${planes.clusterName}/${planes.controlServiceName}`),
          ecsArn(`service/${planes.clusterName}/${planes.dataServiceName}`),
        ],
      }),
    )

    /**
     * 🛑 G2041/G2045 — THE ONE STACK THE PIPELINE MAY WRITE, AND THE FOUR
     * VERBS IT MAY WRITE IT WITH.
     *
     * The owner's ruling of 22 Sep 2026 — *"make the pipeline write the stack
     * value"* — is the only reason any `cloudformation:` verb appears on a
     * CodeBuild project here, and G263 anticipated it in its own words: *"the
     * pipeline role may … deploy stacks tagged `Project=reconcile` — and
     * nothing else in a SHARED account."*
     *
     * ⚠️ **ONE STACK BY NAME, NOT A TAG CONDITION, AND THE DIFFERENCE IS THE
     * WHOLE FENCE.** `DeployRole` below is fenced with `aws:ResourceTag/Project`
     * because it is a general CloudFormation role for a `cdk deploy` nobody
     * has written; this grant does not need to be general, so it is not. The
     * ARN carries `planesStackName(environment)` — the same call the Deploy
     * project's `PLANES_STACK_NAME` is built from, so the grant and the target
     * are ONE spelling and cannot drift into a stage that may update a stack
     * it cannot name, or name one it may not update.
     *
     * 🛑 **`CreateStack` AND `DeleteStack` ARE ABSENT AND MUST STAY ABSENT.**
     * The stage updates a stack that already exists; a pipeline that could
     * create one could mint infrastructure on a merge, and one that could
     * delete this one could take both planes and their ALBs out in a single
     * green build.
     *
     * ⚠️ **AND `GetTemplate` IS A READ THIS STAGE GENUINELY NEEDS**, because
     * the template it writes back is the one CloudFormation already has —
     * that is what makes the update narrow BY CONSTRUCTION rather than by
     * review, and it is why no `cdk synth` and no source tree is involved.
     *
     * ⚠️ **NO `iam:PassRole` FOR THE STACK'S EXECUTION ROLE — G2048.** No
     * `--role-arn` is passed, so CloudFormation reuses the role already
     * associated with the stack (`cdk-reconcile-cfn-exec-role-…`, read from
     * the live stack on 23 Sep 2026). AWS documents that reuse; **whether the
     * CALLER additionally needs `PassRole` for it is the one premise in this
     * slice nobody here has witnessed**, and a grant made in case would be a
     * privilege ahead of its writer. If the premise is wrong the first
     * pipeline run fails LOUDLY, naming the role, with the fleet untouched —
     * and `docs/build/deploy-handoff.md` §17 tells the next deployer to watch
     * that run for exactly this.
     */
    this.deployProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'WriteTheImageTagIntoOnlyThePlanesStack',
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DescribeStackResources',
          'cloudformation:GetTemplate',
          'cloudformation:UpdateStack',
        ],
        resources: [
          `arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/${planesStackName(environment)}/*`,
        ],
      }),
    )

    /* G2041 — the tag is checked against the digest before it is written, so
     * this stage reads the registry exactly as the Migrate stage does and for
     * the same one-second-instead-of-four-minutes reason. `DescribeImages` is
     * a read of ITS OWN repository and nothing wider; there is no push, no
     * pull and no `GetAuthorizationToken` here, because this stage never
     * touches an image — only its name. */
    /**
     * 🛑 G2303 — THE WAKE ROLE: A DESIRED COUNT ON TWO NAMED SERVICES, AND THE
     * BOUNDS THE SCHEDULE MOVES. NOTHING ELSE.
     *
     * `ecs:UpdateService` is scoped to the same two service ARNs the Deploy
     * role may only READ. It is the verb G2046 removed from that role, and it
     * lives here instead of there so the role that writes the stack value
     * still cannot move the fleet by hand. ⚠️ It CAN change a task definition
     * through `--task-definition` — IAM has no condition key that restricts
     * `UpdateService` to `--desired-count` — so the buildspec's single call is
     * the fence on that, and it is named as a convention rather than claimed
     * as a control.
     *
     * ⚠️ **THE TWO DESCRIBES TAKE NO RESOURCE, BY AWS'S DESIGN** — they are
     * list operations. **`RegisterScalableTarget` IS FENCED TO THIS ACCOUNT'S
     * SCALABLE TARGETS IN THIS REGION AND NO NARROWER**, because a scalable
     * target's ARN carries a random id rather than the service it scales, so
     * there is nothing service-shaped to name. **Whether IAM evaluates that
     * ARN or requires `*` is UNMEASURED (G2307)**; if the premise is wrong the
     * first wake fails LOUDLY with AccessDenied and nothing has moved, which
     * is the discoverable direction — G2048's precedent, one service over.
     */
    this.wakeProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'SetTheDesiredCountOfOnlyItsOwnServices',
        actions: ['ecs:DescribeServices', 'ecs:UpdateService'],
        resources: [
          ecsArn(`service/${planes.clusterName}/${planes.controlServiceName}`),
          ecsArn(`service/${planes.clusterName}/${planes.dataServiceName}`),
        ],
      }),
    )
    this.wakeProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ReadTheScheduleThatScaledItDown',
        actions: [
          'application-autoscaling:DescribeScalableTargets',
          'application-autoscaling:DescribeScheduledActions',
        ],
        resources: ['*'],
      }),
    )
    this.wakeProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'RaiseTheBoundsTheScheduleLowered',
        actions: ['application-autoscaling:RegisterScalableTarget'],
        resources: [
          `arn:${this.partition}:application-autoscaling:${this.region}:${this.account}:scalable-target/*`,
        ],
      }),
    )

    this.deployProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ProveTheTagNamesTheBytesBeforeWritingIt',
        actions: ['ecr:DescribeImages'],
        resources: [this.planeRepository.repositoryArn],
      }),
    )

    /**
     * 🛑 G2964 — THE RUN-WORKER RETAG'S FENCE. ONE STACK BY NAME, THE SAME
     * FIVE CLOUDFORMATION VERBS `Deploy` HOLDS ON `Planes`, AND THREE READS.
     *
     * ⚠️ **NO `iam:PassRole`, AND THIS TIME THE PREMISE IS NOT MERELY
     * DOCUMENTED.** G2048 recorded *"whether the CALLER additionally needs
     * `PassRole`"* as the one unwitnessed premise of G2041. AWS's own
     * service-role page says a stack's associated role is used *"even if they
     * don't have permission to pass it"* — and the 2 Oct 2026 audit is the
     * measurement: both planes run images NEWER than any hand deploy, and the
     * only path that moves them is `Deploy`'s `UpdateStack`, which holds no
     * `PassRole`. A `RunQueue` update registers a task definition carrying two
     * roles and rewrites an Events target carrying a third, exactly the shape
     * a `Planes` update has. `STACK_HAS_SERVICE_ROLE_JS` refuses a stack with
     * no associated role, which is the one case where that would not hold.
     *
     * 🛑 **`CreateStack` AND `DeleteStack` ARE ABSENT** — a pipeline that
     * could delete `RunQueue` could drop the run queue and every admitted run
     * in it in one green build.
     *
     * ⚠️ **`ecs:DescribeTaskDefinition` TAKES `*`, BY AWS'S DESIGN** — it
     * supports no resource-level permission, which is why `Migrate` holds it
     * the same way. It is a read. `events:ListTargetsByRule` names ONE rule.
     */
    this.retagRunWorkerProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'WriteTheImageTagIntoOnlyTheRunQueueStack',
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DescribeStackResources',
          'cloudformation:GetTemplate',
          'cloudformation:UpdateStack',
        ],
        resources: [
          `arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/${runQueueStackName(environment)}/*`,
        ],
      }),
    )
    this.retagRunWorkerProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ProveTheTagNamesTheBytesBeforeWritingIt',
        actions: ['ecr:DescribeImages'],
        resources: [this.planeRepository.repositoryArn],
      }),
    )
    this.retagRunWorkerProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ReadTheRegisteredWorkerRevision',
        actions: ['ecs:DescribeTaskDefinition'],
        resources: ['*'],
      }),
    )
    this.retagRunWorkerProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ReadWhatTheWorkerScheduleFires',
        actions: ['events:ListTargetsByRule'],
        resources: [
          `arn:${this.partition}:events:${this.region}:${this.account}:rule/${runWorkerScheduleRuleName(environment)}`,
        ],
      }),
    )

    /**
     * 🛑 G994 — THE FRONTEND HALF'S FENCE. FOUR ACTIONS, TWO RESOURCE SHAPES,
     * AND EVERY ONE OF THEM NAMES SOMETHING.
     *
     * ⚠️ **THESE THREE STATEMENTS MOVED FROM `deployProject` TO
     * `publishSiteProject` ON 28 Sep 2026 — G2221/G2223 — AND NOTHING IN THEM
     * CHANGED.** Same four actions, same two resource shapes, same refusals.
     * What changed is the ROLE they sit on: the project that can empty the site
     * bucket is no longer the project that calls `cloudformation:UpdateStack`
     * on the `Planes` stack, which is G263's *"and nothing else"* holding over
     * a smaller principal rather than a bigger one.
     *
     * G263: *"the pipeline role may push to its own ECR repositories, run its
     * own task definitions and deploy stacks tagged `Project=reconcile` — and
     * nothing else in a SHARED account."* Publishing a bundle is a fifth verb
     * that ruling did not anticipate, so it is fenced the same way the other
     * four are: by resource, never by service.
     *
     * ⚠️ WHAT IS DELIBERATELY ABSENT, EACH FOR A REASON RATHER THAN BY
     * OVERSIGHT:
     *
     *   · **NO `s3:GetObject`.** `aws s3 sync` from a local directory to a
     *     bucket compares by size and modification time from the LISTING; it
     *     never reads an object back. Granting a read here would let a
     *     compromised Deploy stage exfiltrate whatever else ends up in that
     *     bucket, to save nothing.
     *   · **NO `s3:PutBucketPolicy`, NO `s3:PutBucketAcl`, NO
     *     `s3:PutBucketWebsite`.** The bucket is private and served through
     *     OAC; a stage that could rewrite its policy could make the bundle —
     *     and anything beside it — world-readable without touching a template.
     *   · **NO `cloudfront:UpdateDistribution` and NO
     *     `cloudfront:CreateDistribution`.** An invalidation empties a cache;
     *     an update changes where the product's front door points. The Deploy
     *     stage has no business doing the second, and `infra/` is where a
     *     distribution changes.
     *   · **NO `cloudfront:ListDistributions`.** It takes no resource, so it
     *     can only be granted on `*` — a reader of every distribution in a
     *     shared account. The ids arrive as named exports instead, which is
     *     what `EDGE_EXPORT_KEYS` is for.
     *
     * ⚠️ A CLOUDFRONT DISTRIBUTION ARN HAS NO REGION — `arn:<p>:cloudfront::<a>:distribution/<id>`,
     * with the region segment EMPTY. Writing `${this.region}` there produces an
     * ARN that matches nothing, and an IAM policy that matches nothing fails at
     * the invalidation rather than at synth.
     */
    const cloudFrontDistributionArn = (id: string): string =>
      `arn:${this.partition}:cloudfront::${this.account}:distribution/${id}`

    this.publishSiteProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ListOnlyTheFrontendBucketItPublishesTo',
        /* `sync` reads the LISTING to decide what to upload and what `--delete`
         * removes. This is on the BUCKET arn; the object statement below is on
         * its contents, and the two are different resources by S3's design. */
        actions: ['s3:ListBucket'],
        resources: [`arn:${this.partition}:s3:::${frontendBucketName(environment)}`],
      }),
    )
    this.publishSiteProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'PublishAndPruneOnlyTheFrontendBundle',
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: [`arn:${this.partition}:s3:::${frontendBucketName(environment)}/*`],
      }),
    )
    this.publishSiteProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'InvalidateOnlyTheTwoDistributionsThatServeThatBundle',
        /* `GetInvalidation` is what `aws cloudfront wait invalidation-completed`
         * polls. Without it the stage would start an invalidation and be unable
         * to find out whether it finished — a green deploy over a distribution
         * still serving the previous page. */
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
        resources: [
          cloudFrontDistributionArn(edge.tenantDistributionId),
          cloudFrontDistributionArn(edge.consoleDistributionId),
        ],
      }),
    )

    /* G263 — the build role may push to ITS OWN repository and read ITS OWN
     * scan findings. It has no reach into the CI image repository, no `ecs:*`
     * and no `cloudformation:*`. */
    this.planeRepository.grantPullPush(this.buildProject)
    this.buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecr:DescribeImages', 'ecr:DescribeImageScanFindings'],
        resources: [this.planeRepository.repositoryArn],
      }),
    )
    /* Account-wide by AWS's own design: the action takes no resource. It mints
     * a login token; the grants above decide what that token reaches. */
    this.buildProject.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }),
    )

    // ---------------------------------------------------------- the pipeline

    const sourceOutput = new codepipeline.Artifact('Source')
    const buildOutput = new codepipeline.Artifact('BuildArtefacts')

    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `reconcile-${environment}`,
      pipelineType: codepipeline.PipelineType.V2,
      /**
       * 🛑 QUEUED, NOT PARALLEL, AND THE FIRST MERGE TO `main` PROVED WHY.
       *
       * The merge of #365 started TWO executions six seconds apart — 21:27:21
       * and 21:27:27 — on the SAME commit. Both built the same image and both
       * pushed the SAME tag to an `IMAGE_TAG_MUTABILITY: IMMUTABLE` repository.
       * One won; the other failed at `docker push` with a bare `exit status 1`
       * after its layers reported `Pushed`, which reads like a network fault
       * and is not one.
       *
       * ⚠️ THE DEFAULT IS `SUPERSEDED`, AND IT DID NOT SAVE US. Superseding
       * replaces a run still waiting to ENTER a stage; two runs that both got
       * into Build are already past that point and race there. `QUEUED` serialises
       * them: the second waits for the first to leave each stage.
       *
       * The immutable tag is not the bug — it is the property G262 wants, and
       * it is what turned a silent double-deploy into a loud failure. Two
       * pipelines racing on one artefact is the bug.
       */
      executionMode: codepipeline.ExecutionMode.QUEUED,
      restartExecutionOnUpdate: false,
      crossAccountKeys: false,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new actions.CodeStarConnectionsSourceAction({
              actionName: 'GitHub',
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              branch: GITHUB_TRUNK_BRANCH,
              connectionArn: connectionArn.valueAsString,
              output: sourceOutput,
              /* The gate runs `npm run check`, and `tools/check-g-numbers.mjs`
               * has a trunk-collision half that asks whether a G number is
               * absent at `git merge-base origin/main HEAD`. Under a packaged
               * source artefact there is no git history at all and that half
               * prints "trunk collision check unavailable (non-fatal)" — the
               * same green-by-unavailability the workflow's own comment records
               * it suffering under a depth-1 checkout. `codeBuildCloneOutput`
               * hands CodeBuild a real clone instead of a zip, which is the
               * CodePipeline spelling of `fetch-depth: 0`. */
              codeBuildCloneOutput: true,
            }),
          ],
        },
        {
          /* G108. Two commands. If you are about to add a third action to this
           * stage, add it as a NEW STAGE below instead — that is the whole of
           * G257's "G108 is not amended". */
          stageName: 'Gate',
          actions: [
            new actions.CodeBuildAction({
              actionName: 'Check',
              project: this.gateProject,
              input: sourceOutput,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new actions.CodeBuildAction({
              actionName: 'ImageAndBundle',
              project: this.buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          /* 🛑 STAGE 4. A SEPARATE STAGE, WHICH IS THE WHOLE OF "G108 IS NOT
           * AMENDED" — not a step in the gate, not a phase in the build. It
           * runs `server/{control,data}-plane/migrate-main.ts` as one-shot ECS
           * tasks and WAITS FOR EXIT 0; a non-zero exit, a task that never
           * started, or a container with no exit code at all all fail the
           * action, and CodePipeline does not begin Deploy behind a failed
           * stage. `MIGRATE_BUILDSPEC_YAML` carries each of those three
           * failures explicitly, because only the first is the obvious one.
           *
           * ITS INPUT IS THE BUILD ARTEFACT, NOT THE SOURCE. The migrations
           * that run are the ones in the image being deployed — `ecs run-task`
           * cannot override an image, so the task definition is re-registered
           * against the digest first. See `RETAG_TASK_DEFINITION_JS`. */
          stageName: 'Migrate',
          actions: [
            new actions.CodeBuildAction({
              actionName: 'RunMigrations',
              project: this.migrateProject,
              input: buildOutput,
            }),
          ],
        },
        {
          /* 🛑 STAGE 5, AND THERE IS NO MANUAL APPROVAL ACTION IN FRONT OF IT.
           * G257: `main` → staging on merge, and the owner ruled the automatic
           * deploy explicitly. An approval action here would be a second
           * decision nobody took. Prod promotion is a SECOND PIPELINE and is
           * still unbuilt — `PROD_PROMOTION_PIPELINE_TODO`. */
          stageName: 'Deploy',
          actions: [
            /* 🛑 G2301 — WAKE FIRST. A fleet the cost schedule scaled to zero
             * is raised and RUNNING before anything is rolled onto it, and a
             * wake that cannot get tasks running fails here, so
             * `UpdateServices` is never STARTED. Its own zero refusal is kept
             * as the second, independent control (G2302). */
            new actions.CodeBuildAction({
              actionName: 'WakeFleet',
              project: this.wakeProject,
              input: buildOutput,
              runOrder: 1,
            }),
            /* ⚠️ `runOrder: 1` UNTIL 1 Oct 2026 — G2301 put `WakeFleet` in
             * front of it. The relative order is the property and it is
             * unchanged. */
            new actions.CodeBuildAction({
              actionName: 'UpdateServices',
              project: this.deployProject,
              input: buildOutput,
              runOrder: 2,
            }),
            /* 🛑 G2221 — THE FRONTEND HALF, AND THE `runOrder` IS THE WHOLE
             * ARGUMENT RATHER THAN A DETAIL. It was the last block of
             * `DEPLOY_BUILDSPEC_YAML` and G993 argued its position in a
             * comment: *"A plane that fails to settle has already failed this
             * stage and the bundle is never published."* That was a claim
             * about `set -eu` running top to bottom in one shell. It is now a
             * claim about CODEPIPELINE, which is strictly stronger — **a
             * failed `UpdateServices` means this action is never STARTED**,
             * and no edit to a command list can reorder it.
             *
             * ⚠️ SAME STAGE, DELIBERATELY, AND NOT A SIXTH STAGE. The two are
             * one deploy: the stage is what succeeds or fails, and
             * `ROLLOUT_VERDICT_JS`'s block reasons about *"the stage that has
             * to make it true"*. A separate stage would also be a place
             * somebody could later hang an approval between a deployed fleet
             * and an unpublished bundle, which is the one state this ordering
             * exists to make brief.
             *
             * ⚠️ AND ITS INPUT IS THE SAME `buildOutput` — `frontend/dist/**`
             * travels in that artefact already and the artefact declaration is
             * untouched by the split. */
            new actions.CodeBuildAction({
              actionName: 'PublishSite',
              project: this.publishSiteProject,
              input: buildOutput,
              runOrder: 3,
            }),
            /* 🛑 G2961/G2963 — THE RUN WORKER, AFTER THE PLANES AND BESIDE THE
             * BUNDLE. After `UpdateServices` because the planes are the half a
             * health check and a circuit breaker judge: the worker only takes
             * an image the planes have already proved, and a failed
             * `UpdateServices` means this is never STARTED.
             *
             * ⚠️ IN PARALLEL WITH `PublishSite`, NOT AFTER IT, AND THAT IS AN
             * ARGUMENT RATHER THAN A SHORTCUT: the bundle must match the
             * PLANES, which have already moved, so holding it back behind a
             * worker failure would leave every browser on a client the planes
             * no longer match. The two are independent; each fails the stage
             * on its own. */
            new actions.CodeBuildAction({
              actionName: 'RetagRunWorker',
              project: this.retagRunWorkerProject,
              input: buildOutput,
              runOrder: 3,
            }),
          ],
        },
      ],
    })

    this.pipeline.role.addToPrincipalPolicy(connectionUsePolicy(connectionArn.valueAsString))

    // ------------------------------------------- G263: the deploy-only fence

    /**
     * ⚠️ CREATED, AND NOTHING ASSUMES IT YET. Said plainly rather than left for
     * a reader to discover.
     *
     * 🛑 AND THE DEPLOY STAGE NOW EXISTS AND STILL DOES NOT ASSUME IT, WHICH IS
     * THE SENTENCE TO READ. This block used to end *"the Deploy stage lands with
     * the Planes stack"*, which implied that when it landed it would use this
     * role. It does not, and the reason is a decision rather than an oversight:
     * **this fence is scoped to `cloudformation:*` for a `cdk deploy` action,
     * and the Deploy stage is not a `cdk deploy`.** It calls
     * `ecs:UpdateService` on two named services, which is a strictly narrower
     * reach than any CloudFormation grant can express — a `cdk deploy` of the
     * `Planes` stack would let the pipeline change networking, security groups
     * and databases on every merge to `main`. Reusing this role would ALSO mean
     * granting it the CodeBuild base permissions, which turns a fence into a
     * general-purpose role. It stays, unassumed, for the day an `Edge` or
     * frontend action needs a real `cdk deploy` — and that day is G277's, not
     * this pass's.
     *
     * G263: *"the pipeline role may push to its own ECR repositories, run its
     * own task definitions and deploy stacks tagged `Project=reconcile` — and
     * nothing else in a SHARED account (G256)."* The ECR half is above and is
     * live. The DEPLOY half is decidable today even though the Deploy stage is
     * not, and it is written here because it is the only part of G263's fence
     * that a shared account makes urgent: `000000000000` also holds the
     * `changi_*` projects and the live findings K1 and K6.
     *
     * 🛑 TWO STATEMENTS, NOT ONE, AND THE SPLIT IS THE WHOLE MECHANISM.
     * `aws:ResourceTag` cannot fence a `CreateStack` — at the moment of the
     * call the stack does not exist and has no tags, so a single
     * `ResourceTag`-conditioned statement leaves creation wide open while
     * looking closed. Creation is fenced by `aws:RequestTag` instead: the call
     * must ASK for `Project=reconcile`. Mutation and deletion are fenced by
     * `aws:ResourceTag`: the stack must ALREADY carry it.
     */
    this.deployRole = new iam.Role(this, 'DeployRole', {
      roleName: `reconcile-deploy-${environment}`,
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description:
        'G263: may deploy only CloudFormation stacks tagged Project=reconcile. ' +
        'NOT ASSUMED BY ANY PIPELINE ACTION: the Deploy stage calls ecs:UpdateService ' +
        'on two named services, which is narrower than any CloudFormation grant.',
    })

    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CreateOnlyReconcileTaggedStacks',
        actions: ['cloudformation:CreateStack', 'cloudformation:CreateChangeSet'],
        resources: [`arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/*`],
        conditions: { StringEquals: { 'aws:RequestTag/Project': 'reconcile' } },
      }),
    )

    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'MutateOnlyReconcileTaggedStacks',
        actions: [
          'cloudformation:UpdateStack',
          'cloudformation:DeleteStack',
          'cloudformation:ExecuteChangeSet',
          'cloudformation:DeleteChangeSet',
          'cloudformation:DescribeChangeSet',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DescribeStackResources',
          'cloudformation:GetTemplate',
        ],
        resources: [`arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/*`],
        conditions: { StringEquals: { 'aws:ResourceTag/Project': 'reconcile' } },
      }),
    )

    // ----------------------------------------------------------------- tags

    applyRequiredTags(this, environment, 'ci')

    new CfnOutput(this, 'PipelineName', { value: this.pipeline.pipelineName })
    new CfnOutput(this, 'PlaneRepositoryUri', { value: this.planeRepository.repositoryUri })
    new CfnOutput(this, 'NotBuilt', {
      value: PROD_PROMOTION_PIPELINE_TODO,
      description: 'What G257 still owes, stated on the stack rather than only in a comment.',
    })
  }
}

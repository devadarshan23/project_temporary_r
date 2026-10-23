/**
 * `Planes` — G253. `compose.yaml`'s six services, in AWS, ONE-TO-ONE.
 *
 * `docs/tech-stack.md` §7 is the specification and it is a table, so this file
 * is a transcription of that table rather than a design:
 *
 *   compose service        this file
 *   ---------------------  --------------------------------------------------
 *   data-plane             FargateService, ARM64, behind the internal ALB
 *   control-plane          FargateService, ARM64, behind the same ALB
 *   data-plane-migrate     FargateTaskDefinition, no service — a run-task
 *   control-plane-migrate  FargateTaskDefinition, no service — a run-task
 *   data-plane-db          NOT HERE. The `Data` stack owns both clusters
 *   control-plane-db       NOT HERE.
 *   data-net / control-net NOT HERE. The `Network` stack owns the two SG pairs
 *
 * 🛑 THE LOAD-BEARING HALF IS THE IAM SHAPE, NOT THE COMPUTE, AND G253 SAYS SO
 * IN ITS OWN WORDS:
 *
 *     "the migrate run-tasks are the ONLY principals granted the migrator
 *      secret; the services are granted the app-role secret and nothing else —
 *      the split becomes a property of the account rather than a property of a
 *      file."
 *
 * ⚠️ **"AND NOTHING ELSE" WENT FALSE ON 20 Sep 2026 AND IS CORRECTED HERE
 * RATHER THAN DELETED**, because it is the sentence a reader counting this
 * file's credentials would have trusted. **The data plane's service now holds
 * TWO secrets**: `RECONCILE_APP_PASSWORD`, and — under G1161 and G1282 —
 * `RECONCILE_CONTROL_READ_PASSWORD`, the `reconcile_control_reader` credential
 * for the CONTROL database.
 *
 * **What survives of the ruling, and it is the load-bearing half:** the split
 * is unchanged. The migrate run-tasks are still the only principals granted the
 * migrator secret and the two admin secrets; the reader credential is a
 * `SELECT`-only role on ONE table, argued a line at a time in
 * `db/migrations-control/`, and it is emphatically NOT
 * `reconcile_control_app`'s. **What is genuinely spent is the SHAPE of the
 * claim**: "the services hold one credential each" was checkable by counting,
 * and now it is not — `tests/infra/planes.test.mjs` enumerates the exact set
 * per container instead, which is a census where there used to be a
 * construction. `db/control-read-scope.ts` records the same trade in G1161's
 * own words and refuses to sell it as a wash.
 *
 * `server/data-plane/main.ts` held the cluster superuser and the `LOGIN
 * BYPASSRLS` migrator FOR ITS ENTIRE LIFE until 16 Aug 2026, and its own header
 * records why that was a defect rather than a convenience: the fence was
 * correct at the CONNECTION and undone at the CREDENTIAL INVENTORY, so any
 * `process.env` disclosure in the serving process yielded the read exemption
 * every isolation assertion in `tests/` is relative to. `compose.yaml` fixed the
 * inventory locally. This file is the same fence in IAM, and it is stronger
 * there: a compose `environment:` block is a list somebody adds a line back to,
 * where an IAM grant that does not exist cannot be reached by adding a line to
 * a task definition.
 *
 * ┌─ WHERE THE FENCE ACTUALLY LIVES, AND IT IS NOT WHERE IT LOOKS ────────────┐
 * │ An ECS task **secret** is fetched by the task's EXECUTION role, not by the │
 * │ task role — ECS reads Secrets Manager on the container's behalf before the │
 * │ process starts. So a fence written only over task roles would be a fence   │
 * │ over the principal that never touches the secret. EVERY TASK DEFINITION    │
 * │ HERE THEREFORE GETS ITS OWN EXECUTION ROLE AND ITS OWN TASK ROLE — eight   │
 * │ roles, none shared — and `tests/infra/planes.test.mjs` checks all eight.   │
 * │ Sharing one execution role across the four task definitions would have     │
 * │ looked tidy and would have handed the migrator secret to both listeners.   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ WHAT THIS STACK DOES NOT OWN AND MUST NOT BE READ AS ASSERTING. It creates
 * no VPC, no subnet, no security group and no database, and it adds NO INGRESS
 * RULE TO ANY CLUSTER SECURITY GROUP. §7's *"no rule admits control-plane tasks
 * to the data cluster"* is the `Data` stack's to write and the `Network`
 * stack's to shape; this file consumes both as props and says so rather than
 * implying the asymmetry is held here. See `PlanesStackProps` below — it is the
 * whole of the interface.
 */

import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import type { Construct } from 'constructs'

import type * as rds from 'aws-cdk-lib/aws-rds'

import type { DataStack } from './data-stack.ts'
import type { NetworkStack } from './network-stack.ts'

import {
  CDK_ENV,
  CONTROL_PLANE_DATABASE_NAME,
  CONTROL_PLANE_PORT,
  DATA_PLANE_DATABASE_NAME,
  DATA_PLANE_POOL_MAX,
  DATA_PLANE_PORT,
  PLANE_IMAGE_REPOSITORY_NAME,
  SERVING_TASKS_WHEN_UP,
  PLANE_IMAGE_TAG_CONTEXT_KEY,
  SIGN_IN_DEPLOYMENT,
  SIGN_IN_RETURN_HOST,
  assertDeployablePlaneImageTag,
  ecsClusterName,
  planeServiceName,
  planesExportName,
  runQueueUrl,
} from './config.ts'
import type { PlanesExportKey } from './config.ts'
import type { Environment } from './config.ts'
import { applyRequiredTags } from './tagging.ts'

// ---------------------------------------------------------------- the seam

/**
 * One credential, and the JSON key inside it that holds the password.
 *
 * ⚠️ THE FIELD NAME IS A PROP RATHER THAN A CONSTANT HERE BECAUSE THIS STACK
 * DOES NOT MINT THE SECRET. An RDS-generated secret puts the password under
 * `password`; a hand-made one may not. Guessing would produce a task that
 * starts and fails to authenticate, with the reason a JSON key nobody wrote
 * down — so the stack that creates the secret says which key it used.
 */
export interface PasswordSecret {
  readonly secret: secretsmanager.ISecret
  readonly passwordField: string
}

/**
 * The DATA plane's database, as this stack needs to see it.
 *
 * Three credentials, and the three-way split is `db/provision.ts`'s three roles
 * exactly — `reconcile_owner` (NOLOGIN, owns every table), `reconcile_migrator`
 * (LOGIN BYPASSRLS) and `reconcile_app` (LOGIN, NOBYPASSRLS, owns nothing).
 * `reconcile_owner` is absent because it is NOLOGIN: there is no credential for
 * it to have, which is the point of it.
 */
export interface DataPlaneDatabase {
  /** The cluster writer endpoint. `RECONCILE_DB_HOST`. */
  readonly host: string
  /** `RECONCILE_DB_PORT`. */
  readonly port: number
  /** `RECONCILE_DB_NAME`. */
  readonly databaseName: string
  /**
   * The cluster master user — `RECONCILE_DB_ADMIN`, read by `db/env.ts`'s
   * `adminUser()` and used by `db/provision.ts` and by nothing else.
   */
  readonly adminUser: string
  /**
   * 🛑 THE SUPERUSER. Consumed implicitly, as `PGPASSWORD` — `adminClient()`
   * supplies no password of its own. MIGRATE RUN-TASK ONLY.
   */
  readonly adminSecret: PasswordSecret
  /**
   * 🛑 `reconcile_migrator`, LOGIN BYPASSRLS — the read exemption every
   * isolation assertion in `tests/` is relative to. MIGRATE RUN-TASK ONLY.
   */
  readonly migratorSecret: PasswordSecret
  /** `reconcile_app`. The serving role. The ONLY credential either service holds. */
  readonly appSecret: PasswordSecret
  /**
   * 🛑 `reconcile_engine` — G3861, discharging G3749. `reconcile_app` PLUS
   * `INSERT` on the two exception tables (`db/migrations/0500` §1). In THIS
   * stack it reaches the DATA MIGRATE task ONLY, because `createRoles()` SETS
   * its password. **The serving data plane must never receive it**: a request
   * path holding it could mint a finding against itself, which is `0015`'s
   * refusal. The process that authenticates with it is the run worker, in
   * `RunQueue`. `tests/infra/planes.test.mjs` asserts the absence on the
   * service by IAM and by the task definition's secrets block.
   */
  readonly engineSecret: PasswordSecret
}

/**
 * The CONTROL plane's database.
 *
 * ⚠️ NO MIGRATOR SECRET, AND THE ABSENCE MIRRORS THE TREE RATHER THAN BEING AN
 * OMISSION. `compose.yaml`'s `control-plane-migrate` sets
 * `RECONCILE_CONTROL_DB_ADMIN_PASSWORD` and no migrator password at all:
 * `server/control-plane/provision.ts` runs the control migrations as the admin
 * and there is no `BYPASSRLS` role on that side, because there is no
 * tenant-scoped table in `reconcile_control` for RLS to exempt anything from.
 */
export interface ControlPlaneDatabase {
  readonly host: string
  readonly port: number
  readonly databaseName: string
  /** `RECONCILE_CONTROL_DB_ADMIN`. */
  readonly adminUser: string
  /** 🛑 Owns every table the serving process reads. MIGRATE RUN-TASK ONLY. */
  readonly adminSecret: PasswordSecret
  /** `reconcile_control_app`. Reads the catalogue; owns nothing. */
  readonly appSecret: PasswordSecret
}

/**
 * What the `Network` stack must hand over.
 *
 * 🛑 THREE SECURITY GROUPS, AND THE TWO PLANE ONES ARE `compose.yaml`'s TWO
 * NETWORKS. G193's first and strongest fence is that `data-plane-db` DOES NOT
 * RESOLVE inside the control-plane container — not refused, unresolvable. A VPC
 * has one DNS namespace, so that exact property does not survive the move; what
 * replaces it is the security-group pair, and it only replaces it if the
 * `Data` stack admits `dataPlaneSecurityGroup` to the data cluster and
 * `controlPlaneSecurityGroup` to the control cluster AND NEITHER TO THE OTHER.
 * This stack cannot assert that — it owns neither cluster — and saying so here
 * is cheaper than a reader assuming it.
 *
 * ⚠️ **"NEITHER TO THE OTHER" IS AMENDED, IN ONE DIRECTION ONLY — G1284,
 * 20 Sep 2026 — AND THE SENTENCE IS CORRECTED RATHER THAN DELETED BECAUSE THE
 * DIRECTION IS THE WHOLE CONTROL.** `dataPlaneSecurityGroup` is now admitted to
 * the CONTROL database group on 5432, for G1161's read-only console read. **The
 * reverse is untouched and is refused outright**: no control-plane source may
 * reach `reconcile-<env>-data-db`, which is that group's own description in
 * capitals and is invariant 3 — *"The control plane publishes downward and
 * never reads tenant data."* The edge this slice opens is a DOWNWARD read, into
 * a process that publishes nothing back. `tests/infra/network.test.mjs` is
 * directional for the same reason and witnesses both halves.
 */
export interface PlanesNetwork {
  readonly vpc: ec2.IVpc
  /** Where the two services' tasks run. Private, with egress for ECR and Secrets Manager. */
  readonly taskSubnets: ec2.SubnetSelection
  /** Where the internal ALB's nodes sit. */
  readonly loadBalancerSubnets: ec2.SubnetSelection
  /** The ALB's own group. Must reach both plane groups on their two ports. */
  /** 🛑 ONE PER PLANE. A shared group is a `Plane=shared` resource admitted to a
   *  `Plane=data` one, which is the exact shape G260's tag query exists to find.
   *  See `network-stack.ts`. */
  readonly dataPlaneAlbSecurityGroup: ec2.ISecurityGroup
  readonly controlPlaneAlbSecurityGroup: ec2.ISecurityGroup
  /** `data-net`. Admitted to the data cluster and to nothing else. */
  readonly dataPlaneSecurityGroup: ec2.ISecurityGroup
  /** `control-net`. Admitted to the control cluster and to nothing else. */
  readonly controlPlaneSecurityGroup: ec2.ISecurityGroup
}

export interface PlanesStackProps extends StackProps {
  readonly environment: Environment
  readonly network: PlanesNetwork
  readonly data: DataPlaneDatabase
  readonly control: ControlPlaneDatabase
}

// -------------------------------------------------------------- the numbers

/**
 * ⚠️ NEITHER RETENTION BELOW IS DERIVED FROM THE RECORD, AND THAT IS STATED
 * RATHER THAN DRESSED UP. `docs/tech-stack.md` §12 says *"staging short, prod at
 * the retention class the record assigns to operational logs"* — and the record
 * assigns none: `model/examples.ts`'s `PLACEHOLDER_RETENTION_POLICY` is uniform
 * and says of itself that the number is *"MEANINGLESS"*. So these two are this
 * slice's choice, named as a choice, and they are the owner's to move.
 */
export const LOG_RETENTION: Record<Environment, logs.RetentionDays> = {
  staging: logs.RetentionDays.TWO_WEEKS,
  prod: logs.RetentionDays.THREE_MONTHS,
  shared: logs.RetentionDays.TWO_WEEKS,
}

/*
 * ⛔ `SERVING_TASKS` WAS DECLARED HERE UNTIL R-POOL (G2263) — *"Desired task
 * count when the schedule has the environment UP"*, `{ staging: 1, prod: 2,
 * shared: 1 }` — and `lib/config.ts` carried `SERVING_TASKS_WHEN_UP` as a
 * mirror of it that nothing checked. The mirror is now the ONLY declaration,
 * per plane, and this file imports it: a raised task count that moved one copy
 * and not the other would have changed the fleet and left the alarms sized for
 * the old one. Derive it: `grep -n 'SERVING_TASKS_WHEN_UP' infra/lib/config.ts`.
 */

const TASK_CPU = 512
const TASK_MEMORY_MIB = 1024

/**
 * 🛑 THE SHUTDOWN SCHEDULE IS IN UTC AND THE OFFICE IS NOT.
 *
 * Application Auto Scaling scheduled actions here carry no time zone, so these
 * are UTC and the SGT (UTC+8) times a reader actually cares about are written
 * beside them. They do not follow a holiday calendar and they do not know
 * whether anybody is working; the morning action raises capacity whether or not
 * it is wanted, and a deploy outside the window lands on zero tasks.
 */
const SCALE_UP_UTC_HOUR = '1' // 09:00 SGT
const SCALE_DOWN_UTC_HOUR = '13' // 21:00 SGT

// ------------------------------------------------------------------- stack

/** G2766 — the sign-in variables for one environment, or none. */
export function signInEnvironment(environment: Environment): Record<string, string> {
  const d = SIGN_IN_DEPLOYMENT[environment]
  if (d === null) return {}
  return {
    RECONCILE_SIGNIN_RETURN_HOST: SIGN_IN_RETURN_HOST,
    RECONCILE_SERVING_HOSTS: d.servingHosts.join(','),
    RECONCILE_CONSOLE_HOSTS: d.consoleHosts.join(','),
    RECONCILE_SESSION_MAX_LIFETIME_SECONDS: String(d.sessionMaxLifetimeSeconds),
    RECONCILE_SESSION_MAX_IDLE_SECONDS: String(d.sessionMaxIdleSeconds),
  }
}

export class PlanesStack extends Stack {
  readonly cluster: ecs.Cluster
  readonly loadBalancer: elbv2.ApplicationLoadBalancer
  /** The control plane's own ALB. Two, not one — see `network-stack.ts`. */
  readonly controlLoadBalancer: elbv2.ApplicationLoadBalancer
  readonly dataService: ecs.FargateService
  readonly controlService: ecs.FargateService
  readonly dataMigrateTask: ecs.FargateTaskDefinition
  readonly controlMigrateTask: ecs.FargateTaskDefinition

  constructor(scope: Construct, id: string, props: PlanesStackProps) {
    super(scope, id, props)

    const { environment, network } = props

    /**
     * The image both planes run, by the tag the Build stage pushed —
     * `$CODEBUILD_RESOLVED_SOURCE_VERSION`, a commit sha.
     *
     * 🛑 A TAG, NOT A DIGEST, AND THE ARGUMENT IS THE CI IMAGE'S OWN. G262 wants
     * the running image identified by digest rather than by a tag that can
     * move. `PipelineStack` creates this repository with
     * `imageTagMutability: IMMUTABLE`, which refuses to move a tag once used —
     * so a commit-sha tag in it names bytes exactly as a digest would, without
     * putting a `sha256:` literal into a parameter no reviewer can check
     * against a commit. `infra/lib/ci-image-stack.ts` makes the same argument
     * about `CI_IMAGE_TAG` and this is that argument applied a second time.
     *
     * ┌─ 🛑 IT WAS A `CfnParameter` UNTIL 20 Sep 2026 AND THE CHANGE IS THE ───┐
     * │ WHOLE OF G1012. THE PARAGRAPH BELOW IS THE OLD DECLARATION'S OWN AND   │
     * │ IS KEPT, BECAUSE IT IS RIGHT AND IT IS NOT WHAT FAILED:                │
     * │                                                                        │
     * │   *"No default. A plausible default here is a stack that deploys and   │
     * │   runs whichever bytes happen to answer to `latest`."*                 │
     * │                                                                        │
     * │ **It had no default and it had something worse: a PREVIOUS VALUE.**    │
     * │ `cdk deploy` sends `UsePreviousValue: true` for any parameter it is    │
     * │ not given, and the pipeline's Deploy stage registers a task definition │
     * │ by digest without ever writing the parameter back — so the stack's     │
     * │ idea of the image is as old as the last `cdk deploy`, and applying it  │
     * │ is SILENT. Measured on 20 Sep 2026: the parameter said a tag pushed    │
     * │ on the 18th, the service ran one pushed on the 20th, and the task      │
     * │ definition CloudFormation owns was **revision 1 against revision 38**. │
     * │ A `cdk deploy` of this stack — which `Edge` requires — would have      │
     * │ rolled both planes back two days against a forward-only schema (G88)   │
     * │ and reported success.                                                  │
     * │                                                                        │
     * │ A CDK CONTEXT VALUE HAS NO PREVIOUS VALUE. Absent, this throws; and    │
     * │ the tag is baked into the template, so `cdk diff` shows the image      │
     * │ moving. `assertDeployablePlaneImageTag()` in `lib/config.ts` carries   │
     * │ the reasoning, the sentinel the gate uses and the derivation command.  │
     * └────────────────────────────────────────────────────────────────────────┘
     */
    const imageTag = assertDeployablePlaneImageTag(
      this.node.tryGetContext(PLANE_IMAGE_TAG_CONTEXT_KEY),
    )

    /* ⚠️ NOT A LOOKUP. `fromRepositoryName` builds an ARN from the account and
     * region this stack already knows and reaches no API, which is what keeps
     * `cdk synth` offline and therefore eligible for the gate under G108. The
     * repository is created by `PipelineStack`; importing it rather than
     * re-declaring it is what keeps one repository per environment. */
    const repository = ecr.Repository.fromRepositoryName(
      this,
      'PlaneRepository',
      `${PLANE_IMAGE_REPOSITORY_NAME}-${environment}`,
    )
    const image = ecs.ContainerImage.fromEcrRepository(repository, imageTag)

    /**
     * G261 — Container Insights on the cluster. One cluster per environment;
     * §7: *"One cluster, one VPC, per environment."*
     *
     * ⚠️ A CLUSTER IS NOT A BOUNDARY AND MUST NOT BE READ AS ONE. Both planes
     * run in this one cluster, exactly as both ran under one `docker compose`.
     * What separates them is the security-group pair, the two databases and the
     * two credential sets — never the cluster.
     */
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: ecsClusterName(environment),
      vpc: network.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
      enableFargateCapacityProviders: true,
    })

    /**
     * ⚠️ THE ONE TYPE ASSERTION IN THIS FILE, AND IT IS A `aws-cdk-lib` TYPING
     * ARTEFACT RATHER THAN A CLAIM ABOUT ANYTHING.
     *
     * `FargateServiceProps.cluster` is `ICluster`, whose
     * `defaultCloudMapNamespace` is OPTIONAL, while `Cluster` declares the same
     * member as `INamespace | undefined`. Under `exactOptionalPropertyTypes` —
     * which every TypeScript project in this repository compiles with — those
     * are different types, so the class CDK exports is not assignable to the
     * interface CDK asks for. Narrowing to the interface here keeps the option
     * on rather than turning it off for the whole project, which is the trade
     * that matters: the flag catches real optional-property defects in the
     * model, and this is the only place in `infra/` it has been in the way.
     */
    const cluster = this.cluster as ecs.ICluster

    /**
     * G261 — one log group per plane per environment, retention set in CDK.
     *
     * 🛑 AND HERE IS THE HALF OF G261 THAT A TASK DEFINITION CANNOT HOLD, SAID
     * PLAINLY RATHER THAN IMPLIED AWAY. G261's second half is a CONTAINMENT
     * rule: *"a log line carries identifiers, codes, counts and durations only
     * … never a payload field value, counterparty text, a document body, a
     * header value or a query string"*, enforced by an ALLOW-LIST SERIALIZER on
     * the logger. **Nothing in this file enforces any of that.** The `awslogs`
     * driver is a pipe: it ships whatever the process writes to stdout, byte
     * for byte, and neither a log group nor a retention nor a stream prefix can
     * inspect a line. The serializer belongs beside the Fastify logger in
     * `server/`, is not written, and G261's row records it as owing a test that
     * logs a `SourceDocument`-shaped object and asserts the line holds its id
     * and nothing else. **A green synth of this stack is evidence about log
     * ROUTING and about nothing else.**
     *
     * What this file does do, and it is the small true part: the migrate
     * containers and the serving containers share their plane's group with
     * different stream prefixes, so a migrate run-task's non-zero exit is
     * visible in the same place as the plane it migrated — which is the alarm
     * G261 names and which the `Observability` stack will attach to.
     */
    const dataLogGroup = new logs.LogGroup(this, 'DataPlaneLogs', {
      logGroupName: `/reconcile/${environment}/data-plane`,
      retention: LOG_RETENTION[environment],
      removalPolicy: environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    })

    const controlLogGroup = new logs.LogGroup(this, 'ControlPlaneLogs', {
      logGroupName: `/reconcile/${environment}/control-plane`,
      retention: LOG_RETENTION[environment],
      removalPolicy: environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    })

    // ------------------------------------------------------ the data plane

    const dataServiceRoles = this.planeRoles('DataPlaneService', environment, 'data', 'service')

    const dataTaskDef = this.taskDefinition('DataPlaneTask', dataServiceRoles)

    const dataContainer = dataTaskDef.addContainer('data-plane', {
      image,
      /* `compose.yaml`: `command: ["node", "server/data-plane/main.ts"]`. ONE
       * IMAGE, TWO PLANES — the Dockerfile declares no default CMD on purpose,
       * *"because a default would make the wrong plane the easy mistake."* */
      command: ['node', 'server/data-plane/main.ts'],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'data-plane', logGroup: dataLogGroup }),
      environment: {
        RECONCILE_DB_HOST: props.data.host,
        RECONCILE_DB_PORT: String(props.data.port),
        RECONCILE_DB_NAME: props.data.databaseName,
        RECONCILE_HTTP_HOST: '0.0.0.0',
        RECONCILE_HTTP_PORT: String(DATA_PLANE_PORT),
        /**
         * ─────────────────────────────────────── R-POOL — G2261/G2262
         *
         * 🛑 THE OWNER'S RULING: *"Raise `RECONCILE_DB_POOL_MAX` and the
         * serving task count"* — D6-4's companion. Until this line the
         * variable was set on NEITHER task definition and
         * `createAppPool(max = 10)`'s default was what ran, so ten concurrent
         * anonymous requests held the whole pool of the one staging task.
         * The value is DERIVED from a connection budget in `lib/config.ts`
         * (`DATA_PLANE_POOL_MAX`, whose header carries the arithmetic) and is
         * not chosen here. ⚠️ It is a CEILING on a lazy `pg.Pool`, not a
         * reservation: an idle task holds the connections it has used, no
         * more. ⚠️ AND IT IS NOT A CONTROL — D6's own words: *"Moves the
         * number an attacker must reach."*
         */
        RECONCILE_DB_POOL_MAX: String(DATA_PLANE_POOL_MAX),
        /**
         * ─────────────────────────────────────── G1281 — THE RUN QUEUE
         *
         * `server/data-plane/run-queue.ts` reads this ONCE, AT BOOT, and a
         * plane without it gets `unconfiguredRunQueue()` — which admits the run,
         * answers 201 and writes a LOUD line saying nothing was told about it.
         * **That is the state the deployed fleet has been in since `RunQueue`
         * was created**, and this entry is the whole of what ends it.
         *
         * 🛑 SPELLED BY `runQueueUrl()` RATHER THAN READ OFF THE `RunQueue`
         * STACK, AND THE REASON IS A DEPLOY-ORDER DEADLOCK THAT NOTHING IN THIS
         * ACCOUNT WOULD HAVE CAUGHT. `lib/run-queue-stack.ts` grants
         * `sqs:SendMessage` to this task's role BY NAME, which costs an
         * unenforced order — `Planes` before `RunQueue`. A construct reference
         * here would mint an export on `RunQueue` and add the opposite order.
         * Both stacks are already deployed here, so the pair would have sat
         * undiscovered until somebody stood up a second environment. The
         * constant's docblock carries the derivation and the verification
         * against the deployed stack's own output.
         *
         * ⚠️ **`RECONCILE_RUN_QUEUE_ENDPOINT` IS DELIBERATELY ABSENT AND
         * SETTING IT HERE WOULD BE A DEFECT, NOT A COMPLETION.** It is not a
         * second half of this variable — `run-queue.ts` says it is *"FOR THE
         * LOCAL STACK ALONE"*: against AWS the queue URL IS the endpoint, and
         * the override exists because `compose.yaml`'s SQS-compatible server
         * hands out a URL naming a container hostname on `data-net`. An
         * endpoint set here would point the SDK at whatever string it named
         * INSTEAD of at SQS.
         *
         * ⚠️ NO `AWS_REGION` EITHER, AND THAT IS READ RATHER THAN ASSUMED:
         * `runQueueTarget()` falls back to `us-west-2` when the variable is
         * absent, which is this app's only region (`AWS_REGION` in
         * `lib/config.ts`, and G256 refuses `us-east-1` for anything but a
         * CloudFront certificate). Setting it would be a second home for a
         * value that already has one.
         */
        RECONCILE_RUN_QUEUE_URL: runQueueUrl(environment),
        /**
         * ─────────────────────────────── G2766 — SIGN-IN, ON A DEPLOYED PLANE
         *
         * `SIGN_IN_DEPLOYMENT` in `lib/config.ts` carries the argument: until
         * these lines the deployed plane served the three public sign-in
         * operations with an empty host registry, no identity terms and no
         * session bounds, so none of them could succeed. An environment with no
         * deployed pool (`null`) gets none of them and stays exactly as it was.
         *
         * 🛑 `RECONCILE_SIGNIN_RETURN_HOST` IS G2549's ONE SHARED RETURN HOST.
         * The plane refuses to BOOT if it collides with either registry
         * (`signInReturnHostFromEnv()`), so a typo here is a failed deploy and
         * never a tenant surface answering the broker.
         *
         * ⚠️ NO `RECONCILE_IDENTITY_ISSUER` — D6-5 retired it (the issuer is the
         * pinned row's) — and no `RECONCILE_LOCAL_TEST_AUTH`, ever.
         */
        ...signInEnvironment(environment),
        /* ⛔ G1161's `RECONCILE_CONTROL_READ_*` ARE RETIRED — G4320, 5 Oct 2026, THE
           OWNER'S "Full restore" ruling. This container holds no control-database
           credential; it reaches the control plane's signed internal tier (G4310). */
        /* 🛑 DELIBERATELY ABSENT: `RECONCILE_LOCAL_TEST_AUTH`, and its ABSENCE
         * is the control. G192's fence is structural — `session.ts` reaches
         * `server/dev/test-token.ts` through a DYNAMIC import that only
         * executes when the flag is exactly `1`, so a plane started without it
         * never LOADS the file and there is no accepting code path in the
         * process to bypass. `compose.yaml` calls the flag's absence from a
         * real task definition "a thing an auditor can read". This is that
         * task definition; read it.
         *
         * Also absent: `RECONCILE_DB_ADMIN`, `PGPASSWORD` and
         * `RECONCILE_MIGRATOR_PASSWORD`. Those are the migrate task's. */
      },
      secrets: {
        /* G263 — an ECS task SECRET, never a plain environment entry. The role
         * that serves requests: NOBYPASSRLS, owns nothing. */
        RECONCILE_APP_PASSWORD: secretOf(props.data.appSecret),
      },
      /**
       * 🛑 NO `sqs:SendMessage` GRANT HERE, AND THE ABSENCE IS CORRECT RATHER
       * THAN OWED — MEASURED, NOT ASSUMED.
       *
       * The obvious companion to `RECONCILE_RUN_QUEUE_URL` above is an IAM
       * statement letting this role publish. **It already exists**, granted BY
       * NAME by `lib/run-queue-stack.ts` §3 so that granting it adds no export
       * to this stack, and it is DEPLOYED — read back from the account on
       * 20 Sep 2026:
       *
       *     aws iam get-role-policy --role-name reconcile-staging-data-service-task \
       *       --policy-name DataPlaneServiceTaskRolePolicy57A93CEE
       *     -> Sid PublishAdmittedRuns, Action [sqs:GetQueueAttributes,
       *        sqs:SendMessage], Resource arn:aws:sqs:us-west-2:000000000000:
       *        reconcile-staging-run-admitted
       *
       * **Re-granting it here would be a second home for one permission** —
       * §5.3, *"two implementations of one order, and the one that drifts is
       * always the copy"* — and the copy that drifted would be the one nobody
       * read, because both would be green. The grant stays where the queue is.
       *
       * ⚠️ AND `sqs:ReceiveMessage` IS REFUSED HERE TWICE OVER. Nothing in this
       * account runs the worker, so a receive permission on the SERVING role
       * would be `0004`'s *"a write privilege ahead of its writer"* arriving in
       * IAM — a decision about where R-B's consumer runs, taken by accident, in
       * the one file that must not take it. A serving process that could drain
       * the queue could also delete every admitted run's message from a request
       * path. `lib/run-queue-stack.ts` names the three shapes a consumer could
       * take and their three different costs; the grant lands with the
       * consumer.
       */
      ...HARDENED_CONTAINER,
      linuxParameters: dropAllCapabilities(this, 'DataPlaneLinux'),
      portMappings: [{ containerPort: DATA_PLANE_PORT, protocol: ecs.Protocol.TCP }],
    })
    mountWritableTmp(dataTaskDef, dataContainer)

    this.dataService = new ecs.FargateService(this, 'DataPlaneService', {
      serviceName: planeServiceName(environment, 'data'),
      cluster,
      taskDefinition: dataTaskDef,
      desiredCount: SERVING_TASKS_WHEN_UP[environment].data,
      securityGroups: [network.dataPlaneSecurityGroup],
      vpcSubnets: network.taskSubnets,
      /* G261 — the circuit breaker, with rollback. ⚠️ THE ALARM HALF IS NOT
       * HERE: §12 wants a deploy that trips an alarm inside its bake window to
       * roll back, and the alarms live in the `Observability` stack, which this
       * pass does not write. What is enabled below rolls back on a deployment
       * that cannot reach a steady state — strictly less than the ruling asks
       * for, and named as less. */
      circuitBreaker: { rollback: true },
      enableExecuteCommand: false,
    })

    // --------------------------------------------------- the control plane

    const controlServiceRoles = this.planeRoles(
      'ControlPlaneService',
      environment,
      'control',
      'service',
    )

    const controlTaskDef = this.taskDefinition('ControlPlaneTask', controlServiceRoles)

    const controlContainer = controlTaskDef.addContainer('control-plane', {
      image,
      command: ['node', 'server/control-plane/main.ts'],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'control-plane',
        logGroup: controlLogGroup,
      }),
      environment: {
        /* ⚠️ READ THIS BLOCK FOR WHAT IS NOT IN IT, exactly as `compose.yaml`
         * asks its reader to. No `RECONCILE_DB_*` of any kind, no data-plane
         * host, no data-plane credential — and no admin credential for its own
         * database either. `server/control-plane/config.ts` reads only
         * `RECONCILE_CONTROL_*`, and `tests/http/plane-separation.test.ts`
         * asserts the consequence. */
        RECONCILE_CONTROL_DB_HOST: props.control.host,
        RECONCILE_CONTROL_DB_PORT: String(props.control.port),
        RECONCILE_CONTROL_DB_NAME: props.control.databaseName,
        RECONCILE_CONTROL_HTTP_HOST: '0.0.0.0',
        RECONCILE_CONTROL_HTTP_PORT: String(CONTROL_PLANE_PORT),
      },
      secrets: {
        RECONCILE_CONTROL_APP_PASSWORD: secretOf(props.control.appSecret),
      },
      ...HARDENED_CONTAINER,
      linuxParameters: dropAllCapabilities(this, 'ControlPlaneLinux'),
      portMappings: [{ containerPort: CONTROL_PLANE_PORT, protocol: ecs.Protocol.TCP }],
    })
    mountWritableTmp(controlTaskDef, controlContainer)

    this.controlService = new ecs.FargateService(this, 'ControlPlaneService', {
      serviceName: planeServiceName(environment, 'control'),
      cluster,
      taskDefinition: controlTaskDef,
      desiredCount: SERVING_TASKS_WHEN_UP[environment].control,
      securityGroups: [network.controlPlaneSecurityGroup],
      vpcSubnets: network.taskSubnets,
      circuitBreaker: { rollback: true },
      enableExecuteCommand: false,
    })

    // ------------------------------------------- the two one-shot run-tasks

    /**
     * 🛑 NO SERVICE. A task definition and nothing that runs it continuously.
     *
     * `compose.yaml` spells `restart: "no"` explicitly rather than defaulting
     * it, and says why: *"a restart policy on a job that is supposed to
     * terminate turns a one-shot into a process that holds these credentials
     * forever, which is the thing being fixed."* The AWS spelling of that is
     * the absence of an `ecs.FargateService` around these two definitions. The
     * pipeline's Migrate stage invokes them with `ecs:RunTask` and waits for a
     * zero exit — §7: *"invoked by the pipeline before the service deploys;
     * exits."*
     */
    const dataMigrateRoles = this.planeRoles('DataMigrateTask', environment, 'data', 'migrate')
    this.dataMigrateTask = this.taskDefinition('DataPlaneMigrateTask', dataMigrateRoles)

    const dataMigrateContainer = this.dataMigrateTask.addContainer('data-plane-migrate', {
      image,
      command: ['node', 'server/data-plane/migrate-main.ts'],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'data-plane-migrate',
        logGroup: dataLogGroup,
      }),
      environment: {
        RECONCILE_DB_HOST: props.data.host,
        RECONCILE_DB_PORT: String(props.data.port),
        RECONCILE_DB_NAME: props.data.databaseName,
        RECONCILE_DB_ADMIN: props.data.adminUser,
        /* ⚠️ NO `RECONCILE_DEV_SEED` AND NO `RECONCILE_DEV_RESET`.
         * `compose.yaml` sets `RECONCILE_DEV_SEED: "1"` because it is a
         * disposable local stack seeding two fixture tenants. `RESET` drops and
         * rebuilds schema `public` — the one operation in that file that
         * destroys data. Neither belongs on a deployed environment and their
         * absence is the whole of the difference between this task and its
         * compose twin. */
      },
      secrets: {
        /* 🛑 THE THREE CREDENTIALS THAT REACH NO LISTENER. `PGPASSWORD` is the
         * cluster superuser, consumed implicitly by `adminClient()`, which
         * passes no password of its own; `RECONCILE_MIGRATOR_PASSWORD` is
         * `LOGIN BYPASSRLS`. `RECONCILE_APP_PASSWORD` is here as well as on the
         * service because `createRoles()` SETS it — `ALTER ROLE … PASSWORD` —
         * which is the other reason the two LOGIN roles' passwords belong to
         * this job rather than beside a listener. */
        PGPASSWORD: secretOf(props.data.adminSecret),
        RECONCILE_MIGRATOR_PASSWORD: secretOf(props.data.migratorSecret),
        RECONCILE_APP_PASSWORD: secretOf(props.data.appSecret),
        /* G3861 (G3749). `createRoles()` sets `reconcile_engine`'s password
         * only when `enginePassword()` answers (`db/provision.ts`), so without
         * this entry the role exists with no password and the run worker
         * cannot authenticate as it. Here and on the worker; NEVER on the
         * serving data plane. */
        RECONCILE_ENGINE_PASSWORD: secretOf(props.data.engineSecret),
      },
      ...HARDENED_CONTAINER,
      linuxParameters: dropAllCapabilities(this, 'DataMigrateLinux'),
    })
    mountWritableTmp(this.dataMigrateTask, dataMigrateContainer)

    const controlMigrateRoles = this.planeRoles(
      'ControlMigrateTask',
      environment,
      'control',
      'migrate',
    )
    this.controlMigrateTask = this.taskDefinition('ControlPlaneMigrateTask', controlMigrateRoles)

    const controlMigrateContainer = this.controlMigrateTask.addContainer('control-plane-migrate', {
      image,
      command: ['node', 'server/control-plane/migrate-main.ts'],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'control-plane-migrate',
        logGroup: controlLogGroup,
      }),
      environment: {
        RECONCILE_CONTROL_DB_HOST: props.control.host,
        RECONCILE_CONTROL_DB_PORT: String(props.control.port),
        RECONCILE_CONTROL_DB_NAME: props.control.databaseName,
        RECONCILE_CONTROL_DB_ADMIN: props.control.adminUser,
      },
      secrets: {
        /* The control admin owns every table the serving process reads — so a
         * serving process holding it could rewrite the catalogue it publishes
         * downward to the whole fleet, which is a supply-chain WRITE and a
         * worse shape than a read even though no customer's data is in this
         * database. `compose.yaml` makes the same argument in the same words. */
        RECONCILE_CONTROL_DB_ADMIN_PASSWORD: secretOf(props.control.adminSecret),
        RECONCILE_CONTROL_APP_PASSWORD: secretOf(props.control.appSecret),
      },
      ...HARDENED_CONTAINER,
      linuxParameters: dropAllCapabilities(this, 'ControlMigrateLinux'),
    })
    mountWritableTmp(this.controlMigrateTask, controlMigrateContainer)

    // ---------------------------------------------------------------- ALB

    /**
     * ONE INTERNAL ALB, TWO LISTENERS — ONE PER PLANE, ON THE TWO PORTS
     * `compose.yaml` PUBLISHES.
     *
     * §7's table says *"behind the same ALB on a separate listener rule"*, and
     * one ALB is what is built. The one place this file refines the table is
     * HOW the two planes are told apart, and the refinement is argued rather
     * than taken quietly:
     *
     * 🛑 A PATH-PREFIX RULE WOULD BE A FENCE KEYED ON A CONVENIENT LANDMARK —
     * the defect shape `docs/HANDOFF.md` §5 calls the most common in this
     * codebase. The two planes' path spaces are declared in five OpenAPI
     * documents that grow every slice; a rule matching `/v1/*` to the data
     * plane is correct until somebody adds a control-plane operation under a
     * prefix nobody re-read, and its failure mode is a control-plane request
     * served by a data-plane task. THE PORT IS NOT A PREFIX. Each listener has
     * a DEFAULT ACTION and no rules at all, so there is no match expression to
     * drift: 9080 reaches the data plane's target group and 9070 reaches the
     * control plane's, and nothing that happens in `docs/contracts/` can change
     * that. It also keeps the compose mapping literal — those are the two ports
     * compose publishes.
     *
     * The alternative — two ALBs — was considered and refused as more machinery
     * for the same property: a second load balancer would give each plane its
     * own DNS name and its own SG, but the separation that matters (invariant
     * 3) is held at the task-to-database security group and at the credential
     * inventory, neither of which a second ALB touches. It is the owner's to
     * overturn if a per-plane hostname is wanted for the console.
     *
     * ⚠️ HTTP, NOT HTTPS, AND IT IS NOT RULED. The listeners are plaintext
     * inside the VPC. §13 decides image and secret hardening and says nothing
     * about in-VPC transport; G183's certificate is the `Edge` stack's. Stated
     * so nobody reads `internetFacing: false` as "encrypted".
     */
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'DataAlb', {
      loadBalancerName: `reconcile-${environment}-data`,
      vpc: network.vpc,
      internetFacing: false,
      securityGroup: network.dataPlaneAlbSecurityGroup,
      vpcSubnets: network.loadBalancerSubnets,
      dropInvalidHeaderFields: true,
      /**
       * 🛑 G2986 — `Host` MUST REACH THE PLANE BYTE-FOR-BYTE, AND WITHOUT THIS
       * IT DID NOT. Measured on staging, 2 Oct 2026 (derived, NOT THE OWNER'S):
       * this ALB carried `routing.http.preserve_host_header.enabled=false` and
       * its only listener is on `DATA_PLANE_PORT` (9080), a NON-DEFAULT port.
       * AWS documents the consequence: *"When host header preservation is not
       * enabled, and listener port is a non-default port … we append the port
       * number to the host header."* So the plane received
       * `Host: ten-acme.us-west-2.reconcileai.app:9080`, which is NOT a
       * registered serving host — `normaliseHost()` deliberately strips no
       * port — and every host-keyed path failed in the deployed shape:
       * sign-in begin (observed: 403 `host_not_registered`), D1
       * `/context/resolve` (G179), the shared sign-in return relay (G2549),
       * the federated callback, and `session.ts`'s `surfaceOf()` /
       * `checkHostBinding()` (G180). The CONSOLE distribution's data-plane
       * origin (G1949/G1950, G2770) is the SAME shared VPC origin onto THIS
       * ALB, so `console.` and `partners.reconcileai.app` were equally broken.
       *
       * ⚠️ THE TRUST ARGUMENT, because preserving `Host` is only safe if the
       * `Host` that arrives is one we already trust: the ALB is INTERNAL and
       * reachable only from the CloudFront VPC-origin security group
       * (`AlbIngressFromVpcOrigin`); CloudFront forwards the viewer's `Host`
       * under `ALL_VIEWER` (G293), and it accepted that `Host` only for a name
       * its certificate covers, with SNI == Host (G181) — so the value the
       * plane now sees is exactly the name the viewer's TLS session was
       * established for. Preservation adds no input; it stops the ALB
       * MUTATING one.
       *
       * ⛔ REJECTED (1): stripping a port in `normaliseHost()`. A normaliser
       * must never equate two distinct values — `host:9080` and `host` are
       * different serving hosts, and *"a port configures one; stripping it
       * here would be the normaliser deciding"* — and it would weaken G180's
       * comparison for every caller, to repair one load balancer.
       * ⛔ REJECTED (2): reading `X-Forwarded-Host`. `ALL_VIEWER` forwards the
       * viewer's headers, so that header is whatever the caller typed — a
       * forgeable value standing in for the one invariant 1 derives tenant
       * scope from.
       *
       * Local tests could not see this: `tests/e2e/single-origin.ts` forwards
       * `Host` byte-for-byte with no ALB in the path. `tests/infra/planes.test.mjs`
       * §G2986 asserts the synthesised attribute.
       */
      preserveHostHeader: true,
    })

    this.controlLoadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ControlAlb', {
      loadBalancerName: `reconcile-${environment}-control`,
      vpc: network.vpc,
      internetFacing: false,
      securityGroup: network.controlPlaneAlbSecurityGroup,
      vpcSubnets: network.loadBalancerSubnets,
      dropInvalidHeaderFields: true,
    })

    /**
     * 🛑 THE INTERNAL EDGE — G4310, 5 Oct 2026, THE OWNER'S RULINGS: *"…put
     * onboarding writes and roster reads behind signed control-plane
     * endpoints…"* and *"SigV4 task role": the data-plane task role signs
     * internal requests; the control plane verifies.*
     *
     * ⚠️ NO IAM STATEMENT IS ADDED, AND THAT IS THE MECHANISM RATHER THAN AN
     * OMISSION. The data plane proves who it is by signing
     * `sts:GetCallerIdentity`, which requires no permission and which no
     * policy can deny; the AUTHORISATION is the control plane's own
     * allow-list of exactly one role — `RECONCILE_INTERNAL_CALLER_ROLE_ARN`,
     * the data-plane SERVICE task role's ARN, read here by `GetAtt` and never
     * spelled. The migrate task's role, the control plane's own role and every
     * other role in the account are refused (G4307).
     *
     * Both sides name ONE audience, `reconcile-control-<env>`, so a signature
     * minted for one environment's control plane is refused by another's.
     * `tests/infra/planes.test.mjs` asserts both directions.
     */
    const internalAudience = `reconcile-control-${environment}`
    dataContainer.addEnvironment(
      'RECONCILE_INTERNAL_CONTROL_PLANE_URL',
      `http://${this.controlLoadBalancer.loadBalancerDnsName}:${CONTROL_PLANE_PORT}`,
    )
    dataContainer.addEnvironment('RECONCILE_INTERNAL_AUDIENCE', internalAudience)
    dataContainer.addEnvironment('RECONCILE_INTERNAL_STS_REGION', this.region)
    controlContainer.addEnvironment('RECONCILE_INTERNAL_AUDIENCE', internalAudience)
    controlContainer.addEnvironment('RECONCILE_INTERNAL_STS_REGION', this.region)
    controlContainer.addEnvironment('RECONCILE_INTERNAL_CALLER_ROLE_ARN', dataServiceRoles.taskRole.roleArn)

    const dataListener = this.loadBalancer.addListener('DataListener', {
      port: DATA_PLANE_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false,
    })

    dataListener.addTargets('DataTargets', {
      targetGroupName: `reconcile-${environment}-data`,
      port: DATA_PLANE_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.dataService],
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        /* `checkLocalHealth`, the one operation on
         * `docs/contracts/data-plane-local.openapi.yaml` the plane actually
         * mounts. `server/data-plane/start.ts` records why `/status` and
         * `/metrics` are deliberately NOT registered: `/status` is specified as
         * a DEEP check over infrastructure that is not on this path, and its
         * database half would need a query, and every query in this plane runs
         * inside `withTenantScope()`, which needs a tenant a liveness probe
         * does not have. A health check pointed at either would be checking an
         * invented answer. */
        path: '/health',
        healthyHttpCodes: '200',
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    const controlListener = this.controlLoadBalancer.addListener('ControlListener', {
      port: CONTROL_PLANE_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false,
    })

    controlListener.addTargets('ControlTargets', {
      targetGroupName: `reconcile-${environment}-control`,
      port: CONTROL_PLANE_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.controlService],
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        /* 🛑 THE CONTROL PLANE DECLARES NO LIVENESS OPERATION AND THIS PROBE IS
         * THE HONEST CONSEQUENCE, NOT A CLEVER TRICK. There is no `/health` in
         * `docs/contracts/control-plane.openapi.yaml` — derive it:
         * `grep -n '^  /health' docs/contracts/control-plane.openapi.yaml`
         * returns nothing — and under G191 a route this plane does not declare
         * is a route it cannot serve. So the probe asks for `/`, which Fastify
         * answers 404 through `setNotFoundHandler`. It is a REAL liveness
         * signal: an unstarted process refuses the connection and a started one
         * answers HTTP. It is not a readiness signal and must not be read as
         * one — it says nothing about the control database.
         *
         * `200` is accepted alongside `404` so that DECLARING a real liveness
         * operation later does not silently mark every task unhealthy; that
         * follow-on — a `/health` operation on the control-plane contract,
         * matching the one the data-plane-local tier already has — is the fix,
         * and this matcher is the placeholder until it lands.
         *
         * The auth hook does not interfere: `server/http/app.ts` returns early
         * unless the resolved route's config says `secured`, and an unmatched
         * path has no route config, so an unauthenticated probe reaches the 404
         * handler rather than a 401. */
        path: '/',
        healthyHttpCodes: '200,404',
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    })

    // ------------------------------------------------- scheduled shutdown

    this.scheduleOvernightShutdown('DataPlane', this.dataService, environment, 'data')
    this.scheduleOvernightShutdown('ControlPlane', this.controlService, environment, 'control')

    // ---------------------------------------------------------------- tags

    /**
     * G260. TWO CALLS, NOT ONE, AND THAT IS THE POINT OF THE `Plane` TAG.
     *
     * §11: *"invariant 3 is auditable from a tag query — a `Plane=control`
     * resource with a route to a `Plane=data` cluster is a finding."* A single
     * `applyRequiredTags(this, environment, …)` at stack level would have to
     * choose ONE value for a stack holding both planes, and whichever it chose
     * would make that query answer wrong about half the resources.
     *
     * ⚠️ THE CLUSTER AND THE LOAD BALANCER ARE SHARED AND THERE IS NO HONEST
     * PLANE VALUE FOR THEM. They carry `Plane=data`, by the rule that a shared
     * resource takes the tag of the more sensitive plane — so a query for
     * `Plane=data` OVER-reports rather than under-reports, which is the safe
     * direction for a finding. It is a compromise and it is written down rather
     * than left for a reader to infer from a tag.
     */
    applyRequiredTags(this.dataService, environment, 'data')
    applyRequiredTags(this.dataMigrateTask, environment, 'data')
    applyRequiredTags(dataLogGroup, environment, 'data')
    applyRequiredTags(this.cluster, environment, 'data')
    applyRequiredTags(this.loadBalancer, environment, 'data')
    applyRequiredTags(this.controlLoadBalancer, environment, 'control')

    applyRequiredTags(this.controlService, environment, 'control')
    applyRequiredTags(this.controlMigrateTask, environment, 'control')
    applyRequiredTags(controlLogGroup, environment, 'control')

    /* The stack-level call is what catches anything the seven above do not
     * reach — an implicitly created role, a target group, a listener. It runs
     * last so the specific values above win where they were applied. */
    applyRequiredTags(this, environment, 'data')

    // ------------------------------------------------------------- outputs

    /**
     * The NAMED exports the `Pipeline` stack imports. Spelled from
     * `PLANES_EXPORT_KEYS` so the two sides cannot drift into a deploy-time
     * "No export named ... found" - which is exactly how the first attempt at
     * this failed.
     *
     * 🛑 NAMES, NEVER ARNS. A task-definition ARN carries a REVISION, and every
     * Planes deploy mints a new one - so a pipeline fenced to an ARN goes stale
     * silently and the next deploy runs the previous image's migrations against
     * the next image's schema. Green every time, wrong every time.
     *
     * ⚠️ FOUR CONTAINER NAMES, NOT TWO, AND THE DISTINCTION IS LOad-BEARING.
     * The pipeline slice asked for one name per plane, so these were briefly
     * collapsed to `data-plane` and `control-plane` for both the service and
     * the migrate task. `test_every_credential_the_planes_read_arrives_through_
     * the_Secrets_block` went red immediately: it tells the migrate container
     * from the service container BY NAME, because they hold different
     * credentials - the migrate task gets the migrator secret and the service
     * must never see it. Collapsing the names removed the test's ability to
     * say which container it was looking at, which is the G253 fence losing
     * its only reader. The names are restored and BOTH are exported.
     */
    const planesExport = (key: PlanesExportKey, value: string, id: string): void => {
      new CfnOutput(this, id, { exportName: planesExportName(environment, key), value })
    }
    planesExport('ClusterName', this.cluster.clusterName, 'ExportClusterName')
    planesExport('DataServiceName', this.dataService.serviceName, 'ExportDataServiceName')
    planesExport('ControlServiceName', this.controlService.serviceName, 'ExportControlServiceName')
    planesExport('DataServiceTaskFamily', dataTaskDef.family, 'ExportDataServiceTaskFamily')
    planesExport('ControlServiceTaskFamily', controlTaskDef.family, 'ExportControlServiceTaskFamily')
    planesExport('DataMigrateTaskFamily', this.dataMigrateTask.family, 'ExportDataMigrateTaskFamily')
    planesExport(
      'ControlMigrateTaskFamily',
      this.controlMigrateTask.family,
      'ExportControlMigrateTaskFamily',
    )
    planesExport('DataContainerName', dataContainer.containerName, 'ExportDataContainerName')
    planesExport(
      'ControlContainerName',
      controlContainer.containerName,
      'ExportControlContainerName',
    )
    planesExport(
      'DataMigrateContainerName',
      dataMigrateContainer.containerName,
      'ExportDataMigrateContainerName',
    )
    planesExport(
      'ControlMigrateContainerName',
      controlMigrateContainer.containerName,
      'ExportControlMigrateContainerName',
    )

    new CfnOutput(this, 'InternalAlbDnsName', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: `Internal ALB. Data plane on ${DATA_PLANE_PORT}, control plane on ${CONTROL_PLANE_PORT}.`,
    })

    new CfnOutput(this, 'DataMigrateTaskDefinitionArn', {
      value: this.dataMigrateTask.taskDefinitionArn,
      description:
        "The pipeline's Migrate stage runs this with ecs:RunTask and waits for a zero exit. " +
        'It is the only principal here granted the migrator and superuser secrets (G253).',
    })

    new CfnOutput(this, 'ControlMigrateTaskDefinitionArn', {
      value: this.controlMigrateTask.taskDefinitionArn,
      description: 'Same shape, against the control cluster.',
    })

    new CfnOutput(this, 'NotHeldHere', {
      value:
        'This stack adds NO ingress rule to any database security group. Network owns ' +
        'them. NEITHER-TO-THE-OTHER WAS AMENDED ON 20 Sep 2026 (G1284): the data-plane ' +
        'task group is admitted to the CONTROL database on 5432 for G1161 read-only ' +
        'console reads. The reverse - any control-plane source on the DATA database - ' +
        'is still forbidden outright and is invariant 3. No log-content serializer is ' +
        'here either (G261).',
      description: 'What a reader must not read this stack as asserting.',
    })
  }

  // ------------------------------------------------------------- internals

  /**
   * One execution role and one task role, for ONE task definition.
   *
   * 🛑 NEVER SHARED, AND THE EXECUTION ROLE IS THE ONE THAT MATTERS. CDK will
   * happily create an execution role per task definition on its own; they are
   * declared explicitly here so that each has a NAME the credential-fence test
   * can find in the template, and so that nobody can pass the same role twice
   * without the diff saying so. `tests/infra/planes.test.mjs` walks all eight.
   */
  private planeRoles(
    id: string,
    environment: Environment,
    plane: 'data' | 'control',
    kind: 'service' | 'migrate',
  ): { readonly executionRole: iam.Role; readonly taskRole: iam.Role } {
    const executionRole = new iam.Role(this, `${id}ExecutionRole`, {
      roleName: `reconcile-${environment}-${plane}-${kind}-exec`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description:
        `ECS execution role for the ${plane} ${kind} task. Pulls the image, writes ` +
        'the log stream, and FETCHES THE TASK SECRETS - which is why the credential ' +
        'fence of G253 is written over execution roles and not only task roles.',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    })

    const taskRole = new iam.Role(this, `${id}TaskRole`, {
      roleName: `reconcile-${environment}-${plane}-${kind}-task`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description:
        `G263 - one task role per plane per kind, least privilege. The ${plane} ` +
        `${kind} process's own AWS identity.`,
    })

    /* G261 names one application namespace per plane, `Reconcile/<plane>`, for
     * run-level counters the plane publishes. `cloudwatch:PutMetricData` takes
     * no resource — the action is account-wide by AWS's own design — so the
     * namespace CONDITION is the whole of the fence and it is named here rather
     * than left for a reviewer to notice, exactly as `ci-image-stack.ts` names
     * its one wildcard. Only the serving processes get it: a one-shot migration
     * publishes no run-level counter. */
    if (kind === 'service') {
      taskRole.addToPolicy(
        new iam.PolicyStatement({
          sid: 'PublishOwnPlaneMetricsOnly',
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*'],
          conditions: { StringEquals: { 'cloudwatch:namespace': `Reconcile/${plane}` } },
        }),
      )
    }

    return { executionRole, taskRole }
  }

  /** G252/G253 — every task definition here is FARGATE and ARM64. */
  private taskDefinition(
    id: string,
    roles: { readonly executionRole: iam.Role; readonly taskRole: iam.Role },
  ): ecs.FargateTaskDefinition {
    return new ecs.FargateTaskDefinition(this, id, {
      cpu: TASK_CPU,
      memoryLimitMiB: TASK_MEMORY_MIB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      executionRole: roles.executionRole,
      taskRole: roles.taskRole,
    })
  }

  /**
   * Scale to zero overnight and back up in the morning — staging only.
   *
   * 🛑 `prod` IS EXCLUDED BY A CONDITION, NOT BY A CONVENTION. The owner asked
   * for staging down outside working hours. A schedule written once and
   * parameterised by environment is one edit away from taking production down
   * at 21:00, so the environment check is in the code rather than in a habit.
   *
   * ⚠️ WHAT THIS DOES NOT DO, AND THE OTHER HALF IS SOMEBODY ELSE'S. Fargate
   * tasks at `desiredCount: 0` cost nothing; the AURORA CLUSTERS DO NOT STOP
   * THEMSELVES. Serverless v2 falls to its minimum ACU when idle but keeps
   * billing that minimum, and an RDS cluster stopped by hand restarts itself
   * after seven days. Stopping or floor-dropping the two clusters on the same
   * schedule belongs to the `Data` stack, and this file assumes nothing about
   * whether it happens: the planes come back up at 09:00 SGT and will connect
   * to whatever is there, failing their first query loudly if it is not.
   */
  private scheduleOvernightShutdown(
    id: string,
    service: ecs.FargateService,
    environment: Environment,
    plane: 'data' | 'control',
  ): void {
    if (environment === 'prod') return

    /* R-POOL (G2264): the morning action restores the PLANE's own count — 2
     * for the data plane on staging since R-POOL, 1 for the control plane —
     * and the scalable target's ceiling is the same number, so the evening
     * action still takes both to 0 and nothing between the two can scale
     * either service past what the connection budget in `lib/config.ts` was
     * sized for. A single shared `up` would have woken the control plane to
     * the data plane's count, or the data plane back to one. */
    const up = SERVING_TASKS_WHEN_UP[environment][plane]

    const scaling = service.autoScaleTaskCount({ minCapacity: 0, maxCapacity: up })

    scaling.scaleOnSchedule(`${id}EveningDown`, {
      schedule: appscaling.Schedule.cron({
        minute: '0',
        hour: SCALE_DOWN_UTC_HOUR,
        weekDay: 'MON-FRI',
      }),
      minCapacity: 0,
      maxCapacity: 0,
    })

    scaling.scaleOnSchedule(`${id}MorningUp`, {
      schedule: appscaling.Schedule.cron({
        minute: '0',
        hour: SCALE_UP_UTC_HOUR,
        weekDay: 'MON-FRI',
      }),
      minCapacity: up,
      maxCapacity: up,
    })
  }
}

// ------------------------------------------------------------ small helpers

function secretOf(credential: PasswordSecret): ecs.Secret {
  return ecs.Secret.fromSecretsManager(credential.secret, credential.passwordField)
}

/**
 * G262, the part of it a task definition can hold.
 *
 * `readonlyRootFilesystem: true` — *"a plane that needs to write to its own
 * image is a defect, and the filesystem flag is what makes that a fact rather
 * than an expectation."*
 *
 * ⚠️ WHAT G262 ASKS FOR AND IS NOT HERE, NAMED RATHER THAN IMPLIED: the
 * multi-stage build to a shell-less runtime pinned by DIGEST, and the AWS
 * Signer signature. Both are properties of the `Dockerfile` and the Build
 * stage, not of this file — `grep -c 'FROM' Dockerfile` still returns 1 and the
 * image still carries a package manager. The task definition cannot add a
 * property the image does not have.
 */
export const HARDENED_CONTAINER = {
  readonlyRootFilesystem: true,
  /* The container is the task: if the plane dies, the task must fail rather
   * than linger as a task ECS believes is running. */
  essential: true,
} as const

/**
 * Drop every Linux capability.
 *
 * ⚠️ `add` IS NOT USED AND CANNOT BE: Fargate refuses added capabilities. Drop
 * is supported and is the half that matters — neither plane binds a privileged
 * port (both listen above 1024, which the `Dockerfile` notes is why `USER node`
 * works at all).
 */
export function dropAllCapabilities(scope: Construct, id: string): ecs.LinuxParameters {
  const params = new ecs.LinuxParameters(scope, id, { initProcessEnabled: true })
  params.dropCapabilities(ecs.Capability.ALL)
  return params
}

/**
 * One writable path, and exactly one: `/tmp`.
 *
 * G262 asks for *"`/tmp` as an explicit tmpfs mount"*. ⚠️ FARGATE DOES NOT
 * SUPPORT `linuxParameters.tmpfs` — it is an EC2-launch-type property, and
 * declaring it here would produce a task definition that fails to run rather
 * than a tmpfs. The Fargate spelling is an empty task volume, which lives in
 * the task's own ephemeral storage and dies with the task. Same lifetime, same
 * invisibility to the next task; different mechanism, named because the ruling
 * names the other one.
 */
export function mountWritableTmp(
  taskDefinition: ecs.FargateTaskDefinition,
  container: ecs.ContainerDefinition,
): void {
  taskDefinition.addVolume({ name: 'tmp' })
  container.addMountPoints({ containerPath: '/tmp', sourceVolume: 'tmp', readOnly: false })
}

// ------------------------------------------------------------------ the join

/**
 * 🛑 THE ONE FUNCTION THE `Network` + `Data` JOIN EDITS, AND IT RETURNS
 * `undefined` TODAY.
 *
 * `infra/lib/app.ts` instantiates `PlanesStack` only when this returns props.
 * Until the `Network` and `Data` stacks exist there is no VPC to put a task in,
 * no security group to attach and no secret to inject — and a `Planes` stack
 * built on invented values would synthesise green and deploy into nothing,
 * which is worse than an absent stack because it looks finished.
 *
 * The join is one function body: construct or import the `Network` and `Data`
 * stacks, and return a `PlanesStackProps`. Every field is documented on the
 * interfaces above; none of them is optional, deliberately, so the compiler
 * names anything the other half has not supplied.
 *
 * ⚠️ `tests/infra/planes.test.mjs` DOES NOT WAIT FOR THAT. It synthesises the
 * stack against stubs in `infra/test-fixtures/planes-*.ts`, so the credential
 * fence is witnessed — green AND red — before the real props exist.
 */
/**
 * A cluster's generated master secret, or a loud failure.
 *
 * `DatabaseCluster.secret` is `ISecret | undefined` — undefined when the
 * cluster was given credentials rather than asked to generate them. Ours
 * generates, so it is always present; an assertion here turns a future change
 * to that into a synth-time error naming the cluster, rather than a task
 * definition with no credential that deploys and then cannot connect.
 */
function requireSecret(cluster: rds.DatabaseCluster): secretsmanager.ISecret {
  const secret = cluster.secret
  if (secret === undefined) {
    throw new Error(
      `${cluster.node.path} has no generated master secret. The migrate task ` +
        'has nothing to connect as. Give the cluster generated credentials, or ' +
        'pass the secret in explicitly.',
    )
  }
  return secret
}

export function availablePlanesProps(
  network: NetworkStack,
  data: DataStack,
  environment: Environment,
): PlanesStackProps {
  /**
   * ✅ THE JOIN, WRITTEN 18 Sep 2026. This returned `undefined` while the
   * `Network` and `Data` stacks were being built in parallel, so that a stack
   * with no real inputs could not be instantiated on invented ones — *"a stack
   * instantiated on invented values would synthesise green and deploy into
   * nothing, which is worse than an absent one because it looks finished."*
   * Both stacks now exist and are DEPLOYED, so it returns props.
   *
   * 🛑 EVERY VALUE HERE IS A CONSTRUCT REFERENCE, NEVER A LITERAL. Passing
   * `network.vpc` rather than a vpc id makes CloudFormation order the deploys
   * and makes `tsc` check the join; a literal would be a string that is correct
   * on the day it is typed.
   *
   * ⚠️ THE ASYMMETRY BETWEEN THE TWO PLANES IS DELIBERATE AND IS THE FENCE.
   * `data` carries a `migratorSecret` and `control` does not, because
   * `server/control-plane/migrate-main.ts` says nothing in `reconcile_control`
   * is tenant-scoped and so "there is no BYPASSRLS role to" assume. The type
   * refuses to let the control plane hold one, which is G100 expressed where
   * the compiler can see it rather than in a runbook.
   */
  /**
   * ⚠️ ONE `as ISecret` PER SECRET, AND IT IS THE SAME `exactOptionalPropertyTypes`
   * SEAM THIS FILE ALREADY DOCUMENTS FOR `ICluster`. `Secret` declares
   * `secretFullArn: string | undefined` and `ISecret` declares it `string`;
   * under that flag those are different types even though every concrete
   * `Secret` satisfies the interface at run time. Narrowed here, at one site,
   * rather than by weakening the flag for the whole project.
   */
  const password = (secret: secretsmanager.Secret | secretsmanager.ISecret): PasswordSecret => ({
    secret: secret as secretsmanager.ISecret,
    passwordField: 'password',
  })

  return {
    env: CDK_ENV,
    description:
      'G253 - two Fargate services and two one-shot migrate tasks, ARM64, ' +
      'behind one internal ALB with a listener per plane.',
    environment,
    network: {
      vpc: network.vpc,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      loadBalancerSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      dataPlaneAlbSecurityGroup: network.dataPlaneAlbSg,
      controlPlaneAlbSecurityGroup: network.controlPlaneAlbSg,
      dataPlaneSecurityGroup: network.dataPlaneSg,
      controlPlaneSecurityGroup: network.controlPlaneSg,
    },
    data: {
      host: data.dataPlaneCluster.clusterEndpoint.hostname,
      port: data.dataPlaneCluster.clusterEndpoint.port,
      databaseName: DATA_PLANE_DATABASE_NAME,
      adminUser: 'reconcile_data_admin',
      adminSecret: password(requireSecret(data.dataPlaneCluster)),
      migratorSecret: password(data.dataPlaneMigratorSecret),
      appSecret: password(data.dataPlaneAppSecret),
      /* G3861. A construct reference, so `Data` deploys before `Planes`. */
      engineSecret: password(data.dataPlaneEngineSecret),
    },
    control: {
      host: data.controlPlaneCluster.clusterEndpoint.hostname,
      port: data.controlPlaneCluster.clusterEndpoint.port,
      databaseName: CONTROL_PLANE_DATABASE_NAME,
      adminUser: 'reconcile_control_admin',
      adminSecret: password(requireSecret(data.controlPlaneCluster)),
      appSecret: password(data.controlPlaneAppSecret),
    },
  }
}

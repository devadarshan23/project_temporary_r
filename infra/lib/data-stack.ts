/**
 * `Data` — TWO Aurora Serverless v2 PostgreSQL clusters, one per plane, and a
 * scheduled overnight shutdown that is honest about what it does not cover.
 *
 * 🛑 TWO CLUSTERS, NOT ONE WITH TWO DATABASES, AND THE TWO RULINGS THAT SAY SO
 * DISAGREE WITH EACH OTHER — READ BOTH BEFORE CHANGING THIS.
 *
 * **G254**: *"Aurora Serverless v2, PostgreSQL 17, ONE CLUSTER PER PLANE."*
 * **G193**: two processes, two databases, *"the plane boundary is enforced by
 * TOPOLOGY, not by review."*
 * **G185**, which G193's own row says it does not amend, preserved the opposite
 * as REJECTED: *"two instances split by plane"* — refused because two instances
 * give only *"the absence of a route, which is restored by the first connection
 * string, foreign data wrapper, nightly ETL or shared BI replica"*, where a
 * grant is a positive control the database evaluates on every statement.
 *
 * ⚠️ **G254 IS THE LATER RULING AND IT IS WHAT IS BUILT HERE. G185's OBJECTION
 * IS NOT ANSWERED BY THIS FILE AND IS NOT PRETENDED AWAY:** nothing below stops
 * somebody adding a connection string to the other cluster. What is built
 * against it is the security-group pair in `infra/lib/network-stack.ts` — the
 * control-plane task group appears in NO ingress rule on the data cluster's
 * group — plus `db/migrations/` and `db/migrations-control/` staying two
 * schema trees with two credential sets, which is G185's load-bearing half
 * surviving inside G193 exactly as G193's row says it does. **The reconciliation
 * G193 flagged as "nobody's yet" — whether the local stack is a preview of the
 * deployed one — is now answered in the affirmative by G254 and G253, and
 * G185 still has not been amended. That is a live disagreement in §3, not a
 * thing this file resolved.**
 *
 * ⚠️ WHAT IS NOT HERE. No reader instance (staging, G254: writer only). No RDS
 * Proxy — §14 records pooling as *"not needed under G101's posture"*, and the
 * research behind the shutdown block below adds a second reason: a proxy holds
 * a permanent connection to every instance. No Performance Insights.
 *
 * 🛑 **THIS PARAGRAPH READ *"No `cloudwatchLogsExports`, no alarms, no
 * Performance Insights: G261 owns observability and is not applied, and a
 * half-built alarm set reads like a finished one"*, AND TWO OF ITS THREE
 * CLAUSES WENT FALSE ON 20 Sep 2026. It is corrected rather than deleted,
 * because it is the sentence that told a reader this file deliberately shipped
 * no log export.** `infra/lib/observability-stack.ts` exists — G261 is applied
 * — and this cluster now exports its PostgreSQL log, **with the four
 * containment parameters that make that safe landing in the same commit
 * (G1065).** Read the block beside `cloudwatchLogsExports` below before
 * touching either half. **The alarms are not here and must not be**: they live
 * in the `Observability` stack, joined to these clusters by IDENTIFIER, so
 * nothing in that stack forces a deploy of this one.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CfnOutput, Duration, RemovalPolicy, Stack, Tags } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as scheduler from 'aws-cdk-lib/aws-scheduler'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'

import {
  AURORA_MAX_ACU_STAGING,
  AURORA_MIN_ACU_STAGING,
  AURORA_START_CRON,
  AURORA_STOP_CRON,
  CONTROL_PLANE_DATABASE_NAME,
  DATA_PLANE_DATABASE_NAME,
  PG_LOG_CONTAINMENT_PARAMETERS,
  ROLE_SECRET_HOLDER_SERVICES,
  ROLE_SECRET_ROTATION_CRON_UTC,
  ROLE_SECRET_ROTATION_WINDOW,
  SHUTDOWN_TIMEZONE,
  ecsClusterName,
  masterRotationFunctionName,
  planeServiceName,
  roleRotationFunctionName,
} from './config.ts'
import type { Environment, Plane } from './config.ts'
import type { NetworkStack } from './network-stack.ts'
import { applyRequiredTags } from './tagging.ts'

export interface DataStackProps extends StackProps {
  readonly environment: Environment
  /** The `Network` stack. Passed by construct reference so `tsc` checks the join. */
  readonly network: NetworkStack
}

/**
 * 🛑 THE ENGINE VERSION IS A NAMED CONSTANT, NOT A STRING, AND THAT IS THE
 * POINT. `AuroraPostgresEngineVersion.VER_17_9` is checked by `tsc` against the
 * pinned `aws-cdk-lib@2.270.0`; `AuroraPostgresEngineVersion.of('17.9', '17')`
 * would be checked by CloudFormation, in the cloud, minutes after a deploy
 * started. The full derivation — including why 17.9 rather than the newer 17.10
 * that the region also offers, and the `describe-db-engine-versions` command
 * that produced both — is on `AURORA_POSTGRES_VERSION` in `infra/lib/config.ts`.
 * G177 pins PostgreSQL 17; G254 made confirming the Aurora minor a PRECONDITION
 * of this slice rather than a standing note, and that is what was done.
 */
const ENGINE = rds.DatabaseClusterEngine.auroraPostgres({
  version: rds.AuroraPostgresEngineVersion.VER_17_9,
})

/**
 * The characters kept out of a generated password. `pg` handles all of them,
 * but a password that has to survive a shell, a compose file and a URL-encoded
 * connection string does not. The cost is a little entropy; the saving is a
 * class of incident that is always diagnosed last.
 */
const PASSWORD_EXCLUDED_CHARACTERS = '"@/\\\'` '

/**
 * When the credential rotates. **UTC, not `SHUTDOWN_TIMEZONE`** — Secrets
 * Manager interprets a rotation cron in UTC and has no timezone field, unlike
 * EventBridge Scheduler, which does. 02:00 UTC is 10:00 in `Asia/Singapore`,
 * squarely inside the window in which the clusters are running.
 */
const ROTATION_CRON_UTC = 'cron(0 2 ? * TUE *)'

/** Where the role-secret rotation function's source lives. A directory asset: no bundler, no network. */
const ROLE_ROTATION_ASSET_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'lambda',
  'role-secret-rotation',
)

/**
 * The generated role-password length. `roleSecret()` and the rotation function
 * both read this, so a rotated password is the same shape as a minted one.
 */
const ROLE_PASSWORD_LENGTH = 40

/**
 * 🛑 THE ROLE THE CONTROL PLANE CONNECTS AS — `CONTROL_APP_ROLE` in
 * `server/control-plane/config.ts`, SPELLED here because `infra/` cannot
 * import across its own manifest (G259). G4471, V-3, closing G4463: this file
 * named `reconcile_app` — the DATA plane's role — for the `ControlApp` secret
 * and its rotation, and the weekly rotation refused every attempt with
 * `role_absent_or_nologin: reconcile_app`. One spelling for the secret's
 * username AND the rotated role, because the rotation refuses when the two
 * disagree. `tests/infra/rotation-role-matches-plane.test.mjs` reads the
 * server's constant and requires this to equal it.
 */
const CONTROL_APP_ROLE = 'reconcile_control_app'

type RoleSecretId = keyof typeof ROLE_SECRET_HOLDER_SERVICES

interface PlaneClusterOptions {
  readonly scope: Construct
  readonly environment: Environment
  readonly vpc: ec2.IVpc
  readonly securityGroup: ec2.ISecurityGroup
  /** The rotation function's group, created and pre-authorised in `Network`. */
  readonly rotationSecurityGroup: ec2.ISecurityGroup
  readonly databaseName: string
  readonly masterUsername: string
  readonly clusterIdentifier: string
  /** `data` or `control`. Names the rotation Lambda; see its `functionName`. */
  readonly planeSlug: 'data' | 'control'
}

export class DataStack extends Stack {
  readonly dataPlaneCluster: rds.DatabaseCluster
  readonly controlPlaneCluster: rds.DatabaseCluster

  /** The role passwords. See `roleSecret()` for why these are not the master secret. */
  readonly dataPlaneMigratorSecret: secretsmanager.Secret
  readonly dataPlaneAppSecret: secretsmanager.Secret
  /**
   * 🛑 `reconcile_engine` — THE RUN WORKER'S CREDENTIAL. G3861, 4 Oct 2026,
   * discharging G3749.
   *
   * `db/migrations/0500` §1 makes `reconcile_engine` `reconcile_app`'s
   * privileges PLUS `INSERT` on the two exception tables — the privilege
   * `0015` refused the request path, because a serving process that could
   * INSERT an exception could mint a finding against itself.
   *
   * 🛑 TWO PRINCIPALS HOLD IT AND THE SERVING DATA PLANE IS NOT ONE OF THEM.
   * The DATA MIGRATE task holds it because `createRoles()` SETS the role's
   * password (`db/provision.ts`, `ALTER ROLE … PASSWORD`) — the same reason it
   * holds `RECONCILE_APP_PASSWORD` — and the RUN WORKER (`RunQueue`) holds it
   * because it authenticates with it. `tests/infra/planes.test.mjs` and
   * `tests/infra/run-queue.test.mjs` require the data SERVICE to hold it by
   * NO route.
   */
  readonly dataPlaneEngineSecret: secretsmanager.Secret
  /** ⚠️ NO control-plane migrator, and that mirrors the tree rather than saving a resource.
   *  `server/control-plane/migrate-main.ts`: nothing in `reconcile_control` is
   *  tenant-scoped, so "there is no BYPASSRLS role to" assume. */
  readonly controlPlaneAppSecret: secretsmanager.Secret

  /** ⚠️ NOT `environment` — `Stack` already declares that, publicly. */
  private readonly envName: Environment

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props)

    const { environment, network } = props
    this.envName = environment

    /* Two scopes, so the `Plane` tag can be TRUE of each subtree rather than
     * true of the stack on average. G260 says `Plane` is the field invariant 3
     * is audited from; a cluster tagged with the wrong plane is worse than an
     * untagged one, because the query returns clean. */
    const dataScope = new Construct(this, 'DataPlane')
    const controlScope = new Construct(this, 'ControlPlane')

    this.dataPlaneCluster = this.planeCluster({
      scope: dataScope,
      environment,
      vpc: network.vpc,
      securityGroup: network.dataPlaneDbSg,
      rotationSecurityGroup: network.dataPlaneRotationSg,
      databaseName: DATA_PLANE_DATABASE_NAME,
      // The name `compose.yaml` gives the same role, and the one `db/env.ts`
      // reads as `RECONCILE_DB_ADMIN`. Aurora's master user IS that superuser:
      // `db/provision.ts` needs one because `CREATE ROLE ... BYPASSRLS` requires
      // it and a migration cannot mint the role it runs as.
      masterUsername: 'reconcile_data_admin',
      clusterIdentifier: `reconcile-${environment}-data`,
      planeSlug: 'data',
    })
    this.dataPlaneMigratorSecret = this.roleSecret(dataScope, 'DataMigrator', 'reconcile_migrator')
    this.dataPlaneAppSecret = this.roleSecret(dataScope, 'DataApp', 'reconcile_app')
    /* G3861. The role name is `ROLES.engine` in `db/env.ts`, SPELLED here for
     * the reason the reader secret below states (G259's manifest boundary).
     * ⚠️ NOTHING CHECKS THE TWO AGREE — derive before changing either:
     *   grep -n "engine: 'reconcile_engine'" db/env.ts */
    this.dataPlaneEngineSecret = this.roleSecret(dataScope, 'DataEngine', 'reconcile_engine')
    Tags.of(dataScope).add('Plane', 'data', { priority: 200 })

    this.controlPlaneCluster = this.planeCluster({
      scope: controlScope,
      environment,
      vpc: network.vpc,
      securityGroup: network.controlPlaneDbSg,
      rotationSecurityGroup: network.controlPlaneRotationSg,
      databaseName: CONTROL_PLANE_DATABASE_NAME,
      masterUsername: 'reconcile_control_admin',
      clusterIdentifier: `reconcile-${environment}-control`,
      planeSlug: 'control',
    })
    this.controlPlaneAppSecret = this.roleSecret(controlScope, 'ControlApp', CONTROL_APP_ROLE)
    Tags.of(controlScope).add('Plane', 'control', { priority: 200 })

    /* G3921 — every role secret rotates, set by the cluster ADMIN. One
     * function per secret; read `roleSecretRotation()` before changing any of
     * the four calls below (⚠️ FIVE until G4320 retired `ControlReader`; this
     * said five until G4471 — G4464. Derive it, never read it:
     * `Object.keys(ROLE_SECRET_HOLDER_SERVICES).length` → 4). The plane of each
     * function is the plane of the CLUSTER the role lives in, and each role is
     * the one that cluster's plane connects as. */
    const dataRotation = {
      scope: dataScope,
      cluster: this.dataPlaneCluster,
      databaseName: DATA_PLANE_DATABASE_NAME,
      vpc: network.vpc,
      securityGroup: network.dataPlaneRotationSg,
    }
    const controlRotation = {
      scope: controlScope,
      cluster: this.controlPlaneCluster,
      databaseName: CONTROL_PLANE_DATABASE_NAME,
      vpc: network.vpc,
      securityGroup: network.controlPlaneRotationSg,
    }
    this.roleSecretRotation({
      ...dataRotation,
      id: 'DataMigrator',
      secret: this.dataPlaneMigratorSecret,
      roleName: 'reconcile_migrator',
    })
    this.roleSecretRotation({
      ...dataRotation,
      id: 'DataApp',
      secret: this.dataPlaneAppSecret,
      roleName: 'reconcile_app',
    })
    this.roleSecretRotation({
      ...dataRotation,
      id: 'DataEngine',
      secret: this.dataPlaneEngineSecret,
      roleName: 'reconcile_engine',
    })
    this.roleSecretRotation({
      ...controlRotation,
      id: 'ControlApp',
      secret: this.controlPlaneAppSecret,
      roleName: CONTROL_APP_ROLE,
    })

    this.scheduleOvernightShutdown(environment)

    /* `shared` for the stack, overridden per plane above. The only resources
     * this leaves at `shared` are the shutdown scheduler's IAM role and the two
     * schedules, which genuinely act on both clusters — see that block. */
    applyRequiredTags(this, environment, 'shared')

    this.outputs('DataPlane', this.dataPlaneCluster, 'data')
    this.outputs('ControlPlane', this.controlPlaneCluster, 'control')
  }

  // ------------------------------------------------------------ one cluster

  private planeCluster(options: PlaneClusterOptions): rds.DatabaseCluster {
    const isProd = options.environment === 'prod'

    /**
     * 🛑 THE PARAMETER GROUP AND THE LOG EXPORT ARE ONE COMMIT OR NEITHER —
     * G1065, 20 Sep 2026, and this is G511's rule (*"the fence and the writer
     * are one commit or neither"*) applied to a LOG.
     *
     * `cloudwatchLogsExports: ['postgresql']` ships this cluster's PostgreSQL
     * log into CloudWatch, where an operator, a dashboard and eventually a
     * model can read it. G261 section 12.1 is a CONTAINMENT rule, not a style:
     * *"A log line carries identifiers, codes, counts and durations. It never
     * carries a payload field value, counterparty text, a document body, a
     * header value or a query string."* **A PostgreSQL log can carry every one
     * of those**, and whether it does is decided by four parameters this
     * repository did not set.
     *
     * The load-bearing one is `log_parameter_max_length_on_error`. Every query
     * in `server/` BINDS its values, so the statement text carries `$1` and not
     * the value — **unless that parameter is non-zero, at which point the bound
     * values are written beside the statement on every error**, which on a
     * reconciliation product means counterparty amounts, references and names
     * in a log nothing classified. Invariant 4 and invariant 6, both, decided
     * by a default in a parameter group nobody in this repository owns.
     *
     * ⚠️ THREE OF THE FOUR ARE ALREADY THE ENGINE DEFAULT, AND PINNING A
     * DEFAULT IS THE POINT RATHER THAN CEREMONY: an unpinned default is a value
     * anybody holding `rds:ModifyDBClusterParameterGroup` can change without
     * touching this repository, and no control in `npm run check` could see it.
     * Turning the export on WITHOUT pinning them would make a containment
     * invariant a property of the console.
     *
     * ⚠️ WHAT THIS DOES NOT DO: the log group AWS creates for these exports —
     * `/aws/rds/cluster/<id>/postgresql` — is created by RDS and not by CDK, so
     * its retention is `Never expire` and is NOT set here. That is a real gap,
     * named rather than hidden; `lib/observability-stack.ts` sets retention on
     * the one log group it owns and cannot set it on one it does not create.
     */
    const parameterGroup = new rds.ParameterGroup(options.scope, 'ClusterParameters', {
      engine: ENGINE,
      description:
        'G261 section 12.1 - the four settings that keep a payload value out of the PostgreSQL ' +
        'log that is exported to CloudWatch. Read db/migrations and invariant 4 before changing.',
      parameters: { ...PG_LOG_CONTAINMENT_PARAMETERS },
    })

    const cluster = new rds.DatabaseCluster(options.scope, 'Cluster', {
      clusterIdentifier: options.clusterIdentifier,
      engine: ENGINE,
      parameterGroup,
      /**
       * G261: the PostgreSQL log reaches CloudWatch. **Safe only because of the
       * parameter group above** — read its block before touching either.
       */
      cloudwatchLogsExports: ['postgresql'],
      vpc: options.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      /* 🛑 THE ONE GROUP. Passing it here is what makes the network stack's
       * "no control-plane source" property mean something: the cluster's OWN
       * `connections` object resolves to this group, so anything that later
       * calls `cluster.connections.allowFrom(...)` writes its rule onto the
       * group `tests/infra/network.test.mjs` is watching. */
      securityGroups: [options.securityGroup],

      /**
       * ⚠️ `autoMinorVersionUpgrade: false` IS THE LINE THAT MAKES G177's PIN A
       * PIN. Aurora's default is TRUE, which means AWS moves the minor version
       * under you during a maintenance window — and G177's whole sentence is
       * that *"a migration written against an unpinned major is a migration
       * nobody can prove ran on the version production will use."* A version
       * that AWS is free to change is an unpinned version wearing a literal.
       * The cost is accepted and is real: minor patches, security ones
       * included, now arrive only when somebody bumps `VER_17_9` in a reviewed
       * pull request. That is the same trade G191 already takes on every npm
       * dependency in this repository.
       */
      writer: rds.ClusterInstance.serverlessV2('Writer', {
        autoMinorVersionUpgrade: false,
        publiclyAccessible: false,
      }),
      // G254 — staging. No reader: a reader would double the ACU floor to buy
      // availability nothing is asking for yet.
      serverlessV2MinCapacity: AURORA_MIN_ACU_STAGING,
      serverlessV2MaxCapacity: AURORA_MAX_ACU_STAGING,

      /**
       * G263 — the credential is minted by Secrets Manager and never written
       * anywhere else. `fromGeneratedSecret` means no password exists in this
       * repository, in the template, or in any `.env`; the ECS task definitions
       * the `Planes` slice writes must inject it as a task **secret**, which is
       * the half of G263 this stack cannot enforce and is named below.
       */
      credentials: rds.Credentials.fromGeneratedSecret(options.masterUsername, {
        secretName: `${options.clusterIdentifier}/master`,
        excludeCharacters: PASSWORD_EXCLUDED_CHARACTERS,
      }),
      defaultDatabaseName: options.databaseName,

      storageEncrypted: true,
      // Staging keeps one day; prod would keep fourteen. Both are below the
      // point where backup storage is a line anybody notices.
      backup: { retention: Duration.days(isProd ? 14 : 1) },
      deletionProtection: isProd,
      /* SNAPSHOT rather than DESTROY even in staging: the thing worth keeping
       * is not the fixture data, it is the `schema_migration` ledger
       * (`db/migrate.ts`) — forward-only migrations under G88 mean a lost
       * ledger is a database nobody can reason about. */
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.SNAPSHOT,
    })

    /**
     * G263 — ROTATION, AND THE SCHEDULE IS PINNED TO A WEEKDAY MORNING FOR A
     * REASON THAT ONLY EXISTS BECAUSE OF THE SHUTDOWN BLOCK BELOW.
     *
     * 🛑 A ROTATION THAT FIRES WHILE THE CLUSTER IS STOPPED FAILS. AWS's page
     * on stopping a cluster is explicit that a stopped cluster cannot be
     * modified and accepts no connections, and the rotation Lambda's whole job
     * is to connect and `ALTER ROLE`. CDK's L2 offers only
     * `automaticallyAfter`, which becomes `rate(30 days)` — an expression that
     * fires at an hour nobody chose, and with this stack's schedule roughly
     * three nights and two whole days in every seven are stopped. **That is a
     * rotation that fails most of the time, reports a failure event nobody has
     * wired an alarm to yet (G261), and leaves the credential unrotated while
     * the record claims rotation is on.**
     *
     * So the rule is overridden to a cron that cannot land outside the running
     * window: **every Tuesday at 02:00 UTC — 10:00 in `Asia/Singapore` — with a
     * three-hour window.** Tuesday because a weekday is always a running day,
     * where a monthly day-of-month lands on a weekend two times in seven.
     * 02:00 UTC because Secrets Manager's rotation cron requires the minutes
     * field to be zero and interprets the expression in UTC, not in the
     * scheduler's timezone.
     *
     * ⚠️ WEEKLY IS MORE OFTEN THAN G263 ASKS FOR, AND IT IS THE PRICE OF
     * COMPOSABILITY RATHER THAN A SECURITY POSTURE. The alternative was a
     * monthly expression plus a rule about which dates are safe, which is a
     * rule keyed on a convenient landmark instead of the property it protects —
     * `docs/HANDOFF.md` §5's standing finding.
     *
     * 🛑 AND THE INTERACTION THE `Planes` SLICE INHERITS: single-user rotation
     * changes the password in place. A running ECS task that read the secret at
     * start-up holds a stale password and its pool's NEXT new connection is
     * refused. `pg` does not re-read a secret. Whoever writes the task
     * definitions owns that, and the cheap answer is that staging tasks are
     * restarted every morning anyway by the schedule below — which is true on
     * Tuesday at 10:00 only if somebody makes it true.
     *
     * ⚠️ A **HOSTED** ROTATION, NOT `cluster.addRotationSingleUser()`, AND THE
     * REASON IS A SYNTH FAILURE RATHER THAN A PREFERENCE. That method calls
     * `connections.allowDefaultPortFrom()`, whose port is the cluster's
     * deploy-time `Endpoint.Port` attribute — which makes `Network` depend on
     * `Data` and produces a `«DependencyCycle»`. The full narration is in
     * `infra/lib/network-stack.ts`, beside the groups it moved. A hosted
     * rotation binds to the SECRET, so it never reads the cluster's
     * connections; Secrets Manager owns the function, which also removes the
     * `AWS::Serverless::Application` transform that `SecretRotation` pulls in.
     */
    const secret = cluster.secret
    /* Not defensive: `fromGeneratedSecret` above guarantees this, and the
     * check exists so that deleting that line fails HERE, loudly, rather than
     * silently producing a cluster with no rotation and a record that says
     * G263 is applied. */
    if (secret === undefined) {
      throw new Error(
        `${options.clusterIdentifier}: G263 requires a rotatable secret and the ` +
          'cluster has none. Restore `credentials: rds.Credentials.fromGeneratedSecret(...)`.',
      )
    }

    /**
     * 🛑 `functionName` IS SET EXPLICITLY, AND IT IS NOT COSMETIC — THE DEPLOY
     * FAILED WITHOUT IT.
     *
     * CDK derives the hosted rotation Lambda's name from the CONSTRUCT PATH, and
     * the path here is long enough to break Lambda's own limit:
     *
     *     Value 'DataPlaneClusterSecretAttachmentRotation2428FFCA-PostgreSQLSingleUser-Lambda'
     *     at 'functionName' failed to satisfy constraint: Member must have
     *     length less than or equal to 64
     *
     * The generated name is 76 characters and nothing in `cdk synth` checks it —
     * this surfaced in CloudFormation, minutes into a real deploy, on a nested
     * stack. Naming it ourselves removes the construct path from the equation
     * entirely, and the name stays under the limit whatever the tree does above
     * it. The plane is in the name so two clusters cannot collide.
     */
    const rotation = secret.addRotationSchedule('Rotation', {
      hostedRotation: secretsmanager.HostedRotation.postgreSqlSingleUser({
        functionName: masterRotationFunctionName(options.environment, options.planeSlug),
        vpc: options.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [options.rotationSecurityGroup],
        excludeCharacters: PASSWORD_EXCLUDED_CHARACTERS,
      }),
    })

    /* The escape hatch. CDK's L2 exposes only `automaticallyAfter`, which
     * renders as a `rate()`; the cron above is the whole point and there is no
     * typed way to ask for it. */
    const rotationRule = rotation.node.findChild('Resource') as secretsmanager.CfnRotationSchedule
    rotationRule.rotationRules = {
      scheduleExpression: ROTATION_CRON_UTC,
      duration: '3h',
    }

    return cluster
  }

  /**
   * The ROLE passwords — one Secrets Manager secret per role the migrate job
   * creates. G263: *"no static keys anywhere"*, and a password in a task
   * definition's plain `environment` is a static key with extra steps.
   *
   * 🛑 THESE ARE NOT THE CLUSTER'S MASTER SECRET AND THE DIFFERENCE IS THE
   * WHOLE OF G100's SEPARATION.
   *
   * `db/env.ts` reads three things, and the split across them is the fence:
   *
   *   RECONCILE_DB_ADMIN           the master user. Creates the roles. Held by
   *                                the MIGRATE task and by nothing else.
   *   RECONCILE_MIGRATOR_PASSWORD  `reconcile_migrator`, LOGIN BYPASSRLS — the
   *                                read exemption every isolation assertion in
   *                                `tests/` is relative to. MIGRATE ONLY.
   *   RECONCILE_APP_PASSWORD       `reconcile_app`, NOBYPASSRLS. The serving
   *                                process gets THIS and nothing else.
   *
   * `server/data-plane/migrate-main.ts` says it in its own header: the serving
   * process "holds `RECONCILE_APP_PASSWORD` and NOTHING ELSE." So the secrets
   * exist here, infrastructure mints the passwords, and `createRoles()` sets
   * them — rather than a human choosing one or a task inventing one.
   *
   * ⚠️ VERIFIED ON THE REAL CLUSTER, 18 Sep 2026, because it nearly forced a
   * redesign: Aurora's master user reports `usesuper=false` and IS a member of
   * `rds_superuser`, and `CREATE ROLE ... LOGIN BYPASSRLS` SUCCEEDS anyway.
   * `db/provision.ts` warns that BYPASSRLS "can only be granted by" a
   * superuser, which reads as though G100 cannot be built on Aurora at all.
   * It can.
   *
   * ✅ **THESE ROTATE SINCE 4 Oct 2026 — G3921, CLOSING G3866 IN CODE — AND
   * THE PARAGRAPH THAT STOOD HERE IS QUOTED RATHER THAN DELETED**, because it
   * is the sentence that told a reader the role secrets were static: *"⚠️ NO
   * ROTATION ON THESE. The cluster's master secret rotates; these do not,
   * because rotating them means re-running `ALTER ROLE` AND restarting every
   * task holding the old one, and nothing here does the second half."* **Its
   * premise survives and is the design**: the first half is the rotation
   * function's `setSecret` (as the ADMIN), and the second half is answered by
   * NOT needing a restart — rotation is confined to the hour no holder runs,
   * and refuses if one does. See `roleSecretRotation()` below.
   */
  private roleSecret(scope: Construct, id: RoleSecretId, username: string): secretsmanager.Secret {
    return new secretsmanager.Secret(scope, id, {
      secretName: `reconcile-${this.envName}-${id.toLowerCase()}`,
      description: `The ${username} role password. Set by the migrate job; read by the task that needs it.`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username }),
        generateStringKey: 'password',
        excludeCharacters: PASSWORD_EXCLUDED_CHARACTERS,
        passwordLength: ROLE_PASSWORD_LENGTH,
      },
    })
  }

  // ------------------------------------------------- role-secret rotation

  /**
   * 🛑 G3921–G3925 — ROTATION FOR ONE ROLE SECRET, AND THE FOUR DECISIONS IN
   * IT ARE EACH A REFUSAL OF SOMETHING CHEAPER.
   *
   * ⛔ **REFUSED — AWS's HOSTED `PostgreSQLMultiUser`.** It is the zero-downtime
   * answer AWS documents, and it does not fit this topology at three points:
   * it ALTERNATES between `reconcile_app` and a minted `reconcile_app_clone`;
   * the clone reaches the original's privileges by MEMBERSHIP, and `BYPASSRLS`
   * is a role ATTRIBUTE that membership does not carry, so
   * `reconcile_migrator_clone` would be refused every tenant-scoped write
   * (G100); and every process in `server/` connects as the role name its own
   * code spells (`db/env.ts#ROLES`), reading only the PASSWORD from the secret.
   * A clone would hold a password no process could use.
   *
   * ⛔ **REFUSED — AWS's HOSTED `PostgreSQLSingleUser` ON THE ROLE SECRET.** It
   * logs in AS the role and runs `ALTER USER` on itself: the request-path
   * credential exercising a password verb. PostgreSQL lets any role change its
   * own password and nothing here can remove that, but nothing here should
   * RELY on it either. ✅ **TAKEN: the cluster's MASTER user sets the new
   * password** — the principal `db/provision.ts#createRoles()` already sets it
   * with on every migrate run, so rotation and migration are ONE path to the
   * role. The function holds `GetSecretValue` on the master secret and NOTHING
   * ELSE on it; it cannot write the master, and no serving role can reach the
   * function (`tests/infra/role-secret-rotation.test.mjs` §3).
   *
   * 🛑 **NO FORCED REDEPLOY AFTER A ROTATION, AND THE ARGUMENT IS THE SCHEDULE
   * PLUS A REFUSAL.** A role has ONE password; a running task that read the old
   * one keeps its open connections and fails its next new one, and `pg` never
   * re-reads a secret. Three answers were weighed:
   *   ⛔ force a new deployment from the function's `finishSecret` — gives a
   *      rotation function `ecs:UpdateService`, which G2046 took away from the
   *      Deploy project because *"a stage that could still call UpdateService
   *      could put the fleet back out of step with the stack by hand"*; and the
   *      rolling deploy itself spends minutes with OLD tasks on a dead password.
   *   ⛔ WakeFleet afterwards — the pipeline's wake RAISES a fleet at zero; it
   *      restarts nothing that is running, so it answers the wrong case.
   *   ✅ rotate ONLY in the hour the serving fleet is at zero by the cost
   *      schedule (`ROLE_SECRET_ROTATION_CRON_UTC`, derived in `config.ts`), so
   *      every holder STARTS after the rotation and reads the new AWSCURRENT;
   *      and REFUSE — `DescribeServices`, read-only — if any holder service is
   *      not at zero. A refused rotation leaves AWSCURRENT untouched and FAILS,
   *      which `Observability` alarms on (G3924). The one-shot holders (both
   *      migrate tasks, the run worker) read the secret at every start.
   *
   * ⚠️ `rotateImmediatelyOnUpdate: false`, AND IT IS THE SAME ARGUMENT. Secrets
   * Manager rotates the moment a schedule is created unless told not to, which
   * would be at `cdk deploy` time — the middle of a working day with the fleet
   * up. The first rotation is the first scheduled window.
   *
   * ⚠️ THE FUNCTION RUNS ON THE PLANE'S EXISTING ROTATION SECURITY GROUP, which
   * `Network` created and pre-authorised for exactly this ("the rotation
   * function's group"), so `Network` does not move.
   */
  private roleSecretRotation(options: {
    readonly scope: Construct
    readonly id: RoleSecretId
    readonly secret: secretsmanager.Secret
    readonly roleName: string
    readonly cluster: rds.DatabaseCluster
    readonly databaseName: string
    readonly vpc: ec2.IVpc
    readonly securityGroup: ec2.ISecurityGroup
  }): lambda.Function {
    const { scope, id, secret, roleName, cluster } = options
    const masterSecret = cluster.secret
    if (masterSecret === undefined) {
      throw new Error(
        `${id}: the role rotation sets passwords as the cluster admin, and the cluster has no secret.`,
      )
    }
    const functionName = roleRotationFunctionName(this.envName, id)
    const ecsCluster = ecsClusterName(this.envName)
    const holderServices = ROLE_SECRET_HOLDER_SERVICES[id].map((plane) =>
      planeServiceName(this.envName, plane),
    )

    const logGroup = new logs.LogGroup(scope, `${id}RotationLogs`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const fn = new lambda.Function(scope, `${id}Rotation`, {
      functionName,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(ROLE_ROTATION_ASSET_DIR),
      timeout: Duration.minutes(2),
      memorySize: 256,
      /* One rotation of one secret at a time. Secrets Manager already
       * serialises a secret's steps; this bounds a retry loop too. */
      reservedConcurrentExecutions: 1,
      logGroup,
      vpc: options.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [options.securityGroup],
      description:
        `G3921 - rotates ${roleName}'s password. Sets it AS THE CLUSTER ADMIN; refuses ` +
        'while any service holding the secret is running.',
      environment: {
        ROTATION_SECRET_ARN: secret.secretArn,
        ROTATION_MASTER_SECRET_ARN: masterSecret.secretArn,
        ROTATION_ROLE_NAME: roleName,
        ROTATION_DATABASE_NAME: options.databaseName,
        ROTATION_EXCLUDE_CHARACTERS: PASSWORD_EXCLUDED_CHARACTERS,
        ROTATION_PASSWORD_LENGTH: String(ROLE_PASSWORD_LENGTH),
        ROTATION_HOLDER_SERVICES: JSON.stringify({ cluster: ecsCluster, services: holderServices }),
        /* ⚠️ AN UNMEASURED PREMISE, NAMED (G3925): the `nodejs22.x` runtime
         * loads the Amazon RDS CA bundle only when told to, at this path.
         * `pgwire.mjs` VERIFIES the server certificate, so if the premise is
         * wrong the rotation fails at `setSecret` BEFORE any password moves. */
        NODE_EXTRA_CA_CERTS: '/var/runtime/ca-cert.pem',
      },
    })

    /* The admin's password, READ. No write verb on the master secret — its own
     * hosted rotation is the only thing that changes it. */
    masterSecret.grantRead(fn)

    if (holderServices.length > 0) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          sid: 'ReadHolderServicesOnly',
          actions: ['ecs:DescribeServices'],
          resources: holderServices.map((service) =>
            this.formatArn({
              service: 'ecs',
              resource: 'service',
              resourceName: `${ecsCluster}/${service}`,
            }),
          ),
        }),
      )
    }

    const schedule = secret.addRotationSchedule('Rotation', {
      rotationLambda: fn,
      rotateImmediatelyOnUpdate: false,
    })
    /* 🛑 THE INVOKE PERMISSION IS NARROWED TO THIS SECRET. CDK's grant to
     * `secretsmanager.amazonaws.com` carries no source condition, so any
     * secret in any account could name this function as its rotator — and this
     * function holds the cluster ADMIN's password. `SourceArn` is the
     * confused-deputy fence; `readEvent()` comparing the SecretId is the
     * second, independent one. */
    const invokePermissions = fn.node.children.filter(
      (c): c is lambda.CfnPermission => c instanceof lambda.CfnPermission,
    )
    if (invokePermissions.length !== 1) {
      throw new Error(`${id}: expected exactly one invoke permission on the rotation function`)
    }
    invokePermissions[0]!.sourceArn = secret.secretArn
    invokePermissions[0]!.sourceAccount = this.account

    /* The escape hatch, for the master's reason: the L2 renders only `rate()`. */
    const rule = schedule.node.findChild('Resource') as secretsmanager.CfnRotationSchedule
    rule.rotationRules = {
      scheduleExpression: ROLE_SECRET_ROTATION_CRON_UTC,
      duration: ROLE_SECRET_ROTATION_WINDOW,
    }
    return fn
  }

  // -------------------------------------------------- the overnight shutdown

  /**
   * 🛑 STAGING RUNS WORKING HOURS. WHAT FOLLOWS IS THE OPTION THAT ACTUALLY
   * WORKS FOR SERVERLESS v2, AND THE TWO THAT DO NOT ARE RECORDED AS REJECTED
   * RATHER THAN LEFT FOR SOMEBODY TO RE-PROPOSE.
   *
   * ⛔ **REJECTED — (a) SCALE MIN/MAX ACU TO ZERO ON A SCHEDULE.** This is the
   * option that looks best and is the one that does not work here. Setting
   * `MinCapacity` to 0 enables Aurora's native auto-pause, but AWS's own page
   * on it says, twice and in terms:
   *
   *     "If any user-initiated connections are open to an Aurora serverless
   *      instance, the instance won't pause."
   *     "Aurora won't pause an instance if there are any user-initiated
   *      connections open, REGARDLESS OF WHETHER THE CONNECTIONS AREN'T RUNNING
   *      ANY SQL STATEMENTS OR TRANSACTIONS."
   *
   *     — docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html
   *
   * **G101 puts an in-process `pg.Pool` in each plane**, and a warm pool is
   * exactly a set of idle user-initiated connections. So an always-running ECS
   * service structurally disqualifies its own cluster from ever pausing, and
   * the bill is NOT zero — AWS documents no floor rate for a min-0 instance
   * that is prevented from pausing, which makes the saving unquantifiable as
   * well as absent. There is also no AWS-native scheduled scaling to reach for:
   * Application Auto Scaling's only RDS dimension is
   * `rds:cluster:ReadReplicaCount`, and the requirements page says flatly
   * *"Aurora Auto Scaling isn't supported"* for serverless. Driving
   * `modify-db-cluster` from a Lambda on a cron would be custom code whose best
   * case is still the non-pausing bill above.
   *
   * ⛔ **REJECTED — (c) LEAVE AURORA UP AND SCALE ONLY ECS.** Scaling ECS to
   * zero does close every connection, which would let a min-0 cluster pause —
   * but it leaves the two clusters at a 0.5-ACU floor under G254's own
   * parameters, which is the larger of the two bills and the one the owner
   * asked to remove.
   *
   * ✅ **TAKEN — (b) `rds:StopDBCluster` ON A SCHEDULE.** AWS's stop/start page
   * lists what cannot be stopped and serverless is affirmatively excluded from
   * the list: *"With Aurora serverless, you can stop and start the cluster."*
   * And the billing sentence is the one that matters:
   *
   *     "While your DB cluster is stopped, you're charged only for cluster
   *      storage, manual snapshots, and automated backup storage within your
   *      specified retention window. YOU AREN'T CHARGED FOR ANY DB INSTANCE
   *      HOURS."
   *
   *     — docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-cluster-stop-start.html
   *
   * 🛑 **THE SEVEN-DAY LIMIT IS REAL AND IS HANDLED BY THE SHAPE OF THE
   * SCHEDULE, NOT BY LUCK.** *"You can stop a DB cluster for up to seven days.
   * If you don't manually start your DB cluster after seven days, your DB
   * cluster is automatically started."* The longest gap this schedule produces
   * is Friday 20:00 to Monday 06:30 — under 60 hours — so the seven-day
   * auto-start is a backstop that never fires. **It WOULD fire if somebody
   * disables the start schedule and leaves the stop one enabled**, and the
   * result is a cluster that silently comes back up and bills, which is the
   * failure mode to watch for rather than a safety net to rely on.
   *
   * ⚠️ **WHAT THIS DOES NOT COVER. READ THIS BEFORE QUOTING A SAVING.**
   *
   *   · **The NAT gateway does not stop.** One gateway at roughly $0.045/hour
   *     is about $33 a month and runs 24/7 regardless. On a staging
   *     environment this is plausibly the LARGEST surviving line, and nothing
   *     in this stack touches it.
   *   · **Storage, automated backups and snapshots keep billing**, by AWS's own
   *     sentence above. What stops is instance hours, which is the ACU line and
   *     nothing else.
   *   · **The ECS services are not this stack's.** They keep running against a
   *     stopped database and will crash-loop overnight unless the `Planes`
   *     slice scales them to zero. `ECS_SCALE_DOWN_CRON` and
   *     `ECS_SCALE_UP_CRON` in `infra/lib/config.ts` exist for that slice to
   *     read; nothing here can enforce that it does. **If that half is never
   *     built, this schedule still saves the Aurora compute and buys a nightly
   *     alarm storm.**
   *   · **No automated backups run while stopped**, and the cluster cannot be
   *     MODIFIED while stopped — so a `cdk deploy` of this stack between 20:00
   *     and 06:30 will fail. That is a property of the environment now and is
   *     not signposted anywhere except here.
   *   · **A restart is not instant.** AWS: *"can take minutes to hours, but
   *     usually takes several minutes."* The thirty-minute head start before
   *     ECS is a margin, not a guarantee.
   *   · **`prod` is not instantiated and must never get this.** The schedule is
   *     created unconditionally in this method because only `staging` is built;
   *     the day a `prod` stack exists, this call needs a guard, and that is a
   *     line somebody must write rather than a thing that happens.
   *   · **Nothing measures the saving.** No Cost Explorer budget, no alarm on a
   *     cluster that failed to stop. G261 owns that and is not applied, so the
   *     claim "staging costs less overnight" is reasoned here and evidenced
   *     nowhere.
   *
   * ⚠️ **AND ONE STRUCTURAL GAP IN THE CONTROL ITSELF:
   * `AWS::Scheduler::Schedule` CARRIES NO `Tags` PROPERTY IN CLOUDFORMATION**,
   * so `RequiredTagsAspect` skips the two schedules — `TagManager.isTaggable()`
   * is false for them. They are the only resources this stack creates that
   * G260's tag query cannot see. Stated rather than left for somebody to
   * discover from an empty result.
   */
  private scheduleOvernightShutdown(environment: Environment): void {
    const clusterArns = [
      this.dataPlaneCluster.clusterArn,
      this.controlPlaneCluster.clusterArn,
    ]

    /* 🛑 `aws:SourceAccount` ON THE TRUST POLICY. `scheduler.amazonaws.com` is
     * a service principal shared by every AWS account; without the condition
     * this role is assumable by EventBridge Scheduler ANYWHERE. The `CiImage`
     * stack takes the same care with `codebuild.amazonaws.com` and says so for
     * the same reason. */
    const role = new iam.Role(this, 'ShutdownSchedulerRole', {
      roleName: `reconcile-${environment}-aurora-shutdown`,
      description:
        'EventBridge Scheduler stops and starts the two staging Aurora clusters. ' +
        'Two actions, two resources, nothing else.',
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com', {
        conditions: { StringEquals: { 'aws:SourceAccount': this.account } },
      }),
    })

    /* The fence is the RESOURCE list. This role cannot stop, start, modify,
     * snapshot or delete any other cluster in a SHARED account (G256/G279), and
     * it holds neither `rds:DeleteDBCluster` nor `rds:ModifyDBCluster`. */
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'StopAndStartTheTwoStagingClusters',
        actions: ['rds:StopDBCluster', 'rds:StartDBCluster'],
        resources: clusterArns,
      }),
    )

    const schedules: ReadonlyArray<{
      readonly id: string
      readonly cron: string
      readonly sdkAction: string
      readonly cluster: rds.DatabaseCluster
      readonly plane: Plane
    }> = [
      {
        id: 'StopData',
        cron: AURORA_STOP_CRON,
        sdkAction: 'stopDBCluster',
        cluster: this.dataPlaneCluster,
        plane: 'data',
      },
      {
        id: 'StopControl',
        cron: AURORA_STOP_CRON,
        sdkAction: 'stopDBCluster',
        cluster: this.controlPlaneCluster,
        plane: 'control',
      },
      {
        id: 'StartData',
        cron: AURORA_START_CRON,
        sdkAction: 'startDBCluster',
        cluster: this.dataPlaneCluster,
        plane: 'data',
      },
      {
        id: 'StartControl',
        cron: AURORA_START_CRON,
        sdkAction: 'startDBCluster',
        cluster: this.controlPlaneCluster,
        plane: 'control',
      },
    ]

    for (const entry of schedules) {
      /**
       * ⚠️ A UNIVERSAL TARGET, WHICH MEANS THERE IS NO LAMBDA AND NO CODE.
       * `arn:aws:scheduler:::aws-sdk:rds:stopDBCluster` has EventBridge
       * Scheduler make the SDK call itself. The alternative — a Lambda holding
       * twenty lines of JavaScript — would add a runtime to patch, a log group
       * to retain, a package to pin under G191 and a deployment artefact,
       * to do what one ARN does. One target per call is the cost: four
       * schedules rather than two.
       *
       * `flexibleTimeWindow: OFF` and no retries: a stop that fails because the
       * cluster is already stopped is a no-op worth seeing in the scheduler's
       * own failure metric, not a thing to retry into a rate limit.
       */
      const schedule = new scheduler.CfnSchedule(this, entry.id, {
        name: `reconcile-${environment}-${entry.id.toLowerCase()}`,
        description:
          `${entry.sdkAction} on ${entry.cluster.clusterIdentifier} - staging runs ` +
          'working hours only. See infra/lib/data-stack.ts for what this does NOT cover.',
        state: 'ENABLED',
        flexibleTimeWindow: { mode: 'OFF' },
        scheduleExpression: entry.cron,
        scheduleExpressionTimezone: SHUTDOWN_TIMEZONE,
        target: {
          arn: `arn:aws:scheduler:::aws-sdk:rds:${entry.sdkAction}`,
          roleArn: role.roleArn,
          input: JSON.stringify({ DbClusterIdentifier: entry.cluster.clusterIdentifier }),
          retryPolicy: { maximumRetryAttempts: 0 },
        },
      })
      /* The schedule must not be created before the cluster it names — the
       * identifier is a string, so CloudFormation cannot infer the dependency
       * from the template. */
      schedule.node.addDependency(entry.cluster)
    }
  }

  // ------------------------------------------------------------------ output

  private outputs(prefix: string, cluster: rds.DatabaseCluster, plane: Plane): void {
    new CfnOutput(this, `${prefix}ClusterEndpoint`, {
      value: cluster.clusterEndpoint.hostname,
      description: `RECONCILE_${plane === 'data' ? 'DB' : 'CONTROL_DB'}_HOST for the ${plane} plane.`,
    })
    new CfnOutput(this, `${prefix}SecretArn`, {
      value: cluster.secret?.secretArn ?? 'NO SECRET — fromGeneratedSecret was removed',
      description:
        'G263: inject this as an ECS task SECRET. The migrate run-task is the only ' +
        'principal that may also reach the migrator credential.',
    })
    new CfnOutput(this, `${prefix}ClusterIdentifier`, {
      value: cluster.clusterIdentifier,
      description: 'What the overnight stop/start schedules name.',
    })
  }
}

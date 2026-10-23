/**
 * `RunQueue` — THE ELEVENTH STACK. **R-B, 20 Sep 2026, THE OWNER'S RULING.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE RULING, VERBATIM.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     "R-B · A worker claims runs from a REAL QUEUE (SQS), never by scanning.
 *      **The property that decides it:** the admitting handler publishes the
 *      tenant id and the run id; the worker consumes one message and opens
 *      exactly that tenant's scope. **No cross-tenant read exists anywhere in
 *      the design**, so invariant 2 — *"Exactly one cross-tenant read path"* —
 *      is untouched rather than argued about."
 *
 * **Rejected and preserved**, in the owner's own words: *"a sweep driven by
 * the control-plane tenancy roster (no tenant data crosses, but it couples the
 * engine to the console topology); and a `BYPASSRLS` worker role, which is
 * simplest to write and puts a role that can read every tenant into a
 * long-running process — every isolation assertion in `tests/` is relative to
 * no serving process holding that role."* The third rejected option, a
 * transactional outbox, is argued on `server/data-plane/run-queue.ts`: its
 * RELAY is the `BYPASSRLS` scan wearing different clothes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ✅ **IT HAS A CONSUMER SINCE 21 Sep 2026 — R-W, THE OWNER'S RULING — AND THE
 *    WHOLE BLOCK BELOW IS CORRECTED RATHER THAN DELETED (G1541).**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * It is kept because it is the sentence four files carried, because it NAMED
 * ITS OWN SUCCESSOR (*"the grant lands in the commit that deploys a consumer,
 * with the consumer"*), and because the second of the three shapes it lists is
 * the one the owner took:
 *
 *     **"R-W · The run-queue worker runs as a SCHEDULED ECS TASK."**
 *
 * **What is now false in the block below:** *"Nothing is granted
 * `sqs:ReceiveMessage` or `sqs:DeleteMessage`"* and *"nothing in this account
 * runs the worker"*. §4 and §5 of this file grant exactly those two verbs, to a
 * role that exists only to hold them, and schedule
 * `server/data-plane/run-worker-main.ts` against them once a minute.
 *
 * **What is STILL exactly true, and it is the load-bearing half:** the DATA
 * PLANE'S SERVING ROLE still holds `sqs:SendMessage` and
 * `sqs:GetQueueAttributes` and NOTHING ELSE. The consumer did not arrive by
 * widening the producer — it arrived with its own role, for the reason
 * `runWorkerRoleName()` in `lib/config.ts` states at length: **a shape that
 * grants receive to `reconcile-<env>-data-service-task` lets a REQUEST PATH
 * DRAIN THE QUEUE.**
 *
 * ⚠️ **AND R-W's OWN ACCEPTED COST, CARRIED HERE SO NOBODY "FIXES" IT: ONE
 * POLL PERIOD OF LATENCY.** A run admitted one second after a task exits waits
 * for the next tick. Turning that into a long-running service is a `Planes`
 * change wearing a performance argument.
 *
 * 🛑 **AND THE SENTENCE THAT MATTERS MOST TO A READER PRICING THIS: THE QUEUE
 * NOW DRAINS AND A RUN STILL DOES NOT EXECUTE.** The worker claims, reads,
 * reports and calls nothing — `server/data-plane/run-worker.ts`'s header says
 * so in capitals, and R-A's definition content is what it is waiting for.
 * **Do not read a draining queue as a working engine.**
 *
 * THE ORIGINAL BLOCK FOLLOWS, UNCHANGED:
 *
 * `sqs:SendMessage` is granted to the DATA plane's task role, which is the
 * process that admits runs. **Nothing is granted `sqs:ReceiveMessage` or
 * `sqs:DeleteMessage`, because nothing in this account runs the worker.**
 * `server/data-plane/run-worker-main.ts` exists, takes one message and exits;
 * WHERE IT RUNS IS A PERSON'S DECISION and there are three shapes, each a
 * different `infra/` change and a different cost:
 *
 *   · a long-running ECS service on `Planes`' data cluster — cheapest to
 *     reason about, and **it is a `Planes` change**, which G1012 and G1013
 *     measure as rolling both planes back to an image ECR has EXPIRED;
 *   · a scheduled ECS task, which pays a cold start per message and needs its
 *     own task definition and its own role;
 *   · a Lambda on an event-source mapping, which is the idiomatic answer and
 *     introduces the second piece of deployed application code in this app
 *     (G290's key minter is the first) plus a VPC attachment to reach Aurora.
 *
 * **Granting a receive permission to a principal chosen by this file would
 * settle that question by accident**, and it is `0004`'s *"a write privilege
 * ahead of its writer"* arriving in IAM: a permission with no holder is not
 * merely wasteful, it is a decision nobody argued. The grant lands in the
 * commit that deploys a consumer, with the consumer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 IT TOUCHES `Planes` IN NO WAY AT ALL, AND THAT IS A CONSTRAINT RATHER
 *    THAN A STYLE — THE SAME ONE `Observability` RECORDS.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CDK mints a cross-stack export per attribute READ, so taking `Planes` by
 * construct reference would add an export to it — and an export on `Planes` is
 * a `Planes` deploy, which G1012 measures as rolling the running fleet back to
 * an image that has been expired out of ECR, against a forward-only schema.
 * So the join is BY NAME: `iam.Role.fromRoleName(planeRoleName(...))` plus
 * `addToPrincipalPolicy`, which is exactly what `lib/storage-stack.ts` already
 * does for the object bucket, for exactly this reason.
 *
 * ⚠️ **THE PRICE IS A DEPLOY ORDER NOTHING ENFORCES: `Planes` BEFORE
 * `RunQueue`**, or the `AWS::IAM::Policy` fails with `Cannot find the role`.
 * `Planes` is already deployed, so this costs nothing today; it is written
 * down because CloudFormation will not tell you. `tests/infra/run-queue.test.mjs`
 * §5 asserts the synthesised `Planes` template is BYTE-IDENTICAL before and
 * after, which is the only way to know a by-name join stayed a by-name join.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ **THE BLOCK BELOW IS STALE AND IS CORRECTED HERE RATHER THAN DELETED —
 *    G1543. `Observability` TOOK THE ALARM, AND THIS SLICE IS WHAT ARMS IT.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **The false sentence, quoted so a reader who has already copied it can
 * recognise it:** *"NO ALARM, AND THE REASON IS A CONSTRAINT RATHER THAN AN
 * OVERSIGHT … It is ONE construct in `observability-stack.ts` and it is named
 * here rather than taken."* **It was taken.**
 * `reconcile-${environment}-run-queue-dead-letter-not-empty` has existed since
 * G1061/G1283, joined to this stack BY QUEUE NAME exactly as this file's own
 * grants join `Planes` by role name, and `tests/infra/observability.test.mjs`
 * asserts it. Derive it, never read this comment:
 *
 *     grep -n 'run-queue-dead-letter-not-empty' infra/lib/*.ts
 *
 * 🛑 **AND IT COULD NOT FIRE UNTIL THIS COMMIT, WHICH IS THE PART WORTH
 * READING.** A message reaches a dead-letter queue by being RECEIVED
 * `RUN_QUEUE_MAX_RECEIVE_COUNT` times, and nothing held `sqs:ReceiveMessage` —
 * so the depth was STRUCTURALLY ZERO and the alarm sat permanently OK.
 * `RUN_QUEUE_DEAD_LETTER_MESSAGE_THRESHOLD`'s docblock says exactly this about
 * itself: *"an unfired alarm on an empty queue is indistinguishable from a
 * healthy one."* **§4 below is what ends that**, and it is the difference
 * between a control and a decoration.
 *
 * ⚠️ **IT STILL PAGES NOBODY.** R-F keeps the topic UNSUBSCRIBED and R14 —
 * *"who is paged"* — is an OPEN OWNER'S RULING. So the honest statement is:
 * the alarm can now fire, and when it fires it reaches no person.
 *
 * THE ORIGINAL BLOCK FOLLOWS, UNCHANGED:
 *
 * A dead-letter queue with a growing depth and nothing watching it is a
 * control that reports success by being unread, which is this record's own
 * §5.6. **The alarm belongs in `Observability`** — one topic per environment,
 * G261 — and putting it there means reading that stack's `alarmTopic`, which
 * mints an export on a stack this slice has no other reason to deploy. It is
 * ONE construct in `observability-stack.ts` and it is named here rather than
 * taken, so the commit that adds it meets this paragraph. ⚠️ AND R-F is why it
 * would page nobody even then: *"the alarm topic stays UNSUBSCRIBED,
 * deliberately."*
 */

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib'
import type * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as events from 'aws-cdk-lib/aws-events'
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import type { Construct } from 'constructs'

import {
  PLANE_IMAGE_REPOSITORY_NAME,
  PLANE_IMAGE_TAG_CONTEXT_KEY,
  RUN_QUEUE_DEAD_LETTER_RETENTION_DAYS,
  RUN_QUEUE_MAX_RECEIVE_COUNT,
  RUN_QUEUE_RETENTION_DAYS,
  RUN_QUEUE_VISIBILITY_SECONDS,
  RUN_WORKER_POLL_MINUTES,
  RUN_WORKER_STOP_TIMEOUT_SECONDS,
  RUN_WORKER_TASK_CPU,
  RUN_WORKER_TASK_MEMORY_MIB,
  assertDeployablePlaneImageTag,
  ecsClusterName,
  planeRoleName,
  runQueueDeadLetterName,
  runQueueName,
  runWorkerRoleName,
  runWorkerScheduleRuleName,
  runWorkerTaskFamily,
  type Environment,
} from './config.ts'
/**
 * ⚠️ **THREE IDIOMS AND ONE RETENTION TABLE, IMPORTED RATHER THAN COPIED, AND
 * THAT IS §5.3 APPLIED RATHER THAN CITED: *"two implementations of one order …
 * and the one that drifts is always the copy."*** `HARDENED_CONTAINER`,
 * `dropAllCapabilities()` and `mountWritableTmp()` are G262's task-definition
 * half, and a worker container that quietly lacked `readonlyRootFilesystem`
 * would be a hardening regression nobody diffs.
 *
 * 🛑 **IT IS A CODE IMPORT AND NOT A CONSTRUCT REFERENCE, AND THE DIFFERENCE IS
 * THE WHOLE OF WHY IT IS SAFE.** Importing a `const` and two functions from
 * `lib/planes-stack.ts` creates NO CloudFormation dependency, mints NO export
 * on `Planes`, and leaves the synthesised `Planes` template BYTE-IDENTICAL —
 * asserted, not assumed, by `tests/infra/run-queue.test.mjs` §8. Reading
 * `planes.cluster` instead WOULD mint one, and an export on `Planes` is a
 * `Planes` deploy (G1012).
 */
import {
  HARDENED_CONTAINER,
  LOG_RETENTION,
  dropAllCapabilities,
  mountWritableTmp,
  type PasswordSecret,
} from './planes-stack.ts'
import { applyRequiredTags } from './tagging.ts'

/**
 * Where the scheduled worker task runs — R-W, G1544.
 *
 * 🛑 **EVERY FIELD IS A CONSTRUCT REFERENCE AND NONE MINTS A NEW EXPORT, WHICH
 * SOUNDS LIKE A CONTRADICTION AND IS NOT.** CDK mints ONE export per attribute
 * READ, deduplicated: `Planes` ALREADY reads `network.vpc`, the private subnet
 * refs and `network.dataPlaneSg`, so `Network` already publishes exactly these
 * values and this stack's `Fn::ImportValue`s reuse them. **`Network` is
 * therefore BYTE-IDENTICAL before and after** — measured, and pinned by
 * `tests/infra/run-queue.test.mjs` §8, not reasoned about here.
 *
 * ⚠️ **THE SECURITY GROUP IS THE DATA PLANE'S OWN, DELIBERATELY REUSED, AND
 * THAT IS A NETWORK POSITION RATHER THAN A CREDENTIAL.** `Data` admits
 * `dataPlaneSg` to the data cluster and admits nothing else; a NEW group for
 * the worker would need a new ingress rule on the Aurora security group, which
 * lives in `Network`/`Data` — **a change to two of the six stacks this slice
 * must leave untouched.** And it would be the wrong shape anyway: the worker
 * connects as `reconcile_app`, `NOBYPASSRLS`, **the same database role the
 * listener holds** (`server/data-plane/run-worker-main.ts` says so in its own
 * header), so it occupies the same network position by design.
 *
 * 🛑 **THE SEPARATION THAT MATTERS IS THE IAM ONE AND IT IS NOT THIS OBJECT'S.**
 * Sharing a security group shares reachability; sharing a TASK ROLE would share
 * the queue. See §4 and `runWorkerRoleName()`.
 */
export interface RunQueueWorkerNetwork {
  readonly vpc: ec2.IVpc
  readonly taskSubnets: ec2.SubnetSelection
  readonly dataPlaneSecurityGroup: ec2.ISecurityGroup
}

/**
 * What the worker connects to — the DATA plane's database and nothing else.
 *
 * ⚠️ **NO CONTROL-DATABASE FIELD, AND THE ABSENCE IS THE CONTROL.** G1161 gave
 * the data plane a read-only control pool for the consoles; a run worker reads
 * no roster and serves no console, so it gets no `RECONCILE_CONTROL_READ_*` at
 * all. `controlReadTarget()` is TOTAL — it falls back to loopback rather than
 * throwing — so the worker's config object carries a control target it never
 * opens a pool for, and that is exactly the state wanted: **an absent variable
 * here is an absent credential, not a broken process.**
 *
 * ⚠️ **AND NO `migratorSecret` AND NO `adminSecret`.** `run-worker-main.ts`:
 * *"It does not provision and it does not migrate … there is no code path to
 * `CREATE ROLE` no matter which variables somebody sets."* The type is the
 * other half of that sentence — it cannot be handed one.
 */
export interface RunQueueWorkerDatabase {
  readonly host: string
  readonly port: number
  readonly databaseName: string
  /**
   * 🛑 `reconcile_engine` AND NOT `reconcile_app` SINCE 4 Oct 2026 — G3861,
   * discharging G3749. ⚠️ THIS FIELD WAS `appSecret` AND IS RENAMED RATHER
   * THAN WIDENED: the worker holds ONE credential, and a type with both would
   * let a later edit hand it the listener's too. `reconcile_engine` is
   * `reconcile_app`'s privileges PLUS `INSERT` on the two exception tables
   * (`db/migrations/0500` §1) — still `NOBYPASSRLS`, still owning nothing, so
   * R-B's argument against a `BYPASSRLS` worker is untouched.
   */
  readonly engineSecret: PasswordSecret
}

export interface RunQueueStackProps extends StackProps {
  readonly environment: Environment
  readonly network: RunQueueWorkerNetwork
  readonly data: RunQueueWorkerDatabase
}

export class RunQueueStack extends Stack {
  /** The queue an admitted run is published to. */
  readonly queue: sqs.Queue

  /** Where an unreadable message ends up after `RUN_QUEUE_MAX_RECEIVE_COUNT`. */
  readonly deadLetterQueue: sqs.Queue

  constructor(scope: Construct, id: string, props: RunQueueStackProps) {
    super(scope, id, props)

    const { environment } = props

    /**
     * ───────────────────────────────────────────── 1. the dead-letter queue
     *
     * 🛑 IT IS DECLARED FIRST BECAUSE THE REDRIVE POLICY NEEDS IT, AND IT IS
     * DECLARED AT ALL BECAUSE OF WHAT THE WORKER DOES WITH AN UNREADABLE
     * MESSAGE: `server/data-plane/run-worker-main.ts` LEAVES IT ON THE QUEUE
     * rather than deleting it, on the ground that deleting it destroys the
     * only evidence of whatever wrote it. **Without a dead-letter queue that
     * decision turns one bad message into an infinite redelivery loop**, so
     * the two are one design and not two.
     *
     * ⚠️ `RemovalPolicy.RETAIN` — the one place in this stack where a
     * `cdk destroy` must not take the data with it. The messages here are the
     * record of what could not be read.
     */
    this.deadLetterQueue = new sqs.Queue(this, 'RunAdmittedDlq', {
      queueName: runQueueDeadLetterName(environment),
      retentionPeriod: Duration.days(RUN_QUEUE_DEAD_LETTER_RETENTION_DAYS),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    /**
     * ────────────────────────────────────────────────────── 2. the queue
     *
     * 🛑 STANDARD AND NOT FIFO — `runQueueName()` in `lib/config.ts` carries
     * the argument, and its short form is that FIFO's five-minute
     * deduplication window would sit in front of `run_idempotency_key` and
     * mask it for exactly as long as anybody would be testing.
     *
     * 🛑 `enforceSSL` IS A QUEUE POLICY DENYING `aws:SecureTransport = false`,
     * not a client setting — so an unencrypted call is refused by the service
     * rather than by whatever library made it. `tests/db/tls-everywhere.test.ts`
     * takes the same position one layer down for PostgreSQL.
     *
     * ⚠️ `QueueEncryption.SQS_MANAGED` AND NOT A CUSTOMER-MANAGED KEY, WHICH
     * IS A REAL CHOICE AND IS NAMED AS ONE. G287's per-tenant KMS keys exist
     * because an OBJECT carries tenant data; **a message here carries two ids
     * and nothing else** (`server/data-plane/run-queue.ts` §3), so a
     * per-tenant key would encrypt a tenant's own name under a key named after
     * it. A customer-managed key for the queue AS A WHOLE is defensible and
     * costs a key policy every future consumer must be added to; it is the
     * owner's to take if the threat model moves.
     */
    this.queue = new sqs.Queue(this, 'RunAdmitted', {
      queueName: runQueueName(environment),
      retentionPeriod: Duration.days(RUN_QUEUE_RETENTION_DAYS),
      visibilityTimeout: Duration.seconds(RUN_QUEUE_VISIBILITY_SECONDS),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: RUN_QUEUE_MAX_RECEIVE_COUNT,
      },
    })

    /**
     * ─────────────────────────────────── 3. the producer, granted BY NAME
     *
     * 🛑 `sqs:SendMessage` AND `sqs:GetQueueAttributes`, AND NOTHING ELSE.
     * **No `ReceiveMessage`, no `DeleteMessage`, no `PurgeQueue`, no
     * `SetQueueAttributes`.**
     *
     * ⚠️ **THE VERBS ARE UNCHANGED SINCE R-B AND THE REASON IS NOT — G1542.**
     * It read: *"the header says why: nothing in this account runs the worker,
     * and a permission with no holder is a decision nobody argued."*
     * **Something runs the worker now** (§4), so that reason is spent; the
     * refusal is now the stronger one, and it is about THIS role rather than
     * about the account: **a request path that could `ReceiveMessage` could
     * drain the queue**, taking an admitted run off it and deleting it, with
     * every gate and every record downstream saying the act was correct.
     * The consumer arrived with its OWN role precisely so this line did not
     * have to move.
     *
     * ⚠️ AND `sqs:*` WOULD BE THE OBVIOUS SHORTCUT AND IS REFUSED BY NAME. A
     * data plane that could `PurgeQueue` could delete every admitted run's
     * message from a request path; one that could `SetQueueAttributes` could
     * remove the redrive policy and turn the dead-letter queue — the only
     * evidence of an unreadable message — into nothing at all.
     *
     * 🛑 `fromRoleName` AND NOT A CONSTRUCT REFERENCE. See the header: a
     * construct reference mints an export on `Planes` and an export on
     * `Planes` is a `Planes` deploy. `lib/storage-stack.ts` does exactly this,
     * and `planeRoleName()` in `lib/config.ts` argues the by-name join.
     */
    const dataPlaneTaskRole = iam.Role.fromRoleName(
      this,
      'DataPlaneServiceTaskRole',
      planeRoleName(environment, 'data', 'service', 'task'),
      { mutable: true },
    )

    dataPlaneTaskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'PublishAdmittedRuns',
        actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes'],
        resources: [this.queue.queueArn],
      }),
    )

    /**
     * ───────────────────── 4. the consumer's OWN roles — R-W, G1542
     *
     * ═══════════════════════════════════════════════════════════════════════
     * 🛑 THIS IS THE ONLY PLACE IN THE ACCOUNT THAT MAY TAKE A MESSAGE OFF
     *    THIS QUEUE, AND IT IS A ROLE THAT EXISTS FOR NOTHING ELSE.
     * ═══════════════════════════════════════════════════════════════════════
     *
     * **The refused shape is the cheap one and it is refused by name.** An
     * `events.Rule` can run the EXISTING data-plane service task definition
     * with a `containerOverrides` command — four lines, no new task
     * definition, no new roles, and the database host, the credentials and
     * `RECONCILE_RUN_QUEUE_URL` are all already on it. **It is refused
     * because that task definition's role is
     * `reconcile-<env>-data-service-task`, the role the LISTENER runs as: a
     * request path could then `ReceiveMessage` and `DeleteMessage`**, take an
     * admitted run off the queue and drop it, and the run would sit `queued`
     * for ever with the gate, the policy and invariant 10's record each
     * logging the act as perfectly correct.
     *
     * `runWorkerRoleName()` in `lib/config.ts` carries that argument in full;
     * `tests/infra/run-queue.test.mjs` §4b asserts the SERVING role holds
     * neither verb, so the cheap shape is a RED GATE rather than a review.
     *
     * ⚠️ **`sqs:ReceiveMessage` AND `sqs:DeleteMessage`, ON THIS QUEUE, AND
     * NOTHING ELSE — NOT EVEN `sqs:GetQueueAttributes`**, which the PRODUCER
     * holds. The worker never asks this queue anything about itself: it
     * long-polls, acts and exits. **And no verb at all on the DEAD-LETTER
     * queue** — redrive is performed by SQS itself and needs no principal, so
     * a grant there would be a reach with no caller (`0004`'s refusal) into
     * the one place an unreadable message is preserved.
     *
     * ⚠️ **AND NO `sqs:ChangeMessageVisibility`, WHICH IS THE VERB THE NEXT
     * SLICE WILL WANT.** `RUN_WORKER_HOLDS_A_MESSAGE_FOR` in `lib/config.ts`
     * measures why: a heartbeat extending visibility while an executor works
     * is one of three repairs for the 30-second bound, and it is a THIRD
     * consuming verb. It is withheld here so that taking it is a decision
     * somebody writes down.
     */
    const workerTaskRole = new iam.Role(this, 'RunWorkerTaskRole', {
      roleName: runWorkerRoleName(environment, 'task'),
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description:
        'R-W - the run worker`s own AWS identity. It holds sqs:ReceiveMessage and ' +
        'sqs:DeleteMessage on the run queue and NOTHING else. The data plane`s SERVING ' +
        'task role must never hold either: a request path could then drain the queue.',
    })

    workerTaskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ConsumeAdmittedRuns',
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage'],
        resources: [this.queue.queueArn],
      }),
    )

    /**
     * 🛑 A SECOND ROLE, NEVER THE SAME ONE — `planeRoles()` in
     * `lib/planes-stack.ts` states the reason and it is the EXECUTION role
     * that matters: ECS reads the task's SECRETS as this principal, before
     * the container starts, so G253's credential fence is written over
     * execution roles and not only over task roles. Collapsing the two would
     * hand the worker process itself the ability to read its own secret out of
     * Secrets Manager.
     */
    const workerExecutionRole = new iam.Role(this, 'RunWorkerExecutionRole', {
      roleName: runWorkerRoleName(environment, 'exec'),
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description:
        'ECS execution role for the run worker task: pulls the image, writes the log ' +
        'stream, and FETCHES THE APP SECRET on the container`s behalf.',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    })

    /**
     * ⚠️ ITS OWN LOG GROUP, AND THE ALTERNATIVE IS NAMED RATHER THAN IGNORED.
     *
     * `lib/planes-stack.ts` shares one group per PLANE between the serving and
     * the migrate containers, with different stream prefixes, *"so a migrate
     * run-task's non-zero exit is visible in the same place as the plane it
     * migrated"* — and by that argument the worker belongs in
     * `/reconcile/<env>/data-plane`.
     *
     * **It is not put there because the group is another STACK's resource and
     * carries `RemovalPolicy.DESTROY` outside production.** Importing it by
     * name would add a second unenforced deploy order to this file and leave
     * this task definition pointing at a group a `cdk destroy` of `Planes`
     * takes away. A group owned here dies with this stack and with nothing
     * else. **The cost is a second place to look, and the output below names
     * it so nobody has to guess.**
     *
     * ⚠️ G261 says *"one log group per plane per environment"* and this is a
     * THIRD group in a two-plane environment. Stated plainly rather than
     * quietly diverged from: the worker is a data-plane PROCESS and not a
     * data-plane TASK DEFINITION, and it has its own stack and its own
     * lifecycle.
     */
    const workerLogGroup = new logs.LogGroup(this, 'RunWorkerLogs', {
      logGroupName: `/reconcile/${environment}/run-worker`,
      retention: LOG_RETENTION[environment],
      removalPolicy: environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    })

    /**
     * ⚠️ THE SAME IMAGE AS BOTH PLANES, AT THE SAME PINNED TAG, AND **NOT A
     * LOOKUP**: `fromRepositoryName` builds an ARN from the account and region
     * this stack already knows and reaches no API, which is what keeps
     * `cdk synth` offline and eligible for the gate under G108.
     *
     * 🛑 **THE TAG IS BAKED INTO THE TEMPLATE, SO THIS TASK DEFINITION MOVES
     * WHEN `Planes` MOVES AND NOT BEFORE** — `assertDeployablePlaneImageTag()`
     * carries the reasoning and the sentinel the gate uses. **That is the
     * whole of G1285 arriving here: a deployed task definition and a deployed
     * IMAGE are two facts**, and this stack deploying does not rebuild an
     * image. The worker runs whatever `<repository>:<tag>` holds, and at the
     * commit the fleet runs today that image **contains no
     * `server/data-plane/run-queue.ts` at all**, so the very first scheduled
     * task would fail to resolve its own entry point. **That is D-2's problem
     * and is named here so nobody reads a deployed schedule as a working
     * consumer.**
     */
    const repository = ecr.Repository.fromRepositoryName(
      this,
      'PlaneRepository',
      `${PLANE_IMAGE_REPOSITORY_NAME}-${environment}`,
    )
    const imageTag = assertDeployablePlaneImageTag(
      this.node.tryGetContext(PLANE_IMAGE_TAG_CONTEXT_KEY),
    )

    const workerTask = new ecs.FargateTaskDefinition(this, 'RunWorkerTask', {
      family: runWorkerTaskFamily(environment),
      cpu: RUN_WORKER_TASK_CPU,
      memoryLimitMiB: RUN_WORKER_TASK_MEMORY_MIB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      executionRole: workerExecutionRole,
      taskRole: workerTaskRole,
    })

    /**
     * 🛑 **THE COMMAND IS `run-worker-main.ts` AND R-W NEEDED NO `server/`
     * CHANGE TO MAKE THAT TRUE.** That file has been one-message-and-exit
     * since the day it was written, and its header says why a loop was
     * refused: *"A loop is a PROCESS SHAPE, and a process shape is a
     * deployment decision … Writing the loop here would settle that question
     * in a file nobody would think to look in."* **This is the file it was
     * waiting for.**
     *
     * ⚠️ **WHAT THIS CONTAINER DOES NOT GET, AND EACH ABSENCE IS A CONTROL:**
     *
     *   · **NO `RECONCILE_LOCAL_TEST_AUTH`** — G192's fence is structural and
     *     its ABSENCE from a real task definition is what `compose.yaml` calls
     *     *"a thing an auditor can read"*. The worker serves no request and
     *     resolves no session, so it is doubly irrelevant and doubly absent;
     *   · **NO `RECONCILE_HTTP_*`** — it binds no port and answers nothing;
     *   · **NO `RECONCILE_CONTROL_READ_*`** — it opens no control-database
     *     pool. `controlReadTarget()` is TOTAL and falls back to loopback, so
     *     the worker's config object names a target it never connects to;
     *   · **NO `RECONCILE_DB_ADMIN`, NO `PGPASSWORD`, NO
     *     `RECONCILE_MIGRATOR_PASSWORD`** — *"It does not provision and it
     *     does not migrate … there is no code path to `CREATE ROLE` no matter
     *     which variables somebody sets."* The TYPE refuses to carry them;
     *   · **NO `RECONCILE_RUN_QUEUE_ENDPOINT`** — that override is for the
     *     LOCAL stack alone; against AWS the queue URL IS the endpoint, and
     *     setting it here would point the SDK somewhere else entirely.
     *
     * 🛑 **AND THE QUEUE URL IS A CONSTRUCT REFERENCE HERE, WHERE IT IS A
     * SPELLED CONSTANT IN `Planes` — THE DIFFERENCE IS THE STACK BOUNDARY AND
     * NOT A PREFERENCE.** `runQueueUrl()` exists because `Planes` reading
     * `queue.queueUrl` would mint an export on `RunQueue` and complete a
     * deploy-order deadlock. **This container is IN `RunQueue`**, so
     * `this.queue.queueUrl` is a `Ref` inside one template: no export, no
     * second order, and `tsc` checks the join.
     */
    const workerContainer = workerTask.addContainer('run-worker', {
      image: ecs.ContainerImage.fromEcrRepository(repository, imageTag),
      command: ['node', 'server/data-plane/run-worker-main.ts'],
      /* G4367 — a stop ECS decides on gets a bounded grace; the run's own
       * duration bound is the worker's (`RUN_MAX_EXECUTION_SECONDS`). */
      stopTimeout: Duration.seconds(RUN_WORKER_STOP_TIMEOUT_SECONDS),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'run-worker', logGroup: workerLogGroup }),
      environment: {
        RECONCILE_DB_HOST: props.data.host,
        RECONCILE_DB_PORT: String(props.data.port),
        RECONCILE_DB_NAME: props.data.databaseName,
        RECONCILE_RUN_QUEUE_URL: this.queue.queueUrl,
      },
      secrets: {
        /* G263 - an ECS task SECRET, never a plain `environment` entry.
         *
         * ⚠️ THIS WAS `RECONCILE_APP_PASSWORD` UNTIL 4 Oct 2026 AND THE
         * COMMENT READ: *"The role it authenticates as is `reconcile_app`:
         * NOBYPASSRLS, owning nothing, THE SAME CREDENTIAL THE LISTENER
         * HOLDS."* Corrected rather than deleted — G3861, discharging G3749.
         * `run-worker-main.ts` connects as `reconcile_engine` when given
         * `RECONCILE_ENGINE_PASSWORD` and otherwise ACCOUNTS runs and
         * persists NO exceptions. The role is still NOBYPASSRLS and owns
         * nothing (`db/migrations/0500` §1); what it adds is `INSERT` on the
         * two exception tables, which is why the LISTENER must never hold it
         * and why this worker no longer holds the listener's. */
        RECONCILE_ENGINE_PASSWORD: ecs.Secret.fromSecretsManager(
          props.data.engineSecret.secret,
          props.data.engineSecret.passwordField,
        ),
      },
      ...HARDENED_CONTAINER,
      linuxParameters: dropAllCapabilities(this, 'RunWorkerLinux'),
    })
    mountWritableTmp(workerTask, workerContainer)

    /**
     * ─────────────────────────── 5. the schedule — R-W's process shape
     *
     * 🛑 **A SCHEDULED TASK, AND THE TWO OTHER SHAPES ARE REFUSED BY THE
     * OWNER RATHER THAN BY THIS FILE.** A long-running ECS service on
     * `Planes`' data cluster is a `Planes` CHANGE (G1012's expired-image
     * hazard); a Lambda on an event-source mapping introduces a second piece
     * of deployed application code plus a VPC attachment to reach Aurora.
     * **R-W takes the middle one and accepts its cost: ONE POLL PERIOD OF
     * LATENCY.**
     *
     * ⚠️ **ONE TASK PER TICK MEANS AT MOST ONE MESSAGE PER TICK, AND THAT IS
     * A THROUGHPUT CEILING RATHER THAN A DETAIL.** `run-worker-main.ts`
     * receives AT MOST ONE message and exits, so a burst of ten admitted runs
     * drains over ten minutes at `RUN_WORKER_POLL_MINUTES = 1`. Raising
     * `taskCount` would run N tasks against the SAME tick and is a real
     * option; it is not taken here because nothing has ever executed a run and
     * a concurrency number chosen before the first measurement is the sizing
     * guess `RUN_WORKER_TASK_CPU` refuses to pretend is a measurement.
     *
     * 🛑 **THE CLUSTER IS JOINED BY NAME AND THAT IS THE CONSTRAINT THIS WHOLE
     * FILE IS BUILT AROUND.** `Planes` exports its cluster NAME
     * (`PLANES_EXPORT_KEYS`) and not its ARN, and reading `planes.cluster` by
     * construct reference would mint a NEW export on `Planes` — which is a
     * `Planes` deploy. `fromClusterAttributes()` spells the ARN from the
     * account, the region and the name, exactly as `runQueueUrl()` spells a
     * queue URL and `iam.Role.fromRoleName()` spells a role.
     *
     * ⚠️ **IT PAYS THE SAME UNENFORCED ORDER THE `GRANT` ABOVE ALREADY PAYS:
     * `Planes` BEFORE `RunQueue`.** A cluster that does not exist yields
     * `ClusterNotFoundException` at the first tick rather than at deploy time,
     * which is worse than the `Cannot find the role` this file already
     * documents — **so it is written down here and in
     * `docs/build/completion-plan.md` §8, because CloudFormation will not tell
     * you.**
     *
     * ⚠️ **AND THE SUBNETS AND THE SECURITY GROUP ARE THE DATA PLANE'S OWN**,
     * reused rather than minted: `Data` admits `dataPlaneSg` to the data
     * cluster and admits nothing else, so a new group would need an ingress
     * rule in another stack. `RunQueueWorkerNetwork` carries that argument.
     */
    const cluster = ecs.Cluster.fromClusterAttributes(this, 'PlanesCluster', {
      clusterName: ecsClusterName(environment),
      vpc: props.network.vpc,
      securityGroups: [],
    })

    /**
     * ⚠️ DECLARED EXPLICITLY RATHER THAN LET CDK MINT ONE, for `planeRoles()`'s
     * stated reason one stack over: *"they are declared explicitly here so
     * that each has a NAME the credential-fence test can find in the template,
     * and so that nobody can pass the same role twice without the diff saying
     * so."* EventBridge assumes this to call `ecs:RunTask`; CDK adds that
     * action and the two `iam:PassRole`s it needs.
     *
     * 🛑 IT IS NOT THE TASK ROLE AND IT IS NOT THE EXECUTION ROLE. A principal
     * that may START the worker is a third thing, and folding it into either
     * would give the running container the ability to launch more of itself.
     */
    const scheduleRole = new iam.Role(this, 'RunWorkerScheduleRole', {
      roleName: `reconcile-${environment}-run-worker-schedule`,
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      description:
        'What EventBridge assumes to run the run-worker task. ecs:RunTask plus iam:PassRole ' +
        'on the worker`s own two roles, and nothing else. It holds NO sqs verb.',
    })

    new events.Rule(this, 'RunWorkerSchedule', {
      ruleName: runWorkerScheduleRuleName(environment),
      description:
        `R-W - run server/data-plane/run-worker-main.ts every ${RUN_WORKER_POLL_MINUTES} ` +
        'minute(s). It takes AT MOST ONE message and exits. It claims, reads and reports; ' +
        'it executes NOTHING until R-A gives a definition its content.',
      schedule: events.Schedule.rate(Duration.minutes(RUN_WORKER_POLL_MINUTES)),
      targets: [
        new eventsTargets.EcsTask({
          cluster,
          /**
           * ⚠️ THE ONE TYPE ASSERTION IN THIS FILE, AND IT IS THE
           * `exactOptionalPropertyTypes` SEAM `lib/planes-stack.ts` ALREADY
           * DOCUMENTS FOR `ICluster` — a `aws-cdk-lib` typing artefact rather
           * than a claim about anything. `EcsTask` asks for `ITaskDefinition`,
           * whose `executionRole` is `IRole`; `FargateTaskDefinition` declares
           * the same member `IRole | undefined`. Under that flag those are
           * different types, even though THIS task definition is constructed
           * with an execution role thirty lines above. Narrowed here, at one
           * site, rather than by weakening the flag for the whole project.
           */
          taskDefinition: workerTask as ecs.ITaskDefinition,
          taskCount: 1,
          subnetSelection: props.network.taskSubnets,
          securityGroups: [props.network.dataPlaneSecurityGroup],
          assignPublicIp: false,
          platformVersion: ecs.FargatePlatformVersion.LATEST,
          role: scheduleRole,
        }),
      ],
    })

    /**
     * ────────────────────────────────────────────────────── 6. the outputs
     *
     * ⚠️ THE URL IS AN OUTPUT BECAUSE A HUMAN HAS TO PUT IT INTO `Planes`'
     * TASK DEFINITION AS `RECONCILE_RUN_QUEUE_URL`, AND **THIS SLICE DOES NOT
     * DO THAT** — it is a `Planes` change for the reason the header gives. So
     * the deployed data plane publishes NOWHERE until somebody makes it, and
     * `server/data-plane/run-queue.ts`'s `unconfiguredRunQueue()` is LOUD on
     * every admitted run precisely so that state announces itself.
     */
    new CfnOutput(this, 'RunQueueUrl', {
      value: this.queue.queueUrl,
      description:
        'RECONCILE_RUN_QUEUE_URL for the data plane. NOT wired into Planes by this stack: ' +
        'that is a Planes deploy (G1012), and it is a person`s to make.',
    })

    /**
     * ⚠️ **THIS OUTPUT WAS `RunQueueHasNoConsumerUntil` AND ITS VALUE READ
     * *"nothing is granted sqs:ReceiveMessage — no worker runs in this
     * account"*. R-W ENDED IT, so the output is REPLACED rather than
     * deleted** — an output is read by people running `describe-stacks`, and
     * one that has silently vanished is indistinguishable from one they
     * failed to find.
     *
     * 🛑 **WHAT IT SAYS NOW IS THE SENTENCE A READER MOST NEEDS AND IS LEAST
     * LIKELY TO INFER: THE QUEUE DRAINS AND A RUN DOES NOT EXECUTE.**
     */
    new CfnOutput(this, 'RunQueueConsumerDrainsButDoesNotExecute', {
      value: `scheduled ECS task every ${RUN_WORKER_POLL_MINUTES}min — it claims, reads and reports`,
      description:
        'R-W. The worker takes ONE message per tick and exits. It calls runSetReconciliation() ' +
        'NOWHERE and writes no result row: R-A gives a definition its content and that is a ' +
        'different slice. Do not read a draining queue as a working engine.',
    })

    new CfnOutput(this, 'RunWorkerLogGroup', {
      value: workerLogGroup.logGroupName,
      description:
        'Where the worker says what it did. It is NOT the data plane`s group - a third group ' +
        'in a two-plane environment, owned by this stack; the reason is on the construct.',
    })

    new CfnOutput(this, 'RunWorkerNeedsARebuiltImage', {
      value: `runs ${PLANE_IMAGE_REPOSITORY_NAME}-${environment}:<planeImageTag> — a deployed task definition and a deployed IMAGE are two facts`,
      description:
        'G1285/D-2. This task definition names the same pinned tag the planes run. If that ' +
        'image predates server/data-plane/run-queue.ts, every tick fails to resolve its own ' +
        'entry point. Deploying this stack rebuilds nothing.',
    })

    new CfnOutput(this, 'RunQueueDeadLetterUrl', {
      value: this.deadLetterQueue.queueUrl,
      description:
        'Unreadable messages land here after ' +
        `${RUN_QUEUE_MAX_RECEIVE_COUNT} deliveries. AN ALARM DOES WATCH IT - ` +
        'reconcile-<env>-run-queue-dead-letter-not-empty, in Observability since G1061/G1283 - ' +
        'and before R-W it COULD NOT FIRE, because reaching a dead-letter queue requires being ' +
        'RECEIVED and nothing held that verb. This slice arms it. It still pages NOBODY: the ' +
        'topic has zero subscriptions (R-F), and who is paged is open ruling R14.',
    })

    applyRequiredTags(this, environment, 'data')
  }
}

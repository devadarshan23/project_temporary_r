/**
 * `RunQueue` — THE ELEVENTH STACK, READ OUT OF THE SYNTHESISED TEMPLATE.
 * **R-B, 20 Sep 2026, the owner's ruling.**
 *
 * ⚠️ NO CONSTANT BELOW IS IMPORTED FROM `infra/`. Every expected value is typed
 * into this file, for the reason `tests/infra/data.test.mjs` and
 * `tests/infra/tag-aspect.test.mjs` both carry: comparing a stack to the
 * constant the stack read proves only that a variable equals itself.
 *
 * ┌─ WHAT IS ASSERTED, AND WHICH CONTROL EACH ONE IS ──────────────────────────┐
 * │ 1  Two queues, and the main one REDRIVES to the other. Without the         │
 * │    dead-letter queue, the worker's decision to LEAVE an unreadable message │
 * │    on the queue turns one bad body into an infinite redelivery loop.       │
 * │ 2  Neither queue is FIFO — no `.fifo` suffix, no `FifoQueue: true`. FIFO's │
 * │    five-minute deduplication window would sit in front of                  │
 * │    `run_idempotency_key` and mask it.                                       │
 * │ 3  Both queues refuse plaintext transport and both are encrypted at rest.  │
 * │ 4  🛑 THE DATA PLANE MAY **SEND** AND MAY NOT **RECEIVE**, AND EXACTLY    │
 * │    ONE PRINCIPAL MAY — a role that exists for nothing else. ⚠️ ROW 4 READ  │
 * │    *"AND NOTHING AT ALL MAY RECEIVE"* UNTIL 21 Sep 2026; R-W gave that     │
 * │    permission a holder, so the property is narrower and STRONGER rather    │
 * │    than relaxed. A shape that grants receive to the SERVING role lets a    │
 * │    REQUEST PATH drain the queue, and three assertions refuse it from       │
 * │    three sides.                                                             │
 * │ 4f The worker runs as a SCHEDULED ECS TASK in private subnets — R-W's      │
 * │    process shape, one poll period of latency accepted.                      │
 * │ 4g It DRAINS and it does not EXECUTE: the command is the one-message-and-  │
 * │    exit worker, it holds the app credential and nothing wider, and every   │
 * │    variable a serving plane needs is ABSENT.                                │
 * │ 5  🛑 THE JOIN TO `Planes` IS BY NAME, PROVEN BY **SIX** TEMPLATES —       │
 * │    `Planes`, `Network`, `Edge`, `Storage`, `Observability` and `Data` —    │
 * │    MINTING NO EXPORT FOR THIS STACK. ⚠️ THREE UNTIL 21 Sep 2026: the       │
 * │    worker reads `Network` and `Data`, so both became stacks this slice     │
 * │    could have moved. All six hashed BYTE-IDENTICAL before and after.       │
 * │ 6  The stack SAYS, as outputs, that the queue DRAINS and a run does not    │
 * │    EXECUTE, that a task definition and an IMAGE are two facts, and that    │
 * │    the dead-letter alarm is armed and still pages nobody. ⚠️ ROW 6 READ    │
 * │    *"that nothing consumes the queue"* until R-W.                           │
 * │ 7  G260's required tags reach both queues.                                  │
 * │ 8  🛑 THE VISIBILITY TIMEOUT IS 1800 SECONDS (30 MINUTES) — G1834, THE     │
 * │    OWNER'S RULING, 22 Sep 2026 — and nothing in `infra/` sets a shorter    │
 * │    ceiling that would make the queue's own bound moot.                     │
 * │ 9  The dead-letter arrival time — `maxReceiveCount × visibilityTimeout` —  │
 * │    is 9000 seconds (2.5 hours), asserted rather than left to be derived.   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ NEITHER 8 NOR 9 EXISTED BEFORE 22 Sep 2026 — THIS FILE HAD NO ASSERTION
 * AT ALL ON `VisibilityTimeout` OR ON THE PRODUCT OF IT AND
 * `RedrivePolicy.maxReceiveCount`, SO THE VALUE COULD HAVE DRIFTED WITH
 * NOTHING IN `npm run check` TO NOTICE. `docs/build/completion-plan.md` K4
 * names this shape one checker over: a control whose only observable
 * behaviour is a number nobody reads back is a control nobody has.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const STACK = 'reconcile-run-queue-staging'
const QUEUE = 'AWS::SQS::Queue'
const QUEUE_POLICY = 'AWS::SQS::QueuePolicy'
const POLICY = 'AWS::IAM::Policy'

const ROLE = 'AWS::IAM::Role'
const RULE = 'AWS::Events::Rule'
const TASK_DEFINITION = 'AWS::ECS::TaskDefinition'

const QUEUE_NAME = 'reconcile-staging-run-admitted'
const DLQ_NAME = 'reconcile-staging-run-admitted-dlq'

/** `Planes` owns it; this stack names it. `lib/config.ts#planeRoleName`. */
const SERVING_TASK_ROLE = 'reconcile-staging-data-service-task'

/**
 * R-W's three roles, typed in rather than imported — this file's own opening
 * rule: *"comparing a stack to the constant the stack read proves only that a
 * variable equals itself."*
 */
const WORKER_TASK_ROLE = 'reconcile-staging-run-worker-task'
const WORKER_EXEC_ROLE = 'reconcile-staging-run-worker-exec'
const WORKER_SCHEDULE_ROLE = 'reconcile-staging-run-worker-schedule'

const templates = synthesisedTemplates()

const stack = () => {
  const template = templates[STACK]
  assert.ok(template, `${STACK} is not in the synthesised app at all`)
  return template
}

/** `resourcesOfType()` yields `[logicalId, resource]` pairs. */
const queuePairs = () => resourcesOfType(stack(), QUEUE)
const queues = () => queuePairs().map(([, resource]) => resource)

const pairByName = (name) => {
  const found = queuePairs().filter(([, r]) => r.Properties?.QueueName === name)
  assert.equal(found.length, 1, `expected exactly one queue named ${name}, found ${found.length}`)
  return found[0]
}
const byName = (name) => pairByName(name)[1]

/**
 * G3861 — which `Data` secret an ECS `ValueFrom` resolves to, by following the
 * `Fn::ImportValue` into `Data`'s own Outputs and reading the secret's own
 * `Name`. Throws rather than answering `undefined`, so an import this
 * cannot follow is a red rather than a silent non-match (§5.6).
 */
function secretNameBehind(valueFrom) {
  const data = templates['reconcile-data-staging']
  assert.ok(data, 'reconcile-data-staging is not in the synthesised app')
  const imported = JSON.stringify(valueFrom).match(/"Fn::ImportValue":"([^"]+)"/)
  assert.ok(imported, `ValueFrom is not a cross-stack import: ${JSON.stringify(valueFrom)}`)
  const output = Object.values(data.Outputs ?? {}).find((o) => o.Export?.Name === imported[1])
  assert.ok(output, `no Data output exports ${imported[1]}`)
  const ref = output.Value?.Ref
  assert.ok(ref, `Data export ${imported[1]} is not a Ref: ${JSON.stringify(output.Value)}`)
  const resource = data.Resources?.[ref]
  assert.ok(resource, `Data export ${imported[1]} names no resource ${ref}`)
  /* The cluster MASTER secrets arrive through a `SecretTargetAttachment`,
   * which carries no `Name`; it is answered by its type and logical id, which
   * can never equal a role secret's name. */
  if (resource.Type !== 'AWS::SecretsManager::Secret') return `${resource.Type}:${ref}`
  const name = resource.Properties?.Name
  assert.ok(typeof name === 'string', `Data secret ${ref} carries no Name`)
  return name
}

// ------------------------------------------------------------- 1. two queues

test('test_the_stack_declares_exactly_two_queues_and_the_main_one_redrives_to_the_other', () => {
  assert.equal(queues().length, 2, 'the run queue and its dead-letter queue, and nothing else')

  const main = byName(QUEUE_NAME)
  const dlq = byName(DLQ_NAME)

  const redrive = main.Properties?.RedrivePolicy
  assert.ok(
    redrive,
    'the run queue has NO redrive policy. `server/data-plane/run-worker-main.ts` deliberately ' +
      'LEAVES an unreadable message on the queue rather than deleting it — deleting destroys ' +
      'the only evidence of whatever wrote it — so without a redrive policy one bad body is ' +
      'an infinite redelivery loop. The two are one design, not two.',
  )
  assert.equal(redrive.maxReceiveCount, 5)
  assert.deepEqual(
    redrive.deadLetterTargetArn,
    { 'Fn::GetAtt': [pairByName(DLQ_NAME)[0], 'Arn'] },
    'the redrive policy does not point at this stack`s own dead-letter queue',
  )

  assert.equal(
    dlq.Properties?.RedrivePolicy,
    undefined,
    'the dead-letter queue itself redrives somewhere. It is the end of the line.',
  )
  assert.equal(
    pairByName(DLQ_NAME)[1].DeletionPolicy,
    'Retain',
    'the dead-letter queue is not RETAINed. The messages in it are the record of what could ' +
      'not be read, and a `cdk destroy` must not take that with it.',
  )
})

// ------------------------------------------------------------- 2. not FIFO

test('test_neither_queue_is_fifo_because_a_five_minute_window_would_mask_the_unique_index', () => {
  for (const queue of queues()) {
    assert.equal(
      queue.Properties?.FifoQueue,
      undefined,
      'a FIFO queue was declared. `infra/lib/config.ts#runQueueName` argues the refusal: ' +
        'FIFO`s deduplication window is FIVE MINUTES and would sit in front of this ' +
        'product`s real idempotency guarantee — `run_idempotency_key`, a UNIQUE INDEX with ' +
        'no window at all — masking it for exactly as long as anybody would be testing. A ' +
        'control that works for five minutes and then silently stops is worse than none.',
    )
    assert.equal(
      String(queue.Properties?.QueueName ?? '').endsWith('.fifo'),
      false,
      'a queue name carries the `.fifo` suffix',
    )
  }
})

// --------------------------------------------------------- 3. transport, rest

test('test_both_queues_refuse_plaintext_transport_and_are_encrypted_at_rest', () => {
  for (const queue of queues()) {
    assert.equal(
      queue.Properties?.SqsManagedSseEnabled,
      true,
      `${queue.Properties?.QueueName} is not encrypted at rest`,
    )
  }

  const policies = resourcesOfType(stack(), QUEUE_POLICY).map(([, r]) => r)
  assert.equal(
    policies.length,
    2,
    '`enforceSSL` synthesises one queue policy per queue; expected two, found ' +
      `${policies.length}. It is a QUEUE POLICY denying \`aws:SecureTransport = false\`, so ` +
      'an unencrypted call is refused by the SERVICE rather than by whatever library made it.',
  )
  for (const policy of policies) {
    const statements = policy.Properties?.PolicyDocument?.Statement ?? []
    const denial = statements.find((s) => s.Effect === 'Deny')
    assert.ok(denial, 'a queue policy carries no Deny at all')
    assert.equal(denial.Condition?.Bool?.['aws:SecureTransport'], 'false')
  }
})

// ------------------- 4. a producer, and — since R-W — ONE consumer with
//                        its own role

/**
 * ⚠️ **THIS SECTION WAS ONE TEST NAMED
 * `test_the_data_plane_may_send_and_nothing_at_all_may_receive`, AND R-W MADE
 * IT FAIL ON PURPOSE. IT IS SPLIT RATHER THAN RELAXED, AND ITS CAPTURED RED IS
 * QUOTED HERE** so nobody reads the split as a control being weakened:
 *
 *     ✖ test_the_data_plane_may_send_and_nothing_at_all_may_receive
 *       AssertionError: expected exactly one IAM policy in this stack, found 4
 *
 * **The property it held was *nothing may receive*, which was G1204's — a
 * permission with no holder is `0004`'s "a write privilege ahead of its
 * writer" arriving in IAM.** R-W gives that permission a holder, so the
 * property that replaces it is narrower and stronger: **exactly one principal
 * may receive, it is a role that exists for nothing else, and the SERVING role
 * is not it.**
 */

/** Every ALLOW statement in this stack, with the policy that carries it. */
const allowStatements = () =>
  resourcesOfType(stack(), POLICY).flatMap(([id, resource]) =>
    (resource.Properties?.PolicyDocument?.Statement ?? [])
      .filter((s) => s.Effect === 'Allow')
      .map((s) => ({
        policyId: id,
        roles: resource.Properties?.Roles ?? [],
        actions: Array.isArray(s.Action) ? s.Action : [s.Action],
        resources: Array.isArray(s.Resource) ? s.Resource : [s.Resource],
        sid: s.Sid,
      })),
  )

/** The logical id of the role resource carrying a given `RoleName`. */
const roleIdNamed = (name) => {
  const found = resourcesOfType(stack(), ROLE).filter(
    ([, r]) => r.Properties?.RoleName === name,
  )
  assert.equal(found.length, 1, `expected exactly one role named ${name}, found ${found.length}`)
  return found[0][0]
}

test('test_the_data_plane_may_send_and_may_not_receive', () => {
  const producer = allowStatements().filter((s) =>
    s.roles.some((r) => r === SERVING_TASK_ROLE),
  )
  assert.equal(
    producer.length,
    1,
    'expected exactly one ALLOW statement attached to the data plane`s SERVING task role, ' +
      `found ${producer.length}. That role is the LISTENER: every verb it gains is a verb a ` +
      'request path gains.',
  )

  assert.deepEqual(
    producer[0].roles,
    [SERVING_TASK_ROLE],
    'the grant is not attached to the data plane`s SERVING task role by NAME. A construct ' +
      'reference would mint an export on `Planes`, and an export on `Planes` is a `Planes` ' +
      'DEPLOY — G1012 measures that as rolling both planes back to an image ECR has expired.',
  )

  assert.deepEqual(
    [...producer[0].actions].sort(),
    ['sqs:GetQueueAttributes', 'sqs:SendMessage'],
    'the producer grant is not exactly SendMessage plus GetQueueAttributes. **No ' +
      '`ReceiveMessage`, no `DeleteMessage`, no `PurgeQueue`, no `SetQueueAttributes`** — a ' +
      'data plane that could `PurgeQueue` could delete every admitted run`s message from a ' +
      'request path; one that could `SetQueueAttributes` could remove the redrive policy and ' +
      `turn the dead-letter queue into nothing at all. Found: ${JSON.stringify(producer[0].actions)}`,
  )
})

/**
 * 🛑 **THE ASSERTION THIS SLICE EXISTS FOR, AND IT WAS WITNESSED RED BEFORE IT
 * WAS WRITTEN GREEN.**
 *
 * The cheap shape — schedule the EXISTING data-plane service task definition
 * with a `containerOverrides` command — needs no new task definition and no
 * new roles, because that task definition already carries the database host,
 * the credentials and `RECONCILE_RUN_QUEUE_URL`. **It is refused because that
 * task definition's role is the LISTENER's**, so `sqs:ReceiveMessage` on it
 * lets a REQUEST PATH drain the queue: take an admitted run off, delete it,
 * and leave the run `queued` for ever with the gate, the policy and invariant
 * 10's record each logging the act as perfectly correct.
 *
 * **Measured, not reasoned.** Against a draft that attached
 * `ConsumeAdmittedRuns` to `planeRoleName(environment, 'data', 'service',
 * 'task')` — the whole of the cheap shape — this went RED:
 *
 *     ✖ test_the_serving_role_holds_neither_consuming_verb
 *       AssertionError: the data plane's SERVING task role is granted
 *       ["sqs:ReceiveMessage","sqs:DeleteMessage"] …
 *
 * **THREE assertions went red together, not one**, which is the shape wanted:
 * `test_the_data_plane_may_send_and_may_not_receive` counted TWO statements on
 * the serving role where it allows one, and
 * `test_exactly_one_role_may_consume_and_it_holds_two_verbs_on_one_queue` found
 * the consuming grant attached to `reconcile-staging-data-service-task` rather
 * than to `reconcile-staging-run-worker-task`. Each reaches the same defect
 * from a different side, so deleting any one of them leaves the fence standing.
 */
test('test_the_serving_role_holds_neither_consuming_verb', () => {
  const CONSUMING = ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:PurgeQueue', 'sqs:*']

  const offending = allowStatements()
    .filter((s) => s.roles.some((r) => r === SERVING_TASK_ROLE))
    .flatMap((s) => s.actions.filter((a) => CONSUMING.includes(a)))

  assert.deepEqual(
    offending,
    [],
    `the data plane's SERVING task role is granted ${JSON.stringify(offending)}. That role ` +
      'runs the LISTENER, so this is a REQUEST PATH that can drain the run queue: it can take ' +
      'an admitted run off the queue and delete it, and the run then sits `queued` for ever ' +
      'while every gate and every invariant 10 record says the act was correct. The worker ' +
      'has its OWN role — `runWorkerRoleName()` in lib/config.ts argues it at length.',
  )
})

test('test_exactly_one_role_may_consume_and_it_holds_two_verbs_on_one_queue', () => {
  const workerRoleId = roleIdNamed(WORKER_TASK_ROLE)
  const mainQueueId = pairByName(QUEUE_NAME)[0]
  const dlqId = pairByName(DLQ_NAME)[0]

  const consuming = allowStatements().filter((s) =>
    s.actions.some((a) => a === 'sqs:ReceiveMessage' || a === 'sqs:DeleteMessage'),
  )

  assert.equal(
    consuming.length,
    1,
    `expected exactly ONE statement in this stack to allow a consuming verb, found ` +
      `${consuming.length}: ${JSON.stringify(consuming.map((s) => s.policyId))}. A second ` +
      'holder is a second process nobody argued for.',
  )

  const [consume] = consuming
  assert.deepEqual(
    consume.roles,
    [{ Ref: workerRoleId }],
    `the consuming grant is attached to ${JSON.stringify(consume.roles)} rather than to ` +
      `${WORKER_TASK_ROLE}. R-W gives the worker its OWN role precisely so that no principal ` +
      'that serves a request can reach this queue.',
  )

  assert.deepEqual(
    [...consume.actions].sort(),
    ['sqs:DeleteMessage', 'sqs:ReceiveMessage'],
    'the worker`s grant is not exactly ReceiveMessage plus DeleteMessage. **Not even ' +
      '`sqs:GetQueueAttributes`**, which the PRODUCER holds: the worker long-polls, acts and ' +
      'exits and never asks this queue about itself. And **no ' +
      '`sqs:ChangeMessageVisibility`** — that is the verb a heartbeat would need against the ' +
      'RUN_WORKER_HOLDS_A_MESSAGE_FOR visibility bound (never spelled as a number here, ' +
      'because it moved once already — G1834 — and a hardcoded value in this message would ' +
      `rot the same way), and withholding it makes taking it a written decision. Found: ` +
      `${JSON.stringify(consume.actions)}`,
  )

  assert.deepEqual(
    consume.resources,
    [{ 'Fn::GetAtt': [mainQueueId, 'Arn'] }],
    'the consuming grant does not name exactly this stack`s run queue. A wildcard resource ' +
      'would reach every queue in the account.',
  )

  /* ⚠️ AND NOTHING AT ALL ON THE DEAD-LETTER QUEUE. Redrive is performed by
   * SQS itself and needs no principal, so a grant there would be a reach with
   * no caller — `0004`'s refusal — into the ONE place an unreadable message is
   * preserved. A principal that could receive-and-delete there could destroy
   * the only evidence of whatever wrote it. */
  const dlqGrants = allowStatements().filter((s) =>
    s.resources.some((r) => JSON.stringify(r).includes(dlqId)),
  )
  assert.deepEqual(
    dlqGrants.map((s) => s.actions),
    [],
    'something is granted a verb on the DEAD-LETTER queue. Redrive needs no principal; the ' +
      'messages there are the record of what could not be read, and a reader that can delete ' +
      'them destroys it.',
  )
})

test('test_the_worker_execution_role_is_not_the_worker_task_role', () => {
  const taskRoleId = roleIdNamed(WORKER_TASK_ROLE)
  const execRoleId = roleIdNamed(WORKER_EXEC_ROLE)
  assert.notEqual(
    taskRoleId,
    execRoleId,
    'the worker`s execution role and its task role are the same resource. `planeRoles()` in ' +
      'lib/planes-stack.ts states why they never may be, and it is the EXECUTION role that ' +
      'matters: ECS reads the task`s SECRETS as that principal before the container starts, ' +
      'so collapsing the two hands the worker process the ability to read its own credential ' +
      'out of Secrets Manager.',
  )

  /* The EventBridge invocation role is a THIRD thing: a principal that may
   * START the worker is not the worker. Folding it in would let the running
   * container launch more of itself. */
  const scheduleRoleId = roleIdNamed(WORKER_SCHEDULE_ROLE)
  const scheduleActions = allowStatements()
    .filter((s) => s.roles.some((r) => r?.Ref === scheduleRoleId))
    .flatMap((s) => s.actions)
  assert.equal(
    scheduleActions.some((a) => String(a).startsWith('sqs:')),
    false,
    `the EventBridge invocation role holds an sqs verb: ${JSON.stringify(scheduleActions)}. ` +
      'It starts a task and reads no queue.',
  )
})

// ------------------------------- 4f. the schedule is the shape R-W named

test('test_the_worker_runs_as_a_scheduled_task_in_private_subnets', () => {
  const rules = resourcesOfType(stack(), RULE)
  assert.equal(rules.length, 1, `expected exactly one EventBridge rule, found ${rules.length}`)

  const rule = rules[0][1].Properties
  assert.equal(
    rule.ScheduleExpression,
    'rate(1 minute)',
    'the poll period moved. R-W accepts ONE POLL PERIOD OF LATENCY as its stated cost; a ' +
      'reader pricing the delay should find the number here and in RUN_WORKER_POLL_MINUTES.',
  )
  assert.equal(rule.Targets?.length, 1, 'expected exactly one target on the schedule')

  const ecsParams = rule.Targets[0].EcsParameters
  assert.ok(ecsParams, 'the schedule`s target is not an ECS task')
  assert.equal(ecsParams.LaunchType, 'FARGATE')
  assert.equal(ecsParams.TaskCount, 1)

  const net = ecsParams.NetworkConfiguration?.AwsVpcConfiguration
  assert.ok(net, 'the task has no awsvpc network configuration')
  assert.equal(
    net.AssignPublicIp,
    'DISABLED',
    'the worker task would get a public IP. It reaches ECR, Secrets Manager and SQS through ' +
      'the NAT the data plane already uses, and it serves nothing.',
  )

  /* 🛑 THE SUBNETS AND THE SECURITY GROUP ARE IMPORTED FROM `Network`'S
   * EXISTING EXPORTS AND MINT NO NEW ONE — which is what keeps `Network`
   * byte-identical (§8). The security group is the DATA PLANE'S OWN,
   * deliberately: `Data` admits it to the data cluster and admits nothing
   * else, so a new group would need an ingress rule in another stack. */
  const rendered = JSON.stringify(net)
  assert.ok(
    rendered.includes('reconcile-network-staging:'),
    'the task`s subnets and security group are not imported from Network`s exports: ' +
      `${rendered}`,
  )
  assert.equal(
    net.SecurityGroups?.length,
    1,
    'the worker runs with more than one security group. It occupies the data plane`s network ' +
      'position and nothing wider.',
  )
})

// ------------------------------ 4g. it drains; it does not execute

/**
 * 🛑 **D-1 MAKES THE QUEUE DRAIN AND DOES NOT MAKE A RUN EXECUTE, AND THIS IS
 * THE ASSERTION THAT KEEPS THAT TRUE IN THE TEMPLATE.** The worker claims,
 * reads and reports; `server/data-plane/run-worker.ts` says so in capitals.
 * The command must therefore be `run-worker-main.ts` and not some future
 * executor entry point somebody swaps in without re-reading this file.
 */
test('test_the_scheduled_command_is_the_one_message_and_exit_worker', () => {
  const taskDefs = resourcesOfType(stack(), TASK_DEFINITION)
  assert.equal(taskDefs.length, 1, `expected exactly one task definition, found ${taskDefs.length}`)

  const containers = taskDefs[0][1].Properties?.ContainerDefinitions ?? []
  assert.equal(containers.length, 1, 'expected exactly one container on the worker task')

  const container = containers[0]
  assert.deepEqual(
    container.Command,
    ['node', 'server/data-plane/run-worker-main.ts'],
    `the scheduled command is ${JSON.stringify(container.Command)}. R-W needed NO server/ ` +
      'change because that file is already one-message-and-exit; a different entry point here ' +
      'is a process shape nobody ruled on.',
  )
  assert.equal(
    container.ReadonlyRootFilesystem,
    true,
    'G262`s readonlyRootFilesystem is off on the worker. The idioms are imported from ' +
      'lib/planes-stack.ts rather than copied precisely so this cannot drift.',
  )

  const envNames = (container.Environment ?? []).map((e) => e.Name)
  for (const forbidden of [
    'RECONCILE_LOCAL_TEST_AUTH',
    'RECONCILE_RUN_QUEUE_ENDPOINT',
    'PGPASSWORD',
    'RECONCILE_MIGRATOR_PASSWORD',
    'RECONCILE_DB_ADMIN',
  ]) {
    assert.equal(
      envNames.includes(forbidden),
      false,
      `the worker container sets ${forbidden}. Each absence is a control: G192's fence is ` +
        'structural and its ABSENCE from a real task definition is what compose.yaml calls "a ' +
        'thing an auditor can read"; the ENDPOINT override is for the local stack alone and ' +
        'would point the SDK away from SQS; and the migrator credentials belong to a job that ' +
        'runs once and exits.',
    )
  }

  /*
   * ⚠️ THIS LIST WAS `['RECONCILE_APP_PASSWORD']` UNTIL 4 Oct 2026 AND MOVES
   * DELIBERATELY — G3861, discharging G3749. Its message read: *"It
   * authenticates as reconcile_app — NOBYPASSRLS, owning nothing, THE SAME
   * CREDENTIAL THE LISTENER HOLDS."* The worker now holds `reconcile_engine`
   * ALONE: `reconcile_app` plus `INSERT` on the two exception tables
   * (`db/migrations/0500` §1), still NOBYPASSRLS and owning nothing. ONE
   * entry, not two — a worker holding both would carry the listener's
   * credential for no reader, and `run-worker-main.ts` opens exactly one pool.
   */
  const secretNames = (container.Secrets ?? []).map((s) => s.Name)
  assert.deepEqual(
    secretNames,
    ['RECONCILE_ENGINE_PASSWORD'],
    `the worker holds ${JSON.stringify(secretNames)}. It authenticates as reconcile_engine ` +
      'and nothing else; without it run-worker-main.ts ACCOUNTS runs and persists NO ' +
      'exceptions (db/migrations/0500 §1).',
  )

  /* 🛑 AND THE ARN BEHIND THAT NAME IS THE ENGINE SECRET AND NOT THE APP ONE —
   * a name is a label, the import is the credential. Resolved through `Data`'s
   * own Outputs to the secret's own `Name`, typed in below. */
  assert.equal(
    secretNameBehind(container.Secrets[0].ValueFrom),
    'reconcile-staging-dataengine',
    'RECONCILE_ENGINE_PASSWORD on the worker does not resolve to the reconcile_engine secret',
  )
})

test('test_the_serving_data_plane_holds_the_engine_credential_by_no_route', () => {
  /* 🛑 G3861. The run worker's credential may INSERT into `tenant.exception`;
   * a serving process holding it could mint findings against itself, which is
   * `db/migrations/0015`'s refusal. Asserted on the REAL synthesised `Planes`
   * template, by the secret each container's import RESOLVES to — so a rename
   * of the variable cannot walk the credential past this. */
  const planes = templates['reconcile-planes-staging']
  assert.ok(planes, 'reconcile-planes-staging is not in the synthesised app')
  const holders = []
  for (const [, td] of resourcesOfType(planes, TASK_DEFINITION)) {
    for (const c of td.Properties?.ContainerDefinitions ?? []) {
      for (const sec of c.Secrets ?? []) {
        if (secretNameBehind(sec.ValueFrom) === 'reconcile-staging-dataengine') {
          holders.push(`${c.Name}:${sec.Name}`)
        }
      }
    }
  }
  assert.deepEqual(
    holders,
    ['data-plane-migrate:RECONCILE_ENGINE_PASSWORD'],
    `the engine credential reaches ${JSON.stringify(holders)} in Planes. Only the data MIGRATE ` +
      'task may hold it there (createRoles() SETS its password); the serving data plane never.',
  )
})


// ------------------------- 5. nothing else moved, and that is the constraint

test('test_the_six_protected_templates_are_untouched_by_this_stack_existing', () => {
  /*
   * 🛑 THE STRONGEST FORM AVAILABLE HERE: the app is synthesised ONCE, so the
   * assertion is that these three templates contain NO reference to this
   * stack's resources and NO export minted for it. A byte-for-byte diff
   * against an app synthesised without `RunQueue` was run by hand at the
   * commit that added this file and reported IDENTICAL for all six existing
   * staging stacks; this keeps the property checkable on every gate run.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * ⚠️ **THE FIRST ARM READ `rendered.includes('run-admitted') === false`
   *    UNTIL 20 Sep 2026 AND IT IS RE-KEYED RATHER THAN RELAXED — G1281.**
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Its message said *"`Planes` knows nothing about `RunQueue`"*, and after
   * G1281 that sentence is **false on purpose**: the data-plane task
   * definition carries `RECONCILE_RUN_QUEUE_URL`, spelled by `runQueueUrl()`
   * from the account, the region and the queue NAME.
   *
   * 🛑 **BUT THE PROPERTY THE TEST DEFENDS DID NOT MOVE, AND THE OLD ARM WAS
   * NEVER KEYED ON IT.** The property is *`RunQueue` mints no cross-stack
   * export on `Planes`*, because an export on `Planes` is a `Planes` deploy
   * (G1012) — and the old arm was keyed on a **SUBSTRING**, which is
   * `docs/HANDOFF.md` §5.1's *"a rule keyed on a convenient landmark instead
   * of the property it protects"*, in the file written to hold that property.
   * A literal string creates no CloudFormation dependency of any kind:
   * `auroraClusterIdentifier()` does exactly this for `Data` one stack over,
   * and `lib/observability-stack.ts` records the same by-name reasoning.
   *
   * **So the arm now asserts the property directly**: no `Fn::ImportValue` in
   * any of the three templates may name a `RunQueue` export. That is stricter
   * where it matters — it would catch a construct reference the substring
   * check could also have caught, AND it keeps catching one if somebody
   * renames the queue.
   */
  const RUN_QUEUE_EXPORT_HINTS = ['RunQueue', 'run-queue', 'RunAdmitted']

  /*
   * ⚠️ **THREE NAMES UNTIL 21 Sep 2026 AND SIX SINCE — R-W, G1546.** The list
   * was `Planes`, `Network` and `Edge`; the worker reads `Network` (the vpc,
   * the private subnets, the data-plane security group) and `Data` (the
   * cluster endpoint, its port and the app secret), so both are now stacks
   * this slice could have moved and neither may be. `Storage` and
   * `Observability` join them because `docs/build/completion-plan.md` §8 names
   * all six and a list shorter than the rule it enforces is §5.1.
   *
   * 🛑 **MEASURED BY HAND AS WELL, AND THAT IS THE STRONGER FORM THIS TEST
   * CANNOT REACH:** the app was synthesised before and after this slice and
   * all six templates hashed BYTE-IDENTICAL (sha256), because CDK mints ONE
   * export per attribute READ and `Planes` already reads every value the
   * worker takes. This test keeps the property checkable on every gate run;
   * the hash comparison needs two trees and a person.
   */
  for (const name of [
    'reconcile-planes-staging',
    'reconcile-network-staging',
    'reconcile-edge-staging',
    'reconcile-storage-staging',
    'reconcile-observability-staging',
    'reconcile-data-staging',
  ]) {
    const template = templates[name]
    assert.ok(template, `${name} is not in the synthesised app`)
    const rendered = JSON.stringify(template)

    /* ---- the property: no cross-stack reference INTO this stack. */
    const imports = []
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (node === null || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node)) {
        if (key === 'Fn::ImportValue') imports.push(JSON.stringify(value))
        walk(value)
      }
    }
    walk(template)
    const offending = imports.filter((i) => RUN_QUEUE_EXPORT_HINTS.some((h) => i.includes(h)))
    assert.deepEqual(
      offending,
      [],
      `${name} imports a cross-stack export from RunQueue: ${offending.join(', ')}. See the ` +
        'header: CDK mints an export per attribute READ, and an export on `Planes` is a ' +
        '`Planes` deploy (G1012). Join by NAME — `runQueueUrl()` in lib/config.ts.',
    )

    /*
     * ⛔ **THE SECOND ARM IS DELETED — R-W, G1547 — AND IT IS QUOTED HERE
     * RATHER THAN REMOVED SILENTLY, BECAUSE IT WENT RED ON A STACK THAT IS
     * DOING THE RIGHT THING.** It read:
     *
     *     assert.equal(rendered.includes('RunQueue'), false,
     *       `${name} names this stack. See the header: an export on
     *        \`Planes\` is a \`Planes\` deploy.`)
     *
     * **`reconcile-observability-staging` names it once**, as the logical id
     * `RunQueueDeadLetterNotEmpty…` — G1061/G1283's dead-letter alarm, joined
     * to this stack **BY QUEUE NAME**, which mints no export and creates no
     * CloudFormation dependency in either direction. Derive it, never read it:
     *
     *     grep -c 'RunQueue' cdk.out/reconcile-observability-staging.template.json
     *
     * 🛑 **THIS IS §5.1 IN THE TEST WRITTEN TO HOLD A §5.1-SHAPED PROPERTY,
     * FOR THE SECOND TIME ON THE SAME LINE.** The block above already records
     * re-keying this arm once — *"the old arm was keyed on a SUBSTRING, which
     * is §5.1's 'a rule keyed on a convenient landmark instead of the property
     * it protects'"* — and the substring form was KEPT beside the repair as
     * belt-and-braces. **A landmark kept beside a property is not defence in
     * depth; it is a second rule with a different meaning**, and this one's
     * meaning was *"no other stack may mention the run queue"*, which nobody
     * ever ruled and which forbids the alarm this very slice arms.
     *
     * **The property is unchanged and is asserted above**: no `Fn::ImportValue`
     * in any of the six may name a `RunQueue` export. That is what an export
     * on `Planes` would look like, and it is the only thing that costs a
     * `Planes` deploy.
     */
  }
})

/**
 * THE OTHER HALF OF THE BY-NAME JOIN — G1281.
 *
 * 🛑 A SPELLED NAME BUYS THE DEPLOY-ORDER PROPERTY AND COSTS THE COMPILER'S
 * CHECK, SO SOMETHING HAS TO HOLD THE TWO SIDES TOGETHER. `lib/config.ts`
 * builds the URL from `AWS_REGION`, `AWS_ACCOUNT` and `runQueueName()`; this
 * reads the queue's OWN `QueueName` out of the `RunQueue` template and
 * requires the `Planes` task definition to carry a URL ending in exactly that.
 * **A constant that merely looks right is the failure `PLANES_EXPORT_KEYS`
 * exists to prevent one stack over** — a deploy-time *"No export named …"* is
 * loud, and a queue URL naming a queue that does not exist is a silent
 * `AWS.SimpleQueueService.NonExistentQueue` on the first admitted run.
 */
test('test_the_url_the_data_plane_is_given_names_the_queue_this_stack_creates', () => {
  const queueName = queues()
    .map((q) => q.Properties?.QueueName)
    .find((n) => typeof n === 'string' && !n.endsWith('-dlq'))
  assert.ok(queueName, 'no non-DLQ queue with a literal name in the RunQueue template')

  const planes = templates['reconcile-planes-staging']
  assert.ok(planes, 'reconcile-planes-staging is not in the synthesised app')

  const urls = []
  for (const [, resource] of Object.entries(planes.Resources ?? {})) {
    if (resource.Type !== 'AWS::ECS::TaskDefinition') continue
    for (const container of resource.Properties?.ContainerDefinitions ?? []) {
      for (const entry of container.Environment ?? []) {
        if (entry.Name === 'RECONCILE_RUN_QUEUE_URL') urls.push([container.Name, entry.Value])
      }
    }
  }

  assert.equal(
    urls.length,
    1,
    'exactly one container may be told where the run queue is, and it is the data plane`s ' +
      `SERVICE. Found ${urls.length}: ${JSON.stringify(urls)}. A migrate run-task with a ` +
      'queue URL would be a one-shot job holding a publish target it never uses.',
  )
  const [containerName, url] = urls[0]
  assert.equal(containerName, 'data-plane', 'the queue URL is on the wrong container')
  assert.equal(
    typeof url,
    'string',
    'RECONCILE_RUN_QUEUE_URL is not a literal. If it became an Fn::ImportValue, that is an ' +
      'export on RunQueue and a deploy-order edge in the direction that deadlocks.',
  )
  assert.ok(
    url.endsWith(`/${queueName}`),
    `the data plane is told the queue is at ${url}, and this stack creates ${queueName}. ` +
      'runQueueUrl() in lib/config.ts spells the URL; a disagreement here is a plane ' +
      'publishing to a queue that does not exist, which SQS answers with ' +
      'NonExistentQueue on the first admitted run.',
  )
  assert.ok(
    url.startsWith('https://sqs.'),
    `${url} is not an SQS queue URL. RECONCILE_RUN_QUEUE_ENDPOINT is the local-stack ` +
      'override and must never be set here; the URL is the endpoint against AWS.',
  )

  /* ⚠️ AND THE LOCAL-STACK OVERRIDE MUST BE ABSENT. `run-queue.ts` says it is
   * "FOR THE LOCAL STACK ALONE": set here it would point the SDK at whatever
   * it named INSTEAD of at SQS, which is a variable set to the wrong shape
   * rather than one merely absent. */
  assert.equal(
    JSON.stringify(planes).includes('RECONCILE_RUN_QUEUE_ENDPOINT'),
    false,
    'Planes sets RECONCILE_RUN_QUEUE_ENDPOINT. That override exists because compose`s ' +
      'SQS-compatible server hands out a URL naming a container hostname; against AWS the ' +
      'queue URL IS the endpoint, and setting this points the SDK away from SQS.',
  )
})

// ----------------------------- 6. what the stack says out loud

/**
 * ⚠️ **THIS TEST WAS `test_the_stack_says_out_loud_that_nothing_consumes_the_queue`
 * AND R-W MADE IT FAIL ON PURPOSE. ITS CAPTURED RED:**
 *
 *     ✖ test_the_stack_says_out_loud_that_nothing_consumes_the_queue
 *       AssertionError: the stack does not OUTPUT that nothing may receive
 *
 * **It was right, and the thing it asserted is no longer true.** The output it
 * demanded — `RunQueueHasNoConsumerUntil` — is REPLACED rather than deleted,
 * because an output is read by somebody running `describe-stacks` rather than
 * reading this repository, and one that silently vanished is
 * indistinguishable from one they failed to find.
 *
 * 🛑 **WHAT REPLACES IT CARRIES THE SENTENCE A READER IS LEAST LIKELY TO
 * INFER AND MOST NEEDS: THE QUEUE DRAINS AND A RUN DOES NOT EXECUTE.**
 */
test('test_the_stack_says_out_loud_that_draining_is_not_executing', () => {
  /* An output's sentence may sit in its VALUE or in its DESCRIPTION — a
   * `describe-stacks` reader sees both — so the search is over both rather
   * than over whichever field the author happened to choose. Keying on one
   * field is the landmark this file has now twice been caught on. */
  const said = (needle) =>
    Object.values(stack().Outputs ?? {}).some((o) =>
      `${typeof o.Value === 'string' ? o.Value : JSON.stringify(o.Value)} ${o.Description ?? ''}`
        .includes(needle),
    )

  const drains = said('runSetReconciliation()')
  assert.ok(
    drains,
    'the stack does not OUTPUT that its worker executes nothing. `Observability` sets the ' +
      'precedent with `AlarmsPageNobodyUntil`: a half-built control presented as a whole one ' +
      'is how this record`s own §5.6 gets written again. D-1 makes the queue DRAIN; R-A is ' +
      'what makes a run EXECUTE, and pricing one as the other is the error this output exists ' +
      'to prevent.',
  )

  const image = said('deployed IMAGE')
  assert.ok(
    image,
    'the stack does not OUTPUT that a deployed task definition and a deployed IMAGE are two ' +
      'facts (G1285). This task definition names the same pinned tag the planes run; if that ' +
      'image predates server/data-plane/run-queue.ts, every tick fails to resolve its own ' +
      'entry point and nothing in `npm run check` can see it.',
  )

  const url = said('RECONCILE_RUN_QUEUE_URL')
  assert.ok(
    url,
    'the queue URL is not output. A human reads it off a deployed stack.',
  )

  /* 🛑 AND THE ALARM: `run-queue-stack.ts`'s header said "NO ALARM WATCHES IT"
   * until this slice and that was STALE — `Observability` took the construct
   * under G1061/G1283. What was TRUE is that it could not fire, because
   * reaching a dead-letter queue requires being RECEIVED and nothing held that
   * verb. This slice is what arms it, and the output must say both halves. */
  const dlq = said('dead-letter-not-empty')
  assert.ok(
    dlq,
    'the dead-letter output does not name the alarm that watches it. The header said NO ALARM ' +
      'WATCHES IT, which was stale; what was true is that the alarm COULD NOT FIRE until a ' +
      'consumer existed. It still pages nobody — R-F keeps the topic unsubscribed and R14 is ' +
      'the open ruling — and an output claiming otherwise would be worse than silence.',
  )
})

// ---------------------------------------------------------- 7. G260's tags

test('test_g260_required_tags_reach_both_queues', () => {
  for (const queue of queues()) {
    const tags = Object.fromEntries((queue.Properties?.Tags ?? []).map((t) => [t.Key, t.Value]))
    assert.equal(tags.Project, 'reconcile', `${queue.Properties?.QueueName} carries no Project tag`)
    assert.equal(tags.Environment, 'staging')
    assert.equal(tags.Plane, 'data')
    assert.equal(
      Object.hasOwn(tags, 'TenantId'),
      false,
      'G260 forbids a tenant identifier in a tag: `kms:ListAliases` and `sqs:ListQueues` are ' +
        'read by anybody in a shared account.',
    )
  }
})

// -------------------------------------- 8. THE VISIBILITY TIMEOUT — G1834

/**
 * 🛑 THE OWNER'S RULING, 22 Sep 2026: raise `RUN_QUEUE_VISIBILITY_SECONDS`
 * well above any realistic run duration. E5's executor measured that thirty
 * seconds let a run become visible again mid-execution, so a second worker
 * started a second execution of the SAME run — no idempotency key prevents
 * it, because `run_idempotency_key` guards ADMISSION and not execution — and
 * after `RUN_QUEUE_MAX_RECEIVE_COUNT` deliveries a run that SUCCEEDED every
 * time landed on the dead-letter queue, inverting the alarm.
 *
 * ⚠️ 1800 IS TYPED IN, NOT IMPORTED, per this file's own opening rule: a
 * value equalling itself proves nothing. 900 (15 minutes) is the FLOOR
 * `docs/build/completion-plan.md` §10 item 5 names as the bottom of its
 * recommended range; the queue is asserted at the OWNER'S CHOSEN value
 * rather than merely above the floor, because a floor-only assertion would
 * pass at 901 seconds and hide a regression toward the dangerous end of
 * the range.
 */
test('test_the_visibility_timeout_is_1800_seconds_and_not_the_thirty_it_used_to_be', () => {
  const main = byName(QUEUE_NAME)
  const visibilityTimeout = main.Properties?.VisibilityTimeout

  assert.equal(
    typeof visibilityTimeout,
    'number',
    `the run queue has no numeric VisibilityTimeout at all. Found: ${JSON.stringify(visibilityTimeout)}`,
  )
  assert.ok(
    visibilityTimeout >= 900,
    `VisibilityTimeout is ${visibilityTimeout}s, below the 900s (15 minute) floor ` +
      'docs/build/completion-plan.md names as the bottom of an acceptable range. A run that ' +
      'exceeds this becomes visible again mid-execution and is picked up by a second worker.',
  )
  assert.equal(
    visibilityTimeout,
    1800,
    `expected exactly 1800 (30 minutes) — G1834, the owner's ruling. Found ${visibilityTimeout}. ` +
      'If this moved deliberately, this assertion and `infra/lib/config.ts`\'s own header ' +
      'both need the new number and the new argument for it.',
  )
})

// ------------------------- 9. THE DEAD-LETTER ARRIVAL TIME — G1834, G1836

/**
 * ⚠️ RAISING THE VISIBILITY TIMEOUT RAISES THE TIME A GENUINELY UNREADABLE
 * MESSAGE TAKES TO REACH THE DEAD-LETTER QUEUE, BECAUSE THE REDRIVE POLICY
 * DELIVERS IT `maxReceiveCount` TIMES FIRST. D-1's own measurement was of
 * the OLD product (5 × 30s = 150s); this asserts the NEW one so the next
 * reader does not have to recompute it by hand.
 *
 * 🛑 9000 SECONDS (2.5 HOURS) IS CALLED "ACCEPTABLE" HERE FOR A STATED
 * REASON AND NOT BY DEFAULT: `RUN_QUEUE_MAX_RECEIVE_COUNT`'s own header
 * argues that a PERMANENT failure (a body that will not parse) is answered
 * by no number of retries, so the elapsed time before a permanent failure
 * is FLAGGED does not change the outcome for that message — it only delays
 * how soon a human sees it. 2.5 hours is inside a single working day, which
 * is the bar `RUN_QUEUE_MAX_RECEIVE_COUNT`'s own comment sets ("five is
 * short enough that it reaches a person the same day").
 */
test('test_the_dead_letter_arrival_time_is_9000_seconds_and_the_product_is_asserted_not_assumed', () => {
  const main = byName(QUEUE_NAME)
  const visibilityTimeout = main.Properties?.VisibilityTimeout
  const maxReceiveCount = main.Properties?.RedrivePolicy?.maxReceiveCount

  assert.equal(typeof visibilityTimeout, 'number', 'VisibilityTimeout is not numeric')
  assert.equal(typeof maxReceiveCount, 'number', 'RedrivePolicy.maxReceiveCount is not numeric')

  const elapsedSeconds = visibilityTimeout * maxReceiveCount
  assert.equal(
    elapsedSeconds,
    9000,
    `expected maxReceiveCount (${maxReceiveCount}) × visibilityTimeout (${visibilityTimeout}) ` +
      `= 9000s (2.5 hours), got ${elapsedSeconds}s. This is the elapsed wall-clock time before ` +
      'an unreadable message reaches the dead-letter queue and its alarm can fire at all.',
  )
  assert.ok(
    elapsedSeconds <= 24 * 60 * 60,
    `${elapsedSeconds}s is more than a day before a permanently unreadable message reaches ` +
      'the dead-letter queue — `RUN_QUEUE_MAX_RECEIVE_COUNT`\'s own header sets "reaches a ' +
      'person the same day" as the bar.',
  )
})

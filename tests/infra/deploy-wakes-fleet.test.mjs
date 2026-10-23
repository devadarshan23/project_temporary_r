/**
 * G2301 — THE DEPLOY STAGE WAKES A SLEEPING FLEET, AND STILL NEVER REPORTS GREEN
 * ONTO ZERO TASKS.
 *
 * The owner's ruling, 1 Oct 2026: *"Scale up in Deploy — the Deploy stage raises
 * desiredCount to the 'up' value before rolling out, and the next scheduled
 * scale-down returns it to 0."* `docs/build/deploy-handoff.md` §19 is the
 * measurement that made it necessary: outside 09:00–21:00 +08 every merge
 * failed at Deploy, correctly, on the zero refusal.
 *
 * 🛑 **THE PROPERTY THIS SUITE EXISTS FOR IS THE ONE THE RULING MUST NOT
 * SPEND.** `ecs wait services-stable` returns immediately at zero, so a wake
 * built on it is the vacuous green the zero refusal prevents, moved one action
 * earlier. Every arm below that can go RED on a deploy-onto-zero is witnessed
 * by running the extracted script against a `describe-services` fixture, not by
 * reading its text. ⚠️ **THE FIXTURES ARE OURS AND CANNOT WITNESS AWS** —
 * `tests/infra/pipeline.test.mjs` §3b says the same of the rollout verdict.
 *
 * THE REDS, WITNESSED BY MUTATING THE TREE AND RUNNING THIS SUITE, 1 Oct 2026,
 * AND QUOTED SO THEY CANNOT BE LOST:
 *
 *   §3, with G2304's three running-task lines deleted from ROLLOUT_VERDICT_JS:
 *     AssertionError: a rollout that COMPLETED onto desiredCount 0 exited 0. That
 *     is a green deploy onto ZERO tasks …
 *   §2, with `ecs wait services-stable` added to the wake's await function:
 *     AssertionError: the wake buildspec runs `ecs wait services-stable` …
 *   §5, with WAKE_DESIRED_COUNT typed as '2' against a Planes stack carrying 1
 *   (⚠️ before G2461 made the value per plane — the red is kept as witnessed):
 *     AssertionError: the wake raises to 2 but the Planes stack owns DesiredCount
 *     1 on DataPlaneService95BACBDC …
 *   §6, with ecs:UpdateService put back on the Deploy role's read statement:
 *     AssertionError: the Deploy role holds ecs:UpdateService. G2046 removed …
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

import { ensureDeps, resourcesOfType, synthesisedTemplates } from './support.mjs'

await ensureDeps()

const templates = synthesisedTemplates()

function projectNamed(fragment) {
  for (const [stackName, template] of Object.entries(templates)) {
    for (const [logicalId, resource] of resourcesOfType(template, 'AWS::CodeBuild::Project')) {
      if (new RegExp(fragment).test(JSON.stringify(resource.Properties?.Name ?? ''))) {
        return { stackName, logicalId, resource }
      }
    }
  }
  assert.fail(`no CodeBuild project matching ${fragment}`)
}

function commandLines(yaml) {
  const out = []
  for (const phase of Object.values(parseYaml(yaml)?.phases ?? {})) {
    for (const command of phase?.commands ?? []) out.push(...String(command).split('\n'))
  }
  return out
}

/** Lines with their `#` comments stripped — a sentence ABOUT a waiter is not a waiter. */
const codeLines = (yaml) =>
  commandLines(yaml)
    .map((l) => (l.trimStart().startsWith('#') ? '' : l))
    .filter((l) => l.trim() !== '')

/** The `node -e '…'` payload on the one command line carrying `marker`. */
function scriptOn(fragment, marker) {
  const yaml = projectNamed(fragment).resource.Properties.Source.BuildSpec
  const line = commandLines(yaml).find((l) => l.includes('node -e') && l.includes(marker))
  assert.ok(line !== undefined, `${fragment}: no node -e line carries ${marker}`)
  return line.slice(line.indexOf("'") + 1, line.lastIndexOf("'"))
}

async function run(script, files, env = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'wake-'))
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), JSON.stringify(body))
  }
  const r = spawnSync(process.execPath, ['-e', script], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return { status: r.status, output: `${r.stdout}${r.stderr}`, dir }
}

function thePipeline() {
  for (const template of Object.values(templates)) {
    const found = resourcesOfType(template, 'AWS::CodePipeline::Pipeline')
    if (found.length === 1) return found[0][1]
  }
  assert.fail('no pipeline synthesised')
}

// ---------------------------------------------------- §1 · the stage's shape

test('test_the_deploy_stage_wakes_the_fleet_before_it_deploys_and_publishes_last', () => {
  const deploy = (thePipeline().Properties?.Stages ?? []).find((s) => s.Name === 'Deploy')
  assert.ok(deploy !== undefined, 'the pipeline has no Deploy stage')
  const order = Object.fromEntries((deploy.Actions ?? []).map((a) => [a.Name, a.RunOrder]))
  for (const name of ['WakeFleet', 'UpdateServices', 'PublishSite']) {
    assert.ok(Number.isFinite(order[name]), `${name} is absent or carries no RunOrder`)
  }
  assert.ok(
    order.WakeFleet < order.UpdateServices && order.UpdateServices < order.PublishSite,
    `the Deploy stage runs ${JSON.stringify(order)}. G2301: the fleet is woken and ` +
      'RUNNING before anything is rolled onto it, and a wake that cannot get tasks ' +
      'running must mean UpdateServices is never started.',
  )
  const wake = (deploy.Actions ?? []).find((a) => a.Name === 'WakeFleet')
  assert.match(
    JSON.stringify(wake.Configuration?.ProjectName ?? ''),
    new RegExp(projectNamed('reconcile-wake-').logicalId),
    'the WakeFleet action does not run the reconcile-wake- project',
  )
})

// -------------------------------------- §2 · the wake never trusts a waiter

test('test_the_wake_never_waits_on_services_stable_and_polls_running_tasks_after_raising', () => {
  const yaml = projectNamed('reconcile-wake-').resource.Properties.Source.BuildSpec
  const code = codeLines(yaml)
  assert.ok(
    !code.some((l) => l.includes('services-stable')),
    'the wake buildspec runs `ecs wait services-stable`. It returns IMMEDIATELY ' +
      'against a service at zero, so a wake built on it reports a fleet awake ' +
      'that has no task — the deploy-onto-zero the ruling must not spend.',
  )
  const at = (needle) => code.findIndex((l) => l.includes(needle))
  const bounds = at('register-scalable-target')
  const count = at('update-service')
  const poll = at('service-awake.json')
  assert.ok(bounds !== -1 && count !== -1 && poll !== -1, 'a write or the poll is missing')
  /* The order IS the clamp: the bounds the EveningDown set to 0/0 move first,
   * so the desired count cannot be written outside them. */
  assert.ok(bounds < count, 'the desired count is written before the bounds are raised')
  /* `codeLines` keeps the function BODIES in source order, so compare the CALLS. */
  const calls = code.filter((l) => /^\s*(wake_plane|await_plane) /.test(l)).map((l) => l.trim().split(' ')[0])
  assert.deepEqual(
    calls,
    ['wake_plane', 'wake_plane', 'await_plane', 'await_plane'],
    'both planes are raised, then both are awaited — and nothing is awaited at all is a red',
  )
})

// ------------------------------- §3 · G2304, the deploy can never end green at zero

test('test_a_rollout_that_completes_onto_zero_tasks_is_FATAL_and_one_short_is_a_retry', async () => {
  const verdict = scriptOn('reconcile-deploy-', 'WANT_TASK_DEFINITION=')
  const TD = 'arn:aws:ecs:us-west-2:111122223333:task-definition/reconcile-data-staging:40'
  const service = (desired, running, extra = {}) => ({
    services: [
      {
        serviceName: 'reconcile-data-staging',
        taskDefinition: TD,
        desiredCount: desired,
        runningCount: running,
        deployments: [
          {
            status: 'PRIMARY',
            taskDefinition: TD,
            rolloutState: 'COMPLETED',
            desiredCount: desired,
            runningCount: running,
            ...extra,
          },
        ],
      },
    ],
  })
  const at = async (body) =>
    run(verdict, { 'service-after.json': body }, { WANT_TASK_DEFINITION: TD })

  const zero = await at(service(0, 0))
  assert.equal(
    zero.status,
    1,
    `a rollout that COMPLETED onto desiredCount 0 exited ${zero.status}. That is a ` +
      'green deploy onto ZERO tasks — the scheduled scale-down fired mid-deploy — and ' +
      `it is the one outcome G2301 must never produce.\n${zero.output}`,
  )

  const short = await at(service(1, 0))
  assert.equal(short.status, 75, `one task short of desired must be a RETRY\n${short.output}`)

  const noCount = service(1, 1)
  delete noCount.services[0].deployments[0].runningCount
  const absent = await at(noCount)
  assert.equal(absent.status, 1, `an absent count is not a count of zero\n${absent.output}`)

  const done = await at(service(1, 1))
  assert.equal(done.status, 0, `one running task on the wanted revision is a deploy\n${done.output}`)
})

test('test_the_zero_refusal_in_UpdateServices_survives_the_wake_as_an_independent_control', () => {
  /* G2302 — each sufficient, neither necessary. Deleting this because the wake
   * now precedes it would leave a wake/scale-down race with one control. */
  const yaml = projectNamed('reconcile-deploy-').resource.Properties.Source.BuildSpec
  assert.match(yaml, /desiredCount===0/, 'UpdateServices no longer refuses a fleet at zero')
})

// ------------------------------------- §4 · the wake's two scripts, run for real

test('test_the_fleet_awake_verdict_finishes_only_on_running_tasks', async () => {
  const verdict = scriptOn('reconcile-wake-', 'service-awake.json')
  const at = (desiredCount, runningCount, pendingCount) =>
    run(verdict, {
      'service-awake.json': {
        services: [{ serviceName: 'probe', desiredCount, runningCount, pendingCount }],
      },
    })
  for (const [d, r, p, want, why] of [
    [0, 0, 0, 1, 'desired 0 after the raise is a scale-down that fired, never a wait'],
    [1, 0, 1, 75, 'a task still starting is a retry'],
    [1, 1, 0, 0, 'one running task is something to deploy onto'],
    [2, 1, 1, 75, 'one of two is a retry'],
  ]) {
    const got = await at(d, r, p)
    assert.equal(got.status, want, `desired=${d} running=${r} pending=${p}: ${why}\n${got.output}`)
  }
  const absent = await run(verdict, {
    'service-awake.json': { services: [{ serviceName: 'probe', desiredCount: 1 }] },
  })
  assert.equal(absent.status, 1, `an absent runningCount must be FATAL, not zero\n${absent.output}`)
})

test('test_the_wake_plan_raises_a_sleeping_fleet_and_refuses_a_schedule_that_would_undo_it', async () => {
  const plan = scriptOn('reconcile-wake-', 'plan.txt')
  const files = (desiredCount, scheduledUp) => ({
    'service.json': { services: [{ serviceName: 'probe', desiredCount, runningCount: desiredCount }] },
    'targets.json': { ScalableTargets: [{ ResourceId: 'service/c/probe' }] },
    'actions.json': {
      ScheduledActions: [
        { ScheduledActionName: 'ProbeEveningDown', ScalableTargetAction: { MinCapacity: 0, MaxCapacity: 0 } },
        { ScheduledActionName: 'ProbeMorningUp', ScalableTargetAction: { MinCapacity: scheduledUp, MaxCapacity: scheduledUp } },
      ],
    },
  })
  const { readFileSync } = await import('node:fs')

  const asleep = await run(plan, files(0, 1), { WAKE_DESIRED_COUNT: '1' })
  assert.equal(asleep.status, 0, asleep.output)
  assert.equal(readFileSync(join(asleep.dir, 'plan.txt'), 'utf8'), 'raise')
  assert.equal(readFileSync(join(asleep.dir, 'has-target.txt'), 'utf8'), 'yes')

  const awake = await run(plan, files(1, 1), { WAKE_DESIRED_COUNT: '1' })
  assert.equal(awake.status, 0, awake.output)
  assert.equal(readFileSync(join(awake.dir, 'plan.txt'), 'utf8'), 'awake')

  const disagree = await run(plan, files(0, 1), { WAKE_DESIRED_COUNT: '2' })
  assert.equal(
    disagree.status,
    1,
    'the deployed schedule says 1 and the pipeline would raise to 2; UpdateStack sends ' +
      `the stack's DesiredCount, so the raise would be silently undone\n${disagree.output}`,
  )

  const nothing = await run(plan, files(0, 1), { WAKE_DESIRED_COUNT: '0' })
  assert.equal(nothing.status, 1, `waking to zero tasks is waking to nothing\n${nothing.output}`)
})

// ------------------- §5 · G2305, the up value agrees with what the stack OWNS

test('test_the_wake_raises_each_plane_to_exactly_what_the_planes_stack_owns_and_schedules_for_it', () => {
  /* ⚠️ PER PLANE SINCE THE 1 Oct 2026 INTEGRATION — G2461. This test read ONE
   * `WAKE_DESIRED_COUNT` and compared it against BOTH services. R-POOL
   * (G2261–G2268), on a concurrent branch, made `SERVING_TASKS_WHEN_UP[env]` a
   * `{ data, control }` record and raised the data service to 2, so a single
   * value cannot agree with both — and as first merged the project carried
   * `String()` of the record, `[object Object]`. The agreement is now asserted
   * per service, against that service's own variable. */
  const env = projectNamed('reconcile-wake-').resource.Properties.Environment.EnvironmentVariables
  assert.equal(
    env.find((v) => v.Name === 'WAKE_DESIRED_COUNT'),
    undefined,
    'a single shared WAKE_DESIRED_COUNT is back; the up value is per plane (G2461)',
  )
  const upFor = {}
  for (const plane of ['data', 'control']) {
    const raw = env.find((v) => v.Name === `WAKE_DESIRED_COUNT_${plane.toUpperCase()}`)?.Value
    const up = Number(raw)
    assert.ok(Number.isInteger(up) && up >= 1, `WAKE_DESIRED_COUNT_${plane.toUpperCase()} is ${raw}`)
    upFor[plane] = up
  }

  const planes = Object.entries(templates).find(([name]) => name.includes('planes'))?.[1]
  assert.ok(planes !== undefined, 'no Planes template synthesised')
  const services = Object.fromEntries(resourcesOfType(planes, 'AWS::ECS::Service'))
  const targets = resourcesOfType(planes, 'AWS::ApplicationAutoScaling::ScalableTarget')
  /* §5.6 — an empty list satisfies every loop below. */
  assert.equal(Object.keys(services).length, 2, 'expected the two serving services')
  assert.equal(targets.length, 2, 'expected the two scalable targets the schedule drives')

  const planeOf = (name) =>
    /-data-plane$/.test(name) ? 'data' : /-control-plane$/.test(name) ? 'control' : undefined
  const seen = new Set()
  for (const [id, s] of Object.entries(services)) {
    const plane = planeOf(String(s.Properties.ServiceName))
    assert.ok(plane !== undefined, `${id} is neither plane: ${s.Properties.ServiceName}`)
    seen.add(plane)
    assert.equal(
      s.Properties.DesiredCount,
      upFor[plane],
      `the wake raises the ${plane} plane to ${upFor[plane]} but the Planes stack owns DesiredCount ` +
        `${s.Properties.DesiredCount} on ${id}. UpdateStack sends that value when it ` +
        'updates the service, so the action after the wake would silently undo it.',
    )
  }
  assert.deepEqual([...seen].sort(), ['control', 'data'])

  for (const [id, t] of targets) {
    const serviceId = t.Properties.ResourceId['Fn::Join'][1].find((x) => x['Fn::GetAtt'])['Fn::GetAtt'][0]
    const plane = planeOf(String(services[serviceId]?.Properties.ServiceName))
    assert.ok(plane !== undefined, `${id} drives no known plane`)
    const ups = (t.Properties.ScheduledActions ?? []).filter(
      (a) => (a.ScalableTargetAction?.MinCapacity ?? 0) > 0,
    )
    assert.ok(ups.length > 0, `${id} has no scheduled scale-UP to compare against`)
    for (const a of ups) {
      assert.equal(a.ScalableTargetAction.MinCapacity, upFor[plane], `${id}/${a.ScheduledActionName} (${plane})`)
    }
  }
})

test('test_the_wake_buildspec_hands_each_plane_its_own_up_value', () => {
  /* G2461 — the env vars above are only half: the buildspec must pass EACH
   * plane's value to the plan script and to both writes, never one shared one. */
  const yaml = projectNamed('reconcile-wake-').resource.Properties.Source.BuildSpec
  assert.match(yaml, /wake_plane control "\$CONTROL_SERVICE_NAME" "\$WAKE_DESIRED_COUNT_CONTROL"/)
  assert.match(yaml, /wake_plane data "\$DATA_SERVICE_NAME" "\$WAKE_DESIRED_COUNT_DATA"/)
  assert.match(yaml, /WAKE_DESIRED_COUNT="\$WANT" node -e/)
  assert.match(yaml, /--desired-count "\$WANT"/)
  assert.match(yaml, /--min-capacity "\$WANT" --max-capacity "\$WANT"/)
})

test('test_the_deploy_and_wake_buildspecs_fit_codebuilds_inline_ceiling', () => {
  /* The integration's own assertion (G2462): both buildspecs this merge
   * touched, measured after it, against the 25,600-character limit. */
  for (const fragment of ['reconcile-deploy-', 'reconcile-wake-']) {
    const yaml = projectNamed(fragment).resource.Properties.Source.BuildSpec
    assert.ok(yaml.length <= 25600, `${fragment} buildspec is ${yaml.length} characters`)
  }
})

// ------------------------------------------------------- §6 · G2303, the IAM

function actionsOnRoleOf(fragment) {
  const project = projectNamed(fragment)
  const template = templates[project.stackName]
  const roleLogicalId = project.resource.Properties?.ServiceRole?.['Fn::GetAtt']?.[0]
  assert.ok(typeof roleLogicalId === 'string', `${fragment} role cannot be resolved`)
  const found = []
  for (const [, policy] of resourcesOfType(template, 'AWS::IAM::Policy')) {
    const roles = (policy.Properties?.Roles ?? []).map((r) => JSON.stringify(r))
    if (!roles.some((r) => r.includes(roleLogicalId))) continue
    for (const statement of policy.Properties?.PolicyDocument?.Statement ?? []) {
      for (const action of [statement.Action ?? []].flat()) {
        found.push({ action, resources: [statement.Resource ?? []].flat() })
      }
    }
  }
  return found
}

test('test_the_wake_role_and_the_deploy_role_cannot_reach_each_others_verbs', () => {
  const wake = actionsOnRoleOf('reconcile-wake-')
  const deploy = actionsOnRoleOf('reconcile-deploy-')
  assert.ok(wake.length > 0 && deploy.length > 0, 'a role carries no actions at all')

  const update = wake.filter((g) => g.action === 'ecs:UpdateService')
  assert.equal(update.length, 1, 'the wake role cannot set a desired count at all')
  assert.ok(
    !update[0].resources.includes('*') && update[0].resources.length === 2,
    'ecs:UpdateService must name the two services and nothing wider',
  )
  for (const { action } of wake) {
    assert.ok(
      // s3 Get and List are CDK's read of the pipeline's input artefact; a WRITE is not.
      !/^(cloudformation|cloudfront|iam):/.test(action) && !/^s3:(Put|Delete)/.test(action),
      `the wake role holds ${action}. It sets a desired count and moves the bounds the ` +
        'schedule lowered; anything else is reach the ruling did not grant.',
    )
  }
  for (const { action } of deploy) {
    assert.ok(
      action !== 'ecs:UpdateService' && !action.startsWith('application-autoscaling:'),
      `the Deploy role holds ${action}. G2046 removed ecs:UpdateService from it — the ` +
        'role that writes the stack value must not be able to move the fleet by hand — ' +
        'and G2301 put that verb on a separate role precisely so it stays removed.',
    )
  }
})

// ---------------------------------------------- §7 · W0-d, for this project

test('test_the_wake_timeout_exceeds_its_own_worst_case_poll_budget', () => {
  const p = projectNamed('reconcile-wake-').resource.Properties
  const rounds = Number(p.Environment.EnvironmentVariables.find((v) => v.Name === 'WAKE_POLL_ROUNDS')?.Value)
  const sleep = Number(/WAKE_POLL_SLEEP_SECONDS=(\d+)/.exec(p.Source.BuildSpec)?.[1])
  assert.ok(rounds > 0 && sleep > 0, `rounds=${rounds} sleep=${sleep}: the arithmetic read nothing`)
  const budgetMinutes = (rounds * sleep * 2) / 60
  assert.ok(
    p.TimeoutInMinutes > budgetMinutes,
    `the wake times out at ${p.TimeoutInMinutes} min against a ${budgetMinutes} min poll ` +
      'budget, so CodeBuild would kill it mid-poll instead of the script naming the timeout',
  )
})

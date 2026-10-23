/**
 * G2961–G2966 — THE PIPELINE RETAGS THE RUN WORKER TOO, AND THIS IS WHAT HOLDS IT.
 *
 * ┌─ 🛑 THE FINDING, DERIVED FROM A LIVE AUDIT ON 2 Oct 2026 ──────────────────┐
 * │ `reconcile-run-queue-staging`'s worker task definition ran image          │
 * │ `cc58f357` — NINE DAYS behind both planes. Not drift by accident: by      │
 * │ CONSTRUCTION. `RunQueue` bakes the plane image tag into its own template, │
 * │ and G2041's Deploy stage retagged `Planes` ALONE, so every merge moved    │
 * │ the planes and left the worker on whatever the last hand deploy carried.  │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ **NOTHING HERE REACHES AWS.** What is assertable at `npm run check` is the
 * MECHANISM: the Deploy stage has an action that retags `RunQueue`, it runs
 * after the planes, it writes the BUILT tag and no other, the write is exactly
 * what CDK would have synthesised, and the role doing it can reach that one
 * stack and nothing the `Deploy` role reaches.
 *
 * Each test below names what it goes RED against. The first two are the ones
 * the slice was commissioned for: **RunQueue left out**, and **RunQueue retagged
 * to a tag other than the built one**.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

import { ensureDeps, resourcesOfType, synthesisedTemplates } from './support.mjs'

await ensureDeps()

const templates = synthesisedTemplates()
const PIPELINE = 'reconcile-pipeline-staging'
const RUN_QUEUE = 'reconcile-run-queue-staging'
const PLANE_REPOSITORY = 'reconcile/planes-staging'
const TAG_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TAG_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const TAG_C = 'cccccccccccccccccccccccccccccccccccccccc'

/** A CodeBuild project in the pipeline stack, by its `Name` prefix. */
function project(namePrefix) {
  const found = resourcesOfType(templates[PIPELINE], 'AWS::CodeBuild::Project').filter(([, r]) =>
    String(r.Properties?.Name ?? '').startsWith(namePrefix),
  )
  assert.equal(found.length, 1, `expected exactly one ${namePrefix}* project, found ${found.length}`)
  return { logicalId: found[0][0], resource: found[0][1] }
}

const retagProject = () => project('reconcile-retag-run-worker-')
const retagSpec = () => retagProject().resource.Properties.Source.BuildSpec
const deploySpec = () => project('reconcile-deploy-').resource.Properties.Source.BuildSpec

function envOf(resource, name) {
  const v = (resource.Properties?.Environment?.EnvironmentVariables ?? []).find((e) => e.Name === name)
  assert.ok(v !== undefined, `${resource.Properties?.Name} does not set ${name}`)
  return v.Value
}

/** Every command line of a buildspec, parsed as YAML rather than scanned. */
function commandLines(yaml) {
  const out = []
  for (const phase of Object.values(parseYaml(yaml)?.phases ?? {})) {
    for (const command of phase?.commands ?? []) out.push(...String(command).split('\n'))
  }
  return out
}

/** The `node -e '…'` script on the first command line carrying `marker`. */
function embeddedScript(yaml, marker) {
  const line = commandLines(yaml).find((l) => l.includes(marker) && l.includes("node -e '"))
  assert.ok(line !== undefined, `no command line carries ${marker} and a node -e script`)
  const open = line.indexOf("node -e '")
  const close = line.lastIndexOf("'")
  assert.ok(open !== -1 && close > open, `could not extract the script beside ${marker}`)
  return line.slice(open + "node -e '".length, close)
}

/** Run an extracted script in a scratch directory holding `files`. */
async function runScript(script, files, env) {
  const dir = await mkdtemp(join(tmpdir(), 'reconcile-run-worker-'))
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), typeof body === 'string' ? body : JSON.stringify(body))
  }
  const run = spawnSync(process.execPath, ['-e', script], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return { ...run, dir }
}

function deployStageActions() {
  const pipelines = resourcesOfType(templates[PIPELINE], 'AWS::CodePipeline::Pipeline')
  assert.equal(pipelines.length, 1, `expected exactly one pipeline, found ${pipelines.length}`)
  const stage = (pipelines[0][1].Properties?.Stages ?? []).find((s) => s.Name === 'Deploy')
  assert.ok(stage !== undefined, 'the pipeline has no Deploy stage')
  return stage.Actions ?? []
}

// ─────────────────────────────────────────── §1 · RunQueue is not left out

/**
 * 🛑 §1 — RED IF `RunQueue` IS LEFT OUT. The Deploy stage carries an action
 * whose project names the `RunQueue` stack the app actually synthesises, and
 * it runs strictly after `UpdateServices`.
 */
test('test_the_deploy_stage_retags_the_run_queue_stack_after_the_planes', () => {
  const actions = deployStageActions()
  const retag = actions.find((a) => a.Name === 'RetagRunWorker')
  assert.ok(
    retag !== undefined,
    'the Deploy stage has no RetagRunWorker action, so RunQueue is left out of every ' +
      'deploy and the run worker lags the planes by construction — the 2 Oct 2026 ' +
      'finding (G2961), reinstated.',
  )
  const update = actions.find((a) => a.Name === 'UpdateServices')
  assert.ok(update !== undefined, 'the Deploy stage has no UpdateServices action')
  assert.ok(
    Number.isFinite(retag.RunOrder) && Number.isFinite(update.RunOrder),
    'both actions must carry an explicit RunOrder',
  )
  assert.ok(
    retag.RunOrder > update.RunOrder,
    `RetagRunWorker runs at ${retag.RunOrder} and UpdateServices at ${update.RunOrder}. ` +
      'The worker must take an image ONLY after the planes — the half a health check ' +
      'and a circuit breaker judge — have proved it (G2963).',
  )
  assert.equal(
    JSON.stringify(retag.Configuration?.ProjectName),
    JSON.stringify({ Ref: retagProject().logicalId }),
    'RetagRunWorker does not run the retag project',
  )

  const named = envOf(retagProject().resource, 'RUN_QUEUE_STACK_NAME')
  assert.ok(RUN_QUEUE in templates, `the app no longer synthesises ${RUN_QUEUE}`)
  assert.equal(named, RUN_QUEUE, 'the retag names a stack the app does not synthesise')
})

/**
 * The family and the rule the settle step reads are the ones `RunQueue`
 * actually declares — one spelling (G2962), checked against the artefact.
 */
test('test_the_family_and_rule_the_retag_settles_on_are_the_ones_run_queue_declares', () => {
  const rq = templates[RUN_QUEUE]
  const families = resourcesOfType(rq, 'AWS::ECS::TaskDefinition').map(([, r]) => r.Properties?.Family)
  const rules = resourcesOfType(rq, 'AWS::Events::Rule').map(([, r]) => r.Properties?.Name)
  assert.deepEqual(families, [envOf(retagProject().resource, 'RUN_WORKER_TASK_FAMILY')])
  assert.deepEqual(rules, [envOf(retagProject().resource, 'RUN_WORKER_RULE_NAME')])
})

// ───────────────────────────── §2 · the BUILT tag, and exactly CDK's own output

/**
 * 🛑 §2 — RED IF `RunQueue` IS RETAGGED TO A TAG OTHER THAN THE BUILT ONE.
 *
 * The tag the retag writes is `tag.txt`, and `tag.txt` is written ONLY after
 * the registry resolved `image-tag.txt` to `image-digest.txt` — the Build
 * stage's two outputs. A retag fed any other value, or a `tag.txt` written
 * before the digest check, is red here.
 */
test('test_the_retag_writes_the_built_tag_and_only_after_the_registry_vouches_for_it', () => {
  const yaml = retagSpec()
  const lines = commandLines(yaml)
  const at = (re) => {
    const i = lines.findIndex((l) => re.test(l))
    assert.ok(i !== -1, `the retag buildspec has no line matching ${re}`)
    return i
  }
  const readTag = at(/TAG="\$\(tr -d " \\n" < "\$CODEBUILD_SRC_DIR\/image-tag\.txt"\)"/)
  const lookup = at(/aws ecr describe-images .*--repository-name "\$PLANE_REPOSITORY_NAME" --image-ids imageTag="\$TAG"/)
  const compare = at(/if \[ "\$TAGGED_DIGEST" != "\$DIGEST" \]/)
  const write = at(/echo "\$TAG" > tag\.txt/)
  assert.ok(readTag < lookup && lookup < compare && compare < write, 'tag.txt is written before the registry check')

  const retagLine = lines.find((l) => l.includes('REPOSITORY=') && l.includes("node -e '"))
  assert.ok(retagLine !== undefined, 'no retag invocation found')
  assert.match(
    retagLine,
    /^\s*TAG="\$TAG" REPOSITORY="\$PLANE_REPOSITORY_NAME" node -e '/,
    'the retag is not fed the tag read back from tag.txt',
  )
  /* Every assignment to TAG in the build phase is a read of tag.txt. */
  const build = parseYaml(yaml).phases.build.commands.join('\n').split('\n')
  const assignments = build.filter((x) => /^\s*TAG=("[^"]*"|\S+)\s*$/.test(x))
  assert.ok(assignments.length >= 2, 'no standalone TAG assignment found in the build phase')
  for (const l of assignments) {
    assert.match(l, /^\s*TAG="\$\(cat tag\.txt\)"$/, `the build phase sets TAG from somewhere else: ${l}`)
  }
})

/**
 * 🛑 §2b — the retag over `RunQueue` at one typed-in tag is BYTE-FOR-BYTE what
 * CDK synthesises at the other, so G2042's `cdk diff` control survives for this
 * stack too — and the settle script refuses a revision on any other tag.
 */
test('test_the_run_queue_retag_is_exactly_what_cdk_synthesises_for_the_built_tag', async () => {
  const atA = synthesisedTemplates({ planeImageTag: TAG_A })[RUN_QUEUE]
  const atB = synthesisedTemplates({ planeImageTag: TAG_B })[RUN_QUEUE]
  assert.notDeepStrictEqual(atA, atB, 'RunQueue is identical at two tags; this test would pass a no-op')

  const run = await runScript(embeddedScript(retagSpec(), 'REPOSITORY='), { 'template-current.json': atA }, {
    TAG: TAG_B,
    REPOSITORY: PLANE_REPOSITORY,
  })
  assert.equal(run.status, 0, `the retag refused RunQueue:\n${run.stderr}`)
  const produced = readFileSync(join(run.dir, 'template-next.json'), 'utf8')
  assert.equal(produced, JSON.stringify(atB), 'the RunQueue retag is NOT what cdk synth produces at the new tag')
  assert.match(run.stdout, /retagged 1 container image\(s\)/)
  assert.notEqual(produced, JSON.stringify(synthesisedTemplates({ planeImageTag: TAG_C })[RUN_QUEUE]))
})

/** The retag script is THE SAME script `Deploy` runs on `Planes`, byte for byte. */
test('test_the_run_worker_retag_shares_the_planes_retag_and_readiness_scripts', () => {
  for (const marker of ['REPOSITORY=', 'stack-describe.json']) {
    assert.equal(
      embeddedScript(retagSpec(), marker),
      embeddedScript(deploySpec(), marker),
      `the RunQueue and Planes buildspecs carry different ${marker} scripts — two spellings of one refusal (§5.3)`,
    )
  }
})

// ─────────────────────────────────────────── §3 · the post-condition

const OWNED = 'arn:aws:ecs:us-west-2:000000000000:task-definition/reconcile-staging-run-worker:9'
const taskDefinition = (tag, arn = OWNED) => ({
  taskDefinition: {
    taskDefinitionArn: arn,
    containerDefinitions: [{ name: 'run-worker', image: `000000000000.dkr.ecr.us-west-2.amazonaws.com/${PLANE_REPOSITORY}:${tag}` }],
  },
})
const targets = (arn = OWNED) => ({ Targets: [{ Id: 'Target0', EcsParameters: { TaskDefinitionArn: arn } }] })

/**
 * 🛑 §3 — THE SETTLE STEP REFUSES A REGISTERED REVISION ON ANY OTHER TAG, AND A
 * SCHEDULE STILL FIRING AN OLD REVISION. Those are the two facts the audit
 * found false; a green stage over either is the defect reported as a success.
 */
test('test_the_settle_step_refuses_a_revision_on_another_tag_and_a_schedule_on_an_old_revision', async () => {
  const line = commandLines(retagSpec())
    .filter((l) => l.includes("node -e '") && l.includes('REPOSITORY='))
    .at(-1)
  assert.ok(line !== undefined, 'no settle script found')
  const src = line.slice(line.indexOf("node -e '") + "node -e '".length, line.lastIndexOf("'"))
  assert.match(src, /targets\.json/, 'the last REPOSITORY= script is not the settle step')

  const env = { TAG: TAG_B, REPOSITORY: PLANE_REPOSITORY }
  const ok = await runScript(src, {
    'owned-task-definition.txt': OWNED,
    'task-definition.json': taskDefinition(TAG_B),
    'targets.json': targets(),
  }, env)
  assert.equal(ok.status, 0, `the settle step refused a correct worker:\n${ok.stderr}`)

  const stale = await runScript(src, {
    'owned-task-definition.txt': OWNED,
    'task-definition.json': taskDefinition('cc58f357cc58f357cc58f357cc58f357cc58f357'),
    'targets.json': targets(),
  }, env)
  assert.notEqual(stale.status, 0, 'the settle step passed a worker revision on a tag other than the built one')
  assert.match(stale.stderr, /G2961/)

  const oldSchedule = await runScript(src, {
    'owned-task-definition.txt': OWNED,
    'task-definition.json': taskDefinition(TAG_B),
    'targets.json': targets(OWNED.replace(/:9$/, ':8')),
  }, env)
  assert.notEqual(oldSchedule.status, 0, 'the settle step passed a schedule still firing the old revision')
})

/** G2964 — a stack with no service role is refused before anything is written. */
test('test_a_stack_with_no_service_role_is_refused_before_the_update', async () => {
  const line = commandLines(retagSpec()).find((l) => l.includes("node -e '") && l.includes('RoleARN'))
  assert.ok(line !== undefined, 'the retag buildspec does not check for a stack service role')
  const src = line.slice(line.indexOf("node -e '") + "node -e '".length, line.lastIndexOf("'"))
  const without = await runScript(src, { 'stack-describe.json': { Stacks: [{ StackName: RUN_QUEUE }] } }, {})
  assert.notEqual(without.status, 0, 'a stack with no service role was accepted')
  const withRole = await runScript(
    src,
    { 'stack-describe.json': { Stacks: [{ StackName: RUN_QUEUE, RoleARN: 'arn:aws:iam::1:role/cdk-x' }] } },
    {},
  )
  assert.equal(withRole.status, 0, withRole.stderr)

  const lines = commandLines(retagSpec())
  const check = lines.findIndex((l) => l.includes('RoleARN'))
  const update = lines.findIndex((l) => l.includes('aws cloudformation update-stack'))
  assert.ok(check !== -1 && update !== -1 && check < update, 'the service-role check runs after update-stack')
})

// ─────────────────────────────────────────── §4 · the fence

function policyActions(projectLogicalId) {
  const role = resourcesOfType(templates[PIPELINE], 'AWS::CodeBuild::Project').find(
    ([id]) => id === projectLogicalId,
  )[1].Properties.ServiceRole
  const roleId = role['Fn::GetAtt']?.[0]
  assert.ok(roleId, `cannot resolve the service role of ${projectLogicalId}`)
  const statements = []
  for (const [, p] of resourcesOfType(templates[PIPELINE], 'AWS::IAM::Policy')) {
    if ((p.Properties?.Roles ?? []).some((r) => r?.Ref === roleId)) {
      statements.push(...(p.Properties?.PolicyDocument?.Statement ?? []))
    }
  }
  assert.ok(statements.length > 0, `no policy found for ${projectLogicalId}`)
  return statements
}

/**
 * 🛑 §4 — ONE STACK EACH, AND NEITHER ROLE CAN NAME THE OTHER'S. No `PassRole`
 * on the retag role, no `CreateStack`/`DeleteStack`.
 */
test('test_the_retag_role_may_update_only_run_queue_and_deploy_may_update_only_planes', () => {
  const cfnResources = (statements) =>
    statements
      .filter((s) => [s.Action ?? []].flat().includes('cloudformation:UpdateStack'))
      .flatMap((s) => [s.Resource ?? []].flat())
      .map((r) => JSON.stringify(r))

  const retag = policyActions(retagProject().logicalId)
  const deploy = policyActions(project('reconcile-deploy-').logicalId)

  const retagTargets = cfnResources(retag)
  assert.equal(retagTargets.length, 1, `the retag role may UpdateStack on ${retagTargets.length} resources`)
  assert.match(retagTargets[0], new RegExp(`stack/${RUN_QUEUE}/\\*`))
  assert.doesNotMatch(retagTargets[0], /planes/)

  for (const r of cfnResources(deploy)) {
    assert.doesNotMatch(r, /run-queue/, 'the Deploy role may write RunQueue; G2223 keeps the roles apart')
  }

  const verbs = new Set(retag.flatMap((s) => [s.Action ?? []].flat()))
  for (const forbidden of [
    'iam:PassRole',
    'cloudformation:CreateStack',
    'cloudformation:DeleteStack',
    'ecs:UpdateService',
    'ecs:RegisterTaskDefinition',
    's3:PutObject',
    's3:DeleteObject',
  ]) {
    assert.ok(!verbs.has(forbidden), `the retag role holds ${forbidden}`)
  }
  for (const s of retag) {
    if ([s.Resource ?? []].flat().includes('*')) {
      assert.deepEqual(
        [s.Action ?? []].flat(),
        ['ecs:DescribeTaskDefinition'],
        `only DescribeTaskDefinition may take Resource "*": ${JSON.stringify(s.Action)}`,
      )
    }
  }
})

// ─────────────────────────────────────────── §5 · the ceilings

test('test_the_run_queue_template_fits_inline_and_the_buildspec_fits_codebuild', () => {
  /* Typed in, not imported: comparing a template to the constant it was
   * measured with proves a variable equals itself. */
  const CLOUDFORMATION_INLINE = 51200
  const CODEBUILD_INLINE = 25600
  const rq = Buffer.byteLength(JSON.stringify(templates[RUN_QUEUE]), 'utf8')
  assert.ok(rq <= CLOUDFORMATION_INLINE, `RunQueue is ${rq} bytes minified`)
  const spec = retagSpec().length
  assert.ok(spec <= CODEBUILD_INLINE, `the retag buildspec is ${spec} characters`)
  assert.ok(deploySpec().length <= CODEBUILD_INLINE, 'the Deploy buildspec grew past the ceiling')
})

test('test_the_retag_timeout_exceeds_its_own_worst_case_waiter_budget', () => {
  const rounds = Number(envOf(retagProject().resource, 'STACK_UPDATE_WAIT_ROUNDS'))
  assert.ok(rounds > 0, 'STACK_UPDATE_WAIT_ROUNDS read as 0')
  const CLOUDFORMATION_WAITER_MINUTES = 60
  const HEADROOM_MINUTES = 15
  const floor = rounds * CLOUDFORMATION_WAITER_MINUTES + HEADROOM_MINUTES
  const timeout = retagProject().resource.Properties.TimeoutInMinutes
  assert.ok(timeout >= floor, `the retag may wait ${floor - HEADROOM_MINUTES} min and its timeout is ${timeout}`)
})

test('test_a_rerun_on_an_unchanged_commit_is_success_and_nothing_is_cancelled', () => {
  const yaml = retagSpec()
  assert.match(yaml, /grep -q "No updates are to be performed" update\.err/)
  assert.match(yaml, /FATAL: update-stack on \$RUN_QUEUE_STACK_NAME exited \$UPDATE_STATUS/)
  const executable = commandLines(yaml).filter((l) => !/^\s*#/.test(l)).join('\n')
  assert.doesNotMatch(executable, /aws cloudformation cancel-update-stack/)
})

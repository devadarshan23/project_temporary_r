/**
 * G253's CREDENTIAL FENCE, WITNESSED RED — plus G252's architecture and G263's
 * "never a plain environment entry".
 *
 * 🛑 THE FIRST SECTION IS THE LOAD-BEARING ONE AND IT IS A SECURITY PROPERTY,
 * NOT A CONVENIENCE. G253, verbatim:
 *
 *     "the migrate run-tasks are the ONLY principals granted the migrator
 *      secret; the services are granted the app-role secret and nothing else —
 *      the split becomes a property of the account rather than a property of a
 *      file."
 *
 * `server/data-plane/main.ts` held the cluster superuser and `LOGIN BYPASSRLS`
 * for its entire life until 16 Aug 2026; that is recorded as a defect, and
 * `compose.yaml` fixed it locally by shortening an `environment:` block. An
 * environment block is a list somebody adds a line back to. This suite asks the
 * same question of the TEMPLATE, which is the account.
 *
 * ⚠️ AND IT IS WITNESSED FAILING. `infra/test-fixtures/planes-migrator-leak.ts`
 * grants the migrator secret to the data plane's SERVICE task role — one line,
 * in the shape a contributor would write by accident — and section 1b requires
 * this analysis to SEE it. An analysis that reported nothing would pass section
 * 1a silently and assert nothing at all (`docs/HANDOFF.md` §5.6).
 *
 * ⚠️ NO CONSTANT BELOW IS IMPORTED FROM `infra/`. Every expected ARN, role name
 * and environment-variable name is typed into this file, for the reason
 * `tests/infra/tagging.test.mjs` and `tests/ci/gate.test.ts` both state at
 * their heads: comparing a control's output to the same constant the control
 * read is a comparison that passes when both sides are empty.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, runInfraScript, resourcesOfType } from './support.mjs'

await ensureDeps()

const STACK = 'reconcile-planes-staging'

/** The five stub credentials, typed out. `infra/test-fixtures/planes-stubs.ts` mints them. */
const SECRET = {
  dataAdmin: 'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/data/admin-AAAAAA',
  dataMigrator:
    'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/data/migrator-BBBBBB',
  dataApp: 'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/data/app-CCCCCC',
  /* G3861 — `reconcile_engine`, the run worker's credential (`db/migrations/0500`). */
  dataEngine:
    'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/data/engine-GGGGGG',
  controlAdmin:
    'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/control/admin-DDDDDD',
  controlApp: 'arn:aws:secretsmanager:us-west-2:000000000000:secret:fixture/control/app-EEEEEE',
}

/** The eight roles, by the names `lib/planes-stack.ts` gives them. */
const ROLE = {
  dataServiceExec: 'reconcile-staging-data-service-exec',
  dataServiceTask: 'reconcile-staging-data-service-task',
  controlServiceExec: 'reconcile-staging-control-service-exec',
  controlServiceTask: 'reconcile-staging-control-service-task',
  dataMigrateExec: 'reconcile-staging-data-migrate-exec',
  dataMigrateTask: 'reconcile-staging-data-migrate-task',
  controlMigrateExec: 'reconcile-staging-control-migrate-exec',
  controlMigrateTask: 'reconcile-staging-control-migrate-task',
}

const SERVICE_ROLES = [
  ROLE.dataServiceExec,
  ROLE.dataServiceTask,
  ROLE.controlServiceExec,
  ROLE.controlServiceTask,
]

function templateFrom(fixture) {
  const run = runInfraScript(`test-fixtures/${fixture}`)
  assert.equal(run.status, 0, `${fixture} exited ${run.status}: ${run.stderr || run.stdout}`)
  const templates = JSON.parse(run.stdout)
  const template = templates[STACK]
  assert.ok(template, `${fixture} synthesised no stack named ${STACK}`)
  return template
}

/**
 * WHICH ROLES CAN READ THIS SECRET — the one question this suite exists to ask.
 *
 * 🛑 IT WALKS EXECUTION ROLES AS WELL AS TASK ROLES, AND THAT IS NOT PEDANTRY.
 * An ECS task **secret** is fetched by the task's EXECUTION role before the
 * container starts; the task role never touches it. A fence written over task
 * roles alone would be a fence over the principal that is not involved, which
 * is `docs/HANDOFF.md` §5's standing finding — a rule keyed on a convenient
 * landmark instead of the property it protects.
 */
function rolesThatCanRead(template, secretArn) {
  const roleNameByLogicalId = new Map()
  for (const [logicalId, resource] of resourcesOfType(template, 'AWS::IAM::Role')) {
    const name = resource.Properties?.RoleName
    assert.ok(
      typeof name === 'string',
      `role ${logicalId} has no explicit RoleName; this analysis finds roles by name ` +
        'so that a renamed construct cannot silently drop out of the fence',
    )
    roleNameByLogicalId.set(logicalId, name)
  }

  const readers = new Set()
  const mentions = (document) => JSON.stringify(document ?? {}).includes(secretArn)

  // Inline policies declared on the role itself.
  for (const [logicalId, resource] of resourcesOfType(template, 'AWS::IAM::Role')) {
    if (mentions(resource.Properties?.Policies)) readers.add(roleNameByLogicalId.get(logicalId))
  }

  // Standalone AWS::IAM::Policy resources attached to one or more roles.
  for (const [, resource] of resourcesOfType(template, 'AWS::IAM::Policy')) {
    if (!mentions(resource.Properties?.PolicyDocument)) continue
    for (const role of resource.Properties?.Roles ?? []) {
      const logicalId = role?.Ref
      if (logicalId && roleNameByLogicalId.has(logicalId)) {
        readers.add(roleNameByLogicalId.get(logicalId))
      }
    }
  }

  return [...readers].sort()
}

const green = templateFrom('planes-stack.ts')

// ------------------------------------ 1a. the fence, on the real stack

test('test_the_migrator_secret_is_readable_only_by_the_data_migrate_task_definitions_execution_role', () => {
  assert.deepEqual(
    rolesThatCanRead(green, SECRET.dataMigrator),
    [ROLE.dataMigrateExec],
    'G253: the migrate run-tasks are the ONLY principals granted the migrator secret. ' +
      'reconcile_migrator is LOGIN BYPASSRLS — the read exemption every isolation ' +
      'assertion in tests/ is relative to.',
  )
})

test('test_the_two_admin_superuser_secrets_are_readable_only_by_their_own_migrate_task', () => {
  assert.deepEqual(
    rolesThatCanRead(green, SECRET.dataAdmin),
    [ROLE.dataMigrateExec],
    'PGPASSWORD is the cluster superuser, consumed implicitly by adminClient(). ' +
      'A listener that holds it can CREATE ROLE.',
  )
  assert.deepEqual(
    rolesThatCanRead(green, SECRET.controlAdmin),
    [ROLE.controlMigrateExec],
    'The control admin owns every table the serving process reads — a serving ' +
      'process holding it could rewrite the catalogue it publishes downward to the ' +
      'whole fleet, which is a supply-chain write.',
  )
})

test('test_no_service_role_of_either_plane_can_read_any_migrator_or_admin_secret', () => {
  for (const [label, arn] of [
    ['migrator', SECRET.dataMigrator],
    ['data admin', SECRET.dataAdmin],
    ['control admin', SECRET.controlAdmin],
  ]) {
    for (const role of rolesThatCanRead(green, arn)) {
      assert.equal(
        SERVICE_ROLES.includes(role),
        false,
        `${role} — a SERVING plane's role — can read the ${label} secret. This is the ` +
          'defect of 16 Aug 2026 recreated in IAM.',
      )
    }
  }
})

test('test_each_planes_app_role_secret_reaches_that_plane_only', () => {
  assert.deepEqual(
    rolesThatCanRead(green, SECRET.dataApp),
    [ROLE.dataMigrateExec, ROLE.dataServiceExec].sort(),
    'The data plane serves as reconcile_app; the migrate job SETS that password ' +
      '(createRoles issues ALTER ROLE … PASSWORD), which is why it holds it too. ' +
      'No control-plane role appears.',
  )
  assert.deepEqual(
    rolesThatCanRead(green, SECRET.controlApp),
    [ROLE.controlMigrateExec, ROLE.controlServiceExec].sort(),
    'Invariant 3: no data-plane role may reach a control credential and no ' +
      'control-plane role may reach a data one.',
  )
})

// ------------------------- 1a'. G3861 — the engine credential, never a listener

test('test_the_engine_secret_is_readable_only_by_the_data_migrate_execution_role', () => {
  /* 🛑 G3861, discharging G3749. `reconcile_engine` holds `INSERT` on
   * `tenant.exception` (`db/migrations/0500` §1) — the privilege `0015`
   * refused every request path, because a serving process that could INSERT
   * an exception could mint a finding against itself. In THIS stack the only
   * principal that may fetch it is the DATA MIGRATE task's execution role,
   * which needs it because `createRoles()` SETS the role's password. The
   * process that authenticates with it is the run worker, in `RunQueue`, and
   * `tests/infra/run-queue.test.mjs` asserts that half. */
  assert.deepEqual(
    rolesThatCanRead(green, SECRET.dataEngine),
    [ROLE.dataMigrateExec],
    'the engine credential reaches a role other than the data migrate task. The serving ' +
      'data plane must NEVER hold it (0015, 0500 §1); no control-plane role may either.',
  )
})

test('test_the_same_analysis_SEES_the_engine_secret_granted_to_the_serving_data_plane', () => {
  /* The red witness for the assertion above — a `RECONCILE_ENGINE_PASSWORD`
   * on the service would be exactly this execution-role grant. Without it,
   * an analysis that matched nothing would pass the assertion above silently
   * (`docs/HANDOFF.md` §5.6). */
  const readers = rolesThatCanRead(templateFrom('planes-engine-leak.ts'), SECRET.dataEngine)
  assert.ok(
    readers.includes(ROLE.dataServiceExec),
    `the red witness granted the engine secret to the data SERVICE execution role and the ` +
      `analysis did not see it; readers=${JSON.stringify(readers)}`,
  )
})

// ---------------------------------------- 1b. THE RED WITNESS, same analysis

test('test_the_same_analysis_SEES_a_migrator_grant_added_to_a_service_role', () => {
  /* 🛑 THE HALF THAT MAKES THE HALF ABOVE MEAN ANYTHING. If this analysis
   * returned an empty set for every secret — a typo in an ARN, a template shape
   * it cannot walk, a `resourcesOfType` that matches nothing — every assertion
   * in 1a would pass and the fence would be asserted by nothing. The leak
   * fixture differs from the positive control in ONE line. */
  const leaked = templateFrom('planes-migrator-leak.ts')
  const readers = rolesThatCanRead(leaked, SECRET.dataMigrator)

  assert.ok(
    readers.includes(ROLE.dataServiceTask),
    'the red witness granted the migrator secret to the data plane SERVICE task ' +
      `role and this analysis did not see it; readers=${JSON.stringify(readers)}`,
  )

  assert.notDeepEqual(
    readers,
    [ROLE.dataMigrateExec],
    'the leaked template must NOT satisfy the assertion 1a makes of the clean one',
  )
})

// ------------------------------------------------- 2. G252 — ARM64, Fargate

test('test_all_four_task_definitions_are_arm64_linux_and_fargate', () => {
  const taskDefinitions = resourcesOfType(green, 'AWS::ECS::TaskDefinition')
  assert.equal(
    taskDefinitions.length,
    4,
    'compose.yaml has four application services — two listeners and two one-shot ' +
      'migrate jobs — and the mapping is one-to-one (tech-stack.md 7)',
  )

  for (const [logicalId, resource] of taskDefinitions) {
    const platform = resource.Properties?.RuntimePlatform ?? {}
    assert.equal(
      platform.CpuArchitecture,
      'ARM64',
      `${logicalId} is not ARM64. G252: every compute resource this product runs on ` +
        'is 64-bit ARM.',
    )
    assert.equal(platform.OperatingSystemFamily, 'LINUX', `${logicalId} is not LINUX`)
    assert.ok(
      (resource.Properties?.RequiresCompatibilities ?? []).includes('FARGATE'),
      `${logicalId} is not FARGATE-compatible (G253)`,
    )
    assert.equal(
      resource.Properties?.NetworkMode,
      'awsvpc',
      `${logicalId} must be awsvpc or a security group cannot be attached to it, and ` +
        'the security-group pair is what replaces compose.yaml two networks',
    )
  }
})

test('test_exactly_two_of_the_four_task_definitions_have_a_service_and_the_migrate_ones_do_not', () => {
  const services = resourcesOfType(green, 'AWS::ECS::Service')
  assert.equal(services.length, 2, 'two listeners, two services')

  const taskDefinitionsWithAService = new Set()
  for (const [, service] of services) {
    const ref = service.Properties?.TaskDefinition?.Ref
    assert.ok(ref, 'a service must reference a task definition in this stack')
    taskDefinitionsWithAService.add(ref)
  }

  /* compose.yaml spells `restart: "no"` on the two migrate jobs explicitly and
   * says why: "a restart policy on a job that is supposed to terminate turns a
   * one-shot into a process that holds these credentials forever, which is the
   * thing being fixed." The AWS spelling of that is the ABSENCE of a service. */
  for (const [logicalId] of resourcesOfType(green, 'AWS::ECS::TaskDefinition')) {
    if (!taskDefinitionsWithAService.has(logicalId)) continue
    const rolesReadingMigrator = rolesThatCanRead(green, SECRET.dataMigrator)
    assert.equal(
      rolesReadingMigrator.length,
      1,
      'a task definition that has a service must not be one that holds the migrator secret',
    )
  }
  assert.equal(taskDefinitionsWithAService.size, 2)
})

// ----------------------------- 3. G263 — secrets are secrets, never environment

function containerDefinitions(template) {
  const out = []
  for (const [logicalId, resource] of resourcesOfType(template, 'AWS::ECS::TaskDefinition')) {
    for (const container of resource.Properties?.ContainerDefinitions ?? []) {
      out.push([logicalId, container])
    }
  }
  return out
}

test('test_no_credential_appears_in_a_plain_environment_entry_on_any_container', () => {
  const CREDENTIAL_SHAPED = /PASSWORD|SECRET|PGPASSWORD|TOKEN|CREDENTIAL/i

  for (const [logicalId, container] of containerDefinitions(green)) {
    for (const entry of container.Environment ?? []) {
      assert.doesNotMatch(
        entry.Name,
        CREDENTIAL_SHAPED,
        `${logicalId}/${container.Name} carries ${entry.Name} as a PLAIN environment ` +
          'entry. G263: injected as ECS task secrets — never baked into an image, ' +
          'never written to a .env, never in a task definition plain environment.',
      )
      assert.equal(
        typeof entry.Value === 'string' && entry.Value.includes('arn:aws:secretsmanager'),
        false,
        `${logicalId}/${container.Name} puts a Secrets Manager ARN in a plain environment value`,
      )
    }
  }
})

test('test_every_credential_the_planes_read_arrives_through_the_Secrets_block', () => {
  const byName = new Map()
  for (const [, container] of containerDefinitions(green)) {
    for (const secret of container.Secrets ?? []) {
      byName.set(`${container.Name}:${secret.Name}`, secret.ValueFrom)
    }
  }

  /* The names are `server/`'s, not this file's: `db/env.ts` reads
   * RECONCILE_APP_PASSWORD and RECONCILE_MIGRATOR_PASSWORD, `db/provision.ts`
   * consumes PGPASSWORD implicitly, and `server/control-plane/provision.ts`
   * reads the two RECONCILE_CONTROL_* ones. */
  for (const expected of [
    'data-plane:RECONCILE_APP_PASSWORD',
    'data-plane-migrate:PGPASSWORD',
    'data-plane-migrate:RECONCILE_MIGRATOR_PASSWORD',
    'data-plane-migrate:RECONCILE_APP_PASSWORD',
    'control-plane:RECONCILE_CONTROL_APP_PASSWORD',
    'control-plane-migrate:RECONCILE_CONTROL_DB_ADMIN_PASSWORD',
    'control-plane-migrate:RECONCILE_CONTROL_APP_PASSWORD',
    /* G3861 — `createRoles()` sets `reconcile_engine`'s password only when
     * `enginePassword()` answers; without this the role has no password and
     * the run worker cannot authenticate as it. */
    'data-plane-migrate:RECONCILE_ENGINE_PASSWORD',
  ]) {
    assert.ok(byName.has(expected), `${expected} is not injected as an ECS task secret`)
  }

  /* 🛑 G3861 — the serving planes hold the engine credential by NO route. */
  for (const forbidden of [
    'data-plane:RECONCILE_ENGINE_PASSWORD',
    'control-plane:RECONCILE_ENGINE_PASSWORD',
    'control-plane-migrate:RECONCILE_ENGINE_PASSWORD',
  ]) {
    assert.equal(
      byName.has(forbidden),
      false,
      `${forbidden} is injected. reconcile_engine may INSERT into tenant.exception ` +
        '(db/migrations/0500 §1); a serving process holding it could mint findings against ' +
        'itself, which is 0015`s refusal. Only the data migrate task and the run worker hold it.',
    )
  }

  assert.equal(
    byName.has('data-plane:RECONCILE_MIGRATOR_PASSWORD'),
    false,
    'the serving data plane must not be handed the migrator password by any route',
  )
  assert.equal(
    byName.has('data-plane:PGPASSWORD'),
    false,
    'the serving data plane must not be handed the superuser password by any route',
  )

  /**
   * 🛑 THE CROSS-PLANE CREDENTIAL FENCE — G1282, AND IT IS HERE BECAUSE A
   * COMMENT IN `infra/lib/planes-stack.ts` BRIEFLY CLAIMED A `grep` HELD IT.
   *
   * That comment said `grep -c 'RECONCILE_CONTROL_APP_PASSWORD'
   * infra/lib/planes-stack.ts` *"returns 1, and that one is on the control
   * MIGRATE container"*. **It returns 5, and the variable really is set
   * twice** — on the control plane's SERVICE and on its MIGRATE task. A file
   * count cannot see WHICH CONTAINER a value lands on, so it was §5.1 wearing
   * a `grep`; this is the property stated where it can actually be checked.
   *
   * `db/control-read-scope.ts` is the argument: a data plane handed
   * `RECONCILE_CONTROL_APP_PASSWORD` *"would authenticate as the role that
   * reads every table in this database"* — so every later
   * `GRANT … TO reconcile_control_app` would widen the cross-plane read
   * retroactively and silently. The reader role is granted ONE table, a line
   * at a time, in `db/migrations-control/`.
   */
  for (const forbidden of [
    /* G4320 — retired 5 Oct 2026, THE OWNER'S "Full restore" ruling: the data
       plane holds NO control-database credential, the reader's included. */
    'data-plane:RECONCILE_CONTROL_READ_PASSWORD',
    'control-plane-migrate:RECONCILE_CONTROL_READ_PASSWORD',
    'data-plane:RECONCILE_CONTROL_APP_PASSWORD',
    'data-plane:RECONCILE_CONTROL_DB_ADMIN_PASSWORD',
    'data-plane-migrate:RECONCILE_CONTROL_APP_PASSWORD',
    'data-plane-migrate:RECONCILE_CONTROL_DB_ADMIN_PASSWORD',
  ]) {
    assert.equal(
      byName.has(forbidden),
      false,
      `${forbidden} is injected. G1161 gave the data plane a credential for the CONTROL ` +
        'database — `reconcile_control_reader` — and G4320 retired it on 5 Oct 2026; the data ' +
        'plane now reaches the roster only over the control plane`s signed internal tier. ' +
        'Any control-database credential on this plane is a widening nobody decided.',
    )
  }

  /* The other direction, unchanged by G1282 and asserted so it stays that
   * way: no control-plane container may hold a DATA-plane credential. */
  for (const forbidden of [
    'control-plane:RECONCILE_APP_PASSWORD',
    'control-plane:RECONCILE_MIGRATOR_PASSWORD',
    'control-plane-migrate:RECONCILE_APP_PASSWORD',
    'control-plane-migrate:RECONCILE_MIGRATOR_PASSWORD',
    'control-plane-migrate:PGPASSWORD',
  ]) {
    assert.equal(
      byName.has(forbidden),
      false,
      `${forbidden} is injected. Invariant 3: the control plane publishes downward and ` +
        'never reads tenant data, and G1282 opened ONE direction only.',
    )
  }
})

test('test_the_local_test_auth_flag_appears_nowhere_in_the_template', () => {
  /* 🛑 G192's FENCE READ FROM THE OTHER SIDE. `compose.yaml` calls the flag's
   * absence from a real task definition "a thing an auditor can read". This is
   * the auditor reading it. A plane started without the flag never LOADS
   * `server/dev/test-token.ts` — the import is dynamic and conditional — so
   * there is no accepting code path in the process to bypass. */
  const serialised = JSON.stringify(green)
  assert.equal(
    serialised.includes('RECONCILE_LOCAL_TEST_AUTH'),
    false,
    'the local test-token flag is set somewhere in a deployed task definition',
  )
  assert.equal(serialised.includes('RECONCILE_LOCAL_TEST_SECRET'), false)
  assert.equal(
    serialised.includes('RECONCILE_DEV_SEED'),
    false,
    'RECONCILE_DEV_SEED seeds two fixture tenants; it belongs to a disposable local stack',
  )
  assert.equal(
    serialised.includes('RECONCILE_DEV_RESET'),
    false,
    'RECONCILE_DEV_RESET drops and rebuilds schema public — the one operation in ' +
      'compose.yaml that destroys data',
  )
})

// ------------------------------------------------- 4. G262, the task-definition half

test('test_every_container_has_a_read_only_root_filesystem_and_drops_all_capabilities', () => {
  const definitions = containerDefinitions(green)
  assert.equal(definitions.length, 4, 'one container per task definition')

  for (const [logicalId, container] of definitions) {
    assert.equal(
      container.ReadonlyRootFilesystem,
      true,
      `${logicalId}/${container.Name}: G262 — "a plane that needs to write to its own ` +
        'image is a defect, and the filesystem flag is what makes that a fact rather ' +
        'than an expectation."',
    )
    assert.deepEqual(
      container.LinuxParameters?.Capabilities?.Drop,
      ['ALL'],
      `${logicalId}/${container.Name} does not drop all Linux capabilities`,
    )
    assert.ok(
      (container.MountPoints ?? []).some((m) => m.ContainerPath === '/tmp'),
      `${logicalId}/${container.Name} has a read-only root and no writable /tmp`,
    )
  }
})

// --------------------------------------------------- 5. G261, the half that IS here

test('test_one_log_group_per_plane_with_retention_set_and_container_insights_on_the_cluster', () => {
  const groups = resourcesOfType(green, 'AWS::Logs::LogGroup')
  assert.equal(groups.length, 2, 'G261: one CloudWatch log group per plane per environment')

  const names = groups.map(([, g]) => g.Properties?.LogGroupName).sort()
  assert.deepEqual(names, ['/reconcile/staging/control-plane', '/reconcile/staging/data-plane'])

  for (const [logicalId, group] of groups) {
    assert.equal(
      typeof group.Properties?.RetentionInDays,
      'number',
      `${logicalId} has no retention. G261 requires it set in CDK.`,
    )
  }

  const clusters = resourcesOfType(green, 'AWS::ECS::Cluster')
  assert.equal(clusters.length, 1, 'tech-stack.md 7: one cluster, one VPC, per environment')
  const settings = clusters[0][1].Properties?.ClusterSettings ?? []
  assert.ok(
    settings.some((s) => s.Name === 'containerInsights' && s.Value !== 'disabled'),
    'G261: Container Insights on the cluster',
  )
})

test('test_the_two_planes_answer_on_their_own_listener_rather_than_on_a_path_prefix', () => {
  /* A path-prefix rule would be a fence keyed on a convenient landmark — the
   * defect shape docs/HANDOFF.md 5 calls the most common in this codebase — and
   * its failure mode is a control-plane request served by a data-plane task.
   * A listener has a default action and no match expression to drift. */
  const listeners = resourcesOfType(green, 'AWS::ElasticLoadBalancingV2::Listener')
  assert.equal(listeners.length, 2, 'one listener per plane')
  assert.deepEqual(
    listeners.map(([, l]) => l.Properties?.Port).sort((a, b) => a - b),
    [9070, 9080],
    'the two ports are compose.yaml two published ports',
  )

  assert.equal(
    resourcesOfType(green, 'AWS::ElasticLoadBalancingV2::ListenerRule').length,
    0,
    'no listener rule exists, so there is no match expression that can drift as the ' +
      'contracts grow',
  )

  /**
   * 🛑 TWO LOAD BALANCERS, NOT ONE, AND THIS ASSERTION USED TO DEMAND ONE.
   *
   * The first draft shared a single ALB across both planes, on the reasonable
   * ground that it routes HTTP, holds no credential and can reach no database,
   * so it cannot carry tenant data upward. `tests/infra/network.test.mjs`
   * refused it the moment the stack was instantiated for real:
   *
   *     INVARIANT 3: reconcile-staging-alb (Plane=shared) is admitted to
   *     reconcile-staging-data-tasks (Plane=data) on port 9080
   *
   * THAT TEST WAS RIGHT AND THE DESIGN WAS WRONG. G260 makes invariant 3
   * auditable from a TAG QUERY, and a `Plane=shared` group admitted to a
   * `Plane=data` group is precisely the shape the query exists to find. A
   * property that has to be explained away is not one anybody can check.
   *
   * Two ALBs, each in its plane's tag scope, and the fence holds trivially:
   * every security group in the product names one plane and no rule crosses.
   * G193's shape is two of everything; this completes it. The cost is one more
   * ALB in staging, which is the cheaper half of the trade.
   */
  const albs = resourcesOfType(green, 'AWS::ElasticLoadBalancingV2::LoadBalancer')
  assert.equal(albs.length, 2, 'one ALB per plane — see the block above')
  for (const [logicalId, alb] of albs) {
    assert.equal(
      alb.Properties?.Scheme,
      'internal',
      `tech-stack.md 7: ${logicalId} must be an INTERNAL ALB`,
    )
  }
})

// --------------------------- 6. G1012, the image tag nothing could silently reuse

test('test_the_stack_declares_no_image_tag_parameter_for_a_deploy_to_reuse_silently', () => {
  /* 🛑 THE ASSERTION IS AN ABSENCE, AND THE ABSENCE IS THE REPAIR. `cdk deploy`
   * sends UsePreviousValue:true for every parameter it is not given, and the
   * pipeline's Deploy stage registers a task definition by digest without ever
   * writing the parameter back — so the stack's value is as old as the last
   * cdk deploy and applying it is silent. Measured against AWS on 20 Sep 2026:
   * the parameter named a tag pushed on the 18th, the service ran one pushed on
   * the 20th, and the task definition CloudFormation owns was revision 1
   * against the service's revision 38. */
  const parameters = green.Parameters ?? {}
  assert.equal(
    parameters.PlaneImageTag,
    undefined,
    'PlaneImageTag is a CloudFormation parameter again. A parameter with no default is not ' +
      'a value that is missing - it is a value CloudFormation supplies FROM THE LAST DEPLOY, ' +
      'which is the channel G1012 removed. The tag comes from CDK context and is baked into ' +
      'the template, so cdk diff shows the image moving.',
  )
  assert.deepEqual(
    Object.keys(parameters).filter((k) => !k.startsWith('BootstrapVersion')),
    [],
    'no parameter of this stack may carry a deploy-time value a deploy can reuse without naming',
  )
})

test('test_both_plane_images_name_the_tag_that_was_supplied_and_all_four_task_definitions_agree', () => {
  const images = new Set()
  for (const [, taskDefinition] of resourcesOfType(green, 'AWS::ECS::TaskDefinition')) {
    for (const container of taskDefinition.Properties?.ContainerDefinitions ?? []) {
      images.add(JSON.stringify(container.Image))
    }
  }
  assert.equal(images.size, 1, `the four task definitions run one image; got ${[...images]}`)
  assert.ok(
    [...images][0].includes('synth-only-not-a-deployable-tag'),
    'the fixture is synthesised with the gate\'s sentinel tag, so the template must carry it ' +
      `rather than a Ref to a parameter: ${[...images][0]}`,
  )
})

test('test_synth_refuses_when_nobody_has_named_the_bytes_and_the_error_names_the_derivation', () => {
  /* THE RED WITNESS. Identical to `planes-stack.ts` but for an EMPTY context. */
  const run = runInfraScript('test-fixtures/planes-no-image-tag.ts', { CDK_CONTEXT_JSON: '{}' })
  assert.notEqual(run.status, 0, `Planes synthesised with no image tag: ${run.stdout}`)
  const message = `${run.stdout}${run.stderr}`
  assert.ok(
    message.includes('-c planeImageTag='),
    `the refusal must name the flag that supplies one: ${message}`,
  )
  assert.ok(
    message.includes('probe-deployed-image.mjs'),
    'the refusal must name the command that DERIVES the running tag, or the next operator ' +
      `guesses one - which is how the stack came to be two days behind: ${message}`,
  )
})

test('test_latest_and_a_truncated_sha_are_refused_and_only_a_commit_sha_is_taken', async () => {
  /* ⚠️ THE ONE PLACE THIS SUITE CALLS INTO `infra/lib/`, AND IT IS THE FUNCTION
   * UNDER TEST RATHER THAN A CONSTANT IT READ. Every other assertion here types
   * its expected value out; this one exercises a decision, and a decision
   * cannot be re-typed. */
  const { assertDeployablePlaneImageTag } = await import('../../infra/lib/config.ts')

  const sha = '56d9d053269f0bea14d74344f3e01b4b0f330148'
  assert.equal(assertDeployablePlaneImageTag(sha), sha)

  for (const bad of ['latest', 'main', '56d9d05', '', undefined, null, 'SYNTH-ONLY', `${sha}x`]) {
    assert.throws(
      () => assertDeployablePlaneImageTag(bad),
      /is not an image tag this stack will deploy|no image tag was supplied/,
      `'${String(bad)}' was accepted. 'latest' is the one to read: an IMMUTABLE repository will ` +
        'hold that tag happily and it names whichever bytes were pushed last, which is the ' +
        "property the old parameter's own header refused a DEFAULT for.",
    )
  }
})

test('test_cdk_json_declares_no_image_tag_so_the_previous_value_cannot_come_back_as_a_default', async () => {
  const { readFileSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const cdkJson = JSON.parse(readFileSync(join(repoRoot, 'infra', 'cdk.json'), 'utf8'))
  assert.equal(
    cdkJson.context?.planeImageTag,
    undefined,
    'a planeImageTag in cdk.json context is a DEFAULT, and a default restores exactly the ' +
      'silence the CfnParameter had - with a value no deploy ever names. The gate passes the ' +
      'sentinel on the command line for that reason.',
  )
})

// ------------------------------------------- 6. the scheduled shutdown

test('test_both_services_scale_to_zero_on_a_schedule_and_back_up_in_the_morning', () => {
  const targets = resourcesOfType(green, 'AWS::ApplicationAutoScaling::ScalableTarget')
  assert.equal(targets.length, 2, 'one scalable target per service')

  const actions = []
  for (const [, target] of targets) {
    assert.equal(
      target.Properties?.MinCapacity,
      0,
      'a target whose MinCapacity floor is above zero cannot be scheduled to zero',
    )
    for (const action of target.Properties?.ScheduledActions ?? []) actions.push(action)
  }

  assert.equal(actions.length, 4, 'two services, one down action and one up action each')

  const down = actions.filter((a) => a.ScalableTargetAction?.MaxCapacity === 0)
  assert.equal(down.length, 2, 'both services must have an action that takes them to zero')
  for (const action of down) {
    assert.equal(action.ScalableTargetAction?.MinCapacity, 0)
    assert.match(
      action.Schedule,
      /^cron\(/,
      'the shutdown must be a cron schedule, not a rate',
    )
  }

  const up = actions.filter((a) => (a.ScalableTargetAction?.MinCapacity ?? 0) > 0)
  assert.equal(up.length, 2, 'both services must have a morning action')
})

/**
 * §G2986 — THE DATA ALB PRESERVES `Host`, AND THE CONTROL IS WITNESSED RED.
 *
 * Measured on staging, 2 Oct 2026 (derived, NOT THE OWNER'S): the internal data
 * ALB's only listener is on a NON-DEFAULT port (9080), and with
 * `routing.http.preserve_host_header.enabled=false` AWS APPENDS THAT PORT to the
 * `Host` it forwards. The plane then received
 * `ten-acme.us-west-2.reconcileai.app:9080`, which no registry row matches —
 * `normaliseHost()` strips no port, deliberately — so G179's lookup, G180's
 * binding and the sign-in relay (G2549) all failed in the deployed path while
 * every local test, which has no ALB, stayed green.
 *
 * The attribute key and value are TYPED HERE, not imported, for the reason this
 * file's header gives. Witnessed RED on 2 Oct 2026 by deleting
 * `preserveHostHeader: true` from `infra/lib/planes-stack.ts`: this assertion
 * failed naming the missing attribute. The CONTROL ALB is asserted unchanged so
 * the fix is not read as covering a listener nothing routes a tenant `Host` to.
 */
function albAttributes(template, logicalIdPrefix) {
  const albs = resourcesOfType(template, 'AWS::ElasticLoadBalancingV2::LoadBalancer').filter(
    ([id]) => id.startsWith(logicalIdPrefix),
  )
  assert.equal(albs.length, 1, `expected exactly one ${logicalIdPrefix} load balancer`)
  return Object.fromEntries(
    (albs[0][1].Properties.LoadBalancerAttributes ?? []).map(({ Key, Value }) => [Key, Value]),
  )
}

test('test_the_data_alb_preserves_the_host_header_so_no_port_is_appended', async () => {
  const { synthesisedTemplates } = await import('./support.mjs')
  const template = synthesisedTemplates()[STACK]
  assert.ok(template, `no stack named ${STACK}`)
  const data = albAttributes(template, 'DataAlb')
  assert.equal(
    data['routing.http.preserve_host_header.enabled'],
    'true',
    'G2986: the data ALB must preserve Host — its listener is on non-default port 9080, ' +
      'and without preservation AWS appends ":9080" to Host, which misses every serving-host ' +
      'registry row (G179) and breaks G180 and the sign-in relay in the deployed path',
  )
  assert.equal(data['routing.http.drop_invalid_header_fields.enabled'], 'true')
  const control = albAttributes(template, 'ControlAlb')
  assert.equal(control['routing.http.preserve_host_header.enabled'], undefined)
})

// ----------------------------- G4310 — the internal edge, both directions

function envOf(template, containerName) {
  for (const [, container] of containerDefinitions(template)) {
    if (container.Name === containerName) {
      return Object.fromEntries((container.Environment ?? []).map((e) => [e.Name, e.Value]))
    }
  }
  throw new Error(`no container named ${containerName}`)
}

test('test_the_control_plane_allows_exactly_the_data_service_task_role_as_its_internal_caller', () => {
  const control = envOf(green, 'control-plane')
  const taskRoles = resourcesOfType(green, 'AWS::IAM::Role').filter(
    ([, r]) => r.Properties?.RoleName === 'reconcile-staging-data-service-task',
  )
  assert.equal(taskRoles.length, 1, 'the data-plane service task role is not in the Planes template')
  assert.deepEqual(
    control['RECONCILE_INTERNAL_CALLER_ROLE_ARN'],
    { 'Fn::GetAtt': [taskRoles[0][0], 'Arn'] },
    'G4307: the control plane must allow EXACTLY the data-plane SERVICE task role, read by GetAtt ' +
      'and never spelled — not the migrate role, not its own role, not an account-wide pattern.',
  )
  assert.equal(control['RECONCILE_INTERNAL_AUDIENCE'], 'reconcile-control-staging')
  assert.equal(control['RECONCILE_INTERNAL_STS_REGION'], 'us-west-2')
})

test('test_the_data_plane_names_the_control_alb_and_the_same_audience', () => {
  const data = envOf(green, 'data-plane')
  const url = JSON.stringify(data['RECONCILE_INTERNAL_CONTROL_PLANE_URL'])
  const albs = resourcesOfType(green, 'AWS::ElasticLoadBalancingV2::LoadBalancer').filter(
    ([, r]) => r.Properties?.Name === 'reconcile-staging-control',
  )
  assert.equal(albs.length, 1)
  assert.ok(url.includes(albs[0][0]) && url.includes(':9070'), `RECONCILE_INTERNAL_CONTROL_PLANE_URL is ${url}`)
  assert.equal(data['RECONCILE_INTERNAL_AUDIENCE'], 'reconcile-control-staging')
  assert.equal(data['RECONCILE_INTERNAL_STS_REGION'], 'us-west-2')
  /* And the control plane is told nothing about the data plane's location:
     invariant 3 — it publishes downward and never calls the data plane. */
  const control = JSON.stringify(envOf(green, 'control-plane'))
  assert.doesNotMatch(control, /reconcile-staging-data"|DataAlb|RECONCILE_DATA_PLANE_URL/)
})

test('test_no_iam_statement_was_added_for_the_internal_edge_because_sts_get_caller_identity_needs_none', () => {
  for (const [, policy] of resourcesOfType(green, 'AWS::IAM::Policy')) {
    for (const st of policy.Properties?.PolicyDocument?.Statement ?? []) {
      const actions = [st.Action].flat()
      assert.ok(
        !actions.some((a) => typeof a === 'string' && /^(sts:GetCallerIdentity|execute-api:)/.test(a)),
        'an IAM statement grants sts:GetCallerIdentity or execute-api — the internal edge needs neither; ' +
          'its authorisation is the control plane allow-list (G4307).',
      )
    }
  }
})

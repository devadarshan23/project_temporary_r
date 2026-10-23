/**
 * THE TWO AURORA CLUSTERS — G254's engine pin, G263's rotation, G193's split,
 * and the working-hours schedule.
 *
 * 🛑 THE ENGINE-VERSION ASSERTION IS THE ONE THAT DISCHARGES A RULING. G177
 * pinned PostgreSQL 17 and recorded in its own row that *"no version was
 * fetched; this row asserts nothing about what Aurora Serverless v2 offers"*;
 * G254 turned that into a PRECONDITION of this slice. The version was fetched —
 * `infra/lib/config.ts` carries the `describe-db-engine-versions` command and
 * its output — and this file is what stops the pin drifting afterwards, which
 * is the half a one-off verification cannot do.
 *
 * ⚠️ EVERY EXPECTED VALUE IS TYPED INTO THIS FILE, none imported from
 * `infra/lib/`. Asserting the stack matches the constant the stack read proves
 * only that a variable equals itself.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ensureDeps, synthesisedTemplates, resourcesOfType } from './support.mjs'

await ensureDeps()

const CLUSTER = 'AWS::RDS::DBCluster'
const INSTANCE = 'AWS::RDS::DBInstance'
const ROTATION = 'AWS::SecretsManager::RotationSchedule'
const SCHEDULE = 'AWS::Scheduler::Schedule'

const planeOf = (resource) =>
  (resource.Properties?.Tags ?? []).find((t) => t.Key === 'Plane')?.Value

function everyResource(type) {
  return Object.entries(synthesisedTemplates()).flatMap(([stackName, template]) =>
    resourcesOfType(template, type).map(([logicalId, resource]) => ({
      stackName,
      logicalId,
      resource,
    })),
  )
}

// ------------------------------------------------ 1. G193/G254 — two clusters

test('test_there_are_exactly_two_clusters_and_one_carries_each_plane', () => {
  const clusters = everyResource(CLUSTER)
  assert.equal(
    clusters.length,
    2,
    'G254: one cluster per plane. G193: two databases, and "the plane boundary is ' +
      'enforced by TOPOLOGY, not by review" — one cluster with two databases is ' +
      'the shape that ruling refuses.',
  )
  const planes = clusters.map(({ resource }) => planeOf(resource)).sort()
  assert.deepEqual(planes, ['control', 'data'], 'one cluster per plane, each tagged with its own')
})

test('test_each_cluster_carries_the_database_name_its_plane_expects', () => {
  const byPlane = new Map(
    everyResource(CLUSTER).map(({ resource }) => [planeOf(resource), resource.Properties]),
  )
  /* The names `compose.yaml` creates locally and the two planes' own config
   * modules default to. A cluster whose database is named something else is a
   * deployment the planes cannot connect to and the migrations cannot run
   * against. */
  assert.equal(byPlane.get('data')?.DatabaseName, 'reconcile_data')
  assert.equal(byPlane.get('control')?.DatabaseName, 'reconcile_control')
})

// ------------------------------------------- 2. G177/G254 — the engine pin

test('test_both_clusters_are_aurora_postgresql_major_version_17', () => {
  const clusters = everyResource(CLUSTER)
  assert.ok(clusters.length > 0, 'no clusters; this assertion would pass vacuously')
  for (const { logicalId, resource } of clusters) {
    assert.equal(resource.Properties?.Engine, 'aurora-postgresql', `${logicalId} is not Aurora PostgreSQL`)
    assert.match(
      String(resource.Properties?.EngineVersion),
      /^17\./,
      `${logicalId} is on ${resource.Properties?.EngineVersion}. G177 pins PostgreSQL 17, and ` +
        '"a migration written against an unpinned major is a migration nobody can prove ' +
        'ran on the version production will use."',
    )
  }
})

test('test_the_engine_minor_is_pinned_to_an_exact_version_that_us_west_2_offers', () => {
  /* Verified against the real region on 18 Sep 2026:
   *   aws rds describe-db-engine-versions --engine aurora-postgresql --region us-west-2
   * returned 17.4 17.5 17.6 17.7 17.9 17.10 — note the ABSENCE of 17.8, which is
   * why this is an exact literal rather than "the latest 17". */
  const versions = new Set(
    everyResource(CLUSTER).map(({ resource }) => resource.Properties?.EngineVersion),
  )
  assert.deepEqual(
    [...versions],
    ['17.9'],
    'both clusters must be on the SAME exact minor. Two planes on two minors is a ' +
      'difference nobody decided and nothing would report.',
  )
})

test('test_aws_does_not_move_the_minor_version_under_us', () => {
  const instances = everyResource(INSTANCE)
  assert.equal(instances.length, 2, 'one writer per cluster, no readers (G254, staging)')
  for (const { logicalId, resource } of instances) {
    assert.equal(
      resource.Properties?.AutoMinorVersionUpgrade,
      false,
      `${logicalId} leaves AutoMinorVersionUpgrade at Aurora's default of TRUE, which means ` +
        'AWS changes the pinned version during a maintenance window. A version AWS may ' +
        'change is an unpinned version wearing a literal (G177).',
    )
    assert.equal(resource.Properties?.DBInstanceClass, 'db.serverless', 'G254: Serverless v2')
  }
})

test('test_the_clusters_are_serverless_v2_with_the_staging_capacity_range', () => {
  for (const { logicalId, resource } of everyResource(CLUSTER)) {
    assert.deepEqual(
      resource.Properties?.ServerlessV2ScalingConfiguration,
      { MinCapacity: 0.5, MaxCapacity: 2 },
      `${logicalId}: staging is 0.5-2 ACU.`,
    )
  }
})

test('test_storage_is_encrypted_on_both_clusters', () => {
  for (const { logicalId, resource } of everyResource(CLUSTER)) {
    assert.equal(resource.Properties?.StorageEncrypted, true, `${logicalId} is unencrypted at rest`)
  }
})

// ------------------------------------------------- 3. G263 — secrets, rotated

/* ⚠️ G3921, 4 Oct 2026: the five ROLE secrets gained rotations of their own,
 * on a custom function (`RotationLambdaARN`, not `HostedRotationLambda`), so
 * "every rotation in the app" is no longer "the two cluster secrets". The two
 * tests below keep their subject — the CLUSTER secrets' hosted rotations — by
 * selecting on the hosted shape. Witnessed RED first: the count read 7 and the
 * VPC test failed on a rotation with no `HostedRotationLambda`. The role
 * rotations are asserted in `tests/infra/role-secret-rotation.test.mjs`. */
const hostedRotations = () =>
  everyResource(ROTATION).filter(
    ({ resource }) => resource.Properties?.HostedRotationLambda !== undefined,
  )

test('test_every_cluster_secret_has_a_rotation_schedule', () => {
  const rotations = hostedRotations()
  assert.equal(
    rotations.length,
    2,
    'G263: "Aurora credentials live in Secrets Manager, rotation enabled." One per cluster; ' +
      `found ${rotations.length}.`,
  )
  assert.equal(
    everyResource(ROTATION).length,
    6,
    'two cluster secrets plus four role secrets (G3921; five until G4320 retired the control ' +
      'reader on 5 Oct 2026) — a rotation of neither shape is unaccounted for',
  )
  for (const { logicalId, resource } of rotations) {
    assert.ok(
      resource.Properties?.RotationRules !== undefined,
      `${logicalId} declares a rotation with no rules, which is a rotation that never fires`,
    )
    assert.ok(
      resource.Properties?.HostedRotationLambda !== undefined,
      `${logicalId} has no rotation function at all`,
    )
    assert.equal(
      resource.Properties.HostedRotationLambda.RotationType,
      'PostgreSQLSingleUser',
      `${logicalId} rotates with the wrong engine's function`,
    )
  }
})

test('test_the_rotation_function_runs_inside_the_vpc_on_a_named_security_group', () => {
  /* A rotation function outside the VPC cannot reach a private Aurora cluster
   * at all, so it would fail every time — and a rotation on a default group
   * would need an ingress rule nobody wrote. */
  for (const { logicalId, resource } of hostedRotations()) {
    const hosted = resource.Properties.HostedRotationLambda
    assert.notEqual(
      hosted.VpcSubnetIds,
      undefined,
      `${logicalId} runs outside the VPC, where it cannot reach a private cluster at all`,
    )
    assert.notEqual(
      hosted.VpcSecurityGroupIds,
      undefined,
      `${logicalId} runs on no named security group, so the ingress rule in the Network ` +
        'stack authorises nothing and rotation fails on every attempt',
    )
  }
})

test('test_rotation_is_scheduled_on_a_weekday_so_it_cannot_fire_while_the_cluster_is_stopped', () => {
  /* 🛑 THE REASON THIS IS AN ASSERTION AND NOT A COMMENT. A stopped Aurora
   * cluster accepts no connections and cannot be modified, and the rotation
   * function's whole job is to connect and ALTER ROLE. CDK's default,
   * `rate(30 days)`, fires at an hour nobody chose — which, against the
   * stop/start schedule below, lands outside the running window most of the
   * time. A rotation that fails is a credential that does not rotate while the
   * record says rotation is on. */
  for (const { logicalId, resource } of everyResource(ROTATION)) {
    const expression = resource.Properties.RotationRules.ScheduleExpression
    assert.ok(
      typeof expression === 'string',
      `${logicalId} has no ScheduleExpression, so it is on a rate() at an arbitrary hour`,
    )
    assert.match(
      expression,
      /^cron\(/,
      `${logicalId} rotates on '${expression}'. A rate() cannot be constrained to the ` +
        'hours in which the cluster is running.',
    )
    assert.doesNotMatch(
      expression,
      /SAT|SUN/,
      `${logicalId} rotates on a weekend, when the stop/start schedule leaves the cluster stopped`,
    )
  }
})

// ------------------------------- 4. the working-hours stop/start schedule

test('test_there_are_four_schedules_two_stops_and_two_starts', () => {
  const schedules = everyResource(SCHEDULE)
  assert.equal(schedules.length, 4, 'two clusters x (stop + start)')
  const actions = schedules.map(({ resource }) => resource.Properties.Target.Arn).sort()
  assert.deepEqual(actions, [
    'arn:aws:scheduler:::aws-sdk:rds:startDBCluster',
    'arn:aws:scheduler:::aws-sdk:rds:startDBCluster',
    'arn:aws:scheduler:::aws-sdk:rds:stopDBCluster',
    'arn:aws:scheduler:::aws-sdk:rds:stopDBCluster',
  ])
})

test('test_every_stop_is_paired_with_a_start_on_weekdays_so_the_seven_day_limit_never_fires', () => {
  /* 🛑 AWS: "You can stop a DB cluster for up to seven days. If you don't
   * manually start your DB cluster after seven days, your DB cluster is
   * automatically started." A MON-FRI start schedule bounds the longest stopped
   * gap at Friday night to Monday morning — under three days. A schedule that
   * stopped on weekdays and started weekly would silently hand the seven-day
   * auto-start the job, and the cluster would come back up and bill without
   * anybody asking it to. */
  const schedules = everyResource(SCHEDULE)
  let starts = 0
  for (const { logicalId, resource } of schedules) {
    const expression = resource.Properties.ScheduleExpression
    assert.match(
      expression,
      /MON-FRI/,
      `${logicalId} runs on '${expression}', which is not a weekday schedule`,
    )
    if (resource.Properties.Target.Arn.endsWith('startDBCluster')) starts += 1
  }
  assert.equal(starts, 2, 'every cluster that is stopped must also be started')
})

test('test_the_schedules_name_an_explicit_timezone_rather_than_defaulting_to_utc', () => {
  for (const { logicalId, resource } of everyResource(SCHEDULE)) {
    assert.equal(
      resource.Properties.ScheduleExpressionTimezone,
      'Asia/Singapore',
      `${logicalId} has no explicit timezone. "Working hours" without one means UTC, ` +
        'which is 08:00 to 21:00 in Singapore — not the window anybody asked for.',
    )
  }
})

test('test_the_scheduler_role_may_only_stop_and_start_and_only_these_two_clusters', () => {
  const policies = Object.entries(synthesisedTemplates()).flatMap(([, template]) =>
    resourcesOfType(template, 'AWS::IAM::Policy'),
  )
  const schedulerPolicies = policies.filter(([, p]) =>
    JSON.stringify(p.Properties?.PolicyDocument ?? {}).includes('rds:StopDBCluster'),
  )
  assert.equal(schedulerPolicies.length, 1, 'exactly one policy should grant the stop action')
  const statements = schedulerPolicies[0][1].Properties.PolicyDocument.Statement
  for (const statement of statements) {
    const actions = [statement.Action].flat()
    assert.deepEqual(
      [...actions].sort(),
      ['rds:StartDBCluster', 'rds:StopDBCluster'],
      'the scheduler role holds an action beyond stop and start. It must not be able to ' +
        'modify, snapshot or delete a cluster in a SHARED account (G256/G279).',
    )
    const resources = [statement.Resource].flat()
    assert.equal(
      resources.includes('*'),
      false,
      'the scheduler role names "*" as its resource. The fence here is the RESOURCE list.',
    )
    assert.equal(resources.length, 2, 'two clusters, two ARNs')
  }
})

test('test_the_scheduler_role_cannot_be_assumed_by_eventbridge_in_another_account', () => {
  const roles = Object.entries(synthesisedTemplates()).flatMap(([, template]) =>
    resourcesOfType(template, 'AWS::IAM::Role'),
  )
  const schedulerRoles = roles.filter(([, r]) =>
    JSON.stringify(r.Properties?.AssumeRolePolicyDocument ?? {}).includes('scheduler.amazonaws.com'),
  )
  assert.equal(schedulerRoles.length, 1)
  const document = JSON.stringify(schedulerRoles[0][1].Properties.AssumeRolePolicyDocument)
  assert.match(
    document,
    /aws:SourceAccount/,
    'scheduler.amazonaws.com is a service principal shared by EVERY AWS account. Without a ' +
      'SourceAccount condition this role is assumable by EventBridge Scheduler anywhere.',
  )
})

/**
 * G3921–G3925 — ROLE-SECRET ROTATION, EXECUTED AND SYNTHESISED.
 *
 * 🛑 TWO HALVES AND NEITHER IS ENOUGH ALONE. `cdk synth` proves the schedule,
 * the IAM and the alarm exist; it says nothing about code inside a zip. The
 * first half drives `rotation.mjs` and `pgwire.mjs` against recording doubles
 * (no AWS, no SDK on disk — `tenant-key-minter.test.mjs`'s shape); the second
 * reads the real app's templates. `tests/db/role-secret-rotation.test.mjs`
 * drives the same steps against a live PostgreSQL.
 *
 * ⚠️ EVERY EXPECTED VALUE IS TYPED HERE OR DERIVED FROM A TEMPLATE — none is
 * imported from `infra/lib/config.ts`, because a test that reads the constant
 * under test proves a variable equals itself. The one exception is the
 * dark-hour arithmetic, which reads its four edges out of FOUR DIFFERENT
 * synthesised resources so that moving any one of them is a red.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { INFRA_DIR, ensureDeps, resourcesOfType, synthesisedTemplates } from './support.mjs'

const DIR = join(INFRA_DIR, 'lambda', 'role-secret-rotation')
const { scramClientFinal, scramVerifier, verifierAccepts, isLoopback, connect } = await import(
  join(DIR, 'pgwire.mjs')
)
const { readConfig, readEvent, RotationRefusal, VERIFIER_PATTERN } = await import(join(DIR, 'guards.mjs'))
const { rotateStep } = await import(join(DIR, 'rotation.mjs'))

// ======================================================================
// §1 — the wire client's cryptography, against published vectors
// ======================================================================

test('test_scram_client_final_matches_rfc_7677s_own_test_vector', () => {
  /* RFC 7677 §3, typed in: user "user", password "pencil". If this drifts,
   * every login to Aurora fails — and the failure would surface in the cloud,
   * once a week, at 07:00 Singapore. */
  const out = scramClientFinal({
    password: 'pencil',
    clientFirstBare: 'n=user,r=rOprNGfwEbeRWgbNEkqO',
    serverFirst:
      'r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096',
  })
  assert.equal(
    out.clientFinal,
    'c=biws,r=rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0,p=dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=',
  )
  assert.equal(
    out.expectedServerSignature.toString('base64'),
    '6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4=',
  )
})

test('test_scram_refuses_a_server_nonce_that_does_not_extend_ours', () => {
  assert.throws(
    () =>
      scramClientFinal({
        password: 'pencil',
        clientFirstBare: 'n=,r=ours',
        serverFirst: 'r=theirs,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096',
      }),
    /scram_nonce_mismatch/,
  )
})

test('test_a_verifier_accepts_its_own_password_and_no_other', () => {
  const v = scramVerifier('a-forty-character-password-0123456789abc')
  assert.match(v, VERIFIER_PATTERN)
  assert.ok(verifierAccepts(v, 'a-forty-character-password-0123456789abc'))
  assert.ok(!verifierAccepts(v, 'a-forty-character-password-0123456789abd'))
  /* Two verifiers of one password differ — the salt is fresh each time — so a
   * leaked verifier says nothing about the next rotation's. */
  assert.notEqual(v, scramVerifier('a-forty-character-password-0123456789abc'))
})

test('test_plaintext_is_refused_to_any_host_that_is_not_loopback', async () => {
  assert.equal(isLoopback('127.0.0.1'), true)
  assert.equal(isLoopback('reconcile-staging-data.cluster-x.us-west-2.rds.amazonaws.com'), false)
  await assert.rejects(
    connect({ host: '10.0.0.1', port: 5432, user: 'u', password: 'p', database: 'd', tls: false }),
    /plaintext_refused_off_loopback/,
  )
})

// ======================================================================
// §2 — the four steps, against recording doubles
// ======================================================================

const SECRET_ARN = 'arn:aws:secretsmanager:us-west-2:000000000000:secret:reconcile-staging-dataapp-AbCdEf'
const MASTER_ARN = 'arn:aws:secretsmanager:us-west-2:000000000000:secret:DataPlaneClusterSecret-XyZ'
const OLD = 'old-password-0123456789-0123456789-0123'
const NEW = 'new-password-0123456789-0123456789-0123'
const TOKEN = 'tok-0001'

const ENV = {
  ROTATION_SECRET_ARN: SECRET_ARN,
  ROTATION_MASTER_SECRET_ARN: MASTER_ARN,
  ROTATION_ROLE_NAME: 'reconcile_app',
  ROTATION_DATABASE_NAME: 'reconcile_data',
  ROTATION_EXCLUDE_CHARACTERS: '"@/\\\'` ',
  ROTATION_PASSWORD_LENGTH: '40',
  ROTATION_HOLDER_SERVICES: JSON.stringify({
    cluster: 'reconcile-staging',
    services: ['reconcile-staging-data-plane'],
  }),
}

/**
 * A Secrets Manager that RECORDS and keeps versions. The token is already a
 * version labelled AWSPENDING with no value — which is how Secrets Manager
 * calls `createSecret` — and AWSCURRENT holds the old password.
 */
function fakeWorld({ running = 0, serviceFound = true } = {}) {
  const calls = []
  const values = new Map([
    ['v-current', JSON.stringify({ username: 'reconcile_app', password: OLD })],
  ])
  const stages = { 'v-current': ['AWSCURRENT'], [TOKEN]: ['AWSPENDING'] }
  const master = JSON.stringify({
    engine: 'postgres',
    host: 'reconcile-staging-data.cluster-x.us-west-2.rds.amazonaws.com',
    port: 5432,
    username: 'reconcile_data_admin',
    password: 'the-admin-password-0123456789-0123456789',
  })
  const notFound = () => Object.assign(new Error('not found'), { name: 'ResourceNotFoundException' })
  const sm = async (command, input) => {
    calls.push({ service: 'sm', command, input })
    if (command === 'DescribeSecret') {
      return { RotationEnabled: true, VersionIdsToStages: structuredClone(stages) }
    }
    if (command === 'GetSecretValue') {
      if (input.SecretId === MASTER_ARN) return { SecretString: master }
      const version =
        input.VersionId ??
        Object.keys(stages).find((v) => stages[v].includes(input.VersionStage))
      if (input.VersionStage !== undefined && !(stages[version] ?? []).includes(input.VersionStage)) {
        throw notFound()
      }
      if (!values.has(version)) throw notFound()
      return { SecretString: values.get(version), VersionId: version }
    }
    if (command === 'GetRandomPassword') return { RandomPassword: NEW }
    if (command === 'PutSecretValue') {
      values.set(input.ClientRequestToken, input.SecretString)
      return {}
    }
    if (command === 'UpdateSecretVersionStage') {
      stages[input.RemoveFromVersionId] = stages[input.RemoveFromVersionId].filter((s) => s !== 'AWSCURRENT')
      stages[input.RemoveFromVersionId].push('AWSPREVIOUS')
      stages[input.MoveToVersionId] = ['AWSCURRENT']
      return {}
    }
    throw new Error(`unexpected ${command}`)
  }
  const ecs = async (command, input) => {
    calls.push({ service: 'ecs', command, input })
    return {
      services: serviceFound
        ? input.services.map((serviceName) => ({
            serviceName,
            desiredCount: running,
            runningCount: running,
            pendingCount: 0,
          }))
        : [],
    }
  }
  const sessions = []
  const connectDouble = async (options) => {
    const session = { options, queries: [] }
    sessions.push(session)
    return {
      query: async (sql) => {
        session.queries.push(sql)
        if (sql.startsWith('SELECT rolcanlogin')) return { fields: ['rolcanlogin'], rows: [['t']] }
        if (sql === 'SELECT current_user') return { fields: ['current_user'], rows: [[options.user]] }
        return { fields: [], rows: [] }
      },
      end: async () => {},
    }
  }
  return {
    calls,
    sessions,
    values,
    stages,
    deps: { sm, ecs, connect: connectDouble, verifier: (p) => scramVerifier(p) },
  }
}

const config = () => readConfig(ENV)
const step = (world, name) => rotateStep(world.deps, config(), { step: name, token: TOKEN })

test('test_the_four_steps_rotate_end_to_end_and_the_admin_sets_the_password', async () => {
  const world = fakeWorld()
  assert.equal(await step(world, 'createSecret'), 'pending_staged')
  assert.deepEqual(JSON.parse(world.values.get(TOKEN)), { username: 'reconcile_app', password: NEW })
  assert.equal(await step(world, 'setSecret'), 'password_set_by_admin')
  assert.equal(await step(world, 'testSecret'), 'pending_authenticates')
  assert.equal(await step(world, 'finishSecret'), 'pending_promoted')
  assert.deepEqual(world.stages[TOKEN], ['AWSCURRENT'])

  const [set, tested] = world.sessions
  /* 🛑 THE SET IS DONE AS THE CLUSTER ADMIN, NEVER AS THE ROLE ITSELF. */
  assert.equal(set.options.user, 'reconcile_data_admin')
  assert.equal(set.options.password, 'the-admin-password-0123456789-0123456789')
  /* And the TEST is done as the role, with the PENDING password. */
  assert.equal(tested.options.user, 'reconcile_app')
  assert.equal(tested.options.password, NEW)
})

test('test_set_secret_sends_a_scram_verifier_and_never_the_password', async () => {
  /* `log_min_error_statement = error` puts a FAILED statement in the exported
   * PostgreSQL log, so the plaintext must never be in the statement. The next
   * test is the guard's own witness: with the VERIFIER_PATTERN check deleted
   * from `setSecret`, an identity "verifier" reached `connect()` (G3923). */
  const world = fakeWorld()
  await step(world, 'createSecret')
  await step(world, 'setSecret')
  const alter = world.sessions[0].queries.find((q) => q.startsWith('ALTER ROLE'))
  assert.ok(alter, 'no ALTER ROLE was issued')
  assert.ok(!alter.includes(NEW), 'the plaintext password reached the SQL text')
  const verifier = /PASSWORD '([^']+)'/.exec(alter)?.[1]
  assert.ok(verifier !== undefined && verifierAccepts(verifier, NEW))
  assert.match(alter, /^ALTER ROLE "reconcile_app" PASSWORD 'SCRAM-SHA-256\$/)
})

test('test_a_plaintext_verifier_is_refused_before_any_connection', async () => {
  const world = fakeWorld()
  await step(world, 'createSecret')
  world.deps.verifier = (p) => p
  await assert.rejects(step(world, 'setSecret'), /verifier_malformed/)
  assert.equal(world.sessions.length, 0)
})

test('test_rotation_refuses_while_a_holder_service_is_running_and_moves_nothing', async () => {
  /* 🛑 THE STRANDED-FLEET GUARD. Witnessed RED (G3923): with
   * `refuseWhileHoldersRun` returning early, createSecret staged a password
   * and setSecret connected as the admin with the fleet at two tasks. */
  const world = fakeWorld({ running: 2 })
  await assert.rejects(step(world, 'createSecret'), (err) => {
    assert.ok(err instanceof RotationRefusal)
    assert.equal(err.reason, 'holder_service_running')
    return true
  })
  assert.equal(world.calls.filter((c) => c.command === 'PutSecretValue').length, 0)

  /* And setSecret refuses on its own, before any connection — a fleet that
   * woke between the two steps is caught at the destructive one. */
  world.values.set(TOKEN, JSON.stringify({ username: 'reconcile_app', password: NEW }))
  await assert.rejects(step(world, 'setSecret'), /holder_service_running/)
  assert.equal(world.sessions.length, 0)
  assert.deepEqual(world.stages['v-current'], ['AWSCURRENT'], 'AWSCURRENT moved under a refusal')
})

test('test_a_holder_the_api_cannot_find_is_a_refusal_not_a_pass', async () => {
  const world = fakeWorld({ serviceFound: false })
  await assert.rejects(step(world, 'createSecret'), /holder_service_not_found/)
})

test('test_a_secret_with_no_holder_service_never_calls_ecs', async () => {
  const world = fakeWorld({ running: 9 })
  const cfg = readConfig({
    ...ENV,
    ROTATION_HOLDER_SERVICES: JSON.stringify({ cluster: 'reconcile-staging', services: [] }),
  })
  await rotateStep(world.deps, cfg, { step: 'createSecret', token: TOKEN })
  assert.equal(world.calls.filter((c) => c.service === 'ecs').length, 0)
})

test('test_the_function_acts_only_on_the_secret_it_was_built_for', () => {
  assert.throws(
    () =>
      readEvent(
        { Step: 'setSecret', SecretId: `${SECRET_ARN}-other`, ClientRequestToken: TOKEN },
        config(),
      ),
    /secret_not_mine/,
  )
  assert.deepEqual(
    readEvent({ Step: 'setSecret', SecretId: SECRET_ARN, ClientRequestToken: TOKEN }, config()),
    { step: 'setSecret', secretId: SECRET_ARN, token: TOKEN },
  )
})

test('test_a_role_name_that_could_carry_sql_is_refused_at_configuration', () => {
  for (const bad of ['reconcile_app"; DROP ROLE x; --', 'postgres', 'reconcile_App', '']) {
    assert.throws(() => readConfig({ ...ENV, ROTATION_ROLE_NAME: bad }), RotationRefusal)
  }
})

test('test_a_secret_naming_a_different_role_is_refused_before_anything_is_staged', async () => {
  const world = fakeWorld()
  world.values.set('v-current', JSON.stringify({ username: 'reconcile_migrator', password: OLD }))
  await assert.rejects(step(world, 'createSecret'), /secret_username_is_not_the_role/)
  assert.equal(world.calls.filter((c) => c.command === 'PutSecretValue').length, 0)
})

test('test_an_absent_or_nologin_role_is_refused_not_created', async () => {
  const world = fakeWorld()
  await step(world, 'createSecret')
  const inner = world.deps.connect
  world.deps.connect = async (o) => {
    const c = await inner(o)
    return {
      ...c,
      query: async (sql) => (sql.startsWith('SELECT rolcanlogin') ? { fields: [], rows: [] } : c.query(sql)),
    }
  }
  await assert.rejects(step(world, 'setSecret'), /role_absent_or_nologin/)
  assert.ok(!world.sessions[0].queries.some((q) => q.startsWith('ALTER') || q.startsWith('CREATE')))
})

test('test_a_token_already_current_is_a_no_op', async () => {
  const world = fakeWorld()
  world.stages[TOKEN] = ['AWSCURRENT']
  world.stages['v-current'] = []
  assert.equal(await step(world, 'setSecret'), 'already_current')
  assert.equal(world.sessions.length, 0)
})

// ======================================================================
// §3 — the synthesised app
// ======================================================================

await ensureDeps()
const templates = synthesisedTemplates()
const data = templates['reconcile-data-staging']
const planes = templates['reconcile-planes-staging']
const observability = templates['reconcile-observability-staging']

/** Typed in: the four role secrets (five until G4320), their roles, their clusters and their holder services. */
const ROLE_SECRETS = {
  'reconcile-staging-datamigrator': { role: 'reconcile_migrator', db: 'reconcile_data', holders: [] },
  'reconcile-staging-dataapp': {
    role: 'reconcile_app',
    db: 'reconcile_data',
    holders: ['reconcile-staging-data-plane'],
  },
  'reconcile-staging-dataengine': { role: 'reconcile_engine', db: 'reconcile_data', holders: [] },
  'reconcile-staging-controlapp': {
    /* ⚠️ THIS SAID 'reconcile_app' UNTIL G4471 AND PINNED G4463's DEFECT: the
     * control plane connects as `reconcile_control_app`, and a table typed in
     * beside the code it checks agreed with the code's mistake.
     * `rotation-role-matches-plane.test.mjs` derives the role instead. */
    role: 'reconcile_control_app',
    db: 'reconcile_control',
    holders: ['reconcile-staging-control-plane'],
  },
  /* ⛔ `reconcile-staging-controlreader` IS RETIRED — G4320, 5 Oct 2026, THE
     OWNER'S "Full restore" ruling: the data plane holds no control-database
     credential, so the secret, its rotation and its holder are gone. */
}

const refOf = (v) => v?.Ref
const secretLogicalIdByName = (name) => {
  const hit = resourcesOfType(data, 'AWS::SecretsManager::Secret').find(
    ([, r]) => r.Properties?.Name === name,
  )
  assert.ok(hit, `no Data secret named ${name}`)
  return hit[0]
}
const customRotations = () =>
  resourcesOfType(data, 'AWS::SecretsManager::RotationSchedule').filter(
    ([, r]) => r.Properties.RotationLambdaARN !== undefined,
  )
const functionOf = (rotation) => {
  const id = rotation.Properties.RotationLambdaARN['Fn::GetAtt'][0]
  return [id, data.Resources[id]]
}
const policyStatementsOfRole = (template, roleLogicalId) =>
  resourcesOfType(template, 'AWS::IAM::Policy')
    .filter(([, p]) => (p.Properties.Roles ?? []).some((r) => refOf(r) === roleLogicalId))
    .flatMap(([, p]) => p.Properties.PolicyDocument.Statement)
const actionsOf = (st) => [st.Action].flat()
const resourcesOf = (st) => [st.Resource].flat()

test('test_every_role_secret_has_exactly_one_custom_rotation_and_none_rotates_on_deploy', () => {
  const rotations = customRotations()
  /* ⚠️ FIVE UNTIL G4320 retired the control reader's secret. */
  assert.equal(rotations.length, 4, `four role secrets, four rotations; found ${rotations.length}`)
  const rotated = rotations.map(([, r]) => refOf(r.Properties.SecretId)).sort()
  const expected = Object.keys(ROLE_SECRETS).map(secretLogicalIdByName).sort()
  assert.deepEqual(rotated, expected)
  for (const [id, r] of rotations) {
    /* A schedule created at `cdk deploy` would rotate mid-day with the fleet
     * up — the holder check would refuse five times and page. */
    assert.equal(r.Properties.RotateImmediatelyOnUpdate, false, `${id} rotates on deploy`)
  }
})

test('test_each_rotation_function_is_configured_for_its_own_role_and_holders', () => {
  for (const [, rotation] of customRotations()) {
    const secretId = refOf(rotation.Properties.SecretId)
    const name = data.Resources[secretId].Properties.Name
    const expected = ROLE_SECRETS[name]
    const [, fn] = functionOf(rotation)
    const env = fn.Properties.Environment.Variables
    assert.equal(env.ROTATION_ROLE_NAME, expected.role, name)
    assert.equal(env.ROTATION_DATABASE_NAME, expected.db, name)
    assert.equal(refOf(env.ROTATION_SECRET_ARN), secretId, `${name}: rotates a different secret`)
    assert.deepEqual(JSON.parse(env.ROTATION_HOLDER_SERVICES), {
      cluster: 'reconcile-staging',
      services: expected.holders,
    })
    assert.equal(fn.Properties.ReservedConcurrentExecutions, 1)
    assert.ok(fn.Properties.VpcConfig?.SubnetIds?.length > 0, `${name}: rotation outside the VPC`)
    assert.equal(fn.Properties.Runtime, 'nodejs22.x')
  }
})

/**
 * 🛑 THE DARK HOUR, DERIVED. The window must open after the cluster starts
 * (Data's `StartData` schedule, in its own timezone), close before the serving
 * fleet wakes (Planes' `…MorningUp`, UTC), and not touch the master rotation.
 */
test('test_the_role_rotation_window_lies_inside_the_dark_hour_derived_from_the_templates', () => {
  const cronHourMinute = (expr) => {
    const m = /^cron\((\d+) (\d+) /.exec(expr)
    assert.ok(m, `not a cron with fixed minute and hour: ${expr}`)
    return Number(m[2]) * 60 + Number(m[1])
  }
  const offsetMinutes = (tz) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(new Date('2026-10-05T00:00:00Z'))
      .find((p) => p.type === 'timeZoneName').value
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(parts)
    return m === null ? 0 : (m[1] === '+' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3]))
  }
  const DAY = 24 * 60
  const norm = (m) => ((m % DAY) + DAY) % DAY

  const start = resourcesOfType(data, 'AWS::Scheduler::Schedule').find(([id]) => id === 'StartData')[1]
  const auroraUpUtc = norm(
    cronHourMinute(start.Properties.ScheduleExpression) -
      offsetMinutes(start.Properties.ScheduleExpressionTimezone),
  )
  const morningUp = resourcesOfType(planes, 'AWS::ApplicationAutoScaling::ScalableTarget')
    .flatMap(([, r]) => r.Properties.ScheduledActions)
    .filter((a) => a.ScheduledActionName.endsWith('MorningUp'))
  assert.equal(morningUp.length, 2, 'both serving services scale up in the morning')
  const fleetUpUtc = Math.min(...morningUp.map((a) => cronHourMinute(a.Schedule)))

  for (const [id, r] of customRotations()) {
    const opens = cronHourMinute(r.Properties.RotationRules.ScheduleExpression)
    const hours = Number(/^(\d+)h$/.exec(r.Properties.RotationRules.Duration)?.[1])
    const closes = opens + hours * 60
    assert.ok(
      norm(opens - auroraUpUtc) >= 30 && norm(opens - auroraUpUtc) < 12 * 60,
      `${id}: opens ${opens} min UTC, less than 30 min after the cluster starts at ${auroraUpUtc}`,
    )
    assert.ok(
      norm(fleetUpUtc - opens) >= hours * 60,
      `${id}: the window (${opens}..${closes} UTC) runs into the fleet waking at ${fleetUpUtc}`,
    )
    assert.doesNotMatch(r.Properties.RotationRules.ScheduleExpression, /SAT|SUN/)
  }
  // And it never overlaps a master rotation, so the admin secret it reads is settled.
  const masters = resourcesOfType(data, 'AWS::SecretsManager::RotationSchedule').filter(
    ([, r]) => r.Properties.HostedRotationLambda !== undefined,
  )
  assert.equal(masters.length, 2)
  for (const [, m] of masters) {
    for (const [, r] of customRotations()) {
      assert.notEqual(
        m.Properties.RotationRules.ScheduleExpression,
        r.Properties.RotationRules.ScheduleExpression,
      )
    }
  }
})

test('test_a_rotation_function_writes_only_its_own_secret_and_only_reads_the_master', () => {
  const roleSecretIds = new Set(Object.keys(ROLE_SECRETS).map(secretLogicalIdByName))
  for (const [, rotation] of customRotations()) {
    const own = refOf(rotation.Properties.SecretId)
    const [, fn] = functionOf(rotation)
    const role = fn.Properties.Role['Fn::GetAtt'][0]
    const statements = policyStatementsOfRole(data, role)
    for (const st of statements) {
      const writes = actionsOf(st).filter((a) =>
        /PutSecretValue|UpdateSecretVersionStage|RotateSecret|DeleteSecret|PutResourcePolicy|UpdateSecret$/.test(a),
      )
      if (writes.length === 0) continue
      assert.deepEqual(
        resourcesOf(st).map(refOf),
        [own],
        `${role}: ${writes.join(',')} reaches beyond its own secret`,
      )
    }
    /* Read access to OTHER role secrets: none. The master: GetSecretValue and
     * DescribeSecret only (asserted by the write filter above). */
    for (const st of statements) {
      for (const r of resourcesOf(st).map(refOf)) {
        if (r !== undefined && roleSecretIds.has(r)) assert.equal(r, own, `${role} reads ${r}`)
      }
    }
    const ecs = statements.filter((st) => actionsOf(st).some((a) => a.startsWith('ecs:')))
    for (const st of ecs) assert.deepEqual(actionsOf(st), ['ecs:DescribeServices'])
  }
})

test('test_the_invoke_permission_is_bound_to_the_secret_it_rotates', () => {
  for (const [, rotation] of customRotations()) {
    const [fnId] = functionOf(rotation)
    const perms = resourcesOfType(data, 'AWS::Lambda::Permission').filter(
      ([, p]) => p.Properties.FunctionName?.['Fn::GetAtt']?.[0] === fnId,
    )
    assert.equal(perms.length, 1)
    const p = perms[0][1].Properties
    assert.equal(p.Principal, 'secretsmanager.amazonaws.com')
    assert.equal(refOf(p.SourceArn), refOf(rotation.Properties.SecretId))
    assert.ok(p.SourceAccount !== undefined, 'no SourceAccount on the rotation invoke permission')
  }
})

// ---------------------------------------- the serving planes cannot rotate

const ROTATION_VERBS =
  /^secretsmanager:(PutSecretValue|UpdateSecretVersionStage|RotateSecret|CancelRotateSecret|GetRandomPassword|\*)$|^secretsmanager:\*$|^\*$/

/** Every IAM statement in a template that any principal there holds. */
const everyStatement = (template) => [
  ...resourcesOfType(template, 'AWS::IAM::Policy').flatMap(([id, p]) =>
    p.Properties.PolicyDocument.Statement.map((st) => ({ id, st })),
  ),
  ...resourcesOfType(template, 'AWS::IAM::Role').flatMap(([id, r]) =>
    (r.Properties.Policies ?? []).flatMap((pol) =>
      pol.PolicyDocument.Statement.map((st) => ({ id, st })),
    ),
  ),
]

/** The violations, so the check can be witnessed RED in memory below. */
function servingPlaneRotationReach(template) {
  const violations = []
  for (const { id, st } of everyStatement(template)) {
    if (st.Effect !== 'Allow') continue
    const verbs = actionsOf(st).filter((a) => ROTATION_VERBS.test(a))
    if (verbs.length > 0) violations.push(`${id}: ${verbs.join(',')}`)
    const invokes = actionsOf(st).filter((a) => /^lambda:InvokeFunction$|^lambda:\*$/.test(a))
    if (invokes.length > 0 && JSON.stringify(st.Resource).includes('rotation')) {
      violations.push(`${id}: may invoke a rotation function`)
    }
  }
  return violations
}

test('test_no_principal_in_planes_may_rotate_a_secret_or_invoke_a_rotation_function', () => {
  assert.deepEqual(servingPlaneRotationReach(planes), [])
  /* Anti-vacuity, witnessed RED in memory: a statement granting the data
   * service's task role PutSecretValue is caught. */
  const leaked = structuredClone(planes)
  const [policyId] = resourcesOfType(leaked, 'AWS::IAM::Policy')[0]
  leaked.Resources[policyId].Properties.PolicyDocument.Statement.push({
    Effect: 'Allow',
    Action: 'secretsmanager:PutSecretValue',
    Resource: '*',
  })
  assert.equal(servingPlaneRotationReach(leaked).length, 1)
})

/** Which Data secret a Planes `ValueFrom` resolves to, through Data's Outputs. */
function secretNameBehind(valueFrom) {
  const imported = JSON.stringify(valueFrom).match(/"Fn::ImportValue":"([^"]+)"/)
  assert.ok(imported, `not a cross-stack import: ${JSON.stringify(valueFrom)}`)
  const output = Object.values(data.Outputs ?? {}).find((o) => o.Export?.Name === imported[1])
  assert.ok(output, `no Data output exports ${imported[1]}`)
  const resource = data.Resources[output.Value.Ref]
  return resource.Type === 'AWS::SecretsManager::Secret'
    ? resource.Properties.Name
    : `${resource.Type}:${output.Value.Ref}`
}

/** service name -> the set of Data secret names its task definition injects. */
function holdersFromPlanes(template) {
  const out = new Map()
  for (const [, svc] of resourcesOfType(template, 'AWS::ECS::Service')) {
    const td = template.Resources[refOf(svc.Properties.TaskDefinition)]
    const names = new Set(
      td.Properties.ContainerDefinitions.flatMap((c) => c.Secrets ?? []).map((s) =>
        secretNameBehind(s.ValueFrom),
      ),
    )
    out.set(svc.Properties.ServiceName, names)
  }
  return out
}

test('test_the_holder_table_equals_the_secrets_each_planes_service_actually_injects', () => {
  /* 🛑 A MIRROR, NOT A THIRD PLACE TO DRIFT: a secret added to a SERVICE task
   * definition without adding the service to its rotation's holders would let
   * the rotation run under that service and strand it. */
  const served = holdersFromPlanes(planes)
  assert.deepEqual([...served.keys()].sort(), [
    'reconcile-staging-control-plane',
    'reconcile-staging-data-plane',
  ])
  for (const [secretName, expected] of Object.entries(ROLE_SECRETS)) {
    const derived = [...served].filter(([, names]) => names.has(secretName)).map(([svc]) => svc)
    assert.deepEqual(derived.sort(), [...expected.holders].sort(), `${secretName}'s holders`)
  }
  /* G3862 restated from the rotation's side: the serving data plane holds the
   * app and reader secrets and NOTHING ELSE — not the engine, not the migrator,
   * not another plane's app credential, not an admin secret. */
  /* ⚠️ G4320 — and since 5 Oct 2026 not the control reader's either. */
  assert.deepEqual([...served.get('reconcile-staging-data-plane')].sort(), ['reconcile-staging-dataapp'])

  /* Anti-vacuity, witnessed RED in memory: give the CONTROL service the data
   * plane's app secret and the derivation sees a new holder the table lacks. */
  const leaked = structuredClone(planes)
  const dataTd = leaked.Resources[refOf(
    resourcesOfType(leaked, 'AWS::ECS::Service').find(
      ([, x]) => x.Properties.ServiceName === 'reconcile-staging-data-plane',
    )[1].Properties.TaskDefinition,
  )]
  const appSecret = dataTd.Properties.ContainerDefinitions[0].Secrets.find(
    (x) => x.Name === 'RECONCILE_APP_PASSWORD',
  )
  const controlTd = leaked.Resources[refOf(
    resourcesOfType(leaked, 'AWS::ECS::Service').find(
      ([, x]) => x.Properties.ServiceName === 'reconcile-staging-control-plane',
    )[1].Properties.TaskDefinition,
  )]
  controlTd.Properties.ContainerDefinitions[0].Secrets.push(appSecret)
  assert.ok(holdersFromPlanes(leaked).get('reconcile-staging-control-plane').has('reconcile-staging-dataapp'))
})

test('test_the_data_services_execution_role_reads_only_the_one_secret_it_injects', () => {
  const svc = resourcesOfType(planes, 'AWS::ECS::Service').find(
    ([, s]) => s.Properties.ServiceName === 'reconcile-staging-data-plane',
  )[1]
  const td = planes.Resources[refOf(svc.Properties.TaskDefinition)]
  const roles = [td.Properties.ExecutionRoleArn, td.Properties.TaskRoleArn].map(
    (a) => a['Fn::GetAtt'][0],
  )
  const read = new Set()
  for (const role of roles) {
    for (const st of policyStatementsOfRole(planes, role)) {
      if (!actionsOf(st).some((a) => a.startsWith('secretsmanager:'))) continue
      assert.ok(
        actionsOf(st).every((a) => a === 'secretsmanager:GetSecretValue' || a === 'secretsmanager:DescribeSecret'),
        `${role} holds ${actionsOf(st).join(',')}`,
      )
      for (const r of resourcesOf(st)) read.add(secretNameBehind(r))
    }
  }
  /* ⚠️ TWO until G4320 retired the control reader's secret (5 Oct 2026). */
  assert.deepEqual([...read].sort(), ['reconcile-staging-dataapp'])
})

// ------------------------------------------------------------ the alarm

test('test_one_alarm_sums_the_errors_of_every_rotation_function_and_pages_the_topic', () => {
  const alarms = resourcesOfType(observability, 'AWS::CloudWatch::Alarm').filter(
    ([, a]) => a.Properties.AlarmName === 'reconcile-staging-secret-rotation-failed',
  )
  assert.equal(alarms.length, 1)
  const a = alarms[0][1].Properties
  const alarmed = a.Metrics.filter((m) => m.MetricStat !== undefined).map((m) => {
    assert.equal(m.MetricStat.Metric.Namespace, 'AWS/Lambda')
    assert.equal(m.MetricStat.Metric.MetricName, 'Errors')
    return m.MetricStat.Metric.Dimensions.find((d) => d.Name === 'FunctionName').Value
  })
  /* Derived, not typed: every rotation function Data actually declares —
   * the five custom ones by FunctionName, the two hosted ones by
   * RotationLambdaName. A sixth rotation with no alarm is a red. */
  const declared = [
    ...customRotations().map(([, r]) => functionOf(r)[1].Properties.FunctionName),
    ...resourcesOfType(data, 'AWS::SecretsManager::RotationSchedule')
      .filter(([, r]) => r.Properties.HostedRotationLambda !== undefined)
      .map(([, r]) => r.Properties.HostedRotationLambda.RotationLambdaName),
  ]
  assert.deepEqual(alarmed.sort(), declared.sort())
  /* ⚠️ SEVEN until G4320 retired the control reader's rotation (5 Oct 2026). */
  assert.equal(alarmed.length, 6)
  assert.equal(a.Threshold, 0)
  assert.equal(a.ComparisonOperator, 'GreaterThanThreshold')
  assert.equal(refOf(a.AlarmActions[0]), resourcesOfType(observability, 'AWS::SNS::Topic')[0][0])
})

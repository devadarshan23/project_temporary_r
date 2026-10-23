/**
 * THE FOUR ROTATION STEPS FOR ONE DATABASE ROLE SECRET — G3921–G3925,
 * 4 Oct 2026, closing G3866 in code.
 *
 * 🛑 READ `infra/lib/data-stack.ts`'s `roleSecretRotation()` BEFORE THIS FILE.
 * The argument — why single-user, why the ADMIN sets the password, why the
 * schedule is the one dark hour of the week, why there is no forced redeploy —
 * lives there beside the IAM it describes. This file is the
 * AWSPENDING → AWSCURRENT dance and nothing else.
 *
 *   createSecret  stage a new password as AWSPENDING (same username)
 *   setSecret     ALTER ROLE <role> PASSWORD <verifier>, AS THE CLUSTER ADMIN
 *   testSecret    log in AS THE ROLE with the pending password
 *   finishSecret  move AWSCURRENT to the pending version
 *
 * 🛑 THE ROLE NEVER CHANGES ITS OWN PASSWORD. AWS's single-user template logs
 * in AS the user and runs `ALTER USER` on itself; that is a request-path
 * credential exercising a password verb, and it is refused here. The new
 * password is set by the cluster's MASTER user — the same principal
 * `db/provision.ts#createRoles()` sets it with on every migrate run — so the
 * rotation and the migrate job are ONE PATH to the role, not two.
 *
 * 🛑 AND IT REFUSES WHILE A HOLDER IS RUNNING (`refuseWhileHoldersRun`). A
 * PostgreSQL role has ONE password. A task that read the old one at start-up
 * keeps its open connections and fails its next NEW one, and `pg` never
 * re-reads a secret — so rotating under a running service strands it, silently,
 * until something restarts it. The schedule puts rotation in the hour the fleet
 * is scaled to zero; this check turns "the schedule was wrong this week" from a
 * stranded fleet into a FAILED rotation, which `Observability` alarms on, with
 * AWSCURRENT untouched.
 */

import { PASSWORD_PATTERN, ROLE_NAME_PATTERN, RotationRefusal, VERIFIER_PATTERN } from './guards.mjs'

/**
 * @typedef {(command: string, input: Record<string, unknown>) => Promise<any>} AwsCall
 * @typedef {{query: (sql: string) => Promise<{fields: string[], rows: (string|null)[][]}>, end: () => Promise<void>}} PgClient
 * @typedef {{
 *   sm: AwsCall,
 *   ecs: AwsCall,
 *   connect: (o: {host: string, port: number, user: string, password: string, database: string}) => Promise<PgClient>,
 *   verifier: (password: string) => string,
 *   log?: (line: Record<string, unknown>) => void,
 * }} Deps
 */

function parseSecret(secretString, what) {
  let parsed
  try {
    parsed = JSON.parse(secretString)
  } catch {
    throw new RotationRefusal('secret_not_json', what)
  }
  if (parsed === null || typeof parsed !== 'object') throw new RotationRefusal('secret_not_object', what)
  return parsed
}

/**
 * A role secret's value, checked against the role this function was built for.
 * @param {string} secretString
 * @param {string} roleName
 */
function roleSecretValue(secretString, roleName, what) {
  const v = parseSecret(secretString, what)
  if (v.username !== roleName) throw new RotationRefusal('secret_username_is_not_the_role', what)
  if (typeof v.password !== 'string' || !PASSWORD_PATTERN.test(v.password)) {
    throw new RotationRefusal('secret_password_outside_alphabet', what)
  }
  return v
}

/** The cluster admin's connection facts, from the cluster's own generated secret. */
function masterValue(secretString) {
  const v = parseSecret(secretString, 'master')
  for (const key of ['host', 'username', 'password']) {
    if (typeof v[key] !== 'string' || v[key] === '') throw new RotationRefusal('master_secret_incomplete', key)
  }
  const port = Number(v.port ?? 5432)
  if (!Number.isInteger(port)) throw new RotationRefusal('master_secret_incomplete', 'port')
  return { host: v.host, port, username: v.username, password: v.password }
}

/**
 * 🛑 THE HOLDER CHECK. Refuse unless every serving service that holds this
 * secret is at zero desired, zero running and zero pending tasks. A service the
 * API cannot find is a REFUSAL, not a pass: a misspelt name would otherwise
 * make the guard vacuous — `docs/HANDOFF.md` §5.6 inside the control written to
 * avoid it.
 * @param {Deps} deps
 * @param {{cluster: string, services: string[]}} holders
 */
export async function refuseWhileHoldersRun(deps, holders) {
  if (holders.services.length === 0) return
  const out = await deps.ecs('DescribeServices', {
    cluster: holders.cluster,
    services: holders.services,
  })
  const found = new Map((out.services ?? []).map((s) => [s.serviceName, s]))
  for (const name of holders.services) {
    const s = found.get(name)
    if (s === undefined) throw new RotationRefusal('holder_service_not_found', name)
    const live = (s.desiredCount ?? 0) + (s.runningCount ?? 0) + (s.pendingCount ?? 0)
    if (live > 0) {
      throw new RotationRefusal(
        'holder_service_running',
        `${name} desired=${s.desiredCount} running=${s.runningCount} pending=${s.pendingCount}; ` +
          'rotating now would strand its tasks on a password the role no longer has. ' +
          'AWSCURRENT is untouched; rotate again once the service is at zero (deploy-handoff.md §31).',
      )
    }
  }
}

/** @param {Deps} deps @param {ReturnType<import('./guards.mjs').readConfig>} config */
async function createSecret(deps, config, token) {
  const current = await deps.sm('GetSecretValue', {
    SecretId: config.secretArn,
    VersionStage: 'AWSCURRENT',
  })
  const currentValue = roleSecretValue(current.SecretString, config.roleName, 'AWSCURRENT')
  try {
    const pending = await deps.sm('GetSecretValue', {
      SecretId: config.secretArn,
      VersionId: token,
      VersionStage: 'AWSPENDING',
    })
    roleSecretValue(pending.SecretString, config.roleName, 'AWSPENDING')
    return 'pending_already_staged'
  } catch (err) {
    if (err instanceof RotationRefusal) throw err
    if (err?.name !== 'ResourceNotFoundException') throw err
  }
  await refuseWhileHoldersRun(deps, config.holders)
  const random = await deps.sm('GetRandomPassword', {
    PasswordLength: config.passwordLength,
    ExcludeCharacters: config.excludeCharacters,
  })
  const password = random.RandomPassword
  if (typeof password !== 'string' || !PASSWORD_PATTERN.test(password)) {
    throw new RotationRefusal('generated_password_outside_alphabet')
  }
  await deps.sm('PutSecretValue', {
    SecretId: config.secretArn,
    ClientRequestToken: token,
    SecretString: JSON.stringify({ ...currentValue, password }),
    VersionStages: ['AWSPENDING'],
  })
  return 'pending_staged'
}

/** @param {Deps} deps */
async function setSecret(deps, config, token) {
  await refuseWhileHoldersRun(deps, config.holders)
  const pending = await deps.sm('GetSecretValue', {
    SecretId: config.secretArn,
    VersionId: token,
    VersionStage: 'AWSPENDING',
  })
  const pendingValue = roleSecretValue(pending.SecretString, config.roleName, 'AWSPENDING')
  const master = masterValue(
    (await deps.sm('GetSecretValue', { SecretId: config.masterSecretArn, VersionStage: 'AWSCURRENT' }))
      .SecretString,
  )
  if (!ROLE_NAME_PATTERN.test(config.roleName)) throw new RotationRefusal('role_name_refused')
  const verifier = deps.verifier(pendingValue.password)
  if (!VERIFIER_PATTERN.test(verifier)) throw new RotationRefusal('verifier_malformed')

  const admin = await deps.connect({
    host: master.host,
    port: master.port,
    user: master.username,
    password: master.password,
    database: config.databaseName,
  })
  try {
    /* 🛑 THE ROLE MUST ALREADY EXIST AND BE A LOGIN ROLE. Rotation never
     * CREATES a role — `createRoles()` owns that, with the attributes G100
     * depends on — so an absent role is a refusal, not a `CREATE`. */
    const found = await admin.query(
      `SELECT rolcanlogin FROM pg_roles WHERE rolname = '${config.roleName}'`,
    )
    if (found.rows.length !== 1 || found.rows[0]?.[0] !== 't') {
      throw new RotationRefusal('role_absent_or_nologin', config.roleName)
    }
    await admin.query(`ALTER ROLE "${config.roleName}" PASSWORD '${verifier}'`)
  } finally {
    await admin.end()
  }
  return 'password_set_by_admin'
}

/** @param {Deps} deps */
async function testSecret(deps, config, token) {
  const pending = await deps.sm('GetSecretValue', {
    SecretId: config.secretArn,
    VersionId: token,
    VersionStage: 'AWSPENDING',
  })
  const pendingValue = roleSecretValue(pending.SecretString, config.roleName, 'AWSPENDING')
  const master = masterValue(
    (await deps.sm('GetSecretValue', { SecretId: config.masterSecretArn, VersionStage: 'AWSCURRENT' }))
      .SecretString,
  )
  const client = await deps.connect({
    host: master.host,
    port: master.port,
    user: config.roleName,
    password: pendingValue.password,
    database: config.databaseName,
  })
  try {
    const who = await client.query('SELECT current_user')
    if (who.rows[0]?.[0] !== config.roleName) throw new RotationRefusal('logged_in_as_someone_else')
  } finally {
    await client.end()
  }
  return 'pending_authenticates'
}

/** @param {Deps} deps */
async function finishSecret(deps, config, token) {
  const described = await deps.sm('DescribeSecret', { SecretId: config.secretArn })
  const stages = described.VersionIdsToStages ?? {}
  let currentVersion = null
  for (const [version, labels] of Object.entries(stages)) {
    if (labels.includes('AWSCURRENT')) currentVersion = version
  }
  if (currentVersion === token) return 'already_current'
  await deps.sm('UpdateSecretVersionStage', {
    SecretId: config.secretArn,
    VersionStage: 'AWSCURRENT',
    MoveToVersionId: token,
    ...(currentVersion === null ? {} : { RemoveFromVersionId: currentVersion }),
  })
  return 'pending_promoted'
}

/**
 * One step. Throws on any refusal — a thrown step is what Secrets Manager
 * records as a failed rotation and what `AWS/Lambda Errors` counts.
 *
 * @param {Deps} deps
 * @param {ReturnType<import('./guards.mjs').readConfig>} config
 * @param {{step: string, token: string}} event
 */
export async function rotateStep(deps, config, { step, token }) {
  const described = await deps.sm('DescribeSecret', { SecretId: config.secretArn })
  if (described.RotationEnabled !== true) throw new RotationRefusal('rotation_not_enabled')
  const stages = described.VersionIdsToStages ?? {}
  const labels = stages[token]
  if (labels === undefined) throw new RotationRefusal('token_not_a_version')
  if (labels.includes('AWSCURRENT')) return 'already_current'
  if (!labels.includes('AWSPENDING')) throw new RotationRefusal('token_not_pending')

  const run = { createSecret, setSecret, testSecret, finishSecret }[step]
  if (run === undefined) throw new RotationRefusal('step_unknown')
  const outcome = await run(deps, config, token)
  deps.log?.({ rotation: config.roleName, step, outcome })
  return outcome
}

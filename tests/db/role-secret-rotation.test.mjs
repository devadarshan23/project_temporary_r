/**
 * G3921 — THE ROLE-SECRET ROTATION'S FOUR STEPS AGAINST A LIVE POSTGRESQL.
 *
 * `tests/infra/role-secret-rotation.test.mjs` drives `rotation.mjs` against a
 * recording double for the database. This suite replaces the double with
 * `pgwire.mjs` talking to a real server, so the one claim a double cannot make
 * is witnessed: **after `setSecret`, the role's stored verifier accepts the
 * PENDING password and refuses the OLD one** — read out of `pg_authid` and
 * checked against both, rather than inferred from a statement having run.
 *
 * ⚠️ WHAT THIS CANNOT SEE, NAMED: the gate's PostgreSQL authenticates by
 * `trust`, so `testSecret`'s login succeeds whatever password it sends. The
 * SCRAM exchange itself is witnessed by RFC 7677's vector in the infra suite,
 * and the end-to-end SCRAM login against a pre-hashed verifier was MEASURED by
 * hand against PostgreSQL 14.18 with a `scram-sha-256` `pg_hba` line (G3922) —
 * a measurement, not a gate assertion. The `pg_authid` check below is what
 * makes the gate's half independent of the authentication method.
 *
 * ⚠️ `.mjs` for `tests/infra/support.mjs`'s reason: it imports the Lambda's
 * zero-dependency `.mjs` modules, which carry no type declarations.
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedRoleName } from '../run-scoped-db.ts'
import { MAINTENANCE_DATABASE, adminUser, dbTarget, describeTarget, probeDatabase } from '../../db/env.ts'
import { INFRA_DIR } from '../infra/support.mjs'

const DIR = join(INFRA_DIR, 'lambda', 'role-secret-rotation')
const { connect, scramVerifier, verifierAccepts } = await import(join(DIR, 'pgwire.mjs'))
const { readConfig } = await import(join(DIR, 'guards.mjs'))
const { rotateStep } = await import(join(DIR, 'rotation.mjs'))

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/role-secret-rotation.test.mjs DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      '   A run in which it skipped is NOT evidence that a rotation sets the',
      '   pending password as the admin.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}
databaseRequiredUnderCi('the role-secret rotation assertions', probe)

/* Cluster-wide, so a name no other suite uses, created and dropped here — and
 * scoped to this RUN (G4153), because a role is the one object two gates on one
 * cluster share by construction: run A's `after` dropped run B's role mid-test. */
const ROLE = runScopedRoleName('reconcile_rotation_probe')
const NOLOGIN_ROLE = runScopedRoleName('reconcile_rotation_nologin')
const OLD = 'old-password-0123456789-0123456789-0123'
const NEW = 'new-password-0123456789-0123456789-0123'
const TOKEN = 'tok-live-0001'
const SECRET_ARN = 'arn:aws:secretsmanager:us-west-2:000000000000:secret:probe-AbCdEf'
const MASTER_ARN = 'arn:aws:secretsmanager:us-west-2:000000000000:secret:master-XyZ'

const target = dbTarget()
const adminOptions = () => ({
  host: target.host,
  port: target.port,
  user: adminUser(),
  password: process.env['PGPASSWORD'] ?? 'unused-under-trust-auth',
  database: MAINTENANCE_DATABASE,
})

async function asAdmin(fn) {
  const c = await connect(adminOptions())
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

/** An in-memory Secrets Manager holding one role secret and a master secret. */
function secretsManager(roleName) {
  const values = new Map([['v-current', JSON.stringify({ username: roleName, password: OLD })]])
  const stages = { 'v-current': ['AWSCURRENT'], [TOKEN]: ['AWSPENDING'] }
  const master = JSON.stringify({
    host: target.host,
    port: target.port,
    username: adminUser(),
    password: process.env['PGPASSWORD'] ?? 'unused-under-trust-auth',
  })
  const notFound = () => Object.assign(new Error('nf'), { name: 'ResourceNotFoundException' })
  const sm = async (command, input) => {
    if (command === 'DescribeSecret') return { RotationEnabled: true, VersionIdsToStages: structuredClone(stages) }
    if (command === 'GetSecretValue') {
      if (input.SecretId === MASTER_ARN) return { SecretString: master }
      const v = input.VersionId ?? Object.keys(stages).find((k) => stages[k].includes(input.VersionStage))
      if (!(stages[v] ?? []).includes(input.VersionStage) || !values.has(v)) throw notFound()
      return { SecretString: values.get(v), VersionId: v }
    }
    if (command === 'GetRandomPassword') return { RandomPassword: NEW }
    if (command === 'PutSecretValue') return void values.set(input.ClientRequestToken, input.SecretString)
    if (command === 'UpdateSecretVersionStage') {
      stages[input.RemoveFromVersionId] = ['AWSPREVIOUS']
      stages[input.MoveToVersionId] = ['AWSCURRENT']
      return {}
    }
    throw new Error(command)
  }
  return { sm, stages }
}

const configFor = (roleName) =>
  readConfig({
    ROTATION_SECRET_ARN: SECRET_ARN,
    ROTATION_MASTER_SECRET_ARN: MASTER_ARN,
    ROTATION_ROLE_NAME: roleName,
    ROTATION_DATABASE_NAME: MAINTENANCE_DATABASE,
    ROTATION_EXCLUDE_CHARACTERS: '"@/\\\'` ',
    ROTATION_PASSWORD_LENGTH: '40',
    ROTATION_HOLDER_SERVICES: JSON.stringify({ cluster: 'reconcile-test', services: [] }),
  })

const storedVerifier = (roleName) =>
  asAdmin(async (c) => (await c.query(`SELECT rolpassword FROM pg_authid WHERE rolname = '${roleName}'`)).rows[0]?.[0])

describe('role-secret rotation against a live PostgreSQL', { skip }, () => {
  before(async () => {
    await asAdmin(async (c) => {
      await c.query(`DROP ROLE IF EXISTS ${ROLE}`)
      await c.query(`DROP ROLE IF EXISTS ${NOLOGIN_ROLE}`)
      await c.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${scramVerifier(OLD)}'`)
      await c.query(`CREATE ROLE ${NOLOGIN_ROLE} NOLOGIN`)
    })
  })
  after(async () => {
    await asAdmin(async (c) => {
      await c.query(`DROP ROLE IF EXISTS ${ROLE}`)
      await c.query(`DROP ROLE IF EXISTS ${NOLOGIN_ROLE}`)
    })
  })

  it('rotates end to end: the stored verifier accepts the pending password and refuses the old', async () => {
    assert.ok(verifierAccepts(await storedVerifier(ROLE), OLD), 'fixture: the role starts on OLD')
    const { sm, stages } = secretsManager(ROLE)
    const deps = { sm, ecs: async () => assert.fail('no holder, no ECS call'), connect, verifier: scramVerifier }
    const config = configFor(ROLE)
    for (const step of ['createSecret', 'setSecret', 'testSecret', 'finishSecret']) {
      await rotateStep(deps, config, { step, token: TOKEN })
    }
    const stored = await storedVerifier(ROLE)
    assert.ok(verifierAccepts(stored, NEW), 'the role does not hold the pending password')
    assert.ok(!verifierAccepts(stored, OLD), 'the role still holds the OLD password')
    assert.deepEqual(stages[TOKEN], ['AWSCURRENT'])
  })

  it('refuses a NOLOGIN role rather than giving it a password', async () => {
    const { sm } = secretsManager(NOLOGIN_ROLE)
    const deps = { sm, ecs: async () => ({ services: [] }), connect, verifier: scramVerifier }
    const config = configFor(NOLOGIN_ROLE)
    await rotateStep(deps, config, { step: 'createSecret', token: TOKEN })
    await assert.rejects(rotateStep(deps, config, { step: 'setSecret', token: TOKEN }), /role_absent_or_nologin/)
    assert.equal(await storedVerifier(NOLOGIN_ROLE), null)
  })

  it('refuses a role that does not exist rather than creating it', async () => {
    const ghost = runScopedRoleName('reconcile_rotation_ghost')
    const { sm } = secretsManager(ghost)
    const deps = { sm, ecs: async () => ({ services: [] }), connect, verifier: scramVerifier }
    const config = configFor(ghost)
    await rotateStep(deps, config, { step: 'createSecret', token: TOKEN })
    await assert.rejects(rotateStep(deps, config, { step: 'setSecret', token: TOKEN }), /role_absent_or_nologin/)
    const exists = await asAdmin(async (c) => (await c.query(`SELECT 1 FROM pg_roles WHERE rolname = '${ghost}'`)).rows)
    assert.deepEqual(exists, [])
  })
})

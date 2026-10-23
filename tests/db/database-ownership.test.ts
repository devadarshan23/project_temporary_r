/**
 * `reconcile_owner` OWNS THE DATABASE EVEN WHEN SOMETHING ELSE CREATED IT.
 *
 * 🛑 THIS TEST EXISTS BECAUSE A PROPERTY THAT WAS TRUE BY ACCIDENT WAS READ AS
 * TRUE BY CONSTRUCTION. On the disposable local PostgreSQL nothing but
 * `createDatabase()` creates the database, so `CREATE DATABASE ... OWNER
 * reconcile_owner` always ran and the ownership held — and every assertion in
 * `tests/db/` rested on it without one of them ever saying so.
 *
 * AURORA CREATES THE DATABASE FIRST, from the cluster's `defaultDatabaseName`,
 * owned by the master user. `createDatabase()` saw it existed, returned, and the
 * first real data-plane migration failed:
 *
 *     error: permission denied for database reconcile_data
 *     code 42501 · aclchk.c · aclcheck_error
 *
 * ⚠️ AND THE CONTROL PLANE PASSED THE SAME RUN. `migrations-control/` creates no
 * schema, so it never touched the missing privilege — which is why the failure
 * read as a data-plane defect for one round. THE ASYMMETRY IS THE THING THIS
 * TEST REPRODUCES: §1 asserts the ownership directly, and §2 asserts the
 * consequence that actually broke, `CREATE SCHEMA` as the migrator.
 *
 * It runs against a scratch database created the way AURORA creates one —
 * owned by the admin, NOT by `reconcile_owner` — because a test that lets
 * `createDatabase()` create its own subject re-proves the accident instead of
 * the decision.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'

const SCRATCH = process.env['RECONCILE_OWNERSHIP_DB_NAME'] ?? runScopedName('reconcile_ownership_test')
process.env['RECONCILE_DB_NAME'] = SCRATCH

const { probeDatabase, describeTarget, MAINTENANCE_DATABASE, ROLES, dbTarget, adminUser, dbSsl } =
  await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')
const { createRoles, createDatabase, migratorClient } = await import('../../db/provision.ts')

/**
 * The superuser seam, rebuilt here rather than imported.
 *
 * `db/provision.ts`'s own `adminClient()` is deliberately NOT exported — it
 * mints the connection that holds the cluster superuser, and exporting it to
 * satisfy a test would widen the reach of the one credential
 * `server/data-plane/migrate-main.ts` exists to keep out of a serving process.
 * Twelve lines of duplication is the cheaper cost.
 */
async function adminClient(database: string) {
  const { Client } = await loadPg()
  const t = dbTarget()
  return new Client({
    host: t.host,
    port: t.port,
    ssl: dbSsl(t.host),
    database,
    user: adminUser(),
    application_name: 'reconcile-ownership-test',
  })
}

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/database-ownership.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   A green run on a machine with no database is NOT evidence that',
      '   `reconcile_owner` ends up owning a database it did not create.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the database-ownership assertions', probe)

/** Who owns `SCRATCH`, by name, read from the catalogue. */
async function ownerOfScratch(): Promise<string> {
  const admin = await adminClient(MAINTENANCE_DATABASE)
  await admin.connect()
  try {
    const r = await admin.query(
      `SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1`,
      [SCRATCH],
    )
    const rows = r.rows as unknown as Array<{ owner: string }>
    const first = rows[0]
    assert.ok(first !== undefined, `${SCRATCH} does not exist`)
    return first.owner
  } finally {
    await admin.end()
  }
}

describe('createDatabase() makes reconcile_owner the owner', { skip }, () => {
  /** Who owned it before `createDatabase()` ran. Derived, never assumed. */
  let ownerBefore = ''

  before(async () => {
    await createRoles()

    // Stand up the scratch database THE WAY AURORA DOES: created by the admin,
    // with no OWNER clause, so it lands owned by whoever ran the statement.
    const admin = await adminClient(MAINTENANCE_DATABASE)
    await admin.connect()
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`)
      await admin.query(`CREATE DATABASE ${SCRATCH}`)
    } finally {
      await admin.end()
    }

    ownerBefore = await ownerOfScratch()
  })

  after(async () => {
    const admin = await adminClient(MAINTENANCE_DATABASE)
    await admin.connect()
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`)
    } finally {
      await admin.end()
    }
  })

  it('1 · the subject really did start owned by someone else', () => {
    assert.notEqual(
      ownerBefore,
      ROLES.owner,
      'the scratch database was already owned by reconcile_owner before ' +
        'createDatabase() ran, so this suite would pass while asserting nothing — ' +
        'which is the shape of defect it was written to catch',
    )
  })

  it('2 · createDatabase() re-assigns ownership rather than returning', async () => {
    await createDatabase()
    assert.equal(
      await ownerOfScratch(),
      ROLES.owner,
      'createDatabase() left the database owned by its creator. Aurora creates ' +
        'the database from defaultDatabaseName before any of this code connects, ' +
        'so an existence check that returns early leaves reconcile_owner with no ' +
        'CREATE on it.',
    )
  })

  it('3 · and the migrator can then CREATE SCHEMA, which is what actually failed', async () => {
    const client = await migratorClient()
    try {
      await client.query(`SET ROLE ${ROLES.owner}`)
      await client.query('CREATE SCHEMA ownership_probe')
      await client.query('DROP SCHEMA ownership_probe')
    } finally {
      await client.end()
    }
  })
})

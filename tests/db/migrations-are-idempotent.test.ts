/**
 * RUNNING THE MIGRATIONS TWICE APPLIES THEM ONCE.
 *
 * 🛑 THIS IS THE ONE PROPERTY A DISPOSABLE DATABASE CANNOT WITNESS, AND IT WAS
 * FALSE IN PRODUCTION FOR EXACTLY THAT REASON. Every other suite in `tests/db/`
 * starts from empty, runs the migrations once, and is correct — run 1 was never
 * the broken one.
 *
 * The second run against Aurora re-ran every file from 0001:
 *
 *     error: relation "tenant" already exists — 42P07
 *
 * `createRoles()` sets `search_path = tenant, public` on the migrator, and an
 * unqualified `CREATE TABLE IF NOT EXISTS schema_migration` creates in the FIRST
 * schema of the path while checking for existence only THERE. Before
 * `0003_tenant_schema.sql` there is no schema `tenant`, so the ledger lands in
 * `public`; after it there is, so run 2 makes a SECOND, EMPTY ledger in `tenant`
 * and reads that one. Nothing is recorded as applied, so everything applies
 * again.
 *
 * ⚠️ THE ASSERTION THAT MATTERS IS §2, AND IT IS THE CHEAP ONE: the second run
 * returns an EMPTY LIST. §3 is the mechanism — exactly one ledger exists, in
 * `public` — and it is what tells the next reader WHY §2 failed if it does.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'

const SCRATCH = process.env['RECONCILE_TWICE_DB_NAME'] ?? runScopedName('reconcile_twice_test')
process.env['RECONCILE_DB_NAME'] = SCRATCH

const { probeDatabase, describeTarget, MAINTENANCE_DATABASE, dbTarget, adminUser, dbSsl } =
  await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')
const { provision, migratorClient } = await import('../../db/provision.ts')
const { applyMigrations } = await import('../../db/migrate.ts')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/migrations-are-idempotent.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   A green run on a machine with no database is NOT evidence that a',
      '   SECOND migration run applies nothing.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the migration-idempotence assertions', probe)

/** The superuser seam, rebuilt rather than imported — see database-ownership.test.ts. */
async function adminClient(database: string) {
  const { Client } = await loadPg()
  const t = dbTarget()
  return new Client({
    host: t.host,
    port: t.port,
    ssl: dbSsl(t.host),
    database,
    user: adminUser(),
    application_name: 'reconcile-twice-test',
  })
}

async function dropScratch(): Promise<void> {
  const admin = await adminClient(MAINTENANCE_DATABASE)
  await admin.connect()
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH} WITH (FORCE)`)
  } finally {
    await admin.end()
  }
}

/** One migration run, on its own connection, exactly as the job does it. */
async function runMigrations(): Promise<readonly string[]> {
  const client = await migratorClient()
  try {
    return await applyMigrations(client)
  } finally {
    await client.end()
  }
}

describe('the migrations run twice and apply once', { skip }, () => {
  let first: readonly string[] = []
  let second: readonly string[] = []

  before(async () => {
    await dropScratch()
    await provision()
    first = await runMigrations()

    // THE SECOND RUN IS ON A NEW CONNECTION AND A DATABASE THAT SURVIVED THE
    // FIRST. That is the whole experiment: the same client would carry the same
    // resolved search_path cache, and a fresh database would just repeat run 1.
    second = await runMigrations()
  })

  after(dropScratch)

  it('1 · the first run applied every migration, so the subject is real', () => {
    assert.ok(
      first.length > 0,
      'the first run applied nothing, so a second run applying nothing proves ' +
        'nothing — this suite would pass while asserting nothing',
    )
    assert.ok(
      first.some((f) => f.startsWith('0003')),
      `the first run did not reach 0003_tenant_schema.sql (applied: ${first.join(', ')}). ` +
        'That file is what creates schema `tenant`, and schema `tenant` is what ' +
        'moves an unqualified ledger. Without it this suite cannot see the defect.',
    )
  })

  it('2 · the second run applies NOTHING', () => {
    assert.deepEqual(
      [...second],
      [],
      'the second migration run re-applied files. The ledger is being read from ' +
        'a different schema than it was written to: `search_path = tenant, public` ' +
        'makes an unqualified CREATE TABLE land in `tenant` once 0003 exists, and ' +
        'IF NOT EXISTS checks only that schema. Qualify it `public.`.',
    )
  })

  it('3 · and there is exactly ONE ledger, in `public`', async () => {
    const client = await migratorClient()
    try {
      const found = await client.query(
        `SELECT schemaname FROM pg_tables
          WHERE tablename = 'schema_migration' ORDER BY schemaname`,
      )
      const schemas = (found.rows as unknown as Array<{ schemaname: string }>).map(
        (r) => r.schemaname,
      )
      assert.deepEqual(
        schemas,
        ['public'],
        'the ledger exists in more than one schema, or in the wrong one. A second ' +
          'empty ledger in `tenant` is the mechanism behind §2: the runner writes ' +
          'to one and reads from the other.',
      )
    } finally {
      await client.end()
    }
  })
})

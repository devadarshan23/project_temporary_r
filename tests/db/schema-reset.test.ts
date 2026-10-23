/**
 * `resetSchema()` REBUILDS FROM EMPTY — ASSERTED OVER A SCHEMA THAT IS NOT
 * `public`, BECAUSE `public` IS THE ONE IT ALREADY HANDLED.
 *
 * 🛑 THE CLAIM UNDER TEST IS A SENTENCE IN A DOC COMMENT, AND IT WAS FALSE.
 * `db/provision.ts` says of `resetSchema()`: "Rebuilding from the migration
 * makes that state unreachable rather than unlikely." Until 16 Aug 2026 the
 * function issued `DROP SCHEMA IF EXISTS public CASCADE` and nothing else, so
 * the property it asserted held for exactly one schema name. That is
 * `docs/HANDOFF.md` §5's headline shape — a rule keyed on a convenient landmark
 * (`public`) instead of the property it protects (an empty database) — and it
 * was found by a leftover `tenant` schema on a developer machine cancelling 12
 * tests across two files, four of them the RLS negative controls.
 *
 * ⚠️ THE FIXTURE IS DELIBERATELY NOT NAMED `public`. A test that created a table
 * in `public` and watched it disappear would have passed against the broken
 * function, which is the whole point of choosing the other schema.
 *
 * 🛑 AND IT IS DELIBERATELY NOT NAMED `tenant` EITHER, WHICH IS THE HALF THAT
 * MATTERS AFTER #168. That commit answered the same breakage by adding a second
 * hard-coded `DROP SCHEMA IF EXISTS tenant CASCADE`. A fixture named `tenant`
 * would therefore pass against the enumeration as happily as against the derived
 * form, and this file would assert nothing about the difference between them —
 * `docs/HANDOFF.md` §5.6, a check that passes while checking nothing. The
 * fixture is named `leftover`: a name NO migration mentions, so only a reset
 * that derives its drop set can remove it.
 *
 * 🛑 NOTHING BELOW ENUMERATES AN EXPECTED SCHEMA SET, and that is the point of
 * the shape rather than an economy. The assertion is that a reset over a DIRTY
 * database produces exactly what a reset over a CLEAN one produces — the clean
 * run in `before` supplies the baseline. So migration `0004` adding a schema
 * moves the baseline and the expectation together, and this test keeps testing
 * the property on the day someone forgets it exists. Pinning `['public',
 * 'tenant']` here would have re-created, in the test, the exact defect the test
 * exists to catch.
 *
 * ⚠️ ITS OWN DATABASE, for the reason `tests/http/data-plane-http.test.ts`
 * gives: `node --test` runs files concurrently and two files rebuilding one
 * schema produce failures that have nothing to do with either property.
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_RESET_DB_NAME'] ?? runScopedName('reconcile_reset_test')

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { resetSchema, migratorClient } = await import('../../db/provision.ts')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/schema-reset.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   A green run of the suite on a machine with no database is NOT evidence',
      '   that `resetSchema()` rebuilds from empty.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the schema-reset assertions', probe)

/** Every schema that is ours rather than the server's, in a stable order. */
async function ourSchemas(): Promise<readonly string[]> {
  const client = await migratorClient()
  try {
    const found = await client.query(
      `SELECT nspname FROM pg_namespace
        WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'
        ORDER BY nspname`,
    )
    return (found.rows as unknown as Array<{ nspname: string }>).map((r) => r.nspname)
  } finally {
    await client.end()
  }
}

describe('resetSchema() leaves an empty database, not an empty `public`', { skip }, () => {
  /** What a rebuild from empty produces. DERIVED, never written down here. */
  let baseline: readonly string[] = []

  before(async () => {
    await resetSchema()
    baseline = await ourSchemas()

    // A baseline of nothing would make the equality below vacuously true against
    // any implementation at all — §5.6 again. The migrations create at least one
    // schema, so an empty baseline means the rebuild silently did nothing.
    assert.ok(
      baseline.length > 0,
      'the clean rebuild produced NO schemas, so the baseline this file compares ' +
        'against is empty and every assertion below would pass vacuously',
    )
  })

  it('a schema no migration names, left behind by an earlier run, does not survive', async () => {
    // Stand up the wreckage the broken function left: a schema outside `public`
    // holding a relation whose name collides with one the migrations create.
    const setup = await migratorClient()
    try {
      await setup.query('CREATE SCHEMA IF NOT EXISTS leftover')
      await setup.query('CREATE TABLE IF NOT EXISTS leftover.tenant (id text PRIMARY KEY)')
    } finally {
      await setup.end()
    }

    // 🛑 The assertion is that this does not throw. Against the `public`-only
    // form it throws nothing here either — the wreckage simply survives — so the
    // catalogue read below is what actually carries the property.
    await resetSchema()

    const schemas = await ourSchemas()

    assert.ok(
      !schemas.includes('leftover'),
      'THE `leftover` SCHEMA SURVIVED `resetSchema()`. The doc comment on that ' +
        'function says "Rebuilding from the migration makes that state unreachable ' +
        'rather than unlikely" — it is unreachable only for the schema names the ' +
        'function happens to drop, which was `public` alone before 16 Aug 2026 and ' +
        '`public` plus `tenant` after #168. Neither is the property. This is the ' +
        'failure that cancelled 12 tests across two files, four of them the RLS ' +
        `negative controls. Schemas after the rebuild: [${schemas.join(', ')}]`,
    )
    assert.deepEqual(
      schemas,
      baseline,
      'a reset over a DIRTY database did not produce what a reset over a CLEAN one ' +
        'produces, so `resetSchema()` does not rebuild from empty. Expected the ' +
        `baseline [${baseline.join(', ')}] and got [${schemas.join(', ')}]`,
    )
  })

  it('is idempotent — a second reset over its own output changes nothing', async () => {
    // The concrete #168 breakage, kept as its own case: migration `0003` issues a
    // bare `CREATE SCHEMA tenant`, so a reset that fails to drop the schemas the
    // migrations create dies on the NEXT run with `42P06 schema … already
    // exists`. That is a different symptom from the `leftover` case above and it
    // is the one a developer actually hits.
    await resetSchema()
    assert.deepEqual(
      await ourSchemas(),
      baseline,
      'a second `resetSchema()` did not reproduce the first one\'s output',
    )
  })
})

/**
 * THE TENANCY ROSTER — the control-owned half of a staff console, and the
 * columns that are REFUSED because populating them would break invariant 3.
 *
 * G831 (20 Sep 2026), the owner's ruling: *"A control-plane roster table. The
 * tenancy roster is a control-owned fact and lives in the control database,
 * which the consoles read."*
 *
 * ┌─ WHAT IS ASSERTED, AND WHY EACH SECTION EXISTS ───────────────────────────┐
 * │ §1 · THE POSITIVE CONTROL, FIRST. Every refusal below is satisfied by a   │
 * │      database with no roster in it, so the read has to work before any    │
 * │      absence means anything. §5.6.                                        │
 * │ §2 · THE GRANT. `SELECT` and nothing else — witnessed by ATTEMPTING each  │
 * │      write as the application role, not by reading a catalogue row that   │
 * │      says the write would fail.                                          │
 * │ §3 · INVARIANT 3 OVER THE COLUMN SET, DERIVED FROM THE CONTRACT. Every    │
 * │      column is a `TenantSummary` property, and a set of names whose only  │
 * │      possible producer is a tenant read is required ABSENT.               │
 * │ §4 · THE `stage` TRIPWIRE. It is `required` on the wire and has no        │
 * │      column, so `listTenants` cannot ship a complete 200 — a BLOCKER,     │
 * │      and the commit that gives a stage a producer deletes an assertion.   │
 * │ §5 · NO FOREIGN KEY, AND NO CROSS-DATABASE CONSTRAINT IS POSSIBLE.        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT SKIPS LOUDLY, like every other file here that needs a database, and the
 * skip is honest only while it is loud: a run in which this file skipped is not
 * evidence that the application role cannot write the tenancy roster.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE, NAMED BEFORE ANYTHING READS THE VARIABLE.
 *
 * The contended resource is the shared cluster, so every suite that provisions
 * takes its own name — `tests/http/control-plane-http.test.ts`'s discipline,
 * and `server/control-plane/config.ts` resolves per call rather than at import,
 * which is what makes setting it here sufficient.
 * ------------------------------------------------------------------ */

const CONTROL_DB = process.env['RECONCILE_ROSTER_TEST_DB_NAME'] ?? runScopedName('reconcile_control_roster_test')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/tenancy-roster.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS FILE CARRIES THE GRANT ON THE TENANCY ROSTER. A run in which it',
      '   skipped is NOT evidence that a serving process cannot mint a tenant —',
      '   which, under H1.1, is a permanent choice of residency.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the tenancy roster’s grant and column set', probe)

/* ------------------------------------------------------------------ *
 * The seam.
 * ------------------------------------------------------------------ */

import { loadTier } from '../../server/contract/document.ts'
import { createCataloguePool, type CataloguePool } from '../../server/control-plane/db.ts'
import {
  provisionControlPlane,
  seedTenancyRoster,
} from '../../server/control-plane/provision.ts'
import { readTenancyRoster } from '../../server/control-plane/roster-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

const TABLE = 'tenancy_roster'

async function createControlDatabase(): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-roster-test-setup',
  })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [CONTROL_DB])
    // CREATE DATABASE cannot run inside a transaction block, hence no BEGIN.
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await admin.end()
  }
}

/** `TenantSummary`'s declared property names, read from the contract itself. */
function tenantSummary(): { properties: string[]; required: string[] } {
  const doc = loadTier('platformConsole') as unknown as {
    components: { schemas: Record<string, { properties?: object; required?: string[] }> }
  }
  const schema = doc.components.schemas['TenantSummary']
  assert.ok(schema !== undefined, '`TenantSummary` is not declared on the platform-console tier')
  return {
    properties: Object.keys(schema.properties ?? {}),
    required: schema.required ?? [],
  }
}

/** camelCase -> snake_case, the only place this correspondence is written. */
function columnFor(property: string): string {
  return property.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

let pool: CataloguePool | undefined
let columns: readonly string[] = []

describe('the tenancy roster — a control-owned fact, readable and unwritable', { skip }, () => {
  before(async () => {
    await createControlDatabase()
    await provisionControlPlane()
    await seedTenancyRoster()
    pool = await createCataloguePool()
    const cols = await pool.query(
      `SELECT column_name::text AS name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`,
      [TABLE],
    )
    columns = (cols.rows as unknown as { name: string }[]).map((r) => r.name)
  })

  after(async () => {
    if (pool !== undefined) await pool.end().catch(() => undefined)
  })

  /* ================================================================ *
   * §1 · THE POSITIVE CONTROL, FIRST.
   * ================================================================ */

  describe('§1 · the application role can READ the roster', () => {
    it('1a · the reader returns the seeded fleet, in id order', async () => {
      assert.ok(pool !== undefined, 'no pool')
      const rows = await readTenancyRoster(pool)
      assert.ok(
        rows.length >= 3,
        'the roster came back with fewer than the three rows `seedTenancyRoster()` writes, so ' +
          'every absence asserted below would also be true of an empty table — §5.6. ' +
          `Got ${rows.length}.`,
      )
      assert.deepEqual(
        [...rows].map((r) => r.tenant_id),
        [...rows].map((r) => r.tenant_id).sort(),
        'the reader did not return rows in id order, and `ORDER BY tenant_id ASC` is the ' +
          'whole of what its statement adds over a bare SELECT',
      )
    })

    it('1b · `plan` is nullable and the fixture exercises the null', async () => {
      assert.ok(pool !== undefined, 'no pool')
      const rows = await readTenancyRoster(pool)
      assert.ok(
        rows.some((r) => r.plan === null),
        'no seeded row carries a null `plan`, so `RosterRow.plan: string | null` is a claim ' +
          'nothing witnesses. `TenantSummary` does not mark `plan` required and H1.1`s four ' +
          'creation decisions do not include one — a reader that assumed a string must fail ' +
          'against a fixture rather than against a customer.',
      )
    })
  })

  /* ================================================================ *
   * §2 · THE GRANT. `SELECT` AND NOTHING ELSE, ATTEMPTED RATHER THAN
   *      READ OFF A CATALOGUE.
   * ================================================================ */

  describe('§2 · the serving process cannot write the thing it serves', () => {
    it('2a · the catalogue says SELECT and only SELECT', async () => {
      assert.ok(pool !== undefined, 'no pool')
      const granted = await pool.query(
        `SELECT privilege_type::text AS p
           FROM information_schema.role_table_grants
          WHERE table_schema = 'public' AND table_name = $1
            AND grantee = 'reconcile_control_app'
          ORDER BY privilege_type`,
        [TABLE],
      )
      assert.deepEqual(
        (granted.rows as unknown as { p: string }[]).map((r) => r.p),
        ['SELECT'],
        '`reconcile_control_app` holds a privilege on `tenancy_roster` other than SELECT. ' +
          '`db/migrations-control/0001_catalogue.sql`: "a serving process that cannot write ' +
          'the thing it serves is one fewer way for a published artefact to change under a ' +
          'plane that is pulling it." The WRITER is `createTenant`, which is not mounted, and ' +
          '`db/migrations/0004_subject_ledger.sql` refuses a write privilege ahead of one.',
      )
    })

    it('2b · and the database REFUSES each write when it is actually attempted', async () => {
      assert.ok(pool !== undefined, 'no pool')
      const attempts: ReadonlyArray<readonly [string, string, readonly unknown[]]> = [
        [
          'INSERT — minting a tenant, which fixes residency permanently under H1.1',
          `INSERT INTO ${TABLE} (tenant_id, name, deployment_mode, residency, support_access_mode)
             VALUES ($1, 'Forged', 'hosted', 'us-west-2', 'never')`,
          ['ten_forged'],
        ],
        [
          'UPDATE — moving a tenant`s residency, which is invariant 7 at the only moment it is set',
          `UPDATE ${TABLE} SET residency = 'eu-central-1' WHERE tenant_id = $1`,
          ['ten_acme'],
        ],
        [
          'DELETE — erasing a tenant from the fleet roster',
          `DELETE FROM ${TABLE} WHERE tenant_id = $1`,
          ['ten_acme'],
        ],
      ]

      for (const [label, sql, values] of attempts) {
        let refused = false
        try {
          await pool.query(sql, values)
        } catch {
          refused = true
        }
        assert.ok(
          refused,
          `the application role performed a write it holds no privilege for — ${label}. ` +
            'A catalogue row saying the grant is absent is a statement about a grant; this ' +
            'is a statement about the database.',
        )
      }

      /* The read still works after three refusals, so 2b did not pass by
         breaking the connection. */
      const still = await readTenancyRoster(pool)
      assert.ok(still.length >= 3, 'the roster is unreadable after the refused writes')
    })
  })

  /* ================================================================ *
   * §3 · INVARIANT 3 OVER THE COLUMN SET — DERIVED FROM THE CONTRACT,
   *      NOT LISTED HERE.
   * ================================================================ */

  describe('§3 · every column is a control-owned fact', () => {
    it('3a · every column of the table is a declared `TenantSummary` property', () => {
      const declared = new Set(tenantSummary().properties.map(columnFor))
      assert.ok(declared.size > 3, 'the contract did not parse, so this absence is vacuous')
      assert.ok(columns.length > 0, 'the table has no columns, so this absence is vacuous')
      const strangers = columns.filter((c) => !declared.has(c))
      assert.deepEqual(
        strangers,
        [],
        'a column on `tenancy_roster` corresponds to no property of `TenantSummary`. This is ' +
          'the control that keeps invariant 3 enforceable over the COLUMN SET rather than over ' +
          'prose: every column here is an identifier or a closed vocabulary the platform chose, ' +
          'and the moment one is not, the rule stops being mechanical. ' +
          `Found: [${strangers.join(', ')}]`,
      )
    })

    it('3b · the columns whose only producer would be a TENANT READ are ABSENT', () => {
      /**
       * 🛑 THE DECIDING TEST IS THE PRODUCER, NOT THE READER. A column ahead of
       * its reader is `db/migrations/0004_subject_ledger.sql`'s refusal and is
       * merely wasteful. A column whose only possible producer is a read of
       * `tenant.exception`, `public.run`, `tenant."user"` or
       * `tenant.usage_record` is invariant 3 broken at the moment the column is
       * FILLED, in a database that has no credential reaching any of them.
       *
       * ⚠️ NAMED RATHER THAN DISCOVERED. These are the columns a roster screen
       * most obviously wants, and the migration refuses each one on its own
       * face. This list must agree with that file's refusals; a name added
       * here without a refusal there is a test asserting somebody's opinion.
       */
      const refused = [
        'stage',
        'stage_note',
        'sold_via_partner_id',
        'open_exception_count',
        'document_count',
        'run_count',
        'last_run_at',
        'value_at_risk_minor',
        'spend_minor',
        'usage_units',
        'user_count',
        'last_sign_in_at',
        'health',
        'status',
        'created_at',
        'retention',
      ]
      assert.ok(columns.length > 0, 'the table has no columns, so this absence is vacuous')
      const present = refused.filter((r) => columns.includes(r))
      assert.deepEqual(
        present,
        [],
        'a column this migration refuses BY NAME has been added to `tenancy_roster`. Read ' +
          '`db/migrations-control/0002_tenancy_roster.sql`s refusals block before deleting ' +
          'this assertion: every name here is refused because the only thing that could FILL ' +
          'it is a read of the data plane`s tenant tables, and invariant 3 is *"the control ' +
          'plane publishes downward and never reads tenant data"*. ' +
          `Found: [${present.join(', ')}]`,
      )
    })

    it('3c · and the migration refuses each of those names in its own text', async () => {
      /**
       * 🛑 THE OTHER DIRECTION, AND IT IS WHAT STOPS §3b BEING A LIST IN A TEST
       * FILE. An absence asserted here and argued nowhere is a rule a reader
       * meets only when it fires. `0010`, `0011` and `0091` all refuse columns
       * by name on the migration's face, and this requires the same of `0002`.
       */
      const { readFileSync } = await import('node:fs')
      const path = await import('node:path')
      const sql = readFileSync(
        path.join(
          import.meta.dirname,
          '..',
          '..',
          'db',
          'migrations-control',
          '0002_tenancy_roster.sql',
        ),
        'utf8',
      )
      assert.ok(sql.includes('CREATE TABLE'), 'the migration did not load')
      for (const name of ['stage', 'sold_via_partner_id', 'value_at_risk_minor', 'health']) {
        assert.ok(
          sql.includes(name),
          `\`${name}\` is refused by §3b and is not named anywhere in the migration, so a ` +
            'reader of the schema has no way to learn why it is absent. Refuse it on the ' +
            "file's face or stop asserting it here.",
        )
      }
    })
  })

  /* ================================================================ *
   * §4 · THE `stage` TRIPWIRE — AND IT IS NOT A BLOCKER ANY MORE.
   *
   * ⚠️ **THIS HEADING READ "A BLOCKER, NOT A GAP" AND THE SUITE NAME READ
   *    "`listTenants` cannot ship a complete 200 and this is why", UNTIL
   *    20 Sep 2026 — G1241, THE OWNER'S RULING. BOTH ARE CORRECTED RATHER
   *    THAN DELETED, because they are the sentences five files carried and
   *    the ones a reader would have quoted before deciding not to mount.**
   *
   *        "Onboarding state lives in a table in the CONTROL database, one
   *         row per tenant, beside the roster — and `stage` is DERIVED at
   *         read time from the stored step state, never stored twice."
   *
   * 🛑 **§4a AND §4b ARE UNCHANGED TO THE CHARACTER AND BOTH STILL PASS,
   *    WHICH IS THE WHOLE SHAPE OF THE RULING: G833's REFUSAL OF A `stage`
   *    COLUMN IS NOT DISCHARGED — IT IS WHAT MADE A DERIVATION NECESSARY.**
   *    What was false was the INFERENCE drawn from them, that an absent
   *    column means an absent producer. §4c is the assertion that now
   *    carries the difference, and `tests/http/console-roster-served.test.ts`
   *    §2 is where the complete 200 is checked field by field, in bytes.
   * ================================================================ */

  describe('§4 · `stage` has no column here, and it has a producer elsewhere', () => {
    it('4a · `stage` is `required` on `TenantSummary` and has no column', () => {
      const { required } = tenantSummary()
      assert.ok(
        required.includes('stage'),
        '`stage` is no longer `required` on `TenantSummary`. If that is deliberate, this ' +
          'tripwire is discharged and the paragraph in ' +
          '`db/migrations-control/0002_tenancy_roster.sql` that calls the refusal a BLOCKER ' +
          'is now wrong — correct it there rather than deleting this.',
      )
      assert.ok(
        !columns.includes('stage'),
        'a `stage` column exists. G833 refused it because `model/onboarding.ts`s ' +
          '`onboardingStage()` DERIVES a stage from an `OnboardingRecord` and nothing ' +
          'persists one — `tests/http/administration-tier-unmounted.test.ts` §4a asserts ' +
          'that absence across both migration sets. A stage column HERE is a second home ' +
          'for onboarding state, in a different database from the one H2`s six steps will ' +
          'be written in. §5.3: the copy is what drifts.',
      )
    })

    it('4b · so the roster cannot satisfy every required property, and that is measured', () => {
      const { required } = tenantSummary()
      const missing = required.filter((p) => !columns.includes(columnFor(p)))
      assert.deepEqual(
        missing,
        ['stage'],
        'the set of REQUIRED `TenantSummary` properties with no column has changed. ' +
          '🛑 G656`s finding is why this matters and why it is a blocker rather than a gap: ' +
          '`fast-json-stringify` serialises WITHOUT VALIDATING, so mounting `listTenants` ' +
          'against a partial table ships a 200 missing its own required fields SILENTLY. ' +
          'If this list is now empty, the last blocker in the TABLE layer is gone and the ' +
          'remaining one is the topology — read ' +
          '`tests/http/console-roster-unreachable.test.ts`. ' +
          `Missing: [${missing.join(', ')}]`,
      )
    })

    it('4c · and `stage` HAS a producer — a derivation, in the other set of tables', async () => {
      /**
       * 🛑 **THE ASSERTION THAT REPLACES AN INFERENCE RATHER THAN A TEST.**
       * §4a and §4b prove there is no `stage` COLUMN on this table and neither
       * ever proved there is no `stage` PRODUCER — the gap between those two is
       * where five files' worth of "`listTenants` cannot ship a complete 200"
       * lived, and G1241 is where it closed. Nothing above this line moved.
       *
       * ⚠️ THE ONE THING A NEXT READER MIGHT DO WRONG IS SATISFY THIS WITH A
       * COLUMN, so the two halves are asserted together: the derivation's INPUT
       * exists in `db/migrations-control/`, and `stage` is still not a column
       * anywhere in that set.
       */
      const path = await import('node:path')
      const { sqlCode, sqlCorpus, sqlCorpusIsReal } = await import('../sql-code.ts')
      const dir = path.join(import.meta.dirname, '..', '..', 'db', 'migrations-control')
      const sql = sqlCode(sqlCorpus(dir))
      sqlCorpusIsReal(sql, 'the control migration set')

      assert.ok(
        /CREATE TABLE ("?)onboarding_record\1\s*\(/.test(sql),
        '`onboarding_record` is not in the control migration set, so `stage` has no producer ' +
          'and `listTenants` is back to the blocker §4b describes. If that is deliberate, ' +
          'the mount in `server/data-plane/start.ts` has to go with it.',
      )
      assert.ok(
        !/\bstage\b/.test(sql),
        'a `stage` column exists somewhere in the control migration set. The owner ruled it ' +
          'DERIVED at read time and never stored twice, and G833 refused it before that: it ' +
          'is a two-armed function OF the prefix length, so storing the output beside the ' +
          'input means the two drift the first time a step is FORCED — forcing moves ' +
          '`completed` by more than one.',
      )
    })
  })

  /* ================================================================ *
   * §5 · NO FOREIGN KEY, AND NONE IS POSSIBLE.
   * ================================================================ */

  describe('§5 · the roster names tenants it cannot reference', () => {
    it('5a · `tenant_id` is a primary key and references nothing', async () => {
      assert.ok(pool !== undefined, 'no pool')
      const cons = await pool.query(
        `SELECT contype::text AS kind
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public' AND t.relname = $1
          ORDER BY contype`,
        [TABLE],
      )
      const kinds = (cons.rows as unknown as { kind: string }[]).map((r) => r.kind)
      assert.ok(kinds.includes('p'), 'the roster has no primary key')
      assert.ok(
        !kinds.includes('f'),
        'the roster carries a FOREIGN KEY. `tenant.tenant` is in the OTHER database and ' +
          'PostgreSQL has no cross-database reference, so a key here can only point at ' +
          'something inside `reconcile_control` — which would be a second, invented notion ' +
          'of what a tenant is. The migration states the cost instead: a roster row can name ' +
          'a tenant that does not exist, and nothing in either database will say so.',
      )
    })
  })
})

/**
 * THE RUN-ADMISSION SUBSTRATE, AGAINST A REAL POSTGRESQL —
 * `db/migrations/0069_run_admission.sql`. G691–G694, 19 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS SUITE IS FOR, AND WHY `tests/model/run-admission.test.ts` DOES
 *    NOT COVER IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `admitRun()` refusing is a statement about a code path somebody could forget
 * to call. These are statements about what the DATABASE will accept from ANY
 * caller holding the app role — a handler with a bug, an operation nobody has
 * written yet, or a `psql` session with the application's own credentials:
 *
 *   · Three new tables, each `ENABLE`d **and `FORCE`d**, each carrying 0001's
 *     predicate on `USING` **and** `WITH CHECK`.
 *   · `SELECT` and nothing else on all three. A path that could write a
 *     definition could set its own `status = 'active'`; one that could write a
 *     period could reopen a closed one; one that could delete a slot could
 *     turn a `slot_fill_incomplete` refusal into an admission by removing the
 *     requirement rather than satisfying it.
 *   · **The unique index IS the idempotency guarantee.** §4 is the one
 *     assertion in this file that cannot be replaced by reading the migration:
 *     two `INSERT`s of the same key, and exactly one row.
 *   · `run_rls` is UNCHANGED by the two `ALTER TABLE … ADD COLUMN`s, read back
 *     from `pg_policies` rather than from the file.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ALLOW ARM IS FIRST, DELIBERATELY. A control whose only observable
 *    behaviour is refusal is §5.6 — eleven refusals with no permitted case
 *    pass identically against a role that has no `SELECT` either.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE MUTATION PASS ────────────────────────────────────────────────────────┐
 * │ Recorded in the pull request with its exact failure text. Each mutation is │
 * │ at the LAST WRITER of the property, which for every one of these is        │
 * │ `db/migrations/0069_run_admission.sql` itself.                             │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  DEFINITION_ADMITS_A_RUN,
  PERIOD_ADMITS_A_RUN,
  CARDINALITY_REQUIRES_A_DOCUMENT,
} from '../../model/run-admission.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. `db/env.ts` resolves `RECONCILE_DB_NAME` per call and
 * never at import, and two suites sharing one name race inside
 * `createDatabase()` — the signature is `fail 0` with a non-zero exit and
 * `cancelled` suites, which is contention and not a finding.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RUN_ADMISSION_DB_NAME'] ?? runScopedName('reconcile_run_admission_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const ACME_DEF = 'def_acme_ap_close'
const GLOBEX_DEF = 'def_globex_ap_close'
const ACME_PERIOD = 'per_acme_2026_03'

/** 0001's predicate, VERBATIM, as PostgreSQL renders it back. */
const PREDICATE =
  "(tenant_id = NULLIF(current_setting('app.tenant_id'::text, true), ''::text))"

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/run-admission.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER `db/migrations/0069`. A run in which it',
      '   skipped is NOT evidence that the three new tables are tenant-isolated,',
      '   NOT evidence that the app role cannot write a definition, and NOT',
      '   evidence that `admitRun` is idempotent — the last of which is the whole',
      '   guarantee the operation is named for.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

databaseRequiredUnderCi('the run-admission substrate assertions', probe)

async function asMigrator<T>(
  fn: (q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>,
): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    await q(
      `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
       VALUES ($1, $2, 7, 'active'), ($3, $4, 2, 'active')`,
      [ACME, ACME_DEF, GLOBEX, GLOBEX_DEF],
    )
    await q(
      `INSERT INTO tenant.definition_slot (tenant_id, definition_id, slot, cardinality)
       VALUES ($1, $2, 'invoice', 'optional'), ($1, $2, 'goods_receipt', 'optional')`,
      [ACME, ACME_DEF],
    )
    await q(
      `INSERT INTO tenant.reconciliation_period (tenant_id, id, status)
       VALUES ($1, $2, 'open')`,
      [ACME, ACME_PERIOD],
    )
  })
}

describe('the run-admission substrate', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(1)
  })

  after(async () => {
    if (pool !== undefined) await pool.end()
  })

  /* ================================================================ *
   * §1 · THE ALLOW ARM, FIRST. Without it every refusal below passes
   *      against a role holding no privilege at all.
   * ================================================================ */

  it('1 · the app role reads its own definition, its slots and its period', async () => {
    const seen = await withTenantScope(pool, ACME, async (tx) => {
      const d = await tx.query('SELECT id, version, status FROM tenant.reconciliation_definition')
      const s = await tx.query('SELECT slot, cardinality FROM tenant.definition_slot')
      const p = await tx.query('SELECT id, status FROM tenant.reconciliation_period')
      return { d: d.rows, s: s.rows, p: p.rows }
    })
    assert.equal(seen.d.length, 1, 'the definition is unreadable to the app role inside its own scope')
    assert.equal((seen.d[0] as { version: number }).version, 7)
    assert.equal(seen.s.length, 2)
    assert.equal(seen.p.length, 1)
  })

  /* ================================================================ *
   * §2 · INVARIANT 1. Another tenant's configuration is invisible, and
   *      it is invisible BY ITS EXACT ID — the id is seeded and known.
   * ================================================================ */

  it('2 · another tenant`s definition is invisible, asked for by its exact id', async () => {
    const rows = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query(
        'SELECT id FROM tenant.reconciliation_definition WHERE id = $1',
        [GLOBEX_DEF],
      )
      return r.rows
    })
    assert.equal(rows.length, 0, 'GLOBEX`s definition is visible inside ACME`s scope')
  })

  it('2b · a read OUTSIDE a tenant scope sees nothing at all — G100 denies on NULL', async () => {
    const client = await pool.connect()
    try {
      const r = await client.query('SELECT id FROM tenant.reconciliation_definition', [])
      assert.equal(
        r.rows.length,
        0,
        'a query with no `app.tenant_id` returned rows. G100`s whole content is that a ' +
          'forgotten transaction yields an EMPTY result set, never another tenant`s rows.',
      )
    } finally {
      client.release()
    }
  })

  /* ================================================================ *
   * §2c · THE NEGATIVE CONTROL. Without it §2 passes against a table
   *       the app role simply cannot read for any reason.
   * ================================================================ */

  it('2c · with RLS DISABLED on the definition table the SAME read LEAKS both tenants', async () => {
    await asMigrator(async (q) => {
      await q('ALTER TABLE tenant.reconciliation_definition DISABLE ROW LEVEL SECURITY')
    })
    try {
      const rows = await withTenantScope(pool, ACME, async (tx) => {
        const r = await tx.query('SELECT id FROM tenant.reconciliation_definition')
        return r.rows
      })
      assert.equal(
        rows.length,
        2,
        'WITH RLS OFF THE READ DID NOT LEAK, so §2 is not evidence that the POLICY is what ' +
          'isolates this table. Something else — a privilege, a predicate, an empty table — ' +
          'is producing the isolation §2 credits to the policy.',
      )
    } finally {
      await asMigrator(async (q) => {
        await q('ALTER TABLE tenant.reconciliation_definition ENABLE ROW LEVEL SECURITY')
        await q('ALTER TABLE tenant.reconciliation_definition FORCE ROW LEVEL SECURITY')
      })
    }
  })

  /* ================================================================ *
   * §3 · LEAST PRIVILEGE. `SELECT` and nothing else, on all three.
   * ================================================================ */

  it('3 · the app role cannot INSERT, UPDATE or DELETE any of the three tables', async () => {
    const attempts: ReadonlyArray<readonly [string, string, readonly unknown[]]> = [
      [
        'INSERT definition',
        `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
         VALUES ($1, 'def_forged', 1, 'active')`,
        [ACME],
      ],
      [
        'UPDATE definition',
        `UPDATE tenant.reconciliation_definition SET version = 99 WHERE id = $1`,
        [ACME_DEF],
      ],
      [
        'DELETE slot',
        `DELETE FROM tenant.definition_slot WHERE definition_id = $1`,
        [ACME_DEF],
      ],
      [
        'UPDATE period',
        `UPDATE tenant.reconciliation_period SET status = 'open' WHERE id = $1`,
        [ACME_PERIOD],
      ],
      [
        'INSERT period',
        `INSERT INTO tenant.reconciliation_period (tenant_id, id, status)
         VALUES ($1, 'per_forged', 'open')`,
        [ACME],
      ],
    ]

    for (const [label, sql, params] of attempts) {
      let refused = ''
      try {
        await withTenantScope(pool, ACME, async (tx) => {
          await tx.query(sql, params)
        })
      } catch (err) {
        refused = err instanceof Error ? err.message : String(err)
      }
      assert.match(
        refused,
        /permission denied/i,
        `\`${label}\` was NOT refused by the DATABASE. \`db/migrations/0069\` grants SELECT and ` +
          'nothing else on all three tables, and each refusal is a different argument: a path ' +
          'that could write a definition controls `definition_not_active`; one that could ' +
          'delete a slot turns `slot_fill_incomplete` into an admission by removing the ' +
          'requirement; one that could write a period reopens a closed one. ' +
          `Got: ${refused === '' ? 'the statement SUCCEEDED' : refused}`,
      )
    }
  })

  /* ================================================================ *
   * §4 · THE UNIQUE INDEX IS THE IDEMPOTENCY GUARANTEE.
   *
   * 🛑 THE ONE ASSERTION HERE THAT CANNOT BE REPLACED BY READING THE
   *    MIGRATION. Delete `CREATE UNIQUE INDEX run_idempotency_key` and
   *    `admitRun` goes from idempotent to usually-idempotent — and nothing
   *    else in the tree notices, because the handler's `ON CONFLICT` simply
   *    stops conflicting.
   * ================================================================ */

  const insertRun = (id: string, key: string) =>
    `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,
                      trigger_kind, trigger_by_user_id, status, inputs, started_at,
                      idempotency_key)
     VALUES ('${ACME}', '${id}', '${ACME_DEF}', 7, NULL,
             'manual', 'usr_acme_admin', 'queued', '{}'::jsonb, now(), ${key})`

  it('4 · two runs with the same idempotency key cannot both exist', async () => {
    const key = "'idem_same_basis'"
    const first = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query(
        `${insertRun('run_first', key)}
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING RETURNING id`,
        [],
      )
      return r.rows.length
    })
    const second = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query(
        `${insertRun('run_second', key)}
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING RETURNING id`,
        [],
      )
      return r.rows.length
    })

    assert.equal(first, 1, 'the first insert of a fresh key did not create a row')
    assert.equal(
      second,
      0,
      'THE SECOND INSERT OF THE SAME BASIS CREATED A SECOND RUN. `db/migrations/0069` §4: the ' +
        'unique index IS the guarantee and the handler`s `ON CONFLICT` is how it is read. ' +
        'Without it, an operator pressing Run while an `ingest` trigger fires gets two runs ' +
        'over identical inputs — two sets of exceptions over the same break, and a queue that ' +
        'has doubled for no reason a user can see.',
    )

    const total = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query('SELECT id FROM run WHERE idempotency_key = $1', ['idem_same_basis'])
      return r.rows.length
    })
    assert.equal(total, 1)
  })

  it('4b · a NULL idempotency key does not collide with another NULL', async () => {
    const rows = await withTenantScope(pool, ACME, async (tx) => {
      await tx.query(insertRun('run_null_a', 'NULL'), [])
      await tx.query(insertRun('run_null_b', 'NULL'), [])
      const r = await tx.query('SELECT id FROM run WHERE idempotency_key IS NULL', [])
      return r.rows.length
    })
    assert.equal(
      rows,
      2,
      'TWO RUNS WITH NO BASIS COLLIDED. PostgreSQL treats NULLs as DISTINCT in a unique index ' +
        'by default and `db/migrations/0069` §4 relies on it — `NULLS NOT DISTINCT` would make ' +
        'the FIRST run written by a non-manual trigger block every one after it.',
    )
  })

  it('4c · the same basis in ANOTHER tenant is a different run, not a conflict', async () => {
    const created = await withTenantScope(pool, GLOBEX, async (tx) => {
      const r = await tx.query(
        `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,
                          trigger_kind, status, started_at, idempotency_key)
         VALUES ('${GLOBEX}', 'run_globex', '${GLOBEX_DEF}', 2, NULL,
                 'manual', 'queued', now(), 'idem_same_basis')
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING RETURNING id`,
        [],
      )
      return r.rows.length
    })
    assert.equal(
      created,
      1,
      'GLOBEX COULD NOT ADMIT A RUN BECAUSE ACME HAD THE SAME BASIS. The index is ' +
        '`(tenant_id, idempotency_key)` and not `(idempotency_key)`; a global one would make ' +
        'one tenant`s run admission depend on another tenant`s, which is a cross-tenant ' +
        'coupling no policy could undo.',
    )
  })

  /* ================================================================ *
   * §5 · `run_rls` SURVIVED THE TWO `ALTER TABLE … ADD COLUMN`s.
   *
   * 🛑 READ BACK FROM `pg_policies`, NOT FROM THE FILE. The whole expression,
   *    both halves, byte-compared against 0001's predicate — because
   *    `ALTER POLICY` REPLACES EVERYTHING and a near-miss parses cleanly.
   *    `db/migrations/0069` issues no `ALTER POLICY` at all and this is the
   *    assertion that says so from the catalogue's side.
   * ================================================================ */

  it('5 · `run_rls` still carries 0001`s predicate on BOTH halves', async () => {
    const row = await asMigrator(async (q) => {
      const r = await q(
        `SELECT qual, with_check FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'run' AND policyname = 'run_rls'`,
      )
      return r.rows[0] as { qual: string; with_check: string } | undefined
    })
    assert.notEqual(row, undefined, '`run_rls` is gone from the catalogue')
    assert.equal(
      row?.qual,
      PREDICATE,
      'THE `USING` HALF OF `run_rls` IS NOT 0001`s PREDICATE. `db/migrations/0069` adds two ' +
        'columns to `run` and issues no `ALTER POLICY`; if this has changed, something else ' +
        'replaced the whole expression, which is what `ALTER POLICY` does.',
    )
    assert.equal(
      row?.with_check,
      PREDICATE,
      'THE `WITH CHECK` HALF OF `run_rls` IS NOT 0001`s PREDICATE — and it is the half ' +
        '`admitRun` depends on: the handler passes `tenant_id` as a COLUMN VALUE and this is ' +
        'what refuses an INSERT naming another tenant.',
    )
  })

  it('5b · all three new tables ENABLE and FORCE row level security', async () => {
    const rows = await asMigrator(async (q) => {
      const r = await q(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant'
            AND c.relname IN ('reconciliation_definition','definition_slot','reconciliation_period')
          ORDER BY c.relname`,
      )
      return r.rows as Array<{
        relname: string
        relrowsecurity: boolean
        relforcerowsecurity: boolean
      }>
    })
    assert.equal(rows.length, 3, 'one of the three tables is missing from the catalogue')
    for (const t of rows) {
      assert.equal(t.relrowsecurity, true, `${t.relname} does not ENABLE row level security`)
      assert.equal(
        t.relforcerowsecurity,
        true,
        `${t.relname} does not FORCE row level security. ENABLE alone leaves the TABLE OWNER ` +
          'exempt, and 0001 states the consequence: a test that connects as the owner passes ' +
          'with the policy doing nothing, and passes just as well with the policy dropped.',
      )
    }
  })

  /* ================================================================ *
   * §6 · THE THREE TOTAL RECORDS ARE NOT MIRRORED IN SQL, AND THAT IS
   *      ASSERTED RATHER THAN ASSUMED.
   *
   * `db/migrations/0069` declines a `CHECK` on `status` and on `cardinality`
   * on `0007`'s ground — a third copy of a vocabulary, in the one place no
   * pair in `tools/check-wire-mirror.mjs` addresses. This is the tripwire: a
   * later commit that adds one must delete this assertion and argue for it.
   * ================================================================ */

  it('6 · no CHECK constraint mirrors a model vocabulary on any of the three tables', async () => {
    const rows = await asMigrator(async (q) => {
      const r = await q(
        `SELECT conrelid::regclass::text AS tbl, pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE contype = 'c'
            AND conrelid IN ('tenant.reconciliation_definition'::regclass,
                             'tenant.definition_slot'::regclass,
                             'tenant.reconciliation_period'::regclass)`,
      )
      return r.rows as Array<{ tbl: string; def: string }>
    })
    assert.deepEqual(
      rows,
      [],
      'A `CHECK` APPEARED ON ONE OF THE THREE TABLES. `db/migrations/0069` refuses one by name: ' +
        'the vocabularies live in `model/run-admission.ts``s three total records, and a SQL ' +
        'copy is a third place to drift AND the one nothing compares — no pair in ' +
        '`tools/check-wire-mirror.mjs` addresses SQL. The polarity matters too: an UNKNOWN ' +
        'value must reach the model as an `*_unreadable` refusal, not be rejected at write ' +
        `time by a list somebody forgot to extend. Found: ${JSON.stringify(rows)}`,
    )
  })

  it('6b · the seeded reference values are members of the model`s own records', () => {
    /* A cheap join between the fixture and the model, in both directions —
     * `0008`'s discipline for a mirrored list, applied to a fixture instead. */
    assert.equal(DEFINITION_ADMITS_A_RUN['active'], true)
    assert.equal(PERIOD_ADMITS_A_RUN['open'], true)
    assert.equal(CARDINALITY_REQUIRES_A_DOCUMENT['optional'], false)
    assert.equal(
      Object.keys(PERIOD_ADMITS_A_RUN).length,
      4,
      '`ReconciliationPeriod.status` has four members and `PERIOD_ADMITS_A_RUN` must answer ' +
        'each; a fifth is a `TS1360` at the literal and this is the runtime half of it.',
    )
  })
})

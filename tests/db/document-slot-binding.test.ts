/**
 * THE BINDING, AGAINST A REAL POSTGRESQL —
 * `db/migrations/0150_document_slot_binding.sql`. G961–G964, 20 Sep 2026.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS SUITE IS FOR, AND WHY `tests/http/slot-fill-served.test.ts`
 *    DOES NOT COVER IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * That suite drives the HANDLER: it proves that a bound document admits a run
 * and an unbound one does not. These are statements about what the DATABASE
 * will accept from ANY caller holding the app role — a handler with a bug, an
 * operation nobody has written yet, or a `psql` session with the application's
 * own credentials:
 *
 *   · One new table, `ENABLE`d **and `FORCE`d**, carrying 0001's predicate on
 *     `USING` **and** `WITH CHECK` — read back from `pg_policies` and
 *     byte-compared against a SIBLING policy this migration did not touch,
 *     because a near-miss parses cleanly (`0020` records that near-miss).
 *   · **`SELECT` and nothing else.** A path that could INSERT here could bind a
 *     document of its own choosing into a required slot and then admit a run
 *     against it — `slot_fill_incomplete` becomes a refusal the caller
 *     controls, and `run.inputs` becomes an operand set the reconciled party
 *     selected. §3 is the assertion; the migration's GRANTS block is the
 *     argument.
 *   · **The two partial unique indexes are load-bearing and §4 is the only
 *     place that says so.** `slotFillBasis()` sorts and does not dedupe, so one
 *     document bound twice into one slot is a DIFFERENT basis from the same
 *     document bound once — a second run over identical inputs, which is the
 *     exact race `admitRun` is named for closing.
 *   · The three foreign keys, each buying a refusal the model therefore does
 *     not carry an arm for — including the one that must NOT fire: under MATCH
 *     SIMPLE a NULL `period_id` is satisfied without a lookup, which is §2's
 *     semantics expressed as a constraint.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ALLOW ARM IS FIRST, DELIBERATELY. A control whose only observable
 *    behaviour is refusal is §5.6 — every refusal below passes identically
 *    against a role that has no `SELECT` either, or against an empty table.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE MUTATION PASS, RUN BEFORE THIS FILE WAS COMMITTED ────────────────────┐
 * │ Each mutation is at the LAST WRITER of the property, which for both of     │
 * │ these is `db/migrations/0150_document_slot_binding.sql` itself. Fifteen    │
 * │ assertions, fifteen run:                                                   │
 * │                                                                            │
 * │   `GRANT SELECT` → `GRANT SELECT, INSERT, UPDATE, DELETE`                  │
 * │       → 14 pass, **§3 fails**, and NOTHING ELSE IN THE GATE NOTICES — the  │
 * │         served suite is green throughout, because a widened grant changes  │
 * │         no answer this product currently gives.                            │
 * │   `document_slot_binding_unperiodised` deleted                             │
 * │       → 12 pass, **§4b fails first**, with §4c and §6d falling behind it   │
 * │         because the duplicate row §4b then wrote is still in the table.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. `db/env.ts` resolves `RECONCILE_DB_NAME` per call and
 * never at import, and two suites sharing one name race inside
 * `createDatabase()`.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SLOT_BINDING_DB_NAME'] ?? runScopedName('reconcile_slot_binding_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const ACME_DEF = 'def_acme_ap_close'
const GLOBEX_DEF = 'def_globex_ap_close'
const ACME_PERIOD = 'per_acme_2026_03'
const ACME_DOC = 'doc_acme_invoice'
const GLOBEX_DOC = 'doc_globex_invoice'

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
      '🛑 SKIPPED — tests/db/document-slot-binding.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER `db/migrations/0150`. A run in which it',
      '   skipped is NOT evidence that a binding is tenant-isolated, NOT evidence',
      '   that the app role cannot bind a document of its own choosing into a',
      '   required slot, and NOT evidence that one document cannot occupy one',
      '   slot twice — which would put a second run over identical inputs.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

databaseRequiredUnderCi('the document-slot binding assertions', probe)

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

/** Whatever the database said, as a string. `''` when the statement SUCCEEDED. */
async function refusalOf(
  run: (q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>) => Promise<unknown>,
): Promise<string> {
  try {
    await asMigrator(run)
    return ''
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
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
       VALUES ($1, $2, 'invoice', 'at_least_one'), ($3, $4, 'invoice', 'at_least_one')`,
      [ACME, ACME_DEF, GLOBEX, GLOBEX_DEF],
    )
    await q(
      `INSERT INTO tenant.reconciliation_period (tenant_id, id, status)
       VALUES ($1, $2, 'open')`,
      [ACME, ACME_PERIOD],
    )
    /* A lane, an admitted arrival and the document it became — `0012` §2, §3. */
    await q(
      `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
       VALUES ($1, 'ich_upload', 'upload', NULL, true),
              ($2, 'ich_upload', 'upload', NULL, true)`,
      [ACME, GLOBEX],
    )
    await q(
      `INSERT INTO tenant.arrival
         (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id,
          arrived_at, verdict_kind, refusal_kind, source_document_id)
       VALUES ($1, 'arr_acme', 'ich_upload', 'upload', NULL, 'azg_standing',
               now(), 'admitted', NULL, $3),
              ($2, 'arr_globex', 'ich_upload', 'upload', NULL, 'azg_standing',
               now(), 'admitted', NULL, $4)`,
      [ACME, GLOBEX, ACME_DOC, GLOBEX_DOC],
    )
    await q(
      `INSERT INTO tenant.source_document (tenant_id, id, arrival_id, document_type_id, ingested_at)
       VALUES ($1, $3, 'arr_acme', 'dt_invoice', now()),
              ($2, $4, 'arr_globex', 'dt_invoice', now())`,
      [ACME, GLOBEX, ACME_DOC, GLOBEX_DOC],
    )
    /* ONE periodised binding per tenant, and one unperiodised one for ACME. */
    await q(
      `INSERT INTO tenant.document_slot_binding
         (tenant_id, definition_id, slot, period_id, source_document_id)
       VALUES ($1, $3, 'invoice', $5, $6),
              ($1, $3, 'invoice', NULL, $6),
              ($2, $4, 'invoice', NULL, $7)`,
      [ACME, GLOBEX, ACME_DEF, GLOBEX_DEF, ACME_PERIOD, ACME_DOC, GLOBEX_DOC],
    )
  })
}

describe('the document-slot binding', { skip }, () => {
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
   * §1 · THE ALLOW ARM, FIRST.
   * ================================================================ */

  it('1 · the app role reads its own bindings — both the periodised and the unperiodised one', async () => {
    const rows = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query(
        'SELECT definition_id, slot, period_id, source_document_id FROM tenant.document_slot_binding ORDER BY period_id NULLS FIRST',
      )
      return r.rows as Array<Record<string, unknown>>
    })
    assert.equal(
      rows.length,
      2,
      'the app role cannot read a binding inside its own scope. Every refusal below would ' +
        'then pass against a table nothing can read for any reason.',
    )
    assert.equal(rows[0]?.['period_id'], null)
    assert.equal(rows[0]?.['source_document_id'], ACME_DOC)
    assert.equal(rows[1]?.['period_id'], ACME_PERIOD)
  })

  /* ================================================================ *
   * §2 · INVARIANT 1, AND ITS NEGATIVE CONTROL.
   * ================================================================ */

  it('2 · another tenant`s binding is invisible, asked for by its exact document id', async () => {
    const rows = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query(
        'SELECT slot FROM tenant.document_slot_binding WHERE source_document_id = $1',
        [GLOBEX_DOC],
      )
      return r.rows
    })
    assert.equal(rows.length, 0, 'GLOBEX`s binding is visible inside ACME`s scope')
  })

  it('2b · a read OUTSIDE a tenant scope sees nothing at all — G100 denies on NULL', async () => {
    const client = await pool.connect()
    try {
      const r = await client.query('SELECT slot FROM tenant.document_slot_binding', [])
      assert.equal(
        r.rows.length,
        0,
        'a query with no `app.tenant_id` returned rows. G100`s whole content is that a ' +
          'forgotten transaction yields an EMPTY result set, never another tenant`s rows — ' +
          'and this table is read by `readSlotFill()` on every press of Run.',
      )
    } finally {
      client.release()
    }
  })

  it('2c · with RLS DISABLED the SAME read LEAKS both tenants', async () => {
    await asMigrator(async (q) => {
      await q('ALTER TABLE tenant.document_slot_binding DISABLE ROW LEVEL SECURITY')
    })
    try {
      const rows = await withTenantScope(pool, ACME, async (tx) => {
        const r = await tx.query('SELECT slot FROM tenant.document_slot_binding')
        return r.rows
      })
      assert.equal(
        rows.length,
        3,
        'WITH RLS OFF THE READ DID NOT LEAK, so §2 is not evidence that the POLICY is what ' +
          'isolates this table. Something else — a privilege, a predicate, an empty table — ' +
          'is producing the isolation §2 credits to the policy.',
      )
    } finally {
      await asMigrator(async (q) => {
        await q('ALTER TABLE tenant.document_slot_binding ENABLE ROW LEVEL SECURITY')
        await q('ALTER TABLE tenant.document_slot_binding FORCE ROW LEVEL SECURITY')
      })
    }
  })

  /* ================================================================ *
   * §3 · LEAST PRIVILEGE — THE DECISION IN THE MIGRATION.
   * ================================================================ */

  it('3 · the app role cannot INSERT, UPDATE or DELETE a binding', async () => {
    const attempts: ReadonlyArray<readonly [string, string, readonly unknown[]]> = [
      [
        'INSERT a binding of its own choosing',
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         VALUES ($1, $2, 'invoice', NULL, $3)`,
        [ACME, ACME_DEF, ACME_DOC],
      ],
      [
        'UPDATE a binding to point at another document',
        `UPDATE tenant.document_slot_binding SET source_document_id = $1`,
        [ACME_DOC],
      ],
      [
        'DELETE a binding',
        `DELETE FROM tenant.document_slot_binding WHERE definition_id = $1`,
        [ACME_DEF],
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
        `\`${label}\` was NOT refused by the DATABASE. \`db/migrations/0150\` grants SELECT and ` +
          'nothing else, and the argument is on its face: a path that could write this table ' +
          'could satisfy a required slot with a document IT chose, which makes ' +
          '`slot_fill_incomplete` a refusal the caller controls — and `run.inputs` an operand ' +
          'set the reconciled party selected, which no gate, policy or audit row downstream ' +
          `could recover from. Got: ${refused === '' ? 'the statement SUCCEEDED' : refused}`,
      )
    }
  })

  /* ================================================================ *
   * §4 · THE TWO PARTIAL UNIQUE INDEXES.
   *
   * 🛑 THE ONE ASSERTION HERE THAT CANNOT BE REPLACED BY READING THE
   *    MIGRATION. Drop either index and one document can occupy one slot
   *    twice — `slotFillBasis()` sorts and does NOT dedupe, so the duplicate
   *    changes the basis, changes the key, and admits a SECOND run over
   *    identical inputs. That is the race `admitRun` is named for, lost to a
   *    row rather than to a handler.
   * ================================================================ */

  it('4 · the same document cannot occupy the same slot twice for the same period', async () => {
    const refused = await refusalOf((q) =>
      q(
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         VALUES ($1, $2, 'invoice', $3, $4)`,
        [ACME, ACME_DEF, ACME_PERIOD, ACME_DOC],
      ),
    )
    assert.match(
      refused,
      /duplicate key value|document_slot_binding_periodised/i,
      'A DUPLICATE PERIODISED BINDING WAS ACCEPTED. `db/migrations/0150` §3: the basis is a ' +
        'sorted list and not a set, so `["doc", "doc"]` canonicalises differently from ' +
        `["doc"] and admits a second run over the same documents. Got: ${refused === '' ? 'the INSERT SUCCEEDED' : refused}`,
    )
  })

  it('4b · …and cannot occupy it twice with NO period either — the partial index the default misses', async () => {
    const refused = await refusalOf((q) =>
      q(
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         VALUES ($1, $2, 'invoice', NULL, $3)`,
        [ACME, ACME_DEF, ACME_DOC],
      ),
    )
    assert.match(
      refused,
      /duplicate key value|document_slot_binding_unperiodised/i,
      'A DUPLICATE UNPERIODISED BINDING WAS ACCEPTED, WHICH IS THE HALF A PLAIN UNIQUE ' +
        'CONSTRAINT WOULD HAVE MISSED: PostgreSQL treats NULLs as DISTINCT in a unique index ' +
        'by default, so `UNIQUE (tenant_id, definition_id, slot, period_id, ' +
        'source_document_id)` alone would admit the same unperiodised binding without limit. ' +
        '`NULLS NOT DISTINCT` is PostgreSQL 15 and this database is 14 — §3 argues both, and ' +
        `this is the assertion that says the second index is doing work. Got: ${refused === '' ? 'the INSERT SUCCEEDED' : refused}`,
    )
  })

  it('4c · a periodised binding and an unperiodised one for the same document COEXIST — the null is a value', async () => {
    const rows = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query(
        'SELECT period_id FROM tenant.document_slot_binding WHERE source_document_id = $1',
        [ACME_DOC],
      )
      return r.rows as Array<{ period_id: string | null }>
    })
    assert.equal(
      rows.length,
      2,
      'THE TWO ARMS COLLIDED. `db/migrations/0150` §2: a NULL `period_id` is the UNPERIODISED ' +
        'fill and not a wildcard, so the same document may occupy one slot both for a named ' +
        'period and for no period — and the two indexes are partial precisely so that neither ' +
        'arm constrains the other.',
    )
  })

  /* ================================================================ *
   * §5 · THE POLICY, READ BACK FROM THE CATALOGUE AND COMPARED AGAINST A
   *      SIBLING THIS MIGRATION DID NOT TOUCH.
   *
   * 🛑 A NEAR-MISS PARSES CLEANLY. `0020` records the draft that dropped a
   *    `NOT EXISTS` while `ALTER POLICY`-ing, *"which would have parsed
   *    cleanly and silently widened invariant 8 to `statutory`."* Comparing
   *    this policy's text against a policy NOBODY EDITED is the only form of
   *    this check that a copy-paste error cannot satisfy.
   * ================================================================ */

  it('5 · `document_slot_binding_rls` carries 0001`s predicate on BOTH halves, byte-identical to its siblings', async () => {
    const rows = await asMigrator(async (q) => {
      const r = await q(
        `SELECT policyname, qual, with_check FROM pg_policies
          WHERE schemaname = 'tenant'
            AND policyname IN ('document_slot_binding_rls', 'definition_slot_rls',
                               'source_document_rls')
          ORDER BY policyname`,
      )
      return r.rows as Array<{ policyname: string; qual: string; with_check: string }>
    })
    assert.equal(rows.length, 3, 'one of the three policies is missing from the catalogue')

    const mine = rows.find((r) => r.policyname === 'document_slot_binding_rls')
    assert.notEqual(mine, undefined, '`document_slot_binding_rls` is gone')
    assert.equal(
      mine?.qual,
      PREDICATE,
      'THE `USING` HALF IS NOT 0001`s PREDICATE. It is copied from ' +
        '`db/migrations/0001_tenancy_and_rls.sql` rather than retyped, and this is the ' +
        'assertion that says so from the catalogue`s side.',
    )
    assert.equal(
      mine?.with_check,
      PREDICATE,
      'THE `WITH CHECK` HALF IS NOT 0001`s PREDICATE. `db/migrations/0150` states it though no ' +
        'request path takes a write here, *"so a later `GRANT INSERT` cannot arrive without ' +
        'the write half already in place"* — which is exactly the case in which a missing ' +
        'half would first matter, and by then nobody would be reading this migration.',
    )
    for (const sibling of rows.filter((r) => r.policyname !== 'document_slot_binding_rls')) {
      assert.equal(
        sibling.qual,
        mine?.qual,
        `\`${sibling.policyname}\` and \`document_slot_binding_rls\` do not carry the same ` +
          '`USING` expression. One of them has drifted, and `db/migrations/0150` issues no ' +
          '`ALTER POLICY` at all — so if the sibling moved, something else replaced a whole ' +
          'expression.',
      )
    }
  })

  it('5b · the table ENABLEs and FORCEs row level security', async () => {
    const row = await asMigrator(async (q) => {
      const r = await q(
        `SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant' AND c.relname = 'document_slot_binding'`,
      )
      return r.rows[0] as { enabled: boolean; forced: boolean } | undefined
    })
    assert.notEqual(row, undefined, '`tenant.document_slot_binding` is not in the catalogue')
    assert.equal(row?.enabled, true, 'the table does not ENABLE row level security')
    assert.equal(
      row?.forced,
      true,
      'the table does not FORCE row level security. ENABLE alone leaves the TABLE OWNER ' +
        'exempt, and 0001 states the consequence: a test that connects as the owner passes ' +
        'with the policy doing nothing, and passes just as well with the policy dropped.',
    )
  })

  /* ================================================================ *
   * §6 · THE THREE FOREIGN KEYS — AND THE ONE THAT MUST NOT FIRE.
   * ================================================================ */

  it('6 · a binding to a slot the definition does not DECLARE is unwritable', async () => {
    const refused = await refusalOf((q) =>
      q(
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         VALUES ($1, $2, 'goods_receipt', NULL, $3)`,
        [ACME, ACME_DEF, ACME_DOC],
      ),
    )
    assert.match(
      refused,
      /violates foreign key constraint/i,
      'A BINDING TO AN UNDECLARED SLOT WAS ACCEPTED. `model/run-admission.ts` iterates the ' +
        'DECLARATIONS, so such a row is read by nothing and refuses nothing — it is accepted ' +
        'and then silently ignored, which is the worst of the three possible outcomes and is ' +
        `why the foreign key is composite. Got: ${refused === '' ? 'the INSERT SUCCEEDED' : refused}`,
    )
  })

  it('6b · a binding naming ANOTHER TENANT`s document is unwritable — not merely unlikely', async () => {
    const refused = await refusalOf((q) =>
      q(
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         VALUES ($1, $2, 'invoice', NULL, $3)`,
        [ACME, ACME_DEF, GLOBEX_DOC],
      ),
    )
    assert.match(
      refused,
      /violates foreign key constraint/i,
      'ACME BOUND GLOBEX`s DOCUMENT INTO ITS OWN SLOT, AS THE MIGRATOR. `0002_run.sql`: *"a ' +
        'cross-tenant reference has to be unrepresentable rather than merely unlikely"* — and ' +
        'the migrator holds BYPASSRLS, so the policy is not what stops this. The composite ' +
        `foreign key is. Got: ${refused === '' ? 'the INSERT SUCCEEDED' : refused}`,
    )
  })

  it('6c · a binding naming a period nobody opened is unwritable', async () => {
    const refused = await refusalOf((q) =>
      q(
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         VALUES ($1, $2, 'invoice', 'per_no_such_period', $3)`,
        [ACME, ACME_DEF, ACME_DOC],
      ),
    )
    assert.match(
      refused,
      /violates foreign key constraint/i,
      `a binding to an unopened period was accepted. Got: ${refused === '' ? 'the INSERT SUCCEEDED' : refused}`,
    )
  })

  it('6d · …and the SAME foreign key does NOT fire when `period_id` is NULL — MATCH SIMPLE', async () => {
    /*
     * 🛑 THE SEED ALREADY WROTE ONE OF THESE, SO THIS IS A STATEMENT ABOUT WHY
     * IT SUCCEEDED RATHER THAN A SECOND WRITE. Under MATCH SIMPLE a composite
     * foreign key with any NULL referencing column is satisfied WITHOUT A
     * LOOKUP — `db/migrations/0039` leans on the same property in the opposite
     * direction. If this ever became MATCH FULL, every unperiodised binding in
     * the product would become unwritable and §2's whole reading would be dead.
     */
    const definition = await asMigrator(async (q) => {
      const r = await q(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conrelid = 'tenant.document_slot_binding'::regclass
            AND contype = 'f'
            AND pg_get_constraintdef(oid) LIKE '%reconciliation_period%'`,
      )
      return (r.rows[0] as { def: string } | undefined)?.def ?? ''
    })
    assert.notEqual(definition, '', 'the period foreign key is gone from the catalogue')
    assert.ok(
      !/MATCH FULL/i.test(definition),
      'THE PERIOD FOREIGN KEY IS `MATCH FULL`. Under MATCH FULL a partially-null referencing ' +
        'row is REFUSED, so every unperiodised binding becomes unwritable and the whole ' +
        `unperiodised arm of §2 stops existing. Constraint: ${definition}`,
    )
    const rows = await asMigrator(async (q) => {
      const r = await q(
        'SELECT period_id FROM tenant.document_slot_binding WHERE period_id IS NULL',
      )
      return r.rows
    })
    assert.equal(rows.length, 2, 'the seeded unperiodised bindings are not in the table')
  })
})

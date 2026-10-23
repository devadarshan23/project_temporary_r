/**
 * THE RLS CENSUS — every table in `tenant.`, enumerated from the CATALOGUE.
 *
 * ┌─ WHY THIS EXISTS: A TABLE WITH NO RLS WAS SHIPPED THROUGH THE WHOLE GATE ──┐
 * │ On 19 Sep 2026 an adversarial pass added one migration —                   │
 * │                                                                            │
 * │   CREATE TABLE tenant.red2_probe (tenant_id text NOT NULL REFERENCES …);   │
 * │   GRANT SELECT, INSERT … TO tenant_rw;                                     │
 * │   -- no ENABLE, no FORCE, no policy                                        │
 * │                                                                            │
 * │ — and **all nine checkers exited 0** and **190 `tests/db` assertions        │
 * │ passed against a live PostgreSQL.** Then, as `reconcile_app`, with NO GUC   │
 * │ set at all:                                                                │
 * │                                                                            │
 * │   NO GUC AT ALL sees:|ten_a|TENANT-A-SECRET                                │
 * │   NO GUC AT ALL sees:|ten_b|TENANT-B-SECRET                                │
 * │                                                                            │
 * │ A full cross-tenant read, gate green.                                      │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE DEFECT IS THE SHAPE OF THE EXISTING TESTS, NOT A MISSING ONE ─────────┐
 * │ Isolation is well tested here — `tenant-isolation`, `session-isolation`,   │
 * │ `session-membership-selection`, `event-streams` and more. **Every one of   │
 * │ them names its tables:**                                                   │
 * │                                                                            │
 * │   WHERE n.nspname = 'tenant' AND c.relname IN ('session', 'membership')    │
 * │     AND c.relrowsecurity AND c.relforcerowsecurity                         │
 * │                                                                            │
 * │ Reproduce it: `grep -rn "nspname = 'tenant'" tests/` — every hit pairs the │
 * │ schema with a literal `relname`. So the suite proves a PROPERTY OF NAMED   │
 * │ TABLES and says nothing about the NEXT table, and the sixteenth migration  │
 * │ is as unguarded as the first was.                                          │
 * │                                                                            │
 * │ That is `docs/HANDOFF.md` §5.1 exactly — **a rule keyed on a convenient    │
 * │ landmark instead of the property it protects.** The landmark is a table    │
 * │ name; the property is *no tenant table is readable without a scope*.       │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ WHY A TEST AND NOT A `tools/` CHECKER. G108 requires a checker to be
 * deterministic and fast, and `npm run check` is verified EXIT 0 on a clean
 * checkout with **no PostgreSQL**. This question can only be asked of a live
 * catalogue, so it belongs where the other database assertions live, behind
 * `databaseRequiredUnderCi()` — which makes it a **hard requirement under CI**
 * and a loud skip for a contributor with no server. `tools/check-migration-
 * numbers.mjs` reads filenames and is a checker for exactly the opposite
 * reason.
 *
 * 🛑 THE EXEMPTION LIST IS THE POINT OF THIS FILE, NOT AN ESCAPE HATCH. Four
 * tables in `tenant.` carry no RLS today and the reason is good — and it is
 * written down NOWHERE. `0008` heads that section *"ROW-LEVEL SECURITY on the
 * two tenant-scoped tables"*, which **implies** the other four are excluded and
 * never says so. This list is the first place that argument exists, and a
 * reviewer adding a fifth entry has to write one.
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, migratorClient } from '../../db/provision.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RLS_CENSUS_DB_NAME'] ?? runScopedName('reconcile_rls_census_test')

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the RLS census', probe)

/**
 * 🛑 THE FOUR TABLES THAT MAY CARRY NO ROW-LEVEL SECURITY, AND THE ARGUMENT FOR
 * EACH — WHICH IS ONE ARGUMENT, BECAUSE THEY ARE ONE THING.
 *
 * `0008_staff_grant_selection.sql` seeds the three governance lists and the
 * duration ceiling as REFERENCE DATA, *"because a policy expression cannot
 * import a TypeScript constant"*. They are a MIRROR of `model/governance.ts`,
 * and a test asserts set equality with it **in both directions** — which is
 * what stops them being the third place to drift that `0002` forbids.
 *
 * Three facts make the exemption safe, and all three are checked below rather
 * than asserted here:
 *   1. **No tenant column.** There is nothing for `0001`'s predicate to compare;
 *      a policy would have to be `USING (true)`, which is not a control.
 *   2. **Nothing to disclose.** The content mirrors a constant that ships in a
 *      public repository. `grep -n 'statutory' model/governance.ts`.
 *   3. **`SELECT` only to the app role.** Nothing on a request path can write
 *      one, so the lists cannot be widened to permit a class the model refuses.
 *
 * ⚠️ ADDING AN ENTRY HERE IS A DECISION, NOT A FIX. If a table cannot satisfy
 * all three, it does not belong on this list — it needs RLS.
 */
const NO_RLS_BY_DESIGN: readonly string[] = [
  'non_delegable_resource',
  'contract_only_resource',
  'permitted_resource',
  'grant_duration_ceiling',
]

interface Row {
  readonly relname: string
  readonly enabled: boolean
  readonly forced: boolean
  readonly policies: number
  readonly has_tenant_column: boolean
  readonly app_writes: boolean
}

let rows: readonly Row[] = []

describe('the RLS census — every table in `tenant.`, from the catalogue', { skip }, () => {
  before(async () => {
    await resetSchema()
    const mig = await migratorClient()
    try {
      const r = await mig.query(
        `SELECT c.relname::text                                           AS relname,
                c.relrowsecurity                                          AS enabled,
                c.relforcerowsecurity                                     AS forced,
                (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies,
                EXISTS (SELECT 1 FROM information_schema.columns col
                         WHERE col.table_schema = 'tenant'
                           AND col.table_name   = c.relname
                           AND col.column_name  = 'tenant_id')            AS has_tenant_column,
                EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                         WHERE g.table_schema = 'tenant'
                           AND g.table_name   = c.relname
                           AND g.privilege_type IN ('INSERT','UPDATE','DELETE')
                           AND g.grantee IN ('tenant_rw','reconcile_app'))AS app_writes
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant' AND c.relkind = 'r'
          ORDER BY c.relname`,
      )
      rows = r.rows as unknown as Row[]
    } finally {
      await mig.end()
    }
  })

  /**
   * ⚠️ ANTI-VACUOUS, AND FIRST. A census whose query returned nothing would
   * pass every assertion below it — §5.6 in its purest form. The floor is
   * deliberately far below the real count so it does not become a second
   * number to sweep on every migration.
   */
  it('0 · ANTI-VACUOUS — the census is reading a real catalogue', () => {
    assert.ok(
      rows.length >= 20,
      `the census found ${rows.length} tables in \`tenant.\`, which is too few to ` +
        'be the real schema. Every assertion below would pass against an empty ' +
        'result set. Did `resetSchema()` run?',
    )
  })

  /**
   * 🛑 THE ASSERTION THIS FILE EXISTS FOR.
   */
  it('1 · every table in `tenant.` ENABLEs and FORCEs row level security', () => {
    const unguarded = rows
      .filter((r) => !NO_RLS_BY_DESIGN.includes(r.relname))
      .filter((r) => !r.enabled || !r.forced)

    assert.deepEqual(
      unguarded.map((r) => `${r.relname} (enabled=${r.enabled} forced=${r.forced})`),
      [],
      'a table in `tenant.` carries no row-level security, or has it ENABLEd and ' +
        'not FORCEd — in which case the owner bypasses it. This is the exact ' +
        'state a probe migration shipped through all nine checkers and 190 ' +
        'database assertions on 19 Sep 2026, and then read across tenants with ' +
        'no GUC set. If the table genuinely needs no RLS, add it to ' +
        '`NO_RLS_BY_DESIGN` **with the argument**, and satisfy the three ' +
        'conditions §3 checks.',
    )
  })

  it('2 · every table that FORCEs RLS actually has a policy', () => {
    const forcedWithNoPolicy = rows.filter((r) => r.forced && r.policies === 0)
    assert.deepEqual(
      forcedWithNoPolicy.map((r) => r.relname),
      [],
      'a table FORCEs row-level security and has no policy at all. That fails ' +
        'CLOSED rather than open, so it is not a disclosure — but it is a table ' +
        'nothing can read, which is almost never what a migration meant.',
    )
  })

  /**
   * 🛑 THE EXEMPTION LIST IS ITSELF CHECKED, IN BOTH DIRECTIONS. A list nobody
   * verifies is a list that grows, and the three conditions are the whole
   * argument for the four entries.
   */
  it('3 · each exemption still satisfies all three conditions that justify it', () => {
    for (const name of NO_RLS_BY_DESIGN) {
      const row = rows.find((r) => r.relname === name)
      assert.ok(row !== undefined, `\`${name}\` is exempted from RLS and does not exist`)
      assert.equal(
        row.has_tenant_column,
        false,
        `\`${name}\` is exempted from RLS but HAS a \`tenant_id\` column. The ` +
          'exemption rests on there being nothing for `0001`\'s predicate to ' +
          'compare. It now has one — so it needs a policy, not an exemption.',
      )
      assert.equal(
        row.app_writes,
        false,
        `\`${name}\` is exempted from RLS but the app role can WRITE it. The ` +
          'exemption rests on `SELECT` only: these tables are the governance ' +
          'lists `authorisationPermits()` reads, and a request path that could ' +
          'widen one could permit a class the model refuses — `statutory` ' +
          'included, which invariant 8 refuses at any price.',
      )
    }
  })

  it('4 · the exemption list names no table that has since gained RLS', () => {
    const stale = NO_RLS_BY_DESIGN.filter((n) => {
      const row = rows.find((r) => r.relname === n)
      return row !== undefined && row.enabled
    })
    assert.deepEqual(
      stale,
      [],
      'a table on the exemption list now ENABLEs row-level security. The ' +
        'exemption is stale and should be deleted — an exemption that no longer ' +
        'exempts anything is a licence sitting in a list waiting to be reused.',
    )
  })
})

/**
 * THE CONTROL DATABASE'S CENSUS — every relation, ENUMERATED FROM THE
 * CATALOGUE, and the two properties that must hold of all of them.
 *
 * G832 (20 Sep 2026), derived and not the owner's.
 *
 * ┌─ WHY THIS EXISTS: THE RLS CENSUS CANNOT SEE THIS DATABASE ────────────────┐
 * │ `tests/db/rls-census.test.ts` (G446) exists because a table with no       │
 * │ row-level security was shipped through the whole gate, and its own        │
 * │ header states the repair: *"the suite proves a PROPERTY OF NAMED TABLES   │
 * │ and says nothing about the NEXT table."* It fixed that for schema         │
 * │ `tenant` — **in the DATA database.** Its query is                         │
 * │ `WHERE n.nspname = 'tenant'`, run against `dbTarget()`.                   │
 * │                                                                            │
 * │ 🛑 **SO IT IS ITSELF KEYED ON A LANDMARK — A SCHEMA NAME IN ONE OF TWO     │
 * │ DATABASES — AND `db/migrations-control/` HAS ALWAYS BEEN OUTSIDE IT.**     │
 * │ That was harmless while this database held one platform-authored          │
 * │ catalogue table. `0002_tenancy_roster.sql` is the second table and the    │
 * │ first with a `tenant_id` column in it, which is the arrival               │
 * │ `0001_catalogue.sql` warned about by name:                                │
 * │                                                                            │
 * │    "the day somebody puts a tenant-scoped table in it, the absence of a   │
 * │     policy on THAT table would look like the existing pattern."           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THE PROPERTY IS NOT "EVERY TABLE HAS RLS", AND COPYING THAT ONE ACROSS
 * WOULD HAVE BEEN THE WRONG CENSUS. Row-level security keeps one tenant's rows
 * from another tenant's SESSION, and this database has no tenant session and
 * cannot have one — `server/control-plane/start.ts`'s `ChannelPrincipal` is
 * `{ channel: 'local-development' }` and carries no tenant, nothing here
 * imports `db/tenant-scope.ts`, and no `app.tenant_id` is set in any
 * transaction that reaches these tables. A policy would be `USING (true)` or
 * would deny unconditionally.
 *
 * 🟢 **THE PROPERTY THIS DATABASE ACTUALLY HAS IS `0001`'s OWN SENTENCE, AND IT
 * IS THE ONE WORTH ENUMERATING:** *"a serving process that cannot write the
 * thing it serves is one fewer way for a published artefact to change under a
 * plane that is pulling it."* So:
 *
 *   A · NO SERVING ROLE holds `INSERT`, `UPDATE` or `DELETE` on ANY relation in
 *       this database — including the migration ledger, and including whatever
 *       lands next;
 *       ⚠️ **AMENDED 21 Sep 2026 — R9, THE OWNER'S — AND THE SENTENCE ABOVE IS
 *       CORRECTED RATHER THAN DELETED because it is what this file is quoted
 *       for. It now reads: NO SERVING ROLE holds a write on any relation
 *       EXCEPT the (role, relation) pairs enumerated and argued at
 *       `WRITE_BY_DESIGN`.** The owner took a WRITING credential for the data
 *       plane and accepted this assertion going red as one of two named costs.
 *       **The empty list is not weakened, it is SPENT** — once, for two pairs —
 *       and a third pair is this gate going red again;
 *   B · a relation carrying a `tenant_id` column appears on an ARGUED list,
 *       because that column is what makes a table LOOK scopeable and is the
 *       shape `0001` says a reader will misread.
 *
 * ⚠️ ADDING AN ENTRY TO THE LIST IN B IS A DECISION, NOT A FIX — `rls-census`'s
 * rule for its own exemption list, adopted here for the same reason.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 **20 Sep 2026 — A SAID "THE APPLICATION ROLE" AND IT NOW SAYS "NO SERVING
 *    ROLE", BECAUSE THIS DATABASE GAINED A SECOND ONE AND THE SECOND BELONGS
 *    TO THE OTHER PLANE. THE OLD WORDING IS CORRECTED ABOVE RATHER THAN
 *    DELETED BECAUSE IT IS WHAT THIS FILE WAS QUOTED FOR.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **G1161, the owner's:** *"The data plane gains a READ-ONLY control-database
 * pool. A second connection, `SELECT` only, on its own credential."* That
 * credential is `reconcile_control_reader`, it is held by
 * `server/data-plane/`, and `db/migrations-control/0020_console_read_role.sql`
 * grants it `SELECT` on one table.
 *
 * 🛑 **AND THIS FILE IS NOW THE THING THAT REPLACES A CONSTRUCTION, WHICH IS A
 * HEAVIER JOB THAN IT WAS WRITTEN FOR.** `db/control-read-scope.ts` quotes the
 * ruling: *"By construction becomes by census, and that is a real loss, not a
 * wash."* Until 20 Sep 2026 no process could reach this database's storage
 * except the one that owns it, and that was true because of `compose.yaml` and
 * an import graph rather than because of a `GRANT`. A census can be undone by
 * a commit that adds a table, a grant and an exemption together; a
 * construction could not. **What this file buys back is that the undoing is a
 * RED GATE rather than silence, and that is strictly less than what was
 * spent.** Do not let it be cited as equivalent.
 *
 * ⚠️ THE ROLE SET IS DERIVED FROM THE TREE, NOT LISTED HERE — `CONTROL_APP_ROLE`,
 * `CONTROL_READ_ROLE` and `CONTROL_WRITE_ROLE` are imported from the modules
 * that define them, so a role RENAMED there is renamed here. **A census that
 * spelled its own role names would have the defect it exists to fix, one axis
 * over**: `rls-census` was keyed on a schema name and could not see this
 * database at all, which is the whole reason this file was written.
 *
 * 🛑 **THE NEXT SENTENCE WAS FALSE AND IS CORRECTED RATHER THAN DELETED,
 * BECAUSE IT IS THE CLAIM THAT MADE THIS CENSUS LOOK SELF-MAINTAINING —
 * G1430, 21 Sep 2026.** It read: *"so a third role cannot arrive without
 * either joining this census or failing to compile somewhere."*
 *
 * **Nothing forces a new `export const` into `SERVING_ROLES`.** It is a
 * hand-written array; a fourth role could be minted in
 * `server/control-plane/provision.ts`, granted in `db/migrations-control/`
 * and used by a pool, and every assertion in this file would stay GREEN while
 * being silent about it — because §A, §0b and §C all answer only about the
 * roles this array names. **A census passing because it was not looking is
 * §5.6 inside the control written to replace a construction**, and it is the
 * same shape as the column-level blind spot G1429 found in the same pass.
 *
 * ⚠️ **IT IS NOT REPAIRED HERE AND THE REPAIR IS NAMED.** The honest version
 * enumerates grantees from `pg_auth_members`/`information_schema.role_table_grants`
 * — every role holding ANY privilege in this database — and requires each to
 * be on an argued list, which is §B's shape applied to roles instead of to
 * columns. **That is a real control and it is a different slice**: it would
 * also see `reconcile_control_admin`, the migrator and the cluster owner, and
 * deciding which of those belong on the list is a decision this slice has no
 * ruling for. **The third role that arrived in this pass is on the array
 * because a person put it there, which is exactly what this note says cannot
 * be relied on.**
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { sqlCode, sqlCorpus, sqlCorpusIsReal } from '../sql-code.ts'

const CONTROL_DB = process.env['RECONCILE_CENSUS_TEST_DB_NAME'] ?? runScopedName('reconcile_control_census_test')
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
      '🛑 SKIPPED — tests/db/control-plane-census.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   A run in which this file skipped is NOT evidence that the control',
      '   plane cannot write the artefacts it publishes downward to the fleet.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the control database’s census', probe)

import { createCataloguePool, type CataloguePool } from '../../server/control-plane/db.ts'
import { provisionControlPlane } from '../../server/control-plane/provision.ts'
import { CONTROL_APP_ROLE } from '../../server/control-plane/config.ts'
/**
 * ⛔ THE DATA PLANE'S TWO ROLES ARE RETIRED — G4320, 5 Oct 2026, THE OWNER'S
 * "Full restore" ruling. Their modules (`db/control-read-scope.ts`,
 * `db/control-write-scope.ts`) are deleted with the credentials, so the names
 * are spelled here; they survive in the cluster only as `NOLOGIN` shells that
 * `0020`/`0040`'s replay needs, and §R below asserts they reach nothing.
 */
const CONTROL_READ_ROLE = 'reconcile_control_reader'
const CONTROL_WRITE_ROLE = 'reconcile_control_writer'
import { runScopedName } from '../run-scoped-db.ts'

/**
 * 🛑 THE ONE RELATION THAT MAY CARRY A `tenant_id` COLUMN, AND THE ARGUMENT.
 *
 * `public.tenancy_roster` is a list of WHICH TENANTS EXIST and what the
 * platform sold them. It is *about* tenants and is not scoped *to* one: every
 * reader of this database reads the whole fleet, because the only principal
 * this plane builds carries no tenant to narrow by.
 *
 * Three facts make that safe, and all three are checked below rather than
 * asserted here:
 *   1. **No write.** Assertion A covers it with everything else.
 *   2. **No tenant business data.** `tests/db/tenancy-roster.test.ts` §3 joins
 *      the column set to `TenantSummary` and requires the counts, totals and
 *      timestamps whose only producer is a tenant read to be ABSENT.
 *   3. **No credential reaching a tenant table.** `server/control-plane/`
 *      imports no `db/tenant-scope.ts` and the service is on `control-net`
 *      alone; `tests/http/plane-separation.test.ts` is that assertion.
 *
 * ⚠️ A TABLE THAT CANNOT SATISFY ALL THREE DOES NOT BELONG ON THIS LIST — it
 * belongs in the other database, behind `0001_tenancy_and_rls.sql`'s predicate.
 */
const TENANT_COLUMN_BY_DESIGN: readonly string[] = [
  'tenancy_roster',
  /**
   * 🛑 TWO ENTRIES ADDED 20 Sep 2026 UNDER G1241, THE OWNER'S RULING, AND EACH
   * IS A DECISION RATHER THAN A FIX — this list's own rule, inherited from
   * `rls-census` and stated above.
   *
   *     "Onboarding state lives in a table in the CONTROL database, one row per
   *      tenant, beside the roster."
   *
   * Both tables are *about* tenants and neither is scoped *to* one, which is
   * the distinction this list exists to hold. The three facts the entry above
   * has to satisfy, satisfied here:
   *
   *   1. **No write.** §A covers both with everything else, and
   *      `tests/db/onboarding-record.test.ts` §3a asserts it a second time
   *      through `has_table_privilege` per role.
   *   2. **No tenant business data.** `onboarding_record` holds ONE INTEGER —
   *      how many of OUR delivery steps are done — and `onboarding_forced_step`
   *      holds a step key and a reason A STAFF PERSON TYPED. The test
   *      `db/migrations-control/0002_tenancy_roster.sql` sets is *what would
   *      have to READ a tenant's data to populate it*, and the answer for every
   *      column here is *a staff person ticking a box in `S1`*.
   *      `platform-console.openapi.yaml` calls it, in its own words,
   *      *"1CloudHub's own delivery record about its own work"*.
   *   3. **No credential reaching a tenant table.** Unchanged, and asserted by
   *      `tests/http/plane-separation.test.ts`.
   *
   * ⚠️ `first_run` IS THE STEP TO LOOK AT TWICE AND IT PASSES: it is OUR record
   * that we watched a first run happen, not a fact read out of `public.run`,
   * which is in the other database behind a credential nothing here holds.
   */
  'onboarding_record',
  'onboarding_forced_step',
]

/**
 * 🛑 EVERY ROLE THAT AUTHENTICATES AGAINST THIS DATABASE, DERIVED FROM THE
 * MODULES THAT DECLARE THEM — G1164, 20 Sep 2026.
 *
 * ⚠️ IT IS A LIST AND IT IS NOT A LIST OF STRINGS. Each entry is the CONSTANT
 * its owning module exports, so a role renamed there is renamed here and a
 * THIRD role cannot arrive without somebody choosing to add it — which is the
 * moment this census wants a person's attention. A census that spelled its own
 * role names would have the defect it exists to fix, one axis over:
 * `rls-census` was keyed on a schema name and could not see this database at
 * all.
 *
 * `CONTROL_APP_ROLE`  the CONTROL plane's, reading everything published
 *                     downward to the fleet.
 * `CONTROL_READ_ROLE` the DATA plane's, reading the tenancy roster for the
 *                     consoles — G1161, the owner's ruling of 20 Sep 2026, and
 *                     the reason the property in §A is stated of roles rather
 *                     than of THE role.
 */
const SERVING_ROLES: readonly string[] = [CONTROL_APP_ROLE, CONTROL_READ_ROLE, CONTROL_WRITE_ROLE]

interface Row {
  readonly relname: string
  readonly has_tenant_column: boolean
  readonly grantee: string
  readonly writes: boolean
  readonly reads: boolean
}

let rows: readonly Row[] = []

describe('the control database — every relation, from the catalogue', { skip }, () => {
  before(async () => {
    const { Client } = await loadPg()
    const admin = new Client({
      host: '127.0.0.1',
      port: controlDbPort(),
      database: 'postgres',
      user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
      application_name: 'reconcile-census-test-setup',
    })
    await admin.connect()
    try {
      const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [CONTROL_DB])
      if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
    } finally {
      await admin.end()
    }
    await provisionControlPlane()

    /**
     * ⚠️ READ AS THE APPLICATION ROLE, DELIBERATELY. `pg_class` is visible to
     * every role, so the enumeration is not narrowed by connecting this way —
     * and reading the grants through the role they are about is one fewer
     * assumption than reading them as the owner.
     */
    let pool: CataloguePool | undefined
    try {
      pool = await createCataloguePool()
      /**
       * ⚠️ EVERY RELATION CROSSED WITH EVERY SERVING ROLE — G1164. The query
       * took one role in `$1` until 20 Sep 2026 and would have reported
       * perfect abstinence about a database the DATA plane had just been
       * granted a credential for. **A census narrowed to one grantee is a
       * census that answers about one grantee**, and the only reason it read
       * as a property of the database is that there was one.
       *
       * 🛑 `has_table_privilege()` AND NOT `information_schema.role_table_grants`,
       * AND THE SWAP WAS FORCED BY A MEASURED RED RATHER THAN CHOSEN — G1165.
       * That view is FILTERED TO THE CALLING ROLE: it shows a grant only where
       * the caller is the grantor, the grantee, or a member of the grantee.
       * This census connects as `reconcile_control_app`, which is none of
       * those for `reconcile_control_reader` — so on its first run against the
       * second role it reported **`SELECT` on nothing**, which §C caught only
       * because §C asserts a PRESENCE. **§A asserts an ABSENCE, and against
       * that view it would have passed for ever, about a role it could not
       * see.** §5.6 arriving inside the control that replaces G193's
       * construction, on the day it replaced it.
       *
       * `has_table_privilege(role, table, privilege)` is answerable by any
       * caller, follows role inheritance, and is the server's own answer to
       * the question rather than a view of the grant that produced it.
       */
      /**
       * 🛑 `has_any_column_privilege` BESIDE `has_table_privilege`, AND THE PAIR
       * IS G1429 — A HOLE THIS CENSUS HAD FROM THE DAY IT WAS WRITTEN, FOUND BY
       * MEASUREMENT ON 21 Sep 2026.
       *
       * **`has_table_privilege(role, rel, 'UPDATE')` IS FALSE FOR A COLUMN-LEVEL
       * GRANT.** Witnessed against a live PostgreSQL 14.18, with
       * `GRANT UPDATE (completed_steps) ON onboarding_record TO
       * reconcile_control_writer` applied:
       *
       *     has_table_privilege(..., 'UPDATE')       -> f
       *     has_any_column_privilege(..., 'UPDATE')  -> t
       *
       * 🛑 **SO THE ASSERTION G1161 CALLS *"what replaces a construction"* WAS
       * BLIND TO THE NARROWEST AND MOST LIKELY FORM OF WRITE ANYBODY WOULD ADD
       * HERE.** A column-level `UPDATE` is this product's established shape for
       * exactly that — `db/migrations/0015_exception_register.sql`'s G358 calls
       * it *"the one genuinely new privilege shape in this directory"*, and
       * `0059` and `0013` both reuse it — so a future slice granting one in THIS
       * database would have passed §A in silence while holding a write.
       *
       * ⚠️ **THAT IS §5.1 INSIDE THE CONTROL WRITTEN TO REPLACE A
       * CONSTRUCTION**: it keyed on `has_table_privilege`, the convenient
       * landmark, rather than on *can this role write*, which is the property.
       * The repair is three more predicates and it is not a widening — every
       * pair the old form found, the new form still finds.
       *
       * ⚠️ **AND THERE IS NO COLUMN-LEVEL `DELETE` TO ASK ABOUT, WHICH WAS
       * ALSO MEASURED RATHER THAN ASSUMED**: a fourth predicate was written,
       * and PostgreSQL answered `ERROR: unrecognized privilege type: "DELETE"`.
       * SQL column privileges are `SELECT`, `INSERT`, `UPDATE` and
       * `REFERENCES`; `DELETE` removes a whole row and cannot be narrowed to a
       * column. **So the table-level predicate is COMPLETE for that verb** and
       * its absence here is a fact about SQL rather than a gap in this census.
       */
      const r = await pool.query(
        `SELECT c.relname::text AS relname,
                roles.grantee::text AS grantee,
                EXISTS (SELECT 1 FROM information_schema.columns col
                         WHERE col.table_schema = 'public'
                           AND col.table_name   = c.relname
                           AND col.column_name  = 'tenant_id')          AS has_tenant_column,
                (has_table_privilege(roles.grantee, c.oid, 'INSERT')
                 OR has_table_privilege(roles.grantee, c.oid, 'UPDATE')
                 OR has_table_privilege(roles.grantee, c.oid, 'DELETE')
                 OR has_any_column_privilege(roles.grantee, c.oid, 'INSERT')
                 OR has_any_column_privilege(roles.grantee, c.oid, 'UPDATE')) AS writes,
                (has_table_privilege(roles.grantee, c.oid, 'SELECT')
                 OR has_any_column_privilege(roles.grantee, c.oid, 'SELECT')) AS reads
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          CROSS JOIN unnest($1::text[]) AS roles(grantee)
          WHERE n.nspname = 'public' AND c.relkind = 'r'
          ORDER BY c.relname, roles.grantee`,
        [SERVING_ROLES],
      )
      rows = r.rows as unknown as Row[]
    } finally {
      if (pool !== undefined) await pool.end().catch(() => undefined)
    }
  })

  /* ================================================================ *
   * §0 · THE §5.6 GUARD. Every assertion below is over `rows`.
   * ================================================================ */

  it('0 · the census enumerated the relations this database is known to have', () => {
    const names = [...new Set(rows.map((r) => r.relname))]
    assert.ok(
      names.length >= 3,
      'the census found fewer than three relations, so every property asserted below is ' +
        `true of nothing. Found: [${names.join(', ')}]`,
    )
    for (const known of [
      'pack_catalogue',
      'tenancy_roster',
      /* Added with G1241's two tables, so the enumeration is known to reach them. */
      'onboarding_record',
      'onboarding_forced_step',
      'schema_migration',
    ]) {
      assert.ok(
        names.includes(known),
        `\`${known}\` is not in the census, so the enumeration is not reaching this ` +
          `database's tables. Found: [${names.join(', ')}]`,
      )
    }
    /**
     * 🛑 NOT AN EQUALITY, AND THE DIFFERENCE IS THE WHOLE POINT OF A CENSUS.
     * `rls-census` exists because a suite that names its tables says nothing
     * about the NEXT one. A `deepEqual` here would make every new table a red
     * gate for the wrong reason — the properties below are what a new table
     * must satisfy, and they apply to it automatically.
     */
  })

  it('0b · and it enumerated every serving role, not just the control plane’s', () => {
    /**
     * 🛑 THE §5.6 GUARD FOR §A, ADDED WITH THE SECOND ROLE — G1164. §A is a
     * `deepEqual` against `[]`, and an empty list is the answer this suite
     * gives for a database it never looked at. Before 20 Sep 2026 there was
     * one serving role and this guard would have been noise; there are two
     * now, one of them belonging to the OTHER PLANE, and a query that silently
     * narrowed to one would report the whole property while asserting half of
     * it.
     */
    const grantees = [...new Set(rows.map((r) => r.grantee))].sort()
    assert.deepEqual(
      grantees,
      [...SERVING_ROLES].sort(),
      'the census did not cross every relation with every serving role. `SERVING_ROLES` is ' +
        'derived from the constants their own modules export — `CONTROL_APP_ROLE` and ' +
        '`CONTROL_READ_ROLE` — so this failing means either a role was added without ' +
        'joining the census, or the query narrowed to a subset and §A below is now a ' +
        `property of one grantee wearing the name of all of them. Found: [${grantees.join(', ')}]`,
    )
  })

  /* ================================================================ *
   * §A · NO WRITE PRIVILEGE, ANYWHERE.
   * ================================================================ */

  /**
   * 🛑 **THE ARGUED WRITE SET — R9, 21 Sep 2026, THE OWNER'S RULING, AND THE
   * OWNER ACCEPTED THIS ASSERTION GOING RED AS ONE OF ITS TWO NAMED COSTS.**
   *
   *     "Yes, the data plane may hold a WRITING credential for the control
   *      database, via a sixth scope helper and a second control-database
   *      role."
   *
   * ⚠️ **§A's ORIGINAL FORM WAS `deepEqual(writable, [])` AND ITS MESSAGE IS
   * KEPT BELOW TO THE CHARACTER**, because it is the sentence G1161 calls
   * *"what replaces a construction"* and a slice that quietly deleted it would
   * be spending G193's property twice — once for the read, once for the write,
   * and recording neither.
   *
   * **What replaces the empty list is not a weaker assertion of the same kind.
   * It is the same assertion plus an ENUMERATION**, in the shape §C already
   * uses for reads, whose own header says *"widening this list is a DECISION,
   * not a fix."* Every entry is one (role, relation) pair, and a pair that is
   * not here is still a red gate.
   *
   * 🛑 **IT IS DELIBERATELY NOT A LIST OF VERBS AND NOT A LIST OF COLUMNS**,
   * which is a real limitation and is named rather than hidden. The census
   * asks `has_*_privilege` per RELATION, so it can say *"this role can write
   * this table"* and cannot say *"…only `completed_steps`, and only to a larger
   * value"*. **The column list is `db/migrations-control/0040_onboarding_writer.sql`'s
   * and the monotonicity is its trigger's**, and both are witnessed live in
   * `tests/db/onboarding-write-pool.test.ts` §3 and §5. This list is the
   * coarser, cheaper control that catches a role arriving.
   */
  /**
   * ✅ EMPTY AGAIN — G4320, 5 Oct 2026, THE OWNER'S "Full restore" RULING:
   * *"…then retire both control-DB credentials from the data plane."* R9 SPENT
   * this list on two writer pairs held by a DATA-plane credential; `0052`
   * revokes them, so no role the data plane ever held writes anything here.
   */
  const WRITE_BY_DESIGN: readonly string[] = []
  /**
   * The CONTROL plane's own writes — G4306/G4308, `0050`. Its own role, its own
   * process, behind its own signed internal tier; `0040`'s narrow shape (one
   * column, one INSERT) plus the append-only receipt.
   */
  const CONTROL_APP_WRITES: readonly string[] = [
    `${CONTROL_APP_ROLE}:onboarding_record`,
    `${CONTROL_APP_ROLE}:onboarding_forced_step`,
    `${CONTROL_APP_ROLE}:internal_request_receipt`,
  ]

  it('A · no serving role writes any relation but the argued two', () => {
    const writable = rows.filter((r) => r.writes).map((r) => `${r.grantee}:${r.relname}`)
    assert.deepEqual(
      [...writable].sort(),
      [...WRITE_BY_DESIGN, ...CONTROL_APP_WRITES].sort(),
      'a serving role holds a write privilege in the control database that ' +
        '`WRITE_BY_DESIGN` above does not argue for. ' +
        '`db/migrations-control/0001_catalogue.sql`: "a serving process that cannot write ' +
        'the thing it serves is one fewer way for a published artefact to change under a ' +
        'plane that is pulling it." What this database holds is published DOWNWARD to every ' +
        'plane in the fleet, so a write here is a SUPPLY-CHAIN write — ' +
        '`server/control-plane/migrate-main.ts` calls that "a worse shape of problem than a ' +
        'read even though it touches no customer\'s data". ' +
        '🛑 AND SINCE G1161 THIS ASSERTION IS ALSO WHAT REPLACES A CONSTRUCTION: G193 held ' +
        'invariant 3 by TOPOLOGY, and the owner`s console ruling spent that in one ' +
        'direction. `db/control-read-scope.ts`: "By construction becomes by census, and ' +
        'that is a real loss, not a wash." This is the census. ' +
        '🛑 AND R9 (21 Sep 2026, THE OWNER\'S) IS WHY THIS IS AN ENUMERATION RATHER THAN AN ' +
        'EMPTY LIST: the owner took the write and ACCEPTED this assertion going red as a ' +
        'named cost. The empty list above is not weakened, it is SPENT — once, for two ' +
        'pairs, argued at `WRITE_BY_DESIGN`. A third pair is this gate going red again, ' +
        'and the commit that adds one owes the same argument. ' +
        `Found: [${[...writable].sort().join(', ')}] · argued: [${[...WRITE_BY_DESIGN].sort().join(', ')}]`,
    )
  })

  it('A2 · and the migration ledger is readable and writable by neither', () => {
    const ledger = rows.filter((r) => r.relname === 'schema_migration')
    assert.equal(
      ledger.length,
      SERVING_ROLES.length,
      'the ledger is not in the census once per serving role, so the two assertions below ' +
        'are about fewer grantees than this database has',
    )
    const writers = ledger.filter((r) => r.writes).map((r) => r.grantee)
    assert.deepEqual(
      writers,
      [],
      'a serving role can write the migration ledger, so a serving process could ' +
        'mark a migration applied that never ran — or un-mark one that did. ' +
        `\`db/migrate.ts\` keys the ledger on the FILENAME and applies anything absent from ` +
        `it. Found: [${writers.join(', ')}]`,
    )
    const readers = ledger.filter((r) => r.reads).map((r) => r.grantee)
    assert.deepEqual(
      readers,
      [],
      'a serving role can READ the migration ledger. That is not a disclosure worth ' +
        'much on its own, and it is asserted because `0001_catalogue.sql` grants `SELECT` ' +
        'table by table and the ledger is created by `db/migrate.ts` rather than by a ' +
        'migration — so a blanket `GRANT SELECT ON ALL TABLES` would be invisible in ' +
        `\`db/migrations-control/\` and visible only here. Found: [${readers.join(', ')}]`,
    )
  })

  /* ================================================================ *
   * §C · THE DATA PLANE'S REACH IS ONE TABLE — G1164.
   * ================================================================ */

  it('C · ⛔ NO ROLE THE DATA PLANE EVER HELD READS OR WRITES ANYTHING HERE — G4320', () => {
    /**
     * This read *"the console reader reads the roster and nothing else in this
     * database"* (G1161) until 5 Oct 2026. THE OWNER'S "Full restore" ruling
     * retired the reader and the writer; `0052` revokes every privilege both
     * held. The data plane reaches the roster only through the control plane's
     * signed internal operations, which run as `reconcile_control_app`.
     */
    const reach = rows
      .filter((r) => (r.grantee === CONTROL_READ_ROLE || r.grantee === CONTROL_WRITE_ROLE) && (r.reads || r.writes))
      .map((r) => `${r.grantee}:${r.relname}`)
    assert.deepEqual(
      reach,
      [],
      'a role the DATA plane held for this database still reaches a relation in it. G4320 ' +
        '(the owner`s 5 Oct 2026 ruling) retired both; `0052` revokes everything they were ' +
        `given. Found: [${reach.join(', ')}]`,
    )
  })

  it('R · ⛔ and neither retired role can LOG IN — a shell for 0020/0040`s replay, nothing more', async () => {
    const pool = await createCataloguePool()
    try {
      const r = await pool.query(
        'SELECT rolname::text AS rolname, rolcanlogin, rolpassword IS NULL AS no_password FROM pg_authid WHERE rolname = ANY($1) ORDER BY rolname',
        [[CONTROL_READ_ROLE, CONTROL_WRITE_ROLE]],
      ).catch(async () =>
        pool.query(
          'SELECT rolname::text AS rolname, rolcanlogin, true AS no_password FROM pg_roles WHERE rolname = ANY($1) ORDER BY rolname',
          [[CONTROL_READ_ROLE, CONTROL_WRITE_ROLE]],
        ),
      )
      assert.deepEqual(
        r.rows.map((x) => [x['rolname'], x['rolcanlogin']]),
        [
          [CONTROL_READ_ROLE, false],
          [CONTROL_WRITE_ROLE, false],
        ],
        'a retired data-plane role can log in to the control cluster again. G4320: they exist ' +
          'only because forward-only `0020`/`0040` GRANT to their names.',
      )
    } finally {
      await pool.end().catch(() => undefined)
    }
  })

  /* ================================================================ *
   * §B · A `tenant_id` COLUMN IS A DECISION.
   * ================================================================ */

  it('B · a relation carrying a `tenant_id` column is on the argued list', () => {
    // Deduplicated: the census crosses every relation with every serving role,
    // and a column is a property of the relation rather than of the grantee.
    const carrying = [...new Set(rows.filter((r) => r.has_tenant_column).map((r) => r.relname))]
    assert.ok(
      carrying.length > 0,
      'no relation in this database carries a `tenant_id` column, so this assertion is ' +
        'vacuous. `public.tenancy_roster` does — if it has been renamed or removed, the ' +
        'argued list above is describing a table that is not here.',
    )
    const unargued = carrying.filter((n) => !TENANT_COLUMN_BY_DESIGN.includes(n))
    assert.deepEqual(
      unargued,
      [],
      'a relation in the CONTROL database carries a `tenant_id` column and is not on the ' +
        'argued list at the top of this file. `db/migrations-control/0001_catalogue.sql` ' +
        'named this arrival: "the day somebody puts a tenant-scoped table in it, the absence ' +
        'of a policy on THAT table would look like the existing pattern." There is no ' +
        'row-level security in this database and there cannot usefully be any — no principal ' +
        'here carries a tenant — so a table that needs one belongs in the DATA database ' +
        `behind 0001_tenancy_and_rls.sql's predicate instead. Found: [${unargued.join(', ')}]`,
    )
  })

  it('B2 · nothing in the control migration set sets or reads `app.tenant_id`', async () => {
    /**
     * The other half of B, and it is the one that makes "there is no tenant
     * session here" a property of the tree rather than of a paragraph. If a
     * migration in this set ever names that GUC, this database has grown a
     * tenant boundary and B's argument stops holding.
     *
     * 🛑 STRIPPED, AND THE FIRST DRAFT OF THIS ASSERTION IS WHY — G834. It
     * scanned raw text and went RED against `0002_tenancy_roster.sql`, whose
     * header QUOTES `0001_tenancy_and_rls.sql`'s predicate in order to explain
     * that this database never sets it. A rule keyed on the token rather than
     * on the property would have made every future explanation of this fence a
     * red gate — §5.1, in the commit that added the fence.
     */
    const path = await import('node:path')
    const dir = path.join(import.meta.dirname, '..', '..', 'db', 'migrations-control')
    const sql = sqlCode(sqlCorpus(dir))
    sqlCorpusIsReal(sql, 'the control migration set')
    assert.ok(
      !sql.includes('app.tenant_id'),
      'a control-plane migration names `app.tenant_id`. Under G100 that GUC is never set in ' +
        'this database — nothing here imports `db/tenant-scope.ts` — so a predicate keyed on ' +
        'it denies unconditionally, and the table it guards is unreadable by the only ' +
        'process that may read it.',
    )
    assert.ok(
      !/CREATE\s+POLICY/i.test(sql),
      'a control-plane migration creates a row-level-security policy. 0001 refuses one in ' +
        'its own voice: "Adding an empty policy here would be worse than adding none." If ' +
        'this database has genuinely grown a tenant session, that ruling is what has to ' +
        'change first.',
    )
  })
})

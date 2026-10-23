/// <reference path="./pg.d.ts" />

/**
 * STANDING UP A DISPOSABLE POSTGRES — roles, database, schema, fixtures.
 *
 * G101: phase one runs against a disposable PostgreSQL with an in-process
 * `pg.Pool` and NO AWS RESOURCE on the critical path. This module is what makes
 * "disposable" true: a contributor with a running PostgreSQL needs no setup
 * step, and the two-tenant leak test rebuilds everything it depends on.
 *
 * 🛑 THIS IS A DEVELOPMENT AND TEST CONVENIENCE. It is not a deployment path
 * and must never become one. `createRoles()` needs SUPERUSER — `BYPASSRLS` can
 * only be granted by one — and handing a superuser connection string to
 * application code is the shape of problem
 * `docs/infrastructure-risk-register.md` exists to track. Anywhere real, the
 * three roles are created by a DBA or an infrastructure module, and only
 * `applyMigrations()` runs from here.
 */

import type { Client } from 'pg'

import { loadPg } from './pg.ts'
import {
  ROLES,
  dbTarget,
  adminUser,
  appPassword,
  enginePassword,
  migratorPassword,
  MAINTENANCE_DATABASE,
  dbSsl,
} from './env.ts'
import { applyMigrations } from './migrate.ts'

async function adminClient(database: string): Promise<Client> {
  const { Client } = await loadPg()
  const t = dbTarget()
  return new Client({
    host: t.host,
    port: t.port,
    ssl: dbSsl(t.host),
    database,
    user: adminUser(),
    application_name: 'reconcile-provision',
  })
}

/** A connected client as `reconcile_migrator` — BYPASSRLS, member of the owner role. */
export async function migratorClient(): Promise<Client> {
  const { Client } = await loadPg()
  const t = dbTarget()
  const password = migratorPassword()
  const client = new Client({
    host: t.host,
    port: t.port,
    ssl: dbSsl(t.host),
    database: t.database,
    user: ROLES.migrator,
    ...(password === undefined ? {} : { password }),
    application_name: 'reconcile-migrator',
  })
  await client.connect()
  return client
}

/**
 * `ALTER ROLE <role> PASSWORD '<password>'`, built by PostgreSQL rather than by
 * string concatenation here.
 *
 * ⚠️ `ALTER ROLE` IS UTILITY SYNTAX AND TAKES NO BIND PARAMETERS — the same trap
 * `db/tenant-scope.ts` documents for `SET LOCAL`, and the same obvious repair
 * (interpolate it) is the same injection. `format('%I', …)` and `format('%L', …)`
 * are the server's own identifier and literal quoting, so the round trip below
 * exists to get the quoting from the only thing that can be right about it.
 * Nothing here is attacker-reachable — these are operator-set environment
 * variables — but a pattern that is safe only because of who supplies the value
 * is a pattern that stops being safe when somebody reuses it.
 */
export async function setRolePassword(
  admin: Client,
  role: string,
  password: string,
): Promise<void> {
  const built = await admin.query('SELECT format($1, $2::text, $3::text) AS sql', [
    'ALTER ROLE %I PASSWORD %L',
    role,
    password,
  ])
  const sql = (built.rows[0] as { sql: string } | undefined)?.sql
  if (sql === undefined) throw new Error(`could not build an ALTER ROLE for ${role}`)
  await admin.query(sql)
}

/**
 * The cluster roles.
 *
 * ⚠️ THIS DOCBLOCK READ "The three roles" UNTIL 16 Aug 2026 AND THE SENTENCE IS
 * CORRECTED RATHER THAN DELETED, because a reader counting roles would have
 * trusted it. There are FOUR: `tenant_rw` joined them with the data-plane
 * schema. Derive it — `node -e "import('./db/env.ts')"` is not available on a
 * plain checkout, so read `ROLES` in `db/env.ts` instead.
 *
 * ⚠️ READ THE ATTRIBUTES, THEY ARE THE DESIGN:
 *
 *   reconcile_owner     NOLOGIN, NOBYPASSRLS. Owns the tables. Cannot connect
 *                       at all, so it is reachable only by `SET ROLE` from a
 *                       member — there is no credential for it to leak.
 *   reconcile_migrator  LOGIN, BYPASSRLS, member of owner. The read exemption
 *                       is an EXPLICIT ATTRIBUTE here, not a side effect of
 *                       owning something. G100.
 *   reconcile_app       LOGIN, NOBYPASSRLS, owns nothing, no CREATE on the
 *                       schema. The request path. It cannot bypass a policy
 *                       and it cannot drop one.
 *   tenant_rw           NOLOGIN, NOBYPASSRLS. Holds only the data-plane
 *                       schema grants; reconcile_app inherits this role.
 *
 * Note `reconcile_owner` is NOBYPASSRLS while the tables are FORCE ROW LEVEL
 * SECURITY. Between them, ownership no longer carries the read exemption — the
 * decoupling G100's row says is impossible is exactly what FORCE buys.
 */
/**
 * 🛑 THE ADVISORY LOCK, AND THE FLAKE IT ANSWERS.
 *
 * `node --test` runs test FILES concurrently, and three of them —
 * `tests/db/tenant-isolation.test.ts`, `tests/db/tenant-projection.test.ts` and
 * `tests/http/data-plane-http.test.ts` —
 * each rebuild their own database and each call `provision()` to do it. The
 * databases are different and deliberately so. The ROLES ARE NOT: they are
 * cluster-wide, and the `ALTER ROLE` statements below rewrite the same `pg_authid`
 * tuples from both processes at once. PostgreSQL answers that with
 * `XX000: tuple concurrently updated`, and the gate fails with a stack that names
 * `simple_heap_update` and says nothing whatever about tenancy.
 *
 * ⚠️ IT IS A RACE, SO IT IS INTERMITTENT, AND AN INTERMITTENT RED GATE IS THE
 * FAILURE MODE G95 PUT CI IN ON THE CONDITION OF AVOIDING — "the checks must be
 * real from day one", because a gate people learn to re-run is a gate people
 * learn to ignore. It was observed on a first full run on 16 Aug 2026 and was
 * NOT observed on the machine the slice was written on, which is exactly how this
 * class of defect ships.
 *
 * The lock is taken on the MAINTENANCE database, which both callers connect to,
 * because a PostgreSQL advisory lock is scoped to a database and one taken on the
 * two different targets would not exclude anything. It is session-scoped, so
 * `admin.end()` in the `finally` releases it even on a throw.
 */
const PROVISION_LOCK = [1263739, 1] as const

export async function createRoles(): Promise<void> {
  const admin = await adminClient(MAINTENANCE_DATABASE)
  await admin.connect()
  try {
    await admin.query('SELECT pg_advisory_lock($1, $2)', [PROVISION_LOCK[0], PROVISION_LOCK[1]])
    await admin.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLES.owner}') THEN
          CREATE ROLE ${ROLES.owner} NOLOGIN NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLES.migrator}') THEN
          CREATE ROLE ${ROLES.migrator} LOGIN BYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLES.app}') THEN
          CREATE ROLE ${ROLES.app} LOGIN NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLES.engine}') THEN
          CREATE ROLE ${ROLES.engine} LOGIN NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLES.tenantRw}') THEN
          CREATE ROLE ${ROLES.tenantRw} NOLOGIN NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLES.nameReader}') THEN
          CREATE ROLE ${ROLES.nameReader} NOLOGIN NOBYPASSRLS;
        END IF;
      END
      $$;
    `)
    // Idempotent, and re-asserted on every run so that a role edited by hand
    // between runs does not silently weaken the test.
    await admin.query(`ALTER ROLE ${ROLES.owner} NOLOGIN NOBYPASSRLS`)
    await admin.query(`ALTER ROLE ${ROLES.migrator} LOGIN BYPASSRLS`)
    await admin.query(`ALTER ROLE ${ROLES.app} LOGIN NOBYPASSRLS`)
    await admin.query(`ALTER ROLE ${ROLES.tenantRw} NOLOGIN NOBYPASSRLS`)
    await admin.query(`ALTER ROLE ${ROLES.engine} LOGIN NOBYPASSRLS`)
    await admin.query(`ALTER ROLE ${ROLES.nameReader} NOLOGIN NOBYPASSRLS`)
    await admin.query(`ALTER ROLE ${ROLES.migrator} SET search_path = tenant, public`)
    await admin.query(`ALTER ROLE ${ROLES.app} SET search_path = tenant, public`)
    await admin.query(`ALTER ROLE ${ROLES.engine} SET search_path = tenant, public`)
    await admin.query(`GRANT ${ROLES.owner} TO ${ROLES.migrator}`)
    await admin.query(`GRANT ${ROLES.tenantRw} TO ${ROLES.app}`)
    // G3741 — the run worker's role reads and writes everything the executor
    // already did, by being a MEMBER OF `reconcile_app` (which is how it reaches
    // `0001`/`0002`'s direct grants on `public` as well as `tenant_rw`'s), under
    // the same row level security, and additionally holds `INSERT` on the two
    // exception tables (`0500` §1). Engine ⊇ app, never the reverse.
    // 🛑 THE REVERSE GRANT MUST NEVER EXIST: `reconcile_app` a member of
    // `reconcile_engine` would let any request transaction `SET ROLE` into the
    // privilege `0015` refused it. `tests/db/engine-raises-exceptions.test.ts`
    // §1b witnesses the refusal.
    await admin.query(`GRANT ${ROLES.app} TO ${ROLES.engine}`)
    // ⚠️ AND THE REVERSE IS REVOKED ON EVERY RUN, NOT MERELY NEVER GRANTED: a
    // role is CLUSTER-wide and outlives `resetSchema()`, so a membership a past
    // provision or a person left behind would otherwise survive every reset.
    // Revoking a membership that does not exist is a WARNING, not an error.
    await admin.query(`REVOKE ${ROLES.engine} FROM ${ROLES.app}`)

    // G3886 — `0520`'s name reader. The OWNER role (the role migrations run as)
    // is a member so `0520` may transfer `tenant.co_member_name` to it; the
    // request-path roles are NOT, and that is re-asserted on every run for the
    // reason above: a membership somebody left behind survives `resetSchema()`.
    await admin.query(`GRANT ${ROLES.nameReader} TO ${ROLES.owner}`)
    await admin.query(`REVOKE ${ROLES.nameReader} FROM ${ROLES.app}`)
    await admin.query(`REVOKE ${ROLES.nameReader} FROM ${ROLES.tenantRw}`)
    await admin.query(`REVOKE ${ROLES.nameReader} FROM ${ROLES.engine}`)

    // 🛑 AND THE ADMIN ITSELF, WHICH IS NOT DECORATION — IT IS WHAT MAKES
    // `createDatabase()`'s OWNERSHIP RE-ASSERT PERMITTED ON AURORA.
    // `ALTER DATABASE ... OWNER TO r` requires the caller to be a MEMBER of `r`.
    // On the disposable local PostgreSQL the admin is a real superuser and the
    // membership is never consulted; the AURORA MASTER IS NOT A SUPERUSER — it
    // is `rds_superuser`, a role like any other, and `usesuper` is false on it.
    // It holds ADMIN OPTION here only because it created the role four lines up,
    // so this states the membership rather than inheriting it by luck.
    await admin.query(`GRANT ${ROLES.owner} TO CURRENT_USER`)

    // Only where the environment supplies one. A socket-local PostgreSQL
    // authenticates by trust or peer and has nothing to compare a password to;
    // `compose.yaml` sets both and its databases run `scram-sha-256`.
    const app = appPassword()
    if (app !== undefined) await setRolePassword(admin, ROLES.app, app)
    const engine = enginePassword()
    if (engine !== undefined) await setRolePassword(admin, ROLES.engine, engine)
    const migrator = migratorPassword()
    if (migrator !== undefined) await setRolePassword(admin, ROLES.migrator, migrator)
  } finally {
    await admin.end()
  }
}

/**
 * Make `reconcile_owner` OWN the target database, creating it if absent.
 *
 * 🛑 THIS RETURNED SILENTLY WHEN THE DATABASE ALREADY EXISTED, AND THAT IS WHY
 * THE FIRST REAL DATA-PLANE MIGRATION AGAINST AURORA FAILED:
 *
 *     error: permission denied for database reconcile_data
 *     code 42501 · file aclchk.c · routine aclcheck_error
 *     at applyMigrations (file:///app/db/migrate.ts:106)
 *
 * On the disposable local PostgreSQL NOTHING BUT THIS FUNCTION creates the
 * database, so `CREATE DATABASE ... OWNER reconcile_owner` always ran and the
 * ownership was true by construction — invisibly, as a side effect of who
 * happened to get there first. AURORA GETS THERE FIRST: the cluster is declared
 * with `defaultDatabaseName`, so the database exists before any code here
 * connects, OWNED BY THE MASTER USER. The existence check above then made this a
 * no-op, `reconcile_owner` was left holding no CREATE on the database, and
 * `db/migrations/0003_tenant_schema.sql`'s `CREATE SCHEMA tenant` was refused.
 *
 * ⚠️ THE CONTROL PLANE PASSED THE SAME RUN, which is what made this read as a
 * data-plane defect rather than a provisioning one. `migrations-control/` creates
 * no schema and lives entirely in `public` — which `giveSchemaToOwner()` hands
 * over explicitly — so it never exercised the privilege that was missing. A
 * plane passing is not evidence that provisioning is correct; it is evidence
 * that that plane does not need the part that is broken.
 *
 * THE REPAIR IS OWNERSHIP, NOT A GRANT. `GRANT CREATE ON DATABASE` would have
 * made this one migration run and left the stated property false. Ownership is
 * what G100 rests on — the owner holds DDL rights and NOT the read exemption —
 * and it is the same repair `giveSchemaToOwner()` already makes one level down,
 * for the same reason: WHO CREATED A THING IS AN ACCIDENT OF THE ENVIRONMENT,
 * AND WHO OWNS IT IS A DECISION.
 *
 * Re-asserted on every run rather than read first, matching the `ALTER ROLE`
 * block in `createRoles()`, so an ownership changed by hand between runs does
 * not survive to weaken the next one.
 */
export async function createDatabase(): Promise<void> {
  const t = dbTarget()
  const admin = await adminClient(MAINTENANCE_DATABASE)
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      t.database,
    ])
    if (exists.rowCount === 0) {
      // CREATE DATABASE cannot run inside a transaction block, hence no BEGIN.
      await admin.query(`CREATE DATABASE ${t.database} OWNER ${ROLES.owner}`)
      return
    }
    await admin.query(`ALTER DATABASE ${t.database} OWNER TO ${ROLES.owner}`)
  } finally {
    await admin.end()
  }
}

/**
 * Hand schema `public` to `reconcile_owner`.
 *
 * On PostgreSQL 14 and earlier, schema `public` in a new database is owned by
 * the BOOTSTRAP SUPERUSER regardless of who owns the database — so the migrator
 * cannot recreate it without this. (PostgreSQL 15 changed the default to
 * `pg_database_owner`; this is idempotent either way.) Superuser-only, which is
 * why it lives here beside the other superuser steps rather than in a migration.
 */
async function giveSchemaToOwner(): Promise<void> {
  const t = dbTarget()
  const admin = await adminClient(t.database)
  await admin.connect()
  try {
    await admin.query(`ALTER SCHEMA public OWNER TO ${ROLES.owner}`)
  } finally {
    await admin.end()
  }
}

/** Roles, database, schema ownership. Idempotent; safe to call on every run. */
export async function provision(): Promise<void> {
  await createRoles()
  await createDatabase()
  await giveSchemaToOwner()
}

/**
 * Rebuild the schema from the migrations, from empty.
 *
 * 🛑 WHY THE TEST DOES THIS ON EVERY RUN RATHER THAN MIGRATING FORWARD.
 *
 * The two-tenant leak test DROPS a policy on purpose, to prove that the
 * isolation it asserts is produced by that policy. If a run crashed between the
 * drop and the restore, the next run would start against a database with no
 * policy — and a test suite that reports GREEN while the control it exists to
 * verify is absent is worse than no suite at all. Rebuilding from the migration
 * makes that state unreachable rather than unlikely.
 *
 * 🛑 THAT LAST SENTENCE WAS FALSE UNTIL 16 Aug 2026, AND IT IS THE §5 SHAPE
 * SITTING INSIDE THE FUNCTION THAT CLAIMS TO CLOSE IT. This dropped `public` AND
 * ONLY `public` — a rule keyed on a convenient landmark (one schema name)
 * instead of the property it protects (an empty database). Any object outside
 * `public` survived, so a migration that had created a NON-`public` schema left
 * it standing and the next run died in its `before` hook with `42P07 relation
 * "…" already exists`. Observed live: a local `reconcile_test` carrying a
 * leftover `tenant` schema cancelled 12 tests across two files, four of them the
 * RLS negative controls. It failed LOUDLY rather than going green, which is the
 * saving grace — but a comment asserting unreachability over a control that does
 * not deliver it is exactly what §5 catalogues.
 *
 * ⚠️ AND THE FIRST REPAIR WAS THE SAME DEFECT WITH A LONGER LIST. `0003` created
 * the `tenant` schema, and the commit that added it (`844cff94`, merged as #168)
 * noticed the breakage and answered it by adding a second hard-coded line —
 * `DROP SCHEMA IF EXISTS tenant CASCADE` beside the `public` one. That is not a
 * smaller version of the bug; it is the identical bug with its landmark set
 * enumerated to two, and it comes back the day migration `0004` adds a schema,
 * with the same `42P07` and the same false comment above it. The enumeration is
 * removed here rather than extended. Recorded rather than quietly replaced,
 * because a reader comparing this function against #168 needs to know the two
 * lines were deliberate and are deliberately gone.
 *
 * Every non-system schema is dropped now, and the SET IS DERIVED FROM
 * `pg_namespace` AT RUN TIME rather than from any list — including a list read
 * out of `db/migrations/`, which would still be blind to a schema left by a
 * crashed run of a migration that has since been edited. `pg_*` and
 * `information_schema` are excluded because they are the server's rather than
 * ours. Nothing here needs changing when a migration adds a schema, which is the
 * whole of the fix.
 */
export async function resetSchema(): Promise<void> {
  await provision()
  const client = await migratorClient()
  try {
    await client.query('BEGIN')

    /**
     * ⚠️ THE DROPS RUN AS THE MIGRATOR AND THE `CREATE` RUNS AS THE OWNER, AND
     * THE ASYMMETRY IS THE POINT. `SET LOCAL ROLE reconcile_owner` before the
     * drops would refuse (`42501`) on any schema the owner does not own — and a
     * schema left behind by a crashed run is exactly the one nobody chose the
     * owner of. `reconcile_migrator` is a member of `reconcile_owner`
     * (`GRANT ${ROLES.owner} TO ${ROLES.migrator}`, above), so it can drop what
     * the owner owns AND what it created itself: strictly the larger set.
     */
    const found = await client.query(
      `SELECT nspname FROM pg_namespace
        WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'
        ORDER BY nspname`,
    )
    const schemas = (found.rows as unknown as Array<{ nspname: string }>).map((r) => r.nspname)
    for (const nspname of schemas) {
      // Quoted and doubled rather than interpolated bare. The name comes from
      // the catalogue and not from a request, so this is hygiene rather than a
      // boundary — but hygiene is what a boundary is made of.
      await client.query(`DROP SCHEMA IF EXISTS "${nspname.replace(/"/g, '""')}" CASCADE`)
    }

    // `public` comes back owned by `reconcile_owner`, as `giveSchemaToOwner()`
    // left it, because every migration below runs `SET LOCAL ROLE` to that role.
    await client.query(`SET LOCAL ROLE ${ROLES.owner}`)
    await client.query('CREATE SCHEMA public')
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
    throw err
  }
  try {
    await applyMigrations(client)
  } finally {
    await client.end()
  }
}

/**
 * Two tenants with contacts each, seeded as the migrator.
 *
 * Seeding NEEDS the BYPASSRLS role and that is not an inconvenience — it is the
 * policy working. `reconcile_app` cannot write a row for a tenant other than
 * the one its transaction is scoped to, because `WITH CHECK` forbids it, so
 * there is no session in which the application role could create this fixture.
 *
 * ⚠️ Ids are readable slugs stored VERBATIM — G97. `ten_acme`, not a uuid.
 * `text` compares like-for-like against `current_setting('app.tenant_id')` with
 * no cast, and that comparison IS the RLS predicate.
 */
export async function seedTwoTenants(first: string, second: string): Promise<void> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    for (const tenantId of [first, second]) {
      await client.query(
        /**
         * ⚠️ FIVE COLUMNS, NOT THREE, SINCE `0006_tenant_context_projection.sql`.
         * `environment` and `deployment_mode` carry NO DEFAULT deliberately —
         * that migration's own words: *"A column default would hand every
         * future `INSERT INTO tenant.tenant` a governance posture nobody
         * chose, silently"* — so every insert states both, and this is the
         * only insert in the tree. A fixture tenant is a SANDBOX tenant, which
         * is the posture that refuses non-synthetic ingest.
         */
        `INSERT INTO tenant.tenant (id, status, residency, environment, deployment_mode)
         VALUES ($1, 'active', 'ap-southeast-1', 'sandbox', 'hosted')`,
        [tenantId],
      )
      await client.query(
        `INSERT INTO tenant.tenant_contact
           (tenant_id, id, duty, contact_order, address, channel, data_class, holder_name)
         VALUES
           ($1, $2, 'security', 1, $3, 'email', 'personal', NULL),
           ($1, $4, 'billing',  1, $5, 'email', 'personal', NULL)`,
        [
          tenantId,
          `con_${tenantId}_sec`,
          `security@${tenantId}.example`,
          `con_${tenantId}_bil`,
          `billing@${tenantId}.example`,
        ],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await client.end()
  }
}

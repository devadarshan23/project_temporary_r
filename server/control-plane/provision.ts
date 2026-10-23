/**
 * STANDING UP THE CONTROL PLANE'S OWN DATABASE.
 *
 * 🛑 TWO ROLES HERE, NOT THREE, AND THE MISSING ONE IS THE POINT. The data plane
 * needs `reconcile_migrator` to carry `BYPASSRLS` separately from ownership,
 * because it has row-level security to be exempt from (G100). This database has
 * none — nothing in it is tenant-scoped — so a third role would be a separation
 * with nothing on the other side of it, and a reader would take its presence as
 * evidence that a tenant boundary is being enforced here. It is not, because
 * there is nothing here to enforce it over.
 *
 * What remains is the ordinary least-privilege split: the admin owns and
 * migrates; `reconcile_control_app` holds SELECT and nothing else, on every
 * table in this database.
 *
 * 🛑 **AND SINCE 20 Sep 2026 THERE ARE THREE, WHICH MEANS THE PARAGRAPH ABOVE
 * IS CORRECT ABOUT ITS TWO AND NO LONGER COUNTS THE ROLES. It is corrected
 * here rather than deleted, because "two roles, and the missing one is the
 * point" is the sentence this file has been quoted for.** The third is
 * `reconcile_control_reader` — **G1161, the owner's ruling** — and it does
 * not belong to this plane at all: it is the credential the DATA plane
 * connects with to read the tenancy roster for the consoles.
 *
 * ⚠️ IT IS NOT A THIRD *SEPARATION* OF THE KIND THE PARAGRAPH ABOVE REFUSES.
 * The refusal there is of a role with nothing on the other side of it — a
 * `BYPASSRLS` split in a database with no row-level security to be exempt
 * from. This role has a very specific thing on the other side of it: a
 * DIFFERENT PROCESS, holding a DIFFERENT PASSWORD, granted ONE table. The
 * argument for it being separate from `reconcile_control_app` is on
 * `db/migrations-control/0020_console_read_role.sql`, and it is that the app
 * role's `SELECT` set is *"everything this database publishes downward"* and
 * grows without anybody thinking about consoles.
 *
 * ⚠️ **AND THE INSTRUCTION THIS SLICE WAS GIVEN SAID TO MINT IT IN
 * `db/provision.ts` "beside the existing three", WHICH WOULD HAVE MINTED IT ON
 * THE WRONG SERVER.** Recorded rather than quietly departed from: that module
 * connects to `dbTarget()` — `data-plane-db` under `compose.yaml` — and a
 * PostgreSQL role is CLUSTER-wide, not cluster-spanning. The role has to exist
 * where the database it reads does. A role minted beside `reconcile_app` would
 * be a role on the tenant cluster that nothing authenticates as, while
 * `0020_console_read_role.sql`'s `GRANT` failed on the control cluster with
 * `role "reconcile_control_reader" does not exist`. The landmark was
 * `db/provision.ts`; the property is *"the cluster that holds the control
 * database"*, and §5.1 is exactly the difference between the two.
 *
 * ⚠️ THAT SENTENCE READ "SELECT on one table and nothing else" UNTIL
 * 20 Sep 2026 AND IS CORRECTED RATHER THAN DELETED, because a reader counting
 * tables off this header would have missed one. G831 added
 * `public.tenancy_roster` beside `public.pack_catalogue`. **The property it
 * was stating is unchanged and is now enumerated rather than counted**:
 * `tests/db/control-plane-census.test.ts` (G832) walks every relation in this
 * database from the catalogue and requires the application role to hold no
 * `INSERT`, `UPDATE` or `DELETE` on any of them, so the next table cannot
 * inherit the claim without inheriting the check.
 *
 * ⚠️ LIKE `db/provision.ts`, THIS IS A DEVELOPMENT AND TEST CONVENIENCE and must
 * never become a deployment path. It needs a role that can `CREATE ROLE`.
 */

import type { Client } from 'pg'

import { CONTROL_MIGRATIONS_DIR, applyMigrations } from '../../db/migrate.ts'
import { loadPg } from '../../db/pg.ts'
import { setRolePassword } from '../../db/provision.ts'
import { CONTROL_APP_ROLE, controlPlaneConfig } from './config.ts'
import { MAINTENANCE_DATABASE, dbSsl } from '../../db/env.ts'
/**
 * The two RETIRED data-plane roles — G4320, 5 Oct 2026, THE OWNER'S "Full
 * restore" ruling. They lived in `db/control-read-scope.ts` and
 * `db/control-write-scope.ts`, which are deleted with the credentials. They are
 * still created here, as INERT SHELLS, for one reason: `0020` and `0040` are
 * forward-only and GRANT to these names, and PostgreSQL refuses a GRANT to a
 * role that does not exist. `0052` revokes everything both were given.
 */
const RETIRED_CONTROL_READ_ROLE = 'reconcile_control_reader'
const RETIRED_CONTROL_WRITE_ROLE = 'reconcile_control_writer'

function adminUser(): string {
  const v = process.env['RECONCILE_CONTROL_DB_ADMIN']
  return v === undefined || v === '' ? 'postgres' : v
}

async function adminClient(): Promise<Client> {
  const { Client: PgClient } = await loadPg()
  const config = controlPlaneConfig()
  const password = process.env['RECONCILE_CONTROL_DB_ADMIN_PASSWORD']
  const client = new PgClient({
    host: config.database.host,
    port: config.database.port,
    ssl: dbSsl(config.database.host),
    database: config.database.name,
    user: adminUser(),
    ...(password === undefined || password === '' ? {} : { password }),
    application_name: 'reconcile-control-provision',
  })
  await client.connect()
  return client
}

/**
 * Create the application role and apply the control migrations.
 *
 * Idempotent; the entry point runs it on every boot, which is what makes the
 * compose stack a `docker compose up` rather than a runbook.
 */
/**
 * 🛑 THE ADVISORY LOCK, AND THE FLAKE IT ANSWERS — G1163, 20 Sep 2026.
 *
 * `db/provision.ts` carries this comment already and its own lock, for the
 * data-plane roles: *"`node --test` runs test FILES concurrently … The
 * databases are different and deliberately so. THE ROLES ARE NOT: they are
 * cluster-wide, and the `ALTER ROLE` statements below rewrite the same
 * `pg_authid` tuples from both processes at once. PostgreSQL answers that with
 * `XX000: tuple concurrently updated`."*
 *
 * ⚠️ **THIS FUNCTION HAD NO LOCK AND HAS ALWAYS HAD THE SAME EXPOSURE.** It
 * was survivable with two callers — `tests/db/tenancy-roster.test.ts` and
 * `tests/db/control-plane-census.test.ts`, each on its own database — and this
 * slice adds a THIRD in `tests/db/control-read-pool.test.ts` and a SECOND ROLE
 * for all three to rewrite. An intermittent red gate is the failure mode G95
 * put CI in on the condition of avoiding, so the lock is taken here rather
 * than waited for.
 *
 * A DIFFERENT KEY PAIR from `db/provision.ts`'s, deliberately: these are
 * different roles on (under `compose.yaml`) a different cluster, and sharing
 * a key would serialise two provisioning paths that never contend.
 *
 * 🛑 **IT IS TAKEN ON THE MAINTENANCE DATABASE AND THE CHOICE IS THE WHOLE OF
 * WHETHER IT WORKS.** A PostgreSQL advisory lock is scoped to a DATABASE, and
 * every one of the three test callers provisions its OWN control database —
 * `reconcile_control_roster_test`, `reconcile_control_census_test`,
 * `reconcile_control_read_test`. A lock taken on the target would therefore
 * exclude nothing at all while looking exactly like a lock, which is §5.6
 * wearing a mutex. `db/provision.ts` states the identical reasoning for the
 * identical reason.
 *
 * Session-scoped, so ending the lock client in the `finally` releases it even
 * on a throw.
 */
const CONTROL_PROVISION_LOCK = [1263739, 2] as const

/**
 * A connection to the maintenance database, for the lock and for nothing else.
 *
 * ⚠️ IT USES THE SAME ADMIN CREDENTIAL AS `adminClient()` AND NAMES A DIFFERENT
 * DATABASE. `db/env.ts#MAINTENANCE_DATABASE` is `postgres`, which every
 * PostgreSQL server this repository targets has — the official image creates
 * it, and `db/provision.ts` has depended on it for the data plane since 9 Aug
 * 2026.
 */
async function lockClient(): Promise<Client> {
  const { Client: PgClient } = await loadPg()
  const config = controlPlaneConfig()
  const password = process.env['RECONCILE_CONTROL_DB_ADMIN_PASSWORD']
  const client = new PgClient({
    host: config.database.host,
    port: config.database.port,
    ssl: dbSsl(config.database.host),
    database: MAINTENANCE_DATABASE,
    user: adminUser(),
    ...(password === undefined || password === '' ? {} : { password }),
    application_name: 'reconcile-control-provision-lock',
  })
  await client.connect()
  return client
}

export async function provisionControlPlane(): Promise<string[]> {
  const lock = await lockClient()
  await lock.query('SELECT pg_advisory_lock($1, $2)', [
    CONTROL_PROVISION_LOCK[0],
    CONTROL_PROVISION_LOCK[1],
  ])
  const admin = await adminClient()
  try {
    await admin.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${CONTROL_APP_ROLE}') THEN
          CREATE ROLE ${CONTROL_APP_ROLE} LOGIN NOBYPASSRLS;
        END IF;
      END
      $$;
    `)
    // Re-asserted every run, so a role edited by hand between runs cannot
    // silently gain an attribute. Same argument as db/provision.ts.
    await admin.query(`ALTER ROLE ${CONTROL_APP_ROLE} LOGIN NOBYPASSRLS`)

    const password = process.env['RECONCILE_CONTROL_APP_PASSWORD']
    if (password !== undefined && password !== '') {
      await setRolePassword(admin, CONTROL_APP_ROLE, password)
    }

    /**
     * 🛑 THE DATA PLANE'S TWO RETIRED ROLES — G4320, 5 Oct 2026. THEY WERE
     * `LOGIN` WITH A PASSWORD THE DATA PLANE HELD (G1161's reader, R9's writer)
     * AND ARE NOW `NOLOGIN` WITH NONE, RE-ASSERTED EVERY RUN so a role edited by
     * hand cannot quietly regain a login. They must still EXIST before
     * `applyMigrations()` for `0020`/`0040`'s replay (see the constants above);
     * `0052` strips their privileges, and `tests/db/control-plane-census.test.ts`
     * asserts both end states. No `RECONCILE_CONTROL_READ_PASSWORD` or
     * `RECONCILE_CONTROL_WRITE_PASSWORD` is read any more.
     */
    for (const role of [RETIRED_CONTROL_READ_ROLE, RETIRED_CONTROL_WRITE_ROLE]) {
      await admin.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
            CREATE ROLE ${role} NOLOGIN NOBYPASSRLS;
          END IF;
        END
        $$;
      `)
      await admin.query(`ALTER ROLE ${role} NOLOGIN NOBYPASSRLS PASSWORD NULL`)
    }

    /**
     * `asRole: null` — run the DDL as the connected admin. The data plane passes
     * `reconcile_owner` because ownership and the read exemption have to be
     * separately revocable there; here there is no exemption to separate.
     */
    return await applyMigrations(admin, { dir: CONTROL_MIGRATIONS_DIR, asRole: null })
  } finally {
    await admin.end()
    // Ending the session releases the advisory lock; an explicit unlock would
    // be a second thing to get wrong on a throw.
    await lock.end().catch(() => undefined)
  }
}

/**
 * Two platform-authored packs plus one that needs a higher schema version — so
 * `X-Schema-Version` visibly changes what `listEntitledPacks` returns, and the
 * version window is a demonstrable filter rather than a described one.
 *
 * 🛑 THIS IS NOT THE PACK-AUTHORING PIPELINE AND MUST NOT GROW INTO ONE. X1
 * writes this table for real, with signing and lifecycle transitions; nothing
 * here does. It runs as the ADMIN because `reconcile_control_app` holds SELECT
 * and nothing else — a serving process that could write the artefact it serves
 * is one more way for a published pack to change under a plane that is pulling
 * it.
 */
const CATALOGUE: ReadonlyArray<
  readonly [
    key: string,
    version: number,
    label: string,
    domain: string,
    lifecycle: string,
    minimumSchemaVersion: number,
  ]
> = [
  ['pack_ap_three_way', 3, 'Accounts Payable — three-way match', 'finance', 'active', 1],
  ['pack_bank_recon', 2, 'Bank statement reconciliation', 'finance', 'active', 1],
  ['pack_kyc_refresh', 1, 'KYC periodic refresh', 'kyc', 'promoted', 4],
]

export async function seedCatalogue(): Promise<number> {
  const admin = await adminClient()
  try {
    let inserted = 0
    for (const [key, version, label, domain, lifecycle, minimum] of CATALOGUE) {
      const result = await admin.query(
        `INSERT INTO pack_catalogue
           (pack_key, pack_version, label, domain, lifecycle, minimum_schema_version, superseded_by)
         VALUES ($1, $2, $3, $4, $5, $6, NULL)
         ON CONFLICT (pack_key, pack_version) DO NOTHING`,
        [key, version, label, domain, lifecycle, minimum],
      )
      inserted += result.rowCount ?? 0
    }
    return inserted
  } finally {
    await admin.end()
  }
}

/**
 * Three roster rows, and they are chosen so that every refusal
 * `db/migrations-control/0002_tenancy_roster.sql` makes is visible in the data
 * rather than only in its header: one hosted tenant with a plan, one BYOA
 * tenant in another region, and one tenant with `supportAccessMode: 'never'`
 * and NO plan — so `plan`'s nullability is exercised and a reader that assumed
 * a string fails against a fixture rather than against a customer.
 *
 * 🛑 THIS IS NOT H1 AND MUST NOT GROW INTO IT. `createTenant` is
 * `platform-console.openapi.yaml`'s, gated on `provision_substrate`, mounted
 * by nothing, and it is the writer this table's `SELECT`-only grant is waiting
 * for. It runs as the ADMIN for `seedCatalogue()`'s reason, one table over: the
 * application role holds `SELECT` and nothing else, and a serving process that
 * could mint a tenant could choose a residency, which H1.1 makes permanent.
 *
 * ⚠️ THE IDS ARE `ten_acme` AND FRIENDS, WHICH ARE THE DATA PLANE'S FIXTURE
 * TENANTS — and there is no constraint anywhere that makes them agree.
 * `tenant_id` here is a primary key and not a foreign key, because
 * `tenant.tenant` is in the other database. The migration says so; this is
 * where a reader meets the consequence.
 *
 * 🛑 THE ROWS ARE DELIBERATELY NOT IN ID ORDER, AND THAT IS A CONTROL RATHER
 * THAN AN ACCIDENT. `tests/db/tenancy-roster.test.ts` §1a asserts that
 * `readTenancyRoster()` returns the fleet sorted, and with the rows inserted
 * in sorted order that assertion PASSED against a reader whose `ORDER BY` had
 * been deleted — measured, not feared: PostgreSQL returned the heap in
 * insertion order and insertion order happened to be the answer. §5.6, in a
 * fixture. Inserting `ten_cardinal` first makes the missing clause a RED.
 */
const ROSTER: ReadonlyArray<
  readonly [
    tenantId: string,
    name: string,
    deploymentMode: string,
    residency: string,
    supportAccessMode: string,
    plan: string | null,
  ]
> = [
  ['ten_cardinal', 'Cardinal Mutual', 'hosted', 'ap-southeast-1', 'never', null],
  ['ten_acme', 'Acme Corporation', 'hosted', 'us-west-2', 'granted_only', 'standard'],
  [
    'ten_borealis',
    'Borealis Freight',
    'byoa',
    'eu-central-1',
    'granted_with_customer_approval',
    'enterprise',
  ],
]

/**
 * ONBOARDING STATE FOR THE THREE ROSTER TENANTS — G1241, 20 Sep 2026, the
 * owner's ruling.
 *
 * 🛑 IT IS SEEDED BY `seedTenancyRoster()` AND NOT BY A SECOND FUNCTION,
 * BECAUSE THE READER REFUSES A ROSTER ROW WITH NO ONBOARDING ROW.
 * `server/data-plane/console-roster-store.ts` answers `onboarding_record_absent`
 * and takes the WHOLE response down rather than publishing a tenant whose stage
 * it had to invent — so a fixture that wrote one and not the other would be a
 * fixture nothing can read, and writing both is G511's *"the fence and the
 * writer are one commit or neither"* arriving in a seed.
 *
 * ⚠️ AND THEY ARE ONE TRANSACTION FOR THE SAME REASON. Inserting the roster and
 * then failing on the onboarding row would leave exactly the half-state the
 * reader refuses, in a database no request path holds a privilege to repair.
 *
 * 🛑 THE THREE VALUES ARE CHOSEN SO THAT BOTH ARMS OF `onboardingStage()` AND
 * THE APPEND-ONLY TABLE ARE VISIBLE IN THE DATA rather than only in a header:
 * one tenant LIVE (all six steps done), one mid-sequence, and one mid-sequence
 * WITH A FORCED MARK — so `wasForced()` has something to be true of and
 * `onboarding_forced_step`'s trigger has a row to protect.
 *
 * ⚠️ THE FORCED TENANT'S COUNT AGREES WITH `forceStep()` RATHER THAN BEING
 * CHOSEN: forcing `pack_installed` (index 3) marks *"that step and everything
 * above it"*, so `completed` is 4. A fixture that disagreed would be this seed
 * writing a state neither transition can produce — which is the thing the
 * prefix-length shape exists to make unrepresentable, arriving through the one
 * door that is not a transition.
 *
 * 🛑 THIS IS NOT H2 AND MUST NOT GROW INTO IT — `seedTenancyRoster()`'s own
 * note about H1, inherited.
 *
 * ⚠️ **THE NEXT SENTENCE WAS FACTUALLY WRONG ABOUT BOTH OF ITS CLAIMS AND IS
 * CORRECTED RATHER THAN DELETED, because `db/migrations-control/0030`'s grants
 * block carried the identical error and the two together were the whole
 * argument for withholding a write privilege.** It read: *"`completeOnboardingStep`
 * and `forceOnboardingStep` are `platform-console.openapi.yaml`'s, mounted by
 * nothing, and they are the writers `db/migrations-control/0030_onboarding_record.sql`
 * withheld every write privilege for."*
 *
 * **Measured:** `grep -c 'completeOnboardingStep\|forceOnboardingStep'
 * docs/contracts/platform-console.openapi.yaml` → **0**. Both are, and always
 * were, on `docs/contracts/administration.openapi.yaml`, and **both carried
 * `x-capability: 'exempt: …'`** — so the grant argument rested on a gate that
 * did not exist. ✅ **R8 (21 Sep 2026, THE OWNER'S) MAKES THE GATE REAL**:
 * both are annotated `view_substrate` in place, which G911 made representable
 * on that tier by retiring `TIER_REQUIRES_CAPABILITY`.
 *
 * ✅ **AND "MOUNTED BY NOTHING" WENT FALSE IN THE SAME COMMIT.** Both are
 * mounted by `server/data-plane/start.ts`, and the writer `0030` withheld every
 * privilege for is `reconcile_control_writer` —
 * `db/migrations-control/0040_onboarding_writer.sql`, R9. **This seed still
 * runs as the ADMIN**, and that has not changed: the admin writes the INITIAL
 * row, which no serving role may create, and the writer role may only ADVANCE
 * one that exists.
 */
const ONBOARDING: ReadonlyArray<
  readonly [
    tenantId: string,
    completedSteps: number,
    forced: readonly (readonly [step: string, reason: string])[],
  ]
> = [
  ['ten_cardinal', 2, []],
  ['ten_acme', 6, []],
  [
    'ten_borealis',
    4,
    [
      [
        'pack_installed',
        'Customer signed the pack list off by email; the console binding waits on their cloud engineer.',
      ],
    ],
  ],
]

export async function seedTenancyRoster(): Promise<number> {
  const admin = await adminClient()
  try {
    let inserted = 0
    await admin.query('BEGIN')
    for (const [tenantId, name, mode, residency, support, plan] of ROSTER) {
      const result = await admin.query(
        `INSERT INTO tenancy_roster
           (tenant_id, name, deployment_mode, residency, support_access_mode, plan)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id) DO NOTHING`,
        [tenantId, name, mode, residency, support, plan],
      )
      inserted += result.rowCount ?? 0
    }
    for (const [tenantId, completed, forced] of ONBOARDING) {
      await admin.query(
        `INSERT INTO onboarding_record (tenant_id, completed_steps)
         VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO NOTHING`,
        [tenantId, completed],
      )
      for (const [step, reason] of forced) {
        /*
         * ⚠️ `ON CONFLICT DO NOTHING` AND NEVER `DO UPDATE`, WHICH IS THE
         * APPEND-ONLY TRIGGER OBSERVED RATHER THAN TESTED HERE: an upsert
         * would RAISE, because `0030`'s trigger refuses an `UPDATE` from every
         * role in the cluster including this admin.
         */
        await admin.query(
          `INSERT INTO onboarding_forced_step (tenant_id, step, reason)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id, step) DO NOTHING`,
          [tenantId, step, reason],
        )
      }
    }
    await admin.query('COMMIT')
    return inserted
  } catch (err) {
    await admin.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await admin.end()
  }
}

/**
 * THE ONE-SHOT JOB THAT HOLDS THE DANGEROUS CREDENTIALS — provision, migrate,
 * seed, EXIT.
 *
 * 🛑 WHY THIS FILE EXISTS AT ALL, WHICH IS THE WHOLE POINT OF IT.
 *
 * ⚠️ `server/data-plane/main.ts` DID ALL OF THIS ITSELF UNTIL 16 Aug 2026, and
 * its own header argued for it: "provision, migrate, seed if asked, listen. In
 * that order, in one process, so that `docker compose up` is the whole runbook."
 * The convenience was real and the cost was found by an adversarial read: the
 * long-running serving process held, FOR ITS ENTIRE LIFE, the two credentials
 * that void the control the whole slice rests on —
 *
 *   PGPASSWORD                   the cluster SUPERUSER, consumed implicitly by
 *                                `db/provision.ts`'s `adminClient()`, which
 *                                passes no password of its own;
 *   RECONCILE_MIGRATOR_PASSWORD  `reconcile_migrator`, `LOGIN BYPASSRLS` — the
 *                                read exemption every isolation assertion in
 *                                `tests/` is relative to.
 *
 * The request pool connects as `reconcile_app`/NOBYPASSRLS and that was never in
 * doubt. The fence was correct at the CONNECTION and undone at the CREDENTIAL
 * INVENTORY: any disclosure of `process.env` in the serving process — an SSRF,
 * an RCE, a stack trace with an environment dump — yielded BYPASSRLS and then
 * superuser, whatever the pool happened to be connected as. `db/provision.ts`
 * says so of itself in its own header: "handing a superuser connection string to
 * application code is the shape of problem
 * `docs/infrastructure-risk-register.md` exists to track." A serving process IS
 * application code.
 *
 * ┌─ THE FIX IS TWO THINGS AND THE SECOND ONE IS THE DURABLE ONE ──────────────┐
 * │ 1 · THE INVENTORY. `compose.yaml` gives the serving service                │
 * │     `RECONCILE_APP_PASSWORD` and NOTHING ELSE, and gives this job the      │
 * │     superuser and the migrator. This job then exits, so the window in      │
 * │     which those credentials are resident is the length of a migration      │
 * │     rather than the uptime of a server.                                    │
 * │                                                                            │
 * │ 2 · THE MODULE GRAPH. An inventory is a list somebody adds a line back to. │
 * │     `server/data-plane/main.ts` no longer STATICALLY IMPORTS               │
 * │     `db/provision.ts` or `db/migrate.ts` — so even with the variables      │
 * │     restored, the serving process has no `createRoles()` to call, because  │
 * │     it never loaded one. `tests/http/local-stack-exposure.test.ts` walks   │
 * │     the import closure of both entry points and requires exactly this      │
 * │     asymmetry: absent there, present here.                                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ THE COST, STATED RATHER THAN HIDDEN. `docker compose up` is still the whole
 * runbook, but it is no longer one container: `data-plane` now waits on
 * `service_completed_successfully` from this job. A serving container started
 * against an unmigrated database will fail its first query rather than migrate
 * itself, and that is the intended trade — a process that can repair the schema
 * is a process that can rewrite it.
 *
 * 🛑 NOTHING IN `server/data-plane/` STATICALLY IMPORTS `server/dev/`, AND THAT
 * INCLUDES THIS FILE. The fixture seeder is reached through a dynamic import, so
 * the property holds for the whole directory rather than for the one module
 * where it happened to matter. Reproduce:
 *
 *     grep -rn "from '\.\./dev/" server/data-plane/     # returns nothing
 */

import { applyMigrations } from '../../db/migrate.ts'
import { describeTarget } from '../../db/env.ts'
import { migratorClient, provision, resetSchema, seedTwoTenants } from '../../db/provision.ts'
import {
  LOCAL_TEST_AUTH_ENV,
  LOCAL_TEST_AUTH_ON,
  localTestAuthEnabled,
} from './session.ts'

const importSeeder = () => import('../dev/seed.ts')

/**
 * 🛑 THE IDENTITY SEEDER IS BEHIND A SECOND, NARROWER FLAG, AND IT IS G192's
 * FLAG RATHER THAN A NEW ONE. G299, 19 Sep 2026.
 *
 * `server/dev/identity-seed.ts` writes a person, a directory, a live role
 * assignment carrying a real capability and a LIVE SESSION ROW. **A seeded
 * production subject is the whole product compromised**, so the rule that
 * governs the test token governs this too, in the same words: the module is
 * reached by a DYNAMIC import that executes only when the flag is exactly the
 * string `1`, and a job started without it never LOADS the file.
 *
 * ⚠️ `RECONCILE_DEV_SEED` ALONE IS NOT ENOUGH, WHICH MAKES THIS STRICTLY
 * NARROWER THAN THE SEEDING THAT WAS ALREADY HERE. Fixture RUNS are rows in a
 * tenant nobody can reach without a session; a fixture SUBJECT is a way in.
 * `localTestAuthEnabled()` is the same predicate `resolveSessionReader()` uses
 * to decide whether to load the test token — one variable, read the same way,
 * in the two places a local credential can enter this system.
 *
 * 🛑 AND IT IS IMPORTED FROM `server/data-plane/session.ts` RATHER THAN
 * RE-SPELLED HERE. A second `=== '1'` would be a second place for the literal
 * to drift into `!== undefined`, and the whole of G192 is that there is *"no
 * value a future reader has to reason about."*
 */
const importIdentitySeeder = () => import('../dev/identity-seed.ts')

const RESET = process.env['RECONCILE_DEV_RESET'] === '1'
const SEED = process.env['RECONCILE_DEV_SEED'] === '1'

async function migrate(): Promise<string[]> {
  const client = await migratorClient()
  try {
    return await applyMigrations(client)
  } finally {
    await client.end()
  }
}

async function main(): Promise<void> {
  if (RESET) {
    // Drops and rebuilds schema `public` from the migrations. Only ever under an
    // explicit flag, because it is the one operation here that destroys data.
    await resetSchema()
    console.log(`data-plane-migrate: schema rebuilt from empty at ${describeTarget()}`)
  } else {
    await provision()
    const applied = await migrate()
    console.log(
      applied.length === 0
        ? `data-plane-migrate: nothing to apply at ${describeTarget()}`
        : `data-plane-migrate: applied ${applied.join(', ')}`,
    )
  }

  if (SEED) {
    await seedTwoTenants('ten_acme', 'ten_globex').catch((err: unknown) => {
      // Already seeded is the ordinary case on a re-run; a duplicate key here is
      // not a reason to fail the job and block the serving container behind it.
      console.log(
        `data-plane-migrate: tenants not seeded (${err instanceof Error ? err.message : String(err)})`,
      )
    })
    const { seedRuns } = await importSeeder()
    console.log(`data-plane-migrate: ${await seedRuns()} run(s) seeded`)

    if (localTestAuthEnabled()) {
      const { seedIdentitySubstrate } = await importIdentitySeeder()
      console.log(`data-plane-migrate: identity seeded — ${await seedIdentitySubstrate()}`)
    } else {
      /* Stated rather than silent: a developer who seeded runs and cannot
       * authenticate should be told which variable decides that, and told it
       * by the job rather than by a stack trace two commands later. */
      console.log(
        `data-plane-migrate: identity NOT seeded — ${LOCAL_TEST_AUTH_ENV} is not "${LOCAL_TEST_AUTH_ON}". ` +
          'A seeded subject can authenticate and hold a capability; the flag is the fence.',
      )
    }
  }
}

await main()

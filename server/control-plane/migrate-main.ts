/**
 * THE CONTROL PLANE'S ONE-SHOT PROVISIONING JOB — create the role, apply the
 * catalogue migrations, seed the fixture packs, EXIT.
 *
 * 🛑 THE SAME ARGUMENT AS `server/data-plane/migrate-main.ts`, ONE PLANE OVER,
 * AND IT IS MADE HERE SEPARATELY RATHER THAN CROSS-REFERENCED. The credentials
 * are different — `RECONCILE_CONTROL_DB_ADMIN` and its password own this
 * database and may `CREATE ROLE` — and the exposure is smaller, because nothing
 * in `reconcile_control` is tenant-scoped and there is no `BYPASSRLS` role to
 * leak. Smaller is not none: the admin owns every table the serving process
 * reads, so a serving process holding it could rewrite the catalogue it
 * publishes downward to every plane in the fleet. That is a supply-chain write,
 * which is a worse shape of problem than a read even though it touches no
 * customer's data.
 *
 * `server/control-plane/provision.ts` states the narrower privilege split this
 * preserves: the admin owns and migrates; `reconcile_control_app` holds SELECT
 * on one table and nothing else, so "a serving process that cannot write the
 * thing it serves is one fewer way for a published artefact to change under a
 * plane that is pulling it." That sentence was true of the ROLE and false of the
 * PROCESS until 16 Aug 2026, because the process also held the admin.
 */

import { provisionControlPlane, seedCatalogue, seedTenancyRoster } from './provision.ts'
import { controlPlaneConfig } from './config.ts'

const SEED = process.env['RECONCILE_DEV_SEED'] === '1'

async function main(): Promise<void> {
  const config = controlPlaneConfig()

  const applied = await provisionControlPlane()
  console.log(
    applied.length === 0
      ? `control-plane-migrate: nothing to apply to ${config.database.name}`
      : `control-plane-migrate: applied ${applied.join(', ')}`,
  )

  if (SEED) {
    console.log(`control-plane-migrate: ${await seedCatalogue()} catalogue row(s) seeded`)
    /**
     * G831, 20 Sep 2026. ⚠️ SEEDED HERE AND SERVED BY NOTHING — the roster has
     * no route on either plane, and that is not an omission this job can fix:
     * `listTenants` is `platform-console.openapi.yaml`'s, gated on
     * `view_substrate`, and the plane that resolves a console SESSION is the
     * DATA plane while this table is in the CONTROL database.
     * `tests/http/console-roster-unreachable.test.ts` measures the gap.
     */
    console.log(`control-plane-migrate: ${await seedTenancyRoster()} roster row(s) seeded`)
  }
}

await main()

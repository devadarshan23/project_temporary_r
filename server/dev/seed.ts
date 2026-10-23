/**
 * TWO TENANTS WITH DISTINGUISHABLE RUNS, SO ISOLATION IS VISIBLE RATHER THAN
 * ARGUED.
 *
 * 🛑 THE ROWS ARE DELIBERATELY UNMISTAKABLE. Every acme run id starts `run_acme_`
 * and every globex one `run_globex_`, and the two tenants have DIFFERENT
 * NUMBERS of runs. Both halves matter:
 *
 *   · the prefix means a leak is legible in one glance at a response body,
 *     rather than a matter of counting;
 *   · the differing counts mean a plane that served the SAME page to both
 *     sessions — the failure a fixture with two identical tenants hides
 *     perfectly — is visible without a diff.
 *
 * ⚠️ SEEDING NEEDS THE `BYPASSRLS` ROLE AND THAT IS THE POLICY WORKING, NOT AN
 * INCONVENIENCE. `reconcile_app` cannot write a row for a tenant other than the
 * one its transaction is scoped to, because `WITH CHECK` forbids it — so there
 * is no session in which the application role could create a two-tenant fixture.
 * `db/provision.ts` makes the same argument for `seedTwoTenants()`.
 */

import { migratorClient } from '../../db/provision.ts'

export const SEED_TENANTS = ['ten_acme', 'ten_globex'] as const

/**
 * Run ids per tenant, and the `status` each carries.
 *
 * The five statuses are `capability.openapi.yaml`'s own enum for the `status`
 * query parameter — `incomplete` included, which O-16 added on 16 Aug 2026 and
 * which is the member a hand-written copy is most likely to be missing. Seeding
 * one means `?status=incomplete` returns a row rather than an empty page, so a
 * browser can tell "filtered correctly" from "the filter matched nothing".
 */
const SEED_RUNS: ReadonlyArray<
  readonly [tenant: string, id: string, definition: string, status: string]
> = [
  ['ten_acme', 'run_acme_1', 'def_ap_three_way', 'completed'],
  ['ten_acme', 'run_acme_2', 'def_ap_three_way', 'failed'],
  ['ten_acme', 'run_acme_3', 'def_bank_statement', 'incomplete'],
  ['ten_globex', 'run_globex_1', 'def_ar_ageing', 'completed'],
  ['ten_globex', 'run_globex_2', 'def_ar_ageing', 'running'],
  ['ten_globex', 'run_globex_3', 'def_intercompany', 'queued'],
  ['ten_globex', 'run_globex_4', 'def_intercompany', 'completed'],
]

/**
 * Insert the fixture runs. Returns how many rows landed.
 *
 * `ON CONFLICT DO NOTHING` so a restarted container re-seeds harmlessly — the
 * composite `(tenant_id, id)` primary key is what makes that safe.
 */
export async function seedRuns(): Promise<number> {
  const client = await migratorClient()
  try {
    await client.query('BEGIN')
    let inserted = 0
    for (const [tenantId, runId, definitionId, status] of SEED_RUNS) {
      const result = await client.query(
        `INSERT INTO run
           (tenant_id, id, definition_id, definition_version, period_id,
            trigger_kind, status, started_at, finished_at, exceptions_raised)
         VALUES ($1, $2, $3, 1, NULL, 'manual', $4, now(), NULL, NULL)
         ON CONFLICT (tenant_id, id) DO NOTHING`,
        [tenantId, runId, definitionId, status],
      )
      inserted += result.rowCount ?? 0
    }
    await client.query('COMMIT')
    return inserted
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await client.end()
  }
}

/**
 * THE TENANCY ROSTER, READ — AND CALLED BY `tests/` AND BY NOTHING ELSE.
 *
 * G831 (20 Sep 2026), the owner's ruling: *"A control-plane roster table. The
 * tenancy roster is a control-owned fact and lives in the control database,
 * which the consoles read."*
 *
 * ┌─ WHY A READER WITH NO ROUTE, AND WHY THAT IS PRECEDENTED RATHER THAN A ───┐
 * │  HALF-FINISHED SLICE                                                      │
 * │ `db/migrations-control/0002_tenancy_roster.sql` grants `SELECT` and        │
 * │ nothing else, so there is no write privilege ahead of a writer here —      │
 * │ `0004_subject_ledger.sql`'s refusal does not bite. What is left is a       │
 * │ column set, and `0007_run_engine_account.sql` settled how a column set is  │
 * │ proven when no route may mount: *"the columns are proven by               │
 * │ `tests/db/run-engine-account.test.ts` instead of by a route"*. This is     │
 * │ that, one database over, and                                              │
 * │ `server/data-plane/event-stream-store.ts` is the same shape in the same    │
 * │ tree — three write functions *"called from `tests/` and from nowhere       │
 * │ else"*.                                                                    │
 * │                                                                            │
 * │ 🛑 A COLUMN WITH NO READER IS A COLUMN NOTHING CHECKS, AND THAT IS THE     │
 * │ WHOLE OF WHY THIS FILE EXISTS. Landing six columns with no statement that  │
 * │ names them would leave the grant, the column names and the types proven    │
 * │ by a migration that applied cleanly — which is a statement about DDL, not  │
 * │ about a read.                                                             │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THIS PLANE DOES NOT SERVE THE CONSOLES AND MUST NOT BE READ AS DOING SO.
 * `platform-console.openapi.yaml` declares `listTenants` on the
 * `platformConsole` tier with `TIER_REQUIRES_CAPABILITY` **`true`**, and
 * `server/control-plane/authorise.ts`'s `refuseGatedOperations()` throws at
 * BOOT for any mounted operation whose annotation names a capability. So this
 * process cannot mount that operation, and if it could it would be serving a
 * tenancy roster to a caller it cannot evaluate — G534's measurement in its
 * own words: *"mounting any of the 59 is mounting an ungated, unrecorded
 * read."* `tests/http/console-roster-unreachable.test.ts` measures all of it.
 *
 * ⚠️ WHICH LEAVES THE QUESTION THE OWNER ALREADY NAMED: *"the consoles must be
 * served by a plane that can reach it — which the deployed topology does not
 * currently do."* The plane that resolves a console SESSION is the DATA plane
 * (G726), the roster is in the CONTROL database, and no edge joins them —
 * `compose.yaml` puts `data-plane` on `data-net` alone and `control-plane-db`
 * on `control-net`. **That edge is an owner's ruling and is not taken here.**
 */

import type { CataloguePool } from './db.ts'

/**
 * One row of `public.tenancy_roster`.
 *
 * ⚠️ SNAKE_CASE, BECAUSE IT IS THE DATABASE'S SHAPE AND NOT THE WIRE'S. The
 * mapping to `TenantSummary` happens at a handler, and there is no handler —
 * so writing the wire's shape here would be this module guessing at a seam
 * nobody has built. `tests/db/tenancy-roster.test.ts` §3 joins the two by
 * deriving the contract's own property names, which is the only place the
 * correspondence is asserted.
 */
export interface RosterRow {
  readonly tenant_id: string
  readonly name: string
  readonly deployment_mode: string
  readonly residency: string
  readonly support_access_mode: string
  readonly plan: string | null
}

/**
 * Every tenant this platform has sold, in id order.
 *
 * 🛑 THE `WHERE` IS EMPTY AND THAT IS THE LOAD-BEARING LINE, for the reason
 * `server/data-plane/identity.ts` §6a gives about the partner grant: every
 * predicate somebody would add here deletes a decision that belongs somewhere
 * else. There is no `WHERE deployment_mode = …` because a console reads the
 * whole fleet; there is no residency narrowing because residency is a property
 * of a TENANT's data plane and not of this list; and there is no `stage` filter
 * because **there is no stage column** — `platform-console.openapi.yaml`
 * declares `components.parameters.OnboardingStage` and
 * `db/migrations-control/0002_tenancy_roster.sql` refuses the column it would
 * filter, under G833.
 *
 * ⚠️ THERE IS ALSO NO TENANT NARROWING, AND ITS ABSENCE IS THE POINT OF THE
 * WHOLE TABLE. This statement returns every row to every caller, which is
 * correct here and would be a cross-tenant read anywhere in the other
 * database. What makes it correct is that this database has no tenant session
 * to narrow to — see that migration's row-level-security section, and
 * `tests/db/control-plane-census.test.ts`, which is what keeps the next table
 * in this database from inheriting the permission without inheriting the
 * argument.
 */
const ROSTER_READ = `
  SELECT tenant_id, name, deployment_mode, residency, support_access_mode, plan
    FROM tenancy_roster
   ORDER BY tenant_id ASC
`

export async function readTenancyRoster(pool: CataloguePool): Promise<readonly RosterRow[]> {
  const result = await pool.query(ROSTER_READ)
  return result.rows as unknown as RosterRow[]
}

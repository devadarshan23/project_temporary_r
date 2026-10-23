/**
 * THE CONTROL PLANE'S RESOLVED CONFIGURATION — AND THE ABSENCE THAT IS THE
 * POINT OF IT.
 *
 * Invariant 3: "The control plane publishes downward and never reads tenant
 * data."
 *
 * ┌─ HOW THAT IS ENFORCED, IN ORDER OF STRENGTH ───────────────────────────────┐
 * │ 1 · `compose.yaml` does not attach `control-plane` to the network           │
 * │     `data-plane-db` lives on, so the hostname does not resolve inside the   │
 * │     process. Not refused — unresolvable.                                    │
 * │ 2 · The `control-plane` service sets no `RECONCILE_DB_*` variable at all.   │
 * │ 3 · There is no tenant-scoped table in `reconcile_control` to read.         │
 * │ 4 · This module reads `RECONCILE_CONTROL_*` and nothing else, imports       │
 * │     nothing from `db/`, and never calls `dbTarget()`.                       │
 * │                                                                            │
 * │ `tests/http/plane-separation.test.ts` asserts the consequence of 4: no      │
 * │ string that is a database credential of the data plane appears anywhere in  │
 * │ what this function returns.                                                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ AND HERE IS THE CLAIM THAT WOULD HAVE BEEN FALSE, WRITTEN OUT RATHER THAN
 * QUIETLY NOT MADE. This block first read "`server/control-plane/**` contains no
 * import of `db/env.ts`". That is true of DIRECT imports and FALSE of the module
 * graph: `server/control-plane/provision.ts` imports `db/migrate.ts`, which
 * imports `ROLES` from `db/env.ts` for its default DDL role. So `dbTarget()` IS
 * loaded into the control-plane process. Nothing calls it — and if something did,
 * the service sets no `RECONCILE_DB_*`, so it would resolve the local default
 * `reconcile_test` on `127.0.0.1` rather than the data plane's database.
 *
 * The correction matters more than the fact. A module graph is not a fence; it
 * is a thing a future import quietly changes. Fences 1, 2 and 3 above are the
 * ones that hold, and they are the ones ruling 3 asked for — "the plane boundary
 * is enforced by TOPOLOGY, not by review."
 */

const DEFAULT_HTTP_PORT = 9070

export interface ControlPlaneDatabaseConfig {
  readonly host: string
  readonly port: number
  readonly name: string
  readonly user: string
  readonly password?: string
  readonly poolMax: number
}

export interface ControlPlaneConfig {
  readonly plane: 'control'
  readonly http: { readonly host: string; readonly port: number }
  readonly database: ControlPlaneDatabaseConfig
  /**
   * SigV4 is what `control-plane.openapi.yaml` declares and nothing here
   * implements it. Reported so the posture is legible rather than assumed —
   * see `start.ts` for why a plane that can authenticate nobody refuses
   * everybody.
   */
  readonly localChannelAuth: boolean
  /**
   * The internal edge (G4302): the audience this plane names in every STS
   * request it forwards, and — deployed — the ONE role allowed to call it and
   * the region whose STS answers. Both `null` means NOBODY may call the
   * internal operations; there is no default caller.
   */
  readonly internal: {
    readonly audience: string
    readonly callerRoleArn: string | null
    readonly stsRegion: string | null
  }
}

function env(name: string, fallback: string): string {
  const v = process.env[name]
  return v === undefined || v === '' ? fallback : v
}

function nonEmpty(name: string): string | null {
  const v = process.env[name]
  return v === undefined || v === '' ? null : v
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

/** The role the control plane connects as. Reads the catalogue; owns nothing. */
export const CONTROL_APP_ROLE = 'reconcile_control_app'

/** The role that owns the control database and runs its migrations. */
export const CONTROL_ADMIN_ROLE_ENV = 'RECONCILE_CONTROL_DB_ADMIN'

export function controlPlaneConfig(): ControlPlaneConfig {
  const password = process.env['RECONCILE_CONTROL_APP_PASSWORD']
  return {
    plane: 'control',
    http: {
      host: env('RECONCILE_CONTROL_HTTP_HOST', '0.0.0.0'),
      port: intFromEnv('RECONCILE_CONTROL_HTTP_PORT', DEFAULT_HTTP_PORT),
    },
    database: {
      host: env('RECONCILE_CONTROL_DB_HOST', '127.0.0.1'),
      port: intFromEnv('RECONCILE_CONTROL_DB_PORT', 5432),
      name: env('RECONCILE_CONTROL_DB_NAME', 'reconcile_control'),
      user: CONTROL_APP_ROLE,
      ...(password === undefined || password === '' ? {} : { password }),
      poolMax: intFromEnv('RECONCILE_CONTROL_DB_POOL_MAX', 10),
    },
    localChannelAuth: process.env['RECONCILE_LOCAL_TEST_AUTH'] === '1',
    internal: {
      audience: env('RECONCILE_INTERNAL_AUDIENCE', 'reconcile-control-local'),
      callerRoleArn: nonEmpty('RECONCILE_INTERNAL_CALLER_ROLE_ARN'),
      stsRegion: nonEmpty('RECONCILE_INTERNAL_STS_REGION'),
    },
  }
}

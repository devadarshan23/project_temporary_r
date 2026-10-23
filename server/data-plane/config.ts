/**
 * THE DATA PLANE'S RESOLVED CONFIGURATION — INCLUDING THE CREDENTIALS THE
 * CONTROL PLANE MUST NOT HOLD.
 *
 * `tests/http/plane-separation.test.ts` reads this and `controlPlaneConfig()`
 * and asserts that no database credential of this one appears anywhere in that
 * one. Invariant 3 — "the control plane publishes downward and never reads
 * tenant data" — enforced by not holding the key rather than by choosing not to
 * turn it.
 *
 * 🛑 THIS IS NOT A DECLARATION BESIDE THE TRUTH; IT IS DERIVED FROM IT. The
 * database block comes from `dbTarget()` and `ROLES.app` — the same two things
 * `createAppPool()` connects with — so a configuration that says one thing while
 * the pool does another is not expressible. A config module that restated the
 * connection would be a second vocabulary with nothing checking it
 * (docs/HANDOFF.md §5.3), and the separation test would then be asserting
 * something about a document rather than about a process.
 *
 * ⚠️ AND `RECONCILE_CONTROL_*` IS NEVER READ HERE, in either direction. Each
 * plane's config module reads only its own prefix. That is why the two can be
 * compared at all: a shared reader would make them agree by construction and the
 * comparison would be vacuous.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 **THAT LAST PARAGRAPH WENT FALSE ON 20 Sep 2026 AND IS CORRECTED HERE
 *    RATHER THAN DELETED, BECAUSE IT IS THE SENTENCE FOUR FILES AND ONE TEST
 *    QUOTED — `tests/http/console-roster-unreachable.test.ts` §1b was written
 *    around it, `db/migrations-control/0002_tenancy_roster.sql` cites it, and
 *    `docs/build/deploy-handoff.md` §10.2 names it as the property shape (1)
 *    of the console ruling would threaten.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **G1161, THE OWNER'S RULING:** *"The data plane gains a READ-ONLY
 * control-database pool. A second connection, `SELECT` only, on its own
 * credential."* So this module now reads a control-database configuration, and
 * the header's own claim about itself has to move with it.
 *
 * ⚠️ **WHAT IS STILL EXACTLY TRUE, AND IT IS NARROWER THAN WHAT WAS: this
 * module reads `RECONCILE_CONTROL_READ_*` AND NOTHING ELSE BEGINNING
 * `RECONCILE_CONTROL_`.** That is its own prefix, not the control plane's. The
 * distinction is a control rather than a naming preference: `compose.yaml` sets
 * `RECONCILE_CONTROL_APP_PASSWORD` two services away, and a data plane reading
 * that variable would authenticate as the role granted `SELECT` on everything
 * this database publishes downward to the fleet. `db/control-read-scope.ts` is
 * where the narrow prefix is read, and
 * `tests/http/console-roster-unreachable.test.ts` §1b asserts that every
 * `RECONCILE_CONTROL` literal reachable from the data plane begins
 * `RECONCILE_CONTROL_READ_`.
 *
 * ⚠️ **AND THE COMPARISON THE OLD PARAGRAPH EXISTED TO PROTECT SURVIVES,
 * NARROWED IN THE SAME WAY.** `tests/http/plane-separation.test.ts` no longer
 * asks *"does any credential-shaped leaf of this config appear in the control
 * plane's"* — since the two now legitimately name the same DATABASE, that rule
 * would fire on `reconcile_control` and report a breach that is the ruling. It
 * asks the property instead: **no credential reaching TENANT DATA appears in
 * the control plane's configuration**, plus a new assertion in the other
 * direction — **the control-read user and password are not the control plane's
 * own.** Keying a rule on a convenient landmark rather than the property it
 * protects is §5.1, and it arrived here inside the control that exists to hold
 * this boundary.
 *
 * 🛑 **DO NOT READ ANY OF THIS AS INVARIANT 3 MOVING.** Copy it, never
 * paraphrase it: *"The control plane publishes downward and never reads tenant
 * data."* The edge opened here runs the other way — the DATA plane reading a
 * CONTROL-owned fact — and the forbidden direction is untouched:
 * `server/control-plane/config.ts` still reads no `RECONCILE_DB_*`, nothing
 * under `server/control-plane/` imports `db/tenant-scope.ts`, and `compose.yaml`
 * still leaves `data-plane-db` unresolvable inside that container. What IS
 * spent is G193's *by construction*, and `db/control-read-scope.ts` says so in
 * the ruling's own words rather than selling it as a wash.
 */

import { ROLES, dbTarget } from '../../db/env.ts'
import { validateSessionBounds } from '../../model/session.ts'
import { runQueueTarget } from './run-queue.ts'
import { platformSessionBounds } from './session-bounds.ts'
import { localTestAuthEnabled } from './session.ts'

/** Where the data plane binds when it is a process rather than a test fixture. */
const DEFAULT_HTTP_PORT = 9080

export interface PlaneDatabaseConfig {
  readonly host: string
  readonly port: number
  readonly name: string
  readonly user: string
  readonly password?: string
  readonly poolMax: number
}

export interface DataPlaneConfig {
  readonly plane: 'data'
  readonly http: { readonly host: string; readonly port: number }
  readonly database: PlaneDatabaseConfig
  /**
   * ⛔ THE SECOND CONNECTION IS GONE — G4320, 5 Oct 2026, THE OWNER'S "Full
   * restore" ruling: *"…then retire both control-DB credentials from the data
   * plane."* G1161's `controlRead` field described a read-only connection to
   * the CONTROL database; this plane now reaches the roster and the onboarding
   * record only through the control plane's signed internal operations
   * (`internalControlPlaneUrl` below), and holds no control-database
   * credential of any kind.
   */
  readonly internalControlPlaneUrl: string | null
  /**
   * Reported so an operator can see, in one place, whether this process will
   * accept a locally minted token. It is a READ of the fence, never the fence:
   * `resolveSessionReader()` is what decides, once, at boot.
   */
  readonly localTestAuth: boolean
  /**
   * WHETHER THIS PROCESS HAS ANYWHERE TO PUBLISH AN ADMITTED RUN — R-B,
   * 20 Sep 2026.
   *
   * ⚠️ IT IS A READ OF THE SEAM AND NEVER THE SEAM, exactly as `localTestAuth`
   * is: `resolveRunQueuePublisher()` is what decides, once, at boot. It is
   * reported for the same reason the flag is — so an operator can see in ONE
   * place that a plane will admit runs and tell nothing about them, rather
   * than discovering it from a log line under load.
   *
   * 🛑 NO CREDENTIAL AND NO ENDPOINT CROSSES INTO THIS OBJECT. A queue URL is
   * a resource name; `tests/http/plane-separation.test.ts` demands that no
   * data-plane CREDENTIAL appears in the control plane's configuration, and
   * putting an endpoint here would invite somebody to put a key beside it.
   */
  readonly runQueueConfigured: boolean
  /**
   * WHETHER THIS PROCESS COULD MINT A SESSION IF ANYTHING ASKED IT TO — R7,
   * 25 Sep 2026, the owner's.
   *
   * ⚠️ IT IS A READ OF THE SEAM AND NEVER THE SEAM, exactly as `localTestAuth`
   * and `runQueueConfigured` are. **The decision is `validateSessionBounds()`'s
   * and it is taken at MINT time**, once per mint, which is R7's own wording
   * and `session-bounds.ts`'s stated departure from this directory's
   * read-once-at-boot habit. This field re-runs the same reader so that an
   * operator can see in ONE place, in the start-up line, that a plane will
   * refuse every sign-in on its own configuration — rather than discovering it
   * from a 503 with nobody watching.
   *
   * 🛑 `false` IS THE STATE OF EVERY PLANE THAT HAS STATED NO BOUNDS, WHICH IS
   * ALL OF THEM TODAY, AND IT IS THE INTENDED FAILURE RATHER THAN A
   * REGRESSION. G139: the alternative is a default, which is *"a silently
   * unbounded session nobody would ever discover was never chosen."*
   */
  readonly sessionBoundsUsable: boolean
  /* ⛔ `identityTermsConfigured` WAS A FIELD HERE UNTIL 1 Oct 2026 — G2572.
   * It reported whether `RECONCILE_IDENTITY_AUDIENCE` and
   * `RECONCILE_IDENTITY_JWKS_URL` were set, and both are retired: under R2 as
   * amended (G2571) a door's audience and key-set URL are columns on
   * `tenant.identity_connection`, so whether a token could be verified is a
   * fact about the DATABASE, per door, and is answered by `main.ts`'s boot
   * inventory rather than by a config that touches no database. Nothing read
   * the field. */
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  // Unparseable configuration does not fall through to something permissive; it
  // falls back to the documented default, and a port is not a security control.
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function dataPlaneConfig(): DataPlaneConfig {
  const target = dbTarget()
  const password = process.env['RECONCILE_APP_PASSWORD']
  return {
    plane: 'data',
    http: {
      host: process.env['RECONCILE_HTTP_HOST'] ?? '0.0.0.0',
      port: intFromEnv('RECONCILE_HTTP_PORT', DEFAULT_HTTP_PORT),
    },
    database: {
      host: target.host,
      port: target.port,
      name: target.database,
      user: ROLES.app,
      ...(password === undefined || password === '' ? {} : { password }),
      poolMax: intFromEnv('RECONCILE_DB_POOL_MAX', 10),
    },
    internalControlPlaneUrl:
      process.env['RECONCILE_INTERNAL_CONTROL_PLANE_URL'] === undefined ||
      process.env['RECONCILE_INTERNAL_CONTROL_PLANE_URL'] === ''
        ? null
        : (process.env['RECONCILE_INTERNAL_CONTROL_PLANE_URL'] as string),
    localTestAuth: localTestAuthEnabled(),
    runQueueConfigured: runQueueTarget() !== null,
    sessionBoundsUsable: validateSessionBounds(platformSessionBounds()).ok,
  }
}

/// <reference path="./pg.d.ts" />

/**
 * `withTenantScope()` — THE ONLY PLACE A TRANSACTION AND ITS `SET LOCAL` ARE
 * ISSUED, AND THE RULE THAT NO QUERY MAY BE ISSUED OUTSIDE IT.
 *
 * `docs/build/phase-one-plan.md` §4A item 7 calls this "the only mechanical
 * defence against B5". B5 is the finding that RLS session variables are
 * CONNECTION state, not request state, and `docs/build/red-buildability.md`
 * lists three ways that leaks. This function answers all three:
 *
 *   MODE 1 — `SET` instead of `SET LOCAL`. A plain `SET` persists for the life
 *            of the connection, so request A for tenant T sets it, returns the
 *            connection to the pool, and request B for tenant U is served on
 *            that connection reading T's rows with RLS reporting success. This
 *            function never issues a session-level `SET`; `set_config`'s third
 *            argument is `is_local = true`, which reverts at COMMIT or
 *            ROLLBACK, unconditionally.
 *
 *   MODE 2 — `SET LOCAL` with no explicit transaction, which PostgreSQL
 *            SILENTLY DISCARDS. `docs/build/red-buildability.md:347` names the
 *            offenders: "Every ORM/driver that autocommits (`pg` by default,
 *            Drizzle and Prisma outside `$transaction`) produces exactly this."
 *            🛑 G99 PICKS DRIZZLE, THE ORM THAT LINE NAMES, AND MAKES THIS
 *            FUNCTION'S EXPLICIT TRANSACTION A NAMED NEGATIVE CONTROL RATHER
 *            THAN A REVIEW CONVENTION. `BEGIN` is issued here, on the same
 *            checked-out client, before anything else.
 *
 *   MODE 3 — transaction-mode pooling in front of the database, where
 *            session-level state is not preserved between statements at all.
 *            G101 assumes exactly that from day one. The argument that decided
 *            it: `SET LOCAL` INSIDE AN EXPLICIT TRANSACTION IS CORRECT UNDER
 *            BOTH POOLING MODES, so this is the only posture a later
 *            deployment decision cannot invalidate.
 *
 * And when it is bypassed anyway, G100's deny-on-NULL policy makes the failure
 * an EMPTY RESULT SET rather than another tenant's rows.
 */

import type { QueryResult } from 'pg'

import { loadPg } from './pg.ts'
import { ROLES, appPassword, enginePassword, dbTarget, dbSsl } from './env.ts'

export type QueryResultLike = QueryResult

/**
 * A checked-out connection, narrowed to what a scoped transaction may do.
 */
export interface ScopedClient {
  query(text: string, values?: readonly unknown[]): Promise<QueryResultLike>
  release(err?: Error | boolean): void
}

/**
 * ⚠️ A POOL WITH NO `query` METHOD, AND THE OMISSION IS THE WHOLE POINT.
 *
 * `pg.Pool` exposes `pool.query(...)`, which checks a connection out, runs one
 * autocommitted statement, and returns the connection. That is leak MODE 2
 * exactly, it is one keystroke away from every call site, and it is the single
 * most likely way invariant 1 gets broken in this codebase.
 *
 * `createAppPool()` therefore returns this type rather than `Pool`. A real
 * `pg.Pool` satisfies it structurally, so nothing is wrapped or proxied at
 * runtime — but the STATIC type has no `query`, so `pool.query(...)` is a
 * COMPILE ERROR at every call site rather than a code-review catch. Structural,
 * not procedural: the same argument G71 makes one layer up.
 */
export interface TenantPool {
  connect(): Promise<ScopedClient>
  end(): Promise<void>
}

/**
 * The pool the request path uses. Connects as `reconcile_app`, which holds
 * NEITHER `BYPASSRLS` nor ownership of any table — so a policy cannot be
 * bypassed and cannot be dropped by anything reachable from a request.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 `connectionTimeoutMillis` — G1984, 22 Sep 2026. **READ THIS BEFORE
 *    REMOVING IT, AND READ WHAT IT DOES NOT DO BEFORE RELYING ON IT.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **THIS POOL GAINED ITS FIRST ANONYMOUS CONSUMER ON 22 Sep 2026** — G1941
 * mounted `resolveHomeRealm`, the first unauthenticated person-facing
 * operation in the product, and `db/realm-scope.ts` holds a pooled connection
 * for the whole of each such request. Until then every checkout stood behind
 * an authenticated session; now one does not, and it is reachable through
 * CloudFront with no WAF and no throttle in front of it.
 *
 * 🛑 **WITHOUT A TIMEOUT, `pool.connect()` WAITS FOREVER — MEASURED, NOT
 *    FEARED.** Against the local PostgreSQL 16.13, `max: 10`, ten connections
 *    held and an eleventh caller arriving:
 *
 *      WITHOUT connectionTimeoutMillis -> ACQUIRED after 5715ms
 *                                         (it waited out the holders)
 *      WITH    connectionTimeoutMillis: 2_000
 *                                      -> REJECTED after 2000ms
 *                                         "timeout exceeded when trying to connect"
 *
 *    The 5,715ms is not a bound; it is how long that probe's holders happened
 *    to hold. The wait is unbounded in principle, so unauthenticated traffic
 *    could starve **every authenticated tenant request on the same task** with
 *    nothing to shed it.
 *
 * ⚠️ **THIS TOUCHES EVERY REQUEST PATH IN THE PRODUCT, NOT JUST THAT ONE, AND
 *    THAT IS ARGUED RATHER THAN NOTED.** There is ONE pool (the four scope
 *    helpers in `db/` all take it), so this changes what a tenant-scoped
 *    handler does under saturation: it now FAILS AT TWO SECONDS instead of
 *    queueing. That is a behaviour change and it is the wanted one — a caller
 *    who has waited two seconds for a connection has already lost the request
 *    to any sane client timeout, and a queue that never rejects converts a
 *    burst into a growing backlog with no signal. The failure surfaces as the
 *    500 `upstream_unavailable` `server/http/app.ts` mints for an unhandled
 *    error, which is honest: we could not complete it.
 *
 * 🛑 **IT SHEDS LOAD; IT DOES NOT PREVENT STARVATION, AND NOBODY SHOULD READ
 *    IT AS THE FIX.** An authenticated tenant request arriving during a flood
 *    of anonymous realm lookups still fails — it just fails in two seconds
 *    with a 500 rather than hanging. **The real answer is a per-IP throttle at
 *    the edge, and it is `infra/`'s, not this file's**: nothing in `db/` can
 *    tell one caller from a thousand, and `infra/lib/edge-stack.ts` publishes
 *    `/session/realm` on the console distribution today with no WAF, no rate
 *    limit and no `AWS::WAFv2` of any kind in the app. Derive that absence:
 *    `grep -rn 'WAFv2\|RateBasedStatement' infra/` -> nothing. **This constant
 *    is a fuse, not a cure.**
 *
 * ⚠️ **THE `2_000` IS THE VALUE ALREADY IN THIS DIRECTORY AND IS NOT A NEW
 *    NUMBER** — `db/env.ts#probeDatabase` and
 *    `db/control-read-scope.ts#probeControlRead` both use it. **Both of those
 *    are `Client` PROBES rather than pools, so this is the first POOL here to
 *    carry one**, which is worth stating because it means the precedent is
 *    the value and not the placement.
 *
 * ⚠️ **AND THE SIBLING POOL STILL HAS NO CEILING: `createControlReadPool()`
 *    in `db/control-read-scope.ts` sets `max` and no `connectionTimeoutMillis`,
 *    exactly as this function did.** It is NOT changed here — it is the
 *    console read path, it is outside this slice, and *"Cleanups are separate,
 *    isolated commits."* Named rather than silently swept, so the next reader
 *    of that file meets it.
 */
export async function createAppPool(max = 10): Promise<TenantPool> {
  const { Pool } = await loadPg()
  const t = dbTarget()
  const password = appPassword()
  return new Pool({
    host: t.host,
    port: t.port,
    ssl: dbSsl(t.host),
    database: t.database,
    user: ROLES.app,
    // Spread rather than `password: appPassword()`: under
    // `exactOptionalPropertyTypes` an explicit `undefined` is not the same as an
    // absent key, and `pg` treats the absent key as "fall back to PGPASSWORD or
    // to trust auth" — which is the local default the leak test relies on.
    ...(password === undefined ? {} : { password }),
    max,
    // See the header. A fuse, not a cure; the throttle is `infra/`'s.
    connectionTimeoutMillis: 2_000,
    application_name: 'reconcile-app',
  })
}

/**
 * A pool connected as `reconcile_engine` — G3741, `db/migrations/0500` §1.
 *
 * 🛑 THE RUN WORKER'S POOL AND NOBODY ELSE'S. It is `createAppPool()` with a
 * different USER and nothing else: the same `NOBYPASSRLS`, the same
 * `withTenantScope()`, the same row level security. The one difference is the
 * privilege `0015` refused the request path — `INSERT` on `tenant.exception` —
 * and that difference is why no serving process may construct one.
 */
export async function createEnginePool(max = 4): Promise<TenantPool> {
  const { Pool } = await loadPg()
  const t = dbTarget()
  const password = enginePassword()
  return new Pool({
    host: t.host,
    port: t.port,
    ssl: dbSsl(t.host),
    database: t.database,
    user: ROLES.engine,
    ...(password === undefined ? {} : { password }),
    max,
    connectionTimeoutMillis: 2_000,
    application_name: 'reconcile-engine',
  })
}

/**
 * Run `fn` inside an explicit transaction whose tenant scope is set and cannot
 * outlive it.
 *
 * `tenantId` comes from an authenticated session. INVARIANT 1: it is never read
 * from a request payload, and this function cannot check that — it is the last
 * link in the chain, not the first. What it does guarantee is that whatever
 * value it is given is the only tenant whose rows the enclosed queries can see.
 */
export async function withTenantScope<T>(
  pool: TenantPool,
  tenantId: string,
  fn: (tx: ScopedClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    /**
     * ⚠️ `SET LOCAL app.tenant_id = $1` DOES NOT WORK AND FAILS IN THE WORST WAY.
     *
     * `SET` is utility syntax, not DML: it takes no bind parameters. The
     * obvious repair — interpolating the id into the statement string — is a
     * SQL injection on the one value in the system that must never be
     * attacker-influenced, sitting directly under invariant 1.
     *
     * `set_config(name, value, is_local)` is an ordinary function call, so the
     * value binds as $1 and is never parsed as SQL. The third argument `true`
     * is what makes it LOCAL: reverted at COMMIT or ROLLBACK, so the connection
     * returns to the pool carrying nothing.
     */
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId])

    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (err) {
    // Best-effort: if the connection is already broken the ROLLBACK will throw
    // too, and the ORIGINAL error is the one worth propagating.
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

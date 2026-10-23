/// <reference path="./pg.d.ts" />

/**
 * WHERE THE DATABASE IS, AND WHETHER IT IS THERE.
 *
 * G101 — phase one runs against a disposable PostgreSQL with an in-process
 * `pg.Pool`. NO AWS RESOURCE IS ON THIS PATH, which matters because there is
 * not one today: `docs/infrastructure-risk-register.md` describes an account we
 * inherit, not one we have provisioned into.
 *
 * Everything is an environment variable with a local default, so a contributor
 * with a Homebrew PostgreSQL runs the suite with no configuration at all, and
 * CI points the same three variables somewhere else.
 */

import { loadPg, pgAvailable } from './pg.ts'

/** Fixed role names used by provisioning and the migrations. */
export const ROLES = {
  /** NOLOGIN. Owns every table; holds DDL rights and NOT the read exemption. */
  owner: 'reconcile_owner',
  /** LOGIN, BYPASSRLS, member of `owner`. Runs migrations and seeds fixtures. */
  migrator: 'reconcile_migrator',
  /** LOGIN, no BYPASSRLS, owns nothing. What the request path connects as. */
  app: 'reconcile_app',
  /** NOLOGIN, no BYPASSRLS. Carries data-plane grants on schema `tenant`. */
  tenantRw: 'tenant_rw',
  /**
   * LOGIN, no BYPASSRLS, owns nothing, member of `reconcile_app`. What the RUN
   * WORKER connects as, and the ONLY holder of `INSERT` on `tenant.exception`
   * (`db/migrations/0500`, G3741). `reconcile_app` is NOT a member of it, so no
   * request transaction can `SET ROLE` to it — the privilege is a property of
   * the CREDENTIAL, which the serving process is never handed.
   */
  engine: 'reconcile_engine',
  /**
   * NOLOGIN, no BYPASSRLS, owns ONE view. G3886 (`db/migrations/0520`, the
   * owner's C3-05 ruling): holds `SELECT (id, display_name)` on `tenant."user"`
   * and nothing else, is the only role `user_co_member_name_rls` is `TO`, and
   * OWNS `tenant.co_member_name`. Neither `reconcile_app` nor `tenant_rw` is a
   * member, so no request transaction can `SET ROLE` into it.
   */
  nameReader: 'reconcile_name_reader',
} as const

export interface DbTarget {
  readonly host: string
  readonly port: number
  readonly database: string
}

function env(name: string, fallback: string): string {
  const v = process.env[name]
  return v === undefined || v === '' ? fallback : v
}

/**
 * Whether this connection encrypts, decided ONCE.
 *
 * 🛑 THE FIRST REAL MIGRATION AGAINST AURORA FAILED HERE, AND THE MESSAGE NAMES
 * THE CAUSE EXACTLY:
 *
 *     FATAL: no pg_hba.conf entry for host "10.40.47.37",
 *     user "reconcile_control_admin", database "reconcile_control",
 *     NO ENCRYPTION
 *
 * Aurora refuses an unencrypted connection. Every `Client` and `Pool` in `db/`
 * was written against a disposable LOCAL PostgreSQL, where `ssl` unset is
 * correct and harmless — so all four connection sites omitted it, and all four
 * would have had to be fixed separately. This is ONE decision instead, for the
 * reason G111 gives about the money codec: *"correctness that lives at call
 * sites is correctness that drifts."*
 *
 * **The rule is the host.** A loopback address is the disposable local database
 * and takes no TLS; anything else is a real server across a real network and
 * must encrypt. That fails CLOSED — a misconfigured host gets encryption it did
 * not ask for, rather than a plaintext connection nobody notices.
 *
 * ⚠️ `rejectUnauthorized: false` — THIS ENCRYPTS AND DOES NOT VERIFY, AND
 * SAYING SO IS THE POINT. The traffic is confidential against a passive
 * observer and NOT authenticated against an active one. Verifying needs the
 * Amazon RDS CA bundle present in the image and named here, which is a change
 * to `Dockerfile` and to this function together. **Both planes reach their
 * database over a private subnet inside one VPC with no internet route, so the
 * active attacker this leaves open needs to already be inside that VPC** —
 * which is a real bar, not no bar, and it is why this ships rather than blocks.
 * Tracked; do not read this comment as saying the connection is verified.
 */
export function dbSsl(host: string): false | { rejectUnauthorized: false } {
  const local = host === '127.0.0.1' || host === 'localhost' || host === '::1'
  return local ? false : { rejectUnauthorized: false }
}

export function dbTarget(): DbTarget {
  return {
    host: env('RECONCILE_DB_HOST', '127.0.0.1'),
    port: Number(env('RECONCILE_DB_PORT', '5432')),
    database: env('RECONCILE_DB_NAME', 'reconcile_test'),
  }
}

/**
 * The role that CREATES the three roles and the database.
 *
 * Superuser, used by `db/provision.ts` and by nothing else. It is not a
 * migration role and it is certainly not the application role — it exists
 * because `CREATE ROLE ... BYPASSRLS` requires superuser and a migration
 * cannot mint the role it runs as.
 */
export function adminUser(): string {
  return env('RECONCILE_DB_ADMIN', env('USER', 'postgres'))
}

/**
 * The passwords for the two roles that LOG IN, or `undefined`.
 *
 * ⚠️ `undefined` IS THE LOCAL DEFAULT AND IT IS NOT A WEAKENING. A Homebrew or
 * a socket-local PostgreSQL authenticates by `trust` or `peer` and has no
 * password to give — the two-tenant leak test has run that way since 9 Aug 2026
 * and still does. Under `compose.yaml` the two databases authenticate by
 * `scram-sha-256` and these are set, which is what makes
 * `dataPlaneConfig().database.password` a real credential for
 * `tests/http/plane-separation.test.ts` to demand the control plane does not
 * hold.
 *
 * `reconcile_owner` is absent from this list because it is `NOLOGIN`: there is
 * no credential for it to have, which is the point of it (db/provision.ts).
 */
export function appPassword(): string | undefined {
  const v = process.env['RECONCILE_APP_PASSWORD']
  return v === undefined || v === '' ? undefined : v
}

/**
 * `reconcile_engine`'s password — G3741. Held by the RUN WORKER and by the
 * one-shot migrate job that sets it, and by NOTHING that serves a request:
 * a serving process holding it could mint findings against itself, which is
 * `db/migrations/0015`'s refusal and `0500` §1's whole argument.
 */
export function enginePassword(): string | undefined {
  const v = process.env['RECONCILE_ENGINE_PASSWORD']
  return v === undefined || v === '' ? undefined : v
}

export function migratorPassword(): string | undefined {
  const v = process.env['RECONCILE_MIGRATOR_PASSWORD']
  return v === undefined || v === '' ? undefined : v
}

/** The maintenance database to connect to when the target database may not exist yet. */
export const MAINTENANCE_DATABASE = 'postgres'

export function describeTarget(): string {
  const t = dbTarget()
  return `postgres://${t.host}:${t.port}/${t.database}`
}

export type Probe = { readonly ok: true } | { readonly ok: false; readonly reason: string }

/**
 * Is a PostgreSQL reachable at all?
 *
 * Connects to the MAINTENANCE database, not the target one — the target is
 * created by provisioning and its absence is not the question being asked.
 *
 * ⚠️ THE ONLY CALLER IS A TEST THAT SKIPS LOUDLY WHEN THIS RETURNS FALSE.
 * That skip is honest only for as long as it stays loud. A run of the suite in
 * which the two-tenant leak test skipped is not evidence that tenant isolation
 * holds, and the test says so in its own output.
 */
export async function probeDatabase(): Promise<Probe> {
  // The driver first: a missing `pg` and an unreachable server are the same
  // condition for our purposes, and the caller reports both the same way.
  const driver = await pgAvailable()
  if (!driver.ok) return driver

  const { Client } = await loadPg()
  const t = dbTarget()
  const client = new Client({
    host: t.host,
    port: t.port,
    database: MAINTENANCE_DATABASE,
    user: adminUser(),
    connectionTimeoutMillis: 2_000,
    application_name: 'reconcile-probe',
    ssl: dbSsl(t.host),
  })
  try {
    await client.connect()
    await client.query('SELECT 1')
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) }
  } finally {
    await client.end().catch(() => undefined)
  }
}

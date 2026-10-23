/// <reference path="./pg.d.ts" />

/**
 * THE MIGRATION RUNNER.
 *
 * Forward-only, in filename order, each file applied exactly once and recorded.
 * G88 rules expand/contract migrations for v1 and `docs/day-2-operations.md`
 * §3.2 says that discipline "must be adopted before the first deployment or not
 * at all" — so there is no `down`, and there is no facility for one. A mistake
 * is corrected by a new migration, never by editing an applied file.
 *
 * ⚠️ THE LEDGER TABLE IS CREATED HERE AND NOT IN `0001`. That keeps 0001 what
 * its name says it is — tenancy and RLS — and it is the honest home for it:
 * the ledger is the runner's own bookkeeping, it is not tenant-scoped, and no
 * RLS policy applies to it because `reconcile_app` is granted nothing on it.
 *
 * 🛑 AND IT IS SCHEMA-QUALIFIED `public.`, WHICH IS NOT STYLE. AN UNQUALIFIED
 * LEDGER MOVED SCHEMAS UNDERNEATH ITSELF BETWEEN TWO RUNS AGAINST AURORA AND
 * RE-RAN EVERY MIGRATION FROM 0001.
 *
 *     error: relation "tenant" already exists — 42P07
 *     at applyMigrations (file:///app/db/migrate.ts)
 *
 * `createRoles()` sets `search_path = tenant, public` on the migrator, and
 * PostgreSQL creates an unqualified table in the FIRST schema of the search
 * path — while `IF NOT EXISTS` checks only THAT schema, not the rest of the
 * path. So:
 *
 *   RUN 1 · schema `tenant` does not exist yet, the path falls through, the
 *           ledger is created in `public`, all three files apply and are
 *           recorded there. `0003_tenant_schema.sql` then CREATES SCHEMA
 *           `tenant` and moves the two tables into it.
 *   RUN 2 · schema `tenant` now exists and is first. `CREATE TABLE IF NOT
 *           EXISTS schema_migration` does not find one THERE, so it makes a
 *           SECOND, EMPTY ledger in `tenant`. The `SELECT` then reads that one.
 *           Nothing is recorded as applied. 0001 runs again.
 *
 * 🛑 `0003_tenant_schema.sql` WARNS ABOUT EXACTLY THIS, IN ITS OWN HEADER —
 * *"Qualify every CREATE TABLE explicitly from 0004 on, or the schema a table
 * lives in becomes a side effect of migration order."* The warning was written
 * about the MIGRATIONS and the ledger is not a migration, so nobody applied it
 * here. A rule keyed on a convenient landmark instead of the property it
 * protects — `docs/HANDOFF.md` §5, the most common defect shape in this
 * codebase — and the landmark was the directory the file happened to sit in.
 *
 * ⚠️ IT IS INVISIBLE ON A FRESH DATABASE, which is every local run and every
 * test that starts from empty: run 1 is correct, and run 1 is all a disposable
 * database ever does. IT NEEDS A SECOND RUN AGAINST A DATABASE THAT SURVIVED
 * THE FIRST — which, until this week, nothing here had.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Client } from 'pg'

import { ROLES } from './env.ts'

/**
 * The DATA plane's migrations. The default, because it was the only set until
 * ruling 3 (16 Aug 2026) put a second database behind a second process.
 *
 * 🛑 TWO DIRECTORIES, NOT ONE WITH A NAMING CONVENTION. `db/migrations-control/`
 * is the control plane's, and the two are separate because the two DATABASES
 * are separate: invariant 3 says "the control plane publishes downward and never
 * reads tenant data", and a single migration set applied to both would put a
 * `tenant` table in the control plane's database, where its mere existence would
 * be an invitation. Each runner is pointed at exactly one directory; neither can
 * see the other's files.
 */
export const DATA_MIGRATIONS_DIR = join(import.meta.dirname, 'migrations')
export const CONTROL_MIGRATIONS_DIR = join(import.meta.dirname, 'migrations-control')

const LEDGER = `
  CREATE TABLE IF NOT EXISTS public.schema_migration (
    filename    text        PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`

export async function migrationFilenames(dir: string = DATA_MIGRATIONS_DIR): Promise<string[]> {
  const entries = await readdir(dir)
  return entries.filter((f) => f.endsWith('.sql')).sort()
}

export interface MigrateOptions {
  /** Which migration set. Defaults to the data plane's. */
  readonly dir?: string
  /**
   * The role DDL runs as, or `null` to run as the connected role.
   *
   * Defaults to `reconcile_owner` — the data plane's split, where the migrator
   * holds `BYPASSRLS` and the owner holds the DDL rights (G100). The control
   * plane's database has no such split because it has no row-level security to
   * be exempt from, so it passes `null` rather than pretending to a separation
   * it does not have.
   */
  readonly asRole?: string | null
}

/**
 * Apply every migration not yet recorded. Returns the filenames applied.
 *
 * `client` must be connected as a role that may create the ledger and run the
 * files — `reconcile_migrator` for the data plane.
 */
export async function applyMigrations(
  client: Client,
  options: MigrateOptions = {},
): Promise<string[]> {
  const dir = options.dir ?? DATA_MIGRATIONS_DIR
  const asRole = options.asRole === undefined ? ROLES.owner : options.asRole
  const files = await migrationFilenames(dir)
  const applied: string[] = []

  await client.query('BEGIN')
  try {
    /**
     * ⚠️ DDL RUNS AS THE OWNER, NOT AS THE MIGRATOR — AND THIS LINE IS G100.
     *
     * `reconcile_migrator` holds `BYPASSRLS`, the READ EXEMPTION. It is a
     * MEMBER of `reconcile_owner`, which holds the DDL RIGHTS. Two grants, two
     * roles, separately revocable — instead of one role that has both because
     * ownership happened to come with the exemption attached.
     *
     * `SET LOCAL ROLE` rather than `SET ROLE` for the same reason every other
     * setting here is local: it reverts at COMMIT, so the connection cannot
     * return to the pool still wearing the owner's hat. Objects created below
     * are owned by `reconcile_owner`.
     */
    if (asRole !== null) await client.query(`SET LOCAL ROLE ${asRole}`)
    await client.query(LEDGER)

    const done = await client.query('SELECT filename FROM public.schema_migration')
    const seen = new Set((done.rows as Array<{ filename: string }>).map((r) => r.filename))

    for (const file of files) {
      if (seen.has(file)) continue
      const sql = await readFile(join(dir, file), 'utf8')
      await client.query(sql)
      await client.query('INSERT INTO public.schema_migration (filename) VALUES ($1)', [file])
      applied.push(file)
    }

    await client.query('COMMIT')
    return applied
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  }
}

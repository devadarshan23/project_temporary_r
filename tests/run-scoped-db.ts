/**
 * PER-RUN TEST DATABASE NAMES — U-23 / G3914, closed by G4151–G4155.
 *
 * 🛑 THE DEFECT. Every database-backed suite named its own database with a
 * literal — `reconcile_browser_e2e_test`, `reconcile_engine_test`, … — and
 * RESETS it at the start. Within one gate that is safe, because no two files
 * share a name. Two gates against ONE PostgreSQL are two runs of the same
 * files, so each file meets its twin on the same database: one run's reset
 * drops the other's schema mid-suite. WITNESSED, 4 Oct 2026, two concurrent
 * `node --test "tests/db/*.test.ts"` on one PostgreSQL 14.18 (alone: 829 of 829
 * pass): run A 325 CANCELLED, run B 9 FAILED + 469 CANCELLED, with
 * `duplicate key value violates unique constraint "pg_database_datname_index"`
 * (×30), `relation "tenant" already exists` (×30) and
 * `relation "run" does not exist` (×9).
 *
 * THE REPAIR is that a name is a fact about a RUN, not about a file:
 * `runScopedName(base)` appends `__t<host>p<pid>`, where `<pid>` is the
 * `node --test` RUNNER's — every test file is a child of it, so siblings in one
 * gate agree and two gates differ. It is recorded in `RECONCILE_TEST_RUN` on
 * first use so a process a suite spawns inherits the same tag rather than
 * deriving its own from a different parent. `<host>` is four hex characters of
 * the host name's digest, because a PID only means something on its own machine.
 *
 * ⚠️ AN EXPLICIT OVERRIDE IS STILL VERBATIM. Every suite reads
 * `process.env['RECONCILE_<SUITE>_DB_NAME'] ?? runScopedName('…')`, so a person
 * who names a database gets exactly that name — and owns it: it is never dropped.
 *
 * CLEANUP, TWO LAYERS, NEITHER ALLOWED TO FAIL A SUITE:
 *
 *  1. On the first mint in a test file, a ROOT `after()` hook is registered: it
 *     drops every name this process minted, WITHOUT `FORCE`. Root hooks run after
 *     every `describe`'s own `after`, so a suite that closed its pools loses its
 *     database at once. A suite that left a connection open keeps it — `FORCE`
 *     would terminate a pool the suite still owns, and that pool's `error` event
 *     surfaces as an uncaught exception AFTER the test ended (seen in the
 *     RED run above: *"terminating connection due to administrator command"*).
 *  2. The same hook then SWEEPS, under a try-lock so only one process at a time
 *     does it: every database and role whose tag names THIS host and a runner PID
 *     that is no longer alive is dropped WITH (FORCE) — nobody is left to own it.
 *     That is what collects layer 1's leftovers, and a crashed or killed run's.
 *     ⚠️ A tag from another host is never touched: its PID is not ours to test.
 *
 * Neither layer moves a timeout or retries anything; both are best-effort and
 * bounded by a short connect timeout, because a cleanup that can turn a green
 * suite red is a cleanup somebody will delete.
 */

import type { Client } from 'pg'
import { createHash } from 'node:crypto'
import { hostname } from 'node:os'
import { after } from 'node:test'

import { loadPg } from '../db/pg.ts'
import { adminUser, dbSsl, dbTarget, MAINTENANCE_DATABASE } from '../db/env.ts'

export const TEST_RUN_ENV = 'RECONCILE_TEST_RUN'

/** `t<4 hex>p<decimal pid>` — the only shape this module mints or sweeps. */
const TAG = /^t([0-9a-f]{4})p([0-9]+)$/
/** A run-scoped identifier: `<base>__<tag>`. */
const SCOPED = /^([a-z][a-z0-9_]*?)__t([0-9a-f]{4})p([0-9]+)$/
/**
 * The same tag spelled in LETTERS, for a ROLE: the rotation Lambda's own guard
 * (`infra/lambda/role-secret-rotation/guards.mjs`, `ROLE_NAME_PATTERN`) admits
 * `^reconcile_[a-z_]{1,40}$` and no digit, and a test must not widen a product
 * guard to fit its fixture. Each hex nibble / decimal digit `d` is the letter `a + d`.
 */
const SCOPED_LETTERS = /^([a-z][a-z_]*?)__t([a-p]{4})p([a-j]+)$/
const toLetters = (digits: string): string =>
  [...digits].map((d) => String.fromCharCode(97 + parseInt(d, 16))).join('')
const fromLetters = (letters: string, radix: 16 | 10): string =>
  [...letters].map((l) => (l.charCodeAt(0) - 97).toString(radix)).join('')

/** PostgreSQL truncates an identifier past 63 bytes — silently, so refuse instead. */
const IDENTIFIER_MAX = 63

export function hostTag(name: string = hostname()): string {
  return createHash('sha256').update(name).digest('hex').slice(0, 4)
}

/**
 * The run this process belongs to. Inherited when a parent already set it; else
 * derived from the parent PID — under `node --test`, the runner — and recorded.
 */
export function testRunTag(env: NodeJS.ProcessEnv = process.env, ppid: number = process.ppid): string {
  const inherited = env[TEST_RUN_ENV]
  if (inherited !== undefined && inherited !== '') {
    if (!TAG.test(inherited)) {
      throw new Error(
        `${TEST_RUN_ENV}=${inherited} is not a run tag (t<4 hex>p<pid>). Unset it; it is derived per run.`,
      )
    }
    return inherited
  }
  const tag = `t${hostTag()}p${ppid}`
  env[TEST_RUN_ENV] = tag
  return tag
}

const minted = new Set<string>()
let hookRegistered = false

/** `base` scoped to this run. Same base, same run → same name; another run → another name. */
export function runScopedName(base: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(base) || base.includes('__')) {
    throw new Error(`runScopedName: ${JSON.stringify(base)} is not a plain lower-case identifier`)
  }
  const name = `${base}__${testRunTag()}`
  if (Buffer.byteLength(name) > IDENTIFIER_MAX) {
    throw new Error(`runScopedName: ${name} is ${Buffer.byteLength(name)} bytes; PostgreSQL truncates past 63`)
  }
  minted.add(name)
  if (!hookRegistered && process.env['NODE_TEST_CONTEXT'] !== undefined) {
    hookRegistered = true
    after(async () => {
      await dropMinted()
      await sweepDeadRuns()
    })
  }
  return name
}

/**
 * `base` scoped to this run, spelled in letters only — for a cluster-wide ROLE a
 * suite creates and drops itself. Not recorded for layer 1: the suite owns its
 * own `DROP ROLE`; layer 2 collects it if the run died first.
 */
export function runScopedRoleName(base: string): string {
  if (!/^[a-z][a-z_]*$/.test(base) || base.includes('__')) {
    throw new Error(`runScopedRoleName: ${JSON.stringify(base)} is not a plain lower-case letters-only identifier`)
  }
  const m = TAG.exec(testRunTag())
  if (m === null) throw new Error('unreachable: testRunTag() returned a malformed tag')
  return `${base}__t${toLetters(m[1] as string)}p${toLetters(m[2] as string)}`
}

/** Parse a run-scoped identifier in either spelling; `null` when this module did not mint it. */
export function parseRunScoped(name: string): { base: string; host: string; pid: number } | null {
  const m = SCOPED.exec(name)
  if (m !== null) return { base: m[1] as string, host: m[2] as string, pid: Number(m[3]) }
  const l = SCOPED_LETTERS.exec(name)
  if (l === null) return null
  return { base: l[1] as string, host: fromLetters(l[2] as string, 16), pid: Number(fromLetters(l[3] as string, 10)) }
}

/** Whether a PID names a live process on this machine. EPERM means alive and not ours. */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** The ports the suites' clusters are on — data, and control when a test splits it (G3912). */
function ports(): number[] {
  const p = (n: string): number | undefined => {
    const v = process.env[n]
    return v === undefined || v === '' ? undefined : Number(v)
  }
  /* `db/env.ts`'s own default, read from it — never spelled here (G3913 §3a). */
  const data = dbTarget().port
  const control = p('RECONCILE_CONTROL_DB_PORT') ?? data
  return control === data ? [data] : [data, control]
}

async function withAdmin(port: number, body: (c: Client) => Promise<void>): Promise<void> {
  const { Client } = await loadPg()
  const host = dbTarget().host
  const c = new Client({
    host,
    port,
    ssl: dbSsl(host),
    database: MAINTENANCE_DATABASE,
    user: adminUser(),
    application_name: 'reconcile-test-run-cleanup',
    connectionTimeoutMillis: 2_000,
  })
  try {
    await c.connect()
    await body(c)
  } catch {
    /* best-effort: an unreachable server has nothing to clean */
  } finally {
    await c.end().catch(() => {})
  }
}

const quote = (id: string): string => `"${id.replaceAll('"', '""')}"`

/** Layer 1 — drop what this process minted, without terminating anybody's connection. */
export async function dropMinted(): Promise<void> {
  if (minted.size === 0) return
  for (const port of ports()) {
    await withAdmin(port, async (c) => {
      for (const name of minted) {
        await c.query(`DROP DATABASE IF EXISTS ${quote(name)}`).catch(() => {})
      }
    })
  }
}

/** Advisory key for the sweep — distinct from `db/provision.ts`'s `[1263739, 1]`. */
const SWEEP_LOCK = [1263739, 4151] as const

/**
 * Layer 2 — drop every database and role tagged with THIS host and a dead runner.
 * Returns the names it dropped (for the suite that witnesses it).
 */
export async function sweepDeadRuns(
  alive: (pid: number) => boolean = pidAlive,
  opts: { readonly blocking?: boolean } = {},
): Promise<string[]> {
  const dropped: string[] = []
  const here = hostTag()
  const dead = (n: string): boolean => {
    const p = parseRunScoped(n)
    return p !== null && p.host === here && !alive(p.pid)
  }
  for (const port of ports()) {
    await withAdmin(port, async (c) => {
      if (opts.blocking === true) {
        await c.query('SELECT pg_advisory_lock($1, $2)', [SWEEP_LOCK[0], SWEEP_LOCK[1]])
      } else {
        const lock = await c.query('SELECT pg_try_advisory_lock($1, $2) AS ok', [SWEEP_LOCK[0], SWEEP_LOCK[1]])
        if (lock.rows[0]?.['ok'] !== true) return
      }
      try {
        const dbs = await c.query("SELECT datname FROM pg_database WHERE datname LIKE '%\\_\\_t%p%'")
        for (const datname of dbs.rows.map((r) => String(r['datname']))) {
          if (!dead(datname)) continue
          await c
            .query(`DROP DATABASE IF EXISTS ${quote(datname)} WITH (FORCE)`)
            .then(() => dropped.push(datname))
            .catch(() => {})
        }
        const roles = await c.query("SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_\\_t%p%'")
        for (const rolname of roles.rows.map((r) => String(r['rolname']))) {
          if (!dead(rolname)) continue
          await c
            .query(`DROP ROLE IF EXISTS ${quote(rolname)}`)
            .then(() => dropped.push(rolname))
            .catch(() => {})
        }
      } finally {
        await c.query('SELECT pg_advisory_unlock($1, $2)', [SWEEP_LOCK[0], SWEEP_LOCK[1]]).catch(() => {})
      }
    })
  }
  return dropped
}

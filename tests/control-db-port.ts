/**
 * WHERE THE CONTROL DATABASE IS, IN A TEST — ONE ANSWER, DERIVED FROM THE DATA
 * DATABASE'S PORT UNLESS SOMEBODY SAID OTHERWISE. G3912, 4 Oct 2026.
 *
 * ┌─ THE DEFECT ───────────────────────────────────────────────────────────────┐
 * │ A gate run against a PRIVATE PostgreSQL sets `RECONCILE_DB_PORT` to its    │
 * │ own port and nothing else. Until this module, three readers of the control │
 * │ database each fell back to **5432** when their own variable was unset:     │
 * │                                                                            │
 * │   · `db/control-read-scope.ts`   `RECONCILE_CONTROL_READ_DB_PORT`  → 5432  │
 * │   · `db/control-write-scope.ts`  `RECONCILE_CONTROL_WRITE_DB_PORT` → 5432  │
 * │   · `server/control-plane/config.ts` `RECONCILE_CONTROL_DB_PORT`   → 5432  │
 * │                                                                            │
 * │ while every suite's own admin client said                                 │
 * │ `RECONCILE_CONTROL_DB_PORT ?? RECONCILE_DB_PORT ?? 5432`. So a suite       │
 * │ SEEDED the roster on the private cluster and the plane under test READ it  │
 * │ from the machine's shared one — and *"a private-PostgreSQL gate"* quietly  │
 * │ touched the shared database every other agent on the machine was using.   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 **THE REPAIR IS IN `tests/` AND NOT IN THE PRODUCT'S DEFAULTS, DELIBERATELY.**
 * `RECONCILE_CONTROL_READ_*` is its own prefix so the data plane can never
 * inherit the control plane's credentials by accident (G1162), and a product
 * default that read `RECONCILE_DB_PORT` would be a second, unreviewed join
 * between the two planes' configuration. In a TEST both databases live on one
 * cluster by construction, so the join is true here and nowhere else.
 *
 * Importing this module (for its side effect, FIRST among a suite's imports)
 * fills each unset control port from the nearest configured one —
 * read/write ← control ← data — and then REFUSES, loudly and naming the
 * variables, if the reader or the writer still names a different port from the
 * one the suite's own admin client will use: seeding one cluster and reading
 * another is never what a test means. `tests/ci/test-ports.test.ts` requires
 * every suite that can reach a control database to import it.
 */

const DATA = 'RECONCILE_DB_PORT'
const CONTROL = 'RECONCILE_CONTROL_DB_PORT'
const READ = 'RECONCILE_CONTROL_READ_DB_PORT'
const WRITE = 'RECONCILE_CONTROL_WRITE_DB_PORT'

/** The documented local default — `db/env.ts`'s, so an unconfigured machine still agrees with itself. */
const LOCAL_DEFAULT = '5432'

function set(name: string): string | undefined {
  const v = process.env[name]
  return v === undefined || v === '' ? undefined : v
}

/**
 * Fill the unset control ports from the configured ones and refuse a split.
 * Idempotent; exported so the guard test can drive it against a scratch env.
 */
export function alignControlDbPorts(env: NodeJS.ProcessEnv = process.env): void {
  const read = (n: string): string | undefined => {
    const v = env[n]
    return v === undefined || v === '' ? undefined : v
  }
  const control = read(CONTROL) ?? read(DATA)
  if (control !== undefined && read(CONTROL) === undefined) env[CONTROL] = control
  for (const name of [READ, WRITE]) {
    const own = read(name)
    if (own === undefined) {
      if (control !== undefined) env[name] = control
      continue
    }
    const expected = control ?? LOCAL_DEFAULT
    if (own !== expected) {
      throw new Error(
        `${name}=${own} but the suite's own control-database client uses ${control === undefined ? `the default ${LOCAL_DEFAULT}` : `${read(CONTROL) !== undefined ? CONTROL : DATA}=${expected}`}. ` +
          'A test seeds the control database through one and the plane reads it through the other, so a ' +
          `split sends half the suite to a different cluster. Unset ${name}, or set it to ${expected}.`,
      )
    }
  }
}

/** The port the suite's own admin client should use for the control database. */
export function controlDbPort(): number {
  return Number(set(CONTROL) ?? set(DATA) ?? LOCAL_DEFAULT)
}

alignControlDbPorts()

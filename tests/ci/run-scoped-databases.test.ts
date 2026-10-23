/**
 * TWO GATES, ONE POSTGRESQL — G4151–G4155 (U-23, closing G3914).
 *
 * `tests/run-scoped-db.ts` argues the shape. This suite makes it a gate:
 *
 *  §1  every test file, read from the AST: a `'reconcile_…'` string literal is
 *      never the right-hand side of `??` nor assigned to a `RECONCILE_*` variable.
 *      That is exactly the shape every suite named its database in before this
 *      slice (124 sites in 110 files), so a new suite that copies an old one's
 *      header reddens here rather than on the day two gates meet.
 *  §1a the reader's own anti-vacuity: it FINDS the old shape in a fixture.
 *  §1b every file whose code CALLS `probeDatabase()` imports the helper — a suite
 *      that reaches a database and names none falls back to `db/env.ts`'s shared
 *      `reconcile_test`, which is how two suites in ONE gate came to share a
 *      database (`tenant-isolation` and `engine-raises-exceptions`, G4152).
 *  §2  the property, in processes: siblings under one parent agree, two parents
 *      differ, an inherited tag is honoured, a malformed one is refused, and an
 *      over-long name is refused rather than truncated by PostgreSQL.
 *  §3  the role spelling passes the rotation Lambda's own guard and round-trips.
 *  §4  cleanup against a live PostgreSQL: the dead-run sweep drops a dead
 *      runner's database and a dead runner's role, and keeps a LIVE runner's
 *      and ANOTHER HOST's; layer 1 drops what this process minted.
 *
 * ⚠️ A LANDMARK, AND IT SAYS SO (§5.1): a name built by concatenation, or read
 * through a helper, is not seen by §1. §2 and §4 witness the property itself.
 */

import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import { databaseRequiredUnderCi } from '../reachability.ts'
import {
  TEST_RUN_ENV,
  dropMinted,
  hostTag,
  parseRunScoped,
  pidAlive,
  runScopedName,
  runScopedRoleName,
  sweepDeadRuns,
  testRunTag,
} from '../run-scoped-db.ts'
import { probeDatabase, describeTarget, adminUser, dbSsl, dbTarget, MAINTENANCE_DATABASE } from '../../db/env.ts'
import { loadPg } from '../../db/pg.ts'

const probe = await probeDatabase()

/* The rotation Lambda's guard, read at runtime — `.mjs` with no declaration. */
const { ROLE_NAME_PATTERN } = (await import(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'infra', 'lambda', 'role-secret-rotation', 'guards.mjs')
)) as { ROLE_NAME_PATTERN: RegExp }

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TESTS = join(REPO, 'tests')
const HELPER = join(TESTS, 'run-scoped-db.ts')

function testFiles(dir: string = TESTS, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'fixtures') continue
      testFiles(p, out)
    } else if (/\.(ts|mjs)$/.test(name) && p !== HELPER) out.push(p)
  }
  return out
}

function parse(file: string, src: string): ts.SourceFile {
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS)
}

const isNameLiteral = (n: ts.Node): boolean =>
  (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && /^reconcile_[a-z0-9_]+$/.test(n.text)

/** `process.env['RECONCILE_…']` / `process.env.RECONCILE_…` */
function isReconcileEnv(n: ts.Node): boolean {
  if (ts.isElementAccessExpression(n)) {
    const a = n.argumentExpression
    return ts.isStringLiteral(a) && a.text.startsWith('RECONCILE_') && n.expression.getText() === 'process.env'
  }
  if (ts.isPropertyAccessExpression(n)) {
    return n.name.text.startsWith('RECONCILE_') && n.expression.getText() === 'process.env'
  }
  return false
}

/** The offences in one source: `?? 'reconcile_x'` and `process.env['RECONCILE_…'] = 'reconcile_x'`. */
export function fixedNameSites(file: string, src: string): string[] {
  const sf = parse(file, src)
  const found: string[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind
      const nullish = op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.QuestionQuestionEqualsToken
      const assign = op === ts.SyntaxKind.EqualsToken && isReconcileEnv(n.left)
      if ((nullish || assign) && isNameLiteral(n.right)) {
        const { line } = sf.getLineAndCharacterOfPosition(n.right.getStart(sf))
        found.push(`${line + 1}: ${n.right.getText(sf)}`)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

function callsProbeDatabase(file: string, src: string): boolean {
  const sf = parse(file, src)
  let hit = false
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'probeDatabase') hit = true
    if (!hit) ts.forEachChild(n, visit)
  }
  visit(sf)
  return hit
}

/**
 * Files that call `probeDatabase()` and name no database, each argued.
 * `reachability-guards` probes in SUBPROCESSES pointed at a closed port and
 * never provisions anything; its in-process call is the guard under test.
 */
const PROBES_WITHOUT_A_DATABASE: ReadonlyMap<string, string> = new Map([
  ['tests/ci/reachability-guards.test.ts', 'drives the guards against an unreachable port; provisions nothing'],
])

describe('§1 · no suite names its database with a literal', () => {
  const files = testFiles()

  it('§1 · the AST finds no `?? \'reconcile_…\'` and no `RECONCILE_* = \'reconcile_…\'`', () => {
    assert.ok(files.length > 100, `walked ${files.length} files; the walk is broken`)
    const offences = files.flatMap((f) =>
      fixedNameSites(f, readFileSync(f, 'utf8')).map((s) => `${relative(REPO, f)}:${s}`),
    )
    assert.deepEqual(
      offences,
      [],
      'these suites name a database by a literal, so two gates on one PostgreSQL meet on it ' +
        "and one run's reset drops the other's schema (G3914). Use runScopedName() from tests/run-scoped-db.ts.",
    )
  })

  it('§1a · the reader finds the shape it refuses (anti-vacuity)', () => {
    const src = [
      "const A = process.env['RECONCILE_X_DB_NAME'] ?? 'reconcile_x_test'",
      "process.env['RECONCILE_DB_NAME'] = 'reconcile_y_test'",
      "process.env.RECONCILE_DB_NAME = 'reconcile_z_test'",
      "process.env['RECONCILE_W_DB_NAME'] ??= 'reconcile_w_test'",
      "const B = process.env['RECONCILE_X_DB_NAME'] ?? runScopedName('reconcile_x_test')",
      "const role = 'reconcile_app'",
    ].join('\n')
    assert.deepEqual(fixedNameSites('fixture.ts', src), [
      "1: 'reconcile_x_test'",
      "2: 'reconcile_y_test'",
      "3: 'reconcile_z_test'",
      "4: 'reconcile_w_test'",
    ])
  })

  it('§1b · every suite that calls probeDatabase() imports the run-scoped helper', () => {
    const dependent = files.filter((f) => callsProbeDatabase(f, readFileSync(f, 'utf8')))
    assert.ok(dependent.length > 80, `${dependent.length} files call probeDatabase(); the reader is broken`)
    const bare = dependent
      .map((f) => relative(REPO, f))
      .filter((rel) => !PROBES_WITHOUT_A_DATABASE.has(rel))
      .filter((rel) => !/from '(\.\.\/|\.\/)+run-scoped-db\.ts'/.test(readFileSync(join(REPO, rel), 'utf8')))
    assert.deepEqual(
      bare,
      [],
      'these suites reach a database and name none, so they fall back to db/env.ts\'s shared `reconcile_test` (G4152)',
    )
  })
})

/** Run `script` as an ES module in a fresh node, with env sanitised. */
function nodeEval(script: string, env: NodeJS.ProcessEnv): string {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: REPO,
    env,
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error(`child failed: ${r.stderr}`)
  return r.stdout.trim()
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env[TEST_RUN_ENV]
  delete env['NODE_TEST_CONTEXT']
  return env
}

const MINT = `import { runScopedName } from './tests/run-scoped-db.ts'; console.log(runScopedName('reconcile_probe_test'))`

describe('§2 · one name per run, another per run', () => {
  it('§2a · two siblings under ONE parent agree; the name carries this host and that parent', () => {
    const env = cleanEnv()
    const a = nodeEval(MINT, env)
    const b = nodeEval(MINT, env)
    assert.equal(a, b)
    assert.equal(a, `reconcile_probe_test__t${hostTag()}p${process.pid}`)
  })

  it('§2b · two PARENTS — two gates — get two names', () => {
    const viaParent = `import { spawnSync } from 'node:child_process'
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', ${JSON.stringify(MINT)}], { encoding: 'utf8' })
      process.stdout.write(r.stdout)`
    const env = cleanEnv()
    const one = nodeEval(viaParent, env)
    const two = nodeEval(viaParent, env)
    assert.match(one, /^reconcile_probe_test__t[0-9a-f]{4}p[0-9]+$/)
    assert.notEqual(one, two)
  })

  it('§2c · an inherited tag is honoured, so a process a suite spawns agrees with the suite', () => {
    const env = { ...cleanEnv(), [TEST_RUN_ENV]: 't0abcp42' }
    assert.equal(nodeEval(MINT, env), 'reconcile_probe_test__t0abcp42')
  })

  it('§2d · a malformed inherited tag is refused rather than spliced into an identifier', () => {
    assert.throws(() => testRunTag({ [TEST_RUN_ENV]: "x'; DROP DATABASE postgres; --" }), /is not a run tag/)
  })

  it('§2e · a name PostgreSQL would truncate is refused, and so is a base that is not an identifier', () => {
    assert.throws(() => runScopedName(`reconcile_${'x'.repeat(50)}`), /truncates past 63/)
    assert.throws(() => runScopedName('Reconcile_Upper'), /not a plain lower-case identifier/)
    assert.throws(() => runScopedName('reconcile__double'), /not a plain lower-case identifier/)
  })
})

describe('§3 · the role spelling', () => {
  it("§3 · passes the rotation Lambda's own ROLE_NAME_PATTERN and parses back to this run", () => {
    const role = runScopedRoleName('reconcile_rotation_nologin')
    assert.match(role, ROLE_NAME_PATTERN)
    const parsed = parseRunScoped(role)
    const tag = /^t([0-9a-f]{4})p([0-9]+)$/.exec(testRunTag())
    assert.ok(tag !== null && parsed !== null)
    assert.deepEqual(parsed, { base: 'reconcile_rotation_nologin', host: tag[1], pid: Number(tag[2]) })
  })
})

databaseRequiredUnderCi('the run-scoped cleanup assertions', probe)
const skip: false | string = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

async function asAdmin<T>(fn: (q: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>): Promise<T> {
  const { Client } = await loadPg()
  const { host, port } = dbTarget()
  const c = new Client({
    host,
    port,
    ssl: dbSsl(host),
    database: MAINTENANCE_DATABASE,
    user: adminUser(),
  })
  await c.connect()
  try {
    return await fn((sql) => c.query(sql))
  } finally {
    await c.end()
  }
}

const exists = (name: string): Promise<boolean> =>
  asAdmin(async (q) => (await q(`SELECT 1 FROM pg_database WHERE datname = '${name}'`)).rows.length === 1)
const roleExists = (name: string): Promise<boolean> =>
  asAdmin(async (q) => (await q(`SELECT 1 FROM pg_roles WHERE rolname = '${name}'`)).rows.length === 1)

/** A PID that is certainly dead: a child we started and waited for. */
function deadPid(): number {
  const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' })
  const pid = Number(r.stdout)
  assert.ok(Number.isInteger(pid) && !pidAlive(pid), 'could not obtain a dead pid')
  return pid
}

describe('§4 · cleanup against a live PostgreSQL', { skip }, () => {
  it('§4a · the sweep drops a dead runner\'s database and role, keeps a live runner\'s and another host\'s', async () => {
    const here = hostTag()
    const elsewhere = here === 'ffff' ? 'eeee' : 'ffff'
    const dead = deadPid()
    const deadDb = `reconcile_sweep_probe_test__t${here}p${dead}`
    const liveDb = `reconcile_sweep_probe_test__t${here}p${process.pid}`
    const foreignDb = `reconcile_sweep_probe_test__t${elsewhere}p${dead}`
    const letters = (d: string): string => [...d].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')
    const deadRole = `reconcile_sweep_probe__t${letters(here)}p${letters(String(dead))}`
    try {
      await asAdmin(async (q) => {
        for (const db of [deadDb, liveDb, foreignDb]) {
          await q(`DROP DATABASE IF EXISTS ${db}`)
          await q(`CREATE DATABASE ${db}`)
        }
        await q(`DROP ROLE IF EXISTS ${deadRole}`)
        await q(`CREATE ROLE ${deadRole} NOLOGIN`)
      })
      /* The STATE is asserted, never this call's report of it: every other
         test process in this gate and in a concurrent one sweeps dead runs in
         its own `after`, and one of them may take these two first — measured
         on the first two-gate run, where `dropped.includes(deadDb)` went red
         while the database was gone. Blocking, so this call waits out theirs. */
      await sweepDeadRuns(pidAlive, { blocking: true })
      assert.equal(await exists(deadDb), false, 'a dead runner\'s database survived the sweep')
      assert.equal(await roleExists(deadRole), false, 'a dead runner\'s role survived the sweep')
      assert.equal(await exists(liveDb), true, 'the sweep dropped a LIVE runner\'s database')
      assert.equal(await exists(foreignDb), true, 'the sweep dropped another HOST\'s database')
    } finally {
      await asAdmin(async (q) => {
        for (const db of [deadDb, liveDb, foreignDb]) await q(`DROP DATABASE IF EXISTS ${db}`)
        await q(`DROP ROLE IF EXISTS ${deadRole}`)
      })
    }
  })

  it('§4b · layer 1 drops what this process minted', async () => {
    const name = runScopedName('reconcile_minted_probe_test')
    await asAdmin(async (q) => {
      await q(`DROP DATABASE IF EXISTS ${name}`)
      await q(`CREATE DATABASE ${name}`)
    })
    assert.equal(await exists(name), true)
    await dropMinted()
    assert.equal(await exists(name), false, 'dropMinted() left a minted database behind')
  })
})

test('§5 · a skip here is loud', () => {
  if (skip !== false) console.error(`🛑 tests/ci/run-scoped-databases.test.ts §4 DID NOT RUN: ${skip}`)
})

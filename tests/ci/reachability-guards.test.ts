/**
 * THE GUARDS THAT TURN A SILENT SKIP INTO A RED X, AND THE CONTROLS THAT SHOW
 * THEY ARE NOT DECORATIVE.
 *
 * 🛑 WHAT THIS IS DEFENDING. `.github/workflows/check.yml` runs on
 * `[self-hosted, reconcile]`, which has neither a PostgreSQL nor a browser
 * binary. Every database-dependent suite and every render suite therefore
 * stands down there, and the workflow reports SUCCESS. That is not a
 * hypothetical: PR #257 merged a RED trunk on it, and run 31961439743 was
 * reported `success` with seven test databases unreachable and no chromium.
 * `tests/reachability.ts` carries the argument in full.
 *
 * TWO KINDS OF ASSERTION BELOW, AND THE FIRST KIND IS THE ONE THAT MATTERS:
 *
 *   1. BEHAVIOURAL. Each guard is spawned over a failed probe WITH `CI` set and
 *      WITHOUT it, and both outcomes are demanded — exit 1 with the message,
 *      and exit 0. A guard witnessed only where it passes proves nothing;
 *      `docs/HANDOFF.md` §5.6 is the shape, and a guard whose whole purpose is
 *      to catch silent passes is the worst possible place to repeat it.
 *
 *   2. STRUCTURAL. Every suite that depends on a database or a browser must
 *      CALL its guard, and must call it OUTSIDE every `describe`. A guard
 *      inside a skipped suite is never registered — it cannot fail, and that is
 *      the exact failure it exists to prevent, one level up. This is the check
 *      that survives the next suite somebody adds.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TESTS = join(REPO_ROOT, 'tests')

const DB_FIXTURE = join(
  TESTS, 'ci', 'fixtures', 'reachability', 'db-guard.fixture.ts',
)
const BROWSER_FIXTURE = join(
  TESTS, 'ci', 'fixtures', 'reachability', 'browser-guard.fixture.ts',
)

interface Run {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

/**
 * `node --test <fixture>` in a child process, with the environment stated in
 * full. Exit codes are read from `spawnSync`, never from a pipe — a piped
 * status is the pipe's, which is 0, and reads exactly like success.
 */
function runFixture(fixture: string, ci: boolean): Run {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    // The child must not inherit an ambient CI from the machine running this
    // file, or the "without CI" half of every pair below is a coin toss.
    // NODE_TEST_CONTEXT makes a nested `node --test` refuse to run files at
    // all — "run() is being called recursively" — and the child would then
    // report a vacuous success.
    if (k === 'CI' || k === 'NODE_TEST_CONTEXT' || v === undefined) continue
    env[k] = v
  }
  if (ci) env['CI'] = '1'
  const result = spawnSync(process.execPath, ['--test', fixture], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env,
  })
  return {
    // null means killed by a signal; coercing that to 0 would report a crash
    // as a pass.
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

// ------------------------------------------- 1. the database guard, both ways

test('test_the_database_guard_fails_the_run_under_ci_when_the_probe_did_not_reach_a_database', () => {
  const run = runFixture(DB_FIXTURE, true)
  assert.equal(
    run.status,
    1,
    `a failed probe under CI must be a failing run; got exit ${run.status}\n` +
      `${run.stdout}${run.stderr}`,
  )
  assert.ok(
    run.stdout.includes('DID NOT RUN, UNDER CI'),
    `the failure must say what did not run; stdout was:\n${run.stdout}`,
  )
  assert.ok(
    run.stdout.includes('the fixture supplies a probe that failed'),
    'the failure must carry the probe\'s own reason rather than restating it; ' +
      `stdout was:\n${run.stdout}`,
  )
})

test('test_the_database_guard_leaves_a_developer_without_postgres_green_when_ci_is_unset', () => {
  const run = runFixture(DB_FIXTURE, false)
  assert.equal(
    run.status,
    0,
    'the same failed probe with no CI must stay green — a contributor with no ' +
      `PostgreSQL must still get a runnable suite; got exit ${run.status}\n` +
      `${run.stdout}${run.stderr}`,
  )
})

// -------------------------------------------- 2. the browser guard, both ways

test('test_the_browser_guard_fails_the_run_under_ci_when_no_page_can_be_rendered', () => {
  const run = runFixture(BROWSER_FIXTURE, true)
  assert.equal(
    run.status,
    1,
    `an absent browser under CI must be a failing run; got exit ${run.status}\n` +
      `${run.stdout}${run.stderr}`,
  )
  assert.ok(
    run.stdout.includes('DID NOT RUN, UNDER CI'),
    `the failure must say what did not run; stdout was:\n${run.stdout}`,
  )
  assert.ok(
    run.stdout.includes('COMPUTED STYLE'),
    'the failure must say why a DOM shim is not a substitute; stdout was:\n' +
      run.stdout,
  )
})

test('test_the_browser_guard_leaves_a_developer_without_chromium_green_when_ci_is_unset', () => {
  const run = runFixture(BROWSER_FIXTURE, false)
  assert.equal(
    run.status,
    0,
    'the same absent browser with no CI must stay green; got exit ' +
      `${run.status}\n${run.stdout}${run.stderr}`,
  )
})

// ---------------------------------- 3. every dependent suite calls its guard

/** Every `*.test.ts` / `*.test.mjs` under `tests/`, recursively. */
function testFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...testFiles(full))
    } else if (/\.test\.(ts|mjs)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Does `source` call `name` at the top level — outside every `describe`, every
 * `it` and every function?
 *
 * A textual search would answer a different question: a call INSIDE a skipped
 * suite is never registered, so it can never fail, which is the defect this
 * whole file is about arriving one level down. So the position is read from the
 * AST rather than from an indentation convention.
 */
function callsAtTopLevel(source: string, file: string, name: string): boolean {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  )
  let found = false
  const visit = (node: ts.Node, inFunction: boolean): void => {
    if (
      !inFunction &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name
    ) {
      found = true
    }
    const nowInFunction =
      inFunction ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node)
    ts.forEachChild(node, (child) => visit(child, nowInFunction))
  }
  ts.forEachChild(parsed, (child) => visit(child, false))
  return found
}

/**
 * Does `source` register an `after(…)` hook AT THE TOP LEVEL whose body calls
 * `name`?
 *
 * 🛑 THIS EXISTS BECAUSE THE RULE ABOVE WAS KEYED ON HALF THE PROPERTY, AND THE
 * OTHER HALF COST A GATE THAT COULD NOT FAIL — §5.1, inside the file written
 * against §5.1. `callsAtTopLevel` answers "is this GUARD registered", and the
 * guard was only ever half the reason placement matters: a `describe(…, {skip})`
 * never invokes its callback, so an `after` inside one registers NO TEARDOWN
 * EITHER, and a handle acquired at module scope is then never released.
 *
 * MEASURED on `tests/e2e/browser-login.test.ts` at 248e3e85, 21 Sep 2026:
 * `browserSkip()` LAUNCHES chromium to decide whether one can render, and that
 * file's only `after` sat inside its suite. With a browser and no database,
 * `RECONCILE_DB_PORT=1 node --test tests/e2e/browser-login.test.ts` printed its
 * three correct lines and then **never exited** — killed at 90s against the
 * same run taking 2s once the hook was hoisted, identical output in both.
 *
 * 🛑 AND THE REASON THAT IS THE SEVEREST SHAPE IN THIS DIRECTORY RATHER THAN A
 * SLOW SUITE: `tools/skip-census.mjs` sets its exit code on `test:summary`, and
 * a run that never terminates never emits one. So the census never prints, the
 * guards' verdicts never reach a terminating summary, and CI reports a BUILD
 * TIMEOUT — which reads as infrastructure flake and gets retried. That is PR
 * #257's merge-button problem wearing a new hat.
 *
 * The position is read from the AST for `callsAtTopLevel`'s own reason: a
 * textual search cannot tell a hook inside a suite from one outside it.
 */
function tearsDownAtTopLevel(source: string, file: string, name: string): boolean {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  )
  /* Inside a hook we WANT the nested call — the body is an arrow by
     construction — so this walk deliberately does not track `inFunction`. */
  const subtreeCalls = (root: ts.Node): boolean => {
    let hit = false
    const walk = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name) {
        hit = true
      }
      ts.forEachChild(n, walk)
    }
    ts.forEachChild(root, walk)
    return hit
  }
  let found = false
  const visit = (node: ts.Node, inFunction: boolean): void => {
    if (
      !inFunction &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'after' &&
      subtreeCalls(node)
    ) {
      found = true
    }
    const nowInFunction =
      inFunction ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node)
    ts.forEachChild(node, (child) => visit(child, nowInFunction))
  }
  ts.forEachChild(parsed, (child) => visit(child, false))
  return found
}

/**
 * ⚠️ THIS FILE IS EXCLUDED FROM ITS OWN SCAN, AND THAT IS NOT A CONVENIENCE.
 * It names `probeDatabase` and `browserSkip(` in the very filters below, so a
 * scan including itself reports itself missing a guard it has no reason to
 * hold — a checker whose first finding is the checker.
 */
const SELF = fileURLToPath(import.meta.url)

const files = testFiles(TESTS)
  .filter((file) => file !== SELF)
  .map((file) => ({
    path: file,
    rel: relative(REPO_ROOT, file),
    source: readFileSync(file, 'utf8'),
  }))

test('test_every_test_file_that_probes_for_a_database_calls_the_ci_guard_at_the_top_level', () => {
  const dependent = files.filter((f) => f.source.includes('probeDatabase'))
  /* ⚠️ THE FLOOR WAS `>= 9` AGAINST A TREE OF 57 UNTIL 21 Sep 2026, which is an
     anti-vacuity floor rather than a drift guard: refactor `probeDatabase`
     behind a helper and 48 files could leave this scan in silence. It is now
     near the measured count, so a landmark that stops matching is RED. */
  assert.ok(
    dependent.length >= 50,
    'this assertion is worthless if it found nothing to check; the tree had ' +
      `${dependent.length} database-dependent test files`,
  )
  const missing = dependent
    .filter((f) => !callsAtTopLevel(f.source, f.path, 'databaseRequiredUnderCi'))
    .map((f) => f.rel)
  assert.deepEqual(
    missing,
    [],
    'these files probe for a database and stand down without one, but never ' +
      'call `databaseRequiredUnderCi(…)` outside their suites — so under CI ' +
      'they skip and the gate stays green',
  )
})

test('test_every_test_file_that_probes_for_a_browser_calls_the_ci_guard_at_the_top_level', () => {
  const dependent = files.filter((f) => f.source.includes('browserSkip('))
  /* ⚠️ `>= 3` against a measured 8 until 21 Sep 2026 — see the note one test up. */
  assert.ok(
    dependent.length >= 8,
    'this assertion is worthless if it found nothing to check; the tree had ' +
      `${dependent.length} browser-dependent test files`,
  )
  const missing = dependent
    .filter((f) => !callsAtTopLevel(f.source, f.path, 'browserRequiredUnderCi'))
    .map((f) => f.rel)
  assert.deepEqual(
    missing,
    [],
    'these files need a browser and stand down without one, but never call ' +
      '`browserRequiredUnderCi(…)` outside their suites',
  )
})

/**
 * The control for the two assertions above: the AST reader must be able to tell
 * a top-level call from one inside a suite, or both would pass on a tree where
 * every guard had been quietly moved inside a `describe`.
 */
test('test_the_top_level_reader_rejects_a_guard_that_sits_inside_a_describe', () => {
  const inside = [
    "describe('x', () => {",
    '  databaseRequiredUnderCi("y", probe)',
    '})',
  ].join('\n')
  assert.equal(
    callsAtTopLevel(inside, 'probe.ts', 'databaseRequiredUnderCi'),
    false,
    'a guard inside a suite callback is never registered when that suite skips',
  )
  assert.equal(
    callsAtTopLevel('databaseRequiredUnderCi("y", probe)\n', 'probe.ts', 'databaseRequiredUnderCi'),
    true,
    'and a guard at the top level must still be found',
  )
})

test('test_every_test_file_that_launches_the_shared_browser_closes_it_at_the_top_level', () => {
  const dependent = files.filter((f) => f.source.includes('browserSkip('))
  assert.ok(
    dependent.length >= 8,
    'this assertion is worthless if it found nothing to check; the tree had ' +
      `${dependent.length} browser-dependent test files`,
  )
  const missing = dependent
    .filter((f) => !tearsDownAtTopLevel(f.source, f.path, 'closeBrowser'))
    .map((f) => f.rel)
  assert.deepEqual(
    missing,
    [],
    'these files call `browserSkip()`, WHICH LAUNCHES CHROMIUM, but register ' +
      '`closeBrowser()` only inside a suite. When that suite stands down the ' +
      'callback is never invoked, the teardown is never registered, and the ' +
      'live handle holds the event loop open: `npm test` does not fail, it ' +
      'NEVER TERMINATES, so `tools/skip-census.mjs` never sees `test:summary` ' +
      'and CI reports a build timeout instead of a red. Hoist the hook to the ' +
      'top level — `tests/design/shell.test.ts` is the canonical form.',
  )
})

/**
 * The control for the assertion above, and it is the shape that actually
 * shipped: an `after` inside a `describe` is what `browser-login.test.ts` had.
 */
test('test_the_teardown_reader_rejects_a_close_that_sits_inside_a_describe', () => {
  const inside = [
    "describe('x', { skip }, () => {",
    '  after(async () => { await closeBrowser() })',
    '})',
  ].join('\n')
  assert.equal(
    tearsDownAtTopLevel(inside, 'probe.ts', 'closeBrowser'),
    false,
    'a teardown inside a suite callback is never registered when that suite skips',
  )
  assert.equal(
    tearsDownAtTopLevel('after(async () => { await closeBrowser() })\n', 'probe.ts', 'closeBrowser'),
    true,
    'and a teardown at the top level must still be found',
  )
  /* An `after` that closes something ELSE must not satisfy the rule — otherwise
     the file that keeps a top-level `after(() => pool.end())` and leaves the
     browser inside a suite reads as compliant. */
  assert.equal(
    tearsDownAtTopLevel('after(async () => { await pool.end() })\n', 'probe.ts', 'closeBrowser'),
    false,
    'a top-level `after` that never calls `closeBrowser` does not close a browser',
  )
})

// ------------------------- 4. there is ONE statement of "is a browser present"

test('test_the_browser_guard_consumes_browserskips_verdict_rather_than_asking_its_own_question', () => {
  const reachability = readFileSync(join(TESTS, 'reachability.ts'), 'utf8')
  // Prose about playwright is fine; REACHING for it is the thing that would
  // make this a second probe. So the check is on the import and the launch,
  // not on the word.
  for (const forbidden of [
    "from 'playwright'",
    "import('playwright')",
    'chromium.launch',
    'executablePath',
  ]) {
    assert.equal(
      reachability.includes(forbidden),
      false,
      `tests/reachability.ts contains ${JSON.stringify(forbidden)}: the guard ` +
        "must take `browserSkip()`'s verdict, not re-derive it. Two probes can " +
        'disagree, and the disagreement would read as a flake rather than as ' +
        'the two answers it is.',
    )
  }
  const render = readFileSync(join(TESTS, 'design', 'render.ts'), 'utf8')
  assert.ok(
    render.includes('export async function browserSkip'),
    'the one statement of browser presence lives in tests/design/render.ts',
  )
})

// ------------- 5. the database probe runs BEFORE any suite is registered — G4061

/**
 * The calls that REGISTER a top-level test — node's four, plus the two guards in
 * `tests/reachability.ts`, each of which registers an `it`.
 */
const REGISTERS = new Set([
  'describe',
  'it',
  'test',
  'suite',
  'databaseRequiredUnderCi',
  'browserRequiredUnderCi',
])

/**
 * Where, among `source`'s top-level statements, the database probe is awaited
 * and the first test is registered — `null` for either that is absent.
 *
 * 🛑 THE ORDER IS THE PROPERTY, AND IT IS WHAT FLAKED
 * `tests/http/authorisation-record.test.ts` IN THE FULL GATE (G4061; G3915
 * recorded the symptom). `node --test` begins running a registered top-level
 * suite as soon as the module yields, and a top-level `await` is a yield — so
 * a probe awaited AFTER a registration shares `db/env.ts`'s 2 s connect budget
 * with that suite's work. Measured on an idle private PostgreSQL 14: that
 * file's probe connected in 230–600 ms with its §1–§3 above it and in 4–8 ms
 * with the probe hoisted; under two concurrent gates it reached 2,016 ms while
 * every other probing suite stayed ≤ 215 ms; at G3915's load it answered
 * `timeout expired`, which `databaseRequiredUnderCi()` then turned RED. The
 * probe's verdict must be about PostgreSQL, not about the file that asked.
 */
function probeAndFirstRegistration(
  source: string,
  file: string,
): { readonly probe: number | null; readonly registration: number | null } {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  )
  /** Does `root` contain, outside every function, a call `match` accepts? */
  const callsOutsideFunctions = (
    root: ts.Node,
    match: (name: string) => boolean,
  ): boolean => {
    let hit = false
    const walk = (n: ts.Node): void => {
      if (hit) return
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && match(n.expression.text)) {
        hit = true
        return
      }
      if (
        ts.isArrowFunction(n) ||
        ts.isFunctionExpression(n) ||
        ts.isFunctionDeclaration(n) ||
        ts.isMethodDeclaration(n)
      ) {
        return
      }
      ts.forEachChild(n, walk)
    }
    walk(root)
    return hit
  }
  let probe: number | null = null
  let registration: number | null = null
  parsed.statements.forEach((stmt, i) => {
    if (probe === null && callsOutsideFunctions(stmt, (x) => x === 'probeDatabase')) probe = i
    if (
      registration === null &&
      ts.isExpressionStatement(stmt) &&
      callsOutsideFunctions(stmt, (x) => REGISTERS.has(x))
    ) {
      registration = i
    }
  })
  return { probe, registration }
}

test('test_every_database_probe_is_awaited_before_the_first_test_is_registered', () => {
  const dependent = files.filter((f) => f.source.includes('probeDatabase()'))
  assert.ok(
    dependent.length >= 50,
    'this assertion is worthless if it found nothing to check; the tree had ' +
      `${dependent.length} files calling probeDatabase()`,
  )
  const late = dependent
    .map((f) => ({ f, at: probeAndFirstRegistration(f.source, f.path) }))
    .filter(
      ({ at }) =>
        at.probe === null || (at.registration !== null && at.registration < at.probe),
    )
    .map(({ f, at }) =>
      at.probe === null
        ? `${f.rel} (no top-level probeDatabase() call)`
        : `${f.rel} (probe at top-level statement ${at.probe}, first registration at ${at.registration})`,
    )
  assert.deepEqual(
    late,
    [],
    'these files await probeDatabase() AFTER registering a top-level test, so node ' +
      "runs that suite inside the probe's 2 s connect budget and a busy file reads " +
      'as "no PostgreSQL" — G4061. Take the probe before the first describe/it/test.',
  )
})

test('test_the_order_reader_rejects_a_probe_awaited_after_a_describe', () => {
  const late = probeAndFirstRegistration(
    ["describe('x', () => {})", 'const probe = await probeDatabase()', ''].join('\n'),
    'late.ts',
  )
  assert.ok(
    late.probe !== null && late.registration !== null && late.registration < late.probe,
    `a probe after a describe must be read as late; got ${JSON.stringify(late)}`,
  )
  const early = probeAndFirstRegistration(
    ['const probe = await probeDatabase()', "describe('x', () => {})", ''].join('\n'),
    'early.ts',
  )
  assert.ok(
    early.probe === 0 && early.registration === 1,
    `and a probe before it must be read as early; got ${JSON.stringify(early)}`,
  )
  const nested = probeAndFirstRegistration(
    [
      "describe('x', () => { it('y', () => {}) })",
      'async function f() { await probeDatabase() }',
      '',
    ].join('\n'),
    'nested.ts',
  )
  assert.equal(nested.probe, null, 'a probe inside a function is not a top-level probe')
})

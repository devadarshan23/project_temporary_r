/**
 * THE CENSUS THAT SAYS HOW MUCH `skipped N` UNDERSTATES, AND THE PAIR OF
 * FIXTURES THAT MAKES ITS NUMBER A MEASUREMENT.
 *
 * 🛑 THE PROBLEM, IN ONE LINE. `describe(name, { skip }, fn)` never invokes
 * `fn`, so its children are never created — and a test that was never created
 * is not counted as skipped. On this tree, pointing the database at a dead port
 * and the browser path at an empty directory moved `tests` by 89 and `skipped`
 * by 4. `tools/skip-census.mjs` carries the full measurement.
 *
 * 🛑 WHY THERE ARE TWO FIXTURES AND NOT ONE, AND IT IS THE WHOLE POINT OF THIS
 * FILE. `skipped-suite.fixture.mjs` and `unskipped-suite.fixture.mjs` are the
 * same source with one `{ skip }` removed. The unskipped one is run FIRST, and
 * node itself reports how many assertions that suite contains. The census is
 * then held against THAT number rather than against a constant typed into this
 * file — which is the difference between witnessing a count and agreeing with
 * one. §5.6: a control that passes while asserting nothing is the defect this
 * repository catalogues, and a census of dishonest counters is the last place
 * it should appear.
 *
 * ⚠️ THE LEXICAL COUNT IS A FLOOR AND THE FIXTURE IS BUILT TO PROVE IT. Two of
 * the five assertions are created by a `for…of`, which is ONE call expression.
 * The census marks that suite `≥` and reports 4 where the truth is 5. Asserting
 * the floor AND the mark is what stops the `≥` from being decoration.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { censusText } from '../../tools/skip-census.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REPORTER = join(REPO_ROOT, 'tools', 'skip-census.mjs')
const FIXTURES = join(REPO_ROOT, 'tests', 'tools', 'fixtures', 'skip-census')

const SKIPPED = join(FIXTURES, 'skipped-suite.fixture.mjs')
const UNSKIPPED = join(FIXTURES, 'unskipped-suite.fixture.mjs')

interface Run {
  readonly status: number
  readonly out: string
}

/**
 * 🛑 `ci` IS AN EXPLICIT ARGUMENT AND NOT AN INHERITANCE, SINCE G997.
 *
 * The census now sets `process.exitCode = 1` under `CI` when a suite stands
 * down, so a child that merely INHERITED this run's environment would answer a
 * different question depending on where it ran — green on a laptop, red in
 * CodeBuild, from the same assertion. **Every call below states which world it
 * is asking about**, which is also what makes the RED and the GREEN a pair
 * rather than two runs that happened to disagree.
 */
function runTests(fixture: string, withCensus: boolean, ci: boolean = false): Run {
  const args = ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout']
  if (withCensus) {
    args.push(`--test-reporter=${REPORTER}`, '--test-reporter-destination=stdout')
  }
  args.push(fixture)
  // NODE_TEST_CONTEXT is inherited from the runner running THIS file, and a
  // nested `node --test` that sees it refuses to run any file — "run() is being
  // called recursively" — and exits 0 having asserted nothing.
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'NODE_TEST_CONTEXT' || k === 'CI' || v === undefined) continue
    env[k] = v
  }
  if (ci) env['CI'] = '1'
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env,
  })
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

/** `ℹ tests 7` → 7. Reads the runner's own summary, never a derived one. */
function counter(out: string, name: string): number {
  const match = new RegExp(`^\\u2139 ${name} (\\d+)$`, 'm').exec(out)
  assert.ok(match !== null, `no '${name}' counter in:\n${out}`)
  return Number(match[1])
}

// ------------------- 1. the runner's counter genuinely understates the run

test('test_node_reports_skipped_1_about_a_run_in_which_six_assertions_did_not_execute', () => {
  const unskipped = runTests(UNSKIPPED, false)
  const skipped = runTests(SKIPPED, false)

  const registeredWhenRun = counter(unskipped.out, 'tests')
  const registeredWhenSkipped = counter(skipped.out, 'tests')

  assert.equal(
    registeredWhenRun,
    7,
    'the control fixture is built to contain 5 suite assertions plus 2 loose ' +
      'ones; if this moved, the numbers below are about a different fixture',
  )
  assert.equal(
    registeredWhenSkipped,
    2,
    'with the suite skipped, only the two loose tests are ever registered',
  )
  assert.equal(
    counter(skipped.out, 'skipped'),
    1,
    'and node calls exactly ONE of them skipped — the loose `it` that carried ' +
      '`{ skip }` itself. The five inside the suite are not counted at all.',
  )
  assert.equal(
    registeredWhenRun - registeredWhenSkipped,
    5,
    'five assertions stopped existing, and the counter moved by nothing for ' +
      'four of them — this subtraction is the defect the census measures',
  )
})

// --------------------------------- 2. the census reports a floor, and says so

test('test_the_census_reports_the_hidden_assertions_the_runner_omitted', () => {
  const run = runTests(SKIPPED, true)
  /* ⚠️ OFF `CI`, AND THAT IS NOW AN EXPLICIT HALF OF THE ASSERTION RATHER THAN
     AN ACCIDENT OF THE ENVIRONMENT. Until G997 this ran with whatever `CI` the
     parent held, and the sentence it asserts — "the census must not change the
     exit code" — was believed to be true everywhere. It is true off CI only.
     See §2a, which is the other half. */
  assert.equal(run.status, 0, `off CI the census must not change the exit code:\n${run.out}`)
  assert.ok(run.out.includes('SKIP CENSUS'), `no census in:\n${run.out}`)
  assert.ok(
    /1 suite stood down, taking at least 4 assertions with it/.test(run.out),
    `the census must report the hidden count as a floor; output:\n${run.out}`,
  )
  assert.ok(
    /DID NOT EXECUTE, IN TOTAL: ≥5\b/.test(run.out),
    'the total must add the hidden assertions to the ones node did count; ' +
      `output:\n${run.out}`,
  )
  assert.ok(
    run.out.includes('skipped-suite.fixture.mjs › a suite that stands down'),
    `the census must name the suite that stood down; output:\n${run.out}`,
  )
  assert.ok(
    run.out.includes('the fixture skips on purpose'),
    `and carry the skip reason the runner reported; output:\n${run.out}`,
  )
})

test('test_the_census_floor_of_four_sits_below_the_five_the_control_fixture_proves_exist', () => {
  const truth = counter(runTests(UNSKIPPED, false).out, 'tests') - 2
  const census = /taking at least (\d+) assertions/.exec(runTests(SKIPPED, true).out)
  assert.ok(census !== null, 'the census did not report a hidden count')
  const floor = Number(census[1])
  assert.equal(truth, 5, 'the control fixture contains five suite assertions')
  assert.ok(
    floor <= truth,
    `the census must never overstate: reported ${floor}, truth ${truth}`,
  )
  assert.equal(
    floor,
    4,
    'the shortfall is the `for…of` — one call expression, two tests — which is ' +
      'exactly why the census marks the suite `≥` instead of claiming the ' +
      'lexical count is the true one',
  )
})

// ------------- 2a. G997 · under CI a stood-down suite costs an exit code

/**
 * 🛑 THE PAIR THAT MAKES THE CENSUS A CONTROL RATHER THAN A LOG LINE.
 *
 * `tools/skip-census.mjs` printed this same measurement into the gate output
 * from 17 Aug 2026 and nothing read it. **A green tick is what a merge button
 * reads**, and PR #257 is what that arrangement looks like: `success`, with
 * seven test databases unreachable and no chromium.
 *
 * ⚠️ IT IS NOT `tests/reachability.ts` AND THE FIXTURE PROVES THE DIFFERENCE.
 * `skipped-suite.fixture.mjs` stands down on a literal string — no database, no
 * browser, nothing either guard in that file can see — and it is exactly the
 * shape this catches: a suite that skipped for a reason nobody enumerated.
 *
 * 🛑 THE ASSERTION IS THE DIFFERENTIAL, NOT THE RED. One run that exits
 * non-zero proves nothing about WHY. Both arms run the SAME fixture through the
 * SAME reporter and differ in one environment variable, and the unskipped
 * fixture is run under CI as the third arm — otherwise a reporter that exited 1
 * unconditionally would satisfy the first two.
 */
test('test_under_ci_a_stood_down_suite_makes_the_run_red_and_off_ci_it_does_not', () => {
  const underCi = runTests(SKIPPED, true, true)
  const offCi = runTests(SKIPPED, true, false)

  assert.notEqual(
    underCi.status,
    0,
    'UNDER CI A SUITE STOOD DOWN AND THE RUN WAS STILL GREEN. The census ' +
      'printed the shortfall and nothing read it, which is the 17 Aug 2026 hole: ' +
      `a gate reporting success about a smaller suite than the tree holds.\n${underCi.out}`,
  )
  assert.ok(
    underCi.out.includes('THE GATE IS RED'),
    `the red must say why, in the gate output a person reads:\n${underCi.out}`,
  )
  assert.equal(
    offCi.status,
    0,
    'off CI the same run went red. A contributor with no PostgreSQL and no ' +
      'chromium must still get a runnable suite — that is why this is ' +
      `conditioned at all.\n${offCi.out}`,
  )
})

test('test_the_ci_red_is_about_a_stood_down_suite_and_not_about_ci_itself', () => {
  /* The control on the control. Without this arm a reporter that exited 1
   * whenever `CI` was set would pass the differential above, and every CI run
   * in this repository would be red for a reason nobody could act on. */
  const clean = runTests(UNSKIPPED, true, true)
  assert.equal(
    clean.status,
    0,
    'a run under CI in which NOTHING stood down was still red. The census must ' +
      `key on the stood-down suites, never on CI alone.\n${clean.out}`,
  )
  assert.ok(
    clean.out.includes('no suite stood down on this run'),
    `and it must still print its clean census under CI:\n${clean.out}`,
  )
})

test('test_the_fatal_predicate_is_readable_on_its_own_and_keys_on_presence_of_CI', async () => {
  /* ⚠️ THE TWO SPELLINGS ARE BOTH LIVE: the CodeBuild projects set CI="1" and
   * `infra/ci-image/buildspec-gate.yml` sets CI: "true". A predicate demanding
   * one literal would arm on one gate and not the other, so it keys on
   * PRESENCE — `tests/reachability.ts`'s exact test, to the character. */
  const mod = (await import('../../tools/skip-census.mjs')) as unknown as {
    censusIsFatal: (stoodDown: number, env: Record<string, string | undefined>) => boolean
  }
  const fatal = mod.censusIsFatal
  assert.equal(typeof fatal, 'function', 'tools/skip-census.mjs exports no censusIsFatal')

  for (const value of ['1', 'true', 'false', '0', '']) {
    assert.equal(
      fatal(1, { CI: value }),
      true,
      `CI=${JSON.stringify(value)} did not arm the census. It keys on PRESENCE: ` +
        'the projects set "1", the gate buildspec sets "true", and a reading that ' +
        'demanded either literal would be silent on the other gate.',
    )
  }
  assert.equal(fatal(1, {}), false, 'with no CI at all a stood-down suite must stay green')
  assert.equal(fatal(0, { CI: '1' }), false, 'a clean run under CI must stay green')
})

// ------------------------------------------------ 3. the quiet-run behaviour

test('test_the_census_says_so_plainly_when_no_suite_stood_down', () => {
  const text = censusText([], { tests: 10, skipped: 0 })
  assert.ok(
    text.includes('no suite stood down on this run'),
    `a run with nothing skipped must still say the census ran; got:\n${text}`,
  )
  assert.equal(
    text.includes('DID NOT EXECUTE'),
    false,
    'and must not manufacture a shortfall out of a clean run',
  )
})

// ---------------------------------------- 4. the census is wired into the gate

test('test_npm_test_runs_the_census_reporter_so_the_gate_output_carries_it', async () => {
  const pkg = JSON.parse(
    await (await import('node:fs/promises')).readFile(join(REPO_ROOT, 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> }
  const script = pkg.scripts?.['test'] ?? ''
  assert.ok(
    script.includes('tools/skip-census.mjs'),
    'the census is only useful where the gate output is read; `npm test` is ' +
      `currently ${JSON.stringify(script)}`,
  )
  assert.ok(
    script.includes('--test-reporter=spec'),
    'the default reporter must stay explicit alongside it, or adding the ' +
      'census would silently replace the run output',
  )
})

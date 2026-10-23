/**
 * THE SKIP COUNTER IS NOT A COUNT OF WHAT DID NOT RUN, AND THIS IS THE CENSUS
 * THAT SAYS BY HOW MUCH.
 *
 * 🛑 THE MEASUREMENT THAT MOTIVATES THIS FILE.
 *
 *   node --test                                       → tests 1254 · skipped 0
 *   RECONCILE_DB_PORT=1 PLAYWRIGHT_BROWSERS_PATH=<empty> node --test
 *                                                     → tests 1165 · skipped 4
 *
 * ⚠️ THE TWO ABSOLUTE FIGURES ABOVE ARE HISTORY AND ARE KEPT AS HISTORY — they
 * were taken at `78580f66`, and PRs #277, #278, #279 and #280 have landed since.
 * Re-derived on the tree this file ships in: **1280** and **1191**. Both moved;
 * the DELTA did not, and the delta is the whole claim. **Do not sweep these to
 * new absolutes** — they will be stale again by the next merge, which is the
 * point the paragraph below is making. Derive them:
 *
 *   node --test 2>&1 | grep '^ℹ tests'
 *   RECONCILE_DB_PORT=1 PLAYWRIGHT_BROWSERS_PATH=<empty> node --test 2>&1 | grep '^ℹ tests'
 *
 * Nothing in `npm run check` governs either number: `check-doc-counts.mjs` reads
 * Markdown, not a comment in a `.mjs`, so this block is guarded by a person.
 *
 * Eighty-nine assertions stopped existing and the counter moved by four. That
 * is not a rounding error in a summary line, it is the summary line describing
 * a different suite from the one in the tree — and a CI log reporting
 * `fail 0 · skipped 4` about it reads exactly like a full green run. Run
 * 31961439743 was reported `success` with seven test databases unreachable and
 * no browser binary present.
 *
 * ┌─ WHY NODE CANNOT REPORT THIS, STATED RATHER THAN ASSUMED ──────────────────┐
 * │ `describe(name, { skip }, fn)` NEVER INVOKES `fn`. Verified directly:      │
 * │                                                                            │
 * │   describe('outer', { skip: 'because' }, () => {                           │
 * │     it('one', () => {}); it('two', () => {})                               │
 * │     describe('inner', () => { it('three', () => {}) })                     │
 * │   })                                                                       │
 * │   it('loose', () => {})                                                    │
 * │                                                                            │
 * │   → tests 1 · suites 1 · pass 1 · skipped 0                                │
 * │                                                                            │
 * │ The three children are never CREATED, so there is nothing for the runner   │
 * │ to mark skipped and nothing for a reporter to observe. `skipped` counts    │
 * │ only tests that were registered and then stood down — which is why         │
 * │ `tests/db/tenant-projection.test.ts`, whose four assertions carry `{ skip }`│
 * │ individually, is the ONLY contributor to the `skipped 4` above.            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * SO THE CENSUS IS JOINED FROM TWO MECHANISMS, AND IT SAYS SO IN ITS OWN
 * OUTPUT, because a number whose provenance is not stated is the defect this
 * repository catalogues at `docs/HANDOFF.md` §5.11.
 *
 *   · WHICH suites stood down, and why — from the runner's own reporter
 *     events. Nothing is enumerated statically here: a suite that did not skip
 *     on this run contributes nothing, so the census is about THIS RUN and not
 *     about what the tree could skip in principle.
 *   · HOW MANY assertions each one took with it — from a TypeScript-AST walk of
 *     that suite's callback, located by the `file`/`line`/`column` the runner
 *     reported for it. The parser is the same one `tools/check-doc-counts.mjs`
 *     already derives its export counts from; G109's ruling against
 *     hand-rolling a parser is the reason it is not a regex.
 *
 * ⚠️ WHERE THE AST WALK IS A LOWER BOUND, AND IT SAYS SO PER SUITE. An `it()`
 * inside a `for` or a `.forEach()` is ONE call expression and MANY tests. The
 * walk marks any suite containing such a call as `≥`, because a census that
 * quietly reported the lexical count as the true one would be a number that
 * passes while asserting less than it claims — §5.6, in the tool written to
 * measure honesty.
 *
 * ⚠️ THIS REPORTED AND DID NOT FAIL UNTIL 20 Sep 2026, AND THE PARAGRAPH THAT
 * SAID SO IS CORRECTED RATHER THAN DELETED, because half of it is still exactly
 * right and the other half was a MEASURABLE CLAIM THAT WAS FALSE:
 *
 *   *"⚠️ THIS REPORTS. IT DOES NOT FAIL. Making the run red when a suite skips
 *   is `tests/reachability.ts`'s job and it is conditioned on `CI`, because a
 *   contributor with no PostgreSQL and no chromium must still get a runnable
 *   suite. A REPORTER CANNOT SET AN EXIT CODE IN ANY CASE."*
 *
 * 🛑 **THE LAST SENTENCE IS WRONG, AND IT WAS NEVER MEASURED.** A reporter runs
 * in the RUNNER'S OWN PROCESS, and `process.exitCode = 1` set while handling
 * `test:summary` survives to exit. Measured before this was written, on a
 * two-test fixture: a reporter setting `process.exitCode = 7` produced
 * `EXIT: 7` from a run in which nothing failed. **A sentence asserting that a
 * control was impossible kept it from being built for a month** — the mirror of
 * the `AssertNoTextDeep` false-negative `CLAUDE.md` records, where a stale
 * warning told readers a control was weaker than it was.
 *
 * ✅ **WHAT IT DOES NOW — G997. UNDER `CI`, A STOOD-DOWN SUITE COSTS AN EXIT
 * CODE.** The rest of the old paragraph stands and is the reason this is
 * conditioned rather than unconditional: off `CI` this still only prints, so a
 * contributor with no PostgreSQL and no chromium keeps a runnable suite.
 *
 * 🛑 **IT IS NOT A SECOND `tests/reachability.ts` AND THE DIFFERENCE IS THE
 * WHOLE ARGUMENT FOR HAVING BOTH.** Those guards ask *"is the DEPENDENCY
 * reachable"* — a database, a browser — and they are the right answer for the
 * two dependencies somebody enumerated. This asks *"did any suite stand down,
 * for ANY reason"*, which is the property the gate's claim actually rests on:
 * a suite skipped on a missing environment variable, an unwritten fixture, an
 * `os.platform()` check or a dependency nobody has thought of yet is invisible
 * to every guard in that file and visible here. The census already KNEW; it
 * printed into a log, and **a green tick is what a merge button reads.**
 *
 * ⚠️ **SUITES, NOT TESTS, AND THE LINE IS DELIBERATE.** An individually skipped
 * `it()` is REGISTERED and COUNTED — `skipped N` tells the truth about it, and
 * `tests/db/tenant-projection.test.ts` carries four on purpose. What this
 * refuses is the shape the whole file exists to measure: children that were
 * never created, and therefore never counted.
 *
 * ⚠️ **`process.env['CI'] === undefined` IS THE SAME TEST `tests/reachability.ts`
 * MAKES, TO THE CHARACTER.** Presence, never a literal: the CodeBuild projects
 * set `CI = "1"` and `infra/ci-image/buildspec-gate.yml` sets `CI: "true"`, and
 * a reading that demanded one of those would arm on one gate and not the other.
 *
 * G108: this adds NO step to the gate. It is a reporter on the `node --test`
 * invocation `npm test` already runs, and `npm test` is already inside
 * `npm run check`.
 */

import { readFileSync } from 'node:fs'
import ts from 'typescript'

/** Callee names that create an assertion, and those that create a suite. */
const ASSERTION_CALLEES = new Set(['it', 'test'])
const SUITE_CALLEES = new Set(['describe', 'suite'])

/** Iteration forms that turn one lexical call into an unknown number of tests. */
const ITERATOR_METHODS = new Set(['forEach', 'map', 'flatMap', 'filter'])

/**
 * The identifier a call is made through: `it` for `it(…)`, and `it` for
 * `it.skip(…)` too — the modifier does not change what is being created.
 */
function calleeName(node) {
  const expr = node.expression
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text
  }
  return null
}

/** The last function-valued argument — the body a `describe` would have run. */
function callbackOf(call) {
  for (let i = call.arguments.length - 1; i >= 0; i -= 1) {
    const arg = call.arguments[i]
    if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) return arg
  }
  return null
}

const sourceCache = new Map()

function parse(file) {
  let cached = sourceCache.get(file)
  if (cached === undefined) {
    const text = readFileSync(file, 'utf8')
    cached = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.ESNext,
      /* setParentNodes */ true,
      file.endsWith('.mjs') || file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
    )
    sourceCache.set(file, cached)
  }
  return cached
}

/**
 * The call expression the runner reported, found by position rather than by
 * name — two suites in one file may share a name, and a position cannot.
 */
function callAt(source, line, column) {
  let found = null
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const pos = source.getLineAndCharacterOfPosition(node.getStart(source))
      if (pos.line + 1 === line && pos.character + 1 === column) {
        found = found ?? node
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/**
 * How many assertions and nested suites a skipped suite's callback would have
 * created, had the callback run.
 *
 * @returns `{ assertions, suites, indeterminate }`, or `null` when the call
 *          site could not be located — which is reported as unknown rather
 *          than silently counted as zero.
 */
export function hiddenAssertions(file, line, column) {
  let source
  try {
    source = parse(file)
  } catch {
    return null
  }
  const call = callAt(source, line, column)
  if (call === null) return null
  const body = callbackOf(call)
  if (body === null) return { assertions: 0, suites: 0, indeterminate: false }

  let assertions = 0
  let suites = 0
  let indeterminate = false

  const visit = (node, iterated) => {
    let nowIterated = iterated
    if (
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) {
      nowIterated = true
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression
      if (
        ts.isPropertyAccessExpression(expr) &&
        ITERATOR_METHODS.has(expr.name.text)
      ) {
        nowIterated = true
      }
      const name = calleeName(node)
      if (name !== null && ASSERTION_CALLEES.has(name)) {
        assertions += 1
        if (nowIterated) indeterminate = true
      } else if (name !== null && SUITE_CALLEES.has(name)) {
        suites += 1
        if (nowIterated) indeterminate = true
      }
    }
    ts.forEachChild(node, (child) => visit(child, nowIterated))
  }
  ts.forEachChild(body, (child) => visit(child, false))

  return { assertions, suites, indeterminate }
}

/** Repository-relative, so the census reads like the tree and not like a disk. */
function short(file, cwd) {
  return file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : file
}

const RULE = '─'.repeat(78)

/**
 * The census text. Exported so a test can assert on it without owning a
 * terminal — `tests/tools/skip-census.test.ts` drives the whole reporter over a
 * fixture with a known number of hidden assertions.
 */
export function censusText(skippedSuites, counts, cwd = process.cwd()) {
  if (skippedSuites.length === 0) {
    return (
      `\n${RULE}\n` +
      'SKIP CENSUS — no suite stood down on this run, so `skipped ' +
      `${counts.skipped}` +
      '` is the whole story.\n' +
      `${RULE}\n`
    )
  }

  const rows = []
  let hidden = 0
  let unknown = 0
  let anyIndeterminate = false

  for (const suite of skippedSuites) {
    const found = hiddenAssertions(suite.file, suite.line, suite.column)
    if (found === null) {
      unknown += 1
      rows.push({ suite, label: '  ?', detail: 'call site not located' })
      continue
    }
    hidden += found.assertions
    if (found.indeterminate) anyIndeterminate = true
    rows.push({
      suite,
      label: `${found.indeterminate ? '≥' : ' '}${String(found.assertions).padStart(3)}`,
      detail:
        found.suites > 0
          ? `${found.suites} nested suite${found.suites === 1 ? '' : 's'}`
          : '',
    })
  }

  const width = Math.max(
    ...rows.map((r) => short(r.suite.file, cwd).length + r.suite.name.length + 3),
    40,
  )

  const lines = [
    '',
    RULE,
    '🛑 SKIP CENSUS — `skipped ' +
      `${counts.skipped}` +
      '` IS NOT THE NUMBER OF ASSERTIONS THAT DID NOT RUN.',
    '',
    `   ${skippedSuites.length} suite${skippedSuites.length === 1 ? '' : 's'} stood down, ` +
      `taking ${anyIndeterminate ? 'at least ' : ''}${hidden} assertion${hidden === 1 ? '' : 's'} ` +
      `with ${skippedSuites.length === 1 ? 'it' : 'them'}. node never`,
    '   registered those, so they were never counted as skipped either — the ' +
      'summary line',
    `   above describes the ${counts.tests} assertions that remained.`,
    '',
    `   DID NOT EXECUTE, IN TOTAL: ${anyIndeterminate ? '≥' : ''}${hidden + counts.skipped}` +
      `  (${hidden} hidden behind skipped suites + ${counts.skipped} ` +
      `skipped test${counts.skipped === 1 ? '' : 's'})`,
    '',
  ]

  for (const row of rows) {
    const where = `${short(row.suite.file, cwd)} › ${row.suite.name}`
    lines.push(
      `   ${where.padEnd(width)} ${row.label}${row.detail === '' ? '' : `   ${row.detail}`}`,
    )
  }

  const reasons = [...new Set(skippedSuites.map((s) => s.reason))].filter(
    (r) => typeof r === 'string' && r !== '',
  )
  if (reasons.length > 0) {
    lines.push('', '   WHY:')
    for (const reason of reasons) {
      lines.push(`   · ${String(reason).split('\n')[0]}`)
    }
  }

  lines.push(
    '',
    '   MECHANISM — the two halves come from different places and neither could',
    '   produce this number alone:',
    '   · WHICH suites stood down: node:test reporter events from THIS run.',
    '   · HOW MANY assertions each hid: a TypeScript-AST walk of that suite’s',
    '     callback. node cannot report it — `describe(…, { skip })` never invokes',
    '     the callback, so the children are never created.',
  )
  if (anyIndeterminate) {
    lines.push(
      '   · `≥` marks a suite whose assertions are created inside a loop or a',
      '     `.forEach()`: one call expression, an unknown number of tests. The',
      '     lexical count is a floor, and is reported as one.',
    )
  }
  if (unknown > 0) {
    lines.push(
      `   · ${unknown} suite call site${unknown === 1 ? '' : 's'} could not be located in ` +
        'source and',
      '     contributed 0 — the census is a floor by that much too.',
    )
  }
  lines.push(RULE, '')
  return lines.join('\n')
}

/**
 * 🛑 G997 — THE ONE LINE THAT TURNS THE CENSUS FROM A LOG INTO A CONTROL.
 *
 * Exported so `tests/tools/skip-census.test.ts` can assert the POLARITY without
 * owning a process, and named so the grep that finds it reads as what it is.
 * The environment is passed in for the same reason: a function reading
 * `process.env` directly is one no test can drive both ways.
 *
 * @returns whether a run in which `stoodDown` suites skipped must be RED.
 */
export function censusIsFatal(stoodDown, env) {
  /* Presence, never a literal — `tests/reachability.ts`'s exact test. The gate
     projects set CI="1" and the gate buildspec sets CI="true". */
  if (env['CI'] === undefined) return false
  return stoodDown > 0
}

/** The message a CI run gets when it is about to go red for this reason. */
export function fatalCensusText(stoodDown) {
  return (
    `\n${RULE}\n` +
    `🛑 UNDER CI, ${stoodDown} SUITE${stoodDown === 1 ? '' : 'S'} STOOD DOWN — THE GATE IS RED.\n` +
    '\n' +
    '   A gate is a claim about the repository, and a run that did not register\n' +
    '   part of the suite is a claim about a smaller one. The census above names\n' +
    '   which suites and how many assertions went with them.\n' +
    '\n' +
    '   This is NOT `tests/reachability.ts`. Those guards ask whether a DATABASE\n' +
    '   or a BROWSER is reachable; this asks whether anything stood down for ANY\n' +
    '   reason, including ones nobody has enumerated.\n' +
    '\n' +
    '   Off CI this is a report and the run stays green: a contributor with no\n' +
    '   PostgreSQL and no chromium must still get a runnable suite.\n' +
    `${RULE}\n`
  )
}

/**
 * The reporter. Watches for skipped SUITES, prints the census once the run
 * summary arrives — and, under `CI`, makes a stood-down suite cost an exit code.
 */
export default async function* skipCensus(source) {
  const skippedSuites = []
  let counts = { tests: 0, skipped: 0 }

  for await (const event of source) {
    if (event.type === 'test:pass' || event.type === 'test:fail') {
      const data = event.data
      if (data.skip !== undefined && data.skip !== false && data.details?.type === 'suite') {
        skippedSuites.push({
          file: data.file,
          line: data.line,
          column: data.column,
          name: data.name,
          reason: typeof data.skip === 'string' ? data.skip : '',
        })
      }
    } else if (event.type === 'test:summary' && event.data.file === undefined) {
      // The run-level summary — the per-file ones carry `file`.
      counts = {
        tests: event.data.counts.tests,
        skipped: event.data.counts.skipped,
      }
      yield censusText(skippedSuites, counts)
      /* 🛑 THE EXIT CODE, SET HERE AND NOWHERE ELSE. A reporter runs in the
         runner's own process, so `process.exitCode` set on the run summary
         survives to exit — measured, against the sentence in this file's header
         that said it could not. It is only ever set to 1: a reporter that
         cleared a failure's exit code would be a reporter that could turn a red
         run green, which is the one thing it must never do. */
      if (censusIsFatal(skippedSuites.length, process.env)) {
        yield fatalCensusText(skippedSuites.length)
        process.exitCode = 1
      }
    }
  }
}

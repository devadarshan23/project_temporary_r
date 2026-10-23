/**
 * G1351 — the clock-fixture checker, and the negative controls that make it real.
 *
 * WHAT THIS FILE IS DEFENDING. `tools/check-clock-fixtures.mjs` looks for a
 * fixture seeded from the DATABASE's wall clock and asserted against a FROZEN
 * one, and fails with the date the two stop agreeing. The whole value of it is
 * in the failing, and the tree is CLEAN today — zero files carry both
 * ingredients — so this checker exits 0 over an empty intersection on every run.
 *
 * 🛑 THAT IS EXACTLY THE SHAPE `docs/HANDOFF.md` §5.6 NAMES, AND
 * `docs/build/completion-plan.md` K4 IS A WHOLE CONTROL ABOUT IT: two checkers
 * in `tools/` print a tick over an empty subject and have no test pointing at
 * them at all. A green run here is only worth something if something else
 * proves the checker can still go red and can still tell the two cases apart.
 * That is this file, and it is why the slice is not finished without it.
 *
 * FOUR WAYS THIS CONTROL COULD BE GREEN AND WORTHLESS, EACH ANSWERED BELOW:
 *
 *   1 · THE DETECTORS STOP MATCHING. Both regexes break, every file reads as
 *       `inert`, the intersection is empty for the wrong reason and the run is
 *       green. The checker's own guard only fires when BOTH populations are
 *       zero — deliberately, because zero files with a past interval is a
 *       legitimate future. So each detector is pinned SEPARATELY against the
 *       real tree here, by count, so a single-detector regression is red.
 *   2 · THE CHECKER CANNOT GO RED AT ALL. Answered with the REAL captured red:
 *       `fired.fixture.txt` is transcribed from the pre-repair file and must
 *       produce the historically recorded flip date, to the millisecond.
 *   3 · IT GOES RED UNCONDITIONALLY. Answered by pairing: `repaired` and
 *       `prose-only` differ from `fired` in one respect each and must be clean.
 *   4 · IT AGGREGATES THE WRONG WAY. The recorded first-draft bug — `Math.max`
 *       reporting LATENT for a row that had already fired — is pinned directly.
 *
 * ⚠️ EVERY VERDICT ASSERTION USES A FIXED `at` INSTANT, AND THAT IS NOT
 * TIDINESS. A clock control read at `Date.now()` is a test whose outcome
 * changes with the calendar — the very defect G1209 is about, rebuilt inside
 * the control written to catch it. `AT` sits between the two flip instants of
 * the real fixture, so the min/max discrimination in test 4 holds for ever
 * rather than until 2026-09-21T12:00Z, after which BOTH aggregations would say
 * FIRED and the control would quietly stop discriminating.
 *
 * ⚠️ THE FIXTURES ARE `.txt`. `tests/tsconfig.json` is `"include": ["**\/*.ts"]`,
 * so a `.ts` fixture would be compiled by `typecheck:tests` and these do not
 * compile — no imports, unused locals under `noUnusedLocals`. They are read as
 * text and handed to the exported pure function, which is also why the checker
 * excludes `tests/tools/fixtures` from its own scan: a control that graded its
 * own negative controls would be permanently and correctly red.
 *
 * EXIT CODES COME FROM `spawnSync`, NEVER FROM A PIPE. A piped status is the
 * pipe's, which is 0, and reads exactly like success.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  auditFile,
  frozenClocks,
  pastIntervals,
  stripComments,
  scanFiles,
  SCAN_ROOTS,
  EXCLUDED_PREFIXES,
  UNIT_MS,
} from '../../tools/check-clock-fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const CHECKER = join(REPO, 'tools', 'check-clock-fixtures.mjs')
const FIXTURES = join(HERE, 'fixtures', 'clock-fixtures')

const fixture = (name) => readFileSync(join(FIXTURES, `${name}.fixture.txt`), 'utf8')

/** Between the two flip instants of the real fixture. See the header. */
const AT = Date.parse('2026-09-21T00:00:00.000Z')

/** The flip date G1209 recorded, and the date the suite really broke on. */
const RECORDED_FLIP = '2026-09-20T12:00:00.000Z'

/* ─────────────────────────────────────────────────────────────────────────
   1 · THE CAPTURED RED — the real defect, permanently runnable
   ───────────────────────────────────────────────────────────────────────── */

test('the captured red — the pre-repair fixture FIRES on the date G1209 recorded', () => {
  const result = auditFile(fixture('fired'), { at: AT })

  assert.equal(result.verdict, 'FIRED')
  assert.equal(
    new Date(result.earliest.flip).toISOString(),
    RECORDED_FLIP,
    'the flip instant must be the one the suite really broke on, derived and not transcribed',
  )
  assert.equal(result.earliest.clock.value, '2026-09-19T12:00:00.000Z')
  assert.equal(result.earliest.clock.via, 'NOW', 'the clock reaches the evaluator through a const, as it really did')
  assert.equal(result.earliest.interval.amount, 1)
  assert.equal(result.earliest.interval.unit, 'day')
})

test('the captured red had ALREADY fired when this control was written', () => {
  /* Not a restatement of the test above. G1209's defect was live in the tree
     for a day before anyone noticed, which is the entire argument for a
     control: `Date.now()` here is the real calendar, and the assertion is that
     the pre-repair fixture is in the past rather than merely scheduled. */
  const result = auditFile(fixture('fired'))
  assert.equal(result.verdict, 'FIRED')
  assert.ok(result.earliest.flip < Date.now())
})

/* ─────────────────────────────────────────────────────────────────────────
   2 · THE PAIRS — one respect apart each
   ───────────────────────────────────────────────────────────────────────── */

test('positive control — G1209s repair is clean, and it differs in one respect', () => {
  const result = auditFile(fixture('repaired'), { at: AT })

  assert.equal(result.verdict, 'half', 'the frozen clock is still there; the past-direction interval is not')
  assert.equal(result.clocks.length, 1, 'the clock must still be FOUND — a clean verdict for the wrong reason is worthless')
  assert.equal(result.intervals.length, 0)
  assert.equal(result.earliest, null)
})

test('a bare now() is not a past-direction interval — the repair keeps three of them', () => {
  /* G1209 pinned only the COMPARED value and deliberately left `granted_at` and
     `revoked_at` on `now()`. If a bare `now()` were flagged, the repair this
     control exists to endorse would itself be reported defective. */
  assert.ok(fixture('repaired').includes('now()'), 'the fixture must actually contain a bare now()')
  assert.equal(pastIntervals(fixture('repaired')).length, 0)
})

test('negative control — prose in a comment is not a defect, in both comment forms', () => {
  const result = auditFile(fixture('prose-only'), { at: AT })

  assert.equal(result.verdict, 'half', 'the intervals here exist only in comments')
  assert.equal(result.clocks.length, 1, 'the real frozen clock outside the comments is still found')
  assert.equal(result.intervals.length, 0)
})

test('the prose fixture really does carry the text, so the test above is not vacuous', () => {
  /* Without this, deleting the quoted intervals from the fixture would make the
     comment-stripping test pass while proving nothing. */
  const raw = fixture('prose-only')
  assert.ok(raw.includes("now() - interval '1 hour'"), 'block-comment form must be present in the raw text')
  assert.ok(raw.includes("now() - interval '3 hours'"), 'line-comment form must be present in the raw text')

  /* The RAW text carries three of them — this is the number a naive scanner
     would report, and it is the measurement that makes the line below mean
     something rather than merely pass. */
  assert.equal(pastIntervals(raw).length, 3, 'a scanner reading raw source finds three')
  assert.equal(pastIntervals(stripComments(raw)).length, 0, 'and none may survive comment stripping')
})

/* ─────────────────────────────────────────────────────────────────────────
   3 · THE AGGREGATION — the recorded first-draft bug
   ───────────────────────────────────────────────────────────────────────── */

test('the EARLIEST flip is taken, never the latest — the recorded first-draft bug', () => {
  /* The real fixture carries '2 days' and '1 day' against one frozen clock.
     `min` yields 2026-09-20T12:00Z and `max` yields 2026-09-21T12:00Z. At `AT`
     — between them — the two aggregations DISAGREE about the verdict, which is
     the whole point: a first draft using `max` reported LATENT for a row that
     had already fired. */
  const source = fixture('fired')
  const result = auditFile(source, { at: AT })

  const base = Date.parse('2026-09-19T12:00:00.000Z')
  const latest = base + 2 * UNIT_MS.day

  assert.equal(result.earliest.flip, base + UNIT_MS.day, 'min')
  assert.ok(result.earliest.flip < latest, 'the two aggregations must actually differ, or this control proves nothing')
  assert.ok(AT >= result.earliest.flip, 'min says FIRED at AT')
  assert.ok(AT < latest, 'max would say LATENT at AT — the bug, pinned')
})

/* ─────────────────────────────────────────────────────────────────────────
   4 · THE DETECTORS — pinned separately, against the real tree
   ───────────────────────────────────────────────────────────────────────── */

test('the scanner reads a real, non-empty corpus', () => {
  const files = scanFiles(REPO)
  assert.ok(files.length > 100, `expected a substantial corpus, got ${files.length}`)
  assert.ok(files.some((f) => f.startsWith('tests/db/')), 'tests/db must be scanned')
  assert.ok(files.some((f) => f.endsWith('.sql')), 'db/migrations/*.sql must be scanned')
})

test('the frozen-clock detector still matches the real tree', () => {
  /* Pinned SEPARATELY from the interval detector. The checker's own guard fires
     only when BOTH populations are zero, so a single broken regex would leave
     it green with an empty intersection. This is what makes that acceptable. */
  const files = scanFiles(REPO)
  let withClock = 0
  for (const f of files) {
    const r = auditFile(readFileSync(join(REPO, f), 'utf8'), { sql: f.endsWith('.sql'), at: AT })
    if (r.clocks.length) withClock++
  }
  assert.ok(withClock > 0, 'no frozen `now:` clock found anywhere — the detector is broken, not the tree')
})

test('the past-interval detector still matches the real tree, after comment stripping', () => {
  const files = scanFiles(REPO)
  let withInterval = 0
  for (const f of files) {
    const r = auditFile(readFileSync(join(REPO, f), 'utf8'), { sql: f.endsWith('.sql'), at: AT })
    if (r.intervals.length) withInterval++
  }
  assert.ok(withInterval > 0, 'no now() - interval found anywhere — the detector is broken, not the tree')
})

/* ─────────────────────────────────────────────────────────────────────────
   5 · THE UNITS AND THE DIRECTIONS
   ───────────────────────────────────────────────────────────────────────── */

test('the safe direction is not matched, and its absence is deliberate', () => {
  const result = auditFile(fixture('plus-direction'), { at: AT })
  assert.equal(result.clocks.length, 1, 'the frozen clock is still found')
  assert.equal(result.intervals.length, 0, 'now() + interval is monotone in the safe direction')
  assert.equal(result.verdict, 'half')
})

test('an interval unit the checker cannot measure fails closed, never silently', () => {
  const result = auditFile(fixture('unknown-unit'), { at: AT })
  assert.equal(result.verdict, 'unparsed', 'a delta that cannot be computed is an assertion that cannot be made')
  assert.equal(result.earliest, null)
  assert.equal(result.unparsed.length, 1)
  assert.equal(result.unparsed[0].unit, 'fortnight')
})

test('a clock that is not a frozen literal is not called one', () => {
  const result = auditFile(fixture('live-clock'), { at: AT })
  assert.equal(result.clocks.length, 0, 'a live clock cannot drift against a wall clock')
  assert.equal(result.intervals.length, 1, 'the interval is still found — only the clock disqualifies it')
  assert.equal(result.verdict, 'half')
})

test('units are read singular or plural, and scale', () => {
  const found = pastIntervals(stripComments(fixture('ts-intervals')))
  assert.equal(found.length, 2)
  assert.equal(found[0].ms, 2 * UNIT_MS.hour)
  assert.equal(found[1].ms, UNIT_MS.hour)
})

test('a // inside a string literal is not a comment', () => {
  const stripped = stripComments(fixture('url-in-string'))
  assert.ok(stripped.includes('http://localhost:9324/000000000000/run-admitted'))
  assert.ok(stripped.includes('https://example.test/a//b'))
})

test('SQL -- comments are stripped in .sql and are not stripped in .ts', () => {
  const sql = fixture('sql-comment')
  assert.ok(sql.includes("now() - interval '1 hour'"), 'the raw text must carry it, or this proves nothing')
  assert.equal(pastIntervals(stripComments(sql, { sql: true })).length, 0)

  /* The same two characters in a TypeScript file are the inside of a SQL string
     in a template literal. Applying the SQL dialect there would blank one of
     the two intervals below — the fixture carries exactly that trap. */
  assert.equal(pastIntervals(stripComments(fixture('ts-intervals'))).length, 2)
})

/* ─────────────────────────────────────────────────────────────────────────
   6 · THE CHECKER AS A PROCESS
   ───────────────────────────────────────────────────────────────────────── */

test('the checker exits 0 on the tree, and prints its denominator', () => {
  const run = spawnSync(process.execPath, [CHECKER], { cwd: REPO, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)

  /* A tick with no denominator is the K4 defect. The count of files SCANNED
     must be on stdout, so a run that read nothing cannot look like a clean one. */
  const match = run.stdout.match(/(\d+) file\(s\) scanned/)
  assert.ok(match, `no denominator printed:\n${run.stdout}`)
  assert.ok(Number(match[1]) > 100, `denominator implausibly small: ${match[1]}`)
  assert.match(run.stdout, /with a frozen `now:` clock/)
  assert.match(run.stdout, /with a past-direction now\(\) - interval/)
})

test('an unknown argument is refused rather than ignored', () => {
  const run = spawnSync(process.execPath, [CHECKER, '--fix'], { cwd: REPO, encoding: 'utf8' })
  assert.equal(run.status, 2)
  assert.match(run.stdout, /takes no arguments/)
})

test('there is no --at flag, because a date flag is a way to force this gate green', () => {
  /* `docs/build/completion-plan.md` K3: `check:citations --triage` forces exit
     0, and the identical shape is guarded one checker over for
     check-pack-safety's `--corpus`. An `--at` handed a past date would do the
     same thing here. The refusal above is what keeps that true; this asserts
     the flag was never added. */
  const run = spawnSync(process.execPath, [CHECKER, '--at', '2020-01-01T00:00:00Z'], { cwd: REPO, encoding: 'utf8' })
  assert.equal(run.status, 2, 'a date flag must be refused, not honoured')
  assert.ok(!readFileSync(CHECKER, 'utf8').includes("'--at'"), 'no --at handling may exist in the checker')
})

test('the checker is in the gate, by script name', () => {
  /* The gate stage is the whole delivery — a checker beside `npm run check` is
     G108's refusal. 11 of 16 stages are pinned by no assertion at all
     (completion-plan K2); this one is pinned by this line. */
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts['check:clocks'], 'node tools/check-clock-fixtures.mjs')
  assert.ok(
    pkg.scripts.check.includes('npm run check:clocks'),
    'check:clocks must be a stage of `npm run check`, not a command beside it',
  )
})

test('the scan roots and the fixture exclusions are declared, not implied', () => {
  /* A literal typed into this file rather than imported and compared to itself,
     which is the discipline `tests/tools/check-absent-rows.test.mjs` argues:
     comparing a registry to itself passes when the registry is empty. */
  assert.deepEqual([...SCAN_ROOTS].sort(), ['db', 'model', 'server', 'tests'])
  assert.ok(EXCLUDED_PREFIXES.includes('tests/tools/fixtures'), 'this file\'s own fixtures must be excluded')
  assert.ok(EXCLUDED_PREFIXES.includes('tests/ci/fixtures'))

  const files = scanFiles(REPO)
  assert.ok(
    !files.some((f) => f.startsWith('tests/tools/fixtures/')),
    'the captured red must not be graded by the real scan, or the gate is permanently red',
  )
})

test('THIS FILE carries no defective corpus of its own — a caught self-grading defect', () => {
  /* 🛑 THIS ASSERTION EXISTS BECAUSE IT FIRED. The first draft of this suite
     held its smaller negative controls as INLINE STRINGS — a `const NOW = '…'`
     and a `now() - interval '3 fortnights'` a few lines apart. The checker read
     this file, found both ingredients in it, and failed the gate on its own
     test suite: "tests/tools/check-clock-fixtures.test.mjs UNPARSED INTERVAL".
     It was RIGHT: a string literal holding a defective fixture is
     indistinguishable from a defective fixture, which is precisely why
     `tests/tools/fixtures` is excluded from the scan in the first place.

     The repair was to move every corpus snippet into that excluded directory
     rather than to carve this file out by name — so the rule stays uniform
     (defective corpus lives in fixtures, and nowhere else) instead of growing
     an exception. This assertion is what keeps it uniform: add one inline
     snippet with both ingredients and this goes red HERE, next to the argument,
     rather than in the gate with no explanation attached. */
  const self = readFileSync(join(HERE, 'check-clock-fixtures.test.mjs'), 'utf8')
  const result = auditFile(self, { at: AT })

  assert.ok(
    result.verdict === 'inert' || result.verdict === 'half',
    `this suite must not itself read as a clock fixture; got ${result.verdict}. ` +
      'Move the snippet into tests/tools/fixtures/clock-fixtures/ — do not exempt this file.',
  )
  assert.equal(frozenClocks(stripComments(self)).length, 0, 'no frozen `now:` clock may live in this file')
})

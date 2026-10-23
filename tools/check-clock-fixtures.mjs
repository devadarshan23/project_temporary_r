#!/usr/bin/env node
/**
 * check-clock-fixtures — G1351. The checker for a test with a fuse.
 *
 * WHY THIS EXISTS, AND IT IS NOT A HYPOTHETICAL. On 21 Sep 2026 G1209 recorded
 * a defect found BY THE CALENDAR rather than by a commit. §4 of
 * `tests/db/identity-substrate.test.ts` seeded an "expired" role assignment as
 * `now() - interval '1 day'` — the DATABASE's wall clock — and then handed
 * `decide()` a FROZEN `NOW` of `2026-09-19T12:00:00Z`. The two agree for
 * exactly two days. From `2026-09-20T12:00Z` the seeded expiry is AFTER `NOW`,
 * the assignment is LIVE as the evaluator reckons time, and the suite fails
 * with "ras_expired was ALLOWED and must not have been".
 *
 * `decide()` was right on every run. The fixture and the assertion were reading
 * two different clocks, and the test passed for two days and then asserted the
 * opposite of what it was written to assert. **A test that flips on a date
 * nobody wrote down is the worst kind of green**, because the red arrives
 * detached from any commit and reads as flake.
 *
 * G1209's own row ends: "A repository-wide sweep of `now()` seeded against a
 * frozen evaluator clock is NOT done and is owed, and it wants a control rather
 * than a reading." A one-off grep by a person rots the moment the next fixture
 * lands. This is that control.
 *
 * WHAT IT DOES. For every scanned file it strips comments, then looks for two
 * ingredients and only reasons about a file that carries BOTH:
 *
 *   A FROZEN CLOCK   an ISO literal reaching an evaluator as `now:` — either
 *                    written inline (`now: '2026-09-19T12:00:00.000Z'`) or
 *                    through a `const` bound to one (`const NOW = '…'` …
 *                    `now: NOW`), which is the form the defect took.
 *   A PAST INTERVAL  `now() - interval 'N unit'` — a value seeded from the
 *                    DATABASE's clock and intended to sit BEFORE the frozen one.
 *
 * For each (clock, interval) pair the seeded value is `wallclock - Δ` and the
 * fixture's intent is `wallclock - Δ < FROZEN`. That holds while
 * `wallclock < FROZEN + Δ`, so the flip instant is `Date.parse(FROZEN) + Δ`.
 * The verdict is `Date.now() < earliest flip`, and the flip DATE is printed on
 * every row — FIRED and LATENT alike — because the person who meets the red
 * needs to know WHEN it fires, not only that it does.
 *
 * 🛑 THE EARLIEST FLIP, NEVER THE LATEST, AND THIS IS A CAPTURED BUG RATHER
 * THAN A PREFERENCE. A first draft of this control aggregated a file's pairs
 * with `Math.max` and reported `LATENT` for a row that HAD ALREADY FIRED. On
 * the G1209 fixture the two intervals are `'2 days'` and `'1 day'`: `max`
 * yields `2026-09-21T12:00Z` and `min` yields `2026-09-20T12:00Z`, and only the
 * second is the date the suite actually broke on. A control that reports a
 * later date than the truth is worse than no control — it answers the question
 * and answers it reassuringly. `tests/tools/check-clock-fixtures.test.mjs`
 * pins `min` against exactly that pair, in both directions.
 *
 * 🛑 COMMENTS ARE STRIPPED BEFORE ANYTHING IS MATCHED, AND THAT IS LOAD-BEARING
 * RATHER THAN TIDY. `CLAUDE.md` catalogues this false-positive class about a
 * dozen times — the `@dropped-for-v1` awk that armed on prose ABOUT a drop and
 * counted 198 where the parser says 197; the `jwtVerify\|createRemoteJWKSet`
 * grep quoted in six documents as proof no verifier existed, which returned
 * THREE lines of which all three were prose QUOTING the command. This control
 * would have walked straight into it: **the single loudest `now() - interval
 * '1 day'` in the tree today is the G1209 narration inside a block comment in
 * the very file that was repaired.** Three sites are prose and nothing else —
 * `tests/db/identity-substrate.test.ts` (the repair's own argument),
 * `tests/db/membership-revocation.test.ts` §10's quoted `UPDATE`, and
 * `db/migrations/0035…sql`'s quoted measurement. Un-stripped, this checker
 * would report the repaired file as still defective, for ever, and the first
 * person to meet that red would learn to ignore it.
 *
 * 🛑 IT TAKES NO ARGUMENTS, AND THE REFUSAL IS AN ARGUMENT. An `--at <iso>`
 * flag is the obvious convenience — "what breaks in the next year?" — and it is
 * exactly the shape `docs/build/completion-plan.md` K3 names: a flag that can be
 * handed a date in the past is a flag that forces this gate green, the same way
 * `check:citations --triage` forces exit 0. The instant is a parameter of the
 * exported `auditFile()` so the tests can be deterministic, and it is reachable
 * from no command line.
 *
 * ⚠️ WHAT IT CANNOT SEE — A LANDMARK, NOT THE PROPERTY, AND SAYING SO IS PART
 * OF THE CONTROL. The property is *a fixture and its assertion reckoning time
 * by two different clocks*. What is matched is one spelling of one half of it.
 * It will miss, and each of these is a real shape this repository could grow:
 *
 *   · `CURRENT_TIMESTAMP - interval '…'`, `transaction_timestamp()`,
 *     `statement_timestamp()`, `clock_timestamp()` — all the same defect, none
 *     of them spelled `now()`.
 *   · A COMPUTED interval — `interval '1 day' * $3`, `make_interval(days => 1)`,
 *     or an amount arriving as a bind parameter. Only a literal `'N unit'` is
 *     read, because only a literal can be turned into a date here.
 *   · A clock passed through a HELPER — `now: frozenClock()`, `now: NOW_FOR(…)`,
 *     a clock read out of a fixture module or spread in from an object. Only an
 *     inline literal and a same-file `const` are resolved.
 *   · A frozen clock reaching the evaluator under any name but `now:`.
 *   · The mirror defect on the JavaScript side — `new Date(Date.now() - 864e5)`
 *     compared against a frozen literal.
 *   · `month` and `year` are approximated at 30 and 365 days. A flip date
 *     derived from one is accurate to within a few days and no further; it is
 *     still the right order of magnitude and still names a date.
 *
 * ⚠️ AND ONE DIRECTION IS DELIBERATELY NOT MATCHED, so its absence is not read
 * as an oversight: `now() + interval 'N unit'` is the SAFE direction and cannot
 * flip forward. A value seeded at `wallclock + Δ` and intended to sit AFTER a
 * frozen `NOW` satisfies `wallclock + Δ > NOW` MORE strongly as the wall clock
 * advances — it is monotone in the right direction. It could only have been
 * false in the past. There are 28 files carrying one and not one of them is at
 * risk from it.
 *
 * WHAT IT READS. `tests/`, `server/`, `db/` and `model/` — the four roots where
 * SQL written against a database clock can meet a model evaluator handed a
 * frozen one. `frontend/`, `infra/` and `tools/` are excluded because none of
 * them has both halves; widening is a change to `SCAN_ROOTS`, not to the code
 * beneath it. TWO fixture directories are excluded BY NAME and the exclusion is
 * argued rather than assumed: `tests/tools/fixtures` and `tests/ci/fixtures`
 * hold corpora that are DELIBERATELY defective, including this checker's own
 * captured red. A control that graded its own negative controls would be
 * permanently and correctly red, and would have to be silenced to ship.
 *
 *   node tools/check-clock-fixtures.mjs   report; exit 1 on any FIRED fixture
 */

import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The roots where a database clock can meet a frozen evaluator clock. */
export const SCAN_ROOTS = ['tests', 'server', 'db', 'model']

/** Deliberately defective corpora, including this checker's own captured red. */
export const EXCLUDED_PREFIXES = ['tests/tools/fixtures', 'tests/ci/fixtures']

export const SCANNED_EXTENSIONS = ['.ts', '.mts', '.mjs', '.js', '.sql']

/**
 * Interval units, in milliseconds. `month` and `year` are approximations and
 * are named as such in the header — a flip date derived from one is good to a
 * few days. An unknown unit is NOT silently skipped: `auditFile` reports it and
 * the run fails, because a Δ that cannot be computed is an assertion that
 * cannot be made, and failing closed is the only honest answer.
 */
export const UNIT_MS = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
}

const ISO_LITERAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z$/

/**
 * Blank out comments, preserving every byte offset and every newline so line
 * numbers survive. String literals are preserved verbatim, which is what makes
 * this safe in both directions: a `//` inside `'http://…'` is not a comment,
 * and the SQL inside a backtick template literal — where every `now() -
 * interval` in `tests/` actually lives — is not touched.
 *
 * `sql: true` reads `--` as the line comment and does not read `//` or a block
 * opener. The two dialects are kept apart deliberately: a `--` in a TypeScript
 * file is a decrement or the inside of a SQL string, never a comment.
 *
 * ⚠️ LIMIT, STATED: a regular-expression literal containing a quote character
 * can desynchronise the string tracking. No scanned file does, and the
 * alternative is a JavaScript parser for a problem that is a line scan.
 */
export function stripComments(source, { sql = false } = {}) {
  const out = source.split('')
  const n = source.length
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' '
  }

  let i = 0
  let quote = ''
  while (i < n) {
    const c = source[i]
    const d = source[i + 1]

    if (quote === '') {
      if (!sql && c === '/' && d === '*') {
        const end = source.indexOf('*/', i + 2)
        const stop = end === -1 ? n : end + 2
        blank(i, stop)
        i = stop
        continue
      }
      if (!sql && c === '/' && d === '/') {
        let end = source.indexOf('\n', i)
        if (end === -1) end = n
        blank(i, end)
        i = end
        continue
      }
      if (sql && c === '-' && d === '-') {
        let end = source.indexOf('\n', i)
        if (end === -1) end = n
        blank(i, end)
        i = end
        continue
      }
      if (c === "'" || c === '"' || (!sql && c === '`')) {
        quote = c
        i++
        continue
      }
      i++
      continue
    }

    if (!sql && c === '\\') {
      i += 2
      continue
    }
    if (c === quote) {
      if (sql && quote === "'" && d === "'") {
        i += 2
        continue
      }
      quote = ''
      i++
      continue
    }
    i++
  }
  return out.join('')
}

/** 1-based line number of a byte offset. */
function lineOf(source, index) {
  let line = 1
  for (let i = 0; i < index; i++) if (source[i] === '\n') line++
  return line
}

/**
 * Every frozen clock reaching an evaluator as `now:` in this (comment-stripped)
 * source. Two forms are resolved and no others: an inline ISO literal, and an
 * identifier bound by a same-file `const` to an ISO literal — which is the form
 * the G1209 defect took (`const NOW = '2026-09-19T12:00:00.000Z' as Timestamp`).
 * A `now:` whose value is anything else — a call, a spread, an import — is NOT
 * a frozen clock and is not reported as one.
 */
export function frozenClocks(code) {
  const bound = new Map()
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+?)?=\s*['"]([^'"\n]+)['"]/g)) {
    if (ISO_LITERAL.test(m[2])) bound.set(m[1], m[2])
  }

  const clocks = []
  for (const m of code.matchAll(/\bnow\s*:\s*([^,}\n]+)/g)) {
    const raw = m[1]
      .trim()
      .replace(/\s+as\s+[\w.<>[\]|\s]+$/, '')
      .trim()
      .replace(/[,;]$/, '')
      .trim()
    const line = lineOf(code, m.index)

    const literal = raw.match(/^['"]([^'"]+)['"]$/)
    if (literal && ISO_LITERAL.test(literal[1])) {
      clocks.push({ value: literal[1], line, via: 'literal' })
      continue
    }
    if (bound.has(raw)) clocks.push({ value: bound.get(raw), line, via: raw })
  }
  return clocks
}

/**
 * Every past-direction `now() - interval 'N unit'` in this (comment-stripped)
 * source. `ms` is null for a unit `UNIT_MS` does not know, which `auditFile`
 * turns into a failure rather than a skip.
 */
export function pastIntervals(code) {
  const found = []
  for (const m of code.matchAll(/\bnow\(\)\s*-\s*interval\s+'(\d+)\s+([A-Za-z]+)'/gi)) {
    const amount = Number(m[1])
    const unit = m[2].toLowerCase().replace(/s$/, '')
    const per = UNIT_MS[unit]
    found.push({
      text: m[0].replace(/\s+/g, ' '),
      line: lineOf(code, m.index),
      amount,
      unit,
      ms: per === undefined ? null : amount * per,
    })
  }
  return found
}

/**
 * The verdict for one file. `at` is the instant to reckon from — `Date.now()`
 * in the gate, a fixed instant in the tests, and reachable from no command line
 * (see the header: an `--at` flag is a way to force this gate green).
 *
 * Verdicts:
 *   inert     neither ingredient — the overwhelming majority
 *   half      one ingredient and not the other — structurally safe
 *   unparsed  both ingredients, and an interval unit that cannot be measured
 *   LATENT    both ingredients; the earliest flip is still ahead
 *   FIRED     both ingredients; the earliest flip is in the past
 */
export function auditFile(source, { sql = false, at = Date.now() } = {}) {
  const code = stripComments(source, { sql })
  const clocks = frozenClocks(code)
  const intervals = pastIntervals(code)

  if (clocks.length === 0 || intervals.length === 0) {
    return {
      clocks,
      intervals,
      verdict: clocks.length === 0 && intervals.length === 0 ? 'inert' : 'half',
      earliest: null,
    }
  }

  const unparsed = intervals.filter((iv) => iv.ms === null)
  if (unparsed.length) {
    return { clocks, intervals, verdict: 'unparsed', earliest: null, unparsed }
  }

  /* THE EARLIEST FLIP. `Math.max` here reported LATENT for a row that had
     already fired — see the header. The pair is carried, not just the number,
     so the message can name the clock and the interval that produced it. */
  let earliest = null
  for (const clock of clocks) {
    const base = Date.parse(clock.value)
    if (Number.isNaN(base)) continue
    for (const interval of intervals) {
      const flip = base + interval.ms
      if (earliest === null || flip < earliest.flip) earliest = { flip, clock, interval }
    }
  }
  if (earliest === null) return { clocks, intervals, verdict: 'half', earliest: null }

  return {
    clocks,
    intervals,
    earliest,
    verdict: at >= earliest.flip ? 'FIRED' : 'LATENT',
  }
}

/** Every scanned file, repo-relative, sorted. */
export function scanFiles(root = ROOT) {
  const acc = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      const rel = relative(root, full).split(sep).join('/')
      if (EXCLUDED_PREFIXES.some((p) => rel === p || rel.startsWith(`${p}/`))) continue
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue
        walk(full)
        continue
      }
      if (SCANNED_EXTENSIONS.some((x) => entry.name.endsWith(x))) acc.push(rel)
    }
  }
  for (const r of SCAN_ROOTS) walk(join(root, r))
  return acc.sort()
}

export function main(argv = []) {
  /* No arguments, and an unknown one is refused rather than ignored — the shape
     `tools/check-g-numbers.mjs` argues for, and the reason there is no `--at`. */
  if (argv.length) {
    console.log(`check-clock-fixtures takes no arguments; got ${argv.join(' ')}`)
    return 2
  }

  const files = scanFiles()

  /* Vacuity guard, first and reported. Every verdict below is drawn from this
     list; an empty one makes the whole run pass while reading nothing, which is
     `docs/HANDOFF.md` §5.6 happening inside a control written against it. */
  if (files.length === 0) {
    console.log(`NO FILES SCANNED under ${SCAN_ROOTS.join(', ')} — every verdict below would be vacuous.`)
    console.log('Fix the derivation; do not delete the assertion.')
    return 1
  }

  const at = Date.now()
  let withClock = 0
  let withInterval = 0
  const atRisk = []
  let failures = 0

  for (const file of files) {
    let source
    try {
      source = readFileSync(join(ROOT, file), 'utf8')
    } catch (err) {
      failures++
      console.log(`  ${file}  UNREADABLE — ${String(err?.message ?? err)}`)
      continue
    }
    const result = auditFile(source, { sql: file.endsWith('.sql'), at })
    if (result.clocks.length) withClock++
    if (result.intervals.length) withInterval++
    if (result.verdict === 'inert' || result.verdict === 'half') continue
    atRisk.push({ file, result })
  }

  console.log(
    `clock fixtures: ${files.length} file(s) scanned · ${withClock} with a frozen \`now:\` clock · ` +
      `${withInterval} with a past-direction now() - interval · ${atRisk.length} with BOTH`,
  )

  /* THE SECOND ANTI-VACUITY SIGNAL, and it guards the DETECTORS rather than the
     intersection. Zero files carrying BOTH ingredients is a legitimate and
     desirable answer — it is the answer today. Zero files carrying EITHER is
     not: it means both regexes stopped matching, and the run would be green
     having discriminated nothing. Each detector is pinned separately against
     the real tree by tests/tools/check-clock-fixtures.test.mjs, so a
     single-detector regression is red in the suite rather than silent here. */
  if (withClock === 0 && withInterval === 0) {
    console.log('')
    console.log(`NEITHER INGREDIENT FOUND IN ${files.length} FILES — the detectors are broken, not the tree.`)
    console.log('  A tree with no frozen `now:` clock AND no now() - interval anywhere is not a tree')
    console.log('  this repository has ever had. Fix the scanner; do not delete the assertion.')
    return 1
  }

  for (const { file, result } of atRisk) {
    if (result.verdict === 'unparsed') {
      failures++
      const names = result.unparsed.map((u) => `${u.text} (unit "${u.unit}")`).join(', ')
      console.log(`  ${file}  UNPARSED INTERVAL — ${names}`)
      console.log('      the flip date cannot be computed, so no assertion can be made; extend UNIT_MS')
      continue
    }

    const { flip, clock, interval } = result.earliest
    const when = new Date(flip).toISOString()
    const days = Math.round((flip - at) / UNIT_MS.day)

    if (result.verdict === 'FIRED') {
      failures++
      console.log(`  ${file}  FIRED — flipped ${when} (${Math.abs(days)} day(s) ago)`)
    } else {
      console.log(`  ${file}  LATENT — flips ${when} (in ${days} day(s))`)
    }
    console.log(
      `      frozen clock ${clock.value} at line ${clock.line}` +
        `${clock.via === 'literal' ? '' : ` (via \`${clock.via}\`)`}` +
        ` vs \`${interval.text}\` at line ${interval.line}`,
    )
  }

  if (failures) {
    console.log('')
    console.log('A FIXTURE ON THE WALL CLOCK AND AN ASSERTION ON A FROZEN ONE IS A TEST WITH A FUSE.')
    console.log('  The seeded value is reckoned from the DATABASE clock and the assertion from a')
    console.log('  frozen one, so the two agree only until the date printed above — after which the')
    console.log('  suite asserts the opposite of what it was written to assert, with no commit to')
    console.log('  blame. THE REPAIR IS ONE CLOCK, NOT A BIGGER INTERVAL: widening the interval buys')
    console.log('  time and rebuilds the same bomb with a longer fuse. Derive the seeded value from')
    console.log('  the frozen clock itself — `$n::timestamptz - interval ...` — which makes the drift')
    console.log('  unrepresentable rather than merely distant. G1209, and G1351 for this control.')
  }

  return failures ? 1 : 0
}

/**
 * The main-module guard. `realpathSync` is load-bearing rather than defensive,
 * for the reason `tools/check-g-numbers.mjs` states at length: node resolves
 * symlinks building `import.meta.url` and does not resolve them in
 * `process.argv[1]`, so on any checkout reached through a symlink — macOS's
 * `/tmp` -> `/private/tmp`, which every spawn test here hits — the two strings
 * differ, the CLI does nothing, and it exits 0 while doing it.
 */
function isEntryPoint() {
  const argv1 = process.argv[1]
  if (!argv1) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(argv1)).href
  } catch {
    return import.meta.url === pathToFileURL(argv1).href
  }
}

if (isEntryPoint()) process.exit(main(process.argv.slice(2)))

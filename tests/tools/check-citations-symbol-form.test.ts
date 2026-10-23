import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHECKER = join(ROOT, 'tools', 'check-citations.mjs')

function runChecker(args: readonly string[]): { status: number; stdout: string } {
  const r = spawnSync(process.execPath, [CHECKER, ...args], { cwd: ROOT, encoding: 'utf8' })
  return { status: r.status ?? -1, stdout: r.stdout }
}

test('test_an_unresolvable_symbol_citation_exits_nonzero', () => {
  const probe = join(ROOT, 'tests', 'tools', 'fixtures', 'citations', 'unresolvable.md')
  mkdirSync(dirname(probe), { recursive: true })
  writeFileSync(probe, 'A citation naming nothing: `model/domain.ts#NoSuchDeclaration`.\n')
  try {
    const { status, stdout } = runChecker(['--check-file', probe])
    assert.equal(status, 1, `a symbol citation naming no declaration must fail the gate:\n${stdout}`)
    assert.match(stdout, /NO_SUCH_SYMBOL/)
  } finally {
    rmSync(probe, { force: true })
  }
})

test('test_the_record_as_it_stands_still_exits_zero', () => {
  const { status, stdout } = runChecker([])
  assert.equal(status, 0, `the new symbol verdicts turned the gate red on citations already in the record.\n${stdout}`)
})

test('test_triage_reports_the_buckets_and_never_fails_the_run', () => {
  const { status, stdout } = runChecker(['--triage'])
  assert.equal(status, 0, '--triage is a reading list, not a gate')
  for (const bucket of ['corroborated', 'contradicted', 'uncorroborated', 'unresolved']) {
    assert.match(stdout, new RegExp(bucket, 'i'), `--triage must report ${bucket}`)
  }
})

/**
 * WHY THE TWO TESTS BELOW EXIST. The bucket test above went red on CI while
 * passing on every machine anyone could run it on, and the reason was not that
 * the buckets were wrong: the checker ended with `process.exit()`, which
 * discards stdout still queued for a pipe, so the TRIAGE line was computed,
 * handed to `console.log`, and thrown away on the way out. The bucket test
 * caught it BY ACCIDENT — it happens to assert on the last thing printed.
 *
 * That is not a control, it is a coincidence, so the property is stated
 * directly here: a report that announces N entries must print N entries and
 * must end where it says it ends. The checker declares its own totals in its
 * first line, which makes the assertion self-witnessing — no count is copied
 * into this file.
 */
const TRAILER = '--triage is a non-fatal signal and can have false positives.'

function shortfall(stdout: string): string | null {
  const header = /^Citations resolved: \d+ {2}\(OK (\d+) · SUSPECT (\d+) · DEAD (\d+)\)/m.exec(stdout)
  if (header === null) return 'no header line — the report did not even announce its totals'
  const announced = Number(header[2]) + Number(header[3])
  // `show()` prints each finding as two lines; the second is indented six spaces
  // and carries the cited path. Nothing else in the report is indented that far.
  const printed = (stdout.match(/^ {6}\S/gm) ?? []).length
  if (printed !== announced) return `announced ${announced} SUSPECT+DEAD entries, printed ${printed}`
  if (!stdout.trimEnd().endsWith(TRAILER)) return 'the report does not end with its own closing note'
  return null
}

/**
 * The excerpt is the real thing — the first lines of run 31956377840's stdout,
 * which announced 424 SUSPECT and delivered about 284 of them before the
 * process exited out from under its own output. Trimmed here to two entries;
 * the shortfall is what is being witnessed, not the length.
 */
test('test_a_report_that_stops_short_of_its_own_announced_totals_is_named_as_truncated', () => {
  const truncated = [
    'Citations resolved: 3135  (OK 2710 · SUSPECT 424 · DEAD 0)',
    '  60 skipped — on a line that is narrating a known-dead citation on purpose.',
    '',
    'SUSPECT — 424 resolve to a blank line, a lone brace or a comment marker:',
    '  CLAUDE.md:327',
    '      docs/contracts/control-plane.openapi.yaml:1295  — line is blank',
    '  CLAUDE.md:562',
    '      domain.ts:3194  — line is `*`',
    '',
  ].join('\n')
  assert.equal(
    shortfall(truncated),
    'announced 424 SUSPECT+DEAD entries, printed 2',
    'the guard must name the shortfall on the output that actually shipped from CI',
  )
})

/**
 * THE HEADER MUST ADD UP.
 *
 * It did not, from the day the symbol form landed until 17 Aug 2026: the run
 * announced `Citations resolved: 3135` over `OK 2682 · SUSPECT 452 · DEAD 0`,
 * because `resolveFragment()`'s success verdict is `RESOLVED` and the OK bucket
 * only counted `OK`. The FAILURE verdicts of both citation forms had been
 * unified; the SUCCESS verdicts had not, so every symbol citation that resolved
 * fell out of the tally while staying in the total.
 *
 * One citation was missing at the time, because the record contained exactly one
 * symbol-form citation. That is the reason this is a control rather than a
 * one-off repair: the shortfall is the size of the adoption, and it grows
 * silently. No count is copied into this file — the report's own two statements
 * of the same quantity are compared against each other.
 */
interface Header {
  readonly total: number
  readonly ok: number
  readonly suspect: number
  readonly dead: number
}

function header(stdout: string): Header {
  const m = /^Citations resolved: (\d+) {2}\(OK (\d+) · SUSPECT (\d+) · DEAD (\d+)\)/m.exec(stdout)
  if (m === null) throw new Error(`the report did not announce its totals:\n${stdout.slice(0, 400)}`)
  return { total: Number(m[1]), ok: Number(m[2]), suspect: Number(m[3]), dead: Number(m[4]) }
}

test('test_the_header_total_equals_its_own_buckets', () => {
  const { total, ok, suspect, dead } = header(runChecker([]).stdout)
  assert.equal(
    ok + suspect + dead,
    total,
    `the header announces ${total} live citations but buckets ${ok + suspect + dead}. ` +
      'A verdict the tally does not know about is a citation checked and not reported — ' +
      'see the note on the `ok` filter in tools/check-citations.mjs.',
  )
})

test('test_a_resolving_symbol_citation_is_counted_as_ok', () => {
  const probe = join(ROOT, 'tests', 'tools', 'fixtures', 'citations', 'resolvable.md')
  mkdirSync(dirname(probe), { recursive: true })
  writeFileSync(probe, 'A citation naming a real declaration: `model/access.ts#CAPABILITIES`.\n')
  try {
    const { status, stdout } = runChecker(['--check-file', probe, '--all'])
    assert.equal(status, 0, `a symbol citation that resolves must not fail the gate:\n${stdout}`)
    const { total, ok, suspect, dead } = header(stdout)
    assert.equal(total, 1, `the probe carries exactly one citation:\n${stdout}`)
    assert.equal(ok, 1, `and it resolves, so it belongs in OK:\n${stdout}`)
    assert.equal(ok + suspect + dead, total)
  } finally {
    rmSync(probe, { force: true })
  }
})

test('test_the_triage_report_arrives_whole', () => {
  const { stdout } = runChecker(['--triage'])
  assert.equal(
    shortfall(stdout),
    null,
    `the citation report was cut off before it finished. A checker that reports\n` +
      `less than it computed is a checker whose silence means nothing — see the\n` +
      `note on the last statement of tools/check-citations.mjs.\n${stdout.slice(-400)}`,
  )
})

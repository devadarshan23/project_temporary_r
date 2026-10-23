/**
 * THE PROPERTY: a checker's report must arrive WHOLE.
 *
 * WHY THIS FILE EXISTS. `tools/check-citations.mjs` ended with
 * `process.exit(code)`. `process.exit()` terminates immediately, and when stdout
 * is a PIPE — which it is under `npm run`, under `spawnSync`, and under a CI log
 * collector — the writes `console.log` has already made may still be queued in
 * userspace; exiting discards whatever has not reached the kernel. The exit CODE
 * is unaffected, so the gate still goes red on a real defect. Only the reading
 * matter is lost, and it is lost from the END, which is where every one of these
 * checkers puts its summary.
 *
 * That defect was found on ONE checker and fixed there. It was not one
 * checker's. `tools/` holds NINE real `process.exit(...)` calls across five
 * files — derive it, and note that the naive grep over-counts because it also
 * catches comment lines and `process.exitCode` assignments:
 *
 *   grep -rn 'process\.exit(' tools/ | grep -v 'process\.exitCode' \
 *     | grep -vE ':[0-9]+: *\*' | wc -l          # 9
 *
 * THREE of the nine were TERMINAL — the last statement, after the report had
 * been written, where the two forms differ in nothing but the flush:
 * `check-doc-counts.mjs`'s final line and BOTH arms of `check-pack-safety.mjs`'s
 * `invokedDirectly` block. The pack-safety one sat directly beneath the single
 * `process.stdout.write()` that emits its entire report, and it runs in
 * `npm run check` today. The other six control flow — an early `--derive` exit,
 * a refusal before a partial artefact is emitted, a server teardown — and are
 * deliberately untouched: converting those would let code run that currently
 * cannot.
 *
 * WHAT IS ASSERTED HERE, and in what order of strength:
 *
 *   1. `shortfall()` — a pure predicate: a report that announces N entries must
 *      print N entries and must end where it says it ends. Proven to BITE
 *      against the real truncated bytes both checkers shipped on 17 Aug 2026.
 *   2. A live run of each checker with the pipe reader STALLED. This is the arm
 *      that would have caught the original defect, and it only bites when the
 *      report outgrows the pipe — see the note on the pack-safety probe.
 *
 * MEASURED, not theorised — macOS/node v26, reader stalled 700 ms, this branch:
 *
 *   check-doc-counts, 700 stale counts    166,323 B written
 *       process.exit()        65,418 B delivered — 294 of 763 announced entries
 *       process.exitCode     166,323 B delivered — whole
 *   check-pack-safety, 110 corpora         78,208 B written
 *       process.exit()        65,536 B delivered — 183 of 220 violations, and
 *                                        the `FAIL — …` verdict line never
 *                                        arrived at all
 *       process.exitCode      78,208 B delivered — whole
 *
 * Both forms exited 1 in every run above. The verdict was never the casualty.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOC_COUNTS = join(ROOT, 'tools', 'check-doc-counts.mjs')
const PACK_SAFETY = join(ROOT, 'tools', 'check-pack-safety.mjs')

/**
 * The reader does not read.
 *
 * No 'data' handler is attached and the stream is left paused, so libuv issues
 * no read on the fd at all: the kernel pipe buffer fills and every write after
 * that queues in the CHILD's userspace, which is precisely what `process.exit()`
 * throws away. Draining resumes when the child exits — instant for a checker
 * that discards its queue, and unreachable for one that flushes it, which is why
 * the timer is the second release.
 */
function runStalled(
  argv: readonly string[],
  stallMs = 700,
): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const chunks: Buffer[] = []
    let code: number | null = null
    let released = false
    const release = (): void => {
      if (released) return
      released = true
      child.stdout.on('data', (b: Buffer) => chunks.push(b))
      child.stdout.resume()
    }
    child.stdout.pause()
    child.stderr.resume()
    child.on('error', reject)
    child.on('exit', (c) => {
      code = c
      release()
    })
    child.on('close', () => resolve({ code, out: Buffer.concat(chunks).toString('utf8') }))
    const timer = setTimeout(release, stallMs)
    timer.unref()
  })
}

/** Writes `bytes` down stdout in checker-sized lines, then terminates by `form`. */
const SYNTHETIC = (bytes: number, form: 'exit' | 'code'): readonly string[] => [
  '-e',
  `let w=0;while(w<${bytes}){console.log('x'.repeat(79));w+=80}` +
    (form === 'exit' ? 'process.exit(1)' : 'process.exitCode=1'),
]

/* --- 1. The pure predicates ---------------------------------------------- */

/**
 * `check-doc-counts` announces its totals in its STALE and HISTORICAL headings
 * and prints exactly one `says N, tree says N` line per entry, so the assertion
 * is self-witnessing: no count is copied into this file. The derived block at
 * the top is deliberately not counted — its numbers are right-padded and can
 * reach six leading spaces, which is why the anchor is the sentence and not the
 * indentation.
 */
const DOC_COUNTS_TRAILER = 'Its silence is not evidence of absence — docs/HANDOFF.md §7.'

export function docCountsShortfall(stdout: string): string | null {
  if (!/^Derived from the tree:$/m.test(stdout)) {
    return 'no derived-totals heading — the report did not even start'
  }
  let announced = 0
  for (const m of stdout.matchAll(/^(?:STALE|HISTORICAL) — (\d+) line\(s\)/gm)) {
    announced += Number(m[1])
  }
  const printed = (stdout.match(/^ {2}\S.*: says \d+, tree says \d+$/gm) ?? []).length
  if (printed !== announced) return `announced ${announced} entries, printed ${printed}`
  if (!stdout.trimEnd().endsWith(DOC_COUNTS_TRAILER)) {
    return 'the report does not end with its own closing caveat'
  }
  return null
}

/**
 * `check-pack-safety` ends on a verdict line and nothing else, and a FAIL states
 * its own violation count — which the report then has to have printed.
 */
export function packSafetyShortfall(stdout: string): string | null {
  if (!/^corpora: /m.test(stdout)) return 'no corpora header — the report did not even start'
  const last = stdout.trimEnd().split('\n').at(-1) ?? ''
  const fail = /^FAIL — (\d+) pack-safety violation\(s\); witness ok: (?:true|false)\.$/.exec(last)
  if (fail === null && last !== 'OK — no pack-safety violations.') {
    return `the report does not end on its verdict line; it ends on ${JSON.stringify(last.slice(-60))}`
  }
  if (fail !== null) {
    const printed = (stdout.match(/^VIOLATION {2}\S/gm) ?? []).length
    if (printed !== Number(fail[1])) {
      return `announced ${fail[1]} violations, printed ${printed}`
    }
  }
  return null
}

/**
 * THE BITE. Both excerpts are the real thing: the head of the bytes that
 * actually survived a stalled pipe on 17 Aug 2026 under the unfixed form,
 * trimmed to two entries each. The shortfall is what is being witnessed, not
 * the length — an assertion that cannot name a truncation it was handed is not
 * a control, and the citations checker's bucket test only caught this class by
 * accident, because it happened to assert on the last thing printed.
 */
test('test_a_doc_counts_report_that_stops_short_of_its_announced_totals_is_named', () => {
  const truncated = [
    'Derived from the tree:',
    '     19  modules',
    '     39  capabilities',
    '',
    'STALE — 697 line(s) disagree with the tree and read as current:',
    '  docs/__scale-probe.md:3  capabilities: says 21, tree says 39',
    '      Line 0: there are 21 capabilities in the model, and this sentence is padded out',
    '  docs/__scale-probe.md:4  capabilities: says 22, tree says 39',
    '      Line 1: there are 22 capabilities in the model, and this sentence is padded out',
    '  docs/__scale-probe.md:5  capabilities: says 23, tree s',
  ].join('\n')
  assert.equal(
    docCountsShortfall(truncated),
    'announced 697 entries, printed 2',
    'the guard must name the shortfall on output that a stalled pipe actually delivered',
  )
})

test('test_a_pack_safety_report_that_loses_its_own_verdict_line_is_named', () => {
  const truncated = [
    'corpora:               tests/ci/fixtures/unsafe-procedure-pack.ts',
    'packs read:            110',
    'procedures validated:  110',
    'agents validated:      0',
    'connectors validated:  0',
    'validator rules witnessed: 6',
    '',
    'VIOLATION  admitting_agent_carries_tools  [procedure]',
    '  corpus:  tests/ci/fixtures/unsafe-procedure-pack.ts',
    '  subject: finance_ap v1 · Fixture — untrusted content straight to an outbound step',
    '  detail:  the admit step holds a tool',
    '',
    'VIOLATION  untrusted_to_outbound_without_human  [procedure]',
    '  corpus:  tests/ci/fixtures/unsafe-procedure-pack.ts',
    '  subject: finance_ap v1 · Fixture — untrusted content straight to an outbound step · step pste',
  ].join('\n')
  const verdict = packSafetyShortfall(truncated)
  assert.notEqual(verdict, null, 'a report cut off mid-entry must be named as truncated')
  assert.match(
    String(verdict),
    /does not end on its verdict line/,
    'the pack-safety guard must name the missing verdict, which is the whole point of the report',
  )
})

/** The predicate must not cry truncation over a report that is simply clean. */
test('test_a_whole_report_is_not_named_as_truncated', () => {
  assert.equal(
    packSafetyShortfall(
      [
        'corpora:               model/examples.ts',
        'packs read:            4',
        'procedures validated:  0',
        'agents validated:      0',
        'connectors validated:  1',
        'validator rules witnessed: 6',
        '',
        'OK — no pack-safety violations.',
      ].join('\n'),
    ),
    null,
  )
})

/* --- 2. The live arms ----------------------------------------------------- */

/**
 * The positive control for the harness itself. If a writer that terminates with
 * `process.exit()` is NOT truncated here, then this machine's pipe swallows the
 * whole report and the live arm below proves nothing — which is a thing to be
 * told, not a thing to pass quietly. 500 KB is far past any pipe capacity in
 * use; 64 KB is the figure on both Linux and macOS.
 */
async function stalledPipeTruncates(): Promise<boolean> {
  const size = 500_000
  const { out } = await runStalled(SYNTHETIC(size, 'exit'))
  return out.length < size
}

test('test_the_stalled_reader_harness_does_lose_a_process_exit_writers_tail', async (t) => {
  const size = 500_000
  const [bad, good] = await Promise.all([
    runStalled(SYNTHETIC(size, 'exit')),
    runStalled(SYNTHETIC(size, 'code')),
  ])
  assert.equal(good.code, 1, '`process.exitCode` must still carry the verdict')
  assert.ok(good.out.length >= size, `the exitCode form must arrive whole; got ${good.out.length}`)
  assert.equal(bad.code, 1, 'the exit() form fails identically — the CODE was never the casualty')
  if (bad.out.length >= size) {
    t.skip(
      `this platform's pipe delivered all ${bad.out.length} bytes even from a process.exit(), so ` +
        'the live arms below cannot witness the truncation they exist to catch',
    )
  }
})

/**
 * THE ARM THAT BITES. `--corpus` is repeatable and documented in the checker's
 * own usage block, so the report is inflated through the tool's real interface
 * — no file is written into `docs/` or `model/`, which matters because
 * `node --test` runs test FILES in parallel and `check-doc-counts` and
 * `check-citations` both scan those directories.
 *
 * 110 repeats of the pinned unsafe fixture is 78,208 bytes, comfortably past a
 * 64 KB pipe. Under the unfixed form this delivered 65,536 bytes and lost its
 * verdict line; under the fix it arrives whole.
 */
test('test_pack_safety_reports_whole_through_a_stalled_pipe_and_still_fails', async (t) => {
  if (!(await stalledPipeTruncates())) {
    t.skip('this platform does not truncate a process.exit() writer at 500 KB — see the control above')
    return
  }
  const corpora: string[] = []
  for (let i = 0; i < 110; i += 1) {
    corpora.push('--corpus', 'tests/ci/fixtures/unsafe-procedure-pack.ts')
  }
  const { code, out } = await runStalled([PACK_SAFETY, ...corpora])
  assert.equal(
    packSafetyShortfall(out),
    null,
    'the pack-safety report was cut off before it finished. A checker that reports less than it\n' +
      'computed is a checker whose silence means nothing — see the note on the last statement of\n' +
      `tools/check-pack-safety.mjs.\n${out.slice(-400)}`,
  )
  assert.equal(code, 1, 'a corpus full of violations must still fail the gate')
})

/**
 * The other direction, on the tree as it stands: a clean corpus reports whole
 * AND exits 0. A fix that flushed the report while ceasing to fail the gate
 * would be worse than the defect, so both halves are asserted every time.
 */
test('test_pack_safety_on_the_tree_reports_whole_and_exits_zero', async () => {
  const { code, out } = await runStalled([PACK_SAFETY])
  assert.equal(packSafetyShortfall(out), null, out.slice(-400))
  assert.equal(code, 0, 'trunk carries no pack-safety violation; the clean direction must stay 0')
})

/**
 * ⚠️ WHAT THIS ONE DOES AND DOES NOT PROVE, STATED RATHER THAN IMPLIED.
 * `check-doc-counts` emits 10,960 bytes on trunk today. That fits inside a 64 KB
 * pipe, so this assertion passes under BOTH forms here and cannot witness the
 * truncation — it is a wholeness assertion, not a reproduction. The reproduction
 * for this checker is the measured pair in the header, taken with the report
 * inflated to 166,323 bytes. The margin is 6× and the report grows one entry per
 * stale count; a margin is not a control, which is why the terminal exit was
 * converted rather than left on the grounds that it fits today.
 */
test('test_doc_counts_reports_whole_through_a_stalled_pipe_and_exits_zero', async () => {
  const { code, out } = await runStalled([DOC_COUNTS])
  assert.equal(
    docCountsShortfall(out),
    null,
    `the doc-counts report was cut off before it finished.\n${out.slice(-400)}`,
  )
  assert.equal(code, 0, 'trunk states no STALE count; the clean direction must stay 0')
})

/** `--derive` exits early ON PURPOSE and is one of the six sites left alone. */
test('test_doc_counts_derive_still_short_circuits_and_exits_zero', async () => {
  const { code, out } = await runStalled([DOC_COUNTS, '--derive'])
  assert.equal(code, 0)
  assert.match(out, /capabilities/)
  assert.doesNotMatch(
    out,
    /^Derived from the tree:$/m,
    '`--derive` must still short-circuit before the full report — its process.exit(0) controls flow',
  )
})

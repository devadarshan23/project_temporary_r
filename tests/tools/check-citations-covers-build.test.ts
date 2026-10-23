/**
 * `tools/check-citations.mjs` must scan `docs/build/`.
 *
 * WHY THIS EXISTS. `TARGETS` enumerates `readdirSync(ROOT/docs)` and filters on
 * `.endsWith('.md')`. That call is NON-RECURSIVE, so the directory entry
 * `build` — which does not end in `.md` — is dropped, and all eleven files
 * under `docs/build/` (`ls docs/build/*.md | wc -l` → 11) had no mechanical
 * citation control at all. `docs/build/phase-one-plan.md`'s gate D4 rotted for
 * a day inside that blind spot while `npm run check` stayed green.
 *
 * ⚠️ READ THIS BEFORE TRUSTING A GREEN RUN HERE. Only the first test is red
 * before the widening. The second test PASSES TODAY and is a guard, not
 * evidence: it exists so the widening cannot turn `npm run check` red, and a
 * green second test says nothing whatever about whether `TARGETS` was edited.
 *
 * The assertion deliberately names a file this issue does not touch.
 * `docs/build/phase-one-plan.md` itself contains ZERO citations the tool can
 * match — `grep -cE '[a-zA-Z0-9._/-]+\.(ts|yaml):[0-9]+' docs/build/phase-one-plan.md`
 * → 0, and the CITE regex matches `.ts` and `.yaml` paths only — so a test
 * naming that file could never pass however correct the widening was.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHECKER = join(ROOT, 'tools', 'check-citations.mjs')

function runChecker(args: readonly string[]): { status: number; stdout: string } {
  const r = spawnSync(process.execPath, [CHECKER, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return { status: r.status ?? -1, stdout: r.stdout }
}

test('test_check_citations_resolves_at_least_one_citation_inside_docs_build', () => {
  const { stdout } = runChecker(['--all'])
  assert.ok(
    stdout.includes('docs/build/event-architecture-recommendation.md:'),
    'tools/check-citations.mjs reported no citation sited in docs/build/ — its TARGETS ' +
      'enumeration is still the non-recursive readdirSync over ROOT/docs, so all eleven ' +
      'files under docs/build/ are unscanned. That file holds 35 matchable citations ' +
      "(grep -coE '[a-zA-Z0-9._/-]+\\.(ts|yaml):[0-9]+' docs/build/event-architecture-recommendation.md).",
  )
})

test('test_check_citations_still_exits_zero_after_docs_build_joins_its_targets', () => {
  const { status, stdout } = runChecker([])
  assert.equal(
    status,
    0,
    'tools/check-citations.mjs exited non-zero. It fails on DEAD only, so widening ' +
      'TARGETS to docs/build/ has surfaced a citation that resolves to nothing:\n' +
      stdout,
  )
})

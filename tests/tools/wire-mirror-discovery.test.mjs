/**
 * tools/check-wire-mirror.mjs — WHICH FILES DISCOVERY READS.
 *
 * The checker's discovery walked the repository root recursively and excluded
 * four directory NAMES. `.claude` was not one of them, `.gitignore:27` is
 * `.claude/`, and agent sessions park git worktrees under
 * `.claude/worktrees/<name>/` — each carrying its own
 * `docs/contracts/*.openapi.yaml` from a different commit with a different
 * `model/`. The checker compared those against the current model.
 *
 * These tests build a SCRATCH TREE with exactly that shape and drive the real
 * discovery code over it. Nothing here asserts against a description of the
 * defect: the historical walker is executed with the historical exclusion set
 * and required to go RED, and the shipped discovery is executed over the same
 * bytes on the same disk and required to skip them.
 *
 * Both directions are witnessed, because they fail differently:
 *   false red    a stray DRIFTED contract fails a run that touched neither side
 *   false green  a stray MIRRORED contract adds a PASSING comparison, inflating
 *                `pairsCompared` so the gate claims coverage the tree lacks
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

import {
  REPO_ROOT,
  DRIFT,
  EXCLUDED_DIR_NAMES,
  checkPairs,
  discoverWireFiles,
  discoverWireFilesDetailed,
  walkWireFiles,
} from '../../tools/check-wire-mirror.mjs'

const FIXTURES = path.join(REPO_ROOT, 'tests/tools/fixtures/wire-mirror')

/**
 * The exclusion set as it stood before 17 Aug 2026, typed out rather than
 * imported. This literal is the witness: it is what the checker actually had,
 * and driving the walker with it reproduces the shipped behaviour exactly.
 */
const HISTORICAL_EXCLUDED = new Set(['node_modules', '.git', 'fixtures', '__tests__'])

/** The path an agent session's parked worktree really takes. */
const STRAY_DIR = '.claude/worktrees/beautiful-chandrasekhar-833a4d/docs/contracts'

/** The pair whose model side is fully under this test's control. */
const fixtureLocationPair = {
  name: 'fixture_location',
  model: { file: 'model-fixture.ts', source: 'union', name: 'FixtureLocation' },
  wire: { schema: 'FixtureLocation', path: ['properties', 'kind', 'enum'] },
}

/**
 * A scratch tree shaped like a real checkout: a git repository with `.claude/`
 * ignored, one tracked contract under `docs/contracts/`, and one UNTRACKED
 * contract parked under a stray worktree path.
 *
 * `strayFixture` names which fixture is planted at the stray path — the drifted
 * one for the false-red case, the mirrored one for the false-green case.
 */
function scratchTree(t, strayFixture) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'wire-mirror-discovery-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  mkdirSync(path.join(root, 'docs/contracts'), { recursive: true })
  mkdirSync(path.join(root, STRAY_DIR), { recursive: true })

  copyFileSync(path.join(FIXTURES, 'model-fixture.ts'), path.join(root, 'model-fixture.ts'))
  copyFileSync(
    path.join(FIXTURES, 'mirrored.openapi.yaml'),
    path.join(root, 'docs/contracts/real.openapi.yaml'),
  )
  copyFileSync(path.join(FIXTURES, strayFixture), path.join(root, STRAY_DIR, 'stray.openapi.yaml'))

  writeFileSync(path.join(root, '.gitignore'), '.claude/\n')

  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  git('init', '--quiet', '--initial-branch', 'main')
  git('config', 'user.email', 'test@example.invalid')
  git('config', 'user.name', 'wire mirror discovery test')
  git('add', '--all')
  git('commit', '--quiet', '--no-gpg-sign', '-m', 'scratch tree')

  /* The premise of every assertion below: the stray file is really on the disk
   * and really invisible to git. If either half stops holding, the tests that
   * follow prove nothing. */
  assert.ok(existsSync(path.join(root, STRAY_DIR, 'stray.openapi.yaml')))
  const tracked = git('ls-files', '--cached', '--', '*.openapi.yaml').trim().split('\n').sort()
  assert.deepEqual(tracked, ['docs/contracts/real.openapi.yaml'])

  return root
}

const relativise = (root, files) =>
  files.map((f) => path.relative(root, f).split(path.sep).join('/')).sort()

test('test_the_historical_walker_reads_a_drifted_contract_out_of_a_gitignored_claude_worktree_and_the_run_goes_red', (t) => {
  const root = scratchTree(t, 'stray-worktree-drift.openapi.yaml')

  const walked = relativise(root, walkWireFiles(root, HISTORICAL_EXCLUDED))
  assert.deepEqual(walked, [
    `${STRAY_DIR}/stray.openapi.yaml`,
    'docs/contracts/real.openapi.yaml',
  ])

  const before = checkPairs({
    pairs: [fixtureLocationPair],
    root,
    wireFiles: walkWireFiles(root, HISTORICAL_EXCLUDED),
  })
  const drift = before.findings.filter((f) => f.kind === DRIFT)
  assert.equal(drift.length, 1, 'the historical walker must go RED on the stray contract')
  assert.match(drift[0].file, /^\.claude\/worktrees\//)
  assert.deepEqual(drift[0].extra, ['delta'])
})

test('test_the_shipped_discovery_skips_the_same_bytes_on_the_same_disk_and_the_run_goes_green', (t) => {
  const root = scratchTree(t, 'stray-worktree-drift.openapi.yaml')

  const detailed = discoverWireFilesDetailed(root)
  assert.equal(detailed.source, 'git')
  assert.equal(detailed.notice, null)
  assert.deepEqual(relativise(root, detailed.files), ['docs/contracts/real.openapi.yaml'])

  const after = checkPairs({ pairs: [fixtureLocationPair], root })
  assert.deepEqual(
    after.findings.filter((f) => f.kind === DRIFT),
    [],
    'the tracked tree mirrors the model; only the stray copy did not',
  )
  assert.equal(after.pairsCompared, 1)
  assert.equal(after.discovery.source, 'git')
  assert.equal(after.discovery.fileCount, 1)
})

test('test_a_stray_worktree_that_still_mirrors_the_model_inflates_the_compared_pair_count_which_is_the_false_green_half', (t) => {
  /* The worse half. Nothing goes red, so nobody looks — and the number a reader
   * uses to judge whether the gate asserted anything is twice the truth. */
  const root = scratchTree(t, 'mirrored.openapi.yaml')

  const inflated = checkPairs({
    pairs: [fixtureLocationPair],
    root,
    wireFiles: walkWireFiles(root, HISTORICAL_EXCLUDED),
  })
  assert.deepEqual(inflated.findings.filter((f) => f.kind === DRIFT), [])
  assert.equal(inflated.pairsCompared, 2, 'the stray copy adds a PASSING comparison')
  assert.ok(inflated.comparisons.some((c) => c.file.startsWith('.claude/worktrees/')))

  const honest = checkPairs({ pairs: [fixtureLocationPair], root })
  assert.equal(honest.pairsCompared, 1, 'the tree holds one contract, so the gate compares one')
  assert.ok(!honest.comparisons.some((c) => c.file.startsWith('.claude/worktrees/')))
})

test('test_the_fallback_walker_excludes_claude_and_codex_by_name_so_the_degraded_path_is_not_the_old_defect', (t) => {
  const root = scratchTree(t, 'stray-worktree-drift.openapi.yaml')

  mkdirSync(path.join(root, '.codex/worktrees/3c45/Reconcile/docs/contracts'), { recursive: true })
  copyFileSync(
    path.join(FIXTURES, 'stray-worktree-drift.openapi.yaml'),
    path.join(root, '.codex/worktrees/3c45/Reconcile/docs/contracts/stray.openapi.yaml'),
  )

  for (const name of ['.claude', '.codex']) {
    assert.ok(EXCLUDED_DIR_NAMES.has(name), `${name} must be excluded from the fallback walk`)
  }
  assert.deepEqual(relativise(root, walkWireFiles(root)), ['docs/contracts/real.openapi.yaml'])
})

test('test_discovery_falls_back_loudly_and_non_fatally_when_git_cannot_answer', (t) => {
  /* A directory that is not a repository. `git ls-files` exits non-zero there,
   * which is the same failure shape as `git` being absent from PATH. */
  const root = mkdtempSync(path.join(os.tmpdir(), 'wire-mirror-nogit-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(path.join(root, 'docs/contracts'), { recursive: true })
  copyFileSync(path.join(FIXTURES, 'model-fixture.ts'), path.join(root, 'model-fixture.ts'))
  copyFileSync(
    path.join(FIXTURES, 'mirrored.openapi.yaml'),
    path.join(root, 'docs/contracts/real.openapi.yaml'),
  )

  const detailed = discoverWireFilesDetailed(root)
  assert.equal(detailed.source, 'walk', 'no repository here, so the walker must take over')
  assert.match(detailed.notice ?? '', /DISCOVERY UNAVAILABLE/)
  assert.match(detailed.notice ?? '', /git ls-files/)
  assert.deepEqual(relativise(root, detailed.files), ['docs/contracts/real.openapi.yaml'])

  /* Non-fatal: the degraded run still asserts. It exits 1 only on real drift. */
  const result = checkPairs({ pairs: [fixtureLocationPair], root })
  assert.deepEqual(result.findings.filter((f) => f.kind === DRIFT), [])
  assert.equal(result.discovery.source, 'walk')
})

test('test_the_real_tree_scan_still_refuses_the_committed_fixtures_which_the_git_seed_does_list', (t) => {
  /* The git seed returns the fixtures — they are tracked. The exclusion is what
   * removes them, and it is the same exclusion the walker used. If this stops
   * holding, `npm run check` is permanently red on trunk. */
  const tracked = execFileSync('git', ['ls-files', '--cached', '--', '*.openapi.yaml'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
  assert.ok(
    tracked.some((f) => f.includes('tests/tools/fixtures/wire-mirror/')),
    'the premise of this test is that git DOES list the fixtures',
  )

  for (const file of discoverWireFiles(REPO_ROOT)) {
    assert.ok(!file.split(path.sep).includes('fixtures'), `discovery must not return ${file}`)
  }
})

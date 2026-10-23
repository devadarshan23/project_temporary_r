/**
 * `tools/check-g-numbers.mjs` — the PROCESS, not the seam.
 *
 * The seam suite (`check-g-numbers.test.mjs`) proves the verdicts; this file
 * proves the CLI turns a verdict into an exit code, and that it does so against
 * a real git repository rather than against a hand-passed argument.
 *
 * ⚠️ WHY IT BUILDS A THROWAWAY REPOSITORY. The checker resolves `ROOT` from its
 * own module path, so the only way to drive it over a record other than this
 * repository's is to stand a scratch tree up around a copy of it. The copy is
 * byte-identical (`copyFileSync`), the module has no local imports, and the
 * scratch repository is given a real `refs/remotes/origin/main` and a real fork
 * point — so the merge-base arm is exercised through actual git plumbing, which
 * is the half a hand-passed fixture cannot reach.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHECKER = join(ROOT, 'tools', 'check-g-numbers.mjs')
const FIXTURES = join(ROOT, 'tests', 'tools', 'fixtures', 'g-numbers')

function run(
  cwd: string,
  checker: string,
  env?: Record<string, string>,
  args: readonly string[] = [],
): { status: number; stdout: string } {
  const r = spawnSync(process.execPath, [checker, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(env ?? {}) },
  })
  return { status: r.status ?? -1, stdout: r.stdout }
}

/** A scratch tree holding a copy of the checker and a `docs/HANDOFF.md`. */
function scratchTree(record: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'g-numbers-'))
  mkdirSync(join(dir, 'tools'), { recursive: true })
  mkdirSync(join(dir, 'docs'), { recursive: true })
  copyFileSync(CHECKER, join(dir, 'tools', 'check-g-numbers.mjs'))
  writeFileSync(join(dir, 'docs', 'HANDOFF.md'), record)
  return dir
}

function git(cwd: string, args: readonly string[]): void {
  const r = spawnSync('git', [
    '-c', 'user.name=g-numbers test',
    '-c', 'user.email=g-numbers@example.invalid',
    '-c', 'commit.gpgsign=false',
    ...args,
  ], { cwd, encoding: 'utf8' })
  assert.equal(r.status, 0, `git ${args.join(' ')} — ${r.stderr}`)
}

const fixture = (...parts: string[]): string => readFileSync(join(FIXTURES, ...parts), 'utf8')

test('test_the_checker_exits_zero_on_this_repository_s_own_record', () => {
  const r = run(ROOT, CHECKER)
  assert.equal(r.status, 0, r.stdout)
  assert.match(r.stdout, /^G rows: \d+ · duplicates 0$/m)
})

test('test_the_removed_remote_flag_is_refused_rather_than_ignored', () => {
  // `--remote` was a placeholder that printed "unavailable" and did nothing.
  // Deleting it is only honest if running it now SAYS SO — a silently-ignored
  // flag returns exit 0 and reads as "open branches checked, nothing found".
  const r = run(ROOT, CHECKER, undefined, ['--remote'])
  assert.match(r.stdout, /`--remote` was REMOVED, not renamed/)
  assert.doesNotMatch(r.stdout, /^G rows:/m)
  assert.equal(r.status, 2, r.stdout)

  // …and the gate itself passes no arguments, so this can never fire in CI.
  const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>
  assert.equal(scripts['check:g-numbers'], 'node tools/check-g-numbers.mjs')
  assert.ok(scripts['check']?.includes('check:g-numbers'), 'the checker joins the one gate')
  assert.doesNotMatch(JSON.stringify(scripts), /remote/)
})

test('test_a_duplicate_ruling_number_exits_one_and_names_the_number', () => {
  const dir = scratchTree('| G186 | one |\n| G187 | two |\n| G186 | three |\n')
  try {
    const r = run(dir, join(dir, 'tools', 'check-g-numbers.mjs'))
    assert.match(r.stdout, /DUPLICATE G numbers: 186/)
    assert.equal(r.status, 1, r.stdout)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('test_a_record_with_no_duplicate_and_no_resolvable_trunk_is_loudly_unavailable_and_exits_zero', () => {
  const dir = scratchTree(fixture('m4-amendment', 'branch.md'))
  try {
    // GIT_DIR points at nothing, so neither the merge base nor `origin/main`
    // resolves — the shallow-checkout shape CI is in on every run.
    const r = run(dir, join(dir, 'tools', 'check-g-numbers.mjs'), { GIT_DIR: join(dir, 'absent.git') })
    assert.match(r.stdout, /trunk collision check unavailable \(non-fatal\)/)
    assert.doesNotMatch(r.stdout, /trunk collisions: /)
    assert.equal(r.status, 0, r.stdout)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('test_over_real_git_plumbing_a_number_minted_after_the_fork_exits_one_and_an_amended_row_does_not', () => {
  const dir = scratchTree(fixture('m4-amendment', 'merge-base.md'))
  const checker = join(dir, 'tools', 'check-g-numbers.mjs')
  const record = join(dir, 'docs', 'HANDOFF.md')
  try {
    git(dir, ['init', '-q', '-b', 'work'])
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'the fork point'])

    // Trunk moves on: it amends G61 and mints G62.
    git(dir, ['checkout', '-q', '-b', 'trunkline'])
    writeFileSync(record, fixture('m4-amendment', 'trunk.md'))
    git(dir, ['commit', '-q', '-a', '-m', 'trunk amends G61 and mints G62'])
    git(dir, ['update-ref', 'refs/remotes/origin/main', 'trunkline'])

    // This branch amends G60 in place, leaves G61 at the fork point's text, and
    // mints G62 for a DIFFERENT ruling.
    git(dir, ['checkout', '-q', 'work'])
    writeFileSync(record, fixture('m4-amendment', 'branch.md'))
    git(dir, ['commit', '-q', '-a', '-m', 'branch amends G60 in place and mints its own G62'])

    const r = run(dir, checker)
    assert.match(r.stdout, /trunk collisions: 1 /)
    assert.match(r.stdout, /TRUNK COLLISIONS: 62$/m)
    assert.doesNotMatch(r.stdout, /TRUNK COLLISIONS:.*\b60\b/)
    assert.doesNotMatch(r.stdout, /TRUNK COLLISIONS:.*\b61\b/)
    assert.equal(r.status, 1, r.stdout)

    // …and the same tree with the collision withdrawn is green, so the exit 1
    // above is the verdict and not the scaffolding.
    writeFileSync(record, fixture('m4-amendment', 'branch.md').split('\n').filter(l => !l.startsWith('| G62 ')).join('\n'))
    const green = run(dir, checker)
    assert.match(green.stdout, /trunk collisions: 0 /)
    assert.equal(green.status, 0, green.stdout)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

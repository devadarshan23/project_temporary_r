/**
 * EVERY CHECKER HAS A DENOMINATOR — K4 of `docs/build/completion-plan.md` §6.
 *
 * ┌─ WHY THIS EXISTS, AND IT IS §5.6 IN THE TOOLS WRITTEN TO CATCH §5.6 ───────┐
 * │ A checker that reports success over ZERO INPUTS is indistinguishable from  │
 * │ one that works. K4 names six; **the measurement found FIVE, and finding    │
 * │ the sixth on the right side of the line is itself part of the result.**    │
 * │ Each of the five was witnessed printing success at EXIT 0 over nothing,    │
 * │ in a sandbox, before its guard was written:                                │
 * │                                                                            │
 * │   check-migration-numbers  `✔ db/migrations — 0 migrations, 0 distinct      │
 * │                            numbers` × 2, EXIT 0                            │
 * │   check-c4-freshness       `OK  C4 artefacts match the tree — 0 modules,   │
 * │                            0 import edges, 0 exports …`, EXIT 0            │
 * │   check-g-numbers          `G rows: 0 · duplicates 0`, EXIT 0               │
 * │   check-citations          `Citations resolved: 0  (OK 0 · SUSPECT 0 ·      │
 * │                            DEAD 0)`, EXIT 0                                │
 * │   check-wire-mirror        `0 pair(s) compared.` then `DRIFT (0). Every    │
 * │                            compared pair mirrors its model declaration`,   │
 * │                            EXIT 0                                          │
 * │                                                                            │
 * │ **Read the last one twice.** `DRIFT (0)` over zero comparisons is a TRUE   │
 * │ sentence about an empty set, printed in the vocabulary of an all-clear.    │
 * │ That is the whole class.                                                   │
 * │                                                                            │
 * │ 🛑 `check-doc-counts` WAS ON THE LIST AND IS NOT ONE, AND THAT IS RECORDED │
 * │ RATHER THAN QUIETLY DROPPED. Its derivations THROW on a broken subject —  │
 * │ `ENOENT … model/access.ts` over an empty directory, `CAPABILITIES not     │
 * │ found in model/access.ts` over present-but-empty files — so it already    │
 * │ failed closed. It gained a printed denominator and a documented tripwire   │
 * │ and is asserted here on the FAIL-CLOSED property instead (§4).             │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE DENOMINATOR OF THE DENOMINATORS ─────────────────────────────────────┐
 * │ §1 derives the checker set from `package.json` and requires it to equal    │
 * │ the registry below EXACTLY. **A new checker with no entry is a red**, so   │
 * │ this file cannot itself become the defect it is about — which is the      │
 * │ failure `tools/check-clock-fixtures.mjs` records finding in its own test   │
 * │ corpus on the first run, and the reason `tests/ci/gate.test.ts` keeps its  │
 * │ vacuity vocabulary as an exact `deepEqual`.                                │
 * │                                                                            │
 * │ ⚠️ THE PATTERNS ARE TYPED INTO THIS FILE AND NOT IMPORTED. Comparing a    │
 * │ checker's output to a string the checker exports is a comparison that      │
 * │ passes when both sides are empty — the discipline stated at the head of    │
 * │ `tests/ci/gate.test.ts` and `tests/tools/check-wire-mirror.test.mjs`.      │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, cpSync, symlinkSync, renameSync } from 'node:fs'
import { spawnSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * ONE ROW PER CHECKER: the file it runs, and a pattern its stdout must carry
 * on the real tree. `subject` names, in words, what the denominator counts —
 * it is there so a reader meeting a red knows which derivation broke.
 */
const DENOMINATOR = {
  'check:counts': {
    file: 'check-doc-counts.mjs',
    subject: 'documents scanned and governed totals derived',
    pattern: /Scanned \d+ document\(s\) for \d+ governed total\(s\)\./,
  },
  'check:citations': {
    file: 'check-citations.mjs',
    subject: 'documents scanned and citations found',
    pattern: /Citations: \d+ document\(s\) scanned; \d+ found\./,
  },
  'check:wire': {
    file: 'check-wire-mirror.mjs',
    subject: 'contract files discovered and pairs compared',
    pattern: /wire mirror: \d+ contract file\(s\).*?; \d+ pair\(s\) compared\./,
  },
  'check:packs': {
    file: 'check-pack-safety.mjs',
    subject: 'packs, procedures, agents, connectors and classification rules validated',
    pattern: /pack|procedure|agent|connector|classification/i,
  },
  'check:c4': {
    file: 'check-c4-freshness.mjs',
    subject: 'modules, edges, exports, built tables and RLS policies',
    pattern: /\d+ modules, \d+ import edges, \d+ exports/,
  },
  'check:g-numbers': {
    file: 'check-g-numbers.mjs',
    subject: 'G rows parsed from the record',
    pattern: /G rows: \d+ /,
  },
  'check:migrations': {
    file: 'check-migration-numbers.mjs',
    subject: 'migration files and distinct numbers, per sequence',
    pattern: /\d+ migrations, \d+ distinct numbers/,
  },
  'check:absent-rows': {
    file: 'check-absent-rows.mjs',
    subject: 'module tables registered and modules derived',
    pattern: /module tables: \d+ registered · \d+ modules derived/,
  },
  'check:annotations': {
    file: 'check-capability-annotations.mjs',
    subject: 'operations walked across contract documents',
    pattern: /\d+ declared operation\(s\)/,
  },
  'check:clocks': {
    file: 'check-clock-fixtures.mjs',
    subject: 'files scanned, and each ingredient separately',
    pattern: /\d+ file\(s\) scanned/,
  },
  /**
   * FOUR numbers and not one, because three of them can go to zero
   * independently and each zero is a different broken run: no corpus, no
   * parseable command, and a command set that matched nothing in the tree.
   * The checker refuses all three — `REFUSING A ZERO SUBJECT` — which §5
   * witnesses against an empty directory.
   */
  'check:derivations': {
    file: 'check-self-measuring-derivations.mjs',
    subject: 'files scanned, commands quoted, commands evaluated and match lines examined',
    pattern:
      /self-measuring derivations: \d+ file\(s\) scanned; \d+ command\(s\) quoted; \d+ evaluable; \d+ match line\(s\) examined\./,
  },
}

function scripts() {
  return JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts ?? {}
}

function run(file, args = [], cwd = REPO) {
  const result = spawnSync(process.execPath, [join(cwd, 'tools', file), ...args], {
    cwd,
    encoding: 'utf8',
  })
  return {
    status: result.status ?? -1,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

/** A throwaway tree holding only what one checker needs. Always removed. */
function sandbox(build) {
  const dir = mkdtempSync(join(tmpdir(), 'reconcile-k4-'))
  try {
    return build(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function withTool(dir, file, extra = []) {
  mkdirSync(join(dir, 'tools'), { recursive: true })
  cpSync(join(REPO, 'tools', file), join(dir, 'tools', file))
  for (const other of extra) cpSync(join(REPO, 'tools', other), join(dir, 'tools', other))
}

// ------------------------------------------- 1. the registry covers every checker

test('§1 · every `check:*` script has a denominator entry, and every entry is a script', () => {
  const derived = Object.keys(scripts()).filter((k) => k.startsWith('check:')).sort()
  assert.ok(derived.length > 0, 'no `check:*` scripts found — the derivation broke, not the registry')

  assert.deepEqual(
    derived,
    Object.keys(DENOMINATOR).sort(),
    'THE CHECKER SET AND THIS REGISTRY DISAGREE. A checker with no entry here is a ' +
      'checker nobody has asked "what does it count?", which is exactly the state ' +
      'docs/build/completion-plan.md K4 found five of them in. Add the row, with the ' +
      'pattern its output carries and a sentence naming its subject.',
  )

  /* And each entry names the file its script actually runs — a registry keyed
     on a script name could otherwise drift from the file it describes. */
  for (const [name, row] of Object.entries(DENOMINATOR)) {
    assert.equal(
      scripts()[name],
      `node tools/${row.file}`,
      `${name} does not run tools/${row.file}`,
    )
  }
})

// --------------------------------------- 2. each one prints its denominator

test('§2 · every checker prints its denominator on a real run', async () => {
  /* TEN REAL PROCESSES, IN PARALLEL, AND THE PARALLELISM IS G108's CONDITION
     RATHER THAN A FLOURISH. Serially this section took 15–20s, because
     `check:c4` and `check:counts` each build a whole TypeScript program; the
     gate slows as checkers accumulate and one slow stage blocks everything.
     Nothing about the CONTROL changes — each checker is still run for real,
     against the real tree, and its own stdout is still what is read. A
     source-level grep for the print statement would be faster and would be
     §5.1: a rule keyed on the line that writes the number instead of on the
     number reaching stdout. */
  const results = await Promise.all(
    Object.entries(DENOMINATOR).map(
      ([name, row]) =>
        new Promise((resolve) => {
          const child = spawn(process.execPath, [join(REPO, 'tools', row.file)], {
            cwd: REPO,
            encoding: 'utf8',
          })
          let out = ''
          child.stdout.on('data', (d) => { out += d })
          child.stderr.on('data', (d) => { out += d })
          child.on('close', () => resolve([name, row, out]))
          child.on('error', (err) => resolve([name, row, `SPAWN FAILED: ${String(err)}`]))
        }),
    ),
  )

  const missing = []
  for (const [name, row, out] of results) {
    if (!row.pattern.test(out)) {
      missing.push(`${name} (${row.subject}) — ${row.pattern} did not match its output`)
    }
  }
  assert.deepEqual(
    missing,
    [],
    'A checker ran and never said how much it had read:\n  ' +
      missing.join('\n  ') +
      '\nA number printed on every run is what lets a person notice a subject that ' +
      'shrank to nothing. Restore the line; do not relax the pattern.',
  )
})

// ------------------------- 3. the five that were vacuous-green now refuse

test('§3a · check-migration-numbers refuses two EMPTY sequences', () => {
  const { status, out } = sandbox((dir) => {
    withTool(dir, 'check-migration-numbers.mjs')
    mkdirSync(join(dir, 'db', 'migrations'), { recursive: true })
    mkdirSync(join(dir, 'db', 'migrations-control'), { recursive: true })
    return run('check-migration-numbers.mjs', [], dir)
  })
  assert.equal(status, 1, `expected refusal over an empty subject; got:\n${out}`)
  assert.match(out, /NO MIGRATIONS FOUND/)
  assert.ok(
    !/✔ db\/migrations — 0 migrations/.test(out),
    'the captured red was a TICK over zero files; it must not still print one',
  )
})

test('§3b · check-g-numbers refuses a record that parses to zero rows', () => {
  const { status, out } = sandbox((dir) => {
    withTool(dir, 'check-g-numbers.mjs')
    mkdirSync(join(dir, 'docs'), { recursive: true })
    writeFileSync(join(dir, 'docs', 'HANDOFF.md'), '# a record with no G rows\n')
    return run('check-g-numbers.mjs', [], dir)
  })
  assert.equal(status, 1, `expected refusal over zero rows; got:\n${out}`)
  assert.match(out, /NO G ROWS PARSED/)
})

test('§3c · check-citations refuses a corpus it could not read, and one with no citations', () => {
  /* TWO ARMS, BECAUSE THEY FAIL SEPARATELY. Zero documents means the TARGETS
     enumeration broke; a readable corpus with zero citations means the two
     regexes did. A guard on the first alone passes the second.

     ⚠️ THE CHECKER IS RENAMED IN THE SANDBOX, AND THAT IS NOT A TRICK — it
     is in its own TARGETS list and would otherwise scan itself, which makes
     the zero-document state unreachable. Renaming is how the arm is reached;
     the arm is real, and it is what fires if TARGETS ever stops resolving. */
  const zeroDocuments = sandbox((dir) => {
    withTool(dir, 'check-citations.mjs', ['citation-symbols.mjs'])
    renameSync(join(dir, 'tools', 'check-citations.mjs'), join(dir, 'tools', 'probe.mjs'))
    mkdirSync(join(dir, 'docs', 'build'), { recursive: true })
    mkdirSync(join(dir, 'docs', 'contracts'), { recursive: true })
    return run('probe.mjs', [], dir)
  })
  assert.equal(zeroDocuments.status, 1, `expected refusal over zero documents; got:\n${zeroDocuments.out}`)
  assert.match(zeroDocuments.out, /NO DOCUMENTS READ/)

  const zeroCitations = sandbox((dir) => {
    withTool(dir, 'check-citations.mjs', ['citation-symbols.mjs'])
    renameSync(join(dir, 'tools', 'check-citations.mjs'), join(dir, 'tools', 'probe.mjs'))
    mkdirSync(join(dir, 'docs', 'build'), { recursive: true })
    mkdirSync(join(dir, 'docs', 'contracts'), { recursive: true })
    writeFileSync(join(dir, 'CLAUDE.md'), 'prose with no citation in it at all\n')
    return run('probe.mjs', [], dir)
  })
  assert.equal(zeroCitations.status, 1, `expected refusal over zero citations; got:\n${zeroCitations.out}`)
  assert.match(zeroCitations.out, /NOT ONE CITATION FOUND/)
})

test('§3d · check-wire-mirror refuses a run that compared no pair', () => {
  /* NO SANDBOX NEEDED, AND THE REASON IS ITSELF K3's POINT: `--wire` replaces
     contract discovery, so pointing it at a real file that registers no pair
     reproduces the zero-comparison state exactly, in the real tree. That flag
     is one of the five the gate is forbidden from passing. */
  const { status, out } = run('check-wire-mirror.mjs', ['--wire', 'docs/contracts/errors.yaml'])
  assert.equal(status, 1, `expected refusal over zero comparisons; got:\n${out}`)
  assert.match(out, /NOT ONE PAIR COMPARED/)
  assert.match(
    out,
    /DRIFT \(0\)/,
    'the all-clear sentence must still be PRINTED — the defect was that it was the ' +
      'last word. Keeping it visible above the refusal is what shows a reader why the ' +
      'old green was misleading.',
  )
})

test('§3e · check-c4-freshness refuses an empty model, and names all three subjects', () => {
  const { status, out } = sandbox((dir) => {
    withTool(dir, 'check-c4-freshness.mjs')
    cpSync(join(REPO, 'tools', 'planner'), join(dir, 'tools', 'planner'), { recursive: true })
    mkdirSync(join(dir, 'model'), { recursive: true })
    mkdirSync(join(dir, 'db', 'migrations'), { recursive: true })
    mkdirSync(join(dir, 'docs'), { recursive: true })
    /* The parser is a pinned devDependency and is resolved from wherever this
       checkout actually installed it — a git worktree has none of its own. */
    mkdirSync(join(dir, 'node_modules'), { recursive: true })
    const typescriptDir = join(
      createRequire(import.meta.url).resolve('typescript').split(`${'typescript'}/`)[0],
      'typescript',
    )
    symlinkSync(typescriptDir, join(dir, 'node_modules', 'typescript'), 'dir')
    return run('check-c4-freshness.mjs', [], dir)
  })
  assert.equal(status, 1, `expected refusal over an empty model; got:\n${out}`)
  assert.match(out, /VACUOUS/)
  assert.match(out, /NO MODULES/)
  assert.ok(
    !/^OK /m.test(out),
    'the captured red printed `OK  C4 artefacts match the tree — 0 modules …`; it must not still',
  )
})

// ------------------------------- 4. the one that was never vacuous-green

test('§4 · check-doc-counts FAILS CLOSED rather than reporting zero, which is why it is not in §3', () => {
  /* K4 names six checkers and this is the sixth. It does not belong in §3 and
     the reason is a measurement rather than an opinion: its derivations THROW
     on a broken subject. Asserting that here is what stops a later tidy-up —
     "return 0 instead of throwing", which reads like defensive coding — from
     silently moving it onto the wrong side of the line. */
  const { status, out } = sandbox((dir) => {
    withTool(dir, 'check-doc-counts.mjs')
    cpSync(join(REPO, 'tools', 'planner'), join(dir, 'tools', 'planner'), { recursive: true })
    mkdirSync(join(dir, 'model'), { recursive: true })
    mkdirSync(join(dir, 'docs', 'contracts'), { recursive: true })
    return run('check-doc-counts.mjs', [], dir)
  })
  assert.notEqual(status, 0, `an absent subject must not be EXIT 0; got:\n${out}`)
  assert.ok(
    !/Derived from the tree:/.test(out) || /VACUOUS|NO DOCUMENTS|EVERY DERIVED TOTAL/.test(out),
    'it must not print a derivation table over a subject it could not read',
  )
})

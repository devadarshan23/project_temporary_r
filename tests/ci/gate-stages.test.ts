/**
 * THE GATE'S OWN STAGES — K2 and K3 of `docs/build/completion-plan.md` §6.
 *
 * ┌─ WHY THIS EXISTS, AND IT WAS MEASURED RATHER THAN FEARED ─────────────────┐
 * │ Every control in this repository is downstream of `npm run check` actually │
 * │ running what it claims to run. On 21 Sep 2026 it claimed SEVENTEEN stages  │
 * │ and ELEVEN of them were pinned by no assertion anywhere. Six were:         │
 * │ `typecheck:infra` and `synth:infra` (tests/infra/manifest.test.mjs),       │
 * │ `check:packs` and `npm test` (tests/ci/gate.test.ts), `check:g-numbers`    │
 * │ (tests/tools/check-g-numbers-exit.test.ts) and `check:clocks`              │
 * │ (tests/tools/check-clock-fixtures.test.mjs). The other eleven could be     │
 * │ DELETED FROM `scripts.check` AND THE GATE WOULD BE EXIT 0 WITH EVERYTHING  │
 * │ GREEN.                                                                     │
 * │                                                                            │
 * │ 🛑 WITNESSED, NOT REASONED. `npm run check:migrations` was removed from    │
 * │ `scripts.check` — leaving sixteen stages — and the full gate was run:      │
 * │ **EXIT 0**, `fail 0`, with the skip census reporting *"no suite stood down │
 * │ on this run."* Nothing anywhere noticed that a checker had left the gate.  │
 * │ A checker standing beside `npm run check` rather than inside it is G108's  │
 * │ named refusal, and until this file nothing could tell the two apart.       │
 * │                                                                            │
 * │ ⚠️ AND IT IS ALSO WHY `CLAUDE.md`'s "SEVENTEEN stages" FENCE KEEPS GOING   │
 * │ STALE. That page records the value being wrong at ELEVEN, FOURTEEN,        │
 * │ FIFTEEN and SIXTEEN, each time swept by a person who happened to look.     │
 * │ **The point of this file is that the count should stop being a number      │
 * │ somebody remembers to update.** `tools/check-doc-counts.mjs` now derives   │
 * │ `gate stages` and `checkers` from `package.json`, so a stale figure in     │
 * │ prose is a gate failure; this file pins the SET, which a count cannot see. │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY A LITERAL LIST AND NOT A RULE ───────────────────────────────────────┐
 * │ `REQUIRED_STAGES` below is typed into this file, in order, and compared    │
 * │ with `deepEqual`. That is deliberate and it is the discipline              │
 * │ `tests/tools/check-absent-rows.test.mjs` argues: **a registry compared to  │
 * │ itself passes when the registry is empty.** Deriving the expected stages   │
 * │ from `package.json` and comparing them to `package.json` would assert      │
 * │ nothing at all.                                                            │
 * │                                                                            │
 * │ The cost is that adding a stage is a red here. That is the point: a stage  │
 * │ is a change to what green MEANS, and it should cost a deliberate edit and  │
 * │ a sentence, exactly as a new `AssertNoTextDeep` site does.                 │
 * │                                                                            │
 * │ ⚠️ ORDER IS PART OF THE CLAIM. `tests/infra/manifest.test.mjs` already     │
 * │ requires `typecheck:infra` before `synth:infra`, and states why: `cdk      │
 * │ synth` strips types without checking them, so a type error surfaces inside │
 * │ CDK rather than at the compiler. The same argument runs the length of the  │
 * │ list — the cheap checks come first so a contributor meets the cheapest     │
 * │ red first. A `deepEqual` on the array carries that for free.               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ K3 — AND IT GOVERNS THE PROPERTY, NOT THE TWO FLAG NAMES ────────────────┐
 * │ K3 asks for one assertion: that `scripts['check:citations']` does not      │
 * │ carry `--triage`, which forces exit 0. Naming that flag would be §5.1 —    │
 * │ a rule keyed on a landmark instead of the property it protects — so what   │
 * │ is asserted instead is that **no `check:*` script passes any argument at   │
 * │ all**. Measured, there are at least FIVE flags across these ten checkers   │
 * │ that would narrow or neuter a gate stage, and only one of them is in K3's  │
 * │ text:                                                                      │
 * │                                                                            │
 * │   --triage      check-citations   forces `process.exitCode = 0` outright   │
 * │   --check-file  check-citations   replaces the whole corpus with one path  │
 * │   --corpus      check-pack-safety replaces the pack corpus                 │
 * │   --pairs       check-wire-mirror narrows the comparison set               │
 * │   --wire        check-wire-mirror replaces contract discovery              │
 * │                                                                            │
 * │ A list of five is a list that is one short the day somebody adds a sixth.  │
 * │ **The property is: the gate's checkers run bare.**                         │
 * │                                                                            │
 * │ 🛑 AND THE ASSERTION IS PAIRED WITH A POSITIVE CONTROL, BECAUSE A RULE     │
 * │ ABOUT FLAGS THAT NOBODY COULD USE IS §5.6. §3b drives the SAME input       │
 * │ through `check-citations.mjs` twice and requires the verdicts to DIFFER:   │
 * │ bare → EXIT 1 on a dead citation, `--triage` → EXIT 0 on the same one.     │
 * │ Without that pair, §3a would pass just as happily against a checker whose  │
 * │ flags did nothing.                                                         │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * EVERY STAGE OF `npm run check`, IN ORDER. Typed here, not derived.
 *
 * To change this list you are changing what a green gate means. Say why, in
 * the commit and in `docs/HANDOFF.md`, and sweep `CLAUDE.md`'s stage count in
 * the same commit (§5.11) — `node tools/check-doc-counts.mjs` will tell you
 * which lines moved.
 */
const REQUIRED_STAGES = [
  'npm run typecheck',
  'npm run typecheck:server',
  'npm run typecheck:frontend',
  'npm run typecheck:infra',
  'npm run synth:infra',
  'npm run check:counts',
  'npm run check:citations',
  'npm run check:wire',
  'npm run check:packs',
  'npm run check:c4',
  'npm run check:g-numbers',
  'npm run check:migrations',
  'npm run check:absent-rows',
  'npm run check:annotations',
  'npm run check:clocks',
  'npm run check:derivations',
  'npm run build:frontend',
  'npm test',
] as const

interface Manifest {
  scripts: Record<string, string>
}

function manifest(): Manifest {
  return JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as Manifest
}

function stages(): string[] {
  return (manifest().scripts['check'] ?? '').split('&&').map((s) => s.trim()).filter((s) => s.length > 0)
}

/** Every `check:*` script name, derived from the manifest. */
function checkerScripts(): string[] {
  return Object.keys(manifest().scripts).filter((k) => k.startsWith('check:')).sort()
}

// --------------------------------------------------- K2 · the stages are pinned

test('K2 · every stage of `npm run check` is pinned here, in order', () => {
  const actual = stages()

  /* ANTI-VACUITY FIRST. An unparsed or renamed `check` script yields `[]`, and
     a `deepEqual` of `[]` against a non-empty literal does fail — but it fails
     with a message about the literal rather than about the script, and the
     next reader edits the literal. Say which side broke. */
  assert.ok(
    actual.length > 0,
    '`scripts.check` is absent or did not split on `&&` — nothing below is about the gate',
  )

  assert.deepEqual(
    actual,
    [...REQUIRED_STAGES],
    'THE GATE’S STAGE LIST CHANGED. Eleven of these were pinned by no assertion at all ' +
      'until 21 Sep 2026, and deleting one was measured to leave `npm run check` EXIT 0 ' +
      'with everything green. If a stage was added or removed on purpose, change ' +
      'REQUIRED_STAGES here, say why in the commit, and sweep CLAUDE.md’s stage count in ' +
      'the same commit (§5.11).',
  )
})

test('K2 · the stage count is what CLAUDE.md is checked against, and it is derived', () => {
  /* The number itself is governed by `tools/check-doc-counts.mjs` as
     `gate stages`, so a stale figure in prose fails `check:counts`. This
     asserts the two agree — the checker derives from `package.json` and so
     does this, but from the OTHER side of the `&&` split, which is what makes
     the comparison worth making rather than circular. */
  const derived = spawnSync(process.execPath, ['tools/check-doc-counts.mjs', '--derive'], {
    cwd: REPO,
    encoding: 'utf8',
  })
  assert.equal(derived.status, 0, `--derive failed: ${derived.stderr}`)

  const row = /^\s*(\d+)\s+gate stages\s*$/m.exec(derived.stdout)
  assert.ok(
    row !== null,
    '`check-doc-counts --derive` reports no `gate stages` total. That metric is what ' +
      'makes CLAUDE.md’s stage count a gate failure instead of a number somebody ' +
      `remembers to update. Output was:\n${derived.stdout}`,
  )
  assert.equal(Number(row[1]), REQUIRED_STAGES.length)
})

test('K2 · every checker script is INSIDE the gate, not beside it', () => {
  /* G108: "a new checker joins `npm run check`; it does not stand beside it."
     The literal list above cannot catch this on its own — a checker authored
     and never wired in is absent from BOTH sides and both stay consistent.
     This derives the checker set from the manifest and demands each appear. */
  const scripts = checkerScripts()
  assert.ok(scripts.length > 0, 'no `check:*` scripts found in package.json — the derivation broke')

  const inGate = new Set(stages())
  const missing = scripts.filter((name) => !inGate.has(`npm run ${name}`))
  assert.deepEqual(
    missing,
    [],
    `checker script(s) exist and are NOT stages of \`npm run check\`: ${missing.join(', ')}. ` +
      'G108 is explicit that a checker joins the one gate rather than standing beside it — ' +
      'a checker nobody runs is a comment.',
  )
})

test('K2 · and nothing in the gate names a checker that does not exist', () => {
  /* The other direction. A stage naming a deleted script makes `npm run check`
     fail loudly, so this is not about silence — it is about the list above
     staying honest when somebody renames a checker and sweeps one side only. */
  const scripts = manifest().scripts
  const unresolved = stages()
    .map((s) => s.replace(/^npm (run )?/, ''))
    .filter((name) => !Object.hasOwn(scripts, name))
  assert.deepEqual(unresolved, [], `gate stage(s) name no script: ${unresolved.join(', ')}`)
})

test('K2 · the suite runs inside the gate, and it type-checks the suite first', () => {
  /* `npm test` is ONE stage carrying TWO things, which is the one place the
     list above under-describes the gate. Both are pinned here rather than left
     to the stage name. */
  const testScript = manifest().scripts['test'] ?? ''
  assert.match(
    testScript,
    /\btypecheck:tests\b/,
    '`npm test` must type-check `tests/` before running it; otherwise the fifth ' +
      'TypeScript project is in the gate in name only',
  )
  assert.match(testScript, /node --test\b/, '`npm test` must run the node test runner')
})

// ------------------------------------- K3 · no gate stage forces its own exit 0

test('K3 · no checker stage passes an argument of any kind', () => {
  /* THE PROPERTY, NOT THE FLAG NAMES. See the header: at least five distinct
     flags across these checkers would narrow or neuter a stage, and a rule
     naming `--triage` and `--corpus` is one short the day a sixth lands. */
  const scripts = manifest().scripts
  const offenders: string[] = []
  for (const name of checkerScripts()) {
    const body = (scripts[name] ?? '').trim()
    if (!/^node tools\/[A-Za-z0-9._-]+\.mjs$/.test(body)) {
      offenders.push(`${name} = ${JSON.stringify(body)}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A `check:*` script is not a bare `node tools/<checker>.mjs`:\n  ' +
      offenders.join('\n  ') +
      '\nEvery argument these checkers accept either narrows the corpus or forces the ' +
      'exit code — `--triage` sets `process.exitCode = 0` outright, `--check-file`, ' +
      '`--corpus`, `--pairs` and `--wire` each replace or shrink the subject. The gate ' +
      'runs them BARE. If a stage genuinely needs an argument, that is a ruling, and it ' +
      'owes an argument here about why the flag cannot make the stage vacuous.',
  )
})

test('K3 · --triage really does force exit 0, so the rule above guards something real', () => {
  /* THE POSITIVE CONTROL, AND IT IS THE HALF THAT MAKES §3a WORTH ANYTHING.
     The SAME input, twice, verdicts required to DIFFER. Without this, §3a
     passes just as happily against a checker whose flags are inert — which is
     §5.6 arriving inside the assertion written against it.

     The fixture is a file OUTSIDE the scanned corpus, reached through
     `--check-file`, so nothing is written into the tree and the run stays
     deterministic and offline. That flag is itself one of the five. */
  const dir = mkdtempSync(join(tmpdir(), 'reconcile-k3-'))
  try {
    const fixture = join(dir, 'one-citation.md')
    /* A citation that cannot resolve: a real module at a line it does not have.
       The word "dead" is deliberately absent — `check-citations` skips a line it
       reads as NARRATING a known-dead citation, which is correct behaviour and
       would make this fixture inert. */
    writeFileSync(fixture, 'See `model/access.ts:999999` for the rule.\n')

    const run = (args: readonly string[]) =>
      spawnSync(process.execPath, ['tools/check-citations.mjs', '--check-file', fixture, ...args], {
        cwd: REPO,
        encoding: 'utf8',
      })

    const bare = run([])
    const triaged = run(['--triage'])

    assert.equal(
      bare.status,
      1,
      'the fixture must be REFUSED bare, or this control is measuring nothing. ' +
        `stdout=${bare.stdout}`,
    )
    assert.equal(
      triaged.status,
      0,
      'the same input under `--triage` must be accepted — that is the defect K3 ' +
        `names, and if it no longer holds, say so here rather than deleting the pair. stdout=${triaged.stdout}`,
    )
    assert.notEqual(
      bare.status,
      triaged.status,
      'one flag changed a refusal into an acceptance; that is why no gate stage may carry one',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('K3 · and the gate’s own citations stage is the bare invocation', () => {
  /* K3's literal request, kept as well as generalised. The general rule above
     is what will still be true when a sixth flag lands; this line is what a
     reader greps for when they arrive from the completion plan. */
  assert.equal(manifest().scripts['check:citations'], 'node tools/check-citations.mjs')
  assert.ok(!(manifest().scripts['check:citations'] ?? '').includes('--triage'))
})

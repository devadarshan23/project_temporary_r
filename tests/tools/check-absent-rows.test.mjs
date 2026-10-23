/**
 * G242 — the absent-row checker, and the negative controls that make it real.
 *
 * WHAT THIS FILE IS DEFENDING. `tools/check-absent-rows.mjs` compares a module
 * table against `model/*.ts` and fails on a module with no row. The whole value
 * of that is in the failing, so the risk is not that it goes red wrongly — it
 * is that it goes GREEN having compared nothing. Three ways it could:
 *
 *   1 · The table is never LOCATED. An anchor rots, `locateTable` finds
 *       nothing, and a checker that skipped its only site exits 0. This is why
 *       an unlocatable site is a hard failure in the checker AND asserted here
 *       against the real tree, per site, by name.
 *   2 · The row reader reads the FILE rather than the ROWS. Every module name
 *       in these documents appears in prose somewhere, so a scan of the whole
 *       file finds all nineteen and always passes. Both drifted fixtures carry
 *       the deleted or phantom name in prose on purpose, so a file-scanning
 *       implementation fails the pair rather than passing it.
 *   3 · The comparison runs over an empty module list. Asserted non-zero, and
 *       asserted in the checker too.
 *
 * EVERY REJECTION BELOW IS PAIRED WITH A POSITIVE CONTROL on a fixture
 * differing only in the defect — `complete.md` versus `dropped-row.md` versus
 * `phantom-row.md`, one row apart each. A checker that fails unconditionally
 * fails the pair; one that passes unconditionally fails it from the other side.
 * `tests/ci/gate.test.ts` argues this at length and it is the same argument.
 *
 * ⚠️ THE EXPECTED SITE LIST BELOW IS A LITERAL TYPED INTO THIS FILE. It is not
 * imported from the checker. Comparing the registry to itself is a comparison
 * that passes when the registry is empty — the failure mode this repository
 * cannot otherwise detect, and the reason a site cannot be quietly dropped from
 * `MODULE_TABLES` without turning this test red.
 *
 * EXIT CODES COME FROM `spawnSync`, NEVER FROM A PIPE. A piped status is the
 * pipe's, which is 0, and reads exactly like success.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

import {
  MODULE_TABLES,
  deriveModules,
  locateTable,
  auditModuleTable,
} from '../../tools/check-absent-rows.mjs'

const REPO = resolve(import.meta.dirname, '..', '..')
const CHECKER = join(REPO, 'tools', 'check-absent-rows.mjs')

const fixture = (name) =>
  readFileSync(join(REPO, 'tests', 'tools', 'fixtures', 'absent-rows', name), 'utf8')

/** The fixture site. Same shape as a registered one; independent of the tree. */
const FIXTURE_SITE = {
  file: 'fixture',
  section: '## Module map',
  header: '| Module | Concern |',
  nameColumn: 0,
}

/** The fixture's module set. Three modules, typed here, not read from disk. */
const FIXTURE_MODULES = ['alpha.ts', 'beta.ts', 'gamma.ts']

/**
 * The sites that must be registered. Literals — see the header. A file removed
 * from `MODULE_TABLES` is a table nobody checks again, which is the defect, not
 * a refactor.
 */
const SITES_THAT_MUST_BE_REGISTERED = [
  'docs/INDEX.md',
  'docs/domain-model.md',
  'docs/HANDOFF.md',
]

// --------------------------------------------- 1. the engine, on fixtures

test('positive control — a complete table reports no missing and no unknown row', () => {
  const result = auditModuleTable(fixture('complete.md'), FIXTURE_SITE, FIXTURE_MODULES)
  assert.equal(result.located, true, result.reason)
  assert.deepEqual(result.missing, [])
  assert.deepEqual(result.unknown, [])
  assert.equal(result.rows, 4, 'the tsconfig.json row is a row; it just names no module')
  assert.equal(result.unnamed, 1, 'the tsconfig.json row names no module and is not an error')
})

test('negative control — one deleted row is reported MISSING, and prose does not rescue it', () => {
  const source = fixture('dropped-row.md')
  assert.ok(
    source.includes('`gamma.ts`') && !source.includes('| `gamma.ts` |'),
    'the fixture must carry the deleted name in PROSE and not as a row, or this ' +
      'test cannot tell a row reader from a file scanner',
  )
  const result = auditModuleTable(source, FIXTURE_SITE, FIXTURE_MODULES)
  assert.equal(result.located, true, result.reason)
  assert.deepEqual(result.missing, ['gamma.ts'])
  assert.deepEqual(result.unknown, [])
})

test('negative control — a row for a module that does not exist is reported UNKNOWN', () => {
  const result = auditModuleTable(fixture('phantom-row.md'), FIXTURE_SITE, FIXTURE_MODULES)
  assert.equal(result.located, true, result.reason)
  assert.deepEqual(result.missing, [])
  assert.deepEqual(result.unknown, ['delta.ts'])
})

test('prose below a complete table is not read as a row', () => {
  const source = fixture('complete.md')
  assert.ok(source.includes('`delta.ts`'), 'the fixture must name a non-module in prose')
  const result = auditModuleTable(source, FIXTURE_SITE, FIXTURE_MODULES)
  assert.deepEqual(result.unknown, [], 'a name in prose became a row; the table walk is wrong')
})

// ------------------------------------- 2. an unlocatable table is not a pass

test('a missing section anchor is reported, never treated as an empty table', () => {
  const result = auditModuleTable(fixture('complete.md'), { ...FIXTURE_SITE, section: '## Nowhere' }, FIXTURE_MODULES)
  assert.equal(result.located, false)
  assert.match(result.reason, /section heading .* not found/)
})

test('a missing header anchor is reported, never treated as an empty table', () => {
  const result = auditModuleTable(fixture('complete.md'), { ...FIXTURE_SITE, header: '| Nope | Nope |' }, FIXTURE_MODULES)
  assert.equal(result.located, false)
  assert.match(result.reason, /table header row .* not found/)
})

test('an ambiguous anchor is refused rather than resolved to the first match', () => {
  const doubled = `## Module map\n\n## Module map\n\n| Module | Concern |\n|---|---|\n| \`alpha.ts\` | x |\n`
  const result = locateTable(doubled, FIXTURE_SITE)
  assert.equal(result.rows, undefined)
  assert.match(result.reason, /appears 2 times — the anchor is ambiguous/)
})

test('a header row above its own section heading is refused', () => {
  const inverted = `| Module | Concern |\n|---|---|\n| \`alpha.ts\` | x |\n\n## Module map\n`
  const result = locateTable(inverted, FIXTURE_SITE)
  assert.equal(result.rows, undefined)
  assert.match(result.reason, /ABOVE its section heading/)
})

test('a header with no separator row is refused rather than read as data', () => {
  const noSeparator = `## Module map\n\n| Module | Concern |\n| \`alpha.ts\` | x |\n`
  const result = locateTable(noSeparator, FIXTURE_SITE)
  assert.equal(result.rows, undefined)
  assert.match(result.reason, /not a table separator row/)
})

test('a header and separator with no data rows is refused, not called complete', () => {
  const empty = `## Module map\n\n| Module | Concern |\n|---|---|\n\nprose\n`
  const result = locateTable(empty, FIXTURE_SITE)
  assert.equal(result.rows, undefined)
  assert.match(result.reason, /header and no data rows/)
})

// ------------------------------------------------- 3. the tree, and the registry

test('the registry names every site that must be checked, and the list is a literal here', () => {
  assert.deepEqual(
    MODULE_TABLES.map((s) => s.file),
    SITES_THAT_MUST_BE_REGISTERED,
    'a site left the registry. A table nobody compares is the defect G242 was ruled ' +
      'for; removing it from MODULE_TABLES does not make the table correct.',
  )
  for (const site of MODULE_TABLES) {
    assert.ok(site.why && site.why.length > 20, `${site.file} is registered with no stated reason`)
  }
})

test('every registered table is LOCATABLE in the real tree and has data rows', () => {
  const modules = deriveModules()
  assert.ok(modules.length > 0, 'no modules derived from model/*.ts — every assertion here would be vacuous')

  for (const site of MODULE_TABLES) {
    const source = readFileSync(join(REPO, site.file), 'utf8')
    const result = auditModuleTable(source, site, modules)
    assert.equal(result.located, true, `${site.file}: ${result.reason}`)
    assert.ok(result.rows > 0, `${site.file} located a table with no rows`)
    assert.ok(
      result.claimed.length > 0,
      `${site.file} located a table whose rows name no module at all — the name column ` +
        'is probably wrong, and the comparison against model/ asserted nothing',
    )
  }
  console.log(`    absent-rows: ${MODULE_TABLES.length} table(s) located · ${modules.length} modules derived`)
})

test('the checker exits 0 on the tree — and its own vacuity guards are asserted, not assumed', () => {
  const run = spawnSync(process.execPath, [CHECKER], { cwd: REPO, encoding: 'utf8' })
  assert.equal(
    run.status,
    0,
    `check-absent-rows failed on the tree:\n${run.stdout}\n${run.stderr}`,
  )
  for (const site of SITES_THAT_MUST_BE_REGISTERED) {
    assert.ok(run.stdout.includes(site), `the report never mentions ${site}`)
  }
  assert.match(
    run.stdout,
    /module tables: \d+ registered · \d+ modules derived/,
    'the report must state its corpus, so a reader can see it had one',
  )
})

test('an unknown argument is refused rather than ignored', () => {
  const run = spawnSync(process.execPath, [CHECKER, '--fix'], { cwd: REPO, encoding: 'utf8' })
  assert.equal(run.status, 2, 'a flag naming a capability the checker does not have must be refused')
})

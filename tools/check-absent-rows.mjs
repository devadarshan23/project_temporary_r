#!/usr/bin/env node
/**
 * check-absent-rows — G242. The checker for a row that was never written.
 *
 * WHY THIS EXISTS, AND IT IS NOT A HYPOTHETICAL.
 * `tools/check-doc-counts.mjs` derives fourteen governed totals from the tree
 * and reports every Markdown line that states one and disagrees. It is
 * structurally blind to an OMISSION, and the reason is one sentence long: an
 * omission has no number in it. Nothing in `npm run check` reads a list and
 * asks what is not on it. That blind spot has bitten four times, and not one
 * was a near miss:
 *
 *   1 · `Mockups/rec/` — the largest product-specification artefact in the
 *       repository — was absent from `CLAUDE.md`, `README.md` and
 *       `docs/INDEX.md` while `CLAUDE.md` said "that is the whole repository."
 *   2 · `CLAUDE.md`'s `tools/` line named two checkers while four were already
 *       inside `npm run check`.
 *   3 · On 16 Aug 2026 `CLAUDE.md`'s layout block had no `server/`, no
 *       `compose.yaml`, no `Dockerfile`, no `design/`, no `DESIGN.md` and no
 *       `.impeccable/` — seven substantive omissions, one of them an entire
 *       application — with `check-doc-counts` EXIT 0 throughout.
 *   4 · On 22 Aug 2026, found INDEPENDENTLY BY TWO SESSIONS the same day: the
 *       module tables in `docs/INDEX.md` and `docs/domain-model.md` are short
 *       of the module count printed DIRECTLY ABOVE THEM. `canonical.ts`,
 *       `connectors.ts` and `reconciliation.ts` had never been listed in
 *       either. `docs/HANDOFF.md` §2 carries the same table with the same three
 *       holes; nobody had noticed that one at all.
 *
 * Every one of the four was found by a person reading. None was found by a
 * control. Instance 4 is the one this file answers, because it is the one where
 * the correct answer is DERIVABLE: a table that claims to enumerate `model/`
 * can be compared against `model/`.
 *
 * ⚠️ WHY INSTANCE 4 IS WORSE THAN IT LOOKS, AND WHY THE COUNT CHECKER DID NOT
 * HELP. Both tables are preceded by the sentence "**Nineteen** TypeScript
 * modules under `model/` — `ls model/*.ts | wc -l`", and that sentence is
 * GREEN: `check-doc-counts` derived nineteen, read nineteen, and passed. The
 * page stated the right total and then listed sixteen things. A count control
 * cannot see the gap between a total and the enumeration under it — the number
 * and the rows are two different claims, and only one of them has a number.
 *
 * WHAT IT DOES. For each REGISTERED table site it locates the table by two
 * anchors — a section heading and the table's own header row, in that order —
 * reads the first column of every data row, extracts the ``x.ts`` tokens, and
 * compares that set against `model/*.ts`. It reports in both directions:
 *
 *   MISSING   a module on disk with no row. The defect above.
 *   UNKNOWN   a row naming a `.ts` that is not in `model/`. The other
 *             direction, which is a deleted module still being advertised.
 *
 * Either fails the run. A table site that cannot be LOCATED also fails, loudly,
 * rather than being skipped — a checker that silently finds nothing to check is
 * `docs/HANDOFF.md` §5.6, and this file exists precisely to catch silence.
 *
 * 🛑 WHAT IT DOES NOT DO, DELIBERATELY. It is NOT a general "compare any table
 * to any directory" engine. `tools/check-wire-mirror.mjs` registers concrete
 * pairs and argues in its own header why: a rule inferred ahead of the evidence
 * for it is a rule nobody has read a counterexample to. Three module tables are
 * registered below because three module tables have the defect TODAY. The
 * second rule — whatever it turns out to be — gets written when a second
 * omission is found in the tree, not before. Adding a site is a change to
 * `MODULE_TABLES`, not to the code beneath it.
 *
 * THREE TABLES THAT ENUMERATE MODULES ARE DELIBERATELY *NOT* REGISTERED, and
 * naming them is the point — an unexplained exclusion reads as an oversight:
 *
 *   · `docs/v1-trim-proposal.md` §2 — a DATED SNAPSHOT under G32, not a living
 *     control, and its rows are grouped (one row names four modules). A
 *     snapshot that grows rows stops being a snapshot.
 *   · `docs/build/green-service-topology.md` §2 — the "build budget", a
 *     measurement of the tree at a moment, in a two-pairs-per-row layout.
 *   · `docs/build/red-service-topology.md` — explicitly a SUBSET: the modules
 *     carrying the `types_without_operations` gap. Enumerating all nineteen
 *     there would make the table WRONG, not complete.
 *
 * WHERE THE MODULE LIST COMES FROM, AND WHAT THAT COSTS. `readdirSync('model')`
 * — the same derivation `tools/check-doc-counts.mjs` uses for its `modules`
 * total, and the same one `CLAUDE.md` quotes as `ls model/*.ts | wc -l`. The
 * agreement matters more than the alternative would: the table is compared
 * against exactly the population the count above it was compared against, so
 * the two controls cannot disagree with each other about what a module is. The
 * cost is stated rather than hidden — an untracked `model/*.ts` sitting on a
 * developer's disk counts, and would show up as a MISSING row for a file that
 * is not in the tree. `tools/check-wire-mirror.mjs` takes the opposite trade
 * for contracts and explains why there; `model/` is not gitignored and has no
 * stray-worktree problem, which is what makes the cheaper reader honest here.
 *
 * WHAT IT READS. Only the files named in `MODULE_TABLES`, at the anchors named
 * there. It does not walk `docs/`, and it never scans a `.mjs` — so the prose
 * in this header, including the module names quoted in it, is not a corpus this
 * tool can accidentally grade itself against. Several checkers here have
 * counted their own comments; this one cannot reach them.
 *
 *   node tools/check-absent-rows.mjs   report; exit 1 on any MISSING or UNKNOWN
 */

import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The registered sites. Each names the document, the section heading the table
 * lives under, the table's own header row, and which column holds the module
 * name. Both anchors are matched as WHOLE LINES and both must be unique in the
 * file — a heading that appears twice is ambiguous, and this checker refuses an
 * ambiguous anchor rather than guessing which table was meant.
 *
 * `why` is not decoration. It records what makes the site's table a claim to
 * exhaustiveness, because that — and not the table's shape — is what puts it
 * under this rule.
 */
export const MODULE_TABLES = [
  {
    file: 'docs/INDEX.md',
    section: '## The model',
    header: '| File | ⚠️ dropped | Concern |',
    nameColumn: 0,
    why: 'preceded by "**Nineteen** TypeScript modules under `model/`" and presented as the index of them',
  },
  {
    file: 'docs/domain-model.md',
    section: '## 12. Module map',
    header: '| Module | Concern |',
    nameColumn: 0,
    why: 'the section is literally the module map, and narrates its own past omissions of `learning.ts`, `kernel.ts` and `identity.ts`',
  },
  {
    file: 'docs/HANDOFF.md',
    section: '### What exists',
    header: '| Module | Concern |',
    nameColumn: 0,
    why: '§2 "What exists" — the handoff\'s own inventory, and §3 outranks CLAUDE.md on any decision',
  },
]

/** Every module on disk, sorted. The population both this and `check-doc-counts` read. */
export function deriveModules(root = ROOT) {
  return readdirSync(join(root, 'model'))
    .filter((f) => f.endsWith('.ts'))
    .sort()
}

/** True for a Markdown table separator row — `|---|---:|` and friends. */
function isSeparatorRow(line) {
  return /^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(line.trim())
}

/** The cells of a `| a | b | c |` line, outer pipes discarded. */
function cells(line) {
  const parts = line.split('|')
  return parts.slice(1, parts.length - 1)
}

/**
 * Locate a registered table. Returns `{ rows }` on success, or `{ reason }` —
 * never a partial answer, because a table located at the wrong place produces a
 * confident comparison against the wrong rows.
 */
export function locateTable(source, site) {
  const lines = source.split('\n')

  const sectionAt = lines.reduce((acc, l, i) => (l === site.section ? [...acc, i] : acc), [])
  if (sectionAt.length === 0) return { reason: `section heading ${JSON.stringify(site.section)} not found` }
  if (sectionAt.length > 1) {
    return { reason: `section heading ${JSON.stringify(site.section)} appears ${sectionAt.length} times — the anchor is ambiguous` }
  }

  const headerAt = lines.reduce((acc, l, i) => (l === site.header ? [...acc, i] : acc), [])
  if (headerAt.length === 0) return { reason: `table header row ${JSON.stringify(site.header)} not found` }
  if (headerAt.length > 1) {
    return { reason: `table header row ${JSON.stringify(site.header)} appears ${headerAt.length} times — the anchor is ambiguous` }
  }
  if (headerAt[0] < sectionAt[0]) {
    return { reason: `the table header row appears at line ${headerAt[0] + 1}, ABOVE its section heading at line ${sectionAt[0] + 1}` }
  }

  const separator = lines[headerAt[0] + 1] ?? ''
  if (!isSeparatorRow(separator)) {
    return { reason: `line ${headerAt[0] + 2} is not a table separator row; got ${JSON.stringify(separator)}` }
  }

  const rows = []
  for (let i = headerAt[0] + 2; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!line.startsWith('|')) break
    rows.push({ line, number: i + 1 })
  }
  if (rows.length === 0) return { reason: `the table at line ${headerAt[0] + 1} has a header and no data rows` }
  return { rows }
}

/**
 * The `x.ts` tokens named in one row's name column. Backticked, because that is
 * how every registered table writes a filename and because an unquoted `.ts` in
 * prose is not a row's subject. A row naming none — `docs/INDEX.md` carries a
 * `tsconfig.json` row — contributes nothing and is counted as unnamed rather
 * than treated as an error.
 */
function namesIn(row, nameColumn) {
  const cell = cells(row.line)[nameColumn] ?? ''
  return [...cell.matchAll(/`([A-Za-z0-9_.-]+\.ts)`/g)].map((m) => m[1])
}

/**
 * Compare one located table against the module list. Pure — the tests drive
 * this with fixture strings rather than with the tree, so a red can be
 * witnessed without editing a document.
 */
export function auditModuleTable(source, site, modules) {
  const located = locateTable(source, site)
  if (located.reason) return { located: false, reason: located.reason }

  const claimed = []
  let unnamed = 0
  for (const row of located.rows) {
    const names = namesIn(row, site.nameColumn)
    if (names.length === 0) unnamed++
    claimed.push(...names)
  }

  const claimedSet = new Set(claimed)
  const moduleSet = new Set(modules)
  return {
    located: true,
    rows: located.rows.length,
    unnamed,
    claimed: [...claimedSet].sort(),
    missing: modules.filter((m) => !claimedSet.has(m)),
    unknown: [...claimedSet].filter((c) => !moduleSet.has(c)).sort(),
  }
}

export function main(argv = []) {
  // No arguments, and an unknown one is refused rather than ignored — the
  // shape `tools/check-g-numbers.mjs` argues for: a flag silently accepted is a
  // capability a reader believes in.
  if (argv.length) {
    console.log(`check-absent-rows takes no arguments; got ${argv.join(' ')}`)
    return 2
  }

  const modules = deriveModules()

  /* Vacuity guard, first, and reported rather than merely checked. Every
     comparison below is against this list; an empty one makes all of them pass
     while asserting nothing, which is the exact failure this checker was built
     to catch happening inside the checker. */
  if (modules.length === 0) {
    console.log('NO MODULES DERIVED from model/*.ts — every comparison below would be vacuous.')
    console.log('Fix the derivation; do not delete the assertion.')
    return 1
  }
  if (MODULE_TABLES.length === 0) {
    console.log('NO TABLE SITES REGISTERED — this checker would exit 0 having read nothing.')
    return 1
  }

  console.log(
    `module tables: ${MODULE_TABLES.length} registered · ${modules.length} modules derived from model/*.ts`,
  )

  let failures = 0
  const detail = []
  for (const site of MODULE_TABLES) {
    let source
    try {
      source = readFileSync(join(ROOT, site.file), 'utf8')
    } catch (err) {
      failures++
      console.log(`  ${site.file}  UNREADABLE — ${String(err?.message ?? err)}`)
      continue
    }

    const result = auditModuleTable(source, site, modules)
    if (!result.located) {
      failures++
      console.log(`  ${site.file}  TABLE NOT LOCATED — ${result.reason}`)
      console.log(`      the site is registered in tools/check-absent-rows.mjs; update the anchors or remove the site`)
      continue
    }

    const named = result.rows - result.unnamed
    const verdict = result.missing.length || result.unknown.length ? 'ABSENT ROWS' : 'complete'
    console.log(
      `  ${site.file}  ${named} of ${modules.length} modules listed` +
        `${result.unnamed ? ` (+${result.unnamed} row(s) naming no module)` : ''} — ${verdict}`,
    )
    if (result.missing.length) {
      failures++
      detail.push(`${site.file} — MISSING ${result.missing.length}: ${result.missing.join(', ')}`)
    }
    if (result.unknown.length) {
      failures++
      detail.push(`${site.file} — UNKNOWN ${result.unknown.length}: ${result.unknown.join(', ')}`)
    }
  }

  if (detail.length) {
    console.log('')
    for (const line of detail) console.log(`  ${line}`)
    console.log('')
    console.log('MISSING — a module exists in model/ and the table has no row for it. The table')
    console.log('  claims to enumerate model/ and does not. Add the row; do not narrow the claim')
    console.log('  silently. UNKNOWN — a row names a .ts that is not in model/, which is a deleted')
    console.log('  module still advertised. Neither is catchable by a count: an omission has no')
    console.log('  number in it, which is why G242 exists.')
  }

  return failures ? 1 : 0
}

/**
 * The main-module guard. `realpathSync` is load-bearing rather than defensive,
 * for the reason `tools/check-g-numbers.mjs` states at length: node resolves
 * symlinks building `import.meta.url` and does not resolve them in
 * `process.argv[1]`, so on any checkout reached through a symlink — macOS's
 * `/tmp` → `/private/tmp`, which every spawn test here hits — the two strings
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

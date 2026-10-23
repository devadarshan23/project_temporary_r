#!/usr/bin/env node
/**
 * ReconcileAI — C4 data extractor. Emits docs/c4-data.json.
 *
 * Produces the machine-derivable half of the C4 record, in one file:
 *   - Level 3: the module graph (nodes, import edges, layer, dropped status)
 *   - Level 4: per-module API surface — every top-level export, its kind, its
 *              signature, and whether it carries `@dropped-for-v1` — plus the
 *              intra-module type-reference graph the detail view draws.
 *   - Database: the BUILT schema, parsed from db/migrations/*.sql. Tables,
 *              columns, RLS policies with their verbatim predicates, and grants.
 *
 * WHAT THIS DELIBERATELY DOES NOT PRODUCE. Level 1 (context) and Level 2
 * (containers) are not derivable from this tree — there is no deployed system
 * to inspect, and the personas and external systems live in prose. They stay
 * hand-authored, and the page that renders this data says so on its face. The
 * PLANNED tables are likewise hand-curated from docs/persistence-design.md;
 * only the `built` half below comes from SQL.
 *
 * WHY THE TYPESCRIPT COMPILER API AND NOT A LINE SCANNER. tools/planner/
 * extract.mjs is deliberately a zero-dependency line scanner, and it documents
 * its own blind spots: it cannot see a union member, a non-id-shaped field, or
 * a type alias. Those blind spots are load-bearing for a MODULE GRAPH and fatal
 * for an API SURFACE — the whole point of Level 4 is the exports a scanner
 * cannot classify. `typescript` is already a pinned devDependency, so using its
 * parser adds no package. It is imported dynamically and its absence is
 * reported as an instruction rather than a crash, the same posture db/pg.ts
 * takes toward the `pg` driver.
 *
 * DETERMINISM IS A HARD REQUIREMENT, not a nicety. tools/check-c4-freshness.mjs
 * diffs this file's output against the committed copy, and tools/githooks/
 * post-commit commits the result. A timestamp, a commit hash, or an unsorted
 * Set would make the diff never settle and the hook commit on every commit
 * forever. There is no Date, no git call, and every collection is sorted.
 *
 * Usage:
 *   node tools/planner/extract-c4-data.mjs            # print JSON to stdout
 *   node tools/planner/extract-c4-data.mjs --write    # write docs/c4-data.json
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { tableKey } from './c4-verify.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const MODEL_DIR = path.join(REPO_ROOT, 'model')
/**
 * 🛑 THIS IS THE DATA PLANE'S MIGRATION SET AND IT IS NO LONGER THE ONLY ONE.
 *
 * Ruling 3 (16 Aug 2026) split the system into two processes with two databases,
 * and `db/migrations-control/` is the control plane's. THIS SCANNER DOES NOT READ
 * IT, so the C4 database section depicts ONE schema while the tree has TWO —
 * `pack_catalogue` is built and appears on no page.
 *
 * ⚠️ MERGING THE TWO DIRECTORIES INTO THIS SCAN WAS CONSIDERED AND IS WORSE, not
 * merely insufficient. The page has one database section and no notion of which
 * plane a table belongs to, so a merged read would draw ONE schema where there
 * are two — and it would render `pack_catalogue`, which correctly has no
 * row-level security because nothing in that database is tenant-scoped, beside
 * `tenant` and `run` as a table that is simply MISSING its policy. That is a
 * false alarm on the one badge this page exists to make legible, which is a
 * worse failure than the omission it would fix.
 *
 * WHAT IS OWED, and it is a control rather than this comment: a plane-aware
 * database section, so the page can say "two databases" and be checked on it.
 * Until then the omission is at least written down where the next reader of this
 * constant will meet it. `docs/HANDOFF.md` §7 records that a stale visual is the
 * one artefact class that has ALREADY misled a reader here.
 */
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'db', 'migrations')
/**
 * ✅ AND THE OWED CONTROL IS BUILT — G4413, 5 Oct 2026. The paragraph above is
 * kept as it stood because its argument against a MERGED scan still holds and
 * is the reason for the shape taken: `db/migrations-control/` is scanned
 * SEPARATELY into `db.control`, every table carries the `plane` it belongs to,
 * and the page renders control tables with a "no RLS — no tenant in this
 * database" pill instead of a missing-policy one. The data plane's set stays
 * `db.tables`, so no existing reader changes meaning.
 */
const CONTROL_MIGRATIONS_DIR = path.join(REPO_ROOT, 'db', 'migrations-control')
const ENV_TS = path.join(REPO_ROOT, 'db', 'env.ts')
const OUT_PATH = path.join(REPO_ROOT, 'docs', 'c4-data.json')

const DROPPED_BANNER = 'WHOLE MODULE IS `@dropped-for-v1`'
const DROPPED_TAG = '@dropped-for-v1'

/**
 * Which C4 grouping a module belongs to.
 *
 * 🛑 THIS IS HAND-ASSIGNED, AND THIS COMMENT CLAIMED THE OPPOSITE UNTIL
 * 12 Aug 2026. It read: "Derived from the import graph, not hand-assigned: a
 * module importing nothing internal is FOUNDATION; the leaf that everything
 * flows into and nothing imports is PROOF; the rest split on whether they sit
 * under domain.ts" — written directly above the literal object below, which is
 * the whole of the mechanism. The corrected sentence is left here rather than
 * deleted because a reader would have believed the rule and gone looking for the
 * code that applies it.
 *
 * The stated rule also did not describe the tree. With arrows meaning "imports",
 * the thing everything flows into is `kernel`, which is labelled FOUNDATION; and
 * there are two PROOF modules, not one.
 *
 * ⚠️ AND `platform` IS THE FALLBACK, NOT A JUDGEMENT. Every module absent from
 * this map lands there via `?? 'platform'` below, and the page renders that
 * bucket as "PLATFORM SERVICES · cross-cutting capabilities". Ten of eighteen
 * modules are in it by default, including both dropped ones — so a module added
 * tomorrow is characterised as a cross-cutting platform service by nobody's
 * decision. Assign it here, or accept that the page is guessing.
 */
const LAYER = {
  kernel: 'foundation',
  canonical: 'foundation',
  identity: 'proof',
  examples: 'proof',
  access: 'core',
  governance: 'core',
  domain: 'core',
  reconciliation: 'core',
}

async function loadTypeScript() {
  try {
    const mod = await import('typescript')
    return mod.default ?? mod
  } catch {
    console.error('This extractor needs the `typescript` package, which is a pinned devDependency.')
    console.error('It is not installed in this checkout. Run:')
    console.error('')
    console.error('  npm ci')
    console.error('')
    console.error('Nothing was written. Refusing to emit a partial API surface — an')
    console.error('incomplete Level 4 that looks complete is worse than no Level 4.')
    process.exit(2)
  }
}

/**
 * True when the JSDoc immediately preceding `node` carries the drop marker AS AN
 * ANNOTATION ON THIS DECLARATION.
 *
 * Two narrowings. ⚠️ ONE OF THEM DOES THE WORK AND THE OTHER MOVES NOTHING IN
 * THIS TREE, and this comment claimed both were "load-bearing rather than
 * defensive" until an adversarial pass measured them. The claim is corrected
 * rather than deleted, because asserting a control is load-bearing when it
 * changes no output is the same shape this block exists to apologise for.
 *
 * ONLY THE LAST COMMENT RANGE — CURRENTLY CHANGES ZERO DECLARATIONS. Kept for
 * agreement with `leadingDoc()` below, which already reads the last range: a page
 * that quotes one comment block and takes its status from another describes
 * nothing. It is alignment, not enforcement, and it must not be cited as the
 * thing that fixed the drop count.
 *
 * THE TAG MUST OPEN A LINE. This record's house style narrates a drop in the
 * prose above NEIGHBOURING declarations — "the two `@dropped-for-v1` notes
 * below", "is NOT annotated `@dropped-for-v1`" — so a substring test marks a live
 * export dropped BECAUSE its documentation is good. It did: seven live exports
 * rendered red, among them `LivePolicyKind`, `NormalisationReader`,
 * `mayPromoteLearning` and `SubjectLocation`, whose own comment says in as many
 * words that it is not annotated. Keyed on the convenient landmark instead of the
 * property it protects — HANDOFF §5.1, inside the tool built to depict the tree.
 *
 * Every prose mention in `model/` is backticked mid-sentence and every real
 * annotation opens its line, so the two are separable. Derive it:
 *   grep -h '@dropped-for-v1' model/*.ts | grep -cE '^[ \t]*(\/\*\*?)?[ \t]*\*?[ \t]*@dropped-for-v1\b'
 * 223 annotations against 235 occurrences, the 12 remaining all prose.
 */
const DROPPED_ANNOTATION = new RegExp(
  String.raw`^[ \t]*(?:\/\*\*?)?[ \t]*\*?[ \t]*` + DROPPED_TAG + String.raw`\b`,
  'm',
)

function isDropped(ts, node, fullText) {
  const ranges = ts.getLeadingCommentRanges(fullText, node.pos) ?? []
  if (ranges.length === 0) return false
  const own = ranges[ranges.length - 1]
  return DROPPED_ANNOTATION.test(fullText.slice(own.pos, own.end))
}

/** First sentence of the leading JSDoc, flattened. Empty string when absent. */
function leadingDoc(ts, node, fullText) {
  const ranges = ts.getLeadingCommentRanges(fullText, node.pos) ?? []
  if (ranges.length === 0) return ''
  const raw = fullText.slice(ranges[ranges.length - 1].pos, ranges[ranges.length - 1].end)
  const body = raw
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*/, '').trim())
    .filter((l) => l && !l.startsWith('@'))
    .join(' ')
    .trim()
  const stop = body.search(/\.\s/)
  const first = stop === -1 ? body : body.slice(0, stop + 1)
  return first.length > 180 ? first.slice(0, 177) + '…' : first
}

/** Collapse whitespace and clip, so a signature stays one readable line. */
function oneLine(text, max = 150) {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}

function moduleHasExportModifier(ts, node) {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0
}

/**
 * Parse one module into its export surface. Uses a SourceFile only — no
 * Program, no type checker. Nothing here needs resolved types, and a
 * checker would make the run slow enough to matter inside `npm run check`,
 * which G108 requires stay fast.
 */
function parseModule(ts, name, src) {
  const sf = ts.createSourceFile(`${name}.ts`, src, ts.ScriptTarget.ES2022, true)
  const dropped = src.includes(DROPPED_BANNER)

  const exports = { interfaces: [], types: [], functions: [], values: [] }
  const exportedNames = new Set()
  const imports = new Set()
  let reExportStatements = 0

  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) {
      const spec = st.moduleSpecifier
      if (spec && ts.isStringLiteral(spec)) {
        const m = /^\.\/([a-zA-Z0-9_-]+)(?:\.ts)?$/.exec(spec.text)
        if (m && m[1] !== name) imports.add(m[1])
      }
    }
  }

  for (const st of sf.statements) {
    // ⚠️ An `export { … } from './x.ts'` statement carries NO export MODIFIER —
    // `getCombinedModifierFlags` returns 0 for it — so this guard silently skipped
    // every re-export until 12 Aug 2026, which is how 88 names went missing from
    // Level 4. Admit export declarations explicitly; the branch below handles them.
    // The second loop's identical guard is deliberately NOT changed: it feeds the
    // intra-module reference graph, which has nothing to draw for a name declared
    // in another file.
    if (!moduleHasExportModifier(ts, st) && !ts.isExportDeclaration(st)) continue
    const itemDropped = dropped || isDropped(ts, st, src)
    const doc = leadingDoc(ts, st, src)

    if (ts.isInterfaceDeclaration(st)) {
      const members = st.members
        .map((m) => {
          const mname = m.name && ts.isIdentifier(m.name) ? m.name.text : m.name?.getText(sf)
          if (!mname) return null
          const t = m.type ? oneLine(m.type.getText(sf), 70) : ''
          const optional = m.questionToken ? '?' : ''
          return { name: `${mname}${optional}`, type: t }
        })
        .filter(Boolean)
      exports.interfaces.push({ name: st.name.text, dropped: itemDropped, doc, members })
      exportedNames.add(st.name.text)
    } else if (ts.isTypeAliasDeclaration(st)) {
      exports.types.push({
        name: st.name.text,
        dropped: itemDropped,
        doc,
        signature: oneLine(st.type.getText(sf)),
      })
      exportedNames.add(st.name.text)
    } else if (ts.isFunctionDeclaration(st) && st.name) {
      const params = st.parameters.map((p) => oneLine(p.getText(sf), 48)).join(', ')
      const ret = st.type ? oneLine(st.type.getText(sf), 48) : ''
      exports.functions.push({
        name: st.name.text,
        dropped: itemDropped,
        doc,
        signature: `(${params})${ret ? `: ${ret}` : ''}`,
      })
      exportedNames.add(st.name.text)
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue
        const declared = d.type ? oneLine(d.type.getText(sf), 60) : ''
        const init = d.initializer ? oneLine(d.initializer.getText(sf), 60) : ''
        exports.values.push({
          name: d.name.text,
          dropped: itemDropped,
          doc,
          signature: declared || init,
        })
        exportedNames.add(d.name.text)
      }
    } else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      // RE-EXPORTS — `export type { A, B } from './other.ts'`.
      //
      // 🛑 THIS BRANCH DID NOT EXIST UNTIL 12 Aug 2026, AND ITS ABSENCE MADE THIS
      // FILE'S OWN HEADER FALSE. The header claims Level 4 carries "every top-level
      // export"; 23 re-export statements carrying 88 names fell through this
      // if-chain entirely, so the page's export total read 826 against
      // check-doc-counts.mjs's 849 — two mechanical derivations of one noun, 23
      // apart, both green in the same gate. That is HANDOFF §5.3 living inside the
      // verification surface.
      //
      // A re-exported name is listed under the kind it is spelled with and marked
      // `reExportedFrom`, because it is part of THIS module's surface — a reader
      // importing it imports it from here — while not being declared here. It is
      // deliberately NOT added to `exportedNames`: that set drives the intra-module
      // reference graph, and a name declared elsewhere has no local declaration to
      // draw an edge from.
      const from = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)
        ? st.moduleSpecifier.text
        : ''
      // Count the STATEMENT here. ⚠️ Deriving it later from the set of distinct
      // source modules undercounts by 10 — two statements may re-export from the
      // same module — which read as 839 against the governed 849.
      reExportStatements++
      for (const spec of st.exportClause.elements) {
        exports.types.push({
          name: spec.name.text,
          dropped: itemDropped,
          doc,
          signature: `re-exported from ${from}`,
          reExportedFrom: from,
        })
      }
    }
  }

  // Intra-module type references: which exported declaration mentions which
  // other exported name. This is what the Level 4 relationship map draws, and
  // it is why a real parser earns its place — a regex cannot tell a reference
  // inside a comment from one inside a type position.
  const relationships = []
  const seenPair = new Set()
  const recordRefs = (fromName, node) => {
    const walk = (n) => {
      if (ts.isTypeReferenceNode(n)) {
        const ref = n.typeName
        const refName = ts.isIdentifier(ref) ? ref.text : ref.right.text
        if (exportedNames.has(refName) && refName !== fromName) {
          const key = `${fromName}\u0000${refName}`
          if (!seenPair.has(key)) {
            seenPair.add(key)
            relationships.push({ from: fromName, to: refName })
          }
        }
      }
      ts.forEachChild(n, walk)
    }
    ts.forEachChild(node, walk)
  }
  for (const st of sf.statements) {
    if (!moduleHasExportModifier(ts, st)) continue
    if (ts.isInterfaceDeclaration(st)) recordRefs(st.name.text, st)
    else if (ts.isTypeAliasDeclaration(st)) recordRefs(st.name.text, st)
  }

  const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  exports.interfaces.sort(byName)
  exports.types.sort(byName)
  exports.functions.sort(byName)
  exports.values.sort(byName)
  relationships.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))

  // TWO COUNTS, BECAUSE THERE ARE TWO NOUNS AND CONFLATING THEM IS WHAT PRODUCED
  // 826-versus-849 IN THE FIRST PLACE.
  //
  // `total` counts EXPORT STATEMENTS, which is the noun `grep -c '^export '` counts
  // and therefore the noun tools/check-doc-counts.mjs governs — one re-export
  // statement is ONE, however many names it carries. `names` counts the names
  // reachable through this module's surface, which is the larger figure and the one
  // Level 4 actually lists.
  //
  // ⚠️ Adding the 88 re-exported NAMES to `total` was tried first and overshot to
  // 913 against the governed 849, which is the same defect wearing the opposite
  // sign. Two derivations of one noun must agree; two nouns must be named
  // differently and both published.
  const declared =
    exports.interfaces.length +
    exports.types.filter((x) => x.reExportedFrom === undefined).length +
    exports.functions.length +
    exports.values.length
  const total = declared + reExportStatements
  const names =
    exports.interfaces.length + exports.types.length + exports.functions.length + exports.values.length
  const droppedCount =
    exports.interfaces.filter((x) => x.dropped).length +
    exports.types.filter((x) => x.dropped && x.reExportedFrom === undefined).length +
    exports.functions.filter((x) => x.dropped).length +
    exports.values.filter((x) => x.dropped).length

  return {
    name,
    dropped,
    layer: LAYER[name] ?? 'platform',
    doc: leadingDoc(ts, sf.statements[0] ?? sf, src),
    imports: [...imports].sort(),
    exports,
    relationships,
    counts: { total, names, dropped: droppedCount },
  }
}

/**
 * Parse the BUILT schema out of db/migrations/*.sql.
 *
 * Scoped on purpose: this RENDERS CREATE SCHEMA, CREATE TABLE, CREATE POLICY, the
 * `ALTER TABLE` actions listed in LIST_ALTER_ACTIONS and its two siblings —
 * including the two ROW
 * LEVEL SECURITY toggles — and GRANT. It is not a general SQL parser and must not
 * be described as one. When it finds nothing it says so in `parsedFrom` and the
 * counts go to zero rather than silently reporting an empty schema as a clean one.
 *
 * ⚠️ RECOGNISED IS A WIDER SET THAN RENDERED, and the gap is deliberate. `REVOKE`,
 * `COMMENT ON` and `CREATE FUNCTION` pass `refuseUnrecognisedDdl` and appear
 * nowhere on the page: they are statements the scanner can account for as not
 * changing what it depicts. `REVOKE CREATE ON SCHEMA public FROM PUBLIC` in 0001
 * is load-bearing and unrendered — a known gap, recorded rather than hidden.
 *
 * It LEXES more than it parses. Comments, string literals, quoted identifiers and
 * dollar-quoted bodies are all tracked (see `scanSql`), because getting the
 * boundaries wrong is how a note about future work became evidence of present
 * fact, and how a function body's semicolons shredded the statement around them.
 */
/**
 * 🛑 A LEXICAL SCANNER, BECAUSE A REGEX CANNOT DO THIS (#166).
 *
 * This replaced `sql.replace(/^\s*--.*$/gm, '')`, which stripped a comment only
 * when it OPENED its line. `--` begins a comment anywhere in PostgreSQL, so a
 * trailing comment — including the ordinary kind that annotates a column inside a
 * `CREATE TABLE` body — survived into the text the RLS matcher then read as SQL.
 * A note recording that RLS is NOT YET enabled was read as evidence that it is.
 *
 * ⚠️ THE OBVIOUS REPAIR IS THE ONE THAT MAKES IT WORSE. Widening the pattern to
 * `/--.*$/gm` fixes both comment cases and breaks string literals: it deletes from
 * the `--` inside `note text DEFAULT 'a -- b'` to end of line, and once the line is
 * unbalanced the statements after it are swallowed too — so a genuinely protected
 * table reports `rlsEnabled=false`. An UNDER-report of a real protection, which is
 * the worse direction. Comments and literals cannot be separated by a regex
 * because whether `--` opens a comment depends on state to its LEFT.
 *
 * So: one left-to-right pass with seven states — outside, `'…'` literal (`''`
 * escapes), `E'…'` escape-string literal (`''` AND backslash escapes), `"…"`
 * identifier (`""` escapes), `$tag$…$tag$` dollar-quoted body, `-- …` to end of
 * line, and `/* … *\/` block comment, which NESTS in PostgreSQL.
 *
 * 🛑 AND EVERY DELIMITED STATE REFUSES AT END-OF-FILE. Four of them used to
 * CONSUME to EOF instead — `closeQuote` returning `text.length`, and the dollar
 * and block-comment branches doing the same by hand. That is not a lexer being
 * lenient, it is the guard failing OPEN: the remainder of the file becomes ONE
 * statement whose leading keyword is the one before the broken delimiter, which
 * `refuseUnrecognisedDdl` then passes, and which the dispatch below renders
 * nothing from because no matcher fits it. A typo'd `$a$ … $b$` on the
 * `CREATE FUNCTION` form S-2 requires, with a `DROP SCHEMA public` behind it,
 * was ACCEPTED with the dropped schema's tables still listed and their RLS
 * badges still printed. The block-comment branch was worse again: it blanks what
 * it consumed, so the swallowed tail left no trace in any statement at all.
 *
 * The scanner cannot say where an unterminated statement ends, so it cannot say
 * what follows it, so it must not depict the file. See `refuseUnreadable`.
 *
 * IT RETURNS STATEMENTS, NOT STRIPPED TEXT, and that is the second half of the
 * fix. The old `stripped.split(/;\s*(?:\n|$)/)` cannot see that a `;` inside a
 * dollar-quoted function body is not a terminator, so the `CREATE FUNCTION …
 * AS $$ … ; … $$` the owner's S-2 ruling puts into a migration was shredded into
 * four fragments and the migration refused for the wrong reason (#143). Splitting
 * on the scanner's own OUTSIDE state costs nothing extra and fixes both.
 *
 * Each statement is returned with its terminating `;` so the matchers below —
 * which key on `);`, on `;`, and on the statement's first line — keep working
 * verbatim, while no match can now span a statement boundary.
 *
 * ⚠️ `E'…'` IS HANDLED, AND CALLING IT "not handled, deliberately" WAS WRONG —
 * IT WAS A WHOLE-FILE FAIL-OPEN, NOT AN UNRENDERED FORM. PostgreSQL honours a
 * backslash-escaped `\'` inside an escape-string literal and nowhere else, while
 * `closeQuote` ended at the first undoubled `'`. So ONE ordinary E-string put
 * every following `;` inside a phantom literal and `refuseUnrecognisedDdl` never
 * saw those statements at all — `COMMENT ON TABLE tenant IS E'o\'clock';` ate the
 * `DROP POLICY` and `DROP TABLE` after it, and
 * `ADD COLUMN x text DEFAULT E'a\'b', DISABLE ROW LEVEL SECURITY` ate the comma,
 * so the action list was never split and #164 defect 1 was alive in valid SQL.
 * Both directions occurred: a swallowed `ENABLE` under-reports, an E-string in a
 * `CREATE POLICY` over-reports.
 *
 * `U&'…'` needs nothing — it doubles quotes like an ordinary literal, and the `&`
 * simply falls through as an outside-state character. A plain `'…\'…'` is a
 * PostgreSQL syntax error where this scanner's reading coincides with
 * PostgreSQL's. The hole was exactly one form and it is closed.
 */
function scanSql(sql, file = '<fixture>') {
  const statements = []
  let current = ''
  let i = 0
  const n = sql.length

  const flush = (terminator) => {
    const text = (current + terminator).trim()
    // A bare `;`, or whitespace left where a comment used to be, is not a statement.
    if (text.replace(/;+\s*$/, '').trim()) statements.push(text)
    current = ''
  }

  while (i < n) {
    const pair = sql.slice(i, i + 2)

    if (pair === '--') {
      const eol = sql.indexOf('\n', i)
      i = eol === -1 ? n : eol
      continue
    }

    if (pair === '/*') {
      const start = i
      let depth = 0
      while (i < n) {
        const inner = sql.slice(i, i + 2)
        if (inner === '/*') {
          depth += 1
          i += 2
          continue
        }
        if (inner === '*/') {
          depth -= 1
          i += 2
          if (depth === 0) break
          continue
        }
        i += 1
      }
      // The depth counter is what makes nesting real rather than advertised: an
      // inner `*/` must not end an outer comment, or every line after it is read
      // as SQL. Nothing exercised it until the integrity suite did.
      if (depth !== 0) refuseUnreadable(file, sql, start, 'block comment', '*/')
      // Keep the newlines the comment spanned, so the line a statement reports
      // itself on is the line it is actually written on.
      current += sql.slice(start, i).replace(/[^\n]+/g, '')
      continue
    }

    const ch = sql[i]

    const quoted = quotedRun(sql, i)
    if (quoted !== null) {
      if (quoted.end === -1) refuseUnreadable(file, sql, i, quoted.kind, quoted.closer)
      current += sql.slice(i, quoted.end)
      i = quoted.end
      continue
    }

    const tag = dollarTag(sql, i)
    if (tag !== null) {
      // ⚠️ A MISMATCHED TAG LOOKS EXACTLY LIKE AN UNTERMINATED ONE, and that is
      // the correct reading: `$a$ … $b$` has no `$a$` after its opener, so the
      // body has no end. That is the realistic F1 case — a typo on the tag of the
      // `CREATE FUNCTION` S-2 requires — and it must refuse for that reason
      // rather than run to EOF and take a `DROP SCHEMA` with it.
      const close = sql.indexOf(tag, i + tag.length)
      if (close === -1) refuseUnreadable(file, sql, i, `dollar-quoted body`, tag)
      const end = close + tag.length
      current += sql.slice(i, end)
      i = end
      continue
    }

    if (ch === ';') {
      flush(';')
      i += 1
      continue
    }

    current += ch
    i += 1
  }
  flush('')
  return statements
}

/**
 * 🛑 THE FILE CANNOT BE FULLY READ, SO THE PAGE MUST NOT DEPICT IT.
 *
 * The sibling of `refuseUnrecognisedDdl` and deliberately in its register: that
 * one refuses a statement this scanner cannot ACCOUNT FOR, this one refuses a
 * file whose statement BOUNDARIES it cannot find. The failure is the same shape
 * and the same direction — a partial read rendered as a complete schema — and it
 * is worse in one respect. An unrecognised statement is at least SEEN and named.
 * A swallowed one is not: everything after the broken delimiter joins the
 * statement before it, that statement's leading keyword is recognised, and the
 * dispatch's `if (!m) continue` renders nothing at all from the tail. A
 * `DROP SCHEMA public` behind a typo'd `$a$` disappeared entirely while the page
 * went on printing `RLS ENABLED · FORCED` for the tables it dropped.
 */
function refuseUnreadable(file, sql, offset, kind, closer) {
  const line = sql.slice(0, offset).split('\n').length
  const opener = (sql.slice(offset).split('\n')[0] ?? '').slice(0, 72)
  throw new Error(
    `db/migrations/${file} has an unterminated ${kind} opened at line ${line}, so this scanner ` +
      `cannot find where that statement ends or read the ones after it:\n` +
      `    ${opener}…\n\n` +
      `  Refusing rather than rendering a partial schema as a complete one. Everything after\n` +
      `  the opening delimiter would be swallowed into ONE statement whose leading keyword is\n` +
      `  recognised, so a DROP or a DISABLE hidden in the tail renders as nothing while the\n` +
      `  page keeps printing RLS ENABLED · FORCED. Close it with ${closer} — and if the dollar\n` +
      `  tag is mismatched ($a$ … $b$), spell both ends the same.`,
  )
}

/**
 * The quoted run opening at `i`, or null when none does.
 *
 * `{ end }` is the offset one past the closing delimiter, or -1 when the run is
 * UNTERMINATED. -1 rather than `text.length`, because "consume the rest" is a
 * decision only the caller can make: `scanSql` refuses (it is reading a file and
 * cannot pretend to have read it), while `splitTopLevelCommas` cannot be reached
 * with an unterminated run at all — see its own note.
 *
 * THREE OPENERS, NOT TWO. `E'…'` is the third and it is not decoration: inside
 * it, and ONLY inside it, PostgreSQL honours `\'` — so reading it as an ordinary
 * literal ends the run early, re-opens another at the next `'`, and swallows
 * every `;` from there to the end of the file.
 */
function quotedRun(text, i) {
  const ch = text[i]
  if (ch === "'" || ch === '"') {
    return {
      end: closeQuote(text, i, ch, false),
      kind: ch === "'" ? 'string literal' : 'quoted identifier',
      closer: ch,
    }
  }
  // `E'…'` — only when the E STARTS A TOKEN. A trailing `e` on an identifier
  // (`… source_table'x'` is not SQL, but `…e` followed by a literal could be a
  // typo) must not turn the next literal into an escape string.
  if ((ch === 'E' || ch === 'e') && text[i + 1] === "'" && !continuesIdentifier(text, i)) {
    return { end: closeQuote(text, i + 1, "'", true), kind: 'escape-string literal', closer: "'" }
  }
  return null
}

/**
 * 🛑 DOES THE CHARACTER BEFORE `i` CONTINUE AN IDENTIFIER? — ONE RULE, TWO USES.
 *
 * PostgreSQL's lexer takes the LONGEST match and `ident_cont` is
 * `[A-Za-z\200-\377_0-9\$]`, so a delimiter can only open where a TOKEN opens.
 * Both of this file's prefix-delimiters need exactly that test:
 *
 *   - `E'…'` — `source_tablee'x'` is one identifier and a plain literal, not an
 *     escape string. `quotedRun` has had this guard since the E-string fail-open
 *     was closed.
 *   - `$tag$` — `a$q$` is ONE IDENTIFIER and never a tag opener, and `dollarTag`
 *     did not have it. That is #159 F1, verified against PostgreSQL 14.18:
 *     `ADD COLUMN a$q$ text; … ; ADD COLUMN b$q$ int;` applies cleanly and
 *     disables RLS, drops a policy and drops a table, while the scanner opened a
 *     phantom body at the first `$q$`, closed it at the second, and rendered the
 *     tables it had just dropped as `RLS ENABLED · FORCED`. The corroborating
 *     rule is that `AS$$SELECT 1$$` is a PostgreSQL SYNTAX ERROR and `AS $$…$$`
 *     is not: `AS$$SELECT` lexes as one identifier.
 *
 * ⚠️ WRITE IT ONCE. Two copies of a lexical rule is how the splitter came to
 * hold a second approximation of `closeQuote` and read
 * `DEFAULT E'a\'b', DISABLE ROW LEVEL SECURITY` as one action.
 *
 * NON-ASCII IS AN IDENTIFIER CHARACTER. `\200-\377` is a BYTE range, and every
 * byte of a non-ASCII character's UTF-8 encoding falls inside it, so in a
 * JavaScript string the faithful test is "code point ≥ 0x80" — not a Latin-1
 * range, which would exclude everything above U+00FF that PostgreSQL accepts.
 *
 * `"` is in the class and is deliberately WIDER than PostgreSQL, which starts a
 * fresh token after a closing `"`. It is the behaviour the E-string guard
 * already shipped, and it fails toward refusal rather than toward a swallow:
 * `AS"x"$$ … $$` is refused as an unterminated dollar-quoted body, because the
 * `$$` that would have opened it is read as ordinary text and the `$$` that
 * would have closed it opens one instead. Over-refusal, and named.
 */
const IDENT_CONT = /[a-z0-9_$"]|[^\x00-\x7f]/i
function continuesIdentifier(text, i) {
  return IDENT_CONT.test(text[i - 1] ?? '')
}

/**
 * End offset (exclusive) of the quoted run whose opening delimiter is at `start`,
 * or -1 when it never closes. `''` and `""` escape.
 *
 * `backslashEscapes` is true only for `E'…'`, where `\'` is a quote and `\\` is a
 * backslash. It is false everywhere else on purpose: in a standard-conforming
 * literal `'a\'` ENDS at that quote, and honouring the backslash there would
 * swallow the rest of the file exactly the way the E-string bug did, in the
 * opposite direction.
 */
function closeQuote(text, start, quote, backslashEscapes = false) {
  let i = start + 1
  while (i < text.length) {
    if (backslashEscapes && text[i] === '\\') {
      i += 2
      continue
    }
    if (text[i] === quote) {
      if (text[i + 1] === quote) {
        i += 2
        continue
      }
      return i + 1
    }
    i += 1
  }
  return -1
}

/**
 * The dollar-quote tag opening at `i` — `$$` or `$fn$` — or null.
 *
 * TWO THINGS MAKE THIS SAFE TO TEST AT EVERY POSITION, and only one of them was
 * here:
 *
 *   - THE TRAILING `$`. A positional `$1`, or a lone `$`, has no closing
 *     delimiter and is not a tag. Unpin it and the scanner opens a body on a
 *     parameter marker.
 *   - THE CHARACTER TO THE LEFT. `a$q$` is ONE identifier in PostgreSQL, so the
 *     `$` cannot open anything. See `continuesIdentifier` — this is #159 F1, and
 *     the guard is the one `quotedRun` already carries, not a second copy of it.
 *
 * ⚠️ THE TAG'S OWN ALPHABET IS PostgreSQL's `dolq_start`/`dolq_cont`, which is
 * `ident_start`/`ident_cont` MINUS `$` (so `$a$b$` is the tag `$a$` followed by
 * `b$`, not a four-character tag) and INCLUDING the high-byte range (so `$é$`
 * opens, which the old ASCII-only class refused — an over-refusal, but the same
 * root cause as F1 and fixed with it).
 */
const DOLLAR_TAG = /^\$(?:(?:[a-z_]|[^\x00-\x7f])(?:[a-z0-9_]|[^\x00-\x7f])*)?\$/i
function dollarTag(text, i) {
  if (text[i] !== '$') return null
  if (continuesIdentifier(text, i)) return null
  return DOLLAR_TAG.exec(text.slice(i, i + 64))?.[0] ?? null
}

/**
 * An extension's install script is schema this scanner never reads, so a prefix
 * allowance would contradict its fail-closed contract. `pgcrypto` is audited as
 * render-neutral; every other extension stays refused until it is audited too.
 *
 * The expression is `$`-anchored because `CASCADE` may install objects the
 * statement does not name. Accepting a `CREATE EXTENSION pgcrypto` prefix would
 * therefore depict an unread schema as complete. Quoted names stay exact while
 * unquoted PostgreSQL identifiers retain their ordinary case folding.
 */
const RENDER_NEUTRAL_EXTENSIONS = new Set(['pgcrypto'])
const CREATE_RENDER_NEUTRAL_EXTENSION = new RegExp(
  String.raw`^create\s+extension\s+(?:if\s+not\s+exists\s+)?(")?([a-z0-9_]+)\1\s*(?:with\s+schema\s+[a-z0-9_"]+\s*)?;?$`,
  'i',
)

function isRenderNeutralExtension(statement) {
  const match = CREATE_RENDER_NEUTRAL_EXTENSION.exec(statement)
  if (!match) return false
  return match[1] === '"'
    ? RENDER_NEUTRAL_EXTENSIONS.has(match[2])
    : RENDER_NEUTRAL_EXTENSIONS.has(match[2].toLowerCase())
}

/**
 * Statement forms this scanner genuinely understands and renders on the page.
 * Anything outside this list is a REFUSAL, not a silent omission.
 *
 * `ALTER TABLE` is NOT here — see LIST_ALTER_ACTIONS. Its entries used to
 * be, `^`-anchored with no `$`, and that is exactly how a statement came to be
 * judged by its first action alone.
 *
 * `CREATE FUNCTION` is here under the owner's S-2 ruling: migrations carry a
 * `SECURITY DEFINER` function, and the page has nothing to say about it beyond
 * not pretending it read a schema it did not. Its dollar-quoted body is opaque —
 * neither scanned as DDL nor matched for RLS — which is what the scanner above
 * delivers by never leaving the body's lexical state.
 *
 * `CREATE INDEX` is here under the second half of this file's own refusal
 * message — "add it to RECOGNISED_DDL if it genuinely does not change what the
 * page depicts." It does not: the C4 database section draws tables, columns,
 * policies and the enable/force badges, and an index is a performance artefact
 * with no representation there and no boundary to move.
 *
 * ⚠️ AND THE `^`-ANCHOR-WITH-NO-`$` TRAP DESCRIBED ABOVE FOR `ALTER TABLE` DOES
 * NOT REACH IT, WHICH IS WHY A PREFIX IS SAFE HERE AND WAS NOT THERE. That trap
 * exists because `ALTER TABLE` takes a COMMA-SEPARATED LIST OF ACTIONS, so a
 * recognised head could carry an unrecognised `DISABLE ROW LEVEL SECURITY` in its
 * tail. `CREATE INDEX` has no action list: its grammar is
 * `CREATE [UNIQUE] INDEX [CONCURRENTLY] [name] ON table (…) [WHERE …]`, the tail
 * is an index definition and nothing else, and a second statement after it is a
 * second statement — the scanner splits before it matches. There is nothing for a
 * tail to smuggle.
 *
 * 🛑 `UPDATE` IS HERE AND IT IS THE FIRST DML STATEMENT IN THE LIST. G88's
 * expand/contract is ADD NULLABLE → BACKFILL → SET NOT NULL, and the BACKFILL is
 * an `UPDATE`. Without it the only `ADD COLUMN … NOT NULL` form this scanner
 * accepts is the single-statement one, which PostgreSQL refuses outright against
 * a table that has rows — so the guard was requiring the un-migratable shape.
 * An `UPDATE` on an ordinary table changes ROWS, and this page depicts SCHEMA:
 * tables, columns, policies, the enable/force badges and the grants. There is
 * nothing in it for row data to move, which is the second half of this file's
 * own refusal message.
 *
 * ⚠️ EXCEPT AGAINST A SYSTEM CATALOGUE, WHICH IS WHY THIS ENTRY IS NOT A BARE
 * `^update\b`. `UPDATE pg_class SET relrowsecurity = false` turns row-level
 * security off by writing the catalogue directly — the page would keep printing
 * `RLS ENABLED · FORCED`, and `check-c4-freshness.mjs` would stay green because
 * it re-derives the same wrong answer. That is the precise failure
 * `refuseUnrecognisedDdl` exists to prevent, arriving as DML instead of as DDL.
 * The negative lookahead refuses `pg_*` and `information_schema.*`, qualified or
 * not. A migration has no business writing either, so nothing legitimate is lost.
 */
/**
 * 🛑 `ALTER POLICY` IS HERE BECAUSE IT IS TAUGHT BELOW, NOT BECAUSE IT IS
 * HARMLESS — AND THE DISTINCTION IS THE WHOLE OF THIS FILE'S REFUSAL MESSAGE.
 * A policy's `USING` and `WITH CHECK` expressions ARE rendered, so an `ALTER
 * POLICY` that this scanner merely tolerated would leave the page printing
 * `0005`'s predicate for a policy `0008` replaced — precisely the
 * "depicts a schema it has not fully read" failure, arriving through a
 * statement form nobody had met. `applyAlterPolicy()` REPLACES the captured
 * expressions and REFUSES if the policy was never created, because altering a
 * policy the scanner never saw means it is rendering nothing where something
 * exists. Added with `db/migrations/0008_staff_grant_selection.sql` (S-21),
 * which extends `session_selection_restrictive` rather than dropping and
 * re-creating it.
 *
 * 🛑 `INSERT INTO` IS HERE FOR `UPDATE`'s REASON, WORD FOR WORD, AND CARRIES
 * `UPDATE`'s NEGATIVE LOOKAHEAD FOR THE SAME REASON. An insert on an ordinary
 * table changes ROWS and this page depicts SCHEMA — tables, columns, policies,
 * the enable/force badges and the grants — and `0008` seeds four reference
 * tables whose CONTENT is governance data rather than structure. Against a
 * system catalogue it would be a different statement entirely: `INSERT INTO
 * pg_policy …` is not a thing a migration has any business doing, and the
 * lookahead refuses `pg_*` and `information_schema.*` qualified or not, so
 * nothing legitimate is lost.
 *
 * 🛑 `CREATE TRIGGER` IS THE NEWEST ENTRY AND IT IS THE ONE THAT DESERVES THE
 * MOST SUSPICION, SO THE ARGUMENT IS WRITTEN OUT RATHER THAN ASSUMED. It
 * arrived with `db/migrations/0019_membership_revocation_voids_sessions.sql`
 * (G508), **the first trigger this schema has ever had** — `0005` says in its
 * own voice that there must never be a `CREATE FUNCTION` here, and until 19
 * Sep 2026 `grep -rn 'CREATE FUNCTION\|CREATE TRIGGER' db/` returned exactly
 * that comment and nothing else. `create function` was already on this list;
 * `create trigger` was not, because nothing had ever attached one.
 *
 * ⚠️ IT IS ADMITTED UNDER THE SECOND HALF OF THE REFUSAL MESSAGE — *"it
 * genuinely does not change what the page depicts"* — AND THAT IS A CLAIM
 * ABOUT THIS PAGE AND NOT ABOUT THE DATABASE. The C4 database section renders
 * tables, columns, the enable/force badges, the policy expressions and the
 * grants. **It renders no behaviour at all**, so there is nowhere on it a
 * trigger could appear, and tolerating one leaves nothing printed wrongly —
 * which is exactly the test `ALTER POLICY` had to pass and did not, and why
 * that form got `applyAlterPolicy()` rather than a line here.
 *
 * 🛑 AND THE HONEST OTHER HALF: A TRIGGER **DOES** CHANGE WHAT THE SCHEMA
 * DOES, so this entry is a statement that the PAGE is silent about behaviour,
 * not that the behaviour is unimportant. `0019`'s trigger writes
 * `tenant.session` whenever `tenant.membership.revoked_at` goes non-null, and
 * a reader of the C4 page cannot know that from the page. **If this page ever
 * grows a behaviour section, a trigger belongs in it and this line becomes the
 * thing that hid one.** The control that does cover it meanwhile is
 * `tests/db/membership-revocation.test.ts` §7, which reads `pg_trigger` and
 * `pg_proc` from the catalogue and fails on a SECOND trigger appearing in
 * schema `tenant` — so a trigger nobody argued for is a red gate even though
 * this line lets it past the renderer.
 */
/*
 * ⚠️ `drop trigger` JOINS `create trigger` ON 19 Sep 2026, UNDER `0035`, AND IT
 * IS ADMITTED ON THE SAME GROUND AND WITH THE SAME HONEST CAVEAT. A trigger's
 * `WHEN` clause is not an alterable property in PostgreSQL — there is no
 * `ALTER TRIGGER … WHEN` — so changing a firing condition MUST be a drop and a
 * recreate, exactly as `0027` had to drop and recreate a policy to change its
 * `FOR`. The page renders no behaviour, so a dropped trigger prints nothing
 * wrongly either.
 *
 * 🛑 THE ASYMMETRY IS THE THING TO NOTICE: a `DROP` with no matching `CREATE`
 * REMOVES behaviour and this line lets it past the renderer silently. The
 * control that covers it is the same one the `create trigger` note names —
 * `tests/db/membership-revocation.test.ts` §7 reads `pg_trigger` from the
 * catalogue and requires EXACTLY the one trigger, by name — so a migration
 * that drops it and forgets to recreate it is a red gate. **That assertion is
 * now load-bearing for two statement forms rather than one.**
 */
const RECOGNISED_DDL = [
  /^create\s+trigger\b/i,
  /^drop\s+trigger\b/i,
  /^create\s+schema\b/i,
  /^create\s+table\b/i,
  /^create\s+(?:unique\s+)?index\b/i,
  /* `DROP INDEX`, `0390` (G2903) — `CREATE INDEX`'s argument above, in the
   * other direction: an index has no representation on the page, and the
   * grammar's tail is a list of INDEX NAMES, so there is nothing for it to
   * smuggle. A dropped UNIQUE index can change what the DATABASE refuses, and
   * that is a test's to witness, not a diagram's to draw. */
  /^drop\s+index\b/i,
  /^create\s+policy\b/i,
  /^alter\s+policy\b/i,
  /^drop\s+policy\b/i,
  /^create\s+(?:or\s+replace\s+)?function\b/i,
  /^grant\b/i,
  /^revoke\b/i,
  /^comment\s+on\b/i,
  /^update\s+(?:only\s+)?(?!"?pg_|"?information_schema"?\s*\.)[a-z0-9_."]+\s/i,
  /^insert\s+into\s+(?!"?pg_|"?information_schema"?\s*\.)[a-z0-9_."]+[\s(]/i,
  /* G3886 (`0520`) — a VIEW, and only the one shape it is written in. The page
   * draws tables, columns, policies, the enable/force badges and the grants; a
   * view stores no row and moves no boundary the page draws — the boundary is
   * `0520`'s POLICY (rendered, `create policy` above) and its column GRANT
   * (rendered). Anchored at both ends and to `security_barrier`, so a view that
   * is not a barrier, or a `CREATE OR REPLACE` that rewrites one, is refused. */
  /^create\s+view\s+[a-z0-9_."]+\s+with\s+\(\s*security_barrier\s*=\s*true\s*\)\s+as\s+select\s[\s\S]+$/i,
  /* `ALTER VIEW … OWNER TO …` and NOTHING ELSE: `ALTER VIEW` also takes
   * `SET (…)`/`RESET`/`RENAME` actions, and only ownership is recognised. */
  /^alter\s+view\s+[a-z0-9_."]+\s+owner\s+to\s+[a-z0-9_"]+\s*;?\s*$/i,
  /* G4453 (control `0052`, S5) — `ALTER ROLE <name> NOLOGIN [PASSWORD NULL]`
   * and NOTHING ELSE. A role's LOGIN attribute and its password are not drawn:
   * the page's roles come from `db/env.ts` and its boundaries are grants and
   * policies. Anchored at both ends so `LOGIN`, `BYPASSRLS`, `SUPERUSER`,
   * `PASSWORD '…'` or `RENAME TO` — each of which WOULD widen a boundary — is
   * refused rather than recognised. Retiring a credential only narrows. */
  /^alter\s+role\s+[a-z0-9_"]+\s+nologin(?:\s+password\s+null)?\s*;?\s*$/i,
]

/** `ALTER TABLE <ref> <action> [, <action> …]` — PostgreSQL's actual grammar. */
const ALTER_TABLE_HEAD = /^alter\s+table\s+(?:if\s+exists\s+)?([a-z0-9_."]+)\s+([\s\S]+)$/i

/**
 * 🛑 EVERY ACTION IN THE LIST MUST BE RECOGNISED, NOT MERELY THE FIRST (#164).
 *
 * `RECOGNISED_DDL`'s `ALTER TABLE` entries were `^`-anchored with no `$`, and the
 * grammar is `ALTER TABLE name action [, …]`, so
 *
 *     ALTER TABLE tenant
 *       ADD COLUMN residency text NOT NULL DEFAULT 'sg',
 *       DISABLE ROW LEVEL SECURITY,
 *       NO FORCE ROW LEVEL SECURITY;
 *
 * was ACCEPTED on the strength of its first action, and the page went on printing
 * `RLS ENABLED · FORCED` for a table with neither. Before the plane-split slice
 * the only recognised `ALTER TABLE` form WAS the RLS toggle, so there was nothing
 * to hide behind; adding five more prefixes whitelisted an arbitrary tail on each.
 *
 * ⚠️ `$`-ANCHORING THE OLD ENTRIES IS NOT THE FIX and was tried first. It refuses
 * every legitimate multi-action migration — including the `ADD COLUMN` forms the
 * scanner exists to permit — turning an over-report into a hard gate failure four
 * stages before `check:c4`. The action list has to actually be parsed.
 *
 * ⚠️ `DISABLE`, `NO FORCE`, `OWNER TO` and `ALTER COLUMN` are absent from BOTH
 * lists below. The scanner READS enable/force and renders them as a badge but has
 * no representation for their removal, so recognising them anywhere would let the
 * one statement this guard exists to catch walk straight through. `OWNER TO` earns
 * its place for the same reason at one remove: a table's owner may disable RLS on
 * it, which is why 0001 revokes CREATE on schema `public`.
 *
 * 🛑 AND THERE ARE THREE LISTS, BECAUSE THERE ARE THREE DIFFERENT REASONS.
 *
 * They were TWO, and the second one — `SOLITARY_ALTER_ACTIONS` — reconciled two
 * test suites rather than describing PostgreSQL. Both of its problems were the
 * same mistake in opposite directions: it keyed on a STRUCTURE (does the action
 * stand alone?) where the property at stake is a BEHAVIOUR.
 *
 *   1. It refused `ALTER TABLE tenant DROP COLUMN status, ADD COLUMN residency
 *      text;` — a statement that DOES disclose its removal first, in the very
 *      position the rule claimed to care about. §5.1 inside a rule citing §5.1.
 *
 *   2. It listed `SET SCHEMA` as an ordinary list action, so
 *      `ALTER TABLE tenant ADD COLUMN residency text, SET SCHEMA control;`
 *      RELOCATED `public.tenant` to `control.tenant` — a plane-split relocation
 *      behind a benign first line, ACTED ON out of a statement PostgreSQL itself
 *      rejects outright.
 *
 * ⚠️ THE GRAMMAR IS THE AUTHORITY, NOT THE FIXTURES. PostgreSQL's `ALTER TABLE`
 * has several distinct forms. Only ONE of them is `ALTER TABLE name action [, …]`;
 * `SET SCHEMA`, `RENAME TO`, `RENAME COLUMN` and `ATTACH`/`DETACH PARTITION` are
 * SEPARATE FORMS that take no list at all. So a comma next to `SET SCHEMA` is not
 * a smuggled action, it is a syntax error — and a scanner that acts on invalid SQL
 * is depicting a database that cannot exist.
 *
 * LIST — genuine items of `action [, …]`, recognised anywhere in the list.
 * DISCLOSING — genuine list items in the grammar, which this scanner accepts only
 *   as the HEAD of the list. `DROP COLUMN` and `DROP CONSTRAINT` remove something
 *   the page depicts; at the head, the statement opens by naming the removal —
 *   the thing a refusal quotes, a reviewer reads, and `git log -p` shows. Behind
 *   an `ADD COLUMN` it does not: the statement reads as an addition. That is
 *   DELIBERATELY NARROWER THAN THE GRAMMAR, and narrower in the safe direction —
 *   valid SQL refused, never invalid SQL acted upon. It is stated over the ACTION
 *   LIST rather than over physical lines because a line break is not a semantic
 *   boundary: `ALTER TABLE t\n  DROP COLUMN c,\n  ADD COLUMN d int;` discloses,
 *   and whitespace must not decide whether a migration parses.
 * SOLITARY — not list actions in the grammar at all. `SET SCHEMA` is the only one
 *   this scanner renders, and it is valid only as the whole statement.
 *
 * ⚠️ AND THE OLD SECOND LIST WAS LOAD-BEARING IN ONE RESPECT WORTH KEEPING: every
 * statement it refused is refused still. `ADD COLUMN residency text, DROP COLUMN
 * name` remains a refusal, because the drop is not disclosed.
 *
 * ⚠️ `ADD COLUMN` NAMES A COLUMN AND THEN SAYS SOMETHING ABOUT IT — both halves
 * are required, matching the shape `ADD CONSTRAINT` already had. Without the
 * name, `ADD COLUMN` alone is a recognised action that applies nothing; without
 * the `\S` after it, `ADD COLUMN residency` is a column with no type, accepted
 * here and then silently dropped by `parseColumn`. The name class is ASCII, so
 * `ADD COLUMN a$q$ text` — legal PostgreSQL, since `$` is an identifier
 * character — is REFUSED. That is the safe direction and it is the right one:
 * `parseColumn` would not match `a$q$` either, so widening the class here would
 * buy a silent omission, which is the failure this whole file exists to prevent.
 */
/**
 * 🛑 `ALTER COLUMN … SET NOT NULL` IS HERE AND IT IS THE ONLY `ALTER COLUMN`
 * FORM IN ANY OF THESE THREE LISTS. Read why before adding a second.
 *
 * It is the CONTRACT half of G88's expand/contract — ADD NULLABLE, BACKFILL,
 * SET NOT NULL — and without it the only `NOT NULL` column this scanner accepts
 * is `ADD COLUMN c text NOT NULL` in one statement, which PostgreSQL refuses
 * against a table containing rows. The guard was enforcing the un-migratable form.
 *
 * ⚠️ IT IS TAUGHT, NOT WHITELISTED, AND THE DISTINCTION IS THE WHOLE POINT.
 * `applyAlterTable` sets `column.notNull`, because the page prints `NOT NULL` or
 * `nullable` from exactly that field. Passing the statement through a pass-list
 * without applying it would render a live constraint as absent — the under-report
 * direction, which is the one `refuseUnrecognisedDdl` exists to refuse.
 *
 * ⚠️ AND ITS OPPOSITES STAY REFUSED, DELIBERATELY. `DROP NOT NULL`, `SET DEFAULT`,
 * `DROP DEFAULT` and `TYPE …` are absent, for the same reason `DISABLE ROW LEVEL
 * SECURITY` is: each REMOVES or REPLACES something the page depicts, and a
 * relaxation that renders identically to the constraint it relaxed is exactly
 * the statement this file exists to catch. `SET NOT NULL` is the one direction
 * that only ever tightens. A form is added when a migration needs it and is
 * shown to be applied — not ahead of one, which is the posture
 * `tools/check-wire-mirror.mjs` states for its five concrete pairs.
 *
 * ✅ **`DROP NOT NULL` IS NO LONGER ABSENT — 20 Sep 2026, `db/migrations/0161`
 *    (R-D, the owner's) — AND THE PARAGRAPH ABOVE IS CORRECTED RATHER THAN
 *    DELETED, because it is the sentence that told a reader the form could not
 *    be added and because its last clause is the CONDITION this addition met.**
 *    *"A form is added when a migration needs it and is shown to be applied."*
 *    A migration needed it, and `applyAlterTable` APPLIES it —
 *    `column.notNull = false`, in a branch that refuses an unresolvable column
 *    exactly as `SET NOT NULL`'s does. **It went into
 *    `DISCLOSING_ALTER_ACTIONS` and not into this list**, because the
 *    distinction the paragraph draws is the right one: it REMOVES something
 *    the page depicts, so it may stand only first.
 *    ⚠️ **`SET DEFAULT`, `DROP DEFAULT` AND `TYPE …` STAY ABSENT** on exactly
 *    the reasoning above, unamended. `tests/tools/schema-scanner-vocabulary.test.mjs`
 *    still pins `SET DEFAULT` as a refusal — **and its `DROP NOT NULL` twin
 *    WENT RED IN THE GATE on the commit that made this change**, which is a
 *    tripwire working rather than a test breaking; it is replaced there by the
 *    positive assertion and the two edges, in the same commit.
 *
 * It is a LIST action rather than a DISCLOSING one because it discloses nothing
 * by standing first: it adds a constraint, and `ADD COLUMN` — the same direction
 * — is a list action too.
 */
const LIST_ALTER_ACTIONS = [
  /^enable\s+row\s+level\s+security$/i,
  /^force\s+row\s+level\s+security$/i,
  /^add\s+column\s+(?:if\s+not\s+exists\s+)?[a-z0-9_"]+\s+\S[\s\S]*$/i,
  /^add\s+constraint\s+[a-z0-9_"]+\s+\S[\s\S]*$/i,
  /^alter\s+(?:column\s+)?[a-z0-9_"]+\s+set\s+not\s+null$/i,
  /^validate\s+constraint\s+[a-z0-9_"]+$/i,
]

/**
 * The head of the `ALTER COLUMN` forms — the exemption in `malformedAction`.
 * ⚠️ **THIS SAID *"the one `ALTER COLUMN` form above"* UNTIL 20 Sep 2026 AND
 * THERE ARE TWO**: `SET NOT NULL` in `LIST_ALTER_ACTIONS` and `DROP NOT NULL`
 * in `DISCLOSING_ALTER_ACTIONS`. The pattern itself is unchanged — it was
 * always a HEAD and never a whole form — so the exemption covered the second
 * the moment it was admitted, which is why this is a comment correction and
 * not a code change.
 */
const ALTER_COLUMN_HEAD = /^alter\s+(?:column\s+)?[a-z0-9_"]+\s/i

/**
 * List actions accepted ONLY as the head of the list, so the removal is disclosed.
 *
 * ⚠️ `ALTER COLUMN … DROP NOT NULL` JOINED THESE TWO ON 20 Sep 2026, UNDER
 * `db/migrations/0161` (R-D). It is the OPPOSITE of the one `ALTER COLUMN` form
 * in `LIST_ALTER_ACTIONS` and it is deliberately in the OTHER list: `SET NOT
 * NULL` *"discloses nothing by standing first: it adds a constraint"*, and this
 * one takes one away. A relaxation riding in the tail of an `ADD COLUMN` is the
 * exact shape #164 records, so it may only stand first. `applyAlterTable`
 * APPLIES it — `column.notNull = false` — because a form recognised and not
 * applied would print `NOT NULL` for a column that no longer has one, which is
 * the OVER-report direction and the worse of the two.
 */
const DISCLOSING_ALTER_ACTIONS = [
  /^drop\s+column\s+(?:if\s+exists\s+)?[a-z0-9_"]+$/i,
  /^drop\s+constraint\s+(?:if\s+exists\s+)?[a-z0-9_"]+$/i,
  /^alter\s+(?:column\s+)?[a-z0-9_"]+\s+drop\s+not\s+null$/i,
]

/** NOT a list action in PostgreSQL's grammar — valid only as the entire statement. */
const SOLITARY_ALTER_ACTIONS = [/^set\s+schema\s+[a-z0-9_"]+$/i]

/** `{ ref, actions }` for an `ALTER TABLE`, or null when it is not one / is malformed. */
function parseAlterTable(statement) {
  const m = ALTER_TABLE_HEAD.exec(statement.replace(/;\s*$/, '').trim())
  if (!m) return null
  const actions = splitTopLevelCommas(m[2])
    .map((a) => a.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return actions.length > 0 ? { ref: m[1], actions } : null
}

/**
 * 🛑 AND AN ACTION MUST BE ONE ACTION.
 *
 * The membership tests above end in `\S[\s\S]*$` — a column or constraint
 * definition is not something this scanner parses, so its tail is deliberately
 * open. That open tail is a second way in, and it needs no comma at all:
 *
 *     ALTER TABLE tenant ADD COLUMN x text DISABLE ROW LEVEL SECURITY;
 *
 * is ONE action to the splitter, matches `add column …`, and was ACCEPTED. Same
 * class as the depth underflow in `topLevelScan`, same direction, same falsified
 * claim — PostgreSQL rejects it, and the scanner acted on it.
 *
 * So: no action-initial keyword may appear ANYWHERE BUT THE HEAD of an action.
 * The test runs over `topLevelScan`'s skeleton, which blanks literals, dollar
 * bodies and parenthesised groups, so `DEFAULT 'no force row level security'`
 * and `CHECK (locale <> '')` are data and stay data. The list is the actions
 * that could be smuggled and MATTER — every one of them changes something the
 * page depicts, or the posture behind it.
 *
 * ⚠️ IT IS NOT A LIST OF EVERY `ALTER TABLE` ACTION, and must not become one.
 * `ON DELETE SET NULL` is an ordinary part of a foreign key, and a rule broad
 * enough to catch a bare `SET` refuses the `ADD CONSTRAINT … REFERENCES` form
 * the vocabulary suite requires.
 */
const ACTION_HEAD =
  /(?:add|drop|validate)\s+(?:column|constraint)\b|alter\s+column\b|(?:enable|disable|no\s+force|force)\s+row\s+level\s+security\b|set\s+schema\b|owner\s+to\b|rename\s+(?:to|column|constraint)\b|(?:attach|detach)\s+partition\b/gi

/**
 * 🛑 A SECOND SCAN, BECAUSE `SET NOT NULL` IS A TAIL AND NOT A HEAD — AND THE
 * HOLE IT CLOSES IS OLDER THAN THE FORM THAT REVEALED IT.
 *
 *     ALTER TABLE tenant ADD COLUMN x text SET NOT NULL;
 *
 * is ONE action to the splitter, matches `add column …` on the strength of its
 * deliberately open tail, and was ACCEPTED before 16 Aug 2026 — the same
 * juxtaposition class as `ADD COLUMN x text DISABLE ROW LEVEL SECURITY` (#164),
 * which `ACTION_HEAD` does catch. PostgreSQL rejects the statement outright, so
 * the page was depicting a column no migration in this tree can create.
 *
 * ⚠️ IT CANNOT SIMPLY JOIN `ACTION_HEAD`, AND TRYING THAT IS HOW THIS ENDED UP
 * AS ITS OWN FUNCTION. `ACTION_HEAD` refuses its keywords ANYWHERE BUT INDEX 0 of
 * an action — and `SET NOT NULL` is never at index 0, not even in the legitimate
 * `ALTER COLUMN residency SET NOT NULL`, whose head is `alter column`. Adding it
 * there refuses the one form this file was just taught.
 *
 * So the rule is stated over the action's OWN head instead: a not-null toggle is
 * legitimate only inside an `ALTER [COLUMN] <name> …` action, and is smuggled
 * anywhere else. `DROP NOT NULL` is included even though no list admits it,
 * because a refusal that names the toggle reads better than one that names the
 * `ADD COLUMN` it hid behind — which is the whole argument for `offendingActions`.
 * Run over the skeleton, so `DEFAULT 'set not null'` stays data.
 */
const NOT_NULL_TOGGLE = /(?:set|drop)\s+not\s+null\b/gi

/** One action, judged by WHERE it stands as well as what it is. See the three lists. */
function isRecognisedAction(action, index, count) {
  if (malformedAction(action) !== null) return false
  if (LIST_ALTER_ACTIONS.some((re) => re.test(action))) return true
  if (index === 0 && DISCLOSING_ALTER_ACTIONS.some((re) => re.test(action))) return true
  return count === 1 && SOLITARY_ALTER_ACTIONS.some((re) => re.test(action))
}

/** Why this action is not one action, or null when it is. */
function malformedAction(action) {
  const scanned = topLevelScan(action)
  if (scanned.unbalanced) return 'unbalanced parentheses — PostgreSQL rejects this statement outright'
  ACTION_HEAD.lastIndex = 0
  const smuggled = [...scanned.skeleton.matchAll(ACTION_HEAD)].filter((m) => m.index > 0)
  if (smuggled.length > 0) {
    return `a second action (\`${smuggled[0][0]}\`) inside one — a list item is separated by a comma, not by juxtaposition`
  }
  if (!ALTER_COLUMN_HEAD.test(action)) {
    NOT_NULL_TOGGLE.lastIndex = 0
    const toggle = [...scanned.skeleton.matchAll(NOT_NULL_TOGGLE)][0]
    if (toggle !== undefined) {
      return `a not-null toggle (\`${toggle[0]}\`) outside an ALTER COLUMN — PostgreSQL rejects this statement outright`
    }
  }
  return null
}

function isRecognisedStatement(statement) {
  if (/^alter\s+table\b/i.test(statement)) {
    const alter = parseAlterTable(statement)
    if (alter === null) return false
    return alter.actions.every((a, i) => isRecognisedAction(a, i, alter.actions.length))
  }
  return isRenderNeutralExtension(statement) || RECOGNISED_DDL.some((re) => re.test(statement))
}

/**
 * The actions that made an `ALTER TABLE` unrecognised, for the refusal to name.
 *
 * ⚠️ THE FIRST LINE IS NOT ALWAYS ENOUGH, which is the point of this. A refusal
 * quotes 72 characters so it stays one readable line, and a multi-action ALTER is
 * routinely longer than that — `ALTER TABLE tenant ADD COLUMN x text DEFAULT
 * E'a\'b', DISABLE ROW LEVEL SECURITY;` is 80. The smuggled action is precisely
 * the part that falls off the end, so the refusal would quote the benign opening
 * and say nothing about what it refused. Naming the action closes that: the
 * message points at `DISABLE ROW LEVEL SECURITY`, not at the ADD COLUMN it hid
 * behind. A `SET SCHEMA` in a list is labelled for what it is — not a list action.
 */
function offendingActions(statement) {
  if (!/^alter\s+table\b/i.test(statement)) return []
  const alter = parseAlterTable(statement)
  if (alter === null) return []
  return alter.actions
    .filter((a, i) => !isRecognisedAction(a, i, alter.actions.length))
    .map((a) => {
      const malformed = malformedAction(a)
      const why = malformed !== null
        ? ` — ${malformed}`
        : SOLITARY_ALTER_ACTIONS.some((re) => re.test(a))
          ? ' — not a list action in PostgreSQL; valid only as the whole statement'
          : DISCLOSING_ALTER_ACTIONS.some((re) => re.test(a))
            ? ' — a removal is recognised only where it discloses itself, at the head of the list'
            : ''
      return `${a.slice(0, 60)}${why}`
    })
}

/**
 * 🛑 FAIL CLOSED ON DDL THIS SCANNER CANNOT ACCOUNT FOR.
 *
 * The scanner reads CREATE TABLE, CREATE POLICY, the RLS toggles and GRANT,
 * because that is the whole of what 0001 contains. G88 makes every future schema
 * change a forward-only ALTER in a NEW migration — and the page renders whatever
 * the scanner produces as "the built schema", with an RLS badge per table.
 *
 * The failure that motivates this is safety-DIRECTIONAL, which is why it refuses
 * rather than warns: a later `ALTER TABLE tenant DISABLE ROW LEVEL SECURITY` or
 * `DROP POLICY tenant_rls` is invisible to every regex here, so the page would go on
 * printing `RLS ENABLED · FORCED` and listing a policy that no longer exists — and
 * `check-c4-freshness.mjs` would stay GREEN, because it faithfully re-derives the
 * same wrong answer. A diagram that overstates isolation is worse than no diagram.
 *
 * `REVOKE` and `COMMENT ON` are recognised so they do not trip this, but note that
 * REVOKE is still NOT RENDERED: `REVOKE CREATE ON SCHEMA public FROM PUBLIC` in 0001
 * is load-bearing and appears nowhere on the page. That is a known gap, recorded
 * rather than hidden, and narrower than the one this function closes.
 */
/**
 * `ALTER POLICY <name> ON <table> [USING (…)] [WITH CHECK (…)]` — REPLACE the
 * captured expressions on the policy a previous migration created.
 *
 * 🛑 IT REFUSES WHEN THE POLICY IS UNKNOWN, AND THAT IS THE SAFETY DIRECTION
 *    RATHER THAN PEDANTRY. A silent `return` would leave the page rendering
 *    nothing for a policy that exists, or — worse, and this is the real case —
 *    rendering a STALE predicate while `check-c4-freshness.mjs` stayed green
 *    because it re-derives the same wrong answer. That is the exact failure
 *    `refuseUnrecognisedDdl` exists for, and a half-taught statement form
 *    reintroduces it one layer down.
 *
 * ⚠️ THE EXTRACTION MIRRORS `CREATE POLICY`'s CHARACTER FOR CHARACTER, INCLUDING
 *    ITS LIMITS. Both key the table with `[a-z0-9_]+`, so `tenant.session`
 *    keys as `tenant` in both — wrong, and wrong IDENTICALLY, which is what
 *    matters here: a different extraction would fail to find the policy it is
 *    meant to replace and would then refuse a legitimate migration. Fixing the
 *    schema-qualification is a separate change to both sites at once.
 *
 * ⚠️ A CLAUSE THAT IS ABSENT IS LEFT ALONE, NOT CLEARED. PostgreSQL's
 *    `ALTER POLICY` replaces only the clauses named; omitting `USING` keeps the
 *    existing one, and this follows that rather than inventing a stricter rule.
 */
function applyAlterPolicy(policies, statement, file) {
  const m = /alter\s+policy\s+([a-z0-9_]+)\s+on\s+([a-z0-9_]+)([\s\S]*?);/i.exec(statement)
  if (!m) {
    throw new Error(
      `db/migrations/${file} contains an ALTER POLICY this scanner cannot parse:\n    ` +
        `${statement.split('\n')[0].slice(0, 72)}…\n\n  Refusing rather than rendering a ` +
        `policy predicate it has not read.`,
    )
  }
  const [, name, table, tail] = m
  const target = policies.find((p) => p.name === name && p.table === table)
  if (target === undefined) {
    throw new Error(
      `db/migrations/${file} alters policy \`${name}\` on \`${table}\`, which no earlier ` +
        `migration in this corpus creates.\n\n  Refusing rather than dropping the change on ` +
        `the floor: the page would render nothing, or something stale, for a policy that ` +
        `exists — and check-c4-freshness.mjs would stay GREEN because it re-derives the ` +
        `same wrong answer.`,
    )
  }
  const using = /using\s*\(([\s\S]*?)\)\s*(?:with\s+check|$)/i.exec(tail)?.[1]
  const withCheck = /with\s+check\s*\(([\s\S]*?)\)\s*$/i.exec(tail)?.[1]
  if (using !== undefined) target.using = using.replace(/\s+/g, ' ').trim()
  if (withCheck !== undefined) target.withCheck = withCheck.replace(/\s+/g, ' ').trim()
  target.source = `${target.source} + ${file}`
}

/**
 * `DROP POLICY <name> ON <table>;` — REMOVE the policy from the model.
 *
 * 🛑 THIS IS TAUGHT RATHER THAN ADDED TO `RECOGNISED_DDL`, AND THE DISTINCTION
 * IS THE WHOLE POINT OF THAT LIST'S REFUSAL MESSAGE: *"add it to
 * RECOGNISED_DDL if it genuinely does not change what the page depicts."*
 * A dropped policy changes it more than almost any other statement — the page
 * would go on rendering a predicate the database no longer enforces, and
 * `check-c4-freshness.mjs` would stay GREEN because it re-derives the same
 * wrong answer from the same unread statement.
 *
 * ⚠️ IT ARRIVED WITH `0027`, WHICH DROPS AND RECREATES A POLICY BECAUSE
 * `ALTER POLICY` CANNOT CHANGE A POLICY'S COMMAND (`FOR ALL` → `FOR UPDATE`
 * is not alterable in PostgreSQL). So the drop is forced by the repair, not
 * chosen — and the scanner refused the migration until it could read it,
 * which is the refusal working exactly as its message promises.
 *
 * ⚠️ REFUSES AN UNKNOWN TARGET, mirroring `applyAlterPolicy()` character for
 * character and for its reason: dropping a policy no earlier migration in this
 * corpus creates means the scanner has misread something, and silently doing
 * nothing would render a stale page that the freshness checker cannot see.
 */
function applyDropPolicy(policies, statement, file) {
  /*
   * ⚠️ `on\s+([a-z0-9_]+)` MIRRORS `CREATE POLICY`'s CAPTURE EXACTLY, DOT AND
   * ALL, AND THAT IS DELIBERATE RATHER THAN CORRECT. Neither pattern consumes
   * a schema qualifier, so `ON tenant.session` is recorded against a table
   * literally named `tenant` — every schema-qualified policy in this corpus
   * is. Normalising the schema away HERE would be more correct in isolation
   * and would stop the lookup finding anything, because the record it is
   * looking for was written by the unnormalised pattern.
   *
   * 🛑 SO THIS MIRRORS THE DEFECT ON PURPOSE AND NAMES IT. Fixing it properly
   * means changing `CREATE`, `ALTER` and `DROP` together in one commit, and a
   * scanner half-normalised is a scanner whose three statement forms disagree
   * about which table they are talking about. Recorded, not silently widened.
   */
  const m = /drop\s+policy\s+(?:if\s+exists\s+)?([a-z0-9_]+)\s+on\s+([a-z0-9_]+)/i.exec(statement)
  if (!m) {
    throw new Error(
      `db/migrations/${file} contains a DROP POLICY this scanner cannot parse:\n    ` +
        `${statement.split('\n')[0].slice(0, 72)}…\n\n  Refusing rather than rendering a ` +
        `schema in which a policy it has not read may or may not still exist.`,
    )
  }
  const [, name, table] = m
  const at = policies.findIndex((p) => p.name === name && p.table === table)
  if (at === -1) {
    throw new Error(
      `db/migrations/${file} drops policy \`${name}\` on \`${table}\`, which no earlier ` +
        `migration in this corpus creates.\n\n  Refusing rather than dropping the change on ` +
        `the floor: the page would render a policy set that never matched the database, ` +
        `and check-c4-freshness.mjs would stay GREEN because it re-derives the same wrong ` +
        `answer.`,
    )
  }
  policies.splice(at, 1)
}

function refuseUnrecognisedDdl(file, statements) {
  const unrecognised = statements
    .filter((s) => !isRecognisedStatement(s))
    .map((s) => [s.split('\n')[0].slice(0, 72), offendingActions(s)])
  if (unrecognised.length > 0) {
    throw new Error(
      `db/migrations/${file} contains ${unrecognised.length} statement(s) this scanner does not ` +
        `understand, so the C4 database section would depict a schema it has not fully read:\n` +
        unrecognised
          .map(([head, actions]) =>
            [`    ${head}…`, ...actions.map((a) => `      ↳ unrecognised action: ${a}`)].join('\n'),
          )
          .join('\n') +
        `\n\n  Refusing rather than rendering a partial schema as a complete one. Either teach\n` +
        `  tools/planner/extract-c4-data.mjs the statement form, or add it to RECOGNISED_DDL\n` +
        `  if it genuinely does not change what the page depicts. An ALTER that disables RLS\n` +
        `  must never be the thing that slipped past.`,
    )
  }
}

function splitQualifiedName(raw) {
  const parts = raw.replace(/"/g, '').split('.')
  return parts.length === 1
    ? { schema: 'public', name: parts[0] }
    : { schema: parts.slice(0, -1).join('.'), name: parts.at(-1) }
}

/**
 * Split on commas at paren depth zero — a `CREATE TABLE` body, or an `ALTER TABLE`
 * action list.
 *
 * ⚠️ QUOTE-AWARE, not merely depth-aware. `ADD CONSTRAINT … CHECK (locale <> '')`
 * is protected by its parens, but a comma or an unbalanced paren inside a literal
 * is not, and this splitter now decides whether a `DISABLE` hidden in an action
 * list is seen. It reuses the scanner's own quote handling — `quotedRun`, E-strings
 * included — rather than a second approximation of it. A second approximation is
 * exactly how `DEFAULT E'a\'b', DISABLE ROW LEVEL SECURITY` came to be read as ONE
 * action: the splitter ended the literal early, re-opened one at the next quote,
 * and ate the comma the DISABLE was behind.
 *
 * An UNTERMINATED run cannot reach here — `scanSql` refuses the whole file first,
 * and every input to this function is a slice of a statement it returned. The
 * `text.length` fallbacks below are therefore unreachable rather than lenient, and
 * they are kept only so a future caller with a raw fragment degrades by
 * over-grouping (one action too few, judged and refused) instead of by silently
 * splitting inside a literal.
 */
function splitTopLevelCommas(text) {
  return topLevelScan(text).parts
}

/**
 * 🛑 `depth` HAS A FLOOR, AND UNDERFLOW IS A FINDING RATHER THAN A SHRUG.
 *
 * `depth--` was unfloored, so ONE stray `)` drove it to -1 and NO LATER COMMA
 * WAS EVER TOP-LEVEL AGAIN. The action list stopped being split, the smuggled
 * action was never judged, and
 *
 *     ALTER TABLE tenant ADD COLUMN x text), DISABLE ROW LEVEL SECURITY;
 *
 * was ACCEPTED — as were the `SET SCHEMA` and `DROP COLUMN` variants. PostgreSQL
 * rejects all three, so no such migration ever ran, and that is exactly why they
 * matter: the rule above this file's action lists is "valid SQL refused, never
 * invalid SQL acted upon", and each of them is invalid SQL acted upon.
 *
 * Clamping alone is not the whole answer, because it makes the scanner LENIENT
 * about the `)` it just ignored. So the underflow is REPORTED: `unbalanced` is
 * true when a `)` arrived with nothing open, or when something was still open at
 * the end, and `isRecognisedAction` turns that into a refusal. The clamp is what
 * makes the refusal INFORMATIVE — the comma is still seen, so the DISABLE behind
 * it is split out, judged, and NAMED in the message.
 *
 * `skeleton` is the run with every quoted/dollar-quoted region and everything
 * inside parentheses replaced by spaces, offsets preserved. It is what lets a
 * caller ask "does a second action keyword appear at TOP LEVEL here?" without
 * false-refusing `DEFAULT 'disable row level security'` or `CHECK (locale <> '')`.
 */
function topLevelScan(text) {
  const parts = []
  let buf = ''
  let skeleton = ''
  let depth = 0
  let unbalanced = false
  let i = 0
  const hide = (n) => ' '.repeat(n)
  while (i < text.length) {
    const ch = text[i]
    const quoted = quotedRun(text, i)
    if (quoted !== null) {
      const end = quoted.end === -1 ? text.length : quoted.end
      buf += text.slice(i, end)
      skeleton += hide(end - i)
      i = end
      continue
    }
    const tag = dollarTag(text, i)
    if (tag !== null) {
      const close = text.indexOf(tag, i + tag.length)
      const end = close === -1 ? text.length : close + tag.length
      buf += text.slice(i, end)
      skeleton += hide(end - i)
      i = end
      continue
    }
    if (ch === '(') depth += 1
    else if (ch === ')') {
      if (depth === 0) unbalanced = true
      else depth -= 1
    }
    skeleton += depth === 0 && ch !== ')' && ch !== '(' ? ch : ' '
    if (ch === ',' && depth === 0) {
      parts.push(buf)
      buf = ''
    } else buf += ch
    i += 1
  }
  if (buf.trim()) parts.push(buf)
  return { parts, skeleton, unbalanced: unbalanced || depth !== 0 }
}

function parseColumn(raw) {
  const line = raw.replace(/\s+/g, ' ').trim()
  const cm = /^([a-z0-9_]+)\s+([a-z0-9_]+(?:\s*\([^)]*\))?(?:\[\])?)\s*(.*)$/i.exec(line)
  if (!cm) return null
  const rest = cm[3] || ''
  const isPk = /primary\s+key/i.test(rest)
  return {
    name: cm[1],
    type: cm[2].toLowerCase(),
    notNull: isPk || /not\s+null/i.test(rest),
    primaryKey: isPk,
    default: (/default\s+([^,]+?)(?:\s+not\s+null|\s*$)/i.exec(rest)?.[1] ?? '').trim(),
    references: (/references\s+([a-z0-9_.]+\s*\([^)]*\))/i.exec(rest)?.[1] ?? '').replace(/\s+/g, ''),
  }
}

/**
 * 🛑 RESOLVE A REFERENCE TO A TABLE OBJECT, AT THE POINT IN THE SEQUENCE WHERE IT
 * IS WRITTEN. This is the whole of #164's defect 2 and it is a TEMPORAL rule.
 *
 * The RLS matcher used to build one regex per table with an OPTIONAL qualifier —
 * `(?:control\.)?tenant` — and run it over the whole corpus at the end. So
 * `0001`'s bare `ALTER TABLE tenant ENABLE ROW LEVEL SECURITY`, which resolves via
 * `search_path` to `public.tenant` and says nothing about any other schema, also
 * satisfied the pattern for `control.tenant` — the very table the control-plane
 * split creates. A pure name collision, printing a protection that does not exist
 * on the page a reader consults to learn the posture.
 *
 * ⚠️ MAKING THE QUALIFIER MANDATORY IS NOT THE FIX. `0001` enables RLS with BARE
 * names, so a mandatory qualifier flips `public.tenant` and `public.tenant_contact`
 * to false — an UNDER-report, and it loses the only positive enforcement invariant
 * 3 has.
 *
 * ⚠️ NEITHER IS "bind a bare name to the table whose CURRENT schema is public",
 * which is what #164's implementation note 3 proposed and the owner has since
 * corrected on the issue. `ALTER TABLE x SET SCHEMA y` RELOCATES a table; RLS
 * enablement is a property of the TABLE and survives the move. Under that rule a
 * table enabled by a bare name in `0001` and relocated later — exactly what the
 * plane split does to `tenant` and `tenant_contact` — would flip to false after
 * the move. Factually wrong, and an under-report of a genuine protection.
 *
 * The correct model binds to the OBJECT and lets the fact travel with it:
 *
 *   - a QUALIFIED `schema.name` names the table currently in that schema;
 *   - a BARE `name` names the table that reference would resolve to AT THAT POINT
 *     in the sequence — the one currently in `public`;
 *   - once bound, what was asserted attaches to the table and survives any later
 *     `SET SCHEMA`.
 *
 * Which is why statements are now processed in order and this is called as each
 * one is read, rather than a regex sweep over the finished corpus. `0001` enables
 * `tenant` while it is in `public`, a later migration moves it, and it reads
 * `rlsEnabled=true` under schema `tenant`; `control.tenant`, a different table
 * created later, reads false.
 *
 * 🛑 AND THERE IS NO SINGLE-MATCH FALLBACK. There was one — "if exactly one table
 * anywhere bears this name, bind to it" — described as "the only reading of it
 * that names anything at all". That is the wrong test, in three ways:
 *
 *   - IT NAMES A TABLE POSTGRESQL WOULD NOT. Nothing in this tree puts `control`
 *     on the `search_path`; 0001 revokes CREATE on `public` precisely to keep the
 *     app out of schema management. `CREATE TABLE control.registry (…);
 *     ALTER TABLE registry ENABLE ROW LEVEL SECURITY;` is an ERROR when applied,
 *     and the scanner rendered `control.registry[rls=true]` from it — a badge for
 *     a protection that no runnable migration ever switched on. #164's defect 2
 *     was narrowed by the binding rule above and closed only by removing this.
 *
 *   - IT IS SORT-ORDER DEPENDENT, and determinism is a hard requirement in this
 *     file's header. The same two statements bind differently depending on
 *     whether some other file creating a same-named `public` table sorts before
 *     or after them. The existing RED case for defect 2 passed only because its
 *     fixture bundles `0001`, which supplies a `public.tenant` for `.find` to win
 *     on; drop that file and the badge flips.
 *
 *   - IT IS A GUESS DRESSED AS A RESOLUTION. "Exactly one candidate" is a fact
 *     about the corpus, not about the reference.
 *
 * So: a bare reference resolves to `public`, or it resolves to NOTHING. What to
 * do with nothing is `applyAlterTable`'s decision, and it is recorded there.
 */
function findTable(tables, rawName) {
  const target = splitQualifiedName(rawName)
  if (rawName.replace(/"/g, '').includes('.')) {
    return tables.find((t) => t.schema === target.schema && t.name === target.name)
  }
  return tables.find((t) => t.schema === 'public' && t.name === target.name)
}

/**
 * ⚠️ KEPT, AND STILL LOAD-BEARING. The interpolation it was written for — a table
 * name spliced into the RLS pattern — is gone, replaced by the structural
 * resolution above, which removes that whole class rather than escaping it. A
 * constraint name is still spliced into a regex below, and `DOT_TRAP` in the
 * vocabulary suite records what an unescaped `.` costs: `controlXtenant` matching
 * `control.tenant` and OVERSTATING isolation.
 */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Apply one `ALTER TABLE` to the table its reference names NOW.
 *
 * The reference is resolved once, before any action runs. Since the F2 correction
 * that is belt AND braces: `SET SCHEMA` is no longer a list action, so no action
 * in a list can change what the rest of its own list refers to. The single
 * resolution stays because it states the intent structurally rather than relying
 * on the reader to re-derive that fact from three regex lists.
 *
 * 🛑 AN UNRESOLVABLE REFERENCE IS A REFUSAL, NOT A NO-OP. This was "ignored rather
 * than fatal", and the choice is now the other way. The reasoning:
 *
 *   - A reference that resolves to no table the scanner has read is a statement
 *     that CANNOT HAVE RUN as written — `ALTER TABLE registry …` with no
 *     `public.registry` in existence at that point is an error in PostgreSQL, not
 *     a no-op. Silently skipping it means the page depicts the schema that WOULD
 *     have existed had the migration been different, which is the same species of
 *     lie as rendering a partial file as a whole one.
 *   - Ignoring is quiet in the wrong place. `refuseUnrecognisedDdl` has already
 *     admitted the statement as one this scanner understands; dropping it here
 *     leaves nothing on the page and nothing in the gate, and the reader cannot
 *     tell an ALTER that did nothing from one that was never written.
 *   - The direction is not the argument. A skipped `ENABLE` under-reports and a
 *     skipped `SET SCHEMA` misplaces a table on the page; both are wrong, and
 *     refusing is the only outcome that is wrong in neither direction.
 *
 * ⚠️ THE COST IS REAL AND ACCEPTED: a corpus that alters a table created outside
 * `db/migrations/` now fails the gate rather than rendering around it. That is the
 * fail-closed trade this whole guard exists to make, and G88's forward-only rule
 * means every such table IS in this corpus.
 */
function applyAlterTable(tables, statement, file) {
  const alter = parseAlterTable(statement)
  if (!alter) return
  const table = findTable(tables, alter.ref)
  if (!table) {
    const bare = !alter.ref.replace(/"/g, '').includes('.')
    throw new Error(
      `db/migrations/${file} alters \`${alter.ref}\`, an unresolvable reference — it names no ` +
        `table this scanner has read:\n` +
        `    ${statement.split('\n')[0].slice(0, 72)}…\n\n` +
        (bare
          ? `  A BARE reference resolves through search_path to \`public.${splitQualifiedName(alter.ref).name}\`,\n` +
            `  and no such table has been created at this point in the sequence. If the table lives\n` +
            `  in another schema, qualify the reference — PostgreSQL requires it too, and binding a\n` +
            `  bare name to the one table that happens to share it renders a protection nothing\n` +
            `  switched on.\n`
          : `  No table of that name exists in that schema at this point in the sequence.\n`) +
        `\n  Refusing rather than rendering a partial schema as a complete one. An ALTER that\n` +
        `  cannot resolve cannot have run, and a page that skips it depicts a database no\n` +
        `  migration in this tree produces.`,
    )
  }

  for (const action of alter.actions) {
    const setSchema = /^set\s+schema\s+([a-z0-9_"]+)$/i.exec(action)
    const addColumn = /^add\s+column\s+([\s\S]+)$/i.exec(action)
    const dropColumn = /^drop\s+column\s+(?:if\s+exists\s+)?([a-z0-9_"]+)$/i.exec(action)
    const dropConstraint = /^drop\s+constraint\s+(?:if\s+exists\s+)?([a-z0-9_"]+)$/i.exec(action)
    const addConstraint = /^add\s+(constraint\s+[a-z0-9_"]+[\s\S]+)$/i.exec(action)
    const setNotNull = /^alter\s+(?:column\s+)?([a-z0-9_"]+)\s+set\s+not\s+null$/i.exec(action)
    const dropNotNull = /^alter\s+(?:column\s+)?([a-z0-9_"]+)\s+drop\s+not\s+null$/i.exec(action)
    const validateConstraint = /^validate\s+constraint\s+([a-z0-9_"]+)$/i.exec(action)

    // ENABLE and FORCE are two independent facts and are recorded independently.
    // Deriving one from the other prints `FORCED` for a table that only has
    // ENABLE — and FORCE is what subjects the owner to the policy.
    if (/^enable\s+row\s+level\s+security$/i.test(action)) {
      table.rlsEnabled = true
    } else if (/^force\s+row\s+level\s+security$/i.test(action)) {
      table.rlsForced = true
    } else if (setSchema) {
      table.schema = setSchema[1].replace(/"/g, '')
    } else if (addColumn) {
      const column = parseColumn(addColumn[1])
      if (column) table.columns.push(column)
    } else if (dropColumn) {
      const name = dropColumn[1].replace(/"/g, '')
      table.columns = table.columns.filter((c) => c.name !== name)
    } else if (dropConstraint) {
      const name = escapeRegex(dropConstraint[1].replace(/"/g, ''))
      table.constraints = table.constraints.filter(
        (c) => !new RegExp(`^constraint\\s+"?${name}"?\\b`, 'i').test(c),
      )
    } else if (addConstraint) {
      table.constraints.push(addConstraint[1])
    } else if (validateConstraint) {
      const normaliseIdentifier = (identifier) => {
        const quoted = /^"([^"]+)"$/.exec(identifier)
        return quoted ? quoted[1] : identifier.toLowerCase()
      }
      const name = normaliseIdentifier(validateConstraint[1])
      const index = table.constraints.findIndex(
        (constraint) => {
          const candidate = /^constraint\s+("[^"]+"|[a-z0-9_]+)/i.exec(constraint)?.[1]
          return candidate !== undefined && normaliseIdentifier(candidate) === name
        },
      )
      if (index === -1) {
        throw new Error(
          `db/migrations/${file} validates \`${alter.ref}.${validateConstraint[1]}\`, an unresolvable constraint ` +
            'this scanner has not read. Refusing rather than rendering a partial schema as a complete one.',
        )
      }
      /**
       * 🛑 THE UNRESOLVABLE-CONSTRAINT REFUSAL ABOVE IS THE WHOLE GUARD. A
       * SECOND ONE STOOD HERE UNTIL 16 Aug 2026 AND IS REMOVED, NOT MOVED.
       *
       * It threw when the resolved constraint text did not end in `NOT VALID`,
       * saying *Refusing rather than rendering a migration PostgreSQL rejects.*
       * **PostgreSQL does not reject it.** Verified against a live server,
       * PostgreSQL 14.18: `ALTER TABLE t ADD CONSTRAINT c CHECK (id <> '')`
       * validates immediately, and `ALTER TABLE t VALIDATE CONSTRAINT c` is then
       * accepted TWICE, each returning `ALTER TABLE`, with `pg_constraint`
       * `convalidated` staying `t` throughout. Re-validating a valid constraint
       * is a no-op, not an error.
       *
       * It also protected nothing. Without it the strip below simply does not
       * match, the branch is a no-op, and the depicted state is already correct
       * — which is the whole point: `VALIDATE` moves a constraint TO valid, and
       * a constraint the scanner reads without a `NOT VALID` marker is drawn as
       * valid already.
       *
       * §5.1. It was keyed on the landmark *the text I happened to store ends in
       * NOT VALID* rather than on the property *the page's constraint state
       * matches the database*.
       */
      table.constraints[index] = table.constraints[index].replace(/\s+not\s+valid$/i, '')
    } else if (setNotNull) {
      /**
       * 🛑 APPLIED, NOT TOLERATED. The page prints `NOT NULL` or `nullable` off
       * `column.notNull`, so recognising this form without writing the field
       * would render a live constraint as absent.
       *
       * ⚠️ A NAME THAT MATCHES NO COLUMN IS A REFUSAL, NOT A NO-OP. Every other
       * branch here is applied to a table the scanner has already resolved, and
       * an `ALTER COLUMN` naming a column that was never added is a migration
       * PostgreSQL rejects — the same class as the unresolvable table reference
       * above, one level down. Silently doing nothing would leave the page
       * depicting a schema no migration in this tree produces.
       */
      const name = setNotNull[1].replace(/"/g, '')
      const column = table.columns.find((c) => c.name === name)
      if (!column) {
        throw new Error(
          `db/migrations/${file} sets NOT NULL on \`${alter.ref}.${name}\`, a column this scanner ` +
            `has not read:\n    ${statement.split('\n')[0].slice(0, 72)}…\n\n` +
            `  No such column exists at this point in the sequence. Refusing rather than\n` +
            `  rendering a partial schema as a complete one — an ALTER that cannot resolve\n` +
            `  cannot have run.`,
        )
      }
      column.notNull = true
    } else if (dropNotNull) {
      /**
       * 🛑 `ALTER COLUMN … DROP NOT NULL` — TAUGHT ON 20 Sep 2026 UNDER
       *    `db/migrations/0161` (R-D), AND ADMITTED ON THIS FILE'S OWN TERMS
       *    RATHER THAN AROUND THEM.
       *
       * The `SET NOT NULL` note above says, in its own voice: *"ITS OPPOSITES
       * STAY REFUSED, DELIBERATELY. `DROP NOT NULL` … is absent, for the same
       * reason `DISABLE ROW LEVEL SECURITY` is: each REMOVES something the page
       * depicts, and a relaxation that renders identically to the constraint it
       * relaxed is exactly the statement this file exists to catch. … **A form
       * is added when a migration needs it and is shown to be applied — not
       * ahead of one.**"*
       *
       * **A migration needs it, and this branch is the "shown to be applied"
       * half.** `column.notNull = false` is written, so the page prints
       * `nullable` for `tenant.exception.explanation_summary` — which is what
       * the database now holds. Whitelisting the form without this line is the
       * failure the note names: the page would keep printing `NOT NULL` for a
       * column that lost it, and that is the OVER-report direction, which is
       * worse than the under-report `refuseUnrecognisedDdl` was built for
       * because a reader would trust a constraint that is gone.
       *
       * 🛑 IT IS A **DISCLOSING** ACTION AND NOT A LIST ACTION, WHICH IS WHERE
       *    IT DIFFERS FROM ITS OPPOSITE. `SET NOT NULL` is a list action
       *    because *"it discloses nothing by standing first: it adds a
       *    constraint"*. This one REMOVES one, so it joins `DROP COLUMN` and
       *    `DROP CONSTRAINT` in `DISCLOSING_ALTER_ACTIONS` — accepted only as
       *    the head of the list, so a removal can never ride in the tail of an
       *    `ADD COLUMN`.
       *
       * ⚠️ A NAME THAT MATCHES NO COLUMN IS A REFUSAL, NOT A NO-OP — the same
       *    rule and the same words as the branch above, because the failure is
       *    identical: an `ALTER COLUMN` naming a column that was never added is
       *    a migration PostgreSQL rejects.
       */
      const name = dropNotNull[1].replace(/"/g, '')
      const column = table.columns.find((c) => c.name === name)
      if (!column) {
        throw new Error(
          `db/migrations/${file} drops NOT NULL on \`${alter.ref}.${name}\`, a column this ` +
            `scanner has not read:\n    ${statement.split('\n')[0].slice(0, 72)}…\n\n` +
            `  No such column exists at this point in the sequence. Refusing rather than\n` +
            `  rendering a partial schema as a complete one — an ALTER that cannot resolve\n` +
            `  cannot have run.`,
        )
      }
      column.notNull = false
    }
  }
}

function parseRoles() {
  const roles = []
  if (!existsSync(ENV_TS)) return roles
  const envSrc = readFileSync(ENV_TS, 'utf8')
  const block = /export const ROLES = \{([\s\S]*?)\} as const/.exec(envSrc)?.[1] ?? ''
  for (const m of block.matchAll(/\/\*\*([\s\S]*?)\*\/\s*([a-z]+):\s*'([a-z_]+)'/gi)) {
    roles.push({
      key: m[2],
      name: m[3],
      note: m[1].replace(/\s*\*\s*/g, ' ').replace(/\s+/g, ' ').trim(),
    })
  }
  return roles.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * 🛑 THE LEXER, EXPORTED SO IT CAN BE TESTED AS A LEXER.
 *
 * This is a seam for tests, and it exists because THREE CONSECUTIVE ROUNDS of
 * defects in this file were in unexported lexer code that a fully-passing suite
 * could not see. At the last count, eight mutations survived 932 green tests and
 * FIVE of them sat in these five functions — the E-string guard, the backslash
 * rule, the tag's trailing `$`, the `"…"` opener, the splitter's quote
 * awareness. Every one of them was asserted at length in a comment and checked
 * by nothing, because the only way in was `parseDbSchemaFrom`, and a downstream
 * assertion about an RLS badge can be satisfied for the wrong reason.
 *
 * Testing a hand-rolled tokenizer through one downstream entry point does not
 * work. The evidence is three rounds deep and this is the response to it.
 *
 * ⚠️ IT IS A TEST SEAM, NOT AN API. Nothing in `tools/` imports it, and nothing
 * should: the file's product is `buildC4Data` and `parseDbSchemaFrom`. Adding a
 * name here is a decision to test that name directly — not an invitation to call
 * it from elsewhere, where a second caller would acquire a stake in a shape that
 * exists to be changed as PostgreSQL's grammar is understood better.
 */
export const lexer = Object.freeze({ scanSql, quotedRun, closeQuote, dollarTag, splitTopLevelCommas })

/** Parse migration source strings without touching the real migrations directory. */
export function parseDbSchemaFrom(filesByName) {
  const files = Object.keys(filesByName).filter((f) => f.endsWith('.sql')).sort()
  const tables = []
  const policies = []
  const grants = []
  const schemas = new Set(['public'])

  // 🛑 ONE ORDERED PASS OVER STATEMENTS, ACROSS THE WHOLE CORPUS.
  //
  // Files are sorted and read in order, and every statement is dispatched where it
  // stands. That ordering is not decoration: it is what makes the binding rule in
  // `findTable` temporal, so a reference means the table it named WHEN IT WAS
  // WRITTEN and what it asserts then travels with that table through any later
  // `SET SCHEMA`.
  //
  // ⚠️ THE WHOLE-CORPUS SCOPE IS DELIBERATE AND MUST NOT BE "FIXED" BACK TO
  // PER-FILE. The cross-file case is real — one migration creates and enables, a
  // later one moves — and per-file matching is the defect the plane-split slice
  // closed. What changed here is the BINDING, not the scope.
  //
  // Dispatch is on the statement's leading keyword rather than by sweeping every
  // matcher over the text, so a `GRANT` inside a `CREATE TABLE` body — or anything
  // at all inside a dollar-quoted function body — cannot be read as a statement of
  // its own.
  for (const file of files) {
    const statements = scanSql(filesByName[file], file)

    refuseUnrecognisedDdl(file, statements)

    for (const statement of statements) {
      if (/^alter\s+table\b/i.test(statement)) {
        applyAlterTable(tables, statement, file)
        continue
      }

      if (/^create\s+schema\b/i.test(statement)) {
        const m = /create\s+schema\s+(?:if\s+not\s+exists\s+)?([a-z0-9_"]+)\s*;/i.exec(statement)
        if (m) schemas.add(m[1].replace(/"/g, ''))
        continue
      }

      if (/^create\s+table\b/i.test(statement)) {
        const m = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)\s*\(([\s\S]*?)\n\s*\);/i.exec(statement)
        if (!m) continue
        const tableName = splitQualifiedName(m[1])
        const body = m[2]
        const columns = []
        const constraints = []
        for (const raw of splitTopLevelCommas(body)) {
          const line = raw.replace(/\s+/g, ' ').trim()
          if (!line) continue
          if (/^(primary\s+key|foreign\s+key|unique|check|constraint)\b/i.test(line)) {
            constraints.push(line)
            continue
          }
          const column = parseColumn(line)
          if (column) columns.push(column)
        }
        tables.push({
          schema: tableName.schema,
          name: tableName.name,
          source: file,
          columns,
          constraints,
          rlsEnabled: false,
          rlsForced: false,
        })
        continue
      }

      if (/^create\s+policy\b/i.test(statement)) {
        const m = /create\s+policy\s+([a-z0-9_]+)\s+on\s+([a-z0-9_]+)([\s\S]*?);/i.exec(statement)
        if (!m) continue
        const tail = m[3]
        policies.push({
          name: m[1],
          table: m[2],
          source: file,
          using: (/using\s*\(([\s\S]*?)\)\s*(?:with\s+check|$)/i.exec(tail)?.[1] ?? '').replace(/\s+/g, ' ').trim(),
          withCheck: (/with\s+check\s*\(([\s\S]*?)\)\s*$/i.exec(tail)?.[1] ?? '').replace(/\s+/g, ' ').trim(),
        })
        continue
      }

      if (/^alter\s+policy\b/i.test(statement)) {
        applyAlterPolicy(policies, statement, file)
        continue
      }

      if (/^drop\s+policy\b/i.test(statement)) {
        applyDropPolicy(policies, statement, file)
        continue
      }

      // G4453 — two REVOKE forms are RENDERED, not merely recognised, because
      // control `0052` (S5) retires two roles whose grants `0020`/`0040` still
      // print: leaving them would draw a credential the database no longer
      // honours. Only the whole-role forms are applied — every other REVOKE is
      // still recognised and unrendered, exactly as before (the 0001 note above).
      if (/^revoke\b/i.test(statement)) {
        const allTables = /^revoke\s+all(?:\s+privileges)?\s+on\s+all\s+tables\s+in\s+schema\s+([a-z0-9_]+)\s+from\s+([a-z0-9_]+)\s*;?\s*$/i.exec(statement)
        if (allTables) {
          const role = allTables[2]
          for (let i = grants.length - 1; i >= 0; i--) {
            if (grants[i].to === role && !/^schema\b/i.test(grants[i].on)) grants.splice(i, 1)
          }
          continue
        }
        const usage = /^revoke\s+usage\s+on\s+schema\s+([a-z0-9_]+)\s+from\s+([a-z0-9_]+)\s*;?\s*$/i.exec(statement)
        if (usage) {
          const on = `schema ${usage[1]}`.toLowerCase()
          for (let i = grants.length - 1; i >= 0; i--) {
            const g = grants[i]
            if (g.to === usage[2] && g.on.toLowerCase() === on && /^usage$/i.test(g.privileges)) grants.splice(i, 1)
          }
        }
        continue
      }

      if (/^grant\b/i.test(statement)) {
        const m = /grant\s+([\s\S]*?)\s+on\s+([a-z0-9_ ]+?)\s+to\s+([a-z0-9_]+)\s*;/i.exec(statement)
        if (!m) continue
        grants.push({
          privileges: m[1].replace(/\s+/g, ' ').trim(),
          on: m[2].replace(/\s+/g, ' ').trim(),
          to: m[3],
          source: file,
        })
      }
    }
  }

  tables.sort((a, b) => a.schema.localeCompare(b.schema) || a.name.localeCompare(b.name))
  policies.sort((a, b) => a.name.localeCompare(b.name))
  grants.sort((a, b) => a.to.localeCompare(b.to) || a.on.localeCompare(b.on))

  return { parsedFrom: files, schemas: [...schemas].sort(), tables, policies, roles: [], grants }
}

function readSqlDir(dir) {
  if (!existsSync(dir)) return {}
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  return Object.fromEntries(files.map((file) => [file, readFileSync(path.join(dir, file), 'utf8')]))
}

function parseDbSchema() {
  if (!existsSync(MIGRATIONS_DIR)) {
    return { parsedFrom: [], schemas: ['public'], tables: [], policies: [], roles: [], grants: [], control: null }
  }
  const sources = readSqlDir(MIGRATIONS_DIR)
  const db = parseDbSchemaFrom(sources)
  for (const t of db.tables) t.plane = 'data'
  // Role names come from db/env.ts, which is their single source. Keep this read
  // outside parseDbSchemaFrom so fixture parsing remains a pure operation.
  db.roles = parseRoles()
  // G4413 — the control database, parsed APART (see CONTROL_MIGRATIONS_DIR).
  const controlSources = readSqlDir(CONTROL_MIGRATIONS_DIR)
  const control = parseDbSchemaFrom(controlSources)
  for (const t of control.tables) t.plane = 'control'
  db.control = { parsedFrom: control.parsedFrom, tables: control.tables, policies: control.policies, grants: control.grants }
  // G4417 — the planned-tables caption said three tables are monthly
  // partitioned. Counted on comment-stripped SQL in BOTH directories, so a
  // migration that EXPLAINS partitioning is not counted as one.
  db.partitionedStatements = [...Object.values(sources), ...Object.values(controlSources)]
    .reduce((n, sql) => n + (stripSqlComments(sql).match(/\bpartition\s+by\b/gi) ?? []).length, 0)
  return db
}

function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

/** Statement-level import counts over `model/` — the Level 3 caption reads these. */
function importStats(ts) {
  let statements = 0
  let typeOnly = 0
  const runtimeEdges = new Set()
  for (const f of readdirSync(MODEL_DIR).filter((f) => f.endsWith('.ts')).sort()) {
    const name = f.slice(0, -3)
    const sf = ts.createSourceFile(f, readFileSync(path.join(MODEL_DIR, f), 'utf8'), ts.ScriptTarget.ES2022, true)
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st)) continue
      statements++
      const clause = st.importClause
      const allTypes = clause && (clause.isTypeOnly ||
        (clause.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.name &&
          clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every((e) => e.isTypeOnly)))
      if (allTypes) { typeOnly++; continue }
      const m = ts.isStringLiteral(st.moduleSpecifier) && /^\.\/([a-zA-Z0-9_-]+)(?:\.ts)?$/.exec(st.moduleSpecifier.text)
      if (m && m[1] !== name) runtimeEdges.add(`${name}→${m[1]}`)
    }
  }
  return { statements, typeOnly, runtimeEdges: runtimeEdges.size }
}

const PLANNED_PATH = path.join(__dirname, 'c4-planned.json')
const ACK_PATH = path.join(__dirname, 'c4-acknowledged.json')

/** `plane:schema.name` — one key for a built table across BOTH databases. One definition, in c4-verify.mjs. */
export { tableKey }

/**
 * G4417 — the planned tables, JOINED to the built schema rather than typed as
 * a card list. Each entry names what `docs/persistence-design.md` §2 planned
 * and what (if anything) the tree built for it; the join records whether
 * `builtAs` is really there, and whether a table carrying the planned name
 * exists anywhere — so `absent` can be refuted by the tree.
 */
function joinPlanned(planned, allTables) {
  const byKey = new Map(allTables.map((t) => [tableKey(t), t]))
  const byName = new Map()
  for (const t of allTables) byName.set(t.name, [...(byName.get(t.name) ?? []), tableKey(t)])
  return planned.map((p) => ({
    ...p,
    builtAsExists: p.builtAs === null ? null : byKey.has(p.builtAs),
    nameExistsAs: byName.get(p.planned) ?? [],
  }))
}

export async function buildC4Data() {
  const ts = await loadTypeScript()
  const names = readdirSync(MODEL_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.slice(0, -3))
    .sort()

  const modules = names.map((n) => parseModule(ts, n, readFileSync(path.join(MODEL_DIR, `${n}.ts`), 'utf8')))
  const db = parseDbSchema()
  /* AN EMPTY SUBJECT RETURNS HERE, BEFORE ANY JOIN. `check-c4-freshness.mjs`
     refuses a run with no modules or no tables (G1474), and it can only say so
     if this function returns: every join below reads files a sandbox holding
     `model/` alone does not have, and a crash is not a refusal. */
  if (modules.length === 0 || db.tables.length === 0) {
    const zero = { modules: modules.length, edges: 0, droppedModules: 0, exports: 0, exportedNames: 0, droppedExports: 0, builtTables: db.tables.length, policies: db.policies.length }
    return { totals: zero, modules, db }
  }
  const controlTables = db.control ? db.control.tables : []
  const allTables = [...db.tables, ...controlTables]
  const imports = importStats(ts)

  /* G4416 — "specified, not written", from the same walk the model graph
     uses (imported, never copied), so the page's list cannot disagree with
     `docs/model-graph.json`'s gap kind of the same name. */
  const { scanDocsForModules } = await import('./extract.mjs')
  const documented = scanDocsForModules(new Set(names))
  const specifiedNotWritten = [...documented.entries()].sort()
    /* The FILE that names it, never the line or the count: a line number
       moves on every edit above it and a mention count on every sentence
       that discusses the module, and either would turn an unrelated edit to
       `docs/HANDOFF.md` into a stale C4 page. */
    .map(([name, evidence]) => ({ subject: `model/${name}.ts`, namedIn: [...new Set(evidence.map((e) => e.split(':')[0]))].sort() }))

  /* G4415 — the frontend half, derived. */
  const frontend = await import('./c4-frontend.mjs')
  const ack = JSON.parse(readFileSync(ACK_PATH, 'utf8'))
  const register = await frontend.routeRegister(REPO_ROOT)
  const join = frontend.operationJoin(ts, { root: REPO_ROOT, ack })
  const marks = frontend.markCounts(REPO_ROOT)

  const planned = joinPlanned(JSON.parse(readFileSync(PLANNED_PATH, 'utf8')).tables, allTables)

  const totals = {
    modules: modules.length,
    edges: modules.reduce((n, m) => n + m.imports.length, 0),
    droppedModules: modules.filter((m) => m.dropped).length,
    exports: modules.reduce((n, m) => n + m.counts.total, 0),
    exportedNames: modules.reduce((n, m) => n + m.counts.names, 0),
    droppedExports: modules.reduce((n, m) => n + m.counts.dropped, 0),
    // ⚠️ BOTH DATABASES SINCE 5 Oct 2026 (G4413). It counted the data plane
    // alone and was printed as "built tables" — so the control database's
    // tables were built and appeared in no total. The split is below.
    builtTables: allTables.length,
    dataPlaneTables: db.tables.length,
    controlPlaneTables: controlTables.length,
    policies: db.policies.length,
    importStatements: imports.statements,
    typeOnlyImports: imports.typeOnly,
    runtimeImportEdges: imports.runtimeEdges,
    declaredOperations: join.declared,
    servedOperations: join.served,
    routes: register.routes.length,
    screens: register.screens.length,
    specifiedNotWritten: specifiedNotWritten.length,
    partitionedStatements: db.partitionedStatements,
  }

  return {
    totals,
    modules,
    db,
    planned,
    specifiedNotWritten,
    frontend: { routes: register.routes, screens: register.screens, marks, join },
  }
}

async function main() {
  const data = await buildC4Data()
  const text = JSON.stringify(data, null, 2) + '\n'
  if (process.argv.includes('--write')) {
    writeFileSync(OUT_PATH, text)
    const t = data.totals
    console.log(
      `wrote ${path.relative(REPO_ROOT, OUT_PATH)} — ${t.modules} modules, ${t.exports} exports ` +
        `(${t.droppedExports} dropped), ${t.builtTables} built tables, ${t.policies} RLS policies`,
    )
  } else {
    process.stdout.write(text)
  }
}

// `file://${process.argv[1]}` is WRONG and was used here until 12 Aug 2026:
// import.meta.url percent-encodes, process.argv[1] does not, so on any path
// containing a space the comparison is false and this file EXITS 0 HAVING DONE
// NOTHING. --write silently wrote nothing and the post-commit hook reported
// success. Compare resolved paths instead; tools/check-pack-safety.mjs had the
// correct form all along.
const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) await main()

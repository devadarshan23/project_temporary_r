#!/usr/bin/env node
/**
 * check-citations — resolve every `file.ts:NNN` citation in the record.
 *
 * WHY THIS EXISTS. On 7 Aug 2026 a green-team agent reported three dead
 * citations; checking them turned up a fourth in the same decision row. **All
 * four belonged to G9, which is recorded "not applied"** — and that is the
 * pattern rather than the incident: *an unapplied decision's citations rot
 * silently, because nobody is working on it to notice.* When someone finally
 * builds G9, every pointer in it is wrong and the model has moved ~400 lines
 * under it.
 *
 * `docs/HANDOFF.md` §7 already records that *a citation with no branch qualifier
 * is a dead citation*. This is the same defect one axis over: a citation with a
 * stale LINE is equally dead and reads equally valid.
 *
 * WHAT IT CHECKS. Legacy `:NNN` citations only prove their line still exists;
 * they can drift to another declaration. New `#symbol` and `#"anchor"` forms
 * must resolve uniquely, but that still cannot prove the surrounding sentence
 * selected the intended target. `--triage` is a non-fatal signal, not a verdict.
 * @see `tools/check-citations.mjs#resolvePath`
 *
 *   DEAD      the file does not exist, or the line is past the end of it.
 *   SUSPECT   the line resolves but its content is blank, a lone brace, or a
 *             bare comment marker — almost always drift, occasionally a real
 *             citation of a block that starts there.
 *   OK        resolves to something substantive. NOT a guarantee of correctness.
 *             The symbol form's own success verdict is `RESOLVED`; it is counted
 *             in OK, because the header's three buckets have to sum to the total
 *             and there is no reader for whom a resolved symbol is a fourth
 *             thing. See the note on the `ok` filter.
 *
 * Exit 1 on any DEAD. SUSPECT never fails the run — it is a reading list.
 *
 *   node tools/check-citations.mjs
 *   node tools/check-citations.mjs --all   also list OK citations
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexDeclarations, resolveFragment } from './citation-symbols.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const showAll = process.argv.includes('--all')
const triage = process.argv.includes('--triage')
const checkFileAt = process.argv.indexOf('--check-file')
const checkFile = checkFileAt >= 0 ? process.argv[checkFileAt + 1] : null

const TARGETS = [
  'CLAUDE.md',
  'PRODUCT.md',
  'README.md',
  ...readdirSync(join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`),
  // `readdirSync` is NOT recursive, so the entry `build` — a directory, and so
  // not ending in `.md` — was dropped by the filter above and every file under
  // `docs/build/` went unscanned. That blind spot is where `phase-one-plan.md`'s
  // gate D4 rotted while `npm run check` stayed green. Same enumeration, one
  // level down.
  ...readdirSync(join(ROOT, 'docs', 'build'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/build/${f}`),
  'docs/contracts/README.md',
  'tools/check-citations.mjs',
]

/**
 * A citation is a path ending .ts or .yaml followed by :NNN, optionally with a
 * range or a comma list — `access.ts:1148`, `domain.ts:1409-1413`,
 * `model/access.ts:528,571`. Only the FIRST number is resolved; a range whose
 * start is live is good enough to not be dead.
 */
const CITE = /`?((?:[\w./-]+\/)?[\w.-]+\.(?:ts|yaml))`?:(\d+)/g
const CITE_SYMBOL = /`((?:[\w./-]+\/)?[\w.-]+\.(?:ts|tsx|md|sql|yaml|mjs))#(?:([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)|"([^"]+)")`/g

/**
 * Paths in the record are written relative to the repo root, or bare.
 *
 * ⚠️ `tests/` and `tests/scenarios/` were ADDED 9 Aug 2026, and the reason is the
 * defect this tool exists to catch, pointed the other way. Two green-team reports
 * cited `engine-behaviour.test.ts:306` and `export-surface.test.ts:633` — **both
 * files exist, both line numbers resolve** — and this resolver reported them DEAD
 * because it had never been taught where the tests live. A checker that calls a
 * correct citation dead is worse than one that misses a wrong one: it trains the
 * next person to edit the record until the tool stops complaining. Every bare
 * `*.test.ts` citation in the record was unresolvable until this line.
 *
 * The list stays EXPLICIT rather than becoming a recursive search: a bare filename
 * that matches two files in two directories would resolve to whichever came first,
 * and a citation that silently resolves to the wrong file is precisely the class
 * this tool already says it cannot catch.
 */
function resolvePath(p) {
  const tries = [
    p,
    `model/${p}`,
    `docs/${p}`,
    `docs/contracts/${p}`,
    `tools/${p}`,
    `tests/${p}`,
    `tests/model/${p}`,
    `tests/scenarios/${p}`,
    `db/${p}`,
  ]
  for (const t of tries) if (existsSync(join(ROOT, t))) return t
  return null
}

const fileCache = new Map()
const declarationCache = new Map()
function linesOf(rel) {
  if (!fileCache.has(rel)) {
    fileCache.set(rel, readFileSync(join(ROOT, rel), 'utf8').split('\n'))
  }
  return fileCache.get(rel)
}

function textOf(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function declarationsOf(rel) {
  if (!declarationCache.has(rel)) declarationCache.set(rel, indexDeclarations(textOf(rel)))
  return declarationCache.get(rel)
}

const results = []

/* THE DENOMINATOR — G1476. Counted here and asserted below, because a run over
   zero documents resolves zero citations and reports `DEAD 0`, which is
   byte-for-byte the shape of a clean run. See the block above the assertion. */
let documentsRead = 0

for (const doc of (checkFile ? [checkFile] : TARGETS)) {
  let src
  try {
    src = readFileSync(checkFile ? doc : join(ROOT, doc), 'utf8')
  } catch {
    continue
  }
  documentsRead += 1
  src.split('\n').forEach((line, i) => {
    // A line that is itself narrating a dead citation should not be re-reported.
    // Two kinds of line are skipped, and both are deliberate rather than lax:
    //   narrating — the line is quoting a known-dead citation on purpose, which
    //               this record does under "corrections left visible" (§6).
    //   external  — the line says in words that the file belongs to another
    //               repository. AiVolvex is a different 1CloudHub product; a
    //               citation into it is correct and will never resolve here.
    //               The marker must be EXPLICIT, so an unmarked missing file
    //               still fails the run.
    const narrating =
      /had all gone dead|were dead|no longer resolve|dead citation|previously recorded/i.test(line) ||
      /another product'?s repository|not on this trunk and not in any archive tag|resolving-but-wrong|citation said .* until|still resolves|corrected here rather than/i.test(line)
    for (const m of line.matchAll(CITE)) {
      const [, rawPath, numStr] = m
      const num = Number(numStr)
      const rel = resolvePath(rawPath)
      const at = `${doc}:${i + 1}`

      if (!rel) {
        // An archive-qualified path is correct by design and lives on a tag.
        if (/^(src|public)\//.test(rawPath)) continue
        results.push({ verdict: 'DEAD', at, cite: `${rawPath}:${num}`, why: 'file not found on the trunk', narrating })
        continue
      }
      const lines = linesOf(rel)
      if (num < 1 || num > lines.length) {
        results.push({ verdict: 'DEAD', at, cite: `${rawPath}:${num}`, why: `file has ${lines.length} lines`, narrating })
        continue
      }
      const content = (lines[num - 1] ?? '').trim()
      const thin = content === '' || /^[}\])]+,?$/.test(content) || content === '*' || content === '*/' || content === '/**'
      results.push({
        verdict: thin ? 'SUSPECT' : 'OK',
        at,
        cite: `${rawPath}:${num}`,
        sourceLine: line,
        why: thin ? `line is ${content === '' ? 'blank' : `\`${content}\``}` : content.slice(0, 72),
        narrating,
      })
    }
    for (const m of line.matchAll(CITE_SYMBOL)) {
      const [, rawPath, symbol, anchor] = m
      const rel = resolvePath(rawPath)
      const at = `${doc}:${i + 1}`
      if (!rel) {
        results.push({ verdict: 'NO_SUCH_SYMBOL', at, cite: `${rawPath}#${symbol ?? `"${anchor}"`}`, why: 'file not found on the trunk', narrating })
        continue
      }
      const target = textOf(rel)
      const resolved = resolveFragment(declarationsOf(rel), target, symbol ?? `"${anchor}"`)
      results.push({
        ...resolved,
        at,
        cite: `${rawPath}#${symbol ?? `"${anchor}"`}`,
        sourceLine: line,
        target: rel,
        narrating,
        why: resolved.verdict === 'RESOLVED' ? `${symbol ?? anchor}` : resolved.verdict,
      })
    }
  })
}

const live = results.filter((r) => !r.narrating)
const dead = live.filter((r) => ['DEAD', 'NO_SUCH_SYMBOL', 'AMBIGUOUS', 'ANCHOR_MISSING', 'ANCHOR_AMBIGUOUS'].includes(r.verdict))
const suspect = live.filter((r) => r.verdict === 'SUSPECT')
/**
 * 🛑 `RESOLVED` BELONGS HERE AND WAS NOT IN ANY BUCKET UNTIL 17 Aug 2026.
 *
 * This line read `live.filter((r) => r.verdict === 'OK')`, and the header below
 * has never added up: `OK 2682 + SUSPECT 452 + DEAD 0 = 3134` against a
 * `Citations resolved: 3135`. Reproduced on both platforms and on both dates it
 * was looked at, so it was never a race — ONE LIVE CITATION LANDED IN NO BUCKET.
 *
 * THE TOTAL WAS RIGHT AND THE BUCKETING WAS WRONG. The two citation forms have
 * two different success verdicts: the legacy `file.ts:NNN` form pushes `OK`, and
 * `resolveFragment()` in `tools/citation-symbols.mjs` returns `RESOLVED`. The
 * FAILURE verdicts of both forms were unified into `dead` above — `DEAD` beside
 * `NO_SUCH_SYMBOL`, `AMBIGUOUS`, `ANCHOR_MISSING`, `ANCHOR_AMBIGUOUS` — and the
 * SUCCESS verdicts never were. So a symbol citation that resolves was counted in
 * `live` and in nothing else.
 *
 * ⚠️ THE ARITHMETIC IS THE SMALL HALF OF THIS. The missing citation was
 * `tools/check-citations.mjs#resolvePath`, on line 21 of this file's own header
 * — and when it was found it was the ONLY symbol-form citation in the entire
 * scanned record. Derive it, and note that this paragraph's own mention of it is
 * now the second of two, which is the sort of thing this tool counts:
 *
 *   grep -rnoE '`([A-Za-z0-9_./-]+\.(ts|tsx|md|sql|yaml|mjs))#[^`]+`' \
 *     CLAUDE.md PRODUCT.md README.md docs tools/check-citations.mjs
 *
 * The form this header advocates over the legacy one, and which the gate has
 * fully implemented and tested since #180, was used ONCE, by the tool that
 * implements it, to cite itself. The off-by-one is therefore a measurement of
 * adoption: the day the record starts writing `#symbol` citations, the OK bucket
 * would have gone on under-reporting by the whole symbol population while the
 * total stayed right — a silently widening gap rather than a visible one.
 *
 * `--triage` below deliberately still reads `verdict === 'OK'` and NOT this
 * bucket. Its corroboration test parses a `:NNN` off the citation, which a
 * symbol citation does not carry; folding `RESOLVED` in there would file every
 * correctly-resolved symbol citation under `unresolved`, which is the same
 * defect pointed the other way.
 */
const ok = live.filter((r) => r.verdict === 'OK' || r.verdict === 'RESOLVED')

/**
 * THE ANTI-VACUOUS GUARD — G1476, AND IT WAS WITNESSED RED.
 *
 * Until 21 Sep 2026 a run that read nothing printed
 *
 *     Citations resolved: 0  (OK 0 · SUSPECT 0 · DEAD 0)
 *
 * and EXITED 0, which is byte-for-byte the shape of a clean corpus. **A dead
 * citation cannot be found among zero citations**, so the whole checker was
 * `docs/build/completion-plan.md` K4 — `docs/HANDOFF.md` §5.6 — the instant
 * `TARGETS` stopped resolving. That is not hypothetical here: `TARGETS` is a
 * hand-listed enumeration plus two `readdirSync` calls, and its own comment
 * records that the `docs/build/` entry was MISSING for weeks while every file
 * under it went unscanned and the gate stayed green.
 *
 * TWO NUMBERS, BECAUSE THEY FAIL SEPARATELY. Zero documents means the
 * enumeration broke; a full corpus with zero citations means the two regexes
 * did. A guard on the first alone passes a run where `CITE` stopped matching.
 *
 * ⚠️ `--check-file` IS EXEMPT FROM THE CITATION FLOOR AND NOT FROM THE
 * DOCUMENT ONE. A caller naming one file legitimately gets a small number and
 * may legitimately get zero — most files carry no citation at all — but a
 * named file that cannot be READ is still a run about nothing. The gate passes
 * no flag (`tests/ci/gate-stages.test.ts` K3), so the floor that matters is
 * always armed on the gate's own invocation.
 */
if (documentsRead === 0) {
  console.log(`NO DOCUMENTS READ — every verdict below would be vacuous.`)
  console.log('  A dead citation cannot be found among zero citations, and `DEAD 0` over an')
  console.log('  unread corpus is byte-for-byte a clean run. Fix the derivation; do not delete')
  console.log('  the assertion.')
  process.exitCode = 1
}

if (!checkFile && documentsRead > 0 && results.length === 0) {
  console.log(`${documentsRead} DOCUMENT(S) READ AND NOT ONE CITATION FOUND — the matchers are broken, not the record.`)
  console.log('  This corpus has never held zero citations. `DEAD 0` here would be a report on')
  console.log('  a regex that stopped matching. Fix the matchers; do not delete the assertion.')
  process.exitCode = 1
}

console.log(`Citations: ${documentsRead} document(s) scanned; ${results.length} found.`)
console.log(`Citations resolved: ${live.length}  (OK ${ok.length} · SUSPECT ${suspect.length} · DEAD ${dead.length})`)
const narrated = results.length - live.length
if (narrated) console.log(`  ${narrated} skipped — on a line that is narrating a known-dead citation on purpose.`)

const show = (rows, heading) => {
  if (!rows.length) return
  console.log(`\n${heading}`)
  for (const r of rows) console.log(`  ${r.at}\n      ${r.cite}  — ${r.why}`)
}

show(dead, `DEAD — ${dead.length} citation(s) resolve to nothing or are not uniquely addressable. Fix these:`)
show(suspect, `SUSPECT — ${suspect.length} resolve to a blank line, a lone brace or a comment marker:`)
if (showAll) show(ok, `OK — ${ok.length}:`)

if (triage) {
  const buckets = { corroborated: 0, contradicted: 0, uncorroborated: 0, unresolved: 0 }
  for (const row of live.filter((entry) => entry.verdict === 'OK')) {
    const declarations = declarationsOf(resolvePath(row.cite.split(':')[0]))
    const found = declarations.find((entry) => row.cite.endsWith(`:${entry.line}`) || (row.cite.match(/:(\d+)$/) && Number(row.cite.match(/:(\d+)$/)[1]) >= entry.start && Number(row.cite.match(/:(\d+)$/)[1]) <= entry.end))
    if (!found) { buckets.unresolved += 1; continue }
    const words = row.sourceLine ? (row.sourceLine.match(/[A-Z][A-Za-z0-9_$]*/g) ?? []) : []
    const names = new Set(words)
    if (names.has(found.name)) buckets.corroborated += 1
    else if (declarations.some((entry) => names.has(entry.name))) buckets.contradicted += 1
    else buckets.uncorroborated += 1
  }
  buckets.unresolved += live.filter((entry) => entry.verdict === 'SUSPECT').length
  console.log(`\nTRIAGE — corroborated ${buckets.corroborated} · contradicted ${buckets.contradicted} · uncorroborated ${buckets.uncorroborated} · unresolved ${buckets.unresolved}`)
}

console.log('\n⚠️ Legacy :NNN citations are still checked only for a live line and can drift to another declaration. # citations are checked for a uniquely resolvable symbol or literal anchor; that proves the target exists, not that the citing sentence chose the intended target. --triage is a non-fatal signal and can have false positives.')

/**
 * 🛑 SET THE CODE; DO NOT CALL `process.exit()`. THIS LINE READ
 * `process.exit(triage ? 0 : (dead.length ? 1 : 0))` UNTIL 17 Aug 2026 AND IT
 * WAS SILENTLY THROWING AWAY THE END OF ITS OWN REPORT.
 *
 * `process.exit()` terminates immediately. When stdout is a PIPE — which it is
 * under `spawnSync`, under `npm run`, and under a CI log collector — the writes
 * `console.log` has made may still be queued in userspace, and exiting discards
 * whatever has not reached the kernel. Nothing warns; the exit CODE is correct,
 * so the gate still goes red on a DEAD citation. Only the reading matter is
 * lost, and it is lost from the END, which is where the summaries are.
 *
 * MEASURED, not theorised. Run 31956377840 (Linux arm64, node v26.7.0) printed
 * the header `SUSPECT — 424` and then emitted 21,319 characters in total. The
 * SUSPECT list alone costs ~75 characters an entry, so 424 of them need ~31,900
 * — about 140 entries, the TRIAGE line and this paragraph never left the
 * process. The same tree on macOS/node v26.0.0 emits 39,074 characters, whole.
 * `tests/tools/check-citations-symbol-form.test.ts` had been asserting that
 * `--triage` reports its four buckets since it was written; it went red the day
 * the record grew past whatever the Linux flush happened to cover, on a branch
 * that had touched neither this file nor that test.
 *
 * `process.exitCode` records the verdict and lets the loop drain, which flushes
 * stdout first. This is the last statement in the file, so the two forms are
 * otherwise identical. **Any `process.exit()` reintroduced here reintroduces
 * the truncation**, and the control that catches it is the completeness
 * assertion in that test file, not this comment.
 */
process.exitCode = process.exitCode === 1 ? 1 : (triage ? 0 : (dead.length ? 1 : 0))

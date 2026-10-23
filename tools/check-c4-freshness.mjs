#!/usr/bin/env node
/**
 * ReconcileAI — checks the generated C4 artefacts against the tree, right now.
 *
 * Read-only. Regenerates each derived artefact in memory and diffs it against
 * the committed copy:
 *
 *   docs/c4-components.mmd   the Level 3 module graph, as Mermaid
 *   docs/c4-data.json        Levels 3-4 and the built DB schema, as data
 *   docs/c4.html             the rendered page (template + data)
 *
 * This is drift DETECTION, not the update itself. The update is
 * tools/githooks/post-commit, which runs locally and is opt-in. This checker is
 * the backstop for the case where the hook was never installed or a commit
 * landed some other way, and it fails the one thing every contributor's diff
 * runs through — `npm run check`.
 *
 * WHY IT REGENERATES FROM SOURCE RATHER THAN COMPARING TWO DERIVED FILES.
 * Every input here is read fresh: model/*.ts through the TypeScript parser, and
 * db/migrations/*.sql through the schema scanner. It deliberately does not
 * consult docs/model-graph.json, which is itself a committed derived artefact
 * that can diverge from the tree with nothing catching it. A check that
 * compared two derived files to each other would pass while both were equally
 * stale — green, and proving nothing.
 *
 * Scope counts print on every run, pass or fail. A silent green is how a
 * checker ends up asserting nothing without anyone noticing.
 *
 * ┌─ THE DENOMINATOR — G1474, AND IT WAS WITNESSED RED ───────────────────────┐
 * │ ⚠️ THE SENTENCE ABOVE — "scope counts print on every run" — WAS TRUE AND   │
 * │ WAS NOT ENOUGH, AND THAT GAP IS THE WHOLE OF THIS BLOCK. Printing a        │
 * │ number is not asserting it. Until 21 Sep 2026 this checker answered        │
 * │                                                                            │
 * │     OK     C4 artefacts match the tree — 0 modules, 0 import edges,        │
 * │            0 exports (0 dropped-for-v1), 0 built tables, 0 RLS policies.   │
 * │                                                                            │
 * │ and EXITED 0, measured in a sandbox holding this file, the three planner   │
 * │ modules and an EMPTY `model/`. **Three artefacts each regenerated from     │
 * │ nothing and each matching the committed copy of nothing is a run that      │
 * │ compared nothing to nothing** — `docs/build/completion-plan.md` K4, and    │
 * │ §5.6 arriving in the checker whose own comment warns about §5.6.           │
 * │                                                                            │
 * │ 🛑 AND IT IS THE WORST PLACE FOR IT, BECAUSE THIS IS A DRIFT DETECTOR. A   │
 * │ drift detector over an empty subject reports NO DRIFT, which is the        │
 * │ answer a reader wants, in the vocabulary they trust. A moved `model/`, a   │
 * │ changed extension filter, a parser that started returning `[]` — each      │
 * │ reads as a clean gate.                                                     │
 * │                                                                            │
 * │ The guard is FIRST, before any `compare()`, deliberately: the comparison   │
 * │ that follows is meaningless if the subject is empty, and failing fast      │
 * │ means the sandbox that witnesses this red needs `model/` and nothing else. │
 * │ ⚠️ `builtTables` WAS ALREADY REPORTED AS A `NOTE` AND IS NOW A FAILURE      │
 * │ WITH THE OTHER TWO — a note nobody reads is not a control, and the three   │
 * │ subjects are one question.                                                 │
 * └────────────────────────────────────────────────────────────────────────────┘
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildGraph, renderMermaid } from './planner/render-c4-components.mjs'
import { buildC4Data } from './planner/extract-c4-data.mjs'
import { renderC4Page } from './planner/render-c4-page.mjs'
import { verifyJoins, verifyLabelPredicates } from './planner/c4-verify.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const rel = (p) => path.relative(REPO_ROOT, p)

const failures = []

/** Compare one committed artefact against its freshly generated form. */
function compare(absPath, fresh, regenCmd) {
  const name = rel(absPath)
  if (!existsSync(absPath)) {
    failures.push(`STALE  ${name} does not exist.\n       Run: ${regenCmd}`)
    return
  }
  if (readFileSync(absPath, 'utf8') !== fresh) {
    failures.push(`STALE  ${name} does not match the tree.\n       Run: ${regenCmd}`)
  }
}

/**
 * THE ANTI-VACUOUS GUARD. Every `compare()` below draws its fresh side from
 * these three subjects; over an empty one the regenerated artefact and the
 * committed artefact agree perfectly and about nothing. Returns the refusals,
 * so the caller can print all of them rather than only the first.
 *
 * ⚠️ NO CEILINGS AND NO RATIOS — this asks only whether the subject EXISTS. A
 * threshold here would be a plausibility band, and `check-doc-counts.mjs`
 * carries the record of what a band costs when the tree outgrows it.
 */
function vacuousSubjects({ modules, exports: exportCount, builtTables }) {
  const empty = []
  if (modules === 0) empty.push('`model/` yielded NO MODULES — the Level 3 graph is empty')
  if (exportCount === 0) empty.push('the TypeScript parser yielded NO EXPORTS — the Level 4 surface is empty')
  if (builtTables === 0) empty.push('`db/migrations/` yielded NO CREATE TABLE — the built-schema half is empty')
  return empty
}

async function main() {
  const graph = buildGraph()

  // buildC4Data() exits 2 with instructions when `typescript` is absent, which
  // is the right outcome here: without the parser this checker cannot verify
  // anything, and reporting OK would be a false green.
  const data = await buildC4Data()

  /* FIRST, AND BEFORE ANY COMPARISON. See the header: three artefacts each
     regenerated from nothing and each matching the committed copy of nothing
     is a drift detector reporting NO DRIFT over an absent subject. */
  const empty = vacuousSubjects(data.totals)
  if (empty.length > 0) {
    for (const reason of empty) console.error(`VACUOUS  ${reason}`)
    console.error('')
    console.error('       Every comparison below would regenerate nothing and match nothing,')
    console.error('       and this checker would print OK. Fix the derivation — the directory,')
    console.error('       the parser or the scanner — and do not delete the assertion.')
    process.exit(1)
  }

  /* G4418/G4419 — THE HAND-WRITTEN INPUTS, TESTED AGAINST THE TREE. Freshness
     catches a page that is OLD; it cannot catch one regenerated faithfully
     from an input that is WRONG. Run before the comparisons, and printed in
     full, because a contradicted badge also stops the page from rendering. */
  const planner = path.join(REPO_ROOT, 'tools', 'planner')
  const labels = JSON.parse(readFileSync(path.join(planner, 'c4-labels.json'), 'utf8'))
  const ack = JSON.parse(readFileSync(path.join(planner, 'c4-acknowledged.json'), 'utf8'))
  const { results, findings: contradictions } = verifyLabelPredicates(labels, data, REPO_ROOT)
  const joinFindings = verifyJoins(data, ack)
  const verified = [...contradictions, ...joinFindings]
  if (verified.length > 0) {
    for (const f of verified) console.error(f)
    const t = data.totals
    console.error(
      `\n       ${Object.keys(results).length} predicated labels · ${data.planned.length} planned tables · ` +
        `${t.builtTables} built tables · ${t.servedOperations} served operations examined.`,
    )
    process.exit(1)
  }

  compare(
    path.join(REPO_ROOT, 'docs', 'c4-components.mmd'),
    renderMermaid(graph),
    'node tools/planner/render-c4-components.mjs --write',
  )

  compare(
    path.join(REPO_ROOT, 'docs', 'c4-data.json'),
    JSON.stringify(data, null, 2) + '\n',
    'node tools/planner/extract-c4-data.mjs --write',
  )

  /* G4420 — a page the renderer REFUSES (its embedded data does not round-trip,
     or a badge contradicts its predicate) is a failure to print, not a stack. */
  let html = null
  try {
    ;({ html } = await renderC4Page())
  } catch (err) {
    failures.push(`BROKEN docs/c4.html cannot be rendered: ${err.message}`)
  }
  if (html !== null) {
    compare(
      path.join(REPO_ROOT, 'docs', 'c4.html'),
      html,
      'node tools/planner/render-c4-page.mjs --write',
    )
  }

  const t = data.totals
  const scope =
    `${t.modules} modules, ${t.edges} import edges, ${t.exports} exports ` +
    `(${t.droppedExports} dropped-for-v1), ${t.builtTables} built tables ` +
    `(${t.dataPlaneTables} data · ${t.controlPlaneTables} control), ${t.policies} RLS policies, ` +
    `${data.planned.length} planned tables joined, ${t.servedOperations} served operations classified, ` +
    `${Object.keys(results).length} label predicates held`

  if (failures.length > 0) {
    for (const f of failures) console.error(f)
    console.error(`\n       Tree right now: ${scope}.`)
    process.exit(1)
  }

  console.log(`OK     C4 artefacts match the tree — ${scope}.`)

  /* ⚠️ THE `NOTE` THAT STOOD HERE IS GONE AND IS NOW A FAILURE, ABOVE. It read:
     "NOTE: no CREATE TABLE found in db/migrations — the schema half checked
     nothing." It was correct and it was not a control — it printed under an
     `OK` line, at EXIT 0, and the two other subjects had no note at all. See
     the header: `vacuousSubjects()` covers all three and refuses. */
}

await main()

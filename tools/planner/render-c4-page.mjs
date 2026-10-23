#!/usr/bin/env node
/**
 * ReconcileAI — assembles docs/c4.html from the template and the extracted data.
 *
 * tools/planner/c4-template.html holds the hand-authored half: Level 1 (context), Level 2
 * (containers), the planned-table roadmap, and all styling and interaction. It
 * carries a single `__C4_DATA__` placeholder. This script replaces that with the
 * JSON produced by extract-c4-data.mjs and writes docs/c4.html.
 *
 * The split is the point. A container diagram cannot be derived from a tree with
 * no deployed containers in it, so it stays written by a person; the module
 * graph, the per-module export surface and the built schema are all derived, so
 * they are never written by a person. Neither half can silently drift into the
 * other's territory, because they live in different files.
 *
 * `</script>` inside the embedded JSON would terminate the host script tag early,
 * so `<` is escaped to `<` — valid JSON, inert HTML. Model source contains
 * generics and comparisons in its type text, so this is not hypothetical.
 *
 * Deterministic: no timestamp, no commit hash. Same tree in, same bytes out.
 *
 * Usage:
 *   node tools/planner/render-c4-page.mjs           # print HTML to stdout
 *   node tools/planner/render-c4-page.mjs --write   # write docs/c4.html
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { buildC4Data } from './extract-c4-data.mjs'
import { verifyLabelPredicates } from './c4-verify.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const TEMPLATE = path.join(__dirname, 'c4-template.html')
const OUT_PATH = path.join(REPO_ROOT, 'docs', 'c4.html')
const PLACEHOLDER = '__C4_DATA__'
/* `status`, `badge` and `evidence` (G4419, 5 Oct 2026) read a label's STATUS,
   its badge class, and the evidence its `predicate` produced over the tree —
   so a Level 2 badge is printed from the same entry the checker verifies. */
const PLACEHOLDER_RE = /\{\{(label|total|status|badge|evidence|was)\.([A-Za-z0-9_]+)\}\}/g
const BADGE_CLASS = { BUILT: 'st-built', PARTLY: 'st-partly', DESIGNED: 'st-designed', UNDECIDED: 'st-designed', DROPPED: 'st-designed', BLOCKED: 'st-partly' }

const LABELS_PATH = path.join(__dirname, 'c4-labels.json')
const HANDOFF = path.join(REPO_ROOT, 'docs', 'HANDOFF.md')

/**
 * Substitute `{{label.KEY}}` and `{{total.KEY}}` in the hand-authored half.
 *
 * TWO CLASSES OF DRIFT THIS REMOVES BY CONSTRUCTION, both observed on 12 Aug 2026.
 *
 * LABELS. A topology label typed into six SVG `<text>` elements drifts the moment
 * a ruling touches one of them — G185 was applied to Level 1's data-plane label and
 * not to Level 2's identical twin, and the control database ended up described four
 * ways on one page. One entry in c4-labels.json now feeds every instance.
 *
 * NUMBERS. A figure typed into the template is an INPUT to check-c4-freshness.mjs,
 * not an output, so the checker renders it faithfully whether it is true or false —
 * which is exactly how the page carried an export total that disagreed with
 * check-doc-counts.mjs. `{{total.exports}}` cannot disagree with the tree because it
 * is not written down.
 *
 * A placeholder naming something absent is a HARD FAILURE, never a silent blank:
 * a page that renders `{{label.typo}}` as empty is a page that quietly lost a
 * container.
 */
function substitute(template, labels, totals, evidence = {}) {
  const missing = []
  const out = template.replace(PLACEHOLDER_RE, (match, kind, key) => {
    if (kind === 'total') {
      if (!(key in totals)) { missing.push(match); return match }
      return String(totals[key])
    }
    const entry = labels[key]
    if (!entry || typeof entry.text !== 'string') { missing.push(match); return match }
    if (kind === 'status') return entry.status
    if (kind === 'badge') return BADGE_CLASS[entry.status]
    if (kind === 'was') {
      if (typeof entry.wasUntil5Oct2026 !== 'string') { missing.push(match); return match }
      return entry.wasUntil5Oct2026
    }
    if (kind === 'evidence') {
      if (!(key in evidence)) { missing.push(match); return match }
      return evidence[key].evidence
    }
    return entry.text
  })
  if (missing.length > 0) {
    throw new Error(
      `tools/planner/c4-template.html references ${missing.length} name(s) that do not exist: ` +
        `${[...new Set(missing)].join(', ')}. Add them to c4-labels.json, or fix the spelling — ` +
        `a placeholder rendered blank is a container silently dropped from the diagram.`,
    )
  }
  return out
}

export function auditLabelReferences(labels, template) {
  const referenced = new Set()
  for (const [, kind, key] of template.matchAll(PLACEHOLDER_RE)) {
    if (kind !== 'total') referenced.add(key)
  }
  const keys = Object.keys(labels).filter((key) => !key.startsWith('_'))
  return {
    unreferenced: keys.filter((key) => !referenced.has(key)).sort(),
    labelsExamined: keys.length,
  }
}

export function verifyLabelsReferenced(labels, template) {
  const { unreferenced } = auditLabelReferences(labels, template)
  if (unreferenced.length === 0) return
  throw new Error(
    `c4-labels.json has entries no {{label.KEY}} placeholder references, so they render nowhere: ` +
      `${unreferenced.join(', ')}. Add the placeholder to c4-template.html, or delete the entry — ` +
      `a label the page never shows is a ruling that silently did not land.`,
  )
}

/**
 * Every label citing a G row must cite one that EXISTS. A status badge naming a
 * ruling nobody took reads as decided and is worse than no badge at all — the page
 * carried exactly that shape before this check, citing G177 for a claim G101 makes.
 */
function verifyRulings(labels) {
  const handoff = readFileSync(HANDOFF, 'utf8')
  const bad = []
  for (const [key, entry] of Object.entries(labels)) {
    if (key.startsWith('_') || !entry || !entry.ruling) continue
    if (!new RegExp(`^\\| ${entry.ruling} \\|`, 'm').test(handoff)) bad.push(`${key} → ${entry.ruling}`)
  }
  if (bad.length > 0) {
    throw new Error(
      `c4-labels.json cites ruling(s) with no row in docs/HANDOFF.md §3: ${bad.join(', ')}.`,
    )
  }
}

const STATUSES = new Set(['BUILT', 'PARTLY', 'DESIGNED', 'UNDECIDED', 'DROPPED', 'BLOCKED'])

/** A label with no status is how an unbuilt thing gets read as live. */
function verifyStatuses(labels) {
  const bad = []
  for (const [key, entry] of Object.entries(labels)) {
    if (key.startsWith('_')) continue
    if (!entry || !STATUSES.has(entry.status)) bad.push(`${key} → ${entry && entry.status}`)
  }
  if (bad.length > 0) {
    throw new Error(
      `c4-labels.json entries carry no valid status (${[...STATUSES].join(' | ')}): ${bad.join(', ')}.`,
    )
  }
}

export async function renderC4Page({ templatePath = TEMPLATE, labelsPath = LABELS_PATH } = {}) {
  const template = readFileSync(templatePath, 'utf8')
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`tools/planner/c4-template.html has no ${PLACEHOLDER} placeholder — nothing to inject.`)
  }
  const labels = JSON.parse(readFileSync(labelsPath, 'utf8'))
  verifyStatuses(labels)
  verifyRulings(labels)
  verifyLabelsReferenced(labels, template)
  const data = await buildC4Data()
  /* A badge that contradicts its predicate is refused HERE as well as in the
     checker, so no path writes a page whose badge the tree refutes. */
  const { results, findings } = verifyLabelPredicates(labels, data)
  if (findings.length > 0) throw new Error(findings.join('\n'))
  const substituted = substitute(template, labels, data.totals, results)
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  /* 🛑 A FUNCTION, NEVER A STRING, AS THE REPLACEMENT — G4420, 5 Oct 2026.
     `String.prototype.replace` reads `$'`, `` $` ``, `$&` and `$$` in a STRING
     replacement as patterns. The embedded data carries a CHECK constraint from
     `db/migrations/0270` — `credential_ref ~ '^cred_[0-9a-f]{32}$'` — whose
     `$'` was expanded into "the rest of the template", so the committed page
     shipped a truncated JSON blob: `JSON.parse` threw on load and every
     generated section (Levels 3–4, the schema) rendered EMPTY, while
     check-c4-freshness compared the broken page with an identically broken
     regeneration and printed OK. The round-trip below is the control. */
  const html = substituted.replace(PLACEHOLDER, () => json)
  verifyEmbeddedData(html, data)
  return { html, totals: data.totals }
}

/** The page must carry the data it was given, byte for byte once parsed. */
export function verifyEmbeddedData(html, data) {
  const open = '<script type="application/json" id="c4data">'
  const i = html.indexOf(open)
  const j = i === -1 ? -1 : html.indexOf('</script>', i + open.length)
  if (i === -1 || j === -1) throw new Error('docs/c4.html carries no c4data script block — the generated half has nowhere to live.')
  let parsed
  try {
    parsed = JSON.parse(html.slice(i + open.length, j))
  } catch (err) {
    throw new Error(`docs/c4.html's embedded data does not parse (${err.message}) — every generated section would render empty.`)
  }
  if (JSON.stringify(parsed) !== JSON.stringify(data)) {
    throw new Error("docs/c4.html's embedded data parses but is not the data it was rendered from.")
  }
}

async function main() {
  const { html, totals } = await renderC4Page()
  if (process.argv.includes('--write')) {
    writeFileSync(OUT_PATH, html)
    console.log(
      `wrote ${path.relative(REPO_ROOT, OUT_PATH)} — ${totals.modules} modules, ` +
        `${totals.exports} exports, ${totals.builtTables} built tables`,
    )
  } else {
    process.stdout.write(html)
  }
}

// See extract-c4-data.mjs: the `file://${process.argv[1]}` form silently no-ops
// with exit 0 on any path containing a space.
const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) await main()

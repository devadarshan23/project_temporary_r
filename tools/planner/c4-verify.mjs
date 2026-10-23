/**
 * THE C4 PAGE'S JOINS, VERIFIED — G4418/G4419, 5 Oct 2026.
 *
 * `check-c4-freshness.mjs` compares the committed page with a regenerated one.
 * That catches a page that is OLD; it cannot catch a page that is regenerated
 * faithfully from a hand-written input that is WRONG — a badge typed BUILT over
 * a container nothing serves, a planned table said to be absent that the tree
 * now builds. Those are claims about the tree that live in hand-written files
 * (`c4-labels.json`, `c4-planned.json`, `c4-acknowledged.json`), and this
 * module tests each one against the tree. Every function returns the list of
 * findings rather than throwing, so the checker can print all of them.
 *
 * Seven classes, each witnessed RED before it was trusted (G4419):
 *   CONTRADICTS   a label's status disagrees with its predicate over the tree
 *   PLANNED       a builtAs table is missing, or an `absent` name now exists
 *   UNCLASSIFIED  a built table, or a served operation no client reaches,
 *                 with no planned entry and no acknowledgement
 *   UNSERVED      a client reaches a declared operation no plane mounts
 *   UNRESOLVED    a client reaches a path no tier declares, unacknowledged
 *   STALE         an acknowledgement that no longer describes the tree
 */
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const tableKey = (t) => `${t.plane}:${t.schema}.${t.name}`

function combine(statuses) {
  if (statuses.every((s) => s === 'BUILT')) return 'BUILT'
  if (statuses.every((s) => s === 'DESIGNED')) return 'DESIGNED'
  return 'PARTLY'
}

/**
 * A predicate over the tree → `{ status, evidence }`. Unknown kinds THROW: a
 * predicate this function cannot evaluate is a badge nothing checks.
 */
export function evaluatePredicate(pred, data, root = REPO) {
  switch (pred.kind) {
    case 'servedTiers': {
      const tiers = data.frontend.join.tiers
      let served = 0
      let declared = 0
      for (const t of pred.tiers) {
        if (!tiers[t]) throw new Error(`predicate names a contract tier that does not exist: ${t}`)
        served += tiers[t].served
        declared += tiers[t].declared
      }
      return { status: served > 0 ? 'BUILT' : 'DESIGNED', evidence: `${served} of ${declared} ops served` }
    }
    case 'files': {
      const present = pred.paths.filter((p) => existsSync(join(root, p))).length
      const status = present === pred.paths.length ? 'BUILT' : present === 0 ? 'DESIGNED' : 'PARTLY'
      return { status, evidence: `${present}/${pred.paths.length} files` }
    }
    case 'controlTables': {
      const n = data.db.control ? data.db.control.tables.length : 0
      return { status: n > 0 ? 'BUILT' : 'DESIGNED', evidence: `${n} control tables` }
    }
    case 'dataTables': {
      const n = data.db.tables.length
      return { status: n > 0 ? 'BUILT' : 'DESIGNED', evidence: `${n} data tables` }
    }
    case 'screens': {
      const s = data.totals.screens
      return { status: s > 0 ? 'BUILT' : 'DESIGNED', evidence: `${s} screens · ${data.totals.routes} routes` }
    }
    case 'all': {
      const parts = pred.of.map((p) => evaluatePredicate(p, data, root))
      return { status: combine(parts.map((p) => p.status)), evidence: parts.map((p) => p.evidence).join(' · ') }
    }
    default:
      throw new Error(`c4-labels.json carries a predicate of unknown kind \`${pred.kind}\` — nothing can evaluate it`)
  }
}

/** Every label carrying a `predicate`, evaluated. Returns `{ results, findings }`. */
export function verifyLabelPredicates(labels, data, root = REPO) {
  const results = {}
  const findings = []
  for (const [key, entry] of Object.entries(labels)) {
    if (key.startsWith('_') || !entry || !entry.predicate) continue
    const r = evaluatePredicate(entry.predicate, data, root)
    results[key] = r
    if (r.status !== entry.status) {
      findings.push(
        `CONTRADICTS  c4-labels.json \`${key}\` says ${entry.status}; its predicate over the tree says ` +
          `${r.status} (${r.evidence}). Change the status, or the tree.`,
      )
    }
  }
  return { results, findings }
}

/** The planned-table join, the classification of every built table and served op, and the client join. */
export function verifyJoins(data, ack) {
  const findings = []
  const built = new Set([...data.db.tables, ...(data.db.control?.tables ?? [])].map(tableKey))
  const covered = new Set()

  for (const p of data.planned) {
    if (p.status === 'absent') {
      if (p.builtAs !== null) findings.push(`PLANNED      \`${p.planned}\` is \`absent\` and names a builtAs (${p.builtAs}) — one or the other.`)
      if (p.nameExistsAs.length > 0) {
        findings.push(
          `PLANNED      \`${p.planned}\` is marked \`absent\`, and a table of that name now exists: ` +
            `${p.nameExistsAs.join(', ')}. Mark it same/renamed/reshaped with a builtAs.`,
        )
      }
    } else {
      if (p.builtAs === null) findings.push(`PLANNED      \`${p.planned}\` is \`${p.status}\` and names no builtAs.`)
      else if (!p.builtAsExists) findings.push(`PLANNED      \`${p.planned}\` claims builtAs ${p.builtAs}, and no such table is built.`)
      else covered.add(p.builtAs)
    }
  }

  const ackTables = ack.tables ?? {}
  for (const key of [...built].sort()) {
    if (covered.has(key)) {
      if (key in ackTables) findings.push(`STALE        c4-acknowledged.json lists ${key}, which a planned entry already claims — delete the acknowledgement.`)
    } else if (!(key in ackTables)) {
      findings.push(
        `UNCLASSIFIED built table ${key} is no planned entry's builtAs and is not acknowledged — ` +
          'add it to c4-planned.json or c4-acknowledged.json `tables`.',
      )
    }
  }
  for (const key of Object.keys(ackTables).sort()) {
    if (!built.has(key)) findings.push(`STALE        c4-acknowledged.json lists table ${key}, which is not built.`)
  }

  const join = data.frontend.join
  for (const u of join.usedUnserved) {
    findings.push(`UNSERVED     ${u.op} (${u.tier}) is reached by ${u.by.join(', ')} and no plane mounts it.`)
  }
  for (const u of join.unresolved) {
    findings.push(
      `UNRESOLVED   ${u.file}#${u.fn} reaches ${u.methods.join('|') || '(no method)'} ${u.path}, which no tier declares — ` +
        'declare it, fix the client, or acknowledge it in `nonContractPaths`.',
    )
  }
  const unusedNow = new Set(join.servedUnused.map((s) => s.op))
  for (const s of join.servedUnused) {
    if (s.ack === null) {
      findings.push(
        `UNCLASSIFIED served operation ${s.op} (${s.tier}) is reached by no client in frontend/ and is not acknowledged — ` +
          'wire a client, or say why in c4-acknowledged.json `servedUnused`.',
      )
    }
  }
  for (const op of Object.keys(ack.servedUnused ?? {}).sort()) {
    if (!unusedNow.has(op)) findings.push(`STALE        c4-acknowledged.json acknowledges ${op} as served-and-unused; it is now reached by a client or not served.`)
  }
  const sentNonContract = new Set(join.nonContract.map((c) => c.path))
  for (const path of Object.keys(ack.nonContractPaths ?? {}).sort()) {
    if (!sentNonContract.has(path)) findings.push(`STALE        c4-acknowledged.json acknowledges non-contract path ${path}; no client sends it.`)
  }
  return findings
}

/**
 * tools/planner/c4-verify.mjs — G4418/G4419/G4420, 5 Oct 2026.
 *
 * Each class of finding is driven RED by mutating a copy of the REAL tree's
 * data, and the real tree is required to be clean. A control whose only
 * observable behaviour is "no findings" is §5.6, so every class has a red here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildC4Data } from '../../tools/planner/extract-c4-data.mjs'
import { verifyJoins, verifyLabelPredicates, evaluatePredicate } from '../../tools/planner/c4-verify.mjs'
import { verifyEmbeddedData } from '../../tools/planner/render-c4-page.mjs'
import { clientCalls } from '../../tools/planner/c4-frontend.mjs'

const PLANNER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools', 'planner')
const readJson = (f) => JSON.parse(readFileSync(path.join(PLANNER, f), 'utf8'))
const DATA = await buildC4Data()
const ACK = readJson('c4-acknowledged.json')
const LABELS = readJson('c4-labels.json')
const clone = (x) => structuredClone(x)
const kinds = (findings) => findings.map((f) => f.split(/\s+/)[0])

test('§0 · the real tree is clean, and the subject is not empty', () => {
  assert.ok(DATA.planned.length >= 20 && DATA.totals.builtTables >= 100 && DATA.totals.servedOperations >= 50)
  assert.ok(DATA.db.control.tables.length > 0, 'the control database must be scanned (G4413)')
  assert.deepEqual(verifyJoins(DATA, ACK), [])
  const { results, findings } = verifyLabelPredicates(LABELS, DATA)
  assert.deepEqual(findings, [])
  assert.ok(Object.keys(results).length >= 8, 'a guard that evaluated no predicate must not report clean')
  assert.deepEqual(DATA.frontend.join.usedUnserved, [], 'used + unserved must be empty')
})

test('§1 · CONTRADICTS — a badge typed DESIGNED over a served tier', () => {
  const labels = clone(LABELS)
  labels.capabilityApi.status = 'DESIGNED'
  assert.match(verifyLabelPredicates(labels, DATA).findings.join('\n'), /CONTRADICTS .*capabilityApi/)
})

test('§1b · CONTRADICTS — a BUILT badge over a tier that serves nothing', () => {
  const data = clone(DATA)
  data.frontend.join.tiers.capability.served = 0
  assert.match(verifyLabelPredicates(LABELS, data).findings.join('\n'), /CONTRADICTS .*capabilityApi/)
})

test('§1c · an unknown predicate kind throws rather than passing', () => {
  assert.throws(() => evaluatePredicate({ kind: 'vibes' }, DATA), /unknown kind/)
})

test('§2 · PLANNED — a builtAs table that is not built', () => {
  const data = clone(DATA)
  const p = data.planned.find((x) => x.builtAs !== null)
  p.builtAs = 'data:tenant.no_such_table'
  p.builtAsExists = false
  assert.ok(kinds(verifyJoins(data, ACK)).includes('PLANNED'))
})

test('§2b · PLANNED — an `absent` entry whose name now exists', () => {
  const data = clone(DATA)
  const p = data.planned.find((x) => x.status === 'absent')
  p.nameExistsAs = [`data:tenant.${p.planned}`]
  assert.match(verifyJoins(data, ACK).join('\n'), new RegExp(`PLANNED .*${p.planned}.*now exists`))
})

test('§3 · UNCLASSIFIED — a new built table in neither list', () => {
  const data = clone(DATA)
  data.db.tables.push({ plane: 'data', schema: 'tenant', name: 'brand_new', columns: [], constraints: [] })
  assert.match(verifyJoins(data, ACK).join('\n'), /UNCLASSIFIED built table data:tenant\.brand_new/)
})

test('§3b · UNCLASSIFIED — a served operation no client reaches and nobody acknowledged', () => {
  const ack = clone(ACK)
  delete ack.servedUnused.admitRun
  const data = clone(DATA)
  for (const s of data.frontend.join.servedUnused) if (s.op === 'admitRun') s.ack = null
  assert.match(verifyJoins(data, ack).join('\n'), /UNCLASSIFIED served operation admitRun/)
})

test('§4 · UNSERVED — a client reaches an operation no plane mounts', () => {
  const data = clone(DATA)
  data.frontend.join.usedUnserved.push({ op: 'createUpload', tier: 'capability', by: ['frontend/src/api/x.ts#f'] })
  assert.ok(kinds(verifyJoins(data, ACK)).includes('UNSERVED'))
})

test('§5 · UNRESOLVED — a client path no tier declares', () => {
  const data = clone(DATA)
  data.frontend.join.unresolved.push({ file: 'frontend/src/api/x.ts', fn: 'f', path: '/nowhere', methods: ['GET'] })
  assert.ok(kinds(verifyJoins(data, ACK)).includes('UNRESOLVED'))
})

test('§6 · STALE — an acknowledgement that no longer describes the tree', () => {
  const ack = clone(ACK)
  ack.tables['data:tenant.long_gone'] = 'x'
  ack.servedUnused.listExceptions = 'x' // reached by a client
  ack.nonContractPaths['/never/sent'] = 'x'
  const f = verifyJoins(DATA, ack).join('\n')
  assert.match(f, /STALE .*long_gone/)
  assert.match(f, /STALE .*listExceptions/)
  assert.match(f, /STALE .*\/never\/sent/)
})

test('§7 · BROKEN — embedded data that does not round-trip is refused (G4420)', () => {
  const data = { a: "credential_ref ~ '^cred_[0-9a-f]{32}$'" }
  const shell = '<script type="application/json" id="c4data">__C4_DATA__</script><p>tail</p>'
  const json = JSON.stringify(data)
  /* The captured defect: a STRING replacement expands `$'` into the rest of the page. */
  assert.throws(() => verifyEmbeddedData(shell.replace('__C4_DATA__', json), data), /does not parse|not the data/)
  verifyEmbeddedData(shell.replace('__C4_DATA__', () => json), data)
})

test('§8 · the client join resolves helpers, suffixes and literal tails', async () => {
  const ts = (await import('typescript')).default
  const src = `
    function base(o, id, tail = '') { const u = planeEndpoint(o, \`/endpoints/\${id}\`); if (tail !== '') u.pathname = \`\${u.pathname}/\${tail}\`; return u }
    export async function stop(o) { return call(base(o, o.id, 'stop'), { method: 'POST' }) }
    export async function list(o) { return call(planeEndpoint(o, '/endpoints'), { method: 'GET' }) }`
  const calls = clientCalls(ts, 'x.ts', src).map((c) => `${c.methods.join('|')} ${c.path} ${c.fn}`).sort()
  assert.deepEqual(calls, ['GET /endpoints list', 'POST /endpoints/{}/stop stop'])
})

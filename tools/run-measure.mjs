/**
 * G1524's MEASUREMENT, AS A REPORTER — `node tools/run-measure.mjs`.
 * 5 Oct 2026, G4368.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 IT IS NOT A CHECKER AND IT IS NOT IN `npm run check`, DELIBERATELY.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * G108 admits a checker to the gate only if it is deterministic and fast, and a
 * timing is neither: it varies by machine, by load and by the second it runs.
 * A gate that failed on a slow laptop would teach people to ignore it, and a
 * gate that PASSED on a fast one would be a measurement nobody can reproduce
 * dressed as a control. So this prints and cannot fail anything —
 * `tools/skip-census.mjs`'s and `tools/served-set.mjs`'s shape.
 *
 * WHAT IT ANSWERS — G1524: *"UNMEASURED: nobody has run this against a real
 * corpus, because NO REAL CORPUS EXISTS IN THIS REPOSITORY."* That is still
 * true and this harness does not change it. It answers the narrower question
 * that CAN be answered here: for a SYNTHETIC corpus of a stated size, how long
 * is the read, the engine and the write, how much memory does the process
 * peak at, and — the pooling half, under G101 — **how long is a pooled
 * database connection HELD**.
 *
 * ⚠️ READ THE FIGURES AS SYNTHETIC. By default every document pairs exactly by
 * `exact_identifier`; `--residue-every k` makes every k-th pair residue so the
 * other passes have something to do. Neither is a real corpus.
 *
 * ⚠️ A DOCUMENT IS ONE ROW (G1504). `server/data-plane/document-assembly.ts`
 * is header-grain and refuses an indexed declaration, so `N docs × M lines` is
 * seeded as `N·M` single-row documents per side — the only shape the database
 * path can carry today — and the report says so on every line.
 *
 * USAGE
 *   node tools/run-measure.mjs                      # default sizes
 *   node tools/run-measure.mjs --docs 100,1000 --lines 1,10 --residue-every 10
 *   RECONCILE_DB_PORT=… node tools/run-measure.mjs  # a private PostgreSQL
 *
 * Each size runs in its OWN child process, so `maxRSS` is that size's peak and
 * not the largest so far. It provisions and RESETS a database named
 * `reconcile_run_measure` (override: `RECONCILE_RUN_MEASURE_DB_NAME`) and
 * touches no other.
 */

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

function list(value) {
  return String(value)
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0)
}

async function child(docs, lines, residueEvery) {
  process.env['RECONCILE_DB_NAME'] =
    process.env['RECONCILE_RUN_MEASURE_DB_NAME'] ?? 'reconcile_run_measure'
  const { resetSchema, seedTwoTenants, migratorClient } = await import('../db/provision.ts')
  const { createEnginePool } = await import('../db/tenant-scope.ts')
  const { executeRun } = await import('../server/data-plane/run-executor.ts')
  const { RUN_QUEUE_MESSAGE_KIND } = await import('../server/data-plane/run-queue.ts')
  const corpus = await import('../tests/db/run-corpus.ts')

  const TENANT = 'ten_acme'
  const DEF = 'def_measure'
  const RUN = 'run_measure'
  const pairs = docs * lines

  await resetSchema()
  await seedTwoTenants(TENANT, 'ten_globex')
  const mig = await migratorClient()
  const seedStart = Date.now()
  try {
    const q = (sql, p = []) => mig.query(sql, p)
    await corpus.seedCorpusReference(q, TENANT)
    await corpus.seedCorpusDefinition(q, TENANT, DEF)
    await corpus.seedCorpusDocuments(q, TENANT, DEF, 'sd', pairs, residueEvery)
    await corpus.seedCorpusRun(q, TENANT, RUN, DEF)
  } finally {
    await mig.end()
  }
  const seedMs = Date.now() - seedStart

  const pool = await createEnginePool(4)
  const phases = {}
  let connectionHeldMs = 0
  const started = Date.now()
  let out
  try {
    out = await executeRun(
      pool,
      { kind: RUN_QUEUE_MESSAGE_KIND, tenantId: TENANT, runId: RUN },
      {
        observe: (phase, ms) => {
          phases[phase] = (phases[phase] ?? 0) + ms
        },
        observeConnection: (ms) => {
          connectionHeldMs += ms
        },
      },
    )
  } finally {
    await pool.end()
  }
  const totalMs = Date.now() - started
  const rssMiB = process.resourceUsage().maxRSS / 1024
  process.stdout.write(
    JSON.stringify({
      docs,
      lines,
      residueEvery,
      itemsPerSide: pairs,
      outcome: out.kind,
      terminal: out.kind === 'produced' ? out.terminalStatus : null,
      seedMs,
      readMs: phases.read ?? null,
      engineMs: phases.engine ?? null,
      writeMs: phases.write ?? null,
      totalMs,
      connectionHeldMs,
      peakRssMiB: Math.round(rssMiB),
    }) + '\n',
  )
}

function pad(v, n) {
  return String(v ?? '—').padStart(n)
}

async function parent() {
  const docsList = list(arg('docs', '100,1000,5000'))
  const linesList = list(arg('lines', '1'))
  const residueEvery = Number(arg('residue-every', '0')) || 0
  const rows = []
  for (const docs of docsList) {
    for (const lines of linesList) {
      const r = spawnSync(process.execPath, [SELF, '--child', String(docs), String(lines), String(residueEvery)], {
        env: process.env,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
      const last = (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('{')).pop()
      if (r.status !== 0 || last === undefined) {
        process.stderr.write(`run-measure: ${docs}×${lines} FAILED (exit ${r.status})\n${r.stderr}\n`)
        continue
      }
      rows.push(JSON.parse(last))
    }
  }
  const head =
    '  docs × lines   items/side   outcome     read ms   engine ms   write ms   total ms   conn held ms   peak RSS MiB'
  console.log('')
  console.log(
    `RUN MEASURE — G1524, SYNTHETIC CORPUS (${residueEvery > 0 ? `every ${residueEvery}th pair is residue` : 'exact pairs, no residue'}; header-grain, G1504)`,
  )
  console.log('─'.repeat(head.length))
  console.log(head)
  console.log('─'.repeat(head.length))
  for (const r of rows) {
    console.log(
      `${pad(`${r.docs} × ${r.lines}`, 15)}${pad(r.itemsPerSide, 13)}   ${String(r.terminal ?? r.outcome).padEnd(10)}` +
        `${pad(r.readMs, 9)}${pad(r.engineMs, 12)}${pad(r.writeMs, 11)}${pad(r.totalMs, 11)}` +
        `${pad(r.connectionHeldMs, 15)}${pad(r.peakRssMiB, 15)}`,
    )
  }
  console.log('─'.repeat(head.length))
  console.log(
    'A REPORTER: it prints and fails nothing. A synthetic figure is not G1524`s real-corpus\n' +
      'measurement, which is still owed; it is the figure the next person to move\n' +
      '`RUN_MAX_EXECUTION_SECONDS` should read first.',
  )
}

if (process.argv[2] === '--child') {
  await child(Number(process.argv[3]), Number(process.argv[4]), Number(process.argv[5] ?? '0'))
} else {
  await parent()
}

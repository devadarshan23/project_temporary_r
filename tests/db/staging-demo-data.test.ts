/**
 * G3134–G3136 — `db/seeds/staging-demo-data.sql`, applied to a disposable
 * database exactly as the runbook applies it to staging (as the MIGRATOR), and
 * then READ as `ten_acme` through row level security by the production stores.
 *
 *   §0  the committed SQL is byte-identical to its generator's output — so the
 *       file cannot drift from `db/seeds/generate-demo-data.ts` (no database).
 *   §1  it applies, and applies TWICE: the second application writes nothing.
 *   §1b and it stands beside `staging-signin-seed.sql` phase 1, either order.
 *   §2  the row counts the scenario promises (1,806 of 1,820; fourteen findings).
 *   §3  the production readers — `readRunEngineAccount`, `readExceptionQueuePage`,
 *       `readProposalsFor` — answer it as `ten_acme` under RLS, and another
 *       tenant's scope sees none of it.
 *   §4  🛑 ENGINE-TRUE: every seeded account is DELETED and every run is
 *       re-executed by the PRODUCTION `executeRun()` over the seeded substrate,
 *       and the fresh account must equal the seeded one, row for row. A seeded
 *       account the substrate cannot reproduce is a red here.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import type { RunId, TenantId } from '../../model/kernel.ts'
import { RUN_QUEUE_MESSAGE_KIND } from '../../server/data-plane/run-queue.ts'
import { executeRun } from '../../server/data-plane/run-executor.ts'
import { readRunEngineAccount } from '../../server/data-plane/run-account-store.ts'
import { readExceptionQueuePage } from '../../server/data-plane/exception-store.ts'
import { readProposalsFor } from '../../server/data-plane/proposal-store.ts'
import { SEED_PATH, generateDemoSeedSql } from '../../db/seeds/generate-demo-data.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_DEMO_SEED_DB_NAME'] ?? runScopedName('reconcile_demo_seed_test')

const SEED = readFileSync(SEED_PATH, 'utf8')
const PHASE1 = readFileSync(new URL('../../db/seeds/staging-signin-seed.sql', import.meta.url), 'utf8')
const ACME = 'ten_acme'

const RUNS = [
  'run_demo_3wm_w09',
  'run_demo_3wm_w10',
  'run_demo_card_w10',
  'run_demo_bank_w10',
  'run_demo_ic_w10',
  'run_demo_payroll_w10',
] as const

/** Every table the seed writes, for the idempotence count. */
const TABLES = [
  'tenant.document_type', 'tenant.document_field_spec', 'tenant.endpoint', 'tenant.endpoint_sftp',
  'tenant.endpoint_s3', 'tenant.intake_channel', 'tenant.endpoint_document_type', 'tenant.endpoint_field_mapping',
  'tenant.reconciliation_definition', 'tenant.definition_engine_spec', 'tenant.definition_population',
  'tenant.definition_population_identifier', 'tenant.definition_normalisation_op', 'tenant.definition_strategy',
  'tenant.definition_slot', 'tenant.definition_archetype', 'tenant.disposition', 'tenant.approval_config',
  'tenant.reconciliation_period', 'tenant.arrival', 'tenant.source_document', 'tenant.document_payload',
  'tenant.document_control_total', 'tenant.document_slot_binding', 'public.run',
  'tenant.exception', 'tenant.exception_observed_value', 'tenant.resolution_proposal',
  'tenant.proposal_evidence', 'tenant.approval_decision', 'tenant.definition_exception_rule',
] as const

/** The engine account, every channel, with the columns it is compared on. */
const ACCOUNT_TABLES: readonly (readonly [string, string])[] = [
  ['tenant.run_engine_account', 'run_id, outcome, terminal_status'],
  ['tenant.run_admission_rate', '*'],
  ['tenant.run_document_account', '*'],
  ['tenant.run_population_defect', '*'],
  ['tenant.run_refused_item', '*'],
  ['tenant.run_ambiguity', '*'],
  ['tenant.run_ambiguity_ref', '*'],
  ['tenant.run_search_boundary_entry', '*'],
  ['tenant.run_postcondition', '*'],
  ['tenant.run_completeness', '*'],
  ['tenant.run_meter_fact', '*'],
  ['tenant.run_residue', '*'],
  ['tenant.run_held_read', '*'],
  ['tenant.run_allocation', '*'],
  ['tenant.run_refusal', 'run_id, kind, side, expected, supplied, binding_index, money_refusal_kind, tolerance_route, tolerance_index, ref_source_document_id, ref_line_index, source_document_id'],
  ['tenant.run_refusal_normalisation_defect', '*'],
]

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
databaseRequiredUnderCi('the staging demo-data seed suite', probe)

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params)).rows as T[]
  } finally {
    await mig.end()
  }
}

async function run(sql: string): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql)
  } finally {
    await mig.end()
  }
}

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const t of [...TABLES, ...ACCOUNT_TABLES.map(([t]) => t)]) {
    const [row] = await q<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`)
    out[t] = row?.n ?? -1
  }
  return out
}

/** Every account row, as the migrator, in a total order that names no ordinal of ours. */
async function accountSnapshot(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {}
  for (const [table, columns] of ACCOUNT_TABLES) {
    const rows = await q(`SELECT ${columns} FROM ${table}`)
    out[table] = rows
      .map((r) => {
        const { recorded_at: _a, ...rest } = r as Record<string, unknown>
        return JSON.stringify(rest)
      })
      .sort()
  }
  return out
}

describe('the staging demo seed matches its generator', () => {
  it('§0 · the committed SQL is byte-identical to `generate-demo-data.ts`', async () => {
    const generated = await generateDemoSeedSql()
    assert.ok(generated === SEED, 'db/seeds/staging-demo-data.sql is STALE — run: node db/seeds/generate-demo-data.ts')
  })

  it('§0b · it names no tenant but `ten_acme`, and carries no credential handle', () => {
    const tenants = new Set(SEED.match(/'ten_[a-z0-9_]+'/g) ?? [])
    assert.deepEqual([...tenants], [`'${ACME}'`])
    assert.equal(/cred_[0-9a-f]{32}/.test(SEED), false, 'a credential handle is in the seed')
    assert.equal(/credential_ref/.test(SEED.replace(/^--.*$/gm, '')), false)
  })

  it('§0c · C3-15 (G3944) — every document type it declares carries a LABEL that is not its id', () => {
    const block = SEED.slice(SEED.indexOf('INSERT INTO tenant.document_type ('))
    const rows = [...block.slice(0, block.indexOf(';')).matchAll(/\('ten_acme', '([^']+)', '[^']*', '([^']*)'/g)]
    assert.ok(rows.length >= 5, `the document-type block parsed to ${String(rows.length)} rows — vacuous`)
    for (const [, id, label] of rows) {
      assert.ok(label !== undefined && label.trim() !== '', `\`${String(id)}\` has no label`)
      assert.notEqual(label, id, `\`${String(id)}\`'s label is its id — the surface would show the id`)
      assert.equal(/^dt_/.test(label ?? ''), false, `\`${String(id)}\`'s label is id-shaped`)
    }
  })

  /* U-28 · G4176 — THE SEED NEEDS NO REPAIR, AND NOW THAT IS ASSERTED RATHER
     THAN READ. A picker shows a type's reference beside its label only where
     the label does not tell it apart (G4175); a seed whose labels collided
     would make the demo tenant's pickers read as references. The fold is
     `documentTypeReference()`'s — case and whitespace — so this cannot pass on
     a pair the picker would treat as one. Witnessed RED by relabelling
     `dt_demo_po_receipt` to " supplier  INVOICE". */
  it('§0d · U-28 (G4176) — no two document types it declares share a label, once case and whitespace are folded', () => {
    const block = SEED.slice(SEED.indexOf('INSERT INTO tenant.document_type ('))
    const rows = [...block.slice(0, block.indexOf(';')).matchAll(/\('(ten_[a-z_]+)', '([^']+)', '[^']*', '([^']*)'/g)]
    assert.ok(rows.length >= 5, `the document-type block parsed to ${String(rows.length)} rows — vacuous`)
    const seen = new Map<string, string>()
    for (const [, tenant, id, label] of rows) {
      const folded = `${String(tenant)}|${(label ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`
      const first = seen.get(folded)
      assert.equal(first, undefined, `\`${String(id)}\` and \`${String(first)}\` share the label ${JSON.stringify(label)} — a picker could not tell them apart by name`)
      seen.set(folded, String(id))
    }
  })
})

describe('the staging demo seed', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    pool = await createAppPool(4)
  })

  after(async () => {
    await pool?.end()
  })

  it('§1 · applies, and a second application writes nothing', async () => {
    await run(SEED)
    const first = await counts()
    await run(SEED)
    assert.deepEqual(await counts(), first)
  })

  it('§1b · stands beside the sign-in seed phase 1, either order', async () => {
    const before = await counts()
    await run(PHASE1)
    await run(SEED)
    assert.deepEqual(await counts(), before)
    const [t] = await q<{ residency: string }>(`SELECT residency FROM tenant.tenant WHERE id = $1`, [ACME])
    assert.equal(t?.residency, 'us-west-2')
  })

  it('§2 · the scenario: 1,806 of 1,820 on the three-way match, fourteen findings, five definitions', async () => {
    const c = await counts()
    assert.equal(c['tenant.reconciliation_definition'], 5)
    assert.equal(c['tenant.reconciliation_period'], 2)
    assert.equal(c['public.run'], 6)
    assert.equal(c['tenant.run_engine_account'], 6)
    assert.equal(c['tenant.run_refusal'], 1)
    assert.equal(c['tenant.endpoint'], 6)
    assert.equal(c['tenant.endpoint_sftp'], 4)
    assert.equal(c['tenant.endpoint_s3'], 2)
    assert.equal(c['tenant.exception'], 20)
    assert.equal(c['tenant.resolution_proposal'], 4)
    assert.equal(c['tenant.approval_decision'], 4)
    assert.equal(c['tenant.source_document'], c['tenant.arrival'])
    assert.equal(c['tenant.source_document'], c['tenant.document_slot_binding'])

    const rates = await q<{ side: string; presented: number; admitted: number }>(
      `SELECT side, presented, admitted FROM tenant.run_admission_rate WHERE run_id = 'run_demo_3wm_w10' ORDER BY side`,
    )
    assert.deepEqual(rates, [
      { side: 'left', presented: 1820, admitted: 1820 },
      { side: 'right', presented: 1812, admitted: 1812 },
    ])
    const [matched] = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM tenant.run_allocation WHERE run_id = 'run_demo_3wm_w10'`,
    )
    assert.equal(matched?.n, 1806)
    const bySide = await q<{ side: string; n: number }>(
      `SELECT side, count(*)::int AS n FROM tenant.run_residue WHERE run_id = 'run_demo_3wm_w10' GROUP BY side ORDER BY side`,
    )
    assert.deepEqual(bySide, [{ side: 'left', n: 14 }, { side: 'right', n: 6 }])
    const [three] = await q<{ n: number; assigned: number }>(
      `SELECT count(*)::int AS n, count(assigned_to)::int AS assigned
         FROM tenant.exception WHERE definition_id = 'def_demo_three_way_match'`,
    )
    assert.deepEqual(three, { n: 14, assigned: 5 })
    const statuses = await q<{ status: string; n: number }>(
      `SELECT status, count(*)::int AS n FROM tenant.exception GROUP BY status ORDER BY status`,
    )
    assert.deepEqual(statuses, [
      { status: 'investigating', n: 1 },
      { status: 'open', n: 16 },
      { status: 'pending_approval', n: 2 },
      { status: 'resolved', n: 1 },
    ])
  })

  it('§3 · the production readers answer it as `ten_acme`, under RLS', async () => {
    const read = await withTenantScope(pool, ACME, async (tx) => ({
      account: await readRunEngineAccount(tx, 'run_demo_3wm_w10'),
      refused: await readRunEngineAccount(tx, 'run_demo_payroll_w10'),
      queue: await readExceptionQueuePage(tx, {}, { cursor: undefined, limit: 50, sort: 'severity_then_value' }),
      proposals: await readProposalsFor(tx, 'exc_demo_3wm_w10_01'),
    }))
    assert.equal(read.account.kind, 'account')
    if (read.account.kind === 'account') assert.equal(read.account.account['outcome'], 'produced')
    assert.equal(read.refused.kind, 'account')
    if (read.refused.kind === 'account') assert.equal(read.refused.account['outcome'], 'refused')

    assert.equal(read.queue.kind, 'page')
    if (read.queue.kind === 'page') {
      assert.equal(read.queue.items.length, 20)
      assert.equal(read.queue.items[0]?.['severity'], 'critical')
    }

    assert.equal(read.proposals.ok, true, JSON.stringify(read.proposals))
    if (read.proposals.ok) {
      const execution = read.proposals.value[0]?.['execution'] as Record<string, unknown> | undefined
      /* Four eyes: one approval of two. */
      assert.equal(execution?.['state'], 'approved_pending_second_approver')
    }

    /* The negative control: another tenant's scope sees none of it. */
    const other = await withTenantScope(pool, 'ten_globex', async (tx) => ({
      runs: (await tx.query('SELECT count(*)::int AS n FROM run', [])).rows,
      exceptions: (await tx.query('SELECT count(*)::int AS n FROM tenant.exception', [])).rows,
    }))
    assert.deepEqual(other, { runs: [{ n: 0 }], exceptions: [{ n: 0 }] })
  })

  it('§5 · G3804 — the register\'s signed Variance column totals to the run\'s `openResidual` ("In variance"), run by run', async () => {
    /* THE OWNER'S RULING ON C3-02/C3-09: *"Store a signed delta: the engine
       records direction (over/under); the column shows sign, totals net
       correctly, 'In variance' is defined as the open residual."* Both figures
       come from the PRODUCTION readers, under RLS, as `ten_acme`. Every status
       is summed — a resolved line is still in the engine's residue. */
    const produced = RUNS.filter((r) => r !== 'run_demo_payroll_w10' && r !== 'run_demo_3wm_w09')
    const seen: Record<string, [string, string]> = {}
    for (const runId of produced) {
      const read = await withTenantScope(pool, ACME, async (tx) => ({
        account: await readRunEngineAccount(tx, runId),
        queue: await readExceptionQueuePage(tx, { runId: [runId] }, { cursor: undefined, limit: 200, sort: 'severity_then_value' }),
      }))
      assert.equal(read.account.kind, 'account')
      assert.equal(read.queue.kind, 'page')
      if (read.account.kind !== 'account' || read.queue.kind !== 'page') continue
      const residual = read.account.account['openResidual'] as { kind: string; total?: { amountMinor: string } }
      assert.equal(residual.kind, 'total', `${runId}: ${JSON.stringify(residual)}`)
      let column = 0n
      for (const row of read.queue.items) {
        const v = row['variance'] as { amountMinor: string } | null
        assert.notEqual(v, null, `${runId}: ${String(row['exceptionId'])} publishes no variance`)
        column += BigInt(v!.amountMinor)
      }
      seen[runId] = [column.toString(), residual.total!.amountMinor]
      assert.equal(column.toString(), residual.total!.amountMinor, `${runId}: column ${column} against In variance ${residual.total!.amountMinor}`)
    }
    /* The figures, so a reader sees the netting rather than trusting it: the
       card run's two scheme-fee lines are UNDER, and the column is negative. */
    assert.deepEqual(seen, {
      run_demo_3wm_w10: ['12812400', '12812400'],
      run_demo_card_w10: ['-59855', '-59855'],
      run_demo_bank_w10: ['9824900', '9824900'],
      run_demo_ic_w10: ['2756000', '2756000'],
    })
  })

  it('§5b · G3807 — every demo definition declares what its residue raises, and a domain', async () => {
    const rules = await q<{ definition_id: string; n: number }>(
      `SELECT definition_id, count(*)::int AS n FROM tenant.definition_exception_rule GROUP BY definition_id ORDER BY definition_id`,
    )
    assert.equal(rules.length, 5)
    for (const r of rules) assert.equal(r.n, 2, r.definition_id)
    const [undeclared] = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM tenant.reconciliation_definition WHERE domain IS NULL`,
    )
    assert.equal(undeclared?.n, 0)
  })

  it('§4 · ENGINE-TRUE: re-executing every run over the seeded substrate reproduces every seeded account row', async () => {
    const seeded = await accountSnapshot()
    await q(`DELETE FROM tenant.run_engine_account WHERE tenant_id = $1`, [ACME])
    const [left] = await q<{ n: number }>('SELECT count(*)::int AS n FROM tenant.run_residue')
    assert.equal(left?.n, 0, 'the delete did not cascade')

    /* G4133 — the executor no longer re-executes a run whose row is already
     * SETTLED (`already_settled`), so the seeded runs are put back to
     * `queued` first, as the migrator, and their seeded statuses are
     * required back afterwards: the re-execution must reproduce the run row's
     * word as well as its account. Measured: without the reset every run
     * answered `already_settled`. */
    const seededStatus = await q<{ id: string; status: string }>(
      `SELECT id, status FROM run WHERE tenant_id = $1 AND id = ANY($2) ORDER BY id`,
      [ACME, RUNS],
    )
    await q(
      `UPDATE run SET status = 'queued', finished_at = NULL WHERE tenant_id = $1 AND id = ANY($2)`,
      [ACME, RUNS],
    )

    const kinds: string[] = []
    for (const runId of RUNS) {
      const out = await executeRun(pool, {
        kind: RUN_QUEUE_MESSAGE_KIND,
        tenantId: ACME as TenantId,
        runId: runId as RunId,
      })
      kinds.push(out.kind)
    }
    assert.deepEqual(kinds, ['produced', 'produced', 'produced', 'produced', 'produced', 'engine_refused'])
    assert.deepEqual(
      await q<{ id: string; status: string }>(
        `SELECT id, status FROM run WHERE tenant_id = $1 AND id = ANY($2) ORDER BY id`,
        [ACME, RUNS],
      ),
      seededStatus,
      'the re-executed run rows do not carry the seeded statuses',
    )

    const fresh = await accountSnapshot()
    for (const [table] of ACCOUNT_TABLES) {
      assert.deepEqual(fresh[table], seeded[table], `${table} differs from what executeRun() produces`)
    }
  })
})

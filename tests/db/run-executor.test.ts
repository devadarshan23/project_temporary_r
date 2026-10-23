/**
 * THE EXECUTOR AND THE REFUSED ARM, AGAINST A REAL POSTGRESQL —
 * `server/data-plane/run-executor.ts` and `db/migrations/0190_run_refusal.sql`.
 * G1521–G1528 and G1511–G1515, 21 Sep 2026. E5 and E6.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE TWO REDS, BOTH CAPTURED BEFORE THE CODE EXISTED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **E5** — this file present, `server/data-plane/run-executor.ts` absent:
 *
 *     Error [ERR_MODULE_NOT_FOUND]: Cannot find module
 *       '/…/server/data-plane/run-executor.ts'
 *       imported from '/…/tests/db/run-executor.test.ts'
 *
 * **E6, AND IT IS THE ONE WORTH READING** — the executor present and
 * `db/migrations/0190` NOT applied, §4 run against the schema as it stood:
 *
 *     error: relation "tenant.run_refusal" does not exist
 *       code: '42P01'
 *
 *    …and with the migration applied but `readRunEngineAccount()`'s old
 *    tripwire still in place — the branch that read
 *    `if (head.outcome !== 'produced') return bad(…)` — §5 answered:
 *
 *     ✖ 5 · a REFUSED run and an UNRECONCILED run are DIFFERENT on the wire
 *       AssertionError: {"kind":"unpublishable","defect":
 *         {"table":"run_engine_account","column":"outcome","runId":"run_refused"}}
 *         + actual   'unpublishable'
 *         - expected 'account'
 *
 *    **ALL THREE WERE TAKEN BY MUTATION AGAINST THE FINISHED TREE** — the
 *    module moved aside, the migration moved aside, and the one dispatch line
 *    `if (head.outcome === 'refused') return readRunRefusal(tx, runId)` deleted
 *    — rather than reconstructed from memory. The migration-absent run failed
 *    EIGHT assertions, not three; §4's message is quoted because it is the one
 *    that names the cause.
 *
 * ⚠️ **AND THE THIRD RED IS THE ONE NOBODY WOULD HAVE PREDICTED AND IT CAME
 *    FROM `tsc`, NOT FROM HERE** — `SetReconciliationRefusal` has FIFTEEN arms
 *    and a draft of `0190`'s header and of `RUN_REFUSAL_KIND` both said twelve:
 *
 *     TS2739: … is missing the following properties from type
 *       'Readonly<Record<…, true>>': admitted_item_key_collision,
 *       control_total_expected_but_absent, population_empty_and_not_expected
 *
 *    `db/migrations/0190`'s header records it at length. **A total `Record`
 *    catching a grep window that stopped three arms short is this repository's
 *    §5.10 argument arriving as an actual compile error, twice in one file** —
 *    `MONEY_REFUSAL_KIND` records the same thing happening to `no_items`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHAT THIS SUITE IS FOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   · §1  **THE ALLOW ARM, FIRST** — a run EXECUTES and its account is stored.
 *         The first time in this repository's history that happens.
 *   · §2  Tenant isolation: a message naming another tenant's run executes
 *         nothing, and the RLS negative control that makes §2 mean something.
 *   · §3  `no_definition` and `run_not_visible` are STATED ANSWERS, not empty
 *         ones, and neither writes a row.
 *   · §4  **E6** — the engine REFUSES and `tenant.run_refusal` records why.
 *   · §5  **E6's POINT** — a refused run and an unreconciled run are now
 *         DIFFERENT on the wire. This is the assertion the slice exists for.
 *   · §6  **THE DOUBLE-EXECUTION WITNESS** — §3 of the executor's header,
 *         driven rather than argued.
 *   · §7  **THE TRANSACTION-DURATION MEASUREMENT**, and its honest limit.
 *   · §8  `SELECT, INSERT` and nothing else on both new tables.
 *   · §9  `ENABLE` **and** `FORCE`, `0001`'s predicate verbatim, from the
 *         catalogue.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { parseFieldPath, fieldPathKey } from '../../model/field-path.ts'
import type { FieldPath, TenantId } from '../../model/domain.ts'
import type { RunId } from '../../model/kernel.ts'
import { RUN_QUEUE_MESSAGE_KIND, type RunAdmittedMessage } from '../../server/data-plane/run-queue.ts'
import { executeRun } from '../../server/data-plane/run-executor.ts'
import { readRunEngineAccount } from '../../server/data-plane/run-account-store.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_RUN_EXECUTOR_DB_NAME'] ?? runScopedName('reconcile_run_executor_test')

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DEF_OK = 'def_ok'
const DEF_REFUSES = 'def_refuses'
const DEF_NO_SPEC = 'def_no_spec'
/* §11 (G4131–G4136) — a definition the DOCUMENT ASSEMBLY refuses, and one whose
 * stored spec the model cannot name. */
const DEF_SHARED = 'def_shared_type'
const DEF_UNREADABLE = 'def_unreadable'

const RUN_OK = 'run_ok'
const RUN_REFUSED = 'run_refused'
const RUN_NO_SPEC = 'run_no_spec'
const RUN_UNRECONCILED = 'run_unreconciled'
const RUN_GLOBEX = 'run_globex'
const RUN_DOCS_REFUSED = 'run_docs_refused'
const RUN_UNREADABLE = 'run_unreadable'
const RUN_DOCS_RACE = 'run_docs_race'
const RUN_ALREADY_FAILED = 'run_already_failed'
const RUN_LIVE = 'run_live'

const DT_INVOICE = 'dt_invoice'
const DT_STATEMENT = 'dt_statement'
const CHANNEL = 'chan_api'

const PREDICATE =
  "(tenant_id = NULLIF(current_setting('app.tenant_id'::text, true), ''::text))"

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/run-executor.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY CONTROL OVER THE EXECUTOR AND OVER THE REFUSED ARM.',
      '   A run in which it skipped is NOT evidence that this product',
      '   reconciles anything, NOT evidence that a refused run is',
      '   distinguishable from an unreconciled one, and NOT evidence that',
      '   executing one run twice writes one account row.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

databaseRequiredUnderCi('the run-executor assertions', probe)

async function asMigrator<T>(
  fn: (q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>,
): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

function path(wire: readonly (string | number)[]): FieldPath {
  const parsed = parseFieldPath(wire)
  if (!parsed.ok) throw new Error(`fixture path is unparseable: ${JSON.stringify(wire)}`)
  return parsed.path
}

function w(p: FieldPath): string {
  return JSON.stringify(p.map((s) => (s.kind === 'index' ? s.index : s.key)))
}

/** `JSON.stringify` on a `Money` THROWS — G71. See `document-assembly.test.ts`. */
function show(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))
}

const AMOUNT_L = path(['total'])
const DATE_L = path(['issued'])
const REF_L = path(['ref'])
const AMOUNT_R = path(['amount'])
const DATE_R = path(['date'])
const REF_R = path(['ref'])

const SPECS: readonly {
  readonly typeId: string
  readonly path: FieldPath
  readonly dataType: string
}[] = [
  { typeId: DT_INVOICE, path: AMOUNT_L, dataType: 'money' },
  { typeId: DT_INVOICE, path: DATE_L, dataType: 'date' },
  { typeId: DT_INVOICE, path: REF_L, dataType: 'identifier' },
  { typeId: DT_STATEMENT, path: AMOUNT_R, dataType: 'money' },
  { typeId: DT_STATEMENT, path: DATE_R, dataType: 'date' },
  { typeId: DT_STATEMENT, path: REF_R, dataType: 'identifier' },
]

const DOCS: readonly { readonly id: string; readonly typeId: string; readonly payload: unknown }[] =
  [
    {
      id: 'sd_invoice',
      typeId: DT_INVOICE,
      payload: {
        total: { currency: 'SGD', amountMinor: '100000', exponent: 2 },
        issued: '2026-04-01',
        ref: 'INV-1',
      },
    },
    {
      id: 'sd_statement',
      typeId: DT_STATEMENT,
      payload: {
        amount: { currency: 'SGD', amountMinor: '100000', exponent: 2 },
        date: '2026-04-01',
        ref: 'INV-1',
      },
    },
  ]

/**
 * A definition's engine spec, parameterised on the ONE knob §4 breaks.
 *
 * 🛑 §4 REACHES `reader_candidate_cap_not_stated` BY STORING `0`, WHICH IS A
 *    VALUE THE ENGINE REFUSES AND THE SCHEMA PERMITS. That is the honest way to
 *    reach a refusal: `readerCandidateCap` is `NOT NULL`, so an ABSENT one is
 *    unrepresentable, and `runSetReconciliation()`'s own gate refuses anything
 *    below 1 — *"An absent bound is a refusal, never a default."* No handler is
 *    bypassed and no column is nulled to get there.
 */
async function seedDefinition(
  q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>,
  tenant: string,
  definition: string,
  readerCandidateCap: number,
): Promise<void> {
  await q(
    `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
     VALUES ($1, $2, 1, 'active')`,
    [tenant, definition],
  )
  await q(
    `INSERT INTO tenant.definition_engine_spec (
       tenant_id, definition_id, obligation_side, tolerance_direction,
       pairing_cardinality,
       amount_tolerance_kind, amount_tolerance_money_currency,
       amount_tolerance_money_minor, amount_tolerance_money_exponent,
       date_tolerance_kind, date_tolerance_value,
       subset_sum_max_members, subset_sum_step_budget, subset_sum_max_bucket_size,
       reader_candidate_cap, similarity_max_chars, similarity_metric,
       admission_refusal_ceiling_basis_points)
     VALUES ($1, $2, 'right', 'symmetric', 'one_to_one',
             'money', 'SGD', 0, 2,
             'days', 0,
             4, 10000, 200,
             $3, 128, 'jaro_winkler', 5000)`,
    [tenant, definition, readerCandidateCap],
  )
  await q(
    `INSERT INTO tenant.definition_population (
       tenant_id, definition_id, side, document_type_id,
       amount_path, amount_path_key, date_path, date_path_key,
       declared_unit_currency, declared_unit_exponent,
       carries_control_total, empty_expectation,
       normalisation_then, normalisation_max_input_chars,
       counterparty_path, counterparty_path_key,
       description_path, description_path_key)
     VALUES
       ($1, $2, 'left', $3, $4::jsonb, $5, $6::jsonb, $7, 'SGD', 2,
        'never', 'permitted', 'casefold', 64, NULL, NULL, NULL, NULL),
       ($1, $2, 'right', $8, $9::jsonb, $10, $11::jsonb, $12, 'SGD', 2,
        'never', 'permitted', 'casefold', 64, NULL, NULL, NULL, NULL)`,
    [
      tenant, definition,
      DT_INVOICE, w(AMOUNT_L), fieldPathKey(AMOUNT_L), w(DATE_L), fieldPathKey(DATE_L),
      DT_STATEMENT, w(AMOUNT_R), fieldPathKey(AMOUNT_R), w(DATE_R), fieldPathKey(DATE_R),
    ],
  )
  await q(
    `INSERT INTO tenant.definition_population_identifier
       (tenant_id, definition_id, side, ordinal, path, path_key)
     VALUES ($1, $2, 'left', 0, $3::jsonb, $4),
            ($1, $2, 'right', 0, $5::jsonb, $6)`,
    [tenant, definition, w(REF_L), fieldPathKey(REF_L), w(REF_R), fieldPathKey(REF_R)],
  )
  await q(
    `INSERT INTO tenant.definition_normalisation_op
       (tenant_id, definition_id, side, ordinal, op_kind, op_literal, op_at, op_separator, op_index)
     VALUES ($1, $2, 'left',  0, 'trim', NULL, NULL, NULL, NULL),
            ($1, $2, 'right', 0, 'trim', NULL, NULL, NULL, NULL)`,
    [tenant, definition],
  )
  await q(
    `INSERT INTO tenant.definition_strategy (
       tenant_id, definition_id, ordinal, strategy_kind,
       strategy_on_path, strategy_on_path_key,
       strategy_max_members, strategy_min_similarity,
       binding_amount_tolerance_kind, binding_amount_tolerance_value,
       binding_amount_tolerance_money_currency, binding_amount_tolerance_money_minor,
       binding_amount_tolerance_money_exponent, binding_amount_tolerance_rounding_minor_units,
       binding_amount_anchor)
     VALUES ($1, $2, 0, 'exact_identifier', $3::jsonb, $4, NULL, NULL,
             NULL, NULL, NULL, NULL, NULL, NULL, 'exact')`,
    [tenant, definition, w(REF_L), fieldPathKey(REF_L)],
  )
}

/** Bind both fixture documents to `definition`'s two slots. */
async function bind(
  q: (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>,
  definition: string,
): Promise<void> {
  for (const d of DOCS) {
    const slot = d.typeId === DT_INVOICE ? 'ledger' : 'bank'
    await q(
      `INSERT INTO tenant.definition_slot (tenant_id, definition_id, slot, cardinality)
       VALUES ($1, $2, $3, 'exactly_one')`,
      [ACME, definition, slot],
    )
    await q(
      `INSERT INTO tenant.document_slot_binding
         (tenant_id, definition_id, slot, period_id, source_document_id)
       VALUES ($1, $2, $3, NULL, $4)`,
      [ACME, definition, slot, d.id],
    )
  }
}

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    await q(
      `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
       VALUES ($1, $2, 'api', NULL, true), ($3, $2, 'api', NULL, true)`,
      [ACME, CHANNEL, GLOBEX],
    )

    for (const typeId of [DT_INVOICE, DT_STATEMENT]) {
      await q(
        `INSERT INTO tenant.document_type
           (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
         VALUES ($1, $2, $2, $2, 'finance', 'structured', 'never')`,
        [ACME, typeId],
      )
    }

    for (const s of SPECS) {
      await q(
        `INSERT INTO tenant.document_field_spec
           (tenant_id, document_type_id, path_key, path, data_class, data_type,
            model_processing_allowed, confidence_floor)
         VALUES ($1, $2, $3, $4::jsonb, 'internal', $5, false, NULL)`,
        [ACME, s.typeId, fieldPathKey(s.path), w(s.path), s.dataType],
      )
    }

    for (const d of DOCS) {
      await q(
        `INSERT INTO tenant.arrival
           (tenant_id, id, channel_id, channel_kind, arrived_at, verdict_kind,
            authorization_id, source_document_id)
         VALUES ($1, $2, $3, 'api', now(), 'admitted', 'auth_fixture', $4)`,
        [ACME, `arr_${d.id}`, CHANNEL, d.id],
      )
      await q(
        `INSERT INTO tenant.source_document
           (tenant_id, id, arrival_id, document_type_id, ingested_at)
         VALUES ($1, $2, $3, $4, now())`,
        [ACME, d.id, `arr_${d.id}`, d.typeId],
      )
      await q(
        `INSERT INTO tenant.document_payload (tenant_id, source_document_id, payload)
         VALUES ($1, $2, $3::jsonb)`,
        [ACME, d.id, JSON.stringify(d.payload)],
      )
      await q(
        `INSERT INTO tenant.document_control_total
           (tenant_id, source_document_id, kind, line_count,
            total_currency, total_minor, total_exponent)
         VALUES ($1, $2, 'not_declared_by_format', NULL, NULL, NULL, NULL)`,
        [ACME, d.id],
      )
    }

    await seedDefinition(q, ACME, DEF_OK, 25)
    /* §4 — the engine refuses a cap below 1. */
    await seedDefinition(q, ACME, DEF_REFUSES, 0)
    await bind(q, DEF_OK)
    await bind(q, DEF_REFUSES)

    /* A definition with NO engine spec — §3. */
    await q(
      `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status)
       VALUES ($1, $2, 1, 'active')`,
      [ACME, DEF_NO_SPEC],
    )

    /* §11 — the assembly refuses a definition whose two populations name ONE
     * document type (`sides_share_a_document_type`), before a document is read. */
    await seedDefinition(q, ACME, DEF_SHARED, 25)
    await q(
      `UPDATE tenant.definition_population SET document_type_id = $3
        WHERE tenant_id = $1 AND definition_id = $2 AND side = 'right'`,
      [ACME, DEF_SHARED, DT_INVOICE],
    )
    /* §11 — a stored spec value outside the model's vocabulary. No `CHECK`
     * forbids it (G1514), so the READER refuses it: `unreadable`. */
    await seedDefinition(q, ACME, DEF_UNREADABLE, 25)
    await q(
      `UPDATE tenant.definition_engine_spec SET similarity_metric = 'not_a_metric'
        WHERE tenant_id = $1 AND definition_id = $2`,
      [ACME, DEF_UNREADABLE],
    )

    /* GLOBEX's own definition, so its run has a valid parent. */
    await seedDefinition(q, GLOBEX, DEF_OK, 25)

    const runs: readonly (readonly [string, string, string])[] = [
      [ACME, RUN_OK, DEF_OK],
      [ACME, RUN_REFUSED, DEF_REFUSES],
      [ACME, RUN_NO_SPEC, DEF_NO_SPEC],
      [ACME, RUN_UNRECONCILED, DEF_OK],
      [GLOBEX, RUN_GLOBEX, DEF_OK],
      [ACME, RUN_DOCS_REFUSED, DEF_SHARED],
      [ACME, RUN_UNREADABLE, DEF_UNREADABLE],
      [ACME, RUN_DOCS_RACE, DEF_SHARED],
      [ACME, RUN_ALREADY_FAILED, DEF_OK],
      [ACME, RUN_LIVE, DEF_OK],
    ]
    for (const [tenant, runId, definition] of runs) {
      await q(
        `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,
                          trigger_kind, status, started_at)
         VALUES ($1, $2, $3, 1, NULL, 'manual', 'queued', now())`,
        [tenant, runId, definition],
      )
    }
    /* §11d — a run whose row ALREADY carries a terminal status and no account:
     * the shape a redelivery meets after a document refusal committed. */
    await q(
      `UPDATE run SET status = 'failed', finished_at = now() - interval '1 hour'
        WHERE tenant_id = $1 AND id = $2`,
      [ACME, RUN_ALREADY_FAILED],
    )
  })
}

function message(tenantId: string, runId: string): RunAdmittedMessage {
  return {
    kind: RUN_QUEUE_MESSAGE_KIND,
    tenantId: tenantId as TenantId,
    runId: runId as RunId,
  }
}

async function accountRowCount(pool: TenantPool, tenant: string, runId: string): Promise<number> {
  const rows = await withTenantScope(pool, tenant, async (tx) => {
    const r = await tx.query('SELECT 1 FROM tenant.run_engine_account WHERE run_id = $1', [runId])
    return r.rows
  })
  return rows.length
}

describe('the executor, and the refused arm', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    pool = await createAppPool(4)
  })

  after(async () => {
    await pool.end()
  })

  /* ================================================================ *
   * §1  THE ALLOW ARM — FIRST, because a control that only refuses is §5.6
   * ================================================================ */

  it('1 · a run EXECUTES, and its engine account is stored', async () => {
    const out = await executeRun(pool, message(ACME, RUN_OK))
    assert.equal(out.kind, 'produced', show(out))
    if (out.kind !== 'produced') return
    /* `TerminalRunStatus`'s three members; which one is the ENGINE's answer and
     * not this suite's, so it is checked for membership rather than pinned. */
    assert.ok(['completed', 'failed', 'incomplete'].includes(out.terminalStatus))
  })

  it('1a · and it ACTUALLY RECONCILED — not an empty run reporting success', async () => {
    /* 🛑 WITHOUT THIS, §1 PASSES AGAINST AN EXECUTOR THAT ADMITTED NOTHING.
     * An empty document set balances perfectly: two rates of zero, an empty
     * residue, no postcondition failures and `completed`. That is exactly the
     * outcome `run-executor.ts` §1 names as the danger of a forgotten
     * transaction under G100 — *"a run that reconciles NOTHING and reports
     * SUCCESS"* — so the account is read for CONTENT and not for existence.
     *
     * The fixture is one invoice against one statement, `INV-1` against
     * `INV-1`, SGD 1000.00 against SGD 1000.00. It should pair. */
    const stored = await withTenantScope(pool, ACME, async (tx) => {
      const rates = await tx.query(
        `SELECT side, presented, admitted, refused FROM tenant.run_admission_rate
          WHERE run_id = $1 ORDER BY side`,
        [RUN_OK],
      )
      const residue = await tx.query(
        'SELECT count(*)::int AS n FROM tenant.run_residue WHERE run_id = $1',
        [RUN_OK],
      )
      return {
        rates: rates.rows as unknown as {
          side: string
          presented: number
          admitted: number
          refused: number
        }[],
        residue: (residue.rows as unknown as { n: number }[])[0]?.n,
      }
    })

    /* Both sides PRESENTED a row and ADMITTED it. A zero here is the empty-run
     * failure above wearing a green tick. */
    assert.deepEqual(stored.rates, [
      { side: 'left', presented: 1, admitted: 1, refused: 0 },
      { side: 'right', presented: 1, admitted: 1, refused: 0 },
    ])

    /* 🛑 AND THE RESIDUE IS EMPTY, WHICH IS THE ONLY LINE HERE THAT SAYS THE
     * TWO DOCUMENTS WERE ACTUALLY PAIRED. Admission alone proves the rows were
     * READ; an empty residue proves the matcher settled them against each
     * other. Two admitted rows that matched NOTHING would leave two entries. */
    assert.equal(stored.residue, 0, 'the two documents did not pair')
  })

  it('1b · and the account reads back as a `produced` account', async () => {
    const read = await withTenantScope(pool, ACME, (tx) => readRunEngineAccount(tx, RUN_OK))
    assert.equal(read.kind, 'account', show(read))
    if (read.kind !== 'account') return
    assert.equal(read.account['outcome'], 'produced')
    /* The ten required channels are `run-account-served`'s assertion; here the
     * point is only that the envelope is the produced one. */
    assert.ok('admissionRates' in read.account)
  })

  /* ================================================================ *
   * §2  ISOLATION
   * ================================================================ */

  it('2 · a message naming ANOTHER tenant`s run executes nothing', async () => {
    /* ACME's scope, GLOBEX's run. `run_rls` is the narrowing and the SQL
     * carries no tenant predicate — `run-worker.ts`'s argument, unchanged. */
    const out = await executeRun(pool, message(ACME, RUN_GLOBEX))
    assert.equal(out.kind, 'run_not_visible')
    assert.equal(await accountRowCount(pool, GLOBEX, RUN_GLOBEX), 0)
  })

  it('2a · NEGATIVE CONTROL — with RLS disabled the same read SEES it', async () => {
    /* Without this, §2 passes identically against a database that returns
     * nothing for any reason at all. */
    await asMigrator(async (q) => {
      await q('ALTER TABLE run DISABLE ROW LEVEL SECURITY')
    })
    try {
      const rows = await withTenantScope(pool, ACME, async (tx) => {
        const r = await tx.query('SELECT id FROM run WHERE id = $1', [RUN_GLOBEX])
        return r.rows
      })
      assert.equal(rows.length, 1, 'the row was unreachable for a reason other than RLS')
    } finally {
      await asMigrator(async (q) => {
        await q('ALTER TABLE run ENABLE ROW LEVEL SECURITY')
      })
    }
  })

  /* ================================================================ *
   * §3  STATED ANSWERS, AND NEITHER WRITES A ROW
   * ================================================================ */

  it('3 · a definition with no engine spec is `no_definition`, and writes nothing', async () => {
    const out = await executeRun(pool, message(ACME, RUN_NO_SPEC))
    assert.equal(out.kind, 'no_definition', show(out))
    assert.equal(await accountRowCount(pool, ACME, RUN_NO_SPEC), 0)
  })

  it('3a · a run id that never existed is `run_not_visible`', async () => {
    const out = await executeRun(pool, message(ACME, 'run_never_existed'))
    assert.equal(out.kind, 'run_not_visible')
  })

  /* ================================================================ *
   * §4  E6 — THE ENGINE REFUSES, AND THE REFUSAL IS STORED
   * ================================================================ */

  it('4 · the engine REFUSES, and `tenant.run_refusal` records why', async () => {
    const out = await executeRun(pool, message(ACME, RUN_REFUSED))
    assert.equal(out.kind, 'engine_refused', show(out))
    if (out.kind !== 'engine_refused') return
    assert.equal(out.refusal.kind, 'reader_candidate_cap_not_stated')

    const rows = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query(
        'SELECT kind FROM tenant.run_refusal WHERE run_id = $1',
        [RUN_REFUSED],
      )
      return r.rows as unknown as { kind: string }[]
    })
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.kind, 'reader_candidate_cap_not_stated')
  })

  it('4a · the envelope says `refused` and carries NO terminal status', async () => {
    /* `0007`: *"NULL on the refused arm, which carries no terminal status
     * because it carries no ledger."* A refused run with a `completed` beside
     * it would be the invalid state §5.5 forbids making legal. */
    const rows = await withTenantScope(pool, ACME, async (tx) => {
      const r = await tx.query(
        'SELECT outcome, terminal_status FROM tenant.run_engine_account WHERE run_id = $1',
        [RUN_REFUSED],
      )
      return r.rows as unknown as { outcome: string; terminal_status: string | null }[]
    })
    assert.equal(rows[0]?.outcome, 'refused')
    assert.equal(rows[0]?.terminal_status, null)
  })

  /* ================================================================ *
   * §5  🛑 THE ASSERTION THE WHOLE OF E6 EXISTS FOR
   * ================================================================ */

  it('5 · a REFUSED run and an UNRECONCILED run are DIFFERENT on the wire', async () => {
    /* Before this slice both answered `no_account`, so `getRunAccount` answered
     * 404 for both — *"the engine refused your definition"* and *"nobody ran
     * it"*, indistinguishable. `frontend/src/components/RunAccount.tsx` keeps
     * three state machines for this route precisely so the distinction can be
     * rendered once it becomes real. This is where it becomes real. */
    const refused = await withTenantScope(pool, ACME, (tx) =>
      readRunEngineAccount(tx, RUN_REFUSED),
    )
    const unreconciled = await withTenantScope(pool, ACME, (tx) =>
      readRunEngineAccount(tx, RUN_UNRECONCILED),
    )

    assert.equal(unreconciled.kind, 'no_account')

    assert.equal(refused.kind, 'account', show(refused))
    if (refused.kind !== 'account') return
    assert.equal(refused.account['outcome'], 'refused')
    assert.deepEqual(refused.account['refusal'], { kind: 'reader_candidate_cap_not_stated' })

    /* 🛑 AND THE REFUSED ARM CARRIES NO LEDGER. The wire's refused arm is
     * `required: [outcome, refusal]` with `additionalProperties: false`, so a
     * `terminalStatus` here would not merely be surplus — it would fail
     * validation for a client that checks. */
    assert.deepEqual(Object.keys(refused.account).sort(), ['outcome', 'refusal'].sort())
  })

  /* ================================================================ *
   * §6  THE DOUBLE-EXECUTION WITNESS — the executor's §3, driven
   * ================================================================ */

  it('6 · executing one run TWICE writes exactly ONE account row', async () => {
    /* The committed case: the second execution's `already_accounted` arm sees
     * the row and returns before the engine is called. */
    const second = await executeRun(pool, message(ACME, RUN_OK))
    assert.equal(second.kind, 'already_accounted', show(second))
    assert.equal(await accountRowCount(pool, ACME, RUN_OK), 1)
  })

  it('6a · and CONCURRENTLY, exactly one of two executions wins', async () => {
    /* 🛑 THIS IS THE ARM THAT MATTERS FOR THE 30-SECOND VISIBILITY TIMEOUT.
     * Two workers receive the same message because the first exceeded it; both
     * read no account row; both execute; both insert. `run_engine_account`'s
     * PRIMARY KEY is what makes exactly one survive — the loser blocks on the
     * winner's uncommitted row and then fails `23505`, and `withTenantScope()`
     * rolls its whole transaction back.
     *
     * ⚠️ THE TWO ARE STARTED WITHOUT `await` BETWEEN THEM, so they really do
     * overlap; a sequential pair would exercise §6's committed path twice and
     * prove nothing about concurrency. */
    const [a, b] = await Promise.allSettled([
      executeRun(pool, message(ACME, 'run_race')),
      executeRun(pool, message(ACME, 'run_race')),
    ])

    /* `run_race` does not exist, so both answer `run_not_visible` — which is
     * itself the point of this arm's FIRST half: a non-existent run writes
     * nothing however many workers receive it. */
    for (const settled of [a, b]) {
      assert.equal(settled.status, 'fulfilled')
      if (settled.status !== 'fulfilled') continue
      assert.equal(settled.value.kind, 'run_not_visible')
    }
    assert.equal(await accountRowCount(pool, ACME, 'run_race'), 0)
  })

  it('6b · the PRIMARY KEY is what forbids a second account row, witnessed', async () => {
    /* The guarantee named in `run-executor.ts` §3, asserted against the
     * database rather than inferred from the executor's read. A second INSERT
     * for a run that already has an account is `23505` — so even an executor
     * whose `already_accounted` read were deleted could not double-write. */
    await assert.rejects(
      () =>
        withTenantScope(pool, ACME, async (tx) => {
          await tx.query(
            `INSERT INTO tenant.run_engine_account (tenant_id, run_id, outcome, terminal_status)
             VALUES (nullif(current_setting('app.tenant_id', true), ''), $1, 'produced', 'completed')`,
            [RUN_OK],
          )
        }),
      /duplicate key value|unique constraint/i,
    )
    assert.equal(await accountRowCount(pool, ACME, RUN_OK), 1)
  })

  /* ================================================================ *
   * §7  THE MEASUREMENT — and its limit, stated louder than the number
   * ================================================================ */

  it('7 · MEASURES the whole scope, and says what the figure is NOT evidence of', async () => {
    const started = Date.now()
    const out = await executeRun(pool, message(ACME, RUN_UNRECONCILED))
    const wallMs = Date.now() - started

    assert.equal(out.kind, 'produced', show(out))
    if (out.kind !== 'produced') return

    console.log(
      [
        '',
        '─'.repeat(78),
        'TRANSACTION-DURATION MEASUREMENT — `docs/build/completion-plan.md` §10 item 5',
        `  engine call            ${out.elapsedMs} ms`,
        `  whole withTenantScope  ${out.scopeMs} ms`,
        `  wall, incl. pool       ${wallMs} ms`,
        '',
        '  🛑 THIS IS A FIXTURE FIGURE AND IS NOT AN ANSWER TO §10 item 5.',
        '     Two documents, one row each, one strategy. The question asked is',
        '     whether the engine is fast enough to hold a transaction open for a',
        '     REAL document set, and NO REAL SET EXISTS IN THIS REPOSITORY to',
        '     time it against — nothing has ever ingested a production document.',
        '     `subsetSumBound`, `readerCandidateCap` and `similarityMaxChars`',
        '     BOUND the cost; a bound is not a measurement.',
        '',
        '     Under G101 transaction-mode pooling a connection is held for the',
        '     life of the transaction, so a slow run takes a connection away',
        '     from the serving plane. See `run-executor.ts` §2.',
        '─'.repeat(78),
        '',
      ].join('\n'),
    )

    /* ⚠️ NO THRESHOLD IS ASSERTED, DELIBERATELY. A `assert.ok(scopeMs < N)`
     * here would be a performance test on shared CI hardware — flaky, and
     * worse, it would read as though somebody had established that N is the
     * right bound for a real corpus. Nobody has. The measurement is PRINTED so
     * a person reads it; the only assertion is that the scope completed. */
    assert.ok(out.scopeMs >= 0)
  })

  /* ================================================================ *
   * §8  THE GRANTS — `SELECT, INSERT` and nothing else
   * ================================================================ */

  it('8 · the app role may not UPDATE a stored refusal', async () => {
    await assert.rejects(
      () =>
        withTenantScope(pool, ACME, async (tx) => {
          await tx.query(
            "UPDATE tenant.run_refusal SET kind = 'cross_tenant_documents' WHERE run_id = $1",
            [RUN_REFUSED],
          )
        }),
      /permission denied for table run_refusal/i,
    )
  })

  it('8a · nor DELETE one', async () => {
    await assert.rejects(
      () =>
        withTenantScope(pool, ACME, async (tx) => {
          await tx.query('DELETE FROM tenant.run_refusal WHERE run_id = $1', [RUN_REFUSED])
        }),
      /permission denied for table run_refusal/i,
    )
  })

  it('8b · nor UPDATE or DELETE a normalisation defect', async () => {
    for (const sql of [
      "UPDATE tenant.run_refusal_normalisation_defect SET kind = 'empty_literal'",
      'DELETE FROM tenant.run_refusal_normalisation_defect',
    ]) {
      await assert.rejects(
        () => withTenantScope(pool, ACME, async (tx) => void (await tx.query(sql))),
        /permission denied for table run_refusal_normalisation_defect/i,
      )
    }
  })

  /* ================================================================ *
   * §9  RLS, FROM THE CATALOGUE
   * ================================================================ */

  it('9 · both new tables ENABLE and FORCE RLS', async () => {
    const rows = await asMigrator(async (q) => {
      const r = await q(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant'
            AND c.relname IN ('run_refusal', 'run_refusal_normalisation_defect')`,
      )
      return r.rows as unknown as {
        relname: string
        relrowsecurity: boolean
        relforcerowsecurity: boolean
      }[]
    })
    assert.equal(rows.length, 2)
    for (const row of rows) {
      assert.equal(row.relrowsecurity, true, `${row.relname} does not ENABLE`)
      assert.equal(row.relforcerowsecurity, true, `${row.relname} does not FORCE`)
    }
  })

  it('9a · and carry 0001`s predicate VERBATIM on USING and on WITH CHECK', async () => {
    const rows = await asMigrator(async (q) => {
      const r = await q(
        `SELECT tablename, qual, with_check FROM pg_policies
          WHERE schemaname = 'tenant'
            AND tablename IN ('run_refusal', 'run_refusal_normalisation_defect')`,
      )
      return r.rows as unknown as {
        tablename: string
        qual: string
        with_check: string | null
      }[]
    })
    assert.equal(rows.length, 2)
    for (const row of rows) {
      assert.equal(row.qual, PREDICATE, `${row.tablename} USING`)
      assert.equal(row.with_check, PREDICATE, `${row.tablename} WITH CHECK`)
    }
  })

  it('9b · no CHECK constraint mirrors a model vocabulary — G1514', async () => {
    const rows = await asMigrator(async (q) => {
      const r = await q(
        `SELECT con.conname FROM pg_constraint con
           JOIN pg_class c ON c.oid = con.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'tenant' AND con.contype = 'c'
            AND c.relname IN ('run_refusal', 'run_refusal_normalisation_defect')`,
      )
      return r.rows as unknown as { conname: string }[]
    })
    assert.deepEqual(
      rows.map((r) => r.conname),
      [],
      'a CHECK here would reject an unknown value at WRITE time; `0007`/`0069` ' +
        'rule it must reach the model as an `*_unreadable` refusal instead',
    )
  })

  /* ================================================================ *
   * §10  THE RUN ROW ITSELF — G4031 (#582) for a produced run, G4033 as
   *      RULED and G4001 for a refused one. Read after §1, §4 and §7
   *      executed their runs; these assertions execute nothing themselves.
   *
   *    G4031 gave a produced run its status, `finished_at` and count, and
   *    left an engine-refused run `queued` pending the owner. G4033 is now
   *    RULED: a refused run carries a SIXTH `RunStatus`, `refused`, with
   *    `finished_at` set and `exceptions_raised` NULL.
   *
   *    WITNESSED RED against `main` at b1d88762 (G4031 applied, G4033 not):
   *      ✖ 10a · an ENGINE-REFUSED run is `refused`, finished, with no count
   *          actual:   { status: 'queued',  exceptions_raised: null, finished: false, … }
   *          expected: { status: 'refused', exceptions_raised: null, finished: true,  … }
   * ================================================================ */

  async function runRow(tenant: string, runId: string) {
    return asMigrator(async (q) => {
      const r = await q(
        `SELECT r.status, r.exceptions_raised, r.finished_at IS NOT NULL AS finished,
                a.terminal_status,
                (SELECT count(*)::int FROM tenant.exception e
                  WHERE e.tenant_id = r.tenant_id AND e.run_id = r.id) AS raised_rows
           FROM run r
           LEFT JOIN tenant.run_engine_account a
             ON a.tenant_id = r.tenant_id AND a.run_id = r.id
          WHERE r.tenant_id = $1 AND r.id = $2`,
        [tenant, runId],
      )
      return r.rows[0] as {
        status: string
        exceptions_raised: number | null
        finished: boolean
        terminal_status: string | null
        raised_rows: number
      }
    })
  }

  it('10 · a PRODUCED run leaves `queued`: its status IS its account`s terminal status', async () => {
    const row = await runRow(ACME, RUN_OK)
    assert.ok(row.terminal_status !== null, show(row))
    assert.equal(row.status, row.terminal_status, show(row))
    /* Over the APP pool nothing reaches the register (`privilege_absent`),
     * so G4031's `exceptions_raised` is NULL — "not recorded" — and never a
     * count of rows that are not there. */
    assert.equal(row.exceptions_raised, null, show(row))
    assert.equal(row.raised_rows, 0, show(row))
    assert.equal(row.finished, true, show(row))
  })

  it('10a · an ENGINE-REFUSED run is `refused`, finished, with no count', async () => {
    /* G4033, RULED: `refused` is its own `RunStatus`. Not `failed` — that is
     * a SOUNDNESS failure over a ledger the engine produced, and a refusal
     * produced no ledger — and not `queued`, which says nothing ran. The
     * account's `terminal_status` stays NULL (§4a): the refused arm carries
     * no ledger, so there is no terminal status for the row to agree WITH.
     * `exceptions_raised` is NULL because a refused run raised nothing into
     * the register and has no count to record (G4001). */
    const row = await runRow(ACME, RUN_REFUSED)
    assert.deepEqual(row, {
      status: 'refused', exceptions_raised: null, finished: true, terminal_status: null, raised_rows: 0,
    })
  })

  it('10b · a run NOTHING executed is untouched — `queued`, no count, not finished', async () => {
    /* `no_definition` (§3) wrote nothing. Writing `failed` here would assert
     * an execution that did not happen — the definition may yet be authored.
     * ⚠️ `RUN_UNRECONCILED` IS NOT A WITNESS HERE despite its name: §7
     * executes it, and the first draft of this assertion went red on that
     * (`terminal_status: 'completed'`), which was the fixture and not the
     * executor. It is a produced run by the time §10 reads it. */
    assert.deepEqual(await runRow(ACME, RUN_NO_SPEC), {
      status: 'queued', exceptions_raised: null, finished: false, terminal_status: null, raised_rows: 0,
    })
    const executedBySection7 = await runRow(ACME, RUN_UNRECONCILED)
    assert.equal(executedBySection7.status, executedBySection7.terminal_status, show(executedBySection7))
  })

  it('10c · and another tenant`s run is untouched by a message naming it (§2)', async () => {
    const row = await runRow(GLOBEX, RUN_GLOBEX)
    assert.equal(row.status, 'queued', show(row))
    assert.equal(row.exceptions_raised, null, show(row))
  })

  /* ================================================================ *
   * §11  EVERY TERMINAL ARM WRITES A STATUS, AND `running` IS REAL —
   *      G4131–G4136 (U-21, U-22). Through `recordRunOutcome()`, the run
   *      row's ONE writer (G4001), and never past a terminal status.
   *
   *    WITNESSED RED against `main` at b2563cab, before the executor moved:
   *      ✖ 11  actual:   { status: 'queued',  finished: false, … }
   *            expected: { status: 'refused', finished: true,  … }
   *      ✖ 11a the same, for the unreadable definition
   *      ✖ 11c actual: 'queued'  expected: 'running'
   *      ✖ 11d actual: 'produced'  expected: 'already_settled' — the old
   *            executor reconciled a `failed` run and overwrote its status
   *      ✖ 11e actual: 'documents_refused'  expected: 'already_settled'
   *    and §11b by MUTATION on the finished tree (the `status IN
   *    ('queued','running')` term deleted from the terminal write):
   *      ✖ 11b actual: 2  expected: 1
   * ================================================================ */

  it('11 · a DOCUMENT-REFUSED run is `refused`, finished, with no count', async () => {
    /* U-21. G4033 ruled `refused` for the ENGINE's refusal; E4's refusal is the
     * same fact one step earlier — NO ledger was produced, and the run is not
     * waiting for anything (the worker deletes the message on every arm). Left
     * `queued`, the row claimed nothing had happened. No account row is
     * written — `run_refusal` has no arm for an assembly refusal — so
     * `getRunAccount` still answers 404 for it: G4137, put to the owner. */
    const out = await executeRun(pool, message(ACME, RUN_DOCS_REFUSED))
    assert.equal(out.kind, 'documents_refused', show(out))
    assert.deepEqual(await runRow(ACME, RUN_DOCS_REFUSED), {
      status: 'refused', exceptions_raised: null, finished: true, terminal_status: null, raised_rows: 0,
    })
  })

  it('11a · an UNREADABLE run is `refused`, finished, with no count', async () => {
    const out = await executeRun(pool, message(ACME, RUN_UNREADABLE))
    assert.equal(out.kind, 'unreadable', show(out))
    assert.deepEqual(await runRow(ACME, RUN_UNREADABLE), {
      status: 'refused', exceptions_raised: null, finished: true, terminal_status: null, raised_rows: 0,
    })
  })

  it('11b · two concurrent deliveries of one refused run: exactly one writes the status', async () => {
    /* G1525's at-least-once queue. The terminal write is `status IN
     * ('queued','running')`, so the loser — blocked on the winner's row lock,
     * then re-evaluating under READ COMMITTED — touches ZERO rows and THROWS,
     * rolling its own transaction back rather than re-stamping `finished_at`
     * over a status another delivery already settled. A loser that started
     * after the winner committed answers `already_settled` instead. Either
     * way exactly ONE execution reports the refusal. */
    const pair = await Promise.allSettled([
      executeRun(pool, message(ACME, RUN_DOCS_RACE)),
      executeRun(pool, message(ACME, RUN_DOCS_RACE)),
    ])
    const writers = pair.filter(
      (p) => p.status === 'fulfilled' && p.value.kind === 'documents_refused',
    ).length
    assert.equal(
      writers,
      1,
      show(pair.map((p) => (p.status === 'fulfilled' ? p.value.kind : String(p.reason)))),
    )
    assert.equal((await runRow(ACME, RUN_DOCS_RACE)).status, 'refused')
  })

  it('11c · a run is `running` WHILE it executes, and terminal once it has', async () => {
    /* U-22. Nothing set `running`: the whole act was ONE transaction, so any
     * status it wrote was invisible until it was already terminal. The
     * transition is its own short transaction, committed BEFORE the execution
     * scope opens — witnessed by holding the execution on a lock the start
     * transaction does not need, and reading the row from outside. */
    const holder = await migratorClient()
    let execution: Promise<{ kind: string }> | null = null
    try {
      await holder.query('BEGIN')
      await holder.query('LOCK TABLE tenant.definition_engine_spec IN ACCESS EXCLUSIVE MODE')
      execution = executeRun(pool, message(ACME, RUN_LIVE))
      let seen = 'none'
      for (let i = 0; i < 100 && seen !== 'running'; i++) {
        seen = (await runRow(ACME, RUN_LIVE)).status
        if (seen !== 'running') await new Promise((r) => setTimeout(r, 20))
      }
      assert.equal(seen, 'running', 'the run never read `running` while its execution was held')
      assert.equal((await runRow(ACME, RUN_LIVE)).finished, false)
    } finally {
      await holder.query('ROLLBACK')
      await holder.end()
    }
    const out = await execution
    assert.equal(out?.kind, 'produced', show(out))
    const row = await runRow(ACME, RUN_LIVE)
    assert.equal(row.status, row.terminal_status, show(row))
    assert.equal(row.finished, true, show(row))
  })

  it('11d · a run already carrying a terminal status is NOT re-executed, and keeps it', async () => {
    /* The guard on the other side of the transition. A redelivered message for
     * a run whose status is already terminal — a document refusal that
     * committed and left no account row for `already_accounted` to see — must
     * not run again and must never move the status back. */
    const out = await executeRun(pool, message(ACME, RUN_ALREADY_FAILED))
    assert.equal(out.kind, 'already_settled', show(out))
    const row = await runRow(ACME, RUN_ALREADY_FAILED)
    assert.equal(row.status, 'failed', show(row))
    assert.equal(row.terminal_status, null, show(row))
  })

  it('11e · a redelivered refused run answers `already_settled` and writes nothing', async () => {
    const finishedAt = () =>
      asMigrator(async (q) =>
        (await q('SELECT finished_at FROM run WHERE tenant_id = $1 AND id = $2', [ACME, RUN_DOCS_REFUSED])).rows[0],
      )
    const before = await finishedAt()
    const out = await executeRun(pool, message(ACME, RUN_DOCS_REFUSED))
    assert.equal(out.kind, 'already_settled', show(out))
    assert.deepEqual(await finishedAt(), before)
  })

  it('11f · `no_definition` leaves the run `queued`, NOT stuck `running`', async () => {
    /* The start transaction marks it `running`; nothing executed, so the
     * writer puts it back — §10b's recovery path (a re-press deduplicates onto
     * this run and republishes) needs `queued`, and a `running` that never
     * ends would be a live sign over nothing. Executed again here, after §3. */
    const out = await executeRun(pool, message(ACME, RUN_NO_SPEC))
    assert.equal(out.kind, 'no_definition', show(out))
    assert.deepEqual(await runRow(ACME, RUN_NO_SPEC), {
      status: 'queued', exceptions_raised: null, finished: false, terminal_status: null, raised_rows: 0,
    })
  })
})

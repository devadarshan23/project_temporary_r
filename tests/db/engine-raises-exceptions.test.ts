/**
 * THE ENGINE RAISES THE EXCEPTIONS A RUN PRODUCES — AND NOTHING THAT SERVES A
 * REQUEST CAN. `db/migrations/0500_engine_raises_exceptions.sql`,
 * `server/data-plane/exception-raise.ts`, `server/data-plane/run-executor.ts`.
 * G3741–G3750, 4 Oct 2026. Against a real PostgreSQL.
 *
 * 🛑 §1 IS THE CRUX AND IT IS READ FIRST. `0015` refused `INSERT` on
 *    `tenant.exception` to the request path: *"a request path that could INSERT
 *    an exception could mint a finding against itself."* The run worker shared
 *    that role (`createAppPool()`), so the grant goes to a SECOND role,
 *    `reconcile_engine`, that the request path neither holds nor can become.
 *
 * WITNESSED RED — each mutation run against this suite on 4 Oct 2026, its red
 * quoted as captured:
 *
 *   · `GRANT INSERT ON tenant.exception TO tenant_rw` (the shape every other
 *     write in `db/migrations/` takes) in place of `TO reconcile_engine`:
 *       ✖ 1 · a REQUEST-PATH transaction is REFUSED the INSERT `0015` refused it
 *         AssertionError [ERR_ASSERTION]: Missing expected rejection.
 *     ⚠️ AND THE FIRST DRAFT OF §1 DID NOT GO RED UNDER THAT MUTATION: its
 *     forged row named a run with no account, so `0500` §2's policy refused it
 *     (`new row violates row-level security policy
 *     "exception_raised_by_engine_restrictive"`) and §1 passed on the WRONG
 *     control. §1 now forges against `run_pre_accounted`, a row the policy
 *     admits in every term, so the privilege is the only thing tested.
 *   · `GRANT reconcile_engine TO reconcile_app` — the membership that would let
 *     a request transaction `SET ROLE` into the privilege — cannot be made
 *     while `createRoles()` has granted the reverse: PostgreSQL refuses the
 *     cycle, `ERROR: role "reconcile_engine" is a member of role
 *     "reconcile_app"`. `createRoles()` also REVOKEs it on every run, because a
 *     role outlives `resetSchema()`. §1b is the request-side witness.
 *   · the executor's account write moved AFTER the exception write:
 *       ✖ 2 · executed as the ENGINE, a run raises its declared exception …
 *         error: new row violates row-level security policy
 *         "exception_raised_by_engine_restrictive" for table "exception"
 *   · the restrictive policy dropped — §6 is that negative control, run on
 *     every pass rather than once.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import {
  createAppPool,
  createEnginePool,
  withTenantScope,
  type TenantPool,
} from '../../db/tenant-scope.ts'
import { parseFieldPath, fieldPathKey } from '../../model/field-path.ts'
import type { FieldPath, TenantId } from '../../model/domain.ts'
import type { RunId } from '../../model/kernel.ts'
import { RUN_QUEUE_MESSAGE_KIND, type RunAdmittedMessage } from '../../server/data-plane/run-queue.ts'
import { executeRun } from '../../server/data-plane/run-executor.ts'
import { readException } from '../../server/data-plane/exception-store.ts'

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DEF_A = 'def_raises'
const DEF_ND = 'def_no_domain'
const DEF_BAD = 'def_bad_rule'

const DT_INVOICE = 'dt_invoice'
const DT_STATEMENT = 'dt_statement'
const CHANNEL = 'chan_api'

const RULE_LABEL = 'A ledger invoice with no bank line'

/* Its OWN database, scoped to this run (G4152). This suite used `db/env.ts`'s
 * default `reconcile_test` — a name it SHARED with the other suite that never
 * named one, and with every other gate on the same cluster. */
process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_ENGINE_RAISES_DB_NAME'] ?? runScopedName('reconcile_engine_raises_test')

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/db/engine-raises-exceptions.test.ts DID NOT RUN.',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      '   A run in which it skipped is NOT evidence that the request path is',
      '   refused the INSERT `0015` refused it, nor that the engine raises.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}
databaseRequiredUnderCi('the engine-raises-exceptions assertions', probe)

type Q = (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>

async function asMigrator<T>(fn: (q: Q) => Promise<T>): Promise<T> {
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
function show(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))
}

const AMOUNT_L = path(['total'])
const DATE_L = path(['issued'])
const REF_L = path(['ref'])
const AMOUNT_R = path(['amount'])
const DATE_R = path(['date'])
const REF_R = path(['ref'])

/* Two documents that CANNOT pair: `INV-1` against `INV-2` under an
 * exact-identifier strategy, so each side leaves one residue entry. */
const DOCS = [
  {
    id: 'sd_invoice',
    typeId: DT_INVOICE,
    payload: {
      total: { currency: 'SGD', amountMinor: '123456', exponent: 2 },
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
      ref: 'INV-2',
    },
  },
] as const

async function seedDefinition(q: Q, tenant: string, definition: string, domain: string | null): Promise<void> {
  await q(
    `INSERT INTO tenant.reconciliation_definition (tenant_id, id, version, status, domain)
     VALUES ($1, $2, 3, 'active', $3)`,
    [tenant, definition, domain],
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
             'money', 'SGD', 0, 2, 'days', 0, 4, 10000, 200, 25, 128, 'jaro_winkler', 5000)`,
    [tenant, definition],
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
     VALUES ($1, $2, 'left', 0, $3::jsonb, $4), ($1, $2, 'right', 0, $5::jsonb, $6)`,
    [tenant, definition, w(REF_L), fieldPathKey(REF_L), w(REF_R), fieldPathKey(REF_R)],
  )
  await q(
    `INSERT INTO tenant.definition_normalisation_op
       (tenant_id, definition_id, side, ordinal, op_kind, op_literal, op_at, op_separator, op_index)
     VALUES ($1, $2, 'left', 0, 'trim', NULL, NULL, NULL, NULL),
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
  if (tenant !== ACME) return
  for (const d of DOCS) {
    const slot = d.typeId === DT_INVOICE ? 'ledger' : 'bank'
    await q(
      `INSERT INTO tenant.definition_slot (tenant_id, definition_id, slot, cardinality)
       VALUES ($1, $2, $3, 'exactly_one')`,
      [tenant, definition, slot],
    )
    await q(
      `INSERT INTO tenant.document_slot_binding
         (tenant_id, definition_id, slot, period_id, source_document_id)
       VALUES ($1, $2, $3, NULL, $4)`,
      [tenant, definition, slot, d.id],
    )
  }
}

async function declareRule(q: Q, definition: string, severity: string): Promise<void> {
  /* ONE declaration, for the LEFT side's unpaired entry. The right side's entry
   * has no declaration and must be WITHHELD, not raised under a guessed rule. */
  await q(
    `INSERT INTO tenant.definition_exception_rule
       (tenant_id, definition_id, side, cause_kind, rule_id, rule_version, rule_label, severity)
     VALUES ($1, $2, 'left', 'no_strategy_paired', 'rul_unpaired_invoice', 2, $3, $4)`,
    [ACME, definition, RULE_LABEL, severity],
  )
}

/** G4031 — the run row's own terminal facts, read back as the migrator. */
async function runFacts(runId: string): Promise<{ status: string; finished: boolean; raised: number | null }> {
  return asMigrator(async (q) => {
    const r = (await q(
      'SELECT status, finished_at IS NOT NULL AS finished, exceptions_raised AS raised FROM run WHERE id = $1',
      [runId],
    )).rows as { status: string; finished: boolean; raised: number | null }[]
    const row = r[0]
    if (row === undefined) throw new Error(`fixture run ${runId} is missing`)
    return row
  })
}

async function addRun(q: Q, tenant: string, runId: string, definition: string): Promise<void> {
  await q(
    `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,
                      trigger_kind, status, started_at)
     VALUES ($1, $2, $3, 3, NULL, 'manual', 'queued', now())`,
    [tenant, runId, definition],
  )
}

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    await q(
      `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
       VALUES ($1, $2, 'api', NULL, true)`,
      [ACME, CHANNEL],
    )
    for (const typeId of [DT_INVOICE, DT_STATEMENT]) {
      await q(
        `INSERT INTO tenant.document_type
           (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
         VALUES ($1, $2, $2, $2, 'finance', 'structured', 'never')`,
        [ACME, typeId],
      )
    }
    const specs: readonly [string, FieldPath, string][] = [
      [DT_INVOICE, AMOUNT_L, 'money'], [DT_INVOICE, DATE_L, 'date'], [DT_INVOICE, REF_L, 'identifier'],
      [DT_STATEMENT, AMOUNT_R, 'money'], [DT_STATEMENT, DATE_R, 'date'], [DT_STATEMENT, REF_R, 'identifier'],
    ]
    for (const [typeId, p, dataType] of specs) {
      await q(
        `INSERT INTO tenant.document_field_spec
           (tenant_id, document_type_id, path_key, path, data_class, data_type,
            model_processing_allowed, confidence_floor)
         VALUES ($1, $2, $3, $4::jsonb, 'internal', $5, false, NULL)`,
        [ACME, typeId, fieldPathKey(p), w(p), dataType],
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

    await seedDefinition(q, ACME, DEF_A, 'finance')
    await declareRule(q, DEF_A, 'high')
    await seedDefinition(q, ACME, DEF_ND, null)
    await declareRule(q, DEF_ND, 'high')
    await seedDefinition(q, ACME, DEF_BAD, 'finance')
    /* An UNKNOWN severity — no CHECK refuses it at write time (`0500`'s foot);
     * the READER must, before the engine runs. */
    await declareRule(q, DEF_BAD, 'urgent')
    await seedDefinition(q, GLOBEX, DEF_A, 'finance')

    for (const [runId, definition] of [
      ['run_engine', DEF_A],
      ['run_app', DEF_A],
      ['run_race', DEF_A],
      ['run_no_account', DEF_A],
      ['run_no_domain', DEF_ND],
      ['run_bad_rule', DEF_BAD],
      ['run_pre_accounted', DEF_A],
    ] as const) {
      await addRun(q, ACME, runId, definition)
    }
    /* A run that ALREADY HAS AN ACCOUNT, so §1's forged row satisfies `0500`
     * §2's restrictive policy in every term and the PRIVILEGE is the only
     * thing left to refuse it. Without this, §1 would pass on the policy alone
     * against a widened grant — measured: it did, and the red quoted in the
     * header is from AFTER this fixture landed. */
    await q(
      `INSERT INTO tenant.run_engine_account (tenant_id, run_id, outcome, terminal_status)
       VALUES ($1, 'run_pre_accounted', 'produced', 'completed')`,
      [ACME],
    )
    await addRun(q, GLOBEX, 'run_globex', DEF_A)
  })
}

function message(tenantId: string, runId: string): RunAdmittedMessage {
  return { kind: RUN_QUEUE_MESSAGE_KIND, tenantId: tenantId as TenantId, runId: runId as RunId }
}

async function count(pool: TenantPool, sql: string, params: readonly unknown[]): Promise<number> {
  const rows = await withTenantScope(pool, ACME, async (tx) => (await tx.query(sql, params)).rows)
  return (rows[0] as { n: number } | undefined)?.n ?? 0
}

const EXC_COUNT = 'SELECT count(*)::int AS n FROM tenant.exception WHERE run_id = $1'

/** A minimal valid exception row for `runId`, as the engine would write it. */
function rawInsert(id: string, runId: string, summary: string | null, status = 'open'): readonly [string, unknown[]] {
  return [
    `INSERT INTO tenant.exception (
       tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
       domain, definition_id, rule_label, severity, severity_rank,
       status, raised_at, explanation_summary, explanation_expected, run_id)
     VALUES (current_setting('app.tenant_id'), $1, 'mg_x', 'rul_x', 1, 3,
             'finance', $2, 'label', 'critical', 0, $5, now(), $3, 'label', $4)`,
    [id, DEF_A, summary, runId, status],
  ]
}

describe('the engine raises exceptions, and the request path cannot', { skip }, () => {
  let app: TenantPool
  let engine: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    app = await createAppPool(4)
    engine = await createEnginePool(4)
  })

  after(async () => {
    await app.end()
    await engine.end()
  })

  /* ================================================================ *
   * §1  THE PRIVILEGE — the request path is REFUSED, by the database
   * ================================================================ */

  it('1 · a REQUEST-PATH transaction is REFUSED the INSERT `0015` refused it', async () => {
    /* 🛑 THE ROW IS ONE `0500` §2's POLICY ADMITS — open, unassigned, no
     * prose, a run with an account. So only the GRANT stands between a handler
     * and a self-minted finding, which is exactly the property under test. */
    const [sql, params] = rawInsert('exc_forged', 'run_pre_accounted', null)
    await assert.rejects(
      () => withTenantScope(app, ACME, (tx) => tx.query(sql, params)),
      /permission denied for table exception/,
    )
    await assert.rejects(
      () =>
        withTenantScope(app, ACME, (tx) =>
          tx.query(
            `INSERT INTO tenant.exception_observed_value
               (tenant_id, exception_id, ordinal, slot, path, source_document_id, scalar_kind, data_class)
             VALUES (current_setting('app.tenant_id'), 'exc_x', 0, 's', '[]', 'sd', 'text', 'internal')`,
          ),
        ),
      /permission denied for table exception_observed_value/,
    )
  })

  it('1a · the catalogue agrees: `reconcile_app` holds no INSERT, `reconcile_engine` does', async () => {
    const row = await asMigrator(async (q) => {
      const r = await q(`
        SELECT has_table_privilege('reconcile_app', 'tenant.exception', 'INSERT')    AS app_exc,
               has_table_privilege('reconcile_app', 'tenant.exception_observed_value', 'INSERT') AS app_obs,
               has_table_privilege('reconcile_engine', 'tenant.exception', 'INSERT') AS eng_exc,
               pg_has_role('reconcile_app', 'reconcile_engine', 'MEMBER')            AS app_is_engine,
               (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'reconcile_engine') AS eng_bypass`)
      return r.rows[0] as Record<string, boolean>
    })
    assert.deepEqual(row, {
      app_exc: false,
      app_obs: false,
      eng_exc: true,
      app_is_engine: false,
      eng_bypass: false,
    })
  })

  it('1b · the request path cannot SET ROLE into the engine', async () => {
    await assert.rejects(
      () => withTenantScope(app, ACME, (tx) => tx.query('SET LOCAL ROLE reconcile_engine')),
      /permission denied to set role/,
    )
  })

  it('1c · and the engine role is still bound by row level security — it sees one tenant', async () => {
    const seen = await withTenantScope(engine, ACME, async (tx) =>
      (await tx.query("SELECT id FROM run WHERE id = 'run_globex'")).rows,
    )
    assert.equal(seen.length, 0, 'reconcile_engine must not read another tenant`s run')
  })

  /* ================================================================ *
   * §2  THE ALLOW ARM — the engine raises, typed facts only
   * ================================================================ */

  it('2 · executed as the ENGINE, a run raises its declared exception in the same transaction', async () => {
    const out = await executeRun(engine, message(ACME, 'run_engine'))
    assert.equal(out.kind, 'produced', show(out))
    if (out.kind !== 'produced') return
    assert.deepEqual(out.exceptions, { kind: 'raised', raised: 1, withheld: 1 })
    assert.equal(await count(engine, EXC_COUNT, ['run_engine']), 1)
  })

  it('2a · the row is TYPED FACTS ONLY — no summary, the rule label as `expected`', async () => {
    const rows = await withTenantScope(engine, ACME, async (tx) =>
      (
        await tx.query(
          `SELECT id, run_id, rule_id, rule_version, rule_label, severity, severity_rank,
                  domain, definition_id, definition_version, status, assigned_to,
                  explanation_summary, explanation_expected, explanation_confidence,
                  value_at_risk_currency, value_at_risk_minor::text AS var_minor,
                  value_at_risk_exponent, delta_kind, delta_money_currency,
                  delta_money_minor::text AS delta_minor, delta_money_exponent,
                  delta_money_direction, resolution_mode
             FROM tenant.exception WHERE run_id = 'run_engine'`,
        )
      ).rows,
    )
    assert.deepEqual(rows, [
      {
        id: 'exc_run_engine_r0000',
        run_id: 'run_engine',
        rule_id: 'rul_unpaired_invoice',
        rule_version: 2,
        rule_label: RULE_LABEL,
        severity: 'high',
        severity_rank: 1,
        domain: 'finance',
        definition_id: DEF_A,
        definition_version: 3,
        status: 'open',
        assigned_to: null,
        explanation_summary: null,
        explanation_expected: RULE_LABEL,
        explanation_confidence: null,
        /* The engine's own SETTLEMENT RESIDUAL — the invoice's full amount,
         * because nothing paired it. Never a fabricated zero. */
        value_at_risk_currency: 'SGD',
        var_minor: '123456',
        value_at_risk_exponent: 2,
        /* G3803/G3804 — THE OWNER'S C3-02 RULING: *"the engine records direction
         * (over/under)"*. An unpaired LEFT item differs from its (absent)
         * counterpart by all of its open residual, and the left side exceeding
         * the right is `over`. ⚠️ THIS ROW SAID `delta_kind: null` UNTIL 4 Oct
         * 2026 — the money delta was written for a declined pair only, and
         * unsigned. */
        delta_kind: 'money',
        delta_money_currency: 'SGD',
        delta_minor: '123456',
        delta_money_exponent: 2,
        delta_money_direction: 'over',
        resolution_mode: null,
      },
    ])
  })

  it('2b · its observed values are the positions the engine read, as extracted', async () => {
    const rows = await withTenantScope(engine, ACME, async (tx) =>
      (
        await tx.query(
          `SELECT ordinal, slot, path, source_document_id, scalar_kind, scalar_text,
                  scalar_money_currency, scalar_money_minor::text AS m, data_class
             FROM tenant.exception_observed_value
            WHERE exception_id = 'exc_run_engine_r0000' ORDER BY ordinal`,
        )
      ).rows,
    )
    assert.deepEqual(rows, [
      {
        ordinal: 0, slot: 'ledger', path: ['total'], source_document_id: 'sd_invoice',
        scalar_kind: 'money', scalar_text: null, scalar_money_currency: 'SGD', m: '123456',
        data_class: 'internal',
      },
      {
        ordinal: 1, slot: 'ledger', path: ['ref'], source_document_id: 'sd_invoice',
        scalar_kind: 'identifier', scalar_text: 'INV-1', scalar_money_currency: null, m: null,
        data_class: 'internal',
      },
    ])
  })

  it('2c · and it PUBLISHES — `summary: null`, never a default string (G3748)', async () => {
    const read = await withTenantScope(app, ACME, (tx) => readException(tx, 'exc_run_engine_r0000'))
    assert.equal(read.kind, 'exception', show(read))
    if (read.kind !== 'exception') return
    const explanation = read.exception['explanation'] as Record<string, unknown>
    assert.equal(explanation['summary'], null)
    assert.equal(explanation['expected'], RULE_LABEL)
    assert.equal(read.exception['runId'], 'run_engine')
  })

  it('2d · G4031 — the RUN ROW records what the execution produced: terminal status, finish, the count raised', async () => {
    /* G3750 named these as unfilled: `public.run.status` stayed `queued` and
       `exceptions_raised` NULL after the engine had reconciled the run and
       raised its exceptions. Both now have a producer in the same transaction:
       `terminalRunStatus()` (the model's own join) and the raiser's count. */
    assert.deepEqual(await runFacts('run_engine'), { status: 'completed', finished: true, raised: 1 })
  })

  /* ================================================================ *
   * §3  NOT PERSISTED, BY NAME — and the account is written either way
   * ================================================================ */

  it('3 · executed over the APP pool, the account is written and the exceptions are NOT', async () => {
    const out = await executeRun(app, message(ACME, 'run_app'))
    assert.equal(out.kind, 'produced', show(out))
    if (out.kind !== 'produced') return
    assert.deepEqual(out.exceptions, {
      kind: 'not_persisted', reason: 'privilege_absent', wouldRaise: 1, withheld: 1,
    })
    assert.equal(await count(app, EXC_COUNT, ['run_app']), 0)
    assert.equal(
      await count(app, 'SELECT count(*)::int AS n FROM tenant.run_engine_account WHERE run_id = $1', ['run_app']),
      1,
    )
  })

  it('3a · a definition that declares no domain raises nothing, and says why', async () => {
    const out = await executeRun(engine, message(ACME, 'run_no_domain'))
    assert.equal(out.kind, 'produced', show(out))
    if (out.kind !== 'produced') return
    assert.deepEqual(out.exceptions, {
      kind: 'not_persisted', reason: 'domain_not_declared', wouldRaise: 1, withheld: 1,
    })
    assert.equal(await count(engine, EXC_COUNT, ['run_no_domain']), 0)
  })

  it('3c · G4031 — NOT PERSISTED leaves `exceptions_raised` NULL, never a count of rows that are not there', async () => {
    /* The status is the engine's and is recorded either way; the count is a
       fact about the REGISTER, and nothing reached it. A `0` would say the run
       raised nothing, which is false — it would have raised one. */
    for (const runId of ['run_app', 'run_no_domain']) {
      assert.deepEqual(await runFacts(runId), { status: 'completed', finished: true, raised: null }, runId)
    }
  })

  it('3b · an UNREADABLE declaration refuses the run before the engine — nothing written', async () => {
    const out = await executeRun(engine, message(ACME, 'run_bad_rule'))
    assert.deepEqual(out, {
      kind: 'unreadable', runId: 'run_bad_rule', table: 'definition_exception_rule', column: 'severity',
    })
    assert.equal(
      await count(engine, 'SELECT count(*)::int AS n FROM tenant.run_engine_account WHERE run_id = $1', ['run_bad_rule']),
      0,
    )
    /* G4031 left this run `queued` ("nothing executed, so the run row is
     * untouched"); G4131 (U-21) settles it: an unreadable definition produced
     * no ledger and the worker deletes the message, so it reads `refused`,
     * finished, with no count — the engine refusal's shape (G4033). */
    assert.deepEqual(await runFacts('run_bad_rule'), { status: 'refused', finished: true, raised: null })
  })

  /* ================================================================ *
   * §4  IDEMPOTENCY — a redelivered message raises nothing twice (G1525)
   * ================================================================ */

  it('4 · a REDELIVERED message is `already_accounted` and raises nothing', async () => {
    const again = await executeRun(engine, message(ACME, 'run_engine'))
    assert.equal(again.kind, 'already_accounted', show(again))
    assert.equal(await count(engine, EXC_COUNT, ['run_engine']), 1)
  })

  it('4a · two CONCURRENT deliveries leave exactly one set of exceptions', async () => {
    const settled = await Promise.allSettled([
      executeRun(engine, message(ACME, 'run_race')),
      executeRun(engine, message(ACME, 'run_race')),
    ])
    const produced = settled.filter((s) => s.status === 'fulfilled' && s.value.kind === 'produced')
    assert.equal(produced.length, 1, show(settled))
    /* The loser either saw the committed account (`already_accounted`) or
     * collided on `run_engine_account`'s primary key and rolled back WHOLE —
     * its exceptions with it. */
    for (const s of settled) {
      if (s.status === 'rejected') assert.match(String(s.reason), /duplicate key/)
      else assert.ok(['produced', 'already_accounted'].includes(s.value.kind))
    }
    assert.equal(await count(engine, EXC_COUNT, ['run_race']), 1)
  })

  it('4b · and the exception`s OWN primary key is a second, independent guard', async () => {
    const [sql, params] = rawInsert('exc_run_engine_r0000', 'run_engine', null)
    await assert.rejects(
      () => withTenantScope(engine, ACME, (tx) => tx.query(sql, params)),
      /duplicate key value/,
    )
  })

  /* ================================================================ *
   * §5  THE RESTRICTIVE POLICY — what an engine-raised row may BE
   * ================================================================ */

  it('5 · an exception for a run with NO ACCOUNT is refused', async () => {
    const [sql, params] = rawInsert('exc_orphan', 'run_no_account', null)
    await assert.rejects(
      () => withTenantScope(engine, ACME, (tx) => tx.query(sql, params)),
      /row-level security policy "exception_raised_by_engine_restrictive"/,
    )
  })

  it('5a · an exception carrying AUTHORED PROSE is refused — R-D, in SQL', async () => {
    const [sql, params] = rawInsert('exc_prose', 'run_engine', 'the invoice disagrees')
    await assert.rejects(
      () => withTenantScope(engine, ACME, (tx) => tx.query(sql, params)),
      /exception_raised_by_engine_restrictive/,
    )
  })

  it('5b · an exception arriving already RESOLVED is refused', async () => {
    const [sql, params] = rawInsert('exc_resolved', 'run_engine', null, 'resolved')
    await assert.rejects(
      () => withTenantScope(engine, ACME, (tx) => tx.query(sql, params)),
      /exception_raised_by_engine_restrictive/,
    )
  })

  it('5c · an exception naming NO RUN is refused', async () => {
    const [sql] = rawInsert('exc_runless', 'unused', null)
    await assert.rejects(
      () =>
        withTenantScope(engine, ACME, (tx) =>
          tx.query(sql.replace('$4)', 'NULL)').replace('$5', '$4'), ['exc_runless', DEF_A, null, 'open']),
        ),
      /exception_raised_by_engine_restrictive/,
    )
  })

  it('5d · G3806 — an engine row carrying an UNSIGNED non-zero money delta is refused (`0510`)', async () => {
    const [sql, params] = rawInsert('exc_unsigned', 'run_engine', null)
    const unsigned = sql
      .replace('explanation_expected, run_id)', 'explanation_expected, run_id, delta_kind, delta_money_currency, delta_money_minor, delta_money_exponent)')
      .replace("'label', $4)", "'label', $4, 'money', 'SGD', 41235, 2)")
    await assert.rejects(
      () => withTenantScope(engine, ACME, (tx) => tx.query(unsigned, params)),
      /exception_money_delta_signed_restrictive/,
    )
    /* The control arm: the SAME row with its direction commits — so the refusal
     * above is about the missing sign and not about the row. */
    const signed = unsigned
      .replace('delta_money_exponent)', 'delta_money_exponent, delta_money_direction)')
      .replace("41235, 2)", "41235, 2, 'under')")
      .replace("'exc_unsigned'", "'exc_unsigned'")
    await withTenantScope(engine, ACME, (tx) => tx.query(signed, ['exc_signed', ...params.slice(1)]))
    assert.equal(await count(engine, "SELECT count(*)::int AS n FROM tenant.exception WHERE id = $1", ['exc_signed']), 1)
    await asMigrator((q) => q("DELETE FROM tenant.exception WHERE id = 'exc_signed'"))
  })

  /* ================================================================ *
   * §6  NEGATIVE CONTROL — with the policy dropped, §5's row COMMITS
   * ================================================================ */

  it('6 · NEGATIVE CONTROL — drop the restrictive policy and the orphan row commits', async () => {
    /* Without this, §5 passes identically against a database that refuses the
     * row for any reason at all. */
    await asMigrator((q) => q('DROP POLICY exception_raised_by_engine_restrictive ON tenant.exception'))
    try {
      const [sql, params] = rawInsert('exc_orphan_control', 'run_no_account', null)
      await withTenantScope(engine, ACME, (tx) => tx.query(sql, params))
      assert.equal(await count(engine, EXC_COUNT, ['run_no_account']), 1)
    } finally {
      await asMigrator(async (q) => {
        await q("DELETE FROM tenant.exception WHERE id = 'exc_orphan_control'")
        await q(`CREATE POLICY exception_raised_by_engine_restrictive ON tenant.exception
                   AS RESTRICTIVE FOR INSERT
                   WITH CHECK (run_id IS NOT NULL AND explanation_summary IS NULL
                     AND status = 'open' AND assigned_to IS NULL AND resolution_mode IS NULL
                     AND EXISTS (SELECT 1 FROM tenant.run_engine_account a
                                  WHERE a.tenant_id = exception.tenant_id
                                    AND a.run_id = exception.run_id))`)
      })
    }
  })

  it('6a · the declaration table ENABLEs and FORCEs RLS, and the app role may only read it', async () => {
    const row = await asMigrator(async (q) => {
      const r = await q(`
        SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
               has_table_privilege('reconcile_app', 'tenant.definition_exception_rule', 'SELECT') AS app_select,
               has_table_privilege('reconcile_app', 'tenant.definition_exception_rule', 'INSERT') AS app_insert,
               has_table_privilege('reconcile_engine', 'tenant.definition_exception_rule', 'INSERT') AS eng_insert
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'tenant' AND c.relname = 'definition_exception_rule'`)
      return r.rows[0] as Record<string, boolean>
    })
    assert.deepEqual(row, {
      enabled: true, forced: true, app_select: true, app_insert: false, eng_insert: false,
    })
  })

  /* ================================================================ *
   * §7  THE PRIVILEGE BEHIND G4031's `UPDATE run` — G4002
   * ================================================================ */

  it('7c · the engine reaches the run columns by MEMBERSHIP of `reconcile_app`, not by a grant of its own', async () => {
    /* 🛑 G4002 — NO MIGRATION, AND THIS IS WHY. `0002` grants `reconcile_app`
     * `SELECT, INSERT, UPDATE, DELETE ON run` and `createRoles()` makes the
     * engine a member of `reconcile_app`, so the engine already holds UPDATE
     * on every column of `run`. A column-level grant to the engine would be a
     * second spelling of a privilege it holds — and would NOT narrow anything
     * while the membership stands.
     * ⚠️ THE SERVING ROLE CAN DO THIS TOO, and that is `0002`'s grant, named
     * rather than endorsed: `0069` reported `UPDATE`/`DELETE` on `run` as
     * privileges ahead of their writers and declined to REVOKE them. The
     * executor is now the first `UPDATE run` in `server/` (G4031).
     * Pinned in BOTH roles so a commit that narrows either one meets an
     * assertion on purpose rather than discovering what it spent. */
    const row = await asMigrator(async (q) => {
      const r = await q(`
        SELECT has_column_privilege('reconcile_engine', 'public.run', 'status', 'UPDATE')            AS eng_status,
               has_column_privilege('reconcile_engine', 'public.run', 'exceptions_raised', 'UPDATE') AS eng_raised,
               has_column_privilege('reconcile_engine', 'public.run', 'finished_at', 'UPDATE')       AS eng_finished,
               (EXISTS (SELECT 1 FROM pg_attribute
                         WHERE attrelid = 'public.run'::regclass
                           AND attacl::text LIKE '%reconcile_engine=%')
                OR (SELECT coalesce(relacl::text, '') LIKE '%reconcile_engine=%'
                      FROM pg_class WHERE oid = 'public.run'::regclass))                             AS eng_own_grant,
               pg_has_role('reconcile_engine', 'reconcile_app', 'USAGE')                              AS eng_inherits_app,
               has_table_privilege('reconcile_app', 'public.run', 'UPDATE')                           AS app_update`)
      return r.rows[0] as Record<string, boolean>
    })
    assert.deepEqual(row, {
      eng_status: true, eng_raised: true, eng_finished: true,
      eng_own_grant: false, eng_inherits_app: true, app_update: true,
    })
  })
})

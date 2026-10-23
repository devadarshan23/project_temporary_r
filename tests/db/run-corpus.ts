/**
 * A SYNTHETIC RECONCILIATION CORPUS — ONE DEFINITION, N DOCUMENT PAIRS.
 * 5 Oct 2026, G4366 and G4368.
 *
 * Shared by `tests/db/run-execution-bounded.test.ts` (P1, the bounded run) and
 * `tools/run-measure.mjs` (P2, G1524's measurement). It is the shape
 * `tests/db/run-executor.test.ts` seeds by hand — two document types, three
 * declared positions each, one `exact_identifier` strategy — parameterised on
 * the ONE number a measurement needs: how many documents.
 *
 * ⚠️ A DOCUMENT IS ONE ROW. `server/data-plane/document-assembly.ts` is
 * header-grain and REFUSES an indexed declaration (G1504), so `lines` is
 * always empty and a corpus of N pairs is N presented items per side. A
 * line-grain corpus cannot be reached through the database path at all today;
 * the harness says so rather than inventing one.
 *
 * ⚠️ IT WRITES AS THE MIGRATOR, because nothing on a request path may write a
 * definition, a binding or a document (`0160`, `0150`, `0012` — each `SELECT`
 * to the app role). That is `run-executor.test.ts`'s own precedent.
 */

import { parseFieldPath, fieldPathKey } from '../../model/field-path.ts'
import type { FieldPath } from '../../model/domain.ts'

export type Q = (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>

const DT_INVOICE = 'dt_invoice'
const DT_STATEMENT = 'dt_statement'
const CHANNEL = 'chan_api'

function path(wire: readonly (string | number)[]): FieldPath {
  const r = parseFieldPath(wire)
  if (!r.ok) throw new Error(`fixture path ${JSON.stringify(wire)} did not parse`)
  return r.path
}

function w(p: FieldPath): string {
  return JSON.stringify(p.map((s) => (s.kind === 'index' ? s.index : s.key)))
}

const AMOUNT_L = path(['total'])
const DATE_L = path(['issued'])
const REF_L = path(['ref'])
const AMOUNT_R = path(['amount'])
const DATE_R = path(['date'])
const REF_R = path(['ref'])

/** The tenant-wide reference rows: one channel, two types, six field specs. */
export async function seedCorpusReference(q: Q, tenant: string): Promise<void> {
  await q(
    `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
     VALUES ($1, $2, 'api', NULL, true) ON CONFLICT DO NOTHING`,
    [tenant, CHANNEL],
  )
  for (const typeId of [DT_INVOICE, DT_STATEMENT]) {
    await q(
      `INSERT INTO tenant.document_type
         (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
       VALUES ($1, $2, $2, $2, 'finance', 'structured', 'never')`,
      [tenant, typeId],
    )
  }
  const specs: readonly (readonly [string, FieldPath, string])[] = [
    [DT_INVOICE, AMOUNT_L, 'money'],
    [DT_INVOICE, DATE_L, 'date'],
    [DT_INVOICE, REF_L, 'identifier'],
    [DT_STATEMENT, AMOUNT_R, 'money'],
    [DT_STATEMENT, DATE_R, 'date'],
    [DT_STATEMENT, REF_R, 'identifier'],
  ]
  for (const [typeId, p, dataType] of specs) {
    await q(
      `INSERT INTO tenant.document_field_spec
         (tenant_id, document_type_id, path_key, path, data_class, data_type,
          model_processing_allowed, confidence_floor)
       VALUES ($1, $2, $3, $4::jsonb, 'internal', $5, false, NULL)`,
      [tenant, typeId, fieldPathKey(p), w(p), dataType],
    )
  }
}

/** One definition with a complete engine spec and two `at_least_one` slots. */
export async function seedCorpusDefinition(q: Q, tenant: string, definition: string): Promise<void> {
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
             'money', 'SGD', 0, 2, 'days', 0,
             4, 10000, 200, 25, 128, 'jaro_winkler', 5000)`,
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
  for (const slot of ['ledger', 'bank']) {
    await q(
      `INSERT INTO tenant.definition_slot (tenant_id, definition_id, slot, cardinality)
       VALUES ($1, $2, $3, 'at_least_one')`,
      [tenant, definition, slot],
    )
  }
}

/**
 * `pairs` invoice/statement pairs, each pair agreeing on `ref` and amount, all
 * bound to `definition`'s two slots. Ids are prefixed with `prefix` so two
 * corpora can share a tenant. Written in batches of 500 rows per statement.
 *
 * `residueEvery` (default 0 — none): every k-th pair's STATEMENT carries a ref
 * and an amount that match nothing, so the engine meets residue on both sides
 * and its non-exact passes have something to do. Exact pairs alone are the
 * cheapest corpus the engine can be given, and a measurement over only those
 * would flatter it.
 */
export async function seedCorpusDocuments(
  q: Q,
  tenant: string,
  definition: string,
  prefix: string,
  pairs: number,
  residueEvery = 0,
): Promise<void> {
  const BATCH = 500
  for (let start = 0; start < pairs; start += BATCH) {
    const end = Math.min(pairs, start + BATCH)
    for (const side of ['l', 'r'] as const) {
      const ids: string[] = []
      const payloads: string[] = []
      for (let i = start; i < end; i += 1) {
        ids.push(`${prefix}_${side}${i}`)
        const minor = String(10000 + (i % 9973))
        const stray = side === 'r' && residueEvery > 0 && i % residueEvery === 0
        const ref = stray ? `STRAY-${i}` : `INV-${i}`
        const amount = stray ? String(20000 + (i % 7919)) : minor
        payloads.push(
          JSON.stringify(
            side === 'l'
              ? { total: { currency: 'SGD', amountMinor: minor, exponent: 2 }, issued: '2026-04-01', ref }
              : { amount: { currency: 'SGD', amountMinor: amount, exponent: 2 }, date: '2026-04-01', ref },
          ),
        )
      }
      const typeId = side === 'l' ? DT_INVOICE : DT_STATEMENT
      const slot = side === 'l' ? 'ledger' : 'bank'
      await q(
        `INSERT INTO tenant.arrival
           (tenant_id, id, channel_id, channel_kind, arrived_at, verdict_kind,
            authorization_id, source_document_id)
         SELECT $1, 'arr_' || d, $2, 'api', now(), 'admitted', 'auth_fixture', d
           FROM unnest($3::text[]) AS d`,
        [tenant, CHANNEL, ids],
      )
      await q(
        `INSERT INTO tenant.source_document (tenant_id, id, arrival_id, document_type_id, ingested_at)
         SELECT $1, d, 'arr_' || d, $2, now() FROM unnest($3::text[]) AS d`,
        [tenant, typeId, ids],
      )
      await q(
        `INSERT INTO tenant.document_payload (tenant_id, source_document_id, payload)
         SELECT $1, d, p::jsonb FROM unnest($2::text[], $3::text[]) AS t(d, p)`,
        [tenant, ids, payloads],
      )
      await q(
        `INSERT INTO tenant.document_control_total
           (tenant_id, source_document_id, kind, line_count, total_currency, total_minor, total_exponent)
         SELECT $1, d, 'not_declared_by_format', NULL, NULL, NULL, NULL FROM unnest($2::text[]) AS d`,
        [tenant, ids],
      )
      await q(
        `INSERT INTO tenant.document_slot_binding
           (tenant_id, definition_id, slot, period_id, source_document_id)
         SELECT $1, $2, $3, NULL, d FROM unnest($4::text[]) AS d`,
        [tenant, definition, slot, ids],
      )
    }
  }
}

/** A `queued` run of `definition`, version 1, unperiodised. */
export async function seedCorpusRun(q: Q, tenant: string, runId: string, definition: string): Promise<void> {
  await q(
    `INSERT INTO run (tenant_id, id, definition_id, definition_version, period_id,
                      trigger_kind, status, started_at)
     VALUES ($1, $2, $3, 1, NULL, 'manual', 'queued', now())`,
    [tenant, runId, definition],
  )
}

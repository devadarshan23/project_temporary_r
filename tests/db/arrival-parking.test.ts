/**
 * THE CLASSIFYING INTAKE, THE PARKED PILE AND THE DRAIN, OVER A REAL POSTGRESQL.
 * `db/migrations/0380_arrival_filename_and_parking.sql` and
 * `server/data-plane/payload-store.ts` §4a. G2831–G2840, 2 Oct 2026, applying
 * G2692 (THE OWNER'S RULING).
 *
 * ┌─ WHY A DATABASE SUITE AND NOT ONLY A SERVED ONE ───────────────────────────┐
 * │ `admitClassifyAndStoreArrival()` has NO CALLER OUTSIDE `tests/`: nothing    │
 * │ reads a source, because the connector is not built. `0007`'s precedent —    │
 * │ the writer is proven against a real PostgreSQL rather than through a route. │
 * │ What is SERVED (the pile, the pane, the drain, the raise) is               │
 * │ `tests/http/parked-pile-served.test.ts`.                                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 *   §1  a name falling under exactly one pair EXTRACTS: the arrival records the
 *       name verbatim, the document is the MAPPED record and nothing else, and
 *       its subject is registered (G295)
 *   §2  a name falling under none PARKS: the verdict is `parked`, the record is
 *       HELD whole, and no document exists
 *   §3  a refused arrival records its name too — the name of file 39,998 is
 *       what a person asks for (G205)
 *   §4  the database refuses what the writers never attempt: a held copy of an
 *       admitted arrival, a drain of an admitted arrival, an UPDATE anywhere,
 *       and a DELETE of a held copy NOBODY DRAINED — which matches zero rows
 *   §5  the drain: a pair declared AFTER the delivery extracts it, records the
 *       drain under the declaring act, deletes the held copy, and leaves the
 *       arrival's verdict `parked` — append-only
 *   §5b a held artefact whose subject cannot be registered refuses the drain
 *       and stores nothing for it (G295)
 *   §6  another tenant sees none of it — and with RLS DISABLED the same read
 *       LEAKS, which is what makes the first half mean anything
 *
 * WITNESSED RED (G2842): with `0380`'s `held_artefact_delete_only_drained`
 * policy dropped, §4's *"a DELETE of an undrained held copy removes nothing"*
 * failed — `rowCount` 1, the pile's only copy of a delivery gone with no drain
 * recorded.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import {
  admitClassifyAndStoreArrival,
  drainParkedAgainstPair,
  readArrival,
  type ClassifyingIntakeInput,
} from '../../server/data-plane/payload-store.ts'
import { arrivalFilenameFrom, type ArrivalFacts } from '../../model/ingestion.ts'
import { fieldPathKey, parseFieldPath } from '../../model/field-path.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_ARRIVAL_PARKING_DB_NAME'] ?? runScopedName('reconcile_arrival_parking_test')

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the arrival-parking database assertions', probe)

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const END = 'end_acme_drop'
const LANE = 'ich_acme_drop'
const TYPE = 'dty_acme_invoice'
const GRANT = 'agr_standing_acme'
const NOW = '2026-10-02T08:00:00.000Z'
const BOUND = '2099-01-01T00:00:00.000Z'

function mustParse(input: unknown) {
  const parsed = parseFieldPath(input)
  if (!parsed.ok) throw new Error('fixture path did not parse')
  return parsed.path
}
const NUMBER = fieldPathKey(mustParse(['invoice', 'number']))
const PAYER = fieldPathKey(mustParse(['invoice', 'payer']))

type Q = (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[]; rowCount?: number | null }>

async function asMigrator<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as never)
  } finally {
    await mig.end()
  }
}

async function one(sql: string, params: readonly unknown[] = []): Promise<Record<string, unknown> | undefined> {
  return asMigrator(async (q) => (await q(sql, params)).rows[0] as Record<string, unknown> | undefined)
}

function intake(arrivalId: string, rawName: string | null, payload: unknown, over: Partial<ArrivalFacts> = {}): ClassifyingIntakeInput {
  return {
    facts: {
      arrivalId: arrivalId as ArrivalFacts['arrivalId'],
      channelId: LANE as ArrivalFacts['channelId'],
      channelKind: 'watched_drop',
      endpointId: END as ArrivalFacts['endpointId'] & string,
      authorizationId: GRANT as ArrivalFacts['authorizationId'],
      byteCount: 64,
      ...over,
    } as ArrivalFacts,
    filename: rawName === null ? null : arrivalFilenameFrom(rawName),
    payload,
    sourceDocumentId: `sdo_${arrivalId}`,
    presentedAuthorizationIds: [GRANT as ArrivalFacts['authorizationId']],
    boundUntil: BOUND,
    earlierArrivalWithSameContent: null,
    now: NOW,
    readingId: null,
  }
}

async function declarePair(pairId: string, kind: 'path_prefix' | 'filename', value: string): Promise<void> {
  await asMigrator(async (q) => {
    await q(
      `INSERT INTO tenant.endpoint_document_type
         (tenant_id, id, endpoint_id, match_kind, match_value, document_type_id, declared_at, declared_authorization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'agr_pair_decl')`,
      [ACME, pairId, END, kind, value, TYPE, NOW],
    )
    for (const [key, field] of [
      [NUMBER, 'InvNo'],
      [PAYER, 'Payer'],
    ] as const) {
      await q(
        `INSERT INTO tenant.endpoint_field_mapping (tenant_id, pair_id, document_type_id, path_key, source_field)
         VALUES ($1, $2, $3, $4, $5)`,
        [ACME, pairId, TYPE, key, field],
      )
    }
  })
}

describe('the classifying intake, the parked pile and the drain (0380)', { skip }, () => {
  let pool: TenantPool

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await asMigrator(async (q) => {
      await q(
        `INSERT INTO tenant.endpoint (tenant_id, id, label, direction, connection_kind, declared_at, declared_authorization_id)
         VALUES ($1, $2, 'Supplier drop', 'inbound', 'sftp', $3, 'agr_decl')`,
        [ACME, END, NOW],
      )
      await q(
        `INSERT INTO tenant.intake_channel (tenant_id, id, kind, endpoint_id, enabled)
         VALUES ($1, $2, 'watched_drop', $3, true),
                ($1, 'ich_acme_off', 'watched_drop', $3, false)`,
        [ACME, LANE, END],
      )
      await q(
        `INSERT INTO tenant.document_type (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
         VALUES ($1, $2, 'ap.invoice', 'Supplier invoice', 'finance', 'structured', 'never')`,
        [ACME, TYPE],
      )
      for (const [key, p, klass] of [
        [NUMBER, '["invoice","number"]', 'internal'],
        [PAYER, '["invoice","payer"]', 'personal'],
      ] as const) {
        await q(
          `INSERT INTO tenant.document_field_spec
             (tenant_id, document_type_id, path_key, path, data_class, data_type, model_processing_allowed, confidence_floor)
           VALUES ($1, $2, $3, $4::jsonb, $5, 'string', false, NULL)`,
          [ACME, TYPE, key, p, klass],
        )
      }
    })
    await declarePair('edt_invoices', 'path_prefix', 'invoices/')
    pool = await createAppPool(2)
  })

  after(async () => {
    await pool?.end()
  })

  it('§1 · a name under exactly one pair EXTRACTS the MAPPED record, and its subject is registered', async () => {
    const out = await withTenantScope(pool, ACME, (tx) =>
      admitClassifyAndStoreArrival(
        tx,
        intake('arr_1', 'invoices/2026-10/INV-1.json', { InvNo: 'INV-1', Payer: 'Ada Lovelace', Secret: 'never-stored' }),
      ),
    )
    assert.equal(out.kind, 'stored', JSON.stringify(out))
    const arrival = await withTenantScope(pool, ACME, (tx) => readArrival(tx, 'arr_1'))
    assert.equal(arrival?.verdictKind, 'admitted')
    assert.equal(arrival?.filename, 'invoices/2026-10/INV-1.json', 'the name was not stored verbatim')
    const doc = await one(
      `SELECT d.document_type_id, p.payload::text AS payload
         FROM tenant.source_document d JOIN tenant.document_payload p ON p.source_document_id = d.id
        WHERE d.arrival_id = 'arr_1'`,
    )
    assert.equal(doc?.['document_type_id'], TYPE)
    assert.equal(doc?.['payload'], '{"invoice": {"payer": "Ada Lovelace", "number": "INV-1"}}')
    assert.equal(String(doc?.['payload']).includes('never-stored'), false, 'an unmapped source field crossed')
    const subjects = await one(
      `SELECT count(*)::int AS n FROM tenant.subject_index_entry WHERE location_source_document_id = 'sdo_arr_1'`,
    )
    assert.equal(subjects?.['n'], 1, 'the personal-class position registered no subject (G295)')
  })

  it('§2 · a name under no pair PARKS — verdict `parked`, the record HELD whole, no document', async () => {
    const weird = 'Statements/../2026 Q3 ✓.JSON'
    const out = await withTenantScope(pool, ACME, (tx) =>
      admitClassifyAndStoreArrival(tx, intake('arr_2', weird, { InvNo: 'INV-2', Payer: 'Grace Hopper' })),
    )
    assert.deepEqual(out, { kind: 'parked', reason: 'no_declared_pair_matches', matchingPairIds: [] })
    const row = await one(`SELECT verdict_kind, filename, source_document_id FROM tenant.arrival WHERE id = 'arr_2'`)
    assert.deepEqual(row, { verdict_kind: 'parked', filename: weird, source_document_id: null })
    const held = await one(`SELECT payload::text AS payload FROM tenant.held_artefact WHERE arrival_id = 'arr_2'`)
    assert.equal(held?.['payload'], '{"InvNo": "INV-2", "Payer": "Grace Hopper"}')
    assert.equal((await one(`SELECT count(*)::int AS n FROM tenant.source_document WHERE arrival_id = 'arr_2'`))?.['n'], 0)
  })

  it('§3 · a REFUSED arrival records its name too, and holds nothing', async () => {
    const out = await withTenantScope(pool, ACME, (tx) =>
      admitClassifyAndStoreArrival(
        tx,
        intake('arr_3', 'invoices/off.json', { InvNo: 'X' }, { channelId: 'ich_acme_off' as ArrivalFacts['channelId'] }),
      ),
    )
    assert.equal(out.kind, 'refused')
    const row = await one(`SELECT verdict_kind, refusal_kind, filename FROM tenant.arrival WHERE id = 'arr_3'`)
    assert.deepEqual(row, { verdict_kind: 'refused', refusal_kind: 'channel_disabled', filename: 'invoices/off.json' })
    assert.equal((await one(`SELECT count(*)::int AS n FROM tenant.held_artefact WHERE arrival_id = 'arr_3'`))?.['n'], 0)
  })

  it('§4 · the database refuses what the writers never attempt', async () => {
    const refused = async (sql: string, params: readonly unknown[] = []): Promise<string> => {
      try {
        await withTenantScope(pool, ACME, (tx) => tx.query(sql, params as unknown[]))
        return 'COMMITTED'
      } catch (e) {
        return (e as Error).message
      }
    }
    assert.match(
      await refused(`INSERT INTO tenant.held_artefact (tenant_id, arrival_id, payload, held_at) VALUES ($1, 'arr_1', '{}', now())`, [ACME]),
      /row-level security/,
      'a held copy of an ADMITTED arrival was written',
    )
    assert.match(
      await refused(
        `INSERT INTO tenant.arrival_drain (tenant_id, arrival_id, pair_id, document_type_id, source_document_id, drained_at, authorization_id)
         VALUES ($1, 'arr_1', 'edt_invoices', $2, 'sdo_arr_1', now(), 'agr_x')`,
        [ACME, TYPE],
      ),
      /row-level security/,
      'a drain of an ADMITTED arrival was recorded',
    )
    for (const [table, column] of [
      ['held_artefact', 'payload'],
      ['arrival_drain', 'pair_id'],
      ['parked_escalation', 'document_type_id'],
      ['arrival', 'filename'],
    ] as const) {
      assert.match(
        await refused(`UPDATE tenant.${table} SET ${column} = ${column}`),
        /permission denied/,
        `UPDATE on tenant.${table} was permitted`,
      )
    }
    for (const table of ['arrival_drain', 'parked_escalation']) {
      assert.match(await refused(`DELETE FROM tenant.${table}`), /permission denied/, `DELETE on ${table} was permitted`)
    }
    /* 🛑 THE ONE DELETE THAT IS GRANTED, AGAINST A COPY NOBODY DRAINED: it
     * matches ZERO rows and raises nothing, and the copy is still there. */
    const deleted = await withTenantScope(pool, ACME, (tx) =>
      tx.query(`DELETE FROM tenant.held_artefact WHERE arrival_id = 'arr_2'`),
    )
    assert.equal(deleted.rowCount, 0, 'an undrained held copy was deleted — the pile lost a delivery')
    assert.equal((await one(`SELECT count(*)::int AS n FROM tenant.held_artefact WHERE arrival_id = 'arr_2'`))?.['n'], 1)
  })

  it('§5 · a pair declared AFTER the delivery drains it, under the declaring act, and the verdict stays `parked`', async () => {
    await declarePair('edt_statements', 'path_prefix', 'Statements/')
    const out = await withTenantScope(pool, ACME, (tx) =>
      drainParkedAgainstPair(tx, {
        endpointId: END,
        pairId: 'edt_statements',
        authorizationId: 'agr_drain_act',
        now: NOW,
        mintDocumentId: () => 'sdo_drained_2',
      }),
    )
    assert.deepEqual(out, { kind: 'drained', drained: 1, stillParked: 0 })
    const drain = await one(`SELECT pair_id, source_document_id, authorization_id FROM tenant.arrival_drain WHERE arrival_id = 'arr_2'`)
    assert.deepEqual(drain, { pair_id: 'edt_statements', source_document_id: 'sdo_drained_2', authorization_id: 'agr_drain_act' })
    assert.equal((await one(`SELECT verdict_kind FROM tenant.arrival WHERE id = 'arr_2'`))?.['verdict_kind'], 'parked')
    assert.equal((await one(`SELECT count(*)::int AS n FROM tenant.held_artefact WHERE arrival_id = 'arr_2'`))?.['n'], 0)
    assert.equal(
      (await one(`SELECT payload::text AS p FROM tenant.document_payload WHERE source_document_id = 'sdo_drained_2'`))?.['p'],
      '{"invoice": {"payer": "Grace Hopper", "number": "INV-2"}}',
    )
    assert.equal(
      (await one(`SELECT count(*)::int AS n FROM tenant.subject_index_entry WHERE location_source_document_id = 'sdo_drained_2'`))?.['n'],
      1,
    )
    /* A second drain finds nothing: one drain per arrival, by primary key. */
    const again = await withTenantScope(pool, ACME, (tx) =>
      drainParkedAgainstPair(tx, { endpointId: END, pairId: 'edt_statements', authorizationId: 'agr_x', now: NOW, mintDocumentId: () => 'sdo_never' }),
    )
    assert.deepEqual(again, { kind: 'drained', drained: 0, stillParked: 0 })
  })

  it('§5b · a held subject this plane cannot register refuses the drain, and nothing is stored for it (G295)', async () => {
    /* `1e400` is a legal `jsonb` numeric and parses to `Infinity` in the
     * driver, which `canonicalise()` refuses — a real, storable artefact. */
    await asMigrator(async (q) => {
      await q(
        `INSERT INTO tenant.arrival (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id, arrived_at, verdict_kind, filename)
         VALUES ($1, 'arr_inf', $2, 'watched_drop', $3, $4, $5, 'parked', 'refunds/r.json')`,
        [ACME, LANE, END, GRANT, NOW],
      )
      await q(
        `INSERT INTO tenant.held_artefact (tenant_id, arrival_id, payload, held_at)
         VALUES ($1, 'arr_inf', '{"InvNo": "R-1", "Payer": 1e400}'::jsonb, $2)`,
        [ACME, NOW],
      )
    })
    await declarePair('edt_refunds', 'path_prefix', 'refunds/')
    const out = await withTenantScope(pool, ACME, (tx) =>
      drainParkedAgainstPair(tx, { endpointId: END, pairId: 'edt_refunds', authorizationId: 'agr_x', now: NOW, mintDocumentId: () => 'sdo_inf' }),
    )
    assert.equal(out.kind, 'subject_not_digestible', JSON.stringify(out))
    assert.equal((await one(`SELECT count(*)::int AS n FROM tenant.source_document WHERE id = 'sdo_inf'`))?.['n'], 0)
    assert.equal((await one(`SELECT count(*)::int AS n FROM tenant.held_artefact WHERE arrival_id = 'arr_inf'`))?.['n'], 1)
  })

  it('§6 · another tenant sees none of it — and with RLS DISABLED the same read LEAKS', async () => {
    const seen = await withTenantScope(pool, GLOBEX, async (tx) => ({
      held: (await tx.query('SELECT arrival_id FROM tenant.held_artefact')).rows.length,
      drains: (await tx.query('SELECT arrival_id FROM tenant.arrival_drain')).rows.length,
      named: (await tx.query('SELECT filename FROM tenant.arrival')).rows.length,
    }))
    assert.deepEqual(seen, { held: 0, drains: 0, named: 0 })
    await asMigrator(async (q) => {
      await q('ALTER TABLE tenant.held_artefact NO FORCE ROW LEVEL SECURITY')
      await q('ALTER TABLE tenant.held_artefact DISABLE ROW LEVEL SECURITY')
    })
    try {
      const leaked = await withTenantScope(pool, GLOBEX, async (tx) =>
        (await tx.query('SELECT arrival_id FROM tenant.held_artefact')).rows.length,
      )
      assert.ok(leaked > 0, `with RLS disabled the read did NOT leak (${leaked}) — the control proves nothing`)
    } finally {
      await asMigrator(async (q) => {
        await q('ALTER TABLE tenant.held_artefact ENABLE ROW LEVEL SECURITY')
        await q('ALTER TABLE tenant.held_artefact FORCE ROW LEVEL SECURITY')
      })
    }
  })
})

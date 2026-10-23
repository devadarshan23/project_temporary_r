/**
 * ════════════════════════════════════════════════════════════════════════════
 * C9's PARKED PILE, SERVED — `listParkedArrivals`, `getParkedArrival`,
 * `raiseParkedArrival`, and the DRAIN inside `declareEndpointDocumentType`.
 * G2831–G2840, 2 Oct 2026, applying G2692 — THE OWNER'S RULING.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Over a real socket, against a real PostgreSQL, through the PRODUCTION gate
 * and the PRODUCTION substrate. The deliveries are written through
 * `admitClassifyAndStoreArrival()` in the tenant's own scope, because that is
 * the only writer there is: no connector reads a source yet.
 *
 *   §1  three deliveries on a source with NO pair park — row 7's one bucket
 *   §2  the pile (rows 7, 18): counted apart, every `required` field present
 *       (K6), the name verbatim, the reason derived, invariant 10's record
 *       minted under `view_exception`
 *   §3  the pane (rows 9, 19) to a person who CANNOT act: the sample's KEYS and
 *       NEVER a value (G106)
 *   §4  the gates: no `view_exception` → 403 on the pile and the pane; no
 *       `configure_endpoint` → 403 on the raise; a smuggled tenant → 400
 *   §5  the raise (row 13): 201, then the SAME raise answered 200 with nothing
 *       written; an unknown type 422; counted separately on the pile
 *   §6  another tenant sees no pile, cannot open the pane, cannot raise — and
 *       with RLS DISABLED underneath the same read it LEAKS
 *   §7  the drain (row 16): declaring a pair extracts what is parked against
 *       it, under the declaring act, and the register says why
 *   §7b a drain that would store an unregistrable subject refuses the PAIR and
 *       writes no pair (G295) — the act's record still commits
 *   §8  a pair that matches an artefact it cannot map leaves it parked, and
 *       the pane says so
 *
 * WITNESSED RED (G2843), each by mutation:
 *   · `drainParkedAgainstPair()`'s extract condition forced false — §7, §7b
 *     and §8 went RED: the 201 answered `{"drained":0,"stillParked":4}` and
 *     the pair was written over a pile it claimed and did not drain;
 *   · `sample.fields` made to carry the record's VALUES as well as its keys —
 *     §3 went RED.
 *   ⚠️ AND ONE MUTATION DID NOT GO RED, WHICH IS A SECOND CONTROL RATHER THAN
 *     A GAP: adding the whole held record to `sample` as an extra property was
 *     STRIPPED by the serialiser, because `ParkedArrivalPane.sample` is
 *     `additionalProperties: false` and `fast-json-stringify` publishes only
 *     declared properties. The schema is a guard on the additive direction; §3
 *     guards the declared one.
 */
/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope } from '../../db/tenant-scope.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { admitClassifyAndStoreArrival } from '../../server/data-plane/payload-store.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { arrivalFilenameFrom, type ArrivalFacts } from '../../model/ingestion.ts'
import { fieldPathKey, parseFieldPath } from '../../model/field-path.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PARKED_DB_NAME'] ?? runScopedName('reconcile_parked_pile_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'
process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_entra_park'
const GLOBEX_DOOR = 'idc_globex_okta_park'
const ADMIN = 'usr_acme_park_admin'
const CLERK = 'usr_acme_park_clerk'
const VIEWER = 'usr_acme_park_viewer'
const RUTH = 'usr_globex_park_admin'
const ADMIN_HANDLE = 'sx_parkadmin_8c3e20b1d5c94f4fab62e1c7d9f3a528'
const CLERK_HANDLE = 'sx_parkclerk_4a0e15f8b2d3497e9f6c81a3b0e4d729'
const VIEWER_HANDLE = 'sx_parkview_2b8f93d6c0e1475a9b4d62f1c8a7e305'
const RUTH_HANDLE = 'sx_parkruth_6f2b94dae8f15c37b9d4fa216c8e3075'

const TYPE = 'dty_acme_invoice'
const GLOBEX_TYPE = 'dty_globex_invoice'
const STANDING = 'agr_standing_park'
const BOUND = '2099-01-01T00:00:00.000Z'
/* A value that must NEVER appear in a response: it sits in a held artefact,
 * which no `FieldSpec` addresses (G106). */
const HELD_VALUE = 'held-value-7f3c91e2-never-published'

function mustParse(input: unknown) {
  const parsed = parseFieldPath(input)
  if (!parsed.ok) throw new Error('fixture field path did not parse')
  return parsed.path
}
const NUMBER = fieldPathKey(mustParse(['invoice', 'number']))
const PAYER = fieldPathKey(mustParse(['invoice', 'payer']))

const PIN = `SHA256:${'Zq'.repeat(21)}Z`

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served parked-pile assertions', probe)

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function send(
  origin: string,
  path: string,
  opts: { body?: unknown; session?: string; host?: string; method?: string } = {},
): Promise<Response> {
  const url = new URL(origin)
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: opts.method ?? 'GET',
        headers: {
          Host: opts.host ?? ACME_HOST,
          ...sessionCookie(opts.session ?? ADMIN_HANDLE),
          ...(payload === undefined
            ? {}
            : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }),
        },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          text += chunk
        })
        res.on('end', () => {
          let body: Record<string, unknown> | undefined
          try {
            const parsed: unknown = JSON.parse(text)
            body = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined
          } catch {
            body = undefined
          }
          resolve({ status: res.statusCode ?? 0, body, text })
        })
      },
    )
    req.on('error', reject)
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

type Q = (sql: string, p?: readonly unknown[]) => Promise<{ rows: unknown[] }>

async function asMigrator<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const mig = await migratorClient()
  try {
    return await fn((sql, p = []) => mig.query(sql, p as unknown[]) as Promise<{ rows: unknown[] }>)
  } finally {
    await mig.end()
  }
}

async function count(sql: string, params: readonly unknown[] = []): Promise<number> {
  return asMigrator(async (q) => Number(((await q(sql, params)).rows[0] as { n: unknown }).n))
}

async function seedSubstrate(): Promise<void> {
  const handles = [ADMIN_HANDLE, CLERK_HANDLE, VIEWER_HANDLE, RUTH_HANDLE]
  const digests = handles.map((h) => digestOfHandle(h))
  for (const d of digests) assert.notEqual(d, null)
  await asMigrator(async (q) => {
    await q('BEGIN')
    for (const [id, label, account, ref] of [
      [DOOR, 'Acme Entra ID', 'acc_acme', 'acme-entra-park'],
      [GLOBEX_DOOR, 'Globex Okta', 'acc_globex', 'globex-okta-park'],
    ] as const) {
      await q(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, broker_issuer, broker_ref, status)
         VALUES ($1, 'oidc', $2, 'customer', NULL, $3, 'https://login.microsoftonline.com/parked/v2.0', $4, 'active')`,
        [id, label, account, ref],
      )
    }
    const people = [
      [ADMIN, 'Acme Administrator', DOOR, ACME, 'rol_park_admin'],
      [CLERK, 'Acme Clerk', DOOR, ACME, 'rol_park_clerk'],
      [VIEWER, 'Acme Viewer', DOOR, ACME, 'rol_park_viewer'],
      [RUTH, 'Ruth Iyer', GLOBEX_DOOR, GLOBEX, 'rol_park_globex'],
    ] as const
    for (const [user, name, door] of people) {
      await q(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@invalid', $2, 'active', $3)`,
        [user, name, door],
      )
    }
    for (const [, , , tenant, role] of people) {
      await q(
        `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, $2, $2, $2, 1, 'administrator', 'tenant', NULL, 'active')`,
        [tenant, role],
      )
    }
    for (const [tenant, role, capability] of [
      [ACME, 'rol_park_admin', CAPABILITIES.configureEndpoint],
      [ACME, 'rol_park_admin', CAPABILITIES.viewEndpoint],
      [ACME, 'rol_park_admin', CAPABILITIES.viewException],
      /* 🛑 THE CLERK CANNOT ACT AND STILL FOLLOWS THE LINE — row 19. */
      [ACME, 'rol_park_clerk', CAPABILITIES.viewException],
      /* THE VIEWER SEES SOURCES AND NOT THE REGISTER — §4's differential. */
      [ACME, 'rol_park_viewer', CAPABILITIES.viewEndpoint],
      [GLOBEX, 'rol_park_globex', CAPABILITIES.configureEndpoint],
      [GLOBEX, 'rol_park_globex', CAPABILITIES.viewEndpoint],
      [GLOBEX, 'rol_park_globex', CAPABILITIES.viewException],
    ] as const) {
      await q('INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)', [
        tenant,
        role,
        capability,
      ])
    }
    for (const [user, , , tenant, role] of people) {
      await q(
        `INSERT INTO tenant.role_assignment
           (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 1, 'bootstrap', now(), NULL, NULL)`,
        [tenant, `ras_${user}`, user, role],
      )
      await q(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 'bootstrap', now(), NULL, NULL)`,
        [tenant, `mem_${user}`, user, role],
      )
    }
    for (const [i, [user, , door, tenant]] of people.entries()) {
      await q(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now() + interval '12 hours', NULL)`,
        [`ses_park_${i}`, digests[i], user, door, tenant, tenant === ACME ? ACME_HOST : GLOBEX_HOST],
      )
    }
    await q(
      `INSERT INTO tenant.document_type (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
       VALUES ($1, $2, 'ap.invoice', 'Supplier invoice', 'finance', 'structured', 'never'),
              ($3, $4, 'ap.invoice', 'Supplier invoice', 'finance', 'structured', 'never')`,
      [ACME, TYPE, GLOBEX, GLOBEX_TYPE],
    )
    for (const [tenant, type] of [
      [ACME, TYPE],
      [GLOBEX, GLOBEX_TYPE],
    ] as const) {
      for (const [key, p, klass] of [
        [NUMBER, '["invoice","number"]', 'internal'],
        [PAYER, '["invoice","payer"]', 'personal'],
      ] as const) {
        await q(
          `INSERT INTO tenant.document_field_spec
             (tenant_id, document_type_id, path_key, path, data_class, data_type, model_processing_allowed, confidence_floor)
           VALUES ($1, $2, $3, $4::jsonb, $5, 'string', false, NULL)`,
          [tenant, type, key, p, klass],
        )
      }
    }
    await q('COMMIT')
  })
}

const MAPPING = [
  { sourceField: 'InvNo', fieldPathKey: NUMBER },
  { sourceField: 'Payer', fieldPathKey: PAYER },
]

const PARKED_REQUIRED = [
  'arrivalId',
  'endpointId',
  'endpointLabel',
  'filename',
  'arrivedAt',
  'parkedBecause',
  'matchingPairIds',
  'escalation',
  'unblockedBy',
] as const

function assertRequired(obj: Record<string, unknown> | undefined, fields: readonly string[], what: string): void {
  assert.ok(obj !== undefined, `${what}: no body`)
  for (const f of fields) assert.ok(f in obj, `${what} is missing required \`${f}\` (K6)`)
}

describe('C9’s parked pile over HTTP, through the production gate (G2692)', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let origin: string
  let endpointId = ''
  let laneId = ''

  async function deliver(arrivalId: string, name: string, payload: unknown): Promise<string> {
    const pool = await createAppPool(1)
    try {
      const out = await withTenantScope(pool, ACME, (tx) =>
        admitClassifyAndStoreArrival(tx, {
          facts: {
            arrivalId: arrivalId as ArrivalFacts['arrivalId'],
            channelId: laneId as ArrivalFacts['channelId'],
            channelKind: 'watched_drop',
            endpointId: endpointId as NonNullable<ArrivalFacts['endpointId']>,
            authorizationId: STANDING as ArrivalFacts['authorizationId'],
            byteCount: 128,
          },
          filename: arrivalFilenameFrom(name),
          payload,
          sourceDocumentId: `sdo_${arrivalId}`,
          presentedAuthorizationIds: [STANDING as ArrivalFacts['authorizationId']],
          boundUntil: BOUND,
          earlierArrivalWithSameContent: null,
          now: new Date().toISOString(),
          readingId: null,
        }),
      )
      return out.kind
    } finally {
      await pool.end()
    }
  }

  async function pile(session = ADMIN_HANDLE): Promise<Response> {
    return send(origin, '/v1/parked', { session })
  }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    plane = await startDataPlane({ poolMax: 4 })
    origin = plane.url
  })

  after(async () => {
    await plane?.close()
  })

  it('§1 · three deliveries on a source with no pair PARK — one bucket (row 7)', async () => {
    const declared = await send(origin, '/v1/endpoints', {
      method: 'POST',
      body: {
        label: 'Supplier SFTP',
        connection: { kind: 'sftp', host: 'sftp.supplier.example', port: 22, path: '/out', hostKeyFingerprint: PIN },
      },
    })
    assert.equal(declared.status, 201, declared.text.slice(0, 300))
    endpointId = String(declared.body?.['endpointId'])
    laneId = await asMigrator(async (q) =>
      String(((await q('SELECT id FROM tenant.intake_channel WHERE endpoint_id = $1', [endpointId])).rows[0] as { id: string }).id),
    )
    assert.equal(await deliver('arr_park_a', 'invoices/A-1.json', { InvNo: 'A-1', Payer: 'Ada', Note: HELD_VALUE }), 'parked')
    assert.equal(await deliver('arr_park_b', 'invoices/B-2.json', { InvNo: 'B-2', Payer: 'Grace' }), 'parked')
    assert.equal(await deliver('arr_park_c', 'misc/readme <b>.txt', 'just a string'), 'parked')
  })

  it('§2 · the pile — counted apart, every required field, the name verbatim, a record minted', async () => {
    const res = await pile()
    assert.equal(res.status, 200, res.text.slice(0, 400))
    assertRequired(res.body, ['awaitingSetup', 'items', 'drains'], 'the pile')
    assert.deepEqual(res.body?.['awaitingSetup'], { parked: 3, raisedWithFde: 0 })
    const items = res.body?.['items'] as Array<Record<string, unknown>>
    assert.equal(items.length, 3)
    for (const item of items) {
      assertRequired(item, PARKED_REQUIRED, 'a parked line')
      assert.equal(item['parkedBecause'], 'no_declared_pair_matches')
      assert.equal(item['endpointLabel'], 'Supplier SFTP')
      assert.deepEqual(item['unblockedBy'], { capability: 'configure_endpoint' })
      assert.equal(item['escalation'], null)
    }
    assert.ok(items.some((i) => i['filename'] === 'misc/readme <b>.txt'), 'the name was not published verbatim')
    assert.equal(res.text.includes(HELD_VALUE), false, 'a VALUE from a held artefact was published on the pile')
    assert.deepEqual(res.body?.['drains'], [])
    /* Counted APART from exceptions: the register's own table is untouched. */
    assert.equal(await count('SELECT count(*) AS n FROM tenant.exception'), 0)
    /* Invariant 10 — the read ran under a record naming `view_exception`. */
    assert.ok(
      (await count(
        `SELECT count(*) AS n FROM tenant.authorization_grant
          WHERE capability = 'view_exception' AND resource_type = 'Arrival' AND subject_user_id = $1`,
        [ADMIN],
      )) >= 1,
      'the pile read minted no authorisation record',
    )
  })

  it('§3 · the pane, to a person who CANNOT act — the sample’s KEYS and never a value (rows 9, 19)', async () => {
    const res = await send(origin, '/v1/parked/arr_park_a', { session: CLERK_HANDLE })
    assert.equal(res.status, 200, res.text.slice(0, 400))
    assertRequired(res.body, [...PARKED_REQUIRED, 'sample'], 'the pane')
    assert.deepEqual(res.body?.['sample'], { isRecord: true, fields: ['InvNo', 'Note', 'Payer'] })
    assert.equal(res.body?.['filename'], 'invoices/A-1.json')
    assert.equal(res.text.includes(HELD_VALUE), false, 'a VALUE from a held artefact was published')
    assert.equal(res.text.includes('Ada'), false, 'a VALUE from a held artefact was published')
    const c = await send(origin, '/v1/parked/arr_park_c', { session: CLERK_HANDLE })
    assert.deepEqual(c.body?.['sample'], { isRecord: false, fields: [] })
    assert.equal((await send(origin, '/v1/parked/arr_nobody', { session: CLERK_HANDLE })).status, 404)
  })

  it('§4 · the gates — no `view_exception` is a 403; no `configure_endpoint` cannot raise; no smuggled tenant', async () => {
    assert.equal((await pile(VIEWER_HANDLE)).status, 403)
    assert.equal((await send(origin, '/v1/parked/arr_park_a', { session: VIEWER_HANDLE })).status, 403)
    const before = await count('SELECT count(*) AS n FROM tenant.parked_escalation')
    const clerk = await send(origin, '/v1/parked/arr_park_a/escalation', {
      method: 'POST',
      session: CLERK_HANDLE,
      body: { documentTypeId: TYPE },
    })
    assert.equal(clerk.status, 403, 'a person without `configure_endpoint` raised a parked delivery')
    const smuggled = await send(origin, '/v1/parked/arr_park_a/escalation', {
      method: 'POST',
      body: { documentTypeId: TYPE, tenantId: GLOBEX },
    })
    assert.equal(smuggled.status, 400)
    assert.equal(await count('SELECT count(*) AS n FROM tenant.parked_escalation'), before)
  })

  it('§5 · the raise (row 13) — 201, the same raise answered 200 with nothing written, counted apart', async () => {
    const first = await send(origin, '/v1/parked/arr_park_a/escalation', { method: 'POST', body: { documentTypeId: TYPE } })
    assert.equal(first.status, 201, first.text.slice(0, 300))
    assertRequired(first.body, ['arrivalId', 'documentTypeId', 'raisedAt'], 'the escalation')
    const again = await send(origin, '/v1/parked/arr_park_a/escalation', { method: 'POST', body: { documentTypeId: TYPE } })
    assert.equal(again.status, 200)
    assert.equal(again.body?.['raisedAt'], first.body?.['raisedAt'], 'the second raise rewrote the first')
    assert.equal(await count('SELECT count(*) AS n FROM tenant.parked_escalation'), 1)
    const unknown = await send(origin, '/v1/parked/arr_park_b/escalation', {
      method: 'POST',
      body: { documentTypeId: GLOBEX_TYPE },
    })
    assert.equal(unknown.status, 422, 'another tenant’s type was accepted on an escalation')
    const p = await pile()
    assert.deepEqual(p.body?.['awaitingSetup'], { parked: 3, raisedWithFde: 1 })
    const pinned = await count(
      `SELECT count(*) AS n FROM tenant.parked_escalation x
         JOIN tenant.authorization_grant g ON g.id = x.authorization_id
        WHERE g.capability = 'configure_endpoint' AND g.subject_user_id = $1`,
      [ADMIN],
    )
    assert.equal(pinned, 1, 'the escalation does not pin the record it was raised under — invariant 10')
  })

  it('§6 · another tenant sees no pile, opens no pane, raises nothing — and with RLS DISABLED it LEAKS', async () => {
    const ruth = await send(origin, '/v1/parked', { session: RUTH_HANDLE, host: GLOBEX_HOST })
    assert.equal(ruth.status, 200)
    assert.deepEqual(ruth.body?.['items'], [])
    assert.equal((await send(origin, '/v1/parked/arr_park_b', { session: RUTH_HANDLE, host: GLOBEX_HOST })).status, 404)
    const raise = await send(origin, '/v1/parked/arr_park_b/escalation', {
      method: 'POST',
      session: RUTH_HANDLE,
      host: GLOBEX_HOST,
      body: { documentTypeId: GLOBEX_TYPE },
    })
    assert.equal(raise.status, 404)
    await asMigrator(async (q) => {
      await q('ALTER TABLE tenant.arrival NO FORCE ROW LEVEL SECURITY')
      await q('ALTER TABLE tenant.arrival DISABLE ROW LEVEL SECURITY')
    })
    try {
      const pool = await createAppPool(1)
      try {
        const leaked = await withTenantScope(pool, GLOBEX, async (tx) =>
          (await tx.query(`SELECT id FROM tenant.arrival WHERE verdict_kind = 'parked'`, [])).rows.length,
        )
        assert.ok(leaked > 0, `with RLS disabled the read did NOT leak (${leaked}) — the control proves nothing`)
      } finally {
        await pool.end()
      }
    } finally {
      await asMigrator(async (q) => {
        await q('ALTER TABLE tenant.arrival ENABLE ROW LEVEL SECURITY')
        await q('ALTER TABLE tenant.arrival FORCE ROW LEVEL SECURITY')
      })
    }
  })

  it('§7 · the drain (row 16) — declaring a pair extracts what is parked against it, and the register says why', async () => {
    const res = await send(origin, `/v1/endpoints/${endpointId}/document-types`, {
      method: 'POST',
      body: { match: { kind: 'path_prefix', value: 'invoices/' }, documentTypeId: TYPE, fieldMappings: MAPPING },
    })
    assert.equal(res.status, 201, res.text.slice(0, 400))
    assertRequired(res.body, ['pairId', 'match', 'documentTypeId', 'expectedFidelity', 'mappedFields', 'drain'], 'the pair')
    assert.deepEqual(res.body?.['drain'], { drained: 2, stillParked: 1 })
    const pairId = String(res.body?.['pairId'])

    /* The drain is pinned to the DECLARING act's record — invariant 10. */
    const pinned = await count(
      `SELECT count(*) AS n FROM tenant.arrival_drain d
         JOIN tenant.authorization_grant g ON g.id = d.authorization_id
        WHERE d.pair_id = $1 AND g.capability = 'configure_endpoint' AND g.resource_id = $2`,
      [pairId, endpointId],
    )
    assert.equal(pinned, 2)
    /* The documents are the MAPPED records; the held copies are gone. */
    const payload = await asMigrator(async (q) =>
      String(
        ((await q(
          `SELECT p.payload::text AS p FROM tenant.arrival_drain d
             JOIN tenant.document_payload p ON p.source_document_id = d.source_document_id
            WHERE d.arrival_id = 'arr_park_a'`,
        )).rows[0] as { p: string }).p,
      ),
    )
    assert.equal(payload, '{"invoice": {"payer": "Ada", "number": "A-1"}}')
    assert.equal(payload.includes(HELD_VALUE), false, 'an unmapped field was extracted')
    assert.equal(await count(`SELECT count(*) AS n FROM tenant.held_artefact WHERE arrival_id IN ('arr_park_a','arr_park_b')`), 0)
    /* The line that linked to the pane no longer exists. */
    assert.equal((await send(origin, '/v1/parked/arr_park_a', { session: CLERK_HANDLE })).status, 404)

    const p = await pile()
    assert.deepEqual(p.body?.['awaitingSetup'], { parked: 1, raisedWithFde: 0 })
    const drains = p.body?.['drains'] as Array<Record<string, unknown>>
    assert.equal(drains.length, 1)
    assertRequired(drains[0], ['pairId', 'endpointId', 'documentTypeId', 'drained', 'lastDrainedAt', 'because'], 'a drain line')
    assert.equal(drains[0]?.['drained'], 2)
    assert.equal(drains[0]?.['because'], 'pair_declared')
  })

  it('§7b · a drain that would store an unregistrable subject refuses the PAIR, and writes no pair (G295)', async () => {
    await asMigrator(async (q) => {
      await q(
        `INSERT INTO tenant.arrival (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id, arrived_at, verdict_kind, filename)
         VALUES ($1, 'arr_park_inf', $2, 'watched_drop', $3, $4, now(), 'parked', 'refunds/r.json')`,
        [ACME, laneId, endpointId, STANDING],
      )
      await q(
        `INSERT INTO tenant.held_artefact (tenant_id, arrival_id, payload, held_at)
         VALUES ($1, 'arr_park_inf', '{"InvNo": "R-1", "Payer": 1e400}'::jsonb, now())`,
        [ACME],
      )
    })
    const res = await send(origin, `/v1/endpoints/${endpointId}/document-types`, {
      method: 'POST',
      body: { match: { kind: 'path_prefix', value: 'refunds/' }, documentTypeId: TYPE, fieldMappings: MAPPING },
    })
    assert.equal(res.status, 422, res.text.slice(0, 300))
    assert.match(res.text, /parked_artefact_subject_not_digestible/)
    assert.equal(
      await count(`SELECT count(*) AS n FROM tenant.endpoint_document_type WHERE match_value = 'refunds/'`),
      0,
      'the pair was written although its drain was refused',
    )
    assert.equal(await count(`SELECT count(*) AS n FROM tenant.held_artefact WHERE arrival_id = 'arr_park_inf'`), 1)
  })

  it('§8 · a pair that claims an artefact it cannot map leaves it parked, and the pane says why', async () => {
    const res = await send(origin, `/v1/endpoints/${endpointId}/document-types`, {
      method: 'POST',
      body: { match: { kind: 'path_prefix', value: 'misc/' }, documentTypeId: TYPE, fieldMappings: MAPPING },
    })
    assert.equal(res.status, 201, res.text.slice(0, 300))
    assert.deepEqual(res.body?.['drain'], { drained: 0, stillParked: 2 })
    const pane = await send(origin, '/v1/parked/arr_park_c', { session: CLERK_HANDLE })
    assert.equal(pane.body?.['parkedBecause'], 'artefact_does_not_fit_the_mapping')
    assert.deepEqual(pane.body?.['matchingPairIds'], [res.body?.['pairId']])
  })
})

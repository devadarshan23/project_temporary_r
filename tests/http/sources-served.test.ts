/**
 * ════════════════════════════════════════════════════════════════════════════
 * C9's SOURCES, SERVED — `declareEndpoint`, `listEndpoints`, `stopEndpoint`,
 * `resumeEndpoint`, `declareEndpointDocumentType`. G2681–G2692, 1 Oct 2026.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Over a real socket, against a real PostgreSQL, through the PRODUCTION gate
 * and the PRODUCTION substrate (neither `authorise` nor `substrate` is passed).
 * One seam is substituted, and only because §6 binds a credential through it:
 * the credential store, exactly as `credential-binding-served.test.ts` does.
 *
 * THE REDS THIS FILE EXISTS FOR, each witnessed:
 *   §1  a declaration mints invariant 10's record and PINS its id on the row
 *   §2  a body naming a tenant, a credential or an external id is a 400 —
 *       and the external id is MINTED, so two S3 sources never share one
 *   §3  a reserved host is a 422 that writes nothing
 *   §4  a caller without `configure_endpoint` is a 403 that writes nothing
 *   §5  another tenant's source is invisible and un-stoppable — and with RLS
 *       DISABLED underneath the same read it LEAKS, which is what makes the
 *       first half mean anything
 *   §6  the derived state walks the handoff: credential, delivery, stop,
 *       resume — and a lane that disagrees with its stop history publishes
 *       NOTHING
 *   §7  the pair: an incomplete mapping, an undeclared field, an unknown or
 *       FOREIGN type and a repeated pattern are refused; the complete one
 *       inherits the TYPE's fidelity
 *   §8  the database itself: no credential at declaration, no edit, no
 *       delete, no history rewrite, no fidelity column on a pair
 *   §9  every `required` field of both response schemas is present (K6)
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
import { custodyOver } from '../../server/data-plane/credential-store.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { fieldPathKey, parseFieldPath } from '../../model/field-path.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SOURCES_DB_NAME'] ?? runScopedName('reconcile_sources_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'
process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_entra_src'
const GLOBEX_DOOR = 'idc_globex_okta_src'
const ADMIN = 'usr_acme_src_admin'
const VIEWER = 'usr_acme_src_viewer'
const RUTH = 'usr_globex_src_admin'
const ROLE_ADMIN = 'rol_src_admin'
const ROLE_VIEWER = 'rol_src_viewer'
const ROLE_GLOBEX = 'rol_globex_src_admin'
const ADMIN_HANDLE = 'sx_srcadmin_7d2e19a0c4b84f3e9a51d0b6c8e2f417'
const VIEWER_HANDLE = 'sx_srcview_3b9f04e7a1c2486d8e5b70f2a9d3c618'
const RUTH_HANDLE = 'sx_srcruth_5e1a83c9d7f04b26a8c3e9105b7d2f64'
const ACME_KEY_HANDLE = 'b2c3d4e5f6071829'

const ACME_TYPE = 'dty_acme_invoice'
const ACME_EMPTY_TYPE = 'dty_acme_empty'
const GLOBEX_TYPE = 'dty_globex_invoice'
const TOTAL = fieldPathKey(mustParse(['invoice', 'total']))
const NUMBER = fieldPathKey(mustParse(['invoice', 'number']))

function mustParse(input: unknown) {
  const parsed = parseFieldPath(input)
  if (!parsed.ok) throw new Error('fixture field path did not parse')
  return parsed.path
}

const PIN = `SHA256:${'Zq'.repeat(21)}Z`
const SFTP_BODY = {
  label: 'Supplier SFTP',
  connection: {
    kind: 'sftp',
    host: 'sftp.supplier.example',
    port: 22,
    path: '/outbound/invoices',
    hostKeyFingerprint: PIN,
  },
}
const S3_BODY = {
  label: 'AP exports',
  connection: {
    kind: 's3',
    bucket: 'acme-ap-exports',
    keyPrefix: 'invoices/',
    region: 'ap-southeast-1',
    roleArn: 'arn:aws:iam::123456789012:role/reconcile-read',
  },
}

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* Top level, OUTSIDE every `describe`. `tests/ci/reachability-guards.test.ts`
   asserts this by AST walk. */
databaseRequiredUnderCi('the served source-declaration assertions', probe)

const custody = custodyOver(async () => ({ ok: true }))

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
            : {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(payload),
              }),
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
            body =
              typeof parsed === 'object' && parsed !== null
                ? (parsed as Record<string, unknown>)
                : undefined
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
  return asMigrator(async (q) => Number((((await q(sql, params)).rows[0]) as { n: unknown }).n))
}

async function seedSubstrate(): Promise<void> {
  const digests = [ADMIN_HANDLE, VIEWER_HANDLE, RUTH_HANDLE].map((h) => digestOfHandle(h))
  for (const d of digests) assert.notEqual(d, null, 'a seeded handle digested to nothing')
  await asMigrator(async (q) => {
    await q('BEGIN')
    for (const [id, label, account, ref] of [
      [DOOR, 'Acme Entra ID', 'acc_acme', 'acme-entra-src'],
      [GLOBEX_DOOR, 'Globex Okta', 'acc_globex', 'globex-okta-src'],
    ] as const) {
      await q(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status)
         VALUES ($1, 'oidc', $2, 'customer', NULL, $3,
                 'https://login.microsoftonline.com/sources-served/v2.0', $4, 'active')`,
        [id, label, account, ref],
      )
    }
    for (const [user, name, door] of [
      [ADMIN, 'Acme Administrator', DOOR],
      [VIEWER, 'Acme Viewer', DOOR],
      [RUTH, 'Ruth Iyer', GLOBEX_DOOR],
    ] as const) {
      await q(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@invalid', $2, 'active', $3)`,
        [user, name, door],
      )
    }
    for (const [tenant, role, label, key, klass] of [
      [ACME, ROLE_ADMIN, 'Administrator', 'administrator', 'administrator'],
      [ACME, ROLE_VIEWER, 'Viewer', 'viewer', 'administrator'],
      [GLOBEX, ROLE_GLOBEX, 'Administrator', 'administrator', 'administrator'],
    ] as const) {
      await q(
        `INSERT INTO tenant.role
           (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, $2, $3, $4, 1, $5, 'tenant', NULL, 'active')`,
        [tenant, role, label, key, klass],
      )
    }
    for (const [tenant, role, capability] of [
      [ACME, ROLE_ADMIN, CAPABILITIES.configureEndpoint],
      [ACME, ROLE_ADMIN, CAPABILITIES.viewEndpoint],
      [ACME, ROLE_ADMIN, CAPABILITIES.bindSecret],
      /* 🛑 THE VIEWER HOLDS THE READ AND NOT THE WRITE — §4 is the differential. */
      [ACME, ROLE_VIEWER, CAPABILITIES.viewEndpoint],
      [GLOBEX, ROLE_GLOBEX, CAPABILITIES.configureEndpoint],
      [GLOBEX, ROLE_GLOBEX, CAPABILITIES.viewEndpoint],
    ] as const) {
      await q(
        'INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)',
        [tenant, role, capability],
      )
    }
    for (const [tenant, id, user, role] of [
      [ACME, 'ras_src_admin', ADMIN, ROLE_ADMIN],
      [ACME, 'ras_src_viewer', VIEWER, ROLE_VIEWER],
      [GLOBEX, 'ras_src_ruth', RUTH, ROLE_GLOBEX],
    ] as const) {
      await q(
        `INSERT INTO tenant.role_assignment
           (tenant_id, id, user_id, role_id, role_version,
            granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 1, 'bootstrap', now(), NULL, NULL)`,
        [tenant, id, user, role],
      )
      await q(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 'bootstrap', now(), NULL, NULL)`,
        [tenant, id.replace('ras_', 'mem_'), user, role],
      )
    }
    await q(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_src_admin',  $1, $4, $7, $9,  $11, now(), now(), now() + interval '12 hours', NULL),
              ('ses_src_viewer', $2, $5, $7, $9,  $11, now(), now(), now() + interval '12 hours', NULL),
              ('ses_src_ruth',   $3, $6, $8, $10, $12, now(), now(), now() + interval '12 hours', NULL)`,
      [...digests, ADMIN, VIEWER, RUTH, DOOR, GLOBEX_DOOR, ACME, GLOBEX, ACME_HOST, GLOBEX_HOST],
    )
    await q('INSERT INTO tenant.tenant_key_handle (tenant_id, key_handle) VALUES ($1, $2)', [
      ACME,
      ACME_KEY_HANDLE,
    ])
    /* Document types are written by the migrator because NOTHING ELSE CAN —
     * `0180` grants `SELECT` alone and the writer is G110's seam. */
    await q(
      `INSERT INTO tenant.document_type
         (tenant_id, id, key, label, domain, expected_fidelity, carries_control_total)
       VALUES ($1, $2, 'ap.invoice', 'Supplier invoice', 'finance', 'tabular', 'never'),
              ($1, $3, 'ap.empty',   'No fields',        'finance', 'tabular', 'never'),
              ($4, $5, 'ap.invoice', 'Supplier invoice', 'finance', 'scanned', 'never')`,
      [ACME, ACME_TYPE, ACME_EMPTY_TYPE, GLOBEX, GLOBEX_TYPE],
    )
    for (const [tenant, type, key, path] of [
      [ACME, ACME_TYPE, TOTAL, '["invoice","total"]'],
      [ACME, ACME_TYPE, NUMBER, '["invoice","number"]'],
      [GLOBEX, GLOBEX_TYPE, TOTAL, '["invoice","total"]'],
    ] as const) {
      await q(
        `INSERT INTO tenant.document_field_spec
           (tenant_id, document_type_id, path_key, path, data_class, data_type,
            model_processing_allowed, confidence_floor)
         VALUES ($1, $2, $3, $4::jsonb, 'internal', 'text', false, NULL)`,
        [tenant, type, key, path],
      )
    }
    await q('COMMIT')
  })
}

function endpointsOf(res: Response): Array<Record<string, unknown>> {
  const list = res.body?.['endpoints']
  assert.ok(Array.isArray(list), `no endpoints array: ${res.text.slice(0, 300)}`)
  return list as Array<Record<string, unknown>>
}

const SOURCE_REQUIRED = [
  'endpointId',
  'label',
  'direction',
  'state',
  'connection',
  'declaredAt',
  'credentialBoundAt',
  'lastArrivalAt',
  'stoppedAt',
  'documentTypes',
] as const
const PAIR_REQUIRED = ['pairId', 'match', 'documentTypeId', 'expectedFidelity', 'mappedFields'] as const

describe('C9 sources over HTTP, through the production gate', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let origin: string
  let sftpId = ''
  let s3Id = ''
  let globexId = ''

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    plane = await startDataPlane({ poolMax: 4, credentialCustody: custody })
    origin = plane.url
  })

  after(async () => {
    await plane?.close()
  })

  it('§1 · declaring an SFTP source writes the source, its address and its lane, under ONE record', async () => {
    const res = await send(origin, '/v1/endpoints', { method: 'POST', body: SFTP_BODY })
    assert.equal(res.status, 201, `the lawful declaration was refused: ${res.status} ${res.text.slice(0, 400)}`)
    sftpId = String(res.body?.['endpointId'])
    assert.match(sftpId, /^end_[0-9a-f]{32}$/, 'the endpoint id is MINTED, never supplied')
    assert.equal(res.body?.['state'], 'waiting_on_credential')
    assert.equal(res.body?.['direction'], 'inbound')
    assert.equal(res.body?.['credentialBoundAt'], null)
    assert.deepEqual(res.body?.['connection'], {
      kind: 'sftp',
      host: 'sftp.supplier.example',
      port: 22,
      path: '/outbound/invoices',
      hostKeyFingerprint: PIN,
    })

    const pinned = await asMigrator(async (q) => {
      const r = await q(
        `SELECT e.declared_authorization_id, g.capability, g.resource_type, g.resource_id, g.subject_user_id
           FROM tenant.endpoint e
           JOIN tenant.authorization_grant g ON g.id = e.declared_authorization_id
          WHERE e.id = $1`,
        [sftpId],
      )
      return r.rows[0] as Record<string, unknown> | undefined
    })
    assert.ok(pinned !== undefined, 'the declaration names no authorisation record that exists — invariant 10')
    assert.equal(pinned['capability'], 'configure_endpoint')
    assert.equal(pinned['resource_type'], 'Endpoint')
    assert.equal(pinned['subject_user_id'], ADMIN)

    const lanes = await asMigrator(async (q) =>
      (await q('SELECT kind, enabled FROM tenant.intake_channel WHERE endpoint_id = $1', [sftpId])).rows,
    )
    assert.deepEqual(lanes, [{ kind: 'watched_drop', enabled: true }], 'exactly one live watched_drop lane')
  })

  it('§2 · the S3 external id is MINTED and unique; a body cannot carry one, a tenant or a credential', async () => {
    const a = await send(origin, '/v1/endpoints', { method: 'POST', body: S3_BODY })
    assert.equal(a.status, 201, a.text.slice(0, 400))
    s3Id = String(a.body?.['endpointId'])
    const b = await send(origin, '/v1/endpoints', {
      method: 'POST',
      body: { ...S3_BODY, label: 'AP exports, second' },
    })
    assert.equal(b.status, 201, b.text.slice(0, 400))
    const extA = (a.body?.['connection'] as Record<string, unknown>)['externalId']
    const extB = (b.body?.['connection'] as Record<string, unknown>)['externalId']
    assert.match(String(extA), /^ext_[0-9a-f]{32}$/)
    assert.notEqual(extA, extB, 'two sources shared an external id — the confused deputy it exists to defeat')

    for (const [label, body] of [
      ['an external id', { ...S3_BODY, connection: { ...S3_BODY.connection, externalId: String(extA) } }],
      ['a tenant', { ...SFTP_BODY, tenantId: GLOBEX }],
      ['a credential reference', { ...SFTP_BODY, credentialRef: 'cred_00000000000000000000000000000000' }],
      ['a secret', { ...SFTP_BODY, connection: { ...SFTP_BODY.connection, password: 'hunter2' } }],
      ['an email source (R16)', { label: 'mail', connection: { kind: 'email', address: 'ap@acme.example' } }],
    ] as const) {
      const before = await count('SELECT count(*) AS n FROM tenant.endpoint')
      const res = await send(origin, '/v1/endpoints', { method: 'POST', body })
      assert.equal(res.status, 400, `a body carrying ${label} was not refused: ${res.status}`)
      assert.equal(await count('SELECT count(*) AS n FROM tenant.endpoint'), before, `${label}: a row was written`)
    }
  })

  it('§3 · a reserved host is a 422 that writes NOTHING (G2686)', async () => {
    const before = await count('SELECT count(*) AS n FROM tenant.endpoint')
    for (const host of ['169.254.169.254', '10.0.0.5', 'localhost', '::1']) {
      const res = await send(origin, '/v1/endpoints', {
        method: 'POST',
        body: { ...SFTP_BODY, connection: { ...SFTP_BODY.connection, host } },
      })
      assert.equal(res.status, 422, `${host}: ${res.status} ${res.text.slice(0, 200)}`)
      assert.match(res.text, /sftp_host_is_reserved/)
    }
    const unpinned = await send(origin, '/v1/endpoints', {
      method: 'POST',
      body: { ...SFTP_BODY, connection: { ...SFTP_BODY.connection, hostKeyFingerprint: 'accept-any' } },
    })
    assert.equal(unpinned.status, 422)
    assert.match(unpinned.text, /sftp_host_key_not_pinned/)
    assert.equal(await count('SELECT count(*) AS n FROM tenant.endpoint'), before)
    assert.equal(await count('SELECT count(*) AS n FROM tenant.intake_channel'), before)
  })

  it('§4 · a caller holding only `view_endpoint` reads, and is refused every act with nothing written', async () => {
    const list = await send(origin, '/v1/endpoints', { session: VIEWER_HANDLE })
    assert.equal(list.status, 200, list.text.slice(0, 300))
    assert.equal(endpointsOf(list).length, 3)

    const before = await count('SELECT count(*) AS n FROM tenant.endpoint')
    for (const [path, body] of [
      ['/v1/endpoints', SFTP_BODY],
      [`/v1/endpoints/${sftpId}/stop`, undefined],
      [`/v1/endpoints/${sftpId}/resume`, undefined],
      [
        `/v1/endpoints/${sftpId}/document-types`,
        { match: { kind: 'filename', value: 'a.csv' }, documentTypeId: ACME_TYPE, fieldMappings: [] },
      ],
    ] as const) {
      const res = await send(origin, path, { method: 'POST', session: VIEWER_HANDLE, body })
      assert.equal(res.status, 403, `${path}: ${res.status} ${res.text.slice(0, 200)}`)
    }
    assert.equal(await count('SELECT count(*) AS n FROM tenant.endpoint'), before)
    assert.equal(await count('SELECT count(*) AS n FROM tenant.endpoint_stop_event'), 0)
  })

  it('§5 · another tenant’s sources are invisible and cannot be stopped — and RLS is WHY', async () => {
    const g = await send(origin, '/v1/endpoints', {
      method: 'POST',
      session: RUTH_HANDLE,
      host: GLOBEX_HOST,
      body: { ...SFTP_BODY, label: 'Globex SFTP' },
    })
    assert.equal(g.status, 201, g.text.slice(0, 300))
    globexId = String(g.body?.['endpointId'])

    const acmeView = endpointsOf(await send(origin, '/v1/endpoints'))
    assert.equal(acmeView.some((e) => e['endpointId'] === globexId), false, 'acme saw globex’s source')
    const globexView = endpointsOf(await send(origin, '/v1/endpoints', { session: RUTH_HANDLE, host: GLOBEX_HOST }))
    assert.deepEqual(globexView.map((e) => e['endpointId']), [globexId])

    const stop = await send(origin, `/v1/endpoints/${sftpId}/stop`, {
      method: 'POST',
      session: RUTH_HANDLE,
      host: GLOBEX_HOST,
    })
    assert.equal(stop.status, 404, 'another tenant’s source must be indistinguishable from none')
    const pair = await send(origin, `/v1/endpoints/${sftpId}/document-types`, {
      method: 'POST',
      session: RUTH_HANDLE,
      host: GLOBEX_HOST,
      body: {
        match: { kind: 'filename', value: 'x.csv' },
        documentTypeId: GLOBEX_TYPE,
        fieldMappings: [{ sourceField: 'Amount', fieldPathKey: TOTAL }],
      },
    })
    assert.equal(pair.status, 404)
    assert.deepEqual(
      await asMigrator(async (q) =>
        (await q('SELECT enabled FROM tenant.intake_channel WHERE endpoint_id = $1', [sftpId])).rows,
      ),
      [{ enabled: true }],
      'globex switched acme’s lane',
    )

    /* 🛑 THE NEGATIVE CONTROL. The same read, with the policy taken away
     * underneath it, must LEAK — otherwise the isolation above could be a
     * `WHERE` somebody added rather than the database (`0001`'s discipline). */
    await asMigrator(async (q) => {
      await q('ALTER TABLE tenant.endpoint NO FORCE ROW LEVEL SECURITY')
      await q('ALTER TABLE tenant.endpoint DISABLE ROW LEVEL SECURITY')
    })
    try {
      const pool = await createAppPool(1)
      try {
        const leaked = await withTenantScope(pool, GLOBEX, async (tx) =>
          (await tx.query('SELECT id FROM tenant.endpoint', [])).rows.length,
        )
        assert.ok(leaked > 1, `with RLS disabled the read did NOT leak (${leaked}) — the control proves nothing`)
      } finally {
        await pool.end()
      }
    } finally {
      await asMigrator(async (q) => {
        await q('ALTER TABLE tenant.endpoint ENABLE ROW LEVEL SECURITY')
        await q('ALTER TABLE tenant.endpoint FORCE ROW LEVEL SECURITY')
      })
    }
  })

  it('§6 · row 24 — the state walks the handoff, and the stop is dated and reversible', async () => {
    const stateOf = async (): Promise<Record<string, unknown>> => {
      const one = endpointsOf(await send(origin, '/v1/endpoints')).find((e) => e['endpointId'] === sftpId)
      assert.ok(one !== undefined)
      return one
    }
    assert.equal((await stateOf())['state'], 'waiting_on_credential')

    const bind = await send(origin, `/v1/endpoints/${sftpId}/credential`, {
      method: 'PUT',
      body: { secretValue: 'source-secret-6c1f' },
    })
    assert.equal(bind.status, 200, bind.text.slice(0, 300))
    const bound = await stateOf()
    assert.equal(bound['state'], 'waiting_on_first_delivery')
    assert.equal(typeof bound['credentialBoundAt'], 'string')
    assert.equal(JSON.stringify(bound).includes('source-secret-6c1f'), false, 'the credential was published')

    /* A delivery — written by the migrator, because no connector exists. */
    await asMigrator(async (q) => {
      const lane = (await q('SELECT id FROM tenant.intake_channel WHERE endpoint_id = $1', [sftpId]))
        .rows[0] as { id: string }
      await q(
        `INSERT INTO tenant.arrival
           (tenant_id, id, channel_id, channel_kind, endpoint_id, authorization_id, arrived_at, verdict_kind)
         VALUES ($1, 'arv_src_1', $2, 'watched_drop', $3, 'agr_standing', now(), 'refused')`,
        [ACME, lane.id, sftpId],
      )
    })
    const delivered = await stateOf()
    assert.equal(delivered['state'], 'delivered', 'a refused arrival still ends the wait — the source sent something')
    assert.equal(typeof delivered['lastArrivalAt'], 'string')

    const stop = await send(origin, `/v1/endpoints/${sftpId}/stop`, { method: 'POST' })
    assert.equal(stop.status, 200, stop.text.slice(0, 300))
    assert.equal(stop.body?.['state'], 'stopped')
    const stoppedAt = stop.body?.['stoppedAt']
    assert.equal(typeof stoppedAt, 'string')

    const again = await send(origin, `/v1/endpoints/${sftpId}/stop`, { method: 'POST' })
    assert.equal(again.status, 200)
    assert.equal(again.body?.['stoppedAt'], stoppedAt, 'a second stop moved the date of the first')

    const resume = await send(origin, `/v1/endpoints/${sftpId}/resume`, { method: 'POST' })
    assert.equal(resume.status, 200)
    assert.equal(resume.body?.['state'], 'delivered', 'the deliveries stayed where they were')
    assert.equal(resume.body?.['stoppedAt'], null)

    const history = await asMigrator(async (q) =>
      (
        await q(
          `SELECT ev.kind, g.capability FROM tenant.endpoint_stop_event ev
             JOIN tenant.authorization_grant g ON g.id = ev.authorization_id
            WHERE ev.endpoint_id = $1 ORDER BY ev.at, ev.id`,
          [sftpId],
        )
      ).rows,
    )
    assert.deepEqual(
      history,
      [
        { kind: 'stopped', capability: 'configure_endpoint' },
        { kind: 'resumed', capability: 'configure_endpoint' },
      ],
      'the stop and the resume are BOTH kept, each under its own record — reversible and dated',
    )
    assert.equal(await count('SELECT count(*) AS n FROM tenant.arrival WHERE endpoint_id = $1', [sftpId]), 1)

    /* 🛑 THE LANE AND ITS HISTORY MUST AGREE (G2684). Flip the lane behind the
     * history's back: the list publishes NOTHING rather than either half. */
    await asMigrator((q) => q('UPDATE tenant.intake_channel SET enabled = false WHERE endpoint_id = $1', [sftpId]))
    const disagree = await send(origin, '/v1/endpoints')
    assert.equal(disagree.status, 500, `a lane disagreeing with its history was published: ${disagree.text.slice(0, 200)}`)
    await asMigrator((q) => q('UPDATE tenant.intake_channel SET enabled = true WHERE endpoint_id = $1', [sftpId]))
    assert.equal((await send(origin, '/v1/endpoints')).status, 200)
  })

  it('§7 · rows 6, 11, 14 — a pair is complete or refused, and inherits the TYPE’s fidelity', async () => {
    const path = `/v1/endpoints/${s3Id}/document-types`
    const FULL = [
      { sourceField: 'Amount', fieldPathKey: TOTAL },
      { sourceField: 'Invoice No', fieldPathKey: NUMBER },
    ]
    const post = (body: unknown) => send(origin, path, { method: 'POST', body })
    const pairs = () => count('SELECT count(*) AS n FROM tenant.endpoint_document_type')

    for (const [want, body] of [
      ['mapping_incomplete', { match: { kind: 'path_prefix', value: 'invoices/' }, documentTypeId: ACME_TYPE, fieldMappings: FULL.slice(0, 1) }],
      ['mapping_names_an_undeclared_field', { match: { kind: 'path_prefix', value: 'invoices/' }, documentTypeId: ACME_TYPE, fieldMappings: [...FULL, { sourceField: 'X', fieldPathKey: 'k1:x/' }] }],
      ['document_type_declares_no_fields', { match: { kind: 'path_prefix', value: 'invoices/' }, documentTypeId: ACME_EMPTY_TYPE, fieldMappings: [] }],
      ['match_value_invalid', { match: { kind: 'filename', value: 'a/b.csv' }, documentTypeId: ACME_TYPE, fieldMappings: FULL }],
    ] as const) {
      const res = await post(body)
      assert.equal(res.status, 422, `${want}: ${res.status} ${res.text.slice(0, 200)}`)
      assert.match(res.text, new RegExp(want))
    }
    for (const typeId of ['dty_nowhere', GLOBEX_TYPE]) {
      const res = await post({ match: { kind: 'path_prefix', value: 'invoices/' }, documentTypeId: typeId, fieldMappings: FULL })
      assert.equal(res.status, 422, `${typeId}: ${res.status}`)
      assert.match(res.text, /document_type_unknown/, 'another tenant’s type must be the same answer as no type')
    }
    assert.equal(await pairs(), 0, 'a refused pair wrote a row')

    const ok = await post({ match: { kind: 'path_prefix', value: 'invoices/' }, documentTypeId: ACME_TYPE, fieldMappings: FULL })
    assert.equal(ok.status, 201, ok.text.slice(0, 300))
    assert.equal(ok.body?.['expectedFidelity'], 'tabular', 'row 11: the fidelity is the TYPE’s')
    assert.equal(ok.body?.['mappedFields'], 2)
    for (const k of PAIR_REQUIRED) assert.ok(ok.body !== undefined && k in ok.body, `pair lacks required \`${k}\``)

    const dup = await post({ match: { kind: 'path_prefix', value: 'invoices/' }, documentTypeId: ACME_TYPE, fieldMappings: FULL })
    assert.equal(dup.status, 422)
    assert.match(dup.text, /pattern_already_paired/)
    assert.equal(await pairs(), 1)

    /* Row 11 again, from the other side: the TYPE changes and every pair follows. */
    await asMigrator((q) => q("UPDATE tenant.document_type SET expected_fidelity = 'structured' WHERE id = $1", [ACME_TYPE]))
    const listed = endpointsOf(await send(origin, '/v1/endpoints')).find((e) => e['endpointId'] === s3Id)
    const listedPairs = listed?.['documentTypes'] as Array<Record<string, unknown>>
    assert.equal(listedPairs[0]?.['expectedFidelity'], 'structured')
  })

  it('§8 · the database refuses what the handlers never attempt', async () => {
    const pool = await createAppPool(1)
    try {
      for (const [label, sql] of [
        [
          'declare with a credential',
          `INSERT INTO tenant.endpoint (tenant_id, id, label, direction, connection_kind,
             declared_at, declared_authorization_id, credential_ref, credential_bound_at,
             credential_bound_authorization_id)
           VALUES ('${ACME}', 'end_smuggle', 'x', 'inbound', 'sftp', now(), 'agr_x',
                   'cred_00000000000000000000000000000000', now(), 'agr_x')`,
        ],
        ['edit a label', `UPDATE tenant.endpoint SET label = 'renamed' WHERE id = '${sftpId}'`],
        ['delete a source', `DELETE FROM tenant.endpoint WHERE id = '${sftpId}'`],
        ['edit an address', `UPDATE tenant.endpoint_sftp SET host = 'evil.example' WHERE endpoint_id = '${sftpId}'`],
        ['rewrite a stop', `UPDATE tenant.endpoint_stop_event SET at = now() - interval '1 year'`],
        ['erase a stop', `DELETE FROM tenant.endpoint_stop_event`],
        ['re-point a lane', `UPDATE tenant.intake_channel SET endpoint_id = 'end_other' WHERE endpoint_id = '${sftpId}'`],
        ['edit a mapping', `UPDATE tenant.endpoint_field_mapping SET source_field = 'x'`],
        ['declare a field', `INSERT INTO tenant.document_field_spec (tenant_id, document_type_id, path_key, path, data_class, data_type, model_processing_allowed) VALUES ('${ACME}', '${ACME_TYPE}', 'k1:y/', '["y"]', 'public', 'text', true)`],
      ] as const) {
        const outcome = await withTenantScope(pool, ACME, async (tx) => {
          try {
            await tx.query(sql, [])
            return 'performed'
          } catch (err) {
            return String((err as { message?: unknown }).message)
          }
        }).catch((err: unknown) => String((err as { message?: unknown }).message))
        assert.match(outcome, /permission denied/, `the app role could ${label}: ${outcome}`)
      }
    } finally {
      await pool.end()
    }

    /* An S3 address on an SFTP source is UNREPRESENTABLE, even for the migrator. */
    const crossed = await asMigrator(async (q) => {
      try {
        await q(
          `INSERT INTO tenant.endpoint_s3 (tenant_id, endpoint_id, bucket, key_prefix, region, role_arn, external_id)
           VALUES ($1, $2, 'b-b-b', '', 'ap-southeast-1', 'arn:aws:iam::123456789012:role/x', 'ext_${'0'.repeat(32)}')`,
          [ACME, sftpId],
        )
        return 'accepted'
      } catch (err) {
        return String((err as { code?: unknown }).code)
      }
    })
    assert.equal(crossed, '23503', 'an S3 address attached to an SFTP source — the discriminant pin did not hold')

    /* Row 11 is an ABSENCE: no fidelity on a pair. */
    const fidelityColumns = await count(
      `SELECT count(*) AS n FROM information_schema.columns
        WHERE table_schema = 'tenant' AND table_name IN ('endpoint_document_type', 'endpoint_field_mapping')
          AND column_name LIKE '%fidelity%'`,
    )
    assert.equal(fidelityColumns, 0, 'a pair grew its own fidelity — the type is the one home (G2690)')
  })

  it('§9 · K6 — every `required` field of `SourceEndpoint` is present on both kinds', async () => {
    const list = endpointsOf(await send(origin, '/v1/endpoints'))
    assert.ok(list.length >= 2)
    for (const e of list) {
      for (const k of SOURCE_REQUIRED) assert.ok(k in e, `\`${String(e['endpointId'])}\` lacks \`${k}\``)
      const c = e['connection'] as Record<string, unknown>
      const kindFields =
        c['kind'] === 'sftp'
          ? ['host', 'port', 'path', 'hostKeyFingerprint']
          : ['bucket', 'keyPrefix', 'region', 'roleArn', 'externalId']
      for (const k of kindFields) assert.ok(k in c, `${String(c['kind'])} connection lacks \`${k}\``)
    }
  })

  /* ================================================================== *
   * §10  `listDocumentTypes` — C3-15, G3941–G3943, 4 Oct 2026.
   *
   * 🛑 WITNESSED RED BEFORE THE MOUNT: with the operation declared and
   * `listDocumentTypes` absent from `server/data-plane/start.ts`, §10a
   * answered `404 !== 200` — the router's honest "not served" — because
   * nothing published `tenant.document_type.label` on any tier.
   * ================================================================== */

  it('§10a · the pick list names every type in scope by its LABEL, under ONE record', async () => {
    const res = await send(origin, '/v1/document-types', { session: VIEWER_HANDLE })
    assert.equal(res.status, 200, res.text.slice(0, 300))
    const types = res.body?.['documentTypes'] as Array<Record<string, unknown>>
    /* label order; a type with no fields is a type nevertheless. Fidelity is
     * compared for SHAPE only — §7 re-declares the invoice type's. */
    assert.deepEqual(
      types.map((t) => [t['documentTypeId'], t['label']]),
      [
        [ACME_EMPTY_TYPE, 'No fields'],
        [ACME_TYPE, 'Supplier invoice'],
      ],
    )
    for (const t of types) {
      assert.deepEqual(Object.keys(t).sort(), ['documentTypeId', 'expectedFidelity', 'label'])
      assert.match(String(t['expectedFidelity']), /^(structured|tabular|digital_text|scanned)$/)
    }

    const grant = await asMigrator(async (q) => {
      const r = await q(
        `SELECT capability, resource_id, subject_user_id
           FROM tenant.authorization_grant
          WHERE resource_type = 'DocumentType'
          ORDER BY issued_at DESC LIMIT 1`,
      )
      return r.rows[0] as Record<string, unknown> | undefined
    })
    assert.ok(grant !== undefined, 'the read minted no authorisation record — invariant 10')
    assert.equal(grant['capability'], 'view_endpoint')
    assert.equal(grant['resource_id'], null)
    assert.equal(grant['subject_user_id'], VIEWER)
  })

  it('§10b · another tenant’s types are invisible — and the request cannot name a tenant', async () => {
    const globex = await send(origin, '/v1/document-types', { session: RUTH_HANDLE, host: GLOBEX_HOST })
    assert.equal(globex.status, 200, globex.text.slice(0, 300))
    assert.deepEqual(
      (globex.body?.['documentTypes'] as Array<Record<string, unknown>>).map((t) => t['documentTypeId']),
      [GLOBEX_TYPE],
    )
    const smuggled = await send(origin, `/v1/document-types?tenantId=${GLOBEX}`)
    assert.equal(smuggled.status, 400, 'a tenant in the query string was not refused (invariant 1, G941)')
  })

  it('§10c · an unreadable fidelity refuses the whole list rather than publishing a guess', async () => {
    await asMigrator((q) =>
      q(`UPDATE tenant.document_type SET expected_fidelity = 'hologram' WHERE id = $1`, [ACME_EMPTY_TYPE]),
    )
    try {
      const res = await send(origin, '/v1/document-types')
      assert.equal(res.status, 500, res.text.slice(0, 300))
      assert.doesNotMatch(res.text, /hologram/, 'the refusal quoted the stored value')
    } finally {
      await asMigrator((q) =>
        q(`UPDATE tenant.document_type SET expected_fidelity = 'tabular' WHERE id = $1`, [ACME_EMPTY_TYPE]),
      )
    }
  })
})

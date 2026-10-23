/**
 * ════════════════════════════════════════════════════════════════════════════
 * `bindEndpointCredential`, SERVED — G2401 (THE OWNER'S) and G2402–G2410.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Over a real socket, against a real PostgreSQL, through the PRODUCTION gate
 * and the PRODUCTION substrate (neither `authorise` nor `substrate` is passed),
 * with exactly one seam substituted: the credential store, so the suite can
 * HOLD what a bind stored and then search every table for it. That is the
 * run queue's recording publisher, one service over — `tests/reachability.ts`'s
 * discipline is that a green run must not depend on an AWS account.
 *
 * THE REDS THIS FILE EXISTS FOR, each witnessed rather than assumed:
 *   §3  a caller without `bind_secret` is 403 and nothing is stored or written
 *   §4  NO TABLE IN EITHER SCHEMA CONTAINS THE CREDENTIAL — every relation in
 *       `tenant` and `public`, every row cast to text, searched for the value
 *   §5  another tenant's endpoint is a 404 and its row is untouched; a body
 *       naming a tenant, a secret or a key is a 400
 *   §6  a tenant with no key is REFUSED — never stored under any other key
 *   §7  the database itself refuses key material in `credential_ref`, and
 *       refuses the app role an INSERT and every other column
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
import {
  custodyOver,
  type CredentialWrite,
  type CredentialWriteOutcome,
} from '../../server/data-plane/credential-store.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_CREDENTIAL_BIND_DB_NAME'] ?? runScopedName('reconcile_credential_bind_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'
process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR = 'idc_acme_entra_cred'
const GLOBEX_DOOR = 'idc_globex_okta_cred'
const ADMIN = 'usr_acme_cred_admin'
const VIEWER = 'usr_acme_cred_viewer'
const RUTH = 'usr_globex_cred_admin'
const ROLE_ADMIN = 'rol_cred_admin'
const ROLE_VIEWER = 'rol_cred_viewer'
const ROLE_GLOBEX = 'rol_globex_cred_admin'
const ADMIN_HANDLE = 'sx_credadmin_4c1d93e0b7a24f6e8d05a1b3c9e7f201'
const VIEWER_HANDLE = 'sx_credview_9a3e07b5d1c84f29a6e0b4d7c3f81e52'
const RUTH_HANDLE = 'sx_credruth_2f8b6d40e9a1475cb3d7e05a1c96f8b3'

const ACME_KEY_HANDLE = 'a1b2c3d4e5f60718'
const ACME_SFTP = 'end_acme_sftp'
const ACME_S3 = 'end_acme_s3'
const GLOBEX_SFTP = 'end_globex_sftp'

/* Distinctive enough that a substring search over every row means something. */
const SECRET = 'hunter2-CRED-7f3a9c1e-d0be-4b52-a8e6-0c4f91d27b35'
const ROTATED = 'rotated-CRED-1e9b4f7a-62c0-4d38-bb51-73a2e8f0c6d4'

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* Top level, OUTSIDE every `describe`. `tests/ci/reachability-guards.test.ts`
   asserts this by AST walk. */
databaseRequiredUnderCi('the served credential-binding assertions', probe)

/* ------------------------------------------------------------ the store */

const written: CredentialWrite[] = []
let storeAnswer: CredentialWriteOutcome = { ok: true }
const custody = custodyOver(async (write) => {
  written.push(write)
  return storeAnswer
})

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
        method: opts.method ?? 'PUT',
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

interface EndpointRow {
  readonly credential_ref: string | null
  readonly credential_bound_authorization_id: string | null
}

async function endpointRow(id: string): Promise<EndpointRow | undefined> {
  return asMigrator(async (q) => {
    const r = await q(
      `SELECT credential_ref, credential_bound_authorization_id
         FROM tenant.endpoint WHERE id = $1`,
      [id],
    )
    return r.rows[0] as EndpointRow | undefined
  })
}

async function resetEndpoints(): Promise<void> {
  await asMigrator(async (q) => {
    await q(
      `UPDATE tenant.endpoint
          SET credential_ref = NULL, credential_bound_at = NULL,
              credential_bound_authorization_id = NULL`,
    )
  })
  written.length = 0
  storeAnswer = { ok: true }
}

const PATH = (endpointId: string) => `/v1/endpoints/${endpointId}/credential`

async function seedSubstrate(): Promise<void> {
  const digests = [ADMIN_HANDLE, VIEWER_HANDLE, RUTH_HANDLE].map((h) => digestOfHandle(h))
  for (const d of digests) assert.notEqual(d, null, 'a seeded handle digested to nothing')
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    for (const [id, label, account, ref] of [
      [DOOR, 'Acme Entra ID', 'acc_acme', 'acme-entra-cred'],
      [GLOBEX_DOOR, 'Globex Okta', 'acc_globex', 'globex-okta-cred'],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.identity_connection
           (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
            broker_issuer, broker_ref, status)
         VALUES ($1, 'oidc', $2, 'customer', NULL, $3,
                 'https://login.microsoftonline.com/credential-served/v2.0', $4, 'active')`,
        [id, label, account, ref],
      )
    }
    for (const [user, name, door] of [
      [ADMIN, 'Acme Administrator', DOOR],
      [VIEWER, 'Acme Viewer', DOOR],
      [RUTH, 'Ruth Iyer', GLOBEX_DOOR],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@invalid', $2, 'active', $3)`,
        [user, name, door],
      )
    }
    for (const [tenant, role, label, key, klass] of [
      [ACME, ROLE_ADMIN, 'Administrator', 'administrator', 'administrator'],
      [ACME, ROLE_VIEWER, 'Viewer', 'viewer', 'operator'],
      [GLOBEX, ROLE_GLOBEX, 'Administrator', 'administrator', 'administrator'],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.role
           (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, $2, $3, $4, 1, $5, 'tenant', NULL, 'active')`,
        [tenant, role, label, key, klass],
      )
    }
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
       VALUES ($1, $2, $5), ($1, $3, $6), ($4, $7, $5)`,
      [
        ACME,
        ROLE_ADMIN,
        ROLE_VIEWER,
        GLOBEX,
        CAPABILITIES.bindSecret,
        CAPABILITIES.viewException,
        ROLE_GLOBEX,
      ],
    )
    for (const [tenant, id, user, role] of [
      [ACME, 'ras_cred_admin', ADMIN, ROLE_ADMIN],
      [ACME, 'ras_cred_viewer', VIEWER, ROLE_VIEWER],
      [GLOBEX, 'ras_cred_ruth', RUTH, ROLE_GLOBEX],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant.role_assignment
           (tenant_id, id, user_id, role_id, role_version,
            granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 1, 'bootstrap', now(), NULL, NULL)`,
        [tenant, id, user, role],
      )
      await mig.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 'bootstrap', now(), NULL, NULL)`,
        [tenant, id.replace('ras_', 'mem_'), user, role],
      )
    }
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_cred_admin',  $1, $4, $7, $9,  $11, now(), now(), now() + interval '12 hours', NULL),
              ('ses_cred_viewer', $2, $5, $7, $9,  $11, now(), now(), now() + interval '12 hours', NULL),
              ('ses_cred_ruth',   $3, $6, $8, $10, $12, now(), now(), now() + interval '12 hours', NULL)`,
      [...digests, ADMIN, VIEWER, RUTH, DOOR, GLOBEX_DOOR, ACME, GLOBEX, ACME_HOST, GLOBEX_HOST],
    )
    /* ⚠️ `0340` (G2681) made the declaration columns `NOT NULL`, so a fixture
     * row carries them. They are not this suite's subject — the binding is. */
    await mig.query(
      `INSERT INTO tenant.endpoint
         (tenant_id, id, label, direction, connection_kind, declared_at, declared_authorization_id)
       VALUES ($1, $2, 'Acme SFTP', 'inbound', 'sftp', now(), 'agr_fixture'),
              ($1, $3, 'Acme S3',   'inbound', 's3',   now(), 'agr_fixture'),
              ($4, $5, 'Globex SFTP', 'inbound', 'sftp', now(), 'agr_fixture')`,
      [ACME, ACME_SFTP, ACME_S3, GLOBEX, GLOBEX_SFTP],
    )
    /* 🛑 ACME HAS A KEY AND GLOBEX DOES NOT — §6 is the second half. */
    await mig.query(
      'INSERT INTO tenant.tenant_key_handle (tenant_id, key_handle) VALUES ($1, $2)',
      [ACME, ACME_KEY_HANDLE],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('binding a source credential over HTTP, through the production gate', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let origin: string

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedSubstrate()
    /* 🛑 NO `authorise`, NO `substrate`. Only the store is substituted. */
    plane = await startDataPlane({ poolMax: 4, credentialCustody: custody })
    origin = plane.url
  })

  after(async () => {
    await plane?.close()
  })

  it('§1 · a holder of `bind_secret` binds, under the TENANT key, and only a handle is written', async () => {
    await resetEndpoints()
    const res = await send(origin, PATH(ACME_SFTP), { body: { secretValue: SECRET } })
    assert.equal(res.status, 200, `the lawful bind was refused: ${res.status} ${res.text.slice(0, 400)}`)
    assert.equal(res.body?.['endpointId'], ACME_SFTP)
    assert.equal(res.body?.['rotated'], false)
    assert.equal(typeof res.body?.['boundAt'], 'string')
    assert.equal(
      res.text.includes(SECRET),
      false,
      'the response ECHOED the credential. Nothing comes out of this operation.',
    )

    assert.equal(written.length, 1, 'exactly one store write')
    const w = written[0]
    assert.ok(w !== undefined)
    assert.equal(w.mode, 'create')
    assert.equal(w.value, SECRET)
    assert.equal(
      w.keyAlias,
      `alias/reconcile-local-data-tk-${ACME_KEY_HANDLE}`,
      'G2401: the credential must be encrypted under THIS tenant’s key, read from the row ' +
        'under this tenant’s scope — never a shared key and never another tenant’s.',
    )
    assert.match(w.secretName, /^reconcile-local-data-cred-[0-9a-f]{32}$/)
    assert.equal(
      /acme|ten_|end_/i.test(w.secretName),
      false,
      'the secret NAME carries a tenant or endpoint identifier, which `ListSecrets` would ' +
        'publish account-wide. It must carry an opaque random handle and nothing else.',
    )

    const row = await endpointRow(ACME_SFTP)
    assert.equal(row?.credential_ref, `cred_${w.secretName.slice(-32)}`)
    const grant = await asMigrator(async (q) => {
      const r = await q(
        'SELECT capability, tenant_id FROM tenant.authorization_grant WHERE id = $1',
        [row?.credential_bound_authorization_id],
      )
      return r.rows[0] as { capability: string; tenant_id: string } | undefined
    })
    assert.equal(
      grant?.capability,
      'bind_secret',
      'invariant 10: the binding names the authorisation it ran under, and that record ' +
        'exists and is for `bind_secret`',
    )
    assert.equal(grant?.tenant_id, ACME)
  })

  it('§2 · a second bind ROTATES under the same handle and cannot move the key', async () => {
    const before = await endpointRow(ACME_SFTP)
    assert.ok(before?.credential_ref, '§1 must have bound first')
    written.length = 0
    const res = await send(origin, PATH(ACME_SFTP), { body: { secretValue: ROTATED } })
    assert.equal(res.status, 200, res.text.slice(0, 300))
    assert.equal(res.body?.['rotated'], true)
    assert.equal(written[0]?.mode, 'rotate')
    assert.equal(written[0]?.secretName.slice(-32), before.credential_ref.slice(5))
    const after = await endpointRow(ACME_SFTP)
    assert.equal(after?.credential_ref, before.credential_ref, 'rotation re-pointed the reference')
    assert.notEqual(
      after?.credential_bound_authorization_id,
      before.credential_bound_authorization_id,
      'the row names the authorisation of the act now in force, not the first one',
    )
  })

  it('§3 · a caller without `bind_secret` is 403, and nothing is stored or written', async () => {
    await resetEndpoints()
    const res = await send(origin, PATH(ACME_S3), {
      session: VIEWER_HANDLE,
      body: { secretValue: SECRET },
    })
    assert.equal(res.status, 403, `a caller holding only view_exception bound a credential: ${res.status}`)
    assert.equal(written.length, 0, 'the gate refused and the store was written anyway')
    assert.equal((await endpointRow(ACME_S3))?.credential_ref, null)
  })

  it('§4 · NO TABLE, IN EITHER SCHEMA, CONTAINS THE CREDENTIAL — searched, not assumed', async () => {
    await resetEndpoints()
    const ok = await send(origin, PATH(ACME_S3), { body: { secretValue: SECRET } })
    assert.equal(ok.status, 200)
    const hits = await asMigrator(async (q) => {
      const relations = await q(
        `SELECT n.nspname AS s, c.relname AS t
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r' AND n.nspname IN ('tenant', 'public')
          ORDER BY 1, 2`,
      )
      const found: string[] = []
      const rels = relations.rows as Array<{ s: string; t: string }>
      assert.ok(rels.length > 40, `only ${rels.length} relations were searched — the sweep is vacuous`)
      for (const { s, t } of rels) {
        const r = await q(
          `SELECT count(*)::int AS n FROM "${s}"."${t}" x WHERE x::text LIKE '%' || $1 || '%'`,
          [SECRET],
        )
        if (((r.rows[0] as { n: number } | undefined)?.n ?? 0) > 0) found.push(`${s}.${t}`)
      }
      return found
    })
    assert.deepEqual(
      hits,
      [],
      `G2401 — "only a credentialRef lives in Postgres". The bound credential was found in: ` +
        `${hits.join(', ')}`,
    )
    /* Anti-vacuity: the sweep must be able to find a value that IS stored. */
    const control = await asMigrator(async (q) => {
      const r = await q(
        `SELECT count(*)::int AS n FROM tenant.tenant_key_handle x WHERE x::text LIKE '%' || $1 || '%'`,
        [ACME_KEY_HANDLE],
      )
      return (r.rows[0] as { n: number } | undefined)?.n ?? 0
    })
    assert.equal(control, 1, 'the search cannot find a value that is there, so its silence means nothing')
  })

  it('§5 · another tenant’s endpoint is a 404; a body naming a tenant, secret or key is a 400', async () => {
    await resetEndpoints()
    const cross = await send(origin, PATH(GLOBEX_SFTP), { body: { secretValue: SECRET } })
    assert.equal(
      cross.status,
      404,
      `acme's administrator reached globex's endpoint: ${cross.status} ${cross.text.slice(0, 300)}`,
    )
    assert.equal(written.length, 0, 'a cross-tenant bind wrote a secret')
    assert.equal((await endpointRow(GLOBEX_SFTP))?.credential_ref, null)

    for (const extra of [
      { tenantId: GLOBEX },
      { secretName: 'reconcile-local-data-cred-00000000000000000000000000000000' },
      { keyAlias: 'alias/reconcile-local-data-tk-ffffffffffffffff' },
      { credentialRef: 'cred_00000000000000000000000000000000' },
    ]) {
      const res = await send(origin, PATH(ACME_SFTP), { body: { secretValue: SECRET, ...extra } })
      assert.equal(
        res.status,
        400,
        `${JSON.stringify(Object.keys(extra))} in the body was not refused (${res.status}). ` +
          'Invariant 1: the tenant, the name and the key are derived, never read from a request; ' +
          'and ajv REJECTS rather than strips (G191).',
      )
    }
    assert.equal(written.length, 0)
  })

  it('§6 · a tenant with NO key is refused — never stored under another key', async () => {
    await resetEndpoints()
    const res = await send(origin, PATH(GLOBEX_SFTP), {
      session: RUTH_HANDLE,
      host: GLOBEX_HOST,
      body: { secretValue: SECRET },
    })
    assert.equal(res.status, 500, `a keyless tenant bound a credential: ${res.status} ${res.text.slice(0, 300)}`)
    assert.equal(res.body?.['code'], 'upstream_unavailable')
    assert.equal(written.length, 0, 'the store was written with no tenant key to write under')
    assert.equal((await endpointRow(GLOBEX_SFTP))?.credential_ref, null)
  })

  it('§6b · a store that refuses leaves NOTHING recorded as bound', async () => {
    await resetEndpoints()
    storeAnswer = { ok: false, refusal: 'store_rejected' }
    const res = await send(origin, PATH(ACME_SFTP), { body: { secretValue: SECRET } })
    assert.equal(res.status, 500)
    assert.equal(written.length, 1, 'the store was asked')
    assert.equal(
      (await endpointRow(ACME_SFTP))?.credential_ref,
      null,
      'the store refused and the endpoint claims a credential anyway',
    )
    storeAnswer = { ok: true }
  })

  it('§7 · the DATABASE refuses key material in the ref column, and the app role every other write', async () => {
    const material = await asMigrator(async (q) => {
      try {
        await q(
          `UPDATE tenant.endpoint SET credential_ref = $1, credential_bound_at = now(),
                  credential_bound_authorization_id = 'agr_x' WHERE id = $2`,
          [SECRET, ACME_S3],
        )
        return 'accepted'
      } catch (err) {
        return String((err as { constraint?: unknown }).constraint)
      }
    })
    assert.equal(
      material,
      'endpoint_credential_ref_is_a_handle',
      'a credential VALUE was storable in `credential_ref` — even as the migrator',
    )

    const pool = await createAppPool(1)
    try {
      for (const [label, sql] of [
        /* ⚠️ THIS ROW READ `INSERT INTO tenant.endpoint (tenant_id, id)` UNTIL
         * `0340` (G2681) GRANTED A COLUMN-LEVEL `INSERT` FOR `declareEndpoint`,
         * and it went RED on that grant — which is this control working. The
         * property it guarded is narrower than "no insert" and is unchanged:
         * NO PATH MAY CREATE AN ENDPOINT ALREADY CARRYING A CREDENTIAL
         * REFERENCE. So the row now names `credential_ref`, and the database
         * still refuses it by privilege. */
        [
          'INSERT a bound endpoint',
          `INSERT INTO tenant.endpoint
             (tenant_id, id, label, direction, connection_kind, declared_at,
              declared_authorization_id, credential_ref, credential_bound_at,
              credential_bound_authorization_id)
           VALUES ('${ACME}', 'end_minted', 'x', 'inbound', 'sftp', now(), 'agr_x',
                   'cred_00000000000000000000000000000000', now(), 'agr_x')`,
        ],
        ['UPDATE id', `UPDATE tenant.endpoint SET id = 'end_moved' WHERE id = '${ACME_S3}'`],
        ['DELETE', `DELETE FROM tenant.endpoint WHERE id = '${ACME_S3}'`],
        ['key handle', `UPDATE tenant.tenant_key_handle SET key_handle = 'ffffffffffffffff'`],
      ] as const) {
        const outcome = await withTenantScope(pool, ACME, async (tx) => {
          try {
            await tx.query(sql, [])
            return 'performed'
          } catch (err) {
            return String((err as { message?: unknown }).message)
          }
        }).catch((err: unknown) => String((err as { message?: unknown }).message))
        assert.match(
          outcome,
          /permission denied/,
          `the app role could ${label} on the custody tables: ${outcome}`,
        )
      }
    } finally {
      await pool.end()
    }
  })
})

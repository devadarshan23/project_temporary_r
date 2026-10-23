/**
 * ════════════════════════════════════════════════════════════════════════════
 * AN FDE BINDS A SOURCE CREDENTIAL UNDER A DELIVERY GRANT — SERVED.
 * G2591–G2593, applying G2407 (THE OWNER'S RULING, 1 Oct 2026): *"Full
 * staff-grant branch — decide() honours the delivery grant's whole class set
 * on every mounted operation."* And it delivers G2401's last clause: *"the FDE
 * binds a credential via a write path under G75's secret reach."*
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Over a real socket, a real PostgreSQL, the PRODUCTION gate and the
 * PRODUCTION substrate (neither `authorise` nor `substrate` is passed). One
 * seam substituted: the credential store, so the suite can hold what a bind
 * stored. `tests/http/credential-binding-served.test.ts`'s method exactly.
 *
 * TWO FDEs, BECAUSE A REVOKED GRANT REFUSES AT TWO DIFFERENT LAYERS:
 *   FDE_A holds NO membership. Its only authority is the grant, so a revoked
 *         grant fails the PER-REQUEST disjunct (`resolveAuthority()`, G729)
 *         and the answer is 401 — the session is no longer authenticated.
 *   FDE_B holds a membership in Acme (a platform person with a membership —
 *         which, invariant 8, confers NOTHING on the platform arm), so its
 *         session stays authenticated and every grant refusal is `decide()`'s,
 *         a 403. This is where "without a grant / revoked / expired → 403"
 *         is witnessed.
 *
 * 🛑 §2 IS THE COST THE OWNER ACCEPTED, SERVED: the same grant that carries
 *    `bind_secret` carries a tenant-data READ on another route.
 */
/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { databaseRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
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
  process.env['RECONCILE_STAFF_GRANT_ARM_DB_NAME'] ?? runScopedName('reconcile_staff_grant_arm_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'
process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const DOOR_PLATFORM = 'idc_1ch_entra_sga'
const DOOR_ACME = 'idc_acme_entra_sga'
const BROKER = 'https://login.microsoftonline.com/staff-grant-arm/v2.0'

const FDE_A = 'usr_fde_anika'
const FDE_B = 'usr_fde_bilal'
const VIEWER = 'usr_acme_sga_viewer'
const ROLE_NONE = 'rol_sga_nothing'
const ROLE_VIEWER = 'rol_sga_viewer'

const GRANT_A = 'tag_anika_acme_delivery'
const GRANT_B = 'tag_bilal_acme_delivery'
const GRANT_VIEWER = 'tag_viewer_acme_delivery'

const FDE_A_HANDLE = 'sx_sgafdea_3e1a90c4b7d2465f8a0c1e3b5d7f9a21'
const FDE_B_HANDLE = 'sx_sgafdeb_7b2c41e09d8a4f36b5e0a2c4d6e8f013'
const VIEWER_HANDLE = 'sx_sgaview_0c9e8d7b6a5f4e3d2c1b0a9f8e7d6c54'

const ACME_KEY_HANDLE = 'b2c3d4e5f6071829'
const ACME_SFTP = 'end_acme_sga_sftp'

const SECRET = 'fde-CRED-9d2e4b71-0a3c-4f58-b6e1-7c8d9f0a1b2e'

const probe = await probeDatabase()
const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

/* Top level, OUTSIDE every `describe`. `tests/ci/reachability-guards.test.ts`
   asserts this by AST walk. */
databaseRequiredUnderCi('the served staff-grant-arm assertions', probe)

const written: CredentialWrite[] = []
const storeAnswer: CredentialWriteOutcome = { ok: true }
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
  opts: { body?: unknown; session: string; method?: string },
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
          Host: ACME_HOST,
          ...sessionCookie(opts.session),
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

async function sql<T = Record<string, unknown>>(text: string, params: readonly unknown[] = []): Promise<T[]> {
  const mig = await migratorClient()
  try {
    return (await mig.query(text, params as unknown[])).rows as T[]
  } finally {
    await mig.end()
  }
}

async function credentialRef(): Promise<string | null> {
  const rows = await sql<{ credential_ref: string | null }>(
    'SELECT credential_ref FROM tenant.endpoint WHERE id = $1',
    [ACME_SFTP],
  )
  return rows[0]?.credential_ref ?? null
}

async function resetEndpoint(): Promise<void> {
  await sql(
    `UPDATE tenant.endpoint SET credential_ref = NULL, credential_bound_at = NULL,
            credential_bound_authorization_id = NULL WHERE id = $1`,
    [ACME_SFTP],
  )
  written.length = 0
}

const PATH = `/v1/endpoints/${ACME_SFTP}/credential`

async function seed(): Promise<void> {
  const digests = [FDE_A_HANDLE, FDE_B_HANDLE, VIEWER_HANDLE].map((h) => digestOfHandle(h))
  for (const d of digests) assert.notEqual(d, null, 'a seeded handle digested to nothing')
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', '1CloudHub Entra', 'platform', NULL, NULL, $3, '1ch-entra-sga', 'active'),
              ($2, 'oidc', 'Acme Entra ID',   'customer', NULL, 'acc_acme', $3, 'acme-entra-sga', 'active')`,
      [DOOR_PLATFORM, DOOR_ACME, BROKER],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, $1 || '@invalid', 'Anika FDE', 'active', $4),
              ($2, $2 || '@invalid', 'Bilal FDE', 'active', $4),
              ($3, $3 || '@invalid', 'Acme Viewer', 'active', $5)`,
      [FDE_A, FDE_B, VIEWER, DOOR_PLATFORM, DOOR_ACME],
    )
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'Nothing', 'nothing', 1, 'operator', 'tenant', NULL, 'active'),
              ($1, $3, 'Viewer',  'viewer',  1, 'operator', 'tenant', NULL, 'active')`,
      [ACME, ROLE_NONE, ROLE_VIEWER],
    )
    await mig.query(
      'INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)',
      [ACME, ROLE_VIEWER, CAPABILITIES.viewException],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'ras_sga_viewer', $2, $3, 1, 'bootstrap', now(), NULL, NULL)`,
      [ACME, VIEWER, ROLE_VIEWER],
    )
    /* FDE_B and the viewer hold memberships; FDE_A holds NONE. */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_sga_bilal', $2, $3, 'bootstrap', now(), NULL, NULL),
              ($1, 'mem_sga_viewer', $4, $5, 'bootstrap', now(), NULL, NULL)`,
      [ACME, FDE_B, ROLE_NONE, VIEWER, ROLE_VIEWER],
    )
    /**
     * Three delivery grants, each naming `secret`, `configuration` and
     * `tenant_data` — inside `MAX_GRANT_HOURS.delivery`. FDE_B's starts
     * REVOKED so §4 is "no grant" in the sense `decide()` sees.
     */
    await mig.query(
      `INSERT INTO tenant.tenant_access_grant
         (tenant_id, id, purpose, staff_user_id, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, 'delivery', $3, now(), now() + interval '7 days', NULL),
              ($1, $4, 'delivery', $5, now(), now() + interval '7 days', now()),
              ($1, $6, 'delivery', $7, now(), now() + interval '7 days', NULL)`,
      [ACME, GRANT_A, FDE_A, GRANT_B, FDE_B, GRANT_VIEWER, VIEWER],
    )
    for (const g of [GRANT_A, GRANT_B, GRANT_VIEWER]) {
      await mig.query(
        `INSERT INTO tenant.access_resource_grant (tenant_id, grant_id, resource)
         VALUES ($1, $2, 'secret'), ($1, $2, 'configuration'), ($1, $2, 'tenant_data')`,
        [ACME, g],
      )
    }
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_sga_a', $1, $4, $7, $9, $10, now(), now(), now() + interval '12 hours', NULL),
              ('ses_sga_b', $2, $5, $7, $9, $10, now(), now(), now() + interval '12 hours', NULL),
              ('ses_sga_v', $3, $6, $8, $9, $10, now(), now(), now() + interval '12 hours', NULL)`,
      [...digests, FDE_A, FDE_B, VIEWER, DOOR_PLATFORM, DOOR_ACME, ACME, ACME_HOST],
    )
    /* G2749, integrate/1oct-c: #515's `0340` (G2681) gave `tenant.endpoint`
     * five `NOT NULL` declaration columns, so the two-column seed #511 wrote
     * against the fork is refused `23502` on the merged tree. The row now
     * carries the declaration `credential-binding-served.test.ts` seeds. */
    await mig.query(
      `INSERT INTO tenant.endpoint
         (tenant_id, id, label, direction, connection_kind, declared_at, declared_authorization_id)
       VALUES ($1, $2, 'Acme SFTP', 'inbound', 'sftp', now(), 'agr_fixture')`,
      [ACME, ACME_SFTP],
    )
    await mig.query('INSERT INTO tenant.tenant_key_handle (tenant_id, key_handle) VALUES ($1, $2)', [
      ACME,
      ACME_KEY_HANDLE,
    ])
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('G2407 · an FDE under a live delivery grant, through the production gate', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let origin: string

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    plane = await startDataPlane({ poolMax: 4, credentialCustody: custody })
    origin = plane.url
  })

  after(async () => {
    await plane?.close()
  })

  it('§1 · the FDE BINDS — 200, the value in the store, and the record names the GRANT', async () => {
    await resetEndpoint()
    const res = await send(origin, PATH, { session: FDE_A_HANDLE, body: { secretValue: SECRET } })
    assert.equal(
      res.status,
      200,
      'G2401\'s last clause — "the FDE binds a credential" — is still undelivered. An FDE ' +
        'holding a LIVE delivery grant naming `secret` was refused at ' +
        `${res.status}: ${res.text.slice(0, 300)}`,
    )
    assert.equal(written.length, 1, 'exactly one store write')
    assert.equal(written[0]?.value, SECRET)
    assert.equal(written[0]?.keyAlias, `alias/reconcile-local-data-tk-${ACME_KEY_HANDLE}`)
    assert.ok(await credentialRef(), 'the endpoint names the bound credential')

    const record = await sql<{ id: string; org_class: string; capability: string; subject_user_id: string }>(
      `SELECT g.id, g.org_class, g.capability, g.subject_user_id
         FROM tenant.authorization_grant g
         JOIN tenant.endpoint e ON e.credential_bound_authorization_id = g.id
        WHERE e.id = $1`,
      [ACME_SFTP],
    )
    assert.equal(record[0]?.org_class, 'platform')
    assert.equal(record[0]?.capability, 'bind_secret')
    assert.equal(record[0]?.subject_user_id, FDE_A)
    const via = await sql<{ access_grant_id: string | null; assignment_id: string | null }>(
      'SELECT access_grant_id, assignment_id FROM tenant.authorization_grant_via WHERE grant_id = $1',
      [record[0]?.id],
    )
    assert.deepEqual(
      via,
      [{ access_grant_id: GRANT_A, assignment_id: null }],
      'invariant 10: the act\'s record must NAME the TenantAccessGrant it ran under',
    )
  })

  it('§2 · THE OWNER\'S ACCEPTED COST, SERVED — the same grant reads tenant data on another route', async () => {
    const res = await send(origin, '/v1/runs', { session: FDE_A_HANDLE, method: 'GET' })
    assert.equal(
      res.status,
      200,
      'G2407 opens the grant\'s WHOLE class set, and `listRuns` (`admit_source`, class ' +
        `\`tenant_data\`) was refused: ${res.status} ${res.text.slice(0, 200)}`,
    )
  })

  it('§3 · FDE_A\'s grant REVOKED — the session stops authenticating (401) and nothing is stored', async () => {
    await resetEndpoint()
    await sql('UPDATE tenant.tenant_access_grant SET revoked_at = now() WHERE id = $1', [GRANT_A])
    try {
      const res = await send(origin, PATH, { session: FDE_A_HANDLE, body: { secretValue: SECRET } })
      assert.equal(res.status, 401, `a revoked grant with no membership behind it: ${res.status}`)
      assert.equal(written.length, 0)
      assert.equal(await credentialRef(), null)
    } finally {
      await sql('UPDATE tenant.tenant_access_grant SET revoked_at = NULL WHERE id = $1', [GRANT_A])
    }
  })

  it('§4 · the SAME kind of FDE with no live grant is 403 — being staff is not access', async () => {
    await resetEndpoint()
    const res = await send(origin, PATH, { session: FDE_B_HANDLE, body: { secretValue: SECRET } })
    assert.equal(
      res.status,
      403,
      'a platform person with a membership and NO live grant: the membership confers ' +
        `nothing on the platform arm (invariant 8). Got ${res.status}: ${res.text.slice(0, 200)}`,
    )
    assert.equal(res.body?.['code'], 'capability_not_held')
    assert.equal(written.length, 0, 'the gate refused and the store was written anyway')
    assert.equal(await credentialRef(), null)
  })

  it('§5 · FDE_B: live → 200; revoked → 403; expired → 403 — re-asked on EVERY request', async () => {
    await resetEndpoint()
    await sql('UPDATE tenant.tenant_access_grant SET revoked_at = NULL WHERE id = $1', [GRANT_B])
    const live = await send(origin, PATH, { session: FDE_B_HANDLE, body: { secretValue: SECRET } })
    assert.equal(live.status, 200, `ANTI-VACUOUS: the live grant must bind: ${live.text.slice(0, 200)}`)

    await resetEndpoint()
    await sql('UPDATE tenant.tenant_access_grant SET revoked_at = now() WHERE id = $1', [GRANT_B])
    const revoked = await send(origin, PATH, { session: FDE_B_HANDLE, body: { secretValue: SECRET } })
    assert.equal(revoked.status, 403, `a REVOKED grant carried bind_secret: ${revoked.status}`)
    assert.equal(written.length, 0)

    await sql(
      `UPDATE tenant.tenant_access_grant
          SET revoked_at = NULL, granted_at = now() - interval '2 days',
              expires_at = now() - interval '1 hour'
        WHERE id = $1`,
      [GRANT_B],
    )
    const expired = await send(origin, PATH, { session: FDE_B_HANDLE, body: { secretValue: SECRET } })
    assert.equal(expired.status, 403, `an EXPIRED grant carried bind_secret: ${expired.status}`)
    assert.equal(written.length, 0)
    assert.equal(await credentialRef(), null)
  })

  it('§6 · a live grant that does NOT name `secret` does not carry `bind_secret`', async () => {
    await resetEndpoint()
    await sql(
      `UPDATE tenant.tenant_access_grant
          SET revoked_at = NULL, granted_at = now(), expires_at = now() + interval '7 days'
        WHERE id = $1`,
      [GRANT_B],
    )
    await sql(`DELETE FROM tenant.access_resource_grant WHERE grant_id = $1 AND resource = 'secret'`, [
      GRANT_B,
    ])
    const res = await send(origin, PATH, { session: FDE_B_HANDLE, body: { secretValue: SECRET } })
    assert.equal(res.status, 403, `a grant without \`secret\` bound a credential: ${res.status}`)
    assert.equal(written.length, 0)
  })

  it('§7 · a grant naming `statutory` FAILS WHOLE — invariant 8, "at any price"', async () => {
    await resetEndpoint()
    await sql(
      `INSERT INTO tenant.access_resource_grant (tenant_id, grant_id, resource) VALUES ($1, $2, 'secret'),
                                                                                       ($1, $2, 'statutory')
       ON CONFLICT DO NOTHING`,
      [ACME, GRANT_B],
    )
    const res = await send(origin, PATH, { session: FDE_B_HANDLE, body: { secretValue: SECRET } })
    assert.equal(
      res.status,
      403,
      'a grant naming `statutory` beside `secret` carried `bind_secret`. The grant is the unit ' +
        `someone approved, and it fails whole. Got ${res.status}`,
    )
    assert.equal(written.length, 0)
  })

  it('§8 · DIFFERENTIAL — a CUSTOMER principal holding a grant row gains nothing from it', async () => {
    await resetEndpoint()
    const res = await send(origin, PATH, { session: VIEWER_HANDLE, body: { secretValue: SECRET } })
    assert.equal(
      res.status,
      403,
      'the staff-grant branch leaked onto the CUSTOMER arm: a viewer holding only ' +
        `\`view_exception\` and a grant row bound a credential (${res.status})`,
    )
    assert.equal(written.length, 0)
  })

  it('§9 · `0310` — a via line carries EXACTLY ONE authority, and a grant in another tenant is unrepresentable', async () => {
    const [parent] = await sql<{ id: string }>(
      `SELECT g.id FROM tenant.authorization_grant g
         JOIN tenant.authorization_grant_via v ON v.tenant_id = g.tenant_id AND v.grant_id = g.id
        WHERE v.access_grant_id IS NOT NULL LIMIT 1`,
    )
    assert.ok(parent, '§1 must have written a grant-arm via line first')
    const attempt = async (cols: string, vals: readonly unknown[]): Promise<string> => {
      try {
        await sql(
          `INSERT INTO tenant.authorization_grant_via (tenant_id, grant_id, seq, ${cols})
           VALUES ($1, $2, 99, ${vals.map((_, i) => `$${i + 3}`).join(', ')})`,
          [ACME, parent.id, ...vals],
        )
        return 'inserted'
      } catch (err) {
        return (err as Error).message
      }
    }
    assert.match(await attempt('role_version', [1]), /authorization_grant_via_one_authority/, 'neither arm')
    assert.match(
      await attempt('assignment_id, role_id, role_version, access_grant_id', ['ras_x', 'rol_x', 1, GRANT_A]),
      /authorization_grant_via_one_authority/,
      'both arms at once',
    )
    assert.match(
      await attempt('access_grant_id', ['tag_nowhere']),
      /authorization_grant_via_access_grant_fk/,
      'a grant that does not exist in this tenant',
    )
  })
})

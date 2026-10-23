/**
 * THE INTERNAL EDGE — data plane → control plane, signed, bound and receipted.
 * G4301–G4310, 5 Oct 2026, applying THE OWNER'S rulings ("Full restore …";
 * "SigV4 task role").
 *
 * §1 holds the SigV4 signer to AWS's own published `get-vanilla` vector — a
 * signer that agrees only with itself is not evidence. §2 drives the STS
 * verifier against a FAKE STS that re-derives every signature it is sent with
 * the test secret, so a header the control plane added but the caller did not
 * sign is caught exactly as AWS would catch it. §3 runs the real control plane
 * over a real PostgreSQL with the real data-plane client. §4 is the local seam.
 * §5 is the fence.
 *
 * ⚠️ WHAT THIS CANNOT WITNESS: real STS. The deployed half is asserted by the
 * fake's agreement with the AWS vector in §1, not by a call to AWS — G108 keeps
 * the gate offline. `docs/build/deploy-handoff.md` owes the live probe.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { databaseRequiredUnderCi } from '../reachability.ts'
import { runScopedName } from '../run-scoped-db.ts'

const CONTROL_DB = runScopedName('reconcile_internal_edge')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')
const probe = await probeDatabase()
databaseRequiredUnderCi('the internal edge’s request-path assertions', probe)
const skip: false | string = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

import { amzDateOf, signV4 } from '../../server/data-plane/sigv4.ts'
import {
  controlPlaneClient,
  resolveControlPlaneClient,
  stsSigner,
  type ControlPlaneClient,
} from '../../server/data-plane/control-plane-client.ts'
import { STS_REFUSALS, stsVerifier, assumedRolePrefix } from '../../server/control-plane/sts-verifier.ts'
import { internalVerifierFromSts } from '../../server/control-plane/internal-auth.ts'
import { startControlPlane, type RunningControlPlane } from '../../server/control-plane/start.ts'
import { provisionControlPlane, seedTenancyRoster } from '../../server/control-plane/provision.ts'
import { mintTestToken } from '../../server/dev/test-token.ts'
import { STS_SIGNED_HEADERS_WITHOUT_TOKEN, internalRequestDigest, bodySha256 } from '../../server/http/internal-request.ts'
import { setLocalTestAuth } from './harness.ts'

const REGION = 'us-west-2'
const AUDIENCE = 'reconcile-control-test'
const ROLE_ARN = 'arn:aws:iam::000000000000:role/reconcile-staging-data-service-task'
const CREDS = { accessKeyId: 'AKIDINTERNALTEST01', secretAccessKey: 'internal-test-secret' }
const AZG = `azg_${'0'.repeat(32)}`

/* ------------------------------------------------------------ the fake STS */

interface FakeSts {
  readonly url: string
  hits: number
  arn: string
  close(): Promise<void>
}

/**
 * Re-derives the signature from the headers it RECEIVED, with the test secret,
 * against the host the caller signed — AWS's own check, minus AWS.
 */
async function startFakeSts(): Promise<FakeSts> {
  const state = { hits: 0, arn: 'arn:aws:sts::000000000000:assumed-role/reconcile-staging-data-service-task/abc' }
  const server: Server = createServer((req, res) => {
    let body = ''
    req.on('data', (c: Buffer) => (body += c.toString('utf8')))
    req.on('end', () => {
      state.hits++
      const auth = String(req.headers['authorization'] ?? '')
      const signedHeaders = /SignedHeaders=([^,]+)/.exec(auth)?.[1] ?? ''
      const headers: Record<string, string> = {}
      for (const name of signedHeaders.split(';')) {
        if (name === 'host' || name === 'x-amz-date' || name === 'x-amz-security-token') continue
        headers[name] = String(req.headers[name] ?? '')
      }
      const again = signV4({
        request: { method: 'POST', host: `sts.${REGION}.amazonaws.com`, path: '/', query: '', headers, body },
        credentials: CREDS,
        region: REGION,
        service: 'sts',
        amzDate: String(req.headers['x-amz-date'] ?? ''),
      })
      if (again.authorization !== auth) {
        res.writeHead(403).end('<ErrorResponse><Error><Code>SignatureDoesNotMatch</Code></Error></ErrorResponse>')
        return
      }
      res.writeHead(200, { 'content-type': 'text/xml' })
      res.end(`<GetCallerIdentityResponse><GetCallerIdentityResult><Arn>${state.arn}</Arn></GetCallerIdentityResult></GetCallerIdentityResponse>`)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  const a = server.address()
  if (a === null || typeof a === 'string') throw new Error('fake STS bound a pipe')
  return {
    url: `http://127.0.0.1:${a.port}/`,
    get hits() {
      return state.hits
    },
    set hits(v: number) {
      state.hits = v
    },
    get arn() {
      return state.arn
    },
    set arn(v: string) {
      state.arn = v
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  }
}

/* ======================================================================= §1 */

describe('§1 · the SigV4 signer agrees with AWS’s published vector', () => {
  it('1a · get-vanilla', () => {
    const s = signV4({
      request: { method: 'GET', host: 'example.amazonaws.com', path: '/', query: '', headers: {}, body: '' },
      credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' },
      region: 'us-east-1',
      service: 'service',
      amzDate: '20150830T123600Z',
    })
    assert.equal(
      s.authorization,
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    )
  })

  it('1b · an IAM role ARN maps to its assumed-role prefix, and nothing else does', () => {
    assert.equal(assumedRolePrefix(ROLE_ARN), 'arn:aws:sts::000000000000:assumed-role/reconcile-staging-data-service-task/')
    assert.equal(assumedRolePrefix('arn:aws:iam::000000000000:user/someone'), null)
  })
})

/* ======================================================================= §2 */

describe('§2 · the STS verifier — refusals before the network, and STS’s own answer', () => {
  let sts: FakeSts
  before(async () => {
    sts = await startFakeSts()
  })
  after(async () => {
    await sts.close()
  })

  const signerFor = (audience = AUDIENCE): ReturnType<typeof stsSigner> =>
    stsSigner({ region: REGION, audience, credentials: async () => CREDS })
  const verify = () => stsVerifier({ region: REGION, callerRoleArn: ROLE_ARN, audience: AUDIENCE, endpoint: sts.url })
  const presented = (h: Readonly<Record<string, string>>) => ({
    authorization: String(h['x-reconcile-sts-authorization']),
    amzDate: String(h['x-reconcile-sts-date']),
    securityToken: null,
  })

  it('2a · a signature over THIS digest and THIS audience is the configured role', async () => {
    const h = await signerFor()('d'.repeat(64))
    const v = await verify()(presented(h), 'd'.repeat(64))
    assert.equal(v.ok, true)
  })

  it('2b · a different digest is refused BY STS — the signature binds the request', async () => {
    const h = await signerFor()('d'.repeat(64))
    const v = await verify()(presented(h), 'e'.repeat(64))
    assert.deepEqual(v, { ok: false, refusal: STS_REFUSALS.stsRefused })
  })

  it('2c · a signature minted for another deployment’s audience is refused BY STS', async () => {
    const h = await signerFor('reconcile-control-prod')('d'.repeat(64))
    const v = await verify()(presented(h), 'd'.repeat(64))
    assert.deepEqual(v, { ok: false, refusal: STS_REFUSALS.stsRefused })
  })

  it('2d · G4303 — SignedHeaders that omit the digest are refused BEFORE anything is sent', async () => {
    const before = sts.hits
    const amzDate = amzDateOf(new Date())
    const bare = signV4({
      request: {
        method: 'POST',
        host: `sts.${REGION}.amazonaws.com`,
        path: '/',
        query: '',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
        body: 'Action=GetCallerIdentity&Version=2011-06-15',
      },
      credentials: CREDS,
      region: REGION,
      service: 'sts',
      amzDate,
    })
    const v = await verify()({ authorization: bare.authorization, amzDate, securityToken: null }, 'd'.repeat(64))
    assert.deepEqual(v, { ok: false, refusal: STS_REFUSALS.signedHeadersWrong })
    assert.equal(sts.hits, before, 'a signature that does not cover the digest reached STS')
    assert.notEqual(bare.signedHeaders, STS_SIGNED_HEADERS_WITHOUT_TOKEN)
  })

  it('2e · a stale date and a foreign region are refused before the network', async () => {
    const before = sts.hits
    const old = await stsSigner({ region: REGION, audience: AUDIENCE, credentials: async () => CREDS, now: () => new Date(Date.now() - 20 * 60_000) })('d'.repeat(64))
    assert.deepEqual(await verify()(presented(old), 'd'.repeat(64)), { ok: false, refusal: STS_REFUSALS.dateOutOfWindow })
    const east = await stsSigner({ region: 'us-east-1', audience: AUDIENCE, credentials: async () => CREDS })('d'.repeat(64))
    assert.deepEqual(await verify()(presented(east), 'd'.repeat(64)), { ok: false, refusal: STS_REFUSALS.foreignScope })
    assert.equal(sts.hits, before)
  })

  it('2f · G4307 — a valid signature by ANOTHER role in the same account is refused', async () => {
    const was = sts.arn
    sts.arn = 'arn:aws:sts::000000000000:assumed-role/reconcile-staging-control-service-task/abc'
    try {
      const h = await signerFor()('d'.repeat(64))
      assert.deepEqual(await verify()(presented(h), 'd'.repeat(64)), { ok: false, refusal: STS_REFUSALS.callerNotAllowed })
    } finally {
      sts.arn = was
    }
  })
})

/* ======================================================================= §3 */

async function createControlDatabase(): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-internal-edge-setup',
  })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [CONTROL_DB])
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await admin.end()
  }
}

async function controlAdminQuery(text: string, values: readonly unknown[] = []): Promise<Array<Record<string, unknown>>> {
  const { Client } = await loadPg()
  const c = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: CONTROL_DB,
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
  })
  await c.connect()
  try {
    return (await c.query(text, values)).rows as Array<Record<string, unknown>>
  } finally {
    await c.end()
  }
}

let keyN = 0
const freshKey = (): string => `edge-test-key-${process.pid}-${++keyN}-${Date.now()}`

describe('§3 · the control plane serves the internal operations, signed and bound', { skip }, () => {
  let sts: FakeSts
  let served: RunningControlPlane
  let client: ControlPlaneClient

  before(async () => {
    await createControlDatabase()
    await provisionControlPlane()
    await seedTenancyRoster()
    sts = await startFakeSts()
    served = await startControlPlane({
      internalVerifier: internalVerifierFromSts({ region: REGION, callerRoleArn: ROLE_ARN, audience: AUDIENCE, endpoint: sts.url }),
    })
    client = controlPlaneClient({
      baseUrl: served.url,
      signer: stsSigner({ region: REGION, audience: AUDIENCE, credentials: async () => CREDS }),
    })
  })
  after(async () => {
    await served?.close().catch(() => undefined)
    await sts?.close().catch(() => undefined)
  })

  it('3a · the roster is served as FACTS, one row per roster tenant', async () => {
    const r = await client.get('/internal/console/roster', { authorisationId: AZG, idempotencyKey: freshKey() })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    const tenants = (r.body as { tenants: Array<Record<string, unknown>> }).tenants
    assert.deepEqual(tenants.map((t) => t['tenantId']), ['ten_acme', 'ten_borealis', 'ten_cardinal'])
    const borealis = tenants.find((t) => t['tenantId'] === 'ten_borealis')
    assert.equal(borealis?.['completedSteps'], 4)
    assert.equal((borealis?.['forced'] as unknown[]).length, 1)
  })

  it('3b · one tenant’s onboarding facts, and an unknown tenant is an ANSWER, not an error', async () => {
    const r = await client.get('/internal/console/tenants/ten_cardinal/onboarding', { authorisationId: AZG, idempotencyKey: freshKey() })
    assert.deepEqual(r.body, { onRoster: true, completedSteps: 2, forced: [] })
    const n = await client.get('/internal/console/tenants/ten_nobody/onboarding', { authorisationId: AZG, idempotencyKey: freshKey() })
    assert.deepEqual(n.body, { onRoster: false, completedSteps: null, forced: [] })
  })

  it('3c · no credential, and the local CATALOGUE token, are both 401 on an internal operation', async () => {
    const bare = await fetch(`${served.url}/internal/console/roster`)
    assert.equal(bare.status, 401)
    setLocalTestAuth(false)
    const token = mintTestToken({ tenantId: 'ten_acme' })
    const asCatalogue = await fetch(`${served.url}/internal/console/roster`, { headers: { 'x-session': token } })
    assert.equal(asCatalogue.status, 401)
  })

  it('3d · a body that differs from the SIGNED body is 401 — the signature binds the content', async () => {
    const key = freshKey()
    const p = '/internal/console/tenants/ten_cardinal/onboarding/steps/sources_bound/force'
    const signedHash = bodySha256({ reason: 'the signed reason, long enough' })
    const digest = internalRequestDigest({ method: 'POST', path: p, idempotencyKey: key, authorisationId: AZG, contentSha256: signedHash })
    const proof = await stsSigner({ region: REGION, audience: AUDIENCE, credentials: async () => CREDS })(digest)
    const res = await fetch(`${served.url}${p}`, {
      method: 'POST',
      headers: {
        ...proof,
        'x-reconcile-content-sha256': signedHash,
        'idempotency-key': key,
        'x-platform-authorisation-id': AZG,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason: 'a DIFFERENT reason somebody substituted' }),
    })
    assert.equal(res.status, 401)
    const marks = await controlAdminQuery("SELECT 1 FROM onboarding_forced_step WHERE tenant_id = 'ten_cardinal'")
    assert.equal(marks.length, 0, 'a substituted body was written')
  })

  it('3e · a write is idempotent on its key, and the record advances ONCE', async () => {
    const call = { authorisationId: AZG, idempotencyKey: freshKey() }
    const p = '/internal/console/tenants/ten_cardinal/onboarding/steps/sources_bound/complete'
    const first = await client.post(p, undefined, call)
    assert.equal(first.status, 200, JSON.stringify(first.body))
    assert.equal((first.body as { outcome: string; completedSteps: number }).completedSteps, 3)
    const again = await client.post(p, undefined, call)
    assert.deepEqual(again.body, first.body, 'a replay of the same request must receive the first answer')
    const rows = await controlAdminQuery("SELECT completed_steps FROM onboarding_record WHERE tenant_id = 'ten_cardinal'")
    assert.equal(rows[0]?.['completed_steps'], 3)

    const reused = await client.post('/internal/console/tenants/ten_cardinal/onboarding/steps/pack_installed/complete', undefined, call)
    assert.equal(reused.status, 409)
  })

  it('3f · G4309 — every write receipt names the authorisation it ran under, and the receipt is append-only', async () => {
    const azg = `azg_${'a'.repeat(32)}`
    const key = freshKey()
    const out = await client.post(
      '/internal/console/tenants/ten_cardinal/onboarding/steps/first_run/force',
      { reason: 'customer asked for an early first run' },
      { authorisationId: azg, idempotencyKey: key },
    )
    assert.equal((out.body as { outcome: string }).outcome, 'ok', JSON.stringify(out.body))
    const receipt = await controlAdminQuery('SELECT authorisation_id, operation FROM internal_request_receipt WHERE idempotency_key = $1', [key])
    assert.deepEqual(receipt, [{ authorisation_id: azg, operation: 'forceInternalOnboardingStep' }])
    /* G4317 (`0051`) — and on the mark itself, the row a review reads. */
    const mark = await controlAdminQuery(
      "SELECT authorisation_id FROM onboarding_forced_step WHERE tenant_id = 'ten_cardinal' AND step = 'first_run'",
    )
    assert.deepEqual(mark, [{ authorisation_id: azg }])
    await assert.rejects(
      controlAdminQuery('DELETE FROM internal_request_receipt WHERE idempotency_key = $1', [key]),
      /APPEND-ONLY/,
    )
  })

  it('3h · G4312 — `system` is admitted on the roster read and REFUSED on every write', async () => {
    const read = await client.get('/internal/console/roster', { authorisationId: 'system', idempotencyKey: freshKey() })
    assert.equal(read.status, 200)
    const write = await client.post(
      '/internal/console/tenants/ten_cardinal/onboarding/steps/pack_installed/complete',
      undefined,
      { authorisationId: 'system', idempotencyKey: freshKey() },
    )
    assert.equal(write.status, 400, 'a system act with no person behind it advanced an onboarding record')
    const read2 = await client.get('/internal/console/tenants/ten_cardinal/onboarding', { authorisationId: 'system', idempotencyKey: freshKey() })
    assert.equal(read2.status, 400, 'only the roster read admits `system`')
  })

  it('3g · a model verdict travels as an ANSWER, for the data plane to map', async () => {
    const r = await client.post(
      '/internal/console/tenants/ten_acme/onboarding/steps/tenant_record/complete',
      undefined,
      { authorisationId: AZG, idempotencyKey: freshKey() },
    )
    assert.deepEqual(r.body, { outcome: 'verdict', verdict: 'step_already_done' })
  })
})

/* ======================================================================= §4 */

describe('§4 · the local seam — the same digest, a dev-key token, behind the flag', { skip }, () => {
  let served: RunningControlPlane
  before(async () => {
    await createControlDatabase()
    await provisionControlPlane()
    await seedTenancyRoster()
    setLocalTestAuth(true)
    served = await startControlPlane()
  })
  after(async () => {
    setLocalTestAuth(false)
    delete process.env['RECONCILE_INTERNAL_CONTROL_PLANE_URL']
    await served?.close().catch(() => undefined)
  })

  it('4a · a flag-on data-plane client is served by a flag-on control plane', async () => {
    process.env['RECONCILE_INTERNAL_CONTROL_PLANE_URL'] = served.url
    const c = await resolveControlPlaneClient()
    const r = await c.get('/internal/console/roster', { authorisationId: AZG, idempotencyKey: freshKey() })
    assert.equal(r.status, 200)
  })

  it('4b · flag OFF and nothing configured: the control plane serves the internal tier to NOBODY', async () => {
    setLocalTestAuth(false)
    const nobody = await startControlPlane()
    try {
      setLocalTestAuth(true)
      process.env['RECONCILE_INTERNAL_CONTROL_PLANE_URL'] = nobody.url
      const c = await resolveControlPlaneClient()
      const r = await c.get('/internal/console/roster', { authorisationId: AZG, idempotencyKey: freshKey() })
      assert.equal(r.status, 401, 'an unconfigured deployed control plane accepted a local token')
    } finally {
      await nobody.close()
    }
  })
})

/* ======================================================================= §5 */

describe('§5 · the fence — no plane STATICALLY imports the local internal token', () => {
  it('5a · only a dynamic import reaches `server/dev/internal-token.ts`', () => {
    const root = path.resolve(import.meta.dirname, '..', '..', 'server')
    const offenders: string[] = []
    for (const dir of ['data-plane', 'control-plane']) {
      for (const f of readdirSync(path.join(root, dir))) {
        if (!f.endsWith('.ts')) continue
        const src = readFileSync(path.join(root, dir, f), 'utf8')
        if (/from\s+['"][^'"]*internal-token\.ts['"]/.test(src)) offenders.push(`${dir}/${f}`)
      }
    }
    assert.deepEqual(offenders, [])
  })
})

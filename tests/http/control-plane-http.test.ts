/**
 * THE CONTROL PLANE'S OWN REFUSAL — because "the same flag, read the same way"
 * was true of the flag and false of everything downstream of it.
 *
 * 🛑 THE FINDING THIS FILE EXISTS FOR. `server/control-plane/start.ts` said, in
 * its own header, that the local flag was "the same flag, read the same way,
 * with the same equality against one literal" as the data plane's. The equality
 * was identical and the CONSEQUENCE was not: the data plane's flag-on branch
 * admitted holders of a signed token, and the control plane's returned
 * `() => ({ channel: 'local-development' })` — a reader that does not look at
 * the request at all. An adversarial read on 16 Aug 2026 confirmed it live:
 * `GET /catalogue/packs` with no credential whatsoever returned 200 and the
 * whole catalogue. One environment variable therefore gated a signed path on one
 * plane and a zero-credential path on the other, while the comments presented
 * them as one control.
 *
 * ⚠️ ONE FLAG MEANING TWO THINGS IS THE DEFECT, NOT THE MISSING CHECK. A reader
 * comparing the two files would have had to notice that two functions with the
 * same shape, the same name and the same guard did opposite things on the far
 * side of the guard. That is `docs/HANDOFF.md` §5.1 — a rule keyed on a
 * convenient landmark rather than on the property it protects — and the answer
 * is an assertion that names the property: FLAG ON MUST STILL MEAN A CREDENTIAL
 * WAS PRESENTED.
 *
 * ┌─ WHAT IS ASSERTED ─────────────────────────────────────────────────────────┐
 * │ 1 · A caller presenting NOTHING is refused, with the flag ON. The one that  │
 * │     was live.                                                              │
 * │ 2 · A caller presenting a garbage credential is refused, in every header a  │
 * │     careless implementation might have honoured.                           │
 * │ 3 · A caller presenting a validly signed local token IS served — the        │
 * │     positive control, without which every refusal above is satisfied by a   │
 * │     plane that serves nobody.                                              │
 * │ 4 · The same valid token is refused by a plane started WITHOUT the flag.    │
 * │ 5 · The token's TENANT CLAIM CHANGES NOTHING.               INVARIANT 3     │
 * │     The control plane derives no tenant scope, so two tokens naming two     │
 * │     different tenants must receive byte-identical catalogues. A control     │
 * │     plane whose answer varied by tenant would be reading tenant context.    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ IT SKIPS LOUDLY, like every other file here that needs a database, and the
 * skip is honest only while it is loud: a run in which this file skipped is not
 * evidence that the control plane refuses an unauthenticated caller.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { databaseRequiredUnderCi } from '../reachability.ts'

/* ------------------------------------------------------------------ *
 * Its OWN database, named before anything reads the variable.
 *
 * `server/control-plane/config.ts` resolves per call and never at import, the
 * same discipline `db/env.ts` follows, so setting these here is sufficient.
 * ------------------------------------------------------------------ */

const CONTROL_DB = process.env['RECONCILE_CONTROL_TEST_DB_NAME'] ?? runScopedName('reconcile_control_test')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

const { probeDatabase, describeTarget } = await import('../../db/env.ts')
const { loadPg } = await import('../../db/pg.ts')

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/control-plane-http.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS FILE CARRIES THE CONTROL PLANE\'S AUTHENTICATION. A run of the',
      '   suite in which it skipped is NOT evidence that a caller presenting no',
      '   credential is refused — which is exactly what this plane did until',
      '   16 Aug 2026, with the local flag on.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the control plane’s request-path assertions', probe)

/* ------------------------------------------------------------------ *
 * The seam.
 * ------------------------------------------------------------------ */

import { get, describeResponse, readProblem, setLocalTestAuth } from './harness.ts'
import { startControlPlane, type RunningControlPlane } from '../../server/control-plane/start.ts'
import { provisionControlPlane, seedCatalogue } from '../../server/control-plane/provision.ts'
import { mintTestToken } from '../../server/dev/test-token.ts'
import { runScopedName } from '../run-scoped-db.ts'

/** `control-plane.openapi.yaml`'s `servers[0].url` is `https://{ingestHost}` — no base path. */
const PACKS = '/catalogue/packs'

/**
 * Both headers `listEntitledPacks` marks `required: true` —
 * `components.parameters.SchemaVersion` (`{type: integer, minimum: 1}`) and
 * `components.parameters.EngineVersion`.
 *
 * ⚠️ BOTH ARE SENT ON EVERY REQUEST BELOW, INCLUDING THE ONES THAT MUST BE
 * REFUSED, AND THAT IS DELIBERATE. Authentication runs in `onRequest`, ahead of
 * validation (`server/http/app.ts`), so an unauthenticated request missing a
 * header would come back 401 either way and the assertion could not tell a
 * working authenticator from a strict validator. Every refusal below is
 * therefore a refusal of a request that is otherwise perfectly well-formed.
 */
const REQUIRED_HEADERS = { 'X-Schema-Version': '4', 'X-Engine-Version': '0.0.0-local' }

/** The local channel credential rides the same header the data plane's session does. */
const CHANNEL_HEADER = 'X-Session'

async function createControlDatabase(): Promise<void> {
  const { Client } = await loadPg()
  const admin = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-control-test-setup',
  })
  await admin.connect()
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [CONTROL_DB])
    // CREATE DATABASE cannot run inside a transaction block, hence no BEGIN.
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await admin.end()
  }
}

describe('the control plane over HTTP — flag on still means a credential was presented', { skip }, () => {
  let served: RunningControlPlane | undefined

  before(async () => {
    await createControlDatabase()
    await provisionControlPlane()
    await seedCatalogue()
    setLocalTestAuth(true)
    served = await startControlPlane()
  })

  after(async () => {
    setLocalTestAuth(false)
    if (served !== undefined) await served.close().catch(() => undefined)
  })

  /* ================================================================ *
   * 3 FIRST — THE POSITIVE CONTROL. Without it every refusal below is
   * satisfied by a plane that serves nobody.
   * ================================================================ */

  it('a validly signed local token IS served the catalogue', async () => {
    const token = mintTestToken({ tenantId: 'ten_acme' })
    const res = await get(served?.url ?? '', PACKS, {
      ...REQUIRED_HEADERS,
      [CHANNEL_HEADER]: token,
    })

    assert.equal(
      res.status,
      200,
      'a correctly signed local token was refused by a control plane started WITH ' +
        'RECONCILE_LOCAL_TEST_AUTH=1, so the refusals asserted below prove nothing — ' +
        `a plane that denies everybody denies unauthenticated callers too: ${describeResponse(res)}`,
    )
    const packs = res.body?.['packs']
    assert.ok(
      Array.isArray(packs) && packs.length > 0,
      'the catalogue came back empty, so "the unauthenticated caller received no ' +
        'packs" would be true of a plane that has no packs. The fixture in ' +
        '`server/control-plane/provision.ts` seeds three. ' +
        describeResponse(res),
    )
  })

  /* ================================================================ *
   * 1 AND 2 — NOTHING, AND GARBAGE, ARE BOTH REFUSED.
   * ================================================================ */

  it('a caller presenting NO credential is refused, with the flag ON', async () => {
    const res = await get(served?.url ?? '', PACKS, REQUIRED_HEADERS)

    assert.equal(
      res.status,
      401,
      'the control plane served a request carrying NO credential of any kind while ' +
        'RECONCILE_LOCAL_TEST_AUTH=1. This is the live finding of 16 Aug 2026: the ' +
        'flag-on reader returned a principal without looking at the request. "Flag ' +
        'on" must never mean "no credential presented" — on the data plane the same ' +
        `flag admits holders of a key; here it admitted everyone. ${describeResponse(res)}`,
    )
    assert.equal(
      readProblem(res).code,
      'session_invalid',
      "the refusal did not carry `session_invalid` from errors.yaml's closed enum",
    )
    assert.ok(
      !('packs' in (res.body ?? {})),
      'the refusal carried a `packs` key — it served the catalogue and labelled it a ' +
        'refusal',
    )
  })

  it('a garbage credential is refused in every header a careless reader might have honoured', async () => {
    const attempts: ReadonlyArray<readonly [string, Record<string, string>]> = [
      ['an empty session header', { [CHANNEL_HEADER]: '' }],
      ['a forged session token', { [CHANNEL_HEADER]: 'not-a-real-token' }],
      ['a bearer Authorization header', { Authorization: 'Bearer let-me-in' }],
      ['a SigV4-shaped Authorization header', { Authorization: 'AWS4-HMAC-SHA256 Credential=x/y' }],
      ['an X-Api-Key', { 'X-Api-Key': 'let-me-in' }],
      [
        'a token with a broken signature',
        { [CHANNEL_HEADER]: `${mintTestToken({ tenantId: 'ten_acme' })}x` },
      ],
    ]

    for (const [label, headers] of attempts) {
      const res = await get(served?.url ?? '', PACKS, { ...REQUIRED_HEADERS, ...headers })
      assert.equal(
        res.status,
        401,
        `${label}: the control plane served it. ${describeResponse(res)}`,
      )
      assert.ok(
        !('packs' in (res.body ?? {})),
        `${label}: the refusal carried a \`packs\` key`,
      )
    }
  })

  /* ================================================================ *
   * 5 — THE TENANT CLAIM IS DISCARDED.
   * ================================================================ */

  it('the token\'s tenant claim changes nothing — the control plane derives no tenant scope', async () => {
    const acme = await get(served?.url ?? '', PACKS, {
      ...REQUIRED_HEADERS,
      [CHANNEL_HEADER]: mintTestToken({ tenantId: 'ten_acme' }),
    })
    const globex = await get(served?.url ?? '', PACKS, {
      ...REQUIRED_HEADERS,
      [CHANNEL_HEADER]: mintTestToken({ tenantId: 'ten_globex' }),
    })

    assert.equal(acme.status, 200, describeResponse(acme))
    assert.equal(globex.status, 200, describeResponse(globex))
    assert.deepEqual(
      acme.body,
      globex.body,
      'two sessions naming two different tenants received DIFFERENT catalogues. ' +
        'INVARIANT 3: "the control plane publishes downward and never reads tenant ' +
        'data." The local token carries a tenant because the data plane needs one; ' +
        'this plane must DISCARD it. An answer that varies by tenant is tenant ' +
        'context, whatever the code calls the variable.',
    )
  })

  /* ================================================================ *
   * 4 — THE FLAG STILL GATES ACCEPTANCE.
   * ================================================================ */

  it('the same valid token is refused by a control plane started WITHOUT the flag', async () => {
    const token = mintTestToken({ tenantId: 'ten_acme' })

    setLocalTestAuth(false)
    const closed = await startControlPlane()
    try {
      const res = await get(closed.url, PACKS, { ...REQUIRED_HEADERS, [CHANNEL_HEADER]: token })
      assert.notEqual(
        res.status,
        404,
        'the plane started without the flag does not serve this route at all, so the ' +
          '4xx below would say nothing about the credential. The flag must gate ' +
          'ACCEPTANCE, not the existence of the API.',
      )
      assert.equal(
        res.status,
        401,
        'a locally minted token was ACCEPTED by a control plane started without ' +
          `RECONCILE_LOCAL_TEST_AUTH=1. ${describeResponse(res)}`,
      )
    } finally {
      await closed.close().catch(() => undefined)
      setLocalTestAuth(true)
    }
  })
})

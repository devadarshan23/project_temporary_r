/**
 * D1 OVER HTTP — `POST /context/resolve`, AND THE FIRST TIME A REAL SESSION
 * ROW HAS REACHED THIS REPOSITORY'S SERVING PATH.
 *
 * `tests/db/session-membership-selection.test.ts` is the shape this file
 * complements and its header is the one to read first: the recording pool, the
 * `max: 1` adversarial pool, the restrictive policy and the two negative
 * controls over the WRITE. **This file is about the same control reached the
 * way an attacker reaches it — over a socket, through a router, with a Host
 * header they chose.** The two are not duplicates: that one proves the
 * database refuses a write a handler got wrong; this one proves the handler
 * asks the right question in the first place, and that the session it asks
 * about is one it could not have been handed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ASSERTIONS, AND WHY EACH ONE IS NOT COVERED BY SOMETHING ELSE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   (a) AN UNKNOWN DIGEST IS 401 AND BINDS NOTHING. G160's policy makes a
 *       session row visible only to its own digest, so a handle nobody minted
 *       reaches no row — and the assertion that matters is not the status but
 *       that NO session row anywhere gained a tenant.
 *   (b) A REVOKED SESSION AND AN EXPIRED SESSION ARE EACH 401, SEPARATELY.
 *       `server/data-plane/session.ts` enforces two of `resolveSubject()`'s
 *       seven arms in the `WHERE` of one read, and these are those two. The
 *       other four are UNENFORCED and that file says so; this suite does not
 *       pretend otherwise by testing around them.
 *   (c) A HOST THE SESSION WAS NOT ISSUED ON IS 401 **AND REVOKES THE
 *       SESSION.** G180's `revoke` is a value and `model/serving-host.ts`
 *       names the lazy repair by name: *"implement the refusal WITHOUT the
 *       revocation — every mismatch test still passes, and a
 *       stolen-and-tossed session survives to be retried against the right
 *       host."* A test asserting only the 401 is that repair passing.
 *   (d) NO MEMBERSHIP, A REVOKED MEMBERSHIP AND AN EXPIRED MEMBERSHIP ARE
 *       THREE SEPARATE CASES WITH ONE WIRE ANSWER. `membership_absent` is one
 *       word on purpose — *"telling them apart would disclose that the tenant
 *       exists, that they were once in it, and roughly when that changed"* —
 *       and the EXPIRY case is the one to keep, because
 *       `docs/build/stateless-red-session.md` B1 writes the control with
 *       `revoked_at IS NULL` and stops there.
 *   (e) A HOST NOBODY REGISTERED RESOLVES TO NO TENANT. G179 — there is no
 *       pattern to fall back to, and a plane that guessed would serve a
 *       tenant the registry never named.
 *   (f) THE HAPPY PATH RETURNS A `TenantContext` AND BINDS THE ROW, and the
 *       tenant it binds is the HOST's — which is the whole of G210: *"the
 *       tenant is NOT an option this function picks from a list."*
 *   (g) THE SCOPE D1 OPENED CANNOT READ THE OTHER TENANT, **with the negative
 *       control that makes it mean something**: with RLS disabled the same
 *       read leaks both. Without (g)'s second half a green run means the read
 *       returned one tenant's rows for a reason nobody checked.
 *   (h) THE GUC DOES NOT SURVIVE THE CONNECTION RETURNING TO THE POOL — G101,
 *       asserted on the SAME backend by `pg_backend_pid()`, because on a
 *       `max: 1` pool the next checkout is forced onto the connection the
 *       scope just released.
 *
 * ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT DO: mint a session. There is no
 * sign-in path in this repository — `session.openapi.yaml`'s four operations
 * are declared and mounted nowhere — so every row here is inserted by the
 * migrator role, which is a FIXTURE and is named as one. A suite that quietly
 * minted one would be asserting against a substrate that does not exist.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'

import { databaseRequiredUnderCi } from '../reachability.ts'

import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { createAppPool, withTenantScope, type TenantPool } from '../../db/tenant-scope.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { parseServingHosts } from '../../server/data-plane/serving-hosts.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it — the named
 * flake `tests/db/tenant-projection.test.ts` documents at length.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_CONTEXT_DB_NAME'] ?? runScopedName('reconcile_context_test')

/* ------------------------------------------------------------------ *
 * THE REGISTRY, AND THE FLAG THAT MUST BE OFF.
 *
 * 🛑 `RECONCILE_LOCAL_TEST_AUTH` IS DELETED HERE AND THE DELETION IS AN
 * ASSERTION IN DISGUISE. With the flag set, `resolveSessionReader()` adds the
 * dev-token arm — and every 401 below would then also be provable by a plane
 * that accepted no token at all. The whole suite is about the DATABASE arm, so
 * the dev arm is not merely unused, it is absent from the process.
 * ------------------------------------------------------------------ */

delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'
const UNREGISTERED_HOST = 'attacker.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

/**
 * THE HANDLES. Opaque, high-entropy, and PRESENT ONLY IN THIS FILE — the row
 * stores `digestOfHandle(handle)` and never this value. `model/domain.ts`:
 * *"a database dump containing handles would be a session-hijack kit."*
 */
const HANDLE = {
  mei: 'sh_mei_0f2a1c93b8d54e67a01f8c2d3e4b5a69',
  ana: 'sh_ana_1a3b5c7d9e0f2a4b6c8d0e1f3a5b7c9d',
  raj: 'sh_raj_2b4d6f8a0c2e4a6c8e0a2c4e6a8c0e2a',
  lee: 'sh_lee_3c5e7a9b1d3f5a7c9e1b3d5f7a9c1e3b',
  gone: 'sh_gone_4d6f8b0c2e4a6c8e0b2d4f6a8c0e2b4d',
  stale: 'sh_stale_5e7a9c1d3f5b7d9f1a3c5e7b9d1f3a5c',
  /**
   * A session ISSUED ON a host the registry does not name — the row a tenant
   * leaves behind when its host is withdrawn from the published set. See
   * assertion (e): it is the only fixture that can reach the registry lookup
   * at all.
   */
  orphan: 'sh_orphan_7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b',
  /** Minted by nobody. The digest of this matches no row. */
  unknown: 'sh_unknown_6f8b0d2e4a6c8e0b2d4f6a8c0e2b4d6f',
} as const

interface SessionFixture {
  readonly id: string
  readonly handle: string
  readonly userId: string
  readonly issuedHost: string
  readonly expiresAt: string
  readonly revokedAt: string | null
}

const FUTURE = '2099-01-01T00:00:00Z'
const PAST = '2020-01-01T00:00:00Z'

const SESSIONS: readonly SessionFixture[] = [
  { id: 'ses_mei', handle: HANDLE.mei, userId: 'usr_ops_mei', issuedHost: ACME_HOST, expiresAt: FUTURE, revokedAt: null },
  { id: 'ses_ana', handle: HANDLE.ana, userId: 'usr_ops_ana', issuedHost: ACME_HOST, expiresAt: FUTURE, revokedAt: null },
  { id: 'ses_raj', handle: HANDLE.raj, userId: 'usr_ops_raj', issuedHost: ACME_HOST, expiresAt: FUTURE, revokedAt: null },
  { id: 'ses_lee', handle: HANDLE.lee, userId: 'usr_ops_lee', issuedHost: ACME_HOST, expiresAt: FUTURE, revokedAt: null },
  { id: 'ses_gone', handle: HANDLE.gone, userId: 'usr_ops_mei', issuedHost: ACME_HOST, expiresAt: FUTURE, revokedAt: PAST },
  { id: 'ses_stale', handle: HANDLE.stale, userId: 'usr_ops_mei', issuedHost: ACME_HOST, expiresAt: PAST, revokedAt: null },
  { id: 'ses_orphan', handle: HANDLE.orphan, userId: 'usr_ops_mei', issuedHost: UNREGISTERED_HOST, expiresAt: FUTURE, revokedAt: null },
]

interface MembershipFixture {
  readonly id: string
  readonly tenantId: string
  readonly userId: string
  readonly expiresAt: string | null
  readonly revokedAt: string | null
}

const MEMBERSHIPS: readonly MembershipFixture[] = [
  { id: 'mem_acme_mei', tenantId: ACME, userId: 'usr_ops_mei', expiresAt: null, revokedAt: null },
  /** A member of GLOBEX and of nothing else. The B1 attacker, in one row. */
  { id: 'mem_globex_ana', tenantId: GLOBEX, userId: 'usr_ops_ana', expiresAt: null, revokedAt: null },
  /** Was a member of ACME. RETAINED, not deleted. */
  { id: 'mem_acme_raj', tenantId: ACME, userId: 'usr_ops_raj', expiresAt: null, revokedAt: PAST },
  /** A partner-scoped membership in ACME that has EXPIRED but was never revoked. */
  { id: 'mem_acme_lee', tenantId: ACME, userId: 'usr_ops_lee', expiresAt: PAST, revokedAt: null },
]

/* ------------------------------------------------------------------ *
 * Reachability. A skipped test that says so is honest; a mocked database
 * asserting a refusal is a lie that will be believed.
 * ------------------------------------------------------------------ */

const probe = await probeDatabase()

if (!probe.ok) {
  console.error(
    [
      '',
      '='.repeat(78),
      '🛑 SKIPPED — tests/http/context-resolve.test.ts DID NOT RUN.',
      '',
      `   No PostgreSQL was reachable at ${describeTarget()}.`,
      `   Reason: ${probe.reason}`,
      '',
      '   THIS IS THE ONLY SUITE THAT DRIVES D1 OVER HTTP. A run in which it',
      '   skipped is NOT evidence that a session resolves, that a host binds a',
      '   tenant, or that a membership gates the binding.',
      '='.repeat(78),
      '',
    ].join('\n'),
  )
}

const skip: false | string = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the D1 context-resolution test', probe)

/* ------------------------------------------------------------------ *
 * A RAW HTTP CLIENT, AND `node:http` RATHER THAN `fetch` FOR ONE REASON.
 *
 * 🛑 THE `Host` HEADER IS THE SUBJECT OF HALF THIS FILE. undici treats it as a
 * forbidden header on some paths and derives it from the URL on others, so a
 * `fetch`-based helper could silently send `127.0.0.1:<port>` while the test
 * believed it had sent a tenant's hostname — and EVERY host assertion below
 * would then be passing against a value the test did not choose.
 * `tests/http/harness.ts` says the same thing about `X-Session`: *"A helper
 * that quietly added an `X-Session` would make the unauthenticated test pass
 * while the property was absent."*
 * ------------------------------------------------------------------ */

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function post(
  origin: string,
  path: string,
  opts: {
    host: string
    session?: string
    body: unknown
    /** Browser-set headers a page cannot forge — `Origin`, `Sec-Fetch-Site`. G3212. */
    headers?: Readonly<Record<string, string>>
  },
): Promise<Response> {
  const url = new URL(origin)
  const payload = JSON.stringify(opts.body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'POST',
        headers: {
          // Explicit, and the whole point of using this client.
          Host: opts.host,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...(opts.session === undefined ? {} : sessionCookie(opts.session)),
          ...(opts.headers ?? {}),
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
    req.end(payload)
  })
}

/**
 * The request D1 declares since G3006 (2 Oct 2026, THE OWNER'S): the session
 * on the COOKIE and nowhere else, and a CLOSED EMPTY body.
 *
 * ⚠️ THIS SENT `{ sessionToken: handle }` IN THE BODY AS WELL UNTIL THAT
 * RULING — *"the token in the body AND in the header"* — because the contract
 * demanded the credential twice. The cookie is `HttpOnly`, so no browser could
 * ever have built that body; a2 below now asserts the old body is REFUSED.
 */
function resolveContext(origin: string, host: string, handle: string): Promise<Response> {
  return post(origin, '/context/resolve', {
    host,
    session: handle,
    body: {},
  })
}

/* ------------------------------------------------------------------ *
 * Seeding. NEEDS the BYPASSRLS role, and that is the policies working rather
 * than an inconvenience — `reconcile_app` holds no INSERT on
 * `tenant.membership` at all, which is 0005's grant decision.
 * ------------------------------------------------------------------ */

async function seedRows(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')

    /**
     * 🛑 THE PERSON AND THE DOOR, ADDED 19 Sep 2026 — G299 — AND NOT ONE OF
     * THESE ROWS IS COSMETIC. Before that ruling this file seeded sessions for
     * four users who had no `user` row, because there was no `user` TABLE:
     * `resolveSubject()` could not be called, and `server/data-plane/session.ts`
     * recorded the consequence in its own header — *"FOUR ARMS ARE UNENFORCED:
     * a DISABLED PERSON and a DISABLED DIRECTORY both reach this plane today."*
     *
     * **`db/migrations/0009_identity_substrate.sql` landed the tables and the
     * reader now calls `resolveSubject()` with three rows**, so a session whose
     * person or directory is absent is refused — which is exactly the control
     * this slice exists to build, and which would have turned every assertion
     * below into a 401 for the wrong reason.
     *
     * ⚠️ EVERY USER HERE IS `active` AND THE CONNECTION IS `active`, SO THIS
     * FILE STILL TESTS WHAT IT ALWAYS TESTED. The disabled arms are witnessed
     * in `tests/http/identity-substrate-served.test.ts`, where they are the
     * subject rather than a confounder.
     */
    await mig.query(
      /* The broker handle — G304/G305. `oidc` is brokered, so a NULL pair is
       * `broker_unresolvable` and D1 would refuse every session here. */
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ('idc_acme_entra', 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL',
               'acme-entra', 'active')
       ON CONFLICT DO NOTHING`,
    )
    for (const userId of [...new Set(SESSIONS.map((s) => s.userId))]) {
      await mig.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@acme.invalid', $1, 'active', 'idc_acme_entra')
         ON CONFLICT DO NOTHING`,
        [userId],
      )
    }

    for (const m of MEMBERSHIPS) {
      await mig.query(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, 'rol_pack_ap_approver', 'usr_acme_admin', '2026-01-01T00:00:00Z', $4, $5)`,
        [m.tenantId, m.id, m.userId, m.expiresAt, m.revokedAt],
      )
    }
    for (const s of SESSIONS) {
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id,
            issued_host, authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, 'idc_acme_entra', NULL, $4,
                 '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', $5, $6)`,
        [s.id, digestOfHandle(s.handle), s.userId, s.issuedHost, s.expiresAt, s.revokedAt],
      )
    }
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/** Every session's bound tenant, read with the read exemption. */
async function boundTenants(): Promise<Record<string, string | null>> {
  const mig = await migratorClient()
  try {
    const res = await mig.query('SELECT id, tenant_id, revoked_at FROM tenant.session')
    const out: Record<string, string | null> = {}
    for (const row of res.rows as Array<Record<string, unknown>>) {
      out[String(row['id'])] = row['tenant_id'] === null ? null : String(row['tenant_id'])
    }
    return out
  } finally {
    await mig.end()
  }
}

async function revokedAtOf(sessionId: string): Promise<string | null> {
  const mig = await migratorClient()
  try {
    const res = await mig.query('SELECT revoked_at FROM tenant.session WHERE id = $1', [sessionId])
    const row = (res.rows as Array<Record<string, unknown>>)[0]
    const value = row === undefined ? null : row['revoked_at']
    return value === null || value === undefined ? null : String(value)
  } finally {
    await mig.end()
  }
}

/** Put every session back to unselected and unrevoked, so each test starts from mint state. */
async function resetSessions(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('UPDATE tenant.session SET tenant_id = NULL')
    for (const s of SESSIONS) {
      await mig.query('UPDATE tenant.session SET revoked_at = $2 WHERE id = $1', [s.id, s.revokedAt])
    }
  } finally {
    await mig.end()
  }
}

function problemCode(r: Response): unknown {
  return r.body?.['code']
}

describe('D1 over HTTP — the session, the host and the membership', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedRows()
    /**
     * ⚠️ `poolMax: 1` IS ADVERSARIAL ON PURPOSE, exactly as it is in
     * `tests/db/tenant-isolation.test.ts`: every scoped transaction is FORCED
     * onto the connection the previous one released, which is the condition
     * under which a session-level `SET` would leak.
     */
    plane = await startDataPlane({ poolMax: 1 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ---------------------------------------------------------------- *
   * (a) An unknown digest.
   * ---------------------------------------------------------------- */

  it('a · a handle nobody minted is 401 and binds no tenant anywhere', async () => {
    await resetSessions()
    const res = await resolveContext(plane.url, ACME_HOST, HANDLE.unknown)
    assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.text}`)
    assert.equal(problemCode(res), 'session_invalid')

    const bound = await boundTenants()
    assert.deepEqual(
      Object.values(bound).filter((t) => t !== null),
      [],
      'a request carrying a handle that matches no row bound a tenant to SOMETHING. ' +
        'G160 makes a session row visible only under its own digest, so there was no ' +
        'row for this request to reach — a binding here means the selection write ran ' +
        'outside the scope the digest opened.',
    )
  })

  /**
   * 🛑 a2 · A HANDLE OR A TENANT SMUGGLED INTO THE BODY IS A 400 AND BINDS
   *    NOTHING — G3211, applying G3006.
   *
   * ⚠️ THIS ASSERTION READ *"a body naming a DIFFERENT live session than the
   * credential is 401"* UNTIL 2 Oct 2026. It witnessed the two-channel
   * comparison `server/data-plane/context.ts` used to close a contract defect
   * with — the credential demanded twice. **The owner's ruling removed the
   * second channel**, so the property is no longer *"the two agree"*; it is
   * *"there is no second channel at all"*, and the contract's closed EMPTY
   * body is what holds it. A `sessionToken` naming ANOTHER live session is the
   * sharpest form of the old attack, and a `tenantId` is invariant 1's.
   */
  for (const [label, body] of [
    ['a handle naming ANOTHER live session', { sessionToken: HANDLE.ana }],
    ['the caller\'s OWN handle — the body the old contract REQUIRED', { sessionToken: HANDLE.mei }],
    ['a tenant — invariant 1', { tenantId: GLOBEX }],
  ] as const) {
    it(`a2 · ${label}, smuggled into the body, is 400 and binds nothing`, async () => {
      await resetSessions()
      const res = await post(plane.url, '/context/resolve', {
        host: ACME_HOST,
        session: HANDLE.mei,
        body,
      })
      assert.equal(
        res.status,
        400,
        'A BODY CARRYING A KEY THE CONTRACT DOES NOT DECLARE WAS NOT REFUSED. D1\'s body ' +
          'is a CLOSED EMPTY object (G3006) and G191 sets `removeAdditional: false`, so ' +
          'a smuggled key must be a 400 — stripping it would serve the request and leave ' +
          `no evidence anybody tried. Got ${res.status}: ${res.text}`,
      )
      assert.equal(res.body?.['code'], 'validation_failed')
      const bound = await boundTenants()
      assert.deepEqual(
        Object.values(bound).filter((t) => t !== null),
        [],
        'the refused request bound a tenant to something anyway.',
      )
    })
  }

  it('a3 · BASE CONTROL — the cookie alone, with the empty body, binds', async () => {
    /* 🛑 §5.6. Without this, a2 passes on a plane that refuses everybody — and
       a plane that refuses everybody is exactly what a body field no browser
       can populate produces. */
    await resetSessions()
    const res = await resolveContext(plane.url, ACME_HOST, HANDLE.mei)
    assert.equal(res.status, 200, `the cookie-only request was refused: ${res.status} ${res.text}`)
    assert.equal((await boundTenants())['ses_mei'], ACME)

    /* AND IT IS IDEMPOTENT ON THE SAME HOST — `frontend/src/api/context.ts`
       calls D1 on every boot rather than tracking whether it already did. */
    const again = await resolveContext(plane.url, ACME_HOST, HANDLE.mei)
    assert.equal(again.status, 200, `a second D1 on an already-bound session was refused: ${again.text}`)
    assert.equal((await boundTenants())['ses_mei'], ACME)
  })

  it('a4 · NO COOKIE IS 401 — the body cannot stand in for one', async () => {
    await resetSessions()
    for (const body of [{}, { sessionToken: HANDLE.mei }]) {
      const res = await post(plane.url, '/context/resolve', { host: ACME_HOST, body })
      assert.equal(
        res.status,
        401,
        'a request with NO session cookie was not refused as unauthenticated. ' +
          `Authentication runs in onRequest, before the body exists. Got ${res.status}: ${res.text}`,
      )
      assert.equal(res.body?.['code'], 'session_invalid')
    }
    assert.deepEqual(Object.values(await boundTenants()).filter((t) => t !== null), [])
  })

  /**
   * 🛑 a5 · CSRF — G3212. A request a browser marks as started by another
   *    origin is 401 and binds nothing, cookie or no cookie.
   *
   * `SameSite=Lax` keeps the cookie off a cross-SITE POST; it does NOT keep it
   * off a same-site SIBLING's, and a `text/plain` form POST needs no CORS
   * preflight. `Sec-Fetch-Site` and `Origin` are forbidden header names, so
   * they are what the BROWSER knows about who started the request.
   */
  for (const [label, headers] of [
    ['Sec-Fetch-Site: same-site — a sibling host', { 'Sec-Fetch-Site': 'same-site' }],
    ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
    ['an Origin naming a sibling host', { Origin: `https://evil.${ACME_HOST}` }],
    ['an Origin whose host merely STARTS with ours', { Origin: `https://${ACME_HOST}.evil.test` }],
    ['the opaque Origin a sandboxed frame sends', { Origin: 'null' }],
  ] as const) {
    it(`a5 · ${label} is 401 and binds nothing`, async () => {
      await resetSessions()
      const res = await post(plane.url, '/context/resolve', {
        host: ACME_HOST,
        session: HANDLE.mei,
        body: {},
        headers,
      })
      assert.equal(res.status, 401, `a cross-origin D1 was served: ${res.status} ${res.text}`)
      assert.equal(res.body?.['code'], 'session_invalid')
      assert.equal((await boundTenants())['ses_mei'], null, 'the refused request bound a tenant')
      assert.equal(
        await revokedAtOf('ses_mei'),
        null,
        'a CSRF refusal REVOKED the victim\'s session — an attacker page could sign anybody out',
      )
    })
  }

  it('a6 · BASE CONTROL — a same-origin browser request (both headers present) binds', async () => {
    await resetSessions()
    const res = await post(plane.url, '/context/resolve', {
      host: ACME_HOST,
      session: HANDLE.mei,
      body: {},
      headers: { Origin: `https://${ACME_HOST}`, 'Sec-Fetch-Site': 'same-origin' },
    })
    assert.equal(res.status, 200, `a SAME-origin browser request was refused, so a5 measures nothing: ${res.text}`)
    assert.equal((await boundTenants())['ses_mei'], ACME)
  })

  /* ---------------------------------------------------------------- *
   * (b) The two liveness arms this plane enforces. SEPARATELY.
   * ---------------------------------------------------------------- */

  it('b1 · a REVOKED session is 401', async () => {
    await resetSessions()
    const res = await resolveContext(plane.url, ACME_HOST, HANDLE.gone)
    assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.text}`)
    assert.equal((await boundTenants())['ses_gone'], null)
  })

  it('b2 · an EXPIRED session is 401, and it is a different row from the revoked one', async () => {
    await resetSessions()
    const res = await resolveContext(plane.url, ACME_HOST, HANDLE.stale)
    assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.text}`)
    assert.equal((await boundTenants())['ses_stale'], null)
  })

  /* ---------------------------------------------------------------- *
   * (c) G180 — the host binding, and the REVOCATION half.
   * ---------------------------------------------------------------- */

  it('c · a session presented on another tenant\'s host is 401 AND is revoked', async () => {
    await resetSessions()
    assert.equal(await revokedAtOf('ses_mei'), null, 'the fixture did not start live')

    const res = await resolveContext(plane.url, GLOBEX_HOST, HANDLE.mei)
    assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.text}`)

    assert.notEqual(
      await revokedAtOf('ses_mei'),
      null,
      'G180 refused the request and did NOT revoke the session. `checkHostBinding()` ' +
        'returns `revoke: true` for a mismatch and `model/serving-host.ts` names this ' +
        'exact repair as the likely lazy one: "implement the refusal WITHOUT the ' +
        'revocation — every mismatch test still passes, and a stolen-and-tossed ' +
        'session survives to be retried against the right host."',
    )
    assert.equal((await boundTenants())['ses_mei'], null)
  })

  /* ---------------------------------------------------------------- *
   * (d) G199 — the membership gate, three cases, one wire answer.
   * ---------------------------------------------------------------- */

  it('d1 · a principal with NO membership in the host\'s tenant is membership_absent', async () => {
    await resetSessions()
    /* Ana is a member of GLOBEX and her session was issued on the ACME host —
     * B1's attacker, who holds a legitimate session and wants a tenant she
     * holds nothing in. */
    const res = await resolveContext(plane.url, ACME_HOST, HANDLE.ana)
    assert.equal(res.status, 403, `expected 403, got ${res.status}: ${res.text}`)
    assert.equal(problemCode(res), 'membership_absent')
    assert.equal(
      (await boundTenants())['ses_ana'],
      null,
      'the refusal was reported and the tenant was bound anyway. That is B1 exactly: ' +
        '"the request-supplied tenant did not disappear, it moved into the one write ' +
        'that establishes a scope."',
    )
  })

  it('d2 · a REVOKED membership is membership_absent — a retained row is not a live one', async () => {
    await resetSessions()
    const res = await resolveContext(plane.url, ACME_HOST, HANDLE.raj)
    assert.equal(res.status, 403, `expected 403, got ${res.status}: ${res.text}`)
    assert.equal(problemCode(res), 'membership_absent')
    assert.equal((await boundTenants())['ses_raj'], null)
  })

  it('d3 · an EXPIRED membership is membership_absent — the term B1 did not write', async () => {
    await resetSessions()
    const res = await resolveContext(plane.url, ACME_HOST, HANDLE.lee)
    assert.equal(
      res.status,
      403,
      'an EXPIRED, UNREVOKED membership bound a tenant. `docs/build/stateless-red-session.md` ' +
        'B1 writes the control as "… AND m.revoked_at IS NULL" and stops there; both halves ' +
        'of this slice add the expiry term deliberately, and `Membership.expiresAt` rules ' +
        `that "partner-scoped memberships must expire". Got ${res.status}: ${res.text}`,
    )
    assert.equal(problemCode(res), 'membership_absent')
    assert.equal((await boundTenants())['ses_lee'], null)
  })

  /* ---------------------------------------------------------------- *
   * (e) G179 — a host nobody registered is not a tenant.
   * ---------------------------------------------------------------- */

  /**
   * 🛑 THIS ASSERTION WAS WRONG ON ITS FIRST DRAFT AND THE CORRECTION IS THE
   * INTERESTING PART, SO IT IS RECORDED RATHER THAN QUIETLY FIXED.
   *
   * It presented MEI's session — issued on the ACME host — against the
   * unregistered host and asserted a refusal. **It passed, and it passed for
   * the wrong reason**: `checkHostBinding()` refuses at AUTHENTICATION, before
   * the registry is consulted at all, so the assertion was witnessing G180 a
   * second time and the registry lookup was never reached. Measured: replacing
   * `resolveServingHost()` with *"use the first row in the registry"* left the
   * whole file GREEN — a mutation that hands every caller the first tenant in
   * the published set, undetected.
   *
   * **A session must therefore be ISSUED ON the unregistered host for this
   * arm to be reachable**, which is not a contrivance: it is exactly the row a
   * tenant leaves behind when its host is withdrawn from the registry while
   * sessions on it are still live. `ses_orphan` is that row.
   */
  it('e · a host the registry does not name resolves to no tenant', async () => {
    await resetSessions()
    /* Shaped exactly like the registered ones — three labels, the right region
     * label, an unreserved tenant label. The only thing wrong with it is that
     * nobody published it, which is the whole of G179: there is no pattern to
     * fall back to and no leftmost label to read a tenant out of. */
    const res = await resolveContext(plane.url, UNREGISTERED_HOST, HANDLE.orphan)
    assert.equal(
      res.status,
      403,
      'a session whose own host is not in the published registry was given a tenant. ' +
        'G179: resolution is a CONFIGURATION LOOKUP, never a pattern — "tenant = ' +
        'subdomain(host)" breaks silently for the BYOA customer and is the defect the ' +
        `registry exists to make unrepresentable. Got ${res.status}: ${res.text}`,
    )
    assert.equal(problemCode(res), 'tenant_context_missing')
    assert.equal((await boundTenants())['ses_orphan'], null)
  })

  it('e2 · and a session presented on ANOTHER registered host is refused earlier, by G180', async () => {
    /* The companion to (e), kept so the two controls are visibly different:
     * this one never reaches the registry, and (e) is the only assertion that
     * does. Without both, a reader cannot tell which refusal they are looking
     * at — which is how (e)'s first draft came to assert nothing. */
    await resetSessions()
    const res = await resolveContext(plane.url, GLOBEX_HOST, HANDLE.mei)
    assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.text}`)
    assert.equal((await boundTenants())['ses_mei'], null)
  })

  /* ---------------------------------------------------------------- *
   * (f) The happy path.
   * ---------------------------------------------------------------- */

  it('f · a live session, on its own host, with a live membership, gets a TenantContext', async () => {
    await resetSessions()
    const res = await resolveContext(plane.url, ACME_HOST, HANDLE.mei)
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.text}`)
    assert.deepEqual(res.body, {
      tenantId: ACME,
      environment: 'sandbox',
      residency: 'ap-southeast-1',
      deploymentMode: 'hosted',
    })

    assert.equal(
      (await boundTenants())['ses_mei'],
      ACME,
      'the context was returned and the session row was not bound. The GUC is ' +
        '`SET LOCAL` under G101 and dies with the transaction, so the ROW is the only ' +
        'durable side effect this operation has — a context returned without one is a ' +
        'context no later request can reproduce.',
    )
  })

  /* ---------------------------------------------------------------- *
   * (g) The scope D1 opened, and the control that makes it mean something.
   * ---------------------------------------------------------------- */

  it('g · the bound tenant reads only its own rows — and with RLS disabled the same read leaks both', async () => {
    await resetSessions()
    const ok = await resolveContext(plane.url, ACME_HOST, HANDLE.mei)
    assert.equal(ok.status, 200, `set-up failed: ${ok.text}`)
    const bound = (await boundTenants())['ses_mei']
    assert.equal(bound, ACME)

    const pool = await createAppPool(1)
    try {
      const scoped = await withTenantScope(pool, String(bound), async (tx) => {
        const res = await tx.query('SELECT tenant_id FROM tenant.tenant_contact')
        return (res.rows as Array<Record<string, unknown>>).map((r) => String(r['tenant_id']))
      })
      assert.deepEqual(
        [...new Set(scoped)].sort(),
        [ACME],
        `the scope D1 bound read rows for ${[...new Set(scoped)].join(', ')}`,
      )

      /* THE NEGATIVE CONTROL. Without it, a green assertion above is
       * compatible with there being no rows for the other tenant at all, or
       * with the query being wrong — `tests/db/tenant-isolation.test.ts` uses
       * this exact shape and for this exact reason. */
      const mig = await migratorClient()
      try {
        await mig.query('ALTER TABLE tenant.tenant_contact DISABLE ROW LEVEL SECURITY')
      } finally {
        await mig.end()
      }
      try {
        const leaked = await withTenantScope(pool, String(bound), async (tx) => {
          const res = await tx.query('SELECT tenant_id FROM tenant.tenant_contact')
          return (res.rows as Array<Record<string, unknown>>).map((r) => String(r['tenant_id']))
        })
        assert.deepEqual(
          [...new Set(leaked)].sort(),
          [ACME, GLOBEX].sort(),
          'with row-level security DISABLED the same read did NOT leak both tenants. ' +
            'The isolation asserted above is therefore coming from somewhere nobody has ' +
            'identified — a missing grant, an empty table, a wrong query — and not from ' +
            'the policy. docs/HANDOFF.md §5.6.',
        )
      } finally {
        const mig2 = await migratorClient()
        try {
          await mig2.query('ALTER TABLE tenant.tenant_contact ENABLE ROW LEVEL SECURITY')
        } finally {
          await mig2.end()
        }
      }
    } finally {
      await pool.end()
    }
  })

  /* ---------------------------------------------------------------- *
   * (h) G101 — the GUC does not survive the pool.
   * ---------------------------------------------------------------- */

  it('h · the tenant GUC is gone when the connection returns to the pool, on the SAME backend', async () => {
    const pool: TenantPool = await createAppPool(1)
    try {
      const inside = await withTenantScope(pool, ACME, async (tx) => {
        const res = await tx.query(
          "SELECT current_setting('app.tenant_id', true) AS scope, pg_backend_pid() AS pid",
        )
        const row = (res.rows as Array<Record<string, unknown>>)[0] ?? {}
        return { scope: String(row['scope']), pid: String(row['pid']) }
      })
      assert.equal(inside.scope, ACME, 'the scoped transaction did not carry its own scope')

      /* `max: 1`, so this checkout is FORCED onto the connection the scope just
       * released — the arrangement most likely to leak rather than one that
       * happens not to. */
      const client = await pool.connect()
      try {
        const res = await client.query(
          "SELECT current_setting('app.tenant_id', true) AS scope, pg_backend_pid() AS pid",
        )
        const row = (res.rows as Array<Record<string, unknown>>)[0] ?? {}
        assert.equal(
          String(row['pid']),
          inside.pid,
          'the two reads ran on DIFFERENT backends, so this assertion proves nothing ' +
            'about connection state. G98 picked `pg` precisely because it exposes the pid.',
        )
        assert.equal(
          String(row['scope']),
          '',
          'the tenant GUC SURVIVED the transaction. That is leak MODE 1 in ' +
            '`db/tenant-scope.ts`: "request A for tenant T sets it, returns the ' +
            'connection to the pool, and request B for tenant U is served on that ' +
            'connection reading T\'s rows with RLS reporting success."',
        )
      } finally {
        client.release()
      }
    } finally {
      await pool.end()
    }
  })
})

/* ------------------------------------------------------------------ *
 * THE REGISTRY PARSER. No database, so no skip.
 *
 * ⚠️ IT IS IN THIS FILE RATHER THAN ITS OWN BECAUSE IT IS THE SAME CONTROL
 * FROM THE OTHER END: every assertion above depends on the registry having
 * refused to load something wrong, and a parser tested nowhere is a parser
 * whose fail-closed claim is an intention.
 * ------------------------------------------------------------------ */

describe('the serving-host registry refuses rather than skips', () => {
  it('1 · an absent variable is an empty registry, not a throw', () => {
    assert.deepEqual(parseServingHosts(undefined), [])
    assert.deepEqual(parseServingHosts('   '), [])
  })

  it('2 · a well-formed pooled row loads', () => {
    const rows = parseServingHosts(`${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active`)
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.tenantId, ACME)
    assert.equal(rows[0]?.status, 'active')
  })

  it('3 · a pooled row whose region label disagrees with its region is a THROW', () => {
    assert.throws(
      () => parseServingHosts(`acme.us-west-2.reconcile.invalid|ten_acme|ap-southeast-1|pooled|active`),
      /region_label_disagrees_with_region/,
      'G179: "A flat wildcard is cryptographically valid in EVERY region, so an EU ' +
        'tenant misrouted to a US plane FAILS OPEN AND IS INVISIBLE." ' +
        '`checkServingHostRegistration()` is the check and this is its call site.',
    )
  })

  it('4 · a reserved tenant label is a THROW', () => {
    assert.throws(
      () => parseServingHosts(`admin.ap-southeast-1.reconcile.invalid|ten_x|ap-southeast-1|pooled|active`),
      /tenant_label_refused/,
    )
  })

  it('5 · a DELEGATED row is exempt from every label rule — BYOA must stay registerable', () => {
    const rows = parseServingHosts('recon.customer.example|ten_byoa|eu-west-1|delegated|active')
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.kind, 'delegated')
  })

  it('6 · a missing field is a THROW and not a skipped row', () => {
    assert.throws(
      () => parseServingHosts(`${ACME_HOST}|ten_acme|ap-southeast-1|pooled`),
      /4 field\(s\) and the grammar has 5/,
      'a dropped row and an unregistered host are the same answer from outside, and ' +
        'only one of them is a decision.',
    )
  })

  it('7 · an unnormalised host is a THROW — the registry stores the folded form', () => {
    assert.throws(
      () => parseServingHosts(`ACME.ap-southeast-1.reconcile.invalid|ten_acme|ap-southeast-1|pooled|active`),
      /host_not_normalised/,
    )
  })
})

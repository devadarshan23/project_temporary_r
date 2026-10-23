/**
 * THE GATE SAYS YES TO SOMEBODY — G299, 19 Sep 2026, over a real socket.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THIS FILE IS DIFFERENT FROM EVERY OTHER SUITE IN `tests/http/`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every database-backed suite here starts its plane with
 * `authorise: allowEveryCapability` — it has to, because a plane that 403s
 * every request would let assertions about row-level security pass while
 * proving nothing. **This file starts the plane with NO `authorise` option at
 * all**, so it takes the DEFAULT, which is the production authoriser
 * `server/data-plane/start.ts` hands both entry points. The 200 below is
 * therefore a verdict from `decide()` about a principal assembled entirely out
 * of rows, reached through the door a deployed process comes through.
 *
 * ⚠️ AND THE DEV TOKEN IS DELETED FROM THE PROCESS, WHICH IS AN ASSERTION IN
 * DISGUISE — `tests/http/context-resolve.test.ts` makes the same move for the
 * same reason. With `RECONCILE_LOCAL_TEST_AUTH` set, `resolveSessionReader()`
 * adds an arm that authenticates on a signed token and resolves NO SUBJECT, and
 * every refusal below would then also be provable by a plane that had no
 * substrate at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE ALLOW IS THE SLICE'S REASON FOR EXISTING. READ §1 BEFORE THE REST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `docs/HANDOFF.md` §5.6 — a control that passes while asserting nothing — has
 * a mirror this repository has been living inside since G200:
 * **every authorisation arm in the product had only ever been observed
 * refusing.** `tests/http/capability-decide.test.ts` says it in its own voice:
 * *"A control whose only observable behaviour is refusal is `docs/HANDOFF.md`
 * §5.6 until something witnesses it deciding"* — and it could only witness the
 * mechanism, against a FIXTURE substrate, because no table existed.
 *
 * **§1 is the first 200 a capability-tier operation has ever returned.** Every
 * assertion after it removes exactly one term and requires the refusal back.
 * Without §1, all of them are vacuous; with only §1, none of them is a control.
 *
 * ⚠️ WHAT THE REFUSALS CANNOT SHOW HERE, STATED SO THE COVERAGE IS NOT
 * OVERCLAIMED. `decide()`'s reasons do not reach the wire — a 403 carries
 * `capability_not_held` and a constant `detail`, because
 * `server/data-plane/authorise.ts` refuses to make the gate *"a roster oracle
 * for anybody who can authenticate."* So this file proves WHICH REQUESTS ARE
 * REFUSED and `tests/db/identity-substrate.test.ts` §4 proves WITH WHICH NAME.
 * Neither is the whole control.
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
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { sessionCookie } from './harness.ts'
import { runScopedName } from '../run-scoped-db.ts'

/* ------------------------------------------------------------------ *
 * ITS OWN DATABASE. Set before the first call that reads it.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_SERVED_IDENTITY_DB_NAME'] ?? runScopedName('reconcile_served_identity_test')

delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const MEI = 'usr_ops_mei'
const DOOR_CUSTOMER = 'idc_acme_entra'
const DOOR_PARTNER = 'idc_partner_northwind'
/** ONE pool fronting BOTH doors — G304. The reference is what separates them. */
const BROKER_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const ROLE = 'rol_ap_approver'
const ASSIGNMENT = 'ras_mei_approver'

/**
 * The handle. Present only in this file; the row stores `digestOfHandle()` of
 * it and never this value — *"a database dump containing handles would be a
 * session-hijack kit."*
 */
const HANDLE = 'sh_mei_9f1c04b7e6a24d3890ab5c6d7e8f9012'

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the served identity-substrate test', probe)

/* ------------------------------------------------------------------ *
 * A RAW HTTP CLIENT, AND `node:http` RATHER THAN `fetch`, FOR
 * `tests/http/context-resolve.test.ts`'s REASON: undici derives the `Host`
 * header from the URL on some paths, and G180's binding check compares
 * `request.headers.host` against `Session.issuedHost` on EVERY request. A
 * helper that quietly sent `127.0.0.1:<port>` would make every 200 below a
 * statement about a binding the test did not choose.
 * ------------------------------------------------------------------ */

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function get(origin: string, path: string, opts: { host: string; session?: string }): Promise<Response> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        headers: {
          Host: opts.host,
          ...(opts.session === undefined ? {} : sessionCookie(opts.session)),
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
    req.end()
  })
}

/** Run one statement as the migrator. Every fixture write needs `BYPASSRLS`. */
async function asMigrator(sql: string, params: readonly unknown[] = []): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql, params as unknown[])
  } finally {
    await mig.end()
  }
}

/**
 * The complete substrate: a customer door, an active person, a live role
 * carrying `admit_source`, a live assignment pinned to its version, and a
 * session ALREADY BOUND to ACME and issued on ACME's host.
 *
 * ⚠️ `role_version` MATCHES `role.version`. `decide()` stops evaluating an
 * assignment whose pin has moved in EITHER direction, so a fixture that got
 * this wrong would refuse at `role_version_moved` and §1 would never go green
 * no matter how correctly the reader was wired.
 */
async function seedComplete(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
  assert.notEqual(digest, null, 'the fixture handle digested to nothing')

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      /* ⚠️ BOTH DOORS CARRY A BROKER HANDLE AND THE TWO HANDLES DIFFER ONLY IN
       * `broker_ref` — G304/G305. `oidc` is a brokered protocol, so a row with
       * NULL handle columns is `broker_unresolvable` and nothing behind it
       * resolves. One issuer and two references is the real shape: one pool,
       * two providers, two owners, two organisations — which is the fixture
       * that would catch a reader keying organisation off the broker. */
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES
         ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
          $3, 'acme-entra', 'active'),
         ($2, 'oidc', 'Northwind',     'partner',  'prt_northwind', NULL,
          $3, 'northwind', 'active')
       ON CONFLICT DO NOTHING`,
      [DOOR_CUSTOMER, DOOR_PARTNER, BROKER_ISSUER],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'mei@acme.invalid', 'Mei Tan', 'active', $2)
       ON CONFLICT DO NOTHING`,
      [MEI, DOOR_CUSTOMER],
    )
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1, $2, 'AP Approver', 'approver', 3, 'operator', 'pack', 'pck_ap', 'active')
       ON CONFLICT DO NOTHING`,
      [ACME, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      /* G3801 — `listRuns` reads on `view_exception` since the owner's C3-06 ruling. */
      [ACME, ROLE, CAPABILITIES.viewException],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version,
          granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, 3, 'usr_acme_admin', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, ASSIGNMENT, MEI, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_mei', $1, $2, $3, $4, $5,
               now(), now(), now() + interval '12 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [digest, MEI, DOOR_CUSTOMER, ACME, ACME_HOST],
    )
    /*
     * 🛑 TWO MEMBERSHIPS, ONE PER TENANT, AND THE GLOBEX ONE IS THE ONE TO
     * READ — G641, 19 Sep 2026.
     *
     * A bound session is a state only `selectTenantForSession()` can produce,
     * and it binds on a LIVE membership; since G641 the per-request path
     * re-asks that question on every request, so `seedComplete()` without a
     * membership row was forging a state the product cannot reach.
     *
     * ⚠️ §5 REBINDS THIS SESSION TO GLOBEX AND ITS WHOLE POINT IS THAT THE
     * REFUSAL COMES FROM `role_assignment_rls` AND NOT FROM SOMETHING EARLIER
     * — its own note records a first draft that *"passed for the wrong
     * reason"*. Without a GLOBEX membership the G641 check would refuse first
     * and §5 would be measuring THAT instead: the confound its note warns
     * about, arriving one control later. The GLOBEX row therefore exists so
     * that §5 still isolates the ASSIGNMENT scope, and §5's own assertion text
     * — *"a 401 means something refused earlier"* — is what would catch its
     * absence.
     */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_mei_acme',   $3, $4, 'bootstrap', now(), NULL, NULL),
              ($2, 'mem_mei_globex', $3, $4, 'bootstrap', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, GLOBEX, MEI, ROLE],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

/**
 * Put every mutated term back. Called before each refusal case AND after it,
 * so an assertion that fails mid-way cannot make the next one pass or fail for
 * a reason it did not choose.
 */
async function restore(): Promise<void> {
  await asMigrator(`UPDATE tenant."user" SET status = 'active' WHERE id = $1`, [MEI])
  await asMigrator(
    `UPDATE tenant.identity_connection SET status = 'active' WHERE id = ANY($1)`,
    [[DOOR_CUSTOMER, DOOR_PARTNER]],
  )
  await asMigrator(`UPDATE tenant.role SET status = 'active', version = 3 WHERE id = $1`, [ROLE])
  await asMigrator(
    `UPDATE tenant.role_assignment
        SET revoked_at = NULL, expires_at = NULL, role_version = 3
      WHERE id = $1`,
    [ASSIGNMENT],
  )
  await asMigrator(
    `INSERT INTO tenant.role_assignment
       (tenant_id, id, user_id, role_id, role_version,
        granted_by, granted_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, $4, 3, 'usr_acme_admin', now(), NULL, NULL)
     ON CONFLICT DO NOTHING`,
    [ACME, ASSIGNMENT, MEI, ROLE],
  )
  await asMigrator(
    `UPDATE tenant.session
        SET connection_id = $1, revoked_at = NULL, tenant_id = $2
      WHERE id = 'ses_mei'`,
    [DOOR_CUSTOMER, ACME],
  )
  /* G641 — both memberships put back live, for the reason every other line in
   * this function exists: an assertion that failed mid-way must not make the
   * next one pass or fail for a reason it did not choose. */
  await asMigrator(
    `UPDATE tenant.membership SET revoked_at = NULL, expires_at = NULL
      WHERE id IN ('mem_mei_acme', 'mem_mei_globex')`,
  )
}

function listRuns(origin: string): Promise<Response> {
  return get(origin, '/v1/runs', { host: ACME_HOST, session: HANDLE })
}

describe('a seeded subject reaches a gated operation — and one missing term does not', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seedComplete()
    /**
     * 🛑 NO `authorise` OPTION. The default is the production authoriser, which
     * is the whole point of this file — see the header.
     *
     * ⚠️ `poolMax: 1` IS ADVERSARIAL ON PURPOSE: the session scope, the tenant
     * scope and the handler's own read are all FORCED onto the connection the
     * previous one released, which is the condition under which a session-level
     * `SET` would leak between them. This slice adds a second scoped
     * transaction per request, so it is the first suite where that matters
     * twice.
     */
    plane = await startDataPlane({ poolMax: 1 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ================================================================ *
   * §1 · THE ALLOW.
   * ================================================================ */

  it('1 · a seeded subject holding `view_exception` (G3801; `admit_source` until 4 Oct 2026) is SERVED — the first 200 on this tier', async () => {
    await restore()
    const res = await listRuns(plane.url)
    assert.equal(
      res.status,
      200,
      `the gate refused a complete substrate (${res.status}: ${res.text}).\n` +
        'This is the assertion G299 exists for: "the gate starts saying yes to a seeded ' +
        'subject before any identity provider exists". If it is red, the chain to check in ' +
        'order is — the session row is live and bound; `issued_host` equals the Host header ' +
        '(G180 revokes on a mismatch, so a second run would fail differently); the `user` ' +
        'and `identity_connection` rows exist and are active; `owner_kind` is `customer`; ' +
        'the assignment is unrevoked, unexpired and pinned to the role`s CURRENT version; ' +
        'and `role_capability` carries `view_exception`, which is what the contract annotates ' +
        '`listRuns` with.',
    )
  })

  /* ================================================================ *
   * §2 · THE FOUR ARMS THAT WERE UNENFORCED. A disabled person and a
   *      disabled directory both reached this plane until today.
   * ================================================================ */

  it('2a · a DISABLED PERSON is refused — the arm `session.ts` said was unenforced', async () => {
    await restore()
    await asMigrator(`UPDATE tenant."user" SET status = 'disabled' WHERE id = $1`, [MEI])
    const res = await listRuns(plane.url)
    await restore()

    assert.equal(
      res.status,
      401,
      `a disabled person was served ${res.status}. Until 19 Sep 2026 this WAS 200: ` +
        '`server/data-plane/session.ts` enforced two of `resolveSubject()`\'s seven arms ' +
        'in the `WHERE` of one read and four not at all, and its own header named this one ' +
        '— "a DISABLED PERSON and a DISABLED DIRECTORY both reach this plane today". ' +
        '`tests/db/identity-substrate.test.ts` §1a keeps that red runnable.',
    )
    assert.equal(
      res.body?.['code'],
      'session_invalid',
      'a disabled person must be refused as UNAUTHENTICATED, not unauthorised. ' +
        '`resolveSubject()` refuses `user_disabled` before any capability is read, so ' +
        'there is no authority question to answer — and a 403 would tell the caller their ' +
        'session was fine.',
    )
  })

  it('2b · a DISABLED DIRECTORY is refused — the other unenforced arm', async () => {
    await restore()
    await asMigrator(
      `UPDATE tenant.identity_connection SET status = 'disabled' WHERE id = $1`,
      [DOOR_CUSTOMER],
    )
    const res = await listRuns(plane.url)
    await restore()

    assert.equal(res.status, 401, `a dead door served ${res.status}: ${res.text}`)
    assert.equal(res.body?.['code'], 'session_invalid')
  })

  it('2c · a REVOKED session is refused — the arm a HARD-CODED FIELD had made unreachable', async () => {
    /**
     * 🛑 THIS ASSERTION EXISTS BECAUSE THE COMMIT THAT WROTE IT ALMOST SHIPPED
     * THE DEFECT IT GUARDS, AND THE NEAR-MISS IS RECORDED RATHER THAN TIDIED.
     *
     * `rowToSession()` in `server/data-plane/session.ts` carried
     * `revokedAt: null` as a CONSTANT, which was true only because the deleted
     * `WHERE revoked_at IS NULL` guaranteed it. Deleting the predicate without
     * reading the column would have left `SESSION_REFUSALS.sessionRevoked` as a
     * member nothing could return — **a refusal deleted by a field rather than
     * by a decision.** Its sibling `expiresAt` really was dropped from that
     * object mid-commit, `tsc` stayed green because `as Session` is a cast of
     * shape, and `tests/http/context-resolve.test.ts` b2 is what went red.
     *
     * ⚠️ SO THE CONTROL IS A REQUEST, NOT A TYPE. §5.10: *"If you add a field
     * and `tsc` stays green without you changing anything else, the compiler
     * told you nothing."*
     */
    await restore()
    await asMigrator(`UPDATE tenant.session SET revoked_at = now() WHERE id = 'ses_mei'`)
    const res = await listRuns(plane.url)
    await restore()

    assert.equal(res.status, 401, `a revoked session served ${res.status}: ${res.text}`)
    assert.equal(res.body?.['code'], 'session_invalid')
  })

  /* ================================================================ *
   * §3 · THE AUTHORITY TERMS. Each removed alone, and the request must
   *      stop being served.
   * ================================================================ */

  it('3a · NO role assignment — `not_held`, which is a fact about the person', async () => {
    await restore()
    await asMigrator('DELETE FROM tenant.role_assignment WHERE id = $1', [ASSIGNMENT])
    const res = await listRuns(plane.url)
    await restore()

    assert.equal(res.status, 403, `a person holding nothing was served ${res.status}: ${res.text}`)
    assert.equal(
      res.body?.['code'],
      'capability_not_held',
      'a person with no assignment must be AUTHENTICATED and UNAUTHORISED. The session is ' +
        'live and the subject resolves; what is absent is authority. `decide()` names it ' +
        '`no_live_assignment` — "a reader ran and found no assignments" — which is a fact ' +
        'about them and not about our substrate.',
    )
  })

  it('3b · a REVOKED assignment is refused', async () => {
    await restore()
    await asMigrator('UPDATE tenant.role_assignment SET revoked_at = now() WHERE id = $1', [
      ASSIGNMENT,
    ])
    const res = await listRuns(plane.url)
    await restore()
    assert.equal(res.status, 403, `a revoked assignment served ${res.status}: ${res.text}`)
  })

  it('3c · an EXPIRED assignment is refused — separately, and the reader returns BOTH rows', async () => {
    await restore()
    await asMigrator(
      `UPDATE tenant.role_assignment
          SET granted_at = now() - interval '2 days',
              expires_at = now() - interval '1 day'
        WHERE id = $1`,
      [ASSIGNMENT],
    )
    const res = await listRuns(plane.url)
    await restore()
    assert.equal(
      res.status,
      403,
      `an expired assignment served ${res.status}: ${res.text}. ⚠️ THE READER DOES NOT ` +
        'FILTER ON EITHER COLUMN — `server/data-plane/identity.ts` returns revoked and ' +
        'expired rows alike, and `decide()` refuses them as two DIFFERENT reasons. A ' +
        'liveness `WHERE` in the reader would make both refusals unreachable and this ' +
        'assertion would pass for the wrong reason.',
    )
  })

  it('3d · a MOVED version pin is refused — §10.5, a rollback must not widen authority', async () => {
    await restore()
    await asMigrator('UPDATE tenant.role SET version = 4 WHERE id = $1', [ROLE])
    const res = await listRuns(plane.url)
    await restore()
    assert.equal(res.status, 403, `a moved pin served ${res.status}: ${res.text}`)
  })

  /* ================================================================ *
   * §4 · `orgClass` — THE TERM MOST EASILY FAKED.
   * ================================================================ */

  it('4 · the SAME person through a PARTNER door does NOT get the customer arm', async () => {
    await restore()
    await asMigrator(`UPDATE tenant.session SET connection_id = $1 WHERE id = 'ses_mei'`, [
      DOOR_PARTNER,
    ])
    const res = await listRuns(plane.url)
    await restore()

    assert.equal(
      res.status,
      403,
      `a partner principal was SERVED ${res.status}: ${res.text}.\n` +
        'The live customer assignment is still in the database and must not save them. ' +
        '`orgClass` derives from `orgFor(connection.owner)` and from nothing else — G289: ' +
        '"Defaulting it to `customer` routes a partner down the customer arm past the ' +
        'live-grant check, the `partnerId` check, revocation, expiry and ' +
        '`PARTNER_CAPABILITY_MASK` — five controls deleted by one assignment." ' +
        '`tests/db/identity-substrate.test.ts` §5 proves the refusal arrives on the ' +
        'PARTNER arm, as `partner_grant_absent`, rather than merely arriving.',
    )
    assert.equal(res.body?.['code'], 'capability_not_held')
  })

  /* ================================================================ *
   * §5 · CROSS-TENANT. A subject in A cannot resolve into B.
   * ================================================================ */

  it('5 · a session rebound to GLOBEX holds nothing, because the assignment lives in ACME', async () => {
    await restore()
    /* Written as the MIGRATOR, which is the only way this row can exist:
     * `session_selection_restrictive` refuses the same write from the app role
     * because Mei holds neither a membership nor a grant in GLOBEX. The point
     * of forcing it is to prove the AUTHORITY read is scoped too, rather than
     * relying on the selection write being the only thing standing in the way. */
    await asMigrator(`UPDATE tenant.session SET tenant_id = $1 WHERE id = 'ses_mei'`, [GLOBEX])

    /**
     * 🛑 THE `Host` STAYS `ACME_HOST`, AND THE FIRST DRAFT OF THIS TEST SENT
     * `GLOBEX_HOST` AND PASSED FOR THE WRONG REASON — WHICH IS THIS SUITE'S OWN
     * §5.6 AND IS RECORDED RATHER THAN QUIETLY FIXED.
     *
     * `Session.issuedHost` is `ACME_HOST`, and `checkHostBinding()` runs on
     * EVERY request under G180. Sending `GLOBEX_HOST` therefore refused at the
     * BINDING, before a tenant scope was ever opened — so the assertion was
     * green while proving nothing at all about whether the authority read is
     * scoped. It even tried to REVOKE the session, and the restrictive policy
     * refused the write, which is how the confound announced itself.
     *
     * With the host left matching, G180 passes, `resolveSubject()` returns a
     * subject whose `tenantId` is GLOBEX, and the ONLY thing that can refuse is
     * `role_assignment_rls` narrowing the authority read to a tenant the
     * assignment is not in. `assert.notEqual(200)` would still pass under the
     * old confound; the exact `403` plus the code below would not.
     */
    const res = await listRuns(plane.url)
    await restore()

    assert.equal(
      res.status,
      403,
      'a subject whose only assignment is in ACME was not refused by the AUTHORITY read ' +
        'inside GLOBEX. `role_assignment_rls` is 0001\'s predicate verbatim and ' +
        '`readHeldAssignments()` writes no tenant clause of its own, so the narrowing is ' +
        'the policy\'s. A 200 means the read escaped its scope; a 401 means something ' +
        `refused earlier and this assertion is measuring that instead. Got ${res.status}: ${res.text}`,
    )
    assert.equal(
      res.body?.['code'],
      'capability_not_held',
      'the refusal must be an AUTHORITY refusal. A `session_invalid` here means the ' +
        'request never reached the tenant-scoped read — see the note above this assertion.',
    )
  })
})

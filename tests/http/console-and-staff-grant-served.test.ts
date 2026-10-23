/**
 * TWO THINGS THAT WERE IMPOSSIBLE OVER HTTP UNTIL 19 Sep 2026, WITNESSED OVER
 * A SOCKET AGAINST THE PRODUCTION SEAMS — G726–G729.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 NO `authorise` AND NO `substrate` ARGUMENT. READ THIS FIRST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `startDataPlane({ poolMax })` takes the PRODUCTION authoriser
 * (`sessionCapabilities`) and the PRODUCTION substrate reader
 * (`substrateFromSession`) by default, and this file passes neither. Every
 * status code below is one a deployed plane would produce, and the one 200 in
 * §1 is a 200 the tree could not produce yesterday.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §1 IS THE DECISIVE ONE AND IT IS A STATUS CODE THAT CHANGED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `model/access.ts` §7a carried this sentence, and four documents quoted it:
 *
 *   *"WHAT IS STILL EXACTLY TRUE, AND IT IS NARROWER THAN WHAT WAS: nothing
 *    on the SERVED path supplies a grant and nothing MINTS one.
 *    `server/data-plane/context.ts` passes no `staffGrant` … so an FDE over
 *    HTTP is still refused, and the arm is reachable with its term having no
 *    producer."*
 *
 * **§1 is that sentence going false.** A platform FDE holding NO MEMBERSHIP in
 * `ten_acme` and one live `TenantAccessGrant` into it calls D1 on ACME's own
 * host and gets a `TenantContext` back. Before G729 the identical request
 * answered **403 `membership_absent`**, because `bindTenant()` read the
 * memberships and passed no grant.
 *
 * 🛑 INVARIANT 1 IS NOT BENT BY IT AND THAT IS THE POINT OF DOING IT AT D1.
 * *"Tenant scope is derived from the session, never read from a request."* The
 * tenant here comes from the HOST, through `resolveServingHost()`, exactly as
 * it does for a member — the grant decides WHETHER this principal may be
 * scoped to that tenant, and never WHICH tenant. §1d is the assertion that
 * says so: the same grant, presented on the OTHER tenant's host, binds
 * nothing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * §5 IS A 200 THAT BECAME A 401, WHICH IS THE OTHER DIRECTION AND THE RARER ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A session row with a TENANT BOUND, issued on a CONSOLE host, is a shape the
 * migrator can write and D1 cannot. Before G727 the plane served it: the
 * console host meant nothing, the session was live, and its holder could read
 * that tenant's runs through a host that serves no tenant. After G727
 * `resolveSubject()` refuses it at `console_session_is_tenant_bound` and the
 * caller gets 401. **That is a hardening with a witness rather than an
 * argument**, and §5b is the differential that stops it being confused with
 * "console sessions do not work".
 *
 * ⚠️ WHAT IS NOT HERE, AND WHY. There is no assertion that a console principal
 * REACHES anything, because **no console operation is mounted** — G602
 * measures that `administration.openapi.yaml`'s annotation is all-or-nothing
 * and 33 of its 59 operations have no evaluator. The console principal's ALLOW
 * arm is witnessed at the model layer instead, in
 * `tests/model/console-principal.test.ts` §2a, and the commit that mounts the
 * first console operation owes this file the served half.
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
 * ITS OWN DATABASE. Set before the first call that reads it — `db/env.ts`
 * resolves `RECONCILE_DB_NAME` per call and never at import, which is what
 * makes a per-suite database possible while agents gate concurrently.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_CONSOLE_DB_NAME'] ?? runScopedName('reconcile_console_session_test')

/** 🛑 THE FLAG IS DELETED. Under it nothing resolves a subject and `decide()`
 * is never reached through its real terms — the whole file would assert the
 * dev-token arm instead of the deployed one. */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'
const CONSOLE_HOST = 'console.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

/**
 * 🛑 THE CONSOLE REGISTRY, FLAT — G297. Two labels and no region label, which
 * `checkConsoleHostRegistration()` enforces at boot: a console carrying one
 * would assert a residency invariant 3 says the control plane does not have.
 * A first draft of this line used `console.ap-southeast-1.reconcile.invalid`
 * and the plane REFUSED TO START, which is the fence working.
 */
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

/** The FDE. A PLATFORM door, and NO membership in either tenant, ever. */
const FDE = 'usr_fde_priya'
const DOOR_PLATFORM = 'idc_1ch_entra'
/** An ordinary customer operator, for the anti-vacuous control in §1b. */
const MEI = 'usr_ops_mei'
const DOOR_CUSTOMER = 'idc_acme_entra'
const BROKER_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const ROLE = 'rol_ap_approver'

const GRANT = 'tag_priya_acme'

/** Handles live only in this file; the rows store `digestOfHandle()` of them. */
const FDE_HANDLE = 'sh_fde_2b71c0d49e8a4f1780cd3e5f6a7b8c90'
/**
 * 🛑 A SECOND FDE SESSION, ISSUED ON GLOBEX'S HOST, AND IT EXISTS BECAUSE THE
 * FIRST DRAFT OF §1c REUSED `FDE_HANDLE` AND POISONED §2–§4. G180 revokes on a
 * host mismatch — that is the whole control — so presenting ACME's session on
 * GLOBEX's host does not test the GRANT at all: it tests the BINDING, revokes
 * the row, and every later section gets a 401 from a session that is dead.
 * **Two sessions is what makes §1c about the grant.**
 */
const FDE_GLOBEX_HANDLE = 'sh_fdg_5c8a1e73d90b2f46a8e0c1d2b3f4a596'
const MEI_HANDLE = 'sh_mei_44e0b9a17c6d4e2b81fa0c3d5e6f7a81'
const CONSOLE_HANDLE = 'sh_con_7d2e5a90b4c1f38e6a0d9b2c4e5f6a73'
const BOUND_CONSOLE_HANDLE = 'sh_bad_91f3c7e04b8a2d5610ce7f9a3b4d5e62'

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the console-session and staff-grant served test', probe)

/* ------------------------------------------------------------------ *
 * `node:http` AND NEVER `fetch`, for `tests/http/context-resolve.test.ts`'s
 * reason: `Host` is a forbidden header name in the Fetch standard and undici
 * drops it, so every G180 assertion below would be about a binding the test
 * did not choose.
 * ------------------------------------------------------------------ */

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function send(
  origin: string,
  path: string,
  opts: { host: string; session?: string; method?: string; body?: unknown },
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
          Host: opts.host,
          ...(payload === undefined
            ? {}
            : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }),
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
    if (payload !== undefined) req.write(payload)
    req.end()
  })
}

/** D1. The session is the COOKIE alone (G3006) and the body is a closed empty object. */
function resolveContext(origin: string, host: string, handle: string): Promise<Response> {
  return send(origin, '/context/resolve', {
    host,
    session: handle,
    method: 'POST',
    body: {},
  })
}

async function asMigrator(sql: string, params: readonly unknown[] = []): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query(sql, params as unknown[])
  } finally {
    await mig.end()
  }
}

async function boundTenantOfSession(id: string): Promise<string | null> {
  const mig = await migratorClient()
  try {
    const rows = (await mig.query('SELECT tenant_id FROM tenant.session WHERE id = $1', [id]))
      .rows as Array<Record<string, unknown>>
    const only = rows[0]
    return only === undefined || only['tenant_id'] === null ? null : String(only['tenant_id'])
  } finally {
    await mig.end()
  }
}

/**
 * The substrate.
 *
 * 🛑 THE FDE HOLDS NO MEMBERSHIP ANYWHERE AND THAT IS THE FIXTURE'S WHOLE
 * CLAIM. Invariant 8: *"Being staff is not access. Reaching a tenant requires
 * a `TenantAccessGrant`."* A membership row for `usr_fde_priya` would make
 * every 200 below a statement about the membership arm, which has worked since
 * G160 and is not what this file is about.
 *
 * ⚠️ AND THE GRANT'S RESOURCE LINE IS `configuration`, DELIBERATELY. It is in
 * `PERMITTED_RESOURCES.incident`, in neither `NON_DELEGABLE_RESOURCES` nor
 * `CONTRACT_ONLY_RESOURCES`, and it is the class G56 puts with the FDE — so
 * §1 exercises `authorisationPermits()` against all three lists and passes,
 * while §3 swaps it for `statutory` and must fail whole.
 */
async function seed(): Promise<void> {
  const fdeDigest = digestOfHandle(FDE_HANDLE)
  const meiDigest = digestOfHandle(MEI_HANDLE)
  const fdeGlobexDigest = digestOfHandle(FDE_GLOBEX_HANDLE)
  const consoleDigest = digestOfHandle(CONSOLE_HANDLE)
  const boundConsoleDigest = digestOfHandle(BOUND_CONSOLE_HANDLE)
  for (const d of [fdeDigest, fdeGlobexDigest, meiDigest, consoleDigest, boundConsoleDigest]) {
    assert.notEqual(d, null, 'a fixture handle digested to nothing')
  }

  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES
         ($1, 'oidc', '1CloudHub Entra', 'platform', NULL, NULL, $3, '1ch-entra', 'active'),
         ($2, 'oidc', 'Acme Entra ID',   'customer', NULL, 'acc_acme', $3, 'acme-entra', 'active')
       ON CONFLICT DO NOTHING`,
      [DOOR_PLATFORM, DOOR_CUSTOMER, BROKER_ISSUER],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1, 'priya@1cloudhub.invalid', 'Priya R', 'active', $2),
              ($3, 'mei@acme.invalid',        'Mei Tan', 'active', $4)
       ON CONFLICT DO NOTHING`,
      [FDE, DOOR_PLATFORM, MEI, DOOR_CUSTOMER],
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
      [ACME, ROLE, CAPABILITIES.admitSource],
    )
    /* The ordinary operator, so §1b can show the membership arm still works. */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_mei_acme', $2, $3, 'bootstrap', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI, ROLE],
    )
    /**
     * 🛑 THE GRANT. `granted_at` is `now()` and `expires_at` is two hours out,
     * which is inside `MAX_GRANT_HOURS.incident` (24) — G292's third term is
     * *"a property of the PREDICATE"*, so a fixture outside the ceiling would
     * be refused by both halves and §1 would never go green.
     */
    await mig.query(
      `INSERT INTO tenant.tenant_access_grant
         (tenant_id, id, purpose, staff_user_id, granted_at, expires_at, revoked_at)
       VALUES ($1, $2, 'incident', $3, now(), now() + interval '2 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, GRANT, FDE],
    )
    await mig.query(
      `INSERT INTO tenant.access_resource_grant (tenant_id, grant_id, resource)
       VALUES ($1, $2, 'configuration') ON CONFLICT DO NOTHING`,
      [ACME, GRANT],
    )
    /**
     * Four sessions. All live, all unrevoked, and each issued on the host it
     * is presented on — G180 compares `issuedHost` on EVERY request, so a
     * fixture issued elsewhere would be refused before anything this file is
     * about could run.
     */
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES
         ('ses_fde',     $1, $5, $7, NULL, $10, now(), now(), now() + interval '12 hours', NULL),
         ('ses_mei',     $2, $6, $8, NULL, $10, now(), now(), now() + interval '12 hours', NULL),
         ('ses_console', $3, $5, $7, NULL, $11, now(), now(), now() + interval '12 hours', NULL),
         ('ses_bad',     $4, $6, $8, $9,   $11, now(), now(), now() + interval '12 hours', NULL),
         ('ses_fde_gbx', $12, $5, $7, NULL, $13, now(), now(), now() + interval '12 hours', NULL)
       ON CONFLICT DO NOTHING`,
      [
        fdeDigest,
        meiDigest,
        consoleDigest,
        boundConsoleDigest,
        FDE,
        MEI,
        DOOR_PLATFORM,
        DOOR_CUSTOMER,
        ACME,
        ACME_HOST,
        CONSOLE_HOST,
        fdeGlobexDigest,
        GLOBEX_HOST,
      ],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('a console session and a staff grant, over a socket', { skip }, () => {
  let plane: { url: string; close: () => Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    plane = await startDataPlane({ poolMax: 4 })
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  /* ---------------------------------------------------------------- *
   * §1 — INVARIANT 8's PERMITTED PATH, REACHED OVER HTTP
   * ---------------------------------------------------------------- */

  it('1a · an FDE with NO membership and a LIVE grant binds the host tenant', async () => {
    const res = await resolveContext(plane.url, ACME_HOST, FDE_HANDLE)
    assert.equal(
      res.status,
      200,
      'THE STAFF ARM DOES NOT REACH THE SERVED PATH. This request answered 403 ' +
        '`membership_absent` for a month because `bindTenant()` passed no `staffGrant`, ' +
        'and four documents carried that sentence. If it is 403 again, either the read ' +
        'is gone or it is outside `withSelectionScope()` — in which case ' +
        '`tenant_access_grant_rls` returns nothing and every FDE is refused as if no ' +
        `grant existed. Body: ${res.text}`,
    )
    assert.equal(res.body?.['tenantId'], ACME)
    assert.equal(
      await boundTenantOfSession('ses_fde'),
      ACME,
      'the 200 was served and the session was NOT bound. The selection write is the ' +
        'durable half; a context returned without it is a context the next request ' +
        'cannot reproduce.',
    )
  })

  it('1b · ANTI-VACUOUS — an ordinary member still binds through the membership arm', async () => {
    /**
     * ⚠️ WITHOUT THIS, §1a WOULD PASS ON A `bindTenant()` THAT HAD STOPPED
     * CHECKING ANYTHING. The membership arm is unchanged by G729 and is asked
     * FIRST — `selectTenantForSession()`: *"SECOND, NEVER FIRST … a person who
     * happens to hold both binds the tenant on the membership."*
     */
    const res = await resolveContext(plane.url, ACME_HOST, MEI_HANDLE)
    assert.equal(res.status, 200, res.text)
    assert.equal(res.body?.['tenantId'], ACME)
  })

  it('1c · and the FDE is still refused on a tenant nobody granted them', async () => {
    /**
     * 🛑 INVARIANT 1, HELD. The tenant comes from the HOST. The same live
     * grant, the same session, a different host — and `grant.tenantId !==
     * hostBoundTenantId` refuses. **A grant is not a tenant selector**, which
     * is `grantAllows()`'s own correction of 5 Aug 2026: *"a grant for tenant
     * A validated an operation against tenant B."*
     *
     * ⚠️ A SECOND SESSION, ISSUED ON GLOBEX'S HOST, SO THAT G180 IS SATISFIED
     * AND THE GRANT IS THE ONLY THING LEFT TO DECIDE. Reusing ACME's handle
     * here would be a host-binding test wearing a grant test's name — and it
     * would REVOKE the row, which is how the first draft of this file poisoned
     * §2, §3 and §4.
     */
    const res = await resolveContext(plane.url, GLOBEX_HOST, FDE_GLOBEX_HANDLE)
    assert.equal(
      res.status,
      403,
      'A GRANT INTO ACME BOUND GLOBEX. The tenant is the HOST\'s and the grant is ' +
        'compared against it; if this is 200, `hostBoundTenantId` has stopped being the ' +
        `answer and invariant 1 has been relocated into the grant. Body: ${res.text}`,
    )
    assert.equal(
      await boundTenantOfSession('ses_fde_gbx'),
      null,
      'the request was refused and the session was bound anyway, which would mean the ' +
        'selection write ran outside the refusal.',
    )
  })

  it('1d · the PER-REQUEST path accepts the grant too — the disjunct `session.ts` owed', async () => {
    /**
     * 🛑 THE DEBT `server/data-plane/session.ts` NAMED BEFORE IT WAS PAID, AND
     * WITHOUT THIS ASSERTION §1a WOULD BE A TRAP RATHER THAN A FEATURE. That
     * file's G641 block read: *"**The commit that supplies a `staffGrant` at
     * D1 owes this call site the same disjunct** … The direction is safe: a
     * staff-bound session would be REFUSED here, never admitted."*
     *
     * **Safe and useless.** Without the disjunct, D1 binds the FDE's tenant
     * (§1a, 200) and the very next request refuses them at 401 — a session
     * that can be scoped and cannot be used. This drives a GATED,
     * capability-tier operation on the bound session and requires a **403**:
     * the caller authenticated, `resolveAuthority()` accepted the grant in
     * place of a membership, and `decide()` refused them for want of a
     * capability, which is a different and correct sentence.
     *
     * ⚠️ 403 RATHER THAN 200 IS THE HONEST OUTCOME AND IS NOT A SHORTFALL. An
     * FDE reaching tenant DATA is `evaluateTenantAccess()`'s question, not
     * `decide()`'s — invariant 8's grant path and the assignment path are two
     * instruments, and this slice joins the SELECTION half of the first one to
     * the served path. Nothing here gives a grant a capability.
     */
    const res = await send(plane.url, '/v1/runs', { host: ACME_HOST, session: FDE_HANDLE })
    assert.equal(
      res.status,
      403,
      'A 401 MEANS THE PER-REQUEST PATH REFUSED THE SESSION D1 HAD JUST BOUND. ' +
        '`resolveAuthority()` asks `holdsLiveMembership()` OR ' +
        '`selectTenantForSession()`; if only the first is asked, an FDE can be scoped ' +
        `and can never use the scope. Body: ${res.text}`,
    )
    assert.equal(res.body?.['code'], 'capability_not_held')
  })

  it('1e · and it re-asks on EVERY request — a grant revoked after binding refuses', async () => {
    /**
     * 🛑 G641's RULING, APPLIED TO THE OTHER AUTHORITY: *"Check liveness on
     * read. The per-request path treats a lapsed membership as it treats a
     * revoked one. No sweeper and no clock."* A grant that expires by the
     * clock writes no statement and fires no trigger either — `0035`'s
     * argument, one instrument over — so the only place it can be caught is
     * the read. The session stays BOUND here on purpose: nothing un-binds it,
     * and the refusal has to come from the authority check rather than from
     * the tenant column.
     */
    await asMigrator('UPDATE tenant.tenant_access_grant SET revoked_at = now() WHERE id = $1', [
      GRANT,
    ])
    const res = await send(plane.url, '/v1/runs', { host: ACME_HOST, session: FDE_HANDLE })
    assert.equal(
      res.status,
      401,
      'A REVOKED GRANT STILL AUTHORISED A BOUND SESSION. The per-request disjunct must ' +
        're-ask, or a grant is a permanent scope once D1 has spent it — which is the ' +
        `defect G641 was ruled on, arriving on the staff arm. Body: ${res.text}`,
    )
    assert.equal(
      await boundTenantOfSession('ses_fde'),
      ACME,
      'the session was un-bound as a side effect of a refusal. A 401 is an answer about ' +
        'AUTHORITY; un-binding would be this path writing tenant scope, which only D1 does.',
    )
    await asMigrator('UPDATE tenant.tenant_access_grant SET revoked_at = NULL WHERE id = $1', [
      GRANT,
    ])
    await asMigrator('UPDATE tenant.session SET tenant_id = NULL WHERE id = $1', ['ses_fde'])
  })

  /* ---------------------------------------------------------------- *
   * §2–§4 — the three ways a grant fails, each refused whole
   * ---------------------------------------------------------------- */

  it('2 · a REVOKED grant binds nothing, and the refusal is not a grant oracle', async () => {
    await asMigrator('UPDATE tenant.session SET tenant_id = NULL WHERE id = $1', ['ses_fde'])
    await asMigrator('UPDATE tenant.tenant_access_grant SET revoked_at = now() WHERE id = $1', [
      GRANT,
    ])
    const res = await resolveContext(plane.url, ACME_HOST, FDE_HANDLE)
    assert.equal(res.status, 403, res.text)
    assert.equal(
      res.body?.['code'],
      'membership_absent',
      'G292 term 1. ⚠️ THE CODE IS `membership_absent` AND NOT `access_grant_absent`, ' +
        'AND THAT IS NOT A BUG: `server/data-plane/context.ts` maps every selection ' +
        'refusal onto one wire code today. The model DOES distinguish them — ' +
        '`TENANT_SELECTION_REFUSALS` has two members — and publishing the second is a ' +
        'contract change this slice did not make. Named here rather than discovered.',
    )
    await asMigrator('UPDATE tenant.tenant_access_grant SET revoked_at = NULL WHERE id = $1', [
      GRANT,
    ])
  })

  it('3 · a grant naming `statutory` FAILS WHOLE — invariant 8, at any price', async () => {
    /**
     * 🛑 THE THREE-LIST CHECK, OVER A SOCKET. `statutory` is the one class
     * invariant 8 refuses *"at any price"* and it is in
     * `NON_DELEGABLE_RESOURCES`, which `authorisationPermits()` tests FIRST.
     * The grant still carries a permitted `configuration` line: the point is
     * that the grant **fails whole** — *"the grant is the unit someone
     * approved"* — rather than quietly permitting the classes it does open.
     */
    await asMigrator('UPDATE tenant.session SET tenant_id = NULL WHERE id = $1', ['ses_fde'])
    await asMigrator(
      `INSERT INTO tenant.access_resource_grant (tenant_id, grant_id, resource)
       VALUES ($1, $2, 'statutory') ON CONFLICT DO NOTHING`,
      [ACME, GRANT],
    )
    const res = await resolveContext(plane.url, ACME_HOST, FDE_HANDLE)
    assert.equal(
      res.status,
      403,
      'A GRANT CLAIMING `statutory` BOUND A TENANT. Invariant 8: "a statutory ' +
        'obligation is not the customer\'s to delegate to a processor." Both halves ' +
        'must refuse it — the model through `authorisationPermits()` and the database ' +
        `through 0008's restrictive policy. Body: ${res.text}`,
    )
    await asMigrator(
      `DELETE FROM tenant.access_resource_grant
        WHERE tenant_id = $1 AND grant_id = $2 AND resource = 'statutory'`,
      [ACME, GRANT],
    )
  })

  it('4 · a grant past MAX_GRANT_HOURS for its purpose binds nothing', async () => {
    /**
     * 🛑 G292's THIRD TERM, AND IT IS THE ONE THE MEMBERSHIP ARM HAS NO NEED
     * OF: *"a property of the PREDICATE rather than of whoever issues the
     * grant — so a grant cannot be issued, or extended, past it."* There IS no
     * issuing path in this repository, which is precisely why the ceiling had
     * to land in the predicate. `incident` is 24 hours; this one claims 48.
     */
    await asMigrator('UPDATE tenant.session SET tenant_id = NULL WHERE id = $1', ['ses_fde'])
    await asMigrator(
      `UPDATE tenant.tenant_access_grant
          SET expires_at = granted_at + interval '48 hours'
        WHERE id = $1`,
      [GRANT],
    )
    const res = await resolveContext(plane.url, ACME_HOST, FDE_HANDLE)
    assert.equal(res.status, 403, res.text)
    await asMigrator(
      `UPDATE tenant.tenant_access_grant
          SET expires_at = granted_at + interval '2 hours'
        WHERE id = $1`,
      [GRANT],
    )
  })

  /* ---------------------------------------------------------------- *
   * §5 — the console surface
   * ---------------------------------------------------------------- */

  it('5a · a TENANT-BOUND session issued on a CONSOLE host is refused — 200 became 401', async () => {
    /**
     * 🛑 THE HARDENING, AND IT IS THE OTHER DIRECTION FROM §1. This row is one
     * the migrator can write and D1 cannot: a session carrying `ten_acme`,
     * issued on a host that serves no tenant. **Before G727 the plane served
     * it** — the console host meant nothing, the session was live and bound,
     * and its holder could reach that tenant's data through a surface that has
     * none. `resolveSubject()` now refuses at
     * `console_session_is_tenant_bound`, and every failure in this file's
     * authenticator is the same 401 by `PlaneOptions.authenticate`'s rule.
     *
     * ⚠️ THE SESSION BELONGS TO **MEI**, A LIVE MEMBER OF ACME, AND NOT TO THE
     * FDE — AND THAT CHOICE IS WHAT MAKES THIS ASSERTION LOAD-BEARING. A
     * tenant-bound session for a person with NO membership is refused anyway,
     * one layer later, by G641's per-request liveness check: the mutation that
     * deletes the console arm would leave the status code at 401 and this test
     * green. **Measured, not reasoned** — the first draft used the FDE's
     * session and survived exactly that mutation.
     */
    const res = await send(plane.url, '/v1/runs', {
      host: CONSOLE_HOST,
      session: BOUND_CONSOLE_HANDLE,
    })
    assert.equal(
      res.status,
      401,
      'A TENANT-BOUND SESSION WAS SERVED ON A CONSOLE HOST. That is tenant scope ' +
        'reaching a surface that has none, and it is the state `resolveSubject()`\'s ' +
        `console arm exists to refuse. Body: ${res.text}`,
    )
  })

  it('5b · DIFFERENTIAL — an UNBOUND session on the same console host authenticates', async () => {
    /**
     * ⚠️ WITHOUT THIS, §5a WOULD PASS ON A PLANE THAT REFUSED EVERY CONSOLE
     * HOST — which is the opposite of the owner's ruling and is the shape a
     * hardening most easily overshoots into.
     *
     * 🛑 AND BE PRECISE ABOUT WHAT THIS DOES **NOT** WITNESS, BECAUSE THE
     * TEMPTING READING IS WRONG. A 403 here is NOT evidence that a console
     * principal was resolved: **before G727 this fixture also answered 403** —
     * `resolveSubject()` refused it at `tenant_not_selected`, the reader
     * returned `principal: null`, and `capabilityAuthoriser()` refused a
     * tenant-less session at its first line. Same code, different reason, and
     * the reason is not on the wire.
     *
     * **This is a regression guard, and the ALLOW arm it guards is witnessed
     * at the model layer instead** — `tests/model/console-principal.test.ts`
     * §2a, where a tenant-less platform principal carrying a live
     * `PlatformRoleAssignment` is ALLOWED. It cannot be witnessed over a
     * socket in this repository because **no console operation is mounted**
     * (G602) and every capability-tier verb this plane does mount is of a
     * class `PLATFORM_ASSIGNMENT_REACHES` refuses. The commit that mounts the
     * first console operation owes this section a real differential.
     *
     * ✅ **THAT COMMIT IS G1241, 20 Sep 2026, AND THE DEBT IS PAID — IN
     * ANOTHER FILE. THE PARAGRAPH ABOVE IS CORRECTED RATHER THAN DELETED,
     * because its middle clause is still exactly why THIS assertion cannot be
     * the differential.** `listTenants` is mounted on this plane and a
     * tenant-less platform principal holding `view_substrate` answers **200**
     * — `tests/http/console-roster-served.test.ts` §1a, with §3a as its
     * refusing half. **What has not changed is this fixture**: `usr_fde_priya`
     * here holds no `platform_role_assignment` at all, and `/v1/runs` is still
     * a `tenant_data` verb the platform arm refuses by construction, so this
     * assertion is the same regression guard it always was and its 403 still
     * means what it meant. Giving it a platform assignment would turn a guard
     * about AUTHENTICATION into a second, weaker copy of the served
     * differential — §5.3, in a test.
     */
    const res = await send(plane.url, '/v1/runs', {
      host: CONSOLE_HOST,
      session: CONSOLE_HANDLE,
    })
    assert.equal(
      res.status,
      403,
      'A LIVE CONSOLE SESSION DID NOT AUTHENTICATE. 401 here means `resolveSubject()` ' +
        'refused it — the pre-G727 answer, `tenant_not_selected` — and the owner\'s ' +
        'ruling that `session.tenant_id = NULL` is legal on a console host has not ' +
        `been applied. Body: ${res.text}`,
    )
    assert.equal(res.body?.['code'], 'capability_not_held')
  })

  it('5c · G180 is unchanged — the console session is refused on a TENANT host AND revoked', async () => {
    /**
     * 🛑 THE COST THE OWNER NAMED, MEASURED RATHER THAN ASSUMED: *"G180's
     * revoke-on-mismatch … assume[s] a tenant, and a tenant-less session is a
     * new shape in the one place [it is] enforced."* It is a new shape and
     * G180 does not notice — the check compares two strings. **And the
     * tenant-less arm is the one that ALREADY revoked**, per
     * `server/data-plane/session.ts`'s measured note: *"membership live →
     * revoked; membership absent → NOT revoked"*, the uncovered case being a
     * BOUND session. A console session is never bound, so this arm is whole.
     */
    const res = await send(plane.url, '/v1/runs', {
      host: ACME_HOST,
      session: CONSOLE_HANDLE,
    })
    assert.equal(res.status, 401, res.text)

    const mig = await migratorClient()
    try {
      const rows = (
        await mig.query('SELECT revoked_at FROM tenant.session WHERE id = $1', ['ses_console'])
      ).rows as Array<Record<string, unknown>>
      assert.notEqual(
        rows[0]?.['revoked_at'],
        null,
        'G180 REFUSED AND DID NOT REVOKE. `model/serving-host.ts` names this as the ' +
          'likeliest lazy repair: "every mismatch test still passes, and a ' +
          'stolen-and-tossed session survives to be retried against the right host."',
      )
    } finally {
      await mig.end()
    }
  })
})

/* ==================================================================== *
 * MUTATIONS RUN, AND WHAT EACH CAUGHT
 * --------------------------------------------------------------------
 * Every one applied at the LAST WRITER, against a real PostgreSQL and a real
 * socket, then reverted. `tsc -p server/tsconfig.json` was GREEN under all
 * four.
 *
 *   S1  🛑 THE PRE-G729 STATE. Delete `staffGrant: staffGrant.grant` from
 *       `bindTenant()`'s call in `server/data-plane/context.ts` — which is
 *       exactly what the tree did yesterday.
 *       → 1 red, and only one: `1a`. Every other assertion in this file stays
 *          green, INCLUDING §2, §3 and §4 — the three grant-failure sections
 *          all assert a 403 and the mutant refuses harder. **A suite made only
 *          of refusals would have been green on the commit that deleted the
 *          feature**, which is why §1a is written as a status code rather than
 *          as a reason.
 *
 *   S2  The authenticator always answers the TENANT surface —
 *       `const surface = SERVED_SURFACE_KINDS.tenant`, the pre-G727 state.
 *       → 1 red: `5a`. §5b and §5c stay green under it, which is the honest
 *          result and is why §5b's own docblock says it is a regression guard
 *          rather than a witness.
 *
 *   S3  Delete the per-request staff disjunct in `resolveAuthority()` —
 *       `liveMembership || false && selectTenantForSession(…)`.
 *       → 1 red: `1d`. §1a stays GREEN, which is the point of §1d existing: a
 *          tree with S3 applied binds an FDE's tenant at D1 and refuses them
 *          on every request afterwards. **Scopeable and unusable**, and
 *          nothing else in the repository would have noticed.
 *
 *   S4  The disjunct accepts any grant ROW rather than a live one —
 *       `… .ok || authority.staffGrant.grant !== null`.
 *       → 1 red: `1e`. §1d stays green. G641's ruling is that liveness is
 *          checked on READ, and this is the mutation that turns the read back
 *          into an existence test.
 *
 * ⚠️ AND ONE MUTATION THAT SURVIVED A DRAFT OF THIS FILE, RECORDED BECAUSE THE
 * FIX IS THE INTERESTING PART. §5a's first fixture was the FDE's session —
 * tenant-bound, on the console host — and **S2 left it at 401 and the test
 * green**, because G641's per-request liveness check refuses a bound session
 * whose holder holds no membership, one layer later and for a different
 * reason. The fixture is MEI's now: a live member, so the only thing that can
 * refuse them on that host is the console arm. The same defect was found and
 * fixed in `tests/e2e/browser-login.test.ts` §21a.
 * ==================================================================== */

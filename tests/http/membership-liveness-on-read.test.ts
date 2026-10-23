/**
 * A MEMBERSHIP THAT LAPSES PURELY BY THE CLOCK — G641, 19 Sep 2026, OVER A
 * SOCKET, AGAINST A REAL PostgreSQL AND THE PRODUCTION AUTHORISER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 THE GAP THIS FILE CLOSES, AND WHY NOTHING ELSE COULD SEE IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `db/migrations/0035_membership_liveness_voids_sessions.sql` names it in its
 * own voice, having just repaired every neighbouring defect:
 *
 *     "🛑 AND WHAT IT DOES **NOT** CLOSE, NAMED RATHER THAN LEFT TO BE FOUND:
 *      **the CLOCK ARRIVING IS NOT AN `UPDATE`.** A membership that lapses
 *      purely by the passage of `expires_at`, with no statement written
 *      against the row, fires nothing — a trigger has no tick. The person's
 *      sessions stay live until their own `session.expires_at` passes …
 *      Closing it needs a reader-side liveness check or a sweeper, and neither
 *      is a trigger's to decide — it is put to the owner, not taken here."
 *
 * **THE OWNER RULED: check liveness on READ.** *"The per-request path treats a
 * lapsed membership as it treats a revoked one. No sweeper and no clock: the
 * person stops being authorised at their next request rather than being signed
 * out in the background."*
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 §2 IS THE DECISIVE ASSERTION AND IT COSTS A FEW SECONDS OF WALL CLOCK.
 *    THAT IS NOT LAZINESS — IT IS THE ONLY HONEST WAY TO WRITE IT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The obvious fixture is `UPDATE tenant.membership SET expires_at = now() -
 * interval '1 hour'`. **It would assert the wrong thing**: that `UPDATE` is a
 * statement, so `0035`'s `AFTER UPDATE … WHEN (NOT liveness)` trigger FIRES,
 * voids the sessions, and the next request is refused `session_revoked` —
 * through the control that already existed, with G641 never consulted. The
 * test would be green with the read-side check deleted.
 *
 * So the membership below is seeded with an expiry a few seconds out and
 * **nothing is ever written to the row again**. §2 waits for `now()` to pass
 * it — the trigger is `AFTER UPDATE`, so no statement means no fire — and then
 * makes one request. §2 also asserts, from the catalogue, that the session row
 * is still unrevoked and still unexpired and that the membership's
 * `revoked_at` is still NULL: **everything the old controls look at is
 * untouched, and the person is refused anyway.**
 *
 * ⚠️ AND §1 IS NOT DECORATION. The SAME handle is served 200 two assertions
 * earlier, while the membership is live. Without that, §2's 401 could be a
 * fixture that never worked — `docs/HANDOFF.md` §5.6, which this repository
 * has been caught by repeatedly. §4 adds the other half of the differential:
 * a person whose membership does NOT lapse is still served AFTER the lapse, so
 * the 401 is about the person and not about the plane falling over.
 *
 * 🛑 NO `authorise` OPTION AND NO `substrate` ARGUMENT. The plane takes the
 * production authoriser, exactly as `tests/http/identity-substrate-served
 * .test.ts` does and for its reason: a plane that 403s everything would let
 * every assertion here pass while proving nothing.
 *
 * Compiles under: tsc -p tests/tsconfig.json --noEmit
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
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
 * ITS OWN DATABASE. Set before the first call that reads it — the
 * contended resource is the shared cluster, not the schema.
 * ------------------------------------------------------------------ */

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_MEMBERSHIP_LIVENESS_DB_NAME'] ?? runScopedName('reconcile_membership_liveness_test')

/** G299's fixtures delete this for the same reason: with the flag, nothing resolves a subject. */
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME_HOST = 'acme.ap-southeast-1.reconcile.invalid'
const GLOBEX_HOST = 'globex.ap-southeast-1.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|ten_acme|ap-southeast-1|pooled|active,` +
  `${GLOBEX_HOST}|ten_globex|ap-southeast-1|pooled|active`

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'

const DOOR = 'idc_acme_entra'
const BROKER_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_TESTPOOL'
const ROLE = 'rol_ap_approver'

/**
 * FOUR PEOPLE, AND EACH EXISTS FOR EXACTLY ONE ARM. Every one of them holds
 * the same live role assignment, so `held` is never the term under test — the
 * only thing that differs between them is their membership.
 */
/** Membership never expires. The control, and the ALLOW. */
const MEI = 'usr_ops_mei'
/** Membership expires a few seconds after the fixture is written. §2. */
const LEE = 'usr_ops_lee'
/** No membership row at all, anywhere. §3. */
const NIA = 'usr_ops_nia'
/** A live membership in GLOBEX and none in ACME. §5. */
const RAJ = 'usr_ops_raj'

const HANDLE = {
  mei: 'sh_mei_2a7f14c9e0b34d658c19af23be74d105',
  lee: 'sh_lee_6c03b81d5f7e42a9b408d1e7c53a9f26',
  nia: 'sh_nia_91d4e702b6a54c38af71059e2c8b6d43',
  raj: 'sh_raj_4e18c07a9d2b436f85c0132ae6f7b9d8',
} as const

/**
 * 🛑 HOW LONG THE LAPSE TAKES, AND WHY IT IS A CONSTANT WITH A NOTE.
 *
 * Long enough that §1 reliably runs BEFORE it (the ALLOW must be observed
 * while the membership is live, or the differential is lost), short enough
 * that the suite is not a sleep. §2 does not trust it either way: it POLLS the
 * database for `expires_at <= now()` rather than assuming the wall clock here
 * and the clock in PostgreSQL agree.
 */
const LAPSE_SECONDS = 5

const probe = await probeDatabase()
const skip = probe.ok
  ? false
  : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the membership-liveness-on-read test', probe)

/* ------------------------------------------------------------------ *
 * `node:http` RATHER THAN `fetch`, for `tests/http/context-resolve.test.ts`'s
 * reason: undici derives `Host` from the URL on some paths, and G180 compares
 * it against `Session.issuedHost` on EVERY request — so a helper that quietly
 * sent `127.0.0.1:<port>` would make every answer below a statement about a
 * binding this test did not choose.
 * ------------------------------------------------------------------ */

interface Response {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
  readonly text: string
}

function get(origin: string, path: string, opts: { host: string; handle: string }): Promise<Response> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        headers: { Host: opts.host, ...sessionCookie(opts.handle) },
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

async function query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
  const mig = await migratorClient()
  try {
    const r = await mig.query(sql, params as unknown[])
    return r.rows as T[]
  } finally {
    await mig.end()
  }
}

async function seed(): Promise<void> {
  const mig = await migratorClient()
  try {
    await mig.query('BEGIN')
    await mig.query(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id,
          broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme',
               $2, 'acme-entra', 'active')
       ON CONFLICT DO NOTHING`,
      [DOOR, BROKER_ISSUER],
    )
    for (const [user, email] of [
      [MEI, 'mei@acme.invalid'],
      [LEE, 'lee@acme.invalid'],
      [NIA, 'nia@acme.invalid'],
      [RAJ, 'raj@acme.invalid'],
    ] as const) {
      await mig.query(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $2, $1, 'active', $3)
         ON CONFLICT DO NOTHING`,
        [user, email, DOOR],
      )
    }
    /* One role, one capability, one assignment each — so `held` is constant
     * across all four people and cannot be the term that differs. */
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
      [ACME, ROLE, CAPABILITIES.viewException /* G3801: run reads are view_exception */],
    )
    for (const user of [MEI, LEE, NIA, RAJ] as const) {
      await mig.query(
        `INSERT INTO tenant.role_assignment
           (tenant_id, id, user_id, role_id, role_version,
            granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 3, 'usr_acme_admin', now(), NULL, NULL)
         ON CONFLICT DO NOTHING`,
        [ACME, `ras_${user}`, user, ROLE],
      )
    }

    /* ────────────────────────────────────────────────────────────────
     * THE MEMBERSHIPS. THE ONLY THING THAT DIFFERS BETWEEN THE FOUR.
     *
     * 🛑 LEE's ROW IS WRITTEN LIVE AND IS NEVER WRITTEN AGAIN. `0035`'s
     *    trigger is `AFTER UPDATE`, and this is an INSERT of a row that IS
     *    live at insert, so it fires nothing now and — because no statement
     *    ever touches the row again — it fires nothing when the clock passes
     *    either. That is the gap, reproduced rather than described.
     *    ⚠️ IT IS NOT IN THIS STATEMENT ANY MORE: `seedLapsingMembership()`
     *    writes it after the plane boots, so the boot is outside its budget
     *    (G4156). MEI's and RAJ's never lapse and stay here.
     * ──────────────────────────────────────────────────────────────── */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_mei', $3, $5, 'bootstrap', now(), NULL, NULL),
              ($2, 'mem_raj_globex', $4, $5, 'bootstrap', now(), NULL, NULL)`,
      /* 🛑 NIA IS ABSENT FROM THIS LIST ON PURPOSE AND IT IS THE §3 FIXTURE:
         no membership row in any tenant. A first draft bound NIA to an unused
         `$5` and PostgreSQL refused the statement outright — *"could not
         determine data type of parameter $5"* — which is the database saying
         the same thing this comment does. */
      [ACME, GLOBEX, MEI, RAJ, ROLE],
    )

    for (const [id, user, handle] of [
      ['ses_mei', MEI, HANDLE.mei],
      ['ses_lee', LEE, HANDLE.lee],
      ['ses_nia', NIA, HANDLE.nia],
      ['ses_raj', RAJ, HANDLE.raj],
    ] as const) {
      const digest = digestOfHandle(handle)
      assert.notEqual(digest, null, `the ${user} fixture handle digested to nothing`)
      /* 🛑 EVERY SESSION IS BOUND TO ACME AND ISSUED ON ACME'S HOST, and three
         of the four are states `selectTenantForSession()` would refuse to
         produce — which is the point: the question G641 answers is what
         happens to a session that is ALREADY bound when its membership stops
         being live. A seed is the only thing that can put NIA and RAJ there. */
      await mig.query(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6,
                 now(), now(), now() + interval '12 hours', NULL)
         ON CONFLICT DO NOTHING`,
        [id, digest, user, DOOR, ACME, ACME_HOST],
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

/**
 * LEE's LAPSING MEMBERSHIP — written LAST, after the plane is listening (G4156).
 *
 * 🛑 IT WAS WRITTEN IN `seed()`, BEFORE `startDataPlane()`, AND THAT PUT THE
 * PLANE'S WHOLE BOOT INSIDE THE FIVE-SECOND BUDGET §1 NEEDS. Booting reads and
 * compiles every contract tier, so on a machine running two gates it ate the
 * budget and §1 was answered after the lapse — G3915's second item, a 401 where
 * the ALLOW should be. Nothing about the property moved: this is still an
 * INSERT of a row that is live at insert, `0035`'s trigger is `AFTER UPDATE`,
 * and no statement ever touches the row again. What moved is that the clock
 * starts at the last write before §1's request instead of before the boot.
 * ⚠️ `LAPSE_SECONDS` IS NOT WIDENED: the budget now covers one request.
 */
async function seedLapsingMembership(): Promise<void> {
  await query(
    `INSERT INTO tenant.membership
       (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
     VALUES ($1, 'mem_lee', $2, $3, 'bootstrap', now(),
             now() + ($4 || ' seconds')::interval, NULL)`,
    [ACME, LEE, ROLE, String(LAPSE_SECONDS)],
  )
}

/** Poll the DATABASE's clock, never this process's. */
async function waitForLapse(): Promise<void> {
  const deadline = Date.now() + (LAPSE_SECONDS + 15) * 1000
  for (;;) {
    const rows = await query<{ lapsed: boolean }>(
      `SELECT (expires_at <= now()) AS lapsed FROM tenant.membership WHERE id = 'mem_lee'`,
    )
    const row = rows[0]
    assert.notEqual(row, undefined, 'the lapsing membership row is gone — the fixture is wrong')
    if (row?.lapsed === true) return
    assert.ok(
      Date.now() < deadline,
      `the membership did not lapse within ${LAPSE_SECONDS + 15}s. Either the fixture was ` +
        'written with the wrong interval or PostgreSQL`s clock is not advancing.',
    )
    await sleep(250)
  }
}

describe('a membership that lapses by the clock stops authorising at the next request', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /* No `authorise` option: the PRODUCTION authoriser. `poolMax: 1` is
     * adversarial on purpose — the session scope, the tenant scope and the
     * handler's own read are forced onto one connection. */
    plane = await startDataPlane({ poolMax: 1 })
    await seedLapsingMembership()
  })

  after(async () => {
    if (plane !== undefined) await plane.close()
  })

  const listRuns = (handle: string, host: string = ACME_HOST): Promise<Response> =>
    get(plane.url, '/v1/runs', { host, handle })

  /* ================================================================ *
   * §1 · THE ALLOW — the SAME handle §2 refuses, while it is live.
   * ================================================================ */

  it('1 · a live membership is SERVED — and this is the handle §2 refuses', async () => {
    const res = await listRuns(HANDLE.lee)
    assert.equal(
      res.status,
      200,
      'the lapsing fixture was never served AT ALL, so §2`s 401 would prove nothing — ' +
        '`docs/HANDOFF.md` §5.6. The chain to check: the session row is live and bound to ' +
        'ACME; `issued_host` equals the Host header (G180); the `user` and ' +
        '`identity_connection` rows are active; the assignment is pinned to the role`s ' +
        `CURRENT version; and the membership has not lapsed yet. Got ${res.status}: ${res.text}`,
    )
  })

  it('1a · and so is the control, whose membership never expires', async () => {
    const res = await listRuns(HANDLE.mei)
    assert.equal(res.status, 200, `the control was refused ${res.status}: ${res.text}`)
  })

  /* ================================================================ *
   * §2 · THE DECISIVE ONE. Nothing is written. The clock arrives.
   * ================================================================ */

  it('2 · THE CLOCK ARRIVES, NOTHING IS WRITTEN, AND THE NEXT REQUEST IS REFUSED', async () => {
    await waitForLapse()

    /**
     * 🛑 EVERY PRE-EXISTING CONTROL IS ASSERTED UNTOUCHED **BEFORE** THE
     * REQUEST, BECAUSE THAT IS WHAT MAKES THE 401 BELOW ATTRIBUTABLE.
     *
     * If the session were revoked, the refusal would be `session_revoked` and
     * would prove `0019`/`0035`'s trigger works — which it does, and which is
     * not what this file is about. If the session had expired, the refusal
     * would be `session_expired`. Both are ruled out here, from the
     * catalogue, as the migrator.
     */
    const before = await query<{
      session_revoked: string | null
      session_live: boolean
      membership_revoked: string | null
    }>(
      `SELECT s.revoked_at                AS session_revoked,
              (s.expires_at > now())      AS session_live,
              m.revoked_at                AS membership_revoked
         FROM tenant.session s, tenant.membership m
        WHERE s.id = 'ses_lee' AND m.id = 'mem_lee'`,
    )
    const state = before[0]
    assert.notEqual(state, undefined, 'the fixture rows are gone')
    assert.equal(
      state?.session_revoked,
      null,
      'THE SESSION WAS REVOKED, so the refusal below would be `session_revoked` and this ' +
        'test would be measuring `0019`/`0035``s trigger instead of G641. A trigger has ' +
        'no tick: nothing wrote to the membership row, so nothing should have fired.',
    )
    assert.equal(
      state?.session_live,
      true,
      'the session expired on its own, which is the containment `0035` says a lapsed ' +
        'member currently waits for. This test exists because that wait is the gap.',
    )
    assert.equal(
      state?.membership_revoked,
      null,
      'the membership was REVOKED rather than left to lapse, so this is the case the ' +
        'trigger already covered and not the one the owner ruled on.',
    )

    const res = await listRuns(HANDLE.lee)
    assert.equal(
      res.status,
      401,
      'A PERSON WHOSE MEMBERSHIP HAS LAPSED WAS STILL SERVED. This is the gap ' +
        '`db/migrations/0035` named and put to the owner — "the CLOCK ARRIVING IS NOT AN ' +
        '`UPDATE` … a trigger has no tick" — and G641 is the ruling: check liveness on ' +
        'READ. The check is in `resolveAuthority()` in `server/data-plane/session.ts`, ' +
        `through \`holdsLiveMembership()\`. Got ${res.status}: ${res.text}`,
    )
    assert.equal(
      res.body?.['code'],
      'session_invalid',
      'a lapsed member must be refused as UNAUTHENTICATED and with no reason. A 403 ' +
        'would say the session is fine and the authority is not, which is the opposite ' +
        'of what happened; and naming the term would tell whoever holds the handle that ' +
        'their membership lapsed and roughly when — the oracle ' +
        '`TENANT_SELECTION_REFUSALS.membershipAbsent` refuses to build one step earlier.',
    )
  })

  it('2a · AND THE SESSION IS STILL NOT REVOKED — "no sweeper and no clock"', async () => {
    const rows = await query<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM tenant.session WHERE id = 'ses_lee'`,
    )
    assert.equal(
      rows[0]?.revoked_at,
      null,
      'the refused request REVOKED the session. The owner ruled the opposite in as many ' +
        'words: "No sweeper and no clock: the person stops being authorised at their next ' +
        'request rather than being signed out in the background." A read-side check that ' +
        'writes is a sweeper with a trigger for a schedule.',
    )
  })

  /* ================================================================ *
   * §3 · THE ABSENT ARM. Refused for the same reason, by the same term.
   * ================================================================ */

  it('3 · a bound session whose owner has NO membership row is refused too', async () => {
    const res = await listRuns(HANDLE.nia)
    assert.equal(
      res.status,
      401,
      'a bound session whose owner holds no membership at all was served. The narrow ' +
        'reading — refuse only when rows EXIST and none is live — is `docs/HANDOFF.md` ' +
        '§5.1, a rule keyed on the presence of a row instead of on the property, and it ' +
        `fails OPEN: deleting the row would buy a permanent session. Got ${res.status}`,
    )
    assert.equal(res.body?.['code'], 'session_invalid')
  })

  /* ================================================================ *
   * §4 · THE OTHER HALF OF THE DIFFERENTIAL.
   * ================================================================ */

  it('4 · the control is STILL served after the lapse — the plane did not fall over', async () => {
    const res = await listRuns(HANDLE.mei)
    assert.equal(
      res.status,
      200,
      'the person whose membership did NOT lapse stopped being served too, so §2`s 401 ' +
        'is a statement about the plane rather than about the person. Every refusal in ' +
        `this file is vacuous if this one is red. Got ${res.status}: ${res.text}`,
    )
  })

  /* ================================================================ *
   * §5 · THE TENANT TERM. A membership elsewhere is not a membership here.
   * ================================================================ */

  /**
   * 🛑 WHAT §5 ACTUALLY WITNESSES, MEASURED BY MUTATION RATHER THAN ASSUMED —
   *    AND IT IS NOT THE MODEL'S TENANT TERM.
   *
   * The call site was mutated to pass `authority.memberships[0]?.tenantId ??
   * subject.tenantId` — a deliberately wrong tenant argument — and **§5 stayed
   * GREEN**. The reason is that `readMemberships()` runs inside
   * `withTenantScope(subject.tenantId)`, so `membership_rls` has already
   * narrowed the rows to the bound tenant and RAJ's GLOBEX row is simply not
   * in the array. **The refusal here is the POLICY's, not the predicate's.**
   *
   * That is recorded rather than tidied away, because it changes what this
   * assertion may be quoted for. It is a true end-to-end property — a live
   * membership in another tenant does not admit you here — and it is the
   * DATABASE holding it. The model's own tenant term is defence in depth on
   * this path and is witnessed where it can be: `tests/model/membership-
   * liveness.test.ts` §3b, where a mutation that deletes it goes red.
   *
   * ⚠️ AND THE CALL SITE'S TENANT ARGUMENT IS WITNESSED IN THE OTHER
   * DIRECTION: passing a hard-wrong tenant reddens §1, §1a, §4 and §6,
   * because then nothing matches for anybody.
   */
  it('5 · a LIVE membership in ANOTHER tenant does not admit you to this one', async () => {
    const res = await listRuns(HANDLE.raj)
    assert.equal(
      res.status,
      401,
      'a live GLOBEX membership admitted a session bound to ACME. The per-request check ' +
        'passes `ResolvedSubject.tenantId`, which is the tenant the session is bound to ' +
        'and which G180 re-checks against the host on the same request — so a row for ' +
        `another tenant must not match. Got ${res.status}: ${res.text}`,
    )
    assert.equal(res.body?.['code'], 'session_invalid')
  })

  it('5a · and the GLOBEX row really is live, so §5 is not passing on a dead fixture', async () => {
    const rows = await query<{ live: boolean }>(
      `SELECT (revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS live
         FROM tenant.membership WHERE id = 'mem_raj_globex'`,
    )
    assert.equal(
      rows[0]?.live,
      true,
      '§5`s GLOBEX membership is not live, so §5 would pass even if the tenant term were ' +
        'deleted from `holdsLiveMembership()`.',
    )
  })

  /* ================================================================ *
   * §6 · THE HOST IS NOT THE THING BEING TESTED, AND IS RULED OUT.
   * ================================================================ */

  it('6 · every refusal above happened on the session`s OWN host', async () => {
    /**
     * `checkHostBinding()` runs BEFORE `resolveSubject()` and before the
     * membership check, so a mismatched host would refuse earlier and every
     * assertion above would be measuring G180. Every request in this file
     * sends `ACME_HOST`, which is `issued_host` for all four sessions; this
     * asserts the other direction once, so the reader can see that the
     * refusals above are NOT that.
     */
    const ownHost = await listRuns(HANDLE.mei, ACME_HOST)
    assert.equal(
      ownHost.status,
      200,
      'the control is refused on its OWN host, so this file`s other assertions cannot be ' +
        'read as being about membership at all.',
    )
    /* 🛑 THIS ORDER IS FORCED AND IS NOT A STYLE CHOICE. G180 REVOKES on a
       mismatch, and the control`s membership is live, so the revoke SUCCEEDS —
       which is why the own-host call comes first and why this section is last
       in the file. Reversed, the second assertion would be measuring a session
       the first assertion had just destroyed. */
    const wrongHost = await listRuns(HANDLE.mei, GLOBEX_HOST)
    assert.equal(
      wrongHost.status,
      401,
      'G180 did not refuse a session presented on another tenant`s host, which would ' +
        'mean the host term is not being checked at all and the refusals above could be ' +
        'anything.',
    )
  })
})

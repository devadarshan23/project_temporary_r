/**
 * G180 REVOKES A TENANT-**BOUND** SESSION, NOT ONLY AN UNBOUND ONE.
 *
 * ┌─ THE DEFECT, AND IT WAS FOUND TWICE ON THE SAME DAY FROM OPPOSITE MANDATES ┐
 * │ An adversarial pass and a build slice, working independently, reached the  │
 * │ same finding — which is `docs/model-change-ledger.md`'s convergence rule    │
 * │ earning its place, so this is recorded as SETTLED rather than suspected.   │
 * │                                                                            │
 * │ `checkHostBinding()` returns `{ ok: false, revoke: true }`, the request is │
 * │ refused, and the revoking `UPDATE` ran inside `withSessionScope()` — which │
 * │ sets `app.session_ref` and **deliberately not `app.tenant_id`**.           │
 * │ `session_selection_restrictive` (`0005`) is a RESTRICTIVE `FOR ALL … WITH  │
 * │ CHECK` whose membership subquery is itself narrowed by `membership_rls` on │
 * │ `app.tenant_id`. With no tenant scope it DENIES.                           │
 * │                                                                            │
 * │ 🛑 SO THE MEASURED BEHAVIOUR WAS:                                          │
 * │                                                                            │
 * │   session          request     revoked_at after                            │
 * │   UNBOUND (NULL)   401         set      — revoked                          │
 * │   BOUND            401         **null** — NOT revoked                      │
 * │                                                                            │
 * │ **The revocation worked for every session that does not matter and failed  │
 * │ for every session that does.** Every real session is bound.                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY EVERY EXISTING ASSERTION WAS GREEN ──────────────────────────────────┐
 * │ `tests/http/context-resolve.test.ts` has *"a session presented on another  │
 * │ tenant's host is 401 AND is revoked"* and it passes — because it drives    │
 * │ the **foundation** path, which already runs inside `withSelectionScope()`  │
 * │ (both GUCs). The **gated** path in `server/data-plane/session.ts` did not. │
 * │ Every other revoke assertion tosses a session that never reached D1, so it │
 * │ takes the `tenant_id IS NULL` arm — the arm that worked.                   │
 * │                                                                            │
 * │ **So the suite proved the property on the one shape where it held.** That  │
 * │ is `docs/HANDOFF.md` §5.1 again: a rule keyed on a convenient landmark —   │
 * │ here, the session the fixture happened to build — instead of the property. │
 * │ This file exists to assert it on the shape that matters.                   │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ `0005` QUOTES THE EXACT ERROR STRING THIS PRODUCED, in its own comment, and
 * says the policy *"is satisfiable ONLY inside a transaction that ALSO carries
 * `app.tenant_id`"*. The fact was written down. Nobody joined it to this path,
 * because the failure was swallowed into a `console.error` and a denied
 * `UPDATE` looked exactly like a successful one from outside.
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
import { SESSION_COOKIE } from '../../server/data-plane/session-cookie.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_G180_REVOKE_DB_NAME'] ?? runScopedName('reconcile_g180_revoke_test')

delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const ACME_HOST = 'acme.revoke.reconcile.invalid'
const GLOBEX_HOST = 'globex.revoke.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|${ACME}|ap-southeast-1|delegated|active,` +
  `${GLOBEX_HOST}|${GLOBEX}|ap-southeast-1|delegated|active`

const MEI = 'usr_ops_mei'
const DOOR = 'idc_acme_entra'
const ROLE = 'rol_ap_approver'
const BROKER_ISSUER = 'https://login.microsoftonline.com/acme-revoke/v2.0'
const BROKER_REF = 'acme-entra-revoke'

/** Bound to ACME and issued on ACME's host. The shape that matters. */
const BOUND = 'revoke_bound_5f2a9c31e04b7d68a25c93e1f7b80d4a'
/** Never reached D1, so `tenant_id` is NULL. The shape that already worked. */
const UNBOUND = 'revoke_unbound_0c73e15b9a4d28f6e831ac05b7d2694f'

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the G180 bound-session revoke suite', probe)

function get(origin: string, presentedHost: string, session: string): Promise<number> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path: '/v1/runs',
        method: 'GET',
        /*
         * 🛑 A COOKIE, NOT `X-Session`, SINCE G386. The production plane holds
         * no code that reads the header at all — `tests/e2e/browser-login.
         * test.ts` §13 asserts exactly that, and the header survives only
         * behind `RECONCILE_LOCAL_TEST_AUTH`, reached through a dynamic import
         * that a plane started without the flag never loads.
         *
         * ⚠️ THE FIRST DRAFT OF THIS FILE SENT THE HEADER AND WAS GREEN
         * STANDALONE AND RED IN THE GATE — because it predates G386's merge.
         * A 401 for "no credential" looks identical to a 401 for "host
         * mismatch", so the suite would have asserted the right outcome for
         * entirely the wrong reason.
         */
        headers: { Host: presentedHost, Cookie: `${SESSION_COOKIE}=${session}` },
      },
      (res) => {
        res.resume()
        res.on('end', () => resolve(res.statusCode ?? 0))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

/** Migrator, because the app role cannot read another tenant's session row. */
async function revokedAt(sessionId: string): Promise<string | null> {
  const mig = await migratorClient()
  try {
    const r = await mig.query(`SELECT revoked_at FROM tenant.session WHERE id = $1`, [sessionId])
    /* 🛑 THROWS ON A MISSING ROW. A first draft of this helper returned `null`
     * for "no such session", which is the same value as "not revoked" — so the
     * set-up would have passed against an absent fixture and §1 would have
     * proved nothing. §5.6, caught by hand. */
    if (r.rows.length === 0) throw new Error(`no session row \`${sessionId}\` — the fixture is wrong`)
    const row = r.rows[0] as { revoked_at: Date | null }
    return row.revoked_at === null ? null : row.revoked_at.toISOString()
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
       VALUES ($1,'oidc','Acme Entra ID','customer',NULL,'acc_acme',$2,$3,'active')`,
      [DOOR, BROKER_ISSUER, BROKER_REF],
    )
    await mig.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ($1,'mei@acme.invalid','Mei Tan','active',$2)`,
      [MEI, DOOR],
    )
    await mig.query(
      `INSERT INTO tenant.role
         (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ($1,$2,'AP Approver','approver',3,'operator','pack','pck_ap','active')`,
      [ACME, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1,$2,$3)`,
      [ACME, ROLE, CAPABILITIES.admitSource],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1,'ras_mei',$2,$3,3,'usr_acme_admin',now(),NULL,NULL)`,
      [ACME, MEI, ROLE],
    )
    /* BOUND — `tenant_id` set, and a live membership so the restrictive
     * policy's subquery has something to find. */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1,'mem_mei',$2,$3,'usr_acme_admin',now(),NULL,NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_bound',$1,$2,$3,$4,$5,now(),now(),now() + interval '12 hours',NULL)`,
      [digestOfHandle(BOUND), MEI, DOOR, ACME, ACME_HOST],
    )
    /* UNBOUND — `tenant_id` NULL. The arm that already revoked. */
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_unbound',$1,$2,$3,NULL,$4,now(),now(),now() + interval '12 hours',NULL)`,
      [digestOfHandle(UNBOUND), MEI, DOOR, ACME_HOST],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('G180 revokes a tenant-BOUND session on a host mismatch', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /* Production seams — no `authorise`, no `substrate`. */
    plane = await startDataPlane({ poolMax: 4 })
  })

  after(async () => {
    await plane?.close()
  })

  it('0 · both fixtures start unrevoked, so §1 and §2 cannot pass on a stale row', async () => {
    assert.equal(await revokedAt('ses_bound'), null)
    assert.equal(await revokedAt('ses_unbound'), null)
  })

  /**
   * 🛑 THE ASSERTION EVERY EXISTING SUITE MISSED.
   */
  it('1 · a BOUND session presented on another tenant\'s host is refused AND revoked', async () => {
    const status = await get(plane.url, GLOBEX_HOST, BOUND)
    assert.equal(status, 401, 'the binding check itself failed — this is not the revoke defect')

    assert.notEqual(
      await revokedAt('ses_bound'),
      null,
      'G180 refused the request and did NOT revoke the session. `checkHostBinding()` ' +
        'returns `{ revoke: true }` and the UPDATE was denied by ' +
        '`session_selection_restrictive`, because the revoke ran under a scope ' +
        'carrying `app.session_ref` and not `app.tenant_id`. Every real session is ' +
        'BOUND, so this is the shape that matters: a stolen handle replayed against ' +
        'the wrong host stays live for the next attempt.',
    )
  })

  /**
   * ⚠️ THE ARM THAT ALREADY WORKED, KEPT AS A CONTROL. If a future change fixed
   * the bound arm by breaking this one, §1 alone would report success.
   */
  it('2 · an UNBOUND session is still refused AND revoked — the arm that already worked', async () => {
    const status = await get(plane.url, GLOBEX_HOST, UNBOUND)
    assert.equal(status, 401)
    assert.notEqual(
      await revokedAt('ses_unbound'),
      null,
      'the unbound arm regressed — it revoked before the bound arm was fixed, and ' +
        'a fix that trades one arm for the other is not a fix',
    )
  })
})

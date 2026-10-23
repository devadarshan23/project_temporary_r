/**
 * `listRuns` PAGES TO EXHAUSTION WITHOUT LOSING A ROW.
 *
 * ┌─ WHY THIS FILE EXISTS, AND IT IS THE SHARPEST LESSON OF THE DAY ──────────┐
 * │ An adversarial pass found that `listRuns` — the OLDEST mounted collection  │
 * │ read — silently dropped rows and reported the register complete. Its       │
 * │ observation is the reason this file exists and is worth quoting:           │
 * │                                                                            │
 * │   **The two paginated reads that DO have a paging test — `listRunResidue`  │
 * │   and `listExceptions` — are the two that are correct. The one with no     │
 * │   paging test is the broken one.**                                         │
 * │                                                                            │
 * │ `grep -rn nextCursor tests/http/data-plane-http.test.ts` returned only     │
 * │ assertions about the SHAPE of the field. **No test had ever followed a     │
 * │ server-issued `listRuns` cursor**, so a keyset that matched nothing looked │
 * │ exactly like a register that had ended.                                    │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE DEFECT, MEASURED ─────────────────────────────────────────────────────┐
 * │ `timestamptz` keeps MICROseconds. A JavaScript `Date` keeps MILLIseconds.  │
 * │ The cursor was `row.started_at.toISOString()`, so a stored                 │
 * │ `…10:00:00.123456+00` became `…123Z`, and                                  │
 * │ `(started_at, id) < ($1::timestamptz, $2)` then excluded **every row       │
 * │ sharing the boundary row's millisecond.**                                  │
 * │                                                                            │
 * │ ⚠️ THE FIXTURE BELOW IS NOT CONTRIVED. Rows inserted in one transaction    │
 * │ all carry `transaction_timestamp()`, identical to the microsecond — which  │
 * │ is exactly what `server/dev/seed.ts` does and what every run fixture in    │
 * │ this repository does. A bulk-loaded or backfilled tenant is the WORST      │
 * │ case, not an edge case: it loses everything after page one.                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * 🛑 THIS SUITE FOLLOWS THE SERVER'S OWN `nextCursor` AND NEVER CONSTRUCTS ONE.
 * A test that builds its own cursor tests the decoder; the defect was in the
 * ENCODER, and only a round trip could see it. That is the whole design of §1.
 *
 * ⚠️ `?limit=1` IS REACHABLE BY ANY CLIENT TODAY — `components.parameters.Limit`
 * is `minimum: 1` — so this is not a fixture-only path. `frontend/src/api/
 * runs.ts` sends `cursor` and no `limit`, which makes it a live consumer of
 * exactly this behaviour once a tenant passes the default page size.
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
  process.env['RECONCILE_LIST_RUNS_PAGING_DB_NAME'] ?? runScopedName('reconcile_list_runs_paging_test')

delete process.env['RECONCILE_LOCAL_TEST_AUTH']

const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
const ACME_HOST = 'acme.paging.reconcile.invalid'
const GLOBEX_HOST = 'globex.paging.reconcile.invalid'

process.env['RECONCILE_SERVING_HOSTS'] =
  `${ACME_HOST}|${ACME}|ap-southeast-1|delegated|active,` +
  `${GLOBEX_HOST}|${GLOBEX}|ap-southeast-1|delegated|active`

const MEI = 'usr_ops_mei'
const DOOR = 'idc_acme_entra'
const ROLE = 'rol_ap_approver'
const HANDLE = 'paging_mei_7b31f0c4a8d2e6590a1b3c4d5e6f7081'

/** G304's handle is a PAIR, and `PROTOCOL_IS_BROKERED.oidc` is `true`, so an
 *  `oidc` door without one is `broker_unresolvable`. */
const BROKER_ISSUER = 'https://login.microsoftonline.com/acme-paging/v2.0'
const BROKER_REF = 'acme-entra-paging'

/** 🛑 SIX, AND THEY SHARE A TIMESTAMP TO THE MICROSECOND. See the header. */
const RUN_COUNT = 6

const probe = await probeDatabase()
const skip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`

databaseRequiredUnderCi('the listRuns paging suite', probe)

interface Res {
  readonly status: number
  readonly body: Record<string, unknown> | undefined
}

/** `node:http`, not `fetch` — undici derives `Host` from the URL on some paths,
 *  and G180 compares `request.headers.host` on every request. */
function get(origin: string, path: string, session: string): Promise<Res> {
  const url = new URL(origin)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'GET',
        /*
         * 🛑 A COOKIE, NOT `X-Session`, SINCE G386 — the production plane holds
         * no code that reads the header at all, and it survives only behind
         * `RECONCILE_LOCAL_TEST_AUTH` through an import an unflagged plane
         * never loads. The first draft sent the header and was GREEN
         * STANDALONE, RED IN THE GATE.
         */
        headers: { Host: ACME_HOST, Cookie: `${SESSION_COOKIE}=${session}` },
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c: string) => {
          text += c
        })
        res.on('end', () => {
          let body: Record<string, unknown> | undefined
          try {
            const p: unknown = JSON.parse(text)
            body = typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : undefined
          } catch {
            body = undefined
          }
          resolve({ status: res.statusCode ?? 0, body })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function seed(): Promise<void> {
  const digest = digestOfHandle(HANDLE)
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
      [ACME, ROLE, CAPABILITIES.viewException /* G3801: run reads are view_exception */],
    )
    await mig.query(
      `INSERT INTO tenant.role_assignment
         (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1,'ras_mei',$2,$3,3,'usr_acme_admin',now(),NULL,NULL)`,
      [ACME, MEI, ROLE],
    )
    await mig.query(
      `INSERT INTO tenant.session
         (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
          authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_paging',$1,$2,$3,$4,$5,now(),now(),now() + interval '12 hours',NULL)`,
      [digest, MEI, DOOR, ACME, ACME_HOST],
    )
    /*
     * 🛑 THE MEMBERSHIP ROW IS NOT DECORATION — G641, 19 Sep 2026.
     *
     * The session above is BOUND to a tenant, and a bound session is a state
     * only `selectTenantForSession()` can produce — which binds on a LIVE
     * membership (G199) or on a staff grant nothing here supplies. Since G641
     * the per-request path re-asks that question on EVERY request, through the
     * same `holdsLiveMembership()` the binding uses, because a membership that
     * lapses by the clock writes no statement and fires no trigger.
     *
     * **So a fixture that forges a bound session with no membership row forges
     * a state the product cannot reach**, and the plane now refuses it 401.
     * Adding the row is not weakening a witness; it is the fixture stopping
     * being impossible.
     */
    await mig.query(
      `INSERT INTO tenant.membership
         (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ($1, 'mem_paging_mei', $2, 'rol_member', 'bootstrap', now(), NULL, NULL)
       ON CONFLICT DO NOTHING`,
      [ACME, MEI],
    )
    /*
     * 🛑 ONE STATEMENT, SO EVERY ROW CARRIES `transaction_timestamp()` — BYTE
     * IDENTICAL TO THE MICROSECOND. That is the fixture, and it is the shape a
     * bulk load produces. Under the old encoder this register paged as ONE row
     * and reported itself complete.
     */
    await mig.query(
      `INSERT INTO run
         (tenant_id, id, definition_id, definition_version, period_id,
          trigger_kind, status, inputs, started_at, finished_at, exceptions_raised)
       SELECT $1, 'run_paging_' || g, 'def_ap_close', 1, 'per_2026_09',
              'manual', 'completed', NULL, now(), now(), 0
         FROM generate_series(1, $2) AS g`,
      [ACME, RUN_COUNT],
    )
    await mig.query('COMMIT')
  } catch (err) {
    await mig.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    await mig.end()
  }
}

describe('`listRuns` pages to exhaustion without losing a row', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>

  before(async () => {
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    /* No `authorise`, no `substrate` — the PRODUCTION seams. */
    plane = await startDataPlane({ poolMax: 4 })
  })

  after(async () => {
    await plane?.close()
  })

  /**
   * 🛑 THE ASSERTION THE OLD ENCODER FAILED.
   */
  it('1 · following the server\'s OWN nextCursor to exhaustion returns every row exactly once', async () => {
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0

    for (;;) {
      const path: string =
        `/v1/runs?limit=1` + (cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`)
      const res: Res = await get(plane.url, path, HANDLE)
      assert.equal(res.status, 200, `page ${pages + 1} answered ${res.status}`)

      const items = (res.body?.['items'] ?? []) as Array<{ runId: string }>
      for (const it of items) seen.push(it.runId)

      const next = res.body?.['nextCursor']
      cursor = typeof next === 'string' && next !== '' ? next : null
      pages += 1

      if (cursor === null) break
      assert.ok(pages <= RUN_COUNT + 5, 'paging did not terminate')
    }

    assert.equal(
      seen.length,
      RUN_COUNT,
      `the register holds ${RUN_COUNT} runs and paging to exhaustion, following the ` +
        `server's OWN nextCursor until it was null, returned ${seen.length} ` +
        `(${seen.join(', ')}). The client was told the register was complete. ` +
        'This is the millisecond/microsecond cursor truncation — see `RUN_COLUMNS`.',
    )
    assert.equal(new Set(seen).size, RUN_COUNT, `paging duplicated a row: ${seen.join(', ')}`)
  })

  /**
   * ⚠️ THE POSITIVE CONTROL, WITHOUT WHICH §1 COULD PASS ON AN EMPTY REGISTER.
   * §5.6: a control that passes while asserting nothing.
   */
  it('2 · ANTI-VACUOUS — one unpaged read really does see all six', async () => {
    const res = await get(plane.url, `/v1/runs?limit=50`, HANDLE)
    assert.equal(res.status, 200)
    const items = (res.body?.['items'] ?? []) as Array<{ runId: string }>
    assert.equal(
      items.length,
      RUN_COUNT,
      'the fixture did not seed what §1 assumes, so §1 proved nothing',
    )
  })

  /**
   * The rows share a timestamp to the microsecond — assert that, because if a
   * future fixture change made them distinct, §1 would pass for the wrong
   * reason and stop guarding the defect it was written for.
   */
  it('3 · the fixture really does share one timestamp — §1 guards what it claims', async () => {
    const mig = await migratorClient()
    try {
      const r = await mig.query(
        `SELECT count(DISTINCT started_at)::int AS distinct_ts FROM run WHERE tenant_id = $1`,
        [ACME],
      )
      const row = r.rows[0] as { distinct_ts: number } | undefined
      assert.equal(
        row?.distinct_ts,
        1,
        'the seeded runs no longer share one timestamp, so §1 is no longer a ' +
          'regression test for the cursor truncation it was written for',
      )
    } finally {
      await mig.end()
    }
  })
})

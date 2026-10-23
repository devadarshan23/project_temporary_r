/**
 * THE REGISTER'S NEXT ACTS, IN A REAL BROWSER, AGAINST A REAL PLANE —
 * feat/register-next-acts, G3641–G3650 (3 Oct 2026).
 *
 * `docs/HANDOFF.md` §0a's third thing to do next: *"Wire the register's next
 * acts. Accept → `proposeResolution` / `executeProposal`, and Reopen →
 * `reverseResolution`."* Production authoriser (`startDataPlane()` is handed
 * no `authorise` and no `substrate`) and real row-level security:
 *
 *   §1  Accept on a line whose one disposition needs no approval PROPOSES and
 *       POSTS it: the row reads Resolved, the stored resolution is `manual`,
 *       and the notice offers Undo.
 *   §2  Reopen asks for the closed reason, then REVERSES: the row reads Open,
 *       and `tenant.exception_reversal` holds the reason the person chose.
 *   §3  Accept on a CRITICAL line (approval mandatory, four eyes) proposes and
 *       does NOT post: the row waits, and the Approvals queue draws it.
 *   §4  The notice's Undo after a posted Accept is a real `reverseResolution`.
 *   §5  A reader without `propose_resolution` / `reverse_resolution` is offered
 *       NEITHER act — View instead (G3193) — and nothing quiet in their place.
 *       ⚠️ WITNESSED RED with `drawnActOf` returning the act unchanged:
 *       `AssertionError: the viewer was offered Accept — the role cannot
 *       propose · actual: 3, expected: 0`.
 *
 * Its own database and its own port (8099).
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { databaseRequiredUnderCi, browserRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { provisionControlPlane } from '../../server/control-plane/provision.ts'
import { loadPg } from '../../db/pg.ts'
import { CAPABILITIES } from '../../model/access.ts'
import { browserSkip, closeBrowser, REPO } from '../design/render.ts'
import { reserveFront, type Front } from './single-origin.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_REGISTER_ACTS_E2E_DB_NAME'] ?? runScopedName('reconcile_register_acts_e2e_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']
/* `getSessionPrincipal` — the session's capabilities, which decide whether
   Accept and Reopen are DRAWN (G3522) — reads the bound tenant's name from the
   control database through the read-only pool, so this suite stands one up
   (`tests/http/session-principal-served.test.ts`'s shape). */
const CONTROL_DB = process.env['RECONCILE_REGISTER_ACTS_CONTROL_DB_NAME'] ?? runScopedName('reconcile_register_acts_control_test')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal 8099 until 4 Oct 2026. */
const RESERVED_FRONT = await reserveFront()
const PORT = RESERVED_FRONT.port
const HOST = `127.0.0.1:${PORT}`
const ACME = 'ten_acme'
const GLOBEX = 'ten_globex'
process.env['RECONCILE_SERVING_HOSTS'] = `${HOST}|${ACME}|ap-southeast-1|delegated|active`

const SESSION_COOKIE = '__Host-reconcile_session'
const DOOR = 'idc_acme_acts_e2e'
const OPERATOR = 'usr_acme_acts_e2e_operator'
const VIEWER = 'usr_acme_acts_e2e_viewer'
const OPERATOR_HANDLE = 'e2e_acts_operator_4b7e1c90d2a34f6e8b5c7d9e0f1a2b3c'
const VIEWER_HANDLE = 'e2e_acts_viewer_9d3a7f20c1b84e5a9c6d8e7f0a1b2c3d'
const DEFINITION = 'def_acts_e2e'
const PACK = 'pck_acts_e2e'
const RUN = 'run_acme_acts_e2e'
/** A line whose approval is not mandatory — Accept posts it. */
const POSTS = 'exc_acme_acts_posts'
/** A critical line — approval mandatory, four eyes — Accept leaves it waiting. */
const WAITS = 'exc_acme_acts_waits'
/** A line for the notice's Undo. */
const UNDOES = 'exc_acme_acts_undoes'

const DIST = join(REPO, 'frontend', 'dist')

const probe = await probeDatabase()
const dbSkip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
const browserWhy = await browserSkip()
databaseRequiredUnderCi('the register-acts browser suite', probe)
browserRequiredUnderCi('the register-acts browser suite', browserWhy)
after(async () => { await closeBrowser() })
const skip = dbSkip !== false ? dbSkip : browserWhy !== false ? browserWhy : false

interface Response {
  url(): string
  status(): number
  request(): { method(): string }
}
interface Page {
  goto(url: string, o?: unknown): Promise<unknown>
  click(selector: string): Promise<void>
  waitForSelector(selector: string, o?: unknown): Promise<unknown>
  waitForResponse(pred: (r: Response) => boolean, o?: unknown): Promise<Response>
  evaluate<T>(fn: unknown, arg?: unknown): Promise<T>
}
interface Ctx {
  newPage(): Promise<Page>
  addCookies(cookies: readonly unknown[]): Promise<void>
  close(): Promise<void>
}
interface Br {
  newContext(o?: unknown): Promise<Ctx>
  close(): Promise<void>
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

async function one(sql: string, params: readonly unknown[] = []): Promise<Record<string, unknown> | undefined> {
  return asMigrator(async (q) => (await q(sql, params)).rows[0] as Record<string, unknown> | undefined)
}

async function freshControlDatabase(): Promise<void> {
  const { Client } = await loadPg()
  const c = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-register-acts-setup',
  })
  await c.connect()
  try {
    await c.query(`DROP DATABASE IF EXISTS ${CONTROL_DB} WITH (FORCE)`)
    await c.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await c.end()
  }
  await provisionControlPlane()
}

async function seed(): Promise<void> {
  await asMigrator(async (q) => {
    await q('BEGIN')
    await q(
      `INSERT INTO tenant.identity_connection
         (id, protocol, label, owner_kind, owner_partner_id, owner_account_id, broker_issuer, broker_ref, status)
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme', 'https://login.microsoftonline.com/acts-e2e/v2.0', 'acme-acts-e2e', 'active')`,
      [DOOR],
    )
    for (const [user, name, role, caps, handle, i] of [
      [OPERATOR, 'Acme Operator', 'rol_acts_e2e_operator', [
        CAPABILITIES.viewException,
        CAPABILITIES.proposeResolution,
        CAPABILITIES.executeResolution,
        CAPABILITIES.approveResolution,
        CAPABILITIES.reverseResolution,
      ], OPERATOR_HANDLE, 0],
      [VIEWER, 'Acme Viewer', 'rol_acts_e2e_viewer', [CAPABILITIES.viewException], VIEWER_HANDLE, 1],
    ] as const) {
      await q(
        `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
         VALUES ($1, $1 || '@invalid', $2, 'active', $3)`,
        [user, name, DOOR],
      )
      await q(
        `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
         VALUES ($1, $2, $2, $2, 1, 'operator', 'tenant', NULL, 'active')`,
        [ACME, role],
      )
      for (const c of caps) {
        await q('INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ($1, $2, $3)', [ACME, role, c])
      }
      await q(
        `INSERT INTO tenant.role_assignment
           (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 1, 'bootstrap', now(), NULL, NULL)`,
        [ACME, `ras_${user}`, user, role],
      )
      await q(
        `INSERT INTO tenant.membership
           (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, 'bootstrap', now(), NULL, NULL)`,
        [ACME, `mem_${user}`, user, role],
      )
      await q(
        `INSERT INTO tenant.session
           (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
            authenticated_at, last_used_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now() + interval '12 hours', NULL)`,
        [`ses_acts_e2e_${i}`, digestOfHandle(handle), user, DOOR, ACME, HOST],
      )
    }
    await q(
      `INSERT INTO run
         (tenant_id, id, definition_id, definition_version, period_id, trigger_kind,
          status, inputs, started_at, finished_at, exceptions_raised)
       VALUES ($1, $2, $3, 1, NULL, 'manual', 'completed', NULL, now(), now(), 3)`,
      [ACME, RUN, DEFINITION],
    )
    for (const [id, severity, rank] of [
      [POSTS, 'high', 1],
      [WAITS, 'critical', 0],
      [UNDOES, 'medium', 2],
    ] as const) {
      await q(
        `INSERT INTO tenant.exception
           (tenant_id, id, match_group_id, rule_id, rule_version, definition_version,
            domain, definition_id, rule_label, severity, severity_rank,
            value_at_risk_currency, value_at_risk_minor, value_at_risk_exponent,
            cost_centre, legal_entity, status, assigned_to, raised_at,
            explanation_summary, explanation_expected, explanation_confidence, run_id)
         VALUES ($1, $2, $2, 'rul_1', 1, 1,
                 'finance', $3, 'Three-way match', $4, $5,
                 'SGD', 90000, 2,
                 'CC-1100', 'LE-SG', 'open', NULL, now(),
                 $6, 'the purchase order', 0.91, $7)`,
        /* G3801 — both personas hold `view_exception`, which now READS runs
           (the owner's C3-06 ruling), so the register is scoped to `RUN` and a
           line must name the run that raised it to be drawn there. Until then
           neither could read runs and the register was unscoped. */
        [ACME, id, DEFINITION, severity, rank, `register acts line ${id}`, RUN],
      )
    }
    await q(
      `INSERT INTO tenant.definition_archetype (tenant_id, definition_id, archetype, pack_key)
       VALUES ($1, $2, 'n_way_document_match', $3)`,
      [ACME, DEFINITION, PACK],
    )
    /* Approval is mandatory at `critical` and nowhere else — so `POSTS` and
       `UNDOES` are executable on proposal and `WAITS` is not. Four eyes on. */
    await q(
      `INSERT INTO tenant.approval_config (tenant_id, quorum, mandatory_at_or_above, segregation_of_duties)
       VALUES ($1, 1, 'critical', true)`,
      [ACME],
    )
    /* ONE disposition — so the row's choice is unambiguous (G3643). */
    await q(
      `INSERT INTO tenant.disposition
         (tenant_id, pack_key, key, label, family, reversibility, terminal, requires_adjustment)
       VALUES ($1, $2, 'write_off', 'Write off', 'charge_variance', 'reversible', true, false)`,
      [ACME, PACK],
    )
    await q('COMMIT')
  })
}

describe('the register\'s next acts, in a browser (G3641–G3650)', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let front: Front
  let br: Br
  const origin = `http://${HOST}`

  async function open(handle: string): Promise<{ ctx: Ctx; page: Page }> {
    const ctx = await br.newContext({ baseURL: origin })
    await ctx.addCookies([
      { name: SESSION_COOKIE, value: handle, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await ctx.newPage()
    await page.goto(`${origin}/close`, { waitUntil: 'load' })
    await page.waitForSelector(`[data-exception="${POSTS}"]`, { timeout: 15_000 })
    return { ctx, page }
  }

  const statusOf = (page: Page, id: string): Promise<string | null> =>
    page.evaluate<string | null>(
      (x: string) => document.querySelector(`[data-exception="${x}"] [data-status]`)?.getAttribute('data-status') ?? null,
      id,
    )

  before(async () => {
    await freshControlDatabase()
    await resetSchema()
    await seedTwoTenants(ACME, GLOBEX)
    await seed()
    plane = await startDataPlane({ poolMax: 4 })
    front = RESERVED_FRONT.serve(DIST, plane.url)
    const pw = (await import('playwright')) as unknown as { chromium: { launch(): Promise<Br> } }
    br = await pw.chromium.launch()
  })

  after(async () => {
    await br?.close()
    await front?.close()
    await plane?.close()
  })

  it('§1 · Accept proposes and POSTS a line that needs no approval', async () => {
    const { ctx, page } = await open(OPERATOR_HANDLE)
    try {
      await page.waitForSelector(`td.act [data-accept="${POSTS}"]`, { timeout: 15_000 })
      const posted = page.waitForResponse(
        (r) => r.url().includes('/execution') && r.request().method() === 'POST' && r.status() === 200,
        { timeout: 15_000 },
      )
      await page.click(`td.act [data-accept="${POSTS}"]`)
      await posted
      await page.waitForSelector(`[data-exception="${POSTS}"] [data-status="resolved"]`, { timeout: 15_000 })
      const stored = await one('SELECT status, resolution_mode, resolution_disposition_key FROM tenant.exception WHERE id = $1', [POSTS])
      assert.deepEqual(stored, { status: 'resolved', resolution_mode: 'manual', resolution_disposition_key: 'write_off' })
      const notice = await page.evaluate<{ title: string; undo: number }>(() => {
        const t = [...document.querySelectorAll('[data-toasts] .toast')].pop()
        return { title: t?.querySelector('.toast-t')?.textContent ?? '', undo: t?.querySelectorAll('.toast-a button').length ?? 0 }
      })
      assert.match(notice.title, /Accepted and posted — Write off/)
      assert.equal(notice.undo, 1, 'a posted Accept offered no Undo')
      /* The cleared line's next act is now Reopen. */
      await page.waitForSelector(`td.act [data-reopen="${POSTS}"]`)
    } finally {
      await ctx.close()
    }
  })

  it('§2 · Reopen asks for the closed reason, then REVERSES', async () => {
    const { ctx, page } = await open(OPERATOR_HANDLE)
    try {
      await page.click(`td.act [data-reopen="${POSTS}"]`)
      await page.waitForSelector('[data-reopen-reasons]')
      const confirm = `[data-confirm-reopen="${POSTS}"]`
      assert.equal(
        await page.evaluate<string | null>((s: string) => document.querySelector(s)?.getAttribute('aria-disabled') ?? null, confirm),
        'true',
        'Reopen was ready before a reason was chosen',
      )
      await page.click('[data-reopen-reason="data_corrected"]')
      const reversed = page.waitForResponse(
        (r) => r.url().endsWith(`/v1/exceptions/${POSTS}/reversals`) && r.request().method() === 'POST' && r.status() === 201,
        { timeout: 15_000 },
      )
      await page.click(confirm)
      await reversed
      await page.waitForSelector(`[data-exception="${POSTS}"] [data-status="open"]`, { timeout: 15_000 })
      const reversal = await one('SELECT reason, new_status FROM tenant.exception_reversal WHERE exception_id = $1', [POSTS])
      assert.deepEqual(reversal, { reason: 'data_corrected', new_status: 'open' })
      const stored = await one('SELECT status, resolution_mode FROM tenant.exception WHERE id = $1', [POSTS])
      assert.deepEqual(stored, { status: 'open', resolution_mode: null })
    } finally {
      await ctx.close()
    }
  })

  it('§3 · Accept on a line that needs approval proposes and WAITS, in Approvals', async () => {
    const { ctx, page } = await open(OPERATOR_HANDLE)
    try {
      const proposed = page.waitForResponse(
        (r) => r.url().endsWith(`/v1/exceptions/${WAITS}/proposals`) && r.request().method() === 'POST' && r.status() === 201,
        { timeout: 15_000 },
      )
      await page.click(`td.act [data-accept="${WAITS}"]`)
      await proposed
      /* ⚠️ THIS WAITED FOR THE LINE IN THE QUEUE DRAWN UNDER THE REGISTER.
         C3-08 (the owner's, 4 Oct 2026) made Approvals a chrome destination
         listing what waits on THE READER's approval — and the proposer of
         record, under segregation, is not asked to approve his own. The line
         waits; it is listed for another approver. */
      await page.waitForSelector(`[data-exception="${WAITS}"] [data-status="pending_approval"]`, { timeout: 15_000 })
      const status = await statusOf(page, WAITS)
      assert.ok(status === 'resolution_proposed' || status === 'pending_approval', `the waiting line reads ${String(status)}`)
      const stored = await one('SELECT resolution_mode FROM tenant.exception WHERE id = $1', [WAITS])
      assert.deepEqual(stored, { resolution_mode: null }, 'a line that needs approval was posted')
      const proposals = await one('SELECT count(*)::int AS n FROM tenant.resolution_proposal WHERE exception_id = $1', [WAITS])
      assert.deepEqual(proposals, { n: 1 })
    } finally {
      await ctx.close()
    }
  })

  it('§4 · the notice\'s Undo after a posted Accept is a real reversal', async () => {
    const { ctx, page } = await open(OPERATOR_HANDLE)
    try {
      await page.click(`td.act [data-accept="${UNDOES}"]`)
      await page.waitForSelector(`[data-exception="${UNDOES}"] [data-status="resolved"]`, { timeout: 15_000 })
      const reversed = page.waitForResponse(
        (r) => r.url().endsWith(`/v1/exceptions/${UNDOES}/reversals`) && r.request().method() === 'POST' && r.status() === 201,
        { timeout: 15_000 },
      )
      await page.click('[data-toasts] .toast[data-kind="undo"] .toast-a button')
      await reversed
      await page.waitForSelector(`[data-exception="${UNDOES}"] [data-status="open"]`, { timeout: 15_000 })
      const reversal = await one('SELECT reason FROM tenant.exception_reversal WHERE exception_id = $1', [UNDOES])
      /* G3883 — the Undo is the actor's own, and does not indict the disposition. */
      assert.deepEqual(reversal, { reason: 'undone_by_actor' })
    } finally {
      await ctx.close()
    }
  })

  it('§5 · a reader who cannot propose or reverse is offered neither — View instead', async () => {
    const { ctx, page } = await open(VIEWER_HANDLE)
    try {
      await page.waitForSelector(`[data-exception="${POSTS}"] td.act[data-act]`)
      const seen = await page.evaluate<{ acts: Record<string, string | null>; accept: number; reopen: number; quietCommit: number }>(() => {
        const acts: Record<string, string | null> = {}
        for (const row of document.querySelectorAll('tr.row[data-exception]')) {
          acts[row.getAttribute('data-exception') ?? ''] = row.querySelector('td.act')?.getAttribute('data-act') ?? null
        }
        return {
          acts,
          accept: document.querySelectorAll('[data-accept]').length,
          reopen: document.querySelectorAll('[data-reopen]').length,
          quietCommit: document.querySelectorAll('td.act [data-commit]').length,
        }
      })
      assert.equal(seen.accept, 0, 'the viewer was offered Accept — the role cannot propose')
      assert.equal(seen.reopen, 0, 'the viewer was offered Reopen — the role cannot reverse')
      assert.equal(seen.quietCommit, 0, 'a refused Accept was drawn quiet rather than hidden (G3193)')
      assert.equal(seen.acts[POSTS], 'view')
    } finally {
      await ctx.close()
    }
  })
})

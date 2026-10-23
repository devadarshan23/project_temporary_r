/**
 * "IN VARIANCE" IS THE REGISTER'S VARIANCE TOTAL, IN A REAL BROWSER, ON THE
 * ENGINE-TRUE DEMO SEED — G3885, 4 Oct 2026.
 *
 * The owner's C3-02/C3-09 ruling, quoted: *"Store a signed delta: the engine
 * records direction (over/under); the column shows sign, totals net correctly,
 * 'In variance' is defined as the open residual."* The server half is
 * `tests/db/staging-demo-data.test.ts` §5 (the served `openResidual` equals the
 * sum of the run's served `variance`). This is the half a person sees: for each
 * demo run on the strip, the figure drawn under **In variance** equals the sum
 * of the Variance cells the register draws for that run — signs included, so
 * the card run's under-settlement nets NEGATIVE.
 *
 * WITNESSED RED: with `arrivalSettlementOf()` reading the arrival side's own
 * `unsettled` total as it did before G3885, the three-way run drew
 * `SGD 522,684.00` under In variance against a register summing
 * `SGD 128,124.00` — the very disagreement C3-09 named.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

import { databaseRequiredUnderCi, browserRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, migratorClient } from '../../db/provision.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { provisionControlPlane } from '../../server/control-plane/provision.ts'
import { loadPg } from '../../db/pg.ts'
import { browserSkip, closeBrowser, REPO } from '../design/render.ts'
import { reserveFront, type Front } from './single-origin.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_IN_VARIANCE_E2E_DB_NAME'] ?? runScopedName('reconcile_in_variance_e2e_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']
const CONTROL_DB = process.env['RECONCILE_IN_VARIANCE_CONTROL_DB_NAME'] ?? runScopedName('reconcile_in_variance_control_test')
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}

/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal 8096 until 4 Oct 2026. */
const RESERVED_FRONT = await reserveFront()
const PORT = RESERVED_FRONT.port
const HOST = `127.0.0.1:${PORT}`
process.env['RECONCILE_SERVING_HOSTS'] = `${HOST}|ten_acme|ap-southeast-1|delegated|active`
const HANDLE = 'e2e_in_variance_viewer_6c1d0e2f3a4b5c6d7e8f9a0b1c2d3e4f'
const DIST = join(REPO, 'frontend', 'dist')
const RUNS = ['run_demo_3wm_w10', 'run_demo_bank_w10', 'run_demo_card_w10', 'run_demo_ic_w10'] as const

const probe = await probeDatabase()
const dbSkip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
const browserWhy = await browserSkip()
databaseRequiredUnderCi('the In-variance browser suite', probe)
browserRequiredUnderCi('the In-variance browser suite', browserWhy)
after(async () => { await closeBrowser() })
const skip = dbSkip !== false ? dbSkip : browserWhy !== false ? browserWhy : false

interface Page {
  goto(url: string, o?: unknown): Promise<unknown>
  click(selector: string): Promise<void>
  waitForSelector(selector: string, o?: unknown): Promise<unknown>
  evaluate<T>(fn: unknown, arg?: unknown): Promise<T>
}
interface Ctx { newPage(): Promise<Page>; addCookies(c: readonly unknown[]): Promise<void>; close(): Promise<void> }
interface Br { newContext(o?: unknown): Promise<Ctx>; close(): Promise<void> }

async function seed(): Promise<void> {
  const { Client } = await loadPg()
  const c = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database: 'postgres',
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
  })
  await c.connect()
  try {
    await c.query(`DROP DATABASE IF EXISTS ${CONTROL_DB} WITH (FORCE)`)
    await c.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await c.end()
  }
  await provisionControlPlane()
  await resetSchema()
  const m = await migratorClient()
  try {
    await m.query(readFileSync(join(REPO, 'db/seeds/staging-signin-seed.sql'), 'utf8'))
    await m.query(readFileSync(join(REPO, 'db/seeds/staging-demo-data.sql'), 'utf8'))
    await m.query(
      `INSERT INTO tenant."user" (id, email, display_name, status, connection_id)
       VALUES ('usr_iv_viewer', 'iv@invalid', 'Rae Viewer', 'active', 'idc_staging_entra_1ch')`,
    )
    await m.query(
      `INSERT INTO tenant.role (tenant_id, id, label, key, version, stakeholder_class, origin, pack_id, status)
       VALUES ('ten_acme', 'rol_iv_viewer', 'Viewer', 'iv_viewer', 1, 'operator', 'tenant', NULL, 'active')`,
    )
    /* `view_exception` ALONE for the register — the run reads are `view_run`,
       CARRIED by it (G3881), so this viewer reads both with no run verb stored. */
    await m.query(`INSERT INTO tenant.role_capability (tenant_id, role_id, capability) VALUES ('ten_acme', 'rol_iv_viewer', 'view_exception')`)
    await m.query(
      `INSERT INTO tenant.membership (tenant_id, id, user_id, role_id, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('ten_acme', 'mem_iv_viewer', 'usr_iv_viewer', 'rol_iv_viewer', 'seed', now(), NULL, NULL)`,
    )
    await m.query(
      `INSERT INTO tenant.role_assignment (tenant_id, id, user_id, role_id, role_version, granted_by, granted_at, expires_at, revoked_at)
       VALUES ('ten_acme', 'ras_iv_viewer', 'usr_iv_viewer', 'rol_iv_viewer', 1, 'seed', now(), NULL, NULL)`,
    )
    await m.query(
      `INSERT INTO tenant.session (id, handle_digest, user_id, connection_id, tenant_id, issued_host,
         authenticated_at, last_used_at, expires_at, revoked_at)
       VALUES ('ses_iv_viewer', $1, 'usr_iv_viewer', 'idc_staging_entra_1ch', 'ten_acme', $2,
               now(), now(), now() + interval '12 hours', NULL)`,
      [digestOfHandle(HANDLE), HOST],
    )
  } finally {
    await m.end()
  }
}

describe('In variance equals the register\'s Variance total, drawn (G3885)', { skip }, () => {
  let plane: { url: string; close(): Promise<void> }
  let front: Front
  let br: Br
  const origin = `http://${HOST}`

  before(async () => {
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

  it('for each demo run, In variance is the signed sum of the register\'s Variance cells for that run', async () => {
    const seen: Record<string, { inVariance: string; cellSum: string; cells: number }> = {}
    const read = (page: Page, run: string) =>
      page.evaluate<{ inVariance: string; cellSum: string; cells: number }>((r: string) => {
        const fig = document.querySelector(`[data-arrival="${r}"] [data-figure="in-variance"] .v`)?.textContent?.trim() ?? ''
        const cells = [...document.querySelectorAll('[data-variance="money"]')].map((e) => e.textContent?.trim() ?? '')
        const minor = cells.reduce((a, t) => a + Math.round(Number(t.replace(/[^0-9.-]/g, '')) * 100), 0)
        const abs = Math.abs(minor)
        const fmt = `${minor < 0 ? '-' : ''}${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`
        return { inVariance: fig, cellSum: `SGD ${fmt}`, cells: cells.length }
      }, run)
    /* ONE FRESH CONTEXT PER RUN, AND A READ THAT MUST HOLD STILL. A first draft
       reused one page and read as soon as the figure settled to `money`, and it
       raced: the strip, the arrival and the register load independently, so a
       read could catch one run's figure beside the previous run's register. The
       read is taken only once two consecutive reads, half a second apart, agree. */
    for (const run of RUNS) {
      const ctx = await br.newContext({ baseURL: origin })
      await ctx.addCookies([
        { name: '__Host-reconcile_session', value: HANDLE, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      ])
      try {
        const page = await ctx.newPage()
        await page.goto(`${origin}/close`, { waitUntil: 'load' })
        await page.waitForSelector(`[data-run="${run}"]`, { timeout: 15_000 })
        await page.click(`[data-run="${run}"]`)
        await page.waitForSelector(`[data-arrival="${run}"] [data-figure="in-variance"][data-settlement="money"]`, { timeout: 15_000 })
        await page.waitForSelector('[data-variance="money"]', { timeout: 15_000 })
        let last = await read(page, run)
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 500))
          const now = await read(page, run)
          if (JSON.stringify(now) === JSON.stringify(last)) break
          last = now
        }
        seen[run] = last
      } finally {
        await ctx.close()
      }
    }
    for (const run of RUNS) {
      const s = seen[run]!
      assert.ok(s.cells > 0, `${run}: the register drew no Variance cell, so the comparison is vacuous`)
      assert.equal(s.inVariance, s.cellSum, `${run}: In variance ${s.inVariance} is not the register's Variance total ${s.cellSum}`)
    }
    assert.equal(seen['run_demo_card_w10']!.inVariance, 'SGD -598.55', `the under-settled card run did not net negative: ${JSON.stringify(seen)}`)
  })
})

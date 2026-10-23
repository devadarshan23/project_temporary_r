/**
 * G3326 — THE STAFF CONSOLE, IN A REAL BROWSER, SIGNED IN THROUGH THE BROKER.
 *
 * Measured on staging, 3 Oct 2026: a 1CloudHub staff persona signing in on
 * `console.reconcileai.app` landed on `/` and was shown the tenant shell's
 * unbuilt-entry placeholder. This suite is the journey that replaced it:
 *
 *   §1  a PLATFORM persona signs in on the console host, through the platform
 *       door and the fake broker (the stand-in for Cognito), and lands on `/`
 *       — which draws the staff console, not the tenant shell's entry scope.
 *   §2  the Tenancy is the REAL `listTenants`: the control database's roster,
 *       with the stage the plane derives from the stored step count.
 *   §3  opening a tenant reads its onboarding (`listOnboardingSteps`), and
 *       Mark done on the one `next` step is `completeOnboardingStep` — the
 *       write lands in the control database's delivery record.
 *   §4  the console fires no tenant read: no `/v1/runs`, no `/v1/exceptions`,
 *       no D1 — a console session has no tenant (G726).
 *   §5  RS-01 / RS-10 (G3583, G3587): at 390 the PAGE does not scroll sideways
 *       (it ran to 628px, then 596px from an `.sr-only` escaping the scroller),
 *       and a tenant record is an address Back returns from.
 *   §6  RP-04 / RS-02 (G3581, THE OWNER'S): an unknown address on the console
 *       host draws E1 with the way home named "Back to the staff console",
 *       and no link to the register this host does not serve.
 *       WITNESSED RED against 4adf2d24's bundle: §5 measured 628, §6 found
 *       "Back to your register" → /close.
 *
 * A FLAGGED bundle, because the persona switcher is the browser's way to the
 * broker; two databases, because the roster and the onboarding record live in
 * the CONTROL database (G831, G1241) and the session in the tenant one; the
 * PRODUCTION authoriser throughout. Its own port (8093) — `node --test` runs
 * files at once and 8080/8091 are held by other suites.
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import { controlDbPort } from '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { databaseRequiredUnderCi, browserRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { loadPg } from '../../db/pg.ts'
import { resetSchema, migratorClient } from '../../db/provision.ts'
import { createAppPool } from '../../db/tenant-scope.ts'
import { withKeyInventoryScope } from '../../db/key-inventory-scope.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { provisionControlPlane, seedTenancyRoster } from '../../server/control-plane/provision.ts'
import { startInternalPair, type InternalPair } from '../http/internal-pair.ts'
import {
  identityTolerances,
  loadVerificationTerms,
  readConnectionKeyInventory,
} from '../../server/data-plane/verification-terms.ts'
import { MOCK_DOORS, MOCK_PERSONAS } from '../../infra/lib/mock-personas.ts'
import { browserSkip, closeBrowser, REPO } from '../design/render.ts'
import { reserveFront, type Front } from './single-origin.ts'
import { startFakeBroker, type FakeBroker } from './fake-oidc-broker.ts'
import { runScopedName } from '../run-scoped-db.ts'
import { assertNarrowStatusRow, assertWideStatusBar } from './narrow-status.ts'

const TENANT_DB = process.env['RECONCILE_STAFF_CONSOLE_DB_NAME'] ?? runScopedName('reconcile_staff_console_e2e_test')
const CONTROL_DB = process.env['RECONCILE_STAFF_CONSOLE_CONTROL_DB_NAME'] ?? runScopedName('reconcile_staff_console_e2e_control')
process.env['RECONCILE_DB_NAME'] = TENANT_DB
process.env['RECONCILE_CONTROL_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_READ_DB_NAME'] = CONTROL_DB
process.env['RECONCILE_CONTROL_WRITE_DB_NAME'] = CONTROL_DB
if ((process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? '') === '') {
  process.env['RECONCILE_CONTROL_DB_ADMIN'] = process.env['USER'] ?? 'postgres'
}
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal 8093 until 4 Oct 2026. */
const RESERVED_FRONT = await reserveFront()
const PORT = RESERVED_FRONT.port
const TENANT_HOST = `ten-mock.localhost:${PORT}`
const PARTNERS_HOST = `partners.localhost:${PORT}`
const CONSOLE_HOST = `console.localhost:${PORT}`
const PORTAL_ORIGINS: Readonly<Record<string, string>> = {
  'ten-mock.us-west-2.reconcileai.app': `http://${TENANT_HOST}`,
  'partners.reconcileai.app': `http://${PARTNERS_HOST}`,
  'console.reconcileai.app': `http://${CONSOLE_HOST}`,
}
process.env['RECONCILE_SERVING_HOSTS'] = `${TENANT_HOST}|ten_mock|us-west-2|delegated|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active,${PARTNERS_HOST}|partner|active`
process.env['RECONCILE_SESSION_MAX_LIFETIME_SECONDS'] = '28800'
process.env['RECONCILE_SESSION_MAX_IDLE_SECONDS'] = '900'

const AUDIENCE = 'reconcile-e2e-staff-console-client'
const SEED = readFileSync(join(REPO, 'db', 'seeds', 'staging-mock-personas.sql'), 'utf8')
const PLATFORM = MOCK_PERSONAS.find((p) => p.sub === 'mock-staff-platform')
if (PLATFORM === undefined) throw new Error('no mock-staff-platform persona in the catalogue')

const probe = await probeDatabase()
const dbSkip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
const browserWhy = await browserSkip()
databaseRequiredUnderCi('the staff console suite', probe)
browserRequiredUnderCi('the staff console suite', browserWhy)
after(async () => {
  await closeBrowser()
})
const skip = dbSkip !== false ? dbSkip : browserWhy !== false ? browserWhy : false

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const mig = await migratorClient()
  try {
    return (await mig.query(sql, params)).rows as T[]
  } finally {
    await mig.end()
  }
}

async function controlAdmin(database: string) {
  const { Client } = await loadPg()
  const c = new Client({
    host: '127.0.0.1',
    port: controlDbPort(),
    database,
    user: process.env['RECONCILE_CONTROL_DB_ADMIN'] ?? 'postgres',
    application_name: 'reconcile-staff-console-e2e',
  })
  await c.connect()
  return c
}

async function rebuildControlDatabase(): Promise<void> {
  const admin = await controlAdmin('postgres')
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [CONTROL_DB],
    )
    await admin.query(`DROP DATABASE IF EXISTS ${CONTROL_DB}`)
    await admin.query(`CREATE DATABASE ${CONTROL_DB}`)
  } finally {
    await admin.end()
  }
}

async function completedSteps(tenantId: string): Promise<number | null> {
  const c = await controlAdmin(CONTROL_DB)
  try {
    const r = await c.query('SELECT completed_steps FROM onboarding_record WHERE tenant_id = $1', [tenantId])
    const row = r.rows[0] as { completed_steps: number } | undefined
    return row === undefined ? null : Number(row.completed_steps)
  } finally {
    await c.end()
  }
}

function buildFlaggedBundle(outDir: string): void {
  const run = spawnSync(
    process.execPath,
    [join(REPO, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '-c', 'frontend/vite.config.ts', '--outDir', outDir, '--emptyOutDir'],
    {
      cwd: REPO,
      encoding: 'utf8',
      env: {
        ...process.env,
        RECONCILE_TEST_PERSONAS: 'on',
        RECONCILE_TEST_PORTAL_ORIGINS: JSON.stringify(PORTAL_ORIGINS),
      },
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  if (run.status !== 0) throw new Error(`the flagged build failed: ${run.stderr || run.stdout}`)
}

interface Request {
  url(): string
}
interface Page {
  goto(url: string, o?: unknown): Promise<unknown>
  click(selector: string): Promise<void>
  focus(selector: string): Promise<void>
  keyboard: { press(key: string): Promise<void> }
  mouse: { click(x: number, y: number): Promise<void> }
  waitForFunction(fn: unknown, arg?: unknown, o?: unknown): Promise<unknown>
  waitForSelector(selector: string, o?: unknown): Promise<unknown>
  evaluate<T>(fn: unknown, arg?: unknown): Promise<T>
  on(event: 'request', cb: (r: Request) => void): void
  url(): string
  setViewportSize(size: { width: number; height: number }): Promise<void>
  goBack(o?: unknown): Promise<unknown>
  close(): Promise<void>
}
interface Ctx {
  newPage(): Promise<Page>
  close(): Promise<void>
}
interface Br {
  newContext(o?: unknown): Promise<Ctx>
  close(): Promise<void>
}

describe('the staff console, in a browser', { skip }, () => {
  let broker: FakeBroker
  let plane: { url: string; close(): Promise<void> }
  let pair: InternalPair | undefined
  let front: Front
  let br: Br
  let ctx: Ctx
  let page: Page
  let dist = ''
  const asked: string[] = []

  before(async () => {
    dist = mkdtempSync(join(tmpdir(), 'reconcile-staff-console-'))
    buildFlaggedBundle(dist)
    await rebuildControlDatabase()
    await provisionControlPlane()
    await seedTenancyRoster()
    await resetSchema()
    await q(SEED)
    broker = await startFakeBroker({ audience: AUDIENCE, downgradeToHttp: true })
    await q(
      `UPDATE tenant.identity_connection
          SET broker_issuer = $1, token_endpoint = $2, authorization_endpoint = $3, jwks_uri = $4, audience = $5
        WHERE id = ANY($6)`,
      [
        broker.issuer,
        broker.tokenEndpoint,
        broker.authorizeEndpoint,
        broker.jwksUri,
        AUDIENCE,
        Object.values(MOCK_DOORS).map((d) => d.connectionId),
      ],
    )
    const bootPool = await createAppPool(1)
    let inventory
    try {
      inventory = await withKeyInventoryScope(bootPool, (tx) => readConnectionKeyInventory(tx))
    } finally {
      await bootPool.end()
    }
    const identityTerms = await loadVerificationTerms(identityTolerances(), inventory)
    /* G4316 — Mark done reaches a REAL control plane over the signed internal
       edge; the data plane holds no writing control-database credential. */
    pair = await startInternalPair()
    plane = await startDataPlane({ poolMax: 4, identityTerms, controlPlane: pair.client })
    front = RESERVED_FRONT.serve(dist, plane.url)
    const pw = (await import('playwright')) as unknown as { chromium: { launch(): Promise<Br> } }
    br = await pw.chromium.launch()
    ctx = await br.newContext()
    page = await ctx.newPage()
    page.on('request', (r) => {
      asked.push(r.url())
    })
  })

  after(async () => {
    await page?.close()
    await ctx?.close()
    await br?.close()
    await front?.close()
    await plane?.close()
    await pair?.close()
    await broker?.close()
    if (dist !== '') rmSync(dist, { recursive: true, force: true })
  })

  it('§1 · a platform persona signs in on the console host and lands on the staff console', async () => {
    await page.goto(`http://${CONSOLE_HOST}/signin`, { waitUntil: 'load' })
    await page.waitForSelector(`[data-persona="${PLATFORM.email}"]`, { timeout: 15_000 })
    await page.click(`[data-persona="${PLATFORM.email}"]`)
    await page.waitForFunction(
      (h: string) => location.host === h && location.pathname === '/',
      CONSOLE_HOST,
      { timeout: 20_000 },
    )
    assert.equal(broker.lastAuthorize()?.get('identity_provider'), `c-${MOCK_DOORS.platform.handle}`)
    /* The seed's second run grants the now-provisioned person their platform role. */
    await q(SEED)
    await page.goto(`http://${CONSOLE_HOST}/`, { waitUntil: 'load' })
    await page.waitForSelector('[data-staff-chrome]', { timeout: 15_000 })
    const text = await page.evaluate<string>(() => document.body.innerText)
    assert.doesNotMatch(text, /This route resolves|It has no screen yet|design\/routes/, 'the old entry placeholder is still drawn')
    assert.match(text, /staff console/)
    const dests = await page.evaluate<string[]>(() =>
      /* NS-01 (G3710): the `+N` cue is a quiet item of its own, not one of the pack's three. */
      [...document.querySelectorAll('[data-staff-chrome] nav li:not([data-more]) a')].map((a) => (a.textContent ?? '').trim()),
    )
    assert.deepEqual(dests, ['Tenants', 'Catalogue', 'Agent builder'])
    const soon = await page.evaluate<string[]>(() =>
      [...document.querySelectorAll('[data-staff-chrome] nav li:not([data-more]) [data-soon]')].map((a) => (a.textContent ?? '').trim()),
    )
    assert.deepEqual(soon, ['Catalogue', 'Agent builder'], 'an unbuilt destination is not drawn quietly')
    /* G3373 — the chrome names the signed-in person from `getSessionPrincipal`
       (#543), as their directory stored them, and no longer says only
       "Signed in · 1CloudHub staff". A console binds no tenant, so none is drawn. */
    await page.waitForSelector('[data-staff-chrome] [data-whoami]', { timeout: 15_000 })
    const stored = await q<{ display_name: string; email: string }>(
      `SELECT display_name, email FROM tenant."user" WHERE external_subject = $1 OR email = $2`,
      [PLATFORM.sub, PLATFORM.email],
    )
    assert.equal(stored.length, 1, 'the signed-in person was not provisioned exactly once')
    const person = stored[0]!
    const who = await page.evaluate<string>(() => document.querySelector('[data-staff-chrome] [data-whoami]')?.textContent ?? '')
    /* G4045 (the owner's, 4 Oct 2026 — "Serve role labels"): the sub-line is
       the PLATFORM role this persona live-holds, as stored — it read the org
       class word "1CloudHub staff" until then. Derived from the row, never typed. */
    const roles = await q<{ label: string }>(
      `SELECT r.label FROM tenant.platform_role_assignment a
         JOIN tenant.platform_role r ON r.id = a.role_id
         JOIN tenant."user" u ON u.id = a.user_id
        WHERE (u.external_subject = $1 OR u.email = $2) AND a.revoked_at IS NULL
        ORDER BY a.id`,
      [PLATFORM.sub, PLATFORM.email],
    )
    assert.ok(roles.length > 0, 'the platform persona holds no platform role in the seed')
    assert.equal(who, `${person.display_name}${roles.map((r) => r.label).join(' · ')}`, 'the chrome does not name the signed-in person and their role as stored')
    const email = await page.evaluate<string>(() => document.querySelector('[data-staff-chrome] [data-whoami-email]')?.textContent ?? '')
    assert.equal(email, person.email)
  })

  it('§2 · the Tenancy is the real roster, with the derived stage', async () => {
    await page.waitForSelector('[data-tenancy] [data-tenant]', { timeout: 15_000 })
    const rows = await page.evaluate<{ id: string; stage: string }[]>(() =>
      [...document.querySelectorAll('[data-tenancy] tr[data-tenant]')].map((r) => ({
        id: r.getAttribute('data-tenant') ?? '',
        stage: r.querySelector('[data-stage]')?.getAttribute('data-stage') ?? '',
      })),
    )
    assert.deepEqual(
      [...rows].sort((a, b) => a.id.localeCompare(b.id)),
      [
        { id: 'ten_acme', stage: 'live' },
        { id: 'ten_borealis', stage: 'onboarding' },
        { id: 'ten_cardinal', stage: 'onboarding' },
      ],
    )
    const figs = await page.evaluate<Record<string, string>>(() =>
      Object.fromEntries(
        [...document.querySelectorAll('[data-fig]')].map((f) => [f.getAttribute('data-fig') ?? '', (f.textContent ?? '').trim()]),
      ),
    )
    assert.deepEqual(figs, { live: '1', onboarding: '2', byoa: '1' })
  })

  it('§3 · opening a tenant reads its onboarding, and Mark done completes the next step', async () => {
    assert.equal(await completedSteps('ten_cardinal'), 2)
    await page.click('[data-open-tenant="ten_cardinal"]')
    await page.waitForSelector('[data-onboarding] tr[data-step]', { timeout: 15_000 })
    const before = await page.evaluate<Record<string, string>>(() =>
      Object.fromEntries(
        [...document.querySelectorAll('[data-onboarding] tr[data-step]')].map((r) => [
          r.getAttribute('data-step') ?? '',
          r.getAttribute('data-state') ?? '',
        ]),
      ),
    )
    assert.deepEqual(before, {
      tenant_record: 'done',
      tag_policy: 'done',
      sources_bound: 'next',
      pack_installed: 'blocked',
      extraction_floor: 'blocked',
      first_run: 'blocked',
    })
    await page.click('[data-mark-done="sources_bound"]')
    await page.waitForFunction(
      () => document.querySelector('[data-step="pack_installed"]')?.getAttribute('data-state') === 'next',
      undefined,
      { timeout: 15_000 },
    )
    assert.equal(
      await page.evaluate<string | null>(() => document.querySelector('[data-step="sources_bound"]')?.getAttribute('data-state') ?? null),
      'done',
    )
    assert.equal(
      await page.evaluate<string | null>(() => document.querySelector('[data-outcome]')?.getAttribute('data-outcome') ?? null),
      'ok',
    )
    assert.equal(await completedSteps('ten_cardinal'), 3, 'the write did not reach the control database')
  })

  it('§4 · the console asks the plane for nothing inside a tenant', () => {
    const tenantReads = asked.filter((u) => {
      const path = new URL(u).pathname
      return path.startsWith('/v1/runs') || path.startsWith('/v1/exceptions') || path.startsWith('/context/')
    })
    assert.deepEqual(tenantReads, [])
    assert.ok(asked.some((u) => new URL(u).pathname === '/v1/staff/tenants'), 'the roster was never asked for')
  })

  it('§5 · at 390 the page does not scroll sideways, and a record is an address Back returns from', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await page.goto(`http://${CONSOLE_HOST}/`, { waitUntil: 'load' })
      await page.waitForSelector('[data-tenancy] [data-tenant]', { timeout: 15_000 })
      const wide = (): Promise<number> => page.evaluate<number>(() => document.documentElement.scrollWidth)
      assert.equal(await wide(), 390, 'the tenancy widens the page past a 390 viewport (RS-01)')
      await page.click('[data-open-tenant="ten_borealis"]')
      await page.waitForSelector('[data-onboarding] tr[data-step]', { timeout: 15_000 })
      assert.equal(await wide(), 390, 'the tenant record widens the page past a 390 viewport (RS-01)')
      assert.equal(new URL(page.url()).searchParams.get('tenant'), 'ten_borealis', 'the record has no address (RS-10)')
      await page.goBack()
      await page.waitForSelector('[data-tenancy]', { timeout: 15_000 })
      assert.equal(new URL(page.url()).searchParams.get('tenant'), null)
      await page.goto(`http://${CONSOLE_HOST}/?tenant=ten_borealis`, { waitUntil: 'load' })
      await page.waitForSelector('[data-tenant-record="ten_borealis"]', { timeout: 15_000 })
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 })
    }
  })

  it('§6 · E1 on the console host goes home to the staff console, never to the register', async () => {
    await page.goto(`http://${CONSOLE_HOST}/no-such-address`, { waitUntil: 'load' })
    await page.waitForSelector('[data-error="404"]', { timeout: 15_000 })
    const ways = await page.evaluate<{ text: string; href: string | null }[]>(() =>
      [...document.querySelectorAll('.e1 .way a')].map((a) => ({ text: (a.textContent ?? '').trim(), href: a.getAttribute('href') })),
    )
    assert.match(ways[0]?.text ?? '', /^Back to the staff console/)
    assert.equal(ways[0]?.href, '/')
    assert.ok(ways.every((w) => w.href !== '/close'), `a way out leads to a route this host does not serve: ${JSON.stringify(ways)}`)
  })
  /* ═══ ROUND TWO — docs/build/ui-audit/reaudit-partner-staff-apex.md ═══════
     WITNESSED RED against `origin/main` (c8fed3c2), this file run in an
     archive of that tree: §7 failed "the frame is still the app's own inset
     shadow: rgb(164, 184, 187) 0px 0px 0px 1px inset", §8 "the skip link does
     not land on the pane heading", and §9 threw reading the cue — there was
     no `li[data-more]` to read (`Cannot read properties of null`).
     Later assertions in each section were not separately witnessed. */

  it('§7 · 1440: the frame wraps the chrome, a click does not focus main, and the chip text is centred (NX-01, NS-02)', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    try {
      await page.goto(`http://${CONSOLE_HOST}/`, { waitUntil: 'load' })
      await page.waitForSelector('[data-tenancy] [data-tenant]', { timeout: 15_000 })
      const frame = await page.evaluate<{ app: string; after: string }>(() => {
        const app = document.querySelector('.app') as HTMLElement
        return { app: getComputedStyle(app).boxShadow, after: getComputedStyle(app, '::after').boxShadow }
      })
      /* The frame was `.app`'s own inset, painted UNDER the chrome's background. */
      assert.equal(frame.app, 'none', `the frame is still the app's own inset shadow: ${frame.app}`)
      assert.match(frame.after, /inset/, `no frame is drawn above the chrome: ${frame.after}`)
      /* NX-01 — the owner's ruling: a click in the work does not focus main. */
      const p = await page.evaluate<{ x: number; y: number }>(() => {
        const el = document.querySelector('[data-tenancy] p.q') as HTMLElement
        const b = el.getBoundingClientRect()
        return { x: b.left + 4, y: b.top + 4 }
      })
      await page.mouse.click(p.x, p.y)
      const active = await page.evaluate<string>(() => document.activeElement?.id || document.activeElement?.tagName || '')
      assert.notEqual(active, 'route-root', 'a mouse click in the work focused main')
      /* NS-02 — the chip's line box fills its height, so the text is centred. */
      const chip = await page.evaluate<{ line: string; h: number }>(() => {
        const t = document.querySelector('[data-staff-chrome] .tenant') as HTMLElement
        return { line: getComputedStyle(t).lineHeight, h: t.clientHeight }
      })
      assert.equal(Math.round(parseFloat(chip.line)), Math.round(chip.h), `the chip's line box (${chip.line}) does not fill its ${String(chip.h)}px height`)
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 })
    }
  })

  it('§8 · keyboard: the skip link lands on the heading; Open focuses the record heading; Back returns to that row (NP-05, NS-03, NS-04)', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    try {
      await page.goto(`http://${CONSOLE_HOST}/`, { waitUntil: 'load' })
      await page.waitForSelector('[data-tenancy] [data-tenant]', { timeout: 15_000 })
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      const skipped = await page.evaluate<{ id: string; h: number }>(() => ({
        id: document.activeElement?.id ?? '',
        h: (document.activeElement as HTMLElement | null)?.getBoundingClientRect().height ?? 0,
      }))
      assert.equal(skipped.id, 'work', 'the skip link does not land on the pane heading')
      assert.ok(skipped.h > 0, 'the skip target has no height to ring')
      await page.focus('[data-open-tenant="ten_borealis"]')
      await page.keyboard.press('Enter')
      await page.waitForSelector('[data-tenant-record="ten_borealis"]', { timeout: 15_000 })
      const opened = await page.evaluate<string>(() => document.activeElement?.textContent ?? '')
      assert.match(opened, /the tenant record/, 'opening a record did not focus its heading')
      const floor = await page.evaluate<number>(() =>
        (document.querySelector('[data-soon-field]') as HTMLElement).getBoundingClientRect().width)
      assert.ok(floor < 400, `New floor spans the pane: ${String(floor)}px`)
      await page.click('[data-back]')
      await page.waitForSelector('[data-tenancy]', { timeout: 15_000 })
      const back = await page.evaluate<string | null>(() => document.activeElement?.getAttribute('data-open-tenant') ?? null)
      assert.equal(back, 'ten_borealis', 'Back did not return focus to the row that was opened')
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 })
    }
  })

  it('§9 · 820: a quiet destination collapses behind a +N cue rather than vanishing (NS-01)', async () => {
    await page.setViewportSize({ width: 820, height: 900 })
    try {
      await page.goto(`http://${CONSOLE_HOST}/`, { waitUntil: 'load' })
      await page.waitForSelector('[data-tenancy] [data-tenant]', { timeout: 15_000 })
      await page.evaluate(() => new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r) }) }))
      const r = await page.evaluate<{ shown: string[]; more: string | null; sw: number }>(() => {
        const ul = document.querySelector('[data-staff-chrome] ul.dests') as HTMLElement
        const shown = [...ul.querySelectorAll(':scope > li')]
          .filter((li) => (li as HTMLElement).offsetParent !== null && !li.hasAttribute('data-more'))
          .map((li) => (li.textContent ?? '').trim())
        const more = ul.querySelector(':scope > li[data-more]') as HTMLElement
        return { shown, more: more.offsetParent === null ? null : (more.textContent ?? '').trim(), sw: document.documentElement.scrollWidth }
      })
      assert.equal(r.sw, 820)
      assert.ok(r.shown.includes('Tenants'), 'the built destination was collapsed')
      /* The cue's text is its count, then its (unseen) tooltip. */
      if (r.shown.length < 3) assert.ok((r.more ?? '').startsWith(`+${String(3 - r.shown.length)}`), `a destination dropped with no cue: ${JSON.stringify(r)}`)
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 })
    }
  })

  /* U-27 / G4181–G4186 — THE NARROW STATUS ROW ON THE STAFF CONSOLE. Until
     this slice only the tenant Close surface had G4071's one tappable row; the
     console drew its own `.statusbar` and it wrapped at 390. Captured red on
     origin/main @ b2563cab, before `StatusGrammar.tsx`: 
       "the three-slot status bar is drawn inline at 390 on [data-surface="console"] — the pack draws one tappable row"
       "the three-slot status bar is drawn inline at 330 on [data-surface="console"] — the pack draws one tappable row" */
  for (const width of [390, 330] as const) {
    it(`§10 · ${String(width)}: the status bar is ONE tappable row showing provenance, and it opens the grammar as a sheet (U-27, G4181)`, async () => {
      await page.setViewportSize({ width, height: 844 })
      try {
        await page.goto(`http://${CONSOLE_HOST}/`, { waitUntil: 'load' })
        await page.waitForSelector('[data-tenancy] [data-tenant]', { timeout: 15_000 })
        await assertNarrowStatusRow(page, '[data-surface="console"]', ['entity', 'plane'], /Provenance · control plane/)
      } finally {
        await page.setViewportSize({ width: 1280, height: 720 })
      }
    })
  }

  it('§11 · 1440: the console keeps its status bar inline and draws no tappable row (U-27, G4181)', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    try {
      await page.goto(`http://${CONSOLE_HOST}/`, { waitUntil: 'load' })
      await page.waitForSelector('[data-tenancy] [data-tenant]', { timeout: 15_000 })
      await assertWideStatusBar(page, '[data-surface="console"]')
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 })
    }
  })
})

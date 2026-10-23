/**
 * G3003/G3007 — THE STAGING PROFILE SWITCHER, IN A REAL BROWSER, ROUND TRIP.
 * The owner's ruling G2771: *"A profile switcher for the mock sign-in and for
 * the owner, so all user journeys can be tested across the customer, partner
 * and 1CloudHub portals."*
 *
 * A FLAGGED bundle (`RECONCILE_TEST_PERSONAS=on`) in chromium, three hosts —
 * the mock tenant, the partner portal, the 1CloudHub console — each served by
 * the same front and the same real data plane with the PRODUCTION authoriser,
 * the three mock doors from `db/seeds/staging-mock-personas.sql` pointed at a
 * local OIDC broker (the fake standing in for Cognito, which states the
 * provider it used in `identities` exactly as Cognito does — G2764).
 *
 *   §1  the switcher renders every persona in a test build.
 *   §2  one CUSTOMER persona: the switcher signs out (nothing here), begins on
 *       the tenant host with `login_hint`, the broker is asked by the customer
 *       door's provider, and the browser lands signed in on THAT host, as a
 *       person provisioned on THAT door — and, once the seed's second run has
 *       granted them, D1 binds `ten_mock` for that cookie.
 *   §3  one PARTNER persona, switched to FROM the customer: the customer's
 *       session row is REVOKED (a real sign-out), and the partner lands signed
 *       in on the partner portal's host, tenant-less.
 *   §4  one 1CLOUDHUB persona, switched to from the partner: the same, on the
 *       console host, and the seed's second run grants them their platform role.
 *
 * ⚠️ `*.localhost` AND NOT `*.invalid`, AND A PORT OF ITS OWN. Chromium
 * resolves every `*.localhost` name to loopback and treats it as a secure
 * context, so the `__Host-` cookie is stored over `http`; a fake TLD would
 * need resolver flags and lose the cookie. The port is not 8080 because
 * `browser-login.test.ts` holds 8080 and `node --test` runs files at once.
 *
 * ⚠️ WHAT THIS CANNOT PROVE, NAMED: that Cognito forwards `login_hint` to an
 * OIDC provider. The fake broker reads it; the real pool's behaviour is the
 * live staging run's to witness (G3008). ⚠️ IT SAID *"And it drives D1
 * straight at the plane, because nothing in a browser can — G3006"* UNTIL
 * #532/#534 MERGED: the owner ruled D1 reads the cookie, and §2 now binds by
 * reloading the register in the browser (G3255).
 */

/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { databaseRequiredUnderCi, browserRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, migratorClient } from '../../db/provision.ts'
import { createAppPool } from '../../db/tenant-scope.ts'
import { withKeyInventoryScope } from '../../db/key-inventory-scope.ts'
import { digestOfHandle } from '../../server/data-plane/handle-digest.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import {
  identityTolerances,
  loadVerificationTerms,
  readConnectionKeyInventory,
} from '../../server/data-plane/verification-terms.ts'
import { MOCK_DOORS, MOCK_PERSONAS, MOCK_TENANT_ID, type MockPersona } from '../../infra/lib/mock-personas.ts'
import { browserSkip, closeBrowser, REPO } from '../design/render.ts'
import { reserveFront, type Front } from './single-origin.ts'
import { startFakeBroker, type FakeBroker } from './fake-oidc-broker.ts'
import { runScopedName } from '../run-scoped-db.ts'

process.env['RECONCILE_DB_NAME'] =
  process.env['RECONCILE_PROFILE_SWITCHER_DB_NAME'] ?? runScopedName('reconcile_profile_switcher_e2e_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal 8091 until 4 Oct 2026. */
const RESERVED_FRONT = await reserveFront()
const PORT = RESERVED_FRONT.port
const TENANT_HOST = `ten-mock.localhost:${PORT}`
const PARTNERS_HOST = `partners.localhost:${PORT}`
const CONSOLE_HOST = `console.localhost:${PORT}`
/** Where each STAGING portal host is reached from this browser — the flagged build's map. */
const PORTAL_ORIGINS: Readonly<Record<string, string>> = {
  'ten-mock.us-west-2.reconcileai.app': `http://${TENANT_HOST}`,
  'partners.reconcileai.app': `http://${PARTNERS_HOST}`,
  'console.reconcileai.app': `http://${CONSOLE_HOST}`,
}

process.env['RECONCILE_SERVING_HOSTS'] = `${TENANT_HOST}|ten_mock|us-west-2|delegated|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${CONSOLE_HOST}|staff|active,${PARTNERS_HOST}|partner|active`
process.env['RECONCILE_SESSION_MAX_LIFETIME_SECONDS'] = '28800'
process.env['RECONCILE_SESSION_MAX_IDLE_SECONDS'] = '900'

const AUDIENCE = 'reconcile-e2e-mock-switcher-client'
const SEED = readFileSync(join(REPO, 'db', 'seeds', 'staging-mock-personas.sql'), 'utf8')
const COOKIE = '__Host-reconcile_session'

const probe = await probeDatabase()
const dbSkip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
const browserWhy = await browserSkip()
databaseRequiredUnderCi('the profile switcher suite', probe)
browserRequiredUnderCi('the profile switcher suite', browserWhy)
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

/** The FLAGGED bundle — exactly what the staging Build stage produces, plus the local host map. */
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

interface Page {
  goto(url: string, o?: unknown): Promise<unknown>
  click(selector: string): Promise<void>
  fill(selector: string, value: string): Promise<void>
  waitForFunction(fn: unknown, arg?: unknown, o?: unknown): Promise<unknown>
  waitForSelector(selector: string, o?: unknown): Promise<unknown>
  evaluate<T>(fn: unknown, arg?: unknown): Promise<T>
  url(): string
  close(): Promise<void>
}
interface Cookie {
  name: string
  value: string
  domain: string
}
interface Ctx {
  newPage(): Promise<Page>
  cookies(): Promise<Cookie[]>
  close(): Promise<void>
}
interface Br {
  newContext(o?: unknown): Promise<Ctx>
  close(): Promise<void>
}

function planePost(planeUrl: string, path: string, host: string, handle: string, body: unknown): Promise<number> {
  const url = new URL(planeUrl)
  const payload = JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path,
        method: 'POST',
        headers: {
          Host: host,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          cookie: `${COOKIE}=${handle}`,
        },
      },
      (res) => {
        res.resume()
        res.on('end', () => resolve(res.statusCode ?? 0))
      },
    )
    req.on('error', reject)
    req.end(payload)
  })
}

const personaOf = (sub: string): MockPersona => {
  const p = MOCK_PERSONAS.find((x) => x.sub === sub)
  if (p === undefined) throw new Error(sub)
  return p
}

describe('the staging profile switcher, in a browser', { skip }, () => {
  let broker: FakeBroker
  let plane: { url: string; close(): Promise<void> }
  let front: Front
  let br: Br
  let ctx: Ctx
  let page: Page
  let dist = ''

  before(async () => {
    dist = mkdtempSync(join(tmpdir(), 'reconcile-switcher-'))
    buildFlaggedBundle(dist)
    await resetSchema()
    await q(SEED)
    broker = await startFakeBroker({ audience: AUDIENCE, downgradeToHttp: true })
    /* The three mock doors, re-pointed at the local broker — before any person
       exists, because `tenant."user"`'s composite FK pins the broker pair. */
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
    plane = await startDataPlane({ poolMax: 4, identityTerms })
    front = RESERVED_FRONT.serve(dist, plane.url)
    const pw = (await import('playwright')) as unknown as { chromium: { launch(): Promise<Br> } }
    br = await pw.chromium.launch()
    ctx = await br.newContext()
    page = await ctx.newPage()
  })

  after(async () => {
    await page?.close()
    await ctx?.close()
    await br?.close()
    await front?.close()
    await plane?.close()
    await broker?.close()
    if (dist !== '') rmSync(dist, { recursive: true, force: true })
  })

  async function handleOn(host: string): Promise<string> {
    const jar = await ctx.cookies()
    const hostname = host.split(':')[0]
    const cookie = jar.find((c) => c.name === COOKIE && c.domain === hostname && c.value !== '')
    assert.ok(cookie, `no session cookie on ${host}`)
    return cookie.value
  }

  async function sessionOf(handle: string) {
    const rows = await q<{ id: string; connection_id: string; tenant_id: string | null; issued_host: string; email: string }>(
      `SELECT s.id, s.connection_id, s.tenant_id, s.issued_host, u.email
         FROM tenant.session s JOIN tenant."user" u ON u.id = s.user_id
        WHERE s.handle_digest = $1`,
      [digestOfHandle(handle)],
    )
    assert.equal(rows.length, 1, 'the cookie names no session row')
    return rows[0]
  }

  /** `SIGN_IN_LANDING`: the tenant surface lands on `/close`, a console on `/`. */
  async function switchTo(sub: string, host: string, landing: '/close' | '/'): Promise<void> {
    const p = personaOf(sub)
    /* G3191 — signed in, the switcher is an item of the chrome's account
       menu, a closed `<details>`; open it as a person would. A signed-out
       surface draws it as a page aside and has no menu, so this is a no-op
       there. */
    await page.evaluate(() => {
      const menu = document.querySelector<HTMLDetailsElement>('details.acct')
      if (menu !== null && menu.querySelector('[data-profile-switcher]') !== null) menu.open = true
    })
    await page.click(`[data-persona="${p.email}"]`)
    try {
      await page.waitForFunction(
        ([h, l]: [string, string]) => location.host === h && location.pathname === l,
        [host, landing],
        { timeout: 20_000 },
      )
    } catch (err) {
      const where = page.url()
      const said = await page.evaluate<string>(() => document.body.innerText).catch(() => '')
      throw new Error(`switching to ${sub} did not land on ${host}${landing} — at ${where}: ${said.slice(0, 400)}`, {
        cause: err,
      })
    }
    const asked = broker.lastAuthorize()
    assert.ok(asked, 'the browser never reached the broker')
    assert.equal(asked.get('login_hint'), p.email, 'the switcher did not hint the persona')
    assert.equal(asked.get('identity_provider'), `c-${MOCK_DOORS[p.door].handle}`, 'the wrong door was asked')
  }

  it('§1 · a test build renders the switcher with every persona', async () => {
    await page.goto(`http://${TENANT_HOST}/signin`, { waitUntil: 'load' })
    await page.waitForSelector('[data-profile-switcher]', { timeout: 15_000 })
    const listed = await page.evaluate<string[]>(() =>
      [...document.querySelectorAll('[data-persona]')].map((b) => b.getAttribute('data-persona') ?? ''),
    )
    assert.deepEqual([...listed].sort(), MOCK_PERSONAS.map((p) => p.email).sort())
  })

  let customerHandle = ''

  it('§2 · a CUSTOMER persona signs in on the tenant host, through the customer door', async () => {
    await switchTo('mock-cust-admin', TENANT_HOST, '/close')
    customerHandle = await handleOn(TENANT_HOST)
    const s = await sessionOf(customerHandle)
    assert.equal(s?.connection_id, MOCK_DOORS.customer.connectionId)
    assert.equal(s?.email, personaOf('mock-cust-admin').email)
    assert.equal(s?.issued_host, TENANT_HOST)
    assert.equal(s?.tenant_id, null, 'INVARIANT 1: authentication conferred a tenant')

    /* 🛑 G3255 — THE BROWSER BINDS, THROUGH THE COOKIE. This section drove D1
       straight at the plane with `{ sessionToken }` in the BODY, because no
       browser could (G3006's finding). The owner ruled *"D1 reads the
       cookie"* and #532 applied it: the body is a closed empty object (a
       `sessionToken` in it is now a 400 — which is what this line would have
       been asserting `notEqual 200` against, vacuously) and the app binds on
       boot. The refusal is still asked at the plane, with `{}`; the grant is
       witnessed by RELOADING the register in the browser. */
    assert.notEqual(await planePost(plane.url, '/context/resolve', TENANT_HOST, customerHandle, {}), 200,
      'D1 bound a persona the seed has not granted yet')
    await q(SEED)
    await page.goto(`http://${TENANT_HOST}/close`, { waitUntil: 'load' })
    await page.waitForFunction(() => document.querySelector('[data-bound-tenant]') !== null, undefined, {
      timeout: 15_000,
    })
    assert.equal(
      await page.evaluate<string | null>(() =>
        document.querySelector('[data-bound-tenant]')?.getAttribute('data-bound-tenant') ?? null,
      ),
      MOCK_TENANT_ID,
      'the seed`s second run did not make the customer admin bindable to ten_mock from the browser',
    )
    assert.equal((await sessionOf(customerHandle))?.tenant_id, MOCK_TENANT_ID, 'the browser did not bind the HOST`s tenant')
  })

  it('§3 · switching to a PARTNER persona revokes the customer’s session and signs in on the partner portal', async () => {
    await switchTo('mock-partner-admin', PARTNERS_HOST, '/')
    const before = await q<{ revoked: boolean }>(
      'SELECT revoked_at IS NOT NULL AS revoked FROM tenant.session WHERE handle_digest = $1',
      [digestOfHandle(customerHandle)],
    )
    assert.deepEqual(before, [{ revoked: true }], 'the switch did not REVOKE the session it left — that is not a sign-out')
    const s = await sessionOf(await handleOn(PARTNERS_HOST))
    assert.equal(s?.connection_id, MOCK_DOORS.partner.connectionId)
    assert.equal(s?.issued_host, PARTNERS_HOST)
    assert.equal(s?.tenant_id, null)
  })

  it('§3b · the partner lands on the P1 PORTAL, reads the deals list, and registers a deal (G3298)', async () => {
    /* 🛑 THE DEFECT, MEASURED ON STAGING 3 Oct 2026: the partner landed on
       `/` and was shown the tenant application's route placeholder. The
       portal is drawn on the partner host; the seed's second run grants the
       persona its partner-portal role, and the reload reads the registry
       through the PRODUCTION authoriser. */
    await q(SEED)
    await page.goto(`http://${PARTNERS_HOST}/`, { waitUntil: 'load' })
    await page.waitForSelector('[data-partner-portal="deals"] [data-partner-pane="deals"]', { timeout: 15_000 })
    const body = await page.evaluate<string>(() => document.body.innerText)
    assert.doesNotMatch(body, /design\/routes|This route resolves/, 'the partner host still draws the route placeholder')
    assert.equal(
      await page.evaluate<number>(() => document.querySelectorAll('[data-chrome]').length),
      1,
      'the portal draws exactly one chrome — its own, not the tenant bar beside it',
    )
    await page.waitForSelector('table[data-claims] tr[data-registration]', { timeout: 15_000 })
    const seeded = await page.evaluate<string[]>(() =>
      [...document.querySelectorAll('table[data-claims] tbody th')].map((th) => th.textContent ?? ''),
    )
    assert.deepEqual([...seeded].sort(), ['Illustrative Prospect A', 'Illustrative Prospect B'],
      'the deals list is not the firm`s registry as the plane holds it')

    /* Register a deal — the portal's one write, a 202 RECEIVED. */
    await page.click('[data-register-open]')
    await page.waitForSelector('[data-register-form]')
    await page.fill('[data-register-form] input[name="company"]', 'E2E Switcher Prospect Ltd')
    await page.fill('[data-register-form] input[name="annualValue"]', '180,000')
    await page.fill('[data-register-form] input[name="expectedClose"]', '30 Nov 2026')
    await page.click('[data-register-send]')
    await page.waitForSelector('[data-result="ok"]', { timeout: 15_000 })
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('table[data-claims] tbody th')].some(
          (th) => th.textContent === 'E2E Switcher Prospect Ltd',
        ),
      undefined,
      { timeout: 15_000 },
    )
    /* G3561 — the value is MONEY now: minor units, the currency the form
       defaulted to and showed (SGD), and its exponent; `0322`'s
       undenominated `annual_value` is never written again (`0470` §4). */
    const stored = await q<{ shape: string; standing: string; annual_value: string | null; minor: string; currency: string; exponent: number }>(
      `SELECT shape, standing, annual_value, annual_value_minor::text AS minor,
              annual_value_currency AS currency, annual_value_exponent AS exponent
         FROM tenant.deal_registration WHERE company = $1`,
      ['E2E Switcher Prospect Ltd'],
    )
    assert.deepEqual(stored, [{ shape: 'deal', standing: 'waiting', annual_value: null, minor: '18000000', currency: 'SGD', exponent: 2 }],
      'the registration did not reach the registry as a waiting deal worth SGD 180,000')

    /* The administrator's chrome draws People (the roster answered 200), and
       the Sandbox pane reads the firm's own standing. */
    await page.waitForSelector('[data-partner-chrome] a[href="/partner/people"]', { timeout: 15_000 })
    await page.click('[data-partner-chrome] a[href="/partner/sandbox"]')
    await page.waitForSelector('[data-partner-pane="sandbox"][data-sandbox]', { timeout: 15_000 })
    assert.equal(new URL(page.url()).pathname, '/partner/sandbox')
  })

  it('§4 · switching to a 1CLOUDHUB persona lands on the console, and the seed grants them their platform role', async () => {
    const partnerHandle = await handleOn(PARTNERS_HOST)
    await switchTo('mock-staff-platform', CONSOLE_HOST, '/')
    const left = await q<{ revoked: boolean }>(
      'SELECT revoked_at IS NOT NULL AS revoked FROM tenant.session WHERE handle_digest = $1',
      [digestOfHandle(partnerHandle)],
    )
    assert.deepEqual(left, [{ revoked: true }])
    /* G3295, G3372 — the console's `/` is the S1 staff console (#538), not the
       route placeholder and not #542's interim front door, which is deleted. */
    await page.waitForSelector('[data-staff-chrome]', { timeout: 15_000 })
    assert.doesNotMatch(await page.evaluate<string>(() => document.body.innerText), /design\/routes|This route resolves/)
    const s = await sessionOf(await handleOn(CONSOLE_HOST))
    assert.equal(s?.connection_id, MOCK_DOORS.platform.connectionId)
    assert.equal(s?.issued_host, CONSOLE_HOST)
    await q(SEED)
    const roles = await q<{ role_id: string }>(
      `SELECT a.role_id FROM tenant.platform_role_assignment a JOIN tenant."user" u ON u.id = a.user_id
        WHERE u.connection_id = $1`,
      [MOCK_DOORS.platform.connectionId],
    )
    assert.deepEqual(roles, [{ role_id: 'plr_mock_platform' }])
    const partnerRoles = await q<{ role_id: string }>(`SELECT role_id FROM tenant.partner_role_assignment`)
    assert.deepEqual(partnerRoles, [{ role_id: 'prl_mock_admin' }])
  })
})

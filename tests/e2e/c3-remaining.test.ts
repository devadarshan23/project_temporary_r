/**
 * THE C3 REGISTER AUDIT'S LAST FOUR ITEMS, IN A REAL BROWSER, AGAINST A REAL
 * PLANE — C3-24, C3-25, C3-28 and C3-30 of `docs/build/ui-audit/red-c1-round3.md`,
 * named LEFT by G3855. G4041–G4048 (4 Oct 2026).
 *
 *   §1  C3-24 — the account menu is a MENU: `role="menu"`, its acts
 *       `menuitem`, its rows `none`, and the arrow keys walk it (Design System
 *       primitive 5, `ul.menu[role=menu] > li[role=none] > button[role=menuitem]`).
 *   §2  C3-25 — while the runs read is out, the status bar does not assert
 *       "no period": it says the period is being read (Design System 13, *"The
 *       scope is stated while it loads"*).
 *   §3  C3-28 — the first Tab on the close surface is a skip link to the
 *       register, so the quiet controls G189 keeps in the tab order are not
 *       the price of reaching it.
 *   §4  C3-30 — the row's Accept says it is working while the propose is out.
 *
 * Production authoriser, real row-level security, its own databases, and an
 * ephemeral port (G3911, `reserveFront()`).
 * WITNESSED RED against origin/main (4a831a00), the built bundle, before the
 * repair — §1–§3 each failed and §4 PASSED, which is the finding for C3-30:
 *
 *   §1  `AssertionError: the avatar does not say it opens a menu · actual: null,
 *       expected: 'menu'`
 *   §2  `AssertionError: the status bar asserted "no period" while the runs read
 *       was out: Close · no period`
 *   §3  `AssertionError: the first Tab is not a skip link to the register ·
 *       actual: { cls: 'mark', text: '···ReconcileAI', href: '/close' }`
 *   §4  ✔ — the busy state exists (`Accepting`, `aria-busy`, every other row's
 *       Accept `aria-disabled`), so C3-30 is NOT reproduced and is pinned here
 *       instead (G4044). G3855 said the same without a witness.
 *
 * ⚠️ AND §1 WENT RED A SECOND TIME, ON THE FIRST REPAIR: `Escape did not close
 * the menu and return focus to the avatar · actual: { open: true, onSummary:
 * false }`. `<details>` reports its toggle a task after the keystroke that
 * opened it, so the overlay primitive was wired late and captured the first ITEM as the opener —
 * the key handler now wires it with `flushSync` before moving focus (G4041).
 */

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

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_C3_REMAINING_E2E_DB_NAME'] ?? runScopedName('reconcile_c3_remaining_e2e_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']
/* `getSessionPrincipal` — the session's capabilities, which decide whether
   Accept and Reopen are DRAWN (G3522) — reads the bound tenant's name from the
   control database through the read-only pool, so this suite stands one up
   (`tests/http/session-principal-served.test.ts`'s shape). */
const CONTROL_DB = process.env['RECONCILE_C3_REMAINING_CONTROL_DB_NAME'] ?? runScopedName('reconcile_c3_remaining_control_test')
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
const DOOR = 'idc_acme_c3r_e2e'
const OPERATOR = 'usr_acme_c3r_e2e_operator'
const VIEWER = 'usr_acme_c3r_e2e_viewer'
const OPERATOR_HANDLE = 'e2e_c3r_operator_5c8f2d01e3b45f7a9c6d8e0f1a2b3c4d'
const VIEWER_HANDLE = 'e2e_c3r_viewer_0e4b8a31d2c95f6b0d7e9f8a1b2c3d4e'
const DEFINITION = 'def_c3r_e2e'
const PACK = 'pck_c3r_e2e'
const RUN = 'run_acme_c3r_e2e'
/** A line whose approval is not mandatory — Accept posts it. */
const POSTS = 'exc_acme_c3r_posts'
/** A critical line — approval mandatory, four eyes — Accept leaves it waiting. */
const WAITS = 'exc_acme_c3r_waits'
/** A line for the notice's Undo. */
const UNDOES = 'exc_acme_c3r_undoes'

const DIST = join(REPO, 'frontend', 'dist')

const probe = await probeDatabase()
const dbSkip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
const browserWhy = await browserSkip()
databaseRequiredUnderCi('the C3 remaining-items browser suite', probe)
browserRequiredUnderCi('the C3 remaining-items browser suite', browserWhy)
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
  focus(selector: string): Promise<void>
  keyboard: { press(key: string): Promise<void> }
  route(url: string | RegExp, handler: (route: Route) => Promise<void> | void): Promise<void>
}
interface Route {
  request(): { method(): string; url(): string }
  continue(): Promise<void>
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
    application_name: 'reconcile-c3-remaining-setup',
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
       VALUES ($1, 'oidc', 'Acme Entra ID', 'customer', NULL, 'acc_acme', 'https://login.microsoftonline.com/c3r-e2e/v2.0', 'acme-c3r-e2e', 'active')`,
      [DOOR],
    )
    for (const [user, name, role, caps, handle, i] of [
      [OPERATOR, 'Acme Operator', 'rol_c3r_e2e_operator', [
        CAPABILITIES.viewException,
        CAPABILITIES.proposeResolution,
        CAPABILITIES.executeResolution,
        CAPABILITIES.approveResolution,
        CAPABILITIES.reverseResolution,
      ], OPERATOR_HANDLE, 0],
      [VIEWER, 'Acme Viewer', 'rol_c3r_e2e_viewer', [CAPABILITIES.viewException], VIEWER_HANDLE, 1],
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
        [`ses_c3r_e2e_${i}`, digestOfHandle(handle), user, DOOR, ACME, HOST],
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

/** A gate a held request waits on — opened by the test, never by a timer. */
function gate(): { wait: Promise<void>; open: () => void } {
  let open = (): void => {}
  const wait = new Promise<void>((resolve) => { open = resolve })
  return { wait, open }
}

describe('the C3 register audit, last four items (G4041–G4048)', { skip }, () => {
  let plane: Awaited<ReturnType<typeof startDataPlane>>
  let front: Front
  let br: Br
  const origin = `http://${HOST}`

  async function openPage(handle: string, before?: (page: Page) => Promise<void>, wait = true): Promise<{ ctx: Ctx; page: Page }> {
    const ctx = await br.newContext({ baseURL: origin })
    await ctx.addCookies([
      { name: SESSION_COOKIE, value: handle, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await ctx.newPage()
    if (before !== undefined) await before(page)
    await page.goto(`${origin}/close`, { waitUntil: 'load' })
    if (wait) await page.waitForSelector(`[data-exception="${POSTS}"]`, { timeout: 15_000 })
    return { ctx, page }
  }

  /** What the focused element is, in the terms the assertions need. */
  const focused = (page: Page): Promise<{ role: string | null; text: string; id: string; inMenu: boolean }> =>
    page.evaluate<{ role: string | null; text: string; id: string; inMenu: boolean }>(() => {
      const el = document.activeElement
      return {
        role: el?.getAttribute('role') ?? null,
        text: (el?.textContent ?? '').trim(),
        id: el?.id ?? '',
        inMenu: el?.closest('[role="menu"]') !== null && el?.closest('[role="menu"]') !== undefined,
      }
    })

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

  it('§1 · C3-24 — the account menu is a menu, and the arrow keys walk it', async () => {
    const { ctx, page } = await openPage(OPERATOR_HANDLE)
    try {
      await page.waitForSelector('.chrome summary.whoami [data-whoami]', { timeout: 15_000 })
      const shape = await page.evaluate<{ haspopup: string | null; menus: number; items: number; plain: number; strays: number }>(() => {
        const menu = document.querySelector('.chrome .acctmenu')
        const rows = menu === null ? [] : [...menu.children]
        return {
          haspopup: document.querySelector('.chrome summary.whoami')?.getAttribute('aria-haspopup') ?? null,
          menus: document.querySelectorAll('.chrome .acctmenu[role="menu"]').length,
          items: menu === null ? 0 : menu.querySelectorAll('[role^="menuitem"]').length,
          /* A row of a menu is presentational, or a separator — never a listitem. */
          plain: rows.filter((li) => li.getAttribute('role') !== 'none' && li.getAttribute('role') !== 'separator').length,
          /* Every act in the menu is a menu item. */
          strays: menu === null ? 0 : [...menu.querySelectorAll('a, button')].filter((b) => !(b.getAttribute('role') ?? '').startsWith('menuitem')).length,
        }
      })
      assert.equal(shape.haspopup, 'menu', 'the avatar does not say it opens a menu')
      assert.equal(shape.menus, 1, 'the account menu carries no role="menu" (Design System primitive 5)')
      assert.ok(shape.items >= 5, `the menu has ${shape.items} menu items`)
      assert.equal(shape.plain, 0, 'a row of the menu is a plain listitem')
      assert.equal(shape.strays, 0, 'an act in the menu is not a menu item')

      await page.focus('.chrome summary.whoami')
      await page.keyboard.press('Enter')
      await page.keyboard.press('ArrowDown')
      const first = await focused(page)
      assert.ok(first.inMenu && (first.role ?? '').startsWith('menuitem'), `ArrowDown from the avatar focused ${JSON.stringify(first)}`)
      await page.keyboard.press('ArrowDown')
      const second = await focused(page)
      assert.ok(second.inMenu && second.text !== first.text, `the second ArrowDown did not move: ${JSON.stringify(second)}`)
      await page.keyboard.press('End')
      assert.equal((await focused(page)).text, 'Sign out', 'End did not reach the last item')
      await page.keyboard.press('ArrowDown')
      assert.equal((await focused(page)).text, first.text, 'ArrowDown from the last item did not wrap to the first')
      await page.keyboard.press('ArrowUp')
      assert.equal((await focused(page)).text, 'Sign out', 'ArrowUp from the first item did not wrap to the last')
      await page.keyboard.press('Escape')
      const after = await page.evaluate<{ open: boolean; onSummary: boolean }>(() => ({
        open: (document.querySelector('.chrome details.acct') as HTMLDetailsElement | null)?.open ?? false,
        onSummary: document.activeElement?.matches('.chrome summary.whoami') ?? false,
      }))
      assert.deepEqual(after, { open: false, onSummary: true }, 'Escape did not close the menu and return focus to the avatar')
    } finally {
      await ctx.close()
    }
  })

  it('§2 · C3-25 — while the runs read is out, the status bar says the period is being read', async () => {
    const held = gate()
    const { ctx, page } = await openPage(OPERATOR_HANDLE, async (p) => {
      await p.route(/\/v1\/runs(\?|$)/, async (route) => {
        if (route.request().method() === 'GET') await held.wait
        await route.continue()
      })
    }, false)
    try {
      await page.waitForSelector('.statusbar', { timeout: 15_000 })
      const reading = await page.evaluate<string>(() => document.querySelector('.statusbar .bit')?.textContent ?? '')
      assert.doesNotMatch(reading, /no period/, `the status bar asserted "no period" while the runs read was out: ${reading}`)
      assert.match(reading, /reading the period/, `the status bar does not say the period is being read: ${reading}`)
      held.open()
      /* Read, and the run carries no period: now "no period" is the true answer. */
      await page.waitForSelector(`[data-exception="${POSTS}"]`, { timeout: 15_000 })
      await page.waitForSelector('.statusbar .bit b[data-period="none"]', { timeout: 15_000 })
    } finally {
      held.open()
      await ctx.close()
    }
  })

  it('§3 · C3-28 — the first Tab is a skip link that lands on the register', async () => {
    const { ctx, page } = await openPage(OPERATOR_HANDLE)
    try {
      await page.keyboard.press('Tab')
      const skip = await page.evaluate<{ cls: string; text: string; href: string | null }>(() => ({
        cls: document.activeElement?.className ?? '',
        text: (document.activeElement?.textContent ?? '').trim(),
        href: document.activeElement?.getAttribute('href') ?? null,
      }))
      assert.deepEqual(skip, { cls: 'skip', text: 'Skip to the register', href: '#register' }, 'the first Tab is not a skip link to the register')
      await page.keyboard.press('Enter')
      /* A fragment navigation moves the SEQUENTIAL FOCUS STARTING POINT to the
         target (HTML, *scroll to the fragment*); whether the target itself
         takes focus is the browser's. The property a keyboard user has is the
         next Tab: it lands inside the register, past every quiet control. */
      await page.keyboard.press('Tab')
      const next = await page.evaluate<{ inRegister: boolean; what: string }>(() => ({
        inRegister: document.activeElement?.closest('#register') !== null,
        what: (document.activeElement?.textContent ?? '').trim().slice(0, 40),
      }))
      assert.equal(next.inRegister, true, `the Tab after the skip landed outside the register, on "${next.what}"`)
    } finally {
      await ctx.close()
    }
  })

  it('§4 · C3-30 — Accept says it is working while the propose is out', async () => {
    const held = gate()
    const { ctx, page } = await openPage(OPERATOR_HANDLE, async (p) => {
      await p.route(/\/v1\/exceptions\/[^/]+\/proposals$/, async (route) => {
        if (route.request().method() === 'POST') await held.wait
        await route.continue()
      })
    })
    try {
      const button = `td.act [data-accept="${POSTS}"]`
      await page.waitForSelector(button, { timeout: 15_000 })
      await page.click(button)
      await page.waitForSelector(`${button}[aria-busy="true"]`, { timeout: 15_000 })
      const busy = await page.evaluate<{ text: string; others: number }>((s: string) => ({
        text: (document.querySelector(s)?.textContent ?? '').trim(),
        /* Every other row's Accept refuses a second act while one is out. */
        others: [...document.querySelectorAll('td.act [data-accept]')].filter((b) => !b.matches(s) && b.getAttribute('aria-disabled') !== 'true').length,
      }), button)
      assert.equal(busy.text, 'Accepting', 'the busy Accept does not say it is working')
      assert.equal(busy.others, 0, 'another row\'s Accept stayed live while an act was out')
      held.open()
      await page.waitForSelector(`[data-exception="${POSTS}"] [data-status="resolved"]`, { timeout: 15_000 })
      /* The held act still completed once released — the busy state is a wait, not a refusal. */
      assert.deepEqual(await one('SELECT status FROM tenant.exception WHERE id = $1', [POSTS]), { status: 'resolved' })
    } finally {
      held.open()
      await ctx.close()
    }
  })
})

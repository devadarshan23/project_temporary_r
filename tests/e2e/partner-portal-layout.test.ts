/**
 * THE PARTNER PORTAL AT FOUR WIDTHS, IN A REAL BROWSER — RP-01, RP-02, RP-05,
 * RP-06 and RP-08a from `docs/build/ui-audit/red-partner-staff-apex.md`.
 * G3566–G3570, 3 Oct 2026.
 *
 * 🛑 RP-01 WAS A BLOCKER AND THIS IS ITS GATE ASSERTION, AS THE REPORT ASKED:
 * *"Add a gate assertion that `scrollWidth === innerWidth` on the partner host
 * at 1024/820/390."* Measured on the commit before this one: the document was
 * **1343** wide at 1024 and at 820 and **453** at 390, and the account menu —
 * the only way to Sign out — sat past the right edge. The cause was one rule
 * in `close.css` the tenant chrome needs and the partner chrome does not:
 * `@media (max-width:1279px){ .chrome > nav{flex:none} }` stops the nav
 * shrinking, so eight destinations pushed every control after them off-screen.
 *
 * ⚠️ WITNESSED RED FIRST. Run against the pre-repair build, §1 failed at all
 * three narrow widths with the numbers above and §2 failed at 1440 and 1280
 * (People's right edge 1027 against the nav's 841); the captured messages are
 * quoted on each assertion. The suite runs against `frontend/dist`, which the
 * gate builds in the stage before `npm test`; `PARTNER_LAYOUT_DIST` points it
 * at another build, which is how the red was taken.
 *
 * The seeded rows are a local fixture (`tests/db/partner-fixture.ts`): ANA is
 * the fixture firm's partner administrator, BEN its partner user.
 */
/* G3912: first, so the control database's port follows `RECONCILE_DB_PORT`. */
import '../control-db-port.ts'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { databaseRequiredUnderCi, browserRequiredUnderCi } from '../reachability.ts'
import { probeDatabase, describeTarget } from '../../db/env.ts'
import { resetSchema, seedTwoTenants, migratorClient } from '../../db/provision.ts'
import { startDataPlane } from '../../server/data-plane/start.ts'
import { browserSkip, closeBrowser, REPO } from '../design/render.ts'
import { reserveFront, type Front } from './single-origin.ts'
import { seedPartnerPortal, HANDLES } from '../db/partner-fixture.ts'
import { runScopedName } from '../run-scoped-db.ts'
import { assertNarrowStatusRow, assertWideStatusBar } from './narrow-status.ts'

process.env['RECONCILE_DB_NAME'] = process.env['RECONCILE_PARTNER_LAYOUT_DB_NAME'] ?? runScopedName('reconcile_partner_layout_e2e_test')
delete process.env['RECONCILE_LOCAL_TEST_AUTH']

/* G3911: the kernel chooses the front's port and the socket is HELD from
   here, so every host string below is known before the plane starts and no
   concurrent gate run can take it. It was the literal 8098 until 4 Oct 2026. */
const RESERVED_FRONT = await reserveFront()
const PORT = RESERVED_FRONT.port
const PARTNERS_HOST = `partners.localhost:${PORT}`
process.env['RECONCILE_SERVING_HOSTS'] = `ten-acme.localhost:${PORT}|ten_acme|ap-southeast-1|delegated|active`
process.env['RECONCILE_CONSOLE_HOSTS'] = `${PARTNERS_HOST}|partner|active`

const COOKIE = '__Host-reconcile_session'
const DIST = process.env['PARTNER_LAYOUT_DIST'] ?? join(REPO, 'frontend', 'dist')

const probe = await probeDatabase()
const dbSkip = probe.ok ? false : `no PostgreSQL reachable at ${describeTarget()} — ${probe.reason}`
const browserWhy = await browserSkip()
databaseRequiredUnderCi('the partner portal layout suite', probe)
browserRequiredUnderCi('the partner portal layout suite', browserWhy)
after(async () => {
  await closeBrowser()
})
const skip = dbSkip !== false ? dbSkip : browserWhy !== false ? browserWhy : false

interface Box { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
interface Locator {
  boundingBox(): Promise<Box | null>
  isVisible(): Promise<boolean>
  count(): Promise<number>
}
interface Page {
  goto(url: string, o?: unknown): Promise<unknown>
  click(selector: string): Promise<void>
  fill(selector: string, value: string): Promise<void>
  keyboard: { press(key: string): Promise<void> }
  waitForFunction(fn: unknown, arg?: unknown, o?: unknown): Promise<unknown>
  waitForSelector(selector: string, o?: unknown): Promise<unknown>
  evaluate<T>(fn: unknown, arg?: unknown): Promise<T>
  locator(selector: string): Locator
  route(url: string, handler: (route: { continue(): Promise<void>; fulfill(o: { status: number; contentType?: string; body?: string }): Promise<void> }) => Promise<void>): Promise<void>
  mouse: { click(x: number, y: number): Promise<void> }
  close(): Promise<void>
}
interface Ctx {
  addCookies(c: readonly Record<string, unknown>[]): Promise<void>
  newPage(): Promise<Page>
  close(): Promise<void>
}
interface Br {
  newContext(o?: unknown): Promise<Ctx>
  close(): Promise<void>
}

let plane: { url: string; close(): Promise<void> } | null = null
let front: Front | null = null
let br: Br | null = null

async function pageFor(handle: string, width: number, height = 900): Promise<{ ctx: Ctx; page: Page }> {
  if (br === null) throw new Error('no browser')
  const ctx = await br.newContext({ viewport: { width, height } })
  await ctx.addCookies([
    { name: COOKIE, value: handle, domain: 'partners.localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
  ])
  return { ctx, page: await ctx.newPage() }
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(`http://${PARTNERS_HOST}${path}`, { waitUntil: 'load' })
  await page.waitForFunction(
    () => document.querySelector('[data-partner-chrome] nav[data-settling]') === null &&
      !/\bReading\b/.test(document.body.innerText),
    undefined,
    { timeout: 15_000 },
  )
  /* The drop order is applied in a layout effect; let it observe once. */
  await page.evaluate(() => new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r) }) }))
}

describe('the partner portal at four widths', { skip }, () => {
  before(async () => {
    assert.ok(existsSync(join(DIST, 'index.html')), `no built bundle at ${DIST} — the gate builds it before npm test`)
    await resetSchema()
    await seedTwoTenants('ten_acme', 'ten_globex')
    await seedPartnerPortal()
    const mig = await migratorClient()
    try {
      /* G180 binds a session to the host that issued it; re-issue both on
         THIS partner host, as the parity shot does. */
      await mig.query(`UPDATE tenant.session SET issued_host = $1 WHERE id IN ('ses_ana', 'ses_ben', 'ses_carl')`, [PARTNERS_HOST])
    } finally {
      await mig.end()
    }
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

  for (const width of [1440, 1280, 1024, 820, 390] as const) {
    it(`§1 · ${String(width)}: no sideways scroll, and Sign out is reachable inside the viewport (RP-01)`, async () => {
      const { ctx, page } = await pageFor(HANDLES.ana, width)
      try {
        await open(page, '/')
        const m = await page.evaluate<{ sw: number; iw: number }>(() => ({
          sw: document.documentElement.scrollWidth,
          iw: window.innerWidth,
        }))
        /* Captured red, pre-repair build: "1343 !== 1024", "1343 !== 820", "453 !== 390". */
        assert.equal(m.sw, m.iw, `the partner host scrolls sideways at ${String(width)}: scrollWidth ${String(m.sw)}`)

        const who = page.locator('[data-partner-chrome] summary.whoami')
        const wb = await who.boundingBox()
        assert.ok(wb !== null, 'the account menu has no box')
        assert.ok(wb.x >= 0 && wb.x + wb.width <= width, `the account menu sits at x ${String(wb.x)}–${String(wb.x + wb.width)} in a ${String(width)} viewport`)
        await page.click('[data-partner-chrome] summary.whoami')
        const out = page.locator('[data-sign-out]')
        assert.ok(await out.isVisible(), 'Sign out is not visible once the menu is open')
        const ob = await out.boundingBox()
        assert.ok(ob !== null && ob.x >= 0 && ob.x + ob.width <= width + 0.5,
          `Sign out sits outside the viewport: ${JSON.stringify(ob)}`)
      } finally {
        await ctx.close()
      }
    })
  }

  for (const width of [1440, 1280, 1024, 820] as const) {
    it(`§2 · ${String(width)}: People, a built destination, is never clipped by the bar (RP-02)`, async () => {
      const { ctx, page } = await pageFor(HANDLES.ana, width)
      try {
        await open(page, '/')
        const r = await page.evaluate<{ nav: number; left: number; people: number; dropped: string; more: boolean }>(() => {
          const nav = document.querySelector('[data-partner-chrome] nav') as HTMLElement
          const ul = nav.querySelector('ul.dests') as HTMLElement
          const people = Array.from(ul.querySelectorAll('a')).find((a) => a.textContent === 'People') as HTMLElement
          const nb = ul.getBoundingClientRect()
          const pb = people.getBoundingClientRect()
          const more = ul.querySelector('li[data-more]') as HTMLElement | null
          return { nav: nb.right, left: nb.left, people: pb.right, dropped: ul.dataset['quietDropped'] ?? '0', more: more !== null && !more.hidden }
        })
        /* Captured red, pre-repair build at 1440: "People ends at 1027, the bar at 841". */
        assert.ok(r.people <= r.nav + 0.5, `People ends at ${String(r.people)}, the bar at ${String(r.nav)}`)
        /* THE CUE — when a quiet destination is collapsed, the +N says so. */
        if (r.dropped !== '0') assert.ok(r.more, 'quiet destinations were collapsed with no visible cue')
      } finally {
        await ctx.close()
      }
    })
  }

  it('§2b · 390: the phone shell carries the built destinations in a tab bar, People among them (RP-01/RP-02)', async () => {
    const { ctx, page } = await pageFor(HANDLES.ana, 390)
    try {
      await open(page, '/')
      const tabs = await page.evaluate<string[]>(() =>
        Array.from(document.querySelectorAll('[data-partner-tabbar] a.tab'))
          .filter((a) => (a as HTMLElement).offsetParent !== null)
          .map((a) => a.textContent ?? ''))
      assert.deepEqual(tabs, ['Deals', 'Sandbox', 'People'])
    } finally {
      await ctx.close()
    }
  })

  it('§2c · a partner user is drawn no People, and the role line says partner user (RP-06)', async () => {
    const { ctx, page } = await pageFor(HANDLES.ben, 1440)
    try {
      await open(page, '/')
      /* G4158 — the role line is the PRINCIPAL read's (G4045), and `open()`
         waits only for the nav to settle. Until the principal answers, the line
         is the derived fallback `partner user` — so under two concurrent gates
         this read the fallback and reddened (`'partner user'` ≠
         `'Partner user'`). `[data-whoami]` is drawn only once the principal
         has answered; wait for it, as §6 below already does (G4106 closed
         the same race there and not here). */
      await page.waitForFunction(() => document.querySelector('[data-partner-chrome] [data-whoami]') !== null, undefined, {
        timeout: 15_000,
      })
      const r = await page.evaluate<{ people: number; role: string }>(() => ({
        people: Array.from(document.querySelectorAll('[data-partner-chrome] a')).filter((a) => a.textContent === 'People').length,
        role: document.querySelector('[data-role-line]')?.textContent ?? '',
      }))
      assert.equal(r.people, 0)
      /* G4045 (the owner's, 4 Oct 2026 — "Serve role labels"): the line is the
         role Ben LIVE-holds AS STORED (`partner_role.label`), served by
         `getSessionPrincipal`. It read the derived word 'partner user' until
         then; the derived word is now only the fallback for a session that
         holds no live role. */
      assert.equal(r.role, 'Partner user')
    } finally {
      await ctx.close()
    }
  })

  it('§3 · the skip link is the first focusable element and lands on the work; the page has its heading (RP-05)', async () => {
    const { ctx, page } = await pageFor(HANDLES.ana, 1440)
    try {
      await open(page, '/')
      const h1 = await page.evaluate<string>(() => document.querySelector('h1')?.textContent ?? '')
      assert.equal(h1, 'Reconcile AI · partner portal')
      await page.keyboard.press('Tab')
      const first = await page.evaluate<{ cls: string; href: string }>(() => ({
        cls: (document.activeElement as HTMLElement).className,
        href: (document.activeElement as HTMLAnchorElement).getAttribute('href') ?? '',
      }))
      assert.deepEqual(first, { cls: 'skip', href: '#work' })
      const target = await page.evaluate<boolean>(() => document.getElementById('work') !== null)
      assert.ok(target, 'the skip link names an element that does not exist')
    } finally {
      await ctx.close()
    }
  })

  it('§4 · a deal is registered with its currency, SGD by default and shown (RP-08a, G3561)', async () => {
    const { ctx, page } = await pageFor(HANDLES.ana, 1440)
    try {
      await open(page, '/')
      await page.click('[data-register-open]')
      /* NP-04 (G3706): the currency is the label's own editable middle word,
         so the label READS with the field's value in place of the field. */
      const label = await page.evaluate<string>(() => {
        const el = document.querySelector('[data-value-label]')
        if (el === null) return ''
        return [...el.childNodes].map((n) => (n instanceof HTMLInputElement ? n.value : n.textContent ?? '')).join('')
      })
      assert.equal(label.replace(/\s+/g, ' ').trim(), 'Deal value, SGD a year')
      /* NP-04 — stated ONCE: no second, separate Currency field. */
      const currencyFields = await page.evaluate<number>(() => document.querySelectorAll('[data-register-form] input[name="currency"]').length)
      assert.equal(currencyFields, 1)
      const outside = await page.evaluate<number>(() =>
        document.querySelectorAll('[data-register-form] input[name="currency"]:not([data-value-label] input)').length)
      assert.equal(outside, 0, 'the currency is a second field beside the label that already states it')
      await page.fill('[data-register-form] input[name="company"]', 'Layout Prospect')
      await page.fill('[data-register-form] input[name="annualValue"]', '180,000.50')
      await page.fill('[data-register-form] input[name="expectedClose"]', '30 Nov 2026')
      await page.click('[data-register-send]')
      await page.waitForFunction(() => document.querySelector('[data-result="ok"]') !== null, undefined, { timeout: 15_000 })
      /* NP-04 — the receipt echoes the amount and its currency. */
      const receipt = await page.evaluate<string>(() => document.querySelector('[data-result="ok"]')?.textContent ?? '')
      assert.match(receipt, /Layout Prospect, SGD 180,000\.50 a year\./, `the receipt does not echo the value: ${receipt}`)
      const mig = await migratorClient()
      try {
        const rows = (
          await mig.query(
            `SELECT annual_value, annual_value_minor::text AS minor, annual_value_currency AS currency,
                    annual_value_exponent AS exponent
               FROM tenant.deal_registration WHERE company = 'Layout Prospect'`,
          )
        ).rows
        assert.deepEqual(rows, [{ annual_value: null, minor: '18000050', currency: 'SGD', exponent: 2 }])
      } finally {
        await mig.end()
      }
    } finally {
      await ctx.close()
    }
  })
  /* ═══ ROUND TWO — docs/build/ui-audit/reaudit-partner-staff-apex.md ═══════
     G3701–G3713, 4 Oct 2026. WITNESSED RED against the build of `origin/main`
     (c8fed3c2) through `PARTNER_LAYOUT_DIST`: §4–§9 each failed at their first
     failing assertion, quoted where it was captured. */

  it('§5 · NP-01 — an asked-for sandbox reads as requested after a reload, and offers no second ask', async () => {
    const { ctx, page } = await pageFor(HANDLES.carl, 1440)
    try {
      await open(page, '/partner/sandbox')
      await page.click('[data-sandbox-ask]')
      await page.waitForFunction(() => document.querySelector('[data-sandbox="requested"]') !== null, undefined, { timeout: 15_000 })
      await open(page, '/partner/sandbox')
      const r = await page.evaluate<{ state: string | null; ask: number; text: string }>(() => ({
        state: document.querySelector('[data-partner-pane="sandbox"]')?.getAttribute('data-sandbox') ?? null,
        ask: document.querySelectorAll('[data-sandbox-ask]').length,
        text: (document.querySelector('[data-sandbox-requested]')?.textContent ?? '').replace(/\s+/g, ' '),
      }))
      /* Captured red: the wait for `data-sandbox="requested"` timed out. */
      assert.equal(r.state, 'requested', 'a reload forgot the request')
      assert.equal(r.ask, 0, '"Ask for one" is offered again, whose only answer is the 409')
      assert.match(r.text, /^Requested on \d{2} [A-Z][a-z]{2} \d{4}\. A person at 1CloudHub provisions it/)
    } finally {
      await ctx.close()
    }
  })

  it('§6 · NP-02 / RP-07 — a failed roster read guesses no role (the principal names it, G4045), and a failed claims read says its figures were not read', async () => {
    const { ctx, page } = await pageFor(HANDLES.ana, 1440)
    try {
      await page.route('**/v1/partner/people', (r) => r.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"code":"upstream_unavailable"}' }))
      await page.route('**/v1/partner/registrations**', (r) => r.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"code":"upstream_unavailable"}' }))
      await page.goto(`http://${PARTNERS_HOST}/`, { waitUntil: 'load' })
      await page.waitForFunction(() => document.querySelector('[data-partner-chrome] nav[data-settling]') === null &&
        document.querySelector('[data-refused="503"]') !== null &&
        /* G4045 — wait for the PRINCIPAL too, or the line below races it. */
        document.querySelector('[data-partner-chrome] [data-whoami]') !== null, undefined, { timeout: 15_000 })
      const r = await page.evaluate<{ role: string; status: string; unread: number; busy: number }>(() => ({
        role: document.querySelector('[data-role-line]')?.textContent ?? '',
        status: document.querySelector('[data-status-who]')?.textContent ?? '',
        unread: document.querySelectorAll('.figs [data-unread]').length,
        busy: document.querySelectorAll('.figs [aria-busy="true"]').length,
      }))
      /* Captured red: "partner user" — an administrator relabelled. */
      /* ⚠️ CORRECTED RATHER THAN DELETED — G4045. This asserted `'partner'`: a
         failed roster read must not GUESS a role from the roster. It still
         must not, and it does not — the role now comes from the PRINCIPAL,
         which the failed read cannot touch, so Ana is named by her stored
         role label and the roster-derived word is not drawn at all. */
      assert.equal(r.role, 'Partner administrator', `the served role was not drawn: ${r.role}`)
      assert.doesNotMatch(r.status, /partner user|partner administrator|Partner user/)
      /* RP-07 — not separately witnessed; the re-audit found all three "reading" for ever. */
      assert.equal(r.unread, 3, 'the figures do not say they were not read')
      assert.equal(r.busy, 0, 'a figure still says it is reading after its read failed')
    } finally {
      await ctx.close()
    }
  })

  it('§7 · NP-03 — a value the codec refuses says why, beside the field', async () => {
    const { ctx, page } = await pageFor(HANDLES.ana, 1440)
    try {
      await open(page, '/')
      await page.click('[data-register-open]')
      await page.fill('[data-register-form] input[name="annualValue"]', '-5')
      const neg = await page.evaluate<{ invalid: string | null; note: string }>(() => ({
        invalid: document.querySelector('[data-register-form] input[name="annualValue"]')?.getAttribute('aria-invalid') ?? null,
        note: document.querySelector('[data-value-note]')?.textContent ?? '',
      }))
      /* Captured red: the note regex met an empty string. */
      assert.equal(neg.invalid, 'true')
      assert.match(neg.note, /A positive amount in SGD/)
      await page.fill('[data-register-form] input[name="annualValue"]', '1000')
      await page.fill('[data-register-form] input[name="currency"]', 'ZZ')
      const cur = await page.evaluate<{ invalid: string | null; note: string }>(() => ({
        invalid: document.querySelector('[data-register-form] input[name="currency"]')?.getAttribute('aria-invalid') ?? null,
        note: document.querySelector('[data-value-note]')?.textContent ?? '',
      }))
      assert.equal(cur.invalid, 'true')
      assert.match(cur.note, /three letters/)
    } finally {
      await ctx.close()
    }
  })

  it('§8 · NP-05 — the skip link lands on the pane heading, which has a box to ring', async () => {
    const { ctx, page } = await pageFor(HANDLES.ana, 1440)
    try {
      await open(page, '/')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      const r = await page.evaluate<{ id: string; h: number; text: string }>(() => {
        const a = document.activeElement as HTMLElement
        return { id: a.id, h: a.getBoundingClientRect().height, text: a.textContent ?? '' }
      })
      /* Captured red: "the skip target has no height". */
      assert.equal(r.id, 'work')
      assert.ok(r.h > 0, 'the skip target has no height')
      assert.match(r.text, /Registered deals/)
    } finally {
      await ctx.close()
    }
  })

  it('§9 · NX-01 — at 1440 the frame wraps the chrome, and a click in the work does not focus main', async () => {
    const { ctx, page } = await pageFor(HANDLES.ana, 1440)
    try {
      await open(page, '/')
      const after = await page.evaluate<string>(() => getComputedStyle(document.querySelector('.app') as HTMLElement, '::after').boxShadow)
      assert.match(after, /inset/, `no frame above the chrome: ${after}`)
      const p = await page.evaluate<{ x: number; y: number }>(() => {
        const b = (document.querySelector('.sheet-note p') as HTMLElement).getBoundingClientRect()
        return { x: b.left + 4, y: b.top + 4 }
      })
      await page.mouse.click(p.x, p.y)
      const id = await page.evaluate<string>(() => document.activeElement?.id ?? '')
      /* The re-audit measured `activeElement === main#route-root` after a click;
         this section's captured red was its first assertion: "no frame above the chrome: none". */
      assert.notEqual(id, 'route-root', 'a click in the work focused main')
    } finally {
      await ctx.close()
    }
  })

  /* U-27 / G4181–G4186 — THE NARROW STATUS ROW ON THE PARTNER PORTAL. Captured
     red on origin/main @ b2563cab, before `StatusGrammar.tsx`: 
       "the three-slot status bar is drawn inline at 390 on [data-partner-portal] — the pack draws one tappable row"
       "the three-slot status bar is drawn inline at 330 on [data-partner-portal] — the pack draws one tappable row" */
  for (const width of [390, 330] as const) {
    it(`§10 · ${String(width)}: the status bar is ONE tappable row showing provenance, and it opens the grammar as a sheet (U-27, G4181)`, async () => {
      const { ctx, page } = await pageFor(HANDLES.ana, width, 844)
      try {
        await open(page, '/')
        await assertNarrowStatusRow(page, '[data-partner-portal]', ['entity', 'plane', 'who'], /Provenance · control plane/)
      } finally {
        await ctx.close()
      }
    })
  }

  it('§11 · 1440: the portal keeps its status bar inline and draws no tappable row (U-27, G4181)', async () => {
    const { ctx, page } = await pageFor(HANDLES.ana, 1440)
    try {
      await open(page, '/')
      await assertWideStatusBar(page, '[data-partner-portal]')
    } finally {
      await ctx.close()
    }
  })
})

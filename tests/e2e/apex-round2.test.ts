/**
 * THE APEX SITE'S STEP CHANGES, IN A REAL BROWSER — NA-01, NA-03, NA-04,
 * NA-05 and NA-06 from `docs/build/ui-audit/reaudit-partner-staff-apex.md`.
 * G3714–G3719, 4 Oct 2026.
 *
 * Served by `tests/e2e/apex-origin.ts` from `frontend/site/dist`, which the
 * gate builds in the stage before `npm test` (`APEX_ROUND2_DIST` points it at
 * another build, which is how the red was taken). The two requests the pages
 * make — `POST /demo/intake` and `POST /session/realm` — are answered by the
 * browser's own route table, so no plane and no database is needed: what is
 * judged here is where focus, scroll and words land, not what the intake does.
 *
 * ⚠️ WITNESSED RED against the build of `origin/main` (c8fed3c2), through
 * `APEX_ROUND2_DIST`: all seven sections failed, each at its FIRST assertion
 * (the message is quoted there). A later assertion in a section was not
 * separately witnessed and is not claimed to have been.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { browserRequiredUnderCi } from '../reachability.ts'
import { browserSkip, closeBrowser, REPO } from '../design/render.ts'
import { startApex, type Apex } from './apex-origin.ts'

const DIST = process.env['APEX_ROUND2_DIST'] ?? join(REPO, 'frontend', 'site', 'dist')

const browserWhy = await browserSkip()
browserRequiredUnderCi('the apex round-two suite', browserWhy)
after(async () => {
  await closeBrowser()
})

interface Route {
  fulfill(o: { status: number; contentType?: string; body?: string }): Promise<void>
}
interface Page {
  goto(url: string, o?: unknown): Promise<unknown>
  click(selector: string, o?: { force?: boolean }): Promise<void>
  fill(selector: string, value: string): Promise<void>
  keyboard: { press(key: string): Promise<void> }
  waitForFunction(fn: unknown, arg?: unknown, o?: unknown): Promise<unknown>
  evaluate<T>(fn: unknown, arg?: unknown): Promise<T>
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>
}
interface Ctx {
  newPage(): Promise<Page>
  close(): Promise<void>
}
interface Br {
  newContext(o?: unknown): Promise<Ctx>
  close(): Promise<void>
}

let apex: Apex | null = null
let br: Br | null = null

async function pageAt(width: number): Promise<{ ctx: Ctx; page: Page }> {
  if (br === null) throw new Error('no browser')
  const ctx = await br.newContext({ viewport: { width, height: 844 } })
  return { ctx, page: await ctx.newPage() }
}

/** The active element, as something an assertion can read. */
const ACTIVE = (): { tag: string; text: string; top: number } => {
  const a = document.activeElement as HTMLElement
  return { tag: a.tagName, text: (a.textContent ?? '').trim(), top: a.getBoundingClientRect().top }
}

async function stepTwo(page: Page): Promise<void> {
  await page.goto(`${apex?.origin ?? ''}/demo/`, { waitUntil: 'load' })
  await page.click('.headstart button')
  await page.click('[data-demo-continue]')
  await page.waitForFunction(() => document.querySelector('[data-demo-state="two"]') !== null, undefined, { timeout: 15_000 })
}

describe('the apex site, step by step', { skip: browserWhy }, () => {
  before(async () => {
    assert.ok(existsSync(join(DIST, 'demo', 'index.html')), `no built apex site at ${DIST} — the gate builds it before npm test`)
    /* No plane: both requests the pages make are answered by the browser's route table. */
    apex = await startApex(DIST, 'http://127.0.0.1:9', '127.0.0.1:9')
    const pw = (await import('playwright')) as unknown as { chromium: { launch(): Promise<Br> } }
    br = await pw.chromium.launch()
  })
  after(async () => {
    await br?.close()
    await apex?.close()
  })

  for (const width of [1440, 390] as const) {
    it(`§1 · ${String(width)}: Continue moves focus to step two's heading, in view under the header (NA-01)`, async () => {
      const { ctx, page } = await pageAt(width)
      try {
        await stepTwo(page)
        const a = await page.evaluate<{ tag: string; text: string; top: number }>(ACTIVE)
        /* Captured red, both widths: "focus is on BODY after Continue". */
        assert.equal(a.tag, 'H2', `focus is on ${a.tag} after Continue`)
        assert.equal(a.text, 'Who you are.')
        assert.ok(a.top >= 0 && a.top < 844, `step two's heading is out of view at top ${String(a.top)}`)
      } finally {
        await ctx.close()
      }
    })
  }

  it('§2 · Send with nothing filled marks the three fields and names them (NA-03)', async () => {
    const { ctx, page } = await pageAt(1440)
    try {
      await stepTwo(page)
      await page.fill('input[name="email"]', 'not-an-email')
      /* `force`: Send is `aria-disabled`, which Playwright refuses to press — a person can. */
      await page.click('[data-demo-send]', { force: true })
      const r = await page.evaluate<{ invalid: string[]; note: string }>(() => ({
        invalid: [...document.querySelectorAll('form input[aria-invalid="true"]')].map((i) => i.getAttribute('name') ?? ''),
        note: document.querySelector('form [role="alert"]')?.textContent ?? '',
      }))
      /* Captured red: the deep-equal failed — no field was marked. */
      assert.deepEqual(r.invalid, ['name', 'email', 'company'])
      assert.match(r.note, /Still needed: your name, a work email that is an address, a company\./)
    } finally {
      await ctx.close()
    }
  })

  it('§3 · a refused send moves focus to its heading and prints no raw status in the sentence (NA-01, NA-06)', async () => {
    const { ctx, page } = await pageAt(1440)
    try {
      await page.route('**/demo/intake', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: '{}' }))
      await stepTwo(page)
      await page.fill('input[name="name"]', 'Illustrative Person')
      await page.fill('input[name="email"]', 'person@illustrative.example')
      await page.fill('input[name="company"]', 'Illustrative Company')
      await page.click('[data-demo-send]')
      await page.waitForFunction(() => document.querySelector('[data-demo-state="not_delivered"]') !== null, undefined, { timeout: 15_000 })
      const a = await page.evaluate<{ tag: string; text: string; top: number }>(ACTIVE)
      assert.equal(a.tag, 'H2', `focus is on ${a.tag} after a refused send`)
      const r = await page.evaluate<{ alert: string; quote: string }>(() => ({
        alert: document.querySelector('[data-demo-state] [role="alert"]')?.textContent ?? '',
        quote: document.querySelector('[data-demo-quote]')?.textContent ?? '',
      }))
      /* The pre-repair sentence read "The request was answered 502, not with the
         intake's acceptance." (the re-audit's NA-06); this section's captured red
         was its first assertion: "focus is on BODY after a refused send". */
      assert.doesNotMatch(r.alert, /\b502\b/, `a raw HTTP status in the prospect's sentence: ${r.alert}`)
      assert.match(r.alert, /Our intake did not accept it\. Nothing was received/)
      assert.match(r.quote, /quote 502/)
    } finally {
      await ctx.close()
    }
  })

  it('§4 · the skip link is the first Tab stop on /demo/ (NA-05)', async () => {
    const { ctx, page } = await pageAt(1440)
    try {
      await page.goto(`${apex?.origin ?? ''}/demo/`, { waitUntil: 'load' })
      await page.keyboard.press('Tab')
      const first = await page.evaluate<string>(() => (document.activeElement as HTMLElement).className)
      /* Captured red: a strict-equal failure — the first stop was not the skip link. */
      assert.equal(first, 'skip')
    } finally {
      await ctx.close()
    }
  })

  for (const width of [1440, 390] as const) {
    it(`§5 · ${String(width)}: the lookup's routed state takes focus, and the sign-in name field is wide enough to read (NA-01, NA-04)`, async () => {
      const { ctx, page } = await pageAt(width)
      try {
        await page.route('**/session/realm', (r) =>
          r.fulfill({ status: 200, contentType: 'application/json', body: '{"connectionId":"idc_illustrative"}' }))
        await page.goto(`${apex?.origin ?? ''}/lookup/`, { waitUntil: 'load' })
        await page.fill('input[name="email"]', 'person@illustrative.example')
        await page.click('[data-lookup-find]')
        await page.waitForFunction(() => document.querySelector('[data-lookup-state="routed"]') !== null, undefined, { timeout: 15_000 })
        const a = await page.evaluate<{ tag: string; text: string; top: number }>(ACTIVE)
        /* Captured red, both widths: "focus is on BODY after the lookup answered". */
        assert.equal(a.tag, 'H1', `focus is on ${a.tag} after the lookup answered`)
        const w = await page.evaluate<number>(() => (document.querySelector('input[name="signInName"]') as HTMLElement).getBoundingClientRect().width)
        /* The re-audit measured 108px at 390 (NA-04). */
        assert.ok(w >= 200, `the sign-in name field is ${String(w)}px wide`)
        const sw = await page.evaluate<number>(() => document.documentElement.scrollWidth)
        assert.equal(sw, width)
      } finally {
        await ctx.close()
      }
    })
  }
})

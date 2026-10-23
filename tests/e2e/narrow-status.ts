/**
 * THE NARROW STATUS ROW, MEASURED ONE WAY ON EVERY SURFACE — G4181–G4186,
 * 4 Oct 2026 (U-27).
 *
 * G4071 gave the tenant Close surface the pack's *"one tappable row that opens
 * the full grammar as a sheet"* and witnessed it at `parked-pile.test.ts` §8.
 * The staff console and the partner portal drew their own `.statusbar` and it
 * wrapped. Now all three render `StatusGrammar.tsx`, so the assertion is ONE
 * function too, called from each surface's own suite — a second copy of the
 * measurement would be the same §5.3 the component exists to refuse.
 *
 * ⚠️ NOT A `*.test.ts`: it is imported, never run on its own.
 */
import assert from 'node:assert/strict'

export interface StatusPage {
  click(selector: string): Promise<void>
  waitForSelector(selector: string, o?: unknown): Promise<unknown>
  waitForFunction(fn: unknown, arg?: unknown, o?: unknown): Promise<unknown>
  evaluate<T>(fn: unknown, arg?: unknown): Promise<T>
}

/**
 * Below 720: no three-slot bar is drawn, exactly one tappable row is, it says
 * Provenance, it fits the viewport and the target floor, the page does not
 * scroll sideways, and the row opens a full-width sheet carrying `slots` in
 * order. Escape closes it.
 */
export async function assertNarrowStatusRow(page: StatusPage, scope: string, slots: readonly string[], rowText: RegExp): Promise<void> {
  const before = await page.evaluate<{ bars: number; rows: number; text: string; right: number; height: number; iw: number; sw: number }>((s: string) => {
    const shown = (e: Element): boolean => (e as HTMLElement).offsetParent !== null && getComputedStyle(e).display !== 'none'
    const bars = [...document.querySelectorAll(`${s} .statusbar`)].filter(shown)
    const rows = [...document.querySelectorAll(`${s} button.statusrow`)].filter(shown)
    const r = rows[0]?.getBoundingClientRect()
    return {
      bars: bars.length,
      rows: rows.length,
      text: rows[0]?.textContent ?? '',
      right: r?.right ?? Infinity,
      height: r?.height ?? 0,
      iw: window.innerWidth,
      sw: document.documentElement.scrollWidth,
    }
  }, scope)
  assert.equal(before.bars, 0, `the three-slot status bar is drawn inline at ${String(before.iw)} on ${scope} — the pack draws one tappable row`)
  assert.equal(before.rows, 1, `no single tappable status row at ${String(before.iw)} on ${scope}`)
  assert.match(before.text, rowText)
  assert.ok(before.right <= before.iw + 0.5, `the status row ends at x ${String(before.right)}, past the ${String(before.iw)} viewport`)
  assert.ok(before.height >= 24, `the status row is ${String(before.height)}px tall — under the 24px target floor`)
  assert.equal(before.sw, before.iw, `${scope} scrolls sideways at ${String(before.iw)}: scrollWidth ${String(before.sw)}`)

  await page.click(`${scope} button.statusrow`)
  await page.waitForSelector('[role="dialog"]:has([data-status-sheet])')
  /* The drawer enters on `--enter-drawer`; measure it where it lands. */
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const sheet = await page.evaluate<{ left: number; right: number; iw: number; slots: string[] }>(() => {
    const d = document.querySelector('[role="dialog"]:has([data-status-sheet])') as HTMLElement
    const b = d.getBoundingClientRect()
    return {
      left: b.left,
      right: b.right,
      iw: window.innerWidth,
      slots: [...d.querySelectorAll('[data-status-slot]')].map((e) => e.getAttribute('data-status-slot') ?? ''),
    }
  })
  assert.deepEqual(sheet.slots, [...slots], `the ${scope} sheet does not carry the whole grammar in the bar's order`)
  assert.ok(sheet.left <= 0.5 && sheet.right >= sheet.iw - 0.5, `the sheet is not full width: ${String(sheet.left)}–${String(sheet.right)}`)
  await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  await page.waitForFunction(() => document.querySelector('[role="dialog"]:has([data-status-sheet])') === null)
}

/** At 720 and up: the bar is drawn and the row is not. */
export async function assertWideStatusBar(page: StatusPage, scope: string): Promise<void> {
  const seen = await page.evaluate<{ bars: number; rows: number }>((s: string) => ({
    bars: [...document.querySelectorAll(`${s} .statusbar`)].filter((b) => getComputedStyle(b).display !== 'none').length,
    rows: [...document.querySelectorAll(`${s} button.statusrow`)].filter((b) => getComputedStyle(b).display !== 'none').length,
  }), scope)
  assert.equal(seen.bars, 1, `${scope} draws no status bar at the wide tier`)
  assert.equal(seen.rows, 0, `${scope} draws the narrow status row at the wide tier`)
}

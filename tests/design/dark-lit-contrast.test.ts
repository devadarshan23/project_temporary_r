/**
 * THE DARK GLOW IS DIMMED — G3661, applying THE OWNER'S RULING of 3 Oct 2026:
 * *"Dim the dark glow."* (completion-plan W6 U-3; the finding is G3480's.)
 *
 * G3480 measured and reported, without fixing, that in the dark theme the
 * luminous touch's own hot spot (`--lit-hot` at its `18% 0%` source) brought
 * `--muted` to 2.70:1 — sweep or no sweep. The ruling is that the LIGHT dims,
 * so that muted text holds ≥4.5:1 EVERYWHERE on a lit cell, the sweep's band
 * included, and on hover.
 *
 * 🛑 THE CLAIM IS ABOUT A PIXEL, SO THIS READS PIXELS. A computed style says
 * which gradient applies; it does not say what colour the browser paints. Each
 * case renders the kernel's own `.lit.lit--running` in a real Chromium under
 * `[data-theme="dark"]`, pauses the sweep at every instant of its pass, takes a
 * screenshot, and computes WCAG contrast between the kernel's dark `--muted`
 * (and `--ink`) and every sampled point — the top row included, where the light's
 * source sits. The minimum is the claim. The cell's 1px `--lit-edge` hairline is
 * trimmed (2px), because no text is ever set on a border.
 *
 * WITNESSED RED against `origin/main` (a039fb76) before the tokens moved:
 * the hot-spot minimum read in the browser is quoted in `docs/HANDOFF.md` G3661.
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'

import { browserSkip, closeBrowser, kernel, samplePaint, type Rgb } from './render.ts'
import { browserRequiredUnderCi } from '../reachability.ts'

const skip = await browserSkip()
browserRequiredUnderCi('the dark lit-cell contrast assertions', skip)
after(async () => { await closeBrowser() })

const lin = (c: number): number => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const lum = ([r, g, b]: Rgb): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a: Rgb, b: Rgb): number => {
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

async function darkHex(name: string): Promise<Rgb> {
  const k = (await kernel()).replace(/\/\*[\s\S]*?\*\//g, '')
  const dark = k.slice(k.indexOf('[data-theme="dark"]{'))
  const block = dark.slice(0, dark.indexOf('}'))
  const m = new RegExp(`${name}:#([0-9a-f]{6})`).exec(block)
  assert.ok(m?.[1] !== undefined, `${name} is not a hex in the dark block`)
  const h = m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** The sweep's pass is the first 12% of a 17s cycle (`@keyframes sweep`). */
const PASS = Array.from({ length: 31 }, (_, i) => Math.round((i * 17000 * 0.12) / 30))

const CELL = '<div data-theme="dark" style="padding:24px;background:var(--paper)">' +
  '<div id="cell" class="lit lit--running" style="width:240px;height:64px"></div></div>'

async function worst(hover: boolean): Promise<{ muted: number; ink: number; lit: boolean; swept: boolean }> {
  const css = await kernel()
  const px = await samplePaint(css, CELL, { selector: '#cell', cols: 24, rows: 7, hover, times: PASS, inset: 2 })
  const muted = await darkHex('--muted')
  const ink = await darkHex('--ink')
  const paper = await darkHex('--paper')
  const per = 24 * 7
  /* Anti-vacuity: the light painted (some pixel is not paper), and the sweep
     moved (the frames are not all identical). Without both, a minimum over
     these samples is a statement about an unlit box. */
  const lit = px.some((p) => Math.abs(p[0] - paper[0]) + Math.abs(p[1] - paper[1]) + Math.abs(p[2] - paper[2]) > 12)
  const frames = Array.from({ length: PASS.length }, (_, f) => JSON.stringify(px.slice(f * per, (f + 1) * per)))
  const swept = new Set(frames).size > 1
  return {
    muted: Math.min(...px.map((p) => ratio(muted, p))),
    ink: Math.min(...px.map((p) => ratio(ink, p))),
    lit,
    swept,
  }
}

describe('G3661 · dark theme: muted text holds ≥4.5:1 everywhere on a lit cell, sweep included', { skip }, () => {
  it('at rest, through the whole sweep', async () => {
    const w = await worst(false)
    assert.ok(w.lit, 'the light did not paint — the minimum would be about an unlit box')
    assert.ok(w.swept, 'the sweep did not move across the sampled frames — the pass was not witnessed')
    assert.ok(w.muted >= 4.5, `dark --muted on the lit cell falls to ${w.muted.toFixed(2)}:1 (the owner ruled ≥4.5)`)
    assert.ok(w.ink >= 4.5, `dark --ink on the lit cell falls to ${w.ink.toFixed(2)}:1`)
  })

  it('on hover, through the whole sweep', async () => {
    const w = await worst(true)
    assert.ok(w.lit, 'the hovered light did not paint')
    assert.ok(w.muted >= 4.5, `dark --muted on the HOVERED lit cell falls to ${w.muted.toFixed(2)}:1`)
    assert.ok(w.ink >= 4.5, `dark --ink on the hovered lit cell falls to ${w.ink.toFixed(2)}:1`)
  })
})

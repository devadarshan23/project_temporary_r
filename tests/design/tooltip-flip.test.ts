/**
 * `tooltipFlip()` — THE OPEN HALF OF G4091, DRIVEN IN NODE. 4 Oct 2026.
 *
 * The owner's ruling on G4077: *"Flip-on-open + 1px closed box."* The closed
 * half is CSS (`overlays.css`, `.tip:not([data-on])`) and is witnessed in a
 * browser at `tests/e2e/parked-pile.test.ts` §10; the open half is this pure
 * function, which `Tooltip.tsx` calls on open with the panel measured where its
 * CSS anchored it. It needs no browser, so every arm is enumerated here rather
 * than sampled by the one fixture the e2e suite happens to lay out.
 *
 * §1 a panel inside the viewport is not flipped (`null`), whichever side
 *    `close.css` anchored it to;
 * §2 a panel crossing the RIGHT edge anchors to the trigger's right (`end`);
 * §3 a panel crossing the LEFT edge anchors to the trigger's left (`start`);
 * §4 when neither anchor fits, the one that overflows LESS wins — a tooltip
 *    nobody can open is G189 failing the other way;
 * §5 the e2e fixture's own geometry (330px, the panel at x 240–336) flips.
 * §7 U-25 (G4187): when NEITHER anchor fits, `tooltipShift()` places the panel
 *    inside the viewport with its inset kept, and answers `null` whenever
 *    either anchor fits — so §1–§5's cases are untouched;
 * §8 U-25 (G4188): `tooltipFlipVertical()` opens a panel upward at the
 *    viewport's foot, downward at its top, and leaves a fitting one alone.
 *
 * ⚠️ AND `tooltip.ts` STILL IMPORTS NOTHING — §6 reads its source, because
 * `tests/design/overlays.test.ts` leans on that property to drive the reducer.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { tooltipFlip, tooltipFlipVertical, tooltipShift } from '../../frontend/src/overlays/tooltip.ts'

const W = 390

describe('tooltipFlip — G4091, flip on open', () => {
  it('§1 · a panel inside the viewport is not flipped, at either anchor', () => {
    assert.equal(tooltipFlip({ panelLeft: 16, panelRight: 113, triggerLeft: 16, triggerRight: 90, viewport: W }), null)
    assert.equal(tooltipFlip({ panelLeft: 280, panelRight: 377, triggerLeft: 300, triggerRight: 377, viewport: W }), null)
    assert.equal(tooltipFlip({ panelLeft: 0, panelRight: W, triggerLeft: 0, triggerRight: 40, viewport: W }), null,
      'touching an edge is not crossing it')
  })

  it('§2 · a panel crossing the right edge anchors to the trigger\'s right', () => {
    /* G4077's own measurement: a "Coming soon" panel at x 306–403 at 390. */
    assert.equal(tooltipFlip({ panelLeft: 306, panelRight: 403, triggerLeft: 306, triggerRight: 380, viewport: W }), 'end')
  })

  it('§3 · a panel crossing the left edge anchors to the trigger\'s left', () => {
    /* `close.css` anchored a right-edge control's panel `right: 0`, and the
       control sits near the LEFT edge at this width. */
    assert.equal(tooltipFlip({ panelLeft: -40, panelRight: 60, triggerLeft: 10, triggerRight: 60, viewport: W }), 'start')
  })

  it('§4 · when neither anchor fits, the smaller overflow wins', () => {
    /* A 300px panel on a 40px trigger in the middle of a 320 viewport. */
    const g = { panelLeft: 200, panelRight: 500, triggerLeft: 200, triggerRight: 240, viewport: 320 }
    /* start overflows 180, end overflows 60. */
    assert.equal(tooltipFlip(g), 'end')
    const h = { panelLeft: -250, panelRight: 50, triggerLeft: 10, triggerRight: 50, viewport: 320 }
    /* start overflows 0 (10+300=310 ≤ 320) → start. */
    assert.equal(tooltipFlip(h), 'start')
  })

  it('§5 · the e2e fixture\'s red geometry flips inward and then fits', () => {
    /* Captured red, tests/e2e/parked-pile.test.ts §10b at 330 before G4091:
       "an OPEN tooltip ("Coming soon") sits at x 240–336 in a 330 viewport".
       The panel is 96px; anchored to a trigger ending at 330 it spans 234–330. */
    const flip = tooltipFlip({ panelLeft: 240, panelRight: 336, triggerLeft: 240, triggerRight: 330, viewport: 330 })
    assert.equal(flip, 'end')
  })

  it('§6 · tooltip.ts still imports nothing — the reducer and the flip stay drivable in node', () => {
    const src = readFileSync(join(import.meta.dirname, '../../frontend/src/overlays/tooltip.ts'), 'utf8')
    assert.equal(/^\s*import\s/m.test(src), false, 'tooltip.ts gained an import — it must stay DOM- and React-free')
  })
})

describe('tooltipShift — U-25 (G4187), when neither anchor fits', () => {
  it('§7a · a 255px panel on a mid-row trigger at 260 is shifted inside, inset kept', () => {
    /* Captured red, tests/e2e/parked-pile.test.ts §10c before U-25:
       "an OPEN tooltip (…) sits at x 16–271 in a 260 viewport". */
    const g = { panelLeft: 120, panelRight: 375, triggerLeft: 120, triggerRight: 160, viewport: 260 }
    assert.equal(tooltipFlip(g) !== null, true, 'the flip still answers, and its answer overflows')
    const shift = tooltipShift(g, 12)
    assert.notEqual(shift, null)
    const left = g.triggerLeft + (shift as number)
    assert.ok(left >= 0 && left + 255 <= 260, `shifted panel at ${String(left)}–${String(left + 255)}`)
  })

  it('§7b · the inset is kept when there is room for it, and shrinks when there is not', () => {
    const roomy = { panelLeft: 100, panelRight: 300, triggerLeft: 100, triggerRight: 120, viewport: 240 }
    /* 200px in 240: inset min(12, 20) = 12; the panel starts at max(100,12) clamped to 240−12−200 = 28. */
    assert.equal(tooltipShift(roomy, 12), 28 - 100)
    const tight = { panelLeft: 100, panelRight: 335, triggerLeft: 100, triggerRight: 120, viewport: 240 }
    /* 235px in 240: inset shrinks to 2.5. */
    assert.equal(tooltipShift(tight, 12), 2.5 - 100)
  })

  it('§7c · null whenever either anchor fits, or the panel already sits inside', () => {
    assert.equal(tooltipShift({ panelLeft: 306, panelRight: 403, triggerLeft: 306, triggerRight: 380, viewport: 390 }, 12), null,
      'the end anchor fits — tooltipFlip decides this one')
    assert.equal(tooltipShift({ panelLeft: -40, panelRight: 60, triggerLeft: 10, triggerRight: 60, viewport: 390 }, 12), null)
    assert.equal(tooltipShift({ panelLeft: 16, panelRight: 113, triggerLeft: 16, triggerRight: 90, viewport: 390 }, 12), null)
  })

  it('§7d · a panel wider than the viewport sits at its left edge rather than off it', () => {
    const shift = tooltipShift({ panelLeft: 50, panelRight: 350, triggerLeft: 50, triggerRight: 90, viewport: 280 }, 12)
    assert.equal(shift, -50)
  })
})

describe('tooltipFlipVertical — U-25 (G4188), up or down', () => {
  it('§8a · a panel below a trigger at the viewport foot opens above it', () => {
    /* Captured red, tests/e2e/parked-pile.test.ts §10d before U-25:
       "an OPEN tooltip ("Coming soon") sits at y 488–527 in a 480 viewport". */
    assert.equal(tooltipFlipVertical({ panelTop: 488, panelBottom: 527, triggerTop: 448, triggerBottom: 480, viewportHeight: 480 }), 'above')
  })

  it('§8b · a panel above a trigger at the viewport top opens below it', () => {
    assert.equal(tooltipFlipVertical({ panelTop: -30, panelBottom: 10, triggerTop: 18, triggerBottom: 50, viewportHeight: 480 }), 'below')
  })

  it('§8c · a panel that fits is left alone, whichever side it opens on', () => {
    assert.equal(tooltipFlipVertical({ panelTop: 58, panelBottom: 97, triggerTop: 18, triggerBottom: 50, viewportHeight: 480 }), null)
    assert.equal(tooltipFlipVertical({ panelTop: 380, panelBottom: 419, triggerTop: 427, triggerBottom: 459, viewportHeight: 480 }), null,
      'the status bar opens its panels upward already (close.css) and keeps that')
  })

  it('§8d · when neither side fits, the smaller overflow wins', () => {
    /* A 300px panel on a trigger mid-way down a 320 viewport. */
    assert.equal(tooltipFlipVertical({ panelTop: 208, panelBottom: 508, triggerTop: 160, triggerBottom: 200, viewportHeight: 320 }), 'above')
  })
})

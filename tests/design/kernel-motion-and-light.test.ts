/**
 * THE KERNEL'S MOTION AND LIGHT, REACHING THE BUILT PORTAL — G3394, G3396–G3399.
 * The red-team motion audit (`docs/build/ui-audit/red-motion-mark.md`) measured
 * the shipped portal running ZERO animations and found four defects under it;
 * each is witnessed here in a real browser:
 *
 *   RM-04 (G3399) — a `.lit` strip cell painted NO light: close.css's
 *     `.close .cell{background:none}` tied `.lit.lit` at (0,2,0) and won on
 *     order. Injected into the BUILT `shell.html`, the light must now paint, the
 *     current-cell underline must COMPOSE with the lit edge, and the sweep must
 *     be clipped.
 *   RM-10 (G3398) — the kernel's own reduced-motion rule for the mascot lost on
 *     specificity; a `data-energy` dot must compute `animation-name: none`
 *     under `reduce` (not merely `.001ms`).
 *   RM-08 / RM-09 (G3396 / G3397, THE OWNER'S) — `toast-in` and the overlay
 *     entrances live in the kernel, applied through `--enter-*` tokens the
 *     kernel's guard sets to `none`; the built toast and overlays run them.
 *   RM-05 (G3394) — the tooltip fade resolves to the kernel's 120ms, not 0s.
 *
 * WITNESSED RED against `origin/main` (549d3dd5): RM-04 read
 * `background-image: none`; RM-10 read `mascot-cascade` under `reduce`; the
 * `--enter-*` tokens did not exist and `.toast` computed `animation-name: none`;
 * the tooltip's `transition-duration` read `0s`.
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { browserSkip, closeBrowser, kernel, REPO, render, renderFile } from './render.ts'
import { browserRequiredUnderCi } from '../reachability.ts'

const skip = await browserSkip()

browserRequiredUnderCi('the kernel motion and light assertions', skip)

after(async () => { await closeBrowser() })

const SHELL = join(REPO, 'frontend', 'dist', 'shell.html')
const NOTHING = (): void => {}

const builtShell = (): string => {
  assert.ok(existsSync(SHELL), `${SHELL} is absent — npm run build:frontend runs before npm test`)
  return SHELL
}

describe('RM-04 · the luminous touch paints on a Close strip cell', { skip }, () => {
  it('a lit, running, current cell paints the light, keeps the lit edge AND the underline, and clips the sweep', async () => {
    const seen = await renderFile(builtShell(), () => {
      const cell = document.querySelector('.close .cell')
      if (cell === null) return
      cell.classList.add('lit', 'lit--running')
      cell.setAttribute('aria-current', 'true')
      cell.id = 'probe-cell'
    }, () => {
      const el = document.getElementById('probe-cell')
      if (el === null) return { missing: true as const }
      const cs = getComputedStyle(el)
      return {
        missing: false as const,
        image: cs.backgroundImage,
        shadow: cs.boxShadow,
        overflow: cs.overflow,
        sweep: getComputedStyle(el, '::after').animationName,
      }
    })
    if (seen.missing) assert.fail('the built shell.html carries no `.close .cell` to light — UNWITNESSED')
    assert.ok(seen.image.startsWith('radial-gradient'),
      `the light did not paint (background-image: ${seen.image}). close.css's button reset must not reach ` +
      'background-image — `.lit.lit` is (0,2,0) and `.close .cell` is (0,2,0) too, so a shorthand there wins on order.')
    const parts = seen.shadow.split(/,(?![^(]*\))/).map((s) => s.trim())
    assert.equal(parts.length, 2, `the current-cell underline REPLACED the lit edge instead of composing: ${seen.shadow}`)
    assert.equal(seen.overflow, 'hidden', 'the running sweep is not clipped to its cell')
    assert.equal(seen.sweep, 'sweep', 'the running cell does not run the kernel sweep')
  })

  it('control: an UNLIT cell still resets to a transparent button (no light leaks onto every cell)', async () => {
    const seen = await renderFile(builtShell(), NOTHING, () => {
      const el = document.querySelector('.close .cell:not(.lit):not([aria-current="true"])')
      return el === null ? null : { image: getComputedStyle(el).backgroundImage, color: getComputedStyle(el).backgroundColor }
    })
    assert.ok(seen !== null, 'no unlit, non-current cell to control against')
    assert.equal(seen.image, 'none')
    assert.equal(seen.color, 'rgba(0, 0, 0, 0)')
  })
})

describe('RM-10 · the mascot goes still under reduced motion — by name, not by speed', { skip }, () => {
  const MASCOT = '<span class="mascot" data-energy="working"><i class="d1">·</i><i class="d2">·</i><i class="d3">·</i></span>'
  const read = (): string[] => [...document.querySelectorAll('.mascot > i')].map((i) => getComputedStyle(i).animationName)

  it('under reduce every data-energy dot computes animation-name: none', async () => {
    const names = await render(await kernel(), MASCOT, read, 'reduce')
    assert.deepEqual(names, ['none', 'none', 'none'],
      'the kernel guard `.mascot > i{animation:none}` is (0,1,1) and loses to `.mascot[data-energy] > .d1` (0,3,0)')
  })

  it('control: without reduce the cascade runs', async () => {
    const names = await render(await kernel(), MASCOT, read)
    assert.deepEqual(names, ['mascot-cascade', 'mascot-cascade', 'mascot-cascade-mid'])
  })
})

describe('RM-08 / RM-09 · the entrances are the kernel\'s, guarded by token', { skip }, () => {
  const TOKENS = { '--enter-toast': 'toast-in', '--enter-scrim': 'fade-in', '--enter-drawer': 'drawer-in', '--enter-modal': 'modal-in' } as const
  const body = Object.keys(TOKENS).map((t) => `<div data-t="${t}" style="animation:var(${t})"></div>`).join('')
  const read = (): Record<string, string> => Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>('[data-t]')].map((d) => [d.dataset['t'] ?? '', getComputedStyle(d).animationName]))

  it('each --enter-* token applies its kernel keyframe', async () => {
    assert.deepEqual(await render(await kernel(), body, read), TOKENS)
  })

  it('under reduce each --enter-* token is none — one guard, keyed on the token', async () => {
    const seen = await render(await kernel(), body, read, 'reduce')
    for (const t of Object.keys(TOKENS)) assert.equal(seen[t], 'none', `${t} still animates under reduced motion`)
  })

  it('the BUILT toast and overlays run them; the BUILT tooltip fades on --t-fade (RM-05)', async () => {
    const seen = await renderFile(builtShell(), () => {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="toasts"><div class="toasts-slot"><div class="toast" id="pt">x</div></div></div>' +
        '<div class="ov-layer" data-overlay="modal"><div class="ov-scrim" id="ps"></div><div class="ov" id="pm">m</div></div>' +
        '<div class="ov-layer" data-overlay="drawer"><div class="ov" id="pd">d</div></div>' +
        '<span class="tipwrap"><span class="tip" id="ptip">t</span></span>')
    }, () => {
      const a = (id: string): string => { const e = document.getElementById(id); return e === null ? 'MISSING' : getComputedStyle(e).animationName }
      const tip = document.getElementById('ptip')
      return {
        toast: a('pt'), scrim: a('ps'), modal: a('pm'), drawer: a('pd'),
        /* ⚠️ THE OPACITY ENTRY, NOT THE WHOLE LIST — G4091. This read
           `transitionDuration` whole and required it to equal `0.12s`, which was
           exact while the tooltip transitioned one property. A CLOSED panel now
           also transitions its 1px box (0s, delayed by --t-fade, so the
           collapse waits for the fade), so the list is five entries long and
           the property RM-05 protects — the FADE is on the kernel's --t-fade —
           is the duration paired with `opacity`. Corrected rather than deleted:
           an undeclared var() would still resolve this entry to 0s. */
        tipDuration: tip === null ? 'MISSING' : ((): string => {
          const cs = getComputedStyle(tip)
          const props = cs.transitionProperty.split(',').map((s) => s.trim())
          const durs = cs.transitionDuration.split(',').map((s) => s.trim())
          const i = props.indexOf('opacity')
          return i < 0 ? 'NO OPACITY TRANSITION' : (durs[i] ?? durs[0] ?? 'MISSING')
        })(),
      }
    })
    assert.equal(seen.toast, 'toast-in', 'the toast still ships `animation: none`')
    assert.equal(seen.scrim, 'fade-in')
    assert.equal(seen.modal, 'modal-in')
    assert.equal(seen.drawer, 'drawer-in')
    assert.equal(seen.tipDuration, '0.12s', 'the tooltip fade is not the kernel\'s --t-fade (an undeclared var() resolves to 0s)')
  })
})

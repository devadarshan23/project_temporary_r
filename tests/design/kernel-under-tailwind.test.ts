/**
 * THE ENGINE, AND ITS NEGATIVE CONTROLS.
 *
 * Everything here renders the kernel THAT ALREADY EXISTS — docs/handoff-pack/tokens.css
 * — against REAL compiled Tailwind v4, in chromium, and reads computed style.
 * Nothing here needs the frontend root. **These assertions PASS at base**, and
 * they are the reason the red in frontend-bridge.test.ts is measurable rather
 * than merely absent: they establish that the harness renders, that the detectors
 * detect, and that the failure mode the bridge must avoid IS REAL.
 *
 * 🛑 THE FINDING THIS FILE EXISTS TO PIN — THE HATCH'S FOURTH FAILURE.
 *
 * `.nb` has failed three ways already, and CLAUDE.md's own account of the third
 * is the one that matters here: the hatch died to a `background:` SHORTHAND, and
 * the repair was to re-declare it on a DOUBLED CLASS, `.nb.nb`, scoring 0,2,0 so
 * that *"no single-class rule can reach it whatever the order."*
 *
 * THAT DEFENCE IS A SPECIFICITY DEFENCE, AND CASCADE LAYERS DO NOT CARE ABOUT
 * SPECIFICITY. Layer order is resolved BEFORE specificity is ever consulted. So
 * the moment the kernel is wrapped in a layer that Tailwind's `utilities` layer
 * sits above — which is the natural reading of *"tokens.css becomes a THEME
 * LAYER"* — a one-class utility of specificity 0,1,0 beats `.nb.nb` outright and
 * the hatch is gone again. MEASURED, not argued: `inBase` below loses it.
 *
 * The failure is SELECTIVE, which is how it stayed hidden the first three times.
 * `bg-white` writes background-COLOR and does not touch the hatch. `bg-none`,
 * `bg-linear-to-r` and an arbitrary `bg-[image:none]` write background-IMAGE and
 * erase it — silently, because `.nb::after` still says NOT BUILT. The panel goes
 * on LOOKING annotated with the treatment gone. That is the worst shape a defect
 * can take here and it is the acceptance criterion for the whole slice.
 */

import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'

import {
  browserSkip, closeBrowser, tailwind, kernel, compose, render,
  type Arrangement,
} from './render.ts'

import { browserRequiredUnderCi } from '../reachability.ts'

const skip = await browserSkip()

browserRequiredUnderCi('the kernel-under-Tailwind render assertions', skip)

/**
 * THE SURFACE. One fixture, carrying every primitive under test plus the four
 * background utilities and two deliberate INTRUDERS.
 *
 * The intruders are the negative controls for THE SIX INDICATORS: `#second-line`
 * is a Tailwind progress bar (a second LINE) and `#second-dot` is a `rounded-full`
 * unread marker (a second DOT). Both are the exact two things CLAUDE.md records
 * as *"built here once and both removed"*. They are present so the detectors can
 * be shown to CATCH them; the indicator tests below assert the counts WITHOUT the
 * intruders and then assert that adding them moves the count.
 */
const PRIMITIVES = `
<div id="nb-plain"   class="nb" data-nb="not built">refused</div>
<div id="nb-white"   class="nb bg-white" data-nb="not built">refused</div>
<div id="nb-none"    class="nb bg-none" data-nb="not built">refused</div>
<div id="nb-grad"    class="nb bg-linear-to-r" data-nb="not built">refused</div>
<div id="nb-arb"     class="nb bg-[image:none]" data-nb="not built">refused</div>
<div id="nb-short"   class="nb legacy-shorthand" data-nb="not built">refused</div>
<span class="conn" data-state="up"><i aria-hidden="true"></i> agent reading <span class="mono">71</span> lines</span>
<span class="conn" data-state="down"><i aria-hidden="true"></i> <b>unreachable</b> since 09:12</span>
<span class="meter" style="--score:60%;--floor:40%"><span class="v">0.91</span><span class="tick" data-t="floor"></span></span>
<span class="logo"><span class="badge">R</span>Reconcile</span>
<div class="lit lit--running">the machine is working</div>
<style>.legacy-shorthand{background:#ffffff}</style>
`
/**
 * ⚠️ THESE USE `bg-[#00303f]`, AN ARBITRARY UTILITY, AND THE FIRST DRAFT USED
 * `bg-agent`. `bg-agent` DOES NOT EXIST AT BASE — no `--color-agent` is in
 * Tailwind's theme until a bridge puts one there — so Tailwind emitted no rule,
 * the intruders were never PAINTED, and the negative control passed while
 * catching nothing. That is §5.6 inside the control written to prevent it.
 * The absence is real and useful, and assertion 6 of frontend-bridge.test.ts
 * turns on it: `bg-agent` producing nothing at base is exactly why a bridge that
 * merely RESTATES the palette can be told apart from one that consumes it.
 */
const INTRUDERS = `
<div id="second-line" class="bg-[#00303f] w-1/2" style="height:3px"></div>
<div id="second-dot"  class="bg-[#00303f] rounded-full" style="width:7px;height:7px"></div>
`

async function sheet(how: Arrangement): Promise<string> {
  return compose(await tailwind(), await kernel(), how)
}

after(async () => { await closeBrowser() })

// ──────────────────────────────────────────────────────────────────────────
describe('the hatch under Tailwind', { skip }, () => {
  const ids = ['nb-plain', 'nb-white', 'nb-none', 'nb-grad', 'nb-arb', 'nb-short'] as const

  const readHatch = () => {
    const out: Record<string, string> = {}
    for (const el of document.querySelectorAll('.nb')) {
      out[el.id] = getComputedStyle(el).backgroundImage === 'none' ? 'NONE' : 'hatch'
    }
    return out
  }

  it('is declared at all — the kernel paints it with no utility present', async () => {
    const seen = await render(await sheet('unlayered'), PRIMITIVES, readHatch)
    assert.equal(seen['nb-plain'], 'hatch',
      'the kernel itself no longer paints the hatch — nothing below this is worth reading')
  })

  /**
   * 🛑 FOUND BY THIS TEST, 16 Aug 2026, AND IT IS SHARPER THAN THE BRIEF THAT
   * ASKED FOR IT. The slice was set the task of proving the hatch survives
   * *"Tailwind's reset and utility layering"*. It does not survive EITHER of the
   * two obvious bridges, and the second attacker is not Tailwind at all.
   *
   * `.nb.nb` scores 0,2,0 and the 16 Aug repair rests entirely on that beating
   * any single-class rule *"whatever the order"*. TRUE WITHIN ONE LAYER. FALSE
   * ACROSS LAYERS — and UNLAYERED styles outrank EVERY layer, so the moment the
   * kernel is put inside one, a bare `<style>.route{background:var(--x)}</style>`
   * in a component beats it again. That is the SAME defect the doubled class was
   * written to end, resurrected by the act of layering rather than by Tailwind.
   *
   * MEASURED, all three arrangements, both attackers:
   *
   *   arrangement   `.nb` + bg-none (layered utility)   `.nb` + local unlayered `background:`
   *   unlayered     hatch KEPT                          hatch KEPT
   *   inBase        hatch LOST                          hatch LOST
   *   ownLayer      hatch KEPT                          hatch LOST
   *
   * So exactly ONE of the three keeps it against both — and it is the one that
   * makes the kernel beat every Tailwind utility it collides with, which is the
   * cost G198 records the owner accepting. THE BRIDGE MUST ANSWER BOTH COLUMNS,
   * and frontend-bridge.test.ts asserts both. It is not enough to pick a layer.
   */
  it('CONTROL — an UNLAYERED kernel survives the local `background:` shorthand', async () => {
    const seen = await render(await sheet('unlayered'), PRIMITIVES, readHatch)
    assert.equal(seen['nb-short'], 'hatch',
      'a local one-class `background:` shorthand erased the hatch even with the kernel ' +
      'UNLAYERED. That is the 16 Aug 2026 defect returning outright; `.nb.nb` outranks ' +
      'a 0,1,0 rule on specificity and nothing here should be able to change that.')
  })

  it('NEGATIVE CONTROL — LAYERING the kernel makes the doubled class inert', async () => {
    for (const how of ['inBase', 'ownLayer'] as const) {
      const seen = await render(await sheet(how), PRIMITIVES, readHatch)
      assert.equal(seen['nb-short'], 'NONE',
        `arrangement ${how}: the hatch survived an UNLAYERED local shorthand. If this ` +
        'passes, cascade-layer precedence has changed and the whole finding above must ' +
        'be re-measured rather than the assertion relaxed.')
    }
  })

  it('NEGATIVE CONTROL — `@layer base` LOSES it to a UTILITY too', async () => {
    const seen = await render(await sheet('inBase'), PRIMITIVES, readHatch)
    assert.equal(seen['nb-white'], 'hatch',
      'bg-white writes background-COLOR and must not reach the hatch — if this ' +
      'failed, the detector is wrong, not Tailwind')
    for (const id of ['nb-none', 'nb-grad', 'nb-arb'] as const) {
      assert.equal(seen[id], 'NONE',
        `${id}: expected the hatch to be ERASED under \`@layer base\`. If it survived, ` +
        'either Tailwind stopped emitting background-image for this utility or the ' +
        'layer order changed — either way the finding this suite pins has moved and ' +
        'the bridge test below must be re-derived, not relaxed.')
    }
  })

  it('survives BOTH attackers when the kernel is UNLAYERED — the only arrangement that does', async () => {
    const seen = await render(await sheet('unlayered'), PRIMITIVES, readHatch)
    for (const id of ids) assert.equal(seen[id], 'hatch', `${id} lost the hatch, unlayered`)
  })

  it('survives every background UTILITY when the kernel has its OWN layer, last', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, readHatch)
    for (const id of ids) {
      if (id === 'nb-short') continue   // the unlayered attacker — see the block above
      assert.equal(seen[id], 'hatch', `${id} lost the hatch, own layer`)
    }
  })

  it('keeps its WORD through preflight — which sets `padding: 0` on every ::after', async () => {
    const seen = await render(await sheet('inBase'), PRIMITIVES, () => {
      const cs = getComputedStyle(document.getElementById('nb-plain') as Element, '::after')
      return { content: cs.content, padding: cs.padding, box: cs.boxShadow }
    })
    assert.equal(seen.content, '"not built"',
      'the ::after word is gone. It is the half that survives greyscale printing; ' +
      'losing it and the hatch together leaves a refused feature indistinguishable ' +
      'from an ordinary one')
    assert.equal(seen.padding, '2px 6px',
      'Tailwind preflight `*, ::after { padding: 0 }` won over `.nb::after` — the ' +
      'word is still there but the plate around it collapsed')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('the six indicators — ONE LINE and ONE DOT', { skip }, () => {
  /**
   * A LINE is a painted horizontal rule: <= 4px tall, wider than it is tall, and
   * carrying a background colour. A DOT is a painted mark whose border-radius
   * makes it a circle and which is <= 12px across. Both detectors walk every
   * element AND its ::before/::after, because the meter's two bars and the
   * connection light's halo are all pseudo-elements.
   */
  const readMarks = () => {
    const lines: string[] = []
    const dots: string[] = []
    // ⚠️ NAME BY THE NEAREST CLASSED ANCESTOR WHEN THE ELEMENT ITSELF HAS NO
    // CLASS. The connection light is a bare `<i>` inside `.conn`, so the first
    // draft labelled it `i`, and every assertion of the form "this mark belongs
    // to the connection light" failed against a correct render. The detector was
    // right and the LABEL was wrong — which reads exactly like a real defect.
    const name = (e: Element, p: string): string => {
      if (e.id) return e.id + p
      const own = typeof e.className === 'string' ? e.className.trim().split(/\s+/)[0] : ''
      if (own) return own + p
      const anc = e.parentElement?.closest('[class]')
      const pre = anc && typeof anc.className === 'string'
        ? anc.className.trim().split(/\s+/)[0] + ' ' : ''
      return pre + e.tagName.toLowerCase() + p
    }
    for (const el of document.querySelectorAll('*')) {
      for (const p of ['', '::before', '::after']) {
        const cs = getComputedStyle(el, p || undefined)
        if (p && cs.content === 'none') continue
        const w = parseFloat(cs.width), h = parseFloat(cs.height)
        if (!isFinite(w) || !isFinite(h)) continue
        // A LINE is a FILLED bar. A MARK may be a RING — and it must be, because
        // two of the connection light's four marks carry no background at all:
        // the halo is `box-shadow: 0 0 0 1px` and a DOWN light is
        // `background: transparent` plus `box-shadow: inset 0 0 0 1.5px`.
        // Keying the dot detector on `background` alone found ONE of four, and
        // would have missed a `rounded-full border-2` second dot entirely.
        const fill = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
        const mark = fill || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0
        if (fill && h > 0 && h <= 4 && w > h * 3) lines.push(name(el, p))
        const r = cs.borderRadius
        if (mark && w > 0 && w <= 20 && (r.includes('50%') || parseFloat(r) >= w / 2)) dots.push(name(el, p))
      }
    }
    return { lines, dots }
  }

  it('the meter is the ONLY line — its track and its fill, and nothing else', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, readMarks)
    assert.deepEqual(seen.lines.sort(), ['meter::after', 'meter::before'],
      `a second LINE is on the surface: ${JSON.stringify(seen.lines)}. A progress bar ` +
      'is a second line, and CLAUDE.md records one being built here and removed.')
  })

  it('the connection light is the ONLY dot — the mark itself is SQUARE', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, readMarks)
    for (const d of seen.dots) {
      assert.ok(d.startsWith('conn'),
        `a circular mark outside the connection light: ${d} (all: ${JSON.stringify(seen.dots)}). ` +
        'An unread dot is a second dot, and CLAUDE.md records one being built here and removed.')
    }
    assert.equal(seen.dots.length, 4,
      'expected 4 circular marks — two connection lights, each a dot plus its halo, and ' +
      'two of the four are RINGS rather than fills — and saw ' +
      `${seen.dots.length}: ${JSON.stringify(seen.dots)}`)
  })

  it('NEGATIVE CONTROL — the detectors CATCH an added line and an added dot', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES + INTRUDERS, readMarks)
    assert.ok(seen.lines.includes('second-line'),
      'the line detector did not see a Tailwind progress bar. A detector that finds ' +
      'nothing when something is there is §5.6 — a check that passes while asserting ' +
      'nothing — and every count above it is worthless.')
    assert.ok(seen.dots.includes('second-dot'),
      'the dot detector did not see a `rounded-full` unread marker')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('no state depends on hue', { skip }, () => {
  it('every connection state is legible as a WORD, and the two states differ in text', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, () => {
      const out: { state: string; text: string; colour: string }[] = []
      for (const el of document.querySelectorAll('.conn')) {
        out.push({
          state: el.getAttribute('data-state') ?? '',
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
          colour: getComputedStyle(el.querySelector('i') as Element).backgroundColor,
        })
      }
      return out
    })
    assert.equal(seen.length, 2)
    for (const s of seen) {
      assert.ok(s.text.length > 0,
        `.conn[data-state="${s.state}"] carries no text — its state would be readable ` +
        'only from the light, and the kernel says a state may never depend on a light alone')
    }
    assert.notEqual(seen[0]?.text, seen[1]?.text,
      'both connection states read identically. The hue rule requires the WORD to carry ' +
      'the difference; if the words match, only the light distinguishes them.')
  })

  it('no painted colour sits in the red/amber band', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, () => {
      const bad: string[] = []
      const hue = (c: string): number | null => {
        const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/)
        if (!m) return null
        const a = m[4] === undefined ? 1 : parseFloat(m[4])
        if (a < 0.2) return null
        const r = +(m[1] as string) / 255, g = +(m[2] as string) / 255, b = +(m[3] as string) / 255
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
        if (d < 0.12) return null                       // greys carry no hue
        let h = 0
        if (max === r) h = 60 * (((g - b) / d) % 6)
        else if (max === g) h = 60 * ((b - r) / d + 2)
        else h = 60 * ((r - g) / d + 4)
        return (h + 360) % 360
      }
      for (const el of document.querySelectorAll('*')) {
        for (const p of ['', '::before', '::after']) {
          const cs = getComputedStyle(el, p || undefined)
          for (const prop of ['color', 'backgroundColor', 'borderTopColor'] as const) {
            const h = hue(cs[prop])
            if (h !== null && (h >= 330 || h <= 65)) {
              bad.push(`${el.className.toString().split(' ')[0]}${p} ${prop}=${cs[prop]} hue=${h.toFixed(0)}`)
            }
          }
        }
      }
      return bad
    })
    assert.deepEqual(seen, [],
      `a red, amber or traffic-light hue is painted: ${JSON.stringify(seen)}. ` +
      'THE HUE RULE forbids all three, and --agent is deep precisely so it cannot be ' +
      'read as "matched".')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('radius is 0', { skip }, () => {
  it('the connection light is the only non-zero radius; the mark is square', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, () => {
      const rounded: string[] = []
      let badge = ''
      for (const el of document.querySelectorAll('*')) {
        const anc = el.parentElement?.closest('[class]')
        const own = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''
        const label = own || ((anc && typeof anc.className === 'string'
          ? anc.className.trim().split(/\s+/)[0] + ' ' : '') + el.tagName.toLowerCase())
        for (const p of ['', '::before', '::after']) {
          const cs = getComputedStyle(el, p || undefined)
          if (p && cs.content === 'none') continue
          const r = cs.borderRadius
          if (r && r !== '0px' && r !== '0%') rounded.push(`${label}${p}=${r}`)
        }
        if (el.classList.contains('badge')) badge = getComputedStyle(el).borderRadius
      }
      return { rounded, badge }
    })
    assert.equal(seen.badge, '0px',
      'the mark is rounded. Owner ruling R3 of 15 Aug 2026 SQUARED the badge under the ' +
      'Square Corner Rule; --badge-radius is its single revert point and it reads 0.')
    for (const r of seen.rounded) {
      assert.ok(r.startsWith('conn'),
        `a non-zero radius outside the connection light: ${r} (all: ${JSON.stringify(seen.rounded)})`)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('prefers-reduced-motion', { skip }, () => {
  const readMotion = () => ({
    sweepDisplay: getComputedStyle(document.querySelector('.lit--running') as Element, '::after').display,
    haloAnimation: getComputedStyle(document.querySelector('.conn i') as Element, '::after').animationName,
    haloOpacity: getComputedStyle(document.querySelector('.conn i') as Element, '::after').opacity,
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
  })

  it('POSITIVE CONTROL — both run when motion is not reduced', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, readMotion, 'no-preference')
    assert.equal(seen.matches, false)
    assert.notEqual(seen.sweepDisplay, 'none', 'the sweep is off with motion ALLOWED')
    assert.equal(seen.haloAnimation, 'alive', 'the halo is not breathing with motion ALLOWED')
  })

  it('stops the sweep and the halo — and the halo settles at .3, not 0', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, readMotion, 'reduce')
    assert.equal(seen.matches, true)
    assert.equal(seen.sweepDisplay, 'none', 'the sweep still runs under reduced motion')
    assert.equal(seen.haloAnimation, 'none', 'the halo still animates under reduced motion')
    assert.equal(seen.haloOpacity, '0.3',
      'the halo settled at 0. MARK TWO distinguishes a DOWN light from a live one by ' +
      'an opacity-0 halo AND a hollow centre; stopping a live halo at 0 collapses those ' +
      'two differences to one under exactly the setting meant to preserve them.')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('a token changes the kernel — the control for the bridge test', { skip }, () => {
  it('moving --agent moves the meter fill', async () => {
    const seen = await render(await sheet('ownLayer'), PRIMITIVES, () => {
      const read = () => getComputedStyle(document.querySelector('.meter') as Element, '::after').backgroundColor
      const before = read()
      document.documentElement.style.setProperty('--agent', 'rgb(1, 2, 3)')
      return { before, after: read() }
    })
    assert.notEqual(seen.before, seen.after)
    assert.equal(seen.after, 'rgb(1, 2, 3)',
      'the meter did not follow --agent. Every assertion about the BRIDGE rests on this ' +
      'mechanic working against the kernel alone.')
  })
})

/**
 * THE BRIDGE — RED. Nothing in this file passes at base, and every failure names
 * the PROPERTY it could not witness rather than an import that threw.
 *
 * 🛑 A FRONTEND SLICE IS PRONE TO A TEST THAT FAILS ONLY BECAUSE A MODULE IS
 * MISSING, WHICH IS RED AGAINST A TYPO. Three things are done about that and none
 * is optional:
 *
 *   1. The seam is resolved with `existsSync` and read as a FILE. There is no
 *      import of frontend code anywhere here, so `npm run typecheck:tests` is
 *      GREEN at base and nothing in this file can fail as a compile error.
 *   2. The engine half of every assertion below is already witnessed PASSING, in
 *      kernel-under-tailwind.test.ts, against the kernel that exists today. A
 *      failure here therefore says *"the bridge does not hold property P"* and
 *      never *"property P cannot be measured"*.
 *   3. WITNESSED AGAINST A DELIBERATELY WRONG BRIDGE, 16 Aug 2026. A throwaway
 *      `@layer base { @import tokens.css }` bridge and a thin port were planted,
 *      the suite was run, and the failures moved from *"no built specimen"* to
 *      the behavioural messages. Neither file is committed.
 *
 * THE ONE SEAM THIS PASS DECLARES AND DOES NOT BUILD:
 *
 *   frontend/dist/specimen.html   a BUILT, self-contained page carrying the three
 *                                 ported primitives in their states, with its real
 *                                 stylesheet attached. Loaded over `file://`, so
 *                                 what is asserted is what SHIPS — not a
 *                                 re-compilation of the bridge by this test.
 *
 * It must contain, at minimum:
 *   · four `.nb` marks — one bare, one with `bg-white`, one with `bg-none`, one
 *     with `bg-linear-to-r` — each carrying its refusing G row within reach
 *   · one `.meter` with a score and a floor
 *   · two `.conn`, `data-state="up"` and `data-state="down"`
 *   · one `.lit.lit--running`
 *
 * 🛑 WHY THOSE THREE PRIMITIVES AND NOT THREE EASIER ONES. The hatch is a
 * background-IMAGE and is therefore the one thing a utility layer can erase. The
 * meter is the ONLY line, so porting it is where a second line gets introduced.
 * The connection light is the ONLY dot AND the only radius AND one of the two
 * animations, so it carries the Square Corner Rule and the reduced-motion rule at
 * once. A component set that survives all three has crossed the bridge; one that
 * survives a button has not.
 *
 * ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT ASSERT. Not the routes, not an
 * operation, not a capability. G200 freezes serving at 4 and no G row is minted
 * by this pass.
 */

import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import { browserSkip, closeBrowser, renderFile, SPECIMEN } from './render.ts'

import { browserRequiredUnderCi } from '../reachability.ts'

const skip = await browserSkip()

browserRequiredUnderCi('the six frontend-bridge render assertions', skip)

after(async () => { await closeBrowser() })

/** Nothing to prepare, for the assertions that add no markup. */
const NOTHING = (): void => {}

/**
 * The built specimen, or a SENTENCE naming the property that went unwitnessed.
 * Never throws.
 */
function specimen(property: string): string | { missing: string } {
  if (existsSync(SPECIMEN)) return SPECIMEN
  return { missing:
    `${property} is UNWITNESSED: no built specimen at frontend/dist/specimen.html. ` +
    'The frontend root must emit one self-contained page carrying the ported ' +
    '`.nb`, `.meter` and `.conn` in their states, with its real stylesheet ' +
    'attached — that page is what decides where docs/handoff-pack/tokens.css sits ' +
    'relative to Tailwind\'s `@layer theme, base, components, utilities`, and ' +
    'kernel-under-tailwind.test.ts has already MEASURED that getting that order ' +
    'wrong erases the hatch. Until the page exists the property is neither held ' +
    'nor refuted.' }
}

// ──────────────────────────────────────────────────────────────────────────
describe('1 · the hatch survives the bridge', { skip }, () => {
  const P = 'the hatch surviving Tailwind'

  it('a ported NotBuilt renders the hatch under the Tailwind reset', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () =>
      [...document.querySelectorAll('.nb')].map((e) => getComputedStyle(e).backgroundImage))
    assert.ok(seen.length > 0, `${P}: the bridge rendered no .nb element at all`)
    for (const [i, bg] of seen.entries()) {
      assert.notEqual(bg, 'none',
        `.nb #${i} computes background-image: none under the bridge. The hatch is the only ` +
        'control between a mockup and a procurement conversation, and a refused feature ' +
        'just rendered as an ordinary one.')
    }
  })

  it('THE HARD CASE — it survives an element that ALSO carries a background utility', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const out: Record<string, string> = {}
      for (const e of document.querySelectorAll('.nb')) {
        const util = [...e.classList].find((c) => c.startsWith('bg-')) ?? '(none)'
        out[util] = getComputedStyle(e).backgroundImage === 'none' ? 'NONE' : 'hatch'
      }
      return out
    })
    for (const util of ['bg-none', 'bg-linear-to-r']) {
      assert.equal(seen[util], 'hatch',
        `.nb + \`${util}\` lost the hatch. This is the shorthand failure in its NEW ` +
        'register: `.nb.nb` is a SPECIFICITY defence and cascade layers are resolved ' +
        'BEFORE specificity, so a 0,1,0 utility in `@layer utilities` beats it outright ' +
        'when the kernel sits in a lower layer. kernel-under-tailwind.test.ts measures ' +
        'exactly this failure passing as a negative control.')
    }
    assert.equal(seen['bg-white'], 'hatch', '.nb + `bg-white` lost the hatch')
  })

  it('THE SECOND ATTACKER — and it is not Tailwind: an UNLAYERED local `background:`', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(
      page,
      () => {
        const st = document.createElement('style')
        st.textContent = '.nb{background:#ffffff}'
        document.head.appendChild(st)
      },
      () => [...document.querySelectorAll('.nb')]
        .filter((e) => getComputedStyle(e).backgroundImage === 'none').length,
    )
    assert.equal(seen, 0,
      `${seen} of the ported .nb elements lost the hatch to a plain unlayered ` +
      '`<style>.nb{background:…}</style>`. UNLAYERED RULES OUTRANK EVERY LAYER, so ' +
      'putting the kernel in a layer to make room for Tailwind re-opens the exact ' +
      'defect the 16 Aug 2026 `.nb.nb` repair closed — and re-opens it against ' +
      'ordinary component CSS rather than against Tailwind. Measured in ' +
      'kernel-under-tailwind.test.ts: `unlayered` survives this and both layered ' +
      'arrangements do not. A bridge that answers only the utility column has not ' +
      'answered this one.')
  })

  it('the mark carries the REFUSING DECISION, not the constant word "not built"', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    /* ⚠️ `reason` READ `textContent + data-nb-why` UNTIL 16 Aug 2026 AND THE
       ASSERTION WAS THEREFORE VACUOUS AGAINST THE FAILURE IT NAMES. The ported
       component emitted the reason twice — visible text AND that attribute — and
       either alone satisfied the regex, so deleting every reason A READER CAN SEE
       left the suite fully green. Proved by mutation, not noticed by reading.
       The attribute is gone from the component and the read is gone from here:
       one satisfier, and it is the one a person can see.
       The PLATE is then asserted separately, and it was not asserted at all
       before — `word` was computed and used only inside a failure message, which
       is the same shape one register down. Two assertions, two mechanisms: the
       kernel draws the plate from `data-nb` through `content: attr(…)`, and the
       reason is ordinary text in the box. Neither can stand in for the other. */
    const seen = await renderFile(page, NOTHING, () =>
      [...document.querySelectorAll('.nb')].map((e) => ({
        word: getComputedStyle(e, '::after').content,
        reason: e.textContent ?? '',
      })))
    assert.ok(seen.length > 0, `${P}: the bridge rendered no .nb element at all`)
    for (const m of seen) {
      assert.ok(/G\d+/.test(m.reason),
        'a not-built mark carries no G row IN VISIBLE TEXT. CLAUDE.md records this as the ' +
        'hatch\'s THIRD failure — a third of the marks have no reason within reach — and a ' +
        'reason that exists only in an attribute is not within a reader\'s reach. ' +
        `Saw: ${JSON.stringify(m)}`)
      assert.ok(/G\d+/.test(m.word),
        'the PLATE carries the constant word and not the refusing decision. This is the ' +
        'hatch\'s SECOND failure exactly: `content: attr(data-nb)` renders whatever the ' +
        'mark declares, and "not built" alone tells a reader nothing about which decision ' +
        `refused the feature. The plate is also the half that survives greyscale printing. ` +
        `Saw: ${JSON.stringify(m)}`)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('2 · one line, one dot, across the bridge', { skip }, () => {
  const P = 'the ONE LINE / ONE DOT count'

  const readMarks = () => {
    const lines: string[] = []
    const dots: string[] = []
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
        // See kernel-under-tailwind.test.ts: a MARK may be a ring, so the dot
        // detector must count box-shadow and border, not `background` alone.
        const fill = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
        const mark = fill || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0
        if (fill && h > 0 && h <= 4 && w > h * 3) lines.push(name(el, p))
        const r = cs.borderRadius
        if (mark && w > 0 && w <= 20 && (r.includes('50%') || parseFloat(r) >= w / 2)) dots.push(name(el, p))
      }
    }
    return { lines, dots }
  }

  it('the ported Meter is the only line', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readMarks)
    for (const l of seen.lines) {
      assert.ok(l.startsWith('meter'),
        `a second LINE crossed the bridge: ${l} (all: ${JSON.stringify(seen.lines)}). ` +
        'A progress bar is a second line. Both a second line and a second dot were built ' +
        'here before and removed.')
    }
    assert.equal(seen.lines.length, 2,
      `expected exactly the meter's track and fill and saw ${JSON.stringify(seen.lines)}`)
  })

  it('the ported Connection is the only dot', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readMarks)
    for (const d of seen.dots) {
      assert.ok(d.startsWith('conn'),
        `a second DOT crossed the bridge: ${d} (all: ${JSON.stringify(seen.dots)}). ` +
        'An unread dot is a second dot. Tailwind ships `rounded-full`, which makes one ' +
        'a single class away.')
    }
    assert.equal(seen.dots.length, 4,
      `expected two connection lights, each a dot plus its halo, and saw ${JSON.stringify(seen.dots)}`)
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('3 · no state depends on hue', { skip }, () => {
  const P = 'the hue rule'

  it('every rendered state carries a word, and no painted colour is red or amber', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const wordless: string[] = []
      for (const el of document.querySelectorAll('[data-state], .conn, .nb')) {
        if ((el.textContent ?? '').replace(/\s+/g, '').length === 0 &&
            getComputedStyle(el, '::after').content === 'none') {
          wordless.push(el.className.toString())
        }
      }
      const bad: string[] = []
      const hue = (c: string): number | null => {
        const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/)
        if (!m) return null
        if (m[4] !== undefined && parseFloat(m[4]) < 0.2) return null
        const r = +(m[1] as string) / 255, g = +(m[2] as string) / 255, b = +(m[3] as string) / 255
        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
        if (d < 0.12) return null
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
            if (h !== null && (h >= 330 || h <= 65)) bad.push(`${el.className.toString()}${p} ${prop}=${cs[prop]}`)
          }
        }
      }
      return { wordless, bad }
    })
    assert.deepEqual(seen.wordless, [],
      `a state element renders no word: ${JSON.stringify(seen.wordless)}. Every state ` +
      'carries a word; there is no red, amber or traffic-light green in this system.')
    assert.deepEqual(seen.bad, [],
      `Tailwind's default palette reached a painted surface: ${JSON.stringify(seen.bad)}. ` +
      'This is the specific risk of adopting a utility framework under this kernel — ' +
      '`text-red-500` is one class away and no state may depend on hue.')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('4 · radius is 0', { skip }, () => {
  const P = 'the Square Corner Rule'

  it('only the connection light is round; the mark is square', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const rounded: string[] = []
      for (const el of document.querySelectorAll('*')) {
        // Label by the nearest CLASSED ancestor when the element has none of its
        // own — the connection light is a bare `<i>` inside `.conn`, so a naive
        // label reads "" and every "this belongs to the connection light" check
        // fails against a correct render.
        const own = typeof el.className === 'string' ? el.className.trim() : ''
        const anc = el.parentElement?.closest('[class]')
        const label = own || ((anc && typeof anc.className === 'string'
          ? anc.className.trim() + ' ' : '') + el.tagName.toLowerCase())
        for (const p of ['', '::before', '::after']) {
          const cs = getComputedStyle(el, p || undefined)
          if (p && cs.content === 'none') continue
          const r = cs.borderRadius
          if (r && r !== '0px' && r !== '0%') rounded.push(`${label}${p}=${r}`)
        }
      }
      return rounded
    })
    for (const r of seen) {
      assert.ok(/(^|\s)conn/.test(r),
        `a non-zero radius outside the connection light: ${r}. Tailwind's `+
        '`rounded`, `rounded-md` and `rounded-lg` are each one class away from breaking ' +
        `the Square Corner Rule. All: ${JSON.stringify(seen)}`)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('5 · reduced motion stops the sweep and the halo', { skip }, () => {
  const P = 'the reduced-motion guard'

  const readMotion = () => {
    const conn = document.querySelector('.conn i')
    const lit = document.querySelector('.lit--running')
    return {
      haloAnimation: conn ? getComputedStyle(conn, '::after').animationName : '(no .conn i)',
      haloOpacity: conn ? getComputedStyle(conn, '::after').opacity : '(no .conn i)',
      sweepDisplay: lit ? getComputedStyle(lit, '::after').display : '(no .lit--running)',
      running: [...document.querySelectorAll('*')].flatMap((el) =>
        ['', '::before', '::after'].map((p) => {
          const cs = getComputedStyle(el, p || undefined)
          return cs.animationName !== 'none' && cs.animationPlayState === 'running' &&
            parseFloat(cs.animationDuration) > 0.01
            ? `${el.className.toString()}${p}:${cs.animationName}` : ''
        }).filter(Boolean)),
    }
  }

  it('POSITIVE CONTROL — the halo breathes when motion is allowed', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readMotion, 'no-preference')
    assert.equal(seen.haloAnimation, 'alive',
      'the ported Connection does not breathe at all — its HALO is the life signal, so a ' +
      'component that never animates passes the reduced-motion test for the wrong reason')
  })

  it('nothing animates under reduce, and the halo settles at .3', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readMotion, 'reduce')
    assert.deepEqual(seen.running, [],
      `still animating under prefers-reduced-motion: ${JSON.stringify(seen.running)}. ` +
      'Note `*` alone does not match pseudo-elements and both of this system\'s ' +
      'animations run on one — a guard written `*{}` looks complete and stops neither.')
    assert.equal(seen.haloOpacity, '0.3',
      'the halo settled at 0, collapsing the two differences that distinguish a DOWN ' +
      'light from a live one into one')
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('6 · a token changes the component — the bridge, not a restated palette', { skip }, () => {
  const P = 'tokens.css remaining the single source of colour'

  it('moving --agent moves BOTH the kernel primitive and a Tailwind utility', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, () => {
      const d = document.createElement('div')
      d.id = 'tw-consumer'
      d.className = 'bg-agent'
      document.body.appendChild(d)
    }, () => {
      const meter = () => {
        const m = document.querySelector('.meter')
        return m ? getComputedStyle(m, '::after').backgroundColor : '(no .meter)'
      }
      const util = () => getComputedStyle(document.getElementById('tw-consumer') as Element).backgroundColor
      const before = { meter: meter(), util: util() }
      document.documentElement.style.setProperty('--agent', 'rgb(1, 2, 3)')
      return { before, after: { meter: meter(), util: util() } }
    })
    assert.equal(seen.after.meter, 'rgb(1, 2, 3)',
      `the ported Meter did not follow --agent (was ${seen.before.meter}, now ${seen.after.meter})`)
    assert.equal(seen.after.util, 'rgb(1, 2, 3)',
      'the Tailwind utility `bg-agent` did not follow --agent (was ' +
      `${seen.before.util}, now ${seen.after.util}). This is THE bridge assertion: if ` +
      'Tailwind RESTATED the palette — `--color-agent: #00866a` as a literal — the ' +
      'utility would hold its own copy and tokens.css would have stopped being the ' +
      'single source of colour. Only a bridge that reads `var(--agent)` follows.')
  })
})

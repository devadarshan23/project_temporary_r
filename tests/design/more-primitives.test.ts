/**
 * THE REMAINING MARKS — RED, with its detectors witnessed GREEN beside it.
 *
 * PR #272 ported three of the kernel's marks. This file is the witness for the
 * next three, and it is written before them.
 *
 * ─── WHAT THE KERNEL DECLARES, DERIVED RATHER THAN REMEMBERED ──────────────
 *
 *   grep -nE '^(\.|:|a:|input|select|textarea|@keyframes|@media|\*|html)' \
 *     docs/handoff-pack/tokens.css
 *
 * ⚠️ DO NOT READ THAT GREP'S LINE COUNT AS A NUMBER OF MARKS, AND THIS SENTENCE
 * REPLACES ONE THAT DID. The first draft of this header said "Twenty-six
 * selector heads" and the command prints 49 — because a selector LIST spans
 * lines (THE CONTROL alone opens across three) and because `@keyframes` and
 * `@media` heads are in the pattern too. A count nobody ran, in the file whose
 * whole argument is that a detector must be witnessed. It is corrected here
 * rather than swept. Read the GROUPING, which is derived from the rules and not
 * from the line count:
 *
 *   PORTED (#272)   .nb / .nb.nb / .nb::after · .meter family · .conn family
 *   PORTED HERE     .hu · .skip + :focus-visible · .lit / .lit--running
 *   CONSUMED ALREADY, NO COMPONENT WANTED
 *                   .mono .figure .num  — Meter.tsx already carries `.mono`
 *                   .sr-only            — an attribute of a caller, not a mark
 *   LEFT, AND EACH FOR A NAMED REASON — see THE THINGS LEFT, below
 *                   a:not([class]) · input/select/textarea · .entry ·
 *                   .logo/.badge/.glyph · the ~ › … grammar cues
 *
 * ─── WHY THESE THREE ───────────────────────────────────────────────────────
 *
 * They were chosen for the properties they force, not for how much CSS they
 * carry. Between them they are the only marks left that can BREAK something.
 *
 *   .lit / .lit--running   THE SECOND ERASABLE BACKGROUND-IMAGE IN THE SYSTEM.
 *     The kernel says so in its own words at NOT-BUILT — *"THIS GUARDS .nb ONLY,
 *     AND THE SIBLING EXPOSURE IS REAL … both are erasable by the same local
 *     shorthand"* — and records that three of nine `.lit` elements were rendering
 *     with the light gone on 16 Aug 2026 while looking perfectly ordinary. That
 *     is the `.nb` failure one class over. It is also the only mark carrying a
 *     shape rule a port can silently flatten: A SOURCE WITH FALLOFF, NEVER A FLAT
 *     FILL. A flat fill is four characters of difference and no test in the tree
 *     can currently see it.
 *
 *   .skip + :focus-visible THE ONLY MARK THAT EXISTS ONLY WHILE FOCUSED, so it
 *     is the only place the focus ring can be asserted at all — and the ring is
 *     the one open defect the kernel names against ITSELF at the head of the
 *     file: *"the focus ring's erasability (:focus-visible below is a box-shadow
 *     at (0,1,0) with outline:none and no fallback; six files restate it as an
 *     `outline` because a component edge that is also a box-shadow beats it on
 *     source order)"*. bridge.css leaves `ring-*` and `inset-shadow-*` UNFENCED
 *     and says so. So this is the property most likely to be quietly lost by the
 *     next component anyone writes, and nothing measures it today.
 *
 *   .hu                    THE HUE RULE'S OWN MARK. The whole of it is a WORD:
 *     no fill, no dot, no line, ink only. THE AGENT RULE names four sites that
 *     reached for green for a job green may not do, and a person marker is the
 *     fifth such temptation — *"the agent ran every row, so naming it says
 *     nothing; a PERSON in the loop is the exception"*. The easy port paints it
 *     green or hangs an avatar dot on it, and the second of those is a SEVENTH
 *     INDICATOR. It is the cheapest of the three and it is the one where the
 *     count rule and the hue rule are the entire component.
 *
 * ─── THE THING THIS PASS MEASURED, AND IT IS A LIVE DEFECT ─────────────────
 *
 * 🛑 A FOCUSABLE `.lit` HAS NO FOCUS INDICATOR AT ALL. Measured 17 Aug 2026, in
 * chromium, against docs/handoff-pack/tokens.css alone — no Tailwind, no bridge, no
 * component:
 *
 *     <a href="#x" class="lit">…</a>   focused → box-shadow
 *                                        rgba(0,134,106,.22) 0 0 0 1px inset
 *                                        outline: none
 *     <a href="#x">…</a>              focused → box-shadow
 *                                        rgb(255,255,255) 0 0 0 2px,
 *                                        rgb(0,48,63)     0 0 0 4px
 *
 * `.lit` is (0,1,0) at tokens.css `.lit{…}` and `:focus-visible` is (0,1,0) at
 * `:focus-visible{…}`; the ring is declared FIRST, so `.lit`'s own inset edge
 * wins on source order and replaces it — box-shadow is not additive across
 * rules. `outline:none` has already been set by then, so nothing is left. That
 * is WCAG 2.2 AA 2.4.7 failing on any interactive element the machine is
 * working on, which is precisely the element a keyboard user is most likely to
 * be tabbing to. Derive the two selectors, never the line numbers:
 *     grep -n '^\.lit{\|^:focus-visible' docs/handoff-pack/tokens.css
 *
 * 🛑 SO §3 BELOW CANNOT BE MADE GREEN BY A COMPONENT ALONE, AND THAT IS THE
 * POINT RATHER THAN AN OVERSIGHT. The implementation slice has exactly three
 * moves and it must pick one in writing:
 *   (a) the kernel gains `.lit:focus-visible`, re-asserting the ring ALONGSIDE
 *       the lit edge in one box-shadow. A KERNEL EDIT, which this pass may not
 *       make and which is the honest answer to an open finding the kernel has
 *       been carrying since 15 Aug 2026.
 *   (b) the ported Luminous refuses to be focusable, and the specimen's light is
 *       inert. Then the assertion passes by ABSENCE, which is §5.6, so the
 *       inventory below requires a focusable light and (b) is closed off.
 *   (c) the component restates the ring. That is the thing the kernel's own
 *       header records six files already doing, and it is how a system ends up
 *       with seven spellings of one indicator.
 * This file does not choose. It refuses to let the choice be made silently.
 *
 * ─── THE THINGS LEFT, EACH WITH ITS REASON ─────────────────────────────────
 *
 *   THE GRAMMAR CUES (~ hedges · › your move · … elsewhere · past tense).
 *     THE KERNEL DECLARES NO CLASS FOR ANY OF THEM. They are stated under THE
 *     SIX INDICATORS as *"text distinguished by GRAMMAR"* and carry no CSS at
 *     all, which is the design: a grammar cue is a CHARACTER IN A SENTENCE, and
 *     the moment it becomes `<Hedge/>` it becomes a styleable thing that can
 *     drift a hue, a weight, or a badge. Porting them means MINTING a spelling
 *     the kernel deliberately does not have — a kernel edit wearing a
 *     component's clothes. Left, and the leaving is the finding.
 *
 *   THE LINK — `a:not([class])`. The selector is the trap: a `<Link/>` taking a
 *     `className` prop DISABLES THE KERNEL RULE ON ITSELF, and what it loses is
 *     the underline, which THE LINK block calls *"THE ONLY AFFORDANCE LEFT"*
 *     after THE AGENT RULE took the hue away. The correct port is therefore NOT
 *     A COMPONENT, and asserting that is a lint, not a render test. Left with
 *     the trap written down.
 *
 *   THE CONTROL — input/select/textarea. Element selectors: a plain React
 *     `<input>` already consumes every declaration, so a component would restate
 *     nothing and witness nothing. The one thing it would add — the WORD beside
 *     an invalid field, which the kernel's INVALID ruling explicitly says
 *     carries the meaning while the 2px border only reinforces it — belongs to a
 *     form slice, and a form is an operation. G200 freezes serving at 4 of 72.
 *
 *   THE ENTRY FRAME — `.entry`. A page frame for sign-in, re-authentication and
 *     invitation. All three are routes, and a route is an operation. Same fence.
 *
 *   THE MARK — `.logo` / `.badge` / `.glyph`. Genuinely tempting, because
 *     `--badge-radius:0` is the system's only other radius exception and owner
 *     ruling R3 squared it. But kernel-under-tailwind.test.ts ALREADY asserts
 *     `badge` computes `0px`, so the hard half is witnessed and a port would add
 *     a brand asset rather than a property. Left as the lowest-yield of the six.
 *
 * ─── HOW THIS FILE IS RED FOR THE RIGHT REASON ─────────────────────────────
 *
 * The split is the one #272 established and it is not a formality:
 *
 *   §1 THE DETECTORS — GREEN AT BASE. Every detector below is run twice: once
 *      against a page with an INTRUDER PLANTED, where it must report the
 *      intruder, and once without, where it must report nothing. A detector is
 *      not trusted for finding nothing until it has been shown to find
 *      something. All plants are INLINE `style=` or a local `<style>`, never a
 *      Tailwind utility — kernel-under-tailwind.test.ts records a `bg-agent`
 *      intruder that COMPILED TO NOTHING and a negative control that passed
 *      while catching neither of its two plants.
 *
 *   §2–§5 THE PROPERTIES — RED AT BASE. These load the BUILT page over
 *      `file://` and fail naming the property they could not witness. No
 *      frontend module is imported anywhere in this file, so
 *      `npm run typecheck:tests` is green and nothing here can fail as a
 *      compile error against a typo.
 *
 * THE SEAM THIS PASS DECLARES AND DOES NOT BUILD — `frontend/dist/specimen.html`
 * must carry, IN ADDITION to what #272 put there:
 *
 *   · ONE `.hu` person mark whose text names the person in the loop.
 *   · ONE `.skip` link, the FIRST focusable element in the document, whose
 *     `href` resolves to an element that actually exists on the page.
 *   · the single `.lit.lit--running` it already has, now ALSO (a) carrying
 *     `bg-linear-to-r` — the background-IMAGE attacker, already in bridge.css's
 *     `@source inline` list — and (b) FOCUSABLE.
 *
 * 🛑 AND STILL EXACTLY ONE LIGHT. The kernel's LUMINOUS TOUCH block reads
 * *"never on more than one thing per view — one light is legible, six lights are
 * wallpaper"*, so the attacker matrix `.nb` gets FOUR marks for cannot be spelled
 * that way here. The matrix is run at ENGINE level in §1 instead, where a
 * synthetic probe is not a view, and the built page keeps its one light.
 *
 * ─── WITNESSED IN BOTH DIRECTIONS, 17 Aug 2026. NOT ARGUED — RUN ──────────
 *
 * A red suite is worth nothing until someone has shown it can go green, and a
 * green one is worth nothing until someone has shown it can go red. Both were
 * measured, with a THROWAWAY port that is deliberately NOT COMMITTED — three
 * one-line components and a `<SkipLink/>` + `<Person/>` + `<Luminous/>` wired
 * into Specimen.tsx:
 *
 *   base, no port                    10 of 19 pass · 9 fail
 *                                    every failure names an UNWITNESSED
 *                                    PROPERTY; none is an import or a typo
 *   + the throwaway port             18 of 19 pass · 1 fail, and the one that
 *                                    remains is `.lit` showing NO ring —
 *                                    the kernel defect above, unreachable by
 *                                    any component
 *   + a probe of answer (a),         19 of 19 pass
 *     `.lit:focus-visible` in the
 *     kernel re-asserting the ring
 *     alongside the lit edge
 *
 * So no assertion here is impossible, and exactly one of them is a KERNEL
 * question wearing a component's clothes. The probe is not a recommendation —
 * it is proof that the assertion is satisfiable, which is what a red test owes
 * the person who has to make it green.
 *
 * ⚠️ AND THE INVENTORY BELOW WAS CHECKED AGAINST #272 RATHER THAN ASSUMED
 * COMPATIBLE WITH IT. `frontend-bridge.test.ts` asserts EXACT counts —
 * `lines.length === 2`, `dots.length === 4` — so a required specimen change is a
 * change to its fixture. With the throwaway port in place all three files in
 * tests/design/ ran green together: `node --test "tests/design/*.test.ts"`,
 * 17 suites, exit 0. A skip link is a filled block 44px tall and a person mark
 * paints nothing at all, so neither reaches either detector — measured, not
 * reasoned about.
 *
 * ⚠️ ONE MEASUREMENT TRAP, RECORDED BECAUSE IT BIT THIS PASS. `getComputedStyle`
 * returns a LIVE declaration. Reading `rest = getComputedStyle(e)`, then calling
 * `e.focus()`, then reading `rest.left` reports the FOCUSED value — this pass
 * measured `.skip` at rest as `left: 8px` and briefly believed the kernel's
 * off-screen parking was broken. Every before/after read below copies its values
 * out immediately.
 */

import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import {
  browserSkip, closeBrowser, tailwind, kernel, compose, render, renderFile, SPECIMEN,
} from './render.ts'
import { browserRequiredUnderCi } from '../reachability.ts'

const skip = await browserSkip()

browserRequiredUnderCi('the ported primitives audit and its planted-mark base controls', skip)

after(async () => { await closeBrowser() })

/** Nothing to prepare, for assertions that add no markup. */
const NOTHING = (): void => {}

/** The shipped arrangement, and the only one that survives both attackers. */
async function sheet(): Promise<string> {
  return compose(await tailwind(), await kernel(), 'unlayered')
}

/**
 * The three marks as the kernel spells them, with nothing added. This is the
 * NEGATIVE side of every witness below: the detectors must report CLEAN here.
 */
const MARKS = `
<a href="#target" class="skip">skip to content</a>
<span class="hu">reviewed by asha</span>
<div class="lit lit--running">the machine is working on this right now</div>
<main id="target">content</main>
`

/**
 * THE PLANTS. Every one is an INLINE style or a local `<style>`, because both
 * are guaranteed to paint. A Tailwind class is not: `@source inline(...)` decides
 * what compiles, and an intruder spelled as a utility that was never listed
 * compiles to NOTHING and is caught by no detector while appearing to be caught
 * by all of them.
 *
 *   #a-second-line   a 120x3 filled bar — a progress bar, THE second line
 *   #a-second-dot    an 8x8 circular pip — an unread badge, THE second dot
 *   .hu-green        a person marker painted --agent, which THE AGENT RULE
 *                    reserves for "the machine measured something"
 *   #flat-fill       a `.lit` whose light is a FLAT FILL — the shape a careless
 *                    port produces
 *   #no-falloff      the sneakier one: a `.lit` that IS a radial-gradient and
 *                    has NO transparent outer stop, so it is a SOURCE by shape
 *                    and a FILL by behaviour. A detector keyed on the word
 *                    "radial-gradient" passes this and catches nothing.
 *   #ring-eater      an element that ERASES the focus ring by naming `outline`
 *                    and turning it off — the only way left under G240
 *   #ring-shadow-only the OLD plant, kept with its assertion inverted: an element
 *                    whose own box-shadow used to replace the ring and now cannot
 *   #second-light    a second `.lit` in one view
 */
const PLANTS = `
<div id="a-second-line" style="height:3px;width:120px;background:#00303f"></div>
<span id="a-second-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00303f"></span>
<span class="hu hu-green" style="color:var(--agent)">agent-coloured person</span>
<div id="flat-fill"  class="lit" style="background-image:linear-gradient(#00866a,#00866a)">flat</div>
<div id="no-falloff" class="lit" style="background-image:radial-gradient(120% 90% at 18% 0%,#00866a 0%,#014751 74%)">no falloff</div>
<a href="#target" id="ring-eater" style="outline:none;box-shadow:inset 0 0 0 1px #00303f">erases the ring</a>
<a href="#target" id="ring-shadow-only" style="box-shadow:inset 0 0 0 1px #00303f">owns an edge, cannot erase the ring</a>
<div id="second-light" class="lit">a second light in one view</div>
`

// ═══ THE DETECTORS ════════════════════════════════════════════════════════
// Each is a bare arrow function closing over NOTHING — render.ts serialises it
// to source and re-parses it inside the page, so a reference to anything in this
// module would be a ReferenceError in chromium rather than a compile error here.

/**
 * A LINE is a FILLED bar <=4px tall and >3x as wide. A DOT is a painted mark
 * <=20px across whose radius makes it a circle — and it may be a RING, because
 * two of the connection light's four marks carry no background at all. Same
 * shape as kernel-under-tailwind.test.ts; carried rather than imported, because
 * it must serialise.
 */
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
      const fill = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
      const mark = fill || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0
      if (fill && h > 0 && h <= 4 && w > h * 3) lines.push(name(el, p))
      const r = cs.borderRadius
      if (mark && w > 0 && w <= 20 && (r.includes('50%') || parseFloat(r) >= w / 2)) dots.push(name(el, p))
    }
  }
  return { lines, dots }
}

/**
 * THE FALLOFF DETECTOR. Classifies every `.lit` element's paint:
 *
 *   source   a radial-gradient with >=3 colour stops whose OUTERMOST stop is
 *            fully transparent — light dying away to nothing
 *   flat     anything else that paints, including a radial-gradient with an
 *            opaque outer stop. That is the case the word "radial" would miss.
 *   erased   `background-image: none` — the sibling of the hatch's own failure
 *
 * ⚠️ THE ALPHA IS READ OFF THE LAST COLOUR TOKEN, NOT OFF THE LAST CHARACTER.
 * chromium serialises a zero-alpha stop as `rgba(82, 198, 227, 0)`, and a stop
 * with no alpha at all as `rgb(…)` — so an `rgb(` tail is opaque by definition.
 */
const readFalloff = () => {
  const out: Record<string, string> = {}
  for (const el of document.querySelectorAll('.lit')) {
    const img = getComputedStyle(el).backgroundImage
    const key = el.id || (typeof el.className === 'string' ? el.className.trim() : 'lit')
    if (img === 'none') { out[key] = 'erased'; continue }
    const stops = img.match(/rgba?\([^)]*\)/g) ?? []
    const last = stops[stops.length - 1] ?? ''
    const m = last.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)
    const transparentOuter = m !== null && parseFloat(m[1] as string) === 0
    out[key] = img.startsWith('radial-gradient') && stops.length >= 3 && transparentOuter
      ? 'source' : 'flat'
  }
  return out
}

/**
 * THE AGENT DETECTOR. Reports every element whose painted colour is the agent
 * green. The green is READ OFF A PROBE painted `color:var(--agent)` rather than
 * spelled here — a test that hard-codes `#00866a` has restated the palette and
 * would go on passing after the token moved, which is the exact failure
 * frontend-bridge.test.ts §6 exists to catch one level up.
 */
const readAgentPaint = () => {
  const probe = document.createElement('span')
  probe.style.color = 'var(--agent)'
  probe.style.position = 'absolute'
  document.body.appendChild(probe)
  const agent = getComputedStyle(probe).color
  const deep = (() => { probe.style.color = 'var(--agent-deep)'; return getComputedStyle(probe).color })()
  probe.remove()
  const hits: string[] = []
  for (const el of document.querySelectorAll('.hu')) {
    const c = getComputedStyle(el).color
    if (c === agent || c === deep) hits.push(`${el.className}=${c}`)
  }
  return { agent, deep, hits }
}

/**
 * THE RING DETECTOR. Focuses every focusable element in document order and
 * reports whether the kernel's two-band ring survived on it.
 *
 * 🛑 IT KEYS ON GEOMETRY, NOT ON COLOUR, AND THAT IS DELIBERATE. The ring is
 * `0 0 0 2px #fff, 0 0 0 4px var(--ink)`; matching the hex would restate the
 * palette in a test file. Two zero-blur bands at 2px and 4px spread is a shape
 * nothing else in the kernel draws. The COLOUR half is proved separately, by
 * moving `--ink` and requiring the outer band to follow.
 *
 * ⚠️ AND IT COPIES EVERY VALUE OUT BEFORE THE NEXT focus() — see the live-object
 * trap in this file's header.
 */
const readRings = () => {
  const out: { label: string; ring: boolean; boxShadow: string; outline: string }[] = []
  const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
  for (const el of document.querySelectorAll(sel)) {
    ;(el as HTMLElement).focus()
    const cs = getComputedStyle(el)
    const bs = cs.boxShadow
    const outline = `${cs.outlineStyle} ${cs.outlineWidth}`
    const banded = /0px 0px 0px 2px/.test(bs) && /0px 0px 0px 4px/.test(bs)
    const outlined = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
    const own = typeof el.className === 'string' && el.className.trim() !== ''
      ? el.className.trim() : el.tagName.toLowerCase()
    out.push({ label: el.id || own, ring: banded || outlined, boxShadow: bs, outline })
  }
  return out
}

/** The count the LUMINOUS TOUCH block states: one light per view. */
const readLights = () => ({
  lights: [...document.querySelectorAll('.lit')].map((e) =>
    e.id || (typeof e.className === 'string' ? e.className.trim() : 'lit')),
  running: document.querySelectorAll('.lit--running').length,
})

/**
 * The built specimen, or a SENTENCE naming the property that went unwitnessed.
 * Never throws — a missing page must read as an unwitnessed PROPERTY, never as
 * an exception from `existsSync`.
 */
function specimen(property: string): string | { missing: string } {
  if (existsSync(SPECIMEN)) return SPECIMEN
  return { missing:
    `${property} is UNWITNESSED: no built specimen at frontend/dist/specimen.html. ` +
    'Run `npm run build:frontend`. If it is still absent, the frontend root has ' +
    'stopped emitting the page tests/design/ asserts against, and every property in ' +
    'this file is neither held nor refuted.' }
}

// ══════════════════════════════════════════════════════════════════════════
// §1 · THE DETECTORS, WITNESSED. Green at base. Nothing here needs the port.
// ══════════════════════════════════════════════════════════════════════════
describe('1 · the detectors catch what they are for', { skip }, () => {
  it('the LINE and DOT detectors catch a planted bar and a planted pip', async () => {
    const css = await sheet()
    const clean = await render(css, MARKS, readMarks)
    const planted = await render(css, MARKS + PLANTS, readMarks)

    assert.deepEqual(clean.lines, [],
      `the three marks alone drew a LINE: ${JSON.stringify(clean.lines)}. Only the meter ` +
      'may be a line, and the meter is not on this fixture.')
    assert.deepEqual(clean.dots, [],
      `the three marks alone drew a DOT: ${JSON.stringify(clean.dots)}. Only the ` +
      'connection light may be a dot, and it is not on this fixture.')

    assert.ok(planted.lines.includes('a-second-line'),
      'THE LINE DETECTOR IS BLIND. A 120x3 solid bar was planted and not reported: ' +
      `${JSON.stringify(planted.lines)}. Every "no second line" assertion below rests ` +
      'on this, and a detector trusted for finding nothing must first be shown to find ' +
      'something. The plant is an INLINE style precisely so it cannot compile to nothing.')
    assert.ok(planted.dots.includes('a-second-dot'),
      'THE DOT DETECTOR IS BLIND. An 8x8 border-radius:50% pip was planted and not ' +
      `reported: ${JSON.stringify(planted.dots)}.`)
  })

  it('the FALLOFF detector catches a flat fill AND a radial with no falloff', async () => {
    const css = await sheet()
    const clean = await render(css, MARKS, readFalloff)
    const planted = await render(css, MARKS + PLANTS, readFalloff)

    assert.deepEqual(Object.values(clean), ['source'],
      `the kernel's own \`.lit\` did not read as a SOURCE WITH FALLOFF: ` +
      `${JSON.stringify(clean)}. Nothing below this is worth reading — either the ` +
      'kernel stopped painting the light or the detector is wrong.')

    assert.equal(planted['flat-fill'], 'flat',
      'THE FALLOFF DETECTOR IS BLIND to a FLAT FILL. `.lit` was overridden with ' +
      '`linear-gradient(#00866a,#00866a)` and passed as a source. THE LUMINOUS TOUCH ' +
      'reads "A SOURCE WITH FALLOFF, never a fill" — a detector that cannot tell them ' +
      'apart is the whole rule going unenforced.')
    assert.equal(planted['no-falloff'], 'flat',
      'THE FALLOFF DETECTOR IS BLIND to the SNEAKIER intruder: a real radial-gradient ' +
      'with an OPAQUE outer stop. It is a source by shape and a fill by behaviour, and ' +
      'it is what a detector keyed on the string "radial-gradient" would wave through. ' +
      'The falloff is the property; the gradient function is a landmark.')
  })

  it('the AGENT detector catches a person marker painted --agent', async () => {
    const css = await sheet()
    const clean = await render(css, MARKS, readAgentPaint)
    const planted = await render(css, MARKS + PLANTS, readAgentPaint)

    assert.deepEqual(clean.hits, [],
      `the kernel's own \`.hu\` reads as agent-coloured: ${JSON.stringify(clean)}. It is ` +
      'declared `color:var(--ink)` and THE PERSON says "Ink, not agent green".')
    assert.ok(planted.hits.some((h) => h.includes('hu-green')),
      'THE AGENT DETECTOR IS BLIND. A `.hu` painted `var(--agent)` was planted and not ' +
      `reported: ${JSON.stringify(planted)}. THE AGENT RULE confines --agent to "a bar, ` +
      'a tick or a fill whose length or position states a NUMBER the machine produced", ' +
      'and it names four sites that reached for green anyway. A person is not a ' +
      'measurement and this is the fifth site.')
  })

  it('the RING detector catches an element whose own box-shadow replaces the ring', async () => {
    const css = await sheet()
    const seen = await render(css, MARKS + PLANTS, readRings)
    const by = (id: string) => seen.find((r) => r.label === id)

    const skipLink = seen.find((r) => r.label.includes('skip'))
    assert.ok(skipLink !== undefined, `no skip link in the fixture: ${JSON.stringify(seen)}`)
    assert.equal(skipLink.ring, true,
      `POSITIVE CONTROL FAILED: the kernel's own \`.skip\` shows no ring when focused ` +
      `(${JSON.stringify(skipLink)}). A ring detector that reports "no ring" everywhere ` +
      'catches nothing, and the negative below would pass for the wrong reason.')

    const eater = by('ring-eater')
    assert.ok(eater !== undefined, 'the planted ring-eater is not in the fixture')
    assert.equal(eater.ring, false,
      'THE RING DETECTOR IS BLIND. An element writing `outline:none` inline ' +
      'was planted and still read as ringed: ' +
      `${JSON.stringify(eater)}. ` +
      'box-shadow is NOT additive across rules — a later same-specificity rule REPLACES ' +
      'the ring, and `:focus-visible` has already set `outline:none`, so nothing is left. ' +
      'This is the erasability the kernel names against itself at the head of the file.')
  })

  it('the ONE LIGHT counter catches a second light in one view', async () => {
    const css = await sheet()
    const clean = await render(css, MARKS, readLights)
    const planted = await render(css, MARKS + PLANTS, readLights)
    assert.equal(clean.lights.length, 1,
      `the fixture's own light count is ${clean.lights.length}: ${JSON.stringify(clean)}`)
    /* THREE further lights are planted — `flat-fill`, `no-falloff` and
       `second-light` — so the fixture's one becomes four. The number is derived
       from PLANTS above; if a plant is added there this expectation moves with
       it, which is the only kind of hard-coded count worth having. */
    assert.equal(planted.lights.length, 4,
      'THE LIGHT COUNTER IS BLIND. Three further `.lit` elements were planted and the ' +
      `count read ${planted.lights.length}: ${JSON.stringify(planted)}. THE LUMINOUS ` +
      'TOUCH reads "never on more than one thing per view — one light is legible, six ' +
      'lights are wallpaper", and that is a COUNT, so something has to count it.')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// §2 · THE PERSON — `.hu`. Red until a person mark is on the built page.
// ══════════════════════════════════════════════════════════════════════════
describe('2 · the person mark', { skip }, () => {
  const P = 'THE PERSON — a person in the loop, named'

  it('the built page carries a person mark, and its whole content is a WORD', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () =>
      [...document.querySelectorAll('.hu')].map((e) => ({
        text: (e.textContent ?? '').replace(/\s+/g, ' ').trim(),
        bg: getComputedStyle(e).backgroundColor,
        img: getComputedStyle(e).backgroundImage,
        radius: getComputedStyle(e).borderRadius,
        before: getComputedStyle(e, '::before').content,
        after: getComputedStyle(e, '::after').content,
      })))
    assert.equal(seen.length, 1,
      `${P} is UNWITNESSED: the built page carries ${seen.length} \`.hu\` marks and the ` +
      'inventory requires exactly one. THE PERSON is the kernel mark for the exception — ' +
      '"the agent ran every row, so naming it says nothing; a PERSON in the loop is the ' +
      'exception, so that is what gets named" — and nothing on the page names one.')
    const hu = seen[0] as NonNullable<(typeof seen)[0]>
    assert.ok(hu.text.length > 0,
      'the person mark renders no text. It is the one mark that is ENTIRELY a word; ' +
      'an empty one is a decoration where an exception was supposed to be named.')
    assert.equal(hu.bg, 'rgba(0, 0, 0, 0)',
      `the person mark carries a background fill (${hu.bg}). It is ink text and nothing ` +
      'else — a filled chip is a badge, and a badge is a shape the kernel does not have.')
    assert.equal(hu.img, 'none',
      `the person mark paints a background image (${hu.img})`)
    assert.equal(hu.radius, '0px',
      `the person mark has radius ${hu.radius}. THE SQUARE CORNER RULE: the connection ` +
      'light and the mark are the only exceptions, and an avatar pip is neither — it is ' +
      'a SECOND DOT.')
    for (const [where, c] of [['::before', hu.before], ['::after', hu.after]] as const) {
      assert.equal(c, 'none',
        `the person mark draws a ${where} (content: ${c}). The kernel declares neither. ` +
        'A pseudo-element on this mark is where an avatar dot or a status pip arrives, ' +
        'and both are a seventh indicator.')
    }
  })

  it('it is INK, never the agent green — and it follows the kernel token', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const el = document.querySelector('.hu')
      if (el === null) return { missing: true as const }
      const probe = document.createElement('span')
      probe.style.cssText = 'position:absolute;color:var(--agent)'
      document.body.appendChild(probe)
      const agent = getComputedStyle(probe).color
      probe.style.color = 'var(--agent-deep)'
      const deep = getComputedStyle(probe).color
      probe.remove()
      const before = getComputedStyle(el).color
      /* THE BRIDGE HALF. Move the token and require the mark to follow. A port
         that spelled `#00303f` — or a Tailwind `text-ink` bound to a literal —
         passes every visual review and fails exactly here. */
      document.documentElement.style.setProperty('--ink', 'rgb(1, 2, 3)')
      return { missing: false as const, agent, deep, before, after: getComputedStyle(el).color }
    })
    if (seen.missing) assert.fail(`${P} is UNWITNESSED: no \`.hu\` on the built page`)
    assert.notEqual(seen.before, seen.agent,
      'the person mark is painted --agent. THE AGENT RULE: --agent means "the machine ' +
      'measured something" and nothing else, and a person in the loop is the opposite of ' +
      'a measurement. Four sites reached for green for jobs it may not do and all four ' +
      'were moved to --ink; this would be the fifth.')
    assert.notEqual(seen.before, seen.deep,
      'the person mark is painted --agent-deep, which is agent TEXT. Same rule.')
    assert.equal(seen.after, 'rgb(1, 2, 3)',
      `the person mark did not follow --ink (was ${seen.before}, now ${seen.after}). ` +
      'THE BRIDGE ASSERTION for this mark: a port that RESTATES the ink — as a literal, ' +
      'or as a Tailwind utility bound to a literal — holds its own copy of the palette ' +
      'and tokens.css has stopped being the single source of colour.')
  })

  it('it follows the kernel TYPE SCALE too — --s1, not 11px', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const el = document.querySelector('.hu')
      if (el === null) return { missing: true as const }
      const before = {
        size: getComputedStyle(el).fontSize,
        tracking: getComputedStyle(el).letterSpacing,
        transform: getComputedStyle(el).textTransform,
      }
      document.documentElement.style.setProperty('--s1', '37px')
      return { missing: false as const, before, after: getComputedStyle(el).fontSize }
    })
    if (seen.missing) assert.fail(`${P} is UNWITNESSED: no \`.hu\` on the built page`)
    assert.equal(seen.before.transform, 'uppercase',
      'the person mark is not uppercase. The kernel declares it, so a mark that is not ' +
      'has been given a competing rule by the port.')
    assert.notEqual(seen.before.tracking, 'normal',
      'the person mark carries no tracking. `.1em` at 11px is what makes an uppercase ' +
      'micro label readable at all.')
    assert.equal(seen.after, '37px',
      `the person mark did not follow --s1 (was ${seen.before.size}, now ${seen.after}). ` +
      'The kernel names its type sizes by JOB, not by size, for this reason.')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// §3 · THE SKIP LINK AND THE FOCUS RING. Red, and see the header: the `.lit`
//      arm of the last assertion needs a KERNEL answer, not only a component.
// ══════════════════════════════════════════════════════════════════════════
describe('3 · the skip link, and the ring it is the only witness for', { skip }, () => {
  const P = 'THE SKIP LINK and ONE FOCUS RING, everywhere'

  it('the built page carries a skip link, and it is the FIRST focusable thing', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
      const all = [...document.querySelectorAll(sel)]
      const skipEl = document.querySelector('.skip')
      const href = skipEl?.getAttribute('href') ?? ''
      return {
        count: all.length,
        firstIsSkip: all[0] !== undefined && all[0].classList.contains('skip'),
        first: all[0] === undefined ? '(none)' : (all[0].id || all[0].className.toString() || all[0].tagName),
        href,
        targetExists: href.startsWith('#') && href.length > 1
          ? document.getElementById(href.slice(1)) !== null : false,
      }
    })
    assert.ok(seen.count > 0,
      `${P} is UNWITNESSED: the built page has NO focusable element at all, so the ` +
      'focus ring — the kernel\'s one accessibility affordance, and the one open defect ' +
      'it names against itself — is measured by nothing anywhere in this repository.')
    assert.equal(seen.firstIsSkip, true,
      `the first focusable element is \`${seen.first}\`, not the skip link. A skip link ` +
      'that is not first is not a skip link: it skips whatever the user already tabbed ' +
      'through to reach it.')
    assert.equal(seen.targetExists, true,
      `the skip link points at \`${seen.href}\`, which resolves to no element on the ` +
      'page. A dead skip link passes every visual review and moves focus nowhere.')
  })

  it('at rest it is off-screen but STILL IN THE ACCESSIBILITY TREE', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const el = document.querySelector('.skip')
      if (el === null) return { missing: true as const }
      /* ⚠️ COPIED OUT IMMEDIATELY — getComputedStyle is a LIVE declaration and
         reading `rest.left` after focus() reports the FOCUSED value. */
      const c = getComputedStyle(el)
      const rest = { left: c.left, display: c.display, visibility: c.visibility,
                     radius: c.borderRadius }
      ;(el as HTMLElement).focus()
      const f = getComputedStyle(el)
      const focused = { left: f.left, top: f.top }
      return { missing: false as const, rest, focused }
    })
    if (seen.missing) assert.fail(`${P} is UNWITNESSED: no \`.skip\` on the built page`)
    assert.ok(parseFloat(seen.rest.left) < -1000,
      `the skip link rests at left:${seen.rest.left} — it is ON SCREEN. The kernel parks ` +
      'it at -9999px; a port that overrode that has put a permanent link in the corner ' +
      'of every page.')
    assert.notEqual(seen.rest.display, 'none',
      'the skip link is hidden with `display:none`, which takes it OUT OF THE ' +
      'ACCESSIBILITY TREE and out of the tab order — so the one control that exists only ' +
      'for keyboard users is unreachable by keyboard. The kernel hides it by POSITION for ' +
      'exactly this reason, and its TOOLTIP SURFACE block bans the same two mechanisms ' +
      'for the same reason: "A TOOLTIP MUST NEVER LEAVE THE ACCESSIBILITY TREE."')
    assert.notEqual(seen.rest.visibility, 'hidden',
      'the skip link is hidden with `visibility:hidden` — same failure as `display:none`')
    assert.equal(seen.rest.radius, '0px',
      `the skip link has radius ${seen.rest.radius}. THE SQUARE CORNER RULE; the ` +
      'connection light and the mark are the only two exceptions.')
    assert.ok(parseFloat(seen.focused.left) >= 0 && parseFloat(seen.focused.top) >= 0,
      `focused, the skip link is still off-screen at left:${seen.focused.left} ` +
      `top:${seen.focused.top}. \`.skip:focus\` brings it to 8px/8px; a port that ` +
      'reparented or re-positioned it has broken the only state it has.')
  })

  it('EVERY focusable element on the page shows the kernel ring — including the light', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readRings)
    assert.ok(seen.length > 0,
      `${P} is UNWITNESSED: nothing on the built page can take focus, so the ring is ` +
      'neither held nor refuted. The inventory requires a skip link AND a focusable ' +
      'light — see the header: the light is the case that decides this.')

    /* 🛑 THE PRECONDITION THAT ACTUALLY CLOSES ANSWER (b) — ADDED BY THE
       IMPLEMENTATION SLICE, 17 Aug 2026, AND FOUND BY MUTATION RATHER THAN BY
       READING. This file's header says answer (b) — "make the light inert" — is
       "closed off by the inventory", and IT WAS NOT: the inventory is prose, and
       no assertion required the light to be focusable. Measured, with the port in
       place: dropping `focusable` from the specimen's one light left ALL FIVE
       SUITES GREEN. The assertion below then ran over the skip link alone, the
       kernel defect went unwitnessed, and the whole question this section exists
       for could have been answered by deleting one word. That is §5.6 — a control
       passing while asserting nothing — inside the section written to refuse
       exactly that. Re-verified in both directions: RED with `focusable` dropped,
       green with it restored. */
    assert.ok(seen.some((r) => /(^|\s)lit(\s|$)/.test(r.label)),
      `${P} is HALF UNWITNESSED: nothing carrying \`.lit\` can take focus, so the ` +
      `assertion below runs over ${JSON.stringify(seen.map((r) => r.label))} and the ` +
      'one case it exists for is absent. The lit edge and the ring collide only on an ' +
      'element that has BOTH — a focusable light is the whole experiment, and passing ' +
      'by its absence is the shape this file was written to refuse.')

    const ringless = seen.filter((r) => !r.ring)
    assert.deepEqual(ringless, [],
      'a focusable element shows NO focus indicator: ' + JSON.stringify(ringless) + '. ' +
      '⚠️ THIS MESSAGE USED TO SAY THAT AN ELEMENT REPORTED HERE WAS "THE MEASURED ' +
      'KERNEL DEFECT AND NOT A MISTAKE IN THE PORT", because `.lit`\'s edge and the ' +
      'box-shadow ring were both (0,1,0) and the edge won. G240 closed that on ' +
      '22 Aug 2026: the ring is an `outline`, which no box-shadow can replace, and the ' +
      '`.lit:focus-visible` repair was deleted as unnecessary rather than kept. ' +
      'SO THE KERNEL IS NO LONGER THE LIKELY CAUSE. Look for a rule naming `outline` ' +
      'on a focused element — `grep -rn \'focus-visible\' design/ | grep outline` — and ' +
      'DELETE it; the kernel already rings every focusable element unaided.')
  })

  it('the ring follows --ink — it is the kernel\'s ring, not a restated one', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const el = document.querySelector('.skip')
      if (el === null) return { missing: true as const }
      ;(el as HTMLElement).focus()
      /* ⚠️ THIS READ `boxShadow` UNTIL 22 Aug 2026. G240 made the kernel ring an
         `outline`, so the box-shadow of a focused `.skip` is now `none` and this
         probe measured a property the ring no longer uses — it would have failed
         for the right reason and reported the wrong one. It reads the outline
         colour, which is where `--ink` now lands. */
      const before = getComputedStyle(el).outlineColor
      document.documentElement.style.setProperty('--ink', 'rgb(1, 2, 3)')
      return { missing: false as const, before, after: getComputedStyle(el).outlineColor }
    })
    if (seen.missing) assert.fail(`${P} is UNWITNESSED: no \`.skip\` on the built page`)
    assert.ok(seen.after.includes('rgb(1, 2, 3)'),
      `the focus ring did not follow --ink (was "${seen.before}", now "${seen.after}"). ` +
      'The ring is the kernel\'s, declared once for the whole system; a ring that holds ' +
      'its own colour is a second spelling of an indicator the kernel declares once. ' +
      '⚠️ THIS MESSAGE ENDED "its own header records six files already restating this ' +
      'one as an `outline`" — there were ELEVEN by 22 Aug 2026, and G240 deleted all of ' +
      'them and made the kernel ring an outline itself. THE PROPERTY THIS TEST GUARDS ' +
      'IS UNCHANGED and is now the only thing standing between the record and a twelfth.')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// §4 · THE LUMINOUS TOUCH — `.lit` / `.lit--running`.
// ══════════════════════════════════════════════════════════════════════════
describe('4 · the luminous touch', { skip }, () => {
  const P = 'THE LUMINOUS TOUCH — a source with falloff, never a flat fill'

  it('exactly ONE light, and it is running', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readLights)
    assert.equal(seen.lights.length, 1,
      `${seen.lights.length} lights on one view: ${JSON.stringify(seen.lights)}. ` +
      'THE LUMINOUS TOUCH: "never on more than one thing per view — one light is ' +
      'legible, six lights are wallpaper." This is a COUNT in the same register as ONE ' +
      'LINE and ONE DOT, and it is the count a component makes easy to break.')
    assert.equal(seen.running, 1,
      'the light is not running. `.lit--running` is the living edge — "light passing ' +
      'across a running job, not a spinner" — and a light that never sweeps passes the ' +
      'reduced-motion assertion below for the wrong reason.')
  })

  it('THE HARD CASE — it survives a background-IMAGE utility on its own element', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () =>
      [...document.querySelectorAll('.lit')].map((e) => ({
        classes: e.className.toString(),
        img: getComputedStyle(e).backgroundImage,
      })))
    const lit = seen[0]
    assert.ok(lit !== undefined, `${P} is UNWITNESSED: no \`.lit\` on the built page`)
    assert.ok(/\bbg-/.test(lit.classes),
      `${P} is UNWITNESSED against its own attacker: the light carries no background ` +
      `utility (classes: "${lit.classes}"). The kernel names this exposure itself — ` +
      '"THIS GUARDS .nb ONLY, AND THE SIBLING EXPOSURE IS REAL … both are erasable by ' +
      'the same local shorthand" — and it was a LIVE defect on 16 Aug 2026, three of ' +
      'nine `.lit` elements rendering with the light gone and looking ordinary. The ' +
      'inventory requires `bg-linear-to-r` on the light so the guard is witnessed rather ' +
      'than assumed. Unlike `.nb`, the count rule forbids four probes, so this one ' +
      'element is the whole matrix on the page; the rest is at engine level in §1.')
    assert.notEqual(lit.img, 'none',
      `the light was ERASED by the background utility on its own element (classes: ` +
      `"${lit.classes}"). This is the hatch\'s failure one class over: \`.lit.lit\` is a ` +
      'SPECIFICITY defence at (0,2,0) and cascade layers are resolved BEFORE specificity, ' +
      'so a (0,1,0) utility in `@layer utilities` beats it the moment the kernel sits in ' +
      'a layer. The panel goes on looking worked-on with the light gone.')
  })

  it('it is a SOURCE WITH FALLOFF, never a flat fill', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readFalloff)
    const verdicts = Object.entries(seen)
    assert.ok(verdicts.length > 0, `${P} is UNWITNESSED: no \`.lit\` on the built page`)
    for (const [key, verdict] of verdicts) {
      assert.equal(verdict, 'source',
        `the light \`${key}\` reads as "${verdict}". THE LUMINOUS TOUCH: "AI has shone ` +
        'light on an object. A SOURCE WITH FALLOFF, never a fill." A flat fill and a ' +
        'source are four characters apart in a gradient and a whole idea apart on the ' +
        'page — and a radial-gradient with an OPAQUE outer stop is a fill wearing a ' +
        'source\'s shape, which §1 plants and this detector is proved to catch.')
    }
  })

  it('the SWEEP is its own layer — the light and the pass are two paints', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const el = document.querySelector('.lit--running')
      if (el === null) return { missing: true as const }
      const a = getComputedStyle(el, '::after')
      return { missing: false as const, base: getComputedStyle(el).backgroundImage,
               sweep: a.backgroundImage, animation: a.animationName, content: a.content }
    })
    if (seen.missing) assert.fail(`${P} is UNWITNESSED: no \`.lit--running\` on the page`)
    assert.notEqual(seen.content, 'none',
      'the running light draws no ::after, so there is no sweep at all')
    assert.ok(seen.sweep.startsWith('linear-gradient'),
      `the sweep is not its own linear pass (::after background-image: ${seen.sweep}). ` +
      'The kernel keeps them separate — ".lit carries what is not a background, .lit.lit ' +
      'carries the paint" and the sweep is its own layer — so that guarding one cannot ' +
      'mean restating the other.')
    assert.ok(seen.base.startsWith('radial-gradient'),
      `the base light is not a radial source (${seen.base}) — the sweep has replaced it ` +
      'rather than run across it')
    assert.equal(seen.animation, 'sweep',
      `the living edge is not animated (animation-name: ${seen.animation}). "One slow ` +
      'pass per 17s with 88% of the cycle at rest. Do not speed it up."')
  })

  it('reduced motion stops the SWEEP and leaves the LIGHT standing', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const el = document.querySelector('.lit--running')
      if (el === null) return { missing: true as const }
      const a = getComputedStyle(el, '::after')
      return {
        missing: false as const,
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        sweepDisplay: a.display,
        base: getComputedStyle(el).backgroundImage,
        edge: getComputedStyle(el).boxShadow,
      }
    }, 'reduce')
    if (seen.missing) assert.fail(`${P} is UNWITNESSED: no \`.lit--running\` on the page`)
    assert.equal(seen.matches, true, 'reduced motion was not emulated at all')
    assert.equal(seen.sweepDisplay, 'none',
      `the sweep still paints under prefers-reduced-motion (display: ${seen.sweepDisplay}). ` +
      'Note that `*` alone does not match pseudo-elements and BOTH of this system\'s ' +
      'animations run on one — a guard written `*{}` looks complete and stops neither.')
    assert.ok(seen.base.startsWith('radial-gradient'),
      `under reduced motion the LIGHT ITSELF went out (${seen.base}). The kernel records ` +
      'that the sweep had once been stopped three ways — "display:none · ' +
      'translateX+opacity · background:none" — and the third takes the light with it. ' +
      'Reduced motion means stop MOVING, not stop TELLING; the machine is still working ' +
      'on this and the user has only asked for stillness.')
  })

  it('the light follows the kernel tokens — --lit-hot and --lit-out', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const el = document.querySelector('.lit')
      if (el === null) return { missing: true as const }
      const before = getComputedStyle(el).backgroundImage
      document.documentElement.style.setProperty('--lit-hot', 'rgb(1, 2, 3)')
      document.documentElement.style.setProperty('--lit-out', 'rgba(4, 5, 6, 0)')
      return { missing: false as const, before, after: getComputedStyle(el).backgroundImage }
    })
    if (seen.missing) assert.fail(`${P} is UNWITNESSED: no \`.lit\` on the built page`)
    assert.ok(seen.after.includes('rgb(1, 2, 3)'),
      `the light did not follow --lit-hot (was "${seen.before}", now "${seen.after}"). ` +
      'THE BRIDGE ASSERTION for this mark: a port that spelled the radial-gradient for ' +
      'itself — the obvious thing to do with a gradient a utility framework cannot ' +
      'express — holds its own copy of the light and tokens.css has stopped being the ' +
      'single source of it.')
    assert.ok(seen.after.includes('rgba(4, 5, 6, 0)'),
      `the falloff did not follow --lit-out (now "${seen.after}"). The outermost stop is ` +
      'the falloff; a port that kept the hot centre from the token and hard-coded the ' +
      'transparent end has restated exactly the half this rule is about.')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// §5 · THE COUNT, ACROSS THE BRIDGE. Three marks added, no seventh indicator.
// ══════════════════════════════════════════════════════════════════════════
describe('5 · the three new marks add no line and no dot', { skip }, () => {
  const P = 'THE SIX INDICATORS — no second line, no second dot'

  it('the ported marks are on the page AND the count is unmoved', async () => {
    const page = specimen(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
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
          const fill = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
          const mark = fill || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0
          if (fill && h > 0 && h <= 4 && w > h * 3) lines.push(name(el, p))
          const r = cs.borderRadius
          if (mark && w > 0 && w <= 20 && (r.includes('50%') || parseFloat(r) >= w / 2)) dots.push(name(el, p))
        }
      }
      return {
        lines, dots,
        present: { hu: document.querySelectorAll('.hu').length,
                   skip: document.querySelectorAll('.skip').length,
                   lit: document.querySelectorAll('.lit').length },
      }
    })

    /* THE PRECONDITION IS THE WHOLE POINT. A count assertion over a page that
       does not carry the marks is a check that passes while asserting nothing —
       it would stay green through the entire port and go red only if someone
       later added a bar. Requiring the marks first is what makes the count mean
       "these three added nothing" rather than "nothing was added". */
    assert.deepEqual(seen.present, { hu: 1, skip: 1, lit: 1 },
      `${P} is UNWITNESSED: the built page carries ${JSON.stringify(seen.present)} and ` +
      'the inventory requires one of each. Counting lines and dots on a page without the ' +
      'new marks proves nothing about the new marks.')

    for (const l of seen.lines) {
      assert.ok(l.startsWith('meter'),
        `a second LINE arrived with the new marks: ${l} (all: ${JSON.stringify(seen.lines)}). ` +
        'The skip link is a filled block and the light is a painted surface; either ' +
        'becomes a line the moment it is 4px tall and wide. A progress bar is a second ' +
        'line, and one was built here before and removed.')
    }
    for (const d of seen.dots) {
      assert.ok(d.startsWith('conn'),
        `a second DOT arrived with the new marks: ${d} (all: ${JSON.stringify(seen.dots)}). ` +
        'The person mark is where an avatar pip arrives and `rounded-full` survives the ' +
        'bridge\'s radius fence — it is a STATIC utility with no theme variable to clear, ' +
        'and bridge.css says so. An unread dot is a second dot.')
    }
    assert.equal(seen.lines.length, 2,
      `expected exactly the meter's track and fill and saw ${JSON.stringify(seen.lines)}`)
    assert.equal(seen.dots.length, 4,
      'expected two connection lights, each a dot plus its halo, and saw ' +
      JSON.stringify(seen.dots))
  })
})

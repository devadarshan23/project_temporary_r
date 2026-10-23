/**
 * THE NAVIGATION SHELL — RED, and red about the SHELL rather than about a
 * missing import.
 *
 * 🛑 A FRONTEND SLICE IS PRONE TO A TEST THAT FAILS ONLY BECAUSE A MODULE IS
 * MISSING, WHICH IS RED AGAINST A TYPO. The three answers frontend-bridge.test.ts
 * gives are the three answers here, and the third is the one that makes the split
 * measurable:
 *
 *   1. The seam is resolved with `existsSync` and read as a FILE. Nothing in this
 *      file imports frontend code, so `npm run typecheck:tests` is GREEN at base
 *      and no assertion here can fail as a compile error.
 *   2. EVERY DETECTOR IN THIS FILE HAS A BASE CONTROL THAT PASSES TODAY. The nav
 *      classifier, the sidebar detector, the tile-dashboard detector and the
 *      line/dot detectors are each run against a synthetic fixture WITH THE
 *      ATTACKER PLANTED, and each is required to catch it. Those controls need no
 *      seam and are green at base — so a failure on the shell says *"the shell
 *      does not hold property P"* and never *"property P cannot be measured"*.
 *   3. A detector is asserted in BOTH directions where a false positive would be
 *      as bad as a miss: the clean fixture must classify as clean.
 *
 * ✅ WITNESSED IN BOTH DIRECTIONS AGAINST A THROWAWAY PAGE, 16 Aug 2026, and
 * NEITHER PAGE IS COMMITTED. A deliberately WRONG `frontend/dist/shell.html` was
 * planted — four destinations with Setup among them, active drawn with
 * `border-left`, a 220px sidebar, three summary tiles, rows reading "no
 * findings", a painted second line and second dot, and a `.nb` naming no
 * decision — and every failure MOVED from "no built shell" to the behavioural
 * message: 8 base controls green, 9 seam assertions red, each on its own
 * property. A plausibly CORRECT page then took all 18 green. So every assertion
 * here is both falsifiable and satisfiable, which is the pair that separates a
 * red test from a red typo.
 *
 * 🛑 AND THE WRONG PAGE CAUGHT A DEFECT IN THIS FILE'S OWN NEGATIVE CONTROL —
 * see `plantIndicators` below. The first trial planted its second line and
 * second dot as Tailwind utilities, the ONE LINE / ONE DOT assertion PASSED with
 * both on the page, and the reason is that the shipped utility surface is a
 * declared list rather than a scan. The control now paints inline.
 *
 * THE ONE SEAM THIS PASS DECLARES AND DOES NOT BUILD:
 *
 *   frontend/dist/shell.html   a BUILT, self-contained page carrying the
 *                              navigation shell and the chrome bar around a
 *                              REGISTER, with its real stylesheet attached, in
 *                              the same way frontend/dist/specimen.html already
 *                              carries the three primitives. Loaded over
 *                              `file://`, so what is asserted is what SHIPS.
 *
 * It must contain, at minimum:
 *   · ONE primary navigation landmark holding EXACTLY the three destinations —
 *     Close, Ask, Reports — with the current one carrying `aria-current="page"`
 *   · a `Setup` control that is NOT one of them (it is a DOOR, from the account
 *     menu — Navigation.dc.html:459)
 *   · the chrome bar's ONE connection light and ONE token meter
 *   · a register whose rows each carry `data-run="<runId>"`
 *   · at least one `.nb` mark naming the G decision that refused the control it
 *     stands for
 *
 * 🛑 WHY `data-run` AND NOT A CLASS OR A `<table>`. Every other way of finding
 * the rows is a rule keyed on a convenient LANDMARK instead of on the property it
 * protects — docs/HANDOFF.md §5, the defect shape this repository keeps catching
 * in its own controls. A class name is a styling decision and may change for
 * styling reasons; `<table>` forbids a layout that is not a table. `data-run`
 * states the row's SUBJECT, which is the thing the assertions below are actually
 * about, and it is the same kind of attribute as the `data-nb` and `data-state`
 * the kernel already reads. It is markup this file requires; it is not a test
 * hook, because a row that does not know which run it is showing is a defect
 * whatever this file asserts.
 *
 * ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT ASSERT, so nobody reads the absences as
 * coverage:
 *
 *   · "INSIDE SETUP, NO DESTINATION IS UNDERLINED" (Navigation.dc.html:386-398).
 *     That is a SECOND PAGE STATE and the built specimen is one page — the
 *     register at Close. What is asserted instead is the MECHANISM that reduces
 *     it to a one-line property: the underline is driven by `aria-current="page"`
 *     ALONE, so a destination without it is never underlined, and "inside Setup
 *     nothing is underlined" becomes "the Setup route sets no `aria-current`".
 *     The rule itself is UNWITNESSED and this sentence is the record of that.
 *   · THAT THE BUILT PAGE'S ROWS CAME FROM THE PLANE. The page is pre-rendered,
 *     so its rows are illustrative — PRODUCT.md, and Specimen.tsx says the same
 *     of its own figures. The reading half is witnessed in
 *     tests/http/register-consumes-runs.test.ts against a real data plane, real
 *     RLS and a real session; the drawing half is witnessed here. THE TWO HALVES
 *     MEET AT THE `Run` WIRE SHAPE AND NOWHERE ELSE, and no assertion in this
 *     repository joins them end to end. Assertion 5 below is what stops the
 *     illustrative half from drifting into fabrication: the register may only
 *     draw a completeness reading the plane can actually serve.
 *   · Not a route beyond the register, not an operation, not a capability, not a
 *     G row. G200 freezes serving at four operations and this pass mints nothing.
 */

import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  browserSkip,
  closeBrowser,
  compose,
  kernel,
  REPO,
  render,
  renderFile,
  tailwind,
} from './render.ts'

import { browserRequiredUnderCi } from '../reachability.ts'

const skip = await browserSkip()

browserRequiredUnderCi('the shell render assertions and their base controls', skip)

after(async () => { await closeBrowser() })

/**
 * THE SEAM. Beside `frontend/dist/specimen.html` and built by the same step, for
 * the reason render.ts gives at length: a page this test COMPILED FOR ITSELF
 * would be an approximation of the shipped build, and cascade order — the one
 * property the bridge turns on — is what an approximated build is likeliest to
 * get differently.
 */
const SHELL = join(REPO, 'frontend', 'dist', 'shell.html')

/** Nothing to prepare, for the assertions that add no markup. */
const NOTHING = (): void => {}

/**
 * The built shell, or a SENTENCE naming the property that went unwitnessed.
 * Never throws — an `ERR_MODULE_NOT_FOUND`-shaped failure says a file is missing
 * and says nothing about the shell.
 */
function shell(property: string): string | { missing: string } {
  if (existsSync(SHELL)) return SHELL
  return { missing:
    `${property} is UNWITNESSED: no built shell at frontend/dist/shell.html. ` +
    'The frontend root must emit one self-contained page carrying the navigation ' +
    'shell and the chrome bar around a register whose rows carry `data-run`, with ' +
    'its real stylesheet attached — the same shape frontend/dist/specimen.html ' +
    'already takes for the three primitives. Every detector this file uses is ' +
    'witnessed CATCHING its attacker in the base controls below, so the property ' +
    'is measurable; until the page exists it is neither held nor refuted.' }
}

/* ────────────────────────────────────────────────────────────────────────────
   THE DETECTORS.

   ⚠️ EACH ONE IS CLOSURE-FREE AND RETURNS DATA, NEVER A VERDICT. render.ts
   serialises these to source and re-parses them in the page, so they may not
   close over anything in this module — and keeping the JUDGEMENT in node is what
   lets one detector serve both a base control and a shell assertion without the
   two drifting apart.
   ──────────────────────────────────────────────────────────────────────────── */

interface DestinationView {
  readonly id: string
  readonly text: string
  readonly current: string | null
  /** An inset box-shadow with zero x-offset and a NEGATIVE y-offset. */
  readonly underline: boolean
  /** A left border, OR an inset box-shadow with a positive x-offset and no y. */
  readonly leftRule: boolean
  readonly textDecoration: string
  readonly boxShadow: string
}

/**
 * THE THREE DESTINATIONS, AND HOW ACTIVE IS DRAWN.
 *
 * ⚠️ THE BREADCRUMB IS EXCLUDED BY SHAPE, NOT BY NAME. The trail is a `nav` too
 * (Navigation.dc.html:147 — it is the way OUT as well as the trail), so a naive
 * "every link in every nav" would count four, five or six destinations on any
 * page deeper than a destination and the assertion would fail for a reason that
 * is not a defect. A breadcrumb is an ORDERED list or says so in its label.
 */
const readDestinations = (): readonly DestinationView[] => {
  const lengths = (part: string): number[] =>
    [...part.matchAll(/(-?[\d.]+)px/g)].map((m) => parseFloat(m[1] as string))
  const parts = (bs: string): string[] =>
    bs === 'none' || bs === '' ? [] : bs.split(/,(?![^(]*\))/)

  const isBreadcrumb = (n: Element): boolean =>
    /breadcrumb|trail/i.test(n.getAttribute('aria-label') ?? '') || n.querySelector('ol') !== null

  const navs = [...document.querySelectorAll('nav, [role="navigation"]')]
    .filter((n) => !isBreadcrumb(n))

  const out: DestinationView[] = []
  const seen = new Set<Element>()
  for (const nav of navs) {
    for (const a of nav.querySelectorAll('a, [role="link"]')) {
      if (seen.has(a)) continue
      seen.add(a)
      const cs = getComputedStyle(a)
      let underline = false
      let leftRule = parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== 'none'
      for (const part of parts(cs.boxShadow)) {
        if (!part.includes('inset')) continue
        const l = lengths(part)
        const x = l[0] ?? 0
        const y = l[1] ?? 0
        if (x === 0 && y < 0) underline = true
        if (x > 0 && y === 0) leftRule = true
      }
      out.push({
        id: a.id,
        text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
        current: a.getAttribute('aria-current'),
        underline,
        leftRule,
        textDecoration: cs.textDecorationLine,
        boxShadow: cs.boxShadow,
      })
    }
  }
  return out
}

/** Every control on the page whose visible text is exactly "Setup", and where it sits. */
const readSetup = (): readonly { readonly inNav: boolean; readonly tag: string }[] => {
  const out: { inNav: boolean; tag: string }[] = []
  for (const el of document.querySelectorAll('a, button, [role="link"], [role="menuitem"]')) {
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!/^setup$/i.test(t)) continue
    const nav = el.closest('nav, [role="navigation"]')
    const inNav = nav !== null &&
      !(/breadcrumb|trail/i.test(nav.getAttribute('aria-label') ?? '') || nav.querySelector('ol') !== null)
    out.push({ inNav, tag: el.tagName.toLowerCase() })
  }
  return out
}

interface LayoutView {
  readonly hasRegister: boolean
  readonly rowCount: number
  /** Tall, narrow, link-bearing columns pinned to the left half of the viewport. */
  readonly sidebars: readonly string[]
  /** Rows of three or more boxed, numeric siblings sitting ABOVE the register. */
  readonly tileRows: readonly string[]
}

/**
 * THE TWO THINGS KEPT OUT ON PURPOSE — Navigation.dc.html:462-463, and both are
 * argued out on the record rather than merely unbuilt. They are detected by
 * SHAPE, because a rule keyed on `class="sidebar"` catches only the version
 * somebody was honest enough to name.
 *
 *   A SIDEBAR is a column of navigation: two or more links or buttons, at least
 *   200px tall, no wider than 45% of the viewport, entirely within its left half.
 *   That is the thing the record costs at "220px of the register width
 *   permanently"; a three-item bar is not tall.
 *
 *   A SUMMARY-TILE DASHBOARD is three or more boxed siblings, each at least
 *   80×48, sharing a parent and a top edge, entirely above the register. The
 *   record's own example is a tile reading "5 exceptions"; the size floor is what
 *   keeps the nine chrome controls — which are 28px tall — out of the count.
 *
 * ┌─ 🛑 BOTH FLOORS ARE HOLES, AND BOTH ARE MEASURED RATHER THAN ASSERTED ─────┐
 * │ A floor is a number below which the detector is blind, so a floor nobody    │
 * │ has walked under is a floor nobody knows the size of. The base controls     │
 * │ headed "THE PRICE OF …" walk under each of them deliberately, the same way  │
 * │ the `role="separator"` hole is priced.                                     │
 * │                                                                            │
 * │ ⚠️ THE TILE DETECTOR ALSO REQUIRED A DIGIT AND NO LONGER DOES. Measured:    │
 * │ three 160×80 boxed siblings reading "Five exceptions / Twelve runs closed / │
 * │ Three awaiting review" left the suite 20/20 GREEN, and the identical tiles  │
 * │ WITH digits turned it red. A digit is a landmark; a boxed row of siblings   │
 * │ above the register is the property — docs/HANDOFF.md §5, in the detector    │
 * │ rather than in the product. Removing it was witnessed not to fire on the    │
 * │ clean shell, which is the risk a landmark is usually protecting against.    │
 * │                                                                            │
 * │ ⚠️ THE SIDEBAR FLOOR WAS 240 AND IS NOW 200, WHICH IS AS LOW AS IT GOES.    │
 * │ Measured: at 120 the built page's own account MENU — `.menu`, 102×183 with  │
 * │ four links — is read as a sidebar, and a detector that calls a menu a       │
 * │ sidebar is one somebody silences. 200 clears it by 17px. The residual hole  │
 * │ is a navigation column under 200px tall and it is priced below.             │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
const readLayout = (): LayoutView => {
  const vw = document.documentElement.clientWidth
  const rows = [...document.querySelectorAll('[data-run]')]

  let register: Element | null = rows[0] ?? null
  for (;;) {
    if (register === null) break
    const here = register
    if (rows.every((r) => here.contains(r))) break
    register = register.parentElement
  }
  const regTop = register === null ? null : register.getBoundingClientRect().top

  const label = (e: Element): string => {
    if (e.id !== '') return `#${e.id}`
    const own = typeof e.className === 'string' ? e.className.trim() : ''
    return own === '' ? e.tagName.toLowerCase() : `.${own.split(/\s+/)[0] as string}`
  }

  const sidebars: string[] = []
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    const links = el.querySelectorAll('a, button, [role="link"]').length
    if (links < 2) continue
    /* 200, not 240, and not lower: the account menu measures 102×183 on the
       built page and a floor beneath that reads it as a sidebar. See the header. */
    if (r.height < 200) continue
    if (r.width <= 0 || r.width > vw * 0.45) continue
    if (r.right > vw * 0.5) continue
    sidebars.push(`${label(el)} ${Math.round(r.width)}×${Math.round(r.height)} with ${links} links`)
  }

  const tileRows: string[] = []
  if (regTop !== null) {
    const byParent = new Map<Element, Element[]>()
    for (const el of document.querySelectorAll('*')) {
      const p = el.parentElement
      if (p === null) continue
      const r = el.getBoundingClientRect()
      if (r.bottom > regTop) continue
      if (r.width < 80 || r.height < 48) continue
      /* NO DIGIT REQUIREMENT. "Five exceptions" is the same tile as "5
         exceptions" and the detector used to see only the second. See the header. */
      const cs = getComputedStyle(el)
      const boxed = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        cs.backgroundImage !== 'none' ||
        cs.boxShadow !== 'none' ||
        parseFloat(cs.borderTopWidth) > 0
      if (!boxed) continue
      const list = byParent.get(p) ?? []
      list.push(el)
      byParent.set(p, list)
    }
    for (const [p, kids] of byParent) {
      const byTop = new Map<number, number>()
      for (const k of kids) {
        const t = Math.round(k.getBoundingClientRect().top / 4) * 4
        byTop.set(t, (byTop.get(t) ?? 0) + 1)
      }
      for (const [t, n] of byTop) {
        if (n >= 3) tileRows.push(`${label(p)} → ${n} boxed numeric tiles sharing y=${t}`)
      }
    }
  }

  return { hasRegister: register !== null, rowCount: rows.length, sidebars, tileRows }
}

/**
 * THE SIX INDICATORS — ONE LINE and ONE DOT, counted the way
 * kernel-under-tailwind.test.ts counts them, with one addition argued below.
 *
 * 🛑 THE SEPARATOR EXCLUSION IS A NAMED HOLE, NOT AN OVERSIGHT. `.menu .sep` in
 * design/system/shell.html is a 1px filled element and the unmodified detector
 * counts it as a LINE — so an account menu drawn open would make this assertion
 * unpassable by a correct design. Furniture that divides is not an indicator that
 * measures. The exclusion is keyed on `role="separator"` and `<hr>`, which is the
 * ARIA the divider should carry anyway; the cost is that a second line is one
 * `role="separator"` away from invisible, and the base control below is what
 * keeps that from being free — the planted intruder carries no such role and is
 * still required to be caught.
 *
 * ┌─ 🛑 THE HEIGHT CEILING IS THE SECOND HOLE AND IT WAS UNDECLARED ───────────┐
 * │ `h <= 4` was inherited from kernel-under-tailwind.test.ts and named         │
 * │ nowhere. Measured: a 120×3 painted bar appended to the chrome bar turns     │
 * │ this suite RED, and **the same bar at 120×6 leaves it 20/20 GREEN** — while │
 * │ the assertion's own message names the defect it was missing, "A loading bar │
 * │ is a second line". 6px is an ordinary progress-bar height, so the hole was  │
 * │ wider than the `role="separator"` one it sits beside and priced nowhere.    │
 * │                                                                            │
 * │ THE CEILING IS NOW 12. The kernel's meter bar is 3px (tokens.css:807), so   │
 * │ the product has 9px of headroom it does not use; witnessed not to fire on   │
 * │ the built page. ⚠️ A CEILING IS STILL A HOLE — a 16px painted bar is        │
 * │ invisible to this count, which is measured by "THE PRICE OF THE HEIGHT      │
 * │ CEILING" below rather than left for the next review to find. Raising it     │
 * │ further is not free: past a certain height a filled block is a PANEL and a  │
 * │ detector that calls panels lines reports a correct page as broken.          │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
const readMarks = (): { readonly lines: readonly string[]; readonly dots: readonly string[] } => {
  const lines: string[] = []
  const dots: string[] = []
  const name = (e: Element, p: string): string => {
    if (e.id) return e.id + p
    const own = typeof e.className === 'string' ? e.className.trim().split(/\s+/)[0] : ''
    if (own) return own + p
    const anc = e.parentElement?.closest('[class]')
    const pre = anc && typeof anc.className === 'string'
      ? `${anc.className.trim().split(/\s+/)[0] as string} ` : ''
    return pre + e.tagName.toLowerCase() + p
  }
  for (const el of document.querySelectorAll('*')) {
    const divider = el.tagName === 'HR' || el.getAttribute('role') === 'separator'
    for (const p of ['', '::before', '::after']) {
      const cs = getComputedStyle(el, p || undefined)
      if (p && cs.content === 'none') continue
      const w = parseFloat(cs.width), h = parseFloat(cs.height)
      if (!isFinite(w) || !isFinite(h)) continue
      const fill = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
      const mark = fill || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0
      if (!divider && fill && h > 0 && h <= 12 && w > h * 3) lines.push(name(el, p))
      const r = cs.borderRadius
      if (mark && w > 0 && w <= 20 && (r.includes('50%') || parseFloat(r) >= w / 2)) dots.push(name(el, p))
    }
  }
  return { lines, dots }
}

/**
 * EVERY ELEMENT WEARING THE EXCLUSION — the price of the separator hole, BOUNDED.
 *
 * 🛑 `role="separator"` IS NOW LOAD-BEARING AND THIS SLICE IS THE FIRST TO USE
 * IT. `readMarks` excludes it so a 1px menu divider is not counted as an
 * indicator — furniture that DIVIDES is not an indicator that MEASURES — and the
 * base control prices that hole by proving a painted bar wearing the attribute is
 * invisible to the count. What the base control cannot do is stop the hole from
 * WIDENING: `ChromeBar` ships two such elements today, and a future
 * divider-shaped indicator, or anyone reaching for the attribute to quiet the
 * detector, is one attribute away from invisible.
 *
 * So the exclusion is BOUNDED BY COUNT. The number is asserted exactly; a third
 * separator fails this file and has to be argued for, which is the cost of
 * keeping the exclusion honest. ⚠️ THIS DOES NOT CLOSE THE HOLE — nothing here
 * can, short of deciding what a divider IS — and "bounded" rather than "closed"
 * is the accurate claim to make about it.
 */
const readSeparators = (): readonly string[] =>
  [...document.querySelectorAll('[role="separator"], hr')].map((e) => {
    const r = e.getBoundingClientRect()
    const cls = typeof e.className === 'string' && e.className.trim() !== ''
      ? `.${e.className.trim().split(/\s+/)[0] as string}` : ''
    return `${e.tagName.toLowerCase()}${cls} ${Math.round(r.width)}×${Math.round(r.height)}`
  })

/**
 * One register row, as a reader meets it — AND ITS COMPLETENESS CELL ON ITS OWN.
 *
 * 🛑 `text` ALONE IS NOT ENOUGH TO ASSERT ANYTHING ABOUT COMPLETENESS, AND THIS
 * FILE LEARNED THAT THE EXPENSIVE WAY. The row-level scan below used to be the
 * whole of assertion 5, and it was VACUOUS: `ABSENT_ACCOUNT` includes
 * `\bnot recorded\b`, which the EXCEPTIONS column emits independently for every
 * row (`exceptionsWord(null)`). Blanking the completeness word entirely left the
 * built page drawing an EMPTY completeness cell — `grep -c 'no engine account'
 * frontend/dist/shell.html` → 0 — while the suite reported 18/18 green. The
 * assertion was held up by a different column.
 *
 * That is docs/HANDOFF.md §5, "a rule keyed on a convenient landmark instead of
 * the property it protects", arriving inside a control written to prevent it —
 * and it is the SECOND time this file has caught that shape in itself (see
 * `plantIndicators`). The repair is to read the cell the property lives in:
 * `account` is that cell's own text, and `completeness` is the answer NAMED by
 * `data-completeness` rather than inferred from prose. The row-level `text`
 * survives as a second, weaker net — a clean-close phrase anywhere in the row is
 * still worth failing on.
 */
const readRows = (): readonly {
  readonly id: string
  readonly text: string
  readonly account: string | null
  readonly completeness: string | null
}[] =>
  [...document.querySelectorAll('[data-run]')].map((r) => {
    const cell = r.querySelector('[data-completeness]')
    return {
      id: r.getAttribute('data-run') ?? '',
      text: (r.textContent ?? '').replace(/\s+/g, ' ').trim(),
      account: cell === null ? null : (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
      completeness: cell === null ? null : cell.getAttribute('data-completeness'),
    }
  })

/*
 * ⛔ `readNotBuilt` AND `wearBgNone` — the reader of every `.nb` on the shell and
 * the `bg-none` attacker planted on each — STOOD HERE UNTIL 2 Oct 2026 AND ARE
 * DELETED WITH §7's OLD FORM (G3091, THE OWNER'S): the shell carries no hatch to
 * read or attack. The attacker's argument — `bg-none` writes background-IMAGE and
 * is the one utility that reaches the hatch; `bg-white` writes COLOR and never
 * does — is unchanged and is still MEASURED on the specimen, by
 * `frontend-bridge.test.ts` §1 and `kernel-under-tailwind.test.ts`.
 */

/**
 * A SECOND LINE AND A SECOND DOT, PLANTED INTO THE BUILT PAGE ITSELF.
 *
 * 🛑 THEY ARE PAINTED WITH AN INLINE STYLE AND NOT WITH A TAILWIND CLASS, AND
 * THAT IS A MEASURED CORRECTION RATHER THAN A PREFERENCE. The first version of
 * this planted `class="bg-[#00303f] w-1/2"` — the exact intruders
 * kernel-under-tailwind.test.ts uses — and the count came back 2 and 2 WITH BOTH
 * INTRUDERS ON THE PAGE. The built app's utility surface is a DECLARED LIST
 * (`frontend/src/bridge.css`, `@source inline(…)`), not a scan, so
 * `bg-[#00303f]` compiles to nothing there: the intruders existed, were never
 * PAINTED, and the detector was right to see no marks. That is
 * docs/HANDOFF.md §5.6 arriving inside the negative control written to prevent
 * it, and it is the second time this repository has recorded that exact shape at
 * this exact site — the note in kernel-under-tailwind.test.ts records the first.
 *
 * An inline `background-color` depends on no theme, no fence and no list, so the
 * control measures the DETECTOR rather than the utility surface.
 */
const plantIndicators = (): void => {
  const line = document.createElement('div')
  line.id = 'planted-line'
  line.setAttribute('style', 'width:120px;height:3px;background-color:#00303f')
  document.body.appendChild(line)
  const dot = document.createElement('div')
  dot.id = 'planted-dot'
  dot.setAttribute('style', 'width:7px;height:7px;border-radius:50%;background-color:#00303f')
  document.body.appendChild(dot)
}

/* ────────────────────────────────────────────────────────────────────────────
   THE BASE CONTROLS. Green today, on the composed sheet the bridge actually
   ships — Tailwind first, the kernel UNLAYERED after it (bridge.css §1).
   ──────────────────────────────────────────────────────────────────────────── */

async function bridgeSheet(): Promise<string> {
  return compose(await tailwind(), await kernel(), 'unlayered')
}

/** A shell shaped the way the record says it must be. Nothing here is an attacker. */
const CLEAN = `
<nav aria-label="destinations">
  <a id="d-close" href="#" aria-current="page" style="box-shadow:inset 0 -2px 0 #00303f">Close</a>
  <a id="d-ask" href="#">Ask</a>
  <a id="d-reports" href="#">Reports</a>
</nav>
<div id="register">
  <div data-run="run_a">run a · completed</div>
  <div data-run="run_b">run b · incomplete</div>
</div>
`

/** Active drawn two forbidden ways — a left border, and a left rule faked with an inset shadow. */
const NAV_ATTACKERS = `
<nav aria-label="left-border">
  <a id="lb-close" href="#" aria-current="page" style="border-left:2px solid #00303f">Close</a>
  <a id="lb-ask" href="#">Ask</a>
</nav>
<nav aria-label="left-shadow">
  <a id="ls-close" href="#" aria-current="page" style="box-shadow:inset 2px 0 0 #00303f">Close</a>
  <a id="ls-ask" href="#">Ask</a>
</nav>
`

/** The two things argued out on the record, built. */
const SIDEBAR = `
<aside id="sidebar" style="position:absolute;left:0;top:0;width:220px;height:420px;background-color:#eeeeee">
  <a href="#">Close</a><a href="#">Ask</a><a href="#">Reports</a>
</aside>
`
const TILES = `
<div id="tiles" style="display:flex;gap:8px">
  <div style="width:160px;height:80px;background-color:#eeeeee">5 exceptions</div>
  <div style="width:160px;height:80px;background-color:#eeeeee">12 runs closed</div>
  <div style="width:160px;height:80px;background-color:#eeeeee">3 awaiting review</div>
</div>
`

/** A second LINE and a second DOT, the two CLAUDE.md records being built here and removed. */
const INDICATOR_INTRUDERS = `
<div id="second-line" class="bg-[#00303f] w-1/2" style="height:3px"></div>
<div id="second-dot" class="bg-[#00303f] rounded-full" style="width:7px;height:7px"></div>
`

/**
 * The phrases that say THE ENGINE OBSERVED NO SHORTFALL — `completeness: []`.
 * None of them may appear against a run whose completeness is `null`.
 *
 * ⚠️ AT MODULE SCOPE BECAUSE THE BASE CONTROL USES THEM TOO. A detector's
 * vocabulary and the control that witnesses the detector have to be the same
 * vocabulary, or the control witnesses a different detector than the one the
 * seam assertion runs.
 */
const CLEAN_CLOSE =
  /\bno findings\b|\bnothing (missing|outstanding|to reconcile)\b|\bnone outstanding\b|\b0 findings\b|\bfully reconciled\b|\bclean close\b/i

/** The phrases that say THIS PLANE HOLDS NO ENGINE ACCOUNT — `completeness: null`. */
const ABSENT_ACCOUNT =
  /\bnot accounted\b|\bunaccounted\b|\bno account\b|\bunknown\b|\bnot recorded\b|\bnot reported\b|\bnot measured\b|\bnot computed\b|\bno engine\b|\bnot available\b|\bunavailable\b/i

/** The three answers `data-completeness` may name. Anything else is drift. */
const COMPLETENESS_KINDS = ['absent', 'empty', 'accounted']

/** The same second line, wearing the exclusion. Named, so the hole is priced. */
const DISGUISED_LINE = `
<div id="disguised-line" role="separator" class="bg-[#00303f] w-1/2" style="height:3px"></div>
`

/**
 * THE ORDINARY PROGRESS BAR THE OLD CEILING MISSED, and the one the new ceiling
 * still misses. `SIX_PX_BAR` is the measurement that moved the ceiling from 4 to
 * 12; `SIXTEEN_PX_BAR` is what 12 costs, stated rather than discovered later.
 */
const SIX_PX_BAR = `
<div id="six-px-bar" style="width:120px;height:6px;background-color:#00303f"></div>
`
const SIXTEEN_PX_BAR = `
<div id="sixteen-px-bar" style="width:120px;height:16px;background-color:#00303f"></div>
`

/** Tiles with the digits spelled as WORDS — the version the digit landmark missed. */
const TILES_IN_WORDS = `
<div id="worded-tiles" style="display:flex;gap:8px">
  <div style="width:160px;height:80px;background-color:#eeeeee">Five exceptions</div>
  <div style="width:160px;height:80px;background-color:#eeeeee">Twelve runs closed</div>
  <div style="width:160px;height:80px;background-color:#eeeeee">Three awaiting review</div>
</div>
`

/** A tile row UNDER the size floor — what 80×48 costs. */
const TILES_UNDER_FLOOR = `
<div id="small-tiles" style="display:flex;gap:8px">
  <div style="width:79px;height:47px;background-color:#eeeeee">5 exceptions</div>
  <div style="width:79px;height:47px;background-color:#eeeeee">12 runs closed</div>
  <div style="width:79px;height:47px;background-color:#eeeeee">3 awaiting review</div>
</div>
`

/** A navigation column UNDER the height floor — what 200 costs. */
const SHORT_SIDEBAR = `
<aside id="short-sidebar" style="position:absolute;left:0;top:0;width:220px;height:180px;background-color:#eeeeee">
  <a href="#">Close</a><a href="#">Ask</a><a href="#">Reports</a>
</aside>
`

/**
 * THE DEFECT THAT WAS ACTUALLY SHIPPED, BUILT AS A FIXTURE.
 *
 * 🛑 THIS IS NOT A CONTRIVED ATTACK. It is the exact page the product drew when
 * `completenessWord`'s null arm was blanked: the completeness cell EMPTY, and the
 * words `not recorded` present one column over, emitted by `exceptionsWord(null)`
 * for every row. The row-level scan reads that as an absent account and passes.
 * A reader looking at this page sees SILENCE where the run's engine account
 * should be, and silence reads as fine.
 *
 * The control below requires the reader to tell this row from the correct one.
 * Without it, the repair to `readRows` would itself be unwitnessed — which is
 * the shape being repaired.
 */
const ROWS_BLANK_ACCOUNT = `
<table><tbody>
  <tr data-run="run_ok">
    <td>completed </td>
    <td><span class="account" data-completeness="absent">no engine account </span></td>
    <td>not recorded </td>
  </tr>
  <tr data-run="run_blank">
    <td>completed </td>
    <td><span class="account" data-completeness="absent"></span></td>
    <td>not recorded </td>
  </tr>
  <tr data-run="run_no_cell">
    <td>completed </td>
    <td></td>
    <td>not recorded </td>
  </tr>
</tbody></table>
`

/**
 * A row whose cell CLAIMS one answer and READS as another. The attribute says the
 * engine never looked; the word says it looked and found nothing. Neither half
 * alone catches this, which is why both are asserted.
 */
const ROWS_CONTRADICTORY_ACCOUNT = `
<table><tbody>
  <tr data-run="run_contra">
    <td><span class="account" data-completeness="absent">no findings </span></td>
  </tr>
</tbody></table>
`

// ──────────────────────────────────────────────────────────────────────────
describe('BASE CONTROLS — every detector below is witnessed catching its attacker', { skip }, () => {
  it('the nav classifier reads a clean shell as three destinations, one underlined', async () => {
    const seen = await render(await bridgeSheet(), CLEAN, readDestinations)
    assert.deepEqual(seen.map((d) => d.text), ['Close', 'Ask', 'Reports'],
      'the classifier did not read the three destinations out of a clean nav')
    const current = seen.filter((d) => d.current === 'page')
    assert.equal(current.length, 1, 'the classifier lost `aria-current="page"`')
    assert.equal(current[0]?.underline, true,
      'the classifier did not see `inset 0 -2px 0` as an underline. A detector that ' +
      'reports a correct shell as broken is as useless as one that reports a broken ' +
      'shell as correct, and the shell assertion below would then be red against the ' +
      'detector rather than against the shell.')
    assert.deepEqual(seen.filter((d) => d.leftRule).map((d) => d.id), [],
      'the classifier invented a left rule on a nav that has none')
  })

  it('the nav classifier CATCHES a left border AND a left rule faked with an inset shadow', async () => {
    const seen = await render(await bridgeSheet(), CLEAN + NAV_ATTACKERS, readDestinations)
    const by = new Map(seen.map((d) => [d.id, d]))
    assert.equal(by.get('lb-close')?.leftRule, true,
      'the classifier did not see `border-left:2px solid`. "Active is an INSET BOX-SHADOW ' +
      'UNDERLINE. Never a left border: a left border is a sidebar\'s grammar and there is ' +
      'no sidebar" — design/system/shell.html, control 3.')
    assert.equal(by.get('ls-close')?.leftRule, true,
      'the classifier did not see `inset 2px 0 0` as a left rule. Keying only on ' +
      '`border-left` would catch the honest spelling and miss the one a designer ' +
      'copying the underline rule would actually reach for.')
  })

  it('the sidebar detector CATCHES a 220px column of links', async () => {
    const seen = await render(await bridgeSheet(), CLEAN + SIDEBAR, readLayout)
    assert.ok(seen.sidebars.some((s) => s.startsWith('#sidebar')),
      `the sidebar detector saw nothing: ${JSON.stringify(seen.sidebars)}. A detector that ` +
      'finds nothing when something is there is docs/HANDOFF.md §5.6 — a check that passes ' +
      'while asserting nothing — and the shell assertion resting on it is worthless.')
  })

  it('NEGATIVE — the sidebar detector does NOT fire on a clean shell', async () => {
    const seen = await render(await bridgeSheet(), CLEAN, readLayout)
    assert.deepEqual(seen.sidebars, [],
      `the sidebar detector fired on a shell with no sidebar: ${JSON.stringify(seen.sidebars)}`)
  })

  it('the tile detector CATCHES three summary tiles above the register', async () => {
    const seen = await render(await bridgeSheet(), TILES + CLEAN, readLayout)
    assert.ok(seen.hasRegister, 'the layout reader did not find the register through `data-run`')
    assert.ok(seen.tileRows.length > 0,
      `the tile detector saw nothing: ${JSON.stringify(seen.tileRows)}. The record's own ` +
      'example is a tile reading "5 exceptions" — "a worse version of the row that shows ' +
      'them" (Navigation.dc.html:462).')
  })

  it('NEGATIVE — the tile detector does NOT fire on a clean shell', async () => {
    const seen = await render(await bridgeSheet(), CLEAN, readLayout)
    assert.deepEqual(seen.tileRows, [],
      `the tile detector fired on a shell with no dashboard: ${JSON.stringify(seen.tileRows)}`)
  })

  it('the line and dot detectors CATCH a progress bar and an unread dot', async () => {
    const seen = await render(await bridgeSheet(), CLEAN + INDICATOR_INTRUDERS, readMarks)
    assert.ok(seen.lines.includes('second-line'),
      `the line detector did not see a Tailwind progress bar: ${JSON.stringify(seen.lines)}`)
    assert.ok(seen.dots.includes('second-dot'),
      `the dot detector did not see a \`rounded-full\` unread marker: ${JSON.stringify(seen.dots)}`)
  })

  it('the COMPLETENESS reader reads the cell on its own, and CATCHES a blanked one', async () => {
    const rows = await render(await bridgeSheet(), ROWS_BLANK_ACCOUNT, readRows)
    const by = new Map(rows.map((r) => [r.id, r]))

    assert.equal(by.get('run_ok')?.account, 'no engine account',
      'the reader did not pick the completeness cell out of a correct row. A detector that ' +
      'reports a correct register as broken is as useless as one that reports a broken ' +
      'register as correct.')
    assert.equal(by.get('run_ok')?.completeness, 'absent',
      'the reader did not read `data-completeness` off a cell that carries it')

    /* 🛑 THE WHOLE POINT. This row is the shipped defect: the completeness cell is
       EMPTY and the row still reads "not recorded", from the exceptions column.
       The row-level scan cannot tell it from the correct row — proven on the next
       two lines — and the cell-level reader can. */
    assert.ok(ABSENT_ACCOUNT.test(by.get('run_blank')?.text ?? ''),
      'the ROW-level scan failed to match the blanked row, so this fixture no longer ' +
      'reproduces the defect it exists to reproduce and the control below proves nothing. ' +
      `Row text: ${JSON.stringify(by.get('run_blank')?.text)}`)
    assert.equal(by.get('run_blank')?.account, '',
      'the CELL-level reader did not see the blanked completeness cell as empty. It is the ' +
      'only thing standing between assertion 5 and the vacuity described in `readRows` — ' +
      'the built page drew exactly this and the suite went 18/18 green. ' +
      `Saw: ${JSON.stringify(by.get('run_blank')?.account)}`)

    assert.equal(by.get('run_no_cell')?.account, null,
      'a row with NO completeness cell at all must read as `null`, which is a different ' +
      'failure from an empty one: the first says the register stopped drawing the column, ' +
      'the second says it drew it with nothing in it. Collapsing them would let the column ' +
      'be deleted outright without the assertion moving.')

    const contra = await render(await bridgeSheet(), ROWS_CONTRADICTORY_ACCOUNT, readRows)
    assert.equal(contra[0]?.completeness, 'absent')
    assert.ok(CLEAN_CLOSE.test(contra[0]?.account ?? ''),
      'the reader did not catch a cell whose WORD contradicts its own attribute. `absent` ' +
      'plus "no findings" is worse than either half alone — the machine-readable answer and ' +
      'the human-readable one disagree and a reader cannot tell which is the lie.')
  })

  it('the tile detector CATCHES tiles whose numbers are spelled as WORDS', async () => {
    const seen = await render(await bridgeSheet(), TILES_IN_WORDS + CLEAN, readLayout)
    assert.ok(seen.tileRows.length > 0,
      `the tile detector saw nothing: ${JSON.stringify(seen.tileRows)}. It required a DIGIT ` +
      'and this row has none — "Five exceptions" is the same tile as "5 exceptions", and a ' +
      'tile row headed "Exceptions / Awaiting review / Closed" is the version somebody ' +
      'actually builds. A digit is a landmark; the boxed row above the register is the ' +
      'property. docs/HANDOFF.md §5, inside a detector rather than inside the product.')
  })

  it('THE PRICE OF THE HEIGHT CEILING, MEASURED — 6px is caught, 16px is not', async () => {
    const caught = await render(await bridgeSheet(), CLEAN + SIX_PX_BAR, readMarks)
    assert.ok(caught.lines.includes('six-px-bar'),
      'a 120×6px painted bar is invisible to the ONE LINE count. That is an ORDINARY ' +
      'progress-bar height, and the assertion resting on this detector names "a loading bar ' +
      'is a second line" as the defect it is looking for. The ceiling was 4px, inherited and ' +
      `declared nowhere; it is 12px and declared in \`readMarks\`. Saw: ${JSON.stringify(caught.lines)}`)

    const missed = await render(await bridgeSheet(), CLEAN + SIXTEEN_PX_BAR, readMarks)
    assert.ok(!missed.lines.includes('sixteen-px-bar'),
      'the ceiling is not doing what its comment says, so the comment is now wrong in the ' +
      'other direction and must be corrected rather than left.')
    /* The hole that REMAINS, priced here rather than discovered by the next review:
       a painted horizontal taller than 12px is not counted. Nothing in this
       repository closes it, and a reader who needs the count to be total must read
       `readMarks` and not this suite's summary. */
  })

  it('THE PRICE OF THE TWO LAYOUT FLOORS, MEASURED — under them, both refusals are invisible', async () => {
    const tiles = await render(await bridgeSheet(), TILES_UNDER_FLOOR + CLEAN, readLayout)
    assert.deepEqual(tiles.tileRows, [],
      'the 80×48 floor is not doing what `readLayout` says it does, so the comment is now ' +
      'wrong in the other direction. It is argued as keeping the nine chrome controls — ' +
      '28px tall — out of the count, and that argument is only honest if something under it ' +
      `is genuinely invisible. Saw: ${JSON.stringify(tiles.tileRows)}`)

    const side = await render(await bridgeSheet(), CLEAN + SHORT_SIDEBAR, readLayout)
    assert.deepEqual(side.sidebars, [],
      'the 200px floor is not doing what `readLayout` says it does. It exists to keep the ' +
      'account menu — 102×183 on the built page — from reading as a sidebar. ' +
      `Saw: ${JSON.stringify(side.sidebars)}`)
    /* So: a tile row of 79×47 boxes, and a 220×180 column of destinations, are each
       REFUSED BY THE RECORD and INVISIBLE TO THIS FILE. Both floors are bounded
       holes rather than closed ones, which is the accurate claim; the numbers are
       as low as they go without the detector calling correct furniture a defect. */
  })

  it('THE PRICE OF THE SEPARATOR HOLE, MEASURED — `role="separator"` hides a line from the count', async () => {
    const seen = await render(await bridgeSheet(), CLEAN + DISGUISED_LINE, readMarks)
    assert.ok(!seen.lines.includes('disguised-line'),
      'the exclusion is not doing what its comment says, so the comment is now wrong ' +
      'in the other direction and must be corrected rather than left')
    /* The hole is real and it is priced here rather than discovered later: a second
       line is exactly one attribute away from invisible to this file. Nothing else
       in this repository closes it, and a reader who needs the count to be total
       must read `readMarks` and not this suite's summary. */
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('1 · three destinations, Setup as a door, active by underline', { skip }, () => {
  const P = 'the route model'

  it('the shell renders EXACTLY three destinations and no fourth', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readDestinations)
    assert.deepEqual(seen.map((d) => d.text), ['Close', 'Ask', 'Reports'],
      'the navigation shell does not hold exactly the three destinations. ' +
      'Mockups/rec/Sitemap.dc.html:102 — "Three destinations. Nothing else earns a place ' +
      'in the nav." The command palette is the reason a fourth is never needed ' +
      `(Navigation.dc.html:457). Saw: ${JSON.stringify(seen.map((d) => d.text))}`)
  })

  it('Setup is a DOOR — present on the page, and NOT a destination', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await readSetupFrom(page)
    assert.ok(seen.length > 0,
      'the shell offers no way into Setup at all. Navigation.dc.html:459 puts it in the ' +
      'account menu — "configuring the firm is something you do from your own seat" — and ' +
      'a shell with no door leaves a four-level Setup trail with no entrance.')
    assert.deepEqual(seen.filter((s) => s.inNav), [],
      'Setup is drawn as a destination. It is a DOOR, not a fourth: ' +
      'Navigation.dc.html:386-398 draws the Setup trail with ALL THREE destinations ' +
      `un-underlined, which is only coherent if Setup is not one of them. Saw: ${JSON.stringify(seen)}`)
  })

  it('active is an UNDERLINE — an inset box-shadow, never a left border', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readDestinations)

    const current = seen.filter((d) => d.current === 'page')
    assert.equal(current.length, 1,
      'exactly one destination must carry `aria-current="page"`, and ' +
      `${current.length} do. Saw: ${JSON.stringify(seen.map((d) => ({ t: d.text, c: d.current })))}`)

    assert.deepEqual(seen.filter((d) => d.leftRule).map((d) => d.text), [],
      'a destination is marked with a LEFT RULE. "Never a left border: a left border is a ' +
      'sidebar\'s grammar and there is no sidebar" — design/system/shell.html, control 3. ' +
      `Saw: ${JSON.stringify(seen)}`)

    assert.equal(current[0]?.underline, true,
      'the active destination is not underlined by an inset box-shadow. ' +
      'Navigation.dc.html:374 fixes the treatment as `inset 0 -2px 0`. Saw box-shadow ' +
      `${JSON.stringify(current[0]?.boxShadow)} and text-decoration ` +
      `${JSON.stringify(current[0]?.textDecoration)}.`)

    /* THE MECHANISM, and it is what reduces "inside Setup nothing is underlined" to a
       one-line property — see the header. If a destination can be underlined without
       carrying `aria-current`, then the Setup route has a second way to get it wrong. */
    assert.deepEqual(seen.filter((d) => d.underline && d.current !== 'page').map((d) => d.text), [],
      'a destination is underlined WITHOUT carrying `aria-current="page"`. The underline ' +
      'must be driven by that attribute alone: it is what makes "inside Setup, no ' +
      'destination is underlined" a matter of the Setup route setting no `aria-current`, ' +
      'rather than a second rule somebody has to remember. ' +
      `Saw: ${JSON.stringify(seen)}`)
  })
})

/** Setup's placement, read off the built page. Split out only to keep the assertion short. */
async function readSetupFrom(page: string): Promise<readonly { readonly inNav: boolean; readonly tag: string }[]> {
  return renderFile(page, NOTHING, readSetup)
}

// ──────────────────────────────────────────────────────────────────────────
describe('2 · what is kept out — no tile dashboard, no left sidebar', { skip }, () => {
  const P = 'the two refusals on the record'

  it('there is no summary-tile dashboard above the register', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readLayout)
    assert.ok(seen.hasRegister,
      'the shell rendered no register at all — nothing carries `data-run`. The register ' +
      'is the whole point of this slice: it is the first surface that consumes an ' +
      'operation, and a shell around nothing cannot be asked whether a dashboard sits ' +
      'above it.')
    assert.deepEqual(seen.tileRows, [],
      'a dashboard of summary tiles is drawn above the register. This is not an unbuilt ' +
      'feature, it is a REFUSED one: "Every product like this grows a landing page of ' +
      'tiles that summarise what the next screen already says. The register is the ' +
      'summary" — Navigation.dc.html:462. Re-adding it is a regression, not a feature. ' +
      `Saw: ${JSON.stringify(seen.tileRows)}`)
  })

  it('there is no left sidebar', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readLayout)
    assert.deepEqual(seen.sidebars, [],
      'a left sidebar is drawn. Also refused, and costed: "it costs 220px of the register ' +
      'width permanently to serve a click most people make twice a week. Three ' +
      'destinations and a palette do the same job in the bar" — Navigation.dc.html:463. ' +
      `Saw: ${JSON.stringify(seen.sidebars)}`)
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('5 · an incomplete run reads differently, and an absent account is not a clean close', { skip }, () => {
  const P = 'G153 in the register'

  it('an `incomplete` run and a `completed` run read differently, in WORDS', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const rows = await renderFile(page, NOTHING, readRows)
    assert.ok(rows.length >= 2,
      `the register draws ${rows.length} rows; two run states cannot be told apart on fewer ` +
      'than two. G153 is the ruling: "A run that is `incomplete` must read differently from ' +
      'one that is `completed`."')

    const incomplete = rows.filter((r) => /\bincomplete\b/i.test(r.text))
    const completed = rows.filter((r) => /\bcompleted\b/i.test(r.text) && !/\bincomplete\b/i.test(r.text))

    assert.ok(incomplete.length > 0,
      'no row reads `incomplete`. `incomplete` is O-16\'s "SOUND OVER LESS THAN EVERYTHING" ' +
      'and is neither `completed` nor `failed`; a register that cannot show it collapses the ' +
      `distinction the status column exists for. Rows: ${JSON.stringify(rows)}`)
    assert.ok(completed.length > 0,
      'no row reads `completed`, so there is nothing to distinguish `incomplete` FROM. ' +
      `Rows: ${JSON.stringify(rows)}`)
    assert.notEqual(incomplete[0]?.text, completed[0]?.text,
      'the incomplete row and the completed row render identical text, so the difference ' +
      'between them is carried by something other than a word — and NO STATE MAY DEPEND ON ' +
      'HUE. Every state carries a word.')
  })

  it('`completeness: null` renders as an ABSENT ACCOUNT, never as nothing missing', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const rows = await renderFile(page, NOTHING, readRows)
    assert.ok(rows.length > 0, 'the register draws no rows')

    for (const r of rows) {
      /* ── THE CELL, WHICH IS WHERE THE PROPERTY LIVES ────────────────────
         Everything below reads `r.account` and `r.completeness`, never
         `r.text`. The row-level scan is kept afterwards as a weaker net, but
         it is NOT what carries this assertion: it cannot, because
         `ABSENT_ACCOUNT` matches "not recorded" from the exceptions column and
         is therefore satisfied by a row whose completeness cell is empty. See
         `readRows`. */
      assert.notEqual(r.completeness, null,
        `row \`${r.id}\` has NO addressable completeness cell — nothing in it carries ` +
        '`data-completeness`. The register must state which of the three answers it is ' +
        'showing, by name: `absent` (the plane holds no engine account), `empty` (the ' +
        'engine ran and observed no shortfall) or `accounted`. Without it the only way to ' +
        'read this column is to match English out of the row\'s welded text, and that scan ' +
        'is satisfied by the words of a DIFFERENT column. ' +
        `Row: ${JSON.stringify(r.text)}`)
      assert.ok(COMPLETENESS_KINDS.includes(r.completeness ?? ''),
        `row \`${r.id}\` names its completeness \`${String(r.completeness)}\`, which is not ` +
        `one of ${JSON.stringify(COMPLETENESS_KINDS)}. A fourth answer means the register ` +
        'and the wire have drifted apart — `completeness` is `readonly CompletenessFinding[] ' +
        '| null` and has exactly three readings.')

      assert.equal(r.completeness, 'absent',
        `row \`${r.id}\` claims \`${String(r.completeness)}\`. EVERY run this plane can ` +
        'serve carries `completeness: null` — `server/data-plane/runs.ts`, ' +
        'NO_ENGINE_ACCOUNT: "`[]` the ENGINE ran and observed no shortfall; `null` THIS ' +
        'PLANE HOLDS NO ENGINE ACCOUNT FOR THIS RUN AT ALL" — because nothing in this ' +
        'repository persists a `SetReconciliationResult`. `empty` here is the fabrication ' +
        'the handler refuses, arriving one layer up; on the `incomplete` row it is also ' +
        'self-contradictory, because `terminalRunStatus()` derives `incomplete` FROM a ' +
        'non-empty completeness channel.')

      assert.notEqual(r.account, '',
        `row \`${r.id}\` draws an EMPTY completeness cell. SILENCE READS AS FINE, and this ` +
        'is the exact page that shipped past the previous version of this assertion: the ' +
        'word gone, the cell blank, and the row still matching `ABSENT_ACCOUNT` because the ' +
        'EXCEPTIONS column says "not recorded". `null` and `[]` mean different things and ' +
        'an empty cell collapses them by omission — which is why a negative-only assertion ' +
        'is not enough. The cell must carry a word.')
      assert.ok(ABSENT_ACCOUNT.test(r.account ?? ''),
        `row \`${r.id}\`'s completeness cell reads ${JSON.stringify(r.account)}, which says ` +
        'nothing about an absent account. The cell is named `absent`; its word must say so ' +
        'too, or the machine-readable answer and the human-readable one disagree.')
      assert.ok(!CLEAN_CLOSE.test(r.account ?? ''),
        `row \`${r.id}\`'s completeness cell reports a CLEAN CLOSE — ` +
        `${JSON.stringify(r.account)} — against a run whose account is absent. Drawing the ` +
        'unknown as the empty is the lie `server/data-plane/runs.ts` refuses in the ' +
        'handler, arriving one layer up.')

      /* The weaker second net: a clean-close phrase is worth failing on WHEREVER
         it appears in the row, not only in the cell. This runs last and on its
         own it proves nothing about completeness — that is the point of the four
         cell-level assertions above it. */
      assert.ok(!CLEAN_CLOSE.test(r.text),
        `row \`${r.id}\` reports a clean close somewhere outside its completeness cell. ` +
        `Row: ${JSON.stringify(r.text)}`)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('6 · ONE LINE and ONE DOT across the whole shell', { skip }, () => {
  const P = 'the SIX INDICATORS'

  it('THE COUNT IS NOT TRUSTED UNTIL THE DETECTOR IS CAUGHT WORKING ON THIS PAGE', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, plantIndicators, readMarks)
    assert.ok(seen.lines.includes('planted-line'),
      'the line detector saw nothing when a 120×3px painted bar was appended to the BUILT ' +
      `page: ${JSON.stringify(seen.lines)}. The base control proves the detector works ` +
      'against a sheet this test composed; this one proves it works against the sheet the ' +
      'app SHIPS, which is a different sheet with a different utility surface. A count ' +
      'taken without this is a count nobody has checked can move.')
    assert.ok(seen.dots.includes('planted-dot'),
      `the dot detector saw nothing when a 7px circle was appended: ${JSON.stringify(seen.dots)}`)
  })

  it('the token meter is the only line and the connection light the only dot', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, readMarks)

    for (const l of seen.lines) {
      assert.ok(l.startsWith('meter'),
        `a second LINE is in the shell: ${l} (all: ${JSON.stringify(seen.lines)}). A loading ` +
        'bar is a second line. Both a second line and a second dot were built here before ' +
        'and removed. The detector is witnessed catching one in the base controls above.')
    }
    for (const d of seen.dots) {
      assert.ok(d.startsWith('conn'),
        `a second DOT is in the shell: ${d} (all: ${JSON.stringify(seen.dots)}). An unread ` +
        'badge is a second dot, and the notification control counts — "No unread dot — ' +
        'that is a second dot" (docs/handoff-pack/Design System.dc.html, the chrome-bar ' +
        'row named Notifications) and R3, "No second line, and no second dot." ' +
        '⚠️ This cited `design/system/shell.html, control 5` until 19 Sep 2026: a path ' +
        'G264 deleted, and in the pack that NUMBER is the token meter — the two records ' +
        'swap 5 and 8. Cite the rule by content, never by row number.')
    }
    /* ⚠️ RE-ARGUED 2 Oct 2026 UNDER G3091 (THE OWNER'S). This read
       `assert.equal(seen.lines.length, 2, …)` — *"expected exactly the token
       meter's track and fill. The chrome bar is NINE controls and holds ONE
       meter"* — because the old chrome drew the token meter as a BAR. The pack's
       own chrome does not: C1 draws it as a FIGURE, *"418,220 ∴ of 600,000 this
       month"*, in `.meterbtn .spent`, and the chrome is now drawn as the pack
       draws it. The register's confidence column is the pack's other meter, and
       the queue row serves no confidence BY CONTRACT, so every row draws the
       pack's own `.noscore` state. So this page holds NO painted horizontal at
       all, and the count is pinned at ZERO rather than relaxed to a ceiling: a
       meter arriving here is a design change and must move this number on
       purpose. The ONE LINE rule is unchanged — the loop above still requires
       any line to BE a meter. */
    assert.equal(seen.lines.length, 0,
      'expected no painted horizontal: the pack draws the chrome\'s meter as a figure and ' +
      'the register serves no confidence on a queue row. A line here is a design change. ' +
      `Saw: ${JSON.stringify(seen.lines)}`)
    assert.equal(seen.dots.length, 2,
      'expected exactly one connection light — its dot and its halo. The bar holds ONE ' +
      `(control 4). Saw: ${JSON.stringify(seen.dots)}`)
  })

  it('THE SEPARATOR EXCLUSION IS BOUNDED — the hole cannot widen unnoticed', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seps = await renderFile(page, NOTHING, readSeparators)

    /* The two dividers in the account menu — `ChromeBar`, either side of Setup.
       They are the first in-product users of the exclusion `readMarks` prices. */
    assert.equal(seps.length, 2,
      `the shell carries ${seps.length} elements wearing \`role="separator"\` or \`<hr>\`, ` +
      'not the two dividers the account menu needs. EVERY ONE OF THEM IS INVISIBLE TO THE ' +
      'ONE LINE COUNT above — measured: a 200×3px painted bar is caught, and the same bar ' +
      'with `role="separator"` is not. That exclusion is furniture-versus-indicator and it ' +
      'is honest, but it is exactly one attribute wide, so its population is bounded here ' +
      'rather than left to grow. A new separator is not forbidden — it is required to be ' +
      `ARGUED for, by changing this number on purpose. Saw: ${JSON.stringify(seps)}`)

    for (const s of seps) {
      const height = Number(s.split(' ')[1]?.split('×')[1] ?? NaN)
      assert.ok(height <= 1,
        `a separator is ${height}px tall: ${s}. A divider is a HAIRLINE; anything thicker ` +
        'wearing the attribute is an indicator hiding behind furniture\'s ARIA, and the ONE ' +
        'LINE rule cannot see it.')
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('7 · the shell is QUIET — no hatch, no G row, and every unbuilt control disabled', { skip }, () => {
  /* ⚠️ RE-ARGUED 2 Oct 2026 UNDER G3091, THE OWNER'S RULING, AND THE OLD
     SECTION IS QUOTED RATHER THAN DELETED. It was *"7 · the hatch survives
     inside the shell"* and required at least one `.nb` here, wearing `bg-none`,
     whose visible text and plate both named a G row: *"a surface that draws a
     refused control as an ordinary one becomes evidence of a shipped control."*

     The owner ruled the opposite way for product surfaces on 2 Oct 2026:
     *"Pack-faithful, quiet: draw exactly as the pack, visibly disabled (muted,
     no hatch, no G-numbers); a small tooltip says 'Coming soon'. Engineering
     rationale stays in docs/tests, never on screen."*

     THE OLD SECTION'S FEAR IS STILL THE PROPERTY, AND IT IS STATED AS
     BEHAVIOUR NOW: an unbuilt control must not be drawn as an ORDINARY one.
     Every `[data-soon]` is `aria-disabled="true"` (never `disabled` — G189:
     the tooltip must stay reachable by keyboard), carries no `href`, and
     computes the kernel's `--muted` ink — so it is visibly not a live control
     without a hatch saying so. The hatch's SURVIVAL under `bg-none` is still
     measured, on the specimen, by `frontend-bridge.test.ts` §1 and
     `kernel-under-tailwind.test.ts`; only its use on this page is gone. */
  const P = 'the quiet shell'

  it('the built shell carries no hatch and no G row in any visible text', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => ({
      hatches: document.querySelectorAll('.nb').length,
      text: document.body.innerText,
    }))
    assert.equal(seen.hatches, 0, 'the shell draws a hatch; G3091 removes it from product surfaces')
    assert.deepEqual(seen.text.match(/\bG\d{2,4}\b/g) ?? [], [],
      'a G row reached the screen. "Engineering rationale stays in docs/tests, never on screen."')
    assert.doesNotMatch(seen.text, /row-level security/i,
      'the shell explains row-level security on screen — the old Close page did, twice')
  })

  it('every unbuilt control is DISABLED, not interactive, and muted', async () => {
    const page = shell(P)
    if (typeof page !== 'string') assert.fail(page.missing)
    const seen = await renderFile(page, NOTHING, () => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--muted)'
      document.body.appendChild(probe)
      const muted = getComputedStyle(probe).color
      probe.remove()
      probe.style.backgroundColor = 'var(--paper)'
      document.body.appendChild(probe)
      const paper = getComputedStyle(probe).backgroundColor
      probe.remove()
      return {
        muted,
        paper,
        soon: [...document.querySelectorAll('[data-soon]')].map((e) => ({
          text: (e.textContent ?? '').replace(/\s+/g, ' ').trim(),
          ariaDisabled: e.getAttribute('aria-disabled'),
          disabledAttr: e.hasAttribute('disabled'),
          href: e.getAttribute('href'),
          color: getComputedStyle(e).color,
          ground: getComputedStyle(e).backgroundColor,
          edge: getComputedStyle(e).boxShadow,
          commit: e.hasAttribute('data-commit'),
          tip: e.parentElement?.querySelector('[role="tooltip"]')?.textContent ?? null,
        })),
      }
    })
    assert.ok(seen.soon.length >= 10,
      `only ${seen.soon.length} quiet controls on the built shell — the pack's C1 draws at ` +
      'least the entity switcher, Ask, Reports, the audit door, the palette, the meter, three ' +
      'account items, the new-reconciliation cell, rename, the machine figure and the status ' +
      'bar\'s three. A lower number means the probe is inert.')
    for (const s of seen.soon) {
      assert.equal(s.ariaDisabled, 'true', `${s.text} is not aria-disabled`)
      assert.equal(s.disabledAttr, false, `${s.text} uses the disabled attribute (G189)`)
      assert.equal(s.href, null, `${s.text} carries an href, so it would navigate`)
      /* ⚠️ RV-04 (G3430) SAID THE QUIET COMMIT KEEPS A FILL — `--muted` as its
         ground, `--on-ink` text — AND N-02, THE OWNER'S RULING (G3478),
         REPLACES IT: *"a quiet (unbuilt) commit button like Accept is a hairline
         OUTLINE with muted text; no new kernel ground."* `--muted` is an INK
         step, and as a ground it was the loudest slab in the dark row. So every
         quiet control is muted ink, and the commit is told apart by a paper
         ground and a 1px inset hairline. */
      assert.equal(s.color, seen.muted, `${s.text} is not drawn in the muted ink`)
      if (s.commit) {
        assert.notEqual(s.ground, seen.muted, `${s.text} uses the ink step --muted as a ground (N-02)`)
        assert.equal(s.ground, seen.paper, `${s.text} is a quiet commit act and its ground is not --paper`)
        assert.match(s.edge, /0px 0px 0px 1px inset|inset 0px 0px 0px 1px/, `${s.text} is a quiet commit act with no hairline outline`)
      }
      assert.equal(s.tip, 'Coming soon', `${s.text} has no "Coming soon" tooltip`)
    }
  })
})

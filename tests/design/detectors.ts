/**
 * THE DETECTORS — one spelling, shared by every rendered audit.
 *
 * ─── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * Every one of these was written and MEASURED in tests/design/routes.test.ts,
 * against design/routes/. design/system/ needs the same nine questions asked of
 * it, and the one thing that must NOT happen is a second spelling: a detector
 * that drifts from its twin reports a clean page for a reason nobody can name,
 * and this repository already carries §5.6 — *"a checker that passes while
 * asserting nothing"* — as a catalogued defect shape.
 *
 * So the detectors moved here verbatim and both suites import them. Their
 * commentary moved with them, because every paragraph in it is a wrong number
 * somebody got first.
 *
 * 🛑 EVERY DETECTOR IS A BARE ARROW CLOSING OVER NOTHING. render.ts serialises
 * each to source and re-parses it inside the page, so a reference to anything in
 * this module — an import, a helper, a constant — is a ReferenceError in
 * chromium rather than a compile error here. The duplication inside them is
 * deliberate and must stay.
 *
 * ─── THE THREE MEASUREMENT TRAPS, INHERITED RATHER THAN REDISCOVERED ───────
 *
 *  1. A TRANSITION MAKES A FOCUS READING REPORT THE STATE IT IS LEAVING.
 *     `.tip` carries `transition:opacity .12s linear`. Focusing the trigger and
 *     reading `opacity` in the same turn reports `0` — the value it is
 *     transitioning FROM. That said 24 of 24 tooltips were unreachable by
 *     keyboard, on five routes where 24 of 24 are fine. PREPARE installs
 *     `transition:none` before anything is read, so every reading is an END
 *     state.
 *  2. focus() ON AN ELEMENT INSIDE A `[hidden]` CONTAINER SILENTLY DOES
 *     NOTHING, and the un-focused element then reports no ring. That said
 *     ask.html had 10 bare focus stops; it has none. Every ring reading confirms
 *     `document.activeElement === el` before it counts, and PREPARE un-hides the
 *     containers first.
 *  3. THE HATCH IS A GRADIENT, SO IT HIDES THE GROUND FROM A CONTRAST WALK.
 *     A walk that stops at the first `background-image` cannot see through it,
 *     and 390 of close.html's text elements went UNMEASURED while the run
 *     reported zero failures. The walk reads the STOP ALPHAS: a gradient whose
 *     every stop is under .2 alpha is a texture and the walk continues; anything
 *     opaque is an unmeasurable ground and is COUNTED, never guessed.
 *
 * ⚠️ AND `getComputedStyle` RETURNS A LIVE DECLARATION. Every before/after pair
 * below copies its values into a plain object before the next focus().
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { kernel, render, KERNEL } from './render.ts'

// ═══ THE DETECTORS ════════════════════════════════════════════════════════

/**
 * Installed BEFORE the page's own scripts. Census of every element that is
 * given a click listener, so the reachability detector can ask whether a `<div>`
 * with a handler is reachable by keyboard. There is no way to ask this after
 * `load` — the DOM does not expose its listeners — which is why render.ts has
 * an `init` hook.
 */
export const INIT = (): void => {
  const w = window as unknown as { __clicked: Set<Element> }
  w.__clicked = new Set<Element>()
  const real = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function (
    this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null,
    opts?: boolean | AddEventListenerOptions,
  ): void {
    if (type === 'click' && this instanceof Element) w.__clicked.add(this)
    real.call(this, type, fn, opts)
  }
}

/**
 * THE STATE EVERY READING IS TAKEN IN, and each move is here because leaving it
 * out produced a wrong number.
 *
 *   transitions off   trap 1 — a focus reading otherwise reports the state the
 *                     element is LEAVING
 *   [hidden] removed  trap 2 — the disclosure menus on the chrome bar ship
 *                     closed, and a control that cannot take focus reports no
 *                     ring while being perfectly fine
 *   tooltips opened   a tip at rest is `opacity:0`, so its CONTENTS are never on
 *                     a measured ground. reports.html's failure is inside a
 *                     tooltip and is invisible to a run that does not open it
 *   a keydown fired   entry.html's tooltip script guards its focus route with
 *                     `userActive`, deliberately, so that a restored focus is
 *                     not treated as a user. A synthetic keydown on `document`
 *                     is the signal the page itself defines; without it the
 *                     detector reports 7 unreachable tooltips that are fine
 *
 * ⚠️ AND ONE MOVE ADDED FOR design/system/, MEASURED BEFORE IT WAS ADDED.
 * `<dialog>` is inert until it is opened — `display:none`, and `focus()` inside
 * it does exactly what trap 2 describes. overlays.html draws its overlays as
 * ordinary markup and NOT as `<dialog>`, so on the six system specimens this
 * move changes no number today; it is here because the first thing anyone
 * building the real overlay will reach for is `<dialog>`, and the detector must
 * not go quiet on the day they do. `show()` rather than `showModal()`: a modal
 * dialog makes every other element on the page inert, which would blind every
 * other detector on the same run.
 */
export const PREPARE = (): void => {
  const s = document.createElement('style')
  s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'
  document.head.appendChild(s)
  for (const el of document.querySelectorAll('dialog')) {
    if (!(el as HTMLDialogElement).open) (el as HTMLDialogElement).show()
  }
  for (const el of document.querySelectorAll('[hidden]')) el.removeAttribute('hidden')
  for (const el of document.querySelectorAll('.tw')) el.setAttribute('data-open', 'true')
  for (const el of document.querySelectorAll('.tipwrap .trigger')) el.setAttribute('data-tip-open', '')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
}

/**
 * §1 · THE RING DETECTOR. Focuses every focusable element in document order and
 * reports the ones the kernel's two-band ring did not survive on.
 *
 * 🛑 IT KEYS ON GEOMETRY, NOT ON COLOUR. The ring is
 * `0 0 0 2px #fff, 0 0 0 4px var(--ink)`; matching the hex would restate the
 * palette in a test file and would go on passing after the token moved. Two
 * zero-blur bands at 2px and 4px spread is a shape nothing else in the kernel
 * draws.
 *
 * 🛑 IT NOW RETURNS THREE NUMBERS AND IT USED TO RETURN ONE LIST. THAT IS NOT
 * TIDYING; IT IS THE FIX FOR A BLIND SPOT design/system/ WALKED STRAIGHT INTO.
 * The first run reported `bare: 0` on all six specimen sheets — which is exactly
 * what a detector reports when it is CLEAN and exactly what it reports when it
 * measured NOTHING. Two of its three `continue`s are silent drops: a control
 * with no box, and trap 2's control that refused focus. On a page with no
 * focusable elements at all, or on one where every control lives inside
 * something inert, an empty list is not evidence. `measured` is the count that
 * makes an empty list mean something, and `unfocusable` is the count of controls
 * this detector could NOT hold to the rule — reported, never assumed clean.
 */
export const readRings = (): { bare: string[]; measured: number; unfocusable: string[] } => {
  const out: string[] = []
  const unfocusable: string[] = []
  let measured = 0
  const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
  const name = (el: Element): string => {
    const own = typeof el.className === 'string' && el.className.trim() !== ''
      ? el.className.trim() : el.tagName.toLowerCase()
    return `${el.tagName.toLowerCase()}#${el.id === '' ? '-' : el.id}.${own}`
  }
  for (const el of document.querySelectorAll(sel)) {
    const box = el.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    ;(el as HTMLElement).focus()
    if (document.activeElement !== el) { unfocusable.push(name(el)); continue }
    measured++
    const cs = getComputedStyle(el)
    const shadow = cs.boxShadow
    const style = cs.outlineStyle
    const width = cs.outlineWidth
    const banded = /0px 0px 0px 2px/.test(shadow) && /0px 0px 0px 4px/.test(shadow)
    const outlined = style !== 'none' && parseFloat(width) > 0
    if (banded || outlined) continue
    out.push(name(el))
  }
  return { bare: out, measured, unfocusable: [...new Set(unfocusable)] }
}

/**
 * §2 · KEYBOARD REACHABILITY. Three shapes, and the first is the one no source
 * read can find:
 *
 *   CLICK-NO-KEYBOARD   an element given a click listener that is neither a
 *     native control nor CONTAINS one. The second half is not a softening — it
 *     is what keeps event DELEGATION from reading as a defect. Every route puts
 *     one listener on `ul.menu` for the whole menu; the menu items are
 *     `<button>`s and are perfectly reachable. Without the containment test this
 *     detector reported 10 defects across four routes and every one of them was
 *     delegation.
 *   ARIA-STATE-NOT-FOCUSABLE   `aria-pressed` / `-expanded` / `-checked` /
 *     `-selected` on something that cannot take focus. A toggle nobody can reach
 *     still announces a state.
 *   ONCLICK-NOT-FOCUSABLE      the attribute form of the same thing.
 *
 * 🛑 AND A THIRD EXEMPTION, WHICH design/system/wayfinding.html FORCED AND WHICH
 * IS NOT A SOFTENING. `#pal-listbox` is `role="listbox"`, ships EMPTY, is filled
 * by the page's own `render()`, and takes one delegated click listener for all
 * of its options. The detector charged it CLICK-NO-KEYBOARD. It is the WAI-ARIA
 * combobox pattern done correctly: `#pal-input role="combobox"` carries
 * `aria-controls="pal-listbox"`, focus never leaves the input, the options are
 * `tabindex="-1"` and are moved by ↑↓ through `aria-activedescendant`. The file
 * argues it at length — *"moved by ↑↓, never by Tab"*.
 *
 * Charging that pattern would push people toward putting every option in the tab
 * order, which is worse for the keyboard user this rule exists to protect. So a
 * click host is also cleared when a FOCUSABLE element `aria-controls` it — the
 * route by which a keyboard actually arrives. §0 plants an empty listbox that
 * nothing controls, so the exemption cannot swallow the defect it neighbours.
 */
export const readReach = (): string[] => {
  const NATIVE = 'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'
  const out: string[] = []
  const name = (el: Element): string =>
    `${el.tagName.toLowerCase()}${el.id === '' ? '' : '#' + el.id}.${String(el.className).trim()}`
  const controlled = (el: Element): boolean => {
    if (el.id === '') return false
    for (const c of document.querySelectorAll(`[aria-controls~="${el.id}"]`)) {
      if (c.matches(NATIVE)) return true
    }
    return false
  }
  const w = window as unknown as { __clicked?: Set<Element> }
  for (const el of w.__clicked ?? new Set<Element>()) {
    if (!el.isConnected || el === document.body || el === document.documentElement) continue
    if (el.matches(NATIVE)) continue
    if (el.querySelector(NATIVE) !== null) continue
    if (controlled(el)) continue
    out.push(`CLICK-NO-KEYBOARD ${name(el)}`)
  }
  for (const el of document.querySelectorAll(
    '[aria-pressed],[aria-expanded],[aria-checked],[aria-selected]')) {
    if (el.matches(NATIVE)) continue
    out.push(`ARIA-STATE-NOT-FOCUSABLE ${name(el)}`)
  }
  for (const el of document.querySelectorAll('[onclick]')) {
    if (el.matches(NATIVE)) continue
    out.push(`ONCLICK-NOT-FOCUSABLE ${name(el)}`)
  }
  return [...new Set(out)]
}

/**
 * §2b · G189 — A TOOLTIP IS REACHABLE BY FOCUS AND BY TAP. Measured in four
 * states rather than read off a selector: hidden at rest, VISIBLE while its
 * trigger holds focus, VISIBLE after its trigger is pressed, and owned by a
 * trigger that is a real control (so a tap, which focuses what it presses,
 * arrives at the same place a Tab does).
 *
 * PREPARE has already pinned every tip open, so the rest reading is taken after
 * removing that pin and the focus reading after restoring it — each value copied
 * out immediately, because the declaration is live.
 *
 * 🛑 THE CLICK READING IS NEW AND design/system/filtering.html IS WHY. Its four
 * tooltips are a DISCLOSURE: a `<button aria-expanded>` that writes `data-open`
 * on the wrapper, and the file argues for it at length — *"driven by
 * `[data-open]` alone: there is no `:hover`, no `:focus-within`"*, because a
 * build that opened on both made a second click close and immediately reopen it.
 * That pattern satisfies G189 BETTER than focus-open does — Enter reaches it and
 * so does a tap — and a focus-only reading calls all four unreachable. A
 * detector that fails the better pattern teaches people to write the worse one.
 *
 * 🛑 AND THE ASSERTION IS KEYED ON HIDING, NOT ON A CLASS NAME. `.tip--static`
 * in overlays.html and states.html is a picture OF a tooltip, drawn open beside
 * the thing it documents, with no trigger and nothing concealed; wayfinding.html
 * draws one more as `role="presentation" aria-hidden="true"` inside a flow
 * diagram. Nine such specimens exist across the six sheets. G189 protects
 * against *a reason that lives under a pointer* — a thing that is ALWAYS VISIBLE
 * conceals no reason, so `visibleAtRest` is reported and not charged. Excluding
 * them by matching `--static` would key the rule on a landmark instead of the
 * property, which is the §5 shape this repository catalogues.
 *
 * 🛑 AND VISIBILITY IS MEASURED AS GEOMETRY, NOT ONLY AS opacity/visibility/
 * display. filtering.html hides its shut tooltip with
 * `clip-path:inset(50%);width:1px;height:1px;overflow:hidden` — on purpose, and
 * it says so in the file: *"shut: 1px and clipped, so it is still IN the
 * accessibility tree and reaches a screen reader through aria-controls"*. That
 * element reports `display:inline`, `visibility:visible`, `opacity:1`. The
 * three-property test called all four of them VISIBLE AT REST, and the
 * assertion — which only reaches a tip that HIDES — therefore skipped every one
 * of them. A hover-only tooltip hidden this way would have walked straight
 * through. A box 4px or smaller in either axis is not something a person reads.
 */
export const readTips = (): {
  id: string; trigger: string; hiddenAtRest: boolean
  opensOnFocus: boolean; opensOnClick: boolean
}[] => {
  const NATIVE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'
  const out: {
    id: string; trigger: string; hiddenAtRest: boolean
    opensOnFocus: boolean; opensOnClick: boolean
  }[] = []
  const visible = (el: Element): boolean => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    if (parseFloat(cs.opacity) <= 0.5) return false
    const r = el.getBoundingClientRect()
    return r.width > 4 && r.height > 4
  }
  for (const tip of document.querySelectorAll('[role="tooltip"],.tip')) {
    const wrap = tip.closest('.tw,.tipwrap') ?? tip.parentElement
    const trigger = wrap === null ? null : wrap.querySelector(NATIVE)
    const pinnedTw = wrap !== null && wrap.getAttribute('data-open') === 'true'
    const pinnedTrigger = trigger !== null && trigger.hasAttribute('data-tip-open')
    if (pinnedTw) wrap.removeAttribute('data-open')
    if (pinnedTrigger && trigger !== null) trigger.removeAttribute('data-tip-open')
    const restSeen = visible(tip)
    let focusSeen = false
    let clickSeen = false
    if (trigger !== null) {
      ;(trigger as HTMLElement).focus()
      focusSeen = visible(tip)
      if (!focusSeen) {
        /* Press it. The page's own handler runs, so this measures the pattern
           the page SHIPS rather than a selector guessed at from the source. The
           second click restores whatever state the first one left. */
        ;(trigger as HTMLElement).click()
        clickSeen = visible(tip)
        ;(trigger as HTMLElement).click()
      }
      ;(trigger as HTMLElement).blur()
    }
    if (pinnedTw && wrap !== null) wrap.setAttribute('data-open', 'true')
    if (pinnedTrigger && trigger !== null) trigger.setAttribute('data-tip-open', '')
    out.push({
      id: tip.id === '' ? '(no id)' : tip.id,
      trigger: trigger === null ? 'NONE' : trigger.tagName.toLowerCase(),
      hiddenAtRest: !restSeen,
      opensOnFocus: focusSeen,
      opensOnClick: clickSeen,
    })
  }
  return out
}

/**
 * §3 · THE INDICATOR COUNT, AND IT COUNTS KINDS RATHER THAN INSTANCES.
 *
 * 🛑 THE OBVIOUS READING OF *"one line and one dot per view"* CANNOT BE ASSERTED
 * ON THESE FILES AND SAYING SO IS PART OF THE MEASUREMENT. A route file is a
 * CONTACT SHEET: finding.html draws seven meters because it draws seven states
 * of one screen. Counting instances per page fails a file for being
 * documentation. Counting instances per `.frame` fails too — the meters and the
 * connection lights on four of the six routes sit OUTSIDE every `.frame`.
 *
 * So the property asserted is the one that actually protects the system: ONE
 * KIND of line and ONE KIND of dot. Every line-shaped mark must be owned by
 * `.meter` and every dot-shaped mark by `.conn`. A progress bar is a second KIND
 * of line; an unread badge is a second KIND of dot.
 *
 * A LINE is a FILLED bar 2–4px tall and >3x as wide. A DOT is a painted mark
 * <=20px across whose radius makes it a circle — and it may be a RING, because
 * two of the connection light's four marks carry no background at all.
 *
 * ⚠️ THE 2px FLOOR IS A CORRECTION AND IT IS MEASURED, NOT ASSUMED. Four of the
 * six routes put a 1px `--rule` divider between the groups of their account
 * menu, and PREPARE opens those menus, so the first run reported `.sep` as a
 * second indicator on four routes. IT IS A RULE, NOT A MARK: this system draws
 * 1px `--rule` hairlines on almost every panel edge, and the meter is 3px. CLEAN
 * carries a 1px divider so the boundary is witnessed from below, and the planted
 * bar is 3px so it is witnessed from above.
 */
export const readIndicators = (): { strayLines: string[]; strayDots: string[]; owned: number } => {
  const strayLines: string[] = []
  const strayDots: string[] = []
  let owned = 0
  const name = (el: Element, p: string): string => {
    const own = typeof el.className === 'string' && el.className.trim() !== ''
      ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName.toLowerCase()
    return `${el.id === '' ? '' : '#' + el.id}${own}${p}`
  }
  for (const el of document.querySelectorAll('*')) {
    for (const p of ['', '::before', '::after']) {
      const cs = getComputedStyle(el, p === '' ? undefined : p)
      if (p !== '' && cs.content === 'none') continue
      const w = parseFloat(cs.width)
      const h = parseFloat(cs.height)
      if (!isFinite(w) || !isFinite(h)) continue
      const fill = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
      const mark = fill || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0
      const r = cs.borderRadius
      const isLine = fill && h >= 2 && h <= 4 && w > h * 3
      const isDot = mark && w > 0 && w <= 20
        && (r.includes('50%') || parseFloat(r) >= w / 2)
      if (isLine) {
        if (el.closest('.meter') !== null) owned++
        else strayLines.push(name(el, p))
      }
      if (isDot) {
        if (el.closest('.conn') !== null) owned++
        else strayDots.push(name(el, p))
      }
    }
  }
  return { strayLines: [...new Set(strayLines)], strayDots: [...new Set(strayDots)], owned }
}

/**
 * §5 · THE NOT-BUILT HATCH. Two properties, because the treatment has failed
 * both ways: the hatch has died to a `background:` shorthand while the ::after
 * word went on saying NOT BUILT — a refused feature rendering as an ordinary one
 * — and a mark can carry the hatch while naming no decision at all.
 */
export const readHatch = (): { total: number; bad: string[] } => {
  const bad: string[] = []
  const all = document.querySelectorAll('.nb')
  for (const el of all) {
    const cs = getComputedStyle(el)
    const word = (el.getAttribute('data-nb') ?? '').trim()
    const after = getComputedStyle(el, '::after').content
    const own = `${el.tagName.toLowerCase()}${el.id === '' ? '' : '#' + el.id}.${String(el.className).trim()}`
    if (cs.backgroundImage === 'none') bad.push(`UNPAINTED ${own}`)
    if (word === '' || after === 'none' || after === 'normal' || after === '""') {
      bad.push(`NO WORD ${own} data-nb="${word}" ::after=${after}`)
    }
  }
  return { total: all.length, bad }
}

/** §6 · RADIUS is 0 everywhere except the connection light and the mark. */
export const readRadius = (): string[] => {
  const stray: string[] = []
  for (const el of document.querySelectorAll('*')) {
    for (const p of ['', '::before', '::after']) {
      const cs = getComputedStyle(el, p === '' ? undefined : p)
      if (p !== '' && cs.content === 'none') continue
      const r = cs.borderRadius
      if (r === '' || /^0px( 0px)*$/.test(r)) continue
      const w = parseFloat(cs.width)
      const h = parseFloat(cs.height)
      if (!isFinite(w) || w === 0 || !isFinite(h) || h === 0) continue
      if (el.closest('.conn') !== null) continue
      if (el.closest('.logo') !== null || el.classList.contains('badge')) continue
      const own = typeof el.className === 'string' && el.className.trim() !== ''
        ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName.toLowerCase()
      stray.push(`${own}${p}=${r}`)
    }
  }
  return [...new Set(stray)]
}

/**
 * §4 · HUE. Every colour the page PAINTS, with one element that paints it, so
 * the comparison against the kernel's palette can happen in node where the
 * kernel's text is readable. A colour outside the palette is the red, the amber
 * or the traffic-light green arriving.
 *
 * ⚠️ A BORDER COLOUR IS NOT PAINTED UNTIL A BORDER IS. Every `<table>` on every
 * route reports the UA default `rgb(128,128,128)` on a border whose style is
 * `none`. Reading the colour alone said all six routes carried an off-palette
 * hue; reading width and style with it says none do.
 */
export const readColours = (): [string, string][] => {
  const seen = new Map<string, string>()
  const name = (el: Element, p: string): string => {
    const own = typeof el.className === 'string' && el.className.trim() !== ''
      ? '.' + el.className.trim().split(/\s+/)[0] : ''
    return `${el.tagName.toLowerCase()}${el.id === '' ? '' : '#' + el.id}${own}${p}`
  }
  const add = (key: string, where: string): void => { if (!seen.has(key)) seen.set(key, where) }
  const triple = (v: string): string | null => {
    const n = v.match(/[\d.]+/g)
    if (n === null || n.length < 3) return null
    if (n.length === 4 && Number(n[3]) === 0) return null
    return `${n[0]},${n[1]},${n[2]}`
  }
  const EDGES: [string, string, string][] = [
    ['borderTopColor', 'borderTopWidth', 'borderTopStyle'],
    ['borderBottomColor', 'borderBottomWidth', 'borderBottomStyle'],
    ['borderLeftColor', 'borderLeftWidth', 'borderLeftStyle'],
    ['borderRightColor', 'borderRightWidth', 'borderRightStyle'],
    ['outlineColor', 'outlineWidth', 'outlineStyle'],
  ]
  for (const el of document.querySelectorAll('*')) {
    for (const p of ['', '::before', '::after']) {
      const cs = getComputedStyle(el, p === '' ? undefined : p) as unknown as Record<string, string>
      if (p !== '' && cs['content'] === 'none') continue
      const box = el.getBoundingClientRect()
      if (p === '' && box.width === 0 && box.height === 0) continue
      for (const prop of ['color', 'backgroundColor']) {
        const t = triple(cs[prop] ?? '')
        if (t !== null) add(t, `${name(el, p)} ${prop}`)
      }
      for (const [prop, width, style] of EDGES) {
        if (parseFloat(cs[width] ?? '0') === 0 || cs[style] === 'none') continue
        const t = triple(cs[prop] ?? '')
        if (t !== null) add(t, `${name(el, p)} ${prop}`)
      }
      for (const src of ['backgroundImage', 'boxShadow']) {
        for (const m of (cs[src] ?? '').matchAll(/rgba?\(([^)]*)\)/g)) {
          const t = triple(m[1] ?? '')
          if (t !== null) add(t, `${name(el, p)} ${src}`)
        }
      }
    }
  }
  return [...seen.entries()]
}

/** §4b · A state must carry a WORD, not only a colour. */
export const readStateWords = (): string[] => {
  const out: string[] = []
  for (const el of document.querySelectorAll('[data-state],[aria-pressed],[data-nb],.is-on')) {
    const text = (el.textContent ?? '').trim()
    const label = el.getAttribute('aria-label') ?? ''
    const nb = el.getAttribute('data-nb') ?? ''
    if (text === '' && label === '' && nb === '') {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).trim()} ` +
        `state=${el.getAttribute('data-state') ?? el.getAttribute('aria-pressed') ?? '-'}`)
    }
  }
  return out
}

/**
 * §7 · CONTRAST, on the ground the text ACTUALLY SITS ON — which is the whole
 * difficulty. See trap 3 in this file's header for why the walk reads gradient
 * stop alphas instead of stopping at the first `background-image`, and why the
 * grounds it still cannot read are RETURNED AND COUNTED rather than assumed
 * safe. A detector that silently skips is worse than no detector.
 *
 * ⚠️ THE FAILURE LIST IS DE-DUPLICATED AND THE UNMEASURABLE COUNT IS NOT. One
 * repeated `.mono` cell is one finding to repair; nine unreadable grounds are
 * nine elements nobody has an answer for, and collapsing them would understate
 * the blind spot this detector exists to make honest.
 *
 * 🛑 TRAP FOUR, AND design/system/overlays.html FOUND IT: THE GROUND CAN BE A
 * POSITIONED SIBLING, AND AN ANCESTOR WALK CANNOT SEE ONE. `.frame .scrim` is
 * `position:absolute;inset:0;background:var(--scrim)` — `rgba(0,48,63,.38)` —
 * and the label that sits ON it is its NEXT SIBLING, not its child. The walk
 * climbed straight past the scrim to `--paper` and reported the label at
 * 1.66:1. The true figure, measured by screenshotting the page and reading the
 * pixel back through a canvas, is rgb(158,176,182) and **1.36:1** — the walk was
 * not merely wrong, it was wrong in the FLATTERING direction.
 *
 * So the walk now composites. Every positioned element that PAINTS, covers the
 * text's centre, and PRECEDES it in document order is part of the ground and is
 * alpha-composited onto whatever the ancestor walk found. One that FOLLOWS the
 * text paints OVER it and is returned as unmeasurable rather than guessed at.
 * §0 plants both directions: light text on a scrim must fail, ink text on the
 * same scrim must pass, or this is compositing that always says no.
 */
export const readContrast = (): { fails: string[]; unmeasurable: string[] } => {
  const lum = (c: string): number => {
    const m = (c.match(/[\d.]+/g) ?? []).map(Number)
    const f = (raw: number): number => {
      const v = raw / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(m[0] ?? 0) + 0.7152 * f(m[1] ?? 0) + 0.0722 * f(m[2] ?? 0)
  }
  /** A gradient every stop of which is under .2 alpha is a TEXTURE — trap 3. */
  const textureOnly = (img: string): boolean => {
    if (img === 'none') return true
    if (/rgb\(/.test(img)) return false
    const alphas = [...img.matchAll(/rgba\(([^)]*)\)/g)]
      .map((m) => Number((m[1] ?? '').split(',')[3]))
    return alphas.length > 0 && Math.max(...alphas) <= 0.2
  }
  const ancestorGround = (el: Element): string | null => {
    let n: Element | null = el
    while (n !== null && n !== document.documentElement) {
      const cs = getComputedStyle(n)
      if (!textureOnly(cs.backgroundImage)) return null
      const m = cs.backgroundColor.match(/[\d.]+/g)
      if (m !== null && (m.length < 4 || Number(m[3]) > 0.5)) return cs.backgroundColor
      n = n.parentElement
    }
    return 'rgb(255, 255, 255)'
  }
  /* Positioned painters, collected ONCE. Few enough on every page here that the
     per-text-element scan below is a rounding error, and collecting them inside
     the loop would be quadratic over 2000 elements. */
  const painters: { el: Element; rect: DOMRect; bg: string; img: string }[] = []
  for (const p of document.querySelectorAll('*')) {
    const cs = getComputedStyle(p)
    if (cs.position === 'static') continue
    /* An INVISIBLE painter paints nothing. A tooltip at rest is `opacity:0` and
       its box still sits over whatever is under it; counting it as a ground
       would make every line beside a closed tip unmeasurable. */
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    if (parseFloat(cs.opacity) < 0.5) continue
    const m = cs.backgroundColor.match(/[\d.]+/g)
    const paints = (m !== null && (m.length < 4 || Number(m[3]) > 0)) || cs.backgroundImage !== 'none'
    if (!paints) continue
    const rect = p.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    painters.push({ el: p, rect, bg: cs.backgroundColor, img: cs.backgroundImage })
  }
  const over = (base: string, layer: string): string | null => {
    const b = (base.match(/[\d.]+/g) ?? []).map(Number)
    const l = (layer.match(/[\d.]+/g) ?? []).map(Number)
    if (b.length < 3 || l.length < 3) return null
    const a = l.length === 4 ? (l[3] ?? 1) : 1
    return `rgb(${[0, 1, 2].map((i) => Math.round(a * (l[i] ?? 0) + (1 - a) * (b[i] ?? 0))).join(', ')})`
  }
  /**
   * 🛑 SIBLINGS ONLY, AND THE FIRST DRAFT DID NOT SAY SO. It composited any
   * positioned painter that covered the text and preceded it in document order,
   * which is FLATLY WRONG about how a page paints: a positioned element paints
   * ABOVE in-flow content in the same stacking context whatever the source order
   * says. PREPARE opens every tooltip, an opened tooltip is an opaque `--ink`
   * panel, and the routes suite immediately went red with eleven readings like
   * `.it rgb(0,48,63) on rgb(0,48,63) = 1.00:1` — text composited onto a tip
   * that floats over it rather than sitting under it. Caught by running the
   * suite the change was not aimed at, which is the only reason it is not in
   * this commit.
   *
   * The narrow rule is the one trap 4 actually names: among positioned SIBLINGS
   * sharing a parent, source order decides, and the scrim in overlays.html is
   * exactly that. Everything else is left to the ancestor walk untouched — so
   * this is a strict addition to what #278 measured, never a reinterpretation
   * of it.
   */
  const ground = (el: Element, box: DOMRect): string | null => {
    let bg = ancestorGround(el)
    if (bg === null) return null
    if (getComputedStyle(el).position === 'static') return bg
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    for (const p of painters) {
      if (p.el === el || p.el.parentElement !== el.parentElement) continue
      if (cx < p.rect.left || cx > p.rect.right || cy < p.rect.top || cy > p.rect.bottom) continue
      /* DOCUMENT_POSITION_FOLLOWING = 4. A sibling after the text paints OVER
         it; nothing here can read through that, so it is COUNTED. */
      if ((el.compareDocumentPosition(p.el) & 4) !== 0) return null
      if (!textureOnly(p.img)) return null
      const next = over(bg, p.bg)
      if (next === null) return null
      bg = next
    }
    return bg
  }
  const fails: string[] = []
  const unmeasurable: string[] = []
  for (const el of document.querySelectorAll('*')) {
    let text = ''
    for (const node of el.childNodes) if (node.nodeType === 3) text += node.textContent ?? ''
    if (text.trim().length < 2) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    if (parseFloat(cs.opacity) < 0.5) continue
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    const bg = ground(el, box)
    if (bg === null) {
      /* NAMED, not merely tallied. A bare number says how big the blind spot is;
         it does not say whether the same six elements are in it as yesterday. */
      const own = typeof el.className === 'string' && el.className.trim() !== ''
        ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase()
      unmeasurable.push(`${own} "${text.trim().slice(0, 24)}"`)
      continue
    }
    const fg = cs.color
    if (!fg.startsWith('rgb') || !bg.startsWith('rgb')) continue
    const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05)
    const size = parseFloat(cs.fontSize)
    const weight = Number(cs.fontWeight) || 400
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5
    if (ratio < need) {
      const own = typeof el.className === 'string' && el.className.trim() !== ''
        ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase()
      fails.push(`${own} ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (needs ${need}) · ` +
        `"${text.trim().slice(0, 34)}"`)
    }
  }
  return { fails: [...new Set(fails)], unmeasurable }
}

// ═══ THE PALETTE, DERIVED FROM THE KERNEL ═════════════════════════════════

/**
 * Every colour tokens.css declares, as an `r,g,b` triple. ALPHA IS DROPPED ON
 * PURPOSE: `--track` is `--agent` at .16 and `--scrim` is `--ink` at .38, so a
 * token used at a different opacity is the same HUE and this is about hue. Black
 * and white are added because a UA default is not a palette decision.
 *
 * Read from the file rather than restated — a list of hexes in a test file is a
 * second palette that goes on passing after the first one moves.
 */
export function palette(): Set<string> {
  const css = readFileSync(KERNEL, 'utf8')
  const out = new Set(['0,0,0', '255,255,255'])
  for (const m of css.matchAll(/--[a-z0-9-]+:\s*(#[0-9a-fA-F]{3,8}|rgba?\(([^)]*)\))/g)) {
    const raw = m[1] ?? ''
    if (raw.startsWith('#')) {
      let h = raw.slice(1)
      if (h.length === 3) h = h.split('').map((c) => c + c).join('')
      out.add(`${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`)
    } else {
      const p = (m[2] ?? '').split(',').map((s) => s.trim())
      out.add(`${p[0]},${p[1]},${p[2]}`)
    }
  }
  return out
}

// ══════════════════════════════════════════════════════════════════════════
// §0 · THE DETECTORS, WITNESSED IN BOTH DIRECTIONS.
//
// A detector is not trusted for finding nothing until it has been shown to find
// something. Every plant below is an INLINE `style=` or a local `<style>`, never
// a utility class: tests/design/kernel-under-tailwind.test.ts records a
// `bg-agent` intruder that COMPILED TO NOTHING and a negative control that
// passed while catching neither of its two plants.
// ══════════════════════════════════════════════════════════════════════════

/**
 * The marks as the kernel spells them, plus the two patterns the kernel does NOT
 * declare and every route restates: the tooltip, and a menu divider.
 *
 * ⚠️ THE BUTTON RULE HERE IS NOT DECORATION AND IT IS A FINDING. tokens.css
 * styles `input,select,textarea` and NOT `button`, so a bare `<button>` paints
 * the UA `buttonface` grey — `rgb(239,239,239)`, off-palette by definition. The
 * colour detector reported it on the first run and it was right to. Every route
 * and every specimen styles its own buttons, so no shipped file carries it; this
 * fixture has to, or the negative control fails on a defect no page has. The gap
 * in the kernel is real and is written down rather than closed by a test file.
 *
 * The 1px divider is the LOWER witness for the line detector's 2px floor — see
 * readIndicators. Take it out and the floor is asserted in one direction only.
 */
export const CLEAN = `
<style>
button{background:var(--paper);border:1px solid var(--rule-strong);color:var(--ink)}
.tw{position:relative;display:inline-flex}
.tip{position:absolute;top:100%;left:0;opacity:0;pointer-events:none;
  background:var(--ink);color:var(--on-ink);padding:4px}
.tw:focus-within > .tip,.tw[data-open="true"] > .tip{opacity:1;pointer-events:auto}
/* The disclosure exactly as design/system/filtering.html spells it — SHUT is
   1px and clipped rather than transparent, so the bubble stays in the
   accessibility tree. This is here because the three-property visibility test
   read that state as OPEN and skipped the assertion entirely. */
.dw{position:relative;display:inline-flex}
.dw > .tip{opacity:1;clip-path:inset(50%);width:1px;height:1px;overflow:hidden;padding:0}
.dw[data-open="true"] > .tip{clip-path:none;width:max-content;height:auto;
  overflow:visible;padding:4px;pointer-events:auto}
.sep{height:1px;width:200px;background:var(--rule)}
.scrimbox{position:relative;width:220px;height:44px;background:var(--paper)}
.scrimlayer{position:absolute;inset:0;background:var(--scrim)}
.on-scrim{position:absolute;left:6px;top:6px;color:var(--ink)}
</style>
<span class="meter" style="--score:40%;--floor:60%"><b class="v">40</b></span>
<span class="conn" data-state="up"><i aria-hidden="true"></i> <b>ERP live</b></span>
<div class="nb" data-nb="not built">a refused thing</div>
<ul class="menu"><li class="sep"></li><li><button type="button">a delegated item</button></li></ul>
<span class="tw"><button type="button" aria-describedby="t1">why</button>
  <span class="tip" role="tooltip" id="t1">because</span></span>
<span class="dw"><button type="button" class="dt" aria-expanded="false"
  aria-controls="t3">what</button><span class="tip" role="tooltip" id="t3">a disclosure</span></span>
<div class="scrimbox">
  <span class="scrimlayer"></span>
  <span class="on-scrim">ink on a scrim</span>
</div>
<span class="cbwrap"><input id="cb-input" type="text" role="combobox"
  aria-controls="cb-list" aria-expanded="true" aria-label="find">
  <div id="cb-list" role="listbox" aria-label="results"></div></span>
<a href="#end">an ordinary link</a>
<main id="end">content</main>
<script>
/* The delegated listener the combobox pattern puts on its listbox. Reached by
   ↑↓ through aria-activedescendant, never by Tab. */
document.getElementById('cb-list').addEventListener('click', function () {})
/* The disclosure filtering.html ships, in miniature: [data-open] written by a
   CLICK, with no :hover and no :focus-within route. It is here so the tooltip
   detector is witnessed against the pattern this system actually uses. */
document.querySelector('.dt').addEventListener('click', function () {
  var w = this.parentElement
  var open = w.getAttribute('data-open') === 'true'
  if (open) w.removeAttribute('data-open'); else w.setAttribute('data-open', 'true')
  this.setAttribute('aria-expanded', String(!open))
})
</script>
`

/** Each plant is one defect, spelled the way it actually arrives. */
export const PLANTED = `
<style>
.hover-tip{position:relative;display:inline-flex}
.hover-tip > .ht{position:absolute;top:100%;left:0;opacity:0;
  background:var(--ink);color:var(--on-ink)}
.hover-tip:hover > .ht{opacity:1}
/* The same defect wearing filtering.html's clothes: shut by CLIP rather than by
   opacity, opened by :hover and nothing else. The three-property visibility
   test called this state visible, so the assertion never reached it. */
.clip-tip{position:relative;display:inline-flex}
.clip-tip > .ct{position:absolute;top:100%;left:0;background:var(--ink);
  color:var(--on-ink);clip-path:inset(50%);width:1px;height:1px;overflow:hidden}
.clip-tip:hover > .ct{clip-path:none;width:max-content;height:auto;
  overflow:visible;padding:4px}
</style>
<div id="a-second-line" style="height:3px;width:120px;background:#00303f"></div>
<span id="a-second-dot" style="display:inline-block;width:8px;height:8px;
  border-radius:50%;background:#00303f"></span>
<a href="#end" id="ring-eater" style="outline:none;box-shadow:inset 0 0 0 1px #00303f">erases the ring</a>
<a href="#end" id="ring-shadow-only" style="box-shadow:inset 0 0 0 1px #00303f">owns an edge, cannot erase the ring</a>
<div id="hatch-erased" class="nb" data-nb="not built" style="background-image:none">gone</div>
<div id="hatch-silent" class="nb">no decision named</div>
<div id="rounded" style="width:40px;height:40px;border-radius:6px;background:#f1f7f7"></div>
<span id="amber" style="color:#b26a00">amber, which this system does not have</span>
<span id="wordless" data-state="failed" style="display:inline-block;width:9px;height:9px"></span>
<span id="faint" style="color:#a4b8bb">a caption nobody can read</span>
<div id="div-button" role="button">a div that is a button</div>
<script>document.getElementById('div-button').addEventListener('click', function () {})</script>
<span class="hover-tip"><span>hover me</span><span class="ht" role="tooltip" id="t2">only on hover</span></span>
<span class="clip-tip"><button type="button">hover me too</button><span class="ct" role="tooltip" id="t4">clipped, and only on hover</span></span>
<div class="scrimbox">
  <span class="scrimlayer"></span>
  <span class="on-scrim" id="scrim-faint" style="color:var(--on-ink-2)">on-ink-2 on a scrim</span>
</div>
<div id="orphan-list" role="listbox" aria-label="nothing controls this"></div>
<script>
/* The same empty delegated container, with NO focusable element pointing at it.
   The combobox exemption must not reach this one. */
document.getElementById('orphan-list').addEventListener('click', function () {})
</script>
`

/**
 * THE WITNESS SUITE. Called by every rendered audit rather than copied into it —
 * a plant proven in one file and not the other is exactly the drift this module
 * exists to prevent. `label` names the caller so a red run says which suite was
 * running when the detector went blind.
 */
export function witnessDetectors(label: string, skip: false | string): void {
  describe(`0 · the detectors catch what they are for (${label})`, { skip }, () => {
    it('the ring detector reports a ring EATEN and stays quiet on one kept', async () => {
      const k = await kernel()
      const clean = await render(k, CLEAN, readRings)
      assert.deepEqual(clean.bare, [], 'the kernel ring survives on an ordinary link and this said otherwise')
      assert.ok(clean.measured >= 3,
        `the ring detector measured only ${clean.measured} controls on a fixture carrying ` +
        'three — an empty `bare` list from an inert detector is indistinguishable from a ' +
        'clean page, which is the whole reason it returns a count')
      assert.deepEqual(clean.unfocusable, [], 'a fixture control refused focus')
      const planted = await render(k, CLEAN + PLANTED, readRings)
      /* ⚠️ THE PLANT CHANGED PROPERTY ON 22 Aug 2026, G240, AND SO DID THE THING
         IT PROVES. It used to be a bare `box-shadow:inset 0 0 0 1px` — the
         (0,1,0)-against-(0,1,0) collision — because that was enough to replace a
         box-shadow ring. The kernel ring is an `outline` now, so that plant no
         longer erases anything and would have left this witness GREEN WHILE
         MEASURING NOTHING. It now writes `outline:none` inline, which is the one
         way left to leave a focused element bare. */
      assert.ok(planted.bare.some((x) => x.includes('ring-eater')),
        `the planted ring-eater was NOT caught — reported: ${JSON.stringify(planted.bare)}`)
      /* And the old plant is kept beside it with the assertion INVERTED, so this
         witness also fails if the kernel is ever reverted to the box-shadow ring:
         an element that merely owns an edge must keep its ring. */
      assert.ok(!planted.bare.some((x) => x.includes('ring-shadow-only')),
        'an element whose ONLY focus-relevant declaration is its own box-shadow ' +
        'edge was reported bare. Under G240 the kernel ring is an outline and a ' +
        'box-shadow cannot reach it at any specificity — so this failing means ' +
        `the kernel has been reverted. reported: ${JSON.stringify(planted.bare)}`)
    })

    it('the ring detector COUNTS a control it could not focus', async () => {
      /* Trap 2 in the shape that MATTERS. A `[hidden]` control has a 0×0 box and
         never reaches the focus attempt at all — PREPARE un-hides those, which
         is why that half of the trap is handled upstream. `[inert]` is the half
         that survives PREPARE: the control RENDERS, has a box, is walked, and
         then silently refuses focus. The old detector reported it as fine. */
      const k = await kernel()
      const seen = await render(k,
        `${CLEAN}<div inert><a href="#end" id="buried">unreachable</a></div>`, readRings)
      assert.deepEqual(seen.bare, [], 'an inert control was charged as a bare focus stop')
      assert.ok(seen.unfocusable.some((x) => x.includes('buried')),
        `the inert control was NOT counted — it was silently dropped, which is the ` +
        `blind spot this count exists to close: ${JSON.stringify(seen.unfocusable)}`)
    })

    it('the indicator detector reports a second LINE and a second DOT', async () => {
      const k = await kernel()
      const clean = await render(k, CLEAN, readIndicators)
      assert.deepEqual(clean.strayLines, [], 'the meter read as a stray line')
      assert.deepEqual(clean.strayDots, [], 'the connection light read as a stray dot')
      assert.ok(clean.owned > 0, 'the meter and the light painted nothing at all — the probe is inert')
      const planted = await render(k, CLEAN + PLANTED, readIndicators)
      assert.ok(planted.strayLines.some((x) => x.includes('a-second-line')),
        `the planted progress bar was NOT caught: ${JSON.stringify(planted.strayLines)}`)
      assert.ok(planted.strayDots.some((x) => x.includes('a-second-dot')),
        `the planted unread badge was NOT caught: ${JSON.stringify(planted.strayDots)}`)
    })

    it('the hatch detector reports one erased and one wordless', async () => {
      const k = await kernel()
      const clean = await render(k, CLEAN, readHatch)
      assert.deepEqual(clean.bad, [], 'a correctly hatched .nb was reported as a defect')
      assert.equal(clean.total, 1)
      const planted = await render(k, CLEAN + PLANTED, readHatch)
      assert.ok(planted.bad.some((x) => x.startsWith('UNPAINTED') && x.includes('hatch-erased')),
        `the erased hatch was NOT caught: ${JSON.stringify(planted.bad)}`)
      assert.ok(planted.bad.some((x) => x.startsWith('NO WORD') && x.includes('hatch-silent')),
        `the wordless hatch was NOT caught: ${JSON.stringify(planted.bad)}`)
    })

    it('the radius detector reports a corner and spares the light', async () => {
      const k = await kernel()
      assert.deepEqual(await render(k, CLEAN, readRadius), [],
        'the connection light read as a stray radius')
      const planted = await render(k, CLEAN + PLANTED, readRadius)
      assert.ok(planted.some((x) => x.includes('6px')),
        `the planted 6px corner was NOT caught: ${JSON.stringify(planted)}`)
    })

    it('the colour detector reports an amber the kernel does not declare', async () => {
      const k = await kernel()
      const allowed = palette()
      const clean = (await render(k, CLEAN, readColours)).filter(([c]) => !allowed.has(c))
      assert.deepEqual(clean, [], 'a kernel colour was reported off-palette')
      const planted = (await render(k, CLEAN + PLANTED, readColours)).filter(([c]) => !allowed.has(c))
      assert.ok(planted.some(([c]) => c === '178,106,0'),
        `the planted amber was NOT caught: ${JSON.stringify(planted)}`)
    })

    it('the state-word detector reports a state with no word', async () => {
      const k = await kernel()
      assert.deepEqual(await render(k, CLEAN, readStateWords), [],
        'a state carrying a word was reported wordless')
      const planted = await render(k, CLEAN + PLANTED, readStateWords)
      assert.ok(planted.some((x) => x.includes('failed')),
        `the planted wordless state was NOT caught: ${JSON.stringify(planted)}`)
    })

    it('the contrast detector reports text below AA and spares text above it', async () => {
      const k = await kernel()
      const clean = await render(k, CLEAN, readContrast)
      assert.deepEqual(clean.fails, [], 'kernel-coloured text was reported below AA')
      assert.deepEqual(clean.unmeasurable, [], 'a fixture ground went unread')
      const planted = await render(k, CLEAN + PLANTED, readContrast)
      assert.ok(planted.fails.some((x) => x.includes('164, 184, 187')),
        `the planted low-contrast caption was NOT caught: ${JSON.stringify(planted.fails)}`)
    })

    it('the contrast detector composites a POSITIONED SIBLING ground, both ways', async () => {
      /* Trap 4. CLEAN puts `--ink` on a `--scrim` layer that is the text's
         PREVIOUS SIBLING, not its parent; PLANTED puts `--on-ink-2` on the same
         layer. If the walk still climbed to `--paper` the clean one would read
         14.05:1 and the planted one 1.66:1 — both plausible, both wrong. The
         composite ground is rgb(158,176,182), independently confirmed by
         screenshotting overlays.html and reading the pixel back through a
         canvas, and on it the two read 6.25:1 and 1.36:1.
         🛑 THE CLEAN HALF IS THE LOAD-BEARING ONE. Compositing that always
         returned "unmeasurable" would catch the plant and assert nothing. */
      const k = await kernel()
      const clean = await render(k, CLEAN, readContrast)
      assert.ok(!clean.fails.some((x) => x.includes('on-scrim')),
        `ink on a scrim was reported below AA: ${JSON.stringify(clean.fails)}`)
      assert.deepEqual(clean.unmeasurable, [],
        'the scrim ground was returned as unreadable rather than composited — the ' +
        'detector would then catch the plant below while asserting nothing')
      const planted = await render(k, CLEAN + PLANTED, readContrast)
      const hit = planted.fails.find((x) => x.includes('on-scrim'))
      assert.ok(hit !== undefined,
        `the planted on-scrim text was NOT caught: ${JSON.stringify(planted.fails)}`)
      assert.ok(hit.includes('on rgb(158, 176, 182)'),
        `caught, but on the WRONG ground — the composite is rgb(158,176,182): ${hit}`)
    })

    it('the reachability detector reports a click host with no tab stop', async () => {
      /* 🛑 INIT IS THE POINT OF THIS TEST. Without it `window.__clicked` never
         exists in this path, the detector returns [] for a fixture carrying two
         planted click defects, and the old form of this assertion —
         `planted.length === 0 || planted.some(…)` — passed on its first
         disjunct. That is a witness that asserts nothing, on the one branch no
         source read can replace. It is now a positive assertion and INIT is
         installed. */
      const k = await kernel()
      assert.deepEqual(await render(k, CLEAN, readReach, 'no-preference', INIT), [],
        'a delegated menu listener, a combobox listbox or an ordinary control was ' +
        'reported unreachable')
      const planted = await render(k, CLEAN + PLANTED, readReach, 'no-preference', INIT)
      assert.ok(planted.some((x) => x.startsWith('CLICK-NO-KEYBOARD') && x.includes('div-button')),
        `the planted div-with-a-click-handler was NOT caught: ${JSON.stringify(planted)}`)
      assert.ok(planted.some((x) => x.startsWith('CLICK-NO-KEYBOARD') && x.includes('orphan-list')),
        'the combobox exemption swallowed an empty listbox that NOTHING aria-controls — ' +
        `it must clear only the controlled one: ${JSON.stringify(planted)}`)
    })

    it('the tooltip detector passes BOTH shipped patterns and reports a hover-only tip', async () => {
      const k = await kernel()
      const clean = await render(k, CLEAN, readTips)
      assert.deepEqual(
        clean.map((t) => [t.id, t.hiddenAtRest, t.opensOnFocus, t.opensOnClick, t.trigger]),
        [['t1', true, true, false, 'button'], ['t3', true, false, true, 'button']],
        'the two patterns this system ships — the focus-within tip and the ' +
        'aria-expanded CLIPPED disclosure — must BOTH read as hidden at rest and ' +
        'BOTH as reachable. A detector that fails the disclosure teaches people to ' +
        'write the hover-only one; one that reads its shut state as OPEN never ' +
        'asks the question at all.')
      const planted = await render(k, CLEAN + PLANTED, readTips)
      const hoverOnly = planted.find((t) => t.id === 't2')
      assert.ok(hoverOnly !== undefined && !hoverOnly.opensOnFocus && !hoverOnly.opensOnClick,
        `the planted hover-only tooltip was NOT caught: ${JSON.stringify(planted)}`)
      assert.ok(hoverOnly.hiddenAtRest,
        'the hover-only plant read as visible at rest, so the assertion that keys on ' +
        'hiding would never reach it')
      /* The same defect hidden by CLIP rather than by opacity. It is a separate
         plant because the three-property visibility test caught the first and
         was blind to this one, which is how four of filtering.html's tooltips
         went unasserted while the run reported a clean sweep. */
      const clipped = planted.find((t) => t.id === 't4')
      assert.ok(clipped !== undefined && clipped.hiddenAtRest,
        `a 1px clip-path tooltip read as VISIBLE at rest, so nothing below reaches ` +
        `it: ${JSON.stringify(clipped)}`)
      assert.ok(!clipped.opensOnFocus && !clipped.opensOnClick,
        `the clipped hover-only tooltip was NOT caught: ${JSON.stringify(clipped)}`)
    })
  })
}

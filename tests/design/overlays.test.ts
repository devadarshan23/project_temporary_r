/**
 * THE FOUR OVERLAY PRIMITIVES — G247, issue #208 [F-7].
 *
 * 🛑 THE RULING IS ABOUT DIVERGENCE, SO THESE ASSERTIONS ARE ABOUT BEHAVIOUR AND
 * NOT ABOUT MARKUP. `design/system/overlays.html` and its four siblings built
 * these primitives five ways, and the forks that mattered were invisible: three
 * files hid a tooltip with `display:none` and stranded every `aria-describedby`
 * pointing at it; three opened one from a `:focus-visible` selector, so Escape
 * cleared the attribute and left the panel painted. Both LOOK identical in a
 * screenshot. Both are measured here.
 *
 * ⚠️ THE ISSUE NAMES `tests/frontend/overlays.test.ts` AND THIS FILE IS IN
 * `tests/design/`. Stated rather than quietly moved: `tests/frontend/` does not
 * exist, and every harness this file needs — `render.ts`'s browser, `bench.ts`'s
 * bundle, `tabThrough`'s real key presses — is in `tests/design/`. A new
 * directory holding one file that imports all of its machinery from `../design/`
 * would be a second home for render assertions, which is the shape the ruling is
 * about. `tests/ci/reachability-guards.test.ts` walks `tests/` recursively, so
 * the CI guard finds this file in either place.
 *
 * ⚠️ TWO SUITES RUN WITHOUT A BROWSER AND FOUR DO NOT, DELIBERATELY. §0 and §7
 * are source and reducer assertions: they are the ones that must not become
 * unwitnessed on a machine with no chromium, because they carry the two bans
 * (`title=`, and a CSS selector opening a tooltip) that a browser cannot prove
 * absent — a browser can only show that the selector this page happens to
 * exercise did not fire.
 */
import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { browserSkip, closeBrowser, drive, REPO } from './render.ts'
import { overlayBench } from './bench.ts'
import { browserRequiredUnderCi } from '../reachability.ts'
import {
  TOOLTIP_CLOSED,
  tooltipNext,
  type TooltipState,
} from '../../frontend/src/overlays/tooltip.ts'
import { reasonFrom, reasonText } from '../../frontend/src/overlays/reason.ts'

const skip = await browserSkip()

browserRequiredUnderCi('the four overlay primitives (drawer · modal · tooltip · toast)', skip)

after(async () => { await closeBrowser() })

const SRC = join(REPO, 'frontend', 'src')
const OVERLAYS = join(SRC, 'overlays')

/**
 * Strip block and line comments.
 *
 * 🛑 EVERY SOURCE ASSERTION BELOW RUNS ON THIS AND NOT ON THE RAW TEXT, AND THE
 * FIRST DRAFT DID NOT — THREE OF THEM WENT RED AGAINST THEIR OWN PROSE. This
 * repository documents its refusals at length: `Toast.tsx` explains that "the
 * bell is not this", `Tooltip.tsx` explains why the `disabled` attribute is
 * refused, and a grep for `bell` or `disabled` finds every one of those
 * sentences. tokens.css records the identical failure in its own voice — "a grep
 * written INSIDE the file it greps matches the line it is written on" — and the
 * repair there was the same: anchor on the DECLARATION, never on the mention.
 */
function codeOf(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/** Every source file under `frontend/src`, recursively, comments stripped. */
function frontendSources(): Array<{ rel: string; text: string }> {
  const out: Array<{ rel: string; text: string }> = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!/\.(ts|tsx|css)$/.test(entry.name)) continue
      out.push({ rel: full.slice(SRC.length + 1), text: codeOf(readFileSync(full, 'utf8')) })
    }
  }
  walk(SRC)
  return out
}

/**
 * Every JSX attribute named `attr` that sits on an INTRINSIC element — a
 * lowercase tag, which is a real DOM node — rather than on a React component.
 *
 * 🛑 THE DISTINCTION IS THE WHOLE ASSERTION AND THE FIRST DRAFT MISSED IT. `title`
 * is a perfectly good PROP name: `Surface`, `Drawer` and `Modal` all take one, and
 * it becomes an `<h2>`, not an attribute. What G189 refuses is the HTML `title`
 * ATTRIBUTE, which is hover-only. A grep that could not tell `<Drawer title=…>`
 * from `<button title=…>` reported four offences of which none was one, which
 * would have forced the ban to be weakened to make the suite pass — the worst
 * available outcome.
 */
function intrinsicAttributes(text: string, attr: string): string[] {
  const found: string[] = []
  const re = new RegExp(`(^|[\\s{])${attr}\\s*=`, 'g')
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0
    /* Walk back to the opening `<` of this tag and read its name. */
    const open = text.lastIndexOf('<', at)
    if (open === -1) continue
    const name = /^<\s*([A-Za-z][\w.-]*)/.exec(text.slice(open, at))?.[1]
    if (name === undefined) continue
    /* A capitalised tag is a component; a dotted one is a namespaced component. */
    if (/^[a-z]/.test(name) && !name.includes('.')) {
      found.push(`<${name} … ${attr}=…>`)
    }
  }
  return found
}

/** The bench, or a sentence naming the property that went unwitnessed. */
async function bench(property: string): Promise<string> {
  const b = await overlayBench()
  if (typeof b === 'string') return b
  assert.fail(`${property}: ${b.missing}`)
}

// ─────────────────────────────────────────────────────────────────────────────
describe('0 · the two bans, proved from the source rather than from a render', () => {
  /**
   * 🛑 THESE TWO ARE SOURCE ASSERTIONS ON PURPOSE AND IT IS NOT LAZINESS. A
   * render can only show that the selectors THIS page exercises did not fire; it
   * cannot show that no such selector exists. Both bans are absolute — "NO CSS
   * SELECTOR MAY OPEN A TOOLTIP", "`title=` is refused throughout" — so the
   * assertion has to be over the whole surface, which is the text.
   */

  it('no `title=` attribute exists anywhere in frontend/src', () => {
    const files = frontendSources()
    assert.ok(files.length > 10, `nothing to check; found ${files.length} sources`)
    /* The ATTRIBUTE, on a real DOM element — never the prop of the same name.
       See `intrinsicAttributes`: `<Drawer title=…>` is a heading and `<button
       title=…>` is the hover-only attribute G189 refuses. */
    const offenders = files
      .flatMap((f) => intrinsicAttributes(f.text, 'title').map((hit) => `${f.rel}  ${hit}`))
    assert.deepEqual(offenders, [], [
      '`title="…"` is REFUSED throughout frontend/src — NotBuilt.tsx, Person.tsx and',
      'SkipLink.tsx each decline it in their own prose, and those refusals are why the',
      'kernel minted THE TOOLTIP SURFACE (G189). It is hover-only, so it is unreachable',
      'by keyboard and by tap. A tooltip that fell back to it would undo the ruling it',
      'implements.',
    ].join('\n'))
  })

  it('no CSS selector opens a tooltip — not :hover, not :focus-visible, not :focus-within', () => {
    const css = readFileSync(join(SRC, 'overlays.css'), 'utf8')
    assert.ok(css.includes('.tip'), 'overlays.css declares no .tip rule at all')

    /* ⚠️ THE COMBINATOR SET IS ALL THREE, AND THE KERNEL RECORDS WHY. The first
       grep written for this rule in tokens.css looked for `~` and `+`, and MISSED
       shell.html, which used `>`. "A rule keyed on a convenient landmark instead
       of the property it protects is the defect shape CLAUDE.md catalogues." A
       descendant combinator (a space) is included here for the same reason. */
    const lines = css.split('\n')
    const offenders: string[] = []
    for (const [i, line] of lines.entries()) {
      const code = line.split('/*')[0] ?? ''
      if (!/:hover|:focus-visible|:focus-within/.test(code)) continue
      /* A rule is a fork only if the SELECTOR reaches a tip panel. */
      const selector = code.split('{')[0] ?? ''
      if (/\.tip/.test(selector)) offenders.push(`${String(i + 1)}: ${line.trim()}`)
    }
    assert.deepEqual(offenders, [], [
      'THE TOOLTIP\'S OPEN STATE HAS EXACTLY ONE WRITER AND IT IS THE SCRIPT (owner',
      'ruling, 16 Aug 2026, in docs/handoff-pack/tokens.css). A script can clear an',
      'attribute; it cannot clear `:focus-visible`, because pressing Escape does not',
      'move focus — so the attribute says dismissed and the pixels say open, which is',
      'WCAG 2.2 AA 1.4.13 failing while every review of the source says it passes.',
    ].join('\n'))
  })

  it('the tooltip panel is never hidden by display:none or visibility:hidden', () => {
    const css = readFileSync(join(SRC, 'overlays.css'), 'utf8')
    const offenders: string[] = []
    for (const [i, line] of css.split('\n').entries()) {
      const code = line.split('/*')[0] ?? ''
      if (!/display\s*:\s*none|visibility\s*:\s*hidden/.test(code)) continue
      /* Which rule does this declaration belong to? Walk back to the nearest
         selector line. */
      let sel = ''
      for (let j = i; j >= 0; j--) {
        const l = css.split('\n')[j] ?? ''
        if (l.includes('{')) { sel = l.split('{')[0] ?? ''; break }
      }
      if (/\.tip/.test(sel)) offenders.push(`${String(i + 1)}: ${sel.trim()} { ${code.trim()} }`)
    }
    assert.deepEqual(offenders, [], [
      'A display:none or visibility:hidden panel LEAVES THE ACCESSIBILITY TREE, so',
      'every aria-describedby pointing at it resolves to NOTHING and the reason exists',
      'only while it is painted. That turns G189 from a reversal that ADDS a reason',
      'into one that TAKES a reason away from exactly the keyboard and screen-reader',
      'users it was imposed for. Three of the five design files shipped this bug.',
    ].join('\n'))
  })

  it('no refused control carries the `disabled` attribute — aria-disabled, always', () => {
    const files = frontendSources().filter((f) => f.rel.endsWith('.tsx'))
    assert.ok(files.length > 5, `nothing to check; found ${String(files.length)} components`)
    const offenders = files
      .flatMap((f) => intrinsicAttributes(f.text.replace(/aria-disabled/g, 'ariaDisabled'), 'disabled')
        .map((hit) => `${f.rel}  ${hit}`))
    assert.deepEqual(offenders, [], [
      'A truly disabled button is removed from the tab order, so a tooltip on it is',
      'unreachable by keyboard BY CONSTRUCTION — "that is the trap the condition exists',
      'to close." G189 requires aria-disabled="true" instead, so the control keeps its',
      'place in the tab order and its reason stays reachable.',
    ].join('\n'))
  })

  it('the toast and the notification bell share no content and neither imports the other', () => {
    /* CODE, not prose — `Toast.tsx` explains at length that the bell is not this,
       and a grep over the raw text finds every one of those sentences. */
    const toast = codeOf(readFileSync(join(OVERLAYS, 'Toast.tsx'), 'utf8'))
    const chrome = codeOf(readFileSync(join(SRC, 'components', 'ChromeBar.tsx'), 'utf8'))

    assert.ok(!/from '.*ChromeBar/.test(toast), 'the toast imports the chrome bar')
    assert.ok(!/from '.*Toast/.test(chrome), 'the chrome bar imports the toast')

    /* The bell's own words, from the chrome bar's control 5. None may appear in
       the toast — R5: building them as one surface is how a system grows a
       seventh indicator by accident. */
    const bellWords = ['Notifications', 'not counted', 'bell']
    const leaked = bellWords.filter((w) => toast.includes(w))
    assert.deepEqual(leaked, [], [
      '"The bell is not this." A notification is for what happened while you were',
      'looking somewhere else; a toast is the terminal state of an act you just took.',
      'R5 — the six indicators stay six.',
    ].join('\n'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('0a · the tooltip reducer, driven directly', () => {
  /**
   * 🛑 THIS SUITE NEEDS NO BROWSER AND THAT IS THE POINT. `tooltipNext` is total,
   * so every transition can be enumerated rather than sampled at the three a
   * click-through happens to hit. The two guards below were each found by the
   * design record BUILDING IT WRONG FIRST, and neither shows in a screenshot.
   */

  it('the load guard: a focus with no user behind it does not open the panel', () => {
    const restored = tooltipNext(TOOLTIP_CLOSED, { kind: 'focus', userActive: false })
    assert.equal(restored.open, false, [
      'A BROWSER RESTORES FOCUS ON RELOAD, and a restored focus is not a user. Without',
      'this guard a page opens a tooltip before anyone has touched it.',
    ].join('\n'))

    const real = tooltipNext(TOOLTIP_CLOSED, { kind: 'focus', userActive: true })
    assert.equal(real.open, true, 'a real keyboard focus must open it — G189 requires focus to reach it')
  })

  it('the tap guard: focus-then-click leaves the panel OPEN, not closed', () => {
    /* A TAP FOCUSES AND THEN CLICKS. An unguarded pair opens on focus and closes
       on click, and the tap user sees nothing. */
    const focused = tooltipNext(TOOLTIP_CLOSED, { kind: 'focus', userActive: true })
    const tapped = tooltipNext(focused, { kind: 'click', focused: true })
    assert.equal(tapped.open, true, 'a tap opened and immediately closed the panel')
    assert.equal(tapped.pinned, true, 'a tap must PIN, so the pair is additive rather than cancelling')
  })

  it('un-pinning falls back to the focus-shown state and does not force-hide', () => {
    /* The design record corrected exactly this: a keyboard user who pressed Enter
       twice lost the reason WHILE STILL STANDING ON THE CONTROL — on an
       aria-disabled refused button that is a focused control with no visible
       reason, which is what G189's hard condition forbids. */
    let s: TooltipState = tooltipNext(TOOLTIP_CLOSED, { kind: 'focus', userActive: true })
    s = tooltipNext(s, { kind: 'click', focused: true })
    s = tooltipNext(s, { kind: 'click', focused: true })
    assert.equal(s.pinned, false, 'the second press must un-pin')
    assert.equal(s.open, true, [
      'A keyboard user who pressed Enter twice lost the reason while still standing on',
      'the control. Un-pinning falls back to the focus-shown state; it does not hide.',
    ].join('\n'))

    /* And when focus is NOT on the trigger, un-pinning does close it. */
    let t: TooltipState = tooltipNext(TOOLTIP_CLOSED, { kind: 'click', focused: false })
    t = tooltipNext(t, { kind: 'click', focused: false })
    assert.equal(t.open, false, 'un-pinning with focus elsewhere must close the panel')
  })

  it('1.4.13 hoverable and persistent: the pointer may cross onto the panel', () => {
    const open = tooltipNext(TOOLTIP_CLOSED, { kind: 'pointerenter' })
    const onPanel = tooltipNext(open, { kind: 'pointerleave', overPanel: true, focused: false })
    assert.equal(onPanel.open, true, 'a tooltip whose content cannot be reached fails 1.4.13')

    const stillFocused = tooltipNext(open, { kind: 'pointerleave', overPanel: false, focused: true })
    assert.equal(stillFocused.open, true, 'the panel must survive while the trigger holds focus')

    const gone = tooltipNext(open, { kind: 'pointerleave', overPanel: false, focused: false })
    assert.equal(gone.open, false, 'and it must close when the pointer leaves for good')
  })

  it('Escape closes it from every state, pin included', () => {
    const states: TooltipState[] = [
      TOOLTIP_CLOSED,
      { open: true, pinned: false },
      { open: true, pinned: true },
      { open: false, pinned: true },
    ]
    for (const s of states) {
      const after_ = tooltipNext(s, { kind: 'escape' })
      assert.deepEqual(after_, TOOLTIP_CLOSED, [
        `Escape from ${JSON.stringify(s)} left ${JSON.stringify(after_)}.`,
        'A pinned panel surviving Escape is the "attribute says dismissed, pixels say',
        'open" failure arriving through the pin instead of through a CSS selector.',
      ].join('\n'))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('0b · a destructive act cannot be taken without a reason', () => {
  it('reasonFrom refuses blank text and mints from real prose', () => {
    assert.equal(reasonFrom(''), null)
    assert.equal(reasonFrom('   '), null)
    assert.equal(reasonFrom('\n\t '), null)

    const r = reasonFrom('  the preparer is not the reviewer  ')
    assert.notEqual(r, null, 'real prose must mint a Reason')
    assert.equal(r === null ? '' : reasonText(r), 'the preparer is not the reviewer',
      'the trimmed form is what is stored — an SOP amendment is drafted from it')
  })

  it('Modal.onConfirm takes a Reason, so the requirement is in the type', () => {
    /* 🛑 THE COMPILE-TIME HALF IS PROVED BY `npm run typecheck:frontend`, WHICH IS
       IN THE GATE — there is no literal of type `Reason`, so `onConfirm('')` does
       not compile. What this assertion adds is that the SIGNATURE has not been
       widened back to `string`, which is the edit that would silently retire the
       guarantee while every runtime test stayed green. */
    const modal = readFileSync(join(OVERLAYS, 'Modal.tsx'), 'utf8')
    assert.match(modal, /onConfirm:\s*\(reason:\s*Reason\)\s*=>\s*void/, [
      'The modal\'s reason is "product machinery — it is what an SOP amendment would be',
      'drafted from", not a courtesy field. `onConfirm` must take a branded `Reason`:',
      'a required `reason: string` prop is satisfied by `reason=""`, which is the',
      'empty-reason bug it was meant to stop.',
    ].join('\n'))

    const reason = readFileSync(join(OVERLAYS, 'reason.ts'), 'utf8')
    assert.match(reason, /export type Reason = string & \{/, 'Reason must stay branded')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('1 · the drawer opens OVER the register, which keeps its columns', { skip }, () => {
  it('the register\'s column set is unchanged while the drawer is open', async () => {
    const page = await bench('the drawer opening over the register')
    const seen = await drive(page, async (d) => {
      const before = await d.read(() =>
        [...document.querySelectorAll('#register thead th')].map((e) => e.textContent))
      await d.click('#open-drawer')
      const during = await d.read(() => ({
        columns: [...document.querySelectorAll('#register thead th')].map((e) => e.textContent),
        rows: document.querySelectorAll('#register tbody tr').length,
        /* The register must still be THERE and still be laid out — a drawer that
           pushed it aside would reflow, and "it looks the same" is exactly the
           review a reflow passes. */
        registerWidth: document.getElementById('register')?.getBoundingClientRect().width ?? 0,
        drawerOpen: document.querySelectorAll('[data-overlay="drawer"]').length,
      }))
      const beforeWidth = await d.read(() =>
        document.getElementById('register')?.getBoundingClientRect().width ?? 0)
      return { before, during, beforeWidth }
    })

    assert.ok(seen.before.length >= 4, `the bench drew no register columns: ${JSON.stringify(seen.before)}`)
    assert.equal(seen.during.drawerOpen, 1, 'the drawer did not open')
    assert.deepEqual(seen.during.columns, seen.before, [
      'The drawer is "the mechanism behind the product\'s central bet — that Ask is a',
      'capability first and a destination second". It opens OVER the register and never',
      'away from it: the whole argument for asking a question beside the evidence is',
      'that the evidence does not move while you ask.',
    ].join('\n'))
    assert.equal(seen.during.rows, 2, 'the register lost rows while the drawer was open')
    assert.equal(seen.during.registerWidth, seen.beforeWidth,
      'the register reflowed — a drawer must not push it aside')
  })

  it('the page behind is inert and does not scroll while the drawer is open', async () => {
    const page = await bench('the drawer\'s scroll lock and inert background')
    const seen = await drive(page, async (d) => {
      const before = await d.read(() => document.body.style.overflow)
      await d.click('#open-drawer')
      const during = await d.read(() => ({
        overflow: document.body.style.overflow,
        mainInert: document.querySelector('main')?.inert ?? null,
      }))
      await d.press('Escape')
      const after_ = await d.read(() => ({
        overflow: document.body.style.overflow,
        mainInert: document.querySelector('main')?.inert ?? null,
        open: document.querySelectorAll('[data-overlay="drawer"]').length,
      }))
      return { before, during, after: after_ }
    })

    assert.equal(seen.during.overflow, 'hidden', 'the page scrolled behind an open drawer')
    assert.equal(seen.during.mainInert, true, [
      '`aria-modal="true"` is a CLAIM; `inert` is what makes it true. Without it every',
      'control behind the drawer stays clickable and readable by a screen reader.',
    ].join('\n'))
    assert.equal(seen.after.open, 0, 'Escape did not close the drawer')
    assert.equal(seen.after.overflow, seen.before, [
      'The scroll lock was not released. The failure mode is a page left permanently',
      'unscrollable, which no screenshot shows.',
    ].join('\n'))
    assert.equal(seen.after.mainInert, false, [
      '`<main>` was left inert with nothing open — a keyboard trap over the whole page.',
      'The drawn design reached exactly this state by keeping a stack a missed close',
      'event desynchronised.',
    ].join('\n'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('2 · the modal traps focus and restores it to the opener', { skip }, () => {
  it('Tab cycles inside the modal and never reaches the page behind', async () => {
    const page = await bench('the modal\'s focus trap')
    const seen = await drive(page, async (d) => {
      await d.click('#open-modal')
      const stops: Array<{ inside: boolean; where: string }> = []
      /* More presses than the modal has stops, so the cycle must wrap. If the trap
         leaks, one of these lands on the register behind it. */
      for (let i = 0; i < 12; i++) {
        await d.press('Tab')
        stops.push(await d.read(() => {
          const a = document.activeElement
          const dlg = document.querySelector('[role="dialog"]')
          return {
            inside: dlg !== null && a !== null && dlg.contains(a),
            where: a === null ? 'null' : a.tagName.toLowerCase() +
              (typeof a.className === 'string' && a.className !== '' ? '.' + a.className.trim().split(/\s+/).join('.') : ''),
          }
        }))
      }
      return stops
    })

    assert.equal(seen.length, 12, 'the walk did not run')
    const escaped = seen.filter((s) => !s.inside)
    assert.deepEqual(escaped, [], [
      'Focus left the modal. A trap that leaks is the failure that is invisible in',
      'review: the overlay looks modal, and a keyboard user tabs straight out of it',
      'into the register it is supposed to be blocking.',
    ].join('\n'))
    /* The trap must also VISIT more than one control, or a trap that pins focus on
       one element would pass the assertion above while being useless. */
    assert.ok(new Set(seen.map((s) => s.where)).size >= 3,
      `the trap visited only ${String(new Set(seen.map((s) => s.where)).size)} distinct controls`)
  })

  it('focus returns to the opener on the Escape path AND on the Cancel path', async () => {
    const page = await bench('the modal\'s return-focus')

    for (const closeBy of ['escape', 'cancel'] as const) {
      const seen = await drive(page, async (d) => {
        await d.click('#open-modal')
        if (closeBy === 'escape') {
          await d.press('Escape')
        } else {
          /* The visible Cancel, which is the MECHANISM; Escape is the shortcut.
             Both paths must restore, because the mechanism must not depend on a
             key event firing. */
          await d.read(() => {
            const btns = [...document.querySelectorAll('[role="dialog"] button')]
            const cancel = btns.find((b) => b.textContent?.trim() === 'Cancel')
            if (cancel instanceof HTMLElement) cancel.click()
          })
        }
        return d.read(() => ({
          id: document.activeElement?.id ?? '',
          onBody: document.activeElement === document.body,
          open: document.querySelectorAll('[role="dialog"]').length,
        }))
      })

      assert.equal(seen.open, 0, `the modal did not close on the ${closeBy} path`)
      assert.equal(seen.onBody, false, [
        `Closing by ${closeBy} dropped focus to <body>. This is the behaviour G247 names`,
        'as "most often omitted and least often noticed": nothing looks wrong, and the',
        'user\'s next Tab restarts at the top of the document.',
      ].join('\n'))
      assert.equal(seen.id, 'open-modal',
        `closing by ${closeBy} did not return focus to the control that opened it`)
    }
  })

  it('the refused primary carries aria-disabled and refuses OUT LOUD', async () => {
    const page = await bench('the modal\'s refused primary')
    const seen = await drive(page, async (d) => {
      await d.click('#open-modal')
      const before = await d.read(() => {
        const btns = [...document.querySelectorAll('[role="dialog"] button')]
        const primary = btns.find((b) => b.textContent?.trim() === 'Reject')
        const why = document.querySelector('[role="dialog"] [role="status"]')
        return {
          ariaDisabled: primary?.getAttribute('aria-disabled') ?? null,
          hasDisabledAttr: primary?.hasAttribute('disabled') ?? null,
          describedBy: primary?.getAttribute('aria-describedby') ?? null,
          whyId: why?.id ?? null,
          said: why?.textContent?.trim() ?? '',
          /* The refused control must stay reachable by keyboard. */
          tabbable: primary instanceof HTMLElement && primary.tabIndex >= 0,
        }
      })
      await d.read(() => {
        const btns = [...document.querySelectorAll('[role="dialog"] button')]
        const primary = btns.find((b) => b.textContent?.trim() === 'Reject')
        if (primary instanceof HTMLElement) primary.click()
      })
      const after_ = await d.read(() => ({
        said: document.querySelector('[role="dialog"] [role="status"]')?.textContent?.trim() ?? '',
        open: document.querySelectorAll('[role="dialog"]').length,
      }))
      return { before, after: after_ }
    })

    assert.equal(seen.before.ariaDisabled, 'true', 'the refused primary must carry aria-disabled="true"')
    assert.equal(seen.before.hasDisabledAttr, false, [
      'The `disabled` ATTRIBUTE removes the control from the tab order, so its reason',
      'is unreachable by keyboard by construction — "that is the trap the condition',
      'exists to close."',
    ].join('\n'))
    assert.equal(seen.before.tabbable, true, 'the refused control left the tab order')
    assert.equal(seen.before.describedBy, seen.before.whyId,
      'aria-describedby does not resolve to the live region carrying the reason')
    assert.ok(seen.before.said.length > 0,
      'the reason must exist BEFORE the act is attempted — aria-describedby is delivered on focus')
    assert.equal(seen.after.open, 1, 'a refused act must not close the modal')
    assert.notEqual(seen.after.said, seen.before.said, [
      'The refused act said nothing new. A control that is aria-disabled is focusable',
      'and pressable, so a press that silently does nothing reads, from the keyboard,',
      'as a broken button.',
    ].join('\n'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('3 · the tooltip is opened by the script and by nothing else', { skip }, () => {
  it('Escape genuinely dismisses — the panel is flagged shut AND painted shut', async () => {
    /* 🛑 THIS IS THE ASSERTION THE WHOLE TOOLTIP RULING EXISTS FOR, AND IT IS THE
       EXACT BUG THREE DESIGN FILES SHIPPED LIVE. The trigger still holds focus and
       still matches `:focus-visible` when Escape lands. If any CSS selector paints
       the panel, the attribute goes and the pixels stay — "the attribute said
       dismissed and the pixels said open, which is worse than either alone." */
    const page = await bench('Escape dismissing a tooltip')
    const seen = await drive(page, async (d) => {
      /* The walk, recorded. A bare `assert.equal(dataOn, true)` here reports
         `false !== true` and leaves the reader unable to tell a broken tooltip
         from a walk that never arrived or a page that never took focus. */
      const trace: string[] = []
      await d.press('Tab')
      /* Walk to the tooltip's own trigger with real key presses, so
         `:focus-visible` is genuinely granted. */
      for (let i = 0; i < 20; i++) {
        const at = await d.read(() => ({
          id: document.activeElement?.id ?? '',
          tag: document.activeElement?.tagName.toLowerCase() ?? 'null',
          fv: document.activeElement?.matches(':focus-visible') ?? false,
          on: document.querySelector('[data-tip]')?.hasAttribute('data-on') ?? false,
        }))
        trace.push(`${at.tag}#${at.id} focus-visible=${String(at.fv)} data-on=${String(at.on)}`)
        if (at.id === 'tip-figure') break
        await d.press('Tab')
      }
      await d.settle()
      const open = await d.read(() => {
        const t = document.querySelector('[data-tip]')
        return {
          focused: document.activeElement?.id ?? '',
          focusVisible: document.activeElement?.matches(':focus-visible') ?? false,
          dataOn: t?.hasAttribute('data-on') ?? null,
          opacity: t === null ? '' : getComputedStyle(t).opacity,
        }
      })
      await d.press('Escape')
      await d.settle()
      const shut = await d.read(() => {
        const t = document.querySelector('[data-tip]')
        return {
          focused: document.activeElement?.id ?? '',
          focusVisible: document.activeElement?.matches(':focus-visible') ?? false,
          dataOn: t?.hasAttribute('data-on') ?? null,
          opacity: t === null ? '' : getComputedStyle(t).opacity,
          display: t === null ? '' : getComputedStyle(t).display,
          visibility: t === null ? '' : getComputedStyle(t).visibility,
        }
      })
      return { open, shut, trace }
    /* 🛑 `reduce` IS NOT A CONVENIENCE — IT IS WHAT MAKES THE PAINT ASSERTION A
       FACT RATHER THAN A RACE. The panel fades over `--t-fade` (RM-05), so a read taken
       straight after a keystroke measures the previous frame; under the kernel's
       own universal `prefers-reduced-motion` guard every duration collapses to
       `.001ms` and two frames settle it. It also means this assertion exercises
       that guard reaching `.tip`, which nothing else in the record does. */
    }, 'reduce')

    const walk = `\nthe walk was:\n  ${seen.trace.join('\n  ')}`
    assert.equal(seen.open.focused, 'tip-figure', `the walk never reached the tooltip trigger${walk}`)
    assert.equal(seen.open.focusVisible, true,
      `the trigger never got :focus-visible — this page never took keyboard focus${walk}`)
    assert.equal(seen.open.dataOn, true, `a real keyboard focus did not open the tooltip${walk}`)
    assert.equal(seen.open.opacity, '1', `the tooltip was flagged open but not painted${walk}`)

    assert.equal(seen.shut.focused, 'tip-figure', [
      'Escape MOVED FOCUS. WCAG 2.2 1.4.13 is dismissible WITHOUT moving focus, which is',
      'why the tooltip declines the shared return-focus behaviour.',
    ].join('\n'))
    assert.equal(seen.shut.focusVisible, true,
      'the trigger stopped matching :focus-visible, so this run did not exercise the defect')
    assert.equal(seen.shut.dataOn, false, 'the open attribute survived Escape')
    assert.equal(seen.shut.opacity, '0', [
      'THE PANEL IS STILL PAINTED AFTER ESCAPE. The attribute says dismissed and the',
      'pixels say open. Some CSS selector — :hover, :focus-visible or :focus-within —',
      'is opening this panel, and a script cannot clear a CSS state because pressing',
      'Escape does not move focus. This is WCAG 2.2 AA 1.4.13 failing while every',
      'review of the source says it passes.',
    ].join('\n'))
  })

  it('the panel never leaves the accessibility tree, open or shut', async () => {
    const page = await bench('the tooltip staying in the accessibility tree')
    const seen = await drive(page, async (d) => {
      const atRest = await d.read(() => [...document.querySelectorAll('[data-tip]')].map((t) => {
        const cs = getComputedStyle(t)
        return {
          id: t.id,
          display: cs.display,
          visibility: cs.visibility,
          inDom: t.isConnected,
          describedByResolves: [...document.querySelectorAll('[aria-describedby]')]
            .some((c) => c.getAttribute('aria-describedby') === t.id),
          role: t.getAttribute('role'),
        }
      }))
      return atRest
    })

    assert.ok(seen.length >= 2, `expected both tooltips on the bench; found ${String(seen.length)}`)
    for (const t of seen) {
      assert.equal(t.inDom, true, [
        'The panel is not in the DOM at rest. Rendering it conditionally is the React',
        'spelling of display:none: aria-describedby points at an id that does not exist,',
        'and the reason exists only while it is painted.',
      ].join('\n'))
      assert.notEqual(t.display, 'none',
        'display:none removes the panel from the accessibility tree and strands aria-describedby')
      assert.notEqual(t.visibility, 'hidden',
        'visibility:hidden removes the panel from the accessibility tree and strands aria-describedby')
      assert.equal(t.role, 'tooltip', 'the panel must carry role="tooltip"')
      assert.equal(t.describedByResolves, true,
        `nothing points aria-describedby at ${t.id} — the reason is unreachable`)
    }
  })

  it('a refused control states its reason BESIDE it as well as in the tooltip', async () => {
    /* 🛑 G189 IS A REVERSAL AND IT IS ADDITIVE. The issue names this as the
       assertion "a plausible implementation fails": a tooltip is the obvious place
       to move the reason to, and moving it applies the opposite of both positions
       at once. Both halves are required. */
    const page = await bench('the refused control\'s beside-text and tooltip')
    const seen = await drive(page, async (d) => d.read(() =>
      [...document.querySelectorAll('[aria-disabled="true"]')].map((c) => {
        const wrap = c.closest('.refused')
        const beside = wrap?.querySelector('.refused-why')
        const tipId = c.getAttribute('aria-describedby')
        const tip = tipId === null ? null : document.getElementById(tipId)
        return {
          label: c.textContent?.trim().slice(0, 40) ?? '',
          besideText: beside?.textContent?.trim() ?? '',
          besideVisible: beside instanceof HTMLElement && beside.getClientRects().length > 0,
          tipText: tip?.textContent?.trim() ?? '',
        }
      })))

    assert.ok(seen.length > 0, 'the bench drew no refused control at all')
    for (const c of seen) {
      assert.ok(c.besideText.length > 0, [
        `The refused control "${c.label}" has NO reason beside it.`,
        'G189 REVERSES "disabled says why beside it, never in a tooltip" — and the',
        'reversal is ADDITIVE: the reason is still stated beside the control and the',
        'tooltip carries the longer form. "A build that deletes the beside-text because',
        'a tooltip now exists has applied the opposite of both positions at once."',
      ].join('\n'))
      assert.equal(c.besideVisible, true,
        `the beside-text on "${c.label}" is not rendered — a hidden reason is not beside it`)
      assert.ok(c.tipText.length > 0,
        `the refused control "${c.label}" offers no tooltip; G189's added half is missing`)
      assert.notEqual(c.besideText, c.tipText, [
        'The beside-text and the tooltip carry the same words. The tooltip exists to',
        'carry "the longer form the line box has no room for"; if they are identical,',
        'one of the two halves is decoration.',
      ].join('\n'))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('4 · the toast', { skip }, () => {
  it('a failure and a success are announced through different persistent regions', async () => {
    const page = await bench('the toast\'s live regions')
    const seen = await drive(page, async (d) => {
      const atRest = await d.read(() => ({
        polite: document.querySelectorAll('[data-toasts] [role="status"]').length,
        alert: document.querySelectorAll('[data-toasts] [role="alert"]').length,
      }))
      await d.click('#toast-ok')
      await d.click('#toast-fail')
      const raised = await d.read(() => ({
        inPolite: document.querySelector('[data-toasts] [role="status"]')?.querySelectorAll('.toast').length ?? 0,
        inAlert: document.querySelector('[data-toasts] [role="alert"]')?.querySelectorAll('.toast').length ?? 0,
      }))
      return { atRest, raised }
    })

    assert.equal(seen.atRest.polite, 1, [
      'The polite region is not present before anything is raised. A live region created',
      'at the moment it has something to say is a region the screen reader was not',
      'watching, and the first announcement is lost.',
    ].join('\n'))
    assert.equal(seen.atRest.alert, 1, 'the assertive region is not persistent either')
    assert.equal(seen.raised.inPolite, 1, 'the success did not reach the polite region')
    assert.equal(seen.raised.inAlert, 1, [
      'The failure did not reach the assertive region. "A failure is role=alert;',
      'everything else is role=status and polite."',
    ].join('\n'))
  })

  it('dismissing a toast does not drop focus to <body>', async () => {
    /* 🛑 THIS IS THE ONE SURFACE WHERE THE RETURN-FOCUS FAILURE IS GUARANTEED
       RATHER THAN POSSIBLE: dismissing removes the very button that was focused. */
    const page = await bench('the toast\'s return-focus')
    const seen = await drive(page, async (d) => {
      await d.click('#toast-fail')
      await d.read(() => {
        const btns = [...document.querySelectorAll('[data-toasts] button')]
        const dismiss = btns.find((b) => b.textContent?.trim() === 'Dismiss')
        if (dismiss instanceof HTMLElement) { dismiss.focus(); dismiss.click() }
      })
      return d.read(() => ({
        onBody: document.activeElement === document.body,
        where: document.activeElement?.tagName.toLowerCase() ?? 'null',
        left: document.querySelectorAll('[data-toasts] .toast').length,
      }))
    })

    assert.equal(seen.left, 0, 'the toast was not dismissed')
    assert.equal(seen.onBody, false, [
      'Dismissing a toast dropped focus to <body>, so the next Tab restarts at the top',
      'of the document. The shared captureReturnFocus() has a detached-opener branch',
      'for exactly this, and this is its real call site.',
    ].join('\n'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('5 · G240 — every focusable thing in all four primitives is MEASURED', { skip }, () => {
  /**
   * 🛑 TABBED AND MEASURED, NOT REVIEWED. G240 made the ring a real `outline`
   * declared once in the kernel, and the whole argument is that a component's
   * `box-shadow` can no longer replace it at any specificity. That is a claim
   * about every focusable element in these four surfaces, and `:focus-visible` is
   * granted from the input MODALITY — so a probe using `element.focus()` would
   * never evaluate a single ring rule. An audit built that way once reported 712
   * of 712 clean over four real failures.
   */
  it('every focusable stop inside the drawer, the modal and the tooltip carries the outline ring', async () => {
    const page = await bench('the G240 focus ring inside the four primitives')

    const measure = async (open: 'drawer' | 'modal' | null): Promise<Array<{
      where: string; outlineWidth: number; outlineStyle: string; outline: string
    }>> => drive(page, async (d) => {
      if (open !== null) await d.click(open === 'drawer' ? '#open-drawer' : '#open-modal')
      const out: Array<{ where: string; outlineWidth: number; outlineStyle: string; outline: string }> = []
      const stops = await d.read(() => document.querySelectorAll(
        'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),summary').length)
      for (let i = 0; i < Math.min(stops, 25); i++) {
        await d.press('Tab')
        const r = await d.read(() => {
          const e = document.activeElement
          if (e === null || e === document.body || e === document.documentElement) return null
          if (!e.matches(':focus-visible')) return null
          const cs = getComputedStyle(e)
          const cls = typeof e.className === 'string' ? e.className.trim() : ''
          return {
            where: e.tagName.toLowerCase() + (cls === '' ? '' : '.' + cls.split(/\s+/).join('.')),
            outlineWidth: parseFloat(cs.outlineWidth),
            outlineStyle: cs.outlineStyle,
            outline: cs.outline,
          }
        })
        if (r !== null) out.push(r)
      }
      return out
    })

    for (const surface of ['drawer', 'modal', null] as const) {
      const stops = await measure(surface)
      const name = surface ?? 'the bench at rest (register · tooltip · toast triggers)'
      assert.ok(stops.length >= 2,
        `${name}: measured only ${String(stops.length)} focus-visible stops — this assertion witnessed nothing`)
      const bare = stops.filter((s) => !(s.outlineWidth > 0 && s.outlineStyle !== 'none'))
      assert.deepEqual(bare.map((b) => `<${b.where}>  outline=${b.outline}`), [], [
        `${name}: these focusable elements have NO focus ring.`,
        'G240 declares `:focus-visible{outline:2px solid var(--ink);outline-offset:2px}`',
        'ONCE in the kernel, and an outline cannot be replaced by a component box-shadow',
        'at any specificity in any source order. An element with no ring here means the',
        'kernel is not reaching it at all.',
      ].join('\n'))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('6 · the chrome bar\'s account menu restores focus — the gap G247 names', () => {
  it('the account menu is wired to the shared primitive with returnFocus', () => {
    /* 🛑 SOURCE, NOT RENDER, AND THE REASON IS THAT THE BUILT PAGE CANNOT SHOW IT.
       `frontend/dist/shell.html` is pre-rendered static markup with no script, so
       the menu there is the native `<details>` and has no restore to witness — and
       that is deliberate, because a module script cannot load over `file://`. What
       is asserted is that the component reaches the ONE implementation rather than
       growing its own, which is the whole of what the ruling asked for. */
    const chrome = readFileSync(join(SRC, 'components', 'ChromeBar.tsx'), 'utf8')

    assert.match(chrome, /from '\.\.\/overlays\/useOverlay\.ts'/, [
      'ChromeBar.tsx\'s account menu is "a native <details> with no focus restoration on',
      'any close path" — G247 names it as "the same gap arriving before the component',
      'exists", and rules that "a shared primitive fixes it once".',
    ].join('\n'))
    assert.match(chrome, /useOverlay\([^)]*\)/s, 'the account menu does not call the shared primitive')
    assert.match(chrome, /returnFocus:\s*true/, 'the account menu does not take the return-focus behaviour')

    /* And it must still be the native element — the reason it was chosen has not
       changed, and replacing it would break the pre-rendered page. */
    assert.match(chrome, /<details/, [
      'The native <details> was replaced. It exists because the pre-rendered page carries',
      'no script: "a JavaScript disclosure would put the door in the DOM and leave it',
      'unreachable by a person."',
    ].join('\n'))

    /* No second implementation of either behaviour. */
    assert.ok(!/addEventListener\(\s*'keydown'/.test(chrome),
      'the chrome bar grew its own Escape handler — that is a second implementation')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('7 · one implementation of each behaviour, not four', () => {
  /**
   * 🛑 THE RULING'S ACTUAL SUBJECT. Every assertion above measures ONE surface;
   * this one measures that the four surfaces share an implementation, which is
   * what "four behaviours easy to get subtly different and impossible to notice
   * differing" is about. A tree that passed every assertion above with four
   * private copies of the trap would have failed the ruling completely.
   */
  it('the four behaviours are declared in exactly one module', () => {
    const behaviour = readFileSync(join(OVERLAYS, 'behaviour.ts'), 'utf8')
    for (const [what, pattern] of [
      ['the focus trap', /e\.key !== 'Tab'/],
      ['escape handling', /e\.key === 'Escape'/],
      ['the scroll lock', /document\.body\.style\.overflow = 'hidden'/],
      ['return focus', /export function captureReturnFocus/],
    ] as const) {
      assert.match(behaviour, pattern, `${what} is not implemented in behaviour.ts`)
    }
  })

  it('no overlay component implements a behaviour of its own', () => {
    const files = readdirSync(OVERLAYS)
      .filter((f) => f !== 'behaviour.ts' && /\.(ts|tsx)$/.test(f))
      .map((f) => ({ rel: f, text: readFileSync(join(OVERLAYS, f), 'utf8') }))
    assert.ok(files.length >= 6, `found only ${String(files.length)} overlay modules`)

    const offenders: string[] = []
    for (const f of files) {
      /* Strip comments — every one of these behaviours is DISCUSSED at length in
         the prose, and a textual search that counted the prose would be the defect
         this repository keeps catching in its own greps. */
      const code = f.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if (/key === 'Escape'|key !== 'Tab'|style\.overflow\s*=/.test(code)) {
        offenders.push(f.rel)
      }
    }
    assert.deepEqual(offenders, [], [
      'These components implement a behaviour that belongs to behaviour.ts. G247:',
      '"one slice, one implementation of each behaviour, four surfaces over it." A second',
      'copy of a trap or an Escape handler is exactly the divergence the ruling exists to',
      'prevent, and it is invisible: both copies look correct and differ at the edges.',
    ].join('\n'))
  })

  it('each of the four surfaces STATES its answer for all three behaviours', () => {
    /* A surface that omits an answer is a surface that will differ from its
       siblings by omission — which is why `OverlayBehaviours` has no optional
       fields and no defaults. Proved by the typecheck; asserted here so the shape
       is not quietly widened. */
    const behaviour = readFileSync(join(OVERLAYS, 'behaviour.ts'), 'utf8')
    const iface = /export interface OverlayBehaviours \{([\s\S]*?)\n\}/.exec(behaviour)
    assert.notEqual(iface, null, 'OverlayBehaviours is gone')
    const body = iface?.[1] ?? ''
    assert.ok(!/\?\s*:/.test(body), [
      'A behaviour became OPTIONAL. Every surface must state its answer for each of the',
      'three, because a default is how the tooltip would silently acquire return-focus',
      'and start moving focus on Escape — which WCAG 2.2 1.4.13 forbids.',
    ].join('\n'))
    for (const field of ['trapFocus', 'lockScroll', 'returnFocus']) {
      assert.match(body, new RegExp(`readonly ${field}: boolean`), `${field} is not a required answer`)
    }
  })
})

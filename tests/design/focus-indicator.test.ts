/**
 * THE FOCUS INDICATOR AUDIT — every page that links the kernel, tabbed for real.
 *
 * 🛑 WHY THIS FILE EXISTS. The kernel's own header carried the focus ring's
 * ERASABILITY as an open finding from 15 Aug 2026, in these words: the ring is
 * a `box-shadow` at (0,1,0) with `outline:none` and no fallback, so any later
 * rule that declares `box-shadow` on a focused element replaces it outright and
 * leaves NOTHING behind — box-shadow does not accumulate across rules. That was
 * recorded as a HAZARD. It was not a hazard. On 17 Aug 2026 it was measured, by
 * tabbing the record, and it had FOUR live instances — all on
 * design/routes/entry.html, which is the SIGN-IN route: two `.cell` buttons and
 * two form inputs, each showing `outline: none 0px` and its own inset edge and
 * nothing else. WCAG 2.2 AA 2.4.7, failing on the first page a user reaches.
 *
 * ✅ THE MECHANISM IS CLOSED — 22 Aug 2026, G240: the kernel ring is an
 * `outline`, declared once, and the box-shadow form is retired. THIS FILE IS
 * NOT OBSOLETE, IT IS THE CONTROL THAT KEEPS IT CLOSED — and §1 inverted rather
 * than being deleted, so the three attackers that beat the old kernel are now
 * asserted to FAIL against this one. Read the note at the head of
 * fixtures/focus/ring-eaten.html before touching them; a fixture rewritten to
 * agree with the new kernel would prove nothing.
 *
 * Nothing detected them because NOTHING IN THIS REPOSITORY HAD EVER RENDERED
 * design/routes/. `grep -rl 'design/routes' tests/` returned nothing at all.
 * A finding recorded in a comment is not a control; this file is the control.
 *
 * 🛑 WHAT MAKES THIS AUDIT REAL, AND THE FIRST VERSION OF IT WAS NOT.
 *
 * `:focus-visible` is not a state an element is in — it is a state the browser
 * DECIDES it is in, from the modality of the input that moved focus. Chromium
 * withholds it from a programmatic `element.focus()` on a non-text element. So
 * an audit built on `.focus()` never evaluates a single `:focus-visible` rule,
 * which is every ring rule in this system. THE FIRST DRAFT OF THIS AUDIT DID
 * EXACTLY THAT and reported 712 of 712 elements unchanged across a kernel edit,
 * on a record containing the four failures above. It agreed with reality by
 * accident and would have agreed with any kernel whatsoever. `Tab` is pressed
 * for real here — see `tabThrough()` in render.ts, where the same note lives at
 * the seam rather than only in the suite that was burned by it.
 *
 * ⚠️ AND THE PAGE LIST IS DERIVED, NOT LISTED. A hard-coded array of routes is
 * a control that silently stops covering the seventh page the day it is added.
 * The directories are read at run time; a new page is audited because it exists.
 */
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { REPO, SPECIMEN, browserSkip, closeBrowser, tabThrough } from './render.ts'
import { browserRequiredUnderCi } from '../reachability.ts'

const skip = await browserSkip()

browserRequiredUnderCi('the focus-indicator audit and its ring-eater base controls', skip)

after(async () => { await closeBrowser() })

/**
 * THE DETECTOR, and it is deliberately GENEROUS about what counts as an
 * indicator. It accepts the kernel's two-band ring, and it accepts ANY outline
 * — because six specimen files restate the ring as an `outline` and this audit
 * is about whether a keyboard user can see where they are, not about which of
 * the seven spellings got them there. Narrowing it to the kernel ring alone
 * would turn a real accessibility control into a style-consistency check and
 * would go red on five pages that are perfectly usable.
 *
 * ⚠️ It reads the ring by its two BANDS — `0px 0px 0px 2px` and `0px 0px 0px
 * 4px` — rather than by the whole serialised string, because an element that
 * composes `var(--focus-ring)` alongside its own inset edge produces a longer
 * value with the bands inside it. That composition is the repair shape, so a
 * detector keyed on an exact string would reject every repaired element.
 *
 * Serialised to source and re-parsed in the page: it may close over NOTHING.
 */
const readIndicator = () => {
  const e = document.activeElement
  if (e === null || e === document.body || e === document.documentElement) return null
  /* Only `:focus-visible` elements are in scope. An element the browser has
     decided NOT to show a ring on is not a failure — that decision is the whole
     point of the pseudo-class, and flagging it would make this audit red on
     every mouse-focusable control in the record. */
  if (!e.matches(':focus-visible')) return null
  const cs = getComputedStyle(e)
  const bs = cs.boxShadow
  const ring = /0px 0px 0px 2px/.test(bs) && /0px 0px 0px 4px/.test(bs)
  const outline = parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none'
  const cls = typeof e.className === 'string' ? e.className.trim() : ''
  return {
    where: e.tagName.toLowerCase() + (cls === '' ? '' : '.' + cls.split(/\s+/).join('.')),
    ring,
    outline,
    boxShadow: bs.slice(0, 72),
    outlineValue: cs.outline,
  }
}

/**
 * Every page that links the kernel — the PACK and what we BUILD, both.
 *
 * 🛑 THIS WAS BRIEFLY SCOPED TO `frontend/dist/` ALONE AND THE TEST ITSELF
 * REFUSED THAT. Read this before narrowing it again.
 *
 * When `design/` was deleted on 18 Sep 2026 this scanner was re-pointed at
 * `docs/handoff-pack/`, which put a rendering browser on the build pack for the
 * first time and found **34 elements on `C1 Close.dc.html` with no focus
 * indicator at all**. I scoped the scan down to `frontend/dist/` on the
 * reasoning that the pack is a specification rather than shipped bytes — and
 * §2's floor assertion caught it immediately:
 *
 *     UNWITNESSED: 3 pages walked but only 10 focus stops reached. The record
 *     has well over twenty focusable elements, so this is the audit failing to
 *     tab, not the record being small.
 *
 * **That guard exists for precisely this move.** Narrowing a corpus until the
 * audit passes is how a control becomes decorative, and the floor is what makes
 * it cost an exit code instead. The scope is restored and the DEFECT was fixed
 * instead — one line in `docs/handoff-pack/app.css` that overrode the kernel's
 * outline ring with a box-shadow, which every surface button's own box-shadow
 * then overwrote.
 *
 * ⚠️ `frontend/dist/` EXISTS ONLY AFTER `build:frontend`, which `npm run check`
 * runs BEFORE `npm test`. If that order ever changes, the floor above fails
 * loudly rather than this passing over a short list.
 */
function kernelPages(): string[] {
  const out: string[] = []
  for (const dir of [join(REPO, 'docs', 'handoff-pack'), join(REPO, 'frontend', 'dist')]) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) if (f.endsWith('.html')) out.push(join(dir, f))
  }
  return out.sort()
}

/** A stop with neither an indicator nor an outline, rendered as a sentence. */
const bare = (r: { where: string; boxShadow: string; outlineValue: string }): string =>
  `<${r.where}>  outline=${r.outlineValue}  box-shadow=${r.boxShadow}`

// ══════════════════════════════════════════════════════════════════════════
// §1 · THE DETECTOR, WITNESSED — both ways. Green at base; needs no page.
// ══════════════════════════════════════════════════════════════════════════
describe('1 · the ring survives its own attacker, and a bare stop is still caught', { skip }, () => {
  const FIX = join(REPO, 'tests', 'design', 'fixtures', 'focus')

  /**
   * 🛑 THIS ASSERTION INVERTED ON 22 Aug 2026 AND THE FIXTURE IT READS DID NOT
   * MOVE. Until G240 this test required all three planted box-shadow edges to
   * ERASE the ring — that was the defect shape, and catching it was what proved
   * the detector measured anything. The kernel ring is now an `outline`, which
   * a box-shadow cannot replace at any specificity or source order, so the same
   * three attackers must now FAIL. Keeping the attacker byte-for-byte and
   * flipping the expectation is what makes this a regression control for the
   * ruling rather than a fixture rewritten to agree with it: restore the
   * box-shadow ring in the kernel and this goes red on all three.
   */
  it('the three historical ring-eaters can no longer eat the ring', async () => {
    const seen = await tabThrough(join(FIX, 'ring-eaten.html'), readIndicator)

    assert.equal(seen.length, 3,
      'the fixture plants three focusable ring-eaters and the audit reached ' +
      `${seen.length} of them. If this is 0 the audit is walking no elements at ` +
      'all and every clean result it reports elsewhere is worthless.')

    for (const r of seen) {
      assert.ok(r.outline,
        `${r.where} was built to beat a box-shadow focus ring and it still ` +
        `wins: the detector saw outline=${r.outline} ring=${r.ring} ` +
        `(${bare(r)}). G240 made the kernel ring an OUTLINE precisely so that a ` +
        'component minding its own edge cannot reach it. If this is failing, ' +
        'the kernel has been reverted to the box-shadow form, or a rule ' +
        'somewhere is writing `outline:none` again.')
    }
  })

  /**
   * The positive control had to move when the assertion above inverted — with
   * every planted eater now passing, nothing would witness that the detector
   * can report a BARE stop, and §2 would assert "no page has a bare stop"
   * while measuring nothing. That is the §5.6 shape, and it would have arrived
   * as a side effect of a repair. ring-erased.html is the replacement: the one
   * way left to be bare under an outline kernel is to name `outline` and turn
   * it off.
   */
  it('CATCHES all three elements that erase the outline on purpose', async () => {
    const seen = await tabThrough(join(FIX, 'ring-erased.html'), readIndicator)

    assert.equal(seen.length, 3,
      `expected three focusable elements in the fixture and reached ${seen.length}`)

    for (const r of seen) {
      assert.ok(!r.ring && !r.outline,
        `the planted eraser ${r.where} was NOT caught: the detector saw ` +
        `ring=${r.ring} outline=${r.outline}. This fixture is the proof that §2 ` +
        'measures something; if the intruders pass, §2 passing means nothing.')
    }
  })

  it('CLEARS three elements that keep the ring — the negative control', async () => {
    const seen = await tabThrough(join(FIX, 'ring-kept.html'), readIndicator)

    assert.equal(seen.length, 3,
      `expected three focusable elements in the fixture and reached ${seen.length}`)

    for (const r of seen) {
      assert.ok(r.ring || r.outline,
        `${r.where} keeps its ring in the fixture and the detector called it bare: ` +
        `${bare(r)}. A detector that flags EVERYTHING would "catch" the erasers ` +
        'above while asserting nothing, which is why this control exists.')
    }
    /* ⚠️ THIS ASSERTION USED TO REQUIRE TWO OF THE THREE TO COMPOSE
       `var(--focus-ring)` BESIDE THEIR OWN INSET EDGE — the repair shape the
       kernel supported until G240 retired the token. It is replaced, not
       dropped: the property that matters now is the OPPOSITE one, that an
       element may carry its own inset edge while saying nothing whatsoever
       about focus and still be ringed. Two of the three do exactly that, and
       asserting it here stops a future kernel from passing this file by
       ringing only the one element that declares nothing. */
    assert.ok(seen.filter((r) => r.outline && /inset/.test(r.boxShadow)).length >= 2,
      'two of the three own an inset edge and declare NOTHING about focus; both ' +
      'must show that edge AND the kernel outline. saw ' +
      JSON.stringify(seen.map((r) => ({ o: r.outlineValue, b: r.boxShadow }))))
  })
})

// ══════════════════════════════════════════════════════════════════════════
// §2 · THE RECORD ITSELF
// ══════════════════════════════════════════════════════════════════════════
describe('2 · every focusable element on every page shows where focus is', { skip }, () => {
  const P = 'WCAG 2.2 AA 2.4.7 — focus visible'

  it('no page that links the kernel has a bare focus stop', async () => {
    const pages = kernelPages()

    assert.ok(pages.length > 0,
      `${P} is UNWITNESSED: no HTML found under docs/handoff-pack or frontend/dist, ` +
      'so this audit walked nothing. Counting bare stops on an empty list of ' +
      'pages proves nothing about the record.')

    const failures: string[] = []
    let stops = 0
    for (const page of pages) {
      for (const r of await tabThrough(page, readIndicator)) {
        stops++
        if (!r.ring && !r.outline) {
          failures.push(`${page.slice(REPO.length + 1)}  ${bare(r)}`)
        }
      }
    }

    /* The stop count is a precondition, not a statistic. A page list that
       resolved but whose pages have no focusable elements would report zero
       failures and mean nothing — the §5.6 shape this repository keeps
       catching in its own tools. */
    assert.ok(stops > 20,
      `${P} is UNWITNESSED: ${pages.length} pages walked but only ${stops} ` +
      'focus stops reached. The record has well over twenty focusable elements, ' +
      'so this is the audit failing to tab, not the record being small.')

    assert.deepEqual(failures, [],
      `${P}: ${failures.length} element(s) show NEITHER the kernel ring NOR an ` +
      'outline when tabbed to — a keyboard user cannot see where they are.\n\n' +
      failures.map((f) => '  ' + f).join('\n') +
      '\n\n⚠️ THIS MESSAGE USED TO NAME THE KERNEL\'S OPEN ERASABILITY FINDING AS ' +
      'THE MECHANISM and tell you to compose `var(--focus-ring)` after your own ' +
      'edge. G240 closed that finding on 22 Aug 2026: the ring is an `outline`, ' +
      'the token is retired, and a component box-shadow can no longer reach the ' +
      'ring at any specificity. SO THE CAUSE IS NOW ALMOST CERTAINLY DELIBERATE. ' +
      'Look for a rule naming `outline` on a focused element:\n' +
      '  grep -rn \'focus-visible\' design/ | grep outline\n' +
      'The repair is to DELETE that declaration, not to add one — the kernel ' +
      'already rings every focusable element and needs no help doing it.')
  })

  /**
   * 🛑 MUTATING THE KERNEL DOES NOT REACH THIS ASSERTION UNTIL YOU REBUILD, AND
   * THAT COST A WRONG CONCLUSION ON 17 Aug 2026. The pages in §1 and the first
   * test above `<link>` docs/handoff-pack/tokens.css and see an edit immediately;
   * the specimen INLINES it at build time. Deleting `.lit:focus-visible` from
   * the kernel and re-running left every suite green, which reads exactly like
   * "the repair is inert" and is in fact "the artefact is stale". With
   * `npm run build:frontend` in between, both suites go red as they should.
   * Any mutation test against the kernel must rebuild first.
   */
  it('the built specimen has no bare focus stop either', async () => {
    if (!existsSync(SPECIMEN)) {
      assert.fail(
        `${P} is UNWITNESSED on the frontend: no built page at ` +
        'frontend/dist/specimen.html. Run `npm run build:frontend`.')
    }
    const seen = await tabThrough(SPECIMEN, readIndicator)

    /* The specimen carries exactly two focusable things — the skip link and the
       light — and BOTH are load-bearing here. The light is the only focusable
       `.lit` anywhere in this repository, so it is the only element that can
       witness the kernel's `.lit:focus-visible` repair at all. */
    assert.ok(seen.some((r) => /(^|\.)lit(\.|$)/.test(r.where)),
      `${P} is UNWITNESSED on the light: the specimen's focus stops were ` +
      `${JSON.stringify(seen.map((r) => r.where))} and none of them is a .lit. ` +
      'Drop `focusable` from the specimen\'s one Luminous and this assertion ' +
      'stops covering the repair while still passing over the skip link.')

    const barestops = seen.filter((r) => !r.ring && !r.outline).map(bare)
    assert.deepEqual(barestops, [],
      `${P} on the built frontend:\n` + barestops.map((f) => '  ' + f).join('\n'))
  })
})

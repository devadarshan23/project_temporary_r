/**
 * ROUND TWO OF THE PARTNER / STAFF / APEX FIXES — the source half of the green
 * fixes for `docs/build/ui-audit/reaudit-partner-staff-apex.md`. G3701–G3719,
 * 4 Oct 2026. The behaviour is witnessed in a real browser at
 * `tests/e2e/partner-portal-layout.test.ts` §4–§9,
 * `tests/e2e/staff-console.test.ts` §7–§9 and `tests/e2e/apex-round2.test.ts`;
 * the served `requested` standing at `tests/http/partner-portal-served.test.ts` §3.
 *
 *   §1 RP-08d — THE OWNER'S RULING: the pager keeps its words.
 *   §2 NS-01 — one drop order for two chromes (§5.3).
 *   §3 NX-01 — every route root takes the one set of props, and the frame is
 *      drawn above the chrome.
 *   §4 RP-12 — no inline style left in the partner portal.
 *   §5 G3522 — the capability gates the round touched are still drawn by
 *      `useHolds(DRAW_GATES.…)`.
 *
 * Source scans read the file with comments blanked, so a sentence ABOUT a
 * removed string cannot satisfy or fail an assertion about the code.
 *
 * WITNESSED RED against `origin/main` (c8fed3c2) with this file applied and
 * `frontend/` reverted: §2a (no `quiet-drop.ts`), §2b, §3a, §3b, §3c and §4a
 * failed; §1a and §5a are pins on what already stood (RP-08d's words were
 * derived under G3570 and the ruling settles them; the gates were not moved).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8')

function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'))
    .join('\n')
}

const partner = (): string => code(read('frontend/src/components/PartnerPortal.tsx'))
const staff = (): string => code(read('frontend/src/components/StaffConsole.tsx'))

describe('§1 RP-08d · the owner\'s ruling: "Keep words: Previous / Next."', () => {
  it('§1a the claims pager says Previous and Next, and types no ‹ ›', () => {
    const src = partner()
    assert.match(src, />Previous</)
    assert.match(src, />Next</)
    assert.doesNotMatch(src, /[‹›]/)
  })
})

describe('§2 NS-01 · one drop order', () => {
  it('§2a `useQuietDrop` is declared once, in quiet-drop.ts', () => {
    assert.ok(existsSync(path.join(ROOT, 'frontend/src/components/quiet-drop.ts')))
    assert.match(code(read('frontend/src/components/quiet-drop.ts')), /export function useQuietDrop\(/)
    assert.doesNotMatch(partner(), /function useQuietDrop\(/)
  })

  it('§2b both chromes call it, and both carry the `+N` cue', () => {
    for (const src of [partner(), staff()]) {
      assert.match(src, /useQuietDrop\(dests,/)
      assert.match(src, /<li data-more="" hidden=\{dropped === 0\}>/)
    }
  })
})

describe('§3 NX-01 · the owner\'s ruling: the frame wraps the app; a click does not focus main', () => {
  it('§3a the staff console\'s route roots take ROUTE_ROOT_PROPS, not a bare tabIndex', () => {
    const src = staff()
    assert.doesNotMatch(src, /id="route-root" tabIndex=\{-1\}/)
    assert.equal((src.match(/\{\.\.\.ROUTE_ROOT_PROPS\}/g) ?? []).length, 3)
  })

  it('§3b routeRoot() spreads the same props, which undo a pointer press\'s focus on main itself', () => {
    const src = code(read('frontend/src/routes/screens.ts'))
    assert.match(src, /\{ className: 'route', \.\.\.ROUTE_ROOT_PROPS \}/)
    assert.match(src, /onPointerDown:/)
    assert.match(src, /if \(pressing && e\.target === e\.currentTarget\) e\.currentTarget\.blur\(\)/)
  })

  it('§3c the ultra-tier frame is an ::after above the chrome, not the app\'s own inset', () => {
    const css = code(read('frontend/src/close.css'))
    const ultra = css.slice(css.indexOf('@media (min-width:1440px){'))
    assert.doesNotMatch(ultra.slice(0, ultra.indexOf('}\n}') + 3), /\.app\{[^}]*box-shadow/)
    assert.match(css, /\.app::after\{content:"";position:absolute;inset:0;pointer-events:none;/)
  })
})

describe('§4 RP-12 · no inline style in the partner portal', () => {
  it('§4a `style={{` does not occur', () => {
    assert.equal((partner().match(/style=\{\{/g) ?? []).length, 0)
  })
})

describe('§5 G3522 · the drawing gates still stand', () => {
  it('§5a register, operate-sandbox, manage-staff and the onboarding acts are still gated', () => {
    assert.match(partner(), /useHolds\(DRAW_GATES\.registerDeal\)/)
    assert.match(partner(), /useHolds\(DRAW_GATES\.operateSandbox\)/)
    assert.match(partner(), /useHolds\(DRAW_GATES\.managePartnerStaff\)/)
    assert.match(staff(), /useHolds\(DRAW_GATES\.onboardingAct\)/)
  })
})

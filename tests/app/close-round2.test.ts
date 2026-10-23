/**
 * THE CLOSE SURFACE, ROUND TWO — fix/ui-close-round2, G3469–G3480 (3 Oct 2026).
 *
 * The re-audits (`docs/build/ui-audit/reaudit-*.md`) measured what the first
 * repair round left. Every decision here that is not drawing is pinned under
 * `node --test`, and where the pack states the answer the expected value is
 * DERIVED FROM THE PACK rather than typed into this file — so the day the pack
 * moves, this suite says so. The browser half (a refused register drawing no
 * controls, Escape closing the evidence, the initials, the ghost of a leaving
 * dialog) is `tests/e2e/browser-login.test.ts` §34.
 *
 * Each block was witnessed RED against `origin/main`'s frontend (a077216f)
 * before the repair; the captured failure is quoted on the block.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { REPO } from '../design/render.ts'
import {
  ORDERS,
  ORDER_CHOICES,
  QUIET_ORDERS,
  SHOWS,
  SHOW_KEYS,
  nextActOf,
  pageCurrency,
} from '../../frontend/src/close-state.ts'
import { countryOfResidency } from '../../frontend/src/chrome-state.ts'
import { initialsOf } from '../../frontend/src/initials.ts'
import { anyReading, litTargetOf, workingRunOf } from '../../frontend/src/luminous.ts'
import type { ExceptionRow } from '../../frontend/src/api/exceptions.ts'
import type { Run } from '../../frontend/src/api/runs.ts'

const PACK = join(REPO, 'docs', 'handoff-pack')
const SRC = join(REPO, 'frontend', 'src')
const read = (p: string): string => readFileSync(p, 'utf8')
const noComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')
const c1 = read(join(PACK, 'C1 Close.dc.html'))

/** The `label:'…'` members of one `const NAME = [ … ];` array in C1's script. */
function packLabels(name: string): string[] {
  const at = c1.indexOf(`const ${name} = [`)
  assert.ok(at >= 0, `C1 Close.dc.html no longer declares ${name} — the derivation is inert`)
  const block = c1.slice(at, c1.indexOf('];', at))
  return [...block.matchAll(/label:'([^']+)'/g)].map((m) => m[1] ?? '')
}

function row(over: Partial<ExceptionRow>): ExceptionRow {
  return {
    exceptionId: 'exc_1',
    ruleLabel: 'Three-way match',
    summary: 'a line',
    severity: 'high',
    status: 'open',
    assignedTo: null,
    valueAtRisk: { currency: 'SGD', amountMinor: '100000', exponent: 2 },
    raisedAt: '2026-10-03T01:00:00.000Z',
    ...over,
  } as ExceptionRow
}

function run(runId: string, status: Run['status'], startedAt: string): Run {
  return {
    runId,
    definitionId: `def_${runId}`,
    definitionName: null,
    definitionVersion: 1,
    periodId: null,
    periodStartsOn: null,
    periodEndsOn: null,
    trigger: { kind: 'scheduled' },
    status,
    startedAt,
    finishedAt: null,
    exceptionsRaised: null,
    completeness: null,
  }
}

/* RED at a077216f: the app drew [All lines, Needs you, Waiting, Cleared] and
   [Severity, Value, Newest, Oldest]. */
describe('RC-18 · SHOW and ORDER BY are C1\'s, derived from the pack (G3469)', () => {
  /* ⛔ C3-17 — THE OWNER'S RULING, 4 Oct 2026: *"Retire the register's Parked
     filter (the pile is the parked view)."* The register draws the pack's
     first three facets, in the pack's order, and NOT its fourth. */
  it('the facets are the pack\'s first three, in the pack\'s order — the fourth (Parked) retired by ruling', () => {
    const pack = packLabels('FACETS')
    assert.equal(pack.length, 4, `the pack's FACETS parse found ${String(pack.length)} labels`)
    assert.equal(pack[3], 'Parked', 'the pack\'s fourth facet is no longer Parked — re-read the ruling')
    assert.deepEqual(SHOW_KEYS.map((k) => SHOWS[k].label), pack.slice(0, 3))
  })
  it('the orders are the pack\'s four: two the plane serves, live; two it does not, quiet', () => {
    const pack = packLabels('SORTS')
    assert.equal(pack.length, 4, `the pack's SORTS parse found ${String(pack.length)} labels`)
    assert.deepEqual([...ORDER_CHOICES.map((k) => ORDERS[k]), ...QUIET_ORDERS], pack)
  })
  it('the live order is the plane\'s default first, so "Line order" is the order the plane served', () => {
    assert.equal(ORDER_CHOICES[0], 'severity_then_value')
  })
})

/* RED at a077216f: `Severity` was a header and `Variance` was not. */
describe('RC-19 · the register\'s columns are C1\'s (G3469)', () => {
  const packHeads = (() => {
    const at = c1.indexOf('<table class="regt">')
    const thead = c1.slice(at, c1.indexOf('</thead>', at))
    return [...thead.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((m) => (m[1] ?? '').replace(/ SGD$/, '').trim())
  })()
  const appThead = (() => {
    const src = read(join(SRC, 'components', 'ExceptionRegister.tsx'))
    const at = src.indexOf('<thead>')
    return src.slice(at, src.indexOf('</thead>', at))
  })()

  it('the pack draws seven headers and the app seven', () => {
    assert.equal(packHeads.length, 7, `pack headers: ${JSON.stringify(packHeads)}`)
    assert.equal([...appThead.matchAll(/<th\b/g)].length, 7)
  })
  it('every pack header word appears in the app\'s header row, in order — and Severity is not one', () => {
    let from = 0
    for (const h of packHeads) {
      const i = appThead.indexOf(h, from)
      assert.ok(i >= 0, `the register has no "${h}" header after position ${String(from)}`)
      from = i + h.length
    }
    assert.doesNotMatch(appThead, /Severity/, 'the register still draws a Severity column the pack does not have')
  })
  it('the value header names the page\'s ONE currency, and none when the page has two or none', () => {
    assert.equal(pageCurrency([row({}), row({ exceptionId: 'b' })]), 'SGD')
    assert.equal(pageCurrency([row({}), row({ valueAtRisk: { currency: 'USD', amountMinor: '1', exponent: 2 } })]), null)
    assert.equal(pageCurrency([row({ valueAtRisk: null })]), null)
  })
})

/* RED at a077216f: `nextActOf` did not exist; the row's act was by status
   alone, so a colleague's open line offered Accept. */
describe('NC-05 · no Accept on a colleague\'s line (G3470)', () => {
  it('an open line is Accept when it is yours or nobody\'s, View when it is somebody else\'s', () => {
    assert.equal(nextActOf(row({ assignedTo: null }), 'usr_me'), 'accept')
    assert.equal(nextActOf(row({ assignedTo: 'usr_me' }), 'usr_me'), 'accept')
    assert.equal(nextActOf(row({ assignedTo: 'usr_vik' }), 'usr_me'), 'view')
    assert.equal(nextActOf(row({ assignedTo: 'usr_vik' }), null), 'view', 'an unread reader was offered Accept on a held line')
  })
  it('status still decides the rest: in flight is View, cleared is Reopen', () => {
    assert.equal(nextActOf(row({ status: 'pending_approval' }), 'usr_me'), 'view')
    assert.equal(nextActOf(row({ status: 'resolved', assignedTo: 'usr_vik' }), 'usr_me'), 'reopen')
  })
})

/* RED at a077216f: the square drew a bare `·` for every person. */
describe('NC-08 / RV-16 · two initials from the stored display name (the owner\'s, G3473)', () => {
  /* ⚠️ "one word gives one" WAS G3473's AND IS SUPERSEDED BY G3484/G3588: the
     owner's *"two initials … everywhere"*, so `Mei` is `ME` — one helper, one
     rule (`initials.ts`). */
  it('first and last word, upper-cased; one word gives its first two; no name gives the dot', () => {
    assert.equal(initialsOf('Parity Operator'), 'PO')
    assert.equal(initialsOf('Rosalie Tan'), 'RT')
    assert.equal(initialsOf('  maría   de la cruz '), 'MC')
    assert.equal(initialsOf('Mei'), 'ME')
    assert.equal(initialsOf(''), '·')
    assert.equal(initialsOf('   '), '·')
    assert.equal(initialsOf(null), '·')
  })
  it('takes characters by code point, so an astral first letter is not cut in half', () => {
    assert.equal(initialsOf('𝒜lex Smith'), '𝒜S')
  })
})

/* RED at a077216f: the chip drew `ap-southeast-1` verbatim. */
describe('NC-09 · no raw region on the tenant chip (G3473)', () => {
  it('a region the table knows is drawn as its country; anything else draws nothing', () => {
    assert.equal(countryOfResidency('ap-southeast-1'), 'SG')
    assert.equal(countryOfResidency('mars-north-1'), null)
    assert.equal(countryOfResidency(null), null)
    assert.equal(countryOfResidency('toString'), null, 'a prototype key resolved to a country')
    assert.equal(countryOfResidency('__proto__'), null)
  })
})

/* RED at a077216f: `workingRunOf` did not exist and the selected run won the
   light. */
describe('RMR-04 · two reading: the newest is lit and works; the other is still (the owner\'s, G3471)', () => {
  const older = run('a', 'running', '2026-10-03T01:00:00.000Z')
  const newer = run('b', 'running', '2026-10-03T02:00:00.000Z')
  const done = run('c', 'completed', '2026-10-03T03:00:00.000Z')
  it('the working mark and the light name the same run — the most recently started', () => {
    assert.equal(workingRunOf([older, newer, done]), 'b')
    assert.deepEqual(litTargetOf({ openPanel: null, stripRuns: [older, newer, done] }), { kind: 'strip', runId: 'b' })
    assert.equal(workingRunOf([done]), null)
  })
  it('an open panel takes the light and does not stop the mark', () => {
    assert.deepEqual(litTargetOf({ openPanel: 'exc_1', stripRuns: [older, newer] }), { kind: 'panel', exceptionId: 'exc_1' })
    assert.equal(workingRunOf([older, newer]), 'b')
  })
})

/* RED at a077216f: nothing re-read a reading run (`anyReading` absent). */
describe('RMR-02 · the poll runs exactly while something reads (G3472)', () => {
  it('anyReading is true for a running run and false otherwise', () => {
    assert.equal(anyReading([run('a', 'running', '2026-10-03T01:00:00.000Z')]), true)
    assert.equal(anyReading([run('a', 'completed', '2026-10-03T01:00:00.000Z')]), false)
    assert.equal(anyReading([]), false)
  })
  it('main.tsx re-reads the runs on the poll\'s tick and re-reads a running run\'s page', () => {
    const main = read(join(SRC, 'main.tsx'))
    assert.match(main, /useReadingPoll\(\s*readsRegister && load\.phase === 'read' && anyReading\(load\.runs\)/)
    assert.match(main, /\}, \[plane, readsRegister, settled, runsTick\]\)/, 'the runs read is not keyed on the poll')
    assert.match(main, /useReadingPoll\(openRunId !== null && runIsReading\)/)
  })
})

/* RED at a077216f: the band was the literal rgba(255,255,255,.46) with no dark
   value — measured 1.22:1 for --muted at its peak. */
describe('RMR-01 · the sweep keeps text legible in the dark theme (the owner\'s, G3480)', () => {
  const kernel = noComments(read(join(PACK, 'tokens.css')))
  const dark = kernel.slice(kernel.indexOf('[data-theme="dark"]{'))
  const darkBlock = dark.slice(0, dark.indexOf('}'))
  const hex = (name: string): [number, number, number] => {
    const m = new RegExp(`${name}:#([0-9a-f]{6})`).exec(darkBlock)
    assert.ok(m?.[1] !== undefined, `${name} is not a hex in the dark block`)
    const h = m[1]
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
  }
  const lin = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const lum = ([r, g, b]: [number, number, number]): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const ratio = (a: [number, number, number], b: [number, number, number]): number => {
    const [x, y] = [lum(a), lum(b)]
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }

  it('the sweep rule reads a token, never a literal', () => {
    const rule = /\.lit--running\.lit--running::after\{[^}]*\}/.exec(kernel)?.[0] ?? ''
    assert.match(rule, /var\(--lit-sweep\)/, `the sweep band is not tokenised: ${rule}`)
    assert.doesNotMatch(rule, /rgba\(/, 'a raw colour is back in the sweep rule')
  })
  it('in the dark block, --muted and --ink hold ≥4.5:1 over paper at the band\'s peak', () => {
    const m = /--lit-sweep:rgba\((\d+),(\d+),(\d+),([.\d]+)\)/.exec(darkBlock)
    assert.ok(m !== null, 'the dark theme declares no --lit-sweep')
    const [r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
    const paper = hex('--paper')
    const peak = paper.map((v, i) => v * (1 - a) + [r, g, b][i]! * a) as [number, number, number]
    assert.ok(ratio(hex('--muted'), peak) >= 4.5, `--muted at the band's peak is ${ratio(hex('--muted'), peak).toFixed(2)}:1`)
    assert.ok(ratio(hex('--ink'), peak) >= 4.5, `--ink at the band's peak is ${ratio(hex('--ink'), peak).toFixed(2)}:1`)
  })
})

/* RED at a077216f: system-page.css declared the lv keyframe. */
describe('RMR-06 · every keyframe in the pack is the kernel\'s (G3480)', () => {
  it('no stylesheet in docs/handoff-pack but tokens.css declares a keyframe', () => {
    for (const f of ['system-page.css', 'app.css', 'public.css']) {
      const css = noComments(read(join(PACK, f)))
      assert.doesNotMatch(css, /@keyframes/, `${f} declares a keyframe`)
    }
  })
})

/* RED at a077216f on each line: the tenant chip was `display:flex`, the quiet
   commit filled with an ink step, the toast edge was fail-only, the page was
   1440px wide, the row cells were shimmed, and the account menu uncapped. */
describe('the measured CSS defects stay repaired (G3477, G3478, G3479)', () => {
  const close = noComments(read(join(SRC, 'close.css')))
  it('N-01 · the tenant chip is a block box, so its ellipsis applies', () => {
    const rule = /\.chrome \.tenant\{[^}]*\}/.exec(close)?.[0] ?? ''
    assert.match(rule, /display:block/)
    assert.match(rule, /text-overflow:ellipsis/)
  })
  it('N-02 · a quiet commit is a hairline outline with muted text — never an ink step as a ground', () => {
    assert.doesNotMatch(close, /background-color:var\(--muted\)/, 'an ink step is a ground again (tokens.css: "A fourth ground is a finding")')
    const rule = /\.close \.rowact\[data-commit\]\[data-soon\]\[aria-disabled="true"\]\{[^}]*\}/.exec(close)?.[0] ?? ''
    assert.match(rule, /color:var\(--muted\)/)
    assert.match(rule, /box-shadow:inset 0 0 0 1px var\(--rule-strong\)/)
  })
  it('N-11 · no optical shim on the register\'s cells', () => {
    assert.doesNotMatch(close, /\+ 1\.5px|- 5px/)
  })
  it('N-09 · the account menu is capped and scrolls', () => {
    const rule = /\.chrome \.acctmenu\{[^}]*\}/.exec(close)?.[0] ?? ''
    assert.match(rule, /max-height:80vh/)
    assert.match(rule, /overflow-y:auto/)
  })
  it('N-08 · the drill-down page holds the kernel\'s --measure', () => {
    const rule = /\.page\{[^}]*\}/.exec(noComments(read(join(SRC, 'secondary.css'))))?.[0] ?? ''
    assert.match(rule, /max-width:var\(--measure\)/)
  })
  it('RM-11 · every toast carries the 2px emphasis edge', () => {
    const css = noComments(read(join(SRC, 'overlays.css')))
    assert.match(css, /\.toast \{ border-left: 2px solid var\(--ink\); \}/)
  })
  it('RM-12 · hover is a transition on --t-fade', () => {
    assert.match(close, /transition:background-color var\(--t-fade\) linear/)
  })
  it('N-03 · the theme toggle meets the 24px target floor', () => {
    const rule = /\.theme-toggle-b \{[^}]*\}/.exec(noComments(read(join(SRC, 'shell.css'))))?.[0] ?? ''
    assert.match(rule, /min-height: var\(--target-min\)/)
  })
})
